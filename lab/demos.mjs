// A short silent demo of each widget for the lab's "demo" button: lab/demos/<id>.mp4, 640x360, 30 fps, H.264, no audio.
//
//   npm run widget-demos [-- <id> <id> ...] [--base http://localhost:5173]
//
// Needs the Vite dev server (npm run dev), system Chrome and ffmpeg on the PATH. lab/demos.json says, per widget, which song,
// where it starts and how many seconds, and optionally `over` (a widget to draw it over, for the ones that only cut into what
// is below) and `warm` (seconds of warm-up, 5 unless it says more, for the widgets that build up slowly).
// Like lab/render.mjs: the page runs in render mode, no audio; this script steps the song clock frame by frame, so every frame
// is drawn by the same code as the live lab at the default knobs. The warm-up is drawn but not captured, so the picture is alive
// from the first frame; a start earlier than its warm-up would warm nothing, so such an entry is refused.
// One widget at a time. Re-running replaces a file only once its new clip is whole and the widget threw nothing: if a clip fails,
// ffmpeg is ended, the old file stays, the next widget goes on, and the failures are listed at the end with a non-zero exit.
// The videos hold nothing from the recordings but what the widgets drew, yet like the other rendered videos they stay out of git
// (lab/demos/*.mp4).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const LAB = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(LAB, 'demos');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i < 0 ? dflt : argv[i + 1]; };
const named = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const BASE = opt('base', 'http://localhost:5173'), FPS = 30, WARM = 5, BATCH = 15, W = 640, H = 360, STUCK_MS = 180000;
const PLAN = JSON.parse(readFileSync(path.join(LAB, 'demos.json'), 'utf8'));
const ids = named.length ? named : Object.keys(PLAN);
for (const id of ids) if (!PLAN[id]) { console.error(`no entry for "${id}" in lab/demos.json`); process.exit(1); }
mkdirSync(OUT, { recursive: true });

function ffmpeg(file) {
  // Video only, modest quality: a couple of MB at most. Written beside the target, then moved over it.
  const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '27', '-maxrate', '2500k', '-bufsize', '5000k',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-f', 'mp4', file], { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '', stdinError = null;
  p.stderr.on('data', (d) => { err = (err + d).slice(-3000); });
  p.stdin.on('error', (e) => { stdinError = e; });   // ffmpeg died: seen by write(), and never an uncaught EPIPE
  // 'close' does not follow a failed spawn on every path, so 'error' settles it too.
  const closed = new Promise((res) => { p.once('close', (code) => res({ code })); p.once('error', (e) => res({ code: -1, spawnError: e })); });
  const done = closed.then(({ code, spawnError }) => {
    if (spawnError) throw new Error(`could not start ffmpeg: ${spawnError.message}`);
    if (code !== 0) throw new Error(`ffmpeg exited ${code}: ${err}`);
  });
  done.catch(() => {});   // read by finish(); a clip that fails before then has its own error to report
  /** One frame in, waiting if the pipe is full; throws, rather than waiting for ever, once ffmpeg has gone. */
  const write = (buf) => new Promise((res, rej) => {
    const gone = () => new Error(`ffmpeg stopped taking frames: ${stdinError?.message ?? err}`);
    if (stdinError || p.exitCode !== null || !p.stdin.writable) { rej(gone()); return; }
    if (p.stdin.write(buf)) { res(); return; }
    const off = () => { p.stdin.off('drain', onDrain); p.stdin.off('close', onGone); };
    const onDrain = () => { off(); res(); };
    const onGone = () => { off(); rej(gone()); };
    p.stdin.once('drain', onDrain); p.stdin.once('close', onGone);
  });
  /** Ends ffmpeg whatever state it is in, and waits for it, so that it no longer holds the partial file. */
  const stop = async () => {
    try { p.stdin.destroy(); } catch {}
    try { p.kill('SIGKILL'); } catch {}
    await closed;
  };
  return { write, stop, finish: () => { p.stdin.end(); return done; } };
}

/** Page work that may wedge (a widget stuck in a loop never returns to the event loop). */
const inTime = (work, what) => {
  let timer;
  const late = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${what}: nothing for ${STUCK_MS / 1000} s`)), STUCK_MS); });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
};

/** Moves the finished clip over the old one. On Windows a rename onto an open file fails with EPERM, and the dev server can hold a
    clip open after a hover was cut short (seen with the lab's own button), or a virus scan for a moment. Such a file can still be
    moved aside, so that is the second try; the old file comes back if the new one still cannot go in. */
async function moveInPlace(from, to) {
  const locked = (e) => ['EPERM', 'EBUSY', 'EACCES'].includes(e.code);
  for (let tries = 3; tries > 0; tries--) {
    try { renameSync(from, to); return; } catch (e) { if (!locked(e)) throw e; }
    await new Promise((r) => setTimeout(r, 300));
  }
  const aside = to.replace(/\.mp4$/, '.old.mp4');
  rmSync(aside, { force: true });
  renameSync(to, aside);
  try { renameSync(from, to); } catch (e) { renameSync(aside, to); throw e; }
  try { rmSync(aside, { force: true }); } catch { /* still held open: it goes with the next run of this clip */ }
}

async function makeClip(page, id) {
  const { song, start, seconds, over, warm = WARM } = PLAN[id];
  if (start < Math.max(warm, 6)) throw new Error(`start ${start} s leaves too little song to warm up on (${warm} s of warm-up, and at least 6 s in)`);
  const only = over ? `${over},${id}` : id, tmp = path.join(OUT, `${id}.part.mp4`), n = Math.round(seconds * FPS);
  await page.goto(`${BASE}/lab/index.html?render=1&only=${encodeURIComponent(only)}&song=${encodeURIComponent(song)}`);
  await page.waitForFunction(() => window.renderReady === true, null, { timeout: 60000 });
  await inTime(page.evaluate(({ start, FPS, warm }) => {
    window.renderSeek(start - warm, 1);
    for (let k = -warm * FPS + 1; k <= 0; k++) window.renderTo(start + k / FPS);   // warm-up, not captured
  }, { start, FPS, warm }), 'warm-up');
  const ff = ffmpeg(tmp);
  try {
    for (let k = 0; k < n; k += BATCH) {
      const frames = await inTime(page.evaluate(({ start, FPS, k0, k1, W, H }) => {
        const c = document.getElementById('c'), o = document.createElement('canvas'); o.width = W; o.height = H;
        const g = o.getContext('2d'), out = [];
        g.imageSmoothingQuality = 'high';
        for (let k = k0; k < k1; k++) { if (k > 0) window.renderTo(start + k / FPS); g.drawImage(c, 0, 0, W, H); out.push(o.toDataURL('image/jpeg', 0.92).slice(23)); }
        return out;
      }, { start, FPS, k0: k, k1: Math.min(n, k + BATCH), W, H }), 'frames');
      for (const b of frames) await ff.write(Buffer.from(b, 'base64'));
    }
    await ff.finish();
    const errs = await page.evaluate(() => Object.entries(window.renderErrors ?? {}).map(([k, v]) => `${k}: ${v}`));
    if (errs.length) throw new Error(`widget errors: ${errs.join('; ')}`);
    if (!statSync(tmp).size) throw new Error('ffmpeg wrote an empty file');
    await moveInPlace(tmp, path.join(OUT, `${id}.mp4`));
  } catch (e) {
    await ff.stop();
    throw e;
  } finally {
    try { rmSync(tmp, { force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { console.log(`${id}: could not remove ${tmp}: ${e.message}`); }
  }
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const failed = [];
for (const id of ids) {
  const t0 = Date.now();
  let page = null;
  try {
    // A page per clip: a widget that wedges or crashes its page takes nothing with it.
    page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
    // Never post anything to the ratings server (the user's live one), and no Vite live reload mid-render.
    await page.route(/localhost:5174/, (r) => r.fulfill({ status: 200, body: 'ok' }));
    await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await makeClip(page, id);
    const { song, start, seconds, over } = PLAN[id];
    console.log(`${id}: ${seconds} s from ${song} ${start} s${over ? ` over ${over}` : ''} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (e) {
    failed.push(`${id} (${String(e.message).split('\n')[0]})`);
    console.log(`${id}: FAILED, any older clip stays: ${String(e.message).split('\n')[0]}`);
  }
  page?.close({ runBeforeUnload: false }).catch(() => {});
}
await browser.close().catch(() => {});
console.log(`\n${ids.length - failed.length} of ${ids.length} demos made in lab/demos`);
if (failed.length) { console.log(`Could not make:\n  ${failed.join('\n  ')}`); process.exitCode = 1; }
