// Piano-roll pictures of notes, for looking at transcriptions, tracks, derived lines and intensity curves:
//
//   npm run pianoroll -- <notes.json | pack.json | pack id> [--from 0] [--to 60] [--by track|class|line|all]
//                        [--curve <pivots.json>] [--title <text>] [--width 1600] --out <png>
//
// Reads YourMT3's notes ({notes: [[s, e, m, v, class], …]} from scripts/ears/ymt3.py, or the bare rows), the piano
// model's ({notes: [{start, end, midi, vel}]}), or a song pack (songs/<id>/pack.json: notes, and tracks in v2).
// Draws an SVG in a Playwright page (system Chrome, no server): time on x, MIDI on y, one colour per track, class or
// line, with a legend that counts the notes in the window. --by line colours melody / bass line / inner voices from
// lab/layers/lines.js (accents get a white outline). --curve draws a
// 0..1 intensity curve (an array of {t, v, shape?, bend?}, or {pivots}) in a lane above the roll, read through
// lab/layers/automation.js.
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: npm run pianoroll -- <notes.json | pack.json | pack id> [--from s] [--to s] [--by track|class|line|all] [--curve <pivots.json>] [--title t] [--width px] --out <png>';

function die(msg, code = 1) {
  console.error(`pianoroll: ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const o = { input: null, from: 0, to: null, by: null, curve: null, out: null, title: null, width: 1600 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      if (o.input) die(`one input only\n${USAGE}`, 2);
      o.input = a;
      continue;
    }
    const k = a.slice(2);
    if (!['from', 'to', 'by', 'curve', 'out', 'title', 'width'].includes(k)) die(`unknown option ${a}\n${USAGE}`, 2);
    if (i + 1 >= argv.length) die(`${a} needs a value`, 2);
    const v = argv[++i];
    o[k] = ['from', 'to', 'width'].includes(k) ? Number(v) : v;
    if (['from', 'to', 'width'].includes(k) && !Number.isFinite(o[k])) die(`${a}: not a number: ${v}`, 2);
  }
  if (!o.input || !o.out) die(USAGE, 2);
  if (o.by && !['track', 'class', 'line', 'all'].includes(o.by)) die(`--by ${o.by}: not track, class, line or all`, 2);
  return o;
}

/** { kind, notes: [s, e, m, v, cls?][], tracks?: {id: {label, notes}} , name } from a file or a pack id. */
function load(input) {
  let path = resolve(input);
  if (!existsSync(path)) {
    const songs = resolve(process.env.WINKELAMP_SONGS || resolve(REPO, 'songs'));
    const p = resolve(songs, input, 'pack.json');
    if (/^[a-z0-9-]+$/.test(input) && existsSync(p)) path = p;
    else die(`no file ${path} and no pack ${p}`);
  }
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const rows = Array.isArray(j) ? j : j.notes;
  if (!Array.isArray(rows)) die(`${path}: no notes`);
  const notes = rows.map((n) => (Array.isArray(n) ? n : [n.start, n.end, n.midi, n.vel]));
  const name = path.endsWith('pack.json') ? `${j.id ?? basename(dirname(path))} (pack v${j.version})` : basename(path);
  return { notes, tracks: !Array.isArray(j) && j.tracks ? j.tracks : null, name, pack: path.endsWith('pack.json') };
}

/** The shared maths of lab/layers/*.js, evaluated as the studio and Node do (plan §2): new Function('WA', src). */
function layers() {
  const dir = resolve(REPO, 'lab', 'layers');
  const WA = {};
  if (!existsSync(dir)) return WA;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
    new Function('WA', readFileSync(resolve(dir, f), 'utf8'))(WA);
  }
  return WA;
}

// Colours that stay apart on a dark ground; classes and tracks get fixed ones so pictures compare across songs, and
// anything else (Synth Pad, Organ…) takes the next spare one.
const SPARE = ['#5e60ce', '#c9ada7', '#2a9d8f', '#e5989b', '#80ed99', '#f15bb5', '#577590', '#fcbf49'];
const FIXED = {
  violin: '#4cc9f0', viola: '#06d6a0', cello: '#ffd166', contrabass: '#ff8c42', strings: '#b388ff', 'string ensemble': '#b388ff',
  horn: '#f72585', 'french horn': '#f72585', trumpet: '#d62828', trombone: '#9d0208', brass: '#ff99c8',
  flute: '#ffffff', oboe: '#9ef01a', clarinet: '#3a86ff', bassoon: '#a5673f', saxophone: '#e9ff70',
  piano: '#b0b0b0', 'acoustic piano': '#b0b0b0', timpani: '#f4a261', drums: '#f4a261', voice: '#ff99c8',
  melody: '#ffd166', bassline: '#4cc9f0', inner: '#6c7a89', all: '#a0c4ff',
};

/** Groups to draw: [{ key, label, colour, notes }], back to front, and the notes drawn grey underneath (or []). */
function groups(src, by, WA) {
  const out = [];
  let under = [];
  let spare = 0;
  const colour = (key) => FIXED[key.toLowerCase()] ?? SPARE[spare++ % SPARE.length];
  if (by === 'class') {
    if (!src.notes.some((n) => typeof n[4] === 'string')) die(`--by class: ${src.name} has no class column (YourMT3 notes have one)`);
    const m = new Map();
    for (const n of src.notes) {
      const k = n[4] ?? '?';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(n);
    }
    [...m.entries()].sort((a, b) => b[1].length - a[1].length)
      .forEach(([k, notes]) => out.push({ key: k, label: k, colour: colour(k), notes }));
  } else if (by === 'track') {
    if (!src.tracks || !Object.keys(src.tracks).length) die(`--by track: ${src.name} has no tracks (a pack v2 of an ensemble has them)`);
    under = src.notes;
    Object.entries(src.tracks).sort((a, b) => b[1].notes.length - a[1].notes.length)
      .forEach(([id, t]) => out.push({ key: id, label: t.label ?? id, colour: colour(id), notes: t.notes }));
  } else if (by === 'line') {
    if (typeof WA.lineNotes !== 'function') die('--by line: lab/layers/lines.js does not define lineNotes yet');
    const notes = src.notes.map((n) => n.slice(0, 4));
    const line = (l) => WA.lineNotes(notes, l);
    out.push({ key: 'inner', label: 'inner voices', colour: FIXED.inner, notes: line('inner') });
    out.push({ key: 'bassline', label: 'bass line', colour: FIXED.bassline, notes: line('bassline') });
    out.push({ key: 'melody', label: 'melody', colour: FIXED.melody, notes: line('melody') });
    out.push({ key: 'accents', label: 'accents (outline)', colour: '#ffffff', notes: line('accents'), outline: true });
  } else {
    out.push({ key: 'all', label: 'all notes', colour: FIXED.all, notes: src.notes });
  }
  return { out, under };
}

function curveFn(pivots, WA) {
  if (typeof WA.automationAt !== 'function') die('--curve: lab/layers/automation.js does not define automationAt yet');
  return { at: (t) => WA.automationAt(pivots, t), how: 'automation.js' };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

function svg(o, src, gs, under, curve) {
  const from = o.from;
  const allNotes = [...under, ...gs.flatMap((g) => g.notes)];
  const to = o.to ?? Math.max(from + 1, ...allNotes.map((n) => n[1]));
  const vis = (n) => n[1] > from && n[0] < to;
  const shown = allNotes.filter(vis);
  const lo = Math.max(0, (shown.length ? Math.min(...shown.map((n) => n[2])) : 48) - 2);
  const hi = Math.min(127, (shown.length ? Math.max(...shown.map((n) => n[2])) : 84) + 2);
  const W = o.width, left = 56, right = 16, top = 44, legendH = 28 + 22 * Math.ceil(gs.length / 4);
  const laneH = curve ? 90 : 0;
  const rowH = Math.max(4, Math.min(12, Math.floor(640 / (hi - lo + 1))));
  const rollTop = top + laneH + (curve ? 12 : 0);
  const rollH = rowH * (hi - lo + 1);
  const H = rollTop + rollH + 30 + legendH;
  const x = (t) => left + ((t - from) / (to - from)) * (W - left - right);
  const y = (m) => rollTop + (hi - m) * rowH;
  const parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#101418"/>`);
  const title = o.title ?? `${src.name}: ${from}–${to.toFixed(1)} s, by ${o.by}`;
  parts.push(`<text x="${left}" y="26" fill="#e8e8e8" font-size="16" font-weight="600">${esc(title)}</text>`);
  // pitch grid: a band per black key, a line and a label per C
  for (let m = lo; m <= hi; m++) {
    if ([1, 3, 6, 8, 10].includes(m % 12)) parts.push(`<rect x="${left}" y="${y(m)}" width="${W - left - right}" height="${rowH}" fill="#161c22"/>`);
    if (m % 12 === 0) {
      parts.push(`<line x1="${left}" x2="${W - right}" y1="${y(m) + rowH}" y2="${y(m) + rowH}" stroke="#2c3640"/>`);
      parts.push(`<text x="${left - 6}" y="${y(m) + rowH}" fill="#9aa6b2" font-size="11" text-anchor="end">${noteName(m)}</text>`);
    }
  }
  // time grid
  const span = to - from;
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120].find((s) => span / s <= 24) ?? 300;
  for (let t = Math.ceil(from / step) * step; t <= to + 1e-9; t += step) {
    const X = x(t).toFixed(1);
    parts.push(`<line x1="${X}" x2="${X}" y1="${curve ? top : rollTop}" y2="${rollTop + rollH}" stroke="#25303a"/>`);
    parts.push(`<text x="${X}" y="${rollTop + rollH + 16}" fill="#9aa6b2" font-size="11" text-anchor="middle">${+t.toFixed(2)} s</text>`);
  }
  const bar = (n, fill, extra = '') => {
    const x0 = x(Math.max(from, n[0])), x1 = x(Math.min(to, Math.max(n[1], n[0] + 0.03)));
    return `<rect x="${x0.toFixed(1)}" y="${(y(n[2]) + 0.5).toFixed(1)}" width="${Math.max(1.5, x1 - x0).toFixed(1)}" height="${rowH - 1}" ${fill}${extra}/>`;
  };
  for (const n of under.filter(vis)) parts.push(bar(n, 'fill="#3a4450"'));
  for (const g of gs) {
    for (const n of g.notes.filter(vis)) {
      parts.push(g.outline ? bar(n, 'fill="none" stroke="#ffffff" stroke-width="1.2"') : bar(n, `fill="${g.colour}"`, ' fill-opacity="0.9"'));
    }
  }
  if (curve) {
    const ly = (v) => top + laneH - v * laneH;
    parts.push(`<rect x="${left}" y="${top}" width="${W - left - right}" height="${laneH}" fill="#151b21" stroke="#2c3640"/>`);
    parts.push(`<text x="${left - 6}" y="${top + 10}" fill="#9aa6b2" font-size="10" text-anchor="end">1</text>`);
    parts.push(`<text x="${left - 6}" y="${top + laneH}" fill="#9aa6b2" font-size="10" text-anchor="end">0</text>`);
    const pts = [];
    for (let i = 0; i <= 800; i++) {
      const t = from + (span * i) / 800;
      pts.push(`${x(t).toFixed(1)},${ly(Math.max(0, Math.min(1, curve.at(t)))).toFixed(1)}`);
    }
    parts.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#ffd166" stroke-width="2"/>`);
    for (const p of curve.pivots.filter((p) => p.t >= from && p.t <= to)) {
      parts.push(`<circle cx="${x(p.t).toFixed(1)}" cy="${ly(p.v).toFixed(1)}" r="3.5" fill="#101418" stroke="#ffd166" stroke-width="1.5"/>`);
    }
    parts.push(`<text x="${left + 6}" y="${top + 14}" fill="#c9b27a" font-size="11">intensity: ${curve.pivots.length} pivots, ${esc(curve.how)}</text>`);
  }
  // legend: colour, label, notes in the window
  const ly0 = rollTop + rollH + 38;
  gs.forEach((g, i) => {
    const lx = left + (i % 4) * ((W - left - right) / 4), lyy = ly0 + Math.floor(i / 4) * 22;
    const n = g.notes.filter(vis).length;
    parts.push(g.outline
      ? `<rect x="${lx}" y="${lyy}" width="18" height="12" fill="none" stroke="#fff"/>`
      : `<rect x="${lx}" y="${lyy}" width="18" height="12" fill="${g.colour}"/>`);
    parts.push(`<text x="${lx + 26}" y="${lyy + 11}" fill="#e8e8e8" font-size="13">${esc(g.label)} · ${n}</text>`);
  });
  if (under.length) {
    const lyy = ly0 + Math.ceil(gs.length / 4) * 22;
    parts.push(`<rect x="${left}" y="${lyy}" width="18" height="12" fill="#3a4450"/><text x="${left + 26}" y="${lyy + 11}" fill="#9aa6b2" font-size="13">all notes · ${under.filter(vis).length}</text>`);
  }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + (under.length ? 22 : 0)}" font-family="Segoe UI, Arial, sans-serif">${parts.join('')}</svg>`, W, H: H + (under.length ? 22 : 0), shown: shown.length };
}

const o = parseArgs(process.argv.slice(2));
const src = load(o.input);
o.by ??= src.notes.some((n) => typeof n[4] === 'string') ? 'class' : src.tracks ? 'track' : 'all';
const WA = o.by === 'line' || o.curve ? layers() : {};
const { out: gs, under } = groups(src, o.by, WA);
let curve = null;
if (o.curve) {
  const j = JSON.parse(readFileSync(resolve(o.curve), 'utf8'));
  const pivots = Array.isArray(j) ? j : j.pivots;
  if (!Array.isArray(pivots)) die(`${o.curve}: not an array of pivots or {pivots}`);
  curve = { pivots, ...curveFn(pivots, WA) };
}
const pic = svg(o, src, gs, under, curve);
const outPath = resolve(o.out);
mkdirSync(dirname(outPath), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: pic.W, height: pic.H } });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#101418">${pic.svg}</body></html>`);
  await page.locator('svg').screenshot({ path: outPath });
} finally {
  await browser.close();
}
console.log(`${outPath}: ${pic.shown} notes in ${o.from}–${o.to ?? 'end'} s, by ${o.by}, ${gs.length} groups`);
