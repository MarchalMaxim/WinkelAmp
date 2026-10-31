// Colour fields v2 (Rothko-like): one to four enormous soft fields of colour, stacked, a slow building block to mix
// other widgets over. Each field owns a slice of the keyboard (top = high notes).
// Harmony → hue: the chord sounding (on the circle of fifths, measured from the piece's home key) sets where on
// Rothko's palette the picture sits; when the chord changes the hues glide there, and a band of the new colour washes
// in from where the chord sits. Dynamics → light: loud passages brighten, saturate and harden the edges; quiet ones
// sink, dim and feather. It paints first (under every other widget) and blends with 'lighten', so it never darkens
// what other widgets have drawn, and a knob sets how far into the background it stays.
// Painted on a small offscreen canvas (cheap blur) and scaled up: the upscale is the feathering.
(() => {
  const SW = 320, SH = 180, TAU = Math.PI * 2;
  const S = document.createElement('canvas'); S.width = SW; S.height = SH; const sg = S.getContext('2d');
  // Scumble: a blotchy grey texture, twice the size so it can drift under the paint.
  const N = document.createElement('canvas'); N.width = SW * 2; N.height = SH * 2; const ng = N.getContext('2d');
  {
    const T = document.createElement('canvas'); T.width = N.width; T.height = N.height; const tg = T.getContext('2d');
    tg.fillStyle = '#fff'; tg.fillRect(0, 0, T.width, T.height);
    let s = 7; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 1100; i++) {
      const v = Math.round(185 + r() * 70);
      tg.fillStyle = `rgba(${v},${v},${v},0.45)`; tg.beginPath();
      tg.ellipse(r() * T.width, r() * T.height, 3 + r() * 18, 1.5 + r() * 6, r() * 0.5 - 0.25, 0, 7); tg.fill();
    }
    ng.filter = 'blur(2.5px)'; ng.drawImage(T, 0, 0); ng.filter = 'none';
  }
  const LO = 28, HI = 96;                              // keyboard slice the fields share
  const fifths = (m) => (((m % 12) * 7) % 12) / 12 * TAU;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const hsl = (h, s, l) => `hsl(${(((h % 360) + 360) % 360).toFixed(1)},${clamp(s, 0, 100).toFixed(1)}%,${clamp(l, 0, 92).toFixed(1)}%)`;
  // Rothko's palette as a closed loop: a field's hue is a position on it, so every colour stays in his world.
  const RAMP = [[352, 72, 22], [2, 78, 34], [16, 82, 42], [34, 72, 42], [140, 22, 18], [220, 42, 24], [278, 30, 21], [330, 50, 19]];
  const ramp = (t) => {
    t = ((t % 1) + 1) % 1; const u = t * RAMP.length, i = Math.floor(u), k = u - i, a = RAMP[i], b = RAMP[(i + 1) % RAMP.length];
    let dh = b[0] - a[0]; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
    return [a[0] + dh * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
  // warmth 1 = burnt orange, 0 = oxblood, -0.5 = plum, -1 = deep blue
  const homeT = (w) => (w >= 0 ? w * 0.25 : 1 + w * 0.33);
  const rampCss = (t, lMul = 1.35) => { const [h, s, l] = ramp(t); return hsl(h, s * 1.05, l * lMul); };
  const HOFF = [0, 0.05, -0.07, 0.09], LMUL = [0.88, 1.08, 0.86, 1.22];   // per-slice character, low → high

  // The piece's home key: the fifths-circle balance of every note in the recording (duration × velocity).
  let home = null;
  const homeAngle = () => {
    if (home != null) return home;
    let cx = 0, cy = 0;
    for (const [s, e, m, v] of (window.NOTES || [])) { const w = Math.min(4, e - s) * v, a = fifths(m); cx += Math.cos(a) * w; cy += Math.sin(a) * w; }
    return (home = cx || cy ? Math.atan2(cy, cx) : 0);
  };

  // The keyboard is split where the music actually lives: slice edges sit at running quantiles of the attacked pitches
  // (≈ the last half-minute), so each field gets its share of the playing and register shifts show as fields swelling.
  const hist = new Float32Array(128); let edges = [];
  const prior = () => { hist.fill(0); for (let m = 24; m < 100; m++) hist[m] = 0.6 * Math.exp(-(((m - 60) / 16) ** 2)); edges = []; };
  const bandOf = (m, n) => { let b = 0; while (b < n - 1 && m >= (edges[b] ?? LO + (HI - LO) * (b + 1) / n)) b++; return b; };
  function splitKeyboard(n, dt) {
    const k = Math.pow(0.5, dt / 30); let tot = 0; for (let m = 0; m < 128; m++) { hist[m] *= k; tot += hist[m]; }
    let cum = 0, b = 0; const tgt = [];
    for (let m = 0; m < 128 && b < n - 1; m++) { cum += hist[m]; while (b < n - 1 && cum >= tot * (b + 1) / n) { tgt.push(m + 0.5); b++; } }
    const ke = 1 - Math.pow(0.5, dt / 4);
    for (let i = 0; i < n - 1; i++) edges[i] = edges[i] == null ? tgt[i] : edges[i] + (tgt[i] - edges[i]) * ke;
    edges.length = n - 1;
  }
  prior();

  // State. Harmony angles are unwrapped (they glide the short way round and never jump), relative to the home key.
  let F = [], washes = [], time = 0, warm = null, loudEnv = 0, loudN = 0.4, hard = 0, cool = 0, emax = 0.6, layout = [];
  let gAng = 0, gTgt = 0, gx = 0, gy = 0, runMax = 70, runMean = 60, lastChange = -9;
  const mk = () => ({ share: 1, e: 0, imp: 0, mx: 0, my: 0, ang: gAng, light: 0.3, flare: 0, ph: Math.random() * 7 });

  // A field as a stack of thin strips with wobbling ends: scumbled, uneven edges once blurred.
  function strips(x0, y0, x1, y1, amp, ph) {
    const p = new Path2D();
    for (let y = y0; y < y1; y += 2) {
      const j0 = amp * (Math.sin(y * 0.17 + ph + time * 0.18) + 0.5 * Math.sin(y * 0.53 + ph * 3)), j1 = amp * (Math.sin(y * 0.13 + ph * 2 - time * 0.15) + 0.5 * Math.sin(y * 0.47 + ph));
      p.rect(x0 + j0, y, x1 - x0 - j0 + j1, Math.min(2.2, y1 - y));
    }
    return p;
  }

  // Icon helpers: a mini field picture.
  const fieldIcon = (g, x, y, w, h, col, blur) => ICON.blur(g, blur, () => ICON.rect(g, x, y, w, h, col));

  // Paint first, under every other widget (the card order on the page is sorted separately).
  TOOLS.unshift({
    id: 'fields', name: 'Colour fields', tag: 'v2',
    blurb: 'Huge, slow, soft fields of colour (Rothko-like), made to sit under other widgets. Each chord change glides the colours to a new place on the palette, and a band of the new colour washes in. Loud passages brighten and sharpen the edges; quiet ones sink and blur. It never darkens what other widgets draw on top.',
    params: [
      { key: 'back', label: 'stay in the background', min: 0, max: 1, value: 0.4,
        hint: 'How much it steps back for widgets drawn over it. Left: a full, glowing painting. Right: a dim veil of colour behind everything.',
        icon: (g, v, w, h) => {
          ICON.alpha(g, 1 - 0.75 * v, () => fieldIcon(g, 2, 3, w - 4, h - 6, '#d0602e', 0));
          ICON.alpha(g, 0.25 + 0.75 * v, () => ICON.square(g, w / 2, h / 2, 9, ICON.ink, 0.2));
        } },
      { key: 'chords', label: 'chords move the colour', min: 0, max: 1, value: 0.7,
        hint: 'How far a chord change moves the colours. Left: one family of colour all the way through. Right: each new chord glides it somewhere new on the palette.',
        icon: (g, v, w, h) => ICON.palette(g, [0, 1, 2, 3].map((i) => rampCss(0.02 + v * i * 0.24)), w, h) },
      { key: 'home', label: 'home colour', min: -1, max: 1, value: -0.2, drive: '+level',
        hint: 'The colour it returns to on the home chord. Left: deep blues and plums. Right: oxblood and burnt orange. Follows the loudness at first: loud = warmer.',
        icon: (g, v, w, h) => fieldIcon(g, 3, 4, w - 6, h - 8, rampCss(homeT(v * 2 - 1), 1.5), 0.4) },
      { key: 'dyn', label: 'loudness shows', min: 0, max: 1, value: 0.75,
        hint: 'How much loud and quiet change it. Left: the same light all through. Right: loud passages blaze and sharpen, quiet ones sink, dim and blur.',
        icon: (g, v, w, h) => {
          fieldIcon(g, 3, 5, 15, h - 10, ICON.lerp('#b4522c', '#3a1810', v), 0.3 + 2.2 * v);
          fieldIcon(g, 22, 5, 15, h - 10, ICON.lerp('#b4522c', '#ff9a50', v), 0.3);
        } },
      { key: 'n', label: 'how many fields', min: 1, max: 4, step: 1, value: 3,
        hint: 'How many fields are stacked. Left: one enormous field. Right: four, one per register, bass at the bottom.',
        icon: (g, v, w, h) => {
          const n = 1 + Math.round(v * 3), gap = 2, fh = (h - 4 - gap * (n - 1)) / n, cols = ['#d0602e', '#8a2a24', '#4a5f96', '#c8903a'];
          for (let i = 0; i < n; i++) ICON.rect(g, 4, 2 + i * (fh + gap), w - 8, fh, cols[i]);
        } },
    ],
    reset() {
      prior(); F = []; washes = []; time = 0; warm = null; loudEnv = 0; loudN = 0.4; hard = 0; cool = 0; emax = 0.6; layout = [];
      gAng = 0; gTgt = 0; gx = 0; gy = 0; runMax = 70; runMean = 60; lastChange = -9;
    },
    onChord(ch, x) {
      const n = F.length; if (!n) return;
      const per = F.map(() => 0);
      let cx = 0, cy = 0, mm = 0, wt = 0;
      for (const no of ch.notes) {
        const b = bandOf(no.m, n), w = no.v / 127, a = fifths(no.m), f = F[b];
        hist[no.m] += w; per[b] += w; cx += Math.cos(a) * w; cy += Math.sin(a) * w; mm += no.m * w; wt += w;
        // attacks are remembered for a while (short or staccato notes would otherwise leave no trace)
        f.imp = Math.min(3, f.imp + w * 0.8); f.mx += Math.cos(a) * w; f.my += Math.sin(a) * w;
      }
      gx += cx * 0.6; gy += cy * 0.6; mm /= wt || 1;
      const B = x.p('back'), punch = 0.4 + 0.6 * Math.min(1, ch.vel / Math.max(60, runMax));
      F.forEach((f, b) => { if (per[b]) f.flare = Math.min(1, f.flare + 0.35 * (1 - 0.7 * B) * Math.min(1, 0.3 + per[b]) * punch); });
      runMax = Math.max(runMax, ch.vel); runMean += (ch.vel - runMean) * 0.08;
      if (cool <= 0 && ch.notes.length >= 2 && ch.vel >= Math.max(runMax - 8, runMean + 10)) { cool = 0.3; hard = 1; }
      // A chord change: the chord's own place on the fifths circle is far from where the colour sits now.
      if (ch.notes.length < 2 || Math.hypot(cx, cy) < 0.35 * wt) return;
      const rel = wrap(Math.atan2(cy, cx) - homeAngle()), jump = Math.abs(wrap(rel - gAng));
      if (jump < 0.4 || time - lastChange < 0.9 || washes.length > 1 || x.p('chords') < 0.05) return;
      lastChange = time;
      const b = bandOf(mm, n), L = layout[b], VH = SH;
      const start = (1 - clamp((mm - LO) / (HI - LO))) * VH;          // where the chord sits (high = top)
      washes.push({ pos: start, to: L ? (L.y0 + L.y1) / 2 : start, ang: gAng + wrap(rel - gAng), b, age: 0, life: 2.4 + 0.2 * ch.notes.length,
        th: 14 + 2 * ch.notes.length, x0: L ? L.x0 : 14, x1: L ? L.x1 : SW - 14, a: Math.min(1, jump / 1.2) });
    },
    frame(x) {
      const dt = x.dt; time += dt;
      const n = Math.round(x.p('n')); while (F.length < n) F.push(mk()); if (F.length > n) F.length = n;
      if (edges.length !== Math.max(0, n - 1)) edges = [];
      splitKeyboard(n, dt);
      const B = x.p('back'), A = x.p('dyn'), gain = 2.2 * x.p('chords');
      const kS = 1 - Math.pow(0.5, dt / 1.6), kL = 1 - Math.pow(0.5, dt / 0.7), kG = 1 - Math.pow(0.5, dt / 0.9);
      warm = warm == null ? x.p('home') : warm + (x.p('home') - warm) * (1 - Math.pow(0.5, dt / 4));
      // Loudness: rises in half a second, falls over four; 0 = the quiet floor of these recordings, 1 = their climaxes.
      const lv = x.feat.level;
      loudEnv = lv > loudEnv ? loudEnv + (lv - loudEnv) * (1 - Math.pow(0.5, dt / 0.35)) : loudEnv * Math.pow(0.5, dt / 4);
      loudN = clamp((loudEnv - 0.2) / 0.48);
      cool -= dt; runMax = Math.max(runMean + 6, runMax - dt * 2.5); hard *= Math.pow(0.5, dt / 0.6);

      // What is sounding, per slice: a fifths-circle vector (harmony) and a weight (energy).
      const acc = F.map(() => ({ x: 0, y: 0, e: 0 }));
      let ax = 0, ay = 0, ae = 0;
      for (const s of x.sounding()) {
        const w = s.v / 127, b = bandOf(s.m, n), a = fifths(s.m);
        acc[b].x += Math.cos(a) * w; acc[b].y += Math.sin(a) * w; acc[b].e += w; ax += Math.cos(a) * w; ay += Math.sin(a) * w; ae += w;
      }
      // The whole picture's harmony: what sounds plus the last attacks (decaying), glided the short way round.
      const kM = Math.pow(0.5, dt / 1.4); gx *= kM; gy *= kM;
      const H0 = homeAngle(), tx = ax + gx, ty = ay + gy, mag = Math.hypot(tx, ty);
      if (mag > 0.15) { gTgt = gAng + wrap(wrap(Math.atan2(ty, tx) - H0) - gAng); gAng += (gTgt - gAng) * kG * clamp(mag / (ae + 0.6 + Math.hypot(gx, gy) * 0.3) * 1.5); }
      let top = 0;
      F.forEach((f, b) => {
        f.imp *= kM; f.mx *= kM; f.my *= kM;
        const fx = acc[b].x + f.mx, fy = acc[b].y + f.my, fm = Math.hypot(fx, fy);
        // a field leans toward its own register's harmony, but mostly follows the whole chord
        const own = fm > 0.2 ? gAng + wrap(wrap(Math.atan2(fy, fx) - H0) - gAng) * 0.35 : gAng;
        f.ang += (own - f.ang) * kG;
        f.e += (acc[b].e + f.imp - f.e) * kS; top = Math.max(top, f.e);
        f.flare *= Math.pow(0.5, dt / 0.5);
      });
      emax = Math.max(0.5, top, emax * Math.pow(0.5, dt / 10));

      // Layout: enormous fields, slim margins; their heights swell slowly with how much is sounding in their register.
      let sum = 0;
      F.forEach((f) => {
        const tgt = 1 + 1.6 * (f.e / emax) + 0.35 * Math.sin(time * 0.3 + f.ph);
        f.share += (tgt - f.share) * kS; sum += f.share + f.flare * 0.2;
      });
      const mx = SW * 0.045, my = SH * 0.05, gap = SH * (0.03 + 0.015 * (1 - loudN * A)), avail = SH - 2 * my - (n - 1) * gap;
      let y = my; layout = [];
      for (let k = n - 1; k >= 0; k--) { const f = F[k], h = (f.share + f.flare * 0.2) / sum * avail; layout[k] = { x0: mx, x1: SW - mx, y0: y, y1: y + h }; y += h + gap; }

      // Light and edges from dynamics (scaled by 'loudness shows'), all dimmed by 'stay in the background'.
      const dyn = A * (loudN - 0.45);                                    // −0.45 … +0.55
      const lightAll = (1 + (dyn < 0 ? 0.6 : 1.15) * dyn) * (1 - 0.6 * B), satAll = (1 + 0.55 * dyn) * (1 - 0.3 * B);
      const edge = clamp(0.55 + A * (loudN - 0.5) * 1.1 + 0.4 * hard);   // 0 = feathered, 1 = hard
      const baseT = homeT(warm);
      const tOf = (ang, b) => baseT + HOFF[b] + gain * ang / TAU;

      // Paint.
      const bg = ramp(baseT + gain * gAng / TAU);
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1; sg.filter = 'none';
      sg.fillStyle = hsl(bg[0], bg[1] * 0.5, (3 + 4 * loudN * A) * (1 - 0.5 * B)); sg.fillRect(0, 0, SW, SH);
      F.forEach((f, b) => {
        const L = layout[b], en = f.e / emax, [h, s0, l0] = ramp(tOf(f.ang, b));
        const s = s0 * (0.75 + 0.2 * en) * satAll;
        const tl = (0.9 + 0.35 * en) * lightAll * LMUL[b];
        f.light += (tl - f.light) * kL;
        const raw = l0 * f.light, l = Math.min(62, (raw < 34 ? raw : Math.min(52, 34 + (raw - 34) * 0.45)) + l0 * f.flare * 0.5 * (1 - 0.6 * B));
        const sw = f.flare * 2.5, bl = 0.6 + (1 - edge) * 7 + B * 2.5, amp = 0.2 + (1 - edge) * 2.6;
        const x0 = L.x0 - sw, x1 = L.x1 + sw, y0 = L.y0 - sw * 0.5, y1 = L.y1 + sw * 0.5;
        sg.filter = `blur(${bl.toFixed(2)}px)`;
        sg.globalAlpha = 0.95; sg.fillStyle = hsl(h, s, l * 0.78); sg.fill(strips(x0 - 1, y0 - 0.5, x1 + 1, y1 + 0.5, amp, f.ph));
        sg.globalAlpha = 0.7; sg.fillStyle = hsl(h + 6, s * 1.05, l); sg.fill(strips(x0 + 2, y0 + 1.5, x1 - 2, y1 - 1.5, amp * 1.3, f.ph + 2));
        // the inner light
        const ix = (x1 - x0) * 0.1, iy = (y1 - y0) * 0.24;
        sg.filter = `blur(${(bl * 1.5 + 8).toFixed(2)}px)`;
        sg.globalAlpha = Math.min(0.75, 0.2 + 0.25 * loudN * A + 0.4 * f.flare); sg.fillStyle = hsl(h + 8, Math.min(100, s * 1.15), Math.min(54, l * 1.25 + 3));
        sg.fillRect(x0 + ix, y0 + iy, x1 - x0 - 2 * ix, Math.max(1, y1 - y0 - 2 * iy));
      });
      // Chord changes: a band of the new colour appears where the chord sits, drifts into its field and dissolves there.
      for (const q of washes) {
        q.age += dt; const k = q.age / q.life, al = Math.sin(Math.PI * Math.min(1, k * 1.6 + 0.08)) ** 0.8 * (1 - k);
        const L = layout[q.b]; if (L) { q.to = (L.y0 + L.y1) / 2; q.x0 = L.x0; q.x1 = L.x1; }
        q.pos += (q.to - q.pos) * (1 - Math.pow(0.5, dt / 0.6));
        const th = q.th * (1 + 1.5 * k), [gh, gs, gl] = ramp(tOf(q.ang, q.b));
        sg.filter = `blur(${(4 + (1 - edge) * 4 + 6 * k + 2 * B).toFixed(2)}px)`;
        sg.globalAlpha = (0.4 + 0.35 * q.a) * al * (1 - 0.5 * B);
        sg.fillStyle = hsl(gh, gs * satAll * 1.05, Math.min(58, gl * (1.15 + 0.6 * (1 - k)) * Math.max(0.55, lightAll)));
        sg.fill(strips(q.x0 - 4, q.pos - th / 2, q.x1 + 4, q.pos + th / 2, 0.8, q.ang));
      }
      washes = washes.filter((q) => q.age < q.life);
      // Scumble: drifting blotches multiplied into the paint (less when loud: the paint is denser).
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.filter = 'none';
      sg.globalCompositeOperation = 'multiply'; sg.globalAlpha = 0.5 - 0.3 * edge;
      sg.drawImage(N, SW / 2 * (1 + Math.sin(time * 0.035)), SH / 2 * (1 + Math.sin(time * 0.027 + 1)), SW, SH, 0, 0, SW, SH);
      sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1;

      // Onto the stage: 'lighten' keeps whatever is brighter (other widgets' trails), so it only ever sits underneath.
      const g = x.g;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.globalCompositeOperation = 'lighten'; g.globalAlpha = 0.95 - 0.2 * B; g.drawImage(S, 0, 0, x.W, x.H);
    },
  });
})();
