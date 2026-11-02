/**
 * The timeline: the song's loudness as a silhouette, tinted section by section by the widget at the bottom of each
 * stack, with the attacks as ticks beneath (click or drag there to move the playhead and select the section there);
 * below it the sections, to select, with boundaries to drag (snapping just before an attack within 0.25 s; Alt drags
 * freely); under them the intensity lanes of the selected section's layers (lanes.ts).
 *
 * The x axis zooms, as the note picker's does: Ctrl-scroll where the pointer is, the +/− buttons or keys, scroll to move,
 * a strip of the whole song to drag. The lanes follow the same view.
 */
import type { SongPack } from '../pack/pack';
import { sectionAt } from '../show/schedule';
import { instanceKey, type Show } from '../show/show';
import type { Chord } from '../../widgets/types';
import { mountLanes, type Lanes } from './lanes';
import { moveView, zoomView, type View } from './picker-logic';
import type { Store, StudioState } from './store';

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
export function activity(chords: readonly Chord[], loudness: SongPack['loudness'], duration: number, hop = 0.25): number[] {
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
export const sectionHue = (show: Show, i: number): number | null => {
  const w = show.sections[i]?.layers[0]?.widget;
  return w ? widgetHue(w) : null;
};

export const clock = (s: number): string => {
  s = Math.max(0, s);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/** Where a dragged boundary lands: just before the nearest attack within 0.25 s, else where the pointer is. */
export function snapToAttack(t: number, chords: readonly Chord[], free: boolean): number {
  if (free) return t;
  let best: number | null = null;
  for (const ch of chords) {
    if (ch.t < t - 0.3) continue;
    if (ch.t > t + 0.3) break;
    if (Math.abs(ch.t - t) <= 0.25 && (best === null || Math.abs(ch.t - t) < Math.abs(best - t))) best = ch.t;
  }
  return best === null ? t : Math.max(0, best - 0.05);
}

/** How wide a boundary's grab area is between two blocks this wide (px): it leaves the middle of a short section to click. */
export const handleWidth = (leftPx: number, rightPx: number): number => Math.max(6, Math.min(24, Math.min(leftPx, rightPx) * 0.5));

/** Which layer stays open when the selection moves to another section: the same widget's, if it plays there too. */
export function sameLayerIn(show: Show, from: number, layer: number | null, to: number): number | null {
  const open = layer === null ? undefined : show.sections[from]?.layers[layer];
  if (!open) return null;
  const k = show.sections[to]?.layers.findIndex((l) => instanceKey(l) === instanceKey(open)) ?? -1;
  return k >= 0 ? k : null;
}

interface Deps { store: Store; song: SongPack; chords: Chord[]; duration: () => number; seek(t: number): void; refresh(): void; names: (id: string) => string }

export class Timeline {
  readonly el: HTMLElement;
  private readonly wave: HTMLCanvasElement;
  private readonly band: HTMLElement;
  private readonly head: HTMLElement;
  private readonly ghost: HTMLElement;
  private readonly tip: HTMLElement;
  private readonly lanes: Lanes;
  /** What the silhouette was drawn for: the sections' spans and bottom widgets (not the show's identity, which every
      edit changes: a pivot drag would redraw it on every move). */
  private drawnFor = '';
  private drawnWidth = 0;
  private act: number[] | null = null;
  private bandKey = '';
  private dragging = false;
  private drag = 0;
  /** What of the song the strips show. Whole until zoomed, and then it follows the song's length. */
  private view: View = { a: 0, b: 1 };
  private zoomed = false;
  private now = 0;
  private lastSelected = -1;
  private readonly over: HTMLElement;
  private readonly fitBtn: HTMLButtonElement;

  constructor(private readonly d: Deps) {
    this.el = document.createElement('div');
    this.el.className = 'timeline';
    // The playhead spans the song-wide strips only: the lanes keep their own (a section's lane is zoomed to it).
    this.el.innerHTML = `<div class="tl-top"><div class="scrub" title="Click or drag to move the playhead and select the section there. Ctrl-scroll zooms."><canvas class="wave"></canvas><div class="ghost"></div>
        <div class="tl-zoom" role="group" aria-label="Zoom the timeline"><button type="button" data-z="-1" aria-label="Zoom out" title="Zoom out (−)">−</button><button type="button" data-z="1" aria-label="Zoom in" title="Zoom in (+)">+</button><button type="button" data-z="0" title="Show the whole song (0)">Whole song</button></div></div>
      <div class="band" role="listbox" aria-label="Sections"></div><div class="playhead"></div><div class="tip" hidden></div></div>
      <div class="tl-over" hidden title="The whole song: drag to move the view"><div class="tl-win"></div><div class="tl-at"></div></div><div class="lanes-host"></div>`;
    this.wave = this.el.querySelector('.wave')!;
    this.band = this.el.querySelector('.band')!;
    this.head = this.el.querySelector('.playhead')!;
    this.ghost = this.el.querySelector('.ghost')!;
    this.tip = this.el.querySelector('.tip')!;
    this.over = this.el.querySelector('.tl-over')!;
    this.fitBtn = this.el.querySelector('[data-z="0"]')!;
    this.wireScrub();
    this.wireZoom();
    this.lanes = mountLanes(this.el.querySelector<HTMLElement>('.lanes-host')!, { store: d.store, song: d.song, duration: d.duration, names: d.names, hue: widgetHue, view: () => this.view });
    new ResizeObserver(() => { this.drawnFor = ''; this.update(this.d.store.state); }).observe(this.el.querySelector('.tl-top')!);
  }

  private tAt(clientX: number): number {
    const r = this.band.getBoundingClientRect(), { a, b } = this.view;
    return a + Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (b - a);
  }

  /** Where a song time is across the strips, in %. */
  private pc(t: number): number { return ((t - this.view.a) / (this.view.b - this.view.a)) * 100; }

  private setView(v: View): void {
    const D = this.d.duration();
    this.zoomed = v.b - v.a < D - 1e-6;
    this.view = this.zoomed ? v : { a: 0, b: D };
    this.bandKey = ''; this.drawnFor = '';
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
      else if (this.zoomed) { e.preventDefault(); this.setView(moveView(this.view, this.view.a + ((e.deltaX || e.deltaY) / 800) * span(), this.d.duration())); }
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

  /** Selects the section at a song time, with the same widget open if it plays there too. */
  private selectAt(t: number): void { const show = this.d.store.state.show; if (show) this.selectSection(sectionAt(show, t)); }
  private selectSection(i: number): void {
    const s = this.d.store.state, show = s.show;
    if (!show || i === s.selected.section) return;
    this.d.store.dispatch({ type: 'select', section: i, layer: sameLayerIn(show, s.selected.section, s.selected.layer, i) });
  }

  private wireScrub(): void {
    const scrub = this.el.querySelector<HTMLElement>('.scrub')!;
    let down = false, pending: number | null = null;
    // While paused every seek redraws a second of picture: at most one per frame.
    const seekSoon = (t: number) => {
      if (pending === null) requestAnimationFrame(() => { const x = pending; pending = null; if (x !== null) this.d.seek(x); });
      pending = t;
    };
    scrub.addEventListener('pointerdown', (e) => { down = true; scrub.setPointerCapture(e.pointerId); const t = this.tAt(e.clientX); this.d.seek(t); this.selectAt(t); });
    scrub.addEventListener('pointermove', (e) => {
      const t = this.tAt(e.clientX);
      this.ghost.style.left = `${this.pc(t)}%`;
      this.showTip(e.clientX, clock(t));
      if (down) seekSoon(t);
    });
    const up = () => { down = false; this.tip.hidden = true; };
    scrub.addEventListener('pointerup', (e) => { if (down) this.selectAt(this.tAt(e.clientX)); up(); });
    scrub.addEventListener('pointercancel', up);
    scrub.addEventListener('pointerleave', () => { if (!down) this.tip.hidden = true; });
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
  }

  update(s: StudioState): void {
    const show = s.show;
    if (!show) return;
    const D = this.d.duration();
    if (!this.zoomed) this.view = { a: 0, b: D };
    if (s.selected.section !== this.lastSelected) {
      // A section chosen elsewhere (the panel, the keys) comes into view.
      this.lastSelected = s.selected.section;
      const sec = show.sections[s.selected.section];
      if (this.zoomed && sec && (sec.end <= this.view.a || sec.start >= this.view.b)) this.view = moveView(this.view, sec.start - (this.view.b - this.view.a) * 0.1, D);
    }
    this.syncZoom(D);
    const w = this.wave.clientWidth, drawn = JSON.stringify([this.view, show.sections.map((x) => [x.start, x.end, x.layers[0]?.widget ?? null])]);
    if (drawn !== this.drawnFor || w !== this.drawnWidth) { this.drawWave(show); this.drawnFor = drawn; this.drawnWidth = w; }
    const key = JSON.stringify([this.view, this.band.clientWidth, s.selected.section, show.sections.map((x) => [x.start, x.end, x.label, x.layers.map((l) => l.widget)])]);
    if (key !== this.bandKey && !this.dragging) { this.bandKey = key; this.buildBand(s); }
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

  private buildBand(s: StudioState): void {
    const show = s.show!, sel = s.selected.section, { a, b: z } = this.view, span = z - a, bw = this.band.clientWidth;
    this.band.textContent = '';
    show.sections.forEach((sec, i) => {
      const hue = sectionHue(show, i);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `sec${i === sel ? ' on' : ''}${hue === null ? ' empty' : ''}`;
      b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(i === sel));
      b.style.left = `${this.pc(sec.start)}%`; b.style.width = `${((sec.end - sec.start) / span) * 100}%`;
      // Started before the view: its words stay where they can be read.
      if (sec.start < a && sec.end > a) b.style.paddingLeft = `${((a - sec.start) / span) * bw}px`;
      if (hue !== null) b.style.setProperty('--hue', String(hue));
      const cast = sec.layers.map((l) => this.d.names(l.widget)).reverse().join(', ');
      b.title = `${sec.label ?? 'Section'}, ${clock(sec.start)}–${clock(sec.end)}: ${cast || 'no widgets'}. Double-click to play from here.`;
      b.innerHTML = `<span class="sec-name"></span><span class="sec-cast"></span>`;
      b.querySelector('.sec-name')!.textContent = sec.label ?? `Section ${i + 1}`;
      b.querySelector('.sec-cast')!.textContent = cast || 'empty';
      b.addEventListener('click', () => this.selectSection(i));
      b.addEventListener('dblclick', () => this.d.seek(sec.start));
      this.band.append(b);
    });
    for (let i = 1; i < show.sections.length; i++) {
      const h = document.createElement('div');
      h.className = `handle${i === sel || i === sel + 1 ? ' near' : ''}`;
      h.style.left = `${this.pc(show.sections[i].start)}%`;
      const px = (j: number) => ((show.sections[j].end - show.sections[j].start) / span) * bw, hw = handleWidth(px(i - 1), px(i));
      h.style.width = `${hw}px`; h.style.marginLeft = `${-hw / 2}px`;
      h.setAttribute('role', 'separator'); h.setAttribute('aria-label', `Boundary at ${clock(show.sections[i].start)}: drag to move`);
      h.title = 'Drag to move where the sections change (Alt: no snapping to attacks)';
      this.wireHandle(h, i);
      this.band.append(h);
    }
  }

  private wireHandle(h: HTMLElement, index: number): void {
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      h.setPointerCapture(e.pointerId);
      this.dragging = true; this.drag++;
      h.classList.add('drag');
      const group = `boundary:${index}:${this.drag}`, x0 = e.clientX;
      let moved = false;
      const move = (ev: PointerEvent) => {
        // A click on a boundary is a click on the section under it: a shaky hand must not move the boundary.
        if (!moved && Math.abs(ev.clientX - x0) < 4) return;
        moved = true;
        const t = snapToAttack(this.tAt(ev.clientX), this.d.chords, ev.altKey);
        this.d.store.dispatch({ type: 'edit', edit: { kind: 'moveBoundary', index, t }, group });
        const now = this.d.store.state.show!.sections[index].start;
        h.style.left = `${this.pc(now)}%`;
        this.place(index);
        this.showTip(ev.clientX, clock(now) + (ev.altKey ? '' : ', at an attack'));
      };
      const end = (ev: PointerEvent) => {
        h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', end); h.removeEventListener('pointercancel', end);
        h.classList.remove('drag'); this.dragging = false; this.tip.hidden = true; this.bandKey = '';
        if (!moved && ev.type === 'pointerup') this.selectAt(this.tAt(ev.clientX));
        this.update(this.d.store.state); this.d.refresh();
      };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
    });
  }

  /** Moves the two section blocks next to boundary i while it is dragged (the band is rebuilt when it ends). */
  private place(i: number): void {
    const show = this.d.store.state.show!, span = this.view.b - this.view.a;
    const blocks = this.band.querySelectorAll<HTMLElement>('.sec');
    for (const j of [i - 1, i]) {
      const sec = show.sections[j], b = blocks[j];
      if (!sec || !b) continue;
      b.style.left = `${this.pc(sec.start)}%`; b.style.width = `${((sec.end - sec.start) / span) * 100}%`;
    }
  }

  /** The loudness silhouette in each section's hue, the attacks as ticks beneath. */
  private drawWave(show: Show): void {
    const cv = this.wave, dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const D = this.d.duration(), HOP = 0.25, mid = (h - 8) / 2, { a: va, b: vb } = this.view, span = vb - va;
    const X = (t: number) => ((t - va) / span) * w, T = (x: number) => va + (x / w) * span;
    const A = (this.act ??= activity(this.d.chords, this.d.song.loudness, D, HOP));
    const at = (t: number) => A[Math.min(A.length - 1, Math.max(0, Math.floor(t / HOP)))] ?? 0;
    show.sections.forEach((sec, i) => {
      if (sec.end <= va || sec.start >= vb) return;
      const hue = sectionHue(show, i);
      const x0 = Math.max(0, X(sec.start)), x1 = Math.min(w, X(sec.end));
      g.fillStyle = hue === null ? '#3a3336' : `hsl(${hue} 30% 44%)`;
      g.beginPath(); g.moveTo(x0, mid);
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const t0 = T(x), t1 = T(x + 1);
        let v = 0; for (let t = t0; t < t1 + 1e-9; t += HOP) v = Math.max(v, at(t));
        g.lineTo(Math.min(x1, Math.max(x0, x)), mid - Math.max(0.6, v * mid * 0.95));
      }
      for (let x = Math.ceil(x1); x >= Math.floor(x0); x--) {
        const t0 = T(x), t1 = T(x + 1);
        let v = 0; for (let t = t0; t < t1 + 1e-9; t += HOP) v = Math.max(v, at(t));
        g.lineTo(Math.min(x1, Math.max(x0, x)), mid + Math.max(0.6, v * mid * 0.95));
      }
      g.closePath(); g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
    });
    g.fillStyle = '#e9e2da';
    for (const ch of this.d.chords) {
      if (ch.t < va || ch.t > vb) continue;
      const x = X(ch.t);
      g.globalAlpha = 0.06 + 0.4 * Math.min(1, ch.vel / 127) ** 2;
      g.fillRect(x, h - 6, 1, 3 + 3 * Math.min(1, ch.notes.length / 6));
    }
    g.globalAlpha = 1;
  }
}
