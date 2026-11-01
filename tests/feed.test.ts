/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyFeatures, type Features } from '../src/audio/features';
import { fingerprint } from '../src/audio/fingerprint';
import type { StudyScore } from '../src/audio/studies';
import { neutralDescriptors } from '../src/character/types';
import { createCorpus, findByStudy } from '../src/stage/corpus';
import { SongFeed } from '../src/stage/feed';
import type { MelodyNote, Script, SongData } from '../src/stage/types';

const HOP = 1 / 60;
const mags = new Float32Array(2049);
const d = neutralDescriptors();
const f = emptyFeatures();

const note = (start: number, end: number, midi: number): MelodyNote => ({ start, end, midi, strength: 0.8, confidence: 0.9 });

function songData(over: Partial<SongData> = {}): SongData {
  return {
    version: 1,
    id: 'test',
    duration: 10,
    fingerprint: { version: 1, duration: 10, hop: 0.1, bits: '' },
    melody: { notes: [], contour: { hop: 0.01, midi: [] } },
    beats: [],
    onsets: [],
    sections: [],
    drops: [],
    chords: [],
    mood: [],
    ...over,
  };
}

/** Frames every 1/60 s over [from, to); returns each frame with its time. */
function play(feed: SongFeed, from: number, to: number) {
  const out: { t: number; fr: ReturnType<SongFeed['frame']> }[] = [];
  for (let i = 0; from + i * HOP < to; i++) {
    const t = from + i * HOP;
    out.push({ t, fr: feed.frame(t, mags, f, d) });
  }
  return out;
}

describe('SongFeed.fromData', () => {
  const a = note(1.0, 1.5, 60);
  const b = note(1.5, 2.2, 64);
  const c = note(3.0, 3.6, 67);
  const data = songData({ melody: { notes: [a, b, c], contour: { hop: 0.01, midi: [] } } });

  it('returns the sounding note, with noteOn only on the first frame at/after its start', () => {
    const feed = SongFeed.fromData(data);
    const frames = play(feed, 0.5, 2.5);
    const inA = frames.filter((x) => x.t >= 1.0 && x.t < 1.5);
    expect(inA.length).toBeGreaterThan(20);
    for (const x of inA) {
      expect(x.fr.melody.note).toBe(a);
      expect(x.fr.melody.voiced).toBe(true);
      expect(x.fr.melody.pitch).toBe(60);
    }
    expect(inA[0].fr.melody.noteOn).toBe(true);
    expect(inA.slice(1).every((x) => !x.fr.melody.noteOn)).toBe(true);
    // Exactly one noteOn per note, on its first frame.
    const ons = frames.filter((x) => x.fr.melody.noteOn);
    expect(ons.map((x) => x.fr.melody.note)).toEqual([a, b]);
    expect(ons[1].t).toBeGreaterThanOrEqual(1.5);
    expect(ons[1].t - 1.5).toBeLessThan(HOP);
    // Between notes: unvoiced, no note.
    const gap = feed.frame(2.6, mags, f, d).melody;
    expect(gap.voiced).toBe(false);
    expect(gap.note).toBeNull();
    expect(Number.isNaN(gap.pitch)).toBe(true);
    expect(gap.salience).toBe(0);
  });

  it('after a seek (> 0.25 s either way) fires noteOn only for a note that began within 1/60 s', () => {
    const feed = SongFeed.fromData(data);
    play(feed, 0.5, 1.2);
    // Forward into the middle of c: no noteOn (it began 0.2 s ago).
    let m = feed.frame(3.2, mags, f, d).melody;
    expect(m.note).toBe(c);
    expect(m.noteOn).toBe(false);
    // Backward to just after a began: noteOn.
    m = feed.frame(1.01, mags, f, d).melody;
    expect(m.note).toBe(a);
    expect(m.noteOn).toBe(true);
    // Forward to just after c began: noteOn.
    m = feed.frame(3.005, mags, f, d).melody;
    expect(m.note).toBe(c);
    expect(m.noteOn).toBe(true);
    // Backward into the middle of b: no noteOn, and playing on from there fires nothing until c.
    m = feed.frame(1.8, mags, f, d).melody;
    expect(m.note).toBe(b);
    expect(m.noteOn).toBe(false);
    const ons = play(feed, 1.8 + HOP, 3.1).filter((x) => x.fr.melody.noteOn);
    expect(ons.map((x) => x.fr.melody.note)).toEqual([c]);
  });

  it('never fires a note twice through pause or small backward jitter', () => {
    const feed = SongFeed.fromData(data);
    const ts = [0.98, 1.01, 1.01, 1.01, 0.995, 1.0, 1.02, 1.03, 1.012, 1.05];
    const ons = ts.filter((t) => feed.frame(t, mags, f, d).melody.noteOn);
    expect(ons).toEqual([1.01]);
  });

  it('reads the pitch from the contour where there is one', () => {
    const midi: (number | null)[] = Array.from({ length: 300 }, (_, i) => (i >= 100 && i < 130 ? 60.3 : null));
    const feed = SongFeed.fromData(songData({ melody: { notes: [a], contour: { hop: 0.01, midi } } }));
    expect(feed.frame(1.2, mags, f, d).melody.pitch).toBeCloseTo(60.3, 5);
    // Inside the note but past the contour's voiced run: the note's pitch.
    expect(feed.frame(1.4, mags, f, d).melody.pitch).toBe(60);
  });

  it('beat phase is 0 at beat times and 0.5 midway; hit on the frame a beat lands', () => {
    const feed = SongFeed.fromData(songData({ beats: [1, 1.5, 2, 2.5], onsets: [{ t: 1.5, s: 0.9 }] }));
    const frames = play(feed, 0.9, 2.6);
    const hits = frames.filter((x) => x.fr.beat.hit).map((x) => x.t);
    expect(hits).toHaveLength(4);
    for (const [i, t] of hits.entries()) {
      expect(t).toBeGreaterThanOrEqual(1 + 0.5 * i);
      expect(t - (1 + 0.5 * i)).toBeLessThan(HOP);
    }
    // A strong onset on the beat gives it its strength.
    expect(frames.find((x) => x.t === hits[1])!.fr.beat.strength).toBeCloseTo(0.9, 5);
    const seek = SongFeed.fromData(songData({ beats: [1, 1.5, 2, 2.5] }));
    expect(seek.frame(1.5, mags, f, d).beat.phase).toBeCloseTo(0, 5);
    expect(seek.frame(1.75, mags, f, d).beat.phase).toBeCloseTo(0.5, 5);
    expect(seek.frame(2, mags, f, d).beat.phase).toBeCloseTo(0, 5);
    expect(seek.frame(2.125, mags, f, d).beat.phase).toBeCloseTo(0.25, 5);
    // A seek into the middle of a beat is not a hit.
    expect(seek.frame(1.25, mags, f, d).beat.hit).toBe(false);
  });

  it('emits onset events once each, at the melody pitch when a note starts there', () => {
    const feed = SongFeed.fromData(songData({ melody: { notes: [a], contour: { hop: 0.01, midi: [] } }, onsets: [{ t: 1.0, s: 0.6 }, { t: 2.0, s: 0.3 }] }));
    const evs = play(feed, 0.9, 2.2).flatMap((x) => x.fr.events);
    expect(evs).toHaveLength(2);
    expect(evs[0].onset).toBe(true);
    expect(evs[0].note).toBe(0); // C
    expect(evs[0].height).toBeCloseTo((60 - 24) / 84, 5); // at the tune's pitch
    expect(evs[1].height).toBeCloseTo(d.register, 5); // unpitched: where the music sits
    expect(evs[1].note).toBe(-1);
    expect(evs[0].strength).toBeGreaterThan(evs[1].strength);
  });
});

describe('SongFeed.fromScore', () => {
  const score: StudyScore = {
    length: 4,
    events: [
      { t: 0.5, v: 'acc', m: 90, vel: 0.5, d: 0.4 },
      { t: 0.5, v: 'mel', m: 72, vel: 0.8, d: 0.5 },
      { t: 1.0, v: 'bass', m: 36, vel: 0.9, d: 1 },
      { t: 2.0, v: 'mel', m: 74, vel: 0.6, d: 1 },
    ],
  };

  it('uses only the melody voices for the melody', () => {
    const feed = SongFeed.fromScore(score, ['mel']);
    const m = feed.frame(0.6, mags, f, d).melody;
    expect(m.voiced).toBe(true);
    expect(m.pitch).toBe(72);
    expect(m.note).toMatchObject({ start: 0.5, end: 1.0, midi: 72 });
    // The bass at 1.0 is not melody: the line is silent until 2.0.
    expect(feed.frame(1.2, mags, f, d).melody.voiced).toBe(false);
    expect(feed.frame(2.5, mags, f, d).melody.pitch).toBe(74);
  });

  it('wraps at score.length: the next loop plays the same notes, each fired once', () => {
    const feed = SongFeed.fromScore(score, ['mel']);
    const frames = play(feed, 0, 8.7);
    const ons = frames.filter((x) => x.fr.melody.noteOn).map((x) => [Math.round(x.t * 100) / 100, x.fr.melody.pitch]);
    // Starts at 0.5 and 2.0, then 4.5 and 6.0, then 8.5 (frame times are k/60, so the first frame at/after).
    expect(ons.map((x) => x[1])).toEqual([72, 74, 72, 74, 72]);
    const at = ons.map((x) => x[0]);
    for (const [i, want] of [0.5, 2.0, 4.5, 6.0, 8.5].entries()) {
      expect(at[i]).toBeGreaterThanOrEqual(want - 0.005);
      expect(at[i]).toBeLessThan(want + HOP + 0.005);
    }
    expect(feed.frame(4.6 + 4, mags, f, d).melody.pitch).toBe(72);
  });

  it('onset events and beats come from every voice, once per loop', () => {
    const feed = SongFeed.fromScore(score, ['mel']);
    const frames = play(feed, 0, 4);
    const evs = frames.flatMap((x) => x.fr.events);
    // Clusters at 0.5 (top 90), 1.0 (bass) and 2.0.
    expect(evs).toHaveLength(3);
    expect(evs.map((e) => e.note)).toEqual([90 % 12, 0, 74 % 12]);
    expect(frames.filter((x) => x.fr.beat.hit).length).toBeGreaterThan(0);
  });
});

describe('SongFeed.live', () => {
  it('is unvoiced in silence, hits on an onset, and leaves events to the character engine', () => {
    const feed = SongFeed.live(48000);
    const quiet = feed.frame(1, mags, f, d);
    expect(quiet.melody.voiced).toBe(false);
    expect(quiet.beat.hit).toBe(false);
    expect(quiet.events).toEqual([]);
    const onset: Features = { ...emptyFeatures(), onset: true, onsetStrength: 0.7 };
    const hit = feed.frame(1 + HOP, mags, onset, d);
    expect(hit.beat.hit).toBe(true);
    expect(hit.beat.strength).toBeCloseTo(0.7, 5);
    expect(hit.beat.phase).toBe(0);
    // The same frame read again (no time passed) is not a second hit.
    expect(feed.frame(1 + HOP, mags, onset, d).beat.hit).toBe(false);
    expect(feed.frame(1 + 2 * HOP, mags, f, d).beat.phase).toBeGreaterThan(0);
  });
});

// ---- Corpus ----------------------------------------------------------------------------

/** A seeded tone sequence (one random partial pair every 0.2 s) at 16 kHz. */
function signal(seed: number, seconds: number, rate = 16000) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = new Float32Array(Math.round(seconds * rate));
  for (let k = 0; k * 0.2 < seconds; k++) {
    const f1 = 200 + rnd() * 2500, f2 = 300 + rnd() * 3000, a = 0.2 + 0.3 * rnd();
    const i0 = Math.round(k * 0.2 * rate), i1 = Math.min(out.length, Math.round((k + 1) * 0.2 * rate));
    for (let i = i0; i < i1; i++) out[i] = a * (Math.sin((2 * Math.PI * f1 * i) / rate) + 0.5 * Math.sin((2 * Math.PI * f2 * i) / rate));
  }
  return out;
}

function script(id: string, match: Script['match'], duration = 20): Script {
  return { version: 1, id, title: id, duration, match, scenes: { a: { elements: [] } }, timeline: [{ at: 0, scene: 'a' }] };
}

describe('corpus', () => {
  afterEach(() => vi.restoreAllMocks());

  it('finds a study script by id and seed', () => {
    const basalt = script('basalt', { kind: 'study', study: 'basalt', seed: 3 }, 80);
    const c = createCorpus({ '/corpus/basalt.json': basalt, '/corpus/song.json': script('song', { kind: 'recording' }) }, {});
    expect(c.findByStudy('basalt', 3)?.script).toBe(basalt);
    expect(c.findByStudy('basalt', 4)).toBeNull();
    expect(c.findByStudy('ember', 3)).toBeNull();
  });

  it('skips invalid scripts with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = { ...script('mist', { kind: 'study', study: 'mist', seed: 11 }), version: 2 };
    const misnamed = script('other', { kind: 'study', study: 'mist', seed: 11 });
    const c = createCorpus({ '/corpus/mist.json': bad, '/corpus/mist-2.json': misnamed }, {});
    expect(c.findByStudy('mist', 11)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('the bundled corpus answers for basalt only when corpus/basalt.json exists', () => {
    const hit = findByStudy('basalt', 3);
    // Asked of the bundler independently of corpus.ts: is the file there?
    if (Object.keys(import.meta.glob('/corpus/basalt.json')).length) {
      expect(hit?.script.match).toMatchObject({ kind: 'study', study: 'basalt' });
    } else {
      expect(hit).toBeNull();
    }
  });

  it('finds a recording by fingerprint, loading only candidates of about the same duration', async () => {
    const rate = 16000;
    const fpA = fingerprint(signal(7, 20, rate), rate);
    const fpB = fingerprint(signal(8, 20, rate), rate);
    const load = vi.fn(async () => songData({ id: 'song-a', duration: 20, fingerprint: fpA }));
    const far = vi.fn(async () => songData({ id: 'long', duration: 30, fingerprint: fpA }));
    const a = script('song-a', { kind: 'recording' });
    const c = createCorpus(
      { '/corpus/song-a.json': a, '/corpus/long.json': script('long', { kind: 'recording' }, 30) },
      { '/corpus/song-a.data.json': load, '/corpus/long.data.json': far },
    );
    const hit = await c.findByFingerprint(fpA);
    expect(hit?.script).toBe(a);
    expect((await hit!.data!()).id).toBe('song-a');
    expect(await c.findByFingerprint(fpB)).toBeNull();
    expect(far).not.toHaveBeenCalled();
  });
});
