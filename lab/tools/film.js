// Film: one flat ink-blue sail whose corners are the last notes. Each note pulls the oldest corner to its own place in one
// step, whipping past and ringing back with a bone tip; every edge is scooped taut, so a wide leap is a deep curve and the
// corners close to needles. Stateless: the shape is found from CHORDS and x.t (docs/mockups/nature/plans/film.md).
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

  // The tone rule (SYNTHESIS, "Read this before building any of them"): dim marks go down with lighten, alpha 1, a real colour.
  const tone = (g, rgb, k = 1) => {
    g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
  };

  const W = 1280, H = 720, FALL = 0.25, BODY = [40, 68, 196], TAU = 0.07;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smoothstep = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };
  const mulberry32 = (a) => () => {
    a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Everything derived from CHORDS alone, built once per song (knob-independent).
  let cacheCs = null, cacheN = -1, plan = null;
  const build = (cs) => {
    const F = [], first = [], last = [];
    for (let ci = 0; ci < cs.length; ci++) {
      first.push(F.length);
      const ns = cs[ci].notes.slice().sort((a, b) => a.m - b.m);
      for (const n of ns) F.push({ ci, m: n.m, v: n.v, u: 0.5, x: 0, y: 0, id: F.length });
      last.push(F.length - 1);
    }
    const N = F.length;
    if (!N) return { F, first, last };
    const vs = F.map((e) => e.v).sort((a, b) => a - b), ms = F.map((e) => e.m).sort((a, b) => a - b);
    const p10 = vs[Math.floor(0.1 * (N - 1))], p90 = vs[Math.floor(0.9 * (N - 1))];
    let lo = ms[Math.floor(0.05 * (N - 1))], hi = ms[Math.floor(0.95 * (N - 1))];
    if (hi - lo < 24) { const mid = (lo + hi) / 2; lo = mid - 12; hi = mid + 12; }
    for (let j = 0; j < N; j++) {
      const e = F[j];
      e.u = p90 - p10 < 4 ? 0.5 : clamp((e.v - p10) / (p90 - p10), 0, 1);
      const q = clamp((e.m - lo) / (hi - lo), 0, 1);
      e.x = W * (0.06 + 0.88 * q);
      const yPitch = H * (0.90 - 0.80 * q);
      const r = mulberry32((Math.imul(e.ci + 1, 0x9E3779B1) ^ Math.imul(e.m + 1, 0x85EBCA77)) >>> 0);
      let best = 0, bestA = -1, y0 = yPitch;
      for (let k = 0; k < 5; k++) {
        const yk = 0.5 * yPitch + 0.5 * (H * (0.10 + 0.80 * r()));
        if (j < 2) { y0 = yk; break; }
        const A = F[j - 2], B = F[j - 1];
        const area = Math.abs((e.x - A.x) * (B.y - A.y) - (yk - A.y) * (B.x - A.x)) / 2;
        if (area > bestA) { bestA = area; best = yk; }
      }
      e.y = j < 2 ? y0 : best;
    }
    return { F, first, last };
  };

  // The sail's corner set at chord i: { ps, set } with set the corners (entries of F, or two pads with negative ids).
  const cornersAt = (P, cs, i, K, stay) => {
    let j = i;
    while (j > 0 && j > i - 8 && cs[j].t - cs[j - 1].t < stay + FALL) j--;
    const ps = j;
    let c = clamp(Math.max(K, Math.min(7, cs[ps].notes.length)), 3, 7);
    for (let k = ps + 1; k <= i; k++) c = clamp(Math.max(K, Math.min(7, cs[k].notes.length), c - 1), 3, 7);
    const T0 = P.F[P.first[ps]], dy = T0.y > 0.6 * H ? -190 : 190;
    const pad = (id, dx) => ({ ci: -1, id, u: 0, x: clamp(T0.x + dx, 0.04 * W, 0.96 * W), y: clamp(T0.y + dy, 0.06 * H, 0.94 * H) });
    const L = [pad(-2, -240), pad(-1, 240)];
    for (let k = P.first[ps]; k <= P.last[i]; k++) L.push(P.F[k]);
    return { ps, set: L.slice(L.length - Math.min(c, L.length)) };
  };

  TOOLS.push({
    id: 'film', name: 'Film', tag: 'new', on: false,
    blurb: 'One ink-blue sail whose corners are the last notes. Each note pulls the oldest corner to its own place in one step, whipping past and back with a bone tip; every edge is scooped taut, so a wide leap is a deep curve, and the corners close to needles.',
    params: [
      { key: 'corners', label: 'how many notes hold it', min: 3, max: 7, value: 3, step: 1,
        hint: 'How many of the last notes are corners of the sail. Left: three corners, each note a big change. Right: a seven-pointed star, each note a small one.',
        icon: (g, v, w, h) => {
          const n = 3 + Math.round(4 * v), ro = h / 2 - 2, ri = ro * 0.35;
          g.fillStyle = ICON.blue; g.beginPath();
          for (let k = 0; k < 2 * n; k++) {
            const r = k % 2 ? ri : ro, a = -Math.PI / 2 + (k * Math.PI) / n;
            const px = w / 2 + r * Math.cos(a), py = h / 2 + r * Math.sin(a);
            if (k) g.lineTo(px, py); else g.moveTo(px, py);
          }
          g.closePath(); g.fill();
        } },
      { key: 'slack', label: 'how deep the edges curve in', min: 0, max: 1, value: 0.6,
        hint: 'How deeply the edges curve inward. Left: straight edges, a hard polygon. Right: deep scoops, the corners drawn out to long needles.',
        icon: (g, v, w, h) => {
          const r = h / 2 - 2, cx = w / 2, cy = h / 2, pts = [0, 1, 2].map((k) => [cx + r * Math.cos(-Math.PI / 2 + k * 2 * Math.PI / 3), cy + r * Math.sin(-Math.PI / 2 + k * 2 * Math.PI / 3)]);
          g.fillStyle = ICON.blue; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
          for (let k = 0; k < 3; k++) {
            const a = pts[k], b = pts[(k + 1) % 3], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
            g.quadraticCurveTo(mx + (cx - mx) * v * 0.9, my + (cy - my) * v * 0.9, b[0], b[1]);
          }
          g.closePath(); g.fill();
        } },
      { key: 'kick', label: 'how far a corner overshoots', min: 0, max: 0.4, value: 0.14,
        hint: 'How far a new corner whips past its place before it settles. Left: it lands dead. Right: it whips past and rings back.',
        icon: (g, v, w, h) => { ICON.line(g, w * 0.6, 4, w * 0.6, h - 4, ICON.dim, 1); ICON.arrow(g, 4, h / 2, w * 0.6 + v * (w * 0.4 - 4), h / 2, ICON.blue); } },
      { key: 'stay', label: 'how long it stays', min: 0.3, max: 4, value: 2, less: 0.6,
        hint: 'How long the sail stays when no note comes. Left: gone soon after the line stops. Right: it hangs for seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.blue) },
      { key: 'tips', label: 'how bright the tips', min: 0, max: 1, value: 1, less: 0.3,
        hint: 'How big the bone-bright cap on each new corner is. Left: the tips barely show. Right: a bright needle point at every note.',
        icon: (g, v, w, h) => { g.fillStyle = ICON.blue; g.beginPath(); g.moveTo(4, h - 4); g.lineTo(w - 4, h / 2); g.lineTo(4, 4); g.closePath(); g.fill(); g.fillStyle = ICON.ink; g.beginPath(); g.moveTo(w - 4, h / 2); g.lineTo(w - 4 - (w - 8) * (0.15 + 0.6 * v), h / 2 - (h / 2 - 4) * (0.15 + 0.6 * v)); g.lineTo(w - 4 - (w - 8) * (0.15 + 0.6 * v), h / 2 + (h / 2 - 4) * (0.15 + 0.6 * v)); g.closePath(); g.fill(); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How long the sail lingers once the music stops. Left: it is gone soon after the last note. Right: it hangs for up to two seconds. Moving it sets that knob; set it by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() {},
    onChord() {},   // stateless: frame finds the chord itself
    frame(x) {
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i = chordAt(cs, x.t); if (i < 0) return;
      const stay = x.p('stay'), a = x.t - cs[i].t;
      if (a >= stay + FALL - 1e-9) return;
      if (cs !== cacheCs || cs.length !== cacheN) { plan = build(cs); cacheCs = cs; cacheN = cs.length; }
      const P = plan, K = Math.round(x.p('corners')), kick = x.p('kick'), slack = x.p('slack');
      const picks = !!x.picked, g = x.g, tips = x.p('tips');
      const uuOf = (e) => (picks ? Math.max(0.35, e.u) : e.u);

      const cur = cornersAt(P, cs, i, K, stay);
      const set = cur.set;
      // Overshoot vectors d, per chord that is still ringing (born within 0.5 s).
      const dOf = new Map();
      for (const e of set) {
        if (e.ci < 0 || dOf.has(e.ci) || x.t - cs[e.ci].t >= 0.5) continue;
        const j = e.ci, now = j === i ? cur : cornersAt(P, cs, j, K, stay), dm = new Map();
        if (now.ps !== j) {
          const prev = cornersAt(P, cs, j - 1, K, stay), ids = new Set(now.set.map((q) => q.id));
          const dropped = prev.set.filter((q) => !ids.has(q.id));
          let cx = 0, cy = 0; for (const q of prev.set) { cx += q.x; cy += q.y; } cx /= prev.set.length; cy /= prev.set.length;
          let n = 0;
          for (const q of now.set) if (q.ci === j) {
            const from = dropped[n++] || { x: cx, y: cy };
            dm.set(q.id, [q.x - from.x, q.y - from.y]);
          }
        }
        dOf.set(j, dm);
      }
      // Order the set around the centroid of the targets.
      let tcx = 0, tcy = 0; for (const e of set) { tcx += e.x; tcy += e.y; } tcx /= set.length; tcy /= set.length;
      const ord = set.map((e) => ({ e, ang: Math.atan2(e.y - tcy, e.x - tcx) }));
      ord.sort((p, q) => p.ang - q.ang || p.e.id - q.e.id);
      const n = ord.length, px = new Array(n), py = new Array(n), fresh = new Array(n);
      for (let k = 0; k < n; k++) {
        const e = ord[k].e; let X = e.x, Y = e.y;
        if (e.ci >= 0) {
          const ac = x.t - cs[e.ci].t, d = ac < 0.5 && dOf.get(e.ci) && dOf.get(e.ci).get(e.id);
          if (d) {
            const gap = e.ci + 1 < cs.length ? cs[e.ci + 1].t - cs[e.ci].t : Infinity;
            const A = kick * (0.5 + 0.5 * uuOf(e)) * Math.min(1, gap / 0.25);
            const w = A * Math.exp(-ac / TAU) * Math.cos(2 * Math.PI * 8 * ac);
            X += w * d[0]; Y += w * d[1];
          }
        }
        px[k] = X; py[k] = Y; fresh[k] = e.ci === i;
      }
      // Scoops.
      let Cx = 0, Cy = 0, area = 0;
      for (let k = 0; k < n; k++) { Cx += px[k]; Cy += py[k]; const m = (k + 1) % n; area += px[k] * py[m] - px[m] * py[k]; }
      Cx /= n; Cy /= n; const sg = area < 0 ? -1 : 1;
      const phi = new Array(n);
      for (let k = 0; k < n; k++) {
        const pr = (k + n - 1) % n, nx = (k + 1) % n;
        const ax = px[pr] - px[k], ay = py[pr] - py[k], bx = px[nx] - px[k], by = py[nx] - py[k];
        let th = Math.atan2(sg * (bx * ay - by * ax), bx * ax + by * ay); if (th < 0) th += 2 * Math.PI;
        phi[k] = Math.min(th / 2 - 0.035, 1.40);
      }
      const blow = a < 0.5 ? 1 - 0.5 * Math.exp(-a / TAU) : 1;
      let maxE = 0; for (let k = 0; k < n; k++) { const m = (k + 1) % n; maxE = Math.max(maxE, Math.hypot(px[m] - px[k], py[m] - py[k])); }
      const Rc = clamp(maxE, 300, 900);   // one radius per sail, tied to its size so a small sail still scoops
      const edges = [];
      for (let k = 0; k < n; k++) {
        const m = (k + 1) % n, dx = px[m] - px[k], dy = py[m] - py[k], c = Math.hypot(dx, dy);
        if (!(c >= 1)) { edges.push(null); continue; }
        const mx = (px[k] + px[m]) / 2, my = (py[k] + py[m]) / 2;
        let nxx = -dy / c, nyy = dx / c; if (nxx * (Cx - mx) + nyy * (Cy - my) < 0) { nxx = -nxx; nyy = -nyy; }
        let s = Math.min(0.35 * c, (slack / 0.6) * c * c / (8 * Rc));
        const ph = Math.min(phi[k], phi[m]);
        s = ph <= 0 ? 0 : Math.min(s, (c / 4) * Math.tan(ph));
        if (fresh[k] || fresh[m]) s *= blow;
        edges.push([mx + 2 * s * nxx, my + 2 * s * nyy]);
      }
      const path = () => {
        g.beginPath(); g.moveTo(px[0], py[0]);
        for (let k = 0; k < n; k++) {
          const m = (k + 1) % n, q = edges[k];
          if (q) g.quadraticCurveTo(q[0], q[1], px[m], py[m]); else g.lineTo(px[m], py[m]);
        }
        g.closePath();
      };
      // Tone: body, then the bone wedge at each new tip.
      let uN = 0; for (let k = P.first[i]; k <= P.last[i]; k++) uN = Math.max(uN, uuOf(P.F[k]));
      const pk = 0.85 + 0.15 * uN;
      const kb = pk * (0.65 + 0.35 * Math.pow(0.5, a / 0.25)) * (1 - smoothstep(stay, stay + FALL, a));
      tone(g, BODY, kb); path(); g.fill();
      const gapI = i + 1 < cs.length ? cs[i + 1].t - cs[i].t : Infinity, gk = clamp(gapI / 0.25, 0.3, 1);
      if (tips > 0 && a < Math.min(0.12, gapI)) {
        const f = SNAP.flash(a), wc = BODY.map((b, c) => Math.round(b * kb * (1 - f) + SNAP.BONE[c] * f));
        g.save(); path(); g.clip();
        tone(g, wc); g.beginPath();
        for (let k = 0; k < n; k++) if (fresh[k]) {
          // A real wedge: walk r along both edges from the tip and fill the triangle, so the cap ends in a straight cut.
          const pr = (k + n - 1) % n, nx = (k + 1) % n;
          const la = Math.hypot(px[pr] - px[k], py[pr] - py[k]), lb = Math.hypot(px[nx] - px[k], py[nx] - py[k]);
          if (!(la > 1 && lb > 1)) continue;
          const r = Math.min((50 + 70 * uuOf(ord[k].e)) * gk * tips, 0.35 * Math.min(la, lb));
          g.moveTo(px[k], py[k]);
          g.lineTo(px[k] + (px[pr] - px[k]) * r / la, py[k] + (py[pr] - py[k]) * r / la);
          g.lineTo(px[k] + (px[nx] - px[k]) * r / lb, py[k] + (py[nx] - py[k]) * r / lb);
          g.closePath();
        }
        g.fill(); g.restore();
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    },
  });
})();
