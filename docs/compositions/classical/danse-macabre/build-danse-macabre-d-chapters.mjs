// Builds shows/danse-macabre-d-chapters.json: "Six Rooms at Midnight (chapters)". Saint-Saëns' Danse macabre as a walk
// through six rooms, each a visual world of its own (ground, palette, widget family, layout). A chapter is one function
// call; a return calls the same function, so it is the same room by construction; a development calls the rooms' own
// member functions with explicit transforms (a window, a strip, a quadrant, a scale), so it is visibly made of rooms the
// eye already knows. The plan: CHAPTERS-PLAN.md (this folder). Reads picks.json (gen-picks.mjs); derives a few sets from
// songs/danse-macabre/pack.json. Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/danse-macabre/build-danse-macabre-d-chapters.mjs
//
// THE ROOMS
//   M  Midnight: horizon (pure greys) struck by hammer bars (bell touch), pluck threads; at dawn milky handover slabs.
//   D  Death's fiddle: nap (oxblood velvet, memory 2) and prickle (red thorns) on black.
//   A  The Waltz: delaunay floor (full frame), two delaunay windows (the tune high right, a high thread low left), mandala.
//   B  The Sigh: fields pinned indigo, the current (gold thread), woven threads in a low band, huddled Ivory per phrase.
//   C  The Chorale: martin's pale paper, lewitt in a band, stella frames.
//   X  The Bones: riley black and bone, time slice, glitch blocks, pixel sort (own 0.1). First seen through a keyhole.
// THE FORM (song seconds)
//   M 0-18.9 | D 18.9-26 | A 26-41.6 | B 41.6-55.8 | A' 55.8-68.6 | D' 68.6-71.7 | A' 71.7-86.4 (+keyhole)
//   B' 86.4-100.8 | A' 100.8-120.4 (+keyholes) | dev B: fugato staves 118.8-149.6 | dev M+A: tolls and moons 149.6-175.5
//   C 175.5-222 (+keyhole growing 213-222) | X 222-248 | dev all: the procession frieze 245.9-272.5
//   dev A: the waltz in pieces 272.5-297.5 | dev A: reassembled 297.5-320.4 | B reaching in 320.4-322.8
//   A+B split 322.8-338.2 | A/B strips 338.2-360.9 | four rooms in a grid 360.9-374.9
//   M' the nine blows, the crow, dawn 374.9-399.9 | D' the farewell 395.9-424.07 | M' the end 424.07-429.8
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = 'danse-macabre', ID = 'danse-macabre-d-chapters';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const CAT = loadCatalogue().widgets;
const r3 = (v) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------------------------------------------------- notes
const S = (id, a = -1, b = 1e9) => {
  if (!P[id]) throw new Error(`no set ${id}`);
  return P[id].notes.filter((n) => n[0] >= a && n[0] < b).map((n) => [n[0], n[1], n[2], n[3]]);
};
/** Notes of every pack lane (or the named ones) in [a, b), deduped. */
const LANES = (a, b, names = Object.keys(pack.tracks)) =>
  merge(...names.map((k) => pack.tracks[k].notes.filter((n) => n[0] >= a && n[0] < b).map((n) => [n[0], n[1], n[2], n[3]])));
function merge(...lists) {
  const seen = new Set(), out = [];
  for (const n of lists.flat()) { const k = `${Math.round(n[0] * 100)}:${n[2]}`; if (!seen.has(k)) { seen.add(k); out.push(n); } }
  return out.sort((p, q) => p[0] - q[0] || p[2] - q[2]);
}
/** Attacks (40 ms rule): [[notes...], ...]. */
const attacks = (notes) => {
  const out = [];
  for (const n of notes) { const last = out[out.length - 1]; if (last && n[0] - last[0][0] < 0.04) last.push(n); else out.push([n]); }
  return out;
};
/** Phrases: split where the gap between attacks is over `gap` s. */
const phrases = (notes, gap) => {
  const out = [];
  for (const a of attacks(notes)) { const cur = out[out.length - 1]; if (cur && a[0][0] - cur[cur.length - 1][0] <= gap) cur.push(...a); else out.push([...a]); }
  return out;
};
/** One note per attack: the top one inside [lo, hi). */
const skyline = (notes, lo, hi) => attacks(notes.filter((n) => n[2] >= lo && n[2] < hi)).map((a) => a.reduce((p, q) => (q[2] > p[2] ? q : p)));

// ---------------------------------------------------------------------------------------------------------- clips
const BANDS = { ground: [0, 4], floor: [5, 8], mid: [9, 16], win: [17, 26], keys: [27, 30], top: [31, 35], fire: [36, 37] };
const clips = [], picks = {};
function trackIn(band, start, end) {
  const [lo, hi] = BANDS[band];
  for (let t = lo; t <= hi; t++) if (!clips.some((c) => c.track === t && c.start < end && start < c.end)) return t;
  throw new Error(`band ${band} full at ${start}-${end}`);
}
/** How present, done as the studio does it: every knob that follows the slider gets its base at s; hand knobs win. */
function present(widget, s, hand = {}) {
  const w = CAT.get(widget); if (!w) throw new Error(`no widget ${widget}`);
  const out = {};
  if (s < 1) for (const q of w.params) if (typeof q.less === 'number') out[q.key] = r3(q.less + (q.value - q.less) * s);
  const lead = w.params.find((q) => q.key === 'presence');
  if (lead && !lead.leads) out.presence = r3(s);
  return { ...out, ...hand };
}
let setNo = 0;
/** One clip. o: { notes, set, listen, knobs, region, fade, intensity [[t, v, shape]], moves } */
function clip(band, widget, start, end, o = {}) {
  start = r3(Math.max(0, start)); end = r3(Math.min(429.8, end));
  if (end - start < 0.2) throw new Error(`${widget} ${start}-${end}: too short`);
  const c = { id: '', start, end, track: trackIn(band, start, end), fade: o.fade ?? 0.05, widget };
  if (o.knobs && Object.keys(o.knobs).length) c.knobs = o.knobs;
  if (o.notes) {
    const heard = o.notes.filter((n) => n[0] >= start && n[0] < end);
    if (!heard.length) throw new Error(`${o.set}: no notes in ${start}-${end}`);
    let id = o.set.toLowerCase();
    if (picks[id]) id = `${id}-${++setNo}`;
    picks[id] = { notes: heard.map((n) => [r3(n[0]), r3(n[1]), n[2], n[3]]) };
    c.listen = `picks:${id}`;
  } else if (o.listen) c.listen = o.listen;
  if (o.region) c.region = o.region;
  if (o.intensity) {
    const pv = o.intensity.map(([t, v, shape]) => ({ t: r3(Math.min(end, Math.max(start, t))), v: r3(Math.max(0, Math.min(1, v))), ...(shape ? { shape } : {}) }));
    c.intensity = pv.filter((p, i) => i === 0 || p.t > pv[i - 1].t);
    if (o.moves) c.intensityMoves = 'present';
  }
  clips.push(c);
  return c;
}

// ---------------------------------------------------------------------------------------------------------- places
// A member's region is given in the room's own frame (0..1). A transform T maps the room into part of the screen:
// T = { x, y, w, h, k, feather } (k scales round shapes uniformly). FULL leaves a full-frame member without a region
// (it draws on the shared canvas, as in the room's statement).
const FULL = { full: true };
const rect = (x, y, w, h, extra = {}) => ({ mode: 'window', shape: 'rect', x: r3(x), y: r3(y), w: r3(w), h: r3(h), feather: 0.05, fit: 'stretch', ...extra });
const ell = (x, y, w, h, extra = {}) => ({ mode: 'window', shape: 'ellipse', x: r3(x), y: r3(y), w: r3(w), h: r3(h), feather: 0.2, fit: 'cover', ...extra });
/** r: the member's region in the room (null = the whole room). fitWhole: how a whole-room member fits into T. */
function placeIn(r, T, fitWhole = 'stretch', blendWhole) {
  if (!T || T.full) {
    if (r) return r;
    return blendWhole ? rect(0.5, 0.5, 1, 1, { feather: 0, blend: blendWhole, fit: fitWhole }) : undefined;
  }
  if (!r) return rect(T.x, T.y, T.w, T.h, { feather: T.feather ?? 0.05, fit: fitWhole, ...(blendWhole ? { blend: blendWhole } : {}) });
  const k = T.k ?? Math.min(T.w, T.h);
  const x = T.x + (r.x - 0.5) * T.w, y = T.y + (r.y - 0.5) * T.h;
  const w = r.shape === 'ellipse' ? r.w * k : r.w * T.w, h = r.shape === 'ellipse' ? r.h * k : r.h * T.h;
  return { ...r, x: r3(x), y: r3(y), w: r3(w), h: r3(h) };
}

// =================================================================================================================
// ROOM M: MIDNIGHT. The grey photographic sea and the bells. Spare by design.
// The bells stand upright: hammer's canvas turned a quarter (low notes to the left), so each struck key is a bone pillar
// standing through the horizon, not a hairline lost in it.
const M_BELL = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.5625, h: 1.7778, rot: 90, feather: 0, fit: 'stretch' };
const M = {
  /** horizon: pure greys; lift raises presence and contrast. curve: [[t, lift]] moves it inside the clip. */
  sea(start, end, { lift, set, curve, T, fade = 0.05, tail }) {
    const L = curve ? Math.max(...curve.map((p) => p[1])) : lift;
    const knobs = { colour: 0, presence: r3(0.2 + 0.8 * L), contrast: r3(0.18 + 0.4 * L) };
    let intensity, moves = false;
    if (curve) { intensity = curve.map(([t, l, sh]) => [t, (0.2 + 0.8 * l) / (0.2 + 0.8 * L), sh]); moves = true; }
    if (tail) intensity = tail;
    return clip('ground', 'horizon', start, end, { set: `M-sea-${Math.round(start)}`, notes: set, knobs, fade, intensity, moves,
      region: placeIn(null, T, 'stretch') });
  },
  /** hammer, bell touch: one bar per pitch, the same key restrikes its own bar. */
  bell(start, end, { set, T, fade = 0.05 }) {
    // Every bell note at twice its velocity (a pick's intensity): midnight's pp strokes must stand as bone bars over the sea.
    const loud = set.map((n) => [n[0], n[1], n[2], n[3], 2]);
    return clip('mid', 'hammer', start, end, { set: `M-bell-${Math.round(start)}`, notes: loud, knobs: { touch: 3, ring: 2, size: 1.6 }, fade,
      region: M_BELL });
  },
  /** pluck, defaults: the pizzicato threads. */
  pizz(start, end, { set, T, fade = 0.05 }) {
    return clip('mid', 'pluck', start, end, { set: `M-pizz-${Math.round(start)}`, notes: set, fade, region: placeIn(null, T, 'stretch') });
  },
  /** milky handover: dawn's slow slabs. */
  slab(start, end, { set, T, fade = 0.3 }) {
    return clip('keys', 'handover', start, end, { set: `M-slab-${Math.round(start)}`, notes: set, fade, region: placeIn(null, T, 'stretch') });
  },
};
/** chapterM(start, end, v): v = { lift | curve, bell, pizz, slab (sets), seaEnd, seaTail, T }. */
function chapterM(start, end, v) {
  const all = merge(v.bell ?? [], v.pizz ?? [], v.slab ?? []);
  M.sea(start, v.seaEnd ?? end, { lift: v.lift, curve: v.curve, set: all, T: v.T, fade: v.seaFade, tail: v.seaTail });
  if (v.bell) M.bell(start, v.bellEnd ?? end, { set: v.bell, T: v.T });
  if (v.pizz) M.pizz(start, end, { set: v.pizz, T: v.T, fade: v.fade });
  if (v.slab) M.slab(v.slabStart ?? start, v.slabEnd ?? end, { set: v.slab, T: v.T });
}

// =================================================================================================================
// ROOM D: DEATH'S FIDDLE. Oxblood velvet torn by red thorns, on black.
/** Nap turns a band off when the same note is stroked again: a single note repeating the last single note's pitch is
    not restroked, so a band never switches itself off. */
function napSet(notes) {
  const out = []; let prev = null;
  for (const a of attacks(notes)) {
    if (a.length === 1 && prev && prev.length === 1 && prev[0][2] === a[0][2]) continue;
    out.push(...a); prev = a;
  }
  return out;
}
const D = {
  velvet(start, end, { set, T, fade = 0.05 }) {
    return clip('mid', 'nap', start, end, { set: `D-velvet-${Math.round(start)}`, notes: napSet(set), fade,
      knobs: { cloth: 0, memory: 2, rest: 6 }, region: placeIn(null, T, 'stretch') });
  },
  /** prickle: lift scales the thorns (how present: broad and long-lived when loud, thin and quick when pp). */
  thorns(start, end, { set, lift = 1, T, fade = 0.05 }) {
    return clip('mid', 'prickle', start, end, { set: `D-thorns-${Math.round(start)}`, notes: set, fade, knobs: present('prickle', 0.5 + 0.5 * lift),
      region: placeIn(null, T, 'stretch') });
  },
};
function chapterD(start, end, v) {
  D.velvet(v.velvetStart ?? start, end, { set: v.velvet, T: v.T });
  D.thorns(start, end, { set: v.thorns, lift: v.lift, T: v.T });
}

// =================================================================================================================
// ROOM A: THE WALTZ. A ballroom of whirling Delaunay discs on black.
const A2 = ell(0.76, 0.30, 0.38, 0.48), A3 = ell(0.22, 0.74, 0.30, 0.38);
const discKnobs = (lift, legato) => ({ presence: r3(0.7 + 0.3 * lift), pulse: legato ? 0 : r3(0.45 + 0.3 * lift) });
const scaled = (r, s) => ({ ...r, w: r3(r.w * s), h: r3(r.h * s) });
const A = {
  /** A1: the dance floor, the whole room, on the bass. */
  floor(start, end, { set, lift, legato, T, curve, fade = 0.05 }) {
    let intensity, moves = false;
    if (curve) { intensity = curve; moves = true; }
    return clip('floor', 'delaunay', start, end, { set: `A-floor-${Math.round(start)}`, notes: set, fade, knobs: discKnobs(lift, legato),
      region: placeIn(null, T, 'cover'), intensity, moves });
  },
  /** A disc window: the same delaunay, seen through an ellipse. */
  disc(start, end, { set, lift, legato, region, T, fade = 0.05, intensity }) {
    return clip('win', 'delaunay', start, end, { set: `A-disc-${Math.round(start)}`, notes: set, fade, knobs: discKnobs(lift, legato),
      region: placeIn(region, T, 'cover'), intensity });
  },
  /** A4: the colour strand, a mandala laid over the floor with a lighten blend. */
  colour(start, end, { set, lift, T, fade = 0.05 }) {
    return clip('mid', 'mandala', start, end, { set: `A-colour-${Math.round(start)}`, notes: set, fade,
      knobs: present('mandala', 0.6 + 0.4 * lift), region: placeIn(null, T, 'stretch', 'lighten') });
  },
};
/** chapterA(start, end, v): v = { lift, legato, floor, tune, high, colour, T, ends: {member: t} }. */
function chapterA(start, end, v) {
  const s = 1 + 0.35 * v.lift, e = v.ends ?? {};
  A.floor(start, e.floor ?? end, { set: v.floor, lift: v.lift, legato: v.legato, T: v.T, curve: v.floorCurve });
  if (v.colour) A.colour(start, e.colour ?? end, { set: v.colour, lift: v.lift, T: v.T });
  if (v.tune) A.disc(start, e.tune ?? end, { set: v.tune, lift: v.lift, legato: v.legato, region: scaled(A2, s), T: v.T });
  if (v.high) A.disc(start, e.high ?? end, { set: v.high, lift: v.lift, legato: v.legato, region: scaled(A3, s), T: v.T });
}

// =================================================================================================================
// ROOM B: THE SIGH. An indigo field, one gold thread, an ice weave and huddled keys.
const B_WEAVE = rect(0.5, 0.78, 1, 0.34, { feather: 0.3 }), B_KEYS = rect(0.5, 0.5, 0.6, 1, { feather: 0.05, fit: 'stretch' });
const B = {
  ground(start, end, { set, lift, T, intensity, fade = 0.05 }) {
    const knobs = { home: { base: -0.85, drive: '' }, chords: 0, n: 3, dyn: r3(0.15 + 0.3 * lift), back: 0.4 };
    return clip('ground', 'fields', start, end, { set: `B-ground-${Math.round(start)}`, notes: set, fade, knobs, intensity,
      region: placeIn(null, T, 'stretch') });
  },
  thread(start, end, { set, lift, T, region, fade = 0.05 }) {
    const knobs = present('current', 0.5 + 0.5 * lift, { threads: 1 + Math.floor(2 * lift), hue: 220 });
    return clip('mid', 'current', start, end, { set: `B-thread-${Math.round(start)}`, notes: set, fade, knobs,
      region: placeIn(region ?? null, T, 'stretch') });
  },
  weave(start, end, { set, T, fade = 0.05 }) {
    return clip('mid', 'strings', start, end, { set: `B-weave-${Math.round(start)}`, notes: set, fade, region: placeIn(B_WEAVE, T) });
  },
  /** One short huddled Ivory row per phrase, each ending as the next begins. */
  keys(list, { T, until }) {
    list.forEach((ph, k) => {
      const next = list[k + 1], a = ph[0][0] - 0.35, last = ph[ph.length - 1][0];
      const end = next ? Math.max(last + 0.6, next[0][0] - 0.05) : Math.min(until, last + 3.2);
      clip('keys', 'ivory', a, end, { set: `B-keys-${Math.round(a)}`, notes: ph, fade: 0.2, knobs: { huddle: 0.8, strike: 0 },
        region: placeIn(B_KEYS, T) });
    });
  },
};
/** chapterB(start, end, v): v = { lift, line, weave, keys: [phrase note lists], T }. */
function chapterB(start, end, v) {
  B.ground(start, end, { set: v.line, lift: v.lift, T: v.T });
  B.thread(start, end, { set: v.line, lift: v.lift, T: v.T });
  B.weave(start, end, { set: v.weave, T: v.T });
  if (v.keys) B.keys(v.keys, { T: v.T, until: end });
}

// =================================================================================================================
// ROOM C: THE CHORALE. Agnes Martin's pale ruled page, a LeWitt band, Stella's dark frames.
const C_WALL = rect(0.5, 0.5, 0.92, 0.36, { feather: 0.15 });
const C = {
  page(start, end, { set, T, intensity, fade = 0.05 }) {
    return clip('ground', 'martin', start, end, { set: `C-page-${Math.round(start)}`, notes: set, fade, knobs: { paper: 1 }, intensity,
      region: placeIn(null, T, 'stretch') });
  },
  wall(start, end, { set, T, fade = 0.4 }) {
    return clip('mid', 'lewitt', start, end, { set: `C-wall-${Math.round(start)}`, notes: set, fade, region: placeIn(C_WALL, T) });
  },
  frames(start, end, { set, T, fade = 0.3 }) {
    return clip('top', 'stella', start, end, { set: `C-frames-${Math.round(start)}`, notes: set, fade, region: T && !T.full ? placeIn(null, T) : undefined });
  },
};

// =================================================================================================================
// ROOM X: THE BONES. Riley's black-and-bone stripes, torn.
const X_HOLE = (w) => ({ x: 0.26, y: 0.30, w, h: 1.2 * w });
const X = {
  stripes(start, end, { set, lift, T, region, curve, fade = 0.05 }) {
    // Critic's pass: black and cold cyan (an X-ray), not black and bone: bone stripes read as the chapel's cream paper.
    const knobs = { ...present('riley', 0.4 + 0.6 * (curve ? 1 : lift)), colours: 4 };
    let intensity, moves = false;
    if (curve) { intensity = curve.map(([t, l]) => [t, (0.4 + 0.6 * l)]); moves = true; }
    return clip(region || (T && !T.full) ? 'win' : 'ground', 'riley', start, end, { set: `X-stripes-${Math.round(start)}`, notes: set, fade,
      knobs, intensity, moves, region: region ?? placeIn(null, T, 'cover') });
  },
  slice(start, end, { set, spot, fade = 0.05 }) {
    return clip('top', 'timeslice', start, end, { set: `X-slice-${Math.round(start)}`, notes: set, fade, region: spot });
  },
  tear(start, end, { set, spot, fade = 0.05 }) {
    return clip('top', 'blocks', start, end, { set: `X-tear-${Math.round(start)}`, notes: set, fade, region: spot });
  },
  sort(start, end, { set, fade = 0.05 }) {
    return clip('top', 'pixelsort', start, end, { set: `X-sort-${Math.round(start)}`, notes: set, fade, knobs: { own: 0.1 } });
  },
};
/** The keyhole: the bones' room glimpsed, always in the same place, only while the bones are heard. */
function xKeyhole(start, end, set, w, lift = 0.5) {
  const k = X_HOLE(w);
  X.stripes(start, end, { set, lift, region: rect(k.x, k.y, k.w, k.h, { feather: 0.1, fit: 'cover' }) });
  X.slice(start, end, { set, spot: { mode: 'spot', shape: 'rect', x: k.x, y: k.y, w: r3(k.w), h: r3(k.h), feather: 0.1 } });
}
function chapterX(start, end, v) {
  X.stripes(start, end, { set: v.bass, curve: v.curve, lift: v.lift });
  X.slice(v.sliceStart ?? start, end, { set: v.line });
  X.tear(v.tearStart ?? start, end, { set: v.bones });
}

/** Fireworks only on real ff blows. */
const fire = (notes, set, post = 2.2) => clip('fire', 'fireworks-snap', notes[0][0] - 0.15, notes[notes.length - 1][0] + post, { set, notes, fade: 0.1 });

// =================================================================================================================
// THE SHOW
const TL = [];   // the timeline as built: [start, end, chapter, kind, name]
const seg = (start, end, chapter, kind, name) => TL.push({ start, end, chapter, kind, name });

// ---- M, bookend and statement: midnight (0-18.88). One D4 bar struck twelve times over a dark, still sea; the hush
// chord and the low pizzicato as pluck threads.
chapterM(0, 18.88, { lift: 0.15, bell: S('clock-strokes'), pizz: merge(S('hush-chord'), S('grave-pizz')), seaTail: [[0, 0], [0.19, 1]], bellEnd: 18.88 });
seg(0, 9.6, 'M', 'bookend', 'Midnight: twelve strokes on one bar over a dark sea');
seg(9.6, 18.88, 'M', 'statement', 'The hush chord and Death\'s low pizzicato');

// ---- D, statement (18.88-26.0): the tuning. Spare: two threads.
chapterD(18.8, 26.0, { lift: 0.6, velvet: S('tuning-tritone'), thorns: S('tuning-fifths') });
seg(18.88, 26.0, 'D', 'statement', 'Death tunes his fiddle: oxblood velvet bands and red thorns');

// ---- A, statement (26.0-41.59): the waltz.
// A3, the small disc low left: the violas' inner voice (the waltz's after-beats), from the pack's viola lane.
const thHigh = (a, b) => LANES(a, b, ['viola']);
chapterA(25.95, 41.55, { lift: 0.3, floor: merge(S('dance-begins'), S('pizz-waltz-bass', 26, 41.5)), tune: S('theme-a-flute'),
  high: thHigh(26, 41.5), colour: S('harp-chords-31') });
seg(26.0, 41.55, 'A', 'statement', 'The waltz: a ballroom of whirling discs');

// ---- B, statement (41.55-55.75): the solo violin's sigh.
const soloKeys = ['theme-b-solo-p1', 'theme-b-solo-p2', 'theme-b-solo-p3', 'theme-b-solo-p4'].map((id) => S(id));
chapterB(41.55, 55.75, { lift: 0.35, line: S('theme-b-solo-violin'), weave: S('pizz-waltz-bass', 41.5, 55.75), keys: soloKeys });
seg(41.55, 55.75, 'B', 'statement', 'The sigh: an indigo field, one gold thread, ice weave, huddled keys');

// ---- A, return (55.75-68.55): theme A in D. The same room.
chapterA(55.75, 68.55, { lift: 0.45, floor: S('pizz-waltz-bass', 55.75, 68.55), tune: S('theme-a-in-d'), high: thHigh(55.75, 68.5),
  colour: S('winds-56') });
seg(55.75, 68.55, 'A', 'return', 'The waltz again, in D');

// ---- D, return (68.55-71.75): the tritone again, rocking A4-Eb5 into the tutti. The same two bands as 18.88.
chapterD(68.55, 71.75, { lift: 0.8, velvet: S('build-to-tutti', 69.1, 72), thorns: S('build-to-tutti'), velvetStart: 69.05 });
seg(68.55, 71.75, 'D', 'return', 'Death\'s tritone again: the same velvet bands, cut off by the tutti');

// ---- A, return (71.7-86.4): theme A tutti, the room at full scale. The bones glimpsed through a keyhole (79.9-84).
chapterA(71.75, 86.4, { lift: 1, floor: S('bass-tutti-1', 71.75, 86.4), tune: S('theme-a-tutti'), high: thHigh(71.75, 86.4),
  colour: S('hammered-chords-80') });
xKeyhole(79.75, 84.6, S('hammered-chords-80'), 0.24);
seg(71.75, 86.4, 'A', 'return', 'The waltz, tutti: windows 35% bigger; the bones through a keyhole');

// ---- B, return (86.4-100.75): theme B tutti, louder: three threads, a fuller field. Nothing strikes.
const tuttiKeys = ['theme-b-tutti-p1', 'theme-b-tutti-p2', 'theme-b-tutti-p3'].map((id) => S(id));
chapterB(86.4, 100.75, { lift: 1, line: S('theme-b-tutti'), weave: S('bass-tutti-1', 86.4, 100.75), keys: tuttiKeys });
seg(86.4, 100.75, 'B', 'return', 'The sigh sung by all the strings: the same room, fuller');

// ---- A, return (100.75-120.4): theme A in D with the xylophone; keyholes on the rattles; then the close.
chapterA(100.75, 120.4, { lift: 0.75, floor: merge(S('bass-tutti-1', 100.75, 115.4), S('exposition-close', 115.4, 118.15), S('ff-blows-early', 118, 118.5)),
  tune: S('theme-a-xylophone-d'), high: thHigh(100.75, 115.4), colour: S('repeated-d-chords'),
  ends: { tune: 117.0, high: 116.5, colour: 115.2 } });
// The A floor fades with the sound after the octave blow (its own tail).
clips.filter((c) => c.widget === 'delaunay' && c.start === 100.75 && c.track <= BANDS.floor[1]).forEach((c) => {
  c.intensity = [{ t: 118.3, v: 1 }, { t: 120.4, v: 0 }]; });
xKeyhole(104.6, 106.9, S('xylophone-bones', 104, 107), 0.32);
xKeyhole(111.7, 115.4, S('xylophone-bones', 111, 115), 0.38);
seg(100.75, 115.4, 'A', 'return', 'The waltz in D with the xylophone; the keyhole grows on each rattle');
seg(115.4, 120.4, 'A', 'transition', 'The close: the last octave blow, the ballroom fades, indigo breathes in');

// ---- B, development: the fugato (118.8-149.6). B's room cut into staves, one current per fugal voice.
{
  // Critic's pass: the four thin threads over one field did not read as staves. Now B's own indigo ground is cut into four
  // staves (one fields window per voice, one field each, black between them) that appear bottom to top on the real
  // entries, each lit from inside by its own voice; one gold braid (B's thread, width pushed) runs across them all.
  const all = LANES(120.4, 149.6);
  const voices = [[36, 56, 120.8, 0.86], [56, 62, 125.0, 0.62], [62, 72, 129.2, 0.38], [72, 100, 134.65, 0.14]];
  const vs = voices.map(([lo, hi, from], k) => {
    const notes = skyline(all.filter((n) => n[0] >= from), lo, hi);
    console.log(`fugal voice ${k + 1}: ${notes.length} notes from ${from} (${(notes.length / (149.6 - from)).toFixed(2)}/s)`);
    return notes;
  });
  voices.forEach(([, , from, y], k) => {
    const a = k === 0 ? 118.8 : from - 0.05;
    const set = k === 0 ? merge(S('thread-mid', 118.5, 120.4), S('fugato-subject-low'), vs[0]) : vs[k];
    const st = clip('ground', 'fields', a, 149.65, { set: `B-stave-${k + 1}`, notes: set, fade: 0.05,
      knobs: { home: { base: -0.85, drive: '' }, chords: 0, n: 1, dyn: 0.7, back: 0.25 },
      region: rect(0.5, y, 1, 0.215, { feather: 0.08 }),
      intensity: k === 0 ? [[118.8, 0], [120.0, 1, 'ease']] : undefined });
  });
  clip('mid', 'current', 120.8, 149.65, { set: 'B-braid', notes: merge(...vs), fade: 0.05,
    knobs: present('current', 0.8, { threads: 3, hue: 220, width: 1.8 }) });
  // The brass enters: one of A's discs bursts into the middle.
  A.disc(145.35, 149.6, { set: S('brass-calls', 145, 150), lift: 0.8, region: ell(0.5, 0.5, 0.42, 0.56) });
}
seg(120.4, 149.6, 'B', 'development', 'Fugato: the sigh cut into four staves, one gold thread per voice; a waltz disc bursts in with the brass');

// ---- M, development: the tolls (149.6-175.55). Midnight's sea and bells, with A's discs rising as moons.
chapterM(149.65, 175.55, { curve: [[149.65, 0.3], [162.4, 0.5], [175.3, 0.8]], bell: merge(S('pedal-e-toll'), S('pedal-a-toll')) });
A.disc(149.65, 174.8, { set: S('pedal-line-high'), lift: 0.4, region: A2 });
A.disc(155.9, 159.5, { set: S('winds-156'), lift: 0.4, region: A3 });
A.disc(169.9, 175.55, { set: merge(S('brass-calls', 170, 176)), lift: 0.9, region: scaled(A3, 1.45) });
{
  const ab = LANES(170, 172.4).filter((n) => n[2] % 12 === 8);
  console.log(`ab-octaves-170: ${ab.length} notes`);
  xKeyhole(169.9, 172.9, ab, 0.46);
}
seg(149.6, 175.55, 'M', 'development', 'The tolls: midnight\'s sea struck low, the waltz discs rising as moons, the keyhole wider');

// ---- C, statement (175.55-213.15): the chorale. The pale page appears on the drop; nothing red, nothing busy.
C.page(175.5, 222.0, { set: merge(S('chorale-top'), S('chorale-bass')), intensity: [[213.2, 1], [221.9, 0.55]] });
C.wall(177.9, 199.3, { set: S('harp-arpeggios', 177, 199.3) });
C.wall(199.3, 211.5, { set: merge(S('harp-arpeggios', 199.3, 212), S('chorale-pulse')) });
C.frames(176.2, 213.3, { set: S('chorale-top') });
seg(175.55, 213.15, 'C', 'statement', 'The chorale: the pale ruled page, a coloured-pencil wall, dark frames closing in');

// ---- X, transition (213.15-222): the bones push the chapel aside through a growing keyhole.
{
  const set = merge(S('build-213'), S('bass-tutti-2', 213, 222));
  const recut = attacks(S('build-213', 217.3, 219.5)).find((a) => a.some((n) => n[2] < 50))?.[0][0] ?? 219.14;
  console.log(`keyhole recut at ${recut}`);
  xKeyhole(213.05, recut - 0.02, set, 0.5, 0.6);
  xKeyhole(recut - 0.02, 222.05, set, 0.75, 0.7);
}
seg(213.15, 222.0, 'X', 'transition', 'The keyhole grows over the chapel');

// ---- X, statement (222-248): the bones, full frame.
chapterX(222.0, 244.15, { bass: S('bass-tutti-2', 221.9, 244.2), curve: [[222, 0.7], [237, 1]], line: S('tutti-c-line'), sliceStart: 223.5,
  bones: merge(S('xylophone-bones', 233, 239.5)), tearStart: 233.3 });
X.sort(227.5, 247.9, { set: merge(S('brass-calls', 228, 233), S('ff-blows-early', 237, 238), S('xylophone-bones', 237.2, 238.95).filter((n) => n[3] >= 90), S('stop-244')) });
seg(222.0, 244.08, 'X', 'statement', 'The bones: black-and-bone stripes, sliced in time, torn in rows, sorted on the loud chords');
seg(244.08, 248.0, 'X', 'transition', 'The break: the stop chord tears the stripes and they decay');

// ---- Development: the procession (245.9-272.6). A frieze of the rooms in the order first seen, each lit by its part.
{
  const gate = (notes, a, b, lo = 0.45) => {
    const pts = [[a, lo]];
    for (const ph of phrases(notes, 2.5)) {
      const s = ph[0][0], e = ph[ph.length - 1][0];
      pts.push([s - 0.35, lo], [s, 1], [e + 0.8, 1], [e + 2.2, lo, 'ease']);
    }
    return pts.filter((p) => p[0] >= a && p[0] <= b).sort((p, q) => p[0] - q[0]);
  };
  const P4 = (x) => ({ x, y: 0.43, w: 0.235, h: 0.8, k: 0.6, feather: 0.05 });
  const bassoon = skyline(LANES(245.9, 272.5, ['bassoon']), 0, 128), clar = skyline(LANES(245.9, 272.5, ['clarinet']), 0, 128);
  const oboe = skyline(LANES(245.9, 272.5, ['oboe']), 0, 128), strs = S('interlude-strings');
  console.log(`procession: bassoon ${bassoon.length}, clarinet ${clar.length}, oboe ${oboe.length}, strings ${strs.length}`);
  M.sea(254.0, 270.0, { lift: 0.9, set: strs, T: P4(0.14), tail: gate(strs, 254, 270), fade: 0.3 });
  A.disc(bassoon[0][0] - 0.2, 272.6, { set: bassoon, lift: 0.3, T: P4(0.38), region: null, fade: 0.3 });
  const bA = clar[0][0] - 0.3;
  B.ground(bA, 272.6, { set: clar, lift: 0.4, T: P4(0.62), intensity: gate(clar, bA, 272.6), fade: 0.3 });
  B.thread(bA, 272.6, { set: clar, lift: 0.2, T: P4(0.62), fade: 0.3 });
  const cA = oboe[0][0] - 0.3;
  C.page(cA, 272.6, { set: oboe, T: P4(0.86), intensity: gate(oboe, cA, 272.6), fade: 0.3 });
  X.stripes(261.5, 266.0, { set: S('cascade-262'), lift: 0.5, region: rect(0.5, 0.92, 0.94, 0.1, { feather: 0.1, fit: 'cover' }), fade: 0.15 });
}
seg(248.0, 272.6, 'A', 'development', 'The procession: a frieze of the rooms in the order first seen, each lit while its part plays');

// ---- A development: the waltz in pieces (272.6-297.5). The floor dim on the D/C# pedal; each phrase of the violins lights
// one small disc on a 3x3 lattice.
{
  A.floor(272.6, 297.6, { set: S('bass-development', 272.5, 297.6), lift: 0.1 });
  const cells = [[0.5, 0.5], [0.2, 0.22], [0.8, 0.78], [0.8, 0.22], [0.2, 0.78], [0.5, 0.22], [0.5, 0.78], [0.2, 0.5], [0.8, 0.5]];
  const ph = phrases(S('development-line'), 0.6);
  console.log(`development phrases: ${ph.length}`);
  ph.forEach((p, k) => {
    const [x, y] = cells[k % cells.length];
    const a = p[0][0] - 0.2, e = Math.min(297.6, Math.max(p[p.length - 1][0] + 3.5, (ph[k + 2]?.[0][0] ?? 297.6) - 0.1));
    A.disc(a, e, { set: p, lift: 0.4, region: ell(x, y, 0.27, 0.46, { feather: 0.15 }), fade: 0.15 });
  });
}
seg(272.6, 297.6, 'A', 'development', 'The waltz in pieces: one small disc per violin phrase on a lattice over a dim floor');

// ---- A development: reassembled, legato (297.6-320.4). Phrase discs grow toward the tune's own window; the floor rises.
{
  A.floor(297.6, 322.85, { set: S('bass-development', 297.5, 322.9), lift: 0.9, legato: true,
    curve: [[297.6, 0.2], [313, 0.75], [320.3, 1]] });
  const ph = phrases(S('build-line'), 0.6);
  // three gestures: the rise to 305, the ff peak, the repeated A4s
  const groups = [ph.filter((p) => p[0][0] < 305.5).flat(), ph.filter((p) => p[0][0] >= 305.5 && p[0][0] < 316).flat(), ph.filter((p) => p[0][0] >= 316).flat()];
  const steps = [[0.5, 0.5, 0.45], [0.62, 0.42, 0.7], [0.76, 0.30, 1.0]];
  groups.forEach((g, k) => {
    const [x, y, s] = steps[k], nextStart = groups[k + 1]?.[0][0] ?? 320.4;
    A.disc(g[0][0] - 0.25, Math.min(320.4, Math.max(nextStart + 1.0, g[g.length - 1][0] + 1.5)), { set: g, lift: 0.9, legato: true,
      region: ell(x, y, A2.w * 1.35 * s, A2.h * 1.35 * s), fade: 0.4 });
  });
  A.colour(303.0, 306.2, { set: S('repeated-d-303'), lift: 0.9 });
  xKeyhole(303.05, 305.6, S('repeated-d-303'), 0.24);
  fire(S('ff-blows', 313, 314), 'fire-313');
}
seg(297.6, 320.4, 'A', 'development', 'The waltz reassembled: phrase discs grow back into the ballroom, legato');

// ---- B transition (320.4-322.85): B's gold thread climbs the chromatic ascent across the ballroom.
B.thread(320.3, 322.85, { set: S('chromatic-ascent', 320, 322.8), lift: 0.45 });
seg(320.4, 322.85, 'B', 'transition', 'The gold thread climbs the chromatic ascent across the ballroom');

// ---- Recapitulation (322.85-338.3): A's rhythm against B's harmony, the screen split.
{
  const L = { x: 0.275, y: 0.5, w: 0.55, h: 1, k: 0.62, feather: 0.06 }, R = { x: 0.775, y: 0.5, w: 0.45, h: 1, k: 0.55, feather: 0.06 };
  A.floor(322.8, 338.3, { set: S('bass-finale', 322.8, 338.3), lift: 1, T: L });
  A.disc(330.4, 338.3, { set: S('drum-strikes', 330, 338), lift: 1, region: scaled(A2, 1.35), T: L });
  B.ground(322.8, 338.3, { set: S('recap-theme-b-line'), lift: 1, T: R });
  B.thread(322.8, 338.3, { set: merge(S('recap-theme-b-line'), S('thread-mid', 322.8, 338.3)), lift: 1, T: R });
  B.weave(322.8, 338.3, { set: S('recap-high', 322, 338.3), T: R });
  fire(S('ff-blows', 336, 337), 'fire-336');
}
seg(322.85, 338.3, 'A', 'return', 'Recapitulation: the ballroom and the indigo room side by side');

// ---- Development (338.3-360.95): the themes intertwined, four strips A B A B.
{
  const strip = (y) => ({ x: 0.5, y, w: 1, h: 0.25, k: 0.5, feather: 0.04 });
  A.floor(338.3, 360.95, { set: S('bass-finale', 338.3, 360.95), lift: 0.9, T: strip(0.125) });
  B.ground(338.3, 360.95, { set: S('recap-line'), lift: 0.8, T: strip(0.375) });
  A.disc(338.3, 360.95, { set: merge(S('brass-calls', 340, 344), S('drum-strikes', 342, 344), S('thread-high', 338.3, 360.9)), lift: 0.9, region: null, T: strip(0.625) });
  B.thread(338.3, 360.95, { set: merge(S('recap-high', 338.3, 361), S('thread-mid', 338.3, 360.9)), lift: 0.8, T: strip(0.875) });
}
seg(338.3, 360.95, 'B', 'development', 'The themes intertwined: four strips, ballroom and indigo, woven');

// ---- Development (360.95-374.85): the frenzy, four rooms collide in a 2x2 grid; fireworks on the ff blows.
{
  const Q = (x, y) => ({ x, y, w: 0.5, h: 0.5, k: 0.5, feather: 0.04 });
  A.disc(360.95, 374.85, { set: S('frenzy-line'), lift: 1, region: null, T: Q(0.25, 0.25) });
  X.stripes(360.95, 374.85, { set: S('bass-finale', 360.9, 374.9), lift: 1, T: Q(0.75, 0.25) });
  D.thorns(360.95, 374.85, { set: merge(S('ff-blows', 361, 371), S('drum-strikes', 360.8, 370.7)), lift: 1, T: Q(0.25, 0.75) });
  D.velvet(370.6, 374.85, { set: merge(S('octave-hammer-g'), S('bass-trill')), T: Q(0.25, 0.75) });
  B.ground(360.95, 374.85, { set: S('thread-mid', 360.9, 374.9), lift: 1, T: Q(0.75, 0.75) });
  fire(S('ff-blows', 361, 374.5), 'fire-frenzy', 0.7);
}
seg(360.95, 374.85, 'A', 'development', 'The frenzy: four rooms in a grid, fireworks on the ff blows');

// ---- M return (374.85-395.9): the clock again (the nine blows restrike midnight's own D4 bar), the cock-crow, dawn.
{
  const dawn = attacks(S('dawn-chords')).map((a) => a[0][0]);
  const gestures = dawn.filter((t, i) => i === 0 || t - dawn[i - 1] > 0.3);
  const slabs = gestures.map((t, i) => [t, gestures[i + 1] ?? t + 3, 62, 60]);
  console.log(`dawn slabs: ${gestures.map((t) => t.toFixed(2)).join(' ')}`);
  // The clock: exactly midnight's room (lift 0.15), the bell on the nine blows and the crow.
  chapterM(374.85, 383.62, { lift: 0.15, bell: merge(S('final-hammer'), S('cock-crow')) });
  fire(S('final-hammer'), 'fire-374', 1.6);
  // Dawn: the same room lit. The sea restarts on the sf chord (383.66) and rises to full; slabs and the dying tremolo.
  chapterM(383.62, 395.85, { curve: [[383.62, 0.1], [391.7, 1, 'ease']], pizz: S('dawn-tremolo'), slab: slabs, slabEnd: 398.0 });
  // ...and fades out over 4 s under the first oxblood band (a plain fade, from the farewell's first note).
  M.sea(395.85, 399.9, { lift: 1, set: S('farewell-violin', 395.8, 399.9), tail: [[395.85, 1], [399.9, 0]] });
}
seg(374.85, 376.9, 'M', 'return', 'The clock again: nine blows restrike midnight\'s own bar');
seg(376.9, 383.6, 'M', 'return', 'The cock-crow over the decaying sea');
seg(383.6, 395.87, 'M', 'bookend', 'Dawn: midnight\'s sea, lit');

// ---- D return (395.87-424.07): the violin's farewell, pp.
chapterD(395.7, 424.07, { lift: 0.25, velvet: merge(S('farewell-violin'), S('last-trill')), thorns: merge(S('farewell-violin'), S('scurry', 420, 424.07)) });
seg(395.87, 424.07, 'D', 'return', 'The farewell: one velvet band per note, a thorn for every note');

// ---- M bookend (424.07-429.8): the end. The dim sea again; the last chords drawn as the hush chord was.
chapterM(424.0, 428.5, { lift: 0.1, pizz: S('final-pizz') });
clips.filter((c) => c.start === 424).forEach((c) => {
  c.intensity = [{ t: 426.5, v: 1 }, { t: 428.5, v: 0, shape: 'ease' }]; delete c.intensityMoves; });
seg(424.07, 429.8, 'M', 'bookend', 'The end: the dim sea and the last pizzicati, then black');

// ---------------------------------------------------------------------------------------------------------- write
clips.sort((a, b) => a.start - b.start || a.track - b.track);
clips.forEach((c, i) => { c.id = `c${i + 1}`; });
const show = {
  version: 3, id: ID, song: SONG, title: 'Six Rooms at Midnight (chapters)',
  composer: { by: 'claude', at: '2026-11-07T12:00:00.000Z' }, clips, picks,
};
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets: CAT, tracks: Object.keys(pack.tracks ?? {}) });
let most = 0, at = 0;
for (const c of clips) { const n = clips.filter((d) => d.start <= c.start + 0.01 && c.start + 0.01 < d.end).length; if (n > most) { most = n; at = c.start; } }
console.log(`${clips.length} clips, ${Object.keys(picks).length} sets, at most ${most} at once (${at} s); errors ${errors.length}, warnings ${warnings.length}`);
for (const e of [...errors, ...warnings]) console.log(`  ${e.path}: ${e.message}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, `shows/${ID}.json`), canonicalShow(show));
if (process.argv.includes('--timeline')) for (const t of TL) console.log(`${t.start.toFixed(2)}-${t.end.toFixed(2)} ${t.chapter} ${t.kind}: ${t.name}`);
