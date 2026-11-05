// Hammer: the piano-true strike (docs/mockups/snap/DESIGN.md, candidate 6). Each note is a bar of light at the height of
// its pitch, struck: in its own frame it is a thick bar with a bone-white core, then it drops at once to a thin warm line
// that rings out as a piano string does, longer in the bass. A chord is a stack of bars; the same key again restrikes its
// own bar. Every brightness comes from the SNAP envelope below and goes through SNAP.alpha, so what you see on the fading
// canvas is the curve itself: bright first, then gone, and each note countable.
(() => {
// SNAP v1 begin
// SNAP: a piano note on screen. An instant hammer, a fast fall, a quiet tail, so the eye can count the notes.
// What each part is for. t is seconds since the attack, always x.t - ch.t (keep born = ch.t on the mark in onChord),
// never an age added up frame by frame, so seeks, renders and live play agree.
//   SNAP.env(t, n, o)        One note's envelope. n = {v, m, d, a}: the velocity as heard (0..127), the midi pitch,
//                            the written length in seconds, the picked note's intensity (n.amount, default 1).
//                            o = {preset, ring, picks}: preset is 'staccato', 'marcato', 'piano' (the default) or
//                            'bell', or the touch knob's 0..3; ring stretches how long it rings (1 = as the preset
//                            says); picks = x.onPicks(), which raises the floor so every picked note lands.
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

  // The colour of a string by register: deep red in the bass, amber in the middle, pale gold in the treble.
  const WARM = [[0, [168, 22, 16]], [0.28, [214, 52, 26]], [0.5, [255, 140, 44]], [0.74, [255, 200, 104]], [1, [255, 234, 186]]];
  function warm(m) {
    const u = Math.max(0, Math.min(1, (m - 21) / 87));
    let i = 0; while (i < WARM.length - 2 && u > WARM[i + 1][0]) i++;
    const [u0, a] = WARM[i], [u1, b] = WARM[i + 1], k = (u - u0) / (u1 - u0);
    return a.map((c, j) => Math.round(c + (b[j] - c) * k));
  }
  // midi 21 at the bottom, 108 at the top, with a margin so the lowest and highest bars are whole.
  const yOf = (m, H) => H - 40 - ((m - 21) / 87) * (H - 80);

  // How bright a bar is along its length (centre out to the tip): light along a string, full in the middle, soft at the
  // ends. Each stop gets its own SNAP.alpha, so the taper is exact on the fading canvas, not only the middle.
  const TAPER = [[0, 1], [0.4, 1], [0.62, 0.82], [0.8, 0.48], [0.92, 0.18], [1, 0]];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(4)})`;
  function bar(g, cx, y, w, th, col, T, Tp) {
    if (w < 1 || th <= 0 || !(T > 0.002)) return;
    const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    for (let i = TAPER.length - 1; i >= 0; i--) { const [u, s] = TAPER[i]; gr.addColorStop(0.5 - u / 2, rgba(col, SNAP.alpha(s * T, s * Tp))); }
    for (let i = 1; i < TAPER.length; i++) { const [u, s] = TAPER[i]; gr.addColorStop(0.5 + u / 2, rgba(col, SNAP.alpha(s * T, s * Tp))); }
    g.fillStyle = gr;
    g.fillRect(cx - w / 2, y - th / 2, w, th);
  }

  // One mark per key: a restrike is the same bar struck again, never a second one (P7).
  let marks = new Map();
  let rollsFor = null, rollIndex = null;
  // The chord's place in CHORDS, for SNAP.rolls: found by its time, so a copied chord object still finds its place.
  function roleOf(ch) {
    const all = typeof CHORDS !== 'undefined' ? CHORDS : [];
    if (rollsFor !== all || rollIndex.n !== all.length) {
      rollsFor = all; rollIndex = new Map(); rollIndex.n = all.length;
      all.forEach((c, i) => rollIndex.set(c.t, i));
    }
    const i = rollIndex.get(ch.t);
    return i == null ? '' : SNAP.rolls(all).get(i) || '';
  }

  // The envelope of one strike. A roll's lower notes are dry ticks at a fixed 0.35 (they land, P6, but quietly); its top
  // note cracks a quarter harder: more of its peak is the flash, so it drops further from the strike.
  function envOf(s, t) {
    if (s.role === 'member') {
      const e = SNAP.env(t, { v: s.v, m: s.m, d: s.d, a: 0 }, { preset: 'staccato', ring: s.ring, picks: s.picks });
      const k = 0.35 / e.P;
      return { E: e.E * k, flash: 0, body: e.body, P: 0.35, L: e.L };
    }
    const a = s.role === 'top' ? 1 + (SNAP.gain(s.a) * 1.25 - 1) / 0.8 : s.a;
    return SNAP.env(t, { v: s.v, m: s.m, d: s.d, a }, { preset: s.touch, ring: s.ring, picks: s.picks });
  }

  TOOLS.push({
    id: 'hammer', name: 'Hammer', tag: 'new',
    blurb: 'Each note is struck like a piano string: a bar of light at the height of its pitch, wider the harder it is played, with a white-hot core for one instant. Then it drops at once to a thin warm line that rings out, longer in the bass (deep red) than in the treble (pale gold). A chord is a stack of bars; the same key again restrikes its own bar, which jumps and rings. You can count the notes.',
    params: [
      { key: 'touch', label: 'articulation', min: 0, max: 3, step: 1, value: 2,
        hint: 'How a note is played: staccato, marcato, piano, bell. Left: here and gone. Right: a bright strike that drops at once to a long, quiet ring.',
        icon: (g, v, w, h) => {
          // The envelope itself: the strike at the left edge, then the fall; the further right, the longer the ring.
          const k = Math.round(v * 3), hl = [0.05, 0.1, 0.12, 0.22][k], tail = [0, 0, 0.22, 0.38][k], end = [0.35, 0.55, 1, 1][k];
          g.strokeStyle = ICON.gold; g.lineWidth = 1.5; g.beginPath(); g.moveTo(4, h - 3); g.lineTo(4, 3);
          for (let px = 5; px <= w - 3; px++) {
            const u = (px - 4) / (w - 7), e = u > end ? 0 : (1 - tail) * Math.pow(0.5, u / hl) + tail * Math.pow(0.5, u / (hl * 7));
            g.lineTo(px, h - 3 - (h - 6) * e);
          }
          g.stroke();
        } },
      { key: 'ring', label: 'how long it rings', min: 0.25, max: 3, value: 1, less: 0.5,
        hint: 'How long the line a note leaves keeps glowing. Left: it is gone in a quarter of the time. Right: it rings three times as long.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.gold, 'line') },
      { key: 'roll', label: 'a rolled chord is one strike', min: 0, max: 1, step: 1, value: 0,
        hint: 'A chord spread from the bottom up. Left: every note of the roll flashes. Right: the notes tick in order, small and quiet, and only the top one strikes.',
        icon: (g, v, w, h) => {
          for (let i = 0; i < 4; i++) {
            const x = 6 + i * 9, y = h - 5 - i * 5, top = i === 3, quiet = v > 0.5 && !top;
            ICON.line(g, x - (quiet ? 2 : 4), y, x + (quiet ? 2 : 4), y, quiet ? ICON.dim : ICON.gold, quiet ? 1 : 2.5);
            if (!quiet) ICON.line(g, x - 2, y, x + 2, y, ICON.ink, 1);
          }
        } },
      { key: 'size', label: 'size', min: 0.5, max: 2, value: 1, less: 0.7,
        hint: 'How big the bars are. Left: short, thin lines. Right: long, thick bars of light.',
        icon: (g, v, w, h) => { const L = 10 + v * 26, th = 2 + v * 6; ICON.rect(g, w / 2 - L / 2, h / 2 - th / 2, L, th, ICON.gold); ICON.line(g, w / 2 - L * 0.4, h / 2, w / 2 + L * 0.4, h / 2, ICON.ink, 1); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much each note leaves behind: how big its bar is and how long its line rings. Left: small bars, soon gone. Right: big bars that ring out. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { marks = new Map(); },
    onChord(ch, x) {
      // Read now, so a note picked with its own articulation or ring keeps it for as long as it sounds.
      const touch = SNAP.TOUCH[Math.max(0, Math.min(3, Math.round(x.p('touch') ?? 2)))];
      const ring = x.p('ring') ?? 1, picks = x.onPicks();
      const role = (x.p('roll') ?? 0) >= 0.5 ? roleOf(ch) : '';
      for (const n of ch.notes) {
        const old = marks.get(n.m);
        const s = { m: n.m, v: n.v, d: n.d, a: n.amount ?? 1, touch, ring, picks, role, born: ch.t, re: false, prev: null };
        if (old && ch.t > old.born && ch.t - old.born < envOf(old, 0).L) {
          // The same key again while its bar still rings: the flash restarts at full and the bar jumps in width. What
          // was on screen a step ago is the old strike, so the first step's alpha is measured against that.
          s.re = true; s.prev = { ...old, prev: null };
        }
        marks.set(n.m, s);
      }
    },
    frame(x) {
      const g = x.g, W = x.W, H = x.H, cx = W / 2, size = x.p('size') ?? 1;
      const live = [];
      for (const [m, s] of marks) {
        const t = x.t - s.born;
        const e = envOf(s, t);
        if (t >= e.L) { marks.delete(m); continue; }
        if (t < 0) continue;   // seeked back past it: reset() clears the rest
        const tp = t - x.dt;
        const Tp = tp < 0 ? (s.prev ? envOf(s.prev, x.t - x.dt - s.prev.born).E : 0) : envOf(s, tp).E;
        live.push({ s, t, e, Tp });
      }
      // Dim first, fresh last: a new strike lies over the lines still ringing, never under them.
      live.sort((p, q) => p.e.E - q.e.E);
      g.save();
      for (const { s, t, e, Tp } of live) {
        const y = yOf(s.m, H), col = warm(s.m), member = s.role === 'member';
        // Wider the harder: width from the peak, a loud strike overshoots and rings back, a restrike kicks it again.
        let w = member ? 70 + 60 * (s.v / 127) : 120 + 760 * e.P;
        w *= (0.75 + 0.25 * size) * SNAP.size(t, s.v, { preset: member ? 'staccato' : s.touch });
        if (s.re) w *= 1 + 0.15 * Math.exp(-t / 0.06) * Math.cos(2 * Math.PI * 8 * t);
        w = Math.min(W - 40, w);
        // Thick at the strike (6 to 14 px, a bass string is thicker), then the band narrows with the flash and the body
        // to the 1 px line that rings: the strike carries the attack, the line carries the note (P4).
        const p = SNAP.preset(member ? 'staccato' : s.touch), g1 = SNAP.gain(s.a);
        const th0 = (6 + 8 * (1 - (s.m - 21) / 87)) * size * (member ? 0.4 : 1);
        const shape = (p.wf * g1 * e.flash + p.wb * e.body) / (p.wf * g1 + p.wb);
        const th = 1 + Math.max(0, th0 - 1) * shape;
        // Crisp first, soft later (P9): the glow around the line only grows once the strike has passed.
        const glow = SNAP.sharp(t, 10 * size);
        g.shadowBlur = glow; g.shadowColor = glow > 0.5 ? rgba(col, 0.6) : 'transparent';
        // A roll's tick is paler than its string, so a quiet 0.35 still reads as a mark and not as smoke.
        bar(g, cx, y, w, th, member ? col.map((c, j) => Math.round(c + (SNAP.BONE[j] - c) * 0.35)) : SNAP.hot(col, t, s.a), e.E, Tp);
        g.shadowBlur = 0; g.shadowColor = 'transparent';
        // The core: a 2 px bone line for the instant of the strike. A note turned down below 0.6 has none: it blooms.
        if (!member && SNAP.core(s.a)) {
          const ftp = t - x.dt;
          bar(g, cx, y, w * 0.86, 2, SNAP.BONE, e.P * e.flash, ftp < 0 ? 0 : e.P * SNAP.flash(ftp));
        }
      }
      g.restore();
    },
  });
})();
