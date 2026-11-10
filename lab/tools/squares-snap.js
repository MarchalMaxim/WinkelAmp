// Snap squares: Dread squares, answering each note sharply. A crack on the attack, a sink you can tune, a quiet ember.
(() => {
const SNAP = KIT.SNAP;
  let sq = [], shake = 0;
  TOOLS.push({
    id: 'squares-snap', name: 'Snap squares', tag: 'new', on: false,
    blurb: 'Low notes land as big dark-red squares, in the same places as Dread squares, but each one cracks on at full strength, lit for an instant, and then sinks back to a quiet ember; you set how long the sink takes (the default is about half a second, so you can see it). Notes you picked by hand always land, however high.',
    // The reference for the new knob style: at most 5 knobs, each with a plain hint and a small picture (see lab/README.md).
    params: [
      { key: 'size', label: 'size', min: 0.3, max: 2, value: 1, less: 0.7,
        hint: 'How big the squares are. Left: small tiles. Right: huge slabs.',
        icon: (g, v, w, h) => ICON.square(g, w / 2, h / 2, 4 + v * (h - 4), ICON.red) },
      // In seconds: how long the full-strength crack takes to sink back to the ember (about the time it takes to fall to a tenth of the crack).
      { key: 'life', label: 'how long a square takes to sink', min: 0.15, max: 3, value: 0.6, less: 0.3,
        hint: 'How long a square takes to sink back after it cracks on at full strength. Left: it drops at once, in about a sixth of a second. Right: it sinks slowly, over about three seconds. It always lands at full strength; this only sets how slowly it comes down.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red) },
      { key: 'blur', label: 'soft edges', min: 0, max: 3, value: 1,
        hint: 'How soft the edges are. Left: sharp, clean edges. Right: blurred, glowing ones. A square is always sharp at the instant it lands and softens over a moment.',
        icon: (g, v, w, h) => ICON.blur(g, v * 3, () => ICON.square(g, w / 2, h / 2, h - 8, ICON.red)) },
      { key: 'split', label: 'which notes count as low', min: 36, max: 72, step: 1, value: 50, less: 44,
        hint: 'Only notes below this point make squares; notes you picked by hand always do. Left: only the deepest bass. Right: up to the middle of the piano.',
        icon: (g, v, w, h) => ICON.keys(g, w, h, 0, 0.17 + v * 0.42, ICON.red) },
      { key: 'shake', label: 'shake on loud notes', min: 0, max: 2, value: 1, drive: '+level',
        hint: 'How hard the picture shakes when a note is struck very loud. Left: still. Right: a jolt.',
        icon: (g, v, w, h) => ICON.shake(g, v * 4, () => ICON.square(g, w / 2, h / 2, h - 8, ICON.red)) },
      // A sixth knob, a 0/1 switch the user asked for (2026-11-06, nocturne micro scene a2): milky white squares instead of dark red.
      { key: 'milk', label: 'milky white', min: 0, max: 1, step: 1, value: 0,
        hint: 'What colour the squares are. Left: dark red, as always. Right: milky white, like ivory.',
        icon: (g, v, w, h) => ICON.square(g, w / 2, h / 2, h - 8, v >= 0.5 ? ICON.ink : ICON.red) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How many squares you see: how many notes count as low, how big each is, how long it stays. Left: only the deeper bass makes a square, small, and it soon fades. Right: every low note lands a big square that lingers. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { sq = []; shake = 0; },
    onChord(ch, x) {
      for (const n of ch.notes) {
        const lim = x.p('split'); if (n.m >= lim && !x.picked) continue;
        const s = (110 + Math.max(0, lim - n.m) * 9) * (0.55 + 0.45 * n.v / 110) * x.p('size');   // above the point: the smallest
        // the draw order x, y, rot is the same as Squares, so every square lands where Squares puts it
        sq.push({ x: x.rnd(s / 2, x.W - s / 2), y0: x.rnd(x.H * 0.3, x.H * 0.8), s, v: n.v, rot: x.rnd(-0.06, 0.06), t0: ch.t, m: n.m, d: n.d, a: n.amount ?? 1 });
        if (n.v > 95) shake = Math.max(shake, (n.v - 90) * 0.9 * x.p('shake'));
      }
    },
    frame(x) {
      const g = x.g;
      if (shake > 0.3) { g.translate(x.rnd(-shake, shake), x.rnd(-shake, shake)); shake *= Math.pow(0.86, x.dt * 60); }
      // The 'sink' knob stretches only the crack (the hold and the flash); the ember under it keeps the piano preset's own length.
      // k = 1 is the envelope as it stands (the crack is down to a tenth in about 0.2 s). Age is read from the chord's time, never added up.
      const k = Math.max(0.1, x.p('life') / 0.2), blur = x.p('blur'), milk = x.p('milk') >= 0.5;
      const o = { preset: 'piano', ring: 1, picks: !!x.picked };
      const P = SNAP.preset('piano');
      const smooth = (a, b, v) => { const u = Math.max(0, Math.min(1, (v - a) / (b - a))); return u * u * (3 - 2 * u); };
      // SNAP.env with the flash's time stretched by k; the same pieces, so E(0) = P (full strength on the attack) and it only falls.
      const shape = (t, nt, e) => {
        if (!(t >= 0) || t >= e.L) return 0;
        const hb = SNAP.hb(nt.m, P, 1), g = SNAP.gain(nt.a == null ? 1 : nt.a);
        let E = e.P * (P.wf * g * SNAP.flash(t / k) + P.wb * e.body + P.wt * Math.pow(0.5, t / (8 * hb))) / (P.wf * g + P.wb + P.wt);
        E *= 1 - smooth(e.L - 0.1, e.L, t);
        if (nt.d != null && nt.d < 0.15 && nt.m < 89 && t > nt.d) E *= Math.pow(0.5, (t - nt.d) / 0.06);
        return E;
      };
      for (const q of sq) {
        const t = Math.max(0, x.t - q.t0), nt = { v: q.v, m: q.m, d: q.d, a: q.a };
        const e = SNAP.env(t, nt, o), E = shape(t, nt, e), Eprev = shape(t - x.dt, nt, SNAP.env(t - x.dt, nt, o));
        const fl = SNAP.flash(t / k);
        q.dead = t > e.L;
        if (q.dead || E <= 0.002) continue;
        const sz = q.s * SNAP.size(t, q.v, { o: 0.18 }) * (0.7 + 0.3 * E / e.P);
        const lit = 0.35 + 0.65 * fl;
        const r = Math.round(70 + 90 * lit * q.v / 110);
        // Milky: the same lightness as the red's, in a warm milk white (the ember is a dim cream, the crack bone).
        const lum = Math.min(1, 0.3 + r / 200), base = milk ? [Math.round(236 * lum), Math.round(229 * lum), Math.round(214 * lum)] : [r, Math.round(4 + 10 * lit), Math.round(6 + 8 * lit)];
        const [hr, hg, hb] = SNAP.hot(base, t / k, q.a);
        const sh = SNAP.sharp(t, blur);
        g.save(); g.translate(q.x, q.y0 + t * 18); g.rotate(q.rot);
        g.globalAlpha = SNAP.alpha(E, Eprev);
        g.shadowColor = milk ? `rgb(${Math.round(150 * lum)},${Math.round(144 * lum)},${Math.round(132 * lum)})` : `rgb(${r},6,8)`; g.shadowBlur = (10 + sz * 0.05) * sh;
        g.filter = `blur(${((4 + sz * 0.025) * sh).toFixed(1)}px)`;
        g.fillStyle = `rgb(${hr},${hg},${hb})`;
        g.fillRect(-sz / 2, -sz / 2, sz, sz);
        g.restore();
      }
      sq = sq.filter((q) => !q.dead);
    },
  });
})();
