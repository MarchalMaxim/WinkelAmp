// Nap: the black canvas is velvet. Each note strokes one long tilted band of pile into it, with toothed edges of cut fibre and a
// burst of bone hairs on its attack step. Stroking the same note again turns its band off; where bands cross the pile cancels to black.
// Drawn statelessly from CHORDS (docs/mockups/nature/plans/nap.md). No SNAP block: the body is a held field, not an envelope.
(() => {
  const HOLD = 0.033, BONE = [236, 226, 208];
  const flash = (t) => t < 0 ? 0 : t < HOLD ? 1 : Math.pow(0.5, (t - HOLD) / 0.06);   // used only to pick the attack steps (flash === 1)
  const tone = (g, rgb, k = 1) => {
    g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
  };
  const W = 1280, H = 720, DEG = Math.PI / 180, TS = 512;
  const FL = [1, 0.72, 0.5, 0.35], HL = [0.55, 0.78, 1];
  const CLOTH = [
    { field: [[84, 14, 18], [124, 32, 38], [164, 92, 96]], hot: [[176, 36, 40], [224, 110, 104], [240, 214, 198]] },   // oxblood
    { field: [[22, 50, 18], [46, 88, 34], [128, 164, 96]], hot: [[70, 140, 50], [130, 196, 96], [226, 236, 196]] },     // moss
    { field: [[22, 32, 50], [46, 66, 98], [126, 146, 180]], hot: [[60, 96, 160], [120, 156, 210], [214, 226, 240]] },   // slate
  ];

  const mb = (seed) => {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  const h = (a, b) => mb(((a * 73856093) ^ (b * 19349663)) >>> 0)();

  // ---- band outline and hairs, cached by pitch, velocity bucket and the knobs that shape them ----
  const frameOf = (m, ub, width, slant) => {
    const q = Math.min(1, Math.max(0, (m - 21) / 87));
    const th = (((m * 7) % 12) - 5.5) / 5.5 * 28 * DEG * slant;
    const w = (46 + 90 * ub) * (1.3 - 0.6 * q) * width;
    const len = H * (1.05 - 0.40 * q + 0.10 * (h(m, 2) - 0.5));
    const B = (h(m, 3) - 0.5) * 2 * 0.08 * w;
    const cx = W * (0.06 + 0.88 * q), cy = H * (0.5 + 0.16 * (h(m, 1) - 0.5));
    const ax = Math.sin(th), ay = -Math.cos(th), bx = Math.cos(th), by = Math.sin(th);
    const bow = (v) => B * (1 - (2 * v / len) * (2 * v / len));
    const map = (s, v, out, i) => { const o = s + bow(v); out[i] = cx + v * ax + o * bx; out[i + 1] = cy + v * ay + o * by; };
    return { w, len, map };
  };
  const outlines = new Map(), hairCache = new Map();
  const outline = (m, ub, width, slant) => {
    const key = `${m}|${ub}|${width}|${slant}`;
    let o = outlines.get(key); if (o) return o;
    if (outlines.size > 256) outlines.clear();
    const f = frameOf(m, ub, width, slant), w2 = f.w / 2, L2 = f.len / 2;
    const k0 = Math.ceil(-f.len / 12), k1 = Math.floor(f.len / 12);
    const clampV = (v) => Math.max(-L2, Math.min(L2, v));
    const pts = [], t = [0, 0];
    const add = (s, v) => { f.map(s, v, t, 0); pts.push(t[0], t[1]); };
    add(w2, -L2);
    for (let k = k0; k <= k1; k++) {
      const d = 3 + 6 * h(m, 1000 + k * 2 + 1), v = 6 * k;
      add(w2, v); add(w2 + d, clampV(v + 3 + 0.5 * d));
    }
    add(w2, L2); add(-w2, L2);
    for (let k = k1; k >= k0; k--) {
      const d = 3 + 6 * h(m, 1000 + k * 2), v = 6 * k;
      add(-w2, v); add(-w2 - d, clampV(v - 3 - 0.5 * d));
    }
    add(-w2, -L2);
    o = new Float32Array(pts); outlines.set(key, o); return o;
  };
  const hairs = (m, ub, dir, width, slant) => {
    const key = `${m}|${ub}|${dir}|${width}|${slant}`;
    let o = hairCache.get(key); if (o) return o;
    if (hairCache.size > 256) hairCache.clear();
    const f = frameOf(m, ub, width, slant), r = mb(m * 7919 + (dir > 0 ? 1 : 2) * 104729), U = (a, b) => a + (b - a) * r();
    const out = new Float32Array(360 * 6), root = [0, 0];
    for (let i = 0; i < 360; i++) {
      const grp = (i / 120) | 0, v = U(-f.len / 2, f.len / 2);
      const s = grp === 2 ? U(-f.w / 2, f.w / 2) : (grp === 0 ? 1 : -1) * (f.w / 2 + U(-2, 6));
      f.map(s, v, root, 0);
      const l = 10 + 16 * r(), rw = 1.5 + 1.5 * r(), phi = ((dir > 0 ? -45 : 135) + U(-15, 15)) * DEG;
      const nx = -Math.sin(phi), ny = Math.cos(phi), j = i * 6;
      out[j] = root[0] + nx * rw / 2; out[j + 1] = root[1] + ny * rw / 2;
      out[j + 2] = root[0] - nx * rw / 2; out[j + 3] = root[1] - ny * rw / 2;
      out[j + 4] = root[0] + l * Math.cos(phi); out[j + 5] = root[1] + l * Math.sin(phi);
    }
    hairCache.set(key, out); return out;
  };

  // ---- the pile tile: baked opaque on black, in real dim tones, one field and one hot tile per cloth, then their levels ----
  const canvas = (S) => { const c = document.createElement('canvas'); c.width = Math.round(TS * S); c.height = Math.round(TS * S); return c; };
  const bakePile = (cols, S) => {
    const c = canvas(S), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.setTransform(S, 0, 0, S, 0, 0);
    const r = mb(0x4e4150), U = (a, b) => a + (b - a) * r();
    const GB = [0.75, 0.88, 1], hs = [];
    for (let i = 0; i < 26000; i++) {
      const rx = r() * TS, ry = r() * TS, l = 5 + 6 * r(), rw = 1.4 + 1.0 * r(), phi = (-55 + U(-8, 8)) * DEG, gb = (r() * 3) | 0;
      hs.push({ rx, ry, l, rw, c: Math.cos(phi), s: Math.sin(phi), gb });
    }
    // piece p: A 0..0.5 (rw..rw/2), B 0.5..0.8 (rw/2..rw/5), C 0.8..1 (rw/5..point)
    const P = [[0, 0.5, 1, 0.5], [0.5, 0.8, 0.5, 0.2], [0.8, 1, 0.2, 0]];
    for (let p = 0; p < 3; p++) for (let gi = 0; gi < 3; gi++) {
      const col = cols[p], k = GB[gi];
      g.fillStyle = `rgb(${Math.round(col[0] * k)},${Math.round(col[1] * k)},${Math.round(col[2] * k)})`;
      g.beginPath();
      const [f0, f1, w0, w1] = P[p];
      for (const q of hs) {
        if (q.gb !== gi) continue;
        const ox = q.rx < 12 ? [0, TS] : q.rx > TS - 12 ? [0, -TS] : [0], oy = q.ry < 12 ? [0, TS] : q.ry > TS - 12 ? [0, -TS] : [0];
        const nx = -q.s, ny = q.c;
        for (const dx of ox) for (const dy of oy) {
          const x0 = q.rx + dx + q.c * q.l * f0, y0 = q.ry + dy + q.s * q.l * f0, x1 = q.rx + dx + q.c * q.l * f1, y1 = q.ry + dy + q.s * q.l * f1;
          const a0 = q.rw * w0 / 2, a1 = q.rw * w1 / 2;
          g.moveTo(x0 + nx * a0, y0 + ny * a0); g.lineTo(x1 + nx * a1, y1 + ny * a1);
          g.lineTo(x1 - nx * a1, y1 - ny * a1); g.lineTo(x0 - nx * a0, y0 - ny * a0); g.closePath();
        }
      }
      g.fill();
    }
    return c;
  };
  const level = (src, k, S) => {
    const c = canvas(S), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.globalAlpha = k; g.drawImage(src, 0, 0);
    return c;
  };
  const tiles = new Map();   // per cloth and render scale S: { field: [4 canvases], hot: [3 canvases] }, baked at TS*S pixels
  const tilesOf = (cl, S) => {
    const key = cl + '|' + S; let t = tiles.get(key); if (t) return t;
    if (tiles.size > 8) tiles.clear();
    const F = bakePile(CLOTH[cl].field, S), Ho = bakePile(CLOTH[cl].hot, S);
    t = { field: FL.map((k) => level(F, k, S)), hot: HL.map((k) => level(Ho, k, S)) };
    tiles.set(key, t); return t;
  };
  let pats = null;    // patterns per cloth, valid for one x.g
  const patsOf = (g, cl, S) => {
    if (!pats || pats.g !== g) pats = { g, byCloth: {} };
    const key = cl + '|' + S;
    if (!pats.byCloth[key]) {
      const t = tilesOf(cl, S);
      const mk = (c) => { const p = g.createPattern(c, 'repeat'); if (S !== 1 && p && p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().scale(1 / S)); return p; };
      pats.byCloth[key] = { field: t.field.map(mk), hot: t.hot.map(mk) };
    }
    return pats.byCloth[key];
  };

  // ---- the strokes (the memo), rebuilt only when the chords or picked change ----
  let memo = null;
  const build = (cs, picked) => {
    const vs = [];
    for (const ch of cs) for (const n of ch.notes) vs.push(n.v);
    vs.sort((a, b) => a - b);
    const N = vs.length, p10 = N ? vs[Math.floor(0.1 * (N - 1))] : 0, p90 = N ? vs[Math.floor(0.9 * (N - 1))] : 0;
    const flat = N < 2 || p90 - p10 < 4;
    const U = (v) => flat ? 0.7 : Math.min(1, Math.max(0, (v - p10) / (p90 - p10)));
    const floor = picked ? 0.45 : 0.3, strokes = [];
    let prevT = -Infinity, lastKept = -Infinity, prevHi = null, dir = 1;
    for (const ch of cs) {
      const gap = ch.t - prevT; prevT = ch.t;
      let quick = false;
      if (!picked) { if (ch.t - lastKept < 0.12) quick = true; else lastKept = ch.t; }
      if (prevHi !== null) { const d = Math.sign(ch.hi - prevHi); if (d !== 0) dir = d; }
      prevHi = ch.hi;
      const best = new Map();
      for (const n of ch.notes) best.set(n.m, Math.max(best.get(n.m) ?? 0, n.v));
      let ms = [...best.keys()];
      if (!picked) { ms = (ch.hi - ch.lo >= 7) ? [ch.hi, ch.lo] : [ch.hi]; for (const m of ms) if (!best.has(m)) best.set(m, ch.notes[0].v); }
      const flip = picked ? gap >= 0.07 : !quick;
      for (const m of ms) {
        const u = U(best.get(m));
        strokes.push({ t: ch.t, m, ub: Math.round(u * 8) / 8, P: floor + (1 - floor) * u, dir, flip });
      }
    }
    return { cs, n: cs.length, picked, strokes };
  };

  TOOLS.push({
    id: 'nap', name: 'Nap', tag: 'new', on: false,
    blurb: 'Each note strokes a band of velvet pile into the black, with a cut, fibrous edge; a chord strokes several and their crossings go black. Strike the same note again and its band goes out. Nothing moves between notes.',
    params: [
      { key: 'memory', label: 'how many strokes it remembers', min: 1, max: 16, step: 1, value: 7, less: 1,
        hint: 'How many strokes stay in the cloth. Left: only the last stroke is there. Right: sixteen strokes cut through each other.',
        icon: (g, v, w, hh) => ICON.of.count(16, ICON.red)(g, v, w, hh) },
      { key: 'width', label: 'how broad the finger', min: 0.5, max: 1.6, value: 1, less: 0.7,
        hint: 'How broad each stroke is. Left: thin scratches. Right: broad swathes.',
        icon: (g, v, w, hh) => ICON.rect(g, w / 2 - (2 + v * 10) / 2, 3, 2 + v * 10, hh - 6, ICON.red) },
      { key: 'slant', label: 'how much the strokes cross', min: 0, max: 1, value: 0.7,
        hint: 'How steeply the strokes lean. Left: all upright, side by side. Right: steep diagonals crossing.',
        icon: (g, v, w, hh) => {
          const a = v * 28 * DEG, r = (hh - 6) / 2;
          [10, 20, 30].forEach((x0, i) => { const s = i % 2 ? 1 : -1, dx = Math.sin(a) * r * s; ICON.line(g, x0 - dx, hh / 2 + Math.cos(a) * r, x0 + dx, hh / 2 - Math.cos(a) * r, ICON.red, 3); });
        } },
      { key: 'rest', label: 'how long it stays lit in silence', min: 1, max: 12, value: 4, less: 1.5,
        hint: 'How long the cloth stays lit after the music stops. Left: it goes dark soon after. Right: it holds through long rests.',
        icon: (g, v, w, hh) => ICON.fade(g, w, hh, 0.1 + v * 0.9, ICON.red) },
      { key: 'cloth', label: 'which cloth', min: 0, max: 2, step: 1, value: 0,
        hint: 'Which cloth the strokes are made in. Left: dark red. Right: blue-grey.',
        icon: (g, v, w, hh) => ICON.rect(g, 6, 5, w - 12, hh - 10, ['#8a1a20', '#3a6a2a', '#3a5070'][Math.round(v * 2)]) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much you see: how many strokes stay, how broad, how long they last in silence. Left: one thin stroke that soon goes. Right: many broad strokes that hold. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, hh) => ICON.much(g, v, w, hh) },
    ],
    reset() { outlines.clear(); hairCache.clear(); pats = null; tiles.clear(); },
    onChord() {},
    frame(x) {
      const g = x.g, cs = typeof CHORDS !== 'undefined' ? CHORDS : [], picked = !!x.picked;
      if (!memo || memo.cs !== cs || memo.n !== cs.length || memo.picked !== picked) memo = build(cs, picked);
      const S = memo.strokes;
      let lo = 0, hi = S.length - 1, i = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (S[mid].t <= x.t) { i = mid; lo = mid + 1; } else hi = mid - 1; }
      if (i < 0) return;
      const mem = Math.max(1, Math.round(x.p('memory'))), width = x.p('width'), slant = x.p('slant'), R = x.p('rest');
      const cloth = Math.min(2, Math.max(0, Math.round(x.p('cloth'))));
      const gap = x.t - S[i].t, lev = gap < 0.4 * R ? 0 : gap < 0.6 * R ? 1 : gap < 0.8 * R ? 2 : gap < R ? 3 : 4;
      if (lev >= 4 && gap >= HOLD) return;
      const Sc = x.canvas && x.canvas.width ? Math.round(x.canvas.width / x.W * 100) / 100 : 1, pat = patsOf(g, cloth, Sc);
      g.save(); g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
      const trace = (o) => { g.moveTo(o[0], o[1]); for (let j = 2; j < o.length; j += 2) g.lineTo(o[j], o[j + 1]); g.closePath(); };
      if (lev < 4) {
        const seen = new Map(); let got = 0;
        for (let j = i; j >= 0 && got < mem; j--) {
          if (j < i && S[j + 1].t - S[j].t >= R) break;   // strokes from before a completed silence stay gone
          const s = S[j]; if (!s.flip) continue;
          got++; const key = `${s.m}|${s.ub}`; seen.set(key, (seen.get(key) || 0) + 1);
        }
        let any = false;
        for (const [key, c] of seen) {
          if (!(c & 1)) continue;
          if (!any) { g.fillStyle = pat.field[lev]; g.beginPath(); any = true; }
          const [m, ub] = key.split('|'); trace(outline(+m, +ub, width, slant));
        }
        if (any) g.fill('evenodd');
      }
      const att = [];
      for (let j = i; j >= 0 && flash(x.t - S[j].t) === 1; j--) att.push(S[j]);
      if (att.length) {
        for (let hl = 0; hl < 3; hl++) {
          let any = false;
          for (const s of att) {
            if ((s.ub < 0.34 ? 0 : s.ub < 0.67 ? 1 : 2) !== hl) continue;
            if (!any) { g.fillStyle = pat.hot[hl]; g.beginPath(); any = true; }
            trace(outline(s.m, s.ub, width, slant));
          }
          if (any) g.fill();
        }
        for (const s of att) {
          tone(g, BONE, s.P); g.beginPath();
          const t = hairs(s.m, s.ub, s.dir, width, slant);
          for (let j = 0; j < t.length; j += 6) { g.moveTo(t[j], t[j + 1]); g.lineTo(t[j + 2], t[j + 3]); g.lineTo(t[j + 4], t[j + 5]); g.closePath(); }
          g.fill();
        }
      }
      g.restore();
    },
  });
})();
