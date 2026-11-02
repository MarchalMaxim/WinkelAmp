// Agnes Martin: a quiet widget for quiet music. A pale canvas with a margin, ten horizontal bands of washed colour
// (rose, grey, faint blue, bare paper) and a fine pencil grid over them. The bands are the keyboard, low at the bottom:
// each note faintly deepens the band at its pitch, and a note that is held tints its own thin stripe (one semitone) in a
// colour from the harmony (near the home key rose, the sharp side pale ochre, the flat side faint blue). Loud notes
// barely count (a soft note counts fully, a fortissimo one about a tenth), so the fff tolling and the climax leave it
// almost still, and the chorale and the oboe cadenza draw on it. With nothing playing it is still a finished picture,
// breathing very slowly. It paints its own canvas (opaque), so it hides the widgets drawn before it.
// A sixth knob, how present (the user, 2026-11-01: the sliders should dim, not only boost). Turned down, the paper, the bands
// and the pencil fade together and let through what lies under them, the breathing stills, and fewer notes mark it.
(() => {
  const TAU = Math.PI * 2;
  const LO = 36, HI = 96, SEMI = HI - LO, BAND = 6, NB = SEMI / BAND;   // C2..C7, ten bands of six semitones
  const MX = 72, MY = 42;                                               // the unpainted margin round the field
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
  const DARK = [19, 18, 21], PALE = [236, 231, 220];                    // night ground, day ground (warm off-white)
  const GRAPHITE = [62, 60, 66], CHALK = [214, 208, 198];
  // Wash colours: a pale tone (the band's resting wash, and what a mark adds on a dark ground) and a deep one (a mark on
  // a pale ground).
  const COL = {
    rose:  { pale: [222, 170, 168], deep: [176, 104, 108] },
    blue:  { pale: [168, 188, 212], deep: [98, 124, 160] },
    grey:  { pale: [186, 182, 176], deep: [118, 114, 112] },
    ochre: { pale: [226, 200, 150], deep: [178, 140, 82] },
    paper: { pale: [214, 206, 192], deep: [140, 132, 122] },
  };
  // Bands from the bottom (bass) up. 'paper' bands rest bare and only show when a note marks them.
  const BANDS = ['grey', 'paper', 'rose', 'paper', 'blue', 'rose', 'paper', 'blue', 'paper', 'rose'];
  const REST = { rose: 1, blue: 1, grey: 0.8, ochre: 1, paper: 0 };

  let W = 1280, H = 720, FW = W - 2 * MX, FH = H - 2 * MY, SH = FH / SEMI, BH = FH / NB;
  const yOfSemi = (s) => MY + (SEMI - 1 - s) * SH;                       // top of semitone stripe s (0 = lowest)
  const yOfBand = (b) => MY + (NB - 1 - b) * BH;
  const semiOf = (m) => clamp(Math.round(m) - LO, 0, SEMI - 1);
  // A soft note counts fully, a loud one barely: velocity 33 → 1, 61 → 0.94, 77 → 0.62, 94 → 0.28, 105+ → 0.06.
  const quiet = (v) => clamp((108 - v) / 50, 0.06, 1);

  // how present (0..1): which notes mark it, judged against this piece's own notes. A note ranks by the mark it would leave
  // (this widget answers soft long notes, so the loudest notes would leave none: "the hardest" would mean a dead picture):
  // every note at 1, the strongest 40% at 0.4, the strongest 5% at 0.
  const strength = (v, d) => quiet(v) * (0.7 + 0.3 * Math.min(1, d / 0.6));
  let ranks = null;
  const marks = (v, d, pres) => {
    const cut = (1 - pres) * 0.95;
    if (cut <= 0) return true;
    if (!ranks) ranks = (window.NOTES || []).map((n) => strength(n[3], n[1] - n[0])).sort((a, b) => a - b);
    if (!ranks.length) return true;
    const k = strength(v, d); let a = 0, b = ranks.length; while (a < b) { const i = (a + b) >> 1; if (ranks[i] <= k) a = i + 1; else b = i; }
    return a / ranks.length >= cut;   // equal strengths count as passed: many soft long notes tie at the top
  };
  // How much of its light the page keeps: about a third at the middle, 3% at the left end.
  const lamp = (pres) => 0.03 + 0.97 * Math.pow(pres, 1.5);

  // ---- static layers: the ground (paper grain) and the pencil grid, re-made only when their knobs move a step.
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const groundC = mk(), gridC = mk();
  let dimmed = null;                                                     // how present below 1: the picture is drawn here first
  let groundKey = '', gridKey = '';
  function makeGround(day) {
    const gg = groundC.getContext('2d'), R = ICON.rng(11), base = mix(DARK, PALE, day);
    gg.globalAlpha = 1; gg.fillStyle = rgb(base); gg.fillRect(0, 0, W, H);
    // Paper tooth: faint specks and a few long fibres, darker on day paper, lighter on night.
    const spk = day > 0.5 ? [0, 0, 0] : [255, 255, 255];
    for (let i = 0; i < 2600; i++) { gg.fillStyle = rgb(spk, 0.012 + R() * 0.03); gg.fillRect(R() * W, R() * H, 1 + R() * 1.5, 1 + R() * 1.5); }
    for (let i = 0; i < 90; i++) { gg.fillStyle = rgb(spk, 0.012 + R() * 0.015); gg.fillRect(R() * W, R() * H, 30 + R() * 140, 1); }
    // The field is a shade lighter than the margin on day paper (gesso), a shade deeper on night.
    gg.fillStyle = day > 0.5 ? 'rgba(255,253,248,0.22)' : 'rgba(0,0,0,0.18)'; gg.fillRect(MX, MY, FW, FH);
  }
  // Grid fineness 0..1 → how often a horizontal line falls (in semitones) and how many vertical lines.
  const gridSteps = (v) => ({ hs: v < 0.25 ? 6 : v < 0.5 ? 3 : v < 0.75 ? 2 : 1, nv: v < 0.2 ? 0 : Math.round(6 + 70 * ((v - 0.2) / 0.8) ** 1.3) });
  function pencil(gg, x1, y1, x2, y2, col, a, R) {
    // A ruled pencil line: short pieces of varying pressure, a hair of wobble.
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len / 26));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, j = (R() - 0.5) * 0.5;
      gg.strokeStyle = rgb(col, a * (0.55 + R() * 0.45)); gg.beginPath();
      gg.moveTo(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0 + j); gg.lineTo(x1 + (x2 - x1) * t1 + 0.6, y1 + (y2 - y1) * t1 + j); gg.stroke();
    }
  }
  function makeGrid(v, day) {
    const gg = gridC.getContext('2d'), R = ICON.rng(29), { hs, nv } = gridSteps(v);
    const col = day > 0.5 ? GRAPHITE : CHALK, a = day > 0.5 ? 0.42 : 0.26;
    gg.clearRect(0, 0, W, H); gg.lineWidth = 0.75; gg.lineCap = 'butt';
    for (let s = 0; s <= SEMI; s += hs) {
      const y = MY + s * SH, edge = s % BAND === 0;
      pencil(gg, MX, y, MX + FW, y, col, edge ? a * 1.15 : a * 0.8, R);
      if (edge && s > 0 && s < SEMI) pencil(gg, MX, y + 2.5, MX + FW, y + 2.5, col, a * 0.55, R);   // band edges ruled twice
    }
    for (let i = 0; i <= nv; i++) { const x = MX + (nv ? (i / nv) * FW : 0); if (nv) pencil(gg, x, MY, x, MY + FH, col, a * 0.7, R); }
    if (!nv) { pencil(gg, MX, MY, MX, MY + FH, col, a * 0.8, R); pencil(gg, MX + FW, MY, MX + FW, MY + FH, col, a * 0.8, R); }
  }
  // Wash strips, one per colour and tone: a band-sized strip of colour with dragged-brush streaks and soft long edges.
  const strips = {};
  function strip(name, tone) {
    const k = name + tone; if (strips[k]) return strips[k];
    const c = document.createElement('canvas'); c.width = Math.ceil(FW); c.height = Math.ceil(BH); const sg = c.getContext('2d'), R = ICON.rng(name.length * 7 + (tone === 'deep' ? 3 : 1));
    sg.fillStyle = rgb(COL[name][tone]); sg.fillRect(0, 0, c.width, c.height);
    sg.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 110; i++) { const y = R() * c.height, x = R() * c.width * 0.8; sg.fillStyle = `rgba(0,0,0,${(R() * 0.16).toFixed(3)})`; sg.fillRect(x, y, 160 + R() * c.width * 0.7, 2 + R() * 5); }
    for (const [y0, y1] of [[0, 5], [c.height, c.height - 5]]) { const gr = sg.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(0, Math.min(y0, y1), c.width, 5); }
    for (const [x0, x1] of [[0, 14], [c.width, c.width - 14]]) { const gr = sg.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(Math.min(x0, x1), 0, 14, c.height); }
    return (strips[k] = c);
  }

  // The harmony's colour: a note's place on the circle of fifths, measured from the recording's home key.
  let homePc = null;
  function home() {
    if (homePc != null) return homePc;
    let cx = 0, cy = 0;
    for (const [s, e, m, v] of (window.NOTES || [])) { const a = (((m % 12) * 7) % 12) / 12 * TAU, w = Math.min(4, e - s) * v; cx += Math.cos(a) * w; cy += Math.sin(a) * w; }
    const pos = Math.round((((Math.atan2(cy, cx) / TAU) * 12) % 12 + 12) % 12);   // position on the fifths circle
    return (homePc = pos);
  }
  function tintOf(m) {
    let d = ((((m % 12) * 7) % 12) - home() + 12) % 12; if (d > 6) d -= 12;     // -5..6 steps round the circle of fifths
    return Math.abs(d) <= 1 ? 'rose' : Math.abs(d) >= 5 ? 'grey' : d > 0 ? 'ochre' : 'blue';
  }

  // State: per band a mark (0..1, eased toward its target), per semitone stripe a held-note tint and its colour.
  const ink = new Float32Array(NB), inkT = new Float32Array(NB), tint = new Float32Array(SEMI), tintCol = new Array(SEMI).fill('rose');
  let time = 0;

  const PAPER_ICON = (v) => ICON.lerp('#131215', '#ece7dc', v);
  TOOLS.push({
    id: 'martin', name: 'Agnes Martin', tag: 'new',
    blurb: 'After Agnes Martin: pale bands of washed colour under a fine pencil grid, the keyboard from bass (bottom) to treble. A soft note faintly deepens its band; a held note tints its own thin stripe in the colour of the harmony. Loud music is nearly ignored: it is for the chorale and the oboe cadenza. Paints its own canvas; turn <b>how present</b> down and the page keeps only its resting bands under a few ruled lines, with marks that are faint and soon gone.',
    params: [
      { key: 'paper', label: 'night or day paper', min: 0, max: 1, value: 1,
        hint: 'The ground the bands sit on. Left: a very dark canvas with chalk lines. Right: warm off-white paper with pencil lines.',
        icon: (g, v, w, h) => { ICON.rect(g, 2, 2, w - 4, h - 4, PAPER_ICON(v)); const c = ICON.lerp('#d6d0c6', '#3e3c42', v);
          for (const y of [8, 13, 18]) ICON.line(g, 5, y, w - 5, y, c, 0.8); } },
      { key: 'wash', label: 'colour of the bands', min: 0, max: 1, value: 0.55,
        hint: 'How much colour the bands hold at rest. Left: bare paper, only the pencil grid. Right: clear rose and blue bands.',
        icon: (g, v, w, h) => { ICON.rect(g, 2, 2, w - 4, h - 4, '#ece7dc');
          ICON.alpha(g, 0.04 + v * 0.9, () => { ICON.rect(g, 4, 4, w - 8, 6, '#dea9a7'); ICON.rect(g, 4, 16, w - 8, 6, '#a6bcd6'); });
          for (const y of [4, 10, 16, 22]) ICON.line(g, 4, y, w - 4, y, 'rgba(62,60,66,0.5)', 0.6); } },
      { key: 'mark', label: 'how much a note marks', min: 0, max: 1, value: 0.6, less: 0.3, drive: '-level',
        hint: 'How strongly a note deepens its band and a held note tints its stripe. Left: the music barely touches the picture. Right: every soft note leaves a clear wash. Set to follow loudness downwards, so loud music marks it even less.',
        icon: (g, v, w, h) => { ICON.rect(g, 2, 2, w - 4, h - 4, '#ece7dc');
          ICON.alpha(g, 0.08 + v * 0.85, () => ICON.rect(g, 4, 8, w - 8, 10, '#b0686c'));
          ICON.line(g, 4, 8, w - 4, 8, 'rgba(62,60,66,0.6)', 0.6); ICON.line(g, 4, 18, w - 4, 18, 'rgba(62,60,66,0.6)', 0.6); } },
      { key: 'stay', label: 'how long a mark stays', min: 1, max: 20, value: 10, less: 2.5, drive: '-rate',
        hint: 'How long a deepened band or tinted stripe takes to fade back. Left: a breath. Right: it lingers for many seconds. Set to fade faster when the music gets busy.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.12 + v * 0.88, '#d8a2a2', 'square') },
      { key: 'grid', label: 'how fine the grid', min: 0, max: 1, value: 0.6, less: 0.2,
        hint: 'The pencil grid over the bands. Left: only the ruled lines between the bands. Right: a fine, dense mesh of small rectangles.',
        icon: (g, v, w, h) => { ICON.rect(g, 2, 2, w - 4, h - 4, '#ece7dc'); const { hs, nv } = gridSteps(v), c = 'rgba(62,60,66,0.75)';
          const nh = Math.round(12 / hs); for (let i = 0; i <= nh; i++) { const y = 4 + (i / nh) * (h - 8); ICON.line(g, 4, y, w - 4, y, c, 0.7); }
          const nvi = Math.round(nv / 5); for (let i = 0; i <= nvi; i++) { if (!nvi) break; const x = 4 + (i / nvi) * (w - 8); ICON.line(g, x, 4, x, h - 4, c, 0.7); } } },
      { key: 'howmuch', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much the music and the pencil leave on the page: how strongly a note deepens its band or tints its stripe, how long that mark stays, how many pencil lines rule the grid. Left: the resting bands under a few ruled lines, and marks that are faint and gone in a breath. Right: a fine grid and clear washes that linger for many seconds. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
      { key: 'presence', label: 'old: how faint', old: true, min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: a faint ghost of the page you can see through, marked only by its softest long notes. Right: the full page, marked by every note (as before).',
        icon: (g, v, w, h) => ICON.alpha(g, 0.12 + 0.88 * v, () => { ICON.rect(g, 2, 2, w - 4, h - 4, '#ece7dc'); ICON.rect(g, 4, 5, w - 8, 6, '#dea9a7'); ICON.rect(g, 4, 15, w - 8, 6, '#a6bcd6'); }) },
    ],
    reset(x) { W = x.W; H = x.H; ink.fill(0); inkT.fill(0); tint.fill(0); ranks = null; },
    onChord(ch, x) {
      const mark = x.p('mark'), pres = x.p('presence');
      for (const n of ch.notes) {
        if (!marks(n.v, n.d, pres)) continue;
        const b = Math.floor(semiOf(n.m) / BAND), a = clamp(0.42 * quiet(n.v) * mark * (0.7 + 0.3 * Math.min(1, n.d / 0.6)));
        inkT[b] = 1 - (1 - inkT[b]) * (1 - a);
      }
    },
    frame(x) {
      const pres = x.p('presence');
      if (pres < 1 && !dimmed) dimmed = mk();
      const g = pres < 1 ? dimmed.getContext('2d') : x.g, dt = x.dt; time += dt;
      const day = x.p('paper'), wash = x.p('wash'), mark = x.p('mark'), stay = x.p('stay');
      const gk = Math.round(day * 40); if (gk + '' !== groundKey) { makeGround(gk / 40); groundKey = gk + ''; gridKey = ''; }
      const { hs, nv } = gridSteps(x.p('grid')), dayB = day > 0.5, k2 = `${hs},${nv},${dayB}`;
      if (k2 !== gridKey) { makeGrid(x.p('grid'), day); gridKey = k2; }

      // Marks fade with "how long a mark stays"; the shown mark eases toward its target in a fraction of a second.
      const fall = Math.pow(0.5, dt / (stay * 0.45)), rise = 1 - Math.pow(0.5, dt / (0.09 + 0.5 * (1 - pres)));
      for (let b = 0; b < NB; b++) { inkT[b] *= fall; ink[b] += (inkT[b] - ink[b]) * rise; }
      // Held notes (sounding for a quarter second or more) draw their stripe's tint up; released ones let it fade.
      const held = new Float32Array(SEMI);
      for (const n of x.sounding()) {
        if (x.t - n.start < 0.25 || !marks(n.v, n.end - n.start, pres)) continue;
        const s = semiOf(n.m), tg = clamp(quiet(n.v) * mark * 1.5);
        if (tg > held[s]) { held[s] = tg; tintCol[s] = tintOf(n.m); }
      }
      const up = 1 - Math.pow(0.5, dt / 0.7), tfall = Math.pow(0.5, dt / (stay * 0.3));
      for (let s = 0; s < SEMI; s++) tint[s] = held[s] > tint[s] ? tint[s] + (held[s] - tint[s]) * up : tint[s] * tfall;

      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none';
      g.drawImage(groundC, 0, 0);
      // Resting washes (breathing over ~50 s), then each band's mark: a deeper tone on day paper, a paler one on night.
      const restA = 0.24 + 0.44 * day, markTone = dayB ? 'deep' : 'pale', markA = dayB ? 0.62 : 0.5;
      for (let b = 0; b < NB; b++) {
        const name = BANDS[b], y = yOfBand(b), br = 1 + 0.12 * pres * Math.sin(time * TAU / 53 + b * 1.7);
        const a0 = wash * REST[name] * restA * br;
        if (a0 > 0.004) { g.globalAlpha = Math.min(1, a0); g.drawImage(strip(name, 'pale'), MX, y); }
        if (ink[b] > 0.004) { g.globalAlpha = Math.min(1, ink[b] * markA); g.drawImage(strip(name, markTone), MX, y); }
      }
      // Held-note stripes: one semitone high, the full width, a thin wash in the harmony's colour.
      for (let s = 0; s < SEMI; s++) {
        if (tint[s] < 0.006) continue;
        const c = COL[tintCol[s]][markTone], y = yOfSemi(s);
        g.globalAlpha = 1; g.fillStyle = rgb(c, tint[s] * (dayB ? 0.42 : 0.5));
        g.fillRect(MX + 3, y + 1, FW - 6, SH - 1.5);
      }
      g.globalAlpha = 1; g.drawImage(gridC, 0, 0);
      if (pres >= 1) return;
      // how present: the lamp over the page is lowered, so paper, bands and pencil sink together. Dark marks would vanish with
      // them, so low down the bands' colour and the marks come back in the pale tone, which keeps the ghost answering the music.
      g.globalAlpha = 1; g.fillStyle = `rgba(0,0,0,${(1 - lamp(pres)).toFixed(3)})`; g.fillRect(0, 0, W, H);
      const glow = 0.4 * clamp((0.6 - pres) / 0.35);
      if (glow > 0) {
        for (let b = 0; b < NB; b++) { const a = (wash * REST[BANDS[b]] * 0.25 + ink[b] * 0.4) * glow; if (a > 0.002) { g.globalAlpha = Math.min(1, a); g.drawImage(strip(BANDS[b], 'pale'), MX, yOfBand(b)); } }
        g.globalAlpha = 1;
        for (let s = 0; s < SEMI; s++) if (tint[s] >= 0.006) { g.fillStyle = rgb(COL[tintCol[s]].pale, tint[s] * 0.28 * glow); g.fillRect(MX + 3, yOfSemi(s) + 1, FW - 6, SH - 1.5); }
      }
      // Laid on the stage by 'lighten', not by alpha: alpha would build up over the stage's slow fade and drift in the dark 8-bit
      // levels. This way the page is exactly itself each frame, and whatever brighter lies under it shows through. Near the
      // right end the page closes over what is under it again, so nothing jumps on the way to fully opaque at 1.
      const o = x.g, closed = clamp((pres - 0.85) / 0.15);
      o.globalAlpha = 1; o.globalCompositeOperation = 'lighten'; o.drawImage(dimmed, 0, 0);
      o.globalCompositeOperation = 'source-over';
      if (closed > 0) { o.globalAlpha = closed; o.drawImage(dimmed, 0, 0); }
      o.globalAlpha = 1;
    },
  });
})();
