/**
 * Sparks: small crisp particles for quick high notes and transients. Onsets throw a
 * small burst; high-register sound events (height > 0.55) throw bigger ones where
 * they sound (sustained high notes trickle). They live and move on music time,
 * swirled by the gesture, so silence holds them in place.
 *
 *   stars   twinkling points (star-shaped when the material is angular)
 *   dust    many tiny slow motes
 *   embers  warm streaks that rise
 */
import { clamp01, elementColor, fin, mix, mixRgb, regionRect, scale, Shape, sizeK, styleOf, vivid } from '../gl';
import { type CastMember, STYLES, type StageElement, type StageFrame, type StageShared } from '../types';

const MAX = 1500;

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  c: [number, number, number];
  seed: number;
}

export class Sparks implements StageElement {
  readonly type = 'sparks' as const;
  private shared!: StageShared;
  private ps: P[] = [];

  init(_gl: WebGL2RenderingContext, shared: StageShared) {
    this.shared = shared;
  }

  private spawn(n: number, x: number, y: number, spread: number, speed: number, style: string, color: [number, number, number], fr: StageFrame) {
    const r = this.shared.rand;
    const m = fr.material;
    for (let i = 0; i < n && this.ps.length < MAX; i++) {
      const a = r() * Math.PI * 2;
      const v = speed * (0.3 + 0.7 * r());
      const embers = style === 'embers';
      const dust = style === 'dust';
      this.ps.push({
        x: x + (Math.cos(a) * spread * r()) / this.shared.aspect,
        y: y + Math.sin(a) * spread * r(),
        vx: Math.cos(a) * v * (dust ? 0.25 : 1),
        vy: Math.sin(a) * v * (dust ? 0.25 : 1) + (embers ? speed * 0.6 : 0),
        age: 0,
        life: (dust ? 3 + 3 * r() : embers ? 1.4 + 1.6 * r() : 0.9 + 1.6 * r()) * mix(0.6, 1.5, clamp01(fin(m.sparkLife))),
        size: 0.6 + 0.8 * r(),
        c: color,
        seed: r(),
      });
    }
  }

  draw(fr: StageFrame, member: CastMember) {
    const s = this.shared;
    const prm = member.spec.params;
    const style = styleOf(prm.style, STYLES.sparks);
    const [x0, y0, x1, y1] = regionRect(prm.region);
    const w = x1 - x0;
    const h = y1 - y0;
    const amount = prm.intensity * s.react * (style === 'dust' ? 2.2 : 1);
    const r = s.rand;
    const pick = (note: number) => {
      const c = vivid(elementColor(prm.color, s, 0.7 + 0.3 * r(), note), 0.5);
      return style === 'embers' ? mixRgb(c, [1, 0.42, 0.08], 0.45) : c;
    };
    const speed = (style === 'embers' ? 0.12 : 0.22) * sizeK(prm.size);

    // Spawning (presence gates it: a fading element stops throwing new sparks). Only while the
    // music moves: with the clock frozen a spark would never age, so a cough would hang in the air.
    if (member.presence > 0.05 && fr.musicDt > 0) {
      for (const e of fr.events) {
        if (!(e.height > 0.55)) continue;
        const ex = x0 + w * clamp01(0.5 + fin(e.pan) * 0.42);
        const ey = y0 + h * (0.15 + 0.8 * clamp01((e.height - 0.4) / 0.6));
        const st = clamp01(fin(e.strength));
        if (e.onset) this.spawn(Math.round((4 + 22 * st) * amount), ex, ey, 0.03, speed * (0.6 + st), style, pick(e.note), fr);
        else if (r() < st * fr.musicDt * 10 * amount) this.spawn(1, ex, ey, 0.02, speed * 0.4, style, pick(e.note), fr);
      }
      if (fr.f.onset) {
        const st = clamp01(fin(fr.f.onsetStrength));
        const n = Math.round((2 + 8 * st) * amount);
        for (let i = 0; i < n; i++) this.spawn(1, x0 + w * (0.1 + 0.8 * r()), y0 + h * (0.2 + 0.7 * r()), 0.01, speed * 0.5, style, pick(fr.f.note), fr);
      }
    }

    // Motion, on music time: drift, drag, the gesture's swirl around the region's centre; embers rise.
    const dm = fr.musicDt;
    if (dm > 0) {
      const swirl = fin(fr.gesture.swirl) * (style === 'dust' ? 0.35 : 1.4);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const drag = Math.exp(-dm * (style === 'dust' ? 0.4 : 1.6));
      const lift = style === 'embers' ? 0.18 : style === 'dust' ? 0.01 : -0.02;
      for (const p of this.ps) {
        const dx = (p.x - cx) * s.aspect;
        const dy = p.y - cy;
        p.vx = (p.vx - dy * swirl * dm) * drag;
        p.vy = (p.vy + dx * swirl * dm + lift * dm) * drag;
        if (style === 'dust') {
          p.vx += Math.sin(fr.clock.time * 0.7 + p.seed * 40) * 0.02 * dm;
          p.vy += Math.cos(fr.clock.time * 0.6 + p.seed * 31) * 0.02 * dm;
        }
        p.x += (p.vx * dm) / s.aspect;
        p.y += p.vy * dm;
        p.age += dm;
      }
      this.ps = this.ps.filter((p) => p.age < p.life);
    }

    const gain = member.presence * prm.intensity;
    if (gain < 0.002 || !this.ps.length) return;
    const m = fr.material;
    const base = mix(0.004, 0.018, clamp01(fin(m.sparkSize))) * sizeK(prm.size) * (style === 'dust' ? 0.45 : 1);
    const star = clamp01(fin(m.angularity)) > 0.5 && style !== 'dust';
    const t = fr.clock.time;
    for (const p of this.ps) {
      const life = p.age / p.life;
      const env = Math.min(1, p.age / 0.04 + 0.2) * Math.pow(1 - life, 1.6);
      const twinkle = style === 'stars' ? 0.55 + 0.45 * Math.sin(p.seed * 60 + t * (9 + 7 * p.seed)) : 1;
      const bright = gain * env * twinkle * (style === 'dust' ? 0.7 : 2.2);
      const rad = base * p.size * (style === 'stars' && star ? 2.2 : 1);
      if (style === 'embers') {
        const v = Math.hypot(p.vx, p.vy);
        const rot = Math.atan2(p.vy, p.vx);
        s.sprites.add(p.x, p.y, rad * (1 + v * 18), rad * 0.7, rot, scale(p.c, bright), Shape.Glow, 0.4);
      } else if (star) {
        s.sprites.add(p.x, p.y, rad, rad, p.seed * Math.PI, scale(p.c, bright), Shape.Star, p.seed > 0.5 ? 6 : 4);
      } else {
        s.sprites.add(p.x, p.y, rad, rad, 0, scale(p.c, bright), Shape.Glow, style === 'dust' ? 0.2 : 0.7);
      }
    }
    s.sprites.flush();
  }

  dispose() {
    this.ps = [];
  }
}
