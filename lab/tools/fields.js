// Colour fields v3 (Rothko-like): one to four enormous soft fields of colour, stacked, a slow building block to mix
// other widgets over. Each field owns a slice of the keyboard (top = high notes).
// Notes → light: every attack blooms a glow inside its field (placed by pitch within the slice, sized and lit by how
// loud it is next to the recent loudest, lasting as long as the notes ring); busy playing makes the edges hum.
// Harmony → hue: the chord sounding (on the circle of fifths, measured from the piece's home key) sets where on
// Rothko's palette the picture sits; when the chord changes the hues glide there, and a band of the new colour washes
// into its field from the side where the chord sits (never across the gaps) and floods it. Dynamics → light: loud passages brighten, saturate and harden the edges; quiet ones
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
  const RAMP = [[352, 72, 22], [2, 78, 34], [16, 82, 42], [34, 72, 42], [152, 32, 17], [220, 42, 24], [278, 30, 21], [330, 50, 19]];
  const ramp = (t) => {
    t = ((t % 1) + 1) % 1; const u = t * RAMP.length, i = Math.floor(u), k = u - i, a = RAMP[i], b = RAMP[(i + 1) % RAMP.length];
    let dh = b[0] - a[0]; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
    // A long way round the colour wheel (gold → green, green → blue) passes through dark, not through mud: the light
    // sinks, the hue leans away (gold sinks to umber, green to deep teal) and turns over while it is dark (no olive or
    // khaki in between).
    const far = Math.min(1, Math.max(0, (Math.abs(dh) - 50) / 40)), dip = far * Math.sin(Math.PI * k) ** 1.5;
    const kh = k + far * ((k < 0.47 ? 0 : k > 0.53 ? 1 : (k - 0.47) / 0.06) - k);
    return [a[0] + dh * kh - Math.sign(dh) * 18 * dip * (kh < 0.5 ? 1 : -1), (a[1] + (b[1] - a[1]) * k) * (1 - 0.15 * dip), (a[2] + (b[2] - a[2]) * k) * (1 - 0.6 * dip)];
  };
  const hsla = (h, s, l, a) => `hsla(${(((h % 360) + 360) % 360).toFixed(1)},${clamp(s, 0, 100).toFixed(1)}%,${clamp(l, 0, 92).toFixed(1)}%,${clamp(a).toFixed(3)})`;
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
  let glows = [], hum = 0;                                // glows: one per attack per field; hum: the edges' own clock
  const mk = () => ({ share: 1, e: 0, imp: 0, mx: 0, my: 0, ang: gAng, light: null, flare: 0, ph: Math.random() * 7 });

  // A field as a stack of thin strips with wobbling ends: scumbled, uneven edges once blurred.
  function strips(x0, y0, x1, y1, amp, ph) {
    const p = new Path2D();
    for (let y = y0; y < y1; y += 2) {
      const j0 = amp * (Math.sin(y * 0.17 + ph + hum * 0.18) + 0.5 * Math.sin(y * 0.53 + ph * 3 + hum * 0.11)), j1 = amp * (Math.sin(y * 0.13 + ph * 2 - hum * 0.15) + 0.5 * Math.sin(y * 0.47 + ph - hum * 0.09));
      p.rect(x0 + j0, y, x1 - x0 - j0 + j1, Math.min(2.2, y1 - y));
    }
    return p;
  }

  // Icon helpers: a mini field picture.
  const fieldIcon = (g, x, y, w, h, col, blur) => ICON.blur(g, blur, () => ICON.rect(g, x, y, w, h, col));

  // Paint first, under every other widget (the card order on the page is sorted separately).
  TOOLS.unshift({
    id: 'fields', name: 'Colour fields', tag: 'v3',
    blurb: 'Huge, slow, soft fields of colour (Rothko-like), made to sit under other widgets; each field owns a part of the keyboard, bass at the bottom. New in v3: every note now lights its field from inside (low notes to the left, high to the right; loud ones bright and wide, soft ones a faint glow), busy playing makes the edges hum, and a chord change floods its field with the new colour instead of a bright stripe. Quiet passages stay a deep colour instead of going black.',
    params: [
      // Above 1 the picture keeps sinking toward black (the attack swells stop, the note glows go on, fainter): the old
      // right end, 1, is now about halfway, and every value up to 1 still draws what it always drew.
      { key: 'back', label: 'stay in the background', min: 0, max: 1.9, step: 0.01, value: 0.4,
        hint: 'How much it steps back for widgets drawn over it. Left: a full, glowing painting. Right: almost nothing, a breath of colour behind everything that only the loud passages lift.',
        icon: (g, v, w, h) => {
          ICON.alpha(g, 1 - 0.92 * v, () => fieldIcon(g, 2, 3, w - 4, h - 6, '#d0602e', 0));
          ICON.alpha(g, 0.25 + 0.75 * v, () => ICON.square(g, w / 2, h / 2, 9, ICON.ink, 0.2));
        } },
      { key: 'chords', label: 'chords move the colour', min: 0, max: 1, value: 0.7,
        hint: 'How far a chord change moves the colours. Left: one family of colour all the way through. Right: each new chord glides it somewhere new on the palette.',
        icon: (g, v, w, h) => ICON.palette(g, [0, 1, 2, 3].map((i) => rampCss(0.02 + v * i * 0.24)), w, h) },
      { key: 'home', label: 'home colour', min: -1, max: 1, value: -0.2, drive: '+level',
        hint: 'The colour it returns to on the home chord. Left: deep blues and plums. Right: oxblood and burnt orange. Follows the loudness at first: loud = warmer.',
        icon: (g, v, w, h) => fieldIcon(g, 3, 4, w - 6, h - 8, rampCss(homeT(v * 2 - 1), 1.5), 0.4) },
      { key: 'dyn', label: 'the playing shows', min: 0, max: 1, value: 0.75, less: 0.2,
        hint: 'How much the notes and the loudness show. Left: a still painting whose colours only drift. Right: every note lights its field from inside, loud passages blaze and sharpen, quiet ones sink and blur.',
        icon: (g, v, w, h) => {
          fieldIcon(g, 3, 5, 15, h - 10, ICON.lerp('#b4522c', '#3a1810', v), 0.3 + 2.2 * v);
          fieldIcon(g, 22, 5, 15, h - 10, ICON.lerp('#b4522c', '#d86a3a', v), 0.3);
          ICON.alpha(g, v, () => ICON.blur(g, 2, () => ICON.dot(g, 31, h / 2, 1.5 + 3 * v, '#ffd0a0')));
        } },
      { key: 'n', label: 'how many fields', min: 1, max: 4, step: 1, value: 3, less: 1,
        hint: 'How many fields are stacked. Left: one enormous field. Right: four, one per register, bass at the bottom.',
        icon: (g, v, w, h) => {
          const n = 1 + Math.round(v * 3), gap = 2, fh = (h - 4 - gap * (n - 1)) / n, cols = ['#d0602e', '#8a2a24', '#4a5f96', '#c8903a'];
          for (let i = 0; i < n; i++) ICON.rect(g, 4, 2 + i * (fh + gap), w - 8, fh, cols[i]);
        } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much is going on in the painting: how many fields are stacked and how much each note lights its field. Left: one big field that hardly reacts. Right: several fields, every note blooming inside. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() {
      prior(); F = []; washes = []; time = 0; warm = null; loudEnv = 0; loudN = 0.4; hard = 0; cool = 0; emax = 0.6; layout = [];
      gAng = 0; gTgt = 0; gx = 0; gy = 0; runMax = 70; runMean = 60; lastChange = -9; glows = []; hum = 0;
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
      // Every attack lights its field from inside: one glow per field it touches, placed along the field by pitch
      // (low left, high right, within that field's share of the keyboard), as wide as the notes are spread, as bright
      // as the attack is loud next to the recent loudest, and lasting as long as the notes ring.
      for (let b = 0; b < n; b++) {
        if (!per[b]) continue;
        let lo = 128, hi = 0, mw = 0, ww = 0, dur = 0, vmax = 0, cnt = 0;
        for (const no of ch.notes) if (bandOf(no.m, n) === b) { lo = Math.min(lo, no.m); hi = Math.max(hi, no.m); mw += no.m * no.v; ww += no.v; dur = Math.max(dur, no.d); vmax = Math.max(vmax, no.v); cnt++; }
        const k0 = b ? edges[b - 1] ?? LO + (HI - LO) * b / n : LO - 4, k1 = b < n - 1 ? edges[b] ?? LO + (HI - LO) * (b + 1) / n : HI + 4;
        const span = Math.max(6, k1 - k0), u = clamp((mw / ww - k0) / span, 0.04, 0.96);
        const p = clamp(vmax / Math.max(64, runMax)), a = 0.2 + 0.8 * p * p;
        glows.push({ b, u, wid: clamp(0.11 + 0.1 * p + 0.5 * (hi - lo) / span + 0.025 * (cnt - 1), 0.1, 0.42), a, age: 0,
          life: 0.55 + 0.9 * p + Math.min(2.6, dur) * 0.7, dh: (Math.random() - 0.5) * 10 });
      }
      if (glows.length > 56) glows.splice(0, glows.length - 56);
      F.forEach((f, b) => { if (per[b]) f.flare = Math.min(1, f.flare + 0.35 * Math.max(0, 1 - 0.7 * B) * Math.min(1, 0.3 + per[b]) * punch); });
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
      const rate = x.feat.rate || 0; hum += dt * (0.6 + 3.2 * rate);   // busy playing makes the edges hum, sparse playing stills them
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
      const lightAll = (1 + (dyn < 0 ? 0.25 : 1.15) * dyn) * (1 - 0.5 * B), satAll = (1 + 0.55 * dyn) * (1 - 0.3 * B);
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
        const tl = (1.05 + 0.35 * en) * lightAll * LMUL[b];
        f.light = f.light == null ? 0.8 * tl : f.light + (tl - f.light) * kL;   // after a seek it starts near its light, not black
        const raw = l0 * f.light, l = Math.min(62, (raw < 34 ? raw : Math.min(52, 34 + (raw - 34) * 0.45)) + l0 * f.flare * 0.5 * Math.max(0, 1 - 0.6 * B));
        f.h = h; f.s = s; f.l = l; f.l0 = l0;
        const sw = f.flare * 2.5, bl = 0.6 + (1 - edge) * 7 + B * 2.5, amp = 0.2 + (1 - edge) * 2.6 + 1.1 * rate * A;
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
      // The notes: each attack's glow blooms inside its field in a few hundredths of a second and sinks as the notes
      // ring away. 'screen' only ever lightens, so many glows (busy playing) make a field shimmer without burning out.
      const gg = Math.min(1, 1.3 * A) * (B <= 1 ? 1 - 0.55 * B : 0.45 * (2 - B));
      sg.filter = 'none'; sg.globalCompositeOperation = 'screen';
      for (const q of glows) {
        q.age += dt; const L = layout[q.b], f = F[q.b]; if (!L || !f || f.l == null || q.age >= q.life) continue;
        const k = q.age / q.life, al = Math.min(1, q.age / 0.05 + 0.15) * (1 - k) ** 1.7 * q.a * gg; if (al < 0.004) continue;
        const fw = L.x1 - L.x0, fh = L.y1 - L.y0, rx = q.wid * fw * (1 + 0.35 * k), ry = fh * (0.34 + 0.14 * q.a);
        const cx = clamp(L.x0 + q.u * fw, L.x0 + rx * 0.85, L.x1 - rx * 0.85), cy = (L.y0 + L.y1) / 2;
        const gh = f.h + 10 + q.dh, gs2 = Math.max(45, f.s * 1.3), gl2 = Math.min(56, f.l * 1.35 + 12 + 6 * q.a);
        sg.setTransform(rx, 0, 0, ry, cx, cy);
        const gr = sg.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, hsla(gh + 6, gs2, gl2 + 3, 1)); gr.addColorStop(0.4, hsla(gh, gs2, gl2, 0.55)); gr.addColorStop(1, hsla(gh, gs2, gl2, 0));
        sg.globalAlpha = al; sg.fillStyle = gr; sg.fillRect(-1, -1, 2, 2);
      }
      glows = glows.filter((q) => q.age < q.life);
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over';
      // Chord changes: a band of the new colour appears where the chord sits, drifts into its field, swells to fill most
      // of it and narrows away again as the field itself turns. It stays nearly opaque and fades by narrowing (a thin
      // veil of one colour over another goes muddy), and it keeps the field's own light: a new colour, not a flash.
      for (const q of washes) {
        q.age += dt; const k = q.age / q.life, al = Math.min(1, k * 8) * (1 - k ** 4);
        const L = layout[q.b], f = F[q.b]; if (L) { q.to = (L.y0 + L.y1) / 2; q.x0 = L.x0; q.x1 = L.x1; q.fh = L.y1 - L.y0; }
        q.pos += (q.to - q.pos) * (1 - Math.pow(0.5, dt / 0.6));
        const grow = Math.sin(Math.PI * Math.min(1, k * 1.15)) ** 0.6, th = Math.max(1, q.th * (1 - k) + Math.max(0, (q.fh ?? q.th) * 0.85 - q.th) * grow);
        // its light is the field's light, scaled by how light the new colour is on the palette (a dark colour stays dark,
        // a light one only a little lighter than its field: it must not outshine the widgets drawn over it)
        // the band is one of the palette's own colours (the nearest to the new chord's place), never an in-between
        const [gh, gs, gl] = ramp(Math.round(tOf(q.ang, q.b) * RAMP.length) / RAMP.length), wl = f && f.l != null ? f.l * clamp(gl / Math.max(8, f.l0), 0.45, 1.15) : gl * lightAll;
        sg.filter = `blur(${(4 + (1 - edge) * 4 + 5 * k + 2 * B).toFixed(2)}px)`;
        sg.globalAlpha = (0.88 + 0.12 * q.a) * al * (1 - 0.15 * B);
        sg.fillStyle = hsl(gh, gs * satAll * 1.1, Math.min(50, wl * 1.05 + 3 * (1 - k)));
        // kept inside its own field: a swelling band that is still drifting in must not paint over the dark gap between
        // two fields (it would melt them into one); while it is outside, it slides in from that field's edge
        const by0 = L ? Math.max(q.pos - th / 2, L.y0 + 1.5) : q.pos - th / 2, by1 = L ? Math.min(q.pos + th / 2, L.y1 - 1.5) : q.pos + th / 2;
        if (by1 - by0 >= 1) sg.fill(strips(q.x0 - 2, by0, q.x1 + 2, by1, 0.8, q.ang));
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
