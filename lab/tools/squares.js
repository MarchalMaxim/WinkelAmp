// Dread squares v2: faster fade (≈1.4 s), soft blurred edges.
(() => {
  let sq = [], shake = 0;
  TOOLS.push({
    id: 'squares', name: 'Dread squares', tag: 'v2', on: true,
    blurb: 'Low notes land as big dark-red squares. Now they fade in about 1.4 s, and their edges are soft and blurred. Notes you picked by hand always land, however high.',
    // The reference for the new knob style: at most 5 knobs, each with a plain hint and a small picture (see lab/README.md).
    params: [
      { key: 'size', label: 'size', min: 0.3, max: 2, value: 1, less: 0.7,
        hint: 'How big the squares are. Left: small tiles. Right: huge slabs.',
        icon: (g, v, w, h) => ICON.square(g, w / 2, h / 2, 4 + v * (h - 4), ICON.red) },
      { key: 'life', label: 'how long they stay', min: 0.3, max: 4, value: 1.4, less: 1.1,
        hint: 'How long a square stays. Left: a blink. Right: lingers for seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red) },
      { key: 'blur', label: 'soft edges', min: 0, max: 3, value: 1,
        hint: 'How soft the edges are. Left: sharp, clean edges. Right: blurred, glowing ones.',
        icon: (g, v, w, h) => ICON.blur(g, v * 3, () => ICON.square(g, w / 2, h / 2, h - 8, ICON.red)) },
      { key: 'split', label: 'which notes count as low', min: 36, max: 72, step: 1, value: 50, less: 44,
        hint: 'Only notes below this point make squares; notes you picked by hand always do. Left: only the deepest bass. Right: up to the middle of the piano.',
        icon: (g, v, w, h) => ICON.keys(g, w, h, 0, 0.17 + v * 0.42, ICON.red) },
      { key: 'shake', label: 'shake on loud notes', min: 0, max: 2, value: 1, drive: '+level',
        hint: 'How hard the picture shakes when a note is struck very loud. Left: still. Right: a jolt.',
        icon: (g, v, w, h) => ICON.shake(g, v * 4, () => ICON.square(g, w / 2, h / 2, h - 8, ICON.red)) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How many squares you see: how many notes count as low, how big each is, how long it stays. Left: only the deeper bass makes a square, small, and it soon fades. Right: every low note lands a big square that lingers. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { sq = []; shake = 0; },
    onChord(ch, x) {
      for (const n of ch.notes) {
        const lim = x.p('split'); if (n.m >= lim && !x.onPicks()) continue;
        const s = (110 + Math.max(0, lim - n.m) * 9) * (0.55 + 0.45 * n.v / 110) * x.p('size');   // above the point: the smallest
        sq.push({ x: x.rnd(s / 2, x.W - s / 2), y: x.rnd(x.H * 0.3, x.H * 0.8), s, age: 0, v: n.v, rot: x.rnd(-0.06, 0.06) });
        if (n.v > 95) shake = Math.max(shake, (n.v - 90) * 0.9 * x.p('shake'));
      }
    },
    frame(x) {
      const g = x.g;
      if (shake > 0.3) { g.translate(x.rnd(-shake, shake), x.rnd(-shake, shake)); shake *= Math.pow(0.86, x.dt * 60); }
      for (const q of sq) {
        q.age += x.dt; q.y += x.dt * 18;
        const land = Math.min(1, q.age / 0.1), k = 1 + (1 - land) * 0.16;
        const life = x.p('life'), fade = Math.pow(Math.max(0, 1 - q.age / life), 1.6);
        const lit = 0.35 + 0.65 * Math.max(0, 1 - q.age / 0.3);
        const r = Math.round(70 + 90 * lit * q.v / 110), sz = q.s * k;
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot);
        g.globalAlpha = fade * 0.92;
        g.shadowColor = `rgb(${r},6,8)`; g.shadowBlur = (10 + sz * 0.05) * x.p('blur');
        g.filter = `blur(${((4 + sz * 0.025) * x.p('blur')).toFixed(1)}px)`;
        g.fillStyle = `rgb(${r},${Math.round(4 + 10 * lit)},${Math.round(6 + 8 * lit)})`;
        g.fillRect(-sz / 2, -sz / 2, sz, sz);
        g.restore();
      }
      sq = sq.filter((q) => q.age < 4);
    },
  });
})();
