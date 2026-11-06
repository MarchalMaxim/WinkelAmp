# Film (`film`): build plan

Spec: essay 4 §4 Film, as changed by SYNTHESIS §6. This plan settles everything the two leave open; follow it literally. Files: only
`lab/tools/film.js` and `tests/film.test.ts`. Do not touch `lab/index.html` (the coordinator registers `film` in `TOOL_IDS`).

## 1. What the viewer sees

One flat ink-blue sail, the only shape on stage, whose corners are the last three notes: every edge is scooped inward so the long ones are
deep curves and the corners close to needles. On each note the oldest corner jumps to the note's place in that same step, whips a little
past and rings back, and the tip it lands on is bone for a moment, so a wide leap shows as a long deep scoop. The word is **taut**
(elastic and sharp): a membrane held only by its own tension.

## 2. Geometry and numbers (canvas px, W 1280, H 720)

**Precompute, once per CHORDS** (cache in the IIFE by `cs` identity and `cs.length`, like `SNAP.rolls`; build lazily in `frame`;
knob-independent, so knobs can move live without rebuilding). `cs = typeof CHORDS !== 'undefined' ? CHORDS : []`.
- Flattened note list `F`: chord by chord, each chord's notes sorted by `m` ascending. Entry `{ ci, m, v, u, x, y }`; also
  `first[ci]`, `last[ci]` (index range in `F`).
- **Velocity:** `p10`, `p90` of all `v` in `F` (sort a copy; index `floor(0.1·(N−1))`, `floor(0.9·(N−1))`). `u = clamp((v − p10)/(p90 − p10), 0, 1)`;
  if `p90 − p10 < 4` (one note, or all equal) `u = 0.5`. At draw time on picks: `uu = x.picked ? max(0.35, u) : u`.
- **Pitch to place** (clip-normalised so a real melody spans the frame): `lo`, `hi` = p5, p95 of all `m`; if `hi − lo < 24` then
  `mid = (lo + hi)/2, lo = mid − 12, hi = mid + 12`. `q = clamp((m − lo)/(hi − lo), 0, 1)`. `x = W·(0.06 + 0.88q)`,
  `yPitch = H·(0.90 − 0.80q)` (high notes up).
- **y (SYNTHESIS change 1):** five candidates from `mulberry32(seed)`, `seed = (Math.imul(ci + 1, 0x9E3779B1) ^ Math.imul(m + 1, 0x85EBCA77)) >>> 0`
  (chord index and pitch, so a repeat gets new candidates and a new shape; never `x.rnd`, whose stream depends on frame order).
  `yC_k = H·(0.10 + 0.80·r_k)`, `y_k = 0.5·yPitch + 0.5·yC_k`. Pick the k with the largest triangle area `|cross(P_k − F[j−2], F[j−1] − F[j−2])|/2`
  against the two entries placed before it in `F` (strict `>`, ties keep the lower k); for `j < 2` take k = 0. This is only an
  anti-collapse rule.
- mulberry32: `a = (a + 0x6D2B79F5) | 0; t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296`.

**Per frame, the corner set of chord `i`** (`i = chordAt(cs, x.t)`, the binary search from handover.js; return if `i < 0`). Constants:
`FALL = 0.25`, `K = round(x.p('corners'))`, `stay = x.p('stay')`.
- **Phrase start `ps`** (restart after silence): `j = i`; while `j > 0 && j > i − 8 && cs[j].t − cs[j−1].t < stay + FALL` do `j−−`; `ps = j`.
  A sail that was already gone never comes back: the first note after silence starts a fresh one. Decided at the attack, so no fake attack.
- **Count:** `n_j = min(7, cs[j].notes.length)`. `c = clamp(max(K, n_ps), 3, 7)` at `ps`; for `j = ps+1..i`: `c = clamp(max(K, n_j, c − 1), 3, 7)`.
  So a 6-note chord leaves 6, 5, 4, 3 corners over the next single notes. (8 chords of look-back is exact: the two recursions meet within 4 steps.)
- **Pads** (fewer than 3 notes in the phrase): `T0 = F[first[ps]]`. `padA = (T0.x − 240, T0.y + dy)`, `padB = (T0.x + 240, T0.y + dy)`,
  `dy = T0.y > 0.6H ? −190 : 190`, x clamped to `[0.04W, 0.96W]`, y to `[0.06H, 0.94H]`. Ids −1, −2, never ringing, never bone.
- **Set:** `L = [padA, padB, F[first[ps]] .. F[last[i]]]`; the set is the last `min(c, L.length)` entries of `L` (L has at least 3, so the sail always has 3 or more corners).
  For a chord of more than 7 notes this keeps its top 7.
- **New corners:** the entries of chord `i` that are in the set.
- **Overshoot vector `d`** for a corner born at chord `j` (only needed while `x.t − cs[j].t < 0.5`): build the sets for `j` and `j − 1` with
  the same procedure (same `ps` rule evaluated at `j`). If `j` is its own phrase start, `d = 0`. Otherwise the dropped entries are those of
  set(j−1) not in set(j), oldest first; chord `j`'s new notes, pitch ascending, take them in order: `from = dropped target`. A new note
  with nothing left to take (the count grew) uses `from` = centroid of set(j−1)'s targets. `d = target − from`.
- **Drawn position:** `a_c = x.t − cs[j].t`; `gap = j + 1 < cs.length ? cs[j+1].t − cs[j].t : Infinity`;
  `A = kick·(0.5 + 0.5·uu)·min(1, gap/0.15)` (the strobe cut from SYNTHESIS, built in from the start);
  `P = target + A·d·e^(−a_c/0.07)·cos(2π·8·a_c)` while `a_c < 0.5`, else exactly `target`. At `a_c = 0` the corner is `kick` beyond its target.
- **Order:** sort the set by `atan2(ty − Cy, tx − Cx)` of the **targets** around the targets' centroid (ties by `F` index, pads first).
  The order changes only when the set does, i.e. only on an attack step.
- **Scoops (one per edge `A → B` of the drawn polygon, wrapping):** `c = |B − A|`; `M = (A + B)/2`; `C` = centroid of drawn P;
  `n̂` = unit normal of `B − A` turned toward `C` (flip if `dot(n̂, C − M) < 0`).
  `s = min(0.35c, (slack/0.6)·c²/7200)` (Rc = 900 px at the default slack 0.6: a 600 px edge sags 50 px, 1000 px 139 px, 200 px 6 px).
  **Needle cap:** interior angle at each vertex `θ = atan2(σ·cross(b, a), dot(b, a))` (add 2π if negative), `a = P_prev − P`, `b = P_next − P`,
  `σ = sign(shoelace area of drawn P)`; `φ = min(θ/2 − 0.035, 1.40)`; `s ≤ (c/4)·tan(min(φ_A, φ_B))`, and `s = 0` if that min is ≤ 0.
  Adjacent scoops then never cross; a corner closes to about 4° wide.
  **Drum-tight blow:** an edge touching a new corner of chord `i` has `s ×= 1 − 0.5·e^(−a/0.07)` while `a = x.t − cs[i].t < 0.5`, else `×1`.
  Control point `Q = M + 2s·n̂` (a quadratic's apex sits at half its control offset). If `c < 1`, use `lineTo`.
- **Chord:** every note of the chord becomes a corner at once (up to 7): a spiky star for that moment. **Repeat:** a new corner in the same
  column at a new height (new seed), so the shape changes and the tip flashes again. **Fast run:** one bright tip per note, overshoot shrunk by the gap.
- **State kept:** only the precompute cache (derived from CHORDS alone). `reset() {}`, `onChord() {}`. Everything else from `x.t − ch.t`.

## 3. Time

- **Attack step** (`a < dt`): the new sail is drawn whole: body at its peak tone, new corners at `target + A·d`, their edges at half sag,
  and a bone wedge at each new tip. No swelling in, no travel.
- **Hold and fall:** position and sag ring for 0.5 s, then nothing moves at all until the next note. The tone only falls.
- **Tone rule** (SYNTHESIS rule 1): every fill uses `lighten`, alpha 1, real target colour, with SYNTHESIS's `tone(g, rgb, k)` copied verbatim
  outside the SNAP markers. Restore `g.globalCompositeOperation = 'source-over'` at the end of frame.
  - **Body:** `BODY = [40, 68, 196]`. `uN` = max `uu` over chord i's notes. `pk = 0.85 + 0.15·uN`.
    `kb = pk·(0.65 + 0.35·0.5^(a/0.25))·(1 − smoothstep(stay, stay + FALL, a))`. Peak at u = 1 is (40,68,196); held it is (26,44,127),
    the colour SYNTHESIS names (blue channel ≥ 108 even at u = 0). The essay's fall to 0.45 is raised to 0.65 so the held blue stays live.
  - **Wedge:** `f = SNAP.flash(a)`; colour `w = round(body·kb·(1 − f) + BONE·f)` per channel (`BONE` = `SNAP.BONE` = 236,226,208), drawn while
    `a < 0.4`. It is the part of the sail within `r = 90 + 120·uu` px of each new tip: clip to the sail path, fill circles at the tips.
    Bone for the hold (`SNAP.H` = 0.033 s), halving every 60 ms, then the body; under `lighten` the canvas fade cools it at about the same rate.
- **Gone:** at `a ≥ stay + FALL` frame returns before drawing anything. The previous sail's area outside the new one is a 5 to 15 step
  after-image of the canvas, never drawn by code.
- **Dropped from the essay** (SYNTHESIS): the end-of-phrase pull into the centroid. No motion without a note, no travelling front, no staged ending.
- **SNAP block: pasted, used only for `SNAP.flash`, `SNAP.H`, `SNAP.BONE`.** No preset: `SNAP.env` does not fit a sail that holds at 0.65
  until `stay`. Write the file with one line `// @@SNAP@@` inside the IIFE where handover has its block, then run (Git Bash, from the worktree):
  `cd C:/Users/maxim/Desktop/projects/github/WinkelAmp/.claude/worktrees/find-saved-visualization-a8a8fb && node -e "const f=require('fs');const e=f.readFileSync('lab/snap/envelope.js','utf8');const b=e.slice(e.indexOf('// SNAP v1 begin'),e.indexOf('// SNAP v1 end')+14);const p='lab/tools/film.js';f.writeFileSync(p,f.readFileSync(p,'utf8').replace('// @@SNAP@@',()=>b))"`
  and never edit between the markers afterwards. Keep the file LF only.

## 4. Knobs (4 plus presence)

| key | label | min | max | default | less | step |
|---|---|---|---|---|---|---|
| `corners` | how many notes hold it | 3 | 7 | 3 | none | 1 |
| `slack` | how deep the edges curve in | 0 | 1 | 0.6 | none | |
| `kick` | how far a corner overshoots | 0 | 0.4 | 0.14 | none | |
| `stay` | how long it stays | 0.3 | 4 | 2 | 0.6 | |
| `presence` | how present | 0 | 1 | 1 | `leads: true` | |

Hints:
- corners: 'How many of the last notes are corners of the sail. Left: three corners, each note a big change. Right: a seven-pointed star, each note a small one.'
- slack: 'How deeply the edges curve inward. Left: straight edges, a hard polygon. Right: deep scoops, the corners drawn out to long needles.'
- kick: 'How far a new corner whips past its place before it settles. Left: it lands dead. Right: it whips past and rings back.'
- stay: 'How long the sail stays when no note comes. Left: gone soon after the line stops. Right: it hangs for seconds.'
- presence: 'How long the sail lingers once the music stops. Left: it is gone soon after the last note. Right: it hangs for up to two seconds. Moving it sets that knob; set it by hand afterwards and it holds until you move this again.'

Icons (v = 0..1 along the slider; colour `ICON.blue`):
- corners: a concave star, `n = 3 + round(4v)` points, outer radius `h/2 − 2`, inner `0.35×` that, centred; one path of `2n` lineTo, `fill`.
- slack: three corners of a triangle (centre `w/2, h/2`, radius `h/2 − 2`), each side a `quadraticCurveTo` whose control point is pulled
  toward the centre by `v·0.9` of the way from the side's midpoint; fill.
- kick: `ICON.line(g, w·0.6, 4, w·0.6, h − 4, ICON.dim, 1)`, then `ICON.arrow(g, 4, h/2, w·0.6 + v·(w·0.4 − 4), h/2, ICON.blue)`.
- stay: `ICON.fade(g, w, h, 0.1 + v·0.9, ICON.blue)`. presence: `ICON.much(g, v, w, h)`.

Presence moves only `stay`. `corners` deliberately has no `less`: the essay's `less: 3` equals its default, so presence would do nothing
except overwrite a hand-set value with 3. Entry: `id: 'film', name: 'Film', tag: 'new', on: false`, blurb: 'One ink-blue sail whose corners
are the last notes. Each note pulls the oldest corner to its own place in one step, whipping past and back with a bone tip; every edge is
scooped taut, so a wide leap is a deep curve, and the corners close to needles.'

## 5. Draw order and cost

```
cs, i, a = x.t − cs[i].t; return if i < 0 or a ≥ stay + FALL
plan = cached precompute; set, positions P, order, controls Q          // ≤ 7 corners, ≤ 2 extra set builds per ringing corner
g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1
tone(g, BODY, kb); g.beginPath(); g.moveTo(P0); quadraticCurveTo(Q_k, P_k+1) ×n; g.closePath(); g.fill()      // nonzero
if (a < 0.4) { g.save(); g.beginPath(); same sail path; g.clip();
  tone(g, w); g.beginPath(); for each new tip: g.moveTo(px + r, py); g.arc(px, py, r, 0, 2π); g.fill(); g.restore() }
g.globalCompositeOperation = 'source-over'
```
No sprites, no tiles, nothing baked in `reset`. One fill when held, two in the first 0.4 s after a note. Precompute: 5 candidates per note,
under 5 ms for 10 000 notes, done once per song.

## 6. Tests (`tests/film.test.ts`)

Load like `tests/flee-snap-switch.test.ts`: `readFileSync('lab/tools/film.js')`, `instantiate('film', SRC, { icon, chords: CHORDS })` (not
`loadCatalogue`: `film` is not in `TOOL_IDS` yet), the same Proxy recorder for `g`, `x` with `t, dt: 1/60, W, H, picked: false,
p: (k) => vals[k]` and **no `onPicks`**, `rnd` that throws, and `Math.random` replaced by a thrower for the run. `play(notes, knobs, secs)`
returns per-frame logs. The ICON stub, shared by `instantiate` and the icon test: `new Proxy({ ink: '#fff', blue: '#4f86c6', dim: '#6d635b', red: '#c43a2c' }, { get: (o, k) => k in o ? o[k] : () => {} })`, so `ICON.line`, `arrow`, `fade`, `much` are no-ops and colours are strings. Songs: a sparse melody (notes every 1.5 s, pitches 60..84), a fast run (0.08 s apart), a 6-note chord followed by
single notes 0.3 s apart, a repeated pitch 0.6 s apart, a single note, a 6-note chord then 4 s of silence then one note. Assert:
1. Entry: id, name, tag `'new'`, `on` false, blurb string; keys exactly `['corners','slack','kick','stay','presence']`; the table above
   (min, max, value, step, `less` only on `stay` = 0.6, `leads` on presence); every hint has 'Left' and 'Right'; every icon runs at v 0 and 1 on a recorder.
2. On the attack's own step something is drawn: the frame's log has `fill(`, `globalCompositeOperation=lighten`, and a `fillStyle` of
   `rgb(236,226,208)`; the last composite set in the frame is `source-over`.
3. Nothing moves between notes: in the sparse song, frames 0.6 s and 1.2 s after an attack have identical path calls (`moveTo`,
   `quadraticCurveTo`, `lineTo`, `arc`, `closePath`); only `fillStyle` may differ, and its blue channel does not rise.
4. Gone: from `stay + 0.25` after the last chord the frame logs nothing; at `stay` = 0.3 that is 0.55 s.
5. Stateless: for t in {attack + 0, + 0.1, + 0.3, + 1.0} of several notes, the log of `frame` at t after playing 0..t equals a fresh
   instance's single `frame` at t.
6. Determinism: two full runs give the same log; Math.random and x.rnd were never called; no `NaN` or `Infinity` in any log (also for the single-note song).
7. Corner count: in held frames (a > 0.5) count `quadraticCurveTo` plus `lineTo` calls in the body path: 3 for single notes; 6, 5, 4, 3 after the 6-note chord;
   with `corners` = 5, single notes give 5 once 5 notes exist; after the silence, the lone note gives 3 (pads), not 5.
8. A repeat changes the shape: held path calls after repeat k and repeat k+1 differ.
Also run `npx vitest run tests/film.test.ts tests/snap-envelope.test.ts` and `npx tsc --noEmit -p .` if the repo has it; both pass.

## 7. Judge moments (60 Hz video, never the live lab)

- **Liebesleid picks, about 172 to 244 s** (slow melody): the still must answer **"is this one ink-blue sail with scooped edges and needle corners?"**,
  not a polygon, not a blob. Look for a wide leap reading as a long deep scoop.
- **Rach 2, 0 to 170 s:** the opening chords (7-corner stars cut back one note at a time) and the repeated chords (shape changes each time).
- **Winter Wind:** do fast flips strobe? At 12 notes a second the sail must read as one flapping shape with one bright tip per note.

## 8. Risks and fallbacks

- **Strobe on fast runs** (SYNTHESIS's named test). Built in: overshoot × `min(1, gap/0.15)`. If it still strobes, use `gap/0.25`, then `kick` = 0 by default.
- **Pitch on both axes collapses the sail to a diagonal.** The 0.5 area mix is the guard; if stills show slivers, mix 0.65 toward the candidate (a constant).
- **The sail covers 30 % of the frame (P12).** The body stays deep blue at 127 or less, only the wedge goes bone; never raise BODY.
- **Reads as a polygon morph.** The swap test: scoops are the idea. If edges look straight at the default, raise slack's default, not Rc.
- **Pads look staged after silence.** They are drawn only on an attack; if they read as fake, draw the lone note as its wedge alone until 3 notes exist.
- **Rolled chords** are 3 to 6 chords 40 to 120 ms apart, so the sail flips that often in 0.3 s. Fallback: treat `SNAP.rolls(cs)` members as one attack (only the `top` chord moves corners); the block is already pasted.
- **Fallback named by the essay:** none beyond the above. SYNTHESIS: if flips strobe, cut overshoot by the gap; the centroid shrink stays dropped.

## After review

- Wedge is now a real triangle (tip plus the points r px along both adjacent edges), clipped to the sail, so the bone cap ends in a straight cut. r = (50 + 70uu) * clamp(gap/0.25, 0.3, 1) * tips, capped at 0.35 of the shorter adjacent edge. Drawn only while a < min(0.12, gap), which ends it before the ring's first swing back and removes the stair-stepped rims.
- Overshoot gap cut is now gap/0.25 (first fallback). kick default stays 0.14 (second fallback not needed: Winter Wind now shows the new sail plus one fading previous sail, not 2 to 3 shards).
- Scoop radius is tied to the sail: Rc = clamp(longest edge, 300, 900) instead of a fixed 900, so small sails visibly curve; large sails are unchanged.
- New plain knob `tips` (0..1, default 1, less 0.3) scales the wedge, so presence now changes ink on dense music. Knobs are now 5 plus presence.
- Skipped: merging rolls and near-simultaneous notes into one attack; the stills did not need it.
