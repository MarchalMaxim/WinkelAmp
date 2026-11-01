// Whitney (new, 2026-10-31): after John Whitney's Permutations and Arabesque. Hundreds of dots in differential rotation:
// dot k turns k times as fast as dot 1, at radius ∝ k, so the whole cloud is set by one angle φ (dot k sits at k·φ).
// When φ sits near 2π·n/q the dots line up into q arms (a rosette or a spiral galaxy); anywhere else they are dust.
// The harmony sets n/q: an interval's just ratio p/q (fifth 3/2, third 5/4, fourth 4/3...) reduced below 1 IS the
// figure, so the denominator is the number of arms: a fifth draws 2 arms, a fourth 3, a major third 4, a minor third 5,
// a semitone 15 and a tritone 32 (dust). Three nested rings of dots carry three intervals of the chord (inner: its two
// lowest notes, middle: the next pair, outer: bass to top); a lone note uses its step from the previous melody note.
// Each chord pulls every ring's φ to its figure along a critically damped spring, so it sweeps through dozens of
// passing figures and crystallises; the arms then breathe (wind and unwind) while the chord sounds. Between chords the
// target creeps, so figures keep emerging and dissolving on their own, as in Whitney's films. An attack flashes the dots
// and kicks the phase (up for a rising top note, down for a falling one), louder = harder; dissonant intervals shiver.
// Each arm has its own colour, so a locked figure reads as coloured arms and a scrambled one as confetti.
(() => {
  const TAU = Math.PI * 2;
  // just ratios of the 12 intervals; the figure is frac(p/q) = n/q
  // (the tritone draws as 7/5, five arms, but shivers hardest; the shiver follows the classical ratio's Tenney height)
  const JUST = [[1, 1], [16, 15], [9, 8], [6, 5], [5, 4], [4, 3], [7, 5], [3, 2], [8, 5], [5, 3], [16, 9], [15, 8]];
  const HARSH = [0, 7.9, 6.2, 4.9, 4.3, 3.6, 10.5, 2.6, 5.3, 3.9, 7.2, 7.0];
  const fig = (iv) => { const i = ((iv % 12) + 12) % 12, [p, q] = JUST[i]; return { n: p % q, q, h: HARSH[i] }; };
  // the arm colours (cyclic): vermilion, amber, cream, teal, violet, rose
  const PAL = [[255, 86, 52], [255, 184, 64], [246, 232, 200], [56, 206, 200], [128, 112, 255], [255, 84, 160]];
  const NB = 3, BAND = [[0.05, 0.31], [0.37, 0.64], [0.70, 1.0]];  // the rings, as fractions of the radius
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const mkBand = () => ({ phi: 0, v: 0, tgt: 0, q: 1, n: 0, h: 0, shiver: 0 });
  let bands = [], hist = [], flash = 0, pres = 0, lastTop = null, T = 0, spin = 0, lvl = 0;

  function reset() {
    bands = [0, 1, 2].map((b) => Object.assign(mkBand(), { phi: TAU * [0.2, 0.35, 0.5][b] + 0.003 * b }));
    for (const b of bands) b.tgt = b.phi;
    hist = []; flash = 0; pres = 0; lastTop = null; T = 0; spin = 0; lvl = 0;
  }
  reset();

  // ---- icons (40x26): a tiny Whitney disc. arms q, twist (rad at the rim), scatter 0..1, n dots ----
  function disc(g, { q = 3, twist = 1.5, scatter = 0, n = 30, col = ICON.ink, cols = null, r = 1.15, cx = 20, cy = 13, R = 11.5, seed = 4 } = {}) {
    const rnd = ICON.rng(seed);
    for (let k = 1; k <= n; k++) {
      const a0 = (TAU * k) / q + (twist * k) / n, a1 = rnd() * TAU, rr0 = 1.5 + (R - 1.5) * (k / n), rr1 = 1.5 + rnd() * (R - 1.5);
      const a = lerp(a0, a1, scatter), rr = lerp(rr0, rr1, scatter);
      ICON.dot(g, cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr, r, cols ? cols[k % q % cols.length] : col);
    }
  }
  const ARMS = ['#ff5634', '#38cec8', '#ffb840', '#8070ff'];
  const ICONS = {
    count: (g, v) => disc(g, { q: 3, twist: 2, n: Math.round(8 + v * 52), r: 1.05, cols: ARMS }),
    hold: (g, v) => disc(g, { q: 4, twist: 1.6, n: 36, scatter: 1 - v, cols: ARMS, seed: 9 }),
    kick(g, v) {                                       // a calm 3-arm figure, then one stirred into a swirl with a flash
      disc(g, { q: 3, twist: 1.5 + v * 3, n: 30, cols: ARMS, R: 10.5, r: 1.15 + v * 0.5 });
      if (v > 0.05) ICON.alpha(g, v, () => { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.3, r0 = 3, r1 = 3 + v * 3.5; ICON.line(g, 20 + Math.cos(a) * r0 * 1.2, 13 + Math.sin(a) * r0, 20 + Math.cos(a) * r1 * 1.2, 13 + Math.sin(a) * r1, '#fff6e0', 1.1); } ICON.dot(g, 20, 13, 1.6 + v, '#fff6e0'); });
    },
    drift(g, v) {                                      // one arm, with ghosts of where it was: more and wider when it wanders fast
      const ghosts = Math.round(v * 4);
      for (let j = ghosts; j >= 0; j--) {
        const a = -0.4 - j * 0.45 * (0.4 + v);
        ICON.alpha(g, j ? 0.25 + 0.15 * (ghosts - j) / Math.max(1, ghosts) : 1, () => {
          for (let k = 1; k <= 6; k++) ICON.dot(g, 20 + Math.cos(a - k * 0.12) * k * 2.3, 13 + Math.sin(a - k * 0.12) * k * 1.75, 1.2, j ? ICON.dim : '#ffb840');
        });
      }
      if (v > 0.05) { g.strokeStyle = ICON.dim; g.lineWidth = 1; g.beginPath(); g.arc(20, 13, 11.5, -0.3, -0.3 + v * 3.6); g.stroke(); }
    },
    trail(g, v) {                                      // dots on circles, each dragging an arc of light behind it
      [[4, 0.3, '#ff5634'], [7.5, 2.4, '#38cec8'], [11, 4.4, '#ffb840']].forEach(([r, a, c]) => {
        if (v > 0.03) { g.strokeStyle = c; g.globalAlpha = 0.75; g.lineWidth = 1.4; g.beginPath(); g.arc(20, 13, r, a - v * 2.2, a); g.stroke(); g.globalAlpha = 1; }
        ICON.dot(g, 20 + Math.cos(a) * r, 13 + Math.sin(a) * r, 1.7, c);
      });
    },
  };

  // φ of band b at song time t (the trail looks back into this short history)
  function phiAt(t, b) {
    for (let i = hist.length - 1; i > 0; i--) {
      if (hist[i - 1].t <= t) { const A = hist[i - 1], B = hist[i], k = B.t > A.t ? clamp01((t - A.t) / (B.t - A.t)) : 1; return lerp(A.p[b], B.p[b], k); }
    }
    return hist.length ? hist[0].p[b] : bands[b].phi;
  }

  TOOLS.push({
    id: 'whitney', name: 'Whitney', tag: 'new',
    blurb: 'After John Whitney\'s films: hundreds of dots, each turning a little faster than the one inside it, so rosettes and spirals form and dissolve. The chord sets the figure: a lone note or an octave coils one arm, a fifth makes 2 arms, a fourth 3, a third 4 or 5, a semitone 15; clashing intervals shiver. Three nested rings carry three intervals of the chord; every note kicks the dots, they whirl through passing figures and settle into the new one.',
    params: [
      { key: 'count', label: 'how many dots', min: 200, max: 1400, step: 10, value: 520,
        hint: 'How many dots make the figure. Left: a few hundred, airy and open. Right: so many the arms become solid ribbons.',
        icon: ICONS.count },
      { key: 'hold', label: 'how firmly chords hold the figure', min: 0, max: 1, value: 0.7,
        hint: 'How strongly a chord pulls the dots into its figure. Left: they barely settle and keep drifting through shapes. Right: each chord snaps them into clean arms that stay while it sounds.',
        icon: ICONS.hold },
      { key: 'kick', label: 'how hard notes stir the dots', min: 0, max: 2, value: 1, drive: '+level',
        hint: 'How much each struck note throws the figure around before it settles. Left: a gentle nudge. Right: a loud note whirls it through dozens of passing figures.',
        icon: ICONS.kick },
      { key: 'drift', label: 'how fast it wanders on its own', min: 0, max: 1, value: 0.4, drive: '+rate',
        hint: 'How fast new figures appear by themselves between chords and in rests. Left: almost still. Right: shapes keep blooming and melting away.',
        icon: ICONS.drift },
      { key: 'trail', label: 'light trails', min: 0, max: 1, value: 0.45,
        hint: 'How long a streak of light each dot drags behind it as it turns. Left: crisp points. Right: long arcs, like a long exposure.',
        icon: ICONS.trail },
    ],
    reset,
    onChord(ch, x) {
      // the chord: its own notes plus what was struck just before it and still sounds (a broken chord counts)
      const ms = new Set(ch.notes.map((n) => n.m));
      if (new Set(ch.notes.map((n) => n.m % 12)).size < 2) for (const n of x.sounding()) if (n.start > x.t - 0.6) ms.add(n.m);
      const sorted = [...ms].sort((a, b) => a - b), pcs = new Set(), L = [];
      for (const m of sorted) if (!pcs.has(m % 12)) { pcs.add(m % 12); L.push(m); }
      let ivs;
      if (L.length === 1) { const s = lastTop == null ? 0 : ch.hi - lastTop; ivs = [s, s, s]; }
      else ivs = [L[1] - L[0], L.length > 2 ? L[2] - L[1] : L[1] - L[0], L[L.length - 1] - L[0]];
      const dir = lastTop == null || ch.hi === lastTop ? (ch.t * 7.3 % 2 < 1 ? 1 : -1) : Math.sign(ch.hi - lastTop);
      lastTop = ch.hi;
      const vk = clamp01(ch.vel / 115), kick = x.p('kick'), N = x.p('count');
      bands.forEach((b, i) => {
        const f = fig(ivs[i]);
        b.q = f.q; b.n = f.n; b.h = f.h;
        // the nearest φ that draws q arms: any 2π·n'/q with n' coprime to q gives the same arms (only their order
        // differs), so the dots travel at most about π/q (φ itself is never wrapped: the trail arcs read its history)
        let best = Infinity;
        for (let m = 0; m < f.q; m++) {
          if (gcd(m, f.q) !== 1 && f.q > 1) continue;
          const base = (TAU * m) / f.q, d = ((b.phi - base) % TAU + TAU) % TAU, step = d > Math.PI ? TAU - d : -d;
          if (Math.abs(step) < Math.abs(best)) best = step;
        }
        b.tgt = b.phi + best;
        // on the attack frame itself: the arms jump (an immediate twist of the whole ring) and the ring is thrown
        const ring = 0.6 + 0.4 * i;
        b.phi += dir * kick * vk * vk * (2 + 2 * i) / N;
        b.v += dir * kick * vk * vk * vk * 0.45 * ring;
      });
      flash = Math.max(flash, 0.35 + 0.65 * vk * vk);
      lvl = Math.max(lvl, vk);
    },
    frame(x) {
      const g = x.g, dt = x.dt; if (dt <= 0) return;
      T += dt;
      const N = Math.round(x.p('count')), hold = x.p('hold'), drift = x.p('drift'), trail = x.p('trail');
      pres += ((x.sounding().length ? 1 : 0) - pres) * (1 - Math.exp(-dt / 0.35));
      flash *= Math.exp(-dt / 0.22); lvl *= Math.exp(-dt / 1.5);
      spin += dt * (0.04 + 0.12 * drift);
      // stiffness of the pull to the figure: lazy when hold is low; very loose in rests
      const om = lerp(1, 22, hold) * (0.3 + 0.7 * pres);
      const creep = lerp(0.002, 0.03, drift * drift) * Math.pow(1 - 0.95 * hold * pres, 2);
      bands.forEach((b, i) => {
        b.tgt += creep * dt * (i % 2 ? -1 : 1) * (1 + 0.3 * i);
        // breathing: the arms wind and unwind a few radians at the rim, never straight spokes
        // (few arms wind more: a lone arm coils into a galaxy of several turns, fifteen arms only curve)
        const twist = TAU * (1.6 + 0.9 * Math.sin(T * 0.33 + i * 2.1)) * (b.q === 1 ? 3 : 1) / Math.pow(b.q, 0.8) * (i % 2 ? -1 : 1);
        const e = b.phi - (b.tgt + twist / N), c2 = b.v + om * e, ex = Math.exp(-om * dt);
        const e1 = (e + c2 * dt) * ex; b.v = (b.v - om * c2 * dt) * ex; b.phi = b.tgt + twist / N + e1;
        // dissonance shivers (the semitone a little, the tritone hard)
        b.shiver += (Math.max(0, b.h - 5.2) * 1.0 * (0.4 + 0.6 * pres) - b.shiver) * (1 - Math.exp(-dt / 0.3));
      });
      hist.push({ t: T, p: bands.map((b) => b.phi) });
      while (hist.length > 2 && hist[1].t < T - 1) hist.shift();

      const cx = x.W / 2, cy = x.H / 2, R = x.H * 0.47, lag = trail * 0.25;
      const dotR = 1.3 + 0.8 * lvl + 1.4 * flash, fl = clamp01(flash);
      const per = [0.22, 0.33, 0.45];                    // how the dots are split between the rings
      let k0 = 1;
      for (let bi = 0; bi < NB; bi++) {
        const b = bands[bi], n = Math.round(N * per[bi]), [r0, r1] = BAND[bi];
        const phi = b.phi, phiThen = lag > 0.01 ? phiAt(T - lag, bi) : phi;
        const nC = Math.min(PAL.length, b.q), pathsD = [], pathsT = [];
        for (let c = 0; c < nC; c++) { pathsD.push(new Path2D()); pathsT.push(new Path2D()); }
        const sh = b.shiver, rot = spin * (bi % 2 ? -0.7 : 1), dR = dotR * (1 + 0.45 / b.q);
        for (let j = 0; j < n; j++) {
          const k = k0 + j, rr = R * lerp(r0, r1, j / Math.max(1, n - 1));
          let a = k * phi + rot, r = rr;
          if (sh > 0.05) { a += (Math.random() - 0.5) * sh * 0.02; r += (Math.random() - 0.5) * sh * 2.2; }
          const c = Math.round(((k % b.q) * nC) / b.q) % nC;
          const px = cx + Math.cos(a) * r * 1.22, py = cy + Math.sin(a) * r;
          pathsD[c].moveTo(px + dR, py); pathsD[c].arc(px, py, dR, 0, TAU);
          if (lag > 0.01) {
            const cap = Math.min(1, 60 / r); let sw = k * (phi - phiThen); sw = Math.max(-cap, Math.min(cap, sw));
            if (Math.abs(sw) * r > 2.5) {
              // an elliptical arc (the disc is stretched 1.22 wide)
              const p = pathsT[c], m = Math.max(2, Math.ceil(Math.abs(sw) * 5));
              p.moveTo(px, py);
              for (let s = 1; s <= m; s++) { const aa = a - (sw * s) / m; p.lineTo(cx + Math.cos(aa) * r * 1.22, cy + Math.sin(aa) * r); }
            }
          }
        }
        k0 += n;
        const inner = 0.6 + 0.4 * (bi / 2);
        for (let c = 0; c < nC; c++) {
          const col = PAL[(c + bi * 2) % PAL.length].map((v) => Math.round(lerp(v * inner, 255, fl * 0.35)));
          if (lag > 0.01) { g.globalAlpha = 0.1 + 0.3 * trail; g.strokeStyle = `rgb(${col})`; g.lineWidth = 1.1 + 0.6 * lvl; g.stroke(pathsT[c]); }
          g.globalAlpha = 0.9; g.fillStyle = `rgb(${col})`; g.fill(pathsD[c]);
        }
      }
      g.globalAlpha = 1;
    },
  });
})();
