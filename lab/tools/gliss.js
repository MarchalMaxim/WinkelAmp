// Gliss (the user: "a quick, big progression, almost like a stretched out glissando", heard in Liebesleid at 2:53, tracing a
// bell from left to right that "goes up and also returns to its baseline", with "bursts of energy, not sharp, but rounded,
// vague around edges... Warm", and then "a webGL fluid dynamics thing that emits small impulses"). No line is drawn. A point
// nobody sees climbs and falls along the bell, and every note gives a real fluid many tiny warm shoves away from it, so the
// bell only shows in where the curls appear. Nothing new starts between notes: after the last one the curls just fade.
// Made for a sweep of notes picked by hand; on a whole song it looks for fast runs that climb. The picture is a function of
// song time and the knobs: the fluid steps at a fixed rate, and after a seek it is replayed from the start of the sweep.
(() => {
  const W = 1280, H = 720, SIM_W = 480, SIM_H = 270, DYE_W = 1024, DYE_H = 576, GLOW_W = 256, GLOW_H = 144, ASPECT = SIM_W / SIM_H;
  const STEP = 1 / 60, SPREAD = 0.07, FADE = 0.12;   // SPREAD: seconds a note's pulses take to go out; FADE: the shared canvas's, each frame
  const GAP = 0.8, MAX_SWEEP = 6, REPLAY = 6;        // seconds: a silence that ends a sweep, the most a picked sweep lasts, the most a seek replays
  const SWIRL = 10, LIFT = 14, TIRE = 1.1;           // how much it curls, warm things rising, how fast the fluid slows
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const smoother = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (6 * u - 15) + 10); };
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 11.7) * 43758.5453; return x - Math.floor(x); };

  /** One bell over these notes: up to the highest, back down by the last. */
  function bell(hits) {
    const ms = hits.map((h) => h.m), hi = Math.max(...ms), t0 = hits[0].t, last = hits[hits.length - 1].t;
    let tp = hits.find((h) => h.m === hi).t, t1 = last;
    if (tp <= t0) tp = t0 + Math.max(0.2, (last - t0) * 0.35);   // it starts at the top
    if (tp >= t1) t1 = tp + Math.max(0.4, tp - t0);              // it never comes down: the bell still does
    return { t0, tp, t1, height: 0.54 * clamp((hi - Math.min(...ms)) / 30, 0.5, 1), notes: hits };
  }
  /** Fast climbs in a stretch nobody picked: notes that keep rising, then what follows while the line could still come down. */
  function climbs(hits) {
    const found = [];
    for (let i = 0; i < hits.length; i++) {
      const run = [hits[i]];
      for (let j = i + 1; j < hits.length && hits[j].t - run[run.length - 1].t < 0.25; j++) {
        const a = run[run.length - 1], b = hits[j];
        if (b.m > a.m && b.m - a.m <= 12 && b.t - a.t >= 0.015) run.push(b);
      }
      const top = run[run.length - 1];
      if (run.length < 6 || top.m - run[0].m < 19) continue;
      const until = top.t + Math.min(1.2, (top.t - run[0].t) * 1.4);
      let k = i; while (k + 1 < hits.length && hits[k + 1].t <= until) k++;
      found.push(hits.slice(i, k + 1));
      i = k;
    }
    return found;
  }
  /** The sweeps these notes make, in order. A silence ends one; a stretch too long to be one sweep was not picked by hand. */
  function planOf(chords) {
    const hits = [];
    for (const c of chords) for (const n of c.notes) hits.push({ t: c.t, m: n.m, v: n.v });
    const sweeps = [];
    let from = 0;
    for (let i = 1; i <= hits.length; i++) {
      if (i < hits.length && hits[i].t - hits[i - 1].t < GAP) continue;
      const part = hits.slice(from, i);
      from = i;
      if (part.length && part[part.length - 1].t - part[0].t > MAX_SWEEP) sweeps.push(...climbs(part).map(bell));
      else if (part.length) sweeps.push(bell(part));
    }
    return { sweeps };
  }
  /** The sweeps showing at time t, joined while one's tail reaches the next: what the fluid has to know about. Null when none. */
  function runAt(sweeps, t, tail) {
    let run = null;
    for (const s of sweeps) {
      if (s.t0 > t) break;
      if (run && s.t0 < run.end) { run.sweeps.push(s); run.end = Math.max(run.end, s.t1 + tail); }
      else run = { start: s.t0, end: s.t1 + tail, sweeps: [s] };
    }
    return run && t < run.end ? run : null;
  }
  const heightAt = (s, t) => (t < s.tp ? smoother((t - s.t0) / (s.tp - s.t0)) : 1 - smoother((t - s.tp) / (s.t1 - s.tp)));
  const pathX = (s, t) => 0.07 + 0.86 * (t - s.t0) / (s.t1 - s.t0);
  const pathY = (s, t) => 0.24 + s.height * heightAt(s, t);

  const VERT = `#version 300 es
  in vec2 aPos; out vec2 vUv;
  void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const SPLAT_VERT = `#version 300 es
  in vec2 aPos; out vec2 vP; uniform vec2 uPoint, uHalf;
  void main() { vP = aPos * uHalf; gl_Position = vec4((uPoint + vP) * 2.0 - 1.0, 0.0, 1.0); }`;
  const FRAG = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o;\n`;
  const near = (tex, name) => `float ${name}L = texture(${tex}, vUv - vec2(uTx.x, 0.0)).${name[0]}, ${name}R = texture(${tex}, vUv + vec2(uTx.x, 0.0)).${name[0]}, ${name}B = texture(${tex}, vUv - vec2(0.0, uTx.y)).${name[1]}, ${name}T = texture(${tex}, vUv + vec2(0.0, uTx.y)).${name[1]};`;
  const SHADERS = {
    splat: [SPLAT_VERT, `#version 300 es
      precision highp float; in vec2 vP; out vec4 o; uniform vec3 uVal; uniform float uR, uAspect;
      void main() { vec2 p = vP; p.x *= uAspect; o = vec4(exp(-dot(p, p) / uR) * uVal, 0.0); }`],
    advect: [VERT, FRAG + `uniform sampler2D uV, uS; uniform vec2 uTx, uSoft; uniform float uDt, uKeep;
      void main() { vec2 c = vUv - uDt * texture(uV, vUv).xy * uTx;
        vec3 m = texture(uS, c).xyz * 0.4 + (texture(uS, c + vec2(uSoft.x, 0.0)).xyz + texture(uS, c - vec2(uSoft.x, 0.0)).xyz + texture(uS, c + vec2(0.0, uSoft.y)).xyz + texture(uS, c - vec2(0.0, uSoft.y)).xyz) * 0.15;
        o = vec4(m * uKeep, 1.0); }`],
    blur: [VERT, FRAG + `uniform sampler2D uS; uniform vec2 uDir;
      void main() { vec3 m = texture(uS, vUv).xyz * 0.227; m += (texture(uS, vUv + uDir * 1.385).xyz + texture(uS, vUv - uDir * 1.385).xyz) * 0.316; m += (texture(uS, vUv + uDir * 3.231).xyz + texture(uS, vUv - uDir * 3.231).xyz) * 0.07; o = vec4(m, 1.0); }`],
    curl: [VERT, FRAG + `uniform sampler2D uV; uniform vec2 uTx;
      void main() { ${near('uV', 'yx')} o = vec4(0.5 * (yxR - yxL - yxT + yxB), 0.0, 0.0, 1.0); }`],
    swirl: [VERT, FRAG + `uniform sampler2D uV, uC; uniform vec2 uTx; uniform float uK, uDt;
      void main() { ${near('uC', 'xx')} float C = texture(uC, vUv).x;
        vec2 f = 0.5 * vec2(abs(xxT) - abs(xxB), abs(xxR) - abs(xxL)); f /= length(f) + 1e-4; f *= uK * C; f.y *= -1.0; o = vec4(texture(uV, vUv).xy + f * uDt, 0.0, 1.0); }`],
    lift: [VERT, FRAG + `uniform sampler2D uV, uD; uniform float uK;
      void main() { vec2 v = texture(uV, vUv).xy; v.y += uK * texture(uD, vUv).x; o = vec4(v, 0.0, 1.0); }`],
    div: [VERT, FRAG + `uniform sampler2D uV; uniform vec2 uTx;
      void main() { ${near('uV', 'xy')} o = vec4(0.5 * (xyR - xyL + xyT - xyB), 0.0, 0.0, 1.0); }`],
    press: [VERT, FRAG + `uniform sampler2D uP, uD; uniform vec2 uTx;
      void main() { ${near('uP', 'xx')} o = vec4((xxL + xxR + xxB + xxT - texture(uD, vUv).x) * 0.25, 0.0, 0.0, 1.0); }`],
    grad: [VERT, FRAG + `uniform sampler2D uP, uV; uniform vec2 uTx;
      void main() { ${near('uP', 'xx')} o = vec4(texture(uV, vUv).xy - 0.5 * vec2(xxR - xxL, xxT - xxB), 0.0, 1.0); }`],
    // Black is see-through and bright is solid. The shared canvas keeps what was drawn and fades it a little each frame, so
    // part-clear light builds up: this is the light that settles at c over black.
    show: [VERT, FRAG + `uniform sampler2D uD, uG; uniform vec3 uTint; uniform float uFade, uAll;
      float n(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() { float e = (max(texture(uD, vUv).x, 0.0) * 1.5 + max(texture(uG, vUv).x, 0.0) * 1.2) * 1.6 * uAll;
        vec3 c = 1.0 - exp(-e * uTint);
        c = clamp(c + (e > 0.002 ? (n(vUv * vec2(1280.0, 720.0)) - 0.5) / 255.0 : 0.0), 0.0, 1.0);
        float a = min(1.0, 3.0 * max(c.r, max(c.g, c.b)));
        o = vec4(c * (uFade + (1.0 - uFade) * a), a); }`],
  };

  /** One graphics context for every copy of Gliss: a browser only allows so many. Null without WebGL2. */
  function shared() {
    const G = globalThis, have = G.__glissGl;
    if (have && !have.gl.isContextLost()) return have;
    if (have) G.__glissGl = null;
    if (typeof document === 'undefined' || G.__glissNever) return null;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl || !(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) { G.__glissNever = true; return null; }
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = {};
    for (const name of Object.keys(SHADERS)) {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, SHADERS[name][0])); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, SHADERS[name][1]));
      gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      for (let i = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) - 1; i >= 0; i--) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
      pr[name] = { p, u };
    }
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.blendFunc(gl.ONE, gl.ONE);
    cv.addEventListener('webglcontextlost', (e) => e.preventDefault());   // shared() sees it and makes a new one
    return (G.__glissGl = { gl, cv, pr });
  }

  /** A fluid's textures: only while a sweep shows, as a copy of Gliss waits unused for most of a song. */
  function makeFluid(S) {
    const gl = S.gl, made = [];
    const fbo = (w, h, filter) => {
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const t = { f, tex, w, h }; made.push(t); return t;
    };
    const pair = (w, h, filter) => {
      let a = fbo(w, h, filter), b = fbo(w, h, filter);
      return { get read() { return a; }, get write() { return b; }, swap() { const t = a; a = b; b = t; } };
    };
    return {
      gl: S.gl, made,
      vel: pair(SIM_W, SIM_H, gl.LINEAR), dye: pair(DYE_W, DYE_H, gl.LINEAR), press: pair(SIM_W, SIM_H, gl.NEAREST),
      curl: fbo(SIM_W, SIM_H, gl.NEAREST), div: fbo(SIM_W, SIM_H, gl.NEAREST), glow: pair(GLOW_W, GLOW_H, gl.LINEAR),
    };
  }
  function clearFluid(F) {
    const gl = F.gl;
    for (const t of F.made) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.f); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
  }

  const use = (gl, pr) => { gl.useProgram(pr.p); return pr.u; };
  const bind = (gl, loc, unit, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); };
  const draw = (gl, t) => { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.f : null); if (t) gl.viewport(0, 0, t.w, t.h); else gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLES, 0, 3); };

  // Added where it lands, on a quad just big enough, so hundreds of tiny pulses cost next to nothing.
  function splat(S, target, x, y, val, r) {
    const gl = S.gl, u = use(gl, S.pr.splat), reach = 3 * Math.sqrt(r);
    gl.uniform2f(u.uPoint, x, y); gl.uniform2f(u.uHalf, reach / ASPECT, reach);
    gl.uniform3f(u.uVal, val[0], val[1], val[2]); gl.uniform1f(u.uR, r); gl.uniform1f(u.uAspect, ASPECT);
    gl.enable(gl.BLEND); draw(gl, target.read); gl.disable(gl.BLEND);
  }
  // One of a note's pulses: a little light, and a shove away from the bell, mostly to its outer side.
  function pulse(S, F, s, n, i, k, t, push, size) {
    const v = n.v / 70, x = pathX(s, t), y = pathY(s, t), d = 0.012;
    const tx = (pathX(s, t + d) - pathX(s, t - d)) * ASPECT, ty = pathY(s, t + d) - pathY(s, t - d), len = Math.hypot(tx, ty) || 1;
    const ux = tx / len, uy = ty / len;
    const a = rnd(i * 7 + k), b = rnd(i * 11 + k + 40), c = rnd(i * 13 + k + 80);
    const side = b < 0.72 ? 1 : -1, ang = (c - 0.5) * 1.1, nx = -uy * side, ny = ux * side;
    const dx = nx * Math.cos(ang) + ux * Math.sin(ang), dy = ny * Math.cos(ang) + uy * Math.sin(ang);
    const px = x + (c - 0.5) * 0.08, py = y + (a - 0.5) * 0.11;
    const f = 760 * push * v * (0.55 + 0.9 * a), r = 0.000045 * size * size * (0.5 + 1.1 * b);
    splat(S, F.vel, px, py, [dx * f, dy * f, 0], r * 1.7);
    splat(S, F.dye, px, py, [v * (0.2 + 0.24 * c), 0, 0], r);
  }
  // One step of the fluid: the pulses due in it, then curl, rise, pressure, and everything carried along.
  function stepFluid(S, F, run, simT, K) {
    const gl = S.gl, pr = S.pr, dt = STEP, TX = [1 / SIM_W, 1 / SIM_H];
    for (const s of run.sweeps) s.notes.forEach((n, i) => {
      if (n.t > simT + dt || n.t + SPREAD <= simT) return;
      for (let k = 0; k < K.number; k++) {
        const tk = n.t + rnd(i * 17 + k + 120) * SPREAD;
        if (tk > simT && tk <= simT + dt) pulse(S, F, s, n, i, k, tk, K.push, K.size);
      }
    });
    const { vel, dye, press } = F;
    let u = use(gl, pr.curl); bind(gl, u.uV, 0, vel.read.tex); gl.uniform2fv(u.uTx, TX); draw(gl, F.curl);
    u = use(gl, pr.swirl); bind(gl, u.uV, 0, vel.read.tex); bind(gl, u.uC, 1, F.curl.tex); gl.uniform2fv(u.uTx, TX); gl.uniform1f(u.uK, SWIRL); gl.uniform1f(u.uDt, dt); draw(gl, vel.write); vel.swap();
    u = use(gl, pr.lift); bind(gl, u.uV, 0, vel.read.tex); bind(gl, u.uD, 1, dye.read.tex); gl.uniform1f(u.uK, LIFT * dt); draw(gl, vel.write); vel.swap();
    u = use(gl, pr.div); bind(gl, u.uV, 0, vel.read.tex); gl.uniform2fv(u.uTx, TX); draw(gl, F.div);
    u = use(gl, pr.press); gl.uniform2fv(u.uTx, TX); bind(gl, u.uD, 1, F.div.tex);
    for (let i = 0; i < 24; i++) { bind(gl, u.uP, 0, press.read.tex); draw(gl, press.write); press.swap(); }
    u = use(gl, pr.grad); bind(gl, u.uP, 0, press.read.tex); bind(gl, u.uV, 1, vel.read.tex); gl.uniform2fv(u.uTx, TX); draw(gl, vel.write); vel.swap();
    u = use(gl, pr.advect); bind(gl, u.uV, 0, vel.read.tex); bind(gl, u.uS, 1, vel.read.tex); gl.uniform2fv(u.uTx, TX); gl.uniform2f(u.uSoft, 0, 0); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uKeep, Math.exp(-dt * TIRE)); draw(gl, vel.write); vel.swap();
    u = use(gl, pr.advect); bind(gl, u.uV, 0, vel.read.tex); bind(gl, u.uS, 1, dye.read.tex); gl.uniform2fv(u.uTx, TX); gl.uniform2f(u.uSoft, 0.3 / DYE_W, 0.3 / DYE_H); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uKeep, Math.exp(-dt * Math.LN2 / K.linger)); draw(gl, dye.write); dye.swap();
  }
  // The strength of each colour of light in the picture: dense places burn towards white, thin ones show the colour.
  function tintOf(hue) {
    const f = (n) => { const k = (n + hue / 60) % 6; return 1 - 0.75 * clamp(Math.min(k, 4 - k), 0, 1); };
    return [4.2 * f(5), 4.2 * f(3), 4.2 * f(1)];
  }
  function showFluid(S, F, hue, all) {
    const gl = S.gl, pr = S.pr, glow = F.glow;
    let b = use(gl, pr.blur); bind(gl, b.uS, 0, F.dye.read.tex); gl.uniform2f(b.uDir, 0, 0); draw(gl, glow.write); glow.swap();
    for (const k of [1, 1.5, 2, 2.5, 3]) {
      bind(gl, b.uS, 0, glow.read.tex); gl.uniform2f(b.uDir, k / GLOW_W, 0); draw(gl, glow.write); glow.swap();
      bind(gl, b.uS, 0, glow.read.tex); gl.uniform2f(b.uDir, 0, k / GLOW_H); draw(gl, glow.write); glow.swap();
    }
    const u = use(gl, pr.show), t = tintOf(hue);
    bind(gl, u.uD, 0, F.dye.read.tex); bind(gl, u.uG, 1, glow.read.tex);
    gl.uniform3f(u.uTint, t[0], t[1], t[2]); gl.uniform1f(u.uFade, FADE); gl.uniform1f(u.uAll, all);
    draw(gl, null);
  }
  function dropFluid(F) {
    if (F.gl.isContextLost()) return;
    for (const t of F.made) { F.gl.deleteFramebuffer(t.f); F.gl.deleteTexture(t.tex); }
  }

  let plan = null, fluid = null, simT = null;
  const planNow = () => plan || (plan = planOf(typeof CHORDS !== 'undefined' ? CHORDS : []));
  const letGo = () => { if (fluid) dropFluid(fluid); fluid = null; simT = null; };

  TOOLS.push({
    id: 'gliss', name: 'Gliss', tag: 'new',
    blurb: 'A fast glissando as warm energy in a real fluid. No line: an unseen point climbs and falls along a bell from left to right, and every note sends out many tiny pulses that curl away from it, so the bell only shows in where they appear. After the last note they just fade. Made for a sweep of notes picked by hand.',
    plan: planOf, runAt, heightAt, tintOf,
    params: [
      { key: 'hue', label: 'colour', min: 0, max: 360, step: 1, value: 33,
        hint: 'The colour of the energy. Dense places burn towards white whatever you choose. Left and right are both red; in between it runs orange, yellow, green, blue, violet.',
        icon: (g, v, w, h) => {
          ICON.blur(g, 2.5, () => { g.fillStyle = `hsl(${v * 360},85%,55%)`; g.beginPath(); g.ellipse(w / 2, h / 2 - 2, w / 2 - 6, h / 2 - 6, 0, 0, Math.PI * 2); g.fill(); });
          for (let i = 0; i < 12; i++) ICON.rect(g, 3 + i * (w - 6) / 12, h - 4, Math.ceil((w - 6) / 12), 2.5, `hsl(${i * 30},85%,50%)`);
          ICON.rect(g, 2 + v * (w - 6), h - 6, 2, 5.5, ICON.ink); } },
      { key: 'number', label: 'how many pulses', min: 2, max: 40, step: 1, value: 18, less: 4,
        hint: 'How many pulses each note sends out. Left: a few, with gaps in the bell. Right: a dense smoke.',
        icon: (g, v, w, h) => ICON.dots(g, Math.round(2 + v * 22), w, h, { seed: 5, r: 1.2, col: ICON.gold }) },
      { key: 'push', label: 'how fast they leave the bell', min: 0, max: 3, value: 1,
        hint: 'How hard each pulse shoots away from the bell. Left: it stays where it was born. Right: it flies off and curls.',
        icon: (g, v, w, h) => { ICON.dot(g, w / 2, h / 2, 2.5, ICON.gold); const L = 3 + v * 8; for (let i = 0; i < 4; i++) { const a = 0.8 + i * Math.PI / 2; ICON.arrow(g, w / 2 + Math.cos(a) * 4, h / 2 + Math.sin(a) * 4, w / 2 + Math.cos(a) * (4 + L), h / 2 + Math.sin(a) * (4 + L), ICON.ink, 1.2); } } },
      { key: 'size', label: 'how big each pulse is', min: 0.2, max: 3, value: 1,
        hint: 'Left: fine as dust. Right: big soft puffs.',
        icon: (g, v, w, h) => ICON.blur(g, 1.5, () => ICON.dot(g, w / 2, h / 2, 1.5 + v * 8, ICON.gold)) },
      { key: 'linger', label: 'how long it stays', min: 0.2, max: 3, value: 0.6, less: 0.25,
        hint: 'Seconds until the light has half faded. Left: gone almost at once. Right: it hangs in the air.',
        icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.gold) },
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1, leads: true,
        hint: 'How much it makes: how many pulses and how long they stay. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.',
        icon: (g, v, w, h) => ICON.alpha(g, 0.15 + v * 0.85, () => ICON.dots(g, 14, w, h, { seed: 9, r: 1.3, col: ICON.gold })) },
    ],
    onChord() {},
    reset() { simT = null; },
    frame(x) {
      const K = { number: Math.round(x.p('number')), push: x.p('push'), size: x.p('size'), linger: x.p('linger') };
      const tail = clamp(K.linger * 6, 1.5, 12), run = runAt(planNow().sweeps, x.t, tail);
      if (!run) { letGo(); return; }
      const S = shared();
      if (!S) return;
      if (fluid && fluid.gl !== S.gl) { fluid = null; simT = null; }   // the context was lost: start again on the new one
      if (!fluid) { fluid = makeFluid(S); simT = null; }
      if (simT === null || x.t < simT - 0.02 || x.t > simT + 0.5) {
        clearFluid(fluid);
        simT = Math.max(run.start, x.t - REPLAY) - STEP;
      }
      while (simT + STEP <= x.t) { stepFluid(S, fluid, run, simT, K); simT += STEP; }
      showFluid(S, fluid, x.p('hue'), 1 - smooth((x.t - (run.end - 0.4)) / 0.4));
      const g = x.g;
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.drawImage(S.cv, 0, 0, W, H);
    },
  });
})();
