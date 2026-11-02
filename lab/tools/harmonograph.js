// Harmonograph v2: one unbroken pendulum line, tuned to the sounding chord and pushed by every note.
// The chord's intervals (as just-intonation ratios over the bass, octaves folded away) tune the pendulums: the most
// consonant interval is the main pair (a fifth draws 2:3, a fourth 3:4, a third 4:5), the next ones beat against them so
// the figure breathes. A change of harmony re-tunes the swinging pendulums over a quarter second, so the line never
// breaks: it melts from one figure into the next. Damping winds the line inward; every attack pushes it back out (loud =
// further) and presses it down: the line swells thick and white-hot and leaves a bright knot where the note landed, so the
// drawn figure keeps the rhythm. Dense playing hurries the pen, silence lets it slow down and curl in. Low chords swing
// slow, broad and thick, high ones quick and fine; dissonance mistunes the swings into turning rosettes and turns the
// ink from gold through rose to violet.
(() => {
  const TAU = Math.PI * 2;
  // Just ratios for the 12 intervals above the bass: [numerator, denominator].
  const JUST = [[1, 1], [16, 15], [9, 8], [6, 5], [5, 4], [4, 3], [45, 32], [3, 2], [8, 5], [5, 3], [9, 5], [15, 8]];
  const SLOTS = 3; // pendulums per axis
  // The figure lives on its own canvas (it fades by the "lines stay" knob, not the lab's quick shared fade) and is laid on
  // the shared canvas with 'lighten', so other widgets still show wherever they are brighter.
  // At the shared canvas's real size (×S in a supersampled render, og then drawing in 1280×720 units through scale(S)).
  let off = document.createElement('canvas'); off.width = 1280; off.height = 720; let og = off.getContext('2d');
  function sizeOff(x) {
    const c = x.canvas;
    if (off.width === c.width && off.height === c.height) return;
    off = document.createElement('canvas'); off.width = c.width; off.height = c.height; og = off.getContext('2d');
    og.fillStyle = '#000'; og.fillRect(0, 0, off.width, off.height);
    const S = c.width / x.W; og.setTransform(S, 0, 0, S, 0, 0);
  }
  let pen = null, lastTop = null, lastAttack = -9, lastDim = -9, press = 0, rush = 0, knots = [];

  // A chord → pendulum targets: { fx: [[f, amp]...], fy: [[f, amp]...], dis (0..1), pcs (key), reg (0 low..1 high) }.
  function tune(notes) {
    const ms = [...new Set(notes.map((n) => n.m))].sort((a, b) => a - b).slice(0, 8);
    const bass = ms[0];
    // Intervals above the bass folded into one octave, octaves dropped; each with its ratio and Tenney height.
    const ivs = [];
    for (const m of ms.slice(1)) {
      const i = (m - bass) % 12; if (!i || ivs.some((v) => v.i === i)) continue;
      const [p, q] = JUST[i]; ivs.push({ i, r: p / q, h: Math.log2(p * q) });
    }
    ivs.sort((a, b) => a.h - b.h);                    // most consonant first
    const worst = ivs.length ? ivs[ivs.length - 1].h : 1;
    const fx = [[1, 1]], fy = [[ivs[0] ? ivs[0].r : 2, 1]];
    if (ivs[1]) fx.push([ivs[1].r, 0.4]);             // beats against the slow swing: the figure breathes in and out
    if (ivs[2]) fy.push([ivs[2].r, 0.3]);             // a seventh or a clash: the other axis breathes too
    if (ivs[3]) fx.push([ivs[3].r, 0.2]);
    const mean = ms.reduce((s, m) => s + m, 0) / ms.length;
    return { fx, fy, pcs: ivs.map((v) => v.i).join(',') + '@' + (bass % 12), n: ms.length,
      // Triads (worst a third, ~4.9) stay goldish, sevenths (~7.3) rose, tritones and clusters (~10) violet.
      dis: Math.pow(Math.max(0, Math.min(1, (worst - 2) / 8.5)), 1.3), reg: Math.max(0, Math.min(1, (mean - 36) / 48)) };
  }
  // Consonant = warm bone/gold, middling = rose, dissonant = cold violet.
  function colour(d) {
    const a = [255, 212, 148], b = [246, 104, 136], c = [134, 114, 255];
    const [p, q, k] = d < 0.5 ? [a, b, d * 2] : [b, c, (d - 0.5) * 2];
    return p.map((v, i) => v + (q[i] - v) * k);
  }
  const v01 = (v) => Math.max(0, Math.min(1, v / 110));
  const ease = (dt, half) => 1 - Math.pow(0.5, dt / half);

  function newPen(x, tn, vel) {
    const osc = (first) => Array.from({ length: SLOTS }, (_, i) => ({ f: 1, ft: 1, a: 0, at: 0, th: i ? x.rnd(0, TAU) : first }));
    pen = { X: osc(0), Y: osc(Math.PI / 2 - x.rnd(0.5, 1.0)), E: 0, Et: 0.45 + 0.6 * Math.pow(v01(vel), 1.3),
      col: colour(tn.dis), dis: tn.dis, reg: tn.reg, tilt: 0, tiltT: x.rnd(-0.3, 0.3), bend: 0, last: null, tail: [], pcs: '' };
    retune(x, tn, true);
  }
  function retune(x, tn, now) {
    const set = (S, list) => S.forEach((o, i) => { if (list[i]) { o.ft = list[i][0]; o.at = list[i][1]; } else o.at = 0; if (now) { o.f = o.ft; o.a = o.at; } });
    set(pen.X, tn.fx); set(pen.Y, tn.fy);
    pen.dis = tn.dis; pen.reg = tn.reg; pen.pcs = tn.pcs;
    if (!now) pen.tiltT = Math.max(-0.45, Math.min(0.45, pen.tiltT + x.rnd(-0.25, 0.25)));
  }

  // ---- icons: a tiny Lissajous figure. `cycles` turns of the slow pendulum, drawn up to `frac` of the way. ----
  // `kicks`: [[at 0..1, by]] push the swing back out at those points (the "push" knob's picture), with a knot there.
  function liss(g, w, h, { fx = 1, fy = 2, ph = Math.PI / 2 - 0.75, s = 1, damp = 0, cycles = 1, frac = 1, rot = 0, col = ICON.gold, lw = 1.2, alpha = 1, nib = false, kicks = null } = {}) {
    const cx = w / 2, cy = h / 2, R = (h / 2 - 2) * s, N = Math.round(90 * cycles * Math.max(fx, fy));
    let px = cx, py = cy, e = 1; const dots = [];
    g.save(); g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
    for (let i = 0; i <= N * frac; i++) {
      const t = (i / N) * cycles;
      e = i ? e * Math.exp(-damp * cycles / N) : 1;
      let kick = 0; if (kicks) for (const [at, by] of kicks) if (i === Math.round(at * N)) { e = Math.min(1, e + by); kick = by; }
      const X = Math.sin(TAU * fx * t) * R * 1.35 * e, Y = Math.sin(TAU * fy * t + ph) * R * e;
      px = cx + X * Math.cos(rot) - Y * Math.sin(rot); py = cy + X * Math.sin(rot) + Y * Math.cos(rot);
      i ? g.lineTo(px, py) : g.moveTo(px, py);
      if (kick > 0.05) dots.push([px, py, 0.8 + kick * 2.6]);
    }
    g.stroke(); g.restore();
    for (const [a, b, r] of dots) ICON.dot(g, a, b, r, col);
    if (nib) ICON.dot(g, px, py, 2.2, ICON.ink);
  }

  TOOLS.push({
    id: 'harmonograph', name: 'Harmonograph', tag: 'v2',
    blurb: 'Now one unbroken line that melts from figure to figure as the harmony changes, and every note pushes it: a loud note flings the pen back out and leaves a thick bright knot in the line, quiet passages let it slow down and curl in. Low chords swing broad and thick, high ones quick and fine; gold = consonant, violet = dissonant.',
    params: [
      { key: 'size', label: 'size', min: 0.4, max: 1.3, value: 0.95,
        hint: 'How wide the pen swings. Left: a small figure in the middle. Right: fills the screen.',
        icon: (g, v, w, h) => liss(g, w, h, { s: 0.3 + v * 0.7, fy: 2 }) },
      { key: 'speed', label: 'how fast the pen draws', min: 0.3, max: 5, value: 1.6, less: 0.4,
        hint: 'How quickly the pen traces the figure. Left: slow, you watch each loop being drawn. Right: the whole figure appears almost at once.',
        icon: (g, v, w, h) => liss(g, w, h, { fx: 2, fy: 3, ph: 0.6, frac: 0.15 + v * 0.85, nib: true }) },
      { key: 'damp', label: 'how fast it winds inward', min: 0.02, max: 0.6, value: 0.2,
        hint: 'How quickly the line spirals in toward the centre between notes. Left: it keeps swinging wide, loops stacked on loops. Right: it curls into the middle in a few turns.',
        icon: (g, v, w, h) => liss(g, w, h, { fx: 1, fy: 1, ph: Math.PI / 2, cycles: 4, damp: 0.07 + v * 0.75, lw: 1 }) },
      { key: 'push', label: 'how hard notes push the pen', min: 0, max: 1.5, value: 0.8,
        hint: 'What each note does to the pen. Left: nothing, the line just winds down. Right: every note flings the pen back out and leaves a thick bright knot in the line.',
        icon: (g, v, w, h) => liss(g, w, h, { fx: 1, fy: 1, ph: Math.PI / 2, cycles: 4, damp: 0.8, lw: 1, kicks: [[0.35, v * 0.7], [0.7, v * 0.7]] }) },
      { key: 'stay', label: 'how long the lines stay', min: 0.3, max: 8, value: 4.5, less: 0.3,
        hint: 'How long a drawn line glows before it fades. Left: only a comet tail behind the pen. Right: old figures linger and layer over each other.',
        icon: (g, v, w, h) => { if (v > 0.05) liss(g, w, h, { fx: 2, fy: 3, ph: 0.6, alpha: v * 0.9 }); liss(g, w, h, { fx: 2, fy: 3, ph: 0.6, frac: 0.18, col: ICON.ink, lw: 1.6, nib: true }); } },
      { key: 'howmuch', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much figure it draws: how fast the pen goes and how long the lines stay. Left: a short, slow trace that fades quickly. Right: the full tangle of lines. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset(x) {
      if (x && x.canvas) sizeOff(x);
      pen = null; lastTop = null; lastAttack = lastDim = -9; press = rush = 0; knots = [];
      og.globalCompositeOperation = 'source-over'; og.globalAlpha = 1; og.fillStyle = '#000'; og.fillRect(0, 0, off.width, off.height);   // (under scale(S) this covers more than the canvas: fine)
    },
    onChord(ch, x) {
      const distinct = new Set(ch.notes.map((n) => n.m)).size;
      const top = ch.notes.reduce((b, n) => (n.m > b.m ? n : b), ch.notes[0]);
      const k = Math.pow(v01(ch.vel), 1.3), push = x.p('push'), gap = x.t - lastAttack;
      lastAttack = x.t;
      // The harmony: the chord itself, or a lone note heard against what is still sounding.
      const tn = tune(distinct >= 2 ? ch.notes : [...ch.notes, ...x.sounding()]);
      if (!pen) { newPen(x, tn, ch.vel); lastTop = top.m; return; }
      if (tn.n >= 2 && tn.pcs !== pen.pcs) {
        retune(x, tn, false);
        // The old ink steps back a little so the new figure reads on top of it (not on every chord of a fast run).
        if (x.t - lastDim > 0.6) { og.globalCompositeOperation = 'source-over'; og.globalAlpha = 1; og.fillStyle = 'rgba(0,0,0,0.1)'; og.fillRect(0, 0, off.width, off.height); lastDim = x.t; }
      } else if (distinct < 2) pen.reg += (x.pitch01(top.m) * 1.2 - 0.1 - pen.reg) * 0.25; // a melody note leans the register
      // The push: back out (loud = further; after a silence the pen starts afresh at the note's own width) ...
      if (gap > 2 && pen.E < 0.2) pen.Et = Math.max(pen.Et, 0.45 + 0.6 * k);
      pen.Et = Math.min(1.1, pen.Et + push * k * 0.6 * (1.12 - pen.Et));
      // ... pressed down (thick, white-hot) with a knot where it lands, and hurried along.
      press = Math.max(press, Math.min(1.5, push * (0.2 + 1.1 * k)));
      if (push > 0.05 && k > 0.12) knots.push({ r: (1.4 + 6 * k) * Math.min(1.3, push), k });
      if (knots.length > 4) knots.shift();
      rush = Math.min(2.2, rush + 0.18 + 0.5 * k);
      // A melody step bends the figure: the vertical swing is nudged ahead or held back by the step the top note took,
      // spread along the next stretch of line (so a slow pen draws a bend, not a jump).
      if (lastTop != null) pen.bend += Math.max(-1, Math.min(1, (top.m - lastTop) / 7)) * 0.45;
      lastTop = top.m;
    },
    frame(x) {
      const W = x.W, H = x.H, dt = x.dt;
      sizeOff(x);
      // Fade the figure's own canvas by "how long the lines stay" (half-life in seconds); the colour-burn takes the last
      // few 8-bit levels to black so no grey ghosts stick. Not when paused (dt 0): the burn alone would eat the picture.
      // In a supersampled render the burn's per-pixel 8-bit floor (it takes 1 or 2 levels a frame off every lit pixel)
      // falls on finer pixels, so thin old lines fade a little differently at their edges: hd-check's `moved` reads
      // 0.17 at prelude 126 (0.07 with the burn off at both sizes; a bilinear resample of the 1× frame itself reads
      // 0.15), same figure, same places. Not a shared-canvas read: reproducing the 1× floor exactly would need pixel math.
      const stay = x.p('stay');
      if (dt > 0) {
        og.globalCompositeOperation = 'source-over'; og.globalAlpha = 1;
        og.fillStyle = `rgba(0,0,0,${ease(dt, stay).toFixed(4)})`; og.fillRect(0, 0, W, H);
        og.globalCompositeOperation = 'color-burn'; og.fillStyle = 'rgb(253,253,253)'; og.fillRect(0, 0, W, H);
      }

      // After a seek (or switching the widget on mid-chord) start from whatever is sounding.
      if (!pen) { const snd = x.sounding(); if (snd.length) newPen(x, tune(snd), Math.max(...snd.map((n) => n.v))); }
      let head = null;
      if (pen) {
        const P = pen, size = x.p('size'), damp = x.p('damp');
        // Everything glides: the pendulums re-tune over ~¼ s (their weights along the line, below), the colour and the
        // tilt slower.
        const kf = ease(dt, 0.22), kc = ease(dt, 0.35);
        for (const o of P.X.concat(P.Y)) o.f += (o.ft - o.f) * kf;
        const ct = colour(P.dis); P.col = P.col.map((v, i) => v + (ct[i] - v) * kc);
        P.tilt += (P.tiltT - P.tilt) * ease(dt, 2);
        const reg = Math.max(0, Math.min(1, P.reg));
        // Low = slow heavy pendulums, high = quick light ones; busy playing hurries the pen, silence lets it slow.
        const rate = (0.7 + 0.65 * reg) * (0.75 + 0.55 * Math.min(1.6, rush));
        const detune = 0.003 + 0.03 * P.dis;
        const maxF = Math.max(1, ...P.X.concat(P.Y).filter((o) => o.a > 0.02).map((o) => o.f * (1 + detune)));
        const step = 0.05 / (TAU * maxF), adv = x.p('speed') * rate * dt;
        const n = Math.floor(adv / step), rem = adv - n * step;
        const cx = W / 2, cy = H / 2, A = Math.min(W, H) * 0.42 * size, Ax = A * 1.5, Ay = A;
        const c = Math.cos(P.tilt), s = Math.sin(P.tilt);
        const where = () => {
          let sx = 0, sy = 0, ax = 0, ay = 0;
          for (const o of P.X) { sx += o.a * Math.sin(o.th); ax += o.a; }
          for (const o of P.Y) { sy += o.a * Math.sin(o.th); ay += o.a; }
          return [sx / ax, sy / ay];
        };
        const pts = [];
        if (P.last) pts.push(P.last);
        const adv1 = (d) => {
          const ka = Math.min(1, d / 0.25);
          for (const o of P.X) { o.th += TAU * o.f * d; o.a += (o.at - o.a) * ka; }
          for (const o of P.Y) { o.th += TAU * o.f * (1 + detune) * d; o.a += (o.at - o.a) * ka; }
          const take = P.bend * Math.min(1, d / 0.3); P.bend -= take; P.Y[0].th += take; // the melody's bend, over ~⅓ of a swing
          // The swing's size: the target winds down by the damping, the actual one follows it along the line (a push swells
          // the figure out over the next stretch of line, never a jump, however slow the pen).
          P.Et *= Math.exp(-damp * d); P.E += (P.Et - P.E) * Math.min(1, d / 0.12);
        };
        for (let j = 1; j <= n + (rem > 0 ? 1 : 0); j++) {
          adv1(j <= n ? step : rem);
          const p = where(), X = p[0] * Ax * P.E, Y = p[1] * Ay * P.E;
          pts.push([cx + X * c - Y * s, cy + X * s + Y * c]);
        }
        if (pts.length > 1 && P.E > 0.015) {
          const [r, gg, b] = P.col.map(Math.round), vis = Math.pow(Math.min(1, P.E), 0.3), pr = Math.min(1.2, press);
          const bright = vis * (0.65 + 0.6 * pr);
          // Pen pressure: a note presses the line thick; low chords draw a broader stroke, high ones a finer one.
          const wk = (1.3 - 0.55 * reg) * (0.75 + 2.2 * pr);
          // Butt caps: round ones would double up where one frame's stroke meets the next and leave beads along the line.
          og.globalCompositeOperation = 'lighter'; og.lineCap = 'butt'; og.lineJoin = 'round';
          const path = () => { og.beginPath(); og.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) og.lineTo(pts[i][0], pts[i][1]); og.stroke(); };
          og.strokeStyle = `rgba(${r},${gg},${b},${Math.min(1, 0.08 * bright).toFixed(3)})`; og.lineWidth = 7 * wk; path();
          og.strokeStyle = `rgba(${r},${gg},${b},${Math.min(1, 0.3 * bright).toFixed(3)})`; og.lineWidth = 2.4 * wk; path();
          // The core runs white-hot while pressed.
          const lift = 30 + 95 * Math.min(1, pr);
          og.strokeStyle = `rgba(${Math.min(255, r + lift)},${Math.min(255, gg + lift)},${Math.min(255, b + lift)},${Math.min(1, 0.85 * bright).toFixed(3)})`;
          og.lineWidth = Math.min(3.4, 1.05 * wk); path();
          // Knots: each struck note leaves a small glowing bead on the line where the pen was.
          if (knots.length) {
            const [kx, ky] = pts[1];
            for (const q of knots) {
              const R = q.r * (1.25 - 0.45 * reg) * (0.6 + 0.4 * size);
              const gr = og.createRadialGradient(kx, ky, 0, kx, ky, R * 3.5);
              gr.addColorStop(0, `rgba(255,250,238,${(0.7 + 0.3 * q.k).toFixed(3)})`);
              gr.addColorStop(0.28, `rgba(255,246,228,${(0.6 + 0.3 * q.k).toFixed(3)})`);
              gr.addColorStop(0.36, `rgba(${r},${gg},${b},${(0.3 + 0.3 * q.k).toFixed(3)})`);
              gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
              og.fillStyle = gr; og.beginPath(); og.arc(kx, ky, R * 3.5, 0, TAU); og.fill();
            }
            knots = [];
          }
          for (let i = 1; i < pts.length; i++) P.tail.push(pts[i]);
          if (P.tail.length > 48) P.tail.splice(0, P.tail.length - 48);
        }
        P.last = pts[pts.length - 1] || P.last;
        if (P.E > 0.015 && P.tail.length > 1) head = { tail: P.tail, col: P.col.map(Math.round), E: Math.min(1, P.E) };
      }
      press *= Math.pow(0.5, dt / 0.16);
      rush *= Math.pow(0.5, dt / 0.6);

      const g = x.g;
      g.globalCompositeOperation = 'lighten'; g.drawImage(off, 0, 0, x.W, x.H);
      if (head) { // the pen: the last stretch of line, white-hot
        const [r, gg, b] = head.col, T = head.tail, pr = Math.min(1, press);
        g.globalCompositeOperation = 'lighter'; g.shadowColor = `rgb(${r},${gg},${b})`; g.shadowBlur = 10 + 14 * pr;
        g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.5 + 2 * pr;
        g.strokeStyle = `rgba(255,248,236,${Math.min(1, 0.25 + 0.45 * head.E + 0.3 * pr).toFixed(3)})`;
        g.beginPath(); g.moveTo(T[0][0], T[0][1]); for (let i = 1; i < T.length; i++) g.lineTo(T[i][0], T[i][1]); g.stroke();
        g.shadowBlur = 0;
      }
    },
  });
})();
