// Builds shows/rach-concerto-2-full.json from picks.json + extra-picks.json (this folder) and the clip plan below
// (PLAN.md has the motif table). Validates exactly as scripts/studio-api.ts does: the pack's duration and tracks, the
// Node widget catalogue. Run: node_modules/.bin/tsx docs/compositions/rach-concerto-2/build-show.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow, type Clip, type Show } from '../../../src/studio/show/show';
import { withValues, type NoteValues, type PickNote } from '../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
type Set = { id: string; notes: PickNote[] };
const read = (f: string): Set[] => JSON.parse(readFileSync(join(HERE, f), 'utf8')).sets;
const sets = new Map<string, PickNote[]>();
for (const s of [...read('picks.json'), ...read('extra-picks.json')]) sets.set(s.id, s.notes.map((n) => [...n] as PickNote));
const S = (id: string): PickNote[] => { const n = sets.get(id); if (!n) throw new Error(`no set ${id}`); return n; };

// ---------- note edits (PLAN.md §3) ----------
sets.set('c1-bells', S('c1-bells').filter((n) => n[0] > 41));                       // 40.53 C1 is in bells too
sets.set('t1-dev-frag', S('t1-dev-frag').filter((n) => n[2] < 80));                 // the three isolated C6
for (const [head, tail] of [['t2-head-b', 't2-tail-b'], ['t2-head-b2', 't2-tail-b2'], ['t2-head-b3', 't2-tail-b3']]) {
  const h = S(head);                                                                 // 5 up to the top note, 5 back, 3 to the tail
  sets.set(head, h.slice(0, 10));
  sets.set(tail, [...h.slice(10), ...S(tail)]);
}

// ---------- per-note values ----------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Piecewise-linear curve through [t, value] points, held flat outside them. */
const curve = (pts: [number, number][]) => (t: number) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) {
    const [t0, a] = pts[i - 1], [t1, b] = pts[i];
    return a + (b - a) * (t - t0) / (t1 - t0);
  }
  return pts[pts.length - 1][1];
};
/** Set values on each note: fn gets the note and its index, returns the note's values (intensity and/or knobs). */
function values(id: string, fn: (n: PickNote, i: number, all: PickNote[]) => NoteValues) {
  const ns = S(id);
  sets.set(id, ns.map((n, i) => {
    const v = fn(n, i, ns);
    if (v.intensity !== undefined) v.intensity = clamp(Math.round(v.intensity * 100) / 100, 0, 2);
    return withValues([n[0], n[1], n[2], n[3]], v);
  }));
}
/** Intensity that makes the note heard at this velocity (heard = vel × intensity). */
const toHeard = (n: PickNote, target: number) => target / n[3];

// The bells: the two pp chords at 5.2 and 10.4 lifted so the first bell lands.
values('bells', (n) => ({ intensity: n[0] < 11 ? 1.5 : 1 }));
values('c1-bells', (n) => ({ intensity: toHeard(n, 92) }));
values('deep-strokes', (n) => ({ intensity: n[0] > 616 ? 2 : n[0] > 407 && n[0] < 408 ? 1.4 : 1.15 }));
values('final-bass', () => ({ intensity: 1.2 }));
values('march-bass', (n) => ({ intensity: toHeard(n, 88) }));
values('descent-bass', (n) => ({ intensity: toHeard(n, curve([[494, 70], [510, 58], [521.3, 42]])(n[0])) }));

// Theme 1: heard velocity on a phrase curve; the rise and fall also grow and shrink the slab (per-note size).
values('t1-head-a', (n) => ({ intensity: toHeard(n, curve([[46, 52], [50.4, 80], [52, 74], [54.8, 58]])(n[0])) }));
values('t1-answer-a', (n) => ({ intensity: toHeard(n, curve([[56.3, 58], [61.7, 84], [65.3, 55]])(n[0])) }));
values('t1-rise-a2', (n) => ({ intensity: toHeard(n, curve([[76, 62], [91.2, 112]])(n[0])), size: curve([[76, 0.6], [91.2, 0.85]])(n[0]) }));
values('t1-fall-a2', (n) => ({ intensity: toHeard(n, curve([[92, 106], [111, 56]])(n[0])), size: curve([[92, 0.82], [111, 0.55]])(n[0]) }));
values('t1-dev-frag', (n) => ({ intensity: toHeard(n, curve([[322, 42], [331, 56], [341.5, 46]])(n[0])) }));
values('t1-head-a3', (n) => ({ intensity: toHeard(n, curve([[424.5, 112], [429, 127], [433.6, 108]])(n[0])) }));
values('t1-answer-a3', (n) => ({ intensity: toHeard(n, curve([[435, 110], [440.8, 127], [444.8, 104]])(n[0])) }));
values('t1-rise-a3', (n) => ({ intensity: toHeard(n, curve([[448, 82], [475, 122]])(n[0])), size: curve([[448, 0.62], [475, 0.9]])(n[0]) }));

// Theme 2 (Ivory: intensity = key size, height, how hard it snaps; on the stomp, the crater's depth).
const arch = (top: number, lo: number, hi: number) => (_n: PickNote, i: number, all: PickNote[]) =>
  ({ intensity: i <= top ? lo + (hi - lo) * i / top : hi - (hi - lo) * (i - top) / Math.max(1, all.length - 1 - top) });
values('t2-head-b', arch(4, 0.9, 1.2));
values('t2-tail-b', (n) => ({ intensity: curve([[157.6, 0.85], [170.6, 1.05], [179, 0.85]])(n[0]) }));
values('t2-head-b2', arch(4, 1.05, 1.4));
values('t2-tail-b2', (n) => ({ intensity: curve([[185, 0.95], [198.3, 1.15]])(n[0]) }));
values('t2-strings-b2', (n) => ({ intensity: curve([[200.5, 0.8], [211.5, 1.1], [221.7, 1.35]])(n[0]) }));
values('t2-climax-line', (n) => ({ intensity: n[0] > 231.7 && n[0] < 231.75 ? 2 : curve([[222.8, 1.1], [231.2, 1.6], [243.1, 1.15]])(n[0]) }));
values('t2-head-b3', arch(4, 0.8, 0.95));
values('t2-tail-b3', (n) => ({ intensity: curve([[533.5, 0.8], [547.6, 0.85], [552.1, 0.95]])(n[0]) }));
values('t2-echo-b4', (n) => ({ intensity: curve([[556, 0.7], [565, 1.15], [573.9, 0.85]])(n[0]) }));

// Points of light.
values('filigree-high', (n) => ({ intensity: n[2] === 103 ? 1.6 : 1 }));
values('meno-high', (n) => ({ intensity: curve([[575, 0.85], [606, 1.05], [612.9, 0.8]])(n[0]) }));

// The chord blocks: the climax's loudest stretch (398-405 s) hits hardest.
values('climax-chords', (n) => ({ intensity: n[0] >= 398 && n[0] <= 405 ? 1.5 : 1.1 }));
values('final-chords', () => ({ intensity: 1.2 }));

// The piano's drive: each run of accents crescendos.
values('trans-accents', (n) => ({ intensity: curve([[116, 0.85], [134.8, 1.3]])(n[0]) }));
values('agitato-accents', (n) => ({ intensity: curve([[349, 0.9], [387.4, 1.4]])(n[0]) }));
values('coda-drive', (n) => ({ intensity: curve([[657, 0.8], [679.8, 1.15]])(n[0]) }));
values('coda-build', (n) => ({ intensity: curve([[683, 1.05], [692.2, 1.5]])(n[0]) }));

// ---------- clips ----------
// Draw order, bottom to top. Tracks are assigned from these layers, then numbered compactly.
const LAYER: Record<string, number> = { fields: 0, 'squares-snap': 1, current: 2, gliss: 2, flee: 2, 'fireworks-snap': 3, handover: 4, ivory: 4, hammer: 5 };
/** How long after its last note a widget still shows something (s), given its knobs. */
const TAIL: Record<string, (k: Record<string, number>) => number> = {
  'squares-snap': (k) => (k.life ?? 0.6) + 0.8,
  handover: (k) => (k.goneBy ?? 1.2) + 0.1,
  ivory: () => 2 + 1.5 + 0.4,
  hammer: (k) => [0.35, 0.6, 2.5, 4][k.touch ?? 2] * (k.ring ?? 1) + 0.3,
  'fireworks-snap': (k) => 2.2 + 4 * (k.linger ?? 0.45),
  flee: () => 2.2,
  gliss: (k) => 1.5 + 2 * (k.linger ?? 0.6),
  current: () => 2,
};
type Plan = { widget: string; set: string; knobs: Record<string, number | { base: number; drive: string }>; from?: number; to?: number; start?: number; end?: number; fade?: number };
const plans: Plan[] = [];
const P = (widget: string, set: string, knobs: Plan['knobs'], o: Partial<Plan> = {}) => plans.push({ widget, set, knobs, ...o });

// The bells (squares-snap): big and slow only for the frame.
const BELL = { size: 1.4, life: 2.4, blur: 1.2, shake: 0.8 };
P('squares-snap', 'bells', BELL);
P('squares-snap', 'c1-bells', { size: 0.9, life: 1.0, blur: 1.5, shake: 0.3 });
const DEEP = { size: 1.2, life: 2.6, blur: 1.2, shake: 1.5 };
for (const [a, b] of [[79, 81], [134, 135], [407, 408], [475, 476], [616, 617]]) P('squares-snap', 'deep-strokes', a === 407 ? { ...DEEP, shake: 2, life: 3 } : DEEP, { from: a, to: b });
P('squares-snap', 'march-bass', { size: 0.7, life: 0.4, blur: 0.5, shake: 0.4 });
P('squares-snap', 'descent-bass', { size: 0.8, life: 1.6, blur: 2.2, shake: 0 });
P('squares-snap', 'final-bass', { size: 1.4, life: 3, blur: 1.2, shake: 2 }, { end: 706 });

// Theme 1 (handover): the head hands over to the answer exactly on the answer's first note.
const T1 = { goneBy: 1.6, ring: 1.3 };
P('handover', 't1-head-a', { ...T1, size: 0.6 });
P('handover', 't1-answer-a', { ...T1, size: 0.6 });
P('handover', 't1-rise-a2', { ...T1, size: 0.6 });
P('handover', 't1-fall-a2', { ...T1, size: 0.8 });
P('handover', 't1-dev-frag', { goneBy: 1.2, ring: 0.8, size: 0.45 });
P('handover', 't1-head-a3', { ...T1, ring: 1.5, size: 0.8 });
P('handover', 't1-answer-a3', { ...T1, ring: 1.5, size: 0.8 });
P('handover', 't1-rise-a3', { ...T1, size: 0.62 });

// Theme 2 (ivory).
P('ivory', 't2-head-b', { strike: 1, crater: 0.35, ripple: 2.6, cracks: 1.5, presence: 0.9 });
P('ivory', 't2-tail-b', { strike: 0.6, crater: 0.25, ripple: 2, cracks: 1, presence: 0.75 }, { end: 179.22, fade: 0.5 });
P('ivory', 't2-head-b2', { strike: 1, crater: 0.6, ripple: 4, cracks: 1.5, presence: 1 });
P('ivory', 't2-tail-b2', { strike: 0.7, crater: 0.3, ripple: 2.5, cracks: 1.2, presence: 0.85 }, { end: 200.45, fade: 0.5 });
P('ivory', 't2-strings-b2', { strike: 0.3, crater: 0.5, ripple: 4, cracks: 1.5, presence: 0.9 });
P('ivory', 't2-climax-line', { strike: 1, crater: 0.9, ripple: 7, cracks: 2.5, presence: 1 });
P('ivory', 't2-head-b3', { strike: 0, crater: 0.15, ripple: 1.2, cracks: 0.5, floor: 1, presence: 0.85 });
P('ivory', 't2-tail-b3', { strike: 0, crater: 0.12, ripple: 1, cracks: 0.5, floor: 1, presence: 0.75 });
P('ivory', 't2-echo-b4', { strike: 0.4, crater: 0.3, ripple: 2.5, cracks: 1, presence: 0.65 });

// Points of light (hammer).
P('hammer', 'filigree-high', { touch: 3, ring: 1.5, size: 1.5 });
P('hammer', 'climax-trill', { touch: 1, ring: 0.6, size: 1.5 });
P('hammer', 'meno-high', { touch: 3, ring: 2, size: 1.3 }, { end: 618.6 });
P('hammer', 'coda-high', { touch: 2, ring: 1.3, size: 1.4 });

// The ff chord blocks (fireworks-snap): gold, rose, red, small red, gold.
P('fireworks-snap', 'tutti-chords', { hue: 0.1, range: 0.15, size: 1.2, swirl: 0.55, linger: 0.4 });
P('fireworks-snap', 't2-climax-chords', { hue: 0.93, range: 0.15, size: 1.3, swirl: 0.55, linger: 0.4 });
P('fireworks-snap', 'climax-chords', { hue: 0.02, range: 0.25, size: 1.8, swirl: 0.8, linger: 0.55 }, { end: 423.4 });
P('fireworks-snap', 'march-chords', { hue: 0.02, range: 0.1, size: 0.7, swirl: 0.3, linger: 0.15 });
P('fireworks-snap', 'final-chords', { hue: 0.1, range: 0.2, size: 2.2, swirl: 0.8, linger: 0.8 }, { start: 694.25, end: 706 });

// The piano's drive (flee, snap 1: each accent bolts on its own note and is gone in two seconds).
P('flee', 'trans-accents', { snap: 1, pal: 0, mix: 0.6, streak: 1, presence: 0.85 });
P('flee', 'd1-accents', { snap: 1, pal: 1, mix: 0.6, streak: 1, presence: 0.8 });
P('flee', 'agitato-accents', { snap: 1, pal: 0, mix: 0.7, streak: 1.4, twitch: 0.5, presence: 1 });
P('flee', 'coda-drive', { snap: 1, pal: 0, mix: 0.6, streak: 1, presence: 0.6 }, { end: 680.3 });
P('flee', 'coda-build', { snap: 1, pal: 0, mix: 0.7, streak: 1.4, twitch: 0.5, presence: 1 }, { start: 680.3, end: 694.2 });

// The runs (gliss) and the lone wind voice (current).
P('gliss', 'run-a2', { hue: 30, number: 18, push: 1.2, size: 1, linger: 0.6 });
P('gliss', 'run-a3', { hue: 30, number: 18, push: 1.2, size: 1, linger: 0.6 });
P('gliss', 'coda-sweep', { hue: 45, number: 24, push: 1.4, size: 1.1, linger: 1 });
P('gliss', 'coda-run', { hue: 25, number: 22, push: 1.4, size: 1, linger: 0.8 });
P('gliss', 'final-run', { hue: 35, number: 24, push: 1.5, size: 1.1, linger: 0.7 }, { end: 697 });
P('current', 'bridge-winds', { threads: 1, width: 1, flow: 0.6, hue: 210, presence: 0.5 });
P('current', 'codetta-clarinet', { threads: 1, width: 1, flow: 0.6, hue: 210, presence: 0.55 });

const clips: Clip[] = [];
const PRE = 0.5, FADE = 0.3;
for (const p of plans) {
  const ns = S(p.set).filter((n) => (p.from === undefined || n[0] >= p.from) && (p.to === undefined || n[0] < p.to));
  if (!ns.length) throw new Error(`${p.set}: no notes in ${p.from}..${p.to}`);
  const first = ns[0][0], last = ns[ns.length - 1][0], knobsNum = Object.fromEntries(Object.entries(p.knobs).map(([k, v]) => [k, typeof v === 'number' ? v : v.base]));
  const start = p.start ?? Math.max(0, first - PRE), end = p.end ?? last + TAIL[p.widget](knobsNum), fade = p.fade ?? FADE;
  if (first < start + fade) throw new Error(`${p.set}: first note ${first} inside the fade-in (${start}+${fade})`);
  if (last + 0.06 > end) throw new Error(`${p.set}: last note ${last} too close to the end ${end}`);
  clips.push({ id: '', start, end, track: 0, fade, widget: p.widget, listen: `picks:${p.set}`, knobs: p.knobs as Clip['knobs'] });
}

// Theme 1's statements hand over to each other: a clip ends on the next one's first note, as its own slabs do.
const hand = clips.filter((c) => c.widget === 'handover').sort((a, b) => a.start - b.start);
for (let i = 0; i + 1 < hand.length; i++) {
  const next = S(hand[i + 1].listen!.slice(6))[0][0];
  if (hand[i].end > next) hand[i].end = next - 0.02;
}

// The ground: fields, only where the music is full; its curve follows the music and drops out for the quiet sections.
const FIELDS = { back: 1.1, dyn: 0.6, chords: { base: 0.7, drive: '+density' as const } };
const ground = (start: number, end: number, home: number, pts: [number, number][]) =>
  clips.push({ id: '', start, end, track: 0, fade: 1, widget: 'fields', knobs: { ...FIELDS, home }, intensity: pts.map(([t, v]) => ({ t, v: Math.round(v * 0.65 * 100) / 100 })) });
ground(19.5, 151, -0.2, [[19.5, 0], [28, 0.25], [36.3, 0.6], [40.3, 1], [53, 0.9], [62, 0.6], [74, 0.55], [80, 0.9], [88, 1], [95, 0.85], [108, 0.55], [118, 0.6], [130, 0.75], [136, 0.95], [141, 0.7], [144.5, 0.15], [150, 0]]);
ground(196, 284, 0.3, [[196, 0], [205, 0.3], [214, 0.55], [222, 0.8], [231, 1], [244, 1], [252, 0.85], [258, 0.45], [268, 0.35], [276, 0.15], [283, 0]]);
ground(296, 522, -0.4, [[296, 0], [301, 0.6], [316, 0.65], [321.5, 0.45], [324, 0.25], [340, 0.25], [346, 0.5], [370, 0.75], [388, 1], [421, 1], [446, 0.8], [476, 0.75], [482, 0.6], [495, 0.4], [510, 0.15], [521, 0]]);
ground(550, 578, 0.2, [[550, 0], [558, 0.3], [565, 0.5], [571, 0.25], [577, 0]]);
ground(614, 706, -0.2, [[614, 0], [618, 0.2], [630, 0.4], [646, 0.8], [650, 0.6], [656, 0.5], [670, 0.6], [685, 0.85], [694.8, 1], [698, 0.9], [703, 0.3], [706, 0]]);

// Tracks: by layer, each clip on the lowest free track of its layer's band, then numbered compactly in draw order.
const BAND = 4, byTrack = new Map<number, Clip[]>();
const overl = (a: Clip, b: Clip) => a.start < b.end - 5e-4 && b.start < a.end - 5e-4;
for (const c of [...clips].sort((a, b) => a.start - b.start)) {
  let t = LAYER[c.widget] * BAND;
  while ((byTrack.get(t) ?? []).some((o) => overl(o, c))) t++;
  if (Math.floor(t / BAND) !== LAYER[c.widget]) throw new Error(`layer band overflow at ${c.widget} ${c.start}`);
  c.track = t; byTrack.set(t, [...(byTrack.get(t) ?? []), c]);
}
const used = [...byTrack.keys()].sort((a, b) => a - b);
for (const c of clips) c.track = used.indexOf(c.track);
clips.sort((a, b) => a.start - b.start || a.track - b.track);
clips.forEach((c, i) => { c.id = `c${i + 1}`; });

const picks: Show['picks'] = {};
for (const id of new Set(plans.map((p) => p.set))) picks[id] = { notes: S(id) };
const show: Show = {
  version: 3, id: 'rach-concerto-2-full', song: 'rach-concerto-2',
  title: 'Rachmaninoff: Piano Concerto No. 2, I. Moderato · full', composer: { by: 'claude', at: new Date().toISOString() }, clips, picks,
};

const pack = JSON.parse(readFileSync(join(ROOT, 'songs/rach-concerto-2/pack.json'), 'utf8'));
const { errors, warnings } = validateShow(show, { duration: typeof pack.duration === 'number' ? pack.duration : undefined, widgets: loadCatalogue().widgets,
  tracks: Object.keys(pack.tracks ?? {}) });
console.log(`${clips.length} clips, ${Object.keys(picks).length} sets, tracks 0..${used.length - 1}`);
console.log(`errors ${errors.length}`, errors.slice(0, 20));
console.log(`warnings ${warnings.length}`, warnings.slice(0, 40));
// At most this many clips at once (excluding the fields ground).
const ev = clips.filter((c) => c.widget !== 'fields').flatMap((c) => [[c.start, 1, c], [c.end, -1, c]] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
let n = 0, most = 0; const busy: string[] = [];
for (const [t, d] of ev) { n += d; if (n > most) most = n; if (n >= 4 && d > 0) busy.push(`${t.toFixed(1)}:${n}`); }
console.log('most motif clips at once', most, busy.join(' '));
if (!errors.length) {
  writeFileSync(join(ROOT, 'shows/rach-concerto-2-full.json'), canonicalShow(show));
  console.log('wrote shows/rach-concerto-2-full.json');
}
