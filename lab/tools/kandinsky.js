// Kandinsky v2: notes compose an abstract painting. Low notes: heavy black bars with a coloured shadow, and for the
// loudest deep notes a small checker grid or a black sun (weight; they sink); middle: blue circles (concentric, they
// gather); high: yellow triangles (eccentric, they fly out). Loud notes are bigger, held notes draw arcs, a chord is a
// constellation around a wandering focus, the melody is a line, and big chords throw long straight lines across the canvas.
// v2 (2026-10-31): the low register no longer paints red squares (that is Dread squares' job), everything is a notch
// smaller and quieter, and 10 knobs became 5 with new keys, so earlier slider settings no longer apply (our defaults).
(() => {
  const TAU = Math.PI * 2;
  let els = [], lines = [], rings = [], planes = [], lastTop = null, crossCool = 0, planeCool = 0, fx = 640, fy = 360, wx = 0, wy = 0;
  const R = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const SPLIT = 58;                                   // the register split: below 48 weights, 48..67 circles, above triangles
  const MID = [40, 86, 214], HIGH = [250, 210, 40];   // Kandinsky's blue and yellow
  // a black bar's coloured shadow: deep red, ochre, indigo (chosen by the note, so a bass line keeps its colours)
  const WEIGHT = [[150, 30, 42], [184, 128, 40], [78, 58, 150]];
  const CORONA = [[52, 70, 190], [110, 60, 170]];
  const CREAM = '238,230,212', INK = '9,8,11';
  const rgb = (c) => c.map(Math.round).join(',');

  // a polygon with rounded corners (rr = 0: sharp)
  function poly(g, pts, rr) {
    g.beginPath();
    if (rr < 0.5) { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); return; }
    const n = pts.length, m0 = [(pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2];
    g.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; g.arcTo(p[0], p[1], q[0], q[1], rr); }
    g.closePath();
  }
  // the shape's outline at k times its size; sharp 0 = soft and round, 1 = crisp bars, lenses and needles
  function path(g, e, k, sharp) {
    const s = e.s * k;
    if (e.kind === 'sun' || e.cls === 1) { g.beginPath(); g.ellipse(0, 0, s / 2, (s / 2) * (e.kind === 'sun' ? 1 : 1 - sharp * 0.62), 0, 0, TAU); return; }
    if (e.kind === 'grid') { g.beginPath(); g.rect(-s / 2, -s / 2, s, s); return; }
    if (e.cls === 0) {                                // a bar: long and heavy
      const w = s, h = e.th * k, rr = h * 0.5 * Math.pow(1 - sharp, 2);
      poly(g, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], rr);
      return;
    }
    const b = s * (1.1 - sharp * 0.85), h = s * (0.9 + sharp * 0.9), rr = s * 0.2 * Math.pow(1 - sharp, 2);
    poly(g, [[h * 0.62, 0], [-h * 0.38, -b / 2], [-h * 0.38, b / 2]], rr);   // points along +x
  }
  function line(a, b, kind, life, w) { lines.push({ a, b, kind, life, w, age: 0 }); }
  // the six knobs, plus what the old knobs became
  function knobs(x) {
    const r = x.p('restless'), paint = x.p('paint');
    return { sharp: x.p('edges'), hollow: x.p('rings'), L: x.p('web'), order: 0.85 - 0.6 * r, drift: 0.05 + 0.6 * r, paint };
  }

  // icon helpers (drawn on the knob's 40x26 canvas)
  const ICONS = {
    edges(g, v, w, h) {                               // a blue lens and a yellow triangle, round at the left, sharp at the right
      g.fillStyle = ICON.blue; g.beginPath(); g.ellipse(11, h / 2, 8, 8 * (1 - v * 0.62), 0, 0, TAU); g.fill();
      const s = 13, b = s * (1.1 - v * 0.85), L = s * (0.9 + v * 0.9), rr = s * 0.25 * Math.pow(1 - v, 2);
      g.save(); g.translate(29, h / 2 + 2); g.rotate(-Math.PI / 2); g.fillStyle = ICON.gold;
      poly(g, [[L * 0.62, 0], [-L * 0.38, -b / 2], [-L * 0.38, b / 2]], rr); g.fill(); g.restore();
    },
    rings(g, v, w, h) {                               // a solid blue disc becomes concentric rings
      ICON.alpha(g, 1 - v, () => ICON.dot(g, w / 2, h / 2, 10, ICON.blue));
      ICON.alpha(g, v, () => { ICON.ring(g, w / 2, h / 2, 10, ICON.blue, 1.8); ICON.ring(g, w / 2, h / 2, 6.2, ICON.blue, 1.4); ICON.ring(g, w / 2, h / 2, 2.6, ICON.blue, 1.2); });
    },
    web(g, v, w, h) {                                 // loose notes, then joined into figures, then long lines across
      const P = [[6, 18], [14, 7], [21, 19], [29, 9], [35, 20]], cols = [ICON.red, ICON.blue, ICON.gold, ICON.blue, ICON.gold];
      const n = Math.round(v * 5);
      for (let i = 0; i < Math.min(n, 4); i++) ICON.line(g, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], ICON.ink, 1);
      if (n >= 5) ICON.line(g, 1, 24, 39, 2, ICON.ink, 1.3);
      P.forEach(([px, py], i) => ICON.dot(g, px, py, 2.4, cols[i]));
    },
    restless(g, v, w, h) {                            // three forms: lined up and upright, or scattered, turned and moving
      const A = [[8, 13, 0], [20, 13, 0], [32, 13, 0]], B = [[7, 7, 0.8], [21, 20, 0], [33, 8, -0.7]];
      const p = A.map((a, i) => a.map((c, j) => lerp(c, B[i][j], v)));
      if (v > 0.4) ICON.alpha(g, (v - 0.4) / 0.6, () => { ICON.line(g, p[1][0] - 9, p[1][1] + 2, p[1][0] - 5, p[1][1] + 1, ICON.dim, 1); ICON.line(g, p[2][0] + 2, p[2][1] + 7, p[2][0] + 1, p[2][1] + 4, ICON.dim, 1); });
      ICON.square(g, p[0][0], p[0][1], 9, '#b8802a', p[0][2]);
      ICON.dot(g, p[1][0], p[1][1], 4.5, ICON.blue);
      g.save(); g.translate(p[2][0], p[2][1]); g.rotate(p[2][2]); ICON.shape(g, 'triangle', 0, 0, 10, ICON.gold); g.restore();
    },
    paint(g, v, w, h) {                               // a few small faint forms, or many big bold ones
      const r = ICON.rng(11), n = Math.round(2 + v * 4), cols = [ICON.blue, ICON.gold, '#b8802a', ICON.blue, ICON.gold, ICON.ink];
      const shapes = ['dot', 'triangle', 'square', 'dot', 'diamond', 'ring'];
      ICON.alpha(g, 0.45 + 0.55 * v, () => {
        for (let i = 0; i < 6; i++) {
          const px = 5 + r() * 30, py = 5 + r() * 16;
          if (i < n) ICON.shape(g, shapes[i], px, py, lerp(5, 11, v), cols[i]);
        }
      });
    },
  };

  TOOLS.push({
    id: 'kandinsky', name: 'Kandinsky', tag: 'v2',
    blurb: 'The notes paint a Kandinsky: low notes are heavy black bars crossing a plane of colour (the loudest, deepest ones a small checker grid or a black sun), middle notes blue circles, high notes yellow triangles that fly outward. Chords become constellations, the melody a line. v2: no more red squares (that is Dread squares), a notch quieter, new knobs on our defaults. Turn <b>how present</b> down for less painting: smaller shapes that leave sooner, with hardly any lines.',
    params: [
      { key: 'edges', label: 'round or sharp', min: 0, max: 1, value: 0.3, drive: '+level',
        hint: 'The shapes\' edges. Left: soft, round circles and rounded bars. Right: crisp bars, thin lenses and needle-sharp triangles.',
        icon: ICONS.edges },
      { key: 'rings', label: 'solid or outlined', min: 0, max: 1, value: 0.5, drive: '-level',
        hint: 'How many shapes are drawn as outlines with rings inside. Left: all solid colour. Right: mostly outlines and concentric rings.',
        icon: ICONS.rings },
      { key: 'web', label: 'connecting lines', min: 0, max: 1, value: 0.5, less: 0.05,
        hint: 'Lines joining the notes of a chord, the melody, and the long lines thrown by big chords. Left: shapes only. Right: a dense web.',
        icon: ICONS.web },
      { key: 'restless', label: 'calm or restless', min: 0, max: 1, value: 0.3, drive: '+rate',
        hint: 'How the painting moves. Left: still and composed, chords form neat figures. Right: shapes scatter, spin and drift away.',
        icon: ICONS.restless },
      { key: 'paint', label: 'how much paint', min: 0, max: 1, value: 0.45, less: 0.1,
        hint: 'How bold the painting gets. Left: small, faint shapes that leave soon. Right: big, saturated shapes that stay for many seconds.',
        icon: ICONS.paint },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much painting it makes: how big the shapes get and how long they stay, and how many lines join them. Left: small shapes that leave soon, almost no lines. Right: big shapes that stay for seconds in a dense web. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { els = []; lines = []; rings = []; planes = []; lastTop = null; crossCool = 0; planeCool = 0; fx = 640; fy = 360; wx = 0; wy = 0; },
    onChord(ch, x) {
      const { order, L, paint } = knobs(x);
      const life = lerp(2.5, 7.5, paint) * (1 - 0.35 * (x.feat?.density ?? 0)), scale = lerp(0.55, 1.1, paint);
      // the focus wanders over the canvas on its own slow path
      const roam = 0.17, T = x.t;
      fx = x.W / 2 + x.W * roam * (0.75 * Math.sin(T * 0.071) + 0.25 * Math.sin(T * 0.23 + 1.3));
      fy = x.H / 2 + x.H * roam * (0.7 * Math.sin(T * 0.053 + 2.1) + 0.3 * Math.sin(T * 0.19));
      // plus a little step per chord, so repeated chords don't stamp the same spot
      wx = wx * 0.85 + R(-1, 1) * 70 * (1.2 - order); wy = wy * 0.85 + R(-1, 1) * 45 * (1.2 - order);
      fx += wx; fy += wy;
      fx = Math.max(x.W * 0.25, Math.min(x.W * 0.75, fx)); fy = Math.max(x.H * 0.32, Math.min(x.H * 0.62, fy));
      // a loud low note now and then lays a faint field of blue or yellow far behind everything
      if (ch.lo < SPLIT - 6 && ch.vel >= 84 && planeCool <= 0 && Math.random() < 0.3 + 0.6 * paint) {
        planeCool = 2.5;
        planes.push({ x: fx + R(-1, 1) * 120 * (1 - order), y: fy + R(-1, 1) * 70, r: (120 + (ch.vel - 84) * 5) * lerp(0.75, 1.2, paint), age: 0, life: life * 1.2,
          col: Math.random() < 0.65 ? MID : HIGH, a: 0.025 + 0.03 * paint, sq: Math.random() < 0.35, rot: lerp(R(-0.6, 0.6), 0, order) });
        if (planes.length > 2) planes.shift();
      }
      const spread = 1.15;
      const born = [];
      let notes = [...ch.notes].sort((a, b) => a.m - b.m);
      // the bass of a chord is one weight, not a pile: its low notes merge into a single, longer bar
      const lows = notes.filter((n) => n.m < SPLIT - 10);
      if (lows.length > 1) notes = [{ ...lows[0], v: Math.max(...lows.map((n) => n.v)), k: 1 + 0.15 * (lows.length - 1) }, ...notes.slice(lows.length)];
      for (const n of notes) {
        const cls = n.m < SPLIT - 10 ? 0 : n.m < SPLIT + 10 ? 1 : 2;
        const a = (((n.m * 7) % 12) / 12) * TAU + R(-1, 1) * (1 - order) * 0.9;     // circle of fifths: a chord is a figure
        const r = (Math.max(0, n.m - 30) * 5.2 + 40) * spread + R(0, 1) * (1 - order) * 140;
        const vk = n.v / 100;
        const ex = fx + Math.cos(a) * r * 1.35, ey = fy + Math.sin(a) * r * 0.85 - (n.m - 60) * 1.5;
        const e = { cls, kind: 'shape', x: ex, y: ey, v: n.v, d: n.d, age: 0, life: life * (0.7 + 0.6 * vk), open: Math.random(), vx: 0, vy: 0, spin: R(-1, 1) * (1 - order) * 0.6 };
        if (cls === 0) {
          // a weight: a heavy black bar on a diagonal, its coloured shadow beside it
          const raw = R(-1.15, 1.15), snap = Math.round(raw / (Math.PI / 6)) * (Math.PI / 6);
          e.rot = lerp(raw, snap, order);
          e.s = Math.min(260, (110 + Math.max(0, 48 - n.m) * 4) * (n.k || 1) * scale * (0.65 + 0.5 * vk));
          e.th = Math.max(10, e.s * lerp(0.11, 0.16, clamp01(vk - 0.4)));
          e.tilt = R(0.2, 0.45) * (Math.random() < 0.5 ? -1 : 1); e.slide = R(-0.2, 0.2);
          e.col = WEIGHT[n.m % 3];
          if (n.v >= 92 && n.m < 44) {                // the loudest, deepest notes: sometimes a checker grid or a black sun
            const roll = Math.random();
            if (roll < 0.22) { e.kind = 'grid'; e.s = Math.min(96, 46 + (n.v - 92) * 2.2) * lerp(0.75, 1.15, paint); e.cells = 3; e.seed = Math.floor(Math.random() * 1e6); e.rot = lerp(R(-0.5, 0.5), 0, order); }
            else if (roll < 0.42) { e.kind = 'sun'; e.s = Math.min(120, 64 + (n.v - 92) * 2.5) * lerp(0.75, 1.15, paint); e.col = CORONA[n.m % 2]; e.rot = 0; }
          }
          e.vy = 16;
        } else {
          const reg = lerp(150, 44, clamp01((n.m - 30) / 55));
          e.s = Math.min(190, reg * scale * (0.55 + 0.75 * vk * vk));
          e.col = cls === 1 ? MID : HIGH;
          e.rot = cls === 2 ? lerp(R(0, TAU), a, order) : lerp(R(-0.8, 0.8), 0, order);
          // Kandinsky's directions: yellow pushes out, blue pulls in
          const ox = ex - x.W / 2, oy = ey - x.H / 2, od = Math.hypot(ox, oy) || 1;
          if (cls === 2) { e.vx = (ox / od) * 26; e.vy = (oy / od) * 26; } else { e.vx = (-ox / od) * 12; e.vy = (-oy / od) * 12; }
        }
        e.arc0 = R(0, TAU); e.arcR = (e.cls === 0 && e.kind === 'shape' ? e.s * 0.5 : e.s * 0.62) + 10;
        e.arc = cls !== 0 && n.d > 0.3 && Math.random() < 0.2 + 0.7 * L;
        els.push(e); born.push(e);
        rings.push({ e, age: 0 });
      }
      // constellation: the chord's notes joined low to high (and closed when lines are dense)
      for (let i = 0; i + 1 < born.length; i++) if (Math.random() < L) line(born[i], born[i + 1], 'c', life * 0.6, 1.2);
      if (born.length >= 3 && Math.random() < (L - 0.5) * 2) line(born[born.length - 1], born[0], 'c', life * 0.6, 1.2);
      // the melody: top notes joined in time
      const top = born[born.length - 1];
      if (lastTop && lastTop.age < lastTop.life && L > 0.08 && lastTop !== top) line(lastTop, top, 'm', life * 0.9, 1.3 + 2 * L);
      lastTop = top;
      // big chords: long straight lines across the canvas, snapped to a few directions when ordered
      if (ch.vel >= 92 && ch.notes.length >= 2 && crossCool <= 0 && L > 0.05) {
        const k = Math.max(1, Math.round(L * 2.4 * (ch.vel - 84) / 30));
        for (let i = 0; i < k; i++) {
          const raw = R(0, Math.PI), snap = Math.round(raw / (Math.PI / 4)) * (Math.PI / 4);
          lines.push({ kind: 'x', a: born[Math.floor(Math.random() * born.length)], ang: lerp(raw, snap, order) + R(-0.05, 0.05), age: 0, life: 1.8, w: 0.8 + (ch.vel - 90) * 0.08 });
        }
        crossCool = 0.5;
      }
      if (els.length > 170) els.splice(0, els.length - 170);
      if (lines.length > 160) lines.splice(0, lines.length - 160);
    },
    frame(x) {
      const g = x.g, dt = x.dt;
      const { sharp, hollow, drift, paint } = knobs(x);
      const stageAlpha = g.globalAlpha;
      const fillA = lerp(0.5, 0.9, paint);
      crossCool -= dt; planeCool -= dt;
      // the painting slowly turns about the centre: each living form orbits by this frame's step
      // (new forms are always born upright, so nothing turns upside down over a long piece)
      const dth = dt * drift * 0.05, co = Math.cos(dth), si = Math.sin(dth);
      const cx = x.W / 2, cy = x.H / 2;
      const orbit = (o) => { const ox = o.x - cx, oy = o.y - cy; o.x = cx + ox * co - oy * si; o.y = cy + ox * si + oy * co; };
      for (const e of els) {
        e.age += dt;
        e.x += e.vx * drift * dt * 2; e.y += e.vy * drift * dt * 2;
        e.rot += e.spin * dt * (0.3 + drift) + dth;
        orbit(e);
      }
      for (const p of planes) { orbit(p); p.rot += dth; }
      for (const l of lines) if (l.kind === 'x') l.ang += dth;
      const fade = (e) => Math.pow(Math.max(0, 1 - e.age / e.life), 1.3);
      // the fields, far behind
      for (const p of planes) {
        p.age += dt; const f = Math.pow(Math.max(0, 1 - p.age / p.life), 1.5) * Math.min(1, p.age / 0.4);
        const r = p.r * (1 + 0.08 * Math.min(1, p.age / 2));
        g.fillStyle = `rgba(${rgb(p.col)},${p.a * f})`;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath();
        if (p.sq) g.rect(-r, -r * 0.7, r * 2, r * 1.4); else g.arc(0, 0, r, 0, TAU);
        g.fill(); g.restore();
      }
      planes = planes.filter((p) => p.age < p.life);

      // lines behind the shapes
      g.lineCap = 'round';
      for (const l of lines) {
        l.age += dt;
        const f = Math.max(0, 1 - l.age / l.life);
        if (l.kind === 'x') {
          const grow = Math.min(1, l.age / 0.35), len = 1700 * (1 - Math.pow(1 - grow, 3)), dx = Math.cos(l.ang), dy = Math.sin(l.ang);
          const fl = Math.max(0, 1 - l.age / 0.25);
          g.strokeStyle = `rgba(${CREAM},${0.6 * Math.pow(f, 1.5)})`; g.lineWidth = l.w * (1 + 1.6 * fl);
          g.beginPath(); g.moveTo(l.a.x - dx * len, l.a.y - dy * len); g.lineTo(l.a.x + dx * len, l.a.y + dy * len); g.stroke();
          continue;
        }
        const grow = Math.min(1, l.age / (l.kind === 'm' ? 0.45 : 0.3)), k = 1 - Math.pow(1 - grow, 2);
        const al = (l.kind === 'm' ? 0.75 : 0.4) * f * Math.min(fade(l.a), fade(l.b)) ** 0.5;
        if (al < 0.01) continue;
        g.strokeStyle = `rgba(${CREAM},${al})`; g.lineWidth = l.w;
        g.beginPath(); g.moveTo(l.a.x, l.a.y); g.lineTo(lerp(l.a.x, l.b.x, k), lerp(l.a.y, l.b.y, k)); g.stroke();
      }
      lines = lines.filter((l) => l.age < l.life);

      // shapes, oldest first
      g.lineJoin = 'round';
      for (const e of els) {
        const al = fade(e); if (al < 0.01) continue;
        const land = Math.max(0, 1 - e.age / 0.5), kk = 1 + 0.35 * land * land * land;
        const flash = Math.pow(Math.max(0, 1 - e.age / 0.3), 2) * 0.5 * Math.min(1, e.v / 100);
        const c = rgb(e.col.map((v) => lerp(v, 255, flash)));
        const hol = e.open < hollow;                   // 'rings' = the share of shapes drawn as outlines
        g.save(); g.translate(e.x, e.y); g.rotate(e.rot);
        if (e.kind === 'sun') {                        // a black sun with a thin coloured corona
          path(g, e, 1.22 * kk, sharp); g.fillStyle = `rgba(${c},${al * fillA * 0.8})`; g.fill();
          path(g, e, 0.98 * kk, sharp); g.fillStyle = `rgba(${INK},${Math.min(1, al * 1.3)})`; g.fill();
        } else if (e.kind === 'grid') {                // a small checker grid in the painting's colours
          const n = e.cells, s = e.s * kk, cs = s / n, rr = ICON_RNG(e.seed);
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            const dark = (i + j) % 2 === 0, pick = rr();
            const col = dark ? INK : rgb(pick < 0.4 ? e.col : pick < 0.7 ? MID : pick < 0.9 ? HIGH : [238, 230, 212]);
            g.fillStyle = `rgba(${col},${al * (dark ? 1 : fillA)})`; g.fillRect(-s / 2 + i * cs, -s / 2 + j * cs, cs + 0.5, cs + 0.5);
          }
          g.strokeStyle = `rgba(${CREAM},${al * 0.5})`; g.lineWidth = 1; path(g, e, kk, sharp); g.stroke();
        } else if (e.cls === 0) {                      // a black bar with its coloured shadow beside it
          // the shadow: a shorter, wider plane of colour, turned a little against the bar, which crosses it
          const pw = e.s * 0.58 * kk, ph = e.th * 2.6 * kk;
          g.save(); g.translate(e.s * e.slide, 0); g.rotate(e.tilt);
          poly(g, [[-pw / 2, -ph / 2], [pw / 2, -ph / 2], [pw / 2, ph / 2], [-pw / 2, ph / 2]], ph * 0.5 * Math.pow(1 - sharp, 2.4));
          if (hol) { g.strokeStyle = `rgba(${c},${al * 0.85})`; g.lineWidth = 1.8; g.stroke(); }
          else { g.fillStyle = `rgba(${c},${al * fillA * 0.8})`; g.fill(); }
          g.restore();
          path(g, e, kk, sharp); g.fillStyle = `rgba(${INK},${al * 0.95})`; g.fill();
          g.strokeStyle = `rgba(${CREAM},${al * (0.35 + 0.5 * flash / 0.5)})`; g.lineWidth = 1; g.stroke();
        } else {
          if (!hol) { path(g, e, kk, sharp); g.fillStyle = `rgba(${c},${al * fillA})`; g.fill(); }
          else {
            g.strokeStyle = `rgba(${c},${al})`; g.lineWidth = 1.4 + e.s * 0.03;
            path(g, e, kk, sharp); g.stroke();
            if (e.open < hollow * 0.6) {               // echoes inside, like Kandinsky's concentric rings
              g.lineWidth = 1 + e.s * 0.018;
              g.strokeStyle = `rgba(${c},${al * 0.65})`; path(g, e, kk * 0.62, sharp); g.stroke();
              g.strokeStyle = `rgba(${c},${al * 0.4})`; path(g, e, kk * 0.28, sharp); g.stroke();
            }
          }
        }
        g.restore();
        // a held note draws an arc around its shape while it sounds
        if (e.arc) {
          const sweep = Math.min(TAU * 0.9, Math.min(e.age, e.d) * 2.6);
          g.strokeStyle = `rgba(${CREAM},${0.6 * al})`; g.lineWidth = 1.4;
          g.beginPath(); g.arc(e.x, e.y, e.arcR, e.arc0, e.arc0 + sweep); g.stroke();
        }
      }
      els = els.filter((e) => e.age < e.life);

      // the attack: an outline that springs out of each new shape
      for (const r of rings) {
        r.age += dt; const f = Math.max(0, 1 - r.age / 0.5); if (f <= 0) continue;
        const e = r.e;
        g.save(); g.translate(e.x, e.y); g.rotate(e.rot);
        g.strokeStyle = `rgba(${CREAM},${0.5 * f * f})`; g.lineWidth = 1 + 1.5 * f;
        path(g, e, 1.1 + 0.7 * (1 - f), sharp); g.stroke();
        g.restore();
      }
      rings = rings.filter((r) => r.age < 0.5);
      g.globalAlpha = stageAlpha;
    },
  });
  // seeded random for the checker grids (same colours every frame)
  function ICON_RNG(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
})();
