// Crimp: fuzzy to sharp. Each note lays a ribbon of razor-thin bone lines at its pitch's height, dead straight on the attack,
// then each line goes slack into its own fine wave and the ribbon is a brick-red woolly strip that dims in steps. The same key
// again yanks its strip straight in place. Stateless from CHORDS; strips are baked once.
(() => {
const SNAP = KIT.SNAP;

  const BONE = SNAP.BONE, HOT = [214, 58, 40], BRICK = [200, 60, 40];
  const LW = 1.5, AMPS = [0.75, 1.5, 2.5, 3.5, 5, 6.5], TONES = [1, 0.75, 0.56, 0.42, 0.32];
  const STRAIGHT = 0.066, CAP = 16, SW = 2560, SH = 20, BUDGET = 0.06 * 1280 * 720;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, k) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * k);
  const hash = (m, i, k) => { let s = (m * 374761393 + i * 668265263 + k * 1442695041) | 0;
    s = Math.imul(s ^ (s >>> 13), 1274126177); s ^= s >>> 16; return (s >>> 0) / 4294967296; };   // 0..1, pitch-seeded
  // A mark dim or hot is drawn lighten at alpha 1 in its real colour (the canvas fade and burn would eat a dim alpha mark).
  const tone = (g, rgb, k = 1) => {
    g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
  };

  let STRIPS = null;   // STRIPS[seed][amplitude][tone]: opaque-on-black wave strips, baked once, never animated
  const bake = () => {
    if (STRIPS) return;
    const mk = () => { const c = document.createElement('canvas'); c.width = SW; c.height = SH; return c; };
    const PS = [[41, 67], [53, 89], [71, 113]], AW = [97, 131, 157], T2 = 2 * Math.PI;
    const strips = [];
    for (let s = 0; s < 3; s++) {
      const wave = new Float32Array(SW);
      let ph = 1.3 * s;
      for (let px = 0; px < SW; px++) {
        const lam = 11.5 + 2.5 * (0.6 * Math.sin(T2 * px / PS[s][0] + s) + 0.4 * Math.sin(T2 * px / PS[s][1] + 2 * s + 1));
        ph += T2 / lam;
        wave[px] = (0.85 + 0.15 * Math.sin(T2 * px / AW[s] + 2 * s)) * Math.sin(ph);
      }
      const byAmp = [];
      for (let a = 0; a < AMPS.length; a++) {
        const byTone = [];
        for (let n = 0; n < TONES.length; n++) {
          const c = mk(), g = c.getContext('2d');
          g.fillStyle = '#000'; g.fillRect(0, 0, SW, SH);
          g.lineWidth = LW; g.lineJoin = 'round';
          g.strokeStyle = `rgb(${BRICK.map((v) => Math.round(v * TONES[n])).join(',')})`;
          g.beginPath();
          for (let px = 0; px < SW; px++) { const y = 10.75 + AMPS[a] * wave[px]; if (px) g.lineTo(px, y); else g.moveTo(px, y); }
          g.stroke();
          byTone.push(c);
        }
        byAmp.push(byTone);
      }
      strips.push(byAmp);
    }
    STRIPS = strips;
  };

  // Which chord is sounding at song time t: the last one at or before it (binary search; nothing remembered between frames).
  const chordAt = (cs, t) => {
    let lo = 0, hi = cs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at;
  };
  // The clip's own p10 and p90 of note velocity, cached per CHORDS array.
  let vCs = null, vN = -1, vLo = 0, vHi = 0, vOk = false;
  const velRange = (cs) => {
    if (cs === vCs && cs.length === vN) return;
    const vs = [];
    for (const ch of cs) for (const n of ch.notes) vs.push(n.v);
    vs.sort((a, b) => a - b);
    vCs = cs; vN = cs.length;
    if (vs.length < 2) { vOk = false; return; }
    vLo = vs[Math.floor(0.1 * (vs.length - 1))]; vHi = vs[Math.floor(0.9 * (vs.length - 1))];
    vOk = vHi - vLo >= 4;
  };

  TOOLS.push({
    id: 'crimp', name: 'Crimp', tag: 'new',
    blurb: "Each note lays a ribbon of razor-thin lines at its pitch's height, dead straight at the attack; within half a second the lines go slack into a fine wave, out of step, and the ribbon turns into a brick-red woolly strip. Louder notes reach further. The same key again yanks its strip straight in place.",
    params: [
      { key: 'slack', label: 'how fuzzy it goes', min: 1, max: 6.5, value: 5,
        hint: 'How wavy the lines go once struck. Left: they stay almost straight. Right: they go to wool.',
        icon: (g, v, w, h) => {
          g.strokeStyle = ICON.red; g.lineWidth = 1;
          for (let k = 0; k < 3; k++) {
            const y0 = h / 2 - 7 + 7 * k; g.beginPath();
            for (let px = 3; px <= w - 3; px++) { const y = y0 + (0.5 + 3.5 * v) * Math.sin(px * 1.3 + k * 1.9); if (px === 3) g.moveTo(px, y); else g.lineTo(px, y); }
            g.stroke();
          }
        } },
      { key: 'reach', label: 'how long a strip is', min: 0.3, max: 1.4, value: 1, less: 0.3,
        hint: "How far a note's lines reach; louder notes reach further. Left: short dashes. Right: right across the screen.",
        icon: (g, v, w, h) => {
          const L = 6 + v * (w - 10);
          [[-5, -2], [0, 2], [5, 0]].forEach(([dy, sh]) => ICON.line(g, w / 2 - L / 2 + sh, h / 2 + dy, w / 2 + L / 2 + sh, h / 2 + dy, ICON.gold, 1.5));
        } },
      { key: 'fibres', label: 'lines in a strip', min: 3, max: 21, step: 1, value: 15, less: 3,
        hint: 'How many lines a note lays down. Left: a few clean lines. Right: a dense pelt.',
        icon: (g, v, w, h) => ICON.lines(g, 3 + Math.round(v * 7), w, h, { dir: 'h', col: ICON.red, lw: 1 }) },
      { key: 'stays', label: 'how long it stays', min: 0.4, max: 3, value: 1.2, less: 0.4,
        hint: 'How long the wool lies there after a note. Left: gone at once. Right: wool lies around for seconds.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much each note leaves: how long its strip is, how many lines, how long the wool stays. Left: a few short lines, soon gone. Right: long, dense strips that linger. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { bake(); },
    onChord() {},   // stateless: frame finds the chords itself
    frame(x) {
      if (!STRIPS) bake();
      const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];
      const i0 = chordAt(cs, x.t); if (i0 < 0) return;
      const stays = x.p('stays'), D = stays - 0.25, slack = x.p('slack'), reach = x.p('reach');
      const f = clamp(Math.round(x.p('fibres')), 3, 21), picks = !!x.picked;
      velRange(cs);
      // Newest attack of each pitch, at most CAP pitches, newest first.
      const found = new Map();
      for (let j = i0; j >= 0 && cs[j].t > x.t - stays && found.size < CAP; j--) {
        for (const n of cs[j].notes) if (!found.has(n.m) && found.size < CAP) found.set(n.m, { m: n.m, v: n.v, born: cs[j].t });
      }
      const wool = [], strike = [];
      for (const r of found.values()) {
        const t = x.t - r.born; if (t < 0 || t >= D) continue;
        let u = vOk ? clamp((r.v - vLo) / (vHi - vLo), 0, 1) : 1;
        if (picks) u = Math.max(u, 0.35);
        r.u = u; r.t = t;
        r.L = Math.min(1200, reach * (300 + 780 * u));
        r.cx = 340 + 600 * (r.m - 21) / 87;
        r.yc = 660 - 600 * (r.m - 21) / 87;
        (t < STRAIGHT ? strike : wool).push(r);
      }
      const lines = (r, q) => {
        const out = [];
        for (let i = 0; i < f; i++) {
          const y = Math.round(r.yc - 2 * (f - 1) + 4 * i);
          const xl = Math.round(r.cx - q * r.L / 2 + Math.round(60 * hash(r.m, i, 3) - 30));
          const xr = Math.round(r.cx + q * r.L / 2 + Math.round(60 * hash(r.m, i, 4) - 30));
          out.push({ i, y, xl, w: xr - xl });
        }
        return out;
      };
      const g = x.g;
      g.save();
      g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
      for (const r of wool) {
        const A = slack * (1 - Math.exp(-(r.t) / 0.18));
        let j = 0; for (let k = 0; k < AMPS.length; k++) if (AMPS[k] <= A / 0.9) j = k;
        const q = 1 - 0.09 * Math.min(1, AMPS[j] / slack);
        const n = Math.min(4, Math.floor(5 * (r.t - STRAIGHT) / (D - STRAIGHT)));
        for (const l of lines(r, q)) {
          if (l.w < 1) continue;
          const sx = Math.floor(hash(r.m, l.i, 2) * (SW - 1300));
          g.drawImage(STRIPS[l.i % 3][j][n], sx, 0, l.w, SH, l.xl, l.y - 10, l.w, SH);
        }
      }
      strike.sort((a, b) => (b.born - a.born) || (b.u - a.u));
      let spent = 0;
      for (const r of strike) {
        const ls = lines(r, 1);
        const area = ls.reduce((s, l) => s + l.w, 0) * 1.5;
        let top = mix(HOT, BONE, 0.35 + 0.65 * r.u);
        if (spent > 0 && spent + area > BUDGET) top = HOT; else spent += area;
        const c = mix(BRICK, top, SNAP.flash(r.t));
        tone(g, c);
        g.beginPath();
        for (const l of ls) g.rect(l.xl, l.y, l.w, LW);
        g.fill();
      }
      g.restore();
    },
  });
})();
