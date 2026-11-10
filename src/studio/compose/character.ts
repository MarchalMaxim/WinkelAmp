/**
 * The character of each stretch of a song, from its attacks (the lab's chords): how loud, dense, low, fast and quiet it
 * is, each 0..1 and relative to the song's other stretches.
 */
import { groupChords } from '../../widgets/chords';
import type { Chord, Note } from '../../widgets/types';

export interface Character { loud: number; dense: number; low: number; fast: number; quiet: number }
export interface Span { start: number; end: number }
export const CHARACTER_WORDS: readonly (keyof Character)[] = ['loud', 'dense', 'low', 'fast', 'quiet'];

interface Raw { attacks: number; vel: number; rate: number; poly: number; lowShare: number }

/** Mid-rank percentile among `all`: (#below + (#equal − 1)/2) / (n − 1), so ties share the mean of their ranks; one value → 0.5. */
export function percentileRank(v: number, all: readonly number[]): number {
  if (all.length <= 1) return 0.5;
  let below = 0, equal = 0;
  for (const x of all) { if (x < v) below++; else if (x === v) equal++; }
  return (below + (equal - 1) / 2) / (all.length - 1);
}

function raw(chords: readonly Chord[], s: Span): Raw {
  // chords are sorted by t: binary search for the first at or after s.start
  let lo = 0, hi = chords.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (chords[m].t < s.start) lo = m + 1; else hi = m; }
  const vels: number[] = [];
  let notes = 0, low = 0;
  for (let i = lo; i < chords.length && chords[i].t < s.end; i++) {
    const c = chords[i];
    vels.push(c.vel);
    notes += c.notes.length;
    for (const n of c.notes) if (n.m < 50) low++;
  }
  if (!vels.length) return { attacks: 0, vel: 0, rate: 0, poly: 0, lowShare: 0 };
  vels.sort((a, b) => b - a);
  const top = vels.slice(0, Math.ceil(vels.length / 3));
  return {
    attacks: vels.length, vel: top.reduce((a, b) => a + b, 0) / top.length, rate: vels.length / Math.max(1e-9, s.end - s.start),
    poly: notes / vels.length, lowShare: notes ? low / notes : 0,
  };
}

/** Per span over groupChords(notes): vel = mean of the loudest third of attack velocities, rate = attacks/s, poly =
    notes per attack, lowShare = share of notes below MIDI 50. loud/fast/dense = percentile rank of vel/rate/poly among
    all the spans (one span → 0.5; a span without attacks is 0 whatever its rank); low = lowShare; quiet = (1 − loud)(1 − fast). */
export function sectionCharacters(notes: readonly Note[], spans: readonly Span[], chords: readonly Chord[] = groupChords(notes)): Character[] {
  const r = spans.map((s) => raw(chords, s));
  const vel = r.map((x) => x.vel), rate = r.map((x) => x.rate), poly = r.map((x) => x.poly);
  return r.map((x) => {
    const loud = x.attacks ? percentileRank(x.vel, vel) : 0, fast = x.attacks ? percentileRank(x.rate, rate) : 0;
    const dense = x.attacks ? percentileRank(x.poly, poly) : 0;
    return { loud, dense, low: x.lowShare, fast, quiet: (1 - loud) * (1 - fast) };
  });
}

/** 'loud · dense': the character words at ≥ 0.6, the highest two (ties in CHARACTER_WORDS order), else 'calm'. */
export function characterLabel(c: Character): string {
  const words = CHARACTER_WORDS.filter((k) => c[k] >= 0.6).sort((a, b) => c[b] - c[a] || CHARACTER_WORDS.indexOf(a) - CHARACTER_WORDS.indexOf(b));
  return words.length ? words.slice(0, 2).join(' · ') : 'calm';
}
