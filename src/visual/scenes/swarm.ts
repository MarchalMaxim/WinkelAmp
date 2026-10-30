import { hsl } from '../color';
import { colorNow, type Frame, type Scene } from '../scene';

const COUNT = 1600;
const BUCKETS = 6;

/** Fireflies riding a flow field; every beat blows them outward. */
export class Swarm implements Scene {
  id = 'swarm';
  name = 'Swarm';
  private x = new Float32Array(COUNT);
  private y = new Float32Array(COUNT);
  private vx = new Float32Array(COUNT);
  private vy = new Float32Array(COUNT);
  private seeded = false;

  private seed(w: number, h: number) {
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * Math.min(w, h) * 0.45;
      this.x[i] = Math.cos(a) * d;
      this.y[i] = Math.sin(a) * d;
    }
    this.seeded = true;
  }

  draw(fr: Frame) {
    const { ctx, f, m, r, w, h, t, pointer } = fr;
    if (!this.seeded) this.seed(w, h);
    // Frames' worth of music time: 0 in silence, so the swarm holds still (a tap pokes the clock).
    const k = Math.min(2, fr.musicDt * 60);
    const speed = (0.08 + m.speed * 0.5) * k;
    const kick = f.onset ? (0.6 + f.onsetStrength * 2.5) * (0.4 + m.size) : 0;
    const scale = 2.6 / r;
    const hw = w / 2 + 20;
    const hh = h / 2 + 20;
    const swirl = t * (0.1 + m.spin * 0.4);

    // Respawn a trickle of fireflies so the swarm never clumps for good.
    const respawn = Math.ceil(COUNT * 0.004 * k);
    for (let n = 0; n < respawn; n++) {
      const i = Math.floor(Math.random() * COUNT);
      this.x[i] = (Math.random() - 0.5) * w;
      this.y[i] = (Math.random() - 0.5) * h;
      this.vx[i] = this.vy[i] = 0;
    }

    for (let i = 0; i < COUNT; i++) {
      let px = this.x[i];
      let py = this.y[i];
      // Curl of a moving stream function: a divergence-free flow, so there
      // are no sinks for the particles to pile into.
      const nx = px * scale;
      const ny = py * scale;
      const sa = Math.sin(nx * 1.3 + swirl);
      const ca = Math.cos(nx * 1.3 + swirl);
      const sb = Math.sin(ny * 1.1 - swirl * 0.8);
      const cb = Math.cos(ny * 1.1 - swirl * 0.8);
      const cc = 0.35 * Math.cos((nx + ny) * 0.7 + t * 0.2);
      const fx = -1.1 * sa * sb + cc;
      const fy = -(1.3 * ca * cb + cc);
      this.vx[i] += fx * speed * 1.4;
      this.vy[i] += fy * speed * 1.4;
      const d = Math.hypot(px, py) + 1;
      if (kick) {
        const kk = (kick * (0.5 + (i % 7) / 7)) / (0.3 + d / r);
        this.vx[i] += (px / d) * kk;
        this.vy[i] += (py / d) * kk;
      }
      // Gentle gravity keeps the swarm on screen; the pointer is a magnet.
      const pull = 0.0003 * (1 + f.bass) * k;
      this.vx[i] -= px * pull;
      this.vy[i] -= py * pull;
      if (pointer.down) {
        const dx = pointer.x - px;
        const dy = pointer.y - py;
        const pd = Math.hypot(dx, dy) + 30;
        this.vx[i] += (dx / pd) * 0.6 * k;
        this.vy[i] += (dy / pd) * 0.6 * k;
      }
      const damp = Math.pow(0.93, k);
      this.vx[i] *= damp;
      this.vy[i] *= damp;
      px += this.vx[i] * k;
      py += this.vy[i] * k;
      if (px < -hw) px += hw * 2;
      else if (px > hw) px -= hw * 2;
      if (py < -hh) py += hh * 2;
      else if (py > hh) py -= hh * 2;
      this.x[i] = px;
      this.y[i] = py;
    }

    ctx.globalCompositeOperation = 'lighter';
    const size = 1.2 + m.size * 2.2;
    for (let b = 0; b < BUCKETS; b++) {
      const c = colorNow(fr, (b / BUCKETS) * 0.35);
      ctx.fillStyle = hsl({ ...c, l: Math.min(88, c.l + 8) }, 0.55 + m.glow * 0.35);
      ctx.beginPath();
      for (let i = b; i < COUNT; i += BUCKETS) {
        const sp = Math.min(3, Math.hypot(this.vx[i], this.vy[i]) * 0.4);
        const s = size * (0.6 + sp * 0.4);
        ctx.rect(this.x[i] - s / 2, this.y[i] - s / 2, s, s);
      }
      ctx.fill();
    }
  }
}
