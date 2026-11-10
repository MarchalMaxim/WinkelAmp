// Fist of spines: a flat field of short dark-teal needles lies along a slow nap. On a note every needle within reach turns at
// once to aim at the note's spot and stabs, stopping short, so the spot stays black; then they lie back together.
// Fist of spines, id 'fist' (it was 'urchin' until 2026-11-08: ad blockers block any file named urchin.js).
// Stateless from CHORDS: the owner of a needle and its age come from x.t - ch.t.
(() => {
const SNAP = KIT.SNAP;

  const TAU2 = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };
  const mulberry32 = (a) => () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Tone ramp: dark teal ground, teal, pale teal, bone. Linear between stops, monotone per channel.
  const STOPS = [[0, null], [0.35, [44, 150, 138]], [0.65, [150, 200, 186]], [0.9, SNAP.BONE], [1, SNAP.BONE]];
  const groundColour = (ground) => [16, 62, 58].map((c) => Math.round(c * ground / 0.24));
  const colour = (q, G) => {
    for (let s = 1; s < STOPS.length; s++) {
      if (q <= STOPS[s][0] || s === STOPS.length - 1) {
        const a = s === 1 ? G : STOPS[s - 1][1], b = STOPS[s][1], u = clamp((q - STOPS[s - 1][0]) / (STOPS[s][0] - STOPS[s - 1][0]), 0, 1);
        return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * u));
      }
    }
    return SNAP.BONE;
  };

  // Field: rebuilt only when round(spines) changes. Fixed seed, so a seek, a render and live play agree.
  let field = null;
  const buildField = (N, W, H) => {
    const s = Math.sqrt(W * H / N), cols = Math.max(1, Math.round(W / s)), rows = Math.max(1, Math.round(H / s));
    const cw = W / cols, chh = H / rows, n = cols * rows, r = mulberry32(20261106);
    const px = new Float32Array(n), py = new Float32Array(n), rest = new Float32Array(n), sg = new Float32Array(n);
    let k = 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const jx = r() * 0.7 - 0.35, jy = r() * 0.7 - 0.35, jit = r() * 0.3 - 0.15, sgn = r() < 0.5 ? -1 : 1;
      const x = (i + 0.5 + jx) * cw, y = (j + 0.5 + jy) * chh;
      px[k] = x; py[k] = y; sg[k] = sgn;
      rest[k] = 0.5 + 0.9 * Math.sin(TAU2 * (0.55 * x / W + 0.2 * y / H) + 1.1) + 0.5 * Math.sin(TAU2 * (0.9 * y / H - 0.3 * x / W) + 2.4) + jit;
      k++;
    }
    const L0 = 0.7 * s, hb = 1.75 * Math.sqrt(L0 / 43.4);
    return { N, W, H, n, px, py, rest, sg, L0, hb, bk: new Uint8Array(n), ang: new Float32Array(n), len: new Float32Array(n) };
  };

  // Clip statistics, once per CHORDS array.
  let stats = null, spotCache = new Map();
  const getStats = (cs) => {
    if (stats && stats.arr === cs && stats.len === cs.length) return stats;
    let lo = Infinity, hi = -Infinity;
    const vs = [];
    for (const ch of cs) { if (ch.lo < lo) lo = ch.lo; if (ch.hi > hi) hi = ch.hi; for (const n of ch.notes) vs.push(n.v); }
    if (!(hi >= lo)) { lo = 54; hi = 66; }
    if (hi - lo < 12) { const c = (lo + hi) / 2; lo = c - 6; hi = c + 6; }
    vs.sort((a, b) => a - b);
    const p10 = vs.length ? vs[Math.floor(0.1 * (vs.length - 1))] : 0, p90 = vs.length ? vs[Math.floor(0.9 * (vs.length - 1))] : 127;
    const flat = vs.length < 2 || p90 - p10 < 4;
    spotCache = new Map();
    stats = { arr: cs, len: cs.length, lo, hi, p10, p90, flat };
    return stats;
  };
  const spotsOf = (ch, st, W, H) => {
    let sp = spotCache.get(ch);
    if (sp) return sp;
    sp = [];
    for (const n of ch.notes) {
      const u = st.flat ? clamp(n.v / 127, 0, 1) : clamp((n.v - st.p10) / (st.p90 - st.p10), 0, 1), m = n.m, pc = m % 12;
      sp.push({
        sx: W * (0.1 + 0.8 * (m - st.lo) / (st.hi - st.lo)), sy: H * (0.2 + 0.6 * ((pc * 7) % 12) / 11),
        u, vN: 127 * (0.3 + 0.7 * u), m, d: n.d, a: n.amount == null ? 1 : n.amount,
      });
    }
    spotCache.set(ch, sp);
    return sp;
  };

  TOOLS.push({
    id: 'fist', name: 'Fist of spines', tag: 'new', on: false,
    blurb: "A field of dark-teal needles lies along a slow nap. On each note every needle within reach turns at once to aim at the note's spot and stabs, stopping short, so the spot stays black; then they lie back together. Pitch places the spot, loudness sets how far the call reaches.",
    params: [
      { key: 'reach', label: 'how far the call reaches', min: 0.3, max: 2, value: 1,
        hint: 'How far around a note the spines turn. Left: a small tight fist. Right: half the screen turns.',
        icon: (g, v, w, h) => { ICON.dot(g, w / 2, h / 2, 1.5); ICON.ring(g, w / 2, h / 2, 3 + v * 9, ICON.green); } },
      { key: 'spines', label: 'how many spines', min: 50, max: 600, step: 10, value: 240, less: 50,
        hint: 'How many spines stand in the field. Left: few, long, well apart. Right: dense, short stubble.',
        icon: (g, v, w, h) => {
          const r = ICON.rng(3), n = 3 + Math.round(v * 14), len = 8 - 4 * v;
          for (let i = 0; i < n; i++) { const x = 4 + r() * (w - 8), y = 4 + r() * (h - 8); ICON.line(g, x, y, x + len * 0.7, y - len * 0.7, ICON.green); }
        } },
      { key: 'stab', label: 'how hard they stab', min: 0, max: 1, value: 0.7,
        hint: 'How hard the spines jab at the note. Left: they only turn. Right: they jab past their length and snap back.',
        icon: (g, v, w, h) => ICON.arrow(g, 4, h / 2, 8 + (w - 14) * v, h / 2, ICON.green) },
      { key: 'ring', label: 'how long they stay turned', min: 0.25, max: 3, value: 1, less: 0.25,
        hint: 'How long the fist stays lit and the spines take to lie back. Left: gone in a quarter of the time. Right: three times as long.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + 0.9 * v, ICON.green) },
      { key: 'ground', label: 'how much the field shows at rest', min: 0, max: 0.35, value: 0.24,
        hint: 'How much the resting field shows. Left: only the fist. Right: the nap is always visible.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.1 + 0.9 * v, () => ICON.lines(g, 5, w, h, { dir: 'v', col: ICON.green })) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much you see: how many spines, how long the fist stays. Left: a few spines and a quick blink. Right: a full field and a fist that lingers. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { field = null; stats = null; spotCache = new Map(); },
    onChord() {},   // stateless: frame finds the chords itself
    frame(x) {
      const W = x.W, H = x.H, g = x.g;
      const N = Math.round(x.p('spines'));
      if (!field || field.N !== N || field.W !== W || field.H !== H) field = buildField(N, W, H);
      const F = field, n = F.n, L0 = F.L0, hb = F.hb;
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const st = getStats(cs);
      const reach = x.p('reach'), stab = x.p('stab'), ring = x.p('ring'), ground = x.p('ground'), picks = !!x.picked;
      const tau = 0.15 * ring, Tend = 8 * tau, A0 = (12 * Math.PI / 180) * stab / 0.7, J = 0.5 * stab / 0.7;

      // Active entries, newest chord first; groups[] marks where each chord's entries begin.
      const ent = [], groups = [];
      for (let k = chordAt(cs, x.t); k >= 0 && x.t - cs[k].t < Tend; k--) {
        const ch = cs[k], age = x.t - ch.t, sp = spotsOf(ch, st, W, H);
        groups.push(ent.length);
        for (const s of sp) {
          const R = reach * (180 + 360 * Math.pow(s.u, 1.2)), gap = 10 + 18 * s.u;
          const en = SNAP.env(age, { v: s.vN, m: s.m, d: s.d, a: s.a }, { preset: 'marcato', ring, picks });
          ent.push({ s, R, gap, E: en.P > 0 ? en.E / en.P : 0, age });
        }
      }
      groups.push(ent.length);
      const G = groundColour(ground);
      const dark = ground > 0.001;

      for (let i = 0; i < n; i++) {
        const X = F.px[i], Y = F.py[i];
        let own = null, od = 0;
        for (let gi = 0; gi + 1 < groups.length && !own; gi++) {
          let best = -1, bd = Infinity;
          for (let e = groups[gi]; e < groups[gi + 1]; e++) {
            const s = ent[e].s, d = Math.hypot(s.sx - X, s.sy - Y);
            if (d < ent[e].R && d < bd) { bd = d; best = e; }
          }
          if (best >= 0) { own = ent[best]; od = bd; }
        }
        if (!own) { F.bk[i] = 0; F.ang[i] = F.rest[i]; F.len[i] = L0; continue; }
        const t = own.age, D = Math.exp(-t / tau), DD = (1 + t / tau) * D, s = own.s;
        const aim = Math.atan2(s.sy - Y, s.sx - X);
        let dl = aim - F.rest[i]; dl -= TAU2 * Math.floor((dl + Math.PI) / TAU2);
        if (dl <= -Math.PI) dl += TAU2;
        F.ang[i] = F.rest[i] + dl * DD + F.sg[i] * A0 * Math.exp(-t / 0.06) * Math.sin(TAU2 * 8 * t);
        let L = L0 * (1 + J * Math.exp(-t / 0.07));
        const cap = od - own.gap;
        // The ring: needles close to the spot stretch all the way to the cap, so the tips close on a ring of radius gap.
        const w = clamp((2.2 * L0 - cap) / (0.7 * L0), 0, 1) * clamp(stab / 0.7, 0, 1);
        if (cap > L) L += w * (cap - L) * Math.exp(-t / 0.1);
        if (L > cap) L = cap + (L - cap) * (1 - D);
        F.len[i] = L;
        // Colour is the note's fall (E/P, then fast), how near the needle is (the ring counts as nearest), and a little loudness.
        const near = 0.35 + 0.65 * (1 - od / own.R), nr = near + (1 - near) * w;
        const q = clamp(own.E * D * D * nr * (0.7 + 0.3 * s.u), 0, 1);
        F.bk[i] = Math.ceil(q * 16 - 1e-9);
      }

      g.save();
      g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
      for (let k = dark ? 0 : 1; k <= 16; k++) {
        let any = false;
        for (let i = 0; i < n; i++) {
          if (F.bk[i] !== k) continue;
          const L = F.len[i];
          if (L < 2) continue;
          if (!any) { g.beginPath(); any = true; }
          const a = F.ang[i], c = Math.cos(a), s = Math.sin(a), X = F.px[i], Y = F.py[i], tl = 0.12 * L0;
          g.moveTo(X + c * L, Y + s * L);
          g.lineTo(X - s * hb, Y + c * hb);
          g.lineTo(X - c * tl, Y - s * tl);
          g.lineTo(X + s * hb, Y - c * hb);
          g.closePath();
        }
        if (!any) continue;
        const rgb = k === 0 ? G : colour(k / 16, G);
        g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        g.fill();
      }
      g.restore();
    },
  });
})();
