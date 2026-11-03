/**
 * Who plays when, pure, and a function of the time alone: a clip plays while start ≤ t < end, whatever played before, so a
 * seek hands the runtime what playing there does. Bottom track first (track order is draw order). A clip takes attacks for
 * its whole span and is reset as it starts; its edges fade (edgeWeight), inside its span, so two clips that touch on a
 * track never overlap, not even while fading. What it leaves on the shared canvas fades on its own.
 */
import type { Listen, Pivot, Region } from '../../widgets/types';
import { DEFAULT_FADE, instanceKey, listenOf, sortedClips, type Clip, type KnobSetting, type Show } from './show';

export interface ScheduledWidget {
  /** the instance key */
  id: string; clip: string; widget: string; listen?: Listen; receiving: boolean; weight: number;
  knobs: Record<string, KnobSetting>; region?: Region; pivots?: Pivot[];
  /** Its curve is to move how present (if the widget has the slider: the Conductor knows the widgets). */
  moves?: boolean;
}

/** How long a clip takes to come in and to go: its fade, at most half its length. */
export const edgeSeconds = (c: Pick<Clip, 'start' | 'end' | 'fade'>): number =>
  Math.max(0, Math.min(c.fade ?? DEFAULT_FADE, (c.end - c.start) / 2));

/** How strongly a clip draws at t: 0 at its edges, 1 once its fade is over, squared as the old decay was: the weight is a
    paste-back on a canvas that keeps what is drawn on it, so a linear one is seen at once. */
export function edgeWeight(c: Pick<Clip, 'start' | 'end' | 'fade'>, t: number): number {
  const f = edgeSeconds(c);
  if (f <= 0) return 1;
  const u = Math.max(0, Math.min(1, Math.min(t - c.start, c.end - t) / f));
  return u * u;
}

/** The clips playing at t, by track. */
export const clipsAt = (show: Show, t: number): Clip[] =>
  show.clips.filter((c) => c.start <= t && t < c.end).sort((a, b) => a.track - b.track);

/** A clip's instance as scheduled at t: only the fields it has. */
function entry(c: Clip, t: number): ScheduledWidget {
  const w: ScheduledWidget = { id: instanceKey(c), clip: c.id, widget: c.widget, receiving: true, weight: edgeWeight(c, t), knobs: c.knobs ?? {} };
  const listen = listenOf(c);
  if (listen !== undefined) w.listen = listen;
  if (c.region) w.region = c.region;
  if (c.intensity?.length) {
    w.pivots = c.intensity;
    if (c.intensityMoves === 'present') w.moves = true;
  }
  return w;
}

/** The clips playing at t, bottom first, as the runtime is to draw them. */
export const scheduleAt = (show: Show, t: number): ScheduledWidget[] => clipsAt(show, t).map((c) => entry(c, t));

/** Clips starting at a time b with t0 < b ≤ t1, in the order they load: the Conductor resets them as it crosses b. id: the
    instance key. */
export function entriesBetween(show: Show, t0: number, t1: number): { id: string; at: number }[] {
  return sortedClips(show.clips).filter((c) => t0 < c.start && c.start <= t1).map((c) => ({ id: instanceKey(c), at: c.start }));
}
