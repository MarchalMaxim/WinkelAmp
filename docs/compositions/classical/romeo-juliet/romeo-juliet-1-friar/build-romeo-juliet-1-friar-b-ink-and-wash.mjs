// Builds shows/romeo-juliet-1-friar-b-ink-and-wash.json: cycle B "Ink and wash" on the introduction (Friar Laurence).
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-1-friar/build-romeo-juliet-1-friar-b-ink-and-wash.mjs
//
// The cycle's mapping (the same in all six packs): the Friar's chorale (the winds) -> fifths, the harmonic web; the string
// murmurs and polyphony -> klee, the ground; the harp -> mandala; fate / timpani / low strokes -> rorschach; the sighs ->
// brush. This piece uses fifths, klee, mandala, rorschach, and brush once, on the introduction's own chromatic sigh.
//
// The idea: the story painted in continuous strokes and soaking ink. The Friar's hymn is woven alone on black, a web that
// remembers the whole chorale (decay 30: the harmony of a statement hangs on for half a minute, then sinks). The strings
// lay Klee's mosaic under it, one row per voice, the rows thin while the Friar speaks and broad as the strings take over.
// Fate is ONE rorschach clip from the first omen to the end: a lone sepia blot at the low sforzando (62 s), small omens
// that dry at once under the chorale's return, then the ink soaks in wave by wave through the build and floods the mosaic
// in the climax, where a fold mirrors the whole picture into one blot. At the cut-off (292.87-293.0) everything stops dead
// and the ink turns pale as bone: the imprint of fate drying on black while the low roll sounds, until the strings' hush
// before the feud writes its last thin rows.
//
// Found in the previews (and kept):
// - Fifths and Mandala share one large rose window: each drawn alone and laid see-through over the mosaic at 1.4x. At
//   its own size and with its own lighten, the web's hairlines vanished into Klee's bright tiles; in the window they sit
//   solid on the mosaic and the hymn spans the screen's height. The harp's lace then blooms in the same circle the
//   Friar's web has just sunk out of.
// - Klee only paints what one hears as the strings (the high violins alone, the pizzicato walk, the tracks where the
//   strings carry the polyphony), with per-note row width and paint life. With every string track note and long paint it
//   was a wall of tiles from 45 s to the end: no arc, and the web was lost.
// - The fold, on the ff blows only, turns the climax into one mirrored blot: upright at first, tilted when the bass moves
//   to C#, a fourfold cross on the loudest chords.
// - The cut-off: ink is read every frame, so the last blow's bone ink turns the whole soaked sheet pale at once, over the
//   mosaic as it dies. Afterwards only the five falling low notes dab it; the roll's own onsets laid bright fresh dabs
//   in mirrored pairs that read as eyes, so they were left out.
//
// Plan (pack seconds; sections from ANALYSIS.md):
//   0-36.7     the chorale: fifths ALONE on black, the wind chords as polygons (a deliberate spare entrance)
//   36.7-48    low strings rise: Klee's umber ground fades in under the web; madder rows low down (low-swell)
//   48-62      the high violins: one lemon row high in the dark, long lines that stay (stay 24); the web sinks away
//   61.9       the bass sforzando: the first omen, one sepia blot
//   68.6-92.7  the sighing descent: klee rows step down and swell; brush draws one ink stroke per sigh over them
//   92.68      the F minor tutti: the Friar's web restrung at once (the winds are in it); klee sprays; the violin flourish
//   99.3-127   the harp: mandala's lace at the centre where the web sinks; the clarinet and bassoon answer at 112.9
//   127-165    the pizzicato walk marches as thin klee steps; the chorale returns in the web (139.7); small omens on the
//              low strokes, drying in 2-3 s
//   165-198.4  the high violins again: long lemon rows; two omens at 192
//   198.4-225  the C major chorale (the largest web); the strings climb in broadening rows; the harp's G7 flourish
//   225-257    the antiphonal hush: the winds' chords (225.3, 240.2) string the web, the strings' E minor answers
//              (232.8, 248.6) lay calm rows of mosaic: the trade seen as two techniques
//   257-276    the tremolo build: rows broaden with the loudness; fate's blots grow on the bass in waves
//   276-293    the climax: klee at full, the cellos' tremolo soaking blot after blot; fold mirrors everything from the
//              first ff blow (279.8); the ff blows fling specks and splatter
//   292.87     the cut-off: klee and fold stop dead; the last blow turns all the ink to bone
//   293-306    stillness: the pale blot dries on black; the falling low notes dab it faintly (bone); a stain stays
//   306-325.6  the hush before the feud: a faint, thin klee writes the strings' last notes (B4 over D2)
//
// Weight table (rough presence of each thread per 30 s; F fifths, K klee, B brush, M mandala, R rorschach, X fold):
//   0-30 F1 | 30-60 F.7 K.5 | 60-90 K.7 B1 R(omen) | 90-120 K.8 F1 M1 | 120-150 K1 M.5 F1 R.3 | 150-180 K.8 F.8 R.3 |
//   180-210 K.5 F1 R.2 | 210-240 K.7 F.9 M.4 | 240-270 K.6-.9 F.5 R.5 | 270-293 K1 R1 X1 | 293-306 R.5 (alone) | 306-325 K.3 R.2
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-1-friar-b-ink-and-wash', SONG = 'romeo-juliet-1-friar';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const ev = JSON.parse(readFileSync(join(HERE, 'audio-events.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const set = (id) => { const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`); return s.notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const lerp = (a, b, k) => a + (b - a) * clamp(k, 0, 1);
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const sortN = (ns) => ns.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
/** One note per pitch per attack (within 40 ms); the first kept. */
const dedupe = (ns) => {
  const out = [];
  for (const n of sortN([...ns])) if (!out.some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.04)) out.push(n);
  return out;
};
const dbAt = (t) => ev.curve[clamp(Math.round(t * 10), 0, ev.curve.length - 1)][0];
const tracks = (names, a, b) => names.flatMap((k) => within(pack.tracks[k].notes, a, b).map((n) => [n[0], n[1], n[2], n[3]]));
const STRINGS = ['violin', 'viola', 'cello', 'strings'], WINDS = ['oboe', 'clarinet', 'bassoon'];
const CUT = 292.87;             // the cut-off blow's bass (F#1); the climax stops dead at 293.0

// ---------- the Friar (fifths): the winds' chords with their real lengths (held voices join the polygon by themselves) ----------
const friar = sortN(dedupe([
  ...tracks(WINDS, 0, 36.7), ...within(set('friar-chorale-chords'), 0, 36.7),
  ...set('f-minor-swell').filter((n) => n[0] < 92.8),                  // the tutti F minor chord (winds in it)
  ...tracks(WINDS, 112, 121),                                           // the clarinet and bassoon answer
  ...tracks(WINDS, 139, 162), ...within(set('friar-chorale-chords'), 139, 162),
  ...tracks(WINDS, 198, 213), ...within(set('friar-chorale-chords'), 198, 213),
  // the winds' side of the antiphonal hush; the oboe E4 at 232.78 starts with the strings' E minor answer (232.81) and
  // is heard as part of it, so it is left to the strings
  ...tracks(WINDS, 225, 257.2).filter((n) => !(n[0] > 232.7 && n[0] < 232.9)),
  ...tracks(WINDS, 257.2, 276),                                         // the winds' last line in the build
]));

// ---------- the strings (klee): the notes one hears as the strings; each note says how wide its row is
// (thick, its own mark) and how long the mosaic keeps its paint (stay, the whole picture) ----------
const KV = (thick, stay) => ({ thick: r3(thick), stay: r3(stay) });
// What one hears as the strings, passage by passage: the pick sets where the tracks hold more than one hears (the high
// violins alone, the pizzicato walk), the tracks where the strings carry the polyphony.
const lowBass = (a, b) => within(set('bass-line'), a, b).filter((n) => n[2] < 50);
const strRaw = dedupe([
  ...set('low-swell'), ...lowBass(36.6, 48),
  ...within(set('high-violins'), 47, 62), ...lowBass(48, 69),
  ...tracks(STRINGS, 68.6, 99.2), ...set('sighing-descent'), ...set('f-minor-swell').filter((n) => n[0] > 96),
  ...tracks(STRINGS, 99.2, 127),
  ...set('pizzicato-walk'),
  ...within(set('high-violins'), 165, 198.4), ...within(set('hush-chords'), 165, 198.4),
  ...tracks(STRINGS, 198.4, 257.2), ...within(set('hush-chords'), 225, 258),
  ...tracks(STRINGS, 257.2, 293.0), ...set('tremolo'),
]);
const strVal = (t) => {
  if (t < 48) return KV(1.2, 8);                                        // the low swell
  if (t < 62) return KV(0.9, 10);                                       // the high violins: thin long lines
  if (t < 68.6) return KV(1.6, 6);                                      // the sforzando's bass
  if (t < 92.6) { const k = (t - 68.6) / 24; return KV(lerp(0.9, 2.2, k), lerp(5, 9, k)); }   // the sighing descent swells
  if (t < 99.2) return KV(3, 8);                                        // the F minor chord and the flourish
  if (t < 127) return KV(0.8, 5);                                       // under the harp
  if (t < 165) return KV(0.95, 5);                                     // the pizzicato walk: fine steps, so the web reads
  if (t < 198.4) return KV(0.9, 8);                                     // the high violins return
  if (t < 212) return KV(0.7, 4);                                       // under the C major chorale
  if (t < 225) { const k = (t - 212) / 13; return KV(lerp(1.2, 2.4, k), lerp(6, 9, k)); }   // the strings climb
  if (t < 257.2) return KV(1.0, 5);                                     // the strings' answers in the hush
  if (t < 275.5) { const k = (dbAt(t + 0.15) + 46) / 14; return KV(lerp(1.2, 3.2, k), lerp(6, 10, k)); }   // the build
  return KV(3.8, 8);                                                     // the climax
};
const strings = strRaw.map((n) => withValues(n, strVal(n[0])));
const hushStrings = dedupe([...tracks(STRINGS, 306, 325.6), ...within(set('hush-chords'), 306, 325.6)])
  .map((n) => withValues(n, KV(0.7, 12)));

// ---------- the sigh (brush): the strings' chromatic falling figure and the cellos' answer ----------
const sigh = set('sighing-descent');

// ---------- fate (rorschach): one thread from the first omen to the end. Only notes below MIDI 50 drop blots ----------
const FV = (size, fade, k = {}) => ({ size: r3(size), fade: r3(fade), ...k });
const fate = [];
// the first omen: the low-strings sforzando at 61.9 (+18 dB in 0.4 s; the transcriber's velocity is loudness-guessed, low)
fate.push(withValues(set('bass-line').find((n) => Math.abs(n[0] - 61.9) < 0.02), FV(1.1, 5, { intensity: 2 })));
// small omens under the chorale's return, drying at once
fate.push(...within(set('low-strokes'), 138, 164).map((n) => withValues(n, FV(0.7, 3))));
// the two low strokes at 192 (from the audio; above the split, so they bloom as a thin bass's fallback)
fate.push(...within(set('hush-chords'), 191.9, 192.1).map((n) => withValues(n, FV(0.6, 3))));
// the build: the bass, blots growing wave by wave
fate.push(...within(set('bass-line'), 257, 276.3).filter((n) => n[2] < 50).map((n) => {
  const k = (n[0] - 257) / 19; return withValues(n, FV(lerp(0.7, 1.4, k), lerp(4, 8, k)));
}));
// the climax: the cellos' tremolo (one stroke per ~0.45 s), the low strokes, the ff blows (specks and splatter)
{
  let last = -9;
  for (const n of set('tremolo').filter((q) => q[2] < 50)) {
    if (n[0] - last < 0.45) continue; last = n[0];
    const k = (n[0] - 276.4) / 12.5;
    fate.push(withValues(n, FV(lerp(1.5, 2.0, k), lerp(9, 12, k))));
  }
}
fate.push(...within(set('low-strokes'), 280, CUT - 0.01).map((n) => withValues(n, FV(1.8, 12))));
fate.push(...set('ff-blows').filter((n) => n[0] < CUT - 0.01).map((n) => withValues(n, FV(1.5, 11))));
// the cut-off: the last blow's bass; from here every note carries bone ink (ink is read every frame: the whole sheet turns)
const BONE = { ink: 5 };
fate.push(withValues(set('bass-line').find((n) => Math.abs(n[0] - CUT) < 0.01), FV(2.5, 13, { ...BONE, intensity: 1.4 })));
fate.push(...set('ff-blows').filter((n) => Math.abs(n[0] - 292.989) < 0.01).map((n) => withValues(n, FV(2, 13, BONE))));
// the falling low notes under the roll after the cut (F#1, G2, F#2, E2, D2): small bone dabs; the last one leaves the
// stain drying under the hush (no ink after 306: the roll's own onsets laid bright fresh dabs that read as eyes)
{
  const after = within(set('bass-line'), 293.4, 306).filter((n) => n[2] < 50);
  after.forEach((n, i) => fate.push(withValues(n, FV(0.45, i === after.length - 1 ? 5.5 : 4, BONE))));
}
const fateSet = sortN(dedupe(fate));

// the fold: the climax's ff blows (its line turns with their bass; loud chords fold twice for a beat)
const blows = set('ff-blows').filter((n) => n[0] < CUT);

const picks = {
  'friar': { notes: friar },
  'strings': { notes: sortN(strings) },
  'strings-hush': { notes: sortN(hushStrings) },
  'sigh': { notes: sigh },
  'harp': { notes: set('harp') },
  'fate': { notes: fateSet },
  'blows': { notes: blows },
  'ghost': { notes: within(set('high-violins'), 177, 191) },
};

// ---------- clips ----------
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
const OFF = 293.0;
// The rose window (critic's pass): the Friar's web and the harp's lace are drawn alone and fitted into one round window,
// 1.1x the screen's height (fit cover scales the picture by h: the web's rim and its high-note break-throughs stay inside
// the frame, unlike the first 1.4x rect, which cut off the tonic node on top). Two blends of the same circle:
// - ROSE (see-through): the web lies over the mosaic, where the mosaic is dim (pizzicato, high violins, the build);
// - OCULUS (keeps its black): a dark rose window opens in the wall of glaze when the winds speak and closes when the
//   strings answer. Its intensity curve is the antiphony made visible; the curve is 1 at every Friar note (guarded below),
//   and every opening and closing eases over 1.5 s or more, finishing as the winds enter or the strings answer.
const CIRCLE = { mode: 'window', shape: 'ellipse', x: 0.5, y: 0.5, w: r3(1.1 * 9 / 16), h: 1.1, feather: 0.12, fit: 'cover' };
const ROSE = { ...CIRCLE, blend: 'clear' };
const OCULUS = { ...CIRCLE, blend: 'over' };
// fifths: decay 30 (the web remembers a whole statement), line 1.8 (it reads over the mosaic)
const FK = { decay: 30, line: 1.8 };
const clips = [
  // the strings' mosaic: the umber ground fades in with the cellos, then holds; it stops dead at the cut-off
  { id: 'k1', start: 36.6, end: OFF, track: 0, fade: 0, widget: 'klee', listen: 'picks:strings',
    intensity: iv([[36.6, 0.15], [40, 1]]) },
  // the hush before the feud: a faint, thin mosaic
  { id: 'k2', start: 305.8, end: 325.6, track: 0, fade: 2.5, widget: 'klee', listen: 'picks:strings-hush',
    intensity: iv([[305.8, 0.5], [318, 0.45], [325.6, 0.2]]) },
  // the Friar: a web that remembers each statement for half a minute, in six clips so the circle can change its blend
  // (a clip's region is fixed; each new clip starts with an empty web, so the cuts sit where the old web has sunk).
  // f1 (see-through): the chorale alone on black, then lingering and sinking over the strings' rising mosaic
  { id: 'f1', start: 1.5, end: 64, track: 1, fade: 1.5, widget: 'fifths', listen: 'picks:friar', knobs: FK, region: ROSE },
  // f2 (see-through): the F minor tutti, one magenta cord over the violins' flourish (both choirs strike: no window)
  { id: 'f2', start: 88, end: 103, track: 1, fade: 1.5, widget: 'fifths', listen: 'picks:friar', knobs: FK, region: ROSE },
  // f3 (oculus): the harp opens the dark rose window and its lace blooms inside it; the winds answer in it (112.9,
  // 119.9); it closes as the harp's last ring dies, before the pizzicato walk
  { id: 'f3', start: 103, end: 132, track: 1, fade: 0, widget: 'fifths', listen: 'picks:friar', knobs: FK, region: OCULUS,
    intensity: iv([[103, 0, 'ease'], [105.6, 1], [127.8, 1, 'ease'], [131.5, 0]]) },
  // f4 (see-through): the chorale over the pizzicato walk and the high violins' return; the dim mosaic stays whole
  { id: 'f4', start: 132, end: 196, track: 1, fade: 1, widget: 'fifths', listen: 'picks:friar', knobs: FK, region: ROSE },
  // f5 (oculus): the C major chorale opens the window; the strings' climb closes it; then the antiphonal hush: the winds'
  // C chords (225.3, 240.2) open it, the strings' answers (228.7 and 232.8, then 248.6) close it again
  { id: 'f5', start: 196, end: 247, track: 1, fade: 0, widget: 'fifths', listen: 'picks:friar', knobs: FK, region: OCULUS,
    intensity: iv([[196, 0, 'ease'], [198.9, 1], [213.3, 1, 'ease'], [217.5, 0], [223.2, 0, 'ease'], [225.2, 1],
      [227.4, 1, 'ease'], [229.4, 0], [238.4, 0, 'ease'], [240.1, 1], [241.8, 1, 'ease'], [244.5, 0]]) },
  // f6 (see-through): the winds' last line over the tremolo build, fading before the climax
  { id: 'f6', start: 255, end: 278, track: 1, fade: 1.5, widget: 'fifths', listen: 'picks:friar', knobs: FK, region: ROSE },
  // the sigh: one ink stroke per falling figure
  { id: 'b1', start: 69.3, end: 95, track: 2, fade: 1, widget: 'brush', listen: 'picks:sigh' },
  // the harp: lace at the centre
  ...[[105.3, 131, 1.5], [222.8, 230, 1]].map(([a, b, f], i) => ({ id: `m${i + 1}`, start: a, end: b, track: 3, fade: f, widget: 'mandala', listen: 'picks:harp', region: ROSE })),
  // fate: sepia ink (soot with a gold rim) from the first omen to the end
  { id: 'r1', start: 61.4, end: 325.6, track: 4, fade: 1, widget: 'rorschach', listen: 'picks:fate', knobs: { ink: 2 } },
  // a foreshadow (critic's pass): the eerie high violins (177.7-190.5) fold the dim picture into a ghost mirror at 60%
  // (fold's own quiet-passage strength), its line swivelling with each long note; no seam, nothing flashes. Fate's
  // mirror shows before its ink does; at the climax the same fold comes back at full strength.
  { id: 'x0', start: 177.6, end: 192, track: 5, fade: 1.5, widget: 'fold', listen: 'picks:ghost', knobs: { seam: 0 } },
  // the climax: the whole picture folded into one blot, from the first ff blow to the cut-off
  { id: 'x1', start: 279.8, end: OFF, track: 5, fade: 0, widget: 'fold', listen: 'picks:blows' },
];

// Guard: a curve below 1 drops attacks, so every note a curved clip listens to must meet its curve at 1.
const curveAt = (piv, t) => {
  if (t <= piv[0].t) return piv[0].v;
  for (let i = 1; i < piv.length; i++) if (t <= piv[i].t) return lerp(piv[i - 1].v, piv[i].v, (t - piv[i - 1].t) / (piv[i].t - piv[i - 1].t));
  return piv[piv.length - 1].v;
};
for (const c of clips) {
  if (!c.intensity || c.widget === 'klee') continue;      // klee's curves are a fade-in before its notes and the last hush
  for (const n of picks[c.listen.slice(6)].notes) if (n[0] >= c.start && n[0] < c.end && curveAt(c.intensity, n[0]) < 0.999)
    throw new Error(`${c.id}: note at ${n[0]} meets the curve at ${curveAt(c.intensity, n[0]).toFixed(2)}`);
}

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 1. Friar Laurence · B "Ink and wash": the Friar\'s chorale as Fifths\' harmonic web, alone on black, then in a dark rose window that opens in Klee\'s umber mosaic of the strings whenever the winds speak; Brush on the sighing descent; Mandala\'s lace for the harp inside the window; a ghost Fold on the eerie high violins; fate as one Rorschach of sepia ink from the first omen, flooding the climax under a Fold, turning to bone at the cut-off',
  composer: { by: 'claude', at: '2026-11-06T20:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${ID}: ${clips.length} clips; ` + Object.entries(picks).map(([k, v]) => `${k} ${v.notes.length}`).join(', ') + `; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
