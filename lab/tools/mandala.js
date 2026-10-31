// Mandala (new, 2026-10-31): a radial bloom around the centre of the screen. Every note adds a shape on a ring whose
// radius is its pitch (low notes near the middle, high notes at the rim) and whose angle is its pitch class (all the C's
// lie on one spoke, all the G's on another). Each chord is copied round the circle and mirrored: the more notes in the
// chord, the more copies (a lone note: a few spokes; a big chord: lace all the way round). Low notes make arcs that close
// into a ring while held, middle notes make petals that grow outward while held, high notes make beads that string out.
// Every attack flashes thin rings and the new shapes are born white-hot; the whole figure turns slowly (faster when the
// music is busy) and breathes with loudness. Notes that clash with what is sounding (semitones, tritones) grow torn,
// spiky edges and a colder colour.
(() => {
  const TAU = Math.PI * 2;
  let els = [], flashes = [], rot = 0, breath = 0.75, core = 0;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  // colour by radius: deep red core → vermilion → gold → cream → pale blue at the rim; clashing notes lean violet
  const STOPS = [[0, [128, 16, 30]], [0.28, [200, 56, 36]], [0.52, [228, 148, 54]], [0.76, [240, 214, 156]], [1, [190, 210, 238]]];
  const COLD = [138, 96, 220];
  function tone(f) {
    let i = 1; while (i < STOPS.length - 1 && STOPS[i][0] < f) i++;
    const [fa, a] = STOPS[i - 1], [fb, b] = STOPS[i], k = clamp01((f - fa) / (fb - fa));
    return [0, 1, 2].map((j) => a[j] + (b[j] - a[j]) * k);
  }
  const mix = (a, b, k) => [0, 1, 2].map((j) => a[j] + (b[j] - a[j]) * k);
  // how rough an interval (in semitones, mod 12) sounds: semitone/major 7th, tritone, whole tone; consonances ~0
  const ROUGH = [0, 1, 0.3, 0.05, 0.03, 0, 0.6, 0, 0.03, 0.05, 0.3, 1];
  const radiusOf = (m) => 0.1 + 0.88 * clamp01((m - 28) / 72);   // fraction of the full radius

  // A shape's outline as polar points [radius, angle offset]; drawn once per copy round the circle.
  function outline(e, s, jagK, R) {
    const r = e.f * R, held = Math.min(e.age, e.d), pop = 1 - Math.pow(1 - Math.min(1, e.age / 0.14), 3);
    const sector = TAU / e.n, amp = jagK * e.diss, pts = [];
    if (e.kind === 'petal') {
      const L = (0.055 + 0.06 * e.v / 127) * R * pop * (1 + 0.5 * Math.min(held, 3));
      const W = Math.min(r * sector * 0.3, (4 + e.v * 0.07) * s), rb = Math.max(4, r - 0.25 * L), rt = r + L;
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
      const T = (3 + e.v * 0.06) * s * (0.6 + 0.4 * pop), hs = (sector / 2) * (0.22 + 0.66 * clamp01(held / 2.5)) * pop;
      const N = 7;
      for (let i = 0; i <= N; i++) pts.push([r - T / 2, -hs + (2 * hs * i) / N]);
      for (let i = N; i >= 0; i--) pts.push([r + T / 2 + (amp > 0.02 && i % 2 ? amp * T * 1.6 : 0), -hs + (2 * hs * i) / N]);
    }
    return pts;
  }
  // beads: [radius, size] for the high notes, stringing outward while held
  function beads(e, s, R) {
    const r = e.f * R, held = Math.min(e.age, e.d), pop = Math.min(1, e.age / 0.1);
    const b = (1.6 + e.v * 0.025) * s * pop, n = 1 + Math.min(4, Math.floor(held * 2.2)), out = [];
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
    id: 'mandala', name: 'Mandala', tag: 'new',
    blurb: 'A radial bloom. Each note lands on a ring set by its pitch, at an angle set by its note name, copied and mirrored round the circle: the fuller the chord, the more copies. Held notes grow, attacks flash rings, it turns with the tempo and breathes with loudness; clashing notes turn spiky.',
    params: [
      { key: 'mirrors', label: 'copies per note', min: 0.5, max: 3, value: 1.5,
        hint: 'How many mirrored copies a chord gets, per note in it. Left: a few spokes. Right: dense lace, a big chord fills the circle.',
        icon: (g, v, w, h) => rosette(g, w, h, Math.round(3 + v * 11), 1, 0, ICON.gold) },
      { key: 'size', label: 'size (breathes)', min: 0.4, max: 1.3, value: 0.72, drive: '+level',
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
    ],
    reset() { els = []; flashes = []; rot = 0; breath = 0.72; core = 0; },
    onChord(ch, x) {
      const k = ch.notes.length, n = Math.max(3, Math.min(16, Math.round((k + 1) * x.p('mirrors'))));
      // pitch classes heard around this attack (recent notes only, so a long pedal doesn't make everything clash)
      const near = new Set(ch.notes.map((nt) => nt.m % 12));
      for (const s of x.sounding()) if (x.t - s.start < 1.2) near.add(s.m % 12);
      for (const nt of ch.notes) {
        const pc = nt.m % 12; let d = 0;   // (below: a velocity floor so whisper-quiet transcribed notes, like the b5 oboe, still show)
        for (const o of near) if (o !== pc) d += ROUGH[(pc - o + 12) % 12];
        els.push({ kind: nt.m < 48 ? 'arc' : nt.m < 76 ? 'petal' : 'bead', a0: (pc * TAU) / 12, f: radiusOf(nt.m), v: Math.max(nt.v, 45),
          d: Math.max(0.2, Math.min(nt.d, 6)), n, diss: clamp01(d * 0.75), age: 0 });
        flashes.push({ f: radiusOf(nt.m), v: nt.v / Math.sqrt(Math.max(1, k / 2)), age: 0 });
      }
      core = Math.max(core, ch.vel / 127);
      if (els.length > 200) els.splice(0, els.length - 200);
      if (flashes.length > 48) flashes.splice(0, flashes.length - 48);
    },
    frame(x) {
      const g = x.g, dt = x.dt, R = x.H * 0.47;
      rot += dt * x.p('spin') * 0.55;
      breath += (x.p('size') - breath) * (1 - Math.exp(-dt / 0.3));
      core *= Math.exp(-dt / 0.5);
      const life = x.p('life'), jagK = x.p('jag'), Rb = R * breath, s = breath / 0.72;
      g.translate(x.W / 2, x.H / 2);
      // the shapes, oldest first so each new chord lies on top
      for (const e of els) {
        e.age += dt;
        const rel = e.age - e.d, a = rel <= 0 ? 1 : Math.pow(Math.max(0, 1 - rel / life), 1.4);
        e.alpha = a; if (a < 0.02) continue;
        const hot = Math.max(0, 1 - e.age / 0.35);
        const c = mix(mix(tone(e.f), COLD, e.diss * jagK * 0.55), [255, 250, 240], hot * 0.75);
        g.fillStyle = `rgba(${c.map(Math.round).join(',')},${(a * (0.72 + 0.28 * hot)).toFixed(3)})`;
        g.beginPath();
        if (e.kind === 'bead') {
          const bs = beads(e, s, Rb);
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
          const pts = outline(e, s, jagK, Rb);
          for (const [th, sg] of angles(e)) {
            for (let i = 0; i < pts.length; i++) { const q = th + pts[i][1] * sg, rad = pts[i][0]; i ? g.lineTo(rad * Math.cos(q), rad * Math.sin(q)) : g.moveTo(rad * Math.cos(q), rad * Math.sin(q)); }
            g.closePath();
          }
        }
        g.fill();
      }
      els = els.filter((e) => e.alpha === undefined || e.alpha >= 0.02 || e.age < e.d);
      // the attack: thin rings flash at each struck note's radius and widen a little
      g.globalCompositeOperation = 'lighter';
      for (const fl of flashes) {
        fl.age += dt; const k = fl.age / 0.5; if (k >= 1) continue;
        const c = mix(tone(fl.f), [255, 250, 240], 0.6);
        g.strokeStyle = `rgba(${c.map(Math.round).join(',')},${(Math.pow(1 - k, 2) * (0.25 + 0.55 * fl.v / 127)).toFixed(3)})`;
        g.lineWidth = (0.8 + 1.6 * fl.v / 127) * (1 - k * 0.5);
        g.beginPath(); g.arc(0, 0, fl.f * Rb * (1 + 0.07 * k), 0, TAU); g.stroke();
      }
      flashes = flashes.filter((fl) => fl.age < 0.5);
      // a small ember at the centre, lit by each attack and by the bass
      const cr = (3 + 7 * x.feat.bass + 6 * core) * s, cc = tone(0.05 + 0.25 * core);
      g.fillStyle = `rgba(${cc.map(Math.round).join(',')},${(0.35 + 0.6 * core).toFixed(3)})`;
      g.beginPath(); g.arc(0, 0, cr, 0, TAU); g.fill();
    },
  });
})();
