// Snap flock (candidate C10 of docs/mockups/snap/DESIGN.md): Skittish shapes with the bow taken out and the hammer put in.
// In Flee a new shape freezes, trembles, creeps and only then bolts, so the eye sees the note half a second late and a
// speed that grows. Here a shape is lit and already at full speed in the step of its note (P1, P10): the position
// is D(1 - e^(-t/tau)), so the speed is highest at once and falls, and the trail and the heat follow the current speed.
// It is hottest on the attack, flash half-life 0.05 s with a two-step hold, and cools as the note dies away. Brightness and
// heat come from one envelope of the age since the note (a flash over a dim body that lasts the whole life), never from the speed, so a threat can
// kick a shape without lighting it a second time. A shape that stays put is drawn through the exact one-step alpha (DESIGN section 1, P5); a moving one at plain alpha, since nothing is under it. Jerks are seeded at birth. The
// shared canvas fade would turn a raw alpha on a held mark into a hold and a cliff. A shape lives 2 s, the last 0.3 s fading. Ages are
// measured from the chord (ch.t), never accumulated (P8). Same knob keys as Flee.
(() => {
  const TYPES = ['dot', 'oval', 'ring', 'crescent', 'tear', 'comma', 'chevron', 'needle']; // round → sharp
  // Palettes: heat 0..1 ramps through four [hue, sat, light] stops.
  const PALETTES = [
    [[352, 70, 20], [8, 90, 42], [32, 100, 58], [52, 100, 90]],    // 0 ember
    [[228, 60, 22], [205, 85, 45], [188, 100, 66], [180, 80, 94]], // 1 ice
    [[25, 10, 24], [32, 14, 50], [38, 28, 76], [44, 60, 96]],      // 2 bone
    [[275, 60, 20], [312, 85, 44], [342, 100, 64], [40, 100, 88]], // 3 venom
  ];
  const HB = 8; // heat buckets
  const S = 96, HALF = 48, SW = 128, SH = 24;
  const tmp = document.createElement('canvas'); tmp.width = S; tmp.height = S; const tg = tmp.getContext('2d');
  const stmp = document.createElement('canvas'); stmp.width = SW; stmp.height = SH; const stg = stmp.getContext('2d');
  const cache = new Map();
  let budget = 0;

  function ramp(pal, h, a = 1) {
    const P = PALETTES[pal], f = Math.max(0, Math.min(0.999, h)) * 3, i = Math.floor(f), k = f - i, A = P[i], B = P[i + 1];
    let dh = B[0] - A[0]; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
    return `hsla(${(A[0] + dh * k).toFixed(0)},${(A[1] + (B[1] - A[1]) * k).toFixed(0)}%,${(A[2] + (B[2] - A[2]) * k).toFixed(0)}%,${a})`;
  }

  /** One blurred shape pointing +x, coloured for a heat bucket. */
  function buildShape(type, pal, hb) {
    const h = hb / (HB - 1);
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, S, S); tg.translate(HALF, HALF);
    const core = ramp(pal, h + 0.3), body = ramp(pal, h), edge = ramp(pal, h - 0.2, 0.15);
    const rg = (x0, r) => { const gr = tg.createRadialGradient(x0, 0, 0, 0, 0, r); gr.addColorStop(0, core); gr.addColorStop(0.5, body); gr.addColorStop(1, edge); return gr; };
    const lg = () => { const gr = tg.createLinearGradient(40, 0, -42, 0); gr.addColorStop(0, core); gr.addColorStop(0.4, body); gr.addColorStop(1, edge); return gr; };
    tg.beginPath();
    if (type === 'dot') { tg.fillStyle = rg(4, 22); tg.arc(0, 0, 20, 0, Math.PI * 2); tg.fill(); }
    else if (type === 'oval') { tg.fillStyle = rg(10, 36); tg.ellipse(0, 0, 36, 22, 0, 0, Math.PI * 2); tg.fill(); }
    else if (type === 'ring') { tg.strokeStyle = lg(); tg.lineWidth = 8; tg.ellipse(0, 0, 30, 22, 0, 0, Math.PI * 2); tg.stroke(); }
    else if (type === 'crescent') {
      tg.fillStyle = rg(18, 36); tg.arc(0, 0, 32, 0, Math.PI * 2); tg.fill();
      tg.globalCompositeOperation = 'destination-out'; tg.beginPath(); tg.arc(-16, 0, 30, 0, Math.PI * 2); tg.fill();
    } else if (type === 'tear') {
      tg.fillStyle = lg(); tg.arc(16, 0, 20, -Math.PI / 2, Math.PI / 2);
      tg.quadraticCurveTo(-8, 16, -42, 0); tg.quadraticCurveTo(-8, -16, 16, -20); tg.fill();
    } else if (type === 'comma') {
      for (let i = 14; i >= 0; i--) {
        const t = i / 14; tg.fillStyle = t < 0.15 ? core : ramp(pal, h - 0.25 * t, 1 - 0.6 * t);
        tg.beginPath(); tg.arc(18 - 56 * t, 24 * t * t, 14 * (1 - t) + 1.5, 0, Math.PI * 2); tg.fill();
      }
    } else if (type === 'chevron') {
      tg.fillStyle = lg(); tg.moveTo(38, 0); tg.lineTo(-22, -30); tg.lineTo(-6, 0); tg.lineTo(-22, 30); tg.closePath(); tg.fill();
    } else { // needle
      tg.fillStyle = lg(); tg.moveTo(46, 0); tg.lineTo(4, -6); tg.lineTo(-46, 0); tg.lineTo(4, 6); tg.closePath(); tg.fill();
    }
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const cg = c.getContext('2d'); cg.filter = 'blur(2.5px)'; cg.drawImage(tmp, 0, 0);
    return c;
  }
  /** A tapered streak, head at the right edge, fading to nothing at the left. */
  function buildStreak(pal, hb) {
    const h = hb / (HB - 1);
    stg.setTransform(1, 0, 0, 1, 0, 0); stg.clearRect(0, 0, SW, SH);
    const gr = stg.createLinearGradient(SW, 0, 0, 0);
    gr.addColorStop(0, ramp(pal, h, 0)); gr.addColorStop(0.08, ramp(pal, h + 0.1, 0.85)); gr.addColorStop(0.4, ramp(pal, h - 0.15, 0.45)); gr.addColorStop(1, ramp(pal, h - 0.4, 0));
    stg.fillStyle = gr; stg.beginPath(); stg.moveTo(SW - 2, SH / 2 - 7); stg.lineTo(2, SH / 2 - 0.5); stg.lineTo(2, SH / 2 + 0.5); stg.lineTo(SW - 2, SH / 2 + 7); stg.closePath(); stg.fill();
    const c = document.createElement('canvas'); c.width = SW; c.height = SH;
    const cg = c.getContext('2d'); cg.filter = 'blur(1.5px)'; cg.drawImage(stmp, 0, 0);
    return c;
  }
  /** Cached sprite; builds at most a few per frame, otherwise falls back to the nearest built heat. */
  function get(kind, pal, hb) {
    const key = kind + '|' + pal + '|' + hb;
    let c = cache.get(key); if (c) return c;
    if (budget > 0 || !cache.has(kind + '|' + pal + '|any')) {
      budget--;
      c = kind === 'streak' ? buildStreak(pal, hb) : buildShape(kind, pal, hb);
      cache.set(key, c); cache.set(kind + '|' + pal + '|any', c); return c;
    }
    for (let d = 1; d < HB; d++) for (const b of [hb - d, hb + d]) { c = cache.get(kind + '|' + pal + '|' + b); if (c) return c; }
    return cache.get(kind + '|' + pal + '|any');
  }

  let lastSpawn = -9, shapes = [], threats = [], chain = null, idleT = -9, panic = 0, avgVel = 75, prevHi = -1, prevHiT = -9;
  let cool = { bass: 0, loud: 0, leap: 0 }, last = { x: 640, y: 760 }, burst = null;
  const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const sgn = (x) => (x.rnd(0, 1) < 0.5 ? -1 : 1);

  // Knobs folded into fixed choices (2026-10-31, at most 5 knobs). Hesitation and threat response keep the drives they had
  // as knobs, computed exactly as the harness's x.p does at its default depth 0.5, so the widget moves as before.
  const drv = (x, base, min, max, sign, f) => Math.max(min, Math.min(max, base + sign * 0.5 * (max - min) * (x.feat[f] - 0)));
  const TAU = (x) => 0.1 * Math.pow(3 / x.p('exp'), 0.5); // bolt time constant (s): 0.1 at the default, longer for a glide, shorter for a shot
  const LIFE = 2, FADE = 0.3, HOLD = 0.033, FLASH_HL = 0.05;
  // The note's own light, 0..1 of its peak: a flash (two steps from the attack, then half-life 0.05 s; tb is the bolt clock) over a
  // dim body that lives the whole 2 s (BODY of the peak at the start, sinking linearly to BODY_END of that at the end of the
  // life; age is real time since the note), the last 0.3 s fading out. So the strike is the brightest frame, a body of about
  // a third of the peak stays a second later, and the light never rises again (P3, P4). The colour heat has a floor so the
  // body is a dim ember, not black.
  const BODY = 0.45, BODY_END = 0.5;
  const flashOf = (tb) => (tb < HOLD ? 1 : Math.pow(0.5, (tb - HOLD) / FLASH_HL));
  const bodyOf = (age) => BODY * (1 - (1 - BODY_END) * Math.max(0, Math.min(1, age / LIFE)));
  const envOf = (tb, age) => (tb < 0 || age < 0 ? 0 : ((1 - BODY) * flashOf(tb) + bodyOf(age)) * Math.max(0, Math.min(1, (LIFE - age) / FADE)));
  // Twitch: a shape's jerks are fixed at its birth from a seed (the chord time and its number in the chord), so a live run, a
  // render and a seek see the same ones whatever the step size (P8). Candidate times at the highest rate, each with a draw
  // that the knob thins against at play time.
  const TW_MAX = 9.5, NEV = 24;
  function seedRng(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let evKey = -1, evN = 0;
  function twitchEvents(born) {
    const k = Math.round(born * 1000); evN = k === evKey ? evN + 1 : 0; evKey = k;
    const r = seedRng(Math.imul(k, 2654435761) ^ Math.imul(evN + 1, 40503)), ev = [];
    let t = 0;
    for (let i = 0; i < NEV; i++) { t += -Math.log(1 - r()) / TW_MAX; if (t > LIFE) break; ev.push({ t, u: r(), m: r(), sg: r() < 0.5 ? -1 : 1 }); }
    return ev;
  }
  // DESIGN section 1: the alpha that takes a screen showing Tprev (after the 0.12 fade) to T. lab/snap/envelope.js has the
  // same formula as SNAP.alpha; this file does not wait for that script to be loaded.
  const snapAlpha = (T, Tp) => Math.max(0, Math.min(1, (T - 0.88 * Tp) / (1 - 0.88 * Tp)));
  const threatOf = (x) => drv(x, 0.8, 0, 2, 1, 'bass') * x.p('presence'); // how hard they scatter from a threat; harder with more bass
  const REG = 57;                                             // notes from A3 up spawn shapes
  const FLOCK = 0.5;                                          // half loners, half schools
  // how present (0..1): which attacks count, judged against this piece's own (recordings differ a lot in how hard they
  // play): every one at 1, the hardest two thirds at 0.5, the hardest 10% at 0. The lists are only built once the knob is down.
  let hiVels = null, chordVels = null;
  const cutOf = (pres) => Math.pow(1 - pres, 1.5) * 0.9;
  const atLeast = (list, v, cut) => {
    if (!list.length) return true;
    let a = 0, b = list.length; while (a < b) { const k = (a + b) >> 1; if (list[k] < v) a = k + 1; else b = k; }
    return a / list.length >= cut;
  };
  const hardNote = (v, cut) => {
    if (cut <= 0) return true;
    if (!hiVels) hiVels = (window.NOTES || []).filter((n) => n[2] >= REG).map((n) => n[3]).sort((a, b) => a - b);
    return atLeast(hiVels, v, cut);
  };
  const hardChord = (v, cut) => {
    if (cut <= 0) return true;
    if (!chordVels) chordVels = (typeof CHORDS !== 'undefined' ? CHORDS : []).map((c) => c.vel).sort((a, b) => a - b);
    return atLeast(chordVels, v, cut);
  };

  // Knob pictures: small versions of the shapes, pointing right, in the ember colours.
  const EMB = (h, a = 1) => ramp(0, h, a);
  function mini(g, type, x, y, s, col) {
    const r = s / 2; g.save(); g.translate(x, y); g.fillStyle = col; g.strokeStyle = col; g.beginPath();
    if (type === 'dot') { g.arc(0, 0, r * 0.7, 0, Math.PI * 2); g.fill(); }
    else if (type === 'oval') { g.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2); g.fill(); }
    else if (type === 'ring') { g.lineWidth = 1.6; g.ellipse(0, 0, r * 0.85, r * 0.62, 0, 0, Math.PI * 2); g.stroke(); }
    else if (type === 'crescent') {
      g.rect(-r - 2, -r - 2, 2 * r + 4, 2 * r + 4); g.arc(-r * 0.5, 0, r * 0.85, 0, Math.PI * 2, true); g.clip('evenodd');
      g.beginPath(); g.arc(0, 0, r * 0.9, 0, Math.PI * 2); g.fill();
    } else if (type === 'tear') { g.arc(r * 0.35, 0, r * 0.45, -Math.PI / 2, Math.PI / 2); g.quadraticCurveTo(-r * 0.2, r * 0.35, -r, 0); g.quadraticCurveTo(-r * 0.2, -r * 0.35, r * 0.35, -r * 0.45); g.fill(); }
    else if (type === 'comma') { for (let i = 6; i >= 0; i--) { const t = i / 6; g.beginPath(); g.arc(r * 0.4 - r * 1.2 * t, r * 0.55 * t * t, r * 0.32 * (1 - t) + 0.5, 0, Math.PI * 2); g.fill(); } }
    else if (type === 'chevron') { g.moveTo(r * 0.85, 0); g.lineTo(-r * 0.5, -r * 0.7); g.lineTo(-r * 0.15, 0); g.lineTo(-r * 0.5, r * 0.7); g.closePath(); g.fill(); }
    else { g.moveTo(r, 0); g.lineTo(r * 0.1, -r * 0.26); g.lineTo(-r, 0); g.lineTo(r * 0.1, r * 0.26); g.closePath(); g.fill(); }
    g.restore();
  }

  function addThreat(x, kind, tx, ty, R, str, vy = 0) {
    threats.push({ x: tx, y: ty, R, str, vy, age: 0, life: kind === 'loud' ? 0.9 : 0.7, kind });
    last = { x: tx, y: ty };
    const resp = threatOf(x);
    for (const s of shapes) {
      const dx = s.x - tx, dy = s.y - ty, d = Math.hypot(dx, dy);
      if (d > R * (0.6 + 0.4 * Math.min(1, resp))) continue;
      const away = Math.atan2(dy, dx);
      if (resp < 0.05) continue;
      // A threat kicks the shape: a second bolt from full speed (further the nearer it was), in a new direction. It moves,
      // it does not relight: born, flash and heat stay the note's own, so the light only ever falls (no fake attacks).
      s.kt = x.t; s.offFrom = x.t; s.kD = (260 + 420 * x.rnd(0.3, 1)) * 0.6 * Math.min(2, resp) * (1.2 - d / R);
      s.h = away + x.rnd(-0.4, 0.4) / Math.max(0.5, resp);
    }
  }

  TOOLS.push({
    id: 'flee-snap', name: 'Snap flock', tag: 'new',
    blurb: 'High notes burst into being as small hot shapes that bolt at once, fastest on the note itself, smearing into streaks and cooling as they slow; each lives two seconds. Bass hits rise from below, loud chords burst inside the flock and melody leaps blow up the old spot, scattering them; fast passages make them dense and frantic, slow ones leave a few cold stragglers. Turn <b>how present</b> down to tone it right down: faint, slow shapes that only the hardest notes call up.',
    params: [
      // Six knobs: the five of v3 (keys, ranges, defaults and drives unchanged, so saved settings still apply) and how present.
      { key: 'mix', label: 'round or sharp shapes', min: 0, max: 1, value: 0.45,
        hint: 'Which shapes appear. Left: soft dots, ovals and rings. Right: hooks, chevrons and needles.',
        icon: (g, v, w, h) => { const c = Math.round(v * 7), col = EMB(0.62);
          [-1, 0, 1].forEach((d, i) => mini(g, TYPES[Math.max(0, Math.min(7, c + d))], 7 + i * 13, h / 2, i === 1 ? 15 : 11, col)); } },
      { key: 'exp', label: 'how sudden the bolt', min: 1, max: 5, step: 0.1, value: 3,
        hint: 'How a shape leaves on its note. Left: it glides away and slows gently. Right: it is shot off at once and stops short.',
        icon: (g, v, w, h) => { const e = 1 + v * 4, x0 = 4, y0 = h - 4, W = w - 9, Hh = h - 8;
          ICON.line(g, x0, y0, x0 + W, y0, ICON.dim, 1);
          g.strokeStyle = EMB(0.6); g.lineWidth = 1.6; g.beginPath();
          const k = 1.2 + e * 1.6; // a fast start that flattens out: the further right, the sharper the start
          for (let i = 0; i <= 24; i++) { const t = i / 24; i ? g.lineTo(x0 + t * W, y0 - (1 - Math.exp(-k * t)) / (1 - Math.exp(-k)) * Hh) : g.moveTo(x0, y0); }
          g.stroke(); ICON.dot(g, x0, y0, 2.2, EMB(0.9)); } },
      { key: 'twitch', label: 'how jumpy', min: 0, max: 1, value: 0.25, drive: '+rate',
        hint: 'How nervous they are. Left: calm, smooth paths. Right: constant flinches and sudden swerves.',
        icon: (g, v, w, h) => { const R = ICON.rng(4), amp = 0.4 + v * 7;
          g.strokeStyle = EMB(0.5); g.lineWidth = 1.4; g.beginPath();
          for (let i = 0; i <= 9; i++) { const x = 4 + i * (w - 10) / 9, y = h / 2 + (i % 2 ? 1 : -1) * amp * (0.4 + 0.6 * R()); i ? g.lineTo(x, y) : g.moveTo(x, y); }
          g.stroke(); ICON.dot(g, w - 5, h / 2, 2.6, EMB(0.85)); } },
      { key: 'streak', label: 'trail length', min: 0, max: 3, value: 0.8, drive: '+rate',
        hint: 'How far a fleeing shape smears behind itself. Left: no trail, only the shape. Right: long streaks of light.',
        icon: (g, v, w, h) => { const hx = w - 7, y = h / 2, L = v * (w - 12);
          if (L > 1) { const gr = g.createLinearGradient(hx, 0, hx - L, 0); gr.addColorStop(0, EMB(0.75, 0.9)); gr.addColorStop(1, EMB(0.2, 0));
            g.fillStyle = gr; g.beginPath(); g.moveTo(hx, y - 3.5); g.lineTo(hx - L, y - 0.4); g.lineTo(hx - L, y + 0.4); g.lineTo(hx, y + 3.5); g.fill(); }
          mini(g, 'oval', hx, y, 9, EMB(0.9)); } },
      { key: 'pal', label: 'colours', min: 0, max: 3, step: 1, value: 0,
        hint: 'The colours, from cool and dark when still to hot and bright when fleeing. Left: ember (red to yellow). Then ice (blue), bone (pale), and right: venom (violet to pink).',
        icon: (g, v, w, h) => { const pal = Math.round(v * 3), n = 10, sw = (w - 6) / n;
          for (let i = 0; i < n; i++) ICON.rect(g, 3 + i * sw, 5, Math.ceil(sw), h - 10, ramp(pal, i / (n - 1))); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much of the picture it takes. Left: a few faint shapes that hardly move, called up only by the hardest notes. Right: every high note at full strength (as before).',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + 0.85 * v, () => { const hx = w / 2 + 4 + 8 * v, y = h / 2, L = v * (w - 16);
          if (L > 1) { const gr = g.createLinearGradient(hx, 0, hx - L, 0); gr.addColorStop(0, EMB(0.75, 0.9)); gr.addColorStop(1, EMB(0.2, 0));
            g.fillStyle = gr; g.beginPath(); g.moveTo(hx, y - 3); g.lineTo(hx - L, y - 0.4); g.lineTo(hx - L, y + 0.4); g.lineTo(hx, y + 3); g.fill(); }
          mini(g, 'oval', hx, y, 6 + 6 * v, EMB(0.45 + 0.45 * v)); }) },
    ],
    reset() {
      shapes = []; threats = []; chain = null; idleT = -9; panic = 0; avgVel = 75; prevHi = -1; prevHiT = -9; lastSpawn = -9; hiVels = null; chordVels = null;
      cool = { bass: 0, loud: 0, leap: 0 }; last = { x: 640, y: 760 }; burst = null;
    },
    onChord(ch, x) {
      const reg = REG, resp = threatOf(x);
      const loudCut = avgVel + 12;
      avgVel += (ch.vel - avgVel) * 0.04;
      // how present: a soft attack is still heard (the averages above, the melody below) but does nothing visible.
      const pres = x.p('presence'), cut = cutOf(pres), hard = hardChord(ch.vel, cut);

      // Flock centre (or the spawn cluster) for the burst.
      let cx = 0, cy = 0; for (const s of shapes) { cx += s.x; cy += s.y; }
      if (shapes.length) { cx /= shapes.length; cy /= shapes.length; } else if (chain) { cx = chain.x; cy = chain.y; } else { cx = x.W / 2; cy = x.H / 2; }

      // Threats, each with its own place so you can read the cause.
      if (ch.vel >= loudCut && ch.notes.length >= 3 && ch.t - cool.loud > 0.25) {
        cool.loud = ch.t; const bx = cx + x.rnd(-30, 30), by = cy + x.rnd(-30, 30);
        if (hard) {
          addThreat(x, 'loud', bx, by, 300 + 200 * resp, 2);
          burst = { x: bx, y: by, n: Math.max(1, Math.round(Math.min(9, 2 + ch.notes.length) * pres)) };
        }
      } else if (ch.lo < 50 && ch.vel >= avgVel - 4 && ch.t - cool.bass > 0.2) {
        cool.bass = ch.t;
        const bx = x.W * (0.1 + 0.8 * Math.max(0, Math.min(1, (ch.lo - 24) / 26)));
        if (hard) addThreat(x, 'bass', bx, x.H + 60, 340, 1.2, -520);
      }
      const hiNote = ch.hi >= reg ? ch.hi : -1;
      if (hiNote > 0 && prevHi > 0 && Math.abs(hiNote - prevHi) >= 7 && ch.t - prevHiT < 1.5 && ch.t - cool.leap > 0.3 && chain) {
        cool.leap = ch.t; if (hard) addThreat(x, 'leap', chain.x, chain.y, 240, 1.2);
        // The melody jumps: the next cluster starts far away, up or down with the leap.
        const p = Math.max(0, Math.min(1, (hiNote - reg) / 30));
        let nx = x.rnd(x.W * 0.15, x.W * 0.85); if (Math.abs(nx - chain.x) < 300) nx = chain.x < x.W / 2 ? chain.x + 380 : chain.x - 380;
        chain = { x: nx, y: x.H * (0.82 - 0.64 * p), dir: x.rnd(0, Math.PI * 2), size: 20 };
      }
      if (hiNote > 0) { prevHi = hiNote; prevHiT = ch.t; }

      // A loud chord throws out a ring of shapes already running.
      if (burst) {
        const mix0 = x.p('mix');
        for (let i = 0; i < burst.n && shapes.length < 120; i++) {
          const a0 = (i / burst.n) * Math.PI * 2 + x.rnd(-0.3, 0.3), size = x.rnd(18, 34);
          const ti = Math.max(0, Math.min(7, Math.round(mix0 * 7 + x.rnd(-1.5, 1.5))));
          shapes.push({ x: burst.x + Math.cos(a0) * 14, y: burst.y + Math.sin(a0) * 14, size, type: TYPES[ti], aspect: x.rnd(0.9, 1.3), flip: sgn(x),
            al: 0.85, t0: ch.t, born: ch.t, D: x.rnd(400, 700), h: a0, off: 0, speed: 0, flash: 1, kD: 0, kt: 0, age: 0, tb: 0, ev: twitchEvents(ch.t), offFrom: 0, px: NaN, py: NaN });
        }
        burst = null;
      }
      // Spawn.
      // Every note that reaches us is heard: picked notes (P6), and the accents part, which only ever sends rare ones, so a
      // note after a quiet gap always lands. Only a busy run on all notes is thinned, as in Flee.
      // STAND-IN, not the real thing: a part signal for the accents does not exist yet, so x.onPicks() is false in the lab and the
      // gap since the last visible shape stands in for it. It is kept as is until such a signal exists.
      const pSpawn = (x.onPicks() || ch.t - lastSpawn > 0.25) ? 1 : 0.4 + 0.6 * panic;
      const highs = ch.notes.filter((n) => n.m >= reg).sort((a, b) => a.m - b.m).slice(panic > 0.5 ? -6 : -4);
      const mix = x.p('mix');
      for (const n of highs) {
        if (shapes.length >= 110 || x.rnd(0, 1) > pSpawn || !hardNote(n.v, cut)) continue;
        lastSpawn = ch.t; // measured from the last shape that really appeared, not from the last chord
        const p = Math.max(0, Math.min(1, (n.m - reg) / 30));
        const size = (16 + 26 * n.v / 110) * (1.25 - 0.5 * p) * x.rnd(0.7, 1.4);
        const pitchY = x.H * (0.82 - 0.64 * p);
        if (!chain || ch.t - idleT > 0.8 || chain.x < 80 || chain.x > x.W - 80 || chain.y < 60 || chain.y > x.H - 60) {
          chain = { x: x.rnd(x.W * 0.15, x.W * 0.85), y: pitchY, dir: x.rnd(0, Math.PI * 2), size };
        } else {
          chain.dir += x.rnd(-1, 1);
          const step = (chain.size + size) * x.rnd(0.45, 0.8);
          chain.x += Math.cos(chain.dir) * step; chain.y += Math.sin(chain.dir) * step * 0.7 + (pitchY - chain.y) * 0.3;
          chain.size = size;
        }
        idleT = ch.t;
        // Shape: a spread around the mix centre, round → sharp.
        const ti = Math.max(0, Math.min(7, Math.round(mix * 7 + (x.rnd(0, 1) + x.rnd(0, 1) + x.rnd(0, 1) - 1.5) * 2.4)));
        const type = TYPES[ti];
        const aspect = type === 'needle' ? x.rnd(1, 1.6) : type === 'oval' ? x.rnd(0.9, 1.7) : x.rnd(0.85, 1.25);
        const away = Math.atan2(chain.y - last.y, chain.x - last.x) + x.rnd(-0.9, 0.9);
        shapes.push({
          x: chain.x + x.rnd(-5, 5), y: chain.y + x.rnd(-5, 5), size, type, aspect, flip: sgn(x),
          al: Math.max(0.35, (0.55 + 0.45 * panic) * (0.6 + 0.4 * n.v / 110)), // P6: a picked note is never fainter than 0.35
          t0: ch.t, born: ch.t, age: 0, tb: 0,
          D: x.rnd(0.8, 1.2) * (260 + 420 * panic),
          h: away, off: 0, speed: 0, flash: 1, kD: 0, kt: 0, ev: twitchEvents(ch.t), offFrom: 0, px: NaN, py: NaN,
        });
      }
    },
    frame(x) {
      const g = x.g, dt = x.dt;
      budget = 4;
      panic += (smooth(0.12, 0.6, x.feat.rate) - panic) * (1 - Math.pow(0.5, dt / 0.4));
      const pres = x.p('presence'), fade = 1 - 0.84 * (1 - Math.pow(pres, 1.5)), slow = 1 - 0.8 * (1 - pres); // both exactly 1 at the default
      const tau = TAU(x), tw = x.p('twitch') * pres, streak = x.p('streak'), resp = threatOf(x), flock = FLOCK;
      const pal = Math.round(x.p('pal'));

      // Threats: move (bass ones rise), age, push.
      for (const t of threats) { t.age += dt; t.y += t.vy * dt; t.vy *= Math.pow(0.5, dt / 0.5); }
      threats = threats.filter((t) => t.age < t.life);

      const n = shapes.length;
      for (let i = 0; i < n; i++) {
        const s = shapes[i];
        // Age and bolt time are read off the chord's time, not summed (P8). The flash holds two steps, then halves every 0.05 s.
        s.age = x.t - s.t0; s.tb = Math.max(0, (x.t - s.born) * slow); // how present: the bolt's clock slows too
        s.flash = flashOf(s.tb);
        // Desired direction: away from threats, plus the panicked school.
        let fx = 0, fy = 0;
        for (const t of threats) {
          const dx = s.x - t.x, dy = s.y - t.y, d = Math.hypot(dx, dy) + 1, w = t.str * resp * Math.exp(-(d * d) / (t.R * t.R)) * (1 - t.age / t.life);
          fx += dx / d * w * 3; fy += dy / d * w * 3;
        }
        if (flock > 0) {
          let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, k = 0;
          for (let j = 0; j < n; j++) {
            if (j === i) continue; const o = shapes[j];
            const dx = o.x - s.x, dy = o.y - s.y, d2 = dx * dx + dy * dy;
            if (d2 > 160 * 160) continue;
            k++; ax += Math.cos(o.h); ay += Math.sin(o.h); cx += dx; cy += dy;
            if (d2 < 40 * 40) { sx -= dx / (d2 + 30); sy -= dy / (d2 + 30); }
          }
          if (k) { fx += (ax / k * 1.2 + cx / k * 0.006) * flock + sx * 30; fy += (ay / k * 1.2 + cy / k * 0.006) * flock + sy * 30; }
        }
        if (fx || fy) {
          const want = Math.atan2(fy, fx), mag = Math.min(1, Math.hypot(fx, fy));
          s.h += wrap(want - s.h) * Math.min(1, dt * (2 + 8 * tw) * mag);
        }
        // Twitch: sudden jerks of heading that snap back.
        // A pure function of time: the latest jerk (of the seeded list, thinned by the knob) at or before now, decayed.
        // A threat's kick wipes the jerks before it (offFrom).
        s.off = 0;
        const rate = (0.5 + 9 * tw) / TW_MAX;
        for (let k = s.ev.length - 1; k >= 0; k--) {
          const e = s.ev[k], te = s.born + e.t;
          if (te > x.t) continue;
          if (te < s.offFrom) break;
          if (e.u >= rate) continue;
          s.off = (0.3 + e.m * (0.1 + 1.1 * tw)) * e.sg * pres * Math.pow(0.5, (x.t - te) / (0.06 + 0.1 * (1 - tw)));
          break;
        }
        // Speed: pos = D (1 - e^(-t/tau)), so the speed D/tau * e^(-t/tau) is greatest at the note and falls at once (P10).
        // A threat's kick is a second bolt of the same kind, from its own moment.
        const v = Math.min(9000, s.D / tau * Math.exp(-s.tb / tau) + (s.kD ? s.kD / tau * Math.exp(-Math.max(0, x.t - s.kt) * slow / tau) : 0)) * slow;
        s.speed = v;
        const head = s.h + s.off; s.head = head;
        s.x += Math.cos(head) * v * dt; s.y += Math.sin(head) * v * dt;
      }
      shapes = shapes.filter((s) => s.age < LIFE && s.x > -260 && s.x < x.W + 260 && s.y > -260 && s.y < x.H + 260);

      // Threat marks: a dark void that pushes the trails away, and a thin ring for the loud ones.
      for (const t of threats) {
        const k = t.age / t.life, r = t.R * (0.25 + 0.75 * (1 - Math.pow(1 - Math.min(1, k * 2.2), 3))), a = (1 - k) * Math.min(1, resp + 0.2) * fade;
        const gr = g.createRadialGradient(t.x, t.y, 0, t.x, t.y, r * 0.8);
        gr.addColorStop(0, `rgba(0,0,0,${0.55 * a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = gr;
        g.beginPath(); g.arc(t.x, t.y, r * 0.8, 0, Math.PI * 2); g.fill();
        if (t.kind === 'loud' && t.age < 0.12) { // one crisp hairline on the attack, gone before it can ripple
          g.strokeStyle = ramp(pal, 0.8, 0.7 * (1 - t.age / 0.12) * fade); g.lineWidth = 1.5;
          g.beginPath(); g.arc(t.x, t.y, 30 + t.age * 1400, 0, Math.PI * 2); g.stroke();
        }
      }

      // Shapes: streak behind, stretched body, a little additive glow when hot.
      for (const s of shapes) {
        const fin = 1; // no fade-in: the peak is in the note's own step (P1)
        // One envelope for the light and the heat: it only falls after the hold, wherever a threat has thrown the shape.
        const e = envOf(s.tb, s.age), ePrev = x.t - x.dt >= s.born ? envOf((x.t - x.dt - s.born) * slow, s.age - x.dt) : 0;
        const heat = 0.42 + 0.58 * e, hb = Math.round(heat * (HB - 1));
        // The exact one-step alpha assumes the mark is repainted where it stood; a shape that has moved has nothing under it,
        // so a moving mark gets its plain alpha, and only one that stayed within 3 px gets the exact one.
        const T = Math.min(0.98, s.al * e * fade);
        const still = ePrev > 0 && Math.hypot(s.x - s.px, s.y - s.py) < 3;
        const a = still ? snapAlpha(T, Math.min(0.98, s.al * ePrev * fade)) : T;
        s.px = s.x; s.py = s.y;
        if (a <= 0.01) continue;
        const c = Math.cos(s.head), sn = Math.sin(s.head);
        const L = Math.min(420, streak * s.speed * 0.09);
        if (L > s.size * 0.4) {
          const w = s.size / 22 * (0.6 + 0.4 * heat);
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, a * 0.75);
          g.setTransform(c * L / SW, sn * L / SW, -sn * w, c * w, s.x + c * s.size * 0.3, s.y + sn * s.size * 0.3);
          g.drawImage(get('streak', pal, hb), -SW, -SH / 2);
        }
        const stretch = 1 + Math.min(1.8, streak * s.speed / 2200);
        const grow = 0.75 + 0.25 * fin + 0.35 * s.flash;
        const sx = s.size / 32 * s.aspect * stretch * grow, sy = s.size / 32 * grow * s.flip / Math.sqrt(stretch);
        g.setTransform(c * sx, sn * sx, -sn * sy, c * sy, s.x, s.y);
        const spr = get(s.type, pal, hb);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = a;
        g.drawImage(spr, -HALF, -HALF);
        if (heat > 0.35) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.35 * heat; g.drawImage(spr, -HALF, -HALF); }
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
    },
  });
})();
