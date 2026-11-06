// Interlock: each note fires a pair of straight full-height needles, one from above and one from below, that pass each other along the middle line. Stateless from CHORDS.
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

  // Which chord is sounding at song time t: the last one at or before it (a binary search; nothing remembered between frames).
  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };

  const SEAM = 360, CAP = 200, BASE = 400;   // base pinned 40 px beyond the edge: upper base y = -40, lower = 760
  const BODY = [90, 16, 18], HOT = [214, 58, 40], BONE_BUDGET = 55296;
  // Checks kept true at every setting: worst case b = 88 (width 2, u 1), corner x offset <= 66, sin 2.5deg = 0.0436, so a
  // corner's y is at most 360 - 400*cos a + 66*0.0436 = -36.7 (< 0), the lower ones at least 756.7 (> 720): full height always.
  // The pair never touches: the gap between upper right edge and lower left edge is (b/2)*(400-depth)/(400+depth) = b/6 > 0 at the cap.
  // Upper width at the seam is b*depth/(400+depth): it grows with depth, so a ratchet widens the needle by itself.
  const px = (m) => 40 + 1200 * (m - 21) / 87;
  const hash01 = (m) => { let h = Math.imul(m + 0x9e37, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rgb = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';

  // Cache keyed on the CHORDS array and its length: velocity percentiles and, per chord, pitch -> previous / next chord holding it.
  let cache = null;
  const prepare = (cs) => {
    if (cache && cache.cs === cs && cache.n === cs.length) return cache;
    const vs = [];
    for (const c of cs) for (const n of c.notes) vs.push(n.v);
    vs.sort((a, b) => a - b);
    const N = vs.length;
    const p10 = N ? vs[Math.floor(0.1 * (N - 1))] : 0, p90 = N ? vs[Math.floor(0.9 * (N - 1))] : 0;
    const prev = [], next = [], last = new Map();
    for (let j = 0; j < cs.length; j++) {
      const pm = new Map(), nm = new Map();
      for (const n of cs[j].notes) { if (pm.has(n.m)) continue; pm.set(n.m, last.has(n.m) ? last.get(n.m) : -1); }
      prev.push(pm); next.push(nm);
      for (const [m, pj] of pm) { last.set(m, j); if (pj >= 0) next[pj].set(m, j); }
    }
    cache = { cs, n: cs.length, N, p10, p90, prev, next };
    return cache;
  };
  const noteAt = (c, m) => { for (const n of c.notes) if (n.m === m) return n; return null; };

  TOOLS.push({
    id: 'interlock', name: 'Interlock', tag: 'new',
    blurb: 'Each note fires a pair of straight needles, one from above and one from below, that pass each other along the middle line. A scale zips the seam shut; the same note again drives its needle deeper. They stand still and darken away.',
    params: [
      { key: 'bite', label: 'how far they cross', min: 0, max: 2, value: 1,
        hint: "How far a needle's tip crosses the middle line. Left: the tips just meet. Right: they go deep past each other.",
        icon: (g, v, w, h) => { ICON.line(g, w / 2 - 3, 0, w / 2 - 3, h / 2 + v * 8, ICON.ink, 1.5); ICON.line(g, w / 2 + 3, h, w / 2 + 3, h / 2 - v * 8, ICON.red, 1.5); } },
      { key: 'width', label: 'how wide a needle', min: 0.3, max: 2, value: 1, less: 0.6,
        hint: 'How wide a needle is at its root. Left: hairline splinters. Right: heavy wedges.',
        icon: (g, v, w, h) => { const bw = 2 + v * 14; g.beginPath(); g.moveTo(w / 2 - bw / 2, 0); g.lineTo(w / 2 + bw / 2, 0); g.lineTo(w / 2, h); g.fillStyle = ICON.ink; g.fill(); } },
      { key: 'stays', label: 'how long the mesh stays', min: 0.3, max: 4, value: 1.4, less: 0.3,
        hint: 'How long a needle stays after its note, standing still while it darkens. Left: gone in a third of a second. Right: the mesh holds for seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red) },
      { key: 'ratchet', label: 'how much a repeat drives in', min: 0, max: 40, value: 24,
        hint: 'How much deeper the same note played again drives its needle. Left: a repeat only flashes. Right: each one goes visibly deeper.',
        icon: (g, v, w, h) => { for (let n = 0; n < 3; n++) { const cx = 8 + n * 12, d = h * (0.5 + n * v * 0.2); g.beginPath(); g.moveTo(cx - 1.5, 0); g.lineTo(cx + 1.5, 0); g.lineTo(cx, d); g.fillStyle = ICON.red; g.fill(); } } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much you see: how long the needles stay and how wide they are. Left: thin needles that are soon gone. Right: wide needles and a mesh that holds. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { cache = null; },
    onChord() {},   // stateless: frame finds the chords itself

    frame(x) {
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i = chordAt(cs, x.t); if (i < 0) return;
      const C = prepare(cs), g = x.g, picks = !!x.picked;
      const S = x.p('stays'), BITE = x.p('bite'), WIDTH = x.p('width'), RATCHET = x.p('ratchet');
      const guard = C.N < 2 || C.p90 - C.p10 < 1;
      const uOf = (v) => { let u = guard ? 0.6 : clamp((v - C.p10) / (C.p90 - C.p10), 0, 1); if (picks) u = 0.25 + 0.75 * u; return u; };
      const groups = new Map();
      const push = (col, p) => { let a = groups.get(col); if (!a) groups.set(col, a = []); a.push(p); };
      for (let j = i; j >= 0 && x.t - cs[j].t < S; j--) {
        const c = cs[j], t = x.t - c.t;
        const f = SNAP.flash(t), s = t / S, k = (1 - s) * (1 - s) * (1 + 2 * s);
        // Two lighten fills, never a hue lerp: the held body BODY*k, and the strike colour*f*k on top. Lighten takes the per-channel max,
        // so the bone dims as a neutral grey and sinks under the red with no pink midpoint. At f = 1, k = 1 the strike is exactly itself.
        const dim = (c, w) => [0, 1, 2].map((q) => Math.round(c[q] * w));
        const body = dim(BODY, k), kf = f * k;
        const items = [], seen = new Set();
        for (const n of c.notes) {
          const m = n.m; if (seen.has(m)) continue; seen.add(m);
          const nx = C.next[j].get(m); if (nx !== undefined && nx <= i) continue;   // a newer attack of this pitch already sounded
          // the chain: this attack and earlier ones on m, each less than S seconds after the one before (at most 16 links)
          const chain = [j];
          while (chain.length < 16) {
            const tail = chain[chain.length - 1], pj = C.prev[tail].get(m);
            if (pj === undefined || pj < 0 || cs[tail].t - cs[pj].t >= S) break;
            chain.push(pj);
          }
          let depth = 0, b = 0;
          for (let q = chain.length - 1; q >= 0; q--) {
            const u = uOf(noteAt(cs[chain[q]], m).v);
            const bite0 = BITE * (24 + 70 * u), b0 = WIDTH * (8 + 36 * u);
            if (q === chain.length - 1) { depth = Math.min(CAP, bite0); b = b0; }
            else { depth = Math.min(CAP, Math.max(bite0, depth + RATCHET)); b = Math.max(b0, b); }
          }
          items.push({ m, u: uOf(n.v), depth, b });
        }
        items.sort((p, q) => q.u - p.u);
        let area = 0;
        const bone = dim(SNAP.BONE, kf), hot = dim(HOT, kf);
        for (const it of items) {
          const { m, depth, b } = it;
          area += 0.5 * (b * (SEAM + depth) / (BASE + depth)) * (SEAM + depth);
          const upCol = area > BONE_BUDGET ? hot : bone;
          const a = (hash01(m) - 0.5) * 5 * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), ox = px(m) + b / 4;
          const P = (qx, qy) => [ox + qx * ca - qy * sa, SEAM + qx * sa + qy * ca];
          // every triangle has the same winding (signed area +), so overlaps of one colour never cancel under the nonzero fill
          const up = [P(-b / 4, depth), P(-b / 4 - b / 2, -BASE), P(-b / 4 + b / 2, -BASE)];
          const lo = [P(b / 4, -depth), P(b / 4 + b / 2, BASE), P(b / 4 - b / 2, BASE)];
          push(rgb(body), up); push(rgb(body), lo);
          push(rgb(upCol), up); push(rgb(hot), lo);
        }
      }
      if (!groups.size) return;
      g.save(); g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
      for (const [col, tris] of groups) {
        if (col === 'rgb(0,0,0)') continue;
        g.fillStyle = col; g.beginPath();
        for (const tr of tris) { g.moveTo(tr[0][0], tr[0][1]); g.lineTo(tr[1][0], tr[1][1]); g.lineTo(tr[2][0], tr[2][1]); g.closePath(); }
        g.fill();
      }
      g.restore();
    },
  });
})();
