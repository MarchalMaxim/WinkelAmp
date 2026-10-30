// Skittish shapes v3: a panicked flock. Upper notes stumble into being as small graphic shapes (dots, ovals, rings,
// crescents, tears, commas, chevrons, needles) that freeze, tremble, then bolt with a speed curve t^exp, smearing into
// streaks and heating up (dark → hot → white) as they go. Musical threats scatter them: a bass hit rises from the
// bottom at the bass note's x, a loud chord bursts in the middle of the flock, a melody leap blows up the old spot.
(() => {
  const TYPES = ['dot', 'oval', 'ring', 'crescent', 'tear', 'comma', 'chevron', 'needle']; // round → sharp
  // Palettes: heat 0..1 ramps through four [hue, sat, light] stops.
  const PALETTES = [
    [[352, 70, 20], [8, 90, 42], [32, 100, 58], [52, 100, 90]],    // 0 ember
    [[228, 60, 22], [205, 85, 45], [188, 100, 66], [180, 80, 94]], // 1 ice
    [[25, 10, 24], [32, 14, 50], [38, 28, 76], [44, 60, 96]],      // 2 bone
    [[275, 60, 20], [312, 85, 44], [342, 100, 64], [40, 100, 88]], // 3 venom
  ];
  const HB = 8; // heat buckets
  const S = 96, HALF = 48, SW = 128, SH = 24;
  const tmp = document.createElement('canvas'); tmp.width = S; tmp.height = S; const tg = tmp.getContext('2d');
  const stmp = document.createElement('canvas'); stmp.width = SW; stmp.height = SH; const stg = stmp.getContext('2d');
  const cache = new Map();
  let budget = 0;

  function ramp(pal, h, a = 1) {
    const P = PALETTES[pal], f = Math.max(0, Math.min(0.999, h)) * 3, i = Math.floor(f), k = f - i, A = P[i], B = P[i + 1];
    let dh = B[0] - A[0]; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
    return `hsla(${(A[0] + dh * k).toFixed(0)},${(A[1] + (B[1] - A[1]) * k).toFixed(0)}%,${(A[2] + (B[2] - A[2]) * k).toFixed(0)}%,${a})`;
  }

  /** One blurred shape pointing +x, coloured for a heat bucket. */
  function buildShape(type, pal, hb) {
    const h = hb / (HB - 1);
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, S, S); tg.translate(HALF, HALF);
    const core = ramp(pal, h + 0.3), body = ramp(pal, h), edge = ramp(pal, h - 0.2, 0.15);
    const rg = (x0, r) => { const gr = tg.createRadialGradient(x0, 0, 0, 0, 0, r); gr.addColorStop(0, core); gr.addColorStop(0.5, body); gr.addColorStop(1, edge); return gr; };
    const lg = () => { const gr = tg.createLinearGradient(40, 0, -42, 0); gr.addColorStop(0, core); gr.addColorStop(0.4, body); gr.addColorStop(1, edge); return gr; };
    tg.beginPath();
    if (type === 'dot') { tg.fillStyle = rg(4, 22); tg.arc(0, 0, 20, 0, Math.PI * 2); tg.fill(); }
    else if (type === 'oval') { tg.fillStyle = rg(10, 36); tg.ellipse(0, 0, 36, 22, 0, 0, Math.PI * 2); tg.fill(); }
    else if (type === 'ring') { tg.strokeStyle = lg(); tg.lineWidth = 8; tg.ellipse(0, 0, 30, 22, 0, 0, Math.PI * 2); tg.stroke(); }
    else if (type === 'crescent') {
      tg.fillStyle = rg(18, 36); tg.arc(0, 0, 32, 0, Math.PI * 2); tg.fill();
      tg.globalCompositeOperation = 'destination-out'; tg.beginPath(); tg.arc(-16, 0, 30, 0, Math.PI * 2); tg.fill();
    } else if (type === 'tear') {
      tg.fillStyle = lg(); tg.arc(16, 0, 20, -Math.PI / 2, Math.PI / 2);
      tg.quadraticCurveTo(-8, 16, -42, 0); tg.quadraticCurveTo(-8, -16, 16, -20); tg.fill();
    } else if (type === 'comma') {
      for (let i = 14; i >= 0; i--) {
        const t = i / 14; tg.fillStyle = t < 0.15 ? core : ramp(pal, h - 0.25 * t, 1 - 0.6 * t);
        tg.beginPath(); tg.arc(18 - 56 * t, 24 * t * t, 14 * (1 - t) + 1.5, 0, Math.PI * 2); tg.fill();
      }
    } else if (type === 'chevron') {
      tg.fillStyle = lg(); tg.moveTo(38, 0); tg.lineTo(-22, -30); tg.lineTo(-6, 0); tg.lineTo(-22, 30); tg.closePath(); tg.fill();
    } else { // needle
      tg.fillStyle = lg(); tg.moveTo(46, 0); tg.lineTo(4, -6); tg.lineTo(-46, 0); tg.lineTo(4, 6); tg.closePath(); tg.fill();
    }
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const cg = c.getContext('2d'); cg.filter = 'blur(2.5px)'; cg.drawImage(tmp, 0, 0);
    return c;
  }
  /** A tapered streak, head at the right edge, fading to nothing at the left. */
  function buildStreak(pal, hb) {
    const h = hb / (HB - 1);
    stg.setTransform(1, 0, 0, 1, 0, 0); stg.clearRect(0, 0, SW, SH);
    const gr = stg.createLinearGradient(SW, 0, 0, 0);
    gr.addColorStop(0, ramp(pal, h, 0)); gr.addColorStop(0.08, ramp(pal, h + 0.1, 0.85)); gr.addColorStop(0.4, ramp(pal, h - 0.15, 0.45)); gr.addColorStop(1, ramp(pal, h - 0.4, 0));
    stg.fillStyle = gr; stg.beginPath(); stg.moveTo(SW - 2, SH / 2 - 7); stg.lineTo(2, SH / 2 - 0.5); stg.lineTo(2, SH / 2 + 0.5); stg.lineTo(SW - 2, SH / 2 + 7); stg.closePath(); stg.fill();
    const c = document.createElement('canvas'); c.width = SW; c.height = SH;
    const cg = c.getContext('2d'); cg.filter = 'blur(1.5px)'; cg.drawImage(stmp, 0, 0);
    return c;
  }
  /** Cached sprite; builds at most a few per frame, otherwise falls back to the nearest built heat. */
  function get(kind, pal, hb) {
    const key = kind + '|' + pal + '|' + hb;
    let c = cache.get(key); if (c) return c;
    if (budget > 0 || !cache.has(kind + '|' + pal + '|any')) {
      budget--;
      c = kind === 'streak' ? buildStreak(pal, hb) : buildShape(kind, pal, hb);
      cache.set(key, c); cache.set(kind + '|' + pal + '|any', c); return c;
    }
    for (let d = 1; d < HB; d++) for (const b of [hb - d, hb + d]) { c = cache.get(kind + '|' + pal + '|' + b); if (c) return c; }
    return cache.get(kind + '|' + pal + '|any');
  }

  let shapes = [], threats = [], chain = null, idle = 9, panic = 0, avgVel = 75, prevHi = -1, prevHiT = -9, time = 0;
  let cool = { bass: 0, loud: 0, leap: 0 }, last = { x: 640, y: 760 }, burst = null;
  const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const sgn = () => (Math.random() < 0.5 ? -1 : 1);

  function addThreat(x, kind, tx, ty, R, str, vy = 0) {
    threats.push({ x: tx, y: ty, R, str, vy, age: 0, life: kind === 'loud' ? 0.9 : 0.7, kind });
    last = { x: tx, y: ty };
    const resp = x.p('threat');
    for (const s of shapes) {
      const dx = s.x - tx, dy = s.y - ty, d = Math.hypot(dx, dy);
      if (d > R * (0.6 + 0.4 * Math.min(1, resp))) continue;
      const away = Math.atan2(dy, dx);
      if (resp < 0.05) continue;
      if (s.tb < 0) s.tb = 0; // still: go now
      else s.tb += s.T * 0.35 * Math.min(2, resp) * (1 - d / R); // already running: a kick up the curve
      s.h = away + x.rnd(-0.4, 0.4) / Math.max(0.5, resp);
      s.off = 0; s.flash = Math.max(s.flash, 0.6);
    }
  }

  TOOLS.push({
    id: 'flee', name: 'Skittish shapes', tag: 'v3',
    blurb: 'High notes stumble in as small hot shapes that freeze, tremble, then bolt on a t^exp speed curve, smearing into streaks and heating towards white as they go. Bass hits rise from below, loud chords burst inside the flock and melody leaps blow up the old spot, scattering them; fast passages make them dense and frantic, slow ones leave a few cold stragglers.',
    params: [
      { key: 'exp', label: 'speed exponent', min: 1, max: 5, step: 0.1, value: 3 },
      { key: 'hes', label: 'hesitation (s)', min: 0, max: 1.2, value: 0.55, drive: '-rate' },
      { key: 'twitch', label: 'twitchiness', min: 0, max: 1, value: 0.25, drive: '+rate' },
      { key: 'mix', label: 'shapes round→sharp', min: 0, max: 1, value: 0.45 },
      { key: 'streak', label: 'streak length', min: 0, max: 3, value: 0.8, drive: '+rate' },
      { key: 'reg', label: 'spawn from MIDI', min: 36, max: 84, step: 1, value: 57 },
      { key: 'threat', label: 'threat response', min: 0, max: 2, value: 0.8, drive: '+bass' },
      { key: 'flock', label: 'alone→schools', min: 0, max: 1, value: 0.5 },
      { key: 'pal', label: 'palette E·I·B·V', min: 0, max: 3, step: 1, value: 0 },
    ],
    reset() {
      shapes = []; threats = []; chain = null; idle = 9; panic = 0; avgVel = 75; prevHi = -1; prevHiT = -9;
      cool = { bass: 0, loud: 0, leap: 0 }; last = { x: 640, y: 760 }; burst = null;
    },
    onChord(ch, x) {
      const reg = x.p('reg'), resp = x.p('threat');
      const loudCut = avgVel + 12;
      avgVel += (ch.vel - avgVel) * 0.04;

      // Flock centre (or the spawn cluster) for the burst.
      let cx = 0, cy = 0; for (const s of shapes) { cx += s.x; cy += s.y; }
      if (shapes.length) { cx /= shapes.length; cy /= shapes.length; } else if (chain) { cx = chain.x; cy = chain.y; } else { cx = x.W / 2; cy = x.H / 2; }

      // Threats, each with its own place so you can read the cause.
      if (ch.vel >= loudCut && ch.notes.length >= 3 && time - cool.loud > 0.25) {
        cool.loud = time; const bx = cx + x.rnd(-30, 30), by = cy + x.rnd(-30, 30);
        addThreat(x, 'loud', bx, by, 300 + 200 * resp, 2);
        burst = { x: bx, y: by, n: Math.min(9, 2 + ch.notes.length) };
      } else if (ch.lo < 50 && ch.vel >= avgVel - 4 && time - cool.bass > 0.2) {
        cool.bass = time;
        const bx = x.W * (0.1 + 0.8 * Math.max(0, Math.min(1, (ch.lo - 24) / 26)));
        addThreat(x, 'bass', bx, x.H + 60, 340, 1.2, -520);
      }
      const hiNote = ch.hi >= reg ? ch.hi : -1;
      if (hiNote > 0 && prevHi > 0 && Math.abs(hiNote - prevHi) >= 7 && time - prevHiT < 1.5 && time - cool.leap > 0.3 && chain) {
        cool.leap = time; addThreat(x, 'leap', chain.x, chain.y, 240, 1.2);
        // The melody jumps: the next cluster starts far away, up or down with the leap.
        const p = Math.max(0, Math.min(1, (hiNote - reg) / 30));
        let nx = x.rnd(x.W * 0.15, x.W * 0.85); if (Math.abs(nx - chain.x) < 300) nx = chain.x < x.W / 2 ? chain.x + 380 : chain.x - 380;
        chain = { x: nx, y: x.H * (0.82 - 0.64 * p), dir: x.rnd(0, Math.PI * 2), size: 20 };
      }
      if (hiNote > 0) { prevHi = hiNote; prevHiT = time; }

      // Every attack: the frozen ones flinch (a hop and a glance), so the onset is visible even when nothing new spawns.
      const tw = x.p('twitch');
      for (const s of shapes) if (s.tb < 0 || Math.random() < 0.3) {
        const j = (2 + 10 * tw) * (s.tb < 0 ? 1 : 0.4);
        s.x += x.rnd(-j, j); s.y += x.rnd(-j, j); s.off = x.rnd(0.3, 0.6 + 1.2 * tw) * sgn(); s.flash = Math.max(s.flash, 0.25);
      }

      // A loud chord throws out a ring of shapes already running.
      if (burst) {
        const mix0 = x.p('mix');
        for (let i = 0; i < burst.n && shapes.length < 120; i++) {
          const a0 = (i / burst.n) * Math.PI * 2 + x.rnd(-0.3, 0.3), size = x.rnd(18, 34);
          const ti = Math.max(0, Math.min(7, Math.round(mix0 * 7 + x.rnd(-1.5, 1.5))));
          shapes.push({ x: burst.x + Math.cos(a0) * 14, y: burst.y + Math.sin(a0) * 14, size, type: TYPES[ti], aspect: x.rnd(0.9, 1.3), flip: sgn(),
            al: 0.85, age: 0, hes: 0, tb: 0.05, T: x.rnd(0.5, 0.8), D: x.rnd(400, 700), h: a0, off: 0, speed: 0, flash: 1, heat: 0 });
        }
        burst = null;
      }
      // Spawn.
      const pSpawn = 0.4 + 0.6 * panic;
      const highs = ch.notes.filter((n) => n.m >= reg).sort((a, b) => a.m - b.m).slice(panic > 0.5 ? -6 : -4);
      const mix = x.p('mix');
      for (const n of highs) {
        if (shapes.length >= 110 || Math.random() > pSpawn) continue;
        const p = Math.max(0, Math.min(1, (n.m - reg) / 30));
        const size = (16 + 26 * n.v / 110) * (1.25 - 0.5 * p) * x.rnd(0.7, 1.4);
        const pitchY = x.H * (0.82 - 0.64 * p);
        if (!chain || idle > 0.8 || chain.x < 80 || chain.x > x.W - 80 || chain.y < 60 || chain.y > x.H - 60) {
          chain = { x: x.rnd(x.W * 0.15, x.W * 0.85), y: pitchY, dir: x.rnd(0, Math.PI * 2), size };
        } else {
          chain.dir += x.rnd(-1, 1);
          const step = (chain.size + size) * x.rnd(0.45, 0.8);
          chain.x += Math.cos(chain.dir) * step; chain.y += Math.sin(chain.dir) * step * 0.7 + (pitchY - chain.y) * 0.3;
          chain.size = size;
        }
        idle = 0;
        // Shape: a spread around the mix centre, round → sharp.
        const ti = Math.max(0, Math.min(7, Math.round(mix * 7 + (Math.random() + Math.random() + Math.random() - 1.5) * 2.4)));
        const type = TYPES[ti];
        const aspect = type === 'needle' ? x.rnd(1, 1.6) : type === 'oval' ? x.rnd(0.9, 1.7) : x.rnd(0.85, 1.25);
        const away = Math.atan2(chain.y - last.y, chain.x - last.x) + x.rnd(-0.9, 0.9);
        shapes.push({
          x: chain.x + x.rnd(-5, 5), y: chain.y + x.rnd(-5, 5), size, type, aspect, flip: sgn(),
          al: (0.55 + 0.45 * panic) * (0.6 + 0.4 * n.v / 110),
          age: 0, hes: x.p('hes') * x.rnd(0.5, 1.5), tb: -1,
          T: x.rnd(0.8, 1.2) * (1.15 - 0.45 * panic), D: x.rnd(0.8, 1.2) * (260 + 420 * panic),
          h: away, off: 0, speed: 0, flash: 1, heat: 0,
        });
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt;
      time += dt; idle += dt; budget = 4;
      panic += (smooth(0.12, 0.6, x.feat.rate) - panic) * (1 - Math.pow(0.5, dt / 0.4));
      const e = x.p('exp'), tw = x.p('twitch'), streak = x.p('streak'), resp = x.p('threat'), flock = x.p('flock');
      const pal = Math.round(x.p('pal'));

      // Threats: move (bass ones rise), age, push.
      for (const t of threats) { t.age += dt; t.y += t.vy * dt; t.vy *= Math.pow(0.5, dt / 0.5); }
      threats = threats.filter((t) => t.age < t.life);

      const n = shapes.length;
      for (let i = 0; i < n; i++) {
        const s = shapes[i];
        s.age += dt; s.flash *= Math.pow(0.5, dt / 0.08);
        if (s.tb < 0 && s.age > 0.06 + s.hes) s.tb = 0;
        if (s.tb >= 0) s.tb += dt;
        // Desired direction: away from threats, plus the panicked school.
        let fx = 0, fy = 0;
        for (const t of threats) {
          const dx = s.x - t.x, dy = s.y - t.y, d = Math.hypot(dx, dy) + 1, w = t.str * resp * Math.exp(-(d * d) / (t.R * t.R)) * (1 - t.age / t.life);
          fx += dx / d * w * 3; fy += dy / d * w * 3;
        }
        if (s.tb > 0 && flock > 0) {
          let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, k = 0;
          for (let j = 0; j < n; j++) {
            if (j === i) continue; const o = shapes[j];
            const dx = o.x - s.x, dy = o.y - s.y, d2 = dx * dx + dy * dy;
            if (d2 > 160 * 160) continue;
            k++; ax += Math.cos(o.h); ay += Math.sin(o.h); cx += dx; cy += dy;
            if (d2 < 40 * 40) { sx -= dx / (d2 + 30); sy -= dy / (d2 + 30); }
          }
          if (k) { fx += (ax / k * 1.2 + cx / k * 0.006) * flock + sx * 30; fy += (ay / k * 1.2 + cy / k * 0.006) * flock + sy * 30; }
        }
        if (fx || fy) {
          const want = Math.atan2(fy, fx), mag = Math.min(1, Math.hypot(fx, fy));
          s.h += wrap(want - s.h) * Math.min(1, dt * (2 + 8 * tw) * mag);
        }
        // Twitch: sudden jerks of heading that snap back.
        s.off *= Math.pow(0.5, dt / (0.06 + 0.1 * (1 - tw)));
        if (s.tb > 0 && Math.random() < dt * (0.5 + 9 * tw)) s.off = x.rnd(0.3, 0.4 + 1.1 * tw) * sgn();
        // Speed: pos = D (t/T)^e, so speed = e D t^(e-1) / T^e.
        let v = 0;
        if (s.tb > 0) v = Math.min(3200, e * s.D * Math.pow(s.tb, e - 1) / Math.pow(s.T, e));
        else { const j = (0.6 + 3 * tw) * Math.min(1.5, dt * 60); s.x += x.rnd(-j, j); s.y += x.rnd(-j, j); }
        s.speed = v;
        const head = s.h + s.off; s.head = head;
        s.x += Math.cos(head) * v * dt; s.y += Math.sin(head) * v * dt;
        const target = Math.pow(Math.min(1, v / 2400), 0.85);
        s.heat += (Math.max(target, 0.06) - s.heat) * Math.min(1, dt * 14);
      }
      shapes = shapes.filter((s) => s.age < 7 && s.x > -260 && s.x < x.W + 260 && s.y > -260 && s.y < x.H + 260);

      // Threat marks: a dark void that pushes the trails away, and a thin ring for the loud ones.
      for (const t of threats) {
        const k = t.age / t.life, r = t.R * (0.25 + 0.75 * (1 - Math.pow(1 - Math.min(1, k * 2.2), 3))), a = (1 - k) * Math.min(1, resp + 0.2);
        const gr = g.createRadialGradient(t.x, t.y, 0, t.x, t.y, r * 0.8);
        gr.addColorStop(0, `rgba(0,0,0,${0.55 * a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = gr;
        g.beginPath(); g.arc(t.x, t.y, r * 0.8, 0, Math.PI * 2); g.fill();
        if (t.kind === 'loud' && t.age < 0.12) { // one crisp hairline on the attack, gone before it can ripple
          g.strokeStyle = ramp(pal, 0.8, 0.7 * (1 - t.age / 0.12)); g.lineWidth = 1.5;
          g.beginPath(); g.arc(t.x, t.y, 30 + t.age * 1400, 0, Math.PI * 2); g.stroke();
        }
      }

      // Shapes: streak behind, stretched body, a little additive glow when hot.
      for (const s of shapes) {
        const fin = Math.min(1, s.age / 0.05), fout = Math.min(1, (7 - s.age) / 1);
        const heat = Math.min(1, Math.max(s.heat, s.flash)), hb = Math.round(heat * (HB - 1));
        const a = s.al * fin * fout * (0.45 + 0.55 * heat);
        if (a <= 0.01) continue;
        const c = Math.cos(s.head), sn = Math.sin(s.head);
        const L = streak * s.speed * 0.09;
        if (L > s.size * 0.4) {
          const w = s.size / 22 * (0.6 + 0.4 * heat);
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, a * 0.75);
          g.setTransform(c * L / SW, sn * L / SW, -sn * w, c * w, s.x + c * s.size * 0.3, s.y + sn * s.size * 0.3);
          g.drawImage(get('streak', pal, hb), -SW, -SH / 2);
        }
        const stretch = 1 + Math.min(1.8, streak * s.speed / 2200);
        const grow = 0.75 + 0.25 * fin + 0.35 * s.flash;
        const sx = s.size / 32 * s.aspect * stretch * grow, sy = s.size / 32 * grow * s.flip / Math.sqrt(stretch);
        g.setTransform(c * sx, sn * sx, -sn * sy, c * sy, s.x, s.y);
        const spr = get(s.type, pal, hb);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = a;
        g.drawImage(spr, -HALF, -HALF);
        if (heat > 0.35) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.35 * heat; g.drawImage(spr, -HALF, -HALF); }
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
    },
  });
})();
