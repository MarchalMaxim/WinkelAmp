// Klee: after Paul Klee's polyphony paintings (Ad Parnassum, Polyphony). A mosaic of small warm tiles on a dark ground.
// The piano is split into six voices by register (bass, low, tenor, alto, soprano, high), each with its own glaze colour
// (madder, ochre, olive, ultramarine, rose, lemon). A voice writes along its own row, left to right like a line of a
// score, one run of tiles per note: the row is the note's pitch, so a melody climbs and falls as a staircase of squares.
// A held note keeps painting along its row and deepens its tiles while it sounds (and glows). The glazes are translucent
// and mix where voices cross, as watercolours do (ochre over ultramarine turns olive, rose over lemon turns coral), so
// the picture's colours are the polyphony's overlaps. Over it all a fine veil of light dots drifts slowly. The paint fades
// over some seconds, so the mosaic is always the last stretch of music. It paints its own (opaque) canvas.
// v2: each tile also keeps how its note was played. Its size is the note's loudness (a pianissimo tile is a small square
// in the dark, a forte one fills its place) and a loud held note's tiles close up into one block of colour, while a quick
// passage's short notes lay tiles split in four (a finer mosaic) that fade twice as fast. A fresh attack pops its tiles
// with a light rim; a loud one also throws a spray of lit tiles around itself. So soft/loud, held/quick and sparse/dense
// read as different textures: Klee's dotted fields and his solid blocks.
// A sixth knob, how present (the user, 2026-11-01: sliders should dim, not only boost). Turned down, the tiles, the dark
// ground and the veil fade (the ground to nothing, so it stops covering what's under it), the attacks stop popping and
// spraying, the veil drifts slower, and only the song's hardest notes paint.
(() => {
  const NV = 6;
  // the voices: register band (upper bound, exclusive) and glaze colour (what the tile takes on at full strength)
  // the voices, low to high: where each one rests, and its glaze (neighbours contrast, so where they meet they mix)
  const HOME = [36, 47, 56, 64, 73, 84];
  const GLAZE = [[200, 74, 52], [84, 110, 200], [236, 152, 56], [232, 128, 150], [134, 166, 82], [248, 224, 98]];
  const LIGHT = [255, 242, 218];                         // the warm light the glazes are laid on
  const GROUND = [30, 20, 15];                           // the dark umber between and under the tiles
  const LO = 31, HI = 94, HALO = 2;                              // pitch range mapped onto the rows
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  // how present (0..1): which notes paint, judged against this piece's own notes (recordings differ a lot in how hard
  // they play): every one at 1, the hardest 40% at 0.4, the hardest 5% at 0
  const DROUGHT = 8;
  let pres = 1, vels = null, dimmed = null, lastPaint = -DROUGHT;
  const hardEnough = (v) => {
    const cut = (1 - pres) * 0.95;
    if (cut <= 0) return true;
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= cut;
  };
  // Voice leading: a chord's notes (low to high) go to voices in the same order, each to the voice nearest its pitch
  // (dynamic programming over the six voices), so a voice follows its line as it climbs and falls and can wander
  // across the others' rows. A chord of more than six notes doubles its extra notes on the nearest voice.
  let pv = HOME.slice();
  function assign(ms) {
    const k = ms.length;
    if (k > NV) return ms.map((m) => { let b = 0; for (let v = 1; v < NV; v++) if (Math.abs(pv[v] - m) < Math.abs(pv[b] - m)) b = v; return b; });
    const INF = 1e9, dp = [], from = [];
    for (let i = 0; i < k; i++) { dp.push(new Array(NV).fill(INF)); from.push(new Array(NV).fill(-1)); }
    for (let j = 0; j < NV; j++) dp[0][j] = Math.abs(pv[j] - ms[0]);
    for (let i = 1; i < k; i++) for (let j = i; j < NV; j++) {
      let best = INF, bj = -1; for (let q = i - 1; q < j; q++) if (dp[i - 1][q] < best) { best = dp[i - 1][q]; bj = q; }
      dp[i][j] = best + Math.abs(pv[j] - ms[i]); from[i][j] = bj;
    }
    let j = k - 1; for (let q = k - 1; q < NV; q++) if (dp[k - 1][q] < dp[k - 1][j]) j = q;
    const out = new Array(k); for (let i = k - 1; i >= 0; i--) { out[i] = j; j = from[i][j]; }
    return out;
  }

  let S = 0, COLS = 0, ROWS = 0, N = 0, OX = 0, OY = 0;
  let amt = [], flash = null, hold = null, body = null, grain = null, tone = null, under = null, cursor = [], runs = [], lastCh = [], chId = 0;
  let veilX = 0, veilY = 0, veilPat = null, veilKey = '', veilFill = {}, wash = null, washG = null, washImg = null;
  const W = 1280, H = 720, col = [];   // col: this frame's painted tiles, [index, r, g, b, paint] each

  // the grid at tile size s; the old paint is carried over by sampling it at each new tile's centre
  function build(s) {
    const cols = Math.ceil(W / s), rows = Math.ceil(H / s), n = cols * rows;
    const oS = S, oC = COLS, oR = ROWS, oOX = OX, oOY = OY, oAmt = amt, oFl = flash, oBd = body, oGr = grain;
    S = s; COLS = cols; ROWS = rows; N = n; OX = (W - cols * s) / 2; OY = (H - rows * s) / 2;
    amt = []; for (let v = 0; v < NV; v++) amt.push(new Float32Array(n));
    flash = new Float32Array(n); hold = new Float32Array(n); body = new Float32Array(n); grain = new Float32Array(n); tone = new Float32Array(n * 4);
    // the wash: one pixel per tile, stretched (smoothly) over the canvas under the tiles, so colour bleeds into the gaps
    wash = document.createElement('canvas'); wash.width = cols; wash.height = rows; washG = wash.getContext('2d'); washImg = washG.createImageData(cols, rows);
    if (oS && oAmt.length) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const px = OX + (c + 0.5) * s, py = OY + (r + 0.5) * s;
      const oc = Math.floor((px - oOX) / oS), or = Math.floor((py - oOY) / oS);
      if (oc < 0 || or < 0 || oc >= oC || or >= oR) continue;
      for (let v = 0; v < NV; v++) amt[v][r * cols + c] = oAmt[v][or * oC + oc];
      flash[r * cols + c] = oFl[or * oC + oc]; body[r * cols + c] = oBd[or * oC + oc]; grain[r * cols + c] = oGr[or * oC + oc];
    }
    if (oS) { const k = oS / s; for (let v = 0; v < NV; v++) cursor[v] = (cursor[v] * k) % cols; runs = []; }
    // each tile has its own hand: a slightly different brightness and warmth (seeded, so it never flickers)
    const R = ICON.rng(29);
    for (let i = 0; i < n; i++) { tone[i * 4] = 0.84 + R() * 0.2; tone[i * 4 + 1] = R(); tone[i * 4 + 2] = R(); tone[i * 4 + 3] = R(); }
    // the underpainting: dark tiles in a few slow warm zones, gaps of bare umber
    under = document.createElement('canvas'); under.width = W; under.height = H;
    const ug = under.getContext('2d');
    ug.fillStyle = `rgb(${GROUND})`; ug.fillRect(0, 0, W, H);
    const gap = Math.max(1, s * 0.09);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, px = OX + c * s, py = OY + r * s;
      const zx = Math.sin(c * 0.13 + 1.2) + Math.sin(r * 0.21 - c * 0.07), zone = 0.5 + 0.25 * zx;  // broad zones, Klee's ground
      const b = 0.75 + tone[i * 4] * 0.3, w = tone[i * 4 + 1];
      const col = [(38 + 14 * zone + 6 * w) * b, (25 + 8 * zone) * b, (19 + 4 * (1 - zone) + 7 * (1 - w)) * b].map(Math.round);
      ug.fillStyle = `rgb(${col})`; ug.fillRect(px + gap / 2, py + gap / 2, s - gap, s - gap);
    }
  }
  function veil(spacing) {
    const key = spacing.toFixed(1);
    if (veilKey === key) return veilPat;
    const c = document.createElement('canvas'), n = 4, sz = Math.round(spacing * n);
    c.width = sz; c.height = sz;
    const vg = c.getContext('2d'), R = ICON.rng(5);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5 + (j % 2) * 0.5) * spacing + (R() - 0.5) * spacing * 0.18, y = (j + 0.5) * spacing + (R() - 0.5) * spacing * 0.18;
      vg.fillStyle = `rgba(255,246,226,${(0.55 + R() * 0.45).toFixed(2)})`;
      vg.beginPath(); vg.arc(((x % sz) + sz) % sz, y, 0.9 + R() * 0.6, 0, Math.PI * 2); vg.fill();
    }
    veilKey = key; veilPat = c; return c;
  }
  const rowOf = (m) => clamp(Math.round((1 - clamp((m - LO) / (HI - LO))) * (ROWS - 1)), 0, ROWS - 1);

  // icons
  const GL = GLAZE.map((c) => `rgb(${c})`), MADDER = 0, ULTRA = 1, OCHRE = 2, ROSE = 3, OLIVE = 4, LEMON = 5;
  const ICONS = {
    size(g, v, w, h) {                                    // a mosaic, fine at the left, coarse at the right
      const s = 4 + v * 8, R = ICON.rng(3), cols = Math.floor((w - 2) / s), rows = Math.floor((h - 2) / s);
      const ox = (w - cols * s) / 2, oy = (h - rows * s) / 2, pal = GL;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) ICON.rect(g, ox + c * s + 0.5, oy + r * s + 0.5, s - 1, s - 1, pal[Math.floor(R() * 6)]);
    },
    thick(g, v, w, h) {                                   // one voice's row of squares, one tile tall or four
      const n = 1 + Math.round(v * 3), s = 5, y0 = h / 2 - (n * s) / 2;
      for (let r = 0; r < n; r++) for (let c = 0; c < 7; c++) ICON.rect(g, 2 + c * s + 0.5, y0 + r * s + 0.5, s - 1, s - 1, GL[ROSE]);
    },
    mix(g, v, w, h) {                                     // an ochre row over a blue one: covering it, or glazing to olive
      const s = 5, hex = (c) => '#' + c.map((q) => Math.min(255, Math.round(q)).toString(16).padStart(2, '0')).join('');
      const ochre = hex(GLAZE[OCHRE]), olive = hex(GLAZE[OCHRE].map((a, i) => ((a * GLAZE[ULTRA][i]) / 255) * 1.45));
      for (let c = 0; c < 6; c++) { ICON.rect(g, 2 + c * s + 0.5, 11.5, s - 1, s - 1, GL[ULTRA]); ICON.rect(g, 2 + c * s + 0.5, 16.5, s - 1, s - 1, GL[ULTRA]); }
      for (let c = 0; c < 6; c++) { ICON.rect(g, 9 + c * s + 0.5, 6.5, s - 1, s - 1, ochre); ICON.rect(g, 9 + c * s + 0.5, 11.5, s - 1, s - 1, ICON.lerp(ochre, olive, v)); }
    },
    veil(g, v, w, h) {                                    // tiles bare, or under a veil of light dots
      for (let c = 0; c < 4; c++) ICON.rect(g, 3 + c * 9, 4, 8, 18, [GL[OCHRE], GL[MADDER], GL[ULTRA], GL[ROSE]][c]);
      ICON.alpha(g, v, () => { for (let j = 0; j < 4; j++) for (let i = 0; i < 9; i++) ICON.dot(g, 4 + i * 4 + (j % 2) * 2, 5 + j * 5, 0.9, '#fff6e2'); });
    },
    presence(g, v, w, h) {                                // a few faint tiles, or a full bright mosaic
      const s = 6, R = ICON.rng(11), cols = Math.floor((w - 2) / s), rows = Math.floor((h - 2) / s);
      const ox = (w - cols * s) / 2, oy = (h - rows * s) / 2;
      ICON.alpha(g, 0.2 + 0.8 * v, () => {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const on = R(), hue = Math.floor(R() * 6);
          if (on < 0.12 + 0.88 * v) ICON.rect(g, ox + c * s + 0.5, oy + r * s + 0.5, s - 1, s - 1, GL[hue]);
        }
      });
    },
  };

  TOOLS.push({
    id: 'klee', name: 'Klee', tag: 'v2',
    blurb: 'After Paul Klee\'s polyphony paintings: a mosaic of small warm tiles. Each voice of the music writes along its own row in its own glaze, the row climbing and falling with its pitch; where voices cross, the glazes mix. New in v2: quiet notes lay small squares and loud held ones solid blocks, quick passages a finer split mosaic, and every attack pops (a loud one throws a spray of lit tiles). The <b>how present</b> knob sets how much mosaic it paints: from a thin line of tiles that soon goes to broad bands that build up.',
    params: [
      { key: 'stay', label: 'how long the colour stays', min: 3, max: 40, value: 14, less: 3,
        hint: 'How long the paint stays on the tiles. Left: a few seconds, only the last phrase. Right: the whole passage builds up.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.12 + v * 0.88, GL[OCHRE]) },
      { key: 'size', label: 'size of the tiles', min: 12, max: 40, step: 1, value: 20,
        hint: 'How big the mosaic\'s squares are. Left: a fine mosaic of many small tiles. Right: a few big tiles.',
        icon: ICONS.size },
      { key: 'thick', label: 'how wide each voice paints', min: 0.6, max: 4, value: 1.7, less: 0.6, drive: '+level',
        hint: 'How many tiles tall a note\'s row is. Left: a single thin line of tiles. Right: broad bands (louder notes are always a bit wider).',
        icon: ICONS.thick },
      { key: 'mix', label: 'colours mixing', min: 0, max: 1, value: 0.75,
        hint: 'What happens where two voices cross. Left: the newest colour covers the older one. Right: they glaze over each other into a new colour.',
        icon: ICONS.mix },
      { key: 'veil', label: 'veil of dots', min: 0, max: 1, value: 0.6, less: 0.15, drive: '-level',
        hint: 'The fine light dots that drift over the picture. Left: bare tiles. Right: a bright veil. It follows the music: quiet passages shimmer, loud ones blaze bare.',
        icon: ICONS.veil },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much mosaic it paints: how long the colour stays on the tiles, how many tiles tall each voice writes, how thick the veil of dots lies over them. Left: a thin line of tiles that is gone in a few seconds, nearly bare. Right: broad bands that build up over the whole passage under the veil. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset(x) {
      S = 0; amt = []; build(Math.round(x.p('size')));
      cursor = []; lastCh = []; runs = [];
      for (let v = 0; v < NV; v++) { cursor.push(((v * 0.37 + 0.1) % 1) * COLS); lastCh.push(-1); }
      chId = 0; veilX = 0; veilY = 0; pv = HOME.slice(); vels = null; lastPaint = -DROUGHT;
    },
    onChord(ch, x) {
      if (!N) build(Math.round(x.p('size')));
      pres = x.p('presence');
      // (a long stretch below the cut still gets its hardest note every few seconds: the prelude's agitato has nothing in
      // the song's hardest quarter, and a toned-down widget should stay faint there, not go dead for a minute and a half)
      const all = [...ch.notes];
      let heard = all.filter((n) => hardEnough(n.v));
      if (!heard.length && x.t - lastPaint >= DROUGHT) heard = all.sort((a, b) => b.v - a.v).slice(0, 1);
      if (!heard.length) return;
      lastPaint = x.t;
      chId++;
      // in sparse music (Beethoven's lone knocks, the oboe's cadenza) each note is a bigger stroke: longer and broader
      const thick = x.p('thick'), adv = new Array(NV).fill(0), sparse = 1 - clamp((x.feat?.rate ?? 0) * 4);
      const notes = heard.sort((a, b) => a.m - b.m), who = assign(notes.map((n) => n.m));
      notes.forEach((n, j) => { pv[who[j]] = n.m; });
      for (let j = 0; j < notes.length; j++) {
        const n = notes[j], v = who[j], vk = clamp(n.v / 110);
        const L = Math.max(2, Math.min(18, Math.round(1 + n.d * 4.5 + vk * 2 + sparse * 5)));     // the run's length: longer for held notes
        const rows = Math.max(1, Math.round(thick * (0.5 + 0.85 * vk + 0.7 * sparse)));
        const row = rowOf(n.m), r0 = clamp(row - Math.floor((rows - 1) / 2), 0, ROWS - rows);
        if (lastCh[v] !== chId) { lastCh[v] = chId; if (adv[v] === 0 && x.rnd() < 0.5) cursor[v] = (cursor[v] + 1) % COLS; }   // a little breath between notes
        const c0 = Math.floor(cursor[v]);
        // the grain: a short note in a quick passage lays small split tiles; a held one a solid block (sparse music: blocks)
        const gr = clamp(1 - (n.d - 0.14) / 0.36) * (1 - 0.8 * sparse);
        runs.push({ v, c0, r0, rows, L, d: Math.max(0.05, n.d), age: 0, shown: 0, base: 0.45 + 0.5 * vk, fl: (0.6 + 0.5 * vk) * (0.2 + 0.8 * pres), vk, gr, hit: false });
        adv[v] = Math.max(adv[v], L);
      }
      for (let v = 0; v < NV; v++) if (adv[v]) cursor[v] = (cursor[v] + adv[v]) % COLS;
      // lay down the first tiles now, on the attack frame
      reveal(0);
    },
    frame(x) {
      pres = x.p('presence');
      // below full presence the picture is built on its own canvas and laid over the stage at the end
      if (pres < 1 && !dimmed) { dimmed = document.createElement('canvas'); dimmed.width = W; dimmed.height = H; }
      const g = pres < 1 ? dimmed.getContext('2d') : x.g, dt = x.dt;
      const s = Math.round(x.p('size'));
      if (s !== S) build(s);
      reveal(dt);
      { const rk = 1 - Math.pow(0.5, dt / 6); for (let v = 0; v < NV; v++) pv[v] += (HOME[v] - pv[v]) * rk; }   // a resting voice drifts home
      // fading
      const sparse = 1 - clamp((x.feat?.rate ?? 0) * 4);   // sparse music: the paint stays longer
      const keep = Math.pow(0.5, dt / Math.max(1, x.p('stay') * 0.6 * (1 + 1.2 * sparse))), fk = Math.pow(0.5, dt / 0.14), hk = Math.pow(0.5, dt / 0.25);
      // the fine grain of quick passages glints and goes twice as fast; the solid blocks of held notes stay
      const keepF = keep * keep, a0 = amt[0], a1 = amt[1], a2 = amt[2], a3 = amt[3], a4 = amt[4], a5 = amt[5];
      for (let i = 0; i < N; i++) { const k = keep + (keepF - keep) * grain[i]; a0[i] *= k; a1[i] *= k; a2[i] *= k; a3[i] *= k; a4[i] *= k; a5[i] *= k; }
      for (let i = 0; i < N; i++) { flash[i] *= fk; hold[i] *= hk; }

      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      if (pres < 1) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = pres; }   // the ground goes first
      g.drawImage(under, 0, 0);
      g.globalAlpha = 1;
      const mix = x.p('mix'), gap = Math.max(1, S * 0.09), px4 = washImg.data;
      // pass 1: each tile's colour (into the wash image too)
      col.length = 0;
      for (let i = 0; i < N; i++) {
        let tr = 1, tg = 1, tb = 1, unc = 1, best = -1, ba = 0.02, sum = 0;
        const nz = 0.72 + 0.5 * tone[i * 4 + 3];           // each tile takes the glaze a little unevenly
        let top = 0; for (let v = 0; v < NV; v++) top = Math.max(top, amt[v][i]);
        // the hue: the voices' glazes laid over each other in proportion (a faint voice is a dim colour, not a grey one)
        if (top >= 0.004) for (let v = 0; v < NV; v++) {
          const a = Math.min(1, amt[v][i] * nz); if (a < 0.004) continue;
          const k = 0.94 * Math.min(1, amt[v][i] / top), G = GLAZE[v];
          tr *= 1 - k + (k * G[0]) / 255; tg *= 1 - k + (k * G[1]) / 255; tb *= 1 - k + (k * G[2]) / 255;
          unc *= 1 - a; sum += a;
          if (a > ba) { ba = a; best = v; }
        }
        const f = flash[i] + hold[i], o = i * 4;
        if (best < 0 && f < 0.02) { px4[o + 3] = 0; continue; }
        // the glaze: multiplied colours (new tones where voices cross), or the strongest voice's own colour
        let cr = LIGHT[0] * tr, cg = LIGHT[1] * tg, cb = LIGHT[2] * tb;
        if (best >= 0 && mix < 1) {
          const G = GLAZE[best], k = 0.94, pr = LIGHT[0] * (1 - k + (k * G[0]) / 255), pg = LIGHT[1] * (1 - k + (k * G[1]) / 255), pb = LIGHT[2] * (1 - k + (k * G[2]) / 255);
          cr = pr + (cr - pr) * mix; cg = pg + (cg - pg) * mix; cb = pb + (cb - pb) * mix;
        }
        // stacked glazes darken: lift them back toward the light a little, so crossings stay luminous
        const mx = Math.max(cr, cg, cb, 1), lift = Math.min(1.6, Math.pow(225 / mx, 0.55));
        if (lift > 1) { cr *= lift; cg *= lift; cb *= lift; }
        const cov = Math.pow(1 - unc, 0.7), b = tone[i * 4], w = tone[i * 4 + 2] - 0.5;
        const base = 30 + 14 * b;                         // the dark tile under the glaze
        let R = base + (cr * b + 10 * w - base) * cov, Gc = base * 0.7 + (cg * b - base * 0.7) * cov, B = base * 0.5 + (cb * b - 8 * w - base * 0.5) * cov;
        // the attack's flash, and the glow of a tile a held note is still painting
        const ff = Math.min(1, f);
        // (toward the glaze's own colour, lit up: a struck tile glows in its colour, not white)
        const lr = Math.min(255, cr * 1.15 + 70), lg = Math.min(250, cg * 1.15 + 62), lb = Math.min(235, cb * 1.15 + 50);
        R += (lr - R) * ff * 0.9; Gc += (lg - Gc) * ff * 0.9; B += (lb - B) * ff * 0.9;
        px4[o] = R; px4[o + 1] = Gc; px4[o + 2] = B; px4[o + 3] = Math.min(255, 255 * (cov * 1.1 + ff));
        col.push(i, R | 0, Gc | 0, B | 0, sum);
      }
      // the wash: the tiles' colours bled smoothly into the gaps and the dark tiles around them
      washG.putImageData(washImg, 0, 0);
      g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.26;
      g.drawImage(wash, OX - S * 0.5, OY - S * 0.5, COLS * S + S, ROWS * S + S);
      g.restore();
      // pass 2: the tiles, each a little irregular, as if laid by hand
      // a tile's size is its note's weight (soft: a small square in the dark, loud: a full one); a loud held note's tiles
      // close up into one block of colour, a quick passage's tiles split in four (a finer mosaic); a fresh attack pops
      const hearts = new Path2D(), rims = new Path2D(), qL = new Path2D(), qD = new Path2D(), seam = Math.max(0.8, gap * 0.4);
      for (let j = 0; j < col.length; j += 5) {
        const i = col[j], r = (i / COLS) | 0, c = i - r * COLS, b = tone[i * 4], sum = col[j + 4], bd = body[i], gr = grain[i], fl = Math.min(1, flash[i]);
        const wt = clamp((bd - 0.35) / 0.6), join = clamp((0.45 - gr) / 0.45) * clamp((bd - 0.55) / 0.25) * clamp(sum * 1.6);
        const own = (S - gap) * (0.4 + 0.6 * wt) * (0.93 + 0.07 * tone[i * 4 + 1]);
        const sz = (own + (S - seam - own) * join) * (1 + 0.34 * fl * fl), jit = (1 - join) * S * 0.08;
        const px = OX + c * S + S / 2 - sz / 2 + (tone[i * 4 + 2] - 0.5) * jit, py = OY + r * S + S / 2 - sz / 2 + (tone[i * 4 + 3] - 0.5) * jit;
        g.fillStyle = `rgb(${col[j + 1]},${col[j + 2]},${col[j + 3]})`;
        g.fillRect(px, py, sz, sz);
        if (gr > 0.5 && sz > 12) {                       // split in four, each quarter its own shade
          const h = sz / 2, q = (tone[i * 4 + 1] * 4) | 0;
          qL.rect(px + (q & 1) * h, py + (q >> 1) * h, h, h); qD.rect(px + (1 - (q & 1)) * h, py + (1 - (q >> 1)) * h, h, h);
        }
        else if (sum > 0.4 && S >= 14) { const hs = sz * (0.4 + 0.2 * b); hearts.rect(px + (sz - hs) / 2 - sz * 0.07, py + (sz - hs) / 2 - sz * 0.07, hs, hs); }
        if (fl > 0.62) rims.rect(px + 0.75, py + 0.75, sz - 1.5, sz - 1.5);
      }
      // a lighter heart in the well-painted tiles, like the brushed centre of Klee's squares (one path, one fill)
      g.fillStyle = 'rgba(255,240,210,0.085)'; g.fill(hearts);
      // (shade only, no dark cross between the quarters: a cross reads as a lit window pane)
      g.fillStyle = 'rgba(255,238,205,0.17)'; g.fill(qL); g.fillStyle = 'rgba(20,10,6,0.22)'; g.fill(qD);
      g.strokeStyle = 'rgba(255,248,228,0.7)'; g.lineWidth = 1.5; g.stroke(rims);
      // the veil: fine light dots drifting slowly over everything
      const vv = x.p('veil') * pres * pres, drift = 0.3 + 0.7 * pres;
      if (vv > 0.01) {
        const sp = Math.max(7, S * 0.5), pat = veil(sp), pw = pat.width;
        veilX = (veilX + dt * 7 * drift) % pw; veilY = (veilY + dt * 3.2 * drift) % pw;
        if (veilFill.c !== pat || veilFill.g !== g) veilFill = { c: pat, g, p: g.createPattern(pat, 'repeat') };
        g.save(); g.fillStyle = veilFill.p; g.translate(veilX - pw, veilY - pw);
        g.globalAlpha = Math.min(1, vv * 0.22); g.fillRect(0, 0, W + pw * 2, H + pw * 2);           // faint over the dark
        g.globalCompositeOperation = 'overlay'; g.globalAlpha = Math.min(1, vv * 1.1); g.fillRect(0, 0, W + pw * 2, H + pw * 2);  // bright on the colour
        g.restore();
      }
      if (pres < 1) {
        // sink the picture toward black, then lay it over the stage: its black lets the stage show as far as presence
        // allows, and 'lighten' keeps the level steady under the stage's own 12% fade (plain alpha would pile up every frame)
        g.fillStyle = `rgba(0,0,0,${0.9 * (1 - pres)})`; g.fillRect(0, 0, W, H);
        const st = x.g;
        st.fillStyle = `rgba(0,0,0,${pres})`; st.fillRect(0, 0, W, H);
        st.globalCompositeOperation = 'lighten'; st.drawImage(dimmed, 0, 0); st.globalCompositeOperation = 'source-over';
      }
    },
  });

  // runs: show their tiles across the note's length; while a note sounds its tiles deepen and glow
  function reveal(dt) {
    for (const u of runs) {
      u.age += dt;
      const want = u.age >= u.d ? u.L : Math.min(u.L, 1 + Math.floor((u.age / u.d) * u.L));
      const sounding = u.age < u.d;
      for (let k = 0; k < want; k++) {
        const c = (u.c0 + k) % COLS;
        for (let rr = -HALO; rr < u.rows + HALO; rr++) {
          const row = u.r0 + rr; if (row < 0 || row >= ROWS) continue;
          // the row itself, and a thinner glaze above and below it, where neighbouring voices meet and mix
          const dist = rr < 0 ? -rr : rr >= u.rows ? rr - u.rows + 1 : 0, wgt = dist ? 0.38 * Math.pow(0.4, dist - 1) : 1;
          const i = row * COLS + c, a = amt[u.v];
          if (k >= u.shown) {
            a[i] = Math.max(a[i], u.base * wgt) + 0.15 * wgt;
            // the tile takes the note's weight (loud: a full square, soft: a small one) and its grain
            if (!dist) { flash[i] = Math.max(flash[i], u.fl * (k === 0 ? 1 : 0.6)); body[i] = Math.max(u.vk, body[i] * 0.7); grain[i] = u.gr; }
            else { body[i] = Math.max(body[i] * 0.85, u.vk * 0.3); if (a[i] > 0.3) grain[i] = u.gr; }
          }
          else if (sounding) a[i] = Math.min(1.6, a[i] + dt * 0.55 * wgt);
          if (sounding && !dist) hold[i] = Math.max(hold[i], 0.16 * pres);
        }
      }
      u.shown = want;
      // a loud attack throws a spray of lit tiles around its first column, in its own glaze (soft notes land alone)
      if (!u.hit) {
        u.hit = true;
        const e = clamp((u.vk - 0.72) / 0.2) * clamp(pres * 2 - 1);        // from about mezzo-forte up (none once it's half toned down)
        if (e > 0) {
          const RB = e > 0.5 ? 2 : 1, a = amt[u.v];
          for (let rr = -RB; rr < u.rows + RB; rr++) {
            const row = u.r0 + rr; if (row < 0 || row >= ROWS) continue;
            const dy = rr < 0 ? -rr : rr >= u.rows ? rr - u.rows + 1 : 0;
            for (let dc = -RB; dc <= RB; dc++) {
              const d = Math.max(dy, Math.abs(dc)); if (!d) continue;
              const i = row * COLS + ((u.c0 + dc + COLS) % COLS), q = e * (1 - (d - 1) / (RB + 0.5));
              flash[i] = Math.max(flash[i], 0.95 * q); a[i] = Math.max(a[i], 0.35 * q); body[i] = Math.max(body[i], 0.2 + 0.5 * q);
            }
          }
        }
      }
    }
    runs = runs.filter((u) => u.age < u.d || u.shown < u.L);
  }
})();
