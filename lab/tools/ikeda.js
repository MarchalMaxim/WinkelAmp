// Ikeda: after Ryoji Ikeda's data art. Strictly white on black, every line one pixel and on the pixel grid.
// The screen is a set of instrument bands, top to bottom:
//   data rows   six rows of invented glyphs streaming left; each attack writes its notes in as bright glyphs
//   the field   every sounding note is a vertical barcode at its key (low keys left, high keys right): the same note
//               always gives the same code, louder = wider; on the attack it strobes across the whole screen, then
//               settles into a band on the row of its note name (C at the bottom: octaves share a row, a chord stacks
//               up) with its number in glyphs, and erodes bar by bar after the note ends. Flickering columns of glyphs stand in the field as data.
//   the roll    the notes as one-pixel lines (height = pitch), scrolling left past a fixed playhead; the notes still to
//               come wait dimly on the right and light up as they cross it
//   the ruler   a time ruler with a tick per note, its length the note's loudness
//   readout     a glyph counter and a hairline loudness meter
// Loud attacks slam single-pixel lines across the whole screen; the loudest turn it white for an instant.
// How present (the user, 2026-11-01: sliders should dim, not only boost): turned down, the wall of data goes first, then
// everything fades; scrolling and flicker slow, slams and flashes stop, codes stay on their row instead of strobing
// across the screen, and only this piece's hardest notes write anything (or stand in the roll). At 1 none of this applies.
(() => {
  const GW = 8, GH = 12;                                     // glyph pitch (each glyph is 3x5 cells of 2 px)
  const FIELD0 = 124, FIELD1 = 470, ROLL0 = 494, ROLL1 = 590, BASE = 610, READ = 678, PLAY = 960;
  let rows, cols, off, inject, notes, slams, flashT, flashCool, slamCool, ref, count, lastVel, vels = null;

  // how present (0..1): the softest loudness that still answers, judged against this piece's own notes (recordings differ
  // a lot in how hard they are played): every note at 1, the hardest 40% at 0.4, the hardest 5% at 0
  function softest(pres) {
    if (pres >= 1) return -Infinity;
    vels ||= (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    return vels.length ? vels[Math.min(vels.length - 1, Math.floor((1 - pres) * 0.95 * vels.length))] : -Infinity;
  }

  // a cheap integer hash → 0..1
  function hh(a, b = 0, c = 0) {
    let z = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0;
    z = Math.imul(z ^ (z >>> 13), 1274126177); z ^= z >>> 16;
    return (z >>> 0) / 4294967296;
  }

  // 16 invented glyphs on a 3x5 grid (they read as numbers, but no glyph is a real digit or letter), drawn once into
  // two strips: white ink, and black ink for the inverted (highlighted) glyphs
  const GLYPHS = [];
  { const r = ICON.rng(4041);
    while (GLYPHS.length < 16) {
      const bits = []; let on = 0;
      for (let i = 0; i < 15; i++) { const b = r() < 0.55 ? 1 : 0; bits.push(b); on += b; }
      if (on < 6 || on > 11) continue;
      if (![0, 1, 2].every((cx) => bits.some((b, i) => b && i % 3 === cx))) continue;    // every column has ink
      GLYPHS.push(bits);
    } }
  function strip(col) {
    const cv = document.createElement('canvas'); cv.width = 16 * GW; cv.height = GH;
    const c = cv.getContext('2d'); c.fillStyle = col;
    GLYPHS.forEach((bits, k) => bits.forEach((b, i) => { if (b) c.fillRect(k * GW + 1 + (i % 3) * 2, 1 + Math.floor(i / 3) * 2, 2, 2); }));
    return cv;
  }
  const ATLAS = strip('#fff'), ATLAS_K = strip('#000');
  const glyph = (g, code, x, y, atlas = ATLAS) => g.drawImage(atlas, (code & 15) * GW, 0, GW, GH, x, y, GW, GH);

  // each key's own barcode: [offset from the key's centre, width] bars over 120 px, thicker bars in the bass
  const CODES = [];
  for (let m = 0; m < 128; m++) {
    const r = ICON.rng(m * 31 + 7), bars = [], heavy = Math.max(0, (60 - m) / 36);
    const W = [1, 1, 1, 2, 2, 3, 4, 6];
    let x = -60;
    while (x < 60) {
      const w = Math.max(1, Math.round(W[Math.floor(r() * W.length)] * (1 + heavy * r())));
      bars.push([x, w, r()]);                              // r(): when this bar erodes away
      x += w + 1 + Math.floor(r() * r() * 7);
    }
    CODES.push(bars);
  }
  const keyX = (m) => 40 + ((m - 21) / 87) * 1200;

  const ROWS = 6, ROWY = 28;
  function reset() {
    rows = null; cols = null; off = new Float64Array(ROWS); inject = []; notes = []; slams = []; flashT = 0; flashCool = 0; slamCool = 0;
    ref = 92; count = 0; lastVel = 0; vels = null;
  }
  reset();

  // the knob pictures (40x26, white ink only)
  const ICONS = {
    busy(g, v) {                                           // a few columns of data, or many
      const r = ICON.rng(3), n = Math.round(2 + v * 8);
      for (let i = 0; i < n; i++) { const x = 3 + Math.floor(r() * 33); for (let y = 3; y < 23; y += 3) if (r() < 0.75) ICON.rect(g, x, y, 2, 2, ICON.ink); }
    },
    life(g, v, w, h) {                                     // a barcode that erodes: most bars gone, or nearly all still there
      const r = ICON.rng(9);
      for (let x = 3; x < w - 3;) { const bw = 1 + Math.floor(r() * 3); if (r() < 0.12 + v * 0.88) ICON.rect(g, x, 3, bw, h - 6, ICON.ink); x += bw + 1 + Math.floor(r() * 2); }
    },
    slam(g, v, w, h) {                                     // no lines, or a burst of hairlines across
      ICON.dot(g, 6, h / 2, 2.2, ICON.ink);
      const n = Math.round(v * 6), r = ICON.rng(5);
      for (let i = 0; i < n; i++) ICON.rect(g, 1, 3 + Math.floor(r() * (h - 6)), w - 2, 1, ICON.ink);
    },
    flash(g, v, w, h) {                                    // four little screens: none lit, or all of them white
      const n = Math.round(v * 4);
      for (let i = 0; i < 4; i++) {
        const x = 2 + i * 9.5;
        if (i < n) { ICON.rect(g, x, 7, 8, 12, ICON.ink); ICON.rect(g, x + 2, 9, 1, 8, '#000'); ICON.rect(g, x + 5, 9, 1, 8, '#000'); }
        else { g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(x + 0.5, 7.5, 7, 11); }
      }
    },
    speed(g, v, w, h) {                                    // ticks drawn out by the scroll: close together, or streaking
      const L = 1 + v * 9;
      for (let i = 0; i < 5; i++) { const x = 4 + i * 7; ICON.rect(g, x, 6, 1, 14, ICON.ink); ICON.alpha(g, 0.35, () => ICON.rect(g, x + 1, 12, L, 1, ICON.ink)); }
    },
    presence(g, v, w, h) {                                 // a little screen: a faint short code on one row, or a bright one floor to ceiling
      g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(2.5, 1.5, w - 5, h - 3);
      const r = ICON.rng(21), bh = Math.round(4 + v * 16), y = Math.round((h - bh) / 2);
      ICON.alpha(g, 0.15 + 0.85 * v, () => {
        for (let x = 6; x < w - 6;) { const bw = 1 + Math.floor(r() * 3); if (r() < 0.25 + v * 0.75) ICON.rect(g, x, y, bw, bh, ICON.ink); x += bw + 1 + Math.floor(r() * 2); }
      });
    },
  };

  TOOLS.push({
    id: 'ikeda', name: 'Ikeda', tag: 'new',
    blurb: 'After Ryoji Ikeda: black and white data. Every note is a barcode at its key (the same note always gives the same code, louder is wider) that strobes across the screen on the attack, settles on the row of its note name (every C on one row, every G on another) and erodes bar by bar; rows of glyphs stream the notes, a one-pixel score scrolls past a playhead, and loud attacks slam hairlines across the screen.',
    params: [
      { key: 'busy', label: 'how much data', min: 0, max: 1, value: 0.3, drive: '+rate',
        hint: 'How full the screen is with streaming glyphs and data columns. Left: a few clean bars and lines. Right: dense data everywhere.',
        icon: ICONS.busy },
      { key: 'life', label: 'how long a barcode stays', min: 0.1, max: 3, value: 1.2,
        hint: 'How long a note\'s barcode takes to erode after the note ends. Left: gone in a blink. Right: it crumbles slowly, bar by bar.',
        icon: ICONS.life },
      { key: 'slam', label: 'lines on loud notes', min: 0, max: 1, value: 0.35, drive: '+level',
        hint: 'How many single-pixel lines slam across the screen when a note is struck loud. Left: none. Right: a burst of lines.',
        icon: ICONS.slam },
      { key: 'flash', label: 'white flashes', min: 0, max: 1, value: 0.5,
        hint: 'How often the very loudest attacks turn the whole screen white for an instant. Left: never. Right: on every big accent.',
        icon: ICONS.flash },
      { key: 'speed', label: 'scroll speed', min: 0.3, max: 2.5, value: 1,
        hint: 'How fast the score and the glyph rows scroll. Left: a slow drift. Right: racing past.',
        icon: ICONS.speed },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: faint and slow, and only the hardest notes of the piece print a barcode. Right: everything at full strength (as before).',
        icon: ICONS.presence },
    ],
    reset,
    onChord(ch, x) {
      const t = x.t;
      count += ch.notes.length;
      ref = Math.max(ref, ch.vel);
      const pres = x.p('presence'), soft = softest(pres);
      for (const n of ch.notes) {
        if (n.v < soft) continue;                            // too soft for how present it is: it writes nothing
        // a short note still shows its code for a moment before it erodes
        notes.push({ m: n.m, v: n.v, t0: t, end: t + Math.max(0.6, n.d), seed: (t * 1000) | 0 });
        // the data rows: each note writes its code (two glyphs) at the right edge of a row picked by its pitch
        const r = Math.max(0, Math.min(ROWS - 1, Math.floor(((n.m - 21) / 88) * ROWS)));
        const col = Math.floor((1280 + off[r]) / GW) + 1 + (inject.filter((q) => q.r === r && q.t0 === t).length) * 3;
        inject.push({ r, col, code: n.m >> 4, t0: t }, { r, col: col + 1, code: n.m & 15, t0: t });
      }
      if (notes.length > 160) notes.splice(0, notes.length - 160);
      if (inject.length > 2000) inject.splice(0, inject.length - 2000);
      // loud, relative to the last few seconds (with a floor, so a quiet oboe never slams)
      const loud = ch.vel >= Math.max(80, ref - 8);
      const k = x.p('slam') * pres * pres;                   // turned down, the lines thin out and stop
      if (loud && slamCool <= 0 && k > 0.02) {
        const n = Math.round(k * (2 + (ch.vel - 78) * 0.35) * (0.6 + 0.2 * ch.notes.length));
        const seed = (t * 997) | 0;
        for (let i = 0; i < n; i++) {
          const n0 = ch.notes[i % ch.notes.length];
          if (i % 3 === 2) slams.push({ v: true, x: Math.round(keyX(n0.m) + (hh(seed, i, 1) - 0.5) * 80), t0: t, o: Math.round(hh(seed, i, 2) * 720) });
          else slams.push({ v: false, y: Math.round(4 + hh(seed, i, 3) * 712), t0: t, o: Math.round(keyX(n0.m)) });
        }
        slamCool = 0.1;
      }
      if (ch.vel >= Math.max(90, ref - 3) && flashCool <= 0 && hh((t * 991) | 0, 77) < x.p('flash') * 1.15 * (2 * pres - 1)) { flashT = 0.1; flashCool = 1.4; }   // no flashes below half way
      if (ch.vel >= soft) lastVel = Math.max(lastVel, ch.vel);
    },
    frame(x) {
      const g = x.g, t = x.t, dt = x.dt, W = x.W, H = x.H;
      const pres = x.p('presence'), calm = 1 - 0.75 * (1 - pres), wall = pres * pres, soft = softest(pres);   // all of these are 1 (and -Infinity) at full presence
      const busy = x.p('busy'), life = x.p('life'), speed = x.p('speed') * calm;
      slamCool -= dt; flashCool -= dt; flashT -= dt;
      ref = Math.max(80, ref - dt * 2.2);                   // the loud reference sinks slowly
      lastVel = Math.max(0, lastVel - dt * 90);
      g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);   // our own ground: nothing smears

      // ---- the frame of the instrument: hairline rules and a dotted measuring grid in the field
      g.fillStyle = '#fff';
      g.globalAlpha = 0.28;
      g.fillRect(0, FIELD0 - 10, W, 1); g.fillRect(0, FIELD1 + 10, W, 1); g.fillRect(0, ROWY - 8, W, 1);
      g.globalAlpha = 0.22;
      g.beginPath();
      for (let gx = 40; gx <= 1240; gx += 40) for (let gy = FIELD0; gy <= FIELD1; gy += 40) g.rect(gx, gy, 1, 1);
      for (let m = 24; m <= 108; m += 12) g.rect(Math.round(keyX(m)), FIELD1 + 6, 1, 4);    // the Cs: a key ruler
      for (let r = 0; r <= 12; r++) g.rect(16, Math.round(FIELD0 + (r * (FIELD1 - FIELD0)) / 12), r % 12 === 0 ? 10 : 5, 1);   // the 12 rows
      g.fill();

      // ---- the data rows (top): streaming glyphs, each row its own speed; the notes written in are bright
      const step = Math.floor(t * calm * 12);
      const shown = 2 + Math.round(busy * 4), fill = 0.55;   // busier: more of the six rows stream (the notes show in all)
      rows ||= Array.from({ length: ROWS }, () => ({ cv: null, from: 0 }));
      for (let r = 0; r < ROWS; r++) {
        off[r] += dt * speed * (36 + r * 21);
        const y = ROWY + r * GH, o = off[r], c0 = Math.floor(o / GW);
        // the steady glyphs come from a strip of 256 columns, drawn again only when the row scrolls past its end
        const row = rows[r];
        if (!row.cv || c0 < row.from || c0 + 162 > row.from + 256) {
          row.cv ||= Object.assign(document.createElement('canvas'), { width: 256 * GW, height: GH });
          const c = row.cv.getContext('2d'); c.clearRect(0, 0, 256 * GW, GH);
          row.from = c0;
          for (let i = 0; i < 256; i++) { const col = c0 + i; if (hh(col, r, 5) <= fill && hh(col, r, 6) >= 0.15) glyph(c, Math.floor(hh(col, r, 7) * 16), i * GW, 0); }
          // the notes written into this row live on their own strip, drawn at full white
          row.icv ||= Object.assign(document.createElement('canvas'), { width: 256 * GW, height: GH });
          row.icv.getContext('2d').clearRect(0, 0, 256 * GW, GH);
          for (const q of inject) if (q.r === r) q.baked = false;
        }
        const sx = Math.round((row.from - c0) * GW - (o - c0 * GW));
        g.globalAlpha = 1; g.drawImage(row.icv, sx, y);
        if ([2, 3, 1, 4, 0, 5].indexOf(r) >= shown) continue;   // the middle rows first
        g.globalAlpha = 0.3; g.drawImage(row.cv, sx, y);
        for (let i = 0; i <= 161; i++) {                  // the flickering ones, every frame
          const col = c0 + i;
          if (hh(col, r, 5) > fill || hh(col, r, 6) >= 0.15) continue;
          glyph(g, Math.floor(hh(col, r, step) * 16), Math.round(col * GW - o), y);
        }
      }
      g.globalAlpha = 1;
      for (const q of inject) {
        const age = t - q.t0, row = rows[q.r];
        if (age < 0.35) {                                // fresh: inverted, drawn on the screen (the strip shows through)
          const xx = Math.round(q.col * GW - off[q.r]); if (xx < -GW || xx > W) continue;
          const y = ROWY + q.r * GH;
          g.fillRect(xx, y, GW, GH); glyph(g, q.code, xx, y, ATLAS_K);
        } else if (!q.baked) {                           // then baked into the row's strip, white on a black box
          const lx = (q.col - row.from) * GW; if (lx < 0 || lx > 255 * GW) continue;   // past the strip: baked when it's redrawn
          q.baked = true;
          const c = row.icv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(lx, 0, GW, GH); glyph(c, q.code, lx, 0);
        }
      }
      inject = inject.filter((q) => q.col * GW - off[q.r] > -GW * 2);

      // ---- the data columns in the field: stacks of glyphs, scrolling upward and flickering
      const ncol = Math.round(1 + busy * 15), rowsN = Math.floor((FIELD1 - FIELD0) / GH);
      cols ||= Array.from({ length: 16 }, () => ({ cv: null, from: 0, y: 0 }));
      g.save(); g.beginPath(); g.rect(0, FIELD0 - 2, W, FIELD1 - FIELD0 + 4); g.clip();
      for (let i = 0; i < ncol; i++) {
        const cx = 40 + Math.floor(hh(i, 11) * 150) * 8, col = cols[i];
        col.y += dt * (0.6 + hh(i, 12) * 2.4) * speed * GH;
        const base = Math.floor(col.y / GH), fy = col.y - base * GH;
        if (!col.cv || base < col.from || base + rowsN + 2 > col.from + 64) {   // a strip of 64 glyphs, redrawn as it runs out
          col.cv ||= Object.assign(document.createElement('canvas'), { width: GW, height: 64 * GH });
          const c = col.cv.getContext('2d'); c.clearRect(0, 0, GW, 64 * GH); col.from = base;
          for (let j = 0; j < 64; j++) if (hh(i, base + j, 14) >= 0.25) glyph(c, Math.floor(hh(i, base + j, 15) * 16), 0, j * GH);
        }
        let near = 0;                                     // a note struck near the column lights it
        for (const n of notes) if (t - n.t0 < 0.4 && Math.abs(keyX(n.m) - cx) < 70) near = Math.max(near, 1 - (t - n.t0) / 0.4);
        const y0 = Math.round(FIELD0 - (base - col.from) * GH - fy);
        g.globalAlpha = 0.26 + near * 0.4; g.drawImage(col.cv, cx, y0);
        const lit = Math.floor(t * calm * (6 + hh(i, 13) * 18));
        g.globalAlpha = 0.95;
        for (let j = 0; j <= rowsN; j++) {                // a few glyphs flash bright, more when a note is near
          const id = base + j;
          if (hh(i, id, 14) < 0.25 || hh(i, id, lit) >= 0.06 + near * 0.5) continue;
          glyph(g, Math.floor(hh(i, id, 15) * 16), cx, Math.round(FIELD0 + j * GH - fy));
        }
      }
      g.restore();
      // how present: the instrument's frame and the wall of data go first (black laid over all of it)
      if (wall < 1) { g.globalAlpha = 1 - wall; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; }

      // ---- the field: each note's barcode at its key; strobes on the attack, holds, then erodes bar by bar
      g.globalAlpha = 1;
      const strobeK = Math.floor(t * 30);
      for (const n of notes) {
        const age = t - n.t0;
        let erode;
        if (t < n.end) erode = 0.2 * Math.min(1, age / Math.max(0.5, n.end - n.t0)) * (1 - n.v / 160);
        else erode = 0.2 + 0.8 * Math.pow((t - n.end) / life, 1.4);
        if (erode >= 1) continue;
        if (age < 0.16 && age > 0.03 && hh(strobeK, n.m, n.seed) < 0.45 * wall) continue;     // the strobe: on/off for a moment
        const cx = Math.round(keyX(n.m)), half = 12 + Math.pow(n.v / 127, 1.3) * 52;
        // the attack frame spans the screen; then the code settles into a band at its pitch class (C at the bottom,
        // so the notes of a chord stack up and every octave of a note sits on the same row)
        const rowH = (FIELD1 - FIELD0) / 12, yc = FIELD1 - ((n.m % 12) + 0.5) * rowH, hb = 10 + (n.v / 127) * 20;
        const k = age < 0.12 ? 0 : 1 - Math.pow(1 - Math.min(1, (age - 0.12) / 0.5), 3);
        let top = age < 0.12 ? 0 : Math.round(FIELD0 + (yc - hb - FIELD0) * k), bot = age < 0.12 ? H : Math.round(FIELD1 + (yc + hb - FIELD1) * k);
        if (wall < 1) { top = Math.round(yc - hb + (top - yc + hb) * wall); bot = Math.round(yc + hb + (bot - yc - hb) * wall); }   // turned down: it hardly leaves its row
        g.globalAlpha = age < 0.12 ? 1 : 0.92;
        g.beginPath();
        for (const [bx, bw, e] of CODES[n.m]) {
          if (bx + bw < -half || bx > half) continue;
          if (e < erode) continue;
          g.rect(cx + bx, top, bw, bot - top);
        }
        g.fill();
        if (k > 0.6 && erode < 0.6) {                    // the settled code carries its label: the note in two glyphs
          const lx = Math.round(cx + half + 4), ly = Math.round(yc - GH / 2);
          glyph(g, n.m >> 4, lx, ly); glyph(g, n.m & 15, lx + GW, ly);
          g.fillRect(Math.round(cx - half - 4), Math.round(yc), 3, 1);
        }
        if (age < 0.12) {                                 // a hairline frame around a fresh code
          g.fillRect(Math.round(cx - half - 6), FIELD0 - 4, Math.round(half * 2 + 12), 1);
          g.fillRect(Math.round(cx - half - 6), FIELD1 + 3, Math.round(half * 2 + 12), 1);
        }
      }
      notes = notes.filter((n) => t < n.end + life + 0.05);

      // ---- the roll and the ruler: past notes scroll left from the playhead, the coming ones wait dimly on the right
      const pps = 110 * speed, N = window.NOTES || [];
      const tL = t - PLAY / pps, tR = t + (W - PLAY) / pps;
      let i0 = 0, i1 = N.length;
      while (i0 < i1) { const k = (i0 + i1) >> 1; if (N[k][0] < tL - 8) i0 = k + 1; else i1 = k; }
      const rollY = (m) => Math.round(ROLL1 - ((m - 21) / 87) * (ROLL1 - ROLL0));
      const past = [], future = [], ticksP = [], ticksF = [], fresh = [];
      for (let k = i0; k < N.length && N[k][0] <= tR; k++) {
        const [s, e, m, v] = N[k];
        if (e < tL || v < soft) continue;
        const xa = Math.round(PLAY + (s - t) * pps), xb = Math.round(PLAY + (Math.min(e, tR) - t) * pps);
        const y = rollY(m);
        (s <= t ? past : future).push([Math.max(0, xa), y, Math.max(1, xb - Math.max(0, xa))]);
        if (xa >= 0) (s <= t ? ticksP : ticksF).push([xa, Math.round(6 + (v / 127) * 34)]);
        if (s <= t && t - s < 0.25) fresh.push([xa, y]);
      }
      g.globalAlpha = 0.25; g.beginPath(); for (const [a, y, w] of future) g.rect(a, y, w, 1); for (const [a, l] of ticksF) g.rect(a, BASE + 2, 1, l); g.fill();
      g.globalAlpha = 0.85; g.beginPath(); for (const [a, y, w] of past) g.rect(a, y, w, 1); g.fill();
      g.globalAlpha = 1; g.beginPath(); for (const [a, l] of ticksP) g.rect(a, BASE + 2, 1, l); for (const [a, y] of fresh) g.rect(a - 1, y - 1, 3, 3); g.fill();
      // the ruler: a tick every 0.1 s, longer every second, a glyph label every 5 s
      g.globalAlpha = 0.55; g.fillRect(0, BASE, W, 1);
      g.beginPath();
      for (let k = Math.ceil(tL * 10); k <= tR * 10; k++) { const xx = Math.round(PLAY + (k / 10 - t) * pps); g.rect(xx, BASE - (k % 10 === 0 ? 8 : 3), 1, k % 10 === 0 ? 8 : 3); }
      g.fill();
      g.globalAlpha = 0.45;
      for (let k = Math.ceil(tL / 5); k * 5 <= tR; k++) { const xx = Math.round(PLAY + (k * 5 - t) * pps); for (let j = 0; j < 3; j++) glyph(g, Math.floor(hh(k, j, 21) * 16), xx + 3 + j * GW, BASE - 22); }
      // the playhead
      g.globalAlpha = 1; g.fillRect(PLAY, ROLL0 - 8, 1, BASE + 44 - ROLL0 + 8); g.fillRect(PLAY - 3, ROLL0 - 8, 7, 1);

      // ---- the readout: a counter in glyphs (song time and notes so far), and a hairline loudness meter
      const digits = [Math.floor(t * 100), count];
      let xx = 40;
      for (const d of digits) {
        g.globalAlpha = 0.8;
        for (let j = 5; j >= 0; j--) { glyph(g, Math.floor(d / Math.pow(16, j)) & 15, xx, READ); xx += GW; }
        xx += GW * 2;
      }
      const lv = Math.min(1, lastVel / 120), nb = 96;
      g.beginPath(); for (let j = 0; j < nb; j++) if (j / nb < lv) g.rect(1240 - nb * 3 + j * 3, READ, 1, GH - 2); g.fill();
      g.globalAlpha = 0.25; g.beginPath(); for (let j = 0; j < nb; j++) if (j / nb >= lv) g.rect(1240 - nb * 3 + j * 3, READ + GH - 4, 1, 2); g.fill();

      // ---- slams: one-pixel lines that shoot across the whole screen from the struck key, then vanish
      g.globalAlpha = 1; g.beginPath();
      for (const s of slams) {
        const age = t - s.t0; if (age > 0.22) continue;
        const reach = Math.min(1, age / 0.05 + 0.35);
        if (s.v) { const a = s.o * (1 - reach), b = s.o + (H - s.o) * reach; g.rect(s.x, Math.round(a), 1, Math.round(b - a)); }
        else { const a = s.o * (1 - reach), b = s.o + (W - s.o) * reach; g.rect(Math.round(a), s.y, Math.round(b - a), 1); }
      }
      g.fill();
      slams = slams.filter((s) => t - s.t0 <= 0.22);

      // ---- the loudest attacks: the whole screen inverts for an instant
      if (flashT > 0) { g.globalCompositeOperation = 'difference'; g.globalAlpha = 1; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
      // how present: everything fades, down to a whisper
      if (pres < 1) { g.globalAlpha = 0.88 * (1 - pres); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    },
  });
})();
