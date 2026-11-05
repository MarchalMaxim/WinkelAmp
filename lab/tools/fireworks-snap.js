// Fireworks-snap: Fireworks, sharpened for single notes (docs/mockups/snap/DESIGN.md, C14). On picked notes no attack is dropped:
// one that lands inside the quiet gap still goes off, at half power. Each burst gets a bone-coloured heart disc for two steps,
// drawn over the fluid so the eye can count the notes, and the sparks start at full brightness and fall fast: they are seen for 0.6 as
// long (the wakes they drag through the smoke last as before). Ages are measured from the chord's own time, so seeking and rendering agree. (Fireworks, below, is the unchanged original.)
// Fireworks: every attack goes off over the picture, and the burst stirs the air. A real fluid (stable fluids on the graphics card,
// its own WebGL2 canvas, as the app's old Living Canvas did): the blast is a ring of pushes, which the fluid can only answer by
// rolling up into vortices, so the smoke curls outward in petals and the next burst tears through what the last one left.
// On top of that, plain sparks fly and fall, and the fastest of them drag their own wake through the smoke.
// Where it goes off comes from the music: left to right by pitch, higher and bigger the harder it is played. The colour is set by
// hand: one hue, and how far the bursts may wander from it by pitch, so a given note keeps its colour.
// Without WebGL2 and float targets there is no smoke, only the sparks.
(() => {
  const SIM_W = 192, SIM_H = 108, DYE_W = 800, DYE_H = 450, OUT_W = 960, OUT_H = 540, JACOBI = 20, TAU = Math.PI * 2;
  const VERT = `#version 300 es
in vec2 p; out vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
  const FRAG = (body) => `#version 300 es
precision highp float; in vec2 uv; out vec4 o; ${body}`;
  const SRC = {
    splat: FRAG(`uniform vec2 at; uniform float r; uniform vec3 c; uniform float aspect;
      void main() { vec2 d = uv - at; d.y /= aspect; o = vec4(c * exp(-dot(d, d) / r), 0.0); }`),
    advect: FRAG(`uniform sampler2D v, q; uniform vec2 tx; uniform float dt, keep;
      void main() { o = keep * texture(q, uv - dt * texture(v, uv).xy * tx); }`),
    curl: FRAG(`uniform sampler2D v; uniform vec2 tx;
      void main() { float l = texture(v, uv - vec2(tx.x, 0)).y, r = texture(v, uv + vec2(tx.x, 0)).y, b = texture(v, uv - vec2(0, tx.y)).x, t = texture(v, uv + vec2(0, tx.y)).x;
        o = vec4(0.5 * (r - l - t + b), 0, 0, 1); }`),
    vort: FRAG(`uniform sampler2D v, w; uniform vec2 tx; uniform float k, dt;
      void main() { float l = abs(texture(w, uv - vec2(tx.x, 0)).x), r = abs(texture(w, uv + vec2(tx.x, 0)).x), b = abs(texture(w, uv - vec2(0, tx.y)).x), t = abs(texture(w, uv + vec2(0, tx.y)).x), c = texture(w, uv).x;
        vec2 f = 0.5 * vec2(t - b, r - l); f /= length(f) + 1e-4; f *= k * c; f.y *= -1.0;
        o = vec4(texture(v, uv).xy + f * dt, 0, 1); }`),
    div: FRAG(`uniform sampler2D v; uniform vec2 tx;
      void main() { float l = texture(v, uv - vec2(tx.x, 0)).x, r = texture(v, uv + vec2(tx.x, 0)).x, b = texture(v, uv - vec2(0, tx.y)).y, t = texture(v, uv + vec2(0, tx.y)).y;
        o = vec4(0.5 * (r - l + t - b), 0, 0, 1); }`),
    press: FRAG(`uniform sampler2D q, d; uniform vec2 tx;
      void main() { float l = texture(q, uv - vec2(tx.x, 0)).x, r = texture(q, uv + vec2(tx.x, 0)).x, b = texture(q, uv - vec2(0, tx.y)).x, t = texture(q, uv + vec2(0, tx.y)).x;
        o = vec4(0.25 * (l + r + b + t - texture(d, uv).x), 0, 0, 1); }`),
    grad: FRAG(`uniform sampler2D q, v; uniform vec2 tx;
      void main() { float l = texture(q, uv - vec2(tx.x, 0)).x, r = texture(q, uv + vec2(tx.x, 0)).x, b = texture(q, uv - vec2(0, tx.y)).x, t = texture(q, uv + vec2(0, tx.y)).x;
        o = vec4(texture(v, uv).xy - 0.5 * vec2(r - l, t - b), 0, 1); }`),
    fade: FRAG(`uniform sampler2D q; uniform float keep; void main() { o = keep * texture(q, uv); }`),
    show: FRAG(`uniform sampler2D q;
      void main() { vec3 c = 1.0 - exp(-max(texture(q, uv).rgb, 0.0) * 1.5); o = vec4(c, max(c.r, max(c.g, c.b))); }`),
  };

  let F = null, broken = false;    // the fluid, once made (never for a template that is only asked for its knobs)
  function makeFluid() {
    const cv = document.createElement('canvas'); cv.width = OUT_W; cv.height = OUT_H;
    const gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;
    // A browser only keeps so many contexts: one taken from a widget that is still playing is made again.
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); F = null; });
    const prog = (src) => {
      const p = gl.createProgram();
      for (const [type, text] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, src]]) {
        const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`fireworks shader: ${gl.getShaderInfoLog(s)}`);
        gl.attachShader(p, s);
      }
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
      return { p, u };
    };
    const P = Object.fromEntries(Object.entries(SRC).map(([k, s]) => [k, prog(s)]));
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const target = (w, h) => {
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fb, w, h };
    };
    const pair = (w, h) => { const d = { a: target(w, h), b: target(w, h), swap() { const t = d.a; d.a = d.b; d.b = t; } }; return d; };
    const made = { cv, gl, P, vel: pair(SIM_W, SIM_H), dye: pair(DYE_W, DYE_H), press: pair(SIM_W, SIM_H), div: target(SIM_W, SIM_H), curl: target(SIM_W, SIM_H) };
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE ? made : null;
  }
  const bindTex = (gl, unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.uniform1i(loc, unit); };
  const into = (gl, t) => { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null); gl.viewport(0, 0, t ? t.w : OUT_W, t ? t.h : OUT_H); };
  const quad = (gl) => gl.drawArrays(gl.TRIANGLES, 0, 3);

  /** Adds a soft blob into a field. x, y in picture px; r in picture px. Only its own patch is touched. */
  function splat(field, x, y, r, c) {
    const { gl, P } = F, S = P.splat, t = field.a, u = x / 1280, v = 1 - y / 720, ru = r / 1280, reach = 3.2 * ru;
    gl.useProgram(S.p); into(gl, t);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.enable(gl.SCISSOR_TEST);
    const px = Math.floor((u - reach) * t.w), py = Math.floor((v - reach * 16 / 9) * t.h), pw = Math.ceil(2 * reach * t.w) + 2, ph = Math.ceil(2 * reach * 16 / 9 * t.h) + 2;
    gl.scissor(px, py, pw, ph);
    // Distances in picture widths: the shader's aspect scales y, so a blob is round on screen.
    gl.uniform2f(S.u.at, u, v); gl.uniform1f(S.u.r, ru * ru); gl.uniform1f(S.u.aspect, 16 / 9);
    gl.uniform3f(S.u.c, c[0], c[1], c[2]);
    quad(gl);
    gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
  }

  function step(dt, swirl, linger) {
    const { gl, P, vel, dye, press, div, curl } = F, tx = [1 / SIM_W, 1 / SIM_H];
    const run = (S, target, set) => { gl.useProgram(S.p); into(gl, target); set(S.u); quad(gl); };
    run(P.curl, curl, (u) => { gl.uniform2f(u.tx, tx[0], tx[1]); bindTex(gl, 0, vel.a, u.v); });
    run(P.vort, vel.b, (u) => { gl.uniform2f(u.tx, tx[0], tx[1]); gl.uniform1f(u.k, 8 + 26 * swirl); gl.uniform1f(u.dt, dt); bindTex(gl, 0, vel.a, u.v); bindTex(gl, 1, curl, u.w); }); vel.swap();
    run(P.div, div, (u) => { gl.uniform2f(u.tx, tx[0], tx[1]); bindTex(gl, 0, vel.a, u.v); });
    run(P.fade, press.b, (u) => { gl.uniform1f(u.keep, 0.8); bindTex(gl, 0, press.a, u.q); }); press.swap();
    gl.useProgram(P.press.p); gl.uniform2f(P.press.u.tx, tx[0], tx[1]);
    bindTex(gl, 1, div, P.press.u.d);
    for (let i = 0; i < JACOBI; i++) { into(gl, press.b); bindTex(gl, 0, press.a, P.press.u.q); quad(gl); press.swap(); }
    run(P.grad, vel.b, (u) => { gl.uniform2f(u.tx, tx[0], tx[1]); bindTex(gl, 0, press.a, u.q); bindTex(gl, 1, vel.a, u.v); }); vel.swap();
    run(P.advect, vel.b, (u) => { gl.uniform2f(u.tx, tx[0], tx[1]); gl.uniform1f(u.dt, dt); gl.uniform1f(u.keep, Math.exp(-dt * 0.9)); bindTex(gl, 0, vel.a, u.v); bindTex(gl, 1, vel.a, u.q); }); vel.swap();
    run(P.advect, dye.b, (u) => { gl.uniform2f(u.tx, tx[0], tx[1]); gl.uniform1f(u.dt, dt); gl.uniform1f(u.keep, Math.exp(-dt / (0.25 + 1.8 * linger))); bindTex(gl, 0, vel.a, u.v); bindTex(gl, 1, dye.a, u.q); }); dye.swap();
  }
  function clearFluid() {
    if (!F) return;
    const { gl } = F; gl.clearColor(0, 0, 0, 0);
    for (const t of [F.vel.a, F.vel.b, F.dye.a, F.dye.b, F.press.a, F.press.b, F.div, F.curl]) { into(gl, t); gl.clear(gl.COLOR_BUFFER_BIT); }
  }

  const hsv = (h, s, v) => {
    h = ((h % 1) + 1) % 1; const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  };
  const css = (c, a) => `rgba(${c.map((v) => Math.round(v * 255)).join(',')},${a})`;

  let hearts = [], sparks = [], pend = [], lastBurst = -9, clock = 0, vels = null, pitches = null;
  // Where a pitch lies among this piece's own, so a piece in a narrow range still fills the sky.
  const pitchRank = (m) => {
    if (!pitches) pitches = (window.NOTES || []).map((n) => n[2]).sort((a, b) => a - b);
    if (!pitches.length) return 0.5;
    let a = 0, b = pitches.length; while (a < b) { const k = (a + b) >> 1; if (pitches[k] < m) a = k + 1; else b = k; }
    return a / pitches.length;
  };
  const rank = (v) => {
    if (!vels) vels = (window.NOTES || []).map((n) => n[3]).sort((a, b) => a - b);
    if (!vels.length) return 0.5;
    let a = 0, b = vels.length; while (a < b) { const k = (a + b) >> 1; if (vels[k] < v) a = k + 1; else b = k; }
    return a / vels.length;
  };

  // One burst: the ring of pushes and the colour they carry go into the fluid in the attack's own frame, and the sparks fly from it.
  function burst(cx, cy, power, col, x, born) {
    const size = x.p('size'), swirl = x.p('swirl'), R = (26 + 60 * power) * size;
    const n = Math.round(7 + 5 * power), a0 = x.rnd(0, TAU), force = (40 + 190 * power) * (0.2 + 1.6 * swirl);
    if (F) {
      for (let i = 0; i < n; i++) {
        const a = a0 + (i + x.rnd(-0.25, 0.25)) / n * TAU, c = Math.cos(a), s = Math.sin(a), px = cx + c * R * 0.5, py = cy + s * R * 0.5, k = x.rnd(0.7, 1.2);
        splat(F.vel, px, py, R * 0.42, [c * force * k, -s * force * k, 0]);
        const d = 0.03 + 0.08 * power;
        splat(F.dye, px, py, R * 0.3, [col[0] * d, col[1] * d, col[2] * d]);
      }
      const w = 0.25 + 0.6 * power;
      splat(F.dye, cx, cy, R * 0.2, [w * (0.5 + 0.5 * col[0]), w * (0.5 + 0.5 * col[1]), w * (0.5 + 0.5 * col[2])]);   // the flash at its heart
    }
    const m = Math.round((26 + 90 * power) * Math.min(1.6, size));
    for (let i = 0; i < m; i++) {
      const a = x.rnd(0, TAU), sp = Math.sqrt(x.rnd(0.1, 1)) * (280 + 860 * power) * size;   // a filled sphere seen from outside
      const life = x.rnd(0.8, 1.5 + 0.8 * power);
      // The sparks are SEEN for 0.6 of that, but they keep stirring the smoke for all of it: cutting the wakes short made the
      // smoke thicker and lumpier (measured), the opposite of crisp.
      sparks.push({ show: life * 0.6, x: cx, y: cy, px: cx, py: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born, age: 0, life, col, wake: i % 4 === 0 });
    }
    // The heart: a flat bone disc, no fall-off, so the attack frame is sharp. It is seen for two steps; the canvas fade takes it down.
    hearts.push({ x: cx, y: cy, r: 14 + 26 * power, born, shown: false });
    if (sparks.length > 900) sparks.splice(0, sparks.length - 900);
  }

  const shell = (g, w, h, r, col) => { g.save(); g.strokeStyle = col; g.lineWidth = 1.3; g.lineCap = 'round'; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * r * 0.35, h / 2 + Math.sin(a) * r * 0.35); g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); g.stroke(); } g.restore(); };
  const H_HOLD = 0.033, flash = (t) => (t < H_HOLD ? 1 : Math.pow(0.5, (t - H_HOLD) / 0.06));
  const rgbOf = (hue) => css(hsv(hue, 0.82, 1), 1);

  TOOLS.push({
    id: 'fireworks-snap', name: 'Fireworks, every note', tag: 'new',
    blurb: 'Fireworks that count the notes: on picked notes none is dropped (a close one goes off at half strength), each burst opens with a bright heart for an instant, and the sparks start fierce and die in about half the time. Every attack goes off, and the blast stirs the air: a real fluid, so the smoke curls outward in petals and the next burst tears through what the last one left. Sparks fly and fall through it, dragging their wakes. Left to right by pitch, higher and bigger the harder it is played. You set the colour.',
    params: [
      { key: 'hue', label: 'which colour', min: 0, max: 1, value: 0.08,
        hint: 'The colour of the bursts, all round the wheel: red, gold, green, blue, violet, and back to red.',
        icon: (g, v, w, h) => shell(g, w, h, 11, rgbOf(v)) },
      { key: 'range', label: 'how far the colours wander', min: 0, max: 1, value: 0.2,
        hint: 'How far from that colour a burst may go, by its pitch, so a note keeps its colour. Left: all one colour. Right: the whole rainbow.',
        icon: (g, v, w, h) => { for (let i = 0; i < 5; i++) ICON.dot(g, 6 + i * 7, h / 2, 3, rgbOf(0.08 + (i - 2) / 4 * v * 0.5)); } },
      { key: 'size', label: 'how big the bursts are', min: 0.4, max: 2.4, value: 1, less: 0.55,
        hint: 'How big a burst is. Left: small, many fit. Right: one fills the sky.',
        icon: (g, v, w, h) => shell(g, w, h, 4 + v * 8, '#ffb040') },
      { key: 'swirl', label: 'how much it stirs the air', min: 0, max: 1, value: 0.55,
        hint: 'How hard a blast stirs the fluid. Left: the smoke barely moves. Right: every burst tears the smoke into curling eddies.',
        icon: (g, v, w, h) => { g.save(); g.strokeStyle = '#ffb040'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * (1 + 5 * v) * TAU, r = t * 11; const X = w / 2 + Math.cos(a) * r, Y = h / 2 + Math.sin(a) * r; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); } g.stroke(); g.restore(); } },
      { key: 'linger', label: 'how long the smoke hangs', min: 0, max: 1, value: 0.45, less: 0.08,
        hint: 'How long the coloured smoke stays. Left: gone in a moment. Right: it hangs for seconds and builds up.',
        icon: (g, v, w, h) => { for (let i = 0; i < 6; i++) ICON.dot(g, 5 + i * 6, h / 2, 3, css([1, 0.69, 0.25], Math.max(0.05, 1 - i / (1 + 5.5 * v)))); } },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much firework it throws: how big each burst is and how long its smoke hangs. Left: small bursts with few sparks, and the smoke gone in a moment. Right: big bursts and smoke that builds up. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset() { hearts = []; sparks = []; pend = []; lastBurst = -9; clock = 0; vels = null; pitches = null; clearFluid(); },
    onChord(ch, x) {
      const v = rank(ch.vel);
      // in busy music not every note gets a shell: the harder ones still do
      const rate = x.feat.rate, gap = 0.16 + 0.75 * rate * (1 - v * 0.8);
      // On picked notes the note is the point: a close one is not dropped but goes off at half power.
      const close = clock - lastBurst < gap;
      if (close && !x.picked) return;
      lastBurst = clock;
      const top = ch.notes.reduce((a, n) => Math.max(a, n.m), 0), p = pitchRank(top), power = (Math.pow(v, 1.3) * (1 - 0.35 * rate) + 0.08) * (close ? 0.5 : 1);
      const hue = x.p('hue') + x.p('range') * (p - 0.5), col = hsv(hue, 0.86, 1);
      // low on the left, high on the right; the harder, the higher up
      const cx = x.W * (0.12 + 0.76 * p) + x.rnd(-130, 130), cy = x.H * (0.66 - 0.4 * v) + x.rnd(-110, 110);
      pend.push({ cx: Math.max(60, Math.min(x.W - 60, cx)), cy: Math.max(70, Math.min(x.H - 70, cy)), power, col, born: ch.t });
    },
    frame(x) {
      const g = x.g, dt = x.dt;
      if (!F && !broken) { F = makeFluid(); if (!F) broken = true; else clearFluid(); }
      // The bursts wait for this frame so they enter the fluid before it steps, and show at once.
      for (const b of pend) burst(b.cx, b.cy, b.power, b.col, x, b.born);
      pend = [];
      if (dt > 0) {
        clock += dt;
        const drag = Math.exp(-1.8 * dt), swirl = x.p('swirl');
        let wakes = 0;
        for (const s of sparks) {
          s.px = s.x; s.py = s.y; s.age = x.t - s.born;
          s.vx *= drag; s.vy = s.vy * drag + 110 * dt;
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (F && s.wake && wakes < 18 && s.age < s.life * 0.7 && Math.hypot(s.vx, s.vy) > 50) {
            wakes++;
            splat(F.vel, s.x, s.y, 9, [s.vx * 0.5 * swirl, -s.vy * 0.5 * swirl, 0]);
            splat(F.dye, s.x, s.y, 4, [s.col[0] * 0.035, s.col[1] * 0.035, s.col[2] * 0.035]);
          }
        }
        sparks = sparks.filter((s) => s.age < s.life);
        if (F) {
          const n = Math.max(1, Math.min(3, Math.ceil(dt * 40))), h = Math.min(dt, 0.1) / n, linger = x.p('linger');
          for (let i = 0; i < n; i++) step(h, swirl, linger);
        }
      }
      if (F) {
        const { gl, P, dye, cv } = F;
        gl.useProgram(P.show.p); into(gl, null); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        bindTex(gl, 0, dye.a, P.show.u.q); quad(gl);
        const was = g.imageSmoothingQuality;
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(cv, 0, 0, x.W, x.H);
        g.imageSmoothingQuality = was;
      }
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const s of sparks) {
        if (s.age >= s.show) continue;
        const t = s.age / s.show, a = Math.max(flash(s.age), 0.5 * (1 - t * t));
        g.globalAlpha = Math.min(1, a); g.strokeStyle = t < 0.2 ? '#fff4e0' : css(s.col, 1); g.lineWidth = 1.2 + 1.6 * (1 - t);
        g.beginPath(); g.moveTo(s.px, s.py); g.lineTo(s.x, s.y); g.stroke();
      }
      g.globalCompositeOperation = 'source-over'; g.lineCap = 'butt';
      // Hearts last: over the smoke and the sparks. Seen on the attack's own step and until H after the chord.
      g.fillStyle = 'rgb(236,226,208)'; g.globalAlpha = 1;
      for (const h of hearts) {
        if (h.shown && x.t - h.born >= H_HOLD) continue;
        h.shown = true;
        g.beginPath(); g.arc(h.x, h.y, h.r, 0, TAU); g.fill();
      }
      hearts = hearts.filter((h) => x.t - h.born < H_HOLD);
      g.globalAlpha = 1;
    },
  });
})();
