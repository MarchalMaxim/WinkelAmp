// Duet: two soft bodies with a relationship, one round and full, one sharp and spiked. Every attack gets a verdict from
// the harmony in the same frame: consonant against what is sounding, a lunge together; dissonant, a recoil. Each body is
// one closed contour of spring nodes around a moving centre. Low notes move the round one, high notes the sharp one.
// Where they overlap a third colour appears, and each slowly picks up something of the other.
(() => {
  const N = 72, TIPS = 9, PER = N / TIPS, TAU = Math.PI * 2;
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
  const newForm = (round) => ({
    round, x: 0, y: 0, vx: 0, vy: 0, rot: Math.random() * TAU, d: new Float32Array(N), v: new Float32Array(N), T: new Float32Array(N),
    px: new Float32Array(N), py: new Float32Array(N), len: Array.from({ length: TIPS }, () => 0.55 + Math.random() * 0.7), skew: Array.from({ length: TIPS }, () => (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.65)), wa: Math.random() * TAU, wb: Math.random() * TAU,
    boost: new Float32Array(TIPS), tongues: [], lit: 0, swell: 0, swellTo: 0, swellEnd: 0, ghosts: [], lastGhost: 0, path: null,
  });
  let A = newForm(true), B = newForm(false), ready = false;
  let lastCons = true, mood = 0.3, lean = 0, bristle = 0, ripple = 0, infl = 0, quiet = 9, spin = 1, time = 0, holdEnd = 0, flash = 0, vels = null;

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

  // One body's answer: consonant, tongues (or lengthening points) and a lunge; dissonant, a dent, bristles and a recoil.
  function answer(f, o, cons, power, count, hold, x, motion) {
    const dx = o.x - f.x, dy = o.y - f.y, D = Math.hypot(dx, dy) || 1, nx = dx / D, ny = dy / D, phi = Math.atan2(dy, dx);
    const R = x.p('size') * 92, sign = cons ? 1 : -1;
    const dense = 1 / (1 + 2.2 * x.feat.rate);
    const J = (cons ? x.p('pull') * (150 + 620 * power) : x.p('push') * (190 + 820 * power)) * (0.35 + 0.65 * dense) * motion;
    f.vx += nx * J * sign; f.vy += ny * J * sign;
    f.x += nx * sign * J * 0.012; f.y += ny * sign * J * 0.012;                       // seen in the attack's own frame
    f.lit = Math.max(f.lit, 0.35 + 0.65 * power);
    const k = Math.min(TIPS, count);
    if (cons) {
      for (let i = 0; i < k; i++) {
        const off = k === 1 ? x.rnd(-0.1, 0.1) : (i - (k - 1) / 2) * (f.round ? 0.42 : 0.5) + x.rnd(-0.06, 0.06);
        const amp = R * (0.45 + 1.0 * power) * (1 - 0.1 * Math.abs(i - (k - 1) / 2)) * motion;
        f.tongues.push({ off, w: f.round ? 0.2 : 0.34, amp, age: 0, life: Math.max(0.55, Math.min(3, hold)) });
      }
      if (f.tongues.length > 7) f.tongues.splice(0, f.tongues.length - 7);
    } else {
      // a whole bristling side: the k tips nearest the other stand out at once, and a round skin shudders
      const rel = wrap(phi - f.rot) / TAU * TIPS;
      for (let i = 0; i < k; i++) {
        const s = (Math.round(rel) + (i % 2 ? (i + 1) >> 1 : -(i >> 1)) + TIPS * 4) % TIPS;
        f.boost[s] = Math.max(f.boost[s], (0.2 + 0.42 * power) * motion);
      }
      if (f.round) ripple = Math.min(1.6, ripple + (0.45 + 0.5 * power + 0.1 * k) * motion);
    }
    // the skin answers at once
    for (let i = 0; i < N; i++) {
      const dp = wrap(i / N * TAU + f.rot - phi);
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
    for (let i = 0; i < N; i++) {
      const dp = wrap(i / N * TAU + f.rot - phi);
      let T = (hold > 1 ? hold + shiver : 0) * gau(dp, f.round ? 0.27 : 0.36);
      for (const t of f.tongues) {
        const e = 1 - t.age / t.life;
        if (e > 0) T += t.amp * Math.min(1, e * 2.2) * gau(wrap(dp - t.off), t.w);
      }
      // the sharp one reaches only with its points, so a reach is a needle and never a stem
      if (!f.round) { const j = i % PER, u = Math.min(j, PER - j) / (PER / 2); T *= 1.15 * Math.pow(1 - u, 1.3); }
      T -= R * 0.17 * p * gau(wrap(dp - Math.PI), 1.0);                                // the far side flattens
      T -= R * (f.round ? 0.6 : 0.34) * q * gau(dp, 0.8);                              // the facing side dents away
      if (f.round && ripple > 0.01) T += ripple * R * 0.1 * Math.sin(i / N * TAU * 11 - time * 19);
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
      const th0 = i / N * TAU + f.rot, j = i % PER, s = Math.floor(((i + PER / 2) % N) / PER), tip = j === 0;
      let r;
      if (f.round) {
        r = 1 + 0.13 * Math.sin(3 * th0 + time * 0.31) + 0.07 * Math.sin(5 * th0 - time * 0.23 + 1);
        r += infl * (tip ? 0.34 : j === 1 || j === PER - 1 ? 0.05 : 0);                // it has caught some points from the other
      } else {
        const u = Math.min(j, PER - j) / (PER / 2), sharp = Math.pow(1 - u, 1.55), soft = 0.5 + 0.5 * Math.cos(j / PER * TAU);
        const v = sharp + (soft - sharp) * infl * 0.6;                                 // its tips have rounded off
        r = Math.min(1.8, 0.44 + (0.72 + bristle * 0.3 + f.boost[s]) * f.len[s] * v);
      }
      // the sharp one is uneven, and its points lean every which way, so it stays a bristling thing and not a flower or a pinwheel
      const warp = f.round ? 0 : 0.17 * Math.sin(2 * (i / N * TAU) + f.wa) + 0.11 * Math.sin(3 * (i / N * TAU) + f.wb);
      const sweep = f.round ? 0 : 0.55 * f.skew[s] * (1 - bristle * 0.6) * Math.max(0, r - 0.44);
      const th = th0 + warp + sweep + lean * 0.55 * Math.sin(wrap(phi - th0));
      const rho = Math.max(R * 0.12, R * sw * r + f.d[i]);
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
      for (let s = 0; s < TIPS; s++) f.boost[s] *= Math.exp(-dt / 0.42);
      for (const t of f.tongues) t.age += dt;
      f.tongues = f.tongues.filter((t) => t.age < t.life);
      for (const q of f.ghosts) q.age += dt;
      f.ghosts = f.ghosts.filter((q) => q.age < 1.5);
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
      g.strokeStyle = rgb(col, 0.45 + f.lit * 0.4); g.lineJoin = 'miter'; g.miterLimit = 6; g.lineWidth = 1.5; g.stroke(f.path);
    }
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
        hint: 'How much it takes over. Left: two dim shapes that barely move, and only the hardest attacks reach them. Right: fully there, answering everything.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => { ICON.dot(g, w / 2 - 6, h / 2, 2 + 4 * v, '#ff4a1c'); ICON.shape(g, 'star', w / 2 + 6, h / 2, 4 + 8 * v, '#1f6bff'); }) },
    ],
    reset() {
      A = newForm(true); B = newForm(false); ready = false; vels = null;
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
      const hold = Math.max(ha, hb);
      if (hold > 0.6) holdEnd = Math.max(holdEnd, time + Math.min(cons ? 4 : 1.2, hold));   // an embrace holds longer than a flinch
      const pa = clamp((va - 30) / 85, 0.05, 1), pb = clamp((vb - 30) / 85, 0.05, 1);
      if (la) answer(A, B, cons, pa, la, ha, x, motion);
      if (lb) answer(B, A, cons, pb, lb, hb, x, motion);
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H, R = x.p('size') * 92;
      if (!ready) { A.x = W * 0.38; A.y = H * 0.52; B.x = W * 0.62; B.y = H * 0.48; ready = true; }
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
      paint(A, B, pal.a, g, R, alpha);
      paint(B, A, pal.b, g, R * 1.05, alpha);
      // the third colour, only where they overlap, with a hot edge
      g.save();
      g.clip(A.path);
      g.globalAlpha = alpha; g.fillStyle = rgb(pal.seam, 0.12 + 0.3 * flash); g.fill(B.path);
      g.strokeStyle = '#fff'; g.lineJoin = 'round'; g.lineWidth = 2 + 3 * flash; g.globalAlpha = alpha * 0.95; g.stroke(B.path);
      g.clip(B.path); g.strokeStyle = rgb(pal.seam, 0.75); g.lineWidth = 7; g.globalAlpha = alpha * 0.9; g.stroke(A.path);
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(A.path);
      g.restore();
    },
  });
})();
