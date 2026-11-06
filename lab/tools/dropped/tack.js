// Tack: one dark-red slab per note, torn open along a tilted seam on its attack step, the gap full of bone fibres that
// snap in no order within a tenth of a second. Drawn statelessly from CHORDS (docs/mockups/nature/plans/tack.md).
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

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smoothstep = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const d2r = Math.PI / 180;
  const hash = (a, b = 0) => { let t = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul(b | 0, 0x85EBCA77)) + 0x6D2B79F5 | 0;
    t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const TAB = new Float32Array(256); for (let k = 0; k < 256; k++) TAB[k] = hash(k, 0x7ac);
  const tone = (g, rgb, k = 1) => { g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`; };

  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };

  // Velocity percentiles of the whole clip, cached per array and length (the lab fills CHORDS after load).
  let vcache = null, vcs = null;
  const vrange = (cs) => {
    if (vcache && vcs === cs && vcache.n === cs.length) return vcache;
    const vs = [];
    for (const c of cs) for (const n of c.notes) vs.push(n.v);
    vs.sort((a, b) => a - b);
    const N = vs.length;
    vcache = { n: cs.length, N, p10: N ? vs[Math.floor(0.1 * (N - 1))] : 0, p90: N ? vs[Math.floor(0.9 * (N - 1))] : 0 };
    vcs = cs;
    return vcache;
  };

  // The gap between the halves at age t (times G is applied by the caller).
  const gapAt = (t, G) => {
    const tc = Math.min(t, 0.3);
    const R = tc < 0.08 ? 0 : 1 - Math.exp(-(tc - 0.08) / 0.04) * Math.cos(2 * Math.PI * 5 * (tc - 0.08));
    return G * ((1 - 0.6 * Math.exp(-tc / 0.07)) - 0.15 * R);
  };

  const HOLD = [96, 16, 18], BONE = SNAP.BONE;

  TOOLS.push({
    id: 'tack', name: 'Tack', tag: 'new', on: false,
    blurb: 'One dark-red slab per note, torn open along a tilted seam on the attack, its gap full of bone fibres that snap in no order within a tenth of a second and leave a brief nap of spikes on both faces. A repeated note shuts the slab and tears it again. Pitch is the place; how hard a note is played is how far it tears.',
    params: [
      { key: 'pull', label: 'how far it tears', min: 0.4, max: 2, value: 1, less: 0.6,
        hint: 'How far a note tears its slab open. Left: a crack with short fibres. Right: a wide gap with long ones.',
        icon: (g, v, w, h) => { const gap = 3 + v * 12, bh = (h - gap) / 2 - 1; ICON.rect(g, 4, 1, w - 8, bh, ICON.red); ICON.rect(g, 4, h - 1 - bh, w - 8, bh, ICON.red); for (let i = 0; i < 6; i++) ICON.line(g, 9 + i * 4.4, 1 + bh, 9 + i * 4.4, h - 1 - bh, ICON.ink, 1); } },
      { key: 'comb', label: 'how many fibres', min: 0.7, max: 3.3, value: 2, less: 1,
        hint: 'How many fibres hold the two halves together. Left: a few separate strings. Right: a dense pelt.',
        icon: (g, v, w, h) => ICON.lines(g, Math.round(3 + v * 12), w, h, { dir: 'v', col: ICON.ink }) },
      { key: 'tack', label: 'how sticky', min: 0.02, max: 0.35, value: 0.22,
        hint: 'How sticky the slab is. Left: the fibres all let go at once, a clean tear. Right: they hold and snap one after another, in no order.',
        icon: (g, v, w, h) => { const r = ICON.rng(3); for (let i = 0; i < 7; i++) { const lx = 6 + i * 4.6, yb = h / 2 + (r() - 0.5) * v * (h - 10); ICON.line(g, lx, 2, lx, yb - 2, ICON.ink, 1); ICON.line(g, lx, yb + 2, lx, h - 2, ICON.ink, 1); } } },
      { key: 'stay', label: 'how long a slab stays', min: 0.3, max: 2.5, value: 1.2, less: 0.5,
        hint: 'How long a torn slab stays. Left: gone in a third of a second. Right: a slow ember for two and a half seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much you see: how far each note tears, how many fibres, how long a slab stays. Left: a narrow crack with a few strings, soon gone. Right: wide tears full of fibres that linger. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() {},
    onChord() {},   // stateless: frame finds everything from CHORDS and x.t
    frame(x) {
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i0 = chordAt(cs, x.t); if (i0 < 0) return;
      const g = x.g, W = x.W, H = x.H;
      const pull = x.p('pull'), comb = x.p('comb'), tackK = x.p('tack'), stay = x.p('stay');
      const vr = vrange(cs), picks = !!x.picked;
      const reach = Math.max(stay, 0.5);

      // Live slabs: the newest of each pitch. Fresh slabs (still showing fibres) are never cut for older ones; a chord of
      // more than the cap keeps its loudest notes.
      const CAP = 14, FRESH = 0.35;
      const cand = [], seen = new Set();
      for (let j = i0, back = 0; j >= 0 && back < 32; j--, back++) {
        const ch = cs[j], t = x.t - ch.t;
        if (!(t < reach)) break;
        const nn = ch.notes.length;
        for (const n of ch.notes) {
          if (seen.has(n.m)) continue;
          seen.add(n.m);
          if (t >= stay) continue;
          let u = (vr.N < 2 || vr.p90 - vr.p10 < 1) ? 0.6 : clamp((n.v - vr.p10) / (vr.p90 - vr.p10), 0, 1);
          if (picks) u = Math.max(u, 0.35);
          cand.push({ m: n.m, u, n: nn, ci: j, t });
        }
      }
      let slabs = cand;
      if (cand.length > CAP) {
        const fresh = cand.filter((c) => c.t < FRESH).sort((p, q) => q.u - p.u || p.m - q.m).slice(0, CAP);
        const old = cand.filter((c) => c.t >= FRESH).sort((p, q) => p.t - q.t);
        slabs = fresh.concat(old.slice(0, CAP - fresh.length));
      }
      if (!slabs.length) return;

      const groups = new Map();                    // slab colour -> quads
      const boneFull = [], bone2 = [], bone1 = [];  // polygons, each an array of [x, y]

      for (const s of slabs) {
        const { m, u, n, ci, t } = s;
        const oct = Math.floor(m / 12) - 1;
        const cx = (0.06 + 0.88 * x.pitch01(m)) * W;
        const cy = clamp(H * (0.84 - 0.68 * clamp((oct - 1) / 7, 0, 1)) - ((m % 12) - 5.5) * 3, 0.2 * H, 0.8 * H);
        const th = (hash(m, 911) * 2 - 1) * 12 * d2r, co = Math.cos(th), si = Math.sin(th);
        // A strip of tape, not a jaw: unequal halves, and the halves slide a little along the seam as they open.
        const w = (230 + 330 * u) / Math.sqrt(n);
        const hT = w * (0.09 + 0.05 * hash(m, 17)), hB = w * (0.2 + 0.08 * hash(m, 18));
        const G = (40 + 160 * Math.pow(u, 1.3)) * pull;
        const sh = gapAt(t, G) / 2;
        const sx = (hash(m, 19) < 0.5 ? -1 : 1) * 0.12 * sh * 2 / 2;   // half the slide: top -sx, bottom +sx
        const P = (lx, ly) => [cx + lx * co - ly * si, cy + lx * si + ly * co];

        // Slab colour: held red, struck brighter for the first steps, then falling to nothing at stay.
        const fl = SNAP.flash(t), STRIKE = [140 + 80 * u, 22, 24];
        const t0f = Math.min(0.2, 0.5 * stay);
        const D = t <= t0f ? 1 : Math.pow(0.5, (t - t0f) / (0.25 * (stay - t0f))) * (1 - smoothstep(0.8 * stay, stay, t));
        const rgb = [0, 1, 2].map((k) => Math.round((HOLD[k] + (STRIKE[k] - HOLD[k]) * fl) * D));
        if (rgb[0] + rgb[1] + rgb[2] > 0) {
          const key = rgb.join(',');
          let q = groups.get(key); if (!q) groups.set(key, q = []);
          q.push([P(-w / 2 - sx, -sh - hT), P(w / 2 - sx, -sh - hT), P(w / 2 - sx, -sh), P(-w / 2 - sx, -sh)]);
          q.push([P(-w / 2 + sx, sh), P(w / 2 + sx, sh), P(w / 2 + sx, sh + hB), P(-w / 2 + sx, sh + hB)]);
        }

        // Fibres: thin strings that never touch. Each snaps at its own hashed time and leaves a short stub on both faces.
        const meanW = 1.7, capNF = Math.max(1, Math.floor(0.02 * W * H / (Math.max(2 * sh, 6) * meanW)));
        let NF = Math.max(1, Math.min(Math.floor(w / (18 / comb)), capNF));
        const dsp = w / NF;
        const seed = Math.floor(hash(ci, m) * 256);
        for (let f = 0; f < NF; f++) {
          const snapU = TAB[(f + seed) & 255], jit = TAB[(f + seed + 85) & 255], resU = TAB[(f + seed + 170) & 255];
          const fx = -w / 2 + (f + 0.5) * dsp + (jit * 2 - 1) * Math.min(1.5, 0.2 * dsp);
          const tau = tackK * (0.2143 + 0.7857 * snapU);
          if (t < tau) {
            boneFull.push([P(fx - sx - 1.2, -sh), P(fx - 0.5, 0), P(fx + sx - 1.2, sh), P(fx + sx + 1.2, sh), P(fx + 0.5, 0), P(fx - sx + 1.2, -sh)]);
          } else {
            const Tend = Math.max(0.35, tau + 0.12);
            const Q = 1 - smoothstep(tau, Tend, t);
            if (Q <= 0.02) continue;
            // A hard notch: at the snap the stub is already short, so the edge is stubbled at once.
            const L = Math.min(4 + 12 * resU, 0.35 * gapAt(tau, G) / 2) * Q;
            const lvl = Math.ceil(Q * 3) / 3;
            const bucket = lvl >= 0.999 ? boneFull : lvl > 0.5 ? bone2 : bone1;
            bucket.push([P(fx - sx - 1.5, -sh), P(fx - sx, -sh + L), P(fx - sx + 1.5, -sh)]);
            bucket.push([P(fx + sx - 1.5, sh), P(fx + sx, sh - L), P(fx + sx + 1.5, sh)]);
          }
        }
      }

      const poly = (polys) => { g.beginPath(); for (const p of polys) { g.moveTo(p[0][0], p[0][1]); for (let k = 1; k < p.length; k++) g.lineTo(p[k][0], p[k][1]); g.closePath(); } };
      g.save();
      g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
      for (const [key, quads] of groups) { poly(quads); tone(g, key.split(',').map(Number)); g.fill(); }
      if (boneFull.length) { poly(boneFull); tone(g, BONE, 1); g.fill(); }
      if (bone2.length) { poly(bone2); tone(g, BONE, 2 / 3); g.fill(); }
      if (bone1.length) { poly(bone1); tone(g, BONE, 1 / 3); g.fill(); }
      g.restore();
    },
  });
})();
