import { hsl } from '../color';
import { colorNow, type Frame, type Scene } from '../scene';

/** The spectrum as a living flower: lows at the heart, highs on the petal tips. */
export class Bloom implements Scene {
  id = 'bloom';
  name = 'Bloom';
  private phase = 0;

  draw(fr: Frame) {
    const { ctx, f, m, r, dt } = fr;
    this.phase += dt * (0.05 + m.spin * 0.9);
    const spec = f.spectrum;
    const N = 160;
    const petals = 6;
    ctx.globalCompositeOperation = 'lighter';

    for (let layer = 3; layer >= 0; layer--) {
      const base = r * (0.1 + layer * 0.09) * (0.8 + m.size * 0.5);
      const reach = r * (0.22 + layer * 0.06) * (0.5 + m.size * 0.9);
      const dir = layer % 2 ? -1 : 1;
      const pts: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        const u = i / N;
        // Each petal sweeps lows → highs → lows, so the flower is symmetric.
        const petalU = (u * petals) % 1;
        const s = Math.abs(petalU * 2 - 1);
        const band = Math.min(spec.length - 1, Math.floor((1 - s) * (spec.length * (0.35 + layer * 0.2))));
        const v = spec[band];
        const shape = Math.pow(Math.sin(petalU * Math.PI), 0.6);
        const rad = base + reach * v * shape + reach * 0.15 * shape * f.beat;
        const a = u * Math.PI * 2 + this.phase * dir * (1 + layer * 0.3);
        pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
      const c = colorNow(fr, layer * 0.11);
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const p = pts[i % N];
        const q = pts[(i + 1) % N];
        const mx = (p[0] + q[0]) / 2;
        const my = (p[1] + q[1]) / 2;
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.quadraticCurveTo(p[0], p[1], mx, my);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(0, 0, base * 0.2, 0, 0, base + reach);
      g.addColorStop(0, hsl({ ...c, l: c.l * 0.4 }, 0));
      g.addColorStop(0.6, hsl(c, 0.12 + m.glow * 0.18));
      g.addColorStop(1, hsl({ ...c, l: Math.min(90, c.l + 15) }, 0.35 + m.glow * 0.25));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1 + m.size * 1.5;
      ctx.strokeStyle = hsl({ ...c, l: Math.min(92, c.l + 20) }, 0.5 + m.glow * 0.4);
      ctx.stroke();
    }

    // The heart: beats make it throb.
    const core = colorNow(fr, 0.5);
    const cr = r * (0.05 + f.beat * 0.06 + f.bass * 0.03 * m.size);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cr * 3);
    g.addColorStop(0, hsl({ ...core, l: 92 }, 0.9));
    g.addColorStop(0.3, hsl(core, 0.5));
    g.addColorStop(1, hsl(core, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, cr * 3, 0, Math.PI * 2);
    ctx.fill();

    // Pollen: high frequencies throw sparks off the tips.
    const sparks = Math.floor(f.treble * m.glow * 40);
    ctx.fillStyle = hsl({ ...colorNow(fr, 0.25), l: 85 }, 0.8);
    for (let i = 0; i < sparks; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * (0.45 + Math.random() * 0.5) * (0.8 + m.size * 0.3);
      const s = 1 + Math.random() * 2;
      ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, s, s);
    }
  }
}
