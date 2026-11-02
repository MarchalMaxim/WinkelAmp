// Tunnel (round 4, new): a zoom-feedback space you fall through.
// Each frame the whole canvas is redrawn a little larger (and turned) about a vanishing point, so everything already
// on screen streams outward toward you. Attacks drop nested outlines at the mouth; their echoes become the walls.
// A sixth knob, how present (the user, 2026-11-01: the sliders only boost): turned down, outlines and walls fade, the fall
// slows and barely turns or wanders, and only the hardest notes of the song throw an outline.
(() => {
  // snap: the shared canvas at its real size (×S in a supersampled render), drawn back over 1280×720 units
  let snap = null, sg = null;
  let objs = [], vp = { x: 640, y: 360 }, surge = 0, spin = 0, time = 0, kick = 0, mel = 0.5;
  const TAU = Math.PI * 2;
  // Palettes: [low-note hue, high-note hue, sat low, sat high, light low, light high].
  const PAL = [
    [352, 34, 82, 55, 26, 70],   // ember: blood red low, pale bone-gold high
    [232, 190, 75, 35, 30, 84],  // ice: deep blue low, white-cyan high
    [285, 160, 60, 55, 32, 62],  // bruise: violet low, teal high
    [0, 40, 0, 10, 40, 92],      // bone: grey low, warm white high
  ];
  function col(p, palette, light, a) {
    const P = PAL[Math.max(0, Math.min(3, Math.round(palette)))];
    let dh = P[1] - P[0]; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
    const h = (P[0] + dh * p + 360) % 360, s = P[2] + (P[3] - P[2]) * p, l = (P[4] + (P[5] - P[4]) * p) * light;
    return `hsla(${h.toFixed(0)},${s.toFixed(0)}%,${Math.min(92, l).toFixed(0)}%,${a.toFixed(3)})`;
  }
  // 0 rings, 1 squares, 2 triangles, 3 slits (a pair of bars), 4 by pitch (low squares, mid rings, high triangles).
  function path(g, kind, r, rot) {
    g.beginPath();
    if (kind === 0) { g.arc(0, 0, r, 0, TAU); return; }
    if (kind === 3) { const a = Math.cos(rot), b = Math.sin(rot); for (const s of [1, -1]) { g.moveTo(-a * r * 1.7 - b * r * s, -b * r * 1.7 + a * r * s); g.lineTo(a * r * 1.7 - b * r * s, b * r * 1.7 + a * r * s); } return; }
    const n = kind === 1 ? 4 : 3;
    for (let i = 0; i <= n; i++) { const t = rot + (i / n) * TAU - Math.PI / 2; i ? g.lineTo(Math.cos(t) * r, Math.sin(t) * r) : g.moveTo(Math.cos(t) * r, Math.sin(t) * r); }
    g.closePath();
  }
  const kindOf = (shape, p) => (shape < 3.5 ? Math.round(shape) : p < 0.36 ? 1 : p < 0.62 ? 0 : 2);
  // Mouth size of a note: low and loud notes land as the big outer outlines, high ones nest small inside.
  const size0 = (p, v, mouth) => mouth * (8 + 70 * Math.pow(1 - p, 1.6)) * (0.55 + 0.6 * v / 110);
  // The knobs that were dropped: fixed, or following the music the way their old default drives did (base + 0.5 * range * feature).
  const CURVE = 2.2, SURGE = 1.3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // how present (0..1). 1 leaves every multiplier at exactly 1. Which notes throw an outline is judged against this piece's
  // own notes (recordings differ a lot in how hard they play): every one at 1, the hardest two thirds at 0.5, the hardest 5%
  // at 0. The list is only built once the knob is down.
  const inkOf = (pres) => 1 - 0.9 * (1 - Math.pow(pres, 1.5));   // how strongly everything drawn shows
  const calmOf = (pres) => 1 - 0.8 * (1 - pres);                 // the fall, the turning and the wander
  const wallOf = (pres) => 1 - 0.75 * (1 - pres);                // how long the walls linger
  let allVels = null;
  const hardNote = (v, pres) => {
    const cut = Math.pow(1 - pres, 1.5) * 0.95;
    if (cut <= 0) return true;
    if (!allVels) allVels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!allVels.length) return true;
    let a = 0, b = allVels.length; while (a < b) { const k = (a + b) >> 1; if (allVels[k] < v) a = k + 1; else b = k; }
    return a / allVels.length >= cut;
  };
  const fold = (x) => ({
    drift: clamp(0.45 + 0.5 * x.feat.rate, 0, 1),                      // busier playing: the vanishing point wanders further
    mouth: clamp(1 + 0.5 * 2.7 * x.feat.level, 0.3, 3),                // louder: bigger outlines
    echoes: Math.round(clamp(3 - 0.5 * 6 * x.feat.density, 0, 6)),     // fuller chords: fewer echoes per note
  });

  TOOLS.push({
    id: 'tunnel', name: 'Tunnel', tag: 'new',
    blurb: 'You fall through a zoom-feedback tunnel: every note drops an outline at the far mouth (low notes big and outside, high ones nested inside) and the picture streams toward you. Busier playing speeds the fall on a steep curve, the melody steers the vanishing point, and big chords punch a surge forward. Turn <b>how present</b> down to keep it small: the fall stops and the outlines stay in a knot at the mouth, until a big chord pushes them out.',
    // Five knobs (lab/README.md) and how present; all five keep their old keys, ranges and defaults. The dropped ones are fixed now
    // (acceleration curve 2.2, surge 1.3) or follow the music on their own (drift, mouth size, echoes: see fold()).
    params: [
      { key: 'speed', label: 'how fast you fall', min: 0, max: 2, value: 0.8, less: 0,
        hint: 'How fast the tunnel streams toward you (busier playing always speeds it up). Left: a slow glide. Right: a rush.',
        icon: (g, v, w, h) => { const c = col(0.3, 0, 1, 1);
          for (let i = 0; i < 4; i++) ICON.ring(g, w / 2, h / 2, 1.5 + i * (1.2 + 2.6 * v), c, 1.2);
          if (v > 0.2) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ICON.line(g, w / 2 + dx * 9, h / 2 + dy * 7, w / 2 + dx * (9 + 9 * v), h / 2 + dy * (7 + 5 * v), ICON.ink, 1); } },
      { key: 'shape', label: 'which outlines', min: 0, max: 4, step: 1, value: 4,
        hint: 'The shape of the outlines. Left to right: rings, squares, triangles, slits, or mixed by pitch (low squares, middle rings, high triangles).',
        icon: (g, v, w, h) => { const sh = Math.round(v * 4);
          g.save(); g.translate(w / 2, h / 2);
          [11, 7, 3.5].forEach((r, i) => { g.strokeStyle = col(0.2 + 0.35 * i, 0, 1, 1); g.lineWidth = 1.3; path(g, kindOf(sh, [0.2, 0.5, 0.8][i]), r, 0); g.stroke(); });
          g.restore(); } },
      { key: 'trail', label: 'how long the walls linger', min: 0.05, max: 1.5, value: 0.35, less: 0.05, drive: '-density',
        hint: 'How long the streaks of earlier outlines stay on the walls. Left: crisp, single outlines. Right: long glowing walls.',
        icon: (g, v, w, h) => { const k = 0.08 + 0.85 * v;
          for (let i = 0; i < 7; i++) { const a = Math.pow(k, i); if (a < 0.04) break; ICON.alpha(g, a, () => ICON.ring(g, w / 2, h / 2, 11.5 - i * 1.5, col(0.3, 0, 1, 1), 1.3)); } } },
      { key: 'spin', label: 'turning', min: -1, max: 1, value: 0.1, drive: '+bass',
        hint: 'How the tunnel turns as you fall. Left: turning one way. Middle: straight. Right: turning the other way.',
        icon: (g, v, w, h) => { const s = (v - 0.5) * 2, c = col(0.3, 0, 1, 1);
          g.save(); g.translate(w / 2, h / 2);
          for (let i = 2; i >= 0; i--) ICON.alpha(g, i ? 0.3 * Math.abs(s) : 1, () => { g.strokeStyle = c; g.lineWidth = 1.3; path(g, 1, 8, Math.PI / 4 - s * i * 0.28); g.stroke(); });
          if (Math.abs(s) > 0.15) { const a0 = -Math.PI / 2, a1 = a0 + s * 1.6; g.strokeStyle = ICON.ink; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 12, Math.min(a0, a1), Math.max(a0, a1)); g.stroke();
            ICON.dot(g, Math.cos(a1) * 12, Math.sin(a1) * 12, 2, ICON.ink); }
          g.restore(); } },
      { key: 'palette', label: 'colours', min: 0, max: 3, step: 1, value: 0,
        hint: 'The colours, from low notes to high ones. Left to right: ember (blood red to gold), ice (deep blue to white), bruise (violet to teal), bone (grey to warm white).',
        icon: (g, v, w, h) => ICON.palette(g, [0, 0.33, 0.66, 1].map((p) => col(p, Math.round(v * 3), 1, 1)), w, h) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How far the tunnel reaches: how fast you fall and how long the walls linger. Left: the outlines stay in a small knot at the mouth, and only a big chord pushes them out. Right: the whole tunnel streaming past you, with glowing walls. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset(x) { objs = []; surge = 0; spin = 0; kick = 0; vp = { x: x.W / 2, y: x.H / 2 }; allVels = null; },
    onChord(ch, x) {
      mel = x.pitch01(ch.hi); // the melody (top note) steers where the tunnel bends
      const F = fold(x), shape = x.p('shape'), n = ch.notes.length, pres = x.p('presence');
      // Sparse, quiet music (a lone motif, the chorale) drops bigger outlines, so the tunnel never shrinks to a dot.
      const mouth = F.mouth * (1 + 1.1 * Math.max(0, 1 - x.feat.rate / 0.4) * (1 - x.feat.level)); // (loud already means big)
      const punch = Math.max(0, (ch.vel - 78) / 30) * Math.min(1, Math.sqrt(n / 3));
      const big = punch > 0.35;
      // how present: soft notes are still heard (the melody above) but do nothing visible; a chord with no hard note can't surge.
      const notes = [...ch.notes].sort((a, b) => a.m - b.m).slice(-9).filter((nt) => hardNote(nt.v, pres));
      if (big && notes.length) { surge = Math.max(surge, punch * SURGE); kick = Math.min(1, punch); }
      // Echoes: each note also drops fainter copies deeper in (smaller), so even a lone note makes a short corridor.
      const ech = Math.min(F.echoes, Math.floor(36 / notes.length));
      notes.forEach((nt) => {
        const p = x.pitch01(nt.m), r0 = size0(p, nt.v, mouth);
        for (let i = 0; i <= ech; i++) {
          const r = r0 / Math.pow(1.45, i); if (r < 2.5) break;
          objs.push({ r, p, v: nt.v, d: nt.d, age: 0, kind: kindOf(shape, p), rot: spin - i * 0.05, dim: Math.pow(0.62, i),
            x: vp.x, y: vp.y, big: big && i === 0, pal: x.p('palette') });
        }
      });
      if (objs.length > 220) objs.splice(0, objs.length - 220);
    },
    frame(x) {
      const g = x.g, dt = x.dt, f = x.feat; time += dt;
      // Fall speed: a floor, plus the attack rate on a non-linear curve, plus the decaying surge from big chords.
      surge *= Math.exp(-dt / 0.4); kick *= Math.exp(-dt / 0.15);
      const pres = x.p('presence'), ink = inkOf(pres), calm = calmOf(pres);
      const zv = (x.p('speed') * (0.42 + 2.2 * Math.pow(f.rate, CURVE) + 0.3 * f.level) + surge * 1.8) * calm;
      const sc = Math.exp(zv * dt);
      const dRot = (x.p('spin') + surge * 0.3 * Math.sign(x.p('spin') || 1)) * dt * calm; spin += dRot;
      // The vanishing point follows the melody (x) and the bass (y), with a slow wander.
      const F = fold(x), dr = F.drift * calm;
      const tx = x.W / 2 + dr * x.W * 0.34 * ((mel - 0.5) * 1.6 + 0.35 * Math.sin(time * 0.21));
      const ty = x.H / 2 + dr * x.H * 0.32 * (Math.sin(time * 0.29 + 1.3) * 0.7 + (0.4 - f.bass) * 0.8);
      const ke = 1 - Math.exp(-dt * 1.6); vp.x += (tx - vp.x) * ke; vp.y += (ty - vp.y) * ke;

      // Feedback: the (already faded) canvas, scaled and turned about the vanishing point.
      // The shared fade takes 12% a frame; a 'lighter' second pass gives back up to that, so 'wall memory' is the real decay.
      if (!snap || snap.width !== x.canvas.width || snap.height !== x.canvas.height) {
        snap = document.createElement('canvas'); snap.width = x.canvas.width; snap.height = x.canvas.height; sg = snap.getContext('2d');
      }
      sg.globalCompositeOperation = 'copy'; sg.drawImage(x.canvas, 0, 0);
      const b = Math.pow(0.5, dt / (x.p('trail') * wallOf(pres))) / 0.88;
      g.fillStyle = '#000'; g.fillRect(0, 0, x.W, x.H);
      g.save();
      g.translate(vp.x, vp.y); g.rotate(dRot); g.scale(sc, sc); g.translate(-vp.x, -vp.y);
      g.globalAlpha = Math.min(1, b); g.drawImage(snap, 0, 0, x.W, x.H);
      if (b > 1) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = b - 1; g.drawImage(snap, 0, 0, x.W, x.H); }
      g.restore();
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

      // Held notes keep tracing faint outlines at the mouth: the feedback stretches them into soft walls.
      const shape = x.p('shape'), pal = x.p('palette'), mouth = F.mouth;
      g.save(); g.translate(vp.x, vp.y);
      for (const nt of x.sounding().slice(-6)) {
        const p = x.pitch01(nt.m), a = 0.16 * (nt.v / 127) * Math.exp(-(x.t - nt.start) / 2) * ink;
        if (a < 0.01) continue;
        g.strokeStyle = col(p, pal, 0.8, a); g.lineWidth = 1;
        path(g, kindOf(shape, p), size0(p, nt.v, mouth) * 0.7, spin); g.stroke();
      }
      g.restore();

      // Attack outlines: crisp heads flying out with the zoom (parallax > 1 = a little faster, so they streak).
      const grow = Math.exp(zv * 1.15 * dt);
      for (const o of objs) {
        o.age += dt; o.r *= grow;
        // Far (small) outlines stay tied to the moving vanishing point; near ones keep the line they flew on.
        const tie = 1 - Math.exp(-dt * 5 / Math.max(1, o.r / 40)); o.x += (vp.x - o.x) * tie; o.y += (vp.y - o.y) * tie;
        o.rot += dRot;
        const flash = Math.exp(-o.age / 0.09), hold = Math.exp(-Math.max(0, o.age - o.d) / 0.6);
        const fog = Math.min(1, Math.pow(o.r / 70, 0.6)); // far = dim, near = full
        const a = fog * (0.2 + 0.8 * Math.min(1, o.v / 105)) * (0.35 + 0.65 * hold) * Math.exp(-o.age / 3) * o.dim * ink;
        if (a < 0.02) continue;
        g.save(); g.translate(o.x, o.y);
        const lw = (o.big ? 2.2 : 1.3) * (o.v / 95) * Math.pow(Math.max(1, o.r / 30), 0.55);
        if (o.big && o.age < 0.25) { g.fillStyle = col(o.p, o.pal, 0.5, 0.3 * (1 - o.age / 0.25) * ink); path(g, o.kind, o.r, o.rot); if (o.kind !== 3) g.fill(); }
        g.strokeStyle = col(o.p, o.pal, (0.7 + 0.3 * fog) * (1 + flash * 0.25), Math.min(1, a + flash * 0.3 * o.dim * ink)); g.lineWidth = lw;
        path(g, o.kind, o.r, o.rot); g.stroke();
        g.restore();
      }
      objs = objs.filter((o) => o.r < 1500 && o.age < 10);

      // A surge flashes the mouth: a brief pale core at the vanishing point.
      if (kick > 0.05) {
        const rg = g.createRadialGradient(vp.x, vp.y, 0, vp.x, vp.y, 90 + 160 * kick);
        rg.addColorStop(0, col(0.85, pal, 1, 0.35 * kick * ink)); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalCompositeOperation = 'screen'; g.fillStyle = rg; g.fillRect(vp.x - 260, vp.y - 260, 520, 520); g.globalCompositeOperation = 'source-over';
      }
    },
  });
})();
