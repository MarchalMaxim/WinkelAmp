// Builds shows/romeo-juliet-3-love-b-ink-and-wash.json: cycle B "Ink and wash" on the love theme.
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-3-love/build-romeo-juliet-3-love-b-ink-and-wash.mjs
//
// The cycle's mapping (the same in all six packs):
//   duet     <- the love theme (quick, cobalt) and the bass under it (thick, vermilion): the harmony judges them
//   brush    <- the sighs: the muted strings' rocking figures, one bone stroke per phrase
//   mandala  <- the harp
//   horizon  <- the ground: the grey night sea
//
// The story, by section (ANALYSIS.md, romeo-juliet-3-love):
//   0-20     Night pedal (A, pp, -50 dB). Total stillness: only the night sea, dark (horizon at a low presence), its
//            line high, so the picture is mostly black water. Nothing glints: the pedal is too soft to.
//   20.2     The Ab3 into D-flat: the two drops appear, small (duet at a low presence).
//   21.6-39  The first statement (English horn and violas): the quick drop follows the theme, the thick one the bass;
//            consonant against the bass they lean together, a chromatic step (C-C#-Eb over F#2) throws them apart.
//            The bass strokes (`low-pulse`) breathe light into the haze over the sea: a heartbeat.
//   39.2     The harp: a mandala blooms behind the two drops, a halo of lace round them (mirrors 2.6: more copies per
//            note, so a soft arpeggio still makes lace; size 1.2 so its rings reach past the two masses).
//   41-87    The sighs: bone strokes rock across the night (brush on the sighs, then on the violas' rocking inner voice
//            under the woodwinds' theme 72-87). Brush `gestures` 0.15: the sighs are ink only, no red slashes: the
//            red is kept for one gesture.
//   72-110   The theme returns and climbs (G, E, A). Serendipity: each modulation lowers the horizon a step (horizon
//            `level` set per note on its own set), so the sky grows under the lovers and they rise out of the sea into it;
//            the sea's presence (its curve) lights the night towards a pale sky; the duet grows (its curve moves how
//            present). The horns' countermelody (87-170) hangs a gold wreath of petals round them: an addition to the
//            cycle's mapping, this pack only (the harp stays the mandala's; the horns are its gold).
//   110-150  The full-string climax: the two liquids lie together: every note of the set carries pull 2 and
//            push 0.2, so they are drawn back together after every clash: they strain together rather than rest, as the theme's
//            appoggiaturas over the Ab pedal (half the climax's attacks) are clashes. The sea is at its brightest; the stressed beats (`climax-onsets`)
//            breathe light into the haze.
//   132.42   The single gesture: at the loudest beat of the pack (-26 dB; F#2 under Eb4-Ab4, the turn of the harmony) one
//            red ensō is drawn round the lovers, and dries slowly (its own brush clip, `stay` 12).
//   150-172  Codetta on the Db pedal: the sighs return as bone strokes; the sea sinks back; the thick drop hears the pedal.
//   172-185  Two swells: the thick drop swells on the held A2s; the sea surges with the loudness (its curve).
//   185-217  Balcony night: the harp blooms the mandala once more; the violins' slow falling figure is the last stroke; the
//            lovers part (pull 0 on the night's bass notes: they keep their distance) and shrink; the horizon rises again,
//            the sea goes dark with the Db pedal. 217.6-221: black.
//
// Critic's pass (2026-11-06, after watching the full preview):
//   - The sighs now write on a hanging scroll: the brush in a small copy turned 90 degrees, stretched into a tall strip at
//     the right edge, so each phrase is a top-to-bottom column. Across the sky its dried ink had left grey scribbles over
//     the lovers through the climax; on the scroll the same residue is the letter's earlier lines, and by the balcony
//     night the strip is a written page.
//   - The horns' countermelody has its own mandala (the wreath, set 'wreath'), above the duet with life 7: under the two
//     full masses it was hidden; now gold leaves fall over the lovers through the climb and the climax. The harp keeps
//     the first mandala (the halo, set 'halo', harp only).
//
// Knobs moved from our defaults, and why:
//   duet     split 52 (the theme's lowest notes, Ab3/A3, must move the quick drop and the bass the thick one); size 1.6
//            (the top of the presence curve: full masses at the climax, small drops at its foot); per note: pull 1.4 in
//            the climb, pull 2 + push 0.2 at the climax (they lie together), pull 0 in the balcony night (they part).
//   brush    sighs: gestures 0.15 (ink only, no red), size 3 (the sighs are pp; at the default they were thin scribbles,
//            not calligraphy; and the scroll strip below halves a stroke's breadth). Ensō: gestures 1, stay 12 (it dries through the rest of the climax), dryness 0 and size
//            1.8 (at the default dry brush it ran out of ink after a quarter circle: a claw mark, not an ensō).
//   mandala  halo: mirrors 2.6, size 1.2 (a soft harp arpeggio still makes a halo that reaches past the two masses);
//            wreath: mirrors 2.6, size 1.3, life 7 (the horn lace piles up round and over the lovers).
//   horizon  colour 0.8 (the modulations tint the sky); per note: level (the line sinks with each modulation).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-3-love-b-ink-and-wash', SONG = 'romeo-juliet-3-love';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const set = (id) => { const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`); return s.notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const track = (id) => pack.tracks[id].notes.map((n) => [n[0], n[1], n[2], n[3]]);
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const byStart = (a, b) => a[0] - b[0] || a[2] - b[2];
/** One copy of a note struck twice at once (same pitch within 50 ms), and a repeat of a pitch still sounding < 0.3 s on. */
const dedupe = (ns) => {
  const out = [];
  for (const n of [...ns].sort(byStart)) if (!out.some((o) => o[2] === n[2] && n[0] - o[0] < 0.3 && (n[0] < o[1] || n[0] - o[0] < 0.05))) out.push(n);
  return out;
};
/** The top note of each attack (notes within 40 ms are one attack). */
const tops = (ns) => {
  const out = [];
  for (const n of [...ns].sort(byStart)) {
    const last = out[out.length - 1];
    if (last && n[0] - last[0] < 0.04) { if (n[2] > last[2]) out[out.length - 1] = n; } else out.push(n);
  }
  return out;
};
const picks = {};

// ---------- Duet: the lovers ----------
// The love theme as one hears it: not a note under a higher theme note already sounding (an inner voice), not a note
// the horns share (that is the countermelody: the mandala's), not the long low pedal notes of the climax (Ab3 134.8 for
// 4.2 s is the pedal, not the tune).
const HORN = set('horn');
const LOVE = dedupe(set('love-theme')).filter((n, i, ns) => {
  if (ns.some((o) => o !== n && o[2] > n[2] && o[0] < n[0] - 0.02 && n[0] < o[1] - 0.05)) return false;
  if (HORN.some((h) => h[2] === n[2] && Math.abs(h[0] - n[0]) < 0.06)) return false;
  return !(n[0] > 110 && n[2] < 60 && n[1] - n[0] > 2);
});
const BASS = set('bass-line');
const SPLIT = 52;   // between the bass (F1-C#3, below D3) and the theme's lowest notes (Ab3, A3): theme -> quick, bass -> thick
const duetNotes = dedupe([
  ...within(set('night-hush'), 20, 21),          // the Ab3 at 20.20: the step into D-flat, the drops' first move
  ...within(LOVE, 21, 153),
  ...within(BASS, 21, 218),
]);
picks['lovers'] = { notes: duetNotes.map((n) => {
  if (n[0] >= 110 && n[0] < 150.5) return withValues(n, { pull: 2, push: 0.2 });    // the climax: they lie together; half its attacks are clashes (the theme's appoggiaturas over the Ab pedal), and push 0.2 keeps those a flinch (preview round 3, without it: flung to opposite corners)
  if (n[0] >= 87 && n[0] < 110) return withValues(n, { pull: 1.4 });                // the climb: drawn closer
  if (n[0] >= 185.5) return withValues(n, { pull: 0 });                              // the balcony night: they part
  return n;
}) };
const quick = duetNotes.filter((n) => n[2] >= SPLIT).length, thick = duetNotes.length - quick;

// ---------- Brush: the sighs ----------
const SIGHS = set('sighs');
const VIOLA_ROCK = tops(within(track('viola'), 72, 87.3));   // the rocking chords' inner voice under the woodwinds' theme
picks['sighs-ink'] = { notes: dedupe([
  ...within(SIGHS, 41, 72),
  ...VIOLA_ROCK,
  ...within(SIGHS, 150, 172.3),
  ...within(set('violins'), 185, 207),            // the balcony night's slow falling figure: the sighs' last breath
]) };
// The single gesture: the loudest beat of the pack, 132.42 s: F#2 (bass), Eb4 (violins), Ab4 (the theme).
const APEX = 132.42;
const enso = dedupe([
  ...set('climax-chords').filter((n) => Math.abs(n[0] - APEX) < 0.03),
  ...set('violins').filter((n) => Math.abs(n[0] - APEX) < 0.03),
]);
if (enso.length < 3) throw new Error(`enso: ${enso.length} notes`);
picks['enso'] = { notes: enso };

// ---------- Mandala: the harp's halo (and the horns' countermelody as gold lace) ----------
picks['halo'] = { notes: dedupe(set('harp')) };
// Critic: the horns' countermelody gets its own mandala instance (the wreath), laid OVER the lovers with long-lived
// lace, so it is seen at last (under the two full masses it was hidden).
picks['wreath'] = { notes: dedupe(within(HORN, 87, 171)) };

// ---------- Horizon: the sea, and where its line sits ----------
// Its notes glint and breathe light into the haze: the A pedal (too soft to glint at the night's presence: stillness),
// the bass strokes as a heartbeat, the climax's stressed beats, the codetta's pedal, the swells, the night.
const seaNotes = dedupe([
  ...within(BASS, 0, 20),
  ...within(set('night-hush'), 0, 21),
  ...within(set('low-pulse'), 21, 152),
  ...set('climax-onsets'),
  ...within(BASS, 150, 218),
  ...within(set('night-hush'), 185, 218),
  ...within(set('low-pulse'), 185, 218),
]);
// The horizon's height per note (0.4 high, mostly sea; 0.6 low, mostly sky): it sinks a step with each modulation of
// the climb, so the sky opens under the lovers, and rises back into night.
const LEVEL = [[0, 0.43], [87.2, 0.47], [92, 0.5], [97.5, 0.53], [104, 0.55], [110, 0.58], [150, 0.5], [172, 0.47], [185.5, 0.43]];
const levelAt = (t) => LEVEL.filter(([a]) => t >= a).pop()[1];
picks['sea'] = { notes: seaNotes.map((n) => withValues(n, { level: levelAt(n[0]) })) };

// ---------- clips ----------
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
const clips = [
  { id: 'sea', start: 0, end: 219.2, track: 0, fade: 2, widget: 'horizon', listen: 'picks:sea', knobs: { colour: 0.8 },
    intensityMoves: 'present',
    // the night lightens as the love grows, is brightest at the climax, surges with the two swells, and goes dark
    intensity: iv([[0, 0.36], [20, 0.36], [21.6, 0.44, 'ease'], [39, 0.45], [72, 0.55], [87.3, 0.65], [110, 0.9, 'ease'],
      [118, 1], [148, 1], [153, 0.72, 'ease'], [171.5, 0.6], [174.5, 0.82, 'ease'], [178.5, 0.58, 'ease'], [182.4, 0.6],
      [184.2, 0.82, 'ease'], [188, 0.5, 'ease'], [205, 0.38], [217.6, 0.08, 'ease']]) },
  { id: 'halo', start: 39.0, end: 197, track: 1, fade: 0.2, widget: 'mandala', listen: 'picks:halo',
    knobs: { mirrors: 2.6, size: 1.2 } },
  { id: 'wreath', start: 86.5, end: 172.3, track: 5, fade: 1.5, widget: 'mandala', listen: 'picks:wreath',
    knobs: { mirrors: 2.6, size: 1.3, life: 7 } },
  { id: 'lovers', start: 20.0, end: 216.8, track: 2, fade: 1.6, widget: 'duet', listen: 'picks:lovers',
    knobs: { split: SPLIT, size: 1.6 }, intensityMoves: 'present',
    // two small drops at first; they grow with the theme to the full masses at the climax, and shrink as they part
    intensity: iv([[20, 0.12], [21.6, 0.18], [39, 0.32, 'ease'], [72, 0.42], [87.3, 0.58, 'ease'], [110, 0.9, 'ease'],
      [116, 1], [149, 1], [154, 0.72, 'ease'], [172, 0.6], [185.5, 0.45, 'ease'], [212, 0.12, 'ease']]) },
  // Critic: the sighs are written on a hanging scroll, not across the sky. The brush draws alone in a small copy turned
  // 90 degrees and stretched into a tall strip at the right edge, so its left-to-right phrases become top-to-bottom
  // columns of writing; the dried ink that never quite clears (the composer's weakness 3) stays as the letter's
  // earlier lines instead of grey scribbles over the lovers' sky. One letter through the whole scene, fading with the
  // last held F.
  { id: 'sighs', start: 38.8, end: 219.2, track: 3, fade: 2, widget: 'brush', listen: 'picks:sighs-ink',
    // size 3 (the top): the strip squashes the stroke's breadth to half, so the full brush reads as a loaded brush again
    knobs: { gestures: 0.15, size: 3 },
    region: { mode: 'window', shape: 'rect', x: 0.84, y: 0.5, w: 0.5625, h: 0.5, rot: 90, feather: 0.12, fit: 'stretch' } },
  { id: 'enso', start: 132.0, end: 150.5, track: 4, fade: 0.2, widget: 'brush', listen: 'picks:enso',
    knobs: { gestures: 1, stay: 12, dryness: 0, size: 1.8 } },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 3. Love theme · B "Ink and wash": Duet\'s two liquids are the lovers (cobalt the love theme, vermilion the bass under it), judged by the harmony and lying together at the climax; bone Calligraphy strokes on the sighs, one red ensō at the apex; a Mandala halo blooms on the harp behind them and takes a gold wreath from the horns; a Horizon night sea whose line sinks with each modulation so the lovers rise into the sky',
  composer: { by: 'claude', at: '2026-11-06T18:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
for (const [k, v] of Object.entries(picks)) console.log(`${k}: ${v.notes.length} notes, ${v.notes[0][0]}-${v.notes[v.notes.length - 1][0]}`);
console.log(`lovers: ${quick} quick (theme), ${thick} thick (bass); enso: ${enso.map((n) => n[2]).join(' ')}`);
console.log(`${ID}: ${clips.length} clips, ${Object.keys(picks).length} sets; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
