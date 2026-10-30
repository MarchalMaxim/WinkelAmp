// Calligraphy: the melody written as one ink brush stroke per phrase (sumi-e).
// A brush is ~24 bristles plus a wet core. Bristles run out of ink and skip (dry brush), so a phrase
// starts wet and ends in streaks. Ink lives on a persistent layer that dries away on its own clock.
(() => {
  const W = 1280, H = 720, K = 24;
  const lay = document.createElement('canvas'); lay.width = W; lay.height = H; const lg = lay.getContext('2d');
  const R = (a, b) => a + Math.random() * (b - a);
  // paper grain, made once
  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  { const gg = grain.getContext('2d'), im = gg.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) { const l = Math.random() < 0.5 ? 0 : 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = l; im.data[i + 3] = Math.random() * 7; }
    gg.putImageData(im, 0, 0); }
  let grainPat = null;
  // palettes: paper (null = the black stage), melody ink, accent (slashes, enso)
  const PAL = [
    { paper: null, ink: [226, 216, 198], acc: [205, 52, 32] },          // 0 bone ink on black, vermilion accents
    { paper: [58, 54, 50], ink: [10, 9, 9], acc: [196, 46, 28] },       // 1 sumi on grey paper, vermilion accents
    { paper: [66, 11, 13], ink: [8, 4, 5], acc: [228, 210, 186] },      // 2 black on blood-red paper, bone accents
    { paper: null, ink: [196, 44, 28], acc: [232, 224, 208] },          // 3 vermilion ink on black, bone accents
  ];
  const pal = (x) => PAL[Math.max(0, Math.min(3, Math.round(x.p('palette'))))];
  const NIB = [Math.cos(-0.62), Math.sin(-0.62)];                     // a chisel held at ~35 degrees

  function mkBrush(x, y) {
    const bs = [];
    const gs = [R(0, 99), R(0, 99), R(0, 99), R(0, 99), R(0, 99), R(0, 99)];
    for (let i = 0; i < K; i++) bs.push({ o: (i / (K - 1)) * 2 - 1 + R(-0.05, 0.05), ink: 1 - R(0, 0.12), a: R(0.6, 1), px: x, py: y, dep: R(0.5, 1.6),
      seed: R(0, 99), gseed: gs[Math.floor(i / 4)], wl: R(25, 90), dist: 0 });
    return { x, y, dx: 1, dy: 0, bs, fresh: true };
  }
  function reload(br, amt) { for (const b of br.bs) b.ink = Math.min(1, b.ink + amt * R(0.6, 1.2)); }
  // Move a brush to (nx, ny) at width w, laying ink on the layer.
  function step(br, nx, ny, w, col, dry, nib) {
    const ddx = nx - br.x, ddy = ny - br.y, dist = Math.hypot(ddx, ddy);
    if (dist > 0.3) { br.dx = ddx / dist; br.dy = ddy / dist; }
    let ax = -br.dy, ay = br.dx;
    if (nib > 0) {
      let qx = NIB[0], qy = NIB[1]; if (ax * qx + ay * qy < 0) { qx = -qx; qy = -qy; }
      ax = ax * (1 - nib) + qx * nib; ay = ay * (1 - nib) + qy * nib; const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
    }
    const cross = Math.abs(ax * br.dy - ay * br.dx);
    let avg = 0; for (const b of br.bs) avg += b.ink; avg /= K;
    lg.strokeStyle = col; lg.lineCap = 'round';
    const coreW = w * (0.25 + 0.75 * cross) * (0.8 - 0.75 * dry) * Math.min(1, avg * 1.4);
    if (coreW > 0.6 && dist > 0.05 && !br.fresh) {
      // wet ink bleeds a soft halo into the paper
      if (dry < 0.45) { lg.shadowColor = col; lg.shadowBlur = coreW * 0.5 * (1 - dry / 0.45); }
      lg.globalAlpha = 0.82; lg.lineWidth = coreW; lg.beginPath(); lg.moveTo(br.x, br.y); lg.lineTo(nx, ny); lg.stroke();
      lg.shadowBlur = 0;
    }
    const bw = Math.max(0.7, (w / K) * 1.5);
    lg.lineWidth = bw;
    for (const b of br.bs) {
      const tx = nx + ax * b.o * w / 2, ty = ny + ay * b.o * w / 2;
      if (br.fresh) { b.px = tx; b.py = ty; continue; }          // touch down: no fan from the centre
      const seg = Math.hypot(tx - b.px, ty - b.py);
      b.ink = Math.max(0, b.ink - seg * dry * 0.0024 * b.dep); b.dist += seg;
      // dry brush: bristles (in clumps of four) skip where the paper is high, more as they run dry
      const nz = 0.55 * vnoise(b.seed + b.dist / b.wl) + 0.45 * vnoise(b.gseed + b.dist / 70);
      const th = dry * (0.25 + 0.9 * (1 - b.ink)), on = Math.max(0, Math.min(1, (nz - th) / 0.12 + 0.5));
      if (on > 0.02 && b.ink > 0.03 && seg > 0.05) {
        lg.globalAlpha = (0.3 + 0.65 * b.ink) * b.a * on;
        lg.beginPath(); lg.moveTo(b.px, b.py); lg.lineTo(tx, ty); lg.stroke();
      }
      b.px = tx; b.py = ty;
    }
    lg.globalAlpha = 1; br.x = nx; br.y = ny; if (dist > 0.3) br.fresh = false;
  }
  // smooth 1-D value noise in 0..1
  const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; }
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  let melTop = 60, lastMel = -9, mel = null, gest = [], mean = 66, fadeAcc = 0, lastGest = -9, lastEnso = -99, lastAttack = -9, clock = 0, row = 1, dots = [];

  function startPhrase(x, m, v) {
    let r; do r = Math.floor(R(0, 3)); while (r === row); row = r;
    const a = R(-0.2, 0.1), ox = R(0.05, 0.3) * W, oy = H * (0.24 + 0.26 * r) + R(-30, 30);
    const off = (m - mean) * x.p('reach');
    const ux = Math.cos(a), uy = Math.sin(a), nx = Math.sin(a), ny = -Math.cos(a);
    const px = ox + nx * off, py = oy + ny * off;
    mel = { br: mkBrush(px, py), ox, oy, ux, uy, nx, ny, s: 0, off, offT: off, since: 0, press: press(v), w: 2, hold: 0, col: rgb(pal(x).ink) };
  }
  const press = (v) => 0.3 + 0.7 * Math.pow(Math.min(1, v / 112), 1.3);
  function endPhrase(x) {
    if (!mel) return;
    const br = mel.br, w0 = mel.w, L = x.p('flick') * (50 + 130 * mel.press), P = [br.x, br.y], th0 = Math.atan2(br.dy, br.dx);
    const c = (br.dx >= 0 ? -1 : 1) * R(0.6, 1.4), col = mel.col;
    if (L > 4) gest.push({ br, t: 0, dur: 0.12 + 0.1 * Math.min(1, L / 200), col, dry: 0.75, f: (t) => {
      const e = t * t, th = th0 + c * e;
      return [P[0] + L * e * Math.cos(th), P[1] + L * e * Math.sin(th), w0 * Math.pow(1 - t, 1.4)];
    } });
    mel = null;
  }
  function slash(x, ch) {
    const P = pal(x), big = Math.min(1.3, ch.vel / 110), ang = (Math.random() < 0.5 ? 1 : -1) * R(0.3, 0.95);
    const L = R(320, 620) * big, cx = R(0.25, 0.75) * W, cy = R(0.25, 0.75) * H;
    const dx = Math.cos(ang), dy = Math.sin(ang), x0 = cx - dx * L / 2, y0 = cy - dy * L / 2, bow = R(-0.08, 0.08) * L;
    const Wd = R(36, 66) * big * x.p('width'), br = mkBrush(x0, y0), col = rgb(P.acc);
    gest.push({ br, t: 0, dur: R(0.13, 0.2), col, dry: Math.min(1, x.p('dry') + 0.45), f: (t) => {
      const e = 1 - Math.pow(1 - t, 3), b = Math.sin(Math.PI * e) * bow;
      return [x0 + dx * L * e - dy * b, y0 + dy * L * e + dx * b, Wd * Math.min(1, t / 0.07 + 0.75) * (1 - 0.93 * Math.pow(t, 1.5))];
    }, after: () => { if (ch.vel > 100) splash(x0 + dx * L, y0 + dy * L, dx, dy, big, col); } });
  }
  // ink flung off the end of a fast stroke
  function splash(px, py, dx, dy, big, col) {
    lg.fillStyle = col;
    for (let i = 0; i < 26; i++) {
      const a = Math.atan2(dy, dx) + R(-0.45, 0.45), d = R(8, 150) * big, r = R(0.8, 5.5) * Math.max(0.3, 1 - d / 170);
      lg.globalAlpha = R(0.6, 0.95); lg.beginPath();
      lg.ellipse(px + Math.cos(a) * d, py + Math.sin(a) * d, r * R(1, 2.4), r, a, 0, 7); lg.fill();
    }
    lg.globalAlpha = 1;
  }
  // a short pressed dab below the brush, lower notes further below
  function dot(x, m, v) {
    const b = mel.br, d = 40 + Math.min(160, (melTop - m) * 4), a = R(0.7, 1.2);
    const x0 = b.x + R(-30, 10), y0 = Math.min(H - 40, b.y + d), L = R(22, 44), Wd = 16 * x.p('width') * press(v), br = mkBrush(x0, y0), bend = R(-0.5, 0.5);
    // a teardrop: pressed in, then lifted to a point along a slight curve
    gest.push({ br, t: 0, dur: 0.12, col: mel.col, dry: x.p('dry') * 0.5, nib: 0, f: (t) => {
      const aa = a + bend * t;
      return [x0 + Math.cos(aa) * L * t, y0 + Math.sin(aa) * L * t, Wd * (t < 0.3 ? 0.55 + 1.5 * t : 1 - 1.2 * (t - 0.3))];
    } });
  }
  function enso(x, ch) {
    const P = pal(x), big = Math.min(1.3, ch.vel / 110);
    const cx = R(0.32, 0.68) * W, cy = R(0.38, 0.62) * H, Rr = Math.min(270, 120 + (ch.hi - ch.lo) * 3) * R(0.85, 1.1);
    const a0 = R(1.9, 2.6), sw = Math.PI * 2 * R(0.82, 0.94), Wd = R(30, 44) * big * x.p('width');
    const br = mkBrush(cx + Math.cos(a0) * Rr, cy + Math.sin(a0) * Rr);
    gest.push({ br, t: 0, dur: R(0.8, 1.05), col: rgb(P.acc), dry: Math.min(1, x.p('dry') + 0.45), f: (t) => {
      const e = t * t * (3 - 2 * t), a = a0 + sw * e, rr = Rr * (1 + 0.04 * Math.sin(e * 5));
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Wd * Math.min(1, 0.4 + t / 0.06) * (1 - 0.55 * t)];
    } });
  }

  TOOLS.push({
    id: 'brush', name: 'Calligraphy', tag: 'new',
    blurb: 'The melody written as ink brush strokes: one stroke per phrase, following the top notes, swelling on each attack, drying into streaks, pooling on held notes and flicking off at the phrase end. Big chords add a bold slash; long held ones an ensō circle.',
    params: [
      { key: 'width', label: 'stroke width', min: 0.3, max: 3, value: 1.1, drive: '+level' },
      { key: 'dry', label: 'dryness', min: 0, max: 1, value: 0.25, drive: '+rate' },
      { key: 'reach', label: 'pitch reach', min: 2, max: 24, value: 5, drive: '+level' },
      { key: 'smooth', label: 'smoothing', min: 0, max: 1, value: 0.55, drive: '+rate' },
      { key: 'span', label: 'travel speed', min: 30, max: 400, value: 130 },
      { key: 'nib', label: 'chisel nib', min: 0, max: 1, value: 0.35 },
      { key: 'flick', label: 'flick', min: 0, max: 2.5, value: 1 },
      { key: 'gesture', label: 'chord gestures', min: 0, max: 1, value: 0.5 },
      { key: 'fade', label: 'ink lasts (s)', min: 1, max: 30, value: 8 },
      { key: 'palette', label: 'palette', min: 0, max: 3, step: 1, value: 0 },
    ],
    reset() { lg.clearRect(0, 0, W, H); mel = null; gest = []; mean = 66; fadeAcc = 0; lastGest = -9; lastEnso = -99; lastAttack = -9; clock = 0; melTop = 60; lastMel = -9; },
    onChord(ch, x) {
      let top = ch.notes[0]; for (const n of ch.notes) if (n.m > top.m) top = n;
      const gap = clock - lastAttack; lastAttack = clock;
      if (!(mel && top.m < melTop - 9 && clock - lastMel < 0.9)) mean += (top.m - mean) * (mel ? 0.12 : 0.35);
      // an attack well below the line is accompaniment: an ink dot under the stroke, not a new pitch
      const accomp = mel && top.m < melTop - 9 && clock - lastMel < 0.9;
      if (accomp) { dot(x, top.m, top.v); mel.press = Math.max(mel.press * 0.8, press(top.v) * 0.7); }
      else { melTop = top.m; lastMel = clock; }
      if (!mel) startPhrase(x, top.m, top.v);
      else if (!accomp) {
        mel.offT = (top.m - mean) * x.p('reach'); mel.press = press(top.v); mel.since = 0; mel.hold = 0;
        reload(mel.br, 0.12 * top.v / 110);
      }
      // big chords: a slash, or an enso when the chord is held long (or comes out of silence)
      const thr = 106 - 40 * x.p('gesture'), maxD = Math.max(...ch.notes.map((n) => n.d)), nn = ch.notes.length;
      if (ch.vel >= thr && (nn >= 3 || (nn >= 2 && ch.vel >= thr + 6)) && clock - lastGest > 0.4) {
        lastGest = clock;
        if ((maxD > 1.4 || gap > 1.6) && clock - lastEnso > 6) { lastEnso = clock; enso(x, ch); } else slash(x, ch);
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt, P = pal(x); clock += dt;
      // the ink dries away (stepped so 8-bit alpha actually moves)
      fadeAcc += dt;
      if (fadeAcc > 0.25) {
        lg.globalCompositeOperation = 'destination-out'; lg.fillStyle = `rgba(0,0,0,${1 - Math.exp(-fadeAcc / x.p('fade'))})`;
        lg.fillRect(0, 0, W, H); lg.globalCompositeOperation = 'source-over'; fadeAcc = 0;
      }
      if (mel) {
        const m = mel; m.since += dt;
        const top = x.top();
        const speed = x.p('span') * (0.28 + 1.1 * Math.exp(-m.since / 0.3));
        m.s += speed * dt;
        const sm = x.p('smooth'), tau = 0.012 + 0.7 * sm * sm;
        m.off += (m.offT - m.off) * (1 - Math.exp(-dt / tau));
        let px = m.ox + m.ux * m.s + m.nx * m.off, py = m.oy + m.uy * m.s + m.ny * m.off;
        py = Math.max(28, Math.min(H - 28, py));
        // pressed down on each attack, lifting between; a fast brush draws thinner
        const wt = 32 * x.p('width') * m.press * (0.3 + 0.7 * Math.exp(-m.since / 0.6)) / (1 + speed / 450);
        m.w += (wt - m.w) * Math.min(1, dt / 0.05);
        step(m.br, px, py, m.w, m.col, x.p('dry'), x.p('nib'));
        // a held note: the slow brush lets ink pool
        if (top && m.since > 0.3) {
          m.hold += dt; const r = m.w * (0.4 + 0.18 * Math.min(2, m.hold));
          const gr = lg.createRadialGradient(px, py, 0, px, py, r);
          gr.addColorStop(0, m.col.replace(/[\d.]+\)$/, `${Math.min(0.12, 0.05 * dt * 60)})`)); gr.addColorStop(0.7, m.col.replace(/[\d.]+\)$/, `${Math.min(0.08, 0.03 * dt * 60)})`)); gr.addColorStop(1, m.col.replace(/[\d.]+\)$/, '0)'));
          lg.fillStyle = gr; lg.beginPath(); lg.arc(px, py, r, 0, 7); lg.fill();
        }
        if (m.since > (top ? 3 : 1.6) || px > W - 40 || px < 40) endPhrase(x);
      }
      for (const q of gest) {
        const t0 = q.t; q.t = Math.min(q.dur, q.t + dt);
        // sub-steps every ~6 px, so fast gestures stay curved and the bristles keep up
        const end = q.f(q.t / q.dur), ns = Math.max(1, Math.min(30, Math.ceil(Math.hypot(end[0] - q.br.x, end[1] - q.br.y) / 6)));
        for (let j = 1; j <= ns; j++) { const [sx, sy, sw] = q.f((t0 + (q.t - t0) * j / ns) / q.dur); step(q.br, sx, sy, Math.max(0.5, sw), q.col, q.dry, q.nib ?? x.p('nib')); }
        if (q.t >= q.dur) { q.done = true; q.after?.(); }
      }
      gest = gest.filter((q) => !q.done);

      if (P.paper) {
        g.globalCompositeOperation = 'lighten'; g.fillStyle = rgb(P.paper); g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
        grainPat ??= g.createPattern(grain, 'repeat'); g.fillStyle = grainPat; g.fillRect(0, 0, W, H);
      }
      g.drawImage(lay, 0, 0);
    },
  });
})();
