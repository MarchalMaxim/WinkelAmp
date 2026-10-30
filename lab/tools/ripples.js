// Ripples v2: abstract wavefronts. Each note sends a ring whose shape is set by its pitch class (circle, squircle,
// n-gon or star, n from the pitch class), coloured by pitch class or register. Chords send concentric families from
// one origin; short notes (relative to the song) send broken, dashed rings; low notes send slow heavy fronts that bend
// every other ring they pass through. Where leading rings cross, the crossing glows and leaves a fading trace.
(() => {
  const TAU = Math.PI * 2, lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // a white glow sprite for the nodes and the attack flash
  const glint = document.createElement('canvas'); glint.width = glint.height = 64;
  { const q = glint.getContext('2d'), gr = q.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    q.fillStyle = gr; q.fillRect(0, 0, 64, 64); }
  // the interference trace: half-res layer that fades slowly, so crossing points draw their curves
  const TW = 640, TH = 360, trace = document.createElement('canvas'); trace.width = TW; trace.height = TH;
  const tg = trace.getContext('2d');

  let drops = [], durs = [], nid = 0, last = new Map();
  const SIDES = [3, 5, 4, 6, 3, 7, 4, 5, 8, 3, 6, 4]; // pitch class → sides (neighbours on the circle of fifths differ)
  const fifth = (pc) => (pc * 7) % 12; // position on the circle of fifths

  // radius multiplier at polar angle phi for a ring: circle (0) → squircle (1) → n-gon (2) → n-star (3)
  function shapeR(phi, geom, n) {
    if (geom <= 0.001) return 1;
    if (geom < 1) { const c = Math.abs(Math.cos(phi)), s = Math.abs(Math.sin(phi)); return lerp(1, Math.pow(c ** 4 + s ** 4, -0.25), geom); }
    const c = Math.abs(Math.cos(phi)), s = Math.abs(Math.sin(phi)), sq = Math.pow(c ** 4 + s ** 4, -0.25);
    const inner = geom < 2 ? Math.cos(Math.PI / n) : lerp(Math.cos(Math.PI / n), 0.42, geom - 2);
    const al = Math.PI / n; let f = phi % (2 * al); if (f < 0) f += 2 * al;
    let r1 = 1, r2 = inner, psi = f; if (f > al) { r1 = inner; r2 = 1; psi = f - al; }
    const poly = (r1 * r2 * Math.sin(al)) / (r1 * Math.sin(psi) + r2 * Math.sin(al - psi));
    return geom < 2 ? lerp(sq, poly, geom - 1) : poly;
  }
  // colour per note: [h, s, l]
  function colour(pal, m, p) {
    const pc = ((m % 12) + 12) % 12;
    if (pal === 0) return [(fifth(pc) * 30 + 200) % 360, 52, lerp(46, 70, p)]; // circle of fifths around the wheel
    if (pal === 1) return [lerp(228, 186, p), 70, lerp(46, 78, p)];           // ice: deep blue low, pale cyan high
    if (pal === 2) return [(352 + 52 * Math.pow(p, 0.8)) % 360, 84, lerp(44, 66, p)]; // ember: blood red low, amber high
    return [32, 14, lerp(36, 66, p)];                                            // bone: warm white
  }
  // origin of a note: pitch→x (0), centre (1), circle of fifths (2), blended continuously
  function origin(x, layout, m, v) {
    const p = x.pitch01(m), pc = ((m % 12) + 12) % 12, ang = fifth(pc) * (TAU / 12) - Math.PI / 2;
    const ax = x.W * lerp(0.08, 0.92, p), ay = x.H * (0.5 + (0.55 - v / 127) * 0.6);
    const rc = 26 + 14 * p, cx = x.W / 2 + Math.cos(ang) * rc, cy = x.H / 2 + Math.sin(ang) * rc;
    const rf = x.H * lerp(0.1, 0.44, p), fx = x.W / 2 + Math.cos(ang) * rf * 1.25, fy = x.H / 2 + Math.sin(ang) * rf;
    if (layout <= 1) return [lerp(ax, cx, layout), lerp(ay, cy, layout)];
    return [lerp(cx, fx, layout - 1), lerp(cy, fy, layout - 1)];
  }

  TOOLS.push({
    id: 'ripples', name: 'Ripples', tag: 'v2',
    blurb: 'Every note sends out a wavefront from its place on a circle of fifths: a polygon whose sides and tilt come from its pitch class (the shape slider goes circle, squircle, polygon, star), ember red low to amber high. Chords send concentric families, the shortest notes break into dashes, bass notes push slow heavy fronts that bend the others, and where fronts cross the crossing glows and draws its path.',
    params: [
      { key: 'geom', label: 'shape: ○ ▢ ⬠ ✶', min: 0, max: 3, value: 2 },
      { key: 'layout', label: 'origin: x · centre · 5ths', min: 0, max: 2, value: 2 },
      { key: 'palette', label: 'colour: 5ths ice ember bone', min: 0, max: 3, step: 1, value: 2 },
      { key: 'speed', label: 'speed', min: 0.3, max: 3, value: 0.8, drive: '+rate' },
      { key: 'decay', label: 'fade time', min: 0.3, max: 3, value: 1.3, drive: '-density' },
      { key: 'echo', label: 'echo rings', min: 1, max: 6, step: 1, value: 2 },
      { key: 'dash', label: 'staccato breaks', min: 0, max: 1, value: 0.2 },
      { key: 'warp', label: 'bass warp', min: 0, max: 3, value: 0.9, drive: '+bass' },
      { key: 'glow', label: 'node glow', min: 0, max: 1.6, value: 0.6, drive: '+level' },
      { key: 'family', label: 'chord family', min: 0, max: 1, value: 0.75 },
    ],
    reset() { drops = []; durs = []; last = new Map(); tg.globalCompositeOperation = 'source-over'; tg.fillStyle = '#000'; tg.fillRect(0, 0, TW, TH); },
    onChord(ch, x) {
      const decay = x.p('decay'), geom = x.p('geom'), layout = x.p('layout'), pal = Math.round(x.p('palette')), fam = x.p('family'), dashP = x.p('dash');
      const pts = ch.notes.map((n) => origin(x, layout, n.m, n.v));
      // a family's shared origin: velocity-weighted mean of its notes' origins
      let sx = 0, sy = 0, sw = 0; ch.notes.forEach((n, i) => { sx += pts[i][0] * n.v; sy += pts[i][1] * n.v; sw += n.v; });
      const fx = sx / sw, fy = sy / sw, many = ch.notes.length >= 2;
      ch.notes.forEach((n, i) => {
        // shortness relative to the song so far: a transcribed orchestra is all short, a piano mostly long
        let below = 0; for (const d of durs) if (d < n.d) below++;
        const rank = durs.length > 8 ? below / durs.length : clamp(n.d / 1.2, 0, 1);
        durs.push(n.d); if (durs.length > 80) durs.shift();
        const p = x.pitch01(n.m), v = 0.45 + 0.55 * Math.min(1.2, n.v / 100), pc = ((n.m % 12) + 12) % 12;
        const k = many ? fam : 0, heavy = n.m < 48;
        const dashed = rank < dashP;
        drops.push({
          id: nid++, x: lerp(pts[i][0], fx, k), y: lerp(pts[i][1], fy, k), p, v, m: n.m, heavy,
          R: lerp(760, 80, Math.pow(p, 0.7)) * (0.55 + 0.45 * v),    // how far it travels
          base: lerp(5.2, 0.8, Math.pow(p, 0.6)),                       // seconds it lives at fade time 1
          life: lerp(5.2, 0.8, Math.pow(p, 0.6)) * decay,
          w: (heavy ? 9 : lerp(3.2, 1.1, p)) * (0.6 + 0.5 * v),          // stroke weight
          n: SIDES[pc], rot: fifth(pc) * (TAU / 12) + x.rnd(-0.08, 0.08), spin: (pc % 2 ? 1 : -1) * lerp(0.03, 0.22, p),
          geom: heavy ? Math.min(geom, 0.6) : geom, col: colour(pal, n.m, p),
          dashed, duty: lerp(0.62, 0.22, clamp(1 - rank / Math.max(0.01, dashP), 0, 1)),
          r0: 6 + 16 * v * (1 - p), ph: 0, age: 0,
        });
      });
      if (drops.length > 150) { drops.sort((a, b) => b.v * (1 - b.age / b.life) - a.v * (1 - a.age / a.life)); drops.length = 150; }
    },
    frame(x) {
      const g = x.g, dt = x.dt;
      const speed = x.p('speed'), echo = Math.round(x.p('echo')), warpK = x.p('warp'), glow = x.p('glow');

      // advance; collect the live heavy fronts (the 4 strongest) that bend the others
      const heavies = [];
      for (const d of drops) {
        d.age += dt; d.ph += dt * speed * (d.heavy ? 0.55 : 1) * 2.6 / d.base;
        d.r = d.r0 + d.R * (1 - Math.exp(-d.ph));
        d.amp = d.v * Math.pow(Math.max(0, 1 - d.age / d.life), 1.3);
        if (d.heavy && d.amp > 0.05) heavies.push(d);
      }
      heavies.sort((a, b) => b.amp - a.amp); heavies.length = Math.min(4, heavies.length);
      const warpAt = (px, py, self) => {
        let ox = 0, oy = 0;
        for (const h of heavies) {
          if (h === self) continue;
          const dx = px - h.x, dy = py - h.y, dd = Math.sqrt(dx * dx + dy * dy) + 1e-3, del = (dd - h.r) / (40 + h.r * 0.12);
          if (del > 3 || del < -3) continue;
          const push = warpK * h.amp * 34 * Math.exp(-del * del) * (del < 0 ? 0.6 : 1);
          ox += (dx / dd) * push; oy += (dy / dd) * push;
        }
        return [ox, oy];
      };

      const dim = Math.min(1, 24 / Math.max(1, drops.length));
      g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
      const lead = [];
      for (const d of drops) {
        if (d.amp <= 0.01) continue;
        const [h, s, l] = d.col, rot = d.rot + d.spin * d.age;
        const rings = d.p > 0.55 ? 1 : echo + (d.heavy ? 1 : 0), gap = lerp(34, 9, d.p) * (d.heavy ? 1.6 : 1);
        for (let i = 0; i < rings; i++) {
          const ri = d.r - i * gap * (1 + d.ph * 0.3);
          if (ri <= 2) break;
          const al = d.amp * (i === 0 ? 0.8 : 0.45 / i) * (0.55 + 0.45 * dim);
          // samples: a multiple of the sides, so polygon corners stay sharp
          const per = Math.max(2, Math.ceil(clamp(ri / (d.geom < 1.5 ? 5 : 9), 16, d.geom < 1.5 ? 110 : 64) / d.n)), N = d.n * per;
          const P = d.dashed ? d.n * 2 : 0; // dashes: two per side
          g.beginPath();
          let pen = false;
          for (let j = 0; j <= N; j++) {
            const ph = (j / N) * TAU;
            if (P) { const f = ((j / N) * P + d.age * 0.6) % 1; if (f > d.duty) { pen = false; continue; } }
            const rr = ri * shapeR(ph, d.geom, d.n), a = ph + rot;
            let px = d.x + Math.cos(a) * rr, py = d.y + Math.sin(a) * rr;
            if (heavies.length && warpK > 0) { const o = warpAt(px, py, d); px += o[0]; py += o[1]; }
            if (pen) g.lineTo(px, py); else { g.moveTo(px, py); pen = true; }
          }
          if (d.heavy && i === 0) { // a heavy front: a wide dim body under the bright line
            g.strokeStyle = `hsla(${h},${s}%,${l * 0.6}%,${(al * 0.35).toFixed(3)})`;
            g.lineWidth = d.w * 3.2 * (0.4 + 0.6 * d.amp); g.stroke();
          }
          g.strokeStyle = `hsla(${h},${s}%,${l}%,${al.toFixed(3)})`;
          g.lineWidth = Math.max(0.6, d.w * (i === 0 ? 1 : 0.55) * (0.45 + 0.55 * d.amp));
          g.stroke();
        }
        // the attack: the note's own shape, filled, flashing at its origin
        if (d.age < 0.16) {
          const k = 1 - d.age / 0.16, rr = (10 + 34 * (1 - d.p)) * d.v;
          g.fillStyle = `hsla(${h},${s}%,${Math.min(90, l + 15)}%,${(0.8 * k).toFixed(3)})`;
          g.beginPath();
          for (let j = 0; j <= d.n * 4; j++) { const ph = (j / (d.n * 4)) * TAU, r = rr * shapeR(ph, d.geom, d.n); g.lineTo(d.x + Math.cos(ph + rot) * r, d.y + Math.sin(ph + rot) * r); }
          g.fill();
          const sg = rr * 1.4 * k; g.globalAlpha = 0.7 * k; g.drawImage(glint, d.x - sg, d.y - sg, sg * 2, sg * 2); g.globalAlpha = 1;
        }
        if (d.amp > 0.15 && !d.dashed) lead.push(d);
      }

      // interference: where two leading fronts cross, a glowing node (and its trace)
      lead.sort((a, b) => b.amp * b.r - a.amp * a.r); if (lead.length > 16) lead.length = 16;
      const fade = 1 - Math.pow(0.5, dt / 0.55);
      tg.globalCompositeOperation = 'source-over'; tg.fillStyle = `rgba(0,0,0,${fade.toFixed(3)})`; tg.fillRect(0, 0, TW, TH);
      tg.globalCompositeOperation = 'color-burn'; tg.fillStyle = 'rgb(252,252,252)'; tg.fillRect(0, 0, TW, TH); // last few levels to black
      tg.globalCompositeOperation = 'lighter';
      const seen = new Map();
      if (glow > 0.02) {
        const proj = (d, px, py) => { // radial projection onto d's (unwarped) shape
          const a = Math.atan2(py - d.y, px - d.x), rot = d.rot + d.spin * d.age, r = d.r * shapeR(a - rot, d.geom, d.n);
          return [d.x + Math.cos(a) * r, d.y + Math.sin(a) * r];
        };
        let budget = 90; tg.lineCap = 'round';
        const ndim = Math.min(1, 18 / Math.max(1, lead.length));
        for (let i = 0; i < lead.length && budget > 0; i++) {
          const A = lead[i];
          for (let j = i + 1; j < lead.length && budget > 0; j++) {
            const B = lead[j], dx = B.x - A.x, dy = B.y - A.y, d2 = dx * dx + dy * dy;
            const sr = A.r + B.r; if (d2 > sr * sr * 1.1 || d2 < 4) continue;
            const dr = A.r - B.r; if (d2 < dr * dr * 0.8) continue;
            const e = A.amp * B.amp; if (e < 0.03) continue; budget--;
            const dd = Math.sqrt(d2), aa = (A.r * A.r - B.r * B.r + d2) / (2 * dd), hh = Math.sqrt(Math.max(0, A.r * A.r - aa * aa));
            const mx = A.x + (dx * aa) / dd, my = A.y + (dy * aa) / dd;
            const hue = (A.col[0] + B.col[0]) / 2 + (Math.abs(A.col[0] - B.col[0]) > 180 ? 180 : 0);
            const nodes = [];
            for (const sgn of [1, -1]) {
              const key = (A.id * 100000 + B.id) * 2 + (sgn > 0 ? 1 : 0);
              let px = mx + (sgn * hh * -dy) / dd, py = my + (sgn * hh * dx) / dd;
              for (let it = 0; it < 3; it++) { [px, py] = proj(A, px, py); [px, py] = proj(B, px, py); }
              const q = proj(A, px, py); if (Math.abs(q[0] - px) + Math.abs(q[1] - py) > 6) continue; // didn't converge: skip
              if (heavies.length && warpK > 0) { const o = warpAt(px, py, null); px += o[0]; py += o[1]; }
              if (px < -20 || py < -20 || px > x.W + 20 || py > x.H + 20) continue;
              nodes.push([px, py]);
              const o = last.get(key); seen.set(key, [px, py]);
              // a crossing that races along (near-tangent fronts) only draws its trace, so it doesn't smear into sparks
              const mv = o ? Math.abs(o[0] - px) + Math.abs(o[1] - py) : 0, still = 1 / (1 + mv / 9);
              const sz = (4 + 12 * Math.min(1, e)) * glow;
              g.globalAlpha = Math.min(1, (0.25 + e) * (0.25 + 0.75 * ndim) * still);
              g.drawImage(glint, px - sz, py - sz, sz * 2, sz * 2);
              g.fillStyle = `hsla(${hue},80%,62%,${Math.min(0.3, e * 0.3 * glow * still * ndim).toFixed(3)})`;
              g.beginPath(); g.arc(px, py, sz * 1.2, 0, TAU); g.fill();
              g.globalAlpha = 1;
              // the trace: a line from where this crossing was last frame, so its path draws a curve
              if (o && Math.abs(o[0] - px) + Math.abs(o[1] - py) < 30) {
                tg.strokeStyle = `hsla(${hue},65%,70%,${Math.min(0.9, (0.25 + e) * glow * 0.55).toFixed(3)})`;
                tg.lineWidth = 0.6 + 1.4 * Math.min(1, e);
                tg.beginPath(); tg.moveTo(o[0] / 2, o[1] / 2); tg.lineTo(px / 2, py / 2); tg.stroke();
              }
            }
            // the chord between a pair's two crossings: a faint line
            if (nodes.length === 2 && glow > 0.4) {
              g.strokeStyle = `hsla(${hue},60%,75%,${Math.min(0.35, e * 0.3 * (glow - 0.4)).toFixed(3)})`; g.lineWidth = 0.8;
              g.beginPath(); g.moveTo(nodes[0][0], nodes[0][1]); g.lineTo(nodes[1][0], nodes[1][1]); g.stroke();
            }
          }
        }
      }
      last = seen;
      g.globalAlpha = 0.85; g.drawImage(trace, 0, 0, x.W, x.H); g.globalAlpha = 1;
      drops = drops.filter((d) => d.age < d.life && d.r < 2400);
    },
  });
})();
