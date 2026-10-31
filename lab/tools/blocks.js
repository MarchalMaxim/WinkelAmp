// Glitch blocks v2: a sibling of the casket cuts. Attacks tear rectangles of the picture out of place
// (datamosh-style), and they settle back in choppy steps. Quiet notes nudge one thin slice; big chords
// tear the whole picture into an offset mosaic and flash an inverted band. A base of thin note bars
// (low = blood red, high = bone, struck = white-hot) gives it something to tear when it plays alone.
// v2: 5 knobs (new keys, so the new defaults apply where the old ones were saved); smear, freeze, base and
// heat are fixed; the colour split follows how fast the music is; thinner, brighter bars instead of maroon slabs;
// torn blocks get a bright seam; big chords flash an inverted band.
(() => {
  const W = 1280, H = 720;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  const [bc, bg] = mk();   // bc: the base bars, which linger on their own clock
  // snap (the picture this frame) and tmp (one block's tinted copy): the shared canvas's real size, ×S in a
  // supersampled render; source rectangles in them are user units × S
  let snap = null, sg = null, tmp = null, tg = null, S = 1;
  function sized(x) {
    const c = x.canvas; S = c.width / x.W;
    if (!snap || snap.width !== c.width || snap.height !== c.height) {
      snap = document.createElement('canvas'); snap.width = c.width; snap.height = c.height; sg = snap.getContext('2d');
      tmp = document.createElement('canvas'); tmp.width = c.width; tmp.height = c.height; tg = tmp.getContext('2d');
    }
  }
  let blocks = [], flashes = [], energy = 0, lastT = 0;
  const R = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const DEEP = [120, 6, 12], RED = [214, 28, 26], BONE = [236, 226, 204];
  const SMEAR = 0.3, FREEZE = 0.3, BASE = 0.75;
  const pitchY = (x, m) => H * (0.9 - 0.8 * x.pitch01(m));
  // where a note's base bar starts: pitch class around the circle of fifths, nudged by octave
  const barX = (m) => (((m * 7) % 12) / 12) * W * 0.8 + (Math.floor(m / 12) % 3) * W * 0.05;
  // Loudness relative to this recording (its 93rd-percentile note velocity), so both songs reach the big tears.
  let VQ = 0;
  const loud = (v) => {
    if (!VQ) { const v2 = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b); VQ = v2.length ? Math.max(70, v2[Math.floor(v2.length * 0.93)]) : 100; }
    return v * 100 / VQ;
  };
  // icon colours
  const IR = '#d61c1a', IDK = '#5a1416';

  function addBlock(x, b) {
    const settle = x.p('settle');
    Object.assign(b, { age: 0, settle, sox: b.ox, soy: b.oy, shx: b.ox, shy: b.oy });
    if (Math.random() < FREEZE) {           // freeze: keep the picture as it was at the attack
      const s = x.canvas.width / x.W, c = document.createElement('canvas'); c.width = Math.max(1, Math.round(b.w * s)); c.height = Math.max(1, Math.round(b.h * s));
      c.getContext('2d').drawImage(x.canvas, b.sx * s, b.sy * s, b.w * s, b.h * s, 0, 0, b.w * s, b.h * s); b.img = c; b.imgS = s;
    }
    blocks.push(b); if (blocks.length > 64) blocks.shift();
  }

  // One rectangle: aspect from 'form' (columns <-> rows), position near the note's pitch, motion along its long axis.
  function tear(x, m, power, opts = {}) {
    const B = x.p('size'), shape = x.p('form');
    let w = B * Math.pow(2, shape * 2.2), h = B * Math.pow(2, -shape * 2.2);
    if (opts.band) { w = W; h = B * R(0.6, 2.2); }
    if (opts.slice) { w = W * R(0.3, 0.95); h = R(3, 12) * (1 + power); }
    // mostly tear where the picture is (this note's bar), sometimes anywhere
    const cx = opts.band || Math.random() < 0.3 ? R(0, W) : barX(m) + R(-0.2, 1) * 220;
    const sx = Math.floor((cx - w / 2) / Math.max(4, w * 0.5)) * Math.max(4, w * 0.5);
    const sy = Math.round((pitchY(x, m) + R(-1, 1) * H * 0.12 * (opts.slice ? 0.2 : 1)) / Math.max(2, h)) * Math.max(2, h);
    const mag = x.p('jump') * (16 + 150 * power) * R(0.4, 1) * (opts.band ? 1.6 : 1);
    const along = w >= h ? 0 : 1, sideways = Math.random() < (Math.abs(shape) < 0.3 ? 0.5 : 0.88) ? along : 1 - along;
    const sgn = Math.random() < 0.5 ? -1 : 1;
    let ox = sideways === 0 ? sgn * mag : 0, oy = sideways === 1 ? sgn * mag * 0.7 : 0;
    // smear: the block slides only part of its own length, so it re-copies itself every frame and streaks
    const smear = Math.random() < SMEAR;
    if (smear) { ox = Math.sign(ox) * Math.min(Math.abs(ox), w * 0.25) * 0.5; oy = Math.sign(oy) * Math.min(Math.abs(oy), h * 0.25) * 0.5; }
    // colour split: wider the faster the music runs
    const splitK = 5 + 16 * x.feat.rate;
    const split = splitK * (opts.slice ? 0.6 : 1) * (0.5 + power) * (Math.random() < 0.3 + 0.5 * power ? 1 : 0);
    addBlock(x, { sx, sy, w, h, ox: Math.round(ox / 4) * 4, oy: Math.round(oy / 4) * 4, smear, split, power });
    if (opts.band && flashes.length < 2) flashes.push({ y: sy + oy, h });
  }

  TOOLS.push({
    id: 'blocks', name: 'Glitch blocks', tag: 'v2',
    blurb: 'Every attack tears blocks of the picture out of place, and they snap back in choppy steps. A quiet note nudges one thin slice; a big chord tears a whole mosaic and flashes an inverted band. Thin note bars (low = red, high = bone) give it a picture of its own; mix it with squares, ink or the casket and it tears those too.',
    params: [
      { key: 'size', label: 'block size', min: 8, max: 240, step: 1, value: 64, drive: '-rate',
        hint: 'How big the torn pieces are. Left: thin slivers and fine grit. Right: big chunks of the picture.',
        icon: (g, v, w, h) => {
          const s = 3 + v * 13;
          for (let y = 2, j = 0; y < h - 2; y += s, j++) for (let x = 2, i = 0; x < w - 2; x += s, i++)
            ICON.rect(g, x, y, Math.min(s - 1, w - 2 - x), Math.min(s - 1, h - 2 - y), (i + j) % 2 ? IR : IDK);
        } },
      { key: 'form', label: 'columns or rows', min: -1, max: 1, value: 0.6,
        hint: 'The shape of the torn pieces. Left: tall columns that slip up and down. Right: wide rows that slide sideways.',
        icon: (g, v, w, h) => {
          const rw = 5 + v * 26, rh = 21 - v * 16;
          ICON.rect(g, w / 2 - rw / 2, h / 2 - rh / 2, rw, rh, IR);
          if (v < 0.4) ICON.arrow(g, w / 2 + rw / 2 + 5, h / 2 + 7, w / 2 + rw / 2 + 5, h / 2 - 8, ICON.ink, 1.3);
          else if (v > 0.6) ICON.arrow(g, w / 2 - 9, h / 2 + rh / 2 + 3.5, w / 2 + 9, h / 2 + rh / 2 + 3.5, ICON.ink, 1.3);
        } },
      { key: 'jump', label: 'how far they jump', min: 0, max: 2, value: 0.9, drive: '+level',
        hint: 'How far a torn piece is thrown out of place. Left: a small shiver. Right: flung far across the picture.',
        icon: (g, v, w, h) => {
          g.strokeStyle = ICON.dim; g.lineWidth = 1; g.strokeRect(4.5, 7.5, 10, 11);
          ICON.rect(g, 4 + v * 21, 7, 11, 12, IR);
          if (v > 0.25) ICON.arrow(g, 9, 3, 9 + v * 21, 3, ICON.ink, 1.1);
        } },
      { key: 'amount', label: 'how many tears', min: 0, max: 3, value: 1.2,
        hint: 'How many pieces each attack tears. Left: hardly any, only the biggest chords. Right: a storm of fragments on every chord.',
        icon: (g, v, w, h) => {
          const r = ICON.rng(9), n = Math.round(1 + v * 9);
          for (let i = 0; i < n; i++) ICON.rect(g, 2 + r() * (w - 12), 2 + r() * (h - 6), 6 + r() * 4, 2.5, i % 3 ? IR : '#ece2cc');
        } },
      { key: 'settle', label: 'how long until it heals', min: 0.15, max: 5, value: 1.6,
        hint: 'How long a torn piece takes to snap back into place. Left: a split-second stutter. Right: the broken picture hangs for seconds.',
        icon: (g, v, w, h) => {
          ICON.line(g, 2, h / 2 + 4, w - 2, h / 2 + 4, ICON.dim, 1);
          for (let i = 0; i < 5; i++) { const off = 10 * Math.exp(-i / (0.25 + v * 5)); ICON.rect(g, 3 + i * 7.2, h / 2 - 1 - off, 5.5, 5, IR); }
        } },
    ],
    reset(x) { blocks = []; flashes = []; energy = 0; lastT = x.t; bg.clearRect(0, 0, W, H); },
    onChord(ch, x) {
      const vel = loud(ch.vel), n = ch.notes.length, power = Math.max(0, Math.min(1, (vel - 40) / 70)), count = x.p('amount');
      // a run of loud attacks counts as big too (the orchestra's tutti arrive as quick small chords, not one fat one)
      energy = energy * Math.pow(0.5, Math.max(0, ch.t - lastT) / 0.4) + (vel >= 85 ? power * Math.sqrt(n) : 0); lastT = ch.t;
      const big = (vel >= 92 && n >= 3) || (vel >= 98 && n >= 2) || vel >= 104 || energy > 2.6;
      if (big && energy > 2.6) energy = 0;
      const pick = () => ch.notes[Math.floor(Math.random() * n)].m;
      if (n === 1 && !big) { if (Math.random() < count) tear(x, ch.lo, power * 0.8, { slice: true }); return; }
      let k = count * power * power * Math.pow(n, 1.1) * 2.4;
      k = Math.floor(k) + (Math.random() < k % 1 ? 1 : 0);
      for (let i = 0; i < k; i++) tear(x, pick(), power);
      if (big && count > 0.05) { const nb = 1 + Math.floor(Math.random() * 2 + power); for (let i = 0; i < nb; i++) tear(x, pick(), power, { band: true }); }
    },
    frame(x) {
      const g = x.g, dt = x.dt;
      // base: every sounding note is a thin bar (y = pitch, x = pitch class, width grows while held). The bars live on
      // their own canvas and linger, so the blocks always have a picture to tear.
      bg.globalCompositeOperation = 'destination-out'; bg.globalAlpha = 1 - Math.pow(0.5, dt / (0.25 + BASE * 2.2));
      bg.fillRect(0, 0, W, H); bg.globalCompositeOperation = 'source-over'; bg.globalAlpha = 1;
      for (const nt of x.sounding()) {
        const p = x.pitch01(nt.m), held = x.t - nt.start, fl = Math.max(0, 1 - held / 0.15), vv = Math.min(1, loud(nt.v) / 105);
        // low = deep red, middle = bright red, high = bone; struck notes flash toward white
        const hue = p < 0.45 ? lerp(DEEP, RED, p / 0.45) : lerp(RED, BONE, Math.min(1, (p - 0.45) / 0.35) * (0.35 + 0.65 * vv));   // quiet high notes stay rose, loud ones go bone
        // quiet notes sink toward a dark red (not grey); struck ones flash toward white
        const col = lerp(lerp([60, 4, 8], hue, 0.35 + 0.65 * vv), [255, 250, 240], fl * 0.6);
        const h = Math.max(2, (3 + 16 * vv) * (0.6 + 1.1 * (1 - p))), y = pitchY(x, nt.m);
        const x0 = barX(nt.m), w = Math.min(W * 0.75, 90 + held * 240 + 220 * vv);
        bg.fillStyle = `rgb(${col})`; bg.fillRect(x0, y - h / 2, w, h);
        if (fl > 0) { g.globalAlpha = Math.min(1, fl * 1.1); g.fillStyle = `rgb(${col})`; g.fillRect(x0, y - h / 2, w, h); }
      }
      // the shared fade takes 12% a frame, so a layer redrawn every frame piles up: solve for the alpha that
      // settles at the opacity we want (about 80%)
      const o = BASE * 0.8;
      g.globalAlpha = Math.min(1, 0.12 * o / (1 - 0.88 * o)); g.drawImage(bc, 0, 0);
      g.globalAlpha = 1;
      if (!blocks.length && !flashes.length) return;
      sized(x); sg.globalCompositeOperation = 'copy'; sg.drawImage(x.canvas, 0, 0);
      const tintA = 'rgb(255,36,28)', tintB = `rgb(${BONE})`;
      for (const b of blocks) {
        b.age += dt;
        const e = b.age < 0.12 ? 1 : Math.exp(-3 * (b.age - 0.12) / b.settle);   // hold the tear a beat, then settle
        // choppy settle: the shown offset only catches up now and then, in 4 px steps
        if (Math.random() < 1 - Math.exp(-dt * 11)) { b.shx = Math.round(b.sox * e / 4) * 4; b.shy = Math.round(b.soy * e / 4) * 4; }
        const ox = b.shx, oy = b.shy, dx = b.sx + ox, dy = b.sy + oy;
        if (b.img) {                               // a frozen fragment, fading as it settles
          g.globalAlpha = Math.min(1, e * 1.6); g.drawImage(b.img, dx, dy, b.img.width / b.imgS, b.img.height / b.imgS); g.globalAlpha = 1; continue;
        }
        if (!ox && !oy) continue;
        if (b.smear) {                              // stretch the trailing edge across the gap
          if (ox) { const ex = ox > 0 ? b.sx : b.sx + b.w - 2; g.drawImage(snap, ex * S, b.sy * S, 2 * S, b.h * S, ox > 0 ? b.sx : dx + b.w, b.sy, Math.abs(ox), b.h); }
          if (oy) { const ey = oy > 0 ? b.sy : b.sy + b.h - 2; g.drawImage(snap, b.sx * S, ey * S, b.w * S, 2 * S, b.sx, oy > 0 ? b.sy : dy + b.h, b.w, Math.abs(oy)); }
        }
        g.drawImage(snap, b.sx * S, b.sy * S, b.w * S, b.h * S, dx, dy, b.w, b.h);
        // the seam: a thin bright edge along the side the block slid along, like a torn scanline
        if (b.h > 5 && b.w > 5) {
          g.globalAlpha = 0.55 * Math.min(1, e * 1.5) * (0.4 + 0.6 * b.power); g.fillStyle = b.power > 0.6 ? tintB : tintA;
          if (ox) { g.fillRect(dx, dy, b.w, 1); g.fillRect(dx, dy + b.h - 1, b.w, 1); } else { g.fillRect(dx, dy, 1, b.h); g.fillRect(dx + b.w - 1, dy, 1, b.h); }
          g.globalAlpha = 1;
        }
        const s = Math.round(b.split * (0.4 + 0.6 * e));
        if (s >= 2 && b.age < 0.15 + b.settle * 0.8) {   // (only while the tear is fresh: the split is the costly part)                               // colour split: a red ghost one way, a bone ghost the other
          const w = Math.min(W, Math.ceil(b.w)), h = Math.min(H, Math.ceil(b.h));
          for (const [tint, off, al] of [[tintA, s, 0.85], [tintB, -s, 0.3]]) {
            tg.globalCompositeOperation = 'copy'; tg.drawImage(snap, b.sx * S, b.sy * S, w * S, h * S, 0, 0, w * S, h * S);
            tg.globalCompositeOperation = 'multiply'; tg.fillStyle = tint; tg.fillRect(0, 0, w * S, h * S);
            g.globalCompositeOperation = 'lighter'; g.globalAlpha = al * Math.min(1, e * 2);
            g.drawImage(tmp, 0, 0, w * S, h * S, dx + off, dy, w, h);
          }
          g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        }
      }
      blocks = blocks.filter((b) => b.age < 0.12 + b.settle * 1.6);
      // big chords: an inverted band, drawn once; the shared fade lets it die away over a few frames
      // (drawing it every frame would invert it back and strobe)
      for (const f of flashes) {
        g.globalCompositeOperation = 'difference'; g.fillStyle = `rgb(${BONE})`; g.fillRect(0, f.y, W, f.h);
        g.globalCompositeOperation = 'source-over';
      }
      flashes = [];
    },
  });
})();
