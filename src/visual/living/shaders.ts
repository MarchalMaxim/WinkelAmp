/**
 * GLSL for the Living Canvas. Kept as strings (not .glsl imports) so tsc needs no
 * bundler types.
 *
 * Every field texture is read with ld() and written with st(): with float
 * textures the encoding is (1, 0) and they do nothing; in the RGBA8 fallback each
 * field is stored as value * e.x + e.y, so signed velocities fit in 0..1.
 */

export const HEAD = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform float uDither;
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec4 ld(sampler2D t, vec2 uv, vec2 e) { return texture(t, uv) * e.x + e.y; }
// Base level only: the dye is mipmapped (for its mean), and under shear the implicit
// derivatives of a back-traced coordinate would pull in blurred mips.
vec4 ld0(sampler2D t, vec2 uv, vec2 e) { return textureLod(t, uv, 0.0) * e.x + e.y; }
// The soft brightness cap, as a rate (8% per 60 Hz frame), so it doesn't depend on fps.
vec3 softCap(vec3 c, float cap, float dt) {
  float m = max(max(c.r, c.g), c.b);
  if (cap > 0.0 && m > cap) c *= mix(1.0, cap / m, 1.0 - pow(0.92, dt * 60.0));
  return c;
}
// Packed (RGBA8) fields get stochastic rounding, so slow fades and small forces
// still act on average instead of rounding away to nothing.
vec4 st(vec4 v, vec2 e) {
  vec4 o = (v - e.y) / e.x;
  if (e.x != 1.0 || e.y != 0.0) o += (vec4(hash12(gl_FragCoord.xy + uDither), hash12(gl_FragCoord.yx + uDither * 1.7),
    hash12(gl_FragCoord.xy * 1.3 + uDither * 2.3), hash12(gl_FragCoord.yx * 0.7 + uDither * 3.1)) - 0.5) / 255.0;
  return o;
}
`;

/** Palette ramp through 4 stops, shadow → highlight. */
export const RAMP = /* glsl */ `
uniform vec3 uPal[4];
vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0) * 3.0;
  if (t < 1.0) return mix(uPal[0], uPal[1], t);
  if (t < 2.0) return mix(uPal[1], uPal[2], t - 1.0);
  return mix(uPal[2], uPal[3], t - 2.0);
}
`;

export const COPY = HEAD + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uSrcE, uOutE;
void main() { outColor = st(ld(uSrc, vUv, uSrcE), uOutE); }
`;

/** Multiplies a field (pressure warm start). */
export const SCALE = HEAD + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uE;
uniform float uK;
void main() { outColor = st(ld(uSrc, vUv, uE) * uK, uE); }
`;

/**
 * Dye budget: the dye's top mip level is its mean brightness. When the canvas holds
 * more light than the material's budget, everything fades a little faster, so dense
 * music can't white it out (and local structure is kept, unlike a hard cap). Dye
 * reaching the top edge fades out, so rising material vanishes instead of pooling.
 */
const BUDGET = /* glsl */ `
vec4 budget(sampler2D t, vec2 e, float b, float dt) {
  if (b < 0.0) return vec4(1.0);
  // Fade over the top ~14%: risen material thins out instead of pooling at the lid.
  // (A rate: 20% per 60 Hz frame at the very top.)
  float top = pow(mix(1.0, smoothstep(1.0, 0.86, vUv.y), 0.2), dt * 60.0);
  if (b == 0.0) return vec4(top);
  float mean = lum(textureLod(t, vec2(0.5), 16.0).rgb * e.x + e.y);
  float k = exp(-dt * clamp(mean / b - 1.0, 0.0, 2.0));
  return vec4(vec3(k * top), top);
}
`;

/** Semi-Lagrangian advection with per-channel exponential fade. */
export const ADVECT = HEAD + BUDGET + /* glsl */ `
uniform sampler2D uVel, uSrc;
uniform vec2 uVelE, uSrcE;
uniform vec2 uStep;   // dt * (1/aspect, 1): velocity (height units/s) → uv offset
uniform vec4 uFade;   // per-channel decay factor this step
uniform float uCap;   // soft brightness cap so additive dye can't run away
uniform float uBudget, uDt;
void main() {
  vec2 v = ld(uVel, vUv, uVelE).xy;
  vec4 s = ld0(uSrc, vUv - v * uStep, uSrcE) * uFade * budget(uSrc, uSrcE, uBudget, uDt);
  s.rgb = softCap(s.rgb, uCap, uDt);
  outColor = st(s, uSrcE);
}
`;

/**
 * Second half of MacCormack: corrects the forward-advected field by half the error
 * of advecting it back, clamped to the source neighborhood so it stays stable.
 */
export const MACCORMACK = HEAD + BUDGET + /* glsl */ `
uniform sampler2D uVel, uSrc, uHat;
uniform vec2 uVelE, uSrcE, uSrcTexel, uStep;
uniform vec4 uFade;
uniform float uCap;
uniform float uBudget, uDt;
uniform float uSharp;  // 0.5 = full MacCormack; less lets soft materials blur
void main() {
  vec2 v = ld(uVel, vUv, uVelE).xy;
  vec2 back = vUv - v * uStep;
  vec4 hat = ld0(uHat, vUv, uSrcE);
  vec4 hatBack = ld0(uHat, vUv + v * uStep, uSrcE);
  vec4 r = hat + uSharp * (ld0(uSrc, vUv, uSrcE) - hatBack);
  vec2 c = (floor(back / uSrcTexel - 0.5) + 0.5) * uSrcTexel;
  vec4 a = ld0(uSrc, c, uSrcE);
  vec4 b = ld0(uSrc, c + vec2(uSrcTexel.x, 0.0), uSrcE);
  vec4 d = ld0(uSrc, c + vec2(0.0, uSrcTexel.y), uSrcE);
  vec4 e = ld0(uSrc, c + uSrcTexel, uSrcE);
  r = clamp(r, min(min(a, b), min(d, e)), max(max(a, b), max(d, e)));
  // Heat stays first-order (smooth): its glow is so bright that sharpened heat shreds
  // into visible pixel noise under strong shear.
  r.a = hat.a;
  r *= uFade * budget(uSrc, uSrcE, uBudget, uDt);
  r.rgb = softCap(r.rgb, uCap, uDt);
  outColor = st(max(r, 0.0), uSrcE);
}
`;

const NEIGHBORS = /* glsl */ `
uniform vec2 uTexel;
vec2 vL() { return vUv - vec2(uTexel.x, 0.0); }
vec2 vR() { return vUv + vec2(uTexel.x, 0.0); }
vec2 vB() { return vUv - vec2(0.0, uTexel.y); }
vec2 vT() { return vUv + vec2(0.0, uTexel.y); }
`;

export const CURL = HEAD + NEIGHBORS + /* glsl */ `
uniform sampler2D uVel;
uniform vec2 uVelE, uOutE;
void main() {
  float L = ld(uVel, vL(), uVelE).y, R = ld(uVel, vR(), uVelE).y;
  float B = ld(uVel, vB(), uVelE).x, T = ld(uVel, vT(), uVelE).x;
  outColor = st(vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0), uOutE);
}
`;

/**
 * All body forces in one pass: vorticity confinement, buoyancy of hot dye, weight of
 * dense dye, the gesture's global swirl, an animated turbulent field (curl of a
 * moving stream function, so it adds no divergence), and thickness (neighbor
 * averaging kills small eddies: thick liquids move in big slow masses).
 */
export const FORCES = HEAD + NEIGHBORS + /* glsl */ `
uniform sampler2D uVel, uCurl, uDye;
uniform vec2 uVelE, uCurlE, uDyeE;
uniform float uDt, uCurlK, uBuoy, uGrav, uSwirl, uTurb, uTime, uAspect, uThick, uResK, uGrid;
uniform vec2 uWind;
vec2 turbulence(vec2 q, float t) {
  // Stream function ψ = Σ sin(k·q + φ(t)); velocity = (∂ψ/∂y, -∂ψ/∂x).
  vec2 v = vec2(0.0);
  vec2 k1 = vec2(3.1, 1.7), k2 = vec2(-2.3, 4.6), k3 = vec2(7.9, -5.3), k4 = vec2(-11.0, -9.4);
  float a1 = cos(dot(k1, q) + t * 1.3), a2 = cos(dot(k2, q) - t * 1.7);
  float a3 = cos(dot(k3, q) + t * 2.9 + sin(t * 0.7) * 2.0), a4 = cos(dot(k4, q) - t * 4.1);
  v += vec2(k1.y, -k1.x) * a1 / 3.5;
  v += vec2(k2.y, -k2.x) * a2 / 5.1;
  v += vec2(k3.y, -k3.x) * a3 / 9.6 * 0.8;
  v += vec2(k4.y, -k4.x) * a4 / 14.5 * 0.6;
  return v;
}
void main() {
  vec2 vel = ld(uVel, vUv, uVelE).xy;
  float L = ld(uCurl, vL(), uCurlE).x, R = ld(uCurl, vR(), uCurlE).x;
  float B = ld(uCurl, vB(), uCurlE).x, T = ld(uCurl, vT(), uCurlE).x;
  float C = ld(uCurl, vUv, uCurlE).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4;
  f *= C * uCurlK * uResK;
  f.y *= -1.0;

  vec4 dye = ld(uDye, vUv, uDyeE);
  float dens = dot(max(dye.rgb, 0.0), vec3(0.3333));
  f.y += uBuoy * max(dye.a, 0.0) - uGrav * min(dens, 2.0);

  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  f += uSwirl * vec2(-q.y, q.x) * exp(-dot(q, q) * 2.5);
  vec2 turb = turbulence(q, uTime);
  // On a grid, motion snaps toward the axes.
  turb = mix(turb, abs(turb.x) > abs(turb.y) ? vec2(turb.x, 0.0) : vec2(0.0, turb.y), uGrid);
  f += uTurb * turb + uWind;

  vel += f * uDt;
  vec2 avg = 0.25 * (ld(uVel, vL(), uVelE).xy + ld(uVel, vR(), uVelE).xy + ld(uVel, vB(), uVelE).xy + ld(uVel, vT(), uVelE).xy);
  vel = mix(vel, avg, 1.0 - exp(-uThick * uDt));
  vel = clamp(vel, -8.0, 8.0);
  outColor = st(vec4(vel, 0.0, 1.0), uVelE);
}
`;

export const DIVERGENCE = HEAD + NEIGHBORS + /* glsl */ `
uniform sampler2D uVel;
uniform vec2 uVelE, uOutE;
void main() {
  vec2 C = ld(uVel, vUv, uVelE).xy;
  float L = ld(uVel, vL(), uVelE).x, R = ld(uVel, vR(), uVelE).x;
  float B = ld(uVel, vB(), uVelE).y, T = ld(uVel, vT(), uVelE).y;
  // Solid walls: mirror the normal velocity at the borders.
  if (vL().x < 0.0) L = -C.x;
  if (vR().x > 1.0) R = -C.x;
  if (vB().y < 0.0) B = -C.y;
  if (vT().y > 1.0) T = -C.y;
  outColor = st(vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0), uOutE);
}
`;

export const PRESSURE = HEAD + NEIGHBORS + /* glsl */ `
uniform sampler2D uP, uDiv;
uniform vec2 uPE, uDivE;
void main() {
  float L = ld(uP, vL(), uPE).x, R = ld(uP, vR(), uPE).x;
  float B = ld(uP, vB(), uPE).x, T = ld(uP, vT(), uPE).x;
  float d = ld(uDiv, vUv, uDivE).x;
  outColor = st(vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0), uPE);
}
`;

export const GRADIENT = HEAD + NEIGHBORS + /* glsl */ `
uniform sampler2D uP, uVel;
uniform vec2 uPE, uVelE;
void main() {
  float L = ld(uP, vL(), uPE).x, R = ld(uP, vR(), uPE).x;
  float B = ld(uP, vB(), uPE).x, T = ld(uP, vT(), uPE).x;
  vec2 v = ld(uVel, vUv, uVelE).xy - 0.5 * vec2(R - L, T - B);
  outColor = st(vec4(v, 0.0, 1.0), uVelE);
}
`;

/**
 * Instanced splats: one quad per splat, shaped in the fragment shader, added by
 * blending (in the RGBA8 fallback as a positive and a negative pass, see Fluid.splat).
 */
export const SPLAT_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec4 aPos;    // x, y (uv), rx, ry (height units)
layout(location = 1) in vec4 aDye;    // rgb, heat
layout(location = 2) in vec4 aForce;  // fx, fy, radial, rot
layout(location = 3) in vec4 aShape;  // star, points, square, hard
uniform float uAspect;
out vec2 vLocal;
out vec2 vUv;
flat out vec4 vPos;
flat out vec4 vDye;
flat out vec4 vForce;
flat out vec4 vShape;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  float ext = max(aPos.z, aPos.w) * (2.6 + aShape.x * 1.4);
  vLocal = corner * ext;
  vUv = aPos.xy + vLocal * vec2(1.0 / uAspect, 1.0);
  vPos = aPos; vDye = aDye; vForce = aForce; vShape = aShape;
  gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
}`;

export const SPLAT_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vLocal;
in vec2 vUv;
flat in vec4 vPos;
flat in vec4 vDye;
flat in vec4 vForce;
flat in vec4 vShape;
out vec4 outColor;
uniform int uMode;        // 0 = velocity, 1 = dye
uniform int uSign;        // 0: float targets; ±1: packed fallback, positive / negative part
uniform vec2 uE;
uniform float uSeed;
uniform float uGrain, uAspect;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}
void main() {
  float c = cos(vForce.w), s = sin(vForce.w);
  vec2 d = mat2(c, -s, s, c) * vLocal;   // into the splat's own axes
  d /= vPos.zw;
  float n = length(d);
  // Superellipse → squares for quantized materials.
  float q = mix(2.0, 9.0, vShape.z);
  float ns = pow(pow(abs(d.x), q) + pow(abs(d.y), q), 1.0 / q);
  n = mix(n, ns, clamp(vShape.z * 3.0, 0.0, 1.0));
  // Star: the radius swells along a few spikes.
  float th = atan(d.y, d.x);
  float spike = pow(abs(cos(th * vShape.y * 0.5)), 4.0);
  n /= mix(1.0, 0.3 + 1.25 * spike, vShape.x);
  float g = exp(-pow(n, mix(2.0, 5.0, vShape.w)));
  vec4 add;
  if (uMode == 0) {
    vec2 world = vLocal / max(vPos.z, vPos.w);
    add = vec4(vForce.xy * g + vForce.z * world * g, 0.0, 0.0);
  } else {
    // Textured materials inject clumpy, billowing dye rather than a smooth blob. The
    // pattern is fixed in screen space: per-splat noise would pile up as pixel noise
    // when an emitter fires every frame.
    vec2 np = vUv * vec2(uAspect, 1.0) * 9.0;
    float nz = vnoise(np) * 0.65 + vnoise(np * 2.3 + 5.1) * 0.35;
    add = vDye * g * (1.0 - uGrain * 0.6 * smoothstep(0.25, 0.75, nz));
  }
  if (g < 0.002) discard;
  if (uSign == 0) {
    outColor = add;
  } else {
    // Packed fallback: the signed part of the change in stored units, stochastically
    // rounded to 8 bits so small additions still count on average.
    vec4 q = max(add * float(uSign), 0.0) / uE.x * 255.0;
    float h = fract(sin(dot(gl_FragCoord.xy + uSeed, vec2(12.9898, 78.233))) * 43758.5453);
    outColor = floor(q + h) / 255.0;
  }
}`;

/** Background CPPN aura is generated in aura.ts; this samples it. */

/**
 * Scene: dye as light (plus the blackbody glow of heat), wet specular glints for
 * non-emissive materials, the aura behind everything, and a storm flash.
 */
export const SCENE = HEAD + RAMP + /* glsl */ `
uniform sampler2D uDye, uAura;
uniform vec2 uDyeE, uDyeTexel;
uniform float uEmissive, uGloss, uAuraAmt, uHeatGlow, uTime, uFlash, uGain, uGrid, uAspect, uShade;
void main() {
  vec4 d = max(ld(uDye, vUv, uDyeE), 0.0);
  if (uGrid > 0.01) {
    // Quantized materials read as a matrix of lit cells (an LED wall).
    vec2 cells = vec2(floor(36.0 * uAspect), 36.0);
    vec2 cell = (floor(vUv * cells) + 0.5) / cells;
    vec4 cd = max(ld(uDye, cell, uDyeE), 0.0);
    vec2 f = abs(fract(vUv * cells) - 0.5);
    float m = 1.0 - smoothstep(0.32, 0.4, max(f.x, f.y));
    d = mix(d, cd * m * 1.25, uGrid * 0.85);
  }
  vec3 col = d.rgb * uGain;
  // Heat glows through the palette: hottest = highlight stop, cooling → shadow.
  float h = d.a;
  col += ramp(0.3 + 0.7 * (1.0 - exp(-h * 2.0))) * h * uHeatGlow;

  // Treat dye density as a height field and light it: thick ink gets dull glints.
  if (uGloss > 0.01) {
    vec2 t = uDyeTexel * 1.5;
    float hL = lum(ld(uDye, vUv - vec2(t.x, 0.0), uDyeE).rgb), hR = lum(ld(uDye, vUv + vec2(t.x, 0.0), uDyeE).rgb);
    float hB = lum(ld(uDye, vUv - vec2(0.0, t.y), uDyeE).rgb), hT = lum(ld(uDye, vUv + vec2(0.0, t.y), uDyeE).rgb);
    // Relative gradient: faint ink has ridges too.
    float k = 5.0 / (0.06 + lum(d.rgb));
    vec3 n = normalize(vec3((hL - hR) * k, (hB - hT) * k, 1.0));
    vec3 l = normalize(vec3(-0.4, 0.7, 0.6));
    float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
    float body = smoothstep(0.01, 0.15, lum(d.rgb));
    col += (ramp(0.9) + 0.08) * spec * uGloss * body * 1.6;
    col *= mix(1.0, 0.65 + 0.5 * n.z * dot(n, l), uGloss * 0.6);
  }

  if (uShade > 0.01) {
    // Light from above: march toward it through the dye; dense ink shadows itself, so
    // heavy materials read as lit, massive volumes (bright crowns, dark bellies).
    vec2 stepUv = vec2(0.18 / uAspect, 1.0) * 0.022;
    float acc = 0.0;
    for (int i = 1; i <= 8; i++) acc += lum(max(textureLod(uDye, vUv + stepUv * float(i), 1.5).rgb * uDyeE.x + uDyeE.y, 0.0));
    float shadow = exp(-acc * 0.45);
    col *= mix(1.0, 0.35 + 1.2 * shadow, uShade);
  }
  vec3 aura = texture(uAura, vUv).rgb * uAuraAmt;
  col += aura * (1.0 - smoothstep(0.0, 0.6, lum(col)));
  col += ramp(1.0) * uFlash;
  outColor = vec4(col, 1.0);
}
`;

/** Bloom: soft-knee bright pass, then a dual-filter (Kawase) down/up chain. */
export const BLOOM_PRE = HEAD + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThreshold, uKnee;
void main() {
  vec3 c = texture(uSrc, vUv).rgb * 0.25;
  c += texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 0.1875;
  c += texture(uSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb * 0.1875;
  c += texture(uSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb * 0.1875;
  c += texture(uSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb * 0.1875;
  float br = max(max(c.r, c.g), c.b);
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-4);
  c *= max(rq, br - uThreshold) / max(br, 1e-4);
  outColor = vec4(min(c, vec3(40.0)), 1.0);
}
`;

export const BLOOM_DOWN = HEAD + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uTexel;
void main() {
  vec3 c = texture(uSrc, vUv).rgb * 4.0;
  c += texture(uSrc, vUv - uTexel).rgb;
  c += texture(uSrc, vUv + uTexel).rgb;
  c += texture(uSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb;
  c += texture(uSrc, vUv - vec2(uTexel.x, -uTexel.y)).rgb;
  outColor = vec4(c / 8.0, 1.0);
}
`;

export const BLOOM_UP = HEAD + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uTexel;
void main() {
  vec2 t = uTexel;
  vec3 c = texture(uSrc, vUv + vec2(-2.0 * t.x, 0.0)).rgb;
  c += texture(uSrc, vUv + vec2(-t.x, t.y)).rgb * 2.0;
  c += texture(uSrc, vUv + vec2(0.0, 2.0 * t.y)).rgb;
  c += texture(uSrc, vUv + vec2(t.x, t.y)).rgb * 2.0;
  c += texture(uSrc, vUv + vec2(2.0 * t.x, 0.0)).rgb;
  c += texture(uSrc, vUv + vec2(t.x, -t.y)).rgb * 2.0;
  c += texture(uSrc, vUv + vec2(0.0, -2.0 * t.y)).rgb;
  c += texture(uSrc, vUv + vec2(-t.x, -t.y)).rgb * 2.0;
  outColor = vec4(c / 12.0, 1.0);
}
`;

/**
 * Final: heat shimmer, chromatic aberration, bloom, ACES-ish filmic curve, grading
 * through the palette, contrast, vignette, grain, sRGB out.
 */
export const FINAL = HEAD + RAMP + /* glsl */ `
uniform sampler2D uScene, uBloom, uDye;
uniform vec2 uDyeE, uRes;
uniform float uTime, uBloomAmt, uExposure, uShimmer, uAberr, uGrade, uContrast, uGrain, uVignette, uAspect;
vec3 aces(vec3 x) {
  // Narkowicz's fit of the ACES filmic curve.
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec2 uv = vUv;
  if (uShimmer > 0.001) {
    // Heat haze: wobble the image above hot dye.
    float heat = ld(uDye, uv - vec2(0.0, 0.03), uDyeE).a;
    vec2 w = vec2(sin(uv.y * 90.0 - uTime * 11.0 + sin(uv.x * 23.0) * 2.0), cos(uv.x * 70.0 + uTime * 9.0));
    uv += w * min(heat, 1.5) * uShimmer * 0.0022;
  }
  vec3 col;
  if (uAberr > 0.001) {
    vec2 dir = (uv - 0.5) * uAberr * 0.012;
    col = vec3(texture(uScene, uv + dir).r, texture(uScene, uv).g, texture(uScene, uv - dir).b);
  } else {
    col = texture(uScene, uv).rgb;
  }
  col += texture(uBloom, uv).rgb * uBloomAmt;
  col = aces(col * uExposure);

  // Grade: pull colors toward the palette at their own brightness.
  float l = lum(col);
  vec3 g = ramp(pow(l, 0.8));
  // (The luminance match is capped so dark saturated stops don't turn electric.)
  col = mix(col, g * (0.35 + 0.65 * min(l / max(lum(g), 0.02), 3.0)), uGrade * smoothstep(0.0, 0.08, l + 0.02));
  col = mix(col, g, uGrade * 0.35);

  // Contrast (in perceptual space): low contrast lifts blacks and dims whites into a
  // milky haze; high contrast crushes the blacks and lets highlights glint.
  vec3 p = sqrt(max(col, 0.0));
  p = mix(sqrt(ramp(0.5)) * 0.7, p, min(1.0, 0.6 + 0.75 * uContrast));
  vec3 s = p * p * (3.0 - 2.0 * clamp(p, 0.0, 1.0));
  p = mix(p, s, uContrast * 0.7);
  col = p * p;

  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  col *= mix(1.0, smoothstep(1.25, 0.25, length(q)), uVignette);

  vec3 o = toSrgb(clamp(col, 0.0, 1.0));
  float n = hash12(vUv * uRes + fract(uTime * 7.31) * 113.0) - 0.5;
  o += n * (uGrain * 0.12 + 1.0 / 255.0);
  outColor = vec4(o, 1.0);
}
`;
