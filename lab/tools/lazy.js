// Lazy: it can't be bothered. A heap of fat, limp green limbs lies sprawled on the floor. A note asks one to get up: the
// free end twitches on the attack, hauls itself up a little, loses interest, hangs there and flops over onto its neighbours,
// which sag under it and take seconds to recover. An attack that finds its limb busy (or that it simply ignores) gets a dull
// chartreuse dimple, the least possible acknowledgement. Fast music makes it care less.
// Each limb is a chain: its base pinned, its free end led along a path while it is up, the rest following by gravity,
// heavy damping and length constraints, stepped in song seconds so nothing snaps at a low frame rate.
(() => {
  const PTS = 12, SUB = 4, SAMPLES = (PTS - 1) * SUB + 1, H_STEP = 1 / 60, G = 720, DAMP = 3.4;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const [lay, lg] = mk(1280, 720);
  const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const css = (c, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // [ground, bottle, moss, pea, chartreuse] at the left end of the green knob, the middle (the default), and the right end.
  const GREENS = [
    ['#121c12', '#0e2a1b', '#21401f', '#37582a', '#7d9a3a'],
    ['#39401c', '#1f4a2c', '#4f6b22', '#7c9a2f', '#c4d94a'],
    ['#5a5f14', '#4d8a22', '#88a51e', '#b4c92a', '#e8f55a'],
  ].map((row) => row.map(hex));
  const paletteAt = (v) => { const k = v < 0.5 ? 0 : 1, t = v < 0.5 ? v * 2 : v * 2 - 1; return GREENS[k].map((c, i) => mix(c, GREENS[k + 1][i], t)); };
  // A fixed little generator, so the heap always starts as the same heap.
  const seeded = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  let limbs = [], order = [], pend = [], marks = [], clock = 0, acc = 0, lastAttack = 0, gapUntil = 0, yawnT = -1, yawned = false, built = 0;
  let vels = null, pitchLo = 36, pitchHi = 84;

  // This song's own notes: how hard a velocity is among them, and which pitches it really spans.
  function learn() {
    const ns = window.NOTES || [];
    vels = ns.map((n) => n[3]).sort((a, b) => a - b);
    const ps = ns.map((n) => n[2]).sort((a, b) => a - b);
    if (ps.length) { pitchLo = ps[Math.floor(ps.length * 0.04)]; pitchHi = Math.max(pitchLo + 12, ps[Math.floor(ps.length * 0.96)]); }
  }
  function rank(v) {
    if (!vels) learn();
    if (!vels.length) return 0.5;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length;
  }

  function build(n, W, Ht) {
    const R = seeded(77); limbs = []; pend = []; marks = [];
    const slots = []; for (let i = 0; i < n; i++) slots.push((i + 0.5) / n);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)), t = slots[i]; slots[i] = slots[j]; slots[j] = t; }
    for (let i = 0; i < n; i++) {
      const f = n > 1 ? 1 - i / (n - 1) : 0.5;                    // 1: the fattest, at the bottom; 0: thin, on top
      const w = 66 + 86 * Math.pow(f, 1.1), L = (210 + 330 * f) * (0.85 + 0.3 * R());
      const bx = W * (0.5 + (slots[i] - 0.5) * (0.62 + 0.62 * f));
      const side = bx < W * 0.3 ? 1 : bx > W * 0.7 ? -1 : (R() < 0.5 ? -1 : 1);
      const bulge = 0.45 + R() * 1.1;
      const l = { i, f, w, L, bx, by: 0, W, Ht, side, A: 16 + R() * 24, fq: 0.012 + R() * 0.009, ph: R() * 6.28, off: (R() - 0.5) * 0.05, cx: (R() - 0.5) * 0.3, state: 'rest', free: 0, sink: 0, slide: 0, bulge, x: [], y: [], px: [], py: [], rx: [], ry: [], dy: [], seg: [], sag: new Float32Array(PTS), dim: new Float32Array(PTS),
        sx: new Float32Array(SAMPLES), sy: new Float32Array(SAMPLES), sw: new Float32Array(SAMPLES) };
      pose(l);
      for (let k = 0; k < PTS; k++) { l.x.push(l.rx[k]); l.y.push(l.ry[k]); l.px.push(l.rx[k]); l.py.push(l.ry[k]); }
      limbs.push(l);
    }
    order = limbs.slice();
    built = n;
  }
  // The shape it lies in, on its current side.
  // It drapes over the heap: a mound, highest in the middle, and the thinner the limb the higher up the mound it lies.
  function pose(l) {
    for (let k = 0; k < PTS; k++) {
      const u = k / (PTS - 1), X = l.bx + l.side * l.L * u, prof = 0.6 + 0.4 * Math.cos(Math.max(-1, Math.min(1, (X / l.W - 0.5 + l.cx) * 1.5)) * Math.PI);
      l.rx[k] = X; l.ry[k] = l.Ht * (0.96 + l.off - (1 - l.f) * 0.4 * prof + (1 - 0.6 * l.f) * 0.045 * (2 * u - 1) * (2 * u - 1)) + l.A * Math.sin(X * l.fq + l.ph);
    }
    l.by = l.ry[0];
    for (let k = 0; k < PTS - 1; k++) l.seg[k] = Math.hypot(l.rx[k + 1] - l.rx[k], l.ry[k + 1] - l.ry[k]);
  }

  // A note asks this limb to get up. Returns false if it won't.
  function ask(l, n, v01, x, late) {
    const rate = x.feat.rate, lazy = x.p('lazy'), pres = x.p('presence');
    if (l.state !== 'rest' || clock < l.free) return false;
    let up = 0; for (const o of limbs) if (o.state !== 'rest') up++;
    if (up >= Math.max(1, Math.round(4 - 3.4 * rate))) return false;
    if (!late && clock < gapUntil) return false;
    if (!late && Math.random() < Math.min(0.95, Math.max(0, rate * 1.15 - 0.05) + (lazy - 0.5) * 0.3)) return false;
    const liftH = 240 * x.p('lift') * (0.38 + 0.62 * (1 - l.f)) * (0.32 + 0.68 * Math.pow(v01, 1.3)) * (1 - 0.72 * rate) * (1.25 - 0.5 * lazy) * (0.35 + 0.65 * pres);
    const T = (1.5 + 1.9 * l.f) * (0.55 + 1.5 * lazy) * (1 + 0.6 * rate) * x.rnd(0.85, 1.15);
    const e = PTS - 1;
    l.state = 'lift'; l.lp = 0; l.T = T; l.sink *= 0.35;
    l.x0 = l.x[e]; l.y0 = l.y[e];
    l.ay = Math.min(l.y[e], l.by) - liftH;
    { const reach = l.L * x.rnd(0.72, 0.86), hh = Math.abs(l.ay - l.by); l.ax = l.bx + l.side * Math.sqrt(Math.max(l.L * l.L * 0.1, reach * reach - hh * hh)); }
    l.held = n.d > T * 1.1;
    l.until = clock + (l.held ? Math.min(7, n.d) : T + x.rnd(0.25, 0.85) * (1.3 - 0.6 * lazy));
    l.tw = (9 + 16 * v01) * (0.5 + 0.5 * pres); l.y[e] -= l.tw;   // the twitch: in the same frame as the attack
    gapUntil = clock + rate * rate * x.rnd(3.5, 7);
    return true;
  }

  // The least possible acknowledgement: on the top surface of whichever limb is uppermost under this pitch.
  function dimple(px, v01, x) {
    const rate = x.feat.rate;
    let best = null, idx = 0, top = 1e9;
    for (const l of limbs) {
      let nd = 1e9, nk = 0;
      for (let k = 0; k < PTS; k++) { const d = Math.abs(l.x[k] - px); if (d < nd) { nd = d; nk = k; } }
      if (nd > 40 + l.w * 0.6) continue;
      const y = l.y[nk] - l.w * 0.5;
      if (y < top) { top = y; best = l; idx = nk; }
    }
    if (!best) return;
    best.dim[idx] = Math.min(14, best.dim[idx] + (4 + 10 * v01) * (1 - 0.45 * rate));
    if (marks.length > 22) marks.shift();
    marks.push({ l: best, k: idx * SUB, age: 0, life: 0.55 - 0.25 * rate, r: (11 + 22 * v01) * (1 - 0.3 * rate) });
  }

  // It lands: every limb under it sags where it was hit, and the sag spreads slowly along them.
  function squash(l, x) {
    const at = order.indexOf(l), amt = (9 + 26 * l.f) * x.p('fat') * x.p('presence');
    for (let o = 0; o < at; o++) {
      const b = order[o];
      for (let k = 0; k < PTS; k++) for (let j = PTS - 1; j >= 0; j -= 2) {
        const d = Math.hypot(b.x[k] - l.x[j], b.y[k] - l.y[j]), reach = (b.w + l.w) * 0.5 * x.p('fat');
        if (d < reach) { b.sag[k] = Math.min(46, b.sag[k] + amt * (1 - d / reach) * 0.6); }
      }
    }
  }

  function advance(l, h, x) {
    const e = PTS - 1, lazy = x.p('lazy');
    // the free end, led along its half-hearted path
    let led = false, tx = 0, ty = 0;
    if (l.state === 'lift') {
      l.lp = Math.min(1, l.lp + h / l.T);
      const q = 1 - Math.pow(1 - l.lp, 2.8), haul = 1 + 0.05 * Math.sin(l.lp * 16);
      l.tw *= Math.exp(-h / 0.3);
      tx = l.x0 + (l.ax - l.x0) * q; ty = l.y0 + (l.ay - l.y0) * q * haul - l.tw; led = true;
      if (l.lp >= 1) { l.state = 'hang'; l.hx = tx; l.hy = ty; l.ht = 0; }
    } else if (l.state === 'hang') {
      l.ht += h;
      const tremble = l.held ? (1.4 + Math.min(3, l.ht * 0.9)) : 0;
      tx = l.hx + 7 * Math.sin(l.ht * 1.7) + tremble * Math.sin(clock * 71); ty = l.hy + l.ht * (l.held ? 14 : 5) + tremble * 0.7 * Math.sin(clock * 83); led = true;
      if (clock >= l.until) {
        // topples, usually to the other side, unless that is off the screen
        const flip = Math.random() < 0.82, ts = l.bx - l.side * l.L;
        if (flip && ts > -70 && ts < x.W + 70) { l.side = -l.side; pose(l); }
        l.state = 'fall'; l.fp = 0; l.x0 = tx; l.y0 = ty; l.T = (0.85 + 0.55 * l.f) * x.rnd(0.9, 1.25);
        order.splice(order.indexOf(l), 1); order.push(l);       // it comes down across its neighbours
        led = true;
      }
    } else if (l.state === 'fall') {
      l.fp = Math.min(1, l.fp + h / l.T);
      const p = l.fp, sx = p * p * (3 - 2 * p);
      tx = l.x0 + (l.rx[e] - l.x0) * sx; ty = l.y0 + (l.ry[e] + l.sink - l.y0) * Math.pow(p, 2.3) - 12 * Math.sin(Math.PI * p); led = true;
      if (p >= 1) {
        l.state = 'rest'; l.free = clock + (2.5 + 7 * lazy) * x.rnd(0.8, 1.3); l.slide = l.side * x.rnd(2, 8);
        squash(l, x);
      }
    }
    // settling: a limb that has come to rest sinks a little deeper and slides a few pixels, slower and slower
    l.sink += ((12 + 10 * l.f) - l.sink) * (1 - Math.exp(-h / 22));
    if (Math.abs(l.slide) > 0.02) {
      const d = l.slide * h; l.slide *= Math.exp(-h / 2.4);
      if (l.bx + d > -60 && l.bx + d < x.W + 60) { l.bx += d; for (let k = 0; k < PTS; k++) l.rx[k] += d; }
    }
    const busy = l.state !== 'rest'; l.hl = (l.hl === undefined ? 1 : l.hl) + ((busy ? 0 : 1) - (l.hl === undefined ? 1 : l.hl)) * (1 - Math.exp(-h / 0.5));
    const damp = Math.exp(-h * DAMP), pull = 1 - Math.exp(-h / (busy ? 1.3 : 0.75));
    for (let k = 1; k < PTS; k++) {
      const u = k / e, vx = (l.x[k] - l.px[k]) * damp, vy = (l.y[k] - l.py[k]) * damp;
      l.px[k] = l.x[k]; l.py[k] = l.y[k];
      l.x[k] += vx; l.y[k] += vy + G * h * h;
      // lying down is where it wants to be: all of it at rest, only the part near the base while it is up
      const a = busy ? pull * Math.pow(1 - u, 1.6) * (l.state === 'fall' ? 0.6 + 2 * l.fp : 1) : pull;
      l.x[k] += (l.rx[k] - l.x[k]) * Math.min(1, a);
      const floor = l.ry[k] + l.sink;
      if (!busy || l.y[k] > floor) l.y[k] += (floor - l.y[k]) * Math.min(1, a);
      if (l.y[k] > floor + 2) l.y[k] = floor + 2;
    }
    l.x[0] = l.rx[0]; l.y[0] = l.ry[0] + l.sink;
    if (led) { l.x[e] = tx; l.y[e] = ty; }
    for (let it = 0; it < 4; it++) {
      for (let k = 0; k < e; k++) {
        const dx = l.x[k + 1] - l.x[k], dy = l.y[k + 1] - l.y[k], d = Math.hypot(dx, dy) || 1, c = (d - l.seg[k]) / d * 0.5;
        const wa = k === 0 ? 0 : 1, wb = (led && k + 1 === e) ? 0 : 1, s = wa + wb; if (!s) continue;
        const ka = c * 2 * wa / s, kb = c * 2 * wb / s;
        l.x[k] += dx * ka; l.y[k] += dy * ka; l.x[k + 1] -= dx * kb; l.y[k + 1] -= dy * kb;
      }
      // no hairpins: fat things can't fold flat
      for (let k = 0; k < e - 1; k++) {
        const dx = l.x[k + 2] - l.x[k], dy = l.y[k + 2] - l.y[k], d = Math.hypot(dx, dy) || 1, min = (l.seg[k] + l.seg[k + 1]) * 0.74;
        if (d < min) { const c = (d - min) / d * 0.5, wa = k === 0 ? 0 : 1, wb = (led && k + 2 === e) ? 0 : 1, s = wa + wb; if (s) { l.x[k] += dx * c * 2 * wa / s; l.y[k] += dy * c * 2 * wa / s; l.x[k + 2] -= dx * c * 2 * wb / s; l.y[k + 2] -= dy * c * 2 * wb / s; } }
      }
    }
    // the sag spreads along the limb and recovers over seconds; a dimple is gone in a moment
    const sag = l.sag, dim = l.dim, sp = 1 - Math.exp(-h / 0.9), rec = Math.exp(-h / (2.2 + 1.6 * lazy)), rd = Math.exp(-h / 0.4);
    let prev = sag[0];
    for (let k = 0; k < PTS; k++) {
      const cur = sag[k], nxt = k < e ? sag[k + 1] : cur;
      sag[k] = (cur + ((prev + nxt) * 0.5 - cur) * sp) * rec; prev = cur;
      dim[k] *= rd;
    }
  }

  // The chain drawn smooth, with its own swelling width, and the same limp base: never a head at either end.
  function sample(l, fat, yawn) {
    const e = PTS - 1; let s = 0;
    const X = (k) => l.x[Math.max(0, Math.min(e, k))], Y = (k) => { const q = Math.max(0, Math.min(e, k)); return l.y[q] + l.sag[q] + l.dim[q] * 0.5 - yawn * 12; };
    for (let k = 0; k < e; k++) {
      const x0 = X(k - 1), x1 = X(k), x2 = X(k + 1), x3 = X(k + 2), y0 = Y(k - 1), y1 = Y(k), y2 = Y(k + 1), y3 = Y(k + 2);
      for (let j = 0; j < (k === e - 1 ? SUB + 1 : SUB); j++) {
        const t = j / SUB, t2 = t * t, t3 = t2 * t;
        l.sx[s] = 0.5 * (2 * x1 + (x2 - x0) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (3 * x1 - x0 - 3 * x2 + x3) * t3);
        l.sy[s] = 0.5 * (2 * y1 + (y2 - y0) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (3 * y1 - y0 - 3 * y2 + y3) * t3);
        const u = (k + t) / e, q1 = Math.min(e, k + 1), sg = l.sag[k] + (l.sag[q1] - l.sag[k]) * t, dm = l.dim[k] + (l.dim[q1] - l.dim[k]) * t;
        const swell = 0.58 + 0.42 * Math.pow(Math.sin(Math.PI * Math.pow(u, l.bulge)), 0.8);
        l.sw[s] = Math.max(6, 0.5 * l.w * fat * swell * (1 + sg * 0.006) * (1 + yawn * 0.12) - dm * 0.5);
        s++;
      }
    }
  }
  const nx = new Float32Array(SAMPLES), ny = new Float32Array(SAMPLES);
  function normals(l) {
    const n = SAMPLES - 1;
    for (let s = 0; s <= n; s++) {
      const a = Math.max(0, s - 1), b = Math.min(n, s + 1), dx = l.sx[b] - l.sx[a], dy = l.sy[b] - l.sy[a], d = Math.hypot(dx, dy) || 1;
      nx[s] = dy / d; ny[s] = -dx / d;
    }
  }
  // Drawn as runs of round strokes, one run per width: their union stays clean and smooth however tightly a limb bends.
  function body(g, l, grow) {
    const n = SAMPLES - 1, Q = 1.5; let s = 0;
    while (s < n) {
      const q = Math.round(l.sw[s] / Q); let e = s + 1;
      while (e < n && Math.round(l.sw[e] / Q) === q) e++;
      g.beginPath(); g.moveTo(l.sx[s], l.sy[s]); for (let i = s + 1; i <= e; i++) g.lineTo(l.sx[i], l.sy[i]);
      g.lineWidth = 2 * (q * Q + grow); g.stroke();
      s = e;
    }
  }
  function highlight(g, l) {
    const n = SAMPLES - 1; let run = 0;
    g.beginPath();
    for (let s = 0; s <= n; s++) {
      const up = ny[s] < 0 ? 1 : -1;
      const ok = Math.abs(ny[s]) >= 0.6 && (!s || nx[s] * nx[s - 1] + ny[s] * ny[s - 1] >= 0.96);
      if (!ok) { run = 0; continue; }
      const r = l.sw[s] - 8, X = l.sx[s] + nx[s] * up * r, Y = l.sy[s] + ny[s] * up * r;
      if (run) g.lineTo(X, Y); else g.moveTo(X, Y);
      run++;
    }
    g.stroke();
  }

  function picture(g, x, pal, yawn) {
    const W = x.W, H = x.H, fat = x.p('fat');
    const [ground, bottle, moss, pea, acid] = pal;
    g.globalAlpha = 1; g.fillStyle = css(ground); g.fillRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let o = 0; o < order.length; o++) {
      const l = order[o];
      sample(l, fat, yawn); normals(l);
      const c = l.f > 0.5 ? mix(moss, bottle, (l.f - 0.5) * 2) : mix(pea, moss, l.f * 2);
      g.strokeStyle = css(c, 0.5); body(g, l, 2.5);
      g.strokeStyle = css(c); body(g, l, 0);
      const rankUp = order.length > 1 ? o / (order.length - 1) : 1;
      if (rankUp > 0.6 && l.hl > 0.02) {
        g.globalAlpha = (0.12 + 0.38 * (rankUp - 0.6) / 0.4) * l.hl * (1 - 0.75 * l.f); g.strokeStyle = css(acid); g.lineWidth = 2.2; highlight(g, l); g.globalAlpha = 1;
      }
    }
    // the dimple's mark: a dull lit stretch lying along the top edge, where it was prodded
    g.strokeStyle = css(acid);
    for (const m of marks) {
      const l = m.l, f = Math.max(0, 1 - m.age / m.life), a = Math.max(0, m.k - 3), b = Math.min(SAMPLES - 1, m.k + 3);
      normals(l);
      g.globalAlpha = 0.95 * f; g.lineWidth = 2 + m.r * 0.16 * f;
      g.beginPath();
      for (let s = a; s <= b; s++) { const up = ny[s] < 0 ? 1 : -1, r = l.sw[s] - 2, X = l.sx[s] + nx[s] * up * r, Y = l.sy[s] + ny[s] * up * r; if (s === a) g.moveTo(X, Y); else g.lineTo(X, Y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  const limbIcon = (g, w, h, up, lw, col) => { g.save(); g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(4, h - 6); g.quadraticCurveTo(w * 0.55, h - 5, w - 6, h - 6 - up); g.stroke(); g.restore(); };

  TOOLS.push({
    id: 'lazy', name: 'Lazy', tag: 'new',
    blurb: 'It can\'t be bothered. A heap of fat, limp green limbs: a note asks one to get up, it twitches, gets a third of the way, gives up and flops over onto the others. Fast music makes it care less: most attacks only get a dull little dimple.',
    params: [
      { key: 'lazy', label: 'how lazy it is', min: 0, max: 1, value: 0.5,
        hint: 'How much it takes to get a limb moving. Left: gets up fairly readily. Right: takes forever and gives up early.',
        icon: (g, v, w, h) => limbIcon(g, w, h, 15 - 12 * v, 3.5, '#7c9a2f') },
      { key: 'lift', label: 'how high it bothers to lift', min: 0.1, max: 1, value: 0.75,
        hint: 'How far a limb gets before it gives up. Left: barely raises an end. Right: up to a third of the screen.',
        icon: (g, v, w, h) => limbIcon(g, w, h, 1 + 15 * v, 3.5, '#7c9a2f') },
      { key: 'fat', label: 'how fat the limbs are', min: 0.5, max: 1.7, value: 1,
        hint: 'How thick the limbs are. Left: slim. Right: huge, overlapping everything.',
        icon: (g, v, w, h) => limbIcon(g, w, h, 6, 1.5 + 9 * v, '#7c9a2f') },
      { key: 'limbs', label: 'how many limbs', min: 4, max: 18, step: 1, value: 12,
        hint: 'How many limbs lie in the heap. Left: a few. Right: a big heap.',
        icon: (g, v, w, h) => { const n = Math.round(1 + v * 5); for (let i = 0; i < n; i++) ICON.line(g, 4 + (i % 2) * 6, h - 4 - i * 3.4, w - 4 - ((i + 1) % 2) * 6, h - 5 - i * 3.4, i % 2 ? '#7c9a2f' : '#4f6b22', 2.6); } },
      { key: 'green', label: 'which green', min: 0, max: 1, value: 0.5,
        hint: 'Which greens it lies in. Left: a dark pond. Right: sour acid.',
        icon: (g, v, w, h) => ICON.palette(g, paletteAt(v).map((c) => css(c)), w, h) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: nearly dark and still, and only the hardest attacks of the piece get any effort. Right: all of it at full strength.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + 0.85 * v, () => limbIcon(g, w, h, 2 + 9 * v, 2 + 4 * v, '#7c9a2f')) },
    ],
    reset(x) { vels = null; built = 0; limbs = []; order = []; pend = []; marks = []; acc = 0; clock = 0; lastAttack = 0; gapUntil = 0; yawnT = -1; yawned = false; },
    onChord(ch, x) {
      const n0 = Math.round(x.p('limbs'));
      if (built !== n0) build(n0, x.W, x.H);
      lastAttack = clock; if (yawnT < 0) yawned = false;
      const pres = x.p('presence'), cut = (1 - pres) * 0.95, rate = x.feat.rate;
      const notes = ch.notes.slice().sort((a, b) => b.v - a.v);
      let asked = 0, dims = 0; const seen = new Set();
      for (const n of notes) {
        const v01 = rank(n.v);
        if (v01 < cut) continue;
        const pr = Math.max(0, Math.min(1, (n.m - pitchLo) / (pitchHi - pitchLo)));
        const l = limbs[Math.min(limbs.length - 1, Math.round(pr * (limbs.length - 1)))];
        if (asked < 3 && !seen.has(l)) {
          seen.add(l);
          if (asked === 0) { if (ask(l, n, v01, x, false)) { asked++; continue; } }
          else if (l.state === 'rest' && clock >= l.free) { asked++; pend.push({ l, n, v01, wait: x.rnd(0.02, 0.25) * (1 + 3 * rate) }); continue; }  // the others come raggedly, each late on its own
        }
        if (dims++ < 3) dimple(x.pitch01(n.m) * x.W * 0.9 + x.W * 0.05 + x.rnd(-30, 30), v01, x);
      }
    },
    frame(x) {
      const n0 = Math.round(x.p('limbs'));
      if (built !== n0) build(n0, x.W, x.H);
      const dt = x.dt;
      if (dt > 0) {
        for (const q of pend) { q.wait -= dt; if (q.wait <= 0) { ask(q.l, q.n, q.v01, x, true); q.done = true; } }
        pend = pend.filter((q) => !q.done);
        acc = Math.min(0.1, acc + dt);
        while (acc >= H_STEP) { acc -= H_STEP; clock += H_STEP; for (const l of limbs) advance(l, H_STEP, x); }
        for (const m of marks) m.age += dt;
        marks = marks.filter((m) => m.age < m.life);
        // after a long quiet the whole heap swells and subsides, once
        if (yawnT >= 0) { yawnT += dt; if (yawnT > 8) yawnT = -1; }
        else if (!yawned && clock - lastAttack > 5) { yawned = true; yawnT = 0; }
      }
      const yawn = yawnT >= 0 ? Math.pow(Math.sin(Math.PI * yawnT / 8), 2) : 0;
      const pal = paletteAt(x.p('green')), pres = x.p('presence');
      if (pres >= 0.999) { picture(x.g, x, pal, yawn); return; }
      // Quiet: the whole picture, heap and ground, at low opacity, so what lies under it shows and alone it stays near dark.
      lg.setTransform(1, 0, 0, 1, 0, 0);
      picture(lg, x, pal, yawn);
      const g = x.g; g.globalAlpha = 0.06 + 0.94 * pres * pres * pres; g.drawImage(lay, 0, 0); g.globalAlpha = 1;
    },
  });
})();
