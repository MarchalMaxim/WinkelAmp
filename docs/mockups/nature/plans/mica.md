# Mica (`mica`): build plan

Spec: SYNTHESIS.md "8. Mica" over essay 3 §1. This plan fixes every number; where it differs from the essay, it says why.
Files: `lab/tools/mica.js`, `tests/mica.test.ts`, this file. Nothing else (the id is already in `TOOL_IDS` and `lab/tags.json`).

## 1. What the viewer sees

Each note flashes a whole fixed scatter of thin, needle-pointed shards across the frame in one step, every shard of that note lying at
the same angle (pitch class × 15°), and then the scatter sinks from silver to cold violet and is gone in about half a second. Nothing
ever moves by one pixel: a repeat lights the identical constellation again, an octave lights a parallel one, a chord lights two or three
crossed hatchings. The word is **rigid** (and sharp): granite in low sun.

## 2. Geometry and numbers

All in canvas px, W 1280, H 720. `deg = Math.PI / 180`.

**Per-pitch table (built lazily, cached by `m`, cleared only in `reset`).** Generator: Ivory's mulberry, inline:
`const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };`
Seed `R = rng(m * 7919 + 4111)`. Gaussian `gauss = () => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R())` (always
two draws, so the stream never branches). Draw in exactly this order, so a pitch is the same stone whatever the knobs:
1. 34 clumps, `c = 0..33`: `cu[c] = R()`, `cz[c] = gauss()`.
2. 400 shards, `i = 0..399`: `gx[i] = gauss()`, `gy[i] = gauss()`, `su[i] = R()`. Shard `i` belongs to clump `floor(i / 12)`.
Store as Float64Arrays. Never use `x.rnd` or `Math.random` anywhere in the file (icons use `ICON.rng`, which is fine).

**Shapes from the table and the knobs** (`N = round(flecks)`, `S = round(size)`, `SP = round(spread)`), for shards `i < N`:
- pitch height `yP = 660 - 600 * (clamp(m, 21, 108) - 21) / 87` (A0 at 660, C8 at 60). A fixed piano map, not `x.pitch01`.
- centre `cx = 40 + 1200 * cu[c] + 16 * gx[i]`; `cy = fold(yP + SP * cz[c] + 16 * gy[i])`, where `fold` reflects into [16, 704]:
  `y < 16 ? 32 - y : y > 704 ? 1408 - y : y`, then clamps to [16, 704].
- angle `th = (m % 12) * 15 * deg`, the same for all shards of the note. `d = (cos th, sin th)`, `n = (-sin th, cos th)`.
  C is horizontal, F# vertical; 12 steps cover 0..165°, all distinct since a rhombus repeats at 180°.
- length `L = 10 * Math.pow(S / 10, su[i] ** 3)` (power law, 10 px up to S; at S 56 and N 192 the 12th biggest is about 42 px).
- width `w = Math.max(1.5, L / 6.5)`: aspect at least 6.5:1 everywhere (SYNTHESIS: at least 6:1). Area `L * w / 2`.
- rhombus, pointed at both ends: `moveTo(c + d*L/2)`, `lineTo(c + n*w/2)`, `lineTo(c - d*L/2)`, `lineTo(c - n*w/2)`, `closePath()`.
Measured: N 192, S 56: about 6,350 px² a note (0.69 % of the frame); N 400, S 90: about 24,600 px² (2.7 %).

**Paths, cached** in a `Map` keyed `${m}|${N}|${SP}|${S}`; if the map passes 300 entries, clear it (knobs moved). For one key:
sort shard indices `0..N-1` by `L` descending (tie: lower index first), then build four `Path2D` from that order:
`big` = first `ceil(0.3N)`, `p40` = first `ceil(0.4N)`, `p70` = first `ceil(0.7N)`, `p100` = all N. Store each path's area too.
Lowering `flecks` keeps the first shards in generation order, so fewer flakes is the same stone with clumps missing.

**Velocity** (P6: it shapes how much, never whether). Once per `CHORDS` array (cache by array and length): all note velocities of
CHORDS sorted; `p10 = vs[floor(0.1 * (n - 1))]`, `p90 = vs[floor(0.9 * (n - 1))]`. `u = p90 - p10 < 1 ? 1 : clamp((v - p10) / (p90 - p10), 0, 1)`
(the guard covers one note, an empty array, and all-equal velocities). Prefix: `u < 1/3 → p40`, `u < 2/3 → p70`, else `p100`. A soft note
is the same stone seen less and always has its biggest shards. Velocity does not change brightness (the colour law divides `P` out).

**Chord:** every note of the chord is its own set at its own angle and height, drawn in the same step. **Repeat:** same pitch, same path
object, full strike again (a new instance; the older one is simply drawn under it). **Run:** each attack is a new set; earlier sets
of the run are still sinking underneath, so a scale is a turning hatching.

**Stateless from CHORDS.** Kept between frames: only the per-pitch tables, the path cache and the p10/p90 cache, all pure functions of
(m, knobs, CHORDS). `onChord` is empty. `reset` clears the three caches. Age is always `t = x.t - cs[j].t`.

## 3. Time

Paste the SNAP block (yes, pasted) and use it with a **custom preset object** (SNAP's `preset()` returns an object as it is):
`const MICA = { wf: 1, wb: 0.5, wt: 0, hb0: 0.16, L: 0.5, o: 0 };`
`e = SNAP.env(t, { v: n.v, m: n.m, d: n.d, a: n.amount }, { preset: MICA, ring, picks: !!x.picked })`. If `e.E <= 0`, skip the set.
So `L = 0.5 * ring` s, the body's half-life is `0.16 * ring * 2^((60 - m) / 24)` (bass rings longer), and a note written shorter than
0.15 s below m 89 is damped (P11), all by SNAP. `SNAP.size` is not used: nothing in Mica grows or moves.

**Colour law (all through `lighten`, alpha 1, real target colours).** With `a = n.amount ?? 1`, `G = SNAP.gain(a)`:
```
F = Math.min(1, e.flash * G) * SNAP.core(a)        // 1 on the attack step and the next, then halves every 60 ms
K = Math.min(1, (e.E / e.P) * (G + 0.5) / 0.5)     // 1 through the flash, then body * cut * damper
rgb[i] = Math.round((BODY[i] + (STRIKE[i] - BODY[i]) * F) * K)
```
`tone(g, rgb)` as in SYNTHESIS (k = 1): `globalCompositeOperation = 'lighten'`, `globalAlpha = 1`, `fillStyle = rgb(...)`.
Palettes (`colour` knob, index `round(colour)`), STRIKE then BODY:
- 0 silver over cold violet: STRIKE (222,226,238), BODY (96,90,112). BODY is the essay's (120,112,140) × 0.8, so the body sits at about
  41 % of the strike's luminance (P4) with a live channel of 112.
- 1 bone over feldspar rose: STRIKE (236,226,208), BODY (128,82,86).
- 2 pyrite gold over umber: STRIKE (236,196,110), BODY (116,76,40).

Simulated on the 60 Hz canvas (fade 0.88 + burn, `lighten` target; palette 0), on-screen value by age:

| case | 0.00 s | 0.10 s | 0.20 s | 0.30 s | 0.40 s | gone (max < 6) |
|---|---|---|---|---|---|---|
| m 60, ring 1 | 222,226,238 | 154,153,170 | 83,81,95 | 37,35,43 | 20,19,23 | 0.48 s |
| m 36, ring 1 | same | 154,153,170 | 107,103,122 | 62,59,72 | 44,41,51 | 0.53 s |
| m 84, ring 1 | same | 154,153,170 | 70,68,79 | 22,19,25 | 6,6,7 | 0.42 s |
| m 60, ring 3 | same | 154,153,170 | 114,110,130 | 75,71,87 | 58,54,67 | 1.47 s |

**Why tone and not alpha, against SYNTHESIS's "try alpha first":** SYNTHESIS liked that the alpha path shows the body for only about
0.35 s. This curve gives 0.42 to 0.53 s at `ring` 1, nearly that, but it lands exactly on both canvases, and `ring` 3 gets a real ash for
1.5 s, which the alpha path loses to the burn. So the snappy look is kept and the knob works. The alpha path is the fallback (section 8).

**Attack step:** the whole prefix lights at STRIKE in the attack's own step (P1) and holds 2 steps (SNAP's H, P2). **Fall:** the flash
term sinks to BODY in about 0.15 s; the canvas fade (0.09 s half-life) is slower than the flash, and `lighten` keeps the higher of the
two, so the screen shows the canvas fade until it meets the target. **Gone:** `e.E` is 0 from `L` on (SNAP's smoothstep cut over its last
0.1 s), the set is skipped, and the last few levels fade in 2 steps. **No motion without a note:** positions never change; between attacks
only the fill colour of existing paths falls. No travelling fronts, no staging, nothing at the end of a phrase.

**Bone budget (P12, 6 % = 55,296 px²).** Striking sets are those with `t < SNAP.H`. `crowded = strikeSets > 4 || sum(prefix areas) > 55296`.
When crowded, a striking set is filled twice: its prefix path at BODY (F = 0, K = 1), then its `big` path at STRIKE. Otherwise once.

## 4. Knobs (5 + presence)

| key | label | min | max | step | default | less |
|---|---|---|---|---|---|---|
| `flecks` | how many flakes | 40 | 400 | 1 | 192 | 48 |
| `spread` | how far from its height | 40 | 400 | 1 | 120 | |
| `size` | how big the biggest flake | 16 | 90 | 1 | 56 | |
| `ring` | how long it stays | 0.25 | 3 | | 1 | 0.5 |
| `colour` | which mineral | 0 | 2 | 1 | 0 | |
| `presence` | how present | 0 | 1 | | 1 | `leads: true`, never read |

No drives. Hints:
- flecks: 'How many flakes each note owns. Left: a few big shards. Right: the frame is thick with glitter.'
- spread: 'How far a note\'s flakes scatter from the height of its pitch. Left: a note glints in a band at its pitch. Right: it glints all over the frame.'
- size: 'How long the biggest flake is. Left: fine sparkle. Right: real splinters you could cut on.'
- ring: 'How long the flakes stay after the glint. Left: a glint and gone. Right: they stay as a dim ash for over a second.'
- colour: 'Which stone. Left: silver over cold violet. Middle: bone over feldspar rose. Right: pyrite gold over umber.'
- presence: 'How much you see: how many flakes each note lights and how long they stay. Left: a few big shards, quickly gone. Right: the whole stone. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.'

Icons (40×26; touch `ICON` only inside the icon functions, never at load, since tests pass a stub):
- flecks: `r = ICON.rng(11)`; `3 + Math.round(v * 22)` strokes at 30°, length 3 to 9, at random spots, `ICON.line`.
- spread: `r = ICON.rng(12)`; 10 strokes at 30°, x evenly across, y = 13 + (r() - 0.5) * (2 + v * 20).
- size: one filled rhombus at 30°, length `6 + v * 28`, width length / 6.5, `ICON.ink`.
- ring: `ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.violet)`.
- colour: `ICON.palette(g, [strike css, body css] of palette Math.round(v * 2), w, h)`.
- presence: `ICON.much(g, v, w, h)`.

Entry: `id: 'mica', name: 'Mica', tag: 'new'`, blurb: 'Granite in low sun. Each pitch owns a fixed scatter of thin shards, all lying at one
angle (pitch class × 15°: an octave is parallel, a semitone 15° off). A note flashes its whole set silver in one step and lets it sink to
violet. Nothing ever moves; a repeat is the same constellation again.'

## 5. Draw order and cost

`chordAt(cs, t)` exactly as in `handover.js` (binary search). Per frame:
1. `cs = typeof CHORDS !== 'undefined' ? CHORDS : []`; `i = chordAt(cs, x.t)`; if `i < 0` return.
2. Read knobs; `ring = x.p('ring')`; `Lmax = 0.5 * ring`.
3. Collect instances newest first: `for (j = i; j >= 0 && x.t - cs[j].t < Lmax; j--)`, each note of `cs[j]` with `t = x.t - cs[j].t`;
   stop at 48 instances.
4. For each: env, F, K, prefix path (section 2). Drop `E <= 0`. Work out `crowded`.
5. If none is left, return without touching `g`. Else `g.save()`; then oldest first: `tone(g, rgb)`; `g.fill(path)` (twice when crowded
   and striking, section 3); `g.restore()` (back to `source-over`).
No sprites, no offscreen canvases, no `document`. Cost: 1 fill per live set (2 on a crowded strike); about 2 to 12 fills typical, 48 at
most; each fill is up to 400 rhombi. Table 400 × 3 + 34 × 2 doubles per pitch (about 10 KB), paths built once per pitch and knob setting.

## 6. Tests (`tests/mica.test.ts`)

Pattern from `tests/flee-snap-switch.test.ts`: `instantiate('mica', SRC, { icon: { ink: '#fff', gauge() {} }, chords: CHORDS })` with its
recording proxy for `g`. **Do not use `loadCatalogue()`**: the nine other new widgets may not exist yet. Before loading, set
`globalThis.Path2D` to a stub class that records `['M'|'L'|'Z', x, y]` into `this.ops`, and `G.window = { NOTES }`; restore both after.
`x.rnd` and `Math.random` throw. Song: 40 notes `[0.5 + i * 0.21, 0.7 + i * 0.21, 60 + ((i * 7) % 24), 40 + ((i * 13) % 71)]`, plus a
6-note chord at 9.0 s and a lone note at 12.0 s. Assert:
1. Params: keys exactly `['flecks','spread','size','ring','colour','presence']`; defaults and ranges as section 4; `flecks.less === 48`,
   `ring.less === 0.5`; `presence.leads === true`; every hint has 'Left:' and 'Right:'; every icon is a function.
2. On each attack step there is at least one `fill(`, `globalCompositeOperation=lighten` and `globalAlpha=1.000` are set before it, and a
   fillStyle of `rgb(222,226,238)`; every `save()` is matched by a `restore()` in the same frame.
3. Geometry: for several pitches, every shard (M, L, L, L, Z) has its long axis at `(m % 12) * 15°` mod 180 within 1e-6, and
   length / width ≥ 6. Two pitches an octave apart: same angle, different mean height.
4. Nothing moves: between two attacks, every filled path is the same object with the same ops; per instance the fillStyle channels
   never rise. From 12.5 s on (lone note + 0.5 s), no `fill(` at all.
5. Seek: a fresh instance, `reset`, first frame straight at a chord time 5 s in: the path ops for that pitch equal the ones in the full play.
6. Velocity: of two notes on one pitch, the soft one's path is a prefix of the loud one's and holds its biggest shard; `ceil(0.4N)`
   and N shards at defaults. A one-note CHORDS does not throw and draws `p100`.
7. Crowded: on the 6-note chord's attack step, strike-coloured fills are only on paths with `ceil(0.3N)` shards.
8. Determinism: two full plays give the same sha1 of the log (including path ops).
Run `npx vitest run tests/mica.test.ts tests/snap-envelope.test.ts`; both must pass.

**Pasting SNAP:** write the file with a single line `// @@SNAP@@` where the block goes (first thing inside the IIFE), then run:
`node -e "const f=require('fs');const s=f.readFileSync('lab/snap/envelope.js','utf8');const a=s.indexOf('// SNAP v1 begin'),b=s.indexOf('// SNAP v1 end')+14;const p='lab/tools/mica.js';f.writeFileSync(p,f.readFileSync(p,'utf8').replace('// @@SNAP@@',()=>s.slice(a,b)))"`
LF line endings only. Never retype the block.

## 7. Judge moments

On the 60 Hz video, never the live lab, and on the software canvas for any bit proof (GPU paths are not bit-stable).
- Liebesleid picks, 172 to 244 s: single picked notes and repeats. Does a repeat read as the same constellation coming back?
- Rach 2, 0 to 170 s: the bell chords and repeated chords: crossed hatchings, and whether a fast repeat still counts.
- Winter Wind: a long fast passage. The eye judge's risk: attractive scatter with no form, or a turning?

**The one question for a still:** are the shards at least 6:1 with every shard of one note at one angle (pitch class × 15°), so that
the interval reads as an angle; and after a seek, does the same pitch give the same stone?

## 8. Risks and fallbacks

- **Scatter without form** (the eye judge's named risk): judge it over a long passage. The fallback SYNTHESIS names is essay 8's contour
  ribbon (a fixed tilt field, one contour per note), later and as its own widget.
- **Body too heavy or too long** next to the 0.35 s the alpha path gave: fall back to SYNTHESIS's first suggestion, drawing through
  `SNAP.alpha(E(t), E(t - dt))` with preset `'piano'`, `source-over`, colour `SNAP.hot(BODY_essay, t)`, and keep `tone` only for `ring` above 1.
- **Angle not legible on small shards** at 15° steps: raise the width divisor from 6.5 to 8, or the minimum length from 10 to 14.
- **Fast repeats blur together:** at 12 a second the old set is still near 154 of 222 when the new one strikes, about a 30 % dip.
  If repeats stop counting on Rach 2, shorten `hb0` to 0.12.
- **Thin tips** settle lower on partly covered pixels under `lighten` (SYNTHESIS: about `c / (0.12 + 0.88c)`). Accepted: the points are
  the sharpness, and the 1.5 px body of each shard holds.
- **Clutter in big chords:** the bone budget handles brightness, but at max `flecks` and `size` a 10-note chord covers about 27 %.
  If that reads as noise, cap at 6 sets per attack (loudest first).

## After review

- Crowding is now decided per chord (more than 4 notes, or the summed prefix area over the 6 % budget) and holds for the chord's whole life, not just the 33 ms hold. A crowded set draws its prefix at the body colour (F = 0) and only the biggest 30 % at the full colour, on every frame, so the small shards no longer flash silver one step after the attack.
- The 48-instance cap is gone. Sets whose brightest channel is under 6 (the 8-bit floor) are skipped, and above 64 live sets the dimmest are dropped first, so ash fades out instead of popping.
- Tests: a whole-life check on the 6-note chord (no full-prefix fill above the body; no path brightens) and a dense-texture check at ring 3.
