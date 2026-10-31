// Cells: an abstract mosaic of Voronoi cells, one per note. A note's cell sits left to right by pitch (over the song's
// own range), and each chord lands on a new row (a golden-ratio step, so rows spread evenly over the picture).
// Colour comes from the harmony: a note's place on the circle of fifths, measured from the piece's home key, picks a
// colour from a painter's ring (tonic vermilion, dominant side orange and ochre, subdominant side crimson and plum, far
// side blue), so the home chord is warm and music far from home turns the mosaic cool. Low notes are deep, high ones pale.
// A new note buds inside the cell it lands in and splits it; when a note ends its cell dims, waits a little, then closes
// up into its neighbours. Attacks thicken and darken the borders; the whole mosaic drifts on a slow current.
// Geometry: a power diagram (Voronoi with weights), each cell clipped from the frame by its neighbours' bisectors. The
// weights make splitting and closing continuous: a cell is born with a very low weight (no area) and grows, and dies the
// same way. A few empty "ground" cells, washed in a very dark tint of the harmony, keep a structure on screen in silence.
(() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (k) => k * k * (3 - 2 * k);
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
  const MAXN = 40, NGROUND = 9, SPLIT_T = 0.38, MERGE_T = 0.7, GLOW = 1.1;
  const INK = [10, 8, 12];

  // ---- harmony → colour
  const RING = ['#c8432b', '#d9782c', '#ddaa45', '#93953f', '#4d8a5d', '#2e7a83', '#2f5a9e', '#3d3f94', '#6545a0', '#8c3d7e', '#ad3954', '#b9503a']
    .map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const fifthsOf = (m) => ((m % 12) * 7) % 12;
  let home = null, pLo = 30, pHi = 90;
  function study() {                                   // the home key and the song's real pitch range, once per song
    if (home != null) return;
    const N = window.NOTES || []; let cx = 0, cy = 0; const ms = [];
    for (const [s, e, m, v] of N) { const w = Math.min(4, e - s) * v, a = (fifthsOf(m) / 12) * TAU; cx += Math.cos(a) * w; cy += Math.sin(a) * w; ms.push(m); }
    home = cx || cy ? ((Math.atan2(cy, cx) / TAU) * 12 + 12) % 12 : 0;
    ms.sort((a, b) => a - b); if (ms.length > 20) { pLo = ms[Math.floor(ms.length * 0.03)] - 2; pHi = ms[Math.floor(ms.length * 0.97)] + 2; }
  }
  function noteColour(m, v) {
    const f = ((fifthsOf(m) - home) % 12 + 12) % 12, i = Math.floor(f), k = f - i;
    const c = mix(RING[i], RING[(i + 1) % 12], k), reg = clamp((m - pLo) / (pHi - pLo));
    const lit = reg < 0.45 ? mix(c, [6, 5, 8], (0.45 - reg) * 0.9) : mix(c, [244, 236, 220], (reg - 0.45) * 0.55);
    return mix(lit, [128, 120, 116], 0.18 * (1 - clamp(v / 100)));   // soft notes are a little greyer
  }

  // ---- geometry: clip a convex polygon (flat [x0,y0,x1,y1,…]) to a·p <= c
  function clip(P, ax, ay, c) {
    const n = P.length >> 1; if (!n) return P;
    const out = [];
    let px = P[2 * n - 2], py = P[2 * n - 1], pin = ax * px + ay * py <= c;
    for (let i = 0; i < n; i++) {
      const x = P[2 * i], y = P[2 * i + 1], inn = ax * x + ay * y <= c;
      if (inn !== pin) { const dp = ax * px + ay * py - c, dq = ax * x + ay * y - c, k = dp / (dp - dq); out.push(px + (x - px) * k, py + (y - py) * k); }
      if (inn) out.push(x, y);
      px = x; py = y; pin = inn;
    }
    return out;
  }
  // every seed's cell in the power diagram; gap = pixels kept open between neighbours
  function cellsOf(list, W, H, gap) {
    const res = [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      let P = [-2, -2, W + 2, -2, W + 2, H + 2, -2, H + 2];
      for (let j = 0; j < list.length && P.length; j++) {
        if (j === i) continue;
        const q = list[j], ax = 2 * (q.x - p.x), ay = 2 * (q.y - p.y);
        const c = q.x * q.x + q.y * q.y - p.x * p.x - p.y * p.y + p.w - q.w, len = Math.hypot(ax, ay);
        if (len < 1e-6) { if (c < 0 || (c === 0 && j < i)) P = []; continue; }
        P = clip(P, ax, ay, c - len * gap * 0.5);
      }
      res.push(P.length >= 6 ? P : null);
    }
    return res;
  }
  // a polygon path with rounded corners (radius clamped so neighbouring arcs never overlap)
  function path(g, P, r) {
    const n = P.length >> 1;
    g.beginPath();
    if (r < 0.5) { g.moveTo(P[0], P[1]); for (let i = 1; i < n; i++) g.lineTo(P[2 * i], P[2 * i + 1]); g.closePath(); return; }
    const L = []; for (let i = 0; i < n; i++) { const j = (i + 1) % n; L.push(Math.hypot(P[2 * j] - P[2 * i], P[2 * j + 1] - P[2 * i + 1])); }
    g.moveTo((P[0] + P[2 * n - 2]) / 2, (P[1] + P[2 * n - 1]) / 2);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, h = (i + n - 1) % n;
      const ux = P[2 * h] - P[2 * i], uy = P[2 * h + 1] - P[2 * i + 1], vx = P[2 * j] - P[2 * i], vy = P[2 * j + 1] - P[2 * i + 1];
      const cos = (ux * vx + uy * vy) / ((L[h] * L[i]) || 1), half = Math.acos(clamp(cos, -1, 1)) / 2;
      g.arcTo(P[2 * i], P[2 * i + 1], P[2 * j], P[2 * j + 1], Math.max(0, Math.min(r, 0.5 * Math.min(L[h], L[i]) * Math.tan(half))));
    }
    g.closePath();
  }

  // the drift: a slow, smooth current over the picture (pixels per second at drift 1)
  let T = 0;
  const flowX = (x, y) => 26 * (Math.sin(y * 0.0062 + T * 0.31) + 0.6 * Math.sin(x * 0.0041 - T * 0.23 + 2.1));
  const flowY = (x, y) => 20 * (Math.cos(x * 0.0053 + T * 0.27) + 0.6 * Math.cos(y * 0.0071 + T * 0.19 + 1.3));

  function ground(x) {
    const s = [];
    for (let i = 0; i < NGROUND; i++) {
      const hx = x.W * (0.17 + (i % 3) * 0.33) + x.rnd(-60, 60), hy = x.H * (0.18 + Math.floor(i / 3) * 0.32) + x.rnd(-40, 40);
      s.push({ ground: true, x: hx, y: hy, hx, hy, w: 0 });
    }
    return s;
  }

  let seeds = [], hit = 0, polys = [], row = 0.3, tint = [40, 30, 34];
  const poly = (g, pts) => { g.beginPath(); pts.forEach(([a, b], k) => (k ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); };

  TOOLS.push({
    id: 'cells', name: 'Cells', tag: 'new',
    blurb: 'A mosaic of coloured cells, one per note: left to right by pitch, each chord on a new row, coloured by the harmony (warm at home, cool far away). A new note splits a cell off, an ended note’s cell closes up, attacks darken the borders, and it all drifts.',
    params: [
      { key: 'edge', label: 'borders on each attack', min: 0, max: 2, value: 1, drive: '+level',
        hint: 'How much the borders between cells thicken and darken when notes are struck. Left: thin, quiet seams. Right: heavy black lines on every attack.',
        icon: (g, v, w, h) => {
          const P = [[[1, 1], [21, 1], [16, 15], [1, 19]], [[21, 1], [39, 1], [39, 13], [16, 15]], [[1, 19], [16, 15], [39, 13], [39, 25], [1, 25]]];
          ['#2f5a9e', '#ddaa45', '#c8432b'].forEach((c, i) => { g.fillStyle = c; poly(g, P[i]); g.fill(); });
          g.strokeStyle = ICON.lerp('#9a8f84', '#050406', Math.min(1, v * 1.6)); g.lineWidth = 0.8 + v * 4.4;
          P.forEach((pts) => { poly(g, pts); g.stroke(); });
        } },
      { key: 'stay', label: 'how long cells linger', min: 0, max: 5, value: 2,
        hint: 'When a note ends its cell dims, waits, then closes up into its neighbours. Left: it closes the moment the note ends. Right: it lingers for seconds, so the mosaic fills up.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.12 + v * 0.88, ICON.gold) },
      { key: 'pebble', label: 'mosaic or pebbles', min: 0, max: 1, value: 0.25,
        hint: 'The shape of the cells. Left: a tight mosaic of sharp-cornered tiles. Right: separate rounded pebbles with dark gaps between them.',
        icon: (g, v, w, h) => {
          const gap = 0.6 + v * 4.4, r = v * 6, cw = (w - 2 - gap) / 2, ch = (h - 2 - gap) / 2;
          ['#2f5a9e', '#ddaa45', '#c8432b', '#6545a0'].forEach((c, i) => {
            const x = 1 + (i % 2) * (cw + gap), y = 1 + (i >> 1) * (ch + gap); g.fillStyle = c; g.beginPath();
            if (g.roundRect) g.roundRect(x, y, cw, ch, r); else g.rect(x, y, cw, ch); g.fill();
          });
        } },
      { key: 'drift', label: 'drift', min: 0, max: 2, value: 0.6, drive: '+rate',
        hint: 'How much the whole mosaic sways and flows. Left: cells stay where the notes put them. Right: everything floats on a slow current.',
        icon: (g, v, w, h) => ICON.trail(g, 0.08 + v * 0.92, w, h, ICON.blue) },
      { key: 'fill', label: 'solid or outlined', min: 0, max: 1, value: 0.85,
        hint: 'How the cells are painted. Left: only their outlines, like a line drawing. Right: solid blocks of colour.',
        icon: (g, v, w, h) => {
          poly(g, [[8, 3], [28, 2], [36, 13], [29, 24], [10, 23], [4, 13]]);
          g.globalAlpha = v; g.fillStyle = '#6545a0'; g.fill(); g.globalAlpha = 1;
          g.strokeStyle = ICON.lerp('#b9a0e0', '#6545a0', v); g.lineWidth = 1.8; g.stroke();
        } },
    ],
    reset(x) { study(); seeds = ground(x); hit = 0; T = 0; polys = []; row = 0.3; },
    onChord(ch, x) {
      study();
      hit = Math.max(hit, ch.vel / 115);
      row = (row + 0.618034) % 1;                       // each chord on a new row
      const head = x.H * (0.1 + 0.8 * row);
      for (const n of ch.notes) {
        const end = ch.t + Math.max(0.3, n.d), pulse = clamp(n.v / 110, 0.25, 1.15);
        // the same key struck again while its cell is still open: that cell flares instead of a new one being made
        const same = seeds.find((s) => !s.ground && !s.dying && !s.close && s.m === n.m);
        if (same) { same.end = Math.max(same.end, end); same.pulse = Math.max(same.pulse, pulse); same.lit = 0; continue; }
        const hx = x.W * (0.05 + 0.9 * clamp((n.m - pLo) / (pHi - pLo))) + x.rnd(-24, 24);
        const hy = clamp(head + x.rnd(-0.06, 0.06) * x.H - (n.m - ch.lo) * 1.6, x.H * 0.05, x.H * 0.95);
        const col = noteColour(n.m, n.v);
        // it buds at its own place inside the cell it lands in (very low weight = no area yet) and grows, splitting that cell
        seeds.push({ m: n.m, x: hx, y: hy, hx, hy, w: -45000, born: 0, end, pulse, lit: 0, col, c: col, dying: 0, into: null });
      }
      const open = seeds.filter((s) => !s.ground && !s.dying);   // too many open cells: the oldest close first
      for (let i = 0; i < open.length - MAXN; i++) open[i].close = true;
    },
    frame(x) {
      const g = x.g, dt = x.dt; if (!seeds.length) seeds = ground(x);
      const drift = x.p('drift'), stay = x.p('stay'), pebble = x.p('pebble'), fill = x.p('fill'), edge = x.p('edge');
      T += dt * (0.4 + drift);
      hit *= Math.pow(0.5, dt / 0.16);
      // ---- life: bud, grow, flare, settle, outlive the note, close
      let tr = 0, tg = 0, tb = 0, tw = 0;
      for (const s of seeds) {
        if (!s.ground) {
          s.pulse *= Math.pow(0.5, dt / 0.22); s.lit += dt;
          if (!s.dying && (s.close || x.t >= s.end + stay)) {
            s.dying = 1e-6; let bd = Infinity;     // it closes up; the nearest open neighbour's colour washes over it
            for (const o of seeds) { if (o === s || o.dying || o.ground) continue; const d = (o.x - s.x) ** 2 + (o.y - s.y) ** 2; if (d < bd) { bd = d; s.into = o; } }
          }
          if (s.dying) {
            s.dying = Math.min(1, s.dying + dt / MERGE_T); const k = ease(s.dying);
            s.w = -k * k * 90000; s.c = mix(s.col, s.into ? s.into.c : tint, k * 0.7);
          } else {
            s.born = Math.min(1, s.born + dt / SPLIT_T); const k = ease(s.born);
            s.w = -(1 - k) * (1 - k) * 45000;
          }
          const wt = s.dying ? 0 : (x.t < s.end ? 1 : 0.35) * (0.4 + Math.exp(-s.lit / GLOW));
          tr += s.col[0] * wt; tg += s.col[1] * wt; tb += s.col[2] * wt; tw += wt;
        }
        const kk = s.ground ? 0.35 : 0.6;          // drift on the current, held loosely to home
        s.x += (drift * flowX(s.x, s.y) + (s.hx - s.x) * kk) * dt;
        s.y += (drift * flowY(s.x, s.y) + (s.hy - s.y) * kk) * dt;
      }
      seeds = seeds.filter((s) => !(s.dying >= 1));
      if (tw > 0) tint = mix(tint, [tr / tw, tg / tw, tb / tw], 1 - Math.pow(0.5, dt / 1.5));
      // ---- cells
      const gap = pebble * 16, round = pebble * 34;
      polys = cellsOf(seeds, x.W, x.H, gap);
      g.lineJoin = 'round';
      // the ground: a very dark wash of the harmony's colour, its seams barely there
      g.fillStyle = css(mix(tint, [4, 3, 5], 0.86), 0.78);   // nearly opaque: moving and closing cells leave no smears g.strokeStyle = `rgba(238,230,212,${(0.025 + 0.05 * hit).toFixed(3)})`; g.lineWidth = 1;
      for (let i = 0; i < seeds.length; i++) if (seeds[i].ground && polys[i]) { path(g, polys[i], round); g.fill(); g.stroke(); }
      // the notes: every fill first, then every border (so no neighbour's fill hides half a border); flaring borders last, on top
      const order = [];
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i], P = polys[i]; if (s.ground || !P) continue;
        order.push(i);
        if (fill < 0.01) continue;
        const sounding = x.t < s.end ? 1 : 0, life = s.dying ? 1 - ease(s.dying) : 1;   // a closing cell fades as it shrinks (no smear)
        path(g, P, round);
        g.fillStyle = css(mix(s.c, [250, 244, 232], 0.3 * clamp(s.pulse)), fill * life * (0.42 + 0.5 * Math.exp(-s.lit / GLOW)) * (0.55 + 0.45 * sounding));
        g.fill();
      }
      order.sort((a, b) => seeds[a].pulse - seeds[b].pulse);
      for (const i of order) {
        // the border: at rest a darker shade of the cell (its own colour when outlined); an attack drives it thick and black
        const s = seeds[i], life = s.dying ? 1 - ease(s.dying) : 1, bright = Math.exp(-s.lit / GLOW), flare = clamp(s.pulse);
        const dark = clamp(edge * (0.8 * flare + 0.35 * hit));
        const rest = fill > 0.5 ? mix(s.c, INK, 0.45) : mix(s.c, [255, 255, 255], 0.15);
        path(g, polys[i], round);
        g.strokeStyle = css(mix(rest, INK, dark * fill), life * (0.45 + 0.55 * Math.max(bright * 0.7, dark, 1 - fill)));
        g.lineWidth = 1.2 + (1 - fill) * 1.3 + edge * (7 * flare + 2.5 * hit);
        g.stroke();
      }
    },
  });
})();
