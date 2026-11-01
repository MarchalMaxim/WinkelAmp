/**
 * Intensity lanes under the timeline (plan T18, spec Goals 4 and Decisions 5): one lane per layer of the selected
 * section, top layer first as in the panel. The open layer's lane is tall and editable, like an automation lane in DJ
 * software: its curve in the widget's hue, the attacks of the part it listens to as ticks, the loudness faint behind.
 *
 * - Click on empty space: a pivot there (snapped to the nearest beat when Snap is on), and keep the button down to
 *   drag it at once.
 * - Drag a pivot: it stays between its neighbours; Shift is fine (no snap, a tenth of the speed), Alt only unsnaps.
 * - Drag a sloped segment up or down to bend it (its midpoint follows the pointer); a flat or held segment moves
 *   up and down instead.
 * - Double-click or right-click a pivot: delete it. Right-click a segment: Linear / Ease / Hold. Right-click empty
 *   space, or Presets: the shared presets (lab/layers/automation.js) written into the section.
 * - Every gesture is one undo step. "Whole show" lays the instance's lane over the song, as the sections strip above
 *   does, across the consecutive sections it plays in; a pivot added at t goes to the section containing t.
 *
 * The curve is drawn and hit-tested through the shared automationAt: no second formula here.
 */
import './lanes.css';
import type { SongPack } from '../pack/pack';
import { instanceKey, type Layer, type Show } from '../show/show';
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
    when the layer already has `max` pivots in the section (an edit would keep only the first max, dropping the last). */
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
}
export interface Lanes { update(s: StudioState): void; setTime(t: number): void }

type Mode = 'section' | 'show';
/** One section's part of a lane: that section's layer of the instance, its span and its pivots. */
interface Piece { section: number; layer: number; span: Span; pivots: Pivot[] }
interface LaneView { key: string; layer: number; widget: string; listen?: string; open: boolean; el: HTMLElement; cv: HTMLCanvasElement }
interface Geo { a: number; b: number; W: number; H: number; pad: number; x(t: number): number; y(v: number): number; t(x: number): number; v(y: number): number }
type Target = { piece: Piece; hit: Hit } | null;
interface Drag {
  kind: 'pivot' | 'bend' | 'level'; piece: Piece; index: number; group: string; moved: boolean; bend0: number;
  px: number; py: number; fine: boolean; t0: number; v0: number; t: number; v: number;
}

const PREFS = 'wa-studio.lanes';
const LISTEN_WORDS: Record<string, string> = {
  melody: 'melody', bassline: 'bass line', inner: 'inner voices', low: 'low notes', high: 'high notes', accents: 'accents',
  ...Object.fromEntries(Object.entries(NOTE_TYPE_LABELS).map(([t, label]) => [t, label.toLowerCase()])),
};
export const listenWord = (l: string): string => LISTEN_WORDS[l] ?? (l.startsWith('family:') ? l.slice(7) : l);
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
  let prefs: { mode: Mode; snap: boolean } = { mode: 'section', snap: true };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS) ?? '{}') }; } catch { /* private window */ }
  const savePrefs = () => { try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* private window */ } };

  const root = document.createElement('div');
  root.className = 'lanes';
  root.innerHTML = `<div class="lanes-bar">
      <span class="lanes-title">Intensity</span>
      <span class="lanes-seg" role="group" aria-label="What the lanes show">
        <button type="button" data-mode="section">This section</button><button type="button" data-mode="show">Whole show</button>
      </span>
      <button type="button" class="lanes-toggle" data-snap title="Pivots snap to the nearest beat (hold Shift for fine moves without snapping, Alt to place freely)">Snap to beats</button>
      <span class="lanes-hint"></span>
      <span class="lanes-spacer"></span>
      <button type="button" class="lanes-presets" data-presets aria-haspopup="menu">Presets</button>
    </div>
    <div class="lanes-body"><div class="lanes-list"></div><div class="lanes-head" hidden></div><div class="lanes-tip" hidden></div></div>`;
  host.append(root);
  const list = root.querySelector<HTMLElement>('.lanes-list')!, body = root.querySelector<HTMLElement>('.lanes-body')!;
  const head = root.querySelector<HTMLElement>('.lanes-head')!, tip = root.querySelector<HTMLElement>('.lanes-tip')!;
  const hint = root.querySelector<HTMLElement>('.lanes-hint')!, presetsBtn = root.querySelector<HTMLButtonElement>('[data-presets]')!;
  const snapBtn = root.querySelector<HTMLButtonElement>('[data-snap]')!;

  let views: LaneView[] = [], builtKey = '', drag: Drag | null = null, gesture = 0, raf = 0, now = 0;
  let hover: { lane: number; target: Target } | null = null;
  let selected: { section: number; layer: number; index: number } | null = null;
  /** The arrow-key nudge in progress: one undo step per pivot from the first press until the key is let go (a held
      key's repeats are one step; another pivot, a key-up or leaving the lane starts a new one). */
  let nudge: { at: string; group: string } | null = null;
  let menu: HTMLElement | null = null;
  const ticksFor = new Map<string, Chord[]>();

  const state = () => d.store.state;
  const show = (): Show | null => state().show;

  const syncBar = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === prefs.mode)));
    snapBtn.setAttribute('aria-pressed', String(prefs.snap));
    const s = state(), sec = s.show?.sections[s.selected.section];
    const open = s.selected.layer !== null && !!sec?.layers[s.selected.layer];
    presetsBtn.disabled = !open || s.ui.recording;
    hint.textContent = !sec?.layers.length ? '' : open
      ? 'Click to add · drag · Shift: fine · double-click: delete · right-click: shape, presets'
      : 'Click a lane to draw its intensity';
  };
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    prefs.mode = b.dataset.mode as Mode; savePrefs(); builtKey = ''; update(state());
  }));
  snapBtn.addEventListener('click', () => { prefs.snap = !prefs.snap; savePrefs(); syncBar(); draw(); });
  presetsBtn.addEventListener('click', () => {
    const r = presetsBtn.getBoundingClientRect();
    openPresets(r.right, r.top, undefined, true);
  });

  // ---- what each lane covers ----

  /** The pieces of the lane of layer k of the selected section: that layer alone, or in Whole show the run of
      consecutive sections around it that have the same instance. */
  const piecesOf = (k: number): Piece[] => {
    const sh = show(), i = state().selected.section, sec = sh?.sections[i], l = sec?.layers[k];
    if (!sh || !sec || !l) return [];
    const piece = (j: number, layer: number): Piece => ({ section: j, layer, span: { start: sh.sections[j].start, end: sh.sections[j].end },
      pivots: (sh.sections[j].layers[layer].intensity ?? []).map((p) => ({ ...p })) });
    if (prefs.mode === 'section') return [piece(i, k)];
    const key = instanceKey(l), at = (j: number) => sh.sections[j]?.layers.findIndex((x) => instanceKey(x) === key) ?? -1;
    let a = i, b = i;
    while (a > 0 && at(a - 1) >= 0) a--;
    while (b + 1 < sh.sections.length && at(b + 1) >= 0) b++;
    const out: Piece[] = [];
    for (let j = a; j <= b; j++) out.push(piece(j, at(j)));
    return out;
  };

  const geo = (v: LaneView): Geo => {
    const sh = show()!, sec = sh.sections[state().selected.section];
    const [a, b] = prefs.mode === 'section' ? [sec.start, sec.end] : [0, d.duration() || sh.sections[sh.sections.length - 1].end];
    const W = Math.max(1, v.cv.clientWidth), H = Math.max(1, v.cv.clientHeight), pad = v.open ? 8 : 3;
    const span = b - a || 1;
    return {
      a, b, W, H, pad,
      x: (t) => ((t - a) / span) * W, t: (x) => a + (x / W) * span,
      y: (val) => pad + (1 - val) * (H - 2 * pad), v: (y) => 1 - (y - pad) / (H - 2 * pad),
    };
  };

  const ticks = (listen: string | undefined): Chord[] => {
    const k = listen ?? 'all';
    let c = ticksFor.get(k);
    if (!c) {
      c = L.groupChords(L.listenNotes({ notes: d.song.notes, tracks: d.song.tracks }, listen).notes);
      ticksFor.set(k, c);
    }
    return c;
  };

  // ---- building and drawing ----

  const build = (s: StudioState) => {
    list.textContent = '';
    views = [];
    const sec = s.show?.sections[s.selected.section];
    if (!sec || !sec.layers.length) {
      list.innerHTML = '<p class="lanes-empty">No widgets in this section: nothing to automate.</p>';
      return;
    }
    for (let k = sec.layers.length - 1; k >= 0; k--) {
      const l: Layer = sec.layers[k], open = s.selected.layer === k;
      const el = document.createElement('div');
      el.className = `lane${open ? ' open' : ''}`;
      el.style.setProperty('--hue', String(d.hue(l.widget)));
      const name = d.names(l.widget) + (l.listen && l.listen !== 'all' ? ` · ${listenWord(l.listen)}` : '');
      el.innerHTML = `<canvas></canvas><span class="lane-name"></span>`;
      el.querySelector('.lane-name')!.textContent = name;
      const cv = el.querySelector('canvas')!;
      if (open) {
        cv.tabIndex = 0;
        cv.setAttribute('role', 'application');
        cv.setAttribute('aria-label', `${name}: intensity curve. Click to add a pivot, drag to move it, Delete to remove the selected one, arrows up and down to change it.`);
      } else {
        el.title = `${name}: click to edit its intensity`;
      }
      const v: LaneView = { key: instanceKey(l), layer: k, widget: l.widget, listen: l.listen, open, el, cv };
      wire(v);
      list.append(el);
      views.push(v);
    }
  };

  const draw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; for (const v of views) drawLane(v); placeHead(); }); };

  const drawLane = (v: LaneView) => {
    const cv = v.cv, dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const G = geo(v), hue = d.hue(v.widget), pieces = piecesOf(v.layer);
    if (!pieces.length) return;
    const px0 = Math.max(0, Math.floor(G.x(pieces[0].span.start))), px1 = Math.min(w, Math.ceil(G.x(pieces[pieces.length - 1].span.end)));

    // Outside the instance's run (Whole show): dimmed, nothing to edit there.
    if (prefs.mode === 'show') {
      g.fillStyle = '#00000080';
      g.fillRect(0, 0, px0, h); g.fillRect(px1, 0, w - px1, h);
    }
    if (v.open) {
      // The loudness, faint, from the bottom.
      const lo = d.song.loudness, hop = lo.hop;
      g.fillStyle = '#e9e2da12';
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x++) {
        const t0 = G.t(x), t1 = G.t(x + 1);
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
      for (const ch of ticks(v.listen)) {
        if (ch.t < G.a || ch.t > G.b) continue;
        g.globalAlpha = 0.15 + 0.5 * Math.min(1, ch.vel / 127) ** 2;
        g.fillRect(Math.round(G.x(ch.t)), h - 2 - 5 * Math.min(1, 0.4 + ch.notes.length / 6), 1, 5 * Math.min(1, 0.4 + ch.notes.length / 6));
      }
      g.globalAlpha = 1;
      // The 0 and 1 lines.
      g.fillStyle = '#e9e2da10';
      g.fillRect(px0, Math.round(G.y(1)), px1 - px0, 1); g.fillRect(px0, Math.round(G.y(0)), px1 - px0, 1);
    }

    // Each piece's curve: sampled per pixel through the shared automationAt, with the pivots' own times so steps
    // and corners are exact.
    for (const pc of pieces) {
      const xa = G.x(pc.span.start), xb = G.x(pc.span.end);
      if (prefs.mode === 'show' && pc.span.start > G.a) { g.fillStyle = '#e9e2da30'; g.fillRect(Math.round(xa), 0, 1, h); }
      const curve = (t: number) => L.automationAt(pc.pivots, t);
      const ts: number[] = [];
      for (let x = Math.floor(xa); x <= Math.ceil(xb); x++) ts.push(clamp(G.t(x), pc.span.start, pc.span.end));
      for (const p of pc.pivots) { ts.push(p.t); if (p.t - 1e-6 > pc.span.start) ts.push(p.t - 1e-6); }
      ts.sort((p, q) => p - q);
      const none = !pc.pivots.length;
      g.beginPath();
      ts.forEach((t, i) => { const X = G.x(t), Y = G.y(curve(t)); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
      if (!none) {
        g.lineTo(G.x(ts[ts.length - 1]), G.y(0)); g.lineTo(G.x(ts[0]), G.y(0)); g.closePath();
        g.fillStyle = `hsl(${hue} 55% 50% / ${v.open ? 0.2 : 0.28})`; g.fill();
        g.beginPath();
        ts.forEach((t, i) => { const X = G.x(t), Y = G.y(curve(t)); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
      }
      g.setLineDash(none ? [3, 4] : []);
      g.lineWidth = v.open ? 1.75 : 1.25; g.lineJoin = 'round';
      g.strokeStyle = none ? `hsl(${hue} 25% 60% / 0.6)` : `hsl(${hue} 70% 66%)`;
      g.stroke(); g.setLineDash([]);
      if (!v.open) continue;
      // The hovered or dragged segment, brighter.
      const seg = drag && drag.kind !== 'pivot' && drag.piece.section === pc.section ? drag.index
        : hover && hover.lane === v.layer && hover.target?.piece.section === pc.section && hover.target.hit.kind === 'segment' ? hover.target.hit.index : -1;
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
        const on = !!selected && selected.section === pc.section && selected.layer === pc.layer && selected.index === i;
        const hot = (drag?.kind === 'pivot' && drag.piece.section === pc.section && drag.index === i)
          || (hover?.lane === v.layer && hover.target?.piece.section === pc.section && hover.target.hit.kind === 'pivot' && hover.target.hit.index === i);
        g.beginPath(); g.arc(G.x(p.t), G.y(p.v), hot ? 5.5 : 4.25, 0, Math.PI * 2);
        g.fillStyle = on ? '#fff6ee' : hot ? `hsl(${hue} 80% 76%)` : '#120d10';
        g.fill();
        g.lineWidth = 1.75; g.strokeStyle = on ? `hsl(${hue} 80% 70%)` : `hsl(${hue} 75% 70%)`; g.stroke();
      });
    }
  };

  const placeHead = () => {
    const v = views[0];
    if (!v || !show()) { head.hidden = true; return; }
    const G = geo(v), x = G.x(now);
    head.hidden = !(now >= G.a && now <= G.b);
    head.style.left = `${x}px`;
  };

  // ---- editing ----

  const sel = () => state().selected;
  const commit = (pc: Piece, pivots: Pivot[], group: string) => {
    const cur = show()?.sections[pc.section]?.layers[pc.layer]?.intensity;
    if (samePivots(cur, pivots)) return;
    d.store.dispatch({ type: 'edit', edit: { kind: 'setLayer', section: pc.section, layer: pc.layer, patch: { intensity: pivots.length ? pivots : null } }, group });
  };
  const fresh = (pc: Piece): Pivot[] => (show()?.sections[pc.section]?.layers[pc.layer]?.intensity ?? []).map((p) => ({ ...p }));
  const removePivot = (pc: Piece, i: number) => {
    const piv = fresh(pc);
    if (!piv[i]) return;
    piv.splice(i, 1);
    selected = null;
    commit(pc, piv, `intensity:${pc.section}:${pc.layer}:del:${++gesture}`);
    hideTip();
  };
  const setShape = (pc: Piece, i: number, shape: Shape | 'straight') => {
    const piv = fresh(pc), p = piv[i];
    if (!p) return;
    if (shape === 'straight') delete p.bend;
    else { if (shape === 'linear') delete p.shape; else p.shape = shape; if (shape !== 'linear') delete p.bend; }
    commit(pc, piv, `intensity:${pc.section}:${pc.layer}:shape:${++gesture}`);
  };

  const targetAt = (v: LaneView, px: number, py: number): { G: Geo; pieces: Piece[]; target: Target; inside: Piece | null } => {
    const G = geo(v), pieces = piecesOf(v.layer);
    let target: Target = null;
    for (const pc of pieces) {
      if (px < G.x(pc.span.start) - PIVOT_R || px > G.x(pc.span.end) + PIVOT_R) continue;
      const hit = hitTest(pc.pivots, G.x, G.y, px, py, (t) => L.automationAt(pc.pivots, t));
      if (hit.kind !== 'empty') { target = { piece: pc, hit }; break; }
    }
    const t = G.t(px);
    const inside = pieces.find((pc) => t >= pc.span.start && t <= pc.span.end)
      ?? (pieces.length && t < pieces[0].span.start && t > pieces[0].span.start - (G.b - G.a) * (PIVOT_R / G.W) ? pieces[0] : null);
    if (!target && inside) target = { piece: inside, hit: { kind: 'empty' } };
    return { G, pieces, target, inside };
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

    if (!v.open) {
      cv.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        d.store.dispatch({ type: 'select', section: sel().section, layer: v.layer });
      });
      cv.addEventListener('pointermove', (e) => {
        const { px } = local(e), G = geo(v), t = G.t(px), pc = piecesOf(v.layer).find((p) => t >= p.span.start && t <= p.span.end);
        if (pc) showTip(v, px, `${stamp(t)} · ${pct(L.automationAt(pc.pivots, t))}`); else hideTip();
      });
      cv.addEventListener('pointerleave', hideTip);
      return;
    }

    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || state().ui.recording) return;
      closeMenu();
      const { px, py } = local(e), { G, target } = targetAt(v, px, py);
      if (!target) return;
      e.preventDefault(); cv.focus({ preventScroll: true });
      const pc = target.piece, group = `intensity:${pc.section}:${pc.layer}:${++gesture}`;
      const base = { piece: pc, group, moved: false, px: e.clientX, py: e.clientY, fine: e.shiftKey, bend0: 0 };
      if (target.hit.kind === 'pivot') {
        const p = pc.pivots[target.hit.index];
        drag = { ...base, kind: 'pivot', index: target.hit.index, t0: p.t, v0: p.v, t: p.t, v: p.v };
        selected = { section: pc.section, layer: pc.layer, index: target.hit.index };
      } else if (target.hit.kind === 'segment') {
        const i = target.hit.index, p = pc.pivots[i], q = pc.pivots[i + 1];
        if (p.shape === 'hold' || Math.abs(p.v - q.v) < 1e-3) drag = { ...base, kind: 'level', index: i, t0: p.t, v0: p.v, t: p.t, v: p.v };
        else drag = { ...base, kind: 'bend', index: i, t0: 0, v0: 0, t: 0, v: 0, bend0: p.shape ? 0 : p.bend ?? 0 };   // v: how far up it went
      } else {
        // A new pivot where the pointer is, on the curve's line of pivots; the button still down drags it.
        const t = snapTime(G.t(px), snapOpts(pc, e)), val = Math.round(clamp(G.v(py), 0, 1) * 1000) / 1000;
        const added = addPivot(fresh(pc), t, val, L.MAX_PIVOTS);
        if (!added) { showTip(v, px, `${L.MAX_PIVOTS} pivots: the most a layer takes in a section`); return; }
        const piv = added.pivots, at = added.index;
        commit(pc, piv, group);
        pc.pivots = piv;
        drag = { ...base, kind: 'pivot', index: at, t0: t, v0: val, t, v: val, moved: true };
        selected = { section: pc.section, layer: pc.layer, index: at };
        showTip(v, px, `${stamp(t)} · ${pct(val)}`);
      }
      cv.setPointerCapture(e.pointerId);
      cv.classList.add('dragging');
      draw();
    });

    cv.addEventListener('pointermove', (e) => {
      const { px, py } = local(e);
      if (!drag) {
        const { target, G } = targetAt(v, px, py);
        hover = { lane: v.layer, target };
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
      openPresets(e.clientX, e.clientY, pc);
    });

    cv.addEventListener('keydown', (e) => {
      // Delete in a focused lane is about pivots: it never falls through to the studio's "remove the layer".
      if (e.key === 'Delete' || e.key === 'Backspace') e.preventDefault();
      const s = selected;
      if (!s) return;
      const pc = piecesOf(v.layer).find((p) => p.section === s.section && p.layer === s.layer);
      if (!pc || !pc.pivots[s.index]) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removePivot(pc, s.index); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const piv = fresh(pc), p = piv[s.index], step = (e.shiftKey ? 0.1 : 0.01) * (e.key === 'ArrowUp' ? 1 : -1);
        p.v = Math.round(clamp(p.v + step, 0, 1) * 1000) / 1000;
        const at = `${pc.section}:${pc.layer}:${s.index}`;
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

  /** The shared presets, written into the section of `pc` (else the open layer's selected section) as one undo step. */
  const openPresets = (x: number, y: number, pc?: Piece, right = false) => {
    const s = state(), k = s.selected.layer, sh = s.show;
    if (!sh || k === null) return;
    const piece = pc ?? piecesOf(k).find((p) => p.section === s.selected.section);
    if (!piece) return;
    const span = piece.span, len = span.end - span.start, l = sh.sections[piece.section].layers[piece.layer];
    const beats = d.song.beats, gap = median(beats.slice(1).map((b, i) => b - beats[i]));
    const beat = gap > 0 ? gap : 0.5, fade = Math.min(len, 4 * beat);
    const P = L.presets;
    const put = (piv: Pivot[]) => commit(piece, piv.map((p) => ({ ...p, t: ms(p.t) })), `intensity:${piece.section}:${piece.layer}:preset:${++gesture}`);
    const inSec = d.song.loudness.values.slice(Math.floor(span.start / d.song.loudness.hop), Math.ceil(span.end / d.song.loudness.hop));
    const above = Math.min(0.95, Math.max(0.05, median(inSec) || 0.5));
    const items: MenuItem[] = [
      { label: 'Fade in', note: `over 4 beats (${fade.toFixed(1)} s)`, run: () => put(P.fadeIn(span, fade)) },
      { label: 'Fade out', note: `over 4 beats (${fade.toFixed(1)} s)`, run: () => put(P.fadeOut(span, fade)) },
      { label: 'Swell', note: 'up to the middle and back', run: () => put(P.swell(span)) },
      { label: 'Pulse every beat', note: '', run: () => put(P.pulse(span, beats, { every: 1 })) },
      { label: 'Pulse every bar', note: '4 beats', run: () => put(P.pulse(span, beats, { every: 4 })) },
      { label: 'Gate on loudness', note: `open above ${pct(above)}`, run: () => put(P.gate(span, d.song.loudness, { above })) },
    ];
    if (l.listen && l.listen !== 'all') {
      const notes = L.listenNotes({ notes: d.song.notes, tracks: d.song.tracks }, l.listen).notes;
      items.push({ label: 'While its part plays', note: listenWord(l.listen), run: () => put(P.plays(span, notes)) });
    }
    items.push({ label: 'Clear curve', note: 'always at 100 %', disabled: !l.intensity?.length, run: () => { selected = null; put([]); } });
    openMenu(x, y, 'Intensity presets', items, 'Bars are 4 beats: the song has no downbeats.', right);
  };

  // ---- updates ----

  new ResizeObserver(() => draw()).observe(list);

  function update(s: StudioState): void {
    syncBar();
    if (!s.show) return;
    const sec = s.show.sections[s.selected.section];
    const key = JSON.stringify([prefs.mode, s.selected.section, s.selected.layer, sec?.layers.map((l) => instanceKey(l)), s.show.sections.length]);
    if (key !== builtKey && !drag) {
      builtKey = key; hover = null; hideTip();
      if (selected && (selected.section !== s.selected.section && prefs.mode === 'section')) selected = null;
      build(s);
    }
    if (selected) {
      const p = s.show.sections[selected.section]?.layers[selected.layer]?.intensity;
      if (!p || !p[selected.index]) selected = null;
    }
    draw();
  }

  return {
    update,
    setTime(t: number) { now = t; placeHead(); },
  };
}
