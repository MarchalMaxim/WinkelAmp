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
// v2, so that the music reads: low notes carry a standing weight (broad slabs) and high ones a negative one (small chips);
// every attack swells its cell by its loudness (neighbours give way, then it settles) and lights a kernel inside it, an
// inset copy of the cell that flashes pale and wide on the attack, shrinks while the note sounds and is gone when it ends.
// A loud attack also sends a ring of light out through the mosaic: each cell's seams (and the ground's dark wash) catch it
// as the ring passes their centre, so the wave steps from cell to cell.
// A sixth knob, how present (2026-11-01, "can only boost, not tone down"): turned down, the whole mosaic is laid on faintly so
// what's under it shows, the sway and the attacks calm, cells close sooner, and only the piece's hardest notes open a cell.
(() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (k) => k * k * (3 - 2 * k);
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
  const MAXN = 40, NGROUND = 12, SPLIT_T = 0.38, MERGE_T = 0.7, GLOW = 1.1;
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
      const hx = x.W * (0.12 + (i % 4) * 0.25) + x.rnd(-60, 60), hy = x.H * (0.18 + Math.floor(i / 4) * 0.32) + x.rnd(-40, 40);
      s.push({ ground: true, x: hx, y: hy, hx, hy, w: 0 });
    }
    return s;
  }

  let seeds = [], hit = 0, polys = [], row = 0.3, tint = [40, 30, 34], waves = [];
  const WAVE_V = 760, WAVE_W = 90, WAVE_R = 1500;   // ripple speed (px/s), ring width, how far it travels
  const poly = (g, pts) => { g.beginPath(); pts.forEach(([a, b], k) => (k ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); };

  // how present (0..1). Below 1 the mosaic is painted just as it is at 1, but on its own canvas with the stage's own fade
  // (its wash is what keeps moving borders from smearing), and that canvas goes on the stage at low alpha.
  let lay = null, lg = null, layOn = false;
  function sheet(x) {
    const cv = x.g.canvas;
    if (!lay || lay.width !== cv.width || lay.height !== cv.height) {
      lay = document.createElement('canvas'); lay.width = cv.width; lay.height = cv.height; lg = lay.getContext('2d');
      lg.setTransform(cv.width / x.W, 0, 0, cv.height / x.H, 0, 0); layOn = false;
    }
    if (!layOn) { lg.drawImage(cv, 0, 0, x.W, x.H); layOn = true; }   // starts from what the stage shows, so touching the slider doesn't flicker
    else {
      lg.fillStyle = 'rgba(0,0,0,0.12)'; lg.fillRect(0, 0, x.W, x.H);
      lg.globalCompositeOperation = 'color-burn'; lg.fillStyle = 'rgb(252,252,252)'; lg.fillRect(0, 0, x.W, x.H);
      lg.globalCompositeOperation = 'source-over';
    }
    return lg;
  }
  // Which notes open a cell, judged against this piece's own notes (recordings differ a lot in how hard they are played):
  // every one at 1, the hardest 40% at 0.4, the hardest 5% at 0. A quiet stretch would stay empty for minutes, so when
  // nothing has answered for a while (5.5 s at 0, less higher up) the next chord's strongest note does.
  let vels = null, lastAns = -99;
  const hardEnough = (v, pres) => {
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= (1 - pres) * 0.95;
  };

  // the inset copy of a polygon, k of the way from its centre (0 = a point, 1 = the polygon)
  function inset(P, k) {
    const n = P.length >> 1; let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += P[2 * i]; cy += P[2 * i + 1]; }
    cx /= n; cy /= n; const Q = new Array(P.length);
    for (let i = 0; i < n; i++) { Q[2 * i] = cx + (P[2 * i] - cx) * k; Q[2 * i + 1] = cy + (P[2 * i + 1] - cy) * k; }
    return Q;
  }

  TOOLS.push({
    id: 'cells', name: 'Cells', tag: 'v2',
    blurb: 'A mosaic of coloured cells, one per note, left to right by pitch and coloured by the harmony (warm at home, cool far away). New in v2: bass notes make broad slabs and high notes small chips, each attack swells its cell and flashes a pale kernel that shrinks while the note sounds, and loud attacks send a ring of light through the mosaic. <b>How present</b> sets how much mosaic builds up: turned down, cells close as soon as their notes end and the rest is dark ground.',
    params: [
      { key: 'edge', label: 'how hard attacks land', min: 0, max: 2, value: 1, drive: '+level',
        hint: 'How strongly each struck note shows. Left: cells just appear, with thin seams. Right: a struck cell swells, its borders go thick and black, and loud ones send a ring of light through the mosaic.',
        icon: (g, v, w, h) => {
          const P = [[[1, 1], [21, 1], [16, 15], [1, 19]], [[21, 1], [39, 1], [39, 13], [16, 15]], [[1, 19], [16, 15], [39, 13], [39, 25], [1, 25]]];
          ['#2f5a9e', '#ddaa45', '#c8432b'].forEach((c, i) => { g.fillStyle = c; poly(g, P[i]); g.fill(); });
          const k = 0.15 + v * 0.45, cx = 28.7, cy = 7.5;
          g.fillStyle = ICON.lerp('#e8c77a', '#fbf3e2', v); poly(g, P[1].map(([a, b]) => [cx + (a - cx) * k, cy + (b - cy) * k])); g.fill();
          g.strokeStyle = ICON.lerp('#9a8f84', '#050406', Math.min(1, v * 1.6)); g.lineWidth = 0.8 + v * 4.4;
          P.forEach((pts) => { poly(g, pts); g.stroke(); });
        } },
      { key: 'stay', label: 'how long cells linger', min: 0, max: 5, value: 2, less: 0,
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
      { key: 'howmuch', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much mosaic builds up: how long cells linger after their note before they close into their neighbours. Sounding notes always hold a cell open. Left: cells close as soon as the note ends, the rest is dark ground. Right: they linger for seconds and fill the picture. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
      { key: 'presence', label: 'old: how faint', old: true, min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: nearly dark and still; only the hardest notes (in a quiet stretch, one now and then) open a faint cell. Right: every note opens one at full colour (as before).',
        icon: (g, v, w, h) => {
          const P = [[[21, 1], [39, 1], [39, 13], [16, 15]], [[1, 1], [21, 1], [16, 15], [1, 19]], [[1, 19], [16, 15], [39, 13], [39, 25], [1, 25]]];
          ICON.alpha(g, 0.15 + 0.85 * v, () => ['#ddaa45', '#2f5a9e', '#c8432b'].forEach((c, i) => {
            if (i > 2 * v + 0.2) return;          // more tiles open the further right
            g.fillStyle = c; poly(g, P[i]); g.fill();
          }));
        } },
    ],
    reset(x) { study(); seeds = ground(x); hit = 0; T = 0; polys = []; row = 0.3; waves = []; lay = null; layOn = false; lastAns = -99; },
    onChord(ch, x) {
      study();
      const pres = x.p('presence');
      let notes = ch.notes;
      if (pres < 1) {
        notes = notes.filter((n) => hardEnough(n.v, pres));
        if (!notes.length && x.t - lastAns >= 0.5 + 5 * (1 - pres)) notes = [ch.notes.reduce((a, b) => (b.v > a.v ? b : a))];
        if (notes.length) lastAns = x.t;
      }
      if (notes.length) hit = Math.max(hit, (ch.vel / 115) * pres);
      row = (row + 0.618034) % 1;                       // each chord on a new row
      const head = x.H * (0.1 + 0.8 * row);
      let wx = 0, wy = 0, wn = 0, wc = [0, 0, 0];
      for (const n of notes) {
        const end = ch.t + Math.max(0.3, n.d), pulse = clamp(n.v / 110, 0.25, 1.15);
        // the same key struck again while its cell is still open: that cell flares instead of a new one being made
        const same = seeds.find((s) => !s.ground && !s.dying && !s.close && s.m === n.m);
        if (same) {
          same.end = Math.max(same.end, end); same.pulse = Math.max(same.pulse, pulse); same.lit = 0;
          same.kern = Math.max(same.kern, 0.45 + 0.4 * clamp(pulse));
          wx += same.x; wy += same.y; wn++; wc = mix(wc, same.col, 1 / wn); continue;
        }
        const reg = clamp((n.m - pLo) / (pHi - pLo));
        const hx = x.W * (0.05 + 0.9 * reg) + x.rnd(-24, 24);
        const hy = clamp(head + x.rnd(-0.06, 0.06) * x.H - (n.m - ch.lo) * 1.6, x.H * 0.05, x.H * 0.95);
        const col = noteColour(n.m, n.v);
        // it buds at its own place inside the cell it lands in (very low weight = no area yet) and grows, splitting that cell;
        // its grown weight comes from its register: bass notes broad, treble notes small
        seeds.push({ m: n.m, x: hx, y: hy, hx, hy, w: -45000, born: 0, end, pulse, lit: 0, col, c: col, dying: 0, into: null,
          size: (0.45 - reg) * 22000, sz: (0.45 - reg) * 22000, sw: 0, kern: 0.45 + 0.4 * clamp(pulse), w0: 0, echo: 0 });
        wx += hx; wy += hy; wn++; wc = mix(wc, col, 1 / wn);
      }
      // a loud attack sends a ring of light out from where it landed (soft ones make none)
      const amp = clamp((ch.vel - 55) / 55) ** 1.4 * pres;
      if (wn && amp > 0.02) { waves.push({ x: wx / wn, y: wy / wn, r: 0, amp, col: wc, seam: mix(wc, [252, 246, 234], 0.6) }); if (waves.length > 8) waves.shift(); }
      const open = seeds.filter((s) => !s.ground && !s.dying);   // too many open cells: the oldest close first
      for (let i = 0; i < open.length - MAXN; i++) open[i].close = true;
    },
    frame(x) {
      const pres = x.p('presence'); if (pres >= 1) layOn = false; else if (x.dt <= 0) return;
      const g = pres < 1 ? sheet(x) : x.g, dt = x.dt; if (!seeds.length) seeds = ground(x);
      const drift = x.p('drift') * pres, stay = x.p('stay') * (1 - 0.6 * (1 - pres)), pebble = x.p('pebble'), fill = x.p('fill'), edge = x.p('edge');
      T += dt * (0.4 + drift);
      hit *= Math.pow(0.5, dt / 0.16);
      for (const wv of waves) wv.r += WAVE_V * dt;
      waves = waves.filter((wv) => wv.r < WAVE_R);
      let loud = null; for (const wv of waves) if (!loud || wv.amp * (1 - wv.r / WAVE_R) > loud.amp * (1 - loud.r / WAVE_R)) loud = wv;
      // ---- life: bud, grow, swell on the attack, settle, outlive the note, close
      let tr = 0, tg = 0, tb = 0, tw = 0;
      const swK = (Math.min(1, edge) * 16000 + Math.max(0, edge - 1) * 10000) * pres;   // how far an attack shoves its neighbours
      for (const s of seeds) {
        // the ring of light: how lit this cell is as a wave passes its centre
        let e = 0;
        for (const wv of waves) { const d = Math.hypot(s.x - wv.x, s.y - wv.y) - wv.r; e = Math.max(e, wv.amp * Math.exp(-(d * d) / (WAVE_W * WAVE_W)) * (1 - wv.r / WAVE_R)); }
        s.echo = Math.min(1, e * Math.min(1, edge));
        if (!s.ground) {
          s.pulse *= Math.pow(0.5, dt / 0.22); s.lit += dt;
          s.sw += (clamp(s.pulse) - s.sw) * (1 - Math.pow(0.5, dt / 0.035));     // a quick rise, then it follows the pulse down
          const sounding = x.t < s.end;
          s.kern += ((sounding ? 0.34 : 0) - s.kern) * (1 - Math.pow(0.5, dt / (sounding ? 0.25 : 0.18)));   // settles while it sounds, gone when it ends
          if (!s.dying && (s.close || x.t >= s.end + stay)) {
            s.dying = 1e-6; s.w0 = s.w; let bd = Infinity;     // it closes up; the nearest open neighbour's colour washes over it
            for (const o of seeds) { if (o === s || o.dying || o.ground) continue; const d = (o.x - s.x) ** 2 + (o.y - s.y) ** 2; if (d < bd) { bd = d; s.into = o; } }
          }
          if (s.dying) {
            s.dying = Math.min(1, s.dying + dt / MERGE_T); const k = ease(s.dying);
            s.w = s.w0 * (1 - k) - k * k * 90000; s.c = mix(s.col, s.into ? s.into.c : tint, k * 0.7);
          } else {
            s.born = Math.min(1, s.born + dt / SPLIT_T); const k = ease(s.born);
            s.sz += (s.size * (sounding ? 1 : 0.6) - s.sz) * (1 - Math.pow(0.5, dt / 0.25));   // eases down when the note ends (no jump)
            s.w = -(1 - k) * (1 - k) * 45000 + k * (s.sz + swK * s.sw * s.sw);
          }
          const wt = s.dying ? 0 : (sounding ? 1 : 0.35) * (0.4 + Math.exp(-s.lit / GLOW));
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
      // the ground: a very dark wash of the harmony's colour, its seams barely there, both catching the passing ring of light
      const base = mix(tint, [4, 3, 5], 0.86), lift = loud ? mix(loud.col, base, 0.3) : base, seam = loud ? loud.seam : [238, 230, 212];
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i], P = polys[i]; if (!s.ground || !P) continue;
        path(g, P, round);
        g.fillStyle = css(s.echo > 0.01 ? mix(base, lift, 0.45 * s.echo) : base, 0.78); g.fill();   // nearly opaque: no smears
        g.strokeStyle = css(mix([238, 230, 212], seam, s.echo), 0.03 + 0.05 * hit + 0.75 * s.echo); g.lineWidth = 1 + 3 * s.echo; g.stroke();
      }
      // the notes: every fill first, then the kernels, then every border (so no neighbour's fill hides half a border);
      // flaring borders last, on top
      const order = [], wash = 0.6 * clamp((0.25 - fill) / 0.25);   // outlined: a black wash clears the trails moving lines leave
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i], P = polys[i]; if (s.ground || !P) continue;
        order.push(i);
        if (wash > 0.01) { path(g, P, round); g.fillStyle = css([0, 0, 0], wash); g.fill(); }
        if (fill < 0.01) continue;
        const sounding = x.t < s.end ? 1 : 0, life = s.dying ? 1 - ease(s.dying) : 1;   // a closing cell fades as it shrinks (no smear)
        path(g, P, round);
        g.fillStyle = css(mix(s.c, [250, 244, 232], 0.18 * clamp(s.pulse) + 0.2 * s.echo), fill * life * (0.42 + 0.5 * Math.exp(-s.lit / GLOW)) * (0.55 + 0.45 * sounding));
        g.fill();
      }
      for (const i of order) {
        // the kernel: an inset copy of the cell, pale and wide on the attack, shrinking while the note sounds
        const s = seeds[i]; if (s.kern < 0.03) continue;
        // an ended note's kernel stops shrinking at a fifth of the cell and fades there (no pale specks left behind)
        const life = (s.dying ? 1 - ease(s.dying) : 1) * clamp(s.kern / 0.22) ** 2, flare = clamp(s.pulse);
        // outlined (no fill to cover its old place): a moving stroke would leave stacked trails, so it stays put and only brightens
        const k = fill >= 0.5 ? Math.min(0.86, Math.max(0.22, s.kern) + 0.35 * flare * Math.min(1, edge)) : 0.42;
        path(g, inset(polys[i], k), round * k);
        const kc = mix(s.c, [252, 246, 234], 0.3 + 0.55 * flare);
        if (fill >= 0.5) { g.fillStyle = css(kc, life * clamp(0.35 + 0.6 * flare + s.kern)); g.fill(); }
        else { g.strokeStyle = css(kc, life * clamp(0.4 + 0.6 * flare)); g.lineWidth = 1.2 + 2 * flare; g.stroke(); }
      }
      order.sort((a, b) => seeds[a].pulse - seeds[b].pulse);
      for (const i of order) {
        // the border: at rest a darker shade of the cell (its own colour when outlined); an attack drives it thick and black;
        // the passing ring of light pales it
        const s = seeds[i], life = s.dying ? 1 - ease(s.dying) : 1, bright = Math.exp(-s.lit / GLOW), flare = clamp(s.pulse) * pres;
        const dark = clamp(edge * (0.8 * flare + 0.35 * hit));
        const rest = fill > 0.5 ? mix(s.c, INK, 0.45) : mix(s.c, [255, 255, 255], 0.15);
        path(g, polys[i], round);
        g.strokeStyle = css(mix(mix(rest, INK, dark * fill), [250, 242, 226], 0.6 * s.echo * (1 - dark)), life * (0.45 + 0.55 * Math.max(bright * 0.7, dark, 1 - fill, s.echo)));
        g.lineWidth = 1.2 + (1 - fill) * 1.3 + edge * (7 * flare + 2.5 * hit) + 2 * s.echo;
        g.stroke();
      }
      if (pres < 1) {
        // laid on so that about s of the full picture shows when alone, and k of what the stage held stays: all of it at 0,
        // from the middle up the 22% the wash lets through at 1. A black wash takes the rest; the stage's slow fade alone would stack moving cells in trails.
        const s = 0.5 + 0.5 * pres * pres, k = Math.max((1 - pres) ** 2, 0.22), a = s * (1 - 0.88 * k), cover = 1 - k / (1 - a);
        if (cover > 0) { x.g.fillStyle = `rgba(0,0,0,${cover})`; x.g.fillRect(0, 0, x.W, x.H); }
        x.g.globalAlpha = a; x.g.drawImage(lay, 0, 0, x.W, x.H); x.g.globalAlpha = 1;
      }
    },
  });
})();
