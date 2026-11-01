// Albers: after Josef Albers' Homage to the Square. The whole canvas is the outermost colour, and three flat squares sit
// inside it in his exact format: centred left to right, low in the frame (per step 1 unit at the sides, ½ below, 1½
// above). The harmony picks the colours. A leaky pitch-class histogram finds the chord (the best major or minor triad,
// with the bass favoured); its root, placed on the circle of fifths, sets the hue family, so related chords sit close
// in colour and a move to the dominant swings the palette across the wheel. The ground is the root, the squares inward
// the fifth, the third and the top note heard when the chord arrived. A major chord glows inward (the inner squares get
// lighter), a minor one sinks (they get darker). Only a real change of chord re-tints, and it travels slowly from the
// heart outward. Every attack lifts the value of the square at its register a touch; a loud attack pushes the nesting
// off its rest position on that frame (bass down, treble up, a move sharpward right, flatward left) and it eases back.
// It paints its own canvas (opaque), so it hides the widgets drawn before it.
(() => {
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const wrap6 = (f) => ((((f + 6) % 12) + 12) % 12) - 6;        // a distance on the circle of fifths, -6..5
  const fifths = (pc) => (pc * 7) % 12;                            // pitch class → place on the circle of fifths

  // ---- OKLCH → sRGB (flat colours, perceptually even steps)
  function oklch(L, C, h) {
    const a = C * Math.cos(h * D2R), b = C * Math.sin(h * D2R);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    return lin.map((c) => { c = clamp(c); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)); });
  }
  const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  // Hue of a chord: its root on the circle of fifths, so neighbouring chords sit close in colour (major or minor only
  // changes the value ramp). Turned so the Prelude's C# is a burnt orange (its dominant G# ochre, its F# red, its A
  // violet); Beethoven's C lands on slate teal (G blue, F green).
  const hueOf = (root) => (fifths(root) * 30 + 205) % 360;

  // ---- the triads, scored against the histogram
  const TRIADS = [];
  for (let r = 0; r < 12; r++) for (const minor of [true, false]) TRIADS.push({ r, minor, t: (r + (minor ? 3 : 4)) % 12, f: (r + 7) % 12 });
  function score(c, tr, bassPc) {
    let tot = 0; for (let i = 0; i < 12; i++) tot += c[i];
    const s = c[tr.r] * 1.0 + c[tr.t] * 0.9 + c[tr.f] * 0.8;
    return s - 0.35 * (tot - c[tr.r] - c[tr.t] - c[tr.f]) + (bassPc === tr.r ? 0.25 * c[tr.r] : 0);
  }

  const MAXN = 5;
  let chroma, chord, chordScore, top, lv, off, pulse, lastPush, lastRoot, prevBassPc;
  function reset() {
    chroma = new Array(12).fill(0);
    chord = null; chordScore = 0; top = null; lastPush = -9; lastRoot = null; prevBassPc = null;
    off = { x: 0, y: 0 };
    pulse = new Array(MAXN).fill(0);
    // a quiet slate palette before the first chord
    lv = Array.from({ length: MAXN }, (_, i) => ({ L: 0.34 + 0.05 * i, C: 0.02, h: 250, tgt: null, at: 0 }));
  }
  reset();

  // What the palette should be for the current chord, at n levels (0 = the ground). Called only on a change of chord
  // (or when the knobs it reads have moved since: the targets are refreshed each frame from the chord itself).
  function targets(n, spread, light) {
    const { r, minor } = chord, h0 = hueOf(r);
    const third = minor ? -3 : 4, mel = top == null ? third : wrap6(fifths((top - r + 12) % 12));
    // fifths away from the root, ground to heart
    const order = n === 2 ? [0, mel] : n === 3 ? [0, third, mel] : n === 4 ? [0, 1, third, mel] : [0, 1, third, minor ? -2 : 2, mel];
    const Lb = lerp(0.3, 0.8, light), C = 0.075 + 0.08 * chord.focus;
    return order.map((f, i) => {
      const k = n > 1 ? i / (n - 1) : 0;
      const L = Lb + (minor ? 0.15 - 0.3 * k : -0.15 + 0.3 * k);
      return { L: clamp(L, 0.12, 0.93), C: C * (i === 0 ? 0.85 : 1) * (1 - 0.35 * Math.abs(L - 0.55)), h: (h0 + clamp(f, -4, 4) * 24 * spread + 360) % 360 };
    });
  }

  // ---- icons: little Homages on the 40×26 knob canvas
  function nest(g, w, h, cols, n = cols.length, dx = 0, dy = 0, lastA = 1) {
    g.fillStyle = cols[0]; g.fillRect(1, 1, w - 2, h - 2);
    const u = (h - 2) / 10, cx = w / 2, top0 = 1;
    for (let i = 1; i < Math.ceil(n); i++) {
      const s = (10 - 2 * i) * u, x0 = cx - s / 2 + dx * i, y0 = top0 + 1.5 * i * u + dy * i;
      g.globalAlpha = i === Math.ceil(n) - 1 && n % 1 ? n % 1 : lastA; g.fillStyle = cols[i]; g.fillRect(x0, y0, s, s); g.globalAlpha = 1;
    }
  }
  const pal = (spread, light, n = 4, minor = true) => {
    const save = chord, saveTop = top;
    chord = { r: 1, minor, focus: 0.8 }; top = 8;
    const t = targets(n, spread, light).map((c) => css(oklch(c.L, c.C, c.h)));
    chord = save; top = saveTop; return t;
  };
  const ICONS = {
    tint(g, v, w, h) {                                // orange to teal: a hard step (left) or a long slow blend (right)
      const A = oklch(0.62, 0.13, 55), B = oklch(0.55, 0.09, 200), n = 12, sw = (w - 4) / n, width = 0.04 + v * 0.96;
      for (let i = 0; i < n; i++) {
        const t = clamp(((i + 0.5) / n - 0.5) / width + 0.5);
        g.fillStyle = css(A.map((a, j) => Math.round(lerp(a, B[j], t)))); g.fillRect(2 + i * sw, 4, Math.ceil(sw), h - 8);
      }
    },
    shift(g, v, w, h) { nest(g, w, h, pal(0.4, 0.45), 4, v * 2.2, v * 1.1); },
    squares(g, v, w, h) { nest(g, w, h, pal(0.4, 0.45, 5), 2 + v * 3); },
    colour(g, v, w, h) { nest(g, w, h, pal(v * 1.2, 0.45)); },
    light(g, v, w, h) { nest(g, w, h, pal(0.4, v)); },
  };

  TOOLS.push({
    id: 'albers', name: 'Albers', tag: 'new',
    blurb: 'After Josef Albers\' Homage to the Square: flat squares of colour nested low in the frame. The chord picks the colours (its root on the circle of fifths sets the family; the ground is the root, the squares the fifth, the third and the top note; major glows inward, minor sinks). A change of chord slowly re-tints them from the heart outward; a loud attack pushes the nesting off-centre and it settles back. It paints its own canvas, so it hides the widgets drawn before it.',
    params: [
      { key: 'tint', label: 'how slowly colours change', min: 0.3, max: 8, value: 2.2,
        hint: 'How long a new chord takes to re-colour the squares. Left: they switch almost at once. Right: a slow dissolve over many seconds.',
        icon: ICONS.tint },
      { key: 'shift', label: 'push on loud notes', min: 0, max: 2, value: 1, drive: '+level',
        hint: 'How far a loud note pushes the squares off their place (deep notes down, high notes up). Left: they never move. Right: a strong shove.',
        icon: ICONS.shift },
      { key: 'colour', label: 'one colour or many', min: 0, max: 1.2, value: 0.35, drive: '+density',
        hint: 'How different the squares\' colours are. Left: one colour in light and dark steps. Right: each square its own colour from the chord.',
        icon: ICONS.colour },
      { key: 'squares', label: 'how many squares', min: 2, max: 5, value: 4,
        hint: 'How many colours are nested. Left: a single square on its ground. Right: four squares inside each other.',
        icon: ICONS.squares },
      { key: 'light', label: 'dark or light', min: 0, max: 1, value: 0.42,
        hint: 'The overall value of the colours. Left: deep, dark colours. Right: pale, chalky ones.',
        icon: ICONS.light },
    ],
    reset,
    onChord(ch, x) {
      // the histogram: each note by loudness and length, the bass note counted more
      let bass = ch.notes[0], hi = ch.notes[0];
      for (const n of ch.notes) { if (n.m < bass.m) bass = n; if (n.m > hi.m) hi = n; }
      for (const n of ch.notes) chroma[n.m % 12] += (n.v / 127) * (0.5 + Math.min(1.5, n.d)) * (n === bass ? 1.6 : 1);
      const bassPc = bass.m % 12;
      let best = null, bs = -1e9;
      for (const tr of TRIADS) { const s = score(chroma, tr, bassPc); if (s > bs) { bs = s; best = tr; } }
      let tot = 0; for (const c of chroma) tot += c;
      const curS = chord ? score(chroma, chord, bassPc) : -1e9;
      if (!chord || ((best.r !== chord.r || best.minor !== chord.minor) && bs > curS * 1.12 + 0.05)) {
        const first = !chord;
        lastRoot = chord ? chord.r : best.r;
        chord = { r: best.r, minor: best.minor, t: best.t, f: best.f, focus: clamp(bs / Math.max(0.01, tot)), at: x.t };
        top = hi.m % 12;
        // re-tint from the heart outward: the innermost square starts now, each one further out a little later
        const n = Math.round(x.p('squares')), tint = x.p('tint');
        for (let i = 0; i < MAXN; i++) lv[i].at = Math.max(0, n - 1 - i) * 0.12 * tint;
        // the very first chord after a start or a seek paints the picture at once (nothing to dissolve from)
        if (first) { const T = targets(MAXN, x.p('colour'), x.p('light')), Tn = targets(n, x.p('colour'), x.p('light')); for (let i = 0; i < MAXN; i++) Object.assign(lv[i], i < n ? Tn[i] : T[i], { at: 0 }); }
      } else if (chord) chord.focus = lerp(chord.focus, clamp(bs / Math.max(0.01, tot)), 0.2);
      // every attack: the square at the note's register lifts a little (bass = the ground, treble = the heart)
      const n = Math.round(x.p('squares'));
      for (const nt of ch.notes) {
        const i = Math.round(clamp((nt.m - 36) / 50) * (n - 1));
        pulse[i] = Math.max(pulse[i], Math.min(0.08, 0.025 + 0.035 * nt.v / 127));   // even a soft note shows; a chord never stacks
      }
      // a loud attack pushes the nesting: deep notes down, high ones up; a move sharpward right, flatward left
      const k = clamp((ch.vel - 80) / 32) * x.p('shift');
      if (k > 0.02 && x.t - lastPush > 0.45) {
        lastPush = x.t;
        let mid = 0, wsum = 0; for (const nt of ch.notes) { mid += nt.m * nt.v; wsum += nt.v; } mid /= wsum;
        const dy = lerp(0.42, -1.25, clamp((mid - 38) / 42));
        let dx = 0;
        if (chord && lastRoot != null && chord.at === x.t) dx = Math.sign(wrap6(fifths(chord.r) - fifths(lastRoot))) * 0.7;
        else if (prevBassPc != null && prevBassPc !== bassPc) dx = Math.sign(wrap6(fifths(bassPc) - fifths(prevBassPc))) * 0.45;
        off.x = off.x * 0.3 + dx * k; off.y = off.y * 0.3 + dy * k;
        off.x = clamp(off.x, -0.85, 0.85); off.y = clamp(off.y, -1.35, 0.45);
      }
      prevBassPc = bassPc;
    },
    frame(x) {
      const g = x.g, dt = x.dt, W = x.W, H = x.H;
      const nf = x.p('squares'), n = Math.ceil(nf - 1e-6), tint = x.p('tint');
      // the histogram forgets over about 1.5 s; the palette holds through silence
      const fk = Math.pow(0.5, dt / 1.1); for (let i = 0; i < 12; i++) chroma[i] *= fk;
      const T = chord ? targets(n, x.p('colour'), x.p('light')) : null;
      for (let i = 0; i < n; i++) {
        const c = lv[i];
        if (T) {
          if (c.at > 0) c.at -= dt;
          else {
            const t = T[i], k = 1 - Math.exp(-dt / Math.max(0.05, tint * 0.55));
            let dh = ((t.h - c.h + 540) % 360) - 180;
            c.L += (t.L - c.L) * k; c.C += (t.C - c.C) * k; c.h = (c.h + dh * k + 360) % 360;
          }
        }
        pulse[i] *= Math.pow(0.5, dt / 0.35);
      }
      // the push eases back to Albers' exact place
      const ok = Math.pow(0.5, dt / 0.38); off.x *= ok; off.y *= ok;

      // the ground fills the canvas; the squares follow the Homage format on a virtual square as tall as the canvas
      const u = H / 10, cx = W / 2;
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      const col = (i) => css(oklch(clamp(lv[i].L + pulse[i]), lv[i].C, lv[i].h));
      g.fillStyle = col(0); g.fillRect(0, 0, W, H);
      for (let i = 1; i < n; i++) {
        const s = Math.round((10 - 2 * i) * u);
        const x0 = Math.round(cx - s / 2 + off.x * u * i), y0 = Math.round(1.5 * i * u + off.y * u * i);
        g.globalAlpha = i === n - 1 && nf < n - 1e-6 ? clamp(nf - (n - 1)) : 1;
        g.fillStyle = col(i); g.fillRect(x0, y0, s, s);
      }
      g.globalAlpha = 1;
    },
  });
})();
