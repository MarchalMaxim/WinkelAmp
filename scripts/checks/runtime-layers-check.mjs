// The runtime's instances, routing and intensity (plan §6, T12), checked in headless Chrome through
// render.html?labSong=… (the Prelude), every assertion an exact frame hash or an exact log:
//   1. a constant-1 curve draws exactly what no layer draws;
//   2. a routed instance on a part whose notes are all the notes (&tracks=same) draws exactly what the plain widget
//      draws, for every candidate widget that uses no randomness at all (checked first: loaded at two random states,
//      and seeked with two seeds, it draws the same);
//   3. seek invariance: seek 120 then play to 125, against seek 118 with a curve at 0 over 118–120 then play to 125:
//      the same attacks are delivered (the frames are compared too, and reported);
//   4. thinning at a constant 0.5 delivers exactly the attacks that `passes` predicts in Node;
//   5. strings@melody and strings@bassline together are two instances, without errors, with different pulses;
//   6. Math.random is called as often per step with a constant-1 curve as without one.
// Regions (T15), at scale 1 and at scale 2 (render.html?scale=2):
//   7. a window over the whole canvas (x .5, y .5, w 1, h 1, feather 0, rot 0, blend over, fit stretch) with the widget
//      alone draws exactly what the widget draws without a region;
//   8. a spot of the same box with feather 0 draws exactly what the widget draws without a region.
//
//   npm run runtime-check [-- --look | --look-only] [-- --look-set=T12|T15] [-- --regions]
//     --look also writes the contact sheets to renders/look/T12/ and renders/look/T15/; --look-only writes them without
//     the checks; --look-set keeps one of the two sets; --regions runs only checks 7 and 8
//
// Local only: needs the lab's notes files and system Chrome; starts its own Vite server from port 5190.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const LOOK_ONLY = argv.includes('--look-only'), LOOK = LOOK_ONLY || argv.includes('--look');
const REGIONS_ONLY = argv.includes('--regions');   // only checks 7 and 8
const LOOK_SET = (argv.find((a) => a.startsWith('--look-set=')) ?? '').slice('--look-set='.length);
const HZ = 60;

for (const f of ['lab/notes.js', 'lab/notes-b5.js']) {
  if (!existsSync(path.join(ROOT, f))) { console.log(`runtime-check: skipped (no ${f}: the lab's transcriptions are local only)`); process.exit(0); }
}

const vite = await createServer({ root: ROOT, logLevel: 'error', server: { host: '127.0.0.1', port: 5190, strictPort: false, hmr: false } });
await vite.listen();
const BASE = vite.resolvedUrls.local[0].replace(/\/$/, '');
const { readLabHarness } = await vite.ssrLoadModule('/src/widgets/lab-harness.ts');
const harness = readLabHarness(readFileSync(path.join(ROOT, 'lab/index.html'), 'utf8'));
const { loadLayers } = await vite.ssrLoadModule('/scripts/node/layers.ts');
const WA = loadLayers(ROOT);

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
let page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
await page.route(/localhost:517\d/, (r) => r.abort());
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(typeof v === 'string' ? v : JSON.stringify(v))}`).join('&');
async function open(params, song = 'prelude') {
  pageErrors.length = 0;
  await page.goto(`${BASE}/render.html?labSong=${song}&hz=${HZ}&${q(params)}`);
  await page.waitForFunction(() => window.renderReady === true || window.renderFailed, null, { timeout: 60000 });
  const failed = await page.evaluate(() => window.renderFailed);
  if (failed) throw new Error(`${JSON.stringify(params)}: ${failed}`);
}
/** Seek (with a seed), then the frame hashes at each mark, the widget errors, the delivered log and the per-step
    Math.random counts. */
async function run(params, { seek, marks, seed = 1, song = 'prelude' }) {
  await open(params, song);
  return page.evaluate(({ seek, marks, seed }) => {
    const rt = window.renderRuntime.rt, real = Math.random;
    let n = 0;
    Math.random = () => { n++; return real(); };
    window.renderSeek(seek, seed);
    rt.deliveredLog = [];
    const hashes = [], counts = [];
    for (const m of marks) {
      while (rt.lastT < m - 1e-9) { n = 0; window.renderStep(Math.min(1 / 60, m - rt.lastT)); counts.push(n); }
      hashes.push(window.renderFrameHash());
    }
    Math.random = real;
    return { hashes, counts, log: rt.deliveredLog, errors: { ...window.renderErrors } };
  }, { seek, marks, seed });
}

let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const noErrors = (r) => Object.keys(r.errors).length === 0;

// 1. A constant-1 curve ≡ no layers.
if (!LOOK_ONLY && !REGIONS_ONLY) {
  const at = { seek: 122, marks: [123, 124.5, 126] };
  const a = await run({ only: 'strings' }, at);
  const b = await run({ layers: [{ widget: 'strings', intensity: [{ t: 0, v: 1 }] }] }, at);
  check(same(a.hashes, b.hashes) && noErrors(a) && noErrors(b), '1. strings with a constant-1 curve draws what strings draws', `${a.hashes.join(' ')} | ${b.hashes.join(' ')}`);
  // 6. The same Math.random calls per step.
  const r1 = await run({ only: 'squares' }, at), r2 = await run({ layers: [{ widget: 'squares', intensity: [{ t: 0, v: 1 }] }] }, at);
  check(same(a.counts, b.counts) && same(r1.counts, r2.counts) && r1.counts.some((c) => c > 0),
    '6. Math.random calls per step are the same with a constant-1 curve (strings, squares)',
    `squares ${r1.counts.reduce((s, c) => s + c, 0)} calls over ${r1.counts.length} steps`);
}

// 2. A routed instance on a part equal to all the notes ≡ the plain widget, for widgets without randomness.
const deterministic = [];
if (!LOOK_ONLY && !REGIONS_ONLY) {
  const at = { seek: 122, marks: [123, 124.5, 126] };
  const readers = harness.toolIds.filter((id) => /window\.NOTES/.test(readFileSync(path.join(ROOT, 'lab/tools', `${id}.js`), 'utf8')));
  const candidates = [...new Set(['strings', ...readers])];
  const passed = [], skipped = [], failed = [];
  for (const id of candidates) {
    const routed = { layers: [{ widget: id, listen: 'piano' }], tracks: 'same' };
    const plain = await run({ only: id }, at), seed2 = await run({ only: id }, { ...at, seed: 7 });
    const w0 = await run({ ...routed, warm: '0' }, at), w13 = await run({ ...routed, warm: '13' }, at);
    if (!same(plain.hashes, seed2.hashes) || !same(w0.hashes, w13.hashes)) { skipped.push(id); continue; }
    deterministic.push(id);
    if (same(plain.hashes, w0.hashes) && noErrors(w0) && noErrors(plain)) passed.push(id); else failed.push(`${id} (${plain.hashes[2]} vs ${w0.hashes[2]})`);
  }
  check(passed.length > 0 && failed.length === 0, '2. a routed instance on all the notes draws what the plain widget draws',
    `same: ${passed.join(', ') || 'none'}; differ: ${failed.join(', ') || 'none'}; not checked (random): ${skipped.join(', ') || 'none'}`);
}

// 3. Seek invariance.
if (!LOOK_ONLY && !REGIONS_ONLY) {
  const curve = [{ t: 118, v: 0 }, { t: 120, v: 0 }, { t: 120, v: 1 }];
  const framesSame = [];
  let logs = true, detail = '';
  for (const id of ['strings', 'squares', 'kandinsky', ...deterministic]) {
    const layers = [{ widget: id, intensity: curve }];
    const a = await run({ layers }, { seek: 120, marks: [124, 125] });
    const b = await run({ layers }, { seek: 118, marks: [124, 125] });
    if (!same(a.log, b.log) || !a.log.length || !noErrors(a) || !noErrors(b)) { logs = false; detail += `${id}: ${a.log.length} vs ${b.log.length} attacks; `; }
    if (same(a.hashes, b.hashes)) framesSame.push(id);
  }
  check(logs, '3. seek 120 → 125 and seek 118 (curve 0 until 120) → 125 deliver the same attacks (strings, squares, kandinsky and the widgets without randomness)',
    `${detail}frames equal at 124 and 125 for: ${framesSame.join(', ') || 'none (memory or randomness beyond 2 s)'}`);
}

// 4. Thinning at a constant 0.5 = passes in Node.
if (!LOOK_ONLY && !REGIONS_ONLY) {
  const r = await run({ layers: [{ widget: 'squares', intensity: [{ t: 0, v: 0.5 }] }] }, { seek: 120, marks: [130] });
  const times = await page.evaluate(() => window.renderRuntime.rt.chords.map((c) => c.t));
  const salt = WA.fnv32('squares');
  const want = times.filter((t) => t > 120 && t <= 130 && WA.passes(t, 0.5, salt));
  const all = times.filter((t) => t > 120 && t <= 130).length;
  const got = r.log.map(([k, t]) => { if (k !== 'squares') throw new Error(`log key ${k}`); return t; });
  check(same(got, want) && want.length > 0 && want.length < all, '4. thinning at 0.5 delivers what passes predicts', `${got.length} of ${all} attacks`);
}

// 5. Two instances of one widget on two lines.
if (!LOOK_ONLY && !REGIONS_ONLY) {
  await open({ layers: [{ widget: 'strings', listen: 'melody' }, { widget: 'strings', listen: 'bassline' }] });
  const r = await page.evaluate(() => {
    window.renderSeek(120, 1); window.renderTo(125);
    const rt = window.renderRuntime.rt, m = rt.instance('strings@melody'), b = rt.instance('strings@bassline');
    return { errors: { ...window.renderErrors }, keys: rt.loaded().filter((k) => k.startsWith('strings')),
      distinct: rt.tool('strings@melody') !== rt.tool('strings@bassline'), pm: m?.feat.pitch, pb: b?.feat.pitch,
      nm: m?.notes.length, nb: b?.notes.length, routed: [m?.routed, b?.routed] };
  });
  check(noErrors(r) && pageErrors.length === 0 && r.distinct && same(r.routed, [true, true]) && r.pm !== r.pb && r.pm > r.pb,
    '5. strings@melody and strings@bassline are two instances with their own pulses',
    `${r.keys.join(', ')}; pitch ${r.pm?.toFixed(3)} vs ${r.pb?.toFixed(3)}; notes ${r.nm} vs ${r.nb}`);
}

// 7 and 8. A window and a spot over the whole canvas with a hard edge ≡ no region, at scale 1 and 2. Exact hashes on
// Chrome's software 2D canvas: on the GPU canvas, merely using the shared canvas as a drawImage source each step (the
// spot's snapshot, as the paste-back at a weight below 1 has always done) moves a few dozen antialiased edge pixels,
// whatever is drawn with the copy; and each pixel read-back can move the canvas between GPU and CPU drawing, after which
// two runs differ by ±1–2 on a third of the picture. So on the GPU the same pictures are compared pixel by pixel, read
// once at the end, within that edge noise.
if (!LOOK_ONLY) {
  const box = { shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, rot: 0 };
  const win = { mode: 'window', ...box, blend: 'over', fit: 'stretch' }, spot = { mode: 'spot', ...box };
  // strings, squares, kandinsky and rorschach draw; casket and blocks read the canvas; pixelsort and stella draw after
  // the others (queued) and stella hooks ctx.sounding.
  const ids = ['strings', 'squares', 'kandinsky', 'rorschach', 'casket', 'blocks', 'pixelsort', 'stella'];
  const at = { seek: 122, marks: [123, 124.5, 126] };
  const gpu = page;
  const softBrowser = await chromium.launch({ channel: 'chrome', args: ['--disable-accelerated-2d-canvas', '--disable-gpu'] });
  const soft = await softBrowser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  await soft.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await soft.route(/localhost:517\d/, (r) => r.abort());
  soft.on('pageerror', (e) => pageErrors.push(e.message));
  /** The pixels at the last mark, the only read-back of the run. */
  const pixelsAt = async (params) => {
    await open(params);
    const b64 = await page.evaluate(({ seek, end }) => { window.renderSeek(seek, 1); window.renderTo(end); return window.renderPixels(); }, { seek: at.seek, end: at.marks[2] });
    return Buffer.from(b64, 'base64');
  };
  const diff = (x, y) => { let mx = 0, n = 0; for (let i = 0; i < x.length; i++) { const d = Math.abs(x[i] - y[i]); if (d) n++; if (d > mx) mx = d; } return { mx, share: n / x.length }; };
  for (const scale of ['1', '2']) {
    page = soft;
    const wDiff = [], sDiff = [], errs = [];
    for (const id of ids) {
      const ref = await run({ only: id, scale }, at);
      const w = await run({ layers: [{ widget: id, region: win }], scale }, at);
      const sp = await run({ layers: [{ widget: id, region: spot }], scale }, at);
      for (const [r, n] of [[ref, 'none'], [w, 'window'], [sp, 'spot']]) if (!noErrors(r)) errs.push(`${id} ${n}: ${JSON.stringify(r.errors)}`);
      if (!same(ref.hashes, w.hashes)) wDiff.push(`${id} (${ref.hashes[2]} vs ${w.hashes[2]})`);
      if (!same(ref.hashes, sp.hashes)) sDiff.push(`${id} (${ref.hashes[2]} vs ${sp.hashes[2]})`);
    }
    check(!wDiff.length && !errs.length, `7. scale ${scale}, software canvas: a whole-canvas window with the widget alone draws exactly what no region draws`,
      `${ids.join(', ')}; differ: ${wDiff.join(', ') || 'none'}${errs.length ? `; errors: ${errs.join('; ')}` : ''}`);
    check(!sDiff.length && !errs.length, `8. scale ${scale}, software canvas: a whole-canvas hard spot draws exactly what no region draws`,
      `differ: ${sDiff.join(', ') || 'none'}`);
    page = gpu;
    const worst = { window: { mx: 0, share: 0 }, spot: { mx: 0, share: 0 } };
    for (const id of ids) {
      const ref = await pixelsAt({ only: id, scale });
      for (const [mode, region] of [['window', win], ['spot', spot]]) {
        const d = diff(ref, await pixelsAt({ layers: [{ widget: id, region }], scale }));
        if (d.share > worst[mode].share) worst[mode] = { ...d, id };
      }
    }
    const fine = (d) => d.share < 0.0005;
    check(fine(worst.window) && fine(worst.spot), `7–8. scale ${scale}, GPU canvas: the same within the snapshot's edge noise (under 0.05 % of channels)`,
      `worst window: ${(worst.window.share * 100).toFixed(4)} % of channels, max ${worst.window.mx}${worst.window.id ? ` (${worst.window.id})` : ''}; `
      + `worst spot: ${(worst.spot.share * 100).toFixed(4)} %, max ${worst.spot.mx}${worst.spot.id ? ` (${worst.spot.id})` : ''}`);
  }
  await softBrowser.close();
}

// The look (T12 Step 5): contact sheets to renders/look/T12/.
if (LOOK && LOOK_SET !== 'T15') {
  const OUT = path.join(ROOT, 'renders/look/T12');
  mkdirSync(OUT, { recursive: true });
  /** In the page: seek, then a frame at each mark (song s) in a grid of cols cells cw wide, captioned with the time. */
  const grid = async (params, song, seek, marks, cols, cw, title) => {
    await open(params, song);
    return page.evaluate(({ seek, marks, cols, cw, title }) => {
      const src = document.getElementById('c'), ch = Math.round((cw * 9) / 16), rows = Math.ceil(marks.length / cols), top = 26;
      const out = Object.assign(document.createElement('canvas'), { width: cols * cw, height: rows * ch + top });
      const g = out.getContext('2d');
      g.fillStyle = '#333'; g.fillRect(0, 0, out.width, out.height);
      g.fillStyle = '#fff'; g.font = '15px sans-serif'; g.fillText(title, 8, 18);
      window.renderSeek(seek, 1);
      marks.forEach((m, i) => {
        window.renderTo(m);
        const x = (i % cols) * cw, y = top + Math.floor(i / cols) * ch;
        g.drawImage(src, x, y, cw - 2, ch - 2);
        g.fillStyle = '#ff0'; g.font = '13px sans-serif'; g.fillText(`${m.toFixed(2)} s`, x + 6, y + 16);
      });
      return out.toDataURL('image/png').split(',')[1];
    }, { seek, marks, cols, cw, title });
  };
  const write = (name, b64) => { writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64')); console.log(`wrote renders/look/T12/${name}`); };
  /** Two frames side by side, each with a title. */
  const pair = async (song, seek, at, a, b) => {
    const shot = async (params) => { await open(params, song); return page.evaluate(({ seek, at }) => { window.renderSeek(seek, 1); window.renderTo(at); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, { seek, at }); };
    const A = await shot(a.params), B = await shot(b.params);
    return page.evaluate(async ({ A, B, ta, tb }) => {
      const img = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${s}`; });
      const [ia, ib] = await Promise.all([img(A), img(B)]);
      const w = 960, h = 540, top = 26, out = Object.assign(document.createElement('canvas'), { width: 2 * w + 4, height: h + top });
      const g = out.getContext('2d');
      g.fillStyle = '#333'; g.fillRect(0, 0, out.width, out.height);
      g.drawImage(ia, 0, top, w, h); g.drawImage(ib, w + 4, top, w, h);
      g.fillStyle = '#fff'; g.font = '15px sans-serif'; g.fillText(ta, 8, 18); g.fillText(tb, w + 12, 18);
      return out.toDataURL('image/png').split(',')[1];
    }, { A, B, ta: a.title, tb: b.title });
  };
  const fade = WA.presets.fadeIn({ start: 20, end: 60 }, 4);
  const marks = Array.from({ length: 17 }, (_, i) => 20 + i * 0.25);
  write('fade-kandinsky.png', await grid({ layers: [{ widget: 'kandinsky', intensity: fade }] }, 'b5', 16, marks, 6, 320,
    `kandinsky, fadeIn over 4 s from 20 s (b5), class ${WA.PERSIST.kandinsky ?? 'redraw (default)'}: one frame per 0.25 s`));
  write('fade-kandinsky-ref.png', await grid({ only: 'kandinsky' }, 'b5', 16, marks, 6, 320, 'kandinsky without a curve (b5), the same frames'));
  // b5 has no attack between 18.1 and 22.66 s, so the same fade where attacks are steady (the Prelude's agitato).
  const fadeP = WA.presets.fadeIn({ start: 100, end: 120 }, 4), marksP = marks.map((m) => m + 80);
  write('fade-kandinsky-prelude.png', await grid({ layers: [{ widget: 'kandinsky', intensity: fadeP }] }, 'prelude', 96, marksP, 6, 320,
    'kandinsky, fadeIn over 4 s from 100 s (Prelude, agitato): one frame per 0.25 s'));
  write('fade-kandinsky-prelude-ref.png', await grid({ only: 'kandinsky' }, 'prelude', 96, marksP, 6, 320, 'kandinsky without a curve (Prelude), the same frames'));
  write('squares-thinned.png', await pair('prelude', 120, 126,
    { params: { layers: [{ widget: 'squares', intensity: [{ t: 0, v: 0.5 }] }] }, title: 'squares, intensity 0.5 (thinned and faded)' },
    { params: { only: 'squares' }, title: 'squares, intensity 1' }));
  const marksS = Array.from({ length: 12 }, (_, i) => 121 + i * 0.5);
  write('squares-thinned-strip.png', await grid({ layers: [{ widget: 'squares', intensity: [{ t: 0, v: 0.5 }] }] }, 'prelude', 120, marksS, 6, 320,
    `squares at intensity 0.5 (Prelude), class ${WA.PERSIST.squares ?? 'redraw (default)'}: one frame per 0.5 s`));
  write('squares-full-strip.png', await grid({ only: 'squares' }, 'prelude', 120, marksS, 6, 320, 'squares at 1, the same frames'));
  write('winter-strings.png', await pair('chopin-winter-wind', 21, 25,
    { params: { layers: [{ widget: 'strings', listen: 'melody' }] }, title: 'Winter Wind 25 s: strings on the melody' },
    { params: { only: 'strings' }, title: 'strings on all notes' }));
}

// The look (T15 Step 3): renders/look/T15/. Each picture is a row of cells, a frame (or a crop of one, in device pixels,
// at scale 2) per cell, captioned.
if (LOOK && LOOK_SET !== 'T12') {
  const OUT = path.join(ROOT, 'renders/look/T15');
  mkdirSync(OUT, { recursive: true });
  const write = (name, b64) => { writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64')); console.log(`wrote renders/look/T15/${name}`); };
  /** In the page, after open(): cells of cw px wide, each the frame at a mark, cropped; outlines[i] (a region, or null)
      is drawn dashed over cell i, on the sheet only, to show where the region is. With glide, hand-built slots. */
  const sheetJs = ({ seek, marks, cols, cw, crop, title, glide, outlines }) => {
    const src = document.getElementById('c'), rt = window.renderRuntime.rt, ctx = rt.ctx;
    const [sx, sy, sw, sh] = crop ?? [0, 0, src.width, src.height];
    const ch = Math.round((cw * sh) / sw), rows = Math.ceil(marks.length / cols), top = 26;
    const out = Object.assign(document.createElement('canvas'), { width: cols * cw, height: rows * ch + top });
    const g = out.getContext('2d');
    g.fillStyle = '#333'; g.fillRect(0, 0, out.width, out.height);
    g.fillStyle = '#fff'; g.font = '15px sans-serif'; g.fillText(title, 8, 18);
    window.renderSeek(seek, 1);
    const to = (m) => {
      if (!glide) { window.renderTo(m); return; }
      // Hand-built slots: the base widget, and the windowed one whose region glides from A to B over fade s after b.
      while (rt.lastT < m - 1e-9) {
        const t = Math.min(m, rt.lastT + 1 / 60), d = t - rt.lastT;
        rt.lastT = t; ctx.now += d;
        const layer = t < glide.b ? { region: glide.A }
          : t < glide.b + glide.fade ? { region: glide.B, glide: { from: glide.A, u: (t - glide.b) / glide.fade } } : { region: glide.B };
        rt.step(t, d, [{ id: glide.base, receiving: true, weight: 1 }, { id: glide.id, receiving: true, weight: 1, layer }]);
      }
    };
    marks.forEach((m, i) => {
      to(m);
      const x = (i % cols) * cw, y = top + Math.floor(i / cols) * ch;
      g.drawImage(src, sx, sy, sw, sh, x, y, cw - 2, ch - 2);
      const r = outlines?.[i];
      if (r) {
        const k = (cw - 2) / sw;
        g.save(); g.beginPath(); g.rect(x, y, cw - 2, ch - 2); g.clip();
        g.translate(x + (r.x * src.width - sx) * k, y + (r.y * src.height - sy) * k); g.rotate(((r.rot || 0) * Math.PI) / 180);
        g.strokeStyle = 'rgba(0,255,255,0.7)'; g.setLineDash([4, 4]); g.lineWidth = 1;
        const w = r.w * src.width * k, h = r.h * src.height * k;
        g.beginPath();
        if (r.shape === 'ellipse') g.ellipse(0, 0, w / 2, h / 2, 0, 0, 2 * Math.PI); else g.rect(-w / 2, -h / 2, w, h);
        g.stroke(); g.restore();
      }
      g.fillStyle = '#ff0'; g.font = '13px sans-serif'; g.fillText(`${m.toFixed(2)} s`, x + 6, y + 16);
    });
    return out.toDataURL('image/png').split(',')[1];
  };
  const sheet = async (params, song, o) => { await open(params, song); return page.evaluate(sheetJs, o); };
  const ell = { mode: 'spot', shape: 'ellipse', x: 0.5, y: 0.5, w: 0.5, h: 0.62, feather: 0.25 };
  const winR = { mode: 'window', shape: 'rect', x: 0.62, y: 0.42, w: 0.42, h: 0.42, rot: 14, feather: 0.12, blend: 'over', fit: 'cover' };
  const A = { mode: 'window', shape: 'rect', x: 0.27, y: 0.3, w: 0.36, h: 0.36, rot: 0, feather: 0.15, blend: 'over', fit: 'cover' };
  const B = { mode: 'window', shape: 'rect', x: 0.7, y: 0.66, w: 0.48, h: 0.48, rot: -20, feather: 0.3, blend: 'over', fit: 'cover' };
  const glide = { base: 'kandinsky', id: 'rorschach', A, B, b: 122, fade: 3 };
  const glideAt = (t) => (t < glide.b ? A : t < glide.b + glide.fade ? WA.glideRegion(A, B, (t - glide.b) / glide.fade) : B);
  for (const scale of ['1', '2']) {
    const S = Number(scale), sfx = S > 1 ? '-x2' : '';
    // At scale 2: a crop of 1280×720 device pixels (a quarter of the picture, at 1:1) around the region's edge.
    const crop = (cx, cy) => (S > 1 ? [Math.round(cx * 2560 - 640), Math.round(cy * 1440 - 360), 1280, 720] : undefined);
    const cw = S > 1 ? 640 : 480;
    write(`spot-casket-over-squares${sfx}.png`, await sheet({ only: 'squares', layers: [{ widget: 'casket', region: ell }], scale }, 'prelude',
      { seek: 120, marks: [124, 125, 126], cols: 3, cw, crop: crop(0.3, 0.3), outlines: [ell, ell, ell],
        title: `casket in a spot ellipse (feather .25) over squares, Prelude, scale ${S}${S > 1 ? ', crop at 1:1 device px' : ''}` }));
    write(`squares-casket-full${sfx}.png`, await sheet({ only: 'squares,casket', scale }, 'prelude',
      { seek: 120, marks: [124, 125, 126], cols: 3, cw, crop: crop(0.3, 0.3), title: `casket full-screen over squares (reference), scale ${S}` }));
    write(`window-rorschach-over-kandinsky${sfx}.png`, await sheet({ only: 'kandinsky', layers: [{ widget: 'rorschach', region: winR }], scale }, 'b5',
      { seek: 0, marks: [4, 8, 16, 30], cols: 4, cw: S > 1 ? 480 : 360, crop: crop(0.62, 0.42), outlines: [winR, winR, winR, winR],
        title: `rorschach in a window rect rotated 14°, feather .12, cover, over kandinsky, b5 from 0 s, scale ${S} (dashed: the region, drawn on this sheet only)` }));
    write(`window-rorschach-alone${sfx}.png`, await sheet({ only: 'rorschach', scale }, 'b5',
      { seek: 0, marks: [4, 8, 16, 30], cols: 4, cw: S > 1 ? 480 : 360, title: `rorschach alone, full-screen (what the window holds), b5, scale ${S}` }));
    const marks = Array.from({ length: 17 }, (_, i) => 121.5 + i * 0.25);
    write(`window-glide${sfx}.png`, await sheet({ only: 'kandinsky', scale }, 'prelude',
      { seek: 118, marks, cols: 6, cw: 320, glide, outlines: marks.map(glideAt),
        title: `rorschach's window glides top-left → bottom-right across a boundary at 122 s (fade 3 s), over kandinsky, Prelude, scale ${S}` }));
  }
}

await browser.close();
await vite.close();
console.log(failures ? `runtime-check: ${failures} failed` : 'runtime-check: all passed');
process.exit(failures ? 1 : 0);
