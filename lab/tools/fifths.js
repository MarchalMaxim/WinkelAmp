// Harmonic web: the 12 pitch classes on a circle of fifths. Each chord strings a bowed polygon between its notes;
// old polygons thin into a weave, the estimated key turns the whole loom so the tonic sits at the top.
(() => {
  const STEP = Math.PI * 2 / 12, TAU = Math.PI * 2;
  const FIFTH = (pc) => (pc * 7) % 12;                       // pitch class -> position on the circle of fifths
  // Krumhansl-Kessler key profiles (tonic first).
  const KMAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KMIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const R = (a, b) => a + Math.random() * (b - a);
  // The figure is drawn additively on its own black canvas each frame, then laid on the shared canvas with 'lighten':
  // max(faded previous frame, figure) settles on exactly the figure's brightness (no 8x pile-up from the slow shared
  // fade), leaves a short motion trail when it turns, and lets other tools show wherever they are brighter.
  const off = document.createElement('canvas'); off.width = 1280; off.height = 720; const og = off.getContext('2d');
  let polys = [], trail = [], node = new Float32Array(12), hist = new Float32Array(12);
  let prevPc = -1, prevM = 60, prevT = -9;
  let keyRot = 0, keyKnown = false, tonic = 0, minor = false, spinAcc = 0, flash = 0, scale = 1;

  function estimateKey() {
    let best = -1e9, bt = 0, bm = false, mean = 0;
    for (let i = 0; i < 12; i++) mean += hist[i]; mean /= 12; if (mean < 1e-4) return;
    for (let t = 0; t < 12; t++) for (const [prof, m] of [[KMAJ, false], [KMIN, true]]) {
      let s = 0; for (let i = 0; i < 12; i++) s += (hist[(t + i) % 12] - mean) * prof[i];
      if (s > best) { best = s; bt = t; bm = m; }
    }
    tonic = bt; minor = bm;
  }
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  // Colour by harmonic function: fifths away from the tonic. Tonic = bone, dominant (sharp) side = blood to magenta,
  // subdominant (flat) side = indigo to teal, the tritone = violet. k blends from a single crimson.
  function fnColour(bassPc, k) {
    let dd = (FIFTH(bassPc) - FIFTH(tonic) + 12) % 12; if (dd > 6) dd -= 12;
    let c;
    if (dd === 0) c = [240, 222, 190];
    else if (Math.abs(dd) === 6) c = [150, 70, 235];
    else if (dd > 0) c = mix([235, 36, 44], [215, 50, 180], (dd - 1) / 4);
    else c = mix([70, 100, 240], [40, 190, 200], (-dd - 1) / 4);
    return mix([215, 38, 40], c, k);
  }
  // Point of a vertex (figure frame, unrotated): fifths angle, radius factor.
  const pt = (f, r, Rpx, tw = 0) => [Math.cos(f * STEP - Math.PI / 2 + tw) * Rpx * r, Math.sin(f * STEP - Math.PI / 2 + tw) * Rpx * r];
  // Sinking: an old chord shrinks toward the centre (and twists a little) over its life, so history nests inward.
  const sinkK = (age, decay, sink) => 1 - sink * 0.8 * Math.pow(Math.min(1, age / decay), 1.5);
  function trace(g, P, Rpx, bow, k = 1, tw = 0) {
    const v = P.v, n = v.length;
    const ps = v.map((q) => pt(q.f, q.r * k, Rpx, tw));
    g.moveTo(ps[0][0], ps[0][1]);
    const edges = n === 2 ? 1 : n;
    for (let i = 0; i < edges; i++) {
      const a = ps[i], b = ps[(i + 1) % n], k = 1 - bow;
      g.quadraticCurveTo((a[0] + b[0]) / 2 * k, (a[1] + b[1]) / 2 * k, b[0], b[1]);
    }
    if (n > 2) g.closePath();
  }

  // Knob pictures: a chord triangle drawn the way the web draws it (bowed edges), with an optional fill.
  const PINK = '#e0508a', FUNC = 0.8; // FUNC: how strongly colour follows harmonic function (1) vs a single crimson (0)
  function tri(g, cx, cy, r, bow, k, tw, col, lw = 1.2, fill = 0) {
    const ps = [0, 4, 7].map((f) => [cx + Math.cos(f * STEP - Math.PI / 2 + tw) * r * k, cy + Math.sin(f * STEP - Math.PI / 2 + tw) * r * k]);
    g.beginPath(); g.moveTo(ps[0][0], ps[0][1]);
    for (let i = 0; i < 3; i++) { const p = ps[i], q = ps[(i + 1) % 3]; g.quadraticCurveTo(cx + ((p[0] + q[0]) / 2 - cx) * (1 - bow), cy + ((p[1] + q[1]) / 2 - cy) * (1 - bow), q[0], q[1]); }
    g.closePath();
    if (fill > 0) { g.save(); g.globalAlpha = fill * 0.85; g.fillStyle = col; g.fill(); g.restore(); }
    g.strokeStyle = col; g.lineWidth = lw; g.stroke();
  }

  TOOLS.push({
    id: 'fifths', name: 'Harmonic web', tag: 'new',
    blurb: 'The 12 notes sit on a circle of fifths; every attack strings a glowing bowed polygon between the notes sounding, and old chords thin and sink inward into a woven web. The key it hears turns the whole loom so the home note sits on top; colour says tonic (bone), dominant side (blood) or subdominant side (indigo).',
    // Five knobs (the user's rule for this round). Folded into fixed choices: radius, key follow, node glow, colour by
    // function, and the spin (busy passages still swing the loom a little by themselves).
    params: [
      { key: 'decay', label: 'how long the web remembers', min: 0.5, max: 30, value: 9,
        hint: 'How long old chords stay in the web before they vanish. Left: only the chord you hear now. Right: half a minute of harmony woven together.',
        icon: (g, v, w, h) => { for (let i = 4; i >= 0; i--) { const a = Math.max(0, 1 - i / (0.6 + v * 4.4)); if (a > 0) ICON.alpha(g, a, () => tri(g, w / 2, h / 2 + 1, 11, 0.2, 1, i * 0.55, PINK)); } } },
      { key: 'weight', label: 'line thickness', min: 0.3, max: 4, value: 1.2, drive: '+level',
        hint: 'How thick the strings are. Left: hairlines. Right: thick glowing cords.',
        icon: (g, v, w, h) => { g.strokeStyle = PINK; g.lineWidth = 0.6 + v * 5; g.beginPath(); g.moveTo(5, h - 7); g.quadraticCurveTo(w / 2, 2, w - 5, h - 7); g.stroke(); } },
      { key: 'bow', label: 'how the strings curve', min: -1, max: 1, value: 0.3, drive: '+pitch',
        hint: 'How each string between two notes bends. Left: bulging outward like petals. Middle: straight. Right: pulled in toward the centre like string art.',
        icon: (g, v, w, h) => tri(g, w / 2, h / 2 + 1.5, 11, -1 + 2 * v, 1, 0, PINK, 1.6) },
      { key: 'sink', label: 'old chords sink inward', min: 0, max: 1, value: 0.55,
        hint: 'Whether old chords shrink toward the centre as they age, so the history nests inside the circle. Left: they stay where they were played. Right: they sink deep.',
        icon: (g, v, w, h) => { [1, 0.6, 0.35].forEach((a, i) => ICON.alpha(g, a, () => tri(g, w / 2, h / 2 + 1, 11 * (1 - v * 0.36 * i), 0.2, 1, (i % 2 ? 1 : -1) * 0.12 * i, PINK))); } },
      { key: 'fill', label: 'filled shapes', min: 0, max: 1, value: 0.2, drive: '+level',
        hint: 'How much colour fills the shape of each chord. Left: only the strings. Right: glowing coloured shapes.',
        icon: (g, v, w, h) => tri(g, w / 2, h / 2 + 1, 11, 0.2, 1, 0, PINK, 1.4, v) },
    ],
    reset() { prevPc = -1; polys = []; trail = []; node.fill(0); hist.fill(0); keyKnown = false; spinAcc = 0; flash = 0; scale = 1; },
    onChord(ch, x) {
      for (const n of ch.notes) {
        const pc = n.m % 12;
        node[pc] = Math.max(node[pc], n.v / 105);
        hist[pc] += (n.v / 127) * (0.3 + Math.min(2, n.d)) * (n.m < 52 ? 1.6 : 1);
      }
      estimateKey();
      // Merge attacks within 90 ms into one polygon (rolled chords, transcriber jitter).
      let P = polys[polys.length - 1];
      if (!P || ch.t - P.t > 0.09) {
        // Notes still held from before join the polygon: a melody note over a sustained chord strings the whole harmony.
        const held = x.sounding().filter((n) => n.start < ch.t - 0.09 && n.end > ch.t + 0.05).map((n) => ({ m: n.m, v: n.v * 0.7 }));
        P = { t: ch.t, age: 0, notes: [], held, vel: 0, j: R(-1, 1), bow: x.p('bow') }; polys.push(P);
      }
      P.notes.push(...ch.notes); P.vel = Math.max(P.vel, ch.vel);
      // A long-held attack (tolling octaves, a fermata) stays lit for as long as it rings, up to ~2 s.
      P.hold = 0.6 + 0.5 * Math.min(3, Math.max(...P.notes.map((n) => n.d)));
      // Rebuild vertices: one per pitch class, radius by the register of that pitch class's notes.
      const by = new Map(); let bass = 999;
      for (const n of P.held) { const pc = n.m % 12; if (!by.has(pc)) by.set(pc, { m: n.m, c: 1, v: n.v }); }
      // A bare unison/octave attack (the fate motif, tolling octaves) strings itself to the previous attack: a melodic thread.
      const pcs = new Set(P.notes.map((n) => n.m % 12));
      if (pcs.size === 1 && by.size === 0 && prevPc >= 0 && !pcs.has(prevPc) && ch.t - prevT < 2.5) by.set(prevPc, { m: prevM, c: 1, v: 40 });
      for (const n of P.notes) { const pc = n.m % 12; const e = by.get(pc) || { m: 0, c: 0, v: 0 }; e.m += n.m; e.c++; e.v = Math.max(e.v, n.v); by.set(pc, e); bass = Math.min(bass, n.m); }
      const reg = 0.3; // low notes sit a little inside the ring, high ones outside
      P.v = [...by.entries()].map(([pc, e]) => ({ f: FIFTH(pc), r: 1 + reg * (x.pitch01(e.m / e.c) - 0.5) * 0.9, v: e.v })).sort((a, b) => a.f - b.f);
      { let top = P.notes[0]; for (const n of P.notes) if (n.m > top.m) top = n; prevPc = top.m % 12; prevM = top.m; prevT = ch.t; }
      P.bass = bass % 12; P.col = fnColour(P.bass, FUNC);
      P.big = P.vel >= 92 && P.notes.length >= 3;
      if (P.big) flash = Math.max(flash, Math.min(1, (P.vel - 80) / 30));
      // The journey: the chord's centre of gravity inside the circle.
      let cx = 0, cy = 0; for (const q of P.v) { const p = pt(q.f, q.r, 1); cx += p[0]; cy += p[1]; }
      cx /= P.v.length; cy /= P.v.length;
      const last = trail[trail.length - 1];
      if (last && ch.t - last.t < 0.09) { last.x = cx; last.y = cy; } else trail.push({ x: cx, y: cy, t: ch.t, age: 0 });
      if (polys.length > 500) polys.shift();
      if (trail.length > 400) trail.shift();
    },
    frame(x) {
      const g = og, dt = x.dt, decay = x.p('decay');
      // Key memory (~5 s half-life) and the turn toward it.
      const hk = Math.pow(0.5, dt / 5); for (let i = 0; i < 12; i++) { hist[i] *= hk; node[i] *= Math.pow(0.5, dt / 0.3); }
      for (const n of x.sounding()) { const pc = n.m % 12, held = 0.3 * n.v / 105; if (node[pc] < held) node[pc] = held; } // held notes keep their peg warm
      const target = -FIFTH(tonic) * STEP;
      const fol = 0.6; // how quickly the loom turns to a new key
      if (!keyKnown) { if (fol > 0) keyRot = target; keyKnown = polys.length > 0; }
      if (fol > 0) { let d = ((target - keyRot) % TAU + TAU * 1.5) % TAU - Math.PI; keyRot += d * (1 - Math.pow(0.5, dt / (0.25 + 5 * (1 - fol)))); }
      // Spin is a sprung swing, not a running total: busy passages swing the loom, and it settles back home.
      spinAcc += 16 * x.feat.rate * Math.PI / 180 * dt; spinAcc *= Math.pow(0.5, dt / 1.2);
      flash *= Math.pow(0.5, dt / 0.18);
      scale += (1 + 0.07 * flash - scale) * Math.min(1, dt * 30);
      const Rpx = 0.88 * 330 * scale, W2 = x.W / 2, H2 = x.H / 2;
      const weight = x.p('weight'), fillA = x.p('fill'), bowNow = x.p('bow'), sink = x.p('sink');

      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, x.W, x.H);
      g.save(); g.translate(W2, H2); g.rotate(keyRot + spinAcc);
      g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';

      // The loom: a faint ring and the twelve pegs.
      g.strokeStyle = 'rgba(120,90,90,0.16)'; g.lineWidth = 1;
      g.beginPath(); g.arc(0, 0, Rpx, 0, TAU); g.stroke();
      // The weave: oldest first, thinning and darkening with age. A dense weave (agitato, long memory) is dimmed so the
      // additive overlap keeps its colour instead of burning to white.
      const dens = Math.min(1, Math.sqrt(28 / Math.max(1, polys.length)));
      // Several lit chords at once (agitato, the climax) share the light too: before this, overlapping bone fills burned
      // the middle of the web to a white blob.
      let freshSum = 0; for (const P of polys) if (P.v.length > 1) freshSum += Math.max(0, 1 - P.age / P.hold);
      const kf = 1 / Math.pow(Math.max(1, freshSum / 1.3), 0.75);
      for (const P of polys) {
        P.age += dt;
        const life = Math.max(0, 1 - P.age / decay); if (life <= 0 || P.v.length < 2) continue;
        const fresh = Math.pow(Math.max(0, 1 - P.age / P.hold), 1.3), a = Math.pow(life, 1.4);
        const [r, gg, b] = P.col, bow = P.bow * 0.7 + bowNow * 0.3 + P.j * 0.14;
        const sk = sinkK(P.age, decay, sink);
        g.beginPath(); trace(g, P, Rpx, bow, sk, (1 - sk) * 0.5 * Math.sign(P.j + 0.3));
        if (fresh > 0) {
          if (P.v.length > 2 && fillA > 0) { g.fillStyle = `rgba(${r | 0},${gg | 0},${b | 0},${(Math.min(0.42, fillA * (0.25 + 0.75 * fresh) * (P.big ? 1.3 : 1)) * kf).toFixed(3)})`; g.fill(); }
          const wb = weight * (P.big ? 1.8 : 1);
          g.strokeStyle = `rgba(${r | 0},${gg | 0},${b | 0},${(0.07 * fresh * kf).toFixed(3)})`; g.lineWidth = wb * (10 + 22 * fresh); g.stroke();
          g.strokeStyle = `rgba(${r | 0},${gg | 0},${b | 0},${(0.16 * fresh * kf).toFixed(3)})`; g.lineWidth = wb * (4 + 8 * fresh); g.stroke();
        } else if (P.v.length > 2 && fillA > 0) {
          g.fillStyle = `rgba(${r | 0},${gg | 0},${b | 0},${(fillA * 0.06 * a * dens).toFixed(3)})`; g.fill();
        }
        g.strokeStyle = `rgba(${Math.min(255, r + 40 * fresh) | 0},${Math.min(255, gg + 60 * fresh) | 0},${Math.min(255, b + 50 * fresh) | 0},${((0.1 + 0.8 * a * 0.35) * dens + 0.8 * a * 0.65 * fresh * Math.sqrt(kf)).toFixed(3)})`;
        g.lineWidth = weight * (0.4 + 0.6 * P.vel / 110 + 2.6 * fresh * P.vel / 110); g.stroke();
      }
      polys = polys.filter((P) => P.age < decay);

      // The journey: centres of gravity of successive chords, a thin bone thread.
      for (const q of trail) q.age += dt;
      trail = trail.filter((q) => q.age < decay);
      // Smoothed through segment midpoints so it reads as a drawn line, not a zigzag.
      const tp = trail.map((q) => { const k = sinkK(q.age, decay, sink) * Rpx; return [q.x * k, q.y * k, Math.pow(Math.max(0, 1 - q.age / decay), 1.2)]; });
      for (let i = 1; i < tp.length - 1; i++) {
        const a0 = tp[i - 1], a1 = tp[i], a2 = tp[i + 1];
        g.strokeStyle = `rgba(240,225,200,${(0.32 * a1[2]).toFixed(3)})`; g.lineWidth = 0.6 + 1.1 * a1[2];
        g.beginPath(); g.moveTo((a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2); g.quadraticCurveTo(a1[0], a1[1], (a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2); g.stroke();
      }
      const head = trail[trail.length - 1];
      if (head) { g.fillStyle = 'rgba(255,240,215,0.9)'; g.beginPath(); g.arc(head.x * Rpx, head.y * Rpx, 2.5 + 3 * Math.max(0, 1 - head.age / 0.4), 0, TAU); g.fill(); }

      // Nodes: dim pegs, lit by sounding notes; the tonic peg wears a ring.
      const glow = 1;
      for (let pc = 0; pc < 12; pc++) {
        const [px, py] = pt(FIFTH(pc), 1, Rpx), e = Math.min(1.3, node[pc]);
        const col = fnColour(pc, FUNC);
        g.fillStyle = 'rgba(150,120,115,0.35)'; g.beginPath(); g.arc(px, py, 2.2, 0, TAU); g.fill();
        // The strike: a thick arc of the ring around a struck peg, as wide as the note is loud.
        if (e > 0.05) {
          const a0 = FIFTH(pc) * STEP - Math.PI / 2, hw = 0.05 + 0.16 * e;
          g.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${Math.min(1, e).toFixed(3)})`; g.lineWidth = 1 + 7 * e * weight / 1.2;
          g.beginPath(); g.arc(0, 0, Rpx, a0 - hw, a0 + hw); g.stroke();
        }
        if (e > 0.02 && glow > 0) {
          const rad = (8 + 46 * e) * glow;
          const gr = g.createRadialGradient(px, py, 0, px, py, rad);
          gr.addColorStop(0, `rgba(255,240,225,${(0.9 * e).toFixed(3)})`);
          gr.addColorStop(0.25, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${(0.55 * e).toFixed(3)})`);
          gr.addColorStop(1, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0)`);
          g.fillStyle = gr; g.beginPath(); g.arc(px, py, rad, 0, TAU); g.fill();
        }
        if (pc === tonic && keyKnown) {
          g.strokeStyle = 'rgba(240,222,190,0.45)'; g.lineWidth = 1.2;
          g.beginPath(); g.arc(px, py, 9 + 4 * e, 0, TAU); g.stroke();
          if (minor) { g.beginPath(); g.arc(px, py, 14 + 4 * e, 0, TAU); g.stroke(); }
        }
      }
      g.restore();
      x.g.globalCompositeOperation = 'lighten'; x.g.drawImage(off, 0, 0);
    },
  });
})();
