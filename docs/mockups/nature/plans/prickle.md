# Prickle (`prickle`): build plan

Planner's plan for one Sonnet builder. Binding sources, in order of precedence: `docs/mockups/nature/SYNTHESIS.md` (section "Read this before
building any of them" and section 1 Prickle), then essay 6 section 8. Every number below is final; where this plan chose a number the essay
left open it says "plan". Files you write: `lab/tools/prickle.js`, `tests/prickle.test.ts`. Nothing else. No git commands that change state.
`prickle` is already in `TOOL_IDS` and `lab/tags.json`; do not touch them.

## 1. What the viewer sees

Each note is one enormous flat thorn that enters from the left or right edge, its sides concave so that a broad base pinches at a waist into
a hairline tip, present whole on the attack's own step in saturated red with a bone tip, then sitting still as a dim red silhouette. When the
next note lands it withdraws straight back along its own axis and the new thorn comes from the other side; a chord is several thorns from both
sides stabbing one shared spot, and in a run the bases shrink to needles. The word it delivers is **sharp** (and rigid): nothing ever bends,
swells, trembles or slides in.

## 2. Geometry and numbers (canvas px, W 1280, H 720)

**Clip statistics** (from `CHORDS`, cached on the pair `(CHORDS, CHORDS.length)` because the lab may grow the array; recompute when the
length changes, like `SNAP.rolls`' cache):
- `lo` = min `ch.lo`, `hi` = max `ch.hi`; `mid = (lo + hi) / 2`, `span = max(12, hi - lo)`.
- `p10`, `p90` of every `n.v` of every chord: sort ascending, `p10 = vs[floor(0.1 (N-1))]`, `p90 = vs[floor(0.9 (N-1))]`.
- `uv(v) = (N < 2 || p90 - p10 < 1) ? 0.5 : clamp((v - p10) / (p90 - p10), 0, 1)`.
- `up(m) = clamp((m - mid) / span + 0.5, 0, 1)`; **pitch place** `py(m) = H (0.86 - 0.72 up(m))` (619 px bass .. 101 px treble).

**Side of chord i** (stateless, by index): `side_i = (i % 2 === 0) ? +1 : -1` (+1 = base on the left edge, pointing right). Sides alternate,
so a repeat always comes from the other side.

**Repeat** (plan): chord i is a repeat when `i > 0`, `cs[i].t - cs[i-1].t < 0.5` and `cs[i].hi === cs[i-1].hi`. A repeat takes its **spot**
from chord i-1 (walk back while each link is a repeat, at most 64 steps). It strikes at full: the `uv` for its strike colour is
`max(own uv, uv of chord i-1)`.

**Notes drawn per chord**: sort the chord's notes by pitch descending; if more than 8, keep indices `round(k (n-1) / 7)`, k = 0..7 (plan:
the 8-fill cap). Note k gets side `side_i * (k % 2 === 0 ? 1 : -1)`, so the top note comes from the chord's side. `n` = notes kept.

**Spot P (where the tips go)**:
- One note: reach `r = (0.35 + 0.5 uv) W` from its own edge: `P.x = side > 0 ? r : W - r`; `P.y = py(m)`.
- Chord (n >= 2): `r = (0.35 + 0.3 * mean uv) W` from the chord side's edge, `P.x = side_i > 0 ? r : W - r`; `P.y` = mean of `py(m)`.
- Repeat: the spot of the chord it repeats.

**Base half-width** `b = 180 * broad * clamp(gap / 0.5, 0.08, 1) * clamp(1.5 / sqrt(n), 0.5, 1)`, with `gap = cs[i+1].t - cs[i].t`
(`Infinity` for the last chord, factor 1). The last factor is plan: it keeps an 8-note chord from fusing into a blob. Smallest possible
b = 180 * 0.3 * 0.08 * 0.5 = 2.2 px, a needle. A lone note at defaults: b = 180.

**Base centre B** for a thorn with side s and target tip T (T = P for one note; for a chord see "Tips"):
- `Bx = s > 0 ? -(16 + b * sin 25deg) : W + 16 + b * sin 25deg` (base corners always off frame, with room for the 20deg tilt plus the
  hook's ~2.4deg turn). `dx = |T.x - Bx|`.
- One note: `By = clamp(py(m) + (hash(m) - 0.5) * 2 * tan(20deg) * dx, 0.1 H, 0.9 H)`.
- Chord: `By = clamp(py(m), T.y - tan(20deg) * dx, T.y + tan(20deg) * dx)`, then clamp to `[0.1 H, 0.9 H]`. Each base sits at its own pitch
  height so the voicing reads; the tilt never exceeds 20deg; **bases are always on the left or right edge, never the bottom**.
- For chords, compute `By` against P first (to sort and to get the axis for the tip offsets), then recompute against the final T.
- `hash(m)`: `let t = Math.imul((m + 0x9E3779B9) | 0, 0x85EBCA6B); t ^= t >>> 13; t = Math.imul(t, 0xC2B2AE35); t ^= t >>> 16; return (t >>> 0) / 4294967296;`
  No `x.rnd`, no `Math.random` anywhere. The pitch hash is the only randomness, so a seek redraws the same thorn.

**Tips in a chord**: thorns on one side sorted by By; j = index on that side, ms = count on that side, `a` = unit vector B -> P,
`nrm = (-a.y, a.x)`. `T = P - 3 a + 6 (j - (ms - 1) / 2) nrm`. Opposite tips end 6 px apart along the axis, same-side tips 6 px apart across.

**Profile** (local frame: lx along the axis from the base, ly across it; len = local length):
- Waist control, piecewise in `w = waist` (plan; reproduces the essay exactly at 0.85):
  `w <= 0.85`: `q = w / 0.85`, `ca = 0.5 + 0.22 q`, `co = b (0.5 - 0.4889 q)`.
  `w > 0.85`: `q = (w - 0.85) / 0.15`, `ca = 0.72 + 0.06 q`, `co = b * 0.0111 * (1 - q)`.
  At w = 0 the control lies on the straight line: a straight-sided wedge. At 0.85, b = 180, len = 900: width 92.0 at 61 %, 15.8 at 87 %,
  1.6 at len - 30 (checked numerically; matches SYNTHESIS).
- Hook angle `th = hook * 24deg` (12deg at default). Hooked tip `Hk = (len (0.8 + 0.2 cos th), len * 0.2 sin th)`: the straight tip turned
  about the point at 80 % of the axis. `kap = hypot(0.8 + 0.2 cos th, 0.2 sin th)`, `phi = atan2(0.2 sin th, 0.8 + 0.2 cos th)`
  (at 12deg: kap 0.9965, phi 2.39deg, the tip drops 37 px on a 900 px thorn).
- Sides: upper `P0 = (0, -b)`, `C = (ca len, -co)`, end `Hk`; lower `P0' = (0, +b)`, `C' = (ca len, +co)`, end `Hk`. **Both quadratics end at
  the same point**, which keeps the tip a hairline with the hook (SYNTHESIS: "bend the hook with the same quadratic"). No extra segment.
- To world: `dist = |T - B|`, `len = dist / kap`, `a` = unit(T - B), `d` = the perpendicular of `a` with `d.y >= 0` (the hook bends toward the
  bottom of the screen on both sides). Corrected axis `A = a cos phi - d sin phi`, `D = d cos phi + a sin phi`. World point of local `(lx, ly)`
  = `B + lx A + ly D`. With this, `Hk` lands exactly on T.
- Body path: `moveTo(P0)`, `quadraticCurveTo(C, Hk)`, `quadraticCurveTo(C', P0')`, `closePath()`, `fill()`. The closing edge is off frame.

**Bone tip** (last 30 % of the axis): split each side at `s0`, the root in [0,1] of `2(1-s)s ca len + s^2 Hk.x = 0.7 len`:
`A2 = Hk.x - 2 ca len`, `B2 = 2 ca len`, `C2 = -0.7 len`; if `|A2| < 1e-9` then `s0 = -C2 / B2`, else `s0 = (-B2 + sqrt(B2^2 - 4 A2 C2)) / (2 A2)`.
Right piece by de Casteljau: start `Q0 = (1-s0)^2 P0 + 2(1-s0)s0 C + s0^2 Hk`, control `Q1 = (1-s0) C + s0 Hk`, end Hk (same for the lower side).
Tip path: `moveTo(Q0)`, `quadraticCurveTo(Q1, Hk)`, `quadraticCurveTo(Q1', Q0')`, `closePath`, `fill`. No clip, no per-thorn save/restore.
Area: 0.69 % of the frame at b 180, 1.26 % at b 270, so the 6 % bone budget can never bind. Only the top note of a chord (k = 0) gets it.

**State**: none. `reset() {}`, `onChord() {}`. `frame` finds everything from `CHORDS` and `x.t` (binary search `chordAt`, copied from
handover.js). The only cache is the clip statistics. Velocity: `n.v` (on picks it already carries the amount).

## 3. Time

All ages are `age = x.t - cs[j].t`. **Paste the SNAP block** (used: `SNAP.H`, `SNAP.BONE`, `SNAP.flash`, `SNAP.gain`, `SNAP.core`,
`SNAP.TOUCH`, `SNAP.PRESETS[..].L`, `SNAP.launch`). Not used: `SNAP.alpha`, `SNAP.settles` (rule 1), `SNAP.size` (rigid: never swells).

**Colours** (RGB, each a real target colour drawn with `tone`):
- HOLD (dim red body): `(92,14,16)`, from SYNTHESIS. Touch scales it by `hm = [0, 0.75, 1, 1][touch]` (marcato: (69,11,12); live channel >= 60).
- STRIKE (saturated red body): `(min(255, round((170 + 58 uv) * gain)), 20, 24)` with `gain = SNAP.gain(n.amount ?? 1)`: (170,20,24) soft
  .. (228,20,24) loud.
- BONE tip: `SNAP.BONE` = (236,226,208), only on the top note, only when `SNAP.core(n.amount ?? 1) === 1`, only while `age < SNAP.H` (2 steps;
  bell: `age < 2 * SNAP.H`).
- `tone(g, rgb, k)` exactly as SYNTHESIS gives it (`lighten`, `globalAlpha = 1`, fillStyle `rgb(...)` of `rgb * k`), pasted **outside** the SNAP
  markers. Wrap the frame's drawing in one `g.save()` ... `g.restore()` so the composite mode is restored.

**Attack step** (age in [0, dt)): the whole thorn, body in STRIKE, then the bone tip over it. Whole on its own step: no growth, no slide.

**Fall**: body colour `C(age) = lerp(HOLD * hm * kl, STRIKE, f)` per channel, rounded, `f = SNAP.flash(age)` (1 for 2 steps, then halves every
60 ms); bell uses `f = SNAP.flash(age / 2)`. `lighten` cannot darken: the bone and red the canvas holds fade by themselves, and the drawn colour
is the floor they land on, exactly (SYNTHESIS rule 1). The bone ghost lasts about 0.25 s, by the canvas.

**Hold**: geometry frozen; only the colour steps. `life = min(goneBy, SNAP.PRESETS[SNAP.TOUCH[touch]].L)` (staccato 0.35, marcato 0.6,
piano 2.5, bell 6). Life fade `kl(age) = 1 - smoothstep(life - fl, life, age)`, `fl = min(0.25, 0.5 life)`. At `age >= life` draw nothing.

**Withdraw** (as in handover): chord j withdraws when chord j+1 lands, if it was still on stage then: `tn = cs[j+1].t - cs[j].t < life_j`.
`tw = x.t - cs[j+1].t`; shift every point by `-A * SNAP.launch(tw, 1.25 len, 0.08)` (full speed at once, then slowing). Colour: `C(age_j)` with
`kl` frozen at `kl(tn)`. Drop it when the shift `>= len` (tw >= 0.08 ln 5 = 0.129 s); by then it is wholly off frame. Draw j = i-1, i-2, i-3,
stopping at the first with `tw >= 0.13`. Skip a thorn whose colour is all zero (staccato hold), there is nothing to move.

**No motion without a note**: the only movement is the withdrawal, which starts on a real attack. No travelling front, no end-of-phrase staging,
no ring, no overshoot. A lone note ends with a tone fall, not a move.

## 4. Knobs (5 + presence)

| key | label | min | max | default | less | hint |
|---|---|---|---|---|---|---|
| `waist` | how thin the waist | 0 | 1 | 0.85 | - | How the sides of a thorn curve in. Left: a straight-sided wedge. Right: a slim waist and a long hairline tip. |
| `broad` | how broad the base | 0.3 | 1.5 | 1 | 0.6 | How wide a thorn is where it leaves the edge. Left: all needles. Right: slabs that fill a quarter of the frame. |
| `hook` | how bent the tip | 0 | 1 | 0.5 | - | How much the last stretch of a thorn bends down. Left: dead straight. Right: a claw. |
| `goneBy` | gone by | 0.3 | 2.5 | 1.2 | 0.3 | How long a thorn may stay when no next note comes. Left: a thorn never lasts a third of a second. Right: a lone note may stay two and a half seconds. |
| `touch` | articulation (`step: 1`) | 0 | 3 | 2 | - | How a note is played: staccato, marcato, piano, bell. Left: here and gone, with no dim body. Right: a bright strike that glows longer before the dim red holds. |
| `presence` | how present (`leads: true`) | 0 | 1 | 1 | - | How much each note leaves: how broad its thorn is and how long it may stay. Left: thin thorns, soon gone. Right: broad thorns that may stay. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again. |

`broad`'s `less: 0.6` is a plan addition (presence follows how much is made, and area is that). The widget never reads `presence`.
Icons (40x26, `ICON` helpers, `ICON.red`):
- waist: one small thorn from the left edge, the same profile maths at `waist = v`, base half-height 9, length 34, tip at the right.
- broad: the same thorn at waist 0.85 with base half-height `2 + v * 10`.
- hook: the same thorn with `th = v * 24deg`.
- goneBy: `ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red)`.
- touch: copy hammer.js's articulation icon (the envelope curve), in `ICON.red`.
- presence: `ICON.much(g, v, w, h)`.

Entry: `{ id: 'prickle', name: 'Prickle', tag: 'new', on: false, blurb, params, reset, onChord, frame }`. Blurb (plan): "One huge flat thorn
per note, from the left or the right edge, its sides curving in to a hairline tip. Struck red with a bone tip, it holds still in dim red and
withdraws straight back as the next note comes from the other side. A chord stabs one spot from both sides; a fast run is a volley of needles."

## 5. Draw order and cost

Per frame: `cs = typeof CHORDS !== 'undefined' ? CHORDS : []`; `i = chordAt(cs, x.t)`; return if `i < 0`. Read the five knobs once.
1. `g.save()`.
2. Withdrawing chords, oldest first (i-3 .. i-1): per thorn `tone(g, C)`, `beginPath`, `moveTo`, 2 x `quadraticCurveTo`, `closePath`, `fill`.
3. Current chord i (if `age < life_i`): per thorn the same, order k = n-1 .. 0 (top note last).
4. If the bone applies: `tone(g, SNAP.BONE)`, the tip path, `fill`.
5. `g.restore()`.
No sprites, tiles or offscreen canvases; nothing baked in `reset`. Fills: one note 1-2, an 8-note chord with bone 9; worst case at 12 chords/s
with 8-note chords about 33 (three withdrawing). Each is a single 2-curve path: well under 1 ms a frame.

## 6. Tests (`tests/prickle.test.ts`)

Copy the harness of `tests/flee-snap-switch.test.ts`: the `recorder` proxy, `instantiate('prickle', SRC, { icon, chords: CHORDS })`, a 60 Hz
`play(knobs, secs, opts)` loop that calls `onChord` then `frame`, and `x` with `picked: false` and **no** `onPicks`. Songs: (a) the flee test's
40-note melody plus bass; (b) one lone note at t 0.5 (m 64, v 90); (c) a 4-note chord at 0.5 then one note at 1.0.
1. Shape: `loadCatalogue().widgets.get('prickle')` keys equal `['waist','broad','hook','goneBy','touch','presence']`; presence `leads`;
   goneBy `less` 0.3, broad `less` 0.6; touch `step` 1; every hint except presence's contains "Left:" and "Right:"; `min <= value <= max`.
2. Attack: on the frame where chord 0 is first heard the log has >= 1 `fill` and a `fillStyle=rgb(236,226,208)`; every `fill` is preceded,
   since the last `save`, by `globalCompositeOperation=lighten` and `globalAlpha=1.000`; every frame that saves also restores.
3. Stillness: song (b), frames from age 0.05 s to 1.0 s: the `moveTo` and `quadraticCurveTo` arguments are identical frame to frame (only
   `fillStyle` may change). From age >= 1.2 s (goneBy) no `fill`. With `touch: 0`, no `fill` from age 0.35 s.
4. Withdrawal: song (c): in the 7 frames after t 1.0 the chord's thorns' `moveTo` points move monotonically further from the frame centre, and
   from tw >= 0.13 s only the new thorn's path remains (one body path, plus its bone tip in its first 2 steps).
5. Sides only: in every frame of song (a), every path's first `moveTo` of a body has x `< 0` or `> 1280` and y within `[0, 720]`.
6. Hairline: in song (b) at defaults, both `quadraticCurveTo` calls of the body path share the tip (first call's end = second call's start
   point, i.e. the second call is from that point), and the two control points are `2 * 0.0111 * 180 = 4.0` px apart (+-0.01).
7. Determinism: two runs of song (a) with `Math.random` replaced by a thrower give identical logs; a fresh instance that runs only `frame` at
   t 3.0 logs exactly what the long run logged at t 3.0 (stateless after a seek).
8. Guards: a clip of one note, and a clip with every velocity 80, each run 3 s without throwing and with no `NaN` in the log.
9. `tests/snap-envelope.test.ts` still passes (it finds the pasted block itself).
Run: `npx vitest run tests/prickle.test.ts tests/snap-envelope.test.ts`.

## 7. Judge moments

- **Liebesleid picks, ~172-244 s**: the slow picked melody, first. One thorn at a time, alternating sides, a repeat stabbing the same spot.
- **Rachmaninoff 2, 0-170 s**: the bell chords (8-note cap, the star with 6 px tip gaps, voicing visible in base heights) and the repeats (41 %).
- **Winter Wind**: the run rule. At 12 notes/s you must still count needles, and withdrawals must read as handover, not a stream.
- The one question each still must answer: **do the thorns come only from the sides, never up from the bottom, and is the tip a hairline?**
  Look at an attack-step still (bone tip) and one 0.5 s into a hold. Judge on the 60 Hz video, never the live lab.
- For a quick look the dev server is already at http://localhost:5300 (never start one, never touch 5173).

## 8. Risks and fallbacks

- **"Too suggestive"** (the essay's danger): a tall pointed shape. Mitigated by sides only, tilt <= 20deg, hook down, no swelling. Fallback if a
  still reads that way: tilt cap 20deg -> 10deg and hook default 0.5 -> 0.7 (more claw, less shaft).
- **Blade's dimness**: the held body is a `tone` at (92,14,16), not `settles(0.4)` of oxblood (which measures 29,1,1 / 25,1,1). If it still reads
  weak on video, raise HOLD to (110,16,18); never go back to `alpha`.
- **Hairline lost in the hold**: partly covered pixels settle at about half the tone, so the held tip thins away over its last ~20 px. Accepted;
  the strike carries the hairline. Do not widen the tip.
- **Chord blob**: many thorns converging fuse. The `1.5 / sqrt(n)` factor and the 8-note cap are the first defence; if still a blob, keep only
  the top 4 and bottom 2 notes.
- **Run trails**: at 12/s three withdrawing thorns plus the canvas trail may read as a travelling front. Fallback: draw only i-1 withdrawing.
- **Hook at 1**: the tip turns 24deg; it still lands on the spot by construction, but check the base corners stay off frame (margin uses sin 25deg).
- **SNAP drift or CRLF**: paste the block with a script, never by hand. Write `lab/tools/prickle.js` with one line `// SNAP PASTE HERE`
  inside the IIFE, then from the worktree root run
  `node -e "const fs=require('fs');const e=fs.readFileSync('lab/snap/envelope.js','utf8');const a=e.indexOf('// SNAP v1 begin'),b=e.indexOf('// SNAP v1 end')+14;const f='lab/tools/prickle.js';fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('// SNAP PASTE HERE',()=>e.slice(a,b)))"`
  and confirm the file has no carriage returns.

## After review

- Base clamp: each thorn's base half-width b is capped at 0.8 x min(By, H - By), so the base stays at its pitch place but no body reaches the top or bottom edge.
- Withdrawing thorns now slide back along the base-to-tip chord rather than the hooked axis, so a hooked thorn cannot drift past the bottom edge while leaving.
- Bone strike holds age < 2 * x.dt (bell: 4 * x.dt), always two 60 Hz steps regardless of frame phase.
- Test 5 now samples every body quadratic and asserts no point with 0 <= x <= 1280 has y >= 720 or y <= 0, on song (a) at default, broad 1.5 with hook 1, and broad 0.3.
