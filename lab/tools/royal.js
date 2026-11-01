// Royal (the user: "Royal. elegant. dismissive"): the flick of the wrist. One tall calligraphic stroke holds the middle of
// the page and small things hurry up to it, one per note. It ignores nearly all of them. On a strong attack it turns its
// edge to them and, without hurrying, flicks its hairline back over the shoulder: the tip draws a long gold arc, and what
// the arc crosses spirals away. The louder the demand, the slower and colder the turn. Only the deepest chords get a bow.
(() => {
  const N = 80;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
  const smoother = (k) => { k = clamp(k); return k * k * k * (k * (k * 6 - 15) + 10); };
  const mix = (a, b, k) => a + (b - a) * k;
  const ROBES = [
    { name: 'purple and gold', ground: '#160a22', lift: '#2a1440', low: '#3e1258', high: '#8a2f7e', sheen: '226,150,214', edge: '217,178,94', pet: '243,234,214', arc: '217,178,94' },
    { name: 'black and gold', ground: '#0a090c', lift: '#1c1a20', low: '#131116', high: '#2e2a33', sheen: '170,160,178', edge: '226,186,96', pet: '240,232,212', arc: '226,186,96' },
    { name: 'oxblood and ivory', ground: '#180708', lift: '#2e0f10', low: '#4a0c10', high: '#8a1d1e', sheen: '236,150,130', edge: '238,226,200', pet: '246,240,226', arc: '238,226,200' },
  ];
  const robeOf = (x) => ROBES[clamp(Math.round(x.p('robe')), 0, ROBES.length - 1)];

  // A note's strength judged against this piece's own notes (recordings differ a lot in how hard they play): 0..1.
  let velOf = null, vels = [];
  const rank = (v) => {
    if (velOf !== window.NOTES) { velOf = window.NOTES; vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b); }
    if (!vels.length) return clamp(v / 115);
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length;
  };

  let time, pets, arcs, glints, flash, boost, sinceTurn, sinceBow, sinceTick, sincePet, groupId;
  // The gesture: rest, windup, swing, hold, ret. side: where the petitioner stands (-1 left, +1 right).
  let st, stT, side, amp, swingDur, holdDur, windDur, turn, whip, tick, tickT, tickDir, bowT, arc, prevTip;
  const spine = { x: new Float32Array(N), y: new Float32Array(N), nx: new Float32Array(N), ny: new Float32Array(N), w: new Float32Array(N) };
  let ax = 0, ay = 0;   // where the stroke's axis stands
  const init = () => {
    time = 0; pets = []; arcs = []; glints = []; flash = 0; boost = 0; sinceTurn = 99; sinceBow = 99; sinceTick = 99; sincePet = 99; groupId = 0;
    st = 'rest'; stT = 0; side = -1; amp = 1; swingDur = 2; holdDur = 2; windDur = 0.6; turn = 0; whip = 0; tick = 0; tickT = 9; tickDir = 1; bowT = 99; arc = null; prevTip = null;
  };
  init();

  // The bow: slowly down and slowly up, once.
  const bowAmt = () => (bowT < 5.5 ? Math.sin(Math.PI * smooth(0, 1, bowT / 5.5)) : 0);

  function layout(x) {
    const W = x.W, H = x.H, L = H * 1.14, pres = x.p('presence');
    const fit = Math.min(1, (W / H) * 1.1);          // a narrow picture gets a narrower gesture
    const q = (0.3 + 0.7 * pres) * fit;              // how much of the gesture shows
    const lean = turn * x.p('haughty') * q * side * -1;   // away from the petitioner
    const fl = x.p('flourish');
    const back = whip * (0.75 + 1.45 * fl) * q * side;     // the hairline, thrown back toward the petitioner
    const stretch = 1 + 1.0 * fl * smooth(0.4, 1, whip) * q;
    const breath = 1 + 0.018 * pres * Math.sin(time * 0.55);
    const bow = bowAmt() * (0.35 + 0.65 * pres);
    const belly = H * 0.062 * (1 - 0.5 * clamp(Math.abs(turn) * x.p('haughty')) * q);   // turning, it goes edge-on
    ax = W / 2; ay = H * (0.985 + 0.012 * bow + 0.08 * clamp(Math.abs(turn)) * q);
    let px = ax, py = ay;
    const ds = L * 0.985 / (N - 1);
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      const up = smooth(0.45, 0.8, s);
      let th = 0.68 * breath * Math.cos(2 * Math.PI * (s * 0.96 + 0.02)) * (1 - clamp(whip) * q * smooth(0.28, 0.65, s));   // the S, which the flick unwinds
      th += 2.5 * (1 - 0.72 * clamp(whip)) * Math.pow(smooth(0.87, 1, s), 2) * (side < 0 && whip > 0.01 ? mix(1, -1, smooth(0.15, 0.6, whip)) : 1);   // the curl
      th += lean * 0.32 * smooth(0, 0.45, s);                                              // the turn of the body
      th += back * up;                                               // the flick
      th += tick * tickDir * 0.3 * smooth(0.8, 1, s);                                     // the wrist tick
      th += bow * 0.34 * smooth(0.25, 0.8, s);                // the bow, always the same way
      const d = ds * (s > 0.6 ? stretch : 1) * (1 - 0.05 * bow);
      px += Math.sin(th) * d; py -= Math.cos(th) * d;
      spine.x[i] = px; spine.y[i] = py;
      spine.nx[i] = Math.cos(th); spine.ny[i] = Math.sin(th);
      spine.w[i] = 0.5 + belly * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.55)), 2.3 + 1.6 * clamp(whip));
    }
  }

  function ribbon(g, a, b, from, to) {   // one polygon between two offsets (in half-widths) of the spine, nodes from..to
    g.beginPath();
    for (let i = from; i <= to; i++) { const w = spine.w[i] * a; g[i === from ? 'moveTo' : 'lineTo'](spine.x[i] + spine.nx[i] * w, spine.y[i] + spine.ny[i] * w); }
    for (let i = to; i >= from; i--) { const w = spine.w[i] * b; g.lineTo(spine.x[i] + spine.nx[i] * w, spine.y[i] + spine.ny[i] * w); }
    g.closePath();
  }

  function step(x, dt) {
    time += dt; stT += dt; sinceTurn += dt; sinceBow += dt; sinceTick += dt; sincePet += dt; tickT += dt; bowT += dt;
    flash *= Math.pow(0.5, dt / 0.09); boost *= Math.pow(0.5, dt / 0.12);
    // the gesture: all of it smoothstep or slower
    if (st === 'windup') {
      turn = -0.1 * smoother(stT / windDur);
      if (stT >= windDur) { st = 'swing'; stT = 0; arc = { pts: [], age: 0 }; arcs.push(arc); prevTip = null; }
    } else if (st === 'swing') {
      const k = stT / swingDur;
      turn = mix(-0.1, amp, smoother(k)); whip = amp * smoother(clamp((k - 0.06) / 0.94));
      if (k >= 1) { st = 'hold'; stT = 0; arc = null; }
    } else if (st === 'hold') {
      turn = amp; whip = amp;
      if (stT >= holdDur) { st = 'ret'; stT = 0; }
    } else if (st === 'ret') {
      const k = smoother(stT / 4.2);
      turn = amp * (1 - k); whip = amp * (1 - smoother(stT / 3.4));
      if (stT >= 4.2) { st = 'rest'; stT = 0; turn = 0; whip = 0; }
    }
    tick = tickT < 0.9 ? Math.sin(Math.PI * smooth(0, 1, tickT / 0.9)) : 0;
  }

  function flick(p, vx, vy, delay) {
    if (p.fl) return;
    const sp = Math.max(1, Math.hypot(vx, vy));
    p.fl = { t: -delay, vx: vx / sp, vy: vy / sp, om: (p.x < ax ? -1 : 1) * (2.6 + (p.seed % 1) * 1.4), trail: [] };
  }

  const hasBow = (ch, r) => ch.lo <= 38 && ch.notes.length >= 2 && r >= 0.55;

  TOOLS.push({
    id: 'royal', name: 'Royal', tag: 'new',
    blurb: 'One tall stroke holds the middle of the page, and small things hurry up to it with every note. It ignores most of them. On a strong attack it turns its edge and, unhurried, flicks its hairline back over the shoulder: what the gold arc crosses spirals away. The louder the demand, the slower and colder the turn.',
    params: [
      { key: 'haughty', label: 'how far it turns away', min: 0.15, max: 1.4, value: 1,
        hint: 'How far the figure turns from them. Left: a slight nod. Right: it turns its whole back.',
        icon: (g, v, w, h) => { g.save(); g.translate(w / 2, h - 2); g.rotate(v * 0.8); g.lineWidth = 3; g.strokeStyle = '#d9b25e'; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-7, -7, 7, -13, 0, -21); g.stroke(); g.restore(); } },
      { key: 'flourish', label: 'how grand the gesture is', min: 0.2, max: 1.6, value: 1,
        hint: 'How big the flick and its gold arc are. Left: a small flick. Right: a sweeping arc across the screen.',
        icon: (g, v, w, h) => { const r = 5 + v * 7; g.strokeStyle = '#d9b25e'; g.beginPath(); g.arc(w / 2, h - 5, r, -Math.PI / 2 - 0.4 - v * 1.2, -Math.PI / 2 + 0.4); g.stroke(); } },
      { key: 'crowd', label: 'how many come near', min: 0, max: 1, value: 0.45,
        hint: 'How many small marks come up to it. Left: one at a time. Right: a stream of them.',
        icon: (g, v, w, h) => ICON.dots(g, 1 + Math.round(v * 14), w, h, { seed: 5, r: 1.3, col: '#f3ead6', pad: 3 }) },
      { key: 'near', label: 'how close they get', min: 0, max: 1, value: 0.6,
        hint: 'How close the marks dare come. Left: they stop far off. Right: right up to it.',
        icon: (g, v, w, h) => { ICON.rect(g, w - 9, 3, 4, h - 6, '#8a2f7e'); ICON.dot(g, 4 + v * (w - 18), h / 2, 2.2, '#f3ead6'); } },
      { key: 'robe', label: 'the colour', min: 0, max: 2, step: 1, value: 0,
        hint: 'Which colours it wears. Left: purple and gold. Middle: black and gold. Right: oxblood and ivory.',
        icon: (g, v, w, h) => { const r = ROBES[clamp(Math.round(v * 2), 0, 2)]; ICON.palette(g, [r.high, `rgb(${r.edge})`, r.ground], w, h); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: faint, a small gesture, and only the hardest attacks of the piece send anyone. Right: fully there.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + 0.85 * v, () => { g.lineWidth = 2 + 2 * v; g.strokeStyle = '#d9b25e'; g.beginPath(); g.moveTo(w / 2, h - 3); g.bezierCurveTo(w / 2 - 7, h - 10, w / 2 + 7, 12, w / 2, 3); g.stroke(); }) },
    ],
    reset() { init(); },
    onChord(ch, x) {
      const pres = x.p('presence'), crowd = x.p('crowd'), near = x.p('near');
      const r = rank(ch.vel), p = x.pitch01((ch.lo + ch.hi) / 2);
      const heard = r >= (1 - pres) * 0.97;
      // In the same frame, whatever else happens: the edge catches a thin glint, at the height of the note.
      if (heard || pres > 0.5) {
        glints.push({ s: clamp(0.08 + 0.8 * x.pitch01(ch.hi)), age: 0, v: 0.45 + 0.55 * r });
        if (glints.length > 7) glints.shift();
        flash = Math.max(flash, 0.5 * r);
      }
      if (!heard) return;
      boost = Math.max(boost, 0.4 + 0.6 * r);    // every attack makes those still coming hurry a step

      // Who comes. A stream is thinned so that the page stays formal.
      const maxAlive = Math.round(mix(2, 44, crowd * crowd)), gap = mix(1.6, 0.07, Math.sqrt(crowd));
      const walking = pets.reduce((c, q) => c + (q.fl ? 0 : 1), 0);
      const pside = x.rnd() < 0.5 ? -1 : 1;
      if (walking < maxAlive && sincePet >= gap * (r > 0.8 ? 0.4 : 1)) {
        sincePet = 0;
        const count = ch.notes.length >= 3 ? Math.min(Math.round(mix(1, 6, crowd * 1.3)), ch.notes.length) : 1;
        const W = x.W, H = x.H, gid = ++groupId;
        let sx, sy;
        if (p < 0.3) { sx = W / 2 + pside * W * x.rnd(0.14, 0.46); sy = H - 6; }
        else { sx = W / 2 + pside * (W / 2 - 6); sy = mix(H * 0.9, H * 0.06, clamp((p - 0.25) / 0.6)); }
        const close = clamp(near * 1.1 * Math.pow(r, 0.8) + near * 0.22);          // soft ones stop far off, unnoticed
        const gapX = mix(W * 0.36, H * 0.06 + 22, close);
        const ty = mix(H * 0.6, H * 0.14, clamp(p * 1.3)) + x.rnd(-H * 0.05, H * 0.05);
        const tx = W / 2 + pside * gapX;
        const a = Math.atan2(ty - sy, tx - sx), wait = clamp(ch.notes[0].d * 1.2 + 1.1 + r, 1, 5);
        for (let i = 0; i < count; i++) {
          const off = (i - (count - 1) / 2) * 20;
          pets.push({
            sx: sx - Math.sin(a) * off, sy: sy + Math.cos(a) * off, tx: tx - Math.sin(a) * off, ty: ty + Math.cos(a) * off,
            a, prog: 0, phase: x.rnd(0, 1), seed: x.rnd(0, 7), travel: mix(2.6, 1.3, r), wait, left: 0, x: sx, y: sy, side: pside,
            r: 3.4 + 2.6 * r, lozenge: r > 0.3 || ch.notes.length > 1, born: 0, gid, delay: i * 0.05,
          });
        }
      }

      // What it does about it. The figure refuses to be hurried: a gesture under way hears nothing more.
      if (st !== 'rest') return;
      if (hasBow(ch, r) && sinceBow > 11 && bowT > 5.5) { bowT = 0; sinceBow = 0; if (ch.lo <= 33 || r > 0.85) return; }
      if (bowT < 5.5) return;
      // Strong means strong for this piece; a long silence of gestures slowly lowers the bar, so it never just sleeps.
      const bar = Math.max(0.58, 0.9 - 0.022 * Math.max(0, sinceTurn - 5)) + (1 - pres) * 0.09;
      const crowded = pets.some((q) => !q.fl && q.prog > 0.45);
      if ((r >= bar || (ch.notes.length >= 4 && r >= bar - 0.12)) && sinceTurn > 3 && crowded) {
        st = 'windup'; stT = 0; sinceTurn = 0;
        // Toward the nearest who dares: that is who gets the flick.
        let best = null; for (const q of pets) if (!q.fl && q.prog > 0.45 && (!best || Math.abs(q.tx - x.W / 2) < Math.abs(best.tx - x.W / 2))) best = q;
        side = best ? best.side : pside;
        amp = 0.72 + 0.28 * r;                 // louder: further...
        swingDur = 1.3 + 2.1 * r * r;          // ...and slower, and colder
        windDur = 0.5 + 0.4 * r; holdDur = 2.2 + 1.2 * r;
      } else if (x.pitch01(ch.hi) > 0.42 && sinceTick > 1.2) {
        sinceTick = 0; tickT = 0; tickDir = x.rnd() < 0.5 ? -1 : 1;
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H, R = robeOf(x), pres = x.p('presence');
      if (dt > 0) step(x, dt);
      layout(x);
      // Over a ground that no longer clears, the page's own slow fade lets each frame pile up on the last: this alpha
      // is the one that settles at the strength we want (and at full presence it is simply 1).
      const want = 0.1 + 0.9 * pres, keep = 0.88 * (1 - Math.pow(pres, 1.5));
      const a0 = want * (1 - keep) / (1 - keep * want);

      // ground: opaque while fully present, and it lets the page through as it goes quiet
      g.globalAlpha = Math.pow(pres, 1.5);
      const lift = g.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, Math.max(W, H) * 0.62);
      lift.addColorStop(0, R.lift); lift.addColorStop(1, R.ground);
      g.fillStyle = lift; g.fillRect(0, 0, W, H);

      // tip movement during the swing: the arc, and whom it crosses
      const tx = spine.x[N - 1], ty = spine.y[N - 1];
      if (st === 'swing' && dt > 0 && arc) {
        const lx = arc.pts[arc.pts.length - 2], ly = arc.pts[arc.pts.length - 1];
        if (whip > 0.22 && (!arc.pts.length || Math.hypot(tx - lx, ty - ly) > 5)) arc.pts.push(tx, ty);
        if (arc.pts.length > 400) arc.pts.splice(0, 2);
        if (prevTip) {
          // the hairline and its tip sweep through the air: whoever stands on that side and is passed goes
          const dx = tx - prevTip.x, dy = ty - prevTip.y;
          const reach = H * 0.05 + H * 0.035 * x.p('flourish');
          if (whip > 0.12) for (const p of pets) {
            if (p.fl || p.side !== side) continue;
            let hit = false;
            for (let i = Math.round(N * 0.5); i < N && !hit; i += 3) hit = Math.abs(p.x - spine.x[i]) < reach && Math.abs(p.y - spine.y[i]) < reach;
            if (hit) {
              flick(p, dx, dy, 0);
              pets.forEach((q, i) => { if (q.gid === p.gid && !q.fl) flick(q, dx, dy, 0.05 * ((i % 6) + 1)); });   // a delegation goes together
            }
          }
        }
        prevTip = { x: tx, y: ty };
      }

      // the gold arcs: they stay a moment, then go
      g.lineCap = 'round';
      for (const c of arcs) {
        if (dt > 0 && c !== arc) c.age += dt;
        const n = c.pts.length / 2; if (n < 2) continue;
        const fade = (1 - smooth(0.9, 2.6, c.age)) * a0;
        g.strokeStyle = `rgb(${R.arc})`;
        const chunk = 5;
        for (let i = 0; i < n - 1; i += chunk) {
          const k = i / Math.max(1, n - 1), e = Math.min(n - 1, i + chunk);
          g.globalAlpha = fade * (0.18 + 0.72 * Math.sin(Math.PI * Math.pow(k, 0.8)));
          g.lineWidth = 0.6 + 2.4 * Math.sin(Math.PI * Math.pow(k, 0.8));
          g.beginPath(); g.moveTo(c.pts[i * 2], c.pts[i * 2 + 1]);
          for (let j = i + 1; j <= e; j++) g.lineTo(c.pts[j * 2], c.pts[j * 2 + 1]);
          g.stroke();
        }
      }
      arcs = arcs.filter((c) => c === arc || c.age < 2.6);

      // the figure
      const coldness = clamp(Math.abs(turn));
      const top = spine.y[N - 1], bottom = spine.y[0];
      const gr = g.createLinearGradient(0, bottom, 0, Math.min(top, H * 0.1));
      gr.addColorStop(0, R.low); gr.addColorStop(0.45, R.high); gr.addColorStop(1, R.low);
      g.globalAlpha = a0;
      g.fillStyle = gr; ribbon(g, -1, 1, 0, N - 1); g.fill();
      // cold: turned away, the velvet loses its warmth
      if (coldness > 0.01) { g.globalAlpha = a0 * 0.34 * coldness; g.fillStyle = R.ground; ribbon(g, -1, 1, 0, N - 1); g.fill(); }
      // the sheen, slowly moving along the belly, in soft nested bands
      const sc = 0.3 + 0.1 * Math.sin(time * 0.31);
      const shY = mix(bottom, H * 0.05, sc);
      const shg = g.createLinearGradient(0, shY + H * 0.2, 0, shY - H * 0.2);
      shg.addColorStop(0, `rgba(${R.sheen},0)`); shg.addColorStop(0.5, `rgba(${R.sheen},1)`); shg.addColorStop(1, `rgba(${R.sheen},0)`);
      g.fillStyle = shg; g.globalCompositeOperation = 'lighter';
      const shA = a0 * (1 - 0.6 * coldness);
      g.globalAlpha = shA * 0.055;
      for (let i = 0; i < 9; i++) { const k = i / 8; ribbon(g, mix(-0.35, 0.34, k), mix(0.96, 0.42, k), 3, N - 16); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      // the gold hairline, along one side only
      g.strokeStyle = `rgb(${R.edge})`; g.lineWidth = 1.15; g.globalAlpha = a0 * (0.72 + 0.28 * flash);
      g.beginPath();
      for (let i = 0; i < N; i++) { const w = spine.w[i]; g[i ? 'lineTo' : 'moveTo'](spine.x[i] + spine.nx[i] * w, spine.y[i] + spine.ny[i] * w); }
      g.stroke();
      // the glint of an attack: a thin bright run along that edge
      for (const q of glints) {
        q.age += dt;
        const k = 1 - q.age / 0.42; if (k <= 0) continue;
        const c = Math.round(q.s * (N - 1)), half = Math.round(3 + 9 * q.v), a = clamp(c - half, 0, N - 1), b = clamp(c + half, 0, N - 1);
        g.globalAlpha = a0 * k * k * q.v; g.lineWidth = 1.2 + 1.6 * q.v; g.strokeStyle = '#fff4d6';
        g.beginPath();
        for (let i = a; i <= b; i++) { const w = spine.w[i]; g[i === a ? 'moveTo' : 'lineTo'](spine.x[i] + spine.nx[i] * w, spine.y[i] + spine.ny[i] * w); }
        g.stroke();
      }
      glints = glints.filter((q) => q.age < 0.42);

      // the petitioners
      const hurry = 1 + 2 * boost;
      for (const p of pets) {
        p.born += dt;
        let alpha = 1;
        if (p.fl) {
          // flicked: a rising spiral out and away, not looking back
          p.fl.t += dt;
          if (p.fl.t > 0) {
            const age = p.fl.t, sp = H * (0.42 + 0.9 * age), c = Math.cos(p.fl.om * dt), s = Math.sin(p.fl.om * dt);
            const vx = p.fl.vx * c - p.fl.vy * s, vy = p.fl.vx * s + p.fl.vy * c; p.fl.vx = vx; p.fl.vy = vy;
            if (dt > 0) { p.x += vx * sp * dt; p.y += vy * sp * dt; p.fl.trail.push(p.x, p.y); if (p.fl.trail.length > 36) p.fl.trail.splice(0, 2); p.a += dt * 7; }
            alpha = 1 - smooth(0.45, 1.5, age);
            if (p.fl.trail.length > 3) {
              g.globalAlpha = a0 * alpha * 0.6; g.strokeStyle = `rgb(${R.arc})`; g.lineWidth = 0.9;
              g.beginPath(); g.moveTo(p.fl.trail[0], p.fl.trail[1]);
              for (let i = 2; i < p.fl.trail.length; i += 2) g.lineTo(p.fl.trail[i], p.fl.trail[i + 1]);
              g.stroke();
            }
          }
        } else if (p.prog < 1) {
          // eager small steps: quick pulses of movement, a little faster at every attack
          p.phase += dt * 5.2 * hurry;
          const pulse = Math.pow(Math.sin(p.phase * Math.PI), 2);
          p.prog = Math.min(1, p.prog + dt / p.travel * (0.25 + 1.5 * pulse) * Math.min(2, hurry));
          const e = 1 - Math.pow(1 - p.prog, 1.8);
          p.x = mix(p.sx, p.tx, e); p.y = mix(p.sy, p.ty, e) - pulse * 1.6;
        } else {
          // stopped short, waiting, and at last giving up
          p.left += dt;
          alpha = 1 - smooth(p.wait, p.wait + 1.3, p.left);
        }
        const flare = Math.max(0, 1 - p.born / 0.22);
        g.save(); g.translate(p.x, p.y); g.rotate(p.a);
        g.globalAlpha = a0 * alpha * (0.82 + 0.18 * flare);
        g.fillStyle = `rgb(${R.pet})`;
        const r = p.r * (1 + 0.8 * flare);
        g.beginPath();
        if (p.lozenge) { g.moveTo(r * 1.5, 0); g.lineTo(0, r * 0.62); g.lineTo(-r * 1.5, 0); g.lineTo(0, -r * 0.62); g.closePath(); } else g.arc(0, 0, r * 0.7, 0, 7);
        g.fill();
        g.restore();
      }
      pets = pets.filter((p) => (p.fl ? p.fl.t < 1.5 : p.left < p.wait + 1.3) && p.x > -80 && p.x < W + 80 && p.y > -80 && p.y < H + 80);
    },
  });
})();
