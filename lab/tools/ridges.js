// Ridges: after the Unknown Pleasures plot. Stacked bone-white ridgelines on black; each line is a slice of the music
// a moment ago, across the keyboard (bass left, treble right): every sounding note raises a peak where it sits, as tall
// as it is loud, with smaller peaks for its overtones. The front line is the music now; older lines roll up and away
// behind it, and a tall peak in front hides what came just before it. An attack makes its peaks jump on the spot.
(() => {
  const BONE = '236,228,212';
  const B = 200;                       // points along one line
  const ACT0 = 0.1, ACT1 = 0.9;        // the active part of a line (the ends stay flat, as in the plot)
  const M0 = 24, M1 = 102;             // MIDI range across the active part
  const OVER = [[0, 1], [12, 0.42], [19, 0.24], [24, 0.14]];   // a note's peak and its overtones (semitones, weight)
  const MAXROWS = 90;
  let rows = [], pend = null, pendNoise = null, live = new Float32Array(B), since = 0, hits = [], flash = 0;
  // how high a value lifts its line: soft compression, so a dense chord still peaks instead of flattening into a plateau
  const lift = (v) => { const a = (1.1 * v) / (1 + 0.55 * v); return a < 1.2 ? a : 1.2 + (a - 1.2) / (1 + (a - 1.2) * 1.5); };
  // the taper that keeps the line ends flat, and the pitch of each point
  const TAPER = new Float32Array(B), PITCH = new Float32Array(B);
  for (let i = 0; i < B; i++) {
    const f = i / (B - 1), u = (f - ACT0) / (ACT1 - ACT0);
    PITCH[i] = M0 + u * (M1 - M0);
    TAPER[i] = u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 0.6);
  }
  const noiseRow = () => { const a = new Float32Array(B); let s = 0; for (let i = 0; i < B; i++) { s = s * 0.55 + (Math.random() - 0.5); a[i] = s; } return a; };

  // add a peak of height amp at MIDI m (and its overtones), width sig semitones, into arr
  function peak(arr, m, amp, sig) {
    for (const [dm, w] of OVER) {
      const c = m + dm, a = amp * w; if (c > M1 + 3 || a < 0.01) continue;
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
    id: 'ridges', name: 'Ridges', tag: 'new',
    blurb: 'After the Unknown Pleasures cover: bone-white ridgelines stacked on black. Each line is a slice of the music across the keyboard (bass left, treble right); every note raises a peak as tall as it is loud. The front line is now; older lines roll up and away behind it, and a loud peak hides what came just before. Attacks make the peaks jump. Paints its own black.',
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
      { key: 'sharp', label: 'soft hills or sharp needles', min: 0, max: 1, value: 0.45,
        hint: 'The shape of a peak. Left: smooth, rounded hills. Right: thin, jagged needles, like the original pulsar plot.',
        icon: (g, v, w, h) => mini(g, w, h, { n: 2, amp: 0.9, sharp: v }) },
      { key: 'depth', label: 'flat or deep', min: 0, max: 1, value: 0.25,
        hint: 'How far the stack recedes. Left: flat, every line the same width, like the album cover. Right: lines shrink and crowd toward the top, rolling into the distance.',
        icon: (g, v, w, h) => mini(g, w, h, { n: 7, amp: 0.12, persp: v, lw: 1 }) },
    ],
    reset() { rows = []; pend = null; pendNoise = null; live = new Float32Array(B); since = 0; hits = []; flash = 0; },
    onChord(ch) {
      for (const n of ch.notes) hits.push({ m: n.m, v: n.v, age: 0 });
      flash = Math.max(flash, Math.pow(ch.vel / 127, 1.5) * Math.min(1.4, 0.6 + ch.notes.length * 0.12));
    },
    frame(x) {
      const g = x.g, W = x.W, H = x.H, dt = x.dt;
      const sharp = x.p('sharp'), sig = 2.4 - sharp * 1.75, rough = 0.06 + sharp * 0.5;
      // the live slice: sounding notes, a jump on the attack, a quiet floor of noise in the middle
      live.fill(0);
      for (const n of x.sounding()) {
        const age = x.t - n.start, vv = 0.15 + 0.85 * Math.pow(n.v / 127, 1.1);
        peak(live, n.m, vv * (0.32 + 0.68 * Math.exp(-age / 1.6)), sig);
      }
      for (const h of hits) { h.age += dt; const k = Math.exp(-h.age / 0.11); if (k > 0.02) peak(live, h.m, 1.15 * Math.pow(h.v / 127, 1.1) * k, sig * 0.75); }
      hits = hits.filter((h) => h.age < 0.5);
      if (!pendNoise) pendNoise = noiseRow();
      const floor = 0.025 + 0.05 * x.feat.level;
      const tall = x.p('height');   // baked into the line as it is made: a past line keeps the height it had
      for (let i = 0; i < B; i++) live[i] = tall * Math.max(0, (live[i] * (1 + rough * pendNoise[i] * 0.9) + floor * (0.6 + pendNoise[i])) * TAPER[i]);
      // the next line remembers the highest the slice reached while it waited, so no attack slips between two lines
      if (!pend) pend = new Float32Array(B);
      for (let i = 0; i < B; i++) if (live[i] > pend[i]) pend[i] = live[i];
      since += dt * x.p('speed');      // counted in lines, so a changing speed never makes the stack lurch
      while (since >= 1) { since -= 1; rows.unshift(pend); pend = new Float32Array(B); pendNoise = noiseRow(); if (rows.length > MAXROWS) rows.length = MAXROWS; }
      const frac = since;
      flash *= Math.pow(0.5, dt / 0.12);

      // geometry: the front line low on the canvas, the stack rising behind it
      const N = Math.round(x.p('lines')), depth = x.p('depth'), K = depth * 4;
      const yFront = H * 0.92, ySpan = H * 0.62, cx = W / 2, half = W * 0.27;
      const hMax = 125 * Math.pow(46 / N, 0.35);
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.lineJoin = 'round'; g.lineCap = 'round';
      const draw = (arr, z, bright, lw) => {
        const u = z / N, s = 1 / (1 + K * u);
        const f = K < 0.01 ? u : (1 - s) / (1 - 1 / (1 + K));
        const y = yFront - f * ySpan, hw = half * (0.45 + 0.55 * s), amp = hMax * (0.35 + 0.65 * s);
        const x0 = cx - hw, sx = (2 * hw) / (B - 1);
        g.beginPath(); g.moveTo(x0, y + 1.5);
        for (let i = 0; i < B; i++) g.lineTo(x0 + i * sx, y - amp * lift(arr[i]));
        g.lineTo(x0 + (B - 1) * sx, y + 1.5); g.closePath();
        g.fillStyle = '#000'; g.fill();
        g.beginPath();
        for (let i = 0; i < B; i++) { const px = x0 + i * sx, py = y - amp * lift(arr[i]); i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.strokeStyle = `rgba(${BONE},${bright})`; g.lineWidth = lw * (0.6 + 0.4 * s); g.stroke();
      };
      // back to front, so every line hides the ones behind it
      const n = Math.min(rows.length, N);
      for (let k = n - 1; k >= 0; k--) {
        const z = k + frac;
        if (z > N) continue;
        const far = z / N, edge = Math.min(1, (N - z) / 1.5);
        draw(rows[k], z, (0.95 - 0.5 * far * far) * edge, 1.5);
      }
      // the present: the live slice, flaring on an attack
      draw(live, 0, Math.min(1, 0.9 + flash), 1.6 + flash * 2.2);
    },
  });
})();
