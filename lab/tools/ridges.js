// Ridges v2: after the Unknown Pleasures plot, pushed away from the quote. Stacked ridgelines on black; each line is a
// slice of the music a moment ago, across the keyboard (bass left, treble right): every sounding note raises a peak where
// it sits, as tall as it is loud (bass notes broad hills, treble notes thin needles), with smaller peaks for overtones.
// The front line is the music now; older lines roll up and away behind it. v2: each line keeps the loudness it was made
// with (soft passages are fine dim hairlines packed close, loud ones bold bright lines spaced wide), every attack leaves a
// spark on the crest of its peak that rides its line back into the stack, the lines fade out at their ends instead of
// stopping in a hard-edged block, and they run warm on the bass side, cool on the treble side.
// A sixth knob, how present (the user, 2026-11-01: sliders should dim, not only boost). Turned down, the lines are fainter,
// thinner, lower and roll slower, and only the hardest attacks of the piece leap up and leave a spark. At 1 it changes nothing.
(() => {
  const BONE = '236,228,212', WARM = '246,214,182', COOL = '198,216,238', EMBER = [255, 132, 72];
  const B = 200;                       // points along one line
  const ACT0 = 0.12, ACT1 = 0.88;      // the active part of a line (the ends stay flat and fade out)
  const M0 = 24, M1 = 102;             // MIDI range across the active part
  const OVER = [[0, 1], [12, 0.42], [19, 0.24], [24, 0.14]];   // a note's peak and its overtones (semitones, weight)
  const MAXROWS = 170;
  // a row: { a: heights, gap: room it takes in front of it (loud rows take more), lvl: loudness it was made with, gl: sparks }
  let rows = [], pend = null, pendNoise = null, pendGap = 0.7, pendLvl = 0, pendGl = [];
  let live = new Float32Array(B), since = 0, hits = [], flash = 0;
  // how high a value lifts its line: soft compression, so a dense chord still peaks instead of flattening into a plateau
  const lift = (v) => { const a = (1.1 * v) / (1 + 0.55 * v); return a < 1.2 ? a : 1.2 + (a - 1.2) / (1 + (a - 1.2) * 1.5); };
  // the taper that keeps the line ends flat, and the pitch of each point
  const TAPER = new Float32Array(B), PITCH = new Float32Array(B);
  for (let i = 0; i < B; i++) {
    const f = i / (B - 1), u = (f - ACT0) / (ACT1 - ACT0);
    PITCH[i] = M0 + u * (M1 - M0);
    TAPER[i] = u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 0.6);
  }
  // how present (0..1): which notes count as attacks, judged against this piece's own notes (recordings differ a lot in how
  // hard they play): every one at 1, the hardest 40% or so at 0.4, the hardest 5% at 0
  let vels = null;
  const hardEnough = (v, x) => {
    const cut = (1 - x.p('presence')) * 0.95;
    if (cut <= 0) return true;
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= cut;
  };
  const noiseRow = () => { const a = new Float32Array(B); let s = 0; for (let i = 0; i < B; i++) { s = s * 0.55 + (Math.random() - 0.5); a[i] = s; } return a; };
  // bass notes swell into broad hills, treble notes into thin needles
  const widthAt = (c) => 1.5 - 0.9 * Math.max(0, Math.min(1, (c - M0) / (M1 - M0)));
  const idxOf = (m) => Math.max(0, Math.min(B - 1, Math.round(ACT0 * (B - 1) + ((m - M0) / (M1 - M0)) * (ACT1 - ACT0) * (B - 1))));

  // add a peak of height amp at MIDI m (and its overtones), width sig0 semitones (scaled by register), into arr
  function peak(arr, m, amp, sig0) {
    for (const [dm, w] of OVER) {
      const c = m + dm, a = amp * w, sig = sig0 * widthAt(c); if (c > M1 + 3 || a < 0.01) continue;
      const i0 = Math.max(0, Math.floor(ACT0 * (B - 1) + ((c - 3 * sig - M0) / (M1 - M0)) * (ACT1 - ACT0) * (B - 1)));
      const i1 = Math.min(B - 1, Math.ceil(ACT0 * (B - 1) + ((c + 3 * sig - M0) / (M1 - M0)) * (ACT1 - ACT0) * (B - 1)));
      for (let i = i0; i <= i1; i++) { const d = (PITCH[i] - c) / sig; arr[i] += a * Math.exp(-0.5 * d * d); }
    }
  }

  // mini ridgelines for the knob pictures: n lines, peak amp 0..1, sharp 0..1, persp 0..1
  function mini(g, w, h, { n = 5, amp = 0.6, sharp = 0.3, persp = 0, col = ICON.ink, lw = 1.1 } = {}) {
    const R = ICON.rng(11), top = 4, bot = h - 2;
    for (let k = n - 1; k >= 0; k--) {
      const u = n === 1 ? 0 : k / (n - 1), K = persp * 4, s = 1 / (1 + K * u);
      const f = K < 0.01 ? u : (1 - s) / (1 - 1 / (1 + K));
      const y = bot - f * (bot - top - 6), half = (w / 2 - 2) * (0.55 + 0.45 * s), cx = w / 2;
      const p1 = 0.3 + R() * 0.4, p2 = 0.3 + R() * 0.4, pts = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30, sg = 0.13 - sharp * 0.09;
        let v = Math.exp(-0.5 * ((t - p1) / sg) ** 2) + 0.6 * Math.exp(-0.5 * ((t - p2) / sg) ** 2);
        v += sharp * (R() - 0.3) * 0.5 * v;
        const tp = Math.sin(Math.PI * t);
        pts.push([cx - half + t * 2 * half, y - v * tp * amp * 9 * s]);
      }
      g.fillStyle = '#110e11'; g.beginPath(); g.moveTo(pts[0][0], y + 1);
      for (const [px, py] of pts) g.lineTo(px, py); g.lineTo(pts[30][0], y + 1); g.closePath(); g.fill();
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    }
  }

  TOOLS.push({
    id: 'ridges', name: 'Ridges', tag: 'v2',
    blurb: 'Ridgelines on black, one slice of the music per line across the keyboard (bass left, treble right); the front line is now and older ones roll away behind it. New: every line keeps the loudness it was made with, so soft passages pack into fine dim hairlines and loud ones spread into bold bright lines, and each attack leaves a spark on its peak that rides back into the stack. A <b>how present</b> knob tones it right down: faint, low, slow lines, and only the hardest attacks spark. Paints its own black.',
    params: [
      { key: 'height', label: 'how tall the peaks rise', min: 0.3, max: 2.5, value: 1, drive: '+level',
        hint: 'How high a loud note lifts its line. Left: low, gentle hills. Right: tall peaks that hide many lines behind them.',
        icon: (g, v, w, h) => mini(g, w, h, { n: 4, amp: 0.15 + v * 0.95 }) },
      { key: 'speed', label: 'how fast the lines roll away', min: 4, max: 30, value: 11, drive: '+rate',
        hint: 'How quickly each new line moves back into the stack. Left: slow, a long memory of the music. Right: fast, only the last moment.',
        icon: (g, v, w, h) => { ICON.lines(g, 4, w - 12, h, { lw: 1, pad: 4 }); ICON.arrow(g, w - 6, h - 3, w - 6, h - 5 - v * (h - 9), ICON.ink, 1.4); } },
      { key: 'lines', label: 'how many lines', min: 16, max: 80, step: 1, value: 46,
        hint: 'How many lines are stacked. Left: a few, far apart. Right: many, packed tight.',
        icon: (g, v, w, h) => mini(g, w, h, { n: Math.round(3 + v * 6), amp: 0.5, lw: 1 }) },
      { key: 'sharp', label: 'soft hills or sharp needles', min: 0, max: 1, value: 0.4,
        hint: 'The shape of a peak. Left: smooth, rounded hills. Right: thin, jagged needles.',
        icon: (g, v, w, h) => mini(g, w, h, { n: 2, amp: 0.9, sharp: v }) },
      { key: 'depth', label: 'flat or deep', min: 0, max: 1, value: 0.3,
        hint: 'How far the stack recedes. Left: flat, every line the same width. Right: lines shrink and crowd toward the top, rolling into the distance.',
        icon: (g, v, w, h) => mini(g, w, h, { n: 7, amp: 0.12, persp: v, lw: 1 }) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: faint, low lines rolling slowly, and only the hardest attacks leap up and spark. Right: every attack at full strength (as before).',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + 0.85 * v, () => mini(g, w, h, { n: 4, amp: 0.2 + 0.7 * v })) },
    ],
    reset() { vels = null; rows = []; pend = null; pendNoise = null; pendGap = 0.7; pendLvl = 0; pendGl = []; live = new Float32Array(B); since = 0; hits = []; flash = 0; },
    onChord(ch, x) {
      let k = 0;
      for (const n of ch.notes) if (hardEnough(n.v, x)) { hits.push({ m: n.m, v: n.v, age: 0, fresh: true }); k++; }
      if (ch.notes.length && !k) return;     // too soft for how present: the notes still rise as sounding notes, without a flare
      flash = Math.max(flash, Math.pow(ch.vel / 127, 1.5) * Math.min(1.4, 0.6 + k * 0.12));
    },
    frame(x) {
      const g = x.g, W = x.W, H = x.H, dt = x.dt, f = x.feat;
      const sharp = x.p('sharp'), sig = 2.4 - sharp * 1.75, rough = 0.06 + sharp * 0.5;
      // how present: every factor is exactly 1 at 1. Applied as the lines are drawn, so turning it down dims the whole stack at once.
      const pres = x.p('presence'), ink = 1 - 0.94 * (1 - pres), low = 1 - 0.7 * (1 - pres), thin = 1 - 0.5 * (1 - pres), roll = 1 - 0.6 * (1 - pres);
      // the live slice: sounding notes, a jump on the attack, a floor of noise that is busier when the music is
      live.fill(0);
      for (const n of x.sounding()) {
        const age = x.t - n.start, vv = 0.15 + 0.85 * Math.pow(n.v / 127, 1.1);
        peak(live, n.m, vv * (0.32 + 0.68 * Math.exp(-age / 1.6)), sig);
      }
      for (const h of hits) {
        h.age += dt; const k = Math.exp(-h.age / 0.11), v = Math.pow(h.v / 127, 1.1);
        if (k > 0.02) peak(live, h.m, 1.15 * v * k, sig * 0.75);
        // the attack's spark, carried by the line this attack lands on (one per spot: the louder wins)
        if (h.fresh) {
          h.fresh = false;
          if (h.m >= M0 - 2 && h.m <= M1 + 2) {
            const i = idxOf(h.m), same = pendGl.find((s) => Math.abs(s.i - i) < 2);
            if (same) same.v = Math.max(same.v, v); else pendGl.push({ i, v });
          }
        }
      }
      hits = hits.filter((h) => h.age < 0.5);
      if (!pendNoise) pendNoise = noiseRow();
      const floor = 0.015 + 0.04 * f.level + 0.07 * f.density;
      const tall = x.p('height');   // baked into the line as it is made: a past line keeps the height it had
      for (let i = 0; i < B; i++) live[i] = tall * Math.max(0, (live[i] * (1 + rough * pendNoise[i] * 0.9) + floor * (0.6 + pendNoise[i])) * TAPER[i]);
      // the next line remembers the highest the slice reached while it waited, so no attack slips between two lines
      if (!pend) pend = new Float32Array(B);
      for (let i = 0; i < B; i++) if (live[i] > pend[i]) pend[i] = live[i];
      pendLvl = Math.max(pendLvl, f.level);
      since += dt * x.p('speed') * roll;      // counted in lines, so a changing speed never makes the stack lurch
      while (since >= 1) {
        since -= 1;
        rows.unshift({ a: pend, gap: pendGap, lvl: pendLvl, gl: pendGl });
        // the room the next line takes is set as it starts: loud music spreads the stack, soft music packs it
        pend = new Float32Array(B); pendNoise = noiseRow(); pendGl = []; pendLvl = f.level;
        pendGap = 0.5 + 0.95 * Math.min(1, f.level);
        if (rows.length > MAXROWS) rows.length = MAXROWS;
      }
      const frac = since;
      flash *= Math.pow(0.5, dt / 0.12);

      // geometry: the front line low on the canvas, the stack rising behind it
      const N = Math.round(x.p('lines')), depth = x.p('depth'), K = depth * 4;
      const yFront = H * 0.92, ySpan = H * 0.64, cx = W / 2, half = W * 0.35;
      const hMax = 125 * Math.pow(46 / N, 0.35);
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.lineJoin = 'round'; g.lineCap = 'round';
      const draw = (arr, z, bright0, lw0, gl, glow) => {
        const bright = bright0 * ink, lw = lw0 * thin;
        const u = z / N, s = 1 / (1 + K * u);
        const fz = K < 0.01 ? u : (1 - s) / (1 - 1 / (1 + K));
        const y = yFront - fz * ySpan, hw = half * (0.45 + 0.55 * s), amp = hMax * (0.35 + 0.65 * s) * low;
        const x0 = cx - hw, sx = (2 * hw) / (B - 1);
        g.beginPath(); g.moveTo(x0, y + 1.5);
        for (let i = 0; i < B; i++) g.lineTo(x0 + i * sx, y - amp * lift(arr[i]));
        g.lineTo(x0 + (B - 1) * sx, y + 1.5); g.closePath();
        g.fillStyle = '#000'; g.fill();
        g.beginPath();
        for (let i = 0; i < B; i++) { const px = x0 + i * sx, py = y - amp * lift(arr[i]); i ? g.lineTo(px, py) : g.moveTo(px, py); }
        // warm on the bass side, cool on the treble side, fading out at both ends
        const gr = g.createLinearGradient(x0, 0, x0 + 2 * hw, 0);
        gr.addColorStop(0, `rgba(${WARM},0)`); gr.addColorStop(0.13, `rgba(${WARM},${bright})`);
        gr.addColorStop(0.5, `rgba(${BONE},${bright})`);
        gr.addColorStop(0.87, `rgba(${COOL},${bright})`); gr.addColorStop(1, `rgba(${COOL},0)`);
        g.strokeStyle = gr;
        if (glow) { g.globalAlpha = glow; g.lineWidth = lw * 5; g.stroke(); g.globalAlpha = 1; }
        g.lineWidth = lw * (0.6 + 0.4 * s); g.stroke();
        // the sparks: a point of light on the crest each attack raised
        if (gl) for (const sp of gl) {
          const px = x0 + sp.i * sx, py = y - amp * lift(arr[sp.i]) - lw * 0.3, e = 0.35 + 0.65 * Math.pow(sp.v, 1.5);
          const r = (1.1 + 2.6 * sp.v) * (0.55 + 0.45 * s), a = Math.min(1, bright * 1.4);
          const col = `${Math.round(255 + (EMBER[0] - 255) * e)},${Math.round(246 + (EMBER[1] - 246) * e)},${Math.round(232 + (EMBER[2] - 232) * e)}`;
          g.fillStyle = `rgba(${col},${a * 0.22})`; g.beginPath(); g.arc(px, py, r * 2.6, 0, Math.PI * 2); g.fill();
          g.fillStyle = `rgba(${col},${a})`; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
        }
      };
      // where each line sits: loud lines claim more room in front of them
      let z = frac * pendGap, n = 0;
      const zs = [];
      while (n < rows.length && z <= N) { zs.push(z); z += rows[n].gap; n++; }
      // back to front, so every line hides the ones behind it
      for (let k = n - 1; k >= 0; k--) {
        const r = rows[k], zk = zs[k], far = zk / N, edge = Math.min(1, (N - zk) / 2);
        const lv = Math.min(1.1, r.lvl), loud = 0.38 + 0.62 * Math.min(1, lv);
        draw(r.a, zk, (0.95 - 0.5 * far * far) * edge * loud, 0.45 + 2.3 * Math.pow(lv, 1.6), r.gl, 0);
      }
      // the present: the live slice, flaring on an attack
      const fl = flash * pres;
      draw(live, 0, Math.min(1, 0.9 + fl), 1.4 + 0.8 * Math.min(1, f.level) + fl * 2.2, null, (0.05 + 0.12 * Math.min(1, fl)) * ink);
    },
  });
})();
