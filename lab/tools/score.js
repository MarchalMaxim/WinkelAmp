// Graphic score (after Cardew's Treatise and Cage): the music writes its own abstract notation, which drifts slowly
// from right to left. Height = pitch, length = how long a note is held, ink weight = how hard it was struck.
// Single notes are dots and circles (filled when loud, hollow when soft); held notes draw beams; chords stand on stems,
// sometimes bracketed with a little numeral (how many notes); deep loud bass leaves heavy discs and slabs; the biggest
// chords throw a large thin circle; a silence starts a new system with a double bar. One continuous line runs through
// the page and swells with the loudness. Dense passages are thinned: what isn't written in full is left as specks.
// A sixth knob, how present (the user, 2026-11-01: sliders should dim, not only boost). Turned down, the whole page sinks
// toward black, marks and all, it drifts more slowly, the line barely swells, and only the song's hardest attacks are written.
(() => {
  const TAU = Math.PI * 2;
  const PAPER = { bg: [233, 225, 207], ink: [22, 19, 15], red: [178, 50, 32] };
  const NIGHT = { bg: [13, 12, 11], ink: [230, 221, 202], red: [214, 86, 58] };
  const WRITE = 0.84;                   // where the pen is, as a fraction of the width
  let figs = [], life = [], lifeAcc = 0, lvl = 0, tokens = 3, lastAt = -99, lastWritten = null, lastBig = -99, lastDisc = -99, lastBracket = -99, tex = [];
  let pop = 0;                          // the pen's flash on each attack
  let land = 1;                         // how much a mark swells as it lands: how present, set each frame

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const Y = (m, H) => H * 0.9 - ((clamp(m, 24, 96) - 24) / 72) * H * 0.8;
  const chords = () => (typeof CHORDS !== 'undefined' ? CHORDS : []);
  // The page's drift: the speed knob, slowed to 40% of itself as how present goes to 0.
  const driftOf = (x) => x.p('speed') * (1 - 0.6 * (1 - x.p('presence')));
  // how present (0..1): which attacks are written, judged against this piece's own attacks (recordings differ a lot in
  // how hard they play): every one at 1, the hardest 40% at 0.4, the hardest 5% at 0
  let vels = null;
  const hardEnough = (v, pres) => {
    if (pres >= 1) return true;
    if (!vels) vels = chords().map((c) => c.vel).sort((a, b) => a - b);
    if (!vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= (1 - pres) * 0.95;
  };
  // Turned down, the page is painted here at full strength, ink dark on bone, and stamped once onto the stage.
  let sheet = null, sheetG = null;
  function sheetFor(x) {
    const cw = x.g.canvas.width, ch = x.g.canvas.height;
    if (!sheet || sheet.width !== cw || sheet.height !== ch) {
      sheet = document.createElement('canvas'); sheet.width = cw; sheet.height = ch; sheetG = sheet.getContext('2d');
      sheetG.setTransform(cw / x.W, 0, 0, ch / x.H, 0, 0);   // the stage may be supersampled: the sheet stays as sharp
    }
    return sheetG;
  }

  // Bone paper or night: a grainy page, painted once and copied each frame.
  function page(W, H, night) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const P = night ? NIGHT : PAPER;
    g.fillStyle = rgba(P.bg, 1); g.fillRect(0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * (night ? 7 : 10); d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9; }
    g.putImageData(img, 0, 0);
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, night ? 'rgba(0,0,0,0.5)' : 'rgba(90,70,40,0.16)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    return c;
  }

  // Move everything left by dx; held notes keep growing their beams at the pen.
  function advance(dt, speed, x) {
    const dx = speed * dt;
    for (const f of figs) {
      f.x -= dx; f.age += dt;
      if (f.hold > 0) { const k = Math.min(dt, f.hold); f.len += f.grow * k; f.hold -= dt; }
    }
    for (const s of life) s.x -= dx;
    lvl *= Math.pow(0.5, dt / 0.8);
    lifeAcc += dt;
    if (lifeAcc >= 0.05) { lifeAcc = 0; life.push({ x: x.W * WRITE, w: lvl }); }
    if (figs.length && figs[0].x < -260) figs = figs.filter((f) => f.x + (f.len || 0) + (f.r || 0) > -260);
    if (life.length > 2 && life[1].x < -20) life.shift();
  }

  // One attack (a chord) becomes figures at the pen. age > 0 when rebuilding the page after a jump.
  function write(ch, x, age) {
    const W = x.W, H = x.H, px = W * WRITE, speed = driftOf(x), wt = x.p('weight'), orn = x.p('figures');
    lvl = Math.max(lvl, ch.vel / 115);
    const gap = ch.t - lastAt; lastAt = ch.t;
    tokens = Math.min(3, tokens + gap * x.p('ink'));
    const notes = [...ch.notes].sort((a, b) => a.m - b.m), n = notes.length;
    const strong = ch.vel >= 100 || (ch.lo < 40 && ch.vel >= 88) || n >= 5;
    const mk = (f) => { f.x = px - age * speed; f.age = age; f.hold = f.hold || 0; f.len = f.len || 0; figs.push(f); return f; };
    // a held note: grows from the pen at speed*length/duration so it finishes when the note ends
    const beam = (f, d) => {
      const L = speed * 1.15 * Math.sqrt(d), grow = L / d, done = Math.min(age, d);
      f.len = grow * done; f.grow = grow; f.hold = d - done; return f;
    };
    // a new system after a silence: a double bar
    if (gap > 2.2) mk({ k: 'bar', y0: H * 0.3, y1: H * 0.7, w: wt });
    // not hard enough for how present: nothing is written (the silence above and the line still counted it)
    if (!hardEnough(ch.vel, x.p('presence'))) return;
    // thinning: an attack costs a token; loud, deep or full ones may borrow a little, the rest become specks
    if (tokens < 1 && !(ch.vel >= 108 && tokens > -0.5)) {
      if (strong) { const lo = notes[0], hi = notes[n - 1]; mk({ k: 'stem', y0: Y(hi.m, H), y1: Y(lo.m, H), lw: 0.6, faint: true }); return; }
      for (const nt of notes) mk({ k: 'speck', y: Y(nt.m, H) + (Math.random() - 0.5) * 6, r: 0.8 + nt.v / 127 });
      return;
    }
    tokens -= 1;
    const vv = (v) => clamp(v / 127, 0, 1);
    const red = ch.vel >= 112;
    let head = null;
    if (n <= 2) {
      for (const nt of notes) {
        const y = Y(nt.m, H), v = vv(nt.v), r = (2 + v * v * 8) * wt;
        if (nt.m < 40 && nt.v >= 90 && orn > 0.25 && ch.t - lastDisc > 1.2) {
          lastDisc = ch.t; head = mk({ k: 'disc', y, r: r * 1.8, red });
        } else head = mk({ k: 'note', y, r, fill: nt.v >= 72, lw: 0.6 + v * 1.4 * wt, red: red && nt === notes[n - 1] });
        if (nt.d >= 0.22) mk(beam({ k: 'beam', y, lw: (0.5 + v * v * 6) * wt, hollow: nt.v < 58, slab: nt.v >= 100 && orn > 0.5 }, nt.d));
      }
    } else {
      // a chord: split into hands (a gap of more than a sixth), each hand its own figure; a hairline joins the hands
      const top = notes[n - 1], low = notes[0], y0 = Y(top.m, H), y1 = Y(low.m, H), v = vv(ch.vel);
      const groups = [[notes[0]]];
      for (let i = 1; i < n; i++) (notes[i].m - notes[i - 1].m > 9 ? groups[groups.push([]) - 1] : groups[groups.length - 1]).push(notes[i]);
      if (groups.length > 1) mk({ k: 'stem', y0, y1, lw: 0.6, faint: true });
      for (const gr of groups) {
        const gt = gr[gr.length - 1], gl = gr[0], gy0 = Y(gt.m, H), gy1 = Y(gl.m, H), gv = Math.max(...gr.map((q) => q.v)), isTop = gt === top;
        const deep = gl.m < 40 && gv >= 90 && orn > 0.2 && ch.t - lastDisc > 1.2;
        let f;
        if (deep) { lastDisc = ch.t; f = mk({ k: 'disc', y: (gy0 + gy1) / 2, r: Math.min(24, 5 + vv(gv) * 8 + (gy1 - gy0) * 0.15) * Math.sqrt(wt) }); }
        else if (gr.length === 1) f = mk({ k: 'note', y: gy0, r: (2 + vv(gv) ** 2 * 6) * wt, fill: gv >= 72, lw: 0.9 * wt, red: red && isTop });
        else if (gv >= 92 && gr.length >= 3) f = mk({ k: 'block', y0: gy0 - 3, y1: gy1 + 3, w: (2.5 + vv(gv) * 3.5) * Math.sqrt(wt), red: red && isTop, y: gy0 });   // a loud cluster: a black block
        else if (gv < 64) f = mk({ k: 'box', y0: gy0 - 6, y1: gy1 + 6, w: 12 * wt, y: gy0, lw: 0.8 * wt, pts: gr.map((q) => Y(q.m, H)) }); // soft: an open box
        else {
          mk({ k: 'stem', y0: gy0, y1: gy1, lw: (0.6 + vv(gv) * 1.4) * wt });
          for (let i = 1; i < gr.length - 1; i++) mk({ k: 'dash', y: Y(gr[i].m, H), w: (4 + vv(gr[i].v) * 7) * wt, lw: (0.8 + vv(gr[i].v) * 1.4) * wt });
          mk({ k: 'note', y: gy1, r: (1.8 + vv(gl.v) * 3.5) * wt, fill: gl.v >= 70, lw: 0.9 * wt });
          f = mk({ k: 'note', y: gy0, r: (1.8 + vv(gt.v) * 3.5) * wt, fill: gt.v >= 70, lw: 0.9 * wt, red: red && isTop });
        }
        if (isTop) head = f;
      }
      // one beam, from whichever outer note is held longer
      const held = low.d > top.d * 1.2 ? low : top, hy = held === low ? y1 : y0;
      if (held.d >= 0.3) mk(beam({ k: 'beam', y: hy, lw: (0.6 + vv(held.v) ** 2 * 6) * wt, hollow: held.v < 58, slab: held === low && low.m < 44 && low.v >= 96 && orn > 0.5 }, held.d));
      if (n >= 4 && ch.t - lastBracket > 2.4 - orn * 1.6 && Math.random() < orn * 0.9) { lastBracket = ch.t; mk({ k: 'bracket', y0: y0 - 9, y1: y1 + 9, num: n, lw: 0.9 * wt, dx: -13 }); }
      // the biggest chords throw a large, thin circle around themselves
      if (ch.vel >= 98 && n >= 5 && ch.t - lastBig > 8 - orn * 3.5 && Math.random() < orn * 1.3) {
        lastBig = ch.t; mk({ k: 'ring', y: (y0 + y1) / 2, r: clamp((y1 - y0) * 0.6 + 30, 50, 170), lw: 0.8 * wt });
      }
    }
    // a melody joined up: the new top note to the last written one, if it came quickly
    if (head && lastWritten && ch.t - lastWritten.t < 0.5 && Math.random() < 0.35 + orn * 0.5)
      mk({ k: 'link', a: lastWritten.f, b: head, lw: 0.7 * wt, bend: Math.random() < 0.5 ? 1 : -0.6 });
    if (head) lastWritten = { f: head, t: ch.t };
    if (age < 0.2) pop = 1;
  }

  // Rebuild the last screenful from the notes so a jump in the song shows a full page at once.
  function rebuild(x) {
    figs = []; life = []; lifeAcc = 0; lvl = 0; tokens = 3; lastAt = -99; lastWritten = null; lastBig = -99; lastDisc = -99; lastBracket = -99; pop = 0;
    const speed = driftOf(x), span = (x.W * WRITE + 260) / speed, t0 = Math.max(0, x.t - span), C = chords();
    let cur = t0;
    const step = (to) => { while (cur < to - 1e-6) { const d = Math.min(0.05, to - cur); advance(d, speed, x); cur += d; } };
    for (const ch of C) { if (ch.t < t0) lastAt = ch.t; }   // so the first rebuilt chord isn't mistaken for one after a silence
    if (lastAt < 0) lastAt = t0 > 0 ? t0 : -99;
    for (const ch of C) {
      if (ch.t < t0) continue; if (ch.t > x.t) break;
      step(ch.t); write(ch, x, 0);
    }
    step(x.t); pop = 0;
  }

  function draw(g, f, P, W, H) {
    const a = clamp(f.x / 170, 0, 1) * clamp(f.age / 0.08, 0.15, 1);
    if (a <= 0.01) return;
    const ink = f.red ? P.red : P.ink, x0 = f.x + (f.dx || 0);
    switch (f.k) {
      case 'speck': g.fillStyle = rgba(P.ink, a * 0.55); g.fillRect(x0 - f.r / 2, f.y - f.r / 2, f.r, f.r); return;
      case 'note': {
        const r = f.r * (1 + 0.35 * land * Math.max(0, 1 - f.age / 0.15));
        g.beginPath(); g.arc(x0, f.y, r, 0, TAU);
        if (f.fill) { g.fillStyle = rgba(ink, a); g.fill(); } else { g.strokeStyle = rgba(ink, a); g.lineWidth = f.lw; g.stroke(); }
        return;
      }
      case 'disc': { g.fillStyle = rgba(ink, a); g.beginPath(); g.arc(x0, f.y, f.r * (1 + 0.25 * land * Math.max(0, 1 - f.age / 0.15)), 0, TAU); g.fill(); return; }
      case 'beam': {
        if (f.len < 1) return;
        g.fillStyle = g.strokeStyle = rgba(ink, a);
        if (f.slab) { g.fillRect(x0, f.y - f.lw * 1.6, f.len, f.lw * 3.2); return; }
        if (f.hollow) { g.lineWidth = 0.7; g.strokeRect(x0, f.y - 2.5, f.len, 5); return; }
        g.fillRect(x0, f.y - f.lw / 2, f.len, f.lw); return;
      }
      case 'block': g.fillStyle = rgba(ink, a); g.fillRect(x0 - f.w / 2, f.y0, f.w, f.y1 - f.y0); return;
      case 'box': {
        g.strokeStyle = g.fillStyle = rgba(ink, a); g.lineWidth = f.lw; g.beginPath(); g.roundRect(x0 - f.w / 2, f.y0, f.w, f.y1 - f.y0, f.w / 2); g.stroke();
        for (const y of f.pts) { g.beginPath(); g.arc(x0, y, 1.4, 0, TAU); g.fill(); }
        return;
      }
      case 'dash': g.fillStyle = rgba(ink, a); g.fillRect(x0 - f.w / 2, f.y - f.lw / 2, f.w, f.lw); return;
      case 'stem': g.strokeStyle = rgba(ink, f.faint ? a * 0.45 : a); g.lineWidth = f.lw; g.beginPath(); g.moveTo(x0, f.y0); g.lineTo(x0, f.y1); g.stroke(); return;
      case 'bracket': {
        const bx = x0, k = 6; g.strokeStyle = g.fillStyle = rgba(ink, a); g.lineWidth = f.lw;
        g.beginPath(); g.moveTo(bx + k, f.y0); g.lineTo(bx, f.y0); g.lineTo(bx, f.y1); g.lineTo(bx + k, f.y1); g.stroke();
        g.font = 'italic 15px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.fillText(String(f.num), bx + 4, f.y0 - 4); return;
      }
      case 'ring': g.strokeStyle = rgba(ink, a * 0.85); g.lineWidth = f.lw; g.beginPath(); g.arc(x0, f.y, f.r, 0, TAU); g.stroke(); return;
      case 'bar': {
        g.fillStyle = rgba(P.ink, a * 0.55); g.fillRect(x0 - 16, f.y0, 1, f.y1 - f.y0); g.fillRect(x0 - 12, f.y0, 2.2 * f.w, f.y1 - f.y0); return;
      }
      case 'link': {
        const A = f.a, B = f.b; if (!A || !B) return;
        g.strokeStyle = rgba(P.ink, a * 0.8); g.lineWidth = f.lw; g.beginPath();
        const ax = A.x + (A.dx || 0), bx = B.x + (B.dx || 0); g.moveTo(ax, A.y); g.quadraticCurveTo((ax + bx) / 2, Math.min(A.y, B.y) - 6 - Math.abs(bx - ax) * 0.25 * f.bend, bx, B.y); g.stroke(); return;
      }
    }
  }

  TOOLS.push({
    id: 'score', name: 'Graphic score', tag: 'new',
    blurb: 'The music writes its own abstract score, drifting slowly to the left like a page of Cardew’s Treatise: high notes sit high, held notes draw beams, loud notes are heavy and filled, soft ones hollow; chords stand on stems (a loud cluster is a black block, a soft one an open box), sometimes bracketed with a small numeral; deep loud bass leaves black discs, the biggest chords throw a large circle, and a silence starts a new line. Turn <b>how present</b> down for a faint page, a slower drift and only the hardest attacks written.',
    params: [
      { key: 'speed', label: 'how fast the page moves', min: 20, max: 140, value: 48, drive: '+rate',
        hint: 'How fast the writing drifts to the left. Left: slow, the marks crowd together. Right: fast, they spread far apart.',
        icon: (g, v, w, h) => { const gap = 2.5 + v * 7; for (let i = 0; i < 6; i++) { const x = w - 5 - i * gap; if (x < 3) break; ICON.dot(g, x, h / 2 + (i % 2 ? -4 : 4), 1.8); } ICON.arrow(g, w - 6, h - 3, w - 6 - (6 + v * 20), h - 3, ICON.dim, 1); } },
      { key: 'ink', label: 'how much gets written', min: 0.5, max: 8, value: 1.6,
        hint: 'How many attacks are written out in full; the rest are left as specks. Left: only the strongest few, sparse and calm. Right: nearly every note.',
        icon: (g, v, w, h) => { const R = ICON.rng(4), n = 9, full = Math.round(1 + v * 8);
          for (let i = 0; i < n; i++) { const x = 4 + (i + 0.5) * ((w - 8) / n), y = 5 + R() * (h - 10);
            if (i % Math.max(1, Math.round(n / full)) === 0 || full >= n) ICON.dot(g, x, y, 2.4); else ICON.rect(g, x - 0.6, y - 0.6, 1.3, 1.3, ICON.dim); } } },
      { key: 'figures', label: 'plain or ornate', min: 0, max: 1, value: 0.45, drive: '+density',
        hint: 'How rich the notation is. Left: plain dots and lines, like Cage. Right: brackets with numerals, black discs, slabs and big circles, like Treatise.',
        icon: (g, v, w, h) => {
          ICON.dot(g, 8, h / 2 + 3, 2); ICON.line(g, 8, h / 2 + 3, 20, h / 2 + 3, ICON.ink, 1);
          if (v > 0.2) ICON.alpha(g, Math.min(1, (v - 0.2) * 3), () => { ICON.line(g, 26, 5, 23, 5, ICON.ink, 1); ICON.line(g, 23, 5, 23, h - 5, ICON.ink, 1); ICON.line(g, 23, h - 5, 26, h - 5, ICON.ink, 1); ICON.dot(g, 28, 9, 1.6); ICON.dot(g, 28, 15, 1.6); });
          if (v > 0.5) ICON.alpha(g, Math.min(1, (v - 0.5) * 3), () => ICON.ring(g, 30, h / 2, 9, ICON.ink, 0.8));
          if (v > 0.7) ICON.alpha(g, Math.min(1, (v - 0.7) * 4), () => ICON.dot(g, 12, h - 5, 3.2));
        } },
      { key: 'weight', label: 'weight of the ink', min: 0.4, max: 2.4, value: 1, drive: '+level',
        hint: 'How heavy the pen is. Left: fine hairlines and small dots. Right: thick beams and big black marks.',
        icon: (g, v, w, h) => { const lw = 0.6 + v * 4.4; ICON.rect(g, 13, h / 2 - lw / 2, w - 17, lw); ICON.dot(g, 9, h / 2, 1.6 + v * 4); } },
      { key: 'paper', label: 'night or paper', min: 0, max: 1, step: 1, value: 1,
        hint: 'The page. Left: pale ink on black, like chalk at night. Right: black ink on bone paper, like a printed score.',
        icon: (g, v, w, h) => { const night = v < 0.5, bg = night ? '#0d0c0b' : '#e9e1cf', ink = night ? '#e6dcca' : '#16130f';
          ICON.rect(g, 2, 2, w - 4, h - 4, bg); if (night) { g.strokeStyle = '#4a4038'; g.lineWidth = 1; g.strokeRect(2.5, 2.5, w - 5, h - 5); }
          ICON.dot(g, 10, 15, 3, ink); ICON.ring(g, 21, 9, 3, ink, 1); ICON.rect(g, 21, 17, 14, 1.6, ink); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: a faint page drifting slowly, and only the hardest attacks are written. Right: every attack at full strength (as before).',
        icon: (g, v, w, h) => ICON.alpha(g, 0.14 + 0.86 * v, () => {   // the page with its marks, dim and nearly bare, or bright and written over
          const ink = '#16130f';
          ICON.rect(g, 3, 3, w - 6, h - 6, '#e9e1cf');
          ICON.dot(g, 11, 15, 2.8, ink);
          if (v > 0.3) ICON.rect(g, 19, 9, 14, 1.8, ink);
          if (v > 0.6) ICON.dot(g, 24, 17, 2, ink);
          if (v > 0.85) ICON.ring(g, 31, 16, 3, ink, 1);
        }) },
    ],
    reset(x) { vels = null; rebuild(x); },
    onChord(ch, x) { write(ch, x, 0); },
    frame(x) {
      const pres = x.p('presence'), stage = x.g, g = pres < 1 ? sheetFor(x) : stage;
      const W = x.W, H = x.H, night = x.p('paper') < 0.5, P = night ? NIGHT : PAPER;
      const k = night ? 0 : 1; tex[k] ??= page(W, H, night);   // both pages are kept, so a driven flip never stutters
      land = pres;
      advance(x.dt, driftOf(x), x);
      pop *= Math.pow(0.5, x.dt / 0.08);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none'; g.shadowBlur = 0;
      g.drawImage(tex[k], 0, 0);
      // the continuous line through the page, swelling with the loudness
      const ly = H * 0.535, wt = x.p('weight') * (1 - 0.75 * (1 - pres));   // turned down, it hardly swells
      if (life.length > 1) {
        g.fillStyle = rgba(P.ink, 0.88); g.beginPath();
        for (let i = 0; i < life.length; i++) { const s = life[i]; g.lineTo(s.x, ly - (0.6 + s.w * 3.2 * wt)); }
        for (let i = life.length - 1; i >= 0; i--) { const s = life[i]; g.lineTo(s.x, ly + (0.6 + s.w * 3.2 * wt)); }
        g.closePath(); g.fill();
      }
      for (const f of figs) if (f.x < W + 20) draw(g, f, P, W, H);
      // the pen: a faint hairline that darkens on each attack
      const px = W * WRITE;
      g.fillStyle = rgba(P.ink, 0.1 + 0.35 * pop); g.fillRect(px - 0.5, H * 0.08, 1, H * 0.84);
      // the left margin fades the page out
      const fade = g.createLinearGradient(0, 0, 60, 0);
      fade.addColorStop(0, rgba(P.bg, 0.9)); fade.addColorStop(1, rgba(P.bg, 0));
      g.fillStyle = fade; g.fillRect(0, 0, 60, H);
      // Turned down: the page, under a lowered lamp, onto the stage. A plain low alpha would pile up over the stage's slow
      // 8-bit fade and band the bone into olive and blue. So: 'lighten' lifts the stage to exactly the dimmed page, the same
      // on every frame, and whatever is brighter under it (another widget) stays; the source-over before it is what lets
      // the dark ink cut in, and it covers what's under the page less and less as the knob goes down.
      if (g !== stage) {
        g.fillStyle = `rgba(0,0,0,${1 - (0.12 + 0.88 * pres)})`; g.fillRect(0, 0, W, H);
        stage.globalCompositeOperation = 'source-over';
        if (x.dt > 0) { stage.globalAlpha = pres; stage.drawImage(sheet, 0, 0, W, H); stage.globalAlpha = 1; }   // no time, no change
        stage.globalCompositeOperation = 'lighten'; stage.drawImage(sheet, 0, 0, W, H);
        stage.globalCompositeOperation = 'source-over';
      }
    },
  });
})();
