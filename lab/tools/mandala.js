// Mandala v2 (2026-10-31): a radial bloom around the centre of the screen. Every note adds a shape on a ring whose
// radius is its pitch (low notes near the middle, high notes at the rim) and whose angle is its pitch class (all the C's
// lie on one spoke, all the G's on another). Each chord is copied round the circle and mirrored: the more notes in the
// chord, the more copies (a lone note: a few spokes; a big chord: lace all the way round). Low notes make arcs that close
// into a ring while held, middle notes make petals that grow outward while held, high notes make beads that string out.
// v2: every attack lands: the new shapes overshoot as they open, white-hot, and thin rays shoot from the centre out to
// them along every copy, while the whole figure gives a small kick (bigger for loud and for bass). A sounding note is
// filled, solid when loud and see-through when soft; once let go its fill drains away and only a fine outline lingers,
// sinking toward crimson and drifting a little outward, so past chords lie as lace behind the notes sounding now.
// A small star at the centre has as many points as the last chord had copies.
// Notes that clash with what is sounding (semitones, tritones) grow torn, spiky edges and a colder colour.
// How present (a sixth knob, the user 2026-11-01: sliders should dim, not only boost): turned down, all the ink is fainter,
// the figure turns, breathes and kicks less, and only the hardest notes of this piece land. At 1 it changes nothing.
(() => {
  const TAU = Math.PI * 2;
  let els = [], flashes = [], rot = 0, breath = 0.86, core = 0, kick = 0, star = 6;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  // colour by radius: deep red core → vermilion → gold → cream → pale blue at the rim; clashing notes lean violet
  const STOPS = [[0, [128, 16, 30]], [0.28, [200, 56, 36]], [0.52, [228, 148, 54]], [0.76, [240, 214, 156]], [1, [190, 210, 238]]];
  const COLD = [150, 104, 232], HOT = [255, 250, 240], EMBER = [176, 36, 52];
  function tone(f) {
    let i = 1; while (i < STOPS.length - 1 && STOPS[i][0] < f) i++;
    const [fa, a] = STOPS[i - 1], [fb, b] = STOPS[i], k = clamp01((f - fa) / (fb - fa));
    return [0, 1, 2].map((j) => a[j] + (b[j] - a[j]) * k);
  }
  const mix = (a, b, k) => [0, 1, 2].map((j) => a[j] + (b[j] - a[j]) * k);
  const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;
  // how rough an interval (in semitones, mod 12) sounds: semitone/major 7th, tritone, whole tone; consonances ~0
  const ROUGH = [0, 1, 0.3, 0.05, 0.03, 0, 0.6, 0, 0.03, 0.05, 0.3, 1];
  const radiusOf = (m) => 0.1 + 0.88 * clamp01((m - 28) / 72);   // fraction of the full radius
  // opening with an overshoot: 0 → ~1.2 → 1 over the first 0.22 s, so every attack visibly lands
  const openOf = (age) => { const t = Math.min(1, age / 0.22) - 1; return 1 + 3.4 * t * t * t + 2.4 * t * t; };
  // loudness → how solid a shape is: soft notes are outlines only, loud ones are filled jewels
  const solidOf = (v) => clamp01((v - 38) / 52);
  // how present (0..1): which notes land, judged against this piece's own notes (recordings differ a lot in how hard they
  // are played): every one at 1, the hardest 88% at 0.5, the hardest 60% at 0.25, the hardest 5% at 0
  let vels = null, sinceHit = 9;
  const hardEnough = (v, cut) => {
    if (cut <= 0) return true;
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!vels.length) return true;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length >= cut;
  };
  // how present → the multiplier on every alpha. A shape is redrawn each frame over a ground that only fades 12% a frame, so
  // alpha piles up (0.11 a frame still settles at half brightness): it must fall with the cube to look evenly dimmed.
  const inkOf = (pres) => (pres < 1 ? 0.06 + 0.94 * pres * pres * pres : 1);

  // A shape's outline as polar points [radius, angle offset]; drawn once per copy round the circle.
  function outline(e, s, jagK, R) {
    const r = e.f * R * e.drift, held = Math.min(e.age, e.d), pop = Math.max(0, openOf(e.age));
    const sector = TAU / e.n, amp = jagK * e.diss, pts = [];
    if (e.kind === 'petal') {
      const L = (0.05 + 0.075 * e.v / 127) * R * pop * (1 + 0.5 * Math.min(held, 3));
      const W = Math.min(r * sector * 0.32, (4 + e.v * 0.08) * s * Math.min(1.15, pop)), rb = Math.max(4, r - 0.25 * L), rt = r + L;
      const N = 6;
      for (let side = 0; side < 2; side++) {
        for (let i = 0; i <= N; i++) {
          const t = side ? 1 - i / N : i / N, k = side ? N - i : i;
          let hw = W * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.8);
          if (amp > 0.02 && k > 0 && k < N) hw = (k + side) % 2 ? hw * (1 + amp * 1.4) : hw * (1 - amp * 0.55);
          const rad = rb + (rt - rb) * t;
          pts.push([rad, (side ? -hw : hw) / rad]);
        }
      }
    } else if (e.kind === 'arc') {
      const T = (3 + e.v * 0.07) * s * (0.5 + 0.5 * pop), hs = (sector / 2) * (0.22 + 0.66 * clamp01(held / 2.5)) * Math.min(1, pop);
      const N = 7;
      for (let i = 0; i <= N; i++) pts.push([r - T / 2, -hs + (2 * hs * i) / N]);
      for (let i = N; i >= 0; i--) pts.push([r + T / 2 + (amp > 0.02 && i % 2 ? amp * T * 1.6 : 0), -hs + (2 * hs * i) / N]);
    }
    return pts;
  }
  // beads: [radius, size] for the high notes, stringing outward while held
  function beads(e, s, R) {
    const r = e.f * R * e.drift, held = Math.min(e.age, e.d), pop = Math.max(0, openOf(e.age));
    const b = (1.6 + e.v * 0.03) * s * pop, n = 1 + Math.min(4, Math.floor(held * 2.2)), out = [];
    for (let i = 0; i < n; i++) out.push([r + i * b * 3.2, b * (1 - i * 0.16)]);
    return out;
  }
  // every copy angle of a shape: n turns round the circle, each mirrored (unless the mirror lands on itself)
  function angles(e) {
    const sector = TAU / e.n, out = [], off = ((e.a0 % sector) + sector) % sector;
    const self = Math.min(off, Math.abs(sector / 2 - off), sector - off) < 0.01;
    for (let j = 0; j < e.n; j++) { out.push([e.a0 + rot + j * sector, 1]); if (!self) out.push([-e.a0 + rot + j * sector, -1]); }
    return out;
  }

  // knob pictures: a little rosette (count petals, scale, spikiness)
  function rosette(g, w, h, count, scale, jag, col) {
    const cx = w / 2, cy = h / 2;
    g.fillStyle = col; g.beginPath();
    for (let j = 0; j < count; j++) {
      const a = (j * TAU) / count - Math.PI / 2, L = 11 * scale, W = Math.min(3.2, 14 / count + 0.6) * scale;
      for (let i = 0; i <= 8; i++) {
        const side = i > 4, t = side ? (8 - i) / 4 : i / 4;
        let hw = W * Math.sin(Math.PI * t); if (jag > 0 && i % 2 && i !== 4) hw *= 1 + jag * 1.6;
        const rad = 1.5 * scale + t * L, x = cx + rad * Math.cos(a) - (side ? -hw : hw) * Math.sin(a), y = cy + rad * Math.sin(a) + (side ? -hw : hw) * Math.cos(a);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    }
    g.fill();
  }

  TOOLS.push({
    id: 'mandala', name: 'Mandala', tag: 'v2',
    blurb: 'A radial bloom: each note lands on a ring set by its pitch, at an angle set by its note name, copied and mirrored round the circle. New in v2: every attack lands with rays from the centre and a kick; sounding notes are filled (solid when loud, see-through when soft), and once let go they linger as fine outline lace behind the live ones. The <b>how present</b> knob tones it right down.',
    params: [
      { key: 'mirrors', label: 'copies per note', min: 0.5, max: 3, value: 1.5,
        hint: 'How many mirrored copies a chord gets, per note in it. Left: a few spokes. Right: dense lace, a big chord fills the circle.',
        icon: (g, v, w, h) => rosette(g, w, h, Math.round(3 + v * 11), 1, 0, ICON.gold) },
      { key: 'size', label: 'size (breathes)', min: 0.4, max: 1.3, value: 0.86, drive: '+level',
        hint: 'How big the mandala is; it follows loudness, so it swells on loud chords. Left: a small jewel. Right: fills the screen.',
        icon: (g, v, w, h) => { rosette(g, w, h, 8, 0.3 + v * 0.75, 0, ICON.gold); ICON.dot(g, w / 2, h / 2, 1 + v * 1.6, ICON.red); } },
      { key: 'spin', label: 'turning speed', min: 0, max: 1, value: 0.2, drive: '+rate',
        hint: 'How fast the whole figure turns; it follows the tempo, so busy passages turn it faster. Left: still. Right: a steady wheel.',
        icon: (g, v, w, h) => {
          rosette(g, w, h, 6, 0.62, 0, ICON.dim);
          if (v < 0.04) return;
          const r = 11.5, a0 = -Math.PI / 2, a1 = a0 + 0.35 + v * 4.2;
          g.strokeStyle = ICON.ink; g.lineWidth = 1.5; g.beginPath(); g.arc(w / 2, h / 2, r, a0, a1); g.stroke();
          const ex = w / 2 + r * Math.cos(a1), ey = h / 2 + r * Math.sin(a1), ta = a1 + Math.PI / 2;
          g.fillStyle = ICON.ink; g.beginPath(); g.moveTo(ex + 3.5 * Math.cos(ta), ey + 3.5 * Math.sin(ta));
          g.lineTo(ex - 3 * Math.cos(ta - 1.2), ey - 3 * Math.sin(ta - 1.2)); g.lineTo(ex - 3 * Math.cos(ta + 1.2), ey - 3 * Math.sin(ta + 1.2)); g.fill();
        } },
      { key: 'life', label: 'how long they stay', min: 0.3, max: 8, value: 3.5, drive: '-rate',
        hint: 'How long a shape stays after its note ends; it follows the tempo, so busy passages clear faster. Left: a flicker, only the live notes. Right: layers pile up into a dense mandala.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.gold, 'diamond') },
      { key: 'jag', label: 'spikes on clashing notes', min: 0, max: 1, value: 0.7,
        hint: 'How torn and spiky a petal gets when its note clashes with the others. Left: always smooth. Right: clashes tear and turn violet.',
        icon: (g, v, w, h) => {
          const col = ICON.lerp('#e0b04a', '#9a6bd0', v), N = 8; g.fillStyle = col; g.beginPath();
          for (let side = 0; side < 2; side++) for (let i = 0; i <= N; i++) {
            const t = side ? 1 - i / N : i / N, k = side ? N - i : i;
            let hw = 6 * Math.sin(Math.PI * t); if (k > 0 && k < N) hw = (k + side) % 2 ? hw * (1 + v * 1.3) : hw * (1 - v * 0.5);
            const x = 4 + t * (w - 8), y = h / 2 + (side ? hw : -hw); (side || i) ? g.lineTo(x, y) : g.moveTo(x, y);
          }
          g.closePath(); g.fill();
        } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'How much it takes over. Left: a faint figure, nearly still, that answers only the hardest notes and the odd soft one. Right: every note blooms at full strength (as before).',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + 0.85 * v, () => rosette(g, w, h, 8, 0.45 + 0.55 * v, 0, ICON.gold)) },
    ],
    reset() { vels = null; sinceHit = 9; els = []; flashes = []; rot = 0; breath = 0.86; core = 0; kick = 0; star = 6; },
    onChord(ch, x) {
      const off = 1 - x.p('presence'), cut = off * off * off * 0.95;
      let hit = ch.notes;
      if (cut > 0) {
        hit = ch.notes.filter((nt) => hardEnough(nt.v, cut));
        // a soft passage can hold nothing hard enough for a minute or more: after a while without a shape (3 s at the far
        // left) the chord's loudest note lands anyway, so the figure still follows the music and never looks switched off
        if (!hit.length && sinceHit > 3 * off) hit = [ch.notes.reduce((a, b) => (b.v > a.v ? b : a))];
        if (!hit.length) return;
      }
      sinceHit = 0;
      const k = hit.length, n = Math.max(3, Math.min(16, Math.round((k + 1) * x.p('mirrors'))));
      // pitch classes heard around this attack (recent notes only, so a long pedal doesn't make everything clash)
      const near = new Set(ch.notes.map((nt) => nt.m % 12));
      for (const s of x.sounding()) if (x.t - s.start < 1.2) near.add(s.m % 12);
      for (const nt of hit) {
        const pc = nt.m % 12; let d = 0;   // (below: a velocity floor so whisper-quiet transcribed notes, like the b5 oboe, still show)
        for (const o of near) if (o !== pc) d += ROUGH[(pc - o + 12) % 12];
        els.push({ kind: nt.m < 48 ? 'arc' : nt.m < 76 ? 'petal' : 'bead', a0: (pc * TAU) / 12, f: radiusOf(nt.m), v: Math.max(nt.v, 40),
          d: Math.max(0.2, Math.min(nt.d, 6)), n, diss: clamp01(d * 0.75), age: 0, drift: 1, alpha: 1, share: 1 / Math.sqrt(Math.max(1, k / 2)) });
        flashes.push({ f: radiusOf(nt.m), v: nt.v / Math.sqrt(Math.max(1, k / 2)), age: 0 });
      }
      // the whole figure kicks on each attack: harder for loud and for low (a bass note shakes the whole mandala)
      const low = clamp01((60 - ch.lo) / 30);
      kick = Math.max(kick, (ch.vel / 127) * (0.025 + 0.05 * low) * Math.min(1.6, 0.8 + k * 0.15));
      core = Math.max(core, ch.vel / 127);
      star = n;
      if (els.length > 180) els.splice(0, els.length - 180);
      if (flashes.length > 48) flashes.splice(0, flashes.length - 48);
    },
    frame(x) {
      const g = x.g, dt = x.dt, R = x.H * 0.47;
      sinceHit += dt;
      const pres = x.p('presence'), ink = inkOf(pres);             // calm: the turning and the swell slow down, the kick shrinks
      rot += dt * x.p('spin') * 0.55 * (pres < 1 ? 0.1 + 0.9 * pres : 1);
      breath += (x.p('size') - breath) * (1 - Math.exp(-dt / (0.3 + 2.2 * (1 - pres))));
      core *= Math.exp(-dt / 0.5);
      kick *= Math.exp(-dt / 0.12);
      const life = x.p('life'), jagK = x.p('jag'), s = breath / 0.86;
      const edge = (b) => (b > 0.95 ? 0.95 + (b - 0.95) * 0.4 : b);   // a fortissimo swells to the screen's edge, not far past it
      const Rb = R * edge(breath * (1 + kick * pres)), Rs = R * edge(breath);
      // only the sounding notes kick: the lingering lace holds still (kicking it too smears it into a radial haze)
      const radOf = (rel) => (rel <= 0 ? Rb : Rs + (Rb - Rs) * Math.exp(-rel / 0.15));
      g.translate(x.W / 2, x.H / 2);
      g.lineJoin = 'round';
      const crowd = Math.min(1, Math.sqrt(60 / Math.max(1, els.length)));   // when a lot is lingering the lace dims, so it never turns to haze
      // the shapes, oldest first so each new chord lies on top
      for (const e of els) {
        e.age += dt;
        const rel = e.age - e.d, a = rel <= 0 ? 1 : Math.pow(Math.max(0, 1 - rel / life), 1.4);
        e.alpha = a; if (a < 0.02) continue;
        e.drift = 1 + 0.09 * (1 - a);                              // let-go shapes drift a little outward as they fade
        const hot = Math.max(0, 1 - e.age / 0.4), solid = solidOf(e.v);
        // live: its own colour; let go: sinks toward a deep ember; just struck: white-hot
        let c = mix(tone(e.f), COLD, clamp01(e.diss * jagK * 1.2) * 0.75);   // clashing: clearly violet, not a muddy in-between
        if (rel > 0) c = mix(c, EMBER, clamp01(rel / life) * 0.4);
        c = mix(c, HOT, hot * 0.8);
        const Re = radOf(rel);
        g.beginPath();
        if (e.kind === 'bead') {
          const bs = beads(e, s, Re);
          for (const [th, sg] of angles(e)) {
            const cs = Math.cos(th), sn = Math.sin(th);
            for (const [rad, b] of bs) {
              const px = rad * cs, py = rad * sn, sp = jagK * e.diss;
              if (sp > 0.15) {                     // a clashing bead becomes a small spiky star
                for (let i = 0; i < 8; i++) { const q = th + (i * TAU) / 8 * sg, rr = i % 2 ? b * (0.7 - sp * 0.3) : b * (1 + sp * 1.4); i ? g.lineTo(px + rr * Math.cos(q), py + rr * Math.sin(q)) : g.moveTo(px + rr * Math.cos(q), py + rr * Math.sin(q)); }
                g.closePath();
              } else { g.moveTo(px + b, py); g.arc(px, py, b, 0, TAU); }
            }
          }
        } else {
          const pts = outline(e, s, jagK, Re);
          for (const [th, sg] of angles(e)) {
            for (let i = 0; i < pts.length; i++) { const q = th + pts[i][1] * sg, rad = pts[i][0]; i ? g.lineTo(rad * Math.cos(q), rad * Math.sin(q)) : g.moveTo(rad * Math.cos(q), rad * Math.sin(q)); }
            g.closePath();
          }
        }
        // while it sounds it is filled: a solid jewel when loud, see-through when soft. Once let go the fill drains away
        // in a moment and only its fine outline lingers, so the past lies as lace behind the notes that sound now.
        // (the shared background only fades 12% a frame, so a fill builds up over frames: a soft one must be very faint to
        // stay see-through, and paler rather than darker so it reads as glass, not brown)
        const fillA = (rel <= 0 ? 1 : Math.exp(-rel / 0.16)) * a * Math.max(0.02 + 0.9 * solid * solid, 0.85 * hot) * ink;
        if (fillA > 0.01) { g.fillStyle = rgba(mix(c, HOT, 0.35 * (1 - solid)), fillA); g.fill(); }
        g.strokeStyle = rgba(mix(c, HOT, 0.25 + 0.3 * solid), a * (rel > 0 ? 0.42 * crowd : 0.5 + 0.4 * hot) * ink);
        g.lineWidth = (0.6 + 1 * solid) * Math.max(0.7, s); g.stroke();
      }
      els = els.filter((e) => e.alpha >= 0.02 || e.age < e.d);
      g.globalCompositeOperation = 'lighter';
      // the attack, part one: rays from the centre out to each newly struck shape, along every copy, gone in a third of a second
      for (const e of els) {
        if (e.age > 0.32) continue;
        const k = e.age / 0.32, r1 = e.f * Rb, r0 = Math.max(4, r1 * (0.12 + 0.75 * k * k));
        const c = mix(tone(e.f), HOT, 0.55);
        g.strokeStyle = rgba(c, Math.pow(1 - k, 1.5) * (0.12 + 0.45 * e.v / 127) * e.share * ink);   // a big chord shares its brightness
        g.lineWidth = (0.6 + 1.4 * e.v / 127) * Math.max(0.7, s);
        g.beginPath();
        for (const [th] of angles(e)) { const cs = Math.cos(th), sn = Math.sin(th); g.moveTo(r0 * cs, r0 * sn); g.lineTo(r1 * cs, r1 * sn); }
        g.stroke();
      }
      // part two: thin rings flash at each struck note's radius and widen a little
      for (const fl of flashes) {
        fl.age += dt; const k = fl.age / 0.5; if (k >= 1) continue;
        g.strokeStyle = rgba(mix(tone(fl.f), HOT, 0.6), Math.pow(1 - k, 2) * (0.25 + 0.6 * fl.v / 127) * ink);
        g.lineWidth = (0.8 + 2 * fl.v / 127) * (1 - k * 0.5);
        g.beginPath(); g.arc(0, 0, fl.f * Rb * (1 + 0.07 * k), 0, TAU); g.stroke();
      }
      flashes = flashes.filter((fl) => fl.age < 0.5);
      g.globalCompositeOperation = 'source-over';
      // the bindu at the centre: a small star with as many points as the last chord had copies, lit by attacks and the bass
      const cr = (4 + 8 * x.feat.bass * pres + 7 * core * pres) * s * (1 + 3 * kick * pres), cc = mix(tone(0.05 + 0.3 * core), HOT, core * 0.4), sp = Math.max(3, star);
      g.fillStyle = rgba(cc, (0.4 + 0.55 * core) * ink);
      g.beginPath();
      for (let i = 0; i < sp * 2; i++) { const q = rot * 1.5 + (i * Math.PI) / sp, rr = i % 2 ? cr * 0.45 : cr; i ? g.lineTo(rr * Math.cos(q), rr * Math.sin(q)) : g.moveTo(rr * Math.cos(q), rr * Math.sin(q)); }
      g.closePath(); g.fill();
    },
  });
})();
