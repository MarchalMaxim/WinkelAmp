// Honey (round 9, the user: "droopy, viscous, honey, slow"). Not a picture of honey: honey as a way of moving. Flat, Arp-like
// masses hang at different heights across the black, and threads sag from one to the next. A note weighs on a mass: its lower part sinks
// within a tenth of a second and never springs back, it only relaxes over seconds, and part of the drop stays for good. It fills
// slowly and pushes out a bud that crawls away on a neck going from fat to hair and slows as it
// stretches; a bud that reaches another mass melts into it and leaves a thread, so the forms cannot let go of each other.
// High notes send beads down the threads into a belly at the lowest point, and a heavy belly becomes a mass of its own.
// Bodies are a metaball field cut at one level, with a distance-true edge; threads are tapered vector shapes under it in the
// body colour, so they belong to the bodies. New high masses grow out of nothing. No ceiling, no floor, no lighting: what gets
// too heavy sinks off the bottom.
(() => {
  const LW = 427, LH = 240;                                     // the model's units; about 3 stage pixels to one
  const FS = 1.5, FW = 640, FH = 360, FWm = FW - 1, FHm = FH - 1, CUT = 0.2;
  const MAX_NODES = 11, MAX_LINKS = 22, MAX_S = 30, MAX_VOL = 1000;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const [fc, fg] = mk(FW, FH);
  const img = fg.createImageData(FW, FH), px = new Uint32Array(img.data.buffer), F = new Float32Array(FW * FH), G = new Float32Array(FW * FH);   // G: the flush, carried by the field
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---- colour: one flat tone and the pale it flushes to; three honeys the colour knob slides between
  const HONEYS = [
    [[244, 206, 104], [255, 250, 225]],   // acacia
    [[222, 146, 30], [255, 232, 160]],    // honey
    [[120, 62, 16], [226, 150, 72]],      // treacle
  ];
  const BODY = [0, 0, 0], PALE = [0, 0, 0];
  let lutAt = -1, threadCol = '#ecb036', paleRGB = '255,236,170';
  function buildLut(c) {
    const q = Math.round(c * 32) / 32; if (q === lutAt) return; lutAt = q;
    const f = q * 2, a = Math.min(1, Math.floor(f)), t = f - a;
    const at = (k, j) => mix(HONEYS[a][k][j], HONEYS[a + 1][k][j], t);
    for (let j = 0; j < 3; j++) { BODY[j] = at(0, j) | 0; PALE[j] = at(1, j) | 0; }
    threadCol = `rgb(${BODY})`; paleRGB = `${PALE}`;
  }

  // ---- state
  let nodes = [], links = [], time = 0, lastBud = -9, vels = null, pLo = 30, pHi = 96, seeded = false, lvl = 0.5, lvlT = 0;
  let bx0 = FW, bx1 = 0, by0 = FH, by1 = 0, lay = null, lg = null;

  // A metaball with a wide soft kernel, so outlines stay smooth: at distance R it reaches CUT.
  function disc(cx, cy, R, gl = 0, A = 0.54) {
    const fx = cx * FS, fy = cy * FS, W = R * FS * 1.6, iw = 1 / (W * W);
    let y0 = Math.ceil(fy - W), y1 = Math.floor(fy + W), a = Math.ceil(fx - W), b = Math.floor(fx + W);
    if (y0 < 1) y0 = 1; if (y1 > FHm - 1) y1 = FHm - 1; if (a < 1) a = 1; if (b > FWm - 1) b = FWm - 1;
    if (y0 > y1 || a > b) return;
    if (y0 < by0) by0 = y0; if (y1 > by1) by1 = y1; if (a < bx0) bx0 = a; if (b > bx1) bx1 = b;
    for (let y = y0; y <= y1; y++) {
      const dy = y - fy, dy2 = dy * dy, base = y * FW;
      for (let i = a; i <= b; i++) { const d = i - fx, q = 1 - (d * d + dy2) * iw; if (q > 0) { const z = A * q * q; F[base + i] += z; if (gl > 0) G[base + i] += z * gl; } }
    }
  }

  // ---- notes to places
  const quantile = (v) => {
    if (!vels) {
      const N = window.NOTES || []; vels = N.map((n) => n[3]).sort((p, q) => p - q);
      const ms = N.map((n) => n[2]).sort((p, q) => p - q);
      if (ms.length > 20) { pLo = ms[Math.floor(ms.length * 0.03)]; pHi = Math.max(pLo + 12, ms[Math.floor(ms.length * 0.97)]); }
    }
    if (!vels.length) return 1;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length;
  };
  const noteX = (m, x) => clamp(LW * (0.06 + 0.88 * clamp((m - pLo) / (pHi - pLo), 0, 1)) + x.rnd(-9, 9), 8, LW - 8);

  function mkNode(xx, yy, vol, x) {
    const lobes = [{ a: 0, d: 0, r: 0.86, w: 0.12, p: 0, s: 0 }, { a: 1.57 + x.rnd(-0.5, 0.5), d: x.rnd(0.45, 0.7), r: x.rnd(0.5, 0.7), w: 1, p: x.rnd(0, 6.28), s: x.rnd(0.1, 0.22) }];
    const more = 1 + Math.floor(x.rnd(0, 1.99));
    for (let i = 0; i < more; i++) { const a = x.rnd(0, 6.28); lobes.push({ a, d: x.rnd(0.4, 0.75), r: x.rnd(0.35, 0.62), w: Math.max(0, Math.sin(a)), p: x.rnd(0, 6.28), s: x.rnd(0.08, 0.2) }); }
    return { x: xx, y: yy, vol, swell: 0, sq: 0, sqT: 0, hang: 0, hangT: 0, melt: null, rate: 0, deg: 0, glow: 0, gl: 0, droop: 0.3, lobes, travel: false, tx: xx, ty: yy, from: null, dead: false, R: 0 };
  }
  function mkLink(a, b, V, rootA, rootB, x) {
    return { a, b, V, rootA, rootB, sag: 0, belly: 0, beads: [], dip: 0, dipT: 0, grow: 1, bow: x.rnd(0.09, 0.17) * (x.rnd(0, 1) < 0.5 ? -1 : 1), hair: 0, broken: false, ca: 1, cb: 0, glow: 0, sway: x.rnd(0, 6.28), swayS: x.rnd(0.18, 0.4),
      n: 0, X: new Float32Array(MAX_S + 1), Y: new Float32Array(MAX_S + 1), W: new Float32Array(MAX_S + 1), tLow: 0.5, L: 0, hs: 0 };
  }
  // The emptiest of a few places near the note, so the picture spreads over the canvas.
  function emptyPlace(nx, y0, y1, x, spread = 85) {
    let best = null, bs = -1e9;
    for (let i = 0; i < 7; i++) {
      const cx = clamp(nx + x.rnd(-spread, spread), 16, LW - 16), cy = x.rnd(y0, y1);
      let d = 1e9; for (const o of nodes) d = Math.min(d, Math.hypot(o.tx - cx, o.ty - cy) - o.R);
      const s = Math.min(d, 90) - Math.abs(cx - nx) * 0.25;
      if (s > bs) { bs = s; best = [cx, cy]; }
    }
    return best;
  }
  function seed(x, pres) {
    seeded = true;
    const n = 3 + Math.round(3 * pres);
    for (let i = 0; i < n; i++) {
      const [cx, cy] = emptyPlace(LW * ((i + 0.5) / n), LH * 0.08, LH * 0.8, x);
      const sz = x.rnd(0, 1), o = mkNode(cx, cy, 25 + sz * sz * 420, x); o.R = Math.sqrt(o.vol);
      let near = null, nd = 1e9; for (const p of nodes) { const d = Math.hypot(p.x - cx, p.y - cy); if (d < nd) { nd = d; near = p; } }
      nodes.push(o);
      if (near && nd < LW * 0.42 && (i < 2 || x.rnd(0, 1) < 0.55)) { const l = mkLink(near, o, x.rnd(25, 90), 2.5, 2.5, x); l.sag = nd * 0.12; links.push(l); }
    }
  }
  // A mass pushes out a bud that crawls to an empty place.
  function bud(p, nx, w, fat, x) {
    const v0 = (5 + 46 * w) * fat * fat, r0 = 1 + Math.sqrt(v0) * 0.26;
    const [tx, ty] = emptyPlace(nx, p.y + 34, p.y + 60 + 60 * Math.min(1, fat), x);
    const c = mkNode(p.x + x.rnd(-3, 3), p.y + p.R * 0.45, v0 * 0.1, x);
    c.swell = v0 * 0.9; c.travel = true; c.tx = tx; c.ty = ty; c.from = p; c.R = Math.sqrt(c.vol);
    p.bud = c; { const give = Math.min(v0 * 0.3, p.vol * 0.2); p.vol -= give; c.swell += give; }
    nodes.push(c);
    links.push(mkLink(p, c, r0 * r0 * 12, 3 + Math.sqrt(v0) * 0.55, 1 + Math.sqrt(v0) * 0.3, x));
    lastBud = time;
  }
  // Where nothing hangs, a mass grows out of nothing, slowly, and spins a hair towards its nearest neighbour.
  function grow(nx, y0, y1, w, fat, spread, x) {
    const [tx, ty] = emptyPlace(nx, y0, y1, x, spread), c = mkNode(tx, ty, 6, x);
    c.swell = 30 + (5 + 46 * w) * fat * fat * 1.2; c.R = Math.sqrt(c.vol); c.glow = 0.5;
    let o = null, od = 160; for (const p of nodes) { const d = Math.hypot(p.x - tx, p.y - ty); if (d < od) { od = d; o = p; } }
    nodes.push(c);
    if (o && links.length < MAX_LINKS) { const l = mkLink(c, o, 36, 1.6, 1.6, x); l.grow = 0; links.push(l); }
    lastBud = time;
  }
  // A note's weight: the low part of the mass sinks to a new depth (see frame), some of it for good, and the mass flushes.
  // The flush is less, and shorter, on a mass already being struck fast, so each attack in a run still shows.
  function weigh(n, drop, T) {
    n.rate += 1;
    n.sqT = Math.min(Math.min(10, n.R * 0.7 + 1), n.sqT + drop * 0.5);
    n.hangT = Math.min(n.R * 0.5, n.hangT + drop * 0.5);
    n.glow = Math.max(n.glow, T / (1 + 0.05 * n.rate));
  }
  function snap(l, x) { if (l.broken) return; l.broken = true; const c = x.rnd(0.35, 0.65); l.ca = c - 0.03; l.cb = c + 0.03; }
  function melt(d, k) { d.melt = k; d.travel = false; d.from = null; weigh(k, 2, 0.5); }   // over seconds, so nothing vanishes and no thread jumps
  function absorb(k, d, x) {                 // d melts into k; its threads now hang from k
    k.swell += d.vol + d.swell;
    for (const l of links) { if (l.a === d) l.a = k; if (l.b === d) l.b = k; if (l.a === k && l.b === k) { k.swell += l.V * 0.3; l.dead = true; } }
    if (k.from === d) k.from = null;
    d.dead = true;
  }

  // ---- the knob pictures
  const HC = '#d8982a', PC = '#ecb036';
  const pair = (g, x1, y1, r1, x2, y2, r2, sag, lw = 1) => {
    g.strokeStyle = PC; g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag * 2, x2, y2); g.stroke();
    ICON.dot(g, x1, y1, r1, HC); if (r2 > 0) ICON.dot(g, x2, y2, r2, HC);
  };
  TOOLS.push({
    id: 'honey', name: 'Honey', tag: 'new',
    blurb: 'Flat heavy shapes hang at different heights, tied by threads that sag and will not let go. A note makes a shape sink under the weight, and it stays low; then it fills, and slowly pushes out another.',
    params: [
      { key: 'thick', label: 'how thick it is', min: 0, max: 1, value: 0.5,
        hint: 'How stiffly it all moves. Left: runny and quick. Right: nearly solid, it barely moves.',
        icon: (g, v, w, h) => pair(g, w / 2, 6, 4, w / 2, 8 + (1 - v) * (h - 13), 3, 0) },
      { key: 'load', label: 'how much each note adds', min: 0.25, max: 2.2, value: 1, less: 0.25,
        hint: 'How heavy a note is. Left: small shapes, thin threads. Right: great heavy shapes.',
        icon: (g, v, w, h) => pair(g, 8, 8, 3, w - 12, h - 10, 1.5 + v * 6, 2) },
      { key: 'stretch', label: 'how far a thread stretches', min: 0, max: 1, value: 0.7, less: 0.2,
        hint: 'How far a thread stretches before it breaks. Left: it snaps early. Right: it never lets go.',
        icon: (g, v, w, h) => { if (v > 0.5) pair(g, 8, 8, 3, w - 8, 8, 3, 3 + (v - 0.5) * 12); else { ICON.dot(g, 8, 8, 3, HC); ICON.dot(g, w - 8, 8, 3, HC); ICON.line(g, 8, 8, 16 - v * 4, 13, PC, 1); ICON.line(g, w - 8, 8, w - 16 + v * 4, 13, PC, 1); } } },
      { key: 'busy', label: 'how many notes push out a new shape', min: 0, max: 1, value: 0.5, less: 0,
        hint: 'How many notes push out a new shape. Left: only the big ones. Right: nearly every note.',
        icon: (g, v, w, h) => { const n = 1 + Math.round(v * 4); ICON.dot(g, w / 2, 5, 3.5, HC); for (let i = 0; i < n; i++) pair(g, w / 2, 5, 0, ((i + 0.5) / n) * w, 14 + ((i * 7) % 3) * 3, 2, 1); } },
      { key: 'colour', label: 'how dark the honey is', min: 0, max: 1, value: 0.5,
        hint: 'How dark the honey is. Left: pale, light acacia. Right: dark treacle.',
        icon: (g, v, w, h) => ICON.dot(g, w / 2, h / 2, 8, ICON.lerp(v < 0.5 ? '#f6dd80' : '#d68e1a', v < 0.5 ? '#d68e1a' : '#34160a', v < 0.5 ? v * 2 : v * 2 - 1)) },
      { key: 'howmuch', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much honey there is: how readily notes push out a new shape, how heavy each one is, how far the threads stretch. Left: shapes come rarely and stay small, and their threads snap early. Right: the full web of heavy shapes and long sagging threads. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
      { key: 'presence', label: 'old: how faint', old: true, min: 0, max: 1, value: 1,
        hint: 'How much of it you see. Left: almost nothing, a few faint small shapes that only the hardest attacks disturb. Right: fully there.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => pair(g, 10, 8, 2 + v * 3, w - 10, h - 8, 2 + v * 4, 2)) },
    ],
    reset() { nodes = []; links = []; time = 0; lastBud = -9; vels = null; seeded = false; lvl = 0.5; lvlT = 0; },
    onChord(ch, x) {
      const pres = x.p('presence'); if (pres < 0.005) return;       // gone: nothing piles up behind the knob
      const load = x.p('load'), busy = x.p('busy');
      if (!seeded) seed(x, pres);
      const q = quantile(ch.vel), hardCut = (1 - pres) * 0.95;
      const attackK = pres >= 0.999 ? 1 : pres * sstep(hardCut - 0.25, hardCut, q);
      const matK = (0.1 + 0.9 * pres) * sstep(hardCut - 0.4, hardCut, q + 0.001);
      const cut = Math.max((1 - busy) * 0.9, hardCut), cap = Math.round(3 + (MAX_NODES - 3) * pres);
      let started = 0;
      for (const n of ch.notes) {
        const nx = noteX(n.m, x), w = Math.pow(n.v / 105, 1.6) * load, pitch = clamp((n.m - 30) / 66, 0, 1), fat = 1.45 - 0.95 * pitch;
        // In the same frame: the nearest mass begins to drop under the weight and flushes, its threads flush and dip with it.
        // The flush answers to how loud the note is, and to how loud it is against the last few seconds.
        lvl += (w - lvl) * Math.max(0.02, 1 - Math.exp(-(time - lvlT) / 3)); lvlT = time;
        const T = (0.3 + 0.6 * Math.min(1, 0.5 * w + 0.5 * w / Math.max(lvl, 0.2))) * attackK;
        let near = null, nd = 1e9, count = 0, upper = 0, moving = 0, left = 0;
        for (const o of nodes) {
          if (o.melt) continue;
          count++; if (o.y < LH * 0.34) upper++; if (o.travel) moving++; if (o.x < LW / 2) left++;
          const d = Math.abs(o.x - nx) + Math.abs(o.y - LH * 0.45) * 0.12; if (d < nd) { nd = d; near = o; }
        }
        if (near) {
          near.swell += w * fat * fat * 7 * matK;
          weigh(near, (2 + 6 * w * fat) * attackK, T);
          for (const l of links) {
            if (l.broken) continue;
            const at = l.a === near ? 1 : l.b === near ? -1 : 0;
            if (at) {
              l.dipT = Math.min(7, l.dipT + (1 + 2.5 * w) * attackK); l.V = Math.min(260, l.V + w * fat * 2.5 * matK);
              l.glow = Math.max(l.glow, T / (1 + 0.05 * near.rate));
            } else if (Math.abs((l.a.x + l.b.x) / 2 - nx) < 46) l.dipT = Math.min(7, l.dipT + (0.5 + 1.2 * w) * attackK);
          }
        }
        // A mass with no thread, once struck, spins a hair to its nearest neighbour; it will not stay alone.
        if (near && attackK > 0.1 && links.length < MAX_LINKS && !links.some((l) => !l.broken && (l.a === near || l.b === near))) {
          let o = null, od = LW * 0.28;
          for (const c of nodes) { if (c === near || c.dead || c.melt) continue; const d = Math.hypot(c.x - near.x, c.y - near.y); if (d < od) { od = d; o = c; } }
          if (o) { const l = mkLink(near, o, 36, 1.6, 1.6, x); l.grow = 0; links.push(l); }
        }
        // High notes: a bead sets off down the nearest thread that hangs.
        if (n.m >= 74 && attackK > 0.1) {
          let best = null, bd = 90;
          for (const l of links) { if (l.broken || l.grow < 1 || l.beads.length > 2 || l.n < 2) continue; const d = Math.abs(l.X[l.n >> 1] / l.SX - nx); if (d < bd) { bd = d; best = l; } }
          if (best) { const from = best.tLow > 0.5 ? 0 : 1; best.beads.push({ t: from, end: from, r: 0.9 + 1.5 * clamp(w, 0, 1.5) * attackK }); if (quantile(n.v) < 0.75) continue; }
        }
        // Weight enough, and it pushes out a bud; a mass already budding gets fatter instead.
        const far = !near || nd > 75 + near.R * 0.5, lop = count > 0 && (left === 0 || left === count);       // nothing near this note; half the canvas empty
        const waited = time - lastBud > (count < 5 || far || lop ? 3 : 7) * (1.6 - busy) && q >= hardCut;     // a passage quiet for this song still grows, slowly
        if ((quantile(n.v) < cut && !waited) || started >= 2) continue;
        if (!far && !lop && near.bud && near.bud.travel && !near.bud.dead) { near.bud.swell += (2 + 18 * w) * fat * fat * matK; continue; }
        if (time - lastBud < (ch.notes.length > 1 ? 0.5 : 1.1) * (1.5 - busy) || moving >= 4 || links.length >= MAX_LINKS + 6) continue;
        if (count > cap) continue;
        if (lop) grow(left === 0 ? LW * 0.25 : LW * 0.75, LH * 0.1, LH * 0.65, w, fat, 60, x);
        else if (far) grow(nx, LH * 0.1, LH * 0.65, w, fat, 30, x);
        else if (upper < 1 + Math.round(pres) && count > 1) grow(nx, LH * 0.06, LH * 0.3, w, fat, 85, x);
        else bud(near, nx, w, fat, x);
        started++;
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt, pres = x.p('presence');
      if (pres < 0.005) return;
      buildLut(x.p('colour'));
      if (!seeded) seed(x, pres);
      const stretch = x.p('stretch'), W = x.W, H = x.H, SX = W / LW, SY = H / LH;
      const tk = Math.pow(2, (0.5 - x.p('thick')) * 3.4) * (0.5 + 0.5 * pres);   // how quick everything is
      const RK = 0.4 + 0.6 * Math.pow(pres, 0.7), cap = Math.round(3 + (MAX_NODES - 3) * pres);
      time += dt;

      // ---- the masses
      if (dt > 0) {
        let lowest = null, count = 0;
        for (const n of nodes) { n.deg = 0; count++; if (!n.travel && (!lowest || n.y > lowest.y)) lowest = n; }
        for (const l of links) if (!l.broken) { l.a.deg++; l.b.deg++; }
        for (const n of nodes) {
          if (n.melt && n.melt.dead) n.melt = null;
          if (n.melt) {       // it runs into the mass it touches, and only once it is nearly gone do its threads pass over
            const k = n.melt, e = 1 - Math.exp(-dt * 1.2 * Math.sqrt(tk)), give = n.vol * e + n.swell;
            n.x += (k.x - n.x) * e; n.y += (k.y - n.y) * e; n.vol -= n.vol * e; n.swell = 0; k.swell += give;
            n.glow *= Math.exp(-dt * 2); n.sq *= 1 - e; n.sqT *= 1 - e; n.hang *= 1 - e; n.hangT *= 1 - e;
            if (n.vol < 5) absorb(k, n, x);
            continue;
          }
          if (n.swell > 0) { const k = n.swell * (1 - Math.exp(-dt * 1.3 * Math.sqrt(tk))); n.swell -= k; n.vol = Math.min(MAX_VOL, n.vol + k); }   // it fills, it does not pop
          n.vol -= n.vol * dt * 0.013;
          // No spring: half of a drop arrives in about a tenth of a second and relaxes over seconds, never quicker than about
          // 3 stage pixels a second. The other half oozes down over the next seconds, and passes into the mass as it creeps.
          n.sq += (n.sqT - n.sq) * (1 - Math.exp(-dt / 0.04));
          n.sqT -= Math.min(n.sqT * 0.35, 1.1) * Math.sqrt(tk) * dt;
          n.hang += (n.hangT - n.hang) * (1 - Math.exp(-dt * 0.8 * Math.sqrt(tk)));
          const creep = n.hang * (1 - Math.exp(-dt * 0.06 * tk)); n.hang -= creep; n.hangT -= creep; n.y += creep;
          n.glow *= Math.exp(-dt * (1.3 + 1.07 * n.rate)); n.rate *= Math.exp(-dt / 1.5);
          n.droop += (clamp(n.vol / 520, 0.12, 1) - n.droop) * dt * 0.3 * tk;
          if (n.travel) {
            const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy), p = n.from;
            const L = p ? Math.hypot(n.x - p.x, n.y - p.y) : 0;
            const v = ((3 + 0.03 * Math.min(300, n.vol)) * tk / (1 + L / 170)) * sstep(0, 14, d) + 0.12;     // slower the longer it stretches
            if (d > 1) { n.x += dx / d * v * dt; n.y += dy / d * v * dt; } else n.travel = false;
          } else n.y += (0.2 + 0.0022 * Math.min(800, n.vol)) * tk * (n === lowest && count > cap - 1 ? 3 : 1) * dt;   // the heavy ones sink; over the limit the lowest goes first
          if (n.from && Math.hypot(n.x - n.from.x, n.y - n.from.y) > n.R + n.from.R + 4) n.from = null;
          if (n.y - n.R > LH + 34 || n.vol < 5) n.dead = true;
        }
        // Close masses draw together and melt; a bud that nears one turns towards it.
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i]; if (a.dead || a.melt) continue;
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j]; if (b.dead || b.melt || a.from === b || b.from === a) continue;
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), big = Math.max(a.R, b.R), sum = a.R + b.R;
            if (d > sum + 24) continue;
            if (a.travel) { a.tx = b.x; a.ty = b.y; } if (b.travel) { b.tx = a.x; b.ty = a.y; }
            if (d < sum && d > 0.01) { const m = dt * 1.6 * tk * (1 - d / sum + 0.2) / d; a.x += dx * m; a.y += dy * m; b.x -= dx * m; b.y -= dy * m; }
            if (d < big * 0.8) { if (a.vol >= b.vol) melt(b, a); else { melt(a, b); break; } }
          }
        }
      }
      for (const n of nodes) n.R = Math.sqrt(Math.max(1, n.vol)) * RK;

      // ---- the threads
      F.fill(0); G.fill(0); px.fill(0); bx0 = FW; bx1 = 0; by0 = FH; by1 = 0;
      const pdt = dt > 0;
      for (const l of links) {
        if (l.dead) continue;
        const a = l.a, b = l.b, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, hs = Math.abs(dx) / L;
        l.L = L; l.hs = hs; l.SX = SX;
        if (pdt) {
          const sagT = L * (0.1 + 0.22 * hs) * Math.sqrt(hs) + Math.sqrt(l.belly) * 1.6 * hs;
          l.sag += (sagT - l.sag) * Math.min(1, dt * 0.22 * tk);
          // A note makes the belly dip once and recover slowly, as the masses do; no wave runs along a thread.
          l.dip += (l.dipT - l.dip) * (1 - Math.exp(-dt / 0.25)); l.dipT -= Math.min(l.dipT * 0.35, 1.1) * Math.sqrt(tk) * dt;
          l.glow *= Math.exp(-dt * (1.3 + 1.07 * Math.max(a.rate, b.rate)));
          if (l.grow < 1) l.grow = Math.min(1, l.grow + dt * 14 * tk / L);
          if (!l.broken) {
            l.V -= l.V * (1 - Math.exp(-dt * 0.018 * tk));
            const r = Math.sqrt(l.V / (L + 7));
            if (r < 0.42) l.hair += dt * tk; else l.hair = 0;
            // A thin hair does not last, and least of all one that hangs a lone mass: that is a tadpole, or a wire.
            const lone = (a.deg < 2 || b.deg < 2) && hs < 0.6 ? 0.45 : 1;
            const hairMax = stretch >= 0.995 ? 1e9 : mix(2, 62, stretch * stretch * stretch) * lone, Lmax = stretch >= 0.995 ? 1e9 : mix(26, 320, Math.pow(stretch, 1.5)) * (0.6 + 0.4 * hs);
            if (l.hair > hairMax || L > Lmax) snap(l, x);
            if (a.dead || b.dead) snap(l, x);
            const rt = (t) => r * 1.3 + 1.1 + Math.min(4.5, t * 0.4);
            l.rootA += (rt(a.R) - l.rootA) * Math.min(1, dt * 0.3 * tk); l.rootB += (rt(b.R) - l.rootB) * Math.min(1, dt * 0.3 * tk);
          } else {
            const back = dt * (8 + L * 0.12) * tk / L; l.ca -= back; l.cb += back;
            if ((l.ca <= 0.01 && l.cb >= 0.99)) l.dead = true;
          }
        }
        // The curve, its lowest point, and its width: fat at both ends, hair between, a belly where it hangs lowest.
        // A thread near the vertical cannot sag, so it leans to one side; nothing is ever a straight wire.
        const cy = (a.y + b.y) / 2 + l.sag * 2 + l.dip * 2 * Math.min(1, L / 70) / (1 + 0.4 * Math.sqrt(l.V / (L + 7))), cx = (a.x + b.x) / 2 + l.bow * L * (1 - hs), den = a.y - 2 * cy + b.y;
        const tl = Math.abs(den) > 1e-3 ? (a.y - cy) / den : 0.5; l.tLow = tl > 0.02 && tl < 0.98 ? tl : b.y > a.y ? 1 : 0;
        const r = Math.max(0.22, Math.sqrt(l.V / (L + 7))) * RK, n = Math.max(8, Math.min(MAX_S, Math.round(L / 4.5)));
        const funA = 5 + l.rootA * 1.6, funB = 5 + l.rootB * 1.6, ra = a.R * 0.8, rb = b.R * 0.8, ux = dx / L, uy = dy / L;
        const brR = Math.sqrt(l.belly) * RK, brW = brR * 1.7 + 3, sw = 2.2 * Math.min(1, L / 60);
        const bphase = time * l.swayS + l.sway;
        l.n = n;
        for (let i = 0; i <= n; i++) {
          const t = i / n, u = 1 - t, bell = Math.sin(t * Math.PI), off = bell * sw * Math.sin(bphase + t * 2.2);
          l.X[i] = (u * u * a.x + 2 * u * t * cx + t * t * b.x - uy * off) * SX;
          l.Y[i] = (u * u * a.y + 2 * u * t * cy + t * t * b.y + ux * off) * SY;
          const da = Math.max(0, t * L - ra), db = Math.max(0, u * L - rb), dB = (t - l.tLow) * L / brW;
          const wd = r + RK * (l.rootA * Math.exp(-da / funA) + l.rootB * Math.exp(-db / funB)), lim = Math.min(a.R * 0.8 + t * L * 0.5, b.R * 0.8 + u * L * 0.5);   // never wider than the body it leaves
          l.W[i] = (wd < lim ? wd : lim) + brR * Math.exp(-dB * dB);
        }
        if (pdt && !l.broken) {
          for (const c of l.beads) {
            const to = l.tLow, d = to - c.t, v = dt * (0.05 + c.r * c.r * 0.035) * tk * (0.5 + 60 / (L + 40));
            c.t += clamp(d, -v, v);
            if (Math.abs(d) <= v) { c.done = true; const s = to >= 1 ? b : to <= 0 ? a : null; if (s) s.swell += c.r * c.r * 3; else l.belly += c.r * c.r * 2.5; }
          }
          if (l.beads.length) l.beads = l.beads.filter((c) => !c.done);
          // A belly that has grown heavy becomes a mass of its own, hung from both ends.
          if (l.belly > 46 && l.grow >= 1 && links.length < MAX_LINKS && nodes.length < cap + 2) {
            const i = Math.round(l.tLow * n), m = mkNode(l.X[i] / SX, l.Y[i] / SY, l.belly, x);
            m.travel = true; m.tx = m.x + x.rnd(-6, 6); m.ty = m.y + x.rnd(12, 40); m.R = Math.sqrt(m.vol); nodes.push(m);
            const l2 = mkLink(m, b, l.V * 0.5, 2, l.rootB, x); l.V *= 0.5; l.b = m; l.rootB = 2; l.belly = 0; l2.sag = l.sag * 0.5; l.sag *= 0.5; l.beads.length = 0;
            l2.n = 0; links.push(l2);
          }
        }
      }
      if (pdt) {
        nodes = nodes.filter((n) => !n.dead); links = links.filter((l) => !l.dead);
      }

      // ---- the field: the masses, bellies and beads
      // Masses that touch are one body and flush as one, so no pale patch sits inside another mass.
      for (const n of nodes) n.gl = n.glow > 0.01 ? n.glow : 0;
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (a.gl !== b.gl && Math.hypot(a.x - b.x, a.y - b.y) < a.R + b.R) a.gl = b.gl = Math.max(a.gl, b.gl);
      }
      for (const n of nodes) {
        const R = n.R, sq = n.sq * RK, gl = n.gl;
        for (const l of n.lobes) {
          const an = l.a + 0.22 * Math.sin(time * l.s + l.p), d = l.d * R * (1 + 0.4 * n.droop * l.w), off = (R * 0.28 * n.droop + sq + n.hang) * l.w;
          const lx = n.x + Math.cos(an) * d, ly = n.y + Math.sin(an) * d + off, lr = l.r * R * (1 + 0.05 * Math.sin(time * l.s * 1.7 + l.p));
          disc(lx, ly, lr, gl);
          if (off > R * 0.15) disc((n.x + lx) / 2, (n.y + ly) / 2, lr * 0.72, gl);     // a part that sinks stays joined by a neck, it never comes off as a ball
        }
      }
      for (const l of links) {
        if (!l.n) continue;
        const lgl = Math.max(l.glow, l.a.gl, l.b.gl);       // what lies on a thread flushes with it, or it shows as a dark spot inside a body
        if (l.broken) for (const t of [l.ca, l.cb]) if (t > 0.02 && t < 0.98) { const i = Math.round(t * l.n); disc(l.X[i] / SX, l.Y[i] / SY, Math.max(1.1, l.W[i] * 0.9), lgl); }
        if (l.grow < 1) { const i = Math.max(1, Math.floor(l.grow * l.n)); disc(l.X[i] / SX, l.Y[i] / SY, Math.max(1.1, l.W[i] * 0.9), lgl); }
        if (l.belly > 1.5) { const i = Math.round(l.tLow * l.n), R = Math.sqrt(l.belly) * RK; if (R >= 1) disc(l.X[i] / SX, l.Y[i] / SY + R * 0.3, R, lgl); }
        for (const c of l.beads) { const i = Math.round(clamp(c.t, 0, 1) * l.n); disc(l.X[i] / SX, l.Y[i] / SY, Math.max(1, c.r * RK), lgl); }
      }

      // ---- cut at one level, with an edge true to the distance so it stays clean at any size. One flat tone; the flush is the
      // same all over a body, because it is the field's own share of each mass, so it never draws a disc inside another.
      const b0 = BODY[0], b1 = BODY[1], b2 = BODY[2], d0 = PALE[0] - b0, d1 = PALE[1] - b1, d2 = PALE[2] - b2, flat = (b2 << 16) | (b1 << 8) | b0;
      for (let y = by0; y <= by1; y++) {
        for (let xx = bx0, i = y * FW + bx0; xx <= bx1; xx++, i++) {
          const v = F[i]; if (v < 0.06) continue;
          let a = 255;
          if (v < 0.5) {
            const gx = F[i + 1] - F[i - 1], gy = F[i + FW] - F[i - FW], k = (v - CUT) / (Math.sqrt(gx * gx + gy * gy) * 0.5 + 1e-4) + 0.5;
            if (k <= 0) continue; if (k < 1) a = (k * 255) | 0;
          }
          const gv = G[i];
          if (gv > 0.002) { const m = 0.6 * gv / v; px[i] = (a << 24) | ((b2 + d2 * m) << 16) | ((b1 + d1 * m) << 8) | (b0 + d0 * m); }
          else px[i] = (a << 24) | flat;
        }
      }
      fg.putImageData(img, 0, 0);

      // ---- on the stage: threads under the bodies, in the same flat colour. For the 12% fade of the harness a steady
      // brightness s takes alpha 0.12 s / (1 - 0.88 s), so the knob's low end really is quiet.
      // Dimmed, threads and bodies are first joined on a layer, so where they overlap does not show through.
      const s = pres >= 0.999 ? 1 : Math.pow(pres, 0.75), alpha = 0.12 * s / (1 - 0.88 * s), dim = s < 1;
      if (dim && (!lay || lay.width !== W || lay.height !== H)) [lay, lg] = mk(W, H);
      const stage = g, c = dim ? lg : g;
      if (dim) c.clearRect(0, 0, W, H);
      c.save();
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = threadCol;
      c.beginPath();
      const side = (l, i0, i1, tip0, tip1) => {     // a tapered ribbon from sample i0 to i1 (all ribbons wound alike, so one fill unites them)
        const X = l.X, Y = l.Y, Wd = l.W, m = l.n;
        const off = (i, sgn) => {
          const p = Math.max(0, i - 1), q = Math.min(m, i + 1); let tx = X[q] - X[p], ty = Y[q] - Y[p]; const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
          const taper = (i === i0 && tip0) || (i === i1 && tip1) ? 0.25 : 1, w = Math.max(0.55, Wd[i] * SX) * taper * sgn;
          return [X[i] - ty * w, Y[i] + tx * w];
        };
        let P = off(i0, 1); c.moveTo(P[0], P[1]);
        for (let i = i0 + 1; i <= i1; i++) { P = off(i, 1); c.lineTo(P[0], P[1]); }
        for (let i = i1; i >= i0; i--) { P = off(i, -1); c.lineTo(P[0], P[1]); }
        c.closePath();
      };
      for (const l of links) {
        if (!l.n) continue;
        if (!l.broken) side(l, 0, l.grow < 1 ? Math.max(1, Math.floor(l.grow * l.n)) : l.n, false, l.grow < 1);
        else {
          const i0 = Math.floor(clamp(l.ca, 0, 1) * l.n), i1 = Math.ceil(clamp(l.cb, 0, 1) * l.n);
          if (i0 >= 1) side(l, 0, i0, false, true);
          if (i1 <= l.n - 1) side(l, i1, l.n, true, false);
        }
      }
      c.fill();
      // The threads of a struck mass flush with it, along their whole length.
      let glowing = false;
      for (const l of links) if (l.n && !l.broken && l.glow > 0.03) { glowing = true; break; }
      if (glowing) {
        c.fillStyle = `rgb(${paleRGB})`;
        for (const l of links) {
          if (!l.n || l.broken || l.glow <= 0.03) continue;
          c.globalAlpha = 0.6 * l.glow; c.beginPath(); side(l, 0, l.grow < 1 ? Math.max(1, Math.floor(l.grow * l.n)) : l.n, false, l.grow < 1); c.fill();
        }
      }
      c.globalAlpha = 1; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'medium';
      c.drawImage(fc, 0, 0, W, H);
      c.restore();
      if (dim) { stage.save(); stage.globalCompositeOperation = 'source-over'; stage.globalAlpha = alpha; stage.drawImage(lay, 0, 0); stage.restore(); }
    },
  });
})();
