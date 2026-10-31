/**
 * Transitions on the shared canvas (plan §5), pure. A widget is one running instance: in consecutive sections it
 * continues (its knobs switch at the boundary) unless restart; entering, it is reset at the boundary; leaving, it keeps
 * drawing beneath the new stack for the next section's fade seconds, without attacks, at weight (1 − u)². Because the
 * canvas is shared and fades on its own, an incoming casket slices what the outgoing widgets left.
 */
import { DEFAULT_FADE, type KnobSetting, type Show } from './show';

export interface ScheduledWidget { id: string; receiving: boolean; weight: number; knobs: Record<string, KnobSetting>; section: number }

/** The last section with start ≤ t (0 before it). */
export function sectionAt(show: Show, t: number): number {
  const s = show.sections;
  let lo = 0, hi = s.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (s[mid].start <= t) lo = mid; else hi = mid - 1; }
  return lo;
}

const has = (show: Show, i: number, id: string) => show.sections[i].layers.some((l) => l.widget === id);
const fadeOf = (show: Show, i: number) => Math.max(0, show.sections[i].fade ?? DEFAULT_FADE);

/** Decaying widgets (left at boundary b, b ≤ t < b + fade), oldest first, receiving false; then the section's layers,
    receiving true, weight 1. */
export function scheduleAt(show: Show, t: number): ScheduledWidget[] {
  const cur = sectionAt(show, t), sec = show.sections[cur];
  const decaying = new Map<string, ScheduledWidget>();   // id → its latest leave; Map order = first insertion, re-set below
  for (let j = 1; j <= cur; j++) {
    for (const l of show.sections[j].layers) decaying.delete(l.widget);   // playing again: an earlier leave is over
    const b = show.sections[j].start, fade = fadeOf(show, j);
    if (!(t < b + fade)) continue;
    const u = (t - b) / fade;
    for (const l of show.sections[j - 1].layers) {
      if (has(show, j, l.widget)) continue;
      decaying.delete(l.widget);                          // a later leave replaces an earlier one, and moves it later
      decaying.set(l.widget, { id: l.widget, receiving: false, weight: (1 - u) ** 2, knobs: l.knobs ?? {}, section: j - 1 });
    }
  }
  const out: ScheduledWidget[] = [];
  for (const w of decaying.values()) if (!has(show, cur, w.id)) out.push(w);
  for (const l of sec.layers) out.push({ id: l.widget, receiving: true, weight: 1, knobs: l.knobs ?? {}, section: cur });
  return out;
}

/** Widgets entering (absent from the previous section) or restarting at a boundary b with t0 < b ≤ t1, by boundary
    then layer order: the Conductor resets them as it crosses b. */
export function entriesBetween(show: Show, t0: number, t1: number): { id: string; at: number }[] {
  const out: { id: string; at: number }[] = [];
  for (let j = 1; j < show.sections.length; j++) {
    const b = show.sections[j].start;
    if (!(t0 < b && b <= t1)) continue;
    for (const l of show.sections[j].layers) if (l.restart || !has(show, j - 1, l.widget)) out.push({ id: l.widget, at: b });
  }
  return out;
}
