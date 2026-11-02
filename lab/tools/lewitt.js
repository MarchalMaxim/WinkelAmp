// LeWitt: after Sol LeWitt's wall drawings. The wall is a pale plaster plane, the notes are points on a fixed lattice
// (left to right by pitch, one row per note name), and every attack carries out the current rule in fine coloured-pencil
// lines: lines from the four corners to the points, lines through them in four directions, arcs from the corners
// through them, a square of parallel lines per note, lines from the midpoints of the sides, a chain joining each note to
// the ones before, lines from the centre and their mirror images. The lines are never erased; they pile up into a dense,
// systematic drawing (the same note retraces the same lines, so they darken). A new section of the music starts a fresh
// wall with the next rule, and the rule is written on the wall in pencil, as LeWitt's instructions are.
// A sixth knob, how present (the user, 2026-11-01: the sliders should dim, not only boost): turned down, the wall and all
// that is on it fade together, letting through what lies under the wall, and only the hardest notes draw, fewer lines, slower.
(() => {
  const TAU = Math.PI * 2;
  const WALL = '#e9e6df';
  // coloured pencil: graphite, red, blue, yellow (LeWitt's four)
  const PENCIL = [[58, 58, 64], [196, 46, 40], [36, 78, 170], [222, 170, 10]];
  const RULES = [
    { id: 'corners', text: 'Lines from the four corners to the notes.' },
    { id: 'through', text: 'Lines through the notes in four directions, from wall to wall.' },
    { id: 'arcs', text: 'Arcs from the four corners, through the notes.' },
    { id: 'squares', text: 'A square of parallel lines for every note, in one of four directions.' },
    { id: 'sides', text: 'Lines from the midpoints of the four sides to the notes.' },
    { id: 'chain', text: 'Straight lines joining every note to the notes before it.' },
    { id: 'centre', text: 'Lines from the centre to the notes, and to their mirror images.' },
  ];
  const COLS = 9, ROWS = 5;            // the squares rule's grid
  let cur = null, prev = null, dimmed = null, prevA = 0, active = [], commits = [], flashes = [], hits = new Map();
  let rule = 0, autoRule = 0, lastMoment = null, lastSwitch = -9, lastAttack = -1, strokes = 0, lastPts = [], caption = 0, W = 1280, H = 720;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
  // how present (0..1): which notes draw, judged against this piece's own notes (recordings differ a lot in how hard they
  // play): every one at 1, the hardest 40% at 0.4, the hardest 5% at 0
  let allVels = null;
  const hardEnough = (v, pres) => {
    const cut = (1 - pres) * 0.95;
    if (cut <= 0) return true;
    if (!allVels) allVels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!allVels.length) return true;
    let a = 0, b = allVels.length; while (a < b) { const k = (a + b) >> 1; if (allVels[k] < v) a = k + 1; else b = k; }
    return a / allVels.length >= cut;
  };
  // how present: how strongly the picture is laid over the stage each frame. The stage keeps most of the last frame (it only
  // fades 12% a frame), so a translucent picture builds up to far more than its alpha: alpha 0.14 settles near half brightness.
  // Dark lines need some wall to show on: 0.026 keeps a wall under a tenth as bright with the lines still readable on it.
  const showAlpha = (pres) => 0.026 + 0.974 * pres * pres * pres;

  function buffers(x) {
    if (cur && cur.width === x.W && cur.height === x.H) return;
    W = x.W; H = x.H;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    cur = mk(); prev = mk(); dimmed = null;
  }
  // a fresh wall: the drawing so far fades out underneath
  function newWall() {
    // lines still being drawn finish on the old wall, so a wall carries only its own rule
    if (active.length) { const c = cur.getContext('2d'); c.globalCompositeOperation = 'multiply'; c.lineCap = 'round'; for (const s of active) { c.strokeStyle = rgba(s.col, s.al); c.lineWidth = s.lw; c.beginPath(); pathOf(c, s, 1); c.stroke(); } active = []; }
    const t = prev; prev = cur; cur = t;
    cur.getContext('2d').clearRect(0, 0, W, H);
    prevA = 1; strokes = 0; lastPts = []; hits.clear();
    caption = 0;
  }
  // the point of a note on the wall's lattice: left to right by pitch, one row per note name (C at the bottom). The same
  // note struck again steps a few pixels aside, as a drafter rules the next line beside the last: repeated notes lay down
  // bands of parallel lines (and concentric arcs) instead of retracing one line.
  function point(m) {
    const px = 48 + ((clamp(m, 24, 103) - 24) / 79) * (W - 96);
    const pc = ((m % 12) + 12) % 12, h = hits.get(m) ?? 0, o = (h % 14) * 3.4 + (Math.floor(h / 14) % 2) * 1.7;   // the next pass rules between the last
    hits.set(m, h + 1);
    return [px + o * 0.94, H - 70 - (pc / 11) * (H - 150) + o * 0.33];
  }
  // the part of the line through (px,py) along (dx,dy) that lies inside the box [x0,y0,x1,y1]
  function clip(px, py, dx, dy, x0, y0, x1, y1) {
    let t0 = -1e9, t1 = 1e9;
    const sl = (p, d, a, b) => { if (Math.abs(d) < 1e-9) return p >= a && p <= b; let u = (a - p) / d, v = (b - p) / d; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); return true; };
    if (!sl(px, dx, x0, x1) || !sl(py, dy, y0, y1) || t1 <= t0) return null;
    return [px + dx * t0, py + dy * t0, px + dx * t1, py + dy * t1];
  }
  const DIRS = [[0, 1], [1, 0], [Math.SQRT1_2, -Math.SQRT1_2], [Math.SQRT1_2, Math.SQRT1_2]];   // vertical, horizontal, /, \

  // strokes: 'L' grows from (x1,y1) to (x2,y2); 'M' grows from its middle (mx,my) out to both ends; 'A' an arc that grows
  // from angle a0 out to a1 and a2
  function add(s, col, lw, alpha, delay) {
    const len = s.k === 'A' ? s.r * Math.abs(s.a2 - s.a1) : Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    s.col = col; s.lw = lw; s.al = alpha; s.age = -delay; s.dur = 0.1 + Math.min(1, len / 5200) * 0.9 * 0.5;
    active.push(s);
  }
  const L = (x1, y1, x2, y2) => ({ k: 'L', x1, y1, x2, y2 });
  const M = (mx, my, x1, y1, x2, y2) => ({ k: 'M', mx, my, x1, y1, x2, y2 });
  function pathOf(g, s, u) {
    if (s.k === 'L') { g.moveTo(s.x1, s.y1); g.lineTo(s.x1 + (s.x2 - s.x1) * u, s.y1 + (s.y2 - s.y1) * u); }
    else if (s.k === 'M') { g.moveTo(s.mx + (s.x1 - s.mx) * u, s.my + (s.y1 - s.my) * u); g.lineTo(s.mx + (s.x2 - s.mx) * u, s.my + (s.y2 - s.my) * u); }
    else { const b = s.a0 + (s.a1 - s.a0) * u, e = s.a0 + (s.a2 - s.a0) * u; g.moveTo(s.cx + s.r * Math.cos(b), s.cy + s.r * Math.sin(b)); g.arc(s.cx, s.cy, s.r, b, e, e < b); }
  }

  // the rule, carried out for one attack
  function carry(ch, x) {
    const pres = x.p('presence');
    const k = Math.max(1, Math.round(Math.round(x.p('lines')) * pres)), weight = x.p('pencil'), ncol = 1 + Math.round(x.p('colours') * 3);
    const col = (i) => PENCIL[i % ncol];
    const lw = 0.5 + weight * 1.6, al = 0.4 + weight * 0.3;
    const notes = ch.notes.filter((n) => hardEnough(n.v, pres)).sort((a, b) => a.m - b.m);
    const pts = notes.map((n) => point(n.m));
    const id = RULES[rule].id;
    let d = 0, cap = 90;
    const push = (s, c, delay) => { if (cap-- > 0) { add(s, c, lw * (0.85 + 0.3 * ch.vel / 110), al, delay); s.dur *= 3 - 2 * pres; } };
    notes.forEach((n, ni) => {
      const [px, py] = pts[ni], dl = ni * 0.018;
      flashes.push({ x: px, y: py, age: 0, v: n.v });
      if (id === 'corners' || id === 'sides' || id === 'arcs') {
        const anchors = id === 'sides' ? [[W / 2, 0], [W, H / 2], [W / 2, H], [0, H / 2]] : [[0, 0], [W, 0], [W, H], [0, H]];
        // the farthest anchors first, so the lines cross the wall
        const order = anchors.map((a, i) => [Math.hypot(a[0] - px, a[1] - py), i]).sort((a, b) => b[0] - a[0]).slice(0, k);
        order.forEach(([r, i], j) => {
          const [ax, ay] = anchors[i];
          if (id === 'arcs') {
            const q = [[0, TAU / 4], [TAU / 4, TAU / 2], [TAU / 2, TAU * 0.75], [TAU * 0.75, TAU]][i];
            let a0 = Math.atan2(py - ay, px - ax); while (a0 < q[0] - 0.01) a0 += TAU; while (a0 > q[1] + 0.01) a0 -= TAU;
            push({ k: 'A', cx: ax, cy: ay, r, a0, a1: q[0], a2: q[1] }, col(i), dl + j * 0.01);
          } else push(L(px, py, ax, ay), col(i), dl + j * 0.01);
        });
      } else if (id === 'through') {
        // the note's name picks the first direction; more lines per note add the others
        for (let j = 0; j < k; j++) {
          const di = (n.m + j) % 4, [dx, dy] = DIRS[di], c = clip(px, py, dx, dy, 0, 0, W, H);
          if (c) push(M(px, py, c[0], c[1], c[2], c[3]), col(di), dl + j * 0.01);
        }
      } else if (id === 'squares') {
        const cw = W / COLS, chh = H / ROWS, ci = clamp(Math.floor(px / cw), 0, COLS - 1), cj = clamp(Math.floor(py / chh), 0, ROWS - 1);
        const x0 = ci * cw + 6, y0 = cj * chh + 6, x1 = x0 + cw - 12, y1 = y0 + chh - 12, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const di = n.m % 4, [dx, dy] = DIRS[di], nx = -dy, ny = dx;
        const cnt = 5 + 4 * k, span = (di < 2 ? Math.max(cw, chh) / 2 : (cw + chh) / 2 / Math.SQRT2 * 1.0) - 6;
        for (let j = 0; j < cnt; j++) {
          const o = -span + (2 * span * (j + 0.5)) / cnt, c = clip(cx + nx * o, cy + ny * o, dx, dy, x0, y0, x1, y1);
          if (c) push(Object.assign(L(c[0], c[1], c[2], c[3]), { n: 0.25 }), col(di), dl + j * 0.012);   // short lines: a square counts as a few lines
        }
      } else if (id === 'centre') {
        const mir = [[px, py], [W - px, py], [px, H - py], [W - px, H - py]];
        for (let j = 0; j < k; j++) push(L(W / 2, H / 2, mir[j][0], mir[j][1]), col(j), dl + j * 0.01);
      } else if (id === 'chain') {
        const reg = clamp(Math.floor((n.m - 24) / 20), 0, 3);
        if (!lastPts.length) lastPts.push([px, H], [0, py]);   // a fresh wall: the chain starts from the floor and the left side
        lastPts.slice(-k).forEach(([qx, qy], j) => { if (Math.hypot(qx - px, qy - py) > 2) push(L(px, py, qx, qy), col(reg), dl + j * 0.01); });
        if (ni > 0) push(L(px, py, pts[ni - 1][0], pts[ni - 1][1]), col(reg), dl);
      }
    });
    if (id === 'chain') { for (const p of pts) lastPts.push(p); if (lastPts.length > 12) lastPts.splice(0, lastPts.length - 12); }
    if (active.length > 900) { commits.push(...active.splice(0, active.length - 900)); }
  }

  // the knob pictures: a little wall with the rule drawn on it
  const PEN = PENCIL.map((c) => `rgb(${c})`);
  function wallIcon(g, w, h) { ICON.rect(g, 2, 2, w - 4, h - 4, '#e9e6df'); }
  function ruleIcon(g, id, w, h, lw = 0.9) {
    const x0 = 2, y0 = 2, x1 = w - 2, y1 = h - 2, P = [[13, 15], [22, 9], [29, 17]];
    g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    const ln = (a, b, c, d, col) => ICON.line(g, a, b, c, d, col, lw);
    if (id === 'corners') P.forEach(([px, py]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([ax, ay], i) => ln(px, py, ax, ay, PEN[i])));
    else if (id === 'sides') P.forEach(([px, py]) => [[w / 2, y0], [x1, h / 2], [w / 2, y1], [x0, h / 2]].forEach(([ax, ay], i) => ln(px, py, ax, ay, PEN[i])));
    else if (id === 'centre') P.forEach(([px, py], i) => { ln(w / 2, h / 2, px, py, PEN[i]); ln(w / 2, h / 2, w - px, h - py, PEN[i]); });
    else if (id === 'arcs') P.forEach(([px, py], i) => { [[x0, y0], [x1, y1]].forEach(([ax, ay], j) => ICON.ring(g, ax, ay, Math.hypot(px - ax, py - ay), PEN[(i + j) % 4], lw)); });
    else if (id === 'through') P.forEach(([px, py], i) => { const [dx, dy] = DIRS[i % 4]; ln(px - dx * 40, py - dy * 40, px + dx * 40, py + dy * 40, PEN[i % 4]); const [ex, ey] = DIRS[(i + 1) % 4]; ln(px - ex * 40, py - ey * 40, px + ex * 40, py + ey * 40, PEN[(i + 1) % 4]); });
    else if (id === 'chain') { const Q = [[6, 18], [13, 7], [18, 20], [26, 6], [33, 16], [36, 8]]; for (let i = 1; i < Q.length; i++) { ln(Q[i - 1][0], Q[i - 1][1], Q[i][0], Q[i][1], PEN[i % 3]); if (i > 1) ln(Q[i - 2][0], Q[i - 2][1], Q[i][0], Q[i][1], PEN[(i + 1) % 3]); } }
    else if (id === 'squares') {
      const cells = [[3, 3, 0], [14, 3, 2], [25, 3, 1], [3, 14, 3], [14, 14, 0], [25, 14, 2]];
      for (const [cx, cy, di] of cells) { g.save(); g.beginPath(); g.rect(cx, cy, 10, 9); g.clip(); const [dx, dy] = DIRS[di]; for (let j = -5; j <= 5; j++) { const ox = cx + 5 - dy * j * 2, oy = cy + 4.5 + dx * j * 2; ln(ox - dx * 12, oy - dy * 12, ox + dx * 12, oy + dy * 12, PEN[di]); } g.restore(); }
    }
    g.restore();
  }

  TOOLS.push({
    id: 'lewitt', name: 'LeWitt', tag: 'new',
    blurb: 'After Sol LeWitt\'s wall drawings. Every note is a point on the wall (left to right by pitch, one row per note name), and every attack carries out a rule in fine coloured-pencil lines: lines from the corners, lines through the notes in four directions, arcs, squares of parallel lines, lines from the sides, a chain from note to note, lines from the centre. The lines pile up into a dense, systematic drawing; each new section of the music starts a fresh wall with the next rule, written on the wall in pencil.',
    params: [
      { key: 'rule', label: 'the rule', min: 0, max: 7, step: 1, value: 0,
        hint: 'Which rule the lines follow. Left: the rule changes with each section of the music. Right: always one rule, from lines from the corners through four directions, arcs, squares, sides and a chain to lines from the centre.',
        icon: (g, v, w, h) => {
          wallIcon(g, w, h);
          const i = Math.round(v * 7);
          if (i === 0) { ICON.alpha(g, 0.9, () => { g.save(); g.beginPath(); g.rect(2, 2, 18, h - 4); g.clip(); ruleIcon(g, 'corners', w, h, 0.8); g.restore(); g.save(); g.beginPath(); g.rect(20, 2, w - 22, h - 4); g.clip(); ruleIcon(g, 'squares', w, h, 0.8); g.restore(); }); ICON.line(g, 20, 3, 20, h - 3, '#151214', 1.2); }
          else ruleIcon(g, RULES[i - 1].id, w, h);
        } },
      { key: 'lines', label: 'lines per note', min: 1, max: 4, step: 1, value: 3, less: 1, drive: '-rate',
        hint: 'How many lines each note draws. Left: one line per note, a sparse drawing. Right: four (from every corner, in every direction), a dense web.',
        icon: (g, v, w, h) => { wallIcon(g, w, h); const n = 1 + Math.round(v * 3), C = [[2, 2], [w - 2, h - 2], [w - 2, 2], [2, h - 2]]; for (let i = 0; i < n; i++) ICON.line(g, w / 2, h / 2, C[i][0], C[i][1], PEN[i], 1.1); ICON.dot(g, w / 2, h / 2, 1.8, '#151214'); } },
      { key: 'pencil', label: 'pencil or crayon', min: 0, max: 1, value: 0.15, drive: '+level',
        hint: 'How heavy the lines are. Left: a hard, hair-thin pencil. Right: a soft, thick crayon.',
        icon: (g, v, w, h) => { wallIcon(g, w, h); for (let i = 0; i < 3; i++) ICON.alpha(g, 0.5 + 0.4 * v, () => ICON.line(g, 6, 7 + i * 6, w - 6, 5 + i * 6 + 3, PEN[i], 0.6 + v * 2.6)); } },
      { key: 'colours', label: 'how many colours', min: 0, max: 1, value: 1,
        hint: 'Which pencils are used. Left: graphite only, grey on white. Right: all four of LeWitt\'s colours: graphite, red, blue and yellow.',
        icon: (g, v, w, h) => { wallIcon(g, w, h); const n = 1 + Math.round(v * 3); for (let i = 0; i < 8; i++) ICON.line(g, 5 + i * 4, h - 4, 9 + i * 4, 4, PEN[i % n], 1.3); } },
      { key: 'full', label: 'how full a wall gets', min: 100, max: 3000, value: 700, less: 150,
        hint: 'How many lines a wall takes before it is painted over and a fresh wall begins with the next rule (a new section of the music always starts one). Left: a clean wall every few chords. Right: the lines pile up into a dense web.',
        icon: (g, v, w, h) => { wallIcon(g, w, h); const r = ICON.rng(9), n = Math.round(3 + v * 30); for (let i = 0; i < n; i++) { const a = r() * (w - 4) + 2, b = r() * (w - 4) + 2; ICON.line(g, a, 2, b, h - 2, PEN[i % 4], 0.7); } } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much gets drawn: how many lines each note makes and how many a wall takes before a fresh one begins. Left: one line per note, and the wall is repainted early. Right: three lines per note piling up into a dense web. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset(x) {
      buffers(x);
      cur.getContext('2d').clearRect(0, 0, W, H); prev.getContext('2d').clearRect(0, 0, W, H);
      active = []; commits = []; flashes = []; lastPts = []; prevA = 0; strokes = 0; caption = 0; hits.clear();
      lastMoment = x.moment; lastAttack = -1; lastSwitch = x.t; allVels = null;
      // after a seek, the rule depends on where we are (and on the piece), so different passages open with different rules
      autoRule = (Math.floor(Math.max(0, x.t) / 31) + (window.NOTES?.length ?? 0) + 6) % RULES.length; rule = autoRule;
    },
    onChord(ch, x) {
      buffers(x);
      const fixed = Math.round(x.p('rule'));
      // a new section, a long rest (a fermata) or a full wall starts a fresh wall with the next rule
      const rest = lastAttack >= 0 && x.t - lastAttack > 1.6 && strokes > 60;
      const section = (x.moment !== lastMoment || rest) && x.t - lastSwitch > 4;
      // how present: a wall turns only on an attack that draws, so a quiet passage keeps the last drawing up, not an empty wall
      const pres = x.p('presence'), draws = pres >= 1 || ch.notes.some((n) => hardEnough(n.v, pres));
      if (draws && (section || (strokes > x.p('full') && x.t - lastSwitch > 4))) { lastSwitch = x.t; autoRule = (autoRule + 1) % RULES.length; newWall(); }
      if (draws) lastMoment = x.moment;
      lastAttack = x.t;
      const want = fixed ? fixed - 1 : autoRule;
      if (want !== rule) { rule = want; caption = 0; }
      carry(ch, x);
    },
    frame(x) {
      buffers(x);
      // how present: below 1 the picture is drawn aside and laid over the stage faintly, at the end of this function
      const pres = x.p('presence');
      if (pres < 1 && !dimmed) { dimmed = document.createElement('canvas'); dimmed.width = W; dimmed.height = H; }
      const g = pres < 1 ? dimmed.getContext('2d') : x.g, dt = x.dt;
      // the wall
      g.fillStyle = WALL; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'multiply';
      if (prevA > 0.005) { prevA = Math.max(0, prevA - dt / 2.2); g.globalAlpha = prevA * prevA; g.drawImage(prev, 0, 0); }
      g.globalAlpha = 1; g.drawImage(cur, 0, 0);
      g.globalCompositeOperation = 'source-over';
      // the squares rule is drafted on a faint pencil grid first
      if (RULES[rule].id === 'squares') {
        g.strokeStyle = `rgba(60,60,66,${(0.16 * caption).toFixed(3)})`; g.lineWidth = 0.6; g.beginPath();
        for (let i = 0; i <= COLS; i++) { const gx = Math.round((i * W) / COLS) + 0.5; g.moveTo(gx, 0); g.lineTo(gx, H); }
        for (let j = 0; j <= ROWS; j++) { const gy = Math.round((j * H) / ROWS) + 0.5; g.moveTo(0, gy); g.lineTo(W, gy); }
        g.stroke();
      }
      // the lines being drawn: a little heavier and darker while the pencil moves, then they settle into the wall
      g.lineCap = 'round';
      for (const s of active) {
        s.age += dt; if (s.age <= 0) continue;
        const u = Math.min(1, s.age / s.dur), e = 1 - Math.pow(1 - u, 3), fresh = 1 - u;
        g.strokeStyle = rgba(s.col, Math.min(1, s.al + 0.4 * fresh * pres)); g.lineWidth = s.lw * (1 + 1.4 * fresh * pres);
        g.beginPath(); pathOf(g, s, e); g.stroke();
        if (u >= 1) commits.push(s);
      }
      if (commits.length) {
        active = active.filter((s) => s.age < s.dur);
        // into the wall, one path per pencil and weight; crossing lines mix like coloured pencil
        const c = cur.getContext('2d'); c.globalCompositeOperation = 'multiply'; c.lineCap = 'round';
        const groups = new Map();
        for (const s of commits) { const key = `${s.col}|${s.lw.toFixed(1)}|${s.al.toFixed(2)}`; (groups.get(key) ?? groups.set(key, []).get(key)).push(s); }
        for (const list of groups.values()) {
          const s0 = list[0]; c.strokeStyle = rgba(s0.col, s0.al); c.lineWidth = s0.lw; c.beginPath();
          for (const s of list) pathOf(c, s, 1);
          c.stroke();
        }
        for (const s of commits) strokes += s.n ?? 1;
        commits = [];
      }
      // the points: a dot flashes on the attack and leaves a small graphite mark
      for (const f of flashes) {
        f.age += dt; const k = Math.max(0, 1 - f.age / 0.45);
        if (f.age > 0 && !f.marked) { f.marked = true; const c = cur.getContext('2d'); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgba(40,40,46,0.55)'; c.beginPath(); c.arc(f.x, f.y, 1.6, 0, TAU); c.fill(); }
        if (k <= 0) continue;
        g.fillStyle = `rgba(20,20,26,${(0.8 * k).toFixed(3)})`; g.beginPath(); g.arc(f.x, f.y, 2 + 3 * k * Math.min(1, f.v / 100) * pres, 0, TAU); g.fill();
        g.strokeStyle = `rgba(196,46,40,${(0.7 * k * k * pres).toFixed(3)})`; g.lineWidth = 1; g.beginPath(); g.arc(f.x, f.y, 4 + 14 * (1 - k) * pres, 0, TAU); g.stroke();
      }
      flashes = flashes.filter((f) => f.age < 0.45);
      // the rule, written on the wall in pencil
      caption = Math.min(1, caption + dt / 1.2);
      g.fillStyle = `rgba(70,68,72,${(0.75 * caption).toFixed(3)})`; g.font = 'italic 14px Georgia, "Times New Roman", serif';
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillText(RULES[rule].text, 28, H - 22);
      if (pres < 1) { x.g.globalAlpha = showAlpha(pres); x.g.drawImage(dimmed, 0, 0); x.g.globalAlpha = 1; }
    },
  });
})();
