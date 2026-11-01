// Boogie woogie: after Mondrian's Broadway Boogie Woogie. A grid of yellow lanes on cream (or black). Every note drops a
// small red, blue or grey block where its pitch lane (the columns, low notes left) crosses the row of its harmony (the rows
// follow the circle of fifths, so the same chord lights the same rows). Every attack makes all the blocks hop forward
// along their lanes, so a rhythmic passage makes the city boogie and a slow chorale barely moves it. Big, loud chords
// flash a whole intersection: both lanes bead up with colour and a large plane lands on the crossing.
// A sixth knob, how present (the user, 2026-11-01: sliders should dim, not only boost). Turned down, the lamp over the page
// is lowered: every colour darkens, the page most, the blocks least, still flat and opaque so nothing smears. The traffic
// hops less, flashes stop, and only the song's hardest notes drop a block.
(() => {
  const CREAM = [236, 230, 215], NIGHT = [12, 11, 11];
  const YEL = [238, 197, 40], RED = [198, 46, 30], BLUE = [32, 70, 156], GREY = [160, 156, 148], WHITE = [252, 250, 242];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const hash = (a, b) => { let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  let G = null, blocks = [], planes = [], turn = 0, flashCool = 0, sinceMark = 9;   // 9: after a start or a seek the empty page counts as a long lull, so the first chord is answered at any presence

  // how present (0..1): which notes are answered, judged against this piece's own notes (recordings differ a lot in how
  // hard they play): every one at 1, the hardest 40% at 0.4, the hardest 5% at 0
  let vels = null;
  const hardEnough = (v, pres) => {
    if (pres >= 1) return true;
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= (1 - pres) * 0.95;
  };
  // A colour under the lowered lamp. Painted opaque, because the stage only fades 12% a frame: a translucent page would
  // build up and smear behind every hop. At k = 1 it is the very same colour.
  const shade = (c, k) => (k >= 1 ? c : [c[0] * k, c[1] * k, c[2] * k]);

  // The grid: n columns and about 0.6 n rows at irregular, seeded positions (the same every time for the same n).
  function build(n, W, H) {
    const R = rng(17 + n * 3), m = Math.max(4, Math.round(n * 0.62));
    const lw = Math.round(clamp(200 / n, 12, 24)), cell = lw + 4;
    const place = (k, span) => {
      const out = [], pad = span * 0.05, step = (span - 2 * pad) / (k - 1);
      for (let i = 0; i < k; i++) out.push(Math.round(pad + i * step + (i > 0 && i < k - 1 ? (R() - 0.5) * step * 0.55 : 0)));
      return out;
    };
    G = { n, m, lw, cell, vx: place(n, W), hy: place(m, H), gv: new Float32Array(n), gh: new Float32Array(m), W, H };
  }
  // A block's colour: loud notes mostly red, middling ones blue, soft ones grey.
  function pick(v, r) {
    const pr = clamp((v - 62) / 50, 0.06, 0.8), pg = clamp((78 - v) / 45, 0.06, 0.6);
    return r < pr ? RED : r < pr + pg ? GREY : BLUE;
  }
  const PLANE = [[RED, YEL], [BLUE, WHITE], [RED, GREY], [BLUE, RED], [GREY, RED], [GREY, BLUE]];

  TOOLS.push({
    id: 'boogie', name: 'Boogie woogie', tag: 'new', on: false,
    blurb: 'After Mondrian\'s Broadway Boogie Woogie: yellow lanes on cream. Each note drops a small red, blue or grey block where its pitch lane (low notes left) meets the row of its harmony, and every attack makes all the blocks hop along their lanes, so rhythm drives the traffic: fast passages boogie, a slow chorale barely moves. Big loud chords flash a whole crossing.',
    params: [
      { key: 'lanes', label: 'how many lanes', min: 6, max: 16, step: 1, value: 10,
        hint: 'How dense the city is. Left: a few wide lanes. Right: a tight grid of thin ones.',
        icon: (g, v, w, h) => {
          const nv = 2 + Math.round(v * 5), nh = 1 + Math.round(v * 3), lw = 3.6 - 2.4 * v;
          for (let i = 0; i < nv; i++) ICON.rect(g, (w * (i + 1)) / (nv + 1) - lw / 2, 1, lw, h - 2, ICON.gold);
          for (let i = 0; i < nh; i++) ICON.rect(g, 1, (h * (i + 1)) / (nh + 1) - lw / 2, w - 2, lw, ICON.gold);
        } },
      { key: 'hop', label: 'how far they jump on each note', min: 0, max: 2, value: 0.6, drive: '+rate',
        hint: 'How far every block hops along its lane when a note is struck. Left: they stand still. Right: two steps at a time.',
        icon: (g, v, w, h) => {
          ICON.rect(g, 2, h / 2 - 4, w - 4, 8, ICON.gold);
          const n = Math.round(v * 4);
          for (let i = 0; i < n; i++) ICON.alpha(g, 0.25 + 0.12 * i, () => ICON.square(g, 7 + i * 6.5, h / 2, 7, ICON.red));
          ICON.square(g, 7 + n * 6.5, h / 2, 7, ICON.red);
        } },
      { key: 'life', label: 'how long blocks stay', min: 1, max: 12, value: 6,
        hint: 'How long a block lives before it shrinks away. Left: a second. Right: they pile up for many seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.12 + v * 0.88, ICON.red) },
      { key: 'flash', label: 'big-chord flashes', min: 0, max: 1, value: 0.7,
        hint: 'How easily a big chord flashes a whole crossing with a large coloured plane. Left: never. Right: even modest chords, and bigger planes.',
        icon: (g, v, w, h) => {
          ICON.rect(g, w / 2 - 2, 1, 4, h - 2, ICON.gold); ICON.rect(g, 2, h / 2 - 2, w - 4, 4, ICON.gold);
          if (v < 0.05) return;
          const s = 5 + v * 15; ICON.rect(g, w / 2 - s * 0.65, h / 2 - s / 2, s * 1.3, s, ICON.blue);
          ICON.square(g, w / 2 + s * 0.15, h / 2, s * 0.4, ICON.red);
        } },
      { key: 'ground', label: 'background', min: 0, max: 1, value: 0,
        hint: 'The colour under the lanes. Left: Mondrian\'s cream. Right: night black.',
        icon: (g, v, w, h) => {
          ICON.rect(g, 3, 3, w - 6, h - 6, ICON.lerp('#ece6d7', '#0c0b0b', v));
          ICON.rect(g, 3, h / 2 - 2, w - 6, 4, ICON.gold); ICON.rect(g, w * 0.62, 3, 4, h - 6, ICON.gold);
          ICON.square(g, w * 0.3, h / 2, 4, ICON.red);
        } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: a dark, nearly still city, and only the hardest notes drop a faint block. Right: the bright page, every note at full strength (as before).',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + 0.85 * v, () => {   // the page with its traffic, dim and nearly bare, or bright and busy
          ICON.rect(g, 3, 3, w - 6, h - 6, '#ece6d7');
          ICON.rect(g, 3, h / 2 - 2, w - 6, 4, ICON.gold); ICON.rect(g, w * 0.62, 3, 4, h - 6, ICON.gold);
          ICON.square(g, w * 0.3, h / 2, 4, ICON.red);
          if (v > 0.35) ICON.square(g, w * 0.62 + 2, h * 0.25, 4, ICON.blue);
          if (v > 0.7) ICON.square(g, w * 0.8, h / 2, 4, ICON.red);
        }) },
    ],
    reset() { blocks = []; planes = []; turn = 0; flashCool = 0; sinceMark = 9; vels = null; if (G) { G.gv.fill(0); G.gh.fill(0); } },
    onChord(ch, x) {
      const pres = x.p('presence'), n = Math.round(x.p('lanes'));
      if (!G || G.n !== n || G.W !== x.W) { build(n, x.W, x.H); blocks = []; planes = []; }
      const { cell, vx, hy } = G;
      // Every attack moves the traffic: each block banks a share of a step and hops by whole steps (crisp, on the beat).
      // Turned down, the hops shrink and only a chord with a hard enough note moves the traffic at all.
      const vf = Math.pow(ch.vel / 100, 1.2), hop = x.p('hop') * (0.45 + 0.65 * Math.min(1.3, vf)) * (1 - 0.75 * (1 - pres));
      // A passage with nothing that hard still gets the odd block: after a long enough lull, this chord's loudest note counts.
      const lull = pres < 1 && sinceMark > 1.5 + 5 * (1 - pres);
      if (lull || hardEnough(ch.vel, pres)) for (const b of blocks) { b.acc += hop; const k = Math.floor(b.acc); if (k > 0) { b.acc -= k; b.tgt += k * cell * b.d; } }
      // Each note drops a block where its pitch column meets its harmony row; a block already there lights up instead.
      const notes = [...ch.notes].sort((a, b) => a.m - b.m).slice(0, 8);
      const loudest = lull ? notes.reduce((a, b) => (b.v > a.v ? b : a)) : null;
      for (const nt of notes) {
        if (nt !== loudest && !hardEnough(nt.v, pres)) continue;
        sinceMark = 0;
        const vi = clamp(Math.round(((nt.m - 26) / 72) * (G.n - 1)), 0, G.n - 1);
        const hi = Math.min(G.m - 1, Math.floor((((nt.m % 12) * 7) % 12) * G.m / 12));
        const X = vx[vi], Y = hy[hi], o = turn++ % 2 ? 'h' : 'v';
        if (o === 'v') G.gv[vi] = Math.max(G.gv[vi], 0.45 * pres); else G.gh[hi] = Math.max(G.gh[hi], 0.45 * pres);
        const near = blocks.find((b) => Math.abs(b.x - X) < cell * 0.7 && Math.abs(b.y - Y) < cell * 0.7);
        if (near) { near.lit = 1; near.age = Math.min(near.age, 0.2); near.col = pick(nt.v, Math.random()); continue; }
        // A loud or long note drops a short train (up to 3 blocks) trailing behind its head, colours alternating.
        const d = o === 'v' ? (vi % 2 ? -1 : 1) : (hi % 2 ? -1 : 1), len = pres < 0.5 ? 1 : 1 + (nt.v > 84 ? 1 : 0) + (nt.d > 0.7 ? 1 : 0);
        let col = pick(nt.v, Math.random());
        for (let j = 0; j < len; j++) {
          const p0 = (o === 'v' ? Y : X) - j * cell * d;
          blocks.push({ o, lane: o === 'v' ? vi : hi, pos: p0, tgt: p0, d, acc: 0, x: X, y: Y, col, lit: 1 - j * 0.3, age: j * 0.05,
            k: 0.85 + 0.15 * Math.min(1, nt.v / 100) });
          col = col === RED ? (Math.random() < 0.5 ? BLUE : GREY) : col === BLUE ? (Math.random() < 0.6 ? RED : GREY) : (Math.random() < 0.5 ? RED : BLUE);
        }
      }
      if (blocks.length > 420) blocks.splice(0, blocks.length - 420);
      // Big, loud chords flash a whole crossing: the chord's middle column meets its bass note's row.
      // Turned down they need a bigger chord, come out smaller, and below about 0.15 stop altogether.
      const fl = x.p('flash') * pres * pres, score = Math.pow(ch.vel / 100, 3) * (1 + Math.min(8, ch.notes.length));
      if (fl > 0.02 && flashCool <= 0 && score >= 8.5 - 6.8 * fl && hardEnough(ch.vel, pres)) {
        flashCool = 0.22;
        const mid = notes.reduce((s, q) => s + q.m, 0) / notes.length;
        const vi = clamp(Math.round(((mid - 26) / 72) * (G.n - 1)), 0, G.n - 1);
        const hi = Math.min(G.m - 1, Math.floor((((notes[0].m % 12) * 7) % 12) * G.m / 12));
        G.gv[vi] = pres; G.gh[hi] = pres;
        const big = clamp(score / 8, 0.35, 1.3) * (0.6 + 0.6 * fl), [c1, c2] = PLANE[Math.floor(Math.random() * PLANE.length)];
        planes.push({ x: vx[vi], y: hy[hi], w: cell * (3 + Math.random() * 4) * big, h: cell * (2.5 + Math.random() * 3.5) * big,
          c1, c2, ix: Math.random() - 0.5, iy: Math.random() - 0.5, age: 0, life: 1.3 + 1.6 * Math.random() * big });
        if (planes.length > 14) planes.shift();
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H;
      const n = Math.round(x.p('lanes'));
      if (!G || G.n !== n || G.W !== W) { build(n, W, H); blocks = []; planes = []; }
      const { lw, cell, vx, hy, gv, gh } = G;
      flashCool -= dt; sinceMark += dt;
      const gk = Math.pow(0.5, dt / 0.32);
      for (let i = 0; i < gv.length; i++) gv[i] *= gk;
      for (let i = 0; i < gh.length; i++) gh[i] *= gk;

      // How much light each thing keeps under the lowered lamp: all of it at presence 1; at 0 a trace of page and lanes.
      const pres = x.p('presence'), kPage = Math.max(0.02, Math.pow(pres, 1.5)), kLane = 1 - 0.9 * (1 - pres), kMark = 1 - 0.68 * (1 - pres);
      // Ground and lanes.
      const gt = x.p('ground'), ground = mix(CREAM, NIGHT, gt);
      // The page loses its blue first, as paper does under a lowered lamp: a warm umber on the way down, never a dirty grey.
      g.fillStyle = css(kPage >= 1 ? ground : [ground[0] * kPage, ground[1] * Math.pow(kPage, 1.15), ground[2] * Math.pow(kPage, 1.5)]); g.fillRect(0, 0, W, H);
      g.fillStyle = css(shade(YEL, kLane));
      for (const X of vx) g.fillRect(X - lw / 2, 0, lw, H);
      for (const Y of hy) g.fillRect(0, Y - lw / 2, W, lw);
      // Flashing lanes bead up with colour, like the painting's lanes.
      // A bead shows while the lane's glow is above its own random threshold, so a lane fills and empties bead by bead.
      const bead = (i, k, glow) => { if (hash(k, i + 99) * 0.95 + 0.05 > glow) return null; const r = hash(i, k); return r < 0.3 ? RED : r < 0.58 ? BLUE : r < 0.86 ? GREY : null; };
      const bs0 = lw - 2;
      for (let i = 0; i < gv.length; i++) if (gv[i] > 0.05) {
        for (let k = 0, y = (hy[0] % cell) - cell; y < H + cell; k++, y += cell) { const c = bead(i * 7 + 1, k, gv[i]); if (c) { g.fillStyle = css(shade(c, kMark)); g.fillRect(vx[i] - bs0 / 2, y - bs0 / 2, bs0, bs0); } }
      }
      for (let i = 0; i < gh.length; i++) if (gh[i] > 0.05) {
        for (let k = 0, X = (vx[0] % cell) - cell; X < W + cell; k++, X += cell) { const c = bead(i * 13 + 5, k, gh[i]); if (c) { g.fillStyle = css(shade(c, kMark)); g.fillRect(X - bs0 / 2, hy[i] - bs0 / 2, bs0, bs0); } }
      }

      // Planes: a large block on the crossing with a smaller one inside; they land at once and shrink away.
      for (const p of planes) {
        p.age += dt;
        const f = p.age / p.life, s = Math.min(1, p.age / 0.06) * (f < 0.65 ? 1 : Math.max(0, 1 - (f - 0.65) / 0.35));
        if (s <= 0) continue;
        const w = p.w * s, h = p.h * s;
        g.fillStyle = css(shade(p.c1, kMark)); g.fillRect(Math.round(p.x - w / 2), Math.round(p.y - h / 2), Math.round(w), Math.round(h));
        const iw = Math.min(w, h) * 0.42;
        g.fillStyle = css(shade(p.c2, kMark)); g.fillRect(Math.round(p.x + p.ix * (w - iw) * 0.6 - iw / 2), Math.round(p.y + p.iy * (h - iw) * 0.6 - iw / 2), Math.round(iw), Math.round(iw));
      }
      planes = planes.filter((p) => p.age < p.life);

      // Blocks: glide to their next step, light up white when struck, shrink away at the end of their life.
      const life = x.p('life'), ease = 1 - Math.exp(-dt * 24), lk = Math.pow(0.5, dt / 0.09), bs = lw;
      for (const b of blocks) {
        b.age += dt; b.lit *= lk;
        b.pos += (b.tgt - b.pos) * ease;
        const span = (b.o === 'v' ? H : W) + 2 * cell;   // traffic wraps around: off one edge, back in at the other
        if (b.pos > span - cell) { b.pos -= span; b.tgt -= span; } else if (b.pos < -cell) { b.pos += span; b.tgt += span; }
        if (b.o === 'v') { b.x = vx[b.lane]; b.y = b.pos; } else { b.x = b.pos; b.y = hy[b.lane]; }
        const f = b.age / life, s = bs * b.k * (f < 0.75 ? 1 : Math.max(0, 1 - (f - 0.75) / 0.25)) * (1 + 0.25 * b.lit * pres);
        if (s < 1) continue;
        g.fillStyle = css(shade(b.lit * pres > 0.45 ? WHITE : b.col, kMark));   // struck: a white flash, then its own colour (no pastel in-betweens); turned down, no flash
        g.fillRect(Math.round(b.x - s / 2), Math.round(b.y - s / 2), Math.round(s), Math.round(s));
      }
      blocks = blocks.filter((b) => b.age < life);
    },
  });
})();
