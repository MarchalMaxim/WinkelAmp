// Builds shows/danse-macabre-c-night-page.json: show C "Night page" on Saint-Saëns' Danse macabre.
// Run from the worktree root: node_modules/.bin/tsx docs/compositions/classical/danse-macabre/build-danse-macabre-c-night-page.mjs
//
// One idea: the dance writes its own score on a night page. Graphic score (paper 0: chalk on black) hears every note and is
// the ground the whole night. Each strand writes on it in its own hand:
//   squares    <- the bass: Death's pizzicato, the waltz's oom, the tutti bass, the fugato subject, the A toll, the finale
//   brush      <- Death's fiddle: the solo violin (tuning, theme B) and the violins' tune in the tutti; one red slash only,
//                 on the G minor downbeat that starts the dance
//   stella     <- the bones: the twelve strokes of midnight (a mourning border closing in), the tritone, the rattling
//                 hammered chords, the xylophone, the E toll, the fugal voices piling in, the drum rolls, the last blows
//   pixelsort  <- the wounds: the few real heavy strikes, the brass, one slow melt per phrase of the Dies irae chorale,
//                 the break, the ff blows and the nine last blows
// Three gestures beyond the stack:
//   - 248-272.5, the woodwind interlude: the tutti breaks off (two melts) and the page itself goes out; two small night
//     pages float in the dark instead, one for the woodwinds and one for the strings, each framed by its own Stella, so the
//     dialogue is seen as fragments passing from page to page.
//   - 377-383.7, cock-crow: the night page fades with the decaying sound and a bone-paper page (score, paper 1) comes up
//     under it; the rooster's four notes are the first black ink of the day, its held G5 a long beam.
//   - Dawn to the end: the farewell, the flight and the last pizzicato are written in black ink on that day page, and
//     Stella's frames come back dark on paper for the scurry and the last chords: the mourning border of midnight, inverted.
// Found in the previews: Stella is the surprise of this stack. Its 'difference' frames are a mourning border at midnight
// (bone on black), an iris on the chromatic ascent, a pile on the fugato's entries, and dark on the day page, the same
// widget answering the bones in both lights. Brush's dried ink never fully leaves (8-bit alpha), so one long clip silts
// the page into grey smoke: it is one clip per passage instead.
// Heard loudness:the roll's velocities are flat (30-60 almost everywhere), so each strand's notes are scaled (per-note
// intensity) towards the recording's own loudness at that moment (pack.loudness), keeping their accents.
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'danse-macabre-c-night-page', SONG = 'danse-macabre';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const r2 = (v) => Math.round(v * 100) / 100;

/** A set's notes in [a, b), bare [start, end, midi, velocity], optionally filtered. */
const take = (id, a = -1, b = 1e9, f = () => true) => {
  const s = P[id]; if (!s) throw new Error(`no set ${id}`);
  return s.notes.filter((n) => n[0] >= a && n[0] < b && f(n)).map((n) => [n[0], n[1], n[2], n[3]]);
};
/** Linear interpolation over [[t, v], ...]. */
const curve = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, a] = pts[i - 1], [t1, b] = pts[i]; return a + (b - a) * (t - t0) / (t1 - t0); }
  return pts[pts.length - 1][1];
};
// The recording's loudness (0..0.95, every 0.1 s): the peak just after an attack.
const LV = pack.loudness.values, HOP = pack.loudness.hop;
const loudAt = (t) => { let m = 0; for (let i = Math.floor((t - 0.05) / HOP); i <= Math.ceil((t + 0.25) / HOP); i++) if (i >= 0 && i < LV.length) m = Math.max(m, LV[i]); return m; };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1] ?? 60; };

/** A strand: notes plus how loud they are heard and which knob values they carry.
    boost: 'loud' scales towards the recording's loudness (45 + 80 x loudness, kept between lo and hi times the set's
    median), a number is a fixed intensity. vals: an object or a function of the note. */
const strand = (notes, { boost = 'loud', lo = 0.7, hi = 2, vals = {} } = {}) => {
  const med = median(notes.map((n) => n[3]));
  return notes.map((n) => {
    const k = boost === 'loud' ? clamp((45 + 80 * loudAt(n[0])) / med, lo, hi) : boost;
    const v = typeof vals === 'function' ? vals(n) : vals;
    return [n[0], n[1], n[2], n[3], { intensity: r2(clamp(k, 0, 2)), ...v }];
  });
};
/** One clip's set: strands merged, sorted, one note per (pitch, 30 ms), stored in canonical form. */
const merge = (...strands) => {
  const all = strands.flat().sort((a, b) => a[0] - b[0] || a[2] - b[2]), out = [];
  for (const n of all) if (!out.some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.03)) out.push(n);
  return out.map((n) => {
    const v = { ...n[4] };
    for (const k of Object.keys(v)) if (k !== 'intensity') v[k] = r3(v[k]);
    return withValues([n[0], n[1], n[2], n[3]], v);
  });
};
const span = (set) => [set[0][0], set[set.length - 1][0]];

// ---------------------------------------------------------------- squares: the bass
// Defaults size 1, life 1.4, blur 1. Death's first slabs are slow and big; the toll small and calm; the development's
// D/C# pedal (mostly bowed) slow and blurred so it glows rather than strikes; the finale heavy and shaking.
const sqA = merge(
  strand(take('grave-pizz'), { boost: 2, vals: { size: 1.3, life: 1.8, blur: 1.2 } }),
  strand(take('pizz-waltz-bass'), { lo: 1.2, vals: { size: 0.9, life: 1.2 } }),
  // the first tutti's bass, but not under legato theme B (86.4-100.6: no audible strike there)
  strand(take('bass-tutti-1', 71.5, 86.4), { lo: 1, vals: { size: 1.1, life: 1.2 } }),
  strand(take('bass-tutti-1', 100.6, 118.1), { lo: 1, vals: { size: 1, life: 1.1 } }),
  // the octave D blow that closes the exposition: one big slab
  strand(take('exposition-close', 118.1, 118.6, (n) => n[2] < 50), { boost: 1, vals: { size: 1.7, life: 2.2, shake: 1.4 } }),
  // the fugato subject, F-E-Eb-D in the cellos: slabs that walk down by semitones
  strand(take('fugato-subject-low'), { lo: 1, vals: { size: 0.9, life: 2, blur: 1.4 } }),
  // the A toll, crescendo: small calm tiles growing with it
  strand(take('pedal-a-toll'), { lo: 1, vals: (n) => ({ size: r2(curve([[162.5, 0.55], [175.4, 1.25]])(n[0])), life: 0.9, blur: 1.3 }) }),
  strand(take('bass-tutti-2'), { lo: 1, vals: { size: 1.1, life: 1.2 } }),
);
const sqB = merge(
  strand(take('bass-development'), { lo: 1, vals: { size: 1.2, life: 2.4, blur: 2.2, shake: 0.4 } }),
  strand(take('bass-finale'), { lo: 1, vals: { size: 1.3, life: 1.3, shake: 1.5 } }),
);

// ---------------------------------------------------------------- brush: Death's fiddle
// gestures 0 everywhere (the red slashes are attack marks) except on the G minor downbeat that starts the dance.
// One clip per passage: brush's dried ink never quite leaves (8-bit alpha sticks at a few percent), so over minutes it
// silts into grey smoke. A new clip clears its layer; stay is kept at 5-7 (default 8), 9 in the chorale.
const quiet = { gestures: 0 };
const BR = {
  'br-tuning': merge(
    // scordatura: the A-Eb tritones and the open D-A fifths, one rocking stroke, dry and scratchy
    strand([...take('tuning-tritone'), ...take('tuning-fifths')], { boost: 1.8, vals: { ...quiet, size: 0.9, dryness: 0.55, leap: 9, stay: 5 } }),
    strand(take('dance-begins', 26.3, 26.5), { boost: 1, vals: { gestures: 1, size: 1.2, dryness: 0.4, leap: 5, stay: 6 } }),
  ),
  // theme B on the solo violin: the sighing chromatic descent
  'br-solo': merge(strand(take('theme-b-solo-violin'), { boost: 1.7, vals: { ...quiet, size: 1.3, dryness: 0.3, leap: 9, stay: 6 } })),
  'br-tutti': merge(
    strand(take('build-to-tutti'), { lo: 1, vals: { ...quiet, size: 1, dryness: 0.5, leap: 7, stay: 5 } }),
    strand(take('theme-a-tutti'), { lo: 1, vals: { ...quiet, size: 1.5, dryness: 0.4, leap: 5, stay: 5 } }),
  ),
  'br-tutti-b': merge(
    // theme B in all the strings, legato forte: wet and broad
    strand(take('theme-b-tutti'), { lo: 1, vals: { ...quiet, size: 2, dryness: 0.12, leap: 7, stay: 7 } }),
    strand(take('theme-a-xylophone-d'), { lo: 1, vals: { ...quiet, size: 1.3, dryness: 0.4, leap: 5, stay: 5 } }),
  ),
  'br-pedals': merge(strand(take('pedal-line-high'), { lo: 1, vals: { ...quiet, size: 1.1, dryness: 0.45, leap: 5, stay: 5 } })),
  // the chorale (the Dies irae): slow, wet bone strokes that stay
  'br-chorale': merge(strand(take('chorale-top'), { lo: 1.2, vals: { ...quiet, size: 1.6, dryness: 0.1, leap: 6, stay: 9 } })),
  'br-tutti-c': merge(strand(take('tutti-c-line'), { lo: 1, vals: { ...quiet, size: 1.4, dryness: 0.4, leap: 5, stay: 5 } })),
  'br-build': merge(
    strand(take('development-line'), { lo: 1, vals: { ...quiet, size: 1, dryness: 0.4, leap: 5, stay: 5 } }),
    // the long build: the stroke broadens and wets as it grows to ff
    strand(take('build-line'), { lo: 1, vals: (n) => ({ ...quiet, size: r2(curve([[297, 1], [320, 2.1]])(n[0])), dryness: 0.25, leap: 5, stay: 6 }) }),
    // the chromatic ascent: one climbing stroke
    strand(take('chromatic-ascent'), { lo: 1, vals: { ...quiet, size: 1.6, dryness: 0.3, leap: 14, stay: 6 } }),
  ),
  'br-recap': merge(
    strand([...take('recap-high'), ...take('recap-line')], { lo: 1, vals: { ...quiet, size: 1.8, dryness: 0.35, leap: 6, stay: 6 } }),
    strand(take('frenzy-line'), { lo: 1, vals: { ...quiet, size: 2.1, dryness: 0.6, leap: 6, stay: 5 } }),
  ),
};
// The dance's own tune, theme A (the flute's waltz, then a fifth up in the high strings and winds), in a second hand: a
// thin dry pen that leaps with every note, written under the staff (the lower half), below Death's fat bone brush. Without it the dance proper was page and slabs.
const BR_WALTZ = merge(
  strand(take('theme-a-flute'), { boost: 1.5, vals: { ...quiet, size: 0.85, dryness: 0.65, leap: 13, stay: 4 } }),
  strand(take('theme-a-in-d', 55, 67.6), { boost: 1.4, vals: { ...quiet, size: 0.9, dryness: 0.6, leap: 13, stay: 4 } }),
);
// [set, start, end, fade]: each clip starts a little before its first note and ends after its ink has had time to dry
const BR_CLIPS = [['br-tuning', 17, 33, 1.5], ['br-solo', 40.3, 58, 1.2], ['br-tutti', 67.6, 86, 0.6], ['br-tutti-b', 86, 116.5, 0.3],
  ['br-pedals', 148.8, 175.2, 0.6], ['br-chorale', 175.2, 213.5, 0.5], ['br-tutti-c', 222.6, 247.5, 1.2], ['br-build', 272.2, 323.8, 0.4],
  ['br-recap', 323.8, 378.6, 0.3]];

// ---------------------------------------------------------------- stella: the bones
// Its frames pile only when attacks come faster than 1/life, so life is the knob that tells the story: long at midnight
// (the twelve strokes close in as a border), short in the rattles, long in the fugato (the voices accumulate).
const stA = merge(
  // midnight: twelve frames stepping in from the edge, a mourning border counted out
  strand(take('clock-strokes'), { boost: 2, vals: { thick: 7, life: 5, reach: 1 } }),
  // the devil's interval inverts the page, quickening
  strand(take('tuning-tritone'), { boost: 1.7, vals: { thick: 4, life: 1.6, reach: 0.7 } }),
  strand(take('build-to-tutti'), { lo: 1, vals: { thick: 4, life: 1.2, reach: 0.6 } }),
  // the bones rattling: hammered sixteenth chords
  strand(take('hammered-chords-80'), { lo: 1.2, vals: { thick: 3, life: 0.9, reach: 1 } }),
  strand([...take('repeated-d-chords'), ...take('xylophone-bones', 100, 120)], { lo: 1, vals: { thick: 2.5, life: 0.8, reach: 0.8 } }),
  strand(take('exposition-close', 115, 118.1), { lo: 1, vals: { thick: 3, life: 1, reach: 0.7 } }),
  // the fugato's voices entering one after another (the subject below, the answers above): they pile deeper as they accumulate
  strand([...take('fugato-high'), ...take('fugato-subject-low')], { lo: 1, vals: (n) => ({ thick: r2(curve([[125, 3], [148, 5.5]])(n[0])), life: r2(curve([[125, 2.5], [148, 4]])(n[0])), reach: r2(curve([[125, 0.3], [148, 1]])(n[0])) }) }),
  // the E toll: lone frames, a pale bell (the A toll turns red, on the squares)
  strand(take('pedal-e-toll'), { lo: 1, vals: { thick: 3, life: 1.4, reach: 0.5 } }),
  strand(take('build-213'), { lo: 1, vals: { thick: 2.5, life: 0.7, reach: 0.9 } }),
  strand(take('xylophone-bones', 230, 240), { lo: 1, vals: { thick: 3, life: 0.8, reach: 0.9 } }),
);
const stB = merge(
  strand(take('repeated-d-303'), { lo: 1, vals: { thick: 3, life: 0.9, reach: 0.9 } }),
  // the chromatic ascent: an iris of thickening frames closing on the recapitulation
  strand(take('chromatic-ascent'), { lo: 1, vals: (n) => ({ thick: r2(curve([[320.4, 3], [322.9, 9]])(n[0])), life: 3, reach: 1 }) }),
  // the drums: rolls pile frames
  strand(take('drum-strikes', 320), { lo: 1, vals: { thick: 5, life: 1, reach: 0.9 } }),
  strand(take('octave-hammer-g'), { lo: 1, vals: { thick: 4, life: 0.8, reach: 1 } }),
  // the nine last blows, growing to 0 dB: thickening frames closing in
  strand(take('final-hammer'), { boost: 1, vals: (n) => ({ thick: r2(curve([[374.89, 4], [376.8, 11]])(n[0])), life: 2.2, reach: 1 }) }),
  // day: dark frames on the bone page, the mourning border inverted
  strand(take('dawn-tremolo'), { boost: 1.3, vals: { thick: 3, life: 1.2, reach: 0.6 } }),
  strand([...take('last-trill'), ...take('scurry')], { boost: 2, vals: { thick: 2.5, life: 0.9, reach: 1 } }),
  strand(take('final-pizz'), { boost: 2, vals: (n) => ({ thick: n[0] > 426 ? 8 : 5, life: n[0] > 426 ? 5 : 2.2, reach: 0.5 }) }),
);

// ---------------------------------------------------------------- pixelsort: the wounds
// own 0.3 (the combo's suggestion: rust, not its amber); the chorale's melts have no colour of their own and hang long.
const chorBass = take('chorale-bass');
const chorPhrases = ['chorale-p1', 'chorale-p2', 'chorale-p3', 'chorale-p4'].map((id) => P[id].notes[0][0]);
const chorMelts = chorPhrases.map((t) => chorBass.reduce((b, n) => (Math.abs(n[0] - t) < Math.abs(b[0] - t) ? n : b)));
const heavy = { own: 0.3 };
const pxA = merge(
  strand(take('dance-begins', 26.3, 26.5), { boost: 1, vals: { ...heavy, len: 0.9, life: 1.3 } }),
  strand(take('ff-blows-early', 100, 130), { boost: 1, vals: { ...heavy, len: 1.1, life: 1.6 } }),
  strand(take('brass-calls', 140, 177), { lo: 1, vals: { ...heavy, len: 1, life: 1.2 } }),
  // the Dies irae: the page dragged down, one slow melt per phrase of the chorale
  strand(chorMelts, { boost: 2, vals: { own: 0, len: 1.6, life: 3, band: 2.2 } }),
  strand(take('brass-calls', 225, 235), { lo: 1, vals: { ...heavy, len: 1, life: 1.2 } }),
  strand(take('ff-blows-early', 230, 243), { boost: 1, vals: { ...heavy, len: 1.2, life: 1.4 } }),
  // the tutti breaks off: the page tears, then goes out
  strand(take('stop-244'), { boost: 1, vals: { ...heavy, len: 1.4, life: 2.2, band: 1.4 } }),
);
const pxB = merge(
  strand(take('ff-blows'), { boost: 1.1, vals: { ...heavy, len: 1.3, life: 1.6, band: 1.3 } }),
  strand(take('brass-calls', 338, 346), { lo: 1, vals: { ...heavy, len: 1, life: 1 } }),
  strand(take('final-hammer'), { boost: 1, vals: (n) => ({ ...heavy, len: r2(curve([[374.89, 1], [376.8, 1.6]])(n[0])), life: 1.6, band: r2(curve([[374.89, 1], [376.8, 2.2]])(n[0])) }) }),
);

// ---------------------------------------------------------------- the Dies irae cross
// The chorale's top line and its slow bass, written a second time on a page turned on its end: a column of chalk falling
// down the middle of the screen. Its staff line stands upright across the night page's own: a cross, for exactly as long
// as the Dies irae sounds. Heavy, ornate chalk, so each long note is a beam down the shaft.
const cross = merge(
  strand(take('chorale-top'), { boost: 1.7 }),
  strand(take('chorale-bass'), { boost: 1.5 }),
);

// ---------------------------------------------------------------- the day page
const day = merge(
  strand(take('cock-crow'), { boost: 1 }),
  strand(take('dawn-chords'), { boost: 1.6 }),
  strand(take('dawn-tremolo'), { boost: 1.2 }),
  strand(take('farewell-violin'), { boost: 1.8 }),
  strand([...take('last-trill'), ...take('scurry')], { boost: 2 }),
  strand(take('final-pizz'), { boost: 1.8 }),
);

const picks = {
  'sq-a': { notes: sqA }, 'sq-b': { notes: sqB }, ...Object.fromEntries(Object.entries(BR).map(([k, n]) => [k, { notes: n }])),
  'st-a': { notes: stA }, 'st-b': { notes: stB }, 'px-a': { notes: pxA }, 'px-b': { notes: pxB }, 'day-page': { notes: day },
  'br-waltz': { notes: BR_WALTZ }, 'dies-irae': { notes: cross },
};
for (const [k, s] of Object.entries(picks)) console.log(`${k}: ${s.notes.length} notes, ${span(s.notes).map((t) => t.toFixed(2)).join('-')} s`);

// ---------------------------------------------------------------- clips
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
const NIGHT = { paper: 0 };
// The two small pages of the interlude: tilted leaves of the same night paper, see-through where they are black.
const leaf = (x, y, rot) => ({ mode: 'window', shape: 'rect', x, y, w: 0.46, h: 0.46, rot, feather: 0.03, fit: 'contain', blend: 'clear' });
// the waltz pen writes under the staff, squeezed into the lower half like the words under a song
const UNDER = { mode: 'window', shape: 'rect', x: 0.5, y: 0.8, w: 1, h: 0.56, feather: 0.06, fit: 'stretch', blend: 'lighten' };
const CROSS = { mode: 'window', shape: 'rect', x: 0.5, y: 0.64, w: 0.84, h: 0.62, rot: -90, feather: 0.02, fit: 'stretch', blend: 'lighten' };
const WINDS = leaf(0.29, 0.33, -3), STRINGS = leaf(0.71, 0.67, 2.5);
const clips = [
  // the day page: comes up under the night page as the rooster crows, fades with the last chord
  { id: 'day', start: 378.6, end: 429.8, track: 0, fade: 3, widget: 'score', listen: 'picks:day-page' },
  // the night page: every note in chalk. It goes out for the interlude (the leaves take over) and at cock-crow
  { id: 'night', start: 0, end: 383.9, track: 1, fade: 0.3, widget: 'score', knobs: NIGHT,
    intensity: iv([[0, 1], [246.3, 1, 'ease'], [248.3, 0], [271.6, 0, 'ease'], [273.2, 1], [376.9, 1, 'ease'], [383.66, 0]]) },
  // the Dies irae cross: the chorale written down a page stood on its end, the shaft of a cross whose bar is the night
  // page's own staff line. It comes with the chorale's first note and goes as the build breaks in
  { id: 'dies-irae', start: 175.4, end: 214, track: 2, fade: 2, widget: 'score', listen: 'picks:dies-irae',
    knobs: { paper: 0, weight: 2.4, figures: 1, ink: 4, speed: 30 }, region: CROSS },
  { id: 'sq-a', start: 13.2, end: 247, track: 3, fade: 0.3, widget: 'squares', listen: 'picks:sq-a' },
  { id: 'sq-b', start: 274.6, end: 377.8, track: 3, fade: 0.5, widget: 'squares', listen: 'picks:sq-b' },
  ...BR_CLIPS.map(([set, start, end, fade]) => ({ id: set, start, end, track: 4, fade, widget: 'brush', listen: `picks:${set}` })),
  // the waltz pen: theme A's tune, in the flute and then a fifth up
  { id: 'br-waltz', start: 26.2, end: 42.2, track: 5, fade: 0.8, widget: 'brush', listen: 'picks:br-waltz', region: UNDER },
  { id: 'br-waltz-d', start: 55.4, end: 68.6, track: 5, fade: 0.8, widget: 'brush', listen: 'picks:br-waltz', region: UNDER },
  { id: 'px-a', start: 25.8, end: 247.8, track: 6, fade: 0.3, widget: 'pixelsort', listen: 'picks:px-a' },
  { id: 'px-b', start: 312.8, end: 378.2, track: 6, fade: 0.3, widget: 'pixelsort', listen: 'picks:px-b' },
  { id: 'st-a', start: 0, end: 247.7, track: 7, fade: 0.1, widget: 'stella', listen: 'picks:st-a' },
  { id: 'st-b', start: 302.6, end: 429.8, track: 7, fade: 0.3, widget: 'stella', listen: 'picks:st-b' },
  // the interlude's leaves: the woodwinds' page and the strings' page, each framed by its own instrument's attacks
  { id: 'leaf-winds', start: 247.9, end: 273, track: 8, fade: 1.2, widget: 'score', listen: 'family:winds', knobs: NIGHT, region: WINDS },
  { id: 'leaf-strings', start: 247.9, end: 273, track: 9, fade: 1.2, widget: 'score', listen: 'family:strings', knobs: NIGHT, region: STRINGS },
  { id: 'frame-winds', start: 247.9, end: 273, track: 10, fade: 1.2, widget: 'stella', listen: 'family:winds', knobs: { life: 2, thick: 3, reach: 0.35 }, region: WINDS },
  { id: 'frame-strings', start: 247.9, end: 273, track: 11, fade: 1.2, widget: 'stella', listen: 'family:strings', knobs: { life: 2, thick: 3, reach: 0.35 }, region: STRINGS },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Danse macabre · C "Night page": the dance writes its own score in chalk on a night page (Graphic score, paper 0); Dread squares on the bass, Calligraphy on Death\'s fiddle, Stella frames on the bones, Pixel sort on the heavy blows; the page splits into two leaves for the woodwinds and turns to day at cock-crow',
  composer: { by: 'claude', at: new Date().toISOString() }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${ID}: ${clips.length} clips; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
