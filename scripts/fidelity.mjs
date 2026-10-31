// The studio draws the lab's pixels: each case renders the same widgets at the same song time in the lab
// (lab/index.html?render=1) and in the studio's runtime (render.html?labSong=…), and compares the canvases.
//
//   npm run fidelity [-- --only casket,squares] [--quick] [--stills <dir>] [--record <file>] [--against <file>]
//
// Local only: needs lab/notes.js and lab/notes-b5.js (the user's transcriptions, not in git), system Chrome. Starts its
// own Vite server. A control page (a second lab load) measures how far the lab differs from itself; a case passes when
// the frame hashes are equal, or when the studio is no further from the lab than the control is (share of pixels off
// by more than 2 within the control's + 0.1 %, largest difference within the control's + 8), or when at most FLOOR
// pixels differ by more than 2 and none by more than FLOOR_MAX (GPU rasterisation of a handful of edge pixels is not
// repeatable: prelude murmuration at 0 +1 s was off by up to 12 on a few pixels, the lab against itself too; invisible).
// Most cases check 1, 2.5 and 4 s after start; the long cases run past a section change in the lab's SONGS.moments
// more than 4 s after the seek (lewitt starts a new wall when ctx.moment changes, but not within 4 s of a reset).
// --only keeps the cases whose widget set includes one of the ids; --quick keeps one case per widget set;
// --stills writes lab | studio | difference PNGs of the frames compared, for looking at.
// --record <file> writes every comparison's frame hashes (lab and studio side) as JSON; --against <file> fails on any
// lab-side hash that differs from the file's for the same comparison (this guards widget edits: record before, compare
// after), and on a studio-side hash that moved away from a steady lab (lab = recorded = its control, studio ≠ lab: a
// runtime change). A lab hash that moved while the lab is off its control this run is reported as unstable. The GPU
// is not perfectly repeatable between runs either (a few edge pixels): re-run a flagged case with --only before
// believing it. Comparisons missing from the file are listed, not failed.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i < 0 ? null : argv[i + 1]; };
const ONLY = opt('only')?.split(',').filter(Boolean) ?? null;
const QUICK = argv.includes('--quick');
const STILLS = opt('stills');
const RECORD = opt('record'), AGAINST = opt('against');
const recorded = AGAINST ? JSON.parse(readFileSync(path.resolve(AGAINST), 'utf8')).hashes : null;
const HZ = 60, FPS = 30, PREROLL = 3, CHECKS = [1, 2.5, 4], FLOOR = 40, FLOOR_MAX = 32;

for (const f of ['lab/notes.js', 'lab/notes-b5.js']) {
  if (!existsSync(path.join(ROOT, f))) { console.log(`fidelity: skipped (no ${f}: the lab's transcriptions are local only)`); process.exit(0); }
}

// The lab's lists, read the way the studio reads them.
const vite = await createServer({ root: ROOT, logLevel: 'error', server: { host: '127.0.0.1', port: 5190, strictPort: false, hmr: false } });
await vite.listen();
const BASE = vite.resolvedUrls.local[0].replace(/\/$/, '');
const { readLabHarness } = await vite.ssrLoadModule('/src/widgets/lab-harness.ts');
const harness = readLabHarness(readFileSync(path.join(ROOT, 'lab/index.html'), 'utf8'));

// The cases: [song, ids, start, checks?].
const cases = [];
for (const id of harness.toolIds) { cases.push(['prelude', id, 126], ['b5', id, 0]); }
for (const id of Object.keys(harness.verdicts)) {
  for (const s of [0, 86, 176]) cases.push(['prelude', id, s]);
  cases.push(['b5', id, 345]);
}
cases.push(['prelude', 'squares,casket', 126], ['b5', 'kandinsky,rorschach', 0]);
// Long cases, one per song, across a section change (prelude 124 'casket', b5 20 'agitato') 8 s after the seek
// (seek = start - PREROLL): every widget that reads ctx.moment, and the two-widget sets.
const momentReaders = harness.toolIds.filter((id) => /\.moment\b/.test(readFileSync(path.join(ROOT, 'lab/tools', `${id}.js`), 'utf8')));
for (const ids of [...momentReaders, 'squares,casket']) cases.push(['prelude', ids, 119, [4.5, 6, 8, 11]]);
for (const ids of [...momentReaders, 'kandinsky,rorschach']) cases.push(['b5', ids, 15, [4.5, 6, 8, 11]]);
// One page per side per (song, widget set, checks), its cases in ascending start on every page.
const groups = new Map();
for (const [song, ids, start, checks = CHECKS] of cases) {
  if (ONLY && !ids.split(',').some((i) => ONLY.includes(i))) continue;
  const k = `${song}|${ids}|${checks.join(',')}`;
  if (!groups.has(k)) groups.set(k, { song, ids, checks, starts: [] });
  const g = groups.get(k);
  if (!g.starts.includes(start)) g.starts.push(start);
}
for (const g of groups.values()) { g.starts.sort((a, b) => a - b); if (QUICK) g.starts = g.starts.slice(0, 1); }

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route(/localhost:5174/, (r) => r.abort());
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return page;
}
const sides = { lab: await newPage(), studio: await newPage(), control: await newPage() };
const url = (side, song, ids) => side === 'studio'
  ? `${BASE}/render.html?labSong=${song}&only=${encodeURIComponent(ids)}&hz=${HZ}`
  : `${BASE}/lab/index.html?render=1&only=${encodeURIComponent(ids)}&song=${song}&hz=${HZ}`;

// Runs in each page: steps to frame k1 (frames at start + k/FPS), then hashes the canvas #c (both pages call it #c).
function advance({ start, k0, k1, fps, preroll }) {
  if (k0 === null) { window.renderSeek(start - preroll, 1); k0 = -preroll * fps; }
  for (let k = k0 + 1; k <= k1; k++) window.renderTo(start + k / fps);
  const c = document.getElementById('c');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0x811c9dc5;
  for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
function pixels() {
  const c = document.getElementById('c');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
  return btoa(s);
}
const png = () => document.getElementById('c').toDataURL('image/png').slice(22);

// The hash of an opaque black canvas: two blank frames always match, so they prove nothing and are counted apart.
const BLANK = (() => {
  let h = 0x811c9dc5;
  for (let i = 0; i < 1280 * 720 * 4; i++) { h ^= i % 4 === 3 ? 255 : 0; h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
})();

function diff(a, b) {
  let off = 0, max = 0;
  for (let i = 0; i < a.length; i += 4) {
    const m = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]), Math.abs(a[i + 3] - b[i + 3]));
    if (m > 2) off++; if (m > max) max = m;
  }
  return { off, share: off / (a.length / 4), max };
}

const rows = [];
const t0 = Date.now();
let gi = 0;
for (const { song, ids, checks, starts } of groups.values()) {
  gi++;
  await Promise.all(Object.entries(sides).map(async ([side, page]) => {
    page.errors = [];
    await page.goto(url(side, song, ids));
    await page.waitForFunction(() => window.renderReady === true || window.renderFailed, null, { timeout: 60000 });
    const failed = await page.evaluate(() => window.renderFailed);
    if (failed) throw new Error(`${side} ${song} ${ids}: ${failed}`);
  }));
  for (const start of starts) {
    let k0 = null;
    for (const at of checks) {
      const k1 = Math.round(at * FPS);
      const h = Object.fromEntries(await Promise.all(Object.entries(sides).map(async ([side, page]) =>
        [side, await page.evaluate(advance, { start, k0, k1, fps: FPS, preroll: PREROLL })])));
      k0 = k1;
      if (at === checks[0]) {
        // The studio's own render API hashes as this test does (render-show relies on it). Every page reads back the
        // same number of times: Chrome moves a canvas read often off the GPU, which changes later pixels.
        const [own] = await Promise.all([sides.studio.evaluate(() => window.renderFrameHash()),
          sides.lab.evaluate(advance, { start, k0, k1: k0, fps: FPS, preroll: PREROLL }),
          sides.control.evaluate(advance, { start, k0, k1: k0, fps: FPS, preroll: PREROLL })]);
        if (own !== h.studio) throw new Error(`render.html renderFrameHash ${own} differs from the canvas hash ${h.studio}`);
      }
      const row = { song, ids, start, at, same: h.lab === h.studio, controlSame: h.lab === h.control, blank: h.lab === BLANK,
        key: `${song}|${ids}|${start}|${at}`, lab: h.lab, studioHash: h.studio };
      if (!row.same || !row.controlSame) {
        const px = Object.fromEntries(await Promise.all(Object.entries(sides).map(async ([side, page]) =>
          [side, Buffer.from(await page.evaluate(pixels), 'base64')])));
        row.studio = diff(px.lab, px.studio); row.control = diff(px.lab, px.control);
      }
      row.pass = row.same || (row.studio.off <= FLOOR && row.studio.max <= FLOOR_MAX)
        || (row.studio.share <= row.control.share + 0.001 && row.studio.max <= row.control.max + 8);
      if (recorded) {
        const was = recorded[row.key];
        if (!was) row.unrecorded = true;
        else {
          // A lab hash that moved where the lab also differs from its control this run is the GPU, not an edit:
          // unstable, not failed. A studio hash that moved away from a steady lab (lab = recorded = control, studio ≠
          // lab) is a runtime change, and fails; one that moved onto the lab was a GPU flake in the recording.
          const steady = h.lab === h.control;
          row.labChanged = was.lab !== h.lab && steady; row.labUnstable = was.lab !== h.lab && !steady;
          row.studioChanged = was.studio !== h.studio;
          row.studioRegressed = row.studioChanged && was.lab === h.lab && steady && h.studio !== h.lab;
          if (row.labChanged || row.studioRegressed) row.pass = false;
        }
      }
      if (STILLS) {
        mkdirSync(STILLS, { recursive: true });
        const name = `${song}-${ids.replace(/,/g, '+')}-${start}+${at}`;
        const [lab, studio] = await Promise.all([sides.lab.evaluate(png), sides.studio.evaluate(png)]);
        const fl = path.join(STILLS, `${name}.lab.png`), fs_ = path.join(STILLS, `${name}.studio.png`);
        writeFileSync(fl, Buffer.from(lab, 'base64')); writeFileSync(fs_, Buffer.from(studio, 'base64'));
        await sides.control.evaluate(png);   // every page reads back the same frames
        spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', fl, '-i', fs_, '-filter_complex',
          '[0]format=rgb24,split[a0][a1];[1]format=rgb24,split[b0][b1];[a0][b0]blend=all_mode=difference,lutrgb=r=val*8:g=val*8:b=val*8[d];[a1][b1][d]hstack=inputs=3',
          path.join(STILLS, `${name}.compare.png`)]);
      }
      rows.push(row);
    }
  }
  const errs = Object.entries(sides).flatMap(([side, p]) => p.errors.map((e) => `${side}: ${e}`));
  const labErr = await sides.lab.evaluate(() => JSON.stringify(window.renderErrors ?? {}));
  const stErr = await sides.studio.evaluate(() => JSON.stringify(window.renderErrors ?? {}));
  const last = rows.slice(-starts.length * checks.length);
  console.log(`[${gi}/${groups.size}] ${song} ${ids}: ${last.every((r) => r.pass) ? 'PASS' : 'FAIL'}`
    + ` (${last.filter((r) => r.same).length}/${last.length} identical)${errs.length ? ` page errors: ${errs.join(' | ')}` : ''}`
    + (labErr !== stErr ? ` widget errors differ: lab ${labErr} studio ${stErr}` : labErr !== '{}' ? ` widget errors (both): ${labErr}` : ''));
}
await browser.close();
await vite.close();

const pct = (x) => `${(x * 100).toFixed(3)}%`;
console.log('\nsong     widgets                         start  at    result');
for (const r of rows) {
  const res = r.same ? (r.controlSame ? 'identical' : `identical (control off ${pct(r.control.share)}, max ${r.control.max})`)
    : `studio off ${pct(r.studio.share)} (${r.studio.off} px) max ${r.studio.max} | control off ${pct(r.control.share)} max ${r.control.max}`;
  console.log(`${r.song.padEnd(8)} ${r.ids.padEnd(31)} ${String(r.start).padStart(5)}  +${String(r.at).padEnd(4)} ${r.pass ? 'PASS' : 'FAIL'} ${res}${r.blank ? ' (blank)' : ''}${r.labChanged ? ' (lab hash changed)' : ''}${r.studioRegressed ? ' (studio hash changed)' : ''}`);
}
const failed = rows.filter((r) => !r.pass);
if (RECORD) {
  const hashes = Object.fromEntries(rows.map((r) => [r.key, { lab: r.lab, studio: r.studioHash }]));
  mkdirSync(path.dirname(path.resolve(RECORD)), { recursive: true });
  writeFileSync(path.resolve(RECORD), JSON.stringify({ recorded: new Date().toISOString(), hashes }, null, 1) + '\n');
  console.log(`recorded ${rows.length} comparisons' hashes to ${RECORD}`);
}
if (recorded) {
  const labChanged = rows.filter((r) => r.labChanged), unrec = rows.filter((r) => r.unrecorded);
  const regressed = rows.filter((r) => r.studioRegressed), unstable = rows.filter((r) => r.labUnstable);
  console.log(`against ${AGAINST}: ${labChanged.length} lab-side hash${labChanged.length === 1 ? '' : 'es'} changed`
    + `, ${regressed.length} studio-side moved off a steady lab (${rows.filter((r) => r.studioChanged).length} studio-side changed in all)`
    + `, ${unstable.length} lab-side unstable (the lab off its control this run), ${unrec.length} not in the file`);
  for (const r of labChanged) console.log(`  lab hash changed: ${r.key}`);
  for (const r of regressed) console.log(`  studio hash moved off a steady lab: ${r.key}`);
  for (const r of unstable) console.log(`  lab hash unstable: ${r.key}`);
  for (const r of unrec) console.log(`  not recorded: ${r.key}`);
}
const sets = [...new Set(rows.map((r) => `${r.song} ${r.ids}`))];
const allBlank = sets.filter((k) => rows.filter((r) => `${r.song} ${r.ids}` === k).every((r) => r.blank));
console.log(`\n${rows.length - failed.length}/${rows.length} comparisons pass, ${rows.filter((r) => r.same).length} identical`
  + ` (${rows.filter((r) => r.same && !r.blank).length} of them with a picture; ${rows.filter((r) => r.blank).length} blank frames);`
  + ` ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (allBlank.length) console.log(`blank at every check, so fidelity unproven: ${allBlank.join('; ')}`);
process.exit(failed.length ? 1 : 0);
