// Glitch blocks: a sibling of the casket cuts. Attacks tear rectangles of the picture out of place
// (datamosh-style), and they settle back in choppy steps. Quiet notes nudge one thin slice; big chords
// tear the whole picture into an offset mosaic. A faint base of note bars gives it something to tear alone.
(() => {
  const W = 1280, H = 720;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  const [snap, sg] = mk(), [tmp, tg] = mk(), [bc, bg] = mk();   // bc: the base bars, which linger on their own clock
  let blocks = [], energy = 0, lastT = 0;
  const R = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  // heat 0: steel and bone; heat 1: blood red and bone.
  const COLD = [70, 110, 150], HOT = [165, 14, 18], BONE = [232, 222, 196];
  const pitchY = (x, m) => H * (0.9 - 0.8 * x.pitch01(m));
  // where a note's base bar starts: pitch class around the circle of fifths, nudged by octave
  const barX = (m) => (((m * 7) % 12) / 12) * W * 0.8 + (Math.floor(m / 12) % 3) * W * 0.05;

  function addBlock(x, b) {
    const settle = x.p('settle');
    Object.assign(b, { age: 0, settle, sox: b.ox, soy: b.oy, shx: b.ox, shy: b.oy });
    if (Math.random() < x.p('hold')) {           // freeze: keep the picture as it was at the attack
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(b.w)); c.height = Math.max(1, Math.round(b.h));
      c.getContext('2d').drawImage(x.canvas, b.sx, b.sy, b.w, b.h, 0, 0, b.w, b.h); b.img = c;
    }
    blocks.push(b); if (blocks.length > 100) blocks.shift();
  }

  // One rectangle: aspect from 'shape' (rows <-> columns), position near the note's pitch, motion along its long axis.
  function tear(x, m, power, opts = {}) {
    const B = x.p('block'), shape = x.p('shape');
    let w = B * Math.pow(2, shape * 2.2), h = B * Math.pow(2, -shape * 2.2);
    if (opts.band) { w = W; h = B * R(0.6, 2.2); }
    if (opts.slice) { w = W * R(0.3, 0.95); h = R(3, 12) * (1 + power); }
    // mostly tear where the picture is (this note's bar), sometimes anywhere
    const cx = opts.band || Math.random() < 0.3 ? R(0, W) : barX(m) + R(-0.2, 1) * 220;
    const sx = Math.floor((cx - w / 2) / Math.max(4, w * 0.5)) * Math.max(4, w * 0.5);
    const sy = Math.round((pitchY(x, m) + R(-1, 1) * H * 0.12 * (opts.slice ? 0.2 : 1)) / Math.max(2, h)) * Math.max(2, h);
    const mag = x.p('tear') * (16 + 150 * power) * R(0.4, 1) * (opts.band ? 1.6 : 1);
    const along = w >= h ? 0 : 1, sideways = Math.random() < (Math.abs(shape) < 0.3 ? 0.5 : 0.88) ? along : 1 - along;
    const sgn = Math.random() < 0.5 ? -1 : 1;
    let ox = sideways === 0 ? sgn * mag : 0, oy = sideways === 1 ? sgn * mag * 0.7 : 0;
    // smear: the block slides only part of its own length, so it re-copies itself every frame and streaks
    const smear = Math.random() < x.p('smear');
    if (smear) { ox = Math.sign(ox) * Math.min(Math.abs(ox), w * 0.25) * 0.5; oy = Math.sign(oy) * Math.min(Math.abs(oy), h * 0.25) * 0.5; }
    const split = x.p('split') * (opts.slice ? 0.6 : 1) * (0.5 + power) * (Math.random() < 0.3 + 0.5 * power ? 1 : 0);
    addBlock(x, { sx, sy, w, h, ox: Math.round(ox / 4) * 4, oy: Math.round(oy / 4) * 4, smear, split, power });
  }

  TOOLS.push({
    id: 'blocks', name: 'Glitch blocks', tag: 'new',
    blurb: 'Attacks tear blocks of the picture out of place and they settle back in choppy steps. Quiet notes nudge a thin slice, big chords tear a mosaic. Mix it with squares, ink or the casket.',
    params: [
      { key: 'block', label: 'block size', min: 8, max: 240, step: 1, value: 72, drive: '-rate' },
      { key: 'shape', label: 'columns ↔ rows', min: -1, max: 1, value: 0.6, drive: '-level' },
      { key: 'count', label: 'blocks per chord', min: 0, max: 3, value: 1.2 },
      { key: 'tear', label: 'displacement', min: 0, max: 2, value: 0.8, drive: '+level' },
      { key: 'split', label: 'colour split', min: 0, max: 40, step: 1, value: 8, drive: '+rate' },
      { key: 'smear', label: 'smear', min: 0, max: 1, value: 0.3 },
      { key: 'hold', label: 'freeze', min: 0, max: 1, value: 0.3 },
      { key: 'settle', label: 'settle time (s)', min: 0.1, max: 5, value: 2 },
      { key: 'base', label: 'base bars', min: 0, max: 1, value: 0.7 },
      { key: 'heat', label: 'colour heat', min: 0, max: 1, value: 0.8 },
    ],
    reset(x) { blocks = []; energy = 0; lastT = x.t; bg.clearRect(0, 0, W, H); },
    onChord(ch, x) {
      const n = ch.notes.length, power = Math.max(0, Math.min(1, (ch.vel - 40) / 70)), count = x.p('count');
      // a run of loud attacks counts as big too (the orchestra's tutti arrive as quick small chords, not one fat one)
      energy = energy * Math.pow(0.5, Math.max(0, ch.t - lastT) / 0.4) + (ch.vel >= 85 ? power * Math.sqrt(n) : 0); lastT = ch.t;
      const big = (ch.vel >= 92 && n >= 3) || (ch.vel >= 98 && n >= 2) || ch.vel >= 104 || energy > 2.6;
      if (big && energy > 2.6) energy = 0;
      const pick = () => ch.notes[Math.floor(Math.random() * n)].m;
      if (n === 1 && !big) { if (Math.random() < count) tear(x, ch.lo, power * 0.8, { slice: true }); return; }
      let k = count * power * power * Math.pow(n, 1.1) * 2.4;
      k = Math.floor(k) + (Math.random() < k % 1 ? 1 : 0);
      for (let i = 0; i < k; i++) tear(x, pick(), power);
      if (big) { const nb = 1 + Math.floor(Math.random() * 2 + power); for (let i = 0; i < nb; i++) tear(x, pick(), power, { band: true }); }
    },
    frame(x) {
      const g = x.g, dt = x.dt;
      // base: every sounding note is a bar (y = pitch, x = pitch class, width grows while held). The bars live on
      // their own canvas and linger (longer the higher 'base'), so the blocks always have a picture to tear.
      const base = x.p('base'), heat = x.p('heat');
      bg.globalCompositeOperation = 'destination-out'; bg.globalAlpha = 1 - Math.pow(0.5, dt / (0.25 + base * 2.2));
      bg.fillRect(0, 0, W, H); bg.globalCompositeOperation = 'source-over'; bg.globalAlpha = 1;
      for (const nt of x.sounding()) {
        const p = x.pitch01(nt.m), held = x.t - nt.start, fl = Math.max(0, 1 - held / 0.15);
        const col = lerp(lerp(COLD, HOT, heat).map((c) => c * (0.45 + 0.55 * nt.v / 127)), BONE, Math.pow(p, 3) * 0.6 + fl * 0.45);
        const h = (8 + 40 * nt.v / 127) * (0.45 + 1.5 * (1 - p)), y = pitchY(x, nt.m);
        const x0 = barX(nt.m), w = Math.min(W * 0.75, 90 + held * 240 + 220 * nt.v / 127);
        bg.fillStyle = `rgb(${col})`; bg.fillRect(x0, y - h / 2, w, h);
        if (fl > 0 && base > 0.01) { g.globalAlpha = Math.min(1, fl * (0.4 + base)); g.fillStyle = `rgb(${col})`; g.fillRect(x0, y - h / 2, w, h); }
      }
      // the shared fade takes 12% a frame, so a layer redrawn every frame piles up: solve for the alpha that
      // settles at the opacity we want (base 1 → about 80%), or the slider would be an on/off switch
      const o = base * 0.8;
      if (o > 0.01) { g.globalAlpha = Math.min(1, 0.12 * o / (1 - 0.88 * o)); g.drawImage(bc, 0, 0); }
      g.globalAlpha = 1;
      if (!blocks.length) return;
      sg.globalCompositeOperation = 'copy'; sg.drawImage(x.canvas, 0, 0);
      const tintA = `rgb(${lerp(COLD, [255, 30, 24], heat)})`, tintB = `rgb(${BONE})`;
      for (const b of blocks) {
        b.age += dt;
        const e = b.age < 0.12 ? 1 : Math.exp(-3 * (b.age - 0.12) / b.settle);   // hold the tear a beat, then settle
        // choppy settle: the shown offset only catches up now and then, in 4 px steps
        if (Math.random() < 1 - Math.exp(-dt * 11)) { b.shx = Math.round(b.sox * e / 4) * 4; b.shy = Math.round(b.soy * e / 4) * 4; }
        const ox = b.shx, oy = b.shy, dx = b.sx + ox, dy = b.sy + oy;
        if (b.img) {                               // a frozen fragment, fading as it settles
          g.globalAlpha = Math.min(1, e * 1.6); g.drawImage(b.img, dx, dy); g.globalAlpha = 1; continue;
        }
        if (!ox && !oy) continue;
        if (b.smear) {                              // stretch the trailing edge across the gap
          if (ox) { const ex = ox > 0 ? b.sx : b.sx + b.w - 2; g.drawImage(snap, ex, b.sy, 2, b.h, ox > 0 ? b.sx : dx + b.w, b.sy, Math.abs(ox), b.h); }
          if (oy) { const ey = oy > 0 ? b.sy : b.sy + b.h - 2; g.drawImage(snap, b.sx, ey, b.w, 2, b.sx, oy > 0 ? b.sy : dy + b.h, b.w, Math.abs(oy)); }
        }
        g.drawImage(snap, b.sx, b.sy, b.w, b.h, dx, dy, b.w, b.h);
        const s = Math.round(b.split * (0.4 + 0.6 * e));
        if (s >= 1) {                               // colour split: a red ghost one way, a bone ghost the other
          const w = Math.min(W, Math.ceil(b.w)), h = Math.min(H, Math.ceil(b.h));
          for (const [tint, off, al] of [[tintA, s, 0.85], [tintB, -s, 0.3]]) {
            tg.globalCompositeOperation = 'copy'; tg.drawImage(snap, b.sx, b.sy, w, h, 0, 0, w, h);
            tg.globalCompositeOperation = 'multiply'; tg.fillStyle = tint; tg.fillRect(0, 0, w, h);
            g.globalCompositeOperation = 'lighter'; g.globalAlpha = al * Math.min(1, e * 2);
            g.drawImage(tmp, 0, 0, w, h, dx + off, dy, w, h);
          }
          g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        }
      }
      blocks = blocks.filter((b) => b.age < 0.12 + b.settle * 1.6);
    },
  });
})();
