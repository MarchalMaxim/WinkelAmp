// Perlin: a glossy, lumpy surface made of Perlin noise, lit from above (the user's reference was dark-red wet lumps with
// black creases; red read as blood, so the colour is a preset, indigo first). The knobs are the noise's own parameters,
// so each can follow the music on the card:
//   how big the lumps are  = the base frequency (bigger lumps = a lower frequency), follows the bass
//   how rough              = the persistence: how much each finer octave adds, follows higher notes
//   how much it twists     = domain warping: the noise bends the coordinates of more noise, follows loudness
//   how fast it churns     = the speed through the third dimension of the noise (time), follows faster playing
// The driven ones glide for about 0.3 s rather than jump, and a new size zooms about the middle.
// The notes press in two ways. The six octaves of the noise listen to the octaves of the piano: a bass note swells the
// big lumps, a high note crinkles the fine grain, each in its own octave of the noise. And each note raises a bulge where
// it lands, left to right by pitch, broad for the bass and tight for the treble, that swells on the attack and sinks
// back when the note ends. How present is the sea level: low, only what the notes raise breaks the black.
// The field is computed on the graphics card at half size (its own WebGL2 canvas): one pass for the height, one to
// light it. Without WebGL2 and float targets it draws nothing.
(() => {
  const OUT_W = 640, OUT_H = 360, OCT = 6, BULGES = 24, PRESS = 1;
  // The colour presets (the user: red "looks too much like blood"): crease, body, tight highlight, broad sheen, all 0..1 rgb.
  const PRESETS = [
    { name: 'indigo', deep: [0.0, 0.01, 0.05], body: [0.1, 0.16, 0.55], spec: [0.8, 0.88, 1.0], sheen: [0.3, 0.45, 0.95] },
    { name: 'jade', deep: [0.0, 0.04, 0.03], body: [0.06, 0.42, 0.33], spec: [0.82, 1.0, 0.92], sheen: [0.25, 0.75, 0.6] },
    { name: 'amber', deep: [0.05, 0.015, 0.0], body: [0.62, 0.3, 0.04], spec: [1.0, 0.92, 0.7], sheen: [0.95, 0.55, 0.15] },
    { name: 'pearl', deep: [0.04, 0.035, 0.045], body: [0.58, 0.55, 0.56], spec: [1.0, 0.97, 0.94], sheen: [0.7, 0.62, 0.78] },
    { name: 'oxblood', deep: [0.06, 0.0, 0.02], body: [0.6, 0.02, 0.07], spec: [1.0, 0.72, 0.76], sheen: [0.85, 0.12, 0.2] },
  ];
  const presetCss = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const VERT = `#version 300 es
in vec2 p; out vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
  // Height: fractal (fBm) 3-D gradient noise, its coordinates bent by two more noise fields (domain warping).
  const HEIGHT = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform float uAspect, uFreq, uGain, uWarp, uZ, uSea;
uniform float uOct[${OCT}];
uniform vec4 uB[${BULGES}]; uniform int uNB;
uvec3 pcg3(uvec3 v) { v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return v; }
vec3 grad(vec3 i) { uvec3 h = pcg3(uvec3(ivec3(i) + 65536)); return normalize(vec3(h & 0xffffu) / 32767.5 - 1.0 + 1e-4); }
// Ken Perlin's gradient noise: a random gradient at each lattice corner, blended with his quintic fade 6t^5-15t^4+10t^3.
float perlin(vec3 p) {
  vec3 i = floor(p), f = p - i, u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(grad(i), f), n100 = dot(grad(i + vec3(1, 0, 0)), f - vec3(1, 0, 0));
  float n010 = dot(grad(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)), n110 = dot(grad(i + vec3(1, 1, 0)), f - vec3(1, 1, 0));
  float n001 = dot(grad(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)), n101 = dot(grad(i + vec3(1, 0, 1)), f - vec3(1, 0, 1));
  float n011 = dot(grad(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)), n111 = dot(grad(i + vec3(1, 1, 1)), f - vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
// Each octave doubles the frequency (lacunarity 2, turned a little so the lattice never lines up) and keeps uGain of the
// amplitude (persistence). uOct[k] is what the notes add to octave k, not shrunk by the persistence, so a high note's
// fine grain shows as plainly as a bass note's heave even on a smooth surface. The surface is Perlin's own "turbulence": the sum of |noise|, whose
// zero crossings become sharp creases between rounded lumps. The warp fields are the plain signed sum.
const mat2 TURN = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec3 p, int n) {
  float s = 0.0, a = 1.0, tot = 0.0;
  for (int k = 0; k < ${OCT}; k++) {
    if (k >= n) break;
    s += a * perlin(p); tot += a;
    p = vec3(TURN * p.xy, p.z * 1.6 + 3.1); a *= uGain;
  }
  return s / tot;
}
float turbulence(vec3 p) {
  float s = 0.0, a = 1.0, tot = 0.0;
  for (int k = 0; k < ${OCT}; k++) {
    s += (a + uOct[k]) * abs(perlin(p)); tot += a;
    p = vec3(TURN * p.xy, p.z * 1.6 + 3.1); a *= uGain;
  }
  return s / tot;
}
void main() {
  vec2 xy = vec2((uv.x - 0.5) * uAspect, 0.5 - uv.y);   // centred, so a new size zooms about the middle
  vec3 p = vec3(xy * uFreq, uZ);
  vec2 q = vec2(fbm(p, 3), fbm(p + vec3(5.2, 1.3, 7.7), 3));
  float h = turbulence(p + uWarp * vec3(q, 0.0)) * 3.2;
  for (int j = 0; j < ${BULGES}; j++) {
    if (j >= uNB) break;
    vec2 d = xy - uB[j].xy; h += uB[j].w * exp(-dot(d, d) / (uB[j].z * uB[j].z));
  }
  // Above the sea a lump rises; below it is black.
  o = vec4(max(0.0, h - uSea), h, 0.0, 1.0);
}`;
  // Light: the slope of the height gives a normal; the preset's body colour, darker creases, and a wet shine in two widths.
  const SHADE = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uH; uniform vec2 uTx; uniform float uBump, uShine, uAll; uniform vec3 uDeep, uBody, uSpec, uSheen;
void main() {
  float c = texture(uH, uv).r;
  float l = texture(uH, uv - vec2(uTx.x, 0)).r, r = texture(uH, uv + vec2(uTx.x, 0)).r;
  float b = texture(uH, uv - vec2(0, uTx.y)).r, t = texture(uH, uv + vec2(0, uTx.y)).r;
  vec3 n = normalize(vec3((l - r) * uBump, (b - t) * uBump, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.55, 0.75)), V = vec3(0, 0, 1), Hh = normalize(L + V);
  float dif = max(dot(n, L), 0.0), nh = max(dot(n, Hh), 0.0);
  float ao = smoothstep(0.02, 0.6, c);                      // the creases stay dark
  vec3 body = mix(uDeep, uBody, smoothstep(0.1, 0.9, c));
  vec3 col = body * (0.1 + 0.85 * pow(dif, 1.6)) * ao;
  col += uShine * ao * (uSpec * pow(nh, 45.0) * 0.7 + uSheen * pow(nh, 10.0) * 0.22);
  col = clamp(col * uAll, 0.0, 1.0);
  // The shared canvas keeps a faded copy of each frame: this settles at col over black, with black see-through.
  float a = min(1.0, 3.0 * max(col.r, max(col.g, col.b)));
  o = vec4(col * (0.12 + 0.88 * a), a);
}`;

  let F = null, broken = false;
  function make() {
    const cv = document.createElement('canvas'); cv.width = OUT_W; cv.height = OUT_H;
    const gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl || !(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) return null;
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); F = null; });
    const prog = (src) => {
      const p = gl.createProgram();
      for (const [type, text] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, src]]) {
        const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`perlin shader: ${gl.getShaderInfoLog(s)}`);
        gl.attachShader(p, s);
      }
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`perlin link: ${gl.getProgramInfoLog(p)}`);
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, name); }
      return { p, u };
    };
    const P = { height: prog(HEIGHT), shade: prog(SHADE) };
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, OUT_W, OUT_H, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { cv, gl, P, tex, fb, oct: new Float32Array(OCT), bul: new Float32Array(BULGES * 4) };
  }

  // The music's state: how swollen each octave of the noise is, the bulges of the notes, and where the noise has got to in time.
  let swell = new Float32Array(OCT), bulges = [], z = 0, eased = null;
  const EASED = ['size', 'rough', 'twist'];   // driven knobs glide (about 0.3 s) instead of jumping on an attack
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  /** The noise octave a MIDI note belongs to, as a fraction: A0..C2 is the biggest lumps (0), the top of the piano the finest (5). */
  const octaveOf = (m) => clamp((m - 30) / 13, 0, OCT - 1);

  TOOLS.push({
    id: 'perlin', name: 'Perlin', tag: 'new',
    blurb: 'A wet, lumpy surface of Perlin noise, lit from above. Its knobs are the noise’s own: lump size, roughness, twist, churn. Bass notes swell the big lumps, high notes ripple the fine grain, and each note raises a bulge where it lands.',
    params: [
      { key: 'size', label: 'how big the lumps are', min: 0.4, max: 2.5, value: 1, drive: '+bass',
        hint: 'The noise’s base frequency. Left: many small lumps. Right: a few huge ones.',
        icon: (g, v, w, h) => { const n = Math.round(6 - v * 4.5); for (let i = 0; i < n; i++) ICON.dot(g, (i + 0.5) * w / n, h / 2, Math.min(h * 0.45, w / n * 0.45), ICON.blue); } },
      { key: 'rough', label: 'how rough', min: 0.2, max: 0.65, value: 0.35, drive: '+pitch',
        hint: 'The persistence: how much each finer layer of the noise adds. Left: smooth rounded lumps. Right: crinkled, grainy skin.',
        icon: (g, v, w, h) => ICON.wave(g, w, h, 0.25 + v * 0.5, 2 + v * 6, ICON.blue) },
      { key: 'twist', label: 'how much it twists', min: 0, max: 1.5, value: 0.5, drive: '+level',
        hint: 'Domain warping: the noise bends the ground of more noise. Left: plain blobs. Right: swirled, folded, stretched like taffy.',
        icon: (g, v, w, h) => ICON.wave(g, w, h, 0.3 + v * 0.6, 1 + v * 2.5, ICON.blue) },
      { key: 'churn', label: 'how fast it churns', min: 0, max: 1.5, value: 0.25, drive: '+rate',
        hint: 'How fast the noise moves through time. Left: still. Right: boiling.',
        icon: ICON.of.speed(ICON.blue) },
      { key: 'colour', label: 'colour', min: 0, max: PRESETS.length - 1, step: 1, value: 0,
        hint: 'The colour of the surface. Left to right: indigo, jade, amber, pearl, oxblood.',
        icon: (g, v, w, h) => { const c = PRESETS[clamp(Math.round(v * (PRESETS.length - 1)), 0, PRESETS.length - 1)]; ICON.palette(g, [c.deep, c.body, c.sheen, c.spec].map(presetCss), w, h); } },
      // A plain knob the widget reads, not one that leads others: it is the sea level, which no other knob sets.
      { key: 'presence', label: 'how present', min: 0, max: 1, value: 1,
        hint: 'The sea level: how much of the surface shows. Left: black, and only the bulges the notes raise break through. Right: lumps cover the whole picture.',
        icon: (g, v, w, h) => ICON.much(g, v, w, h) },
    ],
    reset(x) { swell = new Float32Array(OCT); bulges = []; z = (x?.t ?? 0) * 0.25; eased = null; },
    onChord(ch, x) {
      const press = PRESS;
      for (const n of ch.notes) {
        const loud = clamp(n.v / 110, 0.15, 1.2), k = octaveOf(n.m), k0 = Math.floor(k), f = k - k0;
        swell[k0] += loud * (1 - f); if (k0 + 1 < OCT) swell[k0 + 1] += loud * f;
        const p = x.pitch01(n.m), seed = ch.t * 7.31 + n.m;
        bulges.push({
          x: (0.88 * p - 0.44) * (x.W / x.H) + (hash(seed, 1) - 0.5) * 0.18,
          y: 0.64 * (hash(seed, 2) - 0.5),
          r: 0.05 + 0.2 * (1 - p) * (0.6 + 0.4 * loud),        // the bass broad, the treble tight
          amp: 0.55 * loud * press, held: Math.max(0.08, n.d || 0.3), age: 0,
        });
      }
      if (bulges.length > BULGES) bulges.splice(0, bulges.length - BULGES);
    },
    frame(x) {
      if (!F && !broken) { try { F = make(); } catch (e) { broken = true; throw e; } if (!F) broken = true; }
      if (!F) return;
      const dt = x.dt, press = PRESS, presence = x.p('presence');
      if (!eased) eased = Object.fromEntries(EASED.map((k) => [k, x.p(k)]));
      if (dt > 0) {
        const glide = 1 - Math.exp(-dt / 0.3);
        for (const k of EASED) eased[k] += (x.p(k) - eased[k]) * glide;
        z += dt * x.p('churn');
        const keep = Math.exp(-dt / 0.45);
        for (let k = 0; k < OCT; k++) swell[k] *= keep;
        for (const b of bulges) b.age += dt;
        bulges = bulges.filter((b) => b.age < b.held + 1.2);
      }
      const { gl, P, cv, oct, bul } = F;
      // a finer octave is steeper for the same height, so its swell is smaller: about the same slope in every octave
      for (let k = 0; k < OCT; k++) oct[k] = press * 0.6 * Math.pow(0.58, k) * Math.min(2, swell[k]);
      let nb = 0;
      for (const b of bulges) {
        // on the attack the bulge jumps up in a few frames; held it sinks to 60%; after the note ends it subsides
        const rise = Math.min(1, b.age / 0.04), hold = 0.6 + 0.4 * Math.exp(-b.age / 0.25);
        const after = b.age > b.held ? Math.exp(-(b.age - b.held) / 0.35) : 1;
        const a = b.amp * rise * hold * after;
        if (a < 0.01) continue;
        bul.set([b.x, b.y, b.r, a], nb * 4); nb++;
      }
      gl.viewport(0, 0, OUT_W, OUT_H);
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.fb);
      const H = P.height; gl.useProgram(H.p);
      gl.uniform1f(H.u.uAspect, OUT_W / OUT_H);
      gl.uniform1f(H.u.uFreq, 2.4 / eased.size);
      gl.uniform1f(H.u.uGain, eased.rough);
      gl.uniform1f(H.u.uWarp, eased.twist);
      gl.uniform1f(H.u.uZ, z);
      gl.uniform1f(H.u.uSea, 0.85 * Math.pow(1 - presence, 1.6));   // presence 1: all above the sea; 0: only the bulges break it
      gl.uniform1fv(H.u.uOct, oct);
      gl.uniform4fv(H.u.uB, bul);
      gl.uniform1i(H.u.uNB, nb);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const S = P.shade; gl.useProgram(S.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, F.tex); gl.uniform1i(S.u.uH, 0);
      gl.uniform2f(S.u.uTx, 1 / OUT_W, 1 / OUT_H);
      gl.uniform1f(S.u.uBump, 5);
      gl.uniform1f(S.u.uShine, 1);
      gl.uniform1f(S.u.uAll, 1);
      const c = PRESETS[clamp(Math.round(x.p('colour')), 0, PRESETS.length - 1)];
      gl.uniform3fv(S.u.uDeep, c.deep); gl.uniform3fv(S.u.uBody, c.body); gl.uniform3fv(S.u.uSpec, c.spec); gl.uniform3fv(S.u.uSheen, c.sheen);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const g = x.g, was = g.imageSmoothingQuality;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(cv, 0, 0, x.W, x.H);
      g.imageSmoothingQuality = was;
    },
  });
})();
