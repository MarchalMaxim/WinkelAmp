// Firebird, Berceuse and Finale, show B: "Orphic fall". The spell as radial grains: Nebula's dust streams between the notes
// of the lullaby, Mandala's lace blooms on the harp, both slow to a frozen jewel in the spell; the hymn's crescendo becomes
// a fall through Tunnel's zoom, which drags everything on screen toward you; fluid fireworks go off on the ff blows.
// Builds shows/firebird-berceuse-finale-b-orphic-fall.json from picks.json (this folder; gen-picks.mjs makes it).
// Run from the worktree root:  node_modules/.bin/tsx docs/compositions/classical/firebird-berceuse-finale/build-firebird-berceuse-finale-b-orphic-fall.mjs
//
// THE STRANDS (each clip hears its own pick set, sliced to the clip)
// - nebula, the VOICE of the lullaby: one long clip from before the first note to the end of the spell, so its dust is the
//   same dust all the way: the bassoon's two phrases and the woodwind answers, the high strings' middle phrase, the oboe-like
//   answers (the "voice" track), the violins' lament and their long notes at the swell, the reprise's bassoon and descant,
//   the wind choir, the dissolve, and the spell's frozen chords. Each note is a pull round the clock of note names, so the
//   grains stream from note to note of the tune. Its how-present curve thins the cloud as the lullaby falls asleep.
// - mandala, the HARP: one long clip as well. The rocking cell (Bb-Ab-Bb-Cb, one note every 1.1 s, from the audio) lands
//   as petals on two or three spokes, so the rocking is seen as a petal swinging between spokes; the harp's chords and high
//   touches add lace. At the swell it hears the A-major chord struck six times and the violins' long notes (the pair joins
//   at the lullaby's peak); the last, slower harp notes stay longer and turn slower; in the spell it stops turning.
// - tunnel as the CRADLE (critic's pass): in the Berceuse the same Tunnel runs slow and pale under everything, a long
//   exposure whose wakes turn the dust and lace into radial grains; the Eb pedal and the D tolls drop its rings, the harp's
//   rocking swings its turning back and forth, and the spell freezes it (speed 0, long glow). It replaced a crimson floor
//   window that read as a smear. The floor window remains only in the hymn, on the bass falling B2 - Ab2 - F#2.
// - tunnel: the FALL. Tunnel redraws the whole picture a little larger every frame, so it does not just add outlines: it
//   drags the nebula's dust and the mandala's lace toward you. It sits on the lowest track, so the layers above draw their
//   present sharp over their own streaking past. From the third hymn statement (267 s) it hears every note; its how-present
//   curve rises on a steep bend to the tutti, and busier playing speeds it up on its own.
// - fireworks (the original fluid one): the ff blows only: the first stroke of every 7/4 bar, the Maestoso's bar starts,
//   the arrival on B and the last stroke.
//
// THE SERENDIPITOUS PART (legend)
// - The harp bridge (110-118 s) is a constellation: four small Mandalas in windows on an arc across the sky, each lit by its
//   own bells (the harp's harmonics, one every 1.07 s, dealt out left to right and back like the rocking), so each bell is a
//   new jewel somewhere else and the sky fills up, while the big mandala's lace dies away behind them.
// - The spell freezes the dust: the frozen chords set the nebula's swirl to 0, its threads to points and its burst nearly
//   off, so the grains hang as still points; the mandala stops turning and its lace stays 8 s. The last chord (217.6 s)
//   shrinks the figure to a small jewel, the egg, which fades as the horn starts the hymn: the dust is reborn from the first
//   horn note (a new Nebula, thin at first, growing statement by statement).
// - The subito pp (319.1 s) is the one hard cut in the show: the fall stops dead and every layer goes; a small new mandala
//   re-forms on the violins' climb out of the hush.
// - The 7/4 strokes drive a second tunnel: each stamp is a big chord, and Tunnel's surge punches the fall forward on every
//   one, so you lurch 3 times a second, while fireworks bloom on each bar's first stroke and the zoom streams their smoke
//   outward. The fall lands on the Maestoso's F1 blow (348.56 s, the lowest note of the piece): the tunnel stops dead there
//   (a first try kept a slow glide through the Maestoso: it smeared the sun into mush), and a mandala grown into a sun
//   blooms on every broad stroke, over the volcano dust of the bass and the string tremolo.
// - The coda's slow brass chords pull the dust into knots joined by threads (Nebula draws a chord as separate knots), then
//   the 1.2 s of silence before the last chord is black. The last chord enters as a thin haze that thickens with the
//   10-second swell, and one firework answers the final stroke.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = 'firebird-berceuse-finale', ID = 'firebird-berceuse-finale-b-orphic-fall';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const DUR = pack.duration;
const r3 = (x) => Math.round(x * 1000) / 1000;

// ---- notes ----
const set = (id, a = 0, b = 1e9) => {
  if (!P[id]) throw new Error(`no set ${id}`);
  return P[id].notes.filter((n) => n[0] >= a && n[0] < b).map((n) => n.slice(0, 4));
};
const merge = (...lists) => {
  const seen = new Set(), out = [];
  for (const n of lists.flat().sort((a, b) => a[0] - b[0] || a[2] - b[2])) {
    const k = `${Math.round(n[0] * 100)}:${n[2]}`; if (seen.has(k)) continue; seen.add(k); out.push(n);
  }
  return out;
};
/** Notes of `ns` that start more than `gap` s from every note of `ref` (two sources of one strand, kept once). */
const apart = (ns, ref, gap = 0.15) => ns.filter((n) => !ref.some((m) => Math.abs(m[0] - n[0]) < gap));
/** Group into attacks (40 ms), keep the lowest or highest note of each. */
const edge = (ns, which) => {
  const out = []; let cur = [];
  const flush = () => { if (cur.length) out.push(cur.reduce((a, b) => (which === 'low' ? (b[2] < a[2] ? b : a) : (b[2] > a[2] ? b : a)))); cur = []; };
  for (const n of ns) { if (cur.length && n[0] - cur[0][0] > 0.04) flush(); cur.push(n); }
  flush();
  return out;
};
/** Sets knob values on every note (keeps an intensity already there). */
const vals = (ns, v) => ns.map((n) => withValues(n.slice(0, 4), { ...(typeof n[4] === 'number' ? { intensity: n[4] } : n[4] ?? {}), ...(typeof v === 'function' ? v(n) : v) }));

// ---- clips ----
const clips = [], picks = {};
let cn = 0;
/** One clip; its set (if any) is sliced to [start + 0.02, end - 0.05) and stored under its own id. */
function clip(widget, track, start, end, o = {}) {
  const c = { id: `c${++cn}`, start: r3(start), end: r3(Math.min(end, DUR)), track, fade: o.fade ?? 1, widget };
  if (o.notes) {
    const ns = o.notes.filter((n) => n[0] >= c.start + 0.02 && n[0] < c.end - 0.05);
    if (!ns.length) throw new Error(`${o.set}: no notes in ${c.start}-${c.end}`);
    picks[o.set] = { notes: ns };
    c.listen = `picks:${o.set}`;
  }
  if (o.listen) c.listen = o.listen;
  if (o.knobs) c.knobs = o.knobs;
  if (o.region) c.region = o.region;
  if (o.intensity) c.intensity = o.intensity.map(([t, v, shape, bend]) => ({ t, v, ...(shape ? { shape } : {}), ...(bend ? { bend } : {}) }));
  if (o.moves) c.intensityMoves = 'present';
  clips.push(c);
  return c;
}
// Tracks: the tunnel lowest (it reads and zooms everything already on the canvas), the floor, the dust, the lace, the
// constellation, the fireworks on top.
const T = { TUNNEL: 0, FLOOR: 1, DUST_A: 2, DUST_B: 3, LACE_A: 4, LACE_B: 5, STAR1: 6, STAR2: 7, STAR3: 8, STAR4: 9, FIRE: 10 };
const floorRegion = { mode: 'window', shape: 'rect', x: 0.5, y: 0.86, w: 1.04, h: 0.3, feather: 0.35, fit: 'stretch', blend: 'lighten' };
const star = (x, y) => ({ mode: 'window', shape: 'ellipse', x, y, w: 0.3, h: 0.533, feather: 0.12, fit: 'contain', blend: 'clear' });

// ===== the Berceuse (6.4-226.6) =====
// The lullaby's voice: one dust from before the first note to the end of the spell.
const frozen = set('frozen-tremolo');
const voice = merge(
  vals(merge(set('lullaby-bassoon'), set('wind-answers', 0, 60.4), set('violins-line', 31, 46.4), set('voice-track', 0, 170),
  set('strings-lament'), set('swell-violins'),
  set('reprise-bassoon'), set('reprise-descant'), set('wind-answers', 138, 154), set('lullaby-dissolve')), { intensity: 1.5 }),
  // the spell freezes the dust: no swirl, points instead of threads, almost no puff, a loose pull
  vals(frozen, { swirl: 0, threads: 0.5, burst: 0.2, pull: 0.45 }),
);
clip('nebula', T.DUST_A, 4.4, 229.5, { set: 'voice-dust', notes: voice, fade: 2.2, moves: true, knobs: { amount: 6500, threads: 2.2 },
  intensity: [[4.4, 0.75], [18.5, 1], [170, 1], [194, 0.5, 'ease'], [217.6, 0.35], [229.5, 0.2]] });

// THE CRADLE (critic's pass, replacing the crimson floor windows): the same Tunnel that later becomes the fall, cast against
// type as a slow long-exposure under the lullaby. It redraws the whole canvas a touch larger and turned every frame, so the
// dust and the lace leave soft radial wakes: the spell literally as radial grains. Each Eb-pedal toll (and the swell's D
// tolls) drops a big pale ring at the mouth (palette bone, shape rings; bruise's violet was too dark to see). The harp's rocking cell steers its turning:
// spin flips sign on every rocking note, so the whole picture swings back and forth like a cradle (the rings those notes
// drop are kept faint, intensity 0.45). In the spell every frozen chord sets speed 0, spin 0, trail 1.5: no zoom, no
// turn, only a long glow, so the frozen lace and dust hang and burn in. The clip fades as the horn begins the hymn.
const rockSwing = (ns, s) => ns.map((n, i) => withValues(n.slice(0, 4), { intensity: 0.45, spin: i % 2 ? -s : s }));
const cradle = merge(
  set('eb-pedal'), set('d-pedal-tolls'),
  rockSwing(set('harp-rocking', 0, 172.5), 0.14),
  // the last, slower rocking: the swing shrinks as the lullaby falls asleep
  set('last-rocking').map((n, i, a) => withValues(n.slice(0, 4), { intensity: 0.45, spin: (i % 2 ? -1 : 1) * 0.12 * (1 - i / a.length), speed: 0.3 * (1 - i / a.length) })),
  vals(frozen, { speed: 0, spin: 0, trail: 1.5, intensity: 0.6 }),
);
// It pauses for the harp bridge (110-118 s): the four bell-stars stand crisp and still on their own, then it resumes.
const cradleKnobs = { speed: 0.4, palette: 3, shape: 0, trail: 0.5 };   // trail 1 burnt the pp dust into white blobs (round 1)
clip('tunnel', T.TUNNEL, 5.0, 110.05, { set: 'cradle-1', notes: cradle, fade: 0.8, knobs: cradleKnobs });
clip('tunnel', T.TUNNEL, 117.6, 228.0, { set: 'cradle-2', notes: cradle, fade: 2.5, knobs: cradleKnobs });

// The harp: rocking petals, the swell's six strikes and long notes, the last slow notes, the frozen jewel.
const rock1 = set('harp-rocking', 0, 80.6), rock2 = set('harp-rocking', 118, 172.5);
const harpTrack = set('berceuse-harp-track');
const last = set('last-rocking');
const lastK = (n) => { const k = Math.min(1, Math.max(0, (n[0] - 172) / 22)); return { life: 4 + 4 * k, spin: 0.15 * (1 - k) + 0.03 }; };
const lastFrozen = frozen[frozen.length - 1][0];
const harp = merge(
  rock1, apart(harpTrack.filter((n) => n[0] < 80.6), rock1),
  set('swell-entry'), set('swell-violins'),
  rock2, apart(harpTrack.filter((n) => n[0] >= 118 && n[0] < 172), rock2),
  vals(apart(last, rock2), lastK),
  vals(frozen, (n) => ({ spin: 0, life: 8, ...(n[0] >= lastFrozen - 0.01 ? { size: 0.45 } : { size: 0.7 }) })),
);
clip('mandala', T.LACE_A, 6.2, 232, { set: 'harp-lace', notes: harp, fade: 1.8, knobs: { life: 6 } });

// The harp bridge: a constellation of four small mandalas, each lit by its own bells, dealt left-right and back.
const bells = set('harp-bridge');
const bellTimes = [...new Set(bells.map((n) => n[0]))];
const order = [0, 1, 2, 3, 0, 1, 2];   // bells 1-4 left to right, 5-7 from the left again: a pendulum, like the rocking
const spots = [[0.17, 0.42], [0.39, 0.3], [0.61, 0.3], [0.83, 0.42]];
for (let w = 0; w < 4; w++) {
  const mine = bells.filter((n) => order[bellTimes.indexOf(n[0])] === w);
  clip('mandala', T.STAR1 + w, mine[0][0] - 0.3, w === 3 ? 117.5 : 120.2, { set: `bell-star-${w + 1}`, notes: vals(mine, { intensity: 1.5 }), fade: 0.25, region: star(...spots[w]),
    knobs: { life: 5, size: 1.2 } });
}

// ===== the Finale =====
// The hymn's dust, reborn from the first horn note: thin, growing statement by statement.
const hymn = merge(set('horn-hymn'), set('hymn-strings'), set('hymn-third'), set('hymn-crescendo'), set('hymn-tutti'));
clip('nebula', T.DUST_B, 225.9, 319.12, { set: 'hymn-dust', notes: hymn, fade: 0.6, moves: true,
  intensity: [[225.9, 0.35], [241, 0.45], [252.4, 0.55], [267, 0.75], [290, 1]] });
// The harp and celesta in the hymn, with the violas' inner voice; the tutti's top line.
const keys = set('keys-finale', 252, 303.5);
clip('mandala', T.LACE_B, 252.0, 319.12, { set: 'hymn-lace', fade: 0.6, moves: true,
  notes: merge(keys, set('violas-inner', 252.4, 303.5), set('hymn-tutti'), set('keys-finale', 303.5, 319.1)),
  intensity: [[252, 0.45], [282.8, 0.7], [303.5, 1]] });
// The floor again: the bass falling B2 - Ab2 - F#2.
clip('nebula', T.FLOOR, 252.0, 307.5, { set: 'floor-falling-bass', notes: set('falling-bass'), fade: 1.5, region: floorRegion, knobs: { threads: 2.6 } });
// THE FALL: from the third statement, every note; present on a steep bend to the tutti; cut dead at the subito pp.
clip('tunnel', T.TUNNEL, 266.8, 319.1, { listen: 'all', fade: 0, moves: true,
  intensity: [[266.8, 0, '', 0.5], [282.8, 0.3, '', 0.4], [303.5, 1], [319.1, 1]] });

// The hush: a small mandala re-forms on the violins' climb, then stamps with the 7/4 strokes' top notes (short life).
const strokes = set('seven-four-strokes');
clip('mandala', T.LACE_A, 319.25, 348.6, { set: 'hush-and-stamp-lace', fade: 0.3,
  notes: merge(vals(set('hush-swell'), { size: 0.55 }), vals(edge(strokes, 'high'), { life: 0.7, size: 0.8 })) });
// The 7/4 and the Maestoso: each stamp punches the fall forward; in the Maestoso a slow glide, a lurch per bar.
clip('tunnel', T.TUNNEL, 324.0, 348.56, { set: 'stamp-fall', fade: 0, notes: vals(strokes, { speed: 1.1 }) });
// Volcano fire: the stamping bass and the Maestoso's bass as deep crimson puffs, then the coda's chords as knots.
clip('nebula', T.DUST_A, 323.7, 401.12, { set: 'fire-dust', fade: 0.4,
  notes: merge(edge(strokes.filter((n) => n[0] < 329), 'low'), set('maestoso-bass'), vals(set('string-tremolo', 348.5, 380.7), { intensity: 0.75 }), set('coda-chords')),
  knobs: { burst: 1.5 } });   // volcano: bigger puffs (burst), and the Maestoso's string tremolo bubbling through the dust
// The sun: the Maestoso's broad strokes and its melody, then the coda's brass chords.
clip('mandala', T.LACE_B, 348.3, 401.12, { set: 'sun-lace', fade: 0.3, knobs: { size: 1.15 },   // a sun: bigger than our default
 
  notes: merge(set('maestoso-strokes'), set('maestoso-top'), set('coda-chords')) });
// The ff blows: the first stroke of each 7/4 bar, the Maestoso's bar starts, the arrival on B.
clip('fireworks', T.FIRE, 323.9, 401.12, { set: 'blows', fade: 0.2, knobs: { hue: 0.985, range: 0.08 },   // crimson: hue 0.02 smoke read as muddy salmon (critic)
  notes: merge(set('seven-four-downbeats'), set('maestoso-downbeats')) });

// ===== silence (401.2-402.3): black. The last chord: a thin haze thickening with the swell, one firework on the stroke =====
const fin = set('final-chord');
// The swell is a roll: the strongest audio onset in every ~1.2 s (librosa onset_strength, greedy, >= 1.15 s apart), velocity
// from the RMS there (122 + 3 dB, less 14 so the row starts near the pp entry's 61). Each restates the B major chord, held to
// the next, so the lace and the dust grow with the swell instead of dying after the entry (mandala lets a note go after 6 s).
const ROLL = [[403.88, 66], [405.2, 77], [406.6, 82], [407.87, 89], [409.03, 85], [410.4, 93], [411.63, 97]];
const swell = merge(fin, ROLL.flatMap(([t, v], i) => [47, 63, 66, 71].map((m) => [t, i + 1 < ROLL.length ? ROLL[i + 1][0] : 412.62, m, v])));
clip('nebula', T.DUST_B, 402.3, 415.4, { set: 'last-chord-dust', notes: swell, fade: 0.9, moves: true,
  intensity: [[402.3, 0.12], [412.5, 0.85, 'ease'], [412.7, 1]] });
clip('mandala', T.LACE_A, 402.3, 415.4, { set: 'last-chord-lace', notes: swell, fade: 0.9, moves: true,
  intensity: [[402.3, 0.15], [412.5, 0.9, 'ease'], [412.7, 1]] });
clip('fireworks', T.FIRE, 412.4, 415.4, { set: 'last-stroke', notes: fin.filter((n) => n[0] > 412), fade: 0.1, knobs: { hue: 0.985, range: 0.08, size: 1.6 },
  intensity: [[412.4, 1], [413.6, 1], [415.3, 0]] });

// ---- write ----
const show = { version: 3, id: ID, song: SONG,
  title: 'Firebird · B · Orphic fall: Nebula\'s dust on the lullaby, Mandala\'s lace on the harp, both frozen by the spell; the hymn falls through Tunnel; fluid fireworks on the ff blows',
  composer: { by: 'claude', at: new Date().toISOString() }, clips, picks };
const { errors, warnings } = validateShow(show, { duration: DUR, widgets: loadCatalogue().widgets, tracks: Object.keys(pack.tracks ?? {}) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${clips.length} clips, ${Object.keys(picks).length} sets, ${Object.values(picks).reduce((s, p) => s + p.notes.length, 0)} notes; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, `shows/${ID}.json`), canonicalShow(show));
