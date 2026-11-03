// Is each widget's supersampled picture the same picture, only sharper? (plan §7)
//
//   npm run hd-check [-- --only casket,squares] [--song prelude|b5] [--at 126] [--scale 2] [--out renders/look/hd] [--frames]
//
// Each widget alone is drawn through render.html?labSong=… at scale 1 and at scale S, from at − 3 to at + 2 (30 fps
// frames, 60 Hz steps, seeded as the lab's render mode), and the frames at at, at + 1 and at + 2 are compared:
//   diff   mean absolute difference, 0..255 over RGB, between the S frame box-downsampled to 1× and the 1× frame;
//   moved  the same sum ÷ Σ max(the two): the share of the light that is not where it was (a dark frame with one
//          broken bright widget, casket or timeslice, stays under any mean that a busy correct one passes);
//   gain   mean |Laplacian| of the S frame's luminance ÷ that of the 1× frame bilinear-upscaled to S (the last frame).
// Flags: QUARTER when diff > QD or moved > QM (the picture moved: a shared-canvas reader copying a quarter, or a lost
// transform), SOFT when gain < 1.05 (no sharper than an upscale: a full-frame offscreen buffer at 1280×720), ERROR when
// the widget threw at S (the context proxy refuses pixel reads of the shared canvas), BLANK when the 1× frame is flat.
// A reader whose copy does not run in the 5 s drawn (stella's put-back) is not caught: try another --at or --song.
// It writes <out>/<id>.png: a 400×400 crop of the 1× frame bilinear-upscaled to S, beside the same crop at S (the crop
// is where the S frame has the most detail); with --frames also <id>.frames.png, the whole 1× frame beside the S frame
// box-downsampled, to see what moved. Local only: needs the lab's notes files and system Chrome; starts its own
// Vite server from port 5190.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i < 0 ? null : argv[i + 1]; };
const ONLY = opt('only')?.split(',').filter(Boolean) ?? null;
const SONG = opt('song') ?? 'prelude';
const AT = Number(opt('at') ?? (SONG === 'b5' ? 20 : 126));
const S = Number(opt('scale') ?? 2);
const OUT = path.resolve(ROOT, opt('out') ?? 'renders/look/hd');
const FRAMES = argv.includes('--frames');
const HZ = 60, FPS = 30, PRE = 3, CROP = 400;
/** The frames compared: at, at + 1 and at + 2 (a reader may copy the canvas on some frames only); the crop is the last. */
const MARKS = [0, 1, 2];
// Calibrated in T7 on kandinsky, strings, current and squares at prelude 126, scale 2 (diff 0.20, 0.91, 0.54, 0.03;
// moved 0.018, 0.019, 0.025, 0.008). The shared-canvas readers measured: diff 2.0 to 19, moved 0.57 to 0.96.
/** their largest diff + 4 */
const QD = 0.91 + 4;
/** their largest moved × 4 (lenlye and scribble, soft but correct, reach 0.05) */
const QM = 0.025 * 4;
/** Per-widget allowances on QM, each with its reason, printed in the summary so none hides. A broken reader still moves
    0.57 to 0.96 of the light, far above any of these. */
const QM_ALLOW = {
  // T24 ruling. Harmonograph's figure is drawn sharp at the picture's real size (a4fe89b), but its trails fade through
  // two 8-bit fills: its own colour-burn takes a level or two a frame off every lit pixel, so a dim 1× edge pixel dies
  // while the bright fine pixels it stands for linger, and the pen head's glow builds up a little differently under the
  // runtime's shared 0.12 wash and burn at 252 (src/widgets/runtime.ts, shared by every widget). Measured: moved 0.169
  // at prelude 126, 0.334 at b5 20 (dark frame, old trails a little more visible at 2×); the same figure, sharper (gain
  // 2.6 to 3.9). Fixing it means reading back the 2560×1440 buffer every frame and changing the shared fade at S > 1.
  harmonograph: { qm: 0.35, why: 'its trails fade through 8-bit colour-burn floors, so faint old lines linger a little longer at 2×' },
};
const W = 1280, H = 720;

if (![2, 3].includes(S)) { console.error('hd-check: --scale is 2 or 3'); process.exit(2); }
if (AT < PRE) { console.error(`hd-check: --at must be at least ${PRE}`); process.exit(2); }
for (const f of ['lab/notes.js', 'lab/notes-b5.js']) {
  if (!existsSync(path.join(ROOT, f))) { console.log(`hd-check: skipped (no ${f}: the lab's transcriptions are local only)`); process.exit(0); }
}

const vite = await createServer({ root: ROOT, logLevel: 'error', server: { host: '127.0.0.1', port: 5190, strictPort: false, hmr: false } });
await vite.listen();
const BASE = vite.resolvedUrls.local[0].replace(/\/$/, '');
const { readLabHarness } = await vite.ssrLoadModule('/src/widgets/lab-harness.ts');
const harness = readLabHarness(readFileSync(path.join(ROOT, 'lab/index.html'), 'utf8'));
const ids = harness.toolIds.filter((id) => !ONLY || ONLY.includes(id));

const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route(/localhost:517\d/, (r) => r.abort());
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return page;
}
const pages = { 1: await newPage(), [S]: await newPage() };

/** In the page: seek to at − pre, then step in 1/fps frames to each of `marks` (ascending); the canvas's RGBA as base64
    at each mark, and the widget errors. Both pages read back at the same frames (a read can change later pixels). */
function draw({ at, pre, marks, fps }) {
  window.renderSeek(at - pre, 1);
  const px = [];
  let k = 0;
  for (const m of marks) {
    const n = Math.round((pre + m) * fps);
    for (k++; k <= n; k++) window.renderTo(at - pre + k / fps);
    k = n;
    px.push(window.renderPixels());
  }
  return { px, size: window.renderSize, errors: window.renderErrors };
}

async function frame(scale, id) {
  const page = pages[scale];
  page.errors = [];
  await page.goto(`${BASE}/render.html?labSong=${SONG}&only=${encodeURIComponent(id)}&hz=${HZ}&scale=${scale}`);
  await page.waitForFunction(() => window.renderReady === true || window.renderFailed, null, { timeout: 60000 });
  const failed = await page.evaluate(() => window.renderFailed);
  if (failed) throw new Error(`scale ${scale} ${id}: ${failed}`);
  const r = await page.evaluate(draw, { at: AT, pre: PRE, marks: MARKS, fps: FPS });
  if (r.size?.w !== W * scale || r.size?.h !== H * scale) throw new Error(`scale ${scale}: renderSize ${JSON.stringify(r.size)}`);
  const px = r.px.map((b) => Buffer.from(b, 'base64'));
  if (px.some((p) => p.length !== W * scale * H * scale * 4)) throw new Error(`scale ${scale}: ${px[0].length} bytes of pixels`);
  return { px, errors: r.errors ?? {}, pageErrors: page.errors };
}

const lum = (px, n) => { const L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = 0.2126 * px[4 * i] + 0.7152 * px[4 * i + 1] + 0.0722 * px[4 * i + 2]; return L; };

/** Bilinear upscale of a w×h plane (stride ch, channel c) by s, sampling at pixel centres. */
function upscale(src, w, h, s, ch = 1, c = 0) {
  const W2 = w * s, H2 = h * s, out = new Float32Array(W2 * H2);
  const xs = new Int32Array(W2), xf = new Float32Array(W2);
  for (let X = 0; X < W2; X++) { const u = Math.min(w - 1, Math.max(0, (X + 0.5) / s - 0.5)); xs[X] = Math.min(w - 2, Math.floor(u)); xf[X] = u - xs[X]; }
  for (let Y = 0; Y < H2; Y++) {
    const v = Math.min(h - 1, Math.max(0, (Y + 0.5) / s - 0.5)), y0 = Math.min(h - 2, Math.floor(v)), fy = v - y0;
    for (let X = 0; X < W2; X++) {
      const x0 = xs[X], fx = xf[X], i00 = (y0 * w + x0) * ch + c, i10 = i00 + ch, i01 = i00 + w * ch, i11 = i01 + ch;
      out[Y * W2 + X] = (src[i00] * (1 - fx) + src[i10] * fx) * (1 - fy) + (src[i01] * (1 - fx) + src[i11] * fx) * fy;
    }
  }
  return out;
}

/** |4·L − the 4 neighbours| per pixel (0 on the border). */
function laplacian(L, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    out[i] = Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]);
  }
  return out;
}
const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; };

/** diff: mean |S frame box-downsampled − 1× frame| over RGB; moved: Σ|that| ÷ Σ max(the two), the share of the light
    that is not where it was (a dark frame with one bright widget hides a broken picture in the mean). */
function difference(one, big) {
  let sum = 0, lit = 0;
  const SW = W * S, k = 1 / (S * S);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let v = 0;
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) v += big[((y * S + dy) * SW + x * S + dx) * 4 + c];
    const a = v * k, b = one[(y * W + x) * 4 + c];
    sum += Math.abs(a - b); lit += Math.max(a, b);
  }
  return { diff: sum / (W * H * 3), moved: lit > 0 ? sum / lit : 0 };
}

function sharpness(one, big) {
  const SW = W * S;
  const lapBig = laplacian(lum(big, SW * H * S), SW, H * S);
  const lapUp = laplacian(upscale(lum(one, W * H), W, H, S), SW, H * S);
  const mb = mean(lapBig), mu = mean(lapUp);
  return { gain: mu > 0 ? mb / mu : NaN, lapBig };
}

/** The CROP×CROP box of the S frame (on a 40-px grid of S pixels) with the most |Laplacian|. */
function bestCrop(lap) {
  const SW = W * S, SH = H * S, step = 40;
  let best = { x: (SW - CROP) >> 1, y: (SH - CROP) >> 1, e: -1 };
  // column sums over CROP rows, slid down in steps
  for (let y = 0; y + CROP <= SH; y += step) {
    const col = new Float64Array(SW);
    for (let yy = y; yy < y + CROP; yy++) for (let x = 0; x < SW; x++) col[x] += lap[yy * SW + x];
    for (let x = 0; x + CROP <= SW; x += step) {
      let e = 0; for (let xx = x; xx < x + CROP; xx++) e += col[xx];
      if (e > best.e) best = { x, y, e };
    }
  }
  return best;
}

function png(file, rgba, w, h) {
  const p = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', file], { input: rgba });
  if (p.status !== 0) throw new Error(`ffmpeg: ${p.stderr}`);
}

/** The 1× frame | the S frame box-downsampled, 2560×720. */
function writeFrames(file, one, big) {
  const out = Buffer.alloc(W * 2 * H * 4), SW = W * S;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const l = (y * W * 2 + x) * 4, r = l + W * 4;
    for (let c = 0; c < 3; c++) {
      let v = 0;
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) v += big[((y * S + dy) * SW + x * S + dx) * 4 + c];
      out[l + c] = one[(y * W + x) * 4 + c]; out[r + c] = Math.round(v / (S * S));
    }
    out[l + 3] = out[r + 3] = 255;
  }
  png(file, out, W * 2, H);
}

function writeCrop(file, one, big, at) {
  const SW = W * S, out = Buffer.alloc(CROP * 2 * CROP * 4);
  const up = [0, 1, 2].map((c) => upscale(one, W, H, S, 4, c));
  for (let y = 0; y < CROP; y++) for (let x = 0; x < CROP; x++) {
    const si = (at.y + y) * SW + at.x + x, l = (y * CROP * 2 + x) * 4, r = l + CROP * 4;
    for (let c = 0; c < 3; c++) { out[l + c] = Math.round(up[c][si]); out[r + c] = big[si * 4 + c]; }
    out[l + 3] = out[r + 3] = 255;
    if (x === 0) { out[r] = 90; out[r + 1] = 90; out[r + 2] = 90; }   // a grey seam between the halves
  }
  png(file, out, CROP * 2, CROP);
}

mkdirSync(OUT, { recursive: true });
const rows = [];
const t0 = Date.now();
for (const [i, id] of ids.entries()) {
  const [one, big] = await Promise.all([frame(1, id), frame(S, id)]);
  const ds = MARKS.map((_, i) => difference(one.px[i], big.px[i]));
  const diff = Math.max(...ds.map((d) => d.diff)), moved = Math.max(...ds.map((d) => d.moved));
  const last = MARKS.length - 1, { gain, lapBig } = sharpness(one.px[last], big.px[last]);
  const flags = [];
  if (Object.keys(big.errors).length || big.pageErrors.length) flags.push('ERROR');
  if (diff > QD || moved > (QM_ALLOW[id]?.qm ?? QM)) flags.push('QUARTER');
  if (Number.isNaN(gain)) flags.push('BLANK'); else if (gain < 1.05) flags.push('SOFT');
  writeCrop(path.join(OUT, `${id}.png`), one.px[last], big.px[last], bestCrop(lapBig));
  if (FRAMES) writeFrames(path.join(OUT, `${id}.frames.png`), one.px[last], big.px[last]);
  const err = [...Object.entries(big.errors).map(([k, v]) => `${k}: ${v}`), ...big.pageErrors].join(' | ');
  const err1 = Object.keys(one.errors).length ? ` (also at 1×: ${JSON.stringify(one.errors)})` : '';
  rows.push({ id, diff, moved, gain, flags, err });
  console.log(`[${i + 1}/${ids.length}] ${id.padEnd(13)} diff ${diff.toFixed(2).padStart(6)}  moved ${moved.toFixed(3)}  gain ${Number.isNaN(gain) ? '   -' : gain.toFixed(2)}  ${flags.join(' ')}${err ? `  ${err}` : ''}${err1}`);
}
await browser.close();
await vite.close();

const list = (f) => rows.filter((r) => r.flags.includes(f)).map((r) => r.id).join(', ') || 'none';
console.log(`\n${SONG} at ${AT}, scale ${S}, QD ${QD}, QM ${QM}; ${((Date.now() - t0) / 1000).toFixed(0)} s; crops in ${path.relative(ROOT, OUT)}`);
for (const [id, a] of Object.entries(QM_ALLOW)) if (rows.some((r) => r.id === id)) console.log(`allowed: ${id} moved up to ${a.qm} (${a.why})`);
console.log(`QUARTER: ${list('QUARTER')}`);
console.log(`ERROR:   ${list('ERROR')}`);
console.log(`SOFT:    ${list('SOFT')}`);
console.log(`BLANK:   ${list('BLANK')}`);
process.exit(rows.some((r) => r.flags.includes('QUARTER') || r.flags.includes('ERROR')) ? 1 : 0);
