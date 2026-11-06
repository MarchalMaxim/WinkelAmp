// Builds shows/gymnopedie-jazz-a-ink-on-dusk.json: "Ink on dusk", the loved painterly family in a jazz room at dusk:
// Rothko fields (violet and blue) for the room, the current braiding the bass and the inner voices, a murmuration that
// turns every comping chord into its own figure, and a bone calligraphy stroke for Satie's tune, red only at the doors.
// Reads picks.json (this folder, made by gen-picks.mjs) and the pack (full chords at each picked attack), embeds every set
// the show uses, trimmed to the clips that hear it, and writes the show. Run:
//   node docs/compositions/classical/gymnopedie-jazz/build-gymnopedie-jazz-a-ink-on-dusk.mjs
//   npm run check-show -- shows/gymnopedie-jazz-a-ink-on-dusk.json
//
// The idea in one line: Gymnopedie rocks between two chords, Gmaj7 and Dmaj7, all its life. Here they are two dancers.
// Wherever the music only rocks (the vamp, the interlude, the groove's comping), two flocks stand side by side, the G
// chord's on the left and the D chord's on the right; each forms its own figure only on its own chord and melts while
// the other forms, so the slow dance is visible as it is heard. Whenever the harmony leaves the rocking (the band's
// oom-pah under the tune, the solo's climb through Em Am Dm F C, the closing song), the two dancers become one flock
// in the middle that draws each new chord. The tune is one bone ink stroke per phrase; the only red is at the doors:
// each cadence's C chord slashes, its D chord draws a red enso, and the flock holds the D figure through the ring-out
// (a held chord, not a new event). Before the groove the room goes still on that figure, and the drum fill's strokes
// burst it at their own hours. The last A+D hit draws the final enso and a lens; the echo tail flicks the lens at D.
//
// Found in the previews (three rounds): the cadence's D chord is only D and A in the pack, so its figure is a lens, and
// the held lens in each ring-out reads as an eye that stays open while the chord rings: kept. Between its chords each
// dancer draws the murmuration's melody ribbon, a stepped line like a pulse trace, so the pair alternates figure and
// line bar by bar. The amber dye of the current on violet fields reads as lamplight at dusk. Departures from the
// cast: the intro is the two dancers (the chords are the only sound there), and the current enters with the ticks.
//
// The critic's pass (fresh eyes, two rounds): (1) the two lamps: wherever the dancers dance, the room splits into two
// tall Rothko panels, each lit only by its own bars (G left, deep blue; D right, leaning plum), and they become the one
// full-screen room exactly where the dancers become one flock; the lamps go out on the snare pickup before the band, so
// the band's first bass note lights the room. (2) Red only at the doors: the flocks and quiet dancers are bone (bleed
// 0.1; the groove's dancers 0.3), so the brush's slash and enso are the only red until the close. (3) The ink in pieces
// cut at the tune's breaths, each on a clean page (one long clip left a grey layer of undried ink). (4) The room's
// chords 0.07 (violet and blue, no green). (5) The echo tail no longer scatters the last lens; the current carries it.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = 'gymnopedie-jazz', ID = 'gymnopedie-jazz-a-ink-on-dusk';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const PACK = pack.notes.map((n) => n.slice(0, 4)).sort((a, b) => a[0] - b[0]);

const r3 = (v) => Math.round(v * 1000) / 1000, r4 = (v) => Math.round(v * 1e4) / 1e4;
const set = (id) => P[id].notes.map((n) => n.slice(0, 4));
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const key = (n) => `${Math.round(n[0] * 50)}:${n[2]}`;
/** Union of note lists, one note per (start to 20 ms, pitch), sorted by start. Later lists do not replace earlier ones. */
function union(...lists) {
  const seen = new Map();
  for (const n of lists.flat()) { const k = key(n); if (!seen.has(k)) seen.set(k, n); }
  return [...seen.values()].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
}
/** Attacks as the widgets group them: a note joins the attack when it starts < 0.04 s after its first note. */
function attacks(ns) {
  const at = [];
  for (const n of ns) { const l = at[at.length - 1]; if (l && n[0] - l.t < 0.04) l.ns.push(n); else at.push({ t: n[0], ns: [n] }); }
  return at;
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

// The melody's notes (never part of a chord figure): the tune, the solo's top line, the closing song.
const MELODY = new Set([...set('theme-a'), ...set('theme-b'), ...set('lead-descent'), ...set('solo-line')].map(key));
// The tick figure is not part of any chord (and its 0.01 s Eb/C/Ab blips are pitch noise): kept out of the figures.
const TICKS = new Set(set('tick-loop').map(key));
/** The full chord the pack has at each picked attack: every pack note within 35 ms of it, the melody left out. */
function fullChords(picked) {
  const out = [];
  for (const a of attacks(picked)) {
    const t = a.t, ch = PACK.filter((n) => n[0] >= t - 0.012 && n[0] < t + 0.035 && !MELODY.has(key(n)) && !TICKS.has(key(n)) && n[1] - n[0] >= 0.04);
    out.push(...(ch.length >= 2 ? ch : a.ns));
  }
  return union(out);
}
const pcsOf = (ns) => new Set(ns.map((n) => n[2] % 12));

// ---- murmuration: which chords re-form the flock ----
// A figure needs score = loudest velocity + 3 × (notes − 3) ≥ 112 − 30 × strike (82 at strike 1), 2+ notes, top ≥ C4.
// The concept is "every comping chord gives its figure", so strike is 1 on every flock, and a chord that is too soft is
// heard louder (one intensity for the whole chord, just enough to clear 86): the vamp's chords are v 50–73.
const STRIKE_BAR = 82;
function figureSet(chordNotes, knobsAt = () => ({}), report = '') {
  const out = [], log = [];
  for (const a of attacks(chordNotes)) {
    const vmax = Math.max(...a.ns.map((n) => n[3])), n = a.ns.length, hi = Math.max(...a.ns.map((q) => q[2]));
    const need = 86 - 3 * (n - 3), k = n >= 2 ? Math.max(1, Math.min(2, need / vmax)) : 1;
    const score = Math.min(127, vmax * k) + 3 * (n - 3), fig = n >= 2 && hi >= 60 && score >= STRIKE_BAR;
    log.push(`${a.t.toFixed(2)}${fig ? '' : '!'}`);
    for (const q of a.ns) out.push(val(q, { intensity: k, ...knobsAt(a.t) }));
  }
  if (report) console.log(`${report}: ${log.length} attacks, no figure at: ${log.filter((s) => s.endsWith('!')).join(' ') || 'none'}`);
  return out;
}
/** Single notes that only startle the flock (echoes, the fill, the echo tail): as heard, with optional knobs. */
const startles = (ns, knobsAt = () => ({})) => ns.map((n) => val(n, knobsAt(n[0])));

// ---- the two dancers: the vamp's chords split by which of the two chords they are ----
// G side: B-D-F# (+A from 28 s, the high strokes); D side: A-C#-F#. The chord is the pack's full attack there. Each
// echo goes with its chord.
function splitDance(chordPicks, echoes = []) {
  const full = fullChords(chordPicks), G = [], D = [];
  // The grid is fixed (104 bpm, a bar of 1.731 s, the first chord at 0.59 s) and the chords alternate bar by bar, the
  // G chord on even bars: so the bar decides, not the notes (a stray C# in a G bar would otherwise flip it).
  const sideAt = (t) => (Math.round((t - 0.59) / 1.7308) % 2 === 0 ? 'G' : 'D');
  const ats = attacks(full).map((a) => ({ ...a, side: sideAt(a.t) }));
  for (const a of ats) (a.side === 'D' ? D : G).push(...a.ns);
  const eG = [], eD = [];
  for (const e of echoes) {
    let last = null; for (const a of ats) if (a.t <= e[0] + 1e-6) last = a; else break;
    if (last && !full.some((n) => key(n) === key(e))) (last.side === 'D' ? eD : eG).push(e);
  }
  return { G, D, eG, eD };
}

// ---- the sets ----
const picks = {};
const use = (id, notes) => { if (!notes.length) throw new Error(`${id} is empty`); picks[id] = { notes }; return `picks:${id}`; };

// Dancers 1: the intro vamp with its delay echoes (0.59–68.09 s).
const d1 = splitDance(within(set('vamp-chords'), 0, 69), set('chord-echoes'));
// Dancers 2: the interlude vamp (139.04–158.09 s): no echoes there.
const d2 = splitDance(within(set('vamp-chords'), 138, 160));
// Dancers 3: the groove's comping on the vamp (208.28–251.53 s), short and punchy.
const d3 = splitDance(within(set('groove-comp'), 207.7, 252.7));

// Flock 1: the band's oom-pah under the tune (69.81–132.13 s), the three rising steps, the two ff blows. The D blow
// holds its figure 4.6 s: the D chord rings to 138.5 s and the flock stands in it (the ring-out has no attack).
const blows = fullChords(set('cadence-blows'));
const holdOn = (t) => (Math.abs(t - 134.99) < 0.05 ? { hold: 4.6 } : Math.abs(t - 204.22) < 0.05 ? { hold: 4 } : {});
const flock1 = figureSet(union(fullChords(within(set('pah-chords'), 69, 133)), fullChords(within(set('cadence-approach'), 131, 133)),
  within(blows, 133, 136)), holdOn, 'flock 1');
// Flock 2: the return (159.81–199.61 s), cadence 2, the held D (to 207.1 s), then the drum fill bursts the figure at
// the fill's own hours (snare D, toms G, kick C): real strokes, the first fill of the piece.
const flock2 = union(
  figureSet(union(fullChords(within(set('pah-chords'), 159, 201)), fullChords(within(set('cadence-approach'), 200, 202.4)),
    within(blows, 202, 205)), holdOn, 'flock 2'),
  startles(within(set('drum-fill'), 207, 207.9), () => ({ intensity: 1.25 })));
// Flock 3: the solo's harmony leaves the vamp (Em Am Dm F C, from 253.28 s), the closing song's chords and the close.
// The A4+D5 hit (287.29 s, the loudest note of the song) holds its lens until the silence (hold 4.2). Not the echo
// tail (critic): its 26 sixteenth repeats in 4 s made the flock agitated, and the lens broke into grey shards over the
// last seconds, a scramble on a fading delay. The lens now stands still and melts; the current's lone thread carries
// the echo tail.
const e4chords = PACK.filter((n) => n[0] > 273.5 && n[0] < 284 && !MELODY.has(key(n)));
const e4 = attacks(e4chords).filter((a) => a.ns.length >= 3).flatMap((a) => a.ns);
const closing = fullChords(set('closing-hits'));
const flock3 = union(
  figureSet(union(fullChords(within(set('groove-comp'), 252.7, 275)), e4, closing),
    (t) => (Math.abs(t - 287.29) < 0.05 ? { hold: 4.2 } : {}), 'flock 3'));

// The current: the bass and the inner voices. The tick figure (13.87–69 s, 138.5–202 s) ripples its white-gold thread;
// the soft bass, the band's oom, the D2 pedal and the groove's walking bass (from the audio) are its lowest strand; the
// pah chords (the inner voices) spread across the braid; the doors pour their dye; the close and the echo tail end it.
// In the groove the current also hears the backbeat (kick and snare, 208.13–285.57 s), each stroke at the pitch of the
// bass under it (GM keys are not pitches): the lowest strand crosses and the white-gold head ripples and flashes on the
// breakbeat, and the water runs faster. Without it the groove, the busiest stretch, looked calmer than the theme.
const lowNotes = set('low-all');
const onBass = (ns) => ns.map((n) => {
  let p = 38; for (const b of lowNotes) if (b[0] <= n[0] + 0.05) p = b[2] < 36 ? b[2] + 12 : b[2]; else break;
  return [n[0], n[1], p, n[3]];
});
const braid = union(set('tick-loop'), set('low-all'), fullChords(set('pah-chords')), blows, closing, set('echo-tail'),
  onBass(within(set('backbeat'), 207.7, 285.6)));

// The brush: Satie's tune, one stroke per phrase, the rising steps, the solo's top line, the closing song; the red is
// only at the doors. The brush draws an enso on the first big chord after a long note and slashes within 6 s of it, so
// in the brush's own copy the C blows (133.27, 202.50 s) end after 1.3 s instead of 1.7 s: then C slashes and the D
// that it resolves to (held 3.5 s) closes the circle. The final A+D hit rings on in its delay to 291 s, so its
// copy lasts 2.2 s: the last enso. The C major chords before it (285.58, 286.15 s) slash.
const trimC = (n) => (Math.abs(n[0] - 133.27) < 0.05 || Math.abs(n[0] - 202.5) < 0.05 ? [n[0], r3(n[0] + 1.3), n[2], n[3]] : n);
const ringHit = (n) => (Math.abs(n[0] - 287.29) < 0.05 ? [n[0], r3(n[0] + 2.2), n[2], n[3]] : n);
// The rising steps are chords, and the brush slashed each one (the first preview had five slashes per door): here only
// each step's top note, so the stroke climbs into the door and the red is kept for C and D.
const steps = attacks(set('cadence-approach')).map((a) => a.ns.reduce((b, n) => (n[2] > b[2] ? n : b)));
// The solo (sixteenth runs, up to 13 attacks a bar) gets a quicker ink and a flatter stroke, note by note (stay 2.2,
// leap 4), so the runs streak instead of piling three rows of ink; the tune keeps the clip's values.
const solo = set('solo-line').map((n) => val(n, { stay: 2.2, leap: 4 }));
const ink = union(set('theme-a'), steps, blows.map(trimC), set('theme-b'), solo, set('lead-descent'), closing.map(ringHit));

// The room: Rothko fields on every note of the pack, plus the kick from the band's entry on, as a low note on the
// floor (the kick is GM 36, not a pitch: here it takes the pitch of the bass that sounds with it, so it lights the
// bottom field without bending the harmony the fields colour by).
const kicks = onBass(set('kick'));
const room = union(PACK, kicks).filter((n) => n[0] < 290.4);
// The two lamps (critic, round 4): wherever the dancers dance (the drums' vamp, the interlude, the groove's comping),
// the one room splits into two tall Rothko panels, the G bar's on the left and the D bar's on the right, each lit only
// by the notes of its own bars (the bar decides, as for the dancers). So the rocking is light moving left and right,
// panel to panel, and the two-against-one grammar is the same in the ground as in the flock: two lamps and two dancers
// while the harmony only rocks, one room and one flock whenever it moves.
const BAR = 1.7308, sideAt = (t) => (Math.round((t - 0.59) / BAR) % 2 === 0 ? 'G' : 'D');
const lampG = room.filter((n) => sideAt(n[0]) === 'G'), lampD = room.filter((n) => sideAt(n[0]) === 'D');

// ---- regions: the two dancers, side by side, each over its own lamp ----
// 'contain': the whole flock is seen, smaller (a crop cut its ribbon into hard L shapes at the window's edges).
const dancer = (x) => ({ mode: 'window', shape: 'rect', x, y: 0.5, w: 0.56, h: 1, feather: 0.3, fit: 'contain' });
const LEFT = dancer(0.26), RIGHT = dancer(0.74);
// The lamps: tall panels (the fields' horizontal bands stretched upright, like the Seagram murals), a dark gap between.
const lamp = (x) => ({ mode: 'window', shape: 'rect', x, y: 0.5, w: 0.44, h: 0.84, feather: 0.12, fit: 'stretch' });
const LAMP_L = lamp(0.26), LAMP_R = lamp(0.74);

// ---- the clips ----
const clips = [];
const clip = (o) => clips.push({ id: `c${clips.length + 1}`, fade: 1, ...o, start: r3(o.start), end: r3(o.end) });
const pv = (pairs) => pairs.map(([t, v, shape]) => (shape ? { t, v, shape } : { t, v }));

// Track 0: the room, the full-screen fields, only where the harmony moves and the one flock flies: the band's theme
// (from its first bass note, 69.2 s, to the first ring-out), the return (to the second ring-out, where it goes out for
// the stillness) and the solo's climb and the closing song (from 252.7 s, out before the echo tail ends).
// The combo's values (home -0.6, chords 0.5) went oxblood and orange here (first preview): home follows the loudness
// (+level, loud = warmer) and the band is loud, and plum sits next to red on the fields' closed palette, so a chord a
// few fifths away wrapped into red. Here home is deep blue and held (no drive). chords 0.15 (critic; the composer had
// 0.25, and 0.15 still swung the top field to teal and green on Em, C and F; 0.07 keeps it violet and blue, and the
// notes still light the fields from inside): dusk all the way.
const ROOM = { home: { base: -1, drive: '', depth: 0 }, chords: 0.07 };
clip({ track: 0, widget: 'fields', start: 69.2, end: 138.4, fade: 0.6, listen: use('room', room), knobs: ROOM,
  intensity: pv([[69.2, 0.75, 'ease'], [76.7, 1], [135, 1, 'ease'], [137.6, 0.35]]) });
clip({ track: 0, widget: 'fields', start: 159.0, end: 206.8, fade: 1, listen: 'picks:room', knobs: ROOM,
  intensity: pv([[159.0, 0.5, 'ease'], [162, 0.9], [200.8, 1], [204.4, 1, 'ease'], [206.6, 0]]) });
clip({ track: 0, widget: 'fields', start: 252.7, end: 290.6, fade: 0.4, listen: 'picks:room', knobs: ROOM,
  intensity: pv([[252.7, 0.9, 'ease'], [254.5, 1], [275.2, 0.9, 'ease'], [287.6, 0.5], [290.4, 0]]) });

// Tracks 1-2: the two lamps, where the harmony only rocks: the drums' vamp (from the hats at 28.2 s; they go out on
// the snare pickup, so the band's first bass note lights the room), the interlude (dim), and the groove (from the fill,
// lit by the kicks too, to the solo's climb). Each lamp hears only its own bars. The G lamp is the deep blue home; the
// D lamp leans a step towards plum (home -0.7), so the two panels are two colours of one dusk and the eye can tell the
// chords apart by where the light is and by its tint.
const LAMP_G = { ...ROOM, chords: 0.12 }, LAMP_D = { ...LAMP_G, home: { base: -0.7, drive: '', depth: 0 } };
const lamps = (tag, a, b, fade, curve) => {
  clip({ track: 1, widget: 'fields', start: a, end: b, fade, region: LAMP_L, knobs: LAMP_G, listen: use(`lamp-g${tag}`, lampG.filter((n) => n[0] < b - 0.06)), intensity: pv(curve) });
  clip({ track: 2, widget: 'fields', start: a, end: b, fade, region: LAMP_R, knobs: LAMP_D, listen: use(`lamp-d${tag}`, lampD.filter((n) => n[0] < b - 0.06)), intensity: pv(curve) });
};
lamps('1', 27.8, 69.0, 0.7, [[28.2, 0, 'ease'], [34, 0.55], [42, 0.7], [67.6, 0.75]]);
lamps('2', 139.6, 159.0, 1.5, [[139.6, 0.5], [158.0, 0.5]]);
lamps('3', 207.0, 252.85, 0.3, [[207.05, 0.2, 'ease'], [207.8, 0.8], [235.4, 0.9], [251.5, 0.9]]);

// Track 3: the current, one clip from the ticks to the end. hue 32 (amber): the chords pour lamplight into the
// violet water, not red (the red belongs to the brush); violet dye vanished into the violet fields. How present tells
// the story: a lone thread for the ticks, the braid opens with the drums, full with the band and the climbs, a lone
// thread again in each ring-out and the interlude, full in the solo, then back to one thread for the echo tail.
clip({ track: 3, widget: 'current', start: 13.6, end: 291.8, fade: 1.2, listen: use('braid', braid), knobs: { hue: 32 },
  intensityMoves: 'present',
  intensity: pv([[13.8, 0.05], [28.2, 0.05, 'ease'], [42, 0.45], [67.8, 0.5, 'ease'], [70, 0.8], [110.8, 0.8, 'ease'], [114.9, 1], [133, 1],
    [135, 1, 'ease'], [137.5, 0.15], [138.5, 0.25], [158.8, 0.3, 'ease'], [161, 0.75], [180, 0.8, 'ease'], [184.6, 1], [204.2, 1, 'ease'],
    [206.2, 0.05], [207.09, 0.05, 'ease'], [208, 0.8], [235.4, 0.85, 'ease'], [252.7, 1], [275.2, 0.9, 'ease'], [285.6, 0.4, 'ease'], [289, 0.05]]) });

// Tracks 4-5: the dancers (murmuration in two windows, each over its lamp). strike 1: every chord re-forms its dancer;
// hold 1.9 s, about a bar: a dancer holds its figure while its chord rings and melts as the partner forms. In the
// groove hold 1.2 (the comping is short and punchy).
// trail 5 and tight 0.8 for both: at the defaults the small figures were hairy bundles of streaks; shorter, tighter
// streaks draw the chord's shape.
// Red (critic): the red belongs to the doors. With the default bleed the flock stained red on routine pah chords and
// burst into red spiky balls after quiet spells (70, 113, 160 s), so the cadences' red no longer stood out. Every flock
// and dancer is bone here (bleed 0.1); the groove's dancers keep a blush (0.3), the one hot stretch of the piece.
const SHAPE = { trail: 5, tight: 0.8 };
const QUIET = { strike: 1, hold: 1.9, bleed: 0.1, ...SHAPE }, PUNCHY = { strike: 1, hold: 1.2, bleed: 0.3, ...SHAPE };
// Each dancer and each flock enters with its own first chord (the D dancer at 2.32 s), not as a knot waiting: before
// its first chord a murmuration sits as a dark-red knot, and the critic's preview showed that knot as a red disc in
// the lamps at 138–141 and 208–210 s and in the room at 253 s (red where nothing red was played).
const dancers = (tag, d, start, end, knobs, fade, startD = start) => {
  clip({ track: 4, widget: 'murmuration', start, end, fade, region: LEFT, knobs,
    listen: use(`dance-g${tag}`, union(figureSet(d.G, () => ({}), `dancer G${tag}`), startles(d.eG))) });
  clip({ track: 5, widget: 'murmuration', start: startD, end, fade, region: RIGHT, knobs,
    listen: use(`dance-d${tag}`, union(figureSet(d.D, () => ({}), `dancer D${tag}`), startles(d.eD))) });
};
dancers('1', d1, 0.35, 70.2, QUIET, 0.2, 2.28);
dancers('2', d2, 138.99, 159.9, QUIET, 1.2, 140.72);
dancers('3', d3, 208.22, 252.7, PUNCHY, 0.7, 209.95);

// Track 6: the one flock, in the middle, full size. strike 1, bleed 0.1 (bone: see above). The held lenses in the
// ring-outs are a bone eye, not a red one; the red there is the brush's slash and enso.
const FLOCK = { strike: 1, bleed: 0.1 };
clip({ track: 6, widget: 'murmuration', start: 69.76, end: 139.6, fade: 0.3, listen: use('flock-1', flock1), knobs: FLOCK });
clip({ track: 6, widget: 'murmuration', start: 159.76, end: 208.6, fade: 0.3, listen: use('flock-2', flock2), knobs: FLOCK });
clip({ track: 6, widget: 'murmuration', start: 253.22, end: 291.9, fade: 0.3, listen: use('flock-3', flock3), knobs: FLOCK });

// Tracks 7-8: the ink, in pieces cut at the tune's breaths. size 0.6 (the default 1.2, driven louder → thicker, made
// fat bone worms of a loud band), stay 3.5 (at 8 the page filled with three rows of drying ink), leap 9 (the stroke
// climbs and dives with Satie's leaps, F#5 to A6).
// Why pieces (critic): the brush dries its ink by rubbing the page out a little every quarter second, and on an 8-bit
// page the faintest ink never quite goes: one clip from 76 s to the end left a grey layer of old strokes that grew all
// show long (thick at 140-160, 205 and 284-292 s). A new clip starts on a clean page, so each piece is a few phrases
// long, cut where the tune breathes, and the next piece starts on the other track while the old one dries and fades.
// Each piece hears only its own notes (no stroke twice).
const INK = { size: 0.6, stay: 3.5, leap: 9 };
const inkPieces = [
  [7, 76.4, 105.3, 0.8], [8, 105.0, 122.6, 1], [7, 121.9, 140.5, 1.5],   // B: phrases 1-4, 5-7, 8 and door 1 (its ring-out)
  [7, 159.4, 181.5, 1.5], [8, 179.6, 207.7, 0.6],                        // D: phrases 1-3, 4-6 and door 2 (the stillness)
  [7, 214.0, 234.0, 0.5], [7, 234.0, 241.5, 0.5], [7, 241.5, 259.5, 0.5], [7, 259.5, 275.4, 0.5], // the solo, at its rests
  [8, 274.8, 292.4, 0.8],                                                 // the closing song, the close, the last enso
];
// The notes go to the pieces by split points, each in a rest of the tune, so the overlaps hear nothing twice.
const cuts = [[76.4, 105.3], [105.3, 122.0], [122.0, 140.5], [159.4, 179.8], [179.8, 207.7],
  [214.0, 234.0], [234.0, 241.5], [241.5, 259.5], [259.5, 275.0], [275.0, 292.4]];
inkPieces.forEach(([track, a, b, fade], i) => {
  const [lo, hi] = cuts[i];
  clip({ track, widget: 'brush', start: a, end: b, fade, knobs: INK, listen: use(`ink-${i + 1}`, ink.filter((n) => n[0] >= lo && n[0] < hi)) });
});
{ const lost = ink.filter((n) => !cuts.some(([lo, hi]) => n[0] >= lo && n[0] < hi)); if (lost.length) throw new Error(`ink notes in no piece: ${lost.map((n) => n[0]).join(" ")}`); }

// Trim every set to the clips that hear it (a pick no clip hears is a warning).
for (const [id, s] of Object.entries(picks)) {
  const cs = clips.filter((c) => c.listen === `picks:${id}`);
  s.notes = s.notes.filter((n) => cs.some((c) => n[0] >= c.start && n[0] < c.end));
  if (!s.notes.length) throw new Error(`${id}: nothing inside its clips`);
}

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Satie: Gymnopédie No. 1 (jazz mix) · A · Ink on dusk: two murmuration dancers for the rocking Gmaj7/Dmaj7 that become one flock when the harmony moves, a bone calligraphy stroke for the tune with red only at the cadences, the current braiding bass and inner voices, Rothko fields lit by the band',
  composer: { by: 'claude', at: new Date().toISOString() },
  clips, picks,
};
// One clip and one picked note a line.
const head = JSON.stringify({ ...show, clips: undefined, picks: undefined }, null, 2).replace(/\n}$/, '');
const body = `${head},\n  "clips": [\n${clips.map((c) => `    ${JSON.stringify(c)}`).join(',\n')}\n  ],\n  "picks": {\n${
  Object.entries(picks).map(([k, v]) => `    ${JSON.stringify(k)}: { "notes": [\n${v.notes.map((n) => `      ${JSON.stringify(n)}`).join(',\n')}\n    ] }`).join(',\n')}\n  }\n}\n`;
JSON.parse(body);
writeFileSync(join(ROOT, `shows/${ID}.json`), body);
console.log(`${ID}: ${clips.length} clips, ${Object.keys(picks).length} sets`,
  Object.fromEntries(Object.entries(picks).map(([k, v]) => [k, v.notes.length])));
