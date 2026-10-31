// Lightning: the biggest chords strike a bolt from their top note (x by pitch, top) to their bottom note (x by pitch, bottom),
// one fork per inner note reaching toward that note's x. Mid-strength chords light up distant clouds. Quiet music: nothing.
(() => {
  const LO = 25, HI = 102; // pitch range of the recording
  const px = (m, W) => 70 + ((m - LO) / (HI - LO)) * (W - 140);
  /** How hard a chord hits: loudness x note count x spread, 0..~0.9. */
  const score = (ch) => Math.max(0, (ch.vel - 70) / 45) * Math.min(1, 0.35 + ch.notes.length / 8) * Math.min(1, 0.4 + (ch.hi - ch.lo) / 40);

  // --- baked cloud textures (once): fbm value noise, tinted violet ---
  function noiseTex(w, h, seed, shape, hot = 1) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), img = c.createImageData(w, h);
    const hash = (x, y, o) => { const s = Math.sin(x * 127.1 + y * 311.7 + o * 74.7 + seed * 19.3) * 43758.5453; return s - Math.floor(s); };
    const vn = (x, y, o) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = hash(xi, yi, o), b = hash(xi + 1, yi, o), cc = hash(xi, yi + 1, o), d = hash(xi + 1, yi + 1, o);
      return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let n = 0, amp = 0.5, f = 1 / 26;
      for (let o = 0; o < 5; o++) { n += amp * vn(x * f, y * f * 1.6, o); amp *= 0.5; f *= 2; }
      const k = Math.max(0, Math.min(1, (n - 0.32) * 2.1)) * shape(x / w, y / h);
      const i = (y * w + x) * 4;
      img.data[i] = 120 * k + 50 * hot * k * k; img.data[i + 1] = 100 * k + 70 * hot * k * k; img.data[i + 2] = 235 * k; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0); return cv;
  }
  const blobs = [0, 1, 2].map((s) => noiseTex(200, 80, s + 1, (u, v) => { const dx = (u - 0.5) * 2, dy = (v - 0.5) * 2; return Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)) ** 1.2; }, 0.6));
  const ceiling = noiseTex(320, 110, 7, (u, v) => Math.pow(1 - v, 1.3), 0.4);

  let bolts = [], sheets = [], avg = 70, lastT = -1;

  // Midpoint displacement between two points; returns [x0,y0,x1,y1,...].
  function jag(x0, y0, x1, y1, levels, rough) {
    let pts = [x0, y0, x1, y1];
    let disp = Math.hypot(x1 - x0, y1 - y0) * rough;
    for (let l = 0; l < levels; l++) {
      const next = [];
      for (let i = 0; i < pts.length - 2; i += 2) {
        const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3];
        const len = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / len, ny = (bx - ax) / len, o = (Math.random() * 2 - 1) * disp;
        next.push(ax, ay, (ax + bx) / 2 + nx * o, (ay + by) / 2 + ny * o);
      }
      next.push(pts[pts.length - 2], pts[pts.length - 1]); pts = next; disp *= 0.52;
    }
    return pts;
  }
  const toPath = (pts) => { const p = new Path2D(); p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); return p; };

  function strike(ch, s, x) {
    const W = x.W, H = x.H;
    const xt = px(ch.hi, W) + x.rnd(-20, 20), xb = px(ch.lo, W) + x.rnd(-20, 20);
    const main = jag(xt, -10, xb, H + 10, 7, 0.16);
    const forks = [], twigs = [];
    const inner = ch.notes.filter((n) => n.m !== ch.hi && n.m !== ch.lo);
    const want = Math.max(2, Math.min(7, inner.length + 1));
    for (let k = 0; k < want; k++) {
      const n = inner[k] || ch.notes[Math.floor(Math.random() * ch.notes.length)];
      const i = 2 * Math.floor(x.rnd(0.12, 0.62) * (main.length / 2)); // a point on the trunk
      const sx = main[i], sy = main[i + 1];
      const tx = px(n.m, W) + x.rnd(-60, 60), ty = Math.min(H * 0.97, sy + x.rnd(130, 340));
      const f = jag(sx, sy, tx, ty, 5, 0.2); forks.push(f);
      if (Math.random() < 0.6) { const j = 2 * Math.floor(x.rnd(0.2, 0.7) * (f.length / 2)); twigs.push(jag(f[j], f[j + 1], f[j] + x.rnd(-110, 110), f[j + 1] + x.rnd(50, 140), 4, 0.25)); }
    }
    // Flicker script: strike, dip, restrike (sometimes twice), then a stuttering decay. Times in song seconds.
    const re = [0.07 + Math.random() * 0.04]; if (s > 0.72 && Math.random() < 0.6) re.push(re[0] + 0.07 + Math.random() * 0.05);
    bolts.push({ flashed: 0, main: toPath(main), forks: forks.map(toPath), twigs: twigs.map(toPath), s, age: 0, re, seed: Math.random() * 1000, xt, xb });
  }

  /** Distant lightning inside clouds near the horizon; s sets brightness and size (accents use a small s). */
  function sheet(ch, s, x) {
    const n = 1 + (s > 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const cx = px(ch.hi, x.W) + x.rnd(-220, 220), cy = x.H * x.rnd(0.55, 0.68) - s * 80;
      sheets.push({ cx, cy, w: x.rnd(480, 820) * (0.6 + s), tex: blobs[Math.floor(Math.random() * 3)], s, age: -k * 0.07, pulses: 2 + Math.floor(Math.random() * 2), seed: Math.random() * 1000,
        twig: s > 0.38 ? toPath(jag(cx + x.rnd(-60, 60), cy - 30, cx + x.rnd(-90, 90), cy + x.rnd(50, 100), 4, 0.3)) : null });
    }
  }

  const flick = (seed, age) => { const q = Math.floor(age * 45); const h = Math.sin(seed + q * 12.9898) * 43758.5453; return 0.45 + 0.55 * (h - Math.floor(h)); };
  /** Brightness of a bolt at its age: 1 at strike, dip, restrikes, stuttering fade to 0 at 0.4 s. */
  function env(b) {
    const a = b.age; if (a > 0.4) return 0;
    let v = a < 0.045 ? 1 : 0.22;
    for (const r of b.re) if (a >= r && a < r + 0.04) v = 0.92;
    const last = b.re[b.re.length - 1] + 0.04;
    if (a >= last) v = 0.75 * Math.pow(1 - (a - last) / (0.4 - last), 1.6) * flick(b.seed, a);
    return v;
  }

  TOOLS.push({
    id: 'lightning', name: 'Chord lightning',
    blurb: 'The biggest chords (loud, many notes, wide apart) strike a bolt from their top note down to their bottom note, with a fork toward each note in between, and the sky flashes. Medium chords light up distant clouds; quiet music stays dark.',
    reset(x) { bolts = []; sheets = []; avg = 70; lastT = x.t; },
    onChord(ch, x) {
      const s = score(ch);
      // Running average loudness, so a note that sticks out of a quiet run still counts as an accent.
      const dt = lastT < 0 ? 0 : Math.max(0, ch.t - lastT); lastT = ch.t; avg += (ch.vel - avg) * (1 - Math.pow(0.5, dt / 1.5));
      if (s >= 0.5) strike(ch, s, x);
      else if (s >= 0.16) sheet(ch, s, x);
      else if (ch.vel >= 72 && ch.vel >= avg + 5) sheet(ch, 0.14 + Math.min(0.06, (ch.vel - avg) / 200), x);
    },
    frame(x) {
      const g = x.g, W = x.W, H = x.H;
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';

      // Distant sheet lightning: lit cloud blobs low on the horizon, pulsing 2-3 times.
      for (const sh of sheets) {
        sh.age += x.dt; if (sh.age < 0) continue;
        const per = 0.11, ph = sh.age / per; if (ph >= sh.pulses) continue;
        const within = ph - Math.floor(ph), a = (within < 0.35 ? 1 : Math.max(0, 1 - (within - 0.35) / 0.65)) * Math.pow(0.7, Math.floor(ph)) * flick(sh.seed, sh.age);
        const k = Math.min(0.75, 0.22 + sh.s * 0.95) * a;
        // The sky around it glows a little, then the lit cloud.
        g.save(); g.translate(sh.cx, sh.cy); g.scale(2.6, 1);
        const gl = g.createRadialGradient(0, 0, 0, 0, 0, sh.w * 0.24); gl.addColorStop(0, 'rgba(120,100,230,0.35)'); gl.addColorStop(0.55, 'rgba(80,60,180,0.08)'); gl.addColorStop(1, 'rgba(60,40,140,0)');
        g.globalAlpha = k; g.fillStyle = gl; g.fillRect(-sh.w * 0.3, -sh.w * 0.3, sh.w * 0.6, sh.w * 0.6); g.restore();
        g.globalAlpha = 0.9 * k; g.drawImage(sh.tex, sh.cx - sh.w / 2, sh.cy - sh.w * 0.14, sh.w, sh.w * 0.28);
        if (sh.twig && Math.floor(ph) === 0) { g.globalAlpha = 0.55 * k; g.strokeStyle = 'rgb(220,215,255)'; g.lineWidth = 1.2; g.stroke(sh.twig); }
      }
      sheets = sheets.filter((sh) => sh.age < 0.4);

      // Bolts.
      for (const b of bolts) {
        b.age += x.dt;
        const e = env(b); if (e <= 0) continue;
        const k = e * (0.6 + 0.5 * b.s);
        // Sky flash on strike/restrike: the cloud ceiling lights up, plus a wash.
        // Sky flash: painted once on the strike and once per restrike; the shared fade lets it die away.
        const phase = b.age < 0.045 ? 1 : b.re.findIndex((r) => b.age >= r && b.age < r + 0.04) + 2;
        if (phase > 0 && phase > b.flashed) {
          b.flashed = phase;
          g.globalAlpha = Math.min(1, b.s * 1.3) * (phase === 1 ? 1 : 0.7);
          const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(95,80,210,0.4)'); gr.addColorStop(0.6, 'rgba(60,45,150,0.14)'); gr.addColorStop(1, 'rgba(30,20,70,0.04)');
          g.fillStyle = gr; g.fillRect(0, 0, W, H);
          g.globalAlpha *= 0.75; g.drawImage(ceiling, 0, 0, W, H * 0.62);
        }
        // Afterimage glow (wide), then mid, then the white core.
        g.globalAlpha = 1;
        g.strokeStyle = `rgba(110,80,255,${0.13 * k})`; g.lineWidth = 26; g.stroke(b.main);
        for (const f of b.forks) { g.lineWidth = 12; g.stroke(f); }
        g.strokeStyle = `rgba(175,155,255,${0.42 * k})`; g.lineWidth = 7; g.stroke(b.main);
        for (const f of b.forks) { g.lineWidth = 3.5; g.stroke(f); }
        g.strokeStyle = `rgba(180,165,255,${0.5 * k})`; g.lineWidth = 1.2; for (const t of b.twigs) g.stroke(t);
        g.strokeStyle = `rgba(248,246,255,${Math.min(1, 1.1 * k)})`; g.lineWidth = 2.6; g.stroke(b.main);
        g.lineWidth = 1.4; for (const f of b.forks) g.stroke(f);
        // Where it lands: a bright splash on the ground.
        g.globalAlpha = k * 0.8;
        g.save(); g.translate(b.xb, H); g.scale(2.2, 0.6);
        const sp = g.createRadialGradient(0, 0, 0, 0, 0, 110); sp.addColorStop(0, 'rgba(230,225,255,0.9)'); sp.addColorStop(1, 'rgba(110,80,255,0)');
        g.fillStyle = sp; g.fillRect(-110, -110, 220, 110); g.restore();
      }
      bolts = bolts.filter((b) => b.age < 0.4);
    },
  });
})();
