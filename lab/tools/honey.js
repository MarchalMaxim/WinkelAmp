// Honey (round 9, the user: "droopy, viscous, honey, slow"). It will not let go. A thick gold mass hangs from the top; every
// note loads it, and under that load it sags, necks and stretches into threads that keep on thinning long past where
// anything should break, then fold in lazy coils on a pool that takes ten seconds to level. The attack is seen at once (a
// slow quiver and a pale glint through the mass, nearby bulbs jolt); the droop follows it.
// Everything is a thickness field (a Float32Array, 1/3 of the stage): bodies add to it row by row, so neighbours bridge by
// themselves, and thickness is colour through a table: thread-thin is pale, thick is dark. Threads thinner than the field
// can hold are drawn crisp on the stage in the same pale gold.
(() => {
  const FW = 427, FH = 240, FWm = FW - 1, FHm = FH - 1;         // the field; about 3 stage pixels to one
  const CS = 4, CN = Math.ceil(FW / CS) + 2;                    // the mass and the pool live on coarser columns, for their slow diffusion
  const MAX_STRANDS = 28, MAX_DOTS = 620, FEW = 0.5;            // FEW: below this radius a thread leaves the field and is drawn crisp
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const [fc, fg] = mk(FW, FH);
  const img = fg.createImageData(FW, FH), px = new Uint32Array(img.data.buffer), F = new Float32Array(FW * FH);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---- colour: a table from thickness to colour, for three honeys the colour knob slides between
  const STOPS = [0, 44, 95, 165, 255];                          // thin to thick, at table index (thickness × 90)
  const HONEYS = [
    [[255, 247, 205], [250, 226, 130], [238, 190, 70], [214, 150, 40], [176, 112, 24]],   // acacia
    [[255, 233, 160], [240, 186, 56], [214, 142, 26], [138, 74, 12], [92, 44, 6]],        // honey
    [[238, 176, 86], [176, 100, 22], [104, 50, 10], [52, 22, 5], [26, 10, 2]],            // treacle
  ];
  const LR = new Float32Array(256), LG = new Float32Array(256), LB = new Float32Array(256), LA = new Float32Array(256);
  for (let i = 0; i < 256; i++) LA[i] = sstep(13, 20, i);
  let lutAt = -1;
  function buildLut(c) {
    const q = Math.round(c * 32) / 32; if (q === lutAt) return; lutAt = q;
    const f = q * 2, a = Math.min(1, Math.floor(f)), t = f - a;
    for (let i = 0; i < 256; i++) {
      let k = 0; while (k < 3 && i > STOPS[k + 1]) k++;
      const u = (i - STOPS[k]) / (STOPS[k + 1] - STOPS[k]);
      const at = (j) => mix(mix(HONEYS[a][k][j], HONEYS[a][k + 1][j], u), mix(HONEYS[a + 1][k][j], HONEYS[a + 1][k + 1][j], u), t);
      LR[i] = at(0); LG[i] = at(1); LB[i] = at(2);
    }
    const p = HONEYS[a][0], o = HONEYS[a + 1][0];
    threadCol = `rgb(${mix(p[0], o[0], t) | 0},${mix(p[1], o[1], t) | 0},${mix(p[2], o[2], t) | 0})`;
  }
  let threadCol = '#ffe9a0';

  // ---- state
  const Dm = new Float32Array(CN), Dt = new Float32Array(CN), Pm = new Float32Array(CN), Pt = new Float32Array(CN), Q = new Float32Array(CN), Qp = new Float32Array(CN), LOAD = new Float32Array(CN);
  const edge = new Float32Array(FW), surf = new Float32Array(FW), glint = new Float32Array(FW);
  let strands = [], dots = [], drops = [], waves = [], glints = [], time = 0, lastSag = -9, vels = null;
  const BASE_D = 19, BASE_P = 11;
  Dm.fill(BASE_D); Pm.fill(BASE_P);
  const edgeAt = (x) => edge[clamp(x | 0, 0, FWm)], surfAt = (x) => surf[clamp(x | 0, 0, FWm)];

  // ---- writing into the field. span: one row of a body of radius R, with a soft skirt so neighbours bridge.
  function span(y, cx, R, K = 1) {
    const W = R * 1.22, A = Math.min(3.2, 0.26 + R * 0.15) * K, iw = 1 / (W * W), base = y * FW;
    let a = Math.ceil(cx - W), b = Math.floor(cx + W); if (a < 0) a = 0; if (b > FWm) b = FWm;
    for (let i = a; i <= b; i++) { const d = i - cx, q = 1 - d * d * iw; if (q > 0) F[base + i] += A * q * Math.sqrt(q); }
  }
  function disc(cx, cy, R, A) {
    const W = R * 1.35, iw = 1 / (W * W);
    let y0 = Math.ceil(cy - W), y1 = Math.floor(cy + W); if (y0 < 0) y0 = 0; if (y1 > FHm) y1 = FHm;
    let a = Math.ceil(cx - W), b = Math.floor(cx + W); if (a < 0) a = 0; if (b > FWm) b = FWm;
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy, dy2 = dy * dy, base = y * FW;
      for (let i = a; i <= b; i++) { const d = i - cx, q = 1 - (d * d + dy2) * iw; if (q > 0) F[base + i] += A * q * q; }
    }
  }
  // A hanging drop's radius, u rows above its lowest point: round below, then a long taper into the neck.
  function tear(u, Rb) {
    if (Rb <= 0.05) return 0;
    if (u < Rb) { const k = (u - Rb) / Rb; return Rb * Math.sqrt(Math.max(0, 1 - k * k)); }
    const k = (u - Rb) / (Rb * 1.5 + 3);
    return Rb * Math.exp(-k * Math.sqrt(k));
  }

  // ---- notes
  function bump(arr, xf, sigma, amt) {       // add a soft hill to a coarse column array at field x
    const c = xf / CS, s = sigma / CS, a = Math.max(0, Math.floor(c - s * 2.5)), b = Math.min(CN - 1, Math.ceil(c + s * 2.5)), k = 1 / (2 * s * s);
    for (let i = a; i <= b; i++) { const d = i - c; arr[i] += amt * Math.exp(-d * d * k); }
  }
  const quantile = (v) => {
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((p, q) => p - q);
    if (!vels.length) return 1;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length;
  };
  const noteX = (m, x) => clamp(FW * (0.05 + 0.9 * clamp((m - 30) / 66, 0, 1)) + x.rnd(-7, 7), 3, FW - 4);
  function newStrand(nx, w, fat, d, x) {
    const v0 = (5 + 46 * w) * fat * fat, y0 = edgeAt(nx) + 1;
    const r0 = 1 + Math.sqrt(v0) * 0.26;
    return { x0: nx, xt: nx, y: y0, vol: v0 * 0.08, swell: v0 * 0.92, V: r0 * r0 * 12, feed: Math.min(9, d * 1.3), rate: v0 * 0.34, rootR: 3 + Math.sqrt(v0) * 0.55, age: 0, hair: 0, jolt: 0, pluck: 0, glow: 1,
      sway: x.rnd(0, 6.28), swayS: x.rnd(0.18, 0.4), land: false, lx: 0, phi: x.rnd(0, 6.28), landAge: 0, layAcc: 0, retract: false, into: null, beads: [], r: r0, Rb: 0, dead: false };
  }
  function breakStrand(s, x) {
    if (s.retract) return;
    const rootY = edgeAt(s.x0), L = s.y - rootY, cut = rootY + L * x.rnd(0.35, 0.7), bottom = s.land ? s.y - 2 : s.y - Math.sqrt(s.vol);
    let y = cut + x.rnd(4, 9);                                  // the lower part beads and falls
    while (y < bottom) { const r = x.rnd(0.7, 1.7); drops.push({ x: s.xt + (s.x0 - s.xt) * (1 - (y - rootY) / L), y, r, v: 0 }); y += x.rnd(9, 20); }
    if (!s.land && !s.into) drops.push({ x: s.xt, y: s.y, r: Math.sqrt(s.vol), v: 0 });
    for (const o of strands) if (o.into === s) { o.into = null; o.vol = 1; breakStrand(o, x); }
    s.y = cut; s.land = false; s.into = null; s.retract = true; s.vol = 1.2; s.feed = 0; s.xt = s.x0 + (s.xt - s.x0) * 0.5;
  }

  // ---- the knob pictures
  const HC = '#e0a020', PC = '#ffe9a0';
  const dropIcon = (g, cx, top, tip, R, col) => {  // a thread from top down to a drop
    g.strokeStyle = PC; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, tip - R); g.stroke();
    ICON.dot(g, cx, tip - R, R, col || HC);
  };
  TOOLS.push({
    id: 'honey', name: 'Honey', tag: 'new',
    blurb: 'A thick gold mass sags under each note, stretches into long threads that will not let go, and coils slowly into a pool.',
    params: [
      { key: 'thick', label: 'how thick it is', min: 0, max: 1, value: 0.5,
        hint: 'How stiff the honey is. Left: runny, quick to fall. Right: nearly solid, barely moves.',
        icon: (g, v, w, h) => { ICON.rect(g, 0, 0, w, 7, HC); dropIcon(g, w / 2, 7, 7 + (1 - v) * (h - 10) + 3, 3); } },
      { key: 'load', label: 'how much each note adds', min: 0.25, max: 2.2, value: 1,
        hint: 'How heavy a note makes the honey. Left: thin threads only. Right: great heavy bulbs.',
        icon: (g, v, w, h) => { ICON.rect(g, 0, 0, w, 5, HC); dropIcon(g, w / 2, 5, h - 2, 1.5 + v * 6); } },
      { key: 'stretch', label: 'how far a thread stretches', min: 0, max: 1, value: 0.7,
        hint: 'How far a thread stretches before it breaks. Left: it snaps early. Right: it never lets go.',
        icon: (g, v, w, h) => { ICON.rect(g, 0, 0, w, 4, HC); dropIcon(g, w / 2, 4, 9 + v * (h - 11), 2.2); if (v < 0.5) ICON.dot(g, w / 2 + 0.5, h - 3, 1.3, HC); } },
      { key: 'busy', label: 'how many notes start a sag', min: 0, max: 1, value: 0.5,
        hint: 'How many notes start a new sag. Left: only the big ones. Right: nearly every note.',
        icon: (g, v, w, h) => { ICON.rect(g, 0, 0, w, 4, HC); const n = 1 + Math.round(v * 5); for (let i = 0; i < n; i++) dropIcon(g, ((i + 0.5) / n) * w, 4, 12 + ((i * 7) % 3) * 4, 2); } },
      { key: 'colour', label: 'how dark the honey is', min: 0, max: 1, value: 0.5,
        hint: 'How dark the honey is. Left: pale, light acacia. Right: dark treacle.',
        icon: (g, v, w, h) => ICON.dot(g, w / 2, h / 2, 8, ICON.lerp(v < 0.5 ? '#f6dd80' : '#d68e1a', v < 0.5 ? '#d68e1a' : '#34160a', v < 0.5 ? v * 2 : v * 2 - 1)) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much of it you see. Left: almost nothing, a thin slow film that only the hardest attacks disturb. Right: fully there.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => ICON.dot(g, w / 2, h / 2, 8, HC)) },
    ],
    reset() {
      strands = []; dots = []; drops = []; waves = []; glints = []; time = 0; lastSag = -9; vels = null;
      Dm.fill(BASE_D); Dt.fill(0); Pm.fill(BASE_P); Pt.fill(0); LOAD.fill(0);
    },
    onChord(ch, x) {
      const pres = x.p('presence'), load = x.p('load'), busy = x.p('busy');
      const q = quantile(ch.vel), hardCut = (1 - pres) * 0.95;
      const attackK = pres >= 0.999 ? 1 : pres * sstep(hardCut - 0.25, hardCut, q);
      // In the same frame: a quiver from where the note lands, a glint along the surface, the nearest threads twitch.
      const top = ch.notes.reduce((a, n) => (n.v > a.v ? n : a), ch.notes[0]), lx = noteX(top.m, x), loud = ch.vel / 110;
      if (attackK > 0.03) {
        waves.push({ x: lx, age: 0, a: (2.2 + 5 * loud * loud) * (0.7 + Math.min(4, ch.notes.length) * 0.15) * attackK }); if (waves.length > 9) waves.shift();
        glints.push({ x: lx, age: 0, a: (0.55 + 0.75 * loud) * attackK }); if (glints.length > 12) glints.shift();
      }
      const cut = Math.max((1 - busy) * 0.9, hardCut);
      let started = 0;
      for (const n of ch.notes) {
        const nx = noteX(n.m, x), w = Math.pow(n.v / 105, 1.6) * load, pitch = clamp((n.m - 30) / 66, 0, 1), fat = 1.45 - 0.95 * pitch;
        const hasThin = (n.m >= 74);
        bump(LOAD, nx, 12 + 16 * fat, w * (2.2 + 2 * fat) * (0.1 + 0.9 * pres));       // weight on the mass, seen within a tenth of a second
        for (const s of strands) {
          const d = Math.abs(s.xt - nx); if (d > 46) continue;
          const k = 1 - d / 46;
          s.jolt = Math.max(s.jolt, (6 + 20 * w * fat) * k * attackK); s.pluck = Math.max(s.pluck, (1.2 + 3 * w) * k * attackK); s.glow = Math.max(s.glow, k * attackK);
        }
        // High notes: small quick beads on the threads that are already there.
        if (hasThin) {
          let best = null, bd = 70;
          for (const s of strands) { if (s.retract || s.beads.length > 2) continue; const d = Math.abs(s.x0 - nx); if (d < bd) { bd = d; best = s; } }
          if (best && attackK > 0.1) { best.beads.push({ pos: 0, r: 0.8 + 1.5 * clamp(w, 0, 1.5) * attackK }); continue; }
        }
        // Weight enough, and a sag starts; next to one already hanging, the note feeds that one instead.
        if (quantile(n.v) < cut || started >= 4) continue;
        let near = null, nd = 12 + 14 * fat;
        for (const s of strands) { if (s.retract || s.into || s.land) continue; const d = Math.abs(s.x0 - nx); if (d < nd && s.y - edgeAt(s.x0) < 130) { nd = d; near = s; } }
        if (near) { near.swell += (2 + 18 * w) * fat * fat; near.feed = Math.max(near.feed, Math.min(9, n.d * 1.3)); near.V += 6 * w; continue; }
        if (time - lastSag < (ch.notes.length > 1 ? 0 : 0.5 * (1.5 - busy))) continue;
        if (strands.length >= MAX_STRANDS) {
          let old = null; for (const s of strands) if (!s.retract && !s.into && (!old || s.r < old.r || s.hair > old.hair)) old = s;
          if (old) breakStrand(old, x);
          if (strands.length >= MAX_STRANDS + 6) continue;
        }
        strands.push(newStrand(nx, w, fat, n.d, x)); started++; lastSag = time;
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt, pres = x.p('presence');
      if (pres < 0.005) return;
      buildLut(x.p('colour'));
      const stretch = x.p('stretch');
      const tk = Math.pow(2, (0.5 - x.p('thick')) * 3.4) * (0.5 + 0.5 * pres);   // how quick everything is
      const base = BASE_D * (0.3 + 0.7 * pres), baseP = BASE_P * (0.3 + 0.7 * pres);
      time += dt;

      // ---- the mass and the pool: load comes in quickly, then both spread and settle slowly
      if (dt > 0) {
        const fast = 1 - Math.exp(-dt * 13);
        for (let i = 0; i < CN; i++) { const a = LOAD[i] * fast; LOAD[i] -= a; Dm[i] += a * Math.max(0.05, 1 - (Dm[i] - base) / 55); Dm[i] += (base - Dm[i]) * dt * 0.05 * Math.sqrt(tk); Pm[i] += (baseP - Pm[i]) * dt * 0.018; }
        const kd = clamp(dt * 1.5 * tk, 0, 0.45), kp = clamp(dt * 3 * tk, 0, 0.45);   // a mound of about 30 field px levels in ten seconds
        Dt[0] = Dm[0] + kd * (Dm[1] - Dm[0]); Pt[0] = Pm[0] + kp * (Pm[1] - Pm[0]);
        for (let i = 1; i < CN - 1; i++) { Dt[i] = Dm[i] + kd * (Dm[i - 1] + Dm[i + 1] - 2 * Dm[i]); Pt[i] = Pm[i] + kp * (Pm[i - 1] + Pm[i + 1] - 2 * Pm[i]); }
        Dt[CN - 1] = Dm[CN - 1] + kd * (Dm[CN - 2] - Dm[CN - 1]); Pt[CN - 1] = Pm[CN - 1] + kp * (Pm[CN - 2] - Pm[CN - 1]);
        Dm.set(Dt); Pm.set(Pt);
      }
      // The quiver: rolling, slow, spreading out from each note.
      Q.fill(0); Qp.fill(0);
      for (const w of waves) {
        w.age += dt;
        const env = w.a * Math.exp(-w.age / 1.5) * Math.min(1, 0.45 + w.age * 8), reach = 16 + w.age * 62;
        const c0 = Math.max(0, Math.floor((w.x - reach * 2.2) / CS)), c1 = Math.min(CN - 1, Math.ceil((w.x + reach * 2.2) / CS));
        for (let i = c0; i <= c1; i++) {
          const d = Math.abs(i * CS - w.x), v = env * Math.exp(-d / reach) * Math.cos(d * 0.085 - w.age * 3.6);
          Q[i] += v; Qp[i] += v * 0.3;
        }
      }
      waves = waves.filter((w) => w.age < 6);
      for (let i = 0; i < FW; i++) {
        const c = i / CS, a = c | 0, f = c - a;
        edge[i] = Dm[a] + (Dm[a + 1] - Dm[a]) * f + Q[a] + (Q[a + 1] - Q[a]) * f;
        surf[i] = FH - (Pm[a] + (Pm[a + 1] - Pm[a]) * f + Qp[a] + (Qp[a + 1] - Qp[a]) * f);
      }
      // The glint travels both ways along the surfaces.
      glint.fill(0);
      for (const l of glints) {
        l.age += dt;
        const e = l.a * Math.exp(-l.age / 1.0), pos = l.age * 74, sig = 7 + l.age * 8;
        for (const c of [l.x - pos, l.x + pos]) {
          const a = Math.max(0, (c - sig * 2.4) | 0), b = Math.min(FWm, (c + sig * 2.4) | 0);
          for (let i = a; i <= b; i++) { const d = (i - c) / sig; glint[i] += e * Math.exp(-d * d); }
        }
      }
      glints = glints.filter((l) => l.age < 3.5);

      // ---- the strands: sag, neck, merge, land, break
      if (dt > 0) {
        for (let i = 0; i < strands.length; i++) {
          const a = strands[i]; if (a.retract || a.into) continue;
          for (let j = i + 1; j < strands.length; j++) {
            const b = strands[j]; if (b.retract || b.into) continue;
            const dx0 = b.x0 - a.x0, ad = Math.abs(dx0);
            if (ad < 34 && ad > 1) {                    // roots draw together, and a web of the mass rises between them
              const m = Math.sign(dx0) * dt * 1.6 * tk; a.x0 += m; b.x0 -= m;
              if (!a.land && !b.land) { a.xt += m * 0.7; b.xt -= m * 0.7; }
              bump(LOAD, (a.x0 + b.x0) / 2, 9, dt * 1.3 * (1 - ad / 34));
            }
            if (a.land || b.land) continue;
            const dxt = b.xt - a.xt, ax = Math.abs(dxt), dy = Math.abs(a.y - b.y), ra = Math.sqrt(a.vol), rb = Math.sqrt(b.vol);
            if (ax < 40 && dy < 46) { const m = Math.sign(dxt) * dt * 3.2 * tk * (1 - ax / 40); a.xt += m; b.xt -= m; }
            if (ax < (ra + rb) * 0.8 && dy < Math.max(ra, rb)) {      // two bulbs become one, hung from both threads
              const big = a.vol >= b.vol ? a : b, small = big === a ? b : a;
              big.vol += small.vol; big.V += small.V * 0.5; big.feed = Math.max(big.feed, small.feed); small.vol = 0; small.into = big; small.feed = 0;
            }
          }
        }
      }
      for (const s of strands) {
        s.age += dt; s.glow *= Math.exp(-dt * 1.7); s.pluck *= Math.exp(-dt * 1.2);
        const rootY = edgeAt(s.x0);
        if (s.retract) { s.y -= dt * 5 * tk; s.vol += dt * 0.25; if (s.y - rootY < 1.5) { s.dead = true; bump(LOAD, s.x0, 10, 0.7); } }
        else if (s.into) {
          const t = s.into; if (t.dead || t.retract) { s.into = null; s.vol = 1; breakStrand(s, x); } else { s.xt = t.xt; s.y = t.y - Math.sqrt(t.vol) * 0.8; s.land = false; }
        } else if (s.land) {
          // The bulb drains into the pool, and what is left of the thread folds over and over on itself.
          s.landAge += dt;
          const flow = Math.min(s.vol, (3 + s.vol * 0.3) * dt * tk);
          s.vol -= flow; bump(Pm, s.lx, 11, flow * 0.05 + dt * 0.5 * tk); bump(Pm, s.lx, 26, flow * 0.045);
          const rope = clamp(s.r * 1.2 + 1.2, 2.1, 3.8), a = clamp(2.5 + rope * 1.9 + Math.sqrt(s.vol) * 0.4, 5, 11);
          s.phi += dt * tk * clamp(11 / a, 0.9, 1.9);
          s.xt = s.lx + a * Math.cos(s.phi);
          const top = surfAt(s.lx), pile = Math.min(11, s.landAge * 0.7 + 1);
          s.y = top - pile * (0.55 + 0.45 * Math.sin(s.phi * 0.17)) + 0.3 * a * Math.sin(s.phi) + Math.sqrt(s.vol) * 0.7;
          s.layAcc += dt * tk;
          if (s.layAcc > 0.085 && dt > 0) { s.layAcc = 0; dots.push({ x: s.xt, y: s.y, r: rope, age: 0, life: x.rnd(5, 8) }); if (dots.length > MAX_DOTS) dots.shift(); }
        } else if (dt > 0) {
          if (s.swell > 0) { const k = s.swell * (1 - Math.exp(-dt * 1.7 * Math.sqrt(tk))); s.swell -= k; s.vol = Math.min(560, s.vol + k); }   // the bulge fills, it does not pop
          if (s.feed > 0) { const f = Math.min(dt, s.feed); s.feed -= dt; s.vol = Math.min(560, s.vol + s.rate * f); s.V += s.rate * f * 1.25; bump(Dm, s.x0, 14, -s.rate * f * 0.012); }
          const Rb = Math.sqrt(s.vol), L = s.y - rootY, heavy = 1 + Math.max(0, Dm[clamp((s.x0 / CS) | 0, 0, CN - 1)] - base) / 45;
          s.y += ((3.4 + 0.058 * Math.min(420, Rb * Rb)) * (1 + L / 240) * heavy * tk + s.jolt) * dt;
          s.jolt *= Math.exp(-dt * 3.2);
          if (s.y - Rb * 0.4 >= surfAt(s.xt)) { s.land = true; s.lx = s.xt; s.landAge = 0; }
        }
        // Volume conserved: the longer the thread, the thinner, and it keeps draining slowly into the bulb.
        const L = Math.max(0, s.y - rootY);
        if (dt > 0 && !s.retract && s.feed <= 0) { const d = s.V * (1 - Math.exp(-dt * 0.07 * tk)); s.V -= d; if (!s.land && !s.into) s.vol += d * 0.06; }
        s.r = Math.max(0.2, Math.sqrt(s.V / (L + 7)));
        s.rootR += ((s.r * 1.3 + 1.2 + Math.min(4.5, Math.sqrt(s.vol) * 0.4) * (s.land ? 0.4 : 1)) - s.rootR) * Math.min(1, dt * 0.35 * tk);
        s.Rb = Math.sqrt(s.vol);
        // Break: only after an enormous stretch; the upper part then goes back up, slowly.
        if (!s.retract && dt > 0) {
          if (s.r < 0.42 && s.feed <= 0) s.hair += dt * tk;
          const hairMax = stretch >= 0.995 ? 1e9 : mix(2, 62, stretch * stretch), Lmax = mix(26, 420, Math.pow(stretch, 1.5));
          if (s.hair > hairMax || (!s.land && L > Lmax)) breakStrand(s, x);
        }
        for (const b of s.beads) b.pos += dt * (11 + b.r * b.r * 7) * tk * (0.6 + 0.4 * Math.min(1, b.pos / 30 + 0.3));
        for (const b of s.beads) if (b.pos >= L) { s.vol += b.r * b.r; b.done = true; }
        if (s.beads.length) s.beads = s.beads.filter((b) => !b.done);
      }
      strands = strands.filter((s) => !s.dead);
      for (const d of drops) {
        d.v += dt * (2.2 + d.r * 2) * tk; d.y += d.v * dt + dt * (2 + d.r * d.r * 1.6) * tk;
        if (d.y >= surfAt(d.x)) { d.dead = true; bump(Pm, d.x, 14, d.r * d.r * 0.09); dots.push({ x: d.x, y: surfAt(d.x) - 0.5, r: d.r * 1.15, age: 0, life: 4 }); }
      }
      if (drops.length) drops = drops.filter((d) => !d.dead);
      for (const d of dots) { d.age += dt; d.y += dt * 1.1 * tk; }
      if (dots.length && dots[0].age > 3) dots = dots.filter((d) => d.age < d.life);

      // ---- the field
      F.fill(0);
      for (let i = 0; i < FW; i++) {           // the mass: thick above, down to a soft lit edge; slow folds of thickness inside it
        const e = edge[i], swell = 0.14 * Math.sin(i * 0.031 + time * 0.09) + 0.1 * Math.sin(i * 0.083 - time * 0.13);
        const last = Math.min(FHm, Math.ceil(e + 2));
        for (let y = 0; y <= last; y++) { const t = e - y; F[y * FW + i] += t < 0 ? Math.max(0, 0.2 + t * 0.14) : Math.min(2.9, 0.2 + t * (0.085 + swell * 0.04)); }
        const s = surf[i], s0 = Math.max(0, Math.floor(s - 2));   // the pool
        for (let y = s0; y < FH; y++) { const t = y - s; F[y * FW + i] += t < 0 ? Math.max(0, 0.2 + t * 0.14) : Math.min(2.6, 0.2 + t * 0.1); }
      }
      const threads = [];                      // what is too thin for the field: drawn crisp afterwards
      const cxOf = (s, row, rootY, L) => {
        const t = L > 0 ? clamp((row - rootY) / L, 0, 1) : 1, b = Math.sin(t * Math.PI);
        const c = Math.min(CN - 1, (s.x0 / CS) | 0);
        return s.x0 + (s.xt - s.x0) * t * Math.sqrt(t)
          + b * (2.6 * Math.min(1, L / 60) * Math.sin(time * s.swayS + s.sway + t * 2.2) + s.pluck * Math.min(1, L / 70) * Math.sin(t * 13 - time * 4.5) + Q[c < 0 ? 0 : c] * 0.5);
      };
      for (const s of strands) {
        const rootY = edgeAt(s.x0), L = s.y - rootY, Rb = s.Rb, fun = 5 + s.rootR * 1.6;
        const r0 = Math.max(0, Math.floor(rootY - 14)), r1 = Math.min(FHm, Math.floor(s.y));
        let run = null;
        for (let row = r0; row <= r1; row++) {
          const u = s.y - row, dr = Math.max(0, row - rootY);
          const R = s.r + s.rootR * Math.exp(-dr / fun) + tear(u, Rb);
          const cx = cxOf(s, row, rootY, L);
          if (R >= FEW) span(row, cx, R, sstep(rootY - 14, rootY + 5, row));   // melts into the mass above it
          if (R < 0.95 && (row % 4 === 0 || row === r1)) { if (!run) { run = { s, xs: [], ys: [], rs: [] }; threads.push(run); } run.xs.push(cx); run.ys.push(row); run.rs.push(R * sstep(0.95, 0.62, R)); }
          else if (R >= 0.95) run = null;
        }
        for (const b of s.beads) {
          const row = rootY + b.pos, cx = cxOf(s, row, rootY, L);
          for (let y = Math.max(0, Math.ceil(row - b.r * 3.5)); y <= Math.min(FHm, Math.floor(row + 1)); y++) { const R = tear(row + 0.5 - y, b.r); if (R > 0.3) span(y, cx, R); }
        }
      }
      for (const d of drops) {
        const v = 0.7 + d.r * 2.2;
        for (let y = Math.max(0, Math.floor(d.y - d.r * 3.5 - v)); y <= Math.min(FHm, Math.floor(d.y)); y++) { const R = tear(d.y - y, d.r); if (R > 0.35) span(y, d.x, R); }
      }
      for (const d of dots) {                  // the folds, soft, and gone once the pool has swallowed them
        const k = (1 - d.age / d.life) * sstep(surfAt(d.x) + 7, surfAt(d.x) - 1, d.y);
        if (k > 0.02) disc(d.x, d.y, d.r * (0.75 + 0.25 * k), Math.min(0.8, 0.2 + d.r * 0.12) * k);
      }

      // ---- thickness through the table; the soft highlight down one side comes from the gradient
      for (let y = 0, i = 0; y < FH; y++) {
        for (let xx = 0; xx < FW; xx++, i++) {
          const v = F[i];
          if (v < 0.05) { px[i] = 0; continue; }
          const idx = v >= 2.83 ? 255 : (v * 90) | 0;
          const gx = (xx < FWm ? F[i + 1] : v) - (xx > 0 ? F[i - 1] : v), gy = (y < FHm ? F[i + FW] : v) - (y > 0 ? F[i - FW] : v);
          const inner = v > 0.3 ? (v > 0.8 ? 1 : (v - 0.3) * 2) : 0;
          const hi = inner * Math.min(120, gx > 0 ? gx * gx * 520 : 0);                               // lit softly down the left side
          const sh = 1 + (gx < 0 ? gx * 0.55 * inner : 0);
          const gl = glint[xx] * (v < 0.3 ? 1 : v > 1.1 ? 0.03 : 0.03 + 0.97 * (1.1 - v) / 0.8);        // the glint runs along the surfaces, not through the depth
          const lift = hi + gl * 150;
          let r = LR[idx] * (sh < 0.4 ? 0.4 : sh) + lift, gg_ = LG[idx] * (sh < 0.4 ? 0.4 : sh) + lift * 0.86, b = LB[idx] * (sh < 0.4 ? 0.4 : sh) + lift * 0.42;
          if (r > 255) r = 255; if (gg_ > 255) gg_ = 255; if (b > 255) b = 255;
          px[i] = ((LA[idx] * 255) << 24) | (b << 16) | (gg_ << 8) | r;
        }
      }
      fg.putImageData(img, 0, 0);

      // ---- on the stage
      const W = x.W, H = x.H, SX = W / FW, SY = H / FH;
      g.save();
      g.globalAlpha = 0.25 * pres; g.fillStyle = '#1a0e06'; g.fillRect(0, 0, W, H);   // the warm dark ground, only ever a veil over what is under it
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = Math.pow(pres, 1.3);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'medium';
      g.drawImage(fc, 0, 0, W, H);
      // The hair: one pale filled path, with a faint halo, brighter where a note has just passed.
      if (threads.length) {
        g.fillStyle = threadCol; g.beginPath();
        for (const t of threads) {
          const n = t.xs.length; if (n < 2) continue;
          g.moveTo(t.xs[0] * SX - t.rs[0] * SX, t.ys[0] * SY);
          for (let i = 1; i < n; i++) g.lineTo(t.xs[i] * SX - t.rs[i] * SX, t.ys[i] * SY);
          for (let i = n - 1; i >= 0; i--) g.lineTo(t.xs[i] * SX + t.rs[i] * SX, t.ys[i] * SY);
          g.closePath();
        }
        g.fill();
        g.globalCompositeOperation = 'lighter'; g.strokeStyle = threadCol; g.lineJoin = 'round';
        for (const t of threads) {
          const n = t.xs.length; if (n < 2) continue;
          g.globalAlpha = (0.08 + 0.3 * t.s.glow) * pres; g.lineWidth = 3 + 2 * t.s.glow;
          g.beginPath(); g.moveTo(t.xs[0] * SX, t.ys[0] * SY);
          for (let i = 1; i < n; i++) g.lineTo(t.xs[i] * SX, t.ys[i] * SY);
          g.stroke();
        }
      }
      g.restore();
    },
  });
})();
