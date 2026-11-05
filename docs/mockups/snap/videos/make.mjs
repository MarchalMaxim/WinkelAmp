// Renders the comparison videos V1..V10 of docs/mockups/snap/DESIGN.md section 6, one after another, with the brightness trace.
//
//   node docs/mockups/snap/videos/make.mjs            all of them
//   node docs/mockups/snap/videos/make.mjs V4 V9      only these
//
// Needs the dev server (default http://localhost:5300; override with SNAP_BASE) and Chrome and ffmpeg. Outputs land in
// renders/snap/<Vn>-<name>.mp4 with <Vn>-<name>-sheet.png next to them (not committed). A video whose show copy is
// missing in shows/ is skipped and said so. Each call is `scripts/snap-compare.mjs ... --trace` (60 Hz steps, 30 fps, sound).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.SNAP_BASE || 'http://localhost:5300';
const R = (id) => `render.html?show=${id}&hz=60&scale=1`;                         // a studio show
const L = (song, w) => `lab/index.html?render=1&song=${song}&only=${w}`;          // the lab, one widget, all notes
const RACH = 'rach-concerto-2', LIE = 'liebesleid';

// [id, name, song, from, to, left, right, labels, shows the two sides need]
const VIDEOS = [
  ['V1', 'bells-squares', RACH, 5, 37, L(RACH, 'squares'), L(RACH, 'squares-snap'), 'squares today|squares snap', []],
  ['V2a', 'arrival-original-vs-snap', RACH, 41, 50, R(RACH), R(`${RACH}-snap`), 'your show|snap', [RACH, `${RACH}-snap`]],
  ['V2b', 'arrival-knobs-vs-snap', RACH, 41, 50, R(`${RACH}-knobs`), R(`${RACH}-snap`), 'knobs only|snap', [`${RACH}-knobs`, `${RACH}-snap`]],
  ['V3', 'squares-p9', RACH, 79, 84, R(RACH), R(`${RACH}-snap`), 'today|snap', [RACH, `${RACH}-snap`]],
  ['V4', 'ivory-p14', RACH, 115, 125, R(RACH), R(`${RACH}-snap`), 'today|ivory strike 1', [RACH, `${RACH}-snap`]],
  ['V5', 'the-run-hammer', RACH, 126, 135, R(RACH), R(`${RACH}-new`), 'today|hammer', [RACH, `${RACH}-new`]],
  ['V6', 'sighs-ivory-vs-new', LIE, 10.7, 28.5, R(LIE), R(`${LIE}-new`), 'ivory|hammer and handover', [LIE, `${LIE}-new`]],
  ['V7', 'sighs-knobs-vs-snap', LIE, 10.7, 28.5, R(`${LIE}-knobs`), R(`${LIE}-snap`), 'knobs only|ivory strike 1', [`${LIE}-knobs`, `${LIE}-snap`]],
  ['V8', 'flee-accents', LIE, 30, 45, R(LIE), R(`${LIE}-snap`), 'bow|hammer', [LIE, `${LIE}-snap`]],
  ['V9', 'rolls-p5-p8', LIE, 174.9, 186.2, R(LIE), R(`${LIE}-new`), 'today|hammer, roll 1', [LIE, `${LIE}-new`]],
  ['V10', 'glass-p12-p15', LIE, 230, 242, R(LIE), R(`${LIE}-new`), 'today|blade', [LIE, `${LIE}-new`]],
];

const only = process.argv.slice(2).map((s) => s.toUpperCase());
const done = [], skipped = [], failed = [];
for (const [id, name, song, from, to, left, right, labels, shows] of VIDEOS) {
  if (only.length && !only.some((o) => id === o || id.replace(/[ab]$/, '') === o)) continue;
  const missing = shows.filter((s) => !existsSync(path.join('shows', `${s}.json`)));
  if (missing.length) { skipped.push(`${id}: no shows/${missing.join(', shows/')}.json`); console.log(`skip ${id}: missing ${missing.join(', ')}`); continue; }
  const out = path.join('renders', 'snap', `${id}-${name}.mp4`);
  console.log(`\n== ${id} ${name} (${from}-${to} s)`);
  const r = spawnSync(process.execPath, ['scripts/snap-compare.mjs', '--song', song, '--from', String(from), '--to', String(to),
    '--left', left, '--right', right, '--labels', labels, '--out', out, '--fps', '30', '--width', '640', '--base', BASE, '--trace'], { stdio: 'inherit' });
  (r.status === 0 ? done : failed).push(r.status === 0 ? out : `${id}: exit ${r.status}`);
}
console.log(`\nwritten: ${done.length}\n  ${done.join('\n  ')}`);
if (skipped.length) console.log(`skipped:\n  ${skipped.join('\n  ')}`);
if (failed.length) { console.log(`failed:\n  ${failed.join('\n  ')}`); process.exit(1); }
