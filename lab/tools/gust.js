// Brass gust: the Futurists' lines of force. Every attack shoots a bundle of long tapered slivers out of a mouth off the
// left or lower edge; the bundle is one wedge while it is fresh and shreds lengthwise as its slivers part and blow on.
// The air is what makes it gusty: dashes ride a coarse velocity field that the wedges write into, so you see the force
// arrive, pass and curl away. Strength is ranked against this piece's own attacks, so a piano gusts as a brass band does.
(() => {
  const GW = 32, GH = 18, MAX_WEDGES = 46, MAX_SLIVERS = 620;
  // Heat, cold to white-hot: ember red through brass. A sliver is painted in one bucket, so a frame is a few fills.
  const HEAT = [[92, 28, 0], [136, 40, 0], [200, 58, 4], [232, 92, 8], [255, 136, 16], [255, 168, 30], [255, 200, 76], [255, 244, 190]]
    .map(([r, g, b], i) => `rgba(${r},${g},${b},${[0.3, 0.34, 0.38, 0.4, 0.4, 0.44, 0.52, 0.8][i]})`);
  // The air's dashes by speed: dull and nearly invisible at rest, hot when a blast has them.
  const AIR = [['rgba(120,76,44,0.20)', 1], ['rgba(170,108,44,0.36)', 1.1], ['rgba(226,146,34,0.56)', 1.35], ['rgba(250,180,40,0.7)', 1.7], ['rgba(255,206,70,0.8)', 2.2]];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  let wedges = [], fronts = [], dashes = [], vx = null, vy = null, ux = null, uy = null;
  let time = 0, sinceFull = 9, shoveX = 0, shoveY = 0, shoveVX = 0, shoveVY = 0, bloom = 0;
  let attackVels = null, velsOf = null;

  // Every attack's loudness in this piece, sorted (the same 40 ms grouping as the lab's chords).
  function ranks() {
    const notes = window.NOTES || [];
    if (velsOf === notes && attackVels) return attackVels;
    const out = []; let t = -9, v = 0;
    for (const n of notes) { if (n[0] - t < 0.04) v = Math.max(v, n[3]); else { if (t >= 0) out.push(v); t = n[0]; v = n[3]; } }
    if (t >= 0) out.push(v);
    velsOf = notes; attackVels = out.sort((a, b) => a - b);
    return attackVels;
  }
  // 0 = the quietest attack of this piece, 1 = its loudest; equal velocities share their middle rank.
  function percentile(v) {
    const r = ranks(); if (!r.length) return clamp(v / 127, 0, 1);
    let a = 0, b = r.length; while (a < b) { const k = (a + b) >> 1; if (r[k] < v) a = k + 1; else b = k; }
    let c = a, d = r.length; while (c < d) { const k = (c + d) >> 1; if (r[k] <= v) c = k + 1; else d = k; }
    return (a + c) / 2 / r.length;
  }

  function gridReady() {
    if (vx) return;
    const n = GW * GH; vx = new Float32Array(n); vy = new Float32Array(n); ux = new Float32Array(n); uy = new Float32Array(n);
  }
  function clearAll() {
    wedges = []; fronts = []; sinceFull = 9; shoveX = shoveY = shoveVX = shoveVY = 0; bloom = 0;
    gridReady(); vx.fill(0); vy.fill(0);
    for (const d of dashes) { d.vx = 0; d.vy = 0; }
  }
  function airReady(x, want) {
    while (dashes.length < want) dashes.push({ x: x.rnd(0, x.W), y: x.rnd(0, x.H), vx: 0, vy: 0, h: x.rnd(-3.2, 3.2), ph: x.rnd(0, 6.28), curl: x.rnd(1.4, 4) * (Math.random() < 0.5 ? -1 : 1), sz: x.rnd(0.7, 1.4) });
  }
  // The wall: the air inside the swept stretch of a wedge lies down along it and is shoved out to its sides.
  function push(w, s0, s1, half, V, x) {
    const cw = x.W / GW, ch = x.H / GH, step = Math.min(cw, ch) * 0.8;
    for (let s = s0; s <= s1; s += step) {
      const widen = half * (0.35 + 0.65 * clamp(s / w.L, 0, 1));
      for (let o = -widen; o <= widen; o += step) {
        const i = Math.floor((w.mx + w.ax * s + w.nx * o) / cw), j = Math.floor((w.my + w.ay * s + w.ny * o) / ch);
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
        const k = i + j * GW, side = o / (widen || 1) * 0.42;
        vx[k] += (w.ax * V + w.nx * side * V - vx[k]) * 0.8;
        vy[k] += (w.ay * V + w.ny * side * V - vy[k]) * 0.8;
      }
    }
  }
  function sample(f, x, y, cw, ch) {
    const fx = clamp(x / cw - 0.5, 0, GW - 1.001), fy = clamp(y / ch - 0.5, 0, GH - 1.001);
    const i = fx | 0, j = fy | 0, a = fx - i, b = fy - j, k = i + j * GW;
    return (f[k] * (1 - a) + f[k + 1] * a) * (1 - b) + (f[k + GW] * (1 - a) + f[k + GW + 1] * a) * b;
  }

  function blow(ch, x) {
    const pres = x.p('presence'), raw = percentile(ch.vel);
    if (raw < (1 - pres) * 0.95) return;          // turned down, only the piece's hardest attacks blow
    const pow = x.p('power');
    const p = pow < 0.5 ? raw * pow * 2 : raw + (1 - raw) * (pow - 0.5) * 2;
    const W = x.W, H = x.H, full = raw >= 0.98 && sinceFull > 1.1 && pow > 0.04;
    // The mouth: low notes blow flat from the left edge, high ones climb from the lower edge.
    const span = (m) => clamp((m - 34) / 54, 0, 1);
    const mean = ch.notes.reduce((s, n) => s + span(n.m), 0) / ch.notes.length;
    const pick = mean + x.rnd(-0.22, 0.22);
    const mx = pick < 0.42 ? -30 : pick < 0.72 ? -30 : W * x.rnd(0.14, 0.4);
    const my = pick < 0.42 ? H * x.rnd(0.5, 0.74) : pick < 0.72 ? H * x.rnd(0.86, 1.04) : H + 30;
    const centre = (5 + 50 * Math.pow(mean, 1.1) + x.rnd(-3, 3)) * Math.PI / 180;
    // A chord is a fan of wedges from the one mouth, at most five: the outer notes and a spread between them.
    const sorted = [...ch.notes].sort((a, b) => a.m - b.m);
    const keep = sorted.length <= 5 ? sorted : [0, 1, 2, 3, 4].map((i) => sorted[Math.round(i * (sorted.length - 1) / 4)]);
    const spread = x.p('fan') * 2 * 7.5 * Math.PI / 180;
    const presK = 0.5 + 0.5 * pres, reach = x.p('reach');
    keep.forEach((n, i) => {
      const off = (i - (keep.length - 1) / 2) * spread, a = centre + off, s = span(n.m);
      const own = clamp(p * (0.75 + 0.25 * n.v / Math.max(1, ch.vel)), 0, 1);
      const L = (0.2 + 0.8 * Math.pow(Math.min(1, own / 0.9), 1.5)) * W * 1.3 * reach * presK;
      const hw = (10 + 92 * Math.pow(1 - s, 1.5)) * (0.4 + 0.6 * own) * (full ? 1.2 : 1);
      const hold = n.d > 0.25 ? Math.min(n.d, 0.6 + 3 * own) : 0.05;
      addWedge({ mx, my, a, L, hw, s, p: own, hold, full, life: (0.34 + 0.95 * own) * x.p('linger') * (full ? 2 : 1), V: (320 + 1500 * own) }, x);
    });
    if (full) {
      sinceFull = 0; bloom = Math.max(bloom, 0.55);
      fronts.push({ mx, my, ax: Math.cos(centre), ay: -Math.sin(centre), a: centre, s: 0, V: 2900 * presK, end: W * 1.6, age: 0 });
    }
    // A shove, not a shake: the picture lurches downwind and springs back.
    const lurch = Math.pow(p, 3) * (full ? 34 : 15) * (0.2 + 0.8 * pres) * 26;
    if (p > 0.5) { shoveVX += Math.cos(centre) * lurch; shoveVY -= Math.sin(centre) * lurch; }
  }

  function addWedge(o, x) {
    const w = { ...o, ax: Math.cos(o.a), ay: -Math.sin(o.a), nx: Math.sin(o.a), ny: Math.cos(o.a), age: 0, was: 0, slivers: [] };
    const top = clamp(Math.round(3 + w.s * 3.2 + w.p * 2), 2, 7);    // low is deep red-brass, high runs white-gold
    const k = Math.round(4 + 11 * w.p + 3 * (1 - w.s));
    // The body and its needle: one solid wedge for the instant the blast lands.
    w.slivers.push({ da: 0, off: 0, tip: 1, wd: w.hw * 0.55, top: clamp(top - 2, 2, 4), tail: 0.4, ph: 0, fl: 0.15, spread: 0, tear: 0.5, long: 0.42, adv: 0.03 });
    w.slivers.push({ da: 0, off: 0, tip: 0.94, wd: Math.max(2, w.hw * 0.2), top: Math.min(7, top + 1), tail: 0.6, ph: x.rnd(0, 6), fl: 0.3, spread: 0, tear: 0.2, long: 0.6, adv: 0.05 });
    // The strands it tears into: they part, blow on at their own speeds and flutter.
    for (let i = 0; i < k; i++) {
      const off = x.rnd(-1, 1), central = 1 - Math.abs(off);
      w.slivers.push({
        off, da: off * w.hw / Math.max(200, w.L), tip: x.rnd(0.55, 1.08), wd: w.hw * x.rnd(0.08, 0.26), top: clamp(top - (central < 0.4 ? 3 : central < 0.75 ? 2 : 1), 1, 6),
        tail: x.rnd(0.25, 1.3), ph: x.rnd(0, 6.28), fl: x.rnd(0.5, 1.5), spread: off * x.rnd(0.3, 1), tear: x.rnd(0.5, 1.2), long: x.rnd(0.65, 1.1), adv: x.rnd(0.06, 0.26),
      });
    }
    if (o.full) for (let i = 0; i < 10; i++) {           // the afterburn: long slow strands that stay after the front has gone
      const off = x.rnd(-1, 1);
      w.slivers.push({ off, da: off * w.hw * 2.6 / Math.max(200, w.L), tip: x.rnd(0.5, 1.1), wd: x.rnd(1.5, 7), top: clamp(Math.round(x.rnd(2, 5)), 1, 7), tail: x.rnd(0.15, 0.5), ph: x.rnd(0, 6.28), fl: x.rnd(0.8, 2), spread: off * x.rnd(0.4, 1.6), tear: x.rnd(0.8, 1.4), long: x.rnd(0.9, 1.5), adv: x.rnd(0.03, 0.12) });
    }
    wedges.push(w);
    while (wedges.length > MAX_WEDGES) wedges.shift();
  }

  // One strand as a tapered polygon along its wedge, narrow at the back, widest two thirds along, pointed at the front.
  const PTS = 6;
  function strand(path, w, q, tail, front, a, buffet) {
    const len = front - tail; if (len < 2) return;
    const fade = Math.min(1, Math.max(0, 1 - Math.max(0, a - w.hold) / (w.life * q.long)));
    const thin = q.wd * (0.35 + 0.65 * fade) * (1 + buffet * 0.3 * Math.sin(a * 21 + q.ph));
    const part = q.spread * Math.max(0, a - 0.05) * 60;       // strands part as the wedge tears
    const flut = (4 + 16 * Math.max(0, a - 0.08)) * q.fl * (1 + buffet * 1.6);
    const lat = (s) => s * q.da + (s / w.L) * part + (q.off * w.hw * 0.08) + Math.sin(s / w.L * 3.4 - a * 8 + q.ph) * flut * clamp(s / 300, 0, 1);
    let first = true;
    for (let i = 0; i <= PTS; i++) {                          // up one side
      const u = i / PTS, s = tail + len * u, hw = thin * Math.pow(u, 1.1) * Math.pow(1 - u, 0.4) * 1.75;
      const o = lat(s) + hw, X = w.mx + w.ax * s + w.nx * o, Y = w.my + w.ay * s + w.ny * o;
      if (first) { path.moveTo(X, Y); first = false; } else path.lineTo(X, Y);
    }
    for (let i = PTS - 1; i >= 1; i--) {                      // and back down the other
      const u = i / PTS, s = tail + len * u, hw = thin * Math.pow(u, 1.1) * Math.pow(1 - u, 0.4) * 1.75;
      const o = lat(s) - hw;
      path.lineTo(w.mx + w.ax * s + w.nx * o, w.my + w.ay * s + w.ny * o);
    }
    path.closePath();
  }

  TOOLS.push({
    id: 'gust', name: 'Brass gust', tag: 'new',
    blurb: 'Wedges of brass force burst out and shove the air aside: gusts on every attack, full blasts on the loudest of the piece.',
    params: [
      { key: 'power', label: 'how much force', min: 0, max: 1, value: 0.5,
        hint: 'How hard every attack blows. Left: puffs. Right: every blast crosses the screen.',
        icon: (g, v, w, h) => ICON.arrow(g, 4, h / 2, 6 + v * (w - 12), h / 2, ICON.gold, 1 + v * 2.5) },
      { key: 'reach', label: 'how long the wedges are', min: 0.4, max: 1.6, value: 1,
        hint: 'How far a wedge runs. Left: short jabs. Right: they run off the far side.',
        icon: (g, v, w, h) => { const L = 8 + v * (w - 10); g.fillStyle = ICON.gold; g.beginPath(); g.moveTo(2, h / 2); g.lineTo(2 + L * 0.7, h / 2 - 4); g.lineTo(2 + L, h / 2); g.lineTo(2 + L * 0.7, h / 2 + 4); g.closePath(); g.fill(); } },
      { key: 'air', label: 'how much air there is to push', min: 0, max: 1, value: 0.6,
        hint: 'How much air the wedges have to shove. Left: wedges alone. Right: the screen is full of dashes.',
        icon: (g, v, w, h) => { const R = ICON.rng(7); for (let i = 0; i < Math.round(v * 22); i++) { const X = 3 + R() * (w - 12), Y = 3 + R() * (h - 6); ICON.line(g, X, Y, X + 5, Y - 1.5, ICON.gold, 1); } } },
      { key: 'fan', label: 'how wide a chord opens', min: 0, max: 1, value: 0.5,
        hint: 'How far apart the notes of a chord blow. Left: all on one line. Right: a wide fan.',
        icon: (g, v, w, h) => { for (let i = -1; i <= 1; i++) ICON.line(g, 3, h / 2, w - 3, h / 2 + i * v * 11, ICON.gold, 1.6); } },
      { key: 'linger', label: 'how long the heat stays', min: 0.25, max: 3.5, value: 1,
        hint: 'How long the torn strands burn after a blast. Left: gone at once. Right: long burning streaks.',
        icon: (g, v, w, h) => ICON.trail(g, 0.1 + v * 0.9, w, h, ICON.gold) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much of it you see. Left: dim, short, and only the hardest attacks of the piece blow. Right: every attack blows at full heat.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => { g.fillStyle = '#ffc93a'; g.beginPath(); g.moveTo(4, h / 2); g.lineTo(4 + (w - 8) * (0.4 + 0.6 * v) * 0.7, h / 2 - 5); g.lineTo(4 + (w - 8) * (0.4 + 0.6 * v), h / 2); g.lineTo(4 + (w - 8) * (0.4 + 0.6 * v) * 0.7, h / 2 + 5); g.closePath(); g.fill(); }) },
    ],
    reset() { gridReady(); clearAll(); velsOf = null; attackVels = null; },
    onChord(ch, x) { gridReady(); blow(ch, x); },
    frame(x) {
      gridReady();
      const g = x.g, dt = Math.min(0.05, x.dt), W = x.W, H = x.H, cw = W / GW, chh = H / GH, pres = x.p('presence'), bright = 0.15 + 0.85 * pres;
      // The ground: the harness fades to black each frame; a little aubergine added back holds it near #12091e without
      // covering what is under it. (rgb = the fade's loss at that level, colour-burn's few levels included.)
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = pres;
      g.fillStyle = 'rgb(5,4,7)'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;

      if (dt > 0) {
        time += dt; sinceFull += dt;
        // the air: pushed by what is blowing now, carries itself on downwind, spreads and decays
        for (const w of wedges) {
          const prev = w.was, a = w.age + dt;
          const front = w.L * (1 - Math.pow(1 - Math.min(1, a / 0.1), 3));
          if (front > prev) push(w, prev, front, w.hw * 1.1 + 34 + 150 * w.p, w.V, x);
          else if (a < w.hold) push(w, w.L * 0.2, w.L, w.hw * 0.6 + 20, w.V * 0.34 * (0.7 + 0.3 * Math.sin(a * 17 + w.mx)), x);
          w.was = front; w.age = a;
        }
        for (const f of fronts) {
          const s0 = f.s; f.s += f.V * dt; f.age += dt;
          for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
            const k = i + j * GW, S = ((i + 0.5) * cw - f.mx) * f.ax + ((j + 0.5) * chh - f.my) * f.ay;
            if (S > s0 && S <= f.s) { vx[k] = f.ax * 1500; vy[k] = f.ay * 1500; }
          }
        }
        fronts = fronts.filter((f) => f.s < f.end + 800);
        for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
          const k = i + j * GW, X = (i + 0.5) * cw - vx[k] * dt * 0.8, Y = (j + 0.5) * chh - vy[k] * dt * 0.8;
          ux[k] = sample(vx, X, Y, cw, chh); uy[k] = sample(vy, X, Y, cw, chh);
        }
        const dec = Math.pow(0.5, dt / 0.34);
        for (let k = 0; k < vx.length; k++) { vx[k] = ux[k] * dec; vy[k] = uy[k] * dec; }
        // the shove springs back
        shoveVX += (-shoveX * 90 - shoveVX * 11) * dt; shoveVY += (-shoveY * 90 - shoveVY * 11) * dt;
        shoveX += shoveVX * dt; shoveY += shoveVY * dt;
        bloom *= Math.pow(0.5, dt / 0.16);
      }
      g.translate(clamp(shoveX, -60, 60), clamp(shoveY, -60, 60));
      g.globalCompositeOperation = 'lighter';

      // The air
      const want = Math.round(x.p('air') * 1000);
      airReady(x, want);
      const paths = AIR.map(() => new Path2D());
      for (let n = 0; n < want; n++) {
        const d = dashes[n];
        if (dt > 0) {
          const gx = sample(vx, d.x, d.y, cw, chh), gy = sample(vy, d.x, d.y, cw, chh), gs = Math.abs(gx) + Math.abs(gy);
          const amb = 5 + 3 * Math.sin(time * 0.3 + d.ph);        // the lazy drift when nothing is blowing
          const tx = gx + Math.sin(d.y * 0.011 + time * 0.23 + d.ph) * amb + 3, ty = gy + Math.cos(d.x * 0.009 - time * 0.19 + d.ph) * amb - 1.5;
          const k = 1 - Math.exp(-dt * (gs > 50 ? 11 : 1.6));
          d.vx += (tx - d.vx) * k; d.vy += (ty - d.vy) * k;
          // when the push has passed it still carries, and curls away
          const sp0 = Math.hypot(d.vx, d.vy), turn = d.curl * dt * clamp(sp0 / 60, 0, 1) * clamp(1.4 - sp0 / 320, 0, 1) * (gs > 240 ? 0.1 : 1);
          if (turn) { const c = Math.cos(turn), s = Math.sin(turn), a = d.vx; d.vx = a * c - d.vy * s; d.vy = a * s + d.vy * c; }
          d.x += d.vx * dt; d.y += d.vy * dt;
          d.h += Math.sin(time * 0.7 + d.ph) * dt * 0.8;
          if (d.x < -40) d.x += W + 80; else if (d.x > W + 40) d.x -= W + 80;
          if (d.y < -40) d.y += H + 80; else if (d.y > H + 40) d.y -= H + 80;
        }
        const sp = Math.hypot(d.vx, d.vy), b = sp < 26 ? 0 : sp < 110 ? 1 : sp < 300 ? 2 : sp < 650 ? 3 : 4;
        const dir = sp > 22 ? Math.atan2(d.vy, d.vx) : d.h, len = (4 + Math.min(300, sp * 0.13)) * d.sz, c = Math.cos(dir), s = Math.sin(dir);
        const hook = clamp(d.curl * 0.12, -0.5, 0.5) * len * clamp(1 - sp / 500, 0, 1);
        const p = paths[b]; p.moveTo(d.x, d.y);
        p.quadraticCurveTo(d.x - c * len * 0.5 - s * hook, d.y - s * len * 0.5 + c * hook, d.x - c * len, d.y - s * len);
      }
      g.lineCap = 'round'; g.globalAlpha = bright;
      AIR.forEach(([col, lw], i) => { g.strokeStyle = col; g.lineWidth = lw; g.stroke(paths[i]); });

      // The front of a full blast floods across: a white-gold wall with a long burn behind it.
      for (const f of fronts) {
        const k = clamp(1 - f.s / (f.end + 800), 0, 1), back = 600;
        const gr = g.createLinearGradient(f.s - back, 0, f.s + 30, 0);
        gr.addColorStop(0, 'rgba(200,50,15,0)'); gr.addColorStop(0.55, `rgba(214,70,4,${0.14 * k})`);
        gr.addColorStop(0.9, `rgba(255,196,40,${0.32 * k})`); gr.addColorStop(0.985, `rgba(255,246,208,${0.95 * k})`); gr.addColorStop(1, 'rgba(255,246,208,0)');
        g.save(); g.translate(f.mx, f.my); g.rotate(-f.a); g.fillStyle = gr; g.fillRect(f.s - back, -2400, back + 30, 4800); g.restore();
      }
      if (bloom > 0.01) { g.fillStyle = `rgba(255,170,60,${0.14 * bloom})`; g.fillRect(-70, -70, W + 140, H + 140); }

      // The wedges, batched by heat. A strand runs to its front fast, burns while its note holds, then its back catches up.
      const buckets = HEAT.map(() => new Path2D());
      let drawn = 0;
      for (let i = wedges.length - 1; i >= 0; i--) {
        const w = wedges[i], a = w.age, ease = 1 - Math.pow(1 - Math.min(1, a / 0.1), 3), after = Math.max(0, a - w.hold);
        const held = a < w.hold && w.hold > 0.1, buffet = held ? 1 : 0, gone = after / w.life;
        let live = false;
        for (const q of w.slivers) {
          if (after > w.life * q.long) continue;
          if (drawn++ > MAX_SLIVERS) break;
          live = true;
          const t01 = after / (w.life * q.long);
          const front = w.L * q.tip * ease * (1 + q.adv * after * 2.2) * (1 + buffet * 0.05 * Math.sin(a * 13 + q.ph));
          const tail = w.L * q.tip * Math.pow(Math.min(1, after * q.tail * 3.2 / Math.max(0.35, w.life)), 0.85) * q.tear * 1.2;
          const heat = Math.min(q.top, Math.round(q.top * (1 - t01) * (1 - t01) + (a < 0.14 ? 1 : 0))) - (held && a > 0.3 && q.wd > 6 ? 1 : 0);
          strand(buckets[clamp(heat, 0, 7)], w, q, tail, front, a, buffet);
        }
        if (!live && gone > 0) wedges.splice(i, 1);
      }
      // exposure: a crowd of wedges must stay brass, not burn out to one white mass
      g.globalAlpha = bright / (1 + 0.14 * Math.max(0, wedges.length - 5));
      buckets.forEach((p, i) => { g.fillStyle = HEAT[i]; g.fill(p); });
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    },
  });
})();
