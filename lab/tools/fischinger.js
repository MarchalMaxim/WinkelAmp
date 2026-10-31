// Fischinger (new, 2026-10-31): after Oskar Fischinger (An Optical Poem, Allegretto), the father of visual music. On a deep
// blue ground a company of crisp coloured dancers performs: every note sends one in from far away (it swoops forward out
// of the depth, overshoots a little and settles), low notes as wide bars, middle notes as discs (some with a disc inside),
// high notes as rings. Each dancer has a colour for its pitch class (round the circle of fifths) and a place in the line
// by its pitch: the whole company stands on one figure (a row, an arch, a ring, a V, a wave, a column, a spiral, a block,
// a figure of eight), and a chord picks the figure from its root, so the same harmony always calls the same formation and a new
// harmony makes everybody glide into a new one. Every attack makes the whole company hop toward you on that very frame;
// fast runs scatter them, and they spring back into line. Each dancer has echoes that follow it in canon, a step behind
// and a step deeper, so movements leave a row of receding copies. When its time is up a dancer sinks back into the blue.
(() => {
  const TAU = Math.PI * 2;
  let ds = [], form = 0, formRot = 0, fcx = 640, fcy = 360, glow = 0, lastForm = -1, gradOk = null, lastAt = -9;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const GROUND = [12, 26, 78];                             // the deep blue
  // the twelve colours, laid round the circle of fifths so related keys sit next to each other
  const HUES = [[234, 66, 44], [244, 136, 32], [248, 206, 60], [182, 214, 76], [62, 184, 150], [90, 208, 224],
    [96, 168, 238], [160, 140, 236], [200, 64, 150], [240, 114, 150], [244, 234, 210], [250, 170, 110]];
  const colOf = (m) => HUES[(((m % 12) * 7) % 12)];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const fog = (c, k) => [lerp(c[0], GROUND[0], k), lerp(c[1], GROUND[1], k), lerp(c[2], GROUND[2], k)];

  // The formations: u (0..1, the dancer's place in line, low notes first) → a point, in units of the figure's size.
  const FORMS = [
    (u) => [(u - 0.5) * 3.2, 0],                                                                  // a row
    (u) => { const a = Math.PI + 0.2 + u * (Math.PI - 0.4); return [Math.cos(a) * 1.6, Math.sin(a) * 1.25 + 0.65]; },   // an arch
    (u, n) => { const a = -Math.PI / 2 + u * TAU * (n > 1 ? (n - 1) / n : 1) + formRot; return [Math.cos(a) * 1.25, Math.sin(a) * 1.1]; },   // a ring, turning
    (u) => [(u - 0.5) * 3, -0.85 + Math.abs(u - 0.5) * 3.2],                                      // a V
    (u) => [(u - 0.5) * 3.3, 0.8 * Math.sin(u * TAU * 1.5 + formRot)],                            // a wave, rolling
    (u) => [0.18 * Math.sin(u * TAU * 2), (0.5 - u) * 2.2],                                       // a column, low notes at the bottom
    (u) => { const a = u * TAU * 1.7 + formRot, r = 0.12 + 1.1 * u; return [Math.cos(a) * r * 1.25, Math.sin(a) * r]; },   // a spiral
    (u, n, i) => { const c = Math.max(2, Math.ceil(Math.sqrt(n * 2))), rows = Math.ceil(n / c);   // a block of ranks and files
      return [((i % c) - (c - 1) / 2) * (2.8 / Math.max(1, c - 1)), (Math.floor(i / c) - (rows - 1) / 2) * 0.5]; },
    (u) => { const a = u * TAU + formRot * 0.5; return [Math.sin(a) * 1.6, Math.sin(2 * a) * 0.75]; },   // a figure of eight
  ];

  function knobs(x) {
    return { scatter: x.p('scatter'), depth: x.p('depth'), echoes: Math.round(x.p('echoes')), snap: x.p('snap'), life: x.p('life') };
  }
  // the dancers' places: sorted by pitch (then by age), spread evenly along the figure
  function place() {
    const live = ds.filter((d) => !d.gone).sort((a, b) => a.m - b.m || a.born - b.born);
    const n = live.length;
    live.forEach((d, i) => { d.u = n > 1 ? i / (n - 1) : 0.5; d.rank = i; d.n = n; });
  }

  // icons (40x26)
  const ICONS = {
    scatter(g, v, w, h) {                               // a neat row of discs, or the same discs flung apart
      const r = ICON.rng(4), cols = [ICON.red, ICON.gold, ICON.blue, '#ee7aa8', ICON.green];
      for (let i = 0; i < 5; i++) {
        const x0 = 6 + i * 7, y0 = h / 2, a = r() * TAU, d = v * (6 + r() * 8);
        ICON.dot(g, Math.max(3, Math.min(w - 3, x0 + Math.cos(a) * d)), Math.max(3, Math.min(h - 3, y0 + Math.sin(a) * d * 0.8)), 2.8, cols[i]);
      }
    },
    depth(g, v, w, h) {                                 // a disc and the path it flew in on: from nowhere, or from deep inside
      const n = Math.round(v * 4);
      for (let i = n; i >= 1; i--) { const k = i / 5; ICON.alpha(g, 0.25 + 0.5 * (1 - k), () => ICON.dot(g, 31 - k * 22, h / 2 - k * 6, 9 * (1 - k * 0.8), ICON.gold)); }
      ICON.dot(g, 31, h / 2, 9, ICON.red);
    },
    echoes(g, v, w, h) {                                // one disc, or a disc with copies trailing behind it, smaller and deeper
      const n = Math.round(v * 4);
      for (let i = n; i >= 1; i--) ICON.alpha(g, 0.85 - i * 0.16, () => ICON.dot(g, 29 - i * 6, h / 2 - i * 1.5, 8 * Math.pow(0.8, i), '#5cc6e0'));
      ICON.dot(g, 29, h / 2, 8, ICON.gold);
    },
    snap(g, v, w, h) {                                  // the curve a disc takes into its place: a slow glide or a snap with a bounce
      g.strokeStyle = ICON.dim; g.lineWidth = 1.2; g.beginPath();
      const om = 4 + v * 14, z = 0.95 - v * 0.6;
      for (let x = 3; x <= w - 3; x++) {
        const t = (x - 3) / (w - 6) * 1.2, wd = om * Math.sqrt(1 - z * z);
        const y = 1 - Math.exp(-z * om * t) * (Math.cos(wd * t) + (z * om / wd) * Math.sin(wd * t));
        const py = h - 4 - y * (h - 10); x === 3 ? g.moveTo(x, py) : g.lineTo(x, py);
      }
      g.stroke(); ICON.line(g, 3, 6, w - 3, 6, ICON.dim, 0.6);
      ICON.dot(g, w - 5, 6, 3, ICON.red);
    },
    life(g, v, w, h) { ICON.fade(g, w, h, 0.12 + v * 0.88, ICON.gold, 'dot'); },
  };

  TOOLS.push({
    id: 'fischinger', name: 'Fischinger', tag: 'new',
    blurb: 'After Oskar Fischinger\'s Optical Poem: on a deep blue ground, crisp coloured discs, rings and bars swoop in from the depth on every note and stand in a line by pitch. Each chord calls a formation (a row, an arch, a ring, a V, a column, a spiral, a block...) chosen by its harmony, so the same chord always makes the same figure; every attack makes the whole company hop toward you, fast runs scatter them, and echoes follow each dancer in canon.',
    params: [
      { key: 'scatter', label: 'neat lines or scattered', min: 0, max: 1, value: 0.3, drive: '+rate',
        hint: 'How far fast notes fling the dancers out of line. Left: they keep neat rows and arcs. Right: every run scatters them across the screen before they spring back.',
        icon: ICONS.scatter },
      { key: 'depth', label: 'how far away they fly in from', min: 0, max: 1, value: 0.6, drive: '+level',
        hint: 'Where a new shape comes from. Left: it simply appears in its place. Right: it swoops in from deep in the blue, tiny at first, and overshoots toward you.',
        icon: ICONS.depth },
      { key: 'echoes', label: 'echoes behind each shape', min: 0, max: 4, step: 1, value: 2,
        hint: 'Copies that follow each shape a step behind and a little deeper, like dancers in canon. Left: none. Right: four.',
        icon: ICONS.echoes },
      { key: 'snap', label: 'glide or snap', min: 0, max: 1, value: 0.55,
        hint: 'How the shapes move into a new formation. Left: slow, smooth glides. Right: a quick snap with a little bounce, exactly on the beat.',
        icon: ICONS.snap },
      { key: 'life', label: 'how long they dance', min: 1, max: 10, value: 4,
        hint: 'How long a shape stays in the company before it sinks back into the blue. Left: a second. Right: ten seconds, a big crowd.',
        icon: ICONS.life },
    ],
    reset(x) { ds = []; form = 0; formRot = 0; fcx = x.W / 2; fcy = x.H / 2; glow = 0; lastForm = -1; lastAt = -9; },
    onChord(ch, x) {
      const { scatter, depth, life } = knobs(x);
      const vk = clamp01(ch.vel / 110), gap = x.t - lastAt; lastAt = x.t;
      // a chord (or a loud two-note stroke) calls a formation, chosen by its lowest note: same harmony, same figure
      const big = ch.notes.length >= 3 || (ch.notes.length >= 2 && ch.vel >= 88);
      let moved = false;
      if (big) {
        const was = form;
        form = (((ch.lo % 12) * 5) + (ch.notes.length >= 5 ? 3 : 0)) % FORMS.length;
        if (form === lastForm && ch.vel >= 95) formRot += Math.PI / 6;   // the same chord again, loud: the figure turns a step
        lastForm = form; moved = form !== was;
      }
      // every attack: the whole company hops toward you on this very frame
      for (const d of ds) { if (d.gone) continue; d.z = Math.max(0.8, d.z - (0.05 + 0.14 * vk)); d.vz -= 1.2 * vk; }
      glow = Math.max(glow, vk);
      // fast notes scatter the company outward from the figure's centre, with a turn
      const fast = ch.notes.length <= 2 && gap < 0.22;
      if (fast && scatter > 0.02) {
        const push = scatter * (0.3 + vk) * x.H * 1.3;
        for (const d of ds) {
          if (d.gone) continue;
          const ox = d.x - fcx, oy = d.y - fcy, od = Math.hypot(ox, oy) || 1, s = d.spin;
          d.vx += ((ox / od) * 0.7 - (oy / od) * 0.7 * s + (d.jx * 0.6)) * push;
          d.vy += ((oy / od) * 0.7 + (ox / od) * 0.7 * s + (d.jy * 0.6)) * push;
        }
      }
      // the new dancers: one per note, swooping in from the depth
      const zFar = 1 + depth * 7;
      for (const n of ch.notes) {
        const kind = n.m < 48 ? 'bar' : n.m < 76 ? 'disc' : 'ring';
        const r = lerp(40, 14, clamp01((n.m - 28) / 72)) * (0.8 + 0.35 * clamp01(n.v / 100));
        const d = { m: n.m, v: n.v, kind, r, col: colOf(n.m), col2: colOf(n.m + 7), inner: kind === 'disc' && Math.random() < 0.35,
          born: x.t, age: 0, life: life * (0.75 + 0.5 * clamp01(n.v / 100)) * (kind === 'bar' ? 1.15 : 1), gone: false,
          x: fcx, y: fcy, vx: 0, vy: 0, z: zFar + Math.random() * depth, vz: 0, u: 0.5, rank: 0, n: 1,
          jx: Math.random() * 2 - 1, jy: Math.random() * 2 - 1, spin: Math.random() < 0.5 ? -1 : 1, echo: [], wait: 0 };
        ds.push(d);
      }
      place();
      // a new figure: the company sets off one after another along the line, like a row of dancers on cue
      if (moved) { const n = ds.filter((d) => !d.gone).length; for (const d of ds) if (!d.gone) d.wait = (d.rank / Math.max(1, n - 1)) * 0.35; }
      // the newcomers start from their place in the figure (so they fly straight in out of the depth)
      const S = x.H * 0.32;
      for (const d of ds) if (d.age === 0) { const p = FORMS[form](d.u, d.n, d.rank); d.x = fcx + p[0] * S; d.y = fcy + p[1] * S; d.echo = []; }
      // too many: the oldest leave early
      const live = ds.filter((d) => !d.gone);
      if (live.length > 22) { live.sort((a, b) => a.born - b.born); for (let i = 0; i < live.length - 22; i++) live[i].gone = true; place(); }
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H;
      const { scatter, depth, echoes, snap } = knobs(x);
      // the deep blue ground, a little lighter in the middle, a breath brighter on loud attacks
      glow *= Math.pow(0.5, dt / 0.25);
      if (!gradOk) {
        gradOk = g.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H / 2, W * 0.7);
        gradOk.addColorStop(0, 'rgb(30,58,150)'); gradOk.addColorStop(0.55, 'rgb(14,30,92)'); gradOk.addColorStop(1, 'rgb(5,10,38)');
      }
      g.globalAlpha = 1; g.fillStyle = gradOk; g.fillRect(0, 0, W, H);
      if (glow > 0.02) { g.fillStyle = `rgba(70,110,220,${0.08 * glow})`; g.fillRect(0, 0, W, H); }

      // the figure's centre wanders slowly; the ring and spiral turn
      fcx = W / 2 + W * 0.07 * Math.sin(x.t * 0.083); fcy = H / 2 + H * 0.05 * Math.sin(x.t * 0.061 + 1);
      formRot += dt * 0.15;
      const S = H * 0.32, zFar = 1 + depth * 7;
      // springs: stiffness from 'snap'; slightly under-damped, so arrivals bounce a little
      const om = lerp(4, 17, snap), zeta = lerp(0.95, 0.42, snap), kS = om * om, kD = 2 * zeta * om;
      const omZ = om * 1.25, kSz = omZ * omZ, kDz = 2 * 0.5 * omZ;
      const loose = scatter * 0.22;
      for (const d of ds) {
        d.age += dt;
        if (!d.gone && d.age > d.life) { d.gone = true; place(); }
        const p = FORMS[form](d.u, d.n, d.rank);
        // the company sways together: a slow wave runs along the line, in song time
        const sw = Math.sin(x.t * 1.7 - d.u * TAU * 0.8) * 0.07, sw2 = Math.cos(x.t * 0.9 - d.u * Math.PI) * 0.04;
        const tx = fcx + (p[0] + d.jx * loose + sw2) * S, ty = fcy + (p[1] + d.jy * loose * 0.7 + sw) * S;
        if (d.wait > 0) { d.wait -= dt; d.vx *= Math.pow(0.02, dt); d.vy *= Math.pow(0.02, dt); d.vz += (kSz * (1 - d.z) - kDz * d.vz) * dt; }
        else if (!d.gone) {
          d.vx += (kS * (tx - d.x) - kD * d.vx) * dt; d.vy += (kS * (ty - d.y) - kD * d.vy) * dt;
          d.vz += (kSz * (1 - d.z) - kDz * d.vz) * dt;
        } else {                                        // leaving: drift on and sink back into the blue
          d.vx *= Math.pow(0.3, dt); d.vy *= Math.pow(0.3, dt);
          d.vz += (1.2 + depth * 3) * dt;
        }
        d.x += d.vx * dt; d.y += d.vy * dt; d.z = Math.max(0.72, d.z + d.vz * dt);
        // the echoes: each follows the one before it, a step behind and a step deeper
        while (d.echo.length < echoes) { const prev = d.echo[d.echo.length - 1] || d; d.echo.push({ x: prev.x, y: prev.y, z: prev.z }); }
        if (d.echo.length > echoes) d.echo.length = echoes;
        const follow = 1 - Math.pow(0.5, dt / lerp(0.16, 0.06, snap));
        let prev = d;
        for (let j = 0; j < d.echo.length; j++) {
          const e = d.echo[j];
          e.x += (prev.x - e.x) * follow; e.y += (prev.y - e.y) * follow; e.z += (prev.z + 0.32 - e.z) * follow;
          prev = e;
        }
      }
      ds = ds.filter((d) => !(d.gone && (d.z > zFar + 2.5 || d.age > d.life + 4)));

      // draw, deepest first; the vanishing point is the middle of the screen
      const items = [];
      for (const d of ds) {
        const out = d.gone ? clamp01((d.age - d.life) / 1.5) : 0;
        for (let j = d.echo.length - 1; j >= 0; j--) items.push([d.echo[j], d, j + 1, out]);
        items.push([d, d, 0, out]);
      }
      items.sort((a, b) => b[0].z - a[0].z);
      const vx = W / 2, vy = H / 2;
      for (const [o, d, j, out] of items) {
        const k = 1 / o.z, sx = vx + (o.x - vx) * k, sy = vy + (o.y - vy) * k, r = d.r * k;
        if (r < 0.6) continue;
        // far away (or an echo, or leaving) = closer to the blue
        const f = clamp01((o.z - 1) / 7) * 0.85 + j * 0.13 + out * 0.9;
        if (f >= 0.98) continue;
        const c = rgb(fog(d.col, Math.min(0.97, f)));
        g.fillStyle = c; g.strokeStyle = c;
        if (d.kind === 'bar') {
          const bw = r * 3.4, bh = Math.max(1, r * 0.62);
          g.beginPath(); g.roundRect(sx - bw / 2, sy - bh / 2, bw, bh, bh / 2); g.fill();
        } else if (d.kind === 'ring') {
          g.lineWidth = Math.max(0.8, r * 0.3); g.beginPath(); g.arc(sx, sy, r * 0.85, 0, TAU); g.stroke();
        } else {
          g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
          if (d.inner && j === 0) { g.fillStyle = rgb(fog(d.col2, Math.min(0.97, f))); g.beginPath(); g.arc(sx, sy, r * 0.45, 0, TAU); g.fill(); }
        }
      }
    },
  });
})();
