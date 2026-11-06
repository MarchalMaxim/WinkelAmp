// Crimp: fuzzy to sharp. Each note lays a ribbon of razor-thin bone lines at its pitch's height, dead straight on the attack,
// then each line goes slack into its own fine wave and the ribbon is a brick-red woolly strip that dims in steps. The same key
// again yanks its strip straight in place. Stateless from CHORDS; strips are baked once (docs/mockups/nature/plans/crimp.md).
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

  const BONE = SNAP.BONE, HOT = [214, 58, 40], BRICK = [200, 60, 40];
  const LW = 1.5, AMPS = [0.75, 1.5, 2.5, 3.5, 5, 6.5], TONES = [1, 0.75, 0.56, 0.42, 0.32];
  const STRAIGHT = 0.066, CAP = 16, SW = 2560, SH = 20, BUDGET = 0.06 * 1280 * 720;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, k) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * k);
  const hash = (m, i, k) => { let s = (m * 374761393 + i * 668265263 + k * 1442695041) | 0;
    s = Math.imul(s ^ (s >>> 13), 1274126177); s ^= s >>> 16; return (s >>> 0) / 4294967296; };   // 0..1, pitch-seeded
  // A mark dim or hot is drawn lighten at alpha 1 in its real colour (the canvas fade and burn would eat a dim alpha mark).
  const tone = (g, rgb, k = 1) => {
    g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
  };

  let STRIPS = null;   // STRIPS[seed][amplitude][tone]: opaque-on-black wave strips, baked once, never animated
  const bake = () => {
    if (STRIPS) return;
    const mk = () => { const c = document.createElement('canvas'); c.width = SW; c.height = SH; return c; };
    const PS = [[41, 67], [53, 89], [71, 113]], AW = [97, 131, 157], T2 = 2 * Math.PI;
    const strips = [];
    for (let s = 0; s < 3; s++) {
      const wave = new Float32Array(SW);
      let ph = 1.3 * s;
      for (let px = 0; px < SW; px++) {
        const lam = 11.5 + 2.5 * (0.6 * Math.sin(T2 * px / PS[s][0] + s) + 0.4 * Math.sin(T2 * px / PS[s][1] + 2 * s + 1));
        ph += T2 / lam;
        wave[px] = (0.85 + 0.15 * Math.sin(T2 * px / AW[s] + 2 * s)) * Math.sin(ph);
      }
      const byAmp = [];
      for (let a = 0; a < AMPS.length; a++) {
        const byTone = [];
        for (let n = 0; n < TONES.length; n++) {
          const c = mk(), g = c.getContext('2d');
          g.fillStyle = '#000'; g.fillRect(0, 0, SW, SH);
          g.lineWidth = LW; g.lineJoin = 'round';
          g.strokeStyle = `rgb(${BRICK.map((v) => Math.round(v * TONES[n])).join(',')})`;
          g.beginPath();
          for (let px = 0; px < SW; px++) { const y = 10.75 + AMPS[a] * wave[px]; if (px) g.lineTo(px, y); else g.moveTo(px, y); }
          g.stroke();
          byTone.push(c);
        }
        byAmp.push(byTone);
      }
      strips.push(byAmp);
    }
    STRIPS = strips;
  };

  // Which chord is sounding at song time t: the last one at or before it (binary search; nothing remembered between frames).
  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };
  // The clip's own p10 and p90 of note velocity, cached per CHORDS array.
  let vCs = null, vN = -1, vLo = 0, vHi = 0, vOk = false;
  const velRange = (cs) => {
    if (cs === vCs && cs.length === vN) return;
    const vs = [];
    for (const ch of cs) for (const n of ch.notes) vs.push(n.v);
    vs.sort((a, b) => a - b);
    vCs = cs; vN = cs.length;
    if (vs.length < 2) { vOk = false; return; }
    vLo = vs[Math.floor(0.1 * (vs.length - 1))]; vHi = vs[Math.floor(0.9 * (vs.length - 1))];
    vOk = vHi - vLo >= 4;
  };

  TOOLS.push({
    id: 'crimp', name: 'Crimp', tag: 'new',
    blurb: "Each note lays a ribbon of razor-thin lines at its pitch's height, dead straight at the attack; within half a second the lines go slack into a fine wave, out of step, and the ribbon turns into a brick-red woolly strip. Louder notes reach further. The same key again yanks its strip straight in place.",
    params: [
      { key: 'slack', label: 'how fuzzy it goes', min: 1, max: 6.5, value: 5,
        hint: 'How wavy the lines go once struck. Left: they stay almost straight. Right: they go to wool.',
        icon: (g, v, w, h) => {
          g.strokeStyle = ICON.red; g.lineWidth = 1;
          for (let k = 0; k < 3; k++) {
            const y0 = h / 2 - 7 + 7 * k; g.beginPath();
            for (let px = 3; px <= w - 3; px++) { const y = y0 + (0.5 + 3.5 * v) * Math.sin(px * 1.3 + k * 1.9); if (px === 3) g.moveTo(px, y); else g.lineTo(px, y); }
            g.stroke();
          }
        } },
      { key: 'reach', label: 'how long a strip is', min: 0.3, max: 1.4, value: 1, less: 0.3,
        hint: "How far a note's lines reach; louder notes reach further. Left: short dashes. Right: right across the screen.",
        icon: (g, v, w, h) => {
          const L = 6 + v * (w - 10);
          [[-5, -2], [0, 2], [5, 0]].forEach(([dy, sh]) => ICON.line(g, w / 2 - L / 2 + sh, h / 2 + dy, w / 2 + L / 2 + sh, h / 2 + dy, ICON.gold, 1.5));
        } },
      { key: 'fibres', label: 'lines in a strip', min: 3, max: 21, step: 1, value: 15, less: 3,
        hint: 'How many lines a note lays down. Left: a few clean lines. Right: a dense pelt.',
        icon: (g, v, w, h) => ICON.lines(g, 3 + Math.round(v * 7), w, h, { dir: 'h', col: ICON.red, lw: 1 }) },
      { key: 'stays', label: 'how long it stays', min: 0.4, max: 3, value: 1.2, less: 0.4,
        hint: 'How long the wool lies there after a note. Left: gone at once. Right: wool lies around for seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much each note leaves: how long its strip is, how many lines, how long the wool stays. Left: a few short lines, soon gone. Right: long, dense strips that linger. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { bake(); },
    onChord() {},   // stateless: frame finds the chords itself
    frame(x) {
      if (!STRIPS) bake();
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i0 = chordAt(cs, x.t); if (i0 < 0) return;
      const stays = x.p('stays'), D = stays - 0.25, slack = x.p('slack'), reach = x.p('reach');
      const f = clamp(Math.round(x.p('fibres')), 3, 21), picks = !!x.picked;
      velRange(cs);
      // Newest attack of each pitch, at most CAP pitches, newest first.
      const found = new Map();
      for (let j = i0; j >= 0 && cs[j].t > x.t - stays && found.size < CAP; j--) {
        for (const n of cs[j].notes) if (!found.has(n.m) && found.size < CAP) found.set(n.m, { m: n.m, v: n.v, born: cs[j].t });
      }
      const wool = [], strike = [];
      for (const r of found.values()) {
        const t = x.t - r.born; if (t < 0 || t >= D) continue;
        let u = vOk ? clamp((r.v - vLo) / (vHi - vLo), 0, 1) : 1;
        if (picks) u = Math.max(u, 0.35);
        r.u = u; r.t = t;
        r.L = Math.min(1200, reach * (300 + 780 * u));
        r.cx = 340 + 600 * (r.m - 21) / 87;
        r.yc = 660 - 600 * (r.m - 21) / 87;
        (t < STRAIGHT ? strike : wool).push(r);
      }
      const lines = (r, q) => {
        const out = [];
        for (let i = 0; i < f; i++) {
          const y = Math.round(r.yc - 2 * (f - 1) + 4 * i);
          const xl = Math.round(r.cx - q * r.L / 2 + Math.round(60 * hash(r.m, i, 3) - 30));
          const xr = Math.round(r.cx + q * r.L / 2 + Math.round(60 * hash(r.m, i, 4) - 30));
          out.push({ i, y, xl, w: xr - xl });
        }
        return out;
      };
      const g = x.g;
      g.save();
      g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
      for (const r of wool) {
        const A = slack * (1 - Math.exp(-(r.t) / 0.18));
        let j = 0; for (let k = 0; k < AMPS.length; k++) if (AMPS[k] <= A / 0.9) j = k;
        const q = 1 - 0.09 * Math.min(1, AMPS[j] / slack);
        const n = Math.min(4, Math.floor(5 * (r.t - STRAIGHT) / (D - STRAIGHT)));
        for (const l of lines(r, q)) {
          if (l.w < 1) continue;
          const sx = Math.floor(hash(r.m, l.i, 2) * (SW - 1300));
          g.drawImage(STRIPS[l.i % 3][j][n], sx, 0, l.w, SH, l.xl, l.y - 10, l.w, SH);
        }
      }
      strike.sort((a, b) => (b.born - a.born) || (b.u - a.u));
      let spent = 0;
      for (const r of strike) {
        const ls = lines(r, 1);
        const area = ls.reduce((s, l) => s + l.w, 0) * 1.5;
        let top = mix(HOT, BONE, 0.35 + 0.65 * r.u);
        if (spent > 0 && spent + area > BUDGET) top = HOT; else spent += area;
        const c = mix(BRICK, top, SNAP.flash(r.t));
        tone(g, c);
        g.beginPath();
        for (const l of ls) g.rect(l.xl, l.y, l.w, LW);
        g.fill();
      }
      g.restore();
    },
  });
})();
