// Colour fields (Rothko-like): two to four enormous soft rectangles of colour, stacked, breathing with the music.
// Each field owns a slice of the keyboard (top/left = high or low). Its hue follows the harmony sounding in that
// slice (circle of fifths, measured against the piece's long-run home key), its size and light follow how much is
// sounding there. Attacks flare the field they land in; the strongest chords glide a new band in.
// Painted on a small offscreen canvas (cheap blur) and scaled up: the upscale is the feathering.
(() => {
  const SW = 320, SH = 180;
  const S = document.createElement('canvas'); S.width = SW; S.height = SH; const sg = S.getContext('2d');
  // Scumble: a blotchy grey texture, twice the size so it can drift under the paint.
  const N = document.createElement('canvas'); N.width = SW * 2; N.height = SH * 2; const ng = N.getContext('2d');
  {
    const T = document.createElement('canvas'); T.width = N.width; T.height = N.height; const tg = T.getContext('2d');
    tg.fillStyle = '#fff'; tg.fillRect(0, 0, T.width, T.height);
    for (let i = 0; i < 1100; i++) {
      const v = Math.round(185 + Math.random() * 70);
      tg.fillStyle = `rgba(${v},${v},${v},0.45)`; tg.beginPath();
      tg.ellipse(Math.random() * T.width, Math.random() * T.height, 3 + Math.random() * 18, 1.5 + Math.random() * 6, Math.random() * 0.5 - 0.25, 0, 7); tg.fill();
    }
    ng.filter = 'blur(2.5px)'; ng.drawImage(T, 0, 0); ng.filter = 'none';
  }
  const LO = 28, HI = 96;                              // keyboard slice the fields share
  const fifths = (m) => (((m % 12) * 7) % 12) / 12 * Math.PI * 2;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const hsl = (h, s, l) => `hsl(${(((h % 360) + 360) % 360).toFixed(1)},${Math.max(0, Math.min(100, s)).toFixed(1)}%,${Math.max(0, Math.min(92, l)).toFixed(1)}%)`;
  // Rothko's palette as a closed loop: the 'hue' of a field is a position on it, so every colour stays in his world.
  const RAMP = [[352, 72, 22], [2, 78, 34], [16, 82, 42], [34, 72, 42], [140, 22, 18], [220, 42, 24], [278, 30, 21], [330, 50, 19]];
  const ramp = (t) => {
    t = ((t % 1) + 1) % 1; const u = t * RAMP.length, i = Math.floor(u), k = u - i, a = RAMP[i], b = RAMP[(i + 1) % RAMP.length];
    let dh = b[0] - a[0]; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
    return [a[0] + dh * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
  const HOFF = [0, 0.07, -0.1, 0.13], LMUL = [0.85, 1.1, 0.8, 1.3];   // per-slice character, low → high

  let F = [], glides = [], time = 0, hx = 0, hy = 0, loud = 0, warm = null, runMax = 70, runMean = 60, cool = 0, emax = 0.6;
  const mk = () => ({ share: 1, vx: 0, vy: 0, e: 0, imp: 0, mx: 0, my: 0, light: 0.08, flare: 0, hard: 0, ph: Math.random() * 7 });
  // The keyboard is split where the music actually lives: slice edges sit at running quantiles of the attacked pitches
  // (≈ the last half-minute), so each field gets its share of the playing and register shifts show as fields swelling.
  const hist = new Float32Array(128); let edges = [];
  const prior = () => { hist.fill(0); for (let m = 24; m < 100; m++) hist[m] = 0.6 * Math.exp(-(((m - 60) / 16) ** 2)); edges = []; };
  const bandOf = (m, n) => { let b = 0; while (b < n - 1 && m >= (edges[b] ?? LO + (HI - LO) * (b + 1) / n)) b++; return b; };
  function splitKeyboard(n, dt) {
    const k = Math.pow(0.5, dt / 30); let tot = 0; for (let m = 0; m < 128; m++) { hist[m] *= k; tot += hist[m]; }
    let cum = 0, b = 0; const tgt = [];
    for (let m = 0; m < 128 && b < n - 1; m++) { cum += hist[m]; while (b < n - 1 && cum >= tot * (b + 1) / n) { tgt.push(m + 0.5); b++; } }
    const ke = 1 - Math.pow(0.5, dt / 2.5);
    for (let i = 0; i < n - 1; i++) edges[i] = edges[i] == null ? tgt[i] : edges[i] + (tgt[i] - edges[i]) * ke;
    edges.length = n - 1;
  }
  prior();
  // warmth 1 = burnt orange, 0 = oxblood, -0.5 = plum, -1 = deep blue
  const baseT = () => { const w = warm ?? 0; return w >= 0 ? w * 0.25 : 1 + w * 0.33; };
  const fieldT = (f, b, x) => baseT() + HOFF[b] + x.p('harmony') * wrap(Math.atan2(f.vy, f.vx) - Math.atan2(hy, hx)) / (Math.PI * 2) * (f.vx || f.vy ? 1 : 0);
  let layout = [];                                     // last frame's rects in virtual space, by band

  // A field as a stack of thin strips with wobbling ends: scumbled, uneven edges once blurred.
  function strips(x0, y0, x1, y1, amp, ph) {
    const p = new Path2D();
    for (let y = y0; y < y1; y += 2) {
      const j0 = amp * (Math.sin(y * 0.17 + ph + time * 0.35) + 0.5 * Math.sin(y * 0.53 + ph * 3)), j1 = amp * (Math.sin(y * 0.13 + ph * 2 - time * 0.3) + 0.5 * Math.sin(y * 0.47 + ph));
      p.rect(x0 + j0, y, x1 - x0 - j0 + j1, Math.min(2.2, y1 - y));
    }
    return p;
  }

  TOOLS.push({
    id: 'fields', name: 'Colour fields', tag: 'new',
    blurb: 'Two to four huge soft fields of colour, Rothko-like. Each owns a register: its hue follows the harmony there, its size and light how much is sounding. Edges feather when quiet and harden when loud; attacks flare a field, the biggest chords glide a new band in.',
    params: [
      { key: 'count', label: 'fields', min: 2, max: 4, step: 1, value: 3 },
      { key: 'cols', label: 'columns', min: 0, max: 1, step: 1, value: 0 },
      { key: 'feather', label: 'feather', min: 0, max: 1, value: 0.75, drive: '-level' },
      { key: 'harmony', label: 'harmony → hue', min: 0, max: 1, value: 0.35 },
      { key: 'warmth', label: 'warmth', min: -1, max: 1, value: -0.2, drive: '+level' },
      { key: 'sat', label: 'saturation', min: 0, max: 1, value: 0.6 },
      { key: 'breath', label: 'breathing', min: 0, max: 1, value: 0.45, drive: '+density' },
      { key: 'flare', label: 'attack flare', min: 0, max: 1.5, value: 0.8 },
      { key: 'bands', label: 'new bands', min: 0, max: 1, value: 0.7 },
      { key: 'drift', label: 'slowness (s)', min: 0.3, max: 6, value: 2 },
    ],
    reset() { prior(); F = []; glides = []; time = 0; hx = 0; hy = 0; loud = 0; warm = null; runMax = 70; runMean = 60; cool = 0; emax = 0.6; layout = []; },
    onChord(ch, x) {
      const n = F.length; if (!n) return;
      const fl = x.p('flare'), per = F.map(() => 0);
      let cx = 0, cy = 0, mm = 0;
      for (const no of ch.notes) {
        const b = bandOf(no.m, n), w = no.v / 127, a = fifths(no.m), f = F[b];
        hist[no.m] += w;
        per[b] += w; cx += Math.cos(a) * w; cy += Math.sin(a) * w; mm += no.m;
        // attacks are remembered for a while (short or staccato notes would otherwise leave no trace)
        f.imp = Math.min(3, f.imp + w * 0.8); f.mx += Math.cos(a) * w; f.my += Math.sin(a) * w;
      }
      hx += cx * 0.04; hy += cy * 0.04;
      mm /= ch.notes.length;
      const punch = 0.45 + 0.55 * Math.min(1, ch.vel / Math.max(60, runMax));
      F.forEach((f, b) => { if (per[b]) f.flare = Math.min(1.4, f.flare + fl * Math.min(1, 0.35 + per[b]) * punch); });
      runMax = Math.max(runMax, ch.vel); runMean += (ch.vel - runMean) * 0.08;
      const strong = cool <= 0 && ch.notes.length >= 2 && ch.vel >= Math.max(runMax - 8, runMean + 10);
      if (!strong) return;
      cool = 0.3;
      for (const f of F) f.hard = 1;
      if (Math.random() >= x.p('bands') || glides.length > 4) return;
      const b = bandOf(mm, n), L = layout[b];
      const hue = baseT() + HOFF[b] + 0.04 + x.p('harmony') * wrap(Math.atan2(cy, cx) - Math.atan2(hy, hx)) / (Math.PI * 2);
      const cols = x.p('cols') >= 0.5, VH = cols ? SW : SH;
      const pp = Math.max(0, Math.min(1, (mm - LO) / (HI - LO)));
      const start = cols ? pp * VH : (1 - pp) * VH;   // where the pitch sits
      glides.push({ pos: start, to: L ? (L.y0 + L.y1) / 2 : start, hue, age: 0, life: 1.1 + 0.25 * ch.notes.length, th: 3 + 0.8 * ch.notes.length, x0: L ? L.x0 : 20, x1: L ? L.x1 : (cols ? SH : SW) - 20 });
    },
    frame(x) {
      const dt = x.dt; time += dt;
      const n = Math.round(x.p('count')); while (F.length < n) F.push(mk()); if (F.length > n) F.length = n;
      if (edges.length !== n - 1) edges = [];
      splitKeyboard(n, dt);
      const cols = x.p('cols') >= 0.5, VW = cols ? SH : SW, VH = cols ? SW : SH;
      const drift = x.p('drift'), kS = 1 - Math.pow(0.5, dt / drift), kF = 1 - Math.pow(0.5, dt / (0.25 + 0.3 * drift));
      const feather = x.p('feather'), sat = x.p('sat'), breath = x.p('breath');
      warm = warm == null ? x.p('warmth') : warm + (x.p('warmth') - warm) * (1 - Math.pow(0.5, dt / 3));
      loud = Math.max(x.feat.level, loud * Math.pow(0.5, dt / 2));   // loudness that rises at once and falls slowly: the light of the picture
      cool -= dt; runMax = Math.max(runMean + 6, runMax - dt * 2.5);

      // What is sounding, per slice: a fifths-circle vector (harmony) and a weight (energy).
      const acc = F.map(() => ({ x: 0, y: 0, e: 0 }));
      let ax = 0, ay = 0;
      for (const s of x.sounding()) {
        const w = s.v / 127, b = bandOf(s.m, n), a = fifths(s.m);
        acc[b].x += Math.cos(a) * w; acc[b].y += Math.sin(a) * w; acc[b].e += w; ax += Math.cos(a) * w; ay += Math.sin(a) * w;
      }
      const kH = 1 - Math.pow(0.5, dt / 20); hx += (ax - hx) * kH; hy += (ay - hy) * kH;   // the long-run home key
      let top = 0;
      F.forEach((f, b) => {
        const kM = Math.pow(0.5, dt / (0.4 + 0.5 * drift)); f.imp *= kM; f.mx *= kM; f.my *= kM;
        const tx = acc[b].x + f.mx, ty = acc[b].y + f.my;
        if (acc[b].e > 0 || f.imp > 0.05) { f.vx += (tx - f.vx) * kS; f.vy += (ty - f.vy) * kS; }
        f.e += (acc[b].e + f.imp - f.e) * kF; top = Math.max(top, f.e);
        f.flare *= Math.pow(0.5, dt / 0.32); f.hard *= Math.pow(0.5, dt / 0.5);
      });
      emax = Math.max(0.5, top, emax * Math.pow(0.5, dt / 8));

      // Layout along the virtual vertical axis (rows: top = high register; columns: left = low).
      let sum = 0;
      F.forEach((f, b) => {
        const en = f.e / emax;
        const tgt = 1 + breath * 2.6 * en + breath * 0.4 * Math.sin(time * 0.45 + f.ph);
        f.share += (tgt - f.share) * kF; sum += f.share + f.flare * 0.25;
      });
      const mx = VW * 0.07, my = VH * 0.065, gap = VH * 0.04, avail = VH - 2 * my - (n - 1) * gap;
      const order = cols ? F.map((_, b) => b) : F.map((_, b) => n - 1 - b);
      let y = my; layout = [];
      for (const b of order) { const f = F[b], h = (f.share + f.flare * 0.25) / sum * avail; layout[b] = { x0: mx, x1: VW - mx, y0: y, y1: y + h }; y += h + gap; }

      // Paint.
      const bg = ramp(baseT());
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1; sg.filter = 'none';
      sg.fillStyle = hsl(bg[0], bg[1] * 0.5, 3 + 3 * x.feat.level); sg.fillRect(0, 0, SW, SH);
      if (cols) sg.setTransform(0, 1, 1, 0, 0, 0);
      F.forEach((f, b) => {
        const L = layout[b], en = f.e / emax, [h, s0, l0] = ramp(fieldT(f, b, x));
        const s = s0 * sat * 1.6 * (0.55 + 0.25 * en + 0.3 * loud);
        const tl = (0.45 + 0.75 * en) * (0.75 + 0.6 * loud) * LMUL[b];
        f.light += (tl - f.light) * kF;
        const raw = l0 * f.light, l = Math.min(60, (raw < 34 ? raw : Math.min(50, 34 + (raw - 34) * 0.45)) + l0 * f.flare * 0.55);   // soft knee keeps it rich; the flare rides on top
        const sw = f.flare * 3, bl = 0.7 + feather * 8 * (1 - 0.75 * f.hard), amp = 0.2 + feather * 2.4;
        const x0 = L.x0 - sw, x1 = L.x1 + sw, y0 = L.y0 - sw * 0.6, y1 = L.y1 + sw * 0.6;
        sg.filter = `blur(${bl.toFixed(2)}px)`;
        sg.globalAlpha = 0.95; sg.fillStyle = hsl(h, s, l * 0.78); sg.fill(strips(x0 - 1, y0 - 0.5, x1 + 1, y1 + 0.5, amp, f.ph));
        sg.globalAlpha = 0.7; sg.fillStyle = hsl(h + 6, s * 1.05, l); sg.fill(strips(x0 + 2, y0 + 1.5, x1 - 2, y1 - 1.5, amp * 1.3, f.ph + 2));
        // the inner light
        const ix = (x1 - x0) * 0.12, iy = (y1 - y0) * 0.25;
        sg.filter = `blur(${(bl * 1.5 + 7).toFixed(2)}px)`;
        sg.globalAlpha = Math.min(0.7, 0.18 + 0.5 * f.flare); sg.fillStyle = hsl(h + 8, Math.min(100, s * 1.15), Math.min(52, l * 1.25 + 3));
        sg.fillRect(x0 + ix, y0 + iy, x1 - x0 - 2 * ix, Math.max(1, y1 - y0 - 2 * iy));
      });
      // New bands: appear where the chord's pitch sits, glide into their field and dissolve into it.
      for (const q of glides) {
        q.age += dt; const k = q.age / q.life, al = Math.pow(Math.max(0, 1 - k), 1.4);
        q.pos += (q.to - q.pos) * (1 - Math.pow(0.5, dt / 0.28));
        const th = q.th * (1 + 6 * k), [gh, gs, gl] = ramp(q.hue);
        sg.filter = `blur(${(1 + feather * 3 + 5 * k).toFixed(2)}px)`;
        sg.globalAlpha = 0.85 * al; sg.fillStyle = hsl(gh, gs * sat * 1.6, Math.min(58, gl * (1.2 + 0.9 * (1 - k))));
        sg.fill(strips(q.x0 - 4, q.pos - th / 2, q.x1 + 4, q.pos + th / 2, 0.8, q.hue));
      }
      glides = glides.filter((q) => q.age < q.life);
      // Scumble: drifting blotches multiplied into the paint.
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.filter = 'none';
      sg.globalCompositeOperation = 'multiply'; sg.globalAlpha = 0.35 + 0.3 * feather;
      sg.drawImage(N, SW / 2 * (1 + Math.sin(time * 0.07)), SH / 2 * (1 + Math.sin(time * 0.053 + 1)), SW, SH, 0, 0, SW, SH);
      sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1;

      const g = x.g;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.globalAlpha = 0.93; g.drawImage(S, 0, 0, x.W, x.H);
    },
  });
})();
