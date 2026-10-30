/**
 * Frame pipeline:
 *   1. feedback  – last frame redrawn slightly zoomed/rotated and faded (trails, drift)
 *   2. scene     – drawn into an offscreen layer, plus the user's ink
 *   3. mirror    – the layer's first wedge copied around the circle (kaleidoscope)
 *   4. composite – added onto the screen like light, with a cheap bloom glow
 *
 * Everything moves on music time (MusicClock), as on the stage: in silence the last
 * picture holds exactly (scene, trails, tunnel drift, jolts); only the trails' fade
 * while music plays and the user's ink run on the wall clock.
 */
import { emptyFeatures, type Features } from '../audio/features';
import type { Motion } from '../mapping';
import type { Look } from '../settings';
import { hsl, PALETTES, soundColor, type Hsl } from './color';
import { colorNow, type Frame, type Scene } from './scene';
import { Bloom } from './scenes/bloom';
import { Pulse } from './scenes/pulse';
import { Ribbons } from './scenes/ribbons';
import { Swarm } from './scenes/swarm';

interface Ink {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  c: Hsl;
}

const canvas2d = () => {
  const c = document.createElement('canvas');
  return [c, c.getContext('2d')!] as const;
};

export class Renderer {
  readonly scenes: Record<string, Scene> = {
    bloom: new Bloom(),
    swarm: new Swarm(),
    ribbons: new Ribbons(),
    pulse: new Pulse(),
  };

  private ctx: CanvasRenderingContext2D;
  private fb = canvas2d();
  private layer = canvas2d();
  private comp = canvas2d();
  private glowA = canvas2d();
  private glowB = canvas2d();
  private w = 0;
  private h = 0;
  private dpr = 1;
  private ink: Ink[] = [];
  private lastPointer: { x: number; y: number } | null = null;
  private shakeX = 0;
  private shakeY = 0;
  private drift = 0;

  /** The sound of the last frame with music time: what the scene draws while the clock stands still. */
  private held: { f: Features; m: Motion } | null = null;
  /** The look (and zoom) the canvas was last drawn with; '' = not drawn since a clear. */
  private drawnFor = '';

  /** Mouse-wheel zoom. */
  userZoom = 1;
  /** Horizontal shift of the visual's center (CSS px), e.g. to make room for a panel. */
  offsetTarget = 0;
  private offsetX = 0;
  /** Pointer in screen coordinates relative to the center. */
  pointer = { x: 0, y: 0, down: false };

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    const W = Math.round(this.w * this.dpr);
    const H = Math.round(this.h * this.dpr);
    for (const c of [this.canvas, this.fb[0], this.layer[0], this.comp[0]]) {
      c.width = W;
      c.height = H;
    }
    this.glowA[0].width = Math.ceil(W / 4);
    this.glowA[0].height = Math.ceil(H / 4);
    this.glowB[0].width = Math.ceil(W / 12);
    this.glowB[0].height = Math.ceil(H / 12);
    this.clear();
  }

  /** A black canvas (after a resize, or when Classic is shown again): the next frame draws, music or not. */
  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawnFor = '';
  }

  /** Converts a screen point (relative to center) into the layer's first mirror wedge. */
  private fold(x: number, y: number, mirror: number) {
    x /= this.userZoom;
    y /= this.userZoom;
    if (mirror <= 1) return { x, y };
    const theta = (Math.PI * 2) / mirror;
    const d = Math.hypot(x, y);
    let a = Math.atan2(y, x);
    if (a < 0) a += Math.PI * 2;
    const k = Math.floor(a / theta);
    let local = a - k * theta;
    if (k % 2 === 1) local = theta - local;
    return { x: Math.cos(local) * d, y: Math.sin(local) * d };
  }

  /**
   * A burst of light, in the color of the current sound — or of a given note
   * (MIDI keys), with `strength` scaling its size and spread.
   */
  burst(sx: number, sy: number, look: Look, f: Features, m: Motion, note?: number, strength = 0.7) {
    const p = this.fold(sx, sy, look.mirror);
    const palette = PALETTES.find((x) => x.id === look.palette)!;
    const fr = { f, m, palette } as Frame;
    const n = Math.round(16 + strength * 44);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const v = (1 + Math.random() * 4) * (0.5 + strength);
      const c = note === undefined
        ? colorNow(fr, Math.random() * 0.2)
        : soundColor(palette, note, 1, 0.6 + strength * 0.4, Math.random() * 0.05);
      this.ink.push({
        x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1,
        size: (2 + Math.random() * 4) * (0.6 + strength * 0.8), c,
      });
    }
  }

  private paint(fr: Frame, mirror: number) {
    const { pointer } = this;
    if (!pointer.down) {
      this.lastPointer = null;
      return;
    }
    const p = this.fold(pointer.x, pointer.y, mirror);
    const from = this.lastPointer ?? p;
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y) / 6));
    for (let s = 0; s < steps; s++) {
      const u = (s + 1) / steps;
      this.ink.push({
        x: from.x + (p.x - from.x) * u + (Math.random() - 0.5) * 4,
        y: from.y + (p.y - from.y) * u + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, life: 1,
        size: 3 + fr.f.level * 14 * (0.5 + fr.m.size * 0.5),
        c: colorNow(fr, Math.random() * 0.08),
      });
    }
    this.lastPointer = p;
  }

  private drawInk(fr: Frame) {
    const { ctx, dt, f } = fr;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.ink) {
      p.life -= dt * 0.55;
      if (p.life <= 0) continue;
      // Ink breathes with the music.
      const k = 1 + f.beat * 0.6;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.vx *= 0.96;
      p.vy *= 0.96;
      const s = p.size * (0.4 + p.life * 0.6) * (0.8 + f.bass * 0.5);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      g.addColorStop(0, hsl({ ...p.c, l: Math.min(92, p.c.l + 20) }, p.life * 0.9));
      g.addColorStop(1, hsl(p.c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
    }
    if (this.ink.length > 3000) this.ink.splice(0, this.ink.length - 3000);
    this.ink = this.ink.filter((p) => p.life > 0);
  }

  /**
   * The sound a scene draws from: this frame's while music time runs, else the last
   * music frame's (no onset): room noise, or the auto-gained spectrum of a quiet room,
   * must not move or recolor a frozen picture.
   */
  private sound(f: Features, m: Motion, musicDt: number) {
    if (musicDt > 0 || !this.held) {
      const h = (this.held ??= { f: emptyFeatures(), m: { ...m } });
      // Own copies of the arrays: the analysis chain rewrites its own in place.
      const copy = (to: Float32Array, from: Float32Array) => {
        const out = to.length === from.length ? to : new Float32Array(from.length);
        out.set(from);
        return out;
      };
      const { chroma, spectrum, waveform } = h.f;
      Object.assign(h.f, f, {
        onset: false, chroma: copy(chroma, f.chroma), spectrum: copy(spectrum, f.spectrum), waveform: copy(waveform, f.waveform),
      });
      Object.assign(h.m, m);
    }
    return musicDt > 0 ? { f, m } : this.held!;
  }

  /**
   * Draws a frame. Every motion runs on `musicDt` (music seconds; 0 in silence, so the
   * picture holds still); wall `dt` only fades the trails, eases the offset and moves
   * what the user paints.
   */
  render(live: Features, liveMotion: Motion, look: Look, dt: number, musicDt: number) {
    // In silence the last picture holds exactly, unless something the user did (ink, another
    // look, the drawer's offset, a resize) needs a frame; that frame skips the feedback, since
    // a still scene redrawn over its own trails only builds up toward white.
    const still = musicDt <= 0;
    const drawFor = `${look.scene}|${look.palette}|${look.mirror}|${look.trails}|${look.drift}|${this.userZoom}`;
    const settled = Math.abs(this.offsetTarget - this.offsetX) < 0.5;
    if (still && drawFor === this.drawnFor && !this.ink.length && !this.pointer.down && settled) return;
    this.drawnFor = drawFor;
    const { f, m } = this.sound(live, liveMotion, musicDt);
    const { ctx, dpr, w, h } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const palette = PALETTES.find((p) => p.id === look.palette) ?? PALETTES[0];
    const r = Math.min(w, h) / 2;
    this.offsetX += (this.offsetTarget - this.offsetX) * Math.min(1, dt * 4);
    const cx = W / 2 + this.offsetX * dpr;
    const cy = H / 2;
    /** Frames' worth (at 60 fps) of music time. */
    const mk = Math.min(3, musicDt * 60);

    // 1. Feedback.
    const [, fbCtx] = this.fb;
    fbCtx.globalCompositeOperation = 'copy';
    fbCtx.drawImage(this.canvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const keep60 = 0.3 + look.trails * 0.66;
    const keep = still ? 0 : Math.pow(keep60, Math.min(3, dt * 60));
    this.drift += musicDt * (look.drift * 0.15 + m.spin * 0.05) * (look.drift > 0.02 ? 1 : 0);
    // The tunnel's zoom and turn per frame of music: none while the clock stands still.
    const zoom = Math.pow(1 + look.drift * (0.008 + m.zoom * 0.03), mk);
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(this.drift) * 0.012 * look.drift * mk);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = keep;
    ctx.drawImage(this.fb[0], 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    // 2. Scene into the layer.
    const [layerCanvas, lctx] = this.layer;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.globalAlpha = 1;
    lctx.clearRect(0, 0, W, H);
    lctx.setTransform(dpr * this.userZoom, 0, 0, dpr * this.userZoom, W / 2, H / 2);
    const pointerLayer = this.fold(this.pointer.x, this.pointer.y, look.mirror);
    const fr: Frame = {
      ctx: lctx, w: w / this.userZoom, h: h / this.userZoom, r, f, m, palette, dt, musicDt, t: f.time,
      pointer: { ...pointerLayer, down: this.pointer.down },
    };
    const scene = this.scenes[look.scene] ?? this.scenes.bloom;
    lctx.save();
    scene.draw(fr);
    lctx.restore();
    this.paint(fr, look.mirror);
    this.drawInk(fr);

    // 3. Mirror into the composite.
    const [compCanvas, cctx] = this.comp;
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.globalCompositeOperation = 'source-over';
    cctx.clearRect(0, 0, W, H);
    if (look.mirror <= 1) {
      cctx.drawImage(layerCanvas, cx - W / 2, 0);
    } else {
      const n = look.mirror;
      const theta = (Math.PI * 2) / n;
      const R = Math.hypot(W, H);
      for (let i = 0; i < n; i++) {
        cctx.save();
        cctx.translate(cx, cy);
        cctx.beginPath();
        cctx.moveTo(0, 0);
        // A hair of overlap hides seams between wedges.
        cctx.arc(0, 0, R, i * theta - 0.004, (i + 1) * theta + 0.004);
        cctx.closePath();
        cctx.clip();
        cctx.rotate(i * theta);
        if (i % 2 === 1) {
          cctx.rotate(theta);
          cctx.scale(1, -1);
        }
        cctx.drawImage(layerCanvas, -W / 2, -H / 2);
        cctx.restore();
      }
    }

    // 4. Composite: add the light, then a soft halo for glow.
    const shake = m.shake * r * 0.04 * dpr;
    if (f.onset) {
      this.shakeX = (Math.random() - 0.5) * shake;
      this.shakeY = (Math.random() - 0.5) * shake;
    }
    // An onset jolt settles in music time (held, not moving, while the clock stands still).
    const settle = Math.pow(0.8, mk);
    this.shakeX *= settle;
    this.shakeY *= settle;
    // Exposure: the more light the feedback loop keeps (long trails, tunnel drift),
    // the less each frame adds, so colors build up instead of blowing out to white.
    const exposure = Math.min(1, 0.45 + 1.6 * (1 - keep60) - look.drift * 0.15);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = exposure;
    ctx.drawImage(compCanvas, this.shakeX, this.shakeY);

    const [ga, gactx] = this.glowA;
    const [gb, gbctx] = this.glowB;
    gactx.globalCompositeOperation = 'copy';
    gactx.drawImage(compCanvas, 0, 0, ga.width, ga.height);
    gbctx.globalCompositeOperation = 'copy';
    gbctx.drawImage(ga, 0, 0, gb.width, gb.height);
    ctx.globalAlpha = Math.min(1, 0.15 + m.glow * 0.7) * exposure;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ga, this.shakeX, this.shakeY, W, H);
    ctx.drawImage(gb, this.shakeX, this.shakeY, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  snapshot(): Promise<Blob | null> {
    return new Promise((res) => this.canvas.toBlob(res, 'image/png'));
  }
}
