// Op art (after Bridget Riley): a stripe / checker / ring field the music warps.
// Bass bulges it into lenses, melody notes send ripples through it, chord attacks kink it into chevrons,
// loudness makes the whole field vibrate so the eye fizzes. Every edge is a warped polyline; one even-odd fill.
(() => {
  const PAL = [ // [dark, light]
    [[0, 0, 0], [238, 232, 220]],      // 0 black / bone
    [[4, 1, 2], [196, 18, 26]],        // 1 black / blood red
    [[52, 4, 8], [240, 228, 206]],     // 2 oxblood / bone
    [[8, 12, 34], [226, 166, 60]],     // 3 ink blue / ochre
    [[0, 0, 0], [150, 214, 224]],      // 4 black / cold cyan
    [[10, 38, 42], [214, 70, 44]],     // 5 teal / vermilion (vibrating complementaries)
  ];
  let lenses = [], ripples = [], kinks = [], cuts = [], time = 0, drift = 0, bassHold = 0;
  // warp parameters for this frame (set in frame, read in warp)
  let tx = 1, ty = 0, nx = 0, ny = 1, depth = 1, waveK = 0, waveA = 0, wavePh = 0, vibA = 0, vibPh = 0, vibK = 0, lensR2 = 1;
  let wx = 0, wy = 0;
  // Displacement across the stripes that depends only on the along-stripe coordinate u: wave, fizz, kinks.
  function dU(u) {
    let d = waveA * Math.sin(u * waveK - wavePh) + vibA * Math.sin(u * vibK + vibPh);
    for (let i = 0; i < kinks.length; i++) {
      const k = kinks[i], s = Math.abs(u - k.u);
      if (s < k.hw) d += k.a * (1 - s / k.hw);
    }
    return d;
  }
  // Full warp of a point, given its u-only displacement d: ripples (2D), then the lenses.
  function warp(px, py, d) {
    for (let i = 0; i < ripples.length; i++) {
      const r = ripples[i], dx = px - r.x, dy = py - r.y, q = dx * dx + dy * dy;
      if (q < r.in2 || q > r.out2) continue;
      const s = Math.sqrt(q) - r.front, e = s / r.lam; d += r.a * Math.sin(s * r.k) * Math.exp(-e * e);
    }
    px += nx * d; py += ny * d;
    for (let i = 0; i < lenses.length; i++) {
      const L = lenses[i], dx = px - L.x, dy = py - L.y, q = dx * dx + dy * dy;
      if (q > lensR2 * 7 || L.a < 0.003) continue;
      const f = 1 + L.a * Math.exp(-q / lensR2);
      px = L.x + dx * f; py = L.y + dy * f;
    }
    wx = px; wy = py;
  }
  // dU sampled once per frame into a table over the whole u range, so every form reads it cheaply.
  const LUT_N = 1024; const LUT = new Float32Array(LUT_N + 2); let lutU0 = 0, lutS = 1;
  function buildLut(uc, half) {
    lutU0 = uc - half; lutS = (2 * half) / LUT_N;
    for (let i = 0; i <= LUT_N + 1; i++) LUT[i] = dU(lutU0 + i * lutS);
  }
  function du(u) {
    let f = (u - lutU0) / lutS; if (f < 0) f = 0; else if (f > LUT_N) f = LUT_N;
    const i = f | 0, t = f - i; return LUT[i] + (LUT[i + 1] - LUT[i]) * t;
  }
  let DU = new Float32Array(512);
  // Alternate bands of a stripe set at angle th as closed polygons (added to the current path).
  // own = the set whose along-axis is the warp's u axis (its u-displacements are shared by every line).
  function stripes(g, x, th, w, phase, own, m) {
    const ax = Math.cos(th), ay = Math.sin(th), bx = -ay, by = ax;
    const U = Math.abs(x.W * ax) + Math.abs(x.H * ay), V = Math.abs(x.W * bx) + Math.abs(x.H * by);
    const u0 = -U / 2 - m, u1 = U / 2 + m, cx = x.W / 2, cy = x.H / 2;
    const n = Math.ceil((u1 - u0) / 8), st = (u1 - u0) / n, ph = ((phase % (2 * w)) + 2 * w) % (2 * w);
    const uc = cx * tx + cy * ty;
    if (DU.length < n + 1) DU = new Float32Array(n + 1);
    if (own) for (let j = 0; j <= n; j++) DU[j] = dU(uc + u0 + j * st);
    for (let v = -V / 2 - m - 2 * w + ph; v < V / 2 + m; v += 2 * w) {
      for (let j = 0; j <= n; j++) {
        const u = u0 + j * st, px = cx + ax * u + bx * v, py = cy + ay * u + by * v;
        warp(px, py, own ? DU[j] : du(px * tx + py * ty));
        if (j === 0) g.moveTo(wx, wy); else g.lineTo(wx, wy);
      }
      const v2 = v + w;
      for (let j = n; j >= 0; j--) {
        const u = u0 + j * st, px = cx + ax * u + bx * v2, py = cy + ay * u + by * v2;
        warp(px, py, own ? DU[j] : du(px * tx + py * ty));
        g.lineTo(wx, wy);
      }
      g.closePath();
    }
  }
  function rings(g, x, w, phase, m) {
    const cx = x.W / 2, cy = x.H / 2, R = Math.hypot(x.W, x.H) / 2 + m, ph = ((phase % (2 * w)) + 2 * w) % (2 * w);
    for (let r = ph; r < R; r += w) {
      if (r < 2) continue;
      const n = Math.max(24, Math.ceil(2 * Math.PI * r / 13));
      for (let j = 0; j <= n; j++) {
        const a = (j / n) * Math.PI * 2, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        warp(px, py, du(px * tx + py * ty));
        if (j === 0) g.moveTo(wx, wy); else g.lineTo(wx, wy);
      }
      g.closePath();
    }
  }
  TOOLS.push({
    id: 'riley', name: 'Op art', tag: 'new',
    blurb: 'A Bridget Riley stripe field the music bends. Bass notes bulge it into lenses, the melody sends ripples through it, chords kink it into sharp chevrons (the biggest ones also cut an inverted band through it), and loud passages make it vibrate until the eye fizzes.',
    params: [
      { key: 'form', label: 'form (stripes/checker/rings)', min: 0, max: 2, step: 1, value: 0 },
      { key: 'width', label: 'stripe width', min: 5, max: 60, step: 1, value: 16 },
      { key: 'angle', label: 'orientation (deg)', min: -90, max: 90, step: 1, value: 90 },
      { key: 'warp', label: 'warp depth', min: 0, max: 2.5, value: 1 },
      { key: 'lens', label: 'lens size', min: 0.1, max: 0.9, value: 0.3, drive: '+bass' },
      { key: 'wave', label: 'wave frequency', min: 0.3, max: 6, value: 2, drive: '+pitch' },
      { key: 'kink', label: 'chord kink', min: 0, max: 3, value: 1.2 },
      { key: 'vib', label: 'vibration', min: 0, max: 2, value: 0.15, drive: '+level' },
      { key: 'pal', label: 'colour pair', min: 0, max: 5, step: 1, value: 0 },
      { key: 'light', label: 'brightness', min: 0.1, max: 1, value: 0.4, drive: '+level' },
    ],
    reset() { lenses = []; ripples = []; kinks = []; cuts = []; time = 0; drift = 0; bassHold = 0; },
    onChord(ch, x) {
      const depthK = x.p('warp');
      // Bass: a lens swells where the low note lands (low = left, higher bass = right).
      let bass = 0, bm = 127; for (const n of ch.notes) if (n.m < 50) { bass += n.v / 127; bm = Math.min(bm, n.m); }
      if (bass > 0) {
        const lx = x.W * (0.2 + 0.6 * Math.max(0, Math.min(1, (bm - 24) / 26))) + x.rnd(-80, 80);
        lenses.push({ x: lx, y: x.H * x.rnd(0.35, 0.65), a: 0, peak: Math.min(2.6, 0.9 + bass * 1.0) * (ch.vel / 100), age: 0 });
        if (lenses.length > 4) lenses.shift();
      }
      // Melody: the top note sends a ripple out from its place (pitch across the screen).
      if (ch.hi >= 55) {
        const top = ch.notes.find((n) => n.m === ch.hi), p = x.pitch01(ch.hi);
        ripples.push({ x: x.W * (0.1 + 0.8 * p), y: x.H * (0.85 - 0.7 * p) + x.rnd(-60, 60), front: 0, age: 0,
          a0: (0.35 + 0.65 * top.v / 110), a: 0, life: 1.4 + Math.min(2.5, top.d), k: 0, lam: 0 });
        if (ripples.length > 10) ripples.shift();
      }
      // Chords: sharp chevron kinks across the stripes, more and deeper for bigger chords.
      if (ch.notes.length >= 3 || ch.vel >= 100) {
        const cnt = ch.notes.length >= 6 ? 3 : ch.notes.length >= 4 ? 2 : 1;
        for (let i = 0; i < cnt; i++) {
          kinks.push({ u: x.rnd(-0.45, 0.45) * x.W, hw: x.rnd(50, 150), a0: (Math.random() < 0.5 ? 1 : -1) * (0.6 + 0.12 * ch.notes.length) * ch.vel / 100, a: 0, age: 0 });
        }
        while (kinks.length > 8) kinks.shift();
        // the biggest chords also cut an inverted band straight through the field, along the first kink
        if (ch.vel >= 92 && ch.notes.length >= 4 && x.p('kink') > 0.05) {
          const k = kinks[kinks.length - cnt];
          cuts.push({ u: k.u, rot: x.rnd(-0.45, 0.45), w0: (30 + 14 * ch.notes.length) * x.p('kink') * ch.vel / 110, age: 0 });
          if (cuts.length > 3) cuts.shift();
        }
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt; time += dt;
      const w = x.p('width'), th = (x.p('angle') * Math.PI) / 180, form = Math.round(x.p('form'));
      depth = x.p('warp');
      tx = Math.cos(th); ty = Math.sin(th); nx = -ty; ny = tx;
      lensR2 = Math.pow(x.p('lens') * x.H * 0.75, 2);
      // lenses: snap open (~70 ms), then slowly let go
      for (const L of lenses) { L.age += dt; L.a = depth * L.peak * (1 - Math.exp(-L.age / 0.07)) * Math.exp(-L.age / 2.0); }
      lenses = lenses.filter((L) => L.age < 6);
      // a sustained low drone keeps a soft standing lens in the middle
      bassHold += (x.feat.bass - bassHold) * (1 - Math.exp(-dt / 0.6));
      // melody ripples
      const lam = 260 / x.p('wave');
      for (const r of ripples) {
        r.age += dt; r.front += dt * (240 + 120 / x.p('wave'));
        r.lam = lam; r.k = (2 * Math.PI) / lam;
        const ri = Math.max(0, r.front - lam * 2.2), ro = r.front + lam * 2.2; r.in2 = ri * ri; r.out2 = ro * ro;
        // keep the slope under ~1 so stripes bend instead of folding over themselves (more at high warp depth)
        r.a = Math.min(depth * w * 1.6, (0.9 / r.k) * Math.max(1, depth)) * r.a0 * Math.min(1, r.age / 0.08) * Math.max(0, 1 - r.age / r.life);
      }
      ripples = ripples.filter((r) => r.age < r.life);
      // kinks: instant, overshoot once, settle
      const kk = x.p('kink');
      for (const k of kinks) { k.age += dt; k.a = depth * kk * w * 3 * k.a0 * Math.exp(-k.age / 0.45) * Math.cos(k.age * 9); }
      kinks = kinks.filter((k) => k.age < 2.2);
      // the standing wave along the stripes follows how much is sounding
      waveK = (2 * Math.PI) / (lam * 2.2); wavePh += dt * 1.3; waveA = depth * w * (0.25 + 1.2 * x.feat.density);
      // fizz: a fine, fast, random-phase wobble scaled by loudness
      const vib = x.p('vib');
      vibA = vib * w * 0.45 * (0.3 + x.feat.level); vibK = (2 * Math.PI) / (w * x.rnd(5, 9)); vibPh = x.rnd(0, Math.PI * 2);
      drift += dt * w * (0.25 + 1.5 * x.feat.rate) * (1 + vib * 0.5);
      // the drone lens lives in the lens list only for this frame
      const drone = { x: x.W / 2, y: x.H / 2, a: depth * 0.7 * bassHold };
      lenses.push(drone);

      const pal = PAL[Math.round(x.p('pal'))] || PAL[0], br = x.p('light');
      const [d0, d1, d2] = pal[0], L = pal[1];
      const lc = `rgb(${Math.round(d0 + (L[0] - d0) * br)},${Math.round(d1 + (L[1] - d1) * br)},${Math.round(d2 + (L[2] - d2) * br)})`;
      g.fillStyle = `rgb(${d0},${d1},${d2})`; g.fillRect(0, 0, x.W, x.H);
      // off-screen margin: just enough that nothing pushed on screen comes from outside the drawn field
      let m = 30 + Math.abs(waveA) + Math.abs(vibA) + w * 2;
      for (const k of kinks) m += Math.abs(k.a) * 0.5; for (const r of ripples) m = Math.max(m, 30 + Math.abs(r.a) * 2 + w * 2);
      m = Math.min(260, m);
      buildLut(x.W / 2 * tx + x.H / 2 * ty, Math.hypot(x.W, x.H) / 2 + m + 40);
      g.beginPath();
      if (form === 2) rings(g, x, w, drift, m);
      else {
        stripes(g, x, th, w, drift, true, m);
        if (form === 1) stripes(g, x, th + Math.PI / 2, w, drift * 0.5, false, m);
      }
      // inverted cuts: a closed band added to the even-odd path flips light and dark inside it
      for (const c of cuts) {
        c.age += dt; const cw = c.w0 * Math.pow(Math.max(0, 1 - c.age / 0.7), 1.5); if (cw < 0.5) continue;
        const a = th + Math.PI / 2 + c.rot, dx = Math.cos(a), dy = Math.sin(a), ox = x.W / 2 + tx * c.u, oy = x.H / 2 + ty * c.u;
        const px = -dy * cw / 2, py = dx * cw / 2;
        g.moveTo(ox - dx * 2000 + px, oy - dy * 2000 + py); g.lineTo(ox + dx * 2000 + px, oy + dy * 2000 + py);
        g.lineTo(ox + dx * 2000 - px, oy + dy * 2000 - py); g.lineTo(ox - dx * 2000 - px, oy - dy * 2000 - py); g.closePath();
      }
      cuts = cuts.filter((c) => c.age < 0.7);
      g.fillStyle = lc; g.fill('evenodd');
      lenses.pop();
      // a soft vignette keeps the edges dark
      const vg = g.createRadialGradient(x.W / 2, x.H / 2, x.H * 0.35, x.W / 2, x.H / 2, x.W * 0.62);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.75)');
      g.fillStyle = vg; g.fillRect(0, 0, x.W, x.H);
    },
  });
})();
