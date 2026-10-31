/**
 * The timeline: the song's loudness as a silhouette, tinted section by section by the widget at the bottom of each
 * stack, with the attacks as ticks beneath (click or drag there to move the playhead); below it the sections, to
 * select, with boundaries to drag (snapping just before an attack within 0.25 s; Alt drags freely).
 */
import type { SongPack } from '../pack/pack';
import type { Show } from '../show/show';
import type { Chord } from '../../widgets/types';
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

interface Deps { store: Store; song: SongPack; chords: Chord[]; duration: () => number; seek(t: number): void; refresh(): void; names: (id: string) => string }

export class Timeline {
  readonly el: HTMLElement;
  private readonly wave: HTMLCanvasElement;
  private readonly band: HTMLElement;
  private readonly head: HTMLElement;
  private readonly ghost: HTMLElement;
  private readonly tip: HTMLElement;
  private drawnFor: Show | null = null;
  private drawnWidth = 0;
  private act: number[] | null = null;
  private bandKey = '';
  private dragging = false;
  private drag = 0;

  constructor(private readonly d: Deps) {
    this.el = document.createElement('div');
    this.el.className = 'timeline';
    this.el.innerHTML = `<div class="scrub" title="Click or drag to move the playhead"><canvas class="wave"></canvas><div class="ghost"></div></div>
      <div class="band" role="listbox" aria-label="Sections"></div><div class="playhead"></div><div class="tip" hidden></div>`;
    this.wave = this.el.querySelector('.wave')!;
    this.band = this.el.querySelector('.band')!;
    this.head = this.el.querySelector('.playhead')!;
    this.ghost = this.el.querySelector('.ghost')!;
    this.tip = this.el.querySelector('.tip')!;
    this.wireScrub();
    new ResizeObserver(() => { this.drawnFor = null; this.update(this.d.store.state); }).observe(this.el);
  }

  private tAt(clientX: number): number {
    const r = this.band.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * this.d.duration();
  }

  private wireScrub(): void {
    const scrub = this.el.querySelector<HTMLElement>('.scrub')!;
    let down = false;
    scrub.addEventListener('pointerdown', (e) => { down = true; scrub.setPointerCapture(e.pointerId); this.d.seek(this.tAt(e.clientX)); });
    scrub.addEventListener('pointermove', (e) => {
      const t = this.tAt(e.clientX);
      this.ghost.style.left = `${(t / this.d.duration()) * 100}%`;
      this.showTip(e.clientX, clock(t));
      if (down) this.d.seek(t);
    });
    const up = () => { down = false; this.tip.hidden = true; };
    scrub.addEventListener('pointerup', up);
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
    const d = this.d.duration();
    this.head.style.left = `${d ? (t / d) * 100 : 0}%`;
  }

  update(s: StudioState): void {
    const show = s.show;
    if (!show) return;
    const w = this.wave.clientWidth;
    if (show !== this.drawnFor || w !== this.drawnWidth) { this.drawWave(show); this.drawnFor = show; this.drawnWidth = w; }
    const key = JSON.stringify([s.selected.section, show.sections.map((x) => [x.start, x.end, x.label, x.layers.map((l) => l.widget)])]);
    if (key !== this.bandKey && !this.dragging) { this.bandKey = key; this.buildBand(s); }
  }

  private buildBand(s: StudioState): void {
    const show = s.show!, D = this.d.duration(), sel = s.selected.section;
    this.band.textContent = '';
    show.sections.forEach((sec, i) => {
      const hue = sectionHue(show, i);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `sec${i === sel ? ' on' : ''}${hue === null ? ' empty' : ''}`;
      b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(i === sel));
      b.style.left = `${(sec.start / D) * 100}%`; b.style.width = `${((sec.end - sec.start) / D) * 100}%`;
      if (hue !== null) b.style.setProperty('--hue', String(hue));
      const cast = sec.layers.map((l) => this.d.names(l.widget)).reverse().join(', ');
      b.title = `${sec.label ?? 'Section'} · ${clock(sec.start)}–${clock(sec.end)}${cast ? ` · ${cast}` : ' · no widgets'}`;
      b.innerHTML = `<span class="sec-name"></span><span class="sec-cast"></span>`;
      b.querySelector('.sec-name')!.textContent = sec.label ?? `Section ${i + 1}`;
      b.querySelector('.sec-cast')!.textContent = cast || 'empty';
      b.addEventListener('click', () => this.d.store.dispatch({ type: 'select', section: i }));
      b.addEventListener('dblclick', () => this.d.seek(sec.start));
      this.band.append(b);
    });
    for (let i = 1; i < show.sections.length; i++) {
      const h = document.createElement('div');
      h.className = `handle${i === sel || i === sel + 1 ? ' near' : ''}`;
      h.style.left = `${(show.sections[i].start / D) * 100}%`;
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
      const group = `boundary:${index}:${this.drag}`;
      const move = (ev: PointerEvent) => {
        const t = snapToAttack(this.tAt(ev.clientX), this.d.chords, ev.altKey);
        this.d.store.dispatch({ type: 'edit', edit: { kind: 'moveBoundary', index, t }, group });
        const now = this.d.store.state.show!.sections[index].start;
        h.style.left = `${(now / this.d.duration()) * 100}%`;
        this.place(index);
        this.showTip(ev.clientX, clock(now) + (ev.altKey ? '' : ' · snapped'));
      };
      const end = () => {
        h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', end); h.removeEventListener('pointercancel', end);
        h.classList.remove('drag'); this.dragging = false; this.tip.hidden = true; this.bandKey = '';
        this.update(this.d.store.state); this.d.refresh();
      };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
    });
  }

  /** Moves the two section blocks next to boundary i while it is dragged (the band is rebuilt when it ends). */
  private place(i: number): void {
    const show = this.d.store.state.show!, D = this.d.duration();
    const blocks = this.band.querySelectorAll<HTMLElement>('.sec');
    for (const j of [i - 1, i]) {
      const sec = show.sections[j], b = blocks[j];
      if (!sec || !b) continue;
      b.style.left = `${(sec.start / D) * 100}%`; b.style.width = `${((sec.end - sec.start) / D) * 100}%`;
    }
  }

  /** The loudness silhouette in each section's hue, the attacks as ticks beneath. */
  private drawWave(show: Show): void {
    const cv = this.wave, dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const D = this.d.duration(), HOP = 0.25, mid = (h - 8) / 2;
    const A = (this.act ??= activity(this.d.chords, this.d.song.loudness, D, HOP));
    const at = (t: number) => A[Math.min(A.length - 1, Math.max(0, Math.floor(t / HOP)))] ?? 0;
    show.sections.forEach((sec, i) => {
      const hue = sectionHue(show, i);
      const x0 = (sec.start / D) * w, x1 = (sec.end / D) * w;
      g.fillStyle = hue === null ? '#3a3336' : `hsl(${hue} 30% 44%)`;
      g.beginPath(); g.moveTo(x0, mid);
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const t0 = (x / w) * D, t1 = ((x + 1) / w) * D;
        let v = 0; for (let t = t0; t < t1 + 1e-9; t += HOP) v = Math.max(v, at(t));
        g.lineTo(Math.min(x1, Math.max(x0, x)), mid - Math.max(0.6, v * mid * 0.95));
      }
      for (let x = Math.ceil(x1); x >= Math.floor(x0); x--) {
        const t0 = (x / w) * D, t1 = ((x + 1) / w) * D;
        let v = 0; for (let t = t0; t < t1 + 1e-9; t += HOP) v = Math.max(v, at(t));
        g.lineTo(Math.min(x1, Math.max(x0, x)), mid + Math.max(0.6, v * mid * 0.95));
      }
      g.closePath(); g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
    });
    g.fillStyle = '#e9e2da';
    for (const ch of this.d.chords) {
      const x = (ch.t / D) * w;
      g.globalAlpha = 0.06 + 0.4 * Math.min(1, ch.vel / 127) ** 2;
      g.fillRect(x, h - 6, 1, 3 + 3 * Math.min(1, ch.notes.length / 6));
    }
    g.globalAlpha = 1;
  }
}
