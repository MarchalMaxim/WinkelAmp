// Pick sets for Tchaikovsky's Romeo and Juliet, cut into six song packs (songs/romeo-juliet-1-friar ... -6-coda).
// Deterministic. Run from anywhere:
//   C:/Users/maxim/.venvs/wa/Scripts/python.exe -I audio-events.py   (once; writes <pack>/audio-events.json)
//   node gen-picks.mjs [tables.md]                                     (writes <pack>/picks.json; with a path, also the tables of ANALYSIS.md)
// Output per pack: { "<set id>": { "hears": "...", "notes": [[start, end, midi, velocity], ...] } }, notes sorted by start.
//
// Note sources (the same as the note picker's roll on an ensemble pack, src/studio/ui/picker-logic.ts pickerNotes):
//   roll  = pack.tracks (YourMT3+ rows by instrument; velocity borrowed from the piano model or from loudness)
//   pack  = pack.notes (the piano transcriber, with YourMT3+ in its gaps): adds notes the roll lacks (harp, bass, tutti)
//   audio = <pack>/audio-events.json (librosa): onsets, cymbal-bright peaks, low-band strokes, pitch class per 0.1 s.
//           Where a set is "from the audio", each event becomes a note: the roll/pack notes starting within 60 ms of it
//           when there are any (so the picker finds them), else one note on the event's pitch class in the register the
//           set names, with velocity from the level, v = clamp(20 + 2.4 * (dB + 60), 15, 122).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r3 = (x) => Math.round(x * 1e3) / 1e3 || 0;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const vOfDb = (db) => Math.round(clamp(20 + 2.4 * (db + 60), 15, 122));
const FAM = {
  strings: ['violin', 'viola', 'cello', 'contrabass', 'strings'], winds: ['oboe', 'clarinet', 'bassoon', 'flute', 'horn', 'trumpet', 'trombone', 'tuba'],
  harp: ['piano', 'plucked'], low: ['cello', 'contrabass', 'strings', 'bassoon'],
};

function load(id) {
  const pack = JSON.parse(readFileSync(join(ROOT, 'songs', id, 'pack.json'), 'utf8'));
  const ae = JSON.parse(readFileSync(join(HERE, id, 'audio-events.json'), 'utf8'));
  const roll = Object.entries(pack.tracks).flatMap(([k, t]) => t.notes.map(([s, e, m, v]) => ({ t: s, e, m, v, k }))).sort((a, b) => a.t - b.t || b.m - a.m);
  const onRoll = new Set(roll.map((n) => `${n.m}@${Math.round(n.t * 20)}`));
  const pk = pack.notes.map(([s, e, m, v]) => ({ t: s, e, m, v, k: 'pack' })).filter((n) => !onRoll.has(`${n.m}@${Math.round(n.t * 20)}`));
  const all = [...roll, ...pk].sort((a, b) => a.t - b.t || b.m - a.m);
  return { id, pack, ae, roll, pk, all, dur: pack.duration };
}

/** 40 ms clusters (groupChords' rule). */
function clusters(ns) {
  const out = []; let c = null;
  for (const n of ns) {
    if (c && n.t - c.t < 0.04) { c.ns.push(n); if (n.m > c.top.m) c.top = n; if (n.m < c.low.m) c.low = n; if (n.v > c.loud.v) c.loud = n; }
    else { c = { t: n.t, ns: [n], top: n, low: n, loud: n }; out.push(c); }
  }
  return out;
}
const inWin = (src, a, b, f = () => true) => src.filter((n) => n.t >= a && n.t < b && f(n));
const isK = (...ks) => (n) => ks.flat().includes(n.k);

function tools(P) {
  const dbAt = (t) => P.ae.curve[clamp(Math.round(t * 10), 0, P.ae.curve.length - 1)][0];
  const pcAt = (t) => P.ae.curve[clamp(Math.round(t * 10), 0, P.ae.curve.length - 1)][3];
  /** Voiced-out line: per cluster of notes held >= minDur, the top note (the loudest when the top is much softer); a note
      more than a tone above it still sounding from the last 0.8 s hides it (a held melody over its accompaniment);
      a repeat of one pitch within 0.15 s is one note. */
  function sky(a, b, f = () => true, minDur = 0.28, src = P.roll) {
    const ns = inWin(src, a - 0.8, b, (n) => f(n) && n.e - n.t >= minDur);
    const out = [];
    for (const c of clusters(ns)) {
      if (c.t < a) continue;
      if (ns.some((n) => n.t < c.t - 0.02 && n.t >= c.t - 0.8 && n.e > c.t + 0.05 && n.m > c.top.m + 2)) continue;
      const pick = c.loud.v > c.top.v + 15 ? c.loud : c.top;
      const pr = out[out.length - 1];
      if (pr && pr.m === pick.m && c.t - pr.t < 0.15) continue;
      out.push(pick);
    }
    return out;
  }
  /** The lowest note of each cluster below `below`, held >= minDur, one per 0.25 s. */
  function bass(a, b, below = 50, minDur = 0.2, src = P.all, f = () => true) {
    const out = [];
    for (const c of clusters(inWin(src, a, b, (n) => n.m < below && n.e - n.t >= minDur && f(n)))) {
      const pr = out[out.length - 1];
      if (pr && c.t - pr.t < 0.25) continue;
      out.push(c.low);
    }
    return out;
  }
  /** Clusters of >= min notes, thinned to their outer voices (one attack each). */
  const chords = (a, b, min = 4, src = P.all, f = () => true) => clusters(inWin(src, a, b, f)).filter((c) => c.ns.length >= min).flatMap((c) => [...new Set([c.low, c.top])]);
  /** Fast stepwise lines: >= minLen notes of one instrument, each <= gap s after the last, steps <= 3 semitones, not all one pitch. */
  function runs(a, b, f = () => true, minLen = 5, gap = 0.2) {
    const out = [];
    for (const k of new Set(P.roll.map((n) => n.k))) {
      const ns = inWin(P.roll, a, b, (n) => n.k === k && f(n));
      const tops = clusters(ns).map((c) => c.top);
      let run = [];
      const flush = () => { if (run.length >= minLen && new Set(run.map((n) => n.m)).size >= 3) out.push(...run); run = []; };
      for (const n of tops) {
        const l = run[run.length - 1];
        if (l && n.t - l.t <= gap && n.t - l.t > 0.03 && Math.abs(n.m - l.m) <= 3 && n.m !== l.m) run.push(n); else { flush(); run = [n]; }
      }
      flush();
    }
    return out;
  }
  /** One pitch struck >= minLen times, each <= gap s after the last (tremolo, repeated notes). */
  function repeats(a, b, f = () => true, minLen = 4, gap = 0.2) {
    const out = [], by = new Map();
    for (const n of inWin(P.all, a, b, f)) { const l = by.get(n.m); if (l) l.push(n); else by.set(n.m, [n]); }
    for (const ns of by.values()) {
      let run = [];
      const flush = () => { if (run.length >= minLen) out.push(...run); run = []; };
      for (const n of ns) { const l = run[run.length - 1]; if (l && n.t - l.t <= gap && n.t - l.t > 0.04) run.push(n); else { flush(); run = [n]; } }
      flush();
    }
    return out;
  }
  /** Audio events -> notes: the notes starting within 60 ms (outer voices), else a note on the event's pitch class. */
  function snap(events, { lo = 60, notes = 'outer', minDur = 0.25, maxDur = 1.5, src = P.all } = {}) {
    const out = [];
    events.forEach((ev, i) => {
      const t = ev.t, next = events[i + 1]?.t ?? t + maxDur;
      const near = src.filter((n) => Math.abs(n.t - t) <= 0.06);
      if (near.length) {
        const c = clusters(near.sort((a, b) => a.t - b.t))[0];
        const keep = notes === 'top' ? [c.top] : notes === 'low' ? [c.low] : [...new Set([c.low, c.top])];
        out.push(...keep.map((n) => ({ ...n, v: Math.max(n.v, ev.v ?? 0) })));
      } else {
        const pc = ev.pc ?? pcAt(t + 0.05);
        const m = lo + ((pc - lo) % 12 + 12) % 12;
        out.push({ t, e: t + clamp(next - t - 0.02, minDur, maxDur), m, v: ev.v ?? vOfDb(dbAt(t + 0.1)), k: 'audio' });
      }
    });
    return out;
  }
  const onsets = (a, b, minStr = 0, minDb = -99) => P.ae.onsets.filter(([t, s, db]) => t >= a && t < b && s >= minStr && db >= minDb).map(([t, s, db, pc, lj, hj]) => ({ t, s, db, pc, lj, hj, v: vOfDb(db) }));
  const hiPeaks = (a, b, minJump, minDb) => P.ae.hi_peaks.filter(([t, x, db, j]) => t >= a && t < b && j >= minJump && db >= minDb).map(([t, x, db, j, pc]) => ({ t, db, j, pc, v: clamp(Math.round(70 + 2 * j), 60, 122) }));
  const loPeaks = (a, b, minJump, minDb) => P.ae.lo_peaks.filter(([t, x, db, j]) => t >= a && t < b && j >= minJump && db >= minDb).map(([t, x, db, j, pc]) => ({ t, db, j, pc, v: clamp(Math.round(55 + 2.5 * j), 50, 122) }));
  /** Real harmonic changes in a stretch with no attacks: where the strongest pitch class changes and then holds >= hold s
      (a chord change one hears even without a new attack). Each becomes one held note. */
  function changes(a, b, lo, hold = 1.0) {
    const C = P.ae.curve, out = [];
    let cur = -1, since = a;
    for (let k = Math.round(a * 10); k < Math.round(b * 10) && k < C.length; k++) {
      const pc = C[k][3];
      if (pc === cur) continue;
      let ok = true;
      for (let j = k; j < k + hold * 10 && j < C.length; j++) if (C[j][3] !== pc) { ok = false; break; }
      if (!ok) continue;
      cur = pc; since = k / 10;
      out.push({ t: since, pc, v: vOfDb(C[k][0] + 3) });
    }
    return out.map((ev, i) => ({ t: ev.t, e: Math.min(b, out[i + 1]?.t ?? b) - 0.05, m: lo + ((ev.pc - lo) % 12 + 12) % 12, v: ev.v, k: 'audio' }));
  }
  /** Holes: 1 s bins where the audio is audible (> floorDb) but no roll or pack note starts within the bin and the next,
      merged when >= 3 s. */
  function holes(floorDb = -56) {
    const out = []; let st = null;
    const starts = P.all.map((n) => n.t);
    for (let s = 0; s < Math.floor(P.dur); s++) {
      const db = Math.max(...P.ae.curve.slice(s * 10, s * 10 + 10).map((c) => c[0]));
      const notes = starts.filter((t) => t >= s - 0.5 && t < s + 1.5).length;
      const hole = db > floorDb && notes === 0;
      if (hole && st === null) st = s;
      if (!hole && st !== null) { if (s - st >= 3) out.push([st, s]); st = null; }
    }
    if (st !== null && Math.floor(P.dur) - st >= 3) out.push([st, Math.floor(P.dur)]);
    return out;
  }
  return { sky, bass, chords, runs, repeats, snap, onsets, hiPeaks, loPeaks, changes, holes, dbAt, pcAt };
}

// ============================ the six packs ============================
// Sections: [start, end, name, character]. Times are pack seconds (the pack starts at RESEARCH.json's original_from).
const SONGS = {
  'romeo-juliet-1-friar': {
    sections: [
      [0, 36.7, 'Friar Laurence chorale', 'clarinets and bassoons in four-part F# minor chorale, pp, archaic and still; phrases enter at 2.1, 5.7, 17.2, 24.7 s'],
      [36.7, 48.0, 'Low strings rise', 'cellos and basses in octaves (C#, then B), swelling from -63 to -41 dB; almost no transcribed notes'],
      [48.0, 62.0, 'High violins', 'violins alone on long high notes (F#5 G5 F#5 E5 F5 F#5) over a D2 in the cellos, ppp'],
      [62.0, 68.6, 'Bass sforzando', 'a low-string accent at 61.9-62.2 s (+18 dB in 0.4 s) and its long decay'],
      [68.6, 92.7, 'Sighing descent and swell', 'violins and violas fall in chromatic steps (F-Eb-Db-B), cellos answer rising, a crescendo into F minor'],
      [92.7, 99.3, 'First swell: the F minor chord', 'tutti F minor chord at 92.68 s with the winds, then a violin arpeggio flourish 96.4-98.3 s'],
      [99.3, 127.0, 'Harp and woodwinds', 'a hushed Db chord (99.31), the harp arpeggiates F minor (105.7-108.6, 119.9-126.5), clarinet and bassoon answer (112.9)'],
      [127.0, 165.0, 'Chorale over pizzicato', 'pizzicato strings walk down in octaves (127.3-139), then the chorale returns in oboe, clarinets and bassoons (139.7-161) over the walking bass, swelling to 0.72 at 148 s'],
      [165.0, 198.4, 'High violins return', 'the long high violin notes again (F5 F#5 A4 F5 Eb5 E5 F5, 177.7-190), low strokes at 190.3-193'],
      [198.4, 225.1, 'Chorale in the winds, rising', 'the woodwinds take the chorale in C major (199-212), the strings climb (212-221), a harp flourish to G7 at 223.3-224.2'],
      [225.1, 257.2, 'Antiphonal hush', 'chords traded between winds and strings (C major against E minor), few notes: a hole in the transcription'],
      [257.2, 275.0, 'Tremolo build', 'string tremolo in E minor, a crescendo in waves (-45 to -33 dB)'],
      [275.0, 293.2, 'Climax', 'the introduction\'s climax, ff: cellos in tremolo on E2 then C#, violins hold B5, the strings hammer B3 then C#4 to the cut-off at 293.0 s'],
      [293.2, 306.3, 'Aftermath: the low roll', 'a low roll (F#) under falling held notes G3, Bb3/F#2, E3, D2'],
      [306.3, 325.6, 'Hush before the feud', 'pp, -55 dB: B4 over D2, then E3, D3, F#4; the dominant of B minor waiting'],
    ],
    build(add, T, P) {
      const W = isK(FAM.winds), S = isK(FAM.strings);
      add('friar-chorale', 'The Friar Laurence chorale, its top voice: clarinets and bassoons 2.1-34 s (F# minor), the oboe/clarinet/bassoon return over pizzicato 139.7-161 s (F minor), the woodwinds again 199-212 s (C major). Slow, even chords, one every 0.8-1.7 s.',
        [...T.sky(2, 36.7, W), ...T.sky(139.5, 162, W), ...T.sky(198.9, 212.6, W)]);
      add('friar-chorale-chords', 'The same three chorale statements as whole chords, thinned to their outer voices: the bassoon bottom and the clarinet/oboe top of each chord, one attack per chord.',
        [...T.chords(2, 36.7, 2, P.roll, W), ...T.chords(139.5, 162, 3, P.roll, W), ...T.chords(198.9, 212.6, 3, P.roll, W)]);
      add('low-swell', 'From the audio: the cellos and basses rising out of the chorale, 37.1-48 s, C#2 then B1 (plus the two transcribed octaves); each low-band onset and chord change is one long note.',
        [...T.bass(36.7, 48, 52, 0.3), ...T.changes(38.4, 48, 37, 1.5)]);
      add('high-violins', 'The violins\' long high notes, ppp, the eeriest line of the introduction: 48.1-61.4 s (F#5 G5 F#5 E5 F5 F#5), its return 177.7-190 s, and the held B5 of the climax 276-291 s.',
        [...T.sky(48, 62, isK('violin'), 0.6), ...T.sky(165, 198.4, isK('violin'), 0.9, P.roll).filter((n) => n.m >= 69), ...T.sky(275, 293.2, isK('violin'), 0.9).filter((n) => n.m >= 81)]);
      add('sighing-descent', 'The strings\' chromatic falling figure and the cellos\' answer, 69.9-92 s: F4-Eb4-Db4, F4-Eb4-Db4-B3, then cellos Bb3-B3-C#4 rising into the swell.',
        T.sky(68.6, 92.6, S, 0.28));
      add('f-minor-swell', 'The first swell: the tutti F minor chord at 92.68 s (whole chord) and the violins\' F minor arpeggio flourish 96.4-98.3 s (every note).',
        [...inWin(P.all, 92.6, 92.8), ...inWin(P.all, 96.3, 98.4, (n) => n.m >= 72)]);
      add('harp', 'The harp: F minor arpeggios 105.7-108.6 and 119.9-126.5 s, the flourish to G7 at 223.3-224.2 s (the roll calls the harp "piano"; the pack adds the notes it missed).',
        [...inWin(P.all, 104, 112.5, (n) => n.k === 'piano' || n.k === 'pack'), ...inWin(P.all, 119.5, 127, (n) => n.k === 'piano' || n.k === 'pack'), ...inWin(P.all, 223.2, 224.4, (n) => n.k === 'piano' || n.m >= 88)]);
      add('pizzicato-walk', 'The pizzicato strings walking down in octaves (127.3-139 s: Ab-G-F-F-Eb-Db-C-Bb-Ab-G-F), then the walking bass under the chorale (137.5-165 s, a step every 0.35 s); the lowest note of each step.',
        T.bass(127, 165, 62, 0.15, P.roll, (n) => S(n) && n.e - n.t <= 2));
      add('tremolo', 'String tremolo and hammered repeats in the climax: cellos on E2 then C#2/C#3 (276.5-288.7 s), violins on B5 (280.6-281.9), the strings on B3 then C#4 (290.8-292.9 s).',
        T.repeats(257, 293.2, S, 4, 0.2));
      add('ff-blows', 'The real ff blows of the introduction: the climax\'s strongest onsets 276-293.0 s (audio strength >= 1.0 at -27 dB or louder), each the notes struck with it (outer voices); the cut-off at 293.0 s is the last.',
        T.snap(T.onsets(275, 293.3, 1.0, -27), { lo: 59 }));
      add('low-strokes', 'Low-band strokes from the audio (< 150 Hz jump >= 10 dB): the low accents under the returning chorale (138.6-143.9, 155.6-163.3 s) and the climax\'s bass blows (283.8, 285.5, the cut-off 292.8 s); each the lowest note struck with it, else the bass pitch class in octave 2.',
        T.snap(T.loPeaks(0, 300, 10, 8), { lo: 36, notes: 'low' }));
      add('hush-chords', 'Hole cover, from the audio, where the transcription is thin: the high violins\' return (170-198.4 s, the low strokes 190.3-193), the antiphonal hush 225.1-257.2 s (C major / E minor chords traded, 9 transcribed attacks) and the aftermath 293.4-325 s; each audio onset or lasting chord change one held note (octave 4; octave 3 in the aftermath), at its level.',
        [...T.changes(170, 198.4, 60, 1.5), ...T.snap(T.onsets(189.5, 194, 0.05, -45), { lo: 48 }), ...T.snap(T.onsets(225.1, 257.2, 0.05, -50), { lo: 60, src: P.all }), ...T.changes(225.1, 257.2, 60, 1.2), ...T.snap(T.onsets(293.4, 325, 0.05, -52), { lo: 48 }), ...T.changes(293.4, 325, 48, 1.5)]);
    },
  },

  'romeo-juliet-2-feud': {
    sections: [
      [0, 11.3, 'Feud: the opening crescendo', 'Allegro giusto in B minor: the syncopated feud figure in the strings, from mf (-48 dB) to ff in 11 s; a held B4 opens'],
      [11.3, 16.5, 'First tutti, first clashes', 'ff tutti, cymbal-bright strokes every 0.6-1 s (11.5-16.1 s)'],
      [16.5, 28.3, 'Feud theme in full', 'scurrying string runs (5.7 attacks/s) under the theme, sword clashes again 24.9-27.3 s'],
      [28.3, 47.7, 'Fugal chase', 'the strings chase each other in runs, quieter (loudness 0.71), E then D/G minor'],
      [47.7, 61.0, 'Build', 'chords pile up, F to Ab, rising to ff'],
      [61.0, 70.0, 'Sword clashes I', 'ff, cymbal strokes every 0.6-1.3 s (61.0-69.5) over F# harmony'],
      [70.0, 73.7, 'Breath', 'a short drop (-31 dB) before the next wave'],
      [73.7, 81.3, 'Sword clashes II', 'the loudest crashes of the pack (73.75-80.7 s, high band to +4 dB)'],
      [81.3, 92.0, 'Sword clashes III', 'clashes 82.3-91.4 s, E/F/B, the feud at its most violent'],
      [92.0, 98.1, 'Last blows', 'the last tutti strokes (94.6, 96.0 s), then the fall'],
      [98.1, 118.0, 'Hushed transition', 'clarinet and bassoon trade a falling figure over a held A in the low strings, pp (-45 to -50 dB): the night before the love theme'],
    ],
    build(add, T, P) {
      const S = isK(FAM.strings), W = isK(FAM.winds);
      add('feud-accents', 'The feud\'s accented attacks: every audio onset of strength >= 0.6 in 0-98 s (the syncopated sforzandi the ear follows, not every run note), each the notes struck with it (outer voices).',
        T.snap(T.onsets(0, 98.1, 0.6, -38), { lo: 59 }));
      add('clash-strokes', 'The sword clashes: cymbal-bright tutti strokes from the audio (5-11 kHz jump >= 9 dB to -20 dB or louder), 11.0-16.4, 24.9-27.3, 52.2-58.6, 61.0-69.5, 73.8-80.7, 82.3-91.4, 94.6-95.4 s; each the top note struck with it, else the pitch class in octave 6.',
        T.snap(T.hiPeaks(0, 98.1, 9, -20), { lo: 84, notes: 'top' }));
      add('feud-runs', 'The scurrying string runs (5+ notes of one instrument, <= 0.2 s apart, stepwise): the feud\'s machinery, 4-96 s.',
        T.runs(0, 98.1, S));
      add('feud-violins', 'The violins\' top line, notes held >= 0.28 s: the feud theme\'s long notes and syncopations (B4, B5, C5, G5 ... D6), 0-97 s.',
        T.sky(0, 98.1, isK('violin'), 0.28));
      add('ff-blows', 'The real ff blows: audio onsets of strength >= 1.2 at -26 dB or louder (67.4-91.3 s, densest 73.8-80.2), the heaviest tutti strokes of the feud; each the notes struck with it.',
        T.snap(T.onsets(0, 98.1, 1.2, -26), { lo: 59 }));
      add('low-strokes', 'Low-band strokes from the audio (bass drum, timpani, bass sforzandi; < 150 Hz jump >= 10 dB): 0-97 s; each the lowest note struck with it.',
        T.snap(T.loPeaks(0, 98.1, 10, 10), { lo: 35, notes: 'low' }));
      add('transition-winds', 'The hushed transition: clarinet and bassoon trading a slow falling figure, 98.6-117 s (G5 F5 Ab5 F5 D5 Bb4 ... C#4), pp.',
        T.sky(98.1, 118, W, 0.28));
      add('a-pedal', 'The held A of the low strings under the transition, 98.1-118 s (the pack hears it as A1/A2 strokes); the lowest note of each attack.',
        T.bass(98.1, 118, 50, 0.1));
    },
  },

  'romeo-juliet-3-love': {
    sections: [
      [0, 20.9, 'Night pedal', 'the transition ends on a held A (A1/A2, a Bb neighbour), pp at -50 dB; no melody'],
      [20.9, 39.2, 'Love theme (English horn and violas)', 'the love theme enters at 21.59 s (Ab4), D-flat major, p, viola and English horn in unison (the roll labels it violin/viola)'],
      [39.2, 72.0, 'The sighs (muted strings)', 'the harp\'s entrance (39.2-40.7), then the muted strings\' rocking chords (~0.6 s apart, Db major), breathing in 2.5 s swells, pp (-55 to -48 dB)'],
      [72.0, 87.3, 'Love theme returns (flutes, oboes, horn)', 'the love theme in the high woodwinds over the sighing chords, horn countermelody, crescendo (-47 to -38 dB)'],
      [87.3, 110.0, 'Love theme climbs', 'the theme modulates (G, E, A), the strings join, loudness 0.63-0.70'],
      [110.0, 150.0, 'Full-string climax', 'the whole orchestra on the theme, an Ab dominant pedal, loud (0.75-0.78), the most attacks of the pack (12-17 per 2.5 s)'],
      [150.0, 172.3, 'Codetta: sighs on the Db pedal', 'the climax settles onto a held C#/Db pedal, the sighing figures return, quieter'],
      [172.3, 185.5, 'Two swells', 'two low surges (172.3, 182.4 s, low band +11 dB) on an A/E chord'],
      [185.5, 217.6, 'Balcony night', 'the Db pedal fading (-47 to -61 dB), slow string figures over it'],
      [217.6, 221.0, 'Silence', 'the last held F, -62 dB'],
    ],
    build(add, T, P) {
      const S = isK(FAM.strings);
      add('love-theme', 'The love theme, each note one hears as the theme: the English horn/viola statement 21.6-38 s (Ab4, C4-Db4-Eb4-Bb3-Ab3-Db4 ...), and the high woodwind/string statement and climax 72-150 s (top line, notes held >= 0.4 s).',
        [...T.sky(20.9, 39.2, (n) => n.m >= 55, 0.28), ...T.sky(72, 150, (n) => n.m >= 55, 0.4)]);
      add('love-theme-first', 'Only the love theme\'s first statement (English horn and violas), 21.6-38 s: the quiet, intimate version.',
        T.sky(20.9, 39.2, (n) => n.m >= 55, 0.28));
      add('sighs', 'The sighs: the muted strings\' rocking chords, 41.0-72 s and 150-172 s (each chord\'s top and bottom, one attack per chord, ~0.6 s apart).',
        [...T.chords(41, 72, 3, P.roll, S), ...T.chords(150, 172.3, 3, P.all)]);
      add('harp', 'The harp: its arpeggio entrance into the sighs (39.2-40.7 s) and its arpeggio in the balcony night (186.8-188.0 s), the roll\'s plucked track.',
        inWin(P.roll, 0, P.dur, isK('plucked')));
      add('horn', 'The horns: the countermelody under the love theme (87-140 s) and their held notes (the roll\'s horn track).',
        inWin(P.roll, 0, P.dur, isK('horn')));
      add('climax-chords', 'The full-string climax as chord blocks (4+ notes, outer voices), 110-150 s: the theme\'s big harmonies under the Ab pedal.',
        T.chords(110, 150, 4));
      add('climax-onsets', 'The climax\'s audible pulse from the audio: onsets of strength >= 0.5, 110-150 s (the stressed beats of the theme), each with its notes (outer voices).',
        T.snap(T.onsets(110, 150, 0.5, -36), { lo: 60 }));
      add('violins', 'The violins\' line, notes held >= 0.28 s, the whole pack (the sighs\' top, the climax\'s high line).',
        T.sky(0, P.dur, isK('violin'), 0.28));
      add('low-pulse', 'From the audio: the bass strokes one hears as a slow pulse, low-band jumps >= 12 dB to +8 dB or more: under the love theme (22.8-39.2), one every ~2.2 s under its return and climax (79.4-149.7), the swells 179.0, 188.1, 196.8 s; each the lowest note struck, else octave 2.',
        T.snap(T.loPeaks(0, P.dur, 12, 8), { lo: 37, notes: 'low' }));
      add('night-hush', 'Hole cover for the quiet ends, from the audio: the night pedal 0-21 s (A, Bb) and the balcony night 185.5-217.6 s (Db pedal) as held notes at each chord change, octave 3.',
        [...T.changes(0, 20.9, 45, 1.5), ...T.changes(185.5, 217.6, 49, 1.5)]);
    },
  },

  'romeo-juliet-4-clash': {
    sections: [
      [0, 22.1, 'Feud fragments rise', 'the development opens on the feud\'s syncopations in D, building (0.45 to 0.64), first horn notes 17.1 s'],
      [22.1, 33.3, 'Friar\'s theme in the horns, hushed', 'p (-47 dB), clarinet figures (22.7-24.0) and the horns\' chorale fragment (29.6-31 s: C#4-Eb4-F4-Eb4) on Bb'],
      [33.3, 59.7, 'Feud against the Friar', 'the feud figures against the horns\' chorale (51.4-57.4 s: C4-D4-Eb4-G4-F4-Eb4-G4), D to G, crescendo to 0.72'],
      [59.7, 70.8, 'Hush', 'a sudden pp (-53 dB), B/E/F harmony, the horn holds G4 (61.6 s); few notes'],
      [70.8, 97.6, 'The long build', 'the horns again (72.7-76.0: Eb4-F4-Eb4-Ab4), the strings rise by steps Eb, E, F#, A, Bb, from -45 to -30 dB'],
      [97.6, 122.0, 'Climax: the Friar in the trumpets', 'ff (loudness 0.94-0.98): brass blows of strength 2-3.3 on E and B (the Friar\'s chorale in the trumpets, from the score; the transcription does not hear the brass), cymbal clashes, string syncopations'],
      [122.0, 135.9, 'Hammered F# (the dominant)', 'the whole orchestra hammers F#, the dominant of B minor, every 0.6-0.8 s (strength 2.2-3.8, 122.07-134.86 s): the door the feud comes back through'],
      [135.9, 159.9, 'The feud returns (recapitulation)', 'the feud theme ff in B minor from 136.07 s (B, E), clashes 145-157 s, a short drop at 142.6-144, ending on A/D at 157.5'],
    ],
    build(add, T, P) {
      const S = isK(FAM.strings);
      add('friar-chorale', 'The Friar\'s chorale in the horns (with the clarinets\' echoes), the long notes one hears against the feud: 17.1-18.0, 29.6-31.0, 51.4-57.4, 61.6, 72.7-76.0 s.',
        [...T.sky(16.9, 18.5, isK('horn'), 0.28), ...T.sky(29.4, 33, isK('horn', 'clarinet'), 0.28), ...T.sky(51, 58, isK('horn'), 0.28), ...T.sky(61.4, 63.6, isK('horn'), 0.28), ...T.sky(72.5, 79.6, isK('horn', 'clarinet'), 0.28)]);
      add('brass-blows', 'From the audio: the climax\'s brass blows (onset strength >= 2.0, 97.6-122 s, where the trumpets proclaim the Friar\'s chorale ff), then the hammered F# 122-135.9 s; each the notes struck with it, else the pitch class in octave 4.',
        T.snap(T.onsets(97.6, 135.9, 2.0, -30), { lo: 60 }));
      add('feud-accents', 'The feud\'s accented attacks: audio onsets of strength >= 0.4 in the feud stretches (0-22.1, 33.3-59.7, 135.9-159.9 s), each with its notes (outer voices).',
        [...T.snap(T.onsets(0, 22.1, 0.4, -45), { lo: 59 }), ...T.snap(T.onsets(33.3, 59.7, 0.4, -45), { lo: 59 }), ...T.snap(T.onsets(135.9, 159.9, 0.4, -40), { lo: 59 })]);
      add('feud-runs', 'The scurrying string runs (5+ stepwise notes <= 0.2 s apart, one instrument), the feud\'s machinery all through the development.',
        T.runs(0, P.dur, S));
      add('clash-strokes', 'The sword clashes: cymbal-bright strokes from the audio (5-11 kHz jump >= 9 dB to -20 dB or louder), 95.2-155.6 s; each the top note struck with it, else the pitch class in octave 6 (also single strokes at 21.5 and 59.0 s).',
        T.snap(T.hiPeaks(0, P.dur, 9, -20), { lo: 84, notes: 'top' }));
      add('ff-blows', 'The real ff blows: audio onsets of strength >= 2.4 at -25 dB or louder (97.6-157 s); each with its notes.',
        T.snap(T.onsets(95, P.dur, 2.4, -25), { lo: 59 }));
      add('rising-strings', 'The long build\'s rising string line, notes held >= 0.5 s, 70.8-97.6 s, and the held violin B5 of the hush (58.96-71.3 s).',
        [...T.sky(58.5, 72, isK('violin'), 0.6), ...T.sky(72, 97.6, S, 0.5)]);
      add('violins', 'The violins\' line, notes held >= 0.28 s, the whole pack.',
        T.sky(0, P.dur, isK('violin'), 0.28));
      add('low-strokes', 'Low-band strokes from the audio (timpani, bass drum, bass sforzandi; jump >= 10 dB): the climax\'s heaviest beats; each the lowest note struck with it.',
        T.snap(T.loPeaks(0, P.dur, 10, 10), { lo: 35, notes: 'low' }));
      add('hush-cover', 'Cover for the hush 59.7-70.8 s (few transcribed attacks): the notes held >= 0.28 s, plus each audio onset or chord change (B, E, F) as a held note in octave 4.',
        [...T.sky(59.7, 70.8, () => true, 0.28, P.all), ...T.snap(T.onsets(59.7, 70.8, 0.05, -55), { lo: 60 }), ...T.changes(59.7, 70.8, 60, 0.8)]);
    },
  },

  'romeo-juliet-5-return': {
    sections: [
      [0, 22.5, 'The sighs return (D major)', 'oboe and clarinets trade the sighing figure (Bb4/E5, G5-F#5-E5-D5) over the muted strings\' rocking chords, pp (-48 dB)'],
      [22.5, 37.6, 'Love theme swells in', 'the strings take up the love theme in D major, crescendo -40 to -25 dB'],
      [37.6, 95.0, 'Love theme ecstatic', 'the whole string body ff on the love theme (0.8-0.91), D/A major, violins up to G6, the pack\'s great song'],
      [95.0, 117.8, 'The theme breaks; the feud stirs', 'the love theme collapses (-35 to -40 dB), F/Eb/G/C harmony, fragments and a slow re-arming'],
      [117.8, 139.8, 'The feud returns', 'the feud\'s figures loud again (A, D, Bb), building'],
      [139.8, 202.7, 'Catastrophe: clashes', 'ff, cymbal clashes and brass blows (strength up to 2.9), B/F/G/Eb harmony, the violence that cuts the lovers down'],
      [202.7, 212.6, 'Held blows', 'the music freezes on G (-33 dB) and two blows (210.0, 212.4 s)'],
      [212.6, 220.5, 'Timpani roll, dying', 'a held F# with the timpani roll, fading to silence at ~219.5 s'],
    ],
    build(add, T, P) {
      const S = isK(FAM.strings), W = isK(FAM.winds);
      add('sighs', 'The sighs in D major: the oboe and clarinets\' sighing figure 0.3-30 s (Bb4/E5, G5-F#5-E5-D5-C#5, the repeated D5s), one note per sigh.',
        T.sky(0, 31, W, 0.28));
      add('sigh-chords', 'The muted strings\' rocking chords under the sighs, 0-22.5 s (each chord\'s outer voices).',
        T.chords(0, 22.5, 3, P.all, (n) => S(n) || n.k === 'pack'));
      add('love-theme', 'The love theme in the violins, notes held >= 0.4 s: its swell 22.5-37.6 s and its ecstatic ff statement 37.6-95 s (A5, D6, E6, B5 ... up to G6 at 51.9 s).',
        T.sky(20, 95, isK('violin'), 0.4));
      add('love-climax-onsets', 'The love theme\'s stressed beats from the audio, 37.6-95 s (onset strength >= 0.8): the pulse of the ecstatic statement, each with its notes.',
        T.snap(T.onsets(37.6, 95, 0.8, -30), { lo: 62 }));
      add('broken-theme', 'The theme breaking off and the feud stirring, 95-117.8 s: the string line (notes held >= 0.28 s).',
        T.sky(95, 117.8, () => true, 0.28));
      add('feud-accents', 'The feud\'s accented attacks: audio onsets of strength >= 0.9, 117.8-202.7 s, each with its notes (outer voices).',
        T.snap(T.onsets(117.8, 202.7, 0.9, -32), { lo: 59 }));
      add('feud-runs', 'The scurrying string runs (5+ stepwise notes <= 0.2 s apart): the feud\'s machinery, mostly 117-202 s.',
        T.runs(95, 212.6, S));
      add('clash-strokes', 'The sword clashes: cymbal-bright strokes from the audio (5-11 kHz jump >= 9 dB to -20 dB or louder), 139.7-202.1 s; each the top note struck with it, else octave 6.',
        T.snap(T.hiPeaks(117.8, P.dur, 9, -20), { lo: 84, notes: 'top' }));
      add('ff-blows', 'The real ff blows of the catastrophe: audio onsets of strength >= 1.4 at -25 dB or louder (139.8-212.6 s), each with its notes.',
        T.snap(T.onsets(137, 213, 1.4, -25), { lo: 59 }));
      add('catastrophe-blows', 'The last blows: low-band strokes 195-213 s (210.0, 212.4 ...) and the held-blow chords, from the audio; each the lowest note struck, else octave 2.',
        T.snap(T.loPeaks(195, 214, 8, 5), { lo: 43, notes: 'low' }));
      add('violins', 'The violins\' line, notes held >= 0.28 s, the whole pack.',
        T.sky(0, P.dur, isK('violin'), 0.28));
      add('harp', 'The harp (the roll\'s "plucked" and "piano" tracks): harp arpeggios by ear and register (the labels are the transcriber\'s), inside the love theme 39-95 s and the catastrophe.',
        inWin(P.roll, 0, P.dur, isK('plucked', 'piano')));
      add('dying-roll', 'Hole cover for the end, from the audio: the held F# under the timpani roll, 212.6-219.5 s, as held notes at each change (octave 2).',
        T.changes(212.6, 219.6, 42, 1.0));
    },
  },

  'romeo-juliet-6-coda': {
    sections: [
      [0, 1.7, 'Silence', 'the breath before the coda'],
      [1.7, 47.5, 'Funeral march', 'the timpani strike B every ~1.23 s (1.74 ... 45.9 s), the strings sing the love theme broken over them, in B'],
      [47.5, 101.5, 'Consoling chorale', 'a hymn in woodwinds and horns, B major, p (-44 dB): slow chords, ~1 a second'],
      [101.5, 140.9, 'Love theme transfigured', 'the violins high (E6-F#6-G6-F#6-B5 ...), harp arpeggios (102-131 s), B major, crescendo -38 to -30 dB'],
      [140.9, 160.0, 'Hammered closing chords', 'ff B major chords, hammered (10-15 onsets per 2.5 s), the timpani under them'],
      [160.0, 166.0, 'Last chord held', 'the final B chord sustained (-26 dB), cut at 166.0 s'],
      [166.0, 180.1, 'Silence', 'room tone, then digital silence from 177 s'],
    ],
    build(add, T, P) {
      const S = isK(FAM.strings), W = isK(FAM.winds);
      add('funeral-timpani', 'The funeral march\'s timpani: every low-band stroke from the audio, 1.74-46 s, about 1.23 s apart (B2, the pitch the chroma hears); the transcription has almost none of them.',
        T.snap(T.loPeaks(1.5, 47.5, 9, 8), { lo: 47, notes: 'low', src: [] }).map((n) => ({ ...n, m: 47 })));
      add('love-theme', 'The love theme as the coda sings it: broken in the strings over the timpani (7.85-44.5 s: G4, C4-Eb4-E4-F#4-B3 ...), then transfigured high in the violins (101-139 s: E6-F#6-G6-F#6-B5 ...); notes held >= 0.4 s.',
        [...T.sky(1.7, 47.5, (n) => S(n) && n.m >= 52, 0.4), ...T.sky(101.5, 140.9, isK('violin'), 0.4)]);
      add('broken-love', 'Only the broken love theme over the funeral timpani, 7.85-44.5 s (strings, notes held >= 0.4 s).',
        T.sky(1.7, 47.5, (n) => S(n) && n.m >= 52, 0.4));
      add('coda-chorale', 'The consoling chorale: woodwinds and horns (with the violins that join it), 49.7-101 s, the top voice of each chord held >= 0.5 s; a descendant of the Friar\'s chorale in spirit (hymn, winds, slow).',
        T.sky(47.5, 101.5, () => true, 0.5));
      add('coda-chorale-chords', 'The consoling chorale as chords (3+ notes, outer voices), 47.5-101.5 s.',
        T.chords(47.5, 101.5, 3));
      add('harp', 'The harp\'s arpeggios under the transfigured love theme, 102-131 s (the roll\'s piano/plucked tracks and the pack\'s notes there).',
        inWin(P.all, 101.5, 140.9, (n) => n.k === 'piano' || n.k === 'plucked' || (n.k === 'pack' && n.m >= 47)));
      add('ff-blows', 'The hammered closing chords: audio onsets of strength >= 0.8 at -26 dB or louder, 142.9-158.9 s, in bursts at 143.0, 145.0, 147.4, 149.2, 151.9, 153.7, 155.6, 158.1 s; each the notes struck with it, else B in octave 3.',
        T.snap(T.onsets(140.9, 160, 0.8, -26), { lo: 59 }));
      add('violins', 'The violins\' line, notes held >= 0.28 s, the whole pack.',
        T.sky(0, P.dur, isK('violin'), 0.28));
      add('last-chord', 'The final B chord: one held note from its last attack to the cut-off at 166.0 s (B3), so a widget can hold it.',
        [{ t: 158.18, e: 166.0, m: 59, v: 100, k: 'audio' }]);
    },
  },
};

/** Sets every pack gets, with the same ids, so a cycle can give a strand its picture in every pack. */
function common(add, T, P) {
  add('melody', 'The voiced-out top line of the whole pack: every instrument, notes held >= 0.28 s at G3 or higher, the top (or the clearly loudest) note of each attack; a note under a higher one still sounding is hidden.',
    T.sky(0, P.dur, (n) => n.m >= 55, 0.28));
  add('bass-line', 'The bass line: the lowest note of each attack below D3 (cellos, basses, bassoons; roll and pack), one per 0.25 s.',
    T.bass(0, P.dur, 50));
  add('chord-blocks', 'Chord blocks: attacks of 5+ notes (roll and pack), thinned to their outer voices, one attack per chord.',
    T.chords(0, P.dur, 5));
  add('winds-line', 'Every woodwind and horn voice\'s line: the top of each wind attack held >= 0.28 s, the whole pack.',
    T.sky(0, P.dur, isK(FAM.winds), 0.28));
}

// ============================ build, check, print ============================
const md = [];
for (const [id, song] of Object.entries(SONGS)) {
  const P = load(id), T = tools(P);
  const out = {}, meta = [];
  const add = (sid, hears, notes) => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sid)) throw new Error(`${id}: ${sid} is not a slug`);
    if (out[sid]) throw new Error(`${id}: ${sid} twice`);
    const seen = new Set();
    const ns = notes.filter((n) => n.t >= 0 && n.t < P.dur).sort((a, b) => a.t - b.t || a.m - b.m).filter((n) => { const k = `${r3(n.t)}|${n.m}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((n) => [r3(n.t), r3(Math.min(P.dur, Math.max(n.e, n.t + 0.05))), n.m, Math.round(clamp(n.v, 1, 127))]);
    if (!ns.length) throw new Error(`${id}: ${sid} has no notes`);
    out[sid] = { hears, notes: ns };
    meta.push({ sid, notes: ns, attacks: clusters(ns.map(([t, e, m, v]) => ({ t, e, m, v }))).length, audio: notes.filter((n) => n.k === 'audio').length });
  };
  song.build(add, T, P);
  common(add, T, P);
  const text = JSON.stringify(out, null, 1).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]');
  writeFileSync(join(HERE, id, 'picks.json'), text + '\n');

  // ---- markdown for ANALYSIS.md ----
  md.push(`\n### ${id} (${+P.dur.toFixed(1)} s)\n`);
  md.push('| start | end | section | character | sets sounding (attacks) |\n|---|---|---|---|---|');
  for (const [a, b, name, ch] of song.sections) {
    const here = meta.map((m) => [m.sid, m.notes.filter((n) => n[0] >= a && n[0] < b)]).filter(([, ns]) => ns.length)
      .map(([s, ns]) => [s, clusters(ns.map(([t, e, mm, v]) => ({ t, e, m: mm, v }))).length]).sort((x, y) => y[1] - x[1]);
    md.push(`| ${a.toFixed(1)} | ${b.toFixed(1)} | ${name} | ${ch} | ${here.map(([s, n]) => `${s} (${n})`).join(', ') || '-'} |`);
  }
  md.push('\n| set | notes | attacks | span (s) | from the audio | what one hears |\n|---|---|---|---|---|---|');
  for (const m of meta) md.push(`| \`${m.sid}\` | ${m.notes.length} | ${m.attacks} | ${m.notes[0][0].toFixed(1)}-${Math.max(...m.notes.map((n) => n[1])).toFixed(1)} | ${m.audio || '-'} | ${out[m.sid].hears} |`);
  const H = T.holes();
  md.push(`\nHoles (audible, > -56 dB, but no note starting for 3 s or more): ${H.map(([a, b]) => `${a}-${b} s`).join(', ') || 'none'}.`);
  // weight table: per 30 s, the strands by attacks x mean velocity (generic sets left out where a theme set covers them)
  md.push('\n| from | loudness (dB, mean / max) | prominent strands, strongest first (attacks) |\n|---|---|---|');
  for (let a = 0; a < P.dur; a += 30) {
    const b = Math.min(P.dur, a + 30);
    const dbs = P.ae.curve.slice(a * 10, b * 10).map((c) => c[0]);
    const rank = meta.map((m) => { const ns = m.notes.filter((n) => n[0] >= a && n[0] < b); if (!ns.length) return null; const att = clusters(ns.map(([t, e, mm, v]) => ({ t, e, m: mm, v }))).length; const vel = ns.reduce((s, n) => s + n[3], 0) / ns.length; return [m.sid, att, att * vel]; })
      .filter(Boolean).sort((x, y) => y[2] - x[2]).slice(0, 6);
    md.push(`| ${a}-${b.toFixed(0)} | ${(dbs.reduce((s, x) => s + x, 0) / dbs.length).toFixed(0)} / ${Math.max(...dbs).toFixed(0)} | ${rank.map(([s, n]) => `${s} (${n})`).join(', ')} |`);
  }
  console.log(`${id}: ${meta.length} sets, ${meta.reduce((s, m) => s + m.notes.length, 0)} notes`);
  for (const m of meta) console.log(`  ${m.sid.padEnd(22)} ${String(m.notes.length).padStart(4)} notes ${String(m.attacks).padStart(4)} att ${m.notes[0][0].toFixed(1).padStart(6)}-${Math.max(...m.notes.map((n) => n[1])).toFixed(1).padEnd(6)} audio ${String(m.audio).padStart(3)} | ${m.notes.slice(0, 12).map((n) => nm(n[2])).join(' ')}`);
}
if (process.argv[2]) writeFileSync(process.argv[2], md.join('\n') + '\n'); // the generated tables of ANALYSIS.md
