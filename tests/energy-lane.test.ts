// The zero-lag energy lane (src/audio/energy.ts): the K-weighting, where its moments land, the pack field, the
// backfill (scripts/node/augment.ts) and the 0..1 curve with its lab copy (lab/layers/lines.js WA.energyCurve).
/// <reference types="node" />
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { augmentSong, AUGMENT_RATE, BACKUP } from '../scripts/node/augment';
import { loadLayers } from '../scripts/node/layers';
import { apiMiddleware } from '../scripts/studio-api';
import { LOUD_HI, LOUD_LO, REF_LOUDNESS } from '../src/audio/descriptors';
import { energyLane, kWeight, kWeightingFilters, SILENCE_DB, type Biquad } from '../src/audio/energy';
import { loudnessLength } from '../src/audio/song-analysis';
import { validatePack } from '../src/studio/pack/pack';
import { ENERGY_GATE, energyCorrection, energyCurve } from '../src/widgets/curves';

const WA = loadLayers();
const tmp = mkdtempSync(join(tmpdir(), 'wa-energy-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** |H(e^jω)| of a biquad in dB. */
function gainDb(f: Biquad, freq: number, sr: number): number {
  const w = (2 * Math.PI * freq) / sr;
  const re = (c: number[]) => c[0] + c[1] * Math.cos(-w) + c[2] * Math.cos(-2 * w);
  const im = (c: number[]) => c[1] * Math.sin(-w) + c[2] * Math.sin(-2 * w);
  return 10 * Math.log10((re(f.b) ** 2 + im(f.b) ** 2) / (re(f.a) ** 2 + im(f.a) ** 2));
}
const kGain = (freq: number, sr = 48000) => { const k = kWeightingFilters(sr); return gainDb(k.shelf, freq, sr) + gainDb(k.highPass, freq, sr); };
const sine = (freq: number, amp: number, seconds: number, sr: number, from = 0) =>
  Float32Array.from({ length: Math.round(seconds * sr) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * (i + from)) / sr));
const argmax = (v: readonly number[]) => v.reduce((b, x, i) => (x > v[b] ? i : b), 0);

describe('K-weighting', () => {
  it('gives BS.1770 Annex 1\'s coefficients at 48 kHz', () => {
    const { shelf, highPass } = kWeightingFilters(48000);
    const near = (a: number[], b: number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 7));
    near(shelf.b, [1.53512485958697, -2.69169618940638, 1.19839281085285]);
    near(shelf.a, [1, -1.69065929318241, 0.73248077421585]);
    near(highPass.b, [1, -2, 1]);
    near(highPass.a, [1, -1.99004745483398, 0.99007225036621]);
  });

  it('about 0 dB at 1 kHz (+0.69, what BS.1770\'s -0.691 cancels), +4 dB at 10 kHz, strongly cut at 20 Hz; at any rate', () => {
    for (const sr of [44100, 48000, 22050]) {
      expect(kGain(997, sr)).toBeGreaterThan(0.5); expect(kGain(997, sr)).toBeLessThan(0.85);
      expect(Math.abs(kGain(10000, sr) - 4)).toBeLessThan(0.5);
      expect(kGain(20, sr)).toBeLessThan(-10);
    }
  });

  it('reads a full-scale 997 Hz sine at -3.01, as BS.1770 says', () => {
    const sr = 44100, lane = energyLane(sine(997, 1, 4, sr), sr);
    expect(lane.momentary[20]).toBeCloseTo(-3.0, 1);
    expect(lane.shortTerm[20]).toBeCloseTo(-3.0, 1);
    // And the filtered signal itself agrees: mean square of the K-weighted sine, BS.1770's dB.
    const k = kWeight(sine(997, 1, 1, sr), sr).subarray(sr / 2);
    let s = 0; for (const x of k) s += x * x;
    expect(-0.691 + 10 * Math.log10(s / k.length)).toBeCloseTo(-3.01, 1);
  });
});

describe('the energy lane', () => {
  const sr = 8000;

  it('has loudnessLength values, rounded to 0.1 dB, finite, silence at the floor', () => {
    for (const seconds of [0.05, 1, 12, 12.34]) {
      const lane = energyLane(new Float32Array(Math.round(seconds * sr)), sr);
      expect(lane.momentary.length).toBe(loudnessLength(seconds));
      expect(lane.shortTerm.length).toBe(loudnessLength(seconds));
      expect(lane.momentary.every((v) => v === SILENCE_DB)).toBe(true);
    }
    const lane = energyLane(sine(440, 0.3, 3, sr), sr);
    for (const v of [...lane.momentary, ...lane.shortTerm]) { expect(Number.isFinite(v)).toBe(true); expect(Math.round(v * 10) / 10).toBe(v); }
    expect(energyLane(sine(440, 0.3, 3, sr), sr, 40).momentary.length).toBe(40);   // a given count, past the audio: silence
    expect(energyLane(sine(440, 0.3, 3, sr), sr, 40).momentary[39]).toBe(SILENCE_DB);
  });

  it('puts a crescendo\'s peak where it is, within 0.1 s, in both lanes', () => {
    // 1 kHz swelling to 6.03 s, then fading: the peak moment is sample 60 (centred on 6.05 s).
    const peak = 6.03, len = 12;
    const pcm = Float32Array.from({ length: len * sr }, (_, i) => { const t = i / sr; return Math.exp(-Math.abs(t - peak) / 1.5) * Math.sin(2 * Math.PI * 1000 * t); });
    const lane = energyLane(pcm, sr);
    for (const v of [lane.momentary, lane.shortTerm]) expect(Math.abs((argmax(v) + 0.5) * 0.1 - peak)).toBeLessThanOrEqual(0.1);
  });

  it('drops within 0.3 s of a cut to silence (momentary); the old lane\'s lag is gone', () => {
    const cut = 5.4, pcm = new Float32Array(10 * sr);
    pcm.set(sine(500, 0.5, cut, sr));
    const lane = energyLane(pcm, sr), before = lane.momentary[40];
    // The first sample whose moment is 20 dB below the music.
    const first = lane.momentary.findIndex((v, i) => i > 40 && v < before - 20);
    expect((first + 0.5) * 0.1 - cut).toBeGreaterThan(0);
    expect((first + 0.5) * 0.1 - cut).toBeLessThanOrEqual(0.3);
    // A moment of music is never read as silence: the window centred just before the cut still holds the sine.
    expect(lane.momentary[53]).toBeGreaterThan(before - 4);
  });
});

/** A pack that validates, `seconds` long. */
const fakePack = (id: string, seconds: number, extra: Record<string, unknown> = {}) => ({
  version: 1, id, title: id, audio: 'audio.wav', duration: seconds,
  source: { name: `${id}.wav`, bytes: 10, sha1: 'a'.repeat(40) },
  notes: [[1, 2, 60, 80]], notesFrom: 'file', transcriber: null,
  quality: { onsetCoverage: 1, notesPerMinute: 4, warnings: ['x'] },
  sections: [{ start: 0, end: seconds, novelty: 0 }], beats: [0.5, 1.5], loudness: { hop: 0.1, values: new Array(loudnessLength(seconds)).fill(0.25) },
  harmony: [], made: { by: 'ingest', at: '2026-10-31T00:00:00.000Z' }, ...extra,
});

describe('pack.energy', () => {
  const lane = (n: number, v = -20) => ({ hop: 0.1, momentary: new Array(n).fill(v), shortTerm: new Array(n).fill(v) });
  it('is optional, any version; lengths must equal loudness and values be finite', () => {
    expect(validatePack(fakePack('a', 3))).toEqual([]);
    expect(validatePack(fakePack('a', 3, { energy: lane(30) }))).toEqual([]);
    expect(validatePack(fakePack('a', 3, { version: 2, energy: lane(30) }))).toEqual([]);
    expect(validatePack(fakePack('a', 3, { energy: lane(29) })).join()).toMatch(/energy\.momentary: 29 values/);
    expect(validatePack(fakePack('a', 3, { energy: { ...lane(30), shortTerm: [...lane(29).shortTerm, null] } })).join()).toMatch(/energy\.shortTerm: not all finite/);
    expect(validatePack(fakePack('a', 3, { energy: { ...lane(30), hop: 0.05 } })).join()).toMatch(/energy: not/);
    expect(validatePack(fakePack('a', 3, { energy: lane(30, Infinity) })).join()).toMatch(/not all finite/);
  });

  it('the studio dev API lists a pack with energy and one without, both without error', async () => {
    const songs = join(tmp, 'api-songs'), shows = join(tmp, 'api-shows');
    mkdirSync(join(songs, 'with'), { recursive: true }); mkdirSync(join(songs, 'without')); mkdirSync(shows);
    writeFileSync(join(songs, 'with', 'pack.json'), JSON.stringify(fakePack('with', 3, { energy: lane(30) })));
    writeFileSync(join(songs, 'without', 'pack.json'), JSON.stringify(fakePack('without', 3)));
    const mw = apiMiddleware({ songs, shows });
    const body = await new Promise<string>((resolve) => {
      const req = Object.assign(new EventEmitter(), { method: 'GET', url: '/api/songs', headers: {}, socket: { remoteAddress: '127.0.0.1' } });
      const chunks: Buffer[] = [];
      const res = {
        statusCode: 200, headers: {} as Record<string, unknown>, setHeader() {}, writeHead() { return this; },
        write(c: string | Buffer) { chunks.push(Buffer.from(c)); return true; },
        end(c?: string | Buffer) { if (c) chunks.push(Buffer.from(c)); resolve(Buffer.concat(chunks).toString('utf8')); },
        on() { return this; }, once() { return this; }, emit() { return true; },
      };
      mw(req as never, res as never, () => resolve('next'));
      setTimeout(() => req.emit('end'), 0);
    });
    const list = JSON.parse(body).songs as { id: string; error?: string }[];
    expect(list.map((s) => [s.id, s.error])).toEqual([['with', undefined], ['without', undefined]]);
  });
});

describe('the backfill (augment-pack)', () => {
  const seconds = 4;
  const decode = (): Float32Array => sine(997, 0.5, seconds, AUGMENT_RATE);
  const make = (id: string, pack: object, text = JSON.stringify(pack)) => {
    const dir = join(tmp, 'songs', id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'pack.json'), text);
    writeFileSync(join(dir, 'audio.wav'), 'not read: decode is the test\'s');
    return dir;
  };

  it('adds only the key energy, last, and keeps a backup of the original', () => {
    const before = JSON.stringify(fakePack('one', seconds));
    const dir = make('one', {}, before);
    expect(augmentSong(dir, decode).status).toBe('done');
    const after = readFileSync(join(dir, 'pack.json'), 'utf8');
    expect(readFileSync(join(dir, BACKUP), 'utf8')).toBe(before);
    expect(after.startsWith(before.slice(0, -1) + ',"energy":{')).toBe(true);
    const p = JSON.parse(after);
    expect(p.energy.momentary.length).toBe(loudnessLength(seconds));
    expect(p.energy.momentary[20]).toBeCloseTo(-9.0, 0);   // half scale: -3 − 6
    expect(validatePack(p)).toEqual([]);
  });

  it('skips a pack that has energy, redoes it with force, and never replaces the first backup', () => {
    const dir = join(tmp, 'songs', 'one');
    const backup = readFileSync(join(dir, BACKUP), 'utf8');
    expect(augmentSong(dir, decode).status).toBe('skipped');
    const quiet = (): Float32Array => sine(997, 0.05, seconds, AUGMENT_RATE);
    expect(augmentSong(dir, quiet, { force: true }).status).toBe('done');
    expect(readFileSync(join(dir, BACKUP), 'utf8')).toBe(backup);
    const p = JSON.parse(readFileSync(join(dir, 'pack.json'), 'utf8'));
    expect(p.energy.momentary[20]).toBeCloseTo(-29.0, 0);
    expect(JSON.stringify({ ...p, energy: undefined })).toBe(JSON.stringify({ ...JSON.parse(backup), energy: undefined }));
  });

  it('keeps an indented pack indented, with its newline', () => {
    const text = JSON.stringify(fakePack('two', seconds), null, 2) + '\n';
    const dir = make('two', {}, text);
    expect(augmentSong(dir, decode).status).toBe('done');
    const after = readFileSync(join(dir, 'pack.json'), 'utf8');
    expect(after.startsWith(text.slice(0, -3))).toBe(true);
    expect(after.endsWith('}\n')).toBe(true);
  });

  it('leaves alone a pack it cannot prove it keeps, a broken one, one whose audio is longer or missing', () => {
    const odd = make('odd', {}, JSON.stringify(fakePack('odd', seconds)).replace('"title"', ' "title"'));
    expect(augmentSong(odd, decode)).toMatchObject({ status: 'failed', why: expect.stringMatching(/not written the way/) });
    const broken = make('broken', fakePack('broken', seconds, { version: 9 }));
    expect(augmentSong(broken, decode).status).toBe('failed');
    const long = make('long', fakePack('long', 3));
    expect(augmentSong(long, decode)).toMatchObject({ status: 'failed', why: expect.stringMatching(/decoded 4\.000 s/) });
    const none = make('none', fakePack('none', seconds));
    rmSync(join(none, 'audio.wav'));
    expect(augmentSong(none, decode).status).toBe('failed');
    for (const d of [odd, broken, long, none]) expect(existsSync(join(d, BACKUP))).toBe(false);
    expect(augmentSong(join(tmp, 'songs', 'nothing-here'), decode).status).toBe('skipped');
  });
});

describe('energyCurve', () => {
  it('uses the loudness lane\'s dB map, the same in the lab', () => {
    expect(WA.LOUD_DB).toEqual({ lo: LOUD_LO, hi: LOUD_HI, ref: REF_LOUDNESS, gate: ENERGY_GATE });
    // a piece whose level is −20 (the rest silence, under the gate or under the level by more than 15 dB): no
    // correction, so the plain map shows
    const plain = [-50, -31, -12, -5, -90, NaN, ...Array<number>(10000).fill(-20)];
    expect(Math.abs(energyCorrection({ hop: 0.1, momentary: plain, shortTerm: [] }))).toBeLessThan(0.02);
    expect(energyCurve({ energy: { hop: 0.1, momentary: plain, shortTerm: [] } })!.values.slice(0, 6).map((v) => Math.round(v * 100) / 100)).toEqual([0, 0.5, 1, 1, 0, 0]);
    expect(energyCurve({})).toBeNull();
    expect(energyCurve(null)).toBeNull();
    expect(WA.energyCurve({})).toBeNull();
    expect(energyCurve({ energy: { hop: 0.1, momentary: [-20], shortTerm: [] } }, 'shortTerm')).toBeNull();
  });

  it('pulls loud masters down and quiet ones up, halfway to −20, at most 6 dB', () => {
    const lane = (db: number, n = 50) => ({ hop: 0.1, momentary: [...Array<number>(n).fill(db), -90, NaN], shortTerm: Array<number>(n + 2).fill(db) });
    expect(energyCorrection(lane(-14))).toBeCloseTo(-3, 9);
    expect(energyCorrection(lane(-30))).toBeCloseTo(5, 9);
    expect(energyCorrection(lane(-2))).toBe(-6);
    expect(energyCorrection(lane(-45))).toBe(6);
    // all silence, or nothing above the gate: no correction, and no NaN
    expect(energyCorrection(lane(-90))).toBe(0);
    expect(energyCorrection({ hop: 0.1, momentary: [NaN, -70], shortTerm: [] })).toBe(0);
    // passages more than 15 dB under the level do not drag it down
    expect(energyCorrection({ hop: 0.1, momentary: [...Array<number>(50).fill(-14), ...Array<number>(200).fill(-40)], shortTerm: [] })).toBeCloseTo(-3, 9);
    // the momentary lane's correction applies to the short-term curve too
    expect(energyCurve({ energy: lane(-14) }, 'shortTerm')!.values[0]).toBeCloseTo((-14 - 3 - LOUD_LO) / (LOUD_HI - LOUD_LO), 9);
    expect(energyCurve({ energy: lane(-30) })!.values[0]).toBeCloseTo((-30 + 5 - LOUD_LO) / (LOUD_HI - LOUD_LO), 9);
    expect(energyCurve({ energy: lane(-90) })!.values).toEqual(Array<number>(52).fill(0));
    for (const db of [-90, -45, -30, -14, -2]) expect(Object.is(WA.energyCorrection(lane(db)), energyCorrection(lane(db)))).toBe(true);
  });

  it('studio and lab give the same bits on random lanes', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 20; k++) {
      const n = 1 + Math.floor(rnd() * 400);
      const pack = { energy: { hop: 0.1, momentary: Array.from({ length: n }, () => Math.round((rnd() * 100 - 95) * 10) / 10 + (k % 5) * 6 - 12), shortTerm: Array.from({ length: n }, () => rnd() * 80 - 70) } };
      for (const which of ['momentary', 'shortTerm'] as const) {
        const a = energyCurve(pack, which)!, b = WA.energyCurve(pack, which)!;
        expect(b.hop).toBe(a.hop);
        expect(Object.is(b.values.length, a.values.length)).toBe(true);
        a.values.forEach((v, i) => expect(Object.is(b.values[i], v)).toBe(true));
      }
      expect(WA.energyCurve(pack)).toEqual(energyCurve(pack));
    }
  });
});
