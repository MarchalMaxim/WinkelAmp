// McLaren: after Norman McLaren's Synchromy (1971), where you see the soundtrack you hear. The screen is a row of tall
// panels, like strips of film side by side. Every note prints its own pattern of bars into a panel: the pitch sets how fine
// the bars are (a deep note: a few thick rungs; a high note: a fine, dense comb), the loudness how far they reach across the
// panel. The panel is chosen by the note's pitch class (around the circle of fifths, so a chord lands in several panels), and
// the print is repeated outward across the other panels, each in its own flat colour pair, smaller the further it travels.
// The colours follow the harmony; the bars scroll down like film; and when the music gets busy the panels multiply
// (1, 3, 5, 7, 9, splitting from the middle out), then merge again when it calms down.
(() => {
  const SLOTS = 9, MID = 4;
  // the order panels appear in: the middle first, then a pair either side, and so on
  const RANK = Array.from({ length: SLOTS }, (_, s) => Math.abs(s - MID) * 2 - (s < MID ? 1 : 0));
  let wgt, prints, chroma, hue, scroll, glow;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  // HSL → [r,g,b]
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  // a note's bar spacing in pixels: two octaves below middle C ≈ 70 px, three octaves above ≈ 4 px
  const period = (m) => Math.max(4, 70 * Math.pow(2, -(m - 36) / 13));
  // the panel colours: panel j's ground and ink, from the harmony's hue
  // the panel colours: two hues a little more than opposite each other, from the harmony; neighbouring panels swap them
  // (one panel's bars are the next one's ground, as in Synchromy), and the pair drifts a little from panel to panel
  function pair(h, odd, field, bright) {
    const a = h, b = h + 160, gh = odd ? b : a, ih = odd ? a : b;
    return [hsl(gh, 0.78, lerp(0.04, 0.34, field) * (0.6 + 0.4 * bright)), hsl(ih, 0.95, 0.6)];
  }
  const colours = (j, n, field, bright) => pair(hue + (j - (n - 1) / 2) * 16, j % 2 === 1, field, bright);

  // knob pictures
  const strip = (g, x, w, h, P, len, ground, ink) => {
    ICON.rect(g, x, 2, w, h - 4, ground);
    g.fillStyle = ink; const bw = w * len;
    for (let y = 2; y < h - 2; y += P) g.fillRect(x + (w - bw) / 2, y, bw, Math.min(P / 2, h - 2 - y));
  };
  const ICONS = {
    panels(g, v, w, h) {                                  // one wide strip, or many narrow ones
      const n = 1 + 2 * Math.round(v * 3), cw = (w - 4) / n, cols = ['#3a2a6a', '#5a1f2a', '#1f4a3a', '#5a4a1a'];
      for (let i = 0; i < n; i++) strip(g, 2 + i * cw + 0.5, cw - 1, h, 4, 0.75, cols[Math.abs(i - (n - 1) / 2) % 4], i === (n - 1) / 2 ? ICON.gold : ICON.ink);
    },
    spread(g, v, w, h) {                                  // the print only in its own panel, or echoed across them all
      const n = 5, cw = (w - 4) / n;
      for (let i = 0; i < n; i++) { const d = Math.abs(i - 2), a = Math.max(0, 1 - d / (v * 2.6 + 0.4)); strip(g, 2 + i * cw + 0.5, cw - 1, h, 4, 0.85 * a, '#2a2240', ICON.gold); }
    },
    life(g, v, w, h) { ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.gold, 'square'); },
    field(g, v, w, h) {                                   // dark panels with coloured bars, or flat coloured panels
      const cw = (w - 4) / 3;
      for (let i = 0; i < 3; i++) { const [gr, ink] = pair(250 + (i - 1) * 16, i % 2 === 1, v, 1); strip(g, 2 + i * cw + 0.5, cw - 1, h, 4, 0.7, rgb(gr), rgb(ink)); }
    },
    scroll(g, v, w, h) {                                  // still bars, or bars streaming down
      strip(g, 4, 14, h, 4, 0.8, '#2a2240', ICON.gold);
      if (v > 0.05) ICON.arrow(g, 29, 5, 29, 5 + 4 + v * 13, ICON.ink, 1.2 + v);
      else ICON.line(g, 24, h / 2, 34, h / 2, ICON.dim, 1.5);
    },
  };

  TOOLS.push({
    id: 'mclaren', name: 'McLaren', tag: 'new',
    blurb: 'After Norman McLaren\'s Synchromy, where you see the soundtrack: tall panels side by side, and every note prints its own bars into one of them. Deep notes are a few thick rungs, high notes a fine dense comb, loud notes reach across the panel. The print echoes outward across the panels in other flat colours, the colours follow the harmony, the bars scroll down like film, and busy music splits the screen into more and more panels.',
    params: [
      { key: 'panels', label: 'how many panels', min: 1, max: 9, step: 1, value: 3, drive: '+rate',
        hint: 'How many strips the screen is split into. Left: one wide panel. Right: up to 9 narrow ones (busy music adds more).',
        icon: ICONS.panels },
      { key: 'spread', label: 'how far a note echoes', min: 0, max: 1, value: 0.6,
        hint: 'How far each note\'s bars are repeated into the neighbouring panels. Left: only its own panel. Right: across every panel.',
        icon: ICONS.spread },
      { key: 'life', label: 'how long the bars stay', min: 0.15, max: 3, value: 1.1,
        hint: 'How long the bars stay after the note ends. Left: a flicker. Right: they linger for seconds.',
        icon: ICONS.life },
      { key: 'field', label: 'dark or coloured panels', min: 0, max: 1, value: 0.45, drive: '+level',
        hint: 'The panels behind the bars. Left: nearly black, only the bars are coloured. Right: flat, bright fields of colour.',
        icon: ICONS.field },
      { key: 'scroll', label: 'how fast the bars stream', min: 0, max: 1, value: 0.35,
        hint: 'How fast the bars slide down the panels, like film through a projector. Left: still. Right: streaming.',
        icon: ICONS.scroll },
    ],
    reset() {
      wgt = RANK.map((r) => (r < 3 ? 1 : 0)); prints = Array.from({ length: SLOTS }, () => []);
      chroma = new Array(12).fill(0); hue = 250; scroll = 0; glow = 0;
    },
    onChord(ch, x) {
      const N = Math.max(1, Math.min(SLOTS, 1 + 2 * Math.round((x.p('panels') - 1) / 2)));
      // the panels the music can print into: the target ones, left to right
      const act = []; for (let s = 0; s < SLOTS; s++) if (RANK[s] < N) act.push(s);
      const reach = x.p('spread') * (act.length - 1) + 0.5;
      // at most five notes per attack: the loudest of each pitch class
      const by = new Map(); for (const n of ch.notes) { const pc = n.m % 12; if (!by.has(pc) || by.get(pc).v < n.v) by.set(pc, n); }
      const notes = [...by.values()].sort((a, b) => b.v - a.v).slice(0, 5);
      for (const n of ch.notes) chroma[n.m % 12] += n.v / 127;
      glow = Math.max(glow, ch.vel / 115);
      for (const n of notes) {
        const pc = n.m % 12, f5 = (pc * 7) % 12;
        const home = Math.min(act.length - 1, Math.floor((f5 / 12) * act.length));
        const P = period(n.m), vel = clamp01(n.v / 115);
        const hold = Math.max(0.12, Math.min(n.d, 6));
        for (let i = 0; i < act.length; i++) {
          const d = Math.abs(i - home), a = 1 - d / reach;
          if (a <= 0.05) continue;
          const L = prints[act[i]];
          L.push({ P, len: (0.22 + 0.74 * vel) * (0.35 + 0.65 * a), a, age: -d * 0.035, hold, flash: d === 0 ? 0.04 + 0.12 * vel : 0, home: d === 0 });
          if (L.length > 4) { L.sort((p, q) => q.age - p.age); L.shift(); }  // keep the newest four
        }
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H;
      // the panels split from the middle out as the target count grows, and merge back
      const N = Math.max(1, Math.min(SLOTS, 1 + 2 * Math.round((x.p('panels') - 1) / 2)));
      const kk = 1 - Math.pow(0.5, dt / 0.18);
      for (let s = 0; s < SLOTS; s++) wgt[s] += ((RANK[s] < N ? 1 : 0) - wgt[s]) * kk;
      // the harmony's hue: the sounding pitch classes, as a direction on the circle of fifths
      const cd = Math.pow(0.5, dt / 1.6); let cx = 0, cy = 0;
      for (let pc = 0; pc < 12; pc++) { chroma[pc] *= cd; const a = (((pc * 7) % 12) / 12) * Math.PI * 2; cx += Math.cos(a) * chroma[pc]; cy += Math.sin(a) * chroma[pc]; }
      if (cx * cx + cy * cy > 0.01) {
        const target = (Math.atan2(cy, cx) * 180) / Math.PI + 200;
        let dh = ((target - hue) % 360 + 540) % 360 - 180; hue += dh * (1 - Math.pow(0.5, dt / 0.6));
      }
      glow *= Math.pow(0.5, dt / 1.2);
      scroll += dt * x.p('scroll') * 260;
      const field = clamp01(x.p('field')), life = x.p('life');
      const tot = wgt.reduce((a, b) => a + b, 0) || 1, gap = 3;
      let px = 0, j = 0; const vis = wgt.filter((w) => w > 0.004).length;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      for (let s = 0; s < SLOTS; s++) {
        const pw = (wgt[s] / tot) * W; const x0 = px; px += pw;
        // a panel that is still splitting off or merging away still keeps its prints ageing
        const L = prints[s];
        for (const p of L) p.age += dt;
        prints[s] = L.filter((p) => p.age < p.hold + life);
        if (pw < 1.5) continue;
        const [ground, ink] = colours(j++, vis, field, glow);
        const w = pw - gap, xl = x0 + gap / 2;
        // an attack in its own panel: the panel flashes in negative for a few frames
        let neg = 0; for (const p of prints[s]) if (p.flash > 0 && p.age >= 0 && p.age < p.flash) neg = 1;
        g.fillStyle = rgb(neg ? mix(ink, [255, 255, 255], 0.25) : ground); g.fillRect(xl, 0, w, H);
        for (const p of prints[s]) {
          if (p.age < 0) continue;
          const f = p.age < p.hold ? 1 : Math.pow(Math.max(0, 1 - (p.age - p.hold) / life), 1.4);
          if (f < 0.02) continue;
          const born = Math.max(0, 1 - p.age / 0.12);           // a fresh print lands a touch wider and brighter
          // a print fades by thinning (its bars get narrower and shorter), so its colour stays clean to the end
          const col = neg ? ground : mix(ground, mix(ink, [255, 255, 255], 0.35 * born), Math.min(1, 0.55 + f));
          const bw = Math.min(w, w * p.len * (0.45 + 0.55 * f) * (1 + 0.12 * born)), bx = xl + (w - bw) / 2;
          const P = p.P, bh = Math.max(0.8, P * 0.5 * (0.2 + 0.8 * f));
          let y = (scroll % P) - P;
          g.fillStyle = rgb(col); g.beginPath();
          for (; y < H; y += P) g.rect(bx, y, bw, bh);
          g.fill();
        }
      }
    },
  });
})();
