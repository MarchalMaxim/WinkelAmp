// Snap squares: Dread squares, answering each note sharply. A crack on the attack, a sink you can tune, a quiet ember (docs/mockups/snap/DESIGN.md, C3).
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
      const k = Math.max(0.1, x.p('life') / 0.2), blur = x.p('blur');
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
        const [hr, hg, hb] = SNAP.hot([r, Math.round(4 + 10 * lit), Math.round(6 + 8 * lit)], t / k, q.a);
        const sh = SNAP.sharp(t, blur);
        g.save(); g.translate(q.x, q.y0 + t * 18); g.rotate(q.rot);
        g.globalAlpha = SNAP.alpha(E, Eprev);
        g.shadowColor = `rgb(${r},6,8)`; g.shadowBlur = (10 + sz * 0.05) * sh;
        g.filter = `blur(${((4 + sz * 0.025) * sh).toFixed(1)}px)`;
        g.fillStyle = `rgb(${hr},${hg},${hb})`;
        g.fillRect(-sz / 2, -sz / 2, sz, sz);
        g.restore();
      }
      sq = sq.filter((q) => !q.dead);
    },
  });
})();
