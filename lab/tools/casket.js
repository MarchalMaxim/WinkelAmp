// The casket from round 1 (melt + drips + chord cuts); being built into the app now. It had no knobs: the five below
// (the 2026-10-31 style) all started at its old fixed numbers.
// v2 (the user, 2026-11-01: "a one-time applied widget i think... Apply it once on some attacks, instead of continuously"):
// on some attacks, the hardest of what this instance hears, with room between them, one melt, its drips and one cut land
// once and finish; between them the casket leaves the picture alone (and costs nothing). keep = 1 is the old casket,
// frame for frame, for the shows composed on it; between 0 and 1 the two ways cross over.
(() => {
  // snap: a copy of the shared canvas at its real size (1280×720 at scale 1, ×S in a supersampled render)
  let snap = null, sg = null, S = 1;
  function grab(x) {
    const c = x.canvas;
    if (!snap || snap.width !== c.width || snap.height !== c.height) {
      snap = document.createElement('canvas'); snap.width = c.width; snap.height = c.height; sg = snap.getContext('2d');
    }
    S = c.width / x.W; sg.drawImage(c, 0, 0);
  }
  let drips = [], scars = [], shake = 0, time = 0;
  let meltAge = 9, phase = 0, lastHit = -Infinity, lastHeard = -Infinity, song = null, held = null, hg = null;   // v2: the impulse
  const MELT_LONG = 1.1, MELT_KICK = 2.6;     // how long one melt runs (s), and its opening speed against the old steady melt
  const ALONE = 2;                            // an attack this long (s) after the one before it stands alone: it always lands
  // What this instance hears (CHORDS: a part's or a note picker's own, when it is routed): its velocities in order, and
  // whether it is so sparse that every attack is one to land.
  function heard() {
    if (song) return song;
    const c = typeof CHORDS !== 'undefined' ? CHORDS : [], n = c.length;
    const span = n > 1 ? c[n - 1].t - c[0].t : 0, rate = n / Math.max(span, 1);
    return (song = { vels: c.map((ch) => ch.vel).sort((a, b) => a - b), rate, sparse: n <= 4 || rate <= 1 / 1.5 });
  }
  // How far apart the landings are meant to be (s): cutAt from every 3 s to every 20 s.
  const spacing = (x) => 3 * Math.pow(20 / 3, (x.p('cutAt') - 80) / 38);
  function lands(ch, x) {
    const h = heard(), gap = ch.t - lastHeard, since = ch.t - lastHit;
    lastHeard = ch.t;
    if (h.sparse || !(gap > 0 && gap < ALONE)) return true;
    const sp = spacing(x);
    if (since > 0 && since < 0.6 * sp) return false;   // the picture rests
    // the hardest fraction of this song that comes to about one per spacing; the longer it has rested, the lower the bar
    const frac = Math.min(1, 1.6 / (h.rate * sp)), bar = h.vels[Math.min(h.vels.length - 1, Math.floor((1 - frac) * h.vels.length))];
    const starved = since > 0 ? Math.max(0, Math.min(1, since / sp - 2)) : 1;
    return ch.vel >= bar * (1 - starved);
  }
  function land(ch, x, keep) {
    lastHit = ch.t; meltAge = 0; phase = x.rnd(0, 100);
    const n = Math.round(x.p('drips') * (1 - keep) * (8 + 2 * Math.min(6, ch.notes.length)));
    for (let i = 0; i < n; i++) drips.push({ x: x.rnd(0, x.W), y: x.rnd(-140, -10), w: x.rnd(6, 26) * Math.max(ch.vel, 90) / 100, v: x.rnd(200, 420), red: Math.random() < 0.7 });
    cut(x, Math.max(ch.vel, 100));
    // The struck picture, cut, held to melt away over the live one: on a widget that repaints itself every frame (Rorschach)
    // a shift of the canvas lasts one frame, so without it the strike would hardly show.
    if (!held || held.width !== snap.width || held.height !== snap.height) { held = document.createElement('canvas'); held.width = snap.width; held.height = snap.height; hg = held.getContext('2d'); }
    hg.drawImage(x.canvas, 0, 0);
  }
  const SCAR = '#ebf0aa', RED = '#a0141a', OLIVE = '#969628';
  function cut(x, vel) {
    const g = x.g; grab(x);
    const ang = x.rnd(-1.2, 1.2) + (Math.random() < 0.5 ? 0 : Math.PI / 2), cx = x.rnd(x.W * 0.25, x.W * 0.75), cy = x.rnd(x.H * 0.25, x.H * 0.75);
    const dx = Math.cos(ang), dy = Math.sin(ang), d = (14 + (vel - 90) * 2.2) * x.p('gap');
    for (const side of [1, -1]) {
      g.save(); g.beginPath(); const nx = -dy * side, ny = dx * side;
      g.moveTo(cx - dx * 3000, cy - dy * 3000); g.lineTo(cx + dx * 3000, cy + dy * 3000);
      g.lineTo(cx + dx * 3000 + nx * 3000, cy + dy * 3000 + ny * 3000); g.lineTo(cx - dx * 3000 + nx * 3000, cy - dy * 3000 + ny * 3000);
      g.closePath(); g.clip(); g.drawImage(snap, dx * d * side, dy * d * side, x.W, x.H); g.restore();
    }
    scars.push({ cx, cy, dx, dy, age: 0 }); shake = 14 * x.p('shake');
  }
  // Knob pictures.
  const meltIcon = (g, v, w, h) => {      // a striped block cut into columns, each sliding down by its own amount
    for (let i = 0; i < 6; i++) {
      const dy = v * 9 * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + 0.4)));
      for (let k = 0; k < 3; k++) ICON.rect(g, 8 + i * 4, 3 + k * 5 + dy, 4, 3, k === 1 ? ICON.gold : RED);
    }
  };
  const dripIcon = (g, v, w, h) => {      // drips running down from the top edge: none … one per note
    ICON.line(g, 2, 2, w - 2, 2, ICON.dim, 1);
    const R = ICON.rng(9), n = Math.round(v * 7);
    for (let i = 0; i < 7; i++) {
      const x = 4 + i * 5.3, len = 6 + R() * 12, wd = 1.6 + R() * 2.2, red = R() < 0.7;
      if (i >= n) continue;
      const col = red ? RED : OLIVE; ICON.rect(g, x - wd / 2, 2, wd, len, col); ICON.dot(g, x, 2 + len, wd / 2 + 0.3, col);
    }
  };
  const slashIcon = (g, v, w, h) => {     // left: many chords cut (many slashes); right: only the loudest (one)
    const n = Math.round(1 + (1 - v) * 4), R = ICON.rng(3);
    for (let i = 0; i < n; i++) {
      const cx = n === 1 ? w / 2 : 6 + (i / (n - 1)) * (w - 12) + (R() - 0.5) * 3, a = -1.1 + (R() - 0.5) * 0.5;
      ICON.line(g, cx - Math.cos(a) * 13, h / 2 - Math.sin(a) * 13, cx + Math.cos(a) * 13, h / 2 + Math.sin(a) * 13, SCAR, 1.4);
    }
  };
  const gapIcon = (g, v, w, h) => {       // a striped square cut on the diagonal; the two halves slide along the cut
    const s = 20, cx = w / 2, cy = h / 2, a = -0.35, dx = Math.cos(a), dy = Math.sin(a), d = v * 7;
    for (const side of [1, -1]) {
      g.save(); g.beginPath(); const nx = -dy * side, ny = dx * side;
      g.moveTo(cx - dx * 40, cy - dy * 40); g.lineTo(cx + dx * 40, cy + dy * 40); g.lineTo(cx + dx * 40 + nx * 40, cy + dy * 40 + ny * 40); g.lineTo(cx - dx * 40 + nx * 40, cy - dy * 40 + ny * 40);
      g.closePath(); g.clip(); g.translate(dx * d * side, dy * d * side);
      for (let k = 0; k < 5; k++) ICON.rect(g, cx - s / 2 + k * 4.2, cy - s / 2, 2.6, s, k % 2 ? ICON.gold : RED);   // upright stripes, so the shear shows
      g.restore();
    }
    ICON.line(g, cx - dx * 13, cy - dy * 13, cx + dx * 13, cy + dy * 13, SCAR, 1);
  };
  TOOLS.push({
    id: 'casket', name: 'The casket', tag: 'v2',
    blurb: 'New in v2: it strikes once and lets go. On the hardest attacks the picture melts, paint drips from the top and one cut slashes through, then it leaves the picture alone until the next. It works on whatever is under it. <b>keep melting between</b>, all the way right, is the old casket that never stops.',
    params: [
      { key: 'melt', label: 'melt', min: 0, max: 6, value: 2.2, less: 0.7,
        hint: 'How far the whole picture slides down and melts when it strikes. Left: it holds still. Right: it runs a long way down.',
        icon: meltIcon },
      { key: 'drips', label: 'drips', min: 0, max: 1, value: 0.5, less: 0.1,
        hint: 'How much paint drips from the top when it strikes. Left: no drips. Right: a curtain of them.',
        icon: dripIcon },
      { key: 'cutAt', label: 'which attacks strike', min: 80, max: 118, step: 1, value: 92, less: 108,
        hint: 'How hard an attack must be to set it off, against this piece. Left: a strike every few seconds. Right: only the very hardest, far apart.',
        icon: slashIcon },
      { key: 'gap', label: 'how far a cut slides', min: 0, max: 3, value: 1,
        hint: 'How far the two sides of a cut slide past each other. Left: a hairline. Right: a wide shear.',
        icon: gapIcon },
      { key: 'shake', label: 'jolt on a cut', min: 0, max: 2, value: 1,
        hint: 'How hard the picture jolts when a cut lands. Left: still. Right: a violent jolt.',
        icon: (g, v, w, h) => ICON.shake(g, v * 4, () => ICON.square(g, w / 2, h / 2, h - 10, RED)) },
      { key: 'keep', label: 'keep melting between', min: 0, max: 1, value: 0,
        hint: 'What it does between strikes. Left: nothing, the picture is left alone. Right: the old casket, melting all the time, dripping on notes and slashing on every loud full chord.',
        icon: (g, v, w, h) => {   // time from left to right: one tall strike, and how much melting goes on around it
          ICON.line(g, 2, h - 3, w - 2, h - 3, ICON.dim, 1);
          for (let i = 0; i < 8; i++) { const b = i === 3 ? (1 - v) * 16 : 0, l = v * 11 + b; if (l > 0.5) ICON.rect(g, 4 + i * 4.3, h - 3 - l, 3, l, i === 3 ? SCAR : RED); }
        } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much it destroys: how often it strikes, how much paint drips, how far the picture melts. Left: a strike about every twelve seconds in busy music, with a short melt and a drip or two. Right: a strike every five or six seconds, several drips, a long melt. Very sparse music strikes on every attack at any setting. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { drips = []; scars = []; shake = 0; meltAge = 9; phase = 0; lastHit = -Infinity; lastHeard = -Infinity; },
    onChord(ch, x) {
      const keep = x.p('keep');
      // The old way, in proportion to keep (whole at 1, where no extra random number is drawn).
      if (keep > 0) {
        const pd = x.p('drips') * keep;
        for (const n of ch.notes) if (Math.random() < pd) drips.push({ x: x.rnd(0, x.W), y: -10, w: x.rnd(6, 26) * n.v / 100, v: x.rnd(80, 260), red: Math.random() < 0.7 });
        if (ch.vel >= x.p('cutAt') && ch.notes.length >= 3 && (keep >= 1 || Math.random() < keep)) cut(x, ch.vel);
      }
      // The new way: at keep = 1 there is no strike.
      if (keep < 1 && lands(ch, x)) land(ch, x, keep);
    },
    frame(x) {
      const g = x.g; time += x.dt;
      const keep = x.p('keep');
      // The steady melt (keep) and a strike's: fast at the attack, spent after MELT_LONG. At rest nothing is copied at all.
      let melt = x.p('melt') * keep, ghost = 0;
      if (meltAge < MELT_LONG) { const u = 1 - meltAge / MELT_LONG; melt += x.p('melt') * (1 - keep) * MELT_KICK * u * u; ghost = 0.95 * (1 - keep) * u * u * Math.min(1, x.p('melt') / 2.2); meltAge += x.dt; }   // no melt, no held picture: the left end of "melt" holds still
      if (melt > 0 || keep >= 1) {
        grab(x);
        for (let i = 0; i < x.W; i += 10) {
          const sp = (1 + Math.sin(i * 0.037 + time * 0.7 + phase) * 0.5 + Math.sin(i * 0.11 + phase * 1.7) * 0.5) * melt * x.dt * 60;
          g.drawImage(snap, i * S, 0, 10 * S, x.H * S, i, sp, 10, x.H);
        }
      }
      if (shake > 0.3 && x.dt > 0) { g.translate(x.rnd(-shake, shake), x.rnd(-shake, shake)); shake *= Math.pow(0.86, x.dt * 60); }   // per song-second, so it decays the same on any screen
      if (ghost > 0 && held) {
        // how far each column has run by now (the steady melt's own column shape), and the held picture letting go
        const u = Math.min(1, meltAge / MELT_LONG), run = x.p('melt') * (1 - keep) * MELT_KICK * 60 * MELT_LONG / 3 * (1 - Math.pow(1 - u, 3));
        g.globalAlpha = ghost;
        for (let i = 0; i < x.W; i += 20) g.drawImage(held, i * S, 0, 20 * S, x.H * S, i, run * (1 + Math.sin(i * 0.037 + phase) * 0.5 + Math.sin(i * 0.11 + phase * 1.7) * 0.5), 20, x.H);
        g.globalAlpha = 1;
      }
      for (const d of drips) {
        d.y += d.v * x.dt; d.v *= 1 + 0.6 * x.dt;
        g.fillStyle = d.red ? 'rgba(120,8,10,0.85)' : 'rgba(150,160,40,0.7)';
        g.fillRect(d.x - d.w / 2, d.y - 40, d.w, 40); g.beginPath(); g.arc(d.x, d.y, d.w / 2, 0, Math.PI * 2); g.fill();
      }
      drips = drips.filter((d) => d.y < x.H + 60);
      for (const s of scars) {
        s.age += x.dt; const al = Math.max(0, 1 - s.age / 0.9);
        g.strokeStyle = `rgba(235,240,170,${al})`; g.lineWidth = 1 + 5 * al;
        g.beginPath(); g.moveTo(s.cx - s.dx * 3000, s.cy - s.dy * 3000); g.lineTo(s.cx + s.dx * 3000, s.cy + s.dy * 3000); g.stroke();
      }
      scars = scars.filter((s) => s.age < 0.9);
    },
  });
})();
