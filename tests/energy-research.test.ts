import { describe, expect, it } from 'vitest';
import { bestLag, blockPower, centredDb, climaxes, follow, followPreset, pivotAt, relative, todayLevel, unitOfDb } from '../src/research/energy';
import type { Note } from '../src/widgets/types';

const HOP = 0.01;

describe('energy lanes (research demo)', () => {
  it('a centred window puts a crescendo peak where it is, with no lag', () => {
    // 20 s of noise whose amplitude climbs to a peak at 12 s and falls again.
    const sr = 8000, pcm = new Float32Array(20 * sr);
    let seed = 1;
    for (let i = 0; i < pcm.length; i++) {
      seed = (seed * 16807) % 2147483647;
      const t = i / sr, amp = 0.02 + 0.3 * Math.exp(-((t - 12) ** 2) / 8);
      pcm[i] = amp * ((seed / 2147483647) * 2 - 1);
    }
    const st = centredDb(blockPower(pcm, sr, HOP), HOP, 3);
    let at = 0;
    for (let i = 1; i < st.length; i++) if (st[i] > st[at]) at = i;
    expect(Math.abs(at * HOP - 12)).toBeLessThan(0.1);
  });

  it('the follower climbs fast and falls slowly', () => {
    const step = Float32Array.from({ length: 400 }, (_, i) => (i >= 100 && i < 200 ? 1 : 0));
    const y = follow(step, HOP, 0.05, 1);
    expect(y[130]).toBeGreaterThan(0.99);   // 0.3 s after the jump: there
    expect(y[230]).toBeGreaterThan(0.7);    // 0.3 s after the drop: still mostly there
  });

  it("today's level halves every 0.8 s after an attack and ignores a held note", () => {
    const notes: Note[] = [[1, 9, 60, 115]]; // one loud note held for 8 s
    const { level } = todayLevel(notes, 10, HOP);
    expect(level[Math.round(1.02 / HOP)]).toBeGreaterThan(0.95);
    expect(level[Math.round(1.8 / HOP)]).toBeCloseTo(0.5, 1);
    expect(level[Math.round(5 / HOP)]).toBeLessThan(0.05); // the note still sounds
  });

  it('bestLag finds a known delay', () => {
    const a = Float32Array.from({ length: 600 }, (_, i) => Math.sin(i / 17) + Math.sin(i / 41));
    const late = Float32Array.from({ length: 600 }, (_, i) => (i >= 15 ? a[i - 15] : a[0]));
    expect(bestLag(a, late, 0.1, 4).lag).toBeCloseTo(1.5, 5);
  });

  it('the follow preset stays between floor and 1 within the pivot budget', () => {
    const unit = Float32Array.from({ length: 6000 }, (_, i) => 0.5 + 0.4 * Math.sin(i / 300) + 0.05 * Math.sin(i / 7));
    const p = followPreset(unit, HOP, { start: 5, end: 55 }, { floor: 0.35, maxPivots: 24 });
    expect(p.length).toBeLessThanOrEqual(24);
    expect(p[0].t).toBeCloseTo(5, 1);
    for (const q of p) { expect(q.v).toBeGreaterThanOrEqual(0.35); expect(q.v).toBeLessThanOrEqual(1); }
    expect(pivotAt(p, 30)).toBeGreaterThanOrEqual(0.35);
  });

  it('climaxes ranks the big peak first and keeps them apart', () => {
    const unit = Float32Array.from({ length: 12000 }, (_, i) => {
      const t = i * HOP;
      return 0.2 + 0.7 * Math.exp(-((t - 90) ** 2) / 20) + 0.3 * Math.exp(-((t - 30) ** 2) / 20);
    });
    const c = climaxes(unit, HOP, { gap: 20, n: 2 });
    expect(c[0].t).toBeCloseTo(90, 0);
    expect(c[1].t).toBeCloseTo(30, 0);
  });

  it('relative loudness lifts a quiet passage that changes', () => {
    const unit = Float32Array.from({ length: 600 }, (_, i) => (i < 300 ? 0.1 + 0.05 * Math.sin(i / 5) : 0.9));
    const r = relative(unit, 0.1, 8, 0.5);
    let maxQuiet = 0;
    for (let i = 100; i < 200; i++) maxQuiet = Math.max(maxQuiet, r[i]);
    expect(maxQuiet).toBeGreaterThan(0.3);            // the quiet passage's own peaks register
    expect(r[500]).toBeGreaterThan(maxQuiet);         // and the loud one still wins
    expect(unitOfDb([-50, -12, -31])[2]).toBeCloseTo(0.5, 2);
  });
});
