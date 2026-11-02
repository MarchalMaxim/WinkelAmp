/**
 * The timeline's sums, pure: where a dragged clip snaps, how wide its edge grabs are, how long a new clip is, which row a
 * pointer is over, and where the jump keys go.
 */
import { MIN_CLIP, type Clip, type Span } from '../show/show';

export interface SnapTargets {
  /** Other clips' edges and the song's marks: they win over a beat as near as they are. */
  strong: readonly number[];
  beats: readonly number[];
}
export type SnapKind = 'edge' | 'beat';
export interface Snapped { t: number; kind: SnapKind | null }

/** What a dragged clip snaps to: the other clips' edges, the song's marks and its beats. */
export function snapTargets(clips: readonly Clip[], except: string, marks: readonly number[], beats: readonly number[]): SnapTargets {
  const strong = [...marks];
  for (const c of clips) if (c.id !== except) strong.push(c.start, c.end);
  return { strong, beats };
}

/** The target nearest t within r, or null. beats are sorted, so that is a binary search. */
function nearestSorted(xs: readonly number[], t: number, r: number): number | null {
  let lo = 0, hi = xs.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < t) lo = m + 1; else hi = m; }
  let best: number | null = null;
  for (const k of [lo - 1, lo]) {
    const x = xs[k];
    if (x !== undefined && Math.abs(x - t) <= r && (best === null || Math.abs(x - t) < Math.abs(best - t))) best = x;
  }
  return best;
}
function nearest(xs: readonly number[], t: number, r: number): number | null {
  let best: number | null = null;
  for (const x of xs) if (Math.abs(x - t) <= r && (best === null || Math.abs(x - t) < Math.abs(best - t))) best = x;
  return best;
}

/** Where a point at t lands: on the nearest edge or mark within r seconds, else the nearest beat, else t. */
export function snapPoint(t: number, T: SnapTargets, r: number): Snapped {
  const s = nearest(T.strong, t, r);
  if (s !== null) return { t: s, kind: 'edge' };
  const b = nearestSorted(T.beats, t, r);
  return b !== null ? { t: b, kind: 'beat' } : { t, kind: null };
}

/** Where a clip of this length dragged to `start` lands: whichever of its edges is nearest a target. at: the target it
    landed on (the line drawn while dragging), null without one. An edge or mark beats a beat. */
export function snapMove(start: number, len: number, T: SnapTargets, r: number): { start: number; at: number | null; kind: SnapKind | null } {
  const a = snapPoint(start, T, r), b = snapPoint(start + len, T, r);
  const useA = a.kind !== null && (b.kind === null || (a.kind === b.kind ? Math.abs(a.t - start) <= Math.abs(b.t - start - len) : a.kind === 'edge'));
  if (useA) return { start: a.t, at: a.t, kind: a.kind };
  if (b.kind !== null) return { start: b.t - len, at: b.t, kind: b.kind };
  return { start, at: null, kind: null };
}

/** How wide a clip's edge grab is, in px, on a clip this wide: 24 % of it, so its middle is always there to click and drag;
    at least 3, at most 10. Under 8 px a clip is all middle: to resize it, zoom in. */
export const handleWidth = (clipPx: number): number => (clipPx < 8 ? 0 : Math.max(3, Math.min(10, clipPx * 0.24)));

/** The time a new clip takes from t: to the next mark at least 4 s on (if one comes within a minute), else 15 s; kept in
    the song, and moved back when t is too near its end. */
export function newClipSpan(t: number, duration: number, marks: readonly number[]): Span {
  const D = Math.max(duration, MIN_CLIP), start0 = Math.max(0, Math.min(t, D - MIN_CLIP));
  const next = marks.filter((m) => m >= start0 + 4 && m <= start0 + 60).sort((a, b) => a - b)[0];
  const end = Math.min(D, next ?? start0 + 15);
  // Near the song's end a clip would be a sliver: it reaches back as far as it needs to last 4 s.
  const start = end - start0 < 4 ? Math.max(0, end - 4) : start0;
  return { start, end };
}

/** How many rows the timeline shows: the tracks in use and one free above them to drag a clip onto. */
export const rowCount = (clips: readonly Pick<Clip, 'track'>[]): number => clips.reduce((n, c) => Math.max(n, c.track + 1), 0) + 1;

/** The track at a height above the rows' bottom, in px. */
export const trackAtHeight = (fromBottom: number, rowPx: number, rows: number): number =>
  Math.max(0, Math.min(rows - 1, Math.floor(fromBottom / rowPx)));

/** Where Shift+←/→ goes among sorted times: forward, the next one; back, the start of what plays now, or, within 1.5 s
    of that, the one before. 0 is always there. */
export function jumpTime(times: readonly number[], t: number, dir: -1 | 1): number {
  const all = [...new Set([0, ...times])].sort((a, b) => a - b);
  if (dir > 0) return all.find((x) => x > t + 1e-3) ?? t;
  const before = all.filter((x) => x < t - 1e-3);
  const last = before[before.length - 1] ?? 0;
  return t - last > 1.5 ? last : before[before.length - 2] ?? 0;
}
