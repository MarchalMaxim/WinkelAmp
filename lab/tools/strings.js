// Woven threads (v2 of "Piano strings"): every sounding note is a curved thread in one woven band.
// Threads lean toward consonant partners and knot up against dissonant ones; each chord braids its
// notes together at the shuttle's spot and sends bright kinks running away from it; held notes
// thicken and glow; the hardest, most crowded chords snap a thread and whip the whole weave.
// The "bend" knob curls the flat loom into arcs and, at 1, into closed woven rings. "How present" tones the whole weave down. Six knobs;
// the others are fixed at the defaults the user accepted (FIX below).
(() => {
  const SEG = 200, TAU = Math.PI * 2, LINGER = 0.9, MAXT = 22;
  const DISS = [0, 1, 0.6, 0.18, 0.1, 0.04, 0.85];       // roughness by interval class 0..6
  const PAL = [                                           // [low, high] colour per heat stop
    [[26, 40, 104], [200, 226, 255]],                     // 0: ink blue → ice
    [[132, 8, 14], [244, 230, 210]],                      // .5: blood → bone
    [[160, 40, 0], [255, 216, 100]],                      // 1: ember → gold
  ];
  // The knobs that are no longer on the card, fixed at the defaults the user accepted. Flow and pull still follow the
  // music exactly as their old default drives did (base + half the old range × the feature).
  const FIX = { spread: 0.7, weight: 1.1, snap: 0.5 };
  const flowOf = (x) => Math.max(0, Math.min(2, 0.45 + 1 * 0.5 * (2 - 0) * x.feat.rate));     // faster → the weave flows quicker
  const pullOf = (x) => Math.max(0, Math.min(1, 0.4 + 1 * 0.5 * (1 - 0) * x.feat.level));     // louder → consonant notes lean closer
  // how present (0..1): which notes pluck a thread. A note counts by its rank among this piece's notes (recordings differ
  // a lot in how hard they play): every one at 1, the hardest half at 0.47, the hardest 5% at 0. Threads don't last like
  // Rorschach's ink, so that alone would leave quiet passages dead; a note also counts by its rank among the notes within
  // 3 s of it, so each passage keeps answering its own peaks.
  let vels = null;
  const hardEnough = (v, x) => {
    const cut = (1 - x.p('presence')) * 0.95, N = window.NOTES || [];
    if (cut <= 0 || !N.length) return true;
    if (!vels) vels = N.map((n) => n[3]).sort((a, b) => a - b);
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    if (a / vels.length >= cut) return true;
    a = 0; b = N.length; while (a < b) { const k = (a + b) >> 1; if (N[k][0] < x.t - 3) a = k + 1; else b = k; }
    let peers = 0, near = 0;                             // notes this one is at least as hard as, itself included: a shared peak still counts
    for (let i = a; i < N.length && N[i][0] <= x.t + 3; i++) { near++; if (N[i][3] <= v) peers++; }
    return near < 2 || (peers - 1) / (near - 1) >= cut;  // a lone note is its own peak
  };
  const calmOf = (x) => 1 - 0.82 * (1 - x.p('presence'));  // how much of the motion is left: exactly 1 at full presence
  const inkOf = (x) => 1 - 0.84 * (1 - x.p('presence'));   // how much of the light is left: exactly 1 at full presence
  let th = new Map(), phase = 0, centre = 0.5, shuttle = 0.3, whip = 0, time = 0;
  const hash = (m, k) => { const s = Math.sin(m * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const wrap = (d) => d - Math.round(d);                  // signed distance on the loop -0.5..0.5

  function palette(p, heat) {
    const h = heat * 2, i = Math.min(1, Math.floor(h)), k = h - i, c = Math.pow(p, 2.2), out = [0, 0, 0];
    for (let j = 0; j < 3; j++) out[j] = lerp(lerp(PAL[i][0][j], PAL[i][1][j], c), lerp(PAL[i + 1][0][j], PAL[i + 1][1][j], c), k);
    return out;
  }
  function make(m) {
    const fifths = ((m * 7) % 12) / 12;                   // circle-of-fifths position sets the weave phase
    return { m, p: Math.max(0, Math.min(1, (m - 21) / 87)), phi: fifths * TAU, dir: m % 2 ? 1 : -1, seed: hash(m, 1), seed2: hash(m, 2) * TAU,
      end: 0, after: 0, held: 0, v: 80, flash: 0, pulses: [], braid: null, snap: null, shift: 0, tangle: 0, pts: new Float32Array((SEG + 1) * 2) };
  }

  TOOLS.push({
    id: 'strings', name: 'Woven threads', tag: 'v2',
    blurb: 'Each note is a curved thread in one woven band. Consonant notes lean together, clashing ones knot up; every chord braids its notes at one spot and sends bright kinks running along them; held notes swell and glow; the hardest chords snap a thread and whip the weave. Six knobs now, all starting at the defaults you accepted; "how present" tones it all down.',
    // Keys, ranges and drives of the first five unchanged, so saved settings still apply; the rest are fixed in FIX above.
    params: [
      { key: 'bend', label: 'shape: band → rings', min: 0, max: 1, value: 0.32,
        hint: 'How much the band of threads curls. Left: a straight band across the screen. Middle: an arch. Right: closed woven rings.',
        icon: (g, v, w, h) => bendIcon(g, v, w, h) },
      { key: 'weave', label: 'crossings', min: 1, max: 9, step: 1, value: 3,
        hint: 'How many times the threads cross each other along the band. Left: one long, slow wave. Right: a tight weave.',
        icon: (g, v, w, h) => { const c = 1 + Math.round(v * 8) * 0.5; ICON.wave(g, w, h, 0.6, c, '#c4483c', 1.4); ICON.wave(g, w, h, -0.6, c, ICON.ink, 1.4); } },
      { key: 'sway', label: 'how much they sway', min: 0, max: 160, value: 46, drive: '+level',
        hint: 'How far the threads swing up and down. Left: flat, still threads. Right: wide swinging waves.',
        icon: (g, v, w, h) => { ICON.wave(g, w, h, 0.04 + v * 0.9, 1.5, '#c4483c', 1.4); ICON.alpha(g, 0.6, () => ICON.wave(g, w, h, -(0.04 + v * 0.9), 1.5, ICON.ink, 1.2)); } },
      { key: 'tangle', label: 'knots on clashing notes', min: 0, max: 1, value: 0.45, drive: '+density',
        hint: 'How much a thread curls into knots when its note clashes with another (a dissonance). Left: never knots. Right: big tangled curls.',
        icon: (g, v, w, h) => knotIcon(g, v, w, h) },
      { key: 'heat', label: 'colours', min: 0, max: 1, value: 0.5,
        hint: 'The colours of the threads (low notes darker, high notes paler). Left: ink blue and ice. Middle: blood red and bone. Right: ember and gold.',
        icon: (g, v, w, h) => { [0.05, 0.4, 0.75, 1].forEach((p, i) => { const c = palette(p, v); ICON.line(g, 3, 5 + i * 5.3, w - 3, 5 + i * 5.3, `rgb(${c.map(Math.round).join(',')})`, 2.6); }); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: a few faint, nearly still threads, and only the hardest notes pluck one. Right: every note is a thread at full light (as before).',
        icon: (g, v, w, h) => { ICON.alpha(g, 0.15 + 0.85 * v, () => { ICON.wave(g, w, h, 0.06 + 0.5 * v, 1.5, '#c4483c', 1.4); ICON.wave(g, w, h, -(0.06 + 0.5 * v), 1.5, ICON.ink, 1.4); }); } },
    ],
    reset() { vels = null; th = new Map(); phase = 0; centre = 0.5; whip = 0; time = 0; },
    onChord(ch, x) {
      shuttle = (shuttle + 0.19 + x.rnd(0, 0.2)) % 1;    // the shuttle steps across the loom, one stop per attack
      const u0 = shuttle, notes = [...ch.notes].sort((a, b) => a.m - b.m).filter((q) => hardEnough(q.v, x)), n = notes.length;
      if (!n) return;                                     // too soft for this presence: the weave doesn't answer
      let cp = 0; for (const q of notes) cp += q.m; cp = Math.max(0, Math.min(1, (cp / n - 21) / 87));
      notes.forEach((q, idx) => {
        let s = th.get(q.m);
        if (!s) { if (th.size >= MAXT) { let old = null; for (const o of th.values()) if (!old || o.end < old.end) old = o; th.delete(old.m); } th.set(q.m, (s = make(q.m))); }
        s.end = Math.max(s.end, x.t + Math.max(0.35, q.d)); s.after = 0; s.held = 0; s.v = q.v; s.flash = 1;
        const A = (6 + 46 * Math.pow(q.v / 115, 2)) * (1 - s.p * 0.45) * calmOf(x), tau = Math.min(1.8, 0.45 + q.d * 0.35);
        for (const dir of [1, -1]) s.pulses.push({ pos: u0 + x.rnd(-0.01, 0.01), dir, A, tau, age: 0 });
        if (s.pulses.length > 8) s.pulses.splice(0, s.pulses.length - 8);
        if (n >= 2) s.braid = { u0, cp, idx, n, age: 0, spin: x.rnd(3, 6) * (Math.random() < 0.5 ? 1 : -1) };
      });
      // Snap: force times crowding, so the lone fff tolls ring clean and the climax's barrage tears.
      const loud = (ch.vel - 84) / 24, crowd = 0.35 + x.feat.rate * 1.6;
      const score = loud * crowd * (n >= 3 ? 1 : 0.5), ease = FIX.snap;
      if (ease > 0 && score * x.p('presence') > 1.2 - ease) {
        const k = Math.min(n, 1 + Math.floor(score * 1.5));
        for (let i = 0; i < k; i++) { const s = th.get(notes[Math.floor(Math.random() * n)].m); if (s && !s.snap) s.snap = { u: (u0 + x.rnd(-0.15, 0.15) + 1) % 1, age: 0, A: x.rnd(60, 120) * (Math.random() < 0.5 ? 1 : -1) }; }
        whip = Math.min(1, whip + 0.35 + score * 0.15);
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H;
      time += dt;
      const bend = x.p('bend'), spread = FIX.spread, weave = Math.round(x.p('weave')), sway = x.p('sway'), flow = flowOf(x);
      const pull = pullOf(x), tangle = x.p('tangle'), weight = FIX.weight, heat = x.p('heat');
      const calm = calmOf(x), ink = inkOf(x), thin = 1 - 0.4 * (1 - x.p('presence'));
      whip *= Math.exp(-dt / 0.55);
      phase += dt * TAU * (0.08 + flow * 0.3) * calm + whip * calm * dt * 5;
      // geometry: a strip of length L, rolled around a centre by angle th0 (0 = flat loom, 2π = rings)
      const L = W * 1.12, th0 = bend * TAU, flat = th0 < 0.02;
      const Rc = flat ? 0 : L / th0, cx = W / 2, cy = flat ? 0 : H / 2 + Rc * (1 + Math.cos(th0 / 2)) / 2;
      const sc = flat ? 1 : Math.min(1, (0.72 * Rc) / (H * 0.42));
      const list = [...th.values()].sort((a, b) => a.m - b.m);
      // the band stays centred on whatever register is sounding
      const ring = bend > 0.97;
      let pm = 0, pw = 0; for (const s of list) if (x.t < s.end) { pm += s.p; pw++; }
      if (pw) centre += (pm / pw - centre) * (1 - Math.exp(-dt * calm / 0.6));
      const homeOf = (p) => Math.max(-H * 0.42, Math.min(H * 0.42, (p - centre) * spread * H * 1.7));
      // consonance pulls partners together, dissonance builds knots
      const snd = list.filter((s) => x.t < s.end);
      for (const s of list) {
        let num = 0, den = 0, rough = 0, cnt = 0;
        if (x.t < s.end) for (const o of snd) {
          if (o === s) continue;
          const ic = Math.abs(o.m - s.m) % 12, d = DISS[Math.min(ic, 12 - ic)];
          const c = 1 - d; num += c * (homeOf(o.p) - homeOf(s.p)); den += c; rough += d; cnt++;
        }
        const tgt = den ? pull * 0.6 * num / (1 + den) * calm : 0;
        s.shift += (tgt - s.shift) * (1 - Math.exp(-dt / 0.35));
        const harsh = cnt ? Math.max(0, Math.min(1, (rough / cnt - 0.12) / 0.3)) : 0; // average roughness, so big consonant chords stay smooth
        s.tangle += (harsh * tangle * calm - s.tangle) * (1 - Math.exp(-dt / (harsh ? 0.25 : 0.8)));
      }
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const s of list) {
        const sounding = x.t < s.end;
        if (sounding) s.held += dt; else s.after += dt;
        const rel = Math.min(1, s.after / LINGER), fade0 = 1 - rel;
        if (fade0 <= 0) { th.delete(s.m); continue; }
        s.flash = Math.max(0, s.flash - dt / 0.22);
        for (const q of s.pulses) { q.age += dt; q.pos += q.dir * dt * (0.18 + flow * 0.42) * calm; q.A *= Math.exp(-dt / q.tau); }
        s.pulses = s.pulses.filter((q) => q.A > 0.6);
        const b = s.braid; if (b) { b.age += dt; if (b.age > 2.2) s.braid = null; }
        const sn = s.snap; if (sn) { sn.age += dt; if (sn.age > 1.8) s.snap = null; }
        const glow = sounding ? Math.min(1, s.held / 1.6) : glowOf(s);
        const dim = Math.max(0.4, Math.exp(-Math.max(0, s.held - 2.5) / 3)); // a long-held note glows, then slowly sinks back like a piano tone
        s.glowLast = glow;
        const fade = fade0 * dim * ink;
        const home = homeOf(s.p) * (1 + rel * 0.5 * calm), amp = sway * (1 - s.p * 0.35) * (1 + whip * 0.9 + rel * 0.8) * calm;
        const kw = 0.03, bw = b ? 0.06 + b.age * 0.08 : 0, bfade = b ? Math.exp(-b.age / 0.7) * Math.min(1, b.age / 0.06) * calm : 0;
        const bR = b ? (10 + 4 * Math.min(6, b.n)) * calm : 0, bHome = b ? homeOf(b.cp) : 0;
        const gapH = sn ? 0.035 * (sn.age < 0.06 ? sn.age / 0.06 : Math.exp(-(sn.age - 0.06) / 0.6)) : 0;
        const pts = s.pts;
        for (let i = 0; i <= SEG; i++) {
          const u = i / SEG;
          let X = u * L, Y = home;
          Y += s.shift * (0.55 + 0.45 * Math.sin(TAU * u + s.seed * TAU));
          Y += amp * Math.sin(TAU * weave * u - phase * s.dir + s.phi);
          if (bfade > 0.01) {
            const d = wrap(u - b.u0), env = Math.exp(-(d * d) / (bw * bw)) * bfade;
            if (env > 0.003) Y = lerp(Y, bHome + bR * Math.sin(TAU * 20 * d + TAU * b.idx / b.n + b.age * b.spin), env);
          }
          for (const q of s.pulses) { const z = wrap(u - q.pos) / kw; if (z > -3 && z < 3) Y += q.A * 2.33 * z * Math.exp(-z * z); }
          if (s.tangle > 0.02) {
            const e = Math.sin(TAU * 2 * u + s.seed2);
            if (e > 0.5) { const r = s.tangle * 38 * Math.pow((e - 0.5) * 2, 3), a = TAU * 18 * u + time * 5 * s.dir; X += r * Math.cos(a); Y += r * Math.sin(a); }
          }
          if (sn) {
            const d = wrap(u - sn.u), ad = Math.abs(d), sg = d < 0 ? -1 : 1;
            if (ad < gapH) { pts[i * 2] = NaN; continue; }
            Y += sn.A * calm * Math.exp(-ad / 0.09) * Math.exp(-sn.age / 0.45) * Math.sin(sn.age * 24 - ad * 50) * sg;
            X -= sg * 70 * calm * Math.exp(-ad / 0.06) * Math.exp(-sn.age / 0.35);
          }
          if (flat) { pts[i * 2] = cx + X - L / 2; pts[i * 2 + 1] = H / 2 + Y; }
          else { const a = (X / L - 0.5) * th0, r = Rc - Y * sc; pts[i * 2] = cx + r * Math.sin(a); pts[i * 2 + 1] = cy - r * Math.cos(a); }
        }
        const trace = (i0, i1) => {
          g.beginPath(); let pen = false;
          for (let j = i0; j <= i1; j++) {
            // a closed ring wraps round; an open loom or arc stops at its ends
            const i = ring ? ((j % SEG) + SEG) % SEG : j;
            if (i < 0 || i > SEG) { pen = false; continue; }
            const px = pts[i * 2], py = pts[i * 2 + 1];
            if (px !== px) { pen = false; continue; }
            if (!pen) { g.moveTo(px, py); pen = true; } else g.lineTo(px, py);
          }
        };
        const base = palette(s.p, heat), exc = Math.min(1, s.flash * 0.7 + glow * 0.2);
        const col = `rgb(${Math.round(lerp(base[0], 255, exc * 0.55))},${Math.round(lerp(base[1], 244, exc * 0.55))},${Math.round(lerp(base[2], 228, exc * 0.55))})`;
        const w = lerp(5, 0.9, Math.pow(s.p, 0.6)) * (0.35 + 0.65 * Math.min(1.1, s.v / 105)) * weight * (1 + 1.1 * glow) * (1 + s.flash * 0.4) * thin;
        trace(0, SEG);
        // held notes swell and glow
        g.globalCompositeOperation = 'lighter';
        if (glow > 0.25 || s.flash > 0.2) { g.globalAlpha = fade * (0.1 * glow + 0.1 * s.flash); g.strokeStyle = col; g.lineWidth = w * 3 + 4; g.stroke(); }
        g.strokeStyle = col;
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = fade * (0.35 + 0.35 * Math.min(1, s.v / 100) + 0.3 * Math.max(glow, s.flash)); g.lineWidth = w; g.stroke();
        // kinks: the bright part runs along the thread
        g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgb(255,236,200)';
        for (const q of s.pulses) {
          const ic = Math.round(((q.pos % 1) + 1) % 1 * SEG), hw = Math.round(kw * 2.6 * SEG);
          g.globalAlpha = fade * Math.min(1, q.A / 30); g.lineWidth = w * 0.7 + 1.6; trace(ic - hw, ic + hw); g.stroke();
        }
        // the torn ends spark
        if (sn && sn.age < 0.7) {
          g.fillStyle = 'rgb(255,240,210)'; g.globalAlpha = (1 - sn.age / 0.7) * ink;
          for (const sg of [-1, 1]) {
            const i = ((Math.round((sn.u + sg * (gapH + 0.004)) * SEG) % SEG) + SEG) % SEG, px = pts[i * 2];
            if (px === px) { g.beginPath(); g.arc(px, pts[i * 2 + 1], 2 + w * 0.8, 0, TAU); g.fill(); }
          }
        }
        g.globalCompositeOperation = 'source-over';
      }
      g.globalAlpha = 1;
    },
  });
  function glowOf(s) { return (s.glowLast ?? 0) * 0.97; }
  // Knob pictures. bend: three threads on a strip rolled the way the widget rolls its loom (0 = flat, 1 = a closed ring).
  function bendIcon(g, v, w, h) {
    const L = 34, th0 = v * TAU, cols = ['#c4483c', ICON.ink, '#e0b04a'];
    [-3, 0, 3].forEach((off, k) => {
      g.strokeStyle = cols[k]; g.lineWidth = 1.3; g.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        if (th0 < 0.05) { const px = w / 2 + (u - 0.5) * L, py = h / 2 + off; i ? g.lineTo(px, py) : g.moveTo(px, py); continue; }
        const Rc = L / th0, cy = h / 2 + (Rc * (1 + Math.cos(th0 / 2))) / 2, a = (u - 0.5) * th0, r = Rc - off;
        const px = w / 2 + r * Math.sin(a), py = cy - r * Math.cos(a); i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    });
  }
  // tangle: a thread that curls into a knot in the middle, the curl growing with v; a plain thread below for comparison.
  function knotIcon(g, v, w, h) {
    ICON.line(g, 3, h / 2 + 7, w - 3, h / 2 + 7, ICON.dim, 1.2);
    g.strokeStyle = '#c4483c'; g.lineWidth = 1.3; g.beginPath();
    for (let i = 0; i <= 160; i++) {
      const u = i / 160, e = Math.exp(-(((u - 0.5) / 0.2) ** 2)), r = v * 7.5 * e * e, a = TAU * 7 * u;
      const px = 3 + u * (w - 6) + r * Math.cos(a), py = h / 2 - 2 + r * Math.sin(a); i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
  }
})();
