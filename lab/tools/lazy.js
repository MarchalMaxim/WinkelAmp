// Lazy: it can't be bothered. Heavy, shapeless green stains lie slumped across the whole picture, seeping through each other.
// They have mass: the music pushes them and they barely notice. What lands on the attack is colour, a dull sour stain soaking
// in; the bodies only take the push, give a little over about a second and take several to come back. Busy music gets ignored:
// notes only feed one slow swell. Once in a long while a hard note asks a stain to get up: its loose end, thinning as it goes,
// gathers speed over seconds, gets a little way, hangs there and slumps onto its neighbours, which give under it just as slowly.
// Each mass is a chain: its base pinned, its free end pulled along a path by a soft spring while it is up (so nothing it does can
// start or stop at once), the rest following by gravity, heavy damping and length constraints, stepped in song seconds so
// nothing snaps at a low frame rate. Its flesh is a critically damped spring at every point, coupled along the chain. Its two
// edges swell unevenly and independently and taper to nothing at both ends, so it stays a form and never becomes an object.
(() => {
  const PTS = 12, SUB = 6, TAU = Math.PI * 2, SAMPLES = (PTS - 1) * SUB + 1, H_STEP = 1 / 60, G = 720, DAMP = 3.4;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const [lay, lg] = mk(1280, 720);
  // The stains are painted small and enlarged smoothly, so no edge is ever cut out and a tight bend can't show its workings.
  const K = 4, [wash, wg] = mk(320, 180);
  const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const css = (c, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // [ground, bottle, moss, pea, chartreuse] at the left end of the green knob, the middle (the default), and the right end.
  const GREENS = [
    ['#0a140d', '#0e2a1b', '#21401f', '#37582a', '#7d9a3a'],
    ['#1a3a20', '#1f5a30', '#4f8026', '#86ad30', '#c4d94a'],
    ['#2c5a1a', '#4d8a22', '#88a51e', '#b4c92a', '#e8f55a'],
  ].map((row) => row.map(hex));
  const paletteAt = (v) => { const k = v < 0.5 ? 0 : 1, t = v < 0.5 ? v * 2 : v * 2 - 1; return GREENS[k].map((c, i) => mix(c, GREENS[k + 1][i], t)); };
  // A fixed little generator, so one song always starts with the same heap, and each song with its own.
  const seeded = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  let limbs = [], order = [], marks = [], clock = 0, acc = 0, lastAttack = 0, gapUntil = 0, yawnT = -1, yawned = false, built = 0;
  let vels = null, pitchLo = 36, pitchHi = 84, flush = 0, swell = 0, swellT = 0, nextJolt = 0;

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
    let seed = 77; { const ns = window.NOTES || []; seed = (seed + ns.length * 31) >>> 0; for (let i = 0; i < Math.min(40, ns.length); i++) seed = (seed * 33 + ns[i][2]) >>> 0; }
    const R = seeded(seed); limbs = []; marks = [];
    const edge = () => {
      const f1 = 0.8 + R() * 0.9, f2 = 2 + R() * 1.6, f3 = 5 + R() * 4, p1 = R(), p2 = R(), p3 = R(), t = new Float32Array(SAMPLES);
      for (let s = 0; s < SAMPLES; s++) { const u = s / (SAMPLES - 1); t[s] = Math.max(0.45, 0.92 + 0.42 * Math.sin(TAU * (f1 * u + p1)) + 0.16 * Math.sin(TAU * (f2 * u + p2)) + 0.012 * Math.sin(TAU * (f3 * u + p3))); }
      return t;
    };
    const slots = []; for (let i = 0; i < n; i++) slots.push((i + 0.5) / n);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)), t = slots[i]; slots[i] = slots[j]; slots[j] = t; }
    for (let i = 0; i < n; i++) {
      const f = n > 1 ? 1 - i / (n - 1) : 0.5;                    // 1: the fattest, at the bottom; 0: thin, on top
      const w = 100 + 120 * Math.pow(f, 1.1), L = (380 + 380 * f) * (0.85 + 0.3 * R());
      const bx = W * (0.5 + (slots[i] - 0.5) * (1.05 + 0.2 * f));
      const side = bx < W * 0.3 ? 1 : bx > W * 0.7 ? -1 : (R() < 0.5 ? -1 : 1);
      const bulge = 0.45 + R() * 1.1, soft = 2 + R() * R() * 6;
      const l = { i, f, w, L, soft, bx, by: 0, W, Ht, side, A: 16 + R() * 24, fq: 0.012 + R() * 0.009, ph: R() * 6.28, off: (R() - 0.5) * 0.05, cx: (R() - 0.5) * 0.3, state: 'rest', free: 0, sink: 0, slide: 0, bulge, x: [], y: [], px: [], py: [], rx: [], ry: [], dy: [], seg: [], q: new Float32Array(PTS), qv: new Float32Array(PTS), fl: 0, na: edge(), nb: edge(),
        sx: new Float32Array(SAMPLES), sy: new Float32Array(SAMPLES), st: new Float32Array(SAMPLES), sb: new Float32Array(SAMPLES), mx: new Float32Array(SAMPLES), my: new Float32Array(SAMPLES), mr: new Float32Array(SAMPLES) };
      pose(l);
      for (let k = 0; k < PTS; k++) { l.x.push(l.rx[k]); l.y.push(l.ry[k]); l.px.push(l.rx[k]); l.py.push(l.ry[k]); }
      limbs.push(l);
    }
    order = limbs.slice();
    built = n;
  }
  // The shape it lies in, on its current side.
  // They lie all over the picture, from the very top down, the thinner ones higher: no mound, no horizon.
  function pose(l) {
    for (let k = 0; k < PTS; k++) {
      const u = k / (PTS - 1), X = l.bx + l.side * l.L * u, prof = 0.88 + 0.12 * Math.cos(Math.max(-1, Math.min(1, (X / l.W - 0.5 + l.cx) * 1.5)) * Math.PI);
      l.rx[k] = X; l.ry[k] = l.Ht * (0.96 + l.off - (1 - l.f) * 0.92 * prof + (1 - 0.6 * l.f) * 0.045 * (2 * u - 1) * (2 * u - 1)) + l.A * Math.sin(X * l.fq + l.ph);
    }
    l.by = l.ry[0];
    for (let k = 0; k < PTS - 1; k++) l.seg[k] = Math.hypot(l.rx[k + 1] - l.rx[k], l.ry[k + 1] - l.ry[k]);
  }

  // How much there is of it: fat ones are heavier, and the lazier the whole heap, the heavier everything.
  const massOf = (l, lazy) => (0.7 + 0.9 * l.f) * (0.55 + 0.9 * lazy);

  // A hard note asks this limb to get up. Returns false if it won't, which is usual.
  function ask(l, n, v01, x) {
    const rate = x.feat.rate, lazy = x.p('lazy'), pres = x.p('presence');
    if (l.state !== 'rest' || clock < l.free || clock < gapUntil) return false;
    if (v01 < 0.35 + 0.4 * lazy) return false;
    let up = 0; for (const o of limbs) if (o.state !== 'rest') up++;
    if (up >= (rate < 0.25 ? 2 : 1)) return false;
    if (x.rnd(0, 1) < Math.min(0.95, Math.max(0, rate * 1.15 - 0.05) + (lazy - 0.5) * 0.3)) return false;
    const liftH = 180 * x.p('lift') * (0.38 + 0.62 * (1 - l.f)) * (0.32 + 0.68 * Math.pow(v01, 1.3)) * (1 - 0.72 * rate) * (1.25 - 0.5 * lazy) * (0.35 + 0.65 * pres);
    const T = (3.2 + 3 * l.f) * (0.6 + 1.4 * lazy) * (1 + 0.6 * rate) * x.rnd(0.85, 1.15);
    const e = PTS - 1;
    l.state = 'lift'; l.lp = 0; l.T = T; l.sink *= 0.35;
    l.x0 = l.ex = l.x[e]; l.y0 = l.ey = l.y[e]; l.evx = l.evy = 0;
    l.ay = Math.max(l.Ht * 0.05, Math.min(l.y[e], l.by) - liftH);
    { const reach = l.L * x.rnd(0.72, 0.86), hh = Math.abs(l.ay - l.by); l.ax = l.bx + l.side * Math.sqrt(Math.max(l.L * l.L * 0.1, reach * reach - hh * hh)); }
    l.held = n.d > T * 1.1;
    l.until = clock + T + (l.held ? Math.min(3, n.d - T) : x.rnd(0.8, 2.2) * (1.3 - 0.6 * lazy));
    gapUntil = clock + (4 + 12 * lazy) * (1 + 1.5 * rate) * x.rnd(0.8, 1.3);
    return true;
  }

  // The least possible acknowledgement: a sour smear soaking into whichever mass is uppermost under this pitch. Colour only.
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
    if (marks.length > 22) marks.shift();
    marks.push({ l: best, k: idx * SUB, age: 0, life: 1.1 - 0.3 * rate, r: (50 + 70 * v01) * (1 - 0.3 * rate), a: 0.42 });
  }

  // It lands: every limb under it takes the weight as a push where it was hit, and gives slowly.
  function squash(l, x) {
    const at = order.indexOf(l), amt = (9 + 26 * l.f) * x.p('fat') * x.p('presence');
    for (let o = 0; o < at; o++) {
      const b = order[o];
      for (let k = 0; k < PTS; k++) for (let j = PTS - 1; j >= 0; j -= 2) {
        const d = Math.hypot(b.x[k] - l.x[j], b.y[k] - l.y[j]), reach = (b.w + l.w) * 0.5 * x.p('fat');
        if (d < reach) { b.qv[k] = Math.min(60, b.qv[k] + amt * (1 - d / reach) * 0.8); }
      }
    }
  }

  function advance(l, h, x) {
    const e = PTS - 1, lazy = x.p('lazy'), m = massOf(l, lazy);
    // the free end's path, which it is only pulled towards
    let led = false, tx = 0, ty = 0;
    if (l.state === 'lift') {
      l.lp = Math.min(1, l.lp + h / l.T);
      const q = l.lp * l.lp * (3 - 2 * l.lp);
      tx = l.x0 + (l.ax - l.x0) * q; ty = l.y0 + (l.ay - l.y0) * q; led = true;
      if (l.lp >= 1) { l.state = 'hang'; l.hx = tx; l.hy = ty; l.ht = 0; }
    } else if (l.state === 'hang') {
      l.ht += h;
      tx = l.hx + 4 * Math.sin(l.ht * 0.9); ty = l.hy + l.ht * (l.held ? 9 : 4); led = true;
      if (clock >= l.until) {
        // slumps back where it was, now and then over to the other side, unless that is off the screen
        const flip = x.rnd(0, 1) < 0.25, ts = l.bx - l.side * l.L, over = flip && ts > -70 && ts < x.W + 70;
        if (over) { l.side = -l.side; pose(l); }
        l.state = 'fall'; l.fp = 0; l.x0 = tx; l.y0 = ty; l.T = (1.8 + 1.6 * l.f) * (0.7 + 0.6 * lazy) * (over ? 1.8 : 1) * x.rnd(0.9, 1.25);
        order.splice(order.indexOf(l), 1); order.push(l);       // it comes down across its neighbours
        led = true;
      }
    } else if (l.state === 'fall') {
      l.fp = Math.min(1, l.fp + h / l.T);
      const p = l.fp, sx = p * p * (3 - 2 * p);
      tx = l.x0 + (l.rx[e] - l.x0) * sx; ty = l.y0 + (l.ry[e] + l.sink - l.y0) * Math.pow(p, 2.3) - 12 * Math.sin(Math.PI * p); led = true;
      if (p >= 1) {
        l.state = 'rest'; l.free = clock + (6 + 14 * lazy) * x.rnd(0.8, 1.3); l.slide = l.side * x.rnd(2, 8);
        squash(l, x);
      }
    }
    // settling: a limb that has come to rest sinks a little deeper and slides a few pixels, slower and slower
    l.sink += ((12 + 10 * l.f) - l.sink) * (1 - Math.exp(-h / 22));
    if (Math.abs(l.slide) > 0.02) {
      const d = l.slide * h; l.slide *= Math.exp(-h / 2.4);
      if (l.bx + d > -60 && l.bx + d < x.W + 60) { l.bx += d; for (let k = 0; k < PTS; k++) l.rx[k] += d; }
    }
    const busy = l.state !== 'rest'; l.hl = (l.hl === undefined ? 1 : l.hl) + ((busy ? 0 : 1) - (l.hl === undefined ? 1 : l.hl)) * (1 - Math.exp(-h / 1.5));
    const damp = Math.exp(-h * DAMP), pull = 1 - Math.exp(-h / ((busy ? 2.4 : 1.8) * Math.sqrt(m)));
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
    if (led) {
      const we = 1.5 / Math.sqrt(m);
      l.evx += ((tx - l.ex) * we * we - 2 * we * l.evx) * h; l.ex += l.evx * h;
      l.evy += ((ty - l.ey) * we * we - 2 * we * l.evy) * h; l.ey += l.evy * h;
      l.x[e] = l.ex; l.y[e] = l.ey;
    }
    for (let it = 0; it < 4; it++) {
      for (let k = 0; k < e; k++) {
        const dx = l.x[k + 1] - l.x[k], dy = l.y[k + 1] - l.y[k], d = Math.hypot(dx, dy) || 1, c = (d - l.seg[k]) / d * 0.5;
        const wa = k === 0 ? 0 : 1, wb = (led && k + 1 === e) ? 0 : 1, s = wa + wb; if (!s) continue;
        const ka = c * 2 * wa / s, kb = c * 2 * wb / s;
        l.x[k] += dx * ka; l.y[k] += dy * ka; l.x[k + 1] -= dx * kb; l.y[k + 1] -= dy * kb;
      }
      // no hairpins and no coils: a heavy thing can't fold flat or curl over itself into a knot
      for (let k = 0; k < e - 1; k++) {
        const dx = l.x[k + 2] - l.x[k], dy = l.y[k + 2] - l.y[k], d = Math.hypot(dx, dy) || 1, min = (l.seg[k] + l.seg[k + 1]) * 0.86;
        if (d < min) { const c = (d - min) / d * 0.5, wa = k === 0 ? 0 : 1, wb = (led && k + 2 === e) ? 0 : 1, s = wa + wb; if (s) { l.x[k] += dx * c * 2 * wa / s; l.y[k] += dy * c * 2 * wa / s; l.x[k + 2] -= dx * c * 2 * wb / s; l.y[k + 2] -= dy * c * 2 * wb / s; } }
      }
      for (let k = 0; k < e - 3; k++) {
        const dx = l.x[k + 4] - l.x[k], dy = l.y[k + 4] - l.y[k], d = Math.hypot(dx, dy) || 1, min = (l.seg[k] + l.seg[k + 1] + l.seg[k + 2] + l.seg[k + 3]) * 0.76;
        if (d < min) { const c = (d - min) / d * 0.5, wa = k === 0 ? 0 : 1, wb = (led && k + 4 === e) ? 0 : 1, t = wa + wb; if (t) { l.x[k] += dx * c * 2 * wa / t; l.y[k] += dy * c * 2 * wa / t; l.x[k + 4] -= dx * c * 2 * wb / t; l.y[k + 4] -= dy * c * 2 * wb / t; } }
      }
    }
    // its flesh: critically damped, so a push takes about a second to show and several to go, and it spreads along the limb
    const w = 1.25 / Math.sqrt(m), up = 0.55 + 0.9 * (1 - l.f), q = l.q, qv = l.qv;
    for (let k = 0; k < PTS; k++) {
      const lap = (k > 0 ? q[k - 1] : q[k]) + (k < e ? q[k + 1] : q[k]) - 2 * q[k];
      qv[k] += (((swell * up - q[k]) + 0.8 * lap) * w * w - 2 * w * qv[k]) * h;
    }
    for (let k = 0; k < PTS; k++) q[k] += qv[k] * h;
  }

  // The chain drawn smooth. Two independent uneven edges, tapering to nothing at both ends; what is hauled up thins as it goes.
  function sample(l, fat, yawn) {
    const e = PTS - 1; let s = 0;
    const X = (k) => l.x[Math.max(0, Math.min(e, k))], Y = (k) => { const q = Math.max(0, Math.min(e, k)); return l.y[q] + l.q[q] - yawn * 12; };
    const hl = l.hl === undefined ? 1 : l.hl;
    for (let k = 0; k < e; k++) {
      const x0 = X(k - 1), x1 = X(k), x2 = X(k + 1), x3 = X(k + 2), y0 = Y(k - 1), y1 = Y(k), y2 = Y(k + 1), y3 = Y(k + 2);
      for (let j = 0; j < (k === e - 1 ? SUB + 1 : SUB); j++) {
        const t = j / SUB, t2 = t * t, t3 = t2 * t;
        l.sx[s] = 0.5 * (2 * x1 + (x2 - x0) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (3 * x1 - x0 - 3 * x2 + x3) * t3);
        l.sy[s] = 0.5 * (2 * y1 + (y2 - y0) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (3 * y1 - y0 - 3 * y2 + y3) * t3);
        const u = (k + t) / e, q1 = Math.min(e, k + 1), qq = l.q[k] + (l.q[q1] - l.q[k]) * t;
        const env = Math.pow(Math.sin(Math.PI * Math.pow(u, l.bulge)), 0.36), thin = 1 - (1 - hl) * 0.5 * u;
        const base = 0.5 * l.w * fat * env * thin * (1 + qq * 0.008) * (1 + yawn * 0.12);
        l.st[s] = base * l.na[s];
        l.sb[s] = base * l.nb[s];
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
      const r = (l.st[s] + l.sb[s]) * 0.5, off = (l.st[s] - l.sb[s]) * 0.5;
      l.mx[s] = l.sx[s] + nx[s] * off; l.my[s] = l.sy[s] + ny[s] * off; l.mr[s] = r;
    }
  }
  // What faces the floor bellies out and what faces up goes slack: everything in it hangs. Once per sampling.
  function hang(l) {
    for (let s = 0; s < SAMPLES; s++) { l.st[s] *= 1 + (ny[s] > 0 ? 0.42 : 0.26) * ny[s]; l.sb[s] *= 1 - (ny[s] < 0 ? 0.42 : 0.26) * ny[s]; }
    normals(l);
  }
  // A mass bent gently is one outline, which is cheap. One bent tighter than its own thickness would turn an outline inside
  // out, so it is traced as a run of overlapping discs on its middle line: the same width, and no holes or notches.
  function bentTight(l) {
    for (let s = 1; s < SAMPLES; s++) {
      const ds = Math.hypot(l.sx[s] - l.sx[s - 1], l.sy[s] - l.sy[s - 1]), turn = Math.abs(nx[s] * ny[s - 1] - ny[s] * nx[s - 1]);
      if (turn * (Math.max(l.st[s], l.sb[s]) + 16) > ds * 0.9) return true;
    }
    return false;
  }
  function trace(g, l, tight) {
    const n = SAMPLES - 1;
    g.beginPath();
    if (!tight) {
      for (let s = 0; s <= n; s++) { const r = l.st[s], X = l.sx[s] + nx[s] * r, Y = l.sy[s] + ny[s] * r; if (s) g.lineTo(X, Y); else g.moveTo(X, Y); }
      for (let s = n; s >= 0; s--) { const r = l.sb[s]; g.lineTo(l.sx[s] - nx[s] * r, l.sy[s] - ny[s] * r); }
    } else {
      for (let s = 0; s <= n; s++) if (l.mr[s] > 0.5) { g.moveTo(l.mx[s] + l.mr[s], l.my[s]); g.arc(l.mx[s], l.my[s], l.mr[s], 0, TAU); }
    }
  }

  // An attack only pushes the heap: most under its pitch, thin masses most, the fat ones hardly at all.
  function shove(px, a, lazy) {
    for (const l of limbs) {
      const m = massOf(l, lazy), up = 0.55 + 0.9 * (1 - l.f);
      for (let k = 0; k < PTS; k++) {
        const d = (l.x[k] - px) / 340;
        l.qv[k] = Math.min(60, l.qv[k] + (42 * a * up / m) * (0.25 + 0.75 * Math.exp(-d * d)));
      }
    }
  }

  function picture(g, x, pal, yawn) {
    const W = x.W, H = x.H, fat = x.p('fat');
    const [ground, bottle, moss, pea, acid] = pal;
    g.globalAlpha = 1; g.fillStyle = css(ground); g.fillRect(0, 0, W, H);
    const w = wg;
    w.setTransform(1, 0, 0, 1, 0, 0); w.clearRect(0, 0, wash.width, wash.height); w.setTransform(1 / K, 0, 0, 1 / K, 0, 0);
    for (let o = 0; o < order.length; o++) {
      const l = order[o];
      sample(l, fat, yawn); normals(l); hang(l);
      const c = l.f > 0.5 ? mix(moss, bottle, (l.f - 0.5) * 2) : mix(pea, moss, l.f * 2);
      l.tight = bentTight(l);
      w.filter = `blur(${l.soft}px)`; w.globalAlpha = 0.42 + 0.2 * l.f; w.fillStyle = css(mix(c, acid, 0.34 * l.fl), 1 + 0.06 * flush);
      trace(w, l, l.tight); w.fill();
    }
    w.filter = 'blur(2px)';
    // the smear: the stain itself goes sour for a moment, soaking out from one spot and stopping at its own edges
    for (const m of marks) {
      const l = m.l, f = Math.max(0, 1 - m.age / m.life), X = l.sx[m.k], Y = l.sy[m.k], r = Math.max(8, m.r);
      const gr = w.createRadialGradient(X, Y, 0, X, Y, r);
      gr.addColorStop(0, `rgba(${acid[0] | 0},${acid[1] | 0},${acid[2] | 0},${m.a * f})`); gr.addColorStop(1, `rgba(${acid[0] | 0},${acid[1] | 0},${acid[2] | 0},0)`);
      normals(l);
      w.save(); trace(w, l, l.tight); w.clip(); w.globalAlpha = 1; w.fillStyle = gr; w.fillRect(X - r, Y - r, r * 2, r * 2); w.restore();
    }
    w.filter = 'none'; w.globalAlpha = 1;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(wash, 0, 0, W, H);
    g.imageSmoothingQuality = 'low';
  }

  const limbIcon = (g, w, h, up, lw, col) => { g.save(); g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(4, h - 6); g.quadraticCurveTo(w * 0.55, h - 5, w - 6, h - 6 - up); g.stroke(); g.restore(); };

  TOOLS.push({
    id: 'lazy', name: 'Lazy', tag: 'new',
    blurb: 'It can\'t be bothered, and there is a lot of it. Huge, shapeless green stains slumped across the picture, far too heavy for the music to move: an attack soaks in as a dull sour colour and only leans on them a little, and they take seconds to come back. Once in a long while a hard note asks one to get up. It gathers itself slowly, gets a little way, gives up and slumps onto the others. Busy music it ignores, swelling slowly.',
    params: [
      { key: 'lazy', label: 'how lazy it is', min: 0, max: 1, value: 0.5,
        hint: 'How heavy it is, and how much it takes to get it moving. Left: lighter, and gets up now and then. Right: a dead weight that hardly ever stirs.',
        icon: (g, v, w, h) => limbIcon(g, w, h, 15 - 12 * v, 3.5, '#7c9a2f') },
      { key: 'lift', label: 'how high it bothers to lift', min: 0.1, max: 1, value: 0.75, less: 0.3,
        hint: 'How far a mass gets before it gives up. Left: barely raises an end. Right: up to a third of the screen.',
        icon: (g, v, w, h) => limbIcon(g, w, h, 1 + 15 * v, 3.5, '#7c9a2f') },
      { key: 'fat', label: 'how fat the masses are', min: 0.5, max: 1.7, value: 1, less: 0.6,
        hint: 'How thick the stains are. Left: slim. Right: huge, overlapping everything.',
        icon: (g, v, w, h) => limbIcon(g, w, h, 6, 1.5 + 9 * v, '#7c9a2f') },
      { key: 'limbs', label: 'how many masses', min: 4, max: 15, step: 1, value: 12, less: 4,
        hint: 'How many masses lie in the heap. Left: a few. Right: a big heap.',
        icon: (g, v, w, h) => { const n = Math.round(1 + v * 5); for (let i = 0; i < n; i++) ICON.line(g, 4 + (i % 2) * 6, h - 4 - i * 3.4, w - 4 - ((i + 1) % 2) * 6, h - 5 - i * 3.4, i % 2 ? '#7c9a2f' : '#4f6b22', 2.6); } },
      { key: 'green', label: 'which green', min: 0, max: 1, value: 0.5,
        hint: 'Which greens it lies in. Left: a dark pond. Right: sour acid.',
        icon: (g, v, w, h) => ICON.palette(g, paletteAt(v).map((c) => css(c)), w, h) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much green lies there: how many masses, how fat they are, how high one bothers to lift. Left: a few slim masses that barely stir. Right: the whole slumped heap. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset(x) { vels = null; built = 0; limbs = []; order = []; marks = []; flush = 0; swell = 0; swellT = 0; nextJolt = 0; acc = 0; clock = 0; lastAttack = 0; gapUntil = 0; yawnT = -1; yawned = false; },
    onChord(ch, x) {
      const n0 = Math.round(x.p('limbs'));
      if (built !== n0) build(n0, x.W, x.H);
      lastAttack = clock; if (yawnT < 0) yawned = false;
      const pres = x.p('presence'), cut = (1 - pres) * 0.95, rate = x.feat.rate;
      const notes = ch.notes.slice().sort((a, b) => b.v - a.v);
      let jolt = false;
      if (notes.length && rank(notes[0].v) >= cut) {
        // The push, if it has the patience: not while it is still getting over the last one, unless the note is one of the
        // piece's hard ones. Anything it ignores only feeds one slow swell. The colour lands in this very frame; the bodies don't.
        const v = rank(notes[0].v), a = (0.35 + 0.65 * Math.pow(v, 1.2)) * (1 - 0.4 * rate) * (0.3 + 0.7 * pres);
        const pr = Math.max(0, Math.min(1, (notes[0].m - pitchLo) / (pitchHi - pitchLo)));
        jolt = clock >= nextJolt || (v >= 0.85 && clock >= nextJolt - 0.3);
        if (jolt) {
          nextJolt = clock + (0.9 + 1.6 * rate) * (0.6 + 0.8 * x.p('lazy')) * x.rnd(0.8, 1.3);
          shove(pr * x.W, a, x.p('lazy'));
          flush = Math.min(1, flush + 0.7 * a);
          const lm = limbs[Math.min(limbs.length - 1, Math.round(pr * (limbs.length - 1)))]; lm.fl = Math.min(1, lm.fl + 1.1 * a);
          ask(limbs[Math.min(limbs.length - 1, Math.round(pr * (limbs.length - 1)))], notes[0], v, x);
          for (const n of notes.slice(0, 2)) dimple(x.pitch01(n.m) * x.W * 0.9 + x.W * 0.05 + x.rnd(-30, 30), rank(n.v), x);
        } else swellT = Math.min(30, swellT + 2.2 * a);
      }
    },
    frame(x) {
      const n0 = Math.round(x.p('limbs'));
      if (built !== n0) build(n0, x.W, x.H);
      const dt = x.dt;
      if (dt > 0) {
        acc = Math.min(0.1, acc + dt);
        while (acc >= H_STEP) { acc -= H_STEP; clock += H_STEP; for (const l of limbs) advance(l, H_STEP, x); }
        for (const m of marks) m.age += dt;
        flush *= Math.exp(-dt / 0.28);
        swellT *= Math.exp(-dt / 2.5); swell += (swellT - swell) * (1 - Math.exp(-dt / 1.6));
        for (const l of limbs) l.fl *= Math.exp(-dt / 0.45);
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
