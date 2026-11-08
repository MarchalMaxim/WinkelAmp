/**
 * The intensity lane under the timeline (the user's "modulator"): the selected clip's curve, like an automation lane in DJ
 * software, in the widget's hue, the attacks of the part it listens to as ticks, the loudness faint behind.
 *
 * - Click on empty space: a pivot there (snapped to the nearest beat when Snap is on), and keep the button down to
 *   drag it at once.
 * - Drag a pivot: it stays between its neighbours; Shift is fine (no snap, a tenth of the speed), Alt only unsnaps.
 * - Drag a sloped segment up or down to bend it (its midpoint follows the pointer); a flat or held segment moves
 *   up and down instead.
 * - Double-click or right-click a pivot: delete it. Right-click a segment: Linear / Ease / Hold.
 * - The shapes on the strip above the lanes (or right-click empty space): the shared presets (lab/layers/automation.js)
 *   in one click, shown on the lane as a dashed line while the pointer is on one. They fill the clip. "Lowest" sets how far
 *   they go down.
 * - Draw: drag across the lane and the line you draw becomes the curve there, in one gesture.
 * - Bigger: a taller open lane; the picture gives up the room.
 * - Every gesture is one undo step. The lane follows the timeline's zoom, inside the clip.
 *
 * The curve is drawn and hit-tested through the shared automationAt: no second formula here.
 */
import './lanes.css';
import type { SongPack } from '../pack/pack';
import { heardSets } from '../show/note-values';
import { picksId, type Clip, type Show } from '../show/show';
import { NOTE_TYPE_LABELS } from '../../widgets/tags';
import type { Span, WaLayers } from '../../widgets/layers';
import { studioLayers } from '../../widgets/layers-source';
import type { Chord, Pivot, Shape } from '../../widgets/types';
import type { Store, StudioState } from './store';

// ---- pure helpers (tests/lanes-math.test.ts) --------------------------------------------------------------------

const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
const ms = (t: number): number => Math.round(t * 1000) / 1000;

/** Where a pivot lands at time t: with Snap on and not fine, the nearest beat within 0.25 s, else t; always inside
    the span; rounded to the millisecond. */
export function snapTime(t: number, o: { beats: readonly number[]; snap: boolean; fine: boolean; span: Span }): number {
  let x = t;
  if (o.snap && !o.fine && o.beats.length) {
    let lo = 0, hi = o.beats.length;                     // the first beat ≥ t
    while (lo < hi) { const m = (lo + hi) >> 1; if (o.beats[m] < t) lo = m + 1; else hi = m; }
    let best: number | null = null;
    for (const k of [lo - 1, lo]) {
      const b = o.beats[k];
      if (b !== undefined && Math.abs(b - t) <= 0.25 && (best === null || Math.abs(b - t) < Math.abs(best - t))) best = b;
    }
    if (best !== null) x = best;
  }
  return clamp(ms(clamp(x, o.span.start, o.span.end)), o.span.start, o.span.end);
}

/** How much a drag of dyFraction of the lane's height (negative: up) bends a linear segment from v0 to v1: dragging up
    bows it up, whichever way it runs (a positive bend reaches the next value early, so a rising segment bows up and a
    falling one down). The same feel on any segment: half the lane's height is a full bend. Flat segments do not bend
    (0). −1..1, to 3 decimals; the lane adds it to the bend the segment had when the drag began. */
export function bendFromDrag(v0: number, v1: number, dyFraction: number): number {
  const d = v1 - v0;
  if (Math.abs(d) < 1e-6 || !Number.isFinite(dyFraction)) return 0;
  return Math.round(clamp(-Math.sign(d) * dyFraction * BEND_PER_LANE, -1, 1) * 1000) / 1000 || 0;
}
const BEND_PER_LANE = 2;

/** The pivots with a new one at t (value v) in order, a split segment keeping its hold or ease, and its index; null
    when the clip already has `max` pivots (an edit would keep only the first max, dropping the last). */
export function addPivot(piv: readonly Pivot[], t: number, v: number, max: number): { pivots: Pivot[]; index: number } | null {
  if (piv.length >= max) return null;
  const out = piv.map((p) => ({ ...p }));
  let at = out.findIndex((p) => p.t > t);
  if (at < 0) at = out.length;
  const prev = out[at - 1], np: Pivot = { t, v };
  if (prev?.shape === 'hold' || prev?.shape === 'ease') np.shape = prev.shape;
  out.splice(at, 0, np);
  return { pivots: out, index: at };
}

/** The part of a curve inside a span, drawing the same line there: the pivots inside, and edge pivots where a segment
    crosses the span's edge. A crossing ease or bend becomes a few straight pieces, since a cut one would change its shape. */
export function sliceCurve(piv: readonly Pivot[], span: Span, at: (t: number) => number, samples = 12): Pivot[] {
  const out: Pivot[] = [], round = (v: number) => Math.round(v * 1000) / 1000;
  const add = (p: Pivot) => { if (!out.length || out[out.length - 1].t < p.t) out.push(p); };
  for (let i = 0; i < piv.length; i++) {
    const p = piv[i], q = piv[i + 1];
    if (!q) { if (p.t <= span.end) add(p.t >= span.start ? { ...p } : { t: span.start, v: p.v }); else add({ t: span.end, v: p.v }); break; }
    if (q.t <= span.start) continue;
    if (p.t >= span.end) { add(p.t === span.end ? { ...p } : { t: span.end, v: p.v }); break; }
    const a = Math.max(p.t, span.start), b = Math.min(q.t, span.end);
    if (a === p.t && b === q.t) { add({ ...p }); continue; }
    if (p.shape === 'hold') { add({ t: ms(a), v: p.v, shape: 'hold' }); if (b < q.t) add({ t: ms(b), v: p.v }); continue; }
    if (p.shape !== 'ease' && !p.bend) { add({ t: ms(a), v: round(at(a)) }); if (b < q.t) add({ t: ms(b), v: round(at(b)) }); continue; }
    if (a === p.t && p.bend && !p.shape) { add({ ...p }); add({ t: ms(b), v: round(at(b)) }); continue; }   // a bend cut short at its far end keeps its bend
    for (let k = 0; k <= samples; k++) {
      if (k === samples && b === q.t) break;
      const t = a + ((b - a) * k) / samples;
      add({ t: ms(t), v: round(at(t)) });
    }
  }
  return out;
}

/** A drawn line as few pivots as draw it to within eps pixels (Douglas-Peucker). pts in time order; x, y: to pixels. */
export function simplifyStroke(pts: readonly { t: number; v: number }[], x: (t: number) => number, y: (v: number) => number, eps = 2): Pivot[] {
  if (pts.length <= 2) return pts.map((p) => ({ t: ms(p.t), v: Math.round(clamp(p.v, 0, 1) * 1000) / 1000 }));
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const walk = (a: number, b: number): void => {
    let best = -1, bd = eps;
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(x(pts[i].t), y(pts[i].v), x(pts[a].t), y(pts[a].v), x(pts[b].t), y(pts[b].v));
      if (d > bd) { bd = d; best = i; }
    }
    if (best >= 0) { keep[best] = true; walk(a, best); walk(best, b); }
  };
  walk(0, pts.length - 1);
  return pts.filter((_, i) => keep[i]).map((p) => ({ t: ms(p.t), v: Math.round(clamp(p.v, 0, 1) * 1000) / 1000 }));
}

export type Hit = { kind: 'pivot'; index: number } | { kind: 'segment'; index: number } | { kind: 'empty' };

const PIVOT_R = 6, SEGMENT_D = 5, SAMPLES = 32;

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const u = L ? clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1) : 0;
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

/** What the pointer at (px, py) is over: the nearest pivot within 6 px, else the nearest segment within 5 px, else
    empty. curve: the lane's curve (the shared automationAt), so bent and eased segments are hit where they are drawn;
    without it a segment is straight. A held segment is a step either way: flat to the next pivot, then straight down. */
export function hitTest(pivots: readonly Pivot[], x: (t: number) => number, y: (v: number) => number, px: number, py: number,
  curve?: (t: number) => number): Hit {
  let best = -1, bd = Infinity;
  pivots.forEach((p, i) => { const d = Math.hypot(x(p.t) - px, y(p.v) - py); if (d <= PIVOT_R && d < bd) { bd = d; best = i; } });
  if (best >= 0) return { kind: 'pivot', index: best };
  bd = Infinity;
  for (let i = 0; i + 1 < pivots.length; i++) {
    const p = pivots[i], q = pivots[i + 1], x0 = x(p.t), x1 = x(q.t);
    if (px < Math.min(x0, x1) - SEGMENT_D || px > Math.max(x0, x1) + SEGMENT_D) continue;
    let pts: [number, number][];
    if (p.shape === 'hold') pts = [[x0, y(p.v)], [x1, y(p.v)], [x1, y(q.v)]];
    else if (!curve || q.t === p.t) pts = [[x0, y(p.v)], [x1, y(q.v)]];
    else {
      pts = [];
      for (let k = 0; k <= SAMPLES; k++) {
        const t = k === SAMPLES ? q.t : p.t + ((q.t - p.t) * k) / SAMPLES;
        pts.push([x(t), y(k === SAMPLES ? q.v : curve(t))]);
      }
    }
    for (let k = 0; k + 1 < pts.length; k++) {
      const d = distToSegment(px, py, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
      if (d <= SEGMENT_D && d < bd) { bd = d; best = i; }
    }
  }
  return best >= 0 ? { kind: 'segment', index: best } : { kind: 'empty' };
}

// ---- the lanes ----------------------------------------------------------------------------------------------------

export interface LaneDeps {
  store: Store; song: SongPack; duration(): number; names(id: string): string; hue(id: string): number;
  /** What of the song the timeline shows now. */
  view(): { a: number; b: number };
}
export interface Lanes { update(s: StudioState): void; setTime(t: number): void; redraw(): void; timeAt(clientX: number): number | null }

/** The selected clip's lane: its span and its pivots. */
interface Piece { clip: string; span: Span; pivots: Pivot[] }
interface LaneView { clip: string; widget: string; listen?: string; el: HTMLElement; cv: HTMLCanvasElement }
interface Geo { a: number; b: number; W: number; H: number; pad: number; x(t: number): number; y(v: number): number; t(x: number): number; v(y: number): number }
type Target = { piece: Piece; hit: Hit } | null;
/** A shape on the strip: its word, what it does, and a small picture of it (an SVG path in 24×12). */
interface ShapeChip { id: string; label: string; menu: string; note?: string; icon: string; make(span: Span, floor: number): Pivot[] }
interface Drag {
  kind: 'pivot' | 'bend' | 'level'; piece: Piece; index: number; group: string; moved: boolean; bend0: number;
  px: number; py: number; fine: boolean; t0: number; v0: number; t: number; v: number;
}

const PREFS = 'wa-studio.lanes';
const ICONS = {
  in: 'M1 11 L10 1 H23', out: 'M1 1 H14 L23 11', build: 'M1 11 C13 11 19 8 23 1', decay: 'M1 1 C5 8 11 11 23 11',
  swell: 'M1 11 C6 11 8 1 12 1 S18 11 23 11', dip: 'M1 1 C6 1 8 11 12 11 S18 1 23 1',
  breathe: 'M1 11 C3 11 3 1 6 1 S9 11 12 11 S15 1 18 1 S21 11 23 11', steps: 'M1 11 H6 V8 H12 V5 H18 V1 H23',
  beat: 'M1 1 L3 11 H5 V1 L7 11 H9 V1 L11 11 H13 V1 L15 11 H17 V1 L19 11 H21 V1 L23 11', bar: 'M1 1 L6 11 H12 V1 L17 11 H23',
  gate: 'M1 11 H5 V1 H10 V11 H14 V1 H23', follow: 'M1 9 L4 6 L6 8 L9 2 L12 4 L14 3 L17 8 L20 7 L23 9', plays: 'M1 11 H3 V1 H16 V11 H23', half: 'M1 6 H23', clear: 'M1 1 H23',
};
const LISTEN_WORDS: Record<string, string> = {
  melody: 'melody', bassline: 'bass line', inner: 'inner voices', low: 'low notes', high: 'high notes', accents: 'accents',
  ...Object.fromEntries(Object.entries(NOTE_TYPE_LABELS).map(([t, label]) => [t, label.toLowerCase()])),
};
export const listenWord = (l: string): string => (picksId(l) !== null ? 'your picks' : LISTEN_WORDS[l] ?? (l.startsWith('family:') ? l.slice(7) : l));
const pct = (v: number): string => `${Math.round(v * 100)} %`;
const stamp = (t: number): string => {
  t = Math.max(0, t);
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
};
const median = (xs: readonly number[]): number => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const samePivots = (a: readonly Pivot[] | undefined, b: readonly Pivot[] | undefined): boolean => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

export function mountLanes(host: HTMLElement, d: LaneDeps): Lanes {
  const L: WaLayers = studioLayers();
  let prefs: { snap: boolean; draw: boolean; big: boolean; floor: number } = { snap: true, draw: false, big: false, floor: 0 };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS) ?? '{}') }; } catch { /* private window */ }
  const savePrefs = () => { try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* private window */ } };

  const root = document.createElement('div');
  root.className = 'lanes';
  root.innerHTML = `<div class="lanes-bar">
      <span class="lanes-title">Intensity</span>
      <button type="button" class="lanes-toggle" data-snap title="Pivots snap to the nearest beat (hold Shift for fine moves without snapping, Alt to place freely)">Snap to beats</button>
      <button type="button" class="lanes-toggle" data-draw title="Drag across the lane to draw the curve in one go">Draw</button>
      <button type="button" class="lanes-toggle" data-big title="A taller lane, with less room for the picture">Bigger</button>
      <span class="lanes-hint"></span>
      <span class="lanes-spacer"></span>
      <label class="lanes-floor" title="How far down the shapes below go"><span>Lowest</span><input type="range" data-floor min="0" max="0.9" step="0.05" aria-label="How far down the shapes go"><output></output></label>
    </div>
    <div class="lanes-shapes" role="group" aria-label="Shapes for the curve"></div>
    <div class="lanes-body"><div class="lanes-list"></div><div class="lanes-head" hidden></div><div class="lanes-tip" hidden></div></div>`;
  host.append(root);
  const list = root.querySelector<HTMLElement>('.lanes-list')!, body = root.querySelector<HTMLElement>('.lanes-body')!;
  const head = root.querySelector<HTMLElement>('.lanes-head')!, tip = root.querySelector<HTMLElement>('.lanes-tip')!;
  const hint = root.querySelector<HTMLElement>('.lanes-hint')!, strip = root.querySelector<HTMLElement>('.lanes-shapes')!;
  const snapBtn = root.querySelector<HTMLButtonElement>('[data-snap]')!, drawBtn = root.querySelector<HTMLButtonElement>('[data-draw]')!, bigBtn = root.querySelector<HTMLButtonElement>('[data-big]')!;
  const floorIn = root.querySelector<HTMLInputElement>('[data-floor]')!, floorOut = root.querySelector<HTMLOutputElement>('.lanes-floor output')!;

  let view: LaneView | null = null, builtKey = '', drag: Drag | null = null, gesture = 0, raf = 0, now = 0;
  let hover: Target = null;
  let selected: { clip: string; index: number } | null = null;
  /** The arrow-key nudge in progress: one undo step per pivot from the first press until the key is let go (a held
      key's repeats are one step; another pivot, a key-up or leaving the lane starts a new one). */
  let nudge: { at: string; group: string } | null = null;
  let menu: HTMLElement | null = null;
  /** The shape under the pointer, as it would land (dashed on the lane). */
  let ghost: Pivot[] | null = null;
  /** The line being drawn, in time order. */
  let pen: { pts: { t: number; v: number }[]; piece: Piece } | null = null;
  /** The shape last put on the clip, while the curve is still what it wrote: "Lowest" reshapes it. */
  let lastShape: { id: string; at: string; wrote: string } | null = null;
  const ticksFor = new Map<string, Chord[]>();

  const state = () => d.store.state;
  const show = (): Show | null => state().show;

  const selectedClip = (): Clip | null => { const st = state(); return st.show?.clips.find((c) => c.id === st.selected.clip) ?? null; };

  const syncBar = () => {
    snapBtn.setAttribute('aria-pressed', String(prefs.snap));
    drawBtn.setAttribute('aria-pressed', String(prefs.draw));
    bigBtn.setAttribute('aria-pressed', String(prefs.big));
    root.classList.toggle('big', prefs.big);
    root.classList.toggle('drawing', prefs.draw);
    floorIn.value = String(prefs.floor); floorOut.textContent = pct(prefs.floor);
    const open = !!selectedClip();
    hint.textContent = !open ? 'Select a clip to shape its intensity'
      : prefs.draw ? 'Drag across the lane to draw the curve'
      : 'Click to add · drag · Shift: fine · double-click: delete';
    drawShapes(open && !state().ui.recording);
  };
  snapBtn.addEventListener('click', () => { prefs.snap = !prefs.snap; savePrefs(); syncBar(); draw(); });
  drawBtn.addEventListener('click', () => { prefs.draw = !prefs.draw; savePrefs(); syncBar(); });
  bigBtn.addEventListener('click', () => { prefs.big = !prefs.big; savePrefs(); syncBar(); });
  floorIn.addEventListener('input', () => {
    prefs.floor = Number(floorIn.value); floorOut.textContent = pct(prefs.floor);
    const now = lastShape && openKey() === lastShape.at && curveKey() === lastShape.wrote ? lastShape.id : null;
    if (now) putShape(now, floorGroup);
  });
  floorIn.addEventListener('change', () => { savePrefs(); floorGroup = `intensity:floor:${++gesture}`; });

  // ---- what the lane covers ----

  /** The selected clip's part: its span and a copy of its pivots. */
  const pieceOf = (): Piece | null => {
    const c = selectedClip();
    return c ? { clip: c.id, span: { start: c.start, end: c.end }, pivots: (c.intensity ?? []).map((p) => ({ ...p })) } : null;
  };

  const geo = (v: LaneView): Geo => {
    const c = selectedClip() ?? { start: 0, end: 1 };
    // The clip, or the part of it the timeline is zoomed to.
    const z = d.view(), oa = Math.max(c.start, z.a), ob = Math.min(c.end, z.b);
    const [a, b] = ob - oa >= 2 ? [oa, ob] : [c.start, c.end];
    const W = Math.max(1, v.cv.clientWidth), H = Math.max(1, v.cv.clientHeight), pad = 8;
    const span = b - a || 1;
    return {
      a, b, W, H, pad,
      x: (t) => ((t - a) / span) * W, t: (x) => a + (x / W) * span,
      y: (val) => pad + (1 - val) * (H - 2 * pad), v: (y) => 1 - (y - pad) / (H - 2 * pad),
    };
  };

  // ---- the shapes ----

  let floorGroup = 'intensity:floor:0', chipsKey = '';
  const beatGap = (): number => { const b = d.song.beats, g = median(b.slice(1).map((x, i) => x - b[i])); return g > 0 ? g : 0.5; };
  const openKey = () => selectedClip()?.id ?? '';
  const curveKey = () => JSON.stringify(selectedClip()?.intensity ?? []);

  const followFloor = (): number => (prefs.floor > 0 ? prefs.floor : 0.35);
  const shapes = (): ShapeChip[] => {
    const P = L.presets, l = selectedClip(), beats = d.song.beats, gap = beatGap();
    const fade = (span: Span) => Math.min(span.end - span.start, 4 * gap);
    const chips: ShapeChip[] = [
      { id: 'in', label: 'Fade in', menu: 'Fade in', note: `over 4 beats (${(4 * gap).toFixed(1)} s)`, icon: ICONS.in, make: (sp, floor) => P.fadeIn(sp, fade(sp), { floor }) },
      { id: 'out', label: 'Fade out', menu: 'Fade out', note: `over 4 beats (${(4 * gap).toFixed(1)} s)`, icon: ICONS.out, make: (sp, floor) => P.fadeOut(sp, fade(sp), { floor }) },
      { id: 'build', label: 'Build', menu: 'Build', note: 'slowly, all the way through', icon: ICONS.build, make: (sp, floor) => P.build(sp, { floor }) },
      { id: 'decay', label: 'Die away', menu: 'Die away', note: 'quickly, then a long tail', icon: ICONS.decay, make: (sp, floor) => P.decay(sp, { floor }) },
      { id: 'swell', label: 'Swell', menu: 'Swell', note: 'up to the middle and back', icon: ICONS.swell, make: (sp, floor) => P.swell(sp, { floor }) },
      { id: 'dip', label: 'Dip', menu: 'Dip', note: 'down in the middle and back', icon: ICONS.dip, make: (sp, floor) => P.dip(sp, { floor }) },
      { id: 'breathe', label: 'Breathe', menu: 'Breathe', note: 'up and down every 4 beats', icon: ICONS.breathe, make: (sp, floor) => P.breathe(sp, beats, { every: 4, floor }) },
      { id: 'steps', label: 'Steps', menu: 'Steps', note: 'four steps up', icon: ICONS.steps, make: (sp, floor) => P.steps(sp, { n: 4, floor }) },
      { id: 'beat', label: 'Each beat', menu: 'Pulse every beat', icon: ICONS.beat, make: (sp, floor) => P.pulse(sp, beats, { every: 1, floor }) },
      { id: 'bar', label: 'Each bar', menu: 'Pulse every bar', note: '4 beats', icon: ICONS.bar, make: (sp, floor) => P.pulse(sp, beats, { every: 4, floor }) },
      { id: 'gate', label: 'Loud parts', menu: 'Gate on loudness', note: 'open in the louder half', icon: ICONS.gate, make: (sp, floor) => {
        // The lane runs late: read it that much later, so the threshold is the music inside the span.
        const lo = d.song.loudness, hop = lo.hop, lag = L.LOUDNESS_LAG.mean, n = lo.values.length;
        const inSpan = lo.values.slice(Math.min(Math.floor((sp.start + lag) / hop), n - 1), Math.ceil((sp.end + lag) / hop));
        return P.gate(sp, lo, { above: Math.min(0.95, Math.max(0.05, median(inSpan) || 0.5)), floor });
      } },
      // Quiet passages must not empty the screen: with "Lowest" at 0 it stays above 35 %.
      { id: 'follow', label: 'Follows the sound', menu: 'Follow the loudness', note: `rises and falls with the music, never below ${pct(followFloor())}`,
        icon: ICONS.follow, make: (sp, floor) => P.follow(sp, d.song.loudness, { floor: floor > 0 ? floor : 0.35 }) },
    ];
    if (l?.listen && l.listen !== 'all') {
      const listen = l.listen;
      chips.push({ id: 'plays', label: 'While it plays', menu: 'While its part plays', note: listenWord(listen), icon: ICONS.plays,
        make: (sp, floor) => P.plays(sp, L.listenNotes({ notes: d.song.notes, tracks: d.song.tracks, picks: heardSets(show()?.picks) }, listen).notes, { floor }) });
    }
    chips.push({ id: 'half', label: 'Half', menu: 'Half', note: 'a steady 50 %', icon: ICONS.half, make: (sp) => P.level(sp, 0.5) });
    chips.push({ id: 'clear', label: 'Full', menu: 'Clear curve', note: 'always at 100 %', icon: ICONS.clear, make: () => [] });
    return chips;
  };

  /** The curve over the clip's span; one undo step. */
  const putShape = (id: string, group?: string) => {
    const chip = shapes().find((c) => c.id === id), pc = pieceOf();
    if (!chip || !pc) return;
    const piv = chip.make(pc.span, prefs.floor).map((p) => ({ ...p, t: ms(p.t) }));
    selected = null;
    commit(pc, sliceCurve(piv, pc.span, (t) => L.automationAt(piv, t)), group ?? `intensity:shape:${++gesture}`);
    lastShape = { id, at: openKey(), wrote: curveKey() };
    syncBar();
    draw();
  };

  const drawShapes = (on: boolean) => {
    const chips = shapes(), key = JSON.stringify([chips.map((c) => [c.id, c.note]), on]);
    if (key !== chipsKey) {
      chipsKey = key;
      strip.innerHTML = chips.map((c) => `<button type="button" class="lanes-shape" data-shape="${c.id}" title="${c.menu}${c.note ? `: ${c.note}` : ''}" ${on ? '' : 'disabled'}>
        <svg viewBox="0 0 24 12" width="24" height="12" aria-hidden="true"><path d="${c.icon}"/></svg>${c.label}</button>`).join('');
    }
    const cur = lastShape && openKey() === lastShape.at && curveKey() === lastShape.wrote ? lastShape.id : '';
    strip.querySelectorAll<HTMLElement>('[data-shape]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.shape === cur)));
  };
  const chipOf = (e: Event) => (e.target as Element).closest<HTMLButtonElement>('[data-shape]');
  strip.addEventListener('click', (e) => { const b = chipOf(e); if (b) { ghost = null; putShape(b.dataset.shape!); } });
  strip.addEventListener('pointerover', (e) => {
    const b = chipOf(e), chip = b && !b.disabled ? shapes().find((c) => c.id === b.dataset.shape) : null, pc = pieceOf();
    if (!chip || !pc) return;
    ghost = chip.make(pc.span, prefs.floor);
    draw();
  });
  strip.addEventListener('pointerout', (e) => { if (chipOf(e)) { ghost = null; draw(); } });

  const ticks = (listen: string | undefined): Chord[] => {
    const k = listen ?? 'all', song = { notes: d.song.notes, tracks: d.song.tracks, picks: heardSets(show()?.picks) };
    if (picksId(listen) !== null) return L.groupChords(L.listenNotes(song, listen).notes);   // a set changes with the show
    let c = ticksFor.get(k);
    if (!c) {
      c = L.groupChords(L.listenNotes(song, listen).notes);
      ticksFor.set(k, c);
    }
    return c;
  };

  // ---- building and drawing ----

  const build = (c: Clip | null) => {
    list.textContent = '';
    view = null;
    if (!c) {
      list.innerHTML = '<p class="lanes-empty">No clip selected: click one to shape its intensity.</p>';
      return;
    }
    const el = document.createElement('div');
    el.className = 'lane open';
    el.style.setProperty('--hue', String(d.hue(c.widget)));
    const name = d.names(c.widget) + (c.listen && c.listen !== 'all' ? ` · ${listenWord(c.listen)}` : '');
    el.innerHTML = `<canvas></canvas><span class="lane-name"></span>`;
    el.querySelector('.lane-name')!.textContent = name;
    const cv = el.querySelector('canvas')!;
    cv.tabIndex = 0;
    cv.setAttribute('role', 'application');
    cv.setAttribute('aria-label', `${name}: intensity curve. Click to add a pivot, drag to move it, Delete to remove the selected one, arrows up and down to change it.`);
    const v: LaneView = { clip: c.id, widget: c.widget, listen: c.listen, el, cv };
    wire(v);
    list.append(el);
    view = v;
  };

  const draw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (view) drawLane(view); placeHead(); }); };

  const drawLane = (v: LaneView) => {
    const cv = v.cv, dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const G = geo(v), hue = d.hue(v.widget), pc = pieceOf();
    if (!pc) return;
    const px0 = Math.max(0, Math.floor(G.x(pc.span.start))), px1 = Math.min(w, Math.ceil(G.x(pc.span.end)));

    // The loudness, faint, from the bottom; drawn earlier by the time it runs late, so it lines up with the attacks.
    const lo = d.song.loudness, hop = lo.hop, lag = L.LOUDNESS_LAG.mean;
    g.fillStyle = '#e9e2da12';
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x++) {
      const t0 = G.t(x) + lag, t1 = G.t(x + 1) + lag;
      let m = 0;
      for (let i = Math.max(0, Math.floor(t0 / hop)); i <= Math.min(lo.values.length - 1, Math.floor(t1 / hop)); i++) m = Math.max(m, lo.values[i]);
      g.lineTo(x, h - m * (h - G.pad) * 0.9);
    }
    g.lineTo(w, h); g.closePath(); g.fill();
    // The beats, while Snap is on and they are not too dense to see.
    if (prefs.snap) {
      const beats = d.song.beats, gap = median(beats.slice(1).map((b, i) => b - beats[i]));
      if (gap > 0 && G.x(G.a + gap) - G.x(G.a) >= 5) {
        g.fillStyle = '#e9e2da14';
        for (const b of beats) { if (b < G.a || b > G.b) continue; g.fillRect(Math.round(G.x(b)), 0, 1, h); }
      }
    }
    // The attacks of the part it listens to.
    g.fillStyle = `hsl(${hue} 30% 80%)`;
    const onPicks = picksId(v.listen) !== null;   // sparse, so stronger and taller
    for (const ch of ticks(v.listen)) {
      if (ch.t < G.a || ch.t > G.b) continue;
      const tall = onPicks ? h - 4 : 5 * Math.min(1, 0.4 + ch.notes.length / 6);
      g.globalAlpha = onPicks ? 0.9 : 0.15 + 0.5 * Math.min(1, ch.vel / 127) ** 2;
      g.fillRect(Math.round(G.x(ch.t)), h - 2 - tall, 1, tall);
    }
    g.globalAlpha = 1;
    // The 0 and 1 lines.
    g.fillStyle = '#e9e2da10';
    g.fillRect(px0, Math.round(G.y(1)), px1 - px0, 1); g.fillRect(px0, Math.round(G.y(0)), px1 - px0, 1);

    // The curve: sampled per pixel through the shared automationAt, with the pivots' own times so steps and corners are exact.
    const xa = G.x(pc.span.start), xb = G.x(pc.span.end);
    const curve = (t: number) => L.automationAt(pc.pivots, t);
    const ts: number[] = [];
    for (let x = Math.max(-1, Math.floor(xa)); x <= Math.min(w + 1, Math.ceil(xb)); x++) ts.push(clamp(G.t(x), pc.span.start, pc.span.end));
    for (const p of pc.pivots) { ts.push(p.t); if (p.t - 1e-6 > pc.span.start) ts.push(p.t - 1e-6); }
    ts.sort((p, q) => p - q);
    const none = !pc.pivots.length;
    g.beginPath();
    ts.forEach((t, i) => { const X = G.x(t), Y = G.y(curve(t)); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    if (!none) {
      g.lineTo(G.x(ts[ts.length - 1]), G.y(0)); g.lineTo(G.x(ts[0]), G.y(0)); g.closePath();
      g.fillStyle = `hsl(${hue} 55% 50% / 0.2)`; g.fill();
      g.beginPath();
      ts.forEach((t, i) => { const X = G.x(t), Y = G.y(curve(t)); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    }
    g.setLineDash(none ? [3, 4] : []);
    g.lineWidth = 1.75; g.lineJoin = 'round';
    g.strokeStyle = none ? `hsl(${hue} 25% 60% / 0.6)` : `hsl(${hue} 70% 66%)`;
    g.stroke(); g.setLineDash([]);
    // The hovered or dragged segment, brighter.
    const seg = drag && drag.kind !== 'pivot' ? drag.index : hover?.hit.kind === 'segment' ? hover.hit.index : -1;
    if (seg >= 0 && pc.pivots[seg + 1]) {
      const p = pc.pivots[seg], q = pc.pivots[seg + 1];
      g.beginPath();
      if (p.shape === 'hold') { g.moveTo(G.x(p.t), G.y(p.v)); g.lineTo(G.x(q.t), G.y(p.v)); g.lineTo(G.x(q.t), G.y(q.v)); }
      else for (let k = 0; k <= SAMPLES; k++) {
        const t = k === SAMPLES ? q.t : p.t + ((q.t - p.t) * k) / SAMPLES, X = G.x(t), Y = G.y(k === SAMPLES ? q.v : curve(t));
        if (k) g.lineTo(X, Y); else g.moveTo(X, Y);
      }
      g.lineWidth = 3.5; g.strokeStyle = `hsl(${hue} 80% 78% / 0.55)`; g.stroke();
    }
    // The pivots.
    pc.pivots.forEach((p, i) => {
      const on = selected?.clip === pc.clip && selected.index === i;
      const hot = (drag?.kind === 'pivot' && drag.index === i) || (hover?.hit.kind === 'pivot' && hover.hit.index === i);
      g.beginPath(); g.arc(G.x(p.t), G.y(p.v), hot ? 5.5 : 4.25, 0, Math.PI * 2);
      g.fillStyle = on ? '#fff6ee' : hot ? `hsl(${hue} 80% 76%)` : '#120d10';
      g.fill();
      g.lineWidth = 1.75; g.strokeStyle = on ? `hsl(${hue} 80% 70%)` : `hsl(${hue} 75% 70%)`; g.stroke();
    });
    drawOverlay(g, G, hue);
  };

  /** A line over the lane: the shape under the pointer, or the line being drawn. */
  const drawOverlay = (g: CanvasRenderingContext2D, G: Geo, hue: number) => {
    const line = pen?.pts ?? null;
    if (!ghost && !line) return;
    g.beginPath();
    if (line) line.forEach((p, i) => { if (i) g.lineTo(G.x(p.t), G.y(p.v)); else g.moveTo(G.x(p.t), G.y(p.v)); });
    else {
      const pv = ghost!, span = pieceOf()?.span, t0 = pv.length ? span?.start ?? G.a : G.a, t1 = pv.length ? span?.end ?? G.b : G.b;
      const xa = Math.max(0, Math.floor(G.x(t0))), xb = Math.min(G.W, Math.ceil(G.x(t1)));
      for (let x = xa; x <= xb; x++) { const Y = G.y(L.automationAt(pv, clamp(G.t(x), t0, t1))); if (x > xa) g.lineTo(x, Y); else g.moveTo(x, Y); }
    }
    g.setLineDash(line ? [] : [5, 4]); g.lineWidth = 2; g.strokeStyle = `hsl(${hue} 85% 82%)`;
    g.stroke(); g.setLineDash([]);
  };

  /** The drawn line becomes the curve where it went; the curve around it stays. One undo step. */
  const endStroke = (v: LaneView) => {
    const st = pen; pen = null;
    if (!st || !st.pts.length) { draw(); return; }
    const G = geo(v), max = L.MAX_PIVOTS - 2, pc = st.piece;
    let eps = 2, line = simplifyStroke(st.pts, G.x, G.y, eps);
    while (line.length > max) { eps *= 1.5; line = simplifyStroke(st.pts, G.x, G.y, eps); }
    const t0 = line[0].t, t1 = line[line.length - 1].t;
    selected = null;
    const old = fresh(pc), piv = [...old.filter((p) => p.t < t0 - 5e-4), ...line, ...old.filter((p) => p.t > t1 + 5e-4)];
    commit(pc, piv.slice(0, L.MAX_PIVOTS), `intensity:draw:${++gesture}`);
    update(state());
  };

  const placeHead = () => {
    const v = view;
    if (!v || !show()) { head.hidden = true; return; }
    const G = geo(v), x = G.x(now);
    head.hidden = !(now >= G.a && now <= G.b);
    head.style.left = `${x}px`;
  };

  // ---- editing ----

  const commit = (pc: Piece, pivots: Pivot[], group: string) => {
    const cur = show()?.clips.find((c) => c.id === pc.clip)?.intensity;
    if (samePivots(cur, pivots)) return;
    d.store.dispatch({ type: 'edit', edit: { kind: 'setClip', clip: pc.clip, patch: { intensity: pivots.length ? pivots : null } }, group });
  };
  const fresh = (pc: Piece): Pivot[] => (show()?.clips.find((c) => c.id === pc.clip)?.intensity ?? []).map((p) => ({ ...p }));
  const removePivot = (pc: Piece, i: number) => {
    const piv = fresh(pc);
    if (!piv[i]) return;
    piv.splice(i, 1);
    selected = null;
    commit(pc, piv, `intensity:${pc.clip}:del:${++gesture}`);
    hideTip();
  };
  const setShape = (pc: Piece, i: number, shape: Shape | 'straight') => {
    const piv = fresh(pc), p = piv[i];
    if (!p) return;
    if (shape === 'straight') delete p.bend;
    else { if (shape === 'linear') delete p.shape; else p.shape = shape; if (shape !== 'linear') delete p.bend; }
    commit(pc, piv, `intensity:${pc.clip}:shape:${++gesture}`);
  };

  /** What the pointer is over in the lane: a pivot, a segment or empty space in the clip; null outside the clip. */
  const targetAt = (v: LaneView, px: number, py: number): { G: Geo; target: Target } => {
    const G = geo(v), pc = pieceOf();
    if (!pc || px < G.x(pc.span.start) - PIVOT_R || px > G.x(pc.span.end) + PIVOT_R) return { G, target: null };
    return { G, target: { piece: pc, hit: hitTest(pc.pivots, G.x, G.y, px, py, (t) => L.automationAt(pc.pivots, t)) } };
  };

  const showTip = (v: LaneView, x: number, text: string) => {
    tip.hidden = false; tip.textContent = text;
    const bw = body.clientWidth, top = v.el.offsetTop;
    tip.style.left = `${clamp(x, 40, Math.max(40, bw - 40))}px`;
    tip.style.top = `${top}px`;
  };
  const hideTip = () => { tip.hidden = true; };

  const snapOpts = (pc: Piece, e: { shiftKey: boolean; altKey: boolean }) => ({ beats: d.song.beats, snap: prefs.snap, fine: e.shiftKey || e.altKey, span: pc.span });

  const wire = (v: LaneView) => {
    const cv = v.cv;
    const local = (e: MouseEvent) => { const r = cv.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };

    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || state().ui.recording) return;
      closeMenu();
      const { px, py } = local(e), { G, target } = targetAt(v, px, py);
      if (prefs.draw) {
        if (!target) return;
        e.preventDefault(); cv.focus({ preventScroll: true });
        pen = { pts: [{ t: ms(G.t(px)), v: clamp(G.v(py), 0, 1) }], piece: target.piece };
        cv.setPointerCapture(e.pointerId);
        draw();
        return;
      }
      if (!target) return;
      e.preventDefault(); cv.focus({ preventScroll: true });
      const pc = target.piece, group = `intensity:${pc.clip}:${++gesture}`;
      const base = { piece: pc, group, moved: false, px: e.clientX, py: e.clientY, fine: e.shiftKey, bend0: 0 };
      if (target.hit.kind === 'pivot') {
        const p = pc.pivots[target.hit.index];
        drag = { ...base, kind: 'pivot', index: target.hit.index, t0: p.t, v0: p.v, t: p.t, v: p.v };
        selected = { clip: pc.clip, index: target.hit.index };
      } else if (target.hit.kind === 'segment') {
        const i = target.hit.index, p = pc.pivots[i], q = pc.pivots[i + 1];
        if (p.shape === 'hold' || Math.abs(p.v - q.v) < 1e-3) drag = { ...base, kind: 'level', index: i, t0: p.t, v0: p.v, t: p.t, v: p.v };
        else drag = { ...base, kind: 'bend', index: i, t0: 0, v0: 0, t: 0, v: 0, bend0: p.shape ? 0 : p.bend ?? 0 };   // v: how far up it went
      } else {
        // A new pivot where the pointer is, on the curve's line of pivots; the button still down drags it.
        const t = snapTime(G.t(px), snapOpts(pc, e)), val = Math.round(clamp(G.v(py), 0, 1) * 1000) / 1000;
        const added = addPivot(fresh(pc), t, val, L.MAX_PIVOTS);
        if (!added) { showTip(v, px, `${L.MAX_PIVOTS} pivots: the most a clip takes`); return; }
        const piv = added.pivots, at = added.index;
        commit(pc, piv, group);
        pc.pivots = piv;
        drag = { ...base, kind: 'pivot', index: at, t0: t, v0: val, t, v: val, moved: true };
        selected = { clip: pc.clip, index: at };
        showTip(v, px, `${stamp(t)} · ${pct(val)}`);
      }
      cv.setPointerCapture(e.pointerId);
      cv.classList.add('dragging');
      draw();
    });

    cv.addEventListener('pointermove', (e) => {
      const { px, py } = local(e);
      if (pen) {
        const G = geo(v), first = pen.piece.span.start, last = pen.piece.span.end;
        const t = clamp(G.t(px), first, last), pts = pen.pts;
        while (pts.length && pts[pts.length - 1].t >= t) pts.pop();   // going back rubs out
        pts.push({ t, v: clamp(G.v(py), 0, 1) });
        showTip(v, G.x(t), `${stamp(t)} · ${pct(pts[pts.length - 1].v)}`);
        draw();
        return;
      }
      if (!drag && prefs.draw) { cv.style.cursor = 'crosshair'; return; }
      if (!drag) {
        const { target, G } = targetAt(v, px, py);
        hover = target;
        cv.style.cursor = !target ? 'not-allowed' : target.hit.kind === 'pivot' ? 'grab' : target.hit.kind === 'segment' ? 'ns-resize' : 'crosshair';
        if (!target) { hideTip(); draw(); return; }
        const pc = target.piece, h = target.hit;
        if (h.kind === 'pivot') { const p = pc.pivots[h.index]; showTip(v, G.x(p.t), `${stamp(p.t)} · ${pct(p.v)}`); }
        else { const t = G.t(px); showTip(v, px, `${stamp(t)} · ${pct(L.automationAt(pc.pivots, t))}`); }
        draw();
        return;
      }
      const G = geo(v), D = drag, pc = D.piece;
      const fine = e.shiftKey;
      if (fine !== D.fine) { D.px = e.clientX; D.py = e.clientY; D.t0 = D.t; D.v0 = D.v; D.fine = fine; }   // re-anchor: no jump
      const k = fine ? 0.1 : 1, inner = G.H - 2 * G.pad;
      D.t = D.t0 + ((e.clientX - D.px) / G.W) * (G.b - G.a) * k;
      D.v = D.v0 - ((e.clientY - D.py) / inner) * k;
      if (Math.abs(e.clientX - D.px) + Math.abs(e.clientY - D.py) > 1) D.moved = true;
      if (!D.moved) return;
      const piv = fresh(pc);
      if (D.kind === 'pivot') {
        const p = piv[D.index];
        if (!p) return;
        const lo = piv[D.index - 1]?.t ?? pc.span.start, hi = piv[D.index + 1]?.t ?? pc.span.end;
        const st = snapTime(D.t, snapOpts(pc, e)), t = clamp(st, lo, hi), val = Math.round(clamp(D.v, 0, 1) * 1000) / 1000;
        p.t = ms(t); p.v = val;
        const onBeat = prefs.snap && !(e.shiftKey || e.altKey) && d.song.beats.some((b) => Math.abs(b - p.t) < 5e-4);
        showTip(v, G.x(p.t), `${stamp(p.t)} · ${pct(val)}${onBeat ? ' · on a beat' : ''}${fine ? ' · fine' : ''}`);
      } else if (D.kind === 'level') {
        const p = piv[D.index], q = piv[D.index + 1];
        if (!p || !q) return;
        const val = Math.round(clamp(D.v, 0, 1) * 1000) / 1000, flat = p.shape !== 'hold';
        p.v = val; if (flat) q.v = val;
        showTip(v, px, `${pct(val)}${fine ? ' · fine' : ''}`);
      } else {
        const p = piv[D.index], q = piv[D.index + 1];
        if (!p || !q) return;
        const b = Math.round(clamp(D.bend0 + bendFromDrag(p.v, q.v, -D.v), -1, 1) * 1000) / 1000 || 0;
        delete p.shape;
        if (b) p.bend = b; else delete p.bend;
        showTip(v, px, b ? `curve ${b > 0 ? '+' : '−'}${Math.abs(b).toFixed(2)}${fine ? ' · fine' : ''}` : 'straight');
      }
      commit(pc, piv, D.group);
    });

    const end = (e: PointerEvent) => {
      if (pen) { if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId); hideTip(); endStroke(v); return; }
      if (!drag) return;
      drag = null;
      cv.classList.remove('dragging');
      if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
      update(state());
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { if (!drag) { hover = null; hideTip(); draw(); } });

    cv.addEventListener('dblclick', (e) => {
      if (prefs.draw) return;
      const { px, py } = local(e), { target } = targetAt(v, px, py);
      if (target?.hit.kind === 'pivot') removePivot(target.piece, target.hit.index);
    });

    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (state().ui.recording) return;
      const { px, py } = local(e), { target } = targetAt(v, px, py);
      if (!target) return;
      const pc = target.piece, h = target.hit;
      if (h.kind === 'pivot') { removePivot(pc, h.index); return; }
      if (h.kind === 'segment') {
        const p = pc.pivots[h.index], cur: Shape = p.shape ?? 'linear';
        const items: MenuItem[] = [
          { label: 'Linear', note: 'a straight ramp', on: cur === 'linear', run: () => setShape(pc, h.index, 'linear') },
          { label: 'Ease', note: 'slow, fast, slow', on: cur === 'ease', run: () => setShape(pc, h.index, 'ease') },
          { label: 'Hold', note: 'a step at the next pivot', on: cur === 'hold', run: () => setShape(pc, h.index, 'hold') },
        ];
        if (p.bend && cur === 'linear') items.push({ label: 'Straighten', note: 'remove the bend', run: () => setShape(pc, h.index, 'straight') });
        openMenu(e.clientX, e.clientY, 'Segment', items);
        return;
      }
      openPresets(e.clientX, e.clientY);
    });

    cv.addEventListener('keydown', (e) => {
      // Delete in a focused lane is about pivots: it never falls through to the studio's "remove the clip".
      if (e.key === 'Delete' || e.key === 'Backspace') e.preventDefault();
      const s = selected;
      if (!s) return;
      const pc = pieceOf();
      if (!pc || pc.clip !== s.clip || !pc.pivots[s.index]) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removePivot(pc, s.index); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const piv = fresh(pc), p = piv[s.index], step = (e.shiftKey ? 0.1 : 0.01) * (e.key === 'ArrowUp' ? 1 : -1);
        p.v = Math.round(clamp(p.v + step, 0, 1) * 1000) / 1000;
        const at = `${pc.clip}:${s.index}`;
        if (!nudge || nudge.at !== at) nudge = { at, group: `intensity:${at}:key:${++gesture}` };
        commit(pc, piv, nudge.group);
        showTip(v, geo(v).x(p.t), `${stamp(p.t)} · ${pct(p.v)}`);
      }
      if (e.key === 'Escape') { selected = null; hideTip(); draw(); }
    });
    cv.addEventListener('keyup', (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') nudge = null; });
    cv.addEventListener('blur', () => { nudge = null; });
  };

  // ---- menus ----

  interface MenuItem { label: string; note?: string; on?: boolean; disabled?: boolean; run(): void }
  const closeMenu = () => { menu?.remove(); menu = null; };
  /** right: x is where the menu's right edge goes (under a button at the right end of the bar). */
  const openMenu = (x: number, y: number, title: string, items: MenuItem[], foot?: string, right = false) => {
    closeMenu(); hideTip();
    const m = document.createElement('div');
    m.className = 'lane-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = `<div class="lane-menu-title"></div>`;
    m.querySelector('.lane-menu-title')!.textContent = title;
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.disabled = !!it.disabled;
      b.setAttribute('aria-checked', String(!!it.on));
      b.innerHTML = `<span class="lm-label"></span><span class="lm-note"></span>`;
      b.querySelector('.lm-label')!.textContent = it.label;
      b.querySelector('.lm-note')!.textContent = it.note ?? '';
      b.addEventListener('click', () => { closeMenu(); it.run(); });
      m.append(b);
    }
    if (foot) { const f = document.createElement('div'); f.className = 'lane-menu-foot'; f.textContent = foot; m.append(f); }
    document.body.append(m);
    // Above the pointer when there is no room below (the timeline sits at the bottom of the page).
    const r = m.getBoundingClientRect();
    const left = clamp(right ? x - r.width : x, 8, Math.max(8, window.innerWidth - r.width - 8));
    const top = y + r.height + 8 > window.innerHeight ? Math.max(8, y - r.height - 4) : y + 4;
    m.style.left = `${left}px`; m.style.top = `${top}px`;
    menu = m;
    m.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  };
  document.addEventListener('pointerdown', (e) => { if (menu && !menu.contains(e.target as Node)) closeMenu(); }, true);
  document.addEventListener('keydown', (e) => { if (menu && e.key === 'Escape') { e.preventDefault(); closeMenu(); } }, true);
  window.addEventListener('resize', closeMenu);

  /** The same shapes as the strip, at the pointer. */
  const openPresets = (x: number, y: number) => {
    const items: MenuItem[] = shapes().map((c) => ({ label: c.menu, note: c.note ?? '', run: () => putShape(c.id) }));
    openMenu(x, y, 'Intensity shapes', items, 'Bars are 4 beats: the song has no downbeats.');
  };

  // ---- updates ----

  new ResizeObserver(() => draw()).observe(list);

  function update(s: StudioState): void {
    syncBar();
    if (!s.show) return;
    const c = selectedClip();
    const key = JSON.stringify([c?.id ?? null, c?.widget ?? null, c?.listen ?? null]);
    if (key !== builtKey && !drag) {
      builtKey = key; hover = null; hideTip();
      if (selected && selected.clip !== c?.id) selected = null;
      build(c);
    }
    if (selected && !c?.intensity?.[selected.index]) selected = null;
    draw();
  }

  return {
    update,
    setTime(t: number) { now = t; placeHead(); },
    redraw: draw,
    timeAt(clientX: number) {
      const v = view;
      if (!v) return null;
      const r = v.cv.getBoundingClientRect();
      return geo(v).t(clientX - r.left);
    },
  };
}
