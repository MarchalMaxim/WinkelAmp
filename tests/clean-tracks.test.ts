import { describe, expect, it } from 'vitest';
import {
  CHUNK_S, DUP_START_S, STUCK_MIN_SPAN_S, cleanTracks, cleanWarning, emptyReport, fixRanges, frameDb, mergeButting,
  type CleanInput, type CleanReport, type LevelLane,
} from '../src/studio/pack/clean-tracks';
import { SILENT_DB, type Ymt3Row } from '../src/studio/pack/tracks';

const HOP = 0.1;
/** A level lane of `seconds` at one level; every fixture needs one, or pass 3 reads silence and drops everything. */
const flat = (db: number, seconds = 700): LevelLane => ({ hop: HOP, db: new Array<number>(Math.ceil(seconds / HOP)).fill(db) });
/** The same, with single frames set: { 12: -30 } is the frame at 1.2 s. */
const withFrames = (base: number, frames: Record<number, number>, seconds = 700): LevelLane => {
  const db = new Array<number>(Math.ceil(seconds / HOP)).fill(base);
  for (const [k, v] of Object.entries(frames)) db[Number(k)] = v;
  return { hop: HOP, db };
};
const run = (rows: readonly Ymt3Row[], o: Partial<Omit<CleanInput, 'rows'>> = {}) =>
  cleanTracks({ rows, duration: o.duration ?? 600, levels: o.levels ?? flat(-20), onsets: o.onsets ?? [] });
const sorted = (rows: readonly Ymt3Row[]): Ymt3Row[] => [...rows].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
const lane = (rows: readonly Ymt3Row[], cls: string): Ymt3Row[] => rows.filter((r) => r[4] === cls);
const row = (start: number, end: number, midi: number, cls: string): Ymt3Row => [start, end, midi, 100, cls];

/** Repeated strikes of one chord from `from`, one per gap, until `to` (exclusive). */
function strikes(pitches: readonly number[], from: number, to: number, gap: number, cls = 'Violin'): Ymt3Row[] {
  const out: Ymt3Row[] = [];
  for (let i = 0; from + i * gap < to - 1e-9; i++) {
    const t = Math.round((from + i * gap) * 1000) / 1000;
    for (const p of pitches) out.push(row(t, Math.round((t + gap) * 1000) / 1000, p, cls));
  }
  return out;
}
/** `n` spaced notes cycling through `pitches`, to set a lane's median and core; not butting, not stuck. */
function spread(pitches: readonly number[], cls: string, n: number, from = 0, step = 0.7): Ymt3Row[] {
  return Array.from({ length: n }, (_, i) => row(from + i * step + 0.003, from + i * step + 0.303, pitches[i % pitches.length], cls));
}
const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('the whole pass', () => {
  it('leaves a clean quartet alone', () => {
    // Quavers on a harmony that changes every bar: a real quartet, not one chord stuck for a whole chunk.
    const bars = [[67, 64, 55, 43], [69, 65, 57, 41], [67, 62, 55, 43], [64, 60, 52, 45]];
    const rows: Ymt3Row[] = [];
    for (let i = 0; i < 48; i++) {
      const t = i * 0.25, [v, a, c, b] = bars[Math.floor(i / 8) % 4];
      rows.push(row(t, t + 0.25, v, 'Violin'), row(t, t + 0.25, a, 'Viola'), row(t, t + 0.25, c, 'Cello'), row(t, t + 0.25, b, 'Contrabass'));
    }
    // A unison inside both lanes' cores.
    for (let i = 48; i < 56; i++) {
      const t = i * 0.25;
      rows.push(row(t, t + 0.25, 64, 'Violin'), row(t, t + 0.25, 64, 'Viola'), row(t, t + 0.25, 52, 'Cello'), row(t, t + 0.25, 40, 'Contrabass'));
    }
    const { rows: out, report } = run(rows, { levels: flat(-20) });
    expect(out).toEqual(sorted(rows));
    expect(report).toEqual(emptyReport());
    expect(cleanWarning(report)).toBeNull();
  });

  it('keeps repeated notes', () => {
    // The motto: three quick repeats and a long note, on three lanes in unison, butting all the way.
    const rows: Ymt3Row[] = [];
    let t = 0;
    for (let k = 0; k < 8; k++) {
      for (const d of [0.16, 0.16, 0.16, 0.64]) {
        for (const [p, cls] of [[67, 'Violin'], [67, 'Viola'], [55, 'Cello']] as const) rows.push(row(t, t + d, p, cls));
        t = Math.round((t + d) * 100) / 100;
      }
    }
    const { rows: out, report } = run(rows);
    expect(out).toEqual(sorted(rows));
    expect(report.merged).toBe(0);
    expect(report).toEqual(emptyReport());
  });

  it('a second pass changes nothing', () => {
    const dirty: Ymt3Row[] = [
      ...spread(range(64, 88), 'Violin', 75), ...spread(range(55, 65), 'Viola', 44), ...spread(range(45, 55), 'Cello', 44),
      ...spread(range(33, 43), 'Contrabass', 44), ...spread([72, 73, 74, 75, 76], 'Oboe', 40), ...spread([66, 67, 68, 69, 70], 'Clarinet', 40),
      row(498, 505, 40, 'Cello'), row(499.99, 500.5, 60, 'Viola'),      // a clamped end, and past the end
      ...strikes([60, 64, 67, 72], 420, 425, 0.12),                     // stuck, sounding
      ...strikes([60, 64, 67, 72], 430, 435, 0.12),                     // stuck, quiet
      row(300, 300.2, 60, 'Violin'),                                    // in silence
      row(200, 201, 85, 'Viola'), row(200, 201, 85, 'Violin'),          // moved onto a lane already playing it
      row(210, 210.3, 60, 'Violin'), row(210, 210.3, 60, 'Viola'),      // the barking dog
      ...[0, 1, 2, 3, 4, 5].map((i) => row(250 + i * 0.5, 250.4 + i * 0.5, 76, 'Oboe')),
      ...[0, 1, 2, 3, 4, 5].map((i) => row(250 + i * 0.5, 250.4 + i * 0.5, 76, 'Clarinet')),
      row(350, 357.3, 48, 'Cello'), row(357.3, 360.7, 48, 'Cello'), row(360.7, 364.8, 48, 'Cello'),   // a chopped drone
    ];
    const frames: Record<number, number> = {};
    for (let k = 3000; k < 3010; k++) frames[k] = SILENT_DB;
    for (let k = 4300; k < 4350; k++) frames[k] = -54;
    const levels = withFrames(-30, frames);
    const first = run(dirty, { duration: 500, levels });
    const r = first.report;
    for (const n of [r.pastEnd, r.clamped, r.stuckChunks, r.stuckDropped, r.stuckCollapsed, r.silent, r.laneDupes, r.stringDupes, r.windDupes, r.merged]) {
      expect(n).toBeGreaterThan(0);
    }
    expect(Object.keys(r.moved).length).toBeGreaterThan(0);
    const second = run(first.rows, { duration: 500, levels });
    expect(second.rows).toEqual(first.rows);
    expect(second.report).toEqual(emptyReport());
  });

  it('does not mutate its input', () => {
    const rows: Ymt3Row[] = [
      row(1, 2, 85, 'Viola'), row(1, 2.5, 85, 'Violin'), row(3, 4, 60, 'Viola'), row(0, 700, 70, 'Violin'),
      row(5, 7, 48, 'Cello'), row(7, 9, 48, 'Cello'),
    ];
    const frozen = Object.freeze(rows.map((r) => Object.freeze([...r]) as unknown as Ymt3Row)) as readonly Ymt3Row[];
    const before = JSON.stringify(frozen);
    const { rows: out } = run(frozen);
    expect(JSON.stringify(frozen)).toBe(before);
    expect(out.find((r) => r[2] === 48)).toEqual(row(5, 9, 48, 'Cello'));
    out[0][0] = -1;                    // the output is the caller's own
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it('sorts by start, then pitch', () => {
    const rows = [row(2, 3, 61, 'Oboe'), row(1, 2, 72, 'Oboe'), row(1, 2, 60, 'Oboe'), row(0, 1, 90, 'Oboe')];
    expect(run(rows).rows).toEqual([row(0, 1, 90, 'Oboe'), row(1, 2, 60, 'Oboe'), row(1, 2, 72, 'Oboe'), row(2, 3, 61, 'Oboe')]);
  });

  it('cleans 30000 rows in under 500 ms', () => {
    // Thick on purpose: 12 lanes, a few pitches, many same-start clusters and long wind runs that copy each other. A scan
    // of the whole list for each note takes seconds here, where an index by pitch does not.
    const lanes = ['Violin', 'Viola', 'Cello', 'Contrabass', 'Oboe', 'Clarinet', 'Bassoon', 'Pipe', 'French Horn', 'Trumpet', 'Timpani', 'Acoustic Piano'];
    const rows: Ymt3Row[] = [];
    for (let i = 0; rows.length < 30000; i++) {
      const t = Math.round(i * 5) / 100, midi = 55 + (i % 7);
      for (const cls of lanes) rows.push(row(t, t + 0.04, midi, cls));
    }
    const levels = flat(-20, 200);
    const t0 = performance.now();
    const { rows: out } = cleanTracks({ rows, duration: 200, levels, onsets: rows.map((r) => r[0]) });
    expect(performance.now() - t0).toBeLessThan(500);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('frameDb', () => {
  it('reads silence as SILENT_DB and a full-scale sine near -3 dB', () => {
    const silent = frameDb(new Float32Array(44100), 44100);
    expect(silent.hop).toBe(0.1);
    expect(silent.db.length).toBe(10);
    for (let k = 0; k < 10; k++) expect(silent.db[k]).toBe(SILENT_DB);
    const pcm = new Float32Array(44100);
    for (let i = 0; i < pcm.length; i++) pcm[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
    const sine = frameDb(pcm, 44100);
    for (let k = 0; k < 10; k++) expect(sine.db[k]).toBeCloseTo(-3.01, 1);
  });

  it('gives a partial last frame its own level, and takes another hop', () => {
    const levels = frameDb(new Float32Array(1500), 1000, 0.5);
    expect(levels.hop).toBe(0.5);
    expect(levels.db.length).toBe(3);
  });
});

describe('pass 1: past the end', () => {
  it('drops the padded last chunk and clamps an end', () => {
    const rows = [row(600, 601, 70, 'Violin'), row(605.7, 606, 60, 'Violin'), row(605.6, 605.61, 62, 'Violin'), row(605, 606, 64, 'Violin')];
    const { rows: out, report } = run(rows, { duration: 605.62, levels: flat(-20, 650) });
    expect(out).toEqual([row(600, 601, 70, 'Violin'), row(605, 605.62, 64, 'Violin')]);
    expect(report.pastEnd).toBe(2);
    expect(report.clamped).toBe(1);
  });
});

describe('pass 2: stuck chords', () => {
  const FIVE = [60, 64, 67, 72, 76];

  it('collapses a stuck chord in a sounding chunk', () => {
    const rows = strikes(FIVE, 420, 425, 0.12);
    const ticks = rows.length / 5;
    const { rows: out, report } = run(rows, { levels: flat(-30) });
    expect(out.map((r) => r[2])).toEqual(FIVE);
    for (const r of out) {
      expect(r[0]).toBe(420);
      expect(r[1]).toBeCloseTo(420 + (ticks - 1) * 0.12 + 0.12, 6);
      expect(r[4]).toBe('Violin');
    }
    expect(report.stuckChunks).toBe(1);
    expect(report.stuckCollapsed).toBe(rows.length - 5);
    expect(report.stuckDropped).toBe(0);
  });

  it('drops a stuck chord in a quiet chunk', () => {
    const rows = strikes(FIVE, 420, 425, 0.12);
    const { rows: out, report } = run(rows, { levels: flat(-54) });
    expect(out).toEqual([]);
    expect(report.stuckChunks).toBe(1);
    expect(report.stuckDropped).toBe(rows.length);
    expect(report.stuckCollapsed).toBe(0);
  });

  it('holds a chord per lane when two lanes are stuck on it', () => {
    const rows = [...strikes([60, 64], 420, 425, 0.12, 'Violin'), ...strikes([67], 420, 425, 0.12, 'Viola')];
    const { rows: out } = run(rows, { levels: flat(-30) });
    expect(out.map((r) => [r[2], r[4]])).toEqual([[60, 'Violin'], [64, 'Violin'], [67, 'Viola']]);
  });

  it('never holds a chord past the end of the song', () => {
    const { rows: out } = run(strikes(FIVE, 420, 425, 0.12), { duration: 424.95, levels: flat(-30) });
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) expect(r[1]).toBeLessThanOrEqual(424.95);
  });

  it('leaves a hammered chord that is too short', () => {
    const rows = strikes(range(55, 66), 345, 348.2, 0.16);
    expect(3.2).toBeLessThan(STUCK_MIN_SPAN_S);
    const { rows: out, report } = run(rows, { levels: flat(-30) });
    expect(out).toEqual(sorted(rows));
    expect(report.stuckChunks).toBe(0);
  });

  it('leaves a two-pitch tremolo over a whole chunk', () => {
    const rows = strikes([60, 64], 420, 425, 0.1);
    const { rows: out, report } = run(rows, { levels: flat(-30) });
    expect(out).toEqual(sorted(rows));
    expect(report.stuckChunks).toBe(0);
  });

  it('leaves an irregular chord', () => {
    const gaps = [0.09, 0.3, 0.15, 0.22];
    const rows: Ymt3Row[] = [];
    let t = 420;
    for (let i = 0; t < 424.8; i++) {
      const g = gaps[i % 4];
      for (const p of FIVE) rows.push(row(t, t + g, p, 'Violin'));
      t = Math.round((t + g) * 100) / 100;
    }
    expect(rows.length / 5).toBeGreaterThanOrEqual(20);
    const { rows: out, report } = run(rows, { levels: flat(-30) });
    expect(out).toEqual(sorted(rows));
    expect(report.stuckChunks).toBe(0);
  });

  it('leaves a chord that is under 85 % of the chunk\'s ticks', () => {
    const chord = strikes(FIVE, 420, 424.8, 0.12);                     // 40 ticks, regular, spanning 4.68 s
    const others = Array.from({ length: 8 }, (_, i) => row(420.06 + i * 0.12, 420.1 + i * 0.12, 50 + i, 'Viola'));   // 40 of 48
    const rows = [...chord, ...others];
    const { rows: out, report } = run(rows, { levels: flat(-30) });
    expect(report.stuckChunks).toBe(0);
    expect(out).toEqual(sorted(rows));
    // The same chord without those eight is stuck, so it is the share that spared it.
    expect(run(chord, { levels: flat(-30) }).report.stuckChunks).toBe(1);
  });

  it('judges a chunk on its own', () => {
    expect(CHUNK_S).toBe(5);
    const rows = strikes(FIVE, 422.5, 427.5, 0.12);                    // the same 5 s, across two chunks
    expect(run(rows, { levels: flat(-30) }).report.stuckChunks).toBe(0);
  });
});

describe('pass 3: silence', () => {
  const others = [row(50, 51, 70, 'Violin')];

  it('drops a note in digital silence', () => {
    const levels = withFrames(-20, { 10: SILENT_DB, 11: SILENT_DB, 12: SILENT_DB, 13: SILENT_DB });
    const { rows: out, report } = run([row(1, 1.2, 60, 'Violin'), ...others], { levels });
    expect(out).toEqual(others);
    expect(report.silent).toBe(1);
  });

  it('keeps a quiet note', () => {
    const rows = [row(1, 1.2, 60, 'Violin'), ...others];
    const { rows: out, report } = run(rows, { levels: flat(-55) });
    expect(out).toEqual(rows);
    expect(report.silent).toBe(0);
  });

  it('looks at the note\'s first 0.4 s', () => {
    const silent: Record<number, number> = {};
    for (let k = 10; k < 30; k++) silent[k] = SILENT_DB;
    const inWindow = withFrames(-20, { ...silent, 12: -30 });
    expect(run([row(1, 2.5, 60, 'Violin')], { levels: inWindow }).rows).toHaveLength(1);
    const afterIt = withFrames(-20, { ...silent, 20: -30 });
    expect(run([row(1, 2.5, 60, 'Violin')], { levels: afterIt }).rows).toHaveLength(0);
  });

  it('reads past the end of the lane as silence', () => {
    const { rows: out, report } = run([row(90, 91, 60, 'Violin')], { levels: flat(-20, 10) });
    expect(out).toEqual([]);
    expect(report.silent).toBe(1);
  });
});

describe('pass 4: ranges', () => {
  const HOME: Record<string, number> = { Violin: 72, Viola: 60, Cello: 48, Contrabass: 36 };
  const home = (...lanes: string[]) => lanes.map((cls, i) => row(100 + i * 3, 101 + i * 3, HOME[cls], cls));

  it('moves viola above A5 to violin, keeps A5', () => {
    const rows = [row(0, 1, 82, 'Viola'), row(3, 4, 81, 'Viola'), ...home('Violin', 'Viola')];
    const { rows: out, report } = run(rows);
    expect(out[0]).toEqual(row(0, 1, 82, 'Violin'));
    expect(out[1]).toEqual(row(3, 4, 81, 'Viola'));
    expect(report.moved).toEqual({ 'Viola>Violin': 1 });
  });

  it('moves cello above 76', () => {
    const rows = [row(0, 1, 77, 'Cello'), row(3, 4, 82, 'Cello'), ...home('Violin', 'Viola', 'Cello')];
    const { rows: out, report } = run(rows);
    expect(out[0]).toEqual(row(0, 1, 77, 'Viola'));
    expect(out[1]).toEqual(row(3, 4, 82, 'Violin'));
    expect(report.moved).toEqual({ 'Cello>Viola': 1, 'Cello>Violin': 1 });
  });

  it('moves contrabass above 62 to cello', () => {
    const { rows: out } = run([row(0, 1, 63, 'Contrabass'), ...home('Cello', 'Contrabass')]);
    expect(out[0][4]).toBe('Cello');
  });

  it('moves violin below G3 to viola', () => {
    const { rows: out } = run([row(0, 1, 54, 'Violin'), ...home('Violin', 'Viola')]);
    expect(out[0][4]).toBe('Viola');
  });

  it('moves viola below C3 to cello', () => {
    const { rows: out } = run([row(0, 1, 47, 'Viola'), ...home('Viola', 'Cello')]);
    expect(out[0][4]).toBe('Cello');
  });

  it('moves cello below C2 to contrabass', () => {
    const { rows: out } = run([row(0, 1, 35, 'Cello'), ...home('Cello', 'Contrabass')]);
    expect(out[0][4]).toBe('Contrabass');
  });

  it('moves only onto a lane that has rows', () => {
    const { rows: out, report } = run([row(0, 1, 35, 'Cello'), ...home('Cello', 'Viola')]);
    expect(out[0]).toEqual(row(0, 1, 35, 'Cello'));
    expect(report.moved).toEqual({});
  });

  it('takes the nearest lane that fits and has rows', () => {
    // Violin 40 fits the contrabass and the cello, not the viola. The cello is nearer.
    const report = emptyReport();
    const out = fixRanges([row(0, 1, 40, 'Violin'), ...home('Violin', 'Cello', 'Contrabass')], report);
    expect(out[0][4]).toBe('Cello');
    expect(report.moved).toEqual({ 'Violin>Cello': 1 });
  });

  it('does not touch other lanes', () => {
    const rows = [row(0, 1, 100, 'Pipe'), row(3, 4, 33, 'Bassoon'), ...home('Violin')];
    const { rows: out, report } = run(rows);
    expect(out.slice(0, 2)).toEqual(rows.slice(0, 2));
    expect(report.moved).toEqual({});
  });
});

describe('pass 5: one lane, one note', () => {
  it('a note moved onto a lane already playing it sounds once', () => {
    const rows = [row(1, 2, 85, 'Viola'), row(1, 2.5, 85, 'Violin'), row(20, 21, 60, 'Viola')];
    const { rows: out, report } = run(rows);
    expect(lane(out, 'Violin')).toEqual([row(1, 2.5, 85, 'Violin')]);
    expect(report.moved).toEqual({ 'Viola>Violin': 1 });
    expect(report.laneDupes).toBe(1);
  });

  it('keeps two starts further apart than the window', () => {
    const rows = [row(1, 1.2, 60, 'Oboe'), row(1 + DUP_START_S + 0.01, 1.3, 60, 'Oboe')];
    const { rows: out, report } = run(rows);
    expect(out).toHaveLength(2);
    expect(report.laneDupes).toBe(0);
  });
});

describe('pass 6: strings doubled at the same pitch', () => {
  it('drops the barking dog\'s doubling from the wrong lane', () => {
    const rows = [
      ...spread(range(65, 87), 'Violin', 69), ...spread([58, 59, 60, 61, 62], 'Viola', 50),
      row(100, 100.3, 60, 'Violin'), row(100, 100.31, 60, 'Viola'),
    ];
    const { rows: out, report } = run(rows);
    expect(out.filter((r) => r[0] === 100)).toEqual([row(100, 100.31, 60, 'Viola')]);
    expect(report.stringDupes).toBe(1);
  });

  it('keeps a unison inside both cores', () => {
    const rows = [
      ...spread(range(58, 72), 'Violin', 45), ...spread(range(52, 66), 'Viola', 45),
      row(100, 100.3, 60, 'Violin'), row(100, 100.3, 60, 'Viola'),
    ];
    const { rows: out, report } = run(rows);
    expect(out.filter((r) => r[0] === 100)).toHaveLength(2);
    expect(report.stringDupes).toBe(0);
  });

  it('leaves an octave doubling alone', () => {
    const rows = [
      ...spread(range(50, 60), 'Cello', 44), ...spread(range(30, 40), 'Contrabass', 44),
      row(100, 100.3, 48, 'Cello'), row(100, 100.3, 36, 'Contrabass'),
    ];
    const { rows: out, report } = run(rows);
    expect(out.filter((r) => r[0] === 100)).toHaveLength(2);
    expect(report.stringDupes).toBe(0);
  });

  it('keeps notes whose ends are apart', () => {
    const rows = [
      ...spread(range(65, 87), 'Violin', 69), ...spread([58, 59, 60, 61, 62], 'Viola', 50),
      row(100, 100.3, 60, 'Violin'), row(100, 101, 60, 'Viola'),
    ];
    expect(run(rows).report.stringDupes).toBe(0);
  });

  it('on a tie of medians, the later lane in TRACKS loses', () => {
    // 60 is 10 from both medians. It is outside the viola's core and inside the violin's.
    const rows = [
      ...spread(range(60, 80), 'Violin', 42), ...spread([48, 49, 50, 51, 52], 'Viola', 40),
      row(100, 100.3, 60, 'Violin'), row(100, 100.3, 60, 'Viola'),
    ];
    const { rows: out, report } = run(rows);
    expect(out.filter((r) => r[0] === 100)).toEqual([row(100, 100.3, 60, 'Violin')]);
    expect(report.stringDupes).toBe(1);
  });
});

describe('pass 7: winds copying each other', () => {
  const six = (cls: string, count = 6) => Array.from({ length: count }, (_, i) => row(100 + i * 0.5, 100.4 + i * 0.5, 76, cls));
  const medians = [...spread([72, 73, 74, 75, 76], 'Oboe', 40), ...spread([66, 67, 68, 69, 70], 'Clarinet', 40)];

  it('drops a clarinet copying an exposed oboe solo', () => {
    const { rows: out, report } = run([...medians, ...six('Oboe'), ...six('Clarinet')]);
    expect(out.filter((r) => r[2] === 76 && r[0] >= 100).map((r) => r[4])).toEqual(new Array(6).fill('Oboe'));
    expect(report.windDupes).toBe(6);
  });

  it('keeps the doubling in a tutti', () => {
    // 30 string attacks a second through the run, on moving pitches, as under a tutti.
    const tutti = Array.from({ length: 90 }, (_, i) => row(100 + i / 30, 100.02 + i / 30, 60 + (i % 20), 'Violin'));
    const { rows: out, report } = run([...medians, ...six('Oboe'), ...six('Clarinet'), ...tutti]);
    expect(report.windDupes).toBe(0);
    expect(lane(out, 'Clarinet').filter((r) => r[2] === 76)).toHaveLength(6);
    expect(lane(out, 'Oboe').filter((r) => r[0] >= 100)).toHaveLength(6);
  });

  it('keeps three coincidences', () => {
    const { rows: out, report } = run([...medians, ...six('Oboe', 3), ...six('Clarinet', 3)]);
    expect(report.windDupes).toBe(0);
    expect(lane(out, 'Clarinet').filter((r) => r[0] >= 100)).toHaveLength(3);
  });

  it('does not dedupe a wind against a string', () => {
    const { rows: out, report } = run([...spread([72, 74, 76], 'Violin', 30), ...six('Violin'), ...six('Oboe')]);
    expect(report.windDupes).toBe(0);
    expect(report.stringDupes).toBe(0);
    expect(lane(out, 'Oboe')).toHaveLength(6);
  });

  it('breaks a run where a note is not a copy', () => {
    const clarinet = six('Clarinet');
    clarinet[3] = row(clarinet[3][0], clarinet[3][1], 70, 'Clarinet');      // two runs of 3
    expect(run([...medians, ...six('Oboe'), ...clarinet]).report.windDupes).toBe(0);
  });
});

describe('pass 8: chopped notes', () => {
  it('merges a drone chopped into long notes', () => {
    const rows = [row(0, 7.3, 48, 'Cello'), row(7.3, 10.7, 48, 'Cello'), row(10.7, 14.8, 48, 'Cello')];
    const { rows: out, report } = run(rows);
    expect(out).toEqual([row(0, 14.8, 48, 'Cello')]);
    expect(report.merged).toBe(2);
  });

  it('merges a 0.6 s pair only with no onset at the join', () => {
    const rows = [row(10, 10.6, 48, 'Cello'), row(10.6, 11.2, 48, 'Cello')];
    expect(run(rows, { onsets: [3, 10.6, 20] }).rows).toHaveLength(2);
    expect(run(rows, { onsets: [3, 10.55, 20] }).rows).toHaveLength(2);       // within 0.08 s
    const free = run(rows, { onsets: [3, 10.5, 10.7, 20] });                  // just outside it, both sides
    expect(free.rows).toEqual([row(10, 11.2, 48, 'Cello')]);
    expect(free.report.merged).toBe(1);
    expect(run(rows).rows).toHaveLength(1);
  });

  it('does not merge a pair under 0.5 s', () => {
    expect(run([row(10, 10.4, 48, 'Cello'), row(10.4, 13, 48, 'Cello')]).rows).toHaveLength(2);
  });

  it('does not merge a gap of 0.03 s', () => {
    const { rows: out, report } = run([row(0, 2, 48, 'Cello'), row(2.03, 4, 48, 'Cello')]);
    expect(out).toHaveLength(2);
    expect(report.merged).toBe(0);
  });

  it('does not merge across lanes or pitches', () => {
    const rows = [row(0, 2, 60, 'Violin'), row(2, 4, 60, 'Viola'), row(4, 6, 62, 'Viola')];
    const { rows: out, report } = run(rows);
    expect(out).toEqual(rows);
    expect(report.merged).toBe(0);
  });

  it('measures each join on the notes as they came in', () => {
    // 1.2 s, then 0.7 s with an onset at its start, then 1.5 s. The first join stays although its right side grows to 2.2 s.
    const rows = [row(0, 1.2, 48, 'Cello'), row(1.2, 1.9, 48, 'Cello'), row(1.9, 3.4, 48, 'Cello')];
    const report = emptyReport();
    expect(mergeButting(rows, [1.2], report)).toEqual([row(0, 1.2, 48, 'Cello'), row(1.2, 3.4, 48, 'Cello')]);
    expect(report.merged).toBe(1);
  });
});

describe('cleanWarning', () => {
  const report = (o: Partial<CleanReport>): CleanReport => ({ ...emptyReport(), ...o });

  it('names each count it has and no zero ones', () => {
    const w = cleanWarning(report({ pastEnd: 148, merged: 12 }));
    expect(w).toMatch(/^cleaned MuScriptor's notes: /);
    expect(w).toContain('148 past the end');
    expect(w).toContain('12');
    expect(w).not.toContain('silence');
    expect(w).not.toContain('stuck');
    expect(w).not.toContain('moved');
  });

  it('has every kind of repair in words, on one line', () => {
    const w = cleanWarning({
      pastEnd: 1, clamped: 2, stuckChunks: 3, stuckDropped: 4, stuckCollapsed: 5, silent: 6, moved: { 'Viola>Violin': 7, 'Cello>Viola': 8 },
      laneDupes: 9, stringDupes: 10, windDupes: 11, merged: 12,
    })!;
    for (const s of ['1 past the end', '2 ', '3 stuck', '4 ', '5 ', '6 in silence', '15 moved', '9 ', '10 ', '11 ', '12 ']) expect(w).toContain(s);
    expect(w).not.toContain('\n');
  });

  it('is null when nothing changed', () => {
    expect(cleanWarning(emptyReport())).toBeNull();
    expect(cleanWarning(report({ moved: {} }))).toBeNull();
  });
});
