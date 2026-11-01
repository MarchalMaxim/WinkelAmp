// Murmuration v3: a flock that carries the mood, and draws each loud chord's own shape.
// Between the big chords it is v2: dread huddles it into a dark knot that throbs on the low tolls, song makes it a ribbon
// tracing the melody, agitation breaks it into jittery shards. A loud chord re-forms it, on the attack, into that chord's
// figure: its notes are placed on a clock face (C at 12 o'clock, C♯ at 1, … B at 11) and the flock draws the shape they
// make. Major chords are plain straight-edged shapes, minor chords curl inward into stars, other chords swell round; two
// notes make a lens, one note a clock hand with a ring. A spoke from the centre always points at the bass note. So the
// same chord always gives the same figure, a new key turns it, and a repeated progression repeats its figures.
(() => {
  const N = 900, HM = 16, MS = 96, SPAN = 7;
  const px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  const heat = new Float32Array(N), bin = new Uint8Array(N), wrap = new Int32Array(N);
  const U0 = new Float32Array(N), S0 = new Float32Array(N), R0 = new Float32Array(N), A0 = new Float32Array(N), D0 = new Float32Array(N);
  const FX = new Float32Array(N), FY = new Float32Array(N), FNX = new Float32Array(N), FNY = new Float32Array(N); // each bird's spot on the figure
  const hx = new Float32Array(N * HM), hy = new Float32Array(N * HM);
  const mel = new Float32Array(MS), mvel = new Float32Array(MS), tmp = new Float32Array(MS);
  const K = 5, gcx = new Float32Array(K), gcy = new Float32Array(K), ggx = new Float32Array(K), ggy = new Float32Array(K), gth = new Float32Array(K);
  let hp = 0, time = 0, A = 0, bassS = 0, low = 0, agit = 0, dread = 0, pulse = 0, notes = [], nChord = 0, phase = 0, lastT = -99;
  let formHold = 0, sinceStrike = 9, lastStrike = -9, calm = 1, sig = '', fpulse = 0, fcx = 640, fcy = 360, fsc = 200, pcsMask = 0, bassPc = 0;
  let headX = 1100, headY = 360, ccx = 640, ccy = 360;
  const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clockX = (pc) => Math.sin((pc * Math.PI) / 6), clockY = (pc) => -Math.cos((pc * Math.PI) / 6);

  // The chord's notes on the clock: pitch classes weighted by how hard they were struck (stray overtones drop out), bass always in.
  function readChord(ch) {
    const w = new Array(12).fill(0); for (const q of ch.notes) w[q.m % 12] += q.v;
    const mx = Math.max(...w); let pcs = []; for (let i = 0; i < 12; i++) if (w[i] >= 0.3 * mx) pcs.push(i);
    pcs.sort((a, b) => w[b] - w[a]); pcs = pcs.slice(0, 5);
    const bass = ch.lo % 12; if (!pcs.includes(bass)) pcs.push(bass);
    pcs.sort((a, b) => a - b);
    const has = (r, iv) => pcs.includes((r + iv) % 12);
    let q = 'other';
    if (pcs.length === 1) q = 'one'; else if (pcs.length === 2) q = 'two';
    else for (const r of [bass, ...pcs.filter((p) => p !== bass)]) { if (has(r, 4) && has(r, 7)) { q = 'major'; break; } if (has(r, 3) && has(r, 7)) { q = 'minor'; break; } }
    return { pcs, bass, q, sig: `${pcs.join('.')}/${bass}` };
  }
  // Lay every bird on the figure (unit coordinates, radius 1): a share on the spoke to the bass, the rest along the edges,
  // which run clockwise from the bass so one figure glides into the next without birds crossing over.
  function buildFigure(c) {
    const segs = []; // [ax, ay, cx, cy, bx, by, len]
    const add = (ax, ay, bx, by, bow) => {
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1e-6; let nx = dy / l, ny = -dx / l;
      const mx = (ax + bx) / 2, my = (ay + by) / 2; if (c.q !== 'two' && mx * nx + my * ny < -1e-3) { nx = -nx; ny = -ny; } // a lens bows both ways
      segs.push([ax, ay, mx + nx * bow * l, my + ny * bow * l, bx, by, l * (1 + Math.abs(bow))]);
    };
    const order = [...c.pcs.filter((p) => p >= c.bass), ...c.pcs.filter((p) => p < c.bass)];
    const bx = clockX(c.bass), by = clockY(c.bass);
    let spokeShare = 0.13;
    if (c.q === 'one') {
      // A clock hand pointing at the note, with a ring round its tip.
      spokeShare = 0.45; const r = 0.3, cx = bx * 0.78, cy = by * 0.78;
      for (let k = 0; k < 16; k++) { const a0 = Math.atan2(-by, -bx) + (k / 16) * Math.PI * 2, a1 = a0 + Math.PI * 2 / 16; add(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, 0); }
    } else {
      const bow = c.q === 'major' ? 0 : c.q === 'minor' ? -0.26 : c.q === 'two' ? 0.4 : 0.2;
      const n = order.length;
      for (let k = 0; k < (n === 2 ? 2 : n); k++) { const a = order[k], b = order[(k + 1) % n]; add(clockX(a), clockY(a), clockX(b), clockY(b), bow); }
    }
    let tot = 0; for (const s of segs) tot += s[6];
    const tip = c.q === 'one' ? 0.78 - 0.3 : 1;
    for (let i = 0; i < N; i++) {
      const u = U0[i];
      if (u < spokeShare) { const f = u / spokeShare; FX[i] = bx * (-0.12 + f * (tip + 0.12)); FY[i] = by * (-0.12 + f * (tip + 0.12)); FNX[i] = -by; FNY[i] = bx; continue; }
      let d = ((u - spokeShare) / (1 - spokeShare)) * tot, k = 0;
      while (k < segs.length - 1 && d > segs[k][6]) { d -= segs[k][6]; k++; }
      const s = segs[k]; let f = Math.min(1, d / s[6]);
      f -= (0.55 / (Math.PI * 2)) * Math.sin(f * Math.PI * 2); // birds gather at the corners
      const e = 1 - f;
      FX[i] = e * e * s[0] + 2 * f * e * s[2] + f * f * s[4]; FY[i] = e * e * s[1] + 2 * f * e * s[3] + f * f * s[5];
      const tx = 2 * e * (s[2] - s[0]) + 2 * f * (s[4] - s[2]), ty = 2 * e * (s[3] - s[1]) + 2 * f * (s[5] - s[3]), tl = Math.hypot(tx, ty) || 1;
      FNX[i] = -ty / tl; FNY[i] = tx / tl;
    }
    pcsMask = 0; for (const p of c.pcs) pcsMask |= 1 << p; bassPc = c.bass;
  }
  // A shard snaps to a new spot near the (slowly wandering) heart of the broken flock.
  function kickShard(x, gi) {
    const ax = x.W * 0.5 + Math.sin(time * 0.23) * x.W * 0.16, ay = x.H * 0.5 + Math.sin(time * 0.31 + 1) * x.H * 0.1;
    ggx[gi] = Math.max(60, Math.min(x.W - 60, ax + x.rnd(-1, 1) * 300)); ggy[gi] = Math.max(60, Math.min(x.H - 60, ay + x.rnd(-1, 1) * 170)); gth[gi] += x.rnd(-1.6, 1.6);
  }
  // Knob pictures.
  const BONE = '#a8b4c8', TRI = [0, 4, 7]; // C major on the clock, for the icons
  const triIcon = (g, w, h, spread, col) => {
    const R = ICON.rng(11), cx = w / 2, cy = h / 2 + 1, r = h / 2 - 2;
    for (let k = 0; k < 3; k++) {
      const a = TRI[k], b = TRI[(k + 1) % 3];
      for (let j = 0; j < 9; j++) { const f = j / 9, x = cx + r * (clockX(a) + (clockX(b) - clockX(a)) * f), y = cy + r * (clockY(a) + (clockY(b) - clockY(a)) * f);
        ICON.dot(g, x + (R() - 0.5) * spread, y + (R() - 0.5) * spread, 0.95, col); }
    }
  };

  TOOLS.push({
    id: 'murmuration', name: 'Murmuration', tag: 'v3',
    blurb: 'A flock that carries the mood: a dark knot that throbs on low tolls, a ribbon tracing the melody, jittery shards when agitated. Now a loud chord re-forms it, on the attack, into <b>that chord’s own figure</b>: its notes sit on a clock face (C at the top, then clockwise C♯, D … B) and the flock draws the shape they make, a spoke pointing at the bass. Major chords are straight-edged, minor ones curl into stars, two notes make a lens, one note a clock hand. Same chord, same figure.',
    params: [
      { key: 'strike', label: 'which chords re-form it', min: 0, max: 1, value: 0.6,
        hint: 'How loud a chord must be to pull the flock into its figure. Left: only the biggest, loudest chords. Right: any firm chord.',
        icon: (g, v, w, h) => {
          const hs = [0.35, 0.9, 0.55, 0.75, 0.45, 1], thr = 0.95 - v * 0.62, bw = (w - 6) / hs.length;
          hs.forEach((q, i) => ICON.rect(g, 3 + i * bw + 1, h - 2 - q * (h - 5), bw - 2, q * (h - 5), q >= thr ? ICON.red : ICON.dim));
          ICON.line(g, 2, h - 2 - thr * (h - 5), w - 2, h - 2 - thr * (h - 5), ICON.ink, 1);
        } },
      { key: 'hold', label: 'how long a figure stays', min: 0.8, max: 6, value: 2.6,
        hint: 'How long the flock keeps a chord’s figure before it melts back into the melody. Left: a glimpse. Right: holds for seconds.',
        icon: (g, v, w, h) => { for (let k = 0; k < 3; k++) { const a = Math.max(0, 1 - k / (0.4 + v * 2.6)); if (a > 0) ICON.alpha(g, a, () => { const cx = 9 + k * 11, r = 8;
          g.strokeStyle = BONE; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, h / 2 - r); g.lineTo(cx + r * 0.87, h / 2 + r * 0.6); g.lineTo(cx - r * 0.87, h / 2 + r * 0.6); g.closePath(); g.stroke(); }); } } },
      { key: 'tight', label: 'how crisp the figures are', min: 0, max: 1, value: 0.6,
        hint: 'How tightly the birds keep formation. Left: a loose, smoky cloud. Right: crisp, thin lines.',
        icon: (g, v, w, h) => triIcon(g, w, h, 1 + (1 - v) * 9, BONE) },
      { key: 'trail', label: 'trail length', min: 1, max: 16, step: 1, value: 9, drive: '-rate',
        hint: 'How long each bird’s streak is. Left: short dashes. Right: long streaks.',
        icon: (g, v, w, h) => ICON.trail(g, 0.1 + v * 0.9, w, h, BONE) },
      { key: 'bleed', label: 'red on loud notes', min: 0, max: 1, value: 0.6, drive: '+level',
        hint: 'How much loud notes stain the flock red. Left: it stays pale. Right: blood red, white-hot on the biggest chords.',
        icon: (g, v, w, h) => { for (let k = 0; k < 5; k++) ICON.line(g, 4 + k * 7, h - 5, 9 + k * 7, 5, ICON.lerp('#a8b4c8', '#d01e22', v * (0.3 + 0.7 * k / 4)), 2.2); } },
    ],
    reset(x) {
      time = x.t; A = 0; bassS = 0; low = 0; phase = 0; agit = 0; dread = 1; lastT = -99; pulse = 0; notes = []; nChord = 0;
      formHold = 0; sinceStrike = 9; lastStrike = -9; calm = 1; sig = ''; fpulse = 0; hp = 0;
      for (let i = 0; i < N; i++) {
        U0[i] = (i + Math.random() * 0.6) / N; S0[i] = (Math.random() * 2 - 1) * Math.sqrt(Math.random()); R0[i] = Math.random(); A0[i] = Math.random(); D0[i] = Math.random();
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 90;
        px[i] = 640 + Math.cos(a) * r * 1.4; py[i] = 440 + Math.sin(a) * r * 0.7; vx[i] = 0; vy[i] = 0; heat[i] = 0; wrap[i] = 0;
        for (let h = 0; h < HM; h++) { hx[i * HM + h] = px[i]; hy[i * HM + h] = py[i]; }
      }
      for (let k = 0; k < K; k++) { kickShard(x, k); gcx[k] = ggx[k]; gcy[k] = ggy[k]; gth[k] = x.rnd(0, 6.3); }
    },
    onChord(ch, x) {
      nChord++; lastT = x.t;
      A += 0.58;
      notes.push({ t: x.t, m: ch.hi, v: ch.vel });
      if (notes.length > 400) notes.splice(0, 200);
      if (ch.hi < 62 && ch.vel > 70) low = 1;
      const w = Math.max(0, Math.min(1, (ch.vel - 45) / 60)), n = ch.notes.length;
      const panic = Math.min(2, 1 + x.feat.rate), bleed = x.p('bleed');
      let mean = 0; for (const q of ch.notes) mean += q.m; mean /= n;
      // A loud chord that reaches above middle C: the flock re-forms into that chord's figure, on the attack.
      const score = ch.vel + 3 * (n - 3);
      if (score >= 112 - 30 * x.p('strike') && n >= 2 && ch.hi >= 60 && x.t - lastStrike > 0.2) {
        const c = readChord(ch), same = c.sig === sig && formHold > 0.05;
        calm = ss(0.7, 2.2, x.t - lastStrike); // after a quiet spell it explodes first; in a fast run it glides figure to figure
        lastStrike = x.t; sinceStrike = 0; formHold = 1; sig = c.sig;
        // Loudness sets the size, register the height. Nothing random: the same chord lands the same way.
        const reg = Math.max(0, Math.min(1, (mean - 48) / 36));
        fsc = Math.min(x.H * 0.36, 125 + 100 * w + Math.min(8, n) * 4);
        fcx = x.W * 0.5; fcy = Math.max(fsc + 24, Math.min(x.H - fsc - 24, x.H * (0.58 - 0.16 * reg)));
        if (same) { fpulse = 1; calm = 0; } else buildFigure(c);
        const pow = (same ? 2.5 : 1.5 + calm * (4 + w * 9)) * (0.6 + 0.4 * panic);
        const ox = same ? fcx : ccx, oy = same ? fcy : ccy;
        for (let i = 0; i < N; i++) {
          let dx = px[i] - ox, dy = py[i] - oy; const d = Math.hypot(dx, dy) + 1; dx /= d; dy /= d;
          const f = pow * (0.5 + R0[i] * 0.9), tw = (A0[i] - 0.5) * 0.9;
          vx[i] = vx[i] * (1 - calm) + (dx - dy * tw) * f; vy[i] = vy[i] * (1 - calm) + (dy + dx * tw) * f;
          heat[i] = Math.min(1.4, heat[i] + bleed * (0.4 + w * 0.9) * (0.5 + R0[i] * 0.7) * (same ? 0.5 : 1));
        }
        return;
      }
      // Otherwise a startle where the note lands: on a figure, at the note's own hour on its clock; in song, at the head of
      // the melody ribbon; else at a bird picked by pitch.
      const j = Math.max(0, Math.min(N - 1, ((mean - 28) / 70 * N) | 0));
      const wf = Math.min(1, formHold * 1.7), sing = Math.max(0, 1 - agit - dread) * (1 - wf);
      let lx = px[j] + (headX - px[j]) * sing, ly = py[j] + (headY - py[j]) * sing;
      lx += (fcx + clockX(ch.hi % 12) * fsc - lx) * wf; ly += (fcy + clockY(ch.hi % 12) * fsc - ly) * wf;
      const R = (70 + w * 200) * (0.6 + 0.4 * panic) * (1 - 0.35 * wf), P = (0.3 + w * w * 5) * panic * (1 - 0.65 * dread) * (1 - 0.4 * agit) * (1 - 0.4 * wf);
      for (let i = 0; i < N; i++) {
        const dx = px[i] - lx, dy = py[i] - ly, d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const d = Math.sqrt(d2) + 1, f = 1 - d / R;
        vx[i] += (dx / d) * P * f; vy[i] += (dy / d) * P * f;
        heat[i] = Math.min(1.6, heat[i] + bleed * w * f * 1.3);
      }
      // Dread: the knot throbs and darkens to blood.
      if (ch.hi < 60 || dread > 0.4) { pulse = Math.max(pulse, w); for (let i = 0; i < N; i++) heat[i] = Math.min(1.6, heat[i] + bleed * w * 0.5 * dread); }
      // Agitation: a shard jumps somewhere else.
      kickShard(x, nChord % K);
    },
    frame(x) {
      const g = x.g, dt = x.dt, k = dt * 60, W = x.W, H = x.H;
      time += dt; sinceStrike += dt;
      const coh = x.p('tight'), panic = Math.min(2, 1 + x.feat.rate);
      // Mood from the music: attack rate → agitation; held bass with few attacks → dread.
      A *= Math.pow(0.5, dt / 1.2);
      bassS += (x.feat.bass - bassS) * (1 - Math.pow(0.5, dt / 1.5));
      const sm = 1 - Math.pow(0.5, dt / 0.6);
      low *= Math.pow(0.5, dt / 3);
      // A held breath (no attack for a couple of seconds) also sinks it back into the knot.
      const agT = ss(2.6, 6.5, A), drT = Math.max(ss(0.4, 0.8, bassS), low, ss(1.5, 3, x.t - lastT)) * (1 - agT) * (1 - ss(2, 3.5, A));
      agit += (agT - agit) * sm; dread += (drT - dread) * sm;
      pulse *= Math.pow(0.5, dt / 0.35);
      fpulse *= Math.pow(0.5, dt / 0.12);
      formHold = Math.max(0, formHold - dt / x.p('hold'));
      const wf = Math.min(1, formHold * 1.7), rest = 1 - wf;
      // Sharpen the moods so the flock commits to one character instead of hovering in a grey average.
      let ra = agit * agit, rd = ((1 - agit) * dread) ** 2, rs = ((1 - agit) * (1 - dread)) ** 2; const rn = ra + rd + rs + 1e-6;
      const wa = rest * ra / rn, wd = rest * rd / rn, ws = rest * rs / rn;

      // The melody over the last SPAN seconds, sampled right (now) to left (past) and smoothed.
      let lo = 128, hi = 0, ni = notes.length - 1;
      for (let s = 0; s < MS; s++) {
        const tt = x.t - (s / (MS - 1)) * SPAN;
        while (ni > 0 && notes[ni].t > tt) ni--;
        const nt = notes.length ? notes[Math.max(0, ni)] : null, m = nt ? nt.m : 64;
        mel[s] = m; if (m < lo) lo = m; if (m > hi) hi = m;
        // How loud the melody was then, fading as that note is held: the ribbon swells where it sang out.
        mvel[s] = nt ? (nt.v / 127) * Math.pow(0.5, Math.max(0, tt - nt.t) / 0.8) : 0;
      }
      for (let pass = 0; pass < 3; pass++) {
        for (let s = 0; s < MS; s++) tmp[s] = (mel[Math.max(0, s - 1)] + mel[s] + mel[Math.min(MS - 1, s + 1)]) / 3; mel.set(tmp);
        for (let s = 0; s < MS; s++) tmp[s] = (mvel[Math.max(0, s - 1)] + mvel[s] + mvel[Math.min(MS - 1, s + 1)]) / 3; mvel.set(tmp);
      }
      const mid = (lo + hi) / 2, rng = Math.max(10, hi - lo);
      const rx0 = W * 0.1, rx1 = W * 0.9, base = H * 0.5 + Math.sin(time * 0.21) * 40, amp = H * 0.3;
      const thick = 5 + 28 * (1 - coh), swell = 20 + 70 * (1 - coh);
      headX = rx1; headY = base - ((mel[0] - mid) / rng) * 2 * amp + Math.sin(-time * 0.9) * 22;

      // Dread knot and agitation shards.
      const dcx = W * 0.5 + Math.sin(time * 0.11) * 110, dcy = H * 0.62, Rd = 70 * (1 + 1.1 * pulse);
      const gk = 1 - Math.pow(0.7, k);
      for (let q = 0; q < K; q++) { gcx[q] += (ggx[q] - gcx[q]) * gk; gcy[q] += (ggy[q] - gcy[q]) * gk; }
      const L = 115;
      // The figure: each bird to its spot, the outline as thick as the knob allows; a repeated chord makes it swell.
      const fs = fsc * (1 + 0.13 * fpulse), fth = (1.5 + 13 * (1 - coh)) * (1 + 0.6 * fpulse);

      // In a figure the birds are pulled in harder (and damped) so a new chord's shape is legible within a third of a second.
      const ks = (0.004 + 0.03 * coh) * (1 + 0.6 * wd) * (1 + 2 * wa) * rest + wf * (0.05 + 0.07 * coh);
      const dN = Math.pow(0.86 - 0.16 * wd - 0.1 * wa - 0.1 * wf, k), dB = Math.pow(0.9, k);
      const turb = (0.03 + 0.1 * panic * (0.4 + wa)) * (1 - 0.6 * wf) * k, jit = wa * panic * 1.4 * k;
      phase += ws * dt / SPAN;
      let sx = 0, sy = 0; const hd = Math.pow(0.5, dt / 0.55);
      hp = (hp + 1) % HM;
      for (let i = 0; i < N; i++) {
        let tx = 0, ty = 0, born = false;
        const uf = U0[i] + phase, u = uf % 1, s = S0[i];
        if (wd > 0.002) {
          const a = A0[i] * 6.283 + time * (0.1 + 0.3 * (1 - R0[i])), r = Math.sqrt(R0[i]) * Rd;
          tx += wd * (dcx + Math.cos(a) * r * 1.25); ty += wd * (dcy + Math.sin(a) * r * 0.8);
        }
        if (ws > 0.002) {
          const f = u * (MS - 1), i0 = f | 0, i1 = Math.min(MS - 1, i0 + 1), fr = f - i0, m = mel[i0] + (mel[i1] - mel[i0]) * fr, mv = mvel[i0] + (mvel[i1] - mvel[i0]) * fr;
          const X = rx1 - u * (rx1 - rx0);
          const Y = base - ((m - mid) / rng) * 2 * amp + Math.sin(u * 7 - time * 0.9) * 22
            + s * (thick + swell * mv * mv) * (0.3 + 0.7 * (1 - u)) * (0.12 + 0.88 * Math.abs(Math.cos(u * 6.5 - time * 1.1)));
          tx += ws * X; ty += ws * Y;
          // A bird that drifts off the past end is reborn at the present note (no line across the screen).
          if ((uf | 0) !== wrap[i]) { wrap[i] = uf | 0; born = ws > 0.4; }
        }
        if (wa > 0.002) {
          const q = i % K, ul = ((i / K) | 0) / (N / K), c = Math.cos(gth[q]), sn = Math.sin(gth[q]);
          const a = (ul * 2 - 1) * L, b = s * 5;
          tx += wa * (gcx[q] + a * c - b * sn); ty += wa * (gcy[q] + a * sn + b * c);
        }
        if (wf > 0.002) {
          tx += wf * (fcx + FX[i] * fs + FNX[i] * s * fth); ty += wf * (fcy + FY[i] * fs + FNY[i] * s * fth);
        }
        if (born) { px[i] = tx; py[i] = ty; vx[i] = -1; vy[i] = 0; for (let h = 0; h < HM; h++) { hx[i * HM + h] = tx; hy[i * HM + h] = ty; } }
        // After an explosion each bird flies free for a moment before the figure pulls it in (staggered); in a fast run of
        // chords there is no free flight, the figure simply glides into the next.
        const ramp = Math.max(0, Math.min(1, (sinceStrike - (0.06 + D0[i] * 0.3) * calm) / (0.04 + 0.3 * calm)));
        const damp = dB + (dN - dB) * ramp, kk = ks * ramp * ramp * k;
        let ax = (tx - px[i]) * kk, ay = (ty - py[i]) * kk;
        ax += Math.sin(py[i] * 0.011 + time * 0.9 + (i & 7)) * turb; ay += Math.cos(px[i] * 0.009 - time * 0.8) * turb;
        if (jit > 0.01) { ax += (Math.random() * 2 - 1) * jit; ay += (Math.random() * 2 - 1) * jit; }
        const m = 40;
        if (px[i] < m) ax += (m - px[i]) * 0.02 * k; else if (px[i] > W - m) ax -= (px[i] - W + m) * 0.02 * k;
        if (py[i] < m) ay += (m - py[i]) * 0.02 * k; else if (py[i] > H - m) ay -= (py[i] - H + m) * 0.02 * k;
        vx[i] = vx[i] * damp + ax; vy[i] = vy[i] * damp + ay;
        px[i] += vx[i] * k; py[i] += vy[i] * k;
        hx[i * HM + hp] = px[i]; hy[i * HM + hp] = py[i];
        sx += px[i]; sy += py[i];
        heat[i] *= hd;
        bin[i] = Math.min(3, (heat[i] * 3.2) | 0);
      }
      ccx = sx / N; ccy = sy / N;

      // Colour: cold bone; dread sinks it to dark blood; heat bleeds it red, then hot.
      const bl = x.p('bleed');
      const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      let col = mix([160, 176, 204], [232, 196, 140], 0.3);
      col = mix(col, [150, 14, 20], wd * 0.95);
      col = mix(col, [205, 210, 220], wa * 0.25);
      // Heat cools from a white flash through blood to deep maroon and back to the flock's own colour.
      const cols = [col, mix(col, [120, 10, 18], 0.8 * bl), mix(col, [205, 28, 34], bl), mix(col, [255, 236, 222], bl)];
      const css = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
      const T = Math.max(1, Math.min(HM - 1, Math.round(x.p('trail'))));
      // While one figure glides into the next the trails are cut short, so the new shape reads instead of a smeared sheet;
      // after an explosion they stay long (the streaks).
      const alpha = 0.9 - 0.15 * wd, cap = (40 + 16 * T) * (1 - 0.75 * wf * (1 - calm));
      g.lineCap = 'round'; g.lineJoin = 'round';
      // The clock face, faintly, while a figure stands: twelve hours, the chord's own lit.
      if (wf > 0.02) {
        for (const lit of [0, 1]) {
          g.beginPath();
          for (let p = 0; p < 12; p++) { if ((pcsMask >> p & 1) !== lit) continue; const r0 = fs * 1.13, r1 = fs * (lit ? 1.27 : 1.17); g.moveTo(fcx + clockX(p) * r0, fcy + clockY(p) * r0); g.lineTo(fcx + clockX(p) * r1, fcy + clockY(p) * r1); }
          g.strokeStyle = css(lit ? [235, 225, 215] : col, (lit ? 0.7 : 0.25) * wf); g.lineWidth = lit ? 2.5 : 1.5; g.stroke();
        }
      }
      for (let b = 0; b < 4; b++) {
        g.beginPath();
        for (let i = 0; i < N; i++) {
          if (bin[i] !== b) continue;
          const o = i * HM; let h = hp, lx = hx[o + h], ly = hy[o + h], len = 0; g.moveTo(lx, ly);
          if (T === 1) { g.lineTo(lx - vx[i] * 1.5 - 0.5, ly - vy[i] * 1.5); continue; }
          for (let j = 0; j < T && len < cap; j++) { h = (h + HM - 1) % HM; const nx = hx[o + h], ny = hy[o + h]; len += Math.abs(nx - lx) + Math.abs(ny - ly); g.lineTo(nx, ny); lx = nx; ly = ny; }
        }
        g.strokeStyle = css(cols[b], alpha);
        g.lineWidth = 1.3 + 0.5 * b + 1.6 * wd;
        g.stroke();
      }
    },
  });
})();
