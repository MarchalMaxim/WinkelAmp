// Pick sets for Holst, Mars, the Bringer of War (songs/holst-mars, 428.7 s), deterministic.
// Run: node docs/compositions/classical/holst-mars/gen-picks.mjs
//   -> writes picks.json next to this file: { "<set id>": { "hears", "source", "rule", "from", "to", "notes": [[start, end, midi, velocity], ...] } }
//   -> prints one line per set, then a JSON summary (id, hears, count, span, attacks per 30 s) that ANALYSIS.md is built from.
//
// Note sources, tagged per set in "source":
//   roll  - pack.tracks, the seven YourMT3+ lanes (piano, plucked, violin, viola, cello, strings, voice). This is the studio
//           note picker's roll for this pack (picker-logic pickerNotes, tracks branch), so these notes are found on the roll.
//   pack  - pack.notes, the hybrid (the piano model's 1093 notes, with YourMT3+ in its gaps). The piano model hears some
//           low brass the lanes miss (the tenor-tuba theme at 197-215 s, the Eb chord at 186.4 s).
//   audio - derived from the recording where the transcription has (almost) nothing: onsets (librosa onset_detect, gated by
//           loudness and strength, one pick per real attack) and held tones (CQT peaks that stay for >= 0.6 s, written as long
//           notes, never re-attacked). Pitch comes from the CQT peak at the onset, velocity from the loudness in dB:
//           v = clamp(round(124 + 2.1 * dB), 15, 125), so -3 dB is ~118, -20 dB is ~82, -40 dB is ~40.
//   mixed - roll notes where the roll has them, audio where it has none.
// The audio features are computed by the Python below (the wa venv's librosa) and cached in the OS temp folder, keyed by
// the audio's sha1 and the script's text; delete the cache file to recompute.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = join(ROOT, 'songs/holst-mars');
const pack = JSON.parse(readFileSync(join(SONG, 'pack.json'), 'utf8'));
const PY = process.env.WA_PYTHON || 'C:/Users/maxim/.venvs/wa/Scripts/python.exe';
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r3 = (x) => Math.round(x * 1e3) / 1e3 || 0;
const clampV = (v) => Math.max(1, Math.min(127, Math.round(v)));

// ================= audio features =================
const PYSRC = String.raw`
import sys, json, numpy as np, librosa, scipy.ndimage as nd
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
hop = 512
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
db = librosa.amplitude_to_db(rms, ref=np.max(rms))
env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
on = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop, units='frames', delta=0.03, wait=3)
times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
L = len(rms)
grid = []
for i in range(int(len(y) / sr * 10)):
    a = int(i * 0.1 * sr / hop); b = max(a + 1, int((i + 1) * 0.1 * sr / hop))
    grid.append(round(float(db[a:min(b, L)].max()), 1))
ch = 1024; fps = sr / ch
C = np.abs(librosa.cqt(y, sr=sr, hop_length=ch, fmin=librosa.midi_to_hz(24), n_bins=72, bins_per_octave=12))
Cd = librosa.amplitude_to_db(C, ref=np.max(C))
Cs = nd.median_filter(Cd, size=(1, 3))
def peaks_at(t0, t1, k=3):
    f0, f1 = int(t0 * fps), max(int(t0 * fps) + 1, int(t1 * fps))
    v = Cd[:, f0:f1].mean(1)
    pk = [i for i in range(1, 71) if v[i] >= v[i - 1] and v[i] >= v[i + 1]]
    pk = sorted(pk, key=lambda i: -v[i])[:k]
    return [[int(i + 24), round(float(v[i]), 1)] for i in pk]
onsets = []
for f in on:
    t = float(times[min(f, L - 1)])
    onsets.append([round(t, 3), round(float(env[min(f, L - 1)]), 2), round(float(db[f:min(f + 4, L)].max()), 1), peaks_at(t + 0.03, t + 0.25)])
# held tones: CQT bins that stay a strong local peak (within 12 dB of the frame's loudest, above -45 dB) for >= 0.6 s
F = Cs.shape[1]
P = np.zeros_like(Cs, dtype=bool)
mx = Cs.max(0)
for i in range(1, 71):
    P[i] = (Cs[i] >= Cs[i - 1]) & (Cs[i] >= Cs[i + 1]) & (Cs[i] >= mx - 12) & (Cs[i] >= -45)
P = nd.binary_closing(P, structure=np.ones((1, 3)))
held = []
for i in range(1, 71):
    row = P[i]; f = 0
    while f < F:
        if row[f]:
            g = f
            while g < F and row[g]: g += 1
            if (g - f) / fps >= 0.6:
                held.append([round(f / fps, 3), round(g / fps, 3), int(i + 24), round(float(Cs[i, f:g].mean()), 1), round(float(Cs[i, f:g].max()), 1)])
            f = g
        else: f += 1
held.sort()
json.dump({'grid': grid, 'onsets': onsets, 'held': held}, sys.stdout)
`;
function audioFeatures() {
  const key = createHash('sha1').update(pack.source.sha1 + PYSRC).digest('hex').slice(0, 12);
  const cache = join(tmpdir(), `winkelamp-holst-mars-audio-${key}.json`);
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'));
  const r = spawnSync(PY, ['-I', '-c', PYSRC, join(SONG, 'audio.mp3')], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('audio analysis failed: ' + r.stderr);
  writeFileSync(cache, r.stdout);
  return JSON.parse(r.stdout);
}
const AU = audioFeatures();
const dbAt = (t) => AU.grid[Math.min(AU.grid.length - 1, Math.max(0, Math.round(t * 10)))];
const velDb = (d) => Math.max(15, Math.min(125, Math.round(124 + 2.1 * d)));
/** Loudest dB in [a, b). */
const dbMax = (a, b) => { let m = -99; for (let t = a; t < b; t += 0.1) m = Math.max(m, dbAt(t)); return m; };
/** When the sound has fallen `drop` dB below its peak after t (or the next onset, whichever is first), capped at `cap`. */
function decayEnd(t, drop = 12, cap = 3) {
  const peak = dbMax(t, t + 0.3); let e = t + 0.3;
  while (e < t + cap && dbAt(e) > peak - drop) e += 0.1;
  return e;
}

// ================= notes =================
const roll = Object.entries(pack.tracks).flatMap(([tr, o]) => o.notes.map(([t, e, m, v], k) => ({ t, e, m, v, tr, k })))
  .sort((a, b) => a.t - b.t || a.m - b.m || a.k - b.k);
const packNotes = pack.notes.map(([t, e, m, v], k) => ({ t, e, m, v, tr: 'pack', k })).sort((a, b) => a.t - b.t || a.m - b.m);
const dur = (n) => n.e - n.t;

/** 40 ms clusters from the first note (groupChords' rule). */
function clusters(ns) {
  const out = []; let cur = null;
  for (const n of ns) {
    if (cur && n.t - cur.t < 0.04) { cur.ns.push(n); if (n.m > cur.top.m) cur.top = n; if (n.m < cur.low.m) cur.low = n; if (n.v > cur.loud.v) cur.loud = n; cur.vmax = Math.max(cur.vmax, n.v); }
    else { cur = { t: n.t, ns: [n], top: n, low: n, loud: n, vmax: n.v }; out.push(cur); }
  }
  for (const c of out) c.pitches = new Set(c.ns.map((n) => n.m)).size;
  return out;
}
const inWin = (src, a, b, f = () => true) => src.filter((n) => n.t >= a && n.t < b && f(n));
/** STYLE's voiced-out line: per cluster the note held >= minDur that is the loudest of its chord (ties: the highest); a
    repeat of the same pitch within 0.15 s is merged (doubled lanes). */
function held(src, a, b, f = () => true, minDur = 0.28) {
  const out = [];
  for (const c of clusters(inWin(src, a, b, f))) {
    const cand = c.ns.filter((n) => dur(n) >= minDur);
    if (!cand.length) continue;
    const best = cand.reduce((p, n) => (n.v > p.v || (n.v === p.v && n.m > p.m) ? n : p));
    const prev = out[out.length - 1];
    if (prev && prev.m === best.m && best.t - prev.t < 0.15) continue;
    out.push(best);
  }
  return out;
}
const tops = (cs) => cs.map((c) => c.top);
const lows = (cs) => cs.map((c) => c.low);
const outer = (cs) => cs.flatMap((c) => (c.top === c.low ? [c.top] : [c.low, c.top]));
/** One note per attack of a repeated pitch: clusters whose top (or, with low, lowest) pitch is struck >= 3 times running,
    each within `gap` s of the previous. */
function repeats(cs, gap = 0.5, pick = (c) => c.top) {
  const out = []; let run = [];
  const flush = () => { if (run.length >= 3) out.push(...run); run = []; };
  for (const c of cs) {
    const n = pick(c), p = run[run.length - 1];
    if (p && n.m === p.m && n.t - p.t <= gap) run.push(n); else { flush(); run = [n]; }
  }
  flush();
  return out;
}

// audio-derived notes
/** Real attacks from the recording: onsets in [a, b) at least `minDb` loud and `minStr` strong, 90 ms apart; pitch the
    CQT's strongest peak (or `pitch`), length to the next pick (at most maxLen). */
function audioOnsets(a, b, { minDb = -40, minStr = 0, pitch = null, maxLen = 0.3, lo = 0, hi = 127 } = {}) {
  const os = AU.onsets.filter(([t, s, d]) => t >= a && t < b && d >= minDb && s >= minStr);
  const out = [];
  for (const [t, s, d, pk] of os) {
    if (out.length && t - out[out.length - 1].t < 0.09) continue;
    const pp = pk.filter(([m]) => m >= lo && m <= hi);
    const m = pitch ?? (pp[0] ?? pk[0])[0];
    out.push({ t, e: t + maxLen, m, v: velDb(d), tr: 'audio' });
  }
  for (let i = 0; i + 1 < out.length; i++) out[i].e = Math.min(out[i].e, out[i + 1].t - 0.01);
  return out;
}
/** The held tracks with fragments of one pitch less than 0.5 s apart joined (a peak that dips for a moment is one tone). */
const HELD = (() => {
  const by = new Map();
  for (const h of AU.held) (by.get(h[2]) ?? by.set(h[2], []).get(h[2])).push([...h]);
  const out = [];
  for (const l of by.values()) { l.sort((x, y) => x[0] - y[0]); let cur = null; for (const h of l) { if (cur && h[0] - cur[1] < 0.5) { const w0 = cur[1] - cur[0], w1 = h[1] - h[0]; cur[3] = (cur[3] * w0 + h[3] * w1) / (w0 + w1); cur[4] = Math.max(cur[4], h[4]); cur[1] = Math.max(cur[1], h[1]); } else { cur = h; out.push(cur); } } }
  return out.sort((x, y) => x[0] - y[0] || x[2] - y[2]);
})();
/** A chord held through [a, b) from the audio: every pitch whose held tones cover at least `cover` of it, one long note each. */
function chordOf(a, b, { cover = 0.4, minDb = -30, lo = 24, hi = 96, k = 6 } = {}) {
  const cov = new Map();
  for (const [t0, t1, m, mean, peak] of HELD) { if (m < lo || m > hi || mean < minDb) continue; const o = Math.min(t1, b) - Math.max(t0, a); if (o <= 0) continue; const c = cov.get(m) ?? { o: 0, peak: -99 }; c.o += o; c.peak = Math.max(c.peak, peak); cov.set(m, c); }
  return [...cov.entries()].filter(([, c]) => c.o >= cover * (b - a)).sort((x, y) => y[1].o - x[1].o).slice(0, k).map(([m, c]) => ({ t: a, e: b, m, v: velDb(c.peak), tr: 'audio' }));
}
/** Held tones in [a, b): the (joined) CQT tracks that start in it, or start before and still sound at a (clipped to start
    at a), louder than minDb, in [lo, hi]; the `k` loudest per started second at most. */
function heldTones(a, b, { minDb = -30, lo = 24, hi = 96, minLen = 0.6, k = 3, end = b } = {}) {
  const hs = HELD.filter(([t0, t1, m, mean]) => t1 > a && t0 < b && mean >= minDb && m >= lo && m <= hi && t1 - Math.max(t0, a) >= minLen)
    .map(([t0, t1, m, mean, peak]) => ({ t: Math.max(t0, a), e: Math.min(t1, end), m, v: velDb(peak), mean }));
  const bySec = new Map();
  for (const h of hs) { const s = Math.floor(h.t); (bySec.get(s) ?? bySec.set(s, []).get(s)).push(h); }
  return [...bySec.values()].flatMap((l) => l.sort((x, y) => y.mean - x.mean).slice(0, k)).map((h) => ({ ...h, tr: 'audio' }));
}
/** Held tones made into chord blocks that begin only at real events, so the CQT's churn inside one sustained sound adds
    no attack: a tone whose start lies within 0.15 s of an audio onset, or on a rise of >= 3 dB, keeps it (an anchor); any
    other tone starts at the latest anchor before it (or at a, the section's turn). Tones of one pitch that then overlap are
    joined. */
function anchored(notes, a) {
  const real = (t) => AU.onsets.some(([o]) => Math.abs(o - t) <= 0.15) || dbAt(t + 0.1) - Math.min(dbAt(t - 0.3), dbAt(t - 0.2)) >= 3;
  const ns = [...notes].sort((x, y) => x.t - y.t);
  const anchors = [a, ...ns.filter((n) => n.t > a + 0.01 && real(n.t)).map((n) => n.t)].sort((x, y) => x - y);
  const moved = ns.map((n) => ({ ...n, t: anchors.filter((x) => x <= n.t + 1e-6).pop() ?? a }));
  const out = [];
  for (const n of moved.sort((x, y) => x.m - y.m || x.t - y.t)) {
    const p = out[out.length - 1];
    if (p && p.m === n.m && n.t <= p.e) { p.e = Math.max(p.e, n.e); p.v = Math.max(p.v, n.v); } else out.push({ ...n });
  }
  return out;
}
/** The roll where it is dense enough, the audio where it is not: audio onsets only in 1 s bins where `rollNotes` has none. */
function fillHoles(rollNotes, a, b, opts) {
  const has = new Set(rollNotes.map((n) => Math.floor(n.t)));
  return [...rollNotes, ...audioOnsets(a, b, opts).filter((n) => !has.has(Math.floor(n.t)) && !has.has(Math.floor(n.t - 0.5)) && !has.has(Math.floor(n.t + 0.5)))];
}

// ================= the form (song seconds; ANALYSIS.md says why) =================
const S = {
  start: 7.1,          // the ostinato fades in (col legno strings, harp, timpani on G)
  rollIn: 20.6,        // first transcribed note (the ostinato in the cellos)
  swell: 48.6,         // the theme climbs: the crescendo of the first statement
  brass: 57.4,         // brass chords take over above the ostinato
  dip: 62.6,           // sudden drop after the B chord (62.0-62.5)
  peak1: 80.8,         // first climax (0 dB, 80.8-83.5)
  cPedal: 83.5,        // the hammered Db-major chords over the C pedal: the tutti episode
  strike131: 130.9,    // the episode's last blow (131.0-131.5), then -13 dB
  second: 131.6,       // the second subject: the ostinato again, unison calls in the strings
  noBass: 164.9,       // no bass at all: high repeated notes only
  pause: 185.6,        // general pause (down to -39 dB)
  blow186: 186.4,      // ff Eb-major chord
  middle: 189.5,       // the slow middle: a throb dies away
  tuba: 197.2,         // the tenor-tuba theme, low and slow (the low drone gives way at 197.2)
  calls: 212.8,        // trumpet calls in rising pairs, the build
  recap: 256.6,        // the ostinato returns, fully armoured: the whole orchestra on G
  canon: 303.9,        // quieter: the ostinato under the theme again
  build: 343.6,        // the last build
  climax: 358.9,       // the dissonant pile-up, sustained (-3 dB)
  after: 367.0,        // its aftermath: grinding held chords, falling
  hush: 380.0,         // pp: held Db/Ab, the ostinato's G in the bass
  runUp: 392.6,        // the run up to the end
  blows: 396.4,        // pesante: the hammer blows with silences
  last: 415.7,         // the last blow, held
  cut: 421.8,          // the chord is cut; decay to ~423.5
  end: 428.7,
};

// ================= the sets =================
const sets = [];
/** The deliberate silences (dB in brackets): the general pause and the black between the last blows. No note starts in
    one, and a note sounding into one ends where it begins, so nothing glows in the black. */
const SILENT = [[185.6, 186.4], [397.9, 399.1], [403.4, 405.2], [407.8, 409.5], [413.5, 415.6], [421.8, 428.71]];
function add(id, o, notes) {
  notes = [...notes].filter((n) => n.t >= o.from && n.t < o.to && !SILENT.some(([a, b]) => n.t >= a && n.t < b))
    .map((n) => { const s = SILENT.find(([a, b]) => n.t < a && n.e > a); return s ? { ...n, e: s[0] } : n; })
    .sort((x, y) => x.t - y.t || x.m - y.m);
  const seen = new Set();
  notes = notes.filter((n) => { const k = `${r3(n.t)}|${n.m}`; if (seen.has(k)) return false; seen.add(k); return true; });
  sets.push({ id, ...o, notes: notes.map((n) => [r3(n.t), r3(Math.max(n.e, n.t + 0.03)), n.m, clampV(n.v)]) });
}
/** The ostinato's G2 sounds its 3rd, 5th and 6th partials at D4, B4 and D5: in the opening they are not the theme. */
const G2_PARTIALS = new Set([62, 71, 74]);
const low = (n) => n.m <= 55, short = (n) => dur(n) < 0.45;
const fam = { str: (n) => ['violin', 'viola', 'cello', 'strings'].includes(n.tr) };

// ---------- I. The ostinato and the creeping theme (7.1-83.5) ----------
add('ostinato-dawn', { from: S.start, to: S.rollIn, source: 'audio', rule: 'audio onsets 7.1-20.6 s, >= -40 dB, 90 ms apart, as G2', hears: 'The 5/4 ostinato tapping out of silence (col legno strings, harp, timpani on G) before the transcriber hears anything: the hole filler for the opening.' },
  audioOnsets(S.start, S.rollIn, { minDb: -40, pitch: 43, maxLen: 0.2 }));
add('ostinato-opening', { from: S.start, to: S.dip, source: 'mixed', rule: 'roll notes <= G3 shorter than 0.45 s, lowest of each cluster, 20.6-62.6 s; audio onsets (as G2) in the seconds the roll has none, 7.1-62.6 s', hears: 'The ostinato through the whole first statement, pp to f: the steady 5/4 tapping on G (the transcribed G3/G2 strokes, Ab1 at 37 s, Bb2/Ab2 at 51-57 s), with the audio filling 7.1-20.6 s and 38-48 s.' },
  fillHoles(lows(clusters(inWin(roll, S.rollIn, S.dip, (n) => low(n) && short(n)))), S.start, S.dip, { minDb: -40, pitch: 43, maxLen: 0.2 }));
add('theme-creep', { from: 8.5, to: S.swell, source: 'audio', rule: 'held CQT tones 8.5-48.6 s, not pitch class G nor the ostinato G2 partials D4, B4, D5 (62, 71, 74), Eb3-C6, >= -37 dB mean, the 2 loudest per started second, >= 0.6 s', hears: 'The creeping theme above the ostinato (bassoons and horns, then the brass): the long held tones that rub against the G, the Db and Ab first (15.5-19 s), then B, Db, F, Bb, A ... as long notes. The D4/B4/D5 partials of the ostinato G are left out.' },
  heldTones(8.5, S.swell, { minDb: -37, lo: 51, hi: 84, k: 2 }).filter((n) => n.m % 12 !== 7 && !G2_PARTIALS.has(n.m)));
add('theme-swell', { from: S.swell, to: S.dip, source: 'mixed', rule: 'voiced-out line (held >= 0.28 s, loudest of its chord) of roll notes >= E3, 48.6-62.6 s, with pack.notes added where no roll note of that pitch starts within 50 ms', hears: 'The theme climbing to its first forte: the held chord-tops of the brass and strings (C#4-E4-A4, Bb4, the E5/E6 chord at 54 s, Ab4, C5, Bb4, Eb4 to the B chord at 62.0 s).' },
  held([...roll, ...packNotes.filter((p) => !roll.some((n) => n.m === p.m && Math.abs(n.t - p.t) < 0.05))].sort((x, y) => x.t - y.t || x.m - y.m), S.swell, S.dip, (n) => n.m >= 52));
add('brass-swell-65', { from: S.dip, to: 68, source: 'audio', rule: 'held CQT tones 62.6-68 s, >= -24 dB mean, Eb3 and up, not pitch class G, the 2 loudest per started second', hears: 'Out of the dip after the B chord (-24 dB at 64.4 s): a brass swell, F3 with Ab4 rising to -8 dB at 65.7 s, then B4 held. The roll has nothing from 62.6 to 67.7 s.' },
  heldTones(S.dip, 68, { minDb: -24, k: 2, lo: 51 }).filter((n) => n.m % 12 !== 7));
add('brass-chords-1', { from: S.brass, to: S.cPedal, source: 'roll', rule: 'roll clusters 57.4-83.5 s with >= 3 pitches and loudest >= 65; of each, the lowest and highest note', hears: 'The brass chords that stack up over the ostinato into the first climax: Ab/Eb chords (58-60 s), the hammered B chord (61.8-62.3 s), the B and C# chords high up (69.6-75 s), Eb5 (76-77 s), F#5/F#6 (78-80 s), Ab5 at the peak (82 s).' },
  outer(clusters(inWin(roll, S.brass, S.cPedal)).filter((c) => c.pitches >= 3 && c.vmax >= 65)));
add('cello-ostinato-2', { from: S.dip, to: S.cPedal, source: 'roll', rule: 'cello and strings notes <= G3 shorter than 0.45 s, lowest of each cluster, 62.6-83.5 s', hears: 'The ostinato carried on in the cellos under the crescendo (G3/F3 rocking, then Ab2), the machine under the brass.' },
  lows(clusters(inWin(roll, S.dip, S.cPedal, (n) => ['cello', 'strings'].includes(n.tr) && low(n) && short(n)))));
add('climax-1', { from: S.peak1, to: S.cPedal, source: 'audio', rule: 'held CQT tones 80.8-83.5 s, >= -20 dB mean, the 3 loudest per second; anchored (a tone starts only at an onset, a 3 dB rise or 80.8 s)', hears: 'The first climax held fff (0 dB): the grinding sustained tones as long notes, for a field or a slow widget to swell with.' },
  anchored(heldTones(S.peak1, S.cPedal, { minDb: -20, k: 3 }), S.peak1));

// ---------- II. The hammered episode over C (83.5-131.6) ----------
add('chord-hammer', { from: S.cPedal, to: S.second, source: 'roll', rule: 'plucked-lane clusters 83.5-131.6 s with >= 3 pitches; of each, the lowest and highest note', hears: 'Hammered chord blocks (transcribed as plucked): the Db-major chord struck in quavers at 84-88 s, and again at 100-106 s. Machine-like, even.' },
  outer(clusters(inWin(roll, S.cPedal, S.second, (n) => n.tr === 'plucked')).filter((c) => c.pitches >= 3)));
add('high-blasts', { from: S.cPedal, to: S.second, source: 'roll', rule: 'roll clusters 83.5-131.6 s with >= 3 notes, top >= C5, loudest >= 85; the top note', hears: 'The high blasts of the tutti over the C pedal: the C6 chords struck again and again (84-113 s), C#6/Eb6 (101-106 s), the A5 and Eb6 strokes, up to the blow at 131 s.' },
  tops(clusters(inWin(roll, S.cPedal, S.second)).filter((c) => c.ns.length >= 3 && c.top.m >= 72 && c.vmax >= 85)));
add('pedal-bass', { from: S.cPedal, to: S.second, source: 'roll', rule: 'roll notes <= D3 (50), lowest of each cluster, 83.5-131.6 s', hears: 'The bass of the episode: the C pedal in the cellos (C2/C3), sliding to C# and back, repeated C3 strokes (88-90 s).' },
  lows(clusters(inWin(roll, S.cPedal, S.second, (n) => n.m <= 50))));
add('episode-line', { from: S.cPedal, to: S.second, source: 'roll', rule: 'voiced-out line, roll notes E3-B5 (52-83), 83.5-131.6 s', hears: 'The inner line of the episode under the high blasts: the brass and string tune between the C pedal and the C6 chords.' },
  held(roll, S.cPedal, S.second, (n) => n.m >= 52 && n.m <= 83));
add('strike-131', { from: S.strike131, to: S.second, source: 'roll', rule: 'every roll note 130.9-131.6 s', hears: 'The blow that ends the episode (131.1-131.5 s, -1 dB, E5/Eb5/Bb5 chords), right before the drop to -13 dB.' },
  inWin(roll, S.strike131, S.second));

// ---------- III. The second subject (131.6-189.5) ----------
add('ostinato-second', { from: S.second, to: S.noBass, source: 'roll', rule: 'roll notes <= G3 shorter than 0.45 s, lowest of each cluster, 131.6-164.9 s', hears: 'The ostinato underneath the second subject (F#2-B2, the cellos), quieter.' },
  lows(clusters(inWin(roll, S.second, S.noBass, (n) => low(n) && short(n)))));
add('unison-calls', { from: S.second, to: S.noBass, source: 'roll', rule: 'voiced-out line, roll notes >= F4 (65), 131.6-164.9 s', hears: 'The second subject: unison calls high in the strings and winds (Bb5 repeated 133-135 s, Bb4, F4, Eb4, B4 ... then Ab5, B5, C6, G6 up to 160 s).' },
  held(roll, S.second, S.noBass, (n) => n.m >= 65));
add('high-repeats', { from: S.noBass, to: S.pause, source: 'roll', rule: 'the top note of every roll cluster >= C4 (60), 164.9-185.6 s', hears: 'No bass at all: one high pitch struck again and again in even beats (C5, Eb5, E5), then F6 and F#6 alternating, C6, Ab4, E5, C6, stepping up: the build to the general pause.' },
  tops(clusters(inWin(roll, S.noBass, S.pause, (n) => n.m >= 60))));
add('ff-blow-186', { from: S.blow186, to: S.middle, source: 'pack', rule: 'pack notes 186.4-189.5 s held >= 1 s (the Eb chord), and the lowest of each cluster below D2 (the low run)', hears: 'After the general pause (185.6-186.4 s, -39 dB): the ff Eb-major chord (Eb2 to G4, held 2 s), then a low rumble A1-D2 (188.4-189 s).' },
  [...inWin(packNotes, S.blow186, 186.6, (n) => dur(n) >= 1), ...lows(clusters(inWin(packNotes, 188.3, 189, (n) => n.m <= 38)))]);

// ---------- IV. The slow middle (189.5-256.6) ----------
add('dying-throb', { from: S.middle, to: S.tuba, source: 'pack', rule: 'pack notes C3-E3 (48-52) 189.5-197.2 s', hears: 'The throb that dies away after the blow: E3 pulses with C3, slower and softer (v60 to v13), then a held E3 for 4 s: almost silence.' },
  inWin(packNotes, 189, S.tuba, (n) => n.m >= 48 && n.m <= 52));
add('tuba-theme', { from: S.tuba, to: 215, source: 'pack', rule: 'pack notes <= A3 (57), 197.2-215 s, the lowest of each cluster, held >= 0.09 s; a repeat of a pitch within 0.15 s merged', hears: 'The tenor-tuba theme, low and slow (G1-A2, then up by steps to Eb3/F3), only in the piano model\'s notes; the roll has nothing here. Its every note.' },
  lows(clusters(inWin(packNotes, S.tuba, 215, (n) => n.m <= 57 && dur(n) >= 0.09))).filter((n, i, a) => !(i && a[i - 1].m === n.m && n.t - a[i - 1].t < 0.15)));
add('trumpet-calls', { from: S.calls, to: S.recap, source: 'roll', rule: 'voiced-out line, roll notes >= C5 (72), 212.8-256.6 s', hears: 'The calls in rising pairs above the slow march (C#5-C5, D5-Eb5, E5-F5-F#5 ..., then Ab5-A5, B5-D6), climbing into the return.' },
  held(roll, S.calls, S.recap, (n) => n.m >= 72));
add('middle-bass', { from: S.calls, to: S.recap, source: 'roll', rule: 'roll notes <= D3 (50), lowest of each cluster, 212.8-256.6 s', hears: 'The slow bass under the calls (D3, F#3, E3 strokes; B1-C2 later).' },
  lows(clusters(inWin(roll, S.calls, S.recap, (n) => n.m <= 50))));
add('middle-chords', { from: 240, to: S.recap, source: 'roll', rule: 'roll clusters 240-256.6 s with >= 4 pitches; of each, the lowest and highest note', hears: 'The chords thickening at the end of the build (245-253 s), just before the return.' },
  outer(clusters(inWin(roll, 240, S.recap)).filter((c) => c.pitches >= 4)));

// ---------- V. The return, fully armoured (256.6-358.9) ----------
add('ostinato-tutti', { from: S.recap, to: S.canon, source: 'roll', rule: 'roll cluster tops of pitch class G at G4-G5 (67, 79), 256.6-303.9 s', hears: 'The whole orchestra hammering the 5/4 rhythm on G (G5 and G4 strokes): the opening ostinato come back at full force, every stroke.' },
  tops(clusters(inWin(roll, S.recap, S.canon, (n) => n.m === 67 || n.m === 79))));
add('recap-blocks', { from: S.recap, to: S.canon, source: 'roll', rule: 'plucked-lane clusters 256.6-303.9 s with >= 3 pitches; of each, the lowest and highest note', hears: 'The chord blocks hammered in the ostinato\'s rhythm (transcribed as plucked: A-major with G at 268-270 s, Ab-major at 270-272 s, G chords at 272-274 s, the C minor wall at 293 s).' },
  outer(clusters(inWin(roll, S.recap, S.canon, (n) => n.tr === 'plucked')).filter((c) => c.pitches >= 3)));
add('recap-bass', { from: S.recap, to: S.canon, source: 'roll', rule: 'roll notes <= G3 (55), lowest of each cluster, 256.6-303.9 s', hears: 'The bass of the return: G2/G3 strokes with F3, Eb3, Ab2 against them.' },
  lows(clusters(inWin(roll, S.recap, S.canon, (n) => n.m <= 55))));
add('brass-tenor-line', { from: S.recap, to: S.climax, source: 'roll', rule: 'voice-lane notes held >= 0.15 s, 256.6-358.9 s', hears: 'A tenor line in the low brass (the transcriber filed it under voice: there is no choir in Mars) that slides between F3, G3 and E3 against the hammered G (284-296 s), and points later.' },
  inWin(roll, S.recap, S.climax, (n) => n.tr === 'voice' && dur(n) >= 0.15));
add('canon-theme', { from: S.canon, to: S.build, source: 'roll', rule: 'voiced-out line, roll notes Bb3-B5 (58-83), 303.9-343.6 s', hears: 'The theme in the middle register over the continuing ostinato, quieter (-11 dB): Ab4, G4, Bb4, C5, Eb4 ... answering itself.' },
  held(roll, S.canon, S.build, (n) => n.m >= 58 && n.m <= 83));
add('ostinato-canon', { from: S.canon, to: S.build, source: 'roll', rule: 'roll notes <= G3 shorter than 0.45 s, lowest of each cluster, 303.9-343.6 s', hears: 'The ostinato strokes in the bass under the canon (G2/G3, Ab2, Eb3).' },
  lows(clusters(inWin(roll, S.canon, S.build, (n) => low(n) && short(n)))));
add('canon-blocks', { from: S.canon, to: S.build, source: 'roll', rule: 'plucked-lane clusters 303.9-343.6 s with >= 2 pitches; the top note', hears: 'The chord strokes in the canon (transcribed as plucked).' },
  tops(clusters(inWin(roll, S.canon, S.build, (n) => n.tr === 'plucked')).filter((c) => c.pitches >= 2)));
add('final-build', { from: S.build, to: S.climax, source: 'roll', rule: 'roll clusters 343.6-358.9 s with loudest >= 75; the top note', hears: 'The last build: C3 pedal strokes, Bb4 hammered (348 s), then the F3/G3 rocking under high G5/C#6 cries (351-357 s), to the pile-up.' },
  tops(clusters(inWin(roll, S.build, S.climax)).filter((c) => c.vmax >= 75)));

// ---------- VI. The pile-up and the end (358.9-428.7) ----------
add('climax-pileup', { from: S.climax, to: S.after, source: 'audio', rule: 'held CQT tones 358.9-367 s, >= -24 dB mean, the 3 loudest per second; anchored (a tone starts only at an onset, a 3 dB rise or 358.9 s)', hears: 'The most dissonant pile-up of the piece, held (-3 dB) over the organ: C3/C#3 with Ab3, Eb3, G2 grinding. Nothing is transcribed here; these are long notes from the audio, no re-attacks.' },
  anchored(heldTones(S.climax, S.after, { minDb: -24, k: 3 }), S.climax));
add('aftermath-held', { from: S.after, to: S.runUp, source: 'audio', rule: 'held CQT tones 367-392.6 s, >= -32 dB mean, the 2 loudest per second; anchored (a tone starts only at an onset, a 3 dB rise or 367 s)', hears: 'The aftermath: grinding held chords that fall from -9 to -27 dB (F2, the C2/C3 pedal, G4, Ab4, Db), then the pp hush with Db and Eb high. Almost nothing transcribed: long notes from the audio.' },
  anchored(heldTones(S.after, S.runUp, { minDb: -32, k: 2 }), S.after));
add('hush-rise', { from: 386.5, to: 395, source: 'roll', rule: 'every roll cluster 386.5-395 s; the top note', hears: 'Out of the hush: B4/F#4 figures, then A4-C5-Eb5 and G2 throbs, the rising scale Ab4-Bb4-C5-D5-Eb5-G5 at 393.2-394.3 s (to -2 dB).' },
  tops(clusters(inWin(roll, 386.5, 395))));
add('pesante-g', { from: S.blows, to: 403.4, source: 'roll', rule: 'roll notes G3/G5 (55, 79) 396.4-403.4 s', hears: 'Between the first blows, G hammered in the top and the middle (G5 at ~0.2 s, G3): the ostinato\'s note, pesante.' },
  inWin(roll, S.blows, 403.4, (n) => n.m === 55 || n.m === 79));
add('final-blows', { from: S.blows, to: S.cut, source: 'audio', rule: 'audio onsets 396.4-415.8 s with strength >= 8 (the 7 hammer blows); each a C3+G2+G4 chord (the CQT peaks), held until the sound falls 15 dB (the last to the cut at 421.8 s)', hears: 'The hammer blows of the end: 396.5, 399.15, 401.33, then each out of silence 405.3, 409.6, 412.7 and the last 415.75, held to the cut. The real ff blows.' },
  audioOnsets(S.blows, S.last + 0.2, { minStr: 8, maxLen: 9 }).flatMap((o) => {
    const e = o.t > S.last - 0.1 ? S.cut : Math.min(o.t + 3, decayEnd(o.t, 15, 3));
    return [43, 48, 67].map((m) => ({ t: o.t, e, m, v: o.v, tr: 'audio' }));
  }));
add('blow-echoes', { from: S.blows, to: S.last, source: 'audio', rule: 'audio onsets 396.4-415.7 s with strength 4.4-8 and >= -10 dB, as C3', hears: 'The second, weaker strokes after the blows (400.15, 406.6, 411.0 s): each blow answered once.' },
  audioOnsets(S.blows, S.last, { minStr: 4.4, minDb: -10 }).filter((o) => !AU.onsets.some(([t, s]) => Math.abs(t - o.t) < 0.05 && s >= 8)).map((o) => ({ ...o, m: 48 })));
add('last-chord', { from: S.last, to: S.cut, source: 'audio', rule: 'the pitches whose held CQT tones (>= -25 dB mean) cover >= 30 % of 415.75-421.8 s, one note each from the blow to the cut', hears: 'The last chord, held ff to its cut at 421.8 s: one attack, six seconds of sound.' },
  chordOf(S.last + 0.05, S.cut, { cover: 0.3, minDb: -25 }));

// ---------- across the piece ----------
add('ff-blows', { from: 186, to: S.cut, source: 'mixed', rule: 'the Eb chord at 186.43 s (pack, its lowest and highest note) and the 7 final hammer blows (audio, C3 and G4)', hears: 'Every real ff blow out of silence or onto a cut: the Eb chord after the general pause and the seven hammer blows of the end. For fireworks.' },
  [...outer(clusters(inWin(packNotes, S.blow186, 186.6, (n) => dur(n) >= 1))).map((n) => ({ ...n, e: Math.min(n.e, 188.4) })),
    ...audioOnsets(S.blows, S.last + 0.2, { minStr: 8 }).flatMap((o) => [48, 67].map((m) => ({ ...o, m, e: o.t + 0.6 })))]);
add('bassline', { from: S.start, to: S.end, source: 'roll', rule: 'roll notes <= G2 (43), lowest of each cluster, the whole piece', hears: 'The lowest notes the lanes hear, the whole piece: the low ostinato, the C pedal, the bass of the return (sparse in the opening and the end).' },
  lows(clusters(inWin(roll, S.start, S.end, (n) => n.m <= 43))));
add('violin-line', { from: S.start, to: S.end, source: 'roll', rule: 'voiced-out line of the violin lane, the whole piece', hears: 'The violins\' held line (the lane\'s loudest held note per attack), the whole piece.' },
  held(roll, S.start, S.end, (n) => n.tr === 'violin'));
add('viola-line', { from: S.start, to: S.end, source: 'roll', rule: 'voiced-out line of the viola lane, the whole piece', hears: 'The violas\' held line, the whole piece (often the theme\'s middle voice).' },
  held(roll, S.start, S.end, (n) => n.tr === 'viola'));
add('cello-line', { from: S.start, to: S.end, source: 'roll', rule: 'cello lane, lowest of each cluster, the whole piece', hears: 'The cellos, the whole piece: the ostinato strokes and the bass of the tutti.' },
  lows(clusters(inWin(roll, S.start, S.end, (n) => n.tr === 'cello'))));
add('plucked-blocks', { from: S.start, to: S.end, source: 'roll', rule: 'plucked lane, the top note of each cluster, the whole piece', hears: 'Everything the transcriber filed as plucked (harp and hard-struck chord blocks): the hammered chords of 84-88, 100-106, 268-296 and 304-336 s.' },
  tops(clusters(inWin(roll, S.start, S.end, (n) => n.tr === 'plucked'))));
add('strings-section', { from: S.start, to: S.end, source: 'roll', rule: 'strings lane (string sound the transcriber could not split), the top note of each cluster', hears: 'The undivided string section: the ostinato strokes at the opening, the repeated blocks of the episodes.' },
  tops(clusters(inWin(roll, S.start, S.end, (n) => n.tr === 'strings'))));
add('hammered-repeats', { from: S.start, to: S.end, source: 'roll', rule: 'repeated pitches (>= 3 strokes <= 0.45 s apart) among roll cluster tops, the whole piece', hears: 'Every place one pitch is hammered again and again (the C6 blasts, the B4 strokes, the high repeats before the pause, the G5 of the return, the final G): the machine.' },
  repeats(clusters(inWin(roll, S.start, S.end)), 0.45));

// ---------- holes (from the audio) ----------
add('hole-38-48', { from: 38.9, to: S.swell, source: 'audio', rule: 'audio onsets 38.9-48.6 s, >= -36 dB, as G2', hears: 'The ostinato where the roll is empty in the opening (38.9-48.6 s), to keep an ostinato widget alive.' },
  audioOnsets(38.9, S.swell, { minDb: -36, pitch: 43, maxLen: 0.2 }));
add('hole-middle', { from: S.middle, to: S.calls, source: 'audio', rule: 'held CQT tones 189.5-212.8 s, >= -34 dB mean, the 2 loudest per second; anchored (a tone starts only at an onset, a 3 dB rise or 189.5 s)', hears: 'The slow middle\'s held sound (the low pedal and the tuba\'s notes) as long notes, for a field-like widget: the roll has nothing from 190 to 212 s.' },
  anchored(heldTones(S.middle, S.calls, { minDb: -34, k: 2 }), S.middle));

// ================= checks and output =================
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  if (!s.notes.length) throw new Error(`${s.id} has no notes`);
  for (let i = 1; i < s.notes.length; i++) if (s.notes[i][0] < s.notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  for (const n of s.notes) if (!(n[1] >= n[0]) || n[2] < 0 || n[2] > 127 || n[3] < 1 || n[3] > 127 || n[1] > pack.duration) throw new Error(`${s.id} bad note ${n}`);
}
if (new Set(sets.map((s) => s.id)).size !== sets.length) throw new Error('duplicate set id');
const out = {};
for (const s of sets) out[s.id] = { hears: s.hears, source: s.source, rule: s.rule, from: s.from, to: s.to, notes: s.notes };
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]');
writeFileSync(join(HERE, 'picks.json'), text + '\n');

const attacks = (ns) => clusters(ns.map(([t, e, m, v]) => ({ t, e, m, v }))).length;
const summary = sets.map((s) => {
  const per30 = Array.from({ length: Math.ceil(pack.duration / 30) }, (_, i) => attacks(s.notes.filter((n) => n[0] >= i * 30 && n[0] < i * 30 + 30)));
  return { id: s.id, source: s.source, notes: s.notes.length, attacks: attacks(s.notes), span: `${s.notes[0][0]}-${s.notes[s.notes.length - 1][1]}`, hears: s.hears, per30 };
});
for (const s of sets) console.log(`${s.id.padEnd(18)} ${s.source.padEnd(5)} ${String(attacks(s.notes)).padStart(4)} att ${String(s.notes.length).padStart(4)} notes ${s.notes[0][0]}-${s.notes[s.notes.length - 1][1]} | ${s.notes.slice(0, 12).map((n) => nm(n[2])).join(' ')}`);
console.log(sets.length, 'sets');
if (process.argv.includes('--json')) console.log(JSON.stringify(summary));
