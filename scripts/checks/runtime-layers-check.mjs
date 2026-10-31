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
//
//   npm run runtime-check [-- --look | --look-only]   --look also writes the T12 contact sheets to renders/look/T12/;
//                                                     --look-only writes them without the checks
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
const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
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
if (!LOOK_ONLY) {
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
if (!LOOK_ONLY) {
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
if (!LOOK_ONLY) {
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
if (!LOOK_ONLY) {
  const r = await run({ layers: [{ widget: 'squares', intensity: [{ t: 0, v: 0.5 }] }] }, { seek: 120, marks: [130] });
  const times = await page.evaluate(() => window.renderRuntime.rt.chords.map((c) => c.t));
  const salt = WA.fnv32('squares');
  const want = times.filter((t) => t > 120 && t <= 130 && WA.passes(t, 0.5, salt));
  const all = times.filter((t) => t > 120 && t <= 130).length;
  const got = r.log.map(([k, t]) => { if (k !== 'squares') throw new Error(`log key ${k}`); return t; });
  check(same(got, want) && want.length > 0 && want.length < all, '4. thinning at 0.5 delivers what passes predicts', `${got.length} of ${all} attacks`);
}

// 5. Two instances of one widget on two lines.
if (!LOOK_ONLY) {
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

// The look (T12 Step 5): contact sheets to renders/look/T12/.
if (LOOK) {
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

await browser.close();
await vite.close();
console.log(failures ? `runtime-check: ${failures} failed` : 'runtime-check: all passed');
process.exit(failures ? 1 : 0);
