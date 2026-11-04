// Before/after video: the same passage of a song drawn through two render-page URLs, side by side, with the recording's sound.
//
//   node scripts/snap-compare.mjs --song liebesleid --from 60 --to 75 --left "<url>" --right "<url>" --out renders/snap/x.mp4
//        [--fps 30] [--width 640] [--labels "today|snap"] [--base http://localhost:5300]
//        [--left-knobs '{"life":0.4}'] [--right-knobs '{"life":0.5}']
//
// A URL is a render page with the frame-by-frame API (window.renderReady, renderSeek, renderTo, renderErrors): the lab
// (lab/index.html?render=1&song=<id>&only=<widget>) or the studio's render.html?show=<id>. A relative URL is resolved against --base.
// Knobs are lab-only: renderKnobs(id, {...}) sets the bases of the named knobs of every widget on the page, before the warm-up.
// Each side warms up from (from - 4) s, then frame k shows song time from + k/fps. Output: <out>.mp4 and <out minus .mp4>-sheet.png
// (one frame per 0.5 s; top row = left, bottom = right). Needs Chrome, ffmpeg on the PATH, and the dev server for the URLs.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const song = opt('song'), from = Number(opt('from')), to = Number(opt('to')), out = opt('out');
const FPS = Number(opt('fps', 30)), W = Number(opt('width', 640)), H = Math.round((W * 720) / 1280 / 2) * 2;
const BASE = opt('base', 'http://localhost:5300'), WARM = 4, BATCH = 15;
const [labL, labR] = (opt('labels', '') || '').split('|');
if (!song || !(to > from) || !opt('left') || !opt('right') || !out) {
  console.error('usage: node scripts/snap-compare.mjs --song <id> --from <s> --to <s> --left <url> --right <url> --out <file.mp4> [--fps 30] [--width 640] [--labels "a|b"] [--base url] [--left-knobs json] [--right-knobs json]');
  process.exit(1);
}
const audio = path.resolve('songs', song, 'audio.mp3');
if (!existsSync(audio)) { console.error(`no audio at ${audio}`); process.exit(1); }
const abs = (u) => new URL(u, BASE.endsWith('/') ? BASE : BASE + '/').href;
const sides = [
  { name: 'left', url: abs(opt('left')), knobs: opt('left-knobs') ? JSON.parse(opt('left-knobs')) : null },
  { name: 'right', url: abs(opt('right')), knobs: opt('right-knobs') ? JSON.parse(opt('right-knobs')) : null },
];
const outPath = path.resolve(out);
mkdirSync(path.dirname(outPath), { recursive: true });
const tmp = mkdtempSync(path.join(tmpdir(), 'snap-compare-'));
const N = Math.round((to - from) * FPS);

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', (d) => { err = (err + d).slice(-3000); });
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}:\n${err}`))));
  });
}

const problems = [];
const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (const s of sides) {
    const t0 = Date.now();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route(/localhost:5174/, (r) => r.abort());
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(s.url);
    await page.waitForFunction(() => window.renderReady === true || !!window.renderFailed, null, { timeout: 90000 });
    const failed = await page.evaluate(() => window.renderFailed ?? null);
    if (failed) throw new Error(`${s.name}: render page failed: ${failed}`);
    if (s.knobs) {
      const ok = await page.evaluate((k) => {
        if (typeof window.renderKnobs !== 'function') return false;
        for (const t of window.renderTools ?? []) window.renderKnobs(t.id, k);
        return true;
      }, s.knobs);
      if (!ok) problems.push(`${s.name}: this page has no renderKnobs (knobs only work in the lab); knobs ignored`);
    }
    await page.evaluate(({ from, FPS, WARM }) => {
      window.renderSeek(from - WARM, 1);
      for (let k = -WARM * FPS + 1; k <= 0; k++) window.renderTo(from + k / FPS);
    }, { from, FPS, WARM });
    const dir = path.join(tmp, s.name); mkdirSync(dir);
    for (let k = 0; k < N; k += BATCH) {
      const frames = await page.evaluate(({ from, FPS, k0, k1, W, H }) => {
        const c = document.getElementById('c'), o = document.createElement('canvas'); o.width = W; o.height = H;
        const g = o.getContext('2d'), res = [];
        g.imageSmoothingQuality = 'high';
        for (let k = k0; k < k1; k++) { if (k > 0) window.renderTo(from + k / FPS); g.drawImage(c, 0, 0, W, H); res.push(o.toDataURL('image/jpeg', 0.85).slice(23)); }
        return res;
      }, { from, FPS, k0: k, k1: Math.min(N, k + BATCH), W, H });
      frames.forEach((b, i) => writeFileSync(path.join(dir, `f${String(k + i).padStart(5, '0')}.jpg`), Buffer.from(b, 'base64')));
    }
    const re = await page.evaluate(() => Object.entries(window.renderErrors ?? {}).map(([k, v]) => `${k}: ${v}`));
    const pe = [...re, ...errs];
    if (pe.length) { problems.push(`${s.name}: ${pe.join('; ')}`); console.error(`${s.name} threw: ${pe.join('; ')}`); }
    await page.close();
    console.log(`${s.name}: ${N} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
} finally { await browser.close(); }

// ffmpeg: hstack, labels (if drawtext exists), audio, then the contact sheet.
const hasDrawtext = await new Promise((res) => { const p = spawn('ffmpeg', ['-hide_banner', '-filters']); let o = ''; p.stdout.on('data', (d) => (o += d)); p.on('close', () => res(/drawtext/.test(o))); });
const FONT = 'C\\:/Windows/Fonts/segoeuib.ttf';
const dt = (l) => `drawtext=fontfile='${FONT}':text='${String(l).replace(/[\\':%]/g, '')}':x=12:y=10:fontsize=${Math.round(H / 16)}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6`;
let lf = '[0:v]null[a];[1:v]null[b];';
if ((labL || labR) && hasDrawtext) lf = `[0:v]${labL ? dt(labL) : 'null'}[a];[1:v]${labR ? dt(labR) : 'null'}[b];`;
else if (labL || labR) problems.push('ffmpeg has no drawtext: labels skipped');
const inp = (s) => ['-framerate', String(FPS), '-i', path.join(tmp, s, 'f%05d.jpg')];
await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inp('left'), ...inp('right'), '-ss', String(from), '-t', String(to - from), '-i', audio,
  '-filter_complex', `${lf}[a][b]hstack=inputs=2[v]`, '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
  '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', outPath]);
const sheet = outPath.replace(/\.mp4$/i, '') + '-sheet.png', every = Math.max(1, Math.round(FPS / 2)), cols = Math.ceil(N / every), tw = Math.min(W, 320);
await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inp('left'), ...inp('right'), '-filter_complex',
  `[0:v]select='not(mod(n,${every}))',scale=${tw}:-2,tile=${cols}x1[a];[1:v]select='not(mod(n,${every}))',scale=${tw}:-2,tile=${cols}x1[b];[a][b]vstack[v]`,
  '-map', '[v]', '-frames:v', '1', sheet]);
rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
console.log(`wrote ${outPath} (${(statSync(outPath).size / 1e6).toFixed(2)} MB) and ${sheet}`);
if (problems.length) console.log('problems:\n  ' + problems.join('\n  '));
