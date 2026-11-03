// Tree (the user: "a tree like widget ... attacks in the music force a new step in the growth of the tree and its leaves.
// Withering could also be a theme in this. Colors should be a enum of presets."), after their photo of an autumn maple from below.
//
// What the photo is about is light coming THROUGH thousands of small leaves, and a black drawing of branches against it. So
// this is built like the optics: a sky, and on top of it optical depth. Every leaf adds its absorption per colour channel into
// a float buffer (on its own graphics-card canvas, WebGL2); the picture is backlight * exp(-depth). One leaf against the sky is
// a light scarlet, three a pure red, a deep mass a dark wine, in any order and without an edge. Branches black it out, and
// the second tree's gold is its own layer of crisp leaves that do not sink into the red.
//
// The whole life of the tree is worked out once from the notes, known in advance: which attack grows which wood and which
// leaves, when each leaf turns and when it falls. The graphics card gets that list and the song's clock, so a frame costs the
// same late in a dense song as early in a quiet one, a seek lands on exactly the right picture, and all of it is in time:
//   - WOOD and LEAVES appear only on attacks, on the attack's own frame. Silence grows nothing and drops nothing. The first ten
//     attacks build the trunk and the first forks however softly they are played.
//   - An attack ARRIVES: its new leaves land at about twice their size, lit, and settle in a third of a second; its new twigs
//     flare; and the leaves thin for a moment where it fell, so that patch of the crown lets the light through. Between attacks
//     the tree is nearly still.
//   - LOUDNESS is how much: a soft note one or two leaves and a few pixels of twig, a loud chord a whole spray.
//   - PITCH is where: low notes the lower boughs, high notes the crown, and each note keeps its own spot across the tree, so a
//     repeated note deepens one clump until it pushes the older leaves off.
//   - WITHERING is the second half of each season. After the music's climax a blight runs through the tree, limb by limb:
//     leaves turn, and fall on the attacks; late attacks on a dead limb still bud, but what buds soon turns and drops. The sky
//     goes from first light to dusk across each season. A short song is one autumn and ends as a black drawing against the
//     dusk; a long song has several years, a short night between them, each year a little more wood.
(() => {
  const W = 1280, H = 720, TAU = Math.PI * 2;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // Atlas cells: 0, 1, 2 maple leaves, 3 a round leaf, 4 a blossom, 5 a ginkgo fan, 6 a plain pointed leaf, 7 a spark.
  const PRESETS = [
    { name: 'crimson and gold', dawn: ['#8497bc', '#e9d6d6', '#ffcfa8'], day: ['#cfe2f0', '#f8f6f0', '#fff4dc'], dusk: ['#231f56', '#94487f', '#ff9a50'], back: '#fff4e4', duskBack: 0.8, slit: '#ffb040', lawn: '#7fcf4a', fir: ['#08150e', '#3f6a4c'],
      A: ['#ff8a6a', '#b80f2c', '#ee3040', '#d9521a', '#8a4e20'], B: ['#f6ec86', '#f4d030', '#dcb01e', '#b97f26', '#6e5326'], shapeA: [0, 3], shapeB: [3, 1], sizeB: 0.62, scatter: 0.1, shade: 0.11, bark: '#0d0806', moss: '#3a4c28', shoot: '#ee4c1a', flash: '#fff0c0', lim: 4.2 },
    { name: 'cherry blossom', dawn: ['#9aa8d8', '#f4d4dc', '#ffe2cc'], day: ['#6ea8dc', '#c3dff0', '#fff2e2'], dusk: ['#3a3468', '#c07a98', '#ffb488'], back: '#fffaf6', duskBack: 0.8, slit: '#fff0c0', lawn: '#a4dc64', fir: ['#101f1c', '#4c7060'],
      A: ['#ff8fb4', '#ffb4cc', '#ffd2e0', '#efd8c4', '#cbb89c'], B: ['#c8e08a', '#a8c868', '#8fb45a', '#b8a860', '#8a7a4a'], region: 0, shapeA: [4, 1], shapeB: [6, 1], sizeB: 0.9, scatter: 0.12, shade: 0.08, bark: '#1a1214', moss: '#4a4438', shoot: '#e8407a', flash: '#ffffff', lim: 1.7 },
    { name: 'high summer', dawn: ['#a8c4d8', '#f4ecc8', '#ffe8a0'], day: ['#5ea4e4', '#c8e4f2', '#fff6d0'], dusk: ['#2c3c70', '#c88a70', '#ffb040'], back: '#fffce0', duskBack: 0.85, slit: '#fff4b0', lawn: '#8adc40', fir: ['#0a1a10', '#2e6038'],
      A: ['#d8f070', '#5ea824', '#3e8e24', '#c8b238', '#86703a'], B: ['#f4f89a', '#c8e44c', '#b0d83c', '#d0a838', '#8a6a30'], shapeA: [1, 2], shapeB: [6, 1], sizeB: 1.05, scatter: 0.16, shade: 0.1, bark: '#0c0a06', moss: '#4a5a28', shoot: '#8cc41c', flash: '#fbffd0', lim: 4.2 },
    { name: 'ginkgo gold', dawn: ['#7c80ac', '#d4c0cc', '#ffd8b0'], day: ['#8f97bf', '#dad3d8', '#ffe6bc'], dusk: ['#2a2048', '#7a4870', '#ff9c48'], back: '#fff4dc', duskBack: 0.85, slit: '#ffc860', lawn: '#9abc50', fir: ['#10141a', '#3a4238'],
      A: ['#fff098', '#f4c01c', '#efae10', '#c87c14', '#8c6620'], B: ['#fff8c0', '#ffe05a', '#fbe078', '#d8a830', '#8c7028'], region: 0, shapeA: [5, 1], shapeB: [5, 1], sizeB: 1.2, scatter: 0.18, shade: 0.08, bark: '#120c0a', moss: '#4a4428', shoot: '#e88c10', flash: '#fff8d8', lim: 3.6 },
    { name: 'violet dusk', dawn: ['#241c50', '#7c4880', '#ffa070'], day: ['#14143a', '#5c3a7c', '#f4905a'], dusk: ['#08081c', '#2c1c4c', '#b04c48'], back: '#f4c8f0', duskBack: 0.75, slit: '#ff8a40', lawn: '#4a7050', fir: ['#06050e', '#1e1838'],
      A: ['#ffb0e0', '#d832b4', '#8c3cec', '#6048a0', '#282444'], B: ['#ffd8a0', '#ffa050', '#ff7a58', '#a04a50', '#3a2030'], shapeA: [0, 3], shapeB: [3, 1], sizeB: 0.68, scatter: 0.2, shade: 0.09, bark: '#05040a', moss: '#2a2450', shoot: '#ff68cc', flash: '#ffe0f4', lim: 3.4 },
    { name: 'ember night', dawn: ['#0c0608', '#1c0a08', '#501408'], day: ['#030206', '#090406', '#2a0c08'], dusk: ['#020104', '#060304', '#1a0604'], back: '#ffc080', duskBack: 0.85, slit: '#ff5a14', lawn: '#2c3a10', fir: ['#030101', '#140804'],
      A: ['#ffe8a0', '#f06a14', '#d83c0c', '#7c2208', '#280c06'], B: ['#fff6d0', '#ffc850', '#ffa428', '#884810', '#34180a'], shapeA: [0, 3], shapeB: [3, 1], sizeB: 0.62, scatter: 0.24, shade: 0.12, bark: '#020102', moss: '#3a1a0a', shoot: '#ffe8a0', flash: '#fff2c8', lim: 3.2 },
    { name: 'first frost', dawn: ['#34486c', '#8a9cc0', '#f4d0c0'], day: ['#2c3c5c', '#7088a8', '#e8ccb8'], dusk: ['#101838', '#4c4a74', '#d88870'], back: '#f0f6ff', duskBack: 0.8, slit: '#ffd0a0', lawn: '#a8bcb0', fir: ['#0a101c', '#3c4c64'],
      A: ['#ffffff', '#ecf4ff', '#d8e8ff', '#a8b4c8', '#5c6474'], B: ['#fff4e8', '#ffe0c8', '#ffcca8', '#b89884', '#60564e'], region: 0, shapeA: [1, 2], shapeB: [7, 1], sizeB: 0.85, scatter: 0.14, shade: 0.12, bark: '#06080e', moss: '#4c5a70', shoot: '#ffffff', flash: '#ffffff', lim: 3.0 },
  ];

  // ---------------------------------------------------------------- small maths; everything random is seeded by the notes
  const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shortest = (d) => Math.atan2(Math.sin(d), Math.cos(d));
  const vnoise = (seed) => {
    const h = (i, j) => { let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + seed | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    return (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v); return (h(i, j) * (1 - a) + h(i + 1, j) * a) * (1 - b) + (h(i, j + 1) * (1 - a) + h(i + 1, j + 1) * a) * b; };
  };

  // ---------------------------------------------------------------- the tree's drawing
  // Six limbs set by hand from a trunk rising out of the lower corner (the composition of the photo); from there down to the
  // twigs each branch wanders, kinks away from what it forks off, and looks for open sky. Parents always come before children.
  const DS = [13, 10, 8, 6.5, 5.5, 5];
  const KIDS = [0, 13, 9, 7, 4, 0];
  const KINK = [0, 0.13, 0.2, 0.26, 0.3, 0];
  const WIG = [0.012, 0.022, 0.026, 0.03, 0.05, 0.08];
  const ELBOW = [0, 0.1, 0.16, 0.24, 0.3, 0.3];                   // bends with no fork in them
  const ELBOW_AT = [1e9, 90, 46, 26, 16, 10];
  const LAYOUTS = [
    // As in the photo: from the corner across the picture, a leader going up, a long low limb sweeping over the lane.
    { base: [1262, 800], top: [770, 345], lean: 0.1, limbs: [
      [0.34, 240, 585, -172, 980, 0.03], [0.58, -60, 345, -166, 1120, 0.024], [0.8, 250, -60, -142, 800], [1, 640, -80, -100, 520], [0.94, 1040, -70, -62, 640], [0.5, 1320, 90, -58, 620] ] },
    // Steeper: the trunk further in, one great arm reaching out level.
    { base: [1080, 800], top: [760, 400], lean: 0.08, limbs: [
      [0.5, 170, 555, -170, 860, 0.026], [0.74, -40, 215, -158, 1000, 0.028], [1, 430, -60, -120, 640], [1, 780, -80, -92, 520], [0.88, 1190, -40, -48, 660], [0.42, 1340, 330, -40, 480] ] },
    // Low fork: two leaders on the same diagonal, the crown wide.
    { base: [1215, 800], top: [860, 470], lean: 0.12, limbs: [
      [0.62, 210, 610, -170, 880, 0.03], [1, 40, 250, -158, 1000, 0.026], [1, 470, -70, -128, 760], [0.9, 870, -80, -94, 640], [0.8, 1250, -30, -58, 560], [0.5, 1340, 220, -46, 420] ] },
  ];
  function buildWood(rng, twigs, flip, seed) {
    const fx = (x) => (flip ? W - x : x);
    const gap = vnoise(seed + 11), GC = 24, GW = 66, GH = 42, occ = new Float32Array(GW * GH);
    const cellOf = (x, y) => { const c = Math.floor((x + 120) / GC), r = Math.floor((y + 120) / GC); return c < 0 || r < 0 || c >= GW || r >= GH ? -1 : r * GW + c; };
    const occAt = (x, y) => { const i = cellOf(x, y); return i < 0 ? 99 : occ[i]; };
    const br = [], queue = [];
    const LY = LAYOUTS[seed % LAYOUTS.length], baseX = fx(LY.base[0]), baseY = LY.base[1], cx = fx(LY.top[0] - 30), cy = LY.top[1] + 120;
    function grow(q) {
      const { order } = q, ds = DS[order], n = Math.max(2, Math.round(q.len / ds)), xs = [q.x], ys = [q.y];
      const b = { xs, ys, order, parent: q.parent, at: q.at, kids: [], limb: q.limb ?? -1, grown: 0, sites: [], len: 0, id: br.length, bornP: [] };
      br.push(b);
      if (q.parent) q.parent.kids.push(b);
      if (b.limb < 0) b.limb = b.id;
      let a = q.ang, c = 0, x = q.x, y = q.y, side = rng() < 0.5 ? 1 : -1, elbow = ELBOW_AT[order] * (0.5 + rng()), run = 0;
      const kidN = order >= 5 ? 0 : Math.round(KIDS[order] * (order >= 3 ? twigs : Math.min(1.2, 0.6 + twigs * 0.4)) * (0.8 + 0.4 * rng()));
      const pend = [], firstAt = order === 1 ? 0.1 : 0.14;
      let nextKid = kidN > 0 ? firstAt + rng() * 0.08 : 2, kidStep = kidN > 0 ? (1 - firstAt) / kidN : 1;
      for (let i = 1; i <= n; i++) {
        const f = i / n;
        if (q.tx !== undefined && Math.hypot(q.tx - x, q.ty - y) > 170) { const st = q.steer ?? 0.04; a += shortest(Math.atan2(q.ty - y, q.tx - x) - a) * st * (0.5 + f); }
        c = c * 0.8 + (rng() - 0.5) * WIG[order]; a += c;
        if (order >= 2) {
          // Outward from the middle of the crown; the small wood lies flatter, in tiers, and its ends hang a little.
          const out = Math.atan2(y - cy, x - cx), flat = Math.cos(a) >= 0 ? 0.12 : Math.PI - 0.12;
          a += shortest((order >= 4 ? flat : out) - a) * (order >= 4 ? 0.012 + 0.03 * f * f : 0.012);
          if (occAt(x + Math.cos(a) * 26, y + Math.sin(a) * 26) > 9) {
            const l = occAt(x + Math.cos(a - 0.7) * 30, y + Math.sin(a - 0.7) * 30), r = occAt(x + Math.cos(a + 0.7) * 30, y + Math.sin(a + 0.7) * 30);
            a += (l < r ? -1 : 1) * 0.1;
          }
        }
        run += ds;
        if (run > elbow && order >= 1) { a += (rng() < 0.5 ? -1 : 1) * ELBOW[order] * (0.5 + rng()); run = 0; elbow = ELBOW_AT[order] * (0.5 + rng()); }
        if (f >= nextKid && i < n) {
          nextKid += kidStep * (0.7 + 0.6 * rng()); side = -side * (rng() < 0.85 ? 1 : -1);
          pend.push({ i, side, a, f });
          a -= side * KINK[order] * (0.6 + 0.8 * rng());             // the parent bends away from what it forks off: the angular line of real wood
        }
        x += Math.cos(a) * ds * (0.8 + 0.4 * rng()); y += Math.sin(a) * ds * (0.8 + 0.4 * rng());
        if (x < -90 || x > W + 90 || y < -90 || y > H + 90) break;
        if (order >= 2 && y > 480 && Math.abs(x - fx(505)) < 30 + (y - 480) * 0.5) break;
        xs.push(x); ys.push(y);
        const ci = cellOf(x, y); if (ci >= 0) occ[ci] += order >= 3 ? 1 : 0.4;
      }
      b.len = (xs.length - 1) * ds;
      // The end of a branch forks too, or it would end as a whip.
      if (order >= 1 && order <= 3 && xs.length > 3) {
        const m = xs.length - 1, ea = Math.atan2(ys[m] - ys[m - 1], xs[m] - xs[m - 1]);
        pend.push({ i: m, side: 1, a: ea - 0.28, f: 1, end: true }, { i: m, side: -1, a: ea + 0.28, f: 1, end: true });
      }
      for (const p of pend) {
        if (p.i >= xs.length) continue;
        const nextOrder = order + 1, px = xs[p.i], py = ys[p.i];
        const spread = p.end ? 0.28 : [0, 0.72, 0.72, 0.8, 0.86, 0][order] * (0.7 + 0.6 * rng()), ang = p.a + p.side * spread;
        const taper = p.end ? 0.45 : 1 - 0.5 * p.f, base = order === 1 ? q.len * 0.34 : b.len * [0, 0, 0.56, 0.5, 0.48, 0][order];
        const len = Math.max(10, base * taper * (0.65 + 0.7 * rng()));
        // Sky has to stay: some places get no small wood, and a full place no more.
        const ax = px + Math.cos(ang) * len * 0.5, ay = py + Math.sin(ang) * len * 0.5;
        if (nextOrder >= 3) {
          if (gap(ax / 150, ay / 150) < 0.2 + 0.02 * nextOrder && rng() < 0.85) continue;
          if (occAt(ax, ay) > 9 + 3 * (5 - nextOrder) && rng() < 0.85) continue;
          // The narrow bright gap low in the picture, where the light comes from.
          if (ay > 470 && Math.abs(ax - fx(505)) < 40 + (ay - 470) * 0.42 && rng() < 0.92) continue;
        }
        queue.push({ x: px, y: py, ang, len, order: nextOrder, parent: b, at: p.i, limb: order >= 2 ? b.limb : -1 });
      }
      return b;
    }
    // The trunk on its long diagonal from the low corner, the limbs sweeping across to the far side.
    const L = LAYOUTS[seed % LAYOUTS.length], jit = (v, a) => v + (rng() - 0.5) * a;
    const top = [jit(L.top[0], 50), jit(L.top[1], 40)], base0 = Math.atan2(top[1] - L.base[1], top[0] - L.base[0]) + L.lean;
    const trunk = grow({ x: fx(L.base[0]), y: L.base[1], ang: flip ? Math.PI - base0 : base0, len: Math.hypot(top[0] - L.base[0], top[1] - L.base[1]) * 1.04, order: 0, tx: fx(top[0]), ty: top[1], steer: 0.05 });
    const T = (f) => Math.min(trunk.xs.length - 1, Math.round(f * (trunk.xs.length - 1)));
    const d = (deg) => deg * Math.PI / 180;
    for (const [f, tx, ty, deg, len, steer] of L.limbs) queue.push({ x: trunk.xs[T(f)], y: trunk.ys[T(f)], ang: flip ? -Math.PI - d(deg) : d(deg), len: jit(len, 80), order: 1, parent: trunk, at: T(f), tx: fx(jit(tx, 70)), ty: jit(ty, 60), steer: steer ?? 0.035 });
    for (let i = 0; i < queue.length; i++) grow(queue[i]);
    return { br, baseX, baseY };
  }

  // Where leaves can sit: along the small wood, thick at the ends of the sprays.
  function buildSites(wood, rng, seed, flip) {
    const sx = [], sy = [], srot = [], ssz = [], ssp = [], slimb = [], shue = [];
    const field = vnoise(seed + 77), tint = vnoise(seed + 5);
    const add = (b, i, x, y, rot, big) => {
      const fn = 0.6 * field(x / 120, y / 120) + ((flip ? W - x : x) / W - 0.5) * 1.1 - (y / H - 0.5) * 0.9;
      const sp = rng() < 0.78 * smooth(0.76, 1.02, fn) ? 2 : rng() < 0.03 ? 1 : 0;
      sx.push(x); sy.push(y); srot.push(rot); ssz.push(big); ssp.push(sp); slimb.push(b.limb); shue.push(clamp(0.7 * tint(x / 210, y / 170) * 1.9 + 0.3 * tint(x / 60 + 7, y / 60) * 1.9 - 0.45 + (rng() - 0.5) * 0.3, 0, 1));
      b.sites.push(i, sx.length - 1);
    };
    for (const b of wood.br) {
      if (b.order < 1 || b.xs.length < 2) continue;
      const step = [0, 8, 5, 3.5, 2, 1.4][b.order], n = b.xs.length - 1, spreadOff = [0, 26, 20, 14, 14, 14][b.order];
      for (let i = 1; i < n + 1; i++) {
        if ((i % Math.max(1, Math.round(step))) !== 0 && rng() > 0.2) continue;
        const a = Math.atan2(b.ys[i] - b.ys[i - 1], b.xs[i] - b.xs[i - 1]), s = rng() < 0.5 ? 1 : -1, off = 3 + rng() * spreadOff;
        const x = b.xs[i] + Math.cos(a + s * 1.57) * off, y = b.ys[i] + Math.sin(a + s * 1.57) * off;
        add(b, i, x, y, a + s * (0.5 + rng() * 0.9) + 0.3, Math.exp((rng() - 0.5) * 0.7));
      }
      if (!b.kids.length || b.order >= 4) {
        const k = 2 + Math.floor(rng() * 3), a = Math.atan2(b.ys[n] - b.ys[n - 1], b.xs[n] - b.xs[n - 1]);
        for (let j = 0; j < k; j++) {
          const q = a + (rng() - 0.5) * 2.2, off = 3 + rng() * 12;
          add(b, n, b.xs[n] + Math.cos(q) * off, b.ys[n] + Math.sin(q) * off, q + (rng() - 0.5) * 0.5, Math.exp((rng() - 0.4) * 0.7));
        }
      }
    }
    return { sx, sy, srot, ssz, ssp, slimb, shue, n: sx.length };
  }

  // ---------------------------------------------------------------- the life of the tree, from the notes
  const hashNotes = (N) => { let h = 2166136261; for (let i = 0; i < N.length; i += Math.max(1, N.length >> 8)) { h = Math.imul(h ^ Math.round(N[i][2]), 16777619); h = Math.imul(h ^ Math.round(N[i][0] * 50), 16777619); } return (h ^ N.length) >>> 0; };
  function chordsFrom(N) {
    if (typeof CHORDS !== 'undefined' && CHORDS.length) return CHORDS;
    const out = [];
    for (const [s, e, m, v] of N) { const l = out[out.length - 1]; if (l && s - l.t < 0.04) { l.notes.push({ m, v, d: e - s }); l.vel = Math.max(l.vel, v); } else out.push({ t: s, notes: [{ m, v, d: e - s }], vel: v }); }
    return out;
  }
  function makePlan(N, K) {
    const seed = hashNotes(N), rng = rngOf(seed), flip = !!(seed & 64);
    const wood = buildWood(rng, K.twigs, flip, seed), br = wood.br, sites = buildSites(wood, rng, seed, flip);
    const ch = chordsFrom(N), nc = ch.length;
    const dur = nc ? Math.max(ch[nc - 1].t, 1) : 1, T = new Float64Array(nc);
    // Loudness as this recording goes, and pitch as this recording's own range.
    const vs = N.map((n) => n[3]).sort((a, b) => a - b), v5 = vs[Math.floor(vs.length * 0.05)] ?? 30, v95 = vs[Math.floor(vs.length * 0.95)] ?? 100;
    const pc = new Float32Array(129); for (const n of N) pc[clamp(Math.round(n[2]), 0, 127) + 1]++;
    for (let i = 1; i < 129; i++) pc[i] += pc[i - 1];
    const pitchQ = (m) => { const k = clamp(Math.round(m), 0, 127); return (pc[k] + pc[k + 1]) * 0.5 / Math.max(1, N.length); };
    const eOf = new Float32Array(nc), Ecum = new Float64Array(nc + 1);
    for (let i = 0; i < nc; i++) {
      T[i] = ch[i].t;
      const q = clamp((ch[i].vel - v5) / Math.max(5, v95 - v5), 0.04, 1);
      eOf[i] = Math.min(1, Math.pow(q, 1.5) * (1 + 0.14 * Math.min(4, ch[i].notes.length - 1)));
      Ecum[i + 1] = Ecum[i] + eOf[i];
    }
    const Etotal = Math.max(1e-3, Ecum[nc]), eAvg = Etotal / Math.max(1, nc);
    const chordAfter = (t) => { let a = 0, b = nc; while (a < b) { const k = (a + b) >> 1; if (T[k] < t) a = k + 1; else b = k; } return a; };

    // Each note has a spot: its height by its rank in this recording, its place across by a golden-ratio walk over the notes.
    const order = new Int32Array(sites.n).map((_, i) => i).sort((a, b) => sites.sy[b] - sites.sy[a]);    // bottom of the picture first
    const BANDS = 20, bandX = [], band = (q) => clamp(Math.floor(q * BANDS), 0, BANDS - 1);
    for (let b = 0; b < BANDS; b++) { const from = Math.floor(b / BANDS * sites.n), to = Math.floor((b + 1) / BANDS * sites.n), xs = []; for (let i = from; i < to; i++) xs.push(sites.sx[order[i]]); xs.sort((p, q) => p - q); bandX.push(xs); }
    const spotOf = (m) => {
      const q = pitchQ(m), k = Math.min(sites.n - 1, Math.floor(q * sites.n)), y = sites.n ? sites.sy[order[k]] : H / 2, xs = bandX[band(q)];
      const fr = (m * 0.6180339887) % 1, xx = xs.length ? xs[Math.floor(fr * xs.length)] : W / 2;
      return [xx, y];
    };

    // The years: a season, its climax, then the blight.
    const wK = K.wither, nYears = wK <= 0 ? 1 : Math.max(1, Math.round(dur * Math.max(0.5, wK) / 400));
    const years = [];
    for (let y = 0; y < nYears; y++) {
      const a = dur * y / nYears, b = dur * (y + 1) / nYears, len = b - a;
      // The blight starts at the loudest ten seconds of the middle of the year.
      let best = a + len * 0.58, bestE = -1;
      const from = a + len * (wK >= 1.5 ? 0.3 : 0.45), to = a + len * (wK >= 1.5 ? 0.55 : 0.72);
      for (let t = from; t < to; t += Math.max(2, len / 60)) {
        const i0 = chordAfter(t - 5), i1 = chordAfter(t + 5), e = (Ecum[i1] - Ecum[i0]);
        if (e > bestE) { bestE = e; best = t; }
      }
      const r = rngOf(seed + 91 + y * 7), ax = r() * TAU;
      years.push({ a, b, len, start: wK <= 0 ? 1e9 : best + 2, dx: Math.cos(ax), dy: Math.sin(ax), last: y === nYears - 1, salt: Math.floor(r() * 1e6) });
    }
    const yearAt = (t) => years[clamp(Math.floor(t / dur * nYears), 0, nYears - 1)];
    // When the blight reaches a place: limb by limb along a line through the tree.
    const limbSalt = (limb, y) => ((limb * 2654435761 + y.salt) >>> 0) / 4294967296;
    const blightAt = (s, y) => {
      if (y.start > 1e8) return 1e9;
      const along = 0.5 + 0.5 * (((sites.sx[s] - W / 2) / (W * 0.6)) * y.dx + ((sites.sy[s] - H / 2) / (H * 0.6)) * y.dy);
      const k = clamp(0.55 * along + 0.45 * limbSalt(sites.slimb[s], y), 0, 1);
      return y.start + k * (y.b - y.start) * (y.last ? 1.08 : 0.98);
    };

    // Leaf pools, per cell of the picture. A noisy cap on each cell is what keeps sky in the canopy to the end.
    const CS = 28, CW = Math.ceil((W + 240) / CS), CH = Math.ceil((H + 240) / CS), capN = vnoise(seed + 303);
    const cells = new Array(CW * CH).fill(null), openCells = [];
    const cellIdx = (x, y) => { const c = Math.floor((x + 120) / CS), r = Math.floor((y + 120) / CS); return c < 0 || r < 0 || c >= CW || r >= CH ? -1 : r * CW + c; };
    const cellAt = (i) => {
      let c = cells[i];
      if (!c) {
        const r = Math.floor(i / CW), q = i - r * CW, n = 0.68 * capN(q * CS / 130, r * CS / 130) + 0.32 * capN(q * CS / 44 + 50, r * CS / 44);
        c = cells[i] = { free: [], live: [], cap: Math.max(1, Math.round((1.5 + 15 * smooth(0.26, 0.72, n)) * K.leaves)) };
      }
      return c;
    };
    const siteCell = new Int32Array(sites.n);
    for (let s = 0; s < sites.n; s++) siteCell[s] = cellIdx(sites.sx[s], sites.sy[s]);

    // --- walking through the attacks
    const hitX = new Float32Array(nc), hitY = new Float32Array(nc);
    let hitSet = false;
    const L = [], STR = 12;                       // leaf instances, 12 numbers each
    const dieAt = new Int32Array(nc + 2), leafEnd = new Int32Array(nc), chordP = new Float32Array(nc);
    const segs = [];                              // [branch, index, birth, P at birth]
    let totalLen = 0; for (const b of br) totalLen += b.len;
    // How much of the wood should stand by now: most of it in the first year (fast at first, so a piece's opening shows), and each
    // later year a little more, on that year's own loudness. The end of the piece is the end of the wood.
    const woodShare = (y) => (nYears === 1 ? 1 : y === 0 ? 0.7 : 0.3 / (nYears - 1));
    const woodBy = (t, cumE) => {
      const yi = clamp(Math.floor(t / dur * nYears), 0, nYears - 1), y = years[yi];
      let done = 0; for (let i = 0; i < yi; i++) done += woodShare(i);
      const e0 = Ecum[chordAfter(y.a)], e1 = Ecum[yi === nYears - 1 ? nc : chordAfter(y.b)], u = clamp((cumE - e0) / Math.max(1e-3, e1 - e0), 0, 1), k = yi === 0 ? 0.4 : 0.55;
      return done + woodShare(yi) * (1 - Math.exp(-u / k)) / (1 - Math.exp(-1 / k));
    };
    const target = 17000 * K.leaves;
    const OPEN = 10, openStep = (br[0].len + 6 * 70) / OPEN;
    let bornLen = 0, alive = 0, woodDone = -1;
    const frontier = [br[0]]; br[0].inF = true;
    const open = (b) => { if (!b.inF) { b.inF = true; frontier.push(b); } };
    const close = (i) => { const l = frontier.pop(); if (i < frontier.length) frontier[i] = l; };
    const startFall = (leaf, t, idx) => {       // a leaf's fall moves up to attack idx
      const o = leaf * STR, old = L[o + 6];
      if (old <= t) return;
      if (L[o + 11] >= 0 && L[o + 11] < nc) dieAt[L[o + 11]]--; else alive++;   // alive-- below balances
      L[o + 6] = t; L[o + 11] = idx; alive--;
      if (L[o + 5] > t - 0.2) L[o + 5] = t - 0.2;
    };

    function placeLeaf(s, t, ci, e) {
      const c = cellAt(siteCell[s]), y = yearAt(t), bt = blightAt(s, y), P = y.len, l = L.length / STR;
      let fall, turn;
      const j = rng();
      if (t >= bt) { fall = t + 1.4 + j * 5; turn = t + 0.25; }                    // on a dead limb: a bud that hardly opens
      else {
        const life = (0.42 + 0.8 * j) * P * (wK <= 0 ? 3 : 1 / Math.max(0.55, Math.min(1.6, wK)));
        fall = Math.min(t + life, bt + (rng() - 0.3) * Math.min(14, P * 0.03));
        const lead = clamp(P * 0.11, 5, 38) * (0.55 + 0.9 * rng());
        turn = Math.max(t + Math.min(2.5, P * 0.03), fall - lead);
      }
      const idx = chordAfter(fall);
      let fIdx = -1;
      if (idx < nc) { fall = T[idx]; fIdx = idx; dieAt[idx]++; } else fall = 1e7;   // no attack left to shake it down: it stays
      alive++;
      const sz = sites.ssz[s], sp = sites.ssp[s];
      //     x, y, rot, size, birth, turn, fall, gone (filled in at the end), seed + loudness, hue, kind, which attack it falls on
      L.push(sites.sx[s], sites.sy[s], sites.srot[s], sz, t, turn, fall, 0, rng(), sites.shue[s], sp + 0.999 * rng(), fIdx);
      c.live.push(l, s);
      if (!hitSet) { hitSet = true; hitX[ci] = sites.sx[s]; hitY[ci] = sites.sy[s]; }
      // The flash's strength travels with the seed: whole part seed, fraction loudness.
      L[l * STR + 8] = Math.floor(rng() * 1000) + e * 0.999;
    }
    function tidy(c, t) {
      const lv = c.live; let w = 0;
      for (let i = 0; i < lv.length; i += 2) {
        if (L[lv[i] * STR + 6] <= t) c.free.push(lv[i + 1]);
        else { lv[w++] = lv[i]; lv[w++] = lv[i + 1]; }
      }
      lv.length = w;
    }
    function leavesAt(tx, ty, count, R, t, ci, e) {
      const y0Len = yearAt(t).len;
      let made = 0, tries = 0, r = R;
      while (made < count && tries < count * 7 + 14) {
        tries++;
        if (tries % 8 === 0) r *= 1.5;
        const a = rng() * TAU, d = r * Math.sqrt(-2 * Math.log(1 - rng() * 0.999)) * 0.7, i = cellIdx(tx + Math.cos(a) * d, ty + Math.sin(a) * d);
        if (i < 0 || !cells[i]) continue;
        const c = cells[i]; tidy(c, t);
        if (c.live.length / 2 >= c.cap && c.live.length) {
          // Full here: this attack pushes the oldest leaf off, if it has had its time.
          const old = c.live[0];
          if (t - L[old * STR + 4] > Math.max(5, y0Len * 0.22)) { startFall(old, t, ci); tidy(c, t + 1e-4); } else continue;
        }
        if (!c.free.length) continue;
        const k = Math.floor(rng() * c.free.length);
        for (let run = 2 + Math.floor(rng() * 5); run > 0 && made < count && k < c.free.length && c.live.length / 2 < c.cap; run--) {
          const s = c.free.splice(k, 1)[0];
          placeLeaf(s, t, ci, e); made++;
        }
      }
    }

    let cum = 0;
    for (let ci = 0; ci < nc; ci++) {
      const c = ch[ci], t = T[ci], e = eOf[ci];
      alive -= dieAt[ci];
      cum += e;
      const notes = c.notes.length > 6 ? c.notes.slice().sort((a, b) => b.v - a.v).slice(0, 6) : c.notes;
      hitSet = false;
      if (notes.length) { const [hx, hy] = spotOf(notes[0].m); hitX[ci] = hx; hitY[ci] = hy; }
      // WOOD: what this much loudness has earned, spent near each note's spot; the big limbs come first.
      const owed = totalLen * woodBy(t, cum) - bornLen;
      const keepUp = (totalLen - bornLen) / Math.max(1, nc - ci) * (e / Math.max(0.05, eAvg));   // however soft, its share of what is left
      let pool = clamp(owed, Math.min(keepUp, 6 + 34 * e), Math.max(keepUp, (80 + 560 * e) * (1 + 2.5 * Math.exp(-ci / 30))));
      if (ci < OPEN) pool = Math.max(pool, openStep + (ci === 0 ? 340 : 0));
      let notesLeft = notes.length;
      for (const n of notes) {
        if (pool <= 0) break;                                             // a soft chord: a step at its first note, not a step at each
        const [tx, ty] = spotOf(n.m), had = bornLen;
        let left = pool / notesLeft--, guard = 0, stagger = 0;
        while (left > 0 && frontier.length && guard++ < 14) {
          let bi = -1, bs = 1e12;
          const tries = Math.min(frontier.length, 48);
          for (let q = 0; q < tries; q++) {
            const k = frontier.length <= 48 ? q : Math.floor(rng() * frontier.length), f = frontier[k], g = f.xs.length - 1;
            const dd = Math.hypot(f.xs[Math.min(g, f.grown)] - tx, f.ys[Math.min(g, f.grown)] - ty), sc = dd * 0.5 + f.order * 45 + rng() * 70 - (f.grown > 0 ? 70 : 0) - (f.order === 0 && ci < OPEN ? 1e6 : 0);
            if (sc < bs) { bs = sc; bi = k; }
          }
          const b = frontier[bi], n1 = b.xs.length - 1;
          while (left > 0 && b.grown < n1) {
            const i = b.grown++, dl = Math.hypot(b.xs[i + 1] - b.xs[i], b.ys[i + 1] - b.ys[i]);
            segs.push(b, i, t + Math.min(0.13, stagger), ci);
            if (!hitSet) { hitX[ci] = b.xs[i + 1]; hitY[ci] = b.ys[i + 1]; }
            b.bornP[i] = ci;
            stagger += 0.006; left -= dl; bornLen += dl;
          }
          // What this growth opened up: forks, and places for leaves.
          for (const k of b.kids) if (k.at <= b.grown && k.xs.length > 1) open(k);
          const st = b.sites;
          let sp = b.sp ?? 0;
          while (sp < st.length && st[sp] <= b.grown) { const s = st[sp + 1], i = siteCell[s]; if (i >= 0) { const cc = cellAt(i); if (!cc.listed) { cc.listed = true; openCells.push(i); } cc.free.push(s); } sp += 2; }
          b.sp = sp;
          if (b.grown >= n1) close(bi);
        }
        pool -= bornLen - had;
      }
      if (!frontier.length && woodDone < 0) woodDone = t;
      chordP[ci] = bornLen / Math.max(1, totalLen);

      // LEAVES: as many as this year's curve wants, in proportion to how loud this attack is; always at least one.
      const y = yearAt(t), phase = (t - y.a) / y.len, pb = (y.start - y.a) / y.len;
      let goal;
      if (t < y.start) goal = target * (1 - Math.pow(1 - clamp(phase / Math.min(pb, 0.7), 0, 1), 1.7));
      else goal = target * Math.pow(clamp(1 - (t - y.start) / (y.b - y.start), 0, 1), 1.3);
      const minN = 1 + Math.round(18 * e * e), fb = (goal - alive) * 0.22 * (e / Math.max(0.05, eAvg));
      const want = Math.round(clamp(fb, minN, Math.max(minN, Math.min(34 + 80 * e, 1.3 * 160000 / Math.max(1, nc)))));
      let sum = 0; for (const n of notes) sum += n.v;
      const R = 14 + 75 * e, had = L.length;
      for (const n of notes) {
        const [tx, ty] = spotOf(n.m);
        leavesAt(tx, ty, Math.max(1, Math.round(want * n.v / sum)), R, t, ci, e);
      }
      if (L.length === had) {
        const list = openCells; let bi = -1, bd = 1e12;
        for (let q = list.length - 1, g = 0; q >= 0 && g < 40; q--, g++) { const cc = cells[list[q]]; if (!cc.free.length || cc.live.length / 2 >= cc.cap) continue; const dd = Math.hypot((list[q] % CW) * CS - 120 - hitX[ci], Math.floor(list[q] / CW) * CS - 120 - hitY[ci]); if (dd < bd) { bd = dd; bi = list[q]; } }
        if (bi >= 0) { const cc = cells[bi], s = cc.free.splice(0, 1)[0]; placeLeaf(s, t, ci, e); }
      }
      // A loud attack shakes down what has already turned, around where it hit.
      if (e > 0.55) {
        const n = notes[0], [tx, ty] = spotOf(n.m), rr = 3;
        const c0 = Math.floor((tx + 120) / CS), r0 = Math.floor((ty + 120) / CS);
        for (let rw = r0 - rr; rw <= r0 + rr; rw++) for (let cl = c0 - rr; cl <= c0 + rr; cl++) {
          if (rw < 0 || cl < 0 || rw >= CH || cl >= CW) continue;
          const cc = cells[rw * CW + cl]; if (!cc) continue;
          for (let i = 0; i < cc.live.length; i += 2) { const o = cc.live[i] * STR; if (L[o + 5] < t && L[o + 6] > t && rng() < 0.5 * e) startFall(cc.live[i], t, ci); }
        }
      }
      if (ci === nc - 1) for (const cc of cells) if (cc) for (let i = 0; i < cc.live.length; i += 2) { const o = cc.live[i] * STR; if (L[o + 5] < t) startFall(cc.live[i], t, ci); }
      leafEnd[ci] = L.length / STR;
    }

    // --- the finished numbers for the graphics card
    // Thickness: the pipe model, from the wood grown by each of eight moments, so a shoot is thin at its end whenever you look.
    // Children come after parents in the list.
    const CK = [0.02, 0.06, 0.12, 0.2, 0.32, 0.5, 0.74, 1], PIPE = 2.5, finalP = chordP[nc - 1] || 1;
    for (const b of br) b.rc = [];
    for (let c = 0; c < 8; c++) {
      const lim = CK[c] * finalP + 1e-6;
      for (let bi = br.length - 1; bi >= 0; bi--) {
        const b = br[bi];
        let g = 0;
        while (g < b.grown && chordP[b.bornP[g]] <= lim) g++;
        const rs = new Float32Array(b.grown + 1);
        b.gc = g; b.rc[c] = rs;
        if (g === 0) { b.r0 = 0; continue; }
        let rp = Math.pow(0.34, PIPE);
        for (let i = g; i >= 0; i--) {
          for (const k of b.kids) if (k.at === i && k.gc > 0) rp += Math.pow(k.r0, PIPE);
          const taper = (g - i) * 0.012 * (b.order < 2 ? 1.3 : 1) * DS[b.order] / 6;
          rs[i] = Math.pow(rp, 1 / PIPE) + taper;
        }
        // Limbs lose their girth along the way, not just at the forks.
        if (b.order === 1 || b.order === 2) { const a0 = b.order === 1 ? 1.3 : 1.15, a1 = b.order === 1 ? 0.42 : 0.5; for (let i = 0; i <= g; i++) rs[i] *= a0 + (a1 - a0) * Math.pow(i / Math.max(1, g), 0.8); }
        if (b.order === 0) { const k = Math.max(1, (12 + 24 * Math.sqrt(CK[c])) / Math.max(1, rs[0])); for (let i = 0; i <= g; i++) { const u = i / Math.max(1, g); rs[i] *= 1 + (k - 1) * (1 - u) * (1 - u); } }
        b.r0 = rs[0];
      }
    }
    const nSeg = segs.length / 4, SEGN = 15, MINR = [0, 1.5, 0.85, 0.42, 0.42, 0.42], segData = new Float32Array(nSeg * SEGN), segEnd = new Int32Array(nc);
    { let ci = 0;
      for (let i = 0; i < nSeg; i++) {
        const b = segs[i * 4], k = segs[i * 4 + 1], t = segs[i * 4 + 2], own = segs[i * 4 + 3], o = i * SEGN;
        while (ci < own) segEnd[ci++] = i;
        segData[o] = b.xs[k]; segData[o + 1] = b.ys[k]; segData[o + 2] = b.xs[k + 1]; segData[o + 3] = b.ys[k + 1]; segData[o + 4] = t;
        for (let c = 0; c < 8; c++) segData[o + 5 + c] = Math.max(MINR[b.order] * Math.min(1, (b.xs.length - 1 - k) / 8 + 0.25), (b.rc[c][k] + b.rc[c][k + 1]) * 0.5);
        if (k === 0) b.arc = 0;
        segData[o + 13] = b.arc; segData[o + 14] = b.id % 97; b.arc += Math.hypot(b.xs[k + 1] - b.xs[k], b.ys[k + 1] - b.ys[k]);
      }
      while (ci < nc) segEnd[ci++] = nSeg; }
    for (const b of br) b.rc = null;
    // When each leaf has left the picture, and the running latest of those, so what has long gone is not even drawn.
    const nLeaf = L.length / STR, leafData = new Float32Array(L), leafGoneMax = new Float32Array(nLeaf);
    { let mx = 0;
      for (let i = 0; i < nLeaf; i++) {
        const o = i * STR, f = L[o + 6];
        let gone = 2e7;
        if (f < 1e6) gone = f + (790 - L[o + 1]) / 42;
        leafData[o + 7] = gone; mx = Math.max(mx, gone); leafGoneMax[i] = mx;
      } }
    return { seed, flip, spot: spotOf, years, dur, hitX, hitY, SEGN, T, eOf, chordP, CK, finalP, nc, segData, nSeg, segEnd, leafData, nLeaf, leafEnd, leafGoneMax, base: [wood.baseX, wood.baseY] };
  }


  // ---------------------------------------------------------------- the firs: painted once, coloured by the composite
  // Red is how lit a bough is, green is the lawn, alpha is what covers the sky. One near-black green mass framing the sides, a
  // narrow gap between, and at the bottom of the gap a small patch of lit lawn. Painted the right way round; the composite flips it.
  function paintFirs() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), rng = rngOf(0x51ce);
    const fir = (ctx, x, base, h, wd, col, litA) => {
      ctx.lineCap = 'round';
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, base - h);
      const steps = Math.max(4, Math.floor(h / 18));
      for (let i = 1; i <= steps; i++) { const f = i / steps; ctx.lineTo(x + wd * Math.pow(f, 0.72) * (0.55 + 0.34 * rng()), base - h + f * h); }
      for (let i = steps; i >= 1; i--) { const f = i / steps; ctx.lineTo(x - wd * Math.pow(f, 0.72) * (0.55 + 0.34 * rng()), base - h + f * h); }
      ctx.closePath(); ctx.fill();
      const tiers = Math.floor(h / 5.5);
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < tiers; i++) {
        const f = (i + rng()) / tiers, y = base - h + f * h, hw = wd * Math.pow(f, 0.7) * (0.45 + 0.85 * rng()) + 3;
        for (const s of [-1, 1]) {
          const ex = x + s * hw, ey = y + hw * (0.3 + 0.4 * rng());
          if (pass === 0) {
            ctx.strokeStyle = col; ctx.globalAlpha = 1; ctx.lineWidth = 1 + 3.4 * rng();
            ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * hw * 0.6, y + hw * 0.05, ex, ey); ctx.stroke();
            for (let k = 0; k < 10; k++) {
              const u = 0.25 + rng() * 0.8, qx = x + s * hw * u, qy = y + hw * (0.05 + 0.5 * u * u);
              ctx.lineWidth = 0.6 + rng() * 1.5; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + s * (rng() - 0.2) * 10, qy + 5 + rng() * 20); ctx.stroke();
            }
          } else if (litA > 0 && f > 0.12 && rng() < 0.4) {
            ctx.strokeStyle = 'rgb(255,0,0)'; ctx.globalAlpha = litA * (0.25 + 0.75 * rng());
            for (let k = 0; k < 8; k++) { const u = 0.15 + rng() * 0.85, qx = x + s * hw * u, qy = y + hw * (0.05 + 0.34 * u * u) + (rng() - 0.5) * 4; ctx.lineWidth = 0.7 + rng() * 1.1; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + s * (rng() - 0.1) * 9, qy + 3 + rng() * 11); ctx.stroke(); }
          }
        }
      }
      ctx.globalAlpha = 1;
    };
    const layer = (blur, list, col, litA) => {
      const l = document.createElement('canvas'); l.width = W; l.height = H;
      const q = l.getContext('2d');
      for (const [x, h, wd] of list) fir(q, x, H + 30, h, wd, col, litA);
      g.filter = `blur(${blur}px)`; g.drawImage(l, 0, 0); g.filter = 'none';
    };
    // The far mass: a rough skyline with no sky through it, low in the middle, closing to a slit at the lane.
    const far = [];
    for (let hx = -40; hx < 1340; hx += 26 + rng() * 34) {
      const d = hx - 505; if (Math.abs(d) < 46) continue;
      const side = d < 0 ? (-d - 46) / 500 : (d - 46) / 780, h = 120 + 70 * Math.exp(-Math.abs(d) / 70) + Math.pow(side, 1.25) * (d < 0 ? 300 : 210) + rng() * rng() * 96 + (rng() < 0.2 ? 30 : 0);
      far.push([hx, h, 26 + h * 0.13 + rng() * 22]);
    }
    layer(0.6, far, 'rgb(8,0,0)', 0.32);
    // The lawn, at the bottom of the gap.
    { const q = g.createLinearGradient(0, 698, 0, H); q.addColorStop(0, 'rgb(0,255,0)'); q.addColorStop(1, 'rgb(0,150,0)');
      g.filter = 'blur(1.2px)'; g.fillStyle = q; g.beginPath(); g.moveTo(500, 703); g.lineTo(512, 703); g.lineTo(552, H + 4); g.lineTo(462, H + 4); g.closePath(); g.fill(); g.filter = 'none'; }
    // The near firs, with the light on their upper boughs. The tall ones at the very edges.
    layer(0.5, [[-34, 505, 190], [92, 410, 165], [205, 275, 118], [318, 196, 88], [428, 176, 46], [586, 164, 44], [716, 168, 78], [866, 176, 92], [1000, 178, 102], [1130, 262, 142], [1272, 372, 182]], 'rgb(22,0,0)', 0.55);
    return c;
  }
  // Without a graphics card that can do this: a plain sky and the firs in one colour.
  function paintFlat(pr) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, pr.day[0]); gr.addColorStop(0.56, pr.day[1]); gr.addColorStop(1, pr.day[2]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const l = document.createElement('canvas'); l.width = W; l.height = H;
    const q = l.getContext('2d'); q.drawImage(paintFirs(), 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = pr.fir[0]; q.fillRect(0, 0, W, H);
    g.drawImage(l, 0, 0);
    return c;
  }

  // The leaf shapes, drawn once. Alpha is the leaf's outline; red is how thick it is there (the veins and the middle show).
  function paintAtlas() {
    const CELL = 128, c = document.createElement('canvas'); c.width = CELL * 4; c.height = CELL * 2;
    const g = c.getContext('2d'), rng = rngOf(0xbeef);
    const maple = (n, deep, thin) => {
      const th = 2.55, pts = [];
      g.beginPath(); g.moveTo(0, 42);
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0 : i / (n - 1) * 2 - 1, a = u * th, la = 52 * (1 - 0.42 * Math.pow(Math.abs(u), 1.5)) * (0.94 + 0.12 * rng());
        const tipx = Math.sin(a) * la, tipy = -Math.cos(a) * la + 6;
        const sideA = a - th / (n - 1) * 0.5, nx0 = Math.sin(sideA) * deep, ny0 = -Math.cos(sideA) * deep + 6;
        if (i === 0) g.lineTo(Math.sin(a - 0.3) * 20, -Math.cos(a - 0.3) * 20 + 10);
        else g.lineTo(nx0, ny0);
        const perp = thin;
        g.quadraticCurveTo(tipx * 0.55 + Math.cos(a) * -perp, tipy * 0.55 + Math.sin(a) * -perp + 3, tipx, tipy);
        pts.push([tipx, tipy, a]);
        const sideB = a + th / (n - 1) * 0.5, nx1 = Math.sin(sideB) * deep, ny1 = -Math.cos(sideB) * deep + 6;
        if (i < n - 1) g.quadraticCurveTo(tipx * 0.55 + Math.cos(a) * perp, tipy * 0.55 + Math.sin(a) * perp + 3, nx1, ny1);
        else g.quadraticCurveTo(tipx * 0.55 + Math.cos(a) * perp, tipy * 0.55 + Math.sin(a) * perp + 3, Math.sin(a + 0.3) * 20, -Math.cos(a + 0.3) * 20 + 10);
      }
      g.closePath();
      return pts;
    };
    const paint = (cell, draw) => {
      const cx = (cell % 4) * CELL + CELL / 2, cy = Math.floor(cell / 4) * CELL + CELL / 2;
      g.save(); g.translate(cx, cy);
      g.fillStyle = '#fff';
      const veins = draw();
      g.fill();
      g.globalCompositeOperation = 'source-atop';
      const q = g.createRadialGradient(0, 6, 4, 0, 0, 58); q.addColorStop(0, 'rgb(255,255,255)'); q.addColorStop(0.5, 'rgb(190,190,190)'); q.addColorStop(1, 'rgb(135,135,135)');
      g.fillStyle = q; g.fillRect(-64, -64, 128, 128);
      if (veins) { g.strokeStyle = 'rgb(255,255,255)'; g.lineWidth = 2; for (const [x, y] of veins) { g.beginPath(); g.moveTo(0, 12); g.lineTo(x, y); g.stroke(); } }
      g.restore();
    };
    paint(0, () => maple(7, 24, 13));
    paint(1, () => maple(5, 26, 18));
    paint(2, () => maple(7, 19, 11));
    paint(3, () => { g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(-14, 50, -56, 40, -50, 2); g.bezierCurveTo(-46, -22, -18, -36, 0, -62); g.bezierCurveTo(18, -36, 46, -22, 50, 2); g.bezierCurveTo(56, 40, 14, 50, 0, 30); g.closePath(); return [[0, -40], [-26, -12], [26, -12]]; });
    paint(4, () => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - 1.57, b = a + TAU / 10, c1 = a - 0.42, c2 = a + 0.42; const r = 54; if (i === 0) g.moveTo(Math.cos(a - TAU / 10) * 12, Math.sin(a - TAU / 10) * 12); g.bezierCurveTo(Math.cos(c1) * r * 0.9, Math.sin(c1) * r * 0.9, Math.cos(a - 0.14) * r * 1.1, Math.sin(a - 0.14) * r * 1.1, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); g.bezierCurveTo(Math.cos(a + 0.14) * r * 1.1, Math.sin(a + 0.14) * r * 1.1, Math.cos(c2) * r * 0.9, Math.sin(c2) * r * 0.9, Math.cos(b) * 12, Math.sin(b) * 12); } g.closePath(); return null; });
    paint(5, () => { g.beginPath(); g.moveTo(0, 46); g.bezierCurveTo(-8, 20, -26, 6, -54, -6); g.bezierCurveTo(-46, -32, -22, -48, -4, -44); g.lineTo(0, -28); g.lineTo(4, -44); g.bezierCurveTo(22, -48, 46, -32, 54, -6); g.bezierCurveTo(26, 6, 8, 20, 0, 46); g.closePath(); return [[-28, -24], [-12, -30], [12, -30], [28, -24]]; });
    paint(6, () => { g.beginPath(); g.moveTo(0, 50); g.bezierCurveTo(-34, 26, -30, -22, 0, -56); g.bezierCurveTo(30, -22, 34, 26, 0, 50); g.closePath(); return [[0, -44]]; });
    paint(7, () => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, r = 52; g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.14) * 12, Math.sin(a - 0.14) * 12); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a + 0.14) * 12, Math.sin(a + 0.14) * 12); g.closePath(); } return null; });
    return c;
  }

  // ---------------------------------------------------------------- the graphics card
  const SWAY = `
    uniform float uT, uBreeze; uniform vec4 uKick; uniform vec2 uBase;
    vec2 sway(vec2 p) {
      float h = length(p - uBase) / 900.0, f = h * h;
      vec2 d = vec2(sin(uT * 0.55 + p.y * 0.004 + p.x * 0.002) + 0.5 * sin(uT * 1.3 + p.x * 0.009), 0.35 * sin(uT * 0.9 + p.x * 0.006)) * uBreeze * f;
      vec2 q = p - uKick.xy;
      d += vec2(0.8, 1.0) * uKick.z * exp(-dot(q, q) / 52000.0) * sin(uKick.w * 24.0) * exp(-uKick.w * 7.0) * (1.5 + 4.0 * f);
      return d;
    }
    vec4 clip(vec2 p) { return vec4(p.x / ${W}.0 * 2.0 - 1.0, 1.0 - p.y / ${H}.0 * 2.0, 0.0, 1.0); }`;
  // One leaf program, three uses: 0 the film of red (absorption, all additive), 1 the second tree's leaves (crisp, each its own
  // colour, not sinking into the red), 2 the arrival (what was born in the last moment, large and lit, added on top of everything).
  const leafV = (mode) => `#version 300 es
    precision highp float;
    #define MODE ${mode}
    layout(location=0) in vec2 q;
    layout(location=1) in vec4 a0;   // x, y, rot, size
    layout(location=2) in vec4 a1;   // birth, turn, fall, gone
    layout(location=3) in vec4 a2;   // seed+loud, hue, kind, -
    uniform vec3 uA[5]; uniform vec3 uB[5]; uniform vec4 uShape; uniform float uSize, uSizeB, uRipen, uRegion, uLayer; uniform vec3 uFlash, uBack;
    out vec2 vUv; flat out vec3 vD; flat out vec3 vE;
    ${SWAY}
    float rnd(float s, float k) { return fract(sin(s * 12.9898 + k * 78.233) * 43758.5453); }
    void main() {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      float u = uT - a1.x;
      if (u < 0.0 || uT > a1.w) return;
      #if MODE == 2
      if (u > 0.5) return;
      #endif
      float loud = fract(a2.x) / 0.999, s0 = floor(a2.x) / 1000.0, sp = floor(a2.z), shapeR = fract(a2.z);
      if (rnd(s0, 31.0) > 1.5 / (uSize * uSize)) return;
      if (sp > 1.5) sp = uRegion;
      bool own = sp > 0.5 && uLayer > 0.5;
      #if MODE == 0
      if (own) return;
      #elif MODE == 1
      if (!own) return;
      #endif
      vec3 p1 = sp < 0.5 ? mix(uA[1], uA[2], a2.y) : mix(uB[1], uB[2], a2.y);
      vec3 young = sp < 0.5 ? uA[0] : uB[0], old = sp < 0.5 ? uA[3] : uB[3], dead = sp < 0.5 ? uA[4] : uB[4];
      float ripe = smoothstep(0.0, uRipen * (0.6 + 0.8 * s0), u);
      vec3 c = mix(young, p1, ripe);
      float dry = 1.0;
      if (uT > a1.y) {
        float k = clamp((uT - a1.y) / max(0.3, a1.z - a1.y), 0.0, 1.0);
        c = k < 0.62 ? mix(c, old, k / 0.62) : mix(old, dead, (k - 0.62) / 0.38 * rnd(s0, 17.0) * rnd(s0, 17.0));
        dry = 1.0 - 0.34 * smoothstep(0.0, 0.6, k);
      }
      // How much light this one lets through: from leaf to leaf quite different, so the thin ones glow pink at the edges.
      float tv = rnd(s0, 3.0), thick = (0.56 + 0.66 * tv + 1.4 * tv * tv * tv * tv) * mix(1.3, 0.62, smoothstep(0.1, 0.9, a2.y)) * dry;
      vec2 pos = a0.xy;
      float rot = a0.z, squash = 1.0;
      if (uT >= a1.z) {
        float a = uT - a1.z, v = 42.0 + 34.0 * rnd(s0, 5.0), wob = 1.3 + 1.6 * rnd(s0, 7.0), ph = s0 * 40.0;
        thick *= 0.72;
        pos.y = a0.y + v * a + 26.0 * min(a, 1.2) * a;
        pos.x += sin(a * wob + ph) * (10.0 + 14.0 * rnd(s0, 9.0)) * min(1.0, a) + a * (5.0 + 10.0 * sin(ph));
        rot += a * (rnd(s0, 2.0) - 0.5) * 5.0;
        squash = 0.35 + 0.65 * abs(cos(a * wob * 1.3 + ph));
      }
      else {
        pos += sway(a0.xy);
        rot += sin(uT * (0.7 + 1.1 * s0) + s0 * 50.0) * 0.03;
        vec2 kq = a0.xy - uKick.xy;
        rot += uKick.z * exp(-dot(kq, kq) / 40000.0) * sin(uKick.w * 30.0 + s0 * 20.0) * exp(-uKick.w * 6.0) * 0.5;
      }
      // The arrival: on the attack's own frame it is about twice its size, and it settles in about a third of a second.
      float pop = 1.0 + (0.5 + 0.75 * loud) * exp(-u / 0.1);
      float sz = (sp < 0.5 ? 1.0 : uSizeB) * a0.w * uSize * pop * 13.5;
      float cr = cos(rot), sr = sin(rot);
      vec2 l = vec2(q.x * squash, q.y) * sz;
      gl_Position = clip(pos + vec2(cr * l.x - sr * l.y, sr * l.x + cr * l.y));
      float cell = sp < 0.5 ? uShape.x + floor(shapeR * uShape.y) : uShape.z + floor(shapeR * uShape.w);
      vUv = (vec2(mod(cell, 4.0), floor(cell / 4.0)) + (q * 0.5 + 0.5)) / vec2(4.0, 2.0);
      vec3 cc = max(c, vec3(0.012));
      #if MODE == 0
      vD = -log(cc) * thick;
      vE = vec3(0.0);
      #elif MODE == 1
      // Each leaf its own brightness: bright ones with the light behind them, some in the shade of the others.
      float v = rnd(s0, 11.0);
      vE = mix(cc * vec3(0.8, 0.62, 0.42), cc, smoothstep(0.0, 0.55, v)) * uBack * (0.96 + 0.14 * v);
      vD = vec3(step(0.2, rnd(s0, 21.0)), 0.98, 0.0);
      #else
      // Lit, not white: its own colour with the flash in it, strongest on the frame it lands.
      vE = (p1 * 1.1 + uFlash * 0.16) * exp(-u / 0.12) * (0.4 + 0.7 * loud) * (sp < 0.5 ? 1.0 : 0.5);
      vD = vec3(0.0);
      #endif
    }`;
  const LEAF_F = `#version 300 es
    precision highp float;
    in vec2 vUv; flat in vec3 vD; flat in vec3 vE; uniform sampler2D uAtlas;
    layout(location=0) out vec4 oD; layout(location=1) out vec4 oE;
    void main() { vec4 t = texture(uAtlas, vUv); oD = vec4(vD * t.a * (0.62 + 0.7 * t.r), 0.0); oE = vec4(t.a, 0.0, 0.0, 0.0); }`;
  const OWN_F = `#version 300 es
    precision highp float;
    in vec2 vUv; flat in vec3 vD; flat in vec3 vE; uniform sampler2D uAtlas, uDep; out vec4 o;
    void main() {
      vec4 t = texture(uAtlas, vUv);
      float w = texelFetch(uDep, ivec2(gl_FragCoord.xy), 0).a;       // most hang behind the black wood, a few in front of it
      o = vec4(vE * (0.74 + 0.4 * t.r), smoothstep(0.2, 0.62, t.a) * vD.y * (1.0 - vD.x * w));
    }`;
  const ARR_F = `#version 300 es
    precision highp float;
    in vec2 vUv; flat in vec3 vE; uniform sampler2D uAtlas; out vec4 o;
    void main() { o = vec4(vE * texture(uAtlas, vUv).a, 1.0); }`;
  const SEG_V = `#version 300 es
    precision highp float;
    layout(location=0) in vec2 q;
    layout(location=1) in vec4 a0;   // ax, ay, bx, by
    layout(location=2) in float aB;  // birth
    layout(location=3) in mat2x4 aR; // radius at eight moments of the growth
    layout(location=5) in vec2 aArc; // length along the branch so far, and the branch's own number
    uniform int uI; uniform float uF, uPad;
    out vec2 vP; flat out vec4 vAB; flat out float vR; flat out float vFl; flat out vec2 vArc;
    ${SWAY}
    float rad(int i) { return aR[i / 4][i % 4]; }
    void main() {
      float u = uT - aB;
      if (u < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec2 a = a0.xy + sway(a0.xy), b0 = a0.zw + sway(a0.zw);
      vec2 b = mix(a, b0, clamp(u / 0.03 + 0.5, 0.0, 1.0));
      float r = mix(rad(uI), rad(min(uI + 1, 7)), uF);
      float ra = max(r * (0.6 + 0.4 * smoothstep(0.0, 0.1, u)), 0.42);
      vec2 d = b - a; float L = max(0.001, length(d)); vec2 e = d / L, n = vec2(-e.y, e.x);
      float R = ra * 1.2 + uPad;
      vec2 c = (a + b) * 0.5, p = c + e * q.x * (L * 0.5 + R) + n * q.y * R;
      vP = p; vAB = vec4(a, b); vR = ra; vFl = exp(-u / 0.14); vArc = aArc;
      gl_Position = clip(p);
    }`;
  const VN = `
    float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }`;
  const SEG_F = `#version 300 es
    precision highp float;
    in vec2 vP; flat in vec4 vAB; flat in float vR; flat in float vFl; flat in vec2 vArc;
    layout(location=0) out vec4 oD; layout(location=1) out vec4 oE;
    ${VN}
    void main() {
      vec2 pa = vP - vAB.xy, ba = vAB.zw - vAB.xy;
      float bb = max(0.001, dot(ba, ba)), h = dot(pa, ba) / bb, hc = clamp(h, 0.0, 1.0);
      vec2 perp = pa - ba * hc, e = ba / sqrt(bb);
      // Wood is not a tube: the thick parts swell and pinch a little along their length.
      float k = smoothstep(1.4, 7.0, vR), r = vR * (1.0 + k * (vn(vP * 0.03) - 0.5) * 0.26);
      float d = length(perp) - r, cov = clamp(0.5 - d, 0.0, 1.0);
      if (cov <= 0.0) discard;
      // In E's alpha: 0..1 the bark's own light, above 1 the flash of a new shoot. Bark runs along the branch in long ridges
      // that wander (measured along the branch, so they carry across its bends), and moss grows on the upper side in patches.
      vec2 nrm = vec2(-e.y, e.x);
      float along = vArc.x + h * sqrt(bb), side = dot(pa, nrm) / max(r, 0.5), up = side * (dot(nrm, vec2(-0.35, -0.94)) >= 0.0 ? 1.0 : -1.0);
      float wander = side * (0.9 + 0.06 * vR) + 0.5 * vn(vec2(along * 0.012, vArc.y));
      float ridge = vn(vec2(along * 0.006 + vArc.y * 3.0, wander * 3.6)) * 0.65 + vn(vec2(along * 0.016 + vArc.y, wander * 8.0)) * 0.35;
      ridge = 0.4 + 0.6 * smoothstep(0.32, 0.68, ridge);
      float moss = smoothstep(0.32, 0.7, vn(vP * vec2(0.012, 0.018) + 3.0));
      float bark = k * smoothstep(0.0, 40.0, along) * (smoothstep(-0.55, 0.75, up) * (0.3 + 0.7 * moss) * ridge + pow(abs(side), 7.0) * 0.1);
      oD = vec4(0.0, 0.0, 0.0, cov * mix(0.62, 1.0, smoothstep(1.2, 6.5, vR)));
      oE = vec4(0.0, 0.0, 0.0, min(bark, 1.0) + vFl * 2.2);
    }`;
  const FLARE_F = `#version 300 es
    precision highp float;
    in vec2 vP; flat in vec4 vAB; flat in float vR; flat in float vFl; uniform vec3 uFlash; out vec4 o;
    void main() {
      vec2 pa = vP - vAB.xy, ba = vAB.zw - vAB.xy;
      float h = clamp(dot(pa, ba) / max(0.001, dot(ba, ba)), 0.0, 1.0), d = length(pa - ba * h) / (vR + 2.6);
      o = vec4(uFlash * vFl * exp(-d * d * 2.6) * 0.65, 1.0);
    }`;
  const FULL_V = `#version 300 es
    layout(location=0) in vec2 q; out vec2 uv; void main() { uv = q * 0.5 + 0.5; gl_Position = vec4(q, 0.0, 1.0); }`;
  const COMP_F = `#version 300 es
    precision highp float;
    in vec2 uv; out vec4 o; uniform sampler2D uD, uE, uFir, uCloud, uSpeck;
    uniform vec3 uTop, uMid, uLow, uBack, uBark, uMoss, uShoot, uFirD, uFirL, uLawn, uSlit, uFlash;
    uniform float uLim, uScatter, uFlip, uDim, uShade;
    uniform vec4 uHit[8];
    void main() {
      vec4 D = texture(uD, uv), E4 = texture(uE, uv);
      vec2 px = vec2(uv.x * ${W}.0, (1.0 - uv.y) * ${H}.0), cv = vec2(uFlip > 0.5 ? 1.0 - uv.x : uv.x, uv.y);
      float y = 1.0 - uv.y, cloud = texture(uCloud, uv).r;
      // The sky, and the light at the end of the lane: a narrow slit, seen only through the gap between the firs.
      vec3 sky = (y < 0.56 ? mix(uTop, uMid, y / 0.56) : mix(uMid, uLow, (y - 0.56) / 0.44)) * (0.96 + 0.08 * cloud);
      float lx = (cv.x * ${W}.0 - 505.0) / (10.0 + max(0.0, 690.0 - px.y) * 0.075), ly = (px.y - 688.0) / 72.0;
      sky += uSlit * (exp(-lx * lx) * exp(-ly * ly) * 1.8 + 0.1 * exp(-lx * lx * 0.05) * exp(-ly * ly * 0.22));
      vec4 F = texture(uFir, cv);
      vec3 bg = mix(sky, mix(mix(uFirD, uFirL, F.r), uLawn * (0.7 + 0.5 * cloud), F.g) * uDim, F.a);
      // Where a note lands the leaves thin for a moment, and that patch of the crown lets the light through.
      float hit = 0.0;
      for (int i = 0; i < 8; i++) { vec2 q = (px - uHit[i].xy) / uHit[i].w; hit += uHit[i].z * exp(-dot(q, q)); }
      hit = 1.0 - exp(-hit * 1.15);
      float speck = texture(uSpeck, px / 512.0).r;
      float hole = (1.0 - 0.88 * speck) * (1.0 - 0.55 * hit), n = E4.r * hole;
      vec3 Dr = D.rgb * hole * (1.0 + 0.65 * F.a);
      // Light through a leaf comes from the sky above, not from the fir that happens to be behind it.
      float cov = 1.0 - exp(-n * 2.4);
      vec3 Dn = Dr / max(cov, 0.14), d = uLim * (vec3(1.0) - exp(-Dn / uLim));
      // Deep in a mass, in places, hardly any gets through: the wine colour of the core.
      float sh = min(uShade * max(0.0, n - 1.6) * (0.25 + 1.5 * cloud), 0.95);
      vec3 c = mix(bg, uBack * exp(-d - sh * vec3(0.9, 1.3, 1.2)), cov);
      float m = max(Dn.r, max(Dn.g, Dn.b));
      c += exp(-Dn / max(m, 0.001) * 2.2) * cov * uScatter * uDim * exp(-sh * 0.5);
      c += uFlash * hit * cov * 0.24;
      // Twigs and the middle wood sink behind the leaves; only the big limbs stay in front.
      float thin = 1.0 - smoothstep(0.62, 0.97, D.a), wood = mix(D.a, min(1.0, D.a / 0.62) * mix(1.0, 0.3, smoothstep(0.5, 2.6, E4.r)), thin);
      c = mix(c, uBark + uMoss * min(E4.a, 1.0) * uDim + uShoot * min(max(E4.a - 1.0, 0.0), 1.0), wood * 0.985);
      o = vec4(c, 1.0);
    }`;
  const BLUR_F = `#version 300 es
    precision highp float;
    in vec2 uv; out vec4 o; uniform sampler2D uS; uniform vec2 uStep; uniform float uKnee;
    void main() {
      vec3 s = texture(uS, uv).rgb * 0.227 + (texture(uS, uv + uStep * 1.385).rgb + texture(uS, uv - uStep * 1.385).rgb) * 0.316 + (texture(uS, uv + uStep * 3.23).rgb + texture(uS, uv - uStep * 3.23).rgb) * 0.07;
      if (uKnee > 0.0) s *= smoothstep(uKnee * 0.5, uKnee * 1.4, dot(s, vec3(0.3, 0.5, 0.2)));
      o = vec4(s, 1.0);
    }`;
  const FINAL_F = `#version 300 es
    precision highp float;
    in vec2 uv; out vec4 o; uniform sampler2D uC, uB; uniform float uBloom;
    void main() {
      vec3 c = texture(uC, uv).rgb, b = texture(uB, uv).rgb;
      // The light eats into the edges of what is in front of it, as in any photograph against the sky.
      c += b * uBloom * (1.0 - min(c, vec3(1.0)) * 0.6);
      c = mix(c, 0.8 + 0.2 * (1.0 - exp(-(c - 0.8) * 6.0)), step(0.8, c));
      c += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) * 1.6 / 255.0;
      o = vec4(c, 1.0);
    }`;

  // Two small maps the composite reads: soft cloud over the picture (also where the masses go dark), and the specks of sky
  // that sparkle through a mass of leaves, tiled.
  function cloudMap() {
    const w = 256, h = 144, a = new Uint8Array(w * h), n = vnoise(4242);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const v = 0.55 * n(i / 34, j / 26) + 0.3 * n(i / 13 + 9, j / 10) + 0.15 * n(i / 5 + 3, j / 4);
      a[j * w + i] = clamp(Math.round((v - 0.18) / 0.64 * 255), 0, 255);
    }
    return { w, h, a };
  }
  function speckMap() {
    const w = 512, a = new Uint8Array(w * w), rng = rngOf(0x5eec), n = vnoise(777);
    for (let k = 0; k < 2100; k++) {
      const x = rng() * w, y = rng() * w, r = 0.8 + 1.7 * rng() * rng();
      if (rng() > 0.25 + 1.1 * n(x / 40, y / 40)) continue;
      const R = Math.ceil(r + 1), ex = 0.5 + rng() * 0.8;
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
        const v = clamp(r + 0.5 - Math.hypot(i * ex, j / ex), 0, 1) * 255, o = ((Math.floor(y) + j + w) % w) * w + (Math.floor(x) + i + w) % w;
        if (v > a[o]) a[o] = v;
      }
    }
    return { w, h: w, a };
  }

  let F = null, broken = false;
  function makeGL() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); F = null; });
    const prog = (vs, fs) => {
      const p = gl.createProgram();
      for (const [type, text] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
        const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`tree shader: ${gl.getShaderInfoLog(s)}`);
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`tree link: ${gl.getProgramInfoLog(p)}`);
      const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace('[0]', ''); u[name] = gl.getUniformLocation(p, name); }
      return { p, u };
    };
    const tex = (w, h, internal, format, type, filter, wrap = gl.CLAMP_TO_EDGE) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.LINEAR_MIPMAP_LINEAR ? gl.LINEAR : filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      if (w) gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
      return t;
    };
    const fbo = (...ts) => {
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      ts.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
      gl.drawBuffers(ts.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
      return f;
    };
    const texD = tex(W, H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR), texE = tex(W, H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    const texC = tex(W, H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    const BW = W >> 2, BH = H >> 2, texB0 = tex(BW, BH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR), texB1 = tex(BW, BH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const atlas = tex(0, 0, 0, 0, 0, gl.LINEAR_MIPMAP_LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paintAtlas()); gl.generateMipmap(gl.TEXTURE_2D);
    const fir = tex(0, 0, 0, 0, 0, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paintFirs()); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const small = (m, wrap) => { const t = tex(0, 0, 0, 0, 0, gl.LINEAR, wrap); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, m.w, m.h, 0, gl.RED, gl.UNSIGNED_BYTE, m.a); return t; };
    const cloud = small(cloudMap(), gl.CLAMP_TO_EDGE), speck = small(speckMap(), gl.REPEAT);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    const made = {
      cv, gl, quad, atlas, fir, cloud, speck, texD, texE, texC, texB0, texB1, BW, BH,
      fbA: fbo(texD, texE), fbC: fbo(texC), fbB0: fbo(texB0), fbB1: fbo(texB1),
      leaf: prog(leafV(0), LEAF_F), own: prog(leafV(1), OWN_F), arr: prog(leafV(2), ARR_F), seg: prog(SEG_V, SEG_F), flare: prog(SEG_V, FLARE_F),
      comp: prog(FULL_V, COMP_F), blur: prog(FULL_V, BLUR_F), fin: prog(FULL_V, FINAL_F),
      leafBuf: gl.createBuffer(), segBuf: gl.createBuffer(), vaoLeaf: gl.createVertexArray(), vaoSeg: gl.createVertexArray(), vaoFull: gl.createVertexArray(),
      plan: null,
    };
    gl.bindVertexArray(made.vaoFull); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(made.vaoLeaf); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, made.leafBuf);
    for (let i = 1; i <= 3; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribDivisor(i, 1); }
    gl.bindVertexArray(made.vaoSeg); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, made.segBuf);
    for (const i of [1, 2, 3, 4, 5]) { gl.enableVertexAttribArray(i); gl.vertexAttribDivisor(i, 1); }
    gl.bindVertexArray(null);
    return made;
  }
  function usePlan(pl) {
    const { gl } = F;
    gl.bindBuffer(gl.ARRAY_BUFFER, F.leafBuf); gl.bufferData(gl.ARRAY_BUFFER, pl.leafData, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, F.segBuf); gl.bufferData(gl.ARRAY_BUFFER, pl.segData, gl.STATIC_DRAW);
    F.plan = pl;
  }

  // First light to dusk across each year of the piece, and a short night between the years of a long one.
  const SKIES = new Map();
  const skyOf = (pr) => { let s = SKIES.get(pr); if (!s) { s = { dawn: pr.dawn.map(hex), day: pr.day.map(hex), dusk: pr.dusk.map(hex), back: hex(pr.back) }; SKIES.set(pr, s); } return s; };
  function arcOf(pl, pr, t) {
    const Y = pl.years, y = Y[clamp(Math.floor(t / pl.dur * Y.length), 0, Y.length - 1)], u = clamp((t - y.a) / y.len, 0, 1), s = skyOf(pr);
    let w0 = 0, w1 = 0, w2 = 0, dim = 1;
    if (u < 0.2) { w1 = smooth(0, 0.2, u); w0 = 1 - w1; }
    else if (u < 0.56) w1 = 1;
    else { w2 = smooth(0.56, 0.97, u); w1 = 1 - w2; }
    if (!y.last && u > 0.94) { const g = (u - 0.94) / 0.06; w0 = g * 0.5; w1 *= 1 - w0; w2 *= 1 - w0; dim = 1 - 0.7 * smooth(0, 1, g); }
    if (y !== Y[0] && u < 0.06) { const g = 0.5 * (1 - u / 0.06); w2 = g; w0 *= 1 - g; w1 *= 1 - g; dim = 1 - 0.7 * smooth(0, 1, 2 * g); }
    const mix3 = (i) => [0, 1, 2].map((c) => (s.dawn[i][c] * w0 + s.day[i][c] * w1 + s.dusk[i][c] * w2) * dim);
    const low = mix3(2);
    const lit = (w0 * 0.92 + w1 + w2 * pr.duskBack) * dim;
    return { top: mix3(0), mid: mix3(1), low, back: s.back.map((v, c) => (v * (1 - 0.3 * w2) + low[c] * 0.3 * w2) * lit), day: lit, slit: lit * (0.55 + 0.45 * w0 + 0.45 * w2) };
  }

  // ---------------------------------------------------------------- the widget
  let plan = null, planKey = '', planWant = '', planMoved = 0, planAt = -1e9, planNotes = null;
  const knobsOf = (x) => ({ leaves: x.p('leaves'), twigs: x.p('twigs'), wither: x.p('wither') });
  function ensurePlan(x) {
    const N = window.NOTES || [], K = knobsOf(x), key = `${Math.round(K.leaves * 50)},${Math.round(K.twigs * 50)},${Math.round(K.wither * 50)}`;
    if (plan && planNotes === N && planKey === key) { planWant = key; return; }
    const now = performance.now();
    if (plan && planNotes === N) {                                      // a knob being dragged: when it rests. One driven by the music: now and then
      if (planWant !== key) { planWant = key; planMoved = now; }
      if (now - planMoved < 220 && now - planAt < 5000) return;
    }
    plan = makePlan(N, K); planKey = key; planWant = key; planNotes = N; planAt = now;
    if (F) F.plan = null;
  }
  const lastChord = (T, t, n) => { let a = 0, b = n; while (a < b) { const k = (a + b) >> 1; if (T[k] <= t) a = k + 1; else b = k; } return a - 1; };
  const firstAlive = (arr, t, n) => { let a = 0, b = n; while (a < b) { const k = (a + b) >> 1; if (arr[k] < t) a = k + 1; else b = k; } return a; };
  const hitBuf = new Float32Array(32);

  const leafIcon = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - 1.57, q = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); g.fill(); };
  const treeIcon = (g, w, h, depth, col) => {
    g.strokeStyle = col;
    const go = (x, y, a, l, n) => { const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l; g.lineWidth = Math.max(0.6, n * 0.5); g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke(); if (n > 1) { go(ex, ey, a - 0.5, l * 0.72, n - 1); go(ex, ey, a + 0.45, l * 0.72, n - 1); } };
    go(w / 2, h - 2, -1.57, h * 0.3, depth);
  };

  TOOLS.push({
    id: 'tree', name: 'Tree', tag: 'new',
    blurb: 'One tree against a glowing sky, seen from below. Every attack grows it a step, right on the note, and new leaves land big and lit while the light breaks through the crown where the note fell: low notes in the lower boughs, high notes in the crown, loud ones a whole spray. After the climax the leaves turn and fall limb by limb, and the sky goes to dusk behind the black branches.',
    params: [
      { key: 'colours', label: 'which season', min: 0, max: PRESETS.length - 1, step: 1, value: 0,
        hint: 'The colours and the sky, seven steps. Left: crimson and gold, an autumn maple with a second, golden tree. Then cherry blossom on a clear morning; high summer, green with the sun behind it; ginkgo gold on a lavender sky; violet dusk, purple leaves on a dark sky; ember night, glowing leaves on black. Right: first frost, white on a blue dawn.',
        icon: (g, v, w, h) => { const p = PRESETS[Math.round(v * (PRESETS.length - 1))]; g.fillStyle = p.day[1]; g.fillRect(2, 2, w - 4, h - 4); leafIcon(g, w * 0.36, h * 0.5, 8, p.A[1]); leafIcon(g, w * 0.68, h * 0.5, 6, p.B[1]); } },
      { key: 'leaves', label: 'how many leaves', min: 0.15, max: 1.6, value: 1, less: 0.22,
        hint: 'How thick the canopy gets. Left: a few scattered leaves and a lot of sky. Right: masses of colour with only small gaps.',
        icon: (g, v, w, h) => ICON.dots(g, 2 + Math.round(v * 26), w, h, { seed: 4, r: 1.7, col: ICON.red, pad: 3 }) },
      { key: 'twigs', label: 'how much wood', min: 0.2, max: 1.5, value: 1, less: 0.35,
        hint: 'How finely the branches divide. Left: a few bare limbs, drawn large. Right: a fine lace of twigs.',
        icon: (g, v, w, h) => treeIcon(g, w, h, 1 + Math.round(v * 4), ICON.ink) },
      { key: 'wither', label: 'how much it withers', min: 0, max: 2, value: 1, less: 1.5,
        hint: 'How much of the piece is the dying part. Left: it never goes bare, leaves only come and go. Middle: the leaves turn and fall after the climax. Right: it goes bare early, and in a long piece year after year.',
        icon: (g, v, w, h) => { const r = ICON.rng(9); for (let i = 0; i < 14; i++) { const lx = 3 + r() * (w - 6), ly = 3 + r() * (h * 0.5), f = r() < v; ICON.dot(g, lx, f ? ly + h * 0.45 : ly, 1.6, f ? ICON.gold : ICON.red); } } },
      { key: 'size', label: 'how big the leaves are', min: 0.5, max: 2.2, value: 1,
        hint: 'How big each leaf is. Left: a fine dust of tiny leaves. Right: big leaves you can tell apart.',
        icon: (g, v, w, h) => leafIcon(g, w / 2, h / 2, 3 + v * 9, ICON.red) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much tree it grows: how many leaves, how much wood, how long the leaves stay. Left: a thin tree with a few leaves that soon drop. Right: the whole canopy. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() {},
    onChord() {},    // The growth and the light are in the plan, at this very time; a seek lands on exactly the right picture.
    frame(x) {
      const g = x.g;
      ensurePlan(x);
      if (!F && !broken) { try { F = makeGL(); } catch (e) { console.warn(e); F = null; } if (!F) broken = true; }
      const pr = PRESETS[clamp(Math.round(x.p('colours')), 0, PRESETS.length - 1)], pl = plan, t = x.t;
      if (!F) {   // No float buffers on this machine: only the sky and the big wood.
        if (!pr.flat) pr.flat = paintFlat(pr);
        if (pl.flip) { g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(pr.flat, 0, 0); g.restore(); } else g.drawImage(pr.flat, 0, 0);
        const i = lastChord(pl.T, t, pl.nc), n = i < 0 ? 0 : pl.segEnd[i];
        g.strokeStyle = pr.bark; g.lineCap = 'round';
        for (let s = 0; s < n; s++) { const o = s * pl.SEGN; g.lineWidth = pl.segData[o + 12] * 2; g.beginPath(); g.moveTo(pl.segData[o], pl.segData[o + 1]); g.lineTo(pl.segData[o + 2], pl.segData[o + 3]); g.stroke(); }
        return;
      }
      const { gl } = F;
      if (F.plan !== pl) usePlan(pl);
      const ci = lastChord(pl.T, t, pl.nc), arc = arcOf(pl, pr, t);
      // P steps on attacks, with a quick swell, and stands still in silence.
      let P = 0;
      if (ci >= 0) { const a = ci > 0 ? pl.chordP[ci - 1] : 0, b = pl.chordP[ci]; P = a + (b - a) * smooth(0, 0.25, t - pl.T[ci]); }
      const set = (P0, name, ...v) => { const u = P0.u[name]; if (u) gl[`uniform${v.length}f`](u, ...v); };
      const common = (Pg) => {
        set(Pg, 'uT', t); set(Pg, 'uBreeze', 0.5); set(Pg, 'uFlash', ...hex(pr.flash)); gl.uniform2f(Pg.u.uBase, pl.base[0], pl.base[1]);
        if (ci >= 0) set(Pg, 'uKick', pl.hitX[ci], pl.hitY[ci], pl.eOf[ci] * 0.7, t - pl.T[ci]); else set(Pg, 'uKick', 0, 0, 0, 9);
      };
      const leafUniforms = (Lf) => {
        common(Lf);
        gl.uniform3fv(Lf.u.uA, pr.A.flatMap(hex)); gl.uniform3fv(Lf.u.uB, pr.B.flatMap(hex));
        gl.uniform4f(Lf.u.uShape, pr.shapeA[0], pr.shapeA[1], pr.shapeB[0], pr.shapeB[1]);
        set(Lf, 'uSize', x.p('size')); set(Lf, 'uSizeB', pr.sizeB); set(Lf, 'uRipen', 7); set(Lf, 'uRegion', pr.region ?? 1); set(Lf, 'uLayer', 1); set(Lf, 'uBack', ...arc.back);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, F.atlas); gl.uniform1i(Lf.u.uAtlas, 0);
      };
      const leafPtr = (first) => { gl.bindVertexArray(F.vaoLeaf); gl.bindBuffer(gl.ARRAY_BUFFER, F.leafBuf); for (let i = 0; i < 3; i++) gl.vertexAttribPointer(i + 1, 4, gl.FLOAT, false, 48, first * 48 + i * 16); };
      const segPtr = (first) => { gl.bindVertexArray(F.vaoSeg); gl.bindBuffer(gl.ARRAY_BUFFER, F.segBuf); for (const [i, n, o] of [[1, 4, 0], [2, 1, 16], [3, 4, 20], [4, 4, 36], [5, 2, 52]]) gl.vertexAttribPointer(i, n, gl.FLOAT, false, 60, first * 60 + o); };
      const segMoment = (S) => {
        let I = 0; const rel = P / Math.max(1e-6, pl.finalP); while (I < 6 && rel > pl.CK[I + 1]) I++;
        gl.uniform1i(S.u.uI, I); set(S, 'uF', clamp((rel - pl.CK[I]) / (pl.CK[I + 1] - pl.CK[I]), 0, 1));
      };
      const first = ci >= 0 ? firstAlive(pl.leafGoneMax, t, pl.nLeaf) : 0, count = ci >= 0 ? pl.leafEnd[ci] - first : 0;
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      // 1. What the light has to get through.
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.fbA); gl.viewport(0, 0, W, H);
      gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
      gl.enable(gl.BLEND); gl.blendEquationSeparate(gl.FUNC_ADD, gl.MAX); gl.blendFunc(gl.ONE, gl.ONE);
      if (ci >= 0) {
        const S = F.seg; gl.useProgram(S.p); common(S); segMoment(S); set(S, 'uPad', 1.5);
        segPtr(0); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, pl.segEnd[ci]);
        const Lf = F.leaf; gl.useProgram(Lf.p); leafUniforms(Lf);
        if (count > 0) { leafPtr(first); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count); }
      }
      gl.disable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
      // 2. Sky through all of that.
      gl.bindVertexArray(F.vaoFull);
      const C = F.comp; gl.bindFramebuffer(gl.FRAMEBUFFER, F.fbC); gl.useProgram(C.p);
      const tx = (i, tex, u) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u, i); };
      tx(0, F.texD, C.u.uD); tx(1, F.texE, C.u.uE); tx(2, F.fir, C.u.uFir); tx(3, F.cloud, C.u.uCloud); tx(4, F.speck, C.u.uSpeck);
      set(C, 'uTop', ...arc.top); set(C, 'uMid', ...arc.mid); set(C, 'uLow', ...arc.low); set(C, 'uBack', ...arc.back); set(C, 'uDim', arc.day);
      set(C, 'uFirD', ...hex(pr.fir[0])); set(C, 'uFirL', ...hex(pr.fir[1])); set(C, 'uLawn', ...hex(pr.lawn)); set(C, 'uSlit', ...hex(pr.slit).map((v) => v * arc.slit));
      set(C, 'uBark', ...hex(pr.bark)); set(C, 'uMoss', ...hex(pr.moss)); set(C, 'uShoot', ...hex(pr.shoot)); set(C, 'uFlash', ...hex(pr.flash));
      set(C, 'uLim', pr.lim); set(C, 'uScatter', pr.scatter); set(C, 'uShade', pr.shade); set(C, 'uFlip', pl.flip ? 1 : 0);
      // Where the last attacks fell, fading.
      hitBuf.fill(0); for (let i = 0; i < 8; i++) hitBuf[i * 4 + 3] = 100;
      for (let k = 0, i = ci; k < 8 && i >= 0; k++, i--) {
        const age = t - pl.T[i]; if (age > 0.9) break;
        const e = pl.eOf[i];
        hitBuf[k * 4] = pl.hitX[i]; hitBuf[k * 4 + 1] = pl.hitY[i]; hitBuf[k * 4 + 2] = (0.3 + 0.7 * e) * Math.exp(-age / 0.24); hitBuf[k * 4 + 3] = 50 + 90 * e;
      }
      gl.uniform4fv(C.u.uHit, hitBuf);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // 3. On top of the picture: the second tree's leaves, then what has just arrived.
      if (ci >= 0) {
        gl.enable(gl.BLEND);
        if (count > 0) {
          const O = F.own; gl.useProgram(O.p); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); leafUniforms(O);
          tx(1, F.texD, O.u.uDep);
          leafPtr(first); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
        }
        gl.blendFunc(gl.ONE, gl.ONE);
        const before = lastChord(pl.T, t - 0.5, pl.nc), l0 = before >= 0 ? pl.leafEnd[before] : 0, s0 = before >= 0 ? pl.segEnd[before] : 0;
        if (pl.segEnd[ci] > s0) {
          const Fl = F.flare; gl.useProgram(Fl.p); common(Fl); segMoment(Fl); set(Fl, 'uPad', 6);
          segPtr(s0); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, pl.segEnd[ci] - s0);
        }
        if (pl.leafEnd[ci] > l0) {
          const A = F.arr; gl.useProgram(A.p); leafUniforms(A);
          leafPtr(l0); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, pl.leafEnd[ci] - l0);
        }
        gl.disable(gl.BLEND);
        gl.bindVertexArray(F.vaoFull);
      }
      // 4. The bright gaps bleed a little.
      const Bl = F.blur; gl.useProgram(Bl.p); gl.viewport(0, 0, F.BW, F.BH);
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.fbB0); tx(0, F.texC, Bl.u.uS); set(Bl, 'uStep', 1 / W * 1.5, 0); set(Bl, 'uKnee', 0.85); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.fbB1); tx(0, F.texB0, Bl.u.uS); set(Bl, 'uStep', 0, 1 / F.BH * 1.5); set(Bl, 'uKnee', 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.fbB0); tx(0, F.texB1, Bl.u.uS); set(Bl, 'uStep', 1 / F.BW * 2.5, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.fbB1); tx(0, F.texB0, Bl.u.uS); set(Bl, 'uStep', 0, 1 / F.BH * 2.5); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // 5. To the screen.
      const Fi = F.fin; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(Fi.p);
      tx(0, F.texC, Fi.u.uC); tx(1, F.texB1, Fi.u.uB); set(Fi, 'uBloom', 0.17);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      g.drawImage(F.cv, 0, 0, x.W, x.H);
    },
  });
})();
