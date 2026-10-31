// A show as an HD video, frame by frame, with the recording's sound (plan §10): exact and smooth whatever the machine,
// unlike a recording made while the song plays.
//
//   npm run render-show -- <show id | show.json> [--out renders/<id>.mp4] [--fps 30] [--hz 60] [--from 0] [--to <end>]
//                          [--crf 18] [--framemd5 <file>] [--headed]
//
// The show is shows/<id>.json (or the file given); a song with no show of its own gets the one the studio would compose
// for it. Its own Vite server and headless system Chrome open render.html?show=<id> (the studio's runtime and Conductor),
// which draws on demand: frame k shows the song at from + k/fps after stepping there in substeps of 1/hz s, so an
// attack is drawn on the first frame at or after its time (never more than one frame late), and the same show gives
// the same frames every time (randomness is seeded). A start after 0 is pre-rolled 3 s so the first frame is not black.
// Frames go to ffmpeg as JPEG (q 0.92), libx264 -crf 18 -preset medium; the pack's audio is cut to [from, to] sample
// for sample (atrim) → AAC 192k; +faststart. --framemd5 writes one md5 per frame as drawn (before x264), to compare runs.
// Videos carry the user's recordings: renders/ stays out of git. Needs ffmpeg on the PATH and Chrome.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: npm run render-show -- <show id | show.json> [--out renders/<id>.mp4] [--fps 30] [--hz 60] [--from 0] [--to <end>] [--crf 18] [--framemd5 <file>]';
const VALUED = ['out', 'fps', 'hz', 'from', 'to', 'crf', 'framemd5'], FLAGS = ['headed', 'keep'];
const argv = process.argv.slice(2);
const opts = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    if (FLAGS.includes(k)) opts[k] = true;
    else if (VALUED.includes(k) && i + 1 < argv.length) opts[k] = argv[++i];
    else { console.error(`unknown option ${a}\n${USAGE}`); process.exit(2); }
  } else pos.push(a);
}
if (pos.length !== 1) { console.error(USAGE); process.exit(2); }
const num = (k, d) => {
  if (opts[k] === undefined) return d;
  const v = Number(opts[k]);
  if (!Number.isFinite(v)) { console.error(`--${k} must be a number, not ${opts[k]}`); process.exit(2); }
  return v;
};
const FPS = num('fps', 30), HZ = num('hz', 60), CRF = num('crf', 18);
const PREROLL = 3, BATCH = 15;
if (FPS <= 0 || FPS > 120 || HZ < 1) { console.error('--fps must be in (0, 120] and --hz ≥ 1'); process.exit(2); }
if (spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('render-show needs ffmpeg on the PATH'); process.exit(1); }

const clock = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const run = (cmd, args, { stdin = false } = {}) => {
  const p = spawn(cmd, args, { stdio: [stdin ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
  const done = new Promise((res, rej) => {
    p.on('error', rej);
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}:\n${err}`))));
  });
  return { p, done };
};
const write = (stream, buf) => (stream.write(buf) ? Promise.resolve() : new Promise((r) => stream.once('drain', r)));

const vite = await createServer({ root: ROOT, logLevel: 'error', server: { host: '127.0.0.1', port: 5190, strictPort: false, hmr: false } });
let browser = null, tmp = null, code = 0;
try {
  const { validateShow } = await vite.ssrLoadModule('/src/studio/show/show.ts');
  const { composeShow } = await vite.ssrLoadModule('/src/studio/compose/compose.ts');
  const { loadCatalogue } = await vite.ssrLoadModule('/scripts/node/catalogue.ts');
  const { songsDir, showsDir } = await vite.ssrLoadModule('/scripts/node/pack-io.ts');
  const songs = songsDir(), widgets = loadCatalogue().widgets;
  const readPack = (id) => {
    const f = path.join(songs, id, 'pack.json');
    if (!existsSync(f)) throw new Error(`no song pack ${f} (npm run ingest -- <audio> --id ${id})`);
    return JSON.parse(readFileSync(f, 'utf8'));
  };

  // The show: a file, shows/<id>.json, or (a song without a show) the one the studio composes for it.
  const arg = pos[0];
  let show, from = 'file';
  if (arg.endsWith('.json') || existsSync(arg)) {
    show = JSON.parse(readFileSync(path.resolve(arg), 'utf8'));
  } else if (existsSync(path.join(showsDir(), `${arg}.json`))) {
    show = JSON.parse(readFileSync(path.join(showsDir(), `${arg}.json`), 'utf8'));
  } else if (existsSync(path.join(songs, arg, 'pack.json'))) {
    show = composeShow({ pack: readPack(arg), widgets });
    from = 'composed';
  } else throw new Error(`no show ${arg}: not a file, not in ${showsDir()}, and no song pack ${arg} in ${songs}`);
  const pack = readPack(show.song);
  const v = validateShow(show, { duration: pack.duration, widgets });
  for (const w of v.warnings) console.log(`warning  ${w.path}: ${w.message}`);
  if (v.errors.length) {
    for (const e of v.errors) console.error(`error  ${e.path}: ${e.message}`);
    throw new Error(`the show has ${v.errors.length} error(s): npm run check-show -- --fix <file> repairs most`);
  }
  const audioFile = path.join(songs, show.song, pack.audio);
  if (!existsSync(audioFile)) throw new Error(`no recording ${audioFile}`);

  const start = Math.max(0, num('from', 0)), end = Math.min(pack.duration, num('to', pack.duration));
  if (!(end > start)) throw new Error(`nothing to render between ${start} and ${end} s (the song lasts ${pack.duration.toFixed(2)} s)`);
  const n = Math.round((end - start) * FPS), secs = n / FPS;
  const out = path.resolve(opts.out ?? path.join(ROOT, 'renders', `${show.id}.mp4`));
  mkdirSync(path.dirname(out), { recursive: true });
  tmp = mkdtempSync(path.join(tmpdir(), 'wa-render-show-'));
  console.log(`${show.title ?? pack.title} (${from === 'composed' ? 'composed for the song: no shows/' + show.id + '.json' : `${show.sections.length} sections`}): `
    + `${clock(start)}–${clock(end)}, ${n} frames at ${FPS} fps (${HZ} Hz steps) → ${out}`);

  await vite.listen();
  const BASE = vite.resolvedUrls.local[0].replace(/\/$/, '');
  browser = await chromium.launch({ channel: 'chrome', headless: !opts.headed, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  // No live reload mid-render (other work edits files), never the lab's ratings server, and this exact show.
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route(/localhost:5174/, (r) => r.abort());
  await page.route(new RegExp(`/api/shows/${encodeURIComponent(show.id)}$`), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(show) }));
  await page.goto(`${BASE}/render.html?show=${encodeURIComponent(show.id)}&hz=${HZ}`);
  await page.waitForFunction(() => window.renderReady === true || !!window.renderFailed, null, { timeout: 60_000 });
  const failed = await page.evaluate(() => window.renderFailed ?? null);
  if (failed) throw new Error(`render.html failed: ${failed}`);

  // Pre-roll (not captured) up to exactly the start; frame 0 is the picture there.
  await page.evaluate(({ start, FPS, PREROLL }) => {
    if (start <= 0) { window.renderSeek(start, 1); return; }
    window.renderSeek(Math.max(0, start - PREROLL), 1);
    const k0 = Math.ceil(-Math.min(PREROLL, start) * FPS) + 1;
    for (let k = k0; k <= 0; k++) window.renderTo(start + k / FPS);
  }, { start, FPS, PREROLL });

  const video = path.join(tmp, 'video.mp4');
  const ff = run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-frames:v', String(n), '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', String(CRF),
    '-pix_fmt', 'yuv420p', '-r', String(FPS), video], { stdin: true });
  const md5s = [];
  const t0 = Date.now();
  let lastReport = t0;
  for (let k = 0; k < n; k += BATCH) {
    const frames = await page.evaluate(({ start, FPS, k0, k1 }) => {
      const c = document.getElementById('c'), out = [];
      for (let k = k0; k < k1; k++) { if (k > 0) window.renderTo(start + k / FPS); out.push(c.toDataURL('image/jpeg', 0.92).slice(23)); }
      return out;
    }, { start, FPS, k0: k, k1: Math.min(n, k + BATCH) });
    for (const b of frames) {
      const buf = Buffer.from(b, 'base64');
      if (opts.framemd5) md5s.push(createHash('md5').update(buf).digest('hex'));
      await write(ff.p.stdin, buf);
    }
    const now = Date.now(), done = Math.min(n, k + BATCH);
    if (now - lastReport >= 10_000 && done < n) {
      lastReport = now;
      const per = (now - t0) / 1000 / done;
      console.log(`  ${clock(start + done / FPS)} of ${clock(end)}: ${done}/${n} frames (${(100 * done / n).toFixed(0)} %), `
        + `${(per * FPS).toFixed(2)} s per video second, about ${clock(per * (n - done))} left`);
    }
  }
  ff.p.stdin.end();
  await ff.done;
  const frameSecs = (Date.now() - t0) / 1000;
  const widgetErrors = await page.evaluate(() => ({ ...window.renderErrors }));
  await browser.close(); browser = null;

  // The sound: the recording cut to [start, end) sample for sample, as long as the frames.
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-i', audioFile, '-map', '0:v', '-map', '1:a',
    '-af', `atrim=start=${start}:end=${start + secs},asetpts=PTS-STARTPTS`, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', out]).done;
  if (opts.framemd5) {
    writeFileSync(path.resolve(opts.framemd5), md5s.map((h, k) => `${k},${h}\n`).join(''));
    console.log(`frame md5s → ${path.resolve(opts.framemd5)}`);
  }
  const total = (Date.now() - t0) / 1000;
  console.log(`done: ${clock(secs)} of video in ${clock(total)} (frames ${(frameSecs / secs).toFixed(2)} s per video second) → ${out}`);
  const errs = Object.entries(widgetErrors);
  if (errs.length) { console.log('widgets that stopped (the rest of the picture went on):'); for (const [id, e] of errs) console.log(`  ${id}: ${e}`); }
  if (pageErrors.length) { console.error(`page errors:\n  ${[...new Set(pageErrors)].join('\n  ')}`); code = 1; }
} catch (e) {
  console.error(`render-show: ${e.message ?? e}`);
  code = 1;
} finally {
  if (browser) await browser.close();
  await vite.close();
  if (tmp && !opts.keep) rmSync(tmp, { recursive: true, force: true });
  else if (tmp) console.log(`kept ${tmp}`);
}
process.exit(code);
