// Harmonograph: a pendulum pen whose swings are tuned to the sounding chord.
// The chord's intervals (as just-intonation ratios over the bass) set the pendulum frequencies, so an octave or a fifth
// draws a simple closed figure and a tritone or a cluster draws a dense knot. Damping winds each figure inward until the
// next change of harmony restarts the pen; loudness sets the swing; single melody notes bend the figure (they nudge the
// phase of the vertical pendulum) instead of restarting it.
(() => {
  const TAU = Math.PI * 2;
  // Just ratios for the 12 intervals above the bass: [numerator, denominator].
  const JUST = [[1, 1], [16, 15], [9, 8], [6, 5], [5, 4], [4, 3], [45, 32], [3, 2], [8, 5], [5, 3], [9, 5], [15, 8]];
  // The figure lives on its own canvas (it fades by the "lines stay" knob, not the lab's quick shared fade) and is laid on
  // the shared canvas with 'lighten', so other widgets still show wherever they are brighter.
  const off = document.createElement('canvas'); off.width = 1280; off.height = 720; const og = off.getContext('2d');
  let fig = null, phase = 0, phaseTo = 0, lastTop = null, lastRestart = -9;

  // A chord → pendulums. Returns { fx: [[f, amp]...], fy: [[f, amp]...], dis (0..1), pcs (string key) }.
  function tune(notes) {
    const ms = [...new Set(notes.map((n) => n.m))].sort((a, b) => a - b).slice(0, 7);
    const bass = ms[0];
    let ratios = [], worst = 1;
    for (const m of ms.slice(1)) {
      const i = m - bass, [p, q] = JUST[i % 12];
      let r = (p / q) * Math.pow(2, Math.floor(i / 12));
      while (r >= 4) r /= 2;                      // keep the swings within two octaves of the bass
      if (!ratios.some((x) => Math.abs(x - r) < 1e-6)) ratios.push(r);
      worst = Math.max(worst, Math.log2(p * q));  // Tenney height: 1 = octave, 2.6 = fifth, 10.5 = tritone
    }
    ratios.sort((a, b) => b - a);
    const fx = [[1, 1]], fy = [[ratios[0] ?? 1, 1]];
    if (ratios[1]) fx.push([ratios[1], 0.5]);
    if (ratios[2]) fy.push([ratios[2], 0.5]);
    if (ratios[3]) fx.push([ratios[3], 0.3]);
    const pcs = [...new Set(ms.map((m) => (m - bass) % 12))].sort((a, b) => a - b).join(',') + '@' + (bass % 12);
    // Triads (worst a third, ~4.9) stay goldish, sevenths (~7.3) rose, tritones and clusters (~10) violet.
    return { fx, fy, dis: Math.pow(Math.max(0, Math.min(1, (worst - 2) / 8.5)), 1.3), pcs, n: ms.length };
  }
  // Consonant = warm bone/gold, middling = rose, dissonant = cold violet.
  function colour(d) {
    const a = [255, 222, 160], b = [245, 110, 140], c = [140, 120, 255];
    const [p, q, k] = d < 0.5 ? [a, b, d * 2] : [b, c, (d - 0.5) * 2];
    return p.map((v, i) => Math.round(v + (q[i] - v) * k));
  }

  function restart(x, ch) {
    const notes = ch.notes.length >= 2 ? ch.notes : [...ch.notes, ...x.sounding()];
    const tn = tune(notes);
    // Loudness = swing: a soft chorale chord draws about half as wide as a fff climax chord.
    const W = x.W, H = x.H, A = Math.min(W, H) * 0.42 * Math.min(1.08, 0.36 + 0.64 * Math.pow(ch.vel / 110, 1.5));
    // The old figure steps back so the new one reads on top of it.
    og.globalCompositeOperation = 'source-over'; og.fillStyle = 'rgba(0,0,0,0.3)'; og.fillRect(0, 0, off.width, off.height);
    fig = { ...tn, tau: 0, A, vel: ch.vel, col: colour(tn.dis), last: null, t0: x.t, tail: [],
      // Phases away from 0 and π/2, which fold 1:2 into a retraced parabola; a fresh tilt per chord so successive
      // figures don't sit exactly on one another.
      px: [0, 1.3], py: [Math.PI / 2 - 0.75, 2.1], tilt: x.rnd(-0.25, 0.25) };
    lastRestart = x.t;
  }

  function point(f, tau, swirl) {
    const env = Math.exp(-f.damp * tau);
    let sx = 0, ax = 0, sy = 0, ay = 0;
    f.fx.forEach(([fr, a], i) => { sx += a * Math.sin(TAU * fr * tau + f.px[i % 2] * i); ax += a; });
    f.fy.forEach(([fr, a], i) => { sy += a * Math.sin(TAU * fr * (1 + swirl * 0.025) * tau + (i ? f.py[1] : f.py[0] + f.ph)); ay += a; });
    return [sx / ax * env, sy / ay * env, env];
  }

  // ---- icons: a tiny Lissajous figure. `cycles` turns of the slow pendulum, drawn up to `frac` of the way. ----
  function liss(g, w, h, { fx = 1, fy = 2, ph = Math.PI / 2 - 0.75, s = 1, damp = 0, cycles = 1, frac = 1, rot = 0, col = ICON.gold, lw = 1.2, alpha = 1, nib = false } = {}) {
    const cx = w / 2, cy = h / 2, R = (h / 2 - 2) * s, N = Math.round(90 * cycles * Math.max(fx, fy));
    let px = cx, py = cy;
    g.save(); g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
    for (let i = 0; i <= N * frac; i++) {
      const t = (i / N) * cycles, e = Math.exp(-damp * t);
      const X = Math.sin(TAU * fx * t) * R * 1.35 * e, Y = Math.sin(TAU * fy * t + ph) * R * e;
      px = cx + X * Math.cos(rot) - Y * Math.sin(rot); py = cy + X * Math.sin(rot) + Y * Math.cos(rot);
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke(); g.restore();
    if (nib) ICON.dot(g, px, py, 2.2, ICON.ink);
  }

  TOOLS.push({
    id: 'harmonograph', name: 'Harmonograph', tag: 'new',
    blurb: 'A pendulum pen tuned to the chord: an octave or a fifth draws a simple closed figure, a clash draws a dense knot. Each new chord restarts the pen and the figure winds inward as it swings down; loud chords swing wide, and melody notes bend the line. Gold = consonant, violet = dissonant.',
    params: [
      { key: 'size', label: 'size', min: 0.4, max: 1.3, value: 0.95,
        hint: 'How wide the pen swings. Left: a small figure in the middle. Right: fills the screen.',
        icon: (g, v, w, h) => liss(g, w, h, { s: 0.3 + v * 0.7, fy: 2 }) },
      { key: 'speed', label: 'how fast the pen draws', min: 0.8, max: 10, value: 3.5, drive: '+rate',
        hint: 'How quickly the pen traces the figure. Left: slow, you watch each loop being drawn. Right: the whole figure appears almost at once.',
        icon: (g, v, w, h) => liss(g, w, h, { fx: 2, fy: 3, ph: 0.6, frac: 0.15 + v * 0.85, nib: true }) },
      { key: 'damp', label: 'how fast it winds inward', min: 0.02, max: 0.5, value: 0.18,
        hint: 'How quickly each figure spirals in toward the centre. Left: it keeps swinging wide, loops stacked on loops. Right: it curls into the middle in a few turns.',
        icon: (g, v, w, h) => liss(g, w, h, { fx: 1, fy: 1, ph: Math.PI / 2, cycles: 4, damp: 0.07 + v * 0.75, lw: 1 }) },
      { key: 'swirl', label: 'swirl', min: 0, max: 1, value: 0.35,
        hint: 'A slight mistuning between the pendulums. Left: crisp, exactly closed figures. Right: each loop turns a little, making rosettes.',
        icon: (g, v, w, h) => { const n = 1 + Math.round(v * 5); for (let i = 0; i < n; i++) liss(g, w, h, { fx: 1, fy: 1, ph: 0.35, s: 0.95, rot: (i * Math.PI) / n, alpha: 0.9, lw: 1 }); } },
      { key: 'stay', label: 'how long the lines stay', min: 0.3, max: 4, value: 2.4, drive: '-rate',
        hint: 'How long a drawn line glows before it fades. Left: only a comet tail behind the pen. Right: old figures linger and layer over each other.',
        icon: (g, v, w, h) => { if (v > 0.05) liss(g, w, h, { fx: 2, fy: 3, ph: 0.6, alpha: v * 0.9 }); liss(g, w, h, { fx: 2, fy: 3, ph: 0.6, frac: 0.18, col: ICON.ink, lw: 1.6, nib: true }); } },
    ],
    reset() { fig = null; phase = phaseTo = 0; lastTop = null; lastRestart = -9; og.globalCompositeOperation = 'source-over'; og.fillStyle = '#000'; og.fillRect(0, 0, off.width, off.height); },
    onChord(ch, x) {
      const distinct = new Set(ch.notes.map((n) => n.m)).size;
      const top = ch.notes.reduce((b, n) => (n.m > b.m ? n : b), ch.notes[0]);
      const gap = x.t - lastRestart;
      if (distinct >= 2) {
        const pcs = tune(ch.notes).pcs;
        // A new harmony restarts the pen; so does the same chord struck again after a pause, or struck much harder.
        if (!fig || (gap > 0.18 && (pcs !== fig.pcs || gap > 1.2 || ch.vel > fig.vel * 1.15))) { restart(x, ch); lastTop = top.m; return; }
      } else if (!fig || (gap > 0.5 && fig.env < 0.15) || (gap > 1.5 && top.m < 52)) { restart(x, ch); lastTop = top.m; return; } // a lone line (the oboe) restarts a spent figure
      // Otherwise it's melody over the figure: bend the line by the step the top note took.
      if (lastTop != null) phaseTo += Math.max(-1, Math.min(1, (top.m - lastTop) / 7)) * 1.1;
      lastTop = top.m;
      if (fig) fig.kick = Math.min(1, (fig.kick || 0) + ch.vel / 160);
    },
    frame(x) {
      const W = x.W, H = x.H;
      // Fade the figure's own canvas by "how long the lines stay" (half-life in seconds); the colour-burn takes the last
      // few 8-bit levels to black so no grey ghosts stick.
      const stay = x.p('stay');
      og.globalCompositeOperation = 'source-over'; og.globalAlpha = 1;
      og.fillStyle = `rgba(0,0,0,${(1 - Math.pow(0.5, x.dt / stay)).toFixed(4)})`; og.fillRect(0, 0, W, H);
      og.globalCompositeOperation = 'color-burn'; og.fillStyle = 'rgb(253,253,253)'; og.fillRect(0, 0, W, H);
      phase += (phaseTo - phase) * (1 - Math.pow(0.5, x.dt / 0.12));

      // After a seek (or switching the widget on mid-chord) start from whatever is sounding.
      if (!fig) { const snd = x.sounding(); if (snd.length) restart(x, { notes: snd.map((n) => ({ m: n.m, v: n.v })), vel: Math.max(...snd.map((n) => n.v)) }); }
      let head = null;
      if (fig) {
        const f = fig, swirl = x.p('swirl'), size = x.p('size');
        f.damp = x.p('damp'); f.ph = phase;
        const maxF = Math.max(...f.fx.map((p) => p[0]), ...f.fy.map((p) => p[0]));
        const step = 0.055 / (TAU * maxF), until = f.tau + x.p('speed') * x.dt;
        const cx = W / 2, cy = H / 2, Ax = f.A * size * 1.55, Ay = f.A * size;
        const c = Math.cos(f.tilt), s = Math.sin(f.tilt);
        const map = ([px, py]) => { const X = px * Ax, Y = py * Ay; return [cx + X * c - Y * s, cy + X * s + Y * c]; };
        const pts = [];
        if (f.last) pts.push(f.last);
        let env = 1;
        for (let t = f.tau + step; t <= until + 1e-9; t += step) { const p = point(f, t, swirl); env = p[2]; pts.push(map(p)); f.tau = t; }
        f.env = Math.exp(-f.damp * f.tau);
        if (pts.length > 1 && env > 0.02) {
          const [r, gg, b] = f.col, bright = (0.35 + 0.65 * Math.min(1, f.vel / 110)) * Math.pow(env, 0.35) * (1 + (f.kick || 0) * 0.6);
          // Butt caps: round ones would double up where one frame's stroke meets the next and leave beads along the line.
          og.globalCompositeOperation = 'lighter'; og.lineCap = 'butt'; og.lineJoin = 'round';
          const path = () => { og.beginPath(); og.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) og.lineTo(pts[i][0], pts[i][1]); og.stroke(); };
          og.strokeStyle = `rgba(${r},${gg},${b},${(0.10 * bright).toFixed(3)})`; og.lineWidth = 9; path();
          og.strokeStyle = `rgba(${r},${gg},${b},${(0.30 * bright).toFixed(3)})`; og.lineWidth = 3.2; path();
          og.strokeStyle = `rgba(${Math.min(255, r + 70)},${Math.min(255, gg + 70)},${Math.min(255, b + 70)},${Math.min(1, 0.95 * bright).toFixed(3)})`; og.lineWidth = 1.3; path();
          for (const p of pts) f.tail.push(p);
          if (f.tail.length > 40) f.tail.splice(0, f.tail.length - 40);
        }
        f.last = pts[pts.length - 1] || f.last;
        f.kick = (f.kick || 0) * Math.pow(0.5, x.dt / 0.15);
        if (env > 0.02 && f.tail.length > 1) head = { tail: f.tail, col: f.col, env };
      }

      const g = x.g;
      g.globalCompositeOperation = 'lighten'; g.drawImage(off, 0, 0);
      if (head) { // the pen: the last stretch of line, white-hot
        const [r, gg, b] = head.col, T = head.tail;
        g.globalCompositeOperation = 'lighter'; g.shadowColor = `rgb(${r},${gg},${b})`; g.shadowBlur = 10;
        g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.6;
        g.strokeStyle = `rgba(255,248,236,${(0.25 + 0.45 * head.env).toFixed(3)})`;
        g.beginPath(); g.moveTo(T[0][0], T[0][1]); for (let i = 1; i < T.length; i++) g.lineTo(T[i][0], T[i][1]); g.stroke();
      }
    },
  });
})();
