// Handover: each picked note is one dark-red slab that shrinks away exactly as the next note lands, so the picture
// is always "this note, then that one" and never two at once. Drawn statelessly from CHORDS.
(() => {
const SNAP = KIT.SNAP;

  // Which chord is sounding at song time t: the last one at or before it. A binary search, so a seek, a render and
  // live play all find the same chord, with nothing remembered between frames.
  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };
  const dark = (v) => [Math.round(140 + 100 * v / 127), 18, 22];   // a clear red, brighter for a harder note
  // Milky white (the user, 2026-11-06: "all handovers milky white"): a warm cream, brighter for a harder note.
  const milky = (v) => { const l = 0.62 + 0.3 * v / 127; return [Math.round(236 * l), Math.round(229 * l), Math.round(214 * l)]; };
  const strike = (v, age, milk) => { const c = milk ? milky(v) : dark(v), k = 0.97 * SNAP.flash(age); return [0, 1, 2].map((i) => Math.round(c[i] + (SNAP.BONE[i] - c[i]) * k)); };   // bone at the blow, cooling to red

  TOOLS.push({
    id: 'handover', name: 'Handover', tag: 'snap', on: false,
    blurb: 'One slab per note, struck bone-hot and cooling to milky white (or dark red), shrinking away so that it is exactly gone when the next note lands. No note ever shares the stage with the next.',
    params: [
      { key: 'goneBy', label: 'gone by', min: 0.3, max: 2.5, value: 1.2, less: 0.6,
        hint: 'How long a lone note may last when nothing follows it. Left: a mark never lasts a third of a second. Right: a lone note may glow up to two and a half seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red) },
      { key: 'size', label: 'size', min: 0.4, max: 2, value: 1, less: 0.75,
        hint: 'How big a fresh slab is. Left: small tiles. Right: huge slabs.',
        icon: (g, v, w, h) => ICON.rect(g, w / 2 - (3 + v * 9) * 0.8, h / 2 - (3 + v * 9) / 2, (3 + v * 9) * 1.6, 3 + v * 9, ICON.red) },
      { key: 'ring', label: 'how long it rings', min: 0.25, max: 3, value: 1, less: 0.6,
        hint: 'How slowly a slab gives up its size before the next note. Left: it is small again in a quarter of the time. Right: it keeps most of its size until the last moment.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.15 + (v / 3) * 0.85, ICON.gold) },
      // A 0/1 switch: milky white is the default (the user wants every handover milky); red is the old look.
      { key: 'milk', label: 'milky white', min: 0, max: 1, step: 1, value: 1,
        hint: 'What colour the slabs cool to. Left: dark red. Right: milky white, like ivory.',
        icon: (g, v, w, h) => ICON.rect(g, w / 2 - 8, h / 2 - 5, 16, 10, v >= 0.5 ? ICON.ink : ICON.red) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much you see: how big each slab is, how long it may last. Left: small, quick slabs. Right: big slabs that may last. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() {},
    onChord() {},   // stateless: frame finds the chord itself, so nothing is born or kept here
    frame(x) {
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i = chordAt(cs, x.t); if (i < 0) return;
      const c = cs[i], age = x.t - c.t;
      // Gone when the next note lands, or after goneBy if none comes (a chord is the first attack of its notes).
      const next = Math.min(c.t + x.p('goneBy'), i + 1 < cs.length ? cs[i + 1].t : Infinity);
      const span = next - c.t; if (!(span > 0) || age >= span) return;
      const u = Math.pow(age / span, x.p('ring'));   // ring > 1 keeps the slab big longer (u^ring); the design's u^(1/ring) would shrink it faster
      const area = (1 - u) * Math.exp(-2.2 * u);       // reaches 0 exactly at u = 1
      const g = x.g, picks = !!x.picked, size = x.p('size'), W = x.W, H = x.H, milk = x.p('milk') >= 0.5;
      for (const n of c.notes) {
        const v = n.v, T = Math.max(0.6, SNAP.peak(v, true));       // brightness holds; only the area falls (P6: a picked note always lands)
        // The previous step's brightness: T if the slab already stood there, 0 on the attack step.
        const Tprev = age - x.dt >= 0 && age - x.dt < span ? T : 0;
        const w = (230 + 430 * Math.pow(v / 127, 1.3)) * size * Math.sqrt(area), h = w / 1.6;
        if (w < 0.5) continue;
        const oct = Math.floor(n.m / 12) - 1;        // octave rows, bass at the bottom
        const cx = (0.06 + 0.88 * x.pitch01(n.m)) * W;
        const cy = H * (0.84 - 0.68 * Math.max(0, Math.min(1, (oct - 1) / 7))) - ((n.m % 12) - 5.5) * 3;
        g.save();
        // While the strike cools from bone to red, the canvas would hold the bone (a low alpha repaints a pixel only a
        // little each step), so for those steps the new colour goes down at least half-strength: it cools as fast as flash().
        const cooling = age > SNAP.H && age < SNAP.H + 0.45;
        g.globalAlpha = Math.max(SNAP.alpha(T, Tprev), cooling ? 0.6 : 0);
        g.fillStyle = `rgb(${strike(v, age, milk).join(',')})`;
        g.fillRect(cx - w / 2, cy - h / 2, w, h);
        g.restore();
      }
    },
  });
})();
