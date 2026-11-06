// Builds shows/romeo-juliet-6-coda-b-ink-and-wash.json: cycle B "Ink and wash" on the coda (funeral march, consoling
// chorale, the love theme transfigured, the hammered closing chords).
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-6-coda/build-romeo-juliet-6-coda-b-ink-and-wash.mjs
//
// The cycle's mapping (as cast, the same in every B piece): fate / timpani / ff blows -> rorschach (soot ink with a gold
// rim, `ink` 2, as in the friar); the Friar's chorale and its descendants -> fifths (`decay` 30, as in the friar); the
// love theme -> duet; the harp -> mandala (the friar's harp); the ground here -> horizon.
//
// THE IDEA. The Prince's last lines: "A glooming peace this morning with it brings; / The sun, for sorrow, will not show
// his head." The whole coda is ONE night turning into a grey dawn over Sugimoto's sea (a single horizon clip, its
// presence rising from a black night sea to a full grey morning), and everything else is drawn ON THAT LINE:
//   - Fate's ink is a Rorschach turned on its side: a full-screen small copy rotated 90 degrees, so the blot's fold lies
//     exactly on the horizon (the horizon is pinned at mid-height, `level` 0.5). Each timpani stroke drops ink on the
//     horizon and the fold mirrors it down into the sea: a blot and its reflection. 37 strokes, a funeral cortege of
//     reflected ink along the shore. The ink is the cycle's soot-and-gold; in the window its soot body turns into a
//     translucent sepia wash (the window's see-through keys black to alpha): literally ink and wash.
//   - The broken love theme is Duet in the sky: two liquids in the cycle's own pair (vermilion and cobalt, `pair` 0, as
//     in love B and return B) that reach for each other and are thrown apart (per note: pull 0.55, push 1.9).
//   - Through the chorale the lovers are gone (they come back on the first love note at 102.38).
//   - The consoling chorale is the harmonic web as the sun that will not show its head: the web is centred on the
//     horizon and seen ONLY above it (a mask over the sky), a half-risen web of bone and rose cords; under the line a second web on the
//     same notes shows dimly through the water (0.4). "Dimmer" than in the friar: only half of it is ever above the line,
//     and the dawn has not come yet. Knobs: line 2.2, fill 0.5 (the chorale's soft chords were hairlines otherwise).
//   - The love theme transfigured: the two liquids return, pressed together now (per note: pull 2, push 0.25, and the
//     split raised to 84 so the high violin line moves both). The harp's arpeggios take over the water: a mandala on the
//     same centre, seen only below the horizon, the sun's reflection breaking into lace while the web above sinks.
//   - The roll and the hammered closing chords: the ink comes back, flung (spatter 3, big blots) along the line, the
//     sea stark with the ff. At the last blow (158.66) every drop on the page turns pale bone at once (the friar ended its
//     fate the same way): a pale funeral flower mirrored on the line, the glooming peace. Everything is cut dead with the
//     orchestra at 166.0. Then black.
//
// Found in the previews (three rounds):
//   - The rotated Rorschach works better than hoped: the gold rims and tentacles mirrored across the line read as a
//     cortege of reflected shapes on a shore, and the 1.78x enlargement of the small copy suits the march's slow strokes.
//     But its see-through keys every dried trace back up to a visible stain, so the ink is two clips (the march, faded
//     out in the breath; the roll to the end) instead of one: one clip left yellow ghosts over the whole chorale.
//   - The web lightens onto the stage, so on a grey dawn sky it vanished. The dawn therefore waits for the music's own
//     crescendo (101.5-126); the chorale, the quietest music of the coda, stays night, and the web glows there.
//   - The harp's mandala, seen only below the line, reads as a white funeral wreath floating under the lovers.
//   - At 158.66 the bone ink becomes a pale flower mirrored on the horizon, filling most of the screen for 7 s: the
//     last image, cut dead with the orchestra.
//   - The hammered blots dry in 2.8 s (per note), so each of the 8 bursts lands as a fresh splash, not a sepia murk.
//
// Review (critic, 2026-11-06), what changed and why:
//   - The hammered chords were a brown murk: the window's see-through turned every soot body into a translucent veil
//     stacked over the whole frame. The closing ink is now blended 'lighten' (only what is brighter than the picture
//     shows), and the dawn sky darkens again under the roll and the blows (presence 0.8 -> 0.4, 140.4-143): fate takes
//     the morning back. Over the dark grey only the gold rims, tentacles and specks survive, crisp and mirrored on the
//     line; at the last blow the sky brightens (158.66-160.3) under the bone flower, the only ink paler than the dawn.
//     (With the sky at full brightness lighten kept the ink only in the dark water: striking, but the mirror was lost.)
//   - The duet takes the cycle's pair 0 (it separates from the gold ink, and the love theme looks the same in every B
//     piece), size 0.95 in a soft ellipse window (feather 0.3): the masses were cut by the window's edges.
//   - The lovers' 0.28 ghosts through the chorale were two still blurred discs over the web: removed.
//   - The chorale web keeps line 2.2 and fill 0.5 (the default hairlines vanish on the night sky), shiver 0.2: calm.
//   - The night sea under the march is a little more present (0.1-0.16), so the line reads from the first stroke.
//
// Plan (pack seconds):
//   0-1.7      black
//   1.7-47.4   night sea (horizon presence ~0.1) | reflected ink on the 37 timpani strokes | duet in the sky on the broken
//              love theme (7.85-43)
//   46-49.7    the breath: the ink dries on the night sea; the lovers fade out
//   49.7-101.5 still night, barely paling (presence 0.12 -> 0.27 with the chorale's swell 73-83: the chorale is the
//              quietest music of the coda, and the web lightens onto the stage, so it needs a dark sky); the half-sun web
//              over the line, its dim twin under it; the lovers faint and still in the sky
//   101.5-126  the dawn comes with the transfiguration's crescendo (presence 0.22 -> 1)
//   101.5-141  the lovers back, together; the mandala in the water on the harp; the sea brightens with the crescendo
//   140.4-143  the roll: small blots growing on the line
//   143-158.6  the hammered chords: big flung blots, a stark sea
//   158.66-166 bone ink, the flower on the line; hard cut at 166.0
//   166-180.1  black
//
// Weight table (rough clip intensity / presence per 30 s; H horizon, R rorschach, D duet, F web (sky), f web (water),
// M mandala):
//   0-30 H.08 R1 D1 | 30-47 H.1 R1->0 D1 | 47-60 H.12-.2 F1 f.4 D.28 | 60-90 H.2-.27 F1 f.4 D.28 | 90-102 H.22 F1 f.4->0 D.28 |
//   102-130 H.22->1 D1 M.5->1 F1->.5 | 130-141 H.9 D1 M.8 F.3 | 141-158 H1 R1 | 158.7-166 H1 R(bone) | 166- black
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-6-coda-b-ink-and-wash', SONG = 'romeo-juliet-6-coda';
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
  for (const n of sortN([...ns])) {
    const l = out[out.length - 1];
    if (l && n[0] - l[0][0] < 0.04) l.push(n); else out.push([n]);
  }
  return out;
};
const tracks = (names, a, b) => names.flatMap((k) => within(pack.tracks[k].notes, a, b).map((n) => [n[0], n[1], n[2], n[3]]));
const packNotes = (a, b) => within(pack.notes.map((n) => [n[0], n[1], n[2], n[3]]), a, b);
const CUT = 166.0, LAST = 158.66;

// ---------- fate (rorschach): one set, one clip, the whole coda ----------
const FV = (size, fade, spatter, k = {}) => ({ size: r3(size), fade: r3(fade), spatter: r3(spatter), ...k });
const timpani = set('funeral-timpani');
const march = timpani.map((n, i) => {
  // the cortege: blots that stay ~6 s (five or six on the line at once), the first stroke larger, the last six dying away
  const fromEnd = timpani.length - 1 - i;
  let size = lerp(0.75, 1.0, i / 12) * (0.9 + 0.2 * (n[3] - 87) / 35);
  if (i === 0) size = 1.15;
  if (fromEnd < 6) size *= lerp(0.45, 1, fromEnd / 6);
  return withValues(n, FV(size, 6.5, 0.3, i === 0 ? { intensity: 1.3 } : {}));
});
// the roll before the end, from the audio's onsets (strength rising 0.08 -> 0.8): B2, small blots growing on the line
const roll = ev.onsets.filter((o) => o[0] >= 140.4 && o[0] < 142.9).map((o) => {
  const v = Math.round(clamp(20 + 2.4 * (o[2] + 60), 15, 122)), k = (o[0] - 140.4) / 2.5;
  return withValues([r3(o[0]), r3(o[0] + 0.15), 47, v], FV(lerp(0.35, 0.9, k * k), 4, 0.5));
});
// the hammered chords: the ff-blows set (the audio's strokes) plus the full B major chords the pack hears in the bursts,
// so the chords are full enough to splatter (rorschach splatters on loud attacks of 3+ notes)
const chordsAt = attacks(packNotes(142.9, LAST - 0.03)).filter((a) => a.length >= 4).flat();
// (the small copy enlarges the ink 1.78x: sizes here are smaller than the friar's for the same blot)
const hammer = sortN(dedupe([...set('ff-blows').filter((n) => n[0] < LAST - 0.03), ...chordsAt])).map((n) => {
  const k = (n[0] - 142.9) / (LAST - 142.9);
  return withValues(n, FV(lerp(0.75, 1.05, k), 2.8, 3, n[3] < 112 ? { intensity: 1.35 } : {}));
});
// the last blow: the largest blot, and every drop on the page turns bone (ink is read every frame)
const BONE = { ink: 5 };
const lastBlow = sortN(dedupe([...set('ff-blows').filter((n) => Math.abs(n[0] - LAST) < 0.03), ...packNotes(LAST - 0.03, LAST + 0.04)]))
  .map((n) => withValues(n, FV(1.25, 13, 3, { ...BONE, intensity: 1.5 })));
const fateMarch = march;
const fateEnd = sortN(dedupe([...roll, ...hammer, ...lastBlow]));

// ---------- the love theme (duet): broken over the march, reunited in the transfiguration ----------
const BROKEN = { pull: 0.55, push: 1.9, split: 60 };
const TOGETHER = { pull: 2, push: 0.25, split: 84 };
const love = [
  ...set('broken-love').map((n) => withValues(n, BROKEN)),
  ...within(set('love-theme'), 100, 142).map((n) => withValues(n, TOGETHER)),
];

// ---------- the chorale (fifths): the wind chords with their real lengths plus the outer voices ----------
const WINDS = ['horn', 'oboe', 'clarinet', 'bassoon'];
// (the pack's notes there too: the chorale is the whole texture then, and full chords string polygons, not hairlines)
const chorale = sortN(dedupe([...tracks(WINDS, 47.5, 102.5), ...set('coda-chorale-chords'), ...packNotes(47.5, 101.8)]));
// (tried in review: the water's web on the strings alone, the sky's on the winds alone. The winds and strings strike
// on the same downbeats, so it only thinned both webs and the water's became stray arcs: reverted to one set.)

// ---------- the ground (horizon): everything the pack hears, the timpani and the blows from the audio ----------
const ground = sortN(dedupe([...packNotes(0, CUT), ...timpani, ...set('ff-blows'), ...set('last-chord')]));

const harp = set('harp');

const picks = {
  'fate-march': { notes: fateMarch },
  'fate-end': { notes: fateEnd },
  'love': { notes: sortN(love) },
  'chorale': { notes: chorale },
  'harp': { notes: harp },
  'ground': { notes: ground },
};

// ---------- clips ----------
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
const SKY = { mode: 'spot', shape: 'rect', x: 0.5, y: 0.25, w: 1.02, h: 0.5, feather: 0.06 };
const SEA = { mode: 'spot', shape: 'rect', x: 0.5, y: 0.75, w: 1.02, h: 0.5, feather: 0.06 };
// the ink's small copy: the stage turned on its side (9:16 box rotated 90 degrees fills 16:9), fold on the horizon
const ON_ITS_SIDE = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.5625, h: 1.7778, rot: 90, feather: 0, fit: 'cover' };
// the lovers' small copy: the whole duet stage at half size, high in the sky (two small moons); its lower edge is the
// horizon, so a mass that sinks low sets into the sea's line instead of fading through a wide feather
const LOVERS = { mode: 'window', shape: 'ellipse', x: 0.5, y: 0.26, w: 0.56, h: 0.5, feather: 0.3, fit: 'contain' };

const clips = [
  // the sea: one night turning into a grey morning; the horizon pinned at mid-height (the ink's fold and the sun's centre)
  { id: 'sea', start: 1.5, end: CUT, track: 0, fade: 0, widget: 'horizon', listen: 'picks:ground',
    knobs: { level: { base: 0.5, drive: '', depth: 0 } }, intensityMoves: 'present',
    intensity: iv([[1.5, 0.1], [45, 0.16], [49.6, 0.14], [60, 0.2, 'ease'], [73, 0.24], [80, 0.27], [86, 0.2], [101.5, 0.22, 'ease'],
      [126, 1], [131, 0.85], [140.4, 0.8, 'ease'], [143, 0.4], [LAST, 0.4, 'ease'], [LAST + 1.6, 1]]) },
  // the chorale's web: the half-risen sun over the line, and its dim twin under the water
  // (line 2.2 and fill 0.5: on a grey sky the web's default hairlines vanish; the sun needs cords and lit faces)
  { id: 'sun', start: 49.4, end: 141.5, track: 3, fade: 1.5, widget: 'fifths', listen: 'picks:chorale',
    knobs: { decay: 30, line: 2.2, fill: 0.5, shiver: 0.2 },
    region: SKY, intensity: iv([[49.4, 1], [102, 1], [125, 0.55], [141.5, 0.25]]) },
  { id: 'sun-in-water', start: 49.4, end: 104, track: 1, fade: 1.5, widget: 'fifths', listen: 'picks:chorale',
    knobs: { decay: 30, line: 2.2, fill: 0.5, shiver: 0.2 },
    region: SEA, intensity: iv([[49.4, 0.4], [101.5, 0.4], [104, 0]]) },
  // the harp: lace in the water where the web's reflection was (size 1.25, mirrors 2.4: lace that fills the water)
  { id: 'harp-in-water', start: 102.0, end: 141.2, track: 2, fade: 1, widget: 'mandala', listen: 'picks:harp', region: SEA,
    knobs: { size: 1.25, mirrors: 2.4 },
    intensity: iv([[102, 0.5], [114, 0.75, 'ease'], [126, 1], [131, 0.8], [140.2, 0.6]]) },
  // fate: reflected ink on the horizon. The march's cortege, which dries away in the breath (the small copy's
  // see-through would otherwise keep the dry ink's last traces as stains through the chorale) ...
  { id: 'ink-march', start: 1.5, end: 50, track: 4, fade: 0, widget: 'rorschach', listen: 'picks:fate-march', knobs: { ink: 2 },
    region: ON_ITS_SIDE, intensity: iv([[1.5, 1], [46.5, 1], [50, 0, 'ease']]) },
  // ... and the roll, the hammered chords and the last blow, cut dead with the orchestra
  { id: 'ink-end', start: 140.2, end: CUT, track: 4, fade: 0, widget: 'rorschach', listen: 'picks:fate-end', knobs: { ink: 2 },
    region: { ...ON_ITS_SIDE, blend: 'lighten' } },
  // the lovers in the sky: broken over the march, gone through the chorale, together in the transfiguration
  { id: 'lovers', start: 7.6, end: 142, track: 5, fade: 0.3, widget: 'duet', listen: 'picks:love', knobs: { size: 0.95 },
    region: LOVERS,
    intensity: iv([[7.6, 1], [44, 1], [48.5, 0, 'ease'], [102.38, 0], [103.2, 1, 'ease'], [139.5, 1], [141.8, 0]]) },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 6. Coda · B "Ink and wash": one night turning to a grey dawn on Horizon\'s sea; fate as Rorschach ink turned on its side, every timpani stroke a blot mirrored into the water; the broken love theme as Duet\'s gold and teal liquids in the sky, thrown apart, then pressed together; the chorale as Fifths\' web, a sun that will not show its head; the harp as Mandala\'s lace in the water; the closing chords fling the ink, the last blow turns it to a bone flower on the line; cut dead',
  composer: { by: 'claude', at: '2026-11-06T22:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${ID}: ${clips.length} clips; ` + Object.entries(picks).map(([k, v]) => `${k} ${v.notes.length}`).join(', ') + `; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
