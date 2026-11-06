// Builds shows/mountain-king-b-troll-traffic.json: "Troll traffic", the round-9 characters on Mondrian's Broadway.
// Run: node_modules/.bin/tsx docs/compositions/classical/mountain-king/build-mountain-king-b-troll-traffic.mjs
// (tsx, so it can use the show module's own validator and canonical writer). Reads picks.json (this folder, made by
// gen-picks.mjs) and the pack; every set the show uses is embedded in the show's "picks".
//
// The idea, in one breath: Boogie woogie is the city of the trolls and hears every note. Statement 1 is a sleepy town of
// six wide lanes; when the violins leap two octaves (55.36 s) the grid jumps to ten lanes; on the frenzy's downbeat
// (101.89 s) it cuts to thirteen narrow lanes at night, the hall of the mountain king, with blocks that pile up (a jam).
// Mustard planes of Clumsy sit in the city like Mondrian's coloured planes: big plodding lumps for the bassoons (lower
// left), smaller frantic bits for the strings (upper right). The tune passes between them every 8.4 s in statement 1, so
// one crowd tumbles while the other stands in line. A third plane lands with the cymbals at the frenzy (upper left). Royal
// is the king, a red brushstroke in a tall dark door down the middle: he rises out of the dark alone with the horn's first
// note; his court tiptoes in on the low pizzicato and the horn, and he flicks it off the page exactly three times, at the
// three joints of the form: the frenzy's downbeat, the turn after the break chord, and the last chord. Brass gust blows
// through the city from the frenzy on, full blasts on the coda's hammer blows, and stops dead for the general pause. On
// the final crash the city and the crowds are gone, and the king stands alone in the dark, as he began.
//
// Critic's pass (2026-11-06): each city now starts under the one before, so the cuts at 55.36 and 101.89 s arrive mid-
// traffic; the push thickens the traffic (hop and life rise per note); the break's hammered chord stops the traffic dead;
// the king's three flicks send every crowd flying and make the city jump; the coda's brass is drawn over the king, its
// hammer blows at the widget's limits, so the coda breaks the three-column frame apart. The legend is
// mountain-king-b-troll-traffic.md next to this file.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show.ts';
import { loadCatalogue } from '../../../../scripts/node/catalogue.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = 'mountain-king', ID = 'mountain-king-b-troll-traffic';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const r3 = (v) => Math.round(v * 1000) / 1000, r4 = (v) => Math.round(v * 1e4) / 1e4;

const set = (id, from = -1, to = 1e9) => {
  if (!P[id]) throw new Error(`no set ${id}`);
  return P[id].notes.filter((n) => n[0] >= from && n[0] < to).map((n) => n.slice(0, 4));
};
const track = (name, from = -1, to = 1e9) => (pack.tracks[name].notes ?? pack.tracks[name])
  .filter((n) => n[0] >= from && n[0] < to).map((n) => n.slice(0, 4));
/** Sets merged: sorted by start, one note per start and pitch (the louder kept). */
function merge(...lists) {
  const by = new Map();
  for (const n of lists.flat()) {
    const k = `${n[0].toFixed(3)}|${n[2]}`, o = by.get(k);
    if (!o || n[3] > o[3]) by.set(k, n);
  }
  return [...by.values()].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
}

// ---------------------------------------------------------------------------------------------------------------
// The strands.

// Clumsy, the bassoons: their three statements of the tune (clarinet and horn with them at 29-37 s), the winds' octaves
// (63-70.5 s), the bassoon lane while everyone gathers (71-95 s), then in the frenzy the stamping bass they double, the
// coda's blows as the transcription has them, and the three strokes after the general pause.
const bassoons = merge(set('theme-bassoons'), set('theme-winds'), set('bassoon-lane', 70.97, 101.85), set('stamping-bass'),
  set('coda-chords'), set('final-strokes', 148, 149.9));

// Clumsy, the strings: every statement the strings carry (pizzicato basses, violas and cellos, the violins' entry, the
// long rise, the tune on top of the frenzy), the turn after the break chord, and the tune scurrying between the blows.
// It ends at 143.47 s: after that the strings' crowd gets to its line and stands still while the blows knock the others.
const strings = merge(set('theme-pizz-basses'), set('theme-low-strings-f-sharp'), set('theme-violins-enter'),
  set('theme-strings-rising'), set('theme-tutti'), set('break-turn'), set('stretta-runs'));

// Gust, the brass, in two clips. In the frenzy it blows through the city and the crowds, under the king (he ignores it).
// In the coda it is drawn OVER him: the six hammer blows and the last strokes are pushed to the widget's limits (power 1,
// reach 1.6, a wide fan, long burn), so each blast crosses the whole frame, door and all. The coda breaks the tune apart;
// here it breaks the picture's three columns apart too. The king still does not move for them.
const brass = track('brass', -1, 136.4);
const BLOW_T = [...set('ff-blows'), ...set('final-strokes', 148, 149.5)].map((n) => n[0]);
const isAt = (t, list, tol = 0.06) => list.some((u) => Math.abs(t - u) < tol);
const blows = merge(track('brass', 136.4), set('ff-blows'), set('final-strokes', 148, 149.5))
  .map((n) => (isAt(n[0], BLOW_T, 0.03) ? [...n, { power: 1, reach: 1.6, fan: 0.9, linger: 2.4 }] : n));

// The king's three flicks reach the whole city (critic's change). On each flick note every crowd that plays then is sent
// flying (disorder 2, hop 2.2: the widget's limits), and in the frenzy all crowds hop high (1.8), so the empty mustard
// above their line fills with tumbling shapes: they never get there.
const FLICK_T = [101.89, 133.18, 149.69];
const FRENZY = [101.8, 136.4];
const crowdValues = (notes) => notes.map((n) => {
  if (isAt(n[0], FLICK_T)) return [...n.slice(0, 4), { disorder: 2, hop: 2.2 }];
  if (n[0] >= FRENZY[0] && n[0] < FRENZY[1]) return [...n.slice(0, 4), { hop: 1.8 }];
  return n;
});

// Boogie hears every note (what "all" hears: pack.notes), as pick sets so single notes can carry knob values.
// The street (statement 2): in the push (86.97-101.85 s), as the music speeds up and grows, the blocks hop further and
// stay longer, step by step (hop 0.6 -> 1.5, life 6 -> 11): the traffic thickens into the jam before the frenzy.
const PUSH = [86.97, 101.85];
// Each city is lit before it is seen (critic's change): it starts under the one before, hidden by that one's opaque ground,
// so on the cut the new street is already in traffic instead of starting empty. The ten-lane street wakes with the last
// bassoon statement (46.2 s); the hall heaves under the street through the whole push (from 86.97 s), so the frenzy's
// downbeat opens on a jam that was already there.
const STREET_FROM = 46.2;
const allNotes = (from, to) => pack.notes.filter((n) => n[0] >= from && n[0] < to).map((n) => n.slice(0, 4));
const street = allNotes(STREET_FROM, 101.89).map((n) => {
  if (n[0] < PUSH[0]) return n;
  const k = Math.min(1, (n[0] - PUSH[0]) / (PUSH[1] - PUSH[0]));
  return [...n, { hop: r3(0.6 + 0.9 * k), life: r3(6 + 5 * k) }];
});
// The hall: the B-minor chord hammered at the break (131.0-133.15 s) is the first time the music stands still, so the
// traffic stops dead (hop 0): the tremolo only lights the blocks where they stand, and big crossings flash (flash 1).
// The turn (133.18 s, the king's second flick) sets it moving again. Every flick, hammer blow and last stroke makes the
// whole city jump two steps (hop 2) and flash a crossing.
const BREAK = [131.0, 133.15];
const hall = allNotes(PUSH[0], 149.95).map((n) => {
  if (isAt(n[0], FLICK_T) || isAt(n[0], BLOW_T)) return [...n, { hop: 2, flash: 1 }];
  if (n[0] >= BREAK[0] && n[0] < BREAK[1]) return [...n, { hop: 0, flash: 1 }];
  return n;
});

// Clumsy, the cymbals: a new instrument for the frenzy gets a plane of its own. Its crowd is knocked flying by every stroke
// two to a bar (audio), then by each crash 0.25 s after a hammer blow in the coda: the blow knocks the bassoons over, the
// crash the cymbals' crowd, a ricochet across the city.
const cymbals = merge(set('cymbal-pulse'), set('coda-crashes'));

// Royal, the king and his court: the horn pedal, the low pizzicato footfalls, the horn's few notes, the stamping bass, the
// break chord, the coda's low chords, the held breath and the strokes after the pause. Its heard velocities are set so that
// the king moves exactly three times (see `demands`): Royal ranks every attack against its own notes, rises on one that
// ranks above 0.58 (0.46 for a chord of 4+) and flicks on the next one that ranks 0.2 or more, 1.2 to 2.7 s later.
const courtNotes = merge(set('opening-pedal'), set('pizz-footsteps'), track('horn'), set('stamping-bass'), set('break-chord'),
  set('coda-chords'), set('held-breath'), set('final-strokes', 148, 149.9), set('phrase-entries', 101.8, 102));
/** [lift attack, flick attack, values for both and the notes between]. The flick lands on a note; the rise starts on one. */
const demands = [
  // The push's top (the footfall at 100.08 s, -6 dB) raises him; the frenzy's downbeat (101.89 s, with the cymbal) is the flick.
  [100.08, 101.89, null],
  // The break: the B-minor chord hammered ff (131.08 s) raises him while the music stands still; the turn (133.18 s) flicks.
  [131.08, 133.18, null],
  // The end: the held breath's last chord (D over B, 147.13 s) raises him slowly through the general pause; the loudest
  // stroke of the last crescendo (149.69 s, -0.5 dB) is the flick, the grandest of the three: more of the stroke sweeps
  // (flourish 1.25). Here he leans left, where his S already curves, so the cocked tip leaves the door for the pause
  // whatever the knobs (haughty 1.4 and flourish 1.6 were tried); the flick whips it back inside.
  [147.13, 149.69, { flourish: 1.25 }],
];
const near = (t, u) => Math.abs(t - u) < 0.04;
const SOFT = 20, LOUD = 60, TOP = 127;
// Tiers: the softest 38 % stay far off (heard at 20, rank 0), the rest come close (heard at 60, rank ~0.4), and the horn
// always comes close. The notes inside a rise are soft, so nothing but the chosen note can trigger the flick.
const sortedV = courtNotes.map((n) => n[3]).sort((a, b) => a - b), cut = sortedV[Math.floor(sortedV.length * 0.38)];
const hornKeys = new Set(track('horn').map((n) => `${n[0].toFixed(3)}|${n[2]}`));
const court = courtNotes.map(([s, e, m, v]) => {
  let heard = v < cut && !hornKeys.has(`${s.toFixed(3)}|${m}`) ? SOFT : LOUD, values = null;
  for (const [lift, flick, vals] of demands) {
    // A chord is as loud as its loudest note: the attack needs one note at 127, the others as loud as they can be.
    if (near(s, lift) || near(s, flick)) { heard = Math.min(TOP, 2 * v); values = vals; }
    else if (s > lift + 0.04 && s < flick - 0.04) { heard = SOFT; values = vals; }
  }
  const intensity = r4(heard / v);
  if (intensity > 2) throw new Error(`court note ${s} v${v} cannot be heard at ${heard}`);
  const out = [r4(s), r4(e), m, v];
  if (values) out.push({ ...values, intensity });
  else if (intensity !== 1) out.push(intensity);
  return out;
});
// The demands must be the only notes ranked high enough to rise.
{
  const heard = court.map((n) => Math.min(127, Math.round(n[3] * (typeof n[4] === 'number' ? n[4] : n[4]?.intensity ?? 1)))).sort((a, b) => a - b);
  const rank = (v) => heard.findIndex((h) => h >= v) / heard.length;
  console.log(`court: ${court.length} notes, soft below v${cut}; ranks: soft ${rank(SOFT).toFixed(2)}, loud ${rank(LOUD).toFixed(2)}, demand ${rank(TOP).toFixed(2)}`);
  for (const [lift, flick] of demands) for (const t of [lift, flick]) {
    const top = Math.max(...court.filter((n) => near(n[0], t)).map((n) => Math.round(n[3] * (typeof n[4] === "number" ? n[4] : n[4]?.intensity ?? 1))));
    if (top < TOP) throw new Error(`the attack at ${t} s reaches only ${top}`);
  }
  if (rank(LOUD) >= 0.44 || rank(TOP) < 0.6) throw new Error('the court tiers would let the king rise on the wrong note');
}

// ---------------------------------------------------------------------------------------------------------------
// The places. The frame is a Mondrian: the city everywhere, three hard-edged planes on it.
// The king: a tall band down the middle at full size (cover: his own picture uncropped in height), a black door in the city.
const KING = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.36, h: 1, feather: 0, fit: 'cover', blend: 'over' };
const BASSOON_PLANE = { mode: 'window', shape: 'rect', x: 0.165, y: 0.72, w: 0.29, h: 0.29, feather: 0, fit: 'contain', blend: 'over' };
const STRING_PLANE = { mode: 'window', shape: 'rect', x: 0.835, y: 0.28, w: 0.29, h: 0.29, feather: 0, fit: 'contain', blend: 'over' };
const CYMBAL_PLANE = { mode: 'window', shape: 'rect', x: 0.14, y: 0.2, w: 0.22, h: 0.22, feather: 0, fit: 'contain', blend: 'over' };

const END = 151.5;            // the reverb is gone by 151.5 s; after it, 10.5 s of nothing
// The final crash (149.97 s, audio): the city and both crowds are gone at once, and the king stands alone in the dark as
// he did at the start, while the brass's last blast burns out and the reverb dies.
const CRASH = 149.97;
// The brass: its air stops dead for the general pause (147.75-148.6 s) and comes back on the first stroke after it.
const STILL = [{ t: 147.45, v: 1, shape: 'ease' }, { t: 147.75, v: 0, shape: 'hold' }, { t: 148.96, v: 1 }, { t: 150.1, v: 1, shape: 'ease' },
  { t: END, v: 0 }];

const picks = {
  'court': { notes: court },
  'bassoons': { notes: crowdValues(bassoons) },
  'strings': { notes: crowdValues(strings) },
  'brass': { notes: brass },
  'blows': { notes: blows },
  'cymbals': { notes: crowdValues(cymbals) },
  'street': { notes: street },
  'hall': { notes: hall },
};

const clips = [
  // The city, three times. Statement 1: a sleepy town of six wide lanes, its blocks barely hopping (hop 0.3: tiptoe).
  // The lights come on with the first plucked note of the tune (3.72 s), quickly, so the cream does not linger in grey.
  { id: 'town', start: 3.6, end: 55.36, track: 2, fade: 0, widget: 'boogie', knobs: { lanes: 6, hop: 0.3 },
    intensity: [{ t: 3.6, v: 0, shape: 'ease' }, { t: 4.3, v: 1 }] },
  // Statement 2: the violins leap two octaves and the grid jumps to ten lanes on their first note (a cut on the note).
  { id: 'city', start: STREET_FROM, end: 101.89, track: 1, fade: 0, widget: 'boogie', listen: 'picks:street' },
  // The frenzy: a hard cut on the downbeat to thirteen lanes at night (the hall itself), blocks that pile up (life 12) and
  // jump further (hop 1): the jam. It stays night to the end, and is cut off by the final crash.
  { id: 'hall', start: PUSH[0], end: CRASH, track: 0, fade: 0, widget: 'boogie', listen: 'picks:hall', knobs: { lanes: 13, ground: 1, life: 12, hop: 1 } },

  // The bassoons' plane enters on their first note; big plodding lumps (size 2, crowd 9, rush 0.7).
  { id: 'bassoons', start: 12.45, end: CRASH + 0.3, track: 3, fade: 0.3, widget: 'clumsy', listen: 'picks:bassoons', region: BASSOON_PLANE,
    knobs: { crowd: 9, size: 2, rush: 0.7 } },
  // The strings' plane enters on the first pizzicato note of the tune; a mob of smaller frantic bits (size 1.6, rush 1.4).
  { id: 'strings', start: 3.62, end: CRASH + 0.3, track: 4, fade: 0.3, widget: 'clumsy', listen: 'picks:strings', region: STRING_PLANE,
    knobs: { crowd: 16, size: 1.6, rush: 1.4 } },
  // The cymbals' plane lands with their first stroke, the frenzy's downbeat: a few lumps (crowd 6, size 2) that every
  // crash sends flying (disorder 1.8).
  { id: 'cymbals', start: 101.89, end: CRASH + 0.3, track: 5, fade: 0.15, widget: 'clumsy', listen: 'picks:cymbals', region: CYMBAL_PLANE,
    knobs: { crowd: 6, size: 2, disorder: 1.8 } },

  // The king rises out of the dark with the horn's held F# (1.02 s). Oxblood and ivory (robe 2): a red stroke (Mondrian's
  // red, darkened) and ivory courtiers the colour of the city; his black door merges with the night of the frenzy. A bigger
  // court (crowd 1, a stream of them) that dares come right up (near 1), or the narrow door would hide it. Its presence grows with the
  // piece: a few marks in statement 1, the full court for the frenzy. Drawn last: the brass blows past him, never over him.
  { id: 'king', start: 0.9, end: END, track: 7, fade: 1.4, widget: 'royal', listen: 'picks:court', region: KING,
    knobs: { robe: 2, crowd: 1, near: 1 }, intensityMoves: 'present',
    intensity: [{ t: 0.9, v: 0.3 }, { t: 54.9, v: 0.4 }, { t: 55.36, v: 0.6 }, { t: 86.97, v: 0.65 }, { t: 100.08, v: 0.9 },
      { t: 101.89, v: 1 }] },

  // The brass, from the frenzy's downbeat: gusts over the city and the crowds (not the king); its last streaks die in the
  // hush before the coda (136.0-136.4 s).
  { id: 'brass', start: 101.89, end: 136.4, track: 6, fade: 0, widget: 'gust', listen: 'picks:brass',
    intensity: [{ t: 101.89, v: 1 }, { t: 136.0, v: 1, shape: 'ease' }, { t: 136.4, v: 0 }] },
  // The coda's brass, drawn over the king: every hammer blow crosses the whole frame.
  { id: 'blows', start: 136.4, end: END, track: 8, fade: 0, widget: 'gust', listen: 'picks:blows', intensity: STILL },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Grieg: In the Hall of the Mountain King · Troll traffic: Royal the king in a dark door, Clumsy planes for the bassoons, the strings and the cymbals, Brass gust, on the Boogie woogie city by day and by night',
  composer: { by: 'claude', at: new Date().toISOString() },
  clips: clips.map((c) => ({ ...c, start: r3(c.start), end: r3(c.end) })),
  picks,
};
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets: loadCatalogue().widgets, tracks: Object.keys(pack.tracks ?? {}) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, `shows/${ID}.json`), canonicalShow(show));
console.log(`shows/${ID}.json: ${clips.length} clips; sets ${Object.entries(picks).map(([k, v]) => `${k} ${v.notes.length}`).join(', ')}`);
