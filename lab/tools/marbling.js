// Marbling v2 (suminagashi): every attack drops ink on a still bath and pushes the older ink outward into bands.
// A drop of radius r at c pushes every existing ink line outward, area-preserving: p' = c + (p - c) * sqrt(1 + r^2 / |p - c|^2).
// Combs: a rake of parallel tines is dragged through the bath (p += u * pull * L / (d + L), d = distance to the nearest
// tine; exact when applied in steps, since the push never changes d). The bass twists it with a vortex.
//
// v2, after "extremely high potential, but it doesn't respond correctly to the sound". v1 sized drops mostly by pitch
// (a soft bass note made a bigger drop than a fff chord) and dropped every chord on the same spot, so each chord wiped
// the bath into one bullseye whatever the music did; its combs came from a hidden counter. Now:
//   - LOUDNESS is SIZE: a chord's drop radius follows its velocity (pp: a bead, fff: a flood); a held note adds a little.
//   - PITCH is COLOUR and HEIGHT: low notes dark, high notes bright; a high chord lands high in the bath, a low one low.
//   - The drop is there ON THE ATTACK FRAME (60% of its area at once, the rest blooms over ~0.2 s), with a brief flash.
//   - PHRASES walk: within a phrase each chord lands a step further along; the step follows the time since the last
//     chord (slow music: big steps, fast: beads on a string). A pause (or a sudden jump to much faster notes) starts a new phrase in a new spot, and the comb turns.
//   - The COMB comes on loud accents, at each new phrase, and every few attacks when the music runs fast; it rakes only
//     the older ink (the fresh drop stays round on top), lasts about two beats, pulls harder for louder chords and has
//     more tines for fuller chords.
//   - A cap on the ink area per chord and per second keeps the climax from wiping the bath clean on every chord.
//   - Below the old floor of "drop size" (0.4) the comb's pull, its tine lines and the strike's halo fade with the drops,
//     so the left end is calm as well as small; from 0.4 up that factor is exactly 1, and every saved value looks as before.
(() => {
  const TAU = Math.PI * 2, CAP = 11000, MAXSEG = 11, MERGE = 1.4, M = 60, FAR = 420, FARSEG = 48;
  const GAP = 0.45, INST = 0.6, LIFE = 16, RMAX = 270;
  // Palettes: ink colour from low pitch (first stop) to high pitch (last stop). 3 = hue by pitch class.
  const PAL = [
    [[66, 4, 9], [128, 12, 16], [196, 52, 36], [240, 226, 204]],    // blood and bone
    [[14, 22, 72], [30, 64, 150], [120, 140, 176], [244, 200, 112]], // indigo and gold
    [[6, 44, 46], [20, 104, 94], [146, 174, 150], [234, 240, 224]],  // verdigris and ash
  ];
  const calm = (x) => Math.min(1, x.p('drop') / 0.4);
  const hex = (c) => '#' + c.map((a) => Math.round(a).toString(16).padStart(2, '0')).join('');
  let rings, grow, strokes, nextId, total, pen, vort, ioi, velMean, lastT, lastAcc, passBack, phraseNo, areaRate, stats, fastGap, slowGap, lastSec;

  function hsl(h, s, l) {
    const f = (n) => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return [f(0), f(8), f(4)];
  }
  // A note's ink: pitch picks the colour along the palette (low dark, high bright); a loud note is a richer, deeper ink.
  function inkColour(pal, m, loud) {
    const pp = Math.max(0, Math.min(1, (m - 33) / 50)), vb = 0.8 + 0.2 * loud;
    let c;
    if (pal >= 3) c = hsl(((m * 7) % 12) * 30, 0.78, 0.2 + 0.52 * pp);          // circle of fifths around the wheel
    else { const st = PAL[pal], t = Math.min(0.999, pp) * (st.length - 1), i = Math.floor(t), f = t - i; c = st[i].map((a, k) => a + (st[i + 1][k] - a) * f); }
    return c.map((a) => a * vb);
  }
  const rgb = (c, k, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;
  const loudOf = (v) => Math.max(0, Math.min(1, (v - 30) / 80)); // velocity 30 → 0, 110 → 1 (both songs' range)

  // --- the three deformations of the bath ---
  function drop(cx, cy, inc, upto) {
    for (const r of rings) {
      if (r.id > upto) break; if (r.bg) continue;
      const xs = r.xs, ys = r.ys;
      for (let i = 0; i < xs.length; i++) {
        const dx = xs[i] - cx, dy = ys[i] - cy, k = Math.sqrt(1 + inc / (dx * dx + dy * dy + 1e-3));
        xs[i] = cx + dx * k; ys[i] = cy + dy * k;
      }
    }
  }
  function rake(s, dz) {
    const L = s.lam, sp = s.sp, wav = s.wave * sp * 0.3;
    for (const r of rings) {
      if (r.id >= s.upto) break; if (r.bg) continue; const xs = r.xs, ys = r.ys;
      for (let i = 0; i < xs.length; i++) {
        const px = xs[i] - s.ox, py = ys[i] - s.oy;
        const dist = px * s.nx + py * s.ny + wav * Math.sin((px * s.ux + py * s.uy) * 0.011);
        const m = ((dist % sp) + sp) % sp, d = Math.min(m, sp - m), z = dz * L / (d + L);
        xs[i] += s.ux * z; ys[i] += s.uy * z;
      }
    }
  }
  function stir(cx, cy, w) {
    const Rv = 260;
    for (const r of rings) {
      if (r.bg) continue; const xs = r.xs, ys = r.ys;
      for (let i = 0; i < xs.length; i++) {
        const dx = xs[i] - cx, dy = ys[i] - cy, th = w * Rv / (Math.sqrt(dx * dx + dy * dy) + Rv), c = Math.cos(th), sn = Math.sin(th);
        xs[i] = cx + dx * c - dy * sn; ys[i] = cy + dx * sn + dy * c;
      }
    }
  }
  // Keep lines smooth where they stretch, thin where they bunch up; find the rings that left the bath.
  function resample(r, W, H) {
    const xs = r.xs, ys = r.ys, n = xs.length, ox = [], oy = [];
    let vis = false;
    for (let i = 0; i < n; i++) {
      const x0 = xs[i], y0 = ys[i], j = (i + 1) % n, x1 = xs[j], y1 = ys[j];
      if (ox.length) { const lx = ox[ox.length - 1] - x0, ly = oy[oy.length - 1] - y0; if (lx * lx + ly * ly < MERGE * MERGE && i < n - 1) continue; }
      ox.push(x0); oy.push(y0);
      // fine segments on screen, coarse ones just off it (a stir can pull them back: they must not come back as straight cuts)
      const near = (m) => Math.max(x0, x1) > -m && Math.min(x0, x1) < W + m && Math.max(y0, y1) > -m && Math.min(y0, y1) < H + m;
      if (!near(FAR)) continue; vis = true;
      const seg = near(M) ? MAXSEG : FARSEG, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
      if (L2 > seg * seg) { const k = Math.min(60, Math.ceil(Math.sqrt(L2) / seg)); for (let s = 1; s < k; s++) { ox.push(x0 + dx * s / k); oy.push(y0 + dy * s / k); } }
    }
    r.xs = ox; r.ys = oy; return vis;
  }
  function inside(r, px, py) {
    let c = false; const xs = r.xs, ys = r.ys;
    for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) if ((ys[i] > py) !== (ys[j] > py) && px < (xs[j] - xs[i]) * (py - ys[i]) / (ys[j] - ys[i]) + xs[i]) c = !c;
    return c;
  }
  // A comb stroke through the ink older than `upto`. It goes back and forth, the return running between the first pass's
  // tines (the classic feathered pattern); after each pair, and at each new phrase, the comb turns.
  function startStroke(x, ch, loud, cb, upto) {
    const ORI = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4], back = passBack;
    const ang = ORI[(phraseNo + pen.pairs) % 4] + x.rnd(-0.08, 0.08), dir = back ? -1 : 1;
    const ux = Math.cos(ang) * dir, uy = Math.sin(ang) * dir, nx = -Math.sin(ang), ny = Math.cos(ang);
    const tines = 4 + Math.min(8, ch.notes.length), ext = Math.abs(x.W * nx) + Math.abs(x.H * ny), sp = ext / tines;
    const off = back ? sp / 2 : x.rnd(0, sp);
    strokes.push({ ox: x.W / 2 + nx * off, oy: x.H / 2 + ny * off, ux, uy, nx, ny, sp, lam: 10 + sp * 0.05, wave: 0.25,
      amt: cb * (60 + 230 * loud) * calm(x), t: 0, dur: Math.max(0.25, Math.min(1.1, 2.2 * ioi)), e: 0, upto, glow: (0.06 + 0.16 * loud) * calm(x) });
    passBack = !passBack; if (!passBack) pen.pairs++; // the next stroke is the return pass; after it the comb turns
  }

  function clear(x) {
    rings = []; grow = []; strokes = []; nextId = 0; total = 0; ioi = 0.6; velMean = 70; lastT = -99; lastAcc = -99;
    passBack = false; phraseNo = 0; areaRate = 0; stats = null; fastGap = 0.5; slowGap = 0.6; lastSec = -99;
    pen = { x: x.W / 2, y: x.H / 2, dir: 1, twist: 1, n: 0, since: 0, pairs: 0 }; vort = { x: x.W / 2, y: x.H / 2 };
  }

  TOOLS.push({
    id: 'marbling', name: 'Marbling', tag: 'v2',
    blurb: 'Every attack drops ink on a still bath and pushes the older ink outward into bands. <b>Louder = a bigger drop</b> (a bead when soft, a flood at fff). <b>Higher = brighter ink, landing higher</b>; low notes are dark and sink low. Within a phrase the drops walk along, a step per chord; a pause, or a sudden rush of faster notes, starts a new phrase elsewhere. <b>The comb comes on loud accents and at each new phrase</b> (more often when the music runs fast) and rakes the older ink into feathers. The bass twists it.',
    params: [
      { key: 'drop', label: 'drop size', min: 0.1, max: 1.8, value: 1,
        hint: 'How big the drops are overall; louder notes always make bigger ones. Left: a few small beads and shreds of ink on black. Right: floods.',
        icon: (g, v, w, h) => { const r = 2.5 + v * 9.5; ICON.dot(g, w / 2, h / 2, r, '#801016'); ICON.dot(g, w / 2, h / 2, r * 0.72, '#000'); ICON.dot(g, w / 2, h / 2, r * 0.55, '#c43424'); ICON.dot(g, w / 2, h / 2, r * 0.28, '#f0e2cc'); } },
      { key: 'combing', label: 'combing', min: 0, max: 1.5, value: 0.6, drive: '+rate',
        hint: 'How often and how hard a comb rakes the ink (on accents, new phrases, and fast runs). Left: never combed; the ink stays in smooth bands. Right: raked into feathers.',
        icon: (g, v, w, h) => {
          const cols = ['#c43424', '#e9e2da', '#801016', '#e9e2da'];
          for (let k = 0; k < 4; k++) {
            g.strokeStyle = cols[k]; g.lineWidth = 1.6; g.beginPath();
            for (let px = 2; px <= w - 2; px++) {
              let d = 0; for (const tx of [9, 20, 31]) d += Math.exp(-Math.abs(px - tx) / 2.2);
              const py = 4.5 + k * 5.6 + v * 6.5 * d - v * 2.5; px === 2 ? g.moveTo(px, py) : g.lineTo(px, py);
            }
            g.stroke();
          }
        } },
      { key: 'twist', label: 'swirl', min: 0, max: 1, value: 0.1, drive: '+bass',
        hint: 'How much the bass twists the ink around the newest drops. Left: still water. Right: a whirlpool.',
        icon: (g, v, w, h) => {
          const cx = w / 2, cy = h / 2, cols = ['#c43424', '#e9e2da', '#801016'];
          for (let k = 0; k < 3; k++) {
            g.strokeStyle = cols[k]; g.lineWidth = 1.6; g.beginPath();
            for (let px = 1; px <= w - 1; px += 1) {
              const dx = px - cx, dy = (k - 1) * 6.5, th = v * 5 * 7 / (Math.hypot(dx, dy) + 7), c = Math.cos(th), s = Math.sin(th);
              const X = cx + dx * c - dy * s, Y = cy + dx * s + dy * c; px === 1 ? g.moveTo(X, Y) : g.lineTo(X, Y);
            }
            g.stroke();
          }
        } },
      { key: 'palette', label: 'colours', min: 0, max: 3, step: 1, value: 0,
        hint: 'The inks, low notes to high. Left: blood and bone; then indigo and gold, verdigris and ash. Right: a rainbow by note.',
        icon: (g, v, w, h) => {
          const p = Math.round(v * 3);
          ICON.palette(g, p >= 3 ? [38, 47, 57, 66, 79].map((m) => hex(inkColour(3, m, 1))) : PAL[p].map(hex), w, h);
        } },
      { key: 'fill', label: 'lines ↔ solid', min: 0, max: 1, value: 0.8,
        hint: 'How the ink is drawn. Left: thin outlines on black. Right: solid bands of colour.',
        icon: (g, v, w, h) => {
          const cols = ['#801016', '#c43424', '#f0e2cc'];
          [11, 7.5, 4].forEach((r, i) => {
            ICON.alpha(g, v, () => ICON.dot(g, w / 2, h / 2, r, cols[i]));
            if (i < 2) ICON.alpha(g, v, () => ICON.ring(g, w / 2, h / 2, r * 0.72, '#000', 1.6));
            ICON.alpha(g, 1 - v * 0.85, () => ICON.ring(g, w / 2, h / 2, r, ICON.lerp(hex(PAL[0][i + 1]), '#ffffff', 0.35), 1.3));
          });
        } },
    ],
    reset(x) { clear(x); },
    /** What the last attack did (for test scripts). */
    stats() {
      if (!stats) return null; const r = rings.find((q) => q.id === stats.topId);
      let rad = 0; if (r && !r.bg) { for (let i = 0; i < r.xs.length; i++) rad += Math.hypot(r.xs[i] - stats.cx, r.ys[i] - stats.cy); rad /= r.xs.length; }
      return { ...stats, radNow: +rad.toFixed(1), rings: rings.length, pts: total, strokes: strokes.length };
    },
    onChord(ch, x) {
      if (!rings) clear(x);
      const t = x.t, gap = t - lastT; lastT = t;
      // a new phrase: a pause (much longer than the recent gaps), or the music suddenly running much faster than it has
      // been (a new section: the Prelude's agitato at ~1:26 and 3:33, several entries in Beethoven)
      const gg = Math.max(0.05, Math.min(1.5, gap)); fastGap += (gg - fastGap) * 0.5; slowGap += (gg - slowGap) * 0.05;
      const section = t - lastSec > 8 && slowGap > 0.3 && fastGap < 0.35 * slowGap; if (section) lastSec = t;
      const phrase = gap > Math.max(0.6, 2.2 * ioi) || section;
      ioi += ((phrase ? Math.min(1.5, gap) : Math.max(0.05, Math.min(1.5, gap))) - ioi) * (phrase ? 0.1 : 0.25);
      const accent = t - lastAcc > 0.35 && ((ch.vel >= velMean + 14 && ch.vel >= 60) || ch.vel >= 100);
      if (accent) lastAcc = t;
      const vm0 = velMean; velMean += (ch.vel - velMean) * 0.12;
      const loud = loudOf(ch.vel), W = x.W, H = x.H, upto = nextId; // ink older than this attack

      // --- where: a phrase walks; a pause starts a new phrase somewhere else ---
      let ns = [...ch.notes].sort((a, b) => a.m - b.m);
      const pm = ns.reduce((a, n) => a + n.m, 0) / ns.length, ty = H * (0.8 - 0.6 * Math.max(0, Math.min(1, (pm - 36) / 48)));
      if (phrase) {
        phraseNo++; pen.twist = -pen.twist; passBack = false;
        let nx0 = pen.x; for (let k = 0; k < 8 && Math.abs(nx0 - pen.x) < W * 0.25; k++) nx0 = x.rnd(W * 0.18, W * 0.82);
        pen.x = nx0; pen.dir = pen.x < W / 2 ? 1 : -1; pen.y = ty; pen.n = 0; pen.pairs = 0;
      } else {
        pen.x += pen.dir * W * 0.075 * Math.max(0.12, Math.min(1.2, gap / 0.7));
        if (pen.x > W * 0.9 || pen.x < W * 0.1) { pen.dir = -pen.dir; pen.x = Math.max(W * 0.1, Math.min(W * 0.9, pen.x)); }
        pen.y += (ty - pen.y) * 0.6; pen.n++;
      }
      const cx = pen.x + x.rnd(-6, 6), cy = pen.y + x.rnd(-6, 6);

      // --- how big: loudness (and a little for fuller chords and held notes), capped per chord and per second ---
      const held = ns.reduce((a, n) => Math.max(a, n.d), 0);
      const rel = Math.max(0, Math.min(1, 0.5 + (ch.vel - vm0) / 40)); // louder than the last few chords: a little bigger still
      let Rc = x.p('drop') * (40 + 220 * Math.pow(loud, 1.6)) * (1 + 0.04 * (Math.min(8, ns.length) - 1)) * (0.75 + 0.25 * Math.min(1, held / 0.8)) * (0.85 + 0.3 * rel);
      Rc = Math.min(RMAX * x.p('drop'), Rc);
      const AMAX = 0.45 * W * H, area = Math.PI * Rc * Rc * (1 + GAP * GAP);
      if (areaRate + area > AMAX) Rc *= Math.max(0.45, Math.sqrt(Math.max(0, AMAX - areaRate) / area));
      areaRate += Math.PI * Rc * Rc * (1 + GAP * GAP);

      // --- the comb: at a new phrase, on an accent, or every few attacks when the music runs on ---
      const cb = x.p('combing'), every = Math.max(3, Math.round(16 - 9 * cb));
      pen.since++;
      let combed = '';
      if (cb > 0.03 && rings.length && (phrase || accent || pen.since >= every)) {
        combed = phrase ? 'phrase' : accent ? 'accent' : 'run';
        startStroke(x, ch, loud, cb, upto); pen.since = 0;
      }

      // --- the drops: low notes first; the high, bright ones land last, in the middle, and push the dark ones into rings ---
      if (ns.length > 6) ns = [0, 1, 2, 3, 4, 5].map((i) => ns[Math.round(i * (ns.length - 1) / 5)]);
      const ws = ns.map((n) => (0.5 + 0.5 * loudOf(n.v)) * (1.3 - 0.6 * x.pitch01(n.m))), wsum = ws.reduce((a, b) => a + b, 0);
      const pal = Math.round(x.p('palette'));
      let topId = 0;
      ns.forEach((n, i) => {
        const R2 = Rc * Rc * ws[i] / wsum, j = Math.min(5, Math.sqrt(R2) * 0.06), px = cx + x.rnd(-j, j), py = cy + x.rnd(-j, j);
        const N = Math.max(24, Math.min(120, Math.round(Math.sqrt(R2) * 0.5))), dur = 0.14 + 0.1 * Math.min(1, n.d);
        const circle = () => { const xs = [], ys = []; for (let k = 0; k < N; k++) { xs.push(px + Math.cos(k / N * TAU) * 0.6); ys.push(py + Math.sin(k / N * TAU) * 0.6); } return [xs, ys]; };
        const add = (col, r2, d) => {
          const [xs, ys] = circle(), ring = { id: nextId++, xs, ys, col, age: 0, fresh: 0, loud };
          rings.push(ring); drop(px, py, r2 * INST, ring.id);   // on the attack frame: most of the drop at once
          grow.push({ cx: px, cy: py, R2: r2, done: r2 * INST, t: 0, dur: d, id: ring.id });
          return ring;
        };
        add(null, R2 * GAP * GAP, dur * 0.6);   // first clear water: the ink pushes it into a black band around itself
        topId = add(inkColour(pal, n.m + (i === ns.length - 1 && ns.length > 1 ? 4 : 0), loudOf(n.v)), R2, dur).id;
      });
      vort.tx = cx; vort.ty = cy;
      stats = { t: +t.toFixed(2), vel: ch.vel, n: ch.notes.length, loud: +loud.toFixed(2), R: Math.round(Rc), phrase, section, accent, combed, cx: Math.round(cx), cy: Math.round(cy), topId,
        targetTop: Math.round(Math.sqrt(Rc * Rc * ws[ws.length - 1] / wsum)) };
    },
    frame(x) {
      if (!rings) clear(x);
      const g = x.g, dt = x.dt, strike = calm(x);
      areaRate *= Math.pow(0.5, dt / 0.7);
      // blooming drops
      for (const d of grow) {
        d.t += dt; const u = Math.min(1, d.t / Math.max(0.001, d.dur)), e = 1 - Math.pow(1 - u, 3), a = Math.max(d.done, d.R2 * (INST + (1 - INST) * e));
        if (a > d.done) { drop(d.cx, d.cy, a - d.done, d.id); d.done = a; }
      }
      grow = grow.filter((d) => d.t < d.dur);
      // combs
      for (const s of strokes) {
        s.t += dt; const u = Math.min(1, s.t / s.dur), e = 1 - Math.pow(1 - u, 2.4);
        if (e > s.e) { rake(s, s.amt * (e - s.e)); s.e = e; }
      }
      // the swirl: a vortex that drifts after the newest drops; each phrase turns the other way
      const sw = x.p('twist');
      if (vort.tx != null) { const kv = 1 - Math.pow(0.5, dt / 0.8); vort.x += (vort.tx - vort.x) * kv; vort.y += (vort.ty - vort.y) * kv; }
      if (sw > 0.005) stir(vort.x, vort.y, sw * dt * 1.6 * pen.twist);
      // tidy: resample, fade, drop what has left the bath or faded.
      // Ink ages with the music: in sparse passages it holds, so a lone oboe line still lands on a marbled bath.
      const age = dt * (0.35 + 1.4 * x.feat.rate); total = 0;
      for (const r of rings) {
        r.age += age; r.fresh += dt; if (r.age > LIFE) { r.dead = true; continue; }
        if (r.bg) continue;
        if (!resample(r, x.W, x.H)) { if (inside(r, x.W / 2, x.H / 2)) { r.bg = true; r.xs = r.ys = null; } else r.dead = true; continue; }
        total += r.xs.length;
      }
      rings = rings.filter((r) => !r.dead);
      // a bath-wide sheet of ink or water hides everything older than it
      const fill = x.p('fill'), cover = (r) => r.bg && (r.col ? fill > 0.9 : fill > 0.6);
      for (let i = rings.length - 1; i > 0; i--) if (cover(rings[i])) { rings.splice(0, i); break; }
      while (total > CAP && rings.length > 1) { const r = rings.shift(); if (!r.bg) total -= r.xs.length; }
      // draw: oldest first, the newer ink sits inside and on top
      const water = Math.min(1, fill * 1.7);
      g.lineJoin = 'round';
      const path = (r) => { const xs = r.xs, ys = r.ys; g.beginPath(); g.moveTo(xs[0], ys[0]); for (let i = 1; i < xs.length; i++) g.lineTo(xs[i], ys[i]); g.closePath(); };
      for (const r of rings) {
        if (!r.col) { // clear water: the black of the bath
          if (water < 0.02) continue; g.fillStyle = `rgba(0,0,0,${water})`;
          if (r.bg) { g.fillRect(0, 0, x.W, x.H); continue; }
          path(r); g.fill(); continue;
        }
        const f = Math.pow(1 - r.age / LIFE, 1.3), fl = Math.max(0, 1 - r.fresh / 0.35), flash = 1 + (0.35 + 0.8 * r.loud) * fl * fl;
        if (r.bg) { g.fillStyle = rgb(r.col, f, fill); g.fillRect(0, 0, x.W, x.H); continue; }
        path(r);
        if (fill > 0.02) { g.fillStyle = rgb(r.col, f * flash, fill); g.fill(); }
        if (fill < 0.98) { g.lineWidth = 1.3 + (1 - fill) * 1.2; g.strokeStyle = rgb(r.col.map((c) => c * 0.7 + 80), (0.25 + 0.75 * f) * flash, 1 - fill * 0.85); g.stroke(); }
        if (fl > 0) { g.lineWidth = 1 + 2.5 * r.loud * fl; g.strokeStyle = `rgba(255,246,230,${(0.15 + 0.5 * r.loud) * fl * strike})`; g.stroke(); } // the strike
      }
      // the tines, glimpsed as they are dragged through
      for (const s of strokes) {
        const al = s.glow * Math.pow(1 - Math.min(1, s.t / s.dur), 2); if (al < 0.01) continue;
        g.strokeStyle = `rgba(236,226,206,${al})`; g.lineWidth = 1;
        const cs = [[0, 0], [x.W, 0], [0, x.H], [x.W, x.H]].map(([a, b]) => (a - s.ox) * s.nx + (b - s.oy) * s.ny);
        const k0 = Math.ceil(Math.min(...cs) / s.sp), k1 = Math.floor(Math.max(...cs) / s.sp);
        g.beginPath();
        for (let k = k0; k <= k1; k++) { const px = s.ox + s.nx * k * s.sp, py = s.oy + s.ny * k * s.sp; g.moveTo(px - s.ux * 2000, py - s.uy * 2000); g.lineTo(px + s.ux * 2000, py + s.uy * 2000); }
        g.stroke();
      }
      strokes = strokes.filter((s) => s.t < s.dur);
    },
  });
})();
