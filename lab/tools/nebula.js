// Nebula: abstract gravity. Every sounding note is an invisible attractor: its pitch class sets where it sits on a circle
// (C at the top, going round like a clock), its register nudges it inward (low) or outward (high), its velocity sets how
// hard it pulls. Thousands of fine grains orbit and stream between the attractors; their short streaks plus the page's
// fade become luminous filaments. A chord reshapes the field and throws the grains outward; when notes release, the pull
// fades and the grains drift apart. Each grain takes the colour of the register that pulls it hardest.
(() => {
  const MAXN = 7000, PCS = 12;
  const px = new Float32Array(MAXN), py = new Float32Array(MAXN), vx = new Float32Array(MAXN), vy = new Float32Array(MAXN);
  const pc = new Float32Array(MAXN);                     // colour 0..1 (low register → high register)
  // Attractors, one per pitch class: current strength, target, register (0..1, eased), chord pulse.
  const S = new Float32Array(PCS), TG = new Float32Array(PCS), REG = new Float32Array(PCS).fill(0.5);
  const AX = new Float32Array(PCS), AY = new Float32Array(PCS), AS = new Float32Array(PCS), AC = new Float32Array(PCS);
  // Register colours, low → high: crimson, ember, amber, bone, teal, ice violet.
  const PAL = ['200,40,72', '232,92,52', '242,170,72', '228,216,190', '90,198,212', '150,150,255'];
  const NB = PAL.length;
  let W = 1280, H = 720, cx = 640, cy = 360, R0 = 280, spin = 0, flash = 0, time = 0;
  const R = Math.random;

  function seed(i) {
    const a = R() * Math.PI * 2, r = R0 * Math.sqrt(R()) * 1.15;
    px[i] = cx + Math.cos(a) * r * 1.35; py[i] = cy + Math.sin(a) * r;
    vx[i] = (R() - 0.5) * 20; vy[i] = (R() - 0.5) * 20;
  }
  const where = (k) => {                                  // attractor k's position now
    const a = -Math.PI / 2 + (k * Math.PI * 2) / PCS + spin, r = R0 * (0.42 + 0.75 * REG[k]);
    return [cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r];
  };

  TOOLS.push({
    id: 'nebula', name: 'Nebula', tag: 'new',
    blurb: 'Every note is an invisible pull, placed round a circle by its note name. Fine glowing grains orbit and stream between the notes; chords throw them outward, releases let them drift apart. Colour follows the register: deep notes red, high notes blue.',
    params: [
      { key: 'pull', label: 'how hard notes pull', min: 0.2, max: 2, value: 0.8, drive: '+density',
        hint: 'How strongly the notes gather the grains. Left: a loose haze that barely bends. Right: tight, bright knots and threads.',
        icon: (g, v, w, h) => { const r = ICON.rng(4), k = 0.15 + v * 0.8;
          for (let i = 0; i < 22; i++) { const x0 = 3 + r() * (w - 6), y0 = 3 + r() * (h - 6), a = r() * 6.28, d = r() * 4;
            ICON.dot(g, x0 + (w / 2 + Math.cos(a) * d * 1.6 - x0) * k, y0 + (h / 2 + Math.sin(a) * d - y0) * k, 0.9, ICON.gold); } } },
      { key: 'swirl', label: 'fall in or circle round', min: 0, max: 1.6, value: 0.5,
        hint: 'How the grains move around a note. Left: they fall straight in and stream from note to note. Right: they whirl round it in rings.',
        icon: (g, v, w, h) => {   // four grains: straight arrows into the note (left) bend into arrows circling it (right)
          for (let j = 0; j < 4; j++) { const a0 = (j * Math.PI) / 2 + 0.4, bend = v * 1.2, P = [];
            for (let s = 0; s <= 1.0001; s += 0.1) { const r = 11 - (1 - v * 0.75) * 7 * s, a = a0 + s * bend; P.push([w / 2 + Math.cos(a) * r * 1.5, h / 2 + Math.sin(a) * r]); }
            g.strokeStyle = ICON.blue; g.lineWidth = 1.2; g.beginPath(); P.forEach(([X, Y], i) => (i ? g.lineTo(X, Y) : g.moveTo(X, Y))); g.stroke();
            const [x1, y1] = P[P.length - 2], [x2, y2] = P[P.length - 1]; ICON.arrow(g, x1, y1, x2, y2, ICON.blue, 1.2); }
          ICON.dot(g, w / 2, h / 2, 1.6, ICON.ink); } },
      { key: 'amount', label: 'how much dust', min: 1000, max: 7000, step: 100, value: 4000,
        hint: 'How many grains there are. Left: a sparse sprinkle. Right: a thick, milky cloud.',
        icon: (g, v, w, h) => ICON.dots(g, 5 + v * 70, w, h, { r: 0.75, col: ICON.ink, pad: 2, seed: 9 }) },
      { key: 'threads', label: 'grains or threads', min: 0.5, max: 6, value: 1.2,
        hint: 'How long each grain draws its path. Left: fine points of dust. Right: long silky threads.',
        icon: (g, v, w, h) => { const r = ICON.rng(2);
          for (let i = 0; i < 6; i++) { const x = 6 + r() * (w - 12), y = 4 + r() * (h - 8), L = 0.6 + v * 13, a = 0.3 + r() * 0.4;
            ICON.line(g, x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2, x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2, ICON.violet, 1.3); } } },
      { key: 'burst', label: 'chords throw the dust', min: 0, max: 2, value: 0.6, drive: '+level',
        hint: 'How hard each chord flings the grains away from its notes. Left: chords only reshape the pull. Right: every chord bursts outward.',
        icon: (g, v, w, h) => { ICON.dot(g, w / 2, h / 2, 2, ICON.red);
          if (v > 0.04) for (let j = 0; j < 6; j++) { const a = (j * Math.PI) / 3 + 0.3, r0 = 4, r1 = 4 + v * 9;
            ICON.arrow(g, w / 2 + Math.cos(a) * r0 * 1.4, h / 2 + Math.sin(a) * r0, w / 2 + Math.cos(a) * r1 * 1.4, h / 2 + Math.sin(a) * r1, ICON.red, 1.1); } } },
    ],
    reset(x) {
      W = x.W; H = x.H; cx = W / 2; cy = H / 2; R0 = H * 0.38; flash = 0;
      S.fill(0); TG.fill(0); REG.fill(0.5);
      for (let i = 0; i < MAXN; i++) { seed(i); pc[i] = 0.35 + R() * 0.3; }
    },
    onChord(ch, x) {
      flash = Math.max(flash, ch.vel / 127);
      const burst = x.p('burst'); if (burst <= 0.01) return;
      const n = Math.round(x.p('amount')), seen = new Set();
      for (const note of ch.notes) {
        const k = note.m % 12; if (seen.has(k)) continue; seen.add(k);
        // Place the attractor where it will be (its register moves it in or out).
        REG[k] = S[k] < 0.05 ? x.pitch01(note.m) : REG[k];
        // Fast passages fire many chords: each one throws less, so the cloud keeps its threads instead of turning to fur.
        const [ax, ay] = where(k), kick = burst * 260 * (note.v / 127) / (1 + 2.5 * x.feat.rate), reach = 230, reach2 = reach * reach;
        for (let i = 0; i < n; i++) {
          const dx = px[i] - ax, dy = py[i] - ay, d2 = dx * dx + dy * dy; if (d2 > reach2) continue;
          // A ring-shaped shove, strongest half-way out, mostly sideways: the dust swirls open instead of exploding.
          const d = Math.sqrt(d2) + 1, q = d / reach, f = kick * 4 * q * (1 - q) / d;
          vx[i] += dx * f * 0.6 - dy * f * 0.8; vy[i] += dy * f * 0.6 + dx * f * 0.8;
        }
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt; if (dt <= 0) return;
      time += dt; spin += dt * 0.03;
      // 1. The field: fold the sounding notes into 12 pitch-class attractors.
      TG.fill(0); const regW = new Float32Array(PCS), regS = new Float32Array(PCS);
      for (const n of x.sounding()) {
        const k = n.m % 12, age = x.t - n.start, w = Math.sqrt(n.v / 127) * (0.5 + 0.5 * Math.exp(-age / 1.5));
        TG[k] += w; regS[k] += w * x.pitch01(n.m); regW[k] += w;
      }
      let na = 0, total = 0;
      for (let k = 0; k < PCS; k++) {
        const tg = Math.min(1.8, TG[k]);
        S[k] += (tg - S[k]) * (1 - Math.exp(-dt / (tg > S[k] ? 0.04 : 0.8)));   // fast attack, slow release
        if (regW[k] > 0) REG[k] += (regS[k] / regW[k] - REG[k]) * (1 - Math.exp(-dt / 0.15));
        // Colour: piano music lives in the middle of the keyboard, so the register is stretched before it picks a colour.
        if (S[k] > 0.01) { const [ax, ay] = where(k); AX[na] = ax; AY[na] = ay; AS[na] = S[k]; AC[na] = Math.max(0, Math.min(0.999, (REG[k] - 0.18) / 0.55)); na++; total += S[k]; }
      }
      // 2. Move the grains.
      const n = Math.round(x.p('amount')), G = 42000 * x.p('pull') / Math.pow(Math.max(1, total), 0.35), sw = x.p('swirl');
      const EPS2 = 55 * 55, EPS4 = 4 * EPS2, drag = Math.exp(-dt * 0.95), vmax = 520, calm = Math.max(0, 1 - total), kc = 1 - Math.exp(-dt / 0.5);
      const quiet = na ? 0.35 : 1, drift = (22 + 30 * calm) * quiet, jit = (3 + 40 * calm) * quiet * Math.sqrt(dt);   // any note at all calms the drift
      const L = x.p('threads') * dt, rx = R0 * 1.75, ry = R0 * 1.35;
      const paths = [], fast = []; for (let b = 0; b < NB; b++) { paths.push(new Path2D()); fast.push(new Path2D()); }
      for (let i = 0; i < n; i++) {
        let X = px[i], Y = py[i], ax = 0, ay = 0, best = 0, bc = -1;
        for (let a = 0; a < na; a++) {
          // The swirl fades out near the note, so grains fall through its centre instead of circling an empty hole.
          const dx = AX[a] - X, dy = AY[a] - Y, d2 = dx * dx + dy * dy, f = (G * AS[a]) / (d2 + EPS2), t = sw * d2 / (d2 + EPS4);
          ax += dx * f - dy * f * t; ay += dy * f + dx * f * t;
          if (f > best) { best = f; bc = AC[a]; }
        }
        // A slow, shapeless drift (felt mostly in silence) and a soft wall that keeps the cloud on the screen.
        ax += Math.sin(Y * 0.007 + time * 0.31) * drift; ay += Math.cos(X * 0.006 - time * 0.27) * drift;
        const ox = (X - cx) / rx, oy = (Y - cy) / ry, o = ox * ox + oy * oy;
        if (o > 1) { ax -= (X - cx) * (o - 1) * 0.8; ay -= (Y - cy) * (o - 1) * 0.8; }
        let VX = (vx[i] + ax * dt) * drag + (R() - 0.5) * jit, VY = (vy[i] + ay * dt) * drag + (R() - 0.5) * jit;
        const sp = VX * VX + VY * VY; if (sp > vmax * vmax) { const k = vmax / Math.sqrt(sp); VX *= k; VY *= k; }
        X += VX * dt; Y += VY * dt;
        if (X < -40 || X > W + 40 || Y < -40 || Y > H + 40) { seed(i); continue; }
        px[i] = X; py[i] = Y; vx[i] = VX; vy[i] = VY;
        if (bc >= 0) pc[i] += (bc - pc[i]) * kc;
        const b = Math.min(NB - 1, (pc[i] * NB) | 0), p = VX * VX + VY * VY > 100 * 100 ? fast[b] : paths[b];   // moving grains glow brighter
        p.moveTo(X - VX * L, Y - VY * L); p.lineTo(X + 0.01, Y);
      }
      // 3. Draw: one stroke per register colour, added light so dense streams glow.
      flash *= Math.exp(-dt / 0.3);
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      const a = Math.min(0.9, (0.24 + 0.3 * flash) * Math.sqrt(4000 / Math.max(1000, n)));
      for (let b = 0; b < NB; b++) {
        g.lineWidth = 1.4; g.strokeStyle = `rgba(${PAL[b]},${(a * 0.8).toFixed(3)})`; g.stroke(paths[b]);   // slow grains: soft dust
        g.lineWidth = 0.9; g.strokeStyle = `rgba(${PAL[b]},${Math.min(1, a * 1.5).toFixed(3)})`; g.stroke(fast[b]);   // streaming grains: bright threads
      }
    },
  });
})();
