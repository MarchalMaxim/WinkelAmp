/**
 * The auto-composer (plan §6): a default show for any pack, so every song plays well at once. Sections come from the
 * analysis (the most novel boundaries, at least minSection apart, each moved just before the strongest attack near it);
 * each section gets loved/kept widgets by its character. Knobs stay at OUR defaults. Deterministic.
 */
import { groupChords } from '../../widgets/chords';
import type { Chord, WidgetMeta } from '../../widgets/types';
import type { SongPack } from '../pack/pack';
import { DEFAULT_FADE, type Layer, type Show, type ShowSection } from '../show/show';
import { characterLabel, sectionCharacters, type Character, type Span } from './character';
import { TASTE, type TasteRole } from './taste';

export interface ComposeInput {
  pack: Pick<SongPack, 'id' | 'title' | 'duration' | 'notes' | 'sections'>;
  widgets: ReadonlyMap<string, WidgetMeta>;
  /** Shortest section, s (15). */
  minSection?: number;
  /** Most sections (max(1, round(duration / 30))). */
  maxSections?: number;
  /** composer.at (the studio passes now); default the epoch, so the same input gives the same show. */
  at?: string;
}

const ms = (t: number): number => Math.round(t * 1000) / 1000 || 0;
const EPOCH = new Date(0).toISOString();

interface Bound { t: number; novelty: number }

/** Boundaries to drop, lowest novelty first; ties: the one whose removal makes the shorter merged span, then the earliest. */
function weakest(bounds: Bound[], edges: (i: number) => [number, number], among: (i: number) => boolean): number {
  let best = -1, bestMerged = Infinity;
  for (let i = 0; i < bounds.length; i++) {
    if (!among(i)) continue;
    const [a, b] = edges(i), merged = b - a;
    if (best < 0 || bounds[i].novelty < bounds[best].novelty || (bounds[i].novelty === bounds[best].novelty && merged < bestMerged)) {
      best = i; bestMerged = merged;
    }
  }
  return best;
}

function pick(i: ComposeInput, chords: readonly Chord[]): Span[] {
  const d = i.pack.duration, min = i.minSection ?? 15, max = Math.max(1, i.maxSections ?? Math.round(d / 30));
  const bounds: Bound[] = i.pack.sections.slice(1).filter((s) => s.start > 0 && s.start < d).map((s) => ({ t: s.start, novelty: s.novelty }));
  const at = (k: number) => (k < 0 ? 0 : k >= bounds.length ? d : bounds[k].t);   // edge k: 0, the boundaries, the end
  const edges = (k: number): [number, number] => [at(k - 1), at(k + 1)];          // the span boundary k would merge
  const short = (k: number) => at(k) - at(k - 1) < min || at(k + 1) - at(k) < min;
  for (let k; bounds.length && (k = weakest(bounds, edges, short)) >= 0;) bounds.splice(k, 1);
  while (bounds.length + 1 > max) bounds.splice(weakest(bounds, edges, () => true), 1);

  // Move each boundary just before the strongest attack (vel · notes) within ±1 s; ties: the nearest, then the earliest.
  // A move must keep both neighbouring spans at ≥ min (or their length before, if shorter) and ≥ 1 s.
  const ts = bounds.map((b) => b.t);
  let lo = 0;
  ts.forEach((b, k) => {
    while (lo < chords.length && chords[lo].t < b - 1) lo++;
    let best: Chord | null = null;
    for (let j = lo; j < chords.length && chords[j].t <= b + 1; j++) {
      const c = chords[j], s = c.vel * c.notes.length, bs = best ? best.vel * best.notes.length : -1;
      if (s > bs || (s === bs && Math.abs(c.t - b) < Math.abs(best!.t - b))) best = c;
    }
    if (!best) return;
    const nb = ms(best.t - 0.05), prev = k ? ts[k - 1] : 0, next = k + 1 < ts.length ? ts[k + 1] : d;
    const keep = (newLen: number, oldLen: number) => newLen >= Math.max(1, Math.min(min, oldLen));
    if (keep(nb - prev, b - prev) && keep(next - nb, next - b)) ts[k] = nb;
  });
  const edgesOut = [0, ...ts.map(ms), ms(d)];
  return edgesOut.slice(1).map((end, k) => ({ start: edgesOut[k], end }));
}

/** The show's sections: from the analysis sections, dropping the least novel boundaries (first those that touch a span
    shorter than minSection, then until there are at most maxSections), then each moved to the strongest attack near it. */
export function pickSections(i: ComposeInput): Span[] {
  return pick(i, groupChords(i.pack.notes));
}

const score = (fit: Partial<Character>, c: Character) => (Object.keys(fit) as (keyof Character)[]).reduce((a, k) => a + (fit[k] ?? 0) * c[k], 0);

export function composeShow(i: ComposeInput): Show {
  const { pack, widgets } = i;
  const chords = groupChords(pack.notes);
  const d = ms(pack.duration);
  // No attacks at all (a silent recording): one quiet section, whatever the analysis found.
  const spans = chords.length ? pick(i, chords) : [{ start: 0, end: d }];
  const chars = sectionCharacters(pack.notes, spans, chords);
  const liked = (id: string) => { const v = widgets.get(id)?.verdict?.v; return v === 'love' || v === 'keep'; };
  const of = (role: TasteRole) => TASTE.filter((t) => t.role === role && liked(t.id));
  const bases = of('base'), accents = of('accent'), tops = of('top');
  // Without any of the taste's bases, the first loved, then kept, widget of the collection fills in.
  const fallback = [...widgets.values()].filter((m) => m.verdict?.v === 'love').concat([...widgets.values()].filter((m) => m.verdict?.v === 'keep'))
    .map((m) => m.id).find((id) => !TASTE.some((t) => t.id === id && t.role !== 'base'));

  let prevBase: string | null = null;
  const sections: ShowSection[] = spans.map((s, k) => {
    const c = chars[k], layers: Layer[] = [];
    let base: string | null = null;
    if (bases.length) {
      let best = bases[0], bestScore = score(best.fit, c);
      for (const b of bases.slice(1)) { const v = score(b.fit, c); if (v > bestScore) { best = b; bestScore = v; } }
      const prev = bases.find((b) => b.id === prevBase);
      base = prev && score(prev.fit, c) >= bestScore - 0.1 ? prev.id : best.id;
    } else base = fallback ?? null;
    if (base) layers.push({ widget: base });
    prevBase = base;
    let accent: { id: string; v: number } | null = null;
    for (const a of accents) { const v = score(a.fit, c); if (v >= 0.5 && (!accent || v > accent.v)) accent = { id: a.id, v }; }
    if (accent) layers.push({ widget: accent.id });
    if (c.loud >= 0.75 && c.dense >= 0.5) for (const t of tops) if (t.id === 'casket') layers.push({ widget: 'casket' });
    const out: ShowSection = { start: s.start, end: s.end, label: characterLabel(c), layers };
    if (k > 0) out.fade = DEFAULT_FADE;
    return out;
  });
  return { version: 1, id: pack.id, song: pack.id, title: pack.title, composer: { by: 'auto', at: i.at ?? EPOCH }, sections };
}
