// Op art (after Bridget Riley): a stripe / checker / ring field the music warps.
// Bass bulges it into lenses, melody notes send ripples through it, chord attacks kink it into chevrons,
// loudness makes the whole field vibrate so the eye fizzes. Every edge is a warped polyline; one even-odd fill.
// A sixth knob, how present: moving it writes the widget's other knobs.
(() => {
  const PAL = [ // [dark, light]
    [[0, 0, 0], [238, 232, 220]],      // 0 black / bone
    [[4, 1, 2], [196, 18, 26]],        // 1 black / blood red
    [[52, 4, 8], [240, 228, 206]],     // 2 oxblood / bone
    [[8, 12, 34], [226, 166, 60]],     // 3 ink blue / ochre
    [[0, 0, 0], [150, 214, 224]],      // 4 black / cold cyan
    [[10, 38, 42], [214, 70, 44]],     // 5 teal / vermilion (vibrating complementaries)
  ];
  // v2 folds orientation (vertical), lens size (follows the bass), wave length (follows the top note), chord kink
  // and brightness (follows loudness) into fixed choices; 5 knobs with new keys so the new defaults apply.
  const ANGLE = 90, KINK = 1.2;
  // Loudness relative to this recording (its 93rd-percentile note velocity), so both songs reach the big chords.
  let VQ = 0;
  const loud = (v) => {
    if (!VQ) { const v2 = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b); VQ = v2.length ? Math.max(70, v2[Math.floor(v2.length * 0.93)]) : 100; }
    return v * 100 / VQ;
  };
  let bright = 0.5;
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  let act = [], lenses = [], ripples = [], kinks = [], cuts = [], time = 0, drift = 0, bassHold = 0;
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
    for (let i = 0; i < act.length; i++) {
      const r = act[i], dx = px - r.x, dy = py - r.y, q = dx * dx + dy * dy;
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
    const n = Math.ceil((u1 - u0) / 9), st = (u1 - u0) / n, ph = ((phase % (2 * w)) + 2 * w) % (2 * w);
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
    id: 'riley', name: 'Op art', tag: 'v2',
    blurb: 'A Bridget Riley stripe field the music bends. Bass notes swell it into lenses, the melody sends ripples through it (higher notes, tighter ripples), chords kink it into sharp chevrons and the biggest ones cut an inverted band through it. It brightens as the music gets louder. It fills the whole picture, so widgets drawn before it are hidden. <b>how present</b> sets how much field there is: turned down, a few broad, clean bands that only loud playing still bends.',
    params: [
      { key: 'pattern', label: 'pattern', min: 0, max: 2, step: 1, value: 0,
        hint: 'What the field is made of. Left: stripes. Middle: a checkerboard. Right: rings around the centre.',
        icon: (g, v, w, h) => {
          const k = Math.round(v * 2);
          if (k === 0) for (let x = 3; x < w - 3; x += 6) ICON.rect(g, x, 3, 3, h - 6);
          else if (k === 1) for (let y = 3, j = 0; y < h - 3; y += 5, j++) for (let x = 3, i = 0; x < w - 3; x += 5, i++) { if ((i + j) % 2) ICON.rect(g, x, y, 5, 5); }
          else for (let r = 2.5; r < 13; r += 3.2) ICON.ring(g, w / 2, h / 2, r, ICON.ink, 1.5);
        } },
      { key: 'stripe', label: 'stripe width', min: 5, max: 60, step: 1, value: 16, less: 36,
        hint: 'How wide each stripe is. Left: fine, dizzying lines. Right: a few broad bands.',
        icon: (g, v, w, h) => { const bw = 1.4 + v * 6.6; for (let x = 3; x < w - 3; x += 2 * bw) ICON.rect(g, x, 3, Math.min(bw, w - 3 - x), h - 6); } },
      { key: 'bend', label: 'how much the music bends it', min: 0, max: 2.5, value: 1, less: 0, drive: '+level',
        hint: 'How hard the notes bend the field: lenses on the bass, ripples on the melody, sharp kinks on chords. Left: almost flat. Right: wild, swelling distortion.',
        icon: (g, v, w, h) => {
          g.strokeStyle = ICON.ink; g.lineWidth = 2;
          for (let i = 0; i < 6; i++) { const x0 = 5 + i * 6; g.beginPath();
            for (let y = 2; y <= h - 2; y += 1) { const b = Math.exp(-((y - h / 2) ** 2) / 40) * (x0 - w / 2) * 0.35; const x = x0 + v * (Math.sin(y * 0.42 + i * 0.3) * 2.2 + b); y === 2 ? g.moveTo(x, y) : g.lineTo(x, y); }
            g.stroke(); }
        } },
      { key: 'shimmer', label: 'shimmer', min: 0, max: 2, value: 0.3, less: 0, drive: '+rate',
        hint: 'A fine, fast trembling of every edge, so the eye fizzes. Left: still, clean edges. Right: the whole field buzzes.',
        icon: (g, v, w, h) => {
          const r = ICON.rng(3); g.strokeStyle = ICON.ink; g.lineWidth = 1.8;
          for (let i = 0; i < 6; i++) { const x0 = 5 + i * 6; g.beginPath();
            for (let y = 2; y <= h - 2; y += 2) { const x = x0 + (r() - 0.5) * 2 * v * 2.4; y === 2 ? g.moveTo(x, y) : g.lineTo(x, y); }
            g.stroke(); }
        } },
      { key: 'colours', label: 'colours', min: 0, max: 5, step: 1, value: 0,
        hint: 'The pair of colours. From left: black and bone, black and blood red, oxblood and bone, ink blue and ochre, black and cold cyan, teal and vermilion.',
        icon: (g, v, w, h) => {
          const p = PAL[Math.round(v * 5)] || PAL[0];
          ICON.rect(g, 2, 2, w - 4, h - 4, hex(p[0]));
          for (let x = 4; x < w - 4; x += 8) ICON.rect(g, x, 2, 4, h - 4, hex(p[1]));
          g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(1.5, 1.5, w - 3, h - 3);
        } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much stripe field there is: how many stripes, how hard the notes bend them, how much their edges tremble. Left: a few broad, clean bands that only loud playing still bends. Right: the full fine field, bending and fizzing. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { bright = 0.5; act = []; lenses = []; ripples = []; kinks = []; cuts = []; time = 0; drift = 0; bassHold = 0; },
    onChord(ch, x) {
      const vel = loud(ch.vel);
      // Bass: a lens swells where the low note lands (low = left, higher bass = right).
      let bass = 0, bm = 127; for (const n of ch.notes) if (n.m < 50) { bass += n.v / 127; bm = Math.min(bm, n.m); }
      if (bass > 0) {
        const lx = x.W * (0.2 + 0.6 * Math.max(0, Math.min(1, (bm - 24) / 26))) + x.rnd(-80, 80);
        lenses.push({ x: lx, y: x.H * x.rnd(0.35, 0.65), a: 0, peak: Math.min(2.6, 0.9 + bass * 1.0) * (vel / 100), age: 0 });
        if (lenses.length > 4) lenses.shift();
      }
      // Melody: the top note sends a ripple out from its place (pitch across the screen).
      if (ch.hi >= 55) {
        const top = ch.notes.find((n) => n.m === ch.hi), p = x.pitch01(ch.hi);
        ripples.push({ x: x.W * (0.1 + 0.8 * p), y: x.H * (0.85 - 0.7 * p) + x.rnd(-60, 60), front: 0, age: 0,
          a0: (0.35 + 0.65 * top.v / 110), a: 0, life: 1.4 + Math.min(2.5, top.d), k: 0, lam: 0 });
        if (ripples.length > 8) ripples.shift();
      }
      // Chords: sharp chevron kinks across the stripes, more and deeper for bigger chords.
      // (an orchestra's tutti often reaches the transcriber as loud two-note chords: those kink too)
      if (ch.notes.length >= 3 || vel >= 100 || (ch.notes.length === 2 && vel >= 88)) {
        const cnt = ch.notes.length >= 6 ? 3 : ch.notes.length >= 4 ? 2 : 1;
        for (let i = 0; i < cnt; i++) {
          kinks.push({ u: x.rnd(-0.45, 0.45) * x.W, hw: x.rnd(50, 150), a0: (Math.random() < 0.5 ? 1 : -1) * (0.6 + 0.12 * ch.notes.length) * vel / 100, a: 0, age: 0 });
        }
        while (kinks.length > 8) kinks.shift();
        // the biggest chords also cut an inverted band straight through the field, along the first kink
        if (vel >= 92 && ch.notes.length >= 4) {
          const k = kinks[kinks.length - cnt];
          cuts.push({ u: k.u, rot: x.rnd(-0.45, 0.45), w0: (30 + 14 * ch.notes.length) * KINK * vel / 110, age: 0 });
          if (cuts.length > 3) cuts.shift();
        }
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt; time += dt;
      const w = x.p('stripe'), th = (ANGLE * Math.PI) / 180, form = Math.round(x.p('pattern'));
      depth = x.p('bend');
      tx = Math.cos(th); ty = Math.sin(th); nx = -ty; ny = tx;
      lensR2 = Math.pow((0.22 + 0.32 * x.feat.bass) * x.H * 0.75, 2);   // more bass, wider lenses
      // lenses: snap open (~70 ms), then slowly let go
      // soft-capped near 2x so the loudest chords swell the field without blowing it up into flat facets
      for (const L of lenses) { L.age += dt; L.a = 1.7 * Math.tanh(depth * L.peak * (1 - Math.exp(-L.age / 0.07)) * Math.exp(-L.age / 2.0) / 1.7); }
      lenses = lenses.filter((L) => L.age < 6);
      // a sustained low drone keeps a soft standing lens in the middle
      bassHold += (x.feat.bass - bassHold) * (1 - Math.exp(-dt / 0.6));
      // melody ripples
      const wave = Math.max(0.6, 2 + 2.85 * (x.feat.pitch - 0.5)), lam = 260 / wave;   // higher notes, tighter ripples
      for (const r of ripples) {
        r.age += dt; r.front += dt * (240 + 120 / wave);
        r.lam = lam; r.k = (2 * Math.PI) / lam;
        const ri = Math.max(0, r.front - lam * 2.2), ro = r.front + lam * 2.2; r.in2 = ri * ri; r.out2 = ro * ro;
        // keep the slope under ~1 so stripes bend instead of folding over themselves (more at high warp depth)
        r.a = Math.min(depth * w * 1.6, (0.9 / r.k) * Math.max(1, depth)) * r.a0 * Math.min(1, r.age / 0.08) * Math.max(0, 1 - r.age / r.life);
      }
      ripples = ripples.filter((r) => r.age < r.life);
      act = ripples.filter((r) => Math.abs(r.a) > 0.4);   // the warp only walks ripples that still move a pixel
      // kinks: instant, overshoot once, settle
      const kk = KINK;
      for (const k of kinks) { k.age += dt; k.a = depth * kk * w * 3 * k.a0 * Math.exp(-k.age / 0.45) * Math.cos(k.age * 9); }
      kinks = kinks.filter((k) => k.age < 2.2);
      // the standing wave along the stripes follows how much is sounding
      waveK = (2 * Math.PI) / (lam * 2.2); wavePh += dt * 1.3; waveA = depth * w * (0.25 + 1.2 * x.feat.density);
      // fizz: a fine, fast, random-phase wobble scaled by loudness
      const vib = x.p('shimmer');
      vibA = vib * w * 0.45 * (0.3 + x.feat.level); vibK = (2 * Math.PI) / (w * x.rnd(5, 9)); vibPh = x.rnd(0, Math.PI * 2);
      drift += dt * w * (0.25 + 1.5 * x.feat.rate) * (1 + vib * 0.5);
      // the drone lens lives in the lens list only for this frame
      const drone = { x: x.W / 2, y: x.H / 2, a: depth * 0.7 * bassHold };
      lenses.push(drone);

      // brightness breathes with loudness: quiet passages dim the light colour, loud ones bring it to full
      bright += (0.5 + 0.5 * Math.min(1, x.feat.level * 1.1) - bright) * (1 - Math.exp(-dt / 0.3));
      const pal = PAL[Math.round(x.p('colours'))] || PAL[0], br = bright;
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
