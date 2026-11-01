// Duet: a stub for round 9, so the lab lists it while it is being built.
(() => {
  let marks = [];
  TOOLS.push({
    id: 'duet', name: 'Duet', tag: 'new',
    blurb: 'Two forms in two colours, one round and one sharp: consonant attacks draw them together, dissonant ones throw them apart.',
    params: [
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much of it you see. Left: almost nothing. Right: fully there.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => ICON.dot(g, w / 2, h / 2, 8, '#ff4a1c')) },
    ],
    reset() { marks = []; },
    onChord(ch, x) {
      marks.push({ x: x.pitch01(ch.hi) * x.W, y: x.H * x.rnd(0.3, 0.7), r: 6 + ch.vel * 0.3 + ch.notes.length * 6, age: 0 });
    },
    frame(x) {
      const g = x.g;
      for (const m of marks) {
        m.age += x.dt;
        g.globalAlpha = Math.max(0, 1 - m.age / 1.5) * x.p('presence');
        g.strokeStyle = '#ff4a1c'; g.lineWidth = 3;
        g.beginPath(); g.arc(m.x, m.y, m.r, 0, Math.PI * 2); g.stroke();
      }
      marks = marks.filter((m) => m.age < 1.5);
    },
  });
})();
