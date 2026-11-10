// Cut: each note stands one slab with knife-sharp faces. Nothing moves with time: only the next attack takes one step off
// every slab on the stage, corners first, then edges, then faces, until it is sugar and gone.
// Stateless: drawn in frame from CHORDS and x.t; the only things kept are caches (velocity percentiles, cell tables, baked sprites).
(() => {
const SNAP = KIT.SNAP;

  const tone = (g, rgb, k = 1) => {
    g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
  };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };
  const hash = (m) => { let h = Math.imul(m + 1, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; };
  const mulberry32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const A = [1.0, 1.4, 2.0, 0.7];
  const Q = [0, 0.05, 0.10, 0.17, 0.25, 0.35, 0.47, 0.60, 0.72];
  const LONG = [96, 192, 384];   // sprite long sides: a slab draws from the nearest, about 1:1, so a grain is G screen px
  const R = [0, 0, 0, 0, 0, 0.04, 0.10, 0.18, 0.30];
  const F = [1, 0.9375, 0.875, 0.8125, 0.75, 0.6875, 0.625, 0.5625, 0.5];
  const LV = [1, 0.55, 0.30];
  const STOPS = [[0, [206, 184, 140]], [0.7, [150, 104, 50]], [1, [124, 22, 22]]];
  const wetColour = (w) => {
    w = clamp(w, 0, 1);
    for (let k = 1; k < STOPS.length; k++) {
      if (w <= STOPS[k][0]) {
        const a = STOPS[k - 1], b = STOPS[k], f = (w - a[0]) / (b[0] - a[0]);
        return [0, 1, 2].map((c) => a[1][c] + (b[1][c] - a[1][c]) * f);
      }
    }
    return STOPS[STOPS.length - 1][1].slice();
  };
  const body = (C, s, l) => [0, 1, 2].map((c) => Math.round(C[c] * F[s] * LV[l]));
  const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  // Velocity percentiles of the clip, once per CHORDS array and length.
  let vcache = null;
  const vstats = (cs) => {
    if (vcache && vcache.arr === cs && vcache.n === cs.length) return vcache;
    const vs = [];
    for (const c of cs) for (const n of c.notes) vs.push(n.v);
    vs.sort((a, b) => a - b);
    const N = vs.length;
    vcache = { arr: cs, n: cs.length, N, p10: N ? vs[Math.floor(0.1 * (N - 1))] : 0, p90: N ? vs[Math.floor(0.9 * (N - 1))] : 0 };
    return vcache;
  };
  const norm = (st, v) => (st.N < 2 || st.p90 - st.p10 < 1 ? 0.6 : clamp((v - st.p10) / (st.p90 - st.p10), 0, 1));

  // Cell tables per (G, size bucket, aspect): the highest stage each cell survives to. Colours are applied when a sprite is made.
  // Corners lead: hold is mostly the distance to the nearest corner, so stages 1-4 clip and round the corners while the middles of
  // the faces stay straight; the arrises (a little of dE) go next, and the faces last, through `loose`.
  const tables = new Map();
  const tableFor = (G, b, a) => {
    const key = G + '/' + b + '/' + a;
    if (tables.has(key)) return tables.get(key);
    const asp = A[a], L = LONG[b];
    const sw = asp >= 1 ? L : Math.round(L * asp), sh = asp >= 1 ? Math.round(L / asp) : L;
    const nx = Math.ceil(sw / G), ny = Math.ceil(sh / G), N = nx * ny, mh = Math.min(sw, sh) / 2;
    const rng = mulberry32(9173 + 101 * a + 1000 * G + 17 * b);
    const hold = new Float64Array(N), loose = new Float64Array(N), dCs = new Float64Array(N), dEs = new Float64Array(N);
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      const n1 = rng(), n2 = rng();
      const cx = Math.min((ix + 0.5) * G, sw), cy = Math.min((iy + 0.5) * G, sh);
      const dE = Math.min(cx, sw - cx, cy, sh - cy) / mh;
      let dC = Infinity;
      for (const [X, Y] of [[0, 0], [sw, 0], [0, sh], [sw, sh]]) dC = Math.min(dC, Math.hypot(cx - X, cy - Y) / mh);
      const k = iy * nx + ix;
      hold[k] = 0.8 * Math.pow(Math.min(1, dC / 1.3), 0.8) + 0.2 * Math.min(1, dE) + 0.08 * (n1 - 0.5);
      loose[k] = n2; dCs[k] = dC; dEs[k] = dE;
    }
    const order = Array.from({ length: N }, (_, k) => k).sort((p, q) => hold[p] - hold[q] || p - q);
    const rank = new Float64Array(N);
    order.forEach((k, pos) => { rank[k] = pos / N; });
    const last = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      let s = 0;
      while (s < 8 && rank[k] >= Q[s + 1] && loose[k] >= R[s + 1]) s++;
      last[k] = s;
    }
    const t = { sw, sh, nx, ny, G, last };
    tables.set(key, t);
    return t;
  };

  // Sprites, made on first use: opaque on black, so lighten with black changes nothing and every grain holds exactly.
  // Cached under (bucket, aspect, level, stage); the cache is dropped when the grain size or the colour changes.
  let spr = new Map(), sprKey = '', curG = 4, curWet = 0.7;
  const sync = (grain, wet) => {
    const grainQ = Math.round(grain * 10) / 10, G = Math.round(2 + 6 * grainQ), wetQ = Math.round(wet * 20) / 20;
    const key = G + '/' + wetQ;
    if (key !== sprKey) { spr = new Map(); sprKey = key; }
    curG = G; curWet = wetQ;
  };
  const sprite = (b, a, l, s) => {
    const key = b + '.' + a + '.' + l + '.' + s;
    const got = spr.get(key);
    if (got) return got;
    const G = curG, t = tableFor(G, b, a), C = wetColour(curWet);
    const c = document.createElement('canvas'); c.width = t.sw; c.height = t.sh;
    const sg = c.getContext('2d'), img = sg.createImageData(t.sw, t.sh), d = img.data;
    for (let p = 3; p < d.length; p += 4) d[p] = 255;
    const col = body(C, s, l);
    for (let iy = 0; iy < t.ny; iy++) for (let ix = 0; ix < t.nx; ix++) {
      if (t.last[iy * t.nx + ix] < s) continue;
      const x1 = Math.min(t.sw, (ix + 1) * G), y1 = Math.min(t.sh, (iy + 1) * G);
      for (let y = iy * G; y < y1; y++) for (let x = ix * G; x < x1; x++) {
        const o = (y * t.sw + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2];
      }
    }
    sg.putImageData(img, 0, 0);
    spr.set(key, c);
    return c;
  };

  TOOLS.push({
    id: 'cut', name: 'Cut', tag: 'new', on: false,
    blurb: 'Each note stands a slab with knife-sharp faces. Nothing moves until the next note: then every slab on the stage loses one step of its edge, corners first, then edges, then faces, until it is sugar and gone. Best on picked notes and slow music; at six notes a second a slab lives about a second and a half.',
    params: [
      { key: 'steps', label: 'how many notes a slab survives', min: 2, max: 16, step: 1, value: 8, less: 2,
        hint: 'How many later notes a slab lives through, crumbling one step at each. Left: gone after the next note or two. Right: a long crumbling trail.',
        icon: ICON.of.count(16, ICON.gold) },
      { key: 'size', label: 'how big', min: 0.4, max: 2, value: 1, less: 0.7,
        hint: 'How big a slab is; a harder note makes a wider one. Left: bricks. Right: large slabs.',
        icon: ICON.of.size('square', ICON.gold) },
      { key: 'grain', label: 'how coarse the crumbs', min: 0, max: 1, value: 0.4,
        hint: 'How coarse the crumbs are as a slab wears away. Left: fine sugar. Right: coarse gravel.',
        icon: (g, v, w, h) => ICON.dots(g, 22 - v * 14, w, h, { seed: 3, r: 0.7 + v * 2, col: ICON.gold }) },
      { key: 'goneBy', label: 'how long in silence', min: 0.5, max: 8, value: 3, less: 0.5,
        hint: 'How long slabs wait in a silence before they quietly dim away. Left: they go dim soon. Right: they wait up to eight seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.gold) },
      { key: 'wet', label: 'what colour', min: 0, max: 1, value: 0.7,
        hint: 'The colour of the sand. Left: pale dry sand. Towards the right: wet ochre, then dark red.',
        icon: (g, v, w, h) => ICON.rect(g, 3, 3, w - 6, h - 6, hex(wetColour(v))) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much stands on the stage: how many notes a slab survives, how big it is, how long it waits in silence. Left: few small slabs that go soon. Right: a long crumbling trail of big slabs. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() {},     // the sprites depend only on (grain, wet) and are made on first use: a seek never rebakes
    onChord() {},   // stateless: frame finds everything from CHORDS and x.t
    frame(x) {
      const steps = Math.round(x.p('steps')), size = x.p('size'), goneBy = x.p('goneBy');
      sync(x.p('grain'), x.p('wet'));
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i = chordAt(cs, x.t); if (i < 0) return;
      const sig = x.t - cs[i].t - goneBy;
      const l = sig < 0 ? 0 : sig < 0.25 ? 1 : sig < 0.5 ? 2 : 3;
      if (l === 3) return;
      const W = x.W, H = x.H, C = wetColour(Math.round(x.p('wet') * 20) / 20), st = vstats(cs);
      const slabs = [];
      for (let j = i; j >= Math.max(0, i - steps) && slabs.length < 48; j--) {
        if (j < i && cs[j + 1].t - cs[j].t > goneBy) break;
        const k = i - j, s = k === 0 ? 0 : Math.min(8, Math.ceil(8 * k / steps));
        for (const n of cs[j].notes) {
          if (slabs.length >= 48) break;
          const m = n.m, hs = hash(m), a = hs % 4, fx = (hs >>> 2) & 1 ? -1 : 1, fy = (hs >>> 3) & 1 ? -1 : 1;
          const row = (hs >>> 4) % 5, jit = ((hs >>> 8) % 41) - 20;
          const w = (60 + 160 * norm(st, n.v)) * size, h = Math.min(w / A[a], 0.9 * H);
          let cx = (0.06 + 0.88 * clamp((m - 21) / 87, 0, 1)) * W, cy = H * (0.2 + 0.15 * row) + jit;
          let o = 0;
          for (let q = j - 1; q >= Math.max(0, j - steps); q--) {
            if (cs[q + 1].t - cs[q].t > goneBy) break;
            if (cs[q].notes.some((nn) => nn.m === m)) o++;
          }
          if (o > 0) {
            const c = ((o - 1) % 4) + 1, side = c % 2 ? 1 : -1, hc = Math.ceil(c / 2);
            cx += side * 0.35 * w * hc; cy -= 0.25 * h * hc;
          }
          cx = w > W - 16 ? W / 2 : clamp(cx, w / 2 + 8, W - w / 2 - 8);
          cy = h > H - 16 ? H / 2 : clamp(cy, h / 2 + 8, H - h / 2 - 8);
          const big = Math.max(w, h), bk = big < 136 ? 0 : big < 272 ? 1 : 2;
          slabs.push({ s, a, bk, fx, fy, x0: Math.round(cx - w / 2), y0: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h) });
        }
      }
      slabs.reverse();
      const g = x.g, age = x.t - cs[i].t;
      g.save(); g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1; g.imageSmoothingEnabled = false;
      for (const b of slabs) {
        if (b.s === 0) {
          if (age < SNAP.H) tone(g, [0, 1, 2].map((c) => Math.round(C[c] + 0.4 * (SNAP.BONE[c] - C[c]))));
          else tone(g, body(C, 0, l));
          g.fillRect(b.x0, b.y0, b.w, b.h);
        } else {
          g.save(); g.translate(b.x0 + b.w / 2, b.y0 + b.h / 2); g.scale(b.fx, b.fy);
          g.drawImage(sprite(b.bk, b.a, l, b.s), -b.w / 2, -b.h / 2, b.w, b.h); g.restore();
        }
      }
      const fl = SNAP.flash(age);
      if (l === 0 && fl > 0.04) {
        tone(g, SNAP.BONE, fl);
        for (const b of slabs) if (b.s === 0) { g.fillRect(b.x0, b.y0, b.w, 5); g.fillRect(b.x0, b.y0, 5, b.h); }
      }
      g.restore();
    },
  });
})();
