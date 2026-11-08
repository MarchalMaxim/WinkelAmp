import { describe, expect, it } from 'vitest';
import { analyzeSong } from '../src/audio/song-analysis';
import { buildPack } from '../src/studio/pack/build';
import { validatePack } from '../src/studio/pack/pack';

/** 2 s silence, 8 s of decaying 220/330/440 Hz tones every 0.5 s, 2 s silence (44.1 kHz). */
function signal(): Float32Array {
  const sr = 44100;
  const pcm = new Float32Array(12 * sr);
  const freqs = [220, 330, 440];
  for (let k = 0; k < 16; k++) {
    const t0 = 2 + k * 0.5, f = freqs[k % 3];
    const i0 = Math.round(t0 * sr);
    for (let i = 0; i < 0.5 * sr; i++) {
      const t = i / sr;
      pcm[i0 + i] += 0.5 * Math.exp(-t * 6) * Math.sin(2 * Math.PI * f * t) * Math.min(1, t / 0.002);
    }
  }
  return pcm;
}

const finiteDeep = (x: unknown): boolean =>
  typeof x === 'number' ? Number.isFinite(x) : Array.isArray(x) ? x.every(finiteDeep) : x && typeof x === 'object' ? Object.values(x).every(finiteDeep) : true;

describe('analyzeSong', () => {
  const progress: number[] = [];
  const a = analyzeSong(signal(), 44100, (f) => progress.push(f));

  it('spans the whole recording with contiguous sections', () => {
    expect(a.duration).toBeCloseTo(12, 2);
    expect(a.sections[0].start).toBe(0);
    expect(a.sections[a.sections.length - 1].end).toBe(a.duration);
    for (let i = 1; i < a.sections.length; i++) expect(a.sections[i].start).toBe(a.sections[i - 1].end);
  });

  it('keeps loudness every 0.1 s, silent where the recording is', () => {
    expect(a.loudness.hop).toBe(0.1);
    expect(a.loudness.values.length).toBe(120);
    for (const v of a.loudness.values) expect(v >= 0 && v <= 1).toBe(true);
    const head = a.loudness.values.slice(0, 15);
    expect(head.reduce((s, v) => s + v, 0) / head.length).toBeLessThan(0.05);
  });

  it('finds the attacks, and none in the leading silence', () => {
    expect(a.onsets.length).toBeGreaterThanOrEqual(10);
    for (const o of a.onsets) expect(o.t).toBeGreaterThanOrEqual(1.8);
  });

  it('keeps beats sorted inside the song, and nothing is NaN', () => {
    for (let i = 1; i < a.beats.length; i++) expect(a.beats[i]).toBeGreaterThan(a.beats[i - 1]);
    for (const b of a.beats) expect(b >= 0 && b <= 12).toBe(true);
    expect(finiteDeep(a)).toBe(true);
  });

  it('makes one silent section of an all-silent recording, with nothing NaN', () => {
    const s = analyzeSong(new Float32Array(5 * 44100), 44100);
    expect(finiteDeep(s)).toBe(true);
    expect(s.sections).toEqual([{ start: 0, end: 5, novelty: 0 }]);
    expect(s.loudness.values).toEqual(new Array(50).fill(0));
    expect(s.onsets).toEqual([]);
    expect(s.melody).toEqual([]);
    const p = buildPack({
      id: 'silence', title: 'Silence', audio: 'audio.wav', source: { name: 's.wav', bytes: 1, sha1: '0'.repeat(40) },
      analysis: s, notes: null, by: 'ingest', at: 'now',
    });
    expect(validatePack(p)).toEqual([]);
    expect(p.quality.warnings.join()).toMatch(/no notes found/);
    // The energy lane comes along, silent, as long as loudness, and is the pack's last key (where augment-pack puts it).
    expect(s.energy!.momentary).toEqual(new Array(50).fill(-90));
    expect(p.energy!.shortTerm).toEqual(new Array(50).fill(-90));
    expect(Object.keys(p).at(-1)).toBe('energy');
  });

  it('reports progress up to 1, never backwards', () => {
    for (let i = 1; i < progress.length; i++) expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
    expect(progress[progress.length - 1]).toBe(1);
  });
});
