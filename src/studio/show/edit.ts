/**
 * Show edits the studio makes with the mouse, pure: applyEdit never mutates its input, shares what it did not touch, and
 * returns the input itself when an edit cannot apply (so the caller records nothing). Edits name clips by id. From a valid
 * show the result is valid: clips stay in the song and last at least MIN_CLIP, and one track holds no overlaps.
 *
 * A clip that lands on an occupied spot goes to the nearest free track at or above it (freeTrack), so nothing is lost; the
 * drag passes the track under the pointer each time, so it comes back when the spot is free again. An edge drag instead
 * stops at the neighbour on its track: dragging an edge is about when the clip ends, not where it sits.
 *
 * Intensity pivots are in song seconds and belong to their clip: moving a clip moves them. Shortening one removes the
 * pivots that fall outside and adds an edge pivot with the curve's value there (env.curve, WaLayers.automationAt), so the
 * visible curve is unchanged; a resize passes the curve it started with (`from`), so one drag there and back loses nothing.
 *
 * A set of picks lives as long as a clip uses it: an edit that removes its last clip removes it too, and no edit leaves a
 * picks listen without its set. Placing, updating and removing a set are one edit each, so one undo step.
 */
import type { Listen, Note, Pivot, Region } from '../../widgets/types';
import {
  DEFAULT_FADE, LONGEST_STEP, MAX_FADE, MAX_PIVOTS, MIN_CLIP, freeTrack, isListen, nextClipId, overlaps, picksId, picksListen, repairPickNotes, repairPivots, repairRegion, topTrack,
  type Clip, type KnobSetting, type PickSet, type Show, type Span,
} from './show';

export type ClipPatch = { listen?: Listen | null; region?: Region | null; intensity?: Pivot[] | null; intensityMoves?: 'present' | null; fade?: number | null };

export type ShowEdit =
  /** A new clip; without a track, on top of what plays over its span. */
  | { kind: 'addClip'; widget: string; start: number; end: number; track?: number; listen?: Listen }
  | { kind: 'removeClip'; clip: string }
  /** To this start (kept in the song) on this track, or the nearest free one above it. Its curve moves along. */
  | { kind: 'moveClip'; clip: string; start: number; track: number }
  /** This edge to t: not past the other edge, the neighbour on its track or the song. from: the curve when the drag began. */
  | { kind: 'resizeClip'; clip: string; edge: 'start' | 'end'; t: number; from?: Pivot[] }
  /** A copy of its own, right after it when the track has room there, else over it on a free track. */
  | { kind: 'duplicateClip'; clip: string }
  /** Two clips with the same settings, each with its part of the curve. */
  | { kind: 'splitClip'; clip: string; t: number }
  | { kind: 'setKnob'; clip: string; key: string; value: KnobSetting | null }   // null = back to default
  /** null removes the field; listen 'all' is the same as null. */
  | { kind: 'setClip'; clip: string; patch: ClipPatch }
  /** A new set of picks, with one clip around its notes, on top. */
  | { kind: 'placePicks'; widget: string; notes: Note[] }
  /** The set's new notes and widget: it keeps its id, and its clips span the new notes. */
  | { kind: 'updatePicks'; id: string; widget: string; notes: Note[] }
  | { kind: 'removePicks'; id: string };

/** curve: for edge pivots, WaLayers.automationAt; without it an edge pivot takes the value of the cut pivot nearest the
    edge. duration: the song's length; without it clips have no end to keep to. */
export interface EditEnv { curve: (p: readonly Pivot[] | undefined, t: number) => number; duration?(): number }

/** The undo group of a region or intensity edit (a handle or pivot drag is one step), else undefined. */
export function editGroup(e: ShowEdit): string | undefined {
  if (e.kind !== 'setClip') return undefined;
  const keys = Object.keys(e.patch).filter((k) => (e.patch as Record<string, unknown>)[k] !== undefined);
  return keys.length === 1 && (keys[0] === 'region' || keys[0] === 'intensity') ? `${keys[0]}:${e.clip}` : undefined;
}

const ms = (t: number): number => Math.round(t * 1000) / 1000 || 0;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A clip with these pivots (none: no intensity field). */
function withPivots<T extends Clip>(l: T, p: Pivot[] | undefined): T {
  const { intensity: _old, ...rest } = l;
  return (p && p.length ? { ...rest, intensity: p } : rest) as T;
}

/** Pivots inside [a, b]; when some fell outside, an edge pivot at a (carrying the cut segment's shape and bend) and/or
    at b with the curve's value there. null when nothing falls outside (the clip is shared as it is). */
function trimPivots(p: readonly Pivot[] | undefined, a: number, b: number, env?: EditEnv): Pivot[] | null {
  if (!p || !p.length) return null;
  const inside = p.filter((x) => x.t >= a && x.t <= b);
  if (inside.length === p.length) return null;
  const out = inside.slice();
  const before = p.filter((x) => x.t < a), after = p.filter((x) => x.t > b);
  if (before.length && !inside.some((x) => x.t === a)) {
    const cut = before[before.length - 1];   // the pivot that starts the segment across a
    const edge: Pivot = { t: a, v: env ? env.curve(p, a) : cut.v };
    if (cut.shape !== undefined) edge.shape = cut.shape;
    if (cut.bend !== undefined) edge.bend = cut.bend;
    out.unshift(edge);
  }
  if (after.length && !inside.some((x) => x.t === b)) out.push({ t: b, v: env ? env.curve(p, b) : after[0].v });
  return out;
}

/** The smallest free p<N>. */
export function nextPicksId(show: Show): string {
  let n = 1;
  while (show.picks?.[`p${n}`]) n++;
  return `p${n}`;
}

/** The span a clip on these notes needs: from its fade before the first note (fully seen by then) until the last has
    ended and its fade is over; kept in the song. Notes sorted. */
function picksSpan(notes: readonly Note[], duration: number): Span {
  const last = Math.max(...notes.map((n) => n[1]), notes[notes.length - 1][0] + LONGEST_STEP);
  return { start: ms(Math.max(0, notes[0][0] - DEFAULT_FADE)), end: ms(Math.min(duration, last + DEFAULT_FADE)) };
}

/** The show with these sets (none: no picks key, so a show without picks stays as it was). */
function withPicks(show: Show, picks: Record<string, PickSet>): Show {
  const { picks: _old, ...rest } = show;
  return Object.keys(picks).length ? { ...rest, picks } : rest;
}

/** `after` without the sets whose last clip this edit removed. One used by nobody before it is hand work, and stays. */
function dropOrphans(before: Show, after: Show): Show {
  if (!before.picks) return after;
  const used = (s: Show) => new Set(s.clips.map((c) => picksId(c.listen)));
  const had = used(before), has = used(after);
  const gone = Object.keys(before.picks).filter((id) => had.has(id) && !has.has(id));
  if (!gone.length) return after;
  return withPicks(after, Object.fromEntries(Object.entries(before.picks).filter(([id]) => !gone.includes(id))));
}

/** A picks listen whose set isn't there. */
const noSet = (show: Show, listen: Listen | null | undefined): boolean => {
  const id = picksId(listen);
  return id !== null && !show.picks?.[id];
};

/** The show with this clip in place of the one with its id. */
const withClip = (show: Show, c: Clip): Show => ({ ...show, clips: show.clips.map((x) => (x.id === c.id ? c : x)) });

/** updatePicks: every clip of the set takes the widget (a new one drops its knobs) and those holding no note go, the last
    one excepted. With new notes one clip spans them exactly; with the same notes (or several clips) they only grow to reach
    them: a hand-made length stays. No clip yet: one on top. */
function respanPicks(show: Show, id: string, widget: string, notes: readonly Note[], same: boolean, env?: EditEnv): Clip[] {
  const D = env?.duration?.() ?? Infinity, span = picksSpan(notes, D), mine = show.clips.filter((c) => picksId(c.listen) === id);
  if (!mine.length) return [...show.clips, { id: nextClipId(show.clips), ...span, track: topTrack(show.clips, span), widget, listen: picksListen(id) }];
  const holds = (c: Clip) => notes.some((n) => n[0] >= c.start && n[0] < c.end);
  let keep = mine.filter(holds);
  if (!keep.length) keep = [mine[0]];
  const first = keep.reduce((a, b) => (b.start < a.start ? b : a)), last = keep.reduce((a, b) => (b.end > a.end ? b : a));
  const others = show.clips.filter((c) => !mine.includes(c));
  const out: Clip[] = keep.map((c) => {
    let next: Clip = c;
    if (c.widget !== widget) { const { knobs: _knobs, ...rest } = c; next = { ...rest, widget }; }
    const start = keep.length === 1 && !same ? span.start : c === first ? Math.min(c.start, span.start) : c.start;
    const end = keep.length === 1 && !same ? span.end : c === last ? Math.max(c.end, span.end) : c.end;
    if (start === c.start && end === c.end) return next;
    const p = trimPivots(next.intensity, start, end, env);
    next = { ...next, start, end };
    return p ? withPivots(next, p) : next;
  });
  // A clip that grew may now cover another on its track: it goes up, as any clip landing on an occupied spot.
  const placed = [...others];
  return [...show.clips.filter((c) => !mine.includes(c)), ...out.map((c) => {
    const track = freeTrack(placed, c, c.track), next = track === c.track ? c : { ...c, track };
    placed.push(next);
    return next;
  })];
}

const copyOf = (c: Clip, id: string): Clip => ({ ...(JSON.parse(JSON.stringify(c)) as Clip), id });

export function applyEdit(show: Show, e: ShowEdit, env?: EditEnv): Show {
  const C = show.clips, D = env?.duration?.() ?? Infinity;
  const byId = (id: string): Clip | undefined => C.find((c) => c.id === id);
  switch (e.kind) {
    case 'addClip': {
      if (!e.widget || !Number.isFinite(e.start) || !Number.isFinite(e.end)) return show;
      if ((e.listen !== undefined && !isListen(e.listen)) || noSet(show, e.listen)) return show;
      const start = ms(clamp(e.start, 0, Math.max(0, D - MIN_CLIP))), end = ms(Math.min(D, Math.max(e.end, start + MIN_CLIP)));
      if (end - start < MIN_CLIP - 1e-6) return show;
      const span = { start, end }, track = e.track === undefined ? topTrack(C, span) : freeTrack(C, span, e.track);
      const clip: Clip = { id: nextClipId(C), start, end, track, widget: e.widget };
      if (e.listen !== undefined && e.listen !== 'all') clip.listen = e.listen;
      return { ...show, clips: [...C, clip] };
    }
    case 'removeClip': {
      if (!byId(e.clip)) return show;
      return dropOrphans(show, { ...show, clips: C.filter((c) => c.id !== e.clip) });
    }
    case 'moveClip': {
      const c = byId(e.clip);
      if (!c || !Number.isFinite(e.start) || !Number.isFinite(e.track)) return show;
      const len = c.end - c.start, start = ms(clamp(e.start, 0, Math.max(0, D - len))), end = ms(start + len);
      const track = freeTrack(C, { start, end }, e.track, c.id);
      if (start === c.start && track === c.track) return show;
      const dt = start - c.start;
      const next: Clip = { ...c, start, end, track };
      if (c.intensity?.length && dt !== 0) next.intensity = c.intensity.map((p) => ({ ...p, t: ms(p.t + dt) }));
      return withClip(show, next);
    }
    case 'resizeClip': {
      const c = byId(e.clip);
      if (!c || !Number.isFinite(e.t)) return show;
      const neighbours = C.filter((x) => x.id !== c.id && x.track === c.track);
      let start = c.start, end = c.end;
      if (e.edge === 'start') {
        const floor = neighbours.reduce((lo, x) => (x.end <= c.start + 5e-4 ? Math.max(lo, x.end) : lo), 0);
        start = ms(clamp(e.t, floor, Math.max(floor, end - MIN_CLIP)));
      } else {
        const ceil = neighbours.reduce((hi, x) => (x.start >= c.end - 5e-4 ? Math.min(hi, x.start) : hi), D);
        end = ms(clamp(e.t, Math.min(ceil, start + MIN_CLIP), ceil));
      }
      if (end - start < MIN_CLIP - 1e-6 || (start === c.start && end === c.end && !e.from)) return show;
      const base = e.from ?? c.intensity, p = trimPivots(base, start, end, env);
      const next: Clip = { ...c, start, end };
      const out = p ? withPivots(next, p) : withPivots(next, base);
      return JSON.stringify(out) === JSON.stringify(c) ? show : withClip(show, out);
    }
    case 'duplicateClip': {
      const c = byId(e.clip);
      if (!c) return show;
      const id = nextClipId(C), len = c.end - c.start, after = { start: c.end, end: ms(c.end + len) };
      const roomAfter = after.end <= D && !C.some((x) => x.track === c.track && overlaps(x, after));
      const copy = copyOf(c, id);
      if (roomAfter) {
        copy.start = after.start; copy.end = after.end;
        if (copy.intensity) copy.intensity = copy.intensity.map((p) => ({ ...p, t: ms(p.t + len) }));
      } else copy.track = freeTrack(C, c, c.track);
      return { ...show, clips: [...C, copy] };
    }
    case 'splitClip': {
      const c = byId(e.clip);
      if (!c || !Number.isFinite(e.t)) return show;
      const t = ms(e.t);
      if (t - c.start < MIN_CLIP || c.end - t < MIN_CLIP) return show;
      const a = trimPivots(c.intensity, c.start, t, env), b = trimPivots(c.intensity, t, c.end, env);
      const first: Clip = a ? withPivots({ ...c, end: t }, a) : { ...c, end: t };
      const second: Clip = { ...copyOf(c, nextClipId(C)), start: t };
      return { ...show, clips: [...C.map((x) => (x.id === c.id ? first : x)), b ? withPivots(second, b) : second] };
    }
    case 'setKnob': {
      const c = byId(e.clip);
      if (!c || !e.key) return show;
      const knobs: Record<string, KnobSetting> = { ...(c.knobs ?? {}) };
      if (e.value === null) delete knobs[e.key]; else knobs[e.key] = typeof e.value === 'number' ? e.value : { ...e.value };
      const { knobs: _old, ...rest } = c;
      return withClip(show, Object.keys(knobs).length ? { ...rest, knobs } : rest);
    }
    case 'setClip': {
      const c = byId(e.clip), p = e.patch;
      if (!c) return show;
      const next: Clip = { ...c };
      if (p.listen !== undefined) {
        if (noSet(show, p.listen)) return show;
        if (p.listen === null || p.listen === 'all') delete next.listen;
        else if (isListen(p.listen)) next.listen = p.listen;
        else return show;
      }
      if (p.region !== undefined) {
        if (p.region === null) delete next.region;
        else { const r = repairRegion(p.region); if (!r) return show; next.region = r; }
      }
      if (p.intensityMoves !== undefined) {
        if (p.intensityMoves === null) delete next.intensityMoves;
        else if (p.intensityMoves === 'present') next.intensityMoves = p.intensityMoves;
        else return show;
      }
      if (p.intensity !== undefined) {
        // Capped at MAX_PIVOTS, or at the curve's own length when a file made it longer: an edit never drops pivots of a
        // curve it only moves, and never grows one past the cap.
        let piv = p.intensity === null ? undefined : repairPivots(p.intensity, 'intensity', { start: c.start, end: c.end });
        const cap = Math.max(MAX_PIVOTS, c.intensity?.length ?? 0);
        if (piv && piv.length > cap) piv = piv.slice(0, cap);
        if (piv) next.intensity = piv; else delete next.intensity;
      }
      if (p.fade !== undefined) {
        if (p.fade === null) delete next.fade;
        else if (Number.isFinite(p.fade)) next.fade = ms(clamp(p.fade, 0, MAX_FADE));
      }
      if (JSON.stringify(next) === JSON.stringify(c)) return show;
      return dropOrphans(show, withClip(show, next));
    }
    case 'placePicks': {
      const notes = repairPickNotes(e.notes);
      if (!notes.length || !e.widget) return show;
      const id = nextPicksId(show), span = picksSpan(notes, D);
      const clip: Clip = { id: nextClipId(C), ...span, track: topTrack(C, span), widget: e.widget, listen: picksListen(id) };
      return withPicks({ ...show, clips: [...C, clip] }, { ...show.picks, [id]: { notes } });
    }
    case 'updatePicks': {
      const old = show.picks?.[e.id], notes = repairPickNotes(e.notes);
      if (!old || !notes.length || !e.widget) return show;
      const same = JSON.stringify(notes) === JSON.stringify(old.notes);
      const clips = respanPicks(show, e.id, e.widget, notes, same, env);
      if (same && JSON.stringify(clips) === JSON.stringify(C)) return show;
      return withPicks({ ...show, clips }, { ...show.picks, [e.id]: { notes } });
    }
    case 'removePicks': {
      if (!show.picks?.[e.id]) return show;
      const { [e.id]: _gone, ...rest } = show.picks;
      return withPicks({ ...show, clips: C.filter((c) => picksId(c.listen) !== e.id) }, rest);
    }
  }
}
