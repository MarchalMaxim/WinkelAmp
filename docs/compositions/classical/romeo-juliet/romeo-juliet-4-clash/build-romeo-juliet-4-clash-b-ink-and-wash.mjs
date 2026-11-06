// Builds shows/romeo-juliet-4-clash-b-ink-and-wash.json: cycle B "Ink and wash" on the development (the clash).
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-4-clash/build-romeo-juliet-4-clash-b-ink-and-wash.mjs
//
// The cycle's mapping (the same in all six packs): the Friar's chorale -> fifths (here the horns and clarinets, then the
// trumpets ff, found in the audio); the feud's strings -> scribble; the sword clashes (audio) -> kline, bone bars in a
// full-frame window (blend lighten here, see FULL); the strings' polyphony -> klee, the ground; fate, the low strokes (audio) -> rorschach,
// soot ink with a gold rim (ink 2, as in the friar).
//
// The story: the development sets the Friar's hymn against the feud, and the hymn loses. What answers what:
//   1. The Friar is a web the size of the music that carries it. The horns' quiet fragments (17.1, 29.6, 51.4, 72.7 s)
//      weave a web at its own size in the middle of the feud's pens. At the climax (99.6-122) the trumpets blare the
//      same chorale ff, and the web comes back 1.45 times as large, in a window bigger than the picture, with thick lit
//      cords and glowing shapes (line 1.8, fill 0.5): its rim breaks out of the top and bottom of the frame, a cathedral
//      of chords over the ink. The trumpets are not transcribed: each chord is the
//      trumpets' pitch class found in the audio (harmonic chroma E4-E6, held >= 0.7 s, on the nearest onset), high so
//      it breaks the rim, plus the notes the orchestra strikes with it.
//   2. The hymn collapses into one note. On the first hammer of the F# (122.07, onset strength 2.7) the web forgets
//      everything (decay 1.2 s on that note): the whole cathedral goes out and leaves a single ray on F#'s spoke, the
//      dominant. Every hammer re-strikes that ray (F# in four octaves: a bare octave is a ray in fifths; line 3 on
//      the hammers, a thick lit cord), and the key turns it toward the top. (The bars on those clashes get weight 0.55: in the preview they look
//      hardly thinner.) The breath (131-134.8, -32 dB) lets the ray die; the last F# (134.86, strength 3.1) is the
//      longest ray and the largest blot of the piece. At the feud's return (136.07) the Friar is gone.
//   3. The hush (59.7-70.8, -53 dB) is stillness: at the sudden pp the pens, the web and the whole mosaic go out at once (a
//      quiet, quick change of state, no new mark), the last sword bar (59.0, stay 12) soaks away alone, a new, empty
//      mosaic (no veil) writes only the strings' held notes, the violins' B5 and the B4 under it, as thin lines on klee's own umber ground (klee always paints it), and the horn's lone G4 over F3 (61.55) strings a single thread in an empty circle.
//   4. Fate rises: tiny dry omens on the low strokes under the feud and the horns (they dry in 2-3 s), wave by wave
//      larger through the long build, and from the climax soot blots that spread under the web, the pens and the bars.
//   5. The feud returns without the Friar: pens at full weight with red scratches, bars, a crowded mosaic; at the end
//      (157.5, A over D) the pens loosen, the ink dries.
//   6. The wash (serendipity, not in the cast): pixel sort on the real ff blows only, adding no paint of its own (`own`
//      0): each blow drags the wet paint of everything under it (the mosaic, the ink and, seen in the preview, the bars
//      too) into streaks. Not on the hammers (the ray and the blot carry those), again on the last F#.
//   Knobs off our defaults, each for the concept: fifths decay 30 (the cycle's), trumpets line 1.8 / fill 0.5, hammers
//   line 3; rorschach ink 2 (the cycle's); pixel sort own 0; klee veil 0 in the hush (the critic put Klee in a rose
//   window, see ROSE, and gave it back our default veil elsewhere); per-note thick/stay (klee), weight/stay (scribble), size/fade (rorschach), stay/weight (kline).
//
// Weight table (rough presence; K klee, S scribble, F fifths, X kline, R rorschach, W wash):
//   0-30    K.5-.8 S.4-.9 F(17, 29.6) X(21.5) R(omens)       | 22-33 hushed: K.4 S.25 F
//   30-60   K.7-1 S.6-1 F(51.4-57) R(omens) X(59.0)           | 59.7-70.8 hush: K(two thin lines) F(one thread) X(soaking)
//   60-90   K(new, from black) F(72.7-80) S.2-.4 (from 83.5) R(growing) | 90-97.6 K1 S.6 R(larger) X(95.2)
//   90-122  K.8 R1 F(1.45x, trumpets) S.45 X1 W                | 122-135.9 K(F# blocks) F(one ray) R(every hammer) X(thin) S.35
//   135.9-160 K1 S.85 X1 R.8 W; the end loosens (S.25)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-4-clash-b-ink-and-wash', SONG = 'romeo-juliet-4-clash';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const ev = JSON.parse(readFileSync(join(HERE, 'audio-events.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const set = (id) => { const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`); return s.notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const lerp = (a, b, k) => a + (b - a) * clamp(k, 0, 1);
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const sortN = (ns) => ns.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
const dedupe = (ns) => {
  const out = [];
  for (const n of sortN([...ns])) if (!out.some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.04)) out.push(n);
  return out;
};
const attacks = (ns) => {
  const out = [];
  for (const n of [...ns].sort((a, b) => a[0] - b[0])) {
    const l = out[out.length - 1];
    if (l && n[0] - l[0][0] < 0.04) l.push(n); else out.push([n]);
  }
  return out;
};
const curve = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) {
    const [t0, a] = pts[i - 1], [t1, b] = pts[i];
    return a + (b - a) * (t - t0) / (t1 - t0);
  }
  return pts[pts.length - 1][1];
};
const dbAt = (t) => ev.curve[clamp(Math.round(t * 10), 0, ev.curve.length - 1)][0];
const velOf = (dB) => Math.round(clamp(20 + 2.4 * (dB + 60), 15, 122));
const onsetNear = (t, w = 0.25) => ev.onsets.filter((o) => Math.abs(o[0] - t) <= w).sort((a, b) => Math.abs(a[0] - t) - Math.abs(b[0] - t))[0];
const tracks = (names, a, b) => names.flatMap((k) => within(pack.tracks[k].notes, a, b).map((n) => [n[0], n[1], n[2], n[3]]));
const ALL = [...pack.notes, ...Object.values(pack.tracks).flatMap((t) => t.notes)];
const WINDS = ['horn', 'clarinet', 'bassoon'];

// ---------- sections ----------
const HUSH = 59.75, HUSH_END = 70.8, CLIMAX = 97.6, HAMMER = 122.0, BREATH = 130.8, LAST_F = 134.86, RECAP = 136.07, END = 159.9;

// ---------- the Friar (fifths) ----------
// The horns, clarinets and bassoons as transcribed (the chorale's fragments and their own chords).
const friarA = dedupe(tracks(WINDS, 16.8, HUSH));                  // until the sudden pp
const friarB = dedupe(tracks(WINDS, 61.0, 80.5));                  // the horn's lone G4 over F3, the build's horns
// The trumpets (97.6-122): runs of one pitch class in the trumpets' register (harmonic chroma E4-E6, held >= 0.7 s),
// each starting on the audio onset nearest its pitch change [run start, run end, pitch class]; checked against a fresh
// chroma read (E 100.5, F# 101, D 103, F# 105.5, B 106.5, C# 107.5, E 109.5, G 110-112, B 113, C# 114.5, Eb 115, Ab 117,
// B 120-121.5).
const TRUMPET_RUNS = [[99.64, 101.3, 0], [102.26, 102.96, 4], [102.98, 103.67, 2], [105.54, 106.41, 6], [106.42, 107.26, 11],
  [107.27, 108.15, 1], [109.5, 111.45, 4], [111.53, 112.52, 7], [113.10, 114.10, 11], [114.11, 114.92, 1], [114.93, 115.82, 3],
  [116.44, 117.36, 8], [118.36, 119.13, 8], [119.79, 122.0, 11]];
const trumpetChords = [];
for (const [a, b, pc] of TRUMPET_RUNS) {
  const o = onsetNear(a, 0.25); const t = r3(o ? o[0] : a), vel = velOf(o ? o[2] : -20);
  const end = r3(Math.max(b, t + 0.5));
  // high, so it breaks through the rim: E5..Eb6
  trumpetChords.push([t, end, 76 + ((pc - 4 + 12) % 12), vel]);
  // the orchestra's notes struck with it (within 80 ms), one per pitch class, the lowest of each
  const struck = ALL.filter((n) => Math.abs(n[0] - t) <= 0.08);
  const byPc = new Map();
  for (const n of struck) { const q = n[2] % 12; if (q !== pc && (!byPc.has(q) || n[2] < byPc.get(q)[2])) byPc.set(q, n); }
  for (const n of byPc.values()) trumpetChords.push([t, r3(Math.min(end, Math.max(n[1], t + 0.4))), n[2], Math.min(vel, Math.max(n[3], vel - 12))]);
}
// The hammered F#: one attack per hammer (the strongest onset within 0.3 s), F# in four octaves, a ray on its spoke.
const hammerT = [];
for (const a of attacks(within(set('brass-blows'), HAMMER, 136))) {
  const t = a[0][0], o = onsetNear(t, 0.08) ?? [t, 2, dbAt(t)];
  const prev = hammerT[hammerT.length - 1];
  if (prev && t - prev.t < 0.3) { if (o[1] > prev.s) { prev.t = t; prev.s = o[1]; prev.db = o[2]; } continue; }
  hammerT.push({ t, s: o[1], db: o[2] });
}
const hammers = hammerT.flatMap(({ t, db }, i) => {
  const last = Math.abs(t - LAST_F) < 0.05, first = i === 0;
  // thick lit cords on the hammers (line 3): one ray has to carry the whole orchestra
  const v = first ? { decay: 1.2, line: 3 } : last ? { decay: 9, line: 3.2 } : { decay: 2.4, line: 3 };
  const len = last ? 1.4 : 0.45;
  return [42, 54, 66, 78].map((m) => withValues([r3(t), r3(t + len), m, Math.min(127, velOf(db) + (last ? 8 : 0))], v));
});
const friarC = sortN([...dedupe(trumpetChords), ...hammers]);

// ---------- the feud (scribble): the scurrying runs, the accented attacks; at the climax the strings' syncopations ----------
const feudStretch = (t) => t < 22.1 || (t >= 33.3 && t < HUSH) || t >= 78;
const feudRaw = dedupe([
  ...set('feud-runs').filter((n) => feudStretch(n[0])),
  ...set('feud-accents'),
  ...within(set('chord-blocks'), 84, CLIMAX),   // the build regathers the feud: the strings' syncopated chords
]).filter((n) => n[0] < HUSH || n[0] >= 78);
// graphite at our default weight, thinner under the trumpets (the web leads there), heavier when the feud returns
const SW = curve([[0, 1.0], [22, 1.2], [59, 1.2], [78, 1.0], [97, 1.2], [99, 0.9], [135.8, 0.9], [136, 1.4], [155, 1.4], [159.9, 1.0]]);
const SS = curve([[0, 6], [59, 7], [78, 5], [97, 6], [135.8, 5], [136, 8], [155, 8], [159.9, 4]]);
const feud = feudRaw.map((n) => withValues(n, { weight: r3(SW(n[0])), stay: r3(SS(n[0])) }));

// ---------- the clashes (kline) ----------
// the two lone strokes before the climax stay longer (stay follows the clip's loudness, low with one clash): the
// 59.0 bar soaks away alone through the hush
// (critic) the hammers strike no bars: the swords go out with the trumpets' web on the first hammer, and the last F#
// brings one bar back on a cold canvas (a second clip, 'swords-last'). Kline's night ground (#100e0d) is visible on the
// black around the rose, so both clips start just before a stroke (21.47, 134.77): the night arrives with the bar
const SWORDS_OUT = HAMMER + 0.05, SWORDS_BACK = 134.6;
const clashes = set('clash-strokes').filter((n) => !(n[0] >= HAMMER - 0.1 && n[0] < SWORDS_BACK))
  .map((n) => (n[0] < 22 ? withValues(n, { stay: 8 }) : n[0] < 60 ? withValues(n, { stay: 12 })
  : Math.abs(n[0] - 134.77) < 0.05 ? withValues(n, { weight: 1.5 }) : n));

// ---------- the strings' polyphony (klee) ----------
const KV = (thick, stay) => ({ thick: r3(thick), stay: r3(stay) });
const hammerRows = hammerT.map(({ t, db }) => [r3(t), r3(t + 0.5), 66, velOf(db)]);   // each hammer lays a block of F# tiles
const groundRaw = dedupe([
  ...set('violins'), ...set('bass-line'),
  ...set('rising-strings'),
  ...within(set('chord-blocks'), 76, CLIMAX),
  ...within(set('chord-blocks'), CLIMAX, HAMMER).filter((_, i) => i % 2 === 0),
  ...within(set('chord-blocks'), RECAP, END),
  ...hammerRows,
]).filter((n) => !(n[0] >= HUSH - 0.1 && n[0] < HUSH_END));
// the hush has its own mosaic, started empty: the violins' held B5 and the held B4 under it, as thin lines on black
// (strings only: hush-cover also holds the horn's G4, which is the Friar's, and the clarinet's figures)
const windTwin = (n) => WINDS.some((k) => pack.tracks[k].notes.some((w) => w[2] === n[2] && Math.abs(w[0] - n[0]) < 0.04));
const hush = dedupe([...within(set('rising-strings'), 60, HUSH_END), ...set('hush-cover')]).filter((n) => !windTwin(n))
  .map((n) => withValues(n, { thick: 0.6, stay: 7 }));
const groundVal = (t, m) => {
  if (t < 22.1) return KV(lerp(0.8, 1.5, t / 22), 7);               // the feud's fragments rise
  if (t < 33.3) return KV(0.7, 6);                                   // the hushed horns: thin, short
  if (t < 51.3) return KV(lerp(1.1, 1.8, (t - 33.3) / 18), 8);      // the feud against the Friar, crescendo
  if (t < HUSH) return KV(1.3, 8);                                   // under the horns' chorale
  if (t < CLIMAX) { const k = (dbAt(t + 0.15) + 45) / 16; return KV(lerp(0.9, 2.4, k), 8); }    // the build, in steps
  if (t < HAMMER) return KV(1.9, 8);                                 // under the trumpets
  if (t < RECAP - 0.05) return m === 66 ? KV(3.2, 7) : KV(1.6, 7);   // the hammers: blocks of F#
  if (t < 156.5) return KV(2.8, 12);                                 // the feud returns: broad, crowding
  return KV(1.2, 8);
};
const ground = groundRaw.map((n) => withValues(n, groundVal(n[0], n[2])));

// ---------- fate (rorschach): the low strokes; only notes below MIDI 50 drop blots ----------
const FV = (size, fade, k = {}) => ({ size: r3(size), fade: r3(fade), ...k });
const lows = set('low-strokes');
const fate = [];
fate.push(...within(lows, 0, 50).map((n) => withValues(n, FV(0.35, 2))));                  // dry omens under the feud
fate.push(...within(lows, 50, 59.5).map((n) => withValues(n, FV(0.45, 2.5))));             // under the horns' chorale
fate.push(...within(lows, 74, 89).map((n) => withValues(n, FV(lerp(0.45, 0.7, (n[0] - 74) / 15), lerp(2.5, 4, (n[0] - 74) / 15)))));
fate.push(...within(lows, 89, CLIMAX).map((n) => withValues(n, FV(lerp(0.8, 1.1, (n[0] - 89) / 8), lerp(5, 8, (n[0] - 89) / 8)))));
fate.push(...within(lows, CLIMAX, HAMMER).map((n) => withValues(n, FV(1.45, 11))));
fate.push(...within(set('ff-blows'), CLIMAX, HAMMER).filter((n) => n[2] < 62).map((n) => withValues(n, FV(1.6, 11))));
// every hammer drops ink on F#1; the last one the largest blot of the piece
for (const { t, db } of hammerT) {
  const last = Math.abs(t - LAST_F) < 0.05;
  fate.push(withValues([r3(t), r3(t + (last ? 1.5 : 0.4)), 30, Math.min(127, velOf(db) + (last ? 10 : 0))], last ? FV(2.5, 13, { intensity: 1.6 }) : FV(1.1, 7)));
}
fate.push(...within(lows, RECAP - 0.1, 156).map((n) => withValues(n, FV(1.3, 8))));
fate.push(...within(set('ff-blows'), RECAP - 0.1, END).filter((n) => n[2] < 62).map((n) => withValues(n, FV(1.5, 9))));
fate.push(...within(lows, 156, END).map((n) => withValues(n, FV(0.7, 4))));
const fateSet = sortN(dedupe(fate));

// ---------- the wash (pixel sort): the real ff blows only ----------
// not on the hammers (122-134.8: the ray and the blot are that gesture), but on the last F#
const blows = set('ff-blows').filter((n) => n[0] < HAMMER || n[0] > LAST_F - 0.05);

const picks = {
  'friar-horns': { notes: friarA },
  'friar-hush': { notes: friarB },
  'friar-trumpets': { notes: friarC },
  'feud': { notes: sortN(feud) },
  'clashes': { notes: clashes },
  'ground': { notes: sortN(ground) },
  'hush': { notes: sortN(hush) },
  'fate': { notes: fateSet },
  'blows': { notes: blows },
};

// ---------- clips ----------
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
// kline paints its night ground (#100e0d, with faint old strokes) every frame: 'clear' keys it to a 19 % grey-brown veil
// over the whole stack (seen in the first previews), 'lighten' only lifts pure black to that night, and the bone bars stay solid
const FULL = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, blend: 'lighten' };
// (critic) the rose window: Klee no longer covers the frame with its umber. The strings' whole mosaic is stretched into
// a tall soft ellipse in the middle, Friar Lawrence's cell window, its tiles drawn out into narrow panes of glass (the
// oval and its feather fade the corners, so the lowest and highest rows show only toward the middle). The web is strung
// across it and everything else (pens, bars, ink) works on black around it. Our default veil again: it is the glass's shimmer, and the blacks it greyed are now outside the window.
const ROSE = { mode: 'window', shape: 'ellipse', x: 0.5, y: 0.5, w: 0.62, h: 1, feather: 0.3, fit: 'stretch', blend: 'lighten' };
const KLEE = {};
const SKY = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1.45, h: 1.45, feather: 0, fit: 'contain' };
const clips = [
  // the ground: the strings' mosaic all through; its rows' width and memory are set per note (no curve: below 1 it drops notes)
  { id: 'ground-a', start: 0, end: HUSH + 0.35, track: 0, fade: 0.35, widget: 'klee', listen: 'picks:ground', knobs: KLEE, region: ROSE },
  // the hush: everything went out at the sudden pp; one thin line of tiles for the held B5, the B4 under it
  { id: 'ground-hush', start: HUSH, end: 71.4, track: 1, fade: 0.35, widget: 'klee', listen: 'picks:hush', knobs: { veil: 0 }, region: ROSE },   // no veil: stillness; it starts as ground-a goes, so klee's umber ground never blinks
  // the long build starts the mosaic again from black and lets it climb
  { id: 'ground-b', start: 70.9, end: END, track: 0, fade: 1, widget: 'klee', listen: 'picks:ground', knobs: KLEE, region: ROSE },
  // fate: soot ink with a gold rim, from the first low stroke
  { id: 'fate', start: 3.2, end: END, track: 2, fade: 0.5, widget: 'rorschach', listen: 'picks:fate', knobs: { ink: 2 } },
  // the Friar: the horns' web at its own size; out at the sudden pp
  { id: 'friar-horns', start: 16.8, end: HUSH + 0.3, track: 3, fade: 0.3, widget: 'fifths', listen: 'picks:friar-horns', knobs: { decay: 30 } },
  // the hush and the build's horns: a thread in an empty circle, then the build's chorale
  { id: 'friar-hush', start: 61.2, end: CLIMAX + 0.4, track: 3, fade: 1, widget: 'fifths', listen: 'picks:friar-hush', knobs: { decay: 30 } },
  // the trumpets: the web 1.45x, its rim past the picture's top and bottom, lit cords and glowing shapes (line 1.8, fill 0.5:
  // the chorale blares); then one ray, the hammered F#
  { id: 'friar-trumpets', start: 99.2, end: RECAP + 0.25, track: 4, fade: 0.25, widget: 'fifths', listen: 'picks:friar-trumpets',
    knobs: { decay: 30, fill: 0.5, line: 1.8 }, region: SKY },
  // the feud's pens: out at the sudden pp; back when the strings run again in the build
  { id: 'feud-a', start: 0, end: HUSH + 0.3, track: 5, fade: 0.3, widget: 'scribble', listen: 'picks:feud', intensityMoves: 'present',
    intensity: iv([[0, 0.35], [10, 0.7], [21.5, 0.9], [22.5, 0.3], [33, 0.3], [34.5, 0.7], [HUSH - 0.2, 1]]) },
  { id: 'feud-b', start: 83.5, end: END, track: 5, fade: 1, widget: 'scribble', listen: 'picks:feud', intensityMoves: 'present',
    intensity: iv([[83.5, 0.2], [CLIMAX, 0.6], [99.6, 0.45], [HAMMER, 0.45], [HAMMER + 0.1, 0.35], [BREATH, 0.35], [BREATH + 0.6, 0.2], [LAST_F - 0.05, 0.2], [RECAP, 0.85], [156, 0.85], [END, 0.25]]) },
  // the swords: bone bars on a see-through night
  { id: 'swords', start: 21.42, end: SWORDS_OUT, track: 6, fade: 0.05, widget: 'kline', listen: 'picks:clashes', region: FULL },
  // the last F#: one bar on a cold canvas, then the feud's swords again
  { id: 'swords-last', start: 134.72, end: END, track: 6, fade: 0.05, widget: 'kline', listen: 'picks:clashes', region: FULL },
  // the wash: every ff blow drags the wet paint under it
  { id: 'wash', start: 99.3, end: 152.5, track: 7, fade: 0.3, widget: 'pixelsort', listen: 'picks:blows', knobs: { own: 0 } },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 4. The clash · B "Ink and wash": the Friar\'s chorale as Fifths\' web, the horns\' fragments at its own size, the trumpets\' ff chorale (from the audio) 1.45 times larger, past the picture, then crushed to one hammered F# ray; the feud as Scribble\'s red-scratched pens; the sword clashes as Kline\'s bone bars; the strings as Klee\'s mosaic; fate as Rorschach\'s soot ink rising from omens to a flood; Pixel sort washing the paint on the real ff blows',
  composer: { by: 'claude', at: '2026-11-06T21:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
if (process.argv.includes('--chords')) {
  for (const a of attacks(trumpetChords)) console.log(a[0][0].toFixed(2), a.map((n) => n[2]).join(' '));
  console.log('hammers', hammerT.map((h) => `${h.t.toFixed(2)}/${h.s}`).join(' '));
}
const live = (t) => clips.filter((c) => c.start <= t && t < c.end);
console.log('from clips | ' + Object.keys(picks).join(' '));
for (let a = 0; a < 160; a += 10) {
  const counts = Object.keys(picks).map((k) => attacks(picks[k].notes).filter((x) => x[0][0] >= a && x[0][0] < a + 10).length);
  console.log(`${String(a).padStart(3)} ${live(a + 5).length} | ${counts.join(' ')}`);
}
console.log(`${ID}: ${clips.length} clips; ` + Object.entries(picks).map(([k, v]) => `${k} ${v.notes.length}`).join(', ') + `; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
