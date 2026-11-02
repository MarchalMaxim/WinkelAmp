// Contours: every attack raises a soft hill (or sinks a pit) in a scalar field; the field is drawn as
// topographic isolines (marching squares on a coarse grid). Loud = many tight rings, soft = slow drifting lines.
(() => {
  let hills = [], time = 0, phase = 0, flash = 0, avgV = 70, chordY = 0.5;
  let F = new Float32Array(0), gw = 0, gh = 0, cell = 0;
  let gx = new Float32Array(0), gy = new Float32Array(0), cx1 = gx, cx2 = gx, cy1 = gx, cy2 = gx, NX = gx, NY = gx;
  const buckets = new Map();
  const tint = document.createElement('canvas'); let tg = tint.getContext('2d'), img = null;
  const FIFTH = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]; // pitch class -> position on the circle of fifths
  const ord = new Array(12); FIFTH.forEach((pc, i) => (ord[pc] = i));

  function grid(c) {
    if (c === cell) return;
    cell = c; gw = Math.ceil(1280 / c) + 1; gh = Math.ceil(720 / c) + 1;
    F = new Float32Array(gw * gh); gx = new Float32Array(gw); gy = new Float32Array(gh); NX = new Float32Array(gw * gh); NY = new Float32Array(gw * gh);
    cx1 = new Float32Array(gw); cx2 = new Float32Array(gw); cy1 = new Float32Array(gh); cy2 = new Float32Array(gh);
    tint.width = gw; tint.height = gh; tg = tint.getContext('2d'); img = tg.createImageData(gw, gh);
  }
  // Colour ramps: heat 0 = ice, 0.5 = bone/ochre, 1 = blood/ember. [low, high] per ramp.
  const RAMPS = [[[18, 40, 96], [205, 232, 255]], [[92, 58, 26], [244, 226, 182]], [[120, 6, 12], [255, 196, 150]]];
  function ramp(h, t) {
    const k = Math.min(1.999, Math.max(0, h) * 2), i = Math.floor(k), f = k - i, A = RAMPS[i], B = RAMPS[i + 1];
    const out = [0, 0, 0];
    for (let j = 0; j < 3; j++) { const lo = A[0][j] + (B[0][j] - A[0][j]) * f, hi = A[1][j] + (B[1][j] - A[1][j]) * f; out[j] = lo + (hi - lo) * t; }
    return out;
  }

  const rampHex = (h, t) => { const c = ramp(h, t); return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; };
  // Fixed choices (were knobs): map 4 = mirrored circle-of-fifths (across) by octave (up); pits = notes softer than the recent average.
  const LAYOUT = 4, SIGN = 2, LW = 1.4, RES = 9, WARP = 0.35;

  TOOLS.push({
    id: 'contours', name: 'Contours', tag: 'new',
    blurb: 'Every note raises a soft hill (warm) or, when played softer than the music around it, sinks a pit (cool) on a mirrored map drawn as topographic contour lines. Across: the note\'s place on the circle of fifths (one key = one region); up: its octave, so low notes sit low. Loud chords burst into many tight rings; calm passages drift and send rings outward.',
    // At most 5 knobs (lab/README.md). Fixed now: line width 1.4, grid 9 px, turbulence 0.35, the mirrored fifths map,
    // pits for softer-than-average notes. 'lines' is a new key (its range changed), so an old saved 'count' doesn't apply.
    params: [
      { key: 'lines', label: 'how many lines', min: 3, max: 24, step: 1, value: 7, less: 3, drive: '+level',
        hint: 'How many contour lines a hill gets. Left: a few calm rings. Right: dense, tightly packed rings.',
        icon: (g, v, w, h) => { const n = Math.round(2 + v * 7), c = rampHex(0.72, 0.6); for (let i = 1; i <= n; i++) ICON.ring(g, w / 2, h / 2, (i / n) * (h / 2 - 1.5), c, 1); } },
      { key: 'size', label: 'how wide the hills', min: 0.4, max: 1.8, value: 0.9, drive: '+bass',
        hint: 'How wide each note\'s hill spreads. Left: small, separate peaks. Right: broad hills that merge into ridges.',
        icon: (g, v, w, h) => { const R = 3 + v * (h / 2 - 3), c = rampHex(0.72, 0.6); for (let i = 1; i <= 4; i++) ICON.ring(g, w / 2, h / 2, (i / 4) * R, c, 1.1); } },
      { key: 'decay', label: 'how long hills stay', min: 0.5, max: 10, value: 2.4, less: 0.8,
        hint: 'How long a hill stays before it sinks back. Left: a short pulse. Right: the map remembers for many seconds.',
        icon: (g, v, w, h) => { const life = 0.12 + v * 0.88, c = rampHex(0.72, 0.65);
          for (let i = 0; i < 3; i++) { const a = Math.max(0, 1 - (i / 2) / life); if (a > 0) ICON.alpha(g, a, () => { for (let k = 1; k <= 3; k++) ICON.ring(g, 7 + i * 13, h / 2, k * 2.1, c, 1); }); } } },
      { key: 'flow', label: 'drift when calm', min: 0, max: 2, value: 0.9, drive: '-level',
        hint: 'How much the map drifts and sends rings outward. Left: still. Right: hills wander and rings stream out of the peaks.',
        icon: (g, v, w, h) => { const c = rampHex(0.72, 0.6);
          for (let k = 2; k >= 0; k--) ICON.alpha(g, k ? 0.25 * v * (3 - k) : 1, () => { const cx = w / 2 - 4 + k * 5 * v; for (let i = 1; i <= 3; i++) ICON.ring(g, cx, h / 2, i * 3.6, c, 1); });
          if (v > 0.15) ICON.arrow(g, w / 2 + 6, h / 2, w / 2 + 6 + 10 * v, h / 2, ICON.ink, 1.2); } },
      // 'tint' replaces 'heat' (was driven by loudness; now fixed, so the widget keeps to 3 driven knobs)
      { key: 'tint', label: 'colour', min: 0, max: 1, value: 0.72,
        hint: 'The colour of the hills. Left: icy blue. Middle: bone. Right: blood red and ember.',
        icon: (g, v, w, h) => { for (let i = 1; i <= 4; i++) ICON.ring(g, w / 2, h / 2, i * 2.9, rampHex(v, 0.15 + 0.22 * (4 - i)), 1.6); } },
      { key: 'howmuch', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much map it draws: how many contour lines and how long the hills stay. Left: a few lines round hills that fade fast. Right: the full, dense map. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { hills = []; time = Math.random() * 500; phase = 0; flash = 0; },
    onChord(ch, x) {
      const layout = LAYOUT, sign = SIGN, size = x.p('size');
      avgV += (ch.vel - avgV) * 0.12;
      // harmony: lowest note as root; a minor third above it (and no major third) = minor
      const pcs = new Set(ch.notes.map((n) => n.m % 12)), root = ch.lo % 12;
      const minor = pcs.has((root + 3) % 12) && !pcs.has((root + 4) % 12);
      chordY = 0.18 + 0.64 * Math.random();
      flash = Math.max(flash, ch.vel / 127);
      // sparse music (few attacks per second) gets bigger, longer-lived hills, so a lone motif still marks the map
      const sparse = Math.max(0, 1 - x.rate / 4);
      // ...and busy music gets shorter-lived ones, so the climax keeps distinct peaks instead of one flat mesa
      const busy = Math.min(1, Math.max(0, (x.rate - 5) / 8));
      const thick = 1 / Math.sqrt(Math.max(1, ch.notes.length / 3)); // a 10-note chord isn't 10x the mountain
      for (const n of ch.notes) {
        const p = Math.max(0, Math.min(1, (n.m - 24) / 72)), oct = Math.max(0, Math.min(1, (Math.floor(n.m / 12) - 2) / 5));
        let px, py;
        if (layout === 0) { px = 0.07 + 0.86 * p; py = chordY + (Math.random() - 0.5) * 0.08; }
        else if (layout === 1) { px = 0.1 + 0.8 * (ord[n.m % 12] / 11); py = 0.86 - 0.72 * oct; }
        else if (layout === 2) { px = 0.5 + (Math.random() < 0.5 ? -1 : 1) * (0.02 + 0.44 * p); py = chordY + (Math.random() - 0.5) * 0.12; }
        else if (layout === 4) { px = 0.5 + (Math.random() < 0.5 ? -1 : 1) * (0.05 + 0.4 * (ord[n.m % 12] / 11)); py = 0.84 - 0.68 * oct; }
        else { const a = (ord[n.m % 12] / 12) * Math.PI * 2 - Math.PI / 2 + time * 0.05, r = 0.08 + 0.36 * oct; px = 0.5 + Math.cos(a) * r * (x.H / x.W); py = 0.5 + Math.sin(a) * r; }
        px += (Math.random() - 0.5) * 0.02; py += (Math.random() - 0.5) * 0.03;
        let s = 1;
        if (sign === 1) s = minor ? -1 : 1;
        else if (sign === 2) s = n.v < avgV - 4 ? -1 : 1;
        else if (sign === 3) s = n.m < 48 ? -1 : 1;
        const rel = 0.5 * n.v / 105 + 0.5 * n.v / Math.max(55, avgV); // half absolute, half relative: quiet passages still raise hills
        const amp = Math.pow(rel, 1.3) * (1 + 0.8 * sparse - 0.25 * busy) * thick * s;
        // narrow enough that octaves stay separate peaks, and capped: loud bass (which also widens them) can't swallow the screen
        const sig = Math.min(64, size * (15 + 24 * Math.pow(1 - p, 1.5) + 4 * Math.min(2, n.d)) * (1 + 0.2 * sparse));
        hills.push({ x: px * x.W, y: py * x.H, amp, sig, age: 0, life: x.p('decay') * (0.75 + 0.2 * Math.min(3, n.d)) * (1 + 0.6 * sparse - 0.5 * busy) });
      }
      if (hills.length > 90) hills.splice(0, hills.length - 90);
    },
    frame(x) {
      const g = x.g, dt = x.dt; time += dt;
      grid(RES);
      const flow = x.p('flow'), warp = WARP, count = x.p('lines'), heat = x.p('tint'), lw = LW;
      const layout = LAYOUT;
      flash *= Math.pow(0.5, dt / 0.12);
      phase -= dt * 0.45 * flow; // rings slowly emanate from the peaks when the music relaxes

      // Field: a faint ground swell + separable gaussians per hill.
      // ground: products of per-column and per-row waves (separable, cheap)
      for (let i = 0; i < gw; i++) { const X = i * cell; cx1[i] = Math.sin(X * 0.0061 + time * 0.13); cx2[i] = Math.cos(X * 0.0047 - time * 0.09); }
      for (let j = 0; j < gh; j++) { const Y = j * cell; cy1[j] = 0.09 * Math.cos(Y * 0.0083 - time * 0.11); cy2[j] = 0.07 * Math.sin(Y * 0.0052 + time * 0.08); }
      for (let j = 0; j < gh; j++) { const r = j * gw, a1 = cy1[j], a2 = cy2[j]; for (let i = 0; i < gw; i++) F[r + i] = a1 * cx1[i] + a2 * cx2[i]; }
      // node positions: turbulence displaces the grid itself, so the lines wobble at no per-segment cost
      const T = warp * 16;
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const q = j * gw + i, X = i * cell, Y = j * cell;
        NX[q] = T ? X + T * Math.sin(Y * 0.011 + time * 0.9 + cx1[i] * 2) : X;
        NY[q] = T ? Y + T * Math.cos(X * 0.012 - time * 0.7 + cy1[j] * 12) : Y;
      }
      for (const h of hills) {
        h.age += dt;
        // flow: a slow curl-like drift
        const vx = Math.sin(h.y * 0.0042 + time * 0.31) + 0.5 * Math.sin(h.y * 0.011 - time * 0.2);
        const vy = Math.cos(h.x * 0.0037 - time * 0.27) + 0.5 * Math.cos(h.x * 0.009 + time * 0.17);
        h.x += vx * 38 * flow * dt; h.y += vy * 30 * flow * dt;
        if (layout === 3) { const dx = h.x - x.W / 2, dy = h.y - x.H / 2, a = 0.12 * flow * dt; h.x = x.W / 2 + dx * Math.cos(a) - dy * Math.sin(a); h.y = x.H / 2 + dx * Math.sin(a) + dy * Math.cos(a); }
        // attack: the hill swells up fast with a small overshoot (the rings burst outward), then decays and spreads
        const a = h.age, rise = a < 0.09 ? a / 0.09 : 1 + 0.22 * Math.exp(-(a - 0.09) / 0.12) * Math.sin(Math.min(Math.PI, (a - 0.09) * 14));
        const amp = h.amp * rise * Math.exp(-a / h.life);
        const sig = h.sig * (0.55 + 0.45 * Math.min(1, a / 0.3)) * (1 + 0.06 * a);
        h.cur = amp;
        if (Math.abs(amp) < 0.01) continue;
        const R = sig * 3.3, k = 1 / (2 * sig * sig);
        const i0 = Math.max(0, Math.floor((h.x - R) / cell)), i1 = Math.min(gw - 1, Math.ceil((h.x + R) / cell));
        const j0 = Math.max(0, Math.floor((h.y - R) / cell)), j1 = Math.min(gh - 1, Math.ceil((h.y + R) / cell));
        for (let i = i0; i <= i1; i++) { const d = i * cell - h.x; gx[i] = Math.exp(-d * d * k); }
        for (let j = j0; j <= j1; j++) { const d = j * cell - h.y; gy[j] = amp * Math.exp(-d * d * k); }
        for (let j = j0; j <= j1; j++) { const r = j * gw, w = gy[j]; for (let i = i0; i <= i1; i++) F[r + i] += w * gx[i]; }
      }
      hills = hills.filter((h) => h.age < h.life * 5 && (h.age < 1 || Math.abs(h.cur) > 0.01));
      if (layout === 2 || layout === 4) { // fold: the map is mirrored about the centre line
        for (let j = 0; j < gh; j++) { const r = j * gw; for (let i = 0; i < gw >> 1; i++) { const s = F[r + i] + F[r + gw - 1 - i]; F[r + i] = s; F[r + gw - 1 - i] = s; } }
      }
      // compress stacked hills so the climax saturates instead of exploding
      for (let q = 0; q < F.length; q++) F[q] = 1.7 * Math.tanh(F[q] / 1.7); // low ceiling: stacked hills flatten into a plateau, not a screen of rings

      // Tint: a soft hypsometric glow under the lines (tiny canvas, upscaled smoothly).
      const D = img.data, hot = ramp(heat, 0.25), cold = ramp((1 - heat) * 0.5, 0.2);
      for (let q = 0; q < F.length; q++) {
        const v = F[q], o = q * 4, c = v > 0 ? hot : cold, al = Math.min(1, Math.abs(v) / 1.6);
        D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255 * al * al * 0.55;
      }
      tg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true; g.globalAlpha = 0.6; g.drawImage(tint, 0, 0, gw * cell, gh * cell); g.globalAlpha = 1;

      // Marching squares, every level at once: per cell only the levels between its corners.
      const step = 1 / count;
      for (const b of buckets.values()) b.length = 0;
      for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
        const q = j * gw + i;
        const a = F[q] / step - phase, b = F[q + 1] / step - phase, c = F[q + gw + 1] / step - phase, d = F[q + gw] / step - phase;
        const mn = Math.min(a, b, c, d), mx = Math.max(a, b, c, d);
        const n0 = Math.ceil(mn), n1 = Math.floor(mx);
        if (n0 > n1) continue;
        const ax = NX[q], ay = NY[q], bx = NX[q + 1], by = NY[q + 1], cx = NX[q + gw + 1], cy = NY[q + gw + 1], dx = NX[q + gw], dy = NY[q + gw];
        for (let n = n0; n <= n1; n++) {
          const idx = (a > n ? 1 : 0) | (b > n ? 2 : 0) | (c > n ? 4 : 0) | (d > n ? 8 : 0);
          if (idx === 0 || idx === 15) continue;
          let arr = buckets.get(n); if (!arr) { arr = []; buckets.set(n, arr); }
          // crossing points on the four edges: top a-b, right b-c, bottom d-c, left a-d
          const tt = (n - a) / (b - a), rt = (n - b) / (c - b), bt = (n - d) / (c - d), lt = (n - a) / (d - a);
          const tX = ax + (bx - ax) * tt, tY = ay + (by - ay) * tt, rX = bx + (cx - bx) * rt, rY = by + (cy - by) * rt;
          const bX = dx + (cx - dx) * bt, bY = dy + (cy - dy) * bt, lX = ax + (dx - ax) * lt, lY = ay + (dy - ay) * lt;
          switch (idx) {
            case 1: case 14: arr.push(lX, lY, tX, tY); break;
            case 2: case 13: arr.push(tX, tY, rX, rY); break;
            case 3: case 12: arr.push(lX, lY, rX, rY); break;
            case 4: case 11: arr.push(rX, rY, bX, bY); break;
            case 6: case 9: arr.push(tX, tY, bX, bY); break;
            case 7: case 8: arr.push(lX, lY, bX, bY); break;
            case 5: arr.push(lX, lY, tX, tY, rX, rY, bX, bY); break;
            case 10: arr.push(tX, tY, rX, rY, bX, bY, lX, lY); break;
          }
        }
      }
      // Draw: hills in the ramp's colour (brighter towards the peaks), pits in the opposite temperature.
      g.lineCap = lw > 2 ? 'round' : 'butt';
      for (const [n, arr] of buckets) {
        if (!arr.length) { buckets.delete(n); continue; }
        const e = (n + phase) * step, up = e > 0, t = Math.min(1, Math.abs(e) / 2.2);
        const c = up ? ramp(heat, 0.25 + 0.75 * t) : ramp((1 - heat) * 0.5, 0.15 + 0.6 * t);
        const index = ((n % 5) + 5) % 5 === 0;
        const al = Math.min(1, Math.abs(e) * 2.2) * (up ? 0.95 : 0.75);
        const br = 1 + 0.55 * flash;
        g.strokeStyle = `rgba(${Math.min(255, c[0] * br) | 0},${Math.min(255, c[1] * br) | 0},${Math.min(255, c[2] * br) | 0},${al.toFixed(3)})`;
        g.lineWidth = lw * (index ? 2.3 : 1) * (1 + 0.6 * flash);
        g.beginPath();
        for (let s = 0; s < arr.length; s += 4) { g.moveTo(arr[s], arr[s + 1]); g.lineTo(arr[s + 2], arr[s + 3]); }
        g.stroke();
      }
    },
  });
})();
