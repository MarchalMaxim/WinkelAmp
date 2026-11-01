// Scribble (Cy Twombly / automatic drawing): nervous pens draw continuous looped scrawls on a persistent
// layer that fades like graphite. Each pen owns a register; its notes jolt it, press it harder and speed it up.
// Loops coil tight when the music is dense/dissonant and open into long arcs when it is soft.
// Chords make the pen scratch back over its own recent line; the biggest chords strike a long red stroke.
// How present (the user, 2026-11-01: sliders "only seem to be able to BOOST the effect"): turned down, the sheet is faint,
// the lines thin, the pens slow and steady, and they answer only the hardest attacks of the piece; no long strokes at 0.
(() => {
  const LW = 1280, LH = 720, TAU = Math.PI * 2;
  const layer = document.createElement('canvas'); layer.width = LW; layer.height = LH; const lg = layer.getContext('2d');
  const R = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  // Ink palettes: [dark-field ink (light), paper-field ink (dark)] along the 'ink' param.
  const INK_D = [[170, 196, 236], [234, 228, 214], [228, 178, 100], [210, 54, 42]];
  const INK_P = [[24, 34, 58], [34, 33, 32], [92, 58, 28], [128, 20, 16]];
  const RED_D = [226, 42, 30], RED_P = [178, 24, 18];
  const PAPER = [232, 225, 210];
  const pal = (P, k) => { const s = clamp(k) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(s)); return mix(P[i], P[i + 1], s - i); };

  let lastStab = -9, pens = [], strokes = [], fadeAcc = 0, time = 0, tension = 0, diss = 0, shake = 0;
  let paperMode = false, paperCol = [0, 0, 0];

  function bandsFor(n) { const e = [0]; for (let k = 1; k < n; k++) e.push(36 + 48 * k / n); e.push(200); return e; }
  function homeY(i, n) { return LH * (0.8 - 0.6 * (i + 0.5) / n); }
  function mkPen(i, n) {
    const y = homeY(i, n), x0 = R(200, LW - 200);
    return { i, cx: x0, cy: y, ty: y, h: R(0, TAU), hv: 0, phi: R(0, TAU), dir: Math.random() < 0.5 ? 1 : -1, R: 60,
      slant: R(-0.7, 0.7), ell: R(0.45, 0.9), press: 0.2, burst: 0, x: x0, y, hist: [], wob: R(0, 100), fresh: true };
  }
  function syncPens(n) {
    if (pens.length === n) return;
    while (pens.length > n) pens.pop();
    while (pens.length < n) pens.push(mkPen(pens.length, n));
    pens.forEach((p, i) => { p.i = i; p.ty = homeY(i, n); });
  }
  const pitchY = (m) => LH * (0.9 - 0.8 * clamp((m - 28) / 66));
  // how present (0..1): which attacks the pens answer, judged against this piece's own notes (recordings differ a lot in
  // how hard they play): every one at 1, the hardest 40% at 0.4, the hardest 5% at 0
  let vels = null;
  const hardEnough = (v, x) => {
    const cut = (1 - x.p('presence')) * 0.95;
    if (cut <= 0) return true;
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= cut;
  };

  // A colour for the layer: on paper the layer stores absorption (paper - ink), shown with 'difference'.
  function col(rgb, a) {
    const c = paperMode ? paperCol.map((p, i) => Math.max(0, p - rgb[i])) : rgb;
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
  }
  // Graphite: a main stroke plus a thin offset hair, so wide lines look fibrous.
  function line(pts, w, rgb, a) {
    if (pts.length < 4) return;
    lg.lineWidth = w; lg.strokeStyle = col(rgb, a);
    lg.beginPath(); lg.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) lg.lineTo(pts[k], pts[k + 1]); lg.stroke();
    const ox = w * 0.55 + 0.6, oy = -w * 0.35 - 0.4;
    lg.lineWidth = Math.max(0.5, w * 0.3); lg.strokeStyle = col(rgb, a * 0.55);
    lg.beginPath(); lg.moveTo(pts[0] + ox, pts[1] + oy); for (let k = 2; k < pts.length; k += 2) lg.lineTo(pts[k] + ox + R(-0.6, 0.6), pts[k + 1] + oy + R(-0.6, 0.6)); lg.stroke();
  }

  // Scratch back: the pen runs back and forth over its own last stretch of line, pressing harder each pass.
  function retrace(p, amt, rgb) {
    const h = p.hist; if (h.length < 4) return;
    const M = Math.min(h.length, Math.round(25 + 60 * amt)), seg = h.slice(h.length - M);
    const passes = 2 + Math.round(2 * amt), pts = [];
    for (let k = 0; k < passes; k++) {
      const run = k % 2 ? seg : seg.slice().reverse(), off = R(-3, 3) * (1 + amt), sh = R(-4, 4);
      for (let j = 0; j < run.length; j++) pts.push(run[j].x + off + R(-2, 2) * amt + sh, run[j].y - off + R(-2, 2) * amt);
    }
    strokes.push({ pts, k: 0, rate: pts.length / 2 / (0.12 + 0.1 * amt), w: 1.4 + 3.2 * amt, rgb, a: clamp(0.6 + 0.4 * amt) });
  }
  // Hatch: for the heaviest chords, a fan of quick strokes of uneven length across the line.
  function hatch(p, amt, rgb) {
    const h = p.hist; if (!h.length) return;
    const back = h[Math.max(0, h.length - 1 - Math.floor(R(2, Math.min(h.length, 60))))];
    let a = p.h + Math.PI / 2 + R(-0.8, 0.8); const turn = R(-0.09, 0.09);
    const N = Math.round(5 + 7 * amt), L = 40 + 110 * amt, pts = [];
    let ox = back.x, oy = back.y;
    for (let k = 0; k < N; k++) {
      a += turn; const s = (k % 2 ? 1 : -1) * L * 0.5 * R(0.35, 1.15);
      ox += Math.cos(a + Math.PI / 2) * R(2, 7) + R(-2, 2); oy += Math.sin(a + Math.PI / 2) * R(2, 7) + R(-2, 2);
      pts.push(ox + Math.cos(a) * s, oy + Math.sin(a) * s);
    }
    strokes.push({ pts, k: 0, rate: N / (0.05 + 0.025 * N), w: 1.2 + 2.8 * amt, rgb, a: clamp(0.65 + 0.35 * amt) });
  }
  // Stab: a long, hard, slightly bent stroke from the pen; the pen lands where it ends.
  function stab(p, amt, rgb) {
    const a = R(0, TAU), L = R(260, 620) * (0.7 + 0.5 * amt), bend = R(-0.5, 0.5), pts = [];
    let px = p.x, py = p.y, aa = a;
    for (let k = 0; k <= 14; k++) { pts.push(px, py); aa += bend / 14; px += Math.cos(aa) * L / 14; py += Math.sin(aa) * L / 14; }
    strokes.push({ pts, k: 0, rate: 15 / 0.07, w: 3 + 5 * amt, rgb, a: 0.95, taper: true });
    const ex = clamp(px, 60, LW - 60), ey = clamp(py, 60, LH - 60);
    p.cx += ex - p.x; p.cy += ey - p.y; p.x = ex; p.y = ey; p.hist.length = 0;
  }

  // Knob picture: a looped pen line from x0 to x1 (turns loops of radius r).
  function coilIcon(g, x0, x1, y, r, turns, col, lw) {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
    for (let i = 0; i <= 90; i++) {
      const t = i / 90, a = t * turns * TAU - Math.PI, px = x0 + r + (x1 - x0 - 2 * r) * t + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.85;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
  }
  // What the dropped knobs were fixed at.
  const FIX = { press: 1, scratch: 1, red: 0.6, ink: 0.33 };

  TOOLS.push({
    id: 'scribble', name: 'Scribble', tag: 'new',
    blurb: 'Nervous pens scrawl continuous loops, one pen per register: notes jolt and press them, loops coil tight in dense, dissonant passages and open into long arcs when it is soft. Chords make a pen scratch back over its own line (often in red), the biggest chords strike a long stroke, and old lines fade like graphite.',
    // Five knobs (lab/README.md) plus how present, as on Rorschach; no drive on it. Fixed now: pressure response 1, chord scratch 1, red accents 0.6, bone ink, dark field;
    // the jitter follows loudness on its own. New keys where a default changed, so old saved settings don't override them.
    params: [
      { key: 'speed', label: 'how fast the pens run', min: 0.2, max: 3, value: 1, drive: '+rate',
        hint: 'How fast the pens travel. Left: a slow, short crawl. Right: long lines racing across the sheet.',
        icon: (g, v, w, h) => { const L = 7 + v * (w - 12); coilIcon(g, 3, 3 + L, h / 2, 3.5, 0.5 + v * 2.5, ICON.ink, 1.4); ICON.dot(g, 3 + L, h / 2, 2.2, ICON.red); } },
      { key: 'loops', label: 'how loopy', min: 0, max: 1, value: 0.5, drive: '+rate',
        hint: 'The shape of the scrawl. Left: long open arcs. Right: tight coils, loop over loop.',
        icon: (g, v, w, h) => coilIcon(g, 3, w - 3, h / 2, 8.5 - 3.5 * v, 0.45 + 5.5 * v, ICON.ink, 1.3) },
      { key: 'pens', label: 'how many pens', min: 1, max: 6, step: 1, value: 3,
        hint: 'How many pens draw at once, each for its own part of the keyboard. Left: one lone pen. Right: six.',
        icon: (g, v, w, h) => { const n = Math.round(1 + v * 5), rh = (h - 4) / n;
          for (let i = 0; i < n; i++) coilIcon(g, 3 + (i % 2) * 4, w - 7 + (i % 2) * 4, 2 + rh * (i + 0.5), Math.min(4, rh * 0.4), 2.2, ICON.ink, 1.1); } },
      { key: 'stay', label: 'how long lines stay', min: 1, max: 20, value: 7,
        hint: 'How long a line stays before it fades like graphite. Left: gone in a second. Right: the sheet fills up.',
        icon: (g, v, w, h) => { const life = 0.1 + 0.9 * v;
          for (let i = 0; i < 3; i++) ICON.alpha(g, Math.max(0, 1 - i / 2 / life), () => coilIcon(g, 1 + i * 13, 12 + i * 13, h / 2, 4.5, 1.6, ICON.ink, 1.3)); } },
      { key: 'weight', label: 'how heavy the line', min: 0.3, max: 2.5, value: 1.2,
        hint: 'How thick the pen line is. Left: a hairline. Right: heavy, pressed graphite.',
        icon: (g, v, w, h) => coilIcon(g, 3, w - 3, h / 2, 6.5, 1.7, ICON.ink, 0.5 + v * 3.3) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: faint thin lines, slow steady pens, and only the hardest attacks press or scratch. Right: every note jolts the pens at full strength.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + 0.85 * v, () => coilIcon(g, 3, w - 3, h / 2, 6.5, 1.7, ICON.ink, 0.6 + v * 1.8)) },
    ],
    reset(x) {
      lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; lg.fillStyle = '#000'; lg.fillRect(0, 0, LW, LH);
      lg.lineCap = 'round'; lg.lineJoin = 'round';
      pens = []; strokes = []; fadeAcc = 0; lastStab = -9; tension = 0; diss = 0; shake = 0; vels = null;
      const n = Math.round(x.p('pens') ?? 3); syncPens(n);
    },
    onChord(ch, x) {
      const n = pens.length, edges = bandsFor(n);
      // dissonance of what sounds now: share of note pairs a 2nd, tritone or 7th apart
      const pcs = [...new Set(x.sounding().filter((s) => x.t - s.start < 0.4).map((s) => s.m % 12).concat(ch.notes.map((q) => q.m % 12)))];
      let harsh = 0, pairs = 0;
      for (let a = 0; a < pcs.length; a++) for (let b = a + 1; b < pcs.length; b++) {
        const d = Math.abs(pcs[a] - pcs[b]), ic = Math.min(d, 12 - d); pairs++;
        harsh += ic === 1 ? 1 : ic === 2 ? 0.6 : ic === 6 ? 0.7 : 0;
      }
      diss = Math.max(diss, pairs ? clamp(harsh / pairs * 2.2) : 0);
      const pp = FIX.press, pres = x.p('presence'), calm = 1 - 0.8 * (1 - pres);
      for (const q of ch.notes) {
        if (!hardEnough(q.v, x)) continue;
        let i = 0; while (i < n - 1 && q.m >= edges[i + 1]) i++;
        const p = pens[i], v = q.v / 127;
        p.press = Math.max(p.press, clamp(Math.pow(v, 1.3) * pp));
        p.burst = Math.max(p.burst, v);
        p.hv += R(-1, 1) * 7 * v * calm;             // the jolt: a kink in the line on the attack
        p.ty = clamp(p.ty * 0.5 + pitchY(q.m) * 0.5, LH * 0.22, LH * 0.78);
      }
      const sc = FIX.scratch;
      const amt = sc * clamp((ch.vel - 58) / 45) * clamp(0.35 + ch.notes.length / 6);
      if (amt > 0.12 && hardEnough(ch.vel, x)) {
        const redP = FIX.red * (0.35 + 0.65 * clamp(amt));
        const ink = paperMode ? pal(INK_P, FIX.ink) : mix(pal(INK_D, FIX.ink), [255, 255, 255], 0.25);
        const red = paperMode ? RED_P : RED_D;
        // the pens that played scratch; the lowest one when unsure
        const hit = new Set(ch.notes.map((q) => { let i = 0; while (i < n - 1 && q.m >= edges[i + 1]) i++; return i; }));
        const big = ch.vel >= 95 && ch.notes.length >= 4;
        for (const i of hit) {
          const c = Math.random() < redP ? red : ink, a1 = clamp(amt, 0, 1.6);
          if (big && Math.random() < 0.45) hatch(pens[i], a1, c); else retrace(pens[i], a1, c);
        }
        if (((ch.vel >= 92 && ch.notes.length >= 3) || ch.vel >= 102) && sc > 0.3 && time - lastStab > 0.7 / pres) {
          lastStab = time;
          const p = pens[Math.floor(Math.random() * n)];
          stab(p, clamp(amt), Math.random() < FIX.red ? red : ink);
          shake = Math.max(shake, 4 + (ch.vel - 98) * 0.5);
        }
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt; time += dt;
      // how present: 1 keeps every factor at exactly 1, so the picture at the default is untouched. The sheet's alpha falls
      // steeply: the stage keeps most of last frame, so a line stays far brighter on it than this alpha alone would make it.
      const pres = x.p('presence'), calm = 1 - 0.8 * (1 - pres), thin = 1 - 0.5 * (1 - pres), inkA = 1 - 0.94 * (1 - pres * pres);
      syncPens(Math.round(x.p('pens')));
      // field: dark (the shared fade) or paper (layer stores absorption)
      const pv = 0; // the paper field is gone (it painted over any widget mixed with it); the code stays for later
      paperMode = pv >= 0.5;
      paperCol = paperMode ? mix([70, 68, 64], PAPER, (pv - 0.5) * 2) : [0, 0, 0];

      // graphite fade, in steps big enough that 8-bit rounding can't stick (plus a light burn for the last levels)
      fadeAcc += dt;
      const STEP = 0.08, every = x.p('stay') * Math.log(1 - STEP) / Math.log(0.5);
      while (fadeAcc >= every) {
        fadeAcc -= every;
        lg.globalCompositeOperation = 'source-over'; lg.fillStyle = `rgba(0,0,0,${STEP})`; lg.fillRect(0, 0, LW, LH);
        lg.globalCompositeOperation = 'color-burn'; lg.fillStyle = 'rgb(253,253,253)'; lg.fillRect(0, 0, LW, LH);
        lg.globalCompositeOperation = 'source-over';
      }

      diss *= Math.pow(0.5, dt / 1.2);
      const tgt = clamp(0.55 * diss + 1.0 * x.feat.rate);
      tension += (tgt - tension) * (1 - Math.pow(0.5, dt / 0.5));
      const loops = x.p('loops'), speed = x.p('speed'), jit = clamp(0.3 + 0.5 * x.feat.level) * calm, pp = FIX.press;
      const k = clamp(loops * (0.2 + 1.2 * tension));
      const ink = paperMode ? pal(INK_P, FIX.ink) : pal(INK_D, FIX.ink);

      for (const p of pens) {
        p.burst *= Math.pow(0.5, dt / 0.14);
        const floor = 0.22 + 0.45 * x.feat.level; // a quiet pen still leaves a readable line
        p.press = Math.max(floor * pp * thin, p.press * Math.pow(0.5, dt / 0.8));
        const vd = Math.min(700, 120 * speed * (0.6 + 0.6 * x.feat.level + 2.2 * p.burst)) * calm;
        const Rt = (150 - 138 * Math.pow(k, 0.7)) * (0.75 + 0.5 * Math.sin(time * 0.37 + p.wob));
        p.R += (Rt - p.R) * (1 - Math.pow(0.5, dt / 0.3));
        const vt = vd * (0.9 + 2.6 * k), om = Math.min(26, vt / Math.max(8, p.R));   // at most ~4 loops a second
        const S = Math.min(40, Math.max(1, Math.ceil(Math.max(vd * dt / 3, om * dt / 0.13))));
        const sdt = dt / S, pts = p.fresh ? [] : [p.x, p.y]; p.fresh = false;
        for (let s = 0; s < S; s++) {
          // heading: a damped random walk (turbulence = jitter) steered home when it strays
          p.hv += R(-1, 1) * (6 + 30 * jit) * Math.sqrt(sdt) - p.hv * 2.5 * sdt;
          let steer = 0;
          const mx = Math.max(0, Math.abs(p.cx - LW / 2) + p.R - LW * 0.42) / 80, my = Math.max(0, Math.abs(p.cy - p.ty) - 40) / 140 + Math.max(0, Math.abs(p.cy - LH / 2) + p.R - LH * 0.42) / 60;
          const want = Math.atan2(p.ty - p.cy, LW / 2 - p.cx);
          let dA = want - p.h; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
          steer = dA * (0.25 + mx * 3 + my * 0.9);
          p.h += (p.hv + steer) * sdt;
          p.cx += Math.cos(p.h) * vd * sdt; p.cy += Math.sin(p.h) * vd * sdt;
          // walls: the loop never leaves the sheet
          const mX = Math.min(LW / 2 - 20, p.R + 50), mY = Math.min(LH / 2 - 20, p.R * p.ell + 40);
          if (p.cx < mX || p.cx > LW - mX) { p.cx = clamp(p.cx, mX, LW - mX); p.h = Math.PI - p.h; p.hv *= -0.5; }
          if (p.cy < mY || p.cy > LH - mY) { p.cy = clamp(p.cy, mY, LH - mY); p.h = -p.h; p.hv *= -0.5; }
          p.phi += om * sdt * p.dir;
          const lx = Math.cos(p.phi) * p.R, ly = Math.sin(p.phi) * p.R * p.ell;
          const cs = Math.cos(p.slant), sn = Math.sin(p.slant);
          let tx = p.cx + lx * cs - ly * sn, ty = p.cy + lx * sn + ly * cs;
          const tr = jit * (1.2 + 3 * p.burst);
          tx += R(-tr, tr); ty += R(-tr, tr);
          p.x = tx; p.y = ty; pts.push(tx, ty);
          const last = p.hist[p.hist.length - 1];
          if (!last || Math.abs(tx - last.x) + Math.abs(ty - last.y) > 6) { p.hist.push({ x: tx, y: ty, t: time }); if (p.hist.length > 160) p.hist.shift(); }
        }
        if (Math.random() < dt * 0.15) p.dir = -p.dir;
        const pr = clamp(p.press);
        const w = (1.25 + 7 * Math.pow(pr, 1.3) * (0.4 + 0.6 * pp)) * x.p('weight') * thin;
        const a = clamp(0.32 + 0.8 * pr);
        const bandInk = mix(ink, paperMode ? [0, 0, 0] : [255, 255, 255], 0.12 * (p.i / Math.max(1, pens.length - 1)));
        line(pts, w, bandInk, a);
      }

      // queued scratches and stabs draw out over a few frames (the first segments land on the attack frame)
      for (const s of strokes) {
        const n = s.pts.length / 2, from = Math.floor(s.k);
        s.k = Math.min(n - 1, s.k + Math.max(1.01, s.rate * dt));
        const to = Math.floor(s.k);
        if (to <= from) continue;
        if (s.taper) {
          for (let j = from; j < to; j++) {
            const f = 1 - j / n;
            line([s.pts[j * 2], s.pts[j * 2 + 1], s.pts[j * 2 + 2], s.pts[j * 2 + 3]], s.w * thin * (0.25 + f), s.rgb, s.a);
          }
        } else line(s.pts.slice(from * 2, to * 2 + 2), s.w * thin, s.rgb, s.a);
      }
      strokes = strokes.filter((s) => s.k < s.pts.length / 2 - 1);

      if (shake > 0.3) { const sh = shake * pres; g.translate(R(-sh, sh), R(-sh, sh)); shake *= Math.pow(0.82, dt * 60); }
      if (paperMode) {
        g.fillStyle = `rgb(${paperCol.map((v) => v | 0).join(',')})`; g.fillRect(-20, -20, x.W + 40, x.H + 40);
        g.globalCompositeOperation = 'difference';
      } else g.globalCompositeOperation = 'lighten';
      g.globalAlpha *= inkA;
      g.drawImage(layer, 0, 0, x.W, x.H);
    },
  });
})();
