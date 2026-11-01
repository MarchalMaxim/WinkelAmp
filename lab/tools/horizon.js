// Horizon (after Hiroshi Sugimoto's seascapes): one soft horizon dividing two fields of grey-blue tone, a still sky over
// a long-exposure sea. Almost nothing moves, on purpose: it is made for quiet, meditative music and must hold up when
// nothing happens.
// Harmony → tint: the notes sounding, on the circle of fifths from the piece's home key, tint the sky and (a little
// differently) the sea, very faintly; a clear chord tints more, a blur of changing harmony goes back to grey.
// Loudness → light: loud passages raise the contrast (a brighter sky, a blacker sea) and light the line.
// Attacks → shimmer: each note sends a faint glint along the horizon, from where its pitch sits (low left, high right),
// spreading outward both ways and fading; loud notes leave a dim trace on the water below.
// Bass → the horizon sinks a little (the "where the horizon sits" knob follows the bass by default), gliding slowly.
// How present: sinks the whole picture toward black and calms it; only the piece's hardest notes still glint.
(() => {
  const W = 1280, H = 720, TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const fifths = (m) => (((m % 12) * 7) % 12) / 12 * TAU;
  const hsl = (h, s, l, a = 1) => `hsla(${(((h % 360) + 360) % 360).toFixed(1)},${clamp(s, 0, 100).toFixed(1)}%,${clamp(l, 0, 100).toFixed(1)}%,${a})`;

  // Seeded random for the textures, so they are the same every load (and in the renderer).
  const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // The sea: fine horizontal streaks, thin and dense at the horizon, longer and wider toward us (a long exposure smooths
  // the swell into this). Two layers drift very slowly in opposite directions. Seamless left-right.
  const TW = 1600, TH = 500;
  function seaLayer(seed, n) {
    const c = mk(TW, TH), g = c.getContext('2d'), r = rng(seed);
    for (let i = 0; i < n; i++) {
      const d = Math.pow(r(), 1.9), y = d * TH, th = 0.5 + d * 4.5, len = (14 + r() * 110) * (0.35 + d * 3), x = r() * TW;
      const light = r() < 0.5, a = (light ? 0.05 : 0.07) + r() * 0.09;
      g.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      for (const ox of [-TW, 0, TW]) { g.beginPath(); g.ellipse(x + ox, y, len / 2, th / 2, 0, 0, TAU); g.fill(); }
    }
    const b = mk(TW, TH), bg = b.getContext('2d'); bg.filter = 'blur(0.8px)'; bg.drawImage(c, 0, 0); return b;
  }
  const SEA = [seaLayer(11, 2600), seaLayer(29, 2200)];

  // Film grain: a tile of grey noise, laid at a new offset every frame.
  const GR = mk(256, 256);
  { const g = GR.getContext('2d'), im = g.createImageData(256, 256), r = rng(5);
    for (let i = 0; i < im.data.length; i += 4) { const v = r() < 0.5 ? 0 : 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = Math.round(r() * 255); }
    g.putImageData(im, 0, 0); }
  // A soft vignette (the corners of a print), and the glint sprite.
  const VIG = mk(W, H);
  { const g = VIG.getContext('2d'), rg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
  const GL = mk(64, 64);
  { const g = GL.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64); }

  // The piece's home key: the fifths-circle balance of every note in the recording.
  let home = null;
  const homeAngle = () => {
    if (home != null) return home;
    let cx = 0, cy = 0;
    for (const [s, e, m, v] of (window.NOTES || [])) { const w = Math.min(4, e - s) * v, a = fifths(m); cx += Math.cos(a) * w; cy += Math.sin(a) * w; }
    return (home = cx || cy ? Math.atan2(cy, cx) : 0);
  };

  // The tints, one per step round the circle of fifths from home: steel blue at home, then indigo, lavender, mauve,
  // rose, a warm sand opposite home, and back through sea-grey and teal. [hue, how much]; blended as colour vectors, so
  // the way between sand and sea-grey passes through grey rather than through green.
  const TINTS = [[212, 1], [228, 1], [250, 1], [275, 0.95], [305, 0.9], [335, 0.85], [12, 0.8], [32, 0.75], [45, 0.55], [168, 0.55], [186, 0.85], [199, 1]];
  const tintOf = (a) => {
    const u = ((a / TAU) * 12 + 12) % 12, i = Math.floor(u), k = u - i, A = TINTS[i], B = TINTS[(i + 1) % 12], r = Math.PI / 180;
    const x = Math.cos(A[0] * r) * A[1] * (1 - k) + Math.cos(B[0] * r) * B[1] * k, y = Math.sin(A[0] * r) * A[1] * (1 - k) + Math.sin(B[0] * r) * B[1] * k;
    return [Math.atan2(y, x) / r, Math.hypot(x, y)];
  };

  // how present (0..1): which notes glint, judged against this piece's own notes (recordings differ a lot in how hard
  // they are played): every one at 1, the hardest 40% at 0.4, the hardest 5% at 0.
  let vels = null;
  const hardEnough = (v, cut) => {
    if (cut <= 0) return true;
    vels ??= (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= cut;
  };

  let glints = [], blooms = [], time = 0, hy = null, hyv = 0, con = null, flash = 0, tx = 0, ty = 0, grainPat = null, lastHue = 212;

  // Icon pieces: a little seascape, sky colour over sea colour, horizon at y.
  const scape = (g, w, h, y, sky, sea, soft = 0.6) => {
    const gr = g.createLinearGradient(0, 2, 0, h - 2), f = (y - 2) / (h - 4), s = Math.max(0.01, soft / (h - 4));
    gr.addColorStop(0, sky); gr.addColorStop(clamp(f - s), sky); gr.addColorStop(clamp(f + s), sea); gr.addColorStop(1, sea);
    g.fillStyle = gr; g.fillRect(2, 2, w - 4, h - 4);
  };

  // Painted first, under every other widget (it repaints the whole frame), so mixed with others it is their sea and sky.
  TOOLS.unshift({
    id: 'horizon', name: 'Horizon', tag: 'new',
    blurb: 'After Sugimoto’s seascapes: one soft horizon between a still grey sky and a long-exposure sea. The harmony tints both very faintly, loudness raises the contrast and lights the line, each note sends a faint shimmer along the horizon (a strong one also breathes light into the haze), and the bass lowers it a little. For quiet music; it is meant to look almost still.',
    params: [
      { key: 'level', label: 'where the horizon sits', min: 0.4, max: 0.6, value: 0.46, drive: '+bass',
        hint: 'How high the horizon is. Left: high, mostly sea. Right: low, mostly sky. At first it follows the bass: deep notes pull it down a little.',
        icon: (g, v, w, h) => { const y = 5 + v * (h - 10); scape(g, w, h, y, '#9aa4ae', '#363d45'); ICON.line(g, 2, y, w - 2, y, '#e9e2da', 1); } },
      { key: 'contrast', label: 'how stark', min: 0, max: 1, value: 0.28, drive: '+level',
        hint: 'How far apart sky and sea are. Left: fog, two nearly equal greys. Right: a bright sky over a black sea. At first louder playing makes it starker.',
        icon: (g, v, w, h) => scape(g, w, h, h / 2, ICON.lerp('#6a727b', '#dfe5ea', v), ICON.lerp('#565e66', '#0b0d10', v)) },
      { key: 'soft', label: 'soft horizon', min: 0, max: 1, value: 0.3,
        hint: 'How soft the line between sky and sea is. Left: a knife edge. Right: they melt into each other through haze.',
        icon: (g, v, w, h) => scape(g, w, h, h / 2, '#aab3bc', '#2a3037', 0.6 + v * 11) },
      { key: 'shimmer', label: 'shimmer on each note', min: 0, max: 2, value: 1,
        hint: 'How strongly each note glints along the horizon. Left: no glints, only the light of the line. Right: bright glints that run far along it.',
        icon: (g, v, w, h) => {
          scape(g, w, h, h / 2, '#7f8892', '#2b3138'); ICON.line(g, 3, h / 2, w - 3, h / 2, '#c9d0d6', 0.8);
          const R = ICON.rng(4), n = Math.round(v * 4);
          for (let i = 0; i < n; i++) { const x = 6 + R() * (w - 12), l = 3 + v * 5 + R() * 3; g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(GL, x - l, h / 2 - 2, l * 2, 4); g.drawImage(GL, x - l * 0.6, h / 2 - 1.5, l * 1.2, 3); g.restore(); }
        } },
      { key: 'colour', label: 'colour from the harmony', min: 0, max: 1, value: 0.5,
        hint: 'How much the chords tint the grey. Left: pure greys. Right: each chord tints the sky and the sea (still gently).',
        icon: (g, v, w, h) => scape(g, w, h, h / 2, ICON.lerp('#8e9399', '#9c8fc4', v), ICON.lerp('#3d4145', '#2a5560', v)) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much of the picture there is. Left: a dark, almost still sea where only the hardest notes of the piece glint, faintly. Right: the full sky and sea, every note glinting (as before).',
        icon: (g, v, w, h) => { scape(g, w, h, h / 2, ICON.lerp('#121417', '#9aa4ae', v), ICON.lerp('#08090b', '#363d45', v)); ICON.alpha(g, 0.15 + 0.85 * v, () => ICON.line(g, 3, h / 2, w - 3, h / 2, '#e9e2da', 1)); } },
    ],
    reset() { vels = null; glints = []; blooms = []; flash = 0; hy = null; hyv = 0; con = null; tx = ty = 0; },
    onChord(ch, x) {
      const sh = x.p('shimmer'), y = hy ?? x.p('level') * H, n = ch.notes.length;
      const pres = x.p('presence'), cut = (1 - pres) * 0.95;
      if (!hardEnough(ch.vel, cut)) return;                 // ch.vel is the chord's hardest note
      flash = Math.min(1.2, flash + 0.35 * Math.pow(ch.vel / 115, 1.5) * pres);
      if (sh <= 0.01) return;
      // a strong attack also opens a wide, soft breath of light in the haze over the place it struck
      if (ch.vel > 70) {
        let mp = 0, wt = 0; for (const no of ch.notes) { mp += x.pitch01(no.m) * no.v; wt += no.v; }
        const k = Math.pow((ch.vel - 70) / 50, 1.4) * sh * pres;
        blooms.push({ x: W * (0.12 + 0.76 * mp / wt) + x.rnd(-30, 30), age: 0, amp: Math.min(1.3, k), r: 160 + 70 * Math.min(6, n) + x.rnd(0, 60), life: 2.6 + 0.6 * Math.min(4, n) });
        if (blooms.length > 12) blooms.shift();
      }
      const calm = 1 - 0.6 * (1 - pres), glow = 1 - 0.65 * (1 - pres);   // fainter also means slower, dimmer glints
      for (const no of ch.notes) {
        if (!hardEnough(no.v, cut)) continue;
        const p = x.pitch01(no.m), vel = no.v / 127, k = sh * vel * (n > 3 ? 0.55 + 1.4 / n : 1);
        glints.push({
          x: W * (0.1 + 0.8 * p) + x.rnd(-40, 40), age: 0,
          amp: k * (0.55 + 0.45 * p) * glow,                // high notes glint brighter, low ones broader and dimmer
          len: (26 + 110 * (1 - p)) * (0.6 + 0.6 * vel) * (0.6 + 0.4 * sh),
          sp: (50 + 160 * p) * (0.6 + 0.6 * vel) * (0.5 + 0.5 * sh) * calm,
          life: (1.6 + 2.8 * Math.min(1, no.d / 2)) * (0.7 + 0.3 * sh),
          refl: vel > 0.66 ? (vel - 0.6) * 2.2 : 0,         // a loud note leaves a trace on the water
          dy: x.rnd(-0.6, 0.6), y0: y,
        });
      }
      if (glints.length > 140) glints.splice(0, glints.length - 140);
    },
    frame(x) {
      const g = x.g, dt = x.dt, pres = x.p('presence');
      time += dt * pres;                                    // the sea's drift and breath slow down with it
      // Slow gliding of everything: the horizon, the contrast (quick to rise, slow to fall), the tint.
      const tgtY = x.p('level') * H;
      if (hy == null) hy = tgtY;
      { // a critically damped glide so the horizon settles without a jolt
        const w0 = 2.2 * Math.max(0.25, pres), a = w0 * w0 * (tgtY - hy) - 2 * w0 * hyv; hyv += a * dt; hy += hyv * dt; }
      const tgtC = x.p('contrast');
      if (con == null) con = tgtC;
      con += (tgtC - con) * (1 - Math.pow(0.5, dt / ((tgtC > con ? 0.3 : 2.2) / Math.max(0.1, pres))));
      flash *= Math.pow(0.5, dt / 0.45);

      // Harmony: the sounding notes, weighted by loudness and how fresh they are, as a vector on the circle of fifths.
      let cx = 0, cy = 0, wt = 0;
      const h0 = homeAngle();
      for (const n of x.sounding()) { const w = (n.v / 127) * (0.35 + 0.65 * Math.exp(-(x.t - n.start) / 1.5)), a = fifths(n.m) - h0; cx += Math.cos(a) * w; cy += Math.sin(a) * w; wt += w; }
      if (wt > 0) { cx /= wt; cy /= wt; }
      const kh = 1 - Math.pow(0.5, dt / 1.4);
      // in silence the tint slowly drains back to grey
      tx += ((wt > 0 ? cx : 0) - tx) * kh; ty += ((wt > 0 ? cy : 0) - ty) * kh;
      const clar = Math.min(1, Math.hypot(tx, ty) * 1.6);
      // Home key = grey-blue; going round the circle of fifths walks the tint round the colour wheel.
      let tint = 1;
      if (clar > 0.02) { const t = tintOf(Math.atan2(ty, tx)); lastHue = t[0]; tint = t[1]; }
      const sat = x.p('colour') * (3 + 17 * clar) * tint;

      // The two fields. Lightness: sky brightens and sea darkens as the contrast rises.
      const c = con * (1 - 0.5 * (1 - pres)), Y = hy, soft = 1.5 + x.p('soft') * 70, br = 0.04 * Math.sin(time * 0.21) + 0.03 * Math.sin(time * 0.087 + 1);
      const skyTop = 30 + 14 * c, skyLow = 40 + 34 * c + br * 10, seaHi = 27 - 12 * c, seaMid = 20 - 13 * c, seaLow = 23 - 12 * c;
      const sh = lastHue, ss = sat, seah = lastHue - 25, seas = sat * 0.8;
      const gr = g.createLinearGradient(0, 0, 0, H), f = (v) => clamp(v / H);
      gr.addColorStop(0, hsl(sh + 6, ss * 0.8, skyTop));
      gr.addColorStop(f(Y * 0.6), hsl(sh + 3, ss * 0.9, (skyTop + skyLow) / 2 - 2));
      gr.addColorStop(f(Y - soft), hsl(sh, ss, skyLow));
      gr.addColorStop(f(Y + soft * 0.6), hsl(seah, seas, seaHi));
      gr.addColorStop(f(Y + (H - Y) * 0.45), hsl(seah - 5, seas * 0.9, Math.max(3, seaMid)));
      gr.addColorStop(1, hsl(seah - 8, seas * 0.8, Math.max(3, seaLow)));
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = gr; g.fillRect(0, 0, W, H);

      // The long-exposure sea, hanging from the horizon, compressed toward it.
      const seaH = H - Y + 4, sharp = 1 - x.p('soft');
      g.save(); g.beginPath(); g.rect(0, Y + soft * 0.3, W, seaH); g.clip();
      for (let i = 0; i < 2; i++) {
        const off = ((((i ? -1 : 1) * time * (i ? 3.1 : 4.7)) % TW) + TW) % TW;
        g.globalAlpha = (0.55 + 0.45 * c) * (i ? 0.7 : 1);
        g.drawImage(SEA[i], -off, Y, TW, seaH * 1.04); g.drawImage(SEA[i], TW - off, Y, TW, seaH * 1.04);
      }
      g.restore();

      // How present: sky and sea sink toward black (painted first, so nothing but Horizon is under this veil); the light
      // below keeps a little more of itself, so at the left end a hard note still shows on a nearly black sea.
      if (pres < 1) { g.save(); g.globalAlpha = 1; g.fillStyle = `rgba(0,0,0,${0.95 * (1 - pres)})`; g.fillRect(0, 0, W, H); g.restore(); }

      // The line: a thin band of haze light, brighter when loud and on each attack, breathing very slowly.
      const lineA = clamp((0.1 + 0.5 * c + 0.45 * flash + br) * (0.55 + 0.45 * sharp), 0, 1.2) * (1 - 0.8 * (1 - pres));
      g.globalCompositeOperation = 'screen';
      { const bw = 2 + soft * 0.9, lg = g.createLinearGradient(0, Y - bw, 0, Y + bw);
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, hsl(sh, ss * 0.5, 82, Math.min(1, lineA * 0.55))); lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg; g.fillRect(0, Y - bw, W, bw * 2); }
      { const lg = g.createLinearGradient(0, Y - 1.2, 0, Y + 1.2);   // the hairline itself
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, `rgba(240,244,248,${(Math.min(1, lineA) * 0.5 * sharp).toFixed(3)})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg; g.fillRect(0, Y - 1.2, W, 2.4); }

      // Breaths of light in the haze: wide and flat, centred on the line, strongest in the sky, only a little on the water.
      g.globalCompositeOperation = 'screen';
      for (const b of blooms) {
        b.age += dt;
        const u = b.age / b.life; if (u >= 1) continue;
        const env = Math.min(1, b.age / 0.08) * Math.pow(1 - u, 2.2), R = b.r * (1 + 0.35 * u);
        g.save(); g.beginPath(); g.rect(0, 0, W, Y); g.clip();
        g.globalAlpha = clamp(b.amp * env * 0.22); g.drawImage(GL, b.x - R * 1.6, Y - R * 0.42, R * 3.2, R * 0.84); g.restore();
        g.save(); g.beginPath(); g.rect(0, Y, W, H - Y); g.clip();
        g.globalAlpha = clamp(b.amp * env * 0.08); g.drawImage(GL, b.x - R * 1.2, Y - R * 0.18, R * 2.4, R * 0.36); g.restore();
      }
      blooms = blooms.filter((b) => b.age < b.life);
      g.globalAlpha = 1;

      // Shimmers: each one runs out both ways from where it struck, fading as it goes.
      g.globalCompositeOperation = 'lighter';
      for (const s of glints) {
        s.age += dt;
        const u = s.age / s.life; if (u >= 1) continue;
        const env = Math.pow(1 - u, 1.8), d = s.sp * s.age * (1 - 0.35 * u), y = Y + s.dy;
        const th = 2.2 + soft * 0.08;
        // the strike itself, a short bloom
        g.globalAlpha = clamp(s.amp * env * 0.55 * Math.max(0, 1 - s.age / 0.6));
        g.drawImage(GL, s.x - s.len * 0.6, y - th * 2.2, s.len * 1.2, th * 4.4);
        // the two runners
        g.globalAlpha = clamp(s.amp * env * 0.75);
        const L = s.len * (0.7 + 0.8 * u);
        g.drawImage(GL, s.x - d - L / 2, y - th / 2, L, th);
        g.drawImage(GL, s.x + d - L / 2, y - th / 2, L, th);
        // a dim trace on the water below a loud note
        if (s.refl > 0) {
          g.globalAlpha = clamp(s.refl * env * 0.3 * Math.min(1, s.amp));
          const rh = 40 + 110 * s.refl;
          for (let k = 0; k < 6; k++) {
            const yy = Y + 4 + Math.pow((k + 0.5) / 6, 1.6) * rh, ww = s.len * (0.25 + 0.5 * (k / 6)) * (1 - 0.3 * u);
            g.drawImage(GL, s.x - ww / 2 + Math.sin(k * 2.3 + s.age * 1.7) * 3, yy - 1, ww, 2 + k * 0.5);
          }
        }
      }
      glints = glints.filter((s) => s.age < s.life);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

      // Grain and the print's vignette.
      grainPat ??= g.createPattern(GR, 'repeat');
      g.save(); g.globalAlpha = 0.045; g.globalCompositeOperation = 'overlay';
      g.translate(-Math.floor(Math.random() * 256), -Math.floor(Math.random() * 256));
      g.fillStyle = grainPat; g.fillRect(0, 0, W + 256, H + 256); g.restore();
      g.drawImage(VIG, 0, 0);
    },
  });
})();
