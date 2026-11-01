// Harmonic web: the 12 pitch classes on a circle of fifths. Each chord strings a bowed polygon between its notes;
// old polygons thin into a weave, the estimated key turns the whole loom so the tonic sits at the top.
// v2: every attack lands (a soft one is a crisp bright line, a loud one a thick lit cord with a flash, never a burnt
// blob); register reads (each corner sits deeper in the circle for low notes and breaks through the rim for high ones);
// a struck chord's strings shiver for a moment, in as many ripples as the interval is far round the circle (a fifth
// one calm swell, a tritone six), so clashing chords shimmer and sweet ones breathe; the rim shows which notes the music
// has been using lately; a bare octave (the prelude's tolling As, the fate motif) is a ray along its own spoke instead of
// nothing. 'line' replaces 'weight' (new key: loudness now thickens by itself, the old saved drive would count it twice);
// 'shiver' replaces 'sink' (now fixed at 0.55).
(() => {
  const STEP = Math.PI * 2 / 12, TAU = Math.PI * 2;
  const FIFTH = (pc) => (pc * 7) % 12;                       // pitch class -> position on the circle of fifths
  // Krumhansl-Kessler key profiles (tonic first).
  const KMAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KMIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const R = (a, b) => a + Math.random() * (b - a);
  // Register -> radius factor: the piano's working range (C2..C6) spread from deep inside the ring to past the rim.
  const REG = (m) => 0.74 + 0.36 * Math.max(0, Math.min(1, (m - 36) / 54));
  // The figure is drawn additively on its own black canvas each frame, then laid on the shared canvas with 'lighten':
  // max(faded previous frame, figure) settles on exactly the figure's brightness (no 8x pile-up from the slow shared
  // fade), leaves a short motion trail when it turns, and lets other tools show wherever they are brighter.
  const off = document.createElement('canvas'); off.width = 1280; off.height = 720; const og = off.getContext('2d');
  let polys = [], trail = [], node = new Float32Array(12), nodeR = new Float32Array(12).fill(1), hist = new Float32Array(12);
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
  const rgba = (c, a, lift = 0) => `rgba(${Math.min(255, c[0] + lift) | 0},${Math.min(255, c[1] + lift) | 0},${Math.min(255, c[2] + lift) | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  // Point of a vertex (figure frame, unrotated): fifths angle, radius factor.
  const pt = (f, r, Rpx, tw = 0) => [Math.cos(f * STEP - Math.PI / 2 + tw) * Rpx * r, Math.sin(f * STEP - Math.PI / 2 + tw) * Rpx * r];
  // Sinking: an old chord shrinks toward the centre (and twists a little) over its life, so history nests inward.
  const SINK = 0.55;
  const sinkK = (age, decay) => 1 - SINK * 0.8 * Math.pow(Math.min(1, age / decay), 1.5);
  // The outline of a chord. shake (px, signed) makes each string a standing wave with one half-wave more than the two
  // notes are apart on the circle of fifths (fifth/fourth 2, tone 3, minor third 4, major third 5, semitone 6, tritone 7):
  // sweet intervals sway, clashing ones ripple.
  // A bare octave or unison (one note name only, nothing held) is a ray along its own spoke instead: from past its
  // highest octave down to below its lowest, the deeper the louder, swaying in a single half-wave.
  function trace(g, P, Rpx, bow, k = 1, tw = 0, shake = 0) {
    const v = P.v, n = v.length;
    if (n === 1) {
      const a = pt(v[0].f, P.rout * k, Rpx, tw), b = pt(v[0].f, P.rin * k, Rpx, tw);
      g.moveTo(a[0], a[1]);
      if (Math.abs(shake) < 1) { g.lineTo(b[0], b[1]); return; }
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, amp = shake * 0.6 * Math.min(1, L / 140);
      for (let s = 1; s <= 12; s++) { const u = s / 12, o = amp * Math.sin(Math.PI * u); g.lineTo(a[0] + dx * u + nx * o, a[1] + dy * u + ny * o); }
      return;
    }
    const ps = v.map((q) => pt(q.f, q.r * k, Rpx, tw));
    g.moveTo(ps[0][0], ps[0][1]);
    const edges = n === 2 ? 1 : n;
    for (let i = 0; i < edges; i++) {
      const a = ps[i], b = ps[(i + 1) % n], kb = 1 - bow, cx = (a[0] + b[0]) / 2 * kb, cy = (a[1] + b[1]) / 2 * kb;
      if (Math.abs(shake) < 1) { g.quadraticCurveTo(cx, cy, b[0], b[1]); continue; }
      let d = Math.abs(v[i].f - v[(i + 1) % n].f) % 12; d = (Math.min(d, 12 - d) || 1) + 1;
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const amp = shake / Math.sqrt(0.6 + 0.4 * d) * Math.min(1, L / 140), segs = Math.min(36, 8 + d * 5);
      for (let s = 1; s <= segs; s++) {
        const u = s / segs, w0 = (1 - u) * (1 - u), w1 = 2 * (1 - u) * u, w2 = u * u, o = amp * Math.sin(Math.PI * d * u);
        g.lineTo(w0 * a[0] + w1 * cx + w2 * b[0] + nx * o, w0 * a[1] + w1 * cy + w2 * b[1] + ny * o);
      }
    }
    if (n > 2) g.closePath();
  }

  // Knob pictures: a chord triangle drawn the way the web draws it (bowed edges), with an optional fill.
  const PINK = '#e0508a', FUNC = 0.8; // FUNC: how strongly colour follows harmonic function (1) vs a single crimson (0)
  function tri(g, cx, cy, r, bow, k, tw, col, lw = 1.2, fill = 0, shake = 0) {
    const ps = [0, 4, 7].map((f) => [cx + Math.cos(f * STEP - Math.PI / 2 + tw) * r * k, cy + Math.sin(f * STEP - Math.PI / 2 + tw) * r * k]);
    const ds = [5, 4, 6]; // half-waves on the icon triangle's strings (C-E, E-B, B-C: 4, 3, 5 fifths apart, plus one)
    g.beginPath(); g.moveTo(ps[0][0], ps[0][1]);
    for (let i = 0; i < 3; i++) {
      const p = ps[i], q = ps[(i + 1) % 3], mx = cx + ((p[0] + q[0]) / 2 - cx) * (1 - bow), my = cy + ((p[1] + q[1]) / 2 - cy) * (1 - bow);
      if (!shake) { g.quadraticCurveTo(mx, my, q[0], q[1]); continue; }
      const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      for (let s = 1; s <= 24; s++) { const u = s / 24, o = shake * Math.sin(Math.PI * ds[i] * u); g.lineTo(p[0] + dx * u + nx * o, p[1] + dy * u + ny * o); }
    }
    g.closePath();
    if (fill > 0) { g.save(); g.globalAlpha = fill * 0.85; g.fillStyle = col; g.fill(); g.restore(); }
    g.strokeStyle = col; g.lineWidth = lw; g.stroke();
  }

  TOOLS.push({
    id: 'fifths', name: 'Harmonic web', tag: 'v2',
    blurb: 'The 12 notes sit on a circle of fifths; every attack strings a glowing polygon between the notes sounding, and old chords thin and sink inward into a woven web; the key it hears turns the loom so the home note is on top. New: low notes pull a corner deep inside and high ones break through the rim, soft chords are fine bright lines and loud ones thick lit cords. A struck chord shivers for a moment, calmly for sweet intervals and in fine ripples for clashing ones; a bare octave is a ray along its spoke.',
    params: [
      { key: 'decay', label: 'how long the web remembers', min: 0.5, max: 30, value: 9,
        hint: 'How long old chords stay in the web before they vanish. Left: only the chord you hear now. Right: half a minute of harmony woven together.',
        icon: (g, v, w, h) => { for (let i = 4; i >= 0; i--) { const a = Math.max(0, 1 - i / (0.6 + v * 4.4)); if (a > 0) ICON.alpha(g, a, () => tri(g, w / 2, h / 2 + 1, 11, 0.2, 1, i * 0.55, PINK)); } } },
      // New key: loudness already thickens the strings by itself, so the old saved 'louder → more' drive would count it twice.
      { key: 'line', label: 'line thickness', min: 0.3, max: 3, value: 1.2,
        hint: 'How thick the strings are (loud chords are always thicker than soft ones). Left: hairlines. Right: thick glowing cords.',
        icon: (g, v, w, h) => { g.strokeStyle = PINK; g.lineWidth = 0.6 + v * 5; g.beginPath(); g.moveTo(5, h - 7); g.quadraticCurveTo(w / 2, 2, w - 5, h - 7); g.stroke(); } },
      { key: 'bow', label: 'how the strings curve', min: -1, max: 1, value: 0.3, drive: '+pitch',
        hint: 'How each string between two notes bends. Left: bulging outward like petals. Middle: straight. Right: pulled in toward the centre like string art.',
        icon: (g, v, w, h) => tri(g, w / 2, h / 2 + 1.5, 11, -1 + 2 * v, 1, 0, PINK, 1.6) },
      { key: 'shiver', label: 'struck strings shiver', min: 0, max: 1, value: 0.5,
        hint: 'How much a chord\'s strings tremble when it is struck: one slow swell for sweet intervals, fine ripples for clashing ones. Left: still lines. Right: a strong shiver.',
        icon: (g, v, w, h) => tri(g, w / 2, h / 2 + 1.5, 11, 0, 1, 0, PINK, 1.3, 0, v * 0.9) },
      { key: 'fill', label: 'filled shapes', min: 0, max: 1, value: 0.2, drive: '+level',
        hint: 'How much colour fills the shape of each chord. Left: only the strings. Right: glowing coloured shapes.',
        icon: (g, v, w, h) => tri(g, w / 2, h / 2 + 1, 11, 0.2, 1, 0, PINK, 1.4, v) },
    ],
    reset() { prevPc = -1; polys = []; trail = []; node.fill(0); nodeR.fill(1); hist.fill(0); keyKnown = false; spinAcc = 0; flash = 0; scale = 1; },
    onChord(ch, x) {
      for (const n of ch.notes) {
        const pc = n.m % 12;
        node[pc] = Math.max(node[pc], 0.35 + 0.65 * n.v / 110);
        hist[pc] += (n.v / 127) * (0.3 + Math.min(2, n.d)) * (n.m < 52 ? 1.6 : 1);
      }
      estimateKey();
      // Merge attacks within 90 ms into one polygon (rolled chords, transcriber jitter).
      let P = polys[polys.length - 1];
      if (!P || ch.t - P.t > 0.09) {
        // Notes still held from before join the polygon: a melody note over a sustained chord strings the whole harmony.
        const held = x.sounding().filter((n) => n.start < ch.t - 0.09 && n.end > ch.t + 0.05).map((n) => ({ m: n.m, v: n.v * 0.7 }));
        P = { t: ch.t, age: 0, notes: [], held, vel: 0, j: R(-1, 1), bow: x.p('bow'), ph: R(0, 0.6) }; polys.push(P);
      } else P.age = Math.min(P.age, 0.03); // a rolled chord's later notes strike it again
      P.notes.push(...ch.notes); P.vel = Math.max(P.vel, ch.vel);
      // A chord stays lit (dimmer after its attack) for as long as its notes ring, up to ~4 s: a slow passage keeps its
      // harmony on screen between attacks instead of fading to a hairline.
      P.hold = 0.5 + 0.85 * Math.min(4, Math.max(...P.notes.map((n) => n.d)));
      // Rebuild vertices: one per pitch class, radius by the register of that pitch class's notes.
      const by = new Map(); let bass = 999;
      for (const n of P.held) { const pc = n.m % 12; if (!by.has(pc)) by.set(pc, { m: n.m, c: 1, v: n.v, old: true }); }
      // A bare unison/octave attack (the fate motif, tolling octaves) strings itself to the previous attack: a melodic thread.
      const pcs = new Set(P.notes.map((n) => n.m % 12));
      if (pcs.size === 1 && by.size === 0 && prevPc >= 0 && !pcs.has(prevPc) && ch.t - prevT < 2.5) by.set(prevPc, { m: prevM, c: 1, v: 40, old: true });
      for (const n of P.notes) {
        const pc = n.m % 12; let e = by.get(pc);
        if (!e || e.old) { e = { m: 0, c: 0, v: 0, old: false }; by.set(pc, e); }
        e.m += n.m; e.c++; e.v = Math.max(e.v, n.v); bass = Math.min(bass, n.m);
      }
      P.v = [...by.entries()].map(([pc, e]) => ({ f: FIFTH(pc), r: REG(e.m / e.c), v: e.v, new: !e.old })).sort((a, b) => a.f - b.f);
      for (const q of P.v) if (q.new) nodeR[(q.f * 7) % 12] = q.r; // FIFTH is its own inverse (7*7 = 49 = 1 mod 12)
      let rs = 0; for (const q of P.v) rs += q.r; P.reg = (rs / P.v.length - 0.74) / 0.36; // 0 low .. 1 high
      { let top = P.notes[0]; for (const n of P.notes) if (n.m > top.m) top = n; prevPc = top.m % 12; prevM = top.m; prevT = ch.t; }
      P.bass = bass % 12; P.col = fnColour(P.bass, FUNC);
      P.loud = Math.max(0, Math.min(1, (P.vel - 30) / 80));
      if (P.v.length === 1) {
        let lo = 999, hi = 0; for (const n of P.notes) { lo = Math.min(lo, n.m); hi = Math.max(hi, n.m); }
        P.rin = Math.max(0.2, REG(lo) - 0.14 - 0.3 * P.loud); P.rout = Math.max(1.02, REG(hi) + 0.04);
        P.octs = [...new Set(P.notes.map((n) => n.m))].map((m) => ({ f: P.v[0].f, r: REG(m), v: P.v[0].v, new: true }));
      } else P.octs = null;
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
      for (const n of x.sounding()) { const pc = n.m % 12, held = 0.25 * n.v / 105; if (node[pc] < held) node[pc] = held; } // held notes keep their peg warm
      const target = -FIFTH(tonic) * STEP;
      if (!keyKnown) { keyRot = target; keyKnown = polys.length > 0; }
      { let d = ((target - keyRot) % TAU + TAU * 1.5) % TAU - Math.PI; keyRot += d * (1 - Math.pow(0.5, dt / 2.25)); }
      // Spin is a sprung swing, not a running total: busy passages swing the loom, and it settles back home.
      spinAcc += 16 * x.feat.rate * Math.PI / 180 * dt; spinAcc *= Math.pow(0.5, dt / 1.2);
      flash *= Math.pow(0.5, dt / 0.18);
      scale += (1 + 0.05 * flash - scale) * Math.min(1, dt * 30);
      // Base radius: a high note at REG 1.10 stays inside the frame even at the peak of a flash.
      const Rpx = 268 * scale, W2 = x.W / 2, H2 = x.H / 2;
      const weight = x.p('line'), fillA = x.p('fill'), bowNow = x.p('bow'), shiver = x.p('shiver');

      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, x.W, x.H);
      g.save(); g.translate(W2, H2); g.rotate(keyRot + spinAcc);
      g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';

      // The rim: twelve arcs, one per note, as thick and bright as that note has been used lately (the harmonic weather):
      // a diatonic passage lights a band around the top, a chromatic one lights the whole rim.
      let hmax = 1e-3; for (let i = 0; i < 12; i++) hmax = Math.max(hmax, hist[i]);
      for (let pc = 0; pc < 12; pc++) {
        const h = Math.sqrt(hist[pc] / hmax), a0 = FIFTH(pc) * STEP - Math.PI / 2, col = fnColour(pc, FUNC);
        g.strokeStyle = rgba(col, 0.07 + 0.22 * h); g.lineWidth = 1 + 4 * h;
        g.beginPath(); g.arc(0, 0, Rpx, a0 - STEP * 0.42, a0 + STEP * 0.42); g.stroke();
      }
      // The weave: oldest first, thinning and darkening with age. A dense weave (agitato, long memory) is dimmed so the
      // additive overlap keeps its colour instead of burning to white.
      const dens = Math.min(1, Math.sqrt(28 / Math.max(1, polys.length)));
      // Several lit chords at once (agitato, the climax) share the light too, so the middle never burns to a white blob.
      // fresh: a strong attack (atk) over a dimmer glow that lasts while the chord rings (sus).
      const lit = (P) => { const atk = Math.exp(-P.age / 0.3), sus = Math.pow(Math.max(0, 1 - P.age / P.hold), 0.7); return atk + (1 - atk) * 0.45 * sus; };
      let freshSum = 0; for (const P of polys) if (P.v.length > 0) freshSum += lit(P);
      const kf = 1 / Math.pow(Math.max(1, freshSum / 1.3), 0.75), skf = Math.sqrt(kf);
      const beads = [];
      for (const P of polys) {
        P.age += dt;
        const life = Math.max(0, 1 - P.age / decay); if (life <= 0 || !P.v.length) continue;
        const fresh = lit(P), atk = Math.exp(-P.age / 0.3), a = Math.pow(life, 1.4);
        const col = P.col, bow = P.bow * 0.7 + bowNow * 0.3 + P.j * 0.14;
        const sk = sinkK(P.age, decay), tw = (1 - sk) * 0.5 * Math.sign(P.j + 0.3);
        if (fresh < 0.03) {                                    // the weave: one thin line, a whisper of fill
          g.beginPath(); trace(g, P, Rpx, bow, sk, tw);
          if (P.v.length > 2 && fillA > 0) { g.fillStyle = rgba(col, fillA * 0.06 * a * dens); g.fill(); }
          g.strokeStyle = rgba(col, (0.14 + 0.4 * a) * dens, 20); g.lineWidth = weight * (0.55 + 0.6 * P.loud); g.stroke();
          continue;
        }
        // A lit chord. The shiver: a damped standing wave on every string, quicker for high chords than for low ones.
        const ring = Math.exp(-P.age / (0.22 + 0.25 * P.loud));
        const shake = shiver * (24 + 36 * P.loud) * ring * Math.cos(TAU * (P.ph + P.age * (3.5 + 5 * P.reg)));
        const path = new Path2D(); trace(path, P, Rpx, bow, sk, tw, shake);
        const land = Math.max(0, 1 - P.age / 0.16);          // the first instants of an attack: a white-hot stroke
        if (P.v.length > 2 && fillA > 0) { g.fillStyle = rgba(col, Math.min(0.26, fillA * (0.25 * fresh + 0.75 * atk)) * kf); g.fill(path); }
        // Glow: wide and soft for loud chords, capped so a climax stays a shape, not a cloud.
        // Only around the attack (wide strokes are what costs time in a dense passage); a ringing chord keeps its core.
        if (atk > 0.06 && (0.05 + 0.1 * P.loud) * atk * kf > 0.006) {
          g.strokeStyle = rgba(col, (0.05 + 0.1 * P.loud) * fresh * kf); g.lineWidth = Math.min(16, weight * (3 + 9 * P.loud)) * (0.5 + 0.5 * fresh); g.stroke(path);
        }
        if ((0.12 + 0.12 * P.loud) * fresh * kf > 0.01) { g.strokeStyle = rgba(col, (0.12 + 0.12 * P.loud) * fresh * kf); g.lineWidth = Math.min(7, weight * (1.6 + 3.6 * P.loud)) * (0.6 + 0.4 * fresh); g.stroke(path); }
        // Core: as bright for a soft chord as for a loud one (only thinner), so every attack lands.
        g.strokeStyle = rgba(col, ((0.14 + 0.4 * a) * dens + (0.6 + 0.3 * P.loud) * fresh * skf), 30 + 40 * fresh);
        g.lineWidth = weight * (0.5 + (0.6 + 1.8 * P.loud) * fresh); g.stroke(path);
        if (land > 0) { g.strokeStyle = rgba([255, 240, 228], 0.55 * land * skf); g.lineWidth = weight * (0.6 + 1.2 * P.loud) * land; g.stroke(path); }
        if (atk > 0.05) for (const q of P.octs || P.v) if (q.new) beads.push([q, sk, tw, fresh, P.loud, col]);
      }
      polys = polys.filter((P) => P.age < decay);
      // Beads on the corners just struck, sized by how hard each note was played.
      for (const [q, sk, tw, fresh, loud, col] of beads) {
        const [px, py] = pt(q.f, q.r * sk, Rpx, tw), rad = (1.4 + 3.2 * q.v / 110) * Math.sqrt(weight) * (0.5 + 0.5 * fresh);
        g.fillStyle = rgba(col, 0.55 * fresh * skf, 90); g.beginPath(); g.arc(px, py, rad, 0, TAU); g.fill();
      }

      // The journey: centres of gravity of successive chords, a thin bone thread.
      for (const q of trail) q.age += dt;
      trail = trail.filter((q) => q.age < decay);
      // Smoothed through segment midpoints so it reads as a drawn line, not a zigzag.
      const tp = trail.map((q) => { const k = sinkK(q.age, decay) * Rpx; return [q.x * k, q.y * k, Math.pow(Math.max(0, 1 - q.age / decay), 1.2)]; });
      for (let i = 1; i < tp.length - 1; i++) {
        const a0 = tp[i - 1], a1 = tp[i], a2 = tp[i + 1];
        g.strokeStyle = `rgba(240,225,200,${(0.22 * a1[2]).toFixed(3)})`; g.lineWidth = 0.5 + 0.9 * a1[2];
        g.beginPath(); g.moveTo((a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2); g.quadraticCurveTo(a1[0], a1[1], (a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2); g.stroke();
      }
      const head = trail[trail.length - 1];
      if (head) { g.fillStyle = 'rgba(255,240,215,0.8)'; g.beginPath(); g.arc(head.x * Rpx, head.y * Rpx, 2 + 2.5 * Math.max(0, 1 - head.age / 0.4), 0, TAU); g.fill(); }

      // Nodes: dim pegs on the rim; a struck note lights the rim around its peg and glows at its own register on the
      // spoke (deep inside for a low note, past the rim for a high one), joined to the peg by a thin ray.
      for (let pc = 0; pc < 12; pc++) {
        const f = FIFTH(pc), [px, py] = pt(f, 1, Rpx), e = Math.min(1.3, node[pc]);
        const col = fnColour(pc, FUNC);
        g.fillStyle = 'rgba(150,120,115,0.35)'; g.beginPath(); g.arc(px, py, 2, 0, TAU); g.fill();
        if (e > 0.05) {
          const a0 = f * STEP - Math.PI / 2, hw = 0.04 + 0.12 * e;
          g.strokeStyle = rgba(col, Math.min(1, e)); g.lineWidth = 1 + 5 * e * Math.sqrt(weight / 1.2);
          g.beginPath(); g.arc(0, 0, Rpx, a0 - hw, a0 + hw); g.stroke();
          const [sx, sy] = pt(f, nodeR[pc], Rpx);
          g.strokeStyle = rgba(col, 0.35 * Math.min(1, e)); g.lineWidth = 1;
          g.beginPath(); g.moveTo(px, py); g.lineTo(sx, sy); g.stroke();
          const rad = 6 + 30 * Math.min(1, e);
          const gr = g.createRadialGradient(sx, sy, 0, sx, sy, rad);
          gr.addColorStop(0, rgba([255, 240, 225], 0.85 * Math.min(1, e)));
          gr.addColorStop(0.25, rgba(col, 0.5 * Math.min(1, e)));
          gr.addColorStop(1, rgba(col, 0));
          g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, rad, 0, TAU); g.fill();
        }
        if (pc === tonic && keyKnown) {
          g.strokeStyle = 'rgba(240,222,190,0.45)'; g.lineWidth = 1.2;
          g.beginPath(); g.arc(px, py, 9 + 3 * e, 0, TAU); g.stroke();
          if (minor) { g.beginPath(); g.arc(px, py, 13 + 3 * e, 0, TAU); g.stroke(); }
        }
      }
      g.restore();
      x.g.globalCompositeOperation = 'lighten'; x.g.drawImage(off, 0, 0);
    },
  });
})();
