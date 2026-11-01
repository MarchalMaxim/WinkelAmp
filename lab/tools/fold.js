// Fold: a mirror for the whole picture. Rorschach mirrors only its own ink; fold mirrors everything already on the
// canvas. After all widgets have drawn (a microtask queued from frame(), like pixelsort; RENDER_POST in render mode), it
// copies the canvas once and draws the copy flipped across a fold line through the centre, so any widget becomes a
// symmetric blot: kusama a twin colony, marbling a Rorschach marble, strings a woven butterfly, ikeda a mirrored data wall.
// The music drives the fold:
// - the fold line's angle follows the bass's note name on the circle of fifths (a rolling, duration-weighted guess of
//   the bass note over the last couple of seconds, so it turns with the harmony and stays put while the key holds; the
//   song's home bass note stands upright; the 12 fifths spread over half a turn, 15° apart);
// - full chords flip which half is the source, so the picture inverts its symmetry at the attack;
// - loud chords add one more fold (one mirror becomes a fourfold kaleidoscope) that relaxes back over a beat;
// - in quiet passages the mirror image fades to about 60%, so the fold breathes.
// Its own mark, so it shows alone and shows where the mirror is when mixed: a stitched seam of light along each fold line
// that flashes on every attack (each note of the chord adds a stitch, low notes near the centre, high ones far out),
// and a thin echo of the seam that lags behind when the axis turns.
// More than one fold is a true kaleidoscope: one source wedge of 180°/n, copied by rotation and reflection into the
// other 2n−1 wedges. Cost: one copy of the canvas, then per wedge a clip and one drawImage, plus up to four more where
// the copy is tilted (it goes on mirrored across its own edges to fill the screen's corners): one fold upright is
// 1 copy + 1 draw, tilted 1 copy + 2 or 3. No pixel reads, no randomness, so the lab and the studio draw the same pixels.
(() => {
  const TAU = Math.PI * 2, HALF = Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrapHalf = (d) => { d = ((d + HALF / 2) % HALF + HALF) % HALF - HALF / 2; return d; };   // shortest turn of an axis (mod 180°)
  let snap = null, sg = null, queued = false;
  let ang = HALF / 2, echo = HALF / 2, side = 0, flipAcc = 0, bump = 0, lv = 0, flash = 0;
  const hist = new Float64Array(12);
  let stitches = [];

  // The song's home: the bass note name it dwells on most (duration-weighted), read once from the notes.
  let HOME = -1, VQ = 0;
  const home = () => {
    if (HOME >= 0) return HOME;
    const h = new Float64Array(12), N = window.NOTES || [];
    for (const n of N) if (n[2] < 55) h[n[2] % 12] += Math.min(2, n[1] - n[0]);
    let b = 0; for (let i = 1; i < 12; i++) if (h[i] > h[b]) b = i;
    return (HOME = N.length ? b : 0);
  };
  // loudness relative to this recording (its 93rd-percentile velocity), as pixelsort, so both songs reach the big folds
  const loud = (v) => {
    if (!VQ) { const v2 = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b); VQ = v2.length ? Math.max(70, v2[Math.floor(v2.length * 0.93)]) : 100; }
    return clamp((v * 100 / VQ - 45) / 58, 0, 1);
  };
  // The axis for the current bass guess: home upright (90°), each step round the circle of fifths 15° further.
  const target = (turn) => {
    let b = 0; for (let i = 1; i < 12; i++) if (hist[i] > hist[b]) b = i;
    if (hist[b] <= 0) return HALF / 2;
    const r = ((((b * 7) % 12) - ((home() * 7) % 12)) % 12 + 12) % 12, s = r > 6 ? r - 12 : r;   // −5..6 fifths from home
    return HALF / 2 + turn * s * (Math.PI / 12);
  };

  // One wedge: centre plus an arc far outside the screen, from angle a0 to a1.
  const wedge = (g, cx, cy, a0, a1) => {
    const R = 2000, n = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 6)));
    g.beginPath(); g.moveTo(cx, cy);
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; g.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); }
    g.closePath(); g.clip();
  };
  // Draw the copy through matrix [[a, c], [b, d]] about the centre, into wedge a0..a1. A tilted (or quarter-turned) copy
  // of the 16:9 screen leaves some of the screen's corners bare: there the copy goes on mirrored across its own edges (as
  // a mirror-repeat texture does), so the picture runs on without a seam instead of stopping at a hard straight edge.
  // The edge copies and the copy itself never overlap and between them always cover the screen; only the edges the
  // wedge's part of the screen actually reaches past are drawn (its corners, taken back through the matrix, say which).
  const put = (g, a, b, c, d, cx, cy, W, H, a0, a1) => {
    g.setTransform(a, b, c, d, cx - a * cx - c * cy, cy - b * cx - d * cy); g.drawImage(snap, 0, 0, W, H);
    if (Math.abs(Math.abs(a) - 1) < 1e-3) return;
    const hw = W / 2, hh = H / 2, pts = [];
    for (const t of [a0, a1]) { const co = Math.cos(t), si = Math.sin(t), r = Math.min(hw / Math.max(1e-9, Math.abs(co)), hh / Math.max(1e-9, Math.abs(si))); pts.push(co * r, si * r); }
    for (const [px, py] of [[hw, hh], [-hw, hh], [-hw, -hh], [hw, -hh]]) {
      const u = (((Math.atan2(py, px) - a0) % TAU) + TAU) % TAU; if (u <= a1 - a0) pts.push(px, py);
    }
    let L = false, R = false, T = false, B = false;
    for (let i = 0; i < pts.length; i += 2) {
      const qx = a * pts[i] + b * pts[i + 1], qy = c * pts[i] + d * pts[i + 1];   // back through the (orthogonal) matrix
      if (qx < -hw - 0.5) L = true; if (qx > hw + 0.5) R = true; if (qy < -hh - 0.5) T = true; if (qy > hh + 0.5) B = true;
    }
    for (const [need, ea, ed, ee, ef] of [[L, -1, 1, 0, 0], [R, -1, 1, 2 * W, 0], [T, 1, -1, 0, 0], [B, 1, -1, 0, 2 * H]]) {
      if (!need) continue;
      g.save(); g.transform(ea, 0, 0, ed, ee, ef); g.drawImage(snap, 0, 0, W, H); g.restore();
    }
  };
  // n folds: source wedge [s, s + 180°/n]; wedge j is its rotation by j·180°/n (j even) or its mirror across the line at
  // s + (j+1)·90°/n (j odd).
  function kaleido(g, n, s, alpha, cx, cy, W, H) {
    const w = HALF / n;
    g.globalAlpha = alpha;
    for (let j = 1; j < 2 * n; j++) {
      let m;
      if (j % 2 === 0) { const r = j * w, co = Math.cos(r), si = Math.sin(r); m = [co, si, -si, co]; }
      else { const p = 2 * (s + ((j + 1) * w) / 2), co = Math.cos(p), si = Math.sin(p); m = [co, si, si, -co]; }
      g.save(); wedge(g, cx, cy, s + j * w, s + (j + 1) * w);
      put(g, m[0], m[1], m[2], m[3], cx, cy, W, H, s + j * w, s + (j + 1) * w);
      g.restore();
    }
  }

  // Runs after every widget has drawn this frame.
  function post(x, k) {
    queued = false;
    try {
      const g = x.g, W = x.W || 1280, H = x.H || 720, cx = W / 2, cy = H / 2;
      // the copy: the shared canvas at its real size (×S in a supersampled render), drawn back over W×H units
      const c = x.canvas;
      if (!snap || snap.width !== c.width || snap.height !== c.height) { snap = document.createElement('canvas'); snap.width = c.width; snap.height = c.height; sg = snap.getContext('2d'); }
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.shadowBlur = 0;
      // The mirror's strength: ordinary playing gives the full mirror, only quiet passages (no chord above soft for a few
      // seconds) fade it to ~60%. (Most widgets repaint their own ground every frame, so the copy shows at just this
      // alpha; on ones that leave the shared fading canvas be, it builds up a little stronger.)
      const a = clamp(k.strength * (0.6 + 0.4 * clamp((lv - 0.1) / 0.35, 0, 1)), 0, 1);
      if (a > 0.004) {
        sg.globalCompositeOperation = 'copy'; sg.drawImage(x.canvas, 0, 0); sg.globalCompositeOperation = 'source-over';
        const n = k.folds, s = ang + (side ? HALF / n : 0);
        kaleido(g, n, s, a, cx, cy, W, H);
        const b = bump * bump * (3 - 2 * bump);                         // the loud chord's extra fold, easing out
        if (b > 0.01 && n < 6) kaleido(g, n + 1, s, a * b, cx, cy, W, H);
      }
      // the seams: one per fold line, gold, flashing white-hot at the attack, with stitches across it
      if (k.seam > 0.01) {
        const n = k.folds, L = Math.hypot(W, H) / 2 + 10, few = 1 / Math.sqrt(n);   // more folds: each seam quieter, or six of them drown the picture
        const line = (th, lw, col, al) => {
          const dx = Math.cos(th), dy = Math.sin(th);
          g.globalAlpha = al; g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round';
          g.beginPath(); g.moveTo(cx - dx * L, cy - dy * L); g.lineTo(cx + dx * L, cy + dy * L); g.stroke();
        };
        // the echo lags behind when the axis turns
        const lag = Math.abs(wrapHalf(ang - echo));
        if (lag > 0.01) for (let i = 0; i < n; i++) line(echo + (i * HALF) / n, 0.8 + k.seam, 'rgb(224,176,74)', few * k.seam * 0.55 * Math.min(1, lag / 0.12));
        const f = flash, col = `rgb(${224 + 31 * f | 0},${176 + 70 * f | 0},${74 + 154 * f | 0})`;
        for (let i = 0; i < n; i++) {
          const th = ang + (i * HALF) / n, dx = Math.cos(th), dy = Math.sin(th), px = -dy, py = dx;
          line(th, (0.5 + 2.2 * k.seam * few) * (1 + 1.6 * f), col, few * Math.min(1, k.seam * (0.4 + 0.6 * f) + 0.15));
          // the stitches: short ticks across it, every 26 px, longer while it flashes
          const tl = (2 + 5 * k.seam) * (1 + 1.4 * f);
          g.globalAlpha = few * Math.min(1, k.seam * (0.35 + 0.65 * f)); g.lineWidth = 1 + k.seam; g.strokeStyle = col; g.beginPath();
          for (let d = 13; d < L; d += 26) for (const sg2 of [-1, 1]) {
            const qx = cx + dx * d * sg2, qy = cy + dy * d * sg2;
            g.moveTo(qx - px * tl, qy - py * tl); g.lineTo(qx + px * tl, qy + py * tl);
          }
          g.stroke();
          // each note of a chord: a bright stitch on both sides, low near the centre, high far out
          for (const st of stitches) {
            const u = st.age / st.life; if (u >= 1) continue;
            const d = st.d * L, len = st.len * (0.4 + 0.6 * k.seam) * (1 - 0.5 * u), al = few * Math.pow(1 - u, 1.5) * Math.min(1, 0.3 + k.seam);
            g.globalAlpha = al; g.strokeStyle = st.col; g.lineWidth = 1.2 + 2.2 * k.seam * (1 - u); g.beginPath();
            for (const sg2 of [-1, 1]) { const qx = cx + dx * d * sg2, qy = cy + dy * d * sg2; g.moveTo(qx - px * len, qy - py * len); g.lineTo(qx + px * len, qy + py * len); }
            g.stroke();
          }
        }
      }
      g.restore();
    } catch (e) { console.warn('fold', e); }
  }

  // knob pictures
  const IGOLD = '#e0b04a';
  const blot = (g, cx, cy, sgn, col) => {           // an uneven half-blot, opening away from the line at cx
    g.fillStyle = col; g.beginPath(); g.moveTo(cx, cy - 9);
    g.quadraticCurveTo(cx + sgn * 14, cy - 11, cx + sgn * 12, cy - 2); g.quadraticCurveTo(cx + sgn * 17, cy + 4, cx + sgn * 6, cy + 9);
    g.lineTo(cx, cy + 6); g.closePath(); g.fill();
  };

  TOOLS.push({
    id: 'fold', name: 'Fold', tag: 'new',
    blurb: 'A mirror for the whole picture, made to sit on other widgets: it folds whatever is already on the screen, so kusama becomes a twin colony, marbling a Rorschach marble, strings a woven butterfly, ikeda a mirrored data wall. The fold line turns with the bass round the circle of fifths, chords flip which half is mirrored, loud chords fold it twice for a beat, and quiet passages fade the mirror. Alone it is a stitched seam of light that flashes on every chord.',
    params: [
      { key: 'folds', label: 'how many folds', min: 1, max: 6, step: 1, value: 1,
        hint: 'How many mirror lines cross the centre. Left: one mirror. Right: up to six, a kaleidoscope.',
        icon: (g, v, w, h) => {
          const n = 1 + Math.round(v * 5), cx = w / 2, cy = h / 2;
          ICON.dot(g, cx, cy, 1, ICON.dim);
          for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i * TAU) / n; ICON.dot(g, cx + 8.5 * Math.cos(a), cy + 8.5 * Math.sin(a), 2.6, IGOLD); }
        } },
      { key: 'turn', label: 'what turns the fold', min: 0, max: 1, value: 1,
        hint: 'How far the mirror line turns with the harmony (the bass note, round the circle of fifths). Left: it stays upright. Right: it turns with every change of harmony.',
        icon: (g, v, w, h) => {
          const cx = w / 2, cy = h / 2;
          ICON.line(g, cx, 2, cx, h - 2, ICON.dim, 1);
          for (let i = 1; i <= 3; i++) {
            const a = Math.PI / 2 + v * i * 0.42, dx = Math.cos(a) * 11.5, dy = Math.sin(a) * 11.5;
            ICON.alpha(g, i === 3 ? 1 : 0.45, () => ICON.line(g, cx - dx, cy - dy, cx + dx, cy + dy, IGOLD, 1.6));
          }
        } },
      { key: 'strength', label: 'how strong the mirror image is', min: 0, max: 1, value: 1,
        hint: 'How strongly the mirrored half covers the other side (quiet passages fade it a little more). Left: a faint ghost. Right: as strong as the original.',
        icon: (g, v, w, h) => {
          const cx = w / 2, cy = h / 2;
          blot(g, cx - 1, cy, -1, ICON.red);
          ICON.alpha(g, 0.08 + 0.92 * v, () => blot(g, cx + 1, cy, 1, ICON.red));
          ICON.line(g, cx, 2, cx, h - 2, ICON.dim, 1);
        } },
      { key: 'flip', label: 'chords flip the side', min: 0, max: 1, value: 0.5,
        hint: 'How often a full chord swaps which half is the original and which the mirror. Left: never. Right: every chord swaps the source half.',
        icon: (g, v, w, h) => {
          const cx = w / 2;
          ICON.line(g, cx, 2, cx, h - 2, ICON.dim, 1);
          const n = Math.round(v * 3);
          if (!n) { ICON.arrow(g, 4, h / 2, cx - 3, h / 2, IGOLD, 1.6); return; }
          let x0 = 5, y0 = 5, dir = 1;
          for (let i = 0; i < n; i++) {
            const x1 = dir > 0 ? w - 5 : 5, y1 = 5 + ((i + 1) * (h - 10)) / n;
            if (i === n - 1) ICON.arrow(g, x0, y0, x1, y1, IGOLD, 1.5); else ICON.line(g, x0, y0, x1, y1, IGOLD, 1.5);
            x0 = x1; y0 = y1; dir = -dir;
          }
        } },
      { key: 'seam', label: 'seam', min: 0, max: 1, value: 0.6,
        hint: 'The line of light along the fold. Left: no line, only the mirror. Right: a bright stitched seam that flashes on every chord.',
        icon: (g, v, w, h) => {
          const cx = w / 2;
          if (v < 0.04) { ICON.alpha(g, 0.35, () => ICON.line(g, cx, 3, cx, h - 3, ICON.dim, 0.8)); return; }
          ICON.line(g, cx, 2, cx, h - 2, IGOLD, 0.6 + v * 3);
          if (v > 0.3) for (let y = 5; y < h - 2; y += 5) ICON.line(g, cx - 2 - 3 * v, y, cx + 2 + 3 * v, y, IGOLD, 1);
        } },
    ],
    reset() {
      ang = echo = HALF / 2; side = 0; flipAcc = 0; bump = 0; lv = 0; flash = 0; hist.fill(0); stitches = []; queued = false;
    },
    onChord(ch, x) {
      const pw = 0.1 + 0.9 * loud(ch.vel);
      // the bass guess: the chord's lowest note (if it is low enough), weighted by how long and loud it is
      if (ch.lo < 64) hist[ch.lo % 12] += (0.4 + Math.min(2, ch.notes.find((n) => n.m === ch.lo)?.d || 0.3)) * (0.5 + pw);
      lv = Math.max(lv, pw);
      flash = Math.max(flash, 0.35 + 0.65 * pw);
      // full chords flip the source half (the knob: how many of them)
      if (ch.notes.length >= 3) { flipAcc += x.p('flip'); if (flipAcc >= 0.999) { flipAcc -= 1; side ^= 1; } }
      // loud chords: one more fold for a beat
      if (pw > 0.72 && ch.notes.length >= 2) bump = Math.max(bump, clamp((pw - 0.6) / 0.3, 0, 1));
      for (const n of ch.notes) {
        const p = x.pitch01(n.m), hot = clamp((p - 0.35) / 0.5, 0, 1);
        stitches.push({ d: 0.04 + 0.92 * p, len: 6 + 16 * clamp(n.v / 110, 0, 1) * (0.5 + 0.5 * pw), age: 0, life: 0.5 + 0.7 * pw,
          col: `rgb(${232 + 23 * hot | 0},${150 + 96 * hot | 0},${60 + 168 * hot | 0})` });
      }
      if (stitches.length > 60) stitches.splice(0, stitches.length - 60);
    },
    frame(x) {
      // knobs are read here (they only resolve while the harness is running this widget), then used after the others drew
      const dt = x.dt, k = { folds: clamp(Math.round(x.p('folds')), 1, 6), strength: x.p('strength'), seam: x.p('seam') };
      const turn = x.p('turn');
      const dec = Math.pow(0.5, dt / 1.2); for (let i = 0; i < 12; i++) hist[i] *= dec;      // the bass guess forgets in ~2 s
      ang += wrapHalf(target(turn) - ang) * (1 - Math.pow(0.5, dt / 0.22));
      echo += wrapHalf(ang - echo) * (1 - Math.pow(0.5, dt / 0.9));
      ang = ((ang % HALF) + HALF) % HALF; echo = ((echo % HALF) + HALF) % HALF;
      lv *= Math.pow(0.5, dt / 3);
      flash *= Math.pow(0.5, dt / 0.09);
      bump = Math.max(0, bump - dt / 0.6);                                                  // relaxes over about a beat
      for (const s of stitches) s.age += dt;
      stitches = stitches.filter((s) => s.age < s.life);
      if (!queued) { queued = true; queueMicrotask(() => post(x, k)); }
    },
  });
})();
