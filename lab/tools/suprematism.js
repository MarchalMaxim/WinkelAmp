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
    const reg = 1 + 0.7 * (0.5 - r) * 1.7; // low notes bigger, high notes smaller
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

  const tiltK = (x) => x.p('push') * 0.9; // 'push' at its default (0.6) gives the old tilt response (~0.55)

  TOOLS.push({
    id: 'suprematism', name: 'Suprematism', tag: 'new',
    blurb: 'Malevich-style flat planes on a dark field: bass slams heavy black bars in low, high notes add thin slivers high, chords add red, ochre and cream blocks, and big chords flip planes on their side. Loud, dense passages tilt the whole composition and pile the planes into each other; quiet ones let them drift apart and level out.',
    // Five knobs (the user's rule for this round). Folded into fixed choices: angle spread (still leans more when loud),
    // drift, size by register, and flips on big chords (more of them when loud). 'push' merges tilt and collision pull.
    params: [
      { key: 'count', label: 'how many planes', min: 4, max: 60, step: 1, value: 22,
        hint: 'How many planes can be on the field at once; the oldest leave first. Left: a sparse few. Right: a crowded field.',
        icon: (g, v, w, h) => { const R = ICON.rng(4), n = Math.round(2 + v * 16), cols = [ICON.red, ICON.ink, ICON.gold, '#8a8078'];
          for (let i = 0; i < n; i++) { const L = 5 + R() * 9; g.save(); g.translate(5 + R() * (w - 10), 4 + R() * (h - 8)); g.rotate((R() - 0.5) * 0.8); ICON.rect(g, -L / 2, -1.2, L, 2.4 + (i % 3 === 0 ? 2 : 0), cols[i % 4]); g.restore(); } } },
      { key: 'life', label: 'how long a plane stays', min: 1, max: 20, value: 9, drive: '-rate',
        hint: 'How long a plane stays before it shrinks away. Left: a second or two. Right: it holds for many bars.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.12 + v * 0.88, ICON.red, 'square') },
      { key: 'push', label: 'how hard loud music pushes', min: 0, max: 1.5, value: 0.6,
        hint: 'How much loud, full passages tilt the whole composition and crowd the planes together. Left: it stays calm and level. Right: a steep tilt and a pile-up.',
        icon: (g, v, w, h) => {
          const bars = [[-11, -6, 14, ICON.ink], [9, -4, 12, ICON.red], [-8, 6, 12, ICON.red], [10, 6, 16, ICON.gold]];
          g.save(); g.translate(w / 2, h / 2); g.rotate(-0.55 * v);
          for (const [bx, by, L, c] of bars) { g.save(); g.translate(bx * (1 - 0.6 * v), by * (1 - 0.45 * v)); g.rotate(v * 0.5 * Math.sign(bx * by)); ICON.rect(g, -L / 2, -1.6, L, 3.2, c); g.restore(); }
          g.restore();
        } },
      { key: 'temp', label: 'cold / hot colours', min: 0, max: 1, value: 0.5,
        hint: 'The four inks. Left: cold, blue and steel greys. Middle: classic red, ochre and cream. Right: hot orange and gold.',
        icon: (g, v, w, h) => { ICON.rect(g, 1, 1, w - 2, h - 2, ink('field', v)); ICON.rect(g, 4, 4, 20, 8, ink('red', v)); ICON.rect(g, 26, 5, 10, 16, ink('ochre', v)); ICON.rect(g, 6, 15, 17, 4, ink('cream', v)); ICON.rect(g, 4, 21, 30, 2.5, ink('black', v)); } },
      { key: 'size', label: 'size', min: 0.4, max: 1.6, value: 0.85, drive: '+bass',
        hint: 'How big the planes are. Left: small, with lots of empty field. Right: big slabs that fill the frame.',
        icon: (g, v, w, h) => { const L = 8 + v * 28, T = 2.5 + v * 7; g.save(); g.translate(w / 2, h / 2); g.rotate(-0.25); ICON.rect(g, -L / 2, -T / 2, L, T, ICON.red); g.restore(); } },
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
      gVel += (Math.random() < 0.5 ? -1 : 1) * (ch.vel / 127) * (0.6 + ch.notes.length * 0.12) * tiltK(x);
      // Big chords turn planes on their side.
      if (ch.vel >= 88 || ch.notes.length >= 4) {
        const k = 0.3 + 0.35 * x.feat.level, alive = planes.filter((q) => !q.dying);
        for (const q of alive) if (Math.random() < k) { q.quarter += Math.random() < 0.5 ? 1 : -1; q.flash = Math.max(q.flash, 0.6); if (Math.random() < 0.25) q.key = q.key === 'black' ? 'red' : q.key === 'red' ? 'black' : q.key; }
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt, f = x.feat, W = x.W, H = x.H;
      time += dt;
      const temp = x.p('temp'), spread = 0.25 + 0.4 * f.level, drift = 0.6, tilt = tiltK(x), pull = x.p('push') * 1.15, size = x.p('size'), life = x.p('life');
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
      // Under tension the planes crowd in, but never into one knot: dense passages used to squeeze them all to the centre.
      const squeeze = Math.max(0.55, 1 - pull * tension * 0.6) * (1 + 0.15 * (1 - tension) * drift);
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
