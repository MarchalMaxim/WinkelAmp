// Blade: a sound-roll seen from the playhead. Every note is a wedge standing on a cliff a fifth of the way across;
// (The switch 'from' turns the whole picture to stand on a floor near the bottom, pointing up, pitch across the width.)
// to the right of the cliff lies what is left of the note, drawn 240 px per second, tall where it still rings and
// thinning out as it dies away. As time passes the wedge slides into the cliff and is eaten from the left, so the
// height at the cliff is always how loud the note is now, and its length is how long it has still to ring.
// Snap candidate C9 (docs/mockups/snap/DESIGN.md). Every frame is drawn from CHORDS and the song time; the only thing
// kept is each note's articulation, ring and height, read at its attack (so a picked note keeps its own).
// Seek-exactness: it holds exactly as long as no knob value is per note (the default, and the lab). A note struck
// before a seek point never reached onChord, so with per-note touch/ring/size (picks) its wedge falls back to the knobs
// as they stand at the seek, and a render started mid-passage can differ from playing through until those wedges are
// gone (up to BACK s). Fixing that needs the runtime to hand the widget the held values of past attacks.
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

  const CLIFF = 0.22;   // the playhead's column, as a share of the width: the past is to the left, and it is gone
  const PXS = 240;      // pixels per second of a note's future
  // No wedge lasts longer than this, so the walk back through CHORDS stops here. It is the longest ring there can be:
  // the bell's 6 s times the ring knob's maximum 3. Raised from 12 (rather than capping L) so that L = pre.L * ring is
  // never clipped, and a wedge is never cut while SNAP.env still has it ringing.
  const BACK = 18;
  const TAPER = 0.75;   // the wedge's height is the note's profile to this power: it thins out a little slower than it fades
  const CUT = 0.1;      // the last 0.1 s of a ring fade out: SNAP.env's own cut, and the wedge's far-end taper the same
  const BODY = 0.4;     // how bright a ringing body is next to the strike (1): a dim but readable third
  const STEP = 2;       // the wedge is drawn in columns 2 px wide: whole pixels, smooth enough at 1280, cheap in a fast run

  // The register's colour, hand-picked: the bass a dark red (Squares' red), the middle an ember turning to amber, the
  // top of the keyboard pale glass. The strike lights it toward bone for two steps (SNAP.hot), never to white.
  const TINTS = [[33, [190, 24, 24]], [48, [224, 62, 36]], [60, [244, 128, 52]], [72, [248, 192, 100]], [84, [186, 214, 224]], [98, [220, 240, 248]]];
  function tint(m) {
    if (m <= TINTS[0][0]) return TINTS[0][1];
    for (let i = 1; i < TINTS.length; i++) {
      const [m1, c1] = TINTS[i], [m0, c0] = TINTS[i - 1];
      if (m <= m1) { const u = (m - m0) / (m1 - m0); return c0.map((c, k) => c + (c1[k] - c) * u); }
    }
    return TINTS[TINTS.length - 1][1];
  }
  const rgb = (c, k = 1) => `rgb(${Math.round(Math.min(255, c[0] * k))},${Math.round(Math.min(255, c[1] * k))},${Math.round(Math.min(255, c[2] * k))})`;

  // Where the piece lives on the keyboard, from its own notes (2nd to 98th percentile), so the wedges use the height
  // of the screen whatever the piece. Computed once per CHORDS array: the picks of a set get their own.
  const RANGES = typeof WeakMap === 'function' ? new WeakMap() : null;
  function rangeOf(chords) {
    const seen = RANGES && RANGES.get(chords);
    if (seen && seen.n === chords.length) return seen;
    const ms = [];
    for (const ch of chords) for (const n of ch.notes) ms.push(n.m);
    ms.sort((a, b) => a - b);
    let lo = ms.length ? ms[Math.floor(ms.length * 0.02)] : 36, hi = ms.length ? ms[Math.floor(ms.length * 0.98)] : 96;
    if (hi - lo < 24) { const c = (hi + lo) / 2; lo = c - 12; hi = c + 12; }
    const r = { n: chords.length, lo: lo - 2, hi: hi + 2 };
    if (RANGES) RANGES.set(chords, r);
    return r;
  }
  // The first chord at or after time t.
  function first(chords, t) {
    let a = 0, b = chords.length;
    while (a < b) { const k = (a + b) >> 1; if (chords[k].t < t) a = k + 1; else b = k; }
    return a;
  }
  const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  // A little wedge for the knob pictures: a cliff on the left, a profile dying to the right.
  // len: how far it reaches (0..1 of the box), tall: its height at the cliff (0..1), hb: how fast the body falls,
  // tailW: how much quiet tail it keeps.
  function wedgeIcon(g, w, h, len, tall, hb, tailW, col) {
    const x0 = 5, cy = h / 2, L = Math.max(0.05, len) * (w - x0 - 2), H0 = Math.max(1, tall * (h - 4));
    const prof = (s) => (Math.pow(0.5, s / hb) + tailW * Math.pow(0.5, s / (6 * hb))) / (1 + tailW) * (1 - smooth(0.8, 1, s));
    g.fillStyle = col; g.beginPath(); g.moveTo(x0, cy - H0 / 2);
    for (let i = 1; i <= 24; i++) { const s = i / 24; g.lineTo(x0 + s * L, cy - (H0 / 2) * prof(s)); }
    for (let i = 24; i >= 0; i--) { const s = i / 24; g.lineTo(x0 + s * L, cy + (H0 / 2) * prof(s)); }
    g.closePath(); g.fill();
    g.fillStyle = ICON.dim; g.fillRect(x0 - 2, 2, 1, h - 4);
  }

  TOOLS.push({
    id: 'blade', name: 'Blade', tag: 'new',
    blurb: 'Every note is a wedge on a floor a fifth of the way up (or a cliff a fifth of the way across, with the switch): what it has still to ring, seen from the playhead. It strikes bone-hot, then slides into the floor and is eaten from the bottom; the bass rings long, the treble is gone in a breath.',
    params: [
      { key: 'touch', label: 'articulation', min: 0, max: 3, step: 1, value: 2,
        hint: 'How a note is struck and how it rings, in four steps: staccato, marcato, piano, bell. Left: here and gone, a short sharp sliver. Right: a bright strike that drops at once to a long quiet ring.',
        icon: (g, v, w, h) => { const p = SNAP.preset(Math.round(v * 3)); wedgeIcon(g, w, h, Math.min(1, 0.25 + p.L / 3), 0.85, 0.08 + p.hb0 * 0.5, p.wt * 1.6, ICON.gold); } },
      { key: 'ring', label: 'how long it rings', min: 0.25, max: 3, value: 1, less: 0.6,
        hint: 'How far each wedge reaches into its note\'s future. Left: what a note leaves is gone in a quarter of the time. Right: it rings three times as long, a long thin blade.',
        icon: (g, v, w, h) => wedgeIcon(g, w, h, 0.2 + v * 0.8, 0.85, 0.12 + v * 0.25, 0.3, ICON.gold) },
      { key: 'size', label: 'how tall', min: 0.4, max: 2, value: 1, less: 0.6,
        hint: 'How tall a wedge stands at the cliff. Left: thin slivers, every note on its own line. Right: tall blades that lean over their neighbours.',
        icon: (g, v, w, h) => wedgeIcon(g, w, h, 0.85, 0.2 + v * 0.8, 0.2, 0.3, ICON.red) },
      { key: 'from', label: 'where the blades come from', min: 0, max: 1, step: 1, value: 1,
        hint: 'Left: from a cliff on the left, pointing right. Right: up from the floor, pointing up.',
        icon: (g, v, w, h) => {
          const col = ICON.gold;
          g.save();
          if (v >= 0.5) { g.translate(0, h); g.rotate(-Math.PI / 2); wedgeIcon(g, h, w, 0.85, 0.7, 0.2, 0.3, col); }
          else wedgeIcon(g, w, h, 0.85, 0.7, 0.2, 0.3, col);
          g.restore();
        } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much of the music you see: how tall the wedges stand and how long they ring. Left: thin, short slivers that are soon gone. Right: tall wedges that ring far to the right. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    // What each attack was struck with: touch, ring and size as they stood at that moment, by the chord's time. On
    // picks these are the note's own values (held only until the set's next attack), so they must be caught here: read
    // in frame, every older wedge would change shape the moment the next note lands, which looks like a fake attack.
    reset() { this.marks = new Map(); },
    onChord(ch, x) {
      const marks = this.marks || (this.marks = new Map());
      marks.set(ch.t, { touch: x.p('touch'), ring: x.p('ring'), size: x.p('size') });
      // Keys arrive in time order, so the oldest are first: drop what can no longer be on screen.
      for (const k of marks.keys()) { if (k >= ch.t - BACK) break; marks.delete(k); }
    },
    frame(x) {
      const g = x.g, W = x.W, H = x.H;
      // Where the blades come from: below 0.5 a cliff on the left, blades pointing right, pitch up the height; from 0.5 a
      // floor near the bottom, blades pointing up, pitch across the width (low left). One geometry, drawn in two axes:
      // u runs along the blade (away from the cliff), c across it (the pitch axis); rect() maps a box in (u, c) to pixels.
      const floor = x.p('from') >= 0.5;
      const X0 = Math.round(CLIFF * W), Y0 = H - Math.round(CLIFF * H);
      const reach = floor ? Y0 : W - X0;
      const rect = floor ? (u0, u1, c0, c1) => g.fillRect(c0, Y0 - u1, c1 - c0, u1 - u0) : (u0, u1, c0, c1) => g.fillRect(X0 + u0, c0, u1 - u0, c1 - c0);
      // How it is painted, and why not through SNAP.alpha (a deliberate departure from P5). Every wedge is drawn
      // afresh each frame in whole pixels, its colour already scaled to the brightness T it should show, with
      // 'lighten'. After the shared fade a pixel holds 0.88·Tprev, and lighten leaves max(T, 0.88·Tprev): T while the
      // note falls no faster than the fade, the canvas's own fade when it falls faster. That is exactly the screen
      // SNAP.alpha(T, Tprev) aims for, but it does not depend on what the canvas held a step earlier. A held mark drawn
      // at a small alpha settles, in 8 bits, at a level that depends on its history (up to 11 levels apart after a
      // seek, measured), so a seek would not draw what playing through draws. Lighten never darkens, so a Blade clip
      // does not blot out the clips under it; whole pixels keep the edges free of history too.
      g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
      // The cliff itself, faint: the playhead the notes run into.
      g.fillStyle = 'rgb(14,12,10)'; rect(-1, 0, 0, floor ? W : H);
      const chords = typeof CHORDS !== 'undefined' ? CHORDS : [];
      if (!chords.length) return;
      // Each wedge keeps the knobs its attack was struck with; one struck before a seek takes them as they are now.
      const marks = this.marks || (this.marks = new Map()), picks = x.onPicks();
      const now = { touch: x.p('touch'), ring: x.p('ring'), size: x.p('size') };
      const { lo, hi } = rangeOf(chords), fr = (m) => Math.max(0, Math.min(1, (m - lo) / (hi - lo))), ofM = floor ? (m) => Math.round(W * (0.1 + 0.8 * fr(m))) : (m) => Math.round(H * (0.9 - 0.8 * fr(m)));
      const t = x.t;
      // Oldest first, so a later note, and above all the same pitch struck again, lands at its full height over
      // what is left of the first one (P7).
      for (let i = first(chords, t - BACK); i < chords.length && chords[i].t <= t; i++) {
        const ch = chords[i], age = t - ch.t, k = marks.get(ch.t) || now;
        const pre = SNAP.preset(k.touch), ring = k.ring, size = k.size;
        const L = pre.L * ring, cutW = CUT, wsum = pre.wb + pre.wt;
        if (age >= L) continue;
        for (const n of ch.notes) {
          const a = n.amount == null ? 1 : n.amount, P = SNAP.peak(n.v, picks);
          const hb = SNAP.hb(n.m, pre, ring), d = n.d == null ? Infinity : n.d, dampd = d < 0.15 && n.m < 89;
          // The note's own future: its body (and the preset's quiet tail) without the strike, cut away at L,
          // and choked early only if it was written really short below the undamped top strings.
          const prof = (s) => {
            let e = (pre.wb * Math.pow(0.5, s / hb) + (pre.wt ? pre.wt * Math.pow(0.5, s / (8 * hb)) : 0)) / wsum;
            e *= 1 - smooth(L - cutW, L, s);
            if (dampd && s > d) e *= Math.pow(0.5, (s - d) / 0.06);
            return e;
          };
          const h0 = (22 + 185 * P) * size;
          // Brightness follows the note's own envelope: a flash over a dim body that both grow darker and thinner as the
          // note rings, never brighter again after the peak. Tp maps the peak onto the screen, so even a soft note's
          // strike is seen.
          const Tp = Math.min(0.98, 0.5 + 0.48 * P);
          // The strike (full, then halving every 60 ms) over a ringing body at BODY of the peak that follows the note's
          // own profile slowly (its 0.2 power: a long bass note stays readable for seconds while its wedge thins).
          // T is the larger of the two, both only fall, so nothing re-brightens and the attack, T = Tp, is the brightest
          // moment by 1/BODY.
          const fl = Math.min(1, SNAP.flash(age) * SNAP.gain(a)), pa = prof(age);
          const T = Math.min(0.98, Tp * Math.max(fl, BODY * Math.pow(pa, 0.2)));
          if (T < 0.004) continue;
          // At the cliff a loud note jumps past its height and rings back; intensity above 1 cracks taller still.
          // The jump belongs to the strike, so it fades out within the first few pixels of the wedge.
          const jolt = SNAP.size(age, n.v, { preset: pre }) * (1 + 0.35 * (SNAP.gain(a) - 1) * SNAP.flash(age)) - 1;
          const y = ofM(n.m), col = SNAP.hot(tint(n.m), age, a);
          const h00 = (h0 / 2) * Math.pow(prof(age), TAPER) * (1 + jolt);
          if (h00 < 0.5) continue;
          g.fillStyle = rgb(col, T);
          // Columns of the same height are merged into one rectangle: the long thin tail is a handful of fills.
          let end = 0, runX = 0, runT = 0, runB = 0;
          for (let u = 0; u < reach; u += STEP) {
            const s = age + u / PXS;
            if (s >= L) break;
            const hh = (h0 / 2) * Math.pow(prof(s), TAPER) * (1 + jolt * Math.exp(-u / 14));
            const top = Math.round(y - hh), bot = Math.round(y + hh);
            if (bot <= top) break;
            if (top !== runT || bot !== runB) {
              if (end > runX) rect(runX, end, runT, runB);
              runX = u; runT = top; runB = bot;
            }
            end = u + STEP;
          }
          if (end > runX) rect(runX, end, runT, runB);
          // The note's line through its wedge, a shade lighter: the roll reads as pitches, not as a heap of shapes.
          g.fillStyle = rgb(col, Math.min(1, T * 1.3));
          rect(0, end, y, y + 1);
          // The cliff face, lit: bone while the strike lasts, its own colour, a little paler, after.
          const face = col.map((c, k) => c + (SNAP.BONE[k] - c) * 0.35);
          g.fillStyle = rgb(face, Math.min(1, T * 1.15));
          const ft = Math.round(y - h00), fb = Math.round(y + h00);
          rect(-1, 2, ft, ft + Math.max(1, fb - ft));
        }
      }
    },
  });
})();
