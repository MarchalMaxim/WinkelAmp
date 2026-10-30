// Pointillism: every note throws a burst of coloured dots; dots settle into time-slice layers ("epochs") that
// dissolve into a soft blurred colour wash as they age, so harmony becomes colour regions. Hue is the note's
// distance from the detected home key around the circle of fifths: diatonic = warm, chromatic = cool.
(() => {
  // Settled dots live at CS of full resolution (they are soft dabs anyway), the wash at a quarter.
  const W = 1280, H = 720, K = 8, CS = 0.75, CW = W * CS, CH = H * CS, SW = 320, SH = 180, SC = SW / W;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const crisp = [], wash = [];
  for (let i = 0; i < K; i++) { crisp.push(mk(CW, CH)); wash.push(mk(SW, SH)); }
  const ep = Array.from({ length: K }, () => ({ born: -1e9, closed: -1e9, used: false }));
  const wc = mk(SW, SH), wcg = wc.getContext('2d'), wb = mk(SW, SH), wbg = wb.getContext('2d');
  let avgVel = 64, pulse = 0, cur = 0, time = 0, life = 6, fresh = [], heldAcc = new Map(), tonic = 0, hist = new Float32Array(12);
  // Dots are stamped from cached sprites (one per quantised colour): far cheaper than a path + colour parse each.
  const SPR = new Map(), DOT = 24;
  function sprite(h, s, l) {
    h = ((Math.round(h / 3) * 3) % 360 + 360) % 360; s = Math.round(s / 5) * 5; l = Math.round(l / 3) * 3;
    const k = h * 1e4 + s * 100 + l; let c = SPR.get(k);
    if (!c) {
      if (SPR.size > 3000) SPR.clear();
      c = mk(DOT, DOT); const cg = c.getContext('2d'); cg.fillStyle = `hsl(${h},${s}%,${l}%)`;
      cg.beginPath(); cg.arc(DOT / 2, DOT / 2, DOT / 2 - 1, 0, 6.283); cg.fill(); SPR.set(k, c);
    }
    return c;
  }
  const WHITE = mk(DOT, DOT); { const wg = WHITE.getContext('2d'); wg.fillStyle = '#fff'; wg.beginPath(); wg.arc(DOT / 2, DOT / 2, DOT / 2 - 1, 0, 6.283); wg.fill(); }
  const R = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  // Krumhansl-Kessler key profiles (major, minor), for the home key.
  const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  function key() {
    let best = -1e9, bt = tonic;
    for (let t = 0; t < 12; t++) for (const P of [MAJ, MIN]) {
      let s = 0; for (let i = 0; i < 12; i++) s += hist[(i + t) % 12] * P[i];
      if (t === tonic) s *= 1.08;                           // hysteresis: only move on a clear modulation
      if (s > best) { best = s; bt = t; }
    }
    tonic = bt;
  }
  const feed = (m, v, d, w = 1) => { hist[m % 12] += w * (v / 127) * Math.min(2, 0.25 + d); };
  // Steps round the circle of fifths from the home key: 0 tonic, +1 dominant, -1 subdominant, ±6 tritone.
  const fifths = (m) => { const i = (((m % 12) - tonic) * 7 % 12 + 12) % 12; return i > 6 ? i - 12 : i; };
  const hueOf = (m, x) => x.p('hue') + fifths(m) / 12 * 360 * x.p('range');
  // Layout 0 field (columns by fifths, rows by register), 1 keyboard (x by pitch), 2 wheel (angle by fifths,
  // radius by register). Fractional values blend neighbouring layouts.
  function place(m, v, L) {
    const f = fifths(m), reg = Math.max(0, Math.min(1, (m - 24) / 80));
    const pos = [
      [W / 2 + f / 6.5 * (W / 2 - 70), H - 70 - reg * (H - 140)],
      [70 + reg * (W - 140), H * 0.5 - (v - 70) / 60 * H * 0.22],
      [W / 2 + Math.cos(f / 12 * Math.PI * 2 - Math.PI / 2) * (70 + reg * 330), H / 2 + Math.sin(f / 12 * Math.PI * 2 - Math.PI / 2) * (70 + reg * 330) * 0.92],
    ];
    const a = Math.max(0, Math.min(2, L)), i = Math.min(1, Math.floor(a)), t = a - i;
    return [pos[i][0] + (pos[i + 1][0] - pos[i][0]) * t, pos[i][1] + (pos[i + 1][1] - pos[i][1]) * t];
  }
  function burst(m, v, d, n, x, opt = {}) {
    const [cx, cy] = place(m, v, x.p('layout'));
    const sp = x.p('spread') * (0.65 + 0.5 * Math.min(1, d / 2)) * (opt.wide ?? 1), size = x.p('dot') * (1.4 - 0.75 * x.pitch01(m)) * (opt.small ?? 1);
    const h = opt.hue ?? hueOf(m, x), sat = x.p('sat') * 100, lit = 30 + 30 * v / 127;
    for (let i = 0; i < n; i++) {
      let tx, ty;
      if (opt.ring) { const a = R(0, Math.PI * 2), r = sp * R(1.1, 1.9); tx = cx + Math.cos(a) * r; ty = cy + Math.sin(a) * r; }
      else { tx = cx + gauss() * sp; ty = cy + gauss() * sp * (x.p('layout') > 0.5 && x.p('layout') < 1.5 ? 1.8 : 1); }
      const k = opt.ring ? 0.85 : 0.5;  // dabbed in place, not fired from the centre (no firework rays)
      fresh.push({ sx: cx + (tx - cx) * k, sy: cy + (ty - cy) * k, tx, ty, r: size * R(0.6, 1.3), spr: sprite(h + R(-9, 9), sat, lit + R(-6, 6)),
        age: -R(0, opt.held ? 0 : 0.04), fly: R(0.08, 0.2) * (opt.held ? 0.7 : 1) });
    }
  }
  function commit(q) {
    const c = crisp[cur].getContext('2d'), w = wash[cur].getContext('2d'), r = Math.max(0.7, q.r * CS), rw = (q.r * 2.2 + 5) * SC;
    c.drawImage(q.spr, q.tx * CS - r, q.ty * CS - r, r * 2, r * 2);
    w.globalAlpha = 0.55; w.drawImage(q.spr, q.tx * SC - rw, q.ty * SC - rw, rw * 2, rw * 2);
  }
  const age01 = (e) => (e.used ? (time - e.closed) / life : 9);   // 0 = still open (or just closed), 1 = gone
  const crispA = (a, bleed) => (a >= 1 ? 0 : Math.pow(1 - Math.max(0, a), 1.3) * (1 - 0.75 * bleed * Math.min(1, Math.max(0, a) * 1.6)));
  const washA = (a, bleed) => (a >= 1 ? 0 : bleed * Math.min(1, 0.25 + Math.max(0, a) * 3) * Math.pow(1 - Math.max(0, a), 0.8));

  TOOLS.push({
    id: 'pointillism', name: 'Pointillism', tag: 'new',
    blurb: 'Every note dabs a burst of coloured dots (colour = how far the note is from the home key, burst size = how hard it is played); the dots settle and bleed into soft colour fields, so the harmony paints regions. Chords splash a halo of their opposite colour, and big ones make the whole canvas flinch.',
    params: [
      { key: 'dot', label: 'dot size', min: 1.5, max: 10, value: 4.5, drive: '-rate' },
      { key: 'burst', label: 'burst size', min: 0.2, max: 3, value: 1, drive: '+level' },
      { key: 'spread', label: 'spread', min: 8, max: 150, value: 30 },
      { key: 'fade', label: 'fade time (s)', min: 1, max: 25, value: 8, drive: '-rate' },
      { key: 'bleed', label: 'bleed', min: 0, max: 1, value: 0.55 },
      { key: 'sat', label: 'saturation', min: 0, max: 1, value: 0.72 },
      { key: 'hue', label: 'home-key hue', min: -180, max: 180, step: 1, value: 0 },
      { key: 'range', label: 'colour range', min: 0, max: 1, value: 0.42 },
      { key: 'comp', label: 'complement', min: 0, max: 1, value: 0.35 },
      { key: 'layout', label: 'layout field/keys/wheel', min: 0, max: 2, value: 0 },
    ],
    reset(x) {
      pulse = 0; avgVel = 64;
      for (let i = 0; i < K; i++) { crisp[i].getContext('2d').clearRect(0, 0, CW, CH); wash[i].getContext('2d').clearRect(0, 0, SW, SH); ep[i] = { born: -1e9, closed: -1e9, used: false }; }
      cur = 0; time = 0; fresh = []; heldAcc = new Map(); life = x.p('fade') ?? 7;
      ep[0] = { born: 0, closed: 0, used: true };
      // Prime the home key from the last half minute.
      hist.fill(0); for (const [s, e, m, v] of window.NOTES) { if (s > x.t) break; if (s > x.t - 30) feed(m, v, e - s); }
      if (hist.some((h) => h > 0)) key();
    },
    onChord(ch, x) {
      for (let i = 0; i < 12; i++) hist[i] *= 0.985;
      for (const n of ch.notes) feed(n.m, n.v, n.d);
      key();
      // 'Big' is relative to the recent average, so a thinner, quieter transcription (Beethoven) still lands its blows.
      const big = ch.notes.length >= 2 && ch.vel >= Math.max(80, Math.min(100, avgVel + 16)), sparse = 1 + 1.3 * (1 - x.feat.rate);  // sparse music: each note paints more
      avgVel += (ch.vel - avgVel) * 0.06;
      if (big) pulse = Math.min(1.5, pulse + 0.5 + Math.max(0, ch.vel - 85) / 30);
      const thin = 1 / Math.sqrt(Math.max(1, ch.notes.length / 2));  // fat chords: fewer dots per note, so the field doesn't clog
      for (const n of ch.notes) burst(n.m, n.v, n.d, Math.round(x.p('burst') * (4 + 20 * Math.pow(n.v / 127, 1.5)) * (big ? 1.5 : 1) * sparse * thin), x, { wide: (big ? 1.5 : 1) * (0.8 + 0.4 * sparse) });
      if (ch.notes.length >= 2 && x.p('comp') > 0) {
        // The chord's mean hue, turned 180°: a halo of the complement around the chord's loudest note.
        let cx = 0, cy = 0, lead = ch.notes[0]; for (const n of ch.notes) { const h = hueOf(n.m, x) * Math.PI / 180; cx += Math.cos(h); cy += Math.sin(h); if (n.v > lead.v) lead = n; }
        const hc = Math.atan2(cy, cx) * 180 / Math.PI + 180;
        burst(lead.m, lead.v * 0.75, lead.d, Math.round(x.p('comp') * x.p('burst') * ch.notes.length * 7), x, { hue: hc, ring: true, small: 0.7 });
      }
    },
    frame(x) {
      const g = x.g, bleed = x.p('bleed');
      time += x.dt; pulse *= Math.pow(0.5, x.dt / 0.12); life += (x.p('fade') - life) * (1 - Math.pow(0.5, x.dt / 1.5));
      // Held notes keep adding dots, gently.
      const now = x.sounding(), keep = new Map();
      for (const n of now) {
        if (x.t - n.start < 0.15) continue;
        const k = `${n.m}@${n.start}`, acc = (heldAcc.get(k) ?? 0) + x.dt * x.p('burst') * 7 * n.v / 127;
        const c = Math.floor(acc); if (c > 0) burst(n.m, n.v, n.end - n.start, c, x, { held: true });
        keep.set(k, acc - c);
      }
      heldAcc = keep;
      // Rotate epochs: close the current slice and recycle the oldest once it has faded out.
      const nx = (cur + 1) % K;
      if (time - ep[cur].born > life / (K - 1) && (!ep[nx].used || age01(ep[nx]) >= 1 || time - ep[cur].born > life)) {
        ep[cur].closed = time; cur = nx;
        crisp[cur].getContext('2d').clearRect(0, 0, CW, CH); wash[cur].getContext('2d').clearRect(0, 0, SW, SH);
        ep[cur] = { born: time, closed: time, used: true };
      }
      ep[cur].closed = time;
      // The wash: aged slices, blurred together at quarter resolution, laid under the dots.
      if (bleed > 0.01) {
        wcg.clearRect(0, 0, SW, SH);
        for (let i = 0; i < K; i++) { const a = washA(age01(ep[i]), bleed); if (a > 0.004) { wcg.globalAlpha = Math.min(1, a); wcg.drawImage(wash[i], 0, 0); } }
        wcg.globalAlpha = 1;
        wbg.clearRect(0, 0, SW, SH); wbg.filter = `blur(${(2 + bleed * 5).toFixed(1)}px)`; wbg.drawImage(wc, 0, 0); wbg.filter = 'none';
        g.globalAlpha = 0.5; g.imageSmoothingEnabled = true; g.drawImage(wb, 0, 0, W, H); g.globalAlpha = 1;
      }
      // The settled dots, oldest first, each slice drifting a touch outward as it ages.
      for (let j = 1; j <= K; j++) {
        const i = (cur + j) % K, a = age01(ep[i]), al = crispA(a, bleed); if (al < 0.01) continue;
        const s = 1 + Math.max(0, a) * life * 0.006 + pulse * 0.018 * (1 - Math.max(0, a));  // big chords make the whole field flinch
        g.globalAlpha = al; g.drawImage(crisp[i], W / 2 - W * s / 2, H / 2 - H * s / 2, W * s, H * s);
      }
      g.globalAlpha = 1;
      // Fresh dots in flight: they pop out of the note's spot, overshoot in size and brightness, then settle.
      const keepF = [];
      for (const q of fresh) {
        q.age += x.dt;
        if (q.age < 0) { keepF.push(q); continue; }
        const t = Math.min(1, q.age / q.fly);
        if (t >= 1) { commit(q); continue; }
        const e = 1 - Math.pow(1 - t, 3), r = q.r * (1 + 0.6 * (1 - t));
        q.px = q.sx + (q.tx - q.sx) * e; q.py = q.sy + (q.ty - q.sy) * e; q.pr = r; q.pt = t;
        g.drawImage(q.spr, q.px - r, q.py - r, r * 2, r * 2);
        keepF.push(q);
      }
      // ...with a white flash on top that dies as they land.
      g.globalCompositeOperation = 'lighter';
      for (const q of keepF) if (q.pt !== undefined && q.age >= 0) { g.globalAlpha = 0.45 * (1 - q.pt) * (1 - q.pt); g.drawImage(WHITE, q.px - q.pr, q.py - q.pr, q.pr * 2, q.pr * 2); }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      fresh = keepF.length > 2500 ? keepF.slice(-2500) : keepF;
    },
  });
})();
