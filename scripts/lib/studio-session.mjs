// The studio in a real browser, set up for a check (studio-check, and the UI checks of the instruments plan): temp
// songs and shows folders (WINKELAMP_SONGS / WINKELAMP_SHOWS), songs ingested or copied into them, shows written, the
// studio's own Vite server (port WINKELAMP_PORT, else 5196, up; never the user's 5173/5174/5180), system Chrome with autoplay allowed, and a
// first page opened on the first song. Local only: needs ffmpeg and system Chrome.
//
//   const st = await openStudio({ songs: 'fixture', shows: { demo: {...} } });
//   try { await st.page.click(...); } finally { await st.close(); }
//
// songs: 'fixture' (default) ingests a 30 s sine as 'demo' with scripts/fixtures/demo-notes.json as its notes; a list
//   of ids copies songs/<id> from the repo (a missing one is reported in `missing`, not fatal).
// shows: id → show, or a function of the packs ({ id: pack }) returning that, written to the temp shows folder as
//   formatted JSON before the page opens.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Whether ffmpeg runs. Without it a check says `<name>: skipped (no ffmpeg on the PATH)` and exits 0. */
export const hasFfmpeg = () => spawnSync('ffmpeg', ['-version']).status === 0;
export function needFfmpeg(name) {
  if (!hasFfmpeg()) { console.log(`${name}: skipped (no ffmpeg on the PATH)`); process.exit(0); }
}

/** PASS/FAIL lines as studio-check prints them, and the summary line with the exit code. */
export function checker() {
  const results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
  const finish = (name) => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${name}: ${results.length - failed.length}/${results.length} passed`);
    return failed.length ? 1 : 0;
  };
  return { results, check, finish };
}

/**
 * @param {{ songs?: 'fixture' | string[], shows?: Record<string, object> | ((packs: Record<string, any>) => Record<string, object>),
 *   viewport?: { width: number, height: number }, query?: string, headed?: boolean, keep?: boolean, port?: number }} [o]
 *   query: the first page's URL query (default `?song=<first song>`); port: where Vite starts looking (default 5196; WINKELAMP_PORT overrides it).
 * @returns {Promise<{ page: import('playwright').Page, base: string, dirs: { tmp: string, songs: string, shows: string },
 *   packs: Record<string, any>, missing: string[], errors: string[], vite: import('vite').ViteDevServer,
 *   browser: import('playwright').Browser, close(): Promise<void> }>}
 *   errors collects the first page's page errors (push others into it); close() closes Chrome and Vite and removes the
 *   temp folder (kept, and said, with keep).
 */
export async function openStudio(o = {}) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'wa-studio-check-'));
  const songs = path.join(tmp, 'songs'), shows = path.join(tmp, 'shows');
  mkdirSync(songs); mkdirSync(shows);
  process.env.WINKELAMP_SONGS = songs; process.env.WINKELAMP_SHOWS = shows;
  const dirs = { tmp, songs, shows };

  let vite = null, browser = null;
  const close = async () => {
    if (browser) await browser.close();
    if (vite) await vite.close();
    if (!o.keep) rmSync(tmp, { recursive: true, force: true }); else console.log(`kept ${tmp}`);
  };
  try {
    // The songs: the fixture ingested from a 30 s sine with the fixture's chords as its notes, or copies of repo songs.
    const ids = [], missing = [];
    if (!o.songs || o.songs === 'fixture') {
      const wav = path.join(tmp, 'demo.wav');
      spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=220:d=30', wav]);
      const ing = spawnSync(process.execPath, ['--import', 'tsx', path.join(ROOT, 'scripts/ingest.ts'), wav, '--id', 'demo', '--title', 'Studio check: Demo',
        '--notes', path.join(ROOT, 'scripts/fixtures/demo-notes.json')], { cwd: ROOT, encoding: 'utf8', env: process.env, timeout: 120_000 });
      if (ing.status !== 0) { console.error(ing.stdout, ing.stderr); throw new Error('studio-session: the fixture ingest failed'); }
      ids.push('demo');
    } else {
      for (const id of o.songs) {
        const from = path.join(ROOT, 'songs', id);
        if (!existsSync(path.join(from, 'pack.json'))) { missing.push(id); continue; }
        cpSync(from, path.join(songs, id), { recursive: true });
        ids.push(id);
      }
    }
    const packs = Object.fromEntries(ids.map((id) => [id, JSON.parse(readFileSync(path.join(songs, id, 'pack.json'), 'utf8'))]));

    const showMap = typeof o.shows === 'function' ? o.shows(packs) : (o.shows ?? {});
    for (const [id, show] of Object.entries(showMap)) writeFileSync(path.join(shows, `${id}.json`), `${JSON.stringify(show, null, 2)}\n`);

    vite = await createServer({ root: ROOT, logLevel: 'error', server: { host: '127.0.0.1', port: Number(process.env.WINKELAMP_PORT) || o.port || 5196, strictPort: false, hmr: false } });
    await vite.listen();
    const base = vite.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true, headless: !o.headed, args: ['--autoplay-policy=no-user-gesture-required'] });

    const page = await browser.newPage({ viewport: o.viewport ?? { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(/localhost:5174/, (r) => r.abort());   // a test browser never posts to the lab's ratings saver
    const query = o.query ?? (ids.length ? `?song=${ids[0]}` : '');
    await page.goto(`${base}/${query}`);
    if (ids.length) await page.waitForFunction(() => window.__studio?.player.duration > 0, null, { timeout: 30_000 });
    return { page, base, dirs, packs, missing, errors, vite, browser, close };
  } catch (e) {
    await close().catch(() => {});
    throw e;
  }
}
