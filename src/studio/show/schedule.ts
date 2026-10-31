/**
 * Transitions on the shared canvas (plan §5), pure. A widget is one running instance: in consecutive sections it
 * continues (its knobs switch at the boundary) unless restart; entering, it is reset at the boundary; leaving, it keeps
 * drawing beneath the new stack for the next section's fade seconds, without attacks, at weight (1 − u)². Because the
 * canvas is shared and fades on its own, an incoming casket slices what the outgoing widgets left.
 * Each fade belongs to its boundary: a fade-0 boundary cuts only the widgets leaving there, not earlier decays.
 * Show v2 (plan 2026-10-31 §5): an instance is keyed by instanceKey (widget, or widget@listen). It carries its
 * section's region and intensity pivots; a decaying one keeps its section's pivots, read up to `until` (the boundary it
 * left at); a continuing one whose region moved glides from the old region over the new section's fade.
 */
import type { Listen, Pivot, Region } from '../../widgets/types';
import { DEFAULT_FADE, instanceKey, listenOf, type KnobSetting, type Layer, type Show } from './show';

export interface ScheduledWidget {
  /** the instance key */
  id: string; widget: string; listen?: Listen; receiving: boolean; weight: number;
  knobs: Record<string, KnobSetting>; section: number;
  region?: Region; glide?: { from: Region; u: number }; pivots?: Pivot[]; until?: number;
}

/** The last section with start ≤ t (0 before it). */
export function sectionAt(show: Show, t: number): number {
  const s = show.sections;
  let lo = 0, hi = s.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (s[mid].start <= t) lo = mid; else hi = mid - 1; }
  return lo;
}

const layerOf = (show: Show, i: number, key: string): Layer | undefined => show.sections[i].layers.find((l) => instanceKey(l) === key);
const has = (show: Show, i: number, key: string) => layerOf(show, i, key) !== undefined;
const fadeOf = (show: Show, i: number) => Math.max(0, show.sections[i].fade ?? DEFAULT_FADE);

const sameRegion = (a: Region, b: Region): boolean =>
  a.mode === b.mode && a.shape === b.shape && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
  && (a.rot ?? 0) === (b.rot ?? 0) && a.feather === b.feather && a.blend === b.blend && a.fit === b.fit;

/** A layer's instance as scheduled: only the fields it has. */
function entry(l: Layer, section: number, receiving: boolean, weight: number): ScheduledWidget {
  const w: ScheduledWidget = { id: instanceKey(l), widget: l.widget, receiving, weight, knobs: l.knobs ?? {}, section };
  const listen = listenOf(l);
  if (listen !== undefined) w.listen = listen;
  if (l.region) w.region = l.region;
  if (l.intensity?.length) w.pivots = l.intensity;
  return w;
}

/** Decaying widgets (left at boundary b, b ≤ t < b + fade), oldest first, receiving false; then the section's layers,
    receiving true, weight 1. */
export function scheduleAt(show: Show, t: number): ScheduledWidget[] {
  const cur = sectionAt(show, t), sec = show.sections[cur];
  const decaying = new Map<string, ScheduledWidget>();   // id → its latest leave; Map order = first insertion, re-set below
  for (let j = 1; j <= cur; j++) {
    for (const l of show.sections[j].layers) decaying.delete(instanceKey(l));   // playing again: an earlier leave is over
    const b = show.sections[j].start, fade = fadeOf(show, j);
    if (!(t < b + fade)) continue;
    const u = (t - b) / fade;
    for (const l of show.sections[j - 1].layers) {
      const key = instanceKey(l);
      if (has(show, j, key)) continue;
      decaying.delete(key);                               // a later leave replaces an earlier one, and moves it later
      const w = entry(l, j - 1, false, (1 - u) ** 2);
      w.until = b;
      decaying.set(key, w);
    }
  }
  const out: ScheduledWidget[] = [];
  for (const w of decaying.values()) if (!has(show, cur, w.id)) out.push(w);
  const b = sec.start, fade = fadeOf(show, cur);
  for (const l of sec.layers) {
    const w = entry(l, cur, true, 1);
    // Continuing with a moved region of the same mode: glide over this section's fade (a change of mode is a cut).
    if (cur > 0 && l.region && fade > 0 && t < b + fade) {
      const from = layerOf(show, cur - 1, w.id)?.region;
      if (from && from.mode === l.region.mode && !sameRegion(from, l.region)) w.glide = { from, u: Math.max(0, (t - b) / fade) };
    }
    out.push(w);
  }
  return out;
}

/** Widgets entering (absent from the previous section) or restarting at a boundary b with t0 < b ≤ t1, by boundary
    then layer order: the Conductor resets them as it crosses b. id: the instance key. */
export function entriesBetween(show: Show, t0: number, t1: number): { id: string; at: number }[] {
  const out: { id: string; at: number }[] = [];
  for (let j = 1; j < show.sections.length; j++) {
    const b = show.sections[j].start;
    if (!(t0 < b && b <= t1)) continue;
    for (const l of show.sections[j].layers) {
      const key = instanceKey(l);
      if (l.restart || !has(show, j - 1, key)) out.push({ id: key, at: b });
    }
  }
  return out;
}
