// Marbling (suminagashi): every note drops a ring of ink on a still bath. A drop of radius r at c pushes every
// existing ink line outward, area-preserving: p' = c + (p - c) * sqrt(1 + r^2 / |p - c|^2). Drops bloom over a
// short time by applying that same push in small area increments (exact: |p'-c|^2 = |p-c|^2 + r^2).
// Combs: a rake of parallel tines is dragged through the bath (p += u * pull * L / (d + L), d = distance to the
// nearest tine; exact when applied in steps, since the push never changes d). The bass stirs it with a vortex.
(() => {
  const TAU = Math.PI * 2, CAP = 17000, MAXSEG = 9, MERGE = 1.4, M = 60, FAR = 420, FARSEG = 48, BLOOM = 0.22, WAVE = 0.25;
  // Palettes: ink colour from low pitch (first stop) to high pitch (last stop). 3 = hue by pitch class.
  const PAL = [
    [[66, 4, 9], [128, 12, 16], [196, 52, 36], [240, 226, 204]],    // blood and bone
    [[14, 22, 72], [30, 64, 150], [120, 140, 176], [244, 200, 112]], // indigo and gold
    [[6, 44, 46], [20, 104, 94], [146, 174, 150], [234, 240, 224]],  // verdigris and ash
  ];
  let rings = [], grow = [], strokes = [], nextId = 0, acc = 0, time = 0, nStroke = 0, total = 0, vx = 640, vy = 360, tx = 640, ty = 360;

  function hsl(h, s, l) {
    const f = (n) => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return [f(0), f(8), f(4)];
  }
  function inkColour(x, m, v, top) {
    const pal = Math.round(x.p('palette')), pp = Math.min(1, x.pitch01(m) + (top ? 0.08 : 0)), vb = 0.72 + 0.28 * Math.min(1.2, v / 110);
    let c;
    if (pal >= 3) c = hsl(((m * 7) % 12) * 30, 0.78, 0.22 + 0.5 * pp);          // circle of fifths around the wheel
    else {
      const st = PAL[pal], t = Math.max(0, Math.min(0.999, (pp - 0.16) / 0.52)) * (st.length - 1), i = Math.floor(t), f = t - i;
      c = st[i].map((a, k) => a + (st[i + 1][k] - a) * f);
    }
    return c.map((a) => a * vb);
  }
  const rgb = (c, k, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;

  // --- the three deformations of the bath ---
  function drop(cx, cy, inc, upto) {
    for (const r of rings) {
      if (r.id > upto) break; if (r.bg) continue;
      const xs = r.xs, ys = r.ys;
      for (let i = 0; i < xs.length; i++) {
        const dx = xs[i] - cx, dy = ys[i] - cy, k = Math.sqrt(1 + inc / (dx * dx + dy * dy + 1e-3));
        xs[i] = cx + dx * k; ys[i] = cy + dy * k;
      }
    }
  }
  function rake(s, dz) {
    const L = s.lam, sp = s.sp, wav = s.wave * sp * 0.3;
    for (const r of rings) {
      if (r.bg) continue; const xs = r.xs, ys = r.ys;
      for (let i = 0; i < xs.length; i++) {
        const px = xs[i] - s.ox, py = ys[i] - s.oy;
        const dist = px * s.nx + py * s.ny + wav * Math.sin((px * s.ux + py * s.uy) * 0.011);
        const m = ((dist % sp) + sp) % sp, d = Math.min(m, sp - m), z = dz * L / (d + L);
        xs[i] += s.ux * z; ys[i] += s.uy * z;
      }
    }
  }
  function stir(cx, cy, w) {
    const Rv = 260;
    for (const r of rings) {
      if (r.bg) continue; const xs = r.xs, ys = r.ys;
      for (let i = 0; i < xs.length; i++) {
        const dx = xs[i] - cx, dy = ys[i] - cy, th = w * Rv / (Math.sqrt(dx * dx + dy * dy) + Rv), c = Math.cos(th), sn = Math.sin(th);
        xs[i] = cx + dx * c - dy * sn; ys[i] = cy + dx * sn + dy * c;
      }
    }
  }
  // Keep lines smooth where they stretch, thin where they bunch up; find the rings that left the bath.
  function resample(r, W, H) {
    const xs = r.xs, ys = r.ys, n = xs.length, ox = [], oy = [];
    let vis = false;
    for (let i = 0; i < n; i++) {
      const x0 = xs[i], y0 = ys[i], j = (i + 1) % n, x1 = xs[j], y1 = ys[j];
      if (ox.length) { const lx = ox[ox.length - 1] - x0, ly = oy[oy.length - 1] - y0; if (lx * lx + ly * ly < MERGE * MERGE && i < n - 1) continue; }
      ox.push(x0); oy.push(y0);
      // fine segments on screen, coarse ones just off it (a stir can pull them back: they must not come back as straight cuts)
      const near = (m) => Math.max(x0, x1) > -m && Math.min(x0, x1) < W + m && Math.max(y0, y1) > -m && Math.min(y0, y1) < H + m;
      if (!near(FAR)) continue; vis = true;
      const seg = near(M) ? MAXSEG : FARSEG, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
      if (L2 > seg * seg) { const k = Math.min(60, Math.ceil(Math.sqrt(L2) / seg)); for (let s = 1; s < k; s++) { ox.push(x0 + dx * s / k); oy.push(y0 + dy * s / k); } }
    }
    r.xs = ox; r.ys = oy; return vis;
  }
  function inside(r, px, py) {
    let c = false; const xs = r.xs, ys = r.ys;
    for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) if ((ys[i] > py) !== (ys[j] > py) && px < (xs[j] - xs[i]) * (py - ys[i]) / (ys[j] - ys[i]) + xs[i]) c = !c;
    return c;
  }
  function startStroke(x) {
    const k = nStroke++, ORI = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4], pair = Math.floor(k / 2), back = k % 2 === 1;
    const ang = ORI[pair % 4] + x.rnd(-0.08, 0.08), dir = back ? -1 : 1;
    const ux = Math.cos(ang) * dir, uy = Math.sin(ang) * dir, nx = -Math.sin(ang), ny = Math.cos(ang);
    const ext = Math.abs(x.W * nx) + Math.abs(x.H * ny), sp = ext / Math.max(1, Math.round(x.p('tines')));
    const off = back ? sp / 2 : x.rnd(0, sp);   // the return stroke runs between the first one's tines: feathers
    strokes.push({ ox: x.W / 2 + nx * off, oy: x.H / 2 + ny * off, ux, uy, nx, ny, sp, lam: 10 + sp * 0.05, wave: WAVE,
      amt: x.p('pull'), t: 0, dur: 0.55, e: 0 });
  }

  TOOLS.push({
    id: 'marbling', name: 'Marbling', tag: 'new',
    blurb: 'Every note drops ink on a still bath and pushes the older ink outward into bands (low: big dark drops, high: small bright ones). Fast or hard playing drags a comb through it; the bass stirs it.',
    params: [
      { key: 'size', label: 'drop size', min: 0.3, max: 2.5, value: 1, drive: '+level' },
      { key: 'gaps', label: 'clear-water gaps', min: 0, max: 0.95, value: 0.6 },
      { key: 'scatter', label: 'scatter', min: 0, max: 1, value: 0.32 },
      { key: 'comb', label: 'combing', min: 0, max: 1.5, value: 0.45, drive: '+rate' },
      { key: 'tines', label: 'tines', min: 1, max: 18, step: 1, value: 7 },
      { key: 'pull', label: 'comb pull', min: 0, max: 320, value: 130, drive: '+level' },
      { key: 'swirl', label: 'swirl', min: -1, max: 1, value: 0.12, drive: '+bass' },
      { key: 'palette', label: 'palette', min: 0, max: 3, step: 1, value: 0 },
      { key: 'fill', label: 'lines ↔ filled', min: 0, max: 1, value: 0.8 },
      { key: 'decay', label: 'fade time (s)', min: 2, max: 40, value: 12 },
    ],
    reset(x) { rings = []; grow = []; strokes = []; acc = 0; total = 0; vx = tx = x.W / 2; vy = ty = x.H / 2; },
    onChord(ch, x) {
      const sc = x.p('scatter'), size = x.p('size'), bloom = BLOOM, gap = x.p('gaps');
      const cx = x.W / 2 + x.rnd(-1, 1) * sc * x.W * 0.42, cy = x.H / 2 + x.rnd(-1, 1) * sc * x.H * 0.4;
      tx = cx; ty = cy;
      let ns = [...ch.notes].sort((a, b) => a.m - b.m);
      if (ns.length > 5) ns = [0, 1, 2, 3, 4].map((i) => ns[Math.round(i * (ns.length - 1) / 4)]);
      // low notes first: the high, bright drops land last, in the middle, and push the dark ones into rings
      for (const n of ns) {
        const pp = x.pitch01(n.m), R = (12 + 190 * Math.pow(1 - pp, 1.4) * (0.4 + 0.6 * Math.min(1.25, n.v / 110))) * size;
        const j = 4 + R * 0.1, px = cx + x.rnd(-j, j), py = cy + x.rnd(-j, j), N = Math.max(24, Math.min(140, Math.round(R * 0.5)));
        const dur = bloom * (0.7 + 0.5 * Math.min(2, n.d)), xs = [], ys = [];
        for (let i = 0; i < N; i++) { xs.push(px + Math.cos(i / N * TAU) * 0.6); ys.push(py + Math.sin(i / N * TAU) * 0.6); }
        // first a drop of clear water, then the ink inside it: the ink pushes the water into a black band around it
        if (gap > 0.02) {
          const cl = { id: nextId++, xs: xs.slice(), ys: ys.slice(), col: null, age: 0 };
          rings.push(cl); grow.push({ cx: px, cy: py, R2: R * R * gap * gap, done: 0.36, t: 0, dur: dur * 0.6, id: cl.id });
        }
        const ring = { id: nextId++, xs, ys, col: inkColour(x, n.m, n.v, n === ns[ns.length - 1] && ns.length > 1), age: 0 };
        rings.push(ring);
        grow.push({ cx: px, cy: py, R2: R * R, done: 0.36, t: 0, dur, id: ring.id });
      }
      const cb = x.p('comb');
      acc += cb * (0.18 + 0.4 * ch.vel / 127) + (ch.vel >= 95 && ch.notes.length >= 3 ? cb * 0.7 : 0);
      if (acc >= 1) { acc = Math.min(acc - 1, 0.8); startStroke(x); }
    },
    frame(x) {
      const g = x.g, dt = x.dt; time += dt;
      // blooming drops
      for (const d of grow) {
        d.t += dt; const u = Math.min(1, d.t / Math.max(0.001, d.dur)), e = 1 - Math.pow(1 - u, 3), a = Math.max(d.done, d.R2 * e);
        if (a > d.done) { drop(d.cx, d.cy, a - d.done, d.id); d.done = a; }
      }
      grow = grow.filter((d) => d.t < d.dur);
      // combs
      for (const s of strokes) {
        s.t += dt; const u = Math.min(1, s.t / s.dur), e = 1 - Math.pow(1 - u, 2.4);
        if (e > s.e) { rake(s, s.amt * (e - s.e)); s.e = e; }
      }
      // the stir
      const sw = x.p('swirl');
      // the vortex drifts after the latest drops, so the stir twists the fresh ink in place
      const kv = 1 - Math.pow(0.5, dt / 1.5); vx += (tx - vx) * kv; vy += (ty - vy) * kv;
      if (Math.abs(sw) > 0.005) stir(vx, vy, sw * dt * 1.5);
      // tidy: resample, fade, drop what has left the bath or faded
      // ink ages with the music: in sparse passages it holds, so a lone oboe line still lands on a marbled bath
      const life = x.p('decay'), age = dt * (0.3 + 1.6 * x.feat.rate); total = 0;
      for (const r of rings) {
        r.age += age; r.fresh = (r.fresh ?? 0) + dt; if (r.age > life) { r.dead = true; continue; }
        if (r.bg) continue;
        if (!resample(r, x.W, x.H)) { if (inside(r, x.W / 2, x.H / 2)) { r.bg = true; r.xs = r.ys = null; } else r.dead = true; continue; }
        total += r.xs.length;
      }
      rings = rings.filter((r) => !r.dead);
      // a bath-wide sheet of ink or water hides everything older than it
      const fill = x.p('fill'), cover = (r) => r.bg && (r.col ? fill > 0.9 : fill > 0.6);
      for (let i = rings.length - 1; i > 0; i--) if (cover(rings[i])) { rings.splice(0, i); break; }
      while (total > CAP && rings.length > 1) { const r = rings.shift(); if (!r.bg) total -= r.xs.length; }
      // draw: oldest first, the newer ink sits inside and on top
      const water = Math.min(1, fill * 1.7);
      g.lineJoin = 'round';
      for (const r of rings) {
        if (!r.col) { // clear water: the black of the bath
          if (water < 0.02) continue; g.fillStyle = `rgba(0,0,0,${water})`;
          if (r.bg) { g.fillRect(0, 0, x.W, x.H); continue; }
          const xs = r.xs, ys = r.ys; g.beginPath(); g.moveTo(xs[0], ys[0]); for (let i = 1; i < xs.length; i++) g.lineTo(xs[i], ys[i]); g.closePath();
          g.fill(); continue;
        }
        const f = Math.pow(1 - r.age / life, 1.3), flash = 1 + 0.7 * Math.max(0, 1 - r.fresh / 0.3);
        if (r.bg) { g.fillStyle = rgb(r.col, f, fill); g.fillRect(0, 0, x.W, x.H); continue; }
        const xs = r.xs, ys = r.ys;
        g.beginPath(); g.moveTo(xs[0], ys[0]); for (let i = 1; i < xs.length; i++) g.lineTo(xs[i], ys[i]); g.closePath();
        if (fill > 0.02) { g.fillStyle = rgb(r.col, f * flash, fill); g.fill(); }
        if (fill < 0.98) { g.lineWidth = 1.3 + (1 - fill) * 1.2; g.strokeStyle = rgb(r.col.map((c) => c * 0.7 + 80), (0.25 + 0.75 * f) * flash, 1 - fill * 0.85); g.stroke(); }
      }
      // the tines, glimpsed as they are dragged through
      for (const s of strokes) {
        const al = 0.2 * Math.pow(1 - Math.min(1, s.t / s.dur), 2); if (al < 0.01) continue;
        g.strokeStyle = `rgba(236,226,206,${al})`; g.lineWidth = 1;
        const cs = [[0, 0], [x.W, 0], [0, x.H], [x.W, x.H]].map(([a, b]) => (a - s.ox) * s.nx + (b - s.oy) * s.ny);
        const k0 = Math.ceil(Math.min(...cs) / s.sp), k1 = Math.floor(Math.max(...cs) / s.sp);
        g.beginPath();
        for (let k = k0; k <= k1; k++) { const px = s.ox + s.nx * k * s.sp, py = s.oy + s.ny * k * s.sp; g.moveTo(px - s.ux * 2000, py - s.uy * 2000); g.lineTo(px + s.ux * 2000, py + s.uy * 2000); }
        g.stroke();
      }
      strokes = strokes.filter((s) => s.t < s.dur);
    },
  });
})();
