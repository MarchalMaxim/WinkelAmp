// Builds shows/danse-macabre-a-midnight-on-black.json: "Midnight on black", the family of STYLE.md's "Bells, a flare and a
// sinking voice" (small red bells, an ink-blue sail, milk-white keys, silver shards, hairline threads) on pure black,
// over the whole of Saint-Saëns' Danse macabre. Reads picks.json (this folder, made by gen-picks.mjs; ANALYSIS.md says
// what each set is). Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/danse-macabre/build-danse-macabre-a-midnight-on-black.mjs
//
// THE PLAN (one widget per strand; every motif clip hears the notes one hears as that strand)
//   bells    the harp's twelve strokes: twelve small windows round a clock face, one stroke each, a red slab struck bone-hot
//            (handover, milk off: the only widget whose slab stands at a fixed place, so the ring is exact). The 12th lands
//            at the top. The hush chord is one milky slab in the centre; then 1.5 s of total black before Death appears.
//            Later bells are squares-snap, small and calm: the E and A tolls, the chorale's slow bass (a Dies irae bell),
//            the strong strikes, the drums. Brass chords get milky squares (the a2 verdict).
//   sail     Death's fiddle is film, one ink-blue sail: the tritone tuning (kick pushed to 0.4 so the corners whip),
//            the tritone again in the swell, the winds, the fugato's upper voices, the line over the pedals, the second
//            tutti, the woodwind interlude, the development, the recapitulation's top, the frenzy; at dawn the oboe's
//            cock-crow takes the sail, and the violin's farewell is the last, slow sail.
//   keys     the waltz's tunes are Ivory, one short row per phrase. Theme B (the sighing chromatic descent) is a sinking
//            voice: its four solo phrases stand on a staircase of windows going down the screen; the tutti theme B
//            comes back as three big rows. The chorale's four phrases are rows too, and the chromatic ascent is one
//            ladder whose stomp lands on the recapitulation.
//   threads  the pizzicato is pluck, hairline threads: grave pizz, the open fifths, the oom of the waltz, the harp,
//            the bass of the tuttis, the fugato's subject, the harp round the chorale, the last scurry and the end.
//   bones    mica's silver shards on the hammered chords and the xylophone; crimp knocks on the repeated D chords.
//   milk     handover's milky slabs on long, slow notes only: the legato theme B tutti, the interlude's strings, the
//            bowed bass of the long build, the recapitulation's held notes, the dawn chords (rolls merged to one strike).
//   fire     fireworks-snap only on the real ff blows and the nine last brass blows, which grow (per-note size).
//   readers  the fugato under a time slice (a canon is a line delayed against itself: the slit-scan shows it); the
//            recapitulation, where themes A and B sound together, under a fold that turns with the bass.
//   dawn     the show's only colour field rises with the cock-crow's held G5 and sinks with the last G minor chord.
// Total stillness twice: the hush (10.6-13.6) and after the last blow (376.9-378.9) until the crow.
// CRITIC (2026-11-06, second pass): ridges as the ribs, the dance's ground (26-376.9, a full-frame small copy, a story told
// by its intensity curve; the time slice and the fold now have something to cut and mirror), and the midnight dial
// returning in the frenzy, one hour per beat, a red hand racing to dawn. Legend: danse-macabre-a-midnight-on-black.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = 'danse-macabre', ID = 'danse-macabre-a-midnight-on-black';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The notes of a set (copies), optionally only those starting in [a, b). */
const S = (id, a = -1, b = 1e9) => {
  if (!P[id]) throw new Error(`no set ${id}`);
  return P[id].notes.filter((n) => n[0] >= a && n[0] < b).map((n) => [n[0], n[1], n[2], n[3]]);
};
/** The notes of a pack lane in [a, b), as picks. */
const S2 = (track, a, b) => pack.tracks[track].notes.filter((n) => n[0] >= a && n[0] < b).map((n) => [n[0], n[1], n[2], n[3]]);
/** Several note lists as one, sorted, without doubles (same start to 10 ms and pitch). */
const merge = (...lists) => {
  const seen = new Set(), out = [];
  for (const n of lists.flat()) { const k = `${Math.round(n[0] * 100)}:${n[2]}`; if (!seen.has(k)) { seen.add(k); out.push(n); } }
  return out.sort((p, q) => p[0] - q[0] || p[2] - q[2]);
};
/** Without the notes of `minus` (same start to 30 ms and pitch). */
const without = (notes, minus) => notes.filter((n) => !minus.some((m) => Math.abs(m[0] - n[0]) < 0.03 && m[2] === n[2]));
/** Per-note values: fn(note, i, all) returns { intensity?, <knob>? }. */
const vals = (notes, fn) => notes.map((n, i) => withValues([n[0], n[1], n[2], n[3]], fn(n, i, notes)));
/** A rolled chord is one gesture: attacks closer than `gap` join the first one. */
const unroll = (notes, gap = 0.16) => {
  let t0 = -1;
  return notes.map((n) => { if (n[0] - t0 > gap) t0 = n[0]; return [t0, Math.max(n[1], t0 + 0.05), n[2], n[3]]; });
};
const lerp = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, a] = pts[i - 1], [t1, b] = pts[i]; return a + (b - a) * (t - t0) / (t1 - t0); }
  return pts[pts.length - 1][1];
};

// ---------- tracks by role, bottom to top; each clip takes the lowest free track of its band ----------
const BANDS = { field: [0, 0], milk: [1, 3], pluck: [4, 5], crimp: [6, 6], mica: [7, 9], sail: [10, 11], keys: [12, 15],
  bells: [16, 17], ring: [18, 29], fire: [30, 30], reader: [31, 31] };
const clips = [], picks = {};
let nClip = 0;
function place(band, start, end) {
  const [lo, hi] = BANDS[band];
  for (let t = lo; t <= hi; t++) if (!clips.some((c) => c.track === t && c.start < end && start < c.end)) return t;
  throw new Error(`band ${band} full at ${start}-${end}`);
}
/** One clip. notes: its pick set (named setId); start/end default to the notes plus pre/post. */
function clip(band, widget, o) {
  const notes = o.notes;
  let start = o.start, end = o.end;
  if (notes && notes.length) {
    if (start === undefined) start = notes[0][0] - (o.pre ?? 0.3);
    if (end === undefined) end = notes[notes.length - 1][0] + (o.post ?? 2.5);
  }
  start = r3(Math.max(0, start)); end = r3(Math.min(429.8, end));
  const c = { id: `c${++nClip}`, start, end, track: place(band, start, end), fade: o.fade ?? 0.25, widget };
  if (o.knobs) c.knobs = o.knobs;
  if (notes) {
    const id = o.set;
    if (picks[id]) throw new Error(`set ${id} twice`);
    const heard = notes.filter((n) => n[0] >= start && n[0] < end);
    if (!heard.length) throw new Error(`${id}: no notes in ${start}-${end}`);
    picks[id] = { notes: heard };
    c.listen = `picks:${id}`;
  } else if (o.listen) c.listen = o.listen;
  if (o.region) c.region = o.region;
  if (o.intensity) c.intensity = o.intensity.map(([t, v, shape]) => (shape ? { t, v, shape } : { t, v }));
  clips.push(c);
  return c;
}
const win = (x, y, w, h, extra = {}) => ({ mode: 'window', shape: 'rect', x: r3(x), y: r3(y), w: r3(w), h: r3(h), feather: 0.05, ...extra });

// =====================================================================================================================
// 0-13.6 MIDNIGHT. Twelve strokes round a clock face. handover's slab stands at a fixed place for a pitch (x by pitch, y
// by octave), so in a stretched window each D4 lands exactly where its window puts it. size 1 at v~30 is a 300x188 slab
// on the 1280x720 canvas; a window of 0.1667 x 0.2667 (213 x 192 px) stretches it to a 50 px square. The slab's centre on
// the canvas is (607.6, 405.5): the window's centre is moved by that offset so the square sits on the ring.
{
  const strokes = S('clock-strokes');
  const R = 0.30 * 720, ww = 0.1667, wh = 0.2667;
  const offX = (607.6 / 1280 - 0.5) * ww * 1280, offY = (405.5 / 720 - 0.5) * wh * 720;
  strokes.forEach((n, k) => {
    const th = ((k + 1) * 30) * Math.PI / 180;              // stroke k+1 at (k+1) o'clock: the twelfth at the top
    const px = 640 + R * Math.sin(th), py = 360 - R * Math.cos(th);
    const last = k === strokes.length - 1;
    clip('ring', 'handover', {
      set: `bell-${k + 1}`, notes: [n], pre: 0.12, post: 2.62, fade: 0.08,
      // goneBy 2.5: each stroke rings out over two and a half bars; ring 3 keeps the square full before it shrinks.
      knobs: { milk: 0, goneBy: 2.5, ring: last ? 3 : 2.2, size: 1, presence: 1 },
      region: win((px - offX) / 1280, (py - offY) / 720, ww, wh, { fit: 'stretch' }),
    });
  });
  // The hush: the pp D major chord as milky slabs in the clock's centre, dying with the held D. Then nothing.
  clip('milk', 'handover', {
    set: 'hush', notes: S('hush-chord'), pre: 0.15, post: 2.6, fade: 0.1,
    knobs: { milk: 1, goneBy: 2.5, ring: 3, size: 1.6, presence: 1 },
    region: win(0.5, 0.42, 0.36, 0.5, { fit: 'contain' }),
  });

  // CRITIC'S ADDITION. 360.9-374.7 THE CLOCK RETURNS, RACING. The frenzy's every beat (librosa beat_track on the audio,
  // 215 bpm; the roll has too few notes here to carry a beat) lights the
  // next hour of the same twelve windows, clockwise from twelve: the dial midnight struck slowly now spins, one turn per
  // four bars, a red hand with a short comet tail of shrinking squares, until the nine last blows. Each window hears one
  // tick in twelve (3.1 s apart), so no slab ever flashes; the eye sees the hand move, as the ear hears the dance race to
  // dawn. Velocity follows the audio's loudness at the beat (-26..-15 dB -> 85..115); size 0.62 at those velocities keeps
  // the squares close to midnight's 50 px (a little bigger as it gets louder).
  const BEATS = [[360.87, -26], [361.15, -16], [361.42, -17], [361.68, -17], [361.94, -18], [362.19, -19], [362.42, -17],
    [362.68, -18], [362.91, -20], [363.17, -20], [363.42, -20], [363.70, -20], [363.98, -21], [364.23, -20], [364.51, -18],
    [364.77, -18], [365.02, -18], [365.28, -19], [365.53, -18], [365.79, -18], [366.04, -18], [366.30, -19], [366.58, -22],
    [366.86, -23], [367.14, -22], [367.44, -19], [367.72, -19], [368.02, -17], [368.30, -17], [368.58, -17], [368.85, -20],
    [369.13, -21], [369.39, -21], [369.62, -23], [369.88, -17], [370.15, -19], [370.46, -23], [370.74, -23], [371.01, -24],
    [371.29, -19], [371.55, -18], [371.80, -20], [372.06, -19], [372.34, -20], [372.62, -22], [372.92, -20], [373.20, -20],
    [373.50, -18], [373.78, -18], [374.06, -18], [374.36, -19], [374.66, -18]];
  // No fake attacks: a beat strikes only where librosa's onset_detect found an attack within 60 ms, and the square lands
  // on that onset. A beat without one (17 of 52, e.g. the 0.8 s at 368.34-369.13 with no onset) is left dark, a gap in the
  // hand; the hour still counts on, so the hand keeps time.
  const ONSETS = [360.59, 361.10, 361.15, 361.42, 361.68, 361.91, 361.96, 362.19, 362.42, 362.65, 362.91, 363.14, 363.40,
    363.72, 363.82, 364.12, 364.33, 364.51, 364.77, 365.09, 365.28, 365.53, 365.77, 366.00, 366.23, 366.49, 366.70, 366.97,
    367.14, 367.23, 367.44, 367.69, 367.93, 368.02, 368.11, 368.34, 369.13, 369.39, 369.62, 369.83, 370.11, 370.57, 370.83,
    371.29, 371.57, 372.04, 372.31, 372.76, 372.83, 373.03, 373.27, 373.50, 373.75, 373.80, 373.99, 374.06, 374.22, 374.50,
    374.71];
  let lit = 0;
  // One short clip per tick (its window lives only while its square does), so at most five dial windows run at once.
  BEATS.forEach(([b, db], j) => {
    const on = ONSETS.reduce((best, o) => (Math.abs(o - b) < Math.abs(best - b) ? o : best), -1e9);
    if (Math.abs(on - b) > 0.06) return;
    const t = on; lit++;
    const v = Math.round(85 + 30 * Math.max(0, Math.min(1, (db + 26) / 11)));
    const th = ((j % 12) * 30) * Math.PI / 180;                // the first beat at twelve, then clockwise
    const px = 640 + R * Math.sin(th), py = 360 - R * Math.cos(th);
    clip('ring', 'handover', {
      set: `tick-${j + 1}`, notes: [[t, r3(t + 0.2), 62, v]], pre: 0.06, post: 1.08, fade: 0.04,
      knobs: { milk: 0, goneBy: 1.0, ring: 1.6, size: 0.62, presence: 1 },
      region: win((px - offX) / 1280, (py - offY) / 720, ww, wh, { fit: 'stretch' }),
    });
  });
  console.log(`dial: ${lit} of ${BEATS.length} beats lit (onset within 60 ms)`);
}

// =====================================================================================================================
// CRITIC'S ADDITION. THE RIBS: ridges as the dance's ground, from the first downbeat of the waltz to the last blow. Its
// white ridgelines on black (warm on the bass side, bone in the middle, cool on the treble side, an ember on each crest)
// are the one thing that fills the black without colour: a ribcage of the whole orchestra that heaves with every bar.
// It listens to all notes (a ground, not a strand), drawn in a full-frame small copy so its own black is see-through
// and it never wipes the bells' and sails' fading trails. The intensity curve tells the story: the dead rise with the
// waltz, sink under Death's solo, heave fully in the tuttis, give the time slice something to cut in the fugato (a canon
// of ridgelines) and the fold something to mirror in the recapitulation (a symmetrical ribcage); they vanish at the
// chorale's sudden drop (the Dies irae is sung over no dance) and at the break, and freeze into nothing on the last blow.
clip('field', 'ridges', { start: 26.0, end: 376.95, fade: 0.05, listen: 'all',
  region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, fit: 'stretch' },
  intensity: [[26.0, 0], [29.5, 0.4, 'ease'], [41.0, 0.45], [42.5, 0.25], [55.1, 0.3], [68.5, 0.65], [71.7, 1], [86.4, 1],
    [88, 0.75], [100.6, 0.8], [102, 0.95], [120.4, 0.95], [122, 0.85], [149.5, 0.8], [175.0, 0.85], [175.4, 0.85, 'ease'],
    [176.6, 0], [212.6, 0], [213.0, 0.35], [222, 1], [244.3, 1], [244.5, 0], [248.0, 0], [250.5, 0.3, 'ease'], [272.5, 0.35],
    [282, 0.55], [297, 0.6], [320.4, 1], [360.3, 1], [361.5, 0.7], [374.7, 0.7], [374.9, 1], [376.85, 1], [376.95, 0]] });

// =====================================================================================================================
// THREADS: pluck, the pizzicato and the plucked strings. One clip per stretch where they are struck (none in the legato
// theme B tutti, the tolls, the long build or the farewell, which are bowed or sung).
{
  // Death appears (low pizzicato, long threads pulled far), the open D-A fifths answering the tritone, then the waltz.
  const intro = vals(merge(S('grave-pizz'), S('tuning-fifths')), (n) => n[0] < 18.7
    ? { pull: 1.5, ring: 1.6, intensity: 1.3 } : { pull: 0.9, ring: 0.8, intensity: 1.1 });
  const waltz = vals(merge(S('pizz-waltz-bass'), S('harp-chords-31')), (n) => ({ intensity: n[0] < 41 ? 1.1 : 1 }));
  const tutti1 = vals(merge(S('bass-tutti-1', 71.8, 86.3), S('bass-tutti-1', 100.6, 119)), () => ({ pull: 1.2 }));
  clip('pluck', 'pluck', { set: 'pizz-1', notes: merge(intro, waltz, tutti1), pre: 0.2, post: 1.6, fade: 0.15 });
  // The fugato's subject in the cellos: long low threads, each entry a new pull.
  clip('pluck', 'pluck', { set: 'fugato-subject', notes: vals(S('fugato-subject-low'), () => ({ pull: 1.3, intensity: 1.2 })), post: 1.5 });
  // The harp rippling round the chorale: short, soft, no long red line (slow quiet passage: nothing busy, nothing red).
  clip('pluck', 'pluck', { set: 'harp', notes: vals(S('harp-arpeggios'), () => ({ pull: 0.6, ring: 0.35, intensity: 0.7 })), post: 1.2 });
  // The second tutti's bass, the interlude's bass (dim), the development's pedals up to the long build.
  const t2 = vals(S('bass-tutti-2', 213, 244.4), () => ({ pull: 1.2 }));
  const inter = vals(S('thread-low', 248, 272.5), () => ({ intensity: 0.65, ring: 0.6 }));
  const dev = vals(S('bass-development', 272.5, 297), () => ({ intensity: 0.95 }));
  clip('pluck', 'pluck', { set: 'pizz-2', notes: merge(t2, inter, dev), post: 1.4 });
  // The frenzy's bass (the recapitulation's is mica's), and the low A-Bb trill under the G pedal.
  clip('pluck', 'pluck', { set: 'pizz-3', notes: merge(vals(S('bass-finale', 360.5, 375), () => ({ pull: 1.3 })),
    vals(S('bass-trill'), () => ({ pull: 0.8, intensity: 0.9 }))), post: 1.2 });
  // Dawn's measured tremolo dying away.
  clip('pluck', 'pluck', { set: 'tremolo', notes: vals(S('dawn-tremolo'), (n, i, a) => ({ intensity: lerp([[385, 0.9], [387, 0.45]])(n[0]), pull: 0.7 })), post: 1.2 });
  // The skeletons slip back: the violin's trill, the scurry, the last pizzicati and the two chords.
  const end = merge(vals(S('last-trill'), () => ({ pull: 0.5, intensity: 1.2 })), vals(S('scurry'), () => ({ intensity: 1.3 })),
    vals(S('final-pizz'), (n) => ({ pull: n[0] > 426 ? 1.6 : 1.3, ring: n[0] > 426 ? 2.2 : 1.2, intensity: 1.5 })));
  clip('pluck', 'pluck', { set: 'flee-home', notes: end, end: 429.8, fade: 0.2 });
}

// =====================================================================================================================
// SAIL: film, Death's fiddle. kick (how far a corner overshoots) is the one knob it wears per note: 0.4 where the fiddle
// whips (the tuning, the swell's tritone, the frenzy), low where it sings (the winds, the farewell).
{
  const sail = (set, notes, knobs, o = {}) => clip('sail', 'film', { set, notes, knobs, post: (knobs.stay ?? 2) + 0.4, ...o });
  sail('tritone', vals(S('tuning-tritone'), () => ({ kick: 0.4 })), { stay: 2.1, tips: 1 }, { pre: 0.25 });
  // Theme A in D: the winds' answers and the scattered high line (the roll has no clean tune here), then the swell's tritone.
  sail('winds-swell', merge(vals(merge(S('winds-56'), S('theme-a-in-d')), () => ({ kick: 0.1 })), vals(S('build-to-tutti'), () => ({ kick: 0.4 }))), { stay: 2.2, tips: 0.6 });
  sail('fugato-high', vals(S('fugato-high'), () => ({ kick: 0.2 })), { stay: 2.6, tips: 0.8, corners: 4 });
  sail('over-pedals', vals(S('pedal-line-high'), () => ({ kick: 0.2 })), { stay: 1.4, tips: 0.6 });
  sail('tutti-c', vals(S('tutti-c-line'), () => ({ kick: 0.3 })), { stay: 2, tips: 0.9 });
  sail('woodwinds', vals(S('winds-interlude'), () => ({ kick: 0.06, intensity: 0.8 })), { stay: 1.2, tips: 0.35, corners: 4 });
  sail('development', vals(S('development-line'), () => ({ kick: 0.15 })), { stay: 2, tips: 0.6 });
  // The recapitulation's top: the violins' highest notes and the voiced-out high line, so the sail never drops out.
  sail('recap-top', vals(merge(S('recap-high'), S('thread-high', 323, 360.5)), () => ({ kick: 0.25 })), { stay: 3, tips: 0.8 });
  sail('frenzy', vals(S('frenzy-line'), () => ({ kick: 0.4, intensity: 1.2 })), { stay: 1.4, tips: 1 });
  // Dawn: the rooster takes the sail, alone in the decay; the held G5 keeps it up.
  sail('cock-crow', vals(S('cock-crow'), () => ({ kick: 0.22 })), { stay: 3.4, tips: 0.8 }, { pre: 0.4, post: 3.5 });
  // The violin's farewell: the last sail, slow, its corners laid without a whip, held between the long notes.
  sail('farewell', vals(S('farewell-violin'), () => ({ kick: 0.03, intensity: 1.6 })), { stay: 4, tips: 0.25 }, { post: 3.4, fade: 0.6 });
}

// =====================================================================================================================
// KEYS: Ivory, one short row per phrase (a row gives way as the next begins).
{
  const rows = [];
  const row = (set, notes, o = {}) => rows.push({ set, notes, ...o });
  // Theme A in the flute: its two phrases (nothing is in the roll 30.7-34.4: the harp threads fill it).
  row('flute-1', S('theme-a-flute', 26, 31));
  row('flute-2', S('theme-a-flute', 34, 42));
  // Theme B, the solo violin's sighing descent: a sinking voice, each phrase a step lower on a staircase of windows.
  const stair = [[0.3, 0.32], [0.7, 0.45], [0.32, 0.6], [0.68, 0.74]];
  ['theme-b-solo-p1', 'theme-b-solo-p2', 'theme-b-solo-p3', 'theme-b-solo-p4'].forEach((id, k) =>
    row(`solo-b${k + 1}`, S(id), { knobs: { huddle: 1 }, region: win(stair[k][0], stair[k][1], 0.5, 0.5, { fit: 'contain' }) }));
  // Theme A forte: two phrases high on Bb5-C6.
  row('tutti-a1', S('theme-a-tutti', 71, 78.3));
  row('tutti-a2', S('theme-a-tutti', 78.3, 86));
  // Theme B sung by all the strings: three big rows, the whole width (the voice that sank is now everyone's).
  ['theme-b-tutti-p1', 'theme-b-tutti-p2', 'theme-b-tutti-p3'].forEach((id, k) => row(`tutti-b${k + 1}`, S(id)));
  // Theme A in D with the xylophone: the violins' high line in two phrases.
  row('xylo-a1', S('theme-a-xylophone-d', 100, 107));
  row('xylo-a2', S('theme-a-xylophone-d', 107, 115));
  // The chorale's four phrases, huddled in the middle (the Dies irae as a narrow column of keys).
  ['chorale-p1', 'chorale-p2', 'chorale-p3'].forEach((id, k) =>
    row(`chorale-${k + 1}`, S(id), { knobs: { huddle: 0.8 }, region: win(0.5, 0.5, 0.6, 1, { fit: 'stretch' }) }));
  // The long build: theme A in D rising to ff, two phrases, then the repeated A4s.
  row('build-1', S('build-line', 297, 306));
  row('build-2', S('build-line', 306, 316));
  row('build-3', S('build-line', 316, 320));
  // The chromatic ascent: one ladder; its stomp, on the top note, is the recapitulation's first beat.
  row('ascent', vals(S('chromatic-ascent'), (n, i, a) => (i === a.length - 1 ? { intensity: 1.8 } : {})), { knobs: { crater: 0.6, ripple: 4 } });
  rows.forEach((r, k) => {
    const next = rows[k + 1];
    const last = r.notes[r.notes.length - 1][0];
    let end = last + 3.7;
    if (next && next.notes[0][0] < end && !(r.region && next.region && r.region.y !== next.region.y && r.set.startsWith('solo'))) end = Math.max(last + 0.6, next.notes[0][0] + 0.2);
    clip('keys', 'ivory', { set: r.set, notes: r.notes, pre: 0.35, end, fade: 0.2, knobs: r.knobs, region: r.region });
  });
}

// =====================================================================================================================
// BONES: mica's silver shards on the hammered chords and the xylophone; crimp knocks on the repeated D chords.
{
  clip('mica', 'mica', { set: 'bones-80', notes: S('hammered-chords-80'), post: 1.2 });
  clip('mica', 'mica', { set: 'xylophone-1', notes: S('xylophone-bones', 100, 120), post: 1.2 });
  clip('mica', 'mica', { set: 'blow-118', notes: S('exposition-close', 115, 121), post: 1.4 });
  clip('mica', 'mica', { set: 'build-213', notes: S('build-213'), post: 1.2 });
  clip('mica', 'mica', { set: 'xylophone-2', notes: S('xylophone-bones', 230, 240), post: 1.2 });
  clip('mica', 'mica', { set: 'cascade', notes: S('cascade-262'), post: 1.2 });
  clip('mica', 'mica', { set: 'octave-hammer', notes: S('octave-hammer-g'), post: 0.8 });
  clip('crimp', 'crimp', { set: 'knock-d', notes: S('repeated-d-chords'), post: 1.6 });
  // Theme A in D: the violas' repeated accompaniment knocking under the scattered tune (the roll has no clean tune here).
  clip('crimp', 'crimp', { start: 55.1, end: 68.5, fade: 0.6, listen: 'viola', knobs: { stays: 0.9 }, intensity: [[55.1, 0.5], [60, 0.6], [68.5, 0.7]] });
  clip('crimp', 'crimp', { set: 'knock-303', notes: S('repeated-d-303'), post: 1.6 });
}

// =====================================================================================================================
// BELLS: squares-snap, small and calm in their own red; milky on the brass chords.
{
  const calm = { size: 0.8, life: 1.1, blur: 1.4, shake: 0.2, presence: 0.65 };
  clip('bells', 'squares-snap', { set: 'downbeat', notes: S('dance-begins'), knobs: { ...calm, size: 1.1 }, post: 2.2 });
  clip('bells', 'squares-snap', { set: 'octave-blow', notes: S('ff-blows-early', 118, 119), knobs: { ...calm, size: 1.4, shake: 0.6 }, post: 2.2 });
  clip('bells', 'squares-snap', { set: 'brass-1', notes: S('brass-calls', 145, 150), knobs: { ...calm, milk: 1 }, post: 1.8 });
  clip('bells', 'squares-snap', { set: 'tolls', notes: merge(S('pedal-e-toll'), S('pedal-a-toll')), knobs: calm, post: 1.8 });
  clip('bells', 'squares-snap', { set: 'brass-2', notes: S('brass-calls', 169, 177), knobs: { ...calm, milk: 1 }, post: 1.8 });
  // The Dies irae chorale's slow B pedal: a funeral bell, one small square a bar.
  clip('bells', 'squares-snap', { set: 'chorale-bell', notes: vals(S('chorale-bass'), () => ({ intensity: 0.85 })), knobs: { ...calm, life: 1.8, size: 0.7 }, post: 2.4 });
  clip('bells', 'squares-snap', { set: 'brass-3', notes: S('brass-calls', 227, 232), knobs: { ...calm, milk: 1 }, post: 1.8 });
  clip('bells', 'squares-snap', { set: 'stamps', notes: merge(S('ff-blows-early', 237, 238), S('stop-244')), knobs: { ...calm, size: 1.3, shake: 0.6 }, post: 2.2 });
  clip('bells', 'squares-snap', { set: 'drums', notes: S('drum-strikes', 325, 345), knobs: { ...calm, size: 1.2, shake: 0.5 }, post: 1.8 });
  clip('bells', 'squares-snap', { set: 'brass-4', notes: S('brass-calls', 339, 345), knobs: { ...calm, milk: 1 }, post: 1.8 });
  clip('bells', 'squares-snap', { set: 'timpani', notes: S('drum-strikes', 360, 368), knobs: { ...calm, size: 0.9, shake: 0.6 }, post: 1.6 });
}

// =====================================================================================================================
// MILK: handover on long, slow notes only.
{
  const milk = { milk: 1, goneBy: 2, ring: 1.4, size: 0.8, presence: 0.85 };
  clip('milk', 'handover', { set: 'tutti-b-long', notes: S('long-notes', 86, 101), knobs: milk, post: 2.2 });
  clip('milk', 'handover', { set: 'interlude-strings', notes: S('interlude-strings'), knobs: { ...milk, size: 0.7 }, post: 2.2 });
  clip('milk', 'handover', { set: 'bowed-bass', notes: S('bass-development', 297, 321), knobs: { ...milk, size: 0.9 }, post: 1.8 });
  clip('milk', 'handover', { set: 'dawn', notes: vals(unroll(S('dawn-chords')), () => ({ intensity: 1.4 })), knobs: { ...milk, goneBy: 2.5, ring: 2, size: 0.7 }, post: 2.6 });
}

// =====================================================================================================================
// FIRE: fireworks-snap on the real ff blows only, in the bells' red. The nine last brass blows grow to 0 dB: each bursts
// bigger than the last (per-note size), and the smoke is left to decay into the silence before the crow.
{
  const fire = { hue: 0.99, range: 0.05, size: 1.3, swirl: 0.6, linger: 0.45, presence: 1 };
  clip('fire', 'fireworks-snap', { set: 'ff-313', notes: S('ff-blows', 313, 314), knobs: fire, post: 2.4 });
  clip('fire', 'fireworks-snap', { set: 'ff-336', notes: S('ff-blows', 336, 337), knobs: fire, post: 2.4 });
  const last = merge(S('ff-blows', 360, 375), vals(S('final-hammer'), (n) => ({ size: r3(lerp([[374.89, 0.8], [376.8, 2.4]])(n[0])) })));
  clip('fire', 'fireworks-snap', { set: 'ff-last', notes: last, knobs: { ...fire, linger: 0.6 }, post: 3.2, fade: 1.2 });
}

// =====================================================================================================================
// MASSES, where the whole orchestra plays. Struck tuttis (audio onsets match 23-40 %): mica on the violins' notes, a
// granite of silver shards that rattles with the dance (fewer attacks through the intensity curve, so the motif mica on
// the hammered chords and the xylophone still flashes above it). Legato forte (match 0-17 %): no flashes, only milky slabs
// on the held string notes, one at a time.
{
  const struck = [[71.7, 86.4, 0.55], [100.6, 120.4, 0.6], [120.4, 149.5, 0.5], [149.5, 175.4, 0.45], [213, 244.4, 0.6],
    [272.5, 297, 0.45]]; // critic: none in the frenzy, where the ribs and the racing dial already fill the screen;
  for (const [a, b, v] of struck) clip('mica', 'mica', { start: a, end: b, fade: 0.8, listen: 'violin', knobs: { ring: 1.4 },
    intensity: [[a, v * 0.6], [a + 2, v], [b - 1, v]] });
  // The held notes of the strings (violins, violas, cellos), at least 0.7 s, the top of their chord, one per 0.45 s.
  const held = (a, b) => {
    const ns = ['violin', 'viola', 'cello'].flatMap((k) => pack.tracks[k].notes).filter((n) => n[0] >= a && n[0] < b && n[1] - n[0] >= 0.7)
      .map((n) => [n[0], n[1], n[2], n[3]]).sort((p, q) => p[0] - q[0] || q[2] - p[2]);
    const out = [];
    for (const n of ns) if (!out.length || n[0] - out[out.length - 1][0] >= 0.45) out.push(n);
    return out;
  };
  const milk = { milk: 1, goneBy: 2, ring: 1.4, size: 0.7, presence: 0.8 };
  clip('milk', 'handover', { set: 'held-build', notes: held(297, 322.6), knobs: milk, post: 2 });
  clip('milk', 'handover', { set: 'held-recap', notes: merge(S('recap-theme-b-line'), without(held(323, 360.6), S('recap-theme-b-line')).filter((n) => !S('recap-theme-b-line').some((m) => Math.abs(m[0] - n[0]) < 0.45))), knobs: { ...milk, size: 0.95, goneBy: 2.5 }, post: 2 });
  // The chorale's inner held notes (its top line is Ivory's), and the long notes of the A pedal's climax and the development.
  clip('milk', 'handover', { set: 'chorale-inner', notes: without(S('long-notes', 175.4, 213), S('chorale-top')), knobs: { ...milk, goneBy: 2.5 }, post: 2.4 });
  clip('milk', 'handover', { set: 'long-dev', notes: merge(S('long-notes', 168, 175.4), S('long-notes', 272.5, 297)), knobs: milk, post: 2.2 });
  // The chorale's last phrase, the long fall 82-81-80-79 to 63: milky slabs handing over (an Ivory row would stomp on
  // its first high note and age away while the phrase still falls).
  clip('milk', 'handover', { set: 'chorale-fall', notes: S('chorale-p4'), knobs: { milk: 1, goneBy: 2.5, ring: 2, size: 1.2, presence: 1 }, post: 2.6 });
  // The recapitulation's bass, struck (its strings are sustained): a floor of shards the fold mirrors.
  clip('mica', 'mica', { set: 'recap-bass', notes: S('bass-finale', 323, 360.3), knobs: { ring: 3, flecks: 400 }, post: 2 });
  // The hammered D chords inside theme A in D (the 'piano' lane is the orchestra's repeated chords): bones.
  clip('mica', 'mica', { set: 'bones-57', notes: S2('piano', 57, 60), post: 1.2 });
}

// =====================================================================================================================
// READERS. The fugato: each strip of the picture from a different moment, the subject's notes cutting the present.
clip('reader', 'timeslice', { set: 'canon', notes: S('fugato-subject-low'), start: 121.2, end: 149.6, fade: 1.5,
  knobs: { far: 1.8, live: 0.25 } });
// The recapitulation (themes A and B at once): a mirror that turns with the bass. No flips and almost no seam, so it never
// makes an event of its own.
clip('reader', 'fold', { set: 'mirror-bass', notes: S('bass-finale', 323, 360.3), start: 323.2, end: 360.6, fade: 2,
  knobs: { flip: 0, seam: 0.1, strength: 0.8 } });

// =====================================================================================================================
// DAWN: the only colour field of the show. It rises under the held G5 of the crow, holds dim through the farewell, and
// sinks with the last chord.
clip('field', 'fields', { start: 379.6, end: 429.8, fade: 0, listen: 'all',
  knobs: { n: 1, back: 0.6, dyn: 0.35, chords: 0.35, home: 0.55 },
  intensity: [[379.6, 0], [383.6, 0.45, 'ease'], [391, 1], [396, 0.85], [418, 0.7], [424, 0.45], [426.4, 0.3, 'ease'], [429.6, 0]] });

// ---------- write ----------
clips.sort((a, b) => a.start - b.start || a.track - b.track);
clips.forEach((c, i) => { c.id = `c${i + 1}`; });
const show = {
  version: 3, id: ID, song: SONG,
  title: 'Danse macabre · A · Midnight on black: red bells round a clock, Death\'s ink-blue sail, Ivory waltz rows, mica bones, pluck pizzicato, fireworks on the last blows; dawn the only colour',
  composer: { by: 'claude', at: new Date().toISOString() }, clips, picks,
};
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets: loadCatalogue().widgets, tracks: Object.keys(pack.tracks ?? {}) });
// The most clips at one moment.
let most = 0, at = 0;
for (const c of clips) { const n = clips.filter((d) => d.start <= c.start && c.start < d.end).length; if (n > most) { most = n; at = c.start; } }
console.log(`${clips.length} clips, ${Object.keys(picks).length} sets, at most ${most} at once (${at} s); errors ${errors.length}, warnings ${warnings.length}`);
for (const e of [...errors, ...warnings]) console.log(`  ${e.path}: ${e.message}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, `shows/${ID}.json`), canonicalShow(show));
