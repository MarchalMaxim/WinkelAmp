// Builds shows/romeo-juliet-1-friar-a-milk-and-thorn.json: cycle A "Milk and thorn" on the introduction (Friar Laurence).
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-1-friar/build-romeo-juliet-1-friar-a-milk-and-thorn.mjs
//
// The cycle's mapping (the same in all six packs): the Friar's chorale and the winds -> handover (milky slabs); the
// strings -> crimp; the harp -> pluck; fate / timpani / low strokes -> squares-snap (small, red); the ground -> fields.
//
// The idea of this piece: ONE crimp clip is the whole string section, and it tells the introduction's story by itself.
// Each note carries its own slack: where the strings are calm (the eerie high violins, the hushes, the aftermath) the
// lines stay dead straight, a few bone-to-brick hairlines; as the strings grow anguished (the sighing descent, the climb,
// the tremolo build) every note leaves them woollier, up to a dense red pelt in the climax; a hush chord yanks them
// straight again. The field is born from the cellos (36.7 s), flushes at the low sforzando (62 s), warms with the
// loudness, and is cut dead with everything else at the climax's cut-off (293.0 s), when only the last fate square sinks
// in black. Then one cold plum field and the last straight string lines.
//
// Critic's revision (2026-11-06): Horizon (a cold sea, our defaults) is now the ground of the stillness at 36-95, 164-199,
// 223-259 and 296-325 s; the field is born on the F minor chord (92.68), where the sea burns away, and stays dark oxblood in
// the climax. Where the plan below says slate field (36.7-68) or plum field (aftermath), read the sea.
//
// Plan (pack seconds; sections from ANALYSIS.md):
//   0-36.7     the chorale ALONE: milky slabs on pure black, the top voice, one at a time (a deliberate spare entrance)
//   36.7-48    low strings rise: the slate field rises out of black on the cellos' onsets (low-swell)
//   48-62      the high violins: straight hairlines high up; the field sinks to a breath
//   62-68.6    the bass sforzando: no new mark (it is a swell, not a blow): the field flushes warm with it
//   68.6-92.7  the sighing descent: the strings' lines fray note by note (slack 1.6 -> 6.2), the field swells
//   92.7-99.3  the F minor chord: a pelt across the registers; the violin flourish lays wool up the screen
//   99.3-127   the hushed Db chord yanks the strings straight; harp plucks (bell touch: it rings); the winds' two slabs
//   127-165    the pizzicato walks on a floor band (pluck in a stretched small copy, marcato: dry); the chorale returns as
//              slab pairs (top voice + bassoon bass); the first red bells, small, on the low strokes under it
//   165-198.4  the high violins return: straight hairlines again; two low strokes at 192
//   198.4-225  the chorale in C major, the largest slabs; the strings climb and fray a little; the harp's flourish
//   225-257    the antiphonal hush: the winds' chords as slabs, the strings' chords as straight lines, the dim field
//   257-276    the tremolo build: wool in waves, following the loudness at each note
//   276-293.0  the climax: dense wool low; the violins' held B5 as a second crimp that never frays (straight bone
//              lines over the wool); red squares on the ff blows; the field at full and warm (home follows +level)
//   293.0      the cut-off: every clip ends with a hard cut; the last blow's square is large and sinks for 3 s alone
//   296-325.6  aftermath and hush: one cold plum field breathing on the low roll; the falling held string notes and
//              the last B4 over D2 as straight, ever thinner lines
//
// What the previews showed (3 rounds): at their own pp velocities the chorale slabs were small grey tiles, so each
// statement carries size and intensity (1.7/2 alone at the start, 1.4 and 1.45 later); the climax wool showed only a few
// strips (the tremolo has ~6 pitches), so every string note and the chord blocks there join it; a field warmed to burnt
// orange swallowed the wool and the bone lines (crimp draws `lighten`), so the warming stops at oxblood; the bell touch
// made the harp too faint, so it has the nocturne a5 pluck knobs. The cut at 293.0 with the last square sinking alone
// worked from the first render.
//
// Weight table (rough clip intensity; f fields, h handover, b handover-bass, c crimp, p pluck, z pizz-pluck, s squares):
//   0-30 h1 | 30-60 h1 f.4 c1 | 60-90 f.4-.7 c1 | 90-120 f.85-.3 c1 p1 h1 | 120-150 f.35 z1 h1 b1 s1 p1 |
//   150-180 f.45 z1 h1 b1 s1 c1 | 180-210 f.4 c1 s h1 b1 | 210-240 f.7-.4 c1 h1 b1 p1 | 240-270 f.4-.6 c1 h1 |
//   270-293 f1 c1 cB5 s1 | 293-296 s(last) | 296-325 f.35 c1
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-1-friar-a-milk-and-thorn', SONG = 'romeo-juliet-1-friar';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const ev = JSON.parse(readFileSync(join(HERE, 'audio-events.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const set = (id) => { const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`); return s.notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const lerp = (a, b, k) => a + (b - a) * clamp(k, 0, 1);
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const sortN = (ns) => ns.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
/** Notes deduplicated: one per pitch per attack (within 40 ms). */
const dedupe = (ns) => {
  const out = [];
  for (const n of sortN([...ns])) if (!out.some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.04)) out.push(n);
  return out;
};
/** Group notes into attacks (a note joins when it starts < 40 ms after the attack's first). */
const attacks = (ns) => {
  const out = [];
  for (const n of sortN([...ns])) {
    const l = out[out.length - 1];
    if (l && n[0] - l[0][0] < 0.04) l.push(n); else out.push([n]);
  }
  return out;
};
const dbAt = (t) => ev.curve[clamp(Math.round(t * 10), 0, ev.curve.length - 1)][0];
const tracks = (names, a, b) => names.flatMap((k) => within(pack.tracks[k].notes, a, b).map((n) => [n[0], n[1], n[2], n[3]]));
const STRINGS = ['violin', 'viola', 'cello', 'strings'], WINDS = ['oboe', 'clarinet', 'bassoon'];

// ---------- strings: ONE crimp thread for the whole section, each note carrying how frayed it is ----------
const CALM = { slack: 1, fibres: 5, reach: 1.2, stays: 3 };          // straight hairlines (also the clip's own knobs)
const calm = (ns, k = {}) => ns.map((n) => withValues(n, { ...CALM, ...k }));
const strings = [];
// the eerie high violins, 48-61.4
strings.push(...calm(within(set('high-violins'), 47, 62)));
// the sighing descent: frays note by note as the strings sink and swell (69.9 -> 92.2)
strings.push(...within(set('sighing-descent'), 69, 93).map((n) => {
  const k = (n[0] - 69.9) / (92.2 - 69.9);
  return withValues(n, { slack: r3(lerp(1.6, 6.2, k)), fibres: Math.round(lerp(6, 15, k)), reach: r3(lerp(0.9, 1.25, k)), stays: r3(lerp(2.2, 1.6, k)) });
}));
// the F minor chord and the violins' flourish: a full pelt
strings.push(...set('f-minor-swell').filter((n) => n[0] < 99).map((n) => withValues(n, { slack: 6.5, fibres: 21, reach: 1.4, stays: n[0] < 93 ? 3 : 1.4 })));
// the hushed Db chord at 99.31 yanks every line straight
strings.push(...calm(tracks(STRINGS, 99, 99.5)));
// the high violins return, with the low strings' held notes before them (165-198.4)
strings.push(...calm(dedupe([...tracks(STRINGS, 165, 198.4), ...within(set('high-violins'), 165, 198.4)])));
// the strings climb under the C major chorale (212-221): anguish comes back for a moment
strings.push(...tracks(STRINGS, 211.9, 221.5).map((n) => {
  const k = (n[0] - 212) / 9;
  return withValues(n, { slack: r3(lerp(2.4, 5, k)), fibres: Math.round(lerp(7, 13, k)), reach: 1.2, stays: 1.8 });
}));
// the antiphonal hush: the strings' chords, straight
// with the audio's hole cover there (chords traded between winds and strings, 9 transcribed attacks in 32 s)
strings.push(...calm(dedupe([...tracks(STRINGS, 225, 257.1), ...within(set('hush-chords'), 225, 257.1)])));
// the tremolo build: wool in waves, following the loudness at each note (-45 dB straight-ish, -30 dB wool)
strings.push(...tracks(STRINGS, 257.1, 276.4).map((n) => {
  const k = (dbAt(n[0] + 0.15) + 46) / 16;
  return withValues(n, { slack: r3(lerp(2, 6, k)), fibres: Math.round(lerp(8, 17, k)), reach: r3(lerp(1.1, 1.35, k)), stays: 1.6 });
}));
// the climax: the tremolo, minus the violins' held B5 (their own straight crimp, below)
const B5 = 83;
// (the tremolo set, plus every string note and the outer voices of the chord blocks there, so the wool fills the screen)
strings.push(...dedupe([...set('tremolo'), ...tracks(STRINGS, 276.4, 293), ...within(set('chord-blocks'), 276.4, 293)])
  .filter((n) => n[2] < B5).map((n) => withValues(n, { slack: 6.5, fibres: 21, reach: 1.4, stays: 1.5 })));
// the aftermath and the hush before the feud: straight, ever thinner lines
strings.push(...tracks(STRINGS, 296, 325.6).map((n) => {
  const k = (n[0] - 297) / 25;
  return withValues(n, { slack: 1, fibres: Math.round(lerp(6, 3, k)), reach: r3(lerp(1.15, 0.8, k)), stays: 3 });
}));
const stringsSet = sortN(dedupe(strings));

// the violins' held B5 in the climax: straight bone lines that never fray over the wool
const heldB5 = dedupe([...within(set('high-violins'), 275, 293), ...set('tremolo').filter((n) => n[2] >= B5)]);

// ---------- the Friar: the chorale's top voice and the winds (handover, milky). Size grows with each statement ----------
const friar = [
  ...within(set('friar-chorale'), 0, 36).map((n) => withValues(n, { size: 1.7, intensity: 2 })),
  ...tracks(['clarinet', 'bassoon'], 112, 121).map((n) => withValues(n, { size: 1.2, intensity: 1.8 })),
  ...within(set('friar-chorale'), 139, 162).map((n) => withValues(n, { size: 1.4, intensity: 1.4 })),
  ...within(set('friar-chorale'), 198, 213).map((n) => withValues(n, { size: 1.45, intensity: 1.5 })),
  // the winds' chords in the antiphonal hush and the build (oboe, clarinet, bassoon), whole chords
  ...tracks(WINDS, 225, 276).filter((n) => n[1] - n[0] >= 0.28).map((n) => withValues(n, { size: 1.3, intensity: 1.6 })),
];
const friarSet = sortN(dedupe(friar));
// the chorale's bass (the bassoon's bottom voice), in the second and third statements: a second slab under the first
const friarBass = attacks(within(set('friar-chorale-chords'), 139, 213)).map((a) => {
  const lo = a.reduce((b, n) => (n[2] < b[2] ? n : b));
  return withValues([lo[0], lo[1], lo[2], lo[3]], { size: 1.05, intensity: 1.3 });
});

// ---------- fate: small red squares on the low strokes and the climax's ff blows; the last blow alone, large ----------
const lastBlow = 292.99;
const fate = sortN(dedupe([
  ...set('low-strokes'),
  ...within(set('hush-chords'), 191.9, 192.7),            // the two low strokes at 192 (from the audio)
  ...set('ff-blows').filter((n) => n[0] < lastBlow + 0.05).map((n) => withValues(n, { size: 1.05 })),  // 293.11 is the same cut-off blow heard twice: dropped
])).map((n) => (Math.abs(n[0] - lastBlow) < 0.03 ? withValues(n, { size: 1.9, life: 3, intensity: 1.6 }) : n));

// ---------- the ground: the low swell, the bass line and the audio's hole cover, lighting the field from inside ----------
// Per-note colour: slate (home -0.85) except where the music warms it (critic: the field is now born on the F minor chord;
// the sforzando at 62 is the sea's, which goes starker with the loudness). The bass sforzando's A1 strokes (61.9-63.5)
// pull it toward oxblood (it glides with a 4 s half-life, so it is a flush, not a flash); from the tremolo build on, each
// bass note warms it further, to oxblood at the climax (no further: the wool and the bone lines are drawn `lighten`, so a
// bright orange field swallowed them in the first preview), until the cut-off kills it.
const ground = sortN(dedupe([...within(set('bass-line'), 86, 293), ...within(set('hush-chords'), 165, 258)]))
  .map((n) => {
    // (critic, round 1: the old warming to home 0 with chords and dyn free turned the climax into mustard, orange and
    // teal bands that swallowed the wool; now it stops at dark oxblood, its colour frozen, the notes barely lighting it)
    if (n[0] >= 262) { const k = (n[0] - 262) / (284 - 262); return withValues(n, { home: r3(lerp(-0.7, -0.45, k)), chords: 0, back: r3(lerp(0.8, 0.9, k)), dyn: r3(lerp(0.6, 0.3, k)) }); }
    if (n[0] >= 99 && n[0] < 139) return withValues(n, { back: 0.45 });   // the hushed Db chord and the harp: a deep painting, not black
    return n;
  });
const groundAfter = sortN(dedupe([...within(set('bass-line'), 295.6, 326), ...within(set('hush-chords'), 295.6, 326)]));

// ---------- the sea (critic's addition): Horizon as the picture of the eerie stillness ----------
// Crimp cannot hold a long note (its strips dim out within `stays`), so the ppp held violin notes and the slow traded
// chords left only a dim field. Horizon holds: a still grey sea whose line glints on each note. It is the cold ground of
// the eerie and hushed passages (the cellos' swell and the high violins, their return, the antiphonal hush, the
// aftermath); the warm field is the ground of the anguish. Glints land on the notes one hears there; the low notes
// lower the line a little, the loudness (the sforzando at 62) makes it starker.
const STILL = { intensity: 1.5 };
const sea = sortN(dedupe([
  ...set('low-swell'), ...within(set('bass-line'), 34, 72), ...within(set('high-violins'), 47, 62),
  ...within(set('sighing-descent'), 68, 92.6),
  ...within(set('high-violins'), 165, 198.4), ...within(set('hush-chords'), 165, 198.4), ...tracks(STRINGS, 165, 198.4),
  ...within(set('hush-chords'), 225, 257.2), ...tracks([...STRINGS, ...WINDS], 225, 257.2),
  ...groundAfter, ...tracks(STRINGS, 296, 325.6),
])).map((n) => withValues(n, STILL));

const picks = {
  'friar': { notes: friarSet },
  'friar-bass': { notes: friarBass },
  'strings': { notes: stringsSet },
  'held-b5': { notes: heldB5 },
  'harp': { notes: set('harp') },
  'pizzicato': { notes: set('pizzicato-walk').map((n) => withValues(n, { intensity: 1.8 })) },
  'fate': { notes: fate },
  'ground': { notes: ground },
  'sea': { notes: sea },
};

// ---------- clips ----------
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
const CUT = 293.0;
const clips = [
  // the cold sea (critic's addition): Horizon under the eerie and hushed passages, our defaults; four appearances, each
  // rising out of black or out of the warm field and giving way to it again. The cellos' swell raises it out of the
  // black after the chorale; the sighing descent frays its wool over the sea; the F minor chord burns the sea away into the field.
  ...[
    [36.2, 95.5, [[36.2, 0], [38, 0.2, 'ease'], [46, 0.7], [61.6, 0.7], [62.6, 0.85], [68.6, 0.75], [90, 0.7, 'ease'], [93.2, 0.12], [95.5, 0]]],
    [163.5, 199.5, [[163.5, 0, 'ease'], [168, 0.7], [196.5, 0.7, 'ease'], [199.5, 0]]],
    [223, 259.5, [[223, 0, 'ease'], [227.5, 0.7], [255, 0.7, 'ease'], [259.5, 0]]],
    [295.6, 325.6, [[295.6, 0, 'ease'], [300, 0.6], [314, 0.55], [325.6, 0.25]]],
  ].map(([a, b, pts], i) => ({ id: `h${'abcd'[i]}`, start: a, end: b, track: 0, fade: 0.5, widget: 'horizon', listen: 'picks:sea', intensity: iv(pts) })),
  // the warm ground of the anguish: it floods in on the F minor chord (92.68), where the sea burns away; it warms with the loudness, steps aside for
  // the sea, dark oxblood (and held back) in the climax so the wool and the bone lines blaze over it, cut dead at 293.0
  { id: 'c1', start: 86, end: CUT, track: 1, fade: 0, widget: 'fields', listen: 'picks:ground',
    knobs: { home: { base: -0.85, drive: '' }, chords: 0.12, back: 0.7, dyn: 0.8 },
    intensity: iv([[86, 0, 'ease'], [92.4, 0.3], [93, 1], [98.5, 0.75], [104, 0.65], [127, 0.62], [139, 0.6],
      [148, 0.72], [162, 0.62], [164, 0.5, 'ease'], [168.5, 0], [195.5, 0, 'ease'], [200, 0.62], [205, 0.65], [221, 0.75],
      [223, 0.65, 'ease'], [227.5, 0], [255, 0, 'ease'], [259.5, 0.62], [275, 0.7], [281, 0.8]]) },
  // the pizzicato walk on a floor band: pluck drawn alone and pressed into the lower half (a small copy, stretched)
  { id: 'c3', start: 126.8, end: 166.5, track: 2, fade: 0.5, widget: 'pluck', listen: 'picks:pizzicato',
    knobs: { touch: 1, pull: 2, ring: 1.4 },
    region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.73, w: 1, h: 0.54, feather: 0.1, fit: 'stretch', blend: 'lighten' } },
  // the strings: one thread for the whole piece, straight when calm, wool when anguished (per-note slack)
  { id: 'c4', start: 47.5, end: CUT, track: 3, fade: 0, widget: 'crimp', listen: 'picks:strings', knobs: { ...CALM } },
  { id: 'c5', start: 296.5, end: 325.6, track: 3, fade: 1.5, widget: 'crimp', listen: 'picks:strings', knobs: { ...CALM } },
  // the violins' held B5 over the climax's wool: never frays
  { id: 'c6', start: 275.5, end: CUT, track: 4, fade: 0, widget: 'crimp', listen: 'picks:held-b5',
    knobs: { slack: 1, fibres: 7, reach: 1.4, stays: 3 } },
  // the chorale's bass, second and third statements
  ...[[139.2, 162.5], [198.6, 214]].map(([a, b], i) => (
    { id: `c7${'ab'[i]}`, start: a, end: b, track: 5, fade: 0.4, widget: 'handover', listen: 'picks:friar-bass', knobs: { goneBy: 2.5, ring: 1.3 } })),
  // the Friar: the chorale and the winds, milky slabs (spare and alone at the start). Handover is stateless, so the
  // clips are cut to where the Friar's winds play
  ...[[1.6, 36], [112.4, 122], [139.2, 162.5], [198.6, 214], [224.8, 245], [262.9, 266]].map(([a, b], i) => (
    { id: `c8${'abcdef'[i]}`, start: a, end: b, track: 6, fade: 0.4, widget: 'handover', listen: 'picks:friar', knobs: { goneBy: 2.5, ring: 1.3 } })),
  // the harp: plucked hairlines (the knobs the user loved on the nocturne's arpeggios, a5: pull 1.6, ring 1.2)
  ...[[105.3, 128], [222.8, 227.5]].map(([a, b], i) => (
    { id: `c9${'ab'[i]}`, start: a, end: b, track: 7, fade: 0.4, widget: 'pluck', listen: 'picks:harp', knobs: { touch: 2, pull: 1.6, ring: 1.2 } })),
  // fate: small, calm red squares; the last blow of the climax large, sinking alone after the cut-off
  ...[[138, 165], [191.5, 195], [278.8, 297]].map(([a, b], i) => (
    { id: `c10${'abc'[i]}`, start: a, end: b, track: 8, fade: 0.8, widget: 'squares-snap', listen: 'picks:fate',
      knobs: { size: 0.7, life: 1, blur: 0.6, shake: 0 } })),
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 1. Friar Laurence · A "Milk and thorn": Handover\'s milky slabs on the Friar\'s chorale and winds, alone at first; one Crimp thread for the strings that frays from straight hairlines to red wool and heals; Pluck on the harp and on a pizzicato floor; small red Snap squares on the fate strokes; a cold Horizon sea under the eerie violins and the hushes, a warm field under the anguish, cut dead at the climax',
  composer: { by: 'claude', at: '2026-11-06T18:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${ID}: ${clips.length} clips; ` + Object.entries(picks).map(([k, v]) => `${k} ${v.notes.length}`).join(', ') + `; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
