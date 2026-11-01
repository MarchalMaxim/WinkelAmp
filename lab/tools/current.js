// The current v3: a small real-time fluid (128x72 velocity, 256x144 RGB dye) with several thin threads that braid.
// The melody steers the main white-gold thread; the other threads (inner voices, bass) weave around it and cross on
// their own notes. Chords pour coloured dye into the water, tempo sets how fast the water runs, big chords tear vortices.
(() => {
  const NX = 128, NY = 72, CELL = 10;           // velocity grid; 1 cell = 10 canvas px
  const DX = 256, DY = 144, DCELL = 5;          // dye grid; 1 cell = 5 canvas px
  const n = NX * NY, dn = DX * DY;
  let u = new Float32Array(n), v = new Float32Array(n), u2 = new Float32Array(n), v2 = new Float32Array(n);
  const p = new Float32Array(n), div = new Float32Array(n), curl = new Float32Array(n);
  let R = new Float32Array(dn), G = new Float32Array(dn), B = new Float32Array(dn);
  let R2 = new Float32Array(dn), G2 = new Float32Array(dn), B2 = new Float32Array(dn);
  const off = document.createElement('canvas'); off.width = DX; off.height = DY;
  const og = off.getContext('2d'); const img = og.createImageData(DX, DY); const px = img.data;
  for (let o = 3; o < px.length; o += 4) px[o] = 255;
  const TONE = new Uint8ClampedArray(1024);     // soft tone map: 1 - e^-x, so dye saturates instead of clipping
  for (let i = 0; i < 1024; i++) TONE[i] = 255 * (1 - Math.exp(-i / 160));

  const MAXT = 5;
  // Thread colours: the melody is white-gold, the lower voices turn through pale gold to copper.
  const TCOL = [[255, 238, 205], [255, 214, 150], [244, 186, 120], [230, 160, 100], [210, 128, 82]];
  const main = { x: 640, y: 360, a: 0, ta: 0, lastTop: null, side: 1 };
  let heads = [], hist = [], time = 0, rate = 0, flash = 0, flowPh = 0;

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  function sample(f, w, h, x, y) {
    x = clamp(x, 0, w - 1.001); y = clamp(y, 0, h - 1.001);
    const i = x | 0, j = y | 0, fx = x - i, fy = y - j, k = i + j * w;
    return (f[k] * (1 - fx) + f[k + 1] * fx) * (1 - fy) + (f[k + w] * (1 - fx) + f[k + w + 1] * fx) * fy;
  }
  function hsl(h, s, l) {                       // → [r, g, b] 0..1
    h = ((h % 360) + 360) % 360 / 60; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    return [r + m, g + m, b + m];
  }

  function splatVel(x, y, fx, fy, r) {          // x, y canvas px; fx, fy cells/s; r cells
    const cx = x / CELL - 0.5, cy = y / CELL - 0.5, Rr = Math.ceil(r * 3);
    for (let j = Math.max(1, (cy | 0) - Rr); j <= Math.min(NY - 2, (cy | 0) + Rr); j++)
      for (let i = Math.max(1, (cx | 0) - Rr); i <= Math.min(NX - 2, (cx | 0) + Rr); i++) {
        const w = Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / (r * r)), k = i + j * NX;
        u[k] += fx * w; v[k] += fy * w;
      }
  }
  function steerVel(x, y, tx, ty, r, k) {       // pull the water toward (tx, ty) cells/s: a bounded jet
    const cx = x / CELL - 0.5, cy = y / CELL - 0.5, Rr = Math.ceil(r * 3);
    for (let j = Math.max(1, (cy | 0) - Rr); j <= Math.min(NY - 2, (cy | 0) + Rr); j++)
      for (let i = Math.max(1, (cx | 0) - Rr); i <= Math.min(NX - 2, (cx | 0) + Rr); i++) {
        const w = Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / (r * r)) * k, q = i + j * NX;
        u[q] += (tx - u[q]) * w; v[q] += (ty - v[q]) * w;
      }
  }
  function splatSwirl(x, y, s, r) {             // a vortex: s > 0 turns clockwise on screen
    const cx = x / CELL - 0.5, cy = y / CELL - 0.5, Rr = Math.ceil(r * 3);
    for (let j = Math.max(1, (cy | 0) - Rr); j <= Math.min(NY - 2, (cy | 0) + Rr); j++)
      for (let i = Math.max(1, (cx | 0) - Rr); i <= Math.min(NX - 2, (cx | 0) + Rr); i++) {
        const dx = i - cx, dy = j - cy, w = Math.exp(-(dx * dx + dy * dy) / (r * r)) * s / r, k = i + j * NX;
        u[k] += -dy * w; v[k] += dx * w;
      }
  }
  function splatDye(x, y, c, amt, r) {          // c = [r, g, b] 0..1; r in dye cells
    const cx = x / DCELL - 0.5, cy = y / DCELL - 0.5, Rr = Math.ceil(r * 3);
    const ar = c[0] * amt, ag = c[1] * amt, ab = c[2] * amt;
    for (let j = Math.max(0, (cy | 0) - Rr); j <= Math.min(DY - 1, (cy | 0) + Rr); j++)
      for (let i = Math.max(0, (cx | 0) - Rr); i <= Math.min(DX - 1, (cx | 0) + Rr); i++) {
        const w = Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / (r * r)), k = i + j * DX;
        R[k] = Math.min(4, R[k] + ar * w); G[k] = Math.min(4, G[k] + ag * w); B[k] = Math.min(4, B[k] + ab * w);
      }
  }

  function step(dt, curlK, visc, persist, flow) {
    // A slow background river (two drifting gyres) whose speed follows the tempo.
    flowPh += dt * 0.11 * flow;
    const F = (0.25 + rate * 0.12) * flow, fk = Math.min(1, dt * 0.6);
    for (let j = 1; j < NY - 1; j++) {
      const sy = Math.sin(j / NY * Math.PI * 2 + flowPh * 2.1);
      for (let i = 1; i < NX - 1; i++) {
        const k = i + j * NX;
        u[k] += (F * sy - u[k]) * fk * 0.15; v[k] += (F * 0.6 * Math.cos(i / NX * Math.PI * 2 - flowPh * 1.7) - v[k]) * fk * 0.15;
      }
    }
    // Vorticity confinement keeps the curls alive on a coarse grid.
    for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const k = i + j * NX; curl[k] = 0.5 * ((v[k + 1] - v[k - 1]) - (u[k + NX] - u[k - NX]));
    }
    const eps = curlK * dt;
    for (let j = 2; j < NY - 2; j++) for (let i = 2; i < NX - 2; i++) {
      const k = i + j * NX;
      const gx = 0.5 * (Math.abs(curl[k + 1]) - Math.abs(curl[k - 1])), gy = 0.5 * (Math.abs(curl[k + NX]) - Math.abs(curl[k - NX]));
      const l = Math.hypot(gx, gy) + 1e-5, w = curl[k];
      u[k] += eps * (gy / l) * w; v[k] -= eps * (gx / l) * w;
    }
    // Project (incompressible), warm-started from last frame's pressure; Gauss-Seidel in place.
    for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const k = i + j * NX; div[k] = 0.5 * (u[k + 1] - u[k - 1] + v[k + NX] - v[k - NX]); p[k] *= 0.9;
    }
    for (let it = 0; it < 10; it++)
      for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
        const k = i + j * NX;
        p[k] = (p[i > 1 ? k - 1 : k] + p[i < NX - 2 ? k + 1 : k] + p[j > 1 ? k - NX : k] + p[j < NY - 2 ? k + NX : k] - div[k]) * 0.25;
      }
    for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const k = i + j * NX;
      u[k] -= 0.5 * (p[i < NX - 2 ? k + 1 : k] - p[i > 1 ? k - 1 : k]);
      v[k] -= 0.5 * (p[j < NY - 2 ? k + NX : k] - p[j > 1 ? k - NX : k]);
    }
    // Advect velocity (semi-Lagrangian); viscosity is how fast motion settles.
    const keep = Math.exp(-dt * visc);
    for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const k = i + j * NX, x = i - u[k] * dt, y = j - v[k] * dt;
      u2[k] = sample(u, NX, NY, x, y) * keep; v2[k] = sample(v, NX, NY, x, y) * keep;
    }
    for (let i = 0; i < NX; i++) { u2[i] = v2[i] = u2[i + (NY - 1) * NX] = v2[i + (NY - 1) * NX] = 0; }
    for (let j = 0; j < NY; j++) { u2[j * NX] = v2[j * NX] = u2[j * NX + NX - 1] = v2[j * NX + NX - 1] = 0; }
    [u, u2] = [u2, u]; [v, v2] = [v2, v];
    // Advect the dye on the finer grid (2 dye cells per velocity cell).
    const kd = Math.exp(-dt * 0.5 / persist), s2 = 2 * dt;
    for (let j = 0; j < DY; j++) {
      const vy = Math.min(NY - 1.001, Math.max(0, (j + 0.5) / 2 - 0.5)), vj = vy | 0, wy = vy - vj;
      for (let i = 0; i < DX; i++) {
        const vx = Math.min(NX - 1.001, Math.max(0, (i + 0.5) / 2 - 0.5)), vi = vx | 0, wx = vx - vi, q = vi + vj * NX;
        const a = (1 - wx) * (1 - wy), b = wx * (1 - wy), c = (1 - wx) * wy, d = wx * wy;
        const uu = u[q] * a + u[q + 1] * b + u[q + NX] * c + u[q + NX + 1] * d;
        const vv = v[q] * a + v[q + 1] * b + v[q + NX] * c + v[q + NX + 1] * d;
        let x = i - uu * s2, y = j - vv * s2;
        x = x < 0 ? 0 : x > DX - 1.001 ? DX - 1.001 : x; y = y < 0 ? 0 : y > DY - 1.001 ? DY - 1.001 : y;
        const xi = x | 0, yj = y | 0, fx = x - xi, fy = y - yj, k = xi + yj * DX, o = i + j * DX;
        const A = (1 - fx) * (1 - fy), Bw = fx * (1 - fy), C = (1 - fx) * fy, D = fx * fy;
        R2[o] = (R[k] * A + R[k + 1] * Bw + R[k + DX] * C + R[k + DX + 1] * D) * kd;
        G2[o] = (G[k] * A + G[k + 1] * Bw + G[k + DX] * C + G[k + DX + 1] * D) * kd;
        B2[o] = (B[k] * A + B[k + 1] * Bw + B[k + DX] * C + B[k + DX + 1] * D) * kd;
      }
    }
    [R, R2] = [R2, R]; [G, G2] = [G2, G]; [B, B2] = [B2, B];
  }

  function paintDye(g) {
    for (let k = 0, o = 0; k < dn; k++, o += 4) {
      px[o] = TONE[Math.min(1023, (R[k] * 256) | 0)]; px[o + 1] = TONE[Math.min(1023, (G[k] * 256) | 0)]; px[o + 2] = TONE[Math.min(1023, (B[k] * 256) | 0)];
    }
    og.putImageData(img, 0, 0);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.2;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(off, 0, 0, 1280, 720);
    g.globalAlpha = 1;
  }

  // Each thread is a list of points { x, y, age, life, e } dropped by its head and then carried by the water;
  // e is how hard that voice was playing when the point was laid, so the line keeps a record of the playing.
  function paintThread(g, h, wMul, gain) {
    const pts = h.pts; if (pts.length < 2) return;
    const BINS = 9, col = TCOL[h.i];
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let b = 0; b < BINS; b++) {
        g.beginPath(); let any = false;
        for (let i = 1; i < pts.length; i++) {
          const q = pts[i], I = Math.pow(Math.max(0, 1 - q.age / q.life), 1.3) * (0.3 + 0.7 * Math.min(1, q.e));
          if (I < 0.01) continue;
          if (Math.min(BINS - 1, (I * BINS) | 0) !== b) continue;
          const o = pts[i - 1], r = pts[i + 1] || q;
          g.moveTo((o.x + q.x) / 2, (o.y + q.y) / 2); g.quadraticCurveTo(q.x, q.y, (q.x + r.x) / 2, (q.y + r.y) / 2); any = true;
        }
        if (!any) continue;
        const I = (b + 0.5) / BINS, main0 = h.i === 0 ? 1 : 0.75;
        if (pass === 0) { g.strokeStyle = `rgba(${col[0]},${Math.round(col[1] * 0.8)},${Math.round(col[2] * 0.5)},${(I * 0.07 * main0 * gain).toFixed(3)})`; g.lineWidth = (3 + 6 * I) * Math.sqrt(wMul); }
        else { g.strokeStyle = `rgba(${col[0]},${col[1]},${Math.round(col[2] * (0.7 + 0.3 * I))},${((0.12 + I * 0.6 * main0) * gain).toFixed(3)})`; g.lineWidth = (0.45 + 1.5 * I * I) * wMul * (h.i === 0 ? 1 : 0.8); }
        g.stroke();
      }
    }
  }

  function headAt(lag) {                         // main head's path `lag` seconds ago, with its direction there
    if (!hist.length) return { x: main.x, y: main.y, a: main.a };
    let k = hist.length - 1; while (k > 0 && time - hist[k].t < lag) k--;
    return hist[k];
  }

  // Knobs folded into fixed choices (2026-10-31, at most 5 knobs). Curl and chord swirl keep the drives they had as knobs,
  // computed exactly as the harness's x.p does at its default depth 0.5, so the water moves as before.
  const drv = (x, base, min, max, sign, f) => Math.max(min, Math.min(max, base + sign * 0.5 * (max - min) * (x.feat[f] - 0)));
  const curlOf = (x) => drv(x, 3.5, 0, 12, 1, 'density');    // how curly the water is; curlier with fuller chords
  const swirlOf = (x) => drv(x, 1, 0, 3, 1, 'bass');         // how hard big chords tear vortices; harder with more bass
  const STEER = 1, VISC = 0.45, PERSIST = 1;                 // steering by the melody, how fast motion settles, how long lines last

  // Knob pictures: little braided threads in the thread colours.
  const tc = (i, a = 1) => `rgba(${TCOL[i][0]},${TCOL[i][1]},${TCOL[i][2]},${a})`;
  function strand(g, w, h, amp, ph, col, lw, cycles = 1.5) {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
    for (let x = 3; x <= w - 3; x++) { const y = h / 2 + Math.sin((x - 3) / (w - 6) * Math.PI * 2 * cycles + ph) * amp; x === 3 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
  }

  TOOLS.push({
    id: 'current', name: 'The current', tag: 'v3',
    blurb: 'Thin threads braid through moving water: the melody steers the white-gold one, inner voices and the bass weave around it and cross on their own notes, swelling as they play. Chords pour coloured dye that the water spreads; tempo sets how fast the water runs and big chords tear vortices.',
    params: [
      // Five knobs; keys, ranges, defaults and drives are unchanged from v3, so saved settings still apply.
      { key: 'threads', label: 'how many threads', min: 1, max: 5, step: 1, value: 3,
        hint: 'How many threads braid together. Left: the melody’s white-gold line alone. Right: five, with the inner voices and the bass.',
        icon: (g, v, w, h) => { const n = Math.round(1 + v * 4);
          for (let i = n - 1; i >= 0; i--) strand(g, w, h, n > 1 ? 8 : 0, (i / n) * Math.PI * 2, tc(i), i ? 1.2 : 1.6, 1); } },
      { key: 'braid', label: 'how wide they weave', min: 0, max: 220, step: 1, value: 70,
        hint: 'How far the other threads swing around the melody’s thread. Left: tight together, almost one line. Right: wide loops that cross far apart.',
        icon: (g, v, w, h) => { const a = 0.6 + v * (h / 2 - 3.5);
          strand(g, w, h, a, Math.PI, tc(2), 1.2); strand(g, w, h, a, 0, tc(1), 1.2); strand(g, w, h, a * 0.12, 0, tc(0), 1.6); } },
      { key: 'width', label: 'thread thickness', min: 0.3, max: 2.5, value: 0.9, drive: '+level',
        hint: 'How thick the threads are drawn. Left: hair-thin. Right: thick, glowing cords.',
        icon: (g, v, w, h) => { const lw = 0.5 + v * 4;
          strand(g, w, h, 5, 0, tc(1, 0.12), lw * 2.4); strand(g, w, h, 5, 0, tc(0), lw); } },
      { key: 'flow', label: 'water speed', min: 0.2, max: 3, value: 1, drive: '+rate',
        hint: 'How fast the water runs and the threads travel. Left: a slow, lazy drift. Right: a rushing stream.',
        icon: (g, v, w, h) => { const L = 5 + v * (w - 14), col = '#6f9fc4';
          [[6, 3], [h / 2, 9], [h - 6, 0]].forEach(([y, dx]) => ICON.arrow(g, 4 + dx * (1 - v), y, Math.min(w - 3, 4 + dx * (1 - v) + L), y, col, 1.3)); } },
      { key: 'hue', label: 'ink colour', min: 0, max: 360, step: 1, value: 350,
        hint: 'The colour the chords pour into the water. Left and right are both red; in between it runs orange, yellow, green, blue, violet.',
        icon: (g, v, w, h) => { const c = hsl(v * 360, 0.85, 0.45).map((q) => Math.round(q * 255));
          ICON.blur(g, 2.5, () => { g.fillStyle = `rgb(${c})`; g.beginPath(); g.ellipse(w / 2, h / 2 - 2, w / 2 - 6, h / 2 - 6, 0, 0, Math.PI * 2); g.fill(); });
          for (let i = 0; i < 12; i++) ICON.rect(g, 3 + i * (w - 6) / 12, h - 4, Math.ceil((w - 6) / 12), 2.5, `hsl(${i * 30},85%,50%)`);
          ICON.rect(g, 2 + v * (w - 6), h - 6, 2, 5.5, ICON.ink); } },
    ],
    reset(x) {
      u.fill(0); v.fill(0); p.fill(0); R.fill(0); G.fill(0); B.fill(0);
      Object.assign(main, { x: x.W / 2, y: x.H / 2, a: x.rnd(-Math.PI, Math.PI), lastTop: null, side: 1 }); main.ta = main.a;
      heads = []; for (let i = 0; i < MAXT; i++) heads.push({ i, x: main.x, y: main.y, pts: [], e: 0, ph: 0, tph: 0, drop: 0 });
      hist = []; time = 0; rate = 0; flash = 0; flowPh = 0;
    },
    onChord(ch, x) {
      const T = Math.round(x.p('threads')), steer = STEER, loud = ch.vel / 110;
      const stepM = main.lastTop === null ? 0 : clamp(ch.hi - main.lastTop, -7, 7);
      main.ta += stepM * 0.13 * steer / (1 + rate * 0.15); main.lastTop = ch.hi; rate = Math.min(12, rate + 1);
      if (stepM) main.side = Math.sign(stepM);
      // Voices: rank the chord top to bottom and hand each note to a thread (single notes go by register).
      const ns = ch.notes.slice().sort((a, b) => b.m - a.m), hit = new Set();
      for (let r = 0; r < ns.length; r++) {
        const i = T === 1 ? 0 : ns.length === 1 ? (ns[0].m >= 55 ? 0 : T - 1) : Math.round(r / (ns.length - 1) * (T - 1));
        const h = heads[i], nv = ns[r].v / 110;
        h.e = Math.min(1.6, h.e + 0.45 * nv + 0.2 * Math.min(1, ns[r].d));
        if (i > 0 && !hit.has(i)) { hit.add(i); h.tph += (0.6 + 0.4 * nv) * (h.i % 2 ? 1 : -1) * Math.max(0.3, steer) / (1 + rate * 0.12); }   // the strand crosses over
      }
      // Every attack nudges the main thread sideways (melody direction picks the side) so the line ripples.
      const ca = Math.cos(main.a), sa = Math.sin(main.a), side = main.side;
      splatVel(main.x - ca * 14, main.y - sa * 14, -sa * side * 10 * loud, ca * side * 10 * loud, 3);
      splatDye(main.x, main.y, [1, 0.9, 0.7], 0.5 * loud, 1.8);
      flash = Math.max(flash, 0.5 * loud);
      // Chords pour colour: hue from the dye-colour setting, shifted by the chord's register, brighter when louder.
      if (ch.notes.length >= 2 || ch.vel >= 84) {   // (loud single notes count too: orchestral transcriptions are thin)
        const avg = ch.notes.reduce((s, q) => s + q.m, 0) / ch.notes.length;
        const col = hsl(x.p('hue') + (x.pitch01(avg) - 0.5) * 50 + x.rnd(-8, 8), 0.85, 0.26 + 0.1 * x.pitch01(avg) + 0.12 * loud);
        const bh = heads[Math.min(T - 1, heads.length - 1)], amt = (0.5 + 0.3 * Math.min(4, ch.notes.length)) * loud;
        splatDye(bh.x - ca * 30, bh.y - sa * 30, col, amt, 3.5 + Math.min(6, ch.notes.length) * 1.0);
      }
      // Big chords tear the water: a pair of opposite vortices behind the head rolls the dye into a mushroom.
      const sw = swirlOf(x);
      if (ch.vel >= 88 && ch.notes.length >= 3 && sw > 0.01) {
        const s = (1 + (ch.vel - 88) / 16) * sw, back = 50, offs = 34 + 10 * s;
        const qx = main.x - ca * back, qy = main.y - sa * back, turn = Math.random() < 0.5 ? 1 : -1;
        splatSwirl(qx - sa * offs, qy + ca * offs, 40 * s * turn, 4.2);
        splatSwirl(qx + sa * offs, qy - ca * offs, -40 * s * turn, 4.2);
        const col = hsl(x.p('hue') + x.rnd(-15, 15), 0.9, 0.42);
        splatDye(qx, qy, col, 1.4 * Math.min(2, s), 6);
        splatDye(qx, qy, [1, 0.95, 0.85], 0.6 * Math.min(2, s), 2.5);
        flash = 1.2;
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt; time += dt;
      const T = Math.round(x.p('threads')), flow = x.p('flow'), persist = PERSIST, wMul = x.p('width'), braid = x.p('braid');
      rate *= Math.pow(0.5, dt / 0.6); flash *= Math.pow(0.5, dt / 0.15);
      // The main head: heading turned by melodic steps, leaning up for high notes and down for low ones, kept off the walls.
      const top = x.top();
      if (top) {
        const wantY = x.H * (0.72 - 0.44 * x.pitch01(top.m)), dy = (wantY - main.y) / x.H;
        main.ta += clamp(dy * Math.cos(main.a), -1, 1) * dt * 1.6 * STEER;
      }
      const m = 170, ex = main.x < m ? m - main.x : main.x > x.W - m ? x.W - m - main.x : 0, ey = main.y < m ? m - main.y : main.y > x.H - m ? x.H - m - main.y : 0;
      if (ex || ey) {
        const want = Math.atan2(x.H / 2 - main.y, x.W / 2 - main.x);
        let d = want - main.ta; d = Math.atan2(Math.sin(d), Math.cos(d));
        main.ta += d * Math.min(1, dt * (Math.hypot(ex, ey) / m) * 7);
      }
      main.a += (main.ta - main.a) * (1 - Math.exp(-dt / 0.16));
      const speed = (45 + rate * 30) * flow, ca = Math.cos(main.a), sa = Math.sin(main.a);
      main.x = clamp(main.x + ca * speed * dt, 24, x.W - 24); main.y = clamp(main.y + sa * speed * dt, 24, x.H - 24);
      hist.push({ t: time, x: main.x, y: main.y, a: main.a }); while (hist.length > 2 && time - hist[0].t > 1.5) hist.shift();
      steerVel(main.x, main.y, ca * speed / CELL * 0.45, sa * speed / CELL * 0.45, 1.8, Math.min(1, dt * 10));

      // The strands weave around the main path: offset sideways by a sine whose phase drifts with the flow and
      // jumps (eased) on each of that voice's notes, so the crossings land on the music.
      for (let i = 0; i < MAXT; i++) {
        const h = heads[i], ox = h.x, oy = h.y;
        h.e = Math.max(h.e * Math.pow(0.5, dt / 0.35), i ? x.level * 0.45 : 0);
        if (i === 0) { h.x = main.x; h.y = main.y; }
        else {
          h.tph += dt * (0.9 + rate * 0.08) * flow * (i % 2 ? 1 : -1);
          h.ph += (h.tph - h.ph) * (1 - Math.exp(-dt / 0.18));
          const k = T > 1 ? (i - 1) / Math.max(1, T - 1) : 0, base = headAt(0.06 * i);
          const amp = braid * (0.55 + 0.45 * Math.min(1, h.e)) * (1 + 0.25 * (i - 1));
          const off = amp * Math.sin(h.ph + k * Math.PI * 2);
          h.x = clamp(base.x - Math.sin(base.a) * off, 24, x.W - 24); h.y = clamp(base.y + Math.cos(base.a) * off, 24, x.H - 24);
        }
        if (i >= T) { h.pts.length = 0; continue; }
        // A faint line of the thread's own colour laid into the water along the path walked this frame.
        const dist = Math.hypot(h.x - ox, h.y - oy), segs = Math.min(12, Math.max(1, Math.ceil(dist / 4))), c = TCOL[i];
        const tint = [c[0] / 255, c[1] / 255 * 0.85, c[2] / 255 * 0.6], amt = (0.03 + 0.07 * Math.min(1, h.e)) * (i ? 0.7 : 1);
        if (dist < 200) for (let s = 1; s <= segs; s++) splatDye(ox + (h.x - ox) * s / segs, oy + (h.y - oy) * s / segs, tint, amt, 0.8);
        h.drop += dist;
        const life = (2.6 + 4 * Math.exp(-rate / 3)) * persist / (1 + rate * 0.15);
        if (h.drop > 5 || !h.pts.length || dist > 200) { h.pts.push({ x: h.x, y: h.y, age: 0, life, e: h.e }); h.drop = 0; }
        else { const q = h.pts[h.pts.length - 1]; q.x = h.x; q.y = h.y; q.e = Math.max(q.e, h.e); }
      }

      step(dt, curlOf(x), VISC, persist, flow);

      const cap = Math.min(1300, 3200 / T); let total = 0;
      for (let i = 0; i < T; i++) {
        const pts = heads[i].pts;
        for (let k = 0; k < pts.length - 1; k++) {
          const q = pts[k], gx = q.x / CELL - 0.5, gy = q.y / CELL - 0.5;
          q.x += sample(u, NX, NY, gx, gy) * CELL * dt; q.y += sample(v, NX, NY, gx, gy) * CELL * dt; q.age += dt;
          if (q.x < 6 || q.x > x.W - 6 || q.y < 6 || q.y > x.H - 6) { q.x = clamp(q.x, 0, x.W); q.y = clamp(q.y, 0, x.H); q.age = Math.max(q.age, q.life); }
        }
        if (pts.length < cap) for (let k = pts.length - 1; k > 0; k--) {   // stretched stretches get new points
          const a = pts[k - 1], b = pts[k];
          if (Math.hypot(b.x - a.x, b.y - a.y) > 14) pts.splice(k, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, age: (a.age + b.age) / 2, life: a.life, e: (a.e + b.e) / 2 });
        }
        let k = 0; while (k < pts.length - 1 && pts[k].age >= pts[k].life) k++;
        if (k) pts.splice(0, k);
        total += pts.length;
      }
      const gain = Math.min(1, Math.sqrt(1300 / Math.max(1, total)));   // a dense tangle dims instead of burning white

      paintDye(g);
      g.globalCompositeOperation = 'lighter';
      for (let i = T - 1; i >= 0; i--) paintThread(g, heads[i], wMul, gain);
      // The heads: the main one glows and flashes on attacks; the strands carry a small bead.
      const f = 1 + flash * 2.5, gr = g.createRadialGradient(main.x, main.y, 0, main.x, main.y, 16 * f);
      gr.addColorStop(0, `rgba(255,250,235,${0.3 + 0.4 * Math.min(1, flash)})`); gr.addColorStop(1, 'rgba(255,200,110,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(main.x, main.y, 16 * f, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < T; i++) {
        const h = heads[i], c = TCOL[i];
        g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(i ? 0.3 : 0.55) + 0.4 * Math.min(1, h.e)})`;
        g.beginPath(); g.arc(h.x, h.y, (1.6 + 1.6 * Math.min(1, h.e)) * Math.sqrt(wMul), 0, Math.PI * 2); g.fill();
      }
    },
  });
})();
