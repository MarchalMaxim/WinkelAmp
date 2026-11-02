// Duet: two masses of liquid in two colours, with a relationship. One is thick and slow, one thin and quick. Every attack gets a
// verdict from the harmony in the same frame: consonant against what is sounding, they lean together; dissonant, they are thrown
// apart and it spatters. Low notes move the thick one, high notes the quick one.
// Each mass is a loose crowd of soft drops, drawn as one field. Each mass's field is weakened by the other's, so where they meet
// both surfaces give way and lie against each other along a soft seam, like two drops that won't coalesce: however hard they
// lunge, neither can enter the other, and nothing of either ever reaches out as a point.
(() => {
  const TAU = Math.PI * 2, FW = 320, FH = 180;
  const PAIRS = [
    { a: [255, 74, 28], b: [31, 107, 255], seam: [206, 84, 245] },    // vermilion, cobalt
    { a: [255, 40, 150], b: [170, 240, 40], seam: [255, 215, 110] },   // magenta, lime
    { a: [245, 180, 40], b: [20, 170, 170], seam: [150, 235, 110] },   // gold, teal
  ];
  const rgb = (c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Interval classes mod 12. A clash is heard over any number of consonances, so the harsh ones weigh more than one vote.
  const CONS = [0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0], DISS = [0, 2, 1.5, 0, 0, 0, 1.5, 0, 0, 0, 0.6, 2];
  // Where a surface lies in the field; how much one mass's field takes off the other's: enough that they never mix.
  const EDGE = 0.46, GIVE = 0.72;

  const fa = new Float32Array(FW * FH), fb = new Float32Array(FW * FH), sa = new Float32Array(FW * FH), sb = new Float32Array(FW * FH);
  let field = null, fg = null, img = null;

  // thick: a few big drops, slow; quick: more and smaller, restless
  const newMass = (thick) => {
    const n = thick ? 9 : 12, drops = [];
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      drops.push({
        th: i * 2.399963, rho: (thick ? 0.62 : 0.74) * Math.sqrt(u), r: (thick ? 0.5 + 0.2 * Math.random() : 0.34 + 0.18 * Math.random()),
        ox: 0, oy: 0, vx: 0, vy: 0, ph: Math.random() * TAU, w: (thick ? 0.28 : 0.62) * (0.7 + 0.6 * Math.random()), shade: Math.random() * TAU,
      });
    }
    return { thick, x: 0, y: 0, vx: 0, vy: 0, rot: Math.random() * TAU, drops, loose: [], lit: 0, swell: 0, swellTo: 0, swellEnd: 0 };
  };
  let A = newMass(true), B = newMass(false), ready = false, time = 0;
  let lastCons = true, mood = 0.3, flash = 0, spin = 1, holdEnd = 0, vels = null, velAvg = 0.4, jolt = 0;

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

  // One mass's answer. It moves as a whole and its drops take the push unevenly, so it sloshes; a lean goes through all of it,
  // never one part: what faces the other spreads sideways, which keeps its front broad.
  function answer(f, o, cons, power, count, hold, x, motion) {
    const dx = o.x - f.x, dy = o.y - f.y, D = Math.hypot(dx, dy) || 1, nx = dx / D, ny = dy / D;
    const R = x.p('size') * 92, sign = cons ? 1 : -1;
    const dense = Math.max(1 / (1 + 2.2 * x.feat.rate), jolt);                        // fast music damps the hits, but an accent well above its neighbours still lands
    const J = (cons ? x.p('pull') * (120 + 460 * power) : x.p('push') * (190 + 820 * power)) * (0.35 + 0.65 * dense) * motion;
    f.vx += nx * J * sign; f.vy += ny * J * sign;
    f.x += nx * sign * J * 0.012; f.y += ny * sign * J * 0.012;                       // seen in the attack's own frame
    f.lit = Math.max(f.lit, 0.35 + 0.65 * power);
    const kick = J * (f.thick ? 0.5 : 0.8);
    for (const q of f.drops) {
      const toward = (q.ox * nx + q.oy * ny) / (R + 1), side = q.ox * -ny + q.oy * nx >= 0 ? 1 : -1, s = x.rnd(0.4, 1);
      if (cons) { q.vx += -ny * side * kick * s * (0.4 + Math.max(0, toward)); q.vy += nx * side * kick * s * (0.4 + Math.max(0, toward)); }
      else { q.vx += -nx * kick * s + -ny * side * kick * 0.4 * s; q.vy += -ny * kick * s + nx * side * kick * 0.4 * s; }
    }
    if (!cons) {
      // it spatters, away from the other: small round drops that start clear of the surface and evaporate as they fly
      const m = Math.min(7, Math.round((1 + 3 * power + count * 0.5) * dense * motion));
      for (let i = 0; i < m; i++) {
        const a = Math.atan2(-ny, -nx) + x.rnd(-1.1, 1.1), sp = x.rnd(0.5, 1) * x.p('push') * (110 + 260 * power);
        f.loose.push({ x: f.x + Math.cos(a) * R * 1.45, y: f.y + Math.sin(a) * R * 1.45, vx: Math.cos(a) * sp + f.vx * 0.3, vy: Math.sin(a) * sp + f.vy * 0.3, r: R * x.rnd(0.09, 0.2), age: 0, life: x.rnd(0.5, 1.1), shade: x.rnd(0, TAU) });
      }
      if (f.loose.length > 16) f.loose.splice(0, f.loose.length - 16);
    }
    if (hold > 0.6) { f.swellTo = Math.min(1, 0.35 + hold * 0.3); f.swellEnd = time + Math.min(4, hold); }
  }

  function sim(h, x) {
    const W = x.W, H = x.H, R = x.p('size') * 92, pull = x.p('pull'), push = x.p('push');
    const dx = B.x - A.x, dy = B.y - A.y, D = Math.hypot(dx, dy) || 1, nx = dx / D, ny = dy / D;
    const S = R * (1 + 0.3 * A.swell) + R * 0.9 * (1 + 0.3 * B.swell);
    const m0 = 0.32 * Math.min(1, pull);
    const hold = S + 26 + Math.max(0, 1 - pull) * 240;
    const far = Math.min(W * 0.72, S + push * 430);
    // their closest is pressed together, the seam between them, and never further in
    const want = mood >= m0 ? hold + (S * 0.92 - hold) * (mood - m0) / (1 - m0 + 1e-3) : hold + (far - hold) * (m0 - mood) / (1 + m0);
    const k = D > want ? 3.2 + 3.2 * Math.min(1.5, pull) : 11;
    let F = k * (D - want);
    if (D < S * 0.86) F -= 2600 * (1 - D / (S * 0.86));
    const swirl = spin * (20 + 70 * x.feat.level + 60 * Math.max(0, mood));
    const ax = nx * F - ny * swirl, ay = ny * F + nx * swirl;
    A.vx += ax * h; A.vy += ay * h; B.vx -= ax * h; B.vy -= ay * h;
    const mx = (A.x + B.x) / 2 - W / 2, my = (A.y + B.y) / 2 - H / 2;
    for (const f of [A, B]) {
      f.vx -= mx * 1.1 * h; f.vy -= my * 1.6 * h;
      const e = R * 1.15, pad = 14;                                                    // the walls keep it in frame
      if (f.x < e + pad) f.vx += (e + pad - f.x) * 26 * h; if (f.x > W - e - pad) f.vx -= (f.x - W + e + pad) * 26 * h;
      if (f.y < e + pad) f.vy += (e + pad - f.y) * 26 * h; if (f.y > H - e - pad) f.vy -= (f.y - H + e + pad) * 26 * h;
      const damp = Math.exp(-2.1 * h); f.vx *= damp; f.vy *= damp;
      const sp = Math.hypot(f.vx, f.vy); if (sp > 1200) { f.vx *= 1200 / sp; f.vy *= 1200 / sp; }
      f.x += f.vx * h; f.y += f.vy * h;
      f.rot += h * (f.thick ? 0.07 : -0.13) * spin;
      // the drops: each after its own slowly wandering place in the mass, late, and swinging past it. Liquid.
      const stiff = f.thick ? 16 : 30, dmp = Math.exp(-(f.thick ? 2.6 : 3.4) * h), sw = 1 + 0.3 * f.swell;
      for (const q of f.drops) {
        const a = q.th + f.rot + 0.5 * Math.sin(time * q.w * 0.6 + q.ph), rr = R * sw * q.rho * (1 + 0.28 * Math.sin(time * q.w + q.ph * 2));
        q.vx += (Math.cos(a) * rr - q.ox) * stiff * h - f.vx * 0.9 * h * stiff * 0.12; q.vy += (Math.sin(a) * rr - q.oy) * stiff * h - f.vy * 0.9 * h * stiff * 0.12;
        q.vx *= dmp; q.vy *= dmp;
        q.ox += q.vx * h; q.oy += q.vy * h;
        const m = Math.hypot(q.ox, q.oy), top = R * 1.25 * sw;                          // it can slosh, but it stays one mass
        if (m > top) { q.ox *= top / m; q.oy *= top / m; }
      }
    }
  }
  function age(dt, x) {
    time += dt;
    const m0 = 0.32 * Math.min(1, x.p('pull'));
    if (time > holdEnd) mood += (m0 - mood) * (1 - Math.exp(-dt / 2.0));
    flash *= Math.exp(-dt / 0.3);
    for (const f of [A, B]) {
      f.lit *= Math.exp(-dt / 0.22);
      f.swell += ((time < f.swellEnd ? f.swellTo : 0) - f.swell) * (1 - Math.exp(-dt / 0.45));
      const d = Math.exp(-2.4 * dt);
      for (const q of f.loose) {
        q.age += dt; q.vx *= d; q.vy *= d;
        q.x += q.vx * dt; q.y += q.vy * dt;
      }
      f.loose = f.loose.filter((q) => q.age < q.life);
    }
  }

  // One soft drop into a mass's field (smooth, and nothing past twice its radius), with its own shade for the life inside.
  function stamp(F, S, cx, cy, r, shade) {
    const k = FW / 1280, R2 = (2 * r * k) * (2 * r * k), px = cx * k, py = cy * k, rad = 2 * r * k;
    const x0 = Math.max(0, Math.floor(px - rad)), x1 = Math.min(FW - 1, Math.ceil(px + rad)), y0 = Math.max(0, Math.floor(py - rad)), y1 = Math.min(FH - 1, Math.ceil(py + rad));
    for (let y = y0; y <= y1; y++) {
      const dy = y - py;
      for (let i = y * FW + x0, X = x0; X <= x1; X++, i++) {
        const dx = X - px, q = 1 - (dx * dx + dy * dy) / R2;
        if (q <= 0) continue;
        const f = q * q * q; F[i] += f; S[i] += f * shade;
      }
    }
  }
  function paintField(pal) {
    fa.fill(0); fb.fill(0); sa.fill(0); sb.fill(0);
    const put = (f, F, S) => {
      for (const q of f.drops) stamp(F, S, f.x + q.ox, f.y + q.oy, q.r * (RNow * (1 + 0.3 * f.swell)), 0.5 + 0.5 * Math.sin(time * q.w * 1.3 + q.shade));
      for (const q of f.loose) stamp(F, S, q.x, q.y, q.r * (1 - q.age / q.life), 0.8);
    };
    put(A, fa, sa); put(B, fb, sb);
    const d = img.data, la = 0.2 + 0.8 * A.lit, lb = 0.2 + 0.8 * B.lit;
    for (let i = 0, k = 0; i < FW * FH; i++, k += 4) {
      const a = fa[i], b = fb[i];
      const ea = a - GIVE * b, eb = b - GIVE * a, m = ea > eb ? ea : eb;
      if (m <= EDGE - 0.1) { d[k + 3] = 0; continue; }
      const on = (m - (EDGE - 0.1)) / 0.2, cover = on >= 1 ? 1 : on * on * (3 - 2 * on);
      const w = clamp(0.5 + (a - b) * 2.2, 0, 1), c1 = ea > eb ? pal.a : pal.b;                 // which of them this is, with a soft change between
      const depth = clamp((m - EDGE) / 1.1, 0, 1), inner = (a > b ? sa[i] / (a || 1) : sb[i] / (b || 1));
      const lit = a > b ? la : lb, seamNear = Math.min(a, b) > 0.05 ? Math.exp(-Math.pow((a - b) * 2.4, 2)) : 0;
      const k1 = 0.62 + 0.3 * depth + 0.26 * (inner - 0.5) + 0.3 * lit * depth, s = seamNear * (0.28 + 0.6 * flash);
      const mix = w < 1 && w > 0 ? Math.min(w, 1 - w) * 0.5 : 0;                               // colours run together a little, right at the seam
      const c2 = ea > eb ? pal.b : pal.a;
      for (let j = 0; j < 3; j++) {
        const v = (c1[j] * (1 - mix) + c2[j] * mix) * k1;
        d[k + j] = clamp(v + (pal.seam[j] - v) * s + 90 * lit * depth * depth, 0, 255);
      }
      d[k + 3] = 255 * cover;
    }
    fg.putImageData(img, 0, 0);
  }
  let RNow = 92;

  const blobIcon = (g, cx, cy, r, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(cx, cy - r * 0.05, r, r * 0.86, 0, 0, TAU); g.ellipse(cx + r * 0.45, cy + r * 0.3, r * 0.55, r * 0.5, 0, 0, TAU); g.fill(); };
  TOOLS.push({
    id: 'duet', name: 'Duet', tag: 'new',
    blurb: 'Two masses of liquid in two colours, one thick and slow, one thin and quick, that want each other and can\'t stand each other. Every attack gets a verdict from the harmony: consonant, they lean together until they lie against each other along a soft seam; dissonant, they are thrown apart and it spatters. They never mix and never enter each other. Low notes move the thick one, high notes the quick one.',
    params: [
      { key: 'pull', label: 'how strongly they want each other', min: 0, max: 2, value: 1,
        hint: 'How strongly they want each other. Left: they keep their distance. Right: always pressed together.',
        icon: (g, v, w, h) => { const d = 13 - v * 6; blobIcon(g, w / 2 - d, h / 2, 6, '#ff4a1c'); blobIcon(g, w / 2 + d, h / 2, 5, '#1f6bff'); } },
      { key: 'push', label: 'how hard a clash throws them apart', min: 0.2, max: 2, value: 1, less: 0.4,
        hint: 'How hard a clash throws them apart. Left: a flinch. Right: flung to opposite corners, spattering.',
        icon: (g, v, w, h) => { const d = 4 + v * 10; ICON.arrow(g, w / 2 - 1, h / 2, w / 2 - 2 - d, h / 2, '#ff4a1c'); ICON.arrow(g, w / 2 + 1, h / 2, w / 2 + 2 + d, h / 2, '#1f6bff'); } },
      { key: 'size', label: 'how big they are', min: 0.5, max: 2.2, value: 1, less: 0.5,
        hint: 'How big they are. Left: small and agile. Right: filling the screen.',
        icon: (g, v, w, h) => { const r = 2.5 + v * 5.5; blobIcon(g, w / 2 - r - 1, h / 2, r, '#ff4a1c'); blobIcon(g, w / 2 + r + 1, h / 2, r * 0.9, '#1f6bff'); } },
      { key: 'split', label: 'where the keyboard divides them', min: 30, max: 90, step: 1, value: 60,
        hint: 'Where the keyboard divides between them. Left: nearly everything moves the quick one. Right: nearly everything moves the thick one.',
        icon: (g, v, w, h) => { ICON.keys(g, w, h, 0, v, '#ff4a1c'); } },
      { key: 'pair', label: 'the two colours', min: 0, max: 2, step: 1, value: 0,
        hint: 'The two colours. Left: vermilion and cobalt. Middle: magenta and lime. Right: gold and teal.',
        icon: (g, v, w, h) => { const p = PAIRS[Math.round(v * 2)]; ICON.dot(g, w / 2 - 6, h / 2, 7, rgb(p.a)); ICON.dot(g, w / 2 + 6, h / 2, 7, rgb(p.b)); } },
      { key: 'howmuch', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much liquid there is and how far it goes: how big the two masses are, how hard a clash throws them and their spatter apart. Left: two small drops that flinch. Right: the two full masses, flung apart. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
      { key: 'presence', label: 'old: how faint', old: true, min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: almost gone, barely moving, and only the hardest attacks reach them. Right: fully there, answering everything.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => { blobIcon(g, w / 2 - 6, h / 2, 2 + 4 * v, '#ff4a1c'); blobIcon(g, w / 2 + 6, h / 2, 2 + 3.4 * v, '#1f6bff'); }) },
    ],
    reset() {
      time = 0; A = newMass(true); B = newMass(false); ready = false; vels = null;
      lastCons = true; mood = 0.3; flash = 0; spin = 1; holdEnd = 0; velAvg = 0.4; jolt = 0;
    },
    onChord(ch, x) {
      if (!hardEnough(ch.vel, x)) return;
      const score = verdict(ch, x), cons = score >= 0, split = x.p('split');
      const pres = x.p('presence'), motion = 0.2 + 0.8 * pres;
      const loud = clamp((ch.vel - 30) / 85, 0.05, 1);
      jolt = clamp((loud - velAvg - 0.06) / 0.2, 0, 1); velAvg += (loud - velAvg) * 0.12;
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
      flash = Math.max(flash, loud);
      const hold = Math.max(ha, hb);
      if (hold > 0.6) holdEnd = Math.max(holdEnd, time + Math.min(cons ? 4 : 1.2, hold));   // an embrace holds longer than a flinch
      const pa = clamp((va - 30) / 85, 0.05, 1), pb = clamp((vb - 30) / 85, 0.05, 1);
      if (la) answer(A, B, cons, pa, la, ha, x, motion);
      if (lb) answer(B, A, cons, pb, lb, hb, x, motion);
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H;
      RNow = x.p('size') * 92;
      if (!ready) {
        A.x = W * 0.38; A.y = H * 0.52; B.x = W * 0.62; B.y = H * 0.48; ready = true;
        for (const f of [A, B]) for (const q of f.drops) { q.ox = Math.cos(q.th + f.rot) * RNow * q.rho; q.oy = Math.sin(q.th + f.rot) * RNow * q.rho; }
      }
      if (!field) { field = document.createElement('canvas'); field.width = FW; field.height = FH; fg = field.getContext('2d', { willReadFrequently: true }); img = fg.createImageData(FW, FH); }
      if (dt > 0) {
        const n = clamp(Math.ceil(dt * 120), 1, 8), h = Math.min(dt, 0.1) / n;
        age(dt, x);
        for (let i = 0; i < n; i++) sim(h, x);
      }
      // What is painted every frame builds up under the harness's fade (12% a frame), so ask for the alpha whose steady
      // state is how present it should look; plain alpha would leave it nearly solid when turned down.
      const seen = 0.1 + 0.9 * x.p('presence'), alpha = 0.12 * seen / (1 - 0.88 * seen);
      paintField(PAIRS[Math.round(x.p('pair'))]);
      const was = g.imageSmoothingQuality;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.globalAlpha = alpha; g.drawImage(field, 0, 0, W, H);
      g.globalAlpha = 1; g.imageSmoothingQuality = was;
    },
  });
})();
