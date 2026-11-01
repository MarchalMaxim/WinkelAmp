// Calligraphy: the melody written as one ink brush stroke per phrase (sumi-e).
// A brush is ~24 bristles plus a wet core. Bristles run out of ink and skip (dry brush), so a phrase
// starts wet and ends in streaks. Ink lives on a persistent layer that dries away on its own clock.
// How present (a sixth knob, the user 2026-11-01: sliders should dim, not only boost): turned down, all the ink is fainter,
// the line thinner, slower and flatter, the red gestures thinner and rarer until none are left at the far left, and only the hardest attacks of this piece write.
// At 1 it changes nothing.
(() => {
  const W = 1280, H = 720, K = 24;
  const lay = document.createElement('canvas'); lay.width = W; lay.height = H; const lg = lay.getContext('2d');
  const R = (a, b) => a + Math.random() * (b - a);
  // v2 folds the old palette, smoothing, travel-speed, nib and flick knobs into fixed choices:
  // bone ink on the black stage with vermilion accents (the old palette 0).
  const P0 = { ink: [226, 216, 198], acc: [205, 52, 32] };
  const pal = () => P0;
  const SMOOTH = 0.6, SPAN = 130, NIB_K = 0.35, FLICK = 1;
  const NIB = [Math.cos(-0.62), Math.sin(-0.62)];                     // a chisel held at ~35 degrees
  // Loudness relative to this recording (its 90th-percentile chord velocity), so both songs reach the big gestures.
  let VQ = 0;
  const loud = (v) => {
    if (!VQ) { const v2 = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b); VQ = v2.length ? Math.max(70, v2[Math.floor(v2.length * 0.93)]) : 100; }
    return v * 100 / VQ;
  };
  // how present (0..1). calm(x, k): a multiplier that is exactly 1 at full presence and 1 - k at none.
  const calm = (x, k) => 1 - k * (1 - x.p('presence'));
  const sizeOf = (x) => x.p('size') * calm(x, 0.7), leapOf = (x) => x.p('leap') * calm(x, 0.8);
  // Which attacks write, judged against this piece's own notes (recordings differ a lot in how hard they are played):
  // every one at 1, the hardest 66% at 0.5, the hardest 5% at 0.
  let vels = null, sinceHit = 9;
  const hardEnough = (v, cut) => {
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= cut;
  };
  // icon ink
  const BONE = '#e2d8c6';

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
    const off = (m - mean) * leapOf(x);
    const ux = Math.cos(a), uy = Math.sin(a), nx = Math.sin(a), ny = -Math.cos(a);
    const px = ox + nx * off, py = oy + ny * off;
    mel = { br: mkBrush(px, py), ox, oy, ux, uy, nx, ny, s: 0, off, offT: off, since: 0, press: press(v), w: 2, hold: 0, col: rgb(pal(x).ink) };
  }
  const press = (v) => 0.3 + 0.7 * Math.pow(Math.min(1, v / 112), 1.3);
  function endPhrase(x) {
    if (!mel) return;
    const br = mel.br, w0 = mel.w, L = FLICK * (50 + 130 * mel.press) * calm(x, 0.7), P = [br.x, br.y], th0 = Math.atan2(br.dy, br.dx);
    const c = (br.dx >= 0 ? -1 : 1) * R(0.6, 1.4), col = mel.col;
    if (L > 4) gest.push({ br, t: 0, dur: 0.12 + 0.1 * Math.min(1, L / 200), col, dry: 0.75, f: (t) => {
      const e = t * t, th = th0 + c * e;
      return [P[0] + L * e * Math.cos(th), P[1] + L * e * Math.sin(th), w0 * Math.pow(1 - t, 1.4)];
    } });
    mel = null;
  }
  function slash(x, ch) {
    const P = pal(x), pres = x.p('presence'), big = Math.min(1.3, loud(ch.vel) / 110), ang = (Math.random() < 0.5 ? 1 : -1) * R(0.3, 0.95);
    const L = R(320, 620) * big, cx = R(0.25, 0.75) * W, cy = R(0.25, 0.75) * H;
    const dx = Math.cos(ang), dy = Math.sin(ang), x0 = cx - dx * L / 2, y0 = cy - dy * L / 2, bow = R(-0.08, 0.08) * L;
    const Wd = R(36, 66) * big * sizeOf(x), br = mkBrush(x0, y0), col = rgb(P.acc);
    gest.push({ br, t: 0, dur: R(0.13, 0.2), col, dry: Math.min(1, x.p('dryness') + 0.45), f: (t) => {
      const e = 1 - Math.pow(1 - t, 3), b = Math.sin(Math.PI * e) * bow;
      return [x0 + dx * L * e - dy * b, y0 + dy * L * e + dx * b, Wd * Math.min(1, t / 0.07 + 0.75) * (1 - 0.93 * Math.pow(t, 1.5))];
    }, after: () => { if (loud(ch.vel) > 100) splash(x0 + dx * L, y0 + dy * L, dx, dy, big, col, 26 * pres); } });
  }
  // ink flung off the end of a fast stroke
  function splash(px, py, dx, dy, big, col, drops) {
    lg.fillStyle = col;
    for (let i = 0; i < drops; i++) {
      const a = Math.atan2(dy, dx) + R(-0.45, 0.45), d = R(8, 150) * big, r = R(0.8, 5.5) * Math.max(0.3, 1 - d / 170);
      lg.globalAlpha = R(0.6, 0.95); lg.beginPath();
      lg.ellipse(px + Math.cos(a) * d, py + Math.sin(a) * d, r * R(1, 2.4), r, a, 0, 7); lg.fill();
    }
    lg.globalAlpha = 1;
  }
  // a short pressed dab below the brush, lower notes further below
  function dot(x, m, v) {
    const b = mel.br, d = 40 + Math.min(160, (melTop - m) * 4), a = R(0.7, 1.2);
    const x0 = b.x + R(-30, 10), y0 = Math.min(H - 40, b.y + d), L = R(22, 44), Wd = 16 * sizeOf(x) * press(v), br = mkBrush(x0, y0), bend = R(-0.5, 0.5);
    // a teardrop: pressed in, then lifted to a point along a slight curve
    gest.push({ br, t: 0, dur: 0.12, col: mel.col, dry: x.p('dryness') * 0.5, nib: 0, f: (t) => {
      const aa = a + bend * t;
      return [x0 + Math.cos(aa) * L * t, y0 + Math.sin(aa) * L * t, Wd * (t < 0.3 ? 0.55 + 1.5 * t : 1 - 1.2 * (t - 0.3))];
    } });
  }
  function enso(x, ch) {
    const P = pal(x), big = Math.min(1.3, loud(ch.vel) / 110);
    const cx = R(0.32, 0.68) * W, cy = R(0.38, 0.62) * H, Rr = Math.min(270, 120 + (ch.hi - ch.lo) * 3) * R(0.85, 1.1);
    const a0 = R(1.9, 2.6), sw = Math.PI * 2 * R(0.82, 0.94), Wd = R(30, 44) * big * sizeOf(x);
    const br = mkBrush(cx + Math.cos(a0) * Rr, cy + Math.sin(a0) * Rr);
    gest.push({ br, t: 0, dur: R(0.8, 1.05), col: rgb(P.acc), dry: Math.min(1, x.p('dryness') + 0.45), f: (t) => {
      const e = t * t * (3 - 2 * t), a = a0 + sw * e, rr = Rr * (1 + 0.04 * Math.sin(e * 5));
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Wd * Math.min(1, 0.4 + t / 0.06) * (1 - 0.55 * t)];
    } });
  }

  TOOLS.push({
    id: 'brush', name: 'Calligraphy', tag: 'v2',
    blurb: 'The melody written as ink brush strokes: one stroke per phrase, climbing and diving with the top notes, swelling on each attack, drying into streaks and flicking off at the phrase end. Low notes under the melody leave ink dabs; strong chords add a red slash, and after a pause a red ensō circle. The <b>how present</b> knob tones it right down.',
    params: [  // v2: 5 knobs, new keys so these defaults apply even where the old ones were saved; how present came later, as a sixth
      { key: 'size', label: 'brush size', min: 0.3, max: 3, value: 1.2, drive: '+level',
        hint: 'How thick the ink strokes are. Left: a fine pen line. Right: a fat, loaded brush.',
        icon: (g, v, w, h) => { g.strokeStyle = BONE; g.lineWidth = 1 + v * 9; g.beginPath(); g.moveTo(7, h * 0.66); g.quadraticCurveTo(w / 2, h * 0.18, w - 7, h * 0.5); g.stroke(); } },
      { key: 'dryness', label: 'dry brush', min: 0, max: 1, value: 0.3, drive: '+rate',
        hint: 'How much ink the brush holds. Left: wet, solid ink. Right: a dry brush that breaks into streaks.',
        icon: (g, v, w, h) => {
          const r = ICON.rng(4);
          for (let i = 0; i < 6; i++) {
            const y = 6 + i * 2.8; let on = true, x0 = 4;
            for (let x = 4; x <= w - 4; x += 2) {
              const want = r() > v * (0.15 + 0.85 * (x / w)) * 0.95;
              if (want !== on || x >= w - 5) { if (on) ICON.line(g, x0, y, x, y, BONE, 2.2); on = want; x0 = x; }
            }
          }
        } },
      { key: 'leap', label: 'how far it follows the notes', min: 2, max: 24, value: 5,
        hint: 'How far the stroke climbs and dives with the melody. Left: an almost level line. Right: a big leap for every note.',
        icon: (g, v, w, h) => ICON.wave(g, w, h, 0.08 + 0.85 * v, 1.5, BONE, 2.5) },
      { key: 'gestures', label: 'slashes on big chords', min: 0, max: 1, value: 0.5,
        hint: 'How often a strong chord adds a red slash (or, after a pause, a red ensō circle). Left: never, only the melody. Right: on most strong chords.',
        icon: (g, v, w, h) => {
          ICON.line(g, 4, h * 0.72, w - 4, h * 0.62, BONE, 2);
          const n = Math.round(v * 3);
          for (let i = 0; i < n; i++) ICON.line(g, 9 + i * 10, h - 4, 17 + i * 10, 4, ICON.red, 3.2);
        } },
      { key: 'stay', label: 'how long the ink stays', min: 1, max: 30, value: 8,
        hint: 'How long a stroke stays before it dries away. Left: gone in a second. Right: stays half a minute, the page fills up.',
        icon: (g, v, w, h) => {   // a stroke whose tail fades out: the longer the tail, the longer the ink stays
          const L = 4 + v * (w - 10), n = 14;
          for (let i = 0; i < n; i++) { const a = 1 - i / n; if (4 + (i / n) * (w - 8) > 4 + L) break; ICON.alpha(g, a, () => ICON.line(g, 4 + (i / n) * (w - 8), h / 2, 4 + ((i + 1) / n) * (w - 8), h / 2, BONE, 6)); }
          ICON.dot(g, 5, h / 2, 3.4, BONE);
        } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: a faint, thin, nearly level line that answers only the hardest notes and the odd soft one. Right: every note writes at full strength (as before).',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + 0.85 * v, () => {   // the same stroke fading out, its red slash thinning until none is left at the far left
          g.strokeStyle = BONE; g.lineWidth = 1 + 3 * v; g.beginPath(); g.moveTo(5, h * 0.62); g.quadraticCurveTo(w / 2, h * (0.5 - 0.3 * v), w - 5, h * 0.5); g.stroke();
          if (v > 0.03) ICON.line(g, w * 0.5, h - 4, w * 0.5 + 8, 4, ICON.red, 1 + 2 * v);
        }) },
    ],
    reset() { vels = null; sinceHit = 9; lg.clearRect(0, 0, W, H); mel = null; gest = []; mean = 66; fadeAcc = 0; lastGest = -9; lastEnso = -99; lastAttack = -9; clock = 0; melTop = 60; lastMel = -9; },
    onChord(ch, x) {
      let top = ch.notes[0]; for (const n of ch.notes) if (n.m > top.m) top = n;
      const gap = clock - lastAttack; lastAttack = clock;
      if (!(mel && top.m < melTop - 9 && clock - lastMel < 0.9)) mean += (top.m - mean) * (mel ? 0.12 : 0.35);
      // an attack well below the line is accompaniment: an ink dot under the stroke, not a new pitch
      const accomp = mel && top.m < melTop - 9 && clock - lastMel < 0.9;
      // how present: the line keeps listening to every attack, but only the hard ones write. A soft passage can hold nothing
      // hard enough for a minute or more, so after a while without one (6 s at the far left) the next attack writes anyway:
      // the page still follows the music and never looks switched off.
      const away = 1 - x.p('presence'), on = away <= 0 || hardEnough(top.v, Math.pow(away, 1.5) * 0.95) || sinceHit > 6 * away;
      if (on) sinceHit = 0;
      if (accomp) { if (on) { dot(x, top.m, top.v); mel.press = Math.max(mel.press * 0.8, press(top.v) * 0.7); } }
      else { melTop = top.m; lastMel = clock; }
      if (!mel) { if (on) startPhrase(x, top.m, top.v); }
      else if (!accomp && on) {
        mel.offT = (top.m - mean) * leapOf(x); mel.press = press(top.v); mel.since = 0; mel.hold = 0;
        reload(mel.br, 0.12 * top.v / 110);
      }
      // big chords: a slash, or an enso when the chord is held long (or comes out of silence)
      const gk = x.p('gestures') * x.p('presence'), vel = loud(ch.vel), thr = 106 - 40 * gk, maxD = Math.max(...ch.notes.map((n) => n.d)), nn = ch.notes.length;
      if (on && gk > 0.02 && vel >= thr && (nn >= 3 || (nn >= 2 && vel >= thr + 6)) && clock - lastGest > 0.4) {
        lastGest = clock;
        if ((maxD > 1.4 || gap > 1.6) && clock - lastEnso > 6) { lastEnso = clock; enso(x, ch); } else slash(x, ch);
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt; clock += dt; sinceHit += dt;
      // the ink dries away (stepped so 8-bit alpha actually moves)
      fadeAcc += dt;
      if (fadeAcc > 0.25) {
        lg.globalCompositeOperation = 'destination-out'; lg.fillStyle = `rgba(0,0,0,${1 - Math.exp(-fadeAcc / x.p('stay'))})`;
        lg.fillRect(0, 0, W, H); lg.globalCompositeOperation = 'source-over'; fadeAcc = 0;
      }
      if (mel) {
        const m = mel; m.since += dt;
        const top = x.top();
        const speed = SPAN * (0.28 + 1.1 * Math.exp(-m.since / 0.3)) * calm(x, 0.5);
        m.s += speed * dt;
        const sm = SMOOTH, tau = 0.012 + 0.7 * sm * sm;
        m.off += (m.offT - m.off) * (1 - Math.exp(-dt / tau));
        let px = m.ox + m.ux * m.s + m.nx * m.off, py = m.oy + m.uy * m.s + m.ny * m.off;
        py = Math.max(28, Math.min(H - 28, py));
        // pressed down on each attack, lifting between; a fast brush draws thinner
        const wt = 32 * sizeOf(x) * m.press * (0.3 + 0.7 * Math.exp(-m.since / 0.6)) / (1 + speed / 450);
        m.w += (wt - m.w) * Math.min(1, dt / 0.05);
        step(m.br, px, py, m.w, m.col, x.p('dryness'), NIB_K);
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
        for (let j = 1; j <= ns; j++) { const [sx, sy, sw] = q.f((t0 + (q.t - t0) * j / ns) / q.dur); step(q.br, sx, sy, Math.max(0.5, sw), q.col, q.dry, q.nib ?? NIB_K); }
        if (q.t >= q.dur) { q.done = true; q.after?.(); }
      }
      gest = gest.filter((q) => !q.done);

      // how present dims the whole page here, not stroke by stroke, so the slider answers at once, on ink already laid too
      g.globalAlpha = 1 - 0.94 * (1 - Math.pow(x.p('presence'), 1.3));
      g.drawImage(lay, 0, 0);
      g.globalAlpha = 1;
    },
  });
})();
