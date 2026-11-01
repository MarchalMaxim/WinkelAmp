// Len Lye (after his scratched films, Free Radicals): white scratches on black film. The picture is held for one
// "film frame" and then scratched again from scratch, so every mark boils and jumps frame by frame; an attack cuts
// to a new frame at once and the marks jump with it. One mark per note, across the film by pitch: the bass makes
// tall wriggling pillars, the middle zigzags and coils, the treble small sparks; a loud chord bursts into jagged rays
// with a grey flash. Film dirt (long vertical scratches, dust) runs throughout and thickens with the music.
// v2: a mark boils for as long as its note is held (then a short tail), and on the frame a note is struck it is
// overexposed (brighter, a little bigger, with a wide halo) before it settles back, so every attack lands. Soft notes
// are faint broken hairlines, loud ones thick doubled scratches; high notes sit higher on the film; a full chord
// scratches smaller marks, a lone note in sparse music a bigger one. The light glows softly through the scratches (a
// blurred quarter-size copy of each film frame, added on top) and the projector lamp flickers a little.
// A sixth knob, how present (the user: the sliders should dim, not only boost). Turned down, the scratches are fainter,
// the film is cleaner and boils slower and calmer, and only the hardest notes of the piece scratch a mark or cut a frame
// (plus now and then an above-average attack, so a quiet passage still has a thin thread of marks instead of going black).
// At 1 every factor below is exactly 1 and no gate closes, so the picture is the same as before the knob.
(() => {
  const LW = 1280, LH = 720, TAU = Math.PI * 2;
  const layer = document.createElement('canvas'); layer.width = LW; layer.height = LH; const lg = layer.getContext('2d');
  const BW = 320, BH = 180, bloom = document.createElement('canvas'); bloom.width = BW; bloom.height = BH; const bg = bloom.getContext('2d');
  const R = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const INK = '255,251,243';

  let figs = [], dirt = [], acc = 0, cut = false, jump = 0, flash = 0, meanV = 72, lastBurst = -9, lastFlash = -9, time = 0, J = 1, nid = 0, gain = 1;
  // how present, this frame, and the three things it turns down (each exactly 1 at full presence).
  let P = 1, CALM = 1, INKA = 1;
  const dim = (k, pres) => 1 - (1 - pres) * k;
  // Which notes scratch a mark, judged against this piece's own notes (recordings differ a lot in how hard they are
  // played): every one at 1, the hardest 80% at 0.5, the hardest half at 0.25, the hardest 5% at 0.
  let allVels = null, lastMark = -9;
  const hardEnough = (v, x) => {
    const cut = Math.pow(1 - x.p('presence'), 2.2) * 0.95;
    if (cut <= 0) return true;
    if (!allVels) allVels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!allVels.length) return true;
    let a = 0, b = allVels.length; while (a < b) { const k = (a + b) >> 1; if (allVels[k] < v) a = k + 1; else b = k; }
    return a / allVels.length >= cut;
  };

  const p01 = (m) => clamp((m - 30) / 66);
  const pitchX = (m) => LW * (0.07 + 0.86 * p01(m)) + R(-55, 55);
  const pitchY = (m) => LH * (0.7 - 0.42 * p01(m)) + R(-0.12, 0.12) * LH;   // high notes higher up the film

  // One scratch: a faint wide glow, the white line itself (with the odd break in the emulsion), and a ragged hair beside it.
  // HALO (the strike frame's extra halo) and HAIR (whether the hair is scratched: not for soft notes) are set per mark.
  let HALO = 0, HAIR = 1;
  function trace(pts, gap) {
    lg.beginPath(); lg.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) (gap && Math.random() < gap ? lg.moveTo : lg.lineTo).call(lg, pts[k], pts[k + 1]);
  }
  function scratch(pts, w, a, gap = 0.04) {
    if (pts.length < 4 || a <= 0.01) return;
    if (HALO > 0.01) { lg.strokeStyle = `rgba(${INK},${(HALO * 0.085).toFixed(3)})`; lg.lineWidth = w * 3.5 + 9; trace(pts, 0); lg.stroke(); }
    lg.strokeStyle = `rgba(${INK},${(a * 0.13).toFixed(3)})`; lg.lineWidth = w * 3.4 + 3; trace(pts, 0); lg.stroke();
    lg.strokeStyle = `rgba(${INK},${a.toFixed(3)})`; lg.lineWidth = w; trace(pts, gap); lg.stroke();
    if (!HAIR) return;
    const o = w * 0.55 + 0.8, q = [];
    for (let k = 0; k < pts.length; k += 2) q.push(pts[k] + o + R(-1, 1), pts[k + 1] - o * 0.4 + R(-1, 1));
    lg.strokeStyle = `rgba(${INK},${(a * 0.55).toFixed(3)})`; lg.lineWidth = Math.max(0.6, w * 0.3); trace(q, gap * 3); lg.stroke();
  }

  // The marks. Each is re-scratched on every film frame from its own fixed traits plus fresh noise of size n.
  function shapePts(f, n) {
    const p = [];
    switch (f.type) {
      case 'pillar': { // tall vertical wriggle
        const st = 12, tr = f.zz * (0.4 + 0.6 * J);
        for (let y = f.y0, i = 0; y <= f.y1; y += st, i++) {
          const x = f.x + Math.sin(y * f.k + f.ph) * f.amp * (0.6 + 0.6 * J) + Math.sin(y * f.k * 3.1 - f.ph * 1.7) * f.amp * 0.3 + (i % 2 ? tr : -tr) + R(-n, n) * 0.5;
          p.push(x, y);
        }
        break;
      }
      case 'zig': { // a zigzag along a near-vertical axis
        const ca = Math.cos(f.ang), sa = Math.sin(f.ang), T = f.teeth;
        for (let i = 0; i <= T; i++) {
          const s = (i / T - 0.5) * f.len, o = (i % 2 ? 1 : -1) * f.tooth * (0.92 + 0.16 * Math.random());
          p.push(f.x + ca * s - sa * o + R(-n, n), f.y + sa * s + ca * o + R(-n, n));
        }
        break;
      }
      case 'coil': { // a spring of loops
        const ca = Math.cos(f.ang), sa = Math.sin(f.ang), N = f.loops * 9;
        for (let i = 0; i <= N; i++) {
          const t = i / N, th = t * f.loops * TAU + f.ph, s = (t - 0.5) * f.len + Math.cos(th) * f.r;
          const o = Math.sin(th) * f.r * 0.75;
          p.push(f.x + ca * s - sa * o + R(-n, n) * 0.6, f.y + sa * s + ca * o + R(-n, n) * 0.6);
        }
        break;
      }
      case 'ring': { // a wobbly, open oval
        const N = 22, cr = Math.cos(f.ph), sr = Math.sin(f.ph);
        for (let i = 0; i <= N - 2; i++) {
          const th = (i / N) * TAU, rx = f.r * (1 + R(-0.08, 0.08)), ry = f.r * f.ell;
          const ex = Math.cos(th) * rx, ey = Math.sin(th) * ry;
          p.push(f.x + ex * cr - ey * sr + R(-n, n) * 0.5, f.y + ex * sr + ey * cr + R(-n, n) * 0.5);
        }
        break;
      }
    }
    return p;
  }
  function drawFig(f, a) {
    const n = (2 + 7 * J) * (0.45 + 0.55 * f.v) * CALM;
    HAIR = f.v > 0.38 ? 1 : 0;
    if (f.type === 'spark') {
      const s = f.s * (0.8 + 0.4 * Math.random());
      if (f.sub === 0) for (let i = 0; i < f.rays; i++) { // a little star of ticks
        const th = f.ph + (i / f.rays) * TAU + R(-0.3, 0.3), l = s * R(0.5, 1.2);
        scratch([f.x + R(-n, n) * 0.3, f.y + R(-n, n) * 0.3, f.x + Math.cos(th) * l, f.y + Math.sin(th) * l], f.w, a, 0);
      } else if (f.sub === 1) { // a cross
        scratch([f.x - s, f.y - s * 0.8 + R(-n, n) * 0.4, f.x + s, f.y + s * 0.8], f.w, a, 0);
        scratch([f.x - s * 0.9, f.y + s + R(-n, n) * 0.4, f.x + s * 0.9, f.y - s], f.w, a, 0);
      } else { // a few dots and dashes
        for (let i = 0; i < 3; i++) {
          const x = f.x + R(-s, s), y = f.y + R(-s, s), l = R(1, s * 0.5);
          scratch([x, y, x + R(-l, l), y + l], f.w * 1.2, a, 0);
        }
      }
      return;
    }
    if (f.type === 'burst') { // a jagged star scratched round the point, a smaller one inside, and loose spikes
      HAIR = 1;
      const grow = 0.7 + 0.45 * clamp(f.age / 0.1), Ro = f.len * grow;
      for (const [rad, k, lw] of [[Ro, f.rays, f.w], [Ro * 0.42, Math.max(5, Math.round(f.rays * 0.6)), f.w * 0.8]]) {
        const p = [];
        for (let i = 0; i <= k * 2; i++) {
          const th = f.ph + (i / (k * 2)) * TAU, r = (i % 2 ? 0.38 : 1) * rad * R(0.78, 1.18) + R(-n, n);
          p.push(f.x + Math.cos(th) * r, f.y + Math.sin(th) * r);
        }
        scratch(p, lw, a, 0.03);
      }
      for (let i = 0; i < 6; i++) {
        const th = R(0, TAU), r0 = Ro * R(1.1, 1.3), r1 = r0 + Ro * R(0.15, 0.45);
        scratch([f.x + Math.cos(th) * r0, f.y + Math.sin(th) * r0, f.x + Math.cos(th) * r1, f.y + Math.sin(th) * r1], f.w * 0.8, a * 0.9, 0);
      }
      return;
    }
    const pts = shapePts(f, n);
    for (let s = 0; s < f.strands; s++) {
      const off = (s - (f.strands - 1) / 2) * f.w * 1.1, q = pts.map((v, k) => (k % 2 ? v : v + off + R(-1, 1)));
      scratch(q, f.w / Math.sqrt(f.strands), a * (s ? 0.7 : 1), f.gap);
    }
  }
  // A mark scaled about its centre (the strike frame scratches it a little bigger).
  function drawScaled(f, a, k) {
    if (k === 1) { drawFig(f, a); return; }
    const cx = f.x, cy = f.type === 'pillar' ? (f.y0 + f.y1) / 2 : f.y;
    lg.save(); lg.translate(cx, cy); lg.scale(k, k); lg.translate(-cx, -cy); drawFig(f, a); lg.restore();
  }

  // One mark per note. Its loudness (also against the recent music) sets its weight and brightness; a full chord makes
  // each mark smaller, a lone note in sparse music a bigger one; the mark lives while its note is held, then its tail.
  function addNote(q, x, ch) {
    const rel = clamp((ch.vel - meanV) / 40, -0.5, 0.5);
    const v = clamp(0.1 + 0.9 * clamp((q.v - 25) / 85) + rel * 0.3), m = q.m, nn = ch.notes.length;
    const sz = (0.62 + 0.75 * v) * (1.12 - 0.3 * x.feat.rate) / (1 + 0.1 * (nn - 1));
    const tail = x.p('life') * (0.35 + 0.65 * v) * (1 + 1.2 * (1 - x.feat.rate));
    const hold = Math.min(4, q.d);
    const f = { id: nid++, m, v, age: 0, hold, life: Math.max(hold + tail, 0.14), x: pitchX(m), y: pitchY(m), ph: R(0, TAU),
      gap: 0.02 + 0.16 * (1 - v) * (1 - v), strands: v > 0.72 ? 3 : v > 0.42 ? 2 : 1 };
    if (m < 46) {
      Object.assign(f, { type: 'pillar', y0: R(LH * 0.02, LH * 0.2), y1: R(LH * 0.8, LH * 0.98), k: R(0.006, 0.02), amp: R(10, 34) * (0.4 + 1.1 * v) * sz,
        zz: R(0.5, 2.5), w: 1.4 + 6 * v, spd: R(1, 3) });
      f.strands = Math.min(f.strands, 2);
    } else if (m < 62) {
      if (Math.random() < 0.25) Object.assign(f, { type: 'ring', r: R(22, 55) * sz, ell: R(0.35, 1), w: 1.2 + 3.4 * v, spd: R(0.3, 1.2) });
      else Object.assign(f, { type: 'zig', ang: Math.PI / 2 + R(-0.5, 0.5), len: R(130, 300) * sz, teeth: 9 + Math.floor(R(0, 8)),
        tooth: R(8, 20) * (0.7 + 0.5 * v), w: 1.2 + 4 * v, spd: 0 });
    } else if (m < 77) {
      Object.assign(f, { type: 'coil', ang: Math.PI / 2 + R(-0.8, 0.8), len: R(80, 190) * sz, loops: 3 + Math.floor(R(0, 4)),
        r: R(10, 24) * (0.6 + 0.4 * sz), w: 1.1 + 3.2 * v, spd: R(2, 6) });
      f.strands = Math.min(f.strands, 2);
    } else {
      Object.assign(f, { type: 'spark', sub: Math.floor(R(0, 3)), s: R(12, 26) * sz, rays: 4 + Math.floor(R(0, 4)), w: 1.1 + 2.4 * v, spd: R(0.5, 2) });
    }
    if (f.type === 'zig') f.tooth = Math.min(f.tooth, 0.7 * f.len / f.teeth);
    figs.push(f);
  }

  // Film dirt: long vertical scratches that come and go, and dust specks scattered fresh on every frame.
  function drawDirt(x) {
    const amt = x.p('dirt') * CALM, want = Math.round(amt * (1 + 2.5 * x.feat.density + 2 * x.feat.level));
    if (dirt.length < want && Math.random() < 0.5) dirt.push({ x: R(30, LW - 30), vx: R(-6, 6), age: 0, life: R(0.4, 2.5), a: R(0.18, 0.5), w: R(0.7, 1.8) });
    for (const d of dirt) {
      if (Math.random() < 0.15) continue;                  // it flickers out for a frame
      const p = [], y0 = Math.random() < 0.6 ? 0 : R(0, LH * 0.6), y1 = Math.random() < 0.6 ? LH : R(y0 + 80, LH);
      for (let y = y0; y <= y1; y += 40) p.push(d.x + R(-0.8, 0.8), y);
      scratch(p, d.w, d.a * R(0.6, 1), 0.08);
    }
    const n = Math.round(amt * (3 + 9 * x.feat.level + 5 * x.feat.rate));
    lg.fillStyle = `rgba(${INK},0.75)`;
    for (let i = 0; i < n; i++) {
      const px = R(0, LW), py = R(0, LH);
      if (Math.random() < 0.65) { lg.beginPath(); lg.arc(px, py, R(0.7, 2.6), 0, TAU); lg.fill(); }
      else { const l = R(4, 18), th = R(0, TAU); scratch([px, py, px + Math.cos(th) * l * 0.5 + R(-2, 2), py + Math.sin(th) * l * 0.5, px + Math.cos(th) * l, py + Math.sin(th) * l], 0.8, 0.6, 0); }
    }
  }

  // One film frame: wipe the layer, weave the gate a little, scratch every live mark again, and blur a small copy for the glow.
  function filmFrame(x) {
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.fillStyle = '#000'; lg.fillRect(0, 0, LW, LH);
    if (flash > 0.01) { lg.fillStyle = `rgba(${INK},${flash.toFixed(3)})`; lg.fillRect(0, 0, LW, LH); flash *= 0.25; }
    const weave = (1 + 2.5 * J + jump) * CALM;
    lg.setTransform(1, 0, 0, 1, R(-weave, weave), R(-weave, weave) * 0.6);
    jump = 0;
    HALO = 0; HAIR = 1;
    drawDirt(x);
    for (const f of figs) {
      if (f.age >= f.life) continue;
      const strike = f.age < 0.09 && f.type !== 'burst';
      if (!strike && Math.random() < 0.07) continue;            // dropped frames: a mark blinks out now and then (never as it lands)
      // Struck: overexposed, bigger, haloed. Then it settles to its own brightness, which sinks a little while it is held.
      const end = f.age < f.hold ? 1 : clamp((f.life - f.age) / Math.max(0.06, Math.min(0.35, (f.life - f.hold) * 0.8)));
      const settle = 0.62 + 0.38 * Math.exp(-f.age / 0.3), base = 0.42 + 0.58 * f.v;
      HALO = strike ? 0.5 + 0.8 * f.v : 0;
      drawScaled(f, clamp(base * (strike ? 1.3 : settle * R(0.7, 1)) * end), strike ? 1.1 + 0.08 * f.v : 1);
    }
    HALO = 0; HAIR = 1;
    lg.setTransform(1, 0, 0, 1, 0, 0);
    gain = R(0.86, 1); if (P < 1) gain = 1 - (1 - gain) * P;    // the projector lamp flickers frame to frame (steadier when turned down)
    bg.globalCompositeOperation = 'copy'; bg.filter = 'blur(3px)'; bg.drawImage(layer, 0, 0, BW, BH); bg.filter = 'none';
    lg.globalCompositeOperation = 'lighter'; lg.globalAlpha = 0.4; lg.drawImage(bloom, 0, 0, LW, LH);   // the light glowing through the scratches
    lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1;
    // Turned down, the film frame itself is darkened: the shared background only fades 12% a picture, so a thin alpha at
    // the drawImage below would build back up to nearly full brightness within a few pictures.
    if (P < 1) { lg.fillStyle = `rgba(0,0,0,${(1 - INKA).toFixed(3)})`; lg.fillRect(0, 0, LW, LH); }
  }

  // Knob pictures.
  const zig = (g, x0, y0, x1, y1, teeth, amp, col, lw) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'miter'; g.beginPath();
    for (let i = 0; i <= teeth; i++) { const t = i / teeth, o = i === 0 || i === teeth ? 0 : (i % 2 ? amp : -amp); const px = x0 + dx * t + nx * o, py = y0 + dy * t + ny * o; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  };

  TOOLS.push({
    id: 'lenlye', name: 'Len Lye', tag: 'v2',
    blurb: 'After Len Lye\'s scratched films: white scratches on black film that boil and jump frame by frame, one mark per note across the film by pitch (bass: tall wriggling pillars; middle: zigzags, coils and rings; treble: little sparks), and loud chords burst into a jagged star with a flash. New in v2: a mark now boils for as long as its note is held, and every note lands as an overexposed, glowing strike before it settles; soft notes are faint broken hairlines, loud ones thick doubled scratches, and high notes sit higher up the film. Added since: a <b>how present</b> knob, to tone it right down: fainter, calmer scratches on cleaner film, mostly on the hardest notes.',
    params: [
      { key: 'wriggle', label: 'how much the lines wriggle', min: 0, max: 2, value: 1.2, drive: '+rate',
        hint: 'How wildly each scratch shakes and jumps from frame to frame. Left: almost steady lines. Right: frantic, boiling scrawl.',
        icon: (g, v, w, h) => { const r = ICON.rng(4), a = 0.3 + v * 8; g.strokeStyle = ICON.ink; g.lineWidth = 1.5; g.beginPath();
          for (let i = 0; i <= 12; i++) { const px = 3 + (i / 12) * (w - 6), py = h / 2 + (r() - 0.5) * 2 * a; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); } },
      { key: 'fps', label: 'how jerky the film runs', min: 6, max: 24, step: 1, value: 12,
        hint: 'How many new film frames are scratched each second (a note always cuts to a new one). Left: slow, jerky stop-motion. Right: fast flicker.',
        icon: (g, v, w, h) => { const n = Math.round(2 + v * 3), cw = (w - 4) / n;
          for (let i = 0; i < n; i++) { const x0 = 2 + i * cw; g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(x0 + 0.5, 3.5, cw - 2, h - 7);
            const t = n === 1 ? 0.5 : i / (n - 1); zig(g, x0 + 2 + t * (cw - 6), 6, x0 + 2 + t * (cw - 6) + 1, h - 6, 3, 1.4, ICON.ink, 1.2); } } },
      { key: 'life', label: 'how long a mark stays after its note', min: 0, max: 2, value: 0.4,
        hint: 'How long a scratch keeps boiling once its note has stopped (it always lasts while the note is held). Left: gone with the note. Right: lingers for seconds.',
        icon: (g, v, w, h) => { const n = 5, st = (w - 4) / n;
          zig(g, 2 + st * 0.5, 4, 2 + st * 0.5, h - 4, 4, 2, ICON.ink, 1.5);
          for (let i = 1; i < n; i++) { const a = Math.max(0, 1 - i / (1 + v * (n - 1))); if (a > 0.02) ICON.alpha(g, a, () => zig(g, 2 + st * (i + 0.5), 4, 2 + st * (i + 0.5), h - 4, 4, 2, ICON.ink, 1.2)); } } },
      { key: 'burst', label: 'bursts on loud chords', min: 0, max: 2, value: 1, drive: '+level',
        hint: 'How big the jagged burst and the flash are when a loud chord is struck. Left: none. Right: a big spiky star.',
        icon: (g, v, w, h) => { if (v < 0.04) { ICON.dot(g, w / 2, h / 2, 1.2, ICON.dim); return; }
          const r = ICON.rng(9), n = Math.round(6 + v * 6), L = 3 + v * 9;
          if (v > 0.5) ICON.rect(g, 0, 0, w, h, `rgba(255,251,243,${((v - 0.5) * 0.3).toFixed(2)})`);
          g.strokeStyle = ICON.ink; g.lineWidth = 1.2; g.lineJoin = 'miter'; g.beginPath();
          for (let i = 0; i <= n * 2; i++) { const th = (i / (n * 2)) * Math.PI * 2, l = (i % 2 ? 0.4 : 1) * L * (0.8 + r() * 0.4); g.lineTo(w / 2 + Math.cos(th) * l, h / 2 + Math.sin(th) * l); }
          g.stroke(); } },
      { key: 'dirt', label: 'scratched, dusty film', min: 0, max: 2, value: 1.2,
        hint: 'How much film dirt runs across the picture: long vertical scratches and dust specks. Left: clean film. Right: battered old print.',
        icon: (g, v, w, h) => { g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(1.5, 1.5, w - 3, h - 3);
          const r = ICON.rng(3), nl = Math.round(v * 4), nd = Math.round(v * 12);
          for (let i = 0; i < nl; i++) { const lx = 4 + r() * (w - 8); ICON.line(g, lx, 2, lx + (r() - 0.5) * 2, h - 2, ICON.ink, 0.8); }
          for (let i = 0; i < nd; i++) ICON.dot(g, 3 + r() * (w - 6), 3 + r() * (h - 6), 0.6 + r() * 0.8, ICON.ink); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: a few faint, calm scratches on almost clean film, mostly on the hardest notes. Right: every note scratches at full strength (as before).',
        icon: (g, v, w, h) => { const n = 1 + Math.round(v * 3), st = (w - 4) / n;
          ICON.alpha(g, 0.2 + 0.8 * v, () => { for (let i = 0; i < n; i++) zig(g, 2 + st * (i + 0.5), 4, 2 + st * (i + 0.5), h - 4, 4, 1 + v * 1.5, ICON.ink, 1 + v * 0.6); }); } },
    ],
    reset() {
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.fillStyle = '#000'; lg.fillRect(0, 0, LW, LH);
      lg.lineCap = 'round'; lg.lineJoin = 'miter'; lg.miterLimit = 5;
      bg.globalCompositeOperation = 'copy'; bg.fillStyle = '#000'; bg.fillRect(0, 0, BW, BH);
      figs = []; dirt = []; acc = 0; cut = false; jump = 0; flash = 0; meanV = 72; lastBurst = -9; lastFlash = -9; time = 0; gain = 1; allVels = null; lastMark = -9;
    },
    onChord(ch, x) {
      let heard = false;
      for (const q of ch.notes) if (hardEnough(q.v, x)) { heard = true; addNote(q, x, ch); }
      // Turned down, a quiet passage keeps a thin thread: after a while with no mark, an above-average attack scratches its
      // loudest note, and after twice that any attack does (a long diminuendo never rises above its own recent average).
      const pres = x.p('presence'), wait = pres < 1 && !heard ? (time - lastMark) / (1 + 2.5 * (1 - pres)) : 0;
      if (wait >= 2 || (wait >= 1 && ch.vel >= meanV)) { heard = true; addNote(ch.notes.reduce((a, q) => (q.v > a.v ? q : a)), x, ch); }
      if (heard) lastMark = time;
      // Loud against the recent music (Beethoven's transcription runs quieter than the Prelude's).
      const loud = ch.vel >= 86 && (ch.vel >= meanV + 14 || (ch.vel >= 95 && ch.notes.length >= 3) || ch.vel >= 104);
      meanV += (ch.vel - meanV) * 0.06;
      if (!heard) return;                                       // turned down: this attack passes the film by
      const b = x.p('burst') * dim(0.5, pres);
      if (loud && b > 0.05 && time - lastBurst > 0.3) {
        lastBurst = time;
        const k = clamp((ch.vel - 80) / 30), mid = ch.notes.reduce((s, q) => s + q.m, 0) / ch.notes.length;
        figs.push({ id: nid++, type: 'burst', v: k, age: 0, hold: 0, life: 0.2 + 0.2 * b, x: clamp(pitchX(mid), LW * 0.2, LW * 0.8), y: R(LH * 0.3, LH * 0.7),
          ph: R(0, TAU), rays: Math.round(9 + 5 * b * (0.5 + k)), len: (60 + 110 * k) * b, w: 2.4 + 2.6 * k, spd: R(-1.5, 1.5) });
        if (time - lastFlash > 0.7) { lastFlash = time; flash = Math.max(flash, 0.12 * Math.min(b, 1) * (0.4 + 0.6 * k)); }
        for (let i = 0; i < 1 + Math.round(b); i++) dirt.push({ x: R(30, LW - 30), vx: R(-8, 8), age: 0, life: R(0.15, 0.5), a: R(0.5, 0.9), w: R(1.4, 3) });
      }
      // Every attack: cut to a new film frame now, and everything on the film jumps.
      cut = true; jump = Math.max(jump, 2 + 6 * J * clamp(ch.vel / 110));
      for (const f of figs) if (f.age > 0) { f.x += R(-1, 1) * 22 * J; f.y += R(-1, 1) * 14 * J; f.ph += R(-0.8, 0.8); }
    },
    frame(x) {
      const g = x.g, dt = x.dt; time += dt;
      P = x.p('presence'); CALM = dim(0.85, P); INKA = dim(0.86, P);
      J = x.p('wriggle') * CALM;
      for (const f of figs) {
        f.age += dt; f.ph += (f.spd || 0) * dt * (0.6 + J);
        if (f.type !== 'pillar') { f.x = clamp(f.x, 30, LW - 30); f.y = clamp(f.y, 30, LH - 30); } else f.x = clamp(f.x, 20, LW - 20);
      }
      figs = figs.filter((f) => f.age < f.life);
      if (figs.length > 70) figs.splice(0, figs.length - 70);
      for (const d of dirt) { d.age += dt; d.x += d.vx * dt; }
      dirt = dirt.filter((d) => d.age < d.life);
      acc += dt;
      const per = 1 / (x.p('fps') * dim(0.7, P));
      if (cut || (dt > 0 && acc >= per)) { cut = false; acc = acc >= per ? acc % per : 0; filmFrame(x); }
      g.globalCompositeOperation = 'lighten'; g.globalAlpha = gain;
      g.drawImage(layer, 0, 0, x.W, x.H);
      g.globalAlpha = 1;
    },
  });
})();
