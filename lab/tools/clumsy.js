// Clumsy (the user, round 9: "the movement of the individual things expresses the emotion clumsiness. The objects tumble
// and rush to keep up. every attack causes disorder again. concepts are tumbling over each other, like hopping").
// A crowd of mismatched flat shapes under gravity, always hopping towards a rough line at a goal on the floor and never
// getting there in time. Each is a rigid body with its weight off-centre, so it lands on a corner, tips, rocks and rolls.
// Every attack moves the goal (top note) and kicks shapes (low notes the big ones, high notes the small ones; louder is
// higher and spinnier, longer hangs, short trips, a full chord hits everybody). The hardest attacks tilt the floor.
(() => {
  const G = 2600, SUB = 1 / 120, POOL = 30;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

  // Every shape's outline on a radius of 1, around its geometric centre (y down).
  const arc = (r, n, from, to) => Array.from({ length: n }, (_, i) => { const a = from + (to - from) * i / (n - 1); return [Math.cos(a) * r, Math.sin(a) * r]; });
  const KINDS = {
    square: [[[-0.78, -0.78], [0.78, -0.78], [0.78, 0.78], [-0.78, 0.78]]],
    half: [arc(1.05, 21, Math.PI, TAU).map(([a, b]) => [a, b + 0.42])],
    tri: [[[-1, 0.72], [1.05, 0.78], [0.2, -1]]],
    bar: [[[-1.3, -0.34], [1.3, -0.34], [1.3, 0.34], [-1.3, 0.34]]],
    ring: [arc(1, 33, 0, TAU).slice(0, 32), arc(0.52, 25, 0, TAU).slice(0, 24)],
    ell: [[[-0.92, -1], [-0.22, -1], [-0.22, 0.2], [1, 0.2], [1, 0.92], [-0.92, 0.92]]],
    lozenge: [[[0, -1.15], [0.72, 0], [0, 1.15], [-0.72, 0]]],
  };
  const ORDER = ['square', 'ring', 'tri', 'bar', 'half', 'ell', 'lozenge', 'tri', 'square', 'half', 'bar', 'lozenge', 'ring', 'ell'];
  const RADII = [50, 24, 36, 40, 18, 30, 21, 46, 17, 34, 27, 20, 38, 23, 16, 31, 44, 19, 26, 35, 15, 29, 22, 41, 18, 33, 25, 16, 37, 20];
  const INKS = [0, 2, 1, 3, 0, 1, 2, 0, 3, 1];  // index in the palette below, shuffled by hand so neighbours differ
  const BLACK = [24, 20, 16], BONE = [240, 232, 212], BRICK = [176, 56, 38], TEAL = [18, 92, 96];
  const DARK = [66, 56, 34], GROUND = [216, 168, 56], NIGHT = [14, 11, 6];

  // The song's own scales, so a quiet recording still has its "hardest" attacks and a narrow one still moves the goal.
  let velsN = null, velsC = null, tops = null;
  const rankIn = (arr, v) => { if (!arr.length) return 0.5; let a = 0, b = arr.length; while (a < b) { const k = (a + b) >> 1; if (arr[k] < v) a = k + 1; else b = k; } return a / arr.length; };
  function scales() {
    if (velsN) return;
    velsN = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    const ch = typeof CHORDS !== 'undefined' ? CHORDS : [];
    velsC = ch.map(force).sort((a, b) => a - b); tops = ch.map((c) => c.hi).sort((a, b) => a - b);
  }
  const force = (c) => c.vel * (1 + 0.07 * Math.min(8, c.notes.length - 1));

  let shapes = [], zc = 0, goal = -1, march = 1, lastGoal = -9, lastAll = -9, tilt = 0, tiltV = 0, lastJolt = -9, budget = 4, song = 0, acc = 0, lineW = 0, jolt = 0;

  function build(x) {
    shapes = []; zc = 0;
    const F = floorAt(x);
    for (let i = 0; i < POOL; i++) {
      const kind = KINDS[ORDER[i % ORDER.length]], r = RADII[i];
      const ox = x.rnd(-0.2, 0.2), oy = x.rnd(0.05, 0.26);    // the weight is low and to one side: nothing sits level for long
      const polys = kind.map((p) => p.map(([a, b]) => [a + ox, b - oy]));
      shapes.push({
        i, r, polys, kind: ORDER[i % ORDER.length], ink: INKS[i % INKS.length],
        cr: ORDER[i % ORDER.length] === 'bar' ? 0.62 : 0.82,
        x: x.rnd(0.1, 0.9) * x.W, y: F - r - x.rnd(0, 180), vx: 0, vy: 0, a: x.rnd(-0.6, 0.6), w: x.rnd(-3, 3),
        sq: 0, sqV: 0, crouch: 0, ground: 0, next: 0, float: 0, kicked: -9, z: i, slot: i, still: 0, on: false,
        dope: i === 2 ? 2.6 : x.rnd(0.6, 1.5), legs: i === 2 ? 0.5 : x.rnd(0.85, 1.15), err: x.rnd(-1, 1),   // number 2 is always the last one
      });
    }
    goal = -1;
  }
  const floorAt = (x) => x.H * 0.86;
  const fy = (x, px) => floorAt(x) + jolt + Math.tan(tilt) * (px - x.W / 2);

  // The ones in play, biggest first in .rank; slots laid out as one rough line around the goal.
  function roster(x) {
    const n = clamp(Math.round(x.p('crowd')), 1, POOL), k = x.p('size');
    const act = [];
    for (const s of shapes) { const on = s.i < n; if (on && !s.on) { s.y = floorAt(x) - 300; s.x = x.rnd(0.1, 0.9) * x.W; s.vy = 0; s.vx = 0; } s.on = on; if (on) act.push(s); }
    const bySize = [...act].sort((a, b) => b.r - a.r); bySize.forEach((s, i) => { s.rank = act.length > 1 ? i / (act.length - 1) : 0.5; });
    let sum = 0; for (const s of act) sum += 2 * s.r * k * 0.86;
    // Fix the slots whenever the crowd changes size, so nobody waits for a slot that no longer exists.
    const taken = new Set(); const free = []; for (const s of act) { if (s.slot < 0 || s.slot >= act.length || taken.has(s.slot)) free.push(s); else taken.add(s.slot); }
    let q = 0; for (const s of free) { while (taken.has(q)) q++; s.slot = q; taken.add(q); }
    lineW = Math.min(sum * 0.72, x.W * 0.58);
    if (goal < 0) goal = x.W / 2;
    return act;
  }

  function hop(s, x, dx) {
    const presK = 0.4 + 0.6 * x.p('presence');
    const panic = clamp(Math.abs(dx) / (x.W * 0.3), 0, 1), rush = x.p('rush');
    const trip = x.rnd() < 0.14;
    const R = s.r * x.p('size');
    const near = clamp(Math.abs(dx) / 90, 0.22, 1);        // nearly there: a small careful hop, still badly judged
    const hh = (95 * (1 - 0.62 * panic) + R * 0.75) * near * x.p('hop') * presK * s.legs * x.rnd(0.75, 1.25) * (trip ? 0.35 : 1);
    const vy = Math.sqrt(2 * G * Math.max(6, hh)), T = 2 * vy / G;
    const cap = (170 + 620 * panic) * rush * s.legs;
    s.vx = clamp(dx / T * x.rnd(1.05, 1.15 + 0.5 * near), -cap, cap);                // always a bit too far
    s.vy = -vy;
    const dir = dx >= 0 ? 1 : -1, wrong = x.rnd() < 0.15 ? -1 : 1;
    s.w = dir * wrong * x.rnd(3.5, 9) * Math.pow(38 / R, 0.6) * (0.3 + 0.7 * near) * (trip ? 2.1 : 1) * presK;  // always too much spin
    s.sqV -= 7; s.ground = 0; s.float = 0;
    if (x.rnd() < 0.6) s.z = ++zc;
  }

  function kick(s, n, loud, x) {
    const dis = x.p('disorder'), presK = 0.35 + 0.65 * x.p('presence'), R = s.r * x.p('size');
    const long = clamp((n.d - 0.45) / 1, 0, 1), short = clamp((0.18 - n.d) / 0.12, 0, 1);
    const limit = floorAt(x) - 40;
    const h = Math.min(limit, (16 + 250 * Math.pow(loud, 1.9)) * dis * presK * Math.pow(32 / R, 0.25) * (1 + 0.15 * long) * (1 - 0.45 * short) * x.rnd(0.8, 1.2));
    s.vy = -Math.sqrt(2 * G * h);
    s.vx += x.rnd(-1, 1) * (40 + 230 * loud) * dis * presK;
    s.w += (x.rnd() < 0.5 ? -1 : 1) * x.rnd(0.6, 1) * (3 + 14 * loud) * dis * presK * Math.pow(40 / R, 0.7) * (1 + 0.7 * short);
    s.float = long * 0.9; s.ground = 0; s.crouch = 0; s.sqV -= 5 + 7 * loud; s.kicked = song; s.content = false;
    s.next = song + x.rnd(0.08, 0.34) * s.dope;                        // the late reaction
    if (x.rnd() < 0.7) s.z = ++zc;
  }

  function physics(act, x, h) {
    const k = x.p('size'), W = x.W, cos = Math.cos(tilt), sin = Math.sin(tilt), nx = sin, ny = -cos, tx = cos, ty = sin;
    const slide = Math.abs(tilt) > 0.012;
    for (const s of act) {
      const R = s.r * k, m = R * R, I = m * R * R * 0.42;
      s.float = Math.max(0, s.float - h);
      s.vy += G * (s.float > 0 && s.vy > -500 ? 0.3 : 1) * h;
      s.x += s.vx * h; s.y += s.vy * h; s.a += s.w * h; s.ground = Math.max(0, s.ground - h);
      if (s.x < R * 0.9) { s.x = R * 0.9; s.vx = Math.abs(s.vx) * 0.55; s.w *= -0.6; }
      if (s.x > W - R * 0.9) { s.x = W - R * 0.9; s.vx = -Math.abs(s.vx) * 0.55; s.w *= -0.6; }
      // The floor: every corner that touches it pushes back at that corner, so a bad landing really does tip the shape.
      const c = Math.cos(s.a), sn = Math.sin(s.a), pts = s.polys[0];
      let deepest = 0, contacts = 0;
      for (let pass = 0; pass < 2; pass++) {
        for (const p of pts) {
          const rx = (c * p[0] - sn * p[1]) * R, ry = (sn * p[0] + c * p[1]) * R, px = s.x + rx, py = s.y + ry;
          const depth = (py - fy(x, px)) * cos;
          if (depth <= -0.4) continue;
          if (pass === 0) { contacts++; if (depth > deepest) deepest = depth; }
          const vcx = s.vx - s.w * ry, vcy = s.vy + s.w * rx, vn = vcx * nx + vcy * ny;
          if (vn >= 0) continue;
          if (pass === 0 && vn < -170) {                               // a landing: squash, a wobble that takes too long to end
            const hit = Math.min(1, -vn / 1100);
            s.sqV += 3 + 15 * hit; s.next = Math.max(s.next, song + x.rnd(0.04, 0.22) * s.dope / x.p('rush'));
          }
          const rn = rx * ny - ry * nx, e = vn < -130 ? 0.34 : 0;
          const j = -(1 + e) * vn / (1 / m + rn * rn / I);
          s.vx += j * nx / m; s.vy += j * ny / m; s.w += rn * j / I;
          const vt = (s.vx - s.w * ry) * tx + (s.vy + s.w * rx) * ty, rt = rx * ty - ry * tx;
          const mu = slide ? 0.1 : 0.75, jt = clamp(-vt / (1 / m + rt * rt / I), -mu * j, mu * j);
          s.vx += jt * tx / m; s.vy += jt * ty / m; s.w += rt * jt / I;
        }
      }
      if (contacts) {
        s.x += nx * deepest; s.y += ny * deepest; s.ground = 0.07;
        s.w *= Math.exp(-h * (Math.abs(s.w) < 7 ? 2.2 : 0.9)); s.vx *= Math.exp(-h * (slide ? 0.1 : 1.3));
        if (contacts > 1 && Math.abs(s.w) < 1.6 && Math.abs(s.vy) < 40) { s.w *= 0.8; if (!slide) s.vx *= 0.92; }   // flat on the floor: the chatter dies
      }
      s.w = clamp(s.w * Math.exp(-h * 0.15), -30, 30);
      s.sqV += (-540 * s.sq + (s.crouch > 0 ? 540 * 0.3 : 0) - 6.5 * s.sqV) * h; s.sq += s.sqV * h;
    }
    // Each other: rough circles. The one on top gets to stand on the other; both get knocked round.
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j], ra = a.r * k * a.cr, rb = b.r * k * b.cr, dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, min = ra + rb;
      if (d2 >= min * min || d2 < 0.01) continue;
      const d = Math.sqrt(d2), nX = dx / d, nY = dy / d, over = min - d, ma = ra * ra, mb = rb * rb, sum = ma + mb;
      // A hard meeting knocks both about; a slow one is just two flat shapes sliding in front of each other, or nothing would ever settle.
      const closing = -((b.vx - a.vx) * nX + (b.vy - a.vy) * nY);
      if (closing < 110) {
        const creep = (a.content && b.content ? 0 : 26) * h;
        a.x -= Math.sign(nX) * creep * mb / sum; b.x += Math.sign(nX) * creep * ma / sum;
        continue;
      }
      const push = over * 0.6;
      a.x -= nX * push * mb / sum; a.y -= nY * push * mb / sum; b.x += nX * push * ma / sum; b.y += nY * push * ma / sum;
      const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * nX + rvy * nY;
      if (vn >= 0) continue;
      const jn = -(1.28) * vn / (1 / ma + 1 / mb);
      a.vx -= jn * nX / ma; a.vy -= jn * nY / ma; b.vx += jn * nX / mb; b.vy += jn * nY / mb;
      // sliding past each other turns into spin, and a real hit tips both over
      const tX = -nY, tY = nX, vt = rvx * tX + rvy * tY + a.w * ra + b.w * rb;
      a.w += vt * 0.32 / (ra * (1 + ma / mb)) * 2; b.w += vt * 0.32 / (rb * (1 + mb / ma)) * 2;
      const up = a.y < b.y ? a : b, low = up === a ? b : a;
      if (-vn > 170) {
        const hit = Math.min(1, -vn / 900), side = (up.x > low.x ? -1 : 1);
        low.w += side * (1.5 + 7 * hit) * Math.pow(38 / (low.r * k), 0.6);
        up.w -= side * (1 + 5 * hit) * Math.pow(38 / (up.r * k), 0.6);
        low.sqV += 2 + 7 * hit; low.next = Math.max(low.next, song + 0.12 * low.dope);
        up.z = Math.max(up.z, ++zc);
      }
      if (Math.abs(nY) > 0.6) up.ground = Math.max(up.ground, 0.05);    // standing on a back counts as a place to hop from
    }
    for (const s of act) {                                              // nobody leaves through the top, however hard the hit
      if (s.vy < 0) s.vy = Math.max(s.vy, -Math.sqrt(2 * G * Math.max(0, s.y - x.H * Math.max(0.06, 0.42 - 0.16 * x.p('disorder')))));
      s.vx = clamp(s.vx, -1100, 1100);
    }
  }

  function brain(act, x, dt) {
    const n = act.length, sp = n > 1 ? lineW / n : 0, rush = x.p('rush'), pres = x.p('presence');
    const movers = Math.ceil(n * (0.18 + 0.82 * pres));
    budget = Math.min(4, budget + dt * 5);
    for (const s of act) {
      const R = s.r * x.p('size');
      if (s.i >= movers) { s.crouch = 0; continue; }                   // turned down: some of them just sit it out
      const target = clamp(goal + (s.slot - (n - 1) / 2) * sp + s.err * sp * 0.22, R, x.W - R), dx = target - s.x;
      if (s.crouch > 0) { s.crouch -= dt; if (s.crouch <= 0) { s.crouch = 0; hop(s, x, target - s.x); } continue; }
      if (s.ground <= 0 || song < s.next) continue;
      const quiet = clamp((song - s.kicked) / 2.5, 0, 1);
      const tol = (10 + R * 0.5 + 26 * quiet) * (s.content ? 2.2 : 1), off = Math.abs(dx) >= tol;
      s.content = !off;
      const tipped = !off && Math.abs(Math.sin(s.a)) > 0.8 && Math.abs(s.w) < 0.5;   // lying on its side: one more try, in a while
      s.still = tipped ? s.still + dt : 0;
      if (off || s.still > 1.6) {
        const panic = clamp(Math.abs(dx) / (x.W * 0.3), 0, 1);
        s.crouch = (0.15 - 0.1 * panic) * x.rnd(0.7, 1.3) * s.dope / rush; s.still = 0;
        s.next = song + 0.25;                                          // once crouched, it goes
      }
    }
  }

  function attack(ch, x, act) {
    song = x.t;
    const pres = x.p('presence');
    // How present: only the hardest attacks of this song get through when it is turned down (all the notes' scale).
    const cut = (1 - pres) * 0.95;
    if (cut > 0 && rankIn(velsN, ch.vel) < cut) return;
    const fr = rankIn(velsC, force(ch)), W = x.W, many = ch.notes.length;
    // The goal jumps: top note, on this song's own range. A repeat of the same note marches it on instead.
    if (song - lastGoal > 0.3 + 0.05 * Math.min(10, x.rate) || (many >= 4 && song - lastGoal > 0.25)) {
      const half = Math.min(lineW / 2, W * 0.36) + 30;
      let g = half + rankIn(tops, ch.hi) * (W - 2 * half);
      if (Math.abs(g - goal) < W * 0.14) { g = goal + march * x.rnd(0.14, 0.3) * W; if (g < half || g > W - half) { march = -march; g = goal + march * x.rnd(0.14, 0.3) * W; } }
      goal = clamp(g, half, W - half); lastGoal = song;
    }
    // The kicks: in a storm of notes only so many get through, or the picture would just boil.
    const everyone = (many >= 5 || fr > 0.95) && song - lastAll > 0.42;
    const dense = 1 / (1 + 0.11 * x.rate);
    const movers = Math.ceil(act.length * (0.18 + 0.82 * pres)), crew = act.filter((s) => s.i < movers);
    if (everyone) {
      lastAll = song;
      const n = ch.notes[0];
      for (const s of crew) {
        const q = ch.notes[Math.floor(x.rnd() * many)] || n;
        const loud = clamp(0.25 + 0.75 * rankIn(velsN, q.v), 0, 1) * x.rnd(0.55, 1);
        kick(s, q, loud * dense, x);
      }
    } else {
      for (const q of ch.notes) {
        if (budget < 1 && fr < 0.75) continue;
        budget = Math.max(0, budget - 1);
        const p = rankIn(tops, q.m) * 0.5 + x.pitch01(q.m) * 0.5;
        let best = null, score = 9;
        for (const s of crew) { if (song - s.kicked < 0.2) continue; const d = Math.abs(s.rank - (1 - p)) + x.rnd(0, 0.28); if (d < score) { score = d; best = s; } }
        if (best) kick(best, q, rankIn(velsN, q.v) * dense, x);
        // a soft note is a stumble for the neighbours, and a big one hits a few more
        const extra = Math.floor(fr * 2.6);
        for (let i = 0; i < extra; i++) { const s = crew[Math.floor(x.rnd() * crew.length)]; if (s && song - s.kicked > 0.2) kick(s, q, rankIn(velsN, q.v) * 0.7 * dense, x); }
      }
    }
    // Disorder also means the order is gone: some swap places, so they have to go over each other to get back.
    const swaps = Math.round(act.length * (0.08 + 0.3 * fr) * x.p('disorder') * dense);
    for (let i = 0; i < swaps; i++) {
      const a = crew[Math.floor(x.rnd() * crew.length)]; if (!a) break;
      const to = clamp(a.slot + Math.round(x.rnd(-5, 5)), 0, act.length - 1), b = act.find((s) => s.slot === to);
      if (b && b !== a) { b.slot = a.slot; a.slot = to; }
    }
    // The biggest of the piece jolt the floor: it tilts, they lose their footing and slide into a heap.
    if (fr > 0.965 && song - lastJolt > 1.8) {
      lastJolt = song; tiltV += (x.rnd() < 0.5 ? -1 : 1) * (0.62 + 0.4 * x.rnd()) * x.p('disorder') * (0.3 + 0.7 * pres); jolt = 16 * pres;
    }
  }

  TOOLS.push({
    id: 'clumsy', name: 'Clumsy', tag: 'new',
    blurb: 'A crowd of mismatched shapes hop towards a line and never make it: bad landings, too much spin, the last one still scrambling. Every attack moves the goal and knocks them over again, and they land on each other.',
    params: [
      { key: 'crowd', label: 'how many', min: 3, max: 30, step: 1, value: 16,
        hint: 'How many shapes are trying to keep up. Left: three or four. Right: a jostling mob.',
        icon: ICON.of.count(22, '#b03826') },
      { key: 'disorder', label: 'how hard an attack knocks them', min: 0.2, max: 2, value: 1,
        hint: 'What an attack does to them. Left: a stumble. Right: everything flies.',
        icon: (g, v, w, h) => { const R = ICON.rng(5); for (let i = 0; i < 6; i++) { const f = i / 5, xx = 4 + f * (w - 8), yy = h - 5 - R() * v * (h - 10), rr = 1.2 + (R() - 0.5) * 6 * v; ICON.square(g, xx, yy, 5, i % 2 ? ICON.ink : ICON.red, rr); } } },
      { key: 'rush', label: 'how fast they scramble back', min: 0.3, max: 2, value: 1,
        hint: 'How they hurry back into line. Left: they plod. Right: frantic little hops.',
        icon: (g, v, w, h) => { const n = 1 + Math.round(v * 4), s = (w - 6) / n; for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(3 + i * s, h - 5); g.quadraticCurveTo(3 + (i + 0.5) * s, h - 5 - (16 - 8 * v) * 1.4, 3 + (i + 1) * s, h - 5); g.stroke(); } } },
      { key: 'hop', label: 'how high they hop', min: 0.25, max: 2.2, value: 1,
        hint: 'How high each hop goes. Left: shuffling along the floor. Right: huge bounces.',
        icon: (g, v, w, h) => { g.beginPath(); g.moveTo(4, h - 4); g.quadraticCurveTo(w / 2, h - 4 - (4 + v * 36), w - 4, h - 4); g.stroke(); ICON.square(g, w / 2, h - 4 - (2 + v * 18), 6, ICON.red); } },
      { key: 'size', label: 'how big they are', min: 0.5, max: 2, value: 1.25,
        hint: 'How big the shapes are. Left: small bits. Right: great lumps.',
        icon: (g, v, w, h) => ICON.square(g, w / 2, h / 2, 4 + v * (h - 6), ICON.red, 0.3) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: the ground goes dark, few shapes move, and only the hardest attacks reach them. Right: broad daylight, every attack knocks them about.',
        icon: (g, v, w, h) => { ICON.rect(g, 3, 3, w - 6, h - 6, ICON.lerp('#120e06', '#d8a838', v)); ICON.alpha(g, 0.2 + 0.8 * v, () => ICON.square(g, w / 2, h / 2, 10, ICON.red, 0.4)); } },
    ],
    reset(x) { velsN = null; shapes = []; zc = 0; tilt = 0; tiltV = 0; jolt = 0; lastJolt = -9; lastGoal = -9; lastAll = -9; budget = 4; goal = -1; acc = 0; song = x.t || 0; march = 1; },
    onChord(ch, x) {
      scales(); if (!shapes.length) build(x);
      attack(ch, x, roster(x));
    },
    frame(x) {
      scales(); if (!shapes.length) build(x);
      const g = x.g, W = x.W, H = x.H, dt = x.dt, pres = x.p('presence');
      song = x.t;
      const act = roster(x);
      if (dt > 0) {
        brain(act, x, dt);
        acc = Math.min(acc + dt, 0.06);
        while (acc >= SUB) {
          physics(act, x, SUB); acc -= SUB;
          // the floor comes back like a tray put down badly
          tiltV += (-46 * tilt - 3.4 * tiltV) * SUB; tilt += tiltV * SUB; jolt *= Math.exp(-SUB * 14);
        }
      }
      // The ground: flat mustard, going dark and letting what's underneath through as the widget goes quiet.
      const ground = rgb(mix(NIGHT, GROUND, pres));
      g.globalAlpha = 0.6 + 0.4 * pres; g.fillStyle = ground; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      const fade = pres, inks = [mix(DARK, BLACK, fade), mix(DARK, BONE, 0.25 + 0.75 * fade), mix(DARK, BRICK, 0.25 + 0.75 * fade), mix(DARK, TEAL, 0.25 + 0.75 * fade)].map(rgb);
      g.lineCap = 'butt'; g.lineJoin = 'round';
      // Shapes: flat, hard-edged, cut out of each other with a thin line of the ground, in an order that keeps changing.
      const k = x.p('size'), order = [...act].sort((a, b) => a.z - b.z);
      g.globalAlpha = 0.3 + 0.7 * pres; g.lineWidth = 3; g.strokeStyle = ground;
      for (const s of order) {
        const R = s.r * k, q = clamp(s.sq, -0.32, 0.42);
        g.save();
        g.translate(s.x, s.y + R * 0.8); g.scale(1 + q * 0.75, 1 - q); g.translate(0, -R * 0.8);
        g.rotate(s.a);
        g.beginPath();
        for (const poly of s.polys) { poly.forEach((p, i) => { const px = p[0] * R, py = p[1] * R; if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.closePath(); }
        g.fillStyle = inks[s.ink]; g.fill('evenodd'); g.stroke();
        g.restore();
      }
      g.globalAlpha = 1;
      // The floor line, and nothing else; last, so they stand on it cleanly.
      g.strokeStyle = inks[0]; g.lineWidth = 9; g.beginPath(); g.moveTo(-20, fy(x, -20) + 4.5); g.lineTo(W + 20, fy(x, W + 20) + 4.5); g.stroke();
    },
  });
})();
