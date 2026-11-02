/**
 * The auto-composer (plan §6): a first show for any pack, one click away on an empty timeline. It reads the song in spans
 * from the analysis (the most novel boundaries, at least minSection apart, each moved just before the strongest attack near
 * it), gives each span loved/kept widgets by its character, and places them as clips: a widget that plays on through the next
 * span is one clip, one that gives way overlaps the next one by a fade, on the next track of its kind. Bases at the bottom,
 * then accents, the entering part's window, the casket on top. Knobs stay at OUR defaults. Deterministic.
 *
 * Given the shared layer maths and the tag vocabulary (plan 2026-10-31 §9), it also reads the feel words of the user's
 * description, routes accents to the instrument tracks they suit, and gives an instrument that enters a span its own window.
 */
import { groupChords } from '../../widgets/chords';
import type { WaLayers } from '../../widgets/layers';
import { feelWordsIn, tracksFor, type TagWords } from '../../widgets/tags';
import type { Chord, Listen, Note, Region, TrackId, WidgetMeta } from '../../widgets/types';
import { TRACK_IDS, TRACKS } from '../pack/instruments';
import type { SongPack } from '../pack/pack';
import { DEFAULT_FADE, MAX_LAYERS, SHOW_VERSION, freeTrack, type Clip, type Layer, type Show } from '../show/show';
import { sectionCharacters, type Character, type Span } from './character';
import { enteringTrack, presence } from './instruments';
import { FEEL_BONUS, FEEL_BONUS_MAX, INSTRUMENT_BONUS, LINE_BY_INSTRUMENT, PRESENT, TASTE, type TasteRole } from './taste';

export interface ComposeInput {
  pack: Pick<SongPack, 'id' | 'title' | 'duration' | 'notes' | 'sections'> & Partial<Pick<SongPack, 'tracks' | 'beats' | 'loudness' | 'kind'>>;
  /** The collection; a widget's `tags` (lab/tags.json) give its feel and instrument words. */
  widgets: ReadonlyMap<string, WidgetMeta>;
  /** Shortest span, s (15). */
  minSection?: number;
  /** Most spans (max(1, round(duration / 30))). */
  maxSections?: number;
  /** composer.at (the studio passes now); default the epoch, so the same input gives the same show. */
  at?: string;
  /** The user's words for the show (shows/<id>.description.md): its feel words weigh in the choice. */
  description?: string;
  /** The shared layer maths and the tag vocabulary: with both, the composer uses tags and instruments. */
  layers?: WaLayers;
  words?: TagWords;
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

/** The spans the show is composed in: from the analysis sections, dropping the least novel boundaries (first those that touch a span
    shorter than minSection, then until there are at most maxSections), then each moved to the strongest attack near it. */
export function pickSections(i: ComposeInput): Span[] {
  return pick(i, groupChords(i.pack.notes));
}

const score = (fit: Partial<Character>, c: Character) => (Object.keys(fit) as (keyof Character)[]).reduce((a, k) => a + (fit[k] ?? 0) * c[k], 0);

/** The window an entering part gets: left in even spans, right in odd ones. */
export const enteringRegion = (k: number): Region =>
  ({ mode: 'window', shape: 'ellipse', x: k % 2 ? 0.75 : 0.25, y: 0.5, w: 0.4, h: 0.5, feather: 0.3, blend: 'lighten', fit: 'cover' });

/** What the composer hears of the tracks in one span: each track present in it (presence ≥ PRESENT). */
interface Hearing { present: Map<TrackId, number>; words: TagWords; pack: ComposeInput['pack'] }

/** The track (or family) an instrument word list suits in this span, the most present (ties: TRACKS order, then a
    family): a TrackId when it is present; 'family:<f>' when two or more of that family's tracks are present (its
    presence over all its tracks), else the one that is. 'all' (tutti) routes nowhere: it is what a layer hears anyway. */
function routeFor(instruments: readonly string[], h: Hearing, s: Span): Listen | null {
  const cands = new Map<Listen, number>();
  for (const word of instruments) {
    for (const t of tracksFor(word, h.words)) {
      if (t === 'all') continue;
      if (t.startsWith('family:')) {
        const f = t.slice(7), members = [...h.present.keys()].filter((id) => TRACKS[id].family === f);
        if (members.length === 1) cands.set(members[0], h.present.get(members[0])!);
        else if (members.length >= 2 && !cands.has(t)) {
          const notes: Note[] = TRACK_IDS.filter((id) => TRACKS[id].family === f).flatMap((id) => h.pack.tracks?.[id]?.notes ?? []);
          cands.set(t, presence(notes, s));
        }
      } else if (h.present.has(t as TrackId)) cands.set(t, h.present.get(t as TrackId)!);
    }
  }
  const rank = (l: Listen) => { const k = TRACK_IDS.indexOf(l as TrackId); return k >= 0 ? k : TRACK_IDS.length; };
  let best: Listen | null = null;
  for (const [l, p] of cands) {
    if (best === null) { best = l; continue; }
    const bp = cands.get(best)!;
    if (p > bp || (p === bp && (rank(l) < rank(best) || (rank(l) === rank(best) && l < best)))) best = l;
  }
  return best;
}

/** Whether an instrument word list names this track, itself or its family. */
const names = (instruments: readonly string[], track: TrackId, words: TagWords) =>
  instruments.some((w) => tracksFor(w, words).some((t) => t === track || t === `family:${TRACKS[track].family}`));

export function composeShow(i: ComposeInput): Show {
  const { pack, widgets } = i;
  const chords = groupChords(pack.notes);
  const d = ms(pack.duration);
  // No attacks at all (a silent recording): one quiet span, whatever the analysis found.
  const spans = chords.length ? pick(i, chords) : [{ start: 0, end: d }];
  const chars = sectionCharacters(pack.notes, spans, chords);
  const liked = (id: string) => { const v = widgets.get(id)?.verdict?.v; return v === 'love' || v === 'keep'; };
  const of = (role: TasteRole) => TASTE.filter((t) => t.role === role && liked(t.id));
  const bases = of('base'), accents = of('accent'), tops = of('top');
  // Without any of the taste's bases, the first loved, then kept, widget of the collection fills in.
  const fallback = [...widgets.values()].filter((m) => m.verdict?.v === 'love').concat([...widgets.values()].filter((m) => m.verdict?.v === 'keep'))
    .map((m) => m.id).find((id) => !TASTE.some((t) => t.id === id && t.role !== 'base'));

  // Tags and instruments (§9) only with the layer maths and the vocabulary. Without them every bonus is 0, and no layer
  // listens to a part, sits in a region or follows a curve. Roles stay the taste's; tags give feel and instrument words.
  const v2 = i.layers && i.words ? { layers: i.layers, words: i.words } : null;
  const feel = v2 ? new Set(feelWordsIn(i.description ?? '', v2.words)) : new Set<string>();
  const tags = (id: string) => widgets.get(id)?.tags ?? null;
  const bonus = (id: string) => (feel.size ? Math.min(FEEL_BONUS_MAX, FEEL_BONUS * (tags(id)?.feel.filter((w) => feel.has(w)).length ?? 0)) : 0);
  const withTracks = v2 ? TRACK_IDS.filter((id) => (pack.tracks?.[id]?.notes.length ?? 0) > 0) : [];
  const lineFor = (id: string): Listen | null => {
    const inst = tags(id)?.instruments ?? [];
    return LINE_BY_INSTRUMENT.find(([, list]) => list.some((w) => inst.includes(w)))?.[0] ?? null;
  };

  let prevBase: string | null = null;
  const stacks: Stacked[] = spans.map((s, k) => {
    const c = chars[k], layers: Stacked['layers'] = [];
    const hear: Hearing | null = v2 && withTracks.length ? { present: new Map(), words: v2.words, pack } : null;
    if (hear) for (const id of withTracks) { const p = presence(pack.tracks![id]!.notes, s); if (p >= PRESENT) hear.present.set(id, p); }
    const route = (id: string) => (hear ? routeFor(tags(id)?.instruments ?? [], hear, s) : null);
    let base: string | null = null;
    if (bases.length) {
      const val = (b: (typeof bases)[number]) => score(b.fit, c) + bonus(b.id);
      let best = bases[0], bestScore = val(best);
      for (const b of bases.slice(1)) { const v = val(b); if (v > bestScore) { best = b; bestScore = v; } }
      const prev = bases.find((b) => b.id === prevBase);
      base = prev && val(prev) >= bestScore - 0.1 ? prev.id : best.id;
    } else base = fallback ?? null;
    if (base) layers.push({ widget: base, role: ROLE.base });   // bases hear all notes
    prevBase = base;
    let accent: { id: string; v: number; listen: Listen | null } | null = null;
    for (const a of accents) {
      const listen = route(a.id), v = score(a.fit, c) + bonus(a.id) + (listen ? INSTRUMENT_BONUS : 0);
      if (v >= 0.5 && (!accent || v > accent.v)) accent = { id: a.id, v, listen };
    }
    if (accent) {
      // A song without tracks: an accent of a low instrument follows the bass line, one of a high instrument the melody.
      const listen = accent.listen ?? (v2 && !withTracks.length ? lineFor(accent.id) : null);
      layers.push({ widget: accent.id, role: ROLE.accent, ...(listen ? { listen } : {}) });
    }
    const top: Stacked['layers'] = [];
    if (c.loud >= 0.75 && c.dense >= 0.5) {
      for (const t of tops) if (t.id === 'casket') { const l = route('casket'); top.push({ widget: 'casket', role: ROLE.top, ...(l ? { listen: l } : {}) }); }
    }
    // An instrument that enters here gets its own window, seen while it plays: the best-scoring loved or kept widget
    // (a base or an accent) that suits it and is not in the stack yet. At most one per span, under the top.
    const enter = v2 ? enteringTrack(pack, s) : null;
    if (v2 && enter && layers.length + top.length < MAX_LAYERS) {
      let best: { id: string; v: number } | null = null;
      for (const t of TASTE) {
        if (t.role === 'top' || !liked(t.id) || layers.some((l) => l.widget === t.id) || !names(tags(t.id)?.instruments ?? [], enter, v2.words)) continue;
        const v = score(t.fit, c) + bonus(t.id);
        if (!best || v > best.v) best = { id: t.id, v };
      }
      if (best) {
        const l: Stacked['layers'][number] = { widget: best.id, role: ROLE.entering, listen: enter, region: enteringRegion(k) };
        const intensity = v2.layers.presets.plays(s, pack.tracks![enter]!.notes);
        if (intensity.length) l.intensity = intensity;
        layers.push(l);
      }
    }
    layers.push(...top);
    return { span: s, layers };
  });
  return { version: SHOW_VERSION, id: pack.id, song: pack.id, title: pack.title, composer: { by: 'auto', at: i.at ?? EPOCH }, clips: place(stacks, d) };
}

/** A span's stack, bottom → top, each layer with the kind of track it goes on. */
interface Stacked { span: Span; layers: (Layer & { role: number })[] }
/** Each kind has two tracks: one that gives way overlaps the next one for its fade, so they must not share. */
const ROLE = { base: 0, accent: 2, entering: 4, top: 6 } as const;
/** How long two clips that give way to each other overlap, half on each side of the boundary. */
const CROSS = DEFAULT_FADE;

const same = (a: Layer, b: Layer): boolean => a.widget === b.widget && a.listen === b.listen
  && JSON.stringify(a.region) === JSON.stringify(b.region) && !a.intensity?.length && !b.intensity?.length;

/** The stacks as clips: the same widget on the same part, in the same place, in the next span too plays on as one clip; one
    that gives way runs on past the boundary, under what comes next, while they cross. Then only the tracks in use. */
function place(stacks: readonly Stacked[], duration: number): Clip[] {
  const clips: Clip[] = [];
  const open = new Map<number, Clip & { role: number }>();   // the clip of each kind that reached the last span's end
  let n = 0;
  for (const { span, layers } of stacks) {
    const fresh = new Map<number, Clip & { role: number }>();
    for (const l of layers) {
      const was = open.get(l.role);
      if (was && same(was, l) && Math.abs(was.end - span.start) < 1e-6) {
        was.end = span.end;
        fresh.set(l.role, was);
        continue;
      }
      const { role, ...rest } = l;
      const start = span.start > 0 ? ms(Math.max(0, span.start - CROSS / 2)) : 0;
      const clip = { id: `c${++n}`, start, end: span.end, track: role, role, ...rest };
      clips.push(clip);
      fresh.set(role, clip);
    }
    // What does not go on gives way: it runs a little past the boundary.
    for (const [role, c] of open) if (fresh.get(role) !== c && Math.abs(c.end - span.start) < 1e-6) c.end = ms(Math.min(duration, c.end + CROSS / 2));
    open.clear();
    for (const [role, c] of fresh) open.set(role, c);
  }
  // On the first of its kind's two tracks unless that one is taken while it plays, in time order.
  const placed: Clip[] = [];
  for (const c of clips.sort((a, b) => a.start - b.start || a.track - b.track)) {
    c.track = freeTrack(placed, c, c.track);
    placed.push(c);
  }
  // Only the tracks in use, in their order.
  const used = [...new Set(placed.map((c) => c.track))].sort((a, b) => a - b);
  return placed.map(({ role: _role, ...c }: Clip & { role?: number }) => ({ ...c, track: used.indexOf(c.track) }));
}
