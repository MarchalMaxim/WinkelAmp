// Scribble (Cy Twombly / automatic drawing): nervous pens draw continuous looped scrawls on a persistent
// layer that fades like graphite. Each pen owns a register; its notes jolt it, press it harder and speed it up.
// Loops coil tight when the music is dense/dissonant and open into long arcs when it is soft.
// Chords make the pen scratch back over its own recent line; the biggest chords strike a long red stroke.
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

  TOOLS.push({
    id: 'scribble', name: 'Scribble', tag: 'new',
    blurb: 'Nervous pens scrawl continuous loops, one pen per register: notes jolt and press them, loops coil tight in dense, dissonant passages and open into long arcs when it is soft. Chords make a pen scratch back over its own line (often in red), the biggest chords strike a long stroke, and old lines fade like graphite.',
    params: [
      { key: 'speed', label: 'pen speed', min: 0.2, max: 3, value: 1, drive: '+rate' },
      { key: 'loops', label: 'loopiness', min: 0, max: 1, value: 0.5, drive: '+rate' },
      { key: 'press', label: 'pressure response', min: 0, max: 2, value: 1 },
      { key: 'jitter', label: 'jitter', min: 0, max: 1, value: 0.3, drive: '+level' },
      { key: 'scratch', label: 'chord scratch', min: 0, max: 2, value: 1 },
      { key: 'pens', label: 'number of pens', min: 1, max: 6, step: 1, value: 3 },
      { key: 'fade', label: 'fade half-life (s)', min: 0.4, max: 12, value: 3.5 },
      { key: 'ink', label: 'ink: chalk/bone/ochre/red', min: 0, max: 1, value: 0.33 },
      { key: 'red', label: 'red accents', min: 0, max: 1, value: 0.6 },
      { key: 'paper', label: 'field (dark ↔ paper)', min: 0, max: 1, value: 0 },
    ],
    reset(x) {
      lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; lg.fillStyle = '#000'; lg.fillRect(0, 0, LW, LH);
      lg.lineCap = 'round'; lg.lineJoin = 'round';
      pens = []; strokes = []; fadeAcc = 0; lastStab = -9; tension = 0; diss = 0; shake = 0;
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
      const pp = x.p('press');
      for (const q of ch.notes) {
        let i = 0; while (i < n - 1 && q.m >= edges[i + 1]) i++;
        const p = pens[i], v = q.v / 127;
        p.press = Math.max(p.press, clamp(Math.pow(v, 1.3) * pp));
        p.burst = Math.max(p.burst, v);
        p.hv += R(-1, 1) * 7 * v;                    // the jolt: a kink in the line on the attack
        p.ty = clamp(p.ty * 0.5 + pitchY(q.m) * 0.5, LH * 0.22, LH * 0.78);
      }
      const sc = x.p('scratch');
      const amt = sc * clamp((ch.vel - 58) / 45) * clamp(0.35 + ch.notes.length / 6);
      if (amt > 0.12) {
        const redP = x.p('red') * (0.35 + 0.65 * clamp(amt));
        const ink = paperMode ? pal(INK_P, x.p('ink')) : mix(pal(INK_D, x.p('ink')), [255, 255, 255], 0.25);
        const red = paperMode ? RED_P : RED_D;
        // the pens that played scratch; the lowest one when unsure
        const hit = new Set(ch.notes.map((q) => { let i = 0; while (i < n - 1 && q.m >= edges[i + 1]) i++; return i; }));
        const big = ch.vel >= 95 && ch.notes.length >= 4;
        for (const i of hit) {
          const c = Math.random() < redP ? red : ink, a1 = clamp(amt, 0, 1.6);
          if (big && Math.random() < 0.45) hatch(pens[i], a1, c); else retrace(pens[i], a1, c);
        }
        if (((ch.vel >= 92 && ch.notes.length >= 3) || ch.vel >= 102) && sc > 0.3 && time - lastStab > 0.7) {
          lastStab = time;
          const p = pens[Math.floor(Math.random() * n)];
          stab(p, clamp(amt), Math.random() < x.p('red') ? red : ink);
          shake = Math.max(shake, 4 + (ch.vel - 98) * 0.5);
        }
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt; time += dt;
      syncPens(Math.round(x.p('pens')));
      // field: dark (the shared fade) or paper (layer stores absorption)
      const pv = x.p('paper');
      paperMode = pv >= 0.5;
      paperCol = paperMode ? mix([70, 68, 64], PAPER, (pv - 0.5) * 2) : [0, 0, 0];

      // graphite fade, in steps big enough that 8-bit rounding can't stick (plus a light burn for the last levels)
      fadeAcc += dt;
      const STEP = 0.08, every = x.p('fade') * Math.log(1 - STEP) / Math.log(0.5);
      while (fadeAcc >= every) {
        fadeAcc -= every;
        lg.globalCompositeOperation = 'source-over'; lg.fillStyle = `rgba(0,0,0,${STEP})`; lg.fillRect(0, 0, LW, LH);
        lg.globalCompositeOperation = 'color-burn'; lg.fillStyle = 'rgb(253,253,253)'; lg.fillRect(0, 0, LW, LH);
        lg.globalCompositeOperation = 'source-over';
      }

      diss *= Math.pow(0.5, dt / 1.2);
      const tgt = clamp(0.55 * diss + 1.0 * x.feat.rate);
      tension += (tgt - tension) * (1 - Math.pow(0.5, dt / 0.5));
      const loops = x.p('loops'), speed = x.p('speed'), jit = x.p('jitter'), pp = x.p('press');
      const k = clamp(loops * (0.2 + 1.2 * tension));
      const ink = paperMode ? pal(INK_P, x.p('ink')) : pal(INK_D, x.p('ink'));

      for (const p of pens) {
        p.burst *= Math.pow(0.5, dt / 0.14);
        const floor = 0.1 + 0.5 * x.feat.level;
        p.press = Math.max(floor * pp, p.press * Math.pow(0.5, dt / 0.8));
        const vd = Math.min(700, 120 * speed * (0.3 + 0.7 * x.feat.level + 2.2 * p.burst));
        const Rt = (150 - 138 * Math.pow(k, 0.7)) * (0.75 + 0.5 * Math.sin(time * 0.37 + p.wob));
        p.R += (Rt - p.R) * (1 - Math.pow(0.5, dt / 0.3));
        const vt = vd * (0.5 + 2.6 * k), om = Math.min(26, vt / Math.max(8, p.R));   // at most ~4 loops a second
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
        const w = 0.7 + 8 * Math.pow(pr, 1.3) * (0.4 + 0.6 * pp);
        const a = clamp(0.22 + 0.85 * pr);
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
            line([s.pts[j * 2], s.pts[j * 2 + 1], s.pts[j * 2 + 2], s.pts[j * 2 + 3]], s.w * (0.25 + f), s.rgb, s.a);
          }
        } else line(s.pts.slice(from * 2, to * 2 + 2), s.w, s.rgb, s.a);
      }
      strokes = strokes.filter((s) => s.k < s.pts.length / 2 - 1);

      if (shake > 0.3) { g.translate(R(-shake, shake), R(-shake, shake)); shake *= Math.pow(0.82, dt * 60); }
      if (paperMode) {
        g.fillStyle = `rgb(${paperCol.map((v) => v | 0).join(',')})`; g.fillRect(-20, -20, x.W + 40, x.H + 40);
        g.globalCompositeOperation = 'difference';
      } else g.globalCompositeOperation = 'lighten';
      g.drawImage(layer, 0, 0, x.W, x.H);
    },
  });
})();
