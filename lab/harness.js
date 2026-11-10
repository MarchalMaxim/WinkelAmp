// The lab's lists and the knob-picture library, one classic script: the lab page loads it with a <script> tag, the studio
// evaluates its text, Node runs it in a vm. It sets window.LAB and declares nothing else global.
(() => {
// Songs: ?song=b5 switches. Moments carry the Prelude's mood names, which some tools read (e.g. how many shapes spawn).
const SONGS = {
  prelude: { title: 'Rachmaninoff: Prelude in C♯ minor', audio: 'prelude.mp3', notes: 'notes.js', pack: 'pack-prelude.js', dur: 232.1,
    moments: [[0, 'dread', 'Dread'], [83, 'agitato', 'Agitato'], [124, 'casket', 'The casket'], [176, 'return', 'Return'], [208, 'agitato']] },
  // pack: lab/pack-<id>.js (npm run lab-notes -- <id>, git-ignored) sets window.PACK = { tracks, beats, loudness }: the
  // instrument tracks a layer can listen to. Without the file every part falls back to all the notes.
  b5: { title: 'Beethoven: Symphony No. 5, I', audio: 'beethoven5.mp3', notes: 'notes-b5.js', pack: 'pack-beethoven5.js', dur: 424.8,
    // My guesses from the note density; the hard stops at 1:20 and 2:40 are the motto's fermatas.
    moments: [[0, 'casket', 'Fate knocks'], [20, 'agitato'], [80, 'casket', 'Repeat'], [100, 'agitato'], [160, 'casket', 'Development'], [180, 'agitato'],
      [258, 'return', 'Oboe’s lament'], [275, 'agitato', 'Recapitulation'], [340, 'casket', 'Coda']] },
  // The three below come from the studio's packs (npm run ingest): notes-<id>.js is the pack's notes, the moments my
  // reading of its sections, loudness and harmony against the score.
  'chopin-nocturne-48-1': { title: 'Chopin: Nocturne in C minor, Op. 48 No. 1', audio: 'chopin-nocturne-48-1.mp3', notes: 'notes-chopin-nocturne-48-1.js', pack: 'pack-chopin-nocturne-48-1.js', dur: 381.6,
    // Lento lament; its climax ~1:42; the C major chorale (poco più lento) at 2:04, broken by octaves; the lament returns
    // doppio movimento at 3:21 over hammering triplets; it dies away from 5:26 (the file rings out to silence after 6:00).
    moments: [[0, 'dread', 'Lento'], [100, 'agitato'], [124, 'casket', 'The chorale'], [186, 'agitato', 'Octaves'],
      [201, 'return', 'Doppio movimento'], [326, 'dread', 'Fading']] },
  'chopin-winter-wind': { title: 'Chopin: Étude Op. 25 No. 11, Winter Wind', audio: 'chopin-winter-wind.mp3', notes: 'notes-chopin-winter-wind.js', pack: 'pack-chopin-winter-wind.js', dur: 248.9,
    // Four bars of lento, then the storm of right-hand runs; far keys from ~1:42; A minor again ~2:42; the closing chords
    // and the last run up end the étude at 3:44. After 3:51 the file holds something else (quiet E-flat bells): not the étude.
    moments: [[0, 'dread', 'Lento'], [20, 'agitato', 'The storm'], [102, 'dread', 'Far keys'], [162, 'agitato', 'A minor again'],
      [216, 'casket', 'Last chords'], [231, 'return']] },
  'vivaldi-winter': { title: 'Vivaldi: Winter (all three movements)', audio: 'vivaldi-winter.mp3', notes: 'notes-vivaldi-winter.js', pack: 'pack-vivaldi-winter.js', dur: 566.1,
    // Strings, not piano: the piano transcriber misses whole passages (the third movement's solo violin on ice, 5:55-6:27).
    // I Allegro non molto 0:00-3:30 (shivering, the horrid wind, stamping feet, chattering teeth), II Largo 3:30 (rain),
    // III Allegro 5:48 (walking on ice; the warm south wind in its lento ~8:08; all the winds at war from 8:40).
    moments: [[0, 'dread', 'Shivering'], [36, 'agitato', 'The wind'], [66, 'casket'], [180, 'agitato', 'Chattering teeth'],
      [210, 'return', 'Largo: rain'], [348, 'dread', 'On the ice'], [400, 'agitato'], [488, 'return'], [520, 'casket', 'The winds at war']] },
  // Out of distribution for tagging: brutal off-beat orchestra, then a heavy march. Moments are my reading of the
  // packs' sections and loudness, not checked against the scores. YourMT3 hears little brass in either (horn 41 notes).
  'rite-sacrificial-dance': { title: 'Stravinsky: The Rite of Spring, Sacrificial Dance', audio: 'rite-sacrificial-dance.mp3', notes: 'notes-rite-sacrificial-dance.js', pack: 'pack-rite-sacrificial-dance.js', dur: 298.2,
    moments: [[0, 'agitato', 'Spasms'], [30, 'dread', 'Lull'], [53, 'agitato'], [100, 'dread'], [110, 'casket', 'The full orchestra'], [264, 'casket', 'The last chord']] },
  'prokofiev-knights': { title: 'Prokofiev: Romeo and Juliet, Dance of the Knights', audio: 'prokofiev-knights.mp3', notes: 'notes-prokofiev-knights.js', pack: 'pack-prokofiev-knights.js', dur: 325.3,
    moments: [[0, 'casket', 'The knights'], [104, 'return', 'Quieter'], [190, 'dread', 'Hushed'], [285, 'casket', 'The knights return']] },
  // Two more piano songs for tagging (the piano model's notes: coverage 98% and 100%). Moments are my reading of the
  // packs' sections and loudness. Liebesleid's beat finder found only 24 beats: a rubato waltz, so it has no beat grid.
  'rach-concerto-2': { title: 'Rachmaninoff: Piano Concerto No. 2, I. Moderato', audio: 'rach-concerto-2.mp3', notes: 'notes-rach-concerto-2.js', pack: 'pack-rach-concerto-2.js', dur: 706.0,
    moments: [[0, 'dread', 'The bells'], [30, 'agitato', 'First theme'], [124, 'return', 'Second theme'], [216, 'agitato', 'Development'],
      [343, 'casket', 'The march'], [449, 'return'], [574, 'dread', 'Hushed'], [675, 'agitato', 'Coda']] },
  liebesleid: { title: 'Kreisler, arr. Rachmaninoff: Liebesleid', audio: 'liebesleid.mp3', notes: 'notes-liebesleid.js', pack: 'pack-liebesleid.js', dur: 296.1,
    moments: [[0, 'dread', 'Waltz'], [87, 'return', 'Middle'], [137, 'agitato', 'Fuller'], [194, 'dread', 'Waltz again'], [265, 'casket', 'Last bars']] },
  // The rest of the transcribed songs (npm run lab-notes -- <id> makes their files). Moments are my guesses from the packs'
  // sections and silences, not checked by ear or against the scores, except Summer's, which follow its show.
  'vivaldi-spring': { title: 'Vivaldi: Spring (all three movements)', audio: 'vivaldi-spring.mp3', notes: 'notes-vivaldi-spring.js', pack: 'pack-vivaldi-spring.js', dur: 669.2,
    moments: [[0, 'return', 'Allegro'], [219, 'dread', 'Largo'], [387, 'agitato', 'Pastoral dance']] },
  'vivaldi-summer': { title: 'Vivaldi: Summer (all three movements)', audio: 'vivaldi-summer.mp3', notes: 'notes-vivaldi-summer.js', pack: 'pack-vivaldi-summer.js', dur: 664.1,
    moments: [[0, 'dread', 'The heat'], [77, 'return', 'The cuckoo'], [111, 'agitato', 'A first gust'], [191, 'agitato', 'The north wind'], [236, 'dread', 'The shepherd’s lament'],
      [328, 'agitato', 'The storm threatens'], [359, 'dread', 'Adagio'], [488, 'casket', 'Presto: the storm breaks']] },
  'vivaldi-autumn': { title: 'Vivaldi: Autumn (all three movements)', audio: 'vivaldi-autumn.mp3', notes: 'notes-vivaldi-autumn.js', pack: 'pack-vivaldi-autumn.js', dur: 605.6,
    moments: [[0, 'return', 'Allegro'], [313, 'dread', 'Adagio molto'], [435, 'agitato', 'The hunt']] },
  'vivaldi-four-seasons': { title: 'Vivaldi: The Four Seasons (all of it, another recording)', audio: 'vivaldi-four-seasons.mp3', notes: 'notes-vivaldi-four-seasons.js', pack: 'pack-vivaldi-four-seasons.js', dur: 2519.6,
    moments: [[0, 'return', 'Spring'], [632, 'dread', 'Summer'], [1260, 'return', 'Autumn'], [1975, 'agitato', 'Winter']] },
  'lil-wayne-bells-visualizer': { title: 'Lil Wayne: Bells', audio: 'lil-wayne-bells-visualizer.mp3', notes: 'notes-lil-wayne-bells-visualizer.js', pack: 'pack-lil-wayne-bells-visualizer.js', dur: 204.7,
    moments: [[0, 'dread', 'Opening'], [74, 'agitato', 'Later (1:14)'], [132, 'casket', 'Later (2:12)']] },
  // The piano model's notes (coverage 100%); YourMT3 heard every note as piano, so no instrument tracks. Moments are my
  // guesses from the pack's seven sections, not checked by ear.
  'nutcracker-sugar-plum': { title: 'Tchaikovsky: The Nutcracker, Dance of the Sugar Plum Fairy', audio: 'nutcracker-sugar-plum.mp3', notes: 'notes-nutcracker-sugar-plum.js', pack: 'pack-nutcracker-sugar-plum.js', dur: 135.3,
    moments: [[0, 'dread', 'The theme'], [45, 'agitato', 'Middle'], [88, 'return', 'The theme again'], [129, 'casket', 'Last bars']] },
};

/* Knob pictures. A param may carry `icon(g, v, w, h)`: draw what the knob does at v (0..1 along the slider) on a w×h
   canvas context (CSS pixels; the harness handles the screen's pixel density, clears it, and sets fill/stroke to ICON.ink,
   lineWidth 1.5, round caps). The harness draws it at v=0 and v=1 at the slider's ends, and a live one by the name.
   ICON holds helpers so most icons are one line, e.g. icon: (g, v, w, h) => ICON.square(g, w / 2, h / 2, 4 + v * 12, ICON.red).
   Anything random must use ICON.rng(seed) so the picture doesn't jitter as it redraws. */
const makeIcon = () => {
  const I = {
    ink: '#e9e2da', dim: '#6d635b', red: '#c43a2c', gold: '#e0b04a', blue: '#4f86c6', green: '#5aa36f', violet: '#9a6bd0',
    /** Seeded random: const r = ICON.rng(3); r() → 0..1, same sequence every redraw. */
    rng(seed = 1) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); },
    /** Mix two '#rrggbb' colours: t=0 → a, t=1 → b. */
    lerp(a, b, t) { const p = (c, i) => parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16); return `rgb(${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t)).join(',')})`; },
    dot(g, x, y, r, col = I.ink) { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(0.3, r), 0, Math.PI * 2); g.fill(); },
    ring(g, x, y, r, col = I.ink, lw = 1.5) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(x, y, Math.max(0.3, r), 0, Math.PI * 2); g.stroke(); },
    square(g, x, y, s, col = I.ink, rot = 0) { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col; g.fillRect(-s / 2, -s / 2, s, s); g.restore(); },
    rect(g, x, y, w, h, col = I.ink) { g.fillStyle = col; g.fillRect(x, y, w, h); },
    line(g, x1, y1, x2, y2, col = I.ink, lw = 1.5) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); },
    arrow(g, x1, y1, x2, y2, col = I.ink, lw = 1.5) {
      I.line(g, x1, y1, x2, y2, col, lw); const a = Math.atan2(y2 - y1, x2 - x1), k = 3 + lw * 1.5;
      g.fillStyle = col; g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - k * Math.cos(a - 0.5), y2 - k * Math.sin(a - 0.5)); g.lineTo(x2 - k * Math.cos(a + 0.5), y2 - k * Math.sin(a + 0.5)); g.fill();
    },
    /** n parallel lines across the box ('h' horizontal or 'v' vertical). */
    lines(g, n, w, h, { dir = 'h', col = I.ink, lw = 1.2, pad = 3 } = {}) {
      n = Math.max(0, Math.round(n));
      for (let i = 0; i < n; i++) { const f = n === 1 ? 0.5 : i / (n - 1);
        if (dir === 'h') { const y = pad + f * (h - 2 * pad); I.line(g, pad, y, w - pad, y, col, lw); } else { const x = pad + f * (w - 2 * pad); I.line(g, x, pad, x, h - pad, col, lw); } }
    },
    /** n scattered dots (seeded), radius r. */
    dots(g, n, w, h, { seed = 7, r = 1.4, col = I.ink, pad = 3 } = {}) { const R = I.rng(seed); for (let i = 0; i < Math.round(n); i++) I.dot(g, pad + R() * (w - 2 * pad), pad + R() * (h - 2 * pad), r, col); },
    /** A sine across the box: amp 0..1 of the half-height, `cycles` waves. */
    wave(g, w, h, amp = 0.6, cycles = 2, col = I.ink, lw = 1.5) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      for (let x = 2; x <= w - 2; x++) { const y = h / 2 - Math.sin(((x - 2) / (w - 4)) * cycles * Math.PI * 2) * amp * (h / 2 - 2); x === 2 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    },
    /** Run draw() under a blur of px pixels: ICON.blur(g, v * 3, () => ICON.square(g, w / 2, h / 2, 10)). */
    blur(g, px, draw) { g.save(); g.filter = px > 0.05 ? `blur(${px.toFixed(2)}px)` : 'none'; draw(); g.restore(); },
    /** Run draw() at an opacity 0..1. */
    alpha(g, a, draw) { g.save(); g.globalAlpha = Math.max(0, Math.min(1, a)); draw(); g.restore(); },
    /** Colour swatches side by side across the box. */
    palette(g, colours, w, h, pad = 3) { const n = colours.length, sw = (w - 2 * pad) / n; colours.forEach((c, i) => I.rect(g, pad + i * sw, pad, Math.ceil(sw), h - 2 * pad, c)); },
    /** A pie slice filled to frac (0..1) from 12 o'clock: amounts, durations. */
    pie(g, x, y, r, frac, col = I.ink) {
      I.ring(g, x, y, r, I.dim, 1); if (frac <= 0) return;
      g.fillStyle = col; g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac)); g.closePath(); g.fill();
    },
    /** How long things last: a row of shapes from bright (left) fading to nothing; life 0..1 = how far along the row they stay visible. */
    fade(g, w, h, life, col = I.ink, shape = 'square') {
      const n = 5, step = (w - 4) / n;
      for (let i = 0; i < n; i++) { const f = i / (n - 1), a = Math.max(0, 1 - f / Math.max(0.04, life));
        if (a > 0) I.alpha(g, a, () => I.shape(g, shape, 2 + step * (i + 0.5), h / 2, Math.min(step - 1.5, h - 6), col)); }
    },
    /** Ghost copies around draw(), offset by up to amt pixels: shake, jitter. */
    shake(g, amt, draw) { const R = I.rng(5); for (let i = 0; i < 3; i++) { g.save(); g.globalAlpha = amt > 0.2 ? 0.35 : 0; g.translate((R() - 0.5) * 2 * amt, (R() - 0.5) * 2 * amt); draw(); g.restore(); } draw(); },
    /** A mini piano keyboard; keys between from and to (0..1 across the keyboard) lit in col. */
    keys(g, w, h, from = 0, to = 1, col = I.red) {
      const n = 10, kw = (w - 2) / n;
      for (let i = 0; i < n; i++) { const f = (i + 0.5) / n; I.rect(g, 1 + i * kw, 2, kw - 1, h - 4, f >= from && f <= to ? col : '#cfc6bc'); }
      for (const i of [0, 1, 3, 4, 5, 7, 8]) I.rect(g, 1 + (i + 0.62) * kw, 2, kw * 0.7, (h - 4) * 0.58, '#151214');
    },
    /** A dot with a tail behind it, tail length 0..1 of the box: trails, smears, memory. */
    trail(g, len, w, h, col = I.ink) {
      const x = w - 5, y = h / 2, L = len * (w - 10);
      for (let i = 10; i > 0; i--) I.alpha(g, (1 - i / 10) * 0.8, () => I.dot(g, x - (L * i) / 10, y + Math.sin(i * 0.6) * 2, 1.3 + (1 - i / 10) * 1.2, col));
      I.dot(g, x, y, 2.6, col);
    },
    /** A short word or symbol centred in the box. */
    glyph(g, text, w, h, col = I.ink, px = 11) { g.fillStyle = col; g.font = `600 ${px}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 0.5); },
    /** One named shape centred at x,y, size s: 'dot', 'ring', 'square', 'diamond', 'triangle', 'oval', 'line', 'tick', 'cross', 'star'. */
    shape(g, name, x, y, s, col = I.ink) {
      const r = s / 2;
      switch (name) {
        case 'dot': return I.dot(g, x, y, r, col);
        case 'ring': return I.ring(g, x, y, r * 0.85, col);
        case 'diamond': return I.square(g, x, y, s * 0.72, col, Math.PI / 4);
        case 'triangle': g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.9, y + r * 0.7); g.lineTo(x - r * 0.9, y + r * 0.7); g.fill(); return;
        case 'oval': g.fillStyle = col; g.beginPath(); g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); g.fill(); return;
        case 'line': return I.line(g, x - r, y, x + r, y, col);
        case 'tick': return I.line(g, x, y - r, x, y + r, col);
        case 'cross': I.line(g, x - r * 0.75, y - r * 0.75, x + r * 0.75, y + r * 0.75, col); return I.line(g, x - r * 0.75, y + r * 0.75, x + r * 0.75, y - r * 0.75, col);
        case 'star': g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r * 0.45 : r; g.lineTo(x + q * Math.cos(a), y + q * Math.sin(a)); } g.fill(); return;
        default: return I.square(g, x, y, s, col);
      }
    },
    /** The fallback for a knob without an icon: a bar filled to v. */
    /** How present: more little marks the further right. */
    much(g, v, w, h) { const r = I.rng(5), n = 1 + Math.round(v * 13); for (let i = 0; i < n; i++) I.dot(g, 4 + r() * (w - 8), 4 + r() * (h - 8), 1.5); },
    gauge(g, v, w, h) { I.rect(g, 3, h / 2 - 3, w - 6, 6, '#2c2428'); I.rect(g, 3, h / 2 - 3, (w - 6) * v, 6, I.dim); },
  };
  /* Ready-made icons for common knob kinds (each returns an icon function): icon: ICON.of.size('dot', ICON.gold). */
  I.of = {
    size: (shape = 'square', col) => (g, v, w, h) => I.shape(g, shape, w / 2, h / 2, 3 + v * (h - 5), col),
    count: (max = 12, col) => (g, v, w, h) => I.dots(g, 1 + v * (max - 1), w, h, { col }),
    blur: (shape = 'square', col) => (g, v, w, h) => I.blur(g, v * 3, () => I.shape(g, shape, w / 2, h / 2, h - 8, col)),
    time: (col) => (g, v, w, h) => I.fade(g, w, h, 0.12 + v * 0.88, col),
    speed: (col) => (g, v, w, h) => I.trail(g, 0.1 + v * 0.9, w, h, col),
    lines: (max = 8, col) => (g, v, w, h) => I.lines(g, 1 + v * (max - 1), w, h, { col }),
    choice: (shapes, col) => (g, v, w, h) => I.shape(g, shapes[Math.round(v * (shapes.length - 1))], w / 2, h / 2, h - 6, col),
    colour: (a, b) => (g, v, w, h) => I.rect(g, 3, 3, w - 6, h - 6, I.lerp(a, b, v)),
  };
  return I;
};

// Load and draw order of the widgets that have one; unlisted lab/tools files load after these, by name. Append, never reorder: the order is part of the seeded pixels.
const ORDER = ['harp', 'perlin', 'gliss', 'ivory', 'johansson', 'tree', 'fireworks', 'clumsy', 'gust', 'duet', 'vine', 'royal', 'comfort', 'lazy',
  'timeslice', 'fold', 'stella', 'fischinger', 'mclaren', 'lenlye', 'klee', 'miro', 'delaunay', 'lewitt', 'ridges',
  'matisse', 'kusama', 'ikeda', 'horizon',
  'harmonograph', 'kline', 'score', 'boogie', 'cells', 'nebula', 'pixelsort', 'mandala', 'martin',
  'murmuration', 'marbling', 'kandinsky', 'rorschach', 'squares', 'flee', 'current', 'strings', 'fields',
  'brush', 'blocks', 'riley', 'halftone', 'fifths', 'suprematism', 'contours', 'tunnel', 'scribble', 'pointillism', 'casket',
  'squares-snap', 'fireworks-snap', 'hammer', 'handover',
  'prickle', 'nap', 'crimp', 'interlock', 'pluck', 'film', 'mica', 'fist', 'cut',
  'leidenfrost'];

// The user's verdicts, with the version (tag) each was judged on. drop: rated drop, not removed yet (see the GitHub issues).
const VERDICTS = {
  perlin: { v: 'needs work', on: 'new' },
  gliss: { v: 'love', on: 'new' },
  ivory: { v: 'love', on: 'new' },
  johansson: { v: 'keep', on: 'new' },
  tree: { v: 'keep', on: 'new' },
  fireworks: { v: 'love', on: 'new' },
  clumsy: { v: 'needs work', on: 'new' },
  gust: { v: 'love', on: 'new' },
  duet: { v: 'love', on: 'new' },
  vine: { v: 'love', on: 'new' },
  royal: { v: 'drop', on: 'new' },
  comfort: { v: 'needs work', on: 'new' },
  lazy: { v: 'drop', on: 'new' },
  timeslice: { v: 'love', on: 'new' },
  fold: { v: 'keep', on: 'new' },
  stella: { v: 'keep', on: 'new' },
  fischinger: { v: 'keep', on: 'v2' },
  mclaren: { v: 'needs work', on: 'v2' },
  lenlye: { v: 'keep', on: 'v2' },
  klee: { v: 'needs work', on: 'v2' },
  miro: { v: 'love', on: 'new' },
  delaunay: { v: 'drop', on: 'new' },
  lewitt: { v: 'keep', on: 'new' },
  ridges: { v: 'love', on: 'v2' },
  matisse: { v: 'needs work', on: 'v2' },
  kusama: { v: 'needs work', on: 'new' },
  ikeda: { v: 'keep', on: 'new' },
  horizon: { v: 'keep', on: 'new' },
  harmonograph: { v: 'needs work', on: 'v2' },
  kline: { v: 'love', on: 'v3' },
  score: { v: 'love', on: 'new' },
  boogie: { v: 'love', on: 'new' },
  cells: { v: 'love', on: 'v2' },
  nebula: { v: 'keep', on: 'v2' },
  pixelsort: { v: 'keep', on: 'v2', note: 'already combines with other widgets in a very cool way' },
  mandala: { v: 'love', on: 'v2' },
  martin: { v: 'drop', on: 'new' },
  murmuration: { v: 'needs work', on: 'v3' },
  marbling: { v: 'love', on: 'v2', note: 'extremely high potential' },
  kandinsky: { v: 'love', on: 'v2', note: 'a complete visualization by itself' },
  rorschach: { v: 'love', on: 'v3', note: 'keep our defaults' },
  squares: { v: 'love', on: 'v2' },
  flee: { v: 'love', on: 'v3' },
  current: { v: 'needs work', on: 'v3' },
  strings: { v: 'needs work', on: 'v2' },
  fields: { v: 'love', on: 'v3' },
  brush: { v: 'keep', on: 'v2' },
  blocks: { v: 'keep', on: 'v2' },
  riley: { v: 'needs work', on: 'v2' },
  halftone: { v: 'needs work', on: 'new' },
  fifths: { v: 'love', on: 'v2' },
  suprematism: { v: 'love', on: 'new' },
  contours: { v: 'love', on: 'new' },
  tunnel: { v: 'love', on: 'new' },
  scribble: { v: 'keep', on: 'new' },
  pointillism: { v: 'keep', on: 'new' },
  casket: { v: 'love', on: 'building into the app', note: 'built into the app' },
  'squares-snap': { v: 'love', on: 'new' },
  'fireworks-snap': { v: 'keep', on: 'new' },
  hammer: { v: 'love', on: 'new' },
  handover: { v: 'keep', on: 'snap' },
  prickle: { v: 'love', on: 'new' },
  nap: { v: 'drop', on: 'new' },
  crimp: { v: 'keep', on: 'new' },
  interlock: { v: 'love', on: 'new' },
  pluck: { v: 'love', on: 'new' },
  film: { v: 'love', on: 'new' },
  mica: { v: 'needs work', on: 'new' },
  fist: { v: 'needs work', on: 'new' },
  cut: { v: 'needs work', on: 'new' },
  leidenfrost: { v: 'needs work', on: 'new' },
};

const DRIVES = [['', 'fixed'], ['+level', 'louder notes → more'], ['-level', 'louder notes → less'], ['+rate', 'faster → more'], ['-rate', 'faster → less'],
  ['+pitch', 'higher notes → more'], ['-pitch', 'higher notes → less'], ['+bass', 'more bass → more'], ['-bass', 'more bass → less'],
  ['+density', 'fuller chords → more'], ['-density', 'fuller chords → less'], ['+hit', 'each note → jump'], ['-hit', 'each note → dip'],
  ['+loud', 'louder sound → more'], ['-loud', 'louder sound → less'], ['+pace', 'busier → more'], ['-pace', 'busier → less'],
  ['+rel', 'louder than around it → more'], ['-rel', 'louder than around it → less']];

window.LAB = { SONGS, ORDER, VERDICTS, DRIVES, makeIcon };
})();
