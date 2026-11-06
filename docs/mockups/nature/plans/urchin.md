# Build plan: Fist of spines (`urchin`)

Spec: essay 6 §5 (`docs/mockups/nature/essays/6-spider-silk-and-thorns.md`), overridden by `SYNTHESIS.md` §9 and its "Read this
before building". Everything below is what the builder writes; numbers marked **[plan]** are this plan's own, not the essay's,
each with its reason, so the judge can revert them. Files: `lab/tools/urchin.js`, `tests/urchin.test.ts`. Nothing else.

## 1. What the viewer sees

A flat field of short dark-teal needles lies still along a slow, swirling nap. On a note, every needle within reach swings in
that one step to aim at the note's spot and stabs, bone-hot near the spot, teal at the rim, stopping short so the spot itself is
a clean black point ringed by tips; then they all lie back together and the field goes quiet. Texture word: **sharp** (hairline
tips, the empty point) and **elastic** (the jab and the springy lying back, pivots never moving).

## 2. Geometry and numbers (canvas px, W 1280, H 720)

**Field (fixed, rebuilt only when `round(spines)` changes).** `N = round(x.p('spines'))`, `s = sqrt(W*H/N)`,
`cols = max(1, round(W/s))`, `rows = max(1, round(H/s))`, `cw = W/cols`, `chh = H/rows`. Counts: 240 → 21×12 = **252**,
50 → 9×5 = **45**, 600 → 33×18 = **594**. Generator: mulberry32 with fixed seed `20261106` (not `x.rnd`, so a seek, a render and
live play agree). For needle (i, j), row-major (j outer, i inner), draw in this order: `jx = r()*0.7-0.35`, `jy = r()*0.7-0.35`,
`jit = r()*0.3-0.15`, `sg = r() < 0.5 ? -1 : 1`. Pivot `px = (i+0.5+jx)*cw`, `py = (j+0.5+jy)*chh`.
- Rest angle (the nap; the needle points from pivot to tip): `rest = 0.5 + 0.9*sin(2π(0.55*px/W + 0.2*py/H) + 1.1)
  + 0.5*sin(2π(0.9*py/H - 0.3*px/W) + 2.4) + jit`.
- Rest length `L0 = 0.7*s` (43.4 at 240: the essay's "about 44", and "length follows spacing").
- Half base `hb = 1.75*sqrt(L0/43.4)` **[plan]**: essay base 3.5 px at 240; scaled so 50 spines (L0 95) are not hairs on a
  pole (base 5.2) and 600 (L0 27) are not stubs (base 2.8).
- Needle shape after flee.js:135's needle (a 4-point path), widest point moved to the pivot, with a short tail behind the ball
  joint **[plan]**: `tip = P + dir*L`, `b1 = P + nrm*hb`, `tail = P - dir*0.12*L0`, `b2 = P - nrm*hb`, where
  `dir = (cos a, sin a)`, `nrm = (-sin a, cos a)`. Path: `moveTo(tip) lineTo(b1) lineTo(tail) lineTo(b2) closePath()`.

**Clip statistics (once per `CHORDS` array; cache `{arr, len}` like `SNAP.rolls`, recompute if either differs).**
`const cs = typeof CHORDS !== 'undefined' ? CHORDS : [];`
- Pitch range: `lo = min(ch.lo)`, `hi = max(ch.hi)`; if `hi - lo < 12`: `c = (lo+hi)/2`, `lo = c-6`, `hi = c+6`.
- Velocity: every `n.v` of every chord, sorted ascending; `p10 = vs[floor(0.1*(len-1))]`, `p90 = vs[floor(0.9*(len-1))]`.
  `u(v) = clamp((v-p10)/(p90-p10), 0, 1)`; **guard:** if `vs.length < 2` or `p90 - p10 < 4`, `u = clamp(v/127, 0, 1)`.
  `vN = 127*(0.3 + 0.7*u)` is the only velocity passed to SNAP (38 at u 0, 127 at u 1). Nothing else reads `n.v`.

**The note's spot (pitch is a place; same pitch, same spot, after any seek).**
- `sx = W*(0.1 + 0.8*(m - lo)/(hi - lo))`.
- `sy = H*(0.2 + 0.6*((pc*7) % 12)/11)`, `pc = m % 12`: octaves share a height (essay), spread within ±0.3H. The fifths
  permutation **[plan]** replaces "seeded by pitch class": no two pitch classes collide, and C, G, D sit at adjacent heights.
- Reach `R = x.p('reach')*(180 + 360*u^1.2)` (180..540 px at reach 1). Gap `gap = 10 + 18*u` px.

**Which note owns a needle (stateless, essay (g)).** `ci = chordAt(cs, x.t)` (binary search, copy it from handover.js).
Walk `k = ci, ci-1, ...` while `k >= 0` and `x.t - cs[k].t < Tend` (`Tend = 1.2*ring`, see §3). In chord k, among its notes
with `d = dist(pivot, spot) < R`, take the smallest `d` (the nearest note whose reach covers it: sharp borders where neighbours
disagree). The first (newest) chord that has one owns the needle, with `t = x.t - ch.t`; the jump is total, so nothing older
matters. None: the needle is at rest. Cache each chord's spots in a `Map(chord → [{sx, sy, u, vN, m, d, a}])` (deterministic);
only `R` reads a knob, so compute `R` per frame.

**Owned needle at age t** (`τ = 0.2*ring`, `D = e^(-t/τ)`, `aim = atan2(sy-py, sx-px)`, `Δ = wrap(aim - rest)` into (-π, π]):
- Angle `a = rest + Δ*D + sg*A*e^(-t/0.06)*sin(2π*8t)`, `A = (12π/180)*stab/0.7`. **[plan] sin, not the essay's cos:** with cos
  the needle is 12° off on the attack step, which breaks the essay's own "turns to point exactly at the spot".
- Length `L = L0*(1 + J*e^(-t/0.07))`, `J = 0.5*stab/0.7` (×1.5 at default stab, ×1.71 at 1, ×1 at 0: "they only turn").
- Gap cap **[plan]**: `cap = d - gap`; if `L > cap`, `L = cap + (L - cap)*(1 - D)`. On the attack step tips stop exactly `gap`
  short; the cap releases with the same τ, so nothing pops when ownership ends. Skip drawing the needle while `L < 2`.
- Heat `q = clamp((0.35 + 0.65*(1 - d/R)) * E, 0, 1)` with `E = SNAP.env(t, {v: vN, m, d: n.d, a: n.amount ?? 1},
  {preset: 'marcato', ring, picks: !!x.picked}).E`: bone near the spot, teal at the rim (SYNTHESIS palette, not the essay's red).
- Repeat: the same spot again finds Δ already small (fast repeats) and only restarts E, the jab and the quiver: a clench. A
  repeat 0.3 s later re-turns from about 22 % of Δ; that is the stateless rule, accept it.

**State kept:** the field arrays (rebuilt on N change), the clip-stats cache, the spot cache. No per-frame memory, no `x.rnd`,
no `Math.random`. `reset()` clears the caches; `onChord()` is empty.

## 3. Time

- **Attack step:** every owned needle stands whole at `aim` (D = 1, quiver 0), length ×(1+J) capped `gap` short of the spot,
  heat at its peak. Drawn with `lighten` at alpha 1, so it lands whole on its first step (SYNTHESIS rule 2 holds by itself).
- **Hold:** none on the aim (essay): from the strike on, `Δ*D` shrinks with τ = 0.2·ring, all needles together, one time
  constant, no front, no second stage. E holds two steps (SNAP's own hold), then falls.
- **Fall:** preset `marcato` **[plan]**: its L = 0.6·ring = 3τ, so the light is gone when the angle is 95 % home and the last
  5 % settles in ground colour. At middle C, a near needle: q 1 → 0.56 (0.1 s) → 0.30 (0.2 s) → 0.16 (0.4 s) → 0 (0.6 s).
- **Gone:** a needle stops being owned at `t ≥ Tend = 6τ = 1.2·ring` (remaining Δ ≤ 0.25 %, under 0.5°): back on its rest path.
- **SNAP block:** pasted byte for byte inside the IIFE: copy lab/snap/envelope.js from `// SNAP v1 begin` through
  `// SNAP v1 end` with a short node script, LF only. Used: `SNAP.env`, `SNAP.BONE`.
- **Tone rule, every body.** `g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;` real target colours, never
  `SNAP.alpha` or `settles`. Ramp `col(q)`, linear between stops, monotone per channel (so it never falls below ground):
  `q 0 → G`, `q 0.35 → (44,150,138)`, `q 0.7 → (150,200,186)`, `q 1 → BONE (236,226,208)`, where the ground colour is
  `G = round((16,62,58) * ground/0.24)` (SYNTHESIS dark teal at the default 0.24; (23,90,85) at 0.35). A rim needle of a soft
  note (q ≈ 0.09) is about (23,85,80): visibly above ground. Restore `source-over` after (save/restore).
- **No motion without a note.** With no owned needle the frame is the rest field, byte-identical every step. The only motion
  between notes is the shared exponential lie-back of needles a note turned. No travelling front, no end-of-phrase staging.

## 4. Knobs (5 + presence)

| key | label | min | max | value | step | less | hint (essay §(e) and opening rules) | icon (40×26, v 0..1) |
|---|---|---|---|---|---|---|---|---|
| `reach` | how far the call reaches | 0.3 | 2 | 1 | | | How far around a note the spines turn. Left: a small tight fist. Right: half the screen turns. | `ICON.dot(g,w/2,h/2,1.5)` then `ICON.ring(g,w/2,h/2,3+v*9,ICON.green)` |
| `spines` | how many spines | 50 | 600 | 240 | 10 | 50 | How many spines stand in the field. Left: few, long, well apart. Right: dense, short stubble. | `3+round(v*14)` short green ticks at `ICON.rng(3)` spots, length `8-4*v` |
| `stab` | how hard they stab | 0 | 1 | 0.7 | | | How hard the spines jab at the note. Left: they only turn. Right: they jab past their length and snap back. | `ICON.arrow(g,4,h/2,8+(w-14)*v,h/2,ICON.green)` |
| `ring` | how long they stay turned | 0.25 | 3 | 1 | | 0.25 | How long the fist stays lit and the spines take to lie back. Left: gone in a quarter of the time. Right: three times as long. | `ICON.fade(g,w,h,0.1+0.9*v,ICON.green)` |
| `ground` | how much the field shows at rest | 0 | 0.35 | 0.24 | | | How much the resting field shows. Left: only the fist. Right: the nap is always visible. | `ICON.alpha(g,0.1+0.9*v,()=>ICON.lines(g,5,w,h,{dir:'v',col:ICON.green}))` |
| `presence` | how present | 0 | 1 | 1 | | `leads: true` | How much you see: how many spines, how long the fist stays. Left: a few spines and a quick blink. Right: a full field and a fist that lingers. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again. | `ICON.much(g,v,w,h)` |

- `less:` only on `spines` (50) and `ring` (0.25), exactly as the essay gives them. No `drive` on any knob; never on `spines`
  (it reshuffles the grid).
- Entry: `{ id: 'urchin', name: 'Fist of spines', tag: 'new', on: false, blurb: "A field of dark-teal needles lies along a slow
  nap. On each note every needle within reach turns at once to aim at the note's spot and stabs, stopping short, so the spot
  stays black; then they lie back together. Pitch places the spot, loudness sets how far the call reaches." }`.

## 5. Draw order and cost

Per frame; nothing is baked (no sprites, no `document.createElement`):
1. Clip-stats and spot caches valid (identity + length check)? Field valid for `N`? Else rebuild (Float32Arrays px, py, rest,
   sg; numbers L0, hb).
2. Active chords: from `ci` back while `x.t - ch.t < Tend`; take their spots, compute each `R`.
3. Each needle: owner search (at most ~20 chords × their notes), then angle, length, q. Bucket `k = ceil(q*16)` (0..16); k 0 is
   the ground bucket (colour G). Rest needles go to bucket 0 at `rest`, length L0. 16 levels **[plan]**: 8 would quantise
   `(1 - d/R)` into visible concentric rings, a target.
4. `g.save(); g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;`
5. For k = 0..16 with members (skip k 0 when `ground < 0.001`): `g.beginPath()`; each member's 4-point path;
   `g.fillStyle = 'rgb(r,g,b)'` of `col(k/16)` (k 0: G); `g.fill()`.
6. `g.restore()`.

Cost: at most 17 fills, 252 quads at default (594 at max), at most 252 × 20 × 4 distance tests. Expect well under 2 ms. No
allocation per needle: reuse bucket index arrays (Int16Array per bucket, or one array sorted by bucket).

## 6. Tests (`tests/urchin.test.ts`)

Load as tests/flee-snap-switch.test.ts does (`readFileSync` of lab/tools/urchin.js, `instantiate('urchin', SRC, {icon, chords})`,
the same proxy `recorder`), but: no `document` stub; the context has `picked: false` and **no `onPicks`**; `rnd` seeded;
`Math.random` replaced by a thrower during play. Notes built in the test with `groupChords`, every velocity ≥ 40.
1. Entry: id `urchin`, name `Fist of spines`, tag `new`; keys exactly `['reach','spines','stab','ring','ground','presence']`;
   5 non-presence knobs; `spines.less === 50`, `ring.less === 0.25`, no other `less`; presence `leads: true`, 0..1, value 1;
   every hint contains `Left:` and `Right:`; every param's `icon` runs on a stub context without throwing.
2. SNAP block: the file contains lab/snap/envelope.js's block byte for byte; no `\r` anywhere in the file.
3. Attack: in a clip with spread velocities, the attack step of a high-velocity note logs `globalCompositeOperation=lighten`,
   at least 2 `fill()` calls, and a `fillStyle` with red ≥ 200 (a bone bucket).
4. Spot stays black: single-note clip `[[1.0, 1.5, 64, 90]]` → spot (640, 301.09) (range guard → x 640; pc 4 → (4·7)%12 = 4 →
   720·(0.2 + 0.6·4/11)). On the attack step and the next two steps, every `moveTo`/`lineTo` point is ≥ 10 px from the spot.
5. Rest field counts: before the first chord, `moveTo` calls per frame = 252 (default), 45 (`spines` 50), 594 (`spines` 600);
   with `ground` 0, no `fill()` at rest.
6. Nothing moves between notes: a frame before the first chord and frames at ≥ last chord + 1.25 s give identical logs.
7. Determinism: two full plays give identical logs; a different `x.rnd` seed gives the identical log; `Math.random` never runs.
8. Stateless seek: a fresh instance whose first frame is at `chord.t + 0.1` logs exactly what continuous play logs at that t.
9. Velocity normalisation: the same clip with every velocity − 20 gives the identical log.
10. Repeat: two same-pitch notes 0.1 s apart: the second attack step again has a `fillStyle` with red ≥ 200.

## 7. Judge moments (60 Hz video, never the live lab)

- **Liebesleid picks, 172-244 s:** a slow picked melody: each note one fist, the turn and the black point clear.
- **Rach 2, 0-170 s:** the repeated chords (41 % repeat within 0.5 s): do repeats read as clenches, not re-spawns?
- **Winter Wind, 116 s and 206 s:** 12 to 17 attacks a second: the field should shudder a few degrees at a time, not boil.
- **The still question.** Take the frame **4 to 6 steps after an attack** (0.07 to 0.1 s). The attack step itself still
  carries the previous frame's teal nap ghost across the spot (about 50 green); it is gone by then while the near tips are
  still bright. Does the struck spot stay black, ringed by tips? Is the resting dark-teal nap visible around the fist, so the
  turn reads as a turn and not as needles spawning? And: no visible concentric rings of brightness.

## 8. Risks and fallbacks

- **Pattern, not picture / iron filings** (SYNTHESIS puts urchin with mica in "needs a long look"). The empty point is the
  defence (essay (f)); if it still reads as a diagram, lower `ground` and `spines` first.
- **The lie-back sweeps.** Bright needles rotating home leave a fan on the fading canvas; it may read as a motion with no note
  (essay (j), SYNTHESIS "check on video that it stays a quiet settling"). Fallback 1 **[plan]**: critically damped lie-back,
  `Δ*(1 + t/τ)*e^(-t/τ)` with `τ = 0.15*ring`, `Tend = 8τ`: zero initial speed, fastest when the heat is already about 0.4, so
  the sweep happens dim (it slightly holds the aim, against the essay). Fallback 2 **[plan, not in the essay or SYNTHESIS]**:
  settle on the next note: needles stay aimed while their tone falls and return to the nap in the step of the next attack
  anywhere, as Cut's "notes do, not time".
- **Teal ghost at the spot on the attack step.** No black disc with `source-over` by default: it erases other clips on the
  shared canvas, which the `lighten` rule exists to protect. Named fallback only: a black disc of radius `0.8*gap` on the
  attack step and hold, at the cost of erasing up to 23 px of other clips for 2 steps.
- **`spines` reshuffles the grid** when moved (by hand or by presence): every pivot jumps with no note. No drive on it;
  presence moves are rare; accept.
- **Dense music never rests:** at 17 attacks a second the nap may never show. Judge on Winter Wind; `ring` left shortens it.
- **Only fast repeats are clenches:** a repeat after about 0.3 s visibly re-turns about 22 % of Δ. This is the stateless rule.
- **Canvas:** every body is `lighten` at alpha 1 in a real colour, so the burn cannot eat the teal ground (SYNTHESIS rule 1).

## After review

- Lie-back is now the plan's fallback 1: critically damped `Δ*(1+t/τ)*e^(-t/τ)`, `τ = 0.15*ring`, `Tend = 8τ` (zero initial speed).
  The gap-cap release still uses `e^(-t/τ)`.
- Heat falls faster than the turn: `q = (E/P) * D² * near * (0.7 + 0.3u)` with `D = e^(-t/τ)`, so a needle is near ground tone
  before it moves fast.
- Colour no longer capped by the note's peak (E is divided by P). Ramp stops moved to teal 0.35, pale 0.65, bone 0.9.
- Tip ring: needles whose cap is under about 2.2·L0 stretch to the cap on the attack step (decay 0.1 s, scaled by stab) and count
  as nearest for colour, so a bright ring of tips closes on a black point of radius `gap`.
- Test: the seek test now compares against unfiltered continuous play and also checks a fresh instance at `CH[20].t + 0.3`.
- Not verified: the quiet settling still needs a 60 Hz video at Liebesleid 176 s.
