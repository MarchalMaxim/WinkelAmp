// Royal (the user: "Royal. elegant. dismissive"): the flick of the wrist. One tall brushed stroke holds the middle of the
// page and a small court of marks darts in from the edges, every one hopping forward on every note. It ignores them. On a
// strong attack it rises slowly, leans away with its chin up and cocks the tip of the stroke; on the next attack the tip
// alone flicks outward, and everyone on that side is sent off the page in straight gold lines. The stroke does not
// watch them go, and for a while no one dares come back on that side. The louder the demand, the slower and colder the rise.
(() => {
  const N = 80;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
  const smoother = (k) => { k = clamp(k); return k * k * k * (k * (k * 6 - 15) + 10); };
  const mix = (a, b, k) => a + (b - a) * k;
  const ROBES = [
    { name: 'purple and gold', ground: '#150a20', lift: '#21112f', low: '#2b0d42', high: '#57205f', sheen: '178,118,176', grain: '150,92,160', edge: '217,178,94', pet: '243,234,214', pet2: '226,186,110', pet3: '205,150,190', arc: '217,178,94' },
    { name: 'black and gold', ground: '#0a090c', lift: '#17151a', low: '#121014', high: '#28242c', sheen: '150,142,156', grain: '110,104,116', edge: '226,186,96', pet: '240,232,212', pet2: '226,186,96', pet3: '170,160,178', arc: '226,186,96' },
    { name: 'oxblood and ivory', ground: '#180708', lift: '#260c0d', low: '#3e0b0e', high: '#701a1a', sheen: '206,130,112', grain: '170,84,74', edge: '238,226,200', pet: '246,240,226', pet2: '226,190,150', pet3: '214,120,104', arc: '238,226,200' },
  ];
  const robeOf = (x) => ROBES[clamp(Math.round(x.p('robe')), 0, ROBES.length - 1)];

  // The grain of the brush: dry streaks along the stroke, fixed so that the surface is matte and never flickers.
  const lcg = (() => { let s = 90211; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const BRISTLES = [];
  for (let i = 0; i < 18; i++) { const a = Math.floor(lcg() * 56), len = 10 + Math.floor(lcg() * 34); BRISTLES.push({ o: mix(-0.86, 0.86, lcg()), a, b: Math.min(N - 2, a + len), lw: mix(0.7, 2.1, lcg()), dark: i % 3 === 0 }); }
  const WOB = new Float32Array(N); for (let i = 0; i < N; i++) { const s = i / (N - 1); WOB[i] = 1 + 0.05 * Math.sin(s * 19 + 1.3) + 0.012 * Math.sin(s * 47 + 0.4); }
  const RET = 2.2;   // how long the figure takes to come back to its S

  // A note's strength judged against this piece's own notes (recordings differ a lot in how hard they play): 0..1.
  let velOf = null, vels = [];
  const rank = (v) => {
    if (velOf !== window.NOTES) { velOf = window.NOTES; vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b); }
    if (!vels.length) return clamp(v / 115);
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length;
  };

  let time, pets, glints, flash, sinceTurn, sinceBow, sinceTick, sincePet, sinceNote, sinceBright, sinceSent;
  // The gesture: rest, lift (rises, leans away, cocks the tip), flick (the tip alone, fast), hold, ret. side: who gets it.
  let st, stT, side, amp, liftDur, holdDur, turn, engage, aim, aim0, sting, tick, tickT, tickDir, bowT;
  const spine = { x: new Float32Array(N), y: new Float32Array(N), nx: new Float32Array(N), ny: new Float32Array(N), w: new Float32Array(N) };
  let ax = 0;
  const init = () => {
    time = 0; pets = []; glints = []; flash = 0; sinceTurn = 99; sinceBow = 99; sinceTick = 99; sincePet = 99; sinceNote = 99; sinceBright = 99; sinceSent = 99;
    st = 'rest'; stT = 0; side = -1; amp = 1; liftDur = 1; holdDur = 2; turn = 0; engage = 0; aim = 0; aim0 = 0; sting = 0; tick = 0; tickT = 9; tickDir = 1; bowT = 99;
  };
  init();

  const bowAmt = () => (bowT < 4.5 ? Math.sin(Math.PI * smooth(0, 1, bowT / 4.5)) : 0);   // slowly down and up, once: a nod, no more
  const flOf = (x) => clamp((x.p('flourish') - 0.2) / 1.4);

  function layout(x) {
    const W = x.W, H = x.H, L = H * 1.17, pres = x.p('presence');
    const fit = Math.min(1, (W / H) * 1.1);          // a narrow picture gets a narrower gesture
    const q = (0.35 + 0.65 * pres) * fit;            // how much of the gesture shows
    const haughty = x.p('haughty');
    const lean = -side * turn * haughty * q * 0.17;  // chin up, away: the body itself hardly moves
    const breath = 1 + 0.045 * (0.3 + 0.7 * pres) * Math.sin(time * 0.55);
    const sway = 0.018 * (0.3 + 0.7 * pres) * Math.sin(time * 0.23 + 0.7);
    const bow = bowAmt() * (0.35 + 0.65 * pres), preen = 0.17 * (0.25 + 0.75 * pres) * (1 - 0.7 * clamp(turn));
    const belly = H * 0.062 * (1 - 0.28 * clamp(turn * haughty) * q);   // turning, it goes edge-on
    const s0 = mix(0.86, 0.62, flOf(x));             // only this last part of the stroke flicks
    const rise = 1 - 0.26 * clamp(turn) * q;         // turned away, the S draws itself up, but stays an S
    ax = W / 2;
    let px = ax - H * 0.05, py = H * 1.09, top = 1e9;   // it rises from below the page: no foot, no leaf
    const ds = L * 0.985 / (N - 1);
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      let th = 0.78 * breath * Math.cos(2 * Math.PI * (s * 0.96 + 0.02)) * (s > 0.3 ? mix(1, rise, smooth(0.3, 0.55, s)) : 1);
      th += 0.9 * Math.pow(smooth(0.86, 1, s), 2);                  // an open end, hardly a curl
      th += (lean + sway) * smooth(0, 0.45, s) + tick * tickDir * 0.34 * smooth(0.78, 1, s) + bow * 0.15 * smooth(0.25, 0.8, s);
      th += preen * Math.sin(time * 0.42 - s * 3.1) * smooth(0.35, 1, s);   // the upper stroke is never quite still: it preens
      th = mix(th, side * aim, clamp(engage) * q * smooth(s0 - 0.16, 1, s));   // the flick: the tip alone is aimed
      const d = ds * (1 - 0.15 * clamp(engage)) * (s > s0 ? 1 + 0.22 * sting : 1);   // drawn in a little, so the tip has room
      px += Math.sin(th) * d; py -= Math.cos(th) * d;
      spine.x[i] = px; spine.y[i] = py; if (py < top) top = py;
      spine.nx[i] = Math.cos(th); spine.ny[i] = Math.sin(th);
      spine.w[i] = 0.5 + belly * WOB[i] * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.55)), 2.1);
    }
    // Never off the top of the page: the base is below the page anyway, so the whole stroke slides down a little.
    const over = H * 0.035 - top;
    if (over > 0) for (let i = 0; i < N; i++) spine.y[i] += over;
  }

  function ribbon(g, a, b, from, to) {   // one polygon between two offsets (in half-widths) of the spine, nodes from..to
    g.beginPath();
    for (let i = from; i <= to; i++) { const w = spine.w[i] * a; g[i === from ? 'moveTo' : 'lineTo'](spine.x[i] + spine.nx[i] * w, spine.y[i] + spine.ny[i] * w); }
    for (let i = to; i >= from; i--) { const w = spine.w[i] * b; g.lineTo(spine.x[i] + spine.nx[i] * w, spine.y[i] + spine.ny[i] * w); }
    g.closePath();
  }

  // Where the stroke's body stands at height y, and how wide (the flicking tip doesn't count).
  let atX = 0, atW = 0;
  const bodyAt = (y) => {
    const end = Math.round(N * 0.74); let best = 0, d = 1e9;
    for (let i = 0; i <= end; i += 3) { const e = Math.abs(spine.y[i] - y); if (e < d) { d = e; best = i; } }
    atX = spine.x[best]; atW = spine.w[best];
  };

  // Off the page, outward from the figure and never across it, in a straight line: nobody looks back.
  function dismiss(x) {
    st = 'flick'; stT = 0; flash = 1; sting = 1;
    sinceTurn = 0; sinceSent = 0;
    for (const p of pets) {
      if (p.fl || p.side !== side) continue;
      const out = Math.max(0.5, Math.abs(p.x - ax) / (x.W * 0.5));
      const vx = side * out, vy = ((p.y - x.H * 0.55) / x.H) * 0.8 - x.rnd(0.02, 0.28), sp = Math.hypot(vx, vy);
      p.fl = { t: -clamp(Math.abs(p.x - ax) / x.W) * 0.09, vx: vx / sp, vy: vy / sp, ox: p.x, oy: p.y, spin: x.rnd(-1, 1) * 3 };
    }
  }

  function step(x, dt) {
    time += dt; stT += dt; sinceTurn += dt; sinceBow += dt; sinceTick += dt; sincePet += dt; sinceNote += dt; sinceBright += dt; sinceSent += dt; tickT += dt; bowT += dt;
    flash *= Math.pow(0.5, dt / 0.11); sting *= Math.pow(0.5, dt / 0.16);
    const out = 0.5 + 0.45 * flOf(x);       // how far outward the tip ends, in radians from upright: up and out, never flat
    if (st === 'lift') {
      const k = smoother(stT / liftDur);
      turn = amp * k; engage = smooth(0, 0.7, stT / liftDur); aim = -0.5 * k;       // the tip cocks away from whom it will hit
      if (stT >= liftDur + 1.2) { st = 'ret'; stT = 0; aim0 = aim; }                // no note came: not worth the trouble, it sinks back
    } else if (st === 'flick') {
      const k = clamp(stT / 0.2), back = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);   // out, past, and settled
      turn = amp; engage = 1; aim = mix(-0.5, out, back);
      if (stT >= 0.2) { st = 'hold'; stT = 0; }
    } else if (st === 'hold') {
      turn = amp; engage = 1; aim = mix(out, out * 0.42, smooth(0, 0.55, stT));  // done with them: straight back up, chin in the air
      if (stT >= holdDur) { st = 'ret'; stT = 0; aim0 = aim; }
    } else if (st === 'ret') {
      const k = smoother(stT / RET); turn = amp * (1 - k); engage = 1 - k; aim = aim0;
      if (stT >= RET) { st = 'rest'; stT = 0; turn = 0; engage = 0; }
    }
    tick = tickT < 0.9 ? Math.sin(Math.PI * smooth(0, 1, tickT / 0.9)) : 0;
  }

  function drawMark(g, p, r) {
    g.beginPath();
    switch (p.shape) {
      case 'lozenge': g.moveTo(r * 1.5, 0); g.lineTo(0, r * 0.6); g.lineTo(-r * 1.5, 0); g.lineTo(0, -r * 0.6); g.closePath(); g.fill(); break;
      case 'dot': g.arc(0, 0, r * 0.72, 0, 7); g.fill(); break;
      default: g.arc(0, 0, r * 0.8, 0, 7); g.lineWidth = Math.max(1.2, r * 0.22); g.stroke();
    }
  }

  function spawn(x, pside, r, p, near) {
    const W = x.W, H = x.H;
    const close = clamp(near * 1.1 * Math.pow(r, 0.8) + near * 0.42);          // soft ones stop far off, unnoticed
    // Each takes the most open of a few places on its side, so they stand apart and do not heap up.
    let ty = 0, gapMin = 0, room = -1;
    for (let c = 0; c < 5; c++) {
      const cy = clamp(mix(H * 0.86, H * 0.12, clamp(p * 1.2)) + x.rnd(-H * 0.27, H * 0.27), H * 0.06, H * 0.94), cg = mix(W * 0.3, H * 0.05 + 18, close) + x.rnd(0, W * 0.16);
      let least = 1e9; for (const q of pets) if (q.side === pside && !q.fl && !q.leave) least = Math.min(least, Math.hypot(q.ty - cy, q.gapMin - cg));
      if (least > room) { room = least; ty = cy; gapMin = cg; }
    }
    const fromBelow = p < 0.3 && x.rnd() < 0.5;
    const big = Math.pow(r, 1.4) * (1.25 - 0.5 * p);
    const pick = x.rnd(), shape = pick < 0.5 ? 'lozenge' : pick < 0.85 ? 'dot' : 'ring', tint = x.rnd();
    pets.push({
      x: fromBelow ? W / 2 + pside * x.rnd(W * 0.15, W * 0.46) : W / 2 + pside * (W / 2 + 12), y: fromBelow ? H + 12 : ty, ty, side: pside,
      gap: gapMin + x.rnd(W * 0.03, W * 0.27), gapMin, hop: 1, flare: 1, dy: 0, a: x.rnd(-0.5, 0.5), seed: x.rnd(0, 7),
      r: (9 + 9 * big) * x.rnd(0.85, 1.15), shape, tint: tint < 0.3 ? 'pet' : tint < 0.7 ? 'pet2' : 'pet3', timid: x.rnd(0.5, 2.6),
      age: 0, wait: x.rnd(7, 15), leave: 0,
    });
  }

  const hasBow = (ch, r) => ch.lo <= 38 && ch.notes.length >= 2 && r >= 0.55;

  TOOLS.push({
    id: 'royal', name: 'Royal', tag: 'new',
    blurb: 'One tall brushed stroke holds the middle of the page, and a small court of marks darts in from the edges, hopping forward on every note. It ignores them. On a strong attack it rises slowly and leans away, and on the next the tip alone flicks outward: everyone on that side is sent off the page. It does not watch them go. The louder the demand, the slower and colder the rise.',
    params: [
      { key: 'haughty', label: 'how far it turns away', min: 0.15, max: 1.4, value: 1, less: 0.5,
        hint: 'How far the figure leans back from them before it flicks. Left: a slight lift of the chin. Right: it turns its whole back.',
        icon: (g, v, w, h) => { g.save(); g.translate(w / 2, h - 2); g.rotate(v * 0.8); g.lineWidth = 3; g.strokeStyle = '#d9b25e'; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-7, -7, 7, -13, 0, -21); g.stroke(); g.restore(); } },
      { key: 'flourish', label: 'how grand the gesture is', min: 0.2, max: 1.6, value: 1, less: 0.4,
        hint: 'How much of the stroke flicks, and how far. Left: only the very tip. Right: the whole upper part, in a sweep.',
        icon: (g, v, w, h) => { const r = 5 + v * 7; g.strokeStyle = '#d9b25e'; g.beginPath(); g.arc(w / 2, h - 5, r, -Math.PI / 2 - 0.4 - v * 1.2, -Math.PI / 2 + 0.4); g.stroke(); } },
      { key: 'crowd', label: 'how many come near', min: 0, max: 1, value: 0.45, less: 0.05,
        hint: 'How many small marks come up to it. Left: one at a time. Right: a stream of them.',
        icon: (g, v, w, h) => ICON.dots(g, 1 + Math.round(v * 14), w, h, { seed: 5, r: 1.3, col: '#f3ead6', pad: 3 }) },
      { key: 'near', label: 'how close they get', min: 0, max: 1, value: 0.6,
        hint: 'How close the marks dare come. Left: they stop far off. Right: right up to it.',
        icon: (g, v, w, h) => { ICON.rect(g, w - 9, 3, 4, h - 6, '#8a2f7e'); ICON.dot(g, 4 + v * (w - 18), h / 2, 2.2, '#f3ead6'); } },
      { key: 'robe', label: 'the colour', min: 0, max: 2, step: 1, value: 0,
        hint: 'Which colours it wears. Left: purple and gold. Middle: black and gold. Right: oxblood and ivory.',
        icon: (g, v, w, h) => { const r = ROBES[clamp(Math.round(v * 2), 0, 2)]; ICON.palette(g, [r.high, `rgb(${r.edge})`, r.ground], w, h); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much court there is: how many marks come near, how grand the gesture, how far it turns away. Left: one mark at a time and a slight lift of the chin. Right: the full court and the whole turning of the back. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { init(); },
    onChord(ch, x) {
      const pres = x.p('presence'), crowd = x.p('crowd'), near = x.p('near');
      const r = rank(ch.vel), p = x.pitch01((ch.lo + ch.hi) / 2);
      const heard = r >= (1 - pres) * 0.94;
      if (!heard) return;
      const W = x.W, H = x.H;
      // In the same frame, whatever else happens. The figure's edge and grain catch it, from the height of the note...
      glints.push({ s: clamp(0.08 + 0.8 * x.pitch01(ch.hi)), age: 0, v: 0.45 + 0.55 * r });
      if (glints.length > 5) glints.shift();
      flash = Math.max(flash, 0.3 + 0.7 * r);
      // ...and the whole court hops forward at once, eager, and flares.
      // Only the top attacks go cream, and not all of them in a dense run, which still pulses but stays in colour.
      const fresh = Math.max(smooth(0.1, 0.4, sinceNote), sinceBright > 0.35 && r > 0.85 ? 1 : 0), pulse = (0.2 + 0.8 * r * r) * mix(0.6, 1, fresh);
      sinceNote = 0; if (pulse > 0.6) sinceBright = 0;
      for (const q of pets) if (!q.fl && !q.leave) { q.hop = Math.max(q.hop, 0.4 + 0.6 * r); q.flare = Math.max(q.flare, pulse); q.dy += x.rnd(-1, 1) * H * 0.012; }

      // Who comes: in a burst from the edge. For a while after a flick no one dares on that side.
      const cool = sinceSent < 6.5;
      const maxAlive = Math.round(mix(2, 46, Math.pow(crowd, 1.5)) * mix(0.4, 1, pres)), gap = mix(0.9, 0.04, Math.sqrt(crowd));
      if (sincePet >= gap * (r > 0.8 ? 0.4 : 1)) {
        sincePet = 0;
        const count = ch.notes.length >= 3 ? Math.min(Math.round(mix(1, 5, crowd * 1.3)), ch.notes.length) : 1;
        const pside = cool ? -side : (x.rnd() < 0.5 ? -1 : 1);
        const walking = pets.filter((q) => !q.fl && !q.leave);
        for (let over = walking.length + count - maxAlive, i = 0; over > 0 && i < walking.length; over--, i++) walking[i].leave = 1e-6;   // the oldest give up
        for (let i = 0; i < count; i++) spawn(x, pside, r, p, near);
      }

      // What it does about it. The figure refuses to be hurried: only the flick itself lands on a note.
      if (st === 'lift' && stT >= liftDur * 0.75 && r >= 0.2) { dismiss(x); return; }
      if (st !== 'rest') return;
      if (hasBow(ch, r) && sinceBow > 11 && bowT > 4.5) { bowT = 0; sinceBow = 0; }
      // Strong means strong for this piece; a long silence of gestures slowly lowers the bar, so it never just sleeps.
      const bar = Math.max(0.58, 0.9 - 0.022 * Math.max(0, sinceTurn - 5)) + (1 - pres) * 0.09;
      let n = 0, sum = 0; for (const q of pets) if (!q.fl && !q.leave && q.age > 0.4) { n++; sum += q.side; }
      if ((r >= bar || (ch.notes.length >= 4 && r >= bar - 0.12)) && sinceTurn > 6 && n) {
        st = 'lift'; stT = 0; sinceTurn = 0;
        side = sum ? Math.sign(sum) : (x.rnd() < 0.5 ? -1 : 1);   // whichever side crowds it more
        amp = 0.72 + 0.28 * r;                 // louder: further...
        liftDur = 0.55 + 1.0 * r * r;          // ...and slower, and colder
        holdDur = 1.1 + 0.9 * r;
      } else if (x.pitch01(ch.hi) > 0.42 && sinceTick > 1.2) {
        sinceTick = 0; tickT = 0; tickDir = x.rnd() < 0.5 ? -1 : 1;
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H, R = robeOf(x), pres = x.p('presence');
      if (dt > 0) {
        step(x, dt);
        // A thin passage gives them few notes to come on: a few still creep in unbidden, small, and wait.
        if (pres > 0.35 && sincePet > 1.5) {
          let waiting = 0; for (const q of pets) if (!q.fl && !q.leave) waiting++;
          if (waiting < Math.round(mix(1, 6, Math.sqrt(x.p('crowd'))))) { sincePet = 0; spawn(x, sinceSent >= 6.5 ? (x.rnd() < 0.5 ? -1 : 1) : -side, x.rnd(0.35, 0.8), x.rnd(0.3, 0.8), x.p('near')); }
        }
      }
      layout(x);
      // Over a ground that no longer clears, the page's own slow fade lets each frame pile up on the last: this alpha is
      // the one that settles at the strength we want. It keeps a floor, so the left end is faint and not simply black.
      const groundA = Math.pow(smooth(0.22, 1, pres), 1.3);
      const want = mix(0.5, 1, pres), keep = 0.88 * (1 - groundA);
      const a0 = want * (1 - keep) / (1 - keep * want);
      const am = clamp(a0 * (pres < 1 ? 1.35 : 1));   // what moves has to be seen before it has moved on
      const figW = mix(0.6, 1, pres), a0Figure = figW * (1 - keep) / (1 - keep * figW);   // quiet, the figure still outweighs the court
      // Over a page that fades slowly a moving thing leaves ghosts. So when quiet nothing travels: marks appear and go where
      // they stand, and being sent away is one still line that the page itself fades.
      const quiet = 1 - smooth(0.35, 0.65, pres);

      // ground: opaque while fully present, and it lets the page through as it goes quiet. Flat when thin (a thin
      // gradient piles its dither up into a visible texture).
      if (groundA > 0.012) {
        g.globalAlpha = groundA; g.fillStyle = R.ground; g.fillRect(0, 0, W, H);
        if (pres > 0.6) {
          const lift = g.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, Math.max(W, H) * 0.62);
          lift.addColorStop(0, R.lift); lift.addColorStop(1, R.ground);
          g.globalAlpha = groundA * smooth(0.6, 1, pres); g.fillStyle = lift; g.fillRect(0, 0, W, H);
        }
      }

      g.lineCap = 'round'; g.lineJoin = 'round';

      // the figure: matte, brushed, one broad soft light and the dry grain of the brush
      const coldness = clamp(turn);
      const top = spine.y[N - 1], bottom = spine.y[0];
      const gr = g.createLinearGradient(0, bottom, 0, Math.min(top, H * 0.1));
      gr.addColorStop(0, R.low); gr.addColorStop(0.42, R.high); gr.addColorStop(1, R.low);
      g.globalAlpha = a0Figure;
      g.fillStyle = gr; ribbon(g, -1, 1, 0, N - 1); g.fill();
      if (coldness > 0.01) { g.globalAlpha = a0Figure * 0.2 * coldness; g.fillStyle = R.ground; ribbon(g, -1, 1, 0, N - 1); g.fill(); }
      const shY = mix(bottom, H * 0.05, 0.3 + 0.14 * Math.sin(time * 0.37));
      const shg = g.createLinearGradient(0, shY + H * 0.24, 0, shY - H * 0.24);
      shg.addColorStop(0, `rgba(${R.sheen},0)`); shg.addColorStop(0.5, `rgba(${R.sheen},1)`); shg.addColorStop(1, `rgba(${R.sheen},0)`);
      g.fillStyle = shg; g.globalAlpha = a0Figure * (0.17 + 0.2 * flash) * (1 - 0.6 * coldness);
      ribbon(g, -0.12, 0.82, 3, N - 16); g.fill();
      // grain: light streaks catch an attack as a shiver down the whole stroke; dark ones split the brush
      for (let dark = 0; dark < 2; dark++) {
        g.strokeStyle = dark ? R.ground : `rgb(${R.grain})`;
        g.globalAlpha = a0Figure * (dark ? 0.3 : 0.1 + 0.6 * flash * flash);
        for (const b of BRISTLES) {
          if (b.dark !== !!dark) continue;
          g.lineWidth = b.lw; g.beginPath();
          for (let i = b.a; i <= b.b; i += 2) { const w = spine.w[i] * b.o; g[i === b.a ? 'moveTo' : 'lineTo'](spine.x[i] + spine.nx[i] * w, spine.y[i] + spine.ny[i] * w); }
          g.stroke();
        }
      }
      // the gold edge, along one side only, drawn with a pen that swells and thins; an attack thickens all of it
      g.fillStyle = `rgb(${R.edge})`; g.globalAlpha = a0Figure * (0.68 + 0.32 * flash);
      g.beginPath();
      for (let i = 0; i < N; i++) { const w = spine.w[i]; g[i ? 'lineTo' : 'moveTo'](spine.x[i] + spine.nx[i] * w, spine.y[i] + spine.ny[i] * w); }
      for (let i = N - 1; i >= 0; i--) { const s = i / (N - 1), w = spine.w[i] + (0.55 + 1.5 * Math.pow(Math.sin(s * 9.4 + 0.6), 2)) * (1 + 1.6 * flash); g.lineTo(spine.x[i] + spine.nx[i] * w, spine.y[i] + spine.ny[i] * w); }
      g.closePath(); g.fill();
      // the glint of an attack: a bright run outward along that edge
      g.strokeStyle = '#fff4d6';
      for (const q of glints) {
        q.age += dt;
        const k = 1 - q.age / 0.42; if (k <= 0) continue;
        const c = Math.round(q.s * (N - 1)), half = Math.round(5 + 34 * q.v * smooth(0, 0.3, q.age)), a = clamp(c - half, 0, N - 1), b = clamp(c + half, 0, N - 1);
        g.globalAlpha = am * k * k * q.v; g.lineWidth = 1.4 + 2.2 * q.v;
        g.beginPath();
        for (let i = a; i <= b; i++) { const w = spine.w[i]; g[i === a ? 'moveTo' : 'lineTo'](spine.x[i] + spine.nx[i] * w, spine.y[i] + spine.ny[i] * w); }
        g.stroke();
      }
      glints = glints.filter((q) => q.age < 0.42);

      // the court
      const d1 = Math.pow(0.5, dt / 0.1), d2 = Math.pow(0.5, dt / 0.13), kx = 1 - Math.exp(-dt * mix(13, 3.5, quiet)), ky = 1 - Math.exp(-dt * mix(8, 3.5, quiet));
      const hopPx = H * 0.075 * mix(1, 0.1, quiet) * (0.3 + 0.7 * pres), creep = H * 0.012;
      for (const p of pets) {
        let alpha = 1;
        if (p.fl) {
          // sent away: straight off the page, gathering speed, a gold line behind
          if (dt > 0) p.fl.t += dt;
          const age = Math.max(0, p.fl.t);
          if (quiet > 0.5) {
            // quiet: one still line to the page's edge, on the attack, and the mark goes out where it stands
            if (p.fl.t > 0 && age < 0.1) {
              const reach = Math.max(x.W, x.H) * 1.2;
              g.globalAlpha = am * 0.9; g.strokeStyle = `rgb(${R.arc})`; g.lineWidth = 0.9 + p.r * 0.03;
              g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + p.fl.vx * reach, p.y + p.fl.vy * reach); g.stroke();
            }
            if (p.fl.t > 0.18) continue;
          } else if (p.fl.t > 0) {
            if (dt > 0) { const sp = H * (1.15 + 2.6 * age); p.x += p.fl.vx * sp * dt; p.y += p.fl.vy * sp * dt; p.a += p.fl.spin * dt; }
            const tk = clamp((age - 0.14) / 0.75), fade = 1 - smooth(0.4, 1.1, age);
            if (fade > 0) {
              g.globalAlpha = am * fade * 0.8; g.strokeStyle = `rgb(${R.arc})`; g.lineWidth = 0.9 + p.r * 0.05;
              g.beginPath(); g.moveTo(mix(p.fl.ox, p.x, tk), mix(p.fl.oy, p.y, tk)); g.lineTo(p.x, p.y); g.stroke();
            }
          }
          p.flare = p.fl.t < 0.1 ? 0.8 : 0;
        } else if (dt > 0) {
          p.age += dt; p.hop *= d2; p.flare *= d1; p.dy *= Math.exp(-dt * 0.7);
          p.timid -= dt;
          if (p.timid < 0) { p.timid = x.rnd(0.9, 3.4) * (0.6 + 0.4 * pres); p.hop = Math.max(p.hop, x.rnd(0.3, 0.7)); p.dy += x.rnd(-1, 1) * H * 0.018; }   // nobody asked: a timid dart anyway
          if (!p.leave) { p.gap = Math.max(p.gapMin, p.gap - dt * creep); if (p.age > p.wait) p.leave = 1e-6; }
          else { p.leave += dt; p.gap += dt * H * 0.3 * (1 - quiet); }
          const yT = p.ty + p.dy + Math.sin(time * (0.5 + p.seed * 0.1) + p.seed) * H * 0.016;
          bodyAt(yT);
          let dist = p.gap - p.hop * hopPx + Math.sin(time * (0.7 + p.seed * 0.08) + p.seed * 3) * H * 0.012;
          dist = Math.max(dist, atW + p.r * 1.7 + 8);                 // never onto the figure
          const xT = clamp(atX + p.side * dist, p.r - 30, W - p.r + 30);
          if (quiet > 0.5 && p.age <= dt) { p.x = xT; p.y = yT; }
          p.x += (xT - p.x) * kx; p.y += (yT - p.y) * ky;
          p.a += (Math.sin(time * 1.1 + p.seed) * 0.5 - p.a) * (1 - Math.exp(-dt * 3));
        }
        if (p.leave) alpha = 1 - smooth(0, 1.2, p.leave);
        const gone = p.fl ? smooth(0.05, 0.3, p.fl.t) : 0;   // sent away, the mark dwindles: what is left is the line, not a dot on a stick
        alpha *= 1 - 0.8 * gone;
        if (pres < 1 && !p.fl) alpha *= mix(smooth(0, 0.3, p.age), 1, pres * pres);   // quiet, the fast arrival isn't shown, or it smears
        if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) continue;
        const tr = p.fl ? 0 : (0.02 + 1.58 * pres * pres) * (0.45 + 2.6 * p.flare);   // always trembling, more when it flares
        g.save();
        g.translate(p.x + Math.sin(time * 37 + p.seed * 9) * tr, p.y + Math.cos(time * 29 + p.seed * 5) * tr);
        g.rotate(p.a + (p.side > 0 ? Math.PI : 0));                    // facing it, the eager ones
        g.globalAlpha = am * alpha * mix(0.42, 1, pres) * (0.58 + 0.42 * p.flare);
        const kc = smooth(0.5, 0.95, p.flare), rgb = R[p.tint].split(',');
        const col = `rgb(${mix(+rgb[0], 255, kc) | 0},${mix(+rgb[1], 246, kc) | 0},${mix(+rgb[2], 224, kc) | 0})`;
        g.fillStyle = col; g.strokeStyle = col;
        drawMark(g, p, p.r * (1 + 0.45 * p.flare) * (1 - 0.6 * gone));
        g.restore();
      }
      pets = pets.filter((p) => (p.fl ? p.fl.t < 1.3 : p.leave < 1.2));
    },
  });
})();
