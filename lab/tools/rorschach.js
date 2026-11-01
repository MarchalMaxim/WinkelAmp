// Rorschach ink v2: the loved mirrored blots. Five knobs (the 2026-10-31 knob style); the other nine are fixed at the
// defaults the user loved (FIX below). Ink lives on a small persistent canvas (one "fundamental domain" next to the fold),
// bleeds and fades on its own clock, and is stamped out every frame as 2 (book), 4 (quad) or 2n (kaleidoscope) mirrored copies.
// v3 (the user, 2026-11-01: "very present even when fully toned down"): a sixth knob, how present. Turned down, the
// ink is fainter, the page barely heaves or shakes, and only the hardest bass attacks drop ink.
(() => {
  const IW = 320, IH = 360, PAD = 18, S = 2;               // ink canvas at 1/2 resolution, PAD = mirrored margin at the fold
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const [ink, ig] = mk(IW, IH), [tmp, tg] = mk(IW + PAD, IH), [rim, rg] = mk(IW + PAD, IH), [shn, sg] = mk(IW, IH), [paper, pg] = mk(IW, IH);
  const R = (a, b) => a + Math.random() * (b - a);
  // Paper: fixed speckle and horizontal fibres that the ink fails to fill (used as a destination-out mask).
  for (let i = 0; i < 2600; i++) { pg.fillStyle = `rgba(0,0,0,${R(0.15, 1)})`; pg.fillRect(R(0, IW), R(0, IH), R(0.6, 2), R(0.6, 1.6)); }
  pg.lineCap = 'round';
  for (let i = 0; i < 420; i++) {
    const x = R(-20, IW), y = R(0, IH), L = R(8, 70), a = R(-0.12, 0.12);
    pg.strokeStyle = `rgba(0,0,0,${R(0.2, 0.7)})`; pg.lineWidth = R(0.4, 1.3);
    pg.beginPath(); pg.moveTo(x, y); pg.quadraticCurveTo(x + L / 2, y + R(-3, 3), x + L * Math.cos(a), y + L * Math.sin(a)); pg.stroke();
  }
  // Ink pairs: [ink body, rim halo, wet sheen]. The colour knob blends continuously between neighbours.
  const PAL = [
    [[44, 3, 8], [175, 60, 44], [230, 120, 90]],       // 0 oxblood on black
    [[8, 10, 42], [205, 195, 172], [150, 160, 235]],   // 1 indigo, bone rim
    [[22, 16, 10], [228, 172, 60], [255, 215, 130]],   // 2 soot, gold rim
    [[3, 30, 27], [80, 188, 150], [150, 235, 205]],    // 3 verdigris
    [[42, 6, 44], [232, 92, 150], [255, 160, 200]],    // 4 violet, rose rim
    [[172, 162, 146], [245, 228, 205], [255, 250, 240]], // 5 bone ink (pale blots)
  ];
  const pal = (c) => { const i = Math.min(PAL.length - 2, Math.floor(c)), f = c - i; return PAL[i].map((col, k) => col.map((v, j) => Math.round(v + (PAL[i + 1][k][j] - v) * f)).join(',')); };
  let BODY = '44,3,8', RIMC = '175,60,44', SHEEN = '230,120,90';
  // The knobs that are no longer on the card, fixed at the defaults the user loved. Soak and feathering still follow the
  // music exactly as their old default drives did (base + half the old range × the feature).
  const FIX = { sizeBy: 0.5, split: 50, origin: 0.45, drift: 0.2, breathe: 0.7, rim: 1, paper: 0.25 };
  const soakOf = (x) => Math.max(0.2, Math.min(3, 1 + 1 * 0.5 * (3 - 0.2) * x.feat.rate));        // faster → soaks quicker
  // how present (0..1): which low notes drop ink, judged against this piece's own low notes (recordings differ a lot in
  // how hard their bass is): every one at 1, the hardest 40% at 0.4, the hardest 5% at 0
  let lowVels = null;
  const hardEnough = (v, x) => {
    if (!lowVels) lowVels = (window.NOTES || []).filter((n) => n[2] < FIX.split).map((n) => n[3]).sort((a, b) => a - b);
    const cut = (1 - x.p('presence')) * 0.95;
    if (cut <= 0 || !lowVels.length) return true;
    let a = 0, b = lowVels.length; while (a < b) { const k = (a + b) >> 1; if (lowVels[k] < v) a = k + 1; else b = k; }
    return a / lowVels.length >= cut;
  };
  const bleedOf = (x) => Math.max(0, Math.min(2.5, 0.8 + 1 * 0.5 * (2.5 - 0) * x.feat.density));  // fuller → feathers more
  let mode = 1, sinceBlot = 9, centres = [], lobes = [], creep = [], flecks = [], wet = [], fadeAcc = 0, bleedAcc = 0, shake = 0, pulse = 0, time = 0;

  // Where a blot is born, in ink coordinates, for the current symmetry (spread 0 = hugging the fold(s)).
  function spot(sp, wide) {
    const hug = wide ? () => R(0, 1) : () => Math.abs(R(-1, 1) * R(0, 1));
    if (mode === 1) return { x: hug() * IW * (0.1 + 0.62 * sp), y: IH * (0.5 + R(-1, 1) * (0.1 + 0.32 * sp)) };
    if (mode === 2) return { x: hug() * IW * (0.1 + 0.62 * sp), y: IH / 2 - hug() * IH * 0.5 * (0.12 + 0.75 * sp) };
    const y = IH * (0.08 + R(0, 1) * (0.22 + 0.62 * sp));      // kaleidoscope: y is the distance from the centre
    return { x: Math.min(IW, hug() * y * Math.tan(Math.PI / mode) * (0.3 + 0.7 * sp)), y };
  }
  // Keep a point (and its heading) inside the domain by reflecting it off the mirror lines.
  function fold(o) {
    if (o.x < 0) { o.x = -o.x; if (o.a !== undefined) o.a = Math.PI - o.a; }
    if (mode === 2 && o.y > IH / 2) { o.y = IH - o.y; if (o.a !== undefined) o.a = -o.a; }
    if (mode >= 3 && o.y < 0) { o.y = -o.y; if (o.a !== undefined) o.a = -o.a; }
    return o;
  }

  // Low notes: a blot of a few swelling lobes (ink soaking in) and creeping tendrils (feathering).
  function bloom(n, x) {
    const sb = FIX.sizeBy, soak = soakOf(x), feath = bleedOf(x);
    const byVel = 0.3 + n.v / 110, byPitch = 0.45 + Math.max(0, 62 - n.m) / 22;   // loud = big | low = big
    const big = x.p('size') * Math.pow(byVel, 2 * (1 - sb)) * Math.pow(byPitch, 2 * sb) * 0.75 * (mode === 1 ? 1 : mode === 2 ? 0.8 : 0.7) * (n.fallback ? 0.7 : 1);
    const longer = 0.75 + 0.35 * Math.min(2, n.d);                                // held notes soak for longer
    const c = spot(FIX.origin), lifeK = Math.pow(1 / soak, 0.7);
    const k = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < k; i++) {
      const a = R(0, Math.PI * 2), d = R(0, 26) * big;
      lobes.push(fold({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 1.3, r: 2, R: R(8, 24) * big, e: R(0.45, 1), rot: R(0, Math.PI), age: 0, life: R(1.4, 2.6) * longer * lifeK, k: R(2.5, 5) * soak }));
    }
    const tn = Math.round((6 + 16 * big) * feath);
    for (let i = 0; i < tn; i++) {
      const a = R(0, Math.PI * 2), d0 = R(8, 20) * big;
      creep.push(fold({ x: c.x + Math.cos(a) * d0, y: c.y + Math.sin(a) * d0, a, sp: R(22, 55) * big * Math.sqrt(soak), w: R(1, 2.8) * big, age: 0, life: R(1.0, 2.2) * longer * (0.6 + 0.4 * feath), fork: 1 }));
    }
    wet.push({ x: c.x, y: c.y, r: 30 * big, age: 0 });
    centres.push({ x: c.x, y: c.y, R: 26 * big }); if (centres.length > 6) centres.shift();
    pulse = Math.max(pulse, Math.min(1.5, big * n.v / 100)); sinceBlot = 0;
  }
  // Higher notes: flecks flung off the ink already on the page (higher = further out).
  function spatter(n, hard, amt) {
    let cnt = amt * (hard ? 2 : 1); cnt = Math.floor(cnt) + (Math.random() < cnt % 1 ? 1 : 0);
    for (let j = 0; j < cnt; j++) {
      const src = centres.length ? centres[Math.floor(Math.random() * centres.length)] : spot(0.3);
      const a = R(0, Math.PI * 2), d = (src.R || 20) * R(1.0, 1.6) + (n.m - 50) * 0.35 * (hard ? 2 : 1) * (0.6 + 0.4 * amt);
      const s = (0.4 + 1.5 * n.v / 110) * (hard ? R(1, 2) : 1);
      const k = Math.random() < 0.35 ? 3 : 1;                 // sometimes a little trail of droplets
      for (let i = 0; i < k; i++) {
        const dd = d + i * s * 3.5;
        flecks.push({ x: src.x + Math.cos(a) * dd, y: src.y + Math.sin(a) * dd, r: s * (1 - i * 0.25), vx: Math.cos(a) * s * 6, vy: Math.sin(a) * s * 6, age: 0 });
      }
    }
  }
  // The violent ones: a ragged core with streaks and spray.
  function burst(ch, amt, sp) {
    const c = spot(0.35 + 0.65 * sp, true), pow = Math.max(0, (ch.vel - 88) / 16) * (0.5 + 0.5 * amt);
    ig.save(); ig.lineCap = 'round';
    ig.fillStyle = `rgba(${BODY},0.95)`;
    for (let i = 0; i < 6; i++) { const p = fold({ x: c.x + R(-10, 10), y: c.y + R(-10, 10) }); ig.beginPath(); ig.ellipse(p.x, p.y, R(6, 16), R(4, 12), R(0, 3), 0, 7); ig.fill(); }
    const n = Math.round((5 + ch.notes.length) * (0.6 + 0.4 * amt));
    ig.strokeStyle = `rgba(${BODY},0.92)`;
    for (let i = 0; i < n; i++) {
      const p = { x: c.x, y: c.y, a: R(0, Math.PI * 2) };
      const L = R(18, 80) * (0.8 + pow * 0.6), w0 = R(2, 6), K = 6;
      for (let k = 1; k <= K; k++) {
        p.a += R(-0.25, 0.25);
        const px = p.x, py = p.y; p.x += Math.cos(p.a) * L / K; p.y += Math.sin(p.a) * L / K;
        ig.lineWidth = w0 * (1 - 0.8 * k / K) * R(0.7, 1.2); ig.beginPath(); ig.moveTo(px, py); ig.lineTo(p.x, p.y); ig.stroke();
      }
      if (Math.random() < 0.6) { const q = fold({ x: p.x + Math.cos(p.a) * R(4, 14), y: p.y + Math.sin(p.a) * R(4, 14) }); ig.fillStyle = `rgba(${BODY},0.95)`; ig.beginPath(); ig.arc(q.x, q.y, w0 * R(0.3, 0.8), 0, 7); ig.fill(); }
    }
    for (let i = 0; i < 26 * amt; i++) {
      const a = R(0, Math.PI * 2), d = R(14, 110) * (0.7 + pow * 0.5), q = fold({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d });
      ig.fillStyle = `rgba(${BODY},${R(0.6, 0.95)})`; ig.beginPath(); ig.arc(q.x, q.y, R(0.6, 2.6), 0, 7); ig.fill();
    }
    ig.restore();
    lobes.push({ x: c.x, y: c.y, r: 6, R: 22 + 14 * pow, age: 0, life: 1.0, k: 7 });
    wet.push({ x: c.x, y: c.y, r: 50 + 30 * pow, age: 0, hard: true });
    shake = Math.max(shake, 5 + 6 * pow); pulse = Math.max(pulse, 1.2);
  }

  // Draw fn (which paints in ink coordinates) once per mirrored copy, each clipped exactly at its mirror lines.
  function copies(g, W, H, rot, fn) {
    if (mode === 1) {
      for (const sx of [1, -1]) { g.save(); g.translate(W / 2, 0); g.scale(sx * S, S); g.beginPath(); g.rect(0, -40, IW + 60, IH + 80); g.clip(); fn(); g.restore(); }
    } else if (mode === 2) {
      for (const sx of [1, -1]) for (const sy of [1, -1]) {
        g.save(); g.translate(W / 2, sy > 0 ? 0 : H); g.scale(sx * S, sy * S);
        g.beginPath(); g.rect(0, -40, IW + 60, IH / 2 + 40); g.clip(); fn(); g.restore();
      }
    } else {
      const a = Math.PI / mode;
      for (let k = 0; k < 2 * mode; k++) {
        g.save(); g.translate(W / 2, H / 2); g.rotate(rot + 2 * a * (k % 2 ? (k + 1) / 2 : k / 2)); if (k % 2) g.scale(1, -1);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(900, 0); g.lineTo(Math.cos(a) * 900, Math.sin(a) * 900); g.closePath(); g.clip();
        g.transform(0, S, S, 0, 0, 0);                      // ink x = distance from the mirror ray, ink y = distance from centre
        fn(); g.restore();
      }
    }
  }
  // One layer (rim, ink or sheen): every copy is ADDED into a scratch canvas, so the anti-aliased clip edges of two
  // neighbouring copies sum to exactly one and the seams vanish; then the layer goes onto the stage in one draw.
  const [lay, lg] = mk(1280, 720);
  // The symmetry knob's picture: one small seeded blot, copied the way the widget copies its ink for m folds.
  function mirrorIcon(g, m, w, h) {
    const R = ICON.rng(4), blot = []; for (let i = 0; i < 4; i++) blot.push([R(), R(), 0.8 + R() * 1.3]);
    const draw = (x0, y0, sx, sy) => { for (const [a, b, r] of blot) ICON.dot(g, x0 + a * sx, y0 + b * sy, r, ICON.red); };
    g.save(); g.translate(w / 2, h / 2);
    if (m <= 2) {
      for (const sx of [1, -1]) for (const sy of m === 2 ? [1, -1] : [1]) {
        g.save(); g.scale(sx, sy); if (m === 1) draw(2, -6, 10, 12); else draw(2, 2, 11, 7); g.restore();
      }
      ICON.line(g, 0, -h / 2 + 2, 0, h / 2 - 2, ICON.dim, 0.6); if (m === 2) ICON.line(g, -w / 2 + 2, 0, w / 2 - 2, 0, ICON.dim, 0.6);
    } else {                               // kaleidoscope: a petal (dots shrinking outward) in each of the 2m mirrored wedges
      const a = Math.PI / m, petal = [[3.5, 0.35, 1.5], [6.5, 0.5, 1.3], [9.5, 0.4, 1], [11.8, 0.25, 0.7]];
      for (let k = 0; k < 2 * m; k++) {
        g.save(); g.rotate(-Math.PI / 2 + 2 * a * Math.floor((k + 1) / 2)); if (k % 2) g.scale(1, -1);
        for (const [r, f, s] of petal) ICON.dot(g, r, r * Math.tan(a) * f, s, ICON.red);
        g.restore();
      }
    }
    g.restore();
  }
  function layer(g, W, H, rot, sc, src, ox, alpha, op) {
    lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, W, H);
    lg.translate(W / 2, H / 2); lg.scale(sc, sc); lg.translate(-W / 2, -H / 2);
    copies(lg, W, H, rot, () => { lg.globalCompositeOperation = 'lighter'; lg.drawImage(src, ox, 0); });
    g.globalAlpha = alpha; g.globalCompositeOperation = op; g.drawImage(lay, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  TOOLS.push({
    id: 'rorschach', name: 'Rorschach ink', tag: 'v3',
    blurb: 'Low notes drop ink that soaks out into mirrored blots; higher notes fling specks; the loudest, fullest chords splatter. New in v3: a <b>how present</b> knob, to tone it right down: fainter ink, a still page, and only the hardest bass attacks drop ink.',
    // Six knobs: the five old ones (keys, ranges and drives unchanged, so saved settings still apply) and how present (v3);
    // the other nine are fixed in FIX above.
    params: [
      { key: 'sym', label: 'mirror pattern', min: 1, max: 8, step: 1, value: 1,
        hint: 'How the ink is mirrored. Left: one fold down the middle, like a folded page. Next: four-way. Right: a kaleidoscope star of up to 8 folds.',
        icon: (g, v, w, h) => mirrorIcon(g, Math.round(1 + v * 7), w, h) },
      { key: 'ink', label: 'ink colour', min: 0, max: 5, step: 0.01, value: 0,
        hint: 'The ink and the glow round its edge. Left: oxblood on black. Then indigo, soot with gold, green, violet with rose. Right: pale bone ink.',
        icon: (g, v, w, h) => {
          const [body, rimc] = pal(v * 5);
          for (const sx of [-1, 1]) { ICON.dot(g, w / 2 + sx * 8, h / 2, 8.5, `rgb(${rimc})`); ICON.dot(g, w / 2 + sx * 8, h / 2, 6, `rgb(${body})`); }
        } },
      { key: 'size', label: 'blot size', min: 0.3, max: 2.5, value: 1,
        hint: 'How far each drop of ink spreads. Left: small spots. Right: big blots.',
        icon: (g, v, w, h) => { const r = 1.5 + v * 7; for (const sx of [-1, 1]) ICON.dot(g, w / 2 + sx * (r + 1), h / 2, r, ICON.red); } },
      { key: 'spatter', label: 'spatter', min: 0, max: 3, value: 1, drive: '+level',
        hint: 'How much higher notes fling specks, and how readily loud full chords splatter. Left: clean blots, no spray. Right: lots of spray and splatters.',
        icon: (g, v, w, h) => {
          ICON.dot(g, w / 2, h / 2, 4, ICON.red); const R = ICON.rng(11);
          for (let i = 0; i < Math.round(v * 16); i++) { const a = R() * 6.283, d = 6 + R() * 11; ICON.dot(g, w / 2 + Math.cos(a) * d * 1.4, h / 2 + Math.sin(a) * d * 0.9, 0.7 + R() * 0.9, ICON.red); }
        } },
      { key: 'fade', label: 'how long the ink stays', min: 1, max: 13, value: 9, drive: '-level',
        hint: 'How long the ink takes to dry away. Left: blots vanish within a second or two. Right: they stay on the page for many seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.08 + v * 0.92, ICON.red, 'dot') },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: faint ink on a still page, and only the hardest bass attacks drop it. Right: every low note blooms at full strength (as before).',
        icon: (g, v, w, h) => { for (const sx of [-1, 1]) ICON.alpha(g, 0.15 + 0.85 * v, () => ICON.dot(g, w / 2 + sx * 7, h / 2, 2 + 5 * v, ICON.red)); } },
    ],
    reset() { lowVels = null; ig.clearRect(0, 0, IW, IH); centres = []; lobes = []; creep = []; flecks = []; wet = []; fadeAcc = 0; bleedAcc = 0; shake = 0; pulse = 0; sinceBlot = 9; },
    onChord(ch, x) {
      [BODY, RIMC, SHEEN] = pal(x.p('ink'));
      const amt = x.p('spatter'), split = FIX.split;
      const violent = amt > 0.05 && ch.vel >= 112 - 8 * amt && ch.notes.length >= 3;
      let lows = 0;
      for (const n of ch.notes) {
        if (n.m < split) { if (hardEnough(n.v, x) && lows++ < 2) bloom(n, x); }
        else spatter(n, violent, amt);
      }
      // a thin bass line (an orchestra heard by a piano transcriber): if no ink has dropped for a while, the chord's lowest note blooms
      if (!lows && sinceBlot > 1.2) { let low = ch.notes[0]; for (const n of ch.notes) if (n.m < low.m) low = n; if (hardEnough(low.v, x)) bloom({ ...low, fallback: true }, x); }
      if (violent) burst(ch, amt, FIX.origin);
    },
    frame(x) {
      const g = x.g, dt = x.dt; time += dt; sinceBlot += dt;
      const m = Math.round(x.p('sym'));
      if (m !== mode) { mode = m; ig.clearRect(0, 0, IW, IH); centres = []; lobes = []; creep = []; flecks = []; wet = []; }
      [BODY, RIMC, SHEEN] = pal(x.p('ink'));
      const soak = soakOf(x), feath = bleedOf(x), paperAmt = FIX.paper;
      // the ink slowly dries away (in steps so 8-bit alpha actually moves)
      fadeAcc += dt;
      if (fadeAcc > 0.4) {
        ig.globalCompositeOperation = 'destination-out';
        ig.fillStyle = `rgba(0,0,0,${1 - Math.exp(-fadeAcc / x.p('fade'))})`; ig.fillRect(0, 0, IW, IH);
        ig.globalCompositeOperation = 'source-over'; fadeAcc = 0;
      }
      // the paper is wet: everything soaks a little further out, drifts, and the paper's fibres show through
      bleedAcc += dt;
      if (bleedAcc > 1.1 / soak) {
        const dr = FIX.drift * 3 * bleedAcc * soak;
        bleedAcc = 0;
        tg.clearRect(0, 0, IW + PAD, IH); tg.drawImage(ink, PAD, 0);
        tg.save(); tg.translate(PAD, 0); tg.scale(-1, 1); tg.drawImage(ink, 0, 0, PAD, IH, 0, 0, PAD, IH); tg.restore();
        const dx = mode >= 3 ? 0 : dr, dy = mode === 2 ? -dr * 0.7 : mode >= 3 ? dr : 0;
        ig.clearRect(0, 0, IW, IH); ig.filter = `blur(${(0.2 + 0.45 * feath).toFixed(2)}px)`;
        ig.drawImage(tmp, PAD - dx, 0, IW, IH, 0, dy, IW, IH); ig.filter = 'none';
        if (paperAmt > 0.01) { ig.globalCompositeOperation = 'destination-out'; ig.globalAlpha = paperAmt * 0.35; ig.drawImage(paper, 0, 0); ig.globalAlpha = 1; ig.globalCompositeOperation = 'source-over'; }
      }
      // lobes swell and deposit ink: dense cores, thin edges
      const dep = Math.min(0.5, dt * 3.2 * Math.pow(soak, 0.7));
      for (const l of lobes) {
        l.age += dt; l.r += (l.R - l.r) * Math.min(1, dt * l.k);
        ig.fillStyle = `rgba(${BODY},${dep * Math.max(0, 1 - l.age / l.life)})`;
        ig.beginPath(); ig.ellipse(l.x, l.y, l.r, l.r * (l.e || 1), l.rot || 0, 0, 7); ig.fill();
        ig.beginPath(); ig.ellipse(l.x, l.y, l.r * 0.6, l.r * 0.6 * (l.e || 1), l.rot || 0, 0, 7); ig.fill();
      }
      lobes = lobes.filter((l) => l.age < l.life);
      // tendrils creep outward, wandering and thinning; paper grain pulls them along the fibres
      const born = []; ig.lineCap = 'round';
      for (const c of creep) {
        c.age += dt; const f = 1 - c.age / c.life;
        c.a += R(-9, 9) * dt - paperAmt * 3 * dt * Math.sin(2 * c.a);
        if (c.fork && Math.random() < dt * 1.5 * feath) { c.fork = 0; born.push({ ...c, a: c.a + R(-1, 1), w: c.w * 0.6, age: c.age + 0.2 }); }
        const px = c.x, py = c.y, sp = c.sp * f;
        c.x += Math.cos(c.a) * sp * dt; c.y += Math.sin(c.a) * sp * dt * 1.2;
        fold(c);
        ig.strokeStyle = `rgba(${BODY},${0.7 * f})`; ig.lineWidth = c.w * (0.25 + 0.75 * f);
        ig.beginPath(); ig.moveTo(Math.abs(px), mode >= 3 ? Math.abs(py) : py); ig.lineTo(c.x, c.y); ig.stroke();
      }
      creep = creep.concat(born).filter((c) => c.age < c.life);
      // flecks land, then bleed a touch
      for (const s of flecks) {
        s.age += dt; const f = Math.max(0, 1 - s.age / 0.25);
        s.x += s.vx * dt * f; s.y += s.vy * dt * f;
        const q = fold({ x: s.x, y: s.y });
        ig.fillStyle = `rgba(${BODY},${s.age < 0.05 ? 0.9 : 0.25 * f})`;
        ig.beginPath(); ig.arc(q.x, q.y, s.r * (1 + s.age * 1.2), 0, 7); ig.fill();
      }
      flecks = flecks.filter((s) => s.age < 0.25);
      // 4-way: the bottom of the domain is the mirror of its top, so bleed and rim stay seamless across the fold
      if (mode === 2) { ig.save(); ig.clearRect(0, IH / 2, IW, IH / 2); ig.translate(0, IH); ig.scale(1, -1); ig.drawImage(ink, 0, 0, IW, IH / 2, 0, 0, IW, IH / 2); ig.restore(); }

      // rim: a blurred, lighter copy of the ink with its own shape cut out (mirrored margin keeps the fold seamless)
      const rimAmt = FIX.rim;
      if (rimAmt > 0.02) {
        rg.globalCompositeOperation = 'source-over'; rg.clearRect(0, 0, IW + PAD, IH);
        rg.filter = `blur(${(2.5 + 1.5 * rimAmt).toFixed(1)}px)`;
        rg.drawImage(ink, PAD, 0);
        rg.save(); rg.translate(PAD, 0); rg.scale(-1, 1); rg.drawImage(ink, 0, 0, PAD, IH, 0, 0, PAD, IH); rg.restore();
        rg.filter = 'none';
        rg.globalCompositeOperation = 'source-in'; rg.fillStyle = `rgb(${RIMC})`; rg.fillRect(0, 0, IW + PAD, IH);
        rg.globalCompositeOperation = 'destination-out'; rg.globalAlpha = 0.8; rg.drawImage(ink, PAD, 0); rg.globalAlpha = 1;
      }
      // wet sheen on fresh ink, drawn once in ink space
      sg.clearRect(0, 0, IW, IH); sg.globalCompositeOperation = 'lighter';
      for (const w of wet) {
        const f = Math.max(0, 1 - w.age / (w.hard ? 0.35 : 0.6));
        const gr = sg.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r);
        gr.addColorStop(0, `rgba(${SHEEN},${(w.hard ? 0.3 : 0.16) * f})`); gr.addColorStop(1, `rgba(${SHEEN},0)`);
        sg.fillStyle = gr; sg.beginPath(); sg.arc(w.x, w.y, w.r, 0, 7); sg.fill();
        w.age += dt;
      }
      wet = wet.filter((w) => w.age < 0.6); if (wet.length > 5) wet = wet.slice(-5);

      // the whole sheet breathes: a slow swell, plus a heave on every bloom
      const pres = x.p('presence'), br = FIX.breathe * pres; pulse *= Math.pow(0.5, dt / 0.3);
      const sc = 1 + br * (0.02 * Math.sin(time * 1.1) + 0.06 * pulse);
      if (shake > 0.3) { const sh = shake * pres; g.translate(R(-sh, sh), R(-sh * 0.6, sh * 0.6)); shake *= Math.pow(0.5, dt / 0.12); }
      const inkA = 0.12 + 0.88 * pres;   // how strongly the sheet shows at all
      const W = x.W, H = x.H;
      // the fold(s): barely-there creases
      g.fillStyle = 'rgba(255,240,230,0.025)';
      if (mode <= 2) g.fillRect(W / 2 - 0.5, 0, 1, H);
      if (mode === 2) g.fillRect(0, H / 2 - 0.5, W, 1);
      tg.clearRect(0, 0, IW + PAD, IH); tg.drawImage(ink, PAD, 0);
      tg.save(); tg.translate(PAD, 0); tg.scale(-1, 1); tg.drawImage(ink, 0, 0, PAD, IH, 0, 0, PAD, IH); tg.restore();
      const rimA = Math.min(1, (0.55 + 0.3 * Math.min(1, x.level)) * rimAmt);
      const rot = time * 0.03 * br;
      if (rimAmt > 0.02) {
        layer(g, W, H, rot, sc, rim, -PAD, rimA * inkA, 'source-over');
        if (rimAmt > 1) { g.globalAlpha = (rimAmt - 1) * 0.6 * inkA; g.globalCompositeOperation = 'lighter'; g.drawImage(lay, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      }
      layer(g, W, H, rot, sc, tmp, -PAD, inkA, 'source-over');          // ink with its mirrored margin, so the fold edge stays solid
      if (wet.length) layer(g, W, H, rot, sc, shn, 0, inkA, 'lighter');
    },
  });
})();
