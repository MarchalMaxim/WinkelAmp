// Hilma af Klint v2: spiritual geometry in soft pastels on a deep ground. A split central disc that the bass swells and
// whose inner bands click round on every attack; the harmony chooses the forms around it (major chords open a ring of
// petals, minor chords close them into paired spirals). Every note lands on that figure: its pitch class sits at an angle
// on the circle of fifths, and the petals (or spirals) at that angle spring out (low notes the inner layer, high notes
// the outer); a seed flies out at that angle and settles on an orbit set by its height, so dense music fills the
// orbits and sparse music leaves a few stars. Each attack also clicks the whole figure round, the way the melody moves.
// Melody notes leave mirrored twin forms in the wings, warm on the left, cool on the right.
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
  const slotOf = (m) => ((m % 12) * 7) % 12; // a pitch class's place on the circle of fifths
  const SLOT = TAU / 12;
  // loudness 0..1 from a transcribed velocity (the recordings sit mostly between 45 and 105), so soft and loud differ plainly
  const loud = (vel) => Math.max(0.05, Math.min(1, (vel - 40) / 66));

  // Springs (one per circle-of-fifths slot, low and high register, plus the disc): a kick overshoots, then settles,
  // so a hit still shows a frame or two later. W0 natural frequency, Z damping.
  const W0 = TAU * 2.4, Z = 0.32;
  const eLo = new Float32Array(12), vLo = new Float32Array(12), eHi = new Float32Array(12), vHi = new Float32Array(12);
  const disc = { e: 0, v: 0 };
  const chroma = new Float32Array(12);
  let chT = 0, mode = -0.3, modeT = -0.3, root = 1, rootCol = null, bass = 0, bloom = 0, spin = 0, spinT = 0, band = 0, bandT = 0,
    rings = [], seeds = [], twins = [], lastTop = -1, lastTwin = -9, ground = null, nCur = 0, nOld = 0, nX = 1;

  function stepSprings(dt) {
    const steps = Math.ceil(dt / 0.008); if (!steps) return; const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < 12; i++) {
        vLo[i] += (-W0 * W0 * eLo[i] - 2 * Z * W0 * vLo[i]) * h; eLo[i] += vLo[i] * h;
        vHi[i] += (-W0 * W0 * eHi[i] - 2 * Z * W0 * vHi[i]) * h; eHi[i] += vHi[i] * h;
      }
      disc.v += (-W0 * W0 * disc.e - 2 * Z * W0 * disc.v) * h; disc.e += disc.v * h;
    }
  }
  const soft = (e) => (e > 0 ? 1.1 * Math.tanh(e / 1.1) : Math.max(-0.35, e)); // a hard hit saturates instead of shooting off
  // How hard the forms at angle a (figure frame) were hit: the slots within reach, weighted by closeness.
  function hitAt(arr, a, reach) {
    let s = 0;
    for (let i = 0; i < 12; i++) {
      let d = Math.abs(a - i * SLOT) % TAU; if (d > Math.PI) d = TAU - d;
      if (d < reach) s += arr[i] * (1 - d / reach);
    }
    return soft(s);
  }

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
    const N = Math.max(16, Math.round(turns * 40)), L = [], Rt = [];
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
  // A disc split down the middle (turned by rot): one half a, the other b.
  function halves(g, r, a, b, alpha, rot = 0) {
    g.fillStyle = rgba(a, alpha); g.beginPath(); g.arc(0, 0, r, Math.PI / 2 + rot, Math.PI * 1.5 + rot); g.fill();
    g.fillStyle = rgba(b, alpha); g.beginPath(); g.arc(0, 0, r, -Math.PI / 2 + rot, Math.PI / 2 + rot); g.fill();
  }

  // Knob pictures
  const C = (c) => `rgb(${c.join(',')})`;
  const iconHalves = (g, x, y, r, a, b) => { g.fillStyle = C(a); g.beginPath(); g.arc(x, y, r, Math.PI / 2, Math.PI * 1.5); g.fill();
    g.fillStyle = C(b); g.beginPath(); g.arc(x, y, r, -Math.PI / 2, Math.PI / 2); g.fill(); };
  const iconRosette = (g, x, y, n, len, col) => { for (let i = 0; i < n; i++) { g.save(); g.translate(x, y); g.rotate((i / n) * TAU - Math.PI / 2);
    g.fillStyle = col; petal(g, 2.5, 2.5 + len, Math.max(0.9, len * 0.2 * (8 / Math.max(6, n)))); g.fill(); g.restore(); } ICON.dot(g, x, y, 2.6, C(OCHRE)); };

  // Draw the ring of n petals (major), each sprung by the notes at its angle.
  function rosette(g, H, n, rd, open, alpha, colA, colB) {
    const L = 0.17 * open, wd0 = 0.21 * (8 / Math.max(6, n)) * (0.55 + 0.45 * open), reach = Math.max(SLOT, TAU / n) * 1.05;
    for (let layer = 1; layer >= 0; layer--) for (let i = 0; i < n; i++) {
      const a0 = (i + (layer ? 0.5 : 0)) / n * TAU;
      // the inner layer answers the low notes, the outer layer the high ones (each feels the other a little)
      const e = layer ? hitAt(eLo, a0, reach) + 0.35 * hitAt(eHi, a0, reach) : hitAt(eHi, a0, reach) + 0.35 * hitAt(eLo, a0, reach);
      const base = H * (0.07 + L) * (1 + 0.1 * bloom), wd = base * wd0 * (layer ? 0.7 : 1) * (1 + 0.3 * Math.max(0, e));
      // a hit lengthens the petal, but its tip eases in under the great circle
      let tip = rd + (layer ? base * 0.62 : base) * (1 + 0.5 * e); const k = H * 0.36;
      if (tip > k) tip = k + H * 0.09 * Math.tanh((tip - k) / (H * 0.09));
      const l = Math.max(rd * 0.3, tip - rd);
      const lit = Math.max(0, Math.min(1, e * 0.7));
      const col = mix(layer ? (i % 2 ? colA : colB) : (i % 2 ? colB : colA), CREAM, lit * 0.4);
      g.save(); g.rotate(spin + a0 - Math.PI / 2);
      petal(g, rd * 0.98, rd + l, wd);
      g.fillStyle = rgba(col, ((layer ? 0.45 : 0.8) + 0.2 * lit) * open * alpha); g.fill();
      g.strokeStyle = rgba(CREAM, (0.5 + 0.5 * lit) * open * alpha); g.lineWidth = 1 + 1.2 * lit; g.stroke();
      if (!layer) { g.strokeStyle = rgba(CREAM, 0.3 * open * alpha); g.lineWidth = 1; g.beginPath(); g.moveTo(rd, 0); g.lineTo(rd + l * 0.8, 0); g.stroke(); }
      g.restore();
    }
  }
  // Draw the n/2 curled spirals (minor), in mirrored pairs, each sprung by the notes at its angle.
  function spirals(g, H, n, rd, curl, alpha, colA, colB) {
    const m = Math.max(2, n / 2), reach = Math.max(SLOT, TAU / m) * 0.8, Rs0 = H * (0.05 + 0.065 * curl) * (1 + 0.08 * bloom);
    for (let i = 0; i < m; i++) {
      const dir = i % 2 ? -1 : 1, a0 = (i + 0.5) / m * TAU;
      const e = hitAt(eHi, a0, reach) + hitAt(eLo, a0, reach) * 0.8, lit = Math.max(0, Math.min(1, e * 0.7));
      const Rs = Rs0 * (1 + 0.38 * e), D = rd + Rs * 1.08, ang = a0 + spin - Math.PI / 2;
      const col = mix((i % 2) ? colB : colA, CREAM, lit * 0.5);
      g.save(); g.translate(Math.cos(ang) * D, Math.sin(ang) * D);
      // start on the side facing the disc, so each spiral grows out of it; a hit unwinds it a little, then it curls back
      snail(g, Rs, ang + Math.PI, Math.max(0.3, 0.5 + 1.3 * curl - 0.35 * e), dir, col, (0.82 + 0.18 * lit) * curl * alpha, (2.5 + 7 * curl) * (1 + 0.3 * Math.max(0, e)));
      g.restore();
    }
  }

  TOOLS.push({
    id: 'hilma', name: 'Hilma af Klint', tag: 'v2',
    blurb: 'Spiritual geometry after Hilma af Klint, in soft pastels on a deep ground: the bass swells the split disc, major chords open a ring of petals and minor chords curl them into spirals. New in v2: every note lands on the figure. The petals or spirals at that note’s place spring out, a seed flies to an orbit as high as the note, and each attack clicks the figure round with the melody.',
    params: [
      { key: 'disc', label: 'disc size from the bass', min: 0, max: 1.6, value: 1,
        hint: 'How strongly the low notes grow the disc in the middle. Left: a small, steady disc. Right: heavy bass fills the centre.',
        icon: (g, v, w, h) => iconHalves(g, w / 2, h / 2, 3 + v * 9, OCHRE, ROSE) },
      { key: 'life', label: 'how long the seeds and rings stay', min: 1, max: 10, value: 4.5, drive: '-rate',
        hint: 'How long each note’s seed and each chord’s ring stay on their orbits. Left: they flash and go. Right: they pile up into a field of stars.',
        icon: (g, v, w, h) => { const k = 0.6 + v * 4.6; for (let i = 0; i < 5; i++) { const a = Math.max(0, 1 - i / k); if (a > 0) ICON.ring(g, w / 2, h / 2, 2.5 + i * 2.3, ICON.lerp('#e2b25c', '#96c0e4', i / 4), 1.3 * a + 0.2); } } },
      { key: 'petals', label: 'how many petals', min: 4, max: 12, step: 2, value: 8,
        hint: 'How many petals open on major chords (minor chords curl half as many spirals). Left: a simple four-leaf cross. Right: a dense twelve-petal flower.',
        icon: (g, v, w, h) => iconRosette(g, w / 2, h / 2, 4 + Math.round(v * 4) * 2, 8.5, C(ROSE)) },
      { key: 'twins', label: 'twin forms on the melody', min: 0, max: 1, value: 0.6,
        hint: 'How many and how big the mirrored pairs are that melody notes leave on both sides. Left: none, just the centre figure. Right: large pairs in the wings.',
        icon: (g, v, w, h) => { if (v < 0.04) { ICON.line(g, w / 2, 4, w / 2, h - 4, ICON.dim, 1); return; } const r = 2 + v * 5;
          ICON.line(g, w / 2, 3, w / 2, h - 3, ICON.dim, 1); ICON.dot(g, w / 2 - 3.5 - r, h / 2, r, C(OCHRE)); ICON.dot(g, w / 2 + 3.5 + r, h / 2, r, C(SKY)); } },
      { key: 'turn', label: 'how far each note turns it', min: 0, max: 1, value: 0.4, drive: '+rate',
        hint: 'How far each note clicks the figure round (forward when the melody climbs, back when it falls). Left: still, like a painting. Right: every note swings it.',
        icon: (g, v, w, h) => { const r = 8.5, x = w / 2, y = h / 2; ICON.ring(g, x, y, r, ICON.dim, 1); ICON.dot(g, x, y, 2, C(OCHRE));
          if (v < 0.04) { ICON.dot(g, x, y - r, 2, C(LILAC)); return; } const a1 = -Math.PI / 2 + 0.25 + v * Math.PI * 1.55;
          g.strokeStyle = C(LILAC); g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, a1); g.stroke();
          g.fillStyle = C(LILAC); g.beginPath(); const tx = x + Math.cos(a1) * r, ty = y + Math.sin(a1) * r, d = a1 + Math.PI / 2;
          g.moveTo(tx + Math.cos(d) * 4, ty + Math.sin(d) * 4); g.lineTo(tx + Math.cos(a1) * 3, ty + Math.sin(a1) * 3); g.lineTo(tx - Math.cos(a1) * 3, ty - Math.sin(a1) * 3); g.fill(); } },
    ],
    reset(x) {
      chroma.fill(0); chT = x.t; mode = modeT = -0.3; rootCol = null; bass = 0; bloom = 0; spin = spinT = 0; band = bandT = 0;
      eLo.fill(0); vLo.fill(0); eHi.fill(0); vHi.fill(0); disc.e = disc.v = 0;
      rings = []; seeds = []; twins = []; lastTop = -1; lastTwin = -9; nCur = 0; nOld = 0; nX = 1;
    },
    onChord(ch, x) {
      // the harmony: a decaying memory of pitch classes (bass notes count more), matched against major/minor triads
      const k = Math.pow(0.5, Math.max(0, ch.t - chT) / 1.2); chT = ch.t; for (let i = 0; i < 12; i++) chroma[i] *= k;
      for (const n of ch.notes) chroma[n.m % 12] += (n.v / 127) * (n.m === ch.lo ? 1.5 : 1);
      const hm = harmony(); if (hm.q) { modeT = hm.q; root = hm.root; }
      const v = loud(ch.vel); bloom = Math.max(bloom, v);
      if (ch.lo < 50) { bass = Math.min(1.2, bass + 0.25 * v); disc.v += 9 * (ch.lo < 43 ? 1 : 0.6) * v; }
      // every note kicks the forms at its angle: low notes the inner layer, high notes the outer
      const life = x.p('life'); let launched = 0;
      for (const n of ch.notes) {
        const s = slotOf(n.m), nv = loud(n.v), kick = 3 + 17 * nv;
        if (n.m < 60) vLo[s] += kick; else vHi[s] += kick;
        // a seed flies out at that angle (with the figure as it stands) to an orbit as high as the note
        if (launched < 7) {
          launched++;
          seeds.push({ a: s * SLOT + (Math.random() - 0.5) * 0.16, h: Math.max(0, Math.min(1, (n.m - 30) / 66)), v: nv,
            col: mix(ringCol(n.m % 12), CREAM, 0.15), age: 0, life: life * (0.7 + 0.3 * nv) });
        }
      }
      if (seeds.length > 220) seeds.splice(0, seeds.length - 220);
      // the inner bands click round on every attack (further when louder); the figure clicks with the melody's direction
      bandT += (0.25 + 0.75 * v) * 0.5 * (ch.notes.length > 2 ? 1.4 : 1);
      const dir = lastTop < 0 || ch.hi === lastTop ? (ch.notes.length > 2 ? 1 : 0) : ch.hi > lastTop ? 1 : -1;
      spinT += dir * x.p('turn') * 0.45 * v;
      // a thin ring at a radius set by the chord's top note
      const hi = Math.max(0, Math.min(1, (ch.hi - 40) / 52));
      rings.push({ hi, age: 0, v, col: ringCol(ch.hi % 12), n: ch.notes.length });
      if (rings.length > 50) rings.shift();
      // melody: a new top note above the middle leaves a mirrored pair in the wings (a procession drifting outward)
      const tw = x.p('twins');
      if (tw > 0.03 && ch.hi >= 62 && ch.hi !== lastTop && ch.t - lastTwin > 0.3 && Math.random() < 0.35 + 0.65 * tw) {
        lastTwin = ch.t;
        twins.push({ y: x.H * (0.82 - 0.64 * Math.min(1, (ch.hi - 62) / 28)), dx: x.H * (0.58 + Math.random() * 0.1), s: (14 + 30 * v) * (0.5 + tw), age: 0, q: hm.q || modeT, v });
      }
      if (twins.length > 14) twins.shift();
      lastTop = ch.hi;
    },
    frame(x) {
      const g = x.g, W = x.W, H = x.H, cx = W / 2, cy = H / 2, dt = x.dt;
      // smoothing: the form follows the harmony over about a second; the bass swells fast and sinks slowly
      mode += (modeT - mode) * (1 - Math.exp(-dt / 0.9));
      let lowNow = 0; for (const n of x.sounding()) if (n.m < 50) lowNow += n.v / 127;
      const bT = Math.min(1.2, lowNow / 1.6); bass += (bT - bass) * (1 - Math.exp(-dt / (bT > bass ? 0.06 : 0.7)));
      bloom *= Math.exp(-dt * 3);
      stepSprings(dt);
      // the clicks: the figure and the bands ease to where the notes sent them (a slow drift on top)
      spinT += dt * x.p('turn') * 0.06;
      spin += (spinT - spin) * (1 - Math.exp(-dt / 0.11)); band += (bandT - band) * (1 - Math.exp(-dt / 0.09));
      const P = (mode + 1) / 2, u = Math.max(0, Math.min(1, (P - 0.3) / 0.4)), open = u * u * (3 - 2 * u), curl = 1 - open;
      // the key tints the pair of colours a little (it follows the root slowly)
      const rc = ringCol(root); if (!rootCol) rootCol = rc.slice();
      for (let i = 0; i < 3; i++) rootCol[i] += (rc[i] - rootCol[i]) * (1 - Math.exp(-dt / 1.5));
      const colA = mix(mix(LILAC, OCHRE, open), rootCol, 0.28), colB = mix(mix(SKY, ROSE, open), rootCol, 0.18);
      // the petals keep the clean major pair, the spirals the minor pair: a change of harmony dissolves one figure into the other
      const majA = mix(OCHRE, rootCol, 0.12), majB = mix(ROSE, rootCol, 0.08), minA = mix(LILAC, rootCol, 0.15), minB = mix(SKY, rootCol, 0.1);
      const keyCol = mix(rootCol, CREAM, 0.12); // the key, at the heart of the disc
      // the petal count (a knob that may follow the music): changes with a little hysteresis, crossfading the two flowers
      const pn = x.p('petals');
      if (!nCur) nCur = Math.round(pn / 2) * 2;
      else if (Math.abs(pn - nCur) > 1.4) { nOld = nCur; nCur = Math.max(4, Math.min(12, Math.round(pn / 2) * 2)); nX = 0; }
      nX = Math.min(1, nX + dt / 0.5); const xf = nX * nX * (3 - 2 * nX);

      // deep ground (painted over the harness fade so the pastels sit on indigo, not on black)
      if (!ground) { ground = g.createRadialGradient(cx, cy, H * 0.05, cx, cy, W * 0.62); ground.addColorStop(0, '#1d1838'); ground.addColorStop(0.55, '#120f24'); ground.addColorStop(1, '#07060e'); }
      g.globalAlpha = 0.86; g.fillStyle = ground; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      // the frame of the painting: a faint great circle and the vertical axis
      g.strokeStyle = rgba(CREAM, 0.10); g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, H * 0.47, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(cx, H * 0.02); g.lineTo(cx, H * 0.98); g.stroke();

      const de = soft(disc.e);
      const rd = H * (0.05 + 0.13 * Math.min(1, bass * x.p('disc'))) * (1 + 0.16 * de * Math.min(1, 0.3 + x.p('disc')));
      const life = x.p('life'), Rmax = H * 0.465, R0 = rd * 1.3;

      g.translate(cx, cy);
      // rings: thin circles at the chord's top-note radius, quickly out and gone
      for (const r of rings) {
        r.age += dt; const f = Math.max(0, 1 - r.age / (life * 0.6)); if (f <= 0) continue;
        const R1 = R0 + r.hi * (Rmax - R0), R = rd + (R1 - rd) * (1 - Math.exp(-r.age * 6));
        const a = Math.pow(f, 1.6) * (0.25 + 0.4 * r.v);
        g.strokeStyle = rgba(r.col, a); g.lineWidth = 0.8 + 2.6 * r.v * r.v; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
        if (r.n >= 3) { g.strokeStyle = rgba(CREAM, a * 0.35); g.lineWidth = 0.7; g.beginPath(); g.arc(0, 0, R + 3 + 5 * r.v, 0, TAU); g.stroke(); }
      }
      rings = rings.filter((r) => r.age < life * 0.6);

      // major: a ring of petals; minor: the petals close into curled spirals (crossfading when the petal count changes)
      if (open > 0.02) { rosette(g, H, nCur, rd, open, xf, majA, majB); if (xf < 1 && nOld) rosette(g, H, nOld, rd, open, 1 - xf, majA, majB); }
      if (curl > 0.02) { spirals(g, H, nCur, rd, curl, xf, minA, minB); if (xf < 1 && nOld) spirals(g, H, nOld, rd, curl, 1 - xf, minA, minB); }

      // seeds: fly out from the disc along the note's angle, land on their orbit with a little flash, then glow and fade
      for (const s of seeds) {
        s.age += dt; const f = Math.max(0, 1 - s.age / s.life); if (f <= 0) continue;
        const fly = Math.min(1, s.age / 0.24), e = 1 - Math.pow(1 - fly, 3), Rt = R0 + s.h * (Rmax - R0), R = rd + (Rt - rd) * e;
        const a = s.a + spin - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), px = ca * R, py = sa * R;
        const al = Math.pow(f, 1.2), sz = 3 + 5 * s.v;
        if (fly < 1) { // the flight: a tapering streak behind the seed
          const tail = Math.max(rd, R - (Rt - rd) * 0.45 * (1 - fly));
          g.strokeStyle = rgba(s.col, 0.85 * (1 - fly * 0.5)); g.lineWidth = sz * 1.1; g.beginPath(); g.moveTo(ca * tail, sa * tail); g.lineTo(px, py); g.stroke();
        } else if (s.age < 0.6) { // the landing: a small ring opens round it
          const k = (s.age - 0.24) / 0.36; g.strokeStyle = rgba(CREAM, 0.6 * (1 - k) * (0.4 + 0.6 * s.v)); g.lineWidth = 1;
          g.beginPath(); g.arc(px, py, sz + 3 + 12 * k * (0.4 + s.v), 0, TAU); g.stroke();
        }
        g.fillStyle = rgba(s.col, al * (0.7 + 0.3 * s.v)); g.beginPath(); g.arc(px, py, sz, 0, TAU); g.fill();
        if (s.v > 0.45) { g.fillStyle = rgba(CREAM, al * 0.85); g.beginPath(); g.arc(px, py, sz * 0.38, 0, TAU); g.fill();
          g.strokeStyle = rgba(CREAM, al * 0.4); g.lineWidth = 0.8; g.beginPath(); g.arc(px, py, sz + 2.5, 0, TAU); g.stroke(); }
      }
      seeds = seeds.filter((s) => s.age < s.life);

      // the split disc: the outer halves keep the painting's axis, the inner bands click round on every attack
      g.shadowColor = rgba(colA, 0.5); g.shadowBlur = 16 + 34 * bloom;
      halves(g, rd, colA, colB, 0.92); g.shadowBlur = 0;
      halves(g, rd * 0.68, colB, keyCol, 0.95, band); halves(g, rd * 0.38, keyCol, colA, 0.95, -band * 1.6);
      g.fillStyle = rgba(CREAM, 0.95); g.beginPath(); g.arc(0, 0, Math.max(2, rd * (0.1 + 0.06 * bloom)), 0, TAU); g.fill();
      g.strokeStyle = rgba(CREAM, 0.6 + 0.4 * bloom); g.lineWidth = 1.2 + 1.5 * bloom; g.beginPath(); g.arc(0, 0, rd, 0, TAU); g.stroke();
      g.setTransform(1, 0, 0, 1, 0, 0);

      // twins: mirrored forms in the wings, warm on the left, cool on the right; they pop in, settle and drift out
      for (const t of twins) {
        t.age += dt; t.dx += dt * H * 0.07; const f = Math.max(0, 1 - t.age / 3.5); if (f <= 0) continue;
        const a = Math.pow(f, 1.3) * Math.min(1, t.age / 0.08);
        const pop = 1 + 0.45 * Math.exp(-t.age * 7) * Math.cos(t.age * 22) * (0.5 + t.v), s = t.s * Math.min(1, 0.4 + t.age / 0.08) * pop;
        for (const side of [-1, 1]) {
          const col = side < 0 ? (t.q > 0 ? OCHRE : LILAC) : (t.q > 0 ? ROSE : SKY);
          g.save(); g.translate(cx + side * t.dx, t.y); g.scale(side, 1);
          if (t.q > 0) { // major: a half-disc facing the axis, with a ring around it
            g.fillStyle = rgba(col, 0.9 * a); g.beginPath(); g.arc(0, 0, s, -Math.PI / 2, Math.PI / 2); g.fill();
            g.strokeStyle = rgba(CREAM, 0.5 * a); g.lineWidth = 1; g.beginPath(); g.arc(0, 0, s * 1.35, 0, TAU); g.stroke();
          } else snail(g, s, Math.PI, 1.3, 1, col, 0.8 * a, 1.5 + s * 0.12);
          g.restore();
        }
      }
      twins = twins.filter((t) => t.age < 3.5);
    },
  });
})();
