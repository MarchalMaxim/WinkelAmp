// Duet: two soft bodies with a relationship, one round and full, one sharp and spiked. Every attack gets a verdict from
// the harmony in the same frame: consonant against what is sounding, a lunge together; dissonant, a recoil. Each body is
// one closed contour of spring nodes around a moving centre. Low notes move the round one, high notes the sharp one.
// The sharp one is not spokes round a hub: it is an uneven splinter, cut anew at every clash, with its points bunched on
// one or two sides and bare edge elsewhere, so a clash makes it less orderly and the silhouette never settles.
// Where they overlap the two colours run into each other, and only the places where the edges cross burn hot.
(() => {
  const N = 72, TAU = Math.PI * 2;
  const PAIRS = [
    { a: [255, 74, 28], b: [31, 107, 255], seam: [206, 84, 245] },    // vermilion, cobalt
    { a: [255, 40, 150], b: [170, 240, 40], seam: [255, 215, 110] },   // magenta, lime
    { a: [245, 180, 40], b: [20, 170, 170], seam: [150, 235, 110] },   // gold, teal
  ];
  const rgb = (c, k = 0) => `rgb(${c.map((v) => Math.round(v + (255 - v) * k)).join(',')})`;
  const rgba = (c, a) => `rgba(${c.join(',')},${a})`;
  const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const gau = (d, w) => Math.exp(-(d * d) / (w * w));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Interval classes mod 12. A clash is heard over any number of consonances, so the harsh ones weigh more than one vote.
  const CONS = [0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0], DISS = [0, 2, 1.5, 0, 0, 0, 1.5, 0, 0, 0, 0.6, 2];

  const halo = document.createElement('canvas'); halo.width = halo.height = 128;
  const haloB = document.createElement('canvas'); haloB.width = haloB.height = 128;
  let haloPair = -1;
  function paintHalos(p) {
    for (const [cv, col] of [[halo, p.a], [haloB, p.b]]) {
      const h = cv.getContext('2d'); h.clearRect(0, 0, 128, 128);
      const gr = h.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, rgba(col, 0.32)); gr.addColorStop(0.45, rgba(col, 0.16)); gr.addColorStop(1, rgba(col, 0));
      h.fillStyle = gr; h.fillRect(0, 0, 128, 128);
    }
  }
  let time = 0;
  // The life inside a body: a tiling ink field, dark pools with pale lines along their shores. Filled through the contour.
  let inkDark = null, inkPale = null;
  function buildInk(g) {
    const S = 256, a = document.createElement('canvas'), b = document.createElement('canvas'); a.width = a.height = b.width = b.height = S;
    const grid = (n) => Float32Array.from({ length: n * n }, () => Math.random());
    const G = [[4, grid(4), 1], [8, grid(8), 0.5], [16, grid(16), 0.1]], W = [[3, grid(3)], [5, grid(5)]];
    const sm = (t) => t * t * (3 - 2 * t);
    const noise = (n, v, u, w) => {
      const x = u * n, y = w * n, i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
      const at = (p, q) => v[(((q % n) + n) % n) * n + (((p % n) + n) % n)];
      return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
    };
    const ga = a.getContext('2d'), gb = b.getContext('2d'), ia = ga.createImageData(S, S), ib = gb.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u0 = x / S, w0 = y / S, u = u0 + 0.16 * (noise(W[0][0], W[0][1], u0, w0) - 0.5), w = w0 + 0.16 * (noise(W[1][0], W[1][1], u0, w0) - 0.5);
      let f = 0; for (const [n, v, k] of G) f += k * noise(n, v, u, w);
      f /= 1.6;
      const pool = clamp((f - 0.45) / 0.17, 0, 1), rim = gau(f - 0.585, 0.012), k = (y * S + x) * 4;
      ia.data[k + 3] = 255 * Math.min(1, 0.5 * pool * pool * (3 - 2 * pool) + 0.14 * rim);   // a wash that deepens with no edge, and a faint tide line in it
      ib.data[k] = ib.data[k + 1] = ib.data[k + 2] = 255;
      ib.data[k + 3] = 255 * 0.3 * gau(f - 0.42, 0.007);                         // a pale shoreline further out
    }
    ga.putImageData(ia, 0, 0); gb.putImageData(ib, 0, 0);
    inkDark = g.createPattern(a, 'repeat'); inkPale = g.createPattern(b, 'repeat');
  }
  // One uneven splinter in node coordinates (unit radius): a few irregular corners stretched along an axis, then thorns bunched
  // along one or two of its edges, the rest left bare. face: the angle in body terms the first cluster sits at (null for any).
  function cut(f, face, wild, tau, rnd) {
    const K = 4 + Math.floor(rnd() * 3), gaps = []; let sum = 0;
    for (let i = 0; i < K; i++) { const q = rnd() * rnd() + 0.1; gaps.push(q); sum += q; }
    const ax = rnd() * TAU, st = 0.2 + 0.35 * rnd(), c = Math.cos(ax), n0 = Math.sin(ax);
    let an = rnd() * TAU; const C = [];
    for (let i = 0; i < K; i++) {
      an += gaps[i] / sum * TAU;
      const r = rnd() < 0.25 ? 0.34 + 0.14 * rnd() : 0.78 + 0.5 * rnd(), x0 = Math.cos(an) * r, y0 = Math.sin(an) * r;
      const u = (x0 * c + y0 * n0) * (1 + st), v = (-x0 * n0 + y0 * c) * (1 - st * 0.7);
      C.push([u * c - v * n0, u * n0 + v * c]);
    }
    let main = Math.floor(rnd() * K), bestD = 9;
    if (face !== null) for (let i = 0; i < K; i++) {
      const p = C[i], q = C[(i + 1) % K], d = Math.abs(wrap(Math.atan2(p[1] + q[1], p[0] + q[0]) - face));
      if (d < bestD) { bestD = d; main = i; }
    }
    const second = rnd() < 0.3 + 0.5 * wild ? (main + 1 + Math.floor(rnd() * (K - 1))) % K : -1;
    const V = [];
    for (let i = 0; i < K; i++) {
      const p = C[i], q = C[(i + 1) % K]; V.push([p[0], p[1], 0.55]);
      if (i !== main && i !== second) continue;
      let ex = q[0] - p[0], ey = q[1] - p[1]; const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el;
      let nx = ey, ny = -ex; if (nx * (p[0] + q[0]) + ny * (p[1] + q[1]) < 0) { nx = -nx; ny = -ny; }
      const m = 2 + Math.floor(rnd() * (2.2 + wild * 3)), wide = 0.3 + 0.45 * rnd(), t0 = 0.1 + (0.8 - wide) * rnd(), lean = (rnd() * 2 - 1) * 0.9, hero = Math.floor(rnd() * m);
      for (let j = 0; j < m; j++) {
        const a0 = t0 + wide * (j + 0.12 * rnd()) / m, a1 = t0 + wide * (j + 1) / m, mid = (a0 + a1) / 2;
        let l = 0.14 + 0.42 * rnd() * rnd() + wild * 0.4 * rnd(); if (j === hero) l = l * 1.25 + 0.2;
        V.push([p[0] + ex * el * a0, p[1] + ey * el * a0, 0]);
        V.push([p[0] + ex * (el * mid + lean * l) + nx * l, p[1] + ey * (el * mid + lean * l) + ny * l, 1]);
        V.push([p[0] + ex * el * a1, p[1] + ey * el * a1, 0]);
      }
    }
    // the first node stays near angle 0, so a re-cut crumples the old outline into the new one and does not turn it inside out
    let first = 0, bd = 9;
    for (let i = 0; i < V.length; i++) { const d = Math.abs(Math.atan2(V[i][1], V[i][0])); if (V[i][2] && d < bd) { bd = d; first = i; } }
    const L = V.length, len = V.map((p, i) => { const q = V[(i + 1) % L]; return Math.hypot(q[0] - p[0], q[1] - p[1]); }), tot = len.reduce((p, q) => p + q, 0) || 1;
    let at = 0, acc = 0; f.tw.fill(0);
    for (let i = 0; i < L; i++) {
      const k = (first + i) % L, p = V[k], q = V[(k + 1) % L]; acc += (N - L) * len[k] / tot;
      let extra = Math.floor(acc + 1e-6); acc -= extra; if (i === L - 1) extra = N - at - 1;
      if (p[2]) for (let e = -3; e <= 3; e++) { const w = (at + e + N) % N; f.tw[w] = Math.max(f.tw[w], p[2] * (1 - Math.abs(e) / 4)); }
      for (let e = 0; e <= extra && at < N; e++, at++) { const t = e / (extra + 1); f.tx[at] = p[0] + (q[0] - p[0]) * t; f.ty[at] = p[1] + (q[1] - p[1]) * t; }
    }
    for (let i = 0; i < N; i++) f.jag[i] = (rnd() * 2 - 1) * (1 - f.tw[i]);
    f.tau = tau; f.reach = -1; f.lastCut = time;
  }
  const newForm = (round) => {
    const f = {
      round, x: 0, y: 0, vx: 0, vy: 0, lx: 0, ly: 0, rot: Math.random() * TAU, d: new Float32Array(N), v: new Float32Array(N), T: new Float32Array(N),
      px: new Float32Array(N), py: new Float32Array(N), wa: Math.random() * TAU, wb: Math.random() * TAU, ang: new Float32Array(N),
      tx: new Float32Array(N), ty: new Float32Array(N), ox: new Float32Array(N), oy: new Float32Array(N), tw: new Float32Array(N), jag: new Float32Array(N), boost: new Float32Array(N), barb: new Float32Array(N),
      tau: 1, reach: -1, lastCut: -9, nextCut: 5 + Math.random() * 4, ia: Math.random() * 256, ib: Math.random() * 256, iv: 0, wv: 0,
      tongues: [], lit: 0, swell: 0, swellTo: 0, swellEnd: 0, ghosts: [], lastGhost: 0, path: null,
    };
    if (round) {
      // what it catches from the other: a few points bunched on one side, never evenly round it
      const at = Math.floor(Math.random() * N);
      for (const e of [0, 3, 5, 9, 15]) { const i = (at + e) % N, h = 0.14 + 0.28 * Math.random(); f.barb[i] = h; f.barb[(i + 1) % N] = Math.max(f.barb[(i + 1) % N], h * 0.15); f.barb[(i + N - 1) % N] = Math.max(f.barb[(i + N - 1) % N], h * 0.15); }
      for (let i = 0; i < N; i++) f.ang[i] = i / N * TAU;
    } else {
      cut(f, null, 0, 1, Math.random); f.ox.set(f.tx); f.oy.set(f.ty);
      for (let i = 0; i < N; i++) f.ang[i] = Math.atan2(f.oy[i], f.ox[i]);
    }
    return f;
  };
  let A = newForm(true), B = newForm(false), ready = false;
  let lastCons = true, mood = 0.3, lean = 0, bristle = 0, ripple = 0, infl = 0, quiet = 9, spin = 1, holdEnd = 0, flash = 0, vels = null;

  // how present: only the piece's hardest attacks move them as it goes down (as in Rorschach)
  const hardEnough = (v, x) => {
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((p, q) => p - q);
    const cut = (1 - x.p('presence')) * 0.95;
    if (cut <= 0 || !vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= cut;
  };
  // The verdict: this attack's notes against everything sounding, by interval class. +1 all consonant, -1 all dissonant.
  function verdict(ch, x) {
    let c = 0, d = 0; const snd = x.sounding();
    for (const n of ch.notes) for (const s of snd) {
      const iv = Math.abs(n.m - s.m) % 12;
      c += CONS[iv]; d += DISS[iv];
    }
    return c + d ? (c - d) / (c + d) : (lastCons ? 0.2 : -0.2);                       // a bare note carries the last verdict on
  }
  const radA = (R) => R, radB = (R) => R * 0.86;

  // The node that best answers a direction: near it, and a point rather than bare edge.
  function nearest(f, dir) {
    let best = 0, bs = -1;
    for (let i = 0; i < N; i++) { const s = gau(wrap(f.ang[i] + f.rot - dir), 0.55) * (0.3 + f.tw[i]); if (s > bs) { bs = s; best = i; } }
    return best;
  }
  const needle = (i, node) => { const e = Math.abs(i - node), dn = Math.min(e, N - e); return dn < 4 ? Math.pow(1 - dn / 4, 1.3) : 0; };

  // One body's answer: consonant, tongues (or lengthening points) and a lunge; dissonant, a dent, bristles and a recoil.
  function answer(f, o, cons, power, count, hold, x, motion) {
    const dx = o.x - f.x, dy = o.y - f.y, D = Math.hypot(dx, dy) || 1, nx = dx / D, ny = dy / D, phi = Math.atan2(dy, dx);
    const R = x.p('size') * 92, sign = cons ? 1 : -1;
    const dense = 1 / (1 + 2.2 * x.feat.rate);
    const J = (cons ? x.p('pull') * (150 + 620 * power) : x.p('push') * (190 + 820 * power)) * (0.35 + 0.65 * dense) * motion;
    f.vx += nx * J * sign; f.vy += ny * J * sign;
    f.x += nx * sign * J * 0.012; f.y += ny * sign * J * 0.012;                       // seen in the attack's own frame
    f.lit = Math.max(f.lit, 0.35 + 0.65 * power);
    const k = Math.min(9, count);
    f.iv += (cons ? 1 : -1.6) * (30 + 90 * power) * motion; f.wv += (cons ? 0.3 : -0.5) * power * motion;   // the ink inside lurches too
    if (cons) {
      for (let i = 0; i < k; i++) {
        const off = k === 1 ? x.rnd(-0.1, 0.1) : (i - (k - 1) / 2) * (f.round ? 0.42 : 0.5) + x.rnd(-0.06, 0.06);
        const amp = R * (0.45 + 1.0 * power) * (1 - 0.1 * Math.abs(i - (k - 1) / 2)) * motion;
        f.tongues.push({ off, w: f.round ? 0.2 : 0.34, amp, age: 0, life: Math.max(0.55, Math.min(3, hold)), node: f.round ? -1 : nearest(f, phi + off) });
      }
      if (f.tongues.length > 7) f.tongues.splice(0, f.tongues.length - 7);
    } else {
      // a whole bristling side: the points that face the other stand out at once, and a round skin shudders
      if (f.round) ripple = Math.min(1.6, ripple + (0.45 + 0.5 * power + 0.1 * k) * motion);
      else for (let i = 0; i < N; i++) {
        if (Math.abs(wrap(f.ang[i] + f.rot - phi)) < 1.25) f.boost[i] = Math.max(f.boost[i], f.tw[i] * (0.2 + 0.42 * power) * (0.7 + 0.1 * k) * motion);
      }
    }
    // the skin answers at once
    for (let i = 0; i < N; i++) {
      const dp = wrap(f.ang[i] + f.rot - phi);
      f.d[i] += sign * R * (cons ? 0.18 : 0.26) * power * gau(dp, 0.5) * motion;
      f.v[i] += sign * R * 2.4 * power * gau(dp, 0.7) * motion - sign * R * 1.2 * power * gau(wrap(dp - Math.PI), 0.9) * motion;
    }
    if (hold > 0.6) { f.swellTo = Math.min(1, 0.35 + hold * 0.3); f.swellEnd = time + Math.min(4, hold); }
    if (time - f.lastGhost > 0.16 && f.path) {
      f.lastGhost = time; f.ghosts.push({ path: f.path, age: 0 });
      if (f.ghosts.length > 7) f.ghosts.shift();
    }
  }

  function targets(f, o, x, R) {
    const dx = o.x - f.x, dy = o.y - f.y, D = Math.hypot(dx, dy) || 1, phi = Math.atan2(dy, dx);
    const p = Math.max(0, mood), q = Math.max(0, -mood);
    const gap = D - radA(R) - radB(R);
    // the held tongue: reaches to just short of meeting its opposite number, and trembles the longer the silence lasts
    const still = Math.min(1, quiet / 1.8);
    const hold = clamp(gap * 0.5 - 3, 0, R * 1.5) * clamp(p / 0.2, 0, 1);
    const shiver = still * (1.8 * Math.sin(time * 37 + (f.round ? 0 : 2)) + 1.3 * Math.sin(time * 53 + (f.round ? 1 : 0)));
    // the sharp one reaches only with one point, so a reach is a needle and never a stem
    if (!f.round && (f.reach < 0 || Math.abs(wrap(f.ang[f.reach] + f.rot - phi)) > 0.7)) f.reach = nearest(f, phi);
    const held = hold > 1 ? hold + shiver : 0;
    for (let i = 0; i < N; i++) {
      const dp = wrap(f.ang[i] + f.rot - phi);
      let T = f.round ? held * gau(dp, 0.27) : held * 1.15 * needle(i, f.reach);
      for (const t of f.tongues) {
        const e = 1 - t.age / t.life;
        if (e > 0) T += t.amp * Math.min(1, e * 2.2) * (f.round ? gau(wrap(dp - t.off), t.w) : 1.15 * needle(i, t.node));
      }
      T -= R * 0.17 * p * gau(wrap(dp - Math.PI), 1.0);                                // the far side flattens
      T -= R * (f.round ? 0.6 : 0.34) * q * gau(dp, 0.8);                              // the facing side dents away
      if (f.round && ripple > 0.01) T += ripple * R * 0.13 * Math.sin(i / N * TAU * 11 - time * 19) * Math.max(0, Math.sin(i / N * TAU * 2 + f.wa + time * 0.9));   // one side shudders, not a frill all round
      f.T[i] = T;
    }
  }
  function nodes(f, h) {
    const d = f.d, v = f.v, T = f.T;
    for (let i = 0; i < N; i++) {
      const l = d[(i + N - 1) % N], r = d[(i + 1) % N];
      v[i] += (-130 * (d[i] - T[i]) - 11 * v[i] + 260 * (l + r - 2 * d[i])) * h;
    }
    for (let i = 0; i < N; i++) d[i] += v[i] * h;
  }
  // The contour this frame: a slowly changing rest shape, plus the springs. All the nodes gather toward the other when they want it.
  function contour(f, o, R) {
    const phi = Math.atan2(o.y - f.y, o.x - f.x);
    const sw = 1 + 0.3 * f.swell;
    for (let i = 0; i < N; i++) {
      if (f.round) {
        const th0 = i / N * TAU + f.rot;
        const r = 1 + 0.13 * Math.sin(3 * th0 + time * 0.31) + 0.07 * Math.sin(5 * th0 - time * 0.23 + 1) + infl * f.barb[i];   // it has caught some points from the other
        const th = th0 + lean * 0.55 * Math.sin(wrap(phi - th0)), rho = Math.max(R * 0.12, R * sw * r + f.d[i]);
        f.px[i] = f.x + Math.cos(th) * rho; f.py[i] = f.y + Math.sin(th) * rho;
        continue;
      }
      let ox = f.ox[i], oy = f.oy[i];
      if (infl > 0.02) {                                                               // its corners soften after touching
        let sx = 0, sy = 0; for (let e = -3; e <= 3; e++) { const w = (i + e + N) % N; sx += f.ox[w]; sy += f.oy[w]; }
        const k = infl * 0.6; ox += (sx / 7 - ox) * k; oy += (sy / 7 - oy) * k;
      }
      const a = Math.atan2(oy, ox), m = Math.hypot(ox, oy), abs = a + f.rot;
      // it breathes unevenly at rest; a clash stands its points out and breaks its bare edges
      const r = m * (1 + 0.06 * Math.sin(2 * a + time * 0.43 + f.wa) + 0.04 * Math.sin(3 * a - time * 0.29 + f.wb)) * (1 + bristle * 0.4 * f.tw[i] + f.boost[i]) + bristle * 0.17 * f.jag[i];
      const th = abs + lean * 0.55 * Math.sin(wrap(phi - abs)), rho = Math.max(R * 0.12, R * sw * r + f.d[i]);
      f.px[i] = f.x + Math.cos(th) * rho; f.py[i] = f.y + Math.sin(th) * rho;
    }
    const p = new Path2D();
    if (f.round) {                                                                    // soft: midpoints, quadratics
      p.moveTo((f.px[N - 1] + f.px[0]) / 2, (f.py[N - 1] + f.py[0]) / 2);
      for (let i = 0; i < N; i++) {
        const k = (i + 1) % N;
        p.quadraticCurveTo(f.px[i], f.py[i], (f.px[i] + f.px[k]) / 2, (f.py[i] + f.py[k]) / 2);
      }
    } else {                                                                          // hard: straight segments
      p.moveTo(f.px[0], f.py[0]);
      for (let i = 1; i < N; i++) p.lineTo(f.px[i], f.py[i]);
    }
    p.closePath();
    f.path = p;
  }
  function sim(h, x) {
    const W = x.W, H = x.H, R = x.p('size') * 92, pull = x.p('pull'), push = x.p('push');
    const dx = B.x - A.x, dy = B.y - A.y, D = Math.hypot(dx, dy) || 1, nx = dx / D, ny = dy / D;
    const S = radA(R) * (1 + 0.3 * A.swell) + radB(R) * (1 + 0.3 * B.swell);
    const m0 = 0.32 * Math.min(1, pull);
    const hold = S + 26 + Math.max(0, 1 - pull) * 240;
    const far = Math.min(W * 0.72, S + push * 430);
    const want = mood >= m0 ? hold + (S * 0.66 - hold) * (mood - m0) / (1 - m0 + 1e-3) : hold + (far - hold) * (m0 - mood) / (1 + m0);
    const k = D > want ? 3.2 + 3.2 * Math.min(1.5, pull) : 11;
    let F = k * (D - want);
    if (D < S * 0.38) F -= 1400 * (1 - D / (S * 0.38));                                // never quite one body
    const swirl = spin * (20 + 70 * x.feat.level + 60 * Math.max(0, mood));
    const ax = nx * F - ny * swirl, ay = ny * F + nx * swirl;
    A.vx += ax * h; A.vy += ay * h; B.vx -= ax * h; B.vy -= ay * h;
    const mx = (A.x + B.x) / 2 - W / 2, my = (A.y + B.y) / 2 - H / 2;
    for (const f of [A, B]) {
      f.vx -= mx * 1.1 * h; f.vy -= my * 1.6 * h;
      const pad = R * 1.2;
      if (f.x < pad) f.vx += (pad - f.x) * 26 * h; if (f.x > W - pad) f.vx -= (f.x - W + pad) * 26 * h;
      if (f.y < pad) f.vy += (pad - f.y) * 26 * h; if (f.y > H - pad) f.vy -= (f.y - H + pad) * 26 * h;
      const damp = Math.exp(-2.1 * h); f.vx *= damp; f.vy *= damp;
      const sp = Math.hypot(f.vx, f.vy); if (sp > 1500) { f.vx *= 1500 / sp; f.vy *= 1500 / sp; }
      f.x = clamp(f.x + f.vx * h, R * 1.1, W - R * 1.1); f.y = clamp(f.y + f.vy * h, R * 1.1, H - R * 1.1);
    }
    A.rot += h * (0.05 + 0.2 * Math.abs(lean)) * spin; B.rot -= h * (0.09 + 0.25 * Math.abs(lean)) * spin;
    targets(A, B, x, R); targets(B, A, x, R); nodes(A, h); nodes(B, h);
  }
  function age(dt, x) {
    time += dt; quiet += dt;
    const R = x.p('size') * 92, m0 = 0.32 * Math.min(1, x.p('pull'));
    if (time > holdEnd) mood += (m0 - mood) * (1 - Math.exp(-dt / 2.0));
    lean += (clamp(mood * 1.3, -1, 1) - lean) * (1 - Math.exp(-dt / 0.14));
    bristle += (Math.max(0, -mood) - bristle) * (1 - Math.exp(-dt / 0.1));
    ripple *= Math.exp(-dt / 0.55);
    flash *= Math.exp(-dt / 0.14);
    // touching: each picks up something of the other, fading over a few seconds
    const D = Math.hypot(B.x - A.x, B.y - A.y), S = radA(R) + radB(R);
    if (D < S * 0.98) infl = Math.min(1, infl + dt * 1.1); else infl *= Math.exp(-dt / 3.2);
    for (const f of [A, B]) {
      f.lit *= Math.exp(-dt / 0.16);
      f.swell += ((time < f.swellEnd ? f.swellTo : 0) - f.swell) * (1 - Math.exp(-dt / 0.3));
      if (!f.round) {
        const k = 1 - Math.exp(-dt / f.tau), b = Math.exp(-dt / 0.42);
        if (time > f.nextCut) { cut(f, null, 0, 1.6, () => x.rnd()); f.nextCut = time + 5 + x.rnd() * 4; }   // left alone it still never settles
        for (let i = 0; i < N; i++) { f.ox[i] += (f.tx[i] - f.ox[i]) * k; f.oy[i] += (f.ty[i] - f.oy[i]) * k; f.boost[i] *= b; f.ang[i] = Math.atan2(f.oy[i], f.ox[i]); }
      }
      const iv = Math.exp(-dt / 0.5);
      f.ia += (9 * (f.round ? 1 : -1) + f.iv) * dt; f.ib -= (6 * (f.round ? 1 : -1) + f.iv * 0.5) * dt; f.iv *= iv; f.wv *= iv;
      for (const t of f.tongues) t.age += dt;
      f.tongues = f.tongues.filter((t) => t.age < t.life);
      for (const q of f.ghosts) q.age += dt;
      f.ghosts = f.ghosts.filter((q) => q.age < 1.5);
    }
  }
  // The ink lies in the body's own frame, swimming slowly, in two layers that slide against each other.
  function inked(f, g, path, R, alpha, amount) {
    const s = 1.15 * R / 92, rot = f.rot * 0.5 + f.wv + f.wa, c = Math.cos(rot) * s, n = Math.sin(rot) * s;
    inkDark.setTransform(new DOMMatrix([c, n, -n, c, f.x * 0.82 + f.ia, f.y * 0.82 - f.ia * 0.4]));
    g.globalAlpha = alpha * amount; g.fillStyle = inkDark; g.fill(path);
    const s2 = s * 1.35, c2 = Math.cos(-rot * 0.7) * s2, n2 = Math.sin(-rot * 0.7) * s2;
    inkPale.setTransform(new DOMMatrix([c2, n2, -n2, c2, f.x * 0.9 + f.ib, f.y * 0.9 + f.ib * 0.6]));
    g.globalAlpha = alpha * amount * (0.6 + 0.4 * f.lit); g.fillStyle = inkPale; g.fill(path);
  }
  // A fast body leaves a smear and not a stack of copies: a few of its outline between where it was and where it is, over the fade.
  function smear(f, col, g, alpha) {
    const dx = f.x - f.lx, dy = f.y - f.ly, n = Math.min(9, Math.floor(Math.hypot(dx, dy) / 5));
    f.fast = Math.min(1, Math.hypot(dx, dy) / 25);                                     // and its crisp line drops out, or it stacks up as steps
    if (!n) return;
    g.fillStyle = rgb(col.map((v) => v * 0.6));
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1), ax = -dx * (1 - t), ay = -dy * (1 - t);
      g.globalAlpha = alpha * (0.2 + 0.55 * t);
      g.translate(ax, ay); g.fill(f.path); g.translate(-ax, -ay);
    }
  }
  function paint(f, o, col, g, R, alpha) {
    // the body: lit on the side that faces the other
    const dx = o.x - f.x, dy = o.y - f.y, D = Math.hypot(dx, dy) || 1, r = R * 1.6;
    const gr = g.createRadialGradient(f.x + dx / D * R * 0.55, f.y + dy / D * R * 0.55, 0, f.x, f.y, r);
    gr.addColorStop(0, rgb(col, 0.14 + f.lit * 0.55)); gr.addColorStop(0.55, rgb(col, f.lit * 0.2)); gr.addColorStop(1, rgb(col.map((v) => v * 0.72)));
    g.globalAlpha = alpha; g.fillStyle = gr;
    if (f.round) {                                                                    // soft edge: two wide faint strokes, no blur
      g.strokeStyle = rgb(col); g.lineJoin = 'round';
      g.globalAlpha = alpha * 0.16; g.lineWidth = 16; g.stroke(f.path);
      g.globalAlpha = alpha * 0.32; g.lineWidth = 7; g.stroke(f.path);
      g.globalAlpha = alpha; g.fill(f.path);
    } else {
      g.fill(f.path);
      g.strokeStyle = rgb(col, 0.3 + f.lit * 0.5); g.lineJoin = 'miter'; g.miterLimit = 6; g.lineWidth = 1.2; g.globalAlpha = alpha * (1 - 0.85 * (f.fast || 0)); g.stroke(f.path);
    }
    inked(f, g, f.path, R, alpha, 1);
  }

  TOOLS.push({
    id: 'duet', name: 'Duet', tag: 'new',
    blurb: 'Two forms in two colours, one round and one sharp, that want each other and can\'t stand each other. Every attack gets a verdict from the harmony: consonant, they lunge together; dissonant, they are thrown apart. Low notes move the round one, high notes the sharp one. Leave them alone and they end up nearly touching, trembling.',
    params: [
      { key: 'pull', label: 'how strongly they want each other', min: 0, max: 2, value: 1,
        hint: 'How strongly they want each other. Left: they keep their distance. Right: always reaching.',
        icon: (g, v, w, h) => { const d = 13 - v * 8; ICON.dot(g, w / 2 - d, h / 2, 5, '#ff4a1c'); ICON.shape(g, 'star', w / 2 + d, h / 2, 10, '#1f6bff'); } },
      { key: 'push', label: 'how hard a clash throws them apart', min: 0.2, max: 2, value: 1,
        hint: 'How hard a clash throws them apart. Left: a flinch. Right: flung to opposite corners.',
        icon: (g, v, w, h) => { const d = 4 + v * 10; ICON.arrow(g, w / 2 - 1, h / 2, w / 2 - 2 - d, h / 2, '#ff4a1c'); ICON.arrow(g, w / 2 + 1, h / 2, w / 2 + 2 + d, h / 2, '#1f6bff'); } },
      { key: 'size', label: 'how big they are', min: 0.5, max: 2.2, value: 1,
        hint: 'How big they are. Left: small and agile. Right: filling the screen.',
        icon: (g, v, w, h) => { const r = 2.5 + v * 5.5; ICON.dot(g, w / 2 - r - 1, h / 2, r, '#ff4a1c'); ICON.shape(g, 'star', w / 2 + r + 1, h / 2, r * 2, '#1f6bff'); } },
      { key: 'split', label: 'where the keyboard divides them', min: 30, max: 90, step: 1, value: 60,
        hint: 'Where the keyboard divides between them. Left: nearly everything moves the sharp one. Right: nearly everything moves the round one.',
        icon: (g, v, w, h) => { ICON.keys(g, w, h, 0, v, '#ff4a1c'); } },
      { key: 'pair', label: 'the two colours', min: 0, max: 2, step: 1, value: 0,
        hint: 'The two colours. Left: vermilion and cobalt. Middle: magenta and lime. Right: gold and teal.',
        icon: (g, v, w, h) => { const p = PAIRS[Math.round(v * 2)]; ICON.dot(g, w / 2 - 6, h / 2, 7, rgb(p.a)); ICON.dot(g, w / 2 + 6, h / 2, 7, rgb(p.b)); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: almost gone, barely moving, and only the hardest attacks reach them. Right: fully there, answering everything.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => { ICON.dot(g, w / 2 - 6, h / 2, 2 + 4 * v, '#ff4a1c'); ICON.shape(g, 'star', w / 2 + 6, h / 2, 4 + 8 * v, '#1f6bff'); }) },
    ],
    reset() {
      time = 0; A = newForm(true); B = newForm(false); ready = false; vels = null;
      lastCons = true; mood = 0.3; lean = 0; bristle = 0; ripple = 0; infl = 0; quiet = 9; spin = 1; holdEnd = 0; flash = 0;
    },
    onChord(ch, x) {
      if (!hardEnough(ch.vel, x)) return;
      const score = verdict(ch, x), cons = score >= 0, split = x.p('split');
      const pres = x.p('presence'), motion = 0.2 + 0.8 * pres;
      const loud = clamp((ch.vel - 30) / 85, 0.05, 1);
      let la = 0, lb = 0, ha = 0, hb = 0, va = 0, vb = 0;
      for (const n of ch.notes) {
        if (n.m < split) { la++; ha = Math.max(ha, n.d || 0); va = Math.max(va, n.v); }
        else { lb++; hb = Math.max(hb, n.d || 0); vb = Math.max(vb, n.v); }
      }
      // the verdict moves the mood at once; a clear, loud one moves it further
      // and a clash is slow to forgive: a consonance after one only partly reconciles them
      const reach = (0.08 + 0.26 * loud + 0.5 * Math.abs(score)) * (cons ? (mood < 0 ? 0.6 : 1) : 1.3);
      mood += ((cons ? 1 : -1) - mood) * Math.min(1, reach); lastCons = cons;
      if (!cons && x.rnd() < 0.2) spin = -spin;
      quiet = 0; flash = Math.max(flash, loud);
      // every clash cuts the sharp one anew, with its worst side turned to the other; a louder one cuts it wilder
      if (!cons && time - B.lastCut > 0.09) cut(B, Math.atan2(A.y - B.y, A.x - B.x) - B.rot, clamp(0.25 + 0.5 * loud + 0.4 * Math.abs(score), 0, 1), 0.06 + 0.5 * (1 - motion), () => x.rnd());
      const hold = Math.max(ha, hb);
      if (hold > 0.6) holdEnd = Math.max(holdEnd, time + Math.min(cons ? 4 : 1.2, hold));   // an embrace holds longer than a flinch
      const pa = clamp((va - 30) / 85, 0.05, 1), pb = clamp((vb - 30) / 85, 0.05, 1);
      if (la) answer(A, B, cons, pa, la, ha, x, motion);
      if (lb) answer(B, A, cons, pb, lb, hb, x, motion);
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H, R = x.p('size') * 92;
      if (!ready) { A.x = A.lx = W * 0.38; A.y = A.ly = H * 0.52; B.x = B.lx = W * 0.62; B.y = B.ly = H * 0.48; ready = true; }
      if (!inkDark) buildInk(g);
      const pi = Math.round(x.p('pair')), pal = PAIRS[pi];
      if (pi !== haloPair) { paintHalos(pal); haloPair = pi; }
      if (dt > 0) {
        const n = clamp(Math.ceil(dt * 120), 1, 8), h = Math.min(dt, 0.1) / n;
        age(dt, x);
        for (let i = 0; i < n; i++) sim(h, x);
      }
      contour(A, B, R); contour(B, A, R * 1.05);
      // What is painted every frame builds up under the harness's fade (12% a frame), so ask for the alpha whose steady
      // state is how present it should look; plain alpha would leave it nearly solid when turned down.
      const seen = 0.1 + 0.9 * x.p('presence'), alpha = 0.12 * seen / (1 - 0.88 * seen);
      // halos on the ground
      for (const [f, s] of [[A, halo], [B, haloB]]) {
        const r = R * (2.3 + 0.5 * f.lit);
        g.globalAlpha = alpha * (0.2 + 0.3 * f.lit); g.drawImage(s, f.x - r, f.y - r, r * 2, r * 2);
      }
      // ghosts of the poses struck at the last attacks
      g.lineWidth = 1.2; g.lineJoin = 'round';
      for (const [f, col] of [[A, pal.a], [B, pal.b]]) {
        g.strokeStyle = rgb(col, 0.1);
        for (const q of f.ghosts) { g.globalAlpha = alpha * 0.34 * (1 - q.age / 1.5); g.stroke(q.path); }
      }
      if (dt > 0) { smear(A, pal.a, g, alpha); smear(B, pal.b, g, alpha); }
      A.lx = A.x; A.ly = A.y; B.lx = B.x; B.ly = B.y;
      paint(A, B, pal.a, g, R, alpha);
      paint(B, A, pal.b, g, R * 1.05, alpha);
      // Where they overlap the colours run into each other: all of the first on its own side, all of the second on the other,
      // the third colour only between, and the first one's ink carries on through. So the sharp edge dissolves inside the round one.
      const D = Math.hypot(B.x - A.x, B.y - A.y) || 1, ux = (B.x - A.x) / D, uy = (B.y - A.y) / D, mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, ext = Math.max(D * 0.5, R * 0.75);
      const mix = g.createLinearGradient(mx - ux * ext, my - uy * ext, mx + ux * ext, my + uy * ext);
      mix.addColorStop(0.08, rgb(pal.a, 0.1)); mix.addColorStop(0.5, rgb(pal.seam, 0.08 + 0.3 * flash)); mix.addColorStop(0.92, rgb(pal.b, 0.1));
      g.save();
      g.clip(A.path);
      g.globalAlpha = alpha; g.fillStyle = mix; g.fill(B.path);
      inked(A, g, B.path, R, alpha, 0.85);
      inked(B, g, B.path, R, alpha, 0.5);
      g.restore();
      // and a thin hot line just where the two edges cross, dimming with everything else
      const hot = alpha * (0.3 + 0.7 * x.p('presence'));
      let crossings = 0;
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (let i = 0; i < N && crossings < 8; i++) {
        const k = (i + 1) % N, a0 = A.px[i], b0 = A.py[i], ex = A.px[k] - a0, ey = A.py[k] - b0;
        for (let j = 0; j < N; j++) {
          const q = (j + 1) % N, fx = B.px[q] - B.px[j], fy = B.py[q] - B.py[j], den = ex * fy - ey * fx;
          if (Math.abs(den) < 1e-6) continue;
          const t = ((B.px[j] - a0) * fy - (B.py[j] - b0) * fx) / den, u = ((B.px[j] - a0) * ey - (B.py[j] - b0) * ex) / den;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          crossings++;
          for (const [ln, c, wd] of [[1, rgb(pal.seam, 0.5), 3.5 + 3 * flash], [0, '#fff', 1 + 1.4 * flash]]) {
            g.strokeStyle = c; g.lineWidth = wd; g.globalAlpha = hot * (ln ? 0.5 : 0.95);
            g.beginPath();
            for (const [px, py, at] of [[A.px, A.py, i], [B.px, B.py, j]]) {
              g.moveTo(px[(at + N - 1) % N], py[(at + N - 1) % N]);
              for (let e = 0; e <= 2; e++) g.lineTo(px[(at + e) % N], py[(at + e) % N]);
            }
            g.stroke();
          }
          break;
        }
      }
      g.lineCap = 'butt'; g.globalAlpha = 1;
    },
  });
})();
