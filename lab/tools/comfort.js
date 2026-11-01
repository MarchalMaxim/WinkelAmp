// Comfort: big soft forms nestled in lamp-light, breathing together about once in 10 seconds. A note is a gentle press:
// a warm glow starts rising in the same frame (never a flash), the surface gives over half a second and takes about
// 5 seconds to come back, while the neighbours slowly lean in. Everything is overdamped, so nothing overshoots or bounces.
// Drawn into a small buffer and scaled up, which is what makes every edge soft, and keeps it cheap.
(() => {
  const S = 0.34, NODES = 40, TAU = Math.PI * 2;
  const COS = new Float32Array(NODES), SIN = new Float32Array(NODES);
  for (let i = 0; i < NODES; i++) { COS[i] = Math.cos((i / NODES) * TAU); SIN[i] = Math.sin((i / NODES) * TAU); }
  const LIGHT = [-0.62, -0.78];                                   // the lamp is up and to the left
  const PAL = [[184, 105, 74], [217, 196, 160], [141, 148, 120], [196, 144, 136]];   // terracotta, oat, sage, dusty rose
  const ORDER = [0, 1, 2, 3, 1, 0, 3, 2, 1, 3, 0, 2, 3, 1];
  const UMBER = [36, 26, 20], AMBER = [240, 176, 112], ROSE = [214, 170, 164], DUSK = [135, 122, 128], LAMP = [216, 154, 92];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  let buf = null, bg = null, grain = null, grainPat = null, shadow = null, forms = [], pairs = [], builtN = 0, builtW = 0;
  let phase = 0, drift = 0, sigh = 0, sighGoal = 0, lamp = 0, pitches = null, vels = null;

  function sprites(W, H) {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    buf = mk(Math.ceil(W * S), Math.ceil(H * S)); bg = buf.getContext('2d');
    shadow = mk(128, 128);
    { const s = shadow.getContext('2d'), gr = s.createRadialGradient(64, 64, 18, 64, 64, 64);
      gr.addColorStop(0, 'rgba(14,8,5,0.9)'); gr.addColorStop(0.62, 'rgba(14,8,5,0.62)'); gr.addColorStop(1, 'rgba(14,8,5,0)');
      s.fillStyle = gr; s.fillRect(0, 0, 128, 128); }
    grain = mk(160, 160);
    { const s = grain.getContext('2d'), R = ICON.rng(23);
      for (let i = 0; i < 9000; i++) { s.fillStyle = R() < 0.5 ? `rgba(255,235,210,${R() * 0.022})` : `rgba(10,5,2,${R() * 0.03})`; s.fillRect(R() * 160, R() * 160, 1, 1); } }
    grainPat = bg.createPattern(grain, 'repeat');
  }
  const mkSlot = () => ({ a: 0, wide: 1, goal: 0, d: 0, wg: 0, warm: 0, fl: 0, flush: 0, tw: 3 });
  // The pile: big forms at the bottom, small ones on top, packed by a fixed relaxation, so the same count is always the same pile.
  function build(n, W, H) {
    if (!buf || builtW !== W) sprites(W, H);
    const R = ICON.rng(11 + n * 7), radii = [];
    let sum = 0;
    for (let i = 0; i < n; i++) { const r = (1.42 - 0.84 * (i / Math.max(1, n - 1))) * (0.94 + 0.12 * R()); radii.push(r); sum += r * r; }
    const scale = Math.sqrt((1.22 * W * H) / (Math.PI * sum));
    forms = radii.map((r, i) => {
      const f = i / Math.max(1, n - 1), R0 = r * scale, axes = [];
      for (const k of [2, 3, 5]) axes.push([k, k === 2 ? 0.11 + 0.08 * R() : k === 3 ? 0.06 + 0.07 * R() : 0.012 + 0.02 * R(), R() * TAU]);
      return { R0, axes, x0: W * (0.08 + 0.84 * ((0.31 + i * 0.618) % 1)), y0: H * (0.98 - 0.8 * f), cx: 0, cy: 0, R: R0, col: PAL[ORDER[i % ORDER.length]],
        dx: R() * TAU, dy: R() * TAU, sx: 0.09 + 0.07 * R(), sy: 0.07 + 0.06 * R(), slots: [mkSlot(), mkSlot()], nx: new Float32Array(NODES), ny: new Float32Array(NODES), sag: 0, delay: 0, fx: 0, fy: 0 };
    });
    for (let it = 0; it < 420; it++) {
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        const A = forms[a], B = forms[b]; let ex = B.x0 - A.x0, ey = B.y0 - A.y0; const D = Math.hypot(ex, ey) || 1;
        const want = (A.R0 + B.R0) * 0.8; if (D >= want) continue;
        const push = (want - D) * 0.5; ex /= D; ey /= D;
        const wa = B.R0 / (A.R0 + B.R0), wb = 1 - wa;
        A.x0 -= ex * push * wa; A.y0 -= ey * push * wa; B.x0 += ex * push * wb; B.y0 += ey * push * wb;
      }
      for (const F of forms) {
        F.y0 += 0.5; F.x0 += (W / 2 - F.x0) * 0.0012;
        F.x0 = clamp(F.x0, F.R0 * 0.62, W - F.R0 * 0.62); F.y0 = clamp(F.y0, F.R0 * 0.72, H - F.R0 * 0.42);
      }
    }
    for (const F of forms) { F.cx = F.x0; F.cy = F.y0; F.delay = (F.x0 / W) * 1.5 + (F.y0 / H) * 0.5; }
    pairs = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const A = forms[a], B = forms[b], D = Math.hypot(B.x0 - A.x0, B.y0 - A.y0);
      if (D < (A.R0 + B.R0) * 1.02) pairs.push({ a: A, b: B, D, sum: A.R0 + B.R0 });
    }
    forms.sort((p, q) => q.y0 - p.y0);                            // draw (and pitch) order: from the bottom of the pile up
    builtN = n; builtW = W;
  }
  const count = (v) => Math.round(v < 0.5 ? 14 - 12 * v : 8 - 8 * (v - 0.5));
  function loadSong() {
    pitches = (window.NOTES || []).map((n) => n[2]).sort((a, b) => a - b);
    vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
  }
  const rank = (arr, v) => { let a = 0, b = arr.length; while (a < b) { const k = (a + b) >> 1; if (arr[k] < v) a = k + 1; else b = k; } return arr.length ? a / arr.length : 0.5; };
  // A place on this form that later forms do not cover, so the press can be seen.
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
  function outline(F) {
    const lim = [];                                               // the neighbours flatten the form where they lean on it
    for (const pr of pairs) {
      const O = pr.a === F ? pr.b : pr.b === F ? pr.a : null; if (!O) continue;
      let ex = O.cx - F.cx, ey = O.cy - F.cy; const D = Math.hypot(ex, ey) || 1; ex /= D; ey /= D;
      lim.push(ex, ey, D * (F.R / (F.R + O.R)) + 0.34 * Math.min(F.R, O.R));
    }
    const k = 9 / F.R;
    for (let i = 0; i < NODES; i++) {
      const th = (i / NODES) * TAU; let r = 1;
      for (const [m, amp, ph] of F.axes) r += amp * Math.sin(m * th + ph);
      r *= F.R;
      for (const s of F.slots) if (s.d > 0.004) {
        let da = th - s.a; da = Math.atan2(Math.sin(da), Math.cos(da));
        const wid = 0.55 * s.wide; r -= F.R * 0.15 * s.d * Math.exp(-(da * da) / (wid * wid));
      }
      let sum = Math.exp(-k * r); const r0 = r;
      for (let j = 0; j < lim.length; j += 3) {
        const dot = COS[i] * lim[j] + SIN[i] * lim[j + 1];
        if (dot > 0.08) sum += Math.exp(-k * Math.min(lim[j + 2] / dot, r0 * 3));
      }
      r = r0 + (-Math.log(sum) / k - r0) * 0.8;                   // keeps a little belly, so a contact never reads as a straight wall
      F.nx[i] = F.cx + COS[i] * r; F.ny[i] = F.cy + SIN[i] * r;
    }
    const p = new Path2D(), nx = F.nx, ny = F.ny;
    p.moveTo((nx[NODES - 1] + nx[0]) / 2, (ny[NODES - 1] + ny[0]) / 2);
    for (let i = 0; i < NODES; i++) { const j = (i + 1) % NODES; p.quadraticCurveTo(nx[i], ny[i], (nx[i] + nx[j]) / 2, (ny[i] + ny[j]) / 2); }
    return p;
  }

  TOOLS.push({
    id: 'comfort', name: 'Comfort', tag: 'new',
    blurb: 'Big soft forms nestled in lamp-light, breathing slowly together. A note is a gentle press: a warm glow starts rising at once, the surface gives, and it takes its time to come back while the neighbours lean in. Low notes press the big forms at the bottom, high notes the small ones on top.',
    params: [
      { key: 'breath', label: 'how slowly it breathes', min: 3.5, max: 20, value: 10,
        hint: 'How long one breath takes. Left: a quick, light rise and fall. Right: one long breath every 20 seconds.',
        icon: (g, v, w, h) => ICON.wave(g, w, h, 0.55, 3.2 - 2.6 * v, '#d9c4a0') },
      { key: 'press', label: 'how deep a note presses', min: 0.15, max: 2, value: 1,
        hint: 'How far a note sinks into a form. Left: a faint touch. Right: sinks right in.',
        icon: (g, v, w, h) => { ICON.dot(g, w / 2, h / 2 + 3, 9.5, '#b8694a'); ICON.dot(g, w / 2, h / 2 - 9 + v * 7, 3 + v * 4, '#241a14'); } },
      { key: 'size', label: 'how big the forms are', min: 0, max: 1, value: 0.5,
        hint: 'How many forms share the picture. Left: many small ones. Right: a few huge ones.',
        icon: (g, v, w, h) => { const n = v < 0.34 ? 3 : v < 0.67 ? 2 : 1, r = n === 1 ? 10 : n === 2 ? 7 : 5; for (let i = 0; i < n; i++) ICON.dot(g, w * ((i + 0.5) / n), h / 2, r, '#d9c4a0'); } },
      { key: 'warmth', label: 'how warm the light is', min: 0, max: 1, value: 0.5,
        hint: 'The colour of the room. Left: cool dusk, grey-rose. Right: amber lamp-light.',
        icon: (g, v, w, h) => ICON.dot(g, w / 2, h / 2, 9, css(v < 0.5 ? mix(DUSK, PAL[3], v * 2) : mix(PAL[3], AMBER, v * 2 - 1))) },
      { key: 'stay', label: 'how long the warmth stays', min: 1.5, max: 15, value: 5,
        hint: 'How long a form keeps the warmth of a note. Left: fades quickly. Right: stays for many seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.08 + v * 0.92, '#f0b070', 'dot') },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: a dark room, the breath barely moves, and only the hardest attacks press. Right: lit, and every note presses.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => ICON.dot(g, w / 2, h / 2, 3 + 6 * v, '#d9c4a0')) },
    ],
    reset() {
      pitches = null; vels = null; sigh = 0; sighGoal = 0; lamp = 0;
      for (const F of forms) { F.cx = F.x0; F.cy = F.y0; F.sag = 0; F.slots = [mkSlot(), mkSlot()]; }
    },
    onChord(ch, x) {
      if (!pitches) loadSong();
      const n = count(x.p('size')); if (n !== builtN || x.W !== builtW) build(n, x.W, x.H);
      const pres = x.p('presence'), cut = (1 - pres) * 0.95;
      const gentle = 1 / (1 + Math.max(0, x.rate - 3) * 0.05);    // fast music: the presses merge rather than pile up
      const wide = 1 + Math.min(4, ch.notes.length - 1) * 0.22;
      const loudest = ch.notes.length > 5 ? [...ch.notes].sort((a, b) => b.v - a.v).slice(0, 5) : ch.notes;
      let took = 0;
      for (const m of loudest) if (cut <= 0 || rank(vels, m.v) >= cut) { pressNote(m, wide, x, gentle); took++; }
      if (took && ch.notes.length >= 4) sighGoal = Math.max(sighGoal, Math.min(1, (ch.notes.length - 2) * 0.22) * Math.sqrt(clamp(ch.vel / 112, 0, 1)) * pres);
    },
    frame(x) {
      const W = x.W, H = x.H, dt = x.dt;
      const n = count(x.p('size')); if (n !== builtN || W !== builtW) build(n, W, H);
      const pres = x.p('presence'), tone = x.p('warmth');
      phase += (dt / x.p('breath')) * TAU; drift += dt;
      sighGoal *= Math.exp(-dt / 2.2); sigh += (sighGoal - sigh) * (1 - Math.exp(-dt / 0.5));
      lamp += (x.level - lamp) * (1 - Math.exp(-dt / 3));
      const tint = (c) => (tone < 0.5 ? mix(c, DUSK, (0.5 - tone) * 1.2) : mix(c, LAMP, (tone - 0.5) * 0.8));
      const glowCol = tone < 0.5 ? mix(ROSE, AMBER, tone * 2) : AMBER;
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
      }
      // the neighbours lean in: a pile of soft springs at rest in the layout, much slower than the breath
      const K = 1 - Math.exp(-dt / 1.1);
      for (const F of forms) { F.fx = 0; F.fy = 0; }
      for (const pr of pairs) {
        const A = pr.a, B = pr.b; let ex = B.cx - A.cx, ey = B.cy - A.cy; const D = Math.hypot(ex, ey) || 1; ex /= D; ey /= D;
        const e = (pr.D * ((A.R + B.R) / pr.sum) - D) * 0.3;
        A.fx -= ex * e; A.fy -= ey * e; B.fx += ex * e; B.fy += ey * e;
      }
      for (const F of forms) {
        const rx = F.x0 + Math.sin(drift * F.sx + F.dx) * F.R0 * 0.018, ry = F.y0 + Math.sin(drift * F.sy + F.dy) * F.R0 * 0.014
          + F.R0 * (0.055 * Math.min(1.4, F.sag) + 0.012 * sigh) - F.R0 * amp * 0.24 * Math.sin(phase - F.delay);
        F.cx += (rx - F.cx + F.fx) * K; F.cy += (ry - F.cy + F.fy) * K;
      }

      // ground: warm dim umber with the lamp's pool
      const u = bg; u.setTransform(1, 0, 0, 1, 0, 0); u.globalAlpha = 1; u.globalCompositeOperation = 'source-over';
      const gc = tone < 0.5 ? mix(UMBER, [28, 26, 32], (0.5 - tone) * 2) : mix(UMBER, [48, 29, 16], (tone - 0.5) * 2), bw = buf.width, bh = buf.height;
      u.fillStyle = css(gc); u.fillRect(0, 0, bw, bh);
      const pool = u.createRadialGradient(bw * 0.3, bh * 0.12, 0, bw * 0.3, bh * 0.12, bw * 0.72);
      pool.addColorStop(0, css(mix(gc, LAMP, 0.2 + 0.1 * lamp))); pool.addColorStop(1, css(gc, 0));
      u.fillStyle = pool; u.fillRect(0, 0, bw, bh);
      u.setTransform(S, 0, 0, S, 0, 0);

      for (const F of forms) {
        const path = outline(F), R = F.R, cx = F.cx, cy = F.cy, [s0, s1] = F.slots;
        const warm = Math.min(1, s0.warm * 0.55 + s0.fl * 0.2 + s1.warm * 0.55 + s1.fl * 0.2) + lamp * 0.06;
        u.globalAlpha = 0.72; u.drawImage(shadow, cx - R * 1.28 + R * 0.09, cy - R * 1.28 + R * 0.13, R * 2.56, R * 2.56); u.globalAlpha = 1;
        const c = mix(tint(F.col), gc, 0.26), lit = mix(mix(c, [250, 232, 205], 0.2), glowCol, warm * 0.62), body = mix(c, glowCol, warm * 0.46),
          low = mix(mix(c, gc, 0.5), glowCol, warm * 0.2), deep = [c[0] * 0.3 + gc[0] * 0.3, c[1] * 0.26 + gc[1] * 0.3, c[2] * 0.26 + gc[2] * 0.3];   // keeps its own hue as it turns away
        u.lineJoin = 'round';
        u.strokeStyle = css(deep, 0.14); u.lineWidth = 13; u.stroke(path); u.strokeStyle = css(deep, 0.2); u.lineWidth = 7; u.stroke(path);
        const gr = u.createRadialGradient(cx + LIGHT[0] * R * 0.62, cy + LIGHT[1] * R * 0.62, R * 0.04, cx + LIGHT[0] * R * 0.22, cy + LIGHT[1] * R * 0.22, R * 1.36);
        gr.addColorStop(0, css(lit)); gr.addColorStop(0.42, css(body)); gr.addColorStop(0.76, css(low)); gr.addColorStop(1, css(deep));
        u.fillStyle = gr; u.fill(path);
        u.save(); u.clip(path);
        // the soft turn of the form away from the lamp: bands shifted towards the lamp, so they lie only on the lower right
        u.translate(LIGHT[0] * R * 0.07, LIGHT[1] * R * 0.07); u.strokeStyle = css(deep, 0.052);
        for (let lw = 0.5; lw > 0.06; lw -= 0.065) { u.lineWidth = R * lw; u.stroke(path); }
        u.translate(-LIGHT[0] * R * 0.07, -LIGHT[1] * R * 0.07);
        for (const s of F.slots) {
          const px = cx + Math.cos(s.a) * R * 0.44, py = cy + Math.sin(s.a) * R * 0.44, rho = R * (0.46 + 0.17 * (s.wide - 1)) * (1 + 0.2 * Math.min(1.5, s.d));
          const a = Math.min(0.82, s.warm * 0.55 + s.fl * 0.3);
          if (a > 0.006) {                                        // the warmth under the hand; source-over amber can never pass amber
            const wg = u.createRadialGradient(px, py, 0, px, py, rho * 1.7);
            wg.addColorStop(0, css(glowCol, a)); wg.addColorStop(0.45, css(glowCol, a * 0.5)); wg.addColorStop(1, css(glowCol, 0));
            u.fillStyle = wg; u.beginPath(); u.arc(px, py, rho * 1.7, 0, TAU); u.fill();
          }
          if (s.d > 0.01) {                                       // the hollow: its side towards the lamp in shade, the far side catching light
            const dk = Math.min(0.62, s.d * 0.52), sx = px + LIGHT[0] * rho * 0.26, sy = py + LIGHT[1] * rho * 0.26;
            const sh = u.createRadialGradient(sx, sy, 0, sx, sy, rho * 0.8);
            sh.addColorStop(0, css(deep, dk)); sh.addColorStop(0.55, css(deep, dk * 0.55)); sh.addColorStop(1, css(deep, 0));
            u.fillStyle = sh; u.beginPath(); u.arc(sx, sy, rho * 0.8, 0, TAU); u.fill();
            const hx = px - LIGHT[0] * rho * 0.62, hy = py - LIGHT[1] * rho * 0.62, hl = Math.min(0.42, s.d * 0.32);
            const hi = u.createRadialGradient(hx, hy, 0, hx, hy, rho * 0.55);
            hi.addColorStop(0, css(lit, hl)); hi.addColorStop(1, css(lit, 0));
            u.fillStyle = hi; u.beginPath(); u.arc(hx, hy, rho * 0.55, 0, TAU); u.fill();
          }
        }
        u.restore();
      }
      u.setTransform(1, 0, 0, 1, 0, 0);
      u.fillStyle = grainPat; u.fillRect(0, 0, bw, bh);
      if (pres < 1) { u.fillStyle = `rgba(11,7,5,${(1 - pres) * 0.86})`; u.fillRect(0, 0, bw, bh); }
      const g = x.g; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'medium';
      g.drawImage(buf, 0, 0, W, H);
    },
  });
})();
