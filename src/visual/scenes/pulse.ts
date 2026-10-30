import { NOTE_NAMES } from '../../audio/features';
import { fifthsPosition, hsl, soundColor, type Hsl } from '../color';
import { colorNow, type Frame, type Scene } from '../scene';

interface Ring {
  r: number;
  c: Hsl;
  width: number;
  life: number;
}

/**
 * Every beat launches a ring; twelve note-lights orbit the center, one per
 * pitch class, placed where their color sits on the wheel.
 */
export class Pulse implements Scene {
  id = 'pulse';
  name = 'Pulse';
  private rings: Ring[] = [];
  private phase = 0;

  draw(fr: Frame) {
    const { ctx, f, m, r, dt } = fr;
    this.phase += dt * (m.spin * 0.6);
    ctx.globalCompositeOperation = 'lighter';

    if (f.onset) {
      this.rings.push({ r: r * 0.08, c: colorNow(fr), width: 2 + f.bass * 14 * (0.4 + m.size), life: 1 });
      if (this.rings.length > 40) this.rings.shift();
    }
    const grow = r * (0.35 + m.speed * 1.1) * dt;
    for (const ring of this.rings) {
      ring.r += grow * (0.6 + ring.life);
      ring.life -= dt * 0.45;
      if (ring.life <= 0) continue;
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = hsl(ring.c, ring.life * (0.5 + m.glow * 0.4));
      ctx.lineWidth = ring.width * (0.5 + ring.life);
      ctx.stroke();
    }
    this.rings = this.rings.filter((x) => x.life > 0);

    // The chord star: lines from the heart to every sounding note.
    const orbit = r * 0.58 * (0.85 + m.size * 0.15);
    const pos = (i: number): [number, number] => {
      const a = fifthsPosition(i) * Math.PI * 2 - Math.PI / 2 + this.phase;
      return [Math.cos(a) * orbit, Math.sin(a) * orbit];
    };
    for (let i = 0; i < 12; i++) {
      const v = f.chroma[i] * f.level;
      if (v < 0.25) continue;
      const [x, y] = pos(i);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x, y);
      ctx.strokeStyle = hsl(soundColor(fr.palette, i, 1, f.level), v * 0.5);
      ctx.lineWidth = 1 + v * 3;
      ctx.stroke();
    }

    // Twelve note-lights.
    ctx.font = `600 ${Math.max(10, r * 0.035)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const v = f.chroma[i] * Math.min(1, f.level * 1.5);
      const [x, y] = pos(i);
      const c = soundColor(fr.palette, i, 1, f.level);
      const size = r * (0.018 + v * 0.07 * (0.5 + m.size));
      const g = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      g.addColorStop(0, hsl({ ...c, l: 90 }, 0.4 + v * 0.6));
      g.addColorStop(0.35, hsl(c, 0.2 + v * 0.5));
      g.addColorStop(1, hsl(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, size * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.15 + v * 0.6})`;
      ctx.fillText(NOTE_NAMES[i], x * 1.18, y * 1.18);
    }

    // The heart, in the color of the strongest note.
    const c = colorNow(fr);
    const cr = r * (0.07 + f.beat * 0.07 * (0.5 + m.size) + f.bass * 0.03);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cr * 2);
    g.addColorStop(0, hsl({ ...c, l: 90 }, 0.95));
    g.addColorStop(0.5, hsl(c, 0.6));
    g.addColorStop(1, hsl(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, cr * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
