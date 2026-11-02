// Pixel sort v2: a sibling of the casket cuts and the glitch blocks. Every chord grabs a band of lines of the picture at
// the attack and pixel-sorts them the real way: along each line, every run of lit pixels (a shape another widget drew)
// is sorted by brightness, brightest toward the attack, and then drips on toward the next run, so the shapes underneath
// stay where they were but melt in the chord's direction. Dark gaps stay see-through.
// Direction follows pitch: bass notes melt downward, high notes upward, the middle sideways with the melody (rising:
// right, falling: left); a big chord with bass and treble tears both ways at once.
// The music: soft chords grab a few thin lines that only shimmer the shapes in place, loud ones a wide sheet whose runs
// bridge the gaps and drip far, so neighbouring shapes melt into each other; the very loudest chords of the recording
// also tear one band right across the screen. Fast, dense playing makes thin threads, sparse chords fat sheets; held
// chords hold their melt, short ones flick away. Every attack lands with a seam of light and a block of its own colour
// (low = deep red, middle = amber, high = bone), so it also shows alone, where it melts its own earlier streaks.
// It works on a low-res copy (1/5 size) and draws chunky pixels. It draws AFTER all the other widgets each frame (a
// microtask queued from frame()), so it sorts the finished picture instead of being painted over.
(() => {
  const W = 1280, H = 720, S = 5, LW = W / S, LH = H / S;         // low-res grid: 256 × 144 cells of 5 px
  const TW = LW, TH = 48, MAXN = 44, MAXSTREAKS = 40;               // tile size (cells), lines per streak, live streaks
  const EMPTY = new Uint8ClampedArray(LW * LH * 4);
  let pix = EMPTY, lastKick = -1, busy = false, gen = 0;           // pix: the low-res picture (RGBA), refreshed in the background
  const pool = [];                                                  // spare tile canvases
  const tile = () => pool.pop() || (() => { const c = document.createElement('canvas'); c.width = TW; c.height = TH; return { c, cg: c.getContext('2d') }; })();
  let streaks = [], pending = [], lastTop = 60, flip = 1, queued = false, lastTear = -9;
  const R = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Loudness relative to this recording (its 93rd-percentile note velocity), so both songs reach the long melts. A floor
  // keeps the softest chords visible: they still land, as thin short threads.
  let VQ = 0;
  const loud = (v) => {
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
  // later. A chord then sorts the picture as it was a moment ago, with no stall at the attack. The copy takes one pixel
  // per cell instead of averaging them, so fine patterns keep their true colours instead of going grey. Without workers it falls
  // back to reading the screen itself, at most 4 times a second.
  let worker = null, snap = null, sg = null;
  try {
    const src = `let c, g; onmessage = (e) => { const { bm, gen } = e.data; if (!c) { c = new OffscreenCanvas(${LW}, ${LH}); g = c.getContext('2d', { willReadFrequently: true }); g.globalCompositeOperation = 'copy'; g.imageSmoothingEnabled = false; }
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
      createImageBitmap(x.canvas, { resizeWidth: LW, resizeHeight: LH, resizeQuality: 'pixelated' })
        .then((bm) => { if (worker) worker.postMessage({ bm, gen: my }, [bm]); else busy = false; }).catch(() => { busy = false; });
      return;
    }
    if (!snap) { snap = document.createElement('canvas'); snap.width = LW; snap.height = LH; sg = snap.getContext('2d', { willReadFrequently: true }); sg.globalCompositeOperation = 'copy'; sg.imageSmoothingEnabled = false; }
    sg.drawImage(x.canvas, 0, 0, x.canvas.width, x.canvas.height, 0, 0, LW, LH); pix = sg.getImageData(0, 0, LW, LH).data;   // the whole picture, at any size
  }
  const lumOf = (cx, cy) => { if (cx < 0 || cy < 0 || cx >= LW || cy >= LH) return -1; const i = (cy * LW + cx) * 4; return (pix[i] * 0.3 + pix[i + 1] * 0.55 + pix[i + 2] * 0.15) / 255; };
  const satOf = (cx, cy) => { const i = (cy * LW + cx) * 4, r = pix[i], g = pix[i + 1], b = pix[i + 2]; return (Math.max(r, g, b) - Math.min(r, g, b)) / 255; };
  const SL = new Float32Array(64);

  // scratch buffers for one line: the picture along it, then the pool of pixels a run sorts
  const LR = new Uint8ClampedArray(TW), LG = new Uint8ClampedArray(TW), LB = new Uint8ClampedArray(TW), LU = new Float32Array(TW);
  const KEY = new Float64Array(TW * 2), CR = new Uint8ClampedArray(TW * 2 * 3), RS = new Int16Array(TW), RE = new Int16Array(TW);

  // One streak: a band of n lines from the attack. Each line is read off the picture, its lit runs sorted in place and
  // dripped toward the tip; a block of its own colour leads at the attack.
  // o: { dir, notes, pw (0..1 loudness), dense (0..1), tear }
  function streak(x, o, k) {
    const { dir, notes, pw, dense, tear } = o;
    const [ang, dx, dy] = DIRS[dir], px = -dy, py = dx;
    const pm = notes.reduce((s, n) => s + x.pitch01(n.m), 0) / notes.length;
    const held = notes.reduce((s, n) => Math.max(s, n.d || 0), 0);
    // how many lines: big chords and loud ones grab more, fast passages less (threads), bass a little more than treble
    let n = (2 + 2.6 * notes.length) * (0.35 + 1.1 * pw) * (1.25 - 0.55 * dense) * (1.15 - 0.3 * pm) * k.band * R(0.8, 1.25);
    if (tear) n = (7 + 14 * pw) * k.band * R(0.85, 1.15);
    n = clamp(Math.round(n), 2, MAXN); const h2 = n >> 1;
    // where: vertical streaks sit across the screen by pitch (low left, high right) and start with room below/above;
    // sideways ones sit by pitch in height (high on top) and start on the side they leave from.
    // Of a few spots near there, take the one with the most going on (contrast and colour), so it sorts what is
    // already in the picture. Its ground decides what a run is: on a dark ground the lit shapes, on a light ground
    // (paper) the dark ones; either way the strongest pixels lead at the attack and the rest melt toward the ground.
    let best = null;
    for (let c = 0; c < (tear ? 8 : 16); c++) {
      let cx, cy;
      if (dy) { cx = (0.1 + 0.8 * pm + R(-0.1, 0.1)) * LW; cy = (dy > 0 ? R(0.06, 0.42) : R(0.58, 0.94)) * LH; }
      else { cy = (0.86 - 0.72 * pm + R(-0.12, 0.12)) * LH; cx = tear ? (dx > 0 ? 0 : LW - 1) : (dx > 0 ? R(0.04, 0.5) : R(0.5, 0.96)) * LW; }
      cx = Math.round(clamp(cx, dx ? 0 : h2, LW - 1 - (dx ? 0 : h2))); cy = Math.round(clamp(cy, dy ? 0 : h2, LH - 1 - (dy ? 0 : h2)));
      let ns = 0, sum = 0, top = 0, sat = 0;
      for (let j = -2; j <= 2; j++) for (let d = 0; d < 36; d += 6) {
        const qx = cx + d * dx + j * 3 * px, qy = cy + d * dy + j * 3 * py, l = lumOf(qx, qy);
        if (l < 0) continue; SL[ns++] = l; sum += l; top = Math.max(top, l); sat += satOf(qx, qy);
      }
      const mean = ns ? sum / ns : 0; let dev = 0; for (let q = 0; q < ns; q++) dev += Math.abs(SL[q] - mean);
      const s = (ns ? (dev + 0.4 * sat) / ns : 0) + 0.12 * mean + Math.random() * 0.25;
      if (!best || s > best.s) best = { cx, cy, s, light: mean > 0.45, top };
    }
    const { cx, cy } = best, G = best.light ? Math.max(0.5, best.top) : 0;
    const strength = best.light ? (l) => clamp((G - l) / G, 0, 1) : (l) => l;      // how far a pixel stands out of its ground
    const room = dx > 0 ? LW - cx : dx < 0 ? cx + 1 : dy > 0 ? LH - cy : cy + 1;
    const L = tear ? room : Math.round(clamp((34 + 100 * Math.pow(pw, 1.15)) * (1 - 0.3 * dense) * k.len * R(0.85, 1.15), 5, Math.min(TW, room + 6)));
    // loud chords: runs bridge wider gaps and drip further, so shapes melt into each other
    const bridge = Math.round(tear ? 6 + 6 * pw : 1 + 7 * pw * pw), drip = 0.45 + 0.55 * Math.pow(pw, 0.8);
    const thr = k.pick, ownK = k.own;                                 // at 0 the ground counts too: whole lines sort into solid bars
    const t = tile(), img = t.cg.createImageData(L, n), D = img.data;
    for (let i = 0; i < n; i++) {
      const off = i - h2, note = notes[i % notes.length], base = colour(x.pitch01(note.m));
      const Li = Math.max(3, Math.round(L * (tear ? R(0.75, 1) : 0.3 + 0.7 * Math.pow(Math.random(), 0.5))));   // ragged tips
      // the picture under the line
      for (let d = 0; d < Li; d++) {
        const sx = cx + d * dx + off * px, sy = cy + d * dy + off * py;
        let r = 0, gg = 0, b = 0;
        if (sx >= 0 && sy >= 0 && sx < LW && sy < LH) { const q = (sy * LW + sx) * 4; r = pix[q]; gg = pix[q + 1]; b = pix[q + 2]; }
        LR[d] = r; LG[d] = gg; LB[d] = b; LU[d] = sx >= 0 && sy >= 0 && sx < LW && sy < LH ? strength((r * 0.3 + gg * 0.55 + b * 0.15) / 255) : 0;
      }
      // its lit runs, joined across gaps shorter than the bridge
      let nr = 0;
      for (let d = 0; d < Li; d++) {
        if (LU[d] < thr) continue;
        if (nr && d - RE[nr - 1] <= bridge) RE[nr - 1] = d + 1; else { RS[nr] = d; RE[nr] = d + 1; nr++; }
      }
      // its own colour leads at the attack: a few flat chips (the note's colour, a neighbour's, darker shades, now and
      // then a white-hot fleck), sorted with whatever run starts there
      let chips = 0;
      if (ownK > 0.02) {
        const len = Math.max(2, Math.round(Li * ownK * R(0.15, 0.4) * (0.6 + 0.4 * pw)));
        if (!nr || RS[0] > len + bridge) { for (let r = nr; r > 0; r--) { RS[r] = RS[r - 1]; RE[r] = RE[r - 1]; } RS[0] = 0; RE[0] = Math.min(Li, len); nr++; }
        else { RS[0] = 0; RE[0] = Math.max(RE[0], Math.min(Li, len)); }
        const lit = (0.45 + 0.55 * ownK) * (0.65 + 0.35 * pw) * (0.8 + 0.2 * note.v / 110), other = colour(x.pitch01(notes[(i + 1) % notes.length].m));
        const nc = 2 + Math.floor(Math.random() * 3);
        for (let c = 0; c < nc && chips < len; c++) {
          const r0 = Math.random(), shade = R(0.4, 1);
          const col = c === 0 && r0 < 0.2 + 0.3 * pw ? HOT : (r0 < 0.6 ? base : other).map((v) => v * shade);
          const cl = c === nc - 1 ? len - chips : Math.max(1, Math.round(len * R(0.15, col === HOT ? 0.2 : 0.5)));
          for (let j = 0; j < cl && chips < len; j++, chips++) { CR[chips * 3] = col[0] * lit; CR[chips * 3 + 1] = col[1] * lit; CR[chips * 3 + 2] = col[2] * lit; }
        }
      }
      // each run: its pixels (plus the chips, for the first) sorted brightest first, laid from the run's start toward
      // the tip and stretched over the run and its drip, which stops at the next run (its own colour always drips on
      // to near the tip, so even the softest chord leaves a thread)
      for (let r = 0; r < nr; r++) {
        let m = 0;
        // (on paper its pale chips would rank as "ground" and fade to a ghost at the tail: they keep a floor, so they stay solid)
        if (r === 0 && chips) for (; m < chips; m++) { const c3 = m * 3, s0 = strength((CR[c3] * 0.3 + CR[c3 + 1] * 0.55 + CR[c3 + 2] * 0.15) / 255); KEY[m] = Math.floor((best.light ? Math.max(0.25, s0) : s0) * 255) * 4096 + m; }
        for (let d = RS[r]; d < RE[r]; d++) {
          if (r === 0 && d < chips) continue;                        // the chips cover the picture there
          const c3 = m * 3; CR[c3] = LR[d]; CR[c3 + 1] = LG[d]; CR[c3 + 2] = LB[d]; KEY[m] = Math.floor(LU[d] * 255) * 4096 + m; m++;
        }
        if (!m) continue;
        const keys = KEY.subarray(0, m).sort().reverse();
        const next = r + 1 < nr ? RS[r + 1] : Li, span = RE[r] - RS[r];
        const end = Math.min(next, RE[r] + Math.round((next - RE[r]) * (r === 0 && chips ? R(0.75, 1) : drip * R(0.5, 1)))), len = Math.max(1, end - RS[r]);
        for (let d = RS[r]; d < end; d++) {
          const u = (d - RS[r]) / len, key = keys[Math.min(m - 1, Math.floor(u * m))], j = key % 4096, lum = Math.floor(key / 4096) / 255, q = (i * L + d) * 4;
          D[q] = CR[j * 3]; D[q + 1] = CR[j * 3 + 1]; D[q + 2] = CR[j * 3 + 2];
          const tail = len > span ? Math.min(1, (1 - u) * 3) : 1;      // a dripping run thins out at its end
          D[q + 3] = 255 * tail * clamp(0.35 + lum * 2.6, 0, 1);
        }
      }
    }
    t.cg.clearRect(0, 0, TW, TH); t.cg.putImageData(img, 0, 0);
    const life = Math.max(0.3 + 0.2 * pw, k.life * (0.65 + 0.45 * pw) * (0.7 + 0.6 * clamp(held / 1.5, 0, 1)) * (tear ? 0.6 : 1));   // never under a beat's flick
    streaks.push({ t, ang, x: (cx + 0.5) * S, y: (cy + 0.5) * S, L, n, h2, age: 0, life, pw, grow: tear ? 0.1 : 0.07 + 0.16 * (1 - pm) });
    while (streaks.length > MAXSTREAKS) pool.push(streaks.shift().t);
  }

  function chord(x, ch, k) {
    const pw = 0.1 + 0.9 * loud(ch.vel), dense = x.feat ? x.feat.rate : clamp(x.rate / 8, 0, 1), low = [], mid = [], high = [];
    for (const nt of ch.notes) (nt.m < 52 ? low : nt.m >= 74 ? high : mid).push(nt);
    if (low.length) streak(x, { dir: 'down', notes: low, pw, dense }, k);
    if (high.length) streak(x, { dir: 'up', notes: high, pw, dense }, k);
    if (mid.length) {
      const top = Math.max(...mid.map((n) => n.m));
      if (top !== lastTop) flip = top > lastTop ? 1 : -1;
      lastTop = top;
      streak(x, { dir: flip > 0 ? 'right' : 'left', notes: mid, pw, dense }, k);
    }
    // the loudest chords of the recording (and not too often) tear one band right across the screen
    if (pw > 0.86 && ch.notes.length >= 2 && x.t - lastTear > 0.6) { lastTear = x.t; streak(x, { dir: flip > 0 ? 'right' : 'left', notes: ch.notes, pw, dense, tear: true }, k); }
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
        const grow = 1 - Math.pow(1 - Math.min(1, s.age / s.grow), 3);        // shoots out (treble fast, bass slower)
        const u = clamp((s.age - s.life * 0.35) / (s.life * 0.65), 0, 1);       // then shrinks back and fades
        const vis = Math.max(1, Math.round(s.L * grow * (1 - 0.75 * u * u)));
        g.setTransform(1, 0, 0, 1, 0, 0); g.translate(s.x, s.y); g.rotate(s.ang);
        g.globalAlpha = (0.84 + 0.16 * Math.max(0, 1 - s.age / 0.25)) * Math.pow(1 - u, 1.3);   // a brighter instant at the attack
        g.drawImage(s.t.c, 0, 0, vis, s.n, -S / 2, -s.h2 * S - S / 2, vis * S, s.n * S);
        const seam = 0.1 + 0.12 * s.pw;                                        // a seam of light at the attack, louder: wider, longer
        if (s.age < seam) { g.globalAlpha = (0.7 + 0.3 * s.pw) * (1 - s.age / seam); g.fillStyle = 'rgb(255,246,228)'; g.fillRect(-S / 2 - 1, -s.h2 * S - S / 2, 1.5 + 3 * s.pw, s.n * S); }
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
    id: 'pixelsort', name: 'Pixel sort', tag: 'v2',
    blurb: 'Now a real pixel sort: each chord sorts the shapes under it by brightness, in place, so whatever the other widgets drew melts in the chord’s direction (bass down, treble up, the melody sideways). Soft chords shimmer a few thin lines, loud ones melt a wide sheet, the loudest tear a band right across the screen, and held chords hold their melt.',
    params: [
      { key: 'len', label: 'how far it smears', min: 0.2, max: 1.6, value: 0.75, less: 0.2, drive: '+level',
        hint: 'How far each chord pulls the picture out. Left: short nicks at the attack. Right: long streaks across the screen.',
        icon: (g, v, w, h) => {
          ICON.rect(g, 3, 6, 4, 14, IAMB);
          const R = ICON.rng(4); for (let i = 0; i < 5; i++) smear(g, 7, 7.5 + i * 2.8, (3 + v * 28) * (0.55 + 0.45 * R()), i % 2 ? IRED : IAMB, 2);
        } },
      { key: 'life', label: 'how long it stays', min: 0.2, max: 3, value: 1.3, less: 0.2, drive: '-rate',
        hint: 'How long a smear hangs before it shrinks back into the attack. Left: a flicker. Right: lingers for seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.12 + v * 0.88, IAMB) },
      { key: 'band', label: 'how wide each smear', min: 0.3, max: 2.5, value: 1, less: 0.3,
        hint: 'How many lines of pixels each chord grabs (big and loud chords grab more). Left: a thin thread. Right: a wide sheet.',
        icon: (g, v, w, h) => {
          const n = 1 + Math.round(v * 6), R = ICON.rng(2);
          for (let i = 0; i < n; i++) smear(g, 4, h / 2 + (i - (n - 1) / 2) * 3, 18 + R() * 14, i % 2 ? IRED : IAMB, 2.2);
        } },
      { key: 'pick', label: 'what gets smeared', min: 0, max: 0.7, value: 0.12, less: 0.6,
        hint: 'Which parts of the picture get sorted. Left: everything, dark parts too, into solid bars that cut through. Right: only the brightest bits, as thin glowing threads.',
        icon: (g, v, w, h) => {
          const lit = [0.9, 0.25, 0.6, 0.12, 0.8, 0.4];
          lit.forEach((b, i) => {
            if (b < v * 0.75) return;                          // the right end keeps only the two brightest, as threads
            const col = ICON.lerp('#2a1012', IBONE, b), y = 4 + i * 3.7;
            v < 0.3 ? ICON.rect(g, 4, y - 1.6, 32, 3.3, col) : smear(g, 4, y, 30, col, 1.4);
          });
        } },
      { key: 'own', label: 'its own colour', min: 0, max: 1, value: 0.6, less: 0.2,
        hint: 'How much colour it adds at each chord. Left: none, it only sorts what other widgets drew. Right: bright streaks of its own.',
        icon: (g, v, w, h) => {
          [IRED, IAMB, IBONE].forEach((c, i) => {
            g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(3.5 + i * 11.5, 5.5, 9, 15);
            ICON.alpha(g, v, () => ICON.rect(g, 4 + i * 11.5, 6, 8, 14, c));
          });
        } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much it smears: how far each chord pulls the picture out, how wide a sheet it grabs, how long it hangs, how much of the picture gets sorted, how much of its own paint it adds. Left: short thin flicks of the brightest bits only. Right: long wide sheets of nearly everything. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { for (const s of streaks) pool.push(s.t); streaks = []; pending = []; pix = EMPTY; lastKick = -1; gen++; busy = false; queued = false; lastTear = -9; },
    onChord(ch) { pending.push(ch); if (pending.length > 6) pending.shift(); },
    frame(x) {
      // knobs are read here (they only resolve while the harness is running this widget), then used after the others drew
      const k = { len: x.p('len'), life: x.p('life'), band: x.p('band'), pick: x.p('pick'), own: x.p('own') }, dt = x.dt;
      if (!queued) { queued = true; queueMicrotask(() => post(x, dt, k)); }
    },
  });
})();
