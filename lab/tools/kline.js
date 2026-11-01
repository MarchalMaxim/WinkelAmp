// Kline: after Franz Kline. Big chords strike huge black bars and girders onto a bone-white ground (or bone on black: the default since v2, the colours the user picked).
// One stroke per big attack: its length from the chord's span, its angle from its register (low = lying beam,
// high = standing post), its weight from how hard it is struck; soft strikes leave drier, broken bristle edges.
// Strokes soak slowly back into the ground, leaving grey ghosts; quiet music leaves the canvas almost empty.
// v2: "big" is judged against the music around a chord too (a forte after a piano passage, a chord breaking a silence),
// and every other chord lays one short brush mark: the marks chain into a broken, cornering line (a leap turns a corner,
// the melody nudges it up and down), staccato gives stubs, held notes longer strokes, loud ones wet slabs, soft ones dry
// wire. Older bars grey as new ones land, and the scratched streaks in the paint are bunched and tapered.
// v3 (the user: the paint-over brush seemed to answer the music, but only replayed an attack from `stay` seconds back):
// nothing moves unless the music moves it. Bars and marks fade without motion and with no sudden start, so no moment of
// it reads as a beat; a bar is painted over (the brush sweeps) only at the instant a new bar lands and pushes it out.
// And a colour knob: ink, blood red, yellow or blue.
// The weight knob reaches further left than its old 0.35 (the user: sliders should dim, not only boost): from 0.35 down to
// 0.1 the strokes go on thinning, the ink fades and fewer chords land, until only this piece's hardest leave a faint line.
// Every value from 0.35 up draws exactly what it always drew.
(() => {
  const DEG = Math.PI / 180;
  const BONE = '#e7dfcc', BONE_INK = '#ece4d2', BLACK = '#0d0b0a', NIGHT = '#100e0d';
  // the colour knob: ink (black on bone, bone on black), then blood red, yellow and blue, each a shade for either ground
  const INKS = [[BLACK, BONE_INK], ['#a3121a', '#c8141e'], ['#c99a06', '#f2c418'], ['#1c3a9e', '#3d63d6']];
  const WIPE = 0.3;   // seconds a pushed-out bar takes to be painted over, starting on the new bar's attack
  const MAX_LIVE = 6, MAX_MARKS = 44;
  let strokes = [], marks = [], chain = null, localV = null;
  let lastChordT = -99, lastStrikeT = -99, ground = [null, null], pool = {}, pctTable = null;

  // Seeded random, so a stroke can be re-rendered identically in the other colour.
  const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const inkOf = (x) => clamp(Math.round(x.p('colour')), 0, INKS.length - 1);
  // how firm the hand is: 1 at any weight from 0.35 up, 0 at the left end of the knob (0.1)
  const firmOf = (x) => { const w = x.p('weight'); return w >= 0.35 ? 1 : clamp((w - 0.1) / 0.25, 0, 1); };

  // How big a chord is compared with the rest of this piece: the share of the song's chords that are softer (0..1).
  function buildPct() {
    const N = window.NOTES || [], C = [];
    for (const [s, , , v] of N) { const l = C[C.length - 1]; if (l && s - l.t < 0.04) l.vel = Math.max(l.vel, v); else C.push({ t: s, vel: v }); }
    pctTable = C.map((c) => c.vel).sort((a, b) => a - b);
  }
  function pct(v) {
    if (!pctTable) buildPct();
    const t = pctTable; if (!t.length) return v / 127;
    let a = 0, b = t.length; while (a < b) { const k = (a + b) >> 1; if (t[k] < v) a = k + 1; else b = k; }
    return a / t.length;
  }

  // One dry-brush bar, drawn once into its own canvas along +x: starts at (pad, cy), length L, thickness T.
  function renderStroke(sp, col, k = 1) {   // k < 1: a cheaper, lower-resolution canvas
    const { L, T, dry, seed, taper } = sp, R = rng(seed);
    const pad = Math.ceil(T * 0.35 + 6), bendA = T * 0.07 * (R() - 0.5) * 2, bendF = 0.6 + R() * 1.2, bendP = R() * 6;
    const cw = Math.ceil(L + pad * 2), ch = Math.ceil(T * 1.25 + pad * 2), cy = ch / 2;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(cw * k); cv.height = Math.ceil(ch * k);
    const c = cv.getContext('2d'); c.scale(k, k); c.fillStyle = col; c.beginPath();
    const yAt = (x, f) => { const u = x / L; return cy + bendA * Math.sin(u * Math.PI * bendF + bendP) + f * T * (1 - taper * Math.pow(u, 1.5) + 0.05 * Math.sin(u * 9 + bendP)); };
    const nb = clamp(Math.round(T / 1.7), 16, 96), bw = (T / nb) * 1.8, step = 4;
    const quad = (x0, x1, f) => {
      for (let a = x0; a < x1; a += 40) {
        const b = Math.min(x1, a + 40), ya = yAt(a, f), yb = yAt(b, f);
        c.moveTo(pad + a, ya - bw / 2); c.lineTo(pad + b, yb - bw / 2); c.lineTo(pad + b, yb + bw / 2); c.lineTo(pad + a, ya + bw / 2); c.closePath();
      }
    };
    // the loaded middle of the brush: one solid band (cheap), ending where the paint starts to run out
    const core = 0.36 - 0.14 * dry, x0c = T * 0.05, x1c = Math.max(x0c + 10, L * (1 - dry * 0.5) - T * 0.15);
    c.moveTo(pad + x0c, yAt(x0c, -core));
    for (let x = x0c; x <= x1c; x = Math.min(x1c, x + 60)) { c.lineTo(pad + x, yAt(x, -core)); if (x === x1c) break; }
    for (let x = x1c; x >= x0c; x = Math.max(x0c, x - 60)) { c.lineTo(pad + x, yAt(x, core)); if (x === x0c) break; }
    c.closePath();
    for (let i = 0; i < nb; i++) {
      const f = (i + 0.5) / nb - 0.5, e = Math.abs(f) * 2, e2 = e * e, inCore = Math.abs(f) < core - bw / T;
      // a blunt, slightly ragged head; the edges start a touch later (a rounded brush); middle bristles only add the tail
      const x0 = inCore ? x1c - T * 0.1 * R() : R() * T * 0.05 + e2 * e2 * T * 0.22 * (0.5 + R());
      // the paint runs out: earlier on the edges, and much earlier when the brush is dry
      const xEnd = L * (1 - dry * (0.08 + 0.42 * e * R() + 0.3 * R() * R())) - R() * T * 0.25 * (0.3 + e);
      let x = x0, on = true, runStart = x0;
      const pGap = (u) => (dry * (0.0004 + 0.007 * e2 + 0.012 * u * u) + 0.0005 * e2) * step;
      const pBack = (0.02 + (1 - dry) * 0.07) * step;
      while (x < xEnd) {
        const u = x / L;
        if (on && R() < pGap(u)) { if (x - runStart > 1) quad(runStart, x, f); on = false; }
        else if (!on && R() < pBack) { on = true; runStart = x; }
        x += step;
      }
      if (on && xEnd - runStart > 1) quad(runStart, xEnd, f);
    }
    c.fill();
    // dry streaks scratched through the loaded middle: in bunches (a few bristles that ran dry together), more of them
    // toward the end where the paint runs out, each a tapered sliver following the bend, some only half cut (grey)
    c.globalCompositeOperation = 'destination-out';
    const streak = (a, b, f, wd) => {
      const n = Math.max(2, Math.ceil((b - a) / 28)); c.beginPath();
      for (let i = 0; i <= n; i++) { const xx = a + ((b - a) * i) / n; c.lineTo(pad + xx, yAt(xx, f) - wd * 0.5 * Math.sqrt(Math.sin((Math.PI * i) / n)) - 0.05); }
      for (let i = n; i >= 0; i--) { const xx = a + ((b - a) * i) / n; c.lineTo(pad + xx, yAt(xx, f) + wd * 0.5 * Math.sqrt(Math.sin((Math.PI * i) / n)) + 0.05); }
      c.closePath(); c.fill();
    };
    for (let bn = 0, nBunch = 2 + Math.round(3 * dry + R() * 2); bn < nBunch; bn++) {
      const f0 = (R() - 0.5) * 2 * core * 0.85, a0 = x0c + Math.pow(R(), 0.65) * (x1c - x0c) * 0.85;
      for (let j = 0, n = 2 + Math.floor(R() * (3 + 6 * dry)); j < n; j++) {
        const f = f0 + (R() - 0.5) * 0.1, a = a0 + (R() - 0.3) * L * 0.1;
        const b = Math.min(x1c + T * 0.3, a + (0.04 + 0.5 * R() * R() * (0.4 + dry)) * L);
        if (b - a < 8) continue;
        c.globalAlpha = 0.35 + R() * 0.65;
        streak(a, b, f, 0.6 + R() * R() * (1.2 + 2.8 * dry) * Math.min(1.6, T / 40));
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // a few drags of thinned paint past the end, on dry strokes
    if (dry > 0.35) {
      c.globalAlpha = 0.55;
      for (let k = 0; k < 6 * dry; k++) {
        const f = (R() - 0.5) * 0.8, a = L * (0.7 + R() * 0.2), b = Math.min(L + pad * 0.6, a + L * 0.25 * R());
        c.fillRect(pad + a, yAt(a, f) - bw * 0.4, b - a, bw * 0.8);
      }
    }
    return { cv, pad, cy, w: cw, h: ch, k };
  }
  const sprite = (s, mode, ink = 0) => (s.sp[mode * 8 + ink] ??= renderStroke(s, INKS[ink][mode]));
  // the overpainting: a ground-coloured dry stroke dragged along the bar, a little wider, so streaks of the bar show through
  const cover = (s, mode) => (s.cv[mode] ??= renderStroke({ L: s.L + s.T * 0.3, T: s.T * 1.12, dry: 0.72 + s.dry * 0.2, seed: s.seed + 7, taper: 0.06 }, mode ? NIGHT : BONE, 0.5));
  // the bar's own shape in the ground colour (a cheap copy of its sprite): laid under a greyed bar, so the grey stays
  // opaque paint and greyed bars that cross do not show through each other like glass
  const under = (s, mode) => (s.un[mode] ??= (() => {
    const sp = sprite(s, mode), cv = document.createElement('canvas'); cv.width = sp.cv.width; cv.height = sp.cv.height;
    const c = cv.getContext('2d'); c.drawImage(sp.cv, 0, 0);
    c.globalCompositeOperation = 'source-in'; c.fillStyle = mode ? NIGHT : BONE; c.fillRect(0, 0, cv.width, cv.height);
    return cv;
  })());

  // The ground: bone (or near-black) with faint old overpainting in it.
  function makeGround(mode, W, H) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), R = rng(17 + mode);
    c.fillStyle = mode ? NIGHT : BONE; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = R() * W, y = R() * H, w = 120 + R() * 420, h = 18 + R() * 90;
      c.save(); c.translate(x, y); c.rotate((R() - 0.5) * 0.5 + (R() < 0.3 ? Math.PI / 2 : 0));
      c.globalAlpha = 0.025 + R() * 0.04;
      c.fillStyle = mode ? (R() < 0.5 ? '#1e1a17' : '#050404') : (R() < 0.6 ? '#f6f1e4' : '#c9bfa9');
      c.fillRect(-w / 2, -h / 2, w, h); c.restore();
    }
    return cv;
  }

  // The small marks: a dozen short brush strokes rendered once per colour (fixed seeds), then drawn rotated and scaled.
  // Index = thickness class (0 thin .. 3 thick) * 3 + wetness (0 dry .. 2 loaded).
  const MARK_L = 170, MARK_T = [8, 15, 24, 36], MARK_DRY = [0.88, 0.58, 0.3];
  function makePool(mode, ink) {
    const out = [];
    for (let i = 0; i < 12; i++) {
      const T = MARK_T[(i / 3) | 0], dry = MARK_DRY[i % 3];
      const sp = renderStroke({ L: MARK_L, T, dry, seed: 901 + i * 37, taper: 0.1 + (i % 2) * 0.08 }, INKS[ink][mode]);
      sp.T = T; out.push(sp);
    }
    return out;
  }

  // Where a new line of marks starts: off a joint of the latest bar (a rung, a ledge) or of the last line of marks,
  // or alone in the emptiest spot.
  function startChain(x, reg, order, R) {
    const W = x.W, H = x.H, live = strokes.filter((s) => s.q < 0.7 && !s.parent), recent = marks.filter((m) => m.q < 0.8);
    const raw = reg * 95, snap = raw < 45 ? 0 : 90;
    let hd = lerp(raw, snap, order) + (R() - 0.5) * 2 * (1 - order) * 25;
    if (R() < 0.5) hd += 180;
    const S = live.length ? live[live.length - 1] : recent.length > 3 ? recent[recent.length - 1 - Math.floor(R() * Math.min(10, recent.length))] : null;
    if (S && R() < 0.35 + 0.45 * order) {
      const sa = S.ang * DEG, t = 0.08 + R() * 0.84;
      const px = S.x + Math.cos(sa) * S.L * t, py = S.y + Math.sin(sa) * S.L * t;
      if (px > W * 0.08 && px < W * 0.92 && py > H * 0.1 && py < H * 0.9) {
        hd = S.ang + (R() < 0.5 ? 90 : -90) + (R() - 0.5) * (1 - order) * 50;
        return { x: px, y: py, hd, n: 0, t: -99, m: 0, ct: -99 };
      }
    }
    let best = null, bestD = -1;
    for (let k = 0; k < 6; k++) {
      const mx = W * (0.15 + R() * 0.7), my = H * clamp(0.72 - 0.44 * reg + (R() - 0.5) * 0.3, 0.15, 0.85);
      let dmin = 1e9;
      for (const s of live) dmin = Math.min(dmin, Math.hypot(s.mx - mx, s.my - my));
      for (let i = Math.max(0, marks.length - 12); i < marks.length; i++) dmin = Math.min(dmin, Math.hypot(marks[i].x - mx, marks[i].y - my) * 1.5);
      if (dmin > bestD) { bestD = dmin; best = [mx, my]; }
    }
    return { x: best[0], y: best[1], hd, n: 0, t: -99, m: 0, ct: -99 };
  }
  // Of turning left or right by `by` degrees, the way that heads more toward (tx, ty) from the chain's head.
  function turn(c, by, tx, ty) {
    const a = (c.hd + by) * DEG, b = (c.hd - by) * DEG, vx = tx - c.x, vy = ty - c.y;
    c.hd += (Math.cos(a) * vx + Math.sin(a) * vy >= Math.cos(b) * vx + Math.sin(b) * vy) ? by : -by;
  }

  // One small mark for a chord that does not strike a bar: laid at the head of the current line, which then moves on.
  function mark(ch, x, loud) {
    const W = x.W, H = x.H, order = x.p('order'), weight = x.p('weight'), R = Math.random;
    let mean = 0, d = 0; for (const n of ch.notes) { mean += n.m; d = Math.max(d, n.d); } mean /= ch.notes.length;
    const reg = clamp((mean - 38) / 40, 0, 1);
    if (!chain || ch.t - chain.t > 0.9 || chain.n >= 16) chain = startChain(x, reg, order, R);
    else {
      const iv = mean - chain.m;
      if (Math.abs(iv) >= 8 && ch.t - chain.ct >= 0.45 && R() < 0.3 + 0.5 * order) {
        // a leap turns a corner: up for a rising leap, down for a falling one
        turn(chain, 90 + (R() - 0.5) * (1 - order) * 50, chain.x, iv > 0 ? -1e4 : 1e4); chain.ct = ch.t;
      } else {
        // otherwise the melody nudges the line up or down (across its direction)
        chain.y -= clamp(iv, -6, 6) * 2.2 * Math.abs(Math.cos(chain.hd * DEG));
      }
    }
    // staccato leaves a stub, a held note a longer stroke; loud is thick and loaded, soft is thin and dry
    const Ld = (34 + 150 * clamp(d / 1.1, 0, 1)) * (0.8 + 0.45 * loud) * (0.9 + R() * 0.2);
    const Td = Math.max(5, (10 + 44 * Math.pow(loud, 1.2)) * weight * (1.15 - 0.35 * reg) * (0.85 + R() * 0.3));
    const ti = Td < 11 ? 0 : Td < 19 ? 1 : Td < 30 ? 2 : 3, wi = clamp(Math.floor(loud * 3 + (R() - 0.5) * 0.8), 0, 2);
    // stay on the canvas: at the edge, turn toward the middle
    const ex = chain.x + Math.cos(chain.hd * DEG) * Ld, ey = chain.y + Math.sin(chain.hd * DEG) * Ld;
    if (ex < W * 0.04 || ex > W * 0.96 || ey < H * 0.06 || ey > H * 0.94) turn(chain, 90 + (R() - 0.5) * (1 - order) * 40, W / 2, H / 2);
    const a2 = chain.hd + (R() - 0.5) * (2 + (1 - order) * 10);
    marks.push({ x: chain.x, y: chain.y, ang: a2, L: Ld, T: Td, v: ti * 3 + wi, age: 0, dur: 0.04 + Ld / 2400, q: 0 });
    const step = Ld * (0.55 + 0.25 * R());
    chain.x += Math.cos(a2 * DEG) * step; chain.y += Math.sin(a2 * DEG) * step;
    chain.x = clamp(chain.x, W * 0.03, W * 0.97); chain.y = clamp(chain.y, H * 0.05, H * 0.95);
    chain.t = ch.t; chain.m = mean; chain.n++;
    // too many: the oldest are painted over early
    for (let i = 0, live = marks.filter((m) => m.q < 1), over = live.length - MAX_MARKS; i < over; i++) live[i].q = 1;
  }

  function strike(ch, x, velN, delay = 0, parent = null) {
    const W = x.W, H = x.H, order = x.p('order'), weight = x.p('weight');
    const seed = (Math.random() * 1e9) | 0, R = rng(seed);
    let mean = 0; for (const n of ch.notes) mean += n.m; mean /= ch.notes.length;
    const reg = clamp((mean - 38) / 40, 0, 1), span = ch.hi - ch.lo, n = ch.notes.length;
    // angle: low chords lie flat, high chords stand up; "rigid" snaps them to beams and posts
    const raw = reg * 95, snap = raw < 45 ? 0 : 90;
    let ang = lerp(raw, snap, order) + (R() - 0.5) * 2 * (1 - order) * 22 + (R() - 0.5) * 5;
    if (R() < 0.5) ang = -ang;               // which way the diagonal leans
    if (R() < 0.5) ang += 180;                // which end the brush starts from
    let L = (0.4 + span / 32 + Math.min(n - 1, 5) * 0.03) * 0.75 * W * (0.85 + R() * 0.3);
    let T = (24 + 112 * Math.pow(velN, 1.5)) * weight * (1.2 - 0.4 * reg);
    if (parent) { L *= 0.6 + R() * 0.4; T *= 0.55; ang = parent.ang; }
    L = clamp(L, 200, 1.55 * W); T = clamp(T, 6, L * 0.3);
    const dry = clamp(0.85 - velN * 0.6 + (R() - 0.5) * 0.24, 0.22, 0.95);
    const a = ang * DEG, dx = Math.cos(a), dy = Math.sin(a);
    let sx, sy;
    if (parent) {   // a second, thinner bar alongside: a girder
      const off = parent.T * (0.95 + R() * 0.5) * (R() < 0.5 ? 1 : -1);
      const u = R() * 0.25;
      sx = parent.x - dy * off + dx * parent.L * u; sy = parent.y + dx * off + dy * parent.L * u;
    } else {
      const live = strokes.filter((s) => s.q < 0.8 && !s.parent);
      if (live.length && R() < 0.3 + 0.45 * order) {
        // build onto an existing bar: start at a joint on it, or cross it
        const S = live[live.length - 1 - Math.floor(R() * Math.min(4, live.length))];
        const sa = S.ang * DEG, t = R() < 0.5 ? (R() < 0.5 ? 0.05 : 0.92) : 0.15 + R() * 0.7;
        const px = S.x + Math.cos(sa) * S.L * t, py = S.y + Math.sin(sa) * S.L * t;
        let d = Math.abs(((ang - S.ang) % 180 + 180) % 180); d = Math.min(d, 180 - d);
        if (d < 25 && order > 0.4) { ang += 90; }   // meet it at an angle, never lie along it
        const b = ang * DEG, u = R() < 0.55 ? 0.02 : 0.2 + R() * 0.6;
        sx = px - Math.cos(b) * L * u; sy = py - Math.sin(b) * L * u;
      } else {
        // free: of a few spots, the one farthest from the bars already there (low chords sit lower)
        let best = null, bestD = -1;
        for (let k = 0; k < 6; k++) {
          const mx = W * (0.12 + R() * 0.76), my = H * clamp(0.72 - 0.42 * reg + (R() - 0.5) * 0.4, 0.14, 0.86);
          let dmin = 1e9; for (const s of live) dmin = Math.min(dmin, Math.hypot(s.mx - mx, s.my - my));
          if (dmin > bestD) { bestD = dmin; best = [mx, my]; }
        }
        sx = best[0] - dx * L / 2; sy = best[1] - dy * L / 2;
      }
      // a bar built off a joint near the edge could land mostly off the canvas: slide it back in until most of it shows
      const fa0 = ang * DEG, ex = Math.cos(fa0), ey = Math.sin(fa0);
      let inside = 0;
      for (let i = 0; i <= 10; i++) { const px = sx + ex * L * i / 10, py = sy + ey * L * i / 10; if (px > 0 && px < W && py > 0 && py < H) inside++; }
      if (inside < 7) {
        const mx = sx + ex * L / 2, my = sy + ey * L / 2;
        sx += clamp(mx, W * 0.22, W * 0.78) - mx; sy += clamp(my, H * 0.22, H * 0.78) - my;
      }
    }
    const fa = ang * DEG;
    const s = { x: sx, y: sy, ang, L, T, dry, seed, taper: 0.05 + R() * 0.2, sp: {}, cv: [null, null], un: [null, null], parent: !!parent,
      mx: sx + Math.cos(fa) * L / 2, my: sy + Math.sin(fa) * L / 2, age: -delay, dur: 0.06 + L / (3200 + 4000 * velN), q: 0, dim: 0, a: 1 };
    sprite(s, x.p('ground') >= 0.5 ? 1 : 0, inkOf(x));
    strokes.push(s);
    return s;
  }

  TOOLS.push({
    id: 'kline', name: 'Kline', tag: 'v3',
    blurb: 'After Franz Kline: the biggest chords strike huge bars (low ones lie flat, high ones stand up, full ones get a girder beside them), and slowly soak back into the ground. New in v3: nothing moves unless the music moves it: bars fade without motion, and a bar is painted over only at the moment a new bar lands and pushes it out; and a colour knob. From v2: every other chord lays one short brush mark, so the music draws a broken, cornering line between the bars: short notes leave stubs, held notes longer strokes, loud notes wet slabs, soft ones dry wire, and a leap turns a corner.',
    params: [
      { key: 'thresh', label: 'which chords strike', min: 0.5, max: 0.97, value: 0.8,
        hint: 'How much a chord must stand out to strike a big bar; every other chord leaves a small mark. Left: many chords strike bars. Right: only the very biggest.',
        icon: (g, v, w, h) => {
          const hs = [0.25, 0.45, 0.6, 0.78, 0.95], line = h - 3 - (0.12 + v * 0.8) * (h - 6);
          hs.forEach((k, i) => { const bh = k * (h - 6), y = h - 3 - bh; ICON.rect(g, 4 + i * 7, y, 5, bh, y <= line ? ICON.ink : ICON.dim); });
          ICON.line(g, 2, line, w - 2, line, ICON.red, 1.2);
        } },
      { key: 'weight', label: 'how heavy', min: 0.1, max: 1.9, value: 1,
        hint: 'How thick the bars and marks are. Left: faint, thin lines, on only the hardest chords. Right: huge, heavy beams.',
        icon: (g, v, w, h) => { ICON.rect(g, 2, 2, w - 4, h - 4, BONE); const t = 1.5 + v * 13; ICON.alpha(g, 0.15 + v * 6, () => ICON.rect(g, 5, h / 2 - t / 2, w - 10, t, BLACK)); } },
      { key: 'stay', label: 'how long they stay', min: 1.2, max: 24, value: 4, drive: '+level',
        hint: 'How long the bars and marks take to soak back into the ground. Left: gone almost at once. Right: stays for half a minute. By default it follows loudness, so loud passages build up and quiet ones clear.',
        icon: (g, v, w, h) => {
          ICON.rect(g, 2, 2, w - 4, h - 4, BONE); const life = 0.12 + v * 0.88, n = 4, sw = (w - 8) / n;
          for (let i = 0; i < n; i++) { const a = Math.max(0, 1 - (i / (n - 1)) / life); if (a > 0) ICON.alpha(g, a, () => ICON.rect(g, 4 + i * sw + 1, 6, sw - 3, h - 12, BLACK)); }
        } },
      { key: 'order', label: 'loose or rigid', min: 0, max: 1, value: 0.7, drive: '-rate',
        hint: 'How strictly the bars are built. Left: free, flung strokes at any angle. Right: rigid girders, level beams and upright posts that meet at joints. By default it loosens up when the music gets busy.',
        icon: (g, v, w, h) => {
          ICON.rect(g, 2, 2, w - 4, h - 4, BONE); const R = ICON.rng(4);
          const bars = [[0, 0.28, 0.5, 0.9, 3], [90, 0.3, 0.5, 0.75, 3], [0, 0.6, 0.72, 0.6, 2.2], [90, 0.72, 0.45, 0.5, 2.2]];
          for (const [a0, cx, cy, len, t] of bars) {
            const a = (lerp(a0 + (R() - 0.5) * 140, a0, v)) * DEG, L = len * (w - 6) * 0.6;
            g.save(); g.translate(2 + cx * (w - 4), 2 + cy * (h - 4)); g.rotate(a); ICON.rect(g, -L / 2, -t / 2, L, t, BLACK); g.restore();
          }
        } },
      { key: 'ground', label: 'black or bone', min: 0, max: 1, step: 1, value: 1,
        hint: 'The colours. Left: black bars on a bone-white ground. Right: bone-white bars on black.',
        icon: (g, v, w, h) => { const m = v >= 0.5; ICON.rect(g, 2, 2, w - 4, h - 4, m ? NIGHT : BONE);
          g.save(); g.translate(w / 2, h / 2); g.rotate(-0.35); ICON.rect(g, -13, -3.5, 26, 7, m ? BONE_INK : BLACK); g.restore();
          if (m) { g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(2.5, 2.5, w - 5, h - 5); } } },
      { key: 'colour', label: 'what colour', min: 0, max: 3, step: 1, value: 0,
        hint: 'The paint. 0: ink (black on bone, bone on black). 1: blood red. 2: yellow. 3: blue. The ground stays black or bone.',
        icon: (g, v, w, h) => { const i = clamp(Math.round(v), 0, 3); ICON.rect(g, 2, 2, w - 4, h - 4, NIGHT);
          g.save(); g.translate(w / 2, h / 2); g.rotate(-0.35); ICON.rect(g, -13, -3.5, 26, 7, INKS[i][1]); g.restore();
          g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(2.5, 2.5, w - 5, h - 5); } },
    ],
    reset() { strokes = []; marks = []; chain = null; localV = null; lastChordT = -99; lastStrikeT = -99; },
    onChord(ch, x) {
      const gap = ch.t - lastChordT; lastChordT = ch.t;
      // how loud against the last few seconds (0.5 = as loud as what came just before), and against the whole piece
      if (localV == null) localV = ch.vel;
      const rel = clamp(0.5 + (ch.vel - localV) / 24, 0, 1), p = pct(ch.vel);
      localV += (ch.vel - localV) * Math.max(0.08, 1 - Math.exp(-gap / 1.2));
      const loud = clamp(0.6 * p + 0.4 * rel, 0, 1);
      // a light hand: only the hardest chords of this piece land (the hardest 55% at weight 0.225, the top 10% at 0.1)
      if (p < (1 - firmOf(x)) * 0.9) return;
      // a chord counts as bigger when it stands out from what came before, breaks a silence, or is full
      const quiet = clamp((gap - 0.35) / 1.4, 0, 1);
      const score = 0.55 * p + 0.45 * rel + 0.25 * quiet + 0.03 * Math.min(ch.notes.length - 1, 4);
      const big = (score >= x.p('thresh') || (gap >= 2 && p >= 0.25)) && ch.t - lastStrikeT >= 0.34;
      if (!big) { mark(ch, x, loud); return; }
      lastStrikeT = ch.t; chain = null;   // the next small marks start a new line, often off this bar
      for (const k of strokes) k.dim = Math.min(0.3, k.dim + 0.1);   // the older bars sink back, greyer
      const s = strike(ch, x, loud);
      if (ch.notes.length >= 5 && x.p('order') > 0.45 && Math.random() < 0.6) strike(ch, x, loud, 0.07, s);
      // too many: the oldest are painted over now, on this attack (the only time a brush moves over an old bar)
      const live = strokes.filter((k) => k.wipe == null && k.q < 1);
      for (let i = 0; i < live.length - MAX_LIVE; i++) live[i].wipe = 0;
    },
    frame(x) {
      const g = x.g, mode = x.p('ground') >= 0.5 ? 1 : 0, ink = inkOf(x), life = x.p('stay'), dt = x.dt, faint = 1 - 0.85 * (1 - firmOf(x));
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.drawImage(ground[mode] ??= makeGround(mode, x.W, x.H), 0, 0);
      const P = (pool[mode * 8 + ink] ??= makePool(mode, ink));
      // small marks: fade without motion, smoothly from soon after they land, to a faint grey ghost that lingers, then gone
      const mLife = life * 0.3;
      const drawMark = (m) => {
        const sp = P[m.v], sx = m.L / MARK_L, sy = m.T / sp.T;
        const reveal = 1 - Math.pow(1 - Math.min(1, m.age / m.dur), 2), sw = sp.pad + (MARK_L + sp.pad) * reveal;
        g.globalAlpha = (m.q < 1 ? 1 - 0.78 * smooth(0.1, 1, m.q) : 0.22 * (1 - smooth(1, 2.6, m.q))) * faint;
        if (g.globalAlpha <= 0.01) return;
        g.save(); g.translate(m.x, m.y); g.rotate(m.ang * DEG); g.scale(sx, sy);
        g.drawImage(sp.cv, 0, 0, sw * sp.k, sp.h * sp.k, -sp.pad, -sp.cy, sw, sp.h);
        g.restore();
      };
      for (const m of marks) { m.age += dt; m.q += dt / (m.q < 1 ? mLife : 1.4); }
      for (const m of marks) if (m.q >= 1) drawMark(m);   // the ghosts lie under the bars
      // get one overpainting brush ready ahead of time (at most one per frame, to keep frames short), oldest bar first:
      // the next one a strike would push out
      const due = strokes.find((s) => s.q < 1 && !s.cv[mode]); if (due) cover(due, mode);
      // likewise one ground-coloured underlay per frame for the bars going grey (a strike greys all the older ones at once)
      const dueU = strokes.find((s) => s.a < 0.995 && !s.un[mode]); if (dueU) under(dueU, mode);
      for (const s of strokes) {
        s.age += dt; if (s.age <= 0) continue;
        s.q += dt / life;
        if (s.wipe != null) s.wipe += dt / WIPE;
        s.a += (1 - s.dim - s.a) * (1 - Math.exp(-dt / 0.4));
        // it soaks away without moving; or, pushed out by a new bar, a ground-coloured brush drags along it on that bar's
        // attack (painting it over, streaks still showing) and the streaks soak away
        const sp = sprite(s, mode, ink), reveal = 1 - Math.pow(1 - Math.min(1, s.age / s.dur), 2.2);
        const sw = sp.pad + (s.L + sp.pad) * reveal;
        g.save(); g.translate(s.x, s.y); g.rotate(s.ang * DEG);
        const fade = (1 - smooth(0.25, 1, s.q)) * (s.wipe == null ? 1 : 1 - smooth(1, 4, s.wipe));
        if (fade > 0 && s.a < 0.995 && s.un[mode]) { g.globalAlpha = fade * faint; g.drawImage(under(s, mode), 0, 0, sw * sp.k, sp.h * sp.k, -sp.pad, -sp.cy, sw, sp.h); }
        g.globalAlpha = s.a * fade * faint;
        if (g.globalAlpha > 0) g.drawImage(sp.cv, 0, 0, sw * sp.k, sp.h * sp.k, -sp.pad, -sp.cy, sw, sp.h);
        if (s.wipe != null) {
          // the cover slides in tail first, so its dry, streaky end is the brush's front edge; once the bar under it has
          // soaked away it fades too
          const k = Math.min(1, s.wipe), cp = cover(s, mode), full = cp.w, vis = full * (1 - Math.pow(1 - k, 1.7));
          g.globalAlpha = 1 - smooth(4, 5, s.wipe);
          if (vis > 1) g.drawImage(cp.cv, (full - vis) * cp.k, 0, vis * cp.k, cp.h * cp.k, -cp.pad - s.T * 0.15, -cp.cy, vis, cp.h);
        }
        g.restore();
      }
      for (const m of marks) if (m.q < 1) drawMark(m);
      g.globalAlpha = 1;
      strokes = strokes.filter((s) => (s.wipe == null ? s.q < 1 : s.wipe < 5));
      marks = marks.filter((m) => m.q < 2.6);
    },
  });
})();
