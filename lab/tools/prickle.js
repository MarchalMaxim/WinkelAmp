// Prickle: one huge flat thorn per note, from the left or the right edge, its sides curving in to a hairline tip. Struck red with a
// bone tip, held still in dim red, withdrawn straight back as the next note lands from the other side. Drawn statelessly from CHORDS
// (docs/mockups/nature/plans/prickle.md). Every dim body is a `lighten` tone at alpha 1, so it holds exactly through the host's fade.
(() => {
// SNAP v1 begin
// SNAP: a piano note on screen. An instant hammer, a fast fall, a quiet tail, so the eye can count the notes.
// What each part is for. t is seconds since the attack, always x.t - ch.t (keep born = ch.t on the mark in onChord),
// never an age added up frame by frame, so seeks, renders and live play agree.
//   SNAP.env(t, n, o)        One note's envelope. n = {v, m, d, a}: the velocity as heard (0..127), the midi pitch,
//                            the written length in seconds, the picked note's intensity (n.amount, default 1).
//                            o = {preset, ring, picks}: preset is 'staccato', 'marcato', 'piano' (the default) or
//                            'bell', or the touch knob's 0..3; ring stretches how long it rings (1 = as the preset
//                            says); picks = x.picked, which raises the floor so every picked note lands.
//                            Returns {E, flash, body, P, L}: E the brightness to show (E(0) = P, it only falls after
//                            the two-step hold, and it is 0 from L on), flash the 0..1 strike that carries the attack,
//                            body the 0..1 note under it, P the peak, L when the mark is gone (drop it then).
//   SNAP.alpha(T, Tprev)     The globalAlpha that puts T on screen this step, given Tprev one step earlier:
//                              g.globalAlpha = SNAP.alpha(SNAP.env(t, n, o).E, SNAP.env(t - x.dt, n, o).E);
//                            Draw every mark through it, never at a raw alpha: the canvas fade would turn the curve
//                            into a hold and a cliff. On the attack step it is T itself (env is 0 before the attack).
//   SNAP.settles(E)          The alpha that holds a mark steady at E when it is redrawn every step (a held note).
//   SNAP.size(t, v, o)       A size factor around 1: a loud note jumps past its size and rings back within a tenth
//                            of a second; notes below velocity 70 do not move. o.o is how far (default: the preset's).
//   SNAP.hot(rgb, t, a)      The mark's colour [r, g, b], lit toward bone for the strike. Intensity a below 0.6 gets
//                            no hot core: it blooms instead.
//   SNAP.sharp(t, k)         A blur or shadow of k that starts at 0 and reaches k after 0.15 s: crisp first, soft later.
//   SNAP.launch(t, dist, tau) How far a mark has travelled toward dist: full speed at once, then slowing (a hammer,
//                            not a bow). tau defaults to 0.08 s.
//   SNAP.rolls(chords)       A Map from chord index to 'member' or 'top' for the rolled chords in an array such as
//                            CHORDS. Cached per array, so asking in every onChord is cheap.
//   SNAP.PRESETS, SNAP.TOUCH The four articulations, and their order on the touch knob.
//   SNAP.peak, gain, core, flash, hb  The pieces env is made of, for a widget that draws its parts apart.
var SNAP = SNAP || {};
(function (S) {
  var H = 0.033;          // the peak holds two 60 Hz steps (Bloch's law; and 30 fps videos made from 60 Hz steps)
  var HF = 0.06;          // the flash halves every 60 ms: it is the attack, not the note
  var FADE = 0.88;        // what the shared canvas keeps of a pixel each step
  var BONE = [236, 226, 208];  // the hot colour, never pure white

  // Fixed numbers: a stored preset must mean the same thing next year. hb0 is the body's half-life at middle C,
  // L when the mark is gone; both are stretched by ring. o is how far a loud note's size rings.
  // What counts is the screen, not the paper: hb0 was tuned until a note (v 127, middle C, 60 Hz steps through the
  // fade and the burn, 8-bit) meets the design's on-screen times, half = first step at half the peak, gone = last
  // step above 5 % of it. Marcato (design 0.15), piano (0.25) and bell (0.45) are not typos.
  S.PRESETS = {
    staccato: { wf: 1, wb: 0.15, wt: 0, hb0: 0.08, L: 0.35, o: 0.10 },  // half 0.117 s, gone 0.30 s
    marcato: { wf: 1, wb: 0.35, wt: 0, hb0: 0.5, L: 0.6, o: 0.25 },     // half 0.133 s, gone 0.50 s
    piano: { wf: 1, wb: 0.6, wt: 0.25, hb0: 0.21, L: 2.5, o: 0.15 },    // half 0.133 s, ember to 0.78 s
    bell: { wf: 0.7, wb: 0.6, wt: 0.4, hb0: 0.75, L: 6, o: 0.08 }       // half 0.300 s; it rings to the cut at 6 s
  };
  S.TOUCH = ['staccato', 'marcato', 'piano', 'bell'];
  S.H = H;
  S.BONE = BONE;

  function preset(p) {
    if (p && typeof p === 'object') return p;
    if (typeof p === 'number') return S.PRESETS[S.TOUCH[Math.max(0, Math.min(3, Math.round(p)))]];
    return S.PRESETS[p] || S.PRESETS.piano;
  }
  S.preset = preset;

  function smoothstep(a, b, x) {
    var u = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return u * u * (3 - 2 * u);
  }

  // The peak. v is the velocity the widget hears: on picks it already carries the intensity (v times a, clipped at
  // 127, by note-values.ts), so a is not applied twice. The floor keeps a soft note visible, higher on picks.
  S.peak = function (v, picks) {
    var floor = picks ? 0.35 : 0.12;
    var u = Math.max(0, Math.min(1, (v || 0) / 127));
    return floor + (1 - floor) * Math.pow(u, 1.5);
  };
  // Intensity above 1 cracks harder (the velocity stops at 127, the intensity does not); below 0.6 there is no core.
  S.gain = function (a) { return a > 1 ? 1 + 0.8 * (a - 1) : 1; };
  S.core = function (a) { return a < 0.6 ? 0 : 1; };
  S.flash = function (t) { return t < 0 ? 0 : t < H ? 1 : Math.pow(0.5, (t - H) / HF); };
  // The body's half-life by register: a bass string rings longer than a treble one, twice as long two octaves down.
  S.hb = function (m, p, ring) { return preset(p).hb0 * (ring || 1) * Math.pow(2, (60 - m) / 24); };

  S.env = function (t, n, o) {
    o = o || {};
    var p = preset(o.preset), ring = o.ring || 1, L = p.L * ring;
    var a = n.a == null ? 1 : n.a, P = S.peak(n.v, o.picks);
    if (!(t >= 0) || t >= L) return { E: 0, flash: 0, body: 0, P: P, L: L };
    var hb = S.hb(n.m, p, ring), g = S.gain(a), f = S.flash(t), b = Math.pow(0.5, t / hb);
    var tail = p.wt ? Math.pow(0.5, t / (8 * hb)) : 0;
    var E = P * (p.wf * g * f + p.wb * b + p.wt * tail) / (p.wf * g + p.wb + p.wt);
    E *= 1 - smoothstep(L - 0.1, L, t);
    // The damper: only a note written really short, below the top strings that have no damper, is cut early.
    // The pedal makes every other written length meaningless.
    var d = n.d == null ? Infinity : n.d;
    if (d < 0.15 && n.m < 89 && t > d) E *= Math.pow(0.5, (t - d) / 0.06);
    return { E: E, flash: f, body: b, P: P, L: L };
  };

  // The exact one-step inverse of the canvas fade, from Tprev (faded by one step) to T.
  S.alpha = function (T, Tprev) {
    T = Math.max(0, Math.min(0.98, T || 0));
    var q = FADE * Math.max(0, Math.min(0.98, Tprev || 0));
    return Math.max(0, Math.min(1, (T - q) / (1 - q)));
  };
  S.settles = function (E) {
    E = Math.max(0, Math.min(0.98, E || 0));
    return (1 - FADE) * E / (1 - FADE * E);
  };

  S.size = function (t, v, o) {
    if (!(t >= 0)) return 1;
    o = o || {};
    var amp = o.o != null ? o.o : preset(o.preset).o;
    return 1 + amp * Math.max(0, ((v || 0) / 127 - 0.55) / 0.45) * Math.exp(-t / 0.07) * Math.cos(2 * Math.PI * 8 * t);
  };
  S.hot = function (rgb, t, a) {
    var k = 0.55 * S.core(a == null ? 1 : a) * S.flash(t);
    return [0, 1, 2].map(function (i) { return Math.round(rgb[i] + (BONE[i] - rgb[i]) * k); });
  };
  S.sharp = function (t, k) { return t > 0 ? k * Math.min(1, t / 0.15) : 0; };
  S.launch = function (t, dist, tau) { return t > 0 ? dist * (1 - Math.exp(-t / (tau || 0.08))) : 0; };

  // A roll: 3 to 6 attacks 40 to 120 ms apart, their top notes moving one way, all within half a second. It is one
  // gesture, so only its highest note strikes and the others tick.
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null;
  S.rolls = function (chords) {
    var seen = cache && cache.get(chords);
    if (seen && seen.n === chords.length) return seen.map;
    var map = new Map(), i = 0, N = chords.length;
    while (i < N) {
      var j = i, dir = 0;
      while (j + 1 < N && j + 1 - i < 6) {
        var gap = chords[j + 1].t - chords[j].t, step = chords[j + 1].hi - chords[j].hi;
        var s = step > 0 ? 1 : step < 0 ? -1 : 0;
        if (gap < 0.04 || gap > 0.12 || chords[j + 1].t - chords[i].t > 0.5 || !s || (dir && s !== dir)) break;
        dir = s; j++;
      }
      if (j - i >= 2) {
        var top = i;
        for (var k = i; k <= j; k++) { map.set(k, 'member'); if (chords[k].hi > chords[top].hi) top = k; }
        map.set(top, 'top');
        i = j + 1;
      } else i++;
    }
    if (cache) cache.set(chords, { n: N, map: map });
    return map;
  };
})(SNAP);
// SNAP v1 end

  // A real target colour, drawn with lighten at alpha 1 (SYNTHESIS rule 1). k is the envelope: 1 at the peak, falling to 0.
  const tone = (g, rgb, k = 1) => {
    g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
  };

  const W = 1280, H = 720, D2R = Math.PI / 180, TAN20 = Math.tan(20 * D2R), SIN25 = Math.sin(25 * D2R);
  const HOLD = [92, 14, 16];                // the dim red body, a real colour (live channel well above the burn)
  const HM = [0, 0.75, 1, 1];               // how much of the hold each articulation keeps
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  // The only randomness: seeded by pitch, so a seek redraws the same thorn.
  const hash = (m) => { let t = Math.imul((m + 0x9E3779B9) | 0, 0x85EBCA6B); t ^= t >>> 13; t = Math.imul(t, 0xC2B2AE35); t ^= t >>> 16; return (t >>> 0) / 4294967296; };

  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };

  // The clip's own statistics, cached on the array and its length (the lab may grow CHORDS).
  let statCache = null;
  const stats = (cs) => {
    if (statCache && statCache.cs === cs && statCache.len === cs.length) return statCache;
    let lo = Infinity, hi = -Infinity; const vs = [];
    for (const c of cs) { if (c.lo < lo) lo = c.lo; if (c.hi > hi) hi = c.hi; for (const n of c.notes) vs.push(n.v); }
    vs.sort((a, b) => a - b);
    const N = vs.length;
    statCache = { cs, len: cs.length, lo, hi, mid: (lo + hi) / 2, span: Math.max(12, hi - lo), N,
      p10: N ? vs[Math.floor(0.1 * (N - 1))] : 0, p90: N ? vs[Math.floor(0.9 * (N - 1))] : 1 };
    return statCache;
  };
  const uvOf = (v, st) => (st.N < 2 || st.p90 - st.p10 < 1) ? 0.5 : clamp((v - st.p10) / (st.p90 - st.p10), 0, 1);
  const pyOf = (m, st) => H * (0.86 - 0.72 * clamp((m - st.mid) / st.span + 0.5, 0, 1));

  const sideOf = (i) => (i % 2 === 0 ? 1 : -1);   // +1: base on the left edge, pointing right
  const isRepeat = (cs, i) => i > 0 && cs[i].t - cs[i - 1].t < 0.5 && cs[i].hi === cs[i - 1].hi;
  // The notes drawn: by pitch descending, at most 8 spread over the whole voicing.
  const kept = (c) => {
    const ns = c.notes.slice().sort((a, b) => b.m - a.m);
    if (ns.length <= 8) return ns;
    const out = []; for (let k = 0; k < 8; k++) out.push(ns[Math.round(k * (ns.length - 1) / 7)]);
    return out;
  };
  // Where the tips go. A repeat stabs the spot of the chord it repeats.
  const spotOf = (cs, i, st, depth) => {
    if (depth < 64 && isRepeat(cs, i)) return spotOf(cs, i - 1, st, depth + 1);
    const ns = kept(cs[i]), n = ns.length, s = sideOf(i);
    if (n === 1) {
      const r = (0.35 + 0.5 * uvOf(ns[0].v, st)) * W;
      return { x: s > 0 ? r : W - r, y: pyOf(ns[0].m, st) };
    }
    let mu = 0, my = 0; for (const nt of ns) { mu += uvOf(nt.v, st); my += pyOf(nt.m, st); }
    const r = (0.35 + 0.3 * mu / n) * W;
    return { x: s > 0 ? r : W - r, y: my / n };
  };

  // The waist control, piecewise in the waist knob: [ca (along the axis, of len), co (across, of b)].
  const waistCtl = (w) => {
    if (w <= 0.85) { const q = w / 0.85; return [0.5 + 0.22 * q, 0.5 - 0.4889 * q]; }
    const q = (w - 0.85) / 0.15; return [0.72 + 0.06 * q, 0.0111 * (1 - q)];
  };

  // Every thorn of chord i, whole: geometry only (colour is the frame's business).
  const build = (cs, i, st, K) => {
    const c = cs[i], ns = kept(c), n = ns.length, si = sideOf(i), rep = isRepeat(cs, i);
    const gap = i + 1 < cs.length ? cs[i + 1].t - c.t : Infinity;
    const b = 180 * K.broad * clamp(gap / 0.5, 0.08, 1) * clamp(1.5 / Math.sqrt(n), 0.5, 1);
    const P = spotOf(cs, i, st, 0);
    let prevUv = 0; if (rep) for (const nt of cs[i - 1].notes) prevUv = Math.max(prevUv, uvOf(nt.v, st));
    const th = ns.map((nt, k) => {
      const s = si * (k % 2 === 0 ? 1 : -1);
      return { nt, k, s, b, uv: rep ? Math.max(uvOf(nt.v, st), prevUv) : uvOf(nt.v, st), Bx: s > 0 ? -(16 + b * SIN25) : W + 16 + b * SIN25, By: 0, T: P };
    });
    const place = (t, T) => {
      const dx = Math.abs(T.x - t.Bx);
      t.T = T;
      t.By = n === 1
        ? clamp(pyOf(t.nt.m, st) + (hash(t.nt.m) - 0.5) * 2 * TAN20 * dx, 0.1 * H, 0.9 * H)
        : clamp(clamp(pyOf(t.nt.m, st), T.y - TAN20 * dx, T.y + TAN20 * dx), 0.1 * H, 0.9 * H);
    };
    for (const t of th) place(t, P);
    if (n > 1) {
      for (const s of [1, -1]) {
        const grp = th.filter((t) => t.s === s).sort((a, b2) => a.By - b2.By), ms = grp.length;
        grp.forEach((t, j) => {
          const dx = P.x - t.Bx, dy = P.y - t.By, d = Math.hypot(dx, dy) || 1, ax = dx / d, ay = dy / d;
          const o = 6 * (j - (ms - 1) / 2);
          place(t, { x: P.x - 3 * ax + o * -ay, y: P.y - 3 * ay + o * ax });
        });
      }
    }
    // The base stays at its pitch place but never reaches past the top or bottom edge: thorns come from the sides only.
    for (const t of th) t.b = Math.max(6, Math.min(t.b, 0.8 * t.By, 0.8 * (H - t.By)));
    const [ca, cof] = waistCtl(K.waist), ang = K.hook * 24 * D2R;
    const kap = Math.hypot(0.8 + 0.2 * Math.cos(ang), 0.2 * Math.sin(ang)), phi = Math.atan2(0.2 * Math.sin(ang), 0.8 + 0.2 * Math.cos(ang));
    for (const t of th) {
      const dx = t.T.x - t.Bx, dy = t.T.y - t.By, dist = Math.hypot(dx, dy) || 1, len = dist / kap;
      const ax = dx / dist, ay = dy / dist;
      let dxn = -ay, dyn = ax; if (dyn < 0) { dxn = -dxn; dyn = -dyn; }   // the hook bends toward the bottom on both sides
      const cp = Math.cos(phi), sp = Math.sin(phi);
      t.Ax = ax * cp - dxn * sp; t.Ay = ay * cp - dyn * sp;
      t.Dx = dxn * cp + ax * sp; t.Dy = dyn * cp + ay * sp;
      t.Cx = ax; t.Cy = ay;   // the base-to-tip chord: a withdrawing thorn slides back along it, so it never leaves the band between its base and its tip
      t.len = len; t.ca = ca * len; t.co = cof * t.b;
      t.hx = len * (0.8 + 0.2 * Math.cos(ang)); t.hy = len * 0.2 * Math.sin(ang);
      // Where the last 30 % of the axis begins on each side (the bone tip).
      const A2 = t.hx - 2 * t.ca, B2 = 2 * t.ca, C2 = -0.7 * len;
      const s0 = Math.abs(A2) < 1e-9 ? -C2 / B2 : (-B2 + Math.sqrt(Math.max(0, B2 * B2 - 4 * A2 * C2))) / (2 * A2);
      t.s0 = clamp(s0, 0, 1);
    }
    return th;
  };

  // The world point of a local (lx along the axis, ly across it), the whole thorn shifted back by sh along its base-to-tip chord.
  const wx = (t, lx, ly, sh) => t.Bx + lx * t.Ax + ly * t.Dx - sh * t.Cx;
  const wy = (t, lx, ly, sh) => t.By + lx * t.Ay + ly * t.Dy - sh * t.Cy;
  const body = (g, t, sh) => {
    g.beginPath();
    g.moveTo(wx(t, 0, -t.b, sh), wy(t, 0, -t.b, sh));
    g.quadraticCurveTo(wx(t, t.ca, -t.co, sh), wy(t, t.ca, -t.co, sh), wx(t, t.hx, t.hy, sh), wy(t, t.hx, t.hy, sh));
    g.quadraticCurveTo(wx(t, t.ca, t.co, sh), wy(t, t.ca, t.co, sh), wx(t, 0, t.b, sh), wy(t, 0, t.b, sh));
    g.closePath(); g.fill();
  };
  // The bone tip: each side split at s0, the right-hand pieces joined at the tip.
  const bone = (g, t) => {
    const s = t.s0, u = 1 - s;
    const q0x = 2 * u * s * t.ca + s * s * t.hx, q1x = u * t.ca + s * t.hx;
    const q0u = u * u * -t.b + 2 * u * s * -t.co + s * s * t.hy, q1u = u * -t.co + s * t.hy;   // upper side
    const q0l = u * u * t.b + 2 * u * s * t.co + s * s * t.hy, q1l = u * t.co + s * t.hy;      // lower side
    g.beginPath();
    g.moveTo(wx(t, q0x, q0u, 0), wy(t, q0x, q0u, 0));
    g.quadraticCurveTo(wx(t, q1x, q1u, 0), wy(t, q1x, q1u, 0), wx(t, t.hx, t.hy, 0), wy(t, t.hx, t.hy, 0));
    g.quadraticCurveTo(wx(t, q1x, q1l, 0), wy(t, q1x, q1l, 0), wx(t, q0x, q0l, 0), wy(t, q0x, q0l, 0));
    g.closePath(); g.fill();
  };

  // The icon thorn: the same profile maths in a small box.
  const thornIcon = (g, w, h, waistV, hb, len, hookV) => {
    const [ca, cof] = waistCtl(waistV), co = hb * cof, ang = hookV * 24 * D2R;
    const x0 = 2, y0 = h / 2, hx = len * (0.8 + 0.2 * Math.cos(ang)), hy = len * 0.2 * Math.sin(ang);
    g.fillStyle = ICON.red; g.beginPath();
    g.moveTo(x0, y0 - hb); g.quadraticCurveTo(x0 + ca * len, y0 - co, x0 + hx, y0 + hy);
    g.quadraticCurveTo(x0 + ca * len, y0 + co, x0, y0 + hb); g.closePath(); g.fill();
  };

  TOOLS.push({
    id: 'prickle', name: 'Prickle', tag: 'new', on: false,
    blurb: 'One huge flat thorn per note, from the left or the right edge, its sides curving in to a hairline tip. Struck red with a bone tip, it holds still in dim red and withdraws straight back as the next note comes from the other side. A chord stabs one spot from both sides; a fast run is a volley of needles.',
    params: [
      { key: 'waist', label: 'how thin the waist', min: 0, max: 1, value: 0.85,
        hint: 'How the sides of a thorn curve in. Left: a straight-sided wedge. Right: a slim waist and a long hairline tip.',
        icon: (g, v, w, h) => thornIcon(g, w, h, v, 9, 34, 0.5) },
      { key: 'broad', label: 'how broad the base', min: 0.3, max: 1.5, value: 1, less: 0.6,
        hint: 'How wide a thorn is where it leaves the edge. Left: all needles. Right: slabs that fill a quarter of the frame.',
        icon: (g, v, w, h) => thornIcon(g, w, h, 0.85, 2 + v * 10, 34, 0.5) },
      { key: 'hook', label: 'how bent the tip', min: 0, max: 1, value: 0.5,
        hint: 'How much the last stretch of a thorn bends down. Left: dead straight. Right: a claw.',
        icon: (g, v, w, h) => thornIcon(g, w, h, 0.85, 9, 34, v) },
      { key: 'goneBy', label: 'gone by', min: 0.3, max: 2.5, value: 1.2, less: 0.3,
        hint: 'How long a thorn may stay when no next note comes. Left: a thorn never lasts a third of a second. Right: a lone note may stay two and a half seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red) },
      { key: 'touch', label: 'articulation', min: 0, max: 3, step: 1, value: 2,
        hint: 'How a note is played: staccato, marcato, piano, bell. Left: here and gone, with no dim body. Right: a bright strike that glows longer before the dim red holds.',
        icon: (g, v, w, h) => {
          const k = Math.round(v * 3), hl = [0.05, 0.1, 0.12, 0.22][k], tail = [0, 0, 0.22, 0.38][k], end = [0.35, 0.55, 1, 1][k];
          g.strokeStyle = ICON.red; g.lineWidth = 1.5; g.beginPath(); g.moveTo(4, h - 3); g.lineTo(4, 3);
          for (let px = 5; px <= w - 3; px++) {
            const u = (px - 4) / (w - 7), e = u > end ? 0 : (1 - tail) * Math.pow(0.5, u / hl) + tail * Math.pow(0.5, u / (hl * 7));
            g.lineTo(px, h - 3 - (h - 6) * e);
          }
          g.stroke();
        } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much each note leaves: how broad its thorn is and how long it may stay. Left: thin thorns, soon gone. Right: broad thorns that may stay. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() {},
    onChord() {},   // stateless: frame finds the chord itself from CHORDS and x.t
    frame(x) {
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i = chordAt(cs, x.t); if (i < 0) return;
      const K = { broad: x.p('broad'), waist: x.p('waist'), hook: x.p('hook') };
      const touch = clamp(Math.round(x.p('touch')), 0, 3), goneBy = x.p('goneBy');
      const st = stats(cs), g = x.g, preset = SNAP.PRESETS[SNAP.TOUCH[touch]];
      const life = Math.min(goneBy, preset.L), fl = Math.min(0.25, 0.5 * life);
      const kl = (a) => 1 - smooth(life - fl, life, a);
      const colour = (t, age, kAge) => {
        const f = touch === 3 ? SNAP.flash(age / 2) : SNAP.flash(age), k = HM[touch] * kl(kAge);
        const amt = t.nt.amount == null ? 1 : t.nt.amount, gain = SNAP.gain(amt);
        const strike = [Math.min(255, Math.round((170 + 58 * t.uv) * gain)), 20, 24];
        return [0, 1, 2].map((c) => Math.round(HOLD[c] * k + (strike[c] - HOLD[c] * k) * f));
      };
      g.save();
      // Withdrawing thorns, oldest first: each goes straight back along its axis as the next note lands.
      for (let j = Math.max(0, i - 3); j < i; j++) {
        const tw = x.t - cs[j + 1].t, tn = cs[j + 1].t - cs[j].t;
        if (tw >= 0.13 || tn >= life) continue;
        const age = x.t - cs[j].t;
        for (const t of build(cs, j, st, K)) {
          const sh = SNAP.launch(tw, 1.25 * t.len, 0.08); if (sh >= t.len) continue;
          const c = colour(t, age, tn); if (!(c[0] | c[1] | c[2])) continue;
          tone(g, c); body(g, t, sh);
        }
      }
      // The current chord: whole, frozen, only its colour steps.
      const age = x.t - cs[i].t;
      if (age < life) {
        const th = build(cs, i, st, K);
        for (let k = th.length - 1; k >= 0; k--) {
          const c = colour(th[k], age, age); if (!(c[0] | c[1] | c[2])) continue;
          tone(g, c); body(g, th[k], 0);
        }
        const top = th[0], amt = top.nt.amount == null ? 1 : top.nt.amount;
        if (SNAP.core(amt) === 1 && age < (touch === 3 ? 4 : 2) * x.dt - 1e-6) { tone(g, SNAP.BONE); bone(g, top); }
      }
      g.restore();
    },
  });
})();
