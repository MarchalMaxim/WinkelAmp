/**
 * The song's structure as marks on the timeline: where the music turns, with a word for it. Marks are there to see and
 * snap to; they own nothing. The times come from the analysis (the pack's novelty sections, src/audio/structure.ts); the
 * names are the lab's moments for this song where it has them ("First theme"), else the character of the stretch.
 */
import type { Span } from './show';

export interface Mark { t: number; label?: string }

/** How near a named moment must be to an analysis boundary to be that boundary, in seconds. */
const SAME = 1.5;

/** The times ctx.moment follows: the analysis boundaries after 0, sorted. The render page and the studio both pass the
    Conductor these, so they agree. */
export const structureTimes = (sections: readonly Pick<Span, 'start'>[]): number[] =>
  sections.map((s) => s.start).filter((t) => t > 0).sort((a, b) => a - b);

/** The marks: each analysis boundary with its word, and each named moment in its own right, in time order. A moment near a
    boundary takes its place. words: per section, what that stretch is like. named: [time, name]. */
export function songMarks(sections: readonly Pick<Span, 'start'>[], words: readonly (string | undefined)[], named: readonly (readonly [number, string])[]): Mark[] {
  const out: Mark[] = named.map(([t, label]) => ({ t, label }));
  sections.forEach((s, i) => {
    if (s.start <= 0 || named.some(([t]) => Math.abs(t - s.start) <= SAME)) return;
    const label = words[i];
    out.push(label ? { t: s.start, label } : { t: s.start });
  });
  return out.sort((a, b) => a.t - b.t);
}

/** The name of the stretch at t: the last mark at or before it that has one. */
export function markLabelAt(marks: readonly Mark[], t: number): string {
  let label = '';
  for (const m of marks) {
    if (m.t > t) break;
    if (m.label) label = m.label;
  }
  return label;
}
