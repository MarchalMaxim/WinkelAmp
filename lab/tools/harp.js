// Harp string (the user, 2026-11-10: "a glissando'ing major chord really sounds like an angel pulling a golden harp string
// which reverberates with a soft aura"). One upright string per note. On its attack the string is pulled aside and let go:
// it swings, less and less, for as long as the note rings, inside a soft glow that blooms just after the pull and outlasts
// the swing. Notes close in time are one sweep: its strings are pulled the way the sweep runs, and they take their colour
// from its chord, gold when it is major, a pale silver blue when it is minor. The 'how dreamy' knob replaces the drawn
// line by a distribution of light, widest where the string swings most (the user: "blur them to really give that dreamy feeling").
// A string stands where Ivory stands a lone key of that pitch, and reaches as high (the ground, the place across the width
// and the height all follow the note's register in the whole piece), so a sweep can lead to a key in the same picture.
// Nothing happens between attacks: a string only swings down and fades. Stateless: every frame is worked out from CHORDS
// and the song time, so a seek needs no replay.
(() => {
  const W = 1280, H = 720, BASE = H * 0.88, TOP = BASE * 0.9;          // Ivory's ground and its tallest key
  const GAP = 0.8, MAX_LIVE = 24, SEG = 24;                            // seconds of silence that end a sweep; strings drawn at once; pieces per string
  const FLASH = 0.033, BLOOM = 0.12;                                   // seconds: the strike holds two steps; the glow opens
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  // The string's own colour and its glow's, by the sweep's chord.
  const LOOK = {
    major: { core: [255, 210, 112], aura: [236, 158, 36] },
    minor: { core: [214, 226, 244], aura: [92, 118, 178] },
    open: { core: [246, 230, 196], aura: [176, 136, 72] },             // neither third is there: a paler gold
  };
  const BONE = [255, 247, 228];
  const LEVELS = 28;                                                   // steps of the bell curve across a dreamy string

  /** The piece's pitch range, as Ivory reads it (2nd to 98th percentile note); null when it is not known. */
  function pieceRange() {
    const w = typeof window !== 'undefined' ? window : null, all = (w && (w.SONG_NOTES || w.NOTES)) || [];
    if (!Array.isArray(all)) return null;
    const ms = all.map((n) => n[2]).filter(Number.isFinite).sort((a, b) => a - b);
    if (ms.length < 2) return null;
    const lo = ms[Math.floor(0.02 * (ms.length - 1))], hi = ms[Math.ceil(0.98 * (ms.length - 1))];
    return hi > lo ? { lo, hi } : null;
  }
  /** Major, minor or open, from the pitches of one sweep. The root is a note that has its third and its fifth in the sweep
      (the lowest such note; a major triad before a minor one); without one, the lowest note is the root. */
  function chordOf(ms) {
    const sorted = [...ms].sort((a, b) => a - b), has = (root, k) => ms.some((m) => ((m - root) % 12 + 12) % 12 === k);
    for (const third of [4, 3]) for (const root of sorted) if (has(root, third) && has(root, 7)) return third === 4 ? 'major' : 'minor';
    return has(sorted[0], 4) ? 'major' : has(sorted[0], 3) ? 'minor' : 'open';
  }
  /** Every pull, in time order: { t, m, v, d, a, x, h, dir, look }. */
  function planOf(chords, piece) {
    const pulls = [];
    for (const c of chords) for (const n of c.notes) pulls.push({ t: c.t, m: n.m, v: n.v, d: n.d, a: n.amount ?? 1 });
    if (!pulls.length) return pulls;
    let lo = piece ? piece.lo : Math.min(...pulls.map((p) => p.m)), hi = piece ? piece.hi : Math.max(...pulls.map((p) => p.m));
    if (hi - lo < 12) { const c = (lo + hi) / 2; lo = c - 6; hi = c + 6; }
    for (let i = 0; i < pulls.length;) {
      let j = i;
      while (j + 1 < pulls.length && pulls[j + 1].t - pulls[j].t < GAP) j++;
      const sweep = pulls.slice(i, j + 1), look = LOOK[chordOf(sweep.map((p) => p.m))];
      const dir = sweep[sweep.length - 1].m >= sweep[0].m ? 1 : -1;
      for (const p of sweep) {
        const reg = clamp((p.m - lo) / (hi - lo), 0, 1);
        p.x = W * (0.08 + 0.84 * reg); p.h = TOP * (0.2 + 0.78 * reg); p.dir = dir; p.look = look;
      }
      i = j + 1;
    }
    return pulls;
  }

  let plan = null, planFor = null;
  const rgb = (c, k) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

  TOOLS.push({
    id: 'harp', name: 'Harp string', tag: 'new',
    blurb: 'Each note pulls one upright string aside and lets it go. It swings for as long as the note rings, in a soft glow. A rolled chord is one sweep of strings: gold when the chord is major, silver blue when it is minor. A string stands where Ivory would stand a key of that note.',
    params: [
      { key: 'pull', label: 'how far it is pulled', min: 0.3, max: 2.5, value: 1, less: 0.5,
        hint: 'How far a note pulls its string aside. Left: a tremble. Right: a wide swing.',
        icon: (g, v, w, h) => { const x = w / 2, a = 2 + v * (w / 2 - 5); g.strokeStyle = ICON.gold; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, h - 3); g.quadraticCurveTo(x + 2 * a, h / 2, x, 3); g.stroke(); } },
      { key: 'ring', label: 'how long it rings', min: 0.3, max: 2.5, value: 1, less: 0.4,
        hint: 'How long a string keeps swinging and glowing, against how long its note rings. Left: soon still. Right: more than twice as long.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.gold, 'line') },
      { key: 'aura', label: 'how wide the glow is', min: 0, max: 2.5, value: 1, less: 0.4,
        hint: 'The soft glow around a string. Left: the bare string. Right: a wide halo.',
        icon: (g, v, w, h) => { const e = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 2 + v * (w / 2 - 2)); e.addColorStop(0, ICON.gold); e.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = e; g.fillRect(0, 0, w, h); ICON.line(g, w / 2, 3, w / 2, h - 3, ICON.ink, 1); } },
      { key: 'dream', label: 'how dreamy', min: 0, max: 1, value: 0.6,
        hint: 'How much the string dissolves into light. Left: a sharp, drawn string. Right: no line at all, only a cloud of light, widest where the string swings most, that narrows as it comes to rest.',
        icon: (g, v, w, h) => { const e = g.createLinearGradient(w / 2 - 2 - v * (w / 2 - 4), 0, w / 2 + 2 + v * (w / 2 - 4), 0); e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(0.5, ICON.gold); e.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = e; g.fillRect(0, 3, w, h - 6); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much each note leaves: how far its string swings, how long it rings and how wide it glows. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { plan = null; planFor = null; },
    onChord() {},
    frame(x) {
      const all = typeof CHORDS !== 'undefined' ? CHORDS : [];
      if (planFor !== all || !plan) { plan = planOf(all, pieceRange()); planFor = all; }
      if (!plan.length) return;
      const pull = x.p('pull') ?? 1, ringK = x.p('ring') ?? 1, auraK = x.p('aura') ?? 1;
      const dream = clamp(x.p('dream') ?? 0.6, 0, 1);
      // The strings still ringing: the latest pull of each pitch, newest first.
      const live = [], seen = new Set();
      for (let i = plan.length - 1; i >= 0 && live.length < MAX_LIVE; i--) {
        const p = plan[i], age = x.t - p.t;
        if (age < 0) continue;
        if (age > 6 * 2.5) break;
        if (seen.has(p.m)) continue;
        seen.add(p.m);
        const R = clamp(p.d || 1.2, 1.2, 6) * ringK;                    // how long this string is on screen
        if (age < R) live.push({ p, age, R });
      }
      if (!live.length) return;
      const g = x.g;
      g.save();
      g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1; g.lineCap = 'round'; g.lineJoin = 'round';
      for (const { p, age, R } of live) {
        const u = clamp((p.v || 0) / 127, 0, 1), gain = Math.min(1.4, p.a), out = 1 - smooth((age - (R - 0.7)) / 0.7);
        const peak = clamp((0.62 + 0.38 * Math.pow(u, 1.3)) * Math.min(1, 0.35 + 0.65 * p.a), 0, 1);
        const tau = R / 3, flash = age < FLASH ? 1 : Math.pow(0.5, (age - FLASH) / 0.06);
        const amp0 = pull * (7 + 30 * u) * gain * (0.75 + 0.5 * p.h / TOP), amp = amp0 * Math.exp(-age / tau);
        const yc = BASE - p.h / 2;
        // The glow: an upright oval of light, half open at the pull, fully open a moment later, fading slower than the swing.
        if (auraK > 0) {
          const E = peak * 0.85 * (1 - 0.5 * Math.exp(-age / BLOOM)) * Math.exp(-age / (tau * 1.8)) * out;
          if (E * 222 > 3) {
            const rx = auraK * (46 + 2.2 * amp0), ry = p.h / 2 + 26;
            g.save(); g.translate(p.x, yc); g.scale(rx, ry);
            const e = g.createRadialGradient(0, 0, 0, 0, 0, 1);
            e.addColorStop(0, rgb(p.look.aura, E)); e.addColorStop(0.4, rgb(p.look.aura, E * 0.42)); e.addColorStop(1, 'rgb(0,0,0)');
            g.fillStyle = e; g.fillRect(-1, -1, 2, 2); g.restore();
          }
        }
        // The string: a half wave between its two ends, with a second, quicker one that dies first, so it starts out pulled
        // low and to the side. A low string swings slower than a high one.
        const f = 4 + 5 * p.h / TOP, ph = 2 * Math.PI * f * age;
        const a1 = amp * Math.cos(ph), a2 = 0.3 * amp0 * Math.exp(-age / (tau / 2.5)) * Math.cos(2 * ph);
        const Es = peak * Math.max(flash, 0.3 + 0.7 * Math.exp(-age / tau)) * out;
        if (Es * 255 < 3) continue;
        const c = [0, 1, 2].map((i) => p.look.core[i] + (BONE[i] - p.look.core[i]) * flash);
        // How dreamy: the line gives way to a distribution of light, a bell curve across the string with no core, as wide
        // as the string is swinging at that height.
        const off = (s) => p.dir * (a1 * Math.sin(Math.PI * s) + a2 * Math.sin(2 * Math.PI * s));
        const line = Es * (1 - smooth(dream / 0.5));
        if (line * 255 >= 3) {
          g.beginPath(); g.moveTo(p.x, BASE);
          for (let k = 1; k <= SEG; k++) g.lineTo(p.x + off(k / SEG), BASE - p.h * k / SEG);
          g.strokeStyle = rgb(c, line); g.lineWidth = 1.8 + 2.4 * flash; g.stroke();
        }
        const cloud = Es * smooth(dream / 0.4) * (1 - 0.25 * dream);
        if (cloud * 255 < 3) continue;
        // Nested lenses, wide and faint to narrow and bright: the levels of the bell curve (a blur filter took 64 ms a frame).
        const cx = [], sd = [];
        // The cloud does not swing: it is where the string has been, leaning the way it was pulled and narrowing as it rests.
        const sway = 1 - smooth(dream / 0.5), lean = p.dir * 0.35 * amp * (1 - sway);
        for (let k = 0; k <= SEG; k++) { const s = k / SEG, bell = Math.sin(Math.PI * s); cx.push(p.x + off(s) * sway + lean * bell); sd.push(dream * (7 + 17 * dream + 0.6 * amp) * bell); }
        for (let q = 0; q < LEVELS; q++) {
          const z = 3 * (1 - q / LEVELS);
          g.beginPath(); g.moveTo(cx[0], BASE);
          for (let k = 1; k <= SEG; k++) g.lineTo(cx[k] + z * sd[k], BASE - p.h * k / SEG);
          for (let k = SEG - 1; k >= 0; k--) g.lineTo(cx[k] - z * sd[k], BASE - p.h * k / SEG);
          g.fillStyle = rgb(c, cloud * Math.exp(-0.5 * z * z)); g.fill();
        }
      }
      g.restore();
    },
  });
})();
