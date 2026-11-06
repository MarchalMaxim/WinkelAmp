# Tack (`tack`): build plan

Planner's brief for one Sonnet builder. Spec: essay 4 §3 Tack, with SYNTHESIS §7 changes (waist 1 px, moved fibres drawn at their
envelope directly, slab held with `tone` near (96,16,18), seam tilted ±12° by pitch). Where this plan is more exact than the essay, follow
this plan. Files you write: `lab/tools/tack.js`, `tests/tack.test.ts`. Nothing else. `tack` is already in `TOOL_IDS`.

## 1. What the viewer sees

Each note is a flat dark-red slab with hard square corners, split along a seam tilted a few degrees, and already torn open on its own
attack step, its gap filled edge to edge with a comb of thin bone hourglass fibres. Within about a tenth of a second the fibres snap in
no spatial order, each leaving a short bone spike on both faces that shrinks away by 0.35 s, and the slab then cools in place to nothing.
The word it delivers: **tacky**, fuzzy only while it is being stretched, elastic in the tear.

## 2. Geometry and numbers

Canvas W = 1280, H = 720. All lengths in canvas px. `d2r = Math.PI / 180`.

**Velocity, normalised once per CHORDS array.** `CHORDS` is the global the harness passes (`typeof CHORDS !== 'undefined' ? CHORDS : []`).
Cache `{n: CHORDS.length, p10, p90}` in module scope; recompute when `CHORDS.length` changes (the lab fills it after load). Collect every
`n.v` of every chord, sort ascending, `p10 = vs[Math.floor(0.1 * (N - 1))]`, `p90 = vs[Math.floor(0.9 * (N - 1))]`.
`u = (N < 2 || p90 - p10 < 1) ? 0.6 : clamp((v - p10) / (p90 - p10), 0, 1)`; then if `x.picked`, `u = Math.max(u, 0.35)`.
Nothing below reads `v` directly; everything reads `u`.

**Place (Handover's mapping).** `oct = Math.floor(m / 12) - 1`;
`cx = (0.06 + 0.88 * x.pitch01(m)) * W`;
`cy = H * (0.84 - 0.68 * clamp((oct - 1) / 7, 0, 1)) - ((m % 12) - 5.5) * 3`, then `cy = clamp(cy, 0.2 * H, 0.8 * H)`.

**Tilt.** `theta = (hash(m, 911) * 2 - 1) * 12 * d2r`. Pitch alone, so the same key always tears at the same angle.

**Slab.** `n` = number of notes in that chord. `w = (230 + 330 * u) / Math.sqrt(n)` (230 to 560 for one note).
Each half is `w` wide and `hh = 0.3 * w` tall (the whole closed slab is 0.6w). `G = (40 + 160 * Math.pow(u, 1.3)) * pull` (40 to 200 at pull 1).
In slab-local coordinates (seam along local x, origin at the seam centre), with gap `s` (section 3):
top half `x in [-w/2, w/2], y in [-s/2 - hh, -s/2]`; bottom half `x in [-w/2, w/2], y in [s/2, s/2 + hh]`. Plain rectangles: no rounding, no
lip, no bevel, no shadow, no blur.
Local to canvas: `X = cx + lx * cos(theta) - ly * sin(theta)`, `Y = cy + lx * sin(theta) + ly * cos(theta)`. Compute points in JS; never
`g.rotate`, so all slabs batch into shared paths.

**Fibres.** Spacing `dsp = 10 / comb` px (comb default 2 gives 5 px; `less` 1 gives 10 px). Count `NF = Math.max(1, Math.floor(w / dsp))`.
Fibre `i` (0..NF-1): `fx = -w/2 + (i + 0.5) * dsp + (jit * 2 - 1) * 1.0` (±1 px). Root width 4 px (half 2), waist 1 px (half 0.5).
Intact hourglass, 6 points, straight lines: `(fx-2, -s/2) (fx-0.5, 0) (fx-2, s/2) (fx+2, s/2) (fx+0.5, 0) (fx+2, -s/2)`, closePath.
Snapped (it breaks at the waist): top spike triangle `(fx-2, -s/2) (fx, -s/2 + L) (fx+2, -s/2)`; bottom spike `(fx-2, s/2) (fx, s/2 - L) (fx+2, s/2)`.
Fibre counts at comb 2: 46 (soft chord member) to 112 (loud single note); at comb 3.3: up to 186.

**Seeded detail, no `x.rnd` anywhere.** A pure integer hash (copy exactly; it mixes, so consecutive indices are not ordered):
```js
const hash = (a, b = 0) => { let t = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul(b | 0, 0x85EBCA77)) + 0x6D2B79F5 | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const TAB = new Float32Array(256); for (let k = 0; k < 256; k++) TAB[k] = hash(k, 0x7ac);   // module scope, built once
```
Per slab: `seed = Math.floor(hash(ci, m) * 256)` where `ci` is the chord's index in CHORDS (stable across seeks, so a repeat gets fresh
fibres). Per fibre: `snapU = TAB[(i + seed) & 255]`, `jit = TAB[(i + seed + 85) & 255]`, `resU = TAB[(i + seed + 170) & 255]`.

**Chord rule.** One slab per note, `w` divided by `sqrt(n)`. Each note has its own tilt, place, seed.
**Repeat rule (the only state rule).** When collecting live slabs, keep only the newest occurrence of each pitch. The older slab of that pitch
is simply not drawn from the repeat's attack step on; the new slab starts its own tear (section 3).
**Stateless.** `reset() {}` and `onChord() {}` are empty. Each frame:
binary-search `i0` = last chord with `CHORDS[i].t <= x.t` (copy Handover's `chordAt`); walk `j = i0, i0-1, ...` while `j >= 0`,
`x.t - CHORDS[j].t < Math.max(stay, 0.5)` and at most 32 chords back. For each note of each chord, skip it if its pitch was already seen
(newer wins), else add `{m, u, n, ci: j, t0: CHORDS[j].t}`. Stop at 8 slabs. Age `t = x.t - t0`. Drop a slab when `t >= stay`.
Nothing else is kept between frames except the p10/p90 cache.

## 3. Time

Hold `H = SNAP.H` (0.033 s). Every frame recomputes everything from `t`.

**Gap** (both the attack and a repeat use this; a repeat's old slab is dropped, so the seam visibly snaps from about 0.84G to 0.4G and reopens):
```
R(t) = t < 0.08 ? 0 : 1 - Math.exp(-(t - 0.08) / 0.04) * Math.cos(2 * Math.PI * 5 * (t - 0.08))
s(t) = G * ((1 - 0.6 * Math.exp(-tc / 0.07)) - 0.15 * R(tc)),  tc = Math.min(t, 0.3)
```
Values (times G): t 0: 0.400, step 1: 0.527, step 2: 0.627, 0.05 s: 0.706, 0.08: 0.809, 0.13: 0.756 (the one small ring), 0.2: 0.809,
0.3: 0.842, and frozen from 0.3 s on. Halves never move after 0.3 s.

**Fibres.** `tackK = x.p('tack')`. Snap time `tau = tackK * (0.2143 + 0.7857 * snapU)` (0.03..0.14 s at default; at 0.02 they all go on step 1).
Intact while `t < tau`: hourglass at tone 1 (full bone). After: `Tend = Math.max(0.35, tau + 0.12)`,
`Q = 1 - smoothstep(tau, Tend, t)` (0 from Tend on, then not drawn), `res = 6 + 12 * resU`,
`L = (res + (s(tau) / 2 - res) * Math.exp(-(t - tau) / 0.04)) * Q`. Spike tone = `Q`, quantised up into 3 buckets: `lvl = Math.ceil(Q * 3) / 3`
(1, 2/3, 1/3); skip if `Q <= 0.02`. Spikes are moved marks: drawn at their envelope directly with `lighten`, never through `SNAP.alpha`.
Spikes attach to the current faces (`±s(t)/2`). At 0.1 s the edge has nap; by 0.35 s (or Tend) it is a clean edge.

**Slab colour (the tone rule, every frame).** `HOLD = [96, 16, 18]`, `STRIKE = [140 + 80 * u, 22, 24]` (rounded; 220,22,24 at u 1).
`c(t) = HOLD + (STRIKE - HOLD) * SNAP.flash(t)` (STRIKE for the two hold steps, back to HOLD by about 0.2 s).
Fall: `t0f = Math.min(0.2, 0.5 * stay)`; `D = t <= t0f ? 1 : Math.pow(0.5, (t - t0f) / (0.25 * (stay - t0f))) * (1 - smoothstep(0.8 * stay, stay, t))`.
Drawn colour `round(c(t) * D)`, D exactly 0 at `t = stay`. At stay 1.2: half-life 0.25 s, (48,8,9) at 0.45 s, (12,2,2) at 0.95 s, gone at 1.2 s.
The slab is never lit toward bone: bone is only the fibres (under 2 % of the frame per slab).
**Fibre colour.** `BONE = SNAP.BONE` (236,226,208) times `lvl`: (236,226,208), (157,151,139), (79,75,69).

**The `tone` helper**, outside the SNAP markers, exactly as SYNTHESIS gives it:
```js
const tone = (g, rgb, k = 1) => { g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
  g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`; };
```

**SNAP block: pasted, used only for `SNAP.H`, `SNAP.flash` and `SNAP.BONE`.** No preset, no `SNAP.env`, no `SNAP.alpha`/`settles`
(the tone rule replaces them, and `stay` must be the exact gone time). Copy it programmatically: write `tack.js` with a single line
`// SNAP-PASTE-HERE` directly after `(() => {`, then run
```
node -e "const fs=require('fs');const e=fs.readFileSync('lab/snap/envelope.js','utf8');const B='// SNAP v1 begin',E='// SNAP v1 end';const blk=e.slice(e.indexOf(B),e.indexOf(E)+E.length);const f='lab/tools/tack.js';fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('// SNAP-PASTE-HERE',()=>blk))"
```
(the function form of replace keeps `$` sequences literal). Check no `\r` in the file afterwards.

**Gone.** A slab and all its parts are not drawn from `t >= stay`. Spikes are also cut at `t >= stay` (no floating spikes).
**No motion without a note.** After 0.35 s (Tend at most 0.47 s) no coordinate changes; only the slab colour falls. No fake attacks, no
front along the seam (snap order is hashed), no end-of-phrase staging, nothing depends on the next note.

## 4. Knobs (4 + presence)

| key | label | min | max | default | less |
|---|---|---|---|---|---|
| `pull` | how far it tears | 0.4 | 2 | 1 | 0.6 |
| `comb` | how many fibres | 0.7 | 3.3 | 2 | 1 |
| `tack` | how sticky | 0.02 | 0.35 | 0.14 | none |
| `stay` | how long a slab stays | 0.3 | 2.5 | 1.2 | 0.5 |
| `presence` | how present | 0 | 1 | 1 | `leads: true`, never read |

`comb` is fibres per 10 px (spacing `10 / comb`): the essay's spacing 14..3 px, default 5, less 10, turned round so min < max and Left is few.
Hints (one sentence each, Left/Right):
- pull: 'How far a note tears its slab open. Left: a crack with short fibres. Right: a wide gap with long ones.'
- comb: 'How many fibres hold the two halves together. Left: a few separate strings. Right: a dense pelt.'
- tack: 'How sticky the slab is. Left: the fibres all let go at once, a clean tear. Right: they hold and snap one after another, in no order.'
- stay: 'How long a torn slab stays. Left: gone in a third of a second. Right: a slow ember for two and a half seconds.'
- presence: 'How much you see: how far each note tears, how many fibres, how long a slab stays. Left: a narrow crack with a few strings, soon gone. Right: wide tears full of fibres that linger. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again.'

Icons (40x26):
- pull: two red bars with lines between, gap growing:
  `(g, v, w, h) => { const gap = 3 + v * 12, bh = (h - gap) / 2 - 1; ICON.rect(g, 4, 1, w - 8, bh, ICON.red); ICON.rect(g, 4, h - 1 - bh, w - 8, bh, ICON.red); for (let i = 0; i < 6; i++) ICON.line(g, 9 + i * 4.4, 1 + bh, 9 + i * 4.4, h - 1 - bh, ICON.ink, 1); }`
- comb: `(g, v, w, h) => ICON.lines(g, Math.round(3 + v * 12), w, h, { dir: 'v', col: ICON.ink })`
- tack: 7 vertical lines, each broken by a 4 px gap; at v 0 all at mid-height, at v 1 at scattered heights:
  `(g, v, w, h) => { const r = ICON.rng(3); for (let i = 0; i < 7; i++) { const lx = 6 + i * 4.6, yb = h / 2 + (r() - 0.5) * v * (h - 10); ICON.line(g, lx, 2, lx, yb - 2, ICON.ink, 1); ICON.line(g, lx, yb + 2, lx, h - 2, ICON.ink, 1); } }`
- stay: `(g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red)`
- presence: `(g, v, w, h) => ICON.much(g, v, w, h)`

Entry: `id: 'tack', name: 'Tack', tag: 'new', on: false`, blurb: 'One dark-red slab per note, torn open along a tilted seam on the attack, its
gap full of bone fibres that snap in no order within a tenth of a second and leave a brief nap of spikes on both faces. A repeated note shuts
the slab and tears it again. Pitch is the place; how hard a note is played is how far it tears.'

## 5. Draw order and cost

Per frame, after collecting live slabs (oldest to newest, any order works since `lighten` is per-channel max):
1. `g.save()`; `g.globalCompositeOperation = 'lighten'`; `g.globalAlpha = 1`.
2. Slab bodies: group slabs by their rounded rgb string (a Map). Per group: `beginPath()`; per slab two quads (`moveTo` + 3 `lineTo` +
   `closePath` each, rotated points); `tone(g, rgb)`; `fill()`. Skip a slab whose colour is (0,0,0).
3. Bone level 1: `beginPath()`; every intact fibre (6-point hourglass) and every spike with `lvl === 1`, of every slab; `tone(g, BONE, 1)`; `fill()`.
4. Bone 2/3: one path of those spikes, `tone(g, BONE, 2/3)`, `fill()`. 5. Bone 1/3: same with 1/3. Skip any empty bucket (no `fill` call).
6. `g.restore()`.
Fills: at most 8 slab groups + 3 bone = 11, typically 4 to 7. No sprites, no tiles, nothing baked; TAB is 1 KB.
Vertices worst case: 8 slabs x 186 fibres x 6 = about 9,000 `lineTo`, only during the first 0.35 s of each slab; default about 5 x 112 x 6.
No `filter`, no `shadowBlur`, no `drawImage`, no `g.rotate`/`translate`.

## 6. Tests (`tests/tack.test.ts`)

Load as `tests/flee-snap-switch.test.ts` does: copy its `recorder`, `instantiate('tack', SRC, { icon, chords: CHORDS })`, `groupChords(NOTES)`,
a seeded `x.rnd` that throws if called, `Math.random` replaced by a thrower. **Do not use `loadCatalogue`** (other ids may have no file yet).
Context: `{ g, t, dt: 1/60, W: 1280, H: 720, picked: false, pitch01: (m) => Math.max(0, Math.min(1, (m - 21) / 87)), p: (k) => vals[k], rnd: thrower }`.
The ICON stub must have `ink, red, rect, line, lines, rng, fade, much` as no-op functions (icons are not called).
Assert:
1. Shape: one tool, id 'tack', name 'Tack', tag 'new', blurb string; keys exactly `['pull','comb','tack','stay','presence']`; every
   `min < max`, `min <= value <= max`, hint has 'Left' and 'Right', `icon` is a function; presence `leads: true`, `less` only on pull (0.6),
   comb (1), stay (0.5); at most 6 params.
2. Attack in its own step: a lone note at 1.0 s; the frame where `x.t` first reaches 1.0 has at least 2 `fill()` calls and `globalCompositeOperation=lighten`.
3. Every `fill` happens while the last set `globalCompositeOperation` is 'lighten' and `globalAlpha` is 1; `save`/`restore` balanced per frame.
4. Stillness: lone note, stay 1.2; the logged `moveTo`/`lineTo` lines in the frame at t0 + 0.5 equal those at t0 + 0.9; the `fillStyle` lines differ.
5. Gone: no `fill` in the frame at t0 + stay + 0.02 (try stay 0.3 and 1.2).
6. Repeat: notes at pitch 60 at 1.0 and 1.5 (same velocity); the frame at 1.86 has exactly 2 `moveTo` (one slab, all spikes gone), where
   two different pitches at the same times give 4.
7. Determinism and seek: two full runs (0..6 s, the flee test's 40-note song) give equal logs; a fresh instance whose first call is
   `frame` at t = 3.2 (no `onChord`) logs exactly what the continuous run logged at 3.2.
8. Normalisation: the same song with every velocity -20 (the flee song spans 60..110, so 40..90, nothing clipped) logs exactly the same.
9. Picks floor: with `picked: true` and a 1-note song (u guard 0.6) nothing throws; with a 2-velocity song (40 and 100) the soft note's
   slab is wider with `picked: true` than without (compare x-extent of its `moveTo`/`lineTo` points at t0 + 0.5).
10. `tests/snap-envelope.test.ts` must still pass (it checks the pasted block). Run: `npx vitest run tests/tack.test.ts tests/snap-envelope.test.ts`.

## 7. Judge moments

- **First, a still:** Liebesleid picks, the first note after 172 s, at age 0.08 s (fibres mid-snap, gap 0.81G). The one question: **does a
  dark-red slab split by strands read as a mouth?** Hard square corners, no lip, seam tilted ±12° by a hash of the pitch. Then a still at 0.5 s
  (clean edges, dim slab): does a closed-ish red bar with a dark seam still read as lips?
- Liebesleid picks 172-244 s, 60 Hz video: does the tear read per note, and does the out-of-order snap read as tearing or as a comb fading?
- Rach 2 0-170 s: the repeated chords (41 % repeats). Each repeat must read as shut-and-tear, not jaw motion.
- Winter Wind: at 12-17 attacks/s, do the slabs overlap into red mush, and do 8 slabs of fibres stay under budget.

## 8. Risks and fallback

- **Mouth.** The still can pass and the motion still read as a jaw: open, ease back 15 %, and shut-and-reopen on every repeat. SYNTHESIS names
  only square corners, no lip and the ±12° tilt as cures, plus looking at the first still with that question. Neither SYNTHESIS nor the
  essay names a further fallback; if it reads as a mouth, report it to the coordinator rather than inventing one in code.
- **Ghost hides the snap.** An intact bone fibre that snaps at 0.05 s stays visible (about 118 of 236) for about 5 more steps, so the whole snap
  sequence plays inside the ghost window. The lever is the `tack` knob (longer stickiness spreads the snaps past the ghost), not a new mechanism.
- **Chords overlap.** Neighbouring pitches sit 13 px apart, so a close chord stacks slabs with different tilts; `lighten` merges them per
  channel and cannot cover. Accepted by the essay (width / sqrt(n)); judge on Winter Wind.
- **Partial coverage.** The 1 px waist is anti-aliased; partly covered pixels settle at about c/(0.12 + 0.88c) of the tone. Accepted
  (SYNTHESIS: waist at least 1 px).
- **Front.** Snap order comes from the mixing hash; a weak hash (plain XOR of products) would order consecutive fibres and make a travelling
  front. Use the hash above verbatim.
- **Cost.** About 9,000 vertices in the worst first 0.35 s at comb 3.3 with 8 slabs; the cap of 8 slabs bounds it.

## After review

Reviewer verdict was rethink (a lone slab read as a mouth with teeth). Changes in `lab/tools/tack.js`, all inside this widget:
- Unequal halves: top 0.09-0.14 w, bottom 0.20-0.28 w (seeded by pitch), so the slab is a tape strip, not a jaw (section 2's equal 0.3 w is replaced).
- The halves slide along the seam as they open (about 0.12 of the gap), so it reads as a peel. Fibres run slanted across the gap.
- Fibres are thin strings: spacing 18/comb px (9 px at default), root half-width 1.2, waist 0.5, so they never touch. Per-slab fibre cap keeps bone under 2 % of the frame.
- Hard notch: at the snap the stub is at once min(4 + 12 resU, 0.35 s(tau)/2) long, instead of easing down from half the gap.
- Default `tack` raised 0.14 to 0.22.
- Slab cap raised to 14; slabs younger than 0.35 s are never dropped for older ones, and a chord over the cap keeps its loudest notes.
