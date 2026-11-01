// Vine (the user: "a viney-type of widget, that spreads and withers based on parameters"). A network that remembers: thin
// whiplash lines creep out, fork on the notes and tighten into spirals when their energy runs out, and everything grown
// stays until it dies. Dying runs along a stem, oldest end first: it browns, thins, sags and crumbles into sinking dots,
// leaving a few dry lines that the next theme can grow out of. The only widget here with a lifespan across minutes.
// Settled lines sit on an offscreen canvas repainted 5 times a second; only tips and the moving wither fronts are drawn live.
(() => {
  const ZONE = 26, CAP = 6500, CELL = 32, REPAINT = 0.2, MAX_FRONTS = 34;     // ZONE: points in a stem's dying stretch
  const AGE_T = 20;                                                           // seconds from acid green to viridian
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const ramp = (stops, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const f = (i / (n - 1)) * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(f)), t = f - k;
      const a = hex(stops[k]), b = hex(stops[k + 1]);
      out.push(`rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * t)).join(',')})`);
    }
    return out;
  };
  // 0..5 living (young to established), 6..12 dying (established to ash), 13 the dry remnant.
  const COLS = [...ramp(['#e8ffb0', '#8fd63f'], 2), ...ramp(['#79c63e', '#2a8a5c'], 4), ...ramp(['#2a8a5c', '#b08a2e', '#8a3f1c', '#4a433c'], 7), '#544c43'];
  const DYING = 6, DRY = 13, NW = 13;
  const widthOf = (k) => 0.5 * Math.pow(1.35, k);
  const LOG = Math.log(1.35);

  let stems = [], tips = [], dust = [], buds = [], occ = null, cols = 0, rows = 0;
  let startIn = 0, live = 0, health = 0.3, clock = 0, sinceRepaint = 0, dirty = true, born = 0, settled = null, sg = null, ctxW = 1280, ctxH = 720;
  let hardVels = null;

  const cell = (px, py) => {
    const c = Math.floor(px / CELL), r = Math.floor(py / CELL);
    return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c;
  };
  const occAt = (px, py) => { const i = cell(px, py); return i < 0 ? 0 : occ[i]; };
  const mark = (px, py, d) => { const i = cell(px, py); if (i >= 0) occ[i] = Math.max(0, occ[i] + d); };
  // how present: which notes make it grow, judged against this piece's own notes (the hardest few at the bottom).
  const hardEnough = (v, x) => {
    const cut = (1 - x.p('presence')) * 0.95;
    if (cut <= 0) return true;
    if (!hardVels) hardVels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!hardVels.length) return true;
    let a = 0, b = hardVels.length; while (a < b) { const k = (a + b) >> 1; if (hardVels[k] < v) a = k + 1; else b = k; }
    return a / hardVels.length >= cut;
  };
  const speedK = (x) => x.p('spread') * (0.25 + 0.75 * x.p('presence'));
  const pitchT = (m) => Math.max(0, Math.min(1, (m - 33) / 63));              // the usual range of the keyboard, across the picture

  function newStem(px, py, w) {
    const s = { xs: [px], ys: [py], ws: [w], ts: [clock], fr: null, pass: 0, cl: 0, dry: Math.random() < 0.26, sag: 6 + Math.random() * 18,
      rem: 0, tip: null, kids: [], kp: 0, sd: 0, sa: 0, sb: 0, id: born++, gone: false };
    stems.push(s); live++; mark(px, py, 1);
    return s;
  }
  function newTip(s, ang, e, w, peel) {
    const t = { s, ang, e, w, wT: w, c: 0, ct: 0, wander: 0, ph: Math.random() * 6.28, pf: 0.018 + Math.random() * 0.03, pa: 0.008 + Math.random() * 0.012,
      peel: peel || 0, st: 0, whipIn: 0, v1: 0, v2: 0, acc: 0, curl: false, r: 0, L: 0, dir: 1, turned: 0, maxTurn: 0, flash: 1 };
    s.tip = t; tips.push(t);
    return t;
  }
  const bud = (px, py, r) => { if (buds.length < 70) buds.push({ x: px, y: py, r, a: 0 }); };
  const noteWidth = (n) => (3.1 - 2.5 * Math.pow(pitchT(n.m), 0.8)) * (0.55 + 0.8 * n.v / 127);
  const noteEnergy = (n, b) => (16 + 430 * Math.pow(Math.min(n.d, 1.6), 0.9)) * (0.6 + 0.6 * n.v / 127) * (1.5 - 0.8 * b);

  // A fork peels away from its parent's line, starting tangent to it: that is what makes a whiplash.
  function forkTip(t, e, w) {
    const s = t.s, n = s.xs.length - 1, sign = Math.random() < 0.5 ? -1 : 1;
    const k = newStem(s.xs[n], s.ys[n], Math.min(t.w * 0.85, w));
    s.kids.push({ i: n, s: k });
    newTip(k, t.ang + sign * 0.18, e, Math.min(t.w * 0.85, w), sign * (0.035 + Math.random() * 0.03));
  }
  // No tip near this note: a new shoot from the nearest stem (dry ruins count), else a new root from an edge.
  function shoot(px, e, w, n, x) {
    let best = null, bi = 0, bs = 1e9;
    const span = x.W * 0.2;
    for (const s of stems) {
      if (s.gone) continue;
      const from = s.fr === null ? 1 : Math.max(1, s.fr + ZONE);
      if (s.rem <= 0 && from >= s.xs.length - 1) continue;
      const i0 = s.rem > 0 ? 1 : Math.ceil(from);
      for (let i = i0; i < s.xs.length - 1; i += 7) {
        const dx = Math.abs(s.xs[i] - px); if (dx > span) continue;
        const score = dx + occAt(s.xs[i], s.ys[i]) * 5 + Math.random() * 70;
        if (score < bs) { bs = score; best = s; bi = i; }
      }
    }
    if (best) {
      const a = Math.atan2(best.ys[bi + 1] - best.ys[bi - 1], best.xs[bi + 1] - best.xs[bi - 1]), sign = Math.random() < 0.5 ? -1 : 1;
      const kw = Math.min(w, best.rem > 0 ? w : best.ws[bi] * 0.9);
      const k = newStem(best.xs[bi], best.ys[bi] + (best.rem > 0 ? best.sag : 0), kw);
      if (best.rem <= 0) best.kids.splice(best.kp + lowerBound(best.kids.slice(best.kp), bi), 0, { i: bi, s: k });
      const t = newTip(k, a + (Math.random() < 0.5 ? 0 : Math.PI) + sign * 0.18, e, kw, sign * (0.03 + Math.random() * 0.03));
      bud(k.xs[0], k.ys[0], 1.6 + kw * 0.7);
      return t;
    }
    const T = pitchT(n.m);
    let sx, sy, a;
    if (T < 0.33) { sx = -2; sy = x.rnd(0.12, 0.88) * x.H; a = x.rnd(-0.5, 0.5); }
    else if (T > 0.67) { sx = x.W + 2; sy = x.rnd(0.12, 0.88) * x.H; a = Math.PI + x.rnd(-0.5, 0.5); }
    else if (Math.random() < 0.5) { sx = px; sy = x.H + 2; a = -Math.PI / 2 + x.rnd(-0.5, 0.5); }
    else { sx = px; sy = -2; a = Math.PI / 2 + x.rnd(-0.5, 0.5); }
    return newTip(newStem(sx, sy, w), a, e, w);
  }
  const lowerBound = (kids, i) => { let k = 0; while (k < kids.length && kids[k].i < i) k++; return k; };

  function beginCurl(t, x) {
    const c = x.p('curl');
    t.curl = true;
    t.dir = (t.c + Math.sin(t.ph) * t.pa >= 0 ? 1 : -1) * (Math.random() < 0.3 ? -1 : 1);
    t.r = (7 + 46 * c) * (0.5 + Math.random()) * (0.75 + 0.2 * Math.min(3, t.w));
    t.L = t.r * (2.6 + 3.5 * c);
    t.turned = 0;
    t.maxTurn = 0.35 + 17 * c * c + 1.6 * c;                                  // a hook at the left end, three turns at the right
  }
  function endTip(t) { t.dead = true; t.s.tip = null; }

  // One point further along. Curls take short steps, or the spirals would show their corners.
  function advance(t, st, x, b) {
    const s = t.s, n = s.xs.length - 1;
    t.e -= st;
    if (t.curl) {
      t.r *= Math.exp(-st / t.L);
      const turn = st / t.r;
      t.ang += turn * t.dir; t.turned += turn;
      t.w = Math.max(0.3, t.w * Math.exp(-st / (t.L * 1.4)));
      if (t.turned > t.maxTurn || t.r < 1.2) { endTip(t); return; }
    } else {
      t.wander -= st;
      if (t.wander <= 0) { t.wander = 60 + Math.random() * 150; t.ct = (Math.random() - 0.5) * 0.028; }
      t.c += (t.ct - t.c) * st / 70;
      t.ph += st * t.pf;
      t.peel *= Math.exp(-st / 38);
      t.w += (t.wT - t.w) * st / 60;
      t.wT = Math.max(0.42, t.wT * Math.exp(-st / 520));
      // Hunting for open space: turn away from whichever side is fuller, near and further out.
      const lx = Math.cos(t.ang - 0.7), ly = Math.sin(t.ang - 0.7), rx = Math.cos(t.ang + 0.7), ry = Math.sin(t.ang + 0.7), px = s.xs[n], py = s.ys[n];
      const diff = occAt(px + lx * 44, py + ly * 44) - occAt(px + rx * 44, py + ry * 44) + 0.6 * (occAt(px + lx * 120, py + ly * 120) - occAt(px + rx * 120, py + ry * 120));
      t.st += (Math.max(-0.03, Math.min(0.03, diff * 0.0024)) - t.st) * Math.min(1, st / 34);
      // Near the frame a stem either runs off it or whips round inward: it never follows the edge.
      t.whipIn -= st;
      if (t.whipIn <= 0 && (px < 70 || py < 70 || px > x.W - 70 || py > x.H - 70)) {
        let d = Math.atan2(x.H / 2 - py, x.W / 2 - px) - t.ang;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) > 1) { t.whipIn = 140; if (Math.random() < 0.72) t.peel = Math.sign(d) * (0.034 + Math.random() * 0.018); else t.whipIn = 1e4; }
      }
      t.ang += (t.c + Math.sin(t.ph) * t.pa + t.peel + t.st) * st;
      if (occAt(px + Math.cos(t.ang) * 26, py + Math.sin(t.ang) * 26) > 16 + 26 * b) t.e -= st * 3;   // crowded: it gives up sooner
      if (t.e <= 0) beginCurl(t, x);
    }
    const nx = s.xs[n] + Math.cos(t.ang) * st, ny = s.ys[n] + Math.sin(t.ang) * st;
    if (nx < -30 || ny < -30 || nx > x.W + 30 || ny > x.H + 30) { endTip(t); return; }
    s.xs.push(nx); s.ys.push(ny); s.ws.push(t.w * (1 + 0.42 * Math.sin(t.ph * 0.63))); s.ts.push(clock);   // lines that swell and thin
    live++; mark(nx, ny, 1);
  }

  function growTips(x, dt) {
    const S = speedK(x), b = x.p('branch');
    const crawl = (9 + 26 * health) * S;
    const k1 = Math.exp(-dt / 0.09), k2 = Math.exp(-dt / 1.1);
    const full = live > CAP;
    for (const t of tips) {
      t.v1 *= k1; t.v2 *= k2; t.flash *= Math.exp(-dt / 0.18);
      if (!t.curl) {
        t.e -= dt * (6 + 70 * (1 - health));                                  // between attacks a tip runs down and starts to curl
        if (t.e <= 0 || full) { t.e = 0; beginCurl(t, x); }
      }
      let v = crawl + t.v1 + t.v2;
      if (t.curl) v = Math.max(v, 18 * Math.sqrt(S));
      t.acc += v * dt;
      for (let guard = 0; guard < 60 && !t.dead; guard++) {
        const st = t.curl ? Math.max(1.5, Math.min(5, t.r * 0.42)) : 5;
        if (t.acc < st) break;
        t.acc -= st;
        advance(t, st, x, b);
      }
    }
    if (tips.some((t) => t.dead)) tips = tips.filter((t) => !t.dead);
  }

  function crumble(s, i, chance) {
    if (dust.length >= 520 || Math.random() > chance) return;
    const late = Math.random();
    dust.push({ x: s.xs[i], y: s.ys[i] + s.sag, vx: (Math.random() - 0.5) * 7, vy: 3 + Math.random() * 12, a: 0, l: 1.4 + Math.random() * 2.6, r: 0.7 + Math.random() * Math.min(1.6, s.ws[i] * 0.6), c: late < 0.55 ? 9 : 11 });
  }
  function witherStems(x, dt) {
    const wK = x.p('wither');
    const force = Math.max(0, (live - CAP * 0.82) / (CAP * 0.18));            // over the point budget the oldest die faster, whatever the knob says
    const thin = 1 - health;
    let fronts = 0;
    startIn -= dt * (2.2 * wK + force * 24);                                  // they start one after another, the oldest first
    for (const s of stems) if (s.fr !== null && s.rem <= 0) fronts++;
    const fv = wK * (5 + 10 * thin) + force * 34;
    const ageing = wK * (0.1 + 2.2 * thin * thin);
    for (const s of stems) {
      if (s.gone) continue;
      if (s.rem > 0) {
        if (wK > 0 || force > 0) s.rem -= dt * (wK * 0.8 + force * 8);
        if (s.rem <= 0) {
          for (let i = 0; i < s.xs.length; i += 5) crumble(s, i, 0.7);
          live -= s.xs.length; s.gone = true; dirty = true;
        }
        continue;
      }
      if (s.fr === null) {
        s.cl += dt * ageing;
        if ((s.cl > 8 || force > 0) && fronts < MAX_FRONTS && startIn <= 0) { s.fr = -ZONE; fronts++; startIn = 1; }
        continue;
      }
      s.fr += fv * dt;
      const n = s.xs.length, end = Math.min(n, Math.floor(s.fr) + 1);
      while (s.pass < end) {
        const i = s.pass++;
        mark(s.xs[i], s.ys[i], -1);
        if (s.dry) crumble(s, i, 0.12);
        else { crumble(s, i, 0.5); live--; }
        while (s.kp < s.kids.length && s.kids[s.kp].i <= i) {                 // what grew from here starts to go too
          const k = s.kids[s.kp++].s;
          if (k.fr === null && !k.gone) k.cl = 1e3;
        }
      }
      if (s.fr >= s.xs.length - 1) {
        if (s.tip) endTip(s.tip);
        if (s.dry) { s.rem = 18 + Math.random() * 34; s.fr = s.xs.length; s.sd = s.sa = s.sb = 0; dirty = true; }
        else s.gone = true;
      }
    }
    if (tips.some((t) => t.dead)) tips = tips.filter((t) => !t.dead);
    if (stems.some((s) => s.gone)) stems = stems.filter((s) => !s.gone);
  }

  // One stem's segments [i0, i1) into per-colour, per-width paths.
  function emit(s, i0, i1, paths, weight) {
    const f = s.fr === null ? -1e9 : s.fr, xs = s.xs, ys = s.ys, ws = s.ws, ts = s.ts;
    const dy = (i) => (i < f ? s.sag : i < f + ZONE ? s.sag * (1 - (i - f) / ZONE) ** 2 : 0);
    for (let i = Math.max(0, i0); i < i1; i++) {
      let col, wS = 1;
      if (i < f) { if (!s.dry) continue; col = DRY; wS = 0.42; }
      else if (i < f + ZONE) { const p = 1 - (i - f) / ZONE; col = DYING + Math.min(6, Math.floor(p * 7)); wS = 1 - 0.62 * p; }
      else { const a = clock - ts[i]; col = a < 0.5 ? 0 : a < 1.6 ? 1 : 2 + Math.min(3, Math.floor((a / AGE_T) * 4)); }
      const k = Math.max(0, Math.min(NW - 1, Math.round(Math.log(Math.max(0.5, ws[i] * wS * weight) / 0.5) / LOG)));
      const key = col * NW + k;
      let e = paths[key];
      if (!e) e = paths[key] = { p: new Path2D(), lx: 1e9, ly: 1e9 };
      const y0 = ys[i] + dy(i), y1 = ys[i + 1] + dy(i + 1);
      if (e.lx !== xs[i] || e.ly !== y0) e.p.moveTo(xs[i], y0);
      e.p.lineTo(xs[i + 1], y1);
      e.lx = xs[i + 1]; e.ly = y1;
    }
  }
  function strokeAll(c, paths) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let col = DRY; col >= 0; col--) {                                    // the dead underneath, the living on top
      for (let k = 0; k < NW; k++) {
        const e = paths[col * NW + k];
        if (e) { c.strokeStyle = COLS[col]; c.lineWidth = widthOf(k); c.stroke(e.p); }
      }
    }
  }
  function repaint(x) {
    sg.clearRect(0, 0, x.W, x.H);
    const paths = [], weight = x.p('weight'), wK = x.p('wither');
    const margin = 4 + Math.ceil(Math.max(40, wK * 60 + 40) * REPAINT);
    for (const s of stems) {
      const last = s.xs.length - 1;
      if (s.rem > 0) { s.sd = last; s.sa = s.sb = last; emit(s, 0, last, paths, weight); continue; }
      if (s.fr === null) { s.sd = 0; s.sa = 0; }
      else {
        s.sd = s.dry ? Math.max(0, Math.floor(s.fr) - 1) : Math.max(0, Math.floor(s.fr));
        s.sa = Math.min(last, Math.max(0, Math.ceil(s.fr) + ZONE + margin));
        if (s.dry && s.sd > 0) emit(s, 0, s.sd, paths, weight);
      }
      s.sb = Math.max(s.sa, s.tip ? last - 1 : last);
      if (s.sa < s.sb) emit(s, s.sa, s.sb, paths, weight);
    }
    strokeAll(sg, paths);
    sinceRepaint = 0; dirty = false;
  }

  // The knobs' pictures: a small line that does what the knob does.
  const stemIcon = (g, w, h, len, col, lw = 1.5) => {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
    for (let i = 0; i <= 24; i++) { const f = i / 24 * len, px = 3 + f * (w - 6), py = h / 2 + Math.sin(f * 7) * h * 0.26; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  };
  const spiralIcon = (g, cx, cy, r, turns, col) => {
    g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath();
    for (let i = 0; i <= 44; i++) { const f = i / 44, a = f * turns * 6.28, q = r * (1 - f * 0.92), px = cx + Math.cos(a) * q, py = cy + Math.sin(a) * q; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  };

  TOOLS.push({
    id: 'vine', name: 'Vine', tag: 'new',
    blurb: 'Thin stems creep out, fork and curl on the notes and stay. When the music thins out they wither from their oldest ends, sag and crumble, and the next theme grows out of what is left.',
    params: [
      { key: 'spread', label: 'how fast it spreads', min: 0.05, max: 3, value: 1,
        hint: 'How fast the tips travel; richer music always pushes them on. Left: it barely creeps. Right: it races across the screen.',
        icon: (g, v, w, h) => stemIcon(g, w, h, 0.08 + 0.92 * v, '#8fd63f') },
      { key: 'wither', label: 'how fast it withers', min: 0, max: 2, value: 1, drive: '-level',
        hint: 'How quickly old stems die back from their oldest ends. Left: nothing ever dies. Right: it dies back as fast as it grows.',
        icon: (g, v, w, h) => { stemIcon(g, w, h, 1, '#2a8a5c'); g.save(); g.beginPath(); g.rect(0, 0, v * w, h); g.clip(); stemIcon(g, w, h, 1, '#b08a2e'); g.restore(); } },
      { key: 'branch', label: 'how readily it forks', min: 0, max: 1, value: 0.45,
        hint: 'How many stems grow at once. Left: a few long stems. Right: a dense thicket.',
        icon: (g, v, w, h) => { const n = 1 + Math.round(v * 6); for (let i = 0; i < n; i++) { const d = n === 1 ? 0 : (i / (n - 1) - 0.5) * (h - 6); ICON.line(g, 4, h / 2, w - 4, h / 2 + d, '#8fd63f', 1.2); } } },
      { key: 'curl', label: 'how much it curls', min: 0, max: 1, value: 0.5,
        hint: 'What a stem does when it runs out of strength. Left: it stops as a long open line. Right: it winds into a big spiral.',
        icon: (g, v, w, h) => spiralIcon(g, w / 2, h / 2, 4 + v * 7, 0.3 + v * 3, '#8fd63f') },
      { key: 'weight', label: 'how thick the stems are', min: 0.3, max: 4.5, value: 1,
        hint: 'How thick the lines are drawn. Left: hair. Right: heavy ropes.',
        icon: (g, v, w, h) => stemIcon(g, w, h, 1, '#8fd63f', 0.6 + v * 5) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: a faint, slow network that only the hardest attacks make grow. Right: every note feeds it at full strength.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => stemIcon(g, w, h, 1, '#8fd63f')) },
    ],
    reset(x) {
      stems = []; tips = []; dust = []; buds = []; live = 0; startIn = 0; health = 0.3; clock = 0; sinceRepaint = 0; dirty = true;
      hardVels = null;
      if (x) { ctxW = x.W; ctxH = x.H; }
      cols = Math.ceil(ctxW / CELL); rows = Math.ceil(ctxH / CELL); occ = new Float32Array(cols * rows);
      if (!settled) { settled = document.createElement('canvas'); settled.width = ctxW; settled.height = ctxH; sg = settled.getContext('2d'); }
      sg.clearRect(0, 0, ctxW, ctxH);
    },
    onChord(ch, x) {
      if (!occ) this.reset(x);
      const notes = ch.notes.filter((n) => hardEnough(n.v, x));
      if (!notes.length) return;
      const S = speedK(x), b = x.p('branch'), maxTips = 3 + Math.round(46 * b * b);
      // Every tip jerks forward in the same frame. Fast music gets smaller jerks, or a run would fill the page in seconds.
      const kick = (3 + 15 * ch.vel / 127) * S / (1 + 0.35 * x.rate);
      for (const t of tips) { t.v1 += kick / 0.09; t.v2 = Math.min(60 * S, t.v2 + 7 * S); t.flash = Math.max(t.flash, 0.6); }
      let taker = null;
      for (const n of notes.slice(0, 6)) {
        const px = (0.05 + 0.9 * pitchT(n.m)) * x.W, e = noteEnergy(n, b), w = noteWidth(n);
        let best = null, bd = tips.length >= maxTips ? 1e9 : x.W * 0.17;
        for (const t of tips) {
          if (t.curl) continue;
          const d = Math.abs(t.s.xs[t.s.xs.length - 1] - px);
          if (d < bd) { bd = d; best = t; }
        }
        if (best) {
          best.e = Math.min(520, best.e + e * 0.45); best.wT = Math.max(best.wT, w); best.flash = 1;
          const q = best.s, m = q.xs.length - 1;
          bud(q.xs[m], q.ys[m], 1.8 + w * 0.8 + n.v / 60);
          taker = best;
        } else if (tips.length < maxTips) taker = shoot(px, e, w, n, x);
      }
      // A chord splits a tip: a big one three or four ways.
      if (taker && !taker.curl && !taker.dead) {
        const size = notes.length;
        let forks = size >= 3 ? Math.min(4, size - 1) * Math.min(1, b * 1.8) : Math.random() < b * 0.2 ? 1 : 0;
        forks = Math.floor(forks + Math.random());
        for (let i = 0; i < forks && tips.length < maxTips; i++) forkTip(taker, Math.max(30, taker.e * 0.6), noteWidth(notes[Math.min(i, size - 1)]));
      }
    },
    frame(x) {
      if (!occ) this.reset(x);
      const g = x.g, dt = x.dt, pres = x.p('presence');
      if (dt > 0) {
        clock += dt;
        const f = x.feat, want = Math.min(1, 0.9 * f.rate + 0.35 * f.level + 0.4 * f.density);
        health += (want - health) * (1 - Math.exp(-dt / (want > health ? 2.5 : 5)));
        growTips(x, dt);
        witherStems(x, dt);
        sinceRepaint += dt;
        for (const s of stems) if (s.fr !== null && s.rem <= 0 && s.fr + ZONE > s.sa && s.sa < s.xs.length - 1) { dirty = true; break; }
        if (dirty || sinceRepaint >= REPAINT) repaint(x);
        for (const d of dust) { d.a += dt; d.vy += dt * 7; d.x += d.vx * dt; d.y += d.vy * dt; }
        if (dust.some((d) => d.a > d.l)) dust = dust.filter((d) => d.a <= d.l);
        for (const q of buds) q.a += dt;
        if (buds.some((q) => q.a > 0.5)) buds = buds.filter((q) => q.a <= 0.5);
      }
      const alpha = Math.max(0.05, Math.pow(pres, 1.3));
      g.globalAlpha = pres; g.fillStyle = '#14100f'; g.fillRect(0, 0, x.W, x.H);
      g.globalAlpha = alpha;
      g.drawImage(settled, 0, 0);
      // Live: everything the offscreen canvas left out, that is the dying stretches and the newest growth.
      const paths = [], weight = x.p('weight');
      for (const s of stems) {
        if (s.rem > 0) continue;
        const last = s.xs.length - 1;
        if (s.fr !== null && s.sd < s.sa) emit(s, s.sd, Math.min(s.sa, last), paths, weight);
        if (s.sb < last) emit(s, s.sb, last, paths, weight);
      }
      strokeAll(g, paths);
      // Each tip's head, moving smoothly between its points.
      for (const t of tips) {
        const s = t.s, n = s.xs.length - 1, hx = s.xs[n] + Math.cos(t.ang) * t.acc, hy = s.ys[n] + Math.sin(t.ang) * t.acc;
        g.strokeStyle = COLS[0]; g.lineWidth = Math.max(0.5, t.w * weight); g.lineCap = 'round';
        g.beginPath(); g.moveTo(s.xs[n], s.ys[n]); g.lineTo(hx, hy); g.stroke();
        const r = (0.5 + Math.min(4, t.w * weight) * 0.42) * (1 + t.flash * 1.3);
        if (t.flash > 0.05) { g.globalAlpha = alpha * 0.4 * t.flash; g.fillStyle = '#b6e85a'; g.beginPath(); g.arc(hx, hy, r * 2.4, 0, 6.2832); g.fill(); }
        g.globalAlpha = alpha; g.fillStyle = '#f4ffd8'; g.beginPath(); g.arc(hx, hy, r, 0, 6.2832); g.fill();
      }
      for (const q of buds) {
        const k = 1 - q.a / 0.5, r = q.r * (0.9 + k * 0.6) * Math.min(1.8, 0.6 + weight * 0.4);
        g.globalAlpha = alpha * k * k; g.fillStyle = '#fbffe8'; g.beginPath(); g.arc(q.x, q.y, r, 0, 6.2832); g.fill();
      }
      for (const d of dust) {
        g.globalAlpha = alpha * Math.max(0, 1 - d.a / d.l) * 0.9; g.fillStyle = COLS[d.c];
        g.fillRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
      }
      g.globalAlpha = 1;
    },
  });
})();
