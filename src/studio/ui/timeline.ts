/**
 * The timeline, as in DJ software: the song's loudness, attacks and structure marks over the clips on their tracks (move,
 * resize, select), with the selected clip's intensity lane (lanes.ts) below; the x axis zooms as the note picker's does.
 */
import type { Mark } from '../show/marks';
import type { SongPack } from '../pack/pack';
import { edgeSeconds } from '../show/schedule';
import { instanceKey, type Clip, type Show } from '../show/show';
import { energyCurve } from '../../widgets/curves';
import { studioLayers } from '../../widgets/layers-source';
import type { Chord } from '../../widgets/types';
import { duplicateSelected, removeSelected, selectedClip, splitAt } from './clip-actions';
import { clipViewTime } from './clip-panel';
import { partWords } from './layer-controls';
import { mountLanes, type Lanes } from './lanes';
import { moveView, zoomView, type View } from './picker-logic';
import type { Store, StudioState } from './store';
import { handleWidth, rowCount, snapMove, snapPoint, snapTargets, trackAtHeight } from './timeline-logic';

/** The loved widgets' hues echo their own pictures (red squares, Kandinsky's blue circles, the casket's crimson,
    rorschach's ink…); every other widget gets one of a few muted hues from its id. */
const HUES: Record<string, number> = {
  squares: 8, casket: 342, kandinsky: 212, rorschach: 262, flee: 46, current: 172, strings: 28, fields: 118,
  murmuration: 192, marbling: 300,
};
const SPREAD = [16, 38, 64, 96, 150, 186, 226, 248, 286, 318];
/** A hue for a widget, the same everywhere in the studio. */
export function widgetHue(id: string): number {
  if (id in HUES) return HUES[id];
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return SPREAD[(h >>> 0) % SPREAD.length];
}

/** How much the music does around each moment, 0..1 every `hop` s: the attacks the widgets answer (louder and
    fuller count more) over ±0.75 s, with the recording's loudness beneath. What the silhouette draws. */
export function activity(chords: readonly Chord[], loudness: { hop: number; values: readonly number[] }, duration: number, hop = 0.25): number[] {
  const n = Math.max(1, Math.ceil(duration / hop)), raw = new Array<number>(n).fill(0);
  for (const ch of chords) {
    const e = (ch.vel / 127) * Math.min(1, 0.4 + ch.notes.length / 5);
    const a = Math.max(0, Math.floor((ch.t - 0.75) / hop)), b = Math.min(n - 1, Math.floor((ch.t + 0.75) / hop));
    for (let i = a; i <= b; i++) raw[i] += e;
  }
  const sorted = raw.filter((v) => v > 0).sort((x, y) => x - y);
  const top = sorted.length ? sorted[Math.floor(0.95 * (sorted.length - 1))] : 1;
  return raw.map((v, i) => {
    const l = loudness.values[Math.min(loudness.values.length - 1, Math.floor((i * hop) / loudness.hop))] ?? 0;
    const act = Math.min(1, v / (top || 1));
    return 0.7 * Math.sqrt(act) + 0.3 * (Number.isFinite(l) ? Math.max(0, Math.min(1, l)) : 0);
  });
}

export const clock = (s: number): string => {
  s = Math.max(0, s);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const ROW = 26;
/** How near a target a dragged edge snaps, in px. */
const SNAP_PX = 8;
/** A rolled chord's mark on the strip is at least this wide, in px, however short the roll. */
const ROLL_MARK = 6;
const PREFS = 'wa-studio.timeline';

interface Deps {
  store: Store; song: SongPack; chords: Chord[]; marks: readonly Mark[];
  duration: () => number; time: () => number; seek(t: number): void; refresh(): void; names: (id: string) => string;
  /** Whether a widget has the how present slider (show.ts hasHowPresent). */
  howPresent?: (id: string) => boolean;
  /** Opens the way to add a widget at the playhead. */
  add(): void;
}

export class Timeline {
  readonly el: HTMLElement;
  private readonly wave: HTMLCanvasElement;
  private readonly tracks: HTMLElement;
  private readonly head: HTMLElement;
  private readonly ghost: HTMLElement;
  private readonly tip: HTMLElement;
  private readonly snapLine: HTMLElement;
  private readonly lanes: Lanes;
  /** What the silhouette was drawn for: the view (not the show's identity, which every edit changes). */
  private drawnFor = '';
  private drawnWidth = 0;
  private act: number[] | null = null;
  private dragging = false;
  private drag = 0;
  /** The rows while a clip is dragged: fixed, or the pointer's row would move under it as a new row opens. */
  private frozenRows: number | null = null;
  /** What of the song the strips show. Whole until zoomed, and then it follows the song's length. */
  private view: View = { a: 0, b: 1 };
  private zoomed = false;
  private now = 0;
  private lastSelected: string | null = null;
  private readonly over: HTMLElement;
  private readonly fitBtn: HTMLButtonElement;
  private readonly clipEls = new Map<string, HTMLElement>();
  private marksKey = '';
  private snap = true;
  /** The piece's loudest moments: suggestions to see, not marks (nothing snaps to them). */
  private loudest: number[] | null = null;
  private rolls: { t0: number; t1: number; up: boolean; n: number }[] | null = null;

  constructor(private readonly d: Deps) {
    try { this.snap = (JSON.parse(localStorage.getItem(PREFS) ?? '{}') as { snap?: boolean }).snap !== false; } catch { /* private window */ }
    this.el = document.createElement('div');
    this.el.className = 'timeline';
    // The playhead spans the song-wide strips only: the lane keeps its own (a clip's lane is zoomed to it).
    this.el.innerHTML = `<div class="tl-bar" role="toolbar" aria-label="Clips">
        <button type="button" data-tl="add" title="Add a widget at the playhead (Ctrl+P)">Add widget</button>
        <button type="button" data-tl="duplicate" title="A copy of its own (Ctrl+D)">Duplicate</button>
        <button type="button" data-tl="split" title="Split it at the playhead (S)">Split</button>
        <button type="button" data-tl="remove" title="Delete the selected clip (Delete)">Delete</button>
        <span class="tl-hint"></span><span class="lanes-spacer"></span>
        <button type="button" class="lanes-toggle" data-tl="snap" title="Clips snap to beats, clip edges and the song's marks (hold Alt to place one freely)">Snap</button>
      </div>
      <div class="tl-top"><div class="scrub" title="Click or drag to move the playhead. Ctrl-scroll zooms."><canvas class="wave"></canvas><div class="ghost"></div>
        <div class="tl-zoom" role="group" aria-label="Zoom the timeline"><button type="button" data-z="-1" aria-label="Zoom out" title="Zoom out (−)">−</button><button type="button" data-z="1" aria-label="Zoom in" title="Zoom in (+)">+</button><button type="button" data-z="0" title="Show the whole song (0)">Whole song</button></div></div>
      <div class="tracks-scroll"><div class="tracks" role="listbox" aria-label="Clips on the timeline"><div class="tl-marks"></div><div class="tl-snap" hidden></div></div>
        <div class="tracks-empty" hidden><p>Nothing placed yet. Add a widget: it lands at the playhead.</p><p><button type="button" data-tl="add">Add widget</button></p></div>
      </div><div class="playhead"></div><div class="tip" hidden></div></div>
      <div class="tl-over" hidden title="The whole song: drag to move the view"><div class="tl-win"></div><div class="tl-at"></div></div><div class="lanes-host"></div>`;
    this.wave = this.el.querySelector('.wave')!;
    this.tracks = this.el.querySelector('.tracks')!;
    this.head = this.el.querySelector('.playhead')!;
    this.ghost = this.el.querySelector('.ghost')!;
    this.tip = this.el.querySelector('.tip')!;
    this.snapLine = this.el.querySelector('.tl-snap')!;
    this.over = this.el.querySelector('.tl-over')!;
    this.fitBtn = this.el.querySelector('[data-z="0"]')!;
    this.wireScrub();
    this.wireZoom();
    this.wireBar();
    this.wireClips();
    this.lanes = mountLanes(this.el.querySelector<HTMLElement>('.lanes-host')!, { store: d.store, song: d.song, duration: d.duration, names: d.names, howPresent: d.howPresent, hue: widgetHue, view: () => this.view });
    new ResizeObserver(() => { this.drawnFor = ''; this.update(this.d.store.state); }).observe(this.el.querySelector('.tl-top')!);
  }

  private tAt(clientX: number): number {
    const r = this.tracks.getBoundingClientRect(), { a, b } = this.view;
    return a + Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (b - a);
  }

  /** Where a song time is across the strips, in %. */
  private pc(t: number): number { return ((t - this.view.a) / (this.view.b - this.view.a)) * 100; }

  private setView(v: View): void {
    const D = this.d.duration();
    this.zoomed = v.b - v.a < D - 1e-6;
    this.view = this.zoomed ? v : { a: 0, b: D };
    this.drawnFor = ''; this.marksKey = '';
    this.update(this.d.store.state);
    this.setTime(this.now);
  }

  /** One step in (1) or out (−1) about the playhead, or where the view is if the playhead is elsewhere; 0: the whole song. */
  zoomStep(dir: -1 | 0 | 1): void {
    if (this.dragging) return;
    const D = this.d.duration(), { a, b } = this.view;
    if (dir === 0) { this.setView({ a: 0, b: D }); return; }
    this.setView(zoomView(this.view, dir > 0 ? 0.7 : 1 / 0.7, this.now >= a && this.now <= b ? this.now : (a + b) / 2, D));
  }

  private wireZoom(): void {
    this.el.querySelectorAll<HTMLButtonElement>('[data-z]').forEach((z) => {
      z.addEventListener('click', () => this.zoomStep(Number(z.dataset.z) as -1 | 0 | 1));
      z.addEventListener('pointerdown', (e) => e.stopPropagation());   // not a seek
      z.addEventListener('pointermove', (e) => e.stopPropagation());
    });
    const span = () => this.view.b - this.view.a;
    this.el.querySelector<HTMLElement>('.tl-top')!.addEventListener('wheel', (e) => {
      if (this.dragging) return;
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.setView(zoomView(this.view, Math.exp(e.deltaY * 0.0015), this.tAt(e.clientX), this.d.duration())); }
      else if (this.zoomed && !(e.deltaY && !e.deltaX && (e.target as Element).closest('.tracks-scroll') && this.scrollsY())) {
        e.preventDefault(); this.setView(moveView(this.view, this.view.a + ((e.deltaX || e.deltaY) / 800) * span(), this.d.duration()));
      }
    }, { passive: false });
    this.el.querySelector<HTMLElement>('.lanes-host')!.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey) || this.dragging) return;
      e.preventDefault();
      this.setView(zoomView(this.view, Math.exp(e.deltaY * 0.0015), this.lanes.timeAt(e.clientX) ?? (this.view.a + this.view.b) / 2, this.d.duration()));
    }, { passive: false });
    let down = false;
    const centre = (e: PointerEvent) => {
      const r = this.over.getBoundingClientRect(), t = ((e.clientX - r.left) / r.width) * this.d.duration();
      this.setView(moveView(this.view, t - span() / 2, this.d.duration()));
    };
    this.over.addEventListener('pointerdown', (e) => { down = true; this.over.setPointerCapture(e.pointerId); centre(e); });
    this.over.addEventListener('pointermove', (e) => { if (down) centre(e); });
    const up = () => { down = false; };
    this.over.addEventListener('pointerup', up);
    this.over.addEventListener('pointercancel', up);
  }

  /** Whether the rows are taller than their box, so a plain scroll over them moves them. */
  private scrollsY(): boolean {
    const box = this.tracks.parentElement!;
    return box.scrollHeight > box.clientHeight + 1;
  }

  private wireBar(): void {
    const { store, time } = this.d;
    this.el.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-tl]');
      switch (b?.dataset.tl) {
        case 'add': this.d.add(); break;
        case 'duplicate': duplicateSelected(store); break;
        case 'split': splitAt(store, time()); break;
        case 'remove': removeSelected(store); break;
        case 'snap':
          this.snap = !this.snap;
          try { localStorage.setItem(PREFS, JSON.stringify({ snap: this.snap })); } catch { /* private window */ }
          this.syncBar(store.state);
          break;
      }
    });
  }

  private syncBar(s: StudioState): void {
    const sel = selectedClip(s), locked = s.ui.recording;
    const on = (name: string, enabled: boolean) => this.el.querySelectorAll<HTMLButtonElement>(`[data-tl="${name}"]`).forEach((b) => { b.disabled = !enabled; });
    on('add', !locked); on('duplicate', !!sel && !locked); on('remove', !!sel && !locked);
    this.syncSplit(s);
    this.el.querySelector('[data-tl="snap"]')!.setAttribute('aria-pressed', String(this.snap));
    this.el.querySelector('.tl-hint')!.textContent = sel ? `${this.d.names(sel.widget)}: drag to move, its edges to resize` : '';
  }

  /** Split needs a clip under the playhead, so it follows the playhead too. */
  private syncSplit(s: StudioState): void {
    this.el.querySelector<HTMLButtonElement>('[data-tl="split"]')!.disabled = s.ui.recording || !s.show?.clips.some((c) => c.start < this.now && this.now < c.end);
  }

  private wireScrub(): void {
    const scrub = this.el.querySelector<HTMLElement>('.scrub')!;
    let down = false, pending: number | null = null;
    // While paused every seek redraws a second of picture: at most one per frame.
    const seekSoon = (t: number) => {
      if (pending === null) requestAnimationFrame(() => { const x = pending; pending = null; if (x !== null) this.d.seek(x); });
      pending = t;
    };
    scrub.addEventListener('pointerdown', (e) => { down = true; scrub.setPointerCapture(e.pointerId); this.d.seek(this.tAt(e.clientX)); });
    scrub.addEventListener('pointermove', (e) => {
      const t = this.tAt(e.clientX);
      this.ghost.style.left = `${this.pc(t)}%`;
      const near = this.loudestNear(e.clientX);
      const roll = near === null ? this.rollNear(e.clientX) : null;
      this.showTip(e.clientX, near !== null ? `Loudest moment ${clock(near)} (a suggestion)`
        : roll ? `Rolled chord ${clock(roll.t0)}: ${roll.n} notes, ${roll.up ? 'upwards' : 'downwards'} (found by a rule)` : clock(t));
      if (down) seekSoon(t);
    });
    const up = () => { down = false; this.tip.hidden = true; };
    scrub.addEventListener('pointerup', up);
    scrub.addEventListener('pointercancel', up);
    scrub.addEventListener('pointerleave', () => { if (!down) this.tip.hidden = true; });
  }

  private climaxTimes(): number[] {
    return (this.loudest ??= studioLayers().climaxes(this.d.song).map((c) => c.t));
  }

  /** The rolled chords the 'rolls' rule finds in the song: when each starts and arrives, which way it runs, how many notes. */
  private rollSpans(): { t0: number; t1: number; up: boolean; n: number }[] {
    if (this.rolls) return this.rolls;
    const notes = studioLayers().listenNotes({ notes: this.d.song.notes, tracks: this.d.song.tracks }, 'rolls').notes;
    const out: { t0: number; t1: number; up: boolean; n: number; first: number; last: number }[] = [];
    for (const n of notes) {
      const r = out[out.length - 1];
      if (r && n[0] - r.t1 <= 0.4) { r.t1 = n[0]; r.last = n[2]; r.n++; r.up = r.last >= r.first; }
      else out.push({ t0: n[0], t1: n[0], up: true, n: 1, first: n[2], last: n[2] });
    }
    return (this.rolls = out);
  }

  /** The rolled chord whose mark is within 4 px of the pointer, if there is one. */
  private rollNear(clientX: number): { t0: number; t1: number; up: boolean; n: number } | null {
    const r = this.wave.getBoundingClientRect(), { a, b } = this.view;
    if (!(r.width > 0)) return null;
    const X = (t: number) => r.left + ((t - a) / (b - a)) * r.width;
    for (const roll of this.rollSpans()) if (roll.t1 >= a && roll.t0 <= b && clientX >= X(roll.t0) - 4 && clientX <= Math.max(X(roll.t0) + ROLL_MARK, X(roll.t1)) + 4) return roll;
    return null;
  }

  /** The loudest moment within 5 px of the pointer, if there is one. */
  private loudestNear(clientX: number): number | null {
    const r = this.wave.getBoundingClientRect(), { a, b } = this.view;
    if (!(r.width > 0)) return null;
    for (const t of this.climaxTimes()) if (t >= a && t <= b && Math.abs(r.left + ((t - a) / (b - a)) * r.width - clientX) <= 5) return t;
    return null;
  }

  private showTip(clientX: number, text: string): void {
    const r = this.el.getBoundingClientRect();
    this.tip.hidden = false; this.tip.textContent = text;
    this.tip.style.left = `${Math.max(24, Math.min(r.width - 24, clientX - r.left))}px`;
  }

  /** The playhead, every frame. */
  setTime(t: number): void {
    const D = this.d.duration(), jump = Math.abs(t - this.now) > 0.5;
    this.now = t;
    // Zoomed in, the view keeps a playing song (or a seek from elsewhere) on screen.
    if (this.zoomed && (this.d.store.state.playing || jump) && !this.dragging) {
      const { a, b } = this.view, span = b - a;
      if (t < a || t > b - span * 0.08) {
        const v = moveView(this.view, t - span * 0.1, D);   // at the song's end it can't move any further
        if (v.a !== a) { this.setView(v); return; }
      }
    }
    this.head.style.left = `${D ? this.pc(t) : 0}%`;
    this.head.style.display = t < this.view.a || t > this.view.b ? 'none' : '';
    this.el.querySelector<HTMLElement>('.tl-at')!.style.left = `${D ? (t / D) * 100 : 0}%`;
    this.lanes.setTime(t);
    this.syncSplit(this.d.store.state);
  }

  update(s: StudioState): void {
    const show = s.show;
    if (!show) return;
    const D = this.d.duration();
    if (!this.zoomed) this.view = { a: 0, b: D };
    const sel = selectedClip(s);
    if (s.selected.clip !== this.lastSelected) {
      // A clip chosen elsewhere (the picker, the keys) comes into view.
      this.lastSelected = s.selected.clip;
      if (this.zoomed && sel && (sel.end <= this.view.a || sel.start >= this.view.b)) this.view = moveView(this.view, sel.start - (this.view.b - this.view.a) * 0.1, D);
    }
    this.syncZoom(D);
    const w = this.wave.clientWidth, drawn = JSON.stringify(this.view);
    if (drawn !== this.drawnFor || w !== this.drawnWidth) { this.drawWave(); this.drawnFor = drawn; this.drawnWidth = w; }
    this.syncClips(s, show);
    this.syncMarks();
    this.syncBar(s);
    this.lanes.update(s);
    this.lanes.redraw();
  }

  private syncZoom(D: number): void {
    this.over.hidden = !this.zoomed;
    this.fitBtn.disabled = !this.zoomed;
    if (!this.zoomed) return;
    const win = this.over.querySelector<HTMLElement>('.tl-win')!;
    win.style.left = `${(this.view.a / D) * 100}%`;
    win.style.width = `${((this.view.b - this.view.a) / D) * 100}%`;
  }

  /** The clips as they are now: each keeps its element, so a drag keeps its pointer whatever the store does. */
  private syncClips(s: StudioState, show: Show): void {
    const { a, b: z } = this.view, span = z - a, width = this.tracks.clientWidth;
    const rows = this.frozenRows === null ? rowCount(show.clips) : Math.max(this.frozenRows, rowCount(show.clips) - 1);
    this.tracks.style.height = `${rows * ROW}px`;
    this.tracks.style.setProperty('--row', `${ROW}px`);
    const empty = this.el.querySelector<HTMLElement>('.tracks-empty')!;
    empty.hidden = show.clips.length > 0;
    this.tracks.classList.toggle('none', !show.clips.length);
    const seen = new Set<string>();
    for (const c of show.clips) {
      seen.add(c.id);
      let el = this.clipEls.get(c.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'clip';
        el.dataset.id = c.id;
        el.setAttribute('role', 'option');
        el.tabIndex = 0;
        el.innerHTML = '<span class="clip-fade l"></span><span class="clip-fade r"></span><span class="clip-name"></span><span class="clip-edge l" data-edge="start"></span><span class="clip-edge r" data-edge="end"></span>';
        this.tracks.append(el);
        this.clipEls.set(c.id, el);
      }
      this.placeClip(el, c, s.selected.clip === c.id, span, width);
    }
    for (const [id, el] of this.clipEls) if (!seen.has(id)) { el.remove(); this.clipEls.delete(id); }
  }

  private placeClip(el: HTMLElement, c: Clip, on: boolean, span: number, width: number): void {
    const { a } = this.view, px = ((c.end - c.start) / span) * width, name = this.d.names(c.widget);
    const words = c.listen && c.listen !== 'all' ? `${name} · ${partWords(c.listen)}` : name, f = edgeSeconds(c) / (c.end - c.start) * 100;
    el.classList.toggle('on', on);
    el.setAttribute('aria-selected', String(on));
    el.style.left = `${this.pc(c.start)}%`;
    el.style.width = `${((c.end - c.start) / span) * 100}%`;
    el.style.bottom = `${c.track * ROW}px`;
    el.style.setProperty('--hue', String(widgetHue(c.widget)));
    el.style.setProperty('--fade', `${f}%`);
    const edge = handleWidth(px);
    el.style.setProperty('--edge', `${edge}px`);
    el.classList.toggle('tiny', edge === 0);
    // Started before the view: its words stay where they can be read.
    const label = el.querySelector<HTMLElement>('.clip-name')!;
    label.style.paddingLeft = c.start < a ? `${((a - c.start) / span) * width + 6}px` : '';
    if (label.textContent !== words) label.textContent = words;
    el.title = `${words}, ${clock(c.start)}–${clock(c.end)}, track ${c.track + 1}. Drag to move, drag an edge to resize, double-click to go there.`;
    el.setAttribute('aria-label', `${words}, ${clock(c.start)} to ${clock(c.end)}, track ${c.track + 1}`);
    el.dataset.key = instanceKey(c);
  }

  private syncMarks(): void {
    const key = JSON.stringify(this.view);
    if (key === this.marksKey) return;
    this.marksKey = key;
    const box = this.tracks.querySelector<HTMLElement>('.tl-marks')!;
    box.innerHTML = this.d.marks.filter((m) => m.t >= this.view.a && m.t <= this.view.b)
      .map((m) => `<span class="tl-mark${m.label ? ' named' : ''}" style="left:${this.pc(m.t)}%"></span>`).join('');
  }

  private wireClips(): void {
    this.tracks.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement, el = target.closest<HTMLElement>('.clip');
      const store = this.d.store;
      if (!el) {
        // Empty space: nothing selected, and the playhead goes there, where a new clip will land.
        store.dispatch({ type: 'select', clip: null });
        this.d.seek(this.tAt(e.clientX));
        return;
      }
      const id = el.dataset.id!, show = store.state.show!, c0 = show.clips.find((c) => c.id === id);
      if (!c0) return;
      store.dispatch({ type: 'select', clip: id });
      if (store.state.ui.recording) return;
      e.preventDefault();
      el.focus({ preventScroll: true });
      el.setPointerCapture(e.pointerId);
      this.drag++;
      const edge = (target.closest<HTMLElement>('.clip-edge')?.dataset.edge ?? null) as 'start' | 'end' | null;
      const group = `clip:${id}:${this.drag}`, x0 = e.clientX, y0 = e.clientY, grab = this.tAt(e.clientX) - c0.start, len = c0.end - c0.start;
      const T = snapTargets(show.clips, id, this.d.marks.map((m) => m.t), this.d.song.beats);
      let moved = false;
      const radius = () => (SNAP_PX / Math.max(1, this.tracks.clientWidth)) * (this.view.b - this.view.a);
      const move = (ev: PointerEvent) => {
        // A click on a clip is a click: a shaky hand must not move it.
        if (!moved && Math.abs(ev.clientX - x0) < 4 && Math.abs(ev.clientY - y0) < 4) return;
        if (!moved) {
          moved = true; this.dragging = true;
          this.frozenRows = rowCount(store.state.show!.clips);
          el.classList.add('dragging');
        }
        const free = !this.snap || ev.altKey, r = free ? 0 : radius();
        let line: number | null = null, word = '';
        if (edge) {
          const raw = this.tAt(ev.clientX), s = free ? { t: raw, kind: null } : snapPoint(raw, T, r);
          store.dispatch({ type: 'edit', edit: { kind: 'resizeClip', clip: id, edge, t: s.t, ...(c0.intensity ? { from: c0.intensity } : {}) }, group });
          line = s.kind ? s.t : null; word = s.kind === 'edge' ? ', on an edge or mark' : s.kind === 'beat' ? ', on a beat' : '';
        } else {
          const raw = this.tAt(ev.clientX) - grab, s = free ? { start: raw, at: null, kind: null } : snapMove(raw, len, T, r);
          const rect = this.tracks.getBoundingClientRect();
          const track = trackAtHeight(rect.bottom - ev.clientY, ROW, this.frozenRows!);
          store.dispatch({ type: 'edit', edit: { kind: 'moveClip', clip: id, start: s.start, track }, group });
          line = s.at; word = s.kind === 'edge' ? ', on an edge or mark' : s.kind === 'beat' ? ', on a beat' : '';
        }
        const now = store.state.show!.clips.find((c) => c.id === id);
        if (now) this.showTip(ev.clientX, `${clock(now.start)}–${clock(now.end)}${word}`);
        this.snapLine.hidden = line === null;
        if (line !== null) this.snapLine.style.left = `${this.pc(line)}%`;
      };
      const end = () => {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', end);
        el.classList.remove('dragging');
        this.dragging = false; this.frozenRows = null; this.tip.hidden = true; this.snapLine.hidden = true;
        this.update(store.state);
        if (moved) this.d.refresh();
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    });
    this.tracks.addEventListener('dblclick', (e) => {
      const el = (e.target as Element).closest<HTMLElement>('.clip'), c = this.d.store.state.show?.clips.find((x) => x.id === el?.dataset.id);
      if (c) this.d.seek(clipViewTime(c));
    });
  }

  /** The loudness silhouette, the attacks as ticks beneath, the song's marks with their names over it. */
  private drawWave(): void {
    const cv = this.wave, dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const D = this.d.duration(), HOP = 0.25, mid = (h - 8) / 2, { a: va, b: vb } = this.view, span = vb - va;
    const X = (t: number) => ((t - va) / span) * w, T = (x: number) => va + (x / w) * span;
    // The loudness part: the zero-lag energy lane (0.4 s) when the pack has it, else pack.loudness, which runs late.
    const A = (this.act ??= activity(this.d.chords, energyCurve(this.d.song) ?? this.d.song.loudness, D, HOP));
    const at = (t: number) => A[Math.min(A.length - 1, Math.max(0, Math.floor(t / HOP)))] ?? 0;
    const level = (x: number) => { let v = 0; for (let t = T(x); t < T(x + 1) + 1e-9; t += HOP) v = Math.max(v, at(t)); return Math.max(0.6, v * mid * 0.95); };
    g.fillStyle = 'hsl(30 12% 40%)';
    g.beginPath(); g.moveTo(0, mid);
    for (let x = 0; x <= w; x++) g.lineTo(x, mid - level(x));
    for (let x = w; x >= 0; x--) g.lineTo(x, mid + level(x));
    g.closePath(); g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
    g.fillStyle = '#e9e2da';
    for (const ch of this.d.chords) {
      if (ch.t < va || ch.t > vb) continue;
      const x = X(ch.t);
      g.globalAlpha = 0.06 + 0.4 * Math.min(1, ch.vel / 127) ** 2;
      g.fillRect(x, h - 6, 1, 3 + 3 * Math.min(1, ch.notes.length / 6));
    }
    g.globalAlpha = 1;
    // The marks: a line each, and a name wherever there is room for it.
    g.font = '10.5px system-ui, sans-serif';
    g.textBaseline = 'top';
    let room = 0;
    for (const m of this.d.marks) {
      if (m.t < va || m.t > vb) continue;
      const x = X(m.t);
      g.fillStyle = m.label ? '#e9e2da70' : '#e9e2da30';
      g.fillRect(Math.round(x), 0, 1, h);
      if (!m.label || x < room) continue;
      const tw = g.measureText(m.label).width;
      if (x + 3 + tw > w) continue;
      g.fillStyle = '#e9e2dacc';
      g.fillText(m.label, x + 3, 3);
      room = x + tw + 12;
    }
    // The rolled chords: a short gold slope each, rising or falling as the roll does, just above the attack ticks.
    g.strokeStyle = '#e8b84a'; g.lineWidth = 1.5; g.lineCap = 'round';
    for (const r of this.rollSpans()) {
      if (r.t1 < va || r.t0 > vb) continue;
      const x0 = X(r.t0), x1 = Math.max(x0 + ROLL_MARK, X(r.t1)), lo = h - 9, hi = h - 17;
      g.beginPath(); g.moveTo(x0, r.up ? lo : hi); g.lineTo(x1, r.up ? hi : lo); g.stroke();
    }
    // The loudest moments: a small warm triangle at the foot of the strip each (hover one to read it).
    g.fillStyle = '#f0a35ecc';
    for (const t of this.climaxTimes()) {
      if (t < va || t > vb) continue;
      const x = Math.round(X(t));
      g.beginPath(); g.moveTo(x - 4, h); g.lineTo(x + 4, h); g.lineTo(x, h - 7); g.closePath(); g.fill();
    }
  }
}
