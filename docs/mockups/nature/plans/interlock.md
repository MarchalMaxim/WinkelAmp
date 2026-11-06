# Interlock (`interlock`): build plan

Spec: essay 7 §2 (`docs/mockups/nature/essays/7-muscle-and-tendon.md`) as changed by `SYNTHESIS.md` §4. Where this plan
differs from the essay it says so; follow this plan literally. Files: `lab/tools/interlock.js`, `tests/interlock.test.ts`.
`interlock` is already in `TOOL_IDS` (`lab/index.html` line 405) and in `lab/tags.json`; touch neither.

## 1. What the viewer sees

A horizontal seam across the middle of a black screen, never drawn, with the whole keyboard laid along it. Each note fires one
pair of straight full-height needles, one down from above the top edge and one up from below the bottom edge, offset by half a
tooth so they pass beside each other, there whole on the attack step, bone above and hot red below, then held still in dark
red until they fade to nothing. A scale zips the seam into a black zigzag mesh, and a repeated note drives the same needle
deeper and wider, like a ratchet. Texture word: **rigid** (and sharp).

## 2. Geometry and numbers

Canvas 1280 × 720. Seam `SEAM = 360`. All shapes are filled triangles; no strokes, no curves, no arcs, no blur, no shadow.

- **Place:** `px(m) = 40 + 1200·(m − 21)/87` (the essay's shared term). Pitch is the only thing that sets x.
- **Velocity:** once per CHORDS array, collect every `n.v` of every chord, sort ascending, `p10 = v[floor(0.1·(N−1))]`,
  `p90 = v[floor(0.9·(N−1))]`. Per note `u = clamp((v − p10)/(p90 − p10), 0, 1)`. **Guard:** if `N < 2` or `p90 − p10 < 1`,
  `u = 0.6` for every note. On picks (`!!x.picked`) use `u = 0.25 + 0.75·u` so a soft picked note is never a bare splinter.
- **Per note, before repeats:** `bite0 = BITE·(24 + 70·u)` px, `b0 = WIDTH·(8 + 36·u)` px, with `BITE = x.p('bite')`,
  `WIDTH = x.p('width')` (the essay's numbers).
- **The needle (changed from the essay):** the essay's fixed 520 px length puts the base on screen once depth passes 160 px
  (the ratchet cap is 200, and `bite` 2 reaches 188), and a visible flat base is a tooth. Instead **the base is pinned 40 px
  beyond the edge** and the length follows: upper base at y = −40, lower base at y = 760, length `400 + depth`.
- **The pair, in its own frame** (origin at the pivot `(px(m) + b/4, SEAM)`, y down, before the lean):
  - upper needle: apex `(−b/4, +depth)`, base corners `(−b/4 − b/2, −400)` and `(−b/4 + b/2, −400)`.
  - lower needle: apex `(+b/4, −depth)`, base corners `(+b/4 − b/2, +400)` and `(+b/4 + b/2, +400)`.
  - So the lower needle sits `b/2` right of the upper one (essay), each tip `depth` px past the seam.
- **Lean:** one angle per pitch for the whole pair (a rigid unit, so the two can never drift into each other):
  `a = (hash01(m) − 0.5)·5·π/180` (±2.5°). Screen point: `X = px(m) + b/4 + x·cos a − y·sin a`, `Y = 360 + x·sin a + y·cos a`.
  Compute the 6 points by hand; do not use `g.rotate`/`g.translate` (they would break batching).
- **hash01** (pitch-seeded; no `x.rnd`, no `Math.random` anywhere in the file):
  `let h = Math.imul(m + 0x9e37, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296;`
- **Checks the builder must keep true** (write them as comments next to the constants):
  - Bases off-screen at every setting: worst case `b = 88` (width 2, u 1), corner x offset ≤ 66, `sin 2.5° = 0.0436`, so a
    corner's y is at most `360 − 400·cos a + 66·0.0436 ≈ −36.7` (< 0), and the lower ones at least 756.7 (> 720). Full height always.
  - The pair never touches: at any height the gap between the upper needle's right edge and the lower needle's left edge is
    `(b/2)·(400 − depth)/(400 + depth)`, which is `b/6 > 0` at the 200 px cap. The black zigzag is always there.
  - Upper width at the seam is `b·depth/(400 + depth)`: it grows with depth, so a ratchet widens the needle by itself.
- **Chord:** every note of the chord fires its own pair in the same step (dedupe a pitch that appears twice in one chord: keep
  the first). Neighbouring semitones are 13.8 px apart, so loud chords overlap; overlaps simply merge (lighten, section 3).
- **Repeat = ratchet (stateless).** For a pitch m, its *chain* is the run of attacks on m, each less than `stays` seconds after
  the one before it. Only the **newest attack of the chain that has already sounded** is drawn (the older ones lie inside it).
  Walk the chain from its oldest link (at most 16 links back; start the walk there if it is longer) forward:
  - first link: `depth = min(200, bite0)`, `b = b0`.
  - each next link i: `depth_i = min(200, max(bite0_i, depth_{i−1} + RATCHET))`, `b_i = max(b0_i, b_{i−1})`, with
    `RATCHET = x.p('ratchet')`. The needle never gets thinner or shallower on a soft repeat. At the 200 cap only the flash
    counts. Tone age is measured from the **newest** attack.
- **Run/scale:** nothing extra. Each note bites at its own x, so a scale zips the seam; the travel is the music's own.
- **Bone budget:** bone may cover at most 6 % of the frame in a step = **55,296 px²**. Within one chord, sort its notes by u
  descending and add each upper needle's on-screen area `0.5·(b·(360 + depth)/(400 + depth))·(360 + depth)`; once the sum would
  pass 55,296, that note's upper needle strikes HOT instead of BONE (lower needles are HOT anyway).
- **State.** Stateless from `CHORDS` and `x.t`. The only thing kept is a cache keyed on the CHORDS array and its length
  (recomputed when either changes, cleared in `reset`): `p10`, `p90`, and per chord index a `Map` pitch → index of the previous
  chord containing that pitch (`prev`), and pitch → index of the next one (`next`). Nothing in `onChord` (`onChord() {}`).
  Find the current chord by binary search (copy `chordAt` from `handover.js`).

## 3. Time

Let `t = x.t − ch.t` (the newest attack of the chain), `S = x.p('stays')`, `f = SNAP.flash(t)` (1 for t < 0.033, the two-step
hold, then halving every 60 ms), `s = t/S`, and the **fall curve** `k = (1 − s)²·(1 + 2s)` for `0 ≤ s < 1` (1 − smoothstep:
it starts flat, so the mesh holds, and ends flat, so nothing cliffs off). The needle is gone at `t ≥ S`: draw nothing for it.

- **Colours:** `BONE = SNAP.BONE` = (236,226,208), `HOT = (214,58,40)`, `BODY = (90,16,18)` for **both** upper and lower bodies
  (SYNTHESIS). Do not hold the upper one in a dim bone: bone over red reads as teeth and gums.
- **Colour of a needle at age t:** `c = lerp(BODY, STRIKE, f)·k` per channel, then `Math.round`. STRIKE is BONE for the upper
  needle (HOT if over the bone budget), HOT for the lower. The strike colour does not depend on velocity (velocity is size and
  depth), so all needles of one chord share one upper and one lower colour and batch.
  At t = 0: exactly BONE / HOT. Once the flash is gone: (90,16,18), falling to (45,8,9) at s = 0.5 and to 0 at s = 1.
- **Attack step:** both needles whole, opaque, hard-edged, at full depth. No travel, no ring, no `SNAP.size`, no launch.
- **Hold:** the 2-step hold comes from `SNAP.flash`. After it the strike colour cools into BODY; the bone ghost on the canvas
  fades at the canvas's own rate (about 0.25 s). Do not correct for it.
- **Fall:** the needle **does not move**. The essay's slow pull-out `(t/1.4)^1.8` is dropped (SYNTHESIS): only its tone falls.
- **Tone rule:** every fill, strike and body alike, is drawn with `g.globalCompositeOperation = 'lighten'` and
  `g.globalAlpha = 1`, in a colour already at its target (SYNTHESIS's `tone()` helper, with k folded into the colour). Never
  `SNAP.alpha`, `SNAP.settles`, `SNAP.env`, or any alpha below 1. Restore `'source-over'` at the end (`g.save()`/`g.restore()`).
- **SNAP:** paste the block. Copy it with a node script (read `lab/snap/envelope.js`, slice from `// SNAP v1 begin` through
  `// SNAP v1 end`, insert it right after the IIFE's opening line), never by hand, LF endings. Used parts: `SNAP.flash`,
  `SNAP.BONE` only. No preset: the body is a held tone governed by `stays`, not a register half-life.
- **No motion without a note:** between attacks the triangle coordinates are identical every frame; only `fillStyle` changes.
  No seam line, no travelling front, no end-of-phrase anything. In silence the screen goes black within `S`.

## 4. Knobs

Four plus presence, in this order.

| key | label | min | max | default | less | hint |
|---|---|---|---|---|---|---|
| `bite` | how far they cross | 0 | 2 | 1 | – | How far a needle's tip crosses the middle line. Left: the tips just meet. Right: they go deep past each other. |
| `width` | how wide a needle | 0.3 | 2 | 1 | 0.6 | How wide a needle is at its root. Left: hairline splinters. Right: heavy wedges. |
| `stays` | how long the mesh stays | 0.3 | 4 | 1.4 | 0.3 | How long a needle stays after its note, standing still while it darkens. Left: gone in a third of a second. Right: the mesh holds for seconds. |
| `ratchet` | how much a repeat drives in | 0 | 40 | 24 | – | How much deeper the same note played again drives its needle. Left: a repeat only flashes. Right: each one goes visibly deeper. |
| `presence` | how present | 0 | 1 | 1 | (leads) | How much you see: how long the needles stay and how wide they are. Left: thin needles that are soon gone. Right: wide needles and a mesh that holds. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again. |

`presence` has `leads: true` and is never read. The `stays` label changed from the essay's "how long they take to pull out",
since nothing pulls out now. Icons (40 × 26 canvas, `ICON` helpers):
- `bite`: `ICON.line(g, w/2 − 3, 0, w/2 − 3, h/2 + v·8, ICON.ink, 1.5)` and `ICON.line(g, w/2 + 3, h, w/2 + 3, h/2 − v·8, ICON.red, 1.5)`: tips cross more as v grows.
- `width`: one filled triangle down from the top, `bw = 2 + v·14`: `g.beginPath(); g.moveTo(w/2 − bw/2, 0); g.lineTo(w/2 + bw/2, 0); g.lineTo(w/2, h); g.fillStyle = ICON.ink; g.fill();`
- `stays`: `ICON.fade(g, w, h, 0.1 + v·0.9, ICON.red)`.
- `ratchet`: three thin triangles from the top at x = 8, 20, 32, the n-th (n = 0, 1, 2) reaching `h·(0.5 + n·v·0.2)` deep, in `ICON.red`.
- `presence`: `ICON.much(g, v, w, h)`.

Tool entry: `{ id: 'interlock', name: 'Interlock', tag: 'new', blurb, params, reset, onChord, frame }`. Blurb:
"Each note fires a pair of straight needles, one from above and one from below, that pass each other along the middle line.
A scale zips the seam shut; the same note again drives its needle deeper. They stand still and darken away."

## 5. Draw order and cost

Per frame:
1. `cs = typeof CHORDS !== 'undefined' ? CHORDS : []`; refresh the cache if needed; `i = chordAt(cs, x.t)`; return if `i < 0`.
2. For `j = i` down to 0 while `x.t − cs[j].t < S`: for each deduped note m of `cs[j]`: skip it if `next[j].get(m)` exists and
   is `≤ i`; else walk the chain via `prev` (a link is kept while the gap is `< S`, at most 16), get `depth`, `b` and the two
   colours, and push the two triangles (6 points) into a `Map` colourString → list of triangles.
3. `g.save(); g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;`
4. For each colour group: `g.fillStyle = colour; g.beginPath();` per triangle `moveTo, lineTo, lineTo, closePath`; `g.fill();`
5. `g.restore()`.

Skip a group whose colour rounds to `rgb(0,0,0)`. No sprites, tiles or offscreen canvases: nothing baked in `reset`, 0 bytes.
Fills: one per distinct colour, normally 2 per live chord. Slow picks: 2 to 6. Winter Wind at 17 attacks/s × 1.4 s: about 24
live chords, about 50 fills, worst about 60, each of a few triangles: well under 1 ms. Do not quantise colours to save fills
(a stepped fall would show).

## 6. Tests (`tests/interlock.test.ts`)

Load the source like `tests/flee-snap-switch.test.ts`: `instantiate('interlock', SRC, { icon: { ink: '#fff', gauge() {} }, chords })`
with the same `recorder` Proxy and chords from `groupChords`. The context has `picked: false` and **no `onPicks`**. Make
`Math.random` throw during every run, and make `x.rnd` throw too (the widget must not use it). Assert:
1. TOOLS entry: id `interlock`, tag `new`, keys exactly `['bite','width','stays','ratchet','presence']`, presence
   `leads: true`, `stays.less === 0.3`, `width.less === 0.6`, every param has a label, a hint and an icon.
2. SNAP copy: the text between the markers equals `lab/snap/envelope.js`'s byte for byte, and the file has no `\r`.
3. Attack step: on the frame where a chord's t is first ≤ x.t, the log has fills with `fillStyle=rgb(236,226,208)` and
   `fillStyle=rgb(214,58,40)`.
4. Every `fill` happens while the last set `globalCompositeOperation` is `lighten` and the last `globalAlpha` is 1.
5. Stillness: for two consecutive frames with no attack between them, the `moveTo`/`lineTo` lines are identical; only the
   `fillStyle` lines differ.
6. Gone: one note at 1 s, default knobs: no `fill` at x.t ≥ 1 + 1.4 + 1/60; with `stays` 0.3, none after 1.3 s + 1/60.
7. Ratchet: pitch 60 at 1.0, 1.3, 1.6, 1.9 s, same velocity: the upper apex y (the largest y among the upper triangle's points,
   read from the log) on each attack step is 24 px more than the last, within 0.5 px, and never above 360 + 200 + 1. With
   `ratchet` 0 all four are equal. With `bite` 0 the first attack's apex is at 360 ± 1 (one CHORDS of one velocity gives u = 0.6 by the guard, so bite0 = 66 at default).
8. Full height: every upper triangle has a point with y < 0, every lower one a point with y > 720.
9. Velocity guard: a CHORDS of one note draws without throwing and draws something; an empty CHORDS draws nothing.
10. Seek determinism: the frame at t = 2.5 after playing from 0 equals a frame at t = 2.5 called cold after `reset`.
11. Two full runs of 6 s give the same log.

## 7. Judge moments

On the 60 Hz video, never in the live lab. Stills first (SYNTHESIS: Interlock is one of three that can fail on the first frame).
- **Liebesleid picks, about 172 to 244 s:** a slow picked line. One pair at a time, the ratchet on any repeat.
- **Rach 2, 0 to 170 s:** the repeated chords of the opening: each blow visibly deeper until the cap.
- **Winter Wind** (the health check starts at 116 s): the run zipping the seam; does the mesh stay a mesh or fill into a band?

The one question a still must answer: **is this a picture of teeth?** Straight sides, no lobes, no curve, full height. If any
still reads as a mouth, it fails, whatever else is good.

## 8. Risks and fallback

- **Teeth.** The guards are the essay's and SYNTHESIS's: straight sides, no lobes, no curve, no pink, needles at full height so
  it is a seam across a screen, not a mouth; plus this plan's pinned bases and one red body for both sides. If a still reads
  as teeth anyway, the docs name no further fallback; this plan's levers, in order: default `width` to 0.6 (needles, not
  wedges), then strike the upper needle HOT as well (no white above red). Report to the coordinator before changing defaults.
- **Dense music fills the seam.** At 12 to 17 attacks a second with `stays` 1.4, the mesh can merge into a solid red strip.
  The lever is `presence`/`stays`; note it in the verdict rather than adding a knob.
- **Hairlines at low `width`.** At width 0.3 the root is 2.4 px and the tip region sub-pixel; partly covered pixels settle
  lower under lighten (SYNTHESIS), so thin needles look dimmer than their tone. Acceptable; do not compensate.
- **The bone ghost** lasts about a quarter of a second after each strike. Nothing here relies on detail inside it.
- **The dropped pull-out** (SYNTHESIS): if the user misses the needles leaving, that is a question for them, not a change for
  the builder; motion without a note is a fake attack.

## After review

- Winding: every triangle now has the same signed area (the lower needle's two base corners are swapped), so overlapping same-colour upper and lower needles no longer cancel under the nonzero fill and leave black diamonds.
- Colour: the lerp from BONE to BODY (which passed through dusty pink) is gone. Each needle is two lighten fills: BODY*k for the held body, and the strike colour (BONE, or HOT over the bone budget; HOT below) * f * k on top. The bone cools as a neutral grey and sinks under the red; t = 0 is still exactly BONE / HOT. This replaces the "lerp(BODY, STRIKE, f)" line in "Colour of a needle at age t"; the budget, ghost timing and stays curve are unchanged.
- Tests added: same winding in every frame (dense, width 2), one colour group after the flash, no pink while cooling, the bone budget on a 12-note fortissimo chord, the picks remap (u = 0.25 + 0.75u), and cold-seek equality at six instants including a ratchet chain.
- Not changed: needle length against the crossing band (the reviewer's note on stalactite streaks); it is the plan's geometry, so left alone.
