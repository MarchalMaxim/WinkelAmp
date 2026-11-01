// Moiré: two to four fields of fine stripes / rings / spokes laid over each other. Their angles, spacings and
// centres follow the harmony: consonant chords line them up into broad calm bands, dissonant or dense ones pull
// them apart into busy shimmer, and every attack knocks a field off its rest (a visual chord stab) before it
// springs back. Stripes are a tiny tile drawn as a transformed pattern; rings are one even-odd path per field.
(() => {
  const W = 1280, H = 720, T = 64;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const [buf, bg] = mk(W, H), [lay, lg] = mk(W, H), [msk, mg] = mk(W, H), [tile, tg] = mk(4, T);
  // roughness by interval class (0 unison/octave .. 6 tritone): seconds and tritones grind, fifths and fourths rest
  const ROUGH = [0, 1, 0.6, 0.22, 0.18, 0.08, 0.85];
  const ic = (a, b) => { const k = Math.abs(a - b) % 12; return Math.min(k, 12 - k); };
  const R = (a, b) => a + Math.random() * (b - a);
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  // colour pairs, cold → hot: [main, partner, third]
  const COLD = [[60, 110, 205], [195, 210, 235], [120, 70, 190]];
  const HOT = [[190, 20, 16], [238, 196, 140], [120, 40, 16]];
  const SGN = [0, 1, -1, 2];
  let F = [], voices = [48, 72, 60, 55], time = 0, env = 0, rough = 0, roughT = 0, flash = 0;
  const anchor = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2 };

  const field = (i) => ({ i, ang: SGN[i] * 4, av: 0, ox: 0, oy: 0, vx: 0, vy: 0, sc: 1, sv: 0, ph: R(0, 1), dir: i % 2 ? 1 : -1 });
  // underdamped spring: overshoots a little, so a stab wobbles before it settles
  const spring = (pos, vel, tgt, dt, k) => { const c = 2 * Math.sqrt(k) * 0.45; vel += (k * (tgt - pos) - c * vel) * dt; return [pos + vel * dt, vel]; };

  function kindOf(form, i) {
    if (form === 0) return 'lines';
    if (form === 1) return i % 2 ? 'rings' : 'lines';
    if (form === 2) return 'rings';
    return i % 2 ? 'rings' : 'spokes';
  }
  function roughness(ms) {
    const pcs = [...new Set(ms.map((m) => m % 12))];
    if (pcs.length < 2) return 0;
    let s = 0, n = 0, mx = 0;
    for (let a = 0; a < pcs.length; a++) for (let b = a + 1; b < pcs.length; b++) { const r = ROUGH[ic(pcs[a], pcs[b])]; s += r; n++; mx = Math.max(mx, r); }
    return Math.min(1, 0.55 * s / n + 0.45 * mx + 0.04 * Math.max(0, pcs.length - 3));
  }

  function drawField(f, kind, col, sp, duty) {
    const cx = anchor.x + f.ox, cy = anchor.y + f.oy;
    lg.globalCompositeOperation = 'source-over'; lg.fillStyle = '#000'; lg.fillRect(0, 0, W, H);
    lg.fillStyle = `rgb(${col})`;
    if (kind === 'lines') {
      tg.fillStyle = '#000'; tg.fillRect(0, 0, 4, T); tg.fillStyle = `rgb(${col})`; tg.fillRect(0, 0, 4, duty * T);
      const pat = lg.createPattern(tile, 'repeat');
      pat.setTransform(new DOMMatrix().translateSelf(cx, cy).rotateSelf(f.ang).scaleSelf(sp / T).translateSelf(0, f.ph * T));
      lg.fillStyle = pat; lg.fillRect(0, 0, W, H);
    } else if (kind === 'rings') {
      const far = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + sp;
      const ph = ((f.ph % 1) + 1) % 1;
      lg.beginPath();
      for (let r = ph * sp; r < far; r += sp) {
        lg.moveTo(cx + r, cy); lg.arc(cx, cy, r, 0, 6.2832);
        const r2 = r + duty * sp; lg.moveTo(cx + r2, cy); lg.arc(cx, cy, r2, 0, 6.2832);
      }
      lg.fill('evenodd');
    } else {
      const n = Math.max(24, Math.round(6.2832 * 260 / sp)), step = 6.2832 / n, L = 2000;
      const a0 = f.ang * Math.PI / 180 + f.ph * step;
      lg.beginPath();
      for (let k = 0; k < n; k++) {
        const a = a0 + k * step, b = a + duty * step;
        lg.moveTo(cx, cy); lg.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); lg.lineTo(cx + Math.cos(b) * L, cy + Math.sin(b) * L);
      }
      lg.fill();
    }
  }

  TOOLS.push({
    id: 'moire', name: 'Moiré', tag: 'new',
    blurb: 'Fine stripes, rings and spokes laid over each other. Consonant chords line them up into broad calm bands; dissonant, crowded ones pull them apart into busy shimmer. Every attack knocks a field askew and it springs back.',
    params: [
      { key: 'spacing', label: 'line spacing', min: 3, max: 28, step: 0.5, value: 8, drive: '+bass' },
      { key: 'fields', label: 'fields', min: 2, max: 4, step: 1, value: 2 },
      { key: 'form', label: 'lines/rings/spokes', min: 0, max: 3, step: 1, value: 2 },
      { key: 'weight', label: 'line weight', min: 0.1, max: 0.7, value: 0.5 },
      { key: 'turn', label: 'turn per semitone', min: 0, max: 6, value: 1.5 },
      { key: 'tension', label: 'dissonance spread', min: 0, max: 1, value: 0.5, drive: '+density' },
      { key: 'drift', label: 'centre drift', min: 0, max: 1, value: 0.3, drive: '+rate' },
      { key: 'jolt', label: 'attack jolt', min: 0, max: 2, value: 1 },
      { key: 'heat', label: 'cold / hot', min: 0, max: 1, value: 0.7, drive: '+level' },
      { key: 'blend', label: 'add / xor / and', min: 0, max: 2, step: 1, value: 2 },
    ],
    reset() { F = [0, 1, 2, 3].map(field); time = 0; env = 0; rough = 0; roughT = 0; flash = 0; voices = [48, 72, 60, 55]; },
    onChord(ch, x) {
      const ms = ch.notes.map((n) => n.m).sort((a, b) => a - b);
      // harmony of the moment: this chord plus whatever else started in the last 0.6 s (old pedal notes don't count)
      roughT = roughness(x.sounding().filter((n) => n.start > x.t - 0.6).map((n) => n.m).concat(ms));
      const nf = Math.round(x.p('fields')), J = x.p('jolt') * Math.pow(ch.vel / 110, 2), sp = x.p('spacing');
      let hit;
      if (ms.length >= 2) {
        // a chord re-voices every field: bass, top, then inner voices
        voices[0] = ms[0]; voices[1] = ms[ms.length - 1]; voices[2] = ms[Math.floor(ms.length / 2)]; voices[3] = ms[Math.min(1, ms.length - 1)];
        hit = F.slice(0, nf);
      } else {
        // a single note moves only the field whose voice is nearest
        let best = 0; for (let i = 1; i < nf; i++) if (Math.abs(voices[i] - ms[0]) < Math.abs(voices[best] - ms[0])) best = i;
        voices[best] = ms[0]; hit = [F[best]];
      }
      for (const f of hit) {
        f.av += (f.i % 2 ? 1 : -1) * R(0.5, 1) * J * 160;
        f.ph += J * R(0.15, 0.5) * f.dir;
        f.vx += R(-1, 1) * J * sp * 40; f.vy += R(-1, 1) * J * sp * 40;
        f.sv += R(-1, 1) * J * 0.9;
      }
      // the big ones: everything inverts at once and flashes
      if ((ch.vel >= 86 && ch.notes.length >= 3) || (ch.vel >= 98 && ch.notes.length >= 2)) { for (const f of F) { f.ph += 0.5; f.av += R(-1, 1) * J * 260; } flash = 1; }
      env = Math.max(env, Math.min(1.2, ch.vel / 105));
      anchor.tx = W * (0.22 + 0.56 * x.pitch01(ch.hi)); anchor.ty = H * (0.62 - 0.24 * x.pitch01(ch.lo));
    },
    frame(x) {
      const g = x.g, dt = x.dt; time += dt;
      env *= Math.pow(0.5, dt / 1.1); flash *= Math.pow(0.5, dt / 0.09);
      rough += (roughT - rough) * (1 - Math.pow(0.5, dt / 0.12));
      const nf = Math.round(x.p('fields')), form = Math.round(x.p('form')), sp0 = x.p('spacing'), duty = x.p('weight');
      const turn = x.p('turn'), ten = x.p('tension'), drift = x.p('drift'), heat = x.p('heat'), blend = Math.round(x.p('blend'));

      // the shared centre glides toward the melody, and wanders as much as "drift" lets it
      const wx = (Math.sin(time * 0.31) + 0.6 * Math.sin(time * 0.83 + 1.7)) * drift * W * 0.22;
      const wy = (Math.sin(time * 0.27 + 0.4) + 0.6 * Math.sin(time * 0.71 + 3.1)) * drift * H * 0.22;
      const k = 1 - Math.pow(0.5, dt / 0.35);
      anchor.x += (anchor.tx + wx - anchor.x) * k; anchor.y += (anchor.ty + wy - anchor.y) * k;

      const bass = voices[0];
      for (let i = 0; i < nf; i++) {
        const f = F[i];
        // r^1.6: triads stay near zero (broad calm bands), clusters and tritones shoot up (busy shimmer)
        const r = Math.pow(i === 0 ? rough : 0.5 * ROUGH[ic(voices[i], bass)] + 0.5 * rough, 1.6);
        // angle: the whole set turns with the bass; each field leans away from it by how much its voice grinds
        const tgtA = (bass - 48) * turn + SGN[i] * (0.7 + ten * r * 34) + drift * 6 * Math.sin(time * 0.4 + i * 2.1);
        [f.ang, f.av] = spring(f.ang, f.av, tgtA, dt, 38);
        // centre: rings slide off-centre with roughness (concentric = calm, offset = busy)
        const dist = i === 0 ? 0 : sp0 * (1.4 + ten * r * 18), dirA = i * 2.4 + voices[i] * turn * 0.07;
        [f.ox, f.vx] = spring(f.ox, f.vx, Math.cos(dirA) * dist, dt, 22);
        [f.oy, f.vy] = spring(f.oy, f.vy, Math.sin(dirA) * dist, dt, 22);
        // spacing: dissonant fields drift off the common pitch of the grating
        [f.sc, f.sv] = spring(f.sc, f.sv, 1 + (i === 0 ? 0 : (i % 2 ? 1 : -1) * ten * r * 0.18), dt, 30);
        f.ph += dt * (0.04 + 0.5 * x.feat.rate) * f.dir;
      }

      // render the fields white-on-black into one buffer, combined by the blend rule (the moiré lives here)
      const op = ['lighter', 'difference', 'multiply'][blend];
      bg.globalCompositeOperation = 'source-over'; bg.globalAlpha = 1; bg.fillStyle = '#000'; bg.fillRect(0, 0, W, H);
      for (let i = 0; i < nf; i++) {
        const f = F[i];
        drawField(f, kindOf(form, i), '255,255,255', Math.max(2, sp0 * f.sc), duty);
        bg.globalCompositeOperation = i === 0 ? 'source-over' : op;
        bg.globalAlpha = blend === 0 ? (i === 0 ? 0.55 : 0.45) : 1;
        bg.drawImage(lay, 0, 0);
      }
      bg.globalAlpha = 1;
      // a screen made of the same pattern: under the aperture, the canvas (our old trails, and any tool drawn
      // before us) only shows through the bright lines; the dark bands cut it away. Keeps the bands black.
      const rad = H * (0.42 + 0.7 * Math.min(1, env));
      mg.globalCompositeOperation = 'source-over'; mg.drawImage(buf, 0, 0);
      mg.globalCompositeOperation = 'lighter'; mg.fillStyle = 'rgb(34,34,34)'; mg.fillRect(0, 0, W, H);
      const mr = mg.createRadialGradient(anchor.x, anchor.y, 0, anchor.x, anchor.y, rad);
      mr.addColorStop(0, '#000'); mr.addColorStop(0.7, '#000'); mr.addColorStop(1, '#fff');
      mg.globalCompositeOperation = 'screen'; mg.fillStyle = mr; mg.fillRect(0, 0, W, H);
      // colour it: a hot core fading through the partner colour to black: an aperture that opens with loudness
      const [c0, c1, c2] = [0, 1, 2].map((j) => mix(COLD[j], HOT[j], heat));
      const gr = bg.createRadialGradient(anchor.x, anchor.y, 0, anchor.x, anchor.y, rad);
      gr.addColorStop(0, `rgb(${c1})`); gr.addColorStop(0.35, `rgb(${c0})`); gr.addColorStop(0.75, `rgb(${c2})`); gr.addColorStop(1, '#000');
      bg.globalCompositeOperation = 'multiply'; bg.fillStyle = gr; bg.fillRect(0, 0, W, H);

      g.globalCompositeOperation = 'multiply'; g.drawImage(msk, 0, 0);
      g.globalCompositeOperation = 'lighten';   // max, not add: what's left under the lines can't pile up
      g.globalAlpha = Math.min(1, 0.45 + 0.55 * Math.min(1, env) + 0.3 * flash);
      g.drawImage(buf, 0, 0);
      if (flash > 0.05) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = flash * 0.35; g.drawImage(buf, 0, 0); }
    },
  });
})();
