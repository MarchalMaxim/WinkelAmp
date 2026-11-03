// Time slice (new): a slit-scan of whatever the other widgets drew. It keeps half-size copies of the finished picture
// in a ring of 48 (one every far/44 s of song time, so the ring always holds a little more than "how far back"). Then it
// rebuilds the picture strip by strip: each column (or row, or ring) is taken from a different moment in the past, and
// the delay grows with the distance from a "now line" that sits where the top note is (low left, high right) and glides
// with the melody. Whatever moves under it becomes a time-sheared ribbon: riley's waves break into staircases of cut
// stripes, strings and murmuration shear into ragged ribbons, ikeda's barcodes step. Each attack snaps a band around its
// note back to delay 0: a sharp cut of the live picture through the smear, which then slides back into the past. Loud
// chords stretch the delay range, and silence lets everything catch up and straighten. No zoom and no feedback: only
// time delay (see the clean history below). Since it re-times the finished picture, it works on widgets that repaint
// their ground too (riley, score, kusama, boogie). Shapes that sit still show little: only their arrivals and fades are cut.
// Its own marks: a hairline of bone light along the now line, short red ticks at the screen's edges where attacks cut,
// and a faint thread across the screen for each sounding note (red at its attack), drawn into the picture like any
// widget's, so the slit-scan writes it out from the now line as a piano roll running both ways out of the present.
// It draws AFTER all the other widgets each frame (a microtask queued from frame(), like pixelsort), with drawImage only.
(() => {
  const W = 1280, H = 720, Q = 2, QW = W / Q, QH = H / Q;
  const N = 48;                                                     // ring size; copies are taken every far/44 s of song time
  const CX = W / 2, CY = H / 2, RMAX = Math.hypot(CX, CY);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Loudness relative to this recording (its 93rd-percentile note velocity), as pixelsort, so both songs reach the top.
  let VQ = 0;
  const loud = (v) => {
    if (!VQ) { const v2 = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b); VQ = v2.length ? Math.max(70, v2[Math.floor(v2.length * 0.93)]) : 100; }
    return clamp((v * 100 / VQ - 45) / 58, 0, 1);
  };

  // the history: copies in song-time order (oldest first), each { c, cg, t }; spare canvases are reused
  // The copies stay QW × QH at any picture size. In a supersampled render (the shared canvas RS times 1280×720) the
  // picture is first box-reduced to 1280×720 in `mid`, then halved as at 1×: the delayed strips are then exactly as soft
  // as at 1× and lie where they do at 1× (copies at RS × the size re-time thin lines sharper, a different picture), and
  // the ring stays ~44 MB at any scale. The clean picture follows the real size; a change of size drops the history.
  let hist = [], lastK = null, RS = 1, mid = null, mg = null;
  const spare = [];
  const slot = () => spare.pop() || (() => { const c = document.createElement('canvas'); c.width = QW; c.height = QH; const cg = c.getContext('2d'); return { c, cg, t: 0 }; })();
  function sizeTo(x) {
    const rs = x.canvas.width / x.W;
    if (rs === RS) return;
    RS = rs; for (const s of hist) spare.push(s); hist = []; lastK = null; clean = null; mid = null;
    if (RS !== 1) {
      mid = document.createElement('canvas'); mid.width = W; mid.height = H; mg = mid.getContext('2d');
      mg.globalCompositeOperation = 'copy'; mg.imageSmoothingEnabled = true; mg.imageSmoothingQuality = 'high';   // a 3:1 reduction needs it
      // At 3× this is close to hd-check's gate: moved 0.095 against 0.1 at b5 60 (0.153 with 'low'). A change to this
      // reduction path is re-checked with `npm run hd-check -- --only timeslice --scale 3`, not only at 2×.
    }
  }
  let IV = 0.03;
  function capture(x) {
    const k = Math.floor(x.t / IV + 1e-9);
    if (k === lastK) return;
    lastK = k;
    const s = hist.length >= N ? hist.shift() : slot();
    s.cg.globalCompositeOperation = 'copy'; s.cg.imageSmoothingEnabled = true;
    if (mid) { mg.drawImage(x.canvas, 0, 0, W * RS, H * RS, 0, 0, W, H); s.cg.drawImage(mid, 0, 0, W, H, 0, 0, QW, QH); }
    else s.cg.drawImage(x.canvas, 0, 0, W, H, 0, 0, QW, QH);
    s.t = x.t; hist.push(s);
  }
  // the copy nearest song time tw (the oldest one if the history does not reach that far back)
  function at(tw) {
    let a = 0, b = hist.length - 1;
    if (tw <= hist[0].t) return hist[0];
    while (a < b) { const m = (a + b + 1) >> 1; if (hist[m].t <= tw) a = m; else b = m - 1; }
    return a + 1 < hist.length && hist[a + 1].t - tw < tw - hist[a].t ? hist[a + 1] : hist[a];
  }

  // A clean history. What it draws stays on the shared canvas (faded 12 % a frame), so the next copy would hold its own
  // slit-scan and a delayed strip would show echoes of itself, ever weaker repeats of the same moment. So it keeps the
  // picture as the others left it (before it drew) and puts that back just before the next shared fade: the others
  // then always draw on their own picture, and it only ever re-times what they drew. The hook watches for the harness's
  // fade (a full-screen rgba(0,0,0,0.12) fill) and acts once after each of its own frames, so it is inert when it is off.
  // The put-back belongs to the canvas it was kept from (`owner`): the hook stays on every context it was given (the
  // stage's and a window's are the same size), so after a move from the stage to a window (or back) the other
  // canvas's fade passes through untouched, and the window's picture never goes over the whole stage.
  let clean = null, cg = null, armed = false, owner = null;
  const ME = Symbol('timeslice');
  function hook(g) {
    if (g[ME]) return;
    const fill = g.fillRect;
    g[ME] = true;
    g.fillRect = function (a, b, c, d) {
      if (armed && this.canvas === owner && a === 0 && b === 0 && c === this.canvas.width && d === this.canvas.height && this.fillStyle === 'rgba(0, 0, 0, 0.12)') {   // the fade, at the real size and transform
        armed = false;
        const op = this.globalCompositeOperation, al = this.globalAlpha;
        this.globalCompositeOperation = 'copy'; this.globalAlpha = 1; this.drawImage(clean, 0, 0);
        this.globalCompositeOperation = op; this.globalAlpha = al;
      }
      return fill.call(this, a, b, c, d);
    };
  }
  function keep(x) {
    if (!clean) { clean = document.createElement('canvas'); clean.width = x.canvas.width; clean.height = x.canvas.height; cg = clean.getContext('2d'); }
    cg.globalCompositeOperation = 'copy'; cg.drawImage(x.canvas, 0, 0); owner = x.canvas; armed = true;
  }

  let nowP = 0.5, cuts = [], stretch = 0, calm = 1, quiet = 0, range = 0, queued = false, pending = [];
  // where a pitch sits along the slicing axis, in pixels: columns low left → high right, rows low bottom → high top,
  // rings low small → high large
  const posOf = (p, mode) => (mode === 0 ? (0.06 + 0.88 * p) * W : mode === 1 ? (0.94 - 0.88 * p) * H : (0.03 + 0.8 * p) * RMAX);

  // Its own trace, drawn into the picture like any widget's (so it gets re-timed too): every sounding note is a faint
  // thread across the screen at its pitch, red at its attack. Re-timed, the threads flow outward from the now line,
  // a piano roll written both ways out of the present. (columns: rows of thread; rows: columns; rings: spokes)
  // Drawn in post, just before the picture is kept and copied, so it lies over every other widget's ground (score's
  // paper, riley's stripes) wherever timeslice sits in the load order.
  function threads(x, k) {
    const g = x.g, snd = x.sounding();
    if (snd.length) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none'; g.shadowBlur = 0;
      for (const n of snd.slice(-10)) {
        const p = x.pitch01(n.m), age = x.t - n.start, hit = age < 0.12, a = (hit ? 0.45 : 0.06) * Math.min(1, n.v / 90);
        g.fillStyle = hit ? `rgba(200,36,30,${a.toFixed(3)})` : `rgba(236,226,200,${a.toFixed(3)})`;
        const th = hit ? 2.5 : 1.5;
        if (k.mode === 0) g.fillRect(0, (0.92 - 0.84 * p) * H - th / 2, W, th);
        else if (k.mode === 1) g.fillRect((0.08 + 0.84 * p) * W - th / 2, 0, th, H);
        else { const an = -Math.PI / 2 + p * Math.PI * 2; g.strokeStyle = g.fillStyle; g.lineWidth = th; g.beginPath(); g.moveTo(CX, CY); g.lineTo(CX + Math.cos(an) * RMAX, CY + Math.sin(an) * RMAX); g.stroke(); }
      }
      g.restore();
    }
  }

  function post(x, dt, k) {
    queued = false;
    try {
      const g = x.g, t = x.t, mode = k.mode;
      threads(x, k);                                                  // its own trace, then the picture as it stands
      sizeTo(x); hook(g); keep(x);
      IV = Math.min(0.07, Math.max(1 / 60, k.far * 1.08 / (N - 4)));
      capture(x);                                                     // the finished picture, before we change it
      // attacks: each note cuts a band of the present through the smear
      for (const ch of pending) {
        const pw = loud(ch.vel);
        stretch = Math.max(stretch, Math.pow(pw, 1.3));
        for (const n of ch.notes) {
          const half = (2 + 150 * k.cut * k.cut) * (0.75 + 0.5 * pw);
          cuts.push({ p: x.pitch01(n.m), half, t0: t, hold: 0.06 + 0.1 * pw, relax: 0.35 + 0.45 * clamp(n.d / 1.5, 0, 1) + 0.25 * pw });
        }
      }
      pending = [];
      if (cuts.length > 32) cuts.splice(0, cuts.length - 32);
      cuts = cuts.filter((c) => t - c.t0 < c.hold + c.relax * 4);
      // the music: loud chords stretch time (fading over ~1.5 s), silence lets it catch up
      stretch *= Math.exp(-dt / 1.5);
      quiet = x.sounding().length ? 0 : quiet + dt;
      calm += ((quiet > 0.3 ? 0 : 1) - calm) * (1 - Math.exp(-dt / (quiet > 0.3 ? 0.5 : 0.2)));
      const target = k.far * calm * (1 - 0.65 * k.stretch * (1 - stretch));
      range += (target - range) * (1 - Math.exp(-dt / 0.12));
      const top = x.top(); if (top) nowP += (x.pitch01(top.m) - nowP) * (1 - Math.exp(-dt / 0.3));
      const now = posOf(nowP, mode), span = (mode === 0 ? W : mode === 1 ? H : RMAX) * 0.8;
      const fresh = (c) => { const a = t - c.t0; return a < c.hold ? 1 : Math.exp(-(a - c.hold) / c.relax); };
      const delay = (s) => {
        let d = range * Math.pow(Math.min(1, Math.abs(s - now) / span), 0.85), cut = 0;
        for (const c of cuts) { const e = Math.abs(s - posOf(c.p, mode)) - c.half; if (e < 4) cut = Math.max(cut, fresh(c) * clamp(1 - e / 4, 0, 1)); }
        return d * (1 - cut);
      };

      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.shadowBlur = 0;
      g.imageSmoothingEnabled = true;
      g.globalAlpha = 1 - 0.5 * k.live;   // how much of the live picture shows through
      if (hist.length) {
        // strips 8 px wide (rings 12 px); neighbours from the same copy are drawn in one go; delay ~0 keeps the live,
        // full-size picture
        const SW = mode === 2 ? 12 : 8, n = Math.ceil((mode === 0 ? W : mode === 1 ? H : RMAX) / SW);
        let run = null, r0 = 0;
        const flush = (i1) => {
          if (!run) return;
          const a = r0 * SW, b = i1 * SW;
          if (mode === 0) g.drawImage(run.c, a / Q, 0, (b - a) / Q, QH, a, 0, b - a, H);
          else if (mode === 1) g.drawImage(run.c, 0, a / Q, QW, (b - a) / Q, 0, a, W, b - a);
          else {
            const x0 = Math.max(0, CX - b), y0 = Math.max(0, CY - b), x1 = Math.min(W, CX + b), y1 = Math.min(H, CY + b);
            g.save(); g.beginPath(); g.arc(CX, CY, b, 0, Math.PI * 2); if (a > 0) g.arc(CX, CY, a, 0, Math.PI * 2, true); g.clip();
            g.drawImage(run.c, x0 / Q, y0 / Q, (x1 - x0) / Q, (y1 - y0) / Q, x0, y0, x1 - x0, y1 - y0); g.restore();
          }
          run = null;
        };
        for (let i = 0; i < n; i++) {
          const d = delay((i + 0.5) * SW), src = d < IV * 0.6 ? null : at(t - d);
          if (src !== run) { flush(i); run = src; r0 = i; }
        }
        flush(n);
      }
      // its own marks: the now line in bone, faint red ticks bracketing each fresh cut
      g.globalAlpha = 1; g.lineWidth = 1.5;
      const mark = (s, w) => {
        g.beginPath();
        if (mode === 0) { g.moveTo(s, 0); g.lineTo(s, H); } else if (mode === 1) { g.moveTo(0, s); g.lineTo(W, s); } else g.arc(CX, CY, Math.max(1, s), 0, Math.PI * 2);
        g.lineWidth = w; g.stroke();
      };
      const tick = (s, L) => {                                       // a short tick at both ends of the line
        g.beginPath();
        if (mode === 0) { g.moveTo(s, 0); g.lineTo(s, L); g.moveTo(s, H - L); g.lineTo(s, H); }
        else if (mode === 1) { g.moveTo(0, s); g.lineTo(L, s); g.moveTo(W - L, s); g.lineTo(W, s); }
        else { g.moveTo(CX, CY - s - L / 2); g.lineTo(CX, CY - s + L / 2); g.moveTo(CX, CY + s - L / 2); g.lineTo(CX, CY + s + L / 2); }
        g.stroke();
      };
      g.lineWidth = 2;
      for (const c of cuts) {
        const f = fresh(c); if (f < 0.05) continue;
        g.strokeStyle = `rgba(200,36,30,${(0.6 * f).toFixed(3)})`; tick(posOf(c.p, mode), 10 + 18 * f);
      }
      g.strokeStyle = `rgba(236,226,200,${(0.35 + 0.35 * calm).toFixed(3)})`; mark(now, 1.5);
      g.restore();
    } catch (e) { console.warn('timeslice', e); }
  }

  // knob pictures
  const IBONE = '#ece2c8', IAMB = '#e29628', IRED = '#be1816';
  const lean = (g, x, y, s, k, col) => {          // a square whose top slides right by k: a shape sheared in time
    g.fillStyle = col; g.beginPath(); g.moveTo(x, y + s); g.lineTo(x + s, y + s); g.lineTo(x + s + k, y); g.lineTo(x + k, y); g.closePath(); g.fill();
  };

  TOOLS.push({
    id: 'timeslice', name: 'Time slice', tag: 'new',
    blurb: 'A slit-scan of the widgets under it: every strip of the picture comes from a different moment of the last seconds, more delayed the further it is from a now line that follows the melody. Made to sit on widgets that move: riley breaks into staircases of cut stripes (try the rings), strings and murmuration shear into ragged ribbons, ikeda’s barcodes step; it works on widgets that repaint their ground too. Each note cuts a sharp band of the present through the smear, loud chords stretch time, silence straightens it. Alone: a piano roll written outward from the now line. <b>how present</b> sets how much it smears: turned down, a short lean with hairline cuts.',
    params: [
      { key: 'far', label: 'how far back', min: 0.25, max: 3, value: 1.5,
        hint: 'How far into the past the furthest strips reach. Left: a quarter second, barely a lean. Right: three seconds, long ribbons.',
        icon: (g, v, w, h) => { ICON.alpha(g, 0.35, () => lean(g, 6, 5, 15, 0, ICON.dim)); lean(g, 6, 5, 15, 2 + v * 16, IAMB); } },
      { key: 'mode', label: 'which way it slices', min: 0, max: 2, step: 1, value: 0,
        hint: 'How the picture is cut into moments. Left: columns (the now line follows the melody left to right), then rows (bottom to top). Right: rings from the centre (low notes near the middle).',
        icon: (g, v, w, h) => {
          const m = Math.round(v * 2);
          if (m === 0) ICON.lines(g, 7, w, h, { dir: 'v', col: IBONE, lw: 1.2 });
          else if (m === 1) ICON.lines(g, 5, w, h, { dir: 'h', col: IBONE, lw: 1.2 });
          else for (let i = 1; i <= 4; i++) ICON.ring(g, w / 2, h / 2, i * 2.9, IBONE, 1.1);
        } },
      { key: 'cut', label: 'how wide a note’s fresh cut is', min: 0, max: 1, value: 0.35,
        hint: 'How wide the band of the present is that each note cuts through the smear. Left: a hairline. Right: a wide band of the present.',
        icon: (g, v, w, h) => {
          ICON.lines(g, 9, w, h, { dir: 'v', col: ICON.dim, lw: 1 });
          const bw = 1.5 + v * 18; ICON.rect(g, w / 2 - bw / 2, 3, bw, h - 6, IBONE);
        } },
      { key: 'live', label: 'how much of the live picture shows through', min: 0, max: 1, value: 0.2,
        hint: 'How much of the present picture shows through the slit-scan. Left: only the slit-scan. Right: half live, half past.',
        icon: (g, v, w, h) => { lean(g, 7, 5, 15, 12, IAMB); ICON.alpha(g, v * 0.85, () => ICON.rect(g, 13, 5, 15, 15, IBONE)); } },
      { key: 'stretch', label: 'how hard loud chords stretch time', min: 0, max: 1, value: 0.6,
        hint: 'How much loud chords stretch the delay. Left: they don’t, the delay stays put. Right: soft playing keeps it short and a loud chord throws it to the maximum.',
        icon: (g, v, w, h) => {
          const L = 8 + v * 24;
          for (let i = 0; i < 8; i++) ICON.alpha(g, 1 - i / 9, () => ICON.rect(g, 4 + (L * i) / 8, 9 + i * 0.6, L / 8 + 0.6, 8, i ? IRED : IAMB));
        } },
    ],
    reset() { armed = false; owner = null; for (const s of hist) spare.push(s); hist = []; lastK = null; cuts = []; pending = []; stretch = 0; calm = 1; quiet = 0; range = 0; queued = false; },
    onChord(ch) { pending.push(ch); if (pending.length > 8) pending.shift(); },
    frame(x) {
      // knobs are read here (they only resolve while the harness is running this widget), then used after the others drew
      const k = { far: x.p('far'), mode: Math.round(x.p('mode')), cut: x.p('cut'), live: x.p('live'), stretch: x.p('stretch') }, dt = x.dt;
      if (!queued) { queued = true; queueMicrotask(() => post(x, dt, k)); }
    },
  });
})();
