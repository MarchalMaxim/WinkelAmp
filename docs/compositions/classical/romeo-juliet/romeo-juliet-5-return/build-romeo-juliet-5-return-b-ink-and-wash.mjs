// Builds shows/romeo-juliet-5-return-b-ink-and-wash.json: cycle B "Ink and wash" on the return and the catastrophe.
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-5-return/build-romeo-juliet-5-return-b-ink-and-wash.mjs
//
// THE CYCLE'S MAPPING (as cast, the same in every pack of cycle B):
//   scribble  <- the feud's syncopated strings (nervous graphite pens, a scratch on each accent)      [as in 2-feud-b]
//   kline     <- the sword clashes (cymbal-bright audio strokes): bone bars, blood red once blood is drawn [as in 2-feud-b]
//   duet      <- the lovers: two liquids, vermilion and cobalt (thick = the bass, quick = the singing line)
//   brush     <- the sighs                                                                            [as in 1-friar-b]
//   horizon   <- the night ground of the love music
//   rorschach <- fate: low strokes and the blows (soot ink with a gold rim, ink 2; bone at the end)   [as in 1-friar-b]
//
// THE STORY, told by the duet's own physics. Duet judges every attack against what is sounding: consonant, the two
// liquids lean together and lie against each other along a seam; dissonant, they are flung apart and spatter. So the
// set the duet hears IS the drama:
//   0-20.3     the sighs: two SMALL drops on a dark sea, rocking with the muted strings' chords; every sigh (an
//              appoggiatura, a real dissonance against the chord) makes them flinch, every resolution leans them back.
//              Brush writes one bone stroke per sigh. A deliberate spare entrance (pp, -48 dB): three threads.
//   20.3-37.6  the love theme swells in: the drops grow WITH EACH NOTE of the theme (per-note size follows the audio's
//              loudness at that note), the sea brightens with the crescendo (horizon presence 0.4 -> 1).
//   37.6-95    ecstatic: the full liquids over the stark night sea; pull 1.5, so on the consonant chords they lie pressed
//              together and on the theme's chromatic notes they flinch apart, with a spatter; the harp's arpeggios glint
//              along the horizon line. A second duet clip on the same set, in a small soft copy turned upside down
//              low in the sea (x .5, y .85, w .62, h .22, feather .6, intensity 0.6: fainter and hearing 60 % of the
//              attacks, so it wavers): the lovers' colours reflected on the water. Brush answers with the theme's own
//              held, leaning notes (>= 0.8 s).
//   95-117.8   the theme breaks: the sea goes dark, the reflection is gone, the drops shrink with the music; pull falls
//              to 0.7, so they no longer find each other. Fate's first omens: small blots on the low strokes (101.8-113.8,
//              from the audio, < 150 Hz jumps >= 22 dB), drying at once. The feud's runs wake ONE pen (106.6).
//   117.8      the feud returns (-34 -> -20 dB): the sea is gone, black ground. The pens at full on the strings, and
//              their lines STAY longer and longer (stay 7 -> 16 by 139.6), so the sheet fills into a graphite thicket as
//              the feud builds; the lovers, pull 0, hang apart inside it.
//   139.7-195.6 the catastrophe: bone bars on the sword clashes, each soaking away in 2.5 s; fate's ink soaks the ground
//              sepia from the first blow, in waves on the low ff blows. The pens a little calmer (present 0.7) so the
//              lovers stay visible; they are flung to the corners, spattering, on every dissonance (push 1.8).
//   195.6-202.7 the three great blows (195.65, 198.83, 200.51): the bars turn BLOOD red; fate floods (size 2.2).
//   202.7-211.4 THE FREEZE: the music stops on the held G chord (-33 dB). The pens stop, the last blood bar soaks away
//              over 12 s, and the lovers - hearing the held chord (consonant), pull 1.6 - drift together one last time
//              and lie still, the bar lying across them.
//   211.44     F# enters against the held G (a semitone): fate's blow tears them apart; 212.38 the last blow: they are
//              flung and dissolve (the clip fades over 1.4 s), and every drop of fate's ink turns BONE (ink 5 on that
//              note; ink is read every frame): one mirrored blot. In round 3 it came out as two pale lobes joined at the
//              fold: the two liquids that could never mix, one shape at last in fate's mirror. (The same bone turn as the
//              Friar's cut-off in 1-friar-b.)
//   212.4-220.5 the dying roll: the night sea comes back under the blot, drained of colour (horizon colour 0: greys)
//              and empty; each stroke of the timpani roll glints on the horizon; it sinks toward black with the roll.
//
// WHAT I FOUND (and why the feud set is built the way it is): Duet's interval rule hears a diminished chord as
// CONSONANT (two minor thirds outvote one tritone), so the feud's accents heard as whole chords pulled the lovers
// TOGETHER (80 % consonant verdicts in the catastrophe). So the lovers hear the feud's dissonances: an accent whose own
// chord is dissonant by Duet's rule (14 of 147: a semitone, a cluster such as Ab-A at 199.21) is heard whole; every
// other accent, like the clashes and the ff blows, is heard as one stroke (its top note), which carries the last
// verdict on (Duet's own rule for a bare note); the scurrying runs as they are. Result: 52/40 then 28/47
// consonant/dissonant in 139.8-170 / 170-202.7 - the tearing escalates.
// Also found: the canvas fades, but Horizon repaints the whole picture every frame, so every widget that builds its
// picture over time (brush, scribble, kline) sits in a full-frame see-through window over it; Rorschach redraws its own
// ink buffer each frame, so it sits on the shared picture as the ground (in a see-through window its soot read as a
// brown veil over everything).
//
// WEIGHT TABLE (rough presence per 30 s; H horizon, D duet, d reflection, B brush, S scribble, K kline, R rorschach):
//   0-30 H.3->.6 D(small, growing) B1 d(from 21) | 30-60 H1 D1 d.6 B.6 | 60-90 H1 D1 d.6 B.6 |
//   90-120 H1->.1 D(shrinking) d->0 B.85 S.3->1 R(omens) | 120-150 S1(thicket) D1 R.5 K1 | 150-180 S.7 K1 D1 R.8 |
//   180-210 S.7->0 K1(blood from 195.6)->soak D1 R1(flood) | 210-220 R(bone) D(dies) H(grey, empty)
//
// KNOBS (only where they serve the concept): duet per-note size/pull/push (the drops grow with the theme; they want each
// other in the love music, pull 0 in the feud so nothing draws them back, push 1.8 so a dissonance flings them);
// kline thresh 0.55 (bone) and 0.5 (blood: see the blood set), colour 1 for blood (as in 2-feud-b), blend 'lighten' (critic:
// its night ground muddied everything through the see-through blend), and stay FIXED (drive '') at 2.5 (bone) and 4 (blood)
// instead of our default (+level): the catastrophe is loud throughout, so the default piled the bars into a red lattice
// in round 1; fixed short, each bar is one strike and the picture breathes between clashes; rorschach ink 2 (the
// cycle's sepia) with per-note size/fade/ink for the omens, the waves, the flood (fade 8, so the bone blot is mostly
// the last blow's own, size 1.8) and the bone turn; fate's ff-blow notes are clamped to MIDI 49 or lower so that each
// low blow drops a blot (a few audio-derived blows sit higher); scribble per-note stay for the build; horizon colour 0
// in the empty sea. Scribble's and brush's own knobs at our defaults.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-5-return-b-ink-and-wash', SONG = 'romeo-juliet-5-return';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const ev = JSON.parse(readFileSync(join(HERE, 'audio-events.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const set = (id, a = -1, b = 1e9) => {
  const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`);
  return s.notes.filter((n) => n[0] >= a && n[0] < b).map((n) => [n[0], n[1], n[2], n[3]]);
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const lerp = (a, b, k) => a + (b - a) * clamp(k, 0, 1);
const lerpPts = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) {
    const [t0, a] = pts[i - 1], [t1, b] = pts[i];
    return a + (b - a) * (t - t0) / (t1 - t0);
  }
  return pts[pts.length - 1][1];
};
const sortN = (ns) => ns.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
/** One note per pitch per attack (within 40 ms); the first kept. */
const dedupe = (ns) => {
  const out = [];
  for (const n of sortN([...ns])) if (!out.slice(-16).some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.04)) out.push(n);
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
const T = pack.tracks;
const ALL = [...pack.notes, ...Object.values(T).flatMap((t) => t.notes)];
const near = (ts, t, w) => ts.some((x) => Math.abs(x - t) <= w);
const dB = (t) => ev.curve[clamp(Math.round(t / ev.hop), 0, ev.curve.length - 1)][0];
const velOfDb = (d) => clamp(Math.round(20 + 2.4 * (d + 60)), 15, 122);

// ---------- the lovers (duet, and its reflection) ----------
// Duet's verdict, as lab/tools/duet.js computes it, to print what the set makes them do per section.
const CONS = [0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0], DISS = [0, 2, 1.5, 0, 0, 0, 1.5, 0, 0, 0, 0.6, 2];
const verdicts = (ns) => {
  let last = true;
  return attacks(ns).map((a) => {
    const t = a[0][0], snd = ns.filter((n) => n[0] <= t + 0.001 && n[1] > t && n[0] >= t - 8);
    let c = 0, d = 0;
    for (const n of a) for (const s of snd) { const iv = Math.abs(n[2] - s[2]) % 12; c += CONS[iv]; d += DISS[iv]; }
    const v = c + d ? (c - d) / (c + d) : (last ? 0.2 : -0.2); last = v >= 0; return [t, v];
  });
};
/** A melody with its transcribed overlaps cut (a legato overlap would read as a second against itself). */
const legato = (ns) => sortN(ns).map((n, i, a) => {
  const nx = a.slice(i + 1).find((m) => m[0] > n[0] + 0.04);
  return nx && n[1] > nx[0] - 0.02 ? [n[0], r3(Math.max(n[0] + 0.1, nx[0] - 0.02)), n[2], n[3]] : n;
});
/** The full chord struck at t (roll and pack, within 50 ms), one note per pitch, held at most `hold` s. */
const chordAt = (t, hold = 0.35) => {
  const out = [];
  for (const n of ALL.filter((q) => Math.abs(q[0] - t) <= 0.05)) if (!out.some((o) => o[2] === n[2])) out.push([r3(t), r3(Math.max(t + 0.08, Math.min(n[1], t + hold))), n[2], n[3]]);
  return out;
};

const lovers = [];
// the sighs: the oboe and clarinets' figure, the muted strings' rocking chords, the bass
lovers.push(...set('sighs'), ...set('sigh-chords'), ...set('bass-line', 0, 20.3));
// the love theme (its swell and its ecstatic statement) over its bass
lovers.push(...legato(set('love-theme', 20.3, 96)), ...set('bass-line', 20.3, 95));
// the break: the theme's broken line over its bass
lovers.push(...legato(set('broken-theme', 95, 117.8)), ...set('bass-line', 95, 117.8));
// the feud: the lovers hear its DISSONANCES. Duet's rule hears a diminished chord as weakly consonant (two minor thirds
// outvote one tritone: 80 % of the feud's accents would draw the lovers together), so an accent whose own chord is
// dissonant by that rule (a semitone, a cluster: Ab-A at 199.21) is heard whole, and every other accent, like the
// clashes and the ff blows, is heard as a stroke: one note (its top), which carries the last verdict on. Its scurrying
// runs are heard as they are (a run's notes overlap: seconds).
const accT = attacks(set('feud-accents')).map((a) => a[0][0]);
const ownVerdict = (ch) => {
  let c = 0, d = 0;
  for (let i = 0; i < ch.length; i++) for (let j = i + 1; j < ch.length; j++) { const k = Math.abs(ch[i][2] - ch[j][2]) % 12; c += CONS[k]; d += DISS[k]; }
  return c + d ? (c - d) / (c + d) : 0;
};
let harsh = 0;
for (const t of accT) {
  const ch = chordAt(t);
  if (!ch.length) { const own = set('feud-accents').filter((n) => Math.abs(n[0] - t) < 0.04); ch.push(...own.map((n) => [r3(n[0]), r3(n[0] + 0.12), n[2], n[3]])); }
  if (ch.length > 1 && ownVerdict(ch) < 0) { lovers.push(...ch); harsh++; }
  else { const top = ch.reduce((a, n) => (n[2] > a[2] ? n : a)); lovers.push([top[0], r3(top[0] + 0.12), top[2], top[3]]); }
}
lovers.push(...set('feud-runs', 106.6, 203));
const strokeT = [...set('clash-strokes').map((n) => n[0]), ...attacks(set('ff-blows')).map((a) => a[0][0])].sort((a, b) => a - b);
for (const t of strokeT) {
  if (near(accT, t, 0.05)) continue;
  const top = set('clash-strokes').find((n) => Math.abs(n[0] - t) < 0.01) ?? set('ff-blows').find((n) => Math.abs(n[0] - t) < 0.01);
  lovers.push([r3(t), r3(t + 0.12), top[2], top[3]]);
}
// the freeze: the held G chord. The roll repeats G2 G3 Bb3 202.76-203.88 over C#4 E4 (struck 202.21); the audio holds
// G (with E and C#) until 211.3 s at -30..-37 dB, so the chord's notes are held to 211.45.
const FREEZE_END = 211.45;
for (const n of chordAt(202.21)) lovers.push([n[0], FREEZE_END, n[2], n[3]]);
for (const a of attacks(ALL.filter((n) => n[0] >= 202.7 && n[0] < 204))) {
  const t = a[0][0];
  for (const m of [43, 55, 58]) if (a.some((n) => n[2] === m)) lovers.push([r3(t), FREEZE_END, m, a.find((n) => n[2] === m)[3]]);
}
for (const t of [204.86, 205.24, 205.5, 206.78]) for (const n of chordAt(t)) lovers.push([n[0], FREEZE_END, n[2], n[3]]);
// fate's blows: F#1 / F#2 at 211.34-211.44 against the held G (a semitone), then the last blow at 212.38 (the roll labels
// it F2; the audio's strongest pitch class there is F#, so it is F#2 here, at the audio's level)
lovers.push([211.344, 213.6, 54, 100], [211.44, 213.6, 30, 104], [212.38, 213.6, 42, velOfDb(-19)]);
const loversD = dedupe(lovers.filter((n) => n[0] < 213));

// per-note knobs: the drops grow with the music in the love (size from the audio's loudness at the note), they want
// each other there (pull) and cannot reach each other in the feud
const sizeAt = (t) => {
  if (t < 20.3) return 0.5;
  if (t < 95.5) return r3(lerp(0.55, 1.3, (dB(t) + 44) / 24));
  if (t < 117.8) return r3(lerp(1.15, 0.7, (t - 95.5) / 22));
  if (t < 202.6) return 1;
  if (t < 211.3) return 0.85;
  return 0.85;
};
const pullAt = lerpPts([[0, 1], [20.3, 1.1], [37.6, 1.5], [95, 1.5], [99, 0.7], [117.8, 0], [202.6, 0], [202.7, 1.6], [211.3, 1.6], [211.31, 0]]);
const pushAt = lerpPts([[0, 0.55], [20.3, 0.7], [95, 0.8], [117.8, 1.4], [139.6, 1.8], [202.6, 1.8], [202.7, 0.6], [211.3, 0.6], [211.31, 2]]);
const loversV = loversD.map((n) => withValues(n, { size: sizeAt(n[0]), pull: r3(pullAt(n[0])), push: r3(pushAt(n[0])) }));

// ---------- the sea (horizon): the night ground of the love music ----------
// The rocking chords, the bass (which lowers the horizon), the harp's arpeggios glinting along the line, the broken theme.
const sea = dedupe([...set('sigh-chords'), ...set('bass-line', 0, 117.8), ...set('harp', 39, 96), ...set('broken-theme', 95, 117.8)]);
// the empty sea at the end: each stroke of the timpani roll (the pack's F#1/F#2/B1 strokes 213.9-218.5), at the
// audio's level as it dies away; the dying-roll hole cover holds the F# under them
const roll = dedupe([
  ...set('dying-roll'),
  ...ALL.filter((n) => n[0] >= 213.85 && n[0] < 219.5 && n[2] < 52).map((n) => [r3(n[0]), r3(Math.max(n[1], n[0] + 0.1)), n[2], velOfDb(dB(n[0] + 0.05))]),
]);

// ---------- the sighs (brush) ----------
// the oboe and clarinets' sighs; in the ecstatic statement the theme's own held, leaning notes (>= 0.8 s); the broken line
const sighsBrush = dedupe([
  ...set('sighs'),
  ...set('love-theme', 37.6, 96).filter((n) => n[1] - n[0] >= 0.8),
  ...set('broken-theme', 95, 117.8),
]);

// ---------- the feud's pens (scribble): violins and violas, accents shaped, as in 2-feud-b ----------
// A plain note is held at 20-52 (it jolts and presses its pen), an accent (the feud-accents attacks) is 86-91 (a scratch),
// an ff blow that is not a clash 104 (a long stab). Before 117.8 only the scurrying runs wake one pen.
const clashT = set('clash-strokes').map((n) => n[0]);
const ffT = attacks(set('ff-blows')).map((a) => a[0][0]);
const stabT = ffT.filter((t) => !near(clashT, t, 0.15));
const strNotes = [];
for (const tr of ['violin', 'viola']) for (const n of T[tr].notes) if (n[0] >= 117.8 && n[0] < 204) strNotes.push([n[0], n[1], n[2], n[3]]);
const ded = dedupe(strNotes);
const shaped = [
  ...set('feud-runs', 106.6, 117.8).map((n) => [r3(n[0]), r3(Math.max(n[0] + 0.05, n[1])), n[2], clamp(Math.round(n[3] * 0.62), 20, 52)]),
  ...ded.map((n) => [r3(n[0]), r3(Math.max(n[0] + 0.05, n[1])), n[2], clamp(Math.round(n[3] * 0.62), 20, 52)]),
];
const cellos = T.cello.notes;
for (const t of accT) {
  const struck = [...ded, ...cellos].filter((n) => Math.abs(n[0] - t) <= 0.05).sort((a, b) => a[2] - b[2]);
  if (!struck.length) continue;
  const idx = struck.length <= 4 ? struck.map((_, i) => i) : [0, Math.floor(struck.length / 3), Math.floor(2 * struck.length / 3), struck.length - 1];
  const stab = near(stabT, t, 0.08);
  for (const i of idx) {
    const n = struck[i], s = r3(n[0]);
    const vel = stab ? 104 : 86 + Math.round(5 * clamp((n[3] - 60) / 60, 0, 1));
    const j = shaped.findIndex((m) => m[2] === n[2] && Math.abs(m[0] - s) < 0.001);
    if (j >= 0) shaped[j][3] = vel; else shaped.push([s, r3(Math.max(n[0] + 0.05, n[1])), n[2], vel]);
  }
}
// the feud's return builds (117.8-139.7, -34 -> -20 dB, no clash yet): the pens' lines STAY longer and longer (stay
// 7 -> 16), so the sheet fills into a graphite thicket as the tension mounts; the first clash clears it (back to 7).
const stayBuild = lerpPts([[117.8, 7], [139.6, 16]]);
const feudPens = sortN(shaped).map((n) => (n[0] >= 117.8 && n[0] < 139.65 ? withValues(n, { stay: r3(stayBuild(n[0])) }) : n));

// ---------- the swords (kline): bone through the fight, blood from the first of the three great blows ----------
// Each clash with the lowest note struck with it (a wide tutti -> a long bar; its register sets the angle), velocity from
// the high band's jump, as in 2-feud-b. The last clash (202.08) stays 12 s: it soaks away through the freeze.
const BLOOD = 195.6;
const hiPeak = (t) => ev.hi_peaks.reduce((b, p) => (Math.abs(p[0] - t) < Math.abs(b[0] - t) ? p : b));
const sword = (t, top, values) => {
  const struck = ALL.filter((n) => Math.abs(n[0] - t) <= 0.06);
  const low = struck.length ? struck.reduce((a, n) => (n[2] < a[2] ? n : a)) : null;
  const hp = hiPeak(t), vel = clamp(Math.round(100 + 1.2 * Math.max(0, hp[3])), 100, 127);
  const end = r3(t + 0.4), out = [withValues([r3(t), end, top, vel], values)];
  if (low && low[2] <= top - 12) out.unshift(withValues([r3(t), end, low[2], vel], values));
  return out;
};
const clashes = set('clash-strokes');
const swordsBone = clashes.filter((n) => n[0] < BLOOD).flatMap((n) => sword(n[0], n[2]));
// (critic) The blood bars are the three great blows themselves (catastrophe-blows 195.65, 198.83, 200.51) and the last
// clash (202.08): each the blow's own low note (the catastrophe-blows pitch) and the highest orchestral note struck with
// it (<= MIDI 84), velocity from the high band's jump as before. Why the first bar never showed (rounds 3 and 4): Kline
// ranks a chord's loudness against the notes it hears, so on a set of four the softest attack scores lowest and, at
// thresh 0.55, only leaves a small mark. The first blow (113) is the softest here. With two notes and thresh 0.5 (the
// knob's left end) a softest FIRST chord still strikes (0.505); the three after it rank higher and strike anyway.
const BLOWS = [...set('catastrophe-blows').filter((n) => n[0] >= BLOOD && n[0] < 201), ...set('catastrophe-blows').filter((n) => Math.abs(n[0] - 202.08) < 0.01)];
const swordsBlood = BLOWS.flatMap((b) => {
  const t = b[0], tops = ALL.filter((n) => Math.abs(n[0] - t) <= 0.06 && n[2] <= 84 && n[2] >= b[2] + 12);
  const top = tops.length ? tops.reduce((x, n) => (n[2] > x[2] ? n : x))[2] : b[2] + 24;
  const hp = hiPeak(t), vel = clamp(Math.round(100 + 1.2 * Math.max(0, hp[3])), 100, 127), end = r3(t + 0.4);
  const v = t > 202 ? { stay: 12 } : undefined;
  return [withValues([r3(t), end, b[2], vel], v), withValues([r3(t), end, top, vel], v)];
});
sortN(swordsBlood);

// ---------- fate (rorschach): soot ink with a gold rim, the cycle's sepia; bone at the last blow ----------
// Only notes below MIDI 50 drop blots (higher ones fling specks). The omens are the break's low strokes from the audio
// (< 150 Hz band jumps >= 22 dB): each the lowest note struck within 60 ms, else the audio's pitch class at octave 2.
const FV = (size, fade, k = {}) => ({ size: r3(size), fade: r3(fade), ...k });
const lowAt = (t, w = 0.06) => {
  const s = ALL.filter((n) => Math.abs(n[0] - t) <= w);
  return s.length ? s.reduce((a, n) => (n[2] < a[2] ? n : a)) : null;
};
const fate = [];
for (const p of ev.lo_peaks.filter((q) => q[0] > 100 && q[0] < 115 && q[3] >= 22)) {
  const lo = lowAt(p[0]);
  const m = lo && lo[2] < 50 ? lo[2] : 36 + p[4];
  fate.push(withValues([r3(p[0]), r3(p[0] + 0.5), m, velOfDb(dB(p[0] + 0.1))], FV(0.5, 2.5)));
}
// (critic) the feud's return (117.8-139.6): fate keeps dripping under the pens, small omens on the bass's strongest low
// notes (< MIDI 50, velocity >= 80, at least 1 s apart: the ostinato hits at 127-131, the E1 at 134.3, the C#2 at 137),
// a little larger toward the first clash. Before, fate fell silent from 114 s to 139.7 s and this loud build had two
// threads on black.
{
  let last = -9;
  for (const n of sortN(ALL.filter((q) => q[0] >= 117.8 && q[0] < 139.6 && q[2] < 50 && q[3] >= 80).map((q) => [...q]))) {
    if (n[0] - last < 1) continue;
    last = n[0];
    const k = (n[0] - 117.8) / 21.8;
    fate.push(withValues([r3(n[0]), r3(Math.max(n[1], n[0] + 0.3)), n[2], n[3]], FV(lerp(0.45, 0.6, k), lerp(2.5, 3.5, k))));
  }
}
// the catastrophe: the low notes of the ff blows, the blots growing wave by wave (the composer's sizes and fades).
// (critic) The olive-brown veil over 140-212 s was not fate's ink: it was Kline's own night ground (#100e0d with lighter
// brushed patches) leaking through the see-through blend. The Kline clips now use blend 'lighten' (BARS below), so the
// ground is black and these blots read as gold-rimmed soot shapes.
for (const a of attacks(set('ff-blows', 139, 195))) {
  const lo = a.reduce((x, n) => (n[2] < x[2] ? n : x));
  const k = (a[0][0] - 139.7) / 55;
  const m = lo[2] < 50 ? lo[2] : (lowAt(a[0][0])?.[2] ?? lo[2]);
  fate.push(withValues([r3(lo[0]), r3(Math.max(lo[1], lo[0] + 0.3)), Math.min(m, 49), lo[3]], FV(lerp(0.7, 1.4, k), lerp(5, 10, k))));
}
// the great blows: the flood
const cat = set('catastrophe-blows');
for (const n of cat.filter((q) => q[0] < 201)) fate.push(withValues([n[0], n[1], Math.min(n[2], 49), n[3]], FV(2.2, 8, { intensity: 1.5 })));
for (const n of cat.filter((q) => q[0] >= 201 && q[0] < 203)) fate.push(withValues([n[0], n[1], Math.min(n[2], 49), n[3]], FV(1.2, 11)));
// the freeze: the held G's slow bass notes drip faintly
for (const t of [204.86, 205.24, 205.5, 206.78]) { const lo = lowAt(t); if (lo) fate.push(withValues([r3(t), r3(t + 0.6), lo[2], 70], FV(0.6, 9))); }
// fate's two last blows: F#1 against the held G, then 212.38 (the audio's F#): from that note on all the ink is bone
fate.push(withValues([211.44, 212.3, 30, 104], FV(1.5, 12)));
fate.push(withValues([212.38, 213.5, 42, velOfDb(-19)], FV(1.8, 13, { ink: 5, intensity: 1.4 })));
const fateSet = dedupe(fate);

const picks = {
  'lovers': { notes: loversV },
  'sea': { notes: sea },
  'roll': { notes: roll },
  'sighs-brush': { notes: sighsBrush },
  'feud-pens': { notes: feudPens },
  'swords-bone': { notes: swordsBone },
  'swords-blood': { notes: swordsBlood },
  'fate': { notes: fateSet },
};

// ---------- clips ----------
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
const FULL = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, fit: 'stretch' };
// (critic) Kline paints its own night ground (#100e0d with brushed patches of #1e1a17). Through the default see-through
// stamp that ground stayed a 19-35 % brown veil with a blocky mosaic over everything below (the mud of 140-212 s, which
// the composer blamed on fate's ink). Lighten keeps only what is brighter than the picture below: the bars.
const BARS = { ...FULL, blend: 'lighten' };
// the reflection: the duet's own picture squashed upside down, small and soft, low in the sea under the horizon
const MIRROR = { mode: 'window', shape: 'rect', x: 0.5, y: 0.85, w: 0.62, h: 0.22, rot: 180, feather: 0.6, fit: 'stretch' };
const clips = [
  // the night sea: dim under the sighs, opening with the crescendo, stark in the ecstasy, darkening as the theme breaks
  { id: 'sea', start: 0, end: 119, track: 0, fade: 3, widget: 'horizon', listen: 'picks:sea', intensityMoves: 'present',
    intensity: iv([[0, 0.3], [20.3, 0.4], [37.6, 1], [95, 1], [100, 0.55], [112, 0.3], [117.8, 0.12]]) },
  // the empty sea after the last blow, drained of colour; the roll glints and sinks toward black
  { id: 'empty-sea', start: 212.4, end: 220.5, track: 0, fade: 1.8, widget: 'horizon', listen: 'picks:roll',
    knobs: { colour: 0 }, intensityMoves: 'present', intensity: iv([[212.4, 0.75], [215, 0.7], [219.5, 0.1]]) },
  // fate's ink: on the shared picture, under everything (the ground itself soaks); over the empty sea at the end
  { id: 'fate', start: 101, end: 220.5, track: 1, fade: 1, widget: 'rorschach', listen: 'picks:fate', knobs: { ink: 2 } },
  // the sighs: one stroke per sigh; lighter in the ecstasy (the duet leads there), back as the theme breaks
  { id: 'sighs', start: 0, end: 119, track: 2, fade: 1.5, widget: 'brush', listen: 'picks:sighs-brush', region: FULL,
    intensityMoves: 'present', intensity: iv([[0, 1], [30, 1], [37.6, 0.6], [95, 0.6], [98, 0.85]]) },
  // the feud's pens: one lone pen on the runs, at full for the feud's return, a little calmer in the catastrophe (so
  // the lovers stay visible among them); stopped in the freeze
  { id: 'pens', start: 106.2, end: 205.5, track: 3, fade: 1.5, widget: 'scribble', listen: 'picks:feud-pens', region: FULL,
    intensityMoves: 'present', intensity: iv([[106.2, 0.3, 'hold'], [117.75, 1], [139, 1], [141, 0.7], [202.6, 0.7], [204, 0.2]]) },
  // their reflection in the sea (the love music only): fainter, and hearing half the attacks, so it wavers
  { id: 'reflection', start: 21, end: 101, track: 4, fade: 4, widget: 'duet', listen: 'picks:lovers', region: MIRROR,
    intensity: iv([[21, 0.6]]) },
  // the lovers, over the pens: the feud surrounds them but does not hide them
  { id: 'lovers', start: 0, end: 213.8, track: 5, fade: 1.4, widget: 'duet', listen: 'picks:lovers' },
  // the swords cut across everything: bone strikes that soak away within ~2.5 s, so the picture breathes between clashes
  { id: 'swords', start: 139.2, end: 196.6, track: 6, fade: 0.8, widget: 'kline', listen: 'picks:swords-bone', region: BARS,
    knobs: { thresh: 0.55, stay: { base: 2.5, drive: '', depth: 0 } } },
  { id: 'blood', start: 194.9, end: 212.4, track: 7, fade: 0.5, widget: 'kline', listen: 'picks:swords-blood', region: BARS,
    knobs: { thresh: 0.5, colour: 1, stay: { base: 4, drive: '', depth: 0 } } },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 5. The return · B "Ink and wash": the lovers as Duet\'s two liquids, judged by the harmony (lying together on consonance, flung apart by the feud), reflected in Horizon\'s night sea; Brush on the sighs; Scribble pens and Kline bars (bone, then blood) for the feud; Rorschach\'s fate soaking through, turning bone at the last blow over the empty sea',
  composer: { by: 'claude', at: '2026-11-06T22:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
const secs = [[0, 20.3], [20.3, 37.6], [37.6, 95], [95, 117.8], [117.8, 139.8], [139.8, 170], [170, 202.7], [202.7, 211.4], [211.4, 213]];
const vs = verdicts(loversD);
for (const [a, b] of secs) {
  const x = vs.filter((q) => q[0] >= a && q[0] < b), c = x.filter((q) => q[1] >= 0).length;
  console.log(`${a}-${b}: lovers ${x.length} attacks (${c} consonant, ${x.length - c} dissonant)`);
}
console.log(`harsh feud accents heard whole: ${harsh} of ${accT.length}`);
console.log(`${ID}: ${clips.length} clips; ` + Object.entries(picks).map(([k, v]) => `${k} ${v.notes.length}`).join(', ') + `; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
