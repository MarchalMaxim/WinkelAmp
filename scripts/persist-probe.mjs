// Which persistence class is each widget (plan §2 and T12, spec Decisions 4)? On the shared fading canvas a paste
// weight is not an opacity: a widget that redraws its picture every frame settles near m·P / (0.12 + 0.88·m), so a
// weight of 0.25 still shows most of it ('redraw'); one that leaves strokes on the canvas shows each new stroke at the
// weight ('strokes').
//
//   npm run persist-probe [-- --only casket,squares] [--dry]
//
// Each widget alone is drawn through render.html?labSong=…&probe=<id>:<weight>, at prelude 120 and b5 0, for 5 s
// (60 Hz steps, seeded as the lab's render mode), at slot weight 0.25 and at 1; its mean brightness is summed over a
// frame every 0.5 s. r = (sum at 0.25) ÷ (sum at 1), both songs together: r ≥ 0.5 → redraw, else strokes. A widget
// that stays dark at 1 keeps the default (redraw). It writes the PERSIST block of lab/layers/persist.js (between the
// persist:start and persist:end markers; --dry only prints) and prints the table. Local only: needs the lab's notes
// files and system Chrome; starts its own Vite server from port 5190.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i < 0 ? null : argv[i + 1]; };
const ONLY = opt('only')?.split(',').filter(Boolean) ?? null;
const DRY = argv.includes('--dry');
const HZ = 60, SECONDS = 5, EVERY = 0.5, LOW = 0.25, CUT = 0.5, DARK = 0.05, PAGES = 3;
const SONGS = [['prelude', 120], ['b5', 0]];
const FILE = path.join(ROOT, 'lab/layers/persist.js');

for (const f of ['lab/notes.js', 'lab/notes-b5.js']) {
  if (!existsSync(path.join(ROOT, f))) { console.log(`persist-probe: skipped (no ${f}: the lab's transcriptions are local only)`); process.exit(0); }
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
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route(/localhost:517\d/, (r) => r.abort());
  return page;
}

/** In the page: seek, step 5 s, the mean RGB brightness (0..255) of a frame every 0.5 s, summed. */
function measure({ at, seconds, every, hz }) {
  const c = document.getElementById('c'), g = c.getContext('2d');
  window.renderSeek(at, 1);
  let sum = 0;
  for (let k = 1; k * every <= seconds + 1e-9; k++) {
    window.renderTo(at + k * every);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
    sum += s / (3 * c.width * c.height);
  }
  void hz;
  return { sum, errors: window.renderErrors };
}

async function brightness(page, song, at, id, weight) {
  await page.goto(`${BASE}/render.html?labSong=${song}&probe=${encodeURIComponent(id)}:${weight}&hz=${HZ}`);
  await page.waitForFunction(() => window.renderReady === true || window.renderFailed, null, { timeout: 60000 });
  const failed = await page.evaluate(() => window.renderFailed);
  if (failed) throw new Error(`${song} ${id} ${weight}: ${failed}`);
  const r = await page.evaluate(measure, { at, seconds: SECONDS, every: EVERY, hz: HZ });
  return { sum: r.sum, error: r.errors?.[id] ?? null };
}

const rows = new Map(ids.map((id) => [id, { id, low: 0, full: 0, per: [], errors: [] }]));
const jobs = [];
for (const id of ids) for (const [song, at] of SONGS) jobs.push({ id, song, at });
const pages = await Promise.all(Array.from({ length: PAGES }, newPage));
let next = 0, done = 0;
await Promise.all(pages.map(async (page) => {
  while (next < jobs.length) {
    const j = jobs[next++];
    const lo = await brightness(page, j.song, j.at, j.id, LOW), hi = await brightness(page, j.song, j.at, j.id, 1);
    const row = rows.get(j.id);
    row.low += lo.sum; row.full += hi.sum;
    row.per.push(`${j.song} ${hi.sum > 0 ? (lo.sum / hi.sum).toFixed(2) : '-'}`);
    for (const e of [lo.error, hi.error]) if (e && !row.errors.includes(e)) row.errors.push(e);
    done++;
    process.stdout.write(`\r${done}/${jobs.length}`);
  }
}));
process.stdout.write('\n');
await browser.close();
await vite.close();

const table = ids.map((id) => {
  const row = rows.get(id), dark = row.full / SONGS.length / (SECONDS / EVERY) < DARK;
  const r = row.full > 0 ? row.low / row.full : NaN;
  return { ...row, r, dark, cls: dark || !(r < CUT) ? 'redraw' : 'strokes' };
});
console.log('widget            r      class    per song          mean at 1');
for (const x of table) {
  console.log(`${x.id.padEnd(17)} ${Number.isFinite(x.r) ? x.r.toFixed(3) : '  -  '}  ${x.cls.padEnd(8)} ${x.per.join(', ').padEnd(17)} ${(x.full / SONGS.length / (SECONDS / EVERY)).toFixed(2)}${x.dark ? ' (dark: default)' : ''}${x.errors.length ? `  ERROR ${x.errors.join('; ')}` : ''}`);
}

if (table.every((x) => x.dark)) { console.error('persist-probe: every widget is dark at weight 1: nothing drew'); process.exit(1); }
if (!DRY && !ONLY) {
  const src = readFileSync(FILE, 'utf8');
  const a = src.indexOf('// persist:start'), b = src.indexOf('// persist:end');
  if (a < 0 || b < a) throw new Error('lab/layers/persist.js: no persist:start … persist:end markers');
  const indent = src.slice(src.lastIndexOf('\n', a) + 1, a);
  const lines = table.map((x) => `${indent}  ${JSON.stringify(x.id)}: '${x.cls}',`.padEnd(indent.length + 34)
    + `// r ${Number.isFinite(x.r) ? x.r.toFixed(2) : '-'}${x.dark ? ', dark at 1' : ''}`);
  const block = `// persist:start\n${indent}WA.PERSIST = {\n`
    + `${indent}  // npm run persist-probe: r = brightness at slot weight 0.25 ÷ at 1 (prelude 120, b5 0, 5 s); r ≥ ${CUT} → redraw\n`
    + `${lines.join('\n')}\n${indent}};\n${indent}`;
  writeFileSync(FILE, src.slice(0, a) + block + src.slice(b));
  console.log(`wrote ${table.length} classes to lab/layers/persist.js`);
} else console.log(DRY ? '--dry: lab/layers/persist.js unchanged' : '--only: lab/layers/persist.js unchanged (the block lists every widget)');
