// Halftone: two overprinted dot screens (like risograph plates at different angles). Every attack sends a wave
// of swelling dots out from a point (x by pitch): low notes print big slow swells on the red plate, high notes
// small fast ripples on the pale plate. Held harmony prints a standing interference pattern.
(() => {
  const TAU = Math.PI * 2, LAYER_SPLIT = 58;
  let waves = [], time = 0, kick = 0, kickRot = 0, flip = 0, lastFlip = -9, ref = 80;
  const paths = [[], []];

  // One wave's shape across the ring: a crest at the front with a fainter trailing crest behind it.
  function ring(u) {
    if (u > 0.5 || u < -1.5) return 0;
    const c = Math.cos(Math.PI * u);
    return c * c * (u < 0 ? 1 + u * 0.55 : 1);
  }

  function hsl(h, s, l, a) { return `hsla(${h.toFixed(0)},${s}%,${l}%,${a})`; }

  TOOLS.push({
    id: 'halftone', name: 'Halftone', tag: 'new',
    blurb: 'Two overprinted dot screens, deep red and pale. Each attack sends a wave of swelling dots out from a point placed by pitch: low notes big slow swells on the red screen, high notes small fast ripples on the pale one; held chords print a faint standing interference pattern, and the loudest full chords flash the red screen in negative.',
    // Five knobs (the user's rule for this round). Folded into fixed choices: screen angle 15°, the negative flash on the
    // loudest full chords, the plate colours, and wave speed (now follows how fast the music is played by itself).
    params: [
      { key: 'grid', label: 'dot size', min: 10, max: 44, step: 1, value: 20,
        hint: 'How coarse the dot screen is. Left: a fine screen of tiny dots. Right: a coarse screen of big dots.',
        icon: (g, v, w, h) => { const s = 4.5 + v * 8; for (let y = 2 + s / 2; y < h; y += s) for (let x = 2 + s / 2; x < w; x += s) ICON.dot(g, x, y, s * 0.34, ICON.red); } },
      { key: 'shape', label: 'dot shape', min: 0, max: 3, step: 1, value: 0,
        hint: 'What the screen is printed with. Left: round dots, then squares, then crosses. Right: lines.',
        icon: (g, v, w, h) => {
          const k = Math.round(v * 3), R = ICON.red;
          if (k === 3) { [1.2, 2.6, 1.8].forEach((q, i) => ICON.rect(g, 3, 5 + i * 8 - q, w - 6, 2 * q, R)); return; }
          for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
            const x = 8 + i * 12, y = 8 + j * 10, r = j ? 3.6 : 2.6;
            if (k === 0) ICON.dot(g, x, y, r, R);
            else if (k === 1) ICON.square(g, x, y, r * 1.7, R);
            else { ICON.rect(g, x - r, y - 0.9, 2 * r, 1.8, R); ICON.rect(g, x - 0.9, y - r, 1.8, 2 * r, R); }
          }
        } },
      // New key (was 'decay', driven by speed): that drive cut waves to a flash in fast passages, so dense b5 printed almost nothing.
      { key: 'life', label: 'how long the waves last', min: 0.4, max: 6, value: 2.2,
        hint: 'How long a wave of dots keeps spreading before it fades. Left: a quick pulse. Right: slow rings that linger.',
        icon: (g, v, w, h) => { for (let i = 0; i < 5; i++) { const a = Math.max(0, 1 - i / (0.7 + v * 4.3)); if (a > 0) ICON.alpha(g, a, () => ICON.ring(g, 7, h / 2, 2.5 + i * 7, ICON.red, 2)); } } },
      { key: 'contrast', label: 'hard print', min: 0, max: 1, value: 0.45, drive: '+level',
        hint: 'How the dots swell. Left: soft, every size in between, like a photo. Right: hard, each dot is either full or gone, like a stamp.',
        icon: (g, v, w, h) => {
          const kc = 2.5 + 22 * v, t0 = 0.42, f = (u) => 1 / (1 + Math.exp(-kc * (u - t0))), l0 = f(0), l1 = f(1);
          for (let i = 0; i < 6; i++) { const u = i / 5, t = (1 - v) * u + v * (f(u) - l0) / (l1 - l0); ICON.dot(g, 4 + i * 6.4, h / 2, 0.5 + 2.7 * t, ICON.red); }
        } },
      { key: 'standing', label: 'stripes from held chords', min: 0, max: 1.5, value: 0.6, drive: '+density',
        hint: 'While a chord rings, its notes print a faint standing pattern of stripes. Left: none, only the waves. Right: strong stripes.',
        icon: (g, v, w, h) => { for (let y = 4; y < h; y += 6) for (let x = 4; x < w; x += 6) ICON.dot(g, x, y, 1.2 * (1 - v) + v * (0.3 + 2.5 * (0.5 + 0.5 * Math.cos((x - y * 0.7) * 0.33))), ICON.gold); } },
    ],
    reset() { waves = []; time = 0; kick = 0; kickRot = 0; flip = 0; lastFlip = -9; ref = 80; },
    onChord(ch, x) {
      // Only the few loudest notes of a chord make waves (the rough b5 transcription is full of tiny notes).
      // Loudness is half absolute, half relative to the recent level, so quiet passages and the softer b5 transcription still print.
      ref += (ch.vel - ref) * 0.08;
      const ns = [...ch.notes].sort((a, b) => b.v - a.v).slice(0, 3);
      if (!ns.some((n) => n.m === ch.lo)) ns.push(ch.notes.find((n) => n.m === ch.lo)); // the bass always speaks
      for (const n of ns) {
        const p = x.pitch01(n.m), vv = 0.4 * n.v / 110 + 0.6 * Math.min(1.3, n.v / Math.max(50, ref)), low = 1 - p;
        waves.push({
          x: x.W * (0.06 + 0.88 * p) + x.rnd(-30, 30),
          y: x.H * (0.5 + x.rnd(-0.28, 0.28)),
          born: time, layer: n.m < LAYER_SPLIT ? 0 : 1,
          amp: (0.42 + 0.5 * low) * vv,
          sp: 140 + 900 * p * p,                // px/s at speed 1: low swells crawl, high ripples dart
          w: 22 + 120 * low * low,              // ring width: wide soft swells vs thin ripples
          dur: n.d,
        });
      }
      if (waves.length > 36) waves.splice(0, waves.length - 36);
      if (ch.vel >= 96 && ch.notes.length >= 4) { kick = Math.min(1.2, kick + 0.6 + (ch.vel - 96) / 30); kickRot = (Math.random() < 0.5 ? -1 : 1) * 0.05; }
      // The loudest, fullest chords print the red plate in negative for an instant (at most every ~1.2 s).
      if (ch.vel >= 100 && ch.notes.length >= 5 && time - lastFlip > 1.2) { flip = 1; lastFlip = time; }
    },
    frame(x) {
      const g = x.g, W = x.W, H = x.H;
      time += x.dt; kick *= Math.pow(0.5, x.dt / 0.12); flip *= Math.pow(0.5, x.dt / 0.09); kickRot *= Math.pow(0.5, x.dt / 0.25);
      // Waves spread faster when the music is played faster (was a knob; now built in).
      const grid = x.p('grid'), shape = Math.round(x.p('shape')), speed = 0.85 + 0.7 * x.feat.rate, life = x.p('life') * (1 - 0.3 * x.feat.rate);
      const con = x.p('contrast'), stand = x.p('standing');
      const rot0 = 15 * Math.PI / 180 + kickRot, off = Math.PI / 6, neg = flip * 0.6; // fixed screen angle; the negative flash on the loudest chords
      const hues = [356, 44]; // deep red low plate, pale gold high plate

      // Per-frame wave scalars, kept out of the dot loop.
      const live = [[], []];
      for (const w of waves) {
        const age = time - w.born, env = Math.exp(-age / (life * (0.6 + 0.4 * Math.min(2, w.dur + 0.4))));
        if (env < 0.03) continue;
        const R = w.sp * speed * age;
        live[w.layer].push({ x: w.x, y: w.y, R, w: w.w, a: w.amp * env,
          src: w.amp * 1.15 * Math.exp(-age / 0.16), sw2: 1 / (w.w * w.w * 0.5), out2: (R + w.w * 0.5) ** 2, in2: Math.max(0, R - w.w * 1.5) ** 2 });
      }
      waves = waves.filter((w) => time - w.born < life * 2.5);
      // A crowd of waves (the climax) shares the ink, so the screen keeps its rings instead of printing solid.
      // Shared by how much ink they carry, not by how many there are: the many soft, short b5 notes printed almost nothing.
      for (const L of live) { let sa = 0; for (const w of L) sa += w.a; const k = 1 / Math.pow(Math.max(1, sa / 3.2), 0.68); for (const w of L) w.a *= k; }

      // Standing pattern: each held note is a plane wave whose angle is its place on the circle of fifths
      // and whose spatial wavelength follows its octave.
      const held = [[], []];
      const snd = x.sounding().sort((a, b) => b.v - a.v).slice(0, 6);
      for (const n of snd) {
        const age = x.t - n.start, a = (n.v / 110) * Math.min(1, age / 0.25) * Math.exp(-age / 5);
        if (a < 0.02) continue;
        const th = ((n.m * 7) % 12) / 12 * TAU, lam = 70 + 380 * Math.pow(1 - x.pitch01(n.m), 1.5);
        const k = TAU / lam;
        held[n.m < LAYER_SPLIT ? 0 : 1].push({ kx: Math.cos(th) * k, ky: Math.sin(th) * k, ph: n.m * 1.7, a });
      }
      for (const L of held) { const s = 1 / Math.sqrt(Math.max(1, L.length)); for (const h of L) h.a *= s; }

      // Contrast: a logistic curve; at 1 a dot is either full or gone (the print look).
      const kc = 2.5 + 22 * con, th0 = 0.4, l0 = 1 / (1 + Math.exp(kc * th0)), l1 = 1 / (1 + Math.exp(-kc * (1 - th0)));
      const tone = (v) => ((1 / (1 + Math.exp(-kc * (v - th0)))) - l0) / (l1 - l0);

      const N = Math.ceil(Math.hypot(W, H) / 2 / grid) + 1, rMax = grid * (shape === 3 ? 0.5 : 0.62), rMin = 0.7;
      for (let L = 0; L < 2; L++) {
        const ang = rot0 + (L ? off : 0), ca = Math.cos(ang), sa = Math.sin(ang);
        const ws = live[L], hs = held[L], B = paths[L];
        B[0] = new Path2D(); B[1] = new Path2D(); B[2] = new Path2D();
        const base = 0.06 + kick * 0.06, rTop = rMax * (L ? 0.62 : 0.88) - rMin;
        for (let j = -N; j <= N; j++) {
          for (let i = -N; i <= N; i++) {
            const u = i * grid, v = j * grid;
            const sx = W / 2 + u * ca - v * sa, sy = H / 2 + u * sa + v * ca;
            if (sx < -grid || sx > W + grid || sy < -grid || sy > H + grid) continue;
            let f = base, top = 0, sum = 0, st = 0;
            for (const h of hs) st += h.a * (0.5 + 0.5 * Math.cos(h.kx * sx + h.ky * sy + h.ph));
            f += Math.min(0.26, stand * 0.3 * st);  // held harmony stays a mid-tone: only attacks print solid
            // Waves overlap mostly as a max (crisp separate rings), with only a little interference on top.
            for (const w of ws) {
              const dx = sx - w.x, dy = sy - w.y, d2 = dx * dx + dy * dy;
              let e = 0;
              if (w.src > 0.02 && d2 * w.sw2 < 9) e = w.src * Math.exp(-d2 * w.sw2);
              if (d2 < w.out2 && d2 > w.in2) e += w.a * ring((Math.sqrt(d2) - w.R) / w.w);
              if (e > top) top = e; sum += e;
            }
            f += top + 0.3 * (sum - top);
            let t = tone(Math.min(1.3, f)); if (L === 0 && neg > 0.02) t += (1 - 2 * t) * neg;
            const r = rMin + rTop * Math.max(0, t);
            if (r < 0.5) continue;
            const b = t < 0.3 ? 0 : t < 0.7 ? 1 : 2, P = B[b];
            if (shape === 0) { P.moveTo(u + r, v); P.arc(u, v, r, 0, TAU); }
            else if (shape === 1) P.rect(u - r * 0.88, v - r * 0.88, r * 1.76, r * 1.76);
            else if (shape === 2) { const q = Math.max(0.6, r * 0.3); P.rect(u - r, v - q, 2 * r, 2 * q); P.rect(u - q, v - r, 2 * q, 2 * r); }
            else { const q = Math.max(0.5, r * 0.85); P.rect(u - grid * 0.5, v - q, grid, 2 * q); }
          }
        }
        g.save(); g.translate(W / 2, H / 2); g.rotate(ang);
        g.globalCompositeOperation = L ? 'screen' : 'source-over';
        const hue = hues[L];
        const tones = L ? [[50, 28, 0.8], [72, 55, 0.92], [85, 80, 1]] : [[60, 14, 0.8], [78, 26, 0.95], [84, 38, 1]];
        for (let b = 0; b < 3; b++) { const [s, l, a] = tones[b]; g.fillStyle = hsl(hue, s, l, a); g.fill(B[b]); }
        g.restore();
      }
    },
  });
})();
