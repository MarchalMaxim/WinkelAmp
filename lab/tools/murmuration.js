// Murmuration v2: a flock that carries the mood. Dread: a dark huddled knot that throbs on the tolls.
// Song: a ribbon that traces the melody's contour. Agitation: jittery shards. Climax chords: it explodes
// into streaks and re-forms into a different figure each time.
(() => {
  const N = 900, HM = 16, MS = 96, SPAN = 7;
  const px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  const heat = new Float32Array(N), bin = new Uint8Array(N), wrap = new Int32Array(N);
  const U0 = new Float32Array(N), S0 = new Float32Array(N), R0 = new Float32Array(N), A0 = new Float32Array(N), D0 = new Float32Array(N);
  const hx = new Float32Array(N * HM), hy = new Float32Array(N * HM);
  const mel = new Float32Array(MS), mvel = new Float32Array(MS), tmp = new Float32Array(MS);
  const K = 9, gcx = new Float32Array(K), gcy = new Float32Array(K), ggx = new Float32Array(K), ggy = new Float32Array(K), gth = new Float32Array(K);
  let hp = 0, time = 0, A = 0, bassS = 0, low = 0, agit = 0, dread = 0, pulse = 0, notes = [], nChord = 0, phase = 0, lastT = -99;
  let formHold = 0, holdDur = 2, sinceBurst = 9, lastBurst = -9, shape = 0, prevShape = -1, fcx = 640, fcy = 360, frot = 0, fsc = 220;
  let headX = 1100, headY = 360, ccx = 640, ccy = 360;
  const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const NSHAPES = 10;
  let ox = 0, oy = 0;
  // The figures it re-forms into: bold, abstract, one per climax chord. u runs along the figure, s across it.
  function fig(k, u, s) {
    const T = Math.PI * 2, w = s * 0.035;
    switch (k) {
      case 0: { const a = u * T; ox = Math.cos(a) * (1 + w); oy = Math.sin(a) * (1 + w); return; } // ring
      case 1: { const b = u < 0.5, f = (u % 0.5) * 4 - 1; ox = b ? f * 1.15 : w * 3; oy = b ? w * 3 : f * 1.15; return; } // cross
      case 2: { const r = 0.08 + 0.95 * u, a = u * T * 2.6; ox = Math.cos(a) * r + w; oy = Math.sin(a) * r + w; return; } // spiral
      case 3: { const a = u * T, d = 1 + Math.sin(a) ** 2; ox = 1.25 * Math.cos(a) / d + w; oy = 1.25 * Math.sin(a) * Math.cos(a) / d + w; return; } // lemniscate
      case 4: { const e = Math.floor(u * 3), f = u * 3 - e, a0 = -Math.PI / 2 + e * T / 3, a1 = a0 + T / 3; ox = Math.cos(a0) + (Math.cos(a1) - Math.cos(a0)) * f + w; oy = Math.sin(a0) + (Math.sin(a1) - Math.sin(a0)) * f + w; return; } // triangle
      case 5: { const r = u < 0.6 ? 1 : 0.45, a = (u < 0.6 ? u / 0.6 : (u - 0.6) / 0.4) * T; ox = Math.cos(a) * (r + w); oy = Math.sin(a) * (r + w); return; } // two rings
      case 6: { const e = Math.floor(u * 10), f = u * 10 - e, r0 = e % 2 ? 0.42 : 1.1, r1 = e % 2 ? 1.1 : 0.42, a0 = -Math.PI / 2 + e * T / 10, a1 = a0 + T / 10; ox = Math.cos(a0) * r0 + (Math.cos(a1) * r1 - Math.cos(a0) * r0) * f + w; oy = Math.sin(a0) * r0 + (Math.sin(a1) * r1 - Math.sin(a0) * r0) * f + w; return; } // star
      case 7: { const e = Math.floor(u * 3), f = u * 3 - e; ox = (f * 2 - 1) * (1.3 - e * 0.25); oy = (e - 1) * 0.55 + w * 2; return; } // three slashes
      case 8: { ox = Math.sin(u * T * 2) * 0.18 + w * 2; oy = (u * 2 - 1) * 1.25; return; } // a spine
      default: { const e = Math.floor(u * 4), f = u * 4 - e, c = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]; ox = c[e][0] + (c[e + 1][0] - c[e][0]) * f + w; oy = c[e][1] + (c[e + 1][1] - c[e][1]) * f + w; } // square
    }
  }
  // A shard snaps to a new spot near the (slowly wandering) heart of the broken flock.
  function kickShard(x, gi, sp) {
    const ax = x.W * 0.5 + Math.sin(time * 0.23) * x.W * 0.16, ay = x.H * 0.5 + Math.sin(time * 0.31 + 1) * x.H * 0.1;
    ggx[gi] = Math.max(60, Math.min(x.W - 60, ax + x.rnd(-1, 1) * 300 * sp)); ggy[gi] = Math.max(60, Math.min(x.H - 60, ay + x.rnd(-1, 1) * 170 * sp)); gth[gi] += x.rnd(-1.6, 1.6);
  }

  TOOLS.push({
    id: 'murmuration', name: 'Murmuration', tag: 'v2',
    blurb: 'A flock that carries the mood. In dread it huddles low, dark and slow, and throbs on each toll; in song it becomes a ribbon tracing the melody; in agitation it breaks into jittery shards; a climax chord blows it into streaks that re-form into a new figure each time. Loud notes bleed red into it.',
    params: [
      { key: 'coh', label: 'cohesion', min: 0, max: 1, value: 0.6 },
      { key: 'panic', label: 'panic', min: 0, max: 2, value: 1, drive: '+rate' },
      { key: 'trail', label: 'trail', min: 1, max: 16, step: 1, value: 9, drive: '-rate' },
      { key: 'form', label: 'line·dot·tick·cross', min: 0, max: 3, step: 1, value: 0 },
      { key: 'colour', label: 'cold → warm', min: 0, max: 1, value: 0.3 },
      { key: 'bleed', label: 'red bleed', min: 0, max: 1, value: 0.6, drive: '+level' },
      { key: 'melody', label: 'follow melody', min: 0, max: 1.5, value: 1 },
      { key: 'spread', label: 'spread', min: 0.3, max: 2, value: 1 },
      { key: 'shards', label: 'shards', min: 1, max: 9, step: 1, value: 5 },
      { key: 'burst', label: 'burst at vel', min: 80, max: 125, step: 1, value: 100 },
    ],
    reset(x) {
      time = x.t; A = 0; bassS = 0; low = 0; phase = 0; agit = 0; dread = 1; lastT = -99; pulse = 0; notes = []; nChord = 0;
      formHold = 0; sinceBurst = 9; lastBurst = -9; hp = 0;
      for (let i = 0; i < N; i++) {
        U0[i] = (i + Math.random() * 0.6) / N; S0[i] = (Math.random() * 2 - 1) * Math.sqrt(Math.random()); R0[i] = Math.random(); A0[i] = Math.random(); D0[i] = Math.random();
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 90;
        px[i] = 640 + Math.cos(a) * r * 1.4; py[i] = 440 + Math.sin(a) * r * 0.7; vx[i] = 0; vy[i] = 0; heat[i] = 0; wrap[i] = 0;
        for (let h = 0; h < HM; h++) { hx[i * HM + h] = px[i]; hy[i * HM + h] = py[i]; }
      }
      for (let k = 0; k < K; k++) { kickShard(x, k, 1); gcx[k] = ggx[k]; gcy[k] = ggy[k]; gth[k] = x.rnd(0, 6.3); }
    },
    onChord(ch, x) {
      nChord++; lastT = x.t;
      A += 0.58;
      notes.push({ t: x.t, m: ch.hi, v: ch.vel });
      if (notes.length > 400) notes.splice(0, 200);
      if (ch.hi < 62 && ch.vel > 70) low = 1;
      const w = Math.max(0, Math.min(1, (ch.vel - 45) / 60)), n = ch.notes.length;
      const panic = x.p('panic'), bleed = x.p('bleed');
      let mean = 0; for (const q of ch.notes) mean += q.m; mean /= n;
      // A huge chord: everything explodes into streaks, then re-forms into a different figure.
      const score = ch.vel + 3 * (n - 3);
      if (score >= x.p('burst') && n >= 2 && ch.hi >= 60 && x.t - lastBurst > 0.9) {
        lastBurst = x.t; sinceBurst = 0;
        let s = shape; while (s === shape || s === prevShape) s = (Math.random() * NSHAPES) | 0; prevShape = shape; shape = s;
        const coh = x.p('coh'), sp = x.p('spread');
        holdDur = 1.3 + 2.2 * coh; formHold = 1;
        frot = x.rnd(-0.8, 0.8); fsc = (125 + 60 * w + Math.min(8, n) * 5) * sp;
        const mx = Math.max(0, x.W * 0.5 - fsc * 1.25 - 30), my = Math.max(0, x.H * 0.5 - fsc * 1.2 - 20);
        fcx = x.W * 0.5 + x.rnd(-1, 1) * Math.min(mx, x.W * 0.2); fcy = x.H * 0.5 + x.rnd(-1, 1) * Math.min(my, x.H * 0.1);
        const pow = (5 + w * 9) * (0.6 + 0.4 * panic);
        for (let i = 0; i < N; i++) {
          let dx = px[i] - ccx, dy = py[i] - ccy; const d = Math.hypot(dx, dy) + 1; dx /= d; dy /= d;
          const f = pow * (0.5 + R0[i] * 0.9), tw = (A0[i] - 0.5) * 0.9;
          vx[i] = (dx - dy * tw) * f; vy[i] = (dy + dx * tw) * f;
          heat[i] = Math.min(1.4, heat[i] + bleed * (0.4 + w * 0.9) * (0.5 + R0[i] * 0.7));
        }
        return;
      }
      // Otherwise a startle where the note lands: the head of the melody ribbon in song, else a bird picked by pitch.
      const j = Math.max(0, Math.min(N - 1, ((mean - 28) / 70 * N) | 0));
      const sing = Math.max(0, 1 - agit - dread) * (1 - Math.min(1, formHold * 1.6));
      const lx = px[j] + (headX - px[j]) * sing, ly = py[j] + (headY - py[j]) * sing;
      const R = (70 + w * 240) * (0.6 + 0.4 * panic), P = (0.3 + w * w * 5) * panic * (1 - 0.65 * dread) * (1 - 0.4 * agit);
      for (let i = 0; i < N; i++) {
        const dx = px[i] - lx, dy = py[i] - ly, d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const d = Math.sqrt(d2) + 1, f = 1 - d / R;
        vx[i] += (dx / d) * P * f; vy[i] += (dy / d) * P * f;
        heat[i] = Math.min(1.6, heat[i] + bleed * w * f * 1.3);
      }
      // Dread: the knot throbs and darkens to blood.
      if (ch.hi < 60 || dread > 0.4) { pulse = Math.max(pulse, w); for (let i = 0; i < N; i++) heat[i] = Math.min(1.6, heat[i] + bleed * w * 0.5 * dread); }
      // Agitation: a shard jumps somewhere else.
      kickShard(x, nChord % Math.max(1, Math.round(x.p('shards'))), x.p('spread'));
    },
    frame(x) {
      const g = x.g, dt = x.dt, k = dt * 60, W = x.W, H = x.H;
      time += dt; sinceBurst += dt;
      const coh = x.p('coh'), panic = x.p('panic'), spread = x.p('spread'), melo = x.p('melody'), KS = Math.max(1, Math.round(x.p('shards')));
      // Mood from the music: attack rate → agitation; held bass with few attacks → dread.
      A *= Math.pow(0.5, dt / 1.2);
      bassS += (x.feat.bass - bassS) * (1 - Math.pow(0.5, dt / 1.5));
      const sm = 1 - Math.pow(0.5, dt / 0.6);
      low *= Math.pow(0.5, dt / 3);
      // A held breath (no attack for a couple of seconds) also sinks it back into the knot.
      const agT = ss(2.6, 6.5, A), drT = Math.max(ss(0.4, 0.8, bassS), low, ss(1.5, 3, x.t - lastT)) * (1 - agT) * (1 - ss(2, 3.5, A));
      agit += (agT - agit) * sm; dread += (drT - dread) * sm;
      pulse *= Math.pow(0.5, dt / 0.35);
      formHold = Math.max(0, formHold - dt / holdDur);
      const wf = Math.min(1, formHold * 1.7), rest = 1 - wf;
      // Sharpen the moods so the flock commits to one character instead of hovering in a grey average.
      let ra = agit * agit, rd = ((1 - agit) * dread) ** 2, rs = ((1 - agit) * (1 - dread)) ** 2; const rn = ra + rd + rs + 1e-6;
      const wa = rest * ra / rn, wd = rest * rd / rn, ws = rest * rs / rn;

      // The melody over the last SPAN seconds, sampled right (now) to left (past) and smoothed.
      let lo = 128, hi = 0, ni = notes.length - 1;
      for (let s = 0; s < MS; s++) {
        const tt = x.t - (s / (MS - 1)) * SPAN;
        while (ni > 0 && notes[ni].t > tt) ni--;
        const nt = notes.length ? notes[Math.max(0, ni)] : null, m = nt ? nt.m : 64;
        mel[s] = m; if (m < lo) lo = m; if (m > hi) hi = m;
        // How loud the melody was then, fading as that note is held: the ribbon swells where it sang out.
        mvel[s] = nt ? (nt.v / 127) * Math.pow(0.5, Math.max(0, tt - nt.t) / 0.8) : 0;
      }
      for (let pass = 0; pass < 3; pass++) {
        for (let s = 0; s < MS; s++) tmp[s] = (mel[Math.max(0, s - 1)] + mel[s] + mel[Math.min(MS - 1, s + 1)]) / 3; mel.set(tmp);
        for (let s = 0; s < MS; s++) tmp[s] = (mvel[Math.max(0, s - 1)] + mvel[s] + mvel[Math.min(MS - 1, s + 1)]) / 3; mvel.set(tmp);
      }
      const mid = (lo + hi) / 2, rng = Math.max(10, hi - lo);
      const rx0 = W * 0.1, rx1 = W * 0.9, base = H * 0.5 + Math.sin(time * 0.21) * 40, amp = H * 0.3 * melo;
      const thick = (5 + 28 * (1 - coh)) * spread, swell = (20 + 70 * (1 - coh)) * spread;
      headX = rx1; headY = base - ((mel[0] - mid) / rng) * 2 * amp + Math.sin(-time * 0.9) * 22 * spread;

      // Dread knot and agitation shards.
      const dcx = W * 0.5 + Math.sin(time * 0.11) * 110, dcy = H * 0.62, Rd = (30 + 40 * spread) * (1 + 1.1 * pulse);
      const gk = 1 - Math.pow(0.7, k);
      for (let q = 0; q < KS; q++) { gcx[q] += (ggx[q] - gcx[q]) * gk; gcy[q] += (ggy[q] - gcy[q]) * gk; }
      const L = (45 + 70 * spread) * (KS <= 2 ? 1.8 : 1);
      const cf = Math.cos(frot + time * 0.05), sf = Math.sin(frot + time * 0.05);

      const ks = (0.004 + 0.03 * coh) * (1 + 0.6 * wd) * (1 + 2 * wa) * (1 + 1.2 * wf);
      const dN = Math.pow(0.86 - 0.16 * wd - 0.1 * wa, k), dB = Math.pow(0.9, k);
      const turb = (0.03 + 0.1 * panic * (0.4 + wa)) * k, jit = wa * panic * 1.4 * k;
      phase += ws * dt / SPAN;
      let sx = 0, sy = 0; const hd = Math.pow(0.5, dt / 0.55);
      hp = (hp + 1) % HM;
      for (let i = 0; i < N; i++) {
        let tx = 0, ty = 0, born = false;
        const uf = U0[i] + phase, u = uf % 1, s = S0[i];
        if (wd > 0.002) {
          const a = A0[i] * 6.283 + time * (0.1 + 0.3 * (1 - R0[i])), r = Math.sqrt(R0[i]) * Rd;
          tx += wd * (dcx + Math.cos(a) * r * 1.25); ty += wd * (dcy + Math.sin(a) * r * 0.8);
        }
        if (ws > 0.002) {
          const f = u * (MS - 1), i0 = f | 0, i1 = Math.min(MS - 1, i0 + 1), fr = f - i0, m = mel[i0] + (mel[i1] - mel[i0]) * fr, mv = mvel[i0] + (mvel[i1] - mvel[i0]) * fr;
          const X = rx1 - u * (rx1 - rx0);
          const Y = base - ((m - mid) / rng) * 2 * amp + Math.sin(u * 7 - time * 0.9) * 22 * spread
            + s * (thick + swell * mv * mv) * (0.3 + 0.7 * (1 - u)) * (0.12 + 0.88 * Math.abs(Math.cos(u * 6.5 - time * 1.1)));
          tx += ws * X; ty += ws * Y;
          // A bird that drifts off the past end is reborn at the present note (no line across the screen).
          if ((uf | 0) !== wrap[i]) { wrap[i] = uf | 0; born = ws > 0.4; }
        }
        if (wa > 0.002) {
          const q = i % KS, ul = ((i / KS) | 0) / (N / KS), c = Math.cos(gth[q]), sn = Math.sin(gth[q]);
          const a = (ul * 2 - 1) * L, b = s * 5;
          tx += wa * (gcx[q] + a * c - b * sn); ty += wa * (gcy[q] + a * sn + b * c);
        }
        if (wf > 0.002) {
          fig(shape, U0[i], s);
          tx += wf * (fcx + (ox * cf - oy * sf) * fsc); ty += wf * (fcy + (ox * sf + oy * cf) * fsc);
        }
        if (born) { px[i] = tx; py[i] = ty; vx[i] = -1; vy[i] = 0; for (let h = 0; h < HM; h++) { hx[i * HM + h] = tx; hy[i * HM + h] = ty; } }
        // After a burst each bird flies free for a moment before the figure pulls it back in (staggered).
        const ramp = Math.max(0, Math.min(1, (sinceBurst - 0.06 - D0[i] * 0.3) / 0.3));
        const damp = dB + (dN - dB) * ramp, kk = ks * ramp * ramp * k;
        let ax = (tx - px[i]) * kk, ay = (ty - py[i]) * kk;
        ax += Math.sin(py[i] * 0.011 + time * 0.9 + (i & 7)) * turb; ay += Math.cos(px[i] * 0.009 - time * 0.8) * turb;
        if (jit > 0.01) { ax += (Math.random() * 2 - 1) * jit; ay += (Math.random() * 2 - 1) * jit; }
        const m = 40;
        if (px[i] < m) ax += (m - px[i]) * 0.02 * k; else if (px[i] > W - m) ax -= (px[i] - W + m) * 0.02 * k;
        if (py[i] < m) ay += (m - py[i]) * 0.02 * k; else if (py[i] > H - m) ay -= (py[i] - H + m) * 0.02 * k;
        vx[i] = vx[i] * damp + ax; vy[i] = vy[i] * damp + ay;
        px[i] += vx[i] * k; py[i] += vy[i] * k;
        hx[i * HM + hp] = px[i]; hy[i * HM + hp] = py[i];
        sx += px[i]; sy += py[i];
        heat[i] *= hd;
        bin[i] = Math.min(3, (heat[i] * 3.2) | 0);
      }
      ccx = sx / N; ccy = sy / N;

      // Colour: cold bone to warm amber; dread sinks it to dark blood; heat bleeds it red, then hot.
      const ct = x.p('colour'), bl = x.p('bleed');
      const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      let col = mix([160, 176, 204], [232, 196, 140], ct);
      col = mix(col, [150, 14, 20], wd * 0.95);
      col = mix(col, [205, 210, 220], wa * 0.25);
      // Heat cools from a white flash through blood to deep maroon and back to the flock's own colour.
      const cols = [col, mix(col, [120, 10, 18], 0.8 * bl), mix(col, [205, 28, 34], bl), mix(col, [255, 236, 222], bl)];
      const css = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
      const form = Math.round(x.p('form')), T = Math.max(1, Math.min(HM - 1, Math.round(x.p('trail'))));
      const alpha = 0.9 - 0.15 * wd, cap = 40 + 16 * T;
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (form === 0 || T > 2) {
        for (let b = 0; b < 4; b++) {
          g.beginPath();
          for (let i = 0; i < N; i++) {
            if (bin[i] !== b) continue;
            const o = i * HM; let h = hp, lx = hx[o + h], ly = hy[o + h], len = 0; g.moveTo(lx, ly);
            for (let j = 0; j < T && len < cap; j++) { h = (h + HM - 1) % HM; const nx = hx[o + h], ny = hy[o + h]; len += Math.abs(nx - lx) + Math.abs(ny - ly); g.lineTo(nx, ny); lx = nx; ly = ny; }
          }
          g.strokeStyle = css(cols[b], form === 0 ? alpha : alpha * 0.28);
          g.lineWidth = form === 0 ? 1.3 + 0.5 * b + 1.6 * wd : 1;
          g.stroke();
        }
      }
      if (form > 0) {
        for (let b = 0; b < 4; b++) {
          g.beginPath();
          const r = 1.2 + 0.7 * b + 1.2 * wd, l = 4 + 1.6 * b;
          for (let i = 0; i < N; i++) {
            if (bin[i] !== b) continue;
            const X = px[i], Y = py[i];
            if (form === 1) { g.rect(X - r, Y - r, r * 2, r * 2); continue; }
            const sp = Math.hypot(vx[i], vy[i]) + 1e-6, nx = vx[i] / sp, ny = vy[i] / sp;
            if (form === 2) { g.moveTo(X - ny * l, Y + nx * l); g.lineTo(X + ny * l, Y - nx * l); }
            else { const ax = (nx - ny) * 0.7 * l, ay = (ny + nx) * 0.7 * l; g.moveTo(X - ax, Y - ay); g.lineTo(X + ax, Y + ay); g.moveTo(X + ay, Y - ax); g.lineTo(X - ay, Y + ax); }
          }
          if (form === 1) { g.fillStyle = css(cols[b], alpha); g.fill(); }
          else { g.strokeStyle = css(cols[b], alpha); g.lineWidth = 1.3 + 0.3 * b; g.stroke(); }
        }
      }
    },
  });
})();
