// Hilma af Klint: spiritual geometry in soft pastels on a deep ground. A split central disc that the bass swells;
// the harmony chooses the forms around it (major chords open a ring of petals, minor chords close them into paired
// spirals); every attack blooms a new ring out to a radius set by its top note; melody notes leave mirrored twin forms
// in the wings, warm on the left, cool on the right.
(() => {
  const TAU = Math.PI * 2;
  // Hilma's pastels (r,g,b)
  const OCHRE = [226, 178, 92], ROSE = [234, 160, 166], SKY = [150, 192, 228], LILAC = [186, 162, 218],
    SAGE = [170, 198, 158], CREAM = [242, 230, 208];
  const RING_COLS = [OCHRE, ROSE, LILAC, SKY, SAGE]; // walked around the circle of fifths
  const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  const ringCol = (pc) => { const f = (((pc * 7) % 12) / 12) * RING_COLS.length, i = Math.floor(f);
    return mix(RING_COLS[i % RING_COLS.length], RING_COLS[(i + 1) % RING_COLS.length], f - i); };

  const chroma = new Float32Array(12);
  let chT = 0, mode = -0.3, modeT = -0.3, root = 1, bass = 0, bloom = 0, spin = 0, rings = [], twins = [], lastTop = -1, ground = null;

  // Which triad do the recent notes spell? Returns { q: +1 major, -1 minor, 0 unclear, root }.
  function harmony() {
    let tot = 0; for (const c of chroma) tot += c; if (tot < 0.2) return { q: 0, root };
    let best = -9, br = 0, bq = 0;
    for (let r = 0; r < 12; r++) {
      const c = (i) => chroma[(r + i) % 12] / tot;
      const M = c(0) + c(4) + c(7) - 0.7 * c(3), m = c(0) + c(3) + c(7) - 0.7 * c(4);
      if (M > best) { best = M; br = r; bq = 1; } if (m > best) { best = m; br = r; bq = -1; }
    }
    const c = (i) => chroma[(br + i) % 12] / tot;
    return { q: Math.abs(c(4) - c(3)) > 0.08 ? bq : 0, root: br };
  }

  // A vesica petal from radius r0 to r1 along +x, half-width w.
  function petal(g, r0, r1, w) {
    const m = (r0 + r1) / 2; g.beginPath(); g.moveTo(r0, 0);
    g.quadraticCurveTo(m, -w * 2, r1, 0); g.quadraticCurveTo(m, w * 2, r0, 0); g.closePath();
  }
  // A snail spiral around (0,0): starts at radius R on angle a0, winds `turns` inward (dir ±1), tapering.
  function snail(g, R, a0, turns, dir, col, alpha, lw) {
    // one filled, tapering ribbon (no seams): left edge out, right edge back
    const N = Math.max(16, Math.round(turns * 48)), L = [], Rt = [];
    let ex = 0, ey = 0;
    for (let i = 0; i <= N; i++) {
      const s = i / N, r = R * (1 - s * 0.9), a = a0 + dir * s * turns * TAU, x = Math.cos(a) * r, y = Math.sin(a) * r;
      const half = Math.max(0.4, lw * (1 - s * 0.85)) / 2, nx = Math.cos(a), ny = Math.sin(a);
      L.push(x + nx * half, y + ny * half); Rt.push(x - nx * half, y - ny * half); ex = x; ey = y;
    }
    g.fillStyle = rgba(col, alpha); g.beginPath(); g.moveTo(L[0], L[1]);
    for (let i = 2; i < L.length; i += 2) g.lineTo(L[i], L[i + 1]);
    for (let i = Rt.length - 2; i >= 0; i -= 2) g.lineTo(Rt[i], Rt[i + 1]);
    g.closePath(); g.fill();
    g.beginPath(); g.arc(ex, ey, Math.max(1.2, lw * 0.5), 0, TAU); g.fill();
  }
  // A disc split down the middle: left half a, right half b.
  function halves(g, r, a, b, alpha) {
    g.fillStyle = rgba(a, alpha); g.beginPath(); g.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5); g.fill();
    g.fillStyle = rgba(b, alpha); g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); g.fill();
  }

  // Knob pictures
  const C = (c) => `rgb(${c.join(',')})`;
  const iconHalves = (g, x, y, r, a, b) => { g.fillStyle = C(a); g.beginPath(); g.arc(x, y, r, Math.PI / 2, Math.PI * 1.5); g.fill();
    g.fillStyle = C(b); g.beginPath(); g.arc(x, y, r, -Math.PI / 2, Math.PI / 2); g.fill(); };
  const iconRosette = (g, x, y, n, len, col) => { for (let i = 0; i < n; i++) { g.save(); g.translate(x, y); g.rotate((i / n) * TAU - Math.PI / 2);
    g.fillStyle = col; petal(g, 2.5, 2.5 + len, Math.max(0.9, len * 0.2 * (8 / Math.max(6, n)))); g.fill(); g.restore(); } ICON.dot(g, x, y, 2.6, C(OCHRE)); };

  TOOLS.push({
    id: 'hilma', name: 'Hilma af Klint', tag: 'new',
    blurb: 'Spiritual geometry after Hilma af Klint, in soft pastels on a deep ground. The bass swells the split disc in the middle. The harmony chooses the forms around it: major chords open a ring of petals, minor chords close them into curled spirals. Every chord blooms a new ring (higher top note, wider ring), and melody notes leave mirrored twin forms in the wings.',
    params: [
      { key: 'disc', label: 'disc size from the bass', min: 0, max: 1.6, value: 1,
        hint: 'How strongly the low notes grow the disc in the middle. Left: a small, steady disc. Right: heavy bass fills the centre.',
        icon: (g, v, w, h) => iconHalves(g, w / 2, h / 2, 3 + v * 9, OCHRE, ROSE) },
      { key: 'life', label: 'how long the rings stay', min: 1, max: 10, value: 4.5, drive: '-rate',
        hint: 'How long each chord’s ring stays before it fades. Left: rings flash and go. Right: they pile up into many circles.',
        icon: (g, v, w, h) => { const k = 0.6 + v * 4.6; for (let i = 0; i < 5; i++) { const a = Math.max(0, 1 - i / k); if (a > 0) ICON.ring(g, w / 2, h / 2, 2.5 + i * 2.3, ICON.lerp('#e2b25c', '#96c0e4', i / 4), 1.3 * a + 0.2); } } },
      { key: 'petals', label: 'how many petals', min: 4, max: 12, step: 2, value: 8,
        hint: 'How many petals open on major chords (minor chords curl half as many spirals). Left: a simple four-leaf cross. Right: a dense twelve-petal flower.',
        icon: (g, v, w, h) => iconRosette(g, w / 2, h / 2, 4 + Math.round(v * 4) * 2, 8.5, C(ROSE)) },
      { key: 'twins', label: 'twin forms on the melody', min: 0, max: 1, value: 0.6,
        hint: 'How many and how big the mirrored pairs are that melody notes leave on both sides. Left: none, just the centre figure. Right: large pairs in the wings.',
        icon: (g, v, w, h) => { if (v < 0.04) { ICON.line(g, w / 2, 4, w / 2, h - 4, ICON.dim, 1); return; } const r = 2 + v * 5;
          ICON.line(g, w / 2, 3, w / 2, h - 3, ICON.dim, 1); ICON.dot(g, w / 2 - 3.5 - r, h / 2, r, C(OCHRE)); ICON.dot(g, w / 2 + 3.5 + r, h / 2, r, C(SKY)); } },
      { key: 'turn', label: 'how fast it turns', min: 0, max: 1, value: 0.25, drive: '+rate',
        hint: 'How fast the petals and spirals revolve. Left: still, like a painting. Right: a slow whirl.',
        icon: (g, v, w, h) => { const r = 8.5, x = w / 2, y = h / 2; ICON.ring(g, x, y, r, ICON.dim, 1); ICON.dot(g, x, y, 2, C(OCHRE));
          if (v < 0.04) { ICON.dot(g, x, y - r, 2, C(LILAC)); return; } const a1 = -Math.PI / 2 + 0.25 + v * Math.PI * 1.55;
          g.strokeStyle = C(LILAC); g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, a1); g.stroke();
          g.fillStyle = C(LILAC); g.beginPath(); const tx = x + Math.cos(a1) * r, ty = y + Math.sin(a1) * r, d = a1 + Math.PI / 2;
          g.moveTo(tx + Math.cos(d) * 4, ty + Math.sin(d) * 4); g.lineTo(tx + Math.cos(a1) * 3, ty + Math.sin(a1) * 3); g.lineTo(tx - Math.cos(a1) * 3, ty - Math.sin(a1) * 3); g.fill(); } },
    ],
    reset(x) { chroma.fill(0); chT = x.t; mode = modeT = -0.3; bass = 0; bloom = 0; spin = 0; rings = []; twins = []; lastTop = -1; },
    onChord(ch, x) {
      // the harmony: a decaying memory of pitch classes (bass notes count more), matched against major/minor triads
      const k = Math.pow(0.5, Math.max(0, ch.t - chT) / 1.2); chT = ch.t; for (let i = 0; i < 12; i++) chroma[i] *= k;
      for (const n of ch.notes) chroma[n.m % 12] += (n.v / 127) * (n.m === ch.lo ? 1.5 : 1);
      const hm = harmony(); if (hm.q) { modeT = hm.q; root = hm.root; }
      const v = ch.vel / 127; bloom = Math.max(bloom, v);
      if (ch.lo < 50) bass = Math.min(1.2, bass + 0.25 * v);
      // a ring blooms out to a radius set by the chord's top note
      const hi = Math.max(0, Math.min(1, (ch.hi - 40) / 52));
      rings.push({ hi, age: 0, v, col: ringCol(ch.hi % 12), q: hm.q || modeT, n: ch.notes.length });
      if (rings.length > 70) rings.shift();
      // melody: a new top note above the middle leaves a mirrored pair in the wings
      const tw = x.p('twins');
      if (tw > 0.03 && ch.hi >= 62 && ch.hi !== lastTop && Math.random() < 0.35 + 0.65 * tw)
        twins.push({ y: x.H * (0.86 - 0.72 * Math.min(1, (ch.hi - 62) / 34)), dx: x.H * (0.63 + Math.random() * 0.12), s: (8 + 22 * v) * (0.5 + tw), age: 0, q: hm.q || modeT, rot: Math.random() * TAU });
      if (twins.length > 24) twins.shift();
      lastTop = ch.hi;
    },
    frame(x) {
      const g = x.g, W = x.W, H = x.H, cx = W / 2, cy = H / 2, dt = x.dt;
      // smoothing: the form follows the harmony over about a second; the bass swells fast and sinks slowly
      mode += (modeT - mode) * (1 - Math.exp(-dt / 0.9));
      let lowNow = 0; for (const n of x.sounding()) if (n.m < 50) lowNow += n.v / 127;
      const bT = Math.min(1.2, lowNow / 1.6); bass += (bT - bass) * (1 - Math.exp(-dt / (bT > bass ? 0.08 : 0.7)));
      bloom *= Math.exp(-dt * 2.5); spin += dt * x.p('turn') * 0.55;
      const P = (mode + 1) / 2, u = Math.max(0, Math.min(1, (P - 0.3) / 0.4)), open = u * u * (3 - 2 * u), curl = 1 - open;
      const colA = mix(LILAC, OCHRE, open), colB = mix(SKY, ROSE, open);

      // deep ground (painted over the harness fade so the pastels sit on indigo, not on black)
      if (!ground) { ground = g.createRadialGradient(cx, cy, H * 0.05, cx, cy, W * 0.62); ground.addColorStop(0, '#1d1838'); ground.addColorStop(0.55, '#120f24'); ground.addColorStop(1, '#07060e'); }
      g.globalAlpha = 0.86; g.fillStyle = ground; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      // the frame of the painting: a faint great circle and the vertical axis
      g.strokeStyle = rgba(CREAM, 0.10); g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, H * 0.47, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(cx, H * 0.02); g.lineTo(cx, H * 0.98); g.stroke();

      const rd = H * (0.055 + 0.15 * Math.min(1, bass * x.p('disc'))) * (1 + 0.07 * bloom);
      const n = Math.round(x.p('petals') / 2) * 2, life = x.p('life');

      // rings, from the disc outward
      g.translate(cx, cy);
      for (const r of rings) {
        r.age += dt; const f = Math.max(0, 1 - r.age / life); if (f <= 0) continue;
        const R1 = rd * 1.15 + r.hi * (H * 0.46 - rd * 1.15), R = rd + (R1 - rd) * (1 - Math.exp(-r.age * 4.5)) + r.age * 3;
        const a = Math.pow(f, 1.4) * (0.35 + 0.55 * r.v);
        g.strokeStyle = rgba(r.col, a); g.lineWidth = 1.2 + 7 * r.v * r.v; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
        if (r.n >= 4) { g.strokeStyle = rgba(r.col, a * 0.13); g.lineWidth = 12 + 26 * r.v; g.beginPath(); g.arc(0, 0, R - 6 - 13 * r.v, 0, TAU); g.stroke(); }
        if (r.n >= 3) { g.strokeStyle = rgba(CREAM, a * 0.45); g.lineWidth = 0.8; g.beginPath(); g.arc(0, 0, R + 4 + 6 * r.v, 0, TAU); g.stroke(); }
        if (r.v > 0.7) { // loud chords bead their ring at the petal angles
          g.fillStyle = rgba(CREAM, a); for (let i = 0; i < n; i++) { const t = spin * (r.q > 0 ? 1 : -1) + (i + 0.5) / n * TAU; g.beginPath(); g.arc(Math.cos(t) * R, Math.sin(t) * R, 1.5 + 3 * r.v, 0, TAU); g.fill(); }
        }
      }
      rings = rings.filter((r) => r.age < life);

      // major: a ring of petals (and a lighter inner layer between them)
      if (open > 0.02) {
        const L = H * (0.07 + 0.17 * open) * (1 + 0.12 * bloom), wd = L * 0.21 * (8 / Math.max(6, n)) * (0.55 + 0.45 * open);
        for (let layer = 1; layer >= 0; layer--) for (let i = 0; i < n; i++) {
          g.save(); g.rotate(spin + (i + (layer ? 0.5 : 0)) / n * TAU - Math.PI / 2);
          const l = layer ? L * 0.62 : L, col = (i % 2) ? colB : colA;
          petal(g, rd * 0.98, rd + l, layer ? wd * 0.7 : wd);
          g.fillStyle = rgba(layer ? (i % 2 ? colA : colB) : col, (layer ? 0.45 : 0.82) * open); g.fill();
          g.strokeStyle = rgba(CREAM, 0.6 * open); g.lineWidth = 1; g.stroke();
          if (!layer) { g.strokeStyle = rgba(CREAM, 0.35 * open); g.beginPath(); g.moveTo(rd, 0); g.lineTo(rd + l * 0.8, 0); g.stroke(); }
          g.restore();
        }
      }
      // minor: the petals close into curled spirals, in mirrored pairs
      if (curl > 0.02) {
        const m = Math.max(2, n / 2), Rs = H * (0.05 + 0.065 * curl) * (1 + 0.1 * bloom), D = rd + Rs * 1.08;
        for (let i = 0; i < m; i++) {
          const dir = i % 2 ? -1 : 1, ang = (i + 0.5) / m * TAU + spin * dir - Math.PI / 2;
          g.save(); g.translate(Math.cos(ang) * D, Math.sin(ang) * D);
          // start on the side facing the disc, so each spiral grows out of it
          snail(g, Rs, ang + Math.PI, 0.5 + 1.3 * curl, dir, (i % 2) ? colB : colA, 0.85 * curl, 2.5 + 7 * curl);
          g.restore();
        }
      }
      // the split disc: concentric bands whose halves swap colour
      g.shadowColor = rgba(colA, 0.5); g.shadowBlur = 18 + 30 * bloom;
      halves(g, rd, colA, colB, 0.92); g.shadowBlur = 0;
      halves(g, rd * 0.68, colB, colA, 0.95); halves(g, rd * 0.38, colA, colB, 0.95);
      g.fillStyle = rgba(CREAM, 0.95); g.beginPath(); g.arc(0, 0, Math.max(2, rd * 0.1), 0, TAU); g.fill();
      g.strokeStyle = rgba(CREAM, 0.6); g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, rd, 0, TAU); g.stroke();
      g.setTransform(1, 0, 0, 1, 0, 0);

      // twins: mirrored forms in the wings, warm on the left, cool on the right
      for (const t of twins) {
        t.age += dt; t.dx += dt * 10; const f = Math.max(0, 1 - t.age / 3.5); if (f <= 0) continue;
        const a = Math.pow(f, 1.3) * Math.min(1, t.age / 0.15), s = t.s * (0.8 + 0.2 * Math.min(1, t.age / 0.4));
        for (const side of [-1, 1]) {
          const col = side < 0 ? (t.q > 0 ? OCHRE : LILAC) : (t.q > 0 ? ROSE : SKY);
          g.save(); g.translate(cx + side * t.dx, t.y); g.scale(side, 1);
          if (t.q > 0) { // major: a half-disc facing the axis, with a ring around it
            g.fillStyle = rgba(col, 0.9 * a); g.beginPath(); g.arc(0, 0, s, -Math.PI / 2, Math.PI / 2); g.fill();
            g.strokeStyle = rgba(CREAM, 0.5 * a); g.lineWidth = 1; g.beginPath(); g.arc(0, 0, s * 1.35, 0, TAU); g.stroke();
          } else snail(g, s, Math.PI, 1.6, 1, col, 0.8 * a, 1.5 + s * 0.12);
          g.restore();
        }
      }
      twins = twins.filter((t) => t.age < 3.5);
    },
  });
})();
