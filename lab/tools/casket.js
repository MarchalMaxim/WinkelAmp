// The casket from round 1 (melt + drips + chord cuts); being built into the app now. It had no knobs: the five below
// (the 2026-10-31 style) all start at its old fixed numbers, so at the defaults it looks and moves exactly as before.
(() => {
  const snap = document.createElement('canvas'); snap.width = 1280; snap.height = 720; const sg = snap.getContext('2d');
  let drips = [], scars = [], shake = 0, time = 0;
  const SCAR = '#ebf0aa', RED = '#a0141a', OLIVE = '#969628';
  function cut(x, vel) {
    const g = x.g; sg.drawImage(x.canvas, 0, 0);
    const ang = x.rnd(-1.2, 1.2) + (Math.random() < 0.5 ? 0 : Math.PI / 2), cx = x.rnd(x.W * 0.25, x.W * 0.75), cy = x.rnd(x.H * 0.25, x.H * 0.75);
    const dx = Math.cos(ang), dy = Math.sin(ang), d = (14 + (vel - 90) * 2.2) * x.p('gap');
    for (const side of [1, -1]) {
      g.save(); g.beginPath(); const nx = -dy * side, ny = dx * side;
      g.moveTo(cx - dx * 3000, cy - dy * 3000); g.lineTo(cx + dx * 3000, cy + dy * 3000);
      g.lineTo(cx + dx * 3000 + nx * 3000, cy + dy * 3000 + ny * 3000); g.lineTo(cx - dx * 3000 + nx * 3000, cy - dy * 3000 + ny * 3000);
      g.closePath(); g.clip(); g.drawImage(snap, dx * d * side, dy * d * side); g.restore();
    }
    scars.push({ cx, cy, dx, dy, age: 0 }); shake = 14 * x.p('shake');
  }
  // Knob pictures.
  const meltIcon = (g, v, w, h) => {      // a striped block cut into columns, each sliding down by its own amount
    for (let i = 0; i < 6; i++) {
      const dy = v * 9 * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + 0.4)));
      for (let k = 0; k < 3; k++) ICON.rect(g, 8 + i * 4, 3 + k * 5 + dy, 4, 3, k === 1 ? ICON.gold : RED);
    }
  };
  const dripIcon = (g, v, w, h) => {      // drips running down from the top edge: none … one per note
    ICON.line(g, 2, 2, w - 2, 2, ICON.dim, 1);
    const R = ICON.rng(9), n = Math.round(v * 7);
    for (let i = 0; i < 7; i++) {
      const x = 4 + i * 5.3, len = 6 + R() * 12, wd = 1.6 + R() * 2.2, red = R() < 0.7;
      if (i >= n) continue;
      const col = red ? RED : OLIVE; ICON.rect(g, x - wd / 2, 2, wd, len, col); ICON.dot(g, x, 2 + len, wd / 2 + 0.3, col);
    }
  };
  const slashIcon = (g, v, w, h) => {     // left: many chords cut (many slashes); right: only the loudest (one)
    const n = Math.round(1 + (1 - v) * 4), R = ICON.rng(3);
    for (let i = 0; i < n; i++) {
      const cx = n === 1 ? w / 2 : 6 + (i / (n - 1)) * (w - 12) + (R() - 0.5) * 3, a = -1.1 + (R() - 0.5) * 0.5;
      ICON.line(g, cx - Math.cos(a) * 13, h / 2 - Math.sin(a) * 13, cx + Math.cos(a) * 13, h / 2 + Math.sin(a) * 13, SCAR, 1.4);
    }
  };
  const gapIcon = (g, v, w, h) => {       // a striped square cut on the diagonal; the two halves slide along the cut
    const s = 20, cx = w / 2, cy = h / 2, a = -0.35, dx = Math.cos(a), dy = Math.sin(a), d = v * 7;
    for (const side of [1, -1]) {
      g.save(); g.beginPath(); const nx = -dy * side, ny = dx * side;
      g.moveTo(cx - dx * 40, cy - dy * 40); g.lineTo(cx + dx * 40, cy + dy * 40); g.lineTo(cx + dx * 40 + nx * 40, cy + dy * 40 + ny * 40); g.lineTo(cx - dx * 40 + nx * 40, cy - dy * 40 + ny * 40);
      g.closePath(); g.clip(); g.translate(dx * d * side, dy * d * side);
      for (let k = 0; k < 5; k++) ICON.rect(g, cx - s / 2 + k * 4.2, cy - s / 2, 2.6, s, k % 2 ? ICON.gold : RED);   // upright stripes, so the shear shows
      g.restore();
    }
    ICON.line(g, cx - dx * 13, cy - dy * 13, cx + dx * 13, cy + dy * 13, SCAR, 1);
  };
  TOOLS.push({
    id: 'casket', name: 'The casket', tag: 'building into the app',
    blurb: 'The picture melts, paint drips from the top, and big chords slash cuts through everything. Mix it with other tools to see what it cuts. Its five knobs start at the settings you loved.',
    params: [
      { key: 'melt', label: 'melt', min: 0, max: 6, value: 2.2,
        hint: 'How fast the whole picture slides down and melts. Left: it holds still. Right: it runs down fast.',
        icon: meltIcon },
      { key: 'drips', label: 'drips', min: 0, max: 1, value: 0.5,
        hint: 'How many notes start a drip of paint from the top. Left: no drips. Right: every note drips.',
        icon: dripIcon },
      { key: 'cutAt', label: 'which chords slash', min: 80, max: 118, step: 1, value: 92,
        hint: 'How loud a chord of three or more notes must be to slash a cut. Left: almost every full chord cuts. Right: only the very loudest.',
        icon: slashIcon },
      { key: 'gap', label: 'how far a cut slides', min: 0, max: 3, value: 1,
        hint: 'How far the two sides of a cut slide past each other. Left: a hairline. Right: a wide shear.',
        icon: gapIcon },
      { key: 'shake', label: 'jolt on a cut', min: 0, max: 2, value: 1,
        hint: 'How hard the picture jolts when a cut lands. Left: still. Right: a violent jolt.',
        icon: (g, v, w, h) => ICON.shake(g, v * 4, () => ICON.square(g, w / 2, h / 2, h - 10, RED)) },
    ],
    reset() { drips = []; scars = []; shake = 0; },
    onChord(ch, x) {
      const pd = x.p('drips');
      for (const n of ch.notes) if (Math.random() < pd) drips.push({ x: x.rnd(0, x.W), y: -10, w: x.rnd(6, 26) * n.v / 100, v: x.rnd(80, 260), red: Math.random() < 0.7 });
      if (ch.vel >= x.p('cutAt') && ch.notes.length >= 3) cut(x, ch.vel);
    },
    frame(x) {
      const g = x.g; time += x.dt;
      const melt = x.p('melt');
      sg.drawImage(x.canvas, 0, 0);
      for (let i = 0; i < x.W; i += 10) {
        const sp = (1 + Math.sin(i * 0.037 + time * 0.7) * 0.5 + Math.sin(i * 0.11) * 0.5) * melt * x.dt * 60;
        g.drawImage(snap, i, 0, 10, x.H, i, sp, 10, x.H);
      }
      if (shake > 0.3) { g.translate(x.rnd(-shake, shake), x.rnd(-shake, shake)); shake *= Math.pow(0.86, x.dt * 60); }   // per song-second, so it decays the same on any screen
      for (const d of drips) {
        d.y += d.v * x.dt; d.v *= 1 + 0.6 * x.dt;
        g.fillStyle = d.red ? 'rgba(120,8,10,0.85)' : 'rgba(150,160,40,0.7)';
        g.fillRect(d.x - d.w / 2, d.y - 40, d.w, 40); g.beginPath(); g.arc(d.x, d.y, d.w / 2, 0, Math.PI * 2); g.fill();
      }
      drips = drips.filter((d) => d.y < x.H + 60);
      for (const s of scars) {
        s.age += x.dt; const al = Math.max(0, 1 - s.age / 0.9);
        g.strokeStyle = `rgba(235,240,170,${al})`; g.lineWidth = 1 + 5 * al;
        g.beginPath(); g.moveTo(s.cx - s.dx * 3000, s.cy - s.dy * 3000); g.lineTo(s.cx + s.dx * 3000, s.cy + s.dy * 3000); g.stroke();
      }
      scars = scars.filter((s) => s.age < 0.9);
    },
  });
})();
