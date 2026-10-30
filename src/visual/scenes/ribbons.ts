import { hsl } from '../color';
import { colorNow, type Frame, type Scene } from '../scene';

const RIBBONS = 5;
const SEGMENTS = 120;

/** The waveform as silk ribbons drifting across the screen. */
export class Ribbons implements Scene {
  id = 'ribbons';
  name = 'Ribbons';
  private phase = 0;
  private tilt = 0;

  draw(fr: Frame) {
    const { ctx, f, m, r, w, dt } = fr;
    this.phase += dt * (0.4 + m.speed * 2.5);
    this.tilt += dt * (m.spin - 0.15) * 0.25;
    const wave = f.waveform;
    const span = Math.hypot(w, fr.h) * 0.6;
    ctx.save();
    ctx.rotate(Math.sin(this.tilt) * 0.5);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let j = 0; j < RIBBONS; j++) {
      const lane = j - (RIBBONS - 1) / 2;
      const y0 = lane * r * 0.22 * (0.7 + m.size * 0.3);
      const amp = r * (0.18 + m.size * 0.35) * (0.6 + 0.4 * Math.cos(lane));
      const c = colorNow(fr, j * 0.09);
      const grad = ctx.createLinearGradient(-span, 0, span, 0);
      grad.addColorStop(0, hsl(c, 0));
      grad.addColorStop(0.25, hsl(colorNow(fr, j * 0.09 - 0.08), 0.9));
      grad.addColorStop(0.5, hsl({ ...c, l: Math.min(90, c.l + 15) }, 1));
      grad.addColorStop(0.75, hsl(colorNow(fr, j * 0.09 + 0.08), 0.9));
      grad.addColorStop(1, hsl(c, 0));

      ctx.beginPath();
      const offset = (j * 97) % (wave.length - SEGMENTS * 4);
      for (let i = 0; i <= SEGMENTS; i++) {
        const u = i / SEGMENTS;
        const x = -span + u * span * 2;
        const env = Math.sin(u * Math.PI);
        const sample = wave[offset + i * 4] ?? 0;
        const swell = Math.sin(u * 6 + this.phase + j * 1.3) * r * 0.06 * (0.3 + f.mid * 2);
        const y = y0 + (sample * amp * 1.6 + swell) * env + f.beat * Math.sin(u * 20 + j) * r * 0.02 * m.shake;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const width = 1.5 + m.size * 3 + f.bass * 4;
      ctx.strokeStyle = grad;
      ctx.globalAlpha = 0.18 + m.glow * 0.15;
      ctx.lineWidth = width * 5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    ctx.restore();
  }
}
