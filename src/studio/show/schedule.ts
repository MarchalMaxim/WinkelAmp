/**
 * Who plays when, pure, and a function of the time alone: a clip plays while start ≤ t < end, whatever played before, so a
 * seek hands the runtime what playing there does. Bottom track first (track order is draw order). A clip takes attacks for
 * its whole span and is reset as it starts; its edges fade (edgeWeight), inside its span, so two clips that touch on a
 * track never overlap, not even while fading. What it leaves on the shared canvas fades on its own.
 */
import type { Listen, Param, Pivot, Region } from '../../widgets/types';
import { heldValues, perNote } from './note-values';

type Params = readonly Pick<Param, 'key' | 'perNote'>[] | undefined;
type MetaOf = (widget: string) => { params: NonNullable<Params> } | undefined;
import { DEFAULT_FADE, clipEnums, instanceKey, listenOf, picksId, sortedClips, type Clip, type ClipEnums, type KnobSetting, type Show } from './show';

/** The clip's CLIP_ENUMS flags come along only with pivots: intensityMoves says its curve is to move how present (if the
    widget has the slider: the Conductor knows the widgets), thin that it keeps the strongest attacks. */
export interface ScheduledWidget extends ClipEnums {
  /** the instance key */
  id: string; clip: string; widget: string; listen?: Listen; receiving: boolean; weight: number;
  knobs: Record<string, KnobSetting>; region?: Region; pivots?: Pivot[];
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

/** A clip's knobs at t: its own, with the values its set's last attack holds as the base, a drive kept. */
function knobsAt(show: Show, c: Clip, t: number, params: Params): Record<string, KnobSetting> {
  const knobs = c.knobs ?? {}, id = picksId(c.listen), notes = id !== null ? show.picks?.[id]?.notes : undefined;
  const held = notes ? heldValues(notes, c.start, t) : null;
  if (!held) return knobs;
  const out = { ...knobs };
  for (const [key, base] of Object.entries(held)) {
    if (!perNote(params, key)) continue;
    const s = out[key];
    out[key] = s !== undefined && typeof s !== 'number' ? { ...s, base } : base;
  }
  return out;
}

/** A clip's instance as scheduled at t: only the fields it has. */
function entry(show: Show, c: Clip, t: number, meta?: MetaOf): ScheduledWidget {
  const w: ScheduledWidget = { id: instanceKey(c), clip: c.id, widget: c.widget, receiving: true, weight: edgeWeight(c, t), knobs: knobsAt(show, c, t, meta?.(c.widget)?.params) };
  const listen = listenOf(c);
  if (listen !== undefined) w.listen = listen;
  if (c.region) w.region = c.region;
  if (c.intensity?.length) {
    w.pivots = c.intensity;
    for (const [k] of clipEnums) if (c[k] !== undefined) Object.assign(w, { [k]: c[k] });
  }
  return w;
}

/** The clips playing at t, bottom first, as the runtime is to draw them. meta: a widget's params, which say what a note may set. */
export const scheduleAt = (show: Show, t: number, meta?: MetaOf): ScheduledWidget[] => clipsAt(show, t).map((c) => entry(show, c, t, meta));

/** Clips starting at a time b with t0 < b ≤ t1, in the order they load: the Conductor resets them as it crosses b. id: the
    instance key. */
export function entriesBetween(show: Show, t0: number, t1: number): { id: string; at: number }[] {
  return sortedClips(show.clips).filter((c) => t0 < c.start && c.start <= t1).map((c) => ({ id: instanceKey(c), at: c.start }));
}
