// Builds shows/romeo-juliet-5-return-a-milk-and-thorn.json: cycle A "Milk and thorn" on the return and the catastrophe.
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-5-return/build-romeo-juliet-5-return-a-milk-and-thorn.mjs
//
// The cycle's mapping (the same in all six packs): prickle <- the feud's accents (the feud pack's thorn rule, copied);
// interlock <- the sword clashes; crimp <- the strings (straight hairlines when calm, red wool on the runs);
// Ivory <- the love theme on the violins; nap <- the sighs; squares-snap <- fate (timpani, low strokes; small, calm,
// red; the last blow alone and large, as at the friar's cut-off); fields <- the ground.
//
// The story of this piece, in one picture each:
//   0-22.5      the sighs return: oxblood velvet strokes (nap) on the oboe and clarinets' sighs, straight bone hairlines
//               (crimp) on the muted strings' rocking chords, a dim rose field. A spare entrance: three threads, pp.
//   22.5-37.6   the swell: the strings' runs fray the hairlines into wool as the crescendo builds; the field warms.
//   37.6-95     the love theme, ecstatic: one Ivory row per rising phrase, at full height, struck hard (strike 1); each
//               phrase's falling answer is NOT a key but a velvet stroke (nap): the theme rises in ivory and sighs in
//               velvet, so the sighs of the opening answer the love theme. The cellos' bass lays warm ribbons low.
//               The great chromatic climb (69.4-74.8) is sung by the violins and, an octave down, the violas: the
//               violas' row hangs from the ceiling (a small copy turned 180 degrees), the two staircases close on each
//               other like the feud's interlocking needles will, and both stomp at once on the F#6 (74.80).
//   89.8-117.8  the last row: the same staircase as the second phrase (Bb, F#, A, B, C, F#) climbs once more; then the
//               theme breaks off. The row is left standing in the silence, and fate's six low knocks (99.98-113.78,
//               from the audio) each land a small red square and press one key into the ground, tallest first. It ages
//               away just before the feud returns. The broken theme's fragments still stroke the velvet.
//   117.8-139.6 the feud returns: thorns from alternate edges, the runs as wool, a rust field (the feud pack's).
//   139.63      the catastrophe's first blow cuts the rust field dead (fade 0): the rest is played on black.
//   139.6-202.7 the catastrophe: thorns (broader on the ff blows), interlock needles on the clashes (heavier here,
//               width 1.4, and 2 on the two loudest volleys), red bells on the low strokes (larger on the strongest; the
//               four heaviest jolt the picture), wool on the runs; one blood field lit from inside only by the real ff
//               blows; the violins' collapse (196.6-198.9) yanks the strings straight and thin, the blood dims.
//   202.7-212.4 the music freezes on G: a cold plum field breathing on the tremolo, two small bells. Stillness.
//   212.38      the blow: everything cut; one large red square sinks alone (the friar's 293.0 picture).
//   213.4-220   the roll dies: the rose field of the love theme comes back once, faintly, and goes out with the roll.
//
// What the previews changed (and what they found):
//   - the duet was a guess and is the strongest image of the piece: the hanging violas' row and the standing violins' row
//     close into one interlocking block at the stomp; kept as it came out.
//   - Ivory's crater relief showed as a grey stain on the dark break (crater 0.5): 0.22, 0.3 on the last row.
//   - the catastrophe over a rust/blood field was red on red, mush: the ground is now black, cut at the first blow,
//     and the blood glows only on the ff blows. The swords got heavier (they were hairlines).
//   - the rose (home -0.32) read as plum and was nearly black under the sighs: home -0.15, brighter, blooming at 37.6.
//   - the freeze and the last field were invisible at back >= 1: back 0.5 / 0.45.
//   - the critic's pass (two rounds): the catastrophe was a third of the show with two or three marks on murky red.
//     The blood field steps back (back 1.65), so the ground is near black and only the ff blows light it; the thorns
//     stay 2.4 s there, so they pile up; the strings' held syncopated chords (158-190) are taut wires between the wool;
//     the swords build a cage (stays 1.6 -> 4 over the catastrophe, shattered at 198.80 where the violins' collapse
//     lands), drawn in a window twice the picture's width so their narrow pitch band spans the screen.
//
// Weight table (rough clip intensity; f field, n nap, c crimp, i Ivory, d duet, s squares, p prickle, x interlock):
//   0-30 f.3-.55 n1 c1 | 30-60 f.55-1 n(sighs to 30.7, answers) c1 i1 | 60-90 f1 n c1 i1 d(69.6-78.6) |
//   90-120 f1-.3 n i(last row) s1 c(runs from 106.6) | 120-139.6 p1 c1 s1 f(rust).45-.6 | 139.6-180 p1 x1 s1 c1 f(blood, ff only) |
//   180-202.7 p1 x1 s1 c1 f(blood) | 202.7-212.4 f(plum).55 s | 212.4 s(the blow, alone) | 213.4-220 f(rose).75->0
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-5-return-a-milk-and-thorn', SONG = 'romeo-juliet-5-return';
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
const top = (a) => a.reduce((b, n) => (n[2] > b[2] ? n : b));
const low = (a) => a.reduce((b, n) => (n[2] < b[2] ? n : b));
const ALL = [...pack.notes, ...Object.values(pack.tracks).flatMap((t) => t.notes)];
const struckAt = (t, w = 0.06) => ALL.filter((n) => Math.abs(n[0] - t) <= w);
const dbAt = (t) => ev.curve[clamp(Math.round(t / ev.hop), 0, ev.curve.length - 1)][0];
const trk = (name) => pack.tracks[name].notes.map((n) => [n[0], n[1], n[2], n[3]]);
/** The note of `track` starting at t (within 40 ms) with this pitch; throws if the pack lacks it (the rows are hand-read). */
const note = (track, t, m) => {
  const n = trk(track).find((x) => Math.abs(x[0] - t) < 0.04 && x[2] === m);
  if (!n) throw new Error(`no ${track} ${m} at ${t}`);
  return [r3(n[0]), r3(n[1]), n[2], n[3]];
};
const M = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const midi = (s) => { const [, p, o] = s.match(/^([A-G][#b]?)(-?\d)$/); return 12 * (Number(o) + 1) + M[p]; };
const row = (track, spec) => spec.map(([t, s]) => note(track, t, midi(s)));

// ---------- the love theme: one row per rising phrase (the violins' top line, notes held >= 0.4 s) ----------
// Read note by note from the violin track (doubled in octaves; the upper octave where both sound). A note that starts
// under a higher one still sounding is an inner voice and left out (47.94 F#4, 91.85 F#4). Each row ends on its peak:
// Ivory's stomp. The falling answer after each peak goes to the velvet (nap), not to the keys.
const ROWS = {
  r1: row('violin', [[39.68, 'Ab5'], [40.64, 'A5'], [41.59, 'A5'], [42.14, 'E5'], [42.65, 'D6'], [43.10, 'E6']]),
  r2: row('violin', [[47.46, 'Bb5'], [48.42, 'F#5'], [49.48, 'A5'], [49.93, 'A5'], [50.47, 'B5'], [50.92, 'C6'], [51.37, 'F#6'], [51.92, 'G6']]),
  r3: row('violin', [[55.54, 'E5'], [56.18, 'F5'], [57.04, 'F#5'], [57.51, 'B5'], [58.89, 'F#5'], [59.30, 'G5'], [59.71, 'C6']]),
  r4: row('violin', [[62.34, 'F#5'], [62.82, 'G5'], [63.24, 'Bb5'], [64.05, 'B5'], [64.50, 'C#6'], [65.91, 'Ab5'], [66.74, 'D6']]),
  // the great climb: Ab A C C# | B C C# D E F F#
  r5: row('violin', [[69.43, 'Ab5'], [69.88, 'A5'], [70.36, 'C6'], [71.22, 'C#6'], [72.15, 'B5'], [72.59, 'C6'], [73.01, 'C#6'],
    [73.46, 'D6'], [73.90, 'E6'], [74.32, 'F6'], [74.80, 'F#6']]),
  // F# G A Bb B C#: the transcription has only the lower octave of A, Bb, B, so the whole row is the lower octave
  // (all real violin notes); the heights are relative to the row, so it stands exactly as the upper octave would
  r6: row('violin', [[76.57, 'F#4'], [77.05, 'G4'], [77.50, 'A4'], [77.96, 'Bb4'], [78.47, 'B4'], [79.08, 'C#5']]),
  r7: row('violin', [[82.90, 'D5'], [84.01, 'C#6'], [84.94, 'D6'], [85.41, 'E6']]),
  // the last row: the second phrase's staircase once more (Bb F# A B C F#)
  r8: row('violin', [[89.84, 'Bb5'], [90.96, 'F#5'], [92.33, 'A5'], [92.81, 'B5'], [93.32, 'C6'], [93.77, 'F#6']]),
};
// the violas sing the great climb an octave down: the row that hangs from the ceiling
const DUET = row('viola', [[69.88, 'A3'], [70.36, 'C4'], [71.22, 'C#4'], [72.15, 'B3'], [72.59, 'C4'], [73.01, 'C#4'], [73.46, 'D4'],
  [73.90, 'E4'], [74.32, 'F4'], [74.80, 'F#4']]);
const STRUCK = { strike: 1, crater: 0.22, ripple: 3 };   // the crater's grey relief showed as a stain on the dark at 0.5
const ivoryRow = (ns, k = {}) => ns.map((n, i) => (i === ns.length - 1 ? withValues(n, { ...k }) : n));

// ---------- fate's knocks in the break: six low strokes from the audio press the last row into the ground ----------
// The six strongest < 150 Hz strokes of 99-114 s (the bass's F2/Eb2 knocks under the broken theme). In the Ivory set
// they are press notes: their pitch class moved into the row's own range (F -> F6, Eb -> Eb6), below its peak, so the
// row keeps rising to the F#6 and every knock sends one key down (a conventional pitch, as audio picks have). The
// squares hear the real bass notes.
const KNOCKS = [99.985, 101.82, 103.654, 104.652, 111.015, 113.778];
const bassAt = (t) => { const st = struckAt(t, 0.08).filter((n) => n[2] < 50); return st.length ? low(st) : null; };
const knockNotes = KNOCKS.map((t) => { const b = bassAt(t); return [r3(t), r3(b ? Math.max(b[1], t + 0.3) : t + 0.5), b ? b[2] : 41, 96]; });
const inRow = (m) => { let x = 72 + (m % 12); while (x < 78) x += 12; while (x >= 90) x -= 12; return x; };
const presses = knockNotes.map((n) => withValues([n[0], n[1], inRow(n[2]), n[3]], { intensity: 1.6 }));

// ---------- nap: the sighs, then the love theme's falling answers, then the broken theme's fragments ----------
// One velvet cloth for the whole first half. A note struck again switches its band off: the sighs' repeated Bb4s
// (3.89-5.69) keep only their first stroke, so the velvet does not blink.
const sighs = (() => {
  const out = [];
  for (const n of set('sighs')) { const l = out[out.length - 1]; if (l && l[2] === n[2] && n[0] - l[0] < 0.6) { l[1] = n[1]; continue; } out.push([...n]); }
  return out;
})();
const answers = [
  ...row('violin', [[43.55, 'B5'], [44.06, 'A5'], [44.54, 'D6'], [45.56, 'A4'], [46.04, 'Ab4'], [46.49, 'A4']]),
  ...row('violin', [[52.40, 'Bb5'], [54.43, 'A5']]),
  ...row('violin', [[60.61, 'B5']]),
  ...row('violin', [[67.67, 'C#6']]),
  ...row('violin', [[86.43, 'A5'], [86.91, 'D6']]),
  ...row('violin', [[94.79, 'Bb5']]),
].map((n) => withValues(n, { rest: 9 }));
const broken = within(set('broken-theme'), 97.5, 117.8).filter((n) => n[2] >= 55)   // the string line, not the bass knocks
  .map((n) => withValues(n, { rest: 6, width: 0.8 }));
const velvet = sortN([...sighs, ...answers, ...broken]);

// ---------- crimp: the strings, one thread ----------
const CALM = { slack: 1, fibres: 5, reach: 1.2, stays: 3 };
const runsOf = (tracks, a, b) => {
  const out = [];
  for (const tr of tracks) {
    const at = attacks(pack.tracks[tr].notes).map(top);
    let ch = [at[0]];
    const flush = () => { if (ch.length >= 5) out.push(...ch); };
    for (let i = 1; i < at.length; i++) { if (at[i][0] - at[i - 1][0] <= 0.2) ch.push(at[i]); else { flush(); ch = [at[i]]; } }
    flush();
  }
  return dedupe(out.map((n) => [r3(n[0]), r3(n[1]), n[2], n[3]])).filter((n) => n[0] >= a && n[0] < b);
};
const strings = [];
// the muted strings' rocking chords: straight bone hairlines
strings.push(...set('sigh-chords').map((n) => withValues(n, CALM)));
// the swell's runs: fraying with the crescendo (-42 dB nearly straight, -27 dB wool)
strings.push(...runsOf(['violin', 'viola', 'cello'], 22.4, 38.2).map((n) => {
  const k = (dbAt(n[0] + 0.15) + 42) / 15;
  return withValues(n, { slack: r3(lerp(1.4, 6, k)), fibres: Math.round(lerp(6, 16, k)), reach: r3(lerp(0.9, 1.3, k)), stays: 1.4 });
}));
// the love theme's bass (the cellos, held >= 0.3 s): warm ribbons low under the keys
strings.push(...within(trk('cello'), 39.4, 95).filter((n) => n[1] - n[0] >= 0.3 && n[2] < 55)
  .map((n) => withValues([r3(n[0]), r3(n[1]), n[2], n[3]], { slack: 2.6, fibres: 8, reach: 1.3, stays: 1.8 })));
// the runs inside the love theme and in the break, then the feud's and the catastrophe's: wool
strings.push(...runsOf(['violin', 'viola', 'cello', 'strings'], 79, 202.6).map((n) => {
  if (n[0] >= 196.5 && n[0] < 198.85) return withValues(n, { slack: 1, fibres: 4, reach: 1, stays: 2.2 });   // the collapse: straight, thin
  if (n[0] < 117.8 && n[0] >= 95) return withValues(n, { slack: r3(lerp(2, 5, (n[0] - 106) / 11)), fibres: 10, reach: 1.1, stays: 1.4 });
  return withValues(n, { slack: 6, fibres: n[0] >= 139.7 ? 17 : 14, reach: 1.2, stays: 1.2 });
}));
// The critic's pass: between the runs the strings hammer held, syncopated chords (158-176 above all, one every ~0.85 s).
// They were left out, so crimp was empty there. Each one is a taut wire now: the top of each held string attack
// (>= 0.3 s), not within 0.4 s of a run note, at most one per 0.3 s. Straight and thin against the wool: pulled tight.
{
  const runT = strings.filter((n) => n[0] >= 139.6).map((n) => n[0]);
  const held = attacks(['violin', 'viola', 'strings'].flatMap((tr) => within(trk(tr), 139.6, 196.5)))
    .map((a) => top(a)).filter((n) => n[1] - n[0] >= 0.3 && !runT.some((t) => Math.abs(t - n[0]) < 0.4));
  const wires = [];
  for (const n of held) if (!wires.length || n[0] - wires[wires.length - 1][0] >= 0.3) wires.push(n);
  strings.push(...wires.map((n) => withValues([r3(n[0]), r3(n[1]), n[2], n[3]], { slack: 1.2, fibres: 6, reach: 1.35, stays: 2 })));
}
const stringsSet = sortN(dedupe(strings));

// ---------- prickle: the feud's thorns (the feud pack's rule) ----------
// Audio onsets at least 0.55 of the strongest within 1.5 s, strength >= 0.28, strongest first and at least 0.5 s apart:
// one thorn per accent the ear counts. An ff blow gets a broader thorn, cracked harder.
const O = ev.onsets.filter((o) => o[0] >= 117.8 && o[0] < 202.6);
const cand = O.filter((o) => o[1] >= 0.28 && o[1] >= 0.55 * Math.max(...O.filter((p) => Math.abs(p[0] - o[0]) <= 1.5).map((p) => p[1])));
cand.sort((a, b) => b[1] - a[1]);
const acc = [];
for (const c of cand) if (acc.every((s) => Math.abs(s[0] - c[0]) >= 0.5)) acc.push(c);
acc.sort((a, b) => a[0] - b[0]);
const ffT = attacks(set('ff-blows')).map((a) => a[0][0]);
const nearFF = (t) => ffT.some((f) => Math.abs(f - t) <= 0.08);
const thorns = acc.map((o) => {
  const st = struckAt(o[0]); const vel = Math.round(clamp(20 + 2.4 * (o[2] + 60), 15, 122)); const t = r3(o[0]);
  const n = st.length ? (() => { const tn = top(st); return [t, r3(Math.max(t + 0.08, tn[1])), tn[2], vel]; })() : [t, r3(t + 0.3), 72 + o[3], vel];
  // in the catastrophe the thorns stay twice as long (goneBy 2.4, the touch's own limit is 2.5), so they pile up
  const cat = o[0] >= 139.6 ? { goneBy: 2.4 } : {};
  return withValues(n, nearFF(o[0]) ? { intensity: 1.4, broad: o[0] >= 139.6 ? 1.5 : 1.3, ...cat } : cat);
});

// ---------- interlock: the sword clashes; the two loudest volleys drive the needles wider and deeper ----------
// The critic's pass: the cage. The needles come from floor and ceiling, the geometry of the lovers' duet at 74.8; here
// they do not vanish but build up. Each clash raises how long the mesh stays (1.6 s at the first blow, the knob's 4 by
// the last volley at 190) and how wide a needle is (1.4 to 2, wedges like the keys), so the swords close into a cage of
// red and bone over the whole width. The knob is read every frame, so it moves only at real clashes, in small steps.
// The violins' collapse (196.5-198.85) falls inside the standing cage; the clash it lands on (198.80) shatters it: stays
// 0.35, and the last two clashes are splinters.
const CAGE0 = 139.6, CAGE1 = 190.4, SHATTER = 198.80;
// The swords' pitches sit in a narrow band (a cymbal stroke's top note, Eb4..B6), so on the full keyboard they all fell
// in one place right of centre. The clip's window stretches the widget's keyboard twice as wide (region w 2, x 0.22),
// so that band spans the picture and the cage covers it; the needles come out twice as broad, so the widths here are
// halved. The three lowest strokes (A1, D2, C3, nominal pitches) are lifted by octaves into the band so none falls off.
const clashes = set('clash-strokes').map((n0) => {
  const n = [...n0]; while (n[2] < 61) n[2] += 12;
  if (n[0] >= SHATTER - 0.02) return withValues(n, { stays: 0.35, width: 0.5, bite: 1 });
  const k = (n[0] - CAGE0) / (CAGE1 - CAGE0);
  const volley = (n[0] >= 148 && n[0] <= 153.5) || (n[0] >= 187 && n[0] <= 190.4);
  return withValues(n, { stays: r3(lerp(1.6, 4, k)), width: volley ? 1.3 : r3(lerp(0.7, 1.1, k)), ...(volley ? { bite: 1.8 } : {}) });
});

// ---------- squares-snap: fate ----------
// The break's knocks (small, calm); the low strokes of the feud and the catastrophe from the audio (< 150 Hz flux
// >= 0.8, each the lowest note struck with it, else octave 2), larger on the strongest; the freeze's two soft strokes;
// the blow at 212.38 large, sinking alone.
const BLOW = 212.38;
const lowStrokes = ev.lo_peaks.filter((p) => p[0] >= 117.8 && p[0] < 202.6 && p[1] >= 0.8).map((p) => {
  const b = bassAt(p[0]); const t = r3(p[0]);
  const n = b ? [t, r3(Math.max(b[1], t + 0.3)), b[2], 100] : [t, r3(t + 0.4), 36 + p[4], 100];
  // fate's four heaviest strokes (flux >= 1.15: 139.6, 147.9, 161.0, 192.3) also jolt the whole picture
  return withValues(n, p[1] >= 1.15 ? { size: r3(lerp(0.8, 1.5, (p[1] - 0.8) / 1.0)), shake: 1.6 } : { size: r3(lerp(0.8, 1.5, (p[1] - 0.8) / 1.0)) });
});
const catBlows = set('catastrophe-blows').filter((n) => n[0] < 202.6 && !lowStrokes.some((s) => Math.abs(s[0] - n[0]) < 0.3))
  .map((n) => withValues(n, { size: 1.1 }));
const freeze = [[206.8, 'G2'], [211.437, null]].map(([t, s]) => {
  if (s) { const b = bassAt(t); return withValues([r3(t), r3(t + 0.5), b ? b[2] : 43, 70], { size: 0.6 }); }
  const n = set('catastrophe-blows').find((x) => Math.abs(x[0] - t) < 0.01); return withValues(n, { size: 0.6 });
});
const blowN = set('catastrophe-blows').find((x) => Math.abs(x[0] - BLOW) < 0.01);
const fate = sortN([
  ...knockNotes.map((n) => withValues(n, { size: 0.7 })),
  ...lowStrokes, ...catBlows, ...freeze,
  withValues(blowN, { size: 2, life: 3, intensity: 1.6 }),
]);

// ---------- the ground ----------
// The rose field: the muted chords, then the bass line; in the break each bass note cools it toward plum.
const groundLove = sortN(dedupe([...set('sigh-chords'), ...within(set('bass-line'), 22.3, 117.8)])).map((n) => {
  if (n[0] >= 95) return withValues(n, { home: r3(lerp(-0.35, -0.85, (n[0] - 95) / 12)) });
  return n;
});
const groundFeud = sortN(dedupe([...within(set('bass-line'), 117.8, 139.6), ...within(attacks(set('chord-blocks')).map(low), 117.8, 139.6)]));
// the catastrophe's ground: black, lit from inside only by the real ff blows (a blood glow behind the swords)
const bloodBlows = set('ff-blows');
const groundFreeze = within(set('bass-line'), 202.6, BLOW - 0.05).concat(within(pack.notes, 202.6, BLOW - 0.05).filter((n) => n[2] < 50))
  .map((n) => [r3(n[0]), r3(n[1]), n[2], n[3]]);
const dying = set('dying-roll');

const picks = {
  ...Object.fromEntries(Object.entries(ROWS).map(([k, ns]) => [`love-${k}`,
    { notes: k === 'r8' ? sortN([...ivoryRow(ns, { ...STRUCK, crater: 0.3 }), ...presses]) : ivoryRow(ns) }])),
  'love-violas': { notes: DUET },
  'velvet': { notes: velvet },
  'strings': { notes: stringsSet },
  'feud-thorns': { notes: thorns },
  'clash-strokes': { notes: clashes },
  'fate': { notes: fate },
  'ground-love': { notes: groundLove },
  'ground-feud': { notes: dedupe(groundFeud) },
  'ff-blows': { notes: bloodBlows },
  'ground-freeze': { notes: dedupe(groundFreeze) },
  'dying-roll': { notes: dying },
};

// ---------- clips ----------
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
const rowClip = (k, a, b, track) => ({ id: `ivory-${k}`, start: a, end: b, track, fade: 0.2, widget: 'ivory', listen: `picks:love-${k}`, knobs: { ...STRUCK } });
const clips = [
  // the rose field: dim under the sighs, warming with the swell, full under the love theme, cooling in the break
  { id: 'field-rose', start: 0, end: 117.7, track: 0, fade: 1.5, widget: 'fields', listen: 'picks:ground-love',
    knobs: { home: { base: -0.15, drive: '' }, chords: 0.12, back: 0.4, n: 3 },
    intensity: iv([[0, 0.3], [6, 0.5, 'ease'], [22.5, 0.55], [36.8, 0.75, 'ease'], [37.9, 1], [94.8, 0.95], [97.5, 0.45, 'ease'],
      [113.8, 0.32], [117.5, 0]]) },
  // the feud's rust field (the feud pack's), cut dead by the catastrophe's first blow (139.63)
  { id: 'field-rust', start: 117.4, end: 139.63, track: 1, fade: 0, widget: 'fields', listen: 'picks:ground-feud',
    knobs: { home: { base: 0.6, drive: '' }, chords: 0.12, back: 0.9, n: 2 },
    intensity: iv([[117.4, 0], [118.4, 0.45], [139.4, 0.6]]) },
  // the catastrophe on black: one blood field that only the ff blows light from inside
  { id: 'field-blood', start: 139.63, end: 202.62, track: 1, fade: 0, widget: 'fields', listen: 'picks:ff-blows',
    knobs: { home: { base: 0, drive: '' }, chords: 0, back: 1.65, n: 1, dyn: 1 },   // critic: 1.2 was a constant murky red
    intensity: iv([[139.63, 1], [196.5, 1], [196.7, 0.3], [198.8, 0.3], [198.9, 1]]) },
  // the freeze: one cold plum field breathing on the tremolo G, cut dead by the blow
  { id: 'field-freeze', start: 202.6, end: BLOW, track: 0, fade: 0, widget: 'fields', listen: 'picks:ground-freeze',
    knobs: { home: { base: -0.9, drive: '' }, chords: 0.1, back: 0.5, n: 1, dyn: 0.6 },
    intensity: iv([[202.6, 0], [204, 0.55, 'ease'], [212.3, 0.6]]) },
  // the roll: the love theme's rose field comes back once, faintly, and dies with the roll
  { id: 'field-last', start: 213.4, end: 220.5, track: 0, fade: 0.6, widget: 'fields', listen: 'picks:dying-roll',
    knobs: { home: { base: -0.15, drive: '' }, chords: 0, back: 0.45, n: 1, dyn: 0.6 },
    intensity: iv([[213.4, 0], [214.4, 0.75, 'ease'], [216, 0.55], [218, 0.25], [219.6, 0]]) },
  // the velvet: the sighs, the love theme's answers, the broken theme
  { id: 'velvet', start: 0, end: 117.8, track: 2, fade: 1, widget: 'nap', listen: 'picks:velvet', knobs: { rest: 5 } },
  // the strings, one thread
  { id: 'strings', start: 0, end: 202.62, track: 3, fade: 1, widget: 'crimp', listen: 'picks:strings', knobs: { ...CALM } },
  // fate
  { id: 'fate', start: 99.6, end: 216, track: 4, fade: 0.6, widget: 'squares-snap', listen: 'picks:fate',
    knobs: { size: 0.7, life: 1, blur: 0.6, shake: 0 } },
  // the thorns and the swords
  { id: 'thorns', start: 117.8, end: 202.62, track: 5, fade: 0.3, widget: 'prickle', listen: 'picks:feud-thorns' },
  { id: 'swords', start: 139.4, end: 202.62, track: 6, fade: 0.3, widget: 'interlock', listen: 'picks:clash-strokes', knobs: { width: 0.7 },
    region: { mode: 'window', shape: 'rect', x: 0.22, y: 0.5, w: 2, h: 1, feather: 0, fit: 'stretch', blend: 'lighten' } },
  // the love theme: one row per phrase, each ending as the next begins
  rowClip('r1', 39.4, 47.2, 7), rowClip('r2', 47.2, 55.4, 8), rowClip('r3', 55.4, 62.15, 7), rowClip('r4', 62.15, 69.25, 8),
  rowClip('r5', 69.25, 76.4, 7), rowClip('r6', 76.4, 82.7, 8), rowClip('r7', 82.7, 89.6, 7), rowClip('r8', 89.6, 117.4, 8),
  // the violas' climb hanging from the ceiling: a small copy, turned over, its keys reaching down half the picture
  { id: 'ivory-violas', start: 69.6, end: 78.6, track: 9, fade: 0.2, widget: 'ivory', listen: 'picks:love-violas',
    knobs: { ...STRUCK },
    region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.29, w: 1, h: 0.58, rot: 180, feather: 0, fit: 'stretch', blend: 'lighten' } },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 5. Return and catastrophe · A "Milk and thorn": Ivory rows at full height on the love theme, its falling answers as Nap\'s oxblood velvet (the sighs come back as the answer); the violas\' climb hangs from the ceiling; fate\'s knocks press the last row into the ground key by key; then Prickle thorns, Interlock needles, Crimp wool and red Snap-square bells; a rose field, rust, blood, a cold freeze, one last blow alone',
  composer: { by: 'claude', at: '2026-11-06T20:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${ID}: ${clips.length} clips; ` + Object.entries(picks).map(([k, v]) => `${k} ${v.notes.length}`).join(', ') + `; errors ${errors.length}, warnings ${warnings.length}`);
if (process.argv.includes('--rows')) writeFileSync(process.argv[process.argv.indexOf('--rows') + 1],
  JSON.stringify(Object.fromEntries(Object.entries(picks).filter(([k]) => k.startsWith('love-')).map(([k, v]) => [k, v.notes]))));
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
