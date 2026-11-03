// Showcase videos of the lab's widgets: each widget alone, over five fixed passages of the two recordings, with sound.
//
//   node lab/render.mjs <widget id> <out.mp4> [--fps 30] [--hz 60] [--tmp dir] [--keep]
//
// Needs the Vite dev server on http://localhost:5173 (npm run dev), system Chrome and ffmpeg on the PATH.
// The page runs in render mode (index.html?render=1): no audio and no animation loop; this script steps the song clock
// frame by frame (renderSeek / renderTo), so every frame is drawn by the same code as the live lab, at our default knobs,
// and the same widget gives the same video every time (randomness is seeded). Each frame k of a passage shows the song
// at start + k/fps, so a chord shows on the first frame at or after its time (never more than one frame late).
// Then ffmpeg cuts the same passages out of the recordings, dips to black between them and writes the labels.
// The videos hold the user's recordings: lab/showcase/*.mp4 stays out of git.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const LAB = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i < 0 ? dflt : argv[i + 1]; };
const [ID, OUT] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.match(/^--(fps|hz|base|tmp)$/));
if (!ID || !OUT) { console.error('usage: node lab/render.mjs <widget id> <out.mp4> [--fps 30] [--hz 60] [--tmp dir] [--keep]'); process.exit(1); }
const FPS = Number(opt('fps', 30)), HZ = Number(opt('hz', 60)), BASE = opt('base', 'http://localhost:5173/lab/index.html');
const PREROLL = 3, FADE = 0.25, LABEL_S = 2.5, BATCH = 15;

// The passages: [song, start, end, label].
export const SEGMENTS = [
  ['prelude', 0, 14, 'Rachmaninoff · dread (0:00)'],
  ['prelude', 86, 100, 'Rachmaninoff · agitato (1:26)'],
  ['prelude', 126, 146, 'Rachmaninoff · the casket (2:06)'],
  ['b5', 0, 14, 'Beethoven 5 · fate knocks (0:00)'],
  ['b5', 345, 359, 'Beethoven 5 · coda (5:45)'],
];
const AUDIO = { prelude: path.join(LAB, 'prelude.mp3'), b5: path.join(LAB, 'beethoven5.mp3') };
const FONT = 'C\\:/Windows/Fonts/segoeui.ttf', FONT_B = 'C\\:/Windows/Fonts/segoeuib.ttf';

const TMP = path.join(opt('tmp', os.tmpdir()), `lab-render-${ID}-${process.pid}`);
mkdirSync(TMP, { recursive: true });
mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });

function run(cmd, args, { stdin = false } = {}) {
  const p = spawn(cmd, args, { stdio: [stdin ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
  const done = new Promise((res, rej) => p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}:\n${err}`)))));
  return { p, done };
}
const write = (stream, buf) => (stream.write(buf) ? Promise.resolve() : new Promise((r) => stream.once('drain', r)));

const t0 = Date.now();
const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
let name = ID, renderSecs = 0;
const segFiles = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  // Other agents write files overnight: no Vite live reload mid-render. And never post anything to the ratings server.
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route(/localhost:5174/, (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  let song = null;
  for (const [si, [sg, start, end, label]] of SEGMENTS.entries()) {
    if (sg !== song) {
      song = sg;
      await page.goto(`${BASE}?render=1&only=${encodeURIComponent(ID)}&song=${sg}&hz=${HZ}`);
      await page.waitForFunction(() => window.renderReady === true, null, { timeout: 30000 });
      const tools = await page.evaluate(() => window.renderTools);
      if (!tools.length) throw new Error(`no widget "${ID}" in the lab (is it in TOOL_IDS?)`);
      name = tools[0].name;
    }
    const ts = Date.now();
    const n = Math.round((end - start) * FPS);
    // pre-roll: from start - 3 s up to exactly start, not captured, so the picture isn't empty when the passage begins
    await page.evaluate(({ start, FPS, PREROLL }) => {
      window.renderSeek(start - PREROLL, 1);
      for (let k = -PREROLL * FPS + 1; k <= 0; k++) window.renderTo(start + k / FPS);
    }, { start, FPS, PREROLL });
    const file = path.join(TMP, `seg${si}.mp4`);
    // video only, near-lossless; the final pass adds sound, fades and labels
    const ff = run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
      '-frames:v', String(n), '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', file], { stdin: true });
    for (let k = 0; k < n; k += BATCH) {
      const frames = await page.evaluate(({ start, FPS, k0, k1 }) => {
        const c = document.getElementById('c'), out = [];
        for (let k = k0; k < k1; k++) { if (k > 0) window.renderTo(start + k / FPS); out.push(c.toDataURL('image/jpeg', 0.92).slice(23)); }
        return out;
      }, { start, FPS, k0: k, k1: Math.min(n, k + BATCH) });
      for (const b of frames) await write(ff.p.stdin, Buffer.from(b, 'base64'));
    }
    ff.p.stdin.end();
    await ff.done;
    const toolErr = await page.evaluate(() => Object.values(window.renderErrors));
    if (toolErr.length) errors.push(...toolErr);
    const secs = (Date.now() - ts) / 1000; renderSecs += secs;
    console.log(`${label}: ${n} frames in ${secs.toFixed(1)} s (${(secs / (end - start)).toFixed(2)} s per video second)`);
    segFiles.push(file);
  }
  if (errors.length) console.log('PAGE ERRORS:', [...new Set(errors)].join('\n'));
} finally {
  await browser.close();
}

// The final pass: each passage's sound cut from its recording (sample-accurate atrim), a dip to black at each join,
// the passage's label for its first seconds, the widget's name in the corner throughout.
const esc = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
const txt = (i, s) => { const f = path.join(TMP, `label${i}.txt`); writeFileSync(f, s, 'utf8'); return esc(f); };
const nameFile = txt('name', name);
const inputs = [], parts = [];
segFiles.forEach((f) => inputs.push('-i', f));
const songs = [...new Set(SEGMENTS.map((s) => s[0]))];
songs.forEach((s) => inputs.push('-i', AUDIO[s]));
SEGMENTS.forEach(([sg, start, end, label], i) => {
  const d = end - start, ai = segFiles.length + songs.indexOf(sg);
  parts.push(`[${i}:v]fade=t=in:st=0:d=${FADE},fade=t=out:st=${d - FADE}:d=${FADE},`
    + `drawtext=fontfile='${FONT}':textfile='${txt(i, label)}':fontsize=30:fontcolor=white@0.92:shadowcolor=black@0.7:shadowx=2:shadowy=2:box=1:boxcolor=black@0.4:boxborderw=10:x=40:y=h-80:enable='lt(t,${LABEL_S})':alpha='if(lt(t,${LABEL_S - 0.5}),1,(${LABEL_S}-t)/0.5)'[v${i}]`);
  parts.push(`[${ai}:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${FADE / 2},afade=t=out:st=${d - FADE}:d=${FADE}[a${i}]`);
});
parts.push(`${SEGMENTS.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${SEGMENTS.length}:v=1:a=1[vc][ac]`);
parts.push(`[vc]drawtext=fontfile='${FONT_B}':textfile='${nameFile}':fontsize=22:fontcolor=white@0.85:shadowcolor=black@0.6:shadowx=1:shadowy=1:box=1:boxcolor=black@0.35:boxborderw=8:x=28:y=24[vo]`);
const graph = path.join(TMP, 'graph.txt');
writeFileSync(graph, parts.join(';\n'), 'utf8');
const tf = Date.now();
await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-/filter_complex', graph, '-map', '[vo]', '-map', '[ac]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', path.resolve(OUT)]).done;
const total = SEGMENTS.reduce((a, s) => a + s[2] - s[1], 0);
console.log(`final encode ${((Date.now() - tf) / 1000).toFixed(1)} s; ${name}: ${total} s of video in ${((Date.now() - t0) / 1000).toFixed(1)} s `
  + `(frames ${(renderSecs / total).toFixed(2)} s per video second) -> ${path.resolve(OUT)}`);
if (!argv.includes('--keep')) rmSync(TMP, { recursive: true, force: true }); else console.log('kept', TMP);
