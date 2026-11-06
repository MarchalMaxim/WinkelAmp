// Builds shows/mountain-king-a-threads-and-dread.json: "Threads and dread", one accelerating machine of woven threads
// (strings), dread squares (squares), glitch blocks (blocks), skittish shapes (flee) and one slash of the casket.
// Reads picks.json (this folder, made by gen-picks.mjs) and the pack (for the derived chord set), embeds every set the
// show uses, trimmed to the clips that hear it, and writes the show. Run:
//   node docs/compositions/classical/mountain-king/build-mountain-king-a-threads-and-dread.mjs
//   npm run check-show -- shows/mountain-king-a-threads-and-dread.json
//
// The idea in one line: the tune climbs out of a cave. Statement 1 lives in the lower half of the screen (the pizzicato
// floor as a flat loom of threads, the bassoons as dread squares in the cave), the vault above holds only the echo of each
// phrase's landing note. When the violins take the tune two octaves up (54.9 s) a second loom lights at the top of the
// screen. From 71 s the tune fills the vault, the footsteps leave the floor and stamp across the whole hall as squares,
// and the crescendo's chords start to tear the picture. In the frenzy the cymbals tear it two to a bar and heal faster
// and faster (the accelerando made visible), the violins' mass bolts as flee; at the break the machine jams (the tears
// hang while the chord stands still). The coda is blow (slab) and crash (tear), six times; the held breath knots the
// threads into rings; the general pause is black; three growing strokes rebuild the picture, and the casket, unused for
// 149 s, makes its one slash on the final chord before the cut to black.
//
// What the previews found (and kept):
// - The frenzy's downbeat (101.85 s) first looked emptier than the push: the blocks' note bars vanished with their clip
//   and the tune's head is not transcribed. The chords and the cymbals are now one blocks clip, and the downbeat stroke
//   tears the push's wall of bars into huge hanging slabs (per-note size 230, settle 2.5): a white-hot blowout as the ff
//   lands, then the frenzy's threads and flee come out of it. The single loudest picture of the show, found by accident.
// - Settle 4.5 on every break stroke piled the tears into a glitch wall that hid the chord and the turn; now one slab
//   hangs exactly through the held chord, the strokes inside it only shiver, and the crash before the hush tears big.
// - Audio-derived strokes have nominal pitches, and blocks tears where the pitch puts it: B6 tore the empty top strip.
//   Cymbals use the B-minor chord tones B3–D5; each coda crash is a nominal B3–D4–F#4 triad at intensity 1.25, the only
//   way blocks throws full-width bands, which cross the blow's slab wherever it landed.
// - The held breath (bend 1, tangle 1): the diminished chord knots the threads into a ring, D/B unties it.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = 'mountain-king', ID = 'mountain-king-a-threads-and-dread';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));

const r3 = (v) => Math.round(v * 1000) / 1000, r4 = (v) => Math.round(v * 1e4) / 1e4;
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const set = (id) => P[id].notes.map((n) => n.slice(0, 4));
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
/** Union of note lists, one note per (start to 10 ms, pitch), sorted by start. */
function union(...lists) {
  const seen = new Map();
  for (const n of lists.flat()) { const k = `${Math.round(n[0] * 100)}:${n[2]}`; if (!seen.has(k)) seen.set(k, n); }
  return [...seen.values()].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
}
/** The note with values in the stored form: a lone intensity as a number, knobs as an object; intensity 1 not written. */
function val(n, v) {
  const out = {};
  for (const k of Object.keys(v).sort()) {
    if (k === 'intensity') { const x = r4(Math.max(0, Math.min(2, v[k]))); if (x !== 1) out[k] = x; } else out[k] = r4(v[k]);
  }
  const ks = Object.keys(out), base = n.slice(0, 4);
  if (!ks.length) return base;
  return [...base, ks.length === 1 && ks[0] === 'intensity' ? out.intensity : out];
}
/** Boost: every note's heard velocity × f(t) (statement 1 is pp: velocities 26–40 would leave the marks near black). */
const boost = (ns, f) => ns.map((n) => val(n, { intensity: f(n[0]) }));

// ---- the derived set: the crescendo's chords (attacks of 5+ notes in the lanes and pack notes, 70.97–101.85 s) ----
function crescendoChords(a, b) {
  const seen = new Set(), all = [];
  for (const n of [...Object.values(pack.tracks).flatMap((t) => t.notes), ...pack.notes]) {
    const k = `${Math.round(n[0] * 50)}:${n[2]}`; if (seen.has(k)) continue; seen.add(k); all.push(n.slice(0, 4));
  }
  all.sort((x, y) => x[0] - y[0]);
  const at = [];
  for (const n of all) { const l = at[at.length - 1]; if (l && n[0] - l.t < 0.04) l.ns.push(n); else at.push({ t: n[0], ns: [n] }); }
  return union(at.filter((x) => x.t >= a && x.t < b && new Set(x.ns.map((n) => n[2])).size >= 5).flatMap((x) => x.ns));
}

// ---- regions ----
const strip = (y, h) => ({ mode: 'window', shape: 'rect', x: 0.5, y, w: 1, h, feather: 0.3, fit: 'cover' });
const FLOOR = strip(0.86, 0.28);     // the pizzicato floor: a flat loom along the bottom
const CEILING = strip(0.14, 0.28);   // the violins two octaves up: the same loom along the top
const CAVE = strip(0.74, 0.52);      // the bassoons' squares, kept in the lower half

// The frenzy's downbeat (101.81–101.89 s: B1, B3 and the tune's entry B4, pack notes and phrase-entries): no set has it
// whole, and the tune's head is under the cymbal (unit 25), so without it the vault is empty for half a second at the ff.
const DOWNBEAT = union(within(pack.notes.map((n) => n.slice(0, 4)), 101.8, 101.86), within(set('phrase-entries'), 101.85, 101.95));

// ---- the sets ----
const picks = {};
const use = (id, notes) => { if (!notes.length) throw new Error(`${id} is empty`); picks[id] = { notes }; return `picks:${id}`; };

// The vault: the horn's held F#4 alone out of black; in statements 1 and 2a only each phrase's landing note echoes up
// here; from 70.97 s the whole tune; then the break's chord and turn. One clip, one weave, 0.6–135.4 s.
const vault = union(
  boost(set('opening-pedal'), () => 2),
  boost(within(set('theme-landings'), 0, 70.97), (t) => (t < 54.9 ? 1.8 : 1.5)),
  boost(within(set('theme'), 70.97, 130.6), (t) => lerp(1.4, 1, (t - 70.97) / 20)),
  within(set('frenzy-tremolo'), 101.85, 130.6),
  DOWNBEAT,                                                       // the ff downbeat, before the tune's head is heard                  // the frenzy's tremolo: the threads twitch on every stroke
  set('break-chord'), set('break-turn'),
);
// (critic) The accelerando as a tightening weave. The vault's crossings (weave, read every frame, set per note: it holds
// from a note to the set's next attack) step up with the form: the horn's lone note is one long wave, statement 1 two
// crossings, each later section one more, until the frenzy's last, fastest A is a tight 9-fold mesh. On the break's
// hammered chord (131.08 s), the first time the music stands still, the mesh snaps open to a single slow wave; the turn
// winds it back up. The steps land on notes (the first vault note of each section), never between them.
const WEAVE = [[3.7, 2], [54.9, 2], [70.97, 3], [86.97, 4], [94.6, 5], [101.85, 6], [108.1, 7], [114.1, 8], [125.59, 9]];
const weaveAt = (t) => {
  if (t >= 131.0 && t < 133.15) return 1;                     // the break chord: the machine stands still
  if (t >= 133.15 && t < 136) return 6;                       // the turn: wound up again
  let w = 1; for (const [a, v] of WEAVE) if (t >= a) w = v; return w;
};
/** Merge knob values into notes that may already carry an intensity (a number) or an object. */
const addKnobs = (ns, f) => ns.map((n) => {
  const old = n[4] === undefined ? {} : typeof n[4] === 'number' ? { intensity: n[4] } : n[4];
  return val(n, { intensity: 1, ...old, ...f(n[0], n) });
});
const vaultW = addKnobs(vault, (t) => ({ weave: weaveAt(t) }));
// The floor: the plucks (footsteps, the tune in the basses), 3.7–87 s. (critic) The violas' and cellos' F# half moved up
// to its own loom (the mezzanine, below), so the tune visibly climbs a storey when it turns to F# major.
const floor = boost(union(within(set('pizz-footsteps'), 0, 87), set('theme-pizz-basses')),
  (t) => (t < 54.9 ? 1.8 : t < 70.97 ? 1.5 : 1.25));
// (critic) The mezzanine: the violas and cellos on the first F# half (units 5–6, 20.9–29.35 s, F#3–D4), a little higher
// and brighter than the bassoons, so they light a loom of their own above the cave, warmer (heat 0.7) than the floor.
const mezz = boost(set('theme-low-strings-f-sharp'), () => 1.9);
// The ceiling: the violins' top line from their entry two octaves up, 54.9–87 s.
const ceiling = boost(within(set('violins-high'), 54.9, 87), (t) => (t < 70.97 ? 1.7 : 1.3));
// The cave: the bassoons' tune (with clarinet and horn at 29–37 s) and the winds in octaves at 63–71 s.
const caveRaw = boost(union(set('theme-bassoons'), set('theme-winds')), (t) => (t < 62.95 ? 1.9 : 1.5));
// (critic) Tiptoe and pause: the staccato notes stay small, but where the tune lands on a held note (a quarter, ≥ 0.4 s)
// the square is bigger, and the A sigh at 19.88 s (1 s, the first long note of the piece) is one big slab. Size only: it
// is read at the attack. (Life per note was tried: squares read it every frame, so a longer life on the sigh relit the
// fading squares of the notes before it, close to a fake attack.)
const cave = addKnobs(caveRaw, (t, n) => (n[1] - n[0] >= 0.9 ? { size: 1.9 } : n[1] - n[0] >= 0.4 ? { size: 1.4 } : {}));
// The stamps: from 70.97 s the footsteps leave the floor as squares; in the frenzy the stamping bass.
const stamps = union(boost(within(set('pizz-footsteps'), 70.97, 101.85), (t) => lerp(1.5, 1.1, (t - 70.97) / 30)),
  within(DOWNBEAT, 0, 101.83), within(set('stamping-bass'), 101.85, 135.3));
// (critic) The crescendo in the bars themselves: blocks colours its note bars by loudness (quiet = dark red, loud = bone,
// struck = white-hot), and at the chords' own velocities the wall was a flat grey from 71 s. Each chord note is heard at
// ×0.7 at 71 s rising to ×1.15 at 101.5 s, so the wall starts as dark-red embers and glows bone-white just as the
// frenzy's downbeat tears it apart. Capped at a heard velocity of 91: blocks throws its big tears and inverted bands from
// 92 on a 3-note attack, and an uncapped ramp made the wall flash white a second before the ff, taking the edge off the
// downbeat's blowout. Under the cap the bars brighten, and the first white-hot band is the downbeat.
const chords = crescendoChords(70.97, 101.85).map((n) => val(n, { intensity: Math.min(lerp(0.7, 1.15, (n[0] - 70.97) / 30.5), 91 / n[3]) }));
// The cymbals: each tear heals faster as the music speeds up (settle 1.4 s at 101.9 s → 0.35 s at 130 s); at the break
// (from 131.0 s, the hammered chord) they hang for 4.5 s: the machine jams while the music stands still.
// Their pitch is nominal (audio strokes, B6 in picks.json). Blocks tears where a note's pitch puts it, so B6 tore only the
// empty top strip: here the strokes take the B-minor chord tones B3 D4 F#4 B4 D5 in turn, and the tears cross the threads.
const MID = [59, 62, 66, 71, 74];
const nominal = (ns) => ns.map((n, i) => [n[0], n[1], MID[i % MID.length], n[3]]);
// The first stroke, the frenzy's downbeat (101.9 s), is one gesture of its own: huge blocks (size 230, amount 3, jump 2)
// that hang 2.5 s, so the push's last picture is torn into slabs as the ff tutti lands.
// A cymbal is one note, so at the defaults it tore two or three thin rows: amount 2.4 and size 120 tear slabs (the
// squares + strings + blocks combo's "sliding slabs"), jump 1.2 throws them further. Set per stroke, so the chords keep
// the defaults.
const SLABS = { size: 120, amount: 2.4, jump: 1.2 };
// The break: the stroke on the hammered chord (131.0 s) tears one big hanging slab that heals as the chord ends (settle
// 2.1 s, to 133.1 s); the strokes inside the held chord only shiver (thin slivers), so the picture stands still with the
// music; the turn's strokes tear at the frenzy's pace again, and the crash (135.13, 135.69 s) tears big before the hush.
// (A preview with settle 4.5 on every break stroke piled the tears into a wall that hid the chord and the turn.)
const cymbalValues = (t, i) => {
  if (i === 0) return { size: 230, amount: 3, jump: 2, settle: 2.5 };
  // (critic) The frenzy's last A (125.6-130.6 s) is its fastest and loudest, but at a fixed amount the faster healing made
  // it look calmer than 112 s: now each stroke also tears more and throws further as the tempo rises.
  if (t < 130.6) { const k = (t - 101.9) / 28; return { size: 120, amount: lerp(2.4, 3, k), jump: lerp(1.2, 1.8, k), settle: lerp(1.4, 0.35, k) }; }
  if (t < 131.3) return { size: 200, amount: 2.5, jump: 1.6, settle: 2.1 };
  if (t < 133.1) return { size: 16, amount: 0.6, jump: 0.4, settle: 0.5 };
  if (t < 135) return { ...SLABS, settle: 0.4 };
  return { size: 180, amount: 3, jump: 1.8, settle: 0.5 };
};
const cymbals = nominal(set('cymbal-pulse')).map((n, i) => val(n, cymbalValues(n[0], i)));
const blows = within(set('ff-blows'), 136, 147);                 // the six coda blows (the seventh is the final chord)
// The cymbal crash 0.25 s after each blow. A crash has no pitch: each is written as a nominal B-minor triad (B3 D4 F#4)
// at intensity 1.25, because blocks throws its full-width bands only on a loud attack of 3+ notes, and only a band
// reliably crosses the slab, which lands at random. As one nominal note at its audio velocity (104-106) every tear
// stayed beside the slab on black (two previews).
const crashes = boost(within(set('coda-crashes'), 136, 147).flatMap((n) => [59, 62, 66].map((m) => [n[0], n[1], m, n[3]])), () => 1.25);
const breath = set('held-breath');
const stretta = set('stretta-runs');                             // the tune at double speed between the blows
const strokes = within(set('final-strokes'), 148.9, 149.9);      // three growing strokes: 148.98, 149.31, 149.69
const growing = strokes.map((n, i) => val(n, { size: [0.85, 1.35, 2][i] }));
const finalChord = within(set('ff-blows'), 149.6, 149.8);        // the final chord, 149.69 s: the casket's one slash

// ---- the clips (bottom → top: squares, strings, flee, blocks, casket) ----
const clips = [];
const clip = (o) => clips.push({ id: `c${clips.length + 1}`, fade: 1, ...o, start: r3(o.start), end: r3(o.end) });
const pv = (pairs) => pairs.map(([t, v, shape]) => (shape ? { t, v, shape } : { t, v }));

clip({ track: 0, widget: 'squares', start: 12.3, end: 71.2, fade: 0.8, listen: use('cave', cave), region: CAVE });
clip({ track: 1, widget: 'squares', start: 70.8, end: 135.3, fade: 0.6, listen: use('stamps', stamps) });
// Coda: one dread slab per blow, bigger and harder than the stamps (size 1.5, shake 2, blur 0.3: hammer blows, with edges
// sharp enough that the crash's tear 0.25 s later shows as a shifted edge; blurred, the tear vanished in the red).
clip({ track: 1, widget: 'squares', start: 136.3, end: 146.3, fade: 0.1, listen: use('blows', blows), knobs: { size: 1.5, shake: 2, blur: 0.3 } });
clip({ track: 1, widget: 'squares', start: 148.8, end: 150.6, fade: 0, listen: use('last-strokes', growing) });

// The vault: ember threads (heat 0.85: the show's palette).
clip({ track: 2, widget: 'strings', start: 0.6, end: 135.4, fade: 0.4, listen: use('vault', vaultW), knobs: { heat: 0.85 } });
// The floor and the ceiling: flat looms (bend 0), blood and bone (the default heat). They leave as the vault fills.
clip({ track: 3, widget: 'strings', start: 3.5, end: 87.5, fade: 0.5, listen: use('floor', floor), region: FLOOR, knobs: { bend: 0 },
  intensity: pv([[79, 1], [87.4, 0]]) });
// (critic) The mezzanine: the violas' and cellos' F#-major half, one storey above the cave, warmer than the floor.
clip({ track: 4, widget: 'strings', start: 20.6, end: 29.9, fade: 0.6, listen: use('mezz', mezz), region: strip(0.5, 0.3),
  knobs: { bend: 0, heat: 0.7 } });
clip({ track: 4, widget: 'strings', start: 54.7, end: 87.5, fade: 0.5, listen: use('ceiling', ceiling), region: CEILING, knobs: { bend: 0 },
  intensity: pv([[77, 1], [87.4, 0]]) });
// The stretta: the tune scurries between the blows as ember threads, for the crashes to tear.
clip({ track: 5, widget: 'strings', start: 137.2, end: 143.75, fade: 0.2, listen: use('stretta', stretta), knobs: { heat: 0.85 } });
// The held breath: the diminished chord, five times, knots the threads (tangle 1) into closed rings (bend 1); D/B unties them.
clip({ track: 5, widget: 'strings', start: 145.75, end: 147.65, fade: 0.15, listen: use('breath', breath), knobs: { bend: 1, tangle: 1, heat: 0.85 } });
// The last strokes: one ember thread for the casket to cut.
clip({ track: 5, widget: 'strings', start: 148.8, end: 150.6, fade: 0, listen: use('last-threads', strokes), knobs: { heat: 0.85 } });

// Flee: the strings' mass in the frenzy (a family of lanes, never picks), more and more frantic; gone at the break's chord.
// (critic) It heard the violin lane alone, which thins to 38 notes in the last, fastest A (125.6-131 s) as the
// transcriber moves the tremolo to the "strings" lane (56 there): the frenzy's peak had the fewest shapes. The whole
// string family keeps the mass growing to the break.
clip({ track: 6, widget: 'flee', start: 101.8, end: 131.1, fade: 0.1, listen: 'family:strings',
  intensity: pv([[101.8, 0.75], [108, 1]]) });

// Blocks: the crescendo's chords, the cymbals, the coda crashes. One track, from 71 s.
// (critic) The phrase clock (one sliver per unit, 3.7-71 s) is gone: its slivers were invisible and its note bars hung
// as stray grey dashes across the cave for a minute. Blocks now first tears where the crescendo begins, as cast.
// The crescendo's chords, then the cymbals, as one clip: two clips would wipe the blocks' note bars at 101.85 s and the
// frenzy's downbeat would tear an empty picture. The chords tear at the defaults. The ramp keeps the push building (the
// first preview had the bars fill the middle by 88 s): a third of the chords tear at 71 s, most by 101 s, all from 101.8 s.
clip({ track: 7, widget: 'blocks', start: 70.97, end: 136.1, fade: 0.3, listen: use('tears', union(chords, cymbals)),
  intensity: pv([[70.97, 0.35], [86.97, 0.55], [101.5, 0.85], [101.8, 1]]) });
clip({ track: 7, widget: 'blocks', start: 136.5, end: 146.3, fade: 0.1, listen: use('crashes', crashes),
  // The crashes tear in tall columns (form -0.8, size 110), so they cross the slab wherever the blow put it; rows at the
  // defaults missed it. amount 3, jump 1.6: each crash is fff.
  // settle 0.9: the shattered slab heals before the next blow (139.62 and 140.59 s are a second apart).
  knobs: { size: 110, form: -0.8, amount: 3, jump: 1.6, settle: 0.9 } });

// The casket: its one slash of the show, on the final chord (melt 3, drips 0.8, gap 2.5, shake 1.6: the last, widest cut).
clip({ track: 8, widget: 'casket', start: 148.7, end: 150.6, fade: 0, listen: use('final-chord', finalChord),
  knobs: { melt: 3, drips: 0.8, gap: 2.5, shake: 1.6 } });

// Trim every set to the clips that hear it (a pick no clip hears is a warning).
for (const [id, s] of Object.entries(picks)) {
  const cs = clips.filter((c) => c.listen === `picks:${id}`);
  s.notes = s.notes.filter((n) => cs.some((c) => n[0] >= c.start && n[0] < c.end));
  if (!s.notes.length) throw new Error(`${id}: nothing inside its clips`);
}

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Grieg: In the Hall of the Mountain King · A · Threads and dread: woven threads on the pizzicato and the tune, dread squares on the bassoons and the stamps, glitch blocks on the crescendo chords and cymbals, flee on the strings\' frenzy, one casket slash on the final chord',
  composer: { by: 'claude', at: new Date().toISOString() },
  clips, picks,
};
writeFileSync(join(ROOT, `shows/${ID}.json`), JSON.stringify(show, null, 2) + '\n');
console.log(`${ID}: ${clips.length} clips, ${Object.keys(picks).length} sets`,
  Object.fromEntries(Object.entries(picks).map(([k, v]) => [k, v.notes.length])));
