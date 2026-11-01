// Comfort: big soft fields of colour, flat and overlapping, melting into each other with no light on them and no edge to
// hold on to, nearer a Rothko than a still life. They breathe together about once in 10 seconds. A note is a gentle press:
// the field's own colour starts rising in the same frame (never a flash), its edge gives over half a second and takes
// about 5 seconds to come back, while the fields nearby slowly lean in. Everything is overdamped, so nothing overshoots.
// The fields are laid out for each song and wander over minutes, so the picture at minute 5 is not the one at minute 1.
// Drawn crisp into a small buffer, blurred once and scaled up, which is what melts every edge, and keeps it cheap.
(() => {
  const S = 0.22, MARGIN = 18, SOFT = 4.6, NODES = 40, TAU = Math.PI * 2;
  const COS = new Float32Array(NODES), SIN = new Float32Array(NODES);
  for (let i = 0; i < NODES; i++) { COS[i] = Math.cos((i / NODES) * TAU); SIN[i] = Math.sin((i / NODES) * TAU); }
  const PAL = [[184, 105, 74], [217, 196, 160], [141, 148, 120], [184, 140, 148]];   // terracotta, oat, sage, dusty mauve-rose (a warmer pink reads as skin)
  const ORDER = [0, 1, 2, 3, 1, 0, 3, 2, 1, 3, 0, 2, 3, 1];
  const UMBER = [36, 26, 20], AMBER = [240, 176, 112], ROSE = [214, 170, 164], DUSK = [135, 122, 128], LAMP = [216, 154, 92];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // A field warmed from within keeps its own hue: more of its colour and brighter, with only a breath of the room's warmth.
  const inner = (c, room) => {
    const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11, f = 1.18;
    const o = [(c[0] + (c[0] - l) * 0.35) * f, (c[1] + (c[1] - l) * 0.35) * f, (c[2] + (c[2] - l) * 0.35) * f];
    return mix([Math.min(246, o[0]), Math.min(246, o[1]), Math.min(246, o[2])], room, 0.08);
  };

  let lay = null, lg = null, buf = null, bg = null, grain = null, grainPat = null, forms = [], builtN = 0, builtW = 0, builtSeed = -1, snap = true;
  let phase = 0, sigh = 0, sighGoal = 0, lamp = 0, pitches = null, vels = null;

  function sprites(W, H) {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    buf = mk(Math.ceil(W * S), Math.ceil(H * S)); bg = buf.getContext('2d');
    lay = mk(buf.width + MARGIN * 2, buf.height + MARGIN * 2); lg = lay.getContext('2d');   // the margin keeps the blur from fading at the frame
    grain = mk(160, 160);
    { const s = grain.getContext('2d'), R = ICON.rng(23);
      for (let i = 0; i < 9000; i++) { s.fillStyle = R() < 0.5 ? `rgba(255,235,210,${R() * 0.022})` : `rgba(10,5,2,${R() * 0.03})`; s.fillRect(R() * 160, R() * 160, 1, 1); } }
    grainPat = bg.createPattern(grain, 'repeat');
  }
  const mkSlot = () => ({ a: 0, wide: 1, goal: 0, d: 0, wg: 0, warm: 0, fl: 0, flush: 0, tw: 3 });
  const songSeed = () => { const N = window.NOTES || []; return N.length ? N.length + Math.round(N[0][2]) * 31 : 0; };
  // The fields: big and low first, small and high last. They overlap on purpose and run off the frame, so nothing is a thing
  // lying on another; the same song and count always give the same start, and each song its own.
  function build(n, W, H, seed) {
    if (!buf || builtW !== W) sprites(W, H);
    const R = ICON.rng(11 + n * 7 + seed), radii = [];
    let sum = 0;
    for (let i = 0; i < n; i++) { const r = (1.5 - 1.02 * (i / Math.max(1, n - 1))) * (0.92 + 0.16 * R()); radii.push(r); sum += r * r; }
    const scale = Math.sqrt((2.2 * W * H) / (Math.PI * sum));
    const off = R();
    forms = radii.map((r, i) => {
      const f = i / Math.max(1, n - 1), axes = [], ax = 1.05 + 0.6 * R();
      for (const k of [2, 3, 5]) axes.push([k, k === 2 ? 0.1 + 0.1 * R() : k === 3 ? 0.08 + 0.1 * R() : 0.012 + 0.025 * R(), R() * TAU, (R() < 0.5 ? -1 : 1) * (0.006 + 0.012 * R())]);
      const c = ORDER[i % ORDER.length];
      return { f, R0: r * scale, axes, ax, ay: 1 / ax, rot: (R() - 0.5) * 0.9, x0: W * (0.03 + 0.94 * ((off + i * 0.618) % 1)), y0: H * (0.94 - 0.82 * f + (R() - 0.5) * 0.16),
        cx: 0, cy: 0, R: r * scale, c0: PAL[c], c1: PAL[(c + 1 + (R() < 0.5 ? 0 : 1)) % 4], cw: TAU / (170 + 200 * R()), cph: R() * TAU,
        wx: TAU / (110 + 170 * R()), wy: TAU / (130 + 190 * R()), px: R() * TAU, py: R() * TAU, slots: [mkSlot(), mkSlot()], sag: 0, delay: 0, fx: 0, fy: 0 };
    });
    for (const F of forms) F.delay = (F.x0 / W) * 1.5 + (F.y0 / H) * 0.5;
    builtN = n; builtW = W; builtSeed = seed; snap = true;
  }
  const count = (v) => Math.round(v < 0.5 ? 14 - 12 * v : 8 - 8 * (v - 0.5));
  const ensure = (x) => { const n = count(x.p('size')), seed = songSeed(); if (n !== builtN || x.W !== builtW || seed !== builtSeed) build(n, x.W, x.H, seed); };
  function loadSong() {
    pitches = (window.NOTES || []).map((n) => n[2]).sort((a, b) => a - b);
    vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
  }
  const rank = (arr, v) => { let a = 0, b = arr.length; while (a < b) { const k = (a + b) >> 1; if (arr[k] < v) a = k + 1; else b = k; } return arr.length ? a / arr.length : 0.5; };
  // A place on this field that later fields do not cover, so the press can be seen.
  function spot(F, x) {
    const me = forms.indexOf(F); let best = 0, bestC = 1e9;
    for (let t = 0; t < 6; t++) {
      const a = x.rnd(0, TAU), px = F.cx + Math.cos(a) * F.R * 0.42, py = F.cy + Math.sin(a) * F.R * 0.42; let c = 0;
      for (let j = me + 1; j < forms.length; j++) { const Q = forms[j], d = Math.hypot(px - Q.cx, py - Q.cy) / Q.R; if (d < 1.05) c += 1.05 - d; }
      if (c < bestC) { bestC = c; best = a; }
    }
    return best;
  }
  function pressNote(n, wide, x, gentle) {
    if (!forms.length) return;
    const F = forms[clamp(Math.floor(rank(pitches, n.m) * forms.length), 0, forms.length - 1)];
    const amp = Math.sqrt(clamp(n.v / 112, 0.06, 1));             // a fortissimo is a deeper sigh, not a hit
    // A slot that has come back takes a new place; otherwise the note merges into the press already there, which never jumps.
    const [p, q] = F.slots[0].d + F.slots[0].wg >= F.slots[1].d + F.slots[1].wg ? F.slots : [F.slots[1], F.slots[0]];
    let s = p;
    if (q.d < 0.08 && q.wg < 0.1) { s = q; s.a = spot(F, x); s.wide = wide; s.tw = 0; }
    s.goal = Math.max(s.goal, amp * x.p('press')); s.wide = Math.max(s.wide, wide);
    s.wg = Math.max(s.wg, amp * gentle); s.flush = Math.max(s.flush, amp * gentle);
    s.tw = Math.max(s.tw, x.p('stay') * 0.42 * (0.55 + Math.min(4, n.d) * 0.55));
  }
  // The edge of a field, in buffer space. It slowly changes shape with the song's clock.
  const NX = new Float32Array(NODES), NY = new Float32Array(NODES);
  function outline(F, t) {
    const cr = Math.cos(F.rot), sr = Math.sin(F.rot);
    for (let i = 0; i < NODES; i++) {
      const th = (i / NODES) * TAU; let r = 1;
      for (const [m, amp, ph, sp] of F.axes) r += amp * Math.sin(m * th + ph + t * sp);
      r *= F.R;
      for (const s of F.slots) if (s.d > 0.004) {
        let da = th - s.a; da = Math.atan2(Math.sin(da), Math.cos(da));
        const wid = 0.55 * s.wide; r -= F.R * 0.2 * s.d * Math.exp(-(da * da) / (wid * wid));
      }
      const ex = COS[i] * r * F.ax, ey = SIN[i] * r * F.ay;
      NX[i] = F.cx + ex * cr - ey * sr; NY[i] = F.cy + ex * sr + ey * cr;
    }
    const p = new Path2D();
    p.moveTo((NX[NODES - 1] + NX[0]) / 2, (NY[NODES - 1] + NY[0]) / 2);
    for (let i = 0; i < NODES; i++) { const j = (i + 1) % NODES; p.quadraticCurveTo(NX[i], NY[i], (NX[i] + NX[j]) / 2, (NY[i] + NY[j]) / 2); }
    return p;
  }

  TOOLS.push({
    id: 'comfort', name: 'Comfort', tag: 'new',
    blurb: 'Big flat fields of soft colour melting into each other, breathing slowly together and wandering over minutes. A note is a gentle press: the field\'s own colour starts rising at once, its edge gives, and it takes its time to come back while the fields nearby lean in. Low notes press the big low fields, high notes the small high ones.',
    params: [
      { key: 'breath', label: 'how slowly it breathes', min: 3.5, max: 20, value: 10,
        hint: 'How long one breath takes. Left: a quick, light rise and fall. Right: one long breath every 20 seconds.',
        icon: (g, v, w, h) => ICON.wave(g, w, h, 0.55, 3.2 - 2.6 * v, '#d9c4a0') },
      { key: 'press', label: 'how far a note presses', min: 0.15, max: 2, value: 1,
        hint: 'How far a note pushes in the edge of a field. Left: a faint touch. Right: a deep, slow give.',
        icon: (g, v, w, h) => { ICON.dot(g, w / 2, h / 2 + 3, 9.5, '#b8694a'); ICON.dot(g, w / 2, h / 2 - 9 + v * 7, 3 + v * 4, '#241a14'); } },
      { key: 'size', label: 'how big the fields are', min: 0, max: 1, value: 0.5,
        hint: 'How many fields share the picture. Left: many small ones. Right: a few huge ones.',
        icon: (g, v, w, h) => { const n = v < 0.34 ? 3 : v < 0.67 ? 2 : 1, r = n === 1 ? 10 : n === 2 ? 7 : 5; for (let i = 0; i < n; i++) ICON.dot(g, w * ((i + 0.5) / n), h / 2, r, '#d9c4a0'); } },
      { key: 'warmth', label: 'how warm the colours are', min: 0, max: 1, value: 0.5,
        hint: 'The colour of it all. Left: cool dusk, grey-rose. Right: amber.',
        icon: (g, v, w, h) => ICON.dot(g, w / 2, h / 2, 9, css(v < 0.5 ? mix(DUSK, PAL[3], v * 2) : mix(PAL[3], AMBER, v * 2 - 1))) },
      { key: 'stay', label: 'how long the warmth stays', min: 1.5, max: 15, value: 5,
        hint: 'How long a field keeps the warmth of a note. Left: fades quickly. Right: stays for many seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.08 + v * 0.92, '#f0b070', 'dot') },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: nearly dark, what lies under it shows, and only the hardest attacks press. Right: full colour, and every note presses.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => ICON.dot(g, w / 2, h / 2, 3 + 6 * v, '#d9c4a0')) },
    ],
    reset() {
      pitches = null; vels = null; sigh = 0; sighGoal = 0; lamp = 0; snap = true;
      for (const F of forms) { F.sag = 0; F.slots = [mkSlot(), mkSlot()]; }
    },
    onChord(ch, x) {
      if (!pitches) loadSong();
      ensure(x);
      const pres = x.p('presence'), cut = (1 - pres) * 0.95;
      const gentle = 1 / (1 + Math.max(0, x.rate - 3) * 0.05);    // fast music: the presses merge rather than pile up
      const wide = 1 + Math.min(4, ch.notes.length - 1) * 0.22;
      const loudest = ch.notes.length > 5 ? [...ch.notes].sort((a, b) => b.v - a.v).slice(0, 5) : ch.notes;
      let took = 0;
      for (const m of loudest) if (cut <= 0 || rank(vels, m.v) >= cut) { pressNote(m, wide, x, gentle); took++; }
      if (took && ch.notes.length >= 4) sighGoal = Math.max(sighGoal, Math.min(1, (ch.notes.length - 2) * 0.22) * Math.sqrt(clamp(ch.vel / 112, 0, 1)) * pres);
    },
    frame(x) {
      const W = x.W, H = x.H, dt = x.dt, t = x.t;
      ensure(x);
      const pres = x.p('presence'), tone = x.p('warmth');
      phase += (dt / x.p('breath')) * TAU;
      sighGoal *= Math.exp(-dt / 2.2); sigh += (sighGoal - sigh) * (1 - Math.exp(-dt / 0.5));
      lamp += (x.level - lamp) * (1 - Math.exp(-dt / 3));
      const tint = (c) => (tone < 0.5 ? mix(c, DUSK, (0.5 - tone) * 1.2) : mix(c, LAMP, (tone - 0.5) * 0.8));
      const room = tone < 0.5 ? mix(ROSE, AMBER, tone * 2) : AMBER;
      const amp = 0.062 * (0.12 + 0.88 * pres);

      // breathing, presses, warmth: all first-order, so no overshoot, ever
      for (const F of forms) {
        let sag = 0;
        for (const s of F.slots) {
          s.goal *= Math.exp(-dt / 1.7);
          if (s.goal > s.d) s.d += Math.min((s.goal - s.d) * (1 - Math.exp(-dt / 0.17)), 2.4 * dt);   // the clamp: a dimple never twitches
          else s.d += (s.goal - s.d) * (1 - Math.exp(-dt / 0.35));
          s.wg *= Math.exp(-dt / Math.max(0.3, s.tw));
          s.warm += (s.wg - s.warm) * (1 - Math.exp(-dt / 0.05));   // up over about 150 ms, and steepest in the very frame of the attack
          s.flush *= Math.exp(-dt / 0.42);
          s.fl += (s.flush - s.fl) * (1 - Math.exp(-dt / 0.05));
          sag += s.d;
        }
        F.sag = sag;
        F.R = F.R0 * (1 + amp * 0.62 * Math.sin(phase - F.delay) - 0.05 * Math.min(1.4, sag) - 0.014 * sigh);
        F.fx = 0; F.fy = 0;
      }
      // the fields nearby lean in towards one that gives, much slower than the breath
      for (const A of forms) if (A.sag > 0.02) for (const B of forms) if (B !== A) {
        const ex = A.cx - B.cx, ey = A.cy - B.cy, D = Math.hypot(ex, ey) || 1, near = 1 - D / ((A.R0 + B.R0) * 1.3);
        if (near > 0) { const pull = (Math.min(1.4, A.sag) * near * 0.09 * Math.min(A.R0, B.R0)) / D; B.fx += ex * pull; B.fy += ey * pull; }
      }
      const K = snap ? 1 : 1 - Math.exp(-dt / 1.1);
      for (const F of forms) {
        const rx = F.x0 + Math.sin(t * F.wx + F.px) * W * 0.15, ry = F.y0 + Math.sin(t * F.wy + F.py) * H * 0.13
          + F.R0 * (0.055 * Math.min(1.4, F.sag) + 0.012 * sigh) - F.R0 * amp * 0.24 * Math.sin(phase - F.delay);
        F.cx += (rx + F.fx - F.cx) * K; F.cy += (ry + F.fy - F.cy) * K;
      }
      snap = false;

      // the ground: flat, warm and dim, a little warmer in full passages
      const gc0 = tone < 0.5 ? mix(UMBER, [28, 26, 32], (0.5 - tone) * 2) : mix(UMBER, [48, 29, 16], (tone - 0.5) * 2), gc = mix(gc0, LAMP, 0.12 + 0.08 * lamp), bw = buf.width, bh = buf.height;
      const u = lg; u.setTransform(1, 0, 0, 1, 0, 0); u.globalAlpha = 1; u.globalCompositeOperation = 'source-over';
      u.fillStyle = css(gc); u.fillRect(0, 0, lay.width, lay.height);
      u.setTransform(S, 0, 0, S, MARGIN, MARGIN);

      for (const F of forms) {
        const path = outline(F, t), [s0, s1] = F.slots;
        const c = mix(tint(mix(F.c0, F.c1, 0.3 + 0.3 * Math.sin(t * F.cw + F.cph))), gc, 0.14), lit = inner(c, room), small = 1 + 0.7 * F.f;
        const warm = Math.min(1, (s0.warm * 0.42 + s0.fl * 0.2 + s1.warm * 0.42 + s1.fl * 0.2) * small + lamp * 0.1);
        u.globalAlpha = 0.76 + 0.14 * F.f; u.fillStyle = css(mix(c, lit, warm)); u.fill(path);
        u.save(); u.clip(path);
        const cr = Math.cos(F.rot), sr = Math.sin(F.rot);
        for (const s of F.slots) {
          const a = Math.min(0.85, (s.warm * 0.5 + s.fl * 0.32) * small);
          if (a > 0.006) {                                        // the warmth where it was touched, in the field's own colour
            const ex = Math.cos(s.a) * F.R * F.ax * 0.5, ey = Math.sin(s.a) * F.R * F.ay * 0.5;
            const px = F.cx + ex * cr - ey * sr, py = F.cy + ex * sr + ey * cr, rho = F.R * (0.75 + 0.25 * (s.wide - 1));
            const wg = u.createRadialGradient(px, py, 0, px, py, rho);
            wg.addColorStop(0, css(lit, a)); wg.addColorStop(0.5, css(lit, a * 0.5)); wg.addColorStop(1, css(lit, 0));
            u.fillStyle = wg; u.beginPath(); u.arc(px, py, rho, 0, TAU); u.fill();
          }
        }
        u.restore();
      }
      u.globalAlpha = 1;
      bg.setTransform(1, 0, 0, 1, 0, 0); bg.globalAlpha = 1;
      bg.filter = `blur(${SOFT}px)`; bg.drawImage(lay, -MARGIN, -MARGIN); bg.filter = 'none';
      if (pres < 1) { bg.fillStyle = `rgba(11,7,5,${(1 - pres) * 0.6})`; bg.fillRect(0, 0, bw, bh); }
      // Quiet: the whole picture at low opacity, so what lies under it shows and alone it stays near dark.
      const g = x.g; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'medium';
      g.globalAlpha = pres >= 0.999 ? 1 : 0.08 + 0.92 * pres * pres * pres;
      g.drawImage(buf, 0, 0, W, H);
      g.fillStyle = grainPat; g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    },
  });
})();
