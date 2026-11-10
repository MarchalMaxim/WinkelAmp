// Interlock: each note fires a pair of straight full-height needles, one from above and one from below, that pass each other along the middle line. Stateless from CHORDS.
(() => {
const SNAP = KIT.SNAP;

  // Which chord is sounding at song time t: the last one at or before it (a binary search; nothing remembered between frames).
  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };

  const SEAM = 360, CAP = 200, BASE = 400;   // base pinned 40 px beyond the edge: upper base y = -40, lower = 760
  const BODY = [90, 16, 18], HOT = [214, 58, 40], BONE_BUDGET = 55296;
  // Checks kept true at every setting: worst case b = 88 (width 2, u 1), corner x offset <= 66, sin 2.5deg = 0.0436, so a
  // corner's y is at most 360 - 400*cos a + 66*0.0436 = -36.7 (< 0), the lower ones at least 756.7 (> 720): full height always.
  // The pair never touches: the gap between upper right edge and lower left edge is (b/2)*(400-depth)/(400+depth) = b/6 > 0 at the cap.
  // Upper width at the seam is b*depth/(400+depth): it grows with depth, so a ratchet widens the needle by itself.
  const px = (m) => 40 + 1200 * (m - 21) / 87;
  const hash01 = (m) => { let h = Math.imul(m + 0x9e37, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rgb = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';

  // Cache keyed on the CHORDS array and its length: velocity percentiles and, per chord, pitch -> previous / next chord holding it.
  let cache = null;
  const prepare = (cs) => {
    if (cache && cache.cs === cs && cache.n === cs.length) return cache;
    const vs = [];
    for (const c of cs) for (const n of c.notes) vs.push(n.v);
    vs.sort((a, b) => a - b);
    const N = vs.length;
    const p10 = N ? vs[Math.floor(0.1 * (N - 1))] : 0, p90 = N ? vs[Math.floor(0.9 * (N - 1))] : 0;
    const prev = [], next = [], last = new Map();
    for (let j = 0; j < cs.length; j++) {
      const pm = new Map(), nm = new Map();
      for (const n of cs[j].notes) { if (pm.has(n.m)) continue; pm.set(n.m, last.has(n.m) ? last.get(n.m) : -1); }
      prev.push(pm); next.push(nm);
      for (const [m, pj] of pm) { last.set(m, j); if (pj >= 0) next[pj].set(m, j); }
    }
    cache = { cs, n: cs.length, N, p10, p90, prev, next };
    return cache;
  };
  const noteAt = (c, m) => { for (const n of c.notes) if (n.m === m) return n; return null; };

  TOOLS.push({
    id: 'interlock', name: 'Interlock', tag: 'new',
    blurb: 'Each note fires a pair of straight needles, one from above and one from below, that pass each other along the middle line. A scale zips the seam shut; the same note again drives its needle deeper. They stand still and darken away.',
    params: [
      { key: 'bite', label: 'how far they cross', min: 0, max: 2, value: 1,
        hint: "How far a needle's tip crosses the middle line. Left: the tips just meet. Right: they go deep past each other.",
        icon: (g, v, w, h) => { ICON.line(g, w / 2 - 3, 0, w / 2 - 3, h / 2 + v * 8, ICON.ink, 1.5); ICON.line(g, w / 2 + 3, h, w / 2 + 3, h / 2 - v * 8, ICON.red, 1.5); } },
      { key: 'width', label: 'how wide a needle', min: 0.3, max: 2, value: 1, less: 0.6,
        hint: 'How wide a needle is at its root. Left: hairline splinters. Right: heavy wedges.',
        icon: (g, v, w, h) => { const bw = 2 + v * 14; g.beginPath(); g.moveTo(w / 2 - bw / 2, 0); g.lineTo(w / 2 + bw / 2, 0); g.lineTo(w / 2, h); g.fillStyle = ICON.ink; g.fill(); } },
      { key: 'stays', label: 'how long the mesh stays', min: 0.3, max: 4, value: 1.4, less: 0.3,
        hint: 'How long a needle stays after its note, standing still while it darkens. Left: gone in a third of a second. Right: the mesh holds for seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red) },
      { key: 'ratchet', label: 'how much a repeat drives in', min: 0, max: 40, value: 24,
        hint: 'How much deeper the same note played again drives its needle. Left: a repeat only flashes. Right: each one goes visibly deeper.',
        icon: (g, v, w, h) => { for (let n = 0; n < 3; n++) { const cx = 8 + n * 12, d = h * (0.5 + n * v * 0.2); g.beginPath(); g.moveTo(cx - 1.5, 0); g.lineTo(cx + 1.5, 0); g.lineTo(cx, d); g.fillStyle = ICON.red; g.fill(); } } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much you see: how long the needles stay and how wide they are. Left: thin needles that are soon gone. Right: wide needles and a mesh that holds. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { cache = null; },
    onChord() {},   // stateless: frame finds the chords itself

    frame(x) {
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i = chordAt(cs, x.t); if (i < 0) return;
      const C = prepare(cs), g = x.g, picks = !!x.picked;
      const S = x.p('stays'), BITE = x.p('bite'), WIDTH = x.p('width'), RATCHET = x.p('ratchet');
      const guard = C.N < 2 || C.p90 - C.p10 < 1;
      const uOf = (v) => { let u = guard ? 0.6 : clamp((v - C.p10) / (C.p90 - C.p10), 0, 1); if (picks) u = 0.25 + 0.75 * u; return u; };
      const groups = new Map();
      const push = (col, p) => { let a = groups.get(col); if (!a) groups.set(col, a = []); a.push(p); };
      for (let j = i; j >= 0 && x.t - cs[j].t < S; j--) {
        const c = cs[j], t = x.t - c.t;
        const f = SNAP.flash(t), s = t / S, k = (1 - s) * (1 - s) * (1 + 2 * s);
        // Two lighten fills, never a hue lerp: the held body BODY*k, and the strike colour*f*k on top. Lighten takes the per-channel max,
        // so the bone dims as a neutral grey and sinks under the red with no pink midpoint. At f = 1, k = 1 the strike is exactly itself.
        const dim = (c, w) => [0, 1, 2].map((q) => Math.round(c[q] * w));
        const body = dim(BODY, k), kf = f * k;
        const items = [], seen = new Set();
        for (const n of c.notes) {
          const m = n.m; if (seen.has(m)) continue; seen.add(m);
          const nx = C.next[j].get(m); if (nx !== undefined && nx <= i) continue;   // a newer attack of this pitch already sounded
          // the chain: this attack and earlier ones on m, each less than S seconds after the one before (at most 16 links)
          const chain = [j];
          while (chain.length < 16) {
            const tail = chain[chain.length - 1], pj = C.prev[tail].get(m);
            if (pj === undefined || pj < 0 || cs[tail].t - cs[pj].t >= S) break;
            chain.push(pj);
          }
          let depth = 0, b = 0;
          for (let q = chain.length - 1; q >= 0; q--) {
            const u = uOf(noteAt(cs[chain[q]], m).v);
            const bite0 = BITE * (24 + 70 * u), b0 = WIDTH * (8 + 36 * u);
            if (q === chain.length - 1) { depth = Math.min(CAP, bite0); b = b0; }
            else { depth = Math.min(CAP, Math.max(bite0, depth + RATCHET)); b = Math.max(b0, b); }
          }
          items.push({ m, u: uOf(n.v), depth, b });
        }
        items.sort((p, q) => q.u - p.u);
        let area = 0;
        const bone = dim(SNAP.BONE, kf), hot = dim(HOT, kf);
        for (const it of items) {
          const { m, depth, b } = it;
          area += 0.5 * (b * (SEAM + depth) / (BASE + depth)) * (SEAM + depth);
          const upCol = area > BONE_BUDGET ? hot : bone;
          const a = (hash01(m) - 0.5) * 5 * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), ox = px(m) + b / 4;
          const P = (qx, qy) => [ox + qx * ca - qy * sa, SEAM + qx * sa + qy * ca];
          // every triangle has the same winding (signed area +), so overlaps of one colour never cancel under the nonzero fill
          const up = [P(-b / 4, depth), P(-b / 4 - b / 2, -BASE), P(-b / 4 + b / 2, -BASE)];
          const lo = [P(b / 4, -depth), P(b / 4 + b / 2, BASE), P(b / 4 - b / 2, BASE)];
          push(rgb(body), up); push(rgb(body), lo);
          push(rgb(upCol), up); push(rgb(hot), lo);
        }
      }
      if (!groups.size) return;
      g.save(); g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
      for (const [col, tris] of groups) {
        if (col === 'rgb(0,0,0)') continue;
        g.fillStyle = col; g.beginPath();
        for (const tr of tris) { g.moveTo(tr[0][0], tr[0][1]); g.lineTo(tr[1][0], tr[1][1]); g.lineTo(tr[2][0], tr[2][1]); g.closePath(); }
        g.fill();
      }
      g.restore();
    },
  });
})();
