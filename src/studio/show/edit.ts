/**
 * Show edits the studio makes with the mouse (plan §7), pure: applyEdit never mutates its input, shares what it did
 * not touch, and returns the input itself when an edit cannot apply (so the caller records nothing). From a valid show
 * the result is valid: sections stay contiguous and ≥ MIN_SECTION, a widget plays once per section.
 */
import { DEFAULT_FADE, MAX_FADE, MIN_SECTION, type KnobSetting, type Layer, type Show, type ShowSection } from './show';

export type ShowEdit =
  | { kind: 'moveBoundary'; index: number; t: number }          // boundary between sections index−1 and index
  | { kind: 'split'; section: number; t: number } | { kind: 'merge'; section: number }   // merge with the next
  | { kind: 'addLayer'; section: number; widget: string; at?: number } | { kind: 'removeLayer'; section: number; layer: number }
  | { kind: 'moveLayer'; section: number; from: number; to: number }
  | { kind: 'setKnob'; section: number; layer: number; key: string; value: KnobSetting | null }   // null = back to default
  | { kind: 'setSection'; section: number; patch: { label?: string; fade?: number } };

const ms = (t: number): number => Math.round(t * 1000) / 1000 || 0;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isIndex = (i: number, n: number) => Number.isInteger(i) && i >= 0 && i < n;

function withSections(show: Show, sections: ShowSection[]): Show { return { ...show, sections }; }
function withSection(show: Show, i: number, s: ShowSection): Show {
  const sections = show.sections.slice(); sections[i] = s; return withSections(show, sections);
}
function withLayers(show: Show, i: number, layers: Layer[]): Show { return withSection(show, i, { ...show.sections[i], layers }); }

export function applyEdit(show: Show, e: ShowEdit): Show {
  const S = show.sections;
  switch (e.kind) {
    case 'moveBoundary': {
      if (!(Number.isInteger(e.index) && e.index >= 1 && e.index < S.length) || !Number.isFinite(e.t)) return show;
      const a = S[e.index - 1], b = S[e.index];
      const t = ms(clamp(e.t, a.start + MIN_SECTION, b.end - MIN_SECTION));
      if (a.start + MIN_SECTION > b.end - MIN_SECTION || t === b.start) return show;
      const sections = S.slice();
      sections[e.index - 1] = { ...a, end: t }; sections[e.index] = { ...b, start: t };
      return withSections(show, sections);
    }
    case 'split': {
      if (!isIndex(e.section, S.length) || !Number.isFinite(e.t)) return show;
      const s = S[e.section], t = ms(e.t);
      if (t - s.start < MIN_SECTION || s.end - t < MIN_SECTION) return show;
      const copy = (l: Layer): Layer => JSON.parse(JSON.stringify(l)) as Layer;
      const first: ShowSection = { ...s, end: t };
      const second: ShowSection = { start: t, end: s.end, ...(s.label !== undefined ? { label: s.label } : {}), fade: DEFAULT_FADE, layers: s.layers.map(copy) };
      const sections = S.slice(); sections.splice(e.section, 1, first, second);
      return withSections(show, sections);
    }
    case 'merge': {
      if (!isIndex(e.section, S.length - 1)) return show;
      const sections = S.slice();
      sections.splice(e.section, 2, { ...S[e.section], end: S[e.section + 1].end });
      return withSections(show, sections);
    }
    case 'addLayer': {
      if (!isIndex(e.section, S.length) || !e.widget) return show;
      const layers = S[e.section].layers;
      if (layers.some((l) => l.widget === e.widget)) return show;
      const at = e.at === undefined ? layers.length : clamp(Math.round(e.at), 0, layers.length);
      const next = layers.slice(); next.splice(at, 0, { widget: e.widget });
      return withLayers(show, e.section, next);
    }
    case 'removeLayer': {
      if (!isIndex(e.section, S.length) || !isIndex(e.layer, S[e.section].layers.length)) return show;
      return withLayers(show, e.section, S[e.section].layers.filter((_, j) => j !== e.layer));
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
  }
}
