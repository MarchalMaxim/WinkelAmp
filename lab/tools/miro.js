// Miró (after Joan Miró's Constellations, 1940-41): a pale washed sheet slowly fills with a poetic sky. The melody is a
// pen: a thin black line that wanders over the page, turning with every step of the tune (up = it bends one way, down
// the other, big leaps curl it into loops), and each melody note leaves a little star or dot right on the line. Short
// notes drop dots; held notes swell into biomorphic blobs that grow for as long as the note sounds; loud deep notes set
// black crescents; full chords sometimes a bow-tie. Shapes are flat red, blue, yellow and black, and where two overlap
// the colour flips (red over blue goes black, black over red goes red), and the line turns pale where it crosses a black
// shape: the Constellations' interlocking. Thin straight lines tie the stars of a chord, and each new star to a neighbour.
(() => {
  const TAU = Math.PI * 2;
  const INK = [20, 17, 15], RED = [205, 40, 30], BLUE = [28, 70, 160], YEL = [238, 186, 36], PAPER = [240, 232, 214];
  const COLS = [RED, BLUE, YEL];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let els = [], ties = [], trail = [], stains = [], wash = null;
  let pen = null, clock = 0, prevTop = null, kick = 1, stainCool = 0, lastMark = null;

  // the sheet: a warm pale gouache wash with cloudy blotches and grain, painted once (own seeded random: same every time)
  function makeWash(W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    let s = 12345; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    g.fillStyle = 'rgb(232,222,200)'; g.fillRect(0, 0, W, H);
    const tints = ['196,178,140', '178,186,190', '222,200,170', '206,190,160', '240,232,214', '160,170,178'];
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = r() * H, rad = 60 + r() * 260, t = tints[Math.floor(r() * tints.length)], a = 0.06 + r() * 0.12;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${t},${a})`); gr.addColorStop(0.6, `rgba(${t},${a * 0.5})`); gr.addColorStop(1, `rgba(${t},0)`);
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
    g.putImageData(img, 0, 0);
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.72);
    v.addColorStop(0, 'rgba(120,90,50,0)'); v.addColorStop(1, 'rgba(120,90,50,0.22)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    return c;
  }

  // a biomorphic blob: a closed smooth curve through n points at uneven radii (one may reach out like a pseudopod)
  function blobPts(rand) {
    const n = 6 + Math.floor(rand() * 3), pts = [];
    const reach = Math.floor(rand() * n);
    for (let i = 0; i < n; i++) pts.push({ a: (i / n) * TAU + (rand() - 0.5) * 0.5, r: 0.62 + rand() * 0.6 + (i === reach && rand() < 0.7 ? 0.6 : 0), ph: rand() * TAU });
    return pts;
  }
  function blobPath(p, pts, x, y, R, rot, sx, wob, t) {
    const q = pts.map((o, i) => {
      const rr = R * o.r * (1 + wob * Math.sin(t * 1.3 + o.ph));
      const lx = Math.cos(o.a) * rr * sx, ly = Math.sin(o.a) * rr;
      return [x + lx * Math.cos(rot) - ly * Math.sin(rot), y + lx * Math.sin(rot) + ly * Math.cos(rot)];
    });
    const n = q.length, mid = (i, j) => [(q[i][0] + q[j][0]) / 2, (q[i][1] + q[j][1]) / 2];
    const m0 = mid(n - 1, 0); p.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const m = mid(i, (i + 1) % n); p.quadraticCurveTo(q[i][0], q[i][1], m[0], m[1]); }
    p.closePath();
  }
  // a crescent: the disc of radius R minus a disc of radius r*R shifted by d*R
  function crescentPath(p, x, y, R, rot, rr = 0.86, dd = 0.42) {
    const r = R * rr, d = R * dd, ix = (d * d + R * R - r * r) / (2 * d), iy = Math.sqrt(Math.max(0, R * R - ix * ix));
    const a1 = Math.atan2(iy, ix), bm = Math.atan2(-iy, ix - d), bp = Math.atan2(iy, ix - d);
    const c = Math.cos(rot), s = Math.sin(rot);
    // outer arc the long way round, inner arc back through the inside
    const P = new Path2D(); P.arc(0, 0, R, a1, TAU - a1, false); P.arc(d, 0, r, bm, bp, true); P.closePath();
    p.addPath(P, new DOMMatrix([c, s, -s, c, x, y]));
  }
  function bowPath(p, x, y, R, rot) {
    const c = Math.cos(rot), s = Math.sin(rot), T = (lx, ly) => [x + lx * c - ly * s, y + lx * s + ly * c];
    for (const k of [-1, 1]) {
      const a = T(k * R, -R * 0.62), b = T(0, 0), d = T(k * R, R * 0.62);
      p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); p.lineTo(d[0], d[1]); p.closePath();
    }
  }
  // Miró's star: thin crossing rays (an asterisk), or a small filled star for loud high notes
  function drawStar(g, e, k, a) {
    const s = e.R * k;
    if (e.solid) {
      g.fillStyle = rgba(e.col, a); g.beginPath();
      for (let i = 0; i < 10; i++) { const an = e.rot - Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? s * 0.42 : s; g.lineTo(e.x + q * Math.cos(an), e.y + q * Math.sin(an)); }
      g.closePath(); g.fill(); g.strokeStyle = rgba(INK, a * 0.9); g.lineWidth = 1.1; g.stroke();
      return;
    }
    g.strokeStyle = rgba(e.col, a); g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i < e.rays; i++) { const an = e.rot + (i * Math.PI) / e.rays, L = s * (i % 2 ? 0.7 : 1); g.moveTo(e.x - Math.cos(an) * L, e.y - Math.sin(an) * L); g.lineTo(e.x + Math.cos(an) * L, e.y + Math.sin(an) * L); }
    g.stroke();
  }
  // where two shapes overlap, the colour flips
  function flip(a, b) {
    if (a === INK && b === INK) return PAPER;
    if (a === INK) return b === YEL ? RED : b;
    if (b === INK) return a === YEL ? RED : a;
    return INK;
  }
  const hues = (x) => x.p('colour');

  // ---- knob pictures (40x26 dark canvas: "black ink" is drawn in the light ink colour) ----
  const ICONBLOB = blobPts(ICON.rng(4));
  function iconBlob(g, x, y, R, col, rot = 0.4) { const p = new Path2D(); blobPath(p, ICONBLOB, x, y, R, rot, 1.15, 0, 0); g.fillStyle = col; g.fill(p); }
  const ICONS = {
    life(g, v, w, h) { ICON.fade(g, w, h, 0.12 + v * 0.88, ICON.gold, 'star'); },
    wander(g, v, w, h) {                     // a calm line, or a line that loops and curls
      g.strokeStyle = ICON.ink; g.lineWidth = 1.3; g.beginPath();
      // a trochoid: a gentle wave at the left end, loops along the line at the right
      const T = 3 * TAU, b = v * 6.5;
      let x = 0, y = 0;
      for (let i = 0; i <= 120; i++) {
        const s = i / 120, t = s * T;
        x = 5 + s * (w - 10) - b * Math.sin(t); y = h / 2 + b * Math.cos(t) * 0.8 + 4 * Math.sin(s * TAU) * (1 - v) - b * 0.8 + 2.5 * v;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke(); ICON.dot(g, x, y, 1.8, ICON.ink);
    },
    swell(g, v, w, h) { iconBlob(g, w / 2, h / 2, 2.5 + v * 8.5, ICON.red); },
    colour(g, v, w, h) {                     // the same four forms: ink only, or red, blue and yellow
      iconBlob(g, 9, 13, 6.5, ICON.lerp(ICON.ink, ICON.red, v));
      ICON.dot(g, 21, 8, 3.6, ICON.lerp(ICON.ink, ICON.blue, v));
      ICON.shape(g, 'star', 31, 15, 11, ICON.lerp(ICON.ink, ICON.gold, v));
      ICON.dot(g, 20, 20, 2.2, ICON.ink);
    },
    web(g, v, w, h) {                        // a few stars; joined by thin straight lines as it turns up
      const P = [[5, 19], [13, 6], [20, 16], [29, 5], [35, 20], [26, 23]];
      const E = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [4, 5], [0, 2], [1, 3]];
      const n = Math.round(v * E.length);
      for (let i = 0; i < n; i++) ICON.line(g, P[E[i][0]][0], P[E[i][0]][1], P[E[i][1]][0], P[E[i][1]][1], ICON.ink, 0.9);
      P.forEach(([x, y], i) => (i % 2 ? ICON.shape(g, 'star', x, y, 7, ICON.gold) : ICON.dot(g, x, y, 2, i === 2 ? ICON.red : ICON.ink)));
    },
  };

  TOOLS.push({
    id: 'miro', name: 'Miró', tag: 'new',
    blurb: 'After Miró\'s Constellations: the melody draws one thin black line that wanders over a pale washed sheet, leaving stars and dots along it. Short notes drop dots, held notes swell into red, blue, yellow and black blobs, loud deep notes set crescents, and where shapes overlap their colours flip.',
    params: [
      { key: 'life', label: 'how long the sky stays', min: 4, max: 40, value: 16,
        hint: 'How long the shapes and the line stay on the page. Left: a few seconds, the sheet keeps clearing. Right: the whole passage builds up into one crowded sky.',
        icon: ICONS.life },
      { key: 'wander', label: 'how the line wanders', min: 0, max: 2, value: 0.9, drive: '+rate',
        hint: 'How strongly the melody turns the line. Left: long, calm curves. Right: it loops, curls and zigzags with every step of the tune.',
        icon: ICONS.wander },
      { key: 'swell', label: 'how big the blobs grow', min: 0.4, max: 2, value: 1, drive: '+level',
        hint: 'How big a held note\'s blob grows. Left: small pebbles. Right: big swelling forms.',
        icon: ICONS.swell },
      { key: 'colour', label: 'how much colour', min: 0, max: 1, value: 0.65,
        hint: 'How many shapes are red, blue or yellow instead of black. Left: black ink only. Right: almost everything in colour.',
        icon: ICONS.colour },
      { key: 'web', label: 'lines between the stars', min: 0, max: 1, value: 0.5,
        hint: 'Thin straight lines tying together the notes of a chord, and each new star to a neighbour. Left: only the one wandering line. Right: a dense web of constellations.',
        icon: ICONS.web },
    ],
    reset(x) {
      els = []; ties = []; trail = []; stains = []; clock = 0; prevTop = null; kick = 1; stainCool = 0; lastMark = null;
      pen = { x: x.W * 0.32, y: x.H * 0.55, th: -0.35, kappa: 0 };
      if (!wash) wash = makeWash(x.W, x.H);
    },
    onChord(ch, x) {
      if (!pen) this.reset(x);
      const life = x.p('life'), wander = x.p('wander'), swell = x.p('swell'), colour = hues(x), web = x.p('web'), f = x.feat;
      const notes = [...ch.notes].sort((a, b) => a.m - b.m), top = notes[notes.length - 1], low = notes[0];
      // the melody turns the pen: up bends it one way, down the other, a leap curls it
      if (prevTop != null) {
        const step = clamp(top.m - prevTop, -9, 9);
        pen.kappa += step * 0.11 * wander;
        if (step === 0) pen.th += kick * 0.28 * wander;   // a repeated note: a little zigzag
        kick = -kick;
      }
      prevTop = top.m;
      pen.th += (Math.random() - 0.5) * 0.25 * wander;
      const nx = -Math.sin(pen.th), ny = Math.cos(pen.th);  // the pen's left-hand side
      const pickCol = (m, inkBias = 0) => (Math.random() < colour * (1 - inkBias) ? COLS[((m % 12) * 7) % 3] : INK);
      const born = [];
      const add = (e) => {
        const m = Math.min(x.H * 0.45, e.R * (e.kind === 'blob' ? 1.5 * Math.max(1, e.sx) : 1.05) + 10);
        if (e.kind !== 'star' || !e.onLine) { e.x = clamp(e.x, m, x.W - m); e.y = clamp(e.y, m, x.H - m); }
        e.age = 0; e.life = life * (0.75 + 0.5 * Math.random()); els.push(e); born.push(e); return e; };
      let shapes = 0; for (const o of els) if ((o.kind === 'blob' || o.kind === 'cres' || o.kind === 'bow') && o.age < o.life * 0.8) shapes++;
      const full = shapes >= 22;                                 // a crowded sky: new held notes mostly drop dots instead
      const lifeK = clamp(1.2 - shapes / 40, 0.6, 1);          // and its shapes come smaller
      const sparse = clamp(1 - f.rate * 2.5, 0, 1);            // few notes (Beethoven's opening): each one counts for more
      const big = 1 + 0.45 * sparse;
      for (const n of notes) {
        const lone = notes.length === 1 && n.m < 55 && n.d > 0.3;   // a lone deep held note is a shape, not a mark on the line
        const vk = n.v / 110, isTop = n === top && !lone, isLow = n === low && (notes.length > 1 || lone);
        const held = n.d > 0.38 || (n.d > 0.2 && (n.v >= 84 || sparse > 0.5));
        const off = isTop ? 0 : (top.m - n.m) * (3.5 + Math.random() * 3) + 18;
        const side = n.m % 2 ? 1 : -1;
        let ex = pen.x + nx * off * side + (Math.random() - 0.5) * 20, ey = pen.y + ny * off * side + (Math.random() - 0.5) * 20;
        if (n.m < 48 && !isTop) {                  // deep notes stand further off, anywhere around
          const a = Math.random() * TAU, r = 110 + Math.random() * 220; ex = pen.x + Math.cos(a) * r; ey = pen.y + Math.sin(a) * r * 0.7;
        }
        ex = clamp(ex, 30, x.W - 30); ey = clamp(ey, 30, x.H - 30);
        if (isTop) {                               // the melody: a star or a dot right on the line (scattered, not strung)
          const near = lastMark && (Math.hypot(pen.x - lastMark.x, pen.y - lastMark.y) < 30 || clock - lastMark.t < 0.22);
          if (near) { if (n.v >= 80 && Math.random() < 0.5) add({ kind: 'dot', x: pen.x, y: pen.y, R: 1.8 + vk * 1.2, col: INK, d: n.d, onLine: true }); continue; }
          lastMark = { x: pen.x, y: pen.y, t: clock };
          if (n.m >= 64 && (n.v >= 70 || Math.random() < 0.6)) {
            const solid = n.v >= 92 && Math.random() < 0.5;
            add({ kind: 'star', onLine: true, x: pen.x, y: pen.y, R: (5 + vk * 9) * (solid ? 1.3 : 1) * big, rot: Math.random() * TAU, rays: Math.random() < 0.5 ? 4 : 3, solid, col: solid ? pickCol(n.m) : (Math.random() < colour * 0.4 ? RED : INK), d: n.d });
          } else add({ kind: 'dot', onLine: true, x: pen.x, y: pen.y, R: (2.5 + vk * 4 + (64 - Math.min(64, n.m)) * 0.08) * big, col: pickCol(n.m, 0.3), d: n.d });
          continue;
        }
        if (isLow && n.m < 50 && n.v >= 82 && Math.random() < (full ? 0.2 : 0.5)) {   // a loud deep note: a crescent
          const R = (34 + (50 - n.m) * 1.6) * (0.7 + 0.4 * vk) * swell * lifeK * big;
          add({ kind: 'cres', x: ex, y: ey, R, rot: Math.random() * TAU, col: Math.random() < 0.6 ? INK : pickCol(n.m), d: Math.max(n.d, 0.5), rr: 0.78 + Math.random() * 0.12, dd: 0.35 + Math.random() * 0.2 });
          continue;
        }
        if (held && (full ? isLow && Math.random() < 0.35 : isLow || Math.random() < 0.3 + 0.5 * sparse)) {   // a held note: a blob that swells while it sounds
          const R = (12 + Math.max(0, 84 - n.m) * 0.75) * (0.6 + 0.55 * vk) * swell * lifeK * big;
          const seed = Math.floor(Math.random() * 1e9);
          add({ kind: 'blob', x: ex, y: ey, R, rot: Math.random() * TAU, sx: 0.75 + Math.random() * 0.9, pts: blobPts(ICON.rng(seed)), col: pickCol(n.m, n.m < 48 && sparse < 0.5 ? 0.35 : 0), d: n.d });
          continue;
        }
        add({ kind: 'dot', x: ex, y: ey, R: (2 + vk * 3.5 + Math.max(0, 70 - n.m) * 0.09) * Math.sqrt(swell), col: pickCol(n.m, 0.45), d: n.d });
      }
      // a full, loud chord now and then: a bow-tie near the line
      if (notes.length >= 4 && ch.vel >= 80 && !full && Math.random() < 0.25) {
        const a = Math.random() * TAU, r = 60 + Math.random() * 90;
        add({ kind: 'bow', x: clamp(pen.x + Math.cos(a) * r, 40, x.W - 40), y: clamp(pen.y + Math.sin(a) * r, 40, x.H - 40), R: (16 + notes.length * 2.2) * swell * lifeK, rot: Math.random() * TAU, col: pickCol(ch.lo + 5), d: 0.4 });
      }
      // a loud deep chord: a pale stain spreads in the wash
      if (ch.lo < 50 && ch.vel >= 92 && stainCool <= 0) {
        stainCool = 1.2;
        stains.push({ x: clamp(pen.x + (Math.random() - 0.5) * 300, 0, x.W), y: clamp(pen.y + (Math.random() - 0.5) * 200, 0, x.H), r: 140 + (ch.vel - 92) * 6, col: COLS[Math.floor(Math.random() * 3)], age: 0, life: life * 0.8 });
        if (stains.length > 6) stains.shift();
      }
      // constellation lines: the chord's stars tied together, and a new star tied to an older neighbour
      const shown = born.filter((e) => e.kind !== 'bow');
      for (let i = 0; i + 1 < shown.length; i++) if (Math.random() < web * 0.9) ties.push({ a: shown[i], b: shown[i + 1], age: 0 });
      if (born.length && Math.random() < web) {
        const e = born[born.length - 1]; let best = null, bd = 1e9;
        for (const o of els) { if (born.includes(o) || o.age > o.life * 0.7) continue; const d = Math.hypot(o.x - e.x, o.y - e.y); if (d > 30 && d < bd) { bd = d; best = o; } }
        if (best && bd < 360) ties.push({ a: best, b: e, age: 0 });
      }
      // too many on the page: the oldest hurry out (they shrink away as usual); a hard cap only as a backstop
      if (els.length > 220) for (const o of els.slice(0, els.length - 220)) o.life = Math.min(o.life, o.age + 0.4);
      if (els.length > 400) els.splice(0, els.length - 400);
      if (ties.length > 200) ties.splice(0, ties.length - 200);
    },
    frame(x) {
      if (!pen) this.reset(x);
      const g = x.g, dt = x.dt, life = x.p('life'), wander = x.p('wander');
      clock += dt; stainCool -= dt;
      // the pen moves on: faster when the music is loud and busy; its turning relaxes, with a slow wobble of its own
      const f = x.feat, speed = 18 + 150 * f.level + 90 * f.rate;
      pen.kappa *= Math.exp(-dt * 0.7);
      pen.th += (pen.kappa + 0.22 * wander * Math.sin(clock * 0.31) + 0.12 * Math.sin(clock * 0.83 + 1)) * dt;
      // keep it on the page: near an edge it turns back toward the middle
      const M = 110, ex = Math.max(0, M - pen.x, pen.x - (x.W - M)) / M, ey = Math.max(0, M - pen.y, pen.y - (x.H - M)) / M, edge = Math.max(ex, ey);
      if (edge > 0) {
        const to = Math.atan2(x.H / 2 - pen.y, x.W / 2 - pen.x); let dA = to - pen.th; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
        pen.th += dA * Math.min(1, edge * 3.2 * dt * 2.2); pen.kappa *= Math.exp(-dt * 2 * edge);
      }
      pen.x = clamp(pen.x + Math.cos(pen.th) * speed * dt, 12, x.W - 12); pen.y = clamp(pen.y + Math.sin(pen.th) * speed * dt, 12, x.H - 12);
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(pen.x - last.x, pen.y - last.y) > 3) trail.push({ x: pen.x, y: pen.y, t: clock, w: 1.3 + 1.4 * f.level });
      while (trail.length && clock - trail[0].t > life) trail.shift();

      // the sheet and its stains
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.drawImage(wash, 0, 0, x.W, x.H);
      for (const s of stains) {
        s.age += dt; const a = Math.min(1, s.age / 1.2) * Math.max(0, 1 - s.age / s.life) * 0.16, r = s.r * (0.7 + 0.3 * Math.min(1, s.age / 3));
        if (a <= 0) continue;
        const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        gr.addColorStop(0, rgba(s.col, a)); gr.addColorStop(0.55, rgba(s.col, a * 0.6)); gr.addColorStop(1, rgba(s.col, 0));
        g.fillStyle = gr; g.fillRect(s.x - r, s.y - r, r * 2, r * 2);
      }
      stains = stains.filter((s) => s.age < s.life);

      // ages, sizes and paths
      const fills = [];
      for (const e of els) {
        e.age += dt;
        e.a = Math.min(1, Math.max(0, (e.life - e.age) / (e.life * 0.3)));
        const pop = 1 + 0.35 * Math.max(0, 1 - e.age / 0.16);           // the attack: a shape lands a little big
        const hold = Math.max(0.12, Math.min(e.d, 3.5));
        const grow = e.kind === 'blob' || e.kind === 'cres' ? 0.42 + 0.58 * (1 - Math.pow(1 - Math.min(1, e.age / hold), 2)) : 1;
        e.k = pop * grow * (0.1 + 0.9 * Math.sqrt(e.a));       // leaving: a shape shrinks away, staying flat
        e.fa = Math.min(1, e.a * 5);
        if (e.kind === 'blob' || e.kind === 'cres' || e.kind === 'bow') {
          const p = new Path2D(), R = e.R * e.k;
          if (e.kind === 'blob') blobPath(p, e.pts, e.x, e.y, R, e.rot + clock * 0.03, e.sx, 0.05, clock + e.rot * 3);
          else if (e.kind === 'cres') crescentPath(p, e.x, e.y, R, e.rot, e.rr, e.dd);
          else bowPath(p, e.x, e.y, R, e.rot);
          e.path = p; e.br = R * (e.kind === 'blob' ? 1.6 * Math.max(1, e.sx) : 1.05);
          if (e.a > 0.01) fills.push(e);
        }
      }
      // flat shapes, then the flipped colour where two overlap, then thin ink outlines
      for (const e of fills) { g.fillStyle = rgba(e.col, e.fa); g.fill(e.path); }
      for (let i = Math.max(0, fills.length - 70); i < fills.length; i++) for (let j = i + 1; j < fills.length; j++) {
        const A = fills[i], B = fills[j];
        if (Math.hypot(A.x - B.x, A.y - B.y) > A.br + B.br) continue;
        g.save(); g.clip(A.path); g.fillStyle = rgba(flip(A.col, B.col), Math.min(A.fa, B.fa)); g.fill(B.path); g.restore();
      }
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (const e of fills) if (e.col !== INK) { g.strokeStyle = rgba(INK, e.fa * 0.85); g.lineWidth = 1.2; g.stroke(e.path); }

      // the constellation ties: thin straight lines, drawn out quickly
      g.lineWidth = 0.9;
      for (const t of ties) {
        t.age += dt; const a = Math.min(t.a.a ?? 1, t.b.a ?? 1) * 0.75; if (a <= 0.01) continue;
        const k = 1 - Math.pow(1 - Math.min(1, t.age / 0.3), 2);
        g.strokeStyle = rgba(INK, a); g.beginPath(); g.moveTo(t.a.x, t.a.y); g.lineTo(t.a.x + (t.b.x - t.a.x) * k, t.a.y + (t.b.y - t.a.y) * k); g.stroke();
      }
      ties = ties.filter((t) => (t.a.a ?? 1) > 0.01 && (t.b.a ?? 1) > 0.01);

      // the wandering line, in chunks that fade with age; it turns pale where it crosses a black shape
      const chunks = [];
      for (let i = 0; i < trail.length - 1; i += 16) {
        const end = Math.min(trail.length - 1, i + 16), p = new Path2D(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        p.moveTo(trail[i].x, trail[i].y);
        for (let j = i + 1; j <= end; j++) { const q = trail[j]; p.lineTo(q.x, q.y); }
        for (let j = i; j <= end; j++) { const q = trail[j]; x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
        const mid = trail[(i + end) >> 1], age = (clock - mid.t) / life;
        chunks.push({ p, a: Math.min(1, (1 - age) / 0.3), w: mid.w, x0, y0, x1, y1 });
      }
      for (const c of chunks) { g.strokeStyle = rgba(INK, c.a * 0.92); g.lineWidth = c.w; g.stroke(c.p); }
      for (const e of fills) {
        if (e.col !== INK || e.fa < 0.3) continue;
        g.save(); g.clip(e.path);
        for (const c of chunks) {
          if (c.x1 < e.x - e.br || c.x0 > e.x + e.br || c.y1 < e.y - e.br || c.y0 > e.y + e.br) continue;
          g.strokeStyle = rgba(PAPER, Math.min(c.a, e.fa)); g.lineWidth = c.w; g.stroke(c.p);
        }
        g.restore();
      }
      // dots and stars on top; the pen's point
      for (const e of els) {
        if (e.kind !== 'dot' && e.kind !== 'star' || e.a <= 0.01) continue;
        if (e.kind === 'dot') { g.fillStyle = rgba(e.col, e.fa); g.beginPath(); g.arc(e.x, e.y, e.R * e.k, 0, TAU); g.fill(); }
        else drawStar(g, e, e.k, e.fa);
      }
      g.fillStyle = rgba(INK, 0.95); g.beginPath(); g.arc(pen.x, pen.y, 2.2 + 1.5 * f.level, 0, TAU); g.fill();
      els = els.filter((e) => e.age < e.life);
    },
  });
})();
