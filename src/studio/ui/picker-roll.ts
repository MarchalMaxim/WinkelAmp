/**
 * The note picker's roll and whole-song strip (spec 2026-11-01-note-picker). The bars sit on a cached canvas, redrawn only
 * when the view, the marks, the hidden instruments or the sets change; the playhead, the hover and the box on a canvas above
 * it, so playing costs next to nothing even on the Four Seasons. The strip is cached too.
 */
import type { Mark } from '../show/melody';
import { boxHits, clock, moveView, nameOf, noteAt, tipWords, zoomView, type Instrument, type NoteIndex, type RollGeo, type RollNote, type View } from './picker-logic';

export interface RollDeps {
  /** Sorted by start, and their index. */
  notes: readonly RollNote[]; index: NoteIndex;
  instruments: readonly Instrument[]; duration: number;
  marked: ReadonlySet<number>; hidden: ReadonlySet<number>;
  /** Marks that found no note: drawn as outlines. */
  unmatched(): readonly Mark[];
  /** A note in a placed set: its widget's colour. */
  dotOf(id: number): string | undefined;
  time(): number;
  click(n: RollNote): void;
  box(hits: RollNote[], unmark: boolean): void;
  seek(t: number): void;
}

const GUTTER = 120, TOP = 18, BLACK = [1, 3, 6, 8, 10], MARK = '#f4b740', CLICK_SLOP = 5;
/** Above this many bars in view they are plain rectangles: round ones cost more than they show when so small. */
const ROUND_UP_TO = 1500;
const SPANS = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600];

/** The canvas at the device's pixels, its context in CSS pixels. Setting a size clears it, so only when it changes. */
function fit(c: HTMLCanvasElement, W: number, H: number): CanvasRenderingContext2D {
  const d = window.devicePixelRatio || 1, w = Math.round(W * d), h = Math.round(H * d);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d')!;
  g.setTransform(d, 0, 0, d, 0, 0);
  return g;
}

export class PickerRoll {
  readonly el = document.createElement('div');
  readonly stripEl = document.createElement('canvas');
  view: View;
  /** How long the last draw of the playhead layer (and of the bars) took, in ms. */
  lastDrawMs = 0;
  lastBarsMs = 0;
  readonly geo: RollGeo;
  private readonly bars = document.createElement('canvas');
  private readonly top = document.createElement('canvas');
  private readonly tip = document.createElement('div');
  private readonly stripCache = document.createElement('canvas');
  private readonly lo: number;
  private readonly hi: number;
  private W = 0;
  private H = 0;
  private stale = true;
  private stripStale = true;
  private topStale = true;
  private drawnAt = -1;
  /** What a click can hit (hidden instruments' notes can't be), and what is drawn (their marked notes stay). */
  private hittable: RollNote[] = [];
  private shown: RollNote[] = [];
  private hover: RollNote | null = null;
  private down: { x: number; y: number; alt: boolean } | null = null;
  private band: { x0: number; y0: number; x1: number; y1: number; alt: boolean } | null = null;
  private stripDown = false;

  constructor(private readonly d: RollDeps) {
    let lo = Infinity, hi = -Infinity;
    for (const n of d.notes) { if (n.m < lo) lo = n.m; if (n.m > hi) hi = n.m; }
    this.lo = d.notes.length ? lo - 1 : 59; this.hi = d.notes.length ? hi + 1 : 61;
    const first = Math.max(0, (d.notes[0]?.t ?? 1) - 1);
    this.view = moveView({ a: first, b: first + Math.min(d.duration, 24) }, first, d.duration);
    const roll = this;
    this.geo = {
      xOf: (t) => GUTTER + ((t - roll.view.a) / (roll.view.b - roll.view.a)) * (roll.W - GUTTER),
      yOf: (m) => TOP + (roll.hi - m) * roll.geo.rowH,
      get rowH() { return (roll.H - TOP) / (roll.hi - roll.lo + 1); },
      gutter: GUTTER, top: TOP,
    };
    this.el.className = 'np-roll';
    this.bars.className = 'np-roll-bars';
    this.top.className = 'np-roll-top';
    this.top.setAttribute('aria-label', 'Piano roll of the song. Click notes to mark them as melody.');
    this.tip.className = 'np-tip';
    this.tip.hidden = true;
    this.el.append(this.bars, this.top, this.tip);
    this.stripEl.className = 'np-strip';
    this.stripEl.setAttribute('aria-label', 'Whole song. Drag to move the view.');
    this.listen();
    new ResizeObserver(() => this.resize()).observe(this.el);
    this.pick();
  }

  xOf(t: number): number { return this.geo.xOf(t); }
  yOf(m: number): number { return this.geo.yOf(m); }
  noteAt(x: number, y: number): RollNote | null { return noteAt(this.hittable, x, y, this.geo); }
  tOf(x: number): number { return this.view.a + ((x - GUTTER) / (this.W - GUTTER)) * (this.view.b - this.view.a); }
  /** Where the time axis starts, and how wide it is: the set rows line up with it. */
  get axis(): { x: number; w: number } { return { x: GUTTER, w: Math.max(0, this.W - GUTTER) }; }

  /** The marks, the hidden instruments or the sets changed. */
  invalidate(): void { this.pick(); this.stale = this.stripStale = this.topStale = true; }

  setView(v: View): void { this.view = v; this.pick(); this.stale = this.topStale = true; this.hideTip(); }
  zoom(f: number, about = (this.view.a + this.view.b) / 2): void { this.setView(zoomView(this.view, f, about, this.d.duration)); }
  /** Playing: the view keeps the playhead on screen. */
  follow(t: number): void {
    const { a, b } = this.view, span = b - a;
    if (!this.down && (t > b - span * 0.08 || t < a)) this.setView(moveView(this.view, t - span * 0.1, this.d.duration));
  }

  resize(): void {
    const W = this.el.clientWidth, H = this.el.clientHeight;
    if ((W === this.W && H === this.H) || !W || !H) return;
    this.W = W; this.H = H;
    this.stale = this.stripStale = this.topStale = true;
  }

  /** A frame: whatever has gone stale, and the playhead when it moved. */
  paint(): void {
    if (!this.W) this.resize();
    if (!this.W) return;
    if (this.stale) { this.drawBars(); this.stale = false; this.topStale = true; }
    const t = this.d.time();
    if (!this.topStale && t === this.drawnAt) return;
    const t0 = performance.now();
    this.drawTop(t);
    this.drawStrip(t);
    this.lastDrawMs = performance.now() - t0;
    this.topStale = false; this.drawnAt = t;
  }

  private pick(): void {
    const { hidden, marked, index } = this.d, inView = index.inView(this.view.a, this.view.b);
    this.hittable = hidden.size ? inView.filter((n) => !hidden.has(n.i)) : inView;
    this.shown = hidden.size ? inView.filter((n) => !hidden.has(n.i) || marked.has(n.id)) : inView;
    if (this.hover && !this.hittable.includes(this.hover)) this.hover = null;
  }

  // ---- drawing ----

  private bar(g: CanvasRenderingContext2D, n: { t: number; e: number; m: number }, rh: number, round: boolean): void {
    const x = this.geo.xOf(n.t), w = Math.max(3, this.geo.xOf(n.e) - x), y = this.geo.yOf(n.m), h = Math.max(2.5, rh - 0.5);
    const left = Math.max(GUTTER, x), wide = w - (left - x);
    if (!round) { g.fillRect(left, y, wide, h); return; }
    g.beginPath(); g.roundRect(left, y, wide, h, Math.min(2, h / 2)); g.fill();
  }

  private drawBars(): void {
    const t0 = performance.now(), { W, H, lo, hi, view, geo } = this, g = fit(this.bars, W, H), rh = geo.rowH;
    const many = this.d.instruments.length > 1, { marked, instruments } = this.d;
    g.clearRect(0, 0, W, H);
    g.font = '11px system-ui';
    for (let m = lo; m <= hi; m++) {
      if (BLACK.includes(m % 12)) { g.fillStyle = '#ffffff06'; g.fillRect(GUTTER, geo.yOf(m), W - GUTTER, rh); }
      if (m % 12 === 0) {
        g.fillStyle = '#ffffff14'; g.fillRect(GUTTER, geo.yOf(m) + rh, W - GUTTER, 1);
        g.fillStyle = '#8d8379'; g.textAlign = 'right'; g.textBaseline = 'middle';
        g.fillText(nameOf(m), GUTTER - 8, geo.yOf(m) + rh / 2);
      }
    }
    const span = view.b - view.a, step = SPANS.find((s) => span / s < 12) ?? 1200;
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let s = Math.ceil(view.a / step) * step; s < view.b; s += step) {
      const x = geo.xOf(s);
      g.fillStyle = '#ffffff0c'; g.fillRect(x, TOP, 1, H - TOP);
      g.fillStyle = '#8d8379'; g.fillText(clock(s), x, 3);
    }
    const round = this.shown.length <= ROUND_UP_TO;
    for (const n of this.shown) {
      if (marked.has(n.id)) continue;
      if (many) { g.fillStyle = instruments[n.i].color; g.globalAlpha = 0.4 + (0.55 * n.v) / 127; } else g.fillStyle = `rgba(150,158,175,${0.25 + (0.55 * n.v) / 127})`;
      this.bar(g, n, rh, round);
    }
    g.globalAlpha = 1;
    for (const n of this.shown) {
      if (!marked.has(n.id)) continue;
      g.fillStyle = MARK; this.bar(g, n, rh, true);
      if (many && geo.xOf(n.t) >= GUTTER) { g.fillStyle = instruments[n.i].color; g.fillRect(geo.xOf(n.t), geo.yOf(n.m), 4, Math.max(2.5, rh - 0.5)); }
    }
    for (const n of this.shown) {
      const c = this.d.dotOf(n.id);
      if (!c || geo.xOf(n.t) < GUTTER) continue;
      g.fillStyle = c; g.beginPath(); g.arc(geo.xOf(n.t), geo.yOf(n.m) + rh / 2, Math.max(3.5, rh * 0.62), 0, 7); g.fill();
    }
    // A mark with no note here: an outline, so it is seen and can be judged, never dropped silently.
    g.strokeStyle = MARK; g.lineWidth = 1; g.setLineDash([3, 2]);
    for (const k of this.d.unmatched()) {
      if (k[1] <= view.a || k[0] >= view.b) continue;
      const x = geo.xOf(k[0]);
      if (x >= GUTTER) g.strokeRect(x, geo.yOf(k[2]), Math.max(4, geo.xOf(k[1]) - x), Math.max(2.5, rh - 0.5));
    }
    g.setLineDash([]);
    g.fillStyle = '#0d0a0d'; g.fillRect(0, 0, GUTTER, TOP);
    this.lastBarsMs = performance.now() - t0;
  }

  private drawTop(t: number): void {
    const { W, H, hover, band, geo } = this, g = fit(this.top, W, H), rh = geo.rowH;
    g.clearRect(0, 0, W, H);
    if (hover && !band) {
      g.strokeStyle = '#fff'; g.lineWidth = 1;
      g.strokeRect(geo.xOf(hover.t) - 0.5, geo.yOf(hover.m) - 0.5, Math.max(4, geo.xOf(hover.e) - geo.xOf(hover.t)) + 1, rh + 1);
    }
    if (band) {
      g.fillStyle = band.alt ? '#ff5d5d22' : '#f4b74022'; g.strokeStyle = band.alt ? '#ff5d5d' : MARK; g.lineWidth = 1;
      const x = Math.min(band.x0, band.x1), y = Math.min(band.y0, band.y1), w = Math.abs(band.x1 - band.x0), h = Math.abs(band.y1 - band.y0);
      g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
    }
    const px = geo.xOf(t);
    if (px >= GUTTER && px <= W) { g.fillStyle = '#fff'; g.fillRect(px, 0, 1.5, H); }
  }

  private drawStrip(t: number): void {
    const W = this.stripEl.clientWidth, H = this.stripEl.clientHeight;
    if (!W || !H) return;
    const { duration, notes, marked, hidden, instruments } = this.d, many = instruments.length > 1, d = window.devicePixelRatio || 1;
    if (this.stripStale || this.stripCache.width !== Math.round(W * d) || this.stripCache.height !== Math.round(H * d)) {
      const c = fit(this.stripCache, W, H), { lo, hi } = this;
      c.clearRect(0, 0, W, H);
      for (const n of notes) {
        const on = marked.has(n.id);
        if (!on && hidden.has(n.i)) continue;
        c.fillStyle = on ? MARK : many ? instruments[n.i].color : '#5f6573';
        c.fillRect((n.t / duration) * W, H - 3 - ((n.m - lo) / (hi - lo)) * (H - 6), on ? 2 : 1, 1.5);
      }
      this.stripStale = false;
    }
    const g = fit(this.stripEl, W, H), { a, b } = this.view;
    g.clearRect(0, 0, W, H);
    g.drawImage(this.stripCache, 0, 0, W, H);
    g.fillStyle = '#ffffff14'; g.strokeStyle = '#ffffff66'; g.lineWidth = 1;
    g.fillRect((a / duration) * W, 0.5, ((b - a) / duration) * W, H - 1);
    g.strokeRect((a / duration) * W, 0.5, ((b - a) / duration) * W, H - 1);
    g.fillStyle = '#fff'; g.fillRect((t / duration) * W, 0, 1, H);
  }

  // ---- the pointer ----

  private hideTip(): void { this.hover = null; this.tip.hidden = true; this.topStale = true; }

  private listen(): void {
    const roll = this.top, pos = (e: MouseEvent, el: HTMLElement) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    roll.addEventListener('pointerdown', (e) => {
      const [x, y] = pos(e, roll);
      this.down = { x, y, alt: e.altKey };
      roll.setPointerCapture(e.pointerId);
    });
    roll.addEventListener('pointermove', (e) => {
      const [x, y] = pos(e, roll);
      if (this.down) {
        if (this.band || Math.hypot(x - this.down.x, y - this.down.y) > CLICK_SLOP) this.band = { x0: this.down.x, y0: this.down.y, x1: x, y1: y, alt: this.down.alt };
        this.hideTip();
        return;
      }
      const n = this.noteAt(x, y);
      if (n !== this.hover) { this.hover = n; this.topStale = true; }
      this.tip.hidden = !n;
      if (n) {
        this.tip.textContent = tipWords(n, this.d.instruments.length > 1 ? this.d.instruments[n.i].label : null);
        this.tip.style.left = `${Math.min(x + 12, this.W - 150)}px`;
        this.tip.style.top = `${Math.max(0, y - 28)}px`;
      }
    });
    roll.addEventListener('pointerleave', () => this.hideTip());
    roll.addEventListener('pointerup', (e) => {
      const [x, y] = pos(e, roll), { band, down } = this;
      this.band = null; this.down = null; this.topStale = true;
      if (band) { const hits = boxHits(this.hittable, band, this.geo); if (hits.length) this.d.box(hits, band.alt); return; }
      if (!down) return;
      const n = this.noteAt(x, y);
      if (n) this.d.click(n); else if (x >= GUTTER) this.d.seek(Math.max(0, this.tOf(x)));
    });
    roll.addEventListener('pointercancel', () => { this.band = null; this.down = null; this.topStale = true; });
    roll.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) this.zoom(Math.exp(e.deltaY * 0.0015), this.tOf(pos(e, roll)[0]));
      else this.setView(moveView(this.view, this.view.a + ((e.deltaX || e.deltaY) / 800) * (this.view.b - this.view.a), this.d.duration));
    }, { passive: false });
    const strip = this.stripEl;
    const go = (e: PointerEvent) => {
      const t = (pos(e, strip)[0] / strip.clientWidth) * this.d.duration;
      this.setView(moveView(this.view, t - (this.view.b - this.view.a) / 2, this.d.duration));
    };
    strip.addEventListener('pointerdown', (e) => { this.stripDown = true; strip.setPointerCapture(e.pointerId); go(e); });
    strip.addEventListener('pointermove', (e) => { if (this.stripDown) go(e); });
    strip.addEventListener('pointerup', () => { this.stripDown = false; });
  }
}
