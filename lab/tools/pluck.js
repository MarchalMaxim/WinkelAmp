// Plucked corner: each pitch owns one straight thread between two small square anchors. A pluck is two dead-straight lines
// meeting at one hard corner; the corner splits and runs, so the thread flaps through triangle, flat-topped trapezoid, flat,
// and the same upside down (Helmholtz motion, exact, no sampling). The fading canvas stacks the positions into a fan of
// straight hairlines. Nothing here is curved. Stateless: everything is derived from CHORDS and x.t.
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

  // 'run' is the corner running along the thread; 'stand' is the fallback (fixed corner, V flipping to inverted V).
  const FORM = 'run';

  // Outside the SNAP markers (SYNTHESIS rule 1): a real colour at its target, drawn with lighten at alpha 1.
  const tone = (g, rgb, k = 1) => {
    g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const BONE = SNAP.BONE, RED = [226, 44, 40];
  const NOTAIL = {}; for (const k of SNAP.TOUCH) { const p = SNAP.PRESETS[k]; NOTAIL[k] = { ...p, wb: p.wb + p.wt, wt: 0 }; }
  const hash = (m, k) => { let s = Math.imul(m + 1, 0x9E3779B1) ^ Math.imul(k + 1, 0x85EBCA77);
    s = Math.imul(s ^ (s >>> 15), 0x2C1B3C6D); s = Math.imul(s ^ (s >>> 12), 0x297A2D39); return ((s ^ (s >>> 15)) >>> 0) / 4294967296; };
  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };

  // Caches derived from CHORDS only; cleared in reset.
  let statsFor = null, stats = null, strands = new Map();
  function clipStats(all) {
    if (statsFor === all && stats && stats.n === all.length) return stats;
    statsFor = all; strands = new Map();
    let lo = Infinity, hi = -Infinity; const vs = [];
    for (const c of all) for (const n of c.notes) { if (n.m < lo) lo = n.m; if (n.m > hi) hi = n.m; vs.push(n.v); }
    if (!vs.length) { lo = 54; hi = 66; }
    if (hi - lo < 12) { const c = (lo + hi) / 2; lo = c - 6; hi = c + 6; }
    vs.sort((a, b) => a - b);
    const N = vs.length, p10 = N ? vs[Math.floor(0.1 * (N - 1))] : 40, p90 = N ? vs[Math.floor(0.9 * (N - 1))] : 100;
    const rep = new Map(), lastT = new Map(), lastJ = new Map();
    all.forEach((c, i) => {
      for (const n of c.notes) {
        const j = lastT.has(n.m) && c.t - lastT.get(n.m) <= 1.0 ? lastJ.get(n.m) + 1 : 0;
        rep.set(i + ':' + n.m, j); lastT.set(n.m, c.t); lastJ.set(n.m, j);
      }
    });
    const guard = !(N >= 3 && p90 - p10 >= 4);
    stats = { n: all.length, lo, hi, rep, uv: (v) => guard ? clamp((v - 40) / 60, 0, 1) : clamp((v - p10) / (p90 - p10), 0, 1) };
    return stats;
  }

  function strandOf(m, st) {
    let s = strands.get(m); if (s) return s;
    const W = 1280, H = 720;
    const up = clamp((m - st.lo) / (st.hi - st.lo), 0, 1);
    const L = 1180 + (140 - 1180) * up, ym = 570 - 420 * up;
    const thMax = (14 * Math.PI / 180) * (1 - 0.65 * (L - 140) / 1040);
    let th = (2 * hash(m, 3) - 1) * thMax;
    const room = Math.min(ym, H - ym) - 16;
    if (0.5 * L * Math.abs(Math.sin(th)) > room) th = Math.sign(th) * Math.asin(Math.min(1, room / (0.5 * L)));
    const Lx = L * Math.cos(th), cx = 30 + Lx / 2 + hash(m, 2) * (W - 60 - Lx);
    const dy = 0.5 * L * Math.sin(th);
    const side = ym < H / 2 ? 1 : -1;
    s = { L, ym, th, a0x: cx - Lx / 2, a0y: ym - dy, a1x: cx + Lx / 2, a1y: ym + dy,
      nx: -side * Math.sin(th), ny: side * Math.cos(th), r0: 0.2 + 0.2 * hash(m, 1),
      room2: Math.min(ym, H - ym) - 14 - 0.5 * L * Math.abs(Math.sin(th)) };
    strands.set(m, s); return s;
  }

  // The thread's shape at time t: points (s, offset) of the exact polyline.
  function shape(a, c, t, r, hpad, per) {
    const ks = hpad > 0 ? [r - hpad, r + hpad] : [r];
    const f0 = (s) => {
      if (s <= 0 || s >= 1) return 0;
      if (s < r - hpad) return s / (r - hpad);
      if (s <= r + hpad) return 1;
      return (1 - s) / (1 - r - hpad);
    };
    const F = (s) => { s = ((s % 2) + 2) % 2; return s <= 1 ? f0(s) : -f0(2 - s); };
    if (FORM === 'stand') {
      const p = t / per, tw = 4 * Math.abs((((p % 1) + 1) % 1) - 0.5) - 1;
      return [0, ...ks, 1].map((s) => [s, a * tw * f0(s)]);
    }
    const ct = c * t, bp = [0, 1];
    for (const k of ks) for (const sg of [1, -1]) for (const sc of [1, -1]) {
      const v = (((sg * k + sc * ct) % 2) + 2) % 2;
      if (v > 0 && v < 1) bp.push(v);
    }
    bp.sort((p, q) => p - q);
    const out = [];
    for (const s of bp) if (!out.length || s - out[out.length - 1][0] > 1e-6) out.push([s, a * 0.5 * (F(s - ct) + F(s + ct))]);
    return out;
  }

  const ends = (g, ay) => { ICON.rect(g, 3, ay - 1, 2, 2, ICON.ink); };

  TOOLS.push({
    id: 'pluck', name: 'Plucked corner', tag: 'new',
    blurb: 'Each note pulls its own straight thread aside: two straight lines and one hard corner, struck bone-white. The corner splits and runs, so the thread flaps through a triangle, a flat top and back, and the fading screen stacks its positions into a fan of straight hairlines. Then a thin red line stays a moment and goes. Bass threads are long, treble ones short; a repeated note pulls the same thread at a new point. Nothing in it is ever curved.',
    params: [
      { key: 'pull', label: 'how far it is pulled', min: 0.3, max: 2, value: 1, less: 0.6,
        hint: 'How far a note pulls its thread aside. Left: a small kink. Right: a wide corner far out of line.',
        icon: (g, v, w, h) => { const ay = h / 2, cx = 0.35 * w, cy = ay - (2 + v * (h / 2 - 4));
          ICON.line(g, 4, ay, cx, cy, ICON.gold, 1.5); ICON.line(g, cx, cy, w - 4, ay, ICON.gold, 1.5);
          ICON.rect(g, 3, ay - 1, 2, 2, ICON.ink); ICON.rect(g, w - 5, ay - 1, 2, 2, ICON.ink); } },
      { key: 'corner', label: 'how hard the corner is', min: 0, max: 1, value: 1,
        hint: 'How the thread is pulled. Left: by a soft finger, a short flat top between two corners. Right: one corner as hard as a ruled line.',
        icon: (g, v, w, h) => { const ay = h / 2, cx = 0.35 * w, cy = ay - (2 + 0.7 * (h / 2 - 4)), hp = (1 - v) * 6;
          ICON.line(g, 4, ay, cx - hp, cy, ICON.gold, 1.5); if (hp > 0) ICON.line(g, cx - hp, cy, cx + hp, cy, ICON.gold, 1.5);
          ICON.line(g, cx + hp, cy, w - 4, ay, ICON.gold, 1.5);
          ICON.rect(g, 3, ay - 1, 2, 2, ICON.ink); ICON.rect(g, w - 5, ay - 1, 2, 2, ICON.ink); } },
      { key: 'shiver', label: 'how long it shivers', min: 0.04, max: 0.16, value: 0.09,
        hint: 'How long the thread flaps after the pull. Left: one flap, then straight. Right: a few flaps, never long enough to look like a new note.',
        icon: (g, v, w, h) => { const n = 1 + Math.round(v * 4), ay = h / 2;
          for (let i = 0; i < n; i++) { const ap = (i % 2 ? 1 : -1) * (h / 2 - 4) * Math.pow(0.55, i), col = i ? ICON.dim : ICON.gold;
            ICON.line(g, 4, ay, 0.4 * w, ay + ap, col, 1.5); ICON.line(g, 0.4 * w, ay + ap, w - 4, ay, col, 1.5); }
          ICON.rect(g, 3, ay - 1, 2, 2, ICON.ink); ICON.rect(g, w - 5, ay - 1, 2, 2, ICON.ink); } },
      { key: 'ring', label: 'how long it rings', min: 0.25, max: 3, value: 1, less: 0.25,
        hint: 'How long the thin red line stays once the thread is straight. Left: gone in a quarter of the time. Right: three times as long.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red, 'line') },
      { key: 'touch', label: 'articulation', min: 0, max: 3, step: 1, value: 2,
        hint: 'How a note is played: staccato, marcato, piano, bell. Left: here and gone. Right: a bright strike that drops at once to a long, quiet ring.',
        icon: (g, v, w, h) => {
          const k = Math.round(v * 3), hl = [0.05, 0.1, 0.12, 0.22][k], tail = [0, 0, 0.22, 0.38][k], end = [0.35, 0.55, 1, 1][k];
          g.strokeStyle = ICON.gold; g.lineWidth = 1.5; g.beginPath(); g.moveTo(4, h - 3); g.lineTo(4, 3);
          for (let px = 5; px <= w - 3; px++) {
            const u = (px - 4) / (w - 7), e = u > end ? 0 : (1 - tail) * Math.pow(0.5, u / hl) + tail * Math.pow(0.5, u / (hl * 7));
            g.lineTo(px, h - 3 - (h - 6) * e);
          }
          g.stroke();
        } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much each note leaves: how far it pulls and how long its line stays. Left: small kinks, soon gone. Right: wide pulls that ring out. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { statsFor = null; stats = null; strands = new Map(); },
    onChord() {},
    frame(x) {
      const all = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i0 = chordAt(all, x.t); if (i0 < 0) return;
      const st = clipStats(all);
      const pull = x.p('pull') ?? 1, corner = x.p('corner') ?? 1, tau = x.p('shiver') ?? 0.09, ring = x.p('ring') ?? 1;
      const touchName = SNAP.TOUCH[clamp(Math.round(x.p('touch') ?? 2), 0, 3)];
      const LB = SNAP.preset(touchName).L * ring, picks = !!x.picked;
      const seen = new Set(), live = [];
      for (let i = i0; i >= 0 && all[i].t > x.t - LB; i--) {
        const ch = all[i], t = x.t - ch.t;
        for (const n of ch.notes) {
          if (seen.has(n.m)) continue;
          seen.add(n.m);
          const amt = n.amount ?? 1;
          const e = SNAP.env(t, { v: n.v, m: n.m, d: n.d, a: amt }, { preset: NOTAIL[touchName], ring, picks });
          if (!(t < e.L) || !(e.P > 0)) continue;
          const uv = st.uv(n.v), gn = SNAP.gain(amt);
          let Pn = Math.min(1, (0.65 + 0.35 * uv) * gn); if (picks) Pn = Math.max(Pn, 0.75);
          const q = e.E / e.P;
          if (Pn * q * 226 < 4) continue;
          const sd = strandOf(n.m, st), j = st.rep.get(i + ':' + n.m) || 0;
          const r = 0.2 + ((((sd.r0 - 0.2 + 0.07 * j) % 0.2) + 0.2) % 0.2);
          const hpad = Math.max(0, Math.min(r - 0.04, (1 - corner) * 0.12));
          const A = Math.max(6, Math.min(pull * (20 + 120 * uv), pull * 0.2 * sd.L, Math.max(6, sd.room2)) * Math.min(1.3, gn));
          const per = clamp(0.2 * Math.pow(sd.L / 1180, 0.4), 0.1, 0.2), c = 2 / per;
          const a = A * Math.exp(-t / tau);
          live.push({ sd, t, r, hpad, a, c, per, Pn, q, amt, body: e.body });
        }
      }
      if (!live.length) return;
      const g = x.g;
      g.save();
      g.lineCap = 'butt'; g.lineJoin = 'miter'; g.miterLimit = 6;
      for (const s of live) {
        const { sd, t } = s;
        const k = SNAP.core(s.amt) * SNAP.flash(t);
        tone(g, [0, 1, 2].map((ci) => RED[ci] + (BONE[ci] - RED[ci]) * k), s.Pn * Math.max(SNAP.flash(t), 0.55 * s.body));
        g.strokeStyle = g.fillStyle;
        g.lineWidth = 1.25 + 2.75 * SNAP.flash(t);
        const dx = sd.a1x - sd.a0x, dy = sd.a1y - sd.a0y;
        let pts;
        if (s.a < 0.5) pts = [[sd.a0x, sd.a0y], [sd.a1x, sd.a1y]];
        else pts = shape(s.a, s.c, t, s.r, s.hpad, s.per).map(([u, o]) => [sd.a0x + u * dx + o * sd.nx, sd.a0y + u * dy + o * sd.ny]);
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let p = 1; p < pts.length; p++) g.lineTo(pts[p][0], pts[p][1]);
        g.stroke();
        g.fillRect(sd.a0x - 2.5, sd.a0y - 2.5, 5, 5);
        g.fillRect(sd.a1x - 2.5, sd.a1y - 2.5, 5, 5);
      }
      g.restore();
    },
  });
})();
