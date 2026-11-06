# Cut (`cut`): build plan

Spec: `docs/mockups/nature/essays/8-sand-and-dust.md` §4, overridden by `SYNTHESIS.md` §10. Where this plan states a number, use it as written.
Files: `lab/tools/cut.js`, `tests/cut.test.ts`. `cut` is already in `TOOL_IDS` (lab/index.html:405). Do not touch anything else.

## 1. What the viewer sees

Each note stands a flat slab with exact straight faces, struck with a bone line on its top and left faces. Then nothing moves: only
the next attack takes one step off every slab on screen at once, so the corners go first, then the edges, then the faces, until a
slab is a loose patch of sugar and is gone. A still frame is a history read by edge, from knife-edged to crumbled: **rigid turning fuzzy**.

## 2. Geometry and numbers (canvas px, W 1280, H 720)

**Skeleton: handover's, not squares-snap's.** `onChord() {}` stays empty; everything is drawn in `frame` from `CHORDS` and `x.t`; the only
state is caches. Never call `x.rnd` (nothing here is random per frame) and never `Math.random`. Copy handover's `chordAt`.
From squares-snap take only the file header style, the SNAP paste and the knob style.

**Attack index.** `cs = typeof CHORDS !== 'undefined' ? CHORDS : []`, `i = chordAt(cs, x.t)`; if `i < 0` draw nothing. One chord = one attack
= one erosion step (CHORDS already groups onsets within 40 ms).

**Which slabs live.** Walk `j = i, i-1, …, max(0, i - steps)`. Stop (and drop `j` and everything older) when `j < i` and
`cs[j+1].t - cs[j].t > goneBy`: a slab that already dimmed through a silence never comes back. For each live `j`, `k = i - j`,
stage `s = k === 0 ? 0 : Math.min(8, Math.ceil(8 * k / steps))`. Gone when `k > steps` (it just isn't drawn; that only happens on an attack).
With `steps` 8, `s = k`; with 2, stages 0, 4, 8; above 8 some attacks leave a slab's stage unchanged (known trade, 9 stages are baked).
Every note of chord `j` is one slab. Cap: collect newest first, at most 48 slabs; drop the oldest beyond that.

**Per-pitch hash** (fixed, so a pitch looks the same after a seek):
```js
const hash = (m) => { let h = Math.imul(m + 1, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; };
```
`a = hash(m) % 4` (aspect), `fx = (hash(m) >>> 2) & 1 ? -1 : 1`, `fy = (hash(m) >>> 3) & 1 ? -1 : 1` (sprite flips),
`row = (hash(m) >>> 4) % 5`, `jit = ((hash(m) >>> 8) % 41) - 20`.

**Velocity, normalised** (SYNTHESIS): once per `CHORDS` array (cache on the array reference and its length), sort every `n.v`,
`p10 = vs[Math.floor(0.1 * (N - 1))]`, `p90 = vs[Math.floor(0.9 * (N - 1))]`. `u = clamp((v - p10) / (p90 - p10), 0, 1)`;
if `N < 2` or `p90 - p10 < 1`, `u = 0.6`. On picks `v` already carries the amount; nothing else changes for `x.picked` (every slab is ≥ 24 px, so every note lands).

**Shape.** Aspects `A = [1.0, 1.4, 2.0, 0.7]` (width / height). `w = (60 + 160 * u) * size`, `h = Math.min(w / A[a], 0.9 * H)`.
**Place: pitch is x.** `cx = (0.06 + 0.88 * clamp((m - 21) / 87, 0, 1)) * W` (inline; do not rely on `x.pitch01`).
`cy = H * (0.2 + 0.15 * row) + jit` (rows at 144, 252, 360, 468, 576).
**Repeat (Ivory's twin rule: the same pitch stands beside the earlier one).** `o` = number of chords `j'` in `[max(0, j - steps), j - 1]`
whose notes include `m`, looking back from `j - 1` and stopping at the first gap `cs[j'+1].t - cs[j'].t > goneBy` (same rule as the walk, so a twin that already died is not counted). If `o > 0`: `c = ((o - 1) % 4) + 1`, `side = c % 2 ? 1 : -1`, `cx += side * 0.16 * w * Math.ceil(c / 2)`,
`cy -= 0.12 * h * Math.ceil(c / 2)`. The old slab drops a stage because a new attack happened; nothing else is needed.
Clamp: `cx` to `[w/2 + 8, W - w/2 - 8]` (centre `W/2` if `w > W - 16`), `cy` likewise with `h` and `H`.
Rect: `x0 = Math.round(cx - w/2)`, `y0 = Math.round(cy - h/2)`, `w = Math.round(w)`, `h = Math.round(h)` (whole pixels, knife edges).

**Erosion masks, baked (seeded by aspect, not by note).** Sprite size, long side 256: `A ≥ 1`: `sw = 256, sh = Math.round(256 / A)`;
`A < 1`: `sh = 256, sw = Math.round(256 * A)` → 256×256, 256×183, 256×128, 179×256. Grain cell `G = Math.round(2 + 6 * grainQ)` sprite px,
`grainQ = Math.round(grain * 10) / 10` (default 0.4 → G 4). Cells `nx = ceil(sw/G)`, `ny = ceil(sh/G)`; centre `(cx, cy) = ((ix+0.5)G, (iy+0.5)G)`
clipped to the sprite; `mh = min(sw, sh) / 2`.
```
dE = min(cx, sw-cx, cy, sh-cy) / mh                       // 0 on a face edge, 1 in the middle
dC = min(1, min over the 4 corners of hypot(cx-X, cy-Y) / mh)
hold  = 0.35*dC + 0.65*dE + 0.15*(n1 - 0.5)               // corners < edges < faces
loose = n2                                                // n1, n2: mulberry32(9173 + 101*a + 1000*G), two draws per cell, iy outer, ix inner
```
Sort cells by `hold` (ties by index); `r = rank / cellCount`. Cell is kept at stage `s` iff `r >= Q[s] && loose >= R[s]`:
`Q = [0, 0.03, 0.08, 0.15, 0.24, 0.35, 0.47, 0.60, 0.72]`, `R = [0, 0, 0, 0, 0, 0.04, 0.10, 0.18, 0.30]` (both non-decreasing, so stages nest:
a grain once gone never returns). Store `last[cell]` = highest kept stage. Stage 1 clips the four corners (3 % of cells), 2 to 4 round them and
start the edges, 5 to 8 eat the faces and loosen the inside; stage 8 keeps about 20 %. Seeded per aspect only; the flips give 4 looks per aspect.

**State kept:** the velocity cache, the cell tables per `G` (`last` per aspect), the sprite canvases per `(G, wetQ)` key. Nothing about notes.

## 3. Time

**Colour.** `wet` 0..1, three stops, piecewise linear: sand `(206,184,140)` at 0, wet ochre `(150,104,50)` at **0.7 (default)**, dark red
`(124,22,22)` at 1. `wetQ = Math.round(wet * 20) / 20` for baking. Call it `C`.
Stage tone factor `F = [1, 0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60]`; silence level factor `LV = [1, 0.55, 0.30]`.
Body colour of stage `s`, level `l`: `round(C * F[s] * LV[l])`. At default: stage 0 `(150,104,50)`, stage 4 `(120,83,40)`, stage 8 `(90,62,30)`;
dark red stage 8 `(74,13,13)`; every live channel ≥ 60 at level 0.

**The tone rule, for every body.** Paste SYNTHESIS's `tone(g, rgb, k)` outside the SNAP markers. All drawing in `frame` is
`globalCompositeOperation = 'lighten'`, `globalAlpha = 1`, inside one `g.save()`/`g.restore()`. Sprites are baked **opaque on black**
(every pixel alpha 255, removed grains RGB 0), so `lighten` with black changes nothing and grains hold exactly. No `SNAP.alpha`, no `settles`.

**Attack step and hold** (newest chord only, `age = x.t - cs[i].t`, `k = 0`; stage 0 is a plain `fillRect`, no sprite):
- `age < SNAP.H` (the two hold steps): fill at the hold tone `Hc = round(C + 0.4 * (BONE - C))`, default `(184,153,113)`.
- after: fill at the stage-0 body `C * F[0] * LV[l]`, default `(150,104,50)`.
- bone line, while `SNAP.flash(age) > 0.04` (until about 0.31 s): `tone(g, SNAP.BONE, SNAP.flash(age))`, then
  `fillRect(x0, y0, w, 5)` and `fillRect(x0, y0, 5, h)` (top face and left face, 5 px).

**Fall.** `lighten` cannot fall faster than the canvas does (×0.88 plus about 3 levels of burn a step). So: the bone line follows the canvas
fade, not the 0.06 s half-life, and is gone by about 0.3 s; the hold tone settles onto the body in 5 to 8 steps; grains removed by an attack,
and the whole slab that passes `steps`, ghost out over about 0.25 s. All three start on an attack step, so they are the attack's own change
of state, not motion between notes. Judge stills ≥ 0.35 s after an attack.

**Between notes nothing changes.** Same `i` → same slabs, same stages, same tones, same rects: frame output identical from 0.31 s after an
attack until the next one (or until silence). No travelling front, no shrink, no drift, no end-of-phrase staging.

**Silence** (`goneBy`): `sig = x.t - cs[i].t - goneBy`. Level `l = sig < 0 ? 0 : sig < 0.25 ? 1 : sig < 0.5 ? 2 : 3`; at 3 draw nothing.
Each step down settles through the canvas fade in about 5 steps, so it reads as a quiet dimming, then the canvas takes the rest.

**SNAP.** Paste the block between `// SNAP v1 begin` and `// SNAP v1 end` from `lab/snap/envelope.js` byte for byte, at the top of the IIFE,
**programmatically** (a short node script that slices between the markers and writes LF), never retyped. Used: `SNAP.flash`, `SNAP.H`, `SNAP.BONE`.
Not used: `env`, `alpha`, `settles`, presets (the body is a held tone, not an envelope).

## 4. Knobs (5 plus presence; keys in this order)

| key | label | min | max | step | value | less | icon |
|---|---|---|---|---|---|---|---|
| `steps` | how many notes a slab survives | 2 | 16 | 1 | 8 | 2 | `ICON.of.count(16, ICON.gold)` |
| `size` | how big | 0.4 | 2 | | 1 | 0.7 | `ICON.of.size('square', ICON.gold)` |
| `grain` | how coarse the crumbs | 0 | 1 | | 0.4 | | `(g,v,w,h) => ICON.dots(g, 22 - v * 14, w, h, { seed: 3, r: 0.7 + v * 2, col: ICON.gold })` |
| `goneBy` | how long in silence | 0.5 | 8 | | 3 | 0.5 | `(g,v,w,h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.gold)` |
| `wet` | what colour | 0 | 1 | | 0.7 | | `ICON.rect(g, 3, 3, w - 6, h - 6, hex)`, hex = the `wet` stop colour at `v` as `#rrggbb` |
| `presence` | how present | 0 | 1 | | 1 | (`leads: true`) | `(g,v,w,h) => ICON.much(g, v, w, h)` |

`size` gains `less: 0.7`, as in squares and handover, so presence also makes slabs smaller. Hints, one sentence each, Left/Right:
- steps: "How many later notes a slab lives through, crumbling one step at each. Left: gone after the next note or two. Right: a long crumbling trail."
- size: "How big a slab is; a harder note makes a wider one. Left: bricks. Right: large slabs."
- grain: "How coarse the crumbs are as a slab wears away. Left: fine sugar. Right: coarse gravel."
- goneBy: "How long slabs wait in a silence before they quietly dim away. Left: they go dim soon. Right: they wait up to eight seconds."
- wet: "The colour of the sand. Left: pale dry sand. Towards the right: wet ochre, then dark red."
- presence: "How much stands on the stage: how many notes a slab survives, how big it is, how long it waits in silence. Left: few small slabs that go soon. Right: a long crumbling trail of big slabs. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again."

Never read `x.p('presence')` (tests/how-present.test.ts greps for it). Entry: `id: 'cut', name: 'Cut', tag: 'new', on: false`.
Blurb: "Each note stands a slab with knife-sharp faces. Nothing moves until the next note: then every slab on the stage loses one step of
its edge, corners first, then edges, then faces, until it is sugar and gone. Best on picked notes and slow music; at six notes a second a
slab lives about a second and a half."

## 5. Draw order and cost

**Bake** (lazy, the very first thing in `frame`, before `chordAt` and its early return, so the first attack step is never the bake step;
only when `G` or `wetQ` differs from the cached key). `reset()` is a no-op: the sprites depend only on `(G, wetQ)`, so a seek never rebakes;
`reset` may be called without a usable ctx, so never read `x` there. Cell tables per `G` are cached apart from colours. Order, fixed (the test relies on it):
for `a` 0..3, for `l` 0..2, for `s` 1..8: `document.createElement('canvas')` sized `sw×sh`, `sg = c.getContext('2d')`,
`img = sg.createImageData(sw, sh)`, fill every pixel `0,0,0,255`, paint each cell with `last ≥ s` (its clipped G×G pixels) in
`round(C * F[s] * LV[l])`, `sg.putImageData(img, 0, 0)`. Never `getImageData`, never per-grain paths.
96 canvases, 190,976 px per (l, s) across aspects → 4.58 M px → **18.3 MB**. Rebake ≈ 30 to 60 ms, on a knob change only.

**Per frame** (on `x.g`):
1. Bake if needed. `i = chordAt`; `i < 0` → return. Silence level `l`; `l === 3` → return.
2. Collect live slabs (§2), newest first, cap 48; then reverse to draw oldest first.
3. `g.save(); g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1; g.imageSmoothingEnabled = false;`
4. Each slab: `s === 0` → `tone(g, …)` + `fillRect(x0, y0, w, h)`.
   `s ≥ 1` → `g.save(); g.translate(x0 + w/2, y0 + h/2); g.scale(fx, fy); g.drawImage(spr[a][l][s], -w/2, -h/2, w, h); g.restore();`
5. If `l === 0` and `SNAP.flash(age) > 0.04`: for each note of chord `i`, the two bone rects (§3).
6. `g.restore()`.
Cost: picked melody ≈ 8 `drawImage` + 3 `fillRect`; a 4-note chord texture at `steps` 8 ≈ 32 `drawImage` + 12 `fillRect`; worst 48 + 18.
The walk back over `steps` chords for the repeat count is ≤ 16 × notes per slab, a few thousand comparisons.

## 6. Tests (`tests/cut.test.ts`)

Load as `tests/flee-snap-switch.test.ts` does: `readFileSync('lab/tools/cut.js')`, `groupChords(NOTES)`, `instantiate('cut', SRC, { icon, chords })`,
a 60 Hz loop over **12 s** (past the silence check at 11.4 s) calling `onChord` then `frame`, `x = { g, t, dt: 1/60, W: 1280, H: 720, rnd, p, picked: false }` (no `pitch01`, no `onPicks`).
Two traps: (1) the fake `document.createElement('canvas')` must return a context with a **real** `createImageData(w, h)` →
`{ width: w, height: h, data: new Uint8ClampedArray(w*h*4) }` and a `putImageData(img)` that keeps `img` in a list; the recorder proxy's
default return has no `.data`. (2) Keep **two logs**: `x.g`'s calls, and the sprite canvases'. Compare frames on `x.g`'s log only.
Song: 10 single notes 0.7 s apart (pitches 48, 55, 60, 60, 64, 67, 72, 60, 52, 57, velocities 50..100), then a 3-note chord at 7.8 s.
Assert:
1. Entry: id `cut`, name `Cut`, tag `new`, keys exactly `['steps','size','grain','goneBy','wet','presence']`, 5 knobs plus presence;
   presence `{min 0, max 1, value 1, label 'how present', leads: true}`, no `less` on it; `steps`, `size`, `goneBy` have `less` in range and ≠ value.
2. Bake: 96 `putImageData`; for each aspect at level 0, the count of pixels with R > 0 strictly decreases from stage 1 to 8, and stage 8 > 0.
   Every pixel's alpha is 255.
3. On the attack step of each note, `x.g` logs `globalCompositeOperation=lighten` and ≥ 1 `fillRect`.
4. Between notes nothing moves: the `x.g` logs at `t_a + 0.40` and `t_a + 0.55` are identical for every attack `t_a`.
5. Stages: on the frame of attack n (n ≥ 1, default knobs) there are exactly `min(n, 8)` `drawImage` calls; with `steps: 2`, at most 2.
6. Silence: at last attack + `goneBy` + 0.6 s, no `fillRect` and no `drawImage`.
7. Determinism: two full runs give identical logs, with `Math.random` replaced by a throwing function.
8. Seek: a fresh instance, `reset`, one `frame` at t = 5.2 gives the same `x.g` calls as frame t = 5.2 of a full play (its bake goes to sprite canvases).
Then run `npx vitest run tests/cut.test.ts tests/snap-envelope.test.ts tests/how-present.test.ts tests/widgets-catalogue-node.test.ts`.
These last three load every widget: SNAP copy byte-exact, `less` within min..max and ≠ value, exactly one `presence` that leads, no
`p('presence')`, no `icon` reaching the catalogue meta, `value` within range.

## 7. Judge moments

- **Liebesleid picks, about 172 to 244 s** (cut on that pick set, 60 Hz video): sparse picked notes give long lives, so all nine stages stand together.
- **Rachmaninoff 2, 0 to 170 s**: the opening chords, one step per chord; slabs in the bass rows should crumble together on each blow.
- **Winter Wind**: the stress case, 12+ attacks a second; slabs live under a second, check it still reads as crumbling, not flicker.
The one question a still must answer (taken ≥ 0.35 s after an attack): **are at least four visibly different edges on screen (knife
rectangle, clipped corners, rounded, sugar), and is the frame 0.3 s later between the same two notes identical?** Slabs erode only on later
attacks, never with time; corners first, then edges, then faces.

## 8. Risks and fallbacks

- **Blob.** Same colour under `lighten` merges overlapping slabs; `F` (1 → 0.6) keeps newer ones lighter so their edges read. If not
  enough, widen `F` to 0.5 at stage 8, or shrink widths to `40 + 140u`.
- **Dense music.** At 12 attacks a second a slab lives about 0.7 s; SYNTHESIS: best on picks and slow music, and the blurb says so.
- **Ghost of fallen grains** (≈ 0.25 s fade after each attack) could read as crumbling with time. It starts on the attack, as the attack's
  own change of state. If it reads as a dissolve on video, raise the grain default to 0.6 so fewer, bigger crumbs fall per step.
- **Strike too weak in big music**: SYNTHESIS's own fix is in already (hold tone on the whole slab, 5 px line). Next: line 7 px.
- **Memory and stall**: 18.3 MB and a 30 to 60 ms rebake on a `grain`/`wet` change. Fallback: drop level 2 (12.2 MB) or bake long side 192.
- **Stamped look**: one seed per aspect, four flips. Fallback: two seeds per aspect chosen by `(hash(m) >>> 12) & 1` (doubles memory).
- **steps > 8**: some attacks leave a slab unchanged. Accepted; nine stages are what SYNTHESIS asks to bake.

## After review

Changes after the review (lab/tools/cut.js, tests/cut.test.ts), all on purpose:
- **Corners lead.** `hold = 0.8*min(1, dC/1.3)^0.8 + 0.2*min(1, dE) + 0.08*(n1-0.5)` (dC no longer capped at 1). Stages 1-4 now clip and round the corners while the face middles stay straight; the arrises and faces go later through the small dE term and `loose`. `Q = [0, 0.05, 0.10, 0.17, 0.25, 0.35, 0.47, 0.60, 0.72]` (Q[1] 0.03 to 0.05 so stage 1 is a visible clip).
- **Grain is in screen pixels.** Sprites are baked in three size buckets (long side 96, 192, 384); a slab draws from the nearest at about 1:1, so a grain is `G = 2 + 6*grainQ` screen px at every slab size.
- **Twins stand apart.** Offset 0.35*w sideways and 0.25*h up (was 0.16 and 0.12); `F` now runs 1 to 0.5 at stage 8 (was 0.6), so newer slabs read lighter over older ones.
- **Lazy bake.** Sprites are made on first use per (bucket, aspect, level, stage) and cached; the cache is dropped when the grain size or `wet` step changes. Cell tables are cached per (G, bucket, aspect). No more 96-canvas bake or 18 MB rebake per `wet` step.
- **Tests.** Canvas ids are logged in drawImage; new tests for the stage sequence n..1 per slab, corner-first masks, twin placement, velocity normalisation (60 / 220 / lone note 156), silence level tones, empty CHORDS, bucket sizes; the seek test compares stages rather than canvas ids.
Superseded plan numbers: the 256 px sprites, the 96-canvas bake order, the twin step, `F` end and `Q`.
