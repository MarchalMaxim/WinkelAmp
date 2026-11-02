// Fischinger (v2, 2026-10-31): after Oskar Fischinger (An Optical Poem, Allegretto), the father of visual music. On a deep
// blue ground a company of crisp coloured dancers performs: every note sends one in from far away, low notes as wide bars,
// middle notes as discs (some with a disc inside), high notes as rings. Each dancer has a colour for its pitch class (round
// the circle of fifths) and a place in the line by its pitch: the whole company stands on one figure (a row, an arch, a
// ring, a V, a wave, a column, a spiral, a block, a figure of eight), and a chord picks the figure from its root, so the
// same harmony always calls the same formation and a new harmony makes everybody glide into a new one.
// v2, so every note visibly lands and the music's shape reads:
//  - the landing: a loud note slams in from deep in the blue in a few frames, pops past its size, flashes light and sends a
//    ring out from where it lands; a soft note drifts in slowly from nearer, smaller and paler, with a faint ring;
//  - held notes stay lit; when a note is let go its dancer sinks back a little into the blue (legato glows, staccato pales);
//  - a few notes make a few big shapes, a crowd of notes many small ones, so sparse and dense look different, and the
//    figure's line stays readable instead of piling up;
//  - the whole figure rises when the music is high and sinks when it is low;
//  - fast runs make the figure bloom outward and turn (it keeps its shape) instead of flinging dancers anywhere.
// Every attack still makes the whole company hop toward you on that very frame, and each dancer has echoes that follow
// it in canon, a step behind and a step deeper. When its time is up a dancer sinks back into the blue.
// The 'how present' knob tones all of it down: the picture fades toward black, the company moves slowly and hops less, and
// only the hardest notes of the piece add a dancer. At 1 every factor below is exactly 1, so the picture is the v2 one.
(() => {
  const TAU = Math.PI * 2;
  let ds = [], rips = [], form = 0, formRot = 0, fcx = 640, fcy = 360, fyOff = 0, glow = 0, lastForm = -1, gradOk = null, lastAt = -9;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  // the deep blue ground, lighter in the middle (the stops of the painted gradient); shapes sink into the blue right behind them
  const G0 = [30, 58, 150], G1 = [14, 30, 92], G2 = [5, 10, 38];
  const ground = (sx, sy, W, H) => {
    const t = Math.min(1, Math.hypot(sx - W / 2, sy - H * 0.47) / (W * 0.7));
    return t < 0.55 ? [lerp(G0[0], G1[0], t / 0.55), lerp(G0[1], G1[1], t / 0.55), lerp(G0[2], G1[2], t / 0.55)]
      : [lerp(G1[0], G2[0], (t - 0.55) / 0.45), lerp(G1[1], G2[1], (t - 0.55) / 0.45), lerp(G1[2], G2[2], (t - 0.55) / 0.45)];
  };
  // the twelve colours, laid round the circle of fifths so related keys sit next to each other
  const HUES = [[234, 66, 44], [244, 136, 32], [248, 206, 60], [182, 214, 76], [62, 184, 150], [90, 208, 224],
    [96, 168, 238], [160, 140, 236], [200, 64, 150], [240, 114, 150], [244, 234, 210], [250, 170, 110]];
  const colOf = (m) => HUES[(((m % 12) * 7) % 12)];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const fog = (c, k, gr) => [lerp(c[0], gr[0], k), lerp(c[1], gr[1], k), lerp(c[2], gr[2], k)];
  const lift = (c, k) => [lerp(c[0], 255, k), lerp(c[1], 250, k), lerp(c[2], 240, k)];

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
    return { scatter: x.p('scatter'), depth: x.p('depth'), echoes: Math.round(x.p('echoes')), snap: x.p('snap'), life: x.p('life'), pres: x.p('presence') };
  }
  // how present (0..1): which notes add a dancer, judged against this piece's own notes (recordings differ a lot in how hard
  // they are played): every one at 1, the hardest half or so at 0.5, the hardest 10% at 0
  let vels = null;
  const hardEnough = (v, pres) => {
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    const cut = (1 - pres) * 0.9;
    if (cut <= 0 || !vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= cut;
  };
  // a factor that is exactly 1 at full presence and 1 - k with the knob at the left
  const damp = (pres, k) => 1 - (1 - pres) * k;
  const GROUND_DIM = 0.7, ALL_DIM = 0.78;   // at the far left: ground 0.3 x 0.22 of its light (near black), shapes 0.22 (faint)
  // the dancers' places: sorted by pitch (then by age), spread evenly along the figure
  function place() {
    const live = ds.filter((d) => !d.gone).sort((a, b) => a.m - b.m || a.born - b.born);
    const n = live.length;
    live.forEach((d, i) => { d.u = n > 1 ? i / (n - 1) : 0.5; d.rank = i; d.n = n; });
  }
  // a few dancers are big, a crowd of them small (so the figure stays readable and dense music looks dense)
  const crowdScale = (n) => lerp(1.2, 0.68, clamp01((n - 3) / 19));

  // icons (40x26)
  const ICONS = {
    scatter(g, v, w, h) {                               // a neat row of discs, or the same row bloomed outward and turned
      const cols = [ICON.red, ICON.gold, ICON.blue, '#ee7aa8', ICON.green], cx = w / 2, cy = h / 2;
      for (let i = 0; i < 5; i++) {
        const ox = (i - 2) * 7, a = Math.atan2(0, ox) + v * 0.9 * (i % 2 ? 1 : -1), d = Math.abs(ox) * (1 + v * 0.7) + v * 3;
        ICON.dot(g, Math.max(3, Math.min(w - 3, cx + Math.cos(a) * d)), Math.max(3, Math.min(h - 3, cy + Math.sin(a) * d)), 2.8, cols[i]);
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
    presence(g, v, w, h) {                              // the blue ground with one disc on it, barely there or at full strength
      ICON.alpha(g, 0.12 + 0.88 * v, () => { ICON.rect(g, 5, 3, w - 10, h - 6, ICON.blue); ICON.dot(g, w / 2, h / 2, 3 + 5 * v, ICON.gold); });
    },
  };

  // one shape's outline (for the landing rings)
  function outline(g, kind, sx, sy, r, s) {
    g.beginPath();
    if (kind === 'bar') {                               // a bar's ring grows mostly in height (it is wide already)
      const bw = r * (3.4 + (s - 1) * 0.8), bh = Math.max(1, r * 0.62 * (1 + (s - 1) * 0.8)); g.roundRect(sx - bw / 2, sy - bh / 2, bw, bh, bh / 2);
    } else g.arc(sx, sy, r * s, 0, TAU);
    g.stroke();
  }

  TOOLS.push({
    id: 'fischinger', name: 'Fischinger', tag: 'v2',
    blurb: 'After Oskar Fischinger\'s Optical Poem: on a deep blue ground, coloured discs, rings and bars swoop in on every note and stand in a figure by pitch (a row, an arch, a ring, a V, a spiral...) that each chord chooses. New in v2: every note lands with a pop and a ring, loud ones fast and bright, soft ones slow and pale; held notes stay lit, a few notes make big shapes and a crowd many small ones, and the figure rises with high music and sinks with low. A <b>how present</b> knob thins the crowd: shapes that sink back almost at once, and no echoes.',
    params: [
      { key: 'scatter', label: 'neat lines or scattered', min: 0, max: 1, value: 0.3, drive: '+rate',
        hint: 'What fast runs do to the figure. Left: it keeps its neat lines. Right: every run makes it bloom outward and turn before it springs back.',
        icon: ICONS.scatter },
      { key: 'depth', label: 'how far away they fly in from', min: 0, max: 1, value: 0.6, drive: '+level',
        hint: 'Where a new shape comes from. Left: it simply pops up in its place. Right: it swoops in from deep in the blue, loud notes fastest.',
        icon: ICONS.depth },
      { key: 'echoes', label: 'echoes behind each shape', min: 0, max: 4, step: 1, value: 2, less: 0,
        hint: 'Copies that follow each shape a step behind and a little deeper, like dancers in canon. Left: none. Right: four.',
        icon: ICONS.echoes },
      { key: 'snap', label: 'glide or snap', min: 0, max: 1, value: 0.55,
        hint: 'How the shapes move into a new formation. Left: slow, smooth glides. Right: a quick snap with a little bounce, exactly on the beat.',
        icon: ICONS.snap },
      { key: 'life', label: 'how long they dance', min: 1, max: 10, value: 4, less: 1.5,
        hint: 'How long a shape stays in the company before it sinks back into the blue. Left: a second. Right: ten seconds, a big crowd.',
        icon: ICONS.life },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How crowded the blue is: how long a shape stays in the company, and how many echoes follow each. Left: a few shapes that sink back almost at once. Right: a big crowd with dancers in canon. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset(x) { ds = []; rips = []; form = 0; formRot = 0; fcx = x.W / 2; fcy = x.H / 2; fyOff = 0; glow = 0; lastForm = -1; lastAt = -9; vels = null; },
    onChord(ch, x) {
      const { scatter, depth, life, pres } = knobs(x);
      const vk = clamp01((ch.vel - 30) / 80), gap = x.t - lastAt;
      // toned down: only the hardest notes are answered, and an attack with none of them does nothing at all
      const notes = pres < 1 ? ch.notes.filter((n) => hardEnough(n.v, pres)) : ch.notes;
      if (!notes.length) return;
      lastAt = x.t;
      const calm = damp(pres, 0.85), dz = depth * damp(pres, 0.7);
      // a chord (or a loud two-note stroke) calls a formation, chosen by its lowest note: same harmony, same figure
      const big = ch.notes.length >= 3 || (ch.notes.length >= 2 && ch.vel >= 88);
      let moved = false;
      if (big) {
        const was = form;
        form = (((ch.lo % 12) * 5) + (ch.notes.length >= 5 ? 3 : 0)) % FORMS.length;
        if (form === lastForm && ch.vel >= 95) formRot += Math.PI / 6 * calm;   // the same chord again, loud: the figure turns a step
        lastForm = form; moved = form !== was;
      }
      // every attack: the whole company hops toward you on this very frame, more for a loud one
      for (const d of ds) { if (d.gone || d.arr < 1) continue; d.z = Math.max(0.78, d.z - (0.03 + 0.13 * vk) * calm); d.vz -= 1.1 * vk * calm; }
      glow = Math.max(glow, vk);
      // fast notes make the figure bloom outward from its centre and turn (it keeps its shape, a little loosened)
      const fast = ch.notes.length <= 2 && gap < 0.22;
      if (fast && scatter > 0.02) {
        const push = scatter * (0.35 + vk) * x.H * 1.1 * Math.max(0.25, Math.min(1, gap / 0.15)) * calm;   // a blur of notes: many small pushes
        for (const d of ds) {
          if (d.gone) continue;
          const ox = d.x - fcx, oy = d.y - fcy, od = Math.hypot(ox, oy) || 1, s = d.spin * 0.25 + 0.75;   // most turn the same way
          d.vx += ((ox / od) * 0.75 - (oy / od) * 0.6 * s + d.jx * 0.22) * push;
          d.vy += ((oy / od) * 0.75 + (ox / od) * 0.6 * s + d.jy * 0.22) * push;
        }
      }
      // the new dancers: one per note, swooping in from the depth; loud ones from deeper and faster
      for (const n of notes) {
        const nv = clamp01((n.v - 30) / 80);
        const kind = n.m < 48 ? 'bar' : n.m < 76 ? 'disc' : 'ring';
        const r = lerp(40, 15, clamp01((n.m - 28) / 72)) * (0.72 + 0.5 * nv);
        const zFrom = 1 + dz * 7 * (0.45 + 0.55 * nv) + Math.random() * dz * 0.6;
        const d = { m: n.m, v: n.v, nv, kind, r, col: colOf(n.m), col2: colOf(n.m + 7), inner: kind === 'disc' && Math.random() < 0.35,
          born: x.t, age: 0, dur: n.d, life: life * (0.75 + 0.5 * nv) * (kind === 'bar' ? 1.15 : 1), gone: false,
          left: 0, arr: 0, arrT: lerp(0.14, 0.03, nv) / calm, zFrom, fl: 0, rel: 0, cs: -1,
          x: fcx, y: fcy, vx: 0, vy: 0, z: zFrom, vz: 0, u: 0.5, rank: 0, n: 1,
          jx: Math.random() * 2 - 1, jy: Math.random() * 2 - 1, spin: Math.random() < 0.5 ? -1 : 1, echo: [], wait: 0 };
        ds.push(d);
      }
      place();
      // a new figure: the company sets off one after another along the line, like a row of dancers on cue
      if (moved) { const n = ds.filter((d) => !d.gone).length; for (const d of ds) if (!d.gone && d.arr >= 1) d.wait = (d.rank / Math.max(1, n - 1)) * 0.35; }
      // the newcomers start from their place in the figure (so they fly straight in out of the depth)
      const nLive = ds.filter((d) => !d.gone).length, S = x.H * 0.3;
      for (const d of ds) if (d.age === 0) {
        const p = FORMS[form](d.u, d.n, d.rank); d.x = fcx + p[0] * S; d.y = fcy + fyOff + p[1] * S; d.echo = []; d.cs = crowdScale(nLive);
      }
      // too many: the oldest leave early
      const live = ds.filter((d) => !d.gone);
      if (live.length > 26) { live.sort((a, b) => a.born - b.born); for (let i = 0; i < live.length - 26; i++) { live[i].gone = true; live[i].left = live[i].age; } place(); }
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H;
      const { scatter, depth, echoes, snap, pres } = knobs(x);
      const calm = damp(pres, 0.85), size = damp(pres, 0.35);
      // the deep blue ground, a little lighter in the middle, a breath brighter on loud attacks
      glow *= Math.pow(0.5, dt / 0.22);
      if (!gradOk) {
        gradOk = g.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H / 2, W * 0.7);
        gradOk.addColorStop(0, rgb(G0)); gradOk.addColorStop(0.55, rgb(G1)); gradOk.addColorStop(1, rgb(G2));
      }
      g.globalAlpha = 1; g.fillStyle = gradOk; g.fillRect(0, 0, W, H);
      if (glow > 0.02) { g.fillStyle = `rgba(80,120,230,${0.1 * glow})`; g.fillRect(0, 0, W, H); }
      // toned down: the ground goes dark first, so the shapes still read as faint colour on near-black
      const groundK = damp(pres, GROUND_DIM);
      if (pres < 1) { g.fillStyle = `rgba(0,0,0,${1 - groundK})`; g.fillRect(0, 0, W, H); }

      // the figure's centre wanders slowly, and rises with high music, sinks with low; the ring and spiral turn
      let live = 0, mSum = 0;
      for (const d of ds) if (!d.gone) { live++; mSum += d.m; }
      if (live) { const want = clamp01(((mSum / live) - 40) / 44); fyOff += ((0.5 - want) * H * 0.14 * calm - fyOff) * (1 - Math.pow(0.5, dt / 0.7)); }
      fcx = W / 2 + W * 0.07 * Math.sin(x.t * 0.083); fcy = H / 2 + H * 0.04 * Math.sin(x.t * 0.061 + 1);
      formRot += dt * 0.15 * calm;
      const S = H * 0.3, cs = crowdScale(live);
      // springs: stiffness from 'snap'; slightly under-damped, so arrivals bounce a little
      const om = lerp(4, 17, snap) * damp(pres, 0.65), zeta0 = lerp(0.95, 0.42, snap), zeta = zeta0 + (1 - zeta0) * (1 - pres), kS = om * om, kD = 2 * zeta * om;
      const omZ = om * 1.25 + 4, kSz = omZ * omZ, kDz = 2 * 0.45 * omZ;
      const loose = scatter * 0.12;
      for (const d of ds) {
        d.age += dt;
        if (!d.gone && d.age > d.life) { d.gone = true; d.left = d.age; place(); }
        d.cs += (cs - d.cs) * (1 - Math.pow(0.5, dt / 0.35));
        d.fl *= Math.pow(0.5, dt / 0.13);
        if (d.age > d.dur + 0.05) d.rel = Math.min(1, d.rel + dt / 0.5);      // let go: sinks a little into the blue
        const p = FORMS[form](d.u, d.n, d.rank);
        // the company sways together: a slow wave runs along the line, in song time
        const sw = Math.sin(x.t * 1.7 - d.u * TAU * 0.8) * 0.06 * calm, sw2 = Math.cos(x.t * 0.9 - d.u * Math.PI) * 0.035 * calm;
        const tx = fcx + (p[0] + d.jx * loose + sw2) * S, ty = fcy + fyOff + (p[1] + d.jy * loose * 0.7 + sw) * S;
        if (d.wait > 0) { d.wait -= dt; d.vx *= Math.pow(0.02, dt); d.vy *= Math.pow(0.02, dt); d.vz += (kSz * (1 - d.z) - kDz * d.vz) * dt; }
        else if (!d.gone) {
          d.vx += (kS * (tx - d.x) - kD * d.vx) * dt; d.vy += (kS * (ty - d.y) - kD * d.vy) * dt;
          d.vz += (kSz * (1 - d.z) - kDz * d.vz) * dt;
        } else {                                        // leaving: drift on and sink back into the blue
          d.vx *= Math.pow(0.3, dt); d.vy *= Math.pow(0.3, dt);
          d.vz += (1.2 + depth * 3) * dt;
        }
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.arr < 1) {
          // flying in: out of the depth on an ease, then the landing (a pop past its size, a flash, a ring)
          if (dt > 0) d.arr = Math.min(1, d.arr + dt / Math.max(0.016, d.arrT));
          const e = 1 - Math.pow(1 - d.arr, 3);
          d.z = 1 + (d.zFrom - 1) * (1 - e); d.vz = 0;
          if (d.arr >= 1) {
            d.z = 1 - 0.24 * d.nv * calm - 0.04 * calm; d.vz = 0; d.fl = (0.25 + 0.75 * d.nv) * calm;
            const k = 1 / d.z, sx = W / 2 + (d.x - W / 2) * k, sy = H / 2 + (d.y - H / 2) * k;
            rips.push({ x: sx, y: sy, r: d.r * d.cs * k * size, kind: d.kind, col: d.col, a: d.nv, t: 0, life: 0.4 + 0.45 * d.nv,
              grow: 1.5 + 2.2 * d.nv * lerp(1, 0.55, clamp01((d.n - 4) / 16)) });
          }
        } else d.z = Math.max(0.7, d.z + d.vz * dt);
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
      ds = ds.filter((d) => !(d.gone && (d.z > 1 + depth * 7 + 2.5 || d.age > d.left + 1.6)));
      if (rips.length > 48) rips.splice(0, rips.length - 48);

      // the landing rings, under the dancers: an outline that grows from the shape and fades into the blue
      g.lineCap = 'round'; g.globalCompositeOperation = 'lighter';
      for (const q of rips) {
        q.t += dt;
        const k = q.t / q.life;
        if (k >= 1) continue;
        // light added onto the blue in the note's colour, dimming as it grows (a soft note's ring is faint from the start)
        const e = 1 - Math.pow(1 - k, 2), li = (0.18 + 0.42 * q.a) * Math.pow(1 - k, 1.4);
        g.strokeStyle = rgb([q.col[0] * li, q.col[1] * li, q.col[2] * li]);
        g.lineWidth = Math.max(0.8, q.r * (0.16 + 0.1 * q.a) * (1 - k * 0.6));
        outline(g, q.kind, q.x, q.y, q.r, 1.08 + (q.grow - 1) * e);
      }
      g.globalCompositeOperation = 'source-over';
      rips = rips.filter((q) => q.t < q.life);

      // draw, deepest first; the vanishing point is the middle of the screen
      const items = [];
      for (const d of ds) {
        const out = d.gone ? clamp01((d.age - d.left) / (d.left < d.life ? 0.6 : 1.5)) : 0;   // pushed out by a crowd: leaves quicker
        for (let j = d.echo.length - 1; j >= 0; j--) items.push([d.echo[j], d, j + 1, out]);
        items.push([d, d, 0, out]);
      }
      items.sort((a, b) => b[0].z - a[0].z);
      const vx = W / 2, vy = H / 2;
      for (const [o, d, j, out] of items) {
        const k = 1 / o.z, sx = vx + (o.x - vx) * k, sy = vy + (o.y - vy) * k, r = d.r * d.cs * k * (1 - 0.14 * d.rel) * size;
        if (r < 0.6) continue;
        // far away (or an echo, or leaving) = closer to the blue; soft or let-go notes a touch, and let-go ones shrink a little
        const f = clamp01((o.z - 1) / 7) * 0.85 + j * 0.14 + (1 - d.nv) * 0.07 + d.rel * 0.1 + out * 0.9;
        if (f >= 0.98) continue;
        const gr = ground(sx, sy, W, H); gr[0] *= groundK; gr[1] *= groundK; gr[2] *= groundK;
        const base = fog(d.col, Math.min(0.97, Math.max(0, f)), gr);
        const c = rgb(j === 0 && d.fl > 0.02 ? lift(base, d.fl * 0.5) : base);
        g.fillStyle = c; g.strokeStyle = c;
        if (d.kind === 'bar') {
          const bw = r * 3.4, bh = Math.max(1, r * 0.62);
          g.beginPath(); g.roundRect(sx - bw / 2, sy - bh / 2, bw, bh, bh / 2); g.fill();
        } else if (d.kind === 'ring') {
          g.lineWidth = Math.max(0.8, r * 0.3); g.beginPath(); g.arc(sx, sy, r * 0.85, 0, TAU); g.stroke();
        } else {
          g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
          if (d.inner && j === 0) { g.fillStyle = rgb(fog(d.col2, Math.min(0.97, Math.max(0, f)), gr)); g.beginPath(); g.arc(sx, sy, r * 0.45, 0, TAU); g.fill(); }
        }
      }
      // and then the whole picture (ground, rings, shapes) fades toward black together. The ground is repainted opaque every
      // frame, so this never leaves trails.
      if (pres < 1) { g.fillStyle = `rgba(0,0,0,${ALL_DIM * (1 - pres)})`; g.fillRect(0, 0, W, H); }
    },
  });
})();
