// Stella: a rhythm partner layer that never paints a ground, after Frank Stella's concentric stripe paintings. Every
// attack adds one thin frame that steps in from the picture's edge, one stripe further in than the last, and older frames
// fade where they are: a fast passage piles up concentric stripes around the border, a slow one leaves one or two lone
// frames. When the stripes reach their depth (or everything has faded) the next frame starts at the edge again. The
// centre always stays open for the widget underneath.
// Loud attacks give square frames, soft ones soft-cornered frames. It draws with 'difference' in a single bone colour, so
// it reads on any ground: dark on score's or Miró's paper, light on black, cyan over red squares.
// It draws AFTER all the other widgets each frame (two microtasks queued from frame(), so it also lands over pixelsort),
// and at the start of the next step it puts back the picture as it was before its stripes (a copy kept at draw time),
// so its own stripes never enter the shared canvas's memory: drawing 'difference' again over last frame's stripe would
// otherwise flicker on every ground that isn't repainted each frame (black, squares, murmuration). The put-back hooks
// ctx.sounding(), which both harnesses (lab/index.html and src/widgets/runtime.ts) call at the top of every step, before
// the shared fade.
// "On the beat" reads a beat grid it works out once from the chords (onset envelope, local tempo by autocorrelation,
// then the usual dynamic-programming beat tracker), and snaps frames to its beats or half beats.
(() => {
  const BONE = 'rgb(238,228,204)';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let latest = { t: 0, dt: 0, k: null }, frames = [], pending = [], queued = false, cursor = 0, lastBorn = -99, prevD = 0;
  let wanted = new Map(), lastFired = -1, lastMode = '';
  // the put-back: a copy of the picture as it was before the stripes, restored at the top of the next step
  let under = null, ug = null, dirty = false, hooked = null;
  function hook(x) {
    if (hooked === x || typeof x.sounding !== 'function') return;
    hooked = x; const orig = x.sounding;
    x.sounding = function (...a) { if (dirty) { dirty = false; putBack(x); } return orig.apply(this, a); };
  }
  function putBack(x) {
    if (!under) return;
    const g = x.g; g.save();
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'copy'; g.globalAlpha = 1; g.filter = 'none'; g.shadowBlur = 0;
    g.drawImage(under, 0, 0, x.W, x.H); g.restore();   // under is the real size: drawn over 1280×720 units
  }
  function keep(x) {
    if (!under || under.width !== x.canvas.width || under.height !== x.canvas.height) {
      under = document.createElement('canvas'); under.width = x.canvas.width; under.height = x.canvas.height; ug = under.getContext('2d');
    }
    ug.globalCompositeOperation = 'copy'; ug.drawImage(x.canvas, 0, 0);
  }

  // Loudness relative to this recording (its 93rd-percentile note velocity), as pixelsort.
  let VQ = 0;
  const loud = (v) => {
    if (!VQ) { const v2 = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b); VQ = v2.length ? Math.max(70, v2[Math.floor(v2.length * 0.93)]) : 100; }
    return clamp((v * 100 / VQ - 45) / 58, 0, 1);
  };

  // The beat it hears, worked out once per song from the chords: an onset envelope at 50 per second (louder, fuller and
  // lower attacks weigh more), the local beat length every second by autocorrelation (favouring ~0.55 s), then the
  // beats as the best chain through the onsets that keeps close to that length. Half beats sit between the beats.
  let gridFor = null, GRID = { beats: [], halves: [] };
  function grid() {
    const C = typeof CHORDS !== 'undefined' ? CHORDS : null;
    if (C === gridFor) return GRID;
    gridFor = C; GRID = { beats: [], halves: [] };
    if (!C || C.length < 8) return GRID;
    const FPS = 50, N = Math.ceil((C[C.length - 1].t + 2) * FPS), o = new Float32Array(N), s = new Float32Array(N);
    for (const ch of C) { const i = Math.round(ch.t * FPS); if (i >= 0 && i < N) o[i] += (ch.vel / 127) * (1 + 0.2 * Math.min(5, ch.notes.length - 1)) * (ch.lo < 52 ? 1.3 : 1); }
    let mean = 0; for (let i = 0; i < N; i++) { s[i] = 0.5 * o[i] + 0.25 * ((o[i - 1] || 0) + (o[i + 1] || 0)); mean += s[i]; }
    mean /= N; let sd = 0; for (let i = 0; i < N; i++) sd += (s[i] - mean) ** 2; sd = Math.sqrt(sd / N) || 1;
    for (let i = 0; i < N; i++) s[i] /= sd;
    const secs = Math.ceil(N / FPS), per = new Float32Array(secs), P0 = 0.55 * FPS, Lmin = Math.round(0.28 * FPS), Lmax = Math.round(1.4 * FPS), HW = 4 * FPS;
    let prev = P0;
    for (let k = 0; k < secs; k++) {
      const c = k * FPS + (FPS >> 1), a0 = Math.max(0, c - HW), a1 = Math.min(N, c + HW);
      let e = 0; for (let i = a0; i < a1; i++) e += s[i];
      if (e < 2) { per[k] = prev; continue; }
      let best = -1, bl = prev;
      for (let L = Lmin; L <= Lmax; L++) {
        let ac = 0; for (let i = a0; i + L < a1; i++) ac += s[i] * s[i + L];
        const sc = (ac / Math.max(1, a1 - a0 - L)) * Math.exp(-0.5 * (Math.log2(L / P0) / 0.9) ** 2);
        if (sc > best) { best = sc; bl = L; }
      }
      per[k] = prev = bl;
    }
    const sm = Float32Array.from(per, (_, k) => { const w = []; for (let j = k - 2; j <= k + 2; j++) if (j >= 0 && j < secs) w.push(per[j]); w.sort((a, b) => a - b); return w[w.length >> 1]; });
    const cs = new Float32Array(N), bk = new Int32Array(N).fill(-1);
    for (let t = 0; t < N; t++) {
      const tau = sm[Math.min(secs - 1, (t / FPS) | 0)], p1 = t - Math.round(tau / 2);
      let best = -Infinity, bp = -1;
      for (let p = Math.max(0, t - Math.round(2 * tau)); p <= p1; p++) { const v = cs[p] - 100 * Math.log((t - p) / tau) ** 2; if (v > best) { best = v; bp = p; } }
      cs[t] = s[t] + (bp >= 0 ? best : 0); bk[t] = bp;
    }
    let end = N - 1; const tauE = sm[secs - 1];
    for (let t = Math.max(0, N - 1 - Math.round(2 * tauE)); t < N; t++) if (cs[t] > cs[end]) end = t;
    const beats = []; for (let t = end; t >= 0; t = bk[t]) beats.push(t / FPS);
    beats.reverse();
    // no beats in long silences: keep those with an attack within 2 s
    let j = 0; const kept = beats.filter((b) => { while (j < C.length && C[j].t < b - 2) j++; return j < C.length && C[j].t <= b + 2; });
    const halves = []; for (let i = 0; i < kept.length; i++) { halves.push(kept[i]); if (i + 1 < kept.length && kept[i + 1] - kept[i] < 2) halves.push((kept[i] + kept[i + 1]) / 2); }
    GRID = { beats: kept, halves };
    return GRID;
  }
  const nearest = (arr, t) => { let a = 0, b = arr.length - 1; if (b < 0) return -1; while (a < b) { const m = (a + b) >> 1; if (arr[m] < t) a = m + 1; else b = m; } return a > 0 && t - arr[a - 1] < arr[a] - t ? a - 1 : a; };

  // One new frame, one stripe further in than the last.
  function born(x, vel, k, now, tNow) {
    const pw = loud(vel), H = x.H;
    const th = clamp(k.thick * (0.75 + 0.5 * pw), 1, 26), gap = Math.max(3, th * 0.8);
    const maxIn = 16 + k.reach * (H * 0.25 - 16);                       // right: halfway from the edge to the centre
    const alive = frames.some((f) => f.age < f.life * 0.85);
    if (!alive || now - lastBorn > k.life) cursor = 4;
    if (cursor + th > maxIn) cursor = 4;
    const d = cursor, from = alive && d > 4 ? prevD : Math.max(0, d - th - gap);
    cursor += th + gap; prevD = d; lastBorn = now;
    // a frame landing on an older one takes its place (two stripes over each other would cancel out)
    for (const f of frames) if (f.d < d + th + 1 && f.d + f.th > d - 1) f.life = Math.min(f.life, f.age + 0.06);
    frames.push({ d, from, th, age: Math.max(0, tNow - now), fresh: true, life: k.life * (0.8 + 0.4 * pw), a0: 0.72 + 0.28 * pw, round: pw < 0.55 });
    while (frames.length > 60) frames.shift();
  }

  function post(x) {
    queued = false;
    const t = latest.t, dt = latest.dt, k = latest.k; latest.dt = 0;
    if (!k) return;
    try {
      const which = k.which < 0.34 ? 'bass' : k.which > 0.66 ? 'top' : 'all';
      const mode = k.beat <= 0.03 ? 'free' : k.beat < 0.34 ? 'thin' : k.beat < 0.67 ? 'half' : 'beat';
      if (mode !== lastMode) { lastMode = mode; wanted.clear(); lastFired = -1; }
      const G = mode === 'free' ? null : grid(), ticks = G ? (mode === 'beat' ? G.beats : G.halves) : null;
      for (const a of pending) {
        if ((which === 'bass' && !a.bass) || (which === 'top' && !a.top)) continue;
        if (!ticks || ticks.length < 2) { born(x, a.vel, k, a.t, t); continue; }
        const i = nearest(ticks, a.t);
        if (mode === 'thin') {                                       // off-beat attacks drop out as the knob turns
          const unit = i + 1 < ticks.length ? ticks[i + 1] - ticks[i] : ticks[i] - ticks[i - 1];
          if (Math.abs(a.t - ticks[i]) / unit <= 0.5 - 1.35 * k.beat) born(x, a.vel, k, a.t, t);
          continue;
        }
        if (i <= lastFired) continue;                                // this beat already has its frame
        if (ticks[i] <= t) { lastFired = i; wanted.delete(i); born(x, a.vel, k, t, t); }   // just after the beat: now
        else wanted.set(i, Math.max(wanted.get(i) || 0, a.vel));                        // just before it: on the beat
      }
      pending = [];
      if (wanted.size) for (const [i, vel] of [...wanted].sort((p, q) => p[0] - q[0])) {
        if (ticks && ticks[i] <= t) { wanted.delete(i); if (i > lastFired) { lastFired = i; born(x, vel, k, ticks[i], t); } }
      }
      if (!frames.length) return;
      keep(x);                                                       // the picture without stripes, put back next step
      const g = x.g, W = x.W, H = x.H;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'difference'; g.filter = 'none'; g.shadowBlur = 0;
      g.strokeStyle = BONE;
      for (const f of frames) {
        if (f.fresh) f.fresh = false; else f.age += dt;   // born this step: already as old as its attack
        const u = f.age / f.life; if (u >= 1) continue;
        const e = Math.min(1, f.age / 0.08), dd = f.from + (f.d - f.from) * (1 - (1 - e) ** 3);   // it steps in from the last one
        const a = f.a0 * Math.pow(1 - u, 1.4) * (f.age < 0.05 ? 1.25 : 1);
        const q = dd + f.th / 2, w = W - 2 * q, h = H - 2 * q;
        if (w <= 0 || h <= 0) continue;
        g.globalAlpha = clamp(a, 0, 1); g.lineWidth = f.th;
        g.beginPath();
        if (f.round && g.roundRect) { g.lineJoin = 'round'; g.roundRect(q, q, w, h, Math.max(6, 34 - dd * 0.12)); }
        else { g.lineJoin = 'miter'; g.rect(q, q, w, h); }
        g.stroke();
      }
      g.restore();
      frames = frames.filter((f) => f.age < f.life);
      dirty = true;
    } catch (e) { console.warn('stella', e); }
  }

  // knob pictures
  const IB = '#ece2c8';
  const nest = (g, w, h, insets, col, lw = 1.2, alphas) => insets.forEach((d, i) => ICON.alpha(g, alphas ? alphas[i] : 1, () => {
    g.strokeStyle = col; g.lineWidth = lw; g.strokeRect(2 + d, 2 + d, w - 4 - 2 * d, h - 4 - 2 * d);
  }));

  TOOLS.push({
    id: 'stella', name: 'Stella', tag: 'new',
    blurb: 'A rhythm layer made to sit on other widgets: it paints no ground, only thin frames, after Frank Stella’s stripe paintings. Every attack adds one frame a step further in from the edge and older ones fade, so fast playing piles up concentric stripes and slow playing leaves one or two lone frames; loud attacks give square frames, soft ones rounded. The centre stays open, and it inverts whatever is under it (dark on paper, light on black, cyan over red). Try it on score with squares, horizon with murmuration, current with squares, or Miró with Rorschach.',
    params: [
      { key: 'life', label: 'how long they stay', min: 0.15, max: 5, value: 1.4, less: 0.5,
        hint: 'How long a frame stays before it fades. Left: one blink. Right: lingering stripes that pile up.',
        icon: (g, v, w, h) => { const L = 0.15 + v * 0.85; nest(g, w, h, [0, 3, 6, 9], IB, 1.3, [0, 1, 2, 3].map((i) => Math.max(0, 1 - i / (L * 4)))); } },
      { key: 'thick', label: 'how thick', min: 1, max: 14, value: 3.5, drive: '+level',
        hint: 'How wide each stripe is (loud attacks a little wider). Left: hairlines. Right: heavy bands.',
        icon: (g, v, w, h) => { const lw = 0.8 + v * 4.5; g.strokeStyle = IB; g.lineWidth = lw; g.strokeRect(3 + lw / 2, 3 + lw / 2, w - 6 - lw, h - 6 - lw); } },
      { key: 'reach', label: 'how far in', min: 0, max: 1, value: 0.45, less: 0.08,
        hint: 'How deep the stripes pile up before starting again at the edge. Left: they hug the edge. Right: they reach halfway to the centre.',
        icon: (g, v, w, h) => { const n = 1 + Math.round(v * 3); nest(g, w, h, Array.from({ length: n }, (_, i) => i * 2.6), IB, 1.1); } },
      { key: 'which', label: 'which notes count', min: 0, max: 1, value: 0.5,
        hint: 'Which attacks add a frame. Left: only the bass, so it marks the left hand’s pulse. Middle: every attack. Right: only the top line, the melody.',
        icon: (g, v, w, h) => (v < 0.34 ? ICON.keys(g, w, h, 0, 0.35, ICON.red) : v > 0.66 ? ICON.keys(g, w, h, 0.65, 1, ICON.red) : ICON.keys(g, w, h, 0, 1, ICON.red)) },
      { key: 'beat', label: 'on the beat', min: 0, max: 1, value: 0,
        hint: 'When frames come. Left: on every attack. Right: snapped to the beat it hears, so only the metre shows.',
        icon: (g, v, w, h) => {
          const irr = [0.04, 0.17, 0.23, 0.41, 0.52, 0.58, 0.79, 0.93];
          ICON.line(g, 2, h - 5, w - 2, h - 5, ICON.dim, 1);
          irr.forEach((p, i) => { const grid = (Math.floor(i / 2) + 0.5) / 4, f = p + (grid - p) * v, x0 = 3 + f * (w - 6);
            ICON.line(g, x0, 4, x0, h - 6, IB, 1.5); });
        } },
      { key: 'howmuch', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How many frames you see: how long each stays and how deep the stripes pile up before restarting at the edge. Left: a lone frame at the edge that soon fades. Right: lingering concentric stripes reaching in. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { latest = { t: 0, dt: 0, k: null }; frames = []; pending = []; queued = false; cursor = 4; lastBorn = -99; prevD = 0; wanted.clear(); lastFired = -1; lastMode = ''; dirty = false; },
    onChord(ch, x) {
      let lo = ch.lo, hi = ch.hi;
      try { for (const n of x.sounding()) { if (n.m < lo) lo = n.m; if (n.m > hi) hi = n.m; } } catch {}
      pending.push({ t: ch.t, vel: ch.vel, bass: ch.lo < 52 || (ch.lo < 57 && ch.lo <= lo), top: ch.hi >= 62 && ch.hi >= hi });
      if (pending.length > 24) pending.shift();
    },
    frame(x) {
      hook(x);
      // knobs are read here (they only resolve while the harness is running this widget), then used after the others drew;
      // two hops so it also draws after pixelsort, whatever their order
      // (several steps before one post, as in the studio's paused preview, add up their time)
      latest.k = { life: x.p('life'), thick: x.p('thick'), reach: x.p('reach'), which: x.p('which'), beat: x.p('beat') }; latest.t = x.t; latest.dt += x.dt;
      if (!queued) { queued = true; queueMicrotask(() => queueMicrotask(() => post(x))); }
    },
  });
})();
