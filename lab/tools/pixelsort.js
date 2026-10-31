// Pixel sort: a sibling of the casket cuts and the glitch blocks. Every chord grabs a strip of the picture at the attack
// and sorts it by brightness, so the strip is pulled out into streaks: brightest at the attack, running dark toward the tip.
// Direction follows pitch: bass notes smear downward, high notes upward, the middle smears sideways with the melody
// (rising: right, falling: left); a big chord with bass and treble tears both ways at once. Loud chords smear further.
// The streaks hold, then shrink back into the attack and fade. It sorts whatever the other widgets drew, and adds a
// gradient of its own colour (low = deep red, middle = amber, high = bone) so it also shows alone.
// It works on a low-res copy (1/5 size) and draws chunky pixels. It draws AFTER all the other widgets each frame (a
// microtask queued from frame()), so it smears the finished picture instead of being painted over.
(() => {
  const W = 1280, H = 720, S = 5, LW = W / S, LH = H / S;         // low-res grid: 256 × 144 cells of 5 px
  const TW = 220, TH = 48, MAXN = 44, MAXSTREAKS = 36;              // tile size (cells), lines per streak, live streaks
  const EMPTY = new Uint8ClampedArray(LW * LH * 4);
  let pix = EMPTY, lastKick = -1, busy = false, gen = 0;           // pix: the low-res picture (RGBA), refreshed in the background
  const pool = [];                                                  // spare tile canvases
  const tile = () => pool.pop() || (() => { const c = document.createElement('canvas'); c.width = TW; c.height = TH; return { c, cg: c.getContext('2d') }; })();
  let streaks = [], pending = [], lastTop = 60, flip = 1, queued = false;
  const R = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Loudness relative to this recording (its 93rd-percentile note velocity), so both songs reach the long smears.
  let VQ = 0;
  const power = (v) => {
    if (!VQ) { const v2 = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b); VQ = v2.length ? Math.max(70, v2[Math.floor(v2.length * 0.93)]) : 100; }
    return clamp((v * 100 / VQ - 45) / 58, 0, 1);
  };
  // its own colour by pitch: deep red → red → amber → bone
  const STOPS = [[0, [150, 14, 20]], [0.3, [205, 30, 24]], [0.55, [226, 150, 40]], [0.8, [236, 226, 200]], [1, [210, 226, 240]]];
  const colour = (p) => { for (let i = 1; i < STOPS.length; i++) if (p <= STOPS[i][0]) { const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], k = (p - a) / (b - a); return ca.map((c, j) => c + (cb[j] - c) * k); } return STOPS[4][1]; };
  const HOT = [255, 246, 228];
  // directions: right, down, left, up (angle, dx, dy)
  const DIRS = { right: [0, 1, 0], down: [Math.PI / 2, 0, 1], left: [Math.PI, -1, 0], up: [-Math.PI / 2, 0, -1] };

  // Reading pixels back from the screen stalls the page for ~3 ms, so a worker does it: every 0.12 s of song time the
  // finished picture is handed over (createImageBitmap, ~0.1 ms here) and its low-res pixels come back a frame or two
  // later. A chord then sorts the picture as it was a moment ago, with no stall at the attack. Without workers it falls
  // back to reading the screen itself, at most 4 times a second.
  let worker = null, snap = null, sg = null;
  try {
    const src = `let c, g; onmessage = (e) => { const { bm, gen } = e.data; if (!c) { c = new OffscreenCanvas(${LW}, ${LH}); g = c.getContext('2d', { willReadFrequently: true }); g.globalCompositeOperation = 'copy'; }
      g.drawImage(bm, 0, 0, ${LW}, ${LH}); bm.close(); const d = g.getImageData(0, 0, ${LW}, ${LH}).data; postMessage({ d, gen }, [d.buffer]); };`;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = (e) => { busy = false; if (e.data.gen === gen) pix = e.data.d; };
    worker.onerror = (e) => { e.preventDefault?.(); worker = null; busy = false; };
  } catch { worker = null; }
  function refresh(x) {
    if (busy || (lastKick >= 0 && Math.abs(x.t - lastKick) < (worker ? 0.12 : 0.25))) return;
    lastKick = x.t;
    if (worker && typeof createImageBitmap === 'function') {
      busy = true; const my = gen;
      createImageBitmap(x.canvas, { resizeWidth: LW, resizeHeight: LH, resizeQuality: 'low' })
        .then((bm) => { if (worker) worker.postMessage({ bm, gen: my }, [bm]); else busy = false; }).catch(() => { busy = false; });
      return;
    }
    if (!snap) { snap = document.createElement('canvas'); snap.width = LW; snap.height = LH; sg = snap.getContext('2d', { willReadFrequently: true }); sg.globalCompositeOperation = 'copy'; }
    sg.drawImage(x.canvas, 0, 0, W, H, 0, 0, LW, LH); pix = sg.getImageData(0, 0, LW, LH).data;
  }
  const lumAt = (cx, cy) => { if (cx < 0 || cy < 0 || cx >= LW || cy >= LH) return 0; const i = (cy * LW + cx) * 4; return (pix[i] * 0.3 + pix[i + 1] * 0.55 + pix[i + 2] * 0.15) / 255; };

  // scratch buffers for one line
  const KEY = new Float64Array(TW * 2), CR = new Uint8ClampedArray(TW * 2 * 3);

  // One streak: a band of n lines from the attack, each sorted by brightness and pulled out to its own ragged length.
  function streak(x, dir, notes, pw, k) {
    const [ang, dx, dy] = DIRS[dir], px = -dy, py = dx;
    const pm = notes.reduce((s, n) => s + x.pitch01(n.m), 0) / notes.length;
    const n = clamp(Math.round((3 + 2.4 * notes.length) * (0.6 + 0.9 * pw) * k.band * R(0.8, 1.25)), 2, MAXN), h2 = n >> 1;
    // where: vertical streaks sit across the screen by pitch (low left, high right) and start with room below/above;
    // sideways ones sit by pitch in height (high on top) and start on the side they leave from. Of a few spots near
    // there, take the brightest, so it grabs what is already in the picture.
    let best = null;
    for (let c = 0; c < 14; c++) {
      let cx, cy;
      if (dy) { cx = (0.1 + 0.8 * pm + R(-0.1, 0.1)) * LW; cy = (dy > 0 ? R(0.06, 0.42) : R(0.58, 0.94)) * LH; }
      else { cy = (0.86 - 0.72 * pm + R(-0.1, 0.1)) * LH; cx = (dx > 0 ? R(0.04, 0.5) : R(0.5, 0.96)) * LW; }
      cx = Math.round(clamp(cx, h2, LW - 1 - h2)); cy = Math.round(clamp(cy, h2, LH - 1 - h2));
      let s = 0; for (let j = -2; j <= 2; j++) for (let d = 0; d < 12; d += 3) s += lumAt(cx + d * dx + j * 3 * px, cy + d * dy + j * 3 * py);
      s += Math.random() * 0.6;
      if (!best || s > best.s) best = { cx, cy, s };
    }
    const { cx, cy } = best;
    const room = dx > 0 ? LW - cx : dx < 0 ? cx + 1 : dy > 0 ? LH - cy : cy + 1;
    const L = Math.round(clamp((12 + 120 * Math.pow(pw, 1.2)) * k.len * R(0.85, 1.15), 4, Math.min(TW, room + 6)));
    const t = tile(), img = t.cg.createImageData(L, n), D = img.data;
    const own = k.own * (0.45 + 0.55 * pw), pick = k.pick;
    for (let i = 0; i < n; i++) {
      const o = i - h2, note = notes[i % notes.length], base = colour(x.pitch01(note.m));
      let m = 0;
      // the picture under the line
      for (let d = 0; d < L; d++) {
        const sx = cx + d * dx + o * px, sy = cy + d * dy + o * py;
        let r = 0, gg = 0, b = 0;
        if (sx >= 0 && sy >= 0 && sx < LW && sy < LH) { const q = (sy * LW + sx) * 4; r = pix[q]; gg = pix[q + 1]; b = pix[q + 2]; }
        const lum = (r * 0.3 + gg * 0.55 + b * 0.15) / 255;
        if (lum < pick) continue;
        CR[m * 3] = r; CR[m * 3 + 1] = gg; CR[m * 3 + 2] = b; KEY[m] = Math.floor(lum * 255) * 4096 + m; m++;
      }
      // its own colour: a few flat chips (the note's colour, a neighbour's, darker shades, now and then a white-hot
      // fleck), a different mix per line; sorted, they make the stepped bands a real pixel sort shows
      if (own > 0.02) {
        const vel = 0.55 + 0.45 * note.v / 110, other = colour(x.pitch01(notes[(i + 1) % notes.length].m)), chips = 2 + Math.floor(Math.random() * 4);
        for (let c = 0; c < chips; c++) {
          const pick2 = Math.random(), shade = R(0.35, 1);
          const col = c === 0 && pick2 < 0.18 ? HOT : (pick2 < 0.6 ? base : other).map((v) => v * shade);
          const lit = Math.min(1, own * vel * 1.3), cr = col[0] * lit, cg = col[1] * lit, cb = col[2] * lit, lum = (cr * 0.3 + cg * 0.55 + cb * 0.15) / 255;
          if (lum < pick * 0.6) continue;
          const len = Math.round(R(1, L * (c === 0 && col === HOT ? 0.06 : 0.22)));
          for (let j = 0; j < len && m < KEY.length; j++) { CR[m * 3] = cr; CR[m * 3 + 1] = cg; CR[m * 3 + 2] = cb; KEY[m] = Math.floor(lum * 255) * 4096 + m; m++; }
        }
      }
      if (!m) continue;
      const keys = KEY.subarray(0, m).sort().reverse();              // brightest first
      // a ragged length per line, then the sorted pixels stretched along it, tapering to nothing at the tip
      const Li = Math.max(2, Math.round(L * (0.3 + 0.7 * Math.pow(Math.random(), 0.5))));
      for (let d = 0; d < Li; d++) {
        const key = keys[Math.min(m - 1, Math.floor((d / Li) * m))], j = key % 4096, lum = Math.floor(key / 4096) / 255, q = (i * L + d) * 4;
        D[q] = CR[j * 3]; D[q + 1] = CR[j * 3 + 1]; D[q + 2] = CR[j * 3 + 2];
        D[q + 3] = 255 * Math.min(1, (1 - d / Li) * 3.5) * clamp(0.3 + lum * 2.6, 0, 1);   // a hard-ish tip
      }
    }
    t.cg.clearRect(0, 0, TW, TH); t.cg.putImageData(img, 0, 0);
    streaks.push({ t, ang, x: (cx + 0.5) * S, y: (cy + 0.5) * S, L, n, h2, age: 0, life: k.life * (0.7 + 0.5 * pw) });
    while (streaks.length > MAXSTREAKS) pool.push(streaks.shift().t);
  }

  function chord(x, ch, k) {
    const pw = power(ch.vel), low = [], mid = [], high = [];
    for (const nt of ch.notes) (nt.m < 52 ? low : nt.m >= 74 ? high : mid).push(nt);
    if (low.length) streak(x, 'down', low, pw, k);
    if (high.length) streak(x, 'up', high, pw, k);
    if (mid.length) {
      const top = Math.max(...mid.map((n) => n.m));
      if (top !== lastTop) flip = top > lastTop ? 1 : -1;
      lastTop = top;
      streak(x, flip > 0 ? 'right' : 'left', mid, pw, k);
    }
  }

  // Runs after every widget has drawn this frame.
  function post(x, dt, k) {
    queued = false;
    try {
      if (pending.length) { for (const ch of pending) chord(x, ch, k); pending = []; }
      const g = x.g;
      g.save(); g.imageSmoothingEnabled = false; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.shadowBlur = 0;
      for (const s of streaks) {
        s.age += dt;
        const grow = 1 - Math.pow(1 - Math.min(1, s.age / 0.14), 3);          // shoots out in ~0.14 s
        const u = clamp((s.age - s.life * 0.35) / (s.life * 0.65), 0, 1);       // then shrinks back and fades
        const vis = Math.max(1, Math.round(s.L * grow * (1 - 0.75 * u * u)));
        g.setTransform(1, 0, 0, 1, 0, 0); g.translate(s.x, s.y); g.rotate(s.ang);
        g.globalAlpha = (0.72 + 0.26 * Math.max(0, 1 - s.age / 0.25)) * Math.pow(1 - u, 1.3);   // a brighter instant at the attack
        g.drawImage(s.t.c, 0, 0, vis, s.n, -S / 2, -s.h2 * S - S / 2, vis * S, s.n * S);
        if (s.age < 0.12) { g.globalAlpha = 0.9 * (1 - s.age / 0.12); g.fillStyle = 'rgb(255,246,228)'; g.fillRect(-S / 2 - 1, -s.h2 * S - S / 2, 1.5, s.n * S); }   // a thin seam at the attack
      }
      g.restore();
      refresh(x);                                                         // after drawing: the next copy includes this frame
      const keep = [];
      for (const s of streaks) (s.age < s.life ? keep : pool).push(s.age < s.life ? s : s.t);
      streaks = keep;
    } catch (e) { console.warn('pixelsort', e); }
  }

  // knob pictures
  const IRED = '#be1816', IAMB = '#e29628', IBONE = '#ece2c8';
  const smear = (g, x0, y, len, col, lw = 2) => {        // a streak: bright at the attack, fading toward its tip
    const n = 8; for (let i = 0; i < n; i++) ICON.alpha(g, 1 - i / n, () => ICON.line(g, x0 + (len * i) / n, y, x0 + (len * (i + 1)) / n, y, col, lw));
  };

  TOOLS.push({
    id: 'pixelsort', name: 'Pixel sort', tag: 'new',
    blurb: 'Every chord grabs a strip of the picture and sorts it by brightness, pulling it out into streaks of chunky pixels that shrink back and fade. Bass smears downward, high notes upward, the middle sideways with the melody; loud chords smear further. Mix it with other widgets and it smears what they drew; alone it smears its own colours (low = red, high = bone).',
    params: [
      { key: 'len', label: 'how far it smears', min: 0.2, max: 1.6, value: 0.75, drive: '+level',
        hint: 'How far each chord pulls the picture out. Left: short nicks at the attack. Right: long streaks across the screen.',
        icon: (g, v, w, h) => {
          ICON.rect(g, 3, 6, 4, 14, IAMB);
          const R = ICON.rng(4); for (let i = 0; i < 5; i++) smear(g, 7, 7.5 + i * 2.8, (3 + v * 28) * (0.55 + 0.45 * R()), i % 2 ? IRED : IAMB, 2);
        } },
      { key: 'life', label: 'how long it stays', min: 0.2, max: 3, value: 1.3, drive: '-rate',
        hint: 'How long a smear hangs before it shrinks back into the attack. Left: a flicker. Right: lingers for seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.12 + v * 0.88, IAMB) },
      { key: 'band', label: 'how wide each smear', min: 0.3, max: 2.5, value: 1,
        hint: 'How many lines of pixels each chord grabs (big chords grab more). Left: a thin thread. Right: a wide sheet.',
        icon: (g, v, w, h) => {
          const n = 1 + Math.round(v * 6), R = ICON.rng(2);
          for (let i = 0; i < n; i++) smear(g, 4, h / 2 + (i - (n - 1) / 2) * 3, 18 + R() * 14, i % 2 ? IRED : IAMB, 2.2);
        } },
      { key: 'pick', label: 'what gets smeared', min: 0, max: 0.7, value: 0.12,
        hint: 'Which parts of the picture get pulled. Left: everything, dark parts too, into solid bars that cut through. Right: only the brightest bits, as thin glowing threads.',
        icon: (g, v, w, h) => {
          const lit = [0.9, 0.25, 0.6, 0.12, 0.8, 0.4];
          lit.forEach((b, i) => {
            if (b < v * 0.75) return;                          // the right end keeps only the two brightest, as threads
            const col = ICON.lerp('#2a1012', IBONE, b), y = 4 + i * 3.7;
            v < 0.3 ? ICON.rect(g, 4, y - 1.6, 32, 3.3, col) : smear(g, 4, y, 30, col, 1.4);
          });
        } },
      { key: 'own', label: 'its own colour', min: 0, max: 1, value: 0.6,
        hint: 'How much colour it adds at each chord. Left: none, it only smears what other widgets drew. Right: bright streaks of its own.',
        icon: (g, v, w, h) => {
          [IRED, IAMB, IBONE].forEach((c, i) => {
            g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(3.5 + i * 11.5, 5.5, 9, 15);
            ICON.alpha(g, v, () => ICON.rect(g, 4 + i * 11.5, 6, 8, 14, c));
          });
        } },
    ],
    reset() { for (const s of streaks) pool.push(s.t); streaks = []; pending = []; pix = EMPTY; lastKick = -1; gen++; busy = false; queued = false; },
    onChord(ch) { pending.push(ch); if (pending.length > 6) pending.shift(); },
    frame(x) {
      // knobs are read here (they only resolve while the harness is running this widget), then used after the others drew
      const k = { len: x.p('len'), life: x.p('life'), band: x.p('band'), pick: x.p('pick'), own: x.p('own') }, dt = x.dt;
      if (!queued) { queued = true; queueMicrotask(() => post(x, dt, k)); }
    },
  });
})();
