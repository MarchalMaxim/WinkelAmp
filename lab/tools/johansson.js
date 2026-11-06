// Johansson: the score plans the footfalls; thirteen moving lights emerge from the stars.
(() => {
  const W = 1280, H = 720, TAU = Math.PI * 2, RAD = Math.PI / 180, FIGURE_ALPHA = 1;
  const HIP = [[0, 28], [.1, 25], [.3, 5], [.5, -12], [.62, -4], [.75, 22], [.87, 30], [1, 28]];
  const KNEE = [[0, 5], [.15, 18], [.4, 3], [.5, 8], [.6, 38], [.72, 62], [.85, 30], [.95, 5], [1, 5]];
  const PAIRS = [[11, 12], [9, 10], [7, 8], [3, 4], [1, 2], [5, 6], [0, 0]];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lower = (a, v, get = (x) => x) => { let l = 0, r = a.length; while (l < r) { const m = (l + r) >>> 1; if (get(a[m]) < v) l = m + 1; else r = m; } return l; };
  const rank = (a, v) => a.length ? lower(a, v) / a.length : .5;
  let steps = [], phrases = [], joints = [], stars = [], prev = [], rest = [], pending = [], sortedV = [];
  let shift = 0, walkClock = 0, st = -1, run = 0, sad = 0, proud = 0, liftR = 0, liftL = 0, liftRV = 0, liftLV = 0;
  let liftTargetR = 0, liftTargetL = 0, lastLoud = 0, lastCount = 0, phi = 0, amp = 1, phraseIndex = 0, strikePtr = 0;
  let world = [], dots = [], starDots = [], lastActual = null, moving = false, lastT = null, source = null, settings = '', sprites = null;
  let heightValue = 1;
  // Periodic Catmull–Rom: central tangents use the table's actual, uneven phase intervals.
  function sample(table, phase) {
    const c = ((phase % 1) + 1) % 1, n = table.length - 1; let i = 0;
    while (i + 1 < n && table[i + 1][0] <= c) i++;
    const a = table[i], b = table[i + 1], previous = table[(i + n - 1) % n], next = table[(i + 2) % n];
    const t0 = previous[0] - (i === 0 ? 1 : 0), t3 = next[0] + (i + 2 >= n ? 1 : 0), dt = b[0] - a[0], u = (c - a[0]) / dt;
    const m0 = (b[1] - previous[1]) / (b[0] - t0), m1 = (next[1] - a[1]) / (t3 - a[0]);
    return (2 * u ** 3 - 3 * u * u + 1) * a[1] + (u ** 3 - 2 * u * u + u) * dt * m0 +
      (-2 * u ** 3 + 3 * u * u) * b[1] + (u ** 3 - u * u) * dt * m1;
  }
  function gait(phase, a = 1, running = 0, down = 0, up = 0, rightLift = 0, leftLift = 0) {
    const yaw = 5 * a * Math.cos(TAU * phase) * RAD, lean = (2 + 20 * down - 3 * up + 8 * running) * RAD, sides = [];
    const armAmp = (18 * a + 6) * (1 - .6 * down) * (1 + .5 * up);
    for (const side of [1, -1]) {
      const c = phase + (side < 0 ? .5 : 0), hip = sample(HIP, c), knee = sample(KNEE, c);
      const h = (9 + (hip - 9) * a + 8 * running) * RAD, k = (5 + (knee - 5) * (.65 + .35 * a) + running * .8 * Math.max(0, knee - 20)) * RAD;
      const hipPoint = { x: side * .095 * Math.sin(yaw), y: 0, z: side * .095 * Math.cos(yaw) };
      const kneePoint = { x: hipPoint.x + .245 * Math.sin(h), y: -.245 * Math.cos(h), z: hipPoint.z };
      const ankle = { x: kneePoint.x + .246 * Math.sin(h - k), y: kneePoint.y - .246 * Math.cos(h - k), z: hipPoint.z };
      sides.push({ side, c, hip: hipPoint, knee: kneePoint, ankle });
    }
    const pelvisY = .039 - Math.min(sides[0].ankle.y, sides[1].ankle.y);
    const centre = { x: .288 * Math.sin(lean), y: pelvisY + .288 * Math.cos(lean) - .02 * down, z: 0 };
    const head = { x: centre.x + .12 * Math.sin(1.6 * lean), y: centre.y + .12 * Math.cos(1.6 * lean), z: 0 };
    const joints = [{ ...head, name: 'head', side: 0 }];
    for (const q of sides) {
      for (const key of ['hip', 'knee', 'ankle']) q[key].y += pelvisY;
      q.shoulder = { x: centre.x - q.side * .129 * Math.sin(1.4 * yaw), y: centre.y, z: q.side * .129 * Math.cos(1.4 * yaw) };
      const s = (-armAmp * Math.cos(TAU * q.c) + (q.side > 0 ? rightLift : leftLift)) * RAD;
      const e = ((22 - 10 * Math.cos(TAU * q.c)) * (1 - running) + 85 * running) * RAD;
      q.elbow = { x: q.shoulder.x + .186 * Math.sin(s), y: q.shoulder.y - .186 * Math.cos(s), z: q.shoulder.z };
      q.wrist = { x: q.elbow.x + .146 * Math.sin(s + e), y: q.elbow.y - .146 * Math.cos(s + e), z: q.shoulder.z };
    }
    for (const name of ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle']) for (const q of sides) joints.push({ ...q[name], name, side: q.side });
    return joints;
  }
  function project(joints, walkClock, phrase = { cx: 640, h: 540, floorY: 640, facing: 1 }) {
    const psi = (32 + 14 * Math.sin(.11 * walkClock)) * RAD;
    return joints.map((q) => ({ ...q, x: phrase.cx + phrase.h * phrase.facing * (q.x * Math.cos(psi) + q.z * Math.sin(psi)), y: phrase.floorY - phrase.h * q.y }));
  }
  function unfaced(body, clock) {
    const psi = (32 + 14 * Math.sin(.11 * clock)) * RAD;
    return body.map((q) => ({ x: q.x * Math.cos(psi) + q.z * Math.sin(psi), y: -q.y }));
  }
  function solvePhase(a, running) {
    const difference = (c) => { const q = gait(c, a, running); return q[11].y - q[12].y; };
    let lo = -.15, hi = .15, left = difference(lo);
    for (let k = 0; k < 12; k++) { const mid = (lo + hi) / 2, v = difference(mid); if (left * v > 0) { lo = mid; left = v; } else hi = mid; }
    return (lo + hi) / 2;
  }
  function plan(chords, values) {
    const velocities = chords.map((c) => c.vel).sort((a, b) => a - b), chosen = [];
    if (chords.length) chosen.push(0);
    let last = 0;
    while (chosen.length) {
      const t = chords[last].t; let first = last + 1;
      while (first < chords.length && chords[first].t < t + .30) first++;
      let best = -1;
      for (let i = first; i < chords.length && chords[i].t <= t + .42; i++) if (best < 0 || chords[i].vel > chords[best].vel) best = i;
      if (best < 0) { best = first; while (best < chords.length && chords[best].t <= t + .42) best++; }
      if (best >= chords.length) break;
      chosen.push(best); last = best;
    }
    let phrase = 0;
    return chosen.map((i, k) => {
      const t = chords[i].t, gap = k ? t - chords[chosen[k - 1]].t : Infinity;
      const tStart = k && gap <= values.maxStep ? chords[chosen[k - 1]].t : t - .85;
      if (k && tStart - chords[chosen[k - 1]].t >= 1.6) phrase++;
      const loud = rank(velocities, chords[i].vel), amp = clamp(.45 + .85 * loud, .45, 1.3) * values.stride, duration = t - tStart;
      const running = clamp((.5 - duration) / .18);
      return { k, i, tStart, tStrike: t, amp, run: running, phrase, loud, phiEnd: k * .5 + solvePhase(amp, running), phiStart: 0 };
    });
  }
  const motion = (r) => ({ flash: 0, strike: 0, dx: 0, dy: 0, vx: 0, vy: 0, r });
  function values(x) { return { stride: x.p('stride'), height: x.p('height'), maxStep: x.p('maxStep') }; }
  function reset(x) {
    steps = []; phrases = []; joints = []; stars = []; prev = []; rest = []; pending = []; source = null; settings = '';
    shift = walkClock = run = sad = proud = liftR = liftL = liftRV = liftLV = liftTargetR = liftTargetL = lastLoud = lastCount = 0;
    st = -1; phraseIndex = 0; lastT = null; lastActual = null; moving = false; dots = []; world = []; starDots = [];
    if (!x) return;
    const chords = typeof CHORDS !== 'undefined' ? CHORDS : [], v = values(x); heightValue = v.height; sortedV = chords.map((c) => c.vel).sort((a, b) => a - b);
    steps = plan(chords, v);
    for (let p = 0; p <= (steps[steps.length - 1]?.phrase || 0); p++) {
      const members = steps.filter((s) => s.phrase === p), mean = members.reduce((sum, s) => sum + s.loud, 0) / Math.max(1, members.length);
      const h = Math.min(640, (300 + 300 * mean * mean) * v.height), cx = W * (p % 2 ? .7 : .3) + x.rnd(-.05 * W, .05 * W);
      phrases.push({ cx, h, floorY: H / 2 + h / 2 + 10, facing: p % 2 ? -1 : 1 });
    }
    joints = Array.from({ length: 13 }, () => motion(x.rnd(2.4, 4.6)));
    stars = Array.from({ length: 170 }, () => ({ ...motion(x.rnd(2.4, 4.6)), ax: x.rnd(0, W + 160), ay: x.rnd(0, H), joint: Math.min(12, Math.floor(x.rnd(0, 13))) }));
    rest = Array.from({ length: 13 }, () => ({ x: 0, y: 0 }));
    for (let i = 0; i < 20; i++) unfaced(gait(i / 20), 0).forEach((q, j) => { rest[j].x += q.x / 20; rest[j].y += q.y / 20; });
    strikePtr = lower(steps, x.t, (s) => s.tStrike); phi = steps[0] ? steps[0].phiEnd - .5 : 0; amp = steps[0]?.amp || 1;
    source = chords; settings = JSON.stringify(v);
  }
  function ensure(x) { const ch = typeof CHORDS !== 'undefined' ? CHORDS : []; if (source !== ch || settings !== JSON.stringify(values(x)) || !joints.length) reset(x); }
  function locate(t) {
    const i = lower(steps, t, (s) => s.tStrike), next = steps[i];
    return { i, step: next, previous: steps[i - 1], walking: !!next && t >= next.tStart };
  }
  function spring(q, dt) {
    q.vx += (-28 * 28 * q.dx - 2 * .45 * 28 * q.vx) * dt; q.vy += (-28 * 28 * q.dy - 2 * .45 * 28 * q.vy) * dt;
    q.dx += q.vx * dt; q.dy += q.vy * dt;
  }
  function starsAt(body, clock) {
    const unit = unfaced(body, clock), scale = .35 * 450 * heightValue;
    return stars.map((q) => ({ x: ((q.ax + shift) % (W + 160) + W + 160) % (W + 160) - 80 + scale * (unit[q.joint].x - rest[q.joint].x) + q.dx,
      y: q.ay + scale * (unit[q.joint].y - rest[q.joint].y) + q.dy }));
  }
  function push(q, from, point, distance) { const dx = point.x - from.x, dy = point.y - from.y, r = Math.hypot(dx, dy) || 1; q.vx += dx / r * 49 * distance; q.vy += dy / r * 49 * distance; }
  function figureFade(t, timeline) {
    if (!steps.length || t < steps[0].tStart) return 0;
    if (timeline.walking) {
      const s = timeline.step, first = s.k === 0 || steps[s.k - 1].phrase !== s.phrase;
      return first ? clamp((t - s.tStart) / .3) : 1;
    }
    if (timeline.step && timeline.previous && timeline.step.phrase !== timeline.previous.phrase) return clamp((timeline.step.tStart - t) / .3);
    return 1;
  }
  function advanceFrame(x) {
    ensure(x); const dt = Math.max(0, x.dt), timeline = locate(x.t); moving = timeline.walking;
    let reanchor = false, moveDt = 0;
    if (moving) {
      const s = timeline.step;
      if (st !== s.k) {
        s.phiEnd = s.k * .5 + solvePhase(s.amp * (1 - .35 * sad), run);
        s.phiStart = s.k ? steps[s.k - 1].phiEnd : s.phiEnd - .5; st = s.k;
      }
      if (phraseIndex !== s.phrase) { phraseIndex = s.phrase; reanchor = true; }
      moveDt = Math.min(dt, Math.max(0, x.t - s.tStart));
      run += (s.run - run) * (1 - Math.exp(-moveDt / .25));
      const f = x.feat || { level: 0, pitch: .5 };
      sad += (clamp(1.15 - 1.3 * f.level - .5 * f.pitch) - sad) * (1 - Math.exp(-moveDt / 3));
      proud += (clamp(1.3 * f.level + .5 * f.pitch - .8) - proud) * (1 - Math.exp(-moveDt / 3));
      walkClock += moveDt;
      // run and sad keep easing during the step, so the phase where the ankles meet is solved again each frame with
      // this frame's values: on the strike frame the landing foot is then exactly level with the other one
      s.phiEnd = s.k * .5 + solvePhase(s.amp * (1 - .35 * sad), run);
      const u = clamp((x.t - s.tStart) / (s.tStrike - s.tStart)); phi = lerp(s.phiStart, s.phiEnd, u); amp = lerp(steps[s.k - 1]?.amp ?? s.amp, s.amp, u);
    } else if (timeline.previous) { phi = timeline.previous.phiEnd; amp = timeline.previous.amp; if (phraseIndex !== timeline.previous.phrase) { phraseIndex = timeline.previous.phrase; reanchor = true; } }
    const phrase = phrases[phraseIndex], a = amp * (1 - .35 * sad);
    world = gait(phi, a, run, sad, proud, liftR, liftL); const initial = project(world, walkClock, phrase);
    const lowerAnkle = initial[11].y >= initial[12].y ? 11 : 12, pelvis = { x: phrase.cx, y: phrase.floorY - phrase.h * world[7].y };
    for (const q of [...joints, ...stars]) { q.flash *= Math.exp(-dt / .22); q.strike *= Math.exp(-dt / .22); }
    for (const ch of pending) {
      lastLoud = rank(sortedV, ch.vel); lastCount = ch.notes.length;
      const hardest = ch.notes.slice().sort((a, b) => b.v - a.v).slice(0, 4);
      for (const note of ch.notes) {
        const pair = PAIRS[Math.floor(clamp(x.pitch01(note.m)) * 6.999)], i = pair[note.m % 2 ? 0 : 1], joint = joints[i]; joint.flash = 1;
        for (const star of stars) if (star.joint === i) star.flash = Math.max(star.flash, .35);
        if (hardest.includes(note) && i !== lowerAnkle) {
          const D = (6 + 24 * lastLoud) * (phrase.h / 540) / (1 + .35 * x.rate); push(joint, pelvis, initial[i], D);
        }
      }
    }
    pending = [];
    const beforeStars = starsAt(world, walkClock), starCount = x.p('presence') <= .1 ? 0 : Math.min(170, Math.round(20 + 150 * x.p('presence')));
    while (strikePtr < steps.length && steps[strikePtr].tStrike <= x.t) {
      const s = steps[strikePtr++], i = s.k % 2 ? 12 : 11; joints[i].flash = joints[i].strike = 1;
      const near = beforeStars.slice(0, starCount).map((p, j) => ({ p, j, d: Math.hypot(p.x - initial[i].x, p.y - initial[i].y) })).filter((v) => v.d < 140).sort((a, b) => a.d - b.d).slice(0, 16);
      for (const v of near) push(stars[v.j], initial[i], v.p, 18 * s.loud * (1 - v.d / 140));
    }
    if (moving) {
      const top = x.top(); liftTargetR = top ? Math.min(140, x.p('arms') * 150 * x.pitch01(top.m) ** 1.6 * (.4 + .6 * lastLoud) * (1 - .8 * run)) : 0;
      liftTargetL = lastCount >= 4 && lastLoud > .7 ? .8 * liftTargetR : 0;
      liftRV += (49 * (liftTargetR - liftR) - 2 * .55 * 7 * liftRV) * moveDt; liftR += liftRV * moveDt;
      liftLV += (49 * (liftTargetL - liftL) - 2 * .55 * 7 * liftLV) * moveDt; liftL += liftLV * moveDt;
      for (const q of [...joints, ...stars]) spring(q, moveDt);
    }
    world = gait(phi, a, run, sad, proud, liftR, liftL); dots = project(world, walkClock, phrase).map((q, i) => ({ ...q, x: q.x + joints[i].dx, y: q.y + joints[i].dy }));
    const lowerNow = dots[11].y >= dots[12].y ? 11 : 12;
    if (moving && !reanchor && lastActual) shift += dots[lowerNow].x - lastActual[lowerNow].x;
    starDots = starsAt(world, walkClock); lastActual = dots.map((q) => ({ x: q.x, y: q.y })); lastT = x.t;
    return { timeline, fade: figureFade(x.t, timeline), starCount, phrase };
  }
  function makeSprites() {
    return ['#F2ECDD', '#fff'].map((colour) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = colour; g.beginPath(); g.arc(32, 32, 32, 0, TAU); g.fill(); return cv; });
  }
  function draw(x, state) {
    if (!sprites) sprites = makeSprites(); const g = x.g, next = [], presence = x.p('presence'); g.save(); g.scale(x.W / W, x.H / H);
    g.globalAlpha = 1; g.fillStyle = `rgba(0,0,0,${.85 * presence})`; g.fillRect(0, 0, W, H);
    g.fillStyle = '#000'; g.beginPath(); for (const q of prev) { g.moveTo(q.x + q.r + 2, q.y); g.arc(q.x, q.y, q.r + 2, 0, TAU); } g.fill();
    const dot = (position, q, alpha, fade = 1) => {
      const r = q.r * (1 + Math.max(.9 * q.flash * lastLoud, q.strike)); if (alpha <= 0) return;
      g.globalAlpha = alpha; g.drawImage(sprites[0], position.x - r, position.y - r, 2 * r, 2 * r);
      if (q.flash > 0) { g.globalAlpha = q.flash * fade; g.drawImage(sprites[1], position.x - r, position.y - r, 2 * r, 2 * r); }
      next.push({ x: position.x, y: position.y, r });
    };
    for (let i = 0; i < state.starCount; i++) dot(starDots[i], stars[i], .55);
    const standingAge = state.timeline.previous ? Math.max(0, x.t - state.timeline.previous.tStrike) : Infinity, blend = moving ? 0 : clamp(standingAge / .8);
    dots.forEach((q, i) => { const far = q.z * state.phrase.facing < 0, alpha = lerp(far ? .78 : 1, .55, blend) * state.fade * FIGURE_ALPHA; dot(q, joints[i], alpha, state.fade * FIGURE_ALPHA); });
    prev = next; g.restore();
  }

  TOOLS.push({
    id: 'johansson', name: 'Johansson', tag: 'new',
    blurb: 'A field of still white dots, like stars. When the music moves, thirteen of them turn out to be a person, walking, stepping exactly on the notes.',
    params: [
      { key: 'presence', label: 'how present', min: 0, max: 1, value: .5,
        hint: 'Left: just the person on black. Right: a thick field of stars it is hidden in.', icon: ICON.of.count(30, ICON.gold) },
      { key: 'stride', label: 'how big its steps', min: .5, max: 1.4, value: 1,
        hint: 'Left: small careful steps. Right: long strides, a big bounce.', icon: ICON.of.speed(ICON.gold) },
      { key: 'height', label: 'how near', min: .6, max: 1.3, value: 1,
        hint: 'Left: a small person far off. Right: it nearly fills the screen.', icon: ICON.of.size('dot', ICON.gold) },
      { key: 'arms', label: 'how the melody lifts it', min: 0, max: 1.2, value: .8,
        hint: 'Left: arms only swing. Right: its arm reaches up with every climbing melody.', icon: (g, v, w, h) => ICON.arrow(g, w / 2, h - 3, w / 2, h - 5 - v * (h - 8), ICON.gold) },
      { key: 'maxStep', label: 'how soon it stops', min: .7, max: 1.6, value: 1.15,
        hint: 'Left: it stops at any gap in the notes. Right: it walks on through most of them.', icon: ICON.of.time(ICON.gold) },
    ],
    reset, onChord(ch, x) { ensure(x); pending.push(ch); },
    frame(x) {
      const state = advanceFrame(x); if (typeof document !== 'undefined') draw(x, state);
    },
  });
})();
