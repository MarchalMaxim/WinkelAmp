// Len Lye (after his scratched films, Free Radicals): white scratches on black film. The picture is held for one
// "film frame" and then scratched again from scratch, so every mark boils and jumps frame by frame; an attack cuts
// to a new frame at once and the marks jump with it. One mark per note, across the film by pitch: the bass makes
// tall wriggling pillars, the middle zigzags and coils, the treble small sparks; a loud chord bursts into jagged rays
// with a grey flash. Film dirt (long vertical scratches, dust) runs throughout and thickens with the music.
(() => {
  const LW = 1280, LH = 720, TAU = Math.PI * 2;
  const layer = document.createElement('canvas'); layer.width = LW; layer.height = LH; const lg = layer.getContext('2d');
  const R = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const INK = '255,251,243';

  let figs = [], dirt = [], acc = 0, cut = false, jump = 0, flash = 0, meanV = 72, lastBurst = -9, lastFlash = -9, time = 0, J = 1, nid = 0;

  const pitchX = (m) => LW * (0.07 + 0.86 * clamp((m - 30) / 66)) + R(-55, 55);

  // One scratch: a faint wide glow, the white line itself (with the odd break in the emulsion), and a ragged hair beside it.
  function trace(pts, gap) {
    lg.beginPath(); lg.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) (gap && Math.random() < gap ? lg.moveTo : lg.lineTo).call(lg, pts[k], pts[k + 1]);
  }
  function scratch(pts, w, a, gap = 0.04) {
    if (pts.length < 4 || a <= 0.01) return;
    lg.strokeStyle = `rgba(${INK},${(a * 0.13).toFixed(3)})`; lg.lineWidth = w * 3.4 + 3; trace(pts, 0); lg.stroke();
    lg.strokeStyle = `rgba(${INK},${a.toFixed(3)})`; lg.lineWidth = w; trace(pts, gap); lg.stroke();
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
    const n = (2 + 7 * J) * (0.45 + 0.55 * f.v);
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
      scratch(q, f.w / Math.sqrt(f.strands), a * (s ? 0.7 : 1));
    }
  }

  function addNote(q, x) {
    const v = 0.3 + 0.7 * clamp(q.v / 115), m = q.m;
    // sparse music (Beethoven's orchestra, the oboe) lets a mark boil longer, so the film never goes blank between knocks
    const life = (0.25 + Math.min(3, q.d) * 0.8) * x.p('life') * (1 + 1.5 * (1 - x.feat.rate));
    const f = { id: nid++, m, v, age: 0, life: Math.max(life, 0.2), x: pitchX(m), y: R(LH * 0.2, LH * 0.8), ph: R(0, TAU), spin: R(-0.6, 0.6) };
    if (m < 46) {
      Object.assign(f, { type: 'pillar', y0: R(LH * 0.02, LH * 0.2), y1: R(LH * 0.8, LH * 0.98), k: R(0.006, 0.02), amp: R(10, 34) * (0.5 + v),
        zz: R(0.5, 2.5), w: 3 + 4.5 * v, strands: 2, spd: R(1, 3) });
    } else if (m < 62) {
      if (Math.random() < 0.25) Object.assign(f, { type: 'ring', r: R(18, 55) * (0.6 + 0.7 * v), ell: R(0.35, 1), w: 2 + 2.6 * v, strands: 1, spd: R(0.3, 1.2) });
      else Object.assign(f, { type: 'zig', ang: Math.PI / 2 + R(-0.5, 0.5), len: R(110, 300) * (0.6 + 0.6 * v), teeth: 9 + Math.floor(R(0, 8)),
        tooth: R(8, 20), w: 2.2 + 3 * v, strands: Math.random() < 0.4 ? 2 : 1, spd: 0 });
    } else if (m < 77) {
      Object.assign(f, { type: 'coil', ang: Math.PI / 2 + R(-0.8, 0.8), len: R(70, 190) * (0.7 + 0.5 * v), loops: 3 + Math.floor(R(0, 4)),
        r: R(10, 24) * (0.7 + 0.6 * v), w: 2 + 2.4 * v, strands: 1, spd: R(2, 6) });
      f.y = R(LH * 0.15, LH * 0.7);
    } else {
      Object.assign(f, { type: 'spark', sub: Math.floor(R(0, 3)), s: R(10, 24) * (0.7 + 0.6 * v), rays: 4 + Math.floor(R(0, 4)), w: 1.8 + 1.8 * v, spd: R(0.5, 2) });
      f.y = R(LH * 0.1, LH * 0.55);
    }
    if (f.type === 'zig') f.tooth = Math.min(f.tooth, 0.7 * f.len / f.teeth);
    figs.push(f);
  }

  // Film dirt: long vertical scratches that come and go, and dust specks scattered fresh on every frame.
  function drawDirt(x) {
    const amt = x.p('dirt'), want = Math.round(amt * (1 + 2.5 * x.feat.density + 2 * x.feat.level));
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

  // One film frame: wipe the layer, weave the gate a little, scratch every live mark again.
  function filmFrame(x) {
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.fillStyle = '#000'; lg.fillRect(0, 0, LW, LH);
    if (flash > 0.01) { lg.fillStyle = `rgba(${INK},${flash.toFixed(3)})`; lg.fillRect(0, 0, LW, LH); flash *= 0.25; }
    const weave = 1 + 2.5 * J + jump;
    lg.setTransform(1, 0, 0, 1, R(-weave, weave), R(-weave, weave) * 0.6);
    jump = 0;
    drawDirt(x);
    for (const f of figs) {
      if (f.age >= f.life || Math.random() < 0.07) continue;   // dropped frames: a mark blinks out now and then
      const end = clamp((f.life - f.age) / Math.min(0.35, f.life * 0.5)), fresh = f.age < 0.06 ? 1.15 : 1;
      drawFig(f, clamp((0.5 + 0.5 * f.v) * R(0.65, 1) * end * fresh));
    }
    lg.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Knob pictures.
  const zig = (g, x0, y0, x1, y1, teeth, amp, col, lw) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'miter'; g.beginPath();
    for (let i = 0; i <= teeth; i++) { const t = i / teeth, o = i === 0 || i === teeth ? 0 : (i % 2 ? amp : -amp); const px = x0 + dx * t + nx * o, py = y0 + dy * t + ny * o; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  };

  TOOLS.push({
    id: 'lenlye', name: 'Len Lye', tag: 'new',
    blurb: 'After Len Lye\'s scratched films: white scratches on black film that boil and jump frame by frame. Every note scratches a mark across the film by pitch (bass: tall wriggling pillars; middle: zigzags, coils and rings; treble: little sparks), every attack cuts to a new frame, the wriggle follows how fast the notes come, and loud chords burst into a jagged, spinning star with a flash.',
    params: [
      { key: 'wriggle', label: 'how much the lines wriggle', min: 0, max: 2, value: 0.8, drive: '+rate',
        hint: 'How wildly each scratch shakes and jumps from frame to frame. Left: almost steady lines. Right: frantic, boiling scrawl.',
        icon: (g, v, w, h) => { const r = ICON.rng(4), a = 0.3 + v * 8; g.strokeStyle = ICON.ink; g.lineWidth = 1.5; g.beginPath();
          for (let i = 0; i <= 12; i++) { const px = 3 + (i / 12) * (w - 6), py = h / 2 + (r() - 0.5) * 2 * a; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); } },
      { key: 'fps', label: 'how jerky the film runs', min: 6, max: 24, step: 1, value: 12,
        hint: 'How many new film frames are scratched each second (a note always cuts to a new one). Left: slow, jerky stop-motion. Right: fast flicker.',
        icon: (g, v, w, h) => { const n = Math.round(2 + v * 3), cw = (w - 4) / n;
          for (let i = 0; i < n; i++) { const x0 = 2 + i * cw; g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(x0 + 0.5, 3.5, cw - 2, h - 7);
            const t = n === 1 ? 0.5 : i / (n - 1); zig(g, x0 + 2 + t * (cw - 6), 6, x0 + 2 + t * (cw - 6) + 1, h - 6, 3, 1.4, ICON.ink, 1.2); } } },
      { key: 'life', label: 'how long a mark stays', min: 0.2, max: 2.5, value: 0.8,
        hint: 'How long a note\'s scratch keeps boiling after it is struck (it follows the note\'s length). Left: a single flick. Right: lingers for seconds.',
        icon: (g, v, w, h) => { const life = 0.1 + 0.9 * v, n = 5, st = (w - 4) / n;
          for (let i = 0; i < n; i++) { const a = Math.max(0, 1 - (i / (n - 1)) / life); if (a > 0) ICON.alpha(g, a, () => zig(g, 2 + st * (i + 0.5), 4, 2 + st * (i + 0.5), h - 4, 4, 2, ICON.ink, 1.3)); } } },
      { key: 'burst', label: 'bursts on loud chords', min: 0, max: 2, value: 1, drive: '+level',
        hint: 'How big the jagged burst and the flash are when a loud chord is struck. Left: none. Right: a big spiky star.',
        icon: (g, v, w, h) => { if (v < 0.04) { ICON.dot(g, w / 2, h / 2, 1.2, ICON.dim); return; }
          const r = ICON.rng(9), n = Math.round(6 + v * 6), L = 3 + v * 9;
          if (v > 0.5) ICON.rect(g, 0, 0, w, h, `rgba(255,251,243,${((v - 0.5) * 0.3).toFixed(2)})`);
          g.strokeStyle = ICON.ink; g.lineWidth = 1.2; g.lineJoin = 'miter'; g.beginPath();
          for (let i = 0; i <= n * 2; i++) { const th = (i / (n * 2)) * Math.PI * 2, l = (i % 2 ? 0.4 : 1) * L * (0.8 + r() * 0.4); g.lineTo(w / 2 + Math.cos(th) * l, h / 2 + Math.sin(th) * l); }
          g.stroke(); } },
      { key: 'dirt', label: 'scratched, dusty film', min: 0, max: 2, value: 1,
        hint: 'How much film dirt runs across the picture: long vertical scratches and dust specks. Left: clean film. Right: battered old print.',
        icon: (g, v, w, h) => { g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(1.5, 1.5, w - 3, h - 3);
          const r = ICON.rng(3), nl = Math.round(v * 4), nd = Math.round(v * 12);
          for (let i = 0; i < nl; i++) { const lx = 4 + r() * (w - 8); ICON.line(g, lx, 2, lx + (r() - 0.5) * 2, h - 2, ICON.ink, 0.8); }
          for (let i = 0; i < nd; i++) ICON.dot(g, 3 + r() * (w - 6), 3 + r() * (h - 6), 0.6 + r() * 0.8, ICON.ink); } },
    ],
    reset() {
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.fillStyle = '#000'; lg.fillRect(0, 0, LW, LH);
      lg.lineCap = 'round'; lg.lineJoin = 'miter'; lg.miterLimit = 5;
      figs = []; dirt = []; acc = 0; cut = false; jump = 0; flash = 0; meanV = 72; lastBurst = -9; lastFlash = -9; time = 0;
    },
    onChord(ch, x) {
      for (const q of ch.notes) addNote(q, x);
      // Loud against the recent music (Beethoven's transcription runs quieter than the Prelude's).
      const loud = ch.vel >= 86 && (ch.vel >= meanV + 14 || (ch.vel >= 95 && ch.notes.length >= 3) || ch.vel >= 104);
      meanV += (ch.vel - meanV) * 0.06;
      const b = x.p('burst');
      if (loud && b > 0.05 && time - lastBurst > 0.3) {
        lastBurst = time;
        const k = clamp((ch.vel - 80) / 30), mid = ch.notes.reduce((s, q) => s + q.m, 0) / ch.notes.length;
        figs.push({ id: nid++, type: 'burst', v: k, age: 0, life: 0.2 + 0.2 * b, x: clamp(pitchX(mid), LW * 0.2, LW * 0.8), y: R(LH * 0.3, LH * 0.7),
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
      J = x.p('wriggle');
      for (const f of figs) {
        f.age += dt; f.ph += (f.spd || 0) * dt * (0.6 + J);
        if (f.type !== 'pillar') { f.x = clamp(f.x, 30, LW - 30); f.y = clamp(f.y, 30, LH - 30); } else f.x = clamp(f.x, 20, LW - 20);
      }
      figs = figs.filter((f) => f.age < f.life);
      if (figs.length > 70) figs.splice(0, figs.length - 70);
      for (const d of dirt) { d.age += dt; d.x += d.vx * dt; }
      dirt = dirt.filter((d) => d.age < d.life);
      acc += dt;
      const per = 1 / x.p('fps');
      if (cut || acc >= per) { cut = false; acc = acc >= per ? acc % per : 0; filmFrame(x); }
      g.globalCompositeOperation = 'lighten';
      g.drawImage(layer, 0, 0, x.W, x.H);
    },
  });
})();
