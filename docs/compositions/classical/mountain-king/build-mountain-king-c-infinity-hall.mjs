// Builds shows/mountain-king-c-infinity-hall.json: "Infinity hall", one Kusama room seen as a corridor of nested rooms
// (kusama in small copies, one inside the other), each room one strand of the music; fold mirrors the corridor in the
// frenzy; pixel sort tears it on the coda's hammer blows.
// Reads picks.json (this folder, made by gen-picks.mjs), embeds every set the show uses, trimmed to the clips that hear
// it, and writes the show. Run:
//   node docs/compositions/classical/mountain-king/build-mountain-king-c-infinity-hall.mjs
//   npm run check-show -- shows/mountain-king-c-infinity-hall.json
//
// The idea: Kusama's mirror rooms. The hall is not one picture but a corridor: rooms nested inside rooms, each a smaller
// copy of the same polka-dot sheet, each a little more twisted than the one around it, all leading to a heart at the
// centre. Every room is one instance of kusama tied to one strand, so the frames light up, flood and change colour on
// their own notes. The corridor builds with the form: the heart (the tune) opens on the horn's held note out of silence;
// the phrase clock's ring opens around it on the first pizzicato note, the footfalls' ring when the bassoons take the
// tune; statement 1 is a corridor floating in the dark cave. When the violins enter two octaves up (54.9 s) the hall
// itself lights up around it (all notes, the net), and from the violins' F# half (70.97 s) their ring joins. Every room's
// net tightens with its own strand's speed: the accelerando is the net closing in. The frenzy's downbeat folds the whole
// corridor in a mirror (fold), the fastest unit doubles the mirror into a kaleidoscope. The break's hammered chord
// collapses it into one huge room while the music stands still. The first coda blow
// brings the corridor back as it was, and each later blow tears the outermost room away, pixel sort dragging the room it
// destroys into strips of its old colours, until only the heart holds the held breath. The general pause is black; the
// three growing strokes burst the corridor open again from the heart outward, the final crash tears it, cut to black.
//
// What the previews showed (and changed):
// - Nested small copies of kusama hide the middle of every room but the innermost: a ring only shows its ground, its
//   seed dots, the colonies that spill out from the middle and its floods. With the tune in a ring (first try) the
//   corridor was flat red frames, close to Albers; with the tune as the heart, every tune note is a colony in plain
//   sight and the rings answer by colour (flip 1). Fewer, thinner rings (5 rooms, 0.8 ratio) keep it dots, not fields.
// - A gift of the small copy's see-through blend: kusama's black ground (the yellow-on-black pair) goes see-through, so a
//   ring that floods into yellow-on-black turns into a pane of dark glass with yellow dots over the room behind it.
// - Fold on the twisted corridor folds the frames into pentagons and diamonds, and its quiet-passage fade leaves the
//   mirrored half translucent, like mirror glass; on the fastest unit, folds 2 makes the hall a kaleidoscope.
// - The first try reset the rooms for the coda (all came back red, one flat picture). Keeping each room one clip, deaf
//   and unseen through the break, brings the corridor back at the first blow with the colours it had in the frenzy.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = 'mountain-king', ID = 'mountain-king-c-infinity-hall';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));

const r3 = (v) => Math.round(v * 1000) / 1000, r4 = (v) => Math.round(v * 1e4) / 1e4;
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
/** Statement 1 is pp (velocities 26–40) and statement 2 under 60: the colonies would stay small and few, so the
 *  first two statements are heard louder (kusama's colony size and dot count follow velocity). */
const lift = (t) => (t < 54.9 ? 1.9 : t < 86.97 ? 1.5 : t < 101.85 ? 1.2 : 1);
const boost = (ns, f = lift) => ns.map((n) => (n.length > 4 ? n : val(n, { intensity: f(n[0]) })));

// ---- the corridor: nested rooms, all centred, each about 0.74 of the one around it and a little more twisted ----
// The twist grows inward, so the deeper rooms lean further: the corridor screws inward towards the heart. A small copy
// keeps kusama's 16:9 sheet (w = h as fractions of the picture), with hard edges. Five rooms: with fold or pixel sort on
// top that is six layers at once, the most the studio likes.
//   k  size  strand                    opens at
//   0  1.00  the whole orchestra (all)  55.33  statement 2: the violins enter, the hall lights up around the corridor
//           (before it, from 3.62 s: the dim cave, a second kusama on the tune's B-minor units only)
//   1  0.80  the footfalls              12.5   the bassoons take the tune, the plucks go on underneath
//   2  0.64  the violins' top line      70.97  the F# half in the violins, everyone joins
//   3  0.51  the phrase clock           3.7    one beat per phrase entry; the cymbals in the frenzy
//   4  0.40  the tune (the heart)       1.02   the horn's held note out of silence, then every note of the tune
// Only the innermost room is seen whole: the rings around it show their ground, their dots, the colonies that spill out
// of the middle and, above all, the floods of a new colour when their own strand changes harmony. So the tune, the
// strand with the most notes, is the heart, and every one of its notes is a colony there; the rings answer their strands
// by colour (flip 1: a flood at every change of harmony they hear).
const SIZES = [1, 0.8, 0.64, 0.51, 0.4];
const TWIST = [0, 3, 6.5, 10.5, 15];
const room = (k) => (k === 0 ? undefined
  : { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: SIZES[k], h: SIZES[k], rot: TWIST[k], feather: 0, fit: 'stretch' });

// ---- times ----
const BREAK = 131.08;                                 // the hammered B-minor chord: the corridor collapses into one room
const HUSH = 136.0;                                   // 0.4 s of near-silence before the first blow: black
const BLOWS = within(set('ff-blows'), 136, 147).map((n) => n[0]);   // 136.46 139.62 140.59 143.71 144.67 145.66
const GP = 147.72;                                    // the general pause: black
const STROKES = within(set('final-strokes'), 148, 150).map((n) => n[0]);   // 148.98 149.31 149.69 (149.97 the crash)
const FIN = 150.45;                                   // the reverb dies: cut to black

// ---- the sets ----
const picks = {};
const use = (id, notes) => { if (!notes.length) throw new Error(`${id} is empty`); picks[id] = { notes }; return `picks:${id}`; };
// The blows and the final strokes are the whole orchestra, so every room hears them in the coda (audio strokes, B1
// nominal). Between them each room keeps its own strand where it still plays.
const blows = within(set('ff-blows'), 136, 147), strokes = within(set('final-strokes'), 148, 149.9);

// The clock: every phrase entry (the clock the accelerando keeps), and in the frenzy the cymbal strokes too, two to a
// bar: the ring beats faster and faster. The cymbals are audio strokes with a nominal pitch; here they take the B-minor
// chord tones in turn so their colonies land across the ring, not in a corner.
const MID = [59, 62, 66, 71, 74];
const cymbals = within(set('cymbal-pulse'), 101, 131).map((n, i) => [n[0], n[1], MID[i % MID.length], n[3]]);
const clock = union(boost(set('phrase-entries'), (t) => (t < 101.85 ? 2 : 1)), cymbals, blows, strokes);
// The heart: the horn's held F#4 out of silence, then the tune, every eighth; in the coda the tune at double speed
// between the blows, then the held breath alone, then the first of the final strokes.
// The horn's lone note (v16) is heard twice as loud with the biggest colonies (a per-note size), so it reads in the small heart.
const tune = union(set('opening-pedal').map((n) => val(n, { intensity: 2, size: 1.8 })), boost(set('theme')), blows, set('stretta-runs'),
  boost(set('held-breath'), () => 1.5), strokes);
// The footfalls: the pizzicato plucks, then the frenzy's stamping bass; in the coda the blow chords as transcribed.
const footfalls = union(boost(set('pizz-footsteps')), set('stamping-bass'), blows, set('coda-chords'), strokes);
// The violins' top line, from the F# half on (70.97 s): the frenzy's tremolo glitter is in it.
const violins = union(boost(within(set('violins-high'), 70.9, 145)), blows, strokes);

// ---- the clips ----
const clips = [];
const clip = (o) => clips.push({ id: `c${clips.length + 1}`, fade: 1, ...o, start: r3(o.start), end: r3(o.end) });
const pv = (pairs) => pairs.map(([t, v, shape]) => (shape ? { t: r3(t), v, shape } : { t: r3(t), v }));
// Every room's net tightens with its own strand's speed (tight driven by rate at full depth, from loose loops at 0.15):
// the accelerando is the net closing in. The far rooms get bigger colonies so their dots still read; stay 10 lets the
// dots of the single-line strands pile up (Kusama's obsession) and flip 0.7 lets each room flood with its own harmony
// more often, so the frames of the corridor tell apart by colour.
const NET = { tight: { base: 0.15, drive: '+rate', depth: 1 } };
const SIZE = [1, 1, 1.1, 1.25, 1.5];
const knobsFor = (k) => ({ ...NET, ...(SIZE[k] !== 1 ? { size: SIZE[k] } : {}), ...(k ? { stay: 10, flip: k === 4 ? 0.7 : 1 } : {}) });
// Each room is one long clip: on from its entrance; gone (weight 0, deaf) while the break's single room stands and
// through the hush; back at the first blow with the colours it had; torn away 0.3 s after its blow (pixel sort drags its
// last picture into strips over what is left); back at its final stroke.
const TEAR = [BLOWS[1], BLOWS[2], BLOWS[3], BLOWS[4], GP - 0.3];
const BACK = [STROKES[2], STROKES[1], STROKES[1], STROKES[0], STROKES[0]];
function roomClip(k, start, listen, fade = 0.12, rise = [], extra = {}) {
  const tearAt = TEAR[k] + 0.3, back = BACK[k] - 0.03;
  clip({ track: k, widget: 'kusama', start, end: FIN, fade, listen, region: room(k), knobs: { ...knobsFor(k), ...extra },
    intensity: pv([...rise, [BREAK - 0.01, 1, 'hold'], [BREAK, 0, 'hold'], [BLOWS[0] - 0.03, 1, 'hold'], [tearAt, 0, 'hold'], [back, 1]]) });
}
roomClip(4, 0.95, use('tune', tune), 0.6);            // the heart: alone on black for 2.7 s, the horn's colony spreading
roomClip(3, 3.62, use('clock', clock));                // 3.7: the first phrase entry, the tune's first pizzicato note
roomClip(1, 12.45, use('footfalls', footfalls));       // 12.5: the plucks under the bassoons
// The cave (critic's pass): in the composer's version the first statement was a small corridor floating on pure black
// for 51 s. Now the cave's wall is there, dimly, from the first pizzicato step: a second kusama, full screen under the
// corridor, hearing only the tune's B-minor units (theme-minor), so it keeps the dark red of B minor; pasted at a fifth
// of its weight (0.18, rising to 0.28), it is a dark maroon wall with faint seed dots and a rare grey colony on a note of
// the tune (it hears a fifth of them). flip 0: the wall holds its colour. A first try dimmed the whole hall on all notes
// instead: its floods to cream and yellow went grey and olive at low weight (mud), so the dim wall only ever hears minor.
const cave = boost(within(set('theme-minor'), 3.6, 55.3));
clip({ track: 0, widget: 'kusama', start: 3.62, end: 55.33, fade: 0.12, listen: use('cave', cave), knobs: { flip: 0 },
  intensity: pv([[3.62, 0, 'ease'], [6.5, 0.18], [55.2, 0.28]]) });
// The hall lights up on the violins' first note (55.33 s), two octaves up. Its dots and net patches stay longer the
// louder the note (stay 3, driven by level, our only knob change on it): through the push and the frenzy the net piles
// up around the corridor instead of fading, Kusama's obsession closing in as the trolls wake.
roomClip(0, 55.33, 'all', 0.12, [], { stay: { base: 3, drive: '+level', depth: 0.6 } });
roomClip(2, 70.92, use('violins', violins));           // 70.97: the violins' F# half

// The frenzy (101.85 s, the ff downbeat with the first cymbal): the whole corridor folds in a mirror that turns with the
// bass; loud chords fold it fourfold for a beat. Every note of the tutti (fold reads all of them).
// The last A (125.55 s, the phrase entry of the fastest unit, eighths about 0.13 s): the mirror doubles for good (folds 2,
// a fourfold kaleidoscope, sixfold for a beat on the loud chords): the hall spins out of control before the break.
const LAST_A = 125.5;
clip({ track: 6, widget: 'fold', start: 101.8, end: LAST_A, fade: 0.08, listen: 'all' });
clip({ track: 6, widget: 'fold', start: LAST_A, end: BREAK - 0.02, fade: 0.05, listen: 'all', knobs: { folds: 2 } });

// The break: the B-minor chord hammered ff, the music stands still. The corridor collapses into one room, the chord's
// colonies huge (size 1.8) and the net at its tightest; then the turn in octaves marches across it. It ends in the 0.4 s
// hush before the first blow (136.0–136.4 s: −28 dB): black.
const brk = union(set('break-chord'), set('break-turn'), within(set('cymbal-pulse'), 133, 136));
clip({ track: 5, widget: 'kusama', start: BREAK - 0.02, end: HUSH, fade: 0.05, listen: use('break', brk), knobs: { size: 1.8, tight: 1 } });

// Pixel sort: the coda's blows and crashes tear the print into strips of the old colours. The blow chords are in the set
// too, so each blow is a loud chord of several notes and tears a band right across. Worth-trying values from the combos
// table: band 1.6, len 1.0.
const tears = union(blows, set('coda-crashes'), set('coda-chords'));
clip({ track: 6, widget: 'pixelsort', start: 136.35, end: GP, fade: 0.05, listen: use('tears', tears), knobs: { band: 1.6, len: 1 } });
// The last crescendo: the three strokes, the final chord and its crash. The strokes are audio onsets with a nominal
// pitch; the final chord and the crash are heard as low and high at once (the whole orchestra), so they tear across.
const last = union(set('final-strokes'), [[149.69, 150.09, 66, 119], [149.97, 150.47, 47, 108]]);
clip({ track: 6, widget: 'pixelsort', start: 148.9, end: FIN, fade: 0, listen: use('last', last), knobs: { band: 1.6, len: 1 } });

// Trim every set to the clips that hear it (a pick no clip hears is a warning).
for (const [id, s] of Object.entries(picks)) {
  const cs = clips.filter((c) => c.listen === `picks:${id}`);
  s.notes = s.notes.filter((n) => cs.some((c) => n[0] >= c.start && n[0] < c.end));
  if (!s.notes.length) throw new Error(`${id}: nothing inside its clips`);
}
for (const c of clips) if (!c.region) delete c.region;

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Grieg: In the Hall of the Mountain King · C · Infinity hall: a corridor of nested Kusama rooms, one strand each (the hall on all notes, the tune, the footfalls, the violins, the heart on the horn and the phrase clock), folded in the frenzy, torn by pixel sort on the hammer blows',
  composer: { by: 'claude', at: new Date().toISOString() },
  clips, picks,
};
writeFileSync(join(ROOT, `shows/${ID}.json`), JSON.stringify(show, null, 2) + '\n');
console.log(`${ID}: ${clips.length} clips, ${Object.keys(picks).length} sets`,
  Object.fromEntries(Object.entries(picks).map(([k, v]) => [k, v.notes.length])));
