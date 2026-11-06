// Mica: each pitch owns a fixed scatter of thin needle-pointed shards, all lying at one angle (pitch class x 15 deg).
// A note flashes its whole set silver in one step and lets it sink to cold violet; nothing ever moves.
// Drawn statelessly from CHORDS (docs/mockups/nature/plans/mica.md).
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

  const deg = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };
  const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const tone = (g, rgb, k = 1) => {                       // k is the envelope: 1 at the peak, falling to 0
    g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
  };

  const MICA = { wf: 1, wb: 0.5, wt: 0, hb0: 0.16, L: 0.5, o: 0 };
  const PAL = [
    { strike: [222, 226, 238], body: [96, 90, 112] },    // silver over cold violet
    { strike: [236, 226, 208], body: [128, 82, 86] },    // bone over feldspar rose
    { strike: [236, 196, 110], body: [116, 76, 40] },    // pyrite gold over umber
  ];
  const BUDGET = 55296;   // 6 % of the frame: the bone budget (P12)

  // Per-pitch table, a pure function of the pitch: 34 clumps, 400 shards, drawn in a fixed order.
  let tables = new Map(), paths = new Map(), vcache = null;
  const table = (m) => {
    let T = tables.get(m); if (T) return T;
    const R = rng(m * 7919 + 4111);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R());
    T = { cu: new Float64Array(34), cz: new Float64Array(34), gx: new Float64Array(400), gy: new Float64Array(400), su: new Float64Array(400) };
    for (let c = 0; c < 34; c++) { T.cu[c] = R(); T.cz[c] = gauss(); }
    for (let i = 0; i < 400; i++) { T.gx[i] = gauss(); T.gy[i] = gauss(); T.su[i] = R(); }
    tables.set(m, T); return T;
  };
  const fold = (y) => clamp(y < 16 ? 32 - y : y > 704 ? 1408 - y : y, 16, 704);

  // The four prefix paths of one pitch at these knob values: the biggest shards first.
  const pathsFor = (m, N, SP, S) => {
    const key = `${m}|${N}|${SP}|${S}`;
    let P = paths.get(key); if (P) return P;
    if (paths.size > 300) paths.clear();
    const T = table(m);
    const yP = 660 - 600 * (clamp(m, 21, 108) - 21) / 87;
    const th = (m % 12) * 15 * deg, dx = Math.cos(th), dy = Math.sin(th), nx = -dy, ny = dx;
    const sh = [];
    for (let i = 0; i < N; i++) {
      const c = Math.floor(i / 12);
      const cx = 40 + 1200 * T.cu[c] + 16 * T.gx[i];
      const cy = fold(yP + SP * T.cz[c] + 16 * T.gy[i]);
      const L = 10 * Math.pow(S / 10, Math.pow(T.su[i], 3));
      sh.push({ i, cx, cy, L, w: Math.max(1.5, L / 6.5) });
    }
    sh.sort((a, b) => b.L - a.L || a.i - b.i);
    const build = (n) => {
      const p = new Path2D(); let area = 0;
      for (let k = 0; k < n; k++) {
        const s = sh[k], hl = s.L / 2, hw = s.w / 2;
        p.moveTo(s.cx + dx * hl, s.cy + dy * hl);
        p.lineTo(s.cx + nx * hw, s.cy + ny * hw);
        p.lineTo(s.cx - dx * hl, s.cy - dy * hl);
        p.lineTo(s.cx - nx * hw, s.cy - ny * hw);
        p.closePath();
        area += s.L * s.w / 2;
      }
      return { path: p, area };
    };
    P = { big: build(Math.ceil(0.3 * N)), p40: build(Math.ceil(0.4 * N)), p70: build(Math.ceil(0.7 * N)), p100: build(N) };
    paths.set(key, P); return P;
  };

  // The clip's own p10 and p90 velocity, once per CHORDS array.
  const vrange = (cs) => {
    if (vcache && vcache.cs === cs && vcache.n === cs.length) return vcache;
    const vs = [];
    for (const c of cs) for (const n of c.notes) vs.push(n.v);
    vs.sort((a, b) => a - b);
    const n = vs.length;
    vcache = { cs, n: cs.length, p10: n ? vs[Math.floor(0.1 * (n - 1))] : 0, p90: n ? vs[Math.floor(0.9 * (n - 1))] : 0 };
    return vcache;
  };

  TOOLS.push({
    id: 'mica', name: 'Mica', tag: 'new',
    blurb: 'Granite in low sun. Each pitch owns a fixed scatter of thin shards, all lying at one angle (pitch class × 15°: an octave is parallel, a semitone 15° off). A note flashes its whole set silver in one step and lets it sink to violet. Nothing ever moves; a repeat is the same constellation again.',
    params: [
      { key: 'flecks', label: 'how many flakes', min: 40, max: 400, step: 1, value: 192, less: 48,
        hint: 'How many flakes each note owns. Left: a few big shards. Right: the frame is thick with glitter.',
        icon: (g, v, w, h) => { const r = ICON.rng(11), n = 3 + Math.round(v * 22), a = 30 * deg; for (let k = 0; k < n; k++) { const l = (3 + r() * 6) / 2, cx = 4 + r() * (w - 8), cy = 4 + r() * (h - 8); ICON.line(g, cx - Math.cos(a) * l, cy - Math.sin(a) * l, cx + Math.cos(a) * l, cy + Math.sin(a) * l); } } },
      { key: 'spread', label: 'how far from its height', min: 40, max: 400, step: 1, value: 120,
        hint: "How far a note's flakes scatter from the height of its pitch. Left: a note glints in a band at its pitch. Right: it glints all over the frame.",
        icon: (g, v, w, h) => { const r = ICON.rng(12), a = 30 * deg, l = 3; for (let k = 0; k < 10; k++) { const cx = 3 + (w - 6) * (k + 0.5) / 10, cy = 13 + (r() - 0.5) * (2 + v * 20); ICON.line(g, cx - Math.cos(a) * l, cy - Math.sin(a) * l, cx + Math.cos(a) * l, cy + Math.sin(a) * l); } } },
      { key: 'size', label: 'how big the biggest flake', min: 16, max: 90, step: 1, value: 56,
        hint: 'How long the biggest flake is. Left: fine sparkle. Right: real splinters you could cut on.',
        icon: (g, v, w, h) => { const L = 6 + v * 28, hw = L / 6.5 / 2, a = 30 * deg, dx = Math.cos(a) * L / 2, dy = Math.sin(a) * L / 2, nx = -Math.sin(a) * hw, ny = Math.cos(a) * hw, cx = w / 2, cy = h / 2; g.fillStyle = ICON.ink; g.beginPath(); g.moveTo(cx + dx, cy + dy); g.lineTo(cx + nx, cy + ny); g.lineTo(cx - dx, cy - dy); g.lineTo(cx - nx, cy - ny); g.closePath(); g.fill(); } },
      { key: 'ring', label: 'how long it stays', min: 0.25, max: 3, value: 1, less: 0.5,
        hint: 'How long the flakes stay after the glint. Left: a glint and gone. Right: they stay as a dim ash for over a second.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.violet) },
      { key: 'colour', label: 'which mineral', min: 0, max: 2, step: 1, value: 0,
        hint: 'Which stone. Left: silver over cold violet. Middle: bone over feldspar rose. Right: pyrite gold over umber.',
        icon: (g, v, w, h) => { const p = PAL[Math.round(v * 2)], css = (c) => `rgb(${c.join(',')})`; ICON.palette(g, [css(p.strike), css(p.body)], w, h); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much you see: how many flakes each note lights and how long they stay. Left: a few big shards, quickly gone. Right: the whole stone. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { tables = new Map(); paths = new Map(); vcache = null; },
    onChord() {},   // stateless: frame finds every live set itself from CHORDS
    frame(x) {
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i = chordAt(cs, x.t); if (i < 0) return;
      const N = Math.round(x.p('flecks')), SP = Math.round(x.p('spread')), S = Math.round(x.p('size'));
      const ring = x.p('ring'), pal = PAL[clamp(Math.round(x.p('colour')), 0, 2)], Lmax = MICA.L * ring;
      const picks = !!x.picked, vr = vrange(cs), span = vr.p90 - vr.p10;
      const inst = [];
      for (let j = i; j >= 0 && x.t - cs[j].t < Lmax && inst.length < 400; j--) {
        const t = x.t - cs[j].t, mine = [];
        let area = 0;
        for (const n of cs[j].notes) {
          const a = n.amount == null ? 1 : n.amount;
          const e = SNAP.env(t, { v: n.v, m: n.m, d: n.d, a: n.amount }, { preset: MICA, ring, picks });
          if (!(e.E > 0)) continue;
          const u = span < 1 ? 1 : clamp((n.v - vr.p10) / span, 0, 1);
          const P = pathsFor(n.m, N, SP, S);
          const pre = u < 1 / 3 ? P.p40 : u < 2 / 3 ? P.p70 : P.p100;
          const G = SNAP.gain(a);
          const F = Math.min(1, e.flash * G) * SNAP.core(a);
          const K = Math.min(1, (e.E / e.P) * (G + 0.5) / 0.5);
          const rgb = [0, 1, 2].map((c) => Math.round((pal.body[c] + (pal.strike[c] - pal.body[c]) * F) * K));
          const dim = [0, 1, 2].map((c) => Math.round(pal.body[c] * K));
          const bright = Math.max(rgb[0], rgb[1], rgb[2]);
          area += pre.area;
          if (bright < 6) continue;   // already at the 8-bit floor: invisible, so never counted against the cap
          mine.push({ t, pre, big: P.big, rgb, dim, bright });
        }
        // Crowding is the chord's own, for its whole life, so the split never changes mid-flash (no second strike):
        // a crowded chord's small shards stay at the body colour and only the biggest 30 % carry the silver.
        const crowded = cs[j].notes.length > 4 || area > BUDGET;
        for (const m of mine) { m.crowded = crowded; inst.push(m); }
      }
      if (!inst.length) return;
      if (inst.length > 64) { inst.sort((p, q) => q.bright - p.bright || p.t - q.t); inst.length = 64; inst.sort((p, q) => q.t - p.t); }
      const g = x.g;
      g.save();
      for (let k = inst.length - 1; k >= 0; k--) {   // oldest first
        const s = inst[k];
        if (s.crowded) {
          tone(g, s.dim); g.fill(s.pre.path);
          if (s.rgb[0] !== s.dim[0] || s.rgb[1] !== s.dim[1] || s.rgb[2] !== s.dim[2]) { tone(g, s.rgb); g.fill(s.big.path); }
        } else { tone(g, s.rgb); g.fill(s.pre.path); }
      }
      g.restore();
    },
  });
})();
