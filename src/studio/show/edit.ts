/**
 * Show edits the studio makes with the mouse (plan §7), pure: applyEdit never mutates its input, shares what it did
 * not touch, and returns the input itself when an edit cannot apply (so the caller records nothing). From a valid show
 * the result is valid: sections stay contiguous and ≥ MIN_SECTION, an instance plays once per section.
 * Intensity pivots are in song seconds, so they never stretch: an edit that shrinks a section removes the pivots that
 * fall outside it and adds an edge pivot with the curve's value there (env.curve, WaLayers.automationAt), so the
 * visible curve is unchanged; merging joins the same instance's curves, and a boundary drag hands an instance that
 * plays on both sides the part of its joined curve that changed side (plan 2026-10-31 §5).
 * A set of picks lives as long as a layer uses it: an edit that removes its last layer removes it too, and no edit leaves
 * a picks listen without its set. Placing, updating and removing a set are one edit each, so one undo step.
 */
import type { Listen, Note, Pivot, Region } from '../../widgets/types';
import { sectionAt } from './schedule';
import {
  DEFAULT_FADE, MAX_FADE, MAX_PIVOTS, MIN_SECTION, instanceKey, isListen, picksId, picksListen, repairPickNotes, repairPivots, repairRegion,
  type KnobSetting, type Layer, type PickSet, type Show, type ShowSection,
} from './show';

export type ShowEdit =
  | { kind: 'moveBoundary'; index: number; t: number }          // boundary between sections index−1 and index
  | { kind: 'split'; section: number; t: number } | { kind: 'merge'; section: number }   // merge with the next
  | { kind: 'addLayer'; section: number; widget: string; at?: number; listen?: Listen }
  | { kind: 'removeLayer'; section: number; layer: number }
  | { kind: 'moveLayer'; section: number; from: number; to: number }
  | { kind: 'setKnob'; section: number; layer: number; key: string; value: KnobSetting | null }   // null = back to default
  | { kind: 'setSection'; section: number; patch: { label?: string; fade?: number } }
  /** null removes the field; listen 'all' is the same as null. A listen whose key is already in the section is refused. */
  | { kind: 'setLayer'; section: number; layer: number; patch: { listen?: Listen | null; region?: Region | null; intensity?: Pivot[] | null } }
  /** A new set of picks, with a layer on top of every section from the first pick to the last. */
  | { kind: 'placePicks'; widget: string; notes: Note[] }
  /** The set's new notes and widget: it keeps its id, and its layers span the new notes. */
  | { kind: 'updatePicks'; id: string; widget: string; notes: Note[] }
  | { kind: 'removePicks'; id: string };

/** The curve, for edge pivots: WaLayers.automationAt. Without it an edge pivot takes the value of the cut pivot
    nearest the edge. */
export interface EditEnv { curve: (p: readonly Pivot[] | undefined, t: number) => number }

/** The undo group of a region or intensity edit (a handle or pivot drag is one step), else undefined. */
export function editGroup(e: ShowEdit): string | undefined {
  if (e.kind !== 'setLayer') return undefined;
  const keys = Object.keys(e.patch).filter((k) => (e.patch as Record<string, unknown>)[k] !== undefined);
  return keys.length === 1 && (keys[0] === 'region' || keys[0] === 'intensity') ? `${keys[0]}:${e.section}:${e.layer}` : undefined;
}

const ms = (t: number): number => Math.round(t * 1000) / 1000 || 0;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isIndex = (i: number, n: number) => Number.isInteger(i) && i >= 0 && i < n;

function withSections(show: Show, sections: ShowSection[]): Show { return { ...show, sections }; }
function withSection(show: Show, i: number, s: ShowSection): Show {
  const sections = show.sections.slice(); sections[i] = s; return withSections(show, sections);
}
function withLayers(show: Show, i: number, layers: Layer[]): Show { return withSection(show, i, { ...show.sections[i], layers }); }

/** A layer with these pivots (none: no intensity field). */
function withPivots(l: Layer, p: Pivot[] | undefined): Layer {
  const { intensity: _old, ...rest } = l;
  return p && p.length ? { ...rest, intensity: p } : rest;
}

/** Pivots inside [a, b]; when some fell outside, an edge pivot at a (carrying the cut segment's shape and bend) and/or
    at b with the curve's value there. null when nothing falls outside (the layer is shared as it is). */
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

/** The section's layers with their curves trimmed to [a, b]; the same array when no curve changed. */
function trimLayers(layers: Layer[], a: number, b: number, env?: EditEnv): Layer[] {
  let out: Layer[] | null = null;
  layers.forEach((l, j) => {
    const p = trimPivots(l.intensity, a, b, env);
    if (!p) return;
    out ??= layers.slice();
    out[j] = withPivots(l, p);
  });
  return out ?? layers;
}

/** One instance's curve over two joined sections [a0, b) and [b, …): each side looks as it did (no curve = 1). The
    first side's last pivot holds to b, then the second side's curve; identical pivots at one time are folded. */
function joinPivots(A: readonly Pivot[] | undefined, B: readonly Pivot[] | undefined, a0: number, b: number): Pivot[] | undefined {
  if (!A?.length && !B?.length) return undefined;
  const a: readonly Pivot[] = A?.length ? A : [{ t: a0, v: 1 }];
  const c: readonly Pivot[] = B?.length ? B : [{ t: b, v: 1 }];
  const last = a[a.length - 1];
  const raw: Pivot[] = [...a.slice(0, -1)];
  if (last.t < b) raw.push({ t: last.t, v: last.v, shape: 'hold' });
  else raw.push(last);
  if (c[0].t > b) raw.push({ t: b, v: c[0].v, shape: 'hold' });
  raw.push(...c);
  // A pivot followed by one at the same time and value says nothing: the later one governs the next segment.
  const out = raw.filter((x, i) => !(i + 1 < raw.length && raw[i + 1].t === x.t && raw[i + 1].v === x.v));
  // Never capped: a merge of two full curves keeps both (validateShow only warns over MAX_PIVOTS, and setLayer never
  // shortens a curve that is already longer).
  return out;
}

/** The smallest free p<N>. */
export function nextPicksId(show: Show): string {
  let n = 1;
  while (show.picks?.[`p${n}`]) n++;
  return `p${n}`;
}

/** The longest step live playing takes (a pick goes to whoever plays at the end of the step it falls in). */
const LONGEST_STEP = 1 / 20;
/** The sections a set's layers must play in: from the one holding the first pick to the one holding the last, or the
    next one when a step can carry the last pick over the boundary, or the widget would miss it. Notes sorted. */
function picksSpan(show: Show, notes: readonly Note[]): [first: number, last: number] {
  return [sectionAt(show, notes[0][0]), sectionAt(show, notes[notes.length - 1][0] + LONGEST_STEP)];
}

/** The show with these sets (none: no picks key, so a show without picks stays as it was). */
function withPicks(show: Show, picks: Record<string, PickSet>): Show {
  const { picks: _old, ...rest } = show;
  return Object.keys(picks).length ? { ...rest, picks } : rest;
}

/** `after` without the sets whose last layer this edit removed. One used by nobody before it is hand work, and stays. */
function dropOrphans(before: Show, after: Show): Show {
  if (!before.picks) return after;
  const used = (s: Show) => new Set(s.sections.flatMap((x) => x.layers.map((l) => picksId(l.listen))));
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

/** updatePicks: sections in the span keep the set's layer at its place (one layer, and a new widget rewrites it and drops
    its knobs), sections outside lose it, new ones get it on top with the knobs and region of the nearest layer of the set,
    its knobs only if the widget stayed. */
function respanPicks(show: Show, id: string, widget: string, [first, last]: [number, number]): ShowSection[] {
  const inSet = (l: Layer) => picksId(l.listen) === id;
  const holders = show.sections.flatMap((s, i) => (s.layers.some(inSet) ? [i] : []));
  const nearest = (i: number): Layer | undefined => {
    if (!holders.length) return undefined;
    const j = holders.reduce((a, b) => (Math.abs(b - i) < Math.abs(a - i) ? b : a));
    return show.sections[j].layers.find(inSet);
  };
  const rewrite = (l: Layer): Layer => {
    if (l.widget === widget) return l;
    const { knobs: _knobs, ...rest } = l;
    return { ...rest, widget };
  };
  return show.sections.map((s, i) => {
    const own = s.layers.find(inSet);
    if (i < first || i > last) return own ? { ...s, layers: s.layers.filter((l) => !inSet(l)) } : s;
    if (own) return { ...s, layers: s.layers.filter((l) => !inSet(l) || l === own).map((l) => (l === own ? rewrite(l) : l)) };
    const near = nearest(i);
    const layer: Layer = { widget, listen: picksListen(id) };
    if (near?.widget === widget && near.knobs) layer.knobs = near.knobs;
    if (near?.region) layer.region = near.region;
    return { ...s, layers: [...s.layers, layer] };
  });
}

export function applyEdit(show: Show, e: ShowEdit, env?: EditEnv): Show {
  const S = show.sections;
  switch (e.kind) {
    case 'moveBoundary': {
      if (!(Number.isInteger(e.index) && e.index >= 1 && e.index < S.length) || !Number.isFinite(e.t)) return show;
      const a = S[e.index - 1], b = S[e.index];
      const t = ms(clamp(e.t, a.start + MIN_SECTION, b.end - MIN_SECTION));
      if (a.start + MIN_SECTION > b.end - MIN_SECTION || t === b.start) return show;
      let al = trimLayers(a.layers, a.start, t, env), bl = trimLayers(b.layers, t, b.end, env);
      // An instance playing on both sides shows one curve across the boundary: join it, then cut it at the new place,
      // so the side that gains time takes the other side's pivots there.
      a.layers.forEach((l, j) => {
        const k = b.layers.findIndex((x) => instanceKey(x) === instanceKey(l));
        if (k < 0 || (!l.intensity?.length && !b.layers[k].intensity?.length)) return;
        const joined = joinPivots(l.intensity, b.layers[k].intensity, a.start, b.start)!;
        if (al === a.layers) al = a.layers.slice();
        if (bl === b.layers) bl = b.layers.slice();
        al[j] = withPivots(l, trimPivots(joined, a.start, t, env) ?? joined);
        bl[k] = withPivots(b.layers[k], trimPivots(joined, t, b.end, env) ?? joined);
      });
      const sections = S.slice();
      sections[e.index - 1] = { ...a, end: t, layers: al };
      sections[e.index] = { ...b, start: t, layers: bl };
      return withSections(show, sections);
    }
    case 'split': {
      if (!isIndex(e.section, S.length) || !Number.isFinite(e.t)) return show;
      const s = S[e.section], t = ms(e.t);
      if (t - s.start < MIN_SECTION || s.end - t < MIN_SECTION) return show;
      const copy = (l: Layer): Layer => JSON.parse(JSON.stringify(l)) as Layer;
      const first: ShowSection = { ...s, end: t, layers: trimLayers(s.layers, s.start, t, env) };
      const second: ShowSection = { start: t, end: s.end, ...(s.label !== undefined ? { label: s.label } : {}), fade: DEFAULT_FADE,
        layers: trimLayers(s.layers.map(copy), t, s.end, env) };
      const sections = S.slice(); sections.splice(e.section, 1, first, second);
      return withSections(show, sections);
    }
    case 'merge': {
      if (!isIndex(e.section, S.length - 1)) return show;
      const a = S[e.section], b = S[e.section + 1];
      let layers = a.layers;
      a.layers.forEach((l, j) => {
        const other = b.layers.find((x) => instanceKey(x) === instanceKey(l));
        if (!other || (!l.intensity?.length && !other.intensity?.length)) return;
        if (layers === a.layers) layers = a.layers.slice();
        layers[j] = withPivots(l, joinPivots(l.intensity, other.intensity, a.start, b.start));
      });
      const sections = S.slice();
      sections.splice(e.section, 2, { ...a, end: b.end, layers });
      return dropOrphans(show, withSections(show, sections));
    }
    case 'addLayer': {
      if (!isIndex(e.section, S.length) || !e.widget) return show;
      if ((e.listen !== undefined && !isListen(e.listen)) || noSet(show, e.listen)) return show;
      const layer: Layer = e.listen !== undefined && e.listen !== 'all' ? { widget: e.widget, listen: e.listen } : { widget: e.widget };
      const layers = S[e.section].layers;
      if (layers.some((l) => instanceKey(l) === instanceKey(layer))) return show;
      const at = e.at === undefined ? layers.length : clamp(Math.round(e.at), 0, layers.length);
      const next = layers.slice(); next.splice(at, 0, layer);
      return withLayers(show, e.section, next);
    }
    case 'removeLayer': {
      if (!isIndex(e.section, S.length) || !isIndex(e.layer, S[e.section].layers.length)) return show;
      return dropOrphans(show, withLayers(show, e.section, S[e.section].layers.filter((_, j) => j !== e.layer)));
    }
    case 'moveLayer': {
      if (!isIndex(e.section, S.length)) return show;
      const layers = S[e.section].layers;
      if (!isIndex(e.from, layers.length) || !Number.isFinite(e.to)) return show;
      const to = clamp(Math.round(e.to), 0, layers.length - 1);
      if (to === e.from) return show;
      const next = layers.slice(); const [l] = next.splice(e.from, 1); next.splice(to, 0, l);
      return withLayers(show, e.section, next);
    }
    case 'setKnob': {
      if (!isIndex(e.section, S.length) || !isIndex(e.layer, S[e.section].layers.length) || !e.key) return show;
      const l = S[e.section].layers[e.layer];
      const knobs: Record<string, KnobSetting> = { ...(l.knobs ?? {}) };
      if (e.value === null) delete knobs[e.key]; else knobs[e.key] = typeof e.value === 'number' ? e.value : { ...e.value };
      const { knobs: _old, ...rest } = l;
      const next: Layer = Object.keys(knobs).length ? { ...rest, knobs } : rest;
      const layers = S[e.section].layers.slice(); layers[e.layer] = next;
      return withLayers(show, e.section, layers);
    }
    case 'setSection': {
      if (!isIndex(e.section, S.length)) return show;
      const s: ShowSection = { ...S[e.section] };
      if (e.patch.label !== undefined) { const label = e.patch.label.trim(); if (label) s.label = label; else delete s.label; }
      if (e.patch.fade !== undefined && Number.isFinite(e.patch.fade)) s.fade = ms(clamp(e.patch.fade, 0, MAX_FADE));
      return withSection(show, e.section, s);
    }
    case 'setLayer': {
      if (!isIndex(e.section, S.length) || !isIndex(e.layer, S[e.section].layers.length)) return show;
      const sec = S[e.section], l = sec.layers[e.layer], p = e.patch;
      const next: Layer = { ...l };
      if (p.listen !== undefined) {
        if (noSet(show, p.listen)) return show;
        if (p.listen === null || p.listen === 'all') delete next.listen;
        else if (isListen(p.listen)) next.listen = p.listen;
        else return show;
        const key = instanceKey(next);
        if (key !== instanceKey(l) && sec.layers.some((x, j) => j !== e.layer && instanceKey(x) === key)) return show;
      }
      if (p.region !== undefined) {
        if (p.region === null) delete next.region;
        else { const r = repairRegion(p.region); if (!r) return show; next.region = r; }
      }
      if (p.intensity !== undefined) {
        // Capped at MAX_PIVOTS, or at the curve's own length when a merge made it longer: an edit never drops pivots
        // of a curve it only moves, and never grows one past the cap.
        let piv = p.intensity === null ? undefined : repairPivots(p.intensity, 'intensity', { start: sec.start, end: sec.end });
        const cap = Math.max(MAX_PIVOTS, l.intensity?.length ?? 0);
        if (piv && piv.length > cap) piv = piv.slice(0, cap);
        if (piv) next.intensity = piv; else delete next.intensity;
      }
      if (JSON.stringify(next) === JSON.stringify(l)) return show;
      const layers = sec.layers.slice(); layers[e.layer] = next;
      return dropOrphans(show, withLayers(show, e.section, layers));
    }
    case 'placePicks': {
      const notes = repairPickNotes(e.notes);
      if (!notes.length || !e.widget) return show;
      const id = nextPicksId(show), [first, last] = picksSpan(show, notes);
      const layer: Layer = { widget: e.widget, listen: picksListen(id) };
      return withPicks(withSections(show, S.map((s, i) => (i < first || i > last ? s : { ...s, layers: [...s.layers, { ...layer }] }))),
        { ...show.picks, [id]: { notes } });
    }
    case 'updatePicks': {
      const old = show.picks?.[e.id], notes = repairPickNotes(e.notes);
      if (!old || !notes.length || !e.widget) return show;
      // The sections count too: with the same notes, an update still spans a boundary that moved and places an unused set.
      const sections = respanPicks(show, e.id, e.widget, picksSpan(show, notes));
      if (JSON.stringify(notes) === JSON.stringify(old.notes) && JSON.stringify(sections) === JSON.stringify(S)) return show;
      return withPicks(withSections(show, sections), { ...show.picks, [e.id]: { notes } });
    }
    case 'removePicks': {
      if (!show.picks?.[e.id]) return show;
      const { [e.id]: _gone, ...rest } = show.picks;
      const inSet = (l: Layer) => picksId(l.listen) === e.id;
      return withPicks(withSections(show, S.map((s) => (s.layers.some(inSet) ? { ...s, layers: s.layers.filter((l) => !inSet(l)) } : s))), rest);
    }
  }
}
