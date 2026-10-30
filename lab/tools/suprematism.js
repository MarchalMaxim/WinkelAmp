// Suprematism (after Malevich): flat planes and bars composed at angles on a dark field.
// Bass notes slam heavy black bars in low, high notes thin slivers high, the middle red/ochre/cream blocks,
// long-held notes become discs. Big chords flip planes 90 degrees. Tension (loudness + density) tilts the
// whole composition and drags the planes together into a pile-up; calm lets them drift apart and level.
(() => {
  let planes = [], tension = 0, gAng = 0, gVel = 0, kick = 1, time = 0;
  // Palettes for the four Suprematist inks, cold / classic / hot; the colour slider blends between them.
  const PAL = {
    black: [[5, 7, 11], [8, 7, 6], [9, 2, 2]],
    red: [[34, 66, 150], [196, 38, 26], [232, 70, 22]],
    ochre: [[108, 122, 134], [214, 156, 44], [244, 182, 34]],
    cream: [[214, 226, 232], [234, 222, 196], [255, 222, 168]],
    field: [[22, 26, 34], [30, 26, 21], [40, 19, 14]],
  };
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  function ink(key, temp, flash = 0) {
    const p = PAL[key], c = temp < 0.5 ? mix(p[0], p[1], temp * 2) : mix(p[1], p[2], (temp - 0.5) * 2);
    const f = c.map((v) => Math.round(v + (250 - v) * flash));
    return `rgb(${f[0]},${f[1]},${f[2]})`;
  }
  const easeBack = (u) => { const s = 2.2; u = Math.min(1, u) - 1; return 1 + u * u * ((s + 1) * u + s); };

  function add(x, n, kind, ch) {
    const r = x.pitch01(n.m), vk = 0.6 + 0.5 * n.v / 127;
    const reg = 1 + x.p('register') * (0.5 - r) * 1.7;
    let w, h, key, hy;
    if (kind === 'bar') { w = x.rnd(230, 430); h = x.rnd(40, 78); key = n.v > 108 && Math.random() < 0.35 ? 'red' : 'black'; hy = x.rnd(0.66, 0.86); }
    else if (kind === 'sliver') { w = x.rnd(180, 420); h = x.rnd(2, 5); key = Math.random() < 0.7 ? 'cream' : 'ochre'; hy = x.rnd(0.1, 0.32); }
    else if (kind === 'disc') { w = h = x.rnd(60, 140); key = Math.random() < 0.6 ? 'red' : 'black'; hy = x.rnd(0.3, 0.6); }
    else {
      const sq = Math.random() < 0.3; w = x.rnd(70, 200); h = sq ? w : w * x.rnd(0.18, 0.5);
      key = ['red', 'red', 'ochre', 'cream', 'black'][Math.floor(Math.random() * 5)]; hy = 0.22 + (1 - r) * 0.5 + x.rnd(-0.08, 0.08);
    }
    w *= reg * vk; if (kind !== 'sliver') h *= reg * vk;
    const hx = x.rnd(0.12, 0.88) * x.W, hY = hy * x.H;
    // Each plane rests on the grid: parallel or perpendicular to the composition, plus its own lean.
    const quarter = Math.random() < (kind === 'bar' ? 0.92 : 0.7) ? 0 : 1, lean = x.rnd(-1, 1);
    const from = kick; kick = -kick;
    planes.push({ kind, key, w, h, x: hx, y: hY, vx: 0, vy: 0, hx, hy: hY, quarter, lean,
      a: quarter * Math.PI / 2 + lean * 0.4 + from * 0.5, av: 0, born: 0, health: 1, dying: false, ph: x.rnd(0, 100), flash: 1 });
  }

  TOOLS.push({
    id: 'suprematism', name: 'Suprematism', tag: 'new',
    blurb: 'Malevich-style flat planes on a dark field: bass slams heavy black bars in low, high notes add thin slivers high, chords add red, ochre and cream blocks, and big chords flip planes on their side. Loud, dense passages tilt the whole composition and pile the planes into each other; quiet ones let them drift apart and level out.',
    params: [
      { key: 'count', label: 'plane count', min: 4, max: 60, step: 1, value: 22 },
      { key: 'spread', label: 'angle spread', min: 0, max: 1, value: 0.25, drive: '+level' },
      { key: 'temp', label: 'cold / hot', min: 0, max: 1, value: 0.5 },
      { key: 'drift', label: 'drift', min: 0, max: 2, value: 0.6 },
      { key: 'tilt', label: 'tilt response', min: 0, max: 1.4, value: 0.55 },
      { key: 'pull', label: 'collision pull', min: 0, max: 1.8, value: 0.7, drive: '+density' },
      { key: 'register', label: 'size by register', min: 0, max: 1, value: 0.7 },
      { key: 'size', label: 'size', min: 0.4, max: 1.6, value: 0.85, drive: '+bass' },
      { key: 'life', label: 'plane life (s)', min: 1, max: 20, value: 9, drive: '-rate' },
      { key: 'flip', label: 'flip on big chords', min: 0, max: 1, value: 0.35, drive: '+level' },
    ],
    reset() { planes = []; tension = 0; gAng = 0; gVel = 0; time = 0; },
    onChord(ch, x) {
      // One plane per register band per attack, so a ten-note chord adds a few planes, not ten.
      const lo = ch.notes.reduce((a, n) => (n.m < a.m ? n : a)), hi = ch.notes.reduce((a, n) => (n.m > a.m ? n : a));
      if (lo.m < 48) add(x, lo, 'bar', ch);
      if (hi.m > 76) add(x, hi, 'sliver', ch);
      const mids = ch.notes.filter((n) => n.m >= 48 && n.m <= 76);
      if (mids.length) { const n = mids[Math.floor(Math.random() * mids.length)]; add(x, n, n.d > 1.2 && Math.random() < 0.6 ? 'disc' : 'block', ch); }
      // The attack jolts the whole composition.
      gVel += (Math.random() < 0.5 ? -1 : 1) * (ch.vel / 127) * (0.6 + ch.notes.length * 0.12) * x.p('tilt');
      // Big chords turn planes on their side.
      if (ch.vel >= 88 || ch.notes.length >= 4) {
        const k = x.p('flip'), alive = planes.filter((q) => !q.dying);
        for (const q of alive) if (Math.random() < k) { q.quarter += Math.random() < 0.5 ? 1 : -1; q.flash = Math.max(q.flash, 0.6); if (Math.random() < 0.25) q.key = q.key === 'black' ? 'red' : q.key === 'red' ? 'black' : q.key; }
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt, f = x.feat, W = x.W, H = x.H;
      time += dt;
      const temp = x.p('temp'), spread = x.p('spread'), drift = x.p('drift'), tilt = x.p('tilt'), pull = x.p('pull'), size = x.p('size'), life = x.p('life');
      // Tension: loudness and density, smoothed.
      const tt = Math.min(1, f.level * 0.65 + f.density * 0.45 + f.rate * 0.25);
      tension += (tt - tension) * (1 - Math.exp(-dt / 0.35));
      // Group angle: a spring toward a tension-driven lean, kicked by every attack.
      const gTarget = -0.04 - tilt * 0.38 * tension;
      for (let s = 0, n = Math.ceil(dt / 0.008); s < n; s++) { const h = dt / n; gVel += ((gTarget - gAng) * 140 - gVel * 9) * h; gAng += gVel * h; }

      // Field.
      const fc = ink('field', temp);
      g.globalAlpha = 0.8; g.fillStyle = fc; g.fillRect(0, 0, W, H); g.globalAlpha = 1;

      // Too many planes: the oldest start to leave.
      const cap = Math.round(x.p('count')); let alive = 0;
      for (let i = planes.length - 1; i >= 0; i--) if (!planes[i].dying && ++alive > cap) planes[i].dying = true;

      const cx = W / 2, cy = H * 0.52;
      const squeeze = Math.max(-0.6, 1 - pull * tension * 1.1) * (1 + 0.15 * (1 - tension) * drift);
      for (const q of planes) {
        q.born += dt; q.flash *= Math.exp(-dt / 0.06);
        q.health -= dt / (q.dying ? 0.35 : life);
        // Where it wants to be: its home, squeezed toward the centre by tension, wandering by drift.
        const wx = Math.sin(time * 0.31 + q.ph) * 70 * drift, wy = Math.cos(time * 0.23 + q.ph * 1.7) * 40 * drift;
        const tx = cx + (q.hx - cx) * squeeze + wx, ty = cy + (q.hy - cy) * squeeze + wy;
        const k = 5 + 10 * tension * pull, c = 3.2;
        q.vx += ((tx - q.x) * k - q.vx * c) * dt; q.vy += ((ty - q.y) * k - q.vy * c) * dt;
        // Calm keeps them apart; under tension they are allowed to crash into each other.
        q.x += q.vx * dt; q.y += q.vy * dt;
        // Angle: snap to the grid, plus a lean that tension and spread exaggerate.
        const aT = q.quarter * Math.PI / 2 + q.lean * spread * (0.25 + 0.9 * tension) + Math.sin(time * 0.4 + q.ph) * 0.05 * drift;
        for (let s = 0, n = Math.ceil(dt / 0.008); s < n; s++) { const h = dt / n; q.av += ((aT - q.a) * 320 - q.av * 20) * h; q.a += q.av * h; }
      }
      // Soft separation when calm.
      const sep = (1 - tension) * 0.9;
      if (sep > 0.05) for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) {
        const A = planes[i], B = planes[j], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
        const want = (Math.min(A.w, A.h) + Math.min(B.w, B.h)) * 0.5 + 40;
        if (d < want) { const push = (want - d) * sep * 2 * dt / d; A.vx -= dx * push; A.vy -= dy * push; B.vx += dx * push; B.vy += dy * push; }
      }

      g.save();
      g.translate(cx, cy); g.rotate(gAng); g.scale(size * (1 + 0.04 * tension), size * (1 + 0.04 * tension)); g.translate(-cx, -cy);
      // Heaviest first, slivers on top.
      const order = { bar: 0, disc: 1, block: 2, sliver: 3 };
      const sorted = planes.slice().sort((a, b) => order[a.kind] - order[b.kind] || b.born - a.born);
      for (const q of sorted) {
        const grow = easeBack(q.born / 0.11), out = Math.min(1, Math.max(0, q.health) / 0.22);
        const len = q.w * grow * out, th = q.h * (q.kind === 'disc' ? grow * out : Math.min(1, q.born / 0.05) * (0.4 + 0.6 * out));
        if (len < 0.5 || th < 0.3) continue;
        g.save(); g.translate(q.x, q.y); g.rotate(q.a);
        g.fillStyle = ink(q.key, temp, q.flash * 0.55);
        if (q.kind === 'disc') { g.beginPath(); g.arc(0, 0, len / 2, 0, Math.PI * 2); g.fill(); }
        else g.fillRect(-len / 2, -th / 2, len, th);
        // Black on a dark field needs a lip to read: a hairline of warm light along its top edge.
        if (q.key === 'black' && q.kind !== 'disc') { g.fillStyle = ink('cream', temp); g.globalAlpha = 0.16 + 0.5 * q.flash; g.fillRect(-len / 2, -th / 2, len, 1.5); g.globalAlpha = 1; }
        g.restore();
      }
      g.restore();
      planes = planes.filter((q) => q.health > 0);
    },
  });
})();
