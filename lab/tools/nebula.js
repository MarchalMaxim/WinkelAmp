// Nebula: abstract gravity. Every sounding note is an attractor: its pitch class sets where it sits on a circle
// (C at the top, going round like a clock), its register nudges it inward (low) or outward (high), its velocity sets how
// hard it pulls. Thousands of fine grains orbit and stream between the attractors; their short streaks plus the page's
// fade become luminous filaments. Each grain takes the colour of the register that pulls it hardest.
// v2: every attack ignites where its note sits: a soft glowing core flares up and a puff of bright new grains (lit almost
// white) is born there, cooling into the note's colour as it streams off. Loud notes flare big, soft ones barely whisper; deep
// notes are wide, slow and heavy, high notes small, quick and glinting. The pull now fades with distance, so a chord
// becomes several separate knots joined by threads instead of one lump.
// A sixth knob, how present: moving it writes the widget's other knobs.
(() => {
  const MAXN = 7000, PCS = 12;
  const px = new Float32Array(MAXN), py = new Float32Array(MAXN), vx = new Float32Array(MAXN), vy = new Float32Array(MAXN);
  const pc = new Float32Array(MAXN);                     // colour 0..1 (low register → high register)
  const heat = new Float32Array(MAXN);                   // 1 = just born in an attack (lit almost white), cools to 0
  // Attractors, one per pitch class: current strength, target, register (0..1, eased), flare (the last attack's glow).
  const S = new Float32Array(PCS), TG = new Float32Array(PCS), REG = new Float32Array(PCS).fill(0.5), FL = new Float32Array(PCS);
  const regW = new Float32Array(PCS), regS = new Float32Array(PCS);
  // The lit attractors this frame: position, strength, colour, softening (wide for deep notes, tight for high ones).
  const AX = new Float32Array(PCS), AY = new Float32Array(PCS), AS = new Float32Array(PCS), AC = new Float32Array(PCS), AE = new Float32Array(PCS);
  // Register colours, low → high: crimson, ember, amber, bone, teal, ice violet.
  const PAL = ['200,40,72', '232,92,52', '242,170,72', '228,216,190', '90,198,212', '150,150,255'];
  const NB = PAL.length;
  // Newborn grains: each register colour lifted half-way to white, so a fresh puff still says which note it came from.
  const PALHOT = PAL.map((c) => c.split(',').map((v) => Math.round((Number(v) + 255) / 2)).join(','));
  const RANGE2 = 240 * 240;                              // beyond about this far a note's pull falls away quickly
  let W = 1280, H = 720, cx = 640, cy = 360, R0 = 280, spin = 0, flash = 0, time = 0, cur = 0;
  const R = Math.random;

  function seed(i) {
    const a = R() * Math.PI * 2, r = R0 * Math.sqrt(R()) * 1.1;
    px[i] = cx + Math.cos(a) * r * 1.45; py[i] = cy + Math.sin(a) * r;
    vx[i] = (R() - 0.5) * 20; vy[i] = (R() - 0.5) * 20; heat[i] = 0;
  }
  const where = (k) => {                                  // attractor k's position now
    const a = -Math.PI / 2 + (k * Math.PI * 2) / PCS + spin, r = R0 * (0.36 + 0.8 * REG[k]);
    return [cx + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r];
  };
  // Piano music lives in the middle of the keyboard, so the register is stretched before it picks a colour.
  const colourOf = (reg) => Math.max(0, Math.min(0.999, (reg - 0.18) / 0.55));

  TOOLS.push({
    id: 'nebula', name: 'Nebula', tag: 'v2',
    blurb: 'Every note is a pull, placed round a circle by its note name, and fine glowing grains stream between the notes. New: each attack now flares where its note sits and breathes out a puff of bright, almost white grains (loud notes big, soft ones faint, deep notes slow and wide, high ones quick and fine), and a chord forms separate knots joined by threads.',
    params: [
      { key: 'pull', label: 'how hard notes pull', min: 0.2, max: 2, value: 0.8, less: 0.4, drive: '+density',
        hint: 'How strongly the notes gather the grains. Left: a loose haze that barely bends. Right: tight, bright knots and threads.',
        icon: (g, v, w, h) => { const r = ICON.rng(4), k = 0.15 + v * 0.8;
          for (let i = 0; i < 22; i++) { const x0 = 3 + r() * (w - 6), y0 = 3 + r() * (h - 6), a = r() * 6.28, d = r() * 4;
            ICON.dot(g, x0 + (w / 2 + Math.cos(a) * d * 1.6 - x0) * k, y0 + (h / 2 + Math.sin(a) * d - y0) * k, 0.9, ICON.gold); } } },
      { key: 'swirl', label: 'fall in or circle round', min: 0, max: 1.6, value: 0.5,
        hint: 'How the grains move around a note. Left: they fall straight in and stream from note to note. Right: they whirl round it in rings.',
        icon: (g, v, w, h) => {   // four grains: straight arrows into the note (left) bend into arrows circling it (right)
          for (let j = 0; j < 4; j++) { const a0 = (j * Math.PI) / 2 + 0.4, bend = v * 1.2, P = [];
            for (let s = 0; s <= 1.0001; s += 0.1) { const r = 11 - (1 - v * 0.75) * 7 * s, a = a0 + s * bend; P.push([w / 2 + Math.cos(a) * r * 1.5, h / 2 + Math.sin(a) * r]); }
            g.strokeStyle = ICON.blue; g.lineWidth = 1.2; g.beginPath(); P.forEach(([X, Y], i) => (i ? g.lineTo(X, Y) : g.moveTo(X, Y))); g.stroke();
            const [x1, y1] = P[P.length - 2], [x2, y2] = P[P.length - 1]; ICON.arrow(g, x1, y1, x2, y2, ICON.blue, 1.2); }
          ICON.dot(g, w / 2, h / 2, 1.6, ICON.ink); } },
      { key: 'amount', label: 'how much dust', min: 1000, max: 7000, step: 100, value: 4000, less: 1000,
        hint: 'How many grains there are. Left: a sparse sprinkle. Right: a thick, milky cloud.',
        icon: (g, v, w, h) => ICON.dots(g, 5 + v * 70, w, h, { r: 0.75, col: ICON.ink, pad: 2, seed: 9 }) },
      { key: 'threads', label: 'grains or threads', min: 0.5, max: 6, value: 1.4,
        hint: 'How long each grain draws its path. Left: fine points of dust. Right: long silky threads.',
        icon: (g, v, w, h) => { const r = ICON.rng(2);
          for (let i = 0; i < 6; i++) { const x = 6 + r() * (w - 12), y = 4 + r() * (h - 8), L = 0.6 + v * 13, a = 0.3 + r() * 0.4;
            ICON.line(g, x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2, x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2, ICON.violet, 1.3); } } },
      { key: 'burst', label: 'how each note ignites', min: 0, max: 2, value: 0.9, less: 0, drive: '+level',
        hint: 'What happens where a note strikes. Left: it only glows and starts to pull. Right: it flares and breathes out a big puff of bright new grains.',
        icon: (g, v, w, h) => { const r = ICON.rng(5); ICON.dot(g, w / 2, h / 2, 1.5 + v * 1.5, ICON.red);
          const n = Math.round(v * 16);
          for (let j = 0; j < n; j++) { const a = r() * 6.28, d = 3 + r() * (3 + v * 7);
            ICON.dot(g, w / 2 + Math.cos(a) * d * 1.5, h / 2 + Math.sin(a) * d, 0.8, j % 2 ? ICON.gold : ICON.red); } } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much dust there is: how many grains drift, how hard the notes gather them, and how big a puff each note breathes out. Left: a thin scatter of grains, loose around the notes, with small puffs that only loud notes still raise. Right: a thick cloud with big puffs of new grains. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset(x) {
      W = x.W; H = x.H; cx = W / 2; cy = H / 2; R0 = H * 0.4; flash = 0; cur = 0;
      S.fill(0); TG.fill(0); REG.fill(0.5); FL.fill(0);
      for (let i = 0; i < MAXN; i++) { seed(i); pc[i] = 0.35 + R() * 0.3; }
    },
    onChord(ch, x) {
      flash = Math.max(flash, ch.vel / 127);
      const burst = x.p('burst'), n = Math.round(x.p('amount')), seen = new Set();
      // Fast passages fire many attacks: each one gives less, so the cloud keeps its threads instead of turning to fur.
      const calm = 1 / (1 + 2.5 * x.feat.rate);
      // One chord may relight at most half the dust (shared between its notes), so its puffs never overwrite each other.
      let npc = 0; for (const note of ch.notes) if (!seen.has(note.m % 12)) { seen.add(note.m % 12); npc++; } seen.clear();
      const share = Math.round((n * 0.5) / Math.max(1, npc));
      for (const note of ch.notes) {
        const k = note.m % 12; if (seen.has(k)) continue; seen.add(k);
        // Place the attractor where this note's register puts it (a fresh note jumps there, a held one leans that way).
        const p = x.pitch01(note.m), vv = note.v / 127;
        REG[k] = S[k] < 0.05 ? p : REG[k] + (p - REG[k]) * 0.5;
        S[k] = Math.max(S[k], 0.3 * Math.sqrt(vv));            // the pull starts on the attack, not a frame later
        FL[k] = Math.min(1.6, Math.max(FL[k], vv * (0.55 + 0.45 * Math.min(1, burst))) + 0.15 * vv);
        if (burst <= 0.01) continue;
        const [ax, ay] = where(k), low = 1 - Math.min(1, p / 0.7), col = colourOf(REG[k]);
        // 1. Ignition: grains are reborn at the note, lit almost white, unfurling outward. Deep notes: a wide, slow, heavy puff.
        //    High notes: a tight spray of quick sparks.
        const cnt = Math.min(420, share, Math.round(burst * (20 + 190 * vv * vv) * (0.75 + 0.6 * low) * (0.35 + 0.65 * calm)));
        const speed = (45 + 210 * vv) * (1.0 - 0.3 * low) * (0.5 + 0.5 * Math.min(1.5, burst)), r0 = 5 + 18 * low;
        for (let j = 0; j < cnt; j++) {
          const i = cur++ % n, a = R() * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), sp = speed * (0.25 + 0.75 * R());
          const rr = r0 * (0.4 + 0.6 * R()); px[i] = ax + c * rr; py[i] = ay + s * rr;
          // Mostly round and a little outward, so the puff unfurls as a spinning spiral rather than a starburst.
          vx[i] = (c * 0.38 - s) * sp; vy[i] = (s * 0.38 + c) * sp; heat[i] = 0.7 + 0.3 * vv; pc[i] = col;
        }
        if (cur > 1e9) cur = 0;
        // 2. The dust already near the note is shoved open in a ring, strongest half-way out, mostly sideways.
        const kick = burst * 200 * vv * calm, reach = 200, reach2 = reach * reach;
        for (let i = 0; i < n; i++) {
          if (heat[i] > 0.65) continue;
          const dx = px[i] - ax, dy = py[i] - ay, d2 = dx * dx + dy * dy; if (d2 > reach2) continue;
          const d = Math.sqrt(d2) + 1, q = d / reach, f = kick * 4 * q * (1 - q) / d;
          vx[i] += dx * f * 0.6 - dy * f * 0.8; vy[i] += dy * f * 0.6 + dx * f * 0.8;
        }
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt; if (dt <= 0) return;
      time += dt; spin += dt * 0.03;
      // 1. The field: fold the sounding notes into 12 pitch-class attractors.
      TG.fill(0); regW.fill(0); regS.fill(0);
      for (const n of x.sounding()) {
        const k = n.m % 12, age = x.t - n.start, w = Math.sqrt(n.v / 127) * (0.5 + 0.5 * Math.exp(-age / 1.5));
        TG[k] += w; regS[k] += w * x.pitch01(n.m); regW[k] += w;
      }
      let na = 0, total = 0;
      for (let k = 0; k < PCS; k++) {
        const tg = Math.min(1.8, TG[k]);
        S[k] += (tg - S[k]) * (1 - Math.exp(-dt / (tg > S[k] ? 0.04 : 0.8)));   // fast attack, slow release
        if (regW[k] > 0) REG[k] += (regS[k] / regW[k] - REG[k]) * (1 - Math.exp(-dt / 0.15));
        if (S[k] > 0.01) {
          const [ax, ay] = where(k), e = 30 + 55 * Math.max(0, 1 - REG[k] / 0.7);   // deep notes: soft wide wells
          AX[na] = ax; AY[na] = ay; AS[na] = S[k]; AC[na] = colourOf(REG[k]); AE[na] = e * e; na++; total += S[k];
        }
      }
      // 2. Move the grains. The pull goes like 1/d close in and falls away fast beyond RANGE, so every note keeps its own knot.
      const n = Math.round(x.p('amount')), G = 52000 * x.p('pull') / Math.pow(Math.max(1, total), 0.3), sw = x.p('swirl');
      const drag = Math.exp(-dt * 0.95), hotDrag = Math.exp(-dt * 3.2), vmax = 560, calm = Math.max(0, 1 - total), kc = 1 - Math.exp(-dt / 0.5), cool = Math.exp(-dt / 0.55);
      const quiet = na ? 0.35 : 1, drift = (22 + 30 * calm) * quiet, jit = (3 + 40 * calm) * quiet * Math.sqrt(dt);   // any note at all calms the drift
      const L = x.p('threads') * dt, rx = R0 * 1.8, ry = R0 * 1.3;
      const paths = [], fast = [], hot = []; for (let b = 0; b < NB; b++) { paths.push(new Path2D()); fast.push(new Path2D()); hot.push(new Path2D()); }
      for (let i = 0; i < n; i++) {
        let X = px[i], Y = py[i], ax = 0, ay = 0, best = 0, bc = -1;
        for (let a = 0; a < na; a++) {
          // The swirl fades out near the note, so grains fall through its centre instead of circling an empty hole.
          const dx = AX[a] - X, dy = AY[a] - Y, d2 = dx * dx + dy * dy, E = AE[a];
          const f = (G * AS[a]) / (d2 + E) * (RANGE2 / (d2 + RANGE2)), t = sw * d2 / (d2 + 4 * E);
          ax += dx * f - dy * f * t; ay += dy * f + dx * f * t;
          if (f > best) { best = f; bc = AC[a]; }
        }
        // A slow, shapeless drift (felt mostly in silence) and a soft wall that keeps the cloud on the screen.
        ax += Math.sin(Y * 0.007 + time * 0.31) * drift; ay += Math.cos(X * 0.006 - time * 0.27) * drift;
        const ox = (X - cx) / rx, oy = (Y - cy) / ry, o = ox * ox + oy * oy;
        if (o > 1) { ax -= (X - cx) * (o - 1) * 0.8; ay -= (Y - cy) * (o - 1) * 0.8; }
        const dr = heat[i] > 0.45 ? hotDrag : drag;   // newborn grains brake hard, so their trails curl instead of shooting out
        let VX = (vx[i] + ax * dt) * dr + (R() - 0.5) * jit, VY = (vy[i] + ay * dt) * dr + (R() - 0.5) * jit;
        const sp = VX * VX + VY * VY; if (sp > vmax * vmax) { const k = vmax / Math.sqrt(sp); VX *= k; VY *= k; }
        X += VX * dt; Y += VY * dt;
        if (X < -40 || X > W + 40 || Y < -40 || Y > H + 40) { seed(i); continue; }
        px[i] = X; py[i] = Y; vx[i] = VX; vy[i] = VY;
        const h = heat[i];
        if (h > 0.02) heat[i] = h * cool; else if (bc >= 0) pc[i] += (bc - pc[i]) * kc;   // newborn grains keep their note's colour
        const b = Math.min(NB - 1, (pc[i] * NB) | 0);
        const p = h > 0.45 ? hot[b] : h > 0.12 || VX * VX + VY * VY > 100 * 100 ? fast[b] : paths[b];   // hot, then streaming, then dust
        p.moveTo(X - VX * L, Y - VY * L); p.lineTo(X + 0.01, Y);
      }
      // 3. Draw: one stroke per register colour, added light so dense streams glow. Deep colours draw their threads a little thicker (thin lines keep it fast).
      flash *= Math.exp(-dt / 0.3);
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      const a = Math.min(0.9, (0.22 + 0.25 * flash) * Math.sqrt(4000 / Math.max(1000, n)));
      for (let b = 0; b < NB; b++) {
        const lw = 0.8 + 0.05 * (NB - 1 - b);
        g.lineWidth = 1.4; g.strokeStyle = `rgba(${PAL[b]},${(a * 0.8).toFixed(3)})`; g.stroke(paths[b]);   // slow grains: soft dust
        g.lineWidth = lw; g.strokeStyle = `rgba(${PAL[b]},${Math.min(1, a * 1.5).toFixed(3)})`; g.stroke(fast[b]);   // streaming grains: bright threads
        g.lineWidth = lw + 0.1; g.strokeStyle = `rgba(${PALHOT[b]},${Math.min(1, a * 2.0).toFixed(3)})`; g.stroke(hot[b]);   // newborn grains: lit almost white
      }
      // 4. The notes' cores: a soft glow that swells with the pull and flares on each attack. Deep notes glow wide and
      //    linger; high notes are small, sharp and quick.
      for (let k = 0; k < PCS; k++) {
        const reg = REG[k], low = Math.max(0, 1 - reg / 0.7);
        FL[k] *= Math.exp(-dt / (0.18 + 0.3 * low));
        const s = Math.min(1.2, S[k]), f = FL[k], lit = 0.18 * s + 0.75 * f; if (lit < 0.015) continue;
        const [X, Y] = where(k), rad = (7 + 12 * s + 34 * f) * (0.6 + 0.9 * low), b = Math.min(NB - 1, (colourOf(reg) * NB) | 0);
        const gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
        gr.addColorStop(0, `rgba(${PALHOT[b]},${Math.min(1, lit * 0.6).toFixed(3)})`);
        gr.addColorStop(0.3, `rgba(${PAL[b]},${Math.min(1, lit * 0.35).toFixed(3)})`);
        gr.addColorStop(1, `rgba(${PAL[b]},0)`);
        g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
      }
    },
  });
})();
