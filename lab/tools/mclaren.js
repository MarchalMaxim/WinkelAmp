// McLaren v2: after Norman McLaren's Synchromy (1971), where you see the soundtrack you hear. The screen is a row of tall
// panels, strips of film side by side, and the film runs: it enters at the top edge and streams down. Every note is
// printed into the film as a block of horizontal bars, as a soundtrack card would be:
//  - the pitch sets how fine the bars are (a deep note: a few thick rungs; a high note: a fine, dense comb);
//  - the loudness sets how wide the bars are and how deep the strike punches into the film at once (a loud note lands as a
//    long run of bars reaching far down the panel the instant it is played; a soft one as a short shallow print);
//  - each note is a card: a strip of darker ground, as wide as the note is loud, with its bars on it; the bars are thickest
//    where the note was struck (the card's lower edge, which leads the way down) and get finer towards the top as the note
//    decays, and a held note keeps growing at the top edge. A new card covers the older ones under it, so a note cuts
//    cleanly into the weave instead of muddying it;
//  - after the note ends the card thins away as it travels, so the panel holds the last few seconds of music: sparse
//    music is single cards with ground between them, busy music a packed, layered weave.
// The panel is chosen by the note's pitch class (around the circle of fifths, so a chord lands in several panels), and the
// print is echoed outward across the other panels, narrower and a beat later, so a strike ripples sideways. Each strike also
// lights its panel's ground up for a moment, in its own colour (a loud strike on a quiet panel turns it negative, as in the
// film); in busy music the light is shared out so it never strobes. Neighbouring panels swap a pair of flat colours that
// follow the harmony; busy music splits the screen into more panels (1, 3, 5, 7, 9, from the middle out), calm music
// merges them.
// The how present knob (the user: sliders should dim, not only boost; added without a new version, the tag stays v2): turned
// down, the picture sinks toward nothing and lets what is under it show, the film slows, cards are smaller and echo less,
// the panels stop flashing, and only the hardest notes of the piece print a card. The hue still follows every note.
(() => {
  const SLOTS = 9, MID = 4, CAP = 40;
  // the order panels appear in: the middle first, then a pair either side, and so on
  const RANK = Array.from({ length: SLOTS }, (_, s) => Math.abs(s - MID) * 2 - (s < MID ? 1 : 0));
  let wgt, prints, chroma, hue, glow, flash, heat, vels = null, layer = null, lg = null;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  // a factor for how present: a at 0, exactly 1 at 1, so the full-strength picture is untouched
  const toward1 = (a, pres) => (pres >= 1 ? 1 : a + (1 - a) * pres);
  // how present: which notes print, judged against this piece's own notes (recordings differ a lot in how hard they
  // play): every one at 1, the hardest 40% at 0.4, the hardest 5% at 0
  const hardEnough = (v, pres) => {
    const cut = (1 - pres) * 0.95;
    if (cut <= 0) return true;
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= cut;
  };
  // HSL → [r,g,b]
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const WHITE = [255, 250, 240];
  // a note's bar spacing in pixels: two octaves below middle C ≈ 64 px, three octaves above ≈ 5 px
  const period = (m) => Math.max(5, 64 * Math.pow(2, -(m - 36) / 13));
  // film speed in pixels per second
  const speedOf = (v) => 70 + 600 * v;
  // the panel colours: two hues a little more than opposite each other, from the harmony; neighbouring panels swap them
  // (one panel's bars are the next one's ground, as in Synchromy), and the pair drifts a little from panel to panel
  function pair(h, odd, field, bright) {
    const a = h, b = h + 160, gh = odd ? b : a, ih = odd ? a : b;
    return [hsl(gh, 0.7, lerp(0.05, 0.32, field) * (0.7 + 0.3 * bright)), hsl(ih, 0.92, 0.58)];
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
    life(g, v, w, h) {                                    // a card whose bars thin out near the top, or trail all the way down
      ICON.rect(g, 12, 2, 16, h - 4, '#2a2240');
      const L = 3 + v * (h - 9);
      for (let y = 2; y < 2 + L; y += 3) { const k = 1 - (y - 2) / (L + 2); g.fillStyle = ICON.gold; g.fillRect(13, y, 14, 0.6 + 1.6 * k); }
    },
    field(g, v, w, h) {                                   // dark panels with coloured bars, or flat coloured panels
      const cw = (w - 4) / 3;
      for (let i = 0; i < 3; i++) { const [gr, ink] = pair(250 + (i - 1) * 16, i % 2 === 1, v, 1); strip(g, 2 + i * cw + 0.5, cw - 1, h, 4, 0.7, rgb(gr), rgb(ink)); }
    },
    scroll(g, v, w, h) {                                  // film crawling, or streaming down
      strip(g, 4, 14, h, 4, 0.8, '#2a2240', ICON.gold);
      ICON.arrow(g, 29, 5, 29, 9 + v * 12, ICON.ink, 1.2 + v);
    },
    presence(g, v, w, h) {                                // three strips, faint with short bars, or solid with long ones
      const cw = (w - 4) / 3;
      for (let i = 0; i < 3; i++) { const [gr, ink] = pair(250 + (i - 1) * 16, i % 2 === 1, 0.4, 1); ICON.alpha(g, 0.15 + 0.85 * v, () => strip(g, 2 + i * cw + 0.5, cw - 1, h, 4, 0.3 + 0.5 * v, rgb(gr), rgb(ink))); }
    },
  };

  TOOLS.push({
    id: 'mclaren', name: 'McLaren', tag: 'v2',
    blurb: 'After Norman McLaren\'s Synchromy. New: the film runs. Every note is a card of bars that enters at the top and streams down (deep notes a few thick rungs, high notes a fine comb); a loud note punches a long, wide card deep into the panel and lights it up, a soft one leaves a small shallow print, and each new card cuts cleanly over the older ones, so sparse music shows single cards with space between them and busy music a layered weave.',
    params: [
      { key: 'panels', label: 'how many panels', min: 1, max: 9, step: 1, value: 3, drive: '+rate',
        hint: 'How many strips the screen is split into. Left: one wide panel. Right: up to 9 narrow ones (busy music adds more).',
        icon: ICONS.panels },
      { key: 'spread', label: 'how far a note echoes', min: 0, max: 1, value: 0.55, less: 0,
        hint: 'How far each note\'s bars are repeated into the neighbouring panels. Left: only its own panel. Right: across every panel.',
        icon: ICONS.spread },
      { key: 'life', label: 'how long the bars stay', min: 0.15, max: 4, value: 1.4, less: 0.5,
        hint: 'How long a note\'s bars stay on the film after it ends. Left: they vanish near the top. Right: they trail all the way down.',
        icon: ICONS.life },
      { key: 'field', label: 'dark or coloured panels', min: 0, max: 1, value: 0.4, drive: '+level',
        hint: 'The panels behind the bars. Left: nearly black, only the bars are coloured. Right: flat, bright fields of colour.',
        icon: ICONS.field },
      { key: 'scroll', label: 'how fast the film runs', min: 0, max: 1, value: 0.35,
        hint: 'How fast the film streams down the panels. Left: a slow crawl, notes stack up short and close. Right: streaming, notes stretch out long.',
        icon: ICONS.scroll },
      { key: 'howmuch', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much film it prints: how far each note echoes into the other panels and how long its bars stay. Left: each note only in its own panel, with bars that are gone soon after it ends, so panels stand empty between notes. Right: notes echo into their neighbours and leave long trails, a layered weave. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
      { key: 'presence', label: 'old: how faint', old: true, min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: a faint, slow film where only the hardest notes print a card. Right: every note prints at full strength (as before).',
        icon: ICONS.presence },
    ],
    reset() {
      wgt = RANK.map((r) => (r < 3 ? 1 : 0)); prints = Array.from({ length: SLOTS }, () => []);
      vels = null; chroma = new Array(12).fill(0); hue = 250; glow = 0; flash = new Array(SLOTS).fill(0); heat = new Array(SLOTS).fill(0);
    },
    onChord(ch, x) {
      const N = Math.max(1, Math.min(SLOTS, 1 + 2 * Math.round((x.p('panels') - 1) / 2)));
      // the panels the music can print into: the target ones, left to right
      const act = []; for (let s = 0; s < SLOTS; s++) if (RANK[s] < N) act.push(s);
      const pres = clamp01(x.p('presence'));
      const reach = x.p('spread') * (act.length - 1) * pres + 0.5;
      // at most five notes per attack: the loudest of each pitch class
      const by = new Map(); for (const n of ch.notes) { const pc = n.m % 12; if (!by.has(pc) || by.get(pc).v < n.v) by.set(pc, n); }
      const notes = [...by.values()].sort((a, b) => b.v - a.v).slice(0, 5).filter((n) => hardEnough(n.v, pres));
      for (const n of ch.notes) chroma[n.m % 12] += n.v / 127;
      if (notes.length) glow = Math.max(glow, ch.vel / 115);
      const H = x.H;
      for (const n of notes) {
        const pc = n.m % 12, f5 = (pc * 7) % 12;
        const home = Math.min(act.length - 1, Math.floor((f5 / 12) * act.length));
        const P = period(n.m), vel = clamp01(n.v / 110), hi = clamp01((n.m - 30) / 66);
        const hold = Math.max(0.05, Math.min(n.d, 6));
        // how deep the strike punches into the film at once: loud notes reach far down the panel
        const D = Math.max(P * 1.15 + 4, H * (0.05 + 0.42 * Math.pow(vel, 1.6) * toward1(0.25, pres)));
        for (let i = 0; i < act.length; i++) {
          const d = Math.abs(i - home), a = 1 - d / reach;
          if (a <= 0.05) continue;
          const L = prints[act[i]];
          L.push({
            P, th: P * lerp(0.56, 0.42, hi), hi, vel, a,
            wide: (0.2 + 0.72 * vel) * (0.4 + 0.6 * a) * toward1(0.6, pres),     // bar width, as a share of the panel
            D: D * (0.45 + 0.55 * a), y: -1, len: 0,          // y: how far the struck edge has run down (set on landing)
            age: -d * 0.045, hold, home: d === 0,
          });
          if (L.length > CAP) {   // too many on this panel: drop the faintest
            let k = 0, lo = Infinity;
            for (let j = 0; j < L.length; j++) { const p = L[j], s = (p.age < p.hold ? 1 : 0.5) * p.wide - Math.max(0, p.age) * 0.05; if (s < lo) { lo = s; k = j; } }
            L.splice(k, 1);
          }
        }
      }
    },
    frame(x) {
      const dt = x.dt, W = x.W, H = x.H, pres = clamp01(x.p('presence'));
      // below full presence the picture is built on its own canvas, so it can sink as a whole (the cards stay opaque to
      // each other) and be laid over the stage at the end
      if (pres < 1) {   // at the real canvas's size, so a supersampled picture stays sharp
        const c = x.g.canvas;
        if (!layer || layer.width !== c.width || layer.height !== c.height) { layer = Object.assign(document.createElement('canvas'), { width: c.width, height: c.height }); lg = layer.getContext('2d'); }
        lg.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
      }
      const g = pres < 1 ? lg : x.g;
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
      const fd = Math.pow(0.5, dt / 0.07), hd = Math.pow(0.5, dt / 0.6);
      const field = clamp01(x.p('field')), life = x.p('life'), run = speedOf(clamp01(x.p('scroll'))) * dt * toward1(0.2, pres);
      const tot = wgt.reduce((a, b) => a + b, 0) || 1, gap = 3;
      let px = 0, j = 0; const vis = wgt.filter((w) => w > 0.004).length;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      for (let s = 0; s < SLOTS; s++) {
        const pw = (wgt[s] / tot) * W; const x0 = px; px += pw;
        flash[s] *= fd; heat[s] *= hd;
        // a panel that is still splitting off or merging away keeps its film running
        const L = prints[s];
        for (const p of L) {
          const was = p.age; p.age += dt;
          if (p.age < 0) continue;
          if (was < 0 || p.y < 0) {
            // the strike lands: it punches its first run of bars into the film and lifts the panel's ground; a panel
            // that has just been struck a lot takes a smaller lift, so busy music shimmers instead of strobing
            p.y = p.D; p.len = p.D;
            const lift = p.vel * p.vel * (p.home ? 1 : 0.45) * p.a / (1 + 1.6 * heat[s]) * pres;
            flash[s] = Math.max(flash[s], lift); heat[s] += p.home ? 0.6 + p.vel : 0.2;
          } else {
            p.y += run; if (p.age < p.hold) p.len += run;
          }
        }
        prints[s] = L.filter((p) => p.age < 0 || (p.age < p.hold + life && p.y - p.len < H));
        if (pw < 1.5) continue;
        const [ground, ink] = colours(j++, vis, field, glow);
        const w = pw - gap, xl = x0 + gap / 2, cxp = xl + w / 2;
        // a strong lift turns the panel negative for a moment (ground in ink, bars in ground), a gentle one lights it up
        const fl = flash[s], neg = fl > 0.55;
        const lit = 1 + 1.8 * fl, back = neg ? mix(ink, WHITE, 0.2) : [Math.min(255, ground[0] * lit), Math.min(255, ground[1] * lit), Math.min(255, ground[2] * lit)];
        g.fillStyle = rgb(back); g.fillRect(xl, 0, w, H);
        // first the shape of every card on this panel, then the cards drawn oldest first; a card that a newer one covers
        // completely is skipped (the newer card is opaque, so the picture is the same, only cheaper in busy music)
        const cards = [];
        for (const p of prints[s]) {
          if (p.age < 0) continue;
          const f = p.age < p.hold ? 1 : Math.pow(Math.max(0, 1 - (p.age - p.hold) / life), 1.3);
          if (f < 0.02) continue;
          const born = Math.max(0, 1 - p.age / 0.2);
          const P = p.P, bw = Math.min(w, w * p.wide * (0.4 + 0.6 * f) * (1 + 0.15 * born));
          const yA = p.y, top = yA - Math.max(p.len, P * 1.1), x0b = cxp - bw / 2;
          const cy0 = Math.max(0, top - P * 0.5), cy1 = Math.min(H, yA + 2), hw = Math.min(w, bw * 1.12) / 2 + 2;
          cards.push({ p, f, born, bw, yA, top, x0b, cy0, cy1, t0: Math.max(0, top - P * 0.6), l: cxp - hw, r: cxp + hw });
        }
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i];
          let hid = false;
          for (let k = i + 1; k < cards.length && !hid; k++) { const o = cards[k]; hid = o.x0b - 2 <= c.l && o.x0b + o.bw + 2 >= c.r && o.cy0 <= c.t0 && o.cy1 >= c.cy1; }
          if (hid) continue;
          const { p, f, born, bw, yA, top, x0b, cy0, cy1 } = c;
          // high notes print in a lighter ink, deep ones in a deeper one
          const tone = mix(ink, p.hi > 0.5 ? WHITE : [0, 0, 0], Math.abs(p.hi - 0.5) * 0.3);
          const col = neg ? ground : mix(tone, WHITE, 0.2 * born);
          const P = p.P, th = p.th * (0.25 + 0.75 * f);
          // the struck edge (lowest bar) leads; bars go up from it, all as wide as the note is loud, each a little thinner
          // as the note decays, so a block reads as a card of bars that gets finer towards its top
          const tau = Math.max(40, p.D * 0.9);
          let k0 = Math.max(0, Math.floor((yA - H) / P)), k1 = Math.floor((yA - Math.max(0, top)) / P);
          // each print is a card: its own strip of ground, a shade darker, covers the older prints under it, so a new
          // note cuts cleanly into the weave instead of muddying it
          if (cy1 > cy0) { g.fillStyle = rgb(mix(mix(back, [0, 0, 0], 0.32), col, 0.1 * born)); g.fillRect(x0b - 2, cy0, bw + 4, cy1 - cy0); }
          g.fillStyle = rgb(col); g.beginPath();
          for (let k = k0; k <= k1; k++) {
            const bh = Math.max(1, th * (0.4 + 0.6 * Math.exp(-(k * P) / tau)));
            const yb = yA - k * P - bh; if (yb > H) continue; if (yb + bh < 0) break;
            g.rect(x0b, yb, bw, bh);
          }
          g.fill();
          // the struck edge itself: a bright, slightly wider bar while the strike is fresh
          if (born > 0 && yA - th < H && !neg) {
            const bw2 = Math.min(w, bw * 1.12), bh = Math.max(1.5, th);
            g.fillStyle = rgb(mix(col, WHITE, 0.55 * born)); g.fillRect(cxp - bw2 / 2, yA - bh, bw2, bh);
          }
        }
      }
      if (pres < 1) {
        // sink the picture toward black, then lay it over the stage: its black lets the stage show as far as presence
        // allows, and 'lighten' keeps the level steady under the stage's own slow fade instead of piling up
        lg.fillStyle = `rgba(0,0,0,${0.88 * (1 - pres)})`; lg.fillRect(0, 0, W, H);
        const st = x.g;
        st.fillStyle = `rgba(0,0,0,${pres})`; st.fillRect(0, 0, W, H);
        st.globalCompositeOperation = 'lighten'; st.drawImage(layer, 0, 0, W, H); st.globalCompositeOperation = 'source-over';
      }
    },
  });
})();
