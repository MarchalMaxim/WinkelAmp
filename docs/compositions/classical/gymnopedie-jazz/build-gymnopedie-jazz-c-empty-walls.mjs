// Builds shows/gymnopedie-jazz-c-empty-walls.json: "Empty walls", LeWitt as the only widget.
//
// The idea: a gallery at night. The arrangement is a walk through its rooms, and every wall is one LeWitt instance
// listening to one strand (a pick set from picks.json, this folder). The vamp intro hangs its walls one by one in the
// dark, each lighting with the first note of its strand (keys in the middle, the bass on the left and the ticks on the
// right, as LeWitt's own lattice runs low to high; the cymbals as a frieze above). The band's entrance fills the screen
// with one wall; the tune draws on it in coloured pencil while the oom-pah and the drums stay graphite (per-note
// `colours`). Each part of the form starts a fresh wall with the next rule; the cadence blows are crayon (per-note
// `pencil` and `lines`) and the ring-outs leave the wall standing, unfinished and still. The interlude brings the small
// intro triptych back; the drum fill writes a staircase on a blank wall and the groove fills it as a step grid of
// hatched squares (the drums placed by their eighth of the bar, see section V); the solo builds
// the densest wall, with a second rule laid over the first when the harmony lifts; the closing song returns to the tune's
// arcs, and the delay tail is ruled on one small wall in the dark, where the show began.
//
// Run from the worktree root: node docs/compositions/classical/gymnopedie-jazz/build-gymnopedie-jazz-c-empty-walls.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'gymnopedie-jazz-c-empty-walls', SONG = 'gymnopedie-jazz';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const S = (id) => { if (!P[id]) throw new Error(`no set ${id}`); return P[id].notes.map((n) => n.slice(0, 4)); };
const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const win = (lo, hi) => (n) => n[0] >= lo && n[0] < hi;

// ---------- the rules (lewitt's `rule` knob) ----------
const R = { corners: 1, through: 2, arcs: 3, squares: 4, sides: 5, chain: 6, centre: 7 };

// ---------- sets ----------
/** A set: lists of [notes, values] merged, sorted, a note (start, pitch) kept once (the first list that has it wins). */
function merge(...parts) {
  const seen = new Set(), out = [];
  for (const [notes, vals] of parts) for (const n of notes) {
    const k = `${n[0].toFixed(3)}|${n[2]}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const v = typeof vals === 'function' ? vals(n) : vals;
    out.push(v && Object.keys(v).length ? [...n, Object.fromEntries(Object.keys(v).sort().map((key) => [key, r4(v[key])]))] : [...n]);
  }
  return out.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
}
const picks = {};
function pick(id, notes) {
  if (!notes.length) throw new Error(`${id}: empty`);
  picks[id] = { notes };
  return `picks:${id}`;
}

// Per-note values. The tune is coloured pencil over a graphite band; blows are crayon.
const TUNE = { colours: 1, pencil: 0.4 };
const BAND = {};                                   // the clip's own: graphite, fine pencil
const DRUM = { lines: 1 };                         // one fine graphite line per drum stroke
const BLOW = { colours: 1, pencil: 1, lines: 4 };  // the ff cadence blocks and the last hit

// The band's first bass G2 at 69.25 s is missing from the pack (ANALYSIS hole 4); the low band jumps -54 -> -25.6 dB there.
const bass = merge([[[69.25, 70.9, 43, 75]], null], [S('bass'), null]);
const drumsAll = merge([S('kick'), null], [S('snare'), null], [S('ride'), null], [S('crash'), null], [S('hats'), null]);

// ---------- regions ----------
/** A wall hung in the dark: a small copy of the whole wall (16:9 when w = h), hard-edged, its box kept solid. */
const wall = (x, y, s) => ({ mode: 'window', shape: 'rect', x, y, w: s, h: s, feather: 0, fit: 'contain', blend: 'over' });
// The intro rooms: keys in the middle, bass left, ticks right (LeWitt's lattice runs low to high); the cymbals as a frieze.
// Hung low at first, with the frieze's place left empty above them until the cymbals come in.
const MID = wall(0.5, 0.625, 0.44), LEFT = wall(0.14, 0.625, 0.25), RIGHT = wall(0.86, 0.625, 0.25);
const TOP_L = wall(0.14, 0.265, 0.22), TOP_M = wall(0.5, 0.265, 0.22), TOP_R = wall(0.86, 0.265, 0.22);

// ---------- clips ----------
const clips = [];
let n = 0;
/** knobs: lewitt's. Small walls draw a heavier pencil (default 0.15): a hair line shrunk to a fifth of the screen vanishes.
    extra.hear: the set is cut there instead of at the clip's end (a wall that stays a moment under the next one). */
function clip(start, end, track, listen, knobs, extra = {}) {
  const c = { id: `c${++n}`, start: r3(start), end: r3(end), track, fade: extra.fade ?? 0.05, widget: 'lewitt', listen, knobs };
  if (extra.region) c.region = extra.region;
  if (extra.intensity) c.intensity = extra.intensity.map(([t, v, shape]) => (shape ? { t: r3(t), v, shape } : { t: r3(t), v }));
  Object.defineProperty(c, 'hear', { value: extra.hear ?? end, enumerable: false });
  clips.push(c);
  return c;
}
/** A wall that fills the screen, from its first attack (start) to where the next wall takes over (next). Each one sits
    on a higher track than the last and fades in over XF; the old one stays whole underneath until the new one is in,
    then goes, unseen, so a change of wall never dips through black. tail: how long it stays after next (default 2 XF). */
const XF = 0.25;
let fullTrack = 0;
function fullWall(start, next, listen, knobs, extra = {}) {
  return clip(start, next + (extra.tail ?? 2 * XF), fullTrack++, listen, knobs, { fade: XF, ...extra, hear: next });
}
const SMALL = { pencil: 0.9 };
const fixed = (base) => ({ base, drive: '', depth: 0 });   // a knob held still (lines is otherwise thinned by fast playing)

// I. The gallery hangs itself in the dark (0 - 69.2). Each wall lights with the first note of its strand.
const A_END = 69.2;
// The wall turns over by itself at 42.12 s, the first chord after the brushes come in (a 1.7 s rest once it holds 60
// lines); the chords up to 54.3 s draw one line a note, so the next rest (52.5 - 54.2 s) does not wipe it again.
const thin = (x) => (x[0] >= 42 && x[0] < 54.3 ? { lines: 1 } : null);
clip(0.56, A_END, 20, pick('keys-intro', merge([S('vamp-chords').filter(win(0, 69.2)), thin], [S('chord-echoes'), thin])),
  { rule: R.corners, full: 3000, ...SMALL }, { region: MID });
clip(13.85, A_END, 21, pick('ticks-intro', S('tick-loop').filter(win(13, 69.2))),
  { rule: R.squares, full: 3000, ...SMALL }, { region: RIGHT });
clip(15.55, A_END, 22, pick('bass-intro', S('soft-bass').filter(win(15, 69.2))),
  { rule: R.arcs, lines: fixed(2), colours: 0, pencil: 1, full: 3000 }, { region: LEFT });
// The bright octave strokes stop at 61.2 s: their wall's light goes down after the last one.
clip(28.26, A_END, 23, pick('strokes-intro', S('high-strokes')),
  { rule: R.centre, lines: fixed(1), full: 3000, ...SMALL }, { region: TOP_R, intensity: [[62, 1], [65, 0.35, 'ease']] });
clip(30.93, A_END, 24, pick('ride-intro', S('ride').filter(win(30, 69.2))),
  { rule: R.through, lines: fixed(2), full: 3000, ...SMALL }, { region: TOP_M });
clip(33.42, A_END, 25, pick('brushes-intro', merge([S('hats').filter(win(33, 69.2)), null], [S('snare').filter(win(33, 69.2)), null])),
  { rule: R.arcs, lines: fixed(2), full: 3000, ...SMALL }, { region: TOP_L });

// II. The band: one wall fills the screen (69.25). Each part of the form starts a fresh wall with the next rule.
const bandSet = (lo, hi, tune) => merge(
  [tune.filter(win(lo, hi)), TUNE],
  [S('pah-chords').filter(win(lo, hi)), BAND], [bass.filter(win(lo, hi)), BAND],
  [drumsAll.filter(win(lo, hi)), DRUM]);
const FULL = { full: 3000, colours: 0 };
// (a hard cut from the gallery, 50 ms before the bass; the band arrives in a heavier charcoal)
// (critic: the first draft's sides wall held a dozen hair lines, a drop at a +4 dB arrival. The bass is now crayon, four
// lines a note, the chords three in charcoal, all held (no thinning), so the room's first full wall lands with weight.)
fullWall(69.2, 76.69, pick('band-intro', merge(
  [bass.filter(win(69, 76.7)), { pencil: 0.85, lines: 4 }],
  [S('pah-chords').filter(win(69, 76.7)), { pencil: 0.5, lines: 3 }],
  [drumsAll.filter(win(69, 76.7)), DRUM])), { rule: R.sides, ...FULL, pencil: 0.45, lines: fixed(3) }, { fade: 0 });
fullWall(76.69, 103.83, pick('theme-a-1', bandSet(76.6, 103.9, S('theme-a'))), { rule: R.arcs, ...FULL });
// Phrase 8, the last line before the cadence (124.62), gets a wall of its own: hatched squares on a pencilled grid, the
// calmest rule, before the blows. (The two ride strokes at 123.99 and 124.42 are left out: heard by the old wall, they
// would wipe it at the analysis's 123.5 s mark; the new wall begins with the phrase.)
fullWall(103.83, 124.6, pick('theme-a-2', bandSet(103.8, 123.5, S('theme-a'))), { rule: R.through, ...FULL });
fullWall(124.6, 131.53, pick('theme-a-3', bandSet(124.6, 131.6, S('theme-a'))), { rule: R.squares, ...FULL });
// The cadence: three rising steps, then the two ff blocks in crayon; the ring-out leaves the star standing, still.
fullWall(131.53, 139.75, pick('cadence-1', merge([S('cadence-blows').filter(win(130, 136)), BLOW], [S('cadence-approach').filter(win(130, 134)), TUNE])),
  { rule: R.centre, ...FULL }, { tail: 0, intensity: [[138.44, 1], [139.7, 0, 'ease']] });

// III. The interlude: the intro's triptych comes back, quieter (no ride, no echoes).
const C_END = 159.2;
// (the last chords draw one line a note: two would fill the wall past lewitt's turn-over point, 60 lines, before the last rest)
clip(139.02, C_END, 20, pick('keys-interlude', merge([S('vamp-chords').filter(win(138, 152)), null], [S('vamp-chords').filter(win(152, 159.2)), { lines: 1 }])),
  { rule: R.corners, lines: fixed(2), full: 3000, ...SMALL }, { region: MID });
clip(138.47, C_END, 21, pick('ticks-interlude', S('tick-loop').filter(win(138, 159.2))),
  { rule: R.squares, full: 3000, ...SMALL }, { region: RIGHT });
clip(138.44, C_END, 22, pick('bass-interlude', S('soft-bass').filter(win(138, 159.2))),
  { rule: R.arcs, lines: fixed(2), colours: 0, pencil: 1, full: 3000 }, { region: LEFT });

// IV. The tune returns an octave up: the screen fills again, the same rules in the same order (its picture back),
// with the tick figure and the ride beside the oom-pah.
const bandSetD = (lo, hi) => merge(
  [S('theme-b').filter(win(lo, hi)), TUNE],
  [S('pah-chords').filter(win(lo, hi)), BAND], [bass.filter(win(lo, hi)), BAND],
  [S('tick-loop').filter(win(lo, hi)), DRUM], [drumsAll.filter(win(lo, hi)), DRUM]);
// (in under the interlude's walls just before the bass at 159.23, which then go out over it)
fullWall(159.19, 173.05, pick('theme-b-1', bandSetD(159.18, 173.05)), { rule: R.arcs, ...FULL }, { fade: 0.03 });
fullWall(173.05, 193.84, pick('theme-b-2', bandSetD(173.05, 193.84)), { rule: R.through, ...FULL });
// As in the first statement, the last line into the cadence (193.86) on its own wall of hatched squares.
fullWall(193.84, 200.76, pick('theme-b-3', bandSetD(193.84, 200.75)), { rule: R.squares, ...FULL });
// It dims away under the groove room's first wall, lit by the fill's first stroke.
fullWall(200.76, 207.09, pick('cadence-2', merge([S('cadence-blows').filter(win(202, 205)), BLOW], [S('cadence-approach').filter(win(200, 202.4)), TUNE])),
  { rule: R.centre, ...FULL }, { tail: 0.3 });

// V. The groove. The drum fill's strokes switch the room's walls on, one each (bottom row left to right, then the top
// row); the soloist's wall lights with his first note. Each wall's set opens with the stroke that lights it.
// (critic, round 2: the composer's six small walls here read as six calm minimal works for 28 s, the busiest drumming of
// the piece. The reason was the input: a drum set carries GM keys, so every kick landed on one lattice point. Now the
// drums are placed by WHEN they fall, not by their key: the eighth of the 3/4 bar (downbeat k at 1.731k - 0.007 s) sets
// the column, the drum sets the row (kick at the floor, snare, toms, ride, crash at the top). The drum's "pitch" was
// never a pitch, so this is an honest reading. Under the squares rule the breakbeat becomes a step grid: each hit hatches
// its cell again, so the cells the groove insists on go dark and the off-steps stay pale. The fill writes a staircase
// (snare, snare, tom, tom, kick) on the blank wall. The walking bass and the comping chords hatch their own cells by
// pitch, graphite and colour; the soloist's first phrases join in coloured pencil from 215.21.)
const E_END = 235.4, BAR = 1.731;
const ROW = (k) => (k <= 36 ? 0 : k <= 40 ? 2 : [42, 44, 46, 51, 53, 59].includes(k) ? 8 : [49, 52, 55, 57].includes(k) ? 11 : 5);
function gridded(notes) {
  return notes.map(([s, e, k, v]) => {
    const eighth = Math.round((((s + 0.007) / BAR) % 1) * 6) % 6;
    return [s, e, 24 + ROW(k) + 12 * eighth, v];
  });
}
const grooveDrums = merge([S('drum-fill'), null], [S('kick'), null], [S('snare'), null], [S('ride'), null], [S('hats'), null],
  [S('crash'), null], [S('toms'), null]).filter(win(207, E_END));
const STEP = { lines: 1, pencil: 0.25 };
fullWall(207.07, E_END, pick('groove-grid', merge(
  [gridded(grooveDrums), STEP],
  [S('groove-bass').filter(win(207, E_END)), { colours: 0, pencil: 0.7, lines: 2 }],
  [S('groove-comp').filter(win(207, E_END)), { pencil: 0.35, lines: 1 }],
  [S('solo-line').filter(win(215, E_END)), { pencil: 0.55, lines: 1 }])),
  { rule: R.squares, ...FULL, colours: 1, lines: fixed(1) });

// The solo's wall fills the screen and piles up for 40 s: the runs chain note to note; from the lift at 252.7 s
// (Em, the climb) every note also rules lines through itself in four directions, over the chains: the densest wall.
const LIFT = 252.7;
const soloVals = (base) => (x) => ({ ...base, ...(x[0] >= LIFT ? { rule: R.through } : {}) });
fullWall(E_END, 275.18, pick('solo-wall', merge(
  [S('solo-accents').filter(win(E_END, 275.2)), soloVals({ colours: 1, pencil: 0.8 })],
  [S('solo-line').filter(win(E_END, 275.2)), soloVals({ colours: 1, pencil: 0.3 })],
  [S('groove-comp').filter(win(E_END, 275.2)), soloVals({})],
  [S('groove-bass').filter(win(E_END, 275.2)), soloVals({})])),
  { rule: R.chain, lines: fixed(4), ...FULL }, { fade: 0 });

// The closing song: the tune's arcs again, the lead falling in colour; the three closing hits in crayon.
fullWall(275.18, 287.55, pick('closing', merge(
  [S('closing-hits'), BLOW], [S('lead-descent'), { colours: 1, pencil: 0.5 }], [S('groove-bass').filter(win(275, 286)), BAND])),
  { rule: R.arcs, ...FULL }, { tail: 0.6 });
// The delay tail on one small wall in the dark, where the show began; it stops mid-rule with the sound.
clip(287.55, 292.1, 20, pick('echo-tail', S('echo-tail')),
  { rule: R.corners, full: 3000, ...SMALL }, { region: MID, intensity: [[291.4, 1], [292.0, 0, 'ease']] });

// Every set is heard by one clip: keep only the notes inside it (not in its last 50 ms, where a live step can miss them).
for (const c of clips) { const id = c.listen.slice(6); picks[id].notes = picks[id].notes.filter((x) => x[0] >= c.start && x[0] < Math.min(c.hear, c.end - 0.05)); }

// ---------- a rough stroke count per clip: where lewitt would turn a wall over by itself ----------
// (a rest over 1.6 s once a wall holds 60 lines, or a structure mark at 70 / 123.5 / 133.5 / 202.5 / 289.5 s, at least
// 4 s after the wall began). Lines per note as lewitt draws them at the clip's `lines` (an upper bound: fast playing thins it).
const MARKS = [70, 123.5, 133.5, 202.5, 289.5];
const perNote = { 1: (k) => k, 2: (k) => k, 3: (k) => k, 4: (k) => 0.25 * (5 + 4 * k), 5: (k) => k, 6: (k) => k + 1, 7: (k) => k };
for (const c of clips) {
  const set = picks[c.listen.slice(6)].notes.filter((x) => x[0] >= c.start && x[0] < c.end);
  const kn = c.knobs, k0 = typeof kn.lines === 'object' ? kn.lines.base : kn.lines ?? 3;
  let strokes = 0, last = -1, switchT = c.start, moment = MARKS.filter((m) => m <= c.start).length;
  const turns = [];
  for (let i = 0; i < set.length;) {
    let j = i; while (j < set.length && set[j][0] - set[i][0] < 0.04) j++;
    const t = set[i][0], m = MARKS.filter((x) => x <= t).length;
    const rest = last >= 0 && t - last > 1.6 && strokes > 60;
    if ((m !== moment || rest) && t - switchT > 4) { turns.push(`${t.toFixed(2)}${rest ? ' rest' : ' mark'}`); strokes = 0; switchT = t; }
    moment = m; last = t;
    for (let q = i; q < j; q++) {
      const v = set[q][4] ?? {}, rule = v.rule ?? kn.rule, k = v.lines ?? k0;
      strokes += perNote[rule](k);
    }
    i = j;
  }
  console.log(`${c.id} ${c.start}-${c.end} t${c.track} ${c.listen} rule ${kn.rule}: ${set.length} notes, ~${Math.round(strokes)} lines${turns.length ? `, turns over at ${turns.join(', ')}` : ''}`);
}

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Satie: Gymnopédie No. 1 (jazz mix) · Empty walls: LeWitt alone, one wall per strand, a room per part',
  composer: { by: 'claude', at: new Date().toISOString() },
  clips, picks,
};
writeFileSync(join(ROOT, `shows/${ID}.json`), JSON.stringify(show, null, 1) + '\n');
console.log(`wrote shows/${ID}.json: ${clips.length} clips, ${Object.keys(picks).length} pick sets`);
