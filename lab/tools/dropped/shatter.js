// Shatter: loud chords crack the whole picture into glass shards that burst apart and fall away.
// Quieter notes leave hairline cracks (and medium ones small star chips) on a glass pane over the picture.
(() => {
  const W = 1280, H = 720, TAU = Math.PI * 2;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const pane = mk(), pg = pane.getContext('2d');           // persistent hairline cracks
  const pool = [mk(), mk(), mk(), mk()]; let poolI = 0;     // snapshots, one per live shatter
  const LX = -0.62, LY = -0.78;                              // light comes from the upper left
  let sets = [], hairs = [], specks = [], flashes = [], shake = 0, paneClock = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  // Where a chord hits: its top note sets left/right, its bass sets how low on the screen.
  const where = (ch) => ({
    x: W * (0.1 + 0.8 * clamp01((ch.hi - 48) / 49)) + rnd(-70, 70),
    y: H * (0.8 - 0.55 * clamp01((ch.lo - 25) / 40)) + rnd(-60, 60),
  });

  function shatter(ch, x) {
    const { x: cx, y: cy } = where(ch), force = Math.max(0, Math.min(1, (ch.vel - 96) / 18));
    const snap = pool[poolI++ % pool.length], sg = snap.getContext('2d');
    sg.clearRect(0, 0, W, H); sg.drawImage(x.canvas, 0, 0);
    sg.fillStyle = 'rgba(0,0,0,0.22)'; sg.fillRect(0, 0, W, H); // each break darkens what it breaks, so repeats don't wash out grey
    pg.clearRect(0, 0, W, H);                                // the cracked pane goes with the shards
    x.g.fillStyle = '#000'; x.g.fillRect(0, 0, W, H);        // the shards now ARE the picture
    // Spokes radiating from the impact, rings around it.
    const K = Math.min(16, 10 + Math.round(force * 5) + Math.min(3, ch.notes.length >> 1));
    const ang = [], base = rnd(0, TAU);
    for (let i = 0; i < K; i++) ang.push(base + (i + rnd(-0.32, 0.32)) * TAU / K);
    const RINGS = [0, 26, 70, 150, 270, 460, 780, 2200];
    const P = [], M = [];
    for (let i = 0; i < K; i++) {
      const row = [], mid = [], dx = Math.cos(ang[i]), dy = Math.sin(ang[i]);
      for (let j = 0; j < RINGS.length; j++) {
        const r = RINGS[j] * (j === 0 || j === RINGS.length - 1 ? 1 : rnd(0.72, 1.3));
        row.push([cx + dx * r, cy + dy * r]);
      }
      for (let j = 0; j < RINGS.length - 1; j++) {            // a kink in every radial crack, shared by both neighbours
        const a = row[j], b = row[j + 1], k = rnd(-0.12, 0.12) * Math.hypot(b[0] - a[0], b[1] - a[1]);
        mid.push([(a[0] + b[0]) / 2 - dy * k, (a[1] + b[1]) / 2 + dx * k]);
      }
      P.push(row); M.push(mid);
    }
    const shards = [];
    for (let i = 0; i < K; i++) {
      const i2 = (i + 1) % K;
      for (let j = 0; j < RINGS.length - 1; j++) {
        const pts = j === 0
          ? [P[i][0], M[i][0], P[i][1], P[i2][1], M[i2][0]]
          : [P[i][j], M[i][j], P[i][j + 1], P[i2][j + 1], M[i2][j], P[i2][j]];
        let mx = 0, my = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const [px, py] of pts) { mx += px; my += py; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
        if (x1 < 0 || y1 < 0 || x0 > W || y0 > H) continue;
        mx /= pts.length; my /= pts.length;
        const bx = Math.max(0, Math.floor(x0)), by = Math.max(0, Math.floor(y0));
        const bw = Math.min(W, Math.ceil(x1)) - bx, bh = Math.min(H, Math.ceil(y1)) - by;
        if (bw < 2 || bh < 2) continue;
        const d = Math.hypot(mx - cx, my - cy) || 1, ux = (mx - cx) / d, uy = (my - cy) / d;
        const near = Math.max(0, 1 - d / 700);
        const sp = (60 + 520 * near * near) * (0.75 + 0.6 * force) * rnd(0.7, 1.25);
        // Edges with outward normals (for catching the light).
        const edges = [];
        for (let e = 0; e < pts.length; e++) {
          const a = pts[e], b = pts[(e + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1;
          let nx = ey / L, ny = -ex / L;
          if (((a[0] + b[0]) / 2 - mx) * nx + ((a[1] + b[1]) / 2 - my) * ny < 0) { nx = -nx; ny = -ny; }
          edges.push(nx, ny);
        }
        shards.push({
          pts, edges, mx, my, bx, by, bw, bh,
          delay: 0.06 + d / 2600,                               // the crack runs outward before things move
          vx: ux * sp, vy: uy * sp - 80 * near, grav: 900 * (1.6 - 0.6 * near), prev: null, ox: 0, oy: 0,
          a: 0, va: rnd(-1, 1) * (0.4 + 3.2 * near), z: 0, vz: rnd(0.25, 0.7) + near * 0.9,
          ph: rnd(0, TAU),
        });
      }
    }
    sets.push({ snap, shards, cx, cy, age: 0, force, life: 2.1 });
    if (sets.length > 2) sets.shift();
    flashes.push({ x: cx, y: cy, age: 0, r: 120 + 160 * force });
    for (let i = 0; i < 36 + force * 40; i++) {
      const a = rnd(0, TAU), s = rnd(120, 900) * (0.6 + force);
      specks.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 150, age: 0, life: rnd(0.5, 1.4), ph: rnd(0, TAU), sz: rnd(1.2, 3.2) });
    }
    shake = Math.max(shake, 8 + 14 * force);
  }

  // A hairline: a crooked crack that creeps out over the length of the note.
  function hairline(n, ch, big) {
    const x0 = W * (0.06 + 0.88 * clamp01((n.m - 30) / 60)) + rnd(-50, 50), y0 = H * rnd(0.12, 0.88), arms = big ? 5 + (Math.random() * 4 | 0) : 2 + (Math.random() < 0.4);
    const len = 50 + n.v * (big ? 1.6 : 1.3);
    for (let k = 0; k < arms; k++) {
      let a = big ? (k + rnd(-0.3, 0.3)) * TAU / arms : rnd(0, TAU), px = x0 + rnd(-30, 30) * !big, py = y0 + rnd(-30, 30) * !big;
      const pts = [[px, py]], segs = 4 + (Math.random() * 4 | 0);
      for (let s = 0; s < segs; s++) { a += rnd(-0.3, 0.3) + (Math.random() < 0.2 ? rnd(-0.9, 0.9) : 0); const l = len / segs * rnd(0.6, 1.4); px += Math.cos(a) * l; py += Math.sin(a) * l; pts.push([px, py]); }
      hairs.push({ pts, drawn: 0, grow: Math.max(0.12, Math.min(big ? 0.35 : 1.6, n.d)), age: 0, v: n.v, big });
    }
    if (big) flashes.push({ x: x0, y: y0, age: 0, r: 40 + (n.v - 80) * 3, small: true });
  }

  TOOLS.push({
    id: 'shatter', name: 'Shatter',
    blurb: 'The loudest chords smash the whole picture like a pane of glass: it cracks from where the chord hits (its top note sets left or right, its bass how low), and the shards burst apart, glint and fall away. Medium chords chip small star cracks and quiet notes leave hairlines that creep out while the note sounds.',
    reset() { sets = []; hairs = []; specks = []; flashes = []; shake = 0; pg.clearRect(0, 0, W, H); },
    onChord(ch, x) {
      if (ch.vel >= 100 && ch.notes.length >= 2) return shatter(ch, x);
      const loud = ch.notes.reduce((b, n) => (n.v > b.v ? n : b), ch.notes[0]);
      hairline(loud, ch, ch.vel >= 86);
    },
    frame(x) {
      const g = x.g, dt = x.dt;
      // The pane: hairlines grow along their path and stay, slowly healing.
      paneClock += dt;
      if (paneClock > 0.5) { paneClock = 0; pg.globalCompositeOperation = 'destination-out'; pg.fillStyle = 'rgba(0,0,0,0.018)'; pg.fillRect(0, 0, W, H); pg.globalCompositeOperation = 'source-over'; }
      pg.lineCap = 'round'; pg.lineJoin = 'round';
      for (const h of hairs) {
        h.age += dt;
        const want = Math.min(1, h.age / h.grow) * (h.pts.length - 1);
        if (want > h.drawn) {
          pg.strokeStyle = h.big ? 'rgba(235,240,255,0.85)' : 'rgba(205,215,235,0.6)'; pg.lineWidth = h.big ? 1.4 : 0.9;
          pg.beginPath();
          const i0 = Math.floor(h.drawn), f0 = h.drawn - i0; let p = h.pts[i0], q = h.pts[Math.min(i0 + 1, h.pts.length - 1)];
          pg.moveTo(p[0] + (q[0] - p[0]) * f0, p[1] + (q[1] - p[1]) * f0);
          for (let i = i0 + 1; i <= Math.floor(want); i++) pg.lineTo(h.pts[i][0], h.pts[i][1]);
          const i1 = Math.floor(want), f1 = want - i1;
          if (i1 < h.pts.length - 1) { p = h.pts[i1]; q = h.pts[i1 + 1]; pg.lineTo(p[0] + (q[0] - p[0]) * f1, p[1] + (q[1] - p[1]) * f1); }
          pg.stroke(); h.drawn = want;
          h.tip = [h.pts[Math.min(Math.ceil(want), h.pts.length - 1)]];
        }
      }
      g.globalAlpha = 0.75; g.drawImage(pane, 0, 0); g.globalAlpha = 1;
      // The growing tips glint.
      g.globalCompositeOperation = 'lighter';
      for (const h of hairs) {
        if (h.age > h.grow + 0.15 || !h.tip) continue;
        const [tx, ty] = h.tip[0], al = 0.8 * Math.max(0, 1 - Math.max(0, h.age - h.grow) / 0.15) * (h.v / 100);
        g.fillStyle = `rgba(220,235,255,${al})`; g.beginPath(); g.arc(tx, ty, h.big ? 3 : 2, 0, TAU); g.fill();
      }
      hairs = hairs.filter((h) => h.age < h.grow + 0.2);
      g.globalCompositeOperation = 'source-over';

      // Shards.
      if (shake > 0.3) { g.translate(rnd(-shake, shake), rnd(-shake, shake)); shake *= Math.pow(0.82, dt * 60); }
      // Wipe where each shard was last frame, so moving glass leaves a clean dark hole instead of smeared echoes.
      g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineWidth = 4;
      for (const S of sets) for (const s of S.shards) {
        if (!s.prev) continue;
        const [qx, qy, qa, qs, qal] = s.prev;
        if (qal < 0.03) continue;
        g.save(); g.globalAlpha = Math.min(1, qal * 1.5); g.translate(qx, qy); g.rotate(qa); g.scale(qs, qs); g.translate(-s.mx, -s.my);
        g.beginPath(); g.moveTo(s.pts[0][0], s.pts[0][1]);
        for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i][0], s.pts[i][1]);
        g.closePath(); g.fill(); g.lineWidth = 4 / qs; g.stroke(); g.restore();
      }
      for (const S of sets) {
        S.age += dt;
        const fade = Math.min(1, Math.max(0, (S.life - S.age) / 0.9));
        const hot = Math.max(0, 1 - S.age / 0.22);
        for (const s of S.shards) {
          const t = S.age - s.delay;
          if (t > 0) {
            s.vy += s.grav * dt * Math.min(1, t * 2);
            s.ox += s.vx * dt; s.oy += s.vy * dt; s.a += s.va * dt; s.z += s.vz * dt;
          }
          const sc = 1 / (1 + s.z * 0.45);
          const px = s.mx + s.ox, py = s.my + s.oy;
          const r = 1600 * sc;   // generous bound: skip shards that have left the screen on any side
          if (py - r > H || px + r < 0 || px - r > W || py + r < 0) { s.prev = null; continue; }
          s.prev = [px, py, s.a, sc, fade * (0.55 + 0.45 * sc)];
          g.save();
          g.translate(px, py); g.rotate(s.a); g.scale(sc, sc); g.translate(-s.mx, -s.my);
          g.beginPath(); g.moveTo(s.pts[0][0], s.pts[0][1]);
          for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i][0], s.pts[i][1]);
          g.closePath();
          g.save(); g.clip();
          g.globalAlpha = fade * (0.55 + 0.45 * sc);
          g.drawImage(S.snap, s.bx, s.by, s.bw, s.bh, s.bx, s.by, s.bw, s.bh);
          // Glass face catches the light as it turns.
          const sheen = Math.pow(0.5 + 0.5 * Math.cos(s.a * 2.3 + s.ph), 10);
          g.globalAlpha = fade * (0.06 + 0.28 * sheen + 0.3 * hot); g.fillStyle = '#d8e6ff'; g.fill();
          g.restore();
          // Edges: the side facing the light gleams, the rest is a dark rim.
          // Edges: only the side(s) facing the light gleam, in one stroke; at the moment of impact every crack blazes.
          const ca = Math.cos(s.a), sa = Math.sin(s.a);
          g.lineWidth = (hot > 0 ? 2 : 1.6) / sc; g.lineJoin = 'round';
          if (hot > 0) { g.strokeStyle = `rgba(255,252,240,${hot})`; g.stroke(); }
          g.beginPath(); let best = 0;
          for (let e = 0; e < s.pts.length; e++) {
            const nx = s.edges[e * 2] * ca - s.edges[e * 2 + 1] * sa, ny = s.edges[e * 2] * sa + s.edges[e * 2 + 1] * ca;
            const lit = nx * LX + ny * LY;
            if (lit < 0.55) continue;
            const a = s.pts[e], b = s.pts[(e + 1) % s.pts.length];
            g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); best = Math.max(best, lit);
          }
          if (best > 0) { g.strokeStyle = `rgba(255,250,236,${fade * Math.pow(best, 4) * 0.95})`; g.stroke(); }
          g.restore();
        }
      }
      sets = sets.filter((S) => S.age < S.life);

      // Impact flash and flying splinters.
      g.globalCompositeOperation = 'lighter';
      for (const f of flashes) {
        f.age += dt; const k = Math.max(0, 1 - f.age / (f.small ? 0.2 : 0.35));
        const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (0.6 + 0.6 * (1 - k)));
        gr.addColorStop(0, `rgba(255,255,255,${0.9 * k})`); gr.addColorStop(0.25, `rgba(190,215,255,${0.45 * k})`); gr.addColorStop(1, 'rgba(120,160,255,0)');
        g.fillStyle = gr; g.fillRect(f.x - f.r * 1.3, f.y - f.r * 1.3, f.r * 2.6, f.r * 2.6);
      }
      flashes = flashes.filter((f) => f.age < 0.35);
      for (const p of specks) {
        p.age += dt; p.vy += 1100 * dt; p.vx *= Math.pow(0.4, dt); p.x += p.vx * dt; p.y += p.vy * dt; p.ph += dt * 18;
        const al = Math.max(0, 1 - p.age / p.life) * (0.35 + 0.65 * Math.abs(Math.sin(p.ph)));
        g.fillStyle = `rgba(235,242,255,${al})`;
        g.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
      }
      specks = specks.filter((p) => p.age < p.life);
    },
  });
})();
