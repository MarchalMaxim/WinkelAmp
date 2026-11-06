// Leidenfrost (2026-11-06, the user: "the erratic behavior of the leidenfrost effect is a nice thing. It's heat too, little bit
// of gust and steam"; prototyped on the Claude Design canvas "Leidenfrost widget"). Water drops skate on their own vapour over a
// hot plate. The plate starts with ONE big drop. Between notes every drop wanders on correlated (Perlin) noise: its own slow
// drift, faster veering and quick skitter, plus one shared gust field, so neighbours sometimes swerve together and the steam
// leans with them. Drops wobble like Leidenfrost stars and stretch along their motion.
// A note picks a drop by pitch (low notes the big ones, high notes the small beads) and does one of three things:
//   - a bead smaller than the boil-off size is gone in a fifth of a second, in a puff of steam;
//   - with the chance 'how easily they burst' (default: follows each note's loudness) the drop splits into two equal halves
//     that fly apart;
//   - otherwise the drop is pushed in a RANDOM direction (never chosen by pitch), a jet of steam on the far side, a wobble
//     and a moment of extra skittering.
// Drops bounce off each other on their vapour and merge only when they drift together slowly. Small beads boil away by
// themselves within seconds, the big drop lasts; an empty plate gets a new big drop, quietly, after a breath.
// Under them the plate glows in slow ember noise; 'how much the plate glows' (asked for by the user, a sixth knob like flee's
// snap) dims it to black, so the drops can sit over other widgets alone.
// The picture is drawn whole on an offscreen canvas each step and laid on the shared one with 'lighten' at alpha 1, so the
// shared fade only leaves a short motion smear. All randomness goes through x.rnd; noise time is song time.
(() => {
  const W = 1280, H = 720, BIG = 56, M = 10, MAX_DROPS = 44, MAX_STEAM = 700;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---- Perlin noise (improved, 3D), a fixed permutation so every run is the same
  const P = new Uint8Array(512);
  {
    const perm = []; for (let i = 0; i < 256; i++) perm.push(i);
    let s = 1337; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  }
  const g3 = (h, x, y, z) => { const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  const lerp = (a, b, t) => a + t * (b - a);
  function noise(x, y, z) {
    let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
    const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10), w = z * z * z * (z * (z * 6 - 15) + 10);
    const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    return lerp(lerp(lerp(g3(P[AA] & 15, x, y, z), g3(P[BA] & 15, x - 1, y, z), u),
                     lerp(g3(P[AB] & 15, x, y - 1, z), g3(P[BB] & 15, x - 1, y - 1, z), u), v),
                lerp(lerp(g3(P[AA + 1] & 15, x, y, z - 1), g3(P[BA + 1] & 15, x - 1, y, z - 1), u),
                     lerp(g3(P[AB + 1] & 15, x, y - 1, z - 1), g3(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
  }

  // ---- state
  let drops = [], steam = [], started = false, emptySince = -1, gustAmp = 60;
  let cv = null, cg = null, cvS = 0, sprite = null, statsFor = null, stats = null;
  const HW = 96, HH = 54;   // the plate's ember noise is worked out on a small grid and drawn smoothed
  let hc = null, hg = null, himg = null;

  // The offscreen matches the stage's pixels (HD renders draw at 2x or more), so rims and highlights stay crisp.
  function ensure(x) {
    const cw = x.g && x.g.canvas && x.g.canvas.width, s = Math.max(1, Math.min(3, (typeof cw === 'number' && cw > 0 ? cw : W) / W));
    if (cv && cvS === s) return;
    if (!cv) { cv = document.createElement('canvas'); cg = cv.getContext('2d'); }
    cv.width = Math.round(W * s); cv.height = Math.round(H * s); cvS = s;
    if (!hc) { hc = document.createElement('canvas'); hc.width = HW; hc.height = HH; hg = hc.getContext('2d'); himg = hg.createImageData(HW, HH); }
    if (sprite) return;
    sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
    const sg = sprite.getContext('2d'), gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
  }

  // Loudness 0..1 within this song's own range (10th to 90th percentile of velocity).
  function uv(v) {
    const all = typeof CHORDS !== 'undefined' ? CHORDS : [];
    if (statsFor !== all || !stats || stats.n !== all.length) {
      statsFor = all; const vs = [];
      for (const c of all) for (const n of c.notes) vs.push(n.v);
      vs.sort((a, b) => a - b);
      const N = vs.length, p10 = N ? vs[Math.floor(0.1 * (N - 1))] : 40, p90 = N ? vs[Math.floor(0.9 * (N - 1))] : 100;
      // too few notes, or all alike: a fixed range instead
      stats = N >= 3 && p90 - p10 >= 4 ? { n: all.length, lo: p10, hi: p90 } : { n: all.length, lo: 40, hi: 100 };
    }
    return clamp((v - stats.lo) / (stats.hi - stats.lo), 0, 1);
  }

  function mkDrop(px, py, r, fade, rnd) {
    return { x: px, y: py, vx: 0, vy: 0, r, seed: rnd() * 200, agit: 0, heat: 0, lastSplit: -9, fade, acc: rnd(), vanish: false,
      modes: [2, 3, 4, 5].map((n) => ({ n, base: n === 2 ? 0.03 : n === 3 ? 0.018 : 0.01, a: 0.03, ph: rnd() * 6.28, rot: rnd() * 6.28 })) };
  }
  function freeSpot(r, rnd) {
    let best = [W / 2, H / 2], bestD = -Infinity;
    for (let i = 0; i < 14; i++) {
      const px = 80 + rnd() * (W - 160), py = 80 + rnd() * (H - 160);
      let dmin = 1e9; for (const d of drops) dmin = Math.min(dmin, Math.hypot(d.x - px, d.y - py) - d.r - r);
      if (dmin > bestD) { bestD = dmin; best = [px, py]; }
    }
    return best;
  }
  function excite(d, amt, rnd) { for (const m of d.modes) { m.a += amt * (0.4 + rnd()) * (m.n === 2 ? 1 : 0.7); m.rot = rnd() * 6.28; } }
  function puff(px, py, n, r, dx, dy, a, rnd) {
    for (let i = 0; i < n && steam.length < MAX_STEAM; i++) {
      const ang = Math.atan2(dy, dx) + (rnd() - 0.5) * 1.6, sp = 30 + rnd() * 110;
      steam.push({ x: px, y: py, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r0: r * (0.35 + rnd() * 0.3), age: 0, life: 0.9 + rnd() * 1.1, a });
    }
  }
  const boilR = (x) => 5 + 15 * clamp(x.p('boil') ?? 0.5, 0, 1);
  const pushK = (x) => 0.15 + 1.85 * clamp(x.p('push') ?? 0.5, 0, 1);
  const steamK = (x) => clamp(x.p('steam') ?? 0.6, 0, 1);

  function boilOff(d, vel, x) {
    if (d.vanish) return;
    d.vanish = true; d.heat = 1;
    const s = 0.4 + steamK(x);
    puff(d.x, d.y, Math.round((5 + vel * 8) * s), d.r * 1.6, 0, -1, 0.18, x.rnd);
    puff(d.x, d.y, Math.round((3 + vel * 5) * s), d.r * 1.2, x.rnd() - 0.5, x.rnd() - 0.5, 0.14, x.rnd);
  }
  function pushDrop(d, vel, x) {
    const a = x.rnd() * Math.PI * 2;
    const sp = pushK(x) * (90 + 520 * vel) / Math.sqrt(Math.max(d.r, 6) / 20);
    d.vx += Math.cos(a) * sp; d.vy += Math.sin(a) * sp;
    d.agit = Math.min(1.6, d.agit + 0.4 + 0.8 * vel); d.heat = 1;
    excite(d, 0.06 + 0.14 * vel, x.rnd);
    puff(d.x - Math.cos(a) * d.r * 0.8, d.y - Math.sin(a) * d.r * 0.8, Math.round((2 + vel * 9) * (0.3 + steamK(x))), d.r, -Math.cos(a), -Math.sin(a), 0.13, x.rnd);
  }
  // Two equal halves fly apart in opposite directions.
  function split(d, vel, x) {
    const a0 = x.rnd() * Math.PI * 2, sp = pushK(x) * (140 + 480 * vel), r = d.r / Math.SQRT2;
    drops.splice(drops.indexOf(d), 1);
    for (let i = 0; i < 2; i++) {
      const ang = a0 + i * Math.PI + (x.rnd() - 0.5) * 0.3;
      const b = mkDrop(d.x + Math.cos(ang) * d.r * 0.45, d.y + Math.sin(ang) * d.r * 0.45, r, 1, x.rnd);
      const s = (sp / Math.sqrt(Math.max(r, 5) / 20)) * 0.8;
      b.vx = d.vx + Math.cos(ang) * s; b.vy = d.vy + Math.sin(ang) * s;
      b.agit = 1.2; b.heat = 1; b.lastSplit = x.t; b.seed = d.seed + i * 37.1;
      excite(b, 0.2, x.rnd);
      drops.push(b);
    }
    const n = Math.round((6 + vel * 14) * (0.3 + steamK(x)));
    puff(d.x, d.y, n, d.r * 1.3, Math.cos(a0 + 1), Math.sin(a0 + 1), 0.16, x.rnd);
    puff(d.x, d.y, n, d.r * 1.3, -Math.cos(a0 + 1), -Math.sin(a0 + 1), 0.16, x.rnd);
  }

  // ---- one step of the plate
  function step(dt, x) {
    const t = x.t, D = drops, er = clamp(x.p('erratic') ?? 0.55, 0, 1), boil = clamp(x.p('boil') ?? 0.5, 0, 1), stK = steamK(x);
    if (D.length === 0) {   // an empty plate: after a breath a new big drop lands, quietly
      if (emptySince < 0) emptySince = t;
      if (t - emptySince > 1.2) { const p = freeSpot(BIG, x.rnd); D.push(mkDrop(p[0], p[1], BIG, 0, x.rnd)); emptySince = -1; }
    }
    gustAmp = 25 + 110 * Math.max(0, noise(t * 0.13, 3.3, 9.1) + 0.25);
    for (let i = D.length - 1; i >= 0; i--) {
      const d = D[i], s = d.seed;
      d.fade = Math.min(1, d.fade + dt * 1.4);
      d.agit *= Math.exp(-dt * 2.2); d.heat *= Math.exp(-dt * 3.5);
      const small = Math.pow(20 / Math.max(d.r, 5), 0.35);
      const amp = (25 + 320 * er) * (1 + 1.6 * d.agit) * small;
      const fx = noise(s, t * 0.5, 0.5) + 0.6 * er * noise(s, t * 2.3, 3.7) + 0.35 * er * er * noise(s, t * 6.1, 8.1);
      const fy = noise(s, t * 0.5, 5.5) + 0.6 * er * noise(s, t * 2.3, 13.7) + 0.35 * er * er * noise(s, t * 6.1, 18.1);
      const gx = noise(d.x * 0.0022, d.y * 0.0022, t * 0.12 + 20), gy = noise(d.x * 0.0022, d.y * 0.0022, t * 0.12 + 40);
      d.vx += (fx * amp + gx * gustAmp * 2.2) * dt;
      d.vy += (fy * amp + gy * gustAmp * 2.2) * dt;
      const drag = Math.exp(-dt * 0.75); d.vx *= drag; d.vy *= drag;
      const spd = Math.hypot(d.vx, d.vy); if (spd > 1100) { d.vx *= 1100 / spd; d.vy *= 1100 / spd; }
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.x - d.r < M) { d.x = M + d.r; if (d.vx < 0) { excite(d, Math.min(0.12, -d.vx / 3000), x.rnd); d.vx = -d.vx * 0.6; } }
      if (d.x + d.r > W - M) { d.x = W - M - d.r; if (d.vx > 0) { excite(d, Math.min(0.12, d.vx / 3000), x.rnd); d.vx = -d.vx * 0.6; } }
      if (d.y - d.r < M) { d.y = M + d.r; if (d.vy < 0) { excite(d, Math.min(0.12, -d.vy / 3000), x.rnd); d.vy = -d.vy * 0.6; } }
      if (d.y + d.r > H - M) { d.y = H - M - d.r; if (d.vy > 0) { excite(d, Math.min(0.12, d.vy / 3000), x.rnd); d.vy = -d.vy * 0.6; } }
      for (const m of d.modes) {
        const f = Math.min(8, 2.6 * Math.sqrt((m.n * (m.n - 1) * (m.n + 2)) / 8) / Math.pow(Math.max(d.r, 5) / 20, 1.5));
        m.ph += dt * f * Math.PI * 2;
        const live = m.base * (1 + 0.8 * er) * (0.7 + 0.6 * (noise(s + m.n, t * 0.4, 2.2) + 0.5));
        m.a = live + (m.a - live) * Math.exp(-dt * 1.7);
        m.rot += dt * 0.4 * noise(s, m.n, t * 0.3);
      }
      if (d.vanish) {   // boiled off: gone in a fifth of a second
        d.r *= Math.exp(-dt * 16);
        if (d.r < 1.2) { D.splice(i, 1); continue; }
      } else {          // big drops last; small beads boil away fast, faster the smaller they get
        d.r -= dt * (0.05 + (10 + 80 * boil) / (d.r * d.r)) * (1 + 0.6 * d.agit);
        if (d.r < 3) { boilOff(d, 0.3, x); continue; }
      }
      d.acc += dt * stK * 3.2 * (0.7 + d.r / 18) * (1 + 2.5 * d.agit) * d.fade;
      while (d.acc >= 1 && steam.length < MAX_STEAM) {
        d.acc -= 1; const a = x.rnd() * 6.28, rr = x.rnd() * d.r * 0.7;
        steam.push({ x: d.x + Math.cos(a) * rr, y: d.y + Math.sin(a) * rr, vx: d.vx * 0.15 + (x.rnd() - 0.5) * 20, vy: d.vy * 0.15 - 10 - x.rnd() * 15,
          r0: d.r * (0.4 + x.rnd() * 0.4), age: 0, life: 1.6 + x.rnd() * 1.6, a: 0.07 });
      }
      if (d.acc > 2) d.acc = 2;
    }
    // Touching drops bounce on their vapour, and merge only when they drift together slowly.
    for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++) {
      const a = D[i], b = D[j];
      if (a.vanish || b.vanish) continue;
      const dx = b.x - a.x, dy = b.y - a.y, R = a.r + b.r, d2 = dx * dx + dy * dy;
      if (d2 >= R * R || d2 < 1e-6) continue;
      const dist = Math.sqrt(d2), nx = dx / dist, ny = dy / dist, over = R - dist;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny, ma = a.r * a.r, mb = b.r * b.r;
      const canMerge = t - a.lastSplit > 1.6 && t - b.lastSplit > 1.6 && Math.abs(vn) < 60 && Math.sqrt(ma + mb) < 60 && a.fade > 0.9 && b.fade > 0.9;
      if (canMerge && x.rnd() < dt * 2) {
        const m = ma + mb;
        a.x = (a.x * ma + b.x * mb) / m; a.y = (a.y * ma + b.y * mb) / m;
        a.vx = (a.vx * ma + b.vx * mb) / m; a.vy = (a.vy * ma + b.vy * mb) / m;
        a.r = Math.sqrt(m); a.agit = Math.max(a.agit, b.agit); excite(a, 0.14, x.rnd);
        D.splice(j, 1); j--; continue;
      }
      const sa = mb / (ma + mb), sb = ma / (ma + mb);
      a.x -= nx * over * sa * 0.6; a.y -= ny * over * sa * 0.6; b.x += nx * over * sb * 0.6; b.y += ny * over * sb * 0.6;
      if (vn < 0) {
        const jimp = (-1.8 * vn) / (1 / ma + 1 / mb);
        a.vx -= (jimp / ma) * nx; a.vy -= (jimp / ma) * ny; b.vx += (jimp / mb) * nx; b.vy += (jimp / mb) * ny;
        const e = Math.min(0.1, -vn / 3000); excite(a, e, x.rnd); excite(b, e, x.rnd);
      }
    }
    // Steam drifts with the same gust that moves the drops, curling a little.
    for (let i = steam.length - 1; i >= 0; i--) {
      const p = steam[i]; p.age += dt; if (p.age >= p.life) { steam.splice(i, 1); continue; }
      const gx = noise(p.x * 0.0022, p.y * 0.0022, t * 0.12 + 20), gy = noise(p.x * 0.0022, p.y * 0.0022, t * 0.12 + 40);
      const cx = noise(p.x * 0.012, p.y * 0.012, t * 0.6), cy = noise(p.x * 0.012 + 9, p.y * 0.012, t * 0.6);
      p.vx += (gx * gustAmp * 3 + cx * 60) * dt; p.vy += (gy * gustAmp * 3 + cy * 60 - 14) * dt;
      const dr = Math.exp(-dt * 1.4); p.vx *= dr; p.vy *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  // ---- the picture, whole, on the offscreen canvas
  function draw(x) {
    const g = cg;
    g.setTransform(cvS, 0, 0, cvS, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    // the plate: slow ember noise, darker towards the edges
    const pk = clamp(x.p('plate') ?? 1, 0, 1);
    if (pk > 0.001) {
      const px = himg.data, t = x.t;
      for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) {
        let n = noise(i * 0.055, j * 0.055, t * 0.06) + 0.5 * noise(i * 0.14, j * 0.14, t * 0.2 + 5);
        n = clamp(0.42 + 0.75 * n, 0, 1);
        const o = (j * HW + i) * 4;
        px[o] = pk * (12 + 120 * Math.pow(n, 1.7)); px[o + 1] = pk * (6 + 32 * Math.pow(n, 2.4)); px[o + 2] = pk * (4 + 8 * Math.pow(n, 3)); px[o + 3] = 255;
      }
      hg.putImageData(himg, 0, 0);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(hc, 0, 0, W, H);
      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.62);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
    // the vapour cushion glows under each drop: the heat
    g.globalCompositeOperation = 'lighter';
    for (const d of drops) {
      const flick = 0.85 + 0.3 * noise(d.seed, x.t * 1.7, 4.4);
      const gl = g.createRadialGradient(d.x, d.y + d.r * 0.15, d.r * 0.3, d.x, d.y + d.r * 0.15, d.r * 2);
      gl.addColorStop(0, `rgba(255,115,40,${clamp((0.16 + 0.4 * d.heat) * d.fade * flick, 0, 1)})`); gl.addColorStop(1, 'rgba(255,90,30,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(d.x, d.y + d.r * 0.15, d.r * 2, 0, 6.2832); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    const N = 44;
    for (const d of drops) {
      const r = d.r * (0.4 + 0.6 * d.fade), va = Math.atan2(d.vy, d.vx), st = Math.min(0.2, Math.hypot(d.vx, d.vy) / 2600);
      g.globalAlpha = d.fade;
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * 6.2832;
        let rr = 1 + st * Math.cos(2 * (th - va));
        for (const m of d.modes) rr += m.a * Math.cos(m.n * (th - m.rot)) * Math.sin(m.ph);
        const px = d.x + Math.cos(th) * r * rr, py = d.y + Math.sin(th) * r * rr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      const bg = g.createRadialGradient(d.x - r * 0.25, d.y - r * 0.3, 0, d.x, d.y, r * 1.12);
      bg.addColorStop(0, 'rgba(200,225,238,0.10)'); bg.addColorStop(0.6, 'rgba(110,150,175,0.16)');
      bg.addColorStop(0.88, 'rgba(170,208,230,0.42)'); bg.addColorStop(1, 'rgba(225,242,252,0.78)');
      g.fillStyle = bg; g.fill();
      g.lineWidth = 1.2; g.strokeStyle = 'rgba(235,246,255,0.55)'; g.stroke();
      g.fillStyle = `rgba(255,140,60,${0.16 + 0.32 * d.heat})`;
      g.beginPath(); g.ellipse(d.x + r * 0.2, d.y + r * 0.45, r * 0.45, r * 0.16, 0.15, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.88)';
      g.beginPath(); g.ellipse(d.x - r * 0.33, d.y - r * 0.4, r * 0.21, r * 0.1, -0.6, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.arc(d.x + r * 0.38, d.y - r * 0.12, Math.max(0.8, r * 0.05), 0, 6.2832); g.fill();
    }
    for (const p of steam) {
      const q = p.age / p.life, s = p.r0 * (1 + 2.4 * q) * 2;
      g.globalAlpha = p.a * Math.sin(Math.PI * Math.min(1, q * 1.15 + 0.02));
      g.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
    }
    g.globalAlpha = 1;
  }

  TOOLS.push({
    id: 'leidenfrost', name: 'Leidenfrost', tag: 'new',
    blurb: 'Water drops skate on their own steam over a hot plate, starting with one big drop. Between notes they wander erratically on smooth noise, and a shared gust sometimes swerves them together. A note pushes a drop in a random direction; when the burst knob allows (by default the louder the note, the likelier) it splits the drop into two equal halves; a small bead it reaches boils off in a puff. Low notes reach the big drops, high notes the small beads.',
    params: [
      { key: 'push', label: 'how hard notes push', min: 0, max: 1, value: 0.5, less: 0.2,
        hint: 'How far a note sends its drop. Left: a nudge. Right: across the plate.',
        icon: (g, v, w, h) => { ICON.dot(g, 6, h / 2, 3.5, ICON.blue); ICON.arrow(g, 11, h / 2, 11 + v * (w - 15), h / 2, ICON.ink, 1.5); } },
      { key: 'burst', label: 'how easily they burst', min: 0, max: 1, value: 0.05, drive: '+hit',
        hint: 'The chance a note splits its drop into two equal halves. Left: never. Right: every note. It follows each note’s loudness at first.',
        icon: (g, v, w, h) => { const s = v * 9; ICON.dot(g, w / 2 - s, h / 2, 7 - 2 * v, ICON.blue); ICON.dot(g, w / 2 + s, h / 2, 7 - 2 * v, ICON.blue); } },
      { key: 'boil', label: 'how fast beads boil off', min: 0, max: 1, value: 0.5,
        hint: 'How big a bead can be and still vanish in a puff when a note reaches it, and how fast small beads boil away. Left: only tiny ones. Right: even mid-sized ones.',
        icon: (g, v, w, h) => { ICON.dot(g, 10, h / 2, 6, ICON.blue); ICON.dot(g, 28, h / 2, 1.5 + 4.5 * (1 - v), ICON.blue); ICON.ring(g, 28, h / 2, 4 + 6 * v, ICON.dim, 1); } },
      { key: 'erratic', label: 'how erratic', min: 0, max: 1, value: 0.55,
        hint: 'How the drops move between notes. Left: a calm drift. Right: nervous skittering.',
        icon: (g, v, w, h) => ICON.wave(g, w, h, 0.15 + 0.85 * v, 1 + 3 * v, ICON.blue, 1.5) },
      { key: 'steam', label: 'how much steam', min: 0, max: 1, value: 0.6, less: 0.15,
        hint: 'How much steam comes off the drops and every note. Left: dry. Right: thick wisps that lean with the gust.',
        icon: (g, v, w, h) => ICON.dots(g, 1 + Math.round(v * 12), w, h, { seed: 3, r: 2.5, col: ICON.dim }) },
      { key: 'plate', label: 'how much the plate glows', min: 0, max: 1, value: 1,
        hint: 'The hot plate under the drops, glowing in slow embers. Left: black, only the drops and their steam, to lay over other widgets. Right: the full glow.',
        icon: (g, v, w, h) => { ICON.alpha(g, 0.08 + 0.92 * v, () => ICON.rect(g, 2, h / 2 + 2, w - 4, 8, ICON.red)); ICON.dot(g, w / 2, h / 2 - 3, 5, ICON.blue); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much each note leaves: how far it pushes and how much steam rises. Left: small nudges, dry. Right: long slides in thick steam. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { drops = []; steam = []; started = false; emptySince = -1; statsFor = null; stats = null; },
    // For tests: the drops as they are now.
    peek() { return drops.map((d) => ({ x: d.x, y: d.y, r: d.r, vanish: d.vanish })); },
    onChord(ch, x) {
      const targets = drops.filter((d) => !d.vanish && d.fade > 0.5).sort((a, b) => b.r - a.r);
      if (!targets.length) return;
      // Each note reaches its own drop where there are enough: low notes the big ones. Extra notes add to a drop already reached.
      const acts = new Map();
      for (const n of ch.notes.slice().sort((a, b) => a.m - b.m)) {
        const pn = x.pitch01 ? clamp(x.pitch01(n.m), 0, 1) : clamp((n.m - 36) / 60, 0, 1);
        const i = clamp(Math.round((targets.length - 1) * pn + (x.rnd() - 0.5) * 2), 0, targets.length - 1);
        let d = targets[i];
        for (let j = 1; acts.has(d) && j < targets.length; j++) d = targets[(i + j) % targets.length];
        const vel = uv(n.v);
        acts.set(d, acts.has(d) ? Math.min(1, Math.max(acts.get(d), vel) + 0.1) : vel);
      }
      const chance = clamp(x.p('burst') ?? 0.05, 0, 1), small = boilR(x);
      for (const [d, vel] of acts) {
        if (d.r < small) boilOff(d, vel, x);
        else if (d.r >= 7 && drops.length < MAX_DROPS && x.rnd() < chance) split(d, vel, x);
        else pushDrop(d, vel, x);
      }
    },
    frame(x) {
      ensure(x);
      if (!started) { started = true; drops.push(mkDrop(W / 2, H / 2, BIG, 1, x.rnd)); }
      const dt = clamp(x.dt || 0, 0, 0.05);
      if (dt > 0) step(dt, x);
      draw(x);
      const g = x.g;
      g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
      g.drawImage(cv, 0, 0, W, H);
    },
  });
})();
