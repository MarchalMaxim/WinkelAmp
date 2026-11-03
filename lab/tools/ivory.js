// Ivory (the user: "the feeling of the sound that ivory makes: crisp, elegant, clean, milky", heard in the rising theme of
// Rachmaninoff's second concerto, first movement). One white key per picked note, standing up like a bar chart: where it stands
// and how tall both follow pitch. Keys lean a little, overlap and differ a little. Every key stays until the highest note, so
// the widget has a limited number of attacks. A line that starts nearer the top than the bottom falls instead, and then
// everything is mirrored in time: it ends on the lowest note. The note at the end is a stomp: a very faint crater pressed into the ground, a jolt, and
// a ripple running out of the crater through the keys, shifting only the slice of each key it is passing through. Two seconds
// later the keys and the crater age away quickly and together (the user: a dissolve "implies some sort of attack", so nothing
// travels or takes turns here), and the widget stays empty. Picked notes after the stomp are ignored.
// All of it is worked out from the notes in advance, so every frame is a function of song time: a seek needs no replay.
(() => {
  const W = 1280, H = 720, BASE = H * 0.88, TOP = BASE * 0.9;
  const RISE = 0.2, HOLD = 2, AGE = 1.5, RIPPLE_FOR = 3.2, FRONT = 430;   // seconds; FRONT: units a second the ripple runs at
  const MAX_ATTACKS = 60, THIN_TO = 36;                                   // more than this was not picked by hand: the prominent ones only
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /** The chord's loudest attacks, spaced out over the piece: what a song without picked notes gets. */
  function thin(chords) {
    const span = Math.max(1, chords[chords.length - 1].t - chords[0].t), gap = span / (THIN_TO * 1.5), kept = [];
    const byLoud = chords.map((c) => ({ t: c.t, m: c.hi, v: c.vel })).sort((a, b) => b.v - a.v || a.t - b.t);
    for (const c of byLoud) {
      if (kept.length >= THIN_TO) break;
      if (kept.every((k) => Math.abs(k.t - c.t) >= gap)) kept.push(c);
    }
    return kept.sort((a, b) => a.t - b.t);
  }
  /** What will happen: the keys in order of their first note, and the time of the stomp (null without notes). */
  function planOf(chords) {
    let hits = [];
    for (const c of chords) for (const n of c.notes) hits.push({ t: c.t, m: n.m });
    if (hits.length > MAX_ATTACKS) hits = thin(chords);
    if (!hits.length) return { keys: [], stomp: null };
    const ms = hits.map((h) => h.m), hi = Math.max(...ms), low = Math.min(...ms);
    const opening = hits.filter((h) => h.t === hits[0].t), start = opening.reduce((a, h) => a + h.m, 0) / opening.length;
    const end = start > (hi + low) / 2 ? low : hi;                             // where the line is heading: down from up there, else up
    const stomp = Math.max(...hits.filter((h) => h.m === end).map((h) => h.t));   // that note played twice: the last of them
    const byPitch = new Map();
    for (const h of hits) {
      if (h.t > stomp) continue;
      const k = byPitch.get(h.m);
      if (k) { if (h.t > k.hits[k.hits.length - 1]) k.hits.push(h.t); }
      else byPitch.set(h.m, { m: h.m, t: h.t, hits: [h.t] });
    }
    const keys = [...byPitch.values()].sort((a, b) => a.t - b.t || a.m - b.m);
    const pitches = keys.map((k) => k.m), lo = Math.min(...pitches), span = Math.max(1, Math.max(...pitches) - lo);
    const wide = clamp(W * 0.84 / Math.max(1, keys.length - 1) * 2.1, 34, 84);
    const across = clamp(keys.length * wide * 0.72, W * 0.4, W * 0.84), left = (W - across) / 2;   // a short line stays together
    for (const k of keys) {
      const R = rng(k.m * 7919 + 13), u = (k.m - lo) / span;
      k.w = wide * (0.88 + R() * 0.26);
      k.h = TOP * (0.2 + 0.78 * u) * (0.97 + R() * 0.06);
      k.foot = left + u * across + (R() - 0.5) * wide * 0.25;
      k.angle = (R() < 0.5 ? -1 : 1) * (0.022 + R() * 0.06);
      k.full = k.h + 30;           // it stands in the ground: a lean never shows its foot
    }
    return { keys, stomp, end };
  }

  // One hairline: dark, with a pale line beside it, so it reads as cut into the surface.
  function hairline(g, R, w, h) {
    const pts = [[w * (0.15 + R() * 0.7), R() * h * 0.7]], dir = R() < 0.5 ? 1 : -1, len = h * (0.3 + R() * 0.4), step = Math.max(2, h / 40);
    let dx = (R() - 0.5) * 0.1;
    for (let d = 0; d < len; d += step) {
      dx = clamp(dx + (R() - 0.5) * 0.09, -0.14, 0.14);
      if (R() < 0.05) dx += (R() - 0.5) * 0.5;
      const p = pts[pts.length - 1], nx = p[0] + dx * step, ny = p[1] + dir * step;
      pts.push([nx, ny]);
      if (ny < 0 || ny > h || nx < 0 || nx > w) break;
    }
    const lw = clamp(w * 0.006, 0.45, 0.9) * 0.8, alpha = 0.28 + R() * 0.16;
    const line = (ox) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] + ox, p[1] + ox) : g.moveTo(p[0] + ox, p[1] + ox))); };
    g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round';
    line(lw * 0.7); g.strokeStyle = `rgba(255,252,240,${alpha * 0.8})`; g.stroke();
    line(0); g.strokeStyle = `rgba(66,48,26,${alpha})`; g.stroke();
  }
  // The key's picture, at the shared canvas's real resolution: milk white, faint grain, a lit top and a shade towards the ground.
  function texture(k, rs, cracks) {
    const c = document.createElement('canvas'); c.width = Math.ceil(k.w * rs); c.height = Math.ceil(k.full * rs);
    const g = c.getContext('2d'), R = rng(k.m * 104729 + 5), w = k.w, h = k.full; g.scale(rs, rs);
    g.beginPath(); g.roundRect(0, 0, w, h, Math.min(w * 0.1, 6)); g.clip();
    const fill = (x0, y0, x1, y1, stops, rx, ry, rw, rh) => { const e = g.createLinearGradient(x0, y0, x1, y1); for (const [at, col] of stops) e.addColorStop(at, col); g.fillStyle = e; g.fillRect(rx, ry, rw, rh); };
    fill(0, 0, w, 0, [[0, 'rgb(241,235,222)'], [0.14, 'rgb(251,248,241)'], [0.86, 'rgb(251,248,241)'], [1, 'rgb(241,235,222)']], 0, 0, w, h);
    for (let i = 0; i < w * 1.6; i++) { const x = R() * w, y0 = R() * h * 0.6, len = h * (0.2 + R() * 0.8); g.strokeStyle = `rgba(120,92,52,${R() * 0.012})`; g.lineWidth = 0.5 + R() * 0.5; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (R() - 0.5) * 1.4, y0 + len); g.stroke(); }
    for (let n = Math.floor(cracks + R()); n > 0; n--) hairline(g, R, w, h);
    fill(0, 0, w * 0.07, 0, [[0, 'rgba(255,255,250,0.75)'], [1, 'rgba(255,255,250,0)']], 0, 0, w * 0.07, h);
    fill(w * 0.93, 0, w, 0, [[0, 'rgba(70,50,25,0)'], [1, 'rgba(70,50,25,0.3)']], w * 0.93, 0, w * 0.07, h);
    fill(0, h * 0.2, 0, h, [[0, 'rgba(125,104,74,0)'], [0.6, 'rgba(125,104,74,0.09)'], [1, 'rgba(125,104,74,0.34)']], 0, 0, w, h);
    fill(0, 0, 0, 7, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']], 0, 0, w, 7);
    fill(w * 0.18, 0, w * 0.5, 0, [[0, 'rgba(255,255,255,0)'], [0.6, 'rgba(255,255,255,0.28)'], [1, 'rgba(255,255,255,0)']], w * 0.18, 0, w * 0.32, h);
    return c;
  }

  // Where the crater lies: behind the keys, seen straight on, or a flat oval on the floor.
  const craterAt = (keys, end, floor) => {
    const foot = keys.find((k) => k.m === end).foot, off = foot < W / 2 ? 1 : -1;   // towards the middle of the picture
    return floor ? { cx: foot + off * W * 0.1, cy: BASE + 10, R: W * 0.33, sq: 0.2 } : { cx: foot + off * W * 0.12, cy: BASE - H * 0.2, R: H * 0.4, sq: 1 };
  };
  // The relief, lit from the upper left: one sheet of light and one of shadow, at half size (it is all soft).
  function relief(where) {
    const sw = W / 2, sh = H / 2, lit = new ImageData(sw, sh), dark = new ImageData(sw, sh), R = rng(31), R0 = where.R;
    const hf = (q) => (q < 1 ? -(1 - q * q) : 0) + 0.1 * Math.exp(-(((q - 1) / 0.2) ** 2));
    for (let py = 0; py < sh; py++) for (let px = 0; px < sw; px++) {
      const dx = px * 2 - where.cx, dy = (py * 2 - where.cy) / where.sq, r = Math.hypot(dx, dy), grain = 0.85 + 0.3 * R();
      if (r > R0 * 1.6 || r < 0.001) continue;
      const th = Math.atan2(dy, dx), rim = R0 * (1 + 0.05 * Math.sin(3 * th + 1) + 0.03 * Math.sin(7 * th + 2) + 0.015 * Math.sin(13 * th)), q = r / rim;
      const slope = (hf(q + 0.01) - hf(q - 0.01)) / 0.02, shade = slope * (dx / r * 0.6 + dy / r * 0.75) * 0.45 * grain, i = (py * sw + px) * 4;
      if (shade > 0) { lit.data[i] = 246; lit.data[i + 1] = 236; lit.data[i + 2] = 216; lit.data[i + 3] = Math.min(255, shade * 255); }
      else dark.data[i + 3] = Math.min(255, -shade * 255);
    }
    const sheet = (img) => { const c = document.createElement('canvas'); c.width = sw; c.height = sh; c.getContext('2d').putImageData(img, 0, 0); return c; };
    return { lit: sheet(lit), dark: sheet(dark) };
  }

  // Ageing, multiplied over the key so its grain and cracks stay: white to cream to honey to umber to nearly black.
  const AGED = [[255, 255, 255], [250, 232, 192], [214, 170, 105], [92, 60, 32], [14, 10, 6]];
  function aged(u) {
    const f = clamp(u, 0, 1) * (AGED.length - 1), i = Math.min(AGED.length - 2, Math.floor(f)), t = smooth(f - i);
    return `rgb(${AGED[i].map((v, c) => Math.round(v + (AGED[i + 1][c] - v) * t)).join(',')})`;
  }
  // The shared canvas keeps what was drawn and fades it a little each frame (12 %), so anything drawn every frame at some
  // alpha builds up. This is the alpha that settles at `want` over black.
  const settles = (want) => { const f = 0.12; want = clamp(want, 0, 1); return want >= 1 ? 1 : want * f / (1 - want * (1 - f)); };

  let plan = null, sheets = null, sheetsFor = -1;
  const planNow = () => plan || (plan = planOf(typeof CHORDS !== 'undefined' ? CHORDS : []));
  const seen = (t) => ({ keys: planNow().keys.filter((k) => k.t <= t), stomp: plan.stomp });

  // One key in its own leaning frame: the foot at the origin, standing up towards -y.
  function drawKey(g, where, k, keyTop, sh, amp, rs) {
    const L = -k.w / 2, r = Math.min(k.w * 0.1, 6), px = 1 / rs;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 9; g.shadowOffsetX = -3; g.fillStyle = '#f4efe3';
    g.beginPath(); g.roundRect(L, keyTop, k.w, k.full, r); g.fill(); g.restore();
    if (!(amp > 0 && sh > 0 && sh < RIPPLE_FOR)) { g.drawImage(k.img, L, keyTop, k.w, k.full); return; }
    const ca = Math.cos(k.angle), sa = Math.sin(k.angle), run = sh * FRONT, row = 3, end = keyTop + k.full, iw = k.img.width;
    const still = (y0, y1) => { if (y1 > y0) g.drawImage(k.img, 0, (y0 - keyTop) * rs, iw, Math.min((y1 - y0 + px) * rs, k.img.height - (y0 - keyTop) * rs), L, y0, k.w, y1 - y0 + px); };
    let from = keyTop;
    for (let y = keyTop; y < end; y += row) {
      const d = Math.hypot(k.foot - sa * y - where.cx, BASE + ca * y - where.cy) - run, e = d > 0 ? Math.exp(-(d * d) / 500) : Math.exp(d / 60);
      const ox = Math.round(amp * e * Math.sin(y * 0.24 + sh * 30) * Math.exp(-sh / 1.1) * rs) * px;
      if (!ox) continue;
      still(from, y); from = y + row;
      g.drawImage(k.img, 0, (y - keyTop) * rs, iw, Math.min((row + px) * rs, k.img.height - (y - keyTop) * rs), L + ox, y, k.w, row + px);
    }
    still(from, end);
  }

  TOOLS.push({
    id: 'ivory', name: 'Ivory', tag: 'new',
    blurb: 'One white key for each picked note, standing up like a bar chart: where it stands and how tall both follow the pitch. They stay. On the last note of the climb, or of the descent if the line falls, the ground takes a very faint crater and a ripple runs out of it through the keys; two seconds later everything ages and is gone, for good. Made for a line of notes picked by hand.',
    plan: planOf,
    params: [
      { key: 'floor', label: 'where the crater is', min: 0, max: 1, step: 1, value: 0,
        hint: 'Left: round, behind the keys, as if you look down at the ground. Right: a flat oval on the floor under them.',
        icon: (g, v, w, h) => { g.beginPath(); g.ellipse(w / 2, h / 2 + v * 6, w * 0.32, h * 0.38 * (1 - v * 0.7), 0, 0, 6.3); g.strokeStyle = ICON.ink; g.stroke(); } },
      { key: 'crater', label: 'how deep the crater is', min: 0, max: 1, value: 0.35,
        hint: 'Left: nothing to see. Right: a clear dent. Very subtle by default.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => ICON.ring(g, w / 2, h / 2, h * 0.36, ICON.ink, 2)) },
      { key: 'ripple', label: 'how far the ripple shifts them', min: 0, max: 8, value: 2.6,
        hint: 'How far the slices of a key move as the ripple goes through. Left: not at all. Right: they shake.',
        icon: (g, v, w, h) => ICON.wave(g, w, h, v, 3, ICON.ink, 1.5) },
      { key: 'cracks', label: 'how many cracks', min: 0, max: 8, value: 1.5,
        hint: 'Hairline cracks on each key. Left: spotless. Right: well worn.',
        icon: (g, v, w, h) => ICON.lines(g, Math.round(v * 6), w, h, { dir: 'v' }) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How strongly it all shows. Left: not at all. Right: fully.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => ICON.rect(g, w * 0.3, 4, w * 0.4, h - 8, ICON.ink)) },
    ],
    onChord() {},
    reset() {},
    frame(x) {
      const { keys, stomp } = seen(x.t), pres = x.p('presence');
      if (!keys.length || pres <= 0) return;
      const after = (x.t - stomp - HOLD) / AGE;
      if (after >= 1) return;
      const g = x.g, rs = x.canvas.width / W, cracks = Math.round(x.p('cracks') * 2) / 2, sh = x.t - stomp - 0.06, floor = x.p('floor') >= 0.5 ? 1 : 0;
      const gone = 1 - smooth((after - 0.8) / 0.2), where = craterAt(plan.keys, plan.end, floor);
      if (sheetsFor !== floor) { sheets = relief(where); sheetsFor = floor; }
      if (sh > 0) {
        const pressed = smooth(sh / 0.09), deep = x.p('crater');
        g.globalAlpha = settles(pres * pressed * deep * 0.8 * (1 - smooth(after)));
        g.drawImage(sheets.dark, 0, 0, W, H); g.drawImage(sheets.lit, 0, 0, W, H);
        g.globalAlpha = pres * Math.exp(-sh / 0.3) * 0.35 * deep; g.strokeStyle = 'rgb(246,236,216)'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(where.cx, where.cy, where.R * (1 + sh * 1.1), where.R * (1 + sh * 1.1) * where.sq, 0, 0, 6.3); g.stroke();
      }
      const jolt = sh > 0 ? 2.4 * Math.exp(-sh / 0.08) * Math.cos(sh * 55) : 0, amp = x.p('ripple');
      g.globalAlpha = settles(pres * gone);
      g.save(); g.beginPath(); g.rect(0, 0, W, BASE + jolt); g.clip();   // they stand in the ground
      for (const k of keys) {
        if (!k.img || k.imgRs !== rs || k.imgCracks !== cracks) { k.img = texture(k, rs, cracks); k.imgRs = rs; k.imgCracks = cracks; }
        const a = (x.t - k.t) / RISE, risen = a >= 1 ? 1 : 1 - Math.pow(1 - a, 3);
        let last = k.t; for (const t of k.hits) if (t <= x.t) last = t;
        const dip = last > k.t ? Math.min(10, k.h * 0.04) * Math.exp(-(x.t - last) / 0.18) : 0;   // the same pitch again
        const keyTop = -k.h + (1 - risen) * k.full + dip;
        g.save(); g.translate(k.foot, BASE + jolt); g.rotate(k.angle);
        drawKey(g, where, k, keyTop, sh, amp, rs);
        if (after > 0) { g.globalCompositeOperation = 'multiply'; g.fillStyle = aged(after); g.beginPath(); g.roundRect(-k.w / 2, keyTop, k.w, k.full, Math.min(k.w * 0.1, 6)); g.fill(); g.globalCompositeOperation = 'source-over'; }
        g.restore();
      }
      g.restore();
    },
  });
})();
