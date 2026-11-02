// A short silent demo of each widget for the lab's "demo" button: lab/demos/<id>.mp4, 640x360, 30 fps, H.264, no audio.
//
//   npm run widget-demos [-- <id> <id> ...] [--base http://localhost:5173]
//
// Needs the Vite dev server (npm run dev), system Chrome and ffmpeg on the PATH. lab/demos.json says, per widget, which song,
// where it starts and how many seconds (and `over`: a widget to draw it over, for the ones that only cut into what is below).
// Like lab/render.mjs: the page runs in render mode, no audio; this script steps the song clock frame by frame, so every frame
// is drawn by the same code as the live lab at the default knobs. 5 s of warm-up before the start so the picture is alive.
// One widget at a time. Re-running replaces the files (the widgets change; the demos get re-made). The videos hold nothing
// from the recordings but what the widgets drew, yet like the other rendered videos they stay out of git (lab/demos/*.mp4).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const LAB = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(LAB, 'demos');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i < 0 ? dflt : argv[i + 1]; };
const named = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const BASE = opt('base', 'http://localhost:5173'), FPS = 30, WARM = 5, BATCH = 15, W = 640, H = 360;
const PLAN = JSON.parse(readFileSync(path.join(LAB, 'demos.json'), 'utf8'));
const ids = named.length ? named : Object.keys(PLAN);
for (const id of ids) if (!PLAN[id]) { console.error(`no entry for "${id}" in lab/demos.json`); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const write = (stream, buf) => (stream.write(buf) ? Promise.resolve() : new Promise((r) => stream.once('drain', r)));
function ffmpeg(file) {
  // Video only, modest quality: a couple of MB at most. Written beside the target, then moved over it.
  const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '27', '-maxrate', '2500k', '-bufsize', '5000k',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-f', 'mp4', file], { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err = (err + d).slice(-3000); });
  const done = new Promise((res, rej) => p.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}: ${err}`)))));
  return { p, done };
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
// Never post anything to the ratings server (the user's live one), and no Vite live reload mid-render.
await page.route(/localhost:5174/, (r) => r.fulfill({ status: 200, body: 'ok' }));
await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
const failed = [];
for (const id of ids) {
  const { song, start, seconds, over } = PLAN[id], t0 = Date.now();
  const tmp = path.join(OUT, `${id}.part.mp4`);
  try {
    const only = over ? `${over},${id}` : id;
    await page.goto(`${BASE}/lab/index.html?render=1&only=${encodeURIComponent(only)}&song=${encodeURIComponent(song)}`);
    await page.waitForFunction(() => window.renderReady === true, null, { timeout: 60000 });
    const n = Math.round(seconds * FPS);
    await page.evaluate(({ start, FPS, WARM }) => {
      window.renderSeek(start - WARM, 1);
      for (let k = -WARM * FPS + 1; k <= 0; k++) window.renderTo(start + k / FPS);   // warm-up, not captured
    }, { start, FPS, WARM });
    const ff = ffmpeg(tmp);
    for (let k = 0; k < n; k += BATCH) {
      const frames = await page.evaluate(({ start, FPS, k0, k1, W, H }) => {
        const c = document.getElementById('c'), o = document.createElement('canvas'); o.width = W; o.height = H;
        const g = o.getContext('2d'), out = [];
        g.imageSmoothingQuality = 'high';
        for (let k = k0; k < k1; k++) { if (k > 0) window.renderTo(start + k / FPS); g.drawImage(c, 0, 0, W, H); out.push(o.toDataURL('image/jpeg', 0.92).slice(23)); }
        return out;
      }, { start, FPS, k0: k, k1: Math.min(n, k + BATCH), W, H });
      for (const b of frames) await write(ff.p.stdin, Buffer.from(b, 'base64'));
    }
    ff.p.stdin.end();
    await ff.done;
    const errs = await page.evaluate(() => Object.values(window.renderErrors ?? {}));
    if (errs.length) console.log(`${id}: widget errors: ${errs.join('; ')}`);
    renameSync(tmp, path.join(OUT, `${id}.mp4`));
    console.log(`${id}: ${seconds} s from ${song} ${start} s${over ? ` over ${over}` : ''} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (e) { failed.push(`${id} (${String(e.message).split('\n')[0]})`); console.log(`${id}: FAILED`); rmSync(tmp, { force: true }); }
}
await browser.close();
if (failed.length) { console.log(`\nCould not make: ${failed.join('; ')}`); process.exitCode = 1; }
console.log(`\n${ids.length - failed.length} of ${ids.length} demos in lab/demos`);
