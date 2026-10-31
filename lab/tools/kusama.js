// Kusama: after Yayoi Kusama's polka dots and infinity nets. A flat field of one saturated colour with dots in its
// partner colour (red/white, yellow/black, blue/white). Every note starts a colony at its pitch (low = left, high = right;
// a chord is a row): a big dot lands on the attack and smaller dots spread out around it, one after another, for as long
// as the note is held; each dot wears a thin collar of the ground colour, so colonies lie over each other like cut paper.
// Full chords lay down patches of an infinity net (small open loops), which tighten as the music gets faster and throb
// inward on loud attacks. The harmony picks the colours: the chord's root, measured on the circle of fifths from the
// piece's home note (its most common bass), chooses the pair (home and its neighbours red, the sharp side yellow, the flat
// side blue), and minor or major picks which colour is the ground. A change floods the screen from the attacking colony
// as one huge dot. In silence a sparse all-over field of small dots keeps breathing.
(() => {
  const TAU = Math.PI * 2, GA = Math.PI * (3 - Math.sqrt(5));
  const W = 1280, H = 720;
  const CREAM = '#f4eee3', RED = '#d21f2b', YEL = '#f4c414', INK = '#0e0b0c', BLUE = '#1c49b6';
  // [ground, figure] for each pair: [minor, major]
  const PAIRS = [[[RED, CREAM], [CREAM, RED]], [[INK, YEL], [YEL, INK]], [[BLUE, CREAM], [CREAM, BLUE]]];
  const MAXDOTS = 1100;

  let cols = [], nets = [], seeds = [], flood = null, cur = PAIRS[0][0], time = 0;
  let pcE = new Float32Array(12), bassH = new Float32Array(12), lastChordT = 0, mode = 0, lastFlip = -99;
  let cand = null, candT = 0, tight = 0.5, kick = 0, breathe = 0;

  // The net tile: open scalloped loops on a slightly irregular hex lattice, seamless, in one colour. Cached per colour.
  const S = 26, RH = 22, NC = 8, NR = 8, TW = S * NC, TH = RH * NR;
  const tiles = new Map();
  function netPattern(g, col) {
    let p = tiles.get(col); if (p) return p;
    const c = document.createElement('canvas'); c.width = TW; c.height = TH;
    const t = c.getContext('2d'), r = ICON.rng(23);
    t.strokeStyle = col; t.lineCap = 'round';
    for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) {
      const cx = i * S + (j % 2 ? S / 2 : 0) + (r() - 0.5) * 2.4, cy = j * RH + (r() - 0.5) * 2.4;
      const rad = S * 0.54 + (r() - 0.5) * 1.6, a0 = r() * TAU, sw = TAU * (0.8 + r() * 0.17);
      t.lineWidth = S * 0.15 + r() * 1.2;
      for (const ox of [-TW, 0, TW]) for (const oy of [-TH, 0, TH]) {
        const x = cx + ox, y = cy + oy; if (x < -S || x > TW + S || y < -S || y > TH + S) continue;
        t.beginPath(); t.arc(x, y, rad, a0, a0 + sw); t.stroke();
      }
    }
    p = g.createPattern(c, 'repeat'); tiles.set(col, p); return p;
  }

  const easeBack = (u) => { u = Math.min(1, u); const s = 2.2; return 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2); };

  function makeSeeds() {
    // a jittered grid of small dots over the whole field: the all-over polka dots that remain in silence
    seeds = []; const r = ICON.rng(77), gx = 16, gy = 9;
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++)
      seeds.push({ x: (i + 0.5 + (r() - 0.5) * 0.7) * W / gx + (j % 2 ? W / gx / 2 : 0), y: (j + 0.5 + (r() - 0.5) * 0.7) * H / gy,
        r: 3 + r() * r() * 13, ph: r() * TAU });
  }

  function argmax(a) { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; }

  // The chord's root and mode from the recent pitch classes (decaying), against the major and minor triads.
  function harmony() {
    let best = -1, root = 0, md = mode;
    for (let rt = 0; rt < 12; rt++) {
      const base = pcE[rt] * 1.25 + pcE[(rt + 7) % 12] * 0.8;
      for (const q of [3, 4]) {
        const s = base + pcE[(rt + q) % 12] - 0.25 * pcE[(rt + (q === 3 ? 4 : 3)) % 12];
        if (s > best) { best = s; root = rt; md = q === 4 ? 1 : 0; }
      }
    }
    // no third heard (bare octaves or fifths): keep the mode we had
    if (Math.max(pcE[(root + 3) % 12], pcE[(root + 4) % 12]) < 0.12 * (pcE[root] + 1e-6)) md = mode;
    return { root, md };
  }

  function schemeFor(root, md) {
    const home = bassH.some((v) => v > 0) ? argmax(bassH) : root;
    let d = (((root - home) * 7) % 12 + 12) % 12; if (d > 6) d -= 12;
    const pair = Math.abs(d) <= 1 ? 0 : d > 1 ? 1 : 2;
    return PAIRS[pair][md];
  }

  function spawnColony(x, m, v, dur, cx, cy) {
    const p = Math.max(0, Math.min(1, (m - 24) / 72)), size = x.p('size');
    const vel = 0.55 + 0.45 * Math.min(1, v / 110);
    const R0 = (9 + 92 * Math.pow(1 - p, 1.7)) * vel * size;
    const n = Math.round((8 + 34 * Math.min(1, v / 110)) * (0.55 + 0.45 * Math.min(1, dur / 1.6)) * (0.6 + 0.4 * size));
    const rs = Math.max(3, R0 * 0.26 + 3), c = rs * 2.15;
    const dx = [], dy = [], dr = [], at = [];
    const wild = x.p('wild');
    for (let k = 1; k <= n; k++) {
      const a = k * GA + x.rnd(-0.35, 0.35), dist = R0 + rs * 1.1 + c * Math.sqrt(k) * x.rnd(0.85, 1.15);
      let r = rs * (1 - 0.55 * k / n) * x.rnd(0.65, 1.1);
      const u = x.rnd(); if (u < 0.12 * wild) r *= 1.6 + wild * 0.6; else if (u < 0.35 * wild) r *= 0.45;
      dx.push(Math.cos(a) * dist); dy.push(Math.sin(a) * dist); dr.push(Math.max(1.6, r));
      at.push(0.05 + (k / n) * Math.min(2.4, 0.5 + dur * 1.1));          // held notes keep spreading
    }
    const life = x.p('stay') * (0.75 + 0.5 * Math.min(1, v / 110));
    cols.push({ x: cx, y: cy, R0, n, dx, dy, dr, at, born: time, life, inner: R0 > 30, in: innerDots(x), rv: new Float32Array(n + 1) });
    let total = 0; for (const q of cols) total += q.n + 1;
    for (let i = 0; total > MAXDOTS && i < cols.length - 1; i++) {        // too many: the oldest start to go now
      const q = cols[i]; if (q.born + q.life > time) { q.life = time - q.born; total -= q.n * 0.5; }
    }
  }

  // The big dot's own polka dots, in the ground colour: [x, y, r] as fractions of its radius.
  function innerDots(x) {
    const out = [], m = Math.round(x.rnd(7, 16)), a0 = x.rnd(0, TAU);
    for (let i = 0; i < m; i++) { const a = a0 + i * GA + x.rnd(-0.25, 0.25), d = 0.8 * Math.sqrt((i + 0.6) / m);
      out.push(Math.cos(a) * d, Math.sin(a) * d, x.rnd(0.05, 0.1) * (1.25 - d * 0.5)); }
    return out;
  }

  // Each dot's radius now (0 = not there yet or gone), so a flood can draw the scene twice without redoing it.
  function update(q) {
    const age = time - q.born, end = q.life;
    q.rv[0] = age >= end + 0.75 ? Math.max(0, q.R0 * (1 - (age - end - 0.75) / 0.3)) : q.R0 * (1 + 0.22 * Math.exp(-age / 0.07));
    for (let k = 1; k <= q.n; k++) {
      const a = age - q.at[k - 1]; let r = 0;
      if (a > 0) r = q.dr[k - 1] * easeBack(a / 0.2);
      const out = age - (end + (1 - k / q.n) * 0.7);                       // outermost dots go first
      if (out > 0) r *= Math.max(0, 1 - out / 0.3);
      q.rv[k] = r;
    }
    return age < end + 1.1;
  }

  // Dots are stamped from cached disc sprites (one per colour and size class): one path with hundreds of overlapping
  // circles is very slow for the canvas, a drawImage each is cheap.
  // A collared dot (figure disc inside a ring of the ground colour) is one sprite too, so a dot costs one drawImage.
  const SPR = new Map(), COL = 1.2;
  function disc(g, col, x, y, r, collar) {
    const s = r > 22 ? 256 : r > 5 ? 64 : 16, key = col + (collar || '') + s; let c = SPR.get(key);
    if (!c) { c = document.createElement('canvas'); c.width = c.height = s; const t = c.getContext('2d'), R = s / 2 - 1;
      if (collar) { t.fillStyle = collar; t.beginPath(); t.arc(s / 2, s / 2, R, 0, TAU); t.fill(); }
      t.fillStyle = col; t.beginPath(); t.arc(s / 2, s / 2, collar ? R / COL : R, 0, TAU); t.fill(); SPR.set(key, c); }
    const k = (collar ? r * COL + 0.8 : r) * s / (s - 2); g.drawImage(c, x - k, y - k, 2 * k, 2 * k);
  }

  function drawScene(g, gr, fg, sc) {
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // the all-over seed dots, breathing slowly
    for (const s of seeds) disc(g, fg, s.x, s.y, s.r * (0.75 + 0.25 * Math.sin(breathe + s.ph)));
    // net patches: one clip of their union, filled with the loops
    let any = false; g.save(); g.beginPath();
    for (const p of nets) if (p.rn > 1) { any = true; g.moveTo(p.x + p.rn, p.y); g.arc(p.x, p.y, p.rn, 0, TAU); }
    if (any) {
      g.clip(); const pat = netPattern(g, fg);
      pat.setTransform(new DOMMatrix().translate(W / 2, H / 2).scale(sc).translate(-W / 2, -H / 2));
      g.fillStyle = pat; g.fillRect(0, 0, W, H);
    }
    g.restore();
    // colonies, oldest first: collared dots, then the big dot's own inner dots
    for (const q of cols) {
      const rv = q.rv;
      // outermost first, so the big dot lies on top of its own colony
      for (let k = q.n; k >= 0; k--) { const r = rv[k]; if (r > 0.3) disc(g, fg, q.x + (k ? q.dx[k - 1] : 0), q.y + (k ? q.dy[k - 1] : 0), r, gr); }
      if (q.inner && rv[0] > 6) {
        const R = rv[0];
        for (let i = 0; i < q.in.length; i += 3) disc(g, gr, q.x + q.in[i] * R, q.y + q.in[i + 1] * R, q.in[i + 2] * R);
      }
    }
  }

  TOOLS.push({
    id: 'kusama', name: 'Kusama', tag: 'new', on: false,
    blurb: 'After Yayoi Kusama. One flat colour with dots in its partner colour. Every note starts a colony of dots at its pitch (low left, high right): a big dot on the attack, smaller ones spreading out while the note is held. Full chords lay patches of an infinity net that tightens as the music speeds up. The harmony picks the colours (red/white, yellow/black, blue/white; minor and major swap ground and dots), flooding in from the new chord as one huge dot.',
    params: [
      { key: 'size', label: 'how big the colonies are', min: 0.4, max: 1.8, value: 1, drive: '+level',
        hint: 'How big each note’s colony of dots grows. Left: small clusters. Right: huge dots and wide colonies.',
        icon: (g, v, w, h) => { const R = 2 + v * 6, n = 7; ICON.dot(g, w / 2, h / 2, R, ICON.red);
          for (let k = 1; k <= n; k++) { const a = k * GA, d = R + 2.5 + (1.6 + v * 1.8) * Math.sqrt(k) * 1.5; ICON.dot(g, w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 0.8 + v * 1.1, ICON.red); } } },
      { key: 'stay', label: 'how long the dots stay', min: 1.5, max: 18, value: 6,
        hint: 'How long a colony stays before it shrinks away. Left: a couple of seconds. Right: they pile up for a long time.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.12 + v * 0.88, ICON.red, 'dot') },
      { key: 'tight', label: 'how tight the net is', min: 0, max: 1, value: 0.45, drive: '+rate',
        hint: 'The size of the net’s little loops. Left: big, loose loops. Right: a tight mesh of tiny ones.',
        icon: (g, v, w, h) => { const s = 11 - v * 6.5, rh = s * 0.85; g.lineWidth = Math.max(0.8, s * 0.16);
          for (let j = -1; j * rh < h + s; j++) for (let i = -1; i * s < w + s; i++) {
            g.strokeStyle = ICON.ink; g.beginPath(); g.arc(i * s + (j & 1 ? s / 2 : 0), j * rh, s * 0.54, 0.4, 0.4 + TAU * 0.85); g.stroke(); } } },
      { key: 'wild', label: 'dot sizes: even or wild', min: 0, max: 1, value: 0.5,
        hint: 'How much the dots in a colony differ in size. Left: neat, even rings of dots. Right: big and tiny dots mixed.',
        icon: (g, v, w, h) => { const R = ICON.rng(4); for (let k = 0; k < 9; k++) { const x = 4 + (k % 5) * 8 + (k > 4 ? 4 : 0), y = k > 4 ? 18 : 8;
          const u = R(); ICON.dot(g, x, y, 2.4 * (1 + v * (u < 0.3 ? 1.1 : u < 0.6 ? -0.6 : 0.2)), ICON.ink); } } },
      { key: 'flip', label: 'how often the colours change', min: 0, max: 1, value: 0.5,
        hint: 'How readily a change of harmony floods the screen with a new colour pair. Left: only now and then. Right: at every change of chord.',
        icon: (g, v, w, h) => { const sc = [[RED, CREAM], [YEL, INK], [CREAM, BLUE], [INK, YEL]], n = 1 + Math.round(v * 3), sw = (w - 4) / n;
          for (let i = 0; i < n; i++) { ICON.rect(g, 2 + i * sw, 3, Math.ceil(sw), h - 6, sc[i][0]); ICON.dot(g, 2 + (i + 0.5) * sw, h / 2, Math.min(sw, h) * 0.22, sc[i][1]); } } },
    ],
    reset() {
      cols = []; nets = []; flood = null; cur = PAIRS[0][0]; time = 0; lastChordT = 0; mode = 0; lastFlip = -99;
      pcE = new Float32Array(12); bassH = new Float32Array(12); cand = null; candT = 0; tight = 0.5; kick = 0; breathe = 0;
      makeSeeds();
    },
    onChord(ch, x) {
      const dtc = time - lastChordT; lastChordT = time;
      const kd = Math.exp(-dtc / 0.7), kb = Math.exp(-dtc / 45);
      for (let i = 0; i < 12; i++) { pcE[i] *= kd; bassH[i] *= kb; }
      let lowest = 999, sum = 0;
      for (const n of ch.notes) { const w = n.v / 127; pcE[n.m % 12] += w * (n.m < 52 ? 1.5 : 1); if (n.m < lowest) lowest = n.m; sum += n.m; }
      bassH[lowest % 12] += ch.vel / 127 * (lowest < 55 ? 1.5 : 0.5);

      // the colonies: one per note, a chord on one row
      const y0 = x.rnd(0.14, 0.86) * H, notes = [...ch.notes].sort((a, b) => a.m - b.m).slice(0, 7);
      let fx = 0, fy = 0;
      notes.forEach((n, i) => {
        const p = Math.max(0, Math.min(1, (n.m - 24) / 72)), cx = W * (0.06 + 0.88 * p) + x.rnd(-14, 14), cy = y0 + x.rnd(-30, 30);
        spawnColony(x, n.m, n.v, n.d, cx, cy); if (i === 0) { fx = cx; fy = cy; }
      });
      // full chords lay a patch of net around the chord's middle
      if (ch.notes.length >= 3 || x.feat.density > 0.45) {
        const mp = Math.max(0, Math.min(1, (sum / ch.notes.length - 24) / 72));
        nets.push({ x: W * (0.06 + 0.88 * mp) + x.rnd(-40, 40), y: y0 + x.rnd(-40, 40), R: 70 + 34 * Math.min(8, ch.notes.length) * (0.5 + ch.vel / 127),
          born: time, life: x.p('stay') * 1.2, rn: 0 });
        if (nets.length > 40) nets.shift();
      }
      if (ch.vel > 70) kick = Math.max(kick, (ch.vel - 70) / 57 * 0.16);

      // the harmony: a new colour pair once it has held (or at once on a strong chord), not sooner than the knob allows
      const hm = harmony(), sch = schemeFor(hm.root, hm.md); mode = hm.md;
      if (sch !== cur) {
        if (cand !== sch) { cand = sch; candT = time; }
        const gap = 8 * Math.pow(0.08, x.p('flip')), held = time - candT >= 0.5 || ch.notes.length >= 3 || ch.vel > 95;
        if (held && time - lastFlip >= gap) {
          flood = { x: fx, y: fy, old: cur, start: time, dur: 0.5, rmax: Math.hypot(Math.max(fx, W - fx), Math.max(fy, H - fy)) + 20 };
          cur = sch; lastFlip = time; cand = null;
        }
      } else cand = null;
    },
    frame(x) {
      const g = x.g, dt = x.dt; time += dt; breathe += dt * 1.3;
      cols = cols.filter(update);
      nets = nets.filter((p) => { const a = time - p.born; if (a > p.life + 0.6) return false;
        p.rn = p.R * x.p('size') * (1 - Math.pow(1 - Math.min(1, a / 0.9), 3)) * (a > p.life ? 1 - (a - p.life) / 0.6 : 1); return true; });
      tight += (x.p('tight') - tight) * (1 - Math.exp(-dt / 0.6));
      kick *= Math.exp(-dt / 0.18);
      const sc = 1.7 * Math.pow(0.2, tight) * (1 - kick);
      if (flood && time - flood.start >= flood.dur) flood = null;
      if (!flood) { drawScene(g, cur[0], cur[1], sc); return; }
      drawScene(g, flood.old[0], flood.old[1], sc);
      const u = Math.min(1, (time - flood.start) / flood.dur), r = flood.rmax * (1 - Math.pow(1 - u, 2.2));
      g.save(); g.beginPath(); g.arc(flood.x, flood.y, Math.max(1, r), 0, TAU); g.clip();
      drawScene(g, cur[0], cur[1], sc); g.restore();
    },
  });
})();
