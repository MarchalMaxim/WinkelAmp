// Builds shows/liszt-hungarian-2-a-bandleaders-octaves.json from picks.json (this folder; made by gen-picks.mjs).
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/liszt-hungarian-2/build-liszt-hungarian-2-a-bandleaders-octaves.mjs
//   npm run check-show -- shows/liszt-hungarian-2-a-bandleaders-octaves.json
//
// THE CONCEPT. The loved "Octave storm" stack (nocturne-micro-a5) grown into a 10-minute rhapsody. One family of struck
// marks on black: Interlock's needles, Hammer's bars, Pluck's straight threads, Ivory's milk-white keys, plus two fluids,
// Gliss's warm curls and Fireworks-snap's bursts, over a dim violet field (fields home -0.8, warming only a quarter with the loudness, chords 0.5: near the
// Combinations table's violet-and-blue setting; at the defaults the tuttis turned the field orange).
//
// WHO PLAYS WHAT (every clip listens to its own pick set: the notes one hears as that strand)
//   interlock  the low strings: the lassan theme with its octave doublings (pack notes +-12 within 50 ms), the Lento's single
//              deep strokes, the dance's G#2 drone, the dissolve's C#3 repeats and Ab1 shudder, the friska's Bb0/C#1 tolls,
//              the G# pedal before the stomp, the prestissimo's C#3 pulse, the last blows.
//   hammer     the bandleader's bow: the Lento's proud held tones (marcato), the violins' lines, the hammered C#5s of the
//              friska (staccato), the brass descents in octaves, the stretta. Its articulation (touch, per note) follows
//              the dance: piano for the p tune, marcato in the tuttis, staccato where the violins murmur and quicken.
//   pluck      the cimbalom: the knocks that open every Lento phrase, the G#4 tapped in the interlude, the glitter, the high
//              shake, the two tremolos, the harp's rolled chords, the oom-pah bass as a long low pizzicato thread, the
//              octave bursts, the dying high tremolo and the pp prestissimo.
//   gliss      the clarinet and the runs: cadenza I (a literal bell, G4 up to Eb6 and back), the garlands, the sinking, the
//              rising scale of cadenza II, the friska's glitter, the high whirl, the spray of high notes, the plunge.
//   ivory      the friska's rising sequences, one short row per phrase; the stretta's last climb; the last chords.
//   fireworks  saved: not one burst in the lassan. The first goes off at 410.7 s, the first friska tutti, after almost
//              seven minutes of restraint; then the stomping tutti, the loudest stomp (bursts growing), the close.
//   fields     dim violet, only under the tuttis and as a trace in the quiet; out for the lassan's cello solo, both clarinet
//              cadenzas, the sinking clarinet, the grand pause, the friska dawn and the dying tremolo.
//
// THE STORY (the serendipitous part, the legend):
// - Cut-offs are hard cuts. Every ff that breaks off (92.5, 251.5, 361.5, 570.4 s) ends every clip with fade 0: the
//   picture goes black with the orchestra. The silence is the event; nothing is drawn into it.
// - The band arrives from the distance. The friska dawn (363.4-385 s, pp, clarinet and high winds) is six tiny Ivory
//   rows in small copies (windows) that alternate left and right like call and response, each one bigger and lower than
//   the last, as if the band were walking closer; at the second build (459 s) the rows stand full size.
// - A close-up on the cellos. The lassan theme alone in the cellos (40.4-56 s) is seen through a window twice the screen's
//   width (w 2, x 0.66), a zoom on the low register: the needles of A2-C#3 stand in the middle, twice as wide. The
//   sudden f of the full strings at 56.0 s pulls the view back. The dissolve (307 s), the low strings alone again,
//   returns to the close-up, centred a little lower so its Ab1 shudder is in the picture.
// - The Lento returns 170.5 s later with the same picture: recognition is the musical fact.
// - The G# pedal before the stomp (469-480 s) drives one needle deeper on every repeat (Interlock ratchet 40, per note):
//   suspense you can see.
// - The plunge (534.4-539.4 s) is Gliss in a window turned 180 degrees: the bell hangs down and the warm curls, which
//   normally rise, sink. A knob nobody has tried (a region rotation) answering a fall from F7 to C1.
// - The end. The audio (onsets) shows the "held" chord is two ff blows, 620.55 and 622.53 s, with a breath between. The
//   B chord at 619.15 s stands up as an Ivory row in the rest; the Bb0/A1 blow is the row's lowest key and its stomp: the
//   ground caves in (deep crater, a strong ripple running through the keys while the chord is held); the second blow and
//   the F# chords press the keys back into the ground one by one, the last chord takes the last key, and the field goes
//   out with the sound.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'liszt-hungarian-2-a-bandleaders-octaves', SONG = 'liszt-hungarian-2';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (t, t0, t1, a, b) => a + (b - a) * clamp((t - t0) / (t1 - t0), 0, 1);

const set = (id) => { if (!P[id]) throw new Error(`no set ${id}`); return P[id].notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const win = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
/** Several lists as one strand, sorted; one pitch struck twice within 40 ms is kept once. */
function merge(...lists) {
  const out = [];
  for (const n of lists.flat().sort((a, b) => a[0] - b[0] || a[2] - b[2])) {
    if (out.some((o) => o[2] === n[2] && Math.abs(o[0] - n[0]) < 0.04)) continue;
    out.push(n);
  }
  return out;
}
const without = (ns, gone) => ns.filter((n) => !gone.some((g) => g[2] === n[2] && Math.abs(g[0] - n[0]) < 0.03));
/** Attacks (notes within 40 ms of the first), each reduced to its top note. */
function tops(ns) {
  const at = [];
  for (const n of [...ns].sort((a, b) => a[0] - b[0])) {
    const l = at[at.length - 1];
    if (l && n[0] - l[0][0] < 0.04) l.push(n); else at.push([n]);
  }
  return at.map((a) => a.reduce((b, n) => (n[2] > b[2] ? n : b)));
}
/** The octave doublings the pack hears under a strand: for every note below C4, the pack's note an octave away. */
const PACK = pack.notes;
function withOctaves(ns) {
  const add = [];
  for (const n of ns) if (n[2] < 60) for (const d of [-12, 12]) {
    const p = PACK.find((q) => q[2] === n[2] + d && q[2] < 60 && Math.abs(q[0] - n[0]) <= 0.05);
    if (p) add.push([p[0], p[1], p[2], p[3]]);
  }
  return merge(ns, add);
}

const clips = [], picks = {};
// The pick sets by name (widget@start -> set id), so the studio shows what each clip hears.
const NAMES = {
  'interlock@3': 'lento-strokes-1', 'hammer@3': 'lento-proclamations', 'pluck@3': 'lento-knocks-1',
  'interlock@173.9': 'lento-strokes-2', 'hammer@173.9': 'lento-proclamations-return', 'pluck@173.9': 'lento-knocks-2',
  'interlock@40.4': 'lassan-cellos-octaves', 'interlock@56': 'lassan-strings-octaves', 'hammer@56': 'lassan-violins', 'pluck@56': 'lassan-violas',
  'gliss@93.4': 'clarinet-cadenza-1', 'hammer@99.9': 'hush-knocks',
  'pluck@103.9': 'gsharp-repeats', 'hammer@104.6': 'interlude-line', 'gliss@112.8': 'clarinet-garlands', 'interlock@103.9': 'interlude-bass',
  'hammer@131': 'dance-lilt', 'interlock@131': 'dance-pedal', 'pluck@136.2': 'glitter-1', 'gliss@131': 'dance-runs',
  'pluck@159.8': 'high-shake', 'gliss@165.8': 'clarinet-sinking',
  'interlock@212.4': 'lassan-return-octaves', 'hammer@212.4': 'lassan-return-upper', 'pluck@212.4': 'lassan-return-cellos',
  'gliss@252.8': 'clarinet-cadenza-2',
  'hammer@264.6': 'a-major-song', 'pluck@264.6': 'song-violas-harp',
  'interlock@307': 'dissolve-c-sharp-and-shudder', 'hammer@307': 'dissolve-murmur', 'pluck@307': 'dissolve-audio',
  'hammer@385': 'friska-bow', 'pluck@385': 'friska-oom', 'hammer@422.2': 'friska-pah', 'pluck@407.3': 'cimbalom-1', 'pluck@522': 'cimbalom-2',
  'interlock@410.4': 'friska-tolls-and-pedal', 'hammer@487.5': 'brass-descent-1', 'hammer@550.9': 'brass-descent-2', 'pluck@556.8': 'stomp-bursts',
  'fireworks-snap@410.4': 'blows-first-tutti', 'fireworks-snap@482.5': 'blows-stomp', 'fireworks-snap@529.7': 'blows-loudest-stomp',
  'gliss@500.8': 'whirl-1', 'gliss@505.25': 'whirl-2', 'gliss@526.9': 'spray', 'gliss@534.3': 'plunge',
  'pluck@570.4': 'high-tremolo', 'pluck@584': 'prestissimo-repeats', 'interlock@584': 'prestissimo-bass',
  'hammer@605.8': 'stretta-and-last-chords', 'interlock@605.8': 'last-tolls', 'fireworks-snap@618.4': 'last-blows', 'ivory@618.75': 'the-lid',
};
// The loved Octave storm's own settings (nocturne-micro-a5, the user's edit) as the base of every clip: pluck pulled
// far with a hard corner, hammer big and ringing; interlock's needles a little wider and standing longer than there,
// because here they carry whole sections, not 7 s; fireworks kept to one colour family (range 0.1: at 0.25 the low and
// high blows wandered into pink and green, off the palette).
const BASE = {
  pluck: { pull: 1.6, corner: 1, ring: 1.2, touch: 2 },
  hammer: { size: 1.8, ring: 1.5 },
  interlock: { width: 1.1, stays: 2 },
  'fireworks-snap': { hue: 0.02, range: 0.1, size: 1.3, swirl: 0.6, linger: 0.3 },
};
let nClip = 0;
/** One clip. notes: its own pick set (a fresh id per clip, so knob values never reach another widget); trimmed to the
    clip, so no picked note is outside every clip that uses it. */
function clip(widget, track, start, end, o = {}) {
  const c = { id: `c${++nClip}`, start: r3(start), end: r3(end), track, widget, fade: o.fade ?? 0.3 };
  const knobs = { ...(BASE[widget] ?? {}), ...(o.knobs ?? {}) };
  if (Object.keys(knobs).length) c.knobs = knobs;
  if (o.region) c.region = o.region;
  // Critic's pass, found in the preview: Interlock paints with 'lighten', so over a lit field its dark red body
  // (90,16,18) loses to the field and only the white strike shows; the brighter the field, the more the needles vanish.
  // In a full-screen window (a small copy the size of the stage, 'clear' blend) it draws alone on black, and the
  // stamp keeps anything lit solid: the needles become dark oxblood wedges cut into the painting, at any field level.
  else if (widget === 'interlock') c.region = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, fit: 'stretch' };
  if (o.notes) {
    const id = o.set ?? NAMES[`${widget}@${r3(start)}`] ?? `${widget}-${nClip}`;
    if (picks[id]) throw new Error(`set ${id} twice`);
    const ns = o.notes.filter((n) => n[0] >= start && n[0] < end - 0.05);
    if (!ns.length) throw new Error(`${widget} ${start}-${end}: no notes`);
    picks[id] = { notes: ns.map((n) => (n.length > 4 ? n : [r3(n[0]), r3(n[1]), n[2], n[3]])) };
    c.listen = `picks:${id}`;
  }
  if (o.intensity) { c.intensity = o.intensity.map(([t, v, shape]) => (shape ? { t: r3(t), v, shape } : { t: r3(t), v })); }
  if (o.present) c.intensityMoves = 'present';
  clips.push(c);
  return c;
}
const vals = (ns, f) => ns.map((n) => { const v = f(n); return v ? withValues([r3(n[0]), r3(n[1]), n[2], n[3]], v) : n; });

// Tracks, bottom to top.
const T = { fields: 0, needle: 1, bar: 2, thread: 3, curl: 4, key: 5, burst: 6, bar2: 7, thread2: 8, curl2: 9, key2: 10, key3: 11 };

// ---------------------------------------------------------------------------------------------------- the ground
// Two fields, the lassan's and the friska's (the grand pause between them is black, so the second one's fresh start is
// unseen). Violet (home -0.8, warming a quarter with the loudness: plum and oxblood in the tuttis, never orange). The
// lassan's field stands further forward (back 0.6): its music is slow and the struck marks are few. 'hold' pivots are
// the hard cuts.
// Critic's pass: chords 0.5 -> 0.2. At 0.5 the harmony pulled the bands to green-teal (80-91 s, 285 s, 595 s) and to
// an orange band in the stomp (492 s): off the one violet family. And the lassan field is now three clips, split at its
// two hard cuts (92.5 and 251.5 s, both black, so no fresh start is seen), so each part can stand where it must: the
// first two blaze up into their cut-offs (the screen is at its fullest the instant it goes black), the song's steps
// forward (back 0.3) so its p does not sink to nothing.
const FIELD = { home: { base: -0.8, drive: '+level', depth: 0.25 }, chords: 0.2, dyn: 0.65 };
clip('fields', T.fields, 2.8, 92.5, {
  fade: 0, knobs: { ...FIELD, back: 0.4, dyn: 0.5 },
  intensity: [
    [2.8, 0], [3.3, 0], [4.2, 0.55], [38.5, 0.55], [41.6, 0, 'hold'],           // Lento I tutti; out for the cellos alone
    [55.9, 0, 'hold'], [56.05, 0.36], [76, 0.5], [84, 0.72], [88, 0.95], [92.45, 1, 'hold'], [92.5, 0, 'hold'],   // the lassan's ff blazes, cut
  ],
});
clip('fields', T.fields, 103.9, 251.5, {
  fade: 0, knobs: { ...FIELD, back: 0.45, dyn: 0.45 },
  intensity: [
    [103.9, 0], [106, 0.3], [131, 0.34], [145, 0.38], [160, 0.38], [166, 0.3], [167.6, 0, 'hold'],   // interlude, dance; out for the sinking clarinet
    [173.7, 0], [174.6, 0.55], [210, 0.55], [212.5, 0.32], [236, 0.5], [246.4, 0.75], [250.6, 1], [251.45, 1, 'hold'], [251.5, 0, 'hold'],
  ],
});
clip('fields', T.fields, 264.4, 361.5, {
  fade: 0, knobs: { ...FIELD, back: 0.3, dyn: 0.45 },
  intensity: [
    [264.4, 0], [268, 0.6], [300, 0.6], [307, 0.4], [330, 0.36], [354, 0.36], [357.5, 0.55], [361.45, 0.15, 'hold'], [361.5, 0],   // song, dissolve, swell; the grand pause
  ],
});
clip('fields', T.fields, 363.4, 629.5, {
  fade: 0, knobs: { ...FIELD, back: 0.9 },
  intensity: [
    [363.4, 0], [385, 0], [387, 0.2], [407, 0.4], [410.6, 0.55], [420.8, 0.55], [421.4, 0.4], [456, 0.38], [470, 0.44], [480.5, 0.5],
    [482.8, 0.65], [510.25, 0.65, 'hold'], [510.3, 0.3], [526, 0.32], [528, 0.55], [539.6, 0.7], [570.35, 0.74, 'hold'], [570.4, 0, 'hold'],
    [584, 0], [587, 0.2], [602.5, 0.2], [604, 0.22], [606, 0.2], [612, 0.45], [618.8, 0.72], [619.55, 0.72, 'hold'], [619.6, 0.06, 'hold'],
    [620.47, 0.06, 'hold'], [620.5, 0.75], [624.4, 0.7], [627.2, 0.6], [628.6, 0],
  ],
});

// ---------------------------------------------------------------------------------------------------- S1, S8 the Lento
const strokes = set('lento-strokes');
const knocks = set('lento-knocks');
const longT = set('long-tones');
let nLento = 0;
for (const [a, b, procl] of [[3.0, 40.4, 'lento-proclamations'], [173.9, 212.4, 'lento-proclamations-return']]) {
  // deep single strokes: heavy wedges that stand until the next one
  clip('interlock', T.needle, a, b, { notes: win(strokes, a, b), knobs: { width: 1.8, stays: 3.5, bite: 1.2 }, fade: 0.2 });
  // the proud held tones. Critic's pass: marcato (gone in 1.5 s) left one line at a time over held chords; as bells
  // (touch 3) each proud tone hangs on as a ringing string across its phrase, and the phrase reads as a stack.
  clip('hammer', T.bar, a, b, { notes: set(procl), knobs: { touch: 3, ring: 1.6, size: 2 }, fade: 0.2 });
  // the held chords' low tones (long-tones below G3, minus the strokes): deep red strings ringing under the declamation
  clip('hammer', T.bar2, a, b, { set: `lento-held-bass-${++nLento}`, notes: without(win(longT, a, b).filter((n) => n[2] < 55), strokes), knobs: { touch: 3, ring: 1.4, size: 1.4 }, fade: 0.2 });
  // the cimbalom knocks that open each phrase
  clip('pluck', T.thread, a, b, { notes: win(knocks, a, b), fade: 0.2 });
}

// ---------------------------------------------------------------------------------------------------- S2, S3 the lassan theme
// The cellos alone (40.4 s, needles on black), then full strings (56 s) climbing to the ff: the needles cross deeper
// and grow wider as the strings climb; the accented peaks hit harder.
const peaks = set('lassan-ff-peaks');
const isPeak = (n) => peaks.some((p) => Math.abs(p[0] - n[0]) < 0.05);
const lassan1 = withOctaves(merge(set('lassan-theme-cellos'), set('lassan-theme-strings'), win(peaks, 40, 92.5).filter((n) => n[2] < 64)));
// The cellos alone are seen close up: a window twice the screen's width centred on the low register, so the needles of
// A2-C#3 stand in the middle, twice as wide. The sudden f at 56.0 s pulls the view back to the whole keyboard.
const ZOOM = { mode: 'window', shape: 'rect', x: 0.66, y: 0.5, w: 2, h: 1, feather: 0, fit: 'stretch' };
clip('interlock', T.needle, 40.4, 56.0, {
  fade: 0, region: ZOOM, knobs: { stays: 2.6 },
  notes: vals(win(lassan1, 40.4, 56.0), () => ({ intensity: 1.5 })),
});
clip('interlock', T.needle, 56.0, 92.5, {
  fade: 0,
  // critic's pass: from 84 s (the A5 and the ff) the mesh stays and the needles reach their widest, so the ff builds
  // a standing thicket that the cut at 92.5 s wipes away
  notes: vals(win(lassan1, 56.0, 92.5), (n) => ({ bite: r3(lerp(n[0], 70, 90, 0.9, 2)), width: r3(lerp(n[0], 56, 90, 0.8, 2)), stays: r3(lerp(n[0], 80, 90, 1.4, 3.5)), ...(isPeak(n) || n[0] >= 87.5 ? { intensity: 1.5 } : {}) })),
});
// the violins climb; marcato and harder once they reach the ff
clip('hammer', T.bar, 56.0, 92.5, { fade: 0, notes: vals(win(set('violin-line'), 56, 92.5), (n) => (n[0] >= 84 ? { touch: 1, intensity: 1.4 } : null)) });
clip('pluck', T.thread, 56.0, 92.5, { fade: 0, notes: win(set('viola-inner'), 56, 92.5) });        // the violas' inner strings
// the fourth thread: the slow roots as deep red strings at the bottom (lassan-bass, minus what the needles already take)
const lbass = set('lassan-bass');
clip('hammer', T.bar2, 56.0, 92.5, { fade: 0, set: 'lassan-roots-1', notes: without(win(lbass, 56, 92.5), lassan1), knobs: { touch: 3, ring: 1.3, size: 1.4 } });

// ---------------------------------------------------------------------------------------------------- S4 cadenza I and the hush
// Spare: one warm bell (the flourish IS a bell) hanging into the hush, where one pale bar is touched five times.
clip('gliss', T.curl, 93.4, 104.8, { notes: set('clarinet-cadenza-1'), knobs: { linger: 1.4 }, fade: 0.4 });
clip('hammer', T.bar, 99.9, 104.6, { notes: set('cadenza-hush-knocks'), knobs: { touch: 3, size: 0.8, ring: 1.4 }, fade: 0.3 });

// ---------------------------------------------------------------------------------------------------- S5 the G# interlude
clip('pluck', T.thread, 103.9, 113.6, { notes: set('gsharp-repeats') });             // one thread, tapped again and again
clip('hammer', T.bar, 104.6, 131.0, { notes: set('interlude-line') });               // the singing line
clip('gliss', T.curl, 112.8, 126.5, { notes: set('clarinet-garlands'), knobs: { linger: 0.9 } });   // the garlands
clip('interlock', T.needle, 103.9, 131.0, { notes: win(set('bass-all'), 103.9, 131), knobs: { width: 0.7, stays: 2.4 } });

// ---------------------------------------------------------------------------------------------------- S6 the lilting dance
clip('hammer', T.bar, 131.0, 160.0, { notes: set('dance-lilt') });
// the G#2 drone: one needle, each return driving it a little deeper while the dance speeds up
clip('interlock', T.needle, 131.0, 160.0, { notes: set('dance-pedal'), knobs: { ratchet: 32, width: 0.9, stays: 2.4 } });
clip('pluck', T.thread, 136.2, 148.0, { notes: set('glitter-1') });                  // the cimbalom's sparkles
clip('gliss', T.curl, 131.0, 160.0, { notes: win(set('runs'), 131, 160) });

// ---------------------------------------------------------------------------------------------------- S7 high shake, the clarinet sinks
clip('pluck', T.thread, 159.8, 166.8, { notes: set('high-alternation') });
clip('gliss', T.curl, 165.8, 174.2, { notes: set('clarinet-sinking'), knobs: { linger: 1 } });

// ---------------------------------------------------------------------------------------------------- S9, S10 the lassan returns, the climax
const climax = set('climax-strokes');
const lassan2 = withOctaves(merge(set('lassan-theme-return'), climax.filter((n) => n[2] < 60)));
clip('interlock', T.needle, 212.4, 251.5, {
  fade: 0,
  notes: vals(lassan2, (n) => n[0] >= 246.4
    ? { bite: 2, width: 2, stays: 4, intensity: 1.4 }
    : { bite: r3(lerp(n[0], 230, 246, 0.9, 1.6)), width: r3(lerp(n[0], 230, 246, 0.9, 1.4)) }),
});
clip('hammer', T.bar, 212.4, 251.5, {
  fade: 0,
  notes: vals(merge(win(set('violin-line'), 212.4, 246.4), win(set('viola-inner'), 212.4, 246.4), climax.filter((n) => n[2] >= 55)),
    (n) => (n[0] >= 246.4 ? { touch: 1, intensity: 1.3 } : null)),
});
clip('pluck', T.thread, 212.4, 246.4, { notes: win(set('cello-line'), 212.4, 246.4) });
// the fourth thread, as in S3: the slow roots (the Ab2 pedal first) as deep red strings
clip('hammer', T.bar2, 212.4, 251.5, { fade: 0, set: 'lassan-roots-2', notes: without(win(lbass, 212.4, 251.5), lassan2), knobs: { touch: 3, ring: 1.3, size: 1.4 } });

// ---------------------------------------------------------------------------------------------------- S11 cadenza II
clip('gliss', T.curl, 252.8, 264.4, { notes: set('clarinet-cadenza-2'), knobs: { linger: 1.2 }, fade: 0.4 });

// ---------------------------------------------------------------------------------------------------- S12 the A-major song
// tender: the song's notes as bells (touch 3), each ringing on into the next
// critic's pass: heard a little louder (intensity 1.4), so the p bells read at 720p instead of sinking into the field
clip('hammer', T.bar, 264.6, 307.0, { notes: vals(set('a-major-song'), () => ({ intensity: 1.4 })), knobs: { touch: 3, ring: 2, size: 2 } });
clip('hammer', T.bar2, 264.6, 307.0, { set: 'song-bass', notes: merge(win(set('cello-line'), 264.5, 307), set('a-major-bass')), knobs: { touch: 3, size: 0.8 } });
clip('pluck', T.thread, 264.6, 307.0, { notes: merge(win(set('viola-inner'), 264.5, 290), set('harp-arpeggio')) });

// ---------------------------------------------------------------------------------------------------- S13, S14 the dissolve, the swell
// Quiet, nothing busy: the C#3 repeats and the Ab1 shudder ratchet one needle each, the murmur rings as faint bells,
// the faintest touches (audio onsets) pluck a thread. The swell on C# swells the field; then the grand pause is black.
const murmur = merge(set('dissolve-murmur'), win(set('dominant-swell'), 355, 361.5));
const insist = murmur.filter((n) => [32, 37, 49].includes(n[2]));
// the same close-up as the cellos' first statement: the dissolve is the low strings again, alone
// (centred lower than the cellos' view, x 0.85, so the Ab1 shudder stands inside the picture, not past its left edge)
clip('interlock', T.needle, 307.0, 361.5, { fade: 0, region: { ...ZOOM, x: 0.85 }, notes: vals(insist, () => ({ ratchet: 32, intensity: 1.4 })), knobs: { width: 0.7, stays: 2.6 } });
clip('hammer', T.bar, 307.0, 361.5, { fade: 0, notes: without(murmur, insist), knobs: { touch: 3, size: 1.2, ring: 2, presence: 0.75 } });
clip('pluck', T.thread, 307.0, 331.0, { notes: set('dissolve-audio'), knobs: { presence: 0.7 } });

// ---------------------------------------------------------------------------------------------------- S15 the friska dawn
// The band, far away. Six short Ivory rows (one per phrase of the pp tune), each in a small window, alternating sides,
// each a little bigger and lower: the band walking closer. Top note per attack; the note after the stomp presses one key.
const dawn = tops(set('friska-dawn'));
const vio = set('friska-violins');
const rows = [];
/** An Ivory row: keys = the notes from a to b (top per attack), pressers = the notes after it from b to c. */
let nRow = 0;
function row(src, a, b, c, track, knobs, region) {
  const keys = win(src, a, b), back = c ? win(src, b, c).slice(0, keys.length) : [];
  const all = [...keys, ...back];
  rows.push(...all);
  const last = all[all.length - 1][0];
  return clip('ivory', track, keys[0][0] - 0.4, last + 3.7, { set: region ? `dawn-row-${++nRow}` : `row-${(++nRow) - 6}`, notes: all, knobs, region, fade: 0.2 });
}
const far = (x, y, s) => ({ mode: 'window', shape: 'rect', x, y, w: s, h: s, feather: 0.12, fit: 'contain' });
const DAWN = { strike: 0.6 };
row(dawn, 363.5, 367.3, 367.9, T.key, DAWN, far(0.30, 0.40, 0.36));
row(dawn, 369.1, 370.9, null, T.key2, DAWN, far(0.70, 0.42, 0.42));
row(dawn, 370.9, 373.3, 374.1, T.key3, DAWN, far(0.36, 0.44, 0.5));
row(dawn, 374.9, 377.6, 378.1, T.key, DAWN, far(0.62, 0.46, 0.58));
row(dawn, 378.4, 379.7, 380.6, T.key2, DAWN, far(0.44, 0.48, 0.68));
row(dawn, 383.0, 384.0, 384.9, T.key3, DAWN, far(0.54, 0.5, 0.8));

// ---------------------------------------------------------------------------------------------------- S19, S24, S27 Ivory rows, full size
const ROW = { strike: 1, crater: 0.5, ripple: 3 };
const vtop = tops(vio);
row(vtop, 459.4, 462.2, 463.6, T.key, ROW);                // the build climbs to Bb6; its fall presses the keys back
row(vtop, 469.1, 472.6, null, T.key2, ROW);                // a wobbling rise over the G# pedal
row(merge(vtop, set('build-2-line')), 476.0, 478.2, 479.9, T.key, ROW);   // the clean scale to Bb6, three notes press back
row(vtop, 545.0, 546.65, null, T.key, ROW);                // the loudest stomp: chromatic C5 to E5
row(vtop, 554.95, 555.7, null, T.key2, ROW);               // a falling row: C#6 down to E5
row(vtop, 561.1, 562.1, 563.2, T.key, ROW);                // E5 up to D6
const stretta = set('stretta-chords');
row(tops(stretta), 612.3, 613.8, 616.5, T.key, ROW);       // the stretta's last climb to Ab6; the falling chords press it back

// ---------------------------------------------------------------------------------------------------- the friska
// The bandleader's bow: one hammer through the whole friska, its articulation per note following the dance.
const touchAt = (t) => (t < 410.4 ? 0 : t < 421 ? 1 : t < 480.6 ? 2 : t < 510.3 ? 1 : t < 526.5 ? 2 : 1);
// Critic's pass: the dip (510.3-526.5) had a 5.8 s hole (513.8-519.6): the friska-violins set misses the murmur, but
// the violin lane hears all of it, 130 notes, and from 516 s it runs in octaves (G#4/G#5 up to C#6/C#7). So the dip
// takes the violin lane itself, every note (the octave pairs are the point), struck piano: a quiet ladder of paired bars
// climbing, the bandleader's octaves in a whisper.
const dipMurmur = pack.tracks.violin.notes.filter((n) => n[0] >= 510.3 && n[0] < 526.5).map((n) => [n[0], n[1], n[2], n[3]]);
const friskaTop = without(merge(win(set('friska-strings-theme'), 385, 410.4), win(set('violin-line'), 410.4, 421.2), win(vio, 421.2, 510.3), dipMurmur, win(vio, 526.5, 570.4)), rows);
clip('hammer', T.bar, 385.0, 570.4, {
  fade: 0, notes: vals(friskaTop, (n) => ({ touch: touchAt(n[0]) })),
  present: true, intensity: [[385, 0.8], [400, 1], [456, 1], [459, 0.55], [480, 0.55], [481, 1]],
});
// the oom: a long low thread plucked like a double bass; the pah: short staccato bars
clip('pluck', T.thread, 385.0, 480.6, { notes: set('friska-vamp-bass'), knobs: { presence: 0.85 } });
clip('hammer', T.bar2, 422.2, 456.2, { notes: set('friska-offbeats'), knobs: { touch: 0, size: 0.8, presence: 0.8 } });
// the cimbalom shakes its chord, twice
clip('pluck', T.thread2, 407.3, 410.3, { notes: win(set('cimbalom-tremolo'), 407, 411) });
clip('pluck', T.thread2, 522.0, 524.6, { notes: win(set('cimbalom-tremolo'), 521, 525) });
// the tolls under every tutti, and the G# pedal that drives one needle deeper on every repeat
const pedal = set('dominant-pedal');
const tolls = merge(win(set('deep-tolls'), 410.4, 570.4), pedal);
clip('interlock', T.needle, 410.4, 570.4, {
  fade: 0, knobs: { width: 1.3, stays: 1.6 },
  notes: vals(tolls, (n) => (pedal.some((p) => p[0] === n[0] && p[2] === n[2]) ? { ratchet: 40, width: 0.9, stays: 2.6 }
    : n[0] >= 539.4 ? { width: 1.7, bite: 1.4 } : null)),
});
// the brass descents in octaves: stacks of bars stepping down, as proud as the Lento's
clip('hammer', T.bar2, 487.5, 490.2, { notes: win(set('brass-descents'), 487, 490), knobs: { touch: 1, size: 1.2 } });
clip('hammer', T.bar2, 550.9, 553.4, { notes: win(set('brass-descents'), 550, 554), knobs: { touch: 1, size: 1.2 } });
// the octave bursts: a fan of threads
clip('pluck', T.thread, 556.8, 564.4, { notes: set('stomp-bursts') });

// The fireworks, saved for the friska. They grow: 1.0 at the first tutti, 1.3 at the stomp, 1.4 to 1.9 in the loudest.
const FW = {};
clip('fireworks-snap', T.burst, 410.4, 421.2, { fade: 0, notes: set('tutti-1-blows'), knobs: { ...FW, size: 1 } });
clip('fireworks-snap', T.burst, 482.5, 510.3, { fade: 0, notes: set('stomp-blows'), knobs: { ...FW, size: 1.3 } });
clip('fireworks-snap', T.burst, 529.7, 570.4, {
  fade: 0, knobs: { ...FW, size: 1.4 },
  notes: vals(merge(win(set('ff-blows'), 529, 534), set('loudest-stomp-blows')), (n) => ({ size: r3(lerp(n[0], 539, 568, 1.4, 1.9)) })),
});

// the glitter, the whirl, the spray of high notes: warm curls. A sweep longer than 6 s is no sweep, so the whirl is two.
// glitter-2 runs on for 14 s with no 0.8 s breath: cut into sweeps of at most 6 s at its widest gaps
{
  const g = set('glitter-2'), cuts = [];
  const split = (ns) => {
    if (ns[ns.length - 1][0] - ns[0][0] <= 5.5) { cuts.push(ns); return; }
    let k = 1, gap = -1;
    for (let i = 1; i < ns.length; i++) { const d = ns[i][0] - ns[i - 1][0], mid = Math.abs(ns[i][0] - (ns[0][0] + ns[ns.length - 1][0]) / 2); if (d - mid * 0.02 > gap) { gap = d - mid * 0.02; k = i; } }
    split(ns.slice(0, k)); split(ns.slice(k));
  };
  split(g);
  cuts.forEach((ns, i) => clip('gliss', i % 2 ? T.curl2 : T.curl, ns[0][0] - 0.2, (cuts[i + 1] ? cuts[i + 1][0][0] - 0.2 : ns[ns.length - 1][0] + 1.5), { set: `glitter-2-sweep-${i + 1}`, notes: ns }));
}
clip('gliss', T.curl, 500.8, 505.25, { notes: win(set('high-whirl'), 500, 505.25) });
clip('gliss', T.curl2, 505.25, 510.3, { fade: 0, notes: win(set('high-whirl'), 505.25, 510.3) });
clip('gliss', T.curl, 526.9, 534.6, { notes: set('fireworks'), knobs: { push: 1.6 } });
// the plunge: the bell turned upside down, the curls sinking instead of rising
clip('gliss', T.curl2, 534.3, 539.8, {
  notes: set('plunge'), knobs: { push: 1.6, linger: 0.9 },
  region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, rot: 180, feather: 0, fit: 'stretch' },
});

// ---------------------------------------------------------------------------------------------------- S25, S26 dying, prestissimo
clip('pluck', T.thread, 570.4, 584.0, { notes: set('high-tremolo'), present: true, intensity: [[570.4, 1], [576, 0.8], [584, 0.35]] });
clip('pluck', T.thread, 584.0, 603.6, { notes: set('prestissimo-repeats'), knobs: { presence: 0.7 } });
clip('interlock', T.needle, 584.0, 602.6, { notes: vals(set('prestissimo-bass'), () => ({ ratchet: 30 })), knobs: { width: 0.6, presence: 0.7 } });

// ---------------------------------------------------------------------------------------------------- S27, S28 stretta and the last chords
const fin = set('final-chords');
clip('hammer', T.bar, 605.8, 629.5, {
  notes: vals(merge(without(stretta, rows), fin), (n) => (n[0] >= 620.4 && n[0] < 624.8 ? { touch: 3 } : { touch: 1 })),
  knobs: { size: 1.2 },
});
clip('interlock', T.needle, 605.8, 629.5, {
  knobs: { width: 1.4 },
  notes: vals(merge(win(set('deep-tolls'), 605, 620.4), fin.filter((n) => n[2] < 40)), (n) => (n[0] >= 620.4 ? { width: 2, bite: 1.6, stays: 4 } : null)),
});
// the blows the ear hears as blows: the B chord, the two ff blows, the strong beats of the F# chords, the last
const blowT = [618.68, 619.15, 620.51, 622.4, 624.62, 624.94, 625.32, 625.71, 626.09, 626.49, 626.8, 627.14];
const big = { 620.51: 2.2, 622.4: 1.9, 627.14: 2.4 };
const blows = merge(win(set('ff-blows'), 618, 619), fin).filter((n) => blowT.some((t) => Math.abs(n[0] - t) < 0.08));
clip('fireworks-snap', T.burst, 618.4, 629.5, {
  knobs: { ...FW, size: 1.5, range: 0.03 },
  notes: vals(blows, (n) => { const k = Object.keys(big).find((t) => Math.abs(n[0] - t) < 0.08); return { size: k ? big[k] : 1.5 }; }),
});
// The lid. Keys: the B chord (619.15-619.35) and the Bb0/A1 blow (620.5), the lowest key and the stomp. Pressed back by
// the second blow and the F# chords, one key per blow, the last by the last chord.
{
  const pick = (t, m) => fin.find((n) => Math.abs(n[0] - t) < 0.03 && n[2] === m);
  const keys = [pick(619.15, 47), pick(619.35, 37), pick(619.35, 59), pick(620.51, 33), pick(620.56, 22)];
  // The pressers stay below F#4: a higher one would make the row a climb (Ivory reads the direction from the highest and
  // lowest notes) and its top the stomp. The second blow presses with its C#3; the last presser is the final chord's F#4
  // (the violins' lane at 627.09 s), as the Bb0 under it would be the row's own lowest key again and move the stomp.
  const last = pack.tracks.violin.notes.find((n) => Math.abs(n[0] - 627.09) < 0.02 && n[2] === 66);
  const back = [pick(622.61, 49), pick(624.62, 34), pick(625.51, 66), pick(626.49, 61), last];
  if ([...keys, ...back].some((n) => !n)) throw new Error('final row: a note is missing');
  const notes = [...keys, ...back].map((n) => withValues([r3(n[0]), r3(n[1]), n[2], n[3]], n[0] > 620.5 && n[0] < 620.6 ? { ripple: 7, crater: 0.75 } : {}));
  clip('ivory', T.key2, 618.75, 631.2, { notes, knobs: { strike: 1, crater: 0.6, ripple: 3, cracks: 3 }, fade: 0.2 });
}

// ---------------------------------------------------------------------------------------------------- check and write
clips.sort((a, b) => a.start - b.start || a.track - b.track);
clips.forEach((c, i) => { c.id = `c${i + 1}`; });
// the most clips at one moment
let most = 0, at = 0;
for (let t = 0; t < 631; t += 0.05) { const k = clips.filter((c) => c.start <= t && c.end > t).length; if (k > most) { most = k; at = t; } }
const show = {
  version: 3, id: ID, song: SONG,
  title: "Liszt: Hungarian Rhapsody No. 2 · A \"Bandleader's octaves\": the Octave storm stack over a whole rhapsody. Interlock needles on the lassan's octaves and the tolls, Hammer bars on the proclamations and the violins' bow, Pluck threads as the cimbalom, Gliss curls on the clarinet and the runs, Ivory rows on the friska's rising sequences (the band arriving from the distance), Fireworks saved for the csardas blows and the close, a dim violet field",
  composer: { by: 'claude', at: '2026-11-06T18:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${ID}: ${clips.length} clips, ${Object.keys(picks).length} pick sets; at most ${most} clips at once (${at.toFixed(2)} s); errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
