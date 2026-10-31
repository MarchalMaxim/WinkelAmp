// Matisse: the notes cut paper, after his late cut-outs (The Snail, Blue Nudes, Jazz, the Oceania algae). Flat gouache
// shapes, cut with scissors, pinned on a contrasting ground: low notes lay big dark pieces (algae fronds, lumps, slabs),
// middle notes coils, wavy strips and patches of strong colour, high notes small bright stars and confetti. The wall holds
// a fixed number of pieces, so each new note swaps out an old one (it peels off as the new one is laid down, often in its
// place). Chords lift a few pieces, turn them and lay them somewhere else, like paper being moved around the wall; a loud
// deep chord now and then changes the ground itself, a new sheet sliding across. Every frame repaints the whole collage
// (nothing fades): the paper stays put until the music moves it.
(() => {
  const TAU = Math.PI * 2;
  const R = Math.random;
  const RR = (a, b) => a + R() * (b - a);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

  // Matisse's gouache colours
  const C = {
    ultra: '#1e3d9e', black: '#17130f', deep: '#0d5a3b', violet: '#47308a', crimson: '#a01a2b',
    magenta: '#d01f6b', vermilion: '#e5421d', emerald: '#1c9a57', turq: '#139f9b', cobalt: '#2f63c8',
    orange: '#f58b17', lemon: '#f7d51a', white: '#f7f2e6', pink: '#f49cb9', sky: '#73b9ea',
  };
  const LOW = ['black', 'ultra', 'deep', 'violet', 'crimson'];
  const MID = ['magenta', 'vermilion', 'emerald', 'turq', 'cobalt'];
  const HIGH = ['lemon', 'orange', 'white', 'pink', 'sky'];
  // grounds: the white wall first (Blue Nudes), then the Jazz grounds
  const GROUNDS = ['#f3ecdc', '#1e3d9e', '#f7d51a', '#e5421d', '#14814b', '#17130f', '#d01f6b', '#f49cb9', '#f58b17'];
  const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const far = (a, b) => { const p = rgbOf(a), q = rgbOf(b); return Math.hypot((p[0] - q[0]) * 0.9, (p[1] - q[1]) * 1.2, (p[2] - q[2]) * 0.8); };
  // a colour from the register's set that stands out on this ground
  function colourFor(reg, ground, R2 = R) {
    const set = (reg === 0 ? LOW : reg === 1 ? MID : HIGH).map((k) => C[k]);
    const ok = set.filter((c) => far(c, ground) > 120);
    const from = ok.length ? ok : [...set].sort((a, b) => far(b, ground) - far(a, ground)).slice(0, 1);
    return from[Math.floor(R2() * from.length)];
  }

  // ---- the cut shapes: each returns an outline [[x, y], …] around 0,0, about s across (R2 = random 0..1) ----
  // an algae frond: a bending stem with round finger-lobes, alternating left and right and reaching upward
  function algae(s, R2) {
    const k = 2 + Math.floor(R2() * 3), bend = (R2() - 0.5) * 0.8, fat = 0.8 + R2() * 0.45, N = 90;
    const lob = [[], []];
    for (let side = 0; side < 2; side++) for (let j = 0; j < k; j++) {
      const c = 0.12 + ((j + 0.5 * side + 0.25) / (k + 0.5)) * 0.8;
      lob[side].push({ c, a: s * 0.3 * fat * (1 - 0.4 * c) * (0.75 + R2() * 0.4), w: (0.3 / k) * (0.8 + R2() * 0.35) });
    }
    for (let side = 0; side < 2; side++) lob[side].push({ c: 0.9, a: s * 0.07, w: 0.1 });   // a round tip
    const prof = (side, u) => { let b = 0; for (const l of lob[side]) { const q = (u - l.c) / l.w; if (q > -1 && q < 1) b = Math.max(b, l.a * Math.sqrt(1 - q * q)); } return b; };
    const L = [], Rt = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, y = s * (0.5 - u), x = s * bend * 0.3 * Math.sin(u * Math.PI * 0.9);
      const dx = s * bend * 0.3 * Math.cos(u * Math.PI * 0.9) * Math.PI * 0.9, dy = -s, d = Math.hypot(dx, dy);
      const tx = dx / d, ty = dy / d, nx = -ty, ny = tx;
      const w0 = s * 0.04 * (1 - 0.7 * u) + s * 0.012, bl = prof(0, u), br = prof(1, u);
      // a lobe leans up the stem: its tip is pushed along the stem by part of its length
      L.push([x - nx * (w0 + bl) + tx * bl * 0.7, y - ny * (w0 + bl) + ty * bl * 0.7]);
      Rt.push([x + nx * (w0 + br) + tx * br * 0.7, y + ny * (w0 + br) + ty * br * 0.7]);
    }
    return [...L, ...Rt.reverse()];
  }
  // a star as Matisse cut them for Jazz: uneven arms, a little crooked
  function star(s, R2) {
    const n = 5 + Math.floor(R2() * 4), a0 = R2() * TAU, pts = [];
    for (let i = 0; i < 2 * n; i++) {
      const a = a0 + (i * Math.PI) / n + (R2() - 0.5) * 0.3 * (Math.PI / n);
      const r = i % 2 === 0 ? s * 0.5 * (0.7 + R2() * 0.35) : s * 0.5 * (0.28 + R2() * 0.12);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }
  // a coil: a strip of paper wound into a snail
  function coil(s, R2) {
    const th = TAU * (1.25 + R2() * 0.55), dir = R2() < 0.5 ? 1 : -1, N = 64, o = [], inn = [];
    for (let i = 0; i <= N; i++) {
      const f = i / N, a = dir * th * f, ro = s * 0.5 * (0.1 + 0.9 * f), band = s * (0.05 + 0.12 * f), ri = Math.max(0, ro - band);
      o.push([Math.cos(a) * ro, Math.sin(a) * ro]); inn.push([Math.cos(a) * ri, Math.sin(a) * ri]);
    }
    return [...o, ...inn.reverse()];
  }
  // an irregular rectangle, cut freehand: jittered corners, a few facets along each edge
  function patch(s, R2, sq = false) {
    const w = s * (sq ? 0.7 : 0.5 + R2() * 0.5), h = sq ? w * (0.85 + R2() * 0.3) : s * (0.42 + R2() * 0.55), j = s * 0.06;
    const cs = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([a, b]) => [a + (R2() - 0.5) * 2 * j, b + (R2() - 0.5) * 2 * j]);
    const pts = [];
    for (let e = 0; e < 4; e++) {
      const p = cs[e], q = cs[(e + 1) % 4], ex = q[0] - p[0], ey = q[1] - p[1], el = Math.hypot(ex, ey), nx = -ey / el, ny = ex / el;
      for (let i = 0; i < 4; i++) { const f = i / 4, o = i === 0 ? 0 : (R2() - 0.5) * s * 0.022; pts.push([p[0] + ex * f + nx * o, p[1] + ey * f + ny * o]); }
    }
    return pts;
  }
  // a lump, like the Blue Nudes' limbs: a round body pushed out of shape, with one bite cut in
  function lump(s, R2) {
    const a2 = 0.08 + R2() * 0.12, a3 = 0.05 + R2() * 0.1, a5 = R2() * 0.05, p2 = R2() * TAU, p3 = R2() * TAU, p5 = R2() * TAU;
    const bite = R2() * TAU, bw = 0.35 + R2() * 0.25, N = 48, pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      let r = s * 0.4 * (1 + a2 * Math.sin(2 * a + p2) + a3 * Math.sin(3 * a + p3) + a5 * Math.sin(5 * a + p5));
      const db = Math.atan2(Math.sin(a - bite), Math.cos(a - bite));
      if (Math.abs(db) < bw) r *= 1 - 0.45 * Math.pow(Math.cos((db / bw) * Math.PI / 2), 1.5);
      pts.push([Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.9]);
    }
    return pts;
  }
  // a wavy strip, a ribbon cut along a wave
  function strip(s, R2) {
    const cyc = 1 + R2() * 1.2, t = s * (0.16 + R2() * 0.08), amp = s * (0.06 + R2() * 0.05), ph = R2() * TAU, N = 40, top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const f = i / N, x = s * (f - 0.5), y = amp * Math.sin(f * cyc * TAU + ph), th = t * (0.75 + 0.25 * Math.sin(f * Math.PI));
      top.push([x, y - th / 2]); bot.push([x, y + th / 2 + amp * 0.25 * Math.sin(f * cyc * TAU * 2 + ph)]);
    }
    return [...top, ...bot.reverse()];
  }
  const MAKE = { algae, star, coil, patch, lump, strip, square: (s, R2) => patch(s, R2, true) };
  const toPath = (pts) => { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; };

  // which shape a note cuts: curl 0 = straight-cut patches (The Snail), 1 = algae, coils and stars (Oceania, Jazz)
  function kindFor(reg, curl) {
    const curly = R() < curl;
    if (reg === 0) return curly ? (R() < 0.62 ? 'algae' : 'lump') : (R() < 0.8 ? 'patch' : 'lump');
    if (reg === 1) return curly ? pick(['coil', 'algae', 'algae', 'strip', 'lump']) : pick(['patch', 'patch', 'square', 'strip']);
    return curly ? (R() < 0.85 ? 'star' : 'coil') : (R() < 0.6 ? 'square' : 'patch');
  }

  let pieces = [], panels = [], ground = GROUNDS[0], wipe = null, moveCool = 0, groundCool = 0, trimCool = 0;
  const live = () => pieces.filter((p) => p.die == null);

  // a free spot: of a few candidates in the note's band of the wall, the one farthest from the pieces already there
  function spot(x, reg, s) {
    const band = reg === 0 ? [0.3, 0.9] : reg === 1 ? [0.12, 0.88] : [0.06, 0.72];
    let best = null, bs = -Infinity;
    const others = live();
    for (let c = 0; c < 9; c++) {
      const px = RR(x.W * 0.07, x.W * 0.93), py = RR(x.H * band[0], x.H * band[1]);
      let sc = 1e9;
      for (const o of others) sc = Math.min(sc, Math.hypot(o.x - px, o.y - py) - 0.35 * (o.s + s));
      if (sc > bs) { bs = sc; best = [px, py]; }
    }
    return best;
  }

  function cut(x, n, at) {
    const reg = n.m < 50 ? 0 : n.m < 70 ? 1 : 2, vk = 0.62 + 0.45 * Math.min(1, n.v / 110);
    const base = reg === 0 ? Math.min(430, 230 + (50 - n.m) * 8) : reg === 1 ? lerp(165, 100, (n.m - 50) / 20) : Math.max(40, 88 - (n.m - 70) * 1.7);
    // sparse music cuts bigger pieces (each note counts for more), busy music smaller ones
    const busy = lerp(1.3, 0.78, Math.min(1, (x.feat?.rate ?? 0) * 1.6));
    const kind = kindFor(reg, x.p('curl'));
    const s = Math.min(x.H * 0.78, base * vk * busy * x.p('size') * (kind === 'algae' ? 1.15 : kind === 'patch' || kind === 'lump' ? 0.85 : 1));
    const pts = MAKE[kind](s, R);
    let [px, py] = at ? [at[0] + RR(-30, 30), at[1] + RR(-30, 30)] : spot(x, reg, s);
    // keep most of the piece on the wall
    const m = Math.min(s * 0.32, x.H * 0.4);
    px = Math.max(m, Math.min(x.W - m, px)); py = Math.max(m, Math.min(x.H - m, py));
    const rot = kind === 'algae' ? RR(-0.45, 0.45) : kind === 'patch' || kind === 'square' ? RR(-0.18, 0.18) : RR(0, TAU);
    const p = { path: toPath(pts), kind, reg, s, x: px, y: py, rot, col: colourFor(reg, wipe ? wipe.col : ground), age: 0, end: x.t + n.d, d: n.d, grow: 1, mv: null, flip: null, die: null, v: n.v };
    pieces.push(p);
    return p;
  }
  // lift a piece, turn it and lay it down elsewhere (on top of the others, as moved paper is)
  function move(x, p, delay) {
    const [nx, ny] = spot(x, p.reg, p.s);
    const tx = lerp(p.x, nx, 0.55), ty = lerp(p.y, ny, 0.55);
    const turn = (R() < 0.5 ? -1 : 1) * RR(0.35, p.kind === 'algae' ? 0.7 : 1.6);
    p.mv = { u: -delay, x0: p.x, y0: p.y, r0: p.rot, x1: tx, y1: ty, r1: p.kind === 'algae' ? Math.max(-0.7, Math.min(0.7, p.rot + turn)) : p.rot + turn, dur: RR(0.5, 0.75) };
    pieces.splice(pieces.indexOf(p), 1); pieces.push(p);
  }
  // a new ground: a sheet of another colour slides across, with its own large panels (The Snail's frame of patches)
  function newGround(x) {
    const amt = x.p('ground');
    const col = amt < 0.15 ? GROUNDS[0] : pick(GROUNDS.filter((c) => c !== ground && c !== wipe?.col));
    const np = [], k = Math.round(amt * 3.2);
    for (let i = 0; i < k; i++) {
      const s = RR(0.45, 0.85) * x.H, others = GROUNDS.filter((c) => c !== col && far(c, col) > 140);
      const ang = R() * TAU;
      np.push({ path: toPath(patch(s, R)), x: x.W / 2 + Math.cos(ang) * x.W * RR(0.3, 0.45), y: x.H / 2 + Math.sin(ang) * x.H * RR(0.3, 0.5), rot: RR(-0.25, 0.25), col: pick(others) });
    }
    const jag = []; for (let i = 0; i <= 10; i++) jag.push(RR(-1, 1));
    wipe = { col, panels: np, u: 0, dir: Math.floor(R() * 4), jag };
  }
  // the pieces that vanish into a new ground turn over to a colour that shows
  function turnOver(gcol) {
    let d = 0;
    for (const p of live()) if (far(p.col, gcol) < 120) { p.flip = { u: -d, col: colourFor(p.reg, gcol) }; d += 0.04; }
  }

  // ---- knob pictures ----
  const leafIcon = (g, cx, cy, s, col, seed, rot = 0) => { const r = ICON.rng(seed); g.save(); g.translate(cx, cy); g.rotate(rot); g.fillStyle = col; g.fill(toPath(algae(s, r))); g.restore(); };
  const cutIcon = (g, kind, cx, cy, s, col, seed, rot = 0) => { const r = ICON.rng(seed); g.save(); g.translate(cx, cy); g.rotate(rot); g.fillStyle = col; g.fill(toPath(MAKE[kind](s, r))); g.restore(); };
  const ICONS = {
    size(g, v, w, h) { leafIcon(g, w / 2, h / 2, 7 + v * 17, C.cobalt, 4, 0.5); cutIcon(g, 'star', w - 6, 6, 4 + v * 4, C.lemon, 9); },
    pieces(g, v, w, h) {
      const r = ICON.rng(21), cols = [C.cobalt, C.lemon, C.magenta, C.orange, C.emerald, C.white, C.vermilion, C.sky];
      const kinds = ['square', 'star', 'patch', 'star', 'coil', 'square', 'star', 'patch'];
      const n = Math.round(2 + v * 12);
      for (let i = 0; i < 14; i++) { const px = 4 + r() * 32, py = 4 + r() * 18, rot = r() * 3; if (i < n) cutIcon(g, kinds[i % 8], px, py, 7, cols[i % 8], 30 + i, rot); }
    },
    move(g, v, w, h) {
      const A = [[9, 13, 0], [20, 13, 0], [31, 13, 0]], B = [[7, 18, 0.9], [22, 7, -0.6], [33, 17, 1.4]];
      const cols = [C.vermilion, C.lemon, C.cobalt];
      A.forEach((a, i) => { const b = B[i]; cutIcon(g, 'square', lerp(a[0], b[0], v), lerp(a[1], b[1], v), 9, cols[i], 40 + i, lerp(a[2], b[2], v)); });
      if (v > 0.35) ICON.alpha(g, (v - 0.35) / 0.65, () => ICON.arrow(g, 12, 23, 18, 21, ICON.ink, 1.1));
    },
    curl(g, v, w, h) {
      ICON.alpha(g, 1 - v, () => { cutIcon(g, 'patch', 12, 13, 15, C.emerald, 3, 0.1); cutIcon(g, 'square', 29, 13, 12, C.orange, 5, -0.15); });
      ICON.alpha(g, v, () => { leafIcon(g, 12, 13, 22, C.emerald, 7, 0.2); cutIcon(g, 'star', 29, 13, 15, C.lemon, 8); });
    },
    ground(g, v, w, h) {
      ICON.rect(g, 3, 3, w - 6, h - 6, ICON.lerp('#f3ecdc', '#1e3d9e', v));
      ICON.alpha(g, v, () => { ICON.rect(g, 3, 3, 9, h - 6, C.magenta); ICON.rect(g, w - 12, 3, 9, 9, C.lemon); });
      leafIcon(g, w / 2, h / 2, 15, v < 0.5 ? C.cobalt : C.white, 12, 0.3);
    },
  };

  TOOLS.push({
    id: 'matisse', name: 'Matisse', tag: 'new',
    blurb: 'Cut paper, after Matisse\'s late cut-outs. Each note lays a flat piece of gouache paper on the wall: low notes big dark algae, lumps and slabs, middle notes coils, ribbons and patches, high notes small bright stars. The wall only holds so many pieces, so new notes swap old ones out; chords lift a few pieces, turn them and lay them down elsewhere, and a loud deep chord can slide a new coloured ground across.',
    params: [
      { key: 'size', label: 'size of the pieces', min: 0.4, max: 1.8, value: 1,
        hint: 'How big the cut pieces are. Left: small scraps. Right: huge sheets that crowd the wall.',
        icon: ICONS.size },
      { key: 'pieces', label: 'how many pieces on the wall', min: 6, max: 40, step: 1, value: 18, drive: '+rate',
        hint: 'How many pieces the wall holds before new notes swap old ones out. Left: a sparse few. Right: a crowded collage.',
        icon: ICONS.pieces },
      { key: 'move', label: 'how much chords move the paper', min: 0, max: 1, value: 0.45, drive: '+level',
        hint: 'How many pieces a chord lifts, turns and lays down elsewhere. Left: pieces stay where they were laid. Right: every chord rearranges the wall.',
        icon: ICONS.move },
      { key: 'curl', label: 'straight or curly cuts', min: 0, max: 1, value: 0.65,
        hint: 'What the scissors cut. Left: straight-cut squares and patches, like The Snail. Right: curling algae, coils and stars, like Oceania and Jazz.',
        icon: ICONS.curl },
      { key: 'ground', label: 'white wall or coloured grounds', min: 0, max: 1, value: 0.6,
        hint: 'What the paper is pinned on. Left: always a plain white wall. Right: loud deep chords slide in bold coloured grounds with big panels.',
        icon: ICONS.ground },
    ],
    reset() { pieces = []; panels = []; ground = GROUNDS[0]; wipe = null; moveCool = 0; groundCool = 0; trimCool = 0; },
    onChord(ch, x) {
      // a loud, deep chord can change the ground
      if (ch.vel >= 92 && ch.lo < 50 && groundCool <= 0 && !wipe && R() < x.p('ground') * 0.9) { newGround(x); groundCool = 5; }
      else if (x.p('ground') < 0.15 && ground !== GROUNDS[0] && !wipe && ch.vel >= 80) newGround(x);
      // the chord's lowest, highest and (in a full chord) one middle note each cut a piece
      const ns = [...ch.notes].sort((a, b) => a.m - b.m);
      const chosen = [ns[0]];
      if (ns.length > 1) chosen.push(ns[ns.length - 1]);
      if (ns.length >= 4) chosen.push(ns[Math.floor(ns.length / 2)]);
      const cap = Math.round(x.p('pieces'));
      const fresh = [];
      for (const n of chosen) {
        const lv = live();
        let at = null;
        if (lv.length >= cap) {
          // swap: the oldest piece of this register (else the oldest of all) peels off, and the new one goes where it was
          const reg = n.m < 50 ? 0 : n.m < 70 ? 1 : 2, old = lv.slice(0, Math.max(1, Math.ceil(lv.length / 2)));
          const victim = old.find((p) => p.reg === reg) || lv[0];
          victim.die = 0; at = [victim.x, victim.y];
        }
        fresh.push(cut(x, n, at));
      }
      // a chord moves paper: a few of the older pieces are lifted, turned and laid down again
      if (moveCool <= 0 && (ns.length >= 3 || (ns.length >= 2 && ch.vel >= 88))) {
        const mv = x.p('move'), k = Math.round(mv * (1 + ns.length * 0.7) * (0.45 + ch.vel / 127));
        const cand = live().filter((p) => !fresh.includes(p) && !p.mv);
        for (let i = 0; i < k && cand.length; i++) move(x, cand.splice(Math.floor(R() * cand.length), 1)[0], i * 0.05);
        if (k > 0) moveCool = 0.45;
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H;
      moveCool -= dt; groundCool -= dt; trimCool -= dt;
      // fewer pieces allowed now (the knob moved, or the music slowed): the oldest peel off, one at a time
      const lv = live(), cap = Math.round(x.p('pieces'));
      if (lv.length > cap && trimCool <= 0) { lv[0].die = 0; trimCool = 0.18; }

      // the ground and its panels
      g.fillStyle = ground; g.fillRect(0, 0, W, H);
      const panel = (q) => { g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = q.col; g.fill(q.path); g.restore(); };
      for (const q of panels) panel(q);
      if (wipe) {
        wipe.u += dt / 0.5;
        const e = 1 - Math.pow(1 - Math.min(1, wipe.u), 3), d = wipe.dir, horiz = d < 2, span = horiz ? W : H, cross = horiz ? H : W;
        const front = e * (span + 90), J = wipe.jag;
        g.save(); g.beginPath();
        const P = (a, b) => (horiz ? [d === 0 ? a : W - a, b] : [b, d === 2 ? a : H - a]);
        g.moveTo(...P(-10, -10));
        for (let i = 0; i <= 10; i++) g.lineTo(...P(front + J[i] * 40 - 45, (cross * i) / 10));
        g.lineTo(...P(-10, cross + 10)); g.closePath(); g.clip();
        g.fillStyle = wipe.col; g.fillRect(0, 0, W, H);
        for (const q of wipe.panels) panel(q);
        g.restore();
        if (wipe.u >= 1) { ground = wipe.col; panels = wipe.panels; turnOver(ground); wipe = null; }
      }

      // the pieces, in the order they were laid
      for (const p of pieces) {
        p.age += dt;
        let lift = 0, sx = 1, sy = 1;
        if (p.mv) {
          const m = p.mv; m.u += dt / m.dur;
          const u = Math.max(0, Math.min(1, m.u)), e = ease(u);
          p.x = lerp(m.x0, m.x1, e); p.y = lerp(m.y0, m.y1, e) - Math.sin(Math.PI * u) * 14; p.rot = lerp(m.r0, m.r1, e);
          lift = Math.sin(Math.PI * u);
          if (m.u >= 1) { p.y = m.y1; p.mv = null; }
        }
        if (p.flip) {
          const f = p.flip; f.u += dt / 0.4;
          const u = Math.max(0, Math.min(1, f.u)); sx = Math.abs(Math.cos(Math.PI * u)); lift = Math.max(lift, Math.sin(Math.PI * u) * 0.6);
          if (u >= 0.5) p.col = f.col;
          if (f.u >= 1) p.flip = null;
        }
        if (p.die != null) {
          p.die += dt / 0.32;
          const u = Math.min(1, p.die); sx *= 1 - u; sy *= 1 - 0.25 * u; lift = Math.max(lift, Math.sin(Math.PI * 0.5 * u));
        }
        // a long-held note keeps cutting: its piece grows while it sounds (and keeps that size)
        p.grow = 1 + 0.45 * Math.min(1, Math.min(p.age, p.d) / 2.5);
        // laid down on the attack: a touch too big and lifted, settling flat within a tenth of a second
        const land = Math.max(0, 1 - p.age / 0.12), k = 1 + 0.14 * land * land;
        // a piece whose note still sounds stands a little off the wall
        const held = p.end > x.t ? 0.25 : 0;
        lift = Math.max(lift, land, held);
        // its shadow on the wall (always down and to the right), then the paper
        const off = 2.5 + lift * 10, scx = k * p.grow * Math.max(0.02, sx), scy = k * p.grow * sy;
        g.save(); g.translate(p.x + off * 0.8, p.y + off); g.rotate(p.rot); g.scale(scx, scy);
        g.fillStyle = `rgba(20,12,4,${0.14 + 0.08 * lift})`; g.fill(p.path); g.restore();
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(scx, scy);
        g.fillStyle = p.col; g.fill(p.path);
        g.restore();
      }
      pieces = pieces.filter((p) => p.die == null || p.die < 1);
    },
  });
})();
