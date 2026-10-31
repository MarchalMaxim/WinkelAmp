// Kline: after Franz Kline. Big chords strike huge black bars and girders onto a bone-white ground (or bone on black).
// One stroke per big attack: its length from the chord's span, its angle from its register (low = lying beam,
// high = standing post), its weight from how hard it is struck; soft strikes leave drier, broken bristle edges.
// Strokes are painted over in time, leaving grey ghosts; quiet music leaves the canvas almost empty.
(() => {
  const DEG = Math.PI / 180;
  const BONE = '#e7dfcc', BONE_INK = '#ece4d2', BLACK = '#0d0b0a', NIGHT = '#100e0d';
  const MAX_LIVE = 6;
  let strokes = [], lastChordT = -99, lastStrikeT = -99, ground = [null, null], pctTable = null;

  // Seeded random, so a stroke can be re-rendered identically in the other colour.
  const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;

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
    // thin dry streaks scratched through the loaded middle
    c.globalCompositeOperation = 'destination-out';
    for (let k = 0, n = 6 + 26 * dry; k < n; k++) {
      const f = (R() - 0.5) * 2 * core, a = x0c + R() * (x1c - x0c) * 0.9, len = 20 + R() * L * (0.08 + 0.3 * dry * R());
      c.fillRect(pad + a, yAt(a, f), Math.min(len, x1c - a), 0.6 + R() * bw * 0.45);
    }
    c.globalCompositeOperation = 'source-over';
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
  const sprite = (s, mode) => (s.sp[mode] ??= renderStroke(s, mode ? BONE_INK : BLACK));
  // the overpainting: a ground-coloured dry stroke dragged along the bar, a little wider, so streaks of the bar show through
  const cover = (s, mode) => (s.cv[mode] ??= renderStroke({ L: s.L + s.T * 0.3, T: s.T * 1.12, dry: 0.72 + s.dry * 0.2, seed: s.seed + 7, taper: 0.06 }, mode ? NIGHT : BONE, 0.5));

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

  function strike(ch, x, delay = 0, parent = null) {
    const W = x.W, H = x.H, order = x.p('order'), weight = x.p('weight');
    const seed = (Math.random() * 1e9) | 0, R = rng(seed);
    let mean = 0; for (const n of ch.notes) mean += n.m; mean /= ch.notes.length;
    const reg = clamp((mean - 38) / 40, 0, 1), span = ch.hi - ch.lo, n = ch.notes.length;
    const velN = clamp((ch.vel - 50) / 65, 0, 1);
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
    }
    const fa = ang * DEG;
    const s = { x: sx, y: sy, ang, L, T, dry, seed, taper: 0.05 + R() * 0.2, sp: [null, null], cv: [null, null], parent: !!parent,
      mx: sx + Math.cos(fa) * L / 2, my: sy + Math.sin(fa) * L / 2, age: -delay, dur: 0.07 + L / 5200, q: 0 };
    sprite(s, x.p('ground') >= 0.5 ? 1 : 0);
    strokes.push(s);
    return s;
  }

  TOOLS.push({
    id: 'kline', name: 'Kline', tag: 'new',
    blurb: 'After Franz Kline: every big chord strikes one huge black bar onto a bone-white ground. A wide chord makes a long bar, a low chord lies flat as a beam, a high chord stands up as a post, and a full chord gets a second bar beside it like a girder. Soft strikes leave dry, broken brush edges. The bars are painted over in time, so quiet music leaves the canvas almost empty.',
    params: [
      { key: 'thresh', label: 'which chords strike', min: 0.5, max: 0.97, value: 0.8,
        hint: 'How big a chord must be, compared with the rest of the piece, to strike a bar. Left: most chords strike. Right: only the very biggest.',
        icon: (g, v, w, h) => {
          const hs = [0.25, 0.45, 0.6, 0.78, 0.95], line = h - 3 - (0.12 + v * 0.8) * (h - 6);
          hs.forEach((k, i) => { const bh = k * (h - 6), y = h - 3 - bh; ICON.rect(g, 4 + i * 7, y, 5, bh, y <= line ? ICON.ink : ICON.dim); });
          ICON.line(g, 2, line, w - 2, line, ICON.red, 1.2);
        } },
      { key: 'weight', label: 'how heavy', min: 0.35, max: 1.9, value: 1,
        hint: 'How thick the bars are. Left: thin, wiry strokes. Right: huge, heavy beams.',
        icon: (g, v, w, h) => { ICON.rect(g, 2, 2, w - 4, h - 4, BONE); const t = 1.5 + v * 13; ICON.rect(g, 5, h / 2 - t / 2, w - 10, t, BLACK); } },
      { key: 'stay', label: 'how long they stay', min: 1.2, max: 24, value: 4, drive: '+level',
        hint: 'How long a bar stays before it is painted over. Left: gone almost at once. Right: stays for half a minute. By default it follows loudness, so loud passages build up and quiet ones clear.',
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
      { key: 'ground', label: 'black or bone', min: 0, max: 1, step: 1, value: 0,
        hint: 'The colours. Left: black bars on a bone-white ground. Right: bone-white bars on black.',
        icon: (g, v, w, h) => { const m = v >= 0.5; ICON.rect(g, 2, 2, w - 4, h - 4, m ? NIGHT : BONE);
          g.save(); g.translate(w / 2, h / 2); g.rotate(-0.35); ICON.rect(g, -13, -3.5, 26, 7, m ? BONE_INK : BLACK); g.restore();
          if (m) { g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(2.5, 2.5, w - 5, h - 5); } } },
    ],
    reset() { strokes = []; lastChordT = -99; lastStrikeT = -99; },
    onChord(ch, x) {
      const gap = ch.t - lastChordT; lastChordT = ch.t;
      // a chord counts as bigger when it breaks a silence (the fate motif), or when it is full
      const quiet = clamp((gap - 0.3) / 1.5, 0, 1);
      const score = pct(ch.vel) + 0.18 * quiet + 0.025 * Math.min(ch.notes.length - 1, 4);
      if (score < x.p('thresh') || ch.t - lastStrikeT < 0.34) return;
      lastStrikeT = ch.t;
      const s = strike(ch, x);
      if (ch.notes.length >= 5 && x.p('order') > 0.45 && Math.random() < 0.6) strike(ch, x, 0.07, s);
      // too many: the oldest begin to be painted over
      const live = strokes.filter((k) => k.q < 0.55);
      for (let i = 0; i < live.length - MAX_LIVE; i++) { live[i].q = Math.max(live[i].q, 0.55); live[i].rush = true; }
    },
    frame(x) {
      const g = x.g, mode = x.p('ground') >= 0.5 ? 1 : 0, life = x.p('stay');
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.drawImage(ground[mode] ??= makeGround(mode, x.W, x.H), 0, 0);
      // get one overpainting brush ready ahead of time (at most one per frame, to keep frames short)
      const due = strokes.find((s) => s.q > 0.35 && !s.cv[mode]); if (due) cover(due, mode);
      for (const s of strokes) {
        s.age += x.dt; if (s.age <= 0) continue;
        s.q += x.dt / (s.rush ? Math.min(life, 2.5) : life);   // pushed out by newer bars: painted over briskly
        // full; then a ground-coloured brush drags along it (painting it over, streaks still showing); then the rest fades
        const sp = sprite(s, mode), reveal = 1 - Math.pow(1 - Math.min(1, s.age / s.dur), 2.2);
        const sw = sp.pad + (s.L + sp.pad) * reveal;
        g.save(); g.translate(s.x, s.y); g.rotate(s.ang * DEG);
        g.globalAlpha = s.q < 1 ? 1 : Math.max(0, 1 - (s.q - 1) / 0.3);
        if (g.globalAlpha > 0) g.drawImage(sp.cv, 0, 0, sw * sp.k, sp.h * sp.k, -sp.pad, -sp.cy, sw, sp.h);
        if (s.q > 0.55) {
          // the cover slides in tail first, so its dry, streaky end is the brush's front edge
          const k = Math.min(1, (s.q - 0.55) / 0.4), cp = cover(s, mode), full = cp.w, vis = full * (1 - Math.pow(1 - k, 1.7));
          g.globalAlpha = s.q < 1.3 ? 1 : Math.max(0, 1 - (s.q - 1.3) / 0.2);
          if (vis > 1) g.drawImage(cp.cv, (full - vis) * cp.k, 0, vis * cp.k, cp.h * cp.k, -cp.pad - s.T * 0.15, -cp.cy, vis, cp.h);
        }
        g.restore();
      }
      strokes = strokes.filter((s) => s.q < 1.5);
    },
  });
})();
