// Film: one flat ink-blue sail whose corners are the last notes. Each note pulls the oldest corner to its own place in one
// step, whipping past and ringing back with a bone tip; every edge is scooped taut, so a wide leap is a deep curve and the
// corners close to needles. Stateless: the shape is found from CHORDS and x.t.
(() => {
const SNAP = KIT.SNAP;

  // The tone rule (SYNTHESIS, "Read this before building any of them"): dim marks go down with lighten, alpha 1, a real colour.
  const tone = (g, rgb, k = 1) => {
    g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
  };

  const W = 1280, H = 720, FALL = 0.25, BODY = [40, 68, 196], TAU = 0.07;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smoothstep = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };
  const mulberry32 = (a) => () => {
    a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Everything derived from CHORDS alone, built once per song (knob-independent).
  let cacheCs = null, cacheN = -1, plan = null;
  const build = (cs) => {
    const F = [], first = [], last = [];
    for (let ci = 0; ci < cs.length; ci++) {
      first.push(F.length);
      const ns = cs[ci].notes.slice().sort((a, b) => a.m - b.m);
      for (const n of ns) F.push({ ci, m: n.m, v: n.v, u: 0.5, x: 0, y: 0, id: F.length });
      last.push(F.length - 1);
    }
    const N = F.length;
    if (!N) return { F, first, last };
    const vs = F.map((e) => e.v).sort((a, b) => a - b), ms = F.map((e) => e.m).sort((a, b) => a - b);
    const p10 = vs[Math.floor(0.1 * (N - 1))], p90 = vs[Math.floor(0.9 * (N - 1))];
    let lo = ms[Math.floor(0.05 * (N - 1))], hi = ms[Math.floor(0.95 * (N - 1))];
    if (hi - lo < 24) { const mid = (lo + hi) / 2; lo = mid - 12; hi = mid + 12; }
    for (let j = 0; j < N; j++) {
      const e = F[j];
      e.u = p90 - p10 < 4 ? 0.5 : clamp((e.v - p10) / (p90 - p10), 0, 1);
      const q = clamp((e.m - lo) / (hi - lo), 0, 1);
      e.x = W * (0.06 + 0.88 * q);
      const yPitch = H * (0.90 - 0.80 * q);
      const r = mulberry32((Math.imul(e.ci + 1, 0x9E3779B1) ^ Math.imul(e.m + 1, 0x85EBCA77)) >>> 0);
      let best = 0, bestA = -1, y0 = yPitch;
      for (let k = 0; k < 5; k++) {
        const yk = 0.5 * yPitch + 0.5 * (H * (0.10 + 0.80 * r()));
        if (j < 2) { y0 = yk; break; }
        const A = F[j - 2], B = F[j - 1];
        const area = Math.abs((e.x - A.x) * (B.y - A.y) - (yk - A.y) * (B.x - A.x)) / 2;
        if (area > bestA) { bestA = area; best = yk; }
      }
      e.y = j < 2 ? y0 : best;
    }
    return { F, first, last };
  };

  // The sail's corner set at chord i: { ps, set } with set the corners (entries of F, or two pads with negative ids).
  const cornersAt = (P, cs, i, K, stay) => {
    let j = i;
    while (j > 0 && j > i - 8 && cs[j].t - cs[j - 1].t < stay + FALL) j--;
    const ps = j;
    let c = clamp(Math.max(K, Math.min(7, cs[ps].notes.length)), 3, 7);
    for (let k = ps + 1; k <= i; k++) c = clamp(Math.max(K, Math.min(7, cs[k].notes.length), c - 1), 3, 7);
    const T0 = P.F[P.first[ps]], dy = T0.y > 0.6 * H ? -190 : 190;
    const pad = (id, dx) => ({ ci: -1, id, u: 0, x: clamp(T0.x + dx, 0.04 * W, 0.96 * W), y: clamp(T0.y + dy, 0.06 * H, 0.94 * H) });
    const L = [pad(-2, -240), pad(-1, 240)];
    for (let k = P.first[ps]; k <= P.last[i]; k++) L.push(P.F[k]);
    return { ps, set: L.slice(L.length - Math.min(c, L.length)) };
  };

  TOOLS.push({
    id: 'film', name: 'Film', tag: 'new', on: false,
    blurb: 'One ink-blue sail whose corners are the last notes. Each note pulls the oldest corner to its own place in one step, whipping past and back with a bone tip; every edge is scooped taut, so a wide leap is a deep curve, and the corners close to needles.',
    params: [
      { key: 'corners', label: 'how many notes hold it', min: 3, max: 7, value: 3, step: 1,
        hint: 'How many of the last notes are corners of the sail. Left: three corners, each note a big change. Right: a seven-pointed star, each note a small one.',
        icon: (g, v, w, h) => {
          const n = 3 + Math.round(4 * v), ro = h / 2 - 2, ri = ro * 0.35;
          g.fillStyle = ICON.blue; g.beginPath();
          for (let k = 0; k < 2 * n; k++) {
            const r = k % 2 ? ri : ro, a = -Math.PI / 2 + (k * Math.PI) / n;
            const px = w / 2 + r * Math.cos(a), py = h / 2 + r * Math.sin(a);
            if (k) g.lineTo(px, py); else g.moveTo(px, py);
          }
          g.closePath(); g.fill();
        } },
      { key: 'slack', label: 'how deep the edges curve in', min: 0, max: 1, value: 0.6,
        hint: 'How deeply the edges curve inward. Left: straight edges, a hard polygon. Right: deep scoops, the corners drawn out to long needles.',
        icon: (g, v, w, h) => {
          const r = h / 2 - 2, cx = w / 2, cy = h / 2, pts = [0, 1, 2].map((k) => [cx + r * Math.cos(-Math.PI / 2 + k * 2 * Math.PI / 3), cy + r * Math.sin(-Math.PI / 2 + k * 2 * Math.PI / 3)]);
          g.fillStyle = ICON.blue; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
          for (let k = 0; k < 3; k++) {
            const a = pts[k], b = pts[(k + 1) % 3], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
            g.quadraticCurveTo(mx + (cx - mx) * v * 0.9, my + (cy - my) * v * 0.9, b[0], b[1]);
          }
          g.closePath(); g.fill();
        } },
      { key: 'kick', label: 'how far a corner overshoots', min: 0, max: 0.4, value: 0.14,
        hint: 'How far a new corner whips past its place before it settles. Left: it lands dead. Right: it whips past and rings back.',
        icon: (g, v, w, h) => { ICON.line(g, w * 0.6, 4, w * 0.6, h - 4, ICON.dim, 1); ICON.arrow(g, 4, h / 2, w * 0.6 + v * (w * 0.4 - 4), h / 2, ICON.blue); } },
      { key: 'stay', label: 'how long it stays', min: 0.3, max: 4, value: 2, less: 0.6,
        hint: 'How long the sail stays when no note comes. Left: gone soon after the line stops. Right: it hangs for seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.blue) },
      { key: 'tips', label: 'how bright the tips', min: 0, max: 1, value: 1, less: 0.3,
        hint: 'How big the bone-bright cap on each new corner is. Left: the tips barely show. Right: a bright needle point at every note.',
        icon: (g, v, w, h) => { g.fillStyle = ICON.blue; g.beginPath(); g.moveTo(4, h - 4); g.lineTo(w - 4, h / 2); g.lineTo(4, 4); g.closePath(); g.fill(); g.fillStyle = ICON.ink; g.beginPath(); g.moveTo(w - 4, h / 2); g.lineTo(w - 4 - (w - 8) * (0.15 + 0.6 * v), h / 2 - (h / 2 - 4) * (0.15 + 0.6 * v)); g.lineTo(w - 4 - (w - 8) * (0.15 + 0.6 * v), h / 2 + (h / 2 - 4) * (0.15 + 0.6 * v)); g.closePath(); g.fill(); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How long the sail lingers once the music stops. Left: it is gone soon after the last note. Right: it hangs for up to two seconds. Moving it sets that knob; set it by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() {},
    onChord() {},   // stateless: frame finds the chord itself
    frame(x) {
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i = chordAt(cs, x.t); if (i < 0) return;
      const stay = x.p('stay'), a = x.t - cs[i].t;
      if (a >= stay + FALL - 1e-9) return;
      if (cs !== cacheCs || cs.length !== cacheN) { plan = build(cs); cacheCs = cs; cacheN = cs.length; }
      const P = plan, K = Math.round(x.p('corners')), kick = x.p('kick'), slack = x.p('slack');
      const picks = !!x.picked, g = x.g, tips = x.p('tips');
      const uuOf = (e) => (picks ? Math.max(0.35, e.u) : e.u);

      const cur = cornersAt(P, cs, i, K, stay);
      const set = cur.set;
      // Overshoot vectors d, per chord that is still ringing (born within 0.5 s).
      const dOf = new Map();
      for (const e of set) {
        if (e.ci < 0 || dOf.has(e.ci) || x.t - cs[e.ci].t >= 0.5) continue;
        const j = e.ci, now = j === i ? cur : cornersAt(P, cs, j, K, stay), dm = new Map();
        if (now.ps !== j) {
          const prev = cornersAt(P, cs, j - 1, K, stay), ids = new Set(now.set.map((q) => q.id));
          const dropped = prev.set.filter((q) => !ids.has(q.id));
          let cx = 0, cy = 0; for (const q of prev.set) { cx += q.x; cy += q.y; } cx /= prev.set.length; cy /= prev.set.length;
          let n = 0;
          for (const q of now.set) if (q.ci === j) {
            const from = dropped[n++] || { x: cx, y: cy };
            dm.set(q.id, [q.x - from.x, q.y - from.y]);
          }
        }
        dOf.set(j, dm);
      }
      // Order the set around the centroid of the targets.
      let tcx = 0, tcy = 0; for (const e of set) { tcx += e.x; tcy += e.y; } tcx /= set.length; tcy /= set.length;
      const ord = set.map((e) => ({ e, ang: Math.atan2(e.y - tcy, e.x - tcx) }));
      ord.sort((p, q) => p.ang - q.ang || p.e.id - q.e.id);
      const n = ord.length, px = new Array(n), py = new Array(n), fresh = new Array(n);
      for (let k = 0; k < n; k++) {
        const e = ord[k].e; let X = e.x, Y = e.y;
        if (e.ci >= 0) {
          const ac = x.t - cs[e.ci].t, d = ac < 0.5 && dOf.get(e.ci) && dOf.get(e.ci).get(e.id);
          if (d) {
            const gap = e.ci + 1 < cs.length ? cs[e.ci + 1].t - cs[e.ci].t : Infinity;
            const A = kick * (0.5 + 0.5 * uuOf(e)) * Math.min(1, gap / 0.25);
            const w = A * Math.exp(-ac / TAU) * Math.cos(2 * Math.PI * 8 * ac);
            X += w * d[0]; Y += w * d[1];
          }
        }
        px[k] = X; py[k] = Y; fresh[k] = e.ci === i;
      }
      // Scoops.
      let Cx = 0, Cy = 0, area = 0;
      for (let k = 0; k < n; k++) { Cx += px[k]; Cy += py[k]; const m = (k + 1) % n; area += px[k] * py[m] - px[m] * py[k]; }
      Cx /= n; Cy /= n; const sg = area < 0 ? -1 : 1;
      const phi = new Array(n);
      for (let k = 0; k < n; k++) {
        const pr = (k + n - 1) % n, nx = (k + 1) % n;
        const ax = px[pr] - px[k], ay = py[pr] - py[k], bx = px[nx] - px[k], by = py[nx] - py[k];
        let th = Math.atan2(sg * (bx * ay - by * ax), bx * ax + by * ay); if (th < 0) th += 2 * Math.PI;
        phi[k] = Math.min(th / 2 - 0.035, 1.40);
      }
      const blow = a < 0.5 ? 1 - 0.5 * Math.exp(-a / TAU) : 1;
      let maxE = 0; for (let k = 0; k < n; k++) { const m = (k + 1) % n; maxE = Math.max(maxE, Math.hypot(px[m] - px[k], py[m] - py[k])); }
      const Rc = clamp(maxE, 300, 900);   // one radius per sail, tied to its size so a small sail still scoops
      const edges = [];
      for (let k = 0; k < n; k++) {
        const m = (k + 1) % n, dx = px[m] - px[k], dy = py[m] - py[k], c = Math.hypot(dx, dy);
        if (!(c >= 1)) { edges.push(null); continue; }
        const mx = (px[k] + px[m]) / 2, my = (py[k] + py[m]) / 2;
        let nxx = -dy / c, nyy = dx / c; if (nxx * (Cx - mx) + nyy * (Cy - my) < 0) { nxx = -nxx; nyy = -nyy; }
        let s = Math.min(0.35 * c, (slack / 0.6) * c * c / (8 * Rc));
        const ph = Math.min(phi[k], phi[m]);
        s = ph <= 0 ? 0 : Math.min(s, (c / 4) * Math.tan(ph));
        if (fresh[k] || fresh[m]) s *= blow;
        edges.push([mx + 2 * s * nxx, my + 2 * s * nyy]);
      }
      const path = () => {
        g.beginPath(); g.moveTo(px[0], py[0]);
        for (let k = 0; k < n; k++) {
          const m = (k + 1) % n, q = edges[k];
          if (q) g.quadraticCurveTo(q[0], q[1], px[m], py[m]); else g.lineTo(px[m], py[m]);
        }
        g.closePath();
      };
      // Tone: body, then the bone wedge at each new tip.
      let uN = 0; for (let k = P.first[i]; k <= P.last[i]; k++) uN = Math.max(uN, uuOf(P.F[k]));
      const pk = 0.85 + 0.15 * uN;
      const kb = pk * (0.65 + 0.35 * Math.pow(0.5, a / 0.25)) * (1 - smoothstep(stay, stay + FALL, a));
      tone(g, BODY, kb); path(); g.fill();
      const gapI = i + 1 < cs.length ? cs[i + 1].t - cs[i].t : Infinity, gk = clamp(gapI / 0.25, 0.3, 1);
      if (tips > 0 && a < Math.min(0.12, gapI)) {
        const f = SNAP.flash(a), wc = BODY.map((b, c) => Math.round(b * kb * (1 - f) + SNAP.BONE[c] * f));
        g.save(); path(); g.clip();
        tone(g, wc); g.beginPath();
        for (let k = 0; k < n; k++) if (fresh[k]) {
          // A real wedge: walk r along both edges from the tip and fill the triangle, so the cap ends in a straight cut.
          const pr = (k + n - 1) % n, nx = (k + 1) % n;
          const la = Math.hypot(px[pr] - px[k], py[pr] - py[k]), lb = Math.hypot(px[nx] - px[k], py[nx] - py[k]);
          if (!(la > 1 && lb > 1)) continue;
          const r = Math.min((50 + 70 * uuOf(ord[k].e)) * gk * tips, 0.35 * Math.min(la, lb));
          g.moveTo(px[k], py[k]);
          g.lineTo(px[k] + (px[pr] - px[k]) * r / la, py[k] + (py[pr] - py[k]) * r / la);
          g.lineTo(px[k] + (px[nx] - px[k]) * r / lb, py[k] + (py[nx] - py[k]) * r / lb);
          g.closePath();
        }
        g.fill(); g.restore();
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    },
  });
})();
