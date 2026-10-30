// Kandinsky: notes compose an abstract painting. Low notes: red squares/bars (weight, they sink);
// middle: blue circles (concentric, they gather); high: yellow triangles (eccentric, they fly out).
// Velocity → size, held notes draw arcs, a chord is a constellation around a wandering focus,
// the melody is a line, and big chords throw long straight lines across the whole canvas.
(() => {
  const TAU = Math.PI * 2;
  let els = [], lines = [], rings = [], planes = [], lastTop = null, crossCool = 0, planeCool = 0, fx = 640, fy = 360, wx = 0, wy = 0;
  const R = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, k) => a + (b - a) * k;
  // [low, mid, high] colours for cool / Kandinsky / hot
  const PAL = [
    [[44, 52, 168], [36, 170, 205], [196, 240, 160]],
    [[218, 38, 34], [34, 80, 210], [250, 210, 36]],
    [[160, 10, 34], [246, 116, 26], [255, 238, 150]],
  ];
  const CREAM = '238,230,212';
  function colour(cls, w) {
    const k = Math.max(0, Math.min(2, w * 2)), i = Math.min(1, Math.floor(k)), f = k - i;
    return PAL[i][cls].map((c, j) => lerp(c, PAL[i + 1][cls][j], f));
  }
  // a polygon with rounded corners (rr = 0: sharp)
  function poly(g, pts, rr) {
    g.beginPath();
    if (rr < 0.5) { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); return; }
    const n = pts.length, m0 = [(pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2];
    g.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; g.arcTo(p[0], p[1], q[0], q[1], rr); }
    g.closePath();
  }
  // the shape's outline at scale s; sharp 0 = soft and round, 1 = bars, lenses and needles
  function path(g, e, s, sharp) {
    if (e.dark || e.cls === 1) { g.beginPath(); g.ellipse(0, 0, s / 2, (s / 2) * (e.dark ? 1 : 1 - sharp * 0.62), 0, 0, TAU); return; }
    if (e.cls === 0) {
      const w = s * (1 + sharp * 1.3), h = s * (1 - sharp * 0.74), rr = Math.min(w, h) * 0.5 * Math.pow(1 - sharp, 2.4);
      poly(g, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], rr);
    } else {
      const b = s * (1.1 - sharp * 0.85), h = s * (0.9 + sharp * 0.9), rr = s * 0.2 * Math.pow(1 - sharp, 2);
      poly(g, [[h * 0.62, 0], [-h * 0.38, -b / 2], [-h * 0.38, b / 2]], rr);   // points along +x
    }
  }
  function line(a, b, kind, life, w) { lines.push({ a, b, kind, life, w, age: 0 }); }

  TOOLS.push({
    id: 'kandinsky', name: 'Kandinsky', tag: 'new',
    blurb: 'The notes paint a Kandinsky: low notes red squares that sink, middle notes blue circles, high notes yellow triangles that fly outward. Loud notes are bigger, held notes draw arcs, chords become constellations, the melody is a line, and big chords throw long lines across the canvas.',
    params: [
      { key: 'sharp', label: 'sharpness', min: 0, max: 1, value: 0.3, drive: '+level' },
      { key: 'hollow', label: 'outlines', min: 0, max: 1, value: 0.6, drive: '-level' },
      { key: 'warmth', label: 'colour temp', min: 0, max: 1, value: 0.5 },
      { key: 'centre', label: 'register split', min: 46, max: 76, step: 1, value: 58 },
      { key: 'blend', label: 'overlap', min: 0, max: 2, step: 1, value: 0 },
      { key: 'lines', label: 'lines', min: 0, max: 1, value: 0.55 },
      { key: 'gravity', label: 'gravity', min: -1, max: 1, value: 0, drive: '-rate' },
      { key: 'order', label: 'order', min: 0, max: 1, value: 0.55 },
      { key: 'drift', label: 'drift', min: 0, max: 1, value: 0.25, drive: '+rate' },
      { key: 'decay', label: 'lasts (s)', min: 1, max: 12, value: 6, drive: '-density' },
    ],
    reset() { els = []; lines = []; rings = []; planes = []; lastTop = null; crossCool = 0; planeCool = 0; fx = 640; fy = 360; wx = 0; wy = 0; },
    onChord(ch, x) {
      const order = x.p('order'), grav = x.p('gravity'), dyn = 0.6, L = x.p('lines'), life = x.p('decay'), c0 = x.p('centre');
      // the focus wanders over the canvas on its own slow path; gravity keeps it home or sends it to the edges
      const roam = Math.max(0.03, Math.min(0.3, 0.17 - 0.13 * grav)), T = x.t;
      fx = x.W / 2 + x.W * roam * (0.75 * Math.sin(T * 0.071) + 0.25 * Math.sin(T * 0.23 + 1.3));
      fy = x.H / 2 + x.H * roam * (0.7 * Math.sin(T * 0.053 + 2.1) + 0.3 * Math.sin(T * 0.19));
      // plus a little step per chord, so repeated chords don't stamp the same spot
      wx = wx * 0.85 + R(-1, 1) * 70 * (1.2 - order); wy = wy * 0.85 + R(-1, 1) * 45 * (1.2 - order);
      fx += wx; fy += wy;
      fx = Math.max(x.W * 0.25, Math.min(x.W * 0.75, fx)); fy = Math.max(x.H * 0.32, Math.min(x.H * 0.62, fy));
      // the lowest loud note lays a huge faint plane of colour behind everything (Kandinsky's fields)
      if (ch.lo < c0 - 6 && ch.vel >= 80 && planeCool <= 0) {
        planeCool = 1.2;
        planes.push({ x: fx + R(-1, 1) * 120 * (1 - order), y: fy + R(-1, 1) * 80, r: (200 + (ch.vel - 80) * 9) * (1.1 - 0.3 * grav), age: 0, life: life * 1.3, col: colour(Math.random() < 0.6 ? 0 : 1, x.p('warmth')), sq: Math.random() < 0.15 + 0.4 * x.p('sharp'), rot: lerp(R(-0.6, 0.6), 0, order) });
        if (planes.length > 3) planes.shift();
      }
      const spread = 1.15 - 0.45 * grav;
      const born = [];
      let notes = [...ch.notes].sort((a, b) => a.m - b.m);
      // the bass of a chord is one weight, not a pile: its low notes merge into a single, bigger form
      const lows = notes.filter((n) => n.m < c0 - 10);
      if (lows.length > 1) notes = [{ ...lows[0], v: Math.max(...lows.map((n) => n.v)), k: 1 + 0.18 * (lows.length - 1) }, ...notes.slice(lows.length)];
      for (const n of notes) {
        const cls = n.m < c0 - 10 ? 0 : n.m < c0 + 10 ? 1 : 2;
        const a = (((n.m * 7) % 12) / 12) * TAU + R(-1, 1) * (1 - order) * 0.9;     // circle of fifths: a chord is a figure
        const r = (Math.max(0, n.m - 30) * 5.2 + 40) * spread + R(0, 1) * (1 - order) * 140;
        const vk = n.v / 100, reg = lerp(170, 46, Math.max(0, Math.min(1, (n.m - 30) / 55)));
        const s = Math.min(300, reg * (n.k || 1) * (n === notes[0] && notes.length > 1 ? 1.25 : 1) * (1 - dyn + dyn * 1.8 * vk * vk));
        const ex = fx + Math.cos(a) * r * 1.35, ey = fy + Math.sin(a) * r * 0.85 - (n.m - 60) * 1.5;
        const dark = cls === 0 && n.v >= 92 && n.m < 44 && Math.random() < 0.5;
        const e = {
          cls, dark, x: ex, y: ey, s, v: n.v, d: n.d, age: 0, life: life * (0.7 + 0.6 * vk), col: colour(cls, x.p('warmth')),
          rot: cls === 2 ? lerp(R(0, TAU), a, order) : lerp(R(-0.8, 0.8), 0, order), spin: R(-1, 1) * (1 - order) * 0.6,
          arc0: R(0, TAU), arcR: s * 0.62 + 10, open: Math.random(), arc: n.d > 0.3 && Math.random() < 0.25 + 0.75 * L,
          vx: 0, vy: 0,
        };
        // Kandinsky's directions: yellow pushes out, blue pulls in, red has weight
        const ox = ex - x.W / 2, oy = ey - x.H / 2, od = Math.hypot(ox, oy) || 1;
        if (cls === 2) { e.vx = (ox / od) * 26; e.vy = (oy / od) * 26; }
        else if (cls === 1) { e.vx = (-ox / od) * 12; e.vy = (-oy / od) * 12; }
        else { e.vy = 16; }
        els.push(e); born.push(e);
        rings.push({ e, age: 0 });
      }
      // constellation: the chord's notes joined low to high (and closed when lines are dense)
      for (let i = 0; i + 1 < born.length; i++) if (Math.random() < L) line(born[i], born[i + 1], 'c', life * 0.6, 1.4);
      if (born.length >= 3 && Math.random() < (L - 0.5) * 2) line(born[born.length - 1], born[0], 'c', life * 0.6, 1.4);
      // the melody: top notes joined in time
      const top = born[born.length - 1];
      if (lastTop && lastTop.age < lastTop.life && L > 0.08 && lastTop !== top) line(lastTop, top, 'm', life * 0.9, 1.6 + 2.4 * L);
      lastTop = top;
      // big chords: long straight lines across the canvas, snapped to a few directions when ordered
      if (ch.vel >= 90 && ch.notes.length >= 2 && crossCool <= 0) {
        const k = Math.max(1, Math.round(L * 3 * (ch.vel - 80) / 30));
        for (let i = 0; i < k; i++) {
          const raw = R(0, Math.PI), snap = Math.round(raw / (Math.PI / 4)) * (Math.PI / 4);
          lines.push({ kind: 'x', a: born[Math.floor(Math.random() * born.length)], ang: lerp(raw, snap, order) + R(-0.05, 0.05), age: 0, life: 2.2, w: 1 + (ch.vel - 88) * 0.12 });
        }
        crossCool = 0.3;
      }
      if (els.length > 240) els.splice(0, els.length - 240);
      if (lines.length > 220) lines.splice(0, lines.length - 220);
    },
    frame(x) {
      const g = x.g, dt = x.dt;
      const sharp = x.p('sharp'), hollow = x.p('hollow'), drift = x.p('drift');
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
        p.age += dt; const f = Math.pow(Math.max(0, 1 - p.age / p.life), 1.5) * Math.min(1, p.age / 0.25);
        const r = p.r * (1 + 0.08 * Math.min(1, p.age / 2));
        g.fillStyle = `rgba(${p.col.map(Math.round).join(',')},${0.07 * f})`;   // ~0.35 once the shared fade settles
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath();
        if (p.sq) g.rect(-r, -r * 0.8, r * 2, r * 1.6); else g.arc(0, 0, r, 0, TAU);
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
          g.strokeStyle = `rgba(${CREAM},${0.85 * Math.pow(f, 1.5)})`; g.lineWidth = l.w * (1 + 2.5 * fl);
          g.beginPath(); g.moveTo(l.a.x - dx * len, l.a.y - dy * len); g.lineTo(l.a.x + dx * len, l.a.y + dy * len); g.stroke();
          continue;
        }
        const grow = Math.min(1, l.age / (l.kind === 'm' ? 0.45 : 0.3)), k = 1 - Math.pow(1 - grow, 2);
        const al = (l.kind === 'm' ? 0.85 : 0.45) * f * Math.min(fade(l.a), fade(l.b)) ** 0.5;
        if (al < 0.01) continue;
        g.strokeStyle = `rgba(${CREAM},${al})`; g.lineWidth = l.w;
        g.beginPath(); g.moveTo(l.a.x, l.a.y); g.lineTo(lerp(l.a.x, l.b.x, k), lerp(l.a.y, l.b.y, k)); g.stroke();
      }
      lines = lines.filter((l) => l.age < l.life);

      // shapes, oldest first; overlaps can paint over, add light, or invert (Bauhaus transparency)
      const blend = Math.round(x.p('blend'));
      g.globalCompositeOperation = ['source-over', 'screen', 'difference'][blend];
      for (const e of els) {
        const al = fade(e); if (al < 0.01) continue;
        const land = Math.max(0, 1 - e.age / 0.5), k = 1 + 0.45 * land * land * land;
        const flash = Math.pow(Math.max(0, 1 - e.age / 0.35), 2) * 0.75 * Math.min(1, e.v / 100);
        const c = e.col.map((v) => Math.round(lerp(v, 255, flash))).join(',');
        const s = e.s * k;
        g.save(); g.translate(e.x, e.y); g.rotate(e.rot);
        const hol = e.open < hollow, solid = hol ? 0 : 1;   // 'hollow' = the share of shapes drawn as outlines
        if (e.dark) {                                     // a black sun with a coloured corona
          path(g, e, s * 1.25, sharp); g.fillStyle = `rgba(${c},${al * 0.9})`; g.fill();
          path(g, e, s * 0.9, sharp); g.fillStyle = `rgba(4,3,6,${Math.min(1, al * 1.4)})`; g.fill();
        } else {
          if (solid > 0.02) { path(g, e, s, sharp); g.fillStyle = `rgba(${c},${al * (0.15 + 0.8 * solid)})`; g.fill(); }
          const st = hol ? 1 : 0;
          if (st > 0.02) {
            g.strokeStyle = `rgba(${c},${al * st})`; g.lineWidth = 1.5 + s * 0.035; g.lineJoin = 'round';
            path(g, e, s, sharp); g.stroke();
            if (e.open < hollow * 0.6) {                  // echoes inside, like Kandinsky's concentric rings
              const ek = 1; g.lineWidth = 1 + s * 0.02;
              g.strokeStyle = `rgba(${c},${al * ek * 0.7})`; path(g, e, s * 0.62, sharp); g.stroke();
              g.strokeStyle = `rgba(${c},${al * ek * 0.45})`; path(g, e, s * 0.28, sharp); g.stroke();
            }
          }
        }
        g.restore();
        // a held note draws an arc around its shape while it sounds
        if (e.arc) {
          const sweep = Math.min(TAU * 0.9, Math.min(e.age, e.d) * 2.6);
          g.strokeStyle = `rgba(${CREAM},${0.75 * al})`; g.lineWidth = 1.6;
          g.beginPath(); g.arc(e.x, e.y, e.arcR, e.arc0, e.arc0 + sweep); g.stroke();
        }
      }
      els = els.filter((e) => e.age < e.life);
      g.globalCompositeOperation = 'source-over';

      // the attack: an outline that springs out of each new shape
      for (const r of rings) {
        r.age += dt; const f = Math.max(0, 1 - r.age / 0.55); if (f <= 0) continue;
        const e = r.e;
        g.save(); g.translate(e.x, e.y); g.rotate(e.rot);
        g.strokeStyle = `rgba(${CREAM},${0.7 * f * f})`; g.lineWidth = 1 + 2 * f;
        path(g, e, e.s * (1.1 + 0.9 * (1 - f)), sharp); g.stroke();
        g.restore();
      }
      rings = rings.filter((r) => r.age < 0.55);
    },
  });
})();
