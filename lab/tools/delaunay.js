// Delaunay (new, 2026-10-31): after Sonia and Robert Delaunay's simultaneous discs. Three discs of concentric rings sit
// in a composition across the screen: the big one holds the bass, the middle one the middle of the keyboard, the small
// one the treble. Each disc's rings go up in pitch from the centre out, and each ring is cut into coloured halves,
// quarters or eighths that turn, every ring at its own speed and in its own direction (faster when the music is busy).
// Every pitch class owns a colour, laid round the circle of fifths (C red, G vermilion, D orange ... F rose), so a note
// lights the segment of its ring that sits at its own clock position, in its own colour, and the segment beside it takes
// the opposite colour (Delaunay's "simultaneous contrast": a tritone away, the complementary hue). On the attack the
// struck ring jumps forward, flashes, and swells: the swell runs outward ring by ring through the disc. Lit colours
// sink back to a dark glaze of themselves, so each disc keeps a memory of the harmony that coloured it.
(() => {
  const TAU = Math.PI * 2, SLOTS = 16, RINGS = 6;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  // the 12 colours, in circle-of-fifths order from C (index = fifths step): opposite colours are a tritone apart
  // Delaunay's palette rather than a rainbow: vermilion, orange, chrome yellow, lime, emerald, viridian, cerulean, cobalt,
  // ultramarine, violet, crimson, rose (C, G, D, A, E, B, F#, C#, G#, D#, A#, F)
  const PAL = [[226, 52, 36], [240, 122, 28], [246, 196, 44], [186, 204, 62], [36, 160, 96], [22, 142, 142],
    [44, 146, 214], [42, 84, 196], [74, 52, 172], [134, 62, 176], [196, 46, 128], [234, 112, 142]];
  const CREAM = [238, 228, 206], INK = [10, 9, 13];
  const FIFTH = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];       // pitch class → its step on the circle of fifths
  // the discs: centre and radius as fractions of the screen, the notes they hold, their seam pattern per ring
  const DISCS = [
    { fx: 0.355, fy: 0.6, fr: 0.47, lo: 24, cuts: [2, 4, 2, 4, 4, 8], ph: 0.0 },
    { fx: 0.7, fy: 0.37, fr: 0.36, lo: 48, cuts: [2, 2, 4, 4, 8, 4], ph: 1.7 },
    { fx: 0.875, fy: 0.78, fr: 0.235, lo: 72, cuts: [2, 4, 4, 8, 4, 8], ph: 3.1 },
  ];
  // the resting glaze leans cool (blues, violets, crimson), so the warm colours the music lights stand out
  const REST = [7, 8, 9, 10, 11, 0, 6, 5, 8, 9, 7, 1];
  let discs = [], kicks = [];
  const R1 = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

  function build() {
    const r = R1(17);
    discs = DISCS.map((d, di) => ({
      ...d, x: 0, y: 0, R: 0,
      rings: Array.from({ length: RINGS }, (_, k) => {
        // each ring turns at its own pace, alternating direction
        const w = (0.16 + 0.22 * r()) * (k % 2 ? -1 : 1) * (di === 1 ? -1 : 1);
        const slots = [];
        for (let s = 0; s < SLOTS; s++) {
          // the resting glaze: a seeded mix of the 12 colours, with a few cream and black segments
          const roll = r();
          slots.push({ step: REST[Math.floor(r() * REST.length)], kind: roll < 0.1 ? 1 : roll < 0.2 ? 2 : 0, lit: 0, fl: 0, mem: 0.5 + 0.3 * r() });
        }
        // a fresh glaze per segment group, so the coarse cut shows whole segments, not stripes
        for (let s = 0; s < SLOTS; s++) { const g0 = s - (s % 2); Object.assign(slots[s], { step: slots[g0].step, kind: slots[g0].kind, mem: slots[g0].mem }); }
        return { rot: r() * TAU, w, wk: 0, off: 0, vel: 0, slots };
      }),
    }));
    kicks = [];
  }
  build();

  // how many segments ring k of disc d is cut into, for cut 0..1
  const segsOf = (d, k, cut) => Math.min(SLOTS, d.cuts[k] * (cut < 0.34 ? 1 : cut < 0.67 ? 2 : 4)) | 0;
  const discOf = (m) => (m < 48 ? 0 : m < 72 ? 1 : 2);
  const ringOf = (d, m) => Math.max(0, Math.min(RINGS - 1, Math.floor((m - d.lo) / 4)));

  // light every slot of the segment that holds `slot` (in a ring cut into n), keeping the brighter colour
  function paint(ring, slot, n, step, amt, flash) {
    const gs = SLOTS / n, g0 = slot - (slot % gs);
    for (let s = g0; s < g0 + gs; s++) {
      const q = ring.slots[s];
      if (q.kind === 0 && q.step === step) { q.lit = Math.max(q.lit, amt); q.fl = Math.max(q.fl, flash); q.mem = 1; continue; }
      if (q.lit > amt) continue;
      q.step = step; q.kind = 0; q.lit = amt; q.fl = Math.max(q.fl, flash); q.mem = 1;
    }
  }

  // icon pieces (40 x 26)
  const fill = (g, x, y, r0, r1, a0, a1, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r1, a0, a1); if (r0 > 0) g.arc(x, y, r0, a1, a0, true); else g.lineTo(x, y); g.closePath(); g.fill(); };
  const hsl = (step, k = 1) => `rgb(${PAL[((step % 12) + 12) % 12].map((c) => Math.round(c * k)).join(',')})`;
  const ICONS = {
    turn(g, v, w, h) {                                 // a small quartered disc with a turning arrow round it
      const cx = 14, cy = h / 2, sweep = 0.25 + v * 4.4;
      [0, 3, 6, 9].forEach((s, i) => fill(g, cx, cy, 0, 9, i * TAU / 4 + v * 0.6, (i + 1) * TAU / 4 + v * 0.6, hsl(s)));
      g.strokeStyle = ICON.ink; g.lineWidth = 1.4; g.beginPath(); g.arc(cx, cy, 11.5, -1.2, -1.2 + sweep); g.stroke();
      const a = -1.2 + sweep, tx = cx + 11.5 * Math.cos(a), ty = cy + 11.5 * Math.sin(a), d = a + Math.PI / 2;
      g.fillStyle = ICON.ink; g.beginPath(); g.moveTo(tx + 3.5 * Math.cos(d), ty + 3.5 * Math.sin(d));
      g.lineTo(tx + 2.6 * Math.cos(a), ty + 2.6 * Math.sin(a)); g.lineTo(tx - 2.6 * Math.cos(a), ty - 2.6 * Math.sin(a)); g.fill();
      for (let i = 0; i < Math.round(v * 3); i++) ICON.line(g, 30 + i * 3.5, 6 + i * 2, 30 + i * 3.5, 20 - i * 2, ICON.dim, 1.2);
    },
    contrast(g, v, w, h) {                             // a red half; its other half dark, or its green opposite
      const cx = w / 2, cy = h / 2;
      fill(g, cx, cy, 0, 11, Math.PI / 2, Math.PI * 1.5, hsl(0));
      fill(g, cx, cy, 0, 11, -Math.PI / 2, Math.PI / 2, hsl(6, lerp(0.2, 1, v)));
    },
    pulse(g, v, w, h) {                                // concentric rings that open outward
      const cx = w / 2, cy = h / 2, sp = 1.9 + v * 1.1;
      for (let k = 0; k < 4; k++) ICON.ring(g, cx, cy, 1.8 + k * sp * (1 + k * 0.08 * v), k % 2 ? ICON.gold : ICON.red, 1.5);
    },
    memory: (g, v, w, h) => ICON.fade(g, w, h, 0.12 + v * 0.88, hsl(0), 'dot'),
    cut(g, v, w, h) {                                  // the same ring cut into halves, quarters or eighths
      const n = v < 0.34 ? 2 : v < 0.67 ? 4 : 8, cx = w / 2, cy = h / 2;
      for (let j = 0; j < n; j++) fill(g, cx, cy, 5, 11, -Math.PI / 2 + j * TAU / n, -Math.PI / 2 + (j + 1) * TAU / n, hsl([0, 6, 3, 9, 1, 7, 4, 10][j]));
      fill(g, cx, cy, 0, 5, Math.PI / 2, Math.PI * 1.5, hsl(2)); fill(g, cx, cy, 0, 5, -Math.PI / 2, Math.PI / 2, hsl(8));
    },
  };

  TOOLS.push({
    id: 'delaunay', name: 'Delaunay', tag: 'new',
    blurb: 'Sonia and Robert Delaunay\'s simultaneous discs. Three discs of rings (bass, middle, treble), each ring cut into coloured segments that turn at their own speed. Every note has its own colour (round the circle of fifths) and lights its ring at its own clock position, with the opposite colour beside it; the struck ring jumps, flashes and swells outward through the disc.',
    params: [
      { key: 'turn', label: 'how fast the rings turn', min: 0, max: 1, value: 0.3, drive: '+rate',
        hint: 'How fast the rings turn. Left: almost still. Right: whirling, each ring against its neighbour.',
        icon: ICONS.turn },
      { key: 'contrast', label: 'opposite colours', min: 0, max: 1, value: 0.65,
        hint: 'Whether a lit segment sets its opposite colour beside it. Left: only the note\'s own colour. Right: every colour gets its complementary partner.',
        icon: ICONS.contrast },
      { key: 'pulse', label: 'swell on each note', min: 0, max: 1, value: 0.45, drive: '+level',
        hint: 'How far the rings swell outward when a note is struck. Left: the discs stay put. Right: every attack throbs out through the rings.',
        icon: ICONS.pulse },
      { key: 'memory', label: 'how long colours glow', min: 0.4, max: 8, value: 3.5,
        hint: 'How long a lit segment stays bright before it sinks back to a dark glaze. Left: a flash. Right: the colours of a chord glow for seconds.',
        icon: ICONS.memory },
      { key: 'cut', label: 'how finely cut', min: 0, max: 1, value: 0.25,
        hint: 'How many segments each ring is cut into. Left: big halves and quarters. Right: fine eighths and sixteenths.',
        icon: ICONS.cut },
    ],
    reset() { build(); },
    onChord(ch, x) {
      const cut = x.p('cut'), con = x.p('contrast'), pulse = x.p('pulse');
      for (const n of ch.notes) {
        const di = discOf(n.m), d = discs[di], k = ringOf(d, n.m), ring = d.rings[k];
        const segs = segsOf(d, k, cut), vk = clamp01(n.v / 110), step = FIFTH[((n.m % 12) + 12) % 12];
        // the segment at this note's clock position on the circle of fifths (C at the top), as the ring has turned
        const ang = step * (TAU / 12) - Math.PI / 2;
        const local = (((ang - ring.rot) % TAU) + TAU) % TAU, slot = Math.floor(local / (TAU / SLOTS)) % SLOTS;
        paint(ring, slot, segs, step, 0.55 + 0.45 * vk, 0.6 + 0.4 * vk);
        if (con > 0.02) {                              // simultaneous contrast: the next segment takes the opposite colour
          const gs = SLOTS / segs, side = (step % 2 ? -1 : 1) * gs;
          paint(ring, (slot + side + SLOTS) % SLOTS, segs, step + 6, (0.4 + 0.45 * vk) * con, 0.25 * con);
        }
        ring.wk += (ring.w > 0 ? 1 : -1) * (0.5 + 1.4 * vk * vk);     // the struck ring jumps forward
        // the swell starts at the struck ring and runs outward through the disc
        const A = pulse * (4 + 20 * vk * vk) * (d.fr / 0.47 * 0.6 + 0.4);
        for (let j = k; j < RINGS; j++) kicks.push({ d: di, k: j, a: A * Math.pow(0.82, j - k), wait: (j - k) * 0.045 });
      }
      if (kicks.length > 400) kicks.splice(0, kicks.length - 400);
    },
    frame(x) {
      const g = x.g, dt = x.dt;
      const turn = x.p('turn'), mem = x.p('memory'), cut = x.p('cut');
      const spin = 0.04 + 1.6 * turn * turn + 0.3 * turn;
      const glow = 0.1 * x.feat.level;   // louder: the whole painting lifts a little
      const kLit = Math.exp(-dt / mem), kFl = Math.exp(-dt / 0.12), kMem = Math.exp(-dt / (mem * 7 + 6));
      // swells waiting to start
      for (const q of kicks) { q.wait -= dt; if (q.wait <= 0) { const r = discs[q.d].rings[q.k]; r.vel += q.a * 13; } }
      kicks = kicks.filter((q) => q.wait > 0);
      const base = Math.min(x.H, x.W * 9 / 16);
      for (const d of discs) {
        // the composition drifts very slowly with the song
        d.x = x.W * d.fx + base * 0.012 * Math.sin(x.t * 0.05 + d.ph);
        d.y = x.H * d.fy + base * 0.01 * Math.sin(x.t * 0.037 + d.ph * 1.3);
        d.R = base * d.fr * (1 + 0.025 * x.feat.level);
        let acc = 0;
        for (let k = 0; k < RINGS; k++) {
          const r = d.rings[k];
          // the ring's swell: a damped spring (two half steps keep it steady at long frames)
          for (let h = 0; h < 2; h++) { const hd = dt / 2; r.vel += (-170 * r.off - 9 * r.vel) * hd; r.off += r.vel * hd; }
          r.wk *= Math.exp(-dt / 0.45);
          r.rot += dt * (r.w * spin + r.wk * (0.6 + turn));
          for (const q of r.slots) { q.lit *= kLit; q.fl *= kFl; q.mem *= kMem; }
          acc += Math.max(-6, r.off);
          r.r1 = d.R * (k + 1) / RINGS + acc;
        }
        // draw: rings from the outside in, each a full set of segments; seams in dark ink
        g.save();
        for (let k = RINGS - 1; k >= 0; k--) {
          const r = d.rings[k], n = segsOf(d, k, cut), gs = SLOTS / n, r1 = Math.max(2, r.r1), r0 = k ? Math.max(0, d.rings[k - 1].r1) : 0;
          for (let j = 0; j < n; j++) {
            // the segment shows its brightest slot
            let q = r.slots[j * gs];
            for (let s = j * gs + 1; s < (j + 1) * gs; s++) if (r.slots[s].lit + r.slots[s].fl > q.lit + q.fl) q = r.slots[s];
            const a0 = r.rot + j * TAU / n, a1 = a0 + TAU / n;
            // a dark glaze of its colour (a little brighter while remembered), the full colour while lit, cream on the attack
            const c = q.kind === 1 ? CREAM : q.kind === 2 ? INK : PAL[q.step % 12];
            const gl = q.kind === 2 ? 1 : 0.15 + 0.2 * q.mem + glow, fl = q.fl * 0.55;
            const ch = (i) => { const b = c[i] * gl, v = b + (c[i] - b) * Math.min(1, q.lit); return Math.round(v + (CREAM[i] - v) * fl); };
            g.fillStyle = `rgb(${ch(0)},${ch(1)},${ch(2)})`; g.beginPath();
            g.arc(d.x, d.y, r1, a0, a1);
            if (r0 > 0) g.arc(d.x, d.y, r0, a1, a0, true); else g.lineTo(d.x, d.y);
            g.closePath(); g.fill();
          }
        }
        // the seams: ring circles and the segment cuts, thin and dark
        g.strokeStyle = 'rgba(6,5,8,0.75)'; g.lineWidth = 1.4; g.beginPath();
        for (let k = 0; k < RINGS; k++) {
          const r = d.rings[k], r1 = Math.max(2, r.r1), r0 = k ? Math.max(0, d.rings[k - 1].r1) : 0, n = segsOf(d, k, cut);
          g.moveTo(d.x + r1, d.y); g.arc(d.x, d.y, r1, 0, TAU);
          for (let j = 0; j < n; j++) { const a = r.rot + j * TAU / n, c = Math.cos(a), s = Math.sin(a); g.moveTo(d.x + c * r0, d.y + s * r0); g.lineTo(d.x + c * r1, d.y + s * r1); }
        }
        g.stroke();
        g.restore();
      }
    },
  });
})();
