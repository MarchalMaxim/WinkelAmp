// Plucked corner: each pitch owns one straight thread between two small square anchors. A pluck is two dead-straight lines
// meeting at one hard corner; the corner splits and runs, so the thread flaps through triangle, flat-topped trapezoid, flat,
// and the same upside down (Helmholtz motion, exact, no sampling). The fading canvas stacks the positions into a fan of
// straight hairlines. Nothing here is curved. Stateless: everything is derived from CHORDS and x.t.
(() => {
const SNAP = KIT.SNAP;

  // 'run' is the corner running along the thread; 'stand' is the fallback (fixed corner, V flipping to inverted V).
  const FORM = 'run';

  // Outside the SNAP markers (SYNTHESIS rule 1): a real colour at its target, drawn with lighten at alpha 1.
  const tone = (g, rgb, k = 1) => {
    g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const BONE = SNAP.BONE, RED = [226, 44, 40];
  const NOTAIL = {}; for (const k of SNAP.TOUCH) { const p = SNAP.PRESETS[k]; NOTAIL[k] = { ...p, wb: p.wb + p.wt, wt: 0 }; }
  const hash = (m, k) => { let s = Math.imul(m + 1, 0x9E3779B1) ^ Math.imul(k + 1, 0x85EBCA77);
    s = Math.imul(s ^ (s >>> 15), 0x2C1B3C6D); s = Math.imul(s ^ (s >>> 12), 0x297A2D39); return ((s ^ (s >>> 15)) >>> 0) / 4294967296; };
  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };

  // Caches derived from CHORDS only; cleared in reset.
  let statsFor = null, stats = null, strands = new Map();
  function clipStats(all) {
    if (statsFor === all && stats && stats.n === all.length) return stats;
    statsFor = all; strands = new Map();
    let lo = Infinity, hi = -Infinity; const vs = [];
    for (const c of all) for (const n of c.notes) { if (n.m < lo) lo = n.m; if (n.m > hi) hi = n.m; vs.push(n.v); }
    if (!vs.length) { lo = 54; hi = 66; }
    if (hi - lo < 12) { const c = (lo + hi) / 2; lo = c - 6; hi = c + 6; }
    vs.sort((a, b) => a - b);
    const N = vs.length, p10 = N ? vs[Math.floor(0.1 * (N - 1))] : 40, p90 = N ? vs[Math.floor(0.9 * (N - 1))] : 100;
    const rep = new Map(), lastT = new Map(), lastJ = new Map();
    all.forEach((c, i) => {
      for (const n of c.notes) {
        const j = lastT.has(n.m) && c.t - lastT.get(n.m) <= 1.0 ? lastJ.get(n.m) + 1 : 0;
        rep.set(i + ':' + n.m, j); lastT.set(n.m, c.t); lastJ.set(n.m, j);
      }
    });
    const guard = !(N >= 3 && p90 - p10 >= 4);
    stats = { n: all.length, lo, hi, rep, uv: (v) => guard ? clamp((v - 40) / 60, 0, 1) : clamp((v - p10) / (p90 - p10), 0, 1) };
    return stats;
  }

  function strandOf(m, st) {
    let s = strands.get(m); if (s) return s;
    const W = 1280, H = 720;
    const up = clamp((m - st.lo) / (st.hi - st.lo), 0, 1);
    const L = 1180 + (140 - 1180) * up, ym = 570 - 420 * up;
    const thMax = (14 * Math.PI / 180) * (1 - 0.65 * (L - 140) / 1040);
    let th = (2 * hash(m, 3) - 1) * thMax;
    const room = Math.min(ym, H - ym) - 16;
    if (0.5 * L * Math.abs(Math.sin(th)) > room) th = Math.sign(th) * Math.asin(Math.min(1, room / (0.5 * L)));
    const Lx = L * Math.cos(th), cx = 30 + Lx / 2 + hash(m, 2) * (W - 60 - Lx);
    const dy = 0.5 * L * Math.sin(th);
    const side = ym < H / 2 ? 1 : -1;
    s = { L, ym, th, a0x: cx - Lx / 2, a0y: ym - dy, a1x: cx + Lx / 2, a1y: ym + dy,
      nx: -side * Math.sin(th), ny: side * Math.cos(th), r0: 0.2 + 0.2 * hash(m, 1),
      room2: Math.min(ym, H - ym) - 14 - 0.5 * L * Math.abs(Math.sin(th)) };
    strands.set(m, s); return s;
  }

  // The thread's shape at time t: points (s, offset) of the exact polyline.
  function shape(a, c, t, r, hpad, per) {
    const ks = hpad > 0 ? [r - hpad, r + hpad] : [r];
    const f0 = (s) => {
      if (s <= 0 || s >= 1) return 0;
      if (s < r - hpad) return s / (r - hpad);
      if (s <= r + hpad) return 1;
      return (1 - s) / (1 - r - hpad);
    };
    const F = (s) => { s = ((s % 2) + 2) % 2; return s <= 1 ? f0(s) : -f0(2 - s); };
    if (FORM === 'stand') {
      const p = t / per, tw = 4 * Math.abs((((p % 1) + 1) % 1) - 0.5) - 1;
      return [0, ...ks, 1].map((s) => [s, a * tw * f0(s)]);
    }
    const ct = c * t, bp = [0, 1];
    for (const k of ks) for (const sg of [1, -1]) for (const sc of [1, -1]) {
      const v = (((sg * k + sc * ct) % 2) + 2) % 2;
      if (v > 0 && v < 1) bp.push(v);
    }
    bp.sort((p, q) => p - q);
    const out = [];
    for (const s of bp) if (!out.length || s - out[out.length - 1][0] > 1e-6) out.push([s, a * 0.5 * (F(s - ct) + F(s + ct))]);
    return out;
  }

  const ends = (g, ay) => { ICON.rect(g, 3, ay - 1, 2, 2, ICON.ink); };

  TOOLS.push({
    id: 'pluck', name: 'Plucked corner', tag: 'new',
    blurb: 'Each note pulls its own straight thread aside: two straight lines and one hard corner, struck bone-white. The corner splits and runs, so the thread flaps through a triangle, a flat top and back, and the fading screen stacks its positions into a fan of straight hairlines. Then a thin red line stays a moment and goes. Bass threads are long, treble ones short; a repeated note pulls the same thread at a new point. Nothing in it is ever curved.',
    params: [
      { key: 'pull', label: 'how far it is pulled', min: 0.3, max: 2, value: 1, less: 0.6,
        hint: 'How far a note pulls its thread aside. Left: a small kink. Right: a wide corner far out of line.',
        icon: (g, v, w, h) => { const ay = h / 2, cx = 0.35 * w, cy = ay - (2 + v * (h / 2 - 4));
          ICON.line(g, 4, ay, cx, cy, ICON.gold, 1.5); ICON.line(g, cx, cy, w - 4, ay, ICON.gold, 1.5);
          ICON.rect(g, 3, ay - 1, 2, 2, ICON.ink); ICON.rect(g, w - 5, ay - 1, 2, 2, ICON.ink); } },
      { key: 'corner', label: 'how hard the corner is', min: 0, max: 1, value: 1,
        hint: 'How the thread is pulled. Left: by a soft finger, a short flat top between two corners. Right: one corner as hard as a ruled line.',
        icon: (g, v, w, h) => { const ay = h / 2, cx = 0.35 * w, cy = ay - (2 + 0.7 * (h / 2 - 4)), hp = (1 - v) * 6;
          ICON.line(g, 4, ay, cx - hp, cy, ICON.gold, 1.5); if (hp > 0) ICON.line(g, cx - hp, cy, cx + hp, cy, ICON.gold, 1.5);
          ICON.line(g, cx + hp, cy, w - 4, ay, ICON.gold, 1.5);
          ICON.rect(g, 3, ay - 1, 2, 2, ICON.ink); ICON.rect(g, w - 5, ay - 1, 2, 2, ICON.ink); } },
      { key: 'shiver', label: 'how long it shivers', min: 0.04, max: 0.16, value: 0.09,
        hint: 'How long the thread flaps after the pull. Left: one flap, then straight. Right: a few flaps, never long enough to look like a new note.',
        icon: (g, v, w, h) => { const n = 1 + Math.round(v * 4), ay = h / 2;
          for (let i = 0; i < n; i++) { const ap = (i % 2 ? 1 : -1) * (h / 2 - 4) * Math.pow(0.55, i), col = i ? ICON.dim : ICON.gold;
            ICON.line(g, 4, ay, 0.4 * w, ay + ap, col, 1.5); ICON.line(g, 0.4 * w, ay + ap, w - 4, ay, col, 1.5); }
          ICON.rect(g, 3, ay - 1, 2, 2, ICON.ink); ICON.rect(g, w - 5, ay - 1, 2, 2, ICON.ink); } },
      { key: 'ring', label: 'how long it rings', min: 0.25, max: 3, value: 1, less: 0.25,
        hint: 'How long the thin red line stays once the thread is straight. Left: gone in a quarter of the time. Right: three times as long.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red, 'line') },
      { key: 'touch', label: 'articulation', min: 0, max: 3, step: 1, value: 2,
        hint: 'How a note is played: staccato, marcato, piano, bell. Left: here and gone. Right: a bright strike that drops at once to a long, quiet ring.',
        icon: (g, v, w, h) => {
          const k = Math.round(v * 3), hl = [0.05, 0.1, 0.12, 0.22][k], tail = [0, 0, 0.22, 0.38][k], end = [0.35, 0.55, 1, 1][k];
          g.strokeStyle = ICON.gold; g.lineWidth = 1.5; g.beginPath(); g.moveTo(4, h - 3); g.lineTo(4, 3);
          for (let px = 5; px <= w - 3; px++) {
            const u = (px - 4) / (w - 7), e = u > end ? 0 : (1 - tail) * Math.pow(0.5, u / hl) + tail * Math.pow(0.5, u / (hl * 7));
            g.lineTo(px, h - 3 - (h - 6) * e);
          }
          g.stroke();
        } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much each note leaves: how far it pulls and how long its line stays. Left: small kinks, soon gone. Right: wide pulls that ring out. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { statsFor = null; stats = null; strands = new Map(); },
    onChord() {},
    frame(x) {
      const all = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i0 = chordAt(all, x.t); if (i0 < 0) return;
      const st = clipStats(all);
      const pull = x.p('pull') ?? 1, corner = x.p('corner') ?? 1, tau = x.p('shiver') ?? 0.09, ring = x.p('ring') ?? 1;
      const touchName = SNAP.TOUCH[clamp(Math.round(x.p('touch') ?? 2), 0, 3)];
      const LB = SNAP.preset(touchName).L * ring, picks = !!x.picked;
      const seen = new Set(), live = [];
      for (let i = i0; i >= 0 && all[i].t > x.t - LB; i--) {
        const ch = all[i], t = x.t - ch.t;
        for (const n of ch.notes) {
          if (seen.has(n.m)) continue;
          seen.add(n.m);
          const amt = n.amount ?? 1;
          const e = SNAP.env(t, { v: n.v, m: n.m, d: n.d, a: amt }, { preset: NOTAIL[touchName], ring, picks });
          if (!(t < e.L) || !(e.P > 0)) continue;
          const uv = st.uv(n.v), gn = SNAP.gain(amt);
          let Pn = Math.min(1, (0.65 + 0.35 * uv) * gn); if (picks) Pn = Math.max(Pn, 0.75);
          const q = e.E / e.P;
          if (Pn * q * 226 < 4) continue;
          const sd = strandOf(n.m, st), j = st.rep.get(i + ':' + n.m) || 0;
          const r = 0.2 + ((((sd.r0 - 0.2 + 0.07 * j) % 0.2) + 0.2) % 0.2);
          const hpad = Math.max(0, Math.min(r - 0.04, (1 - corner) * 0.12));
          const A = Math.max(6, Math.min(pull * (20 + 120 * uv), pull * 0.2 * sd.L, Math.max(6, sd.room2)) * Math.min(1.3, gn));
          const per = clamp(0.2 * Math.pow(sd.L / 1180, 0.4), 0.1, 0.2), c = 2 / per;
          const a = A * Math.exp(-t / tau);
          live.push({ sd, t, r, hpad, a, c, per, Pn, q, amt, body: e.body });
        }
      }
      if (!live.length) return;
      const g = x.g;
      g.save();
      g.lineCap = 'butt'; g.lineJoin = 'miter'; g.miterLimit = 6;
      for (const s of live) {
        const { sd, t } = s;
        const k = SNAP.core(s.amt) * SNAP.flash(t);
        tone(g, [0, 1, 2].map((ci) => RED[ci] + (BONE[ci] - RED[ci]) * k), s.Pn * Math.max(SNAP.flash(t), 0.55 * s.body));
        g.strokeStyle = g.fillStyle;
        g.lineWidth = 1.25 + 2.75 * SNAP.flash(t);
        const dx = sd.a1x - sd.a0x, dy = sd.a1y - sd.a0y;
        let pts;
        if (s.a < 0.5) pts = [[sd.a0x, sd.a0y], [sd.a1x, sd.a1y]];
        else pts = shape(s.a, s.c, t, s.r, s.hpad, s.per).map(([u, o]) => [sd.a0x + u * dx + o * sd.nx, sd.a0y + u * dy + o * sd.ny]);
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let p = 1; p < pts.length; p++) g.lineTo(pts[p][0], pts[p][1]);
        g.stroke();
        g.fillRect(sd.a0x - 2.5, sd.a0y - 2.5, 5, 5);
        g.fillRect(sd.a1x - 2.5, sd.a1y - 2.5, 5, 5);
      }
      g.restore();
    },
  });
})();
