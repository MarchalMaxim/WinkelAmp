# Nap (`nap`): build plan

Spec: `docs/mockups/nature/essays/2-fur-and-moss.md` §1, as changed by `SYNTHESIS.md` §2 Nap. Where this plan pins a number the essay left
loose, this plan wins. Files: `lab/tools/nap.js`, `tests/nap.test.ts` only. `nap` is already in `TOOL_IDS` (lab/index.html line 405).

## 1. What the viewer sees

The black canvas is the velvet. Each note strokes one long tilted band of oxblood pile into it, with toothed edges of cut fibre. On the attack
step the band flashes hot and a spray of bone hairs bursts from its edges. A chord strokes several bands at once, and where they cross the
pile cancels to black. Striking the same note again turns its band off. Texture word: **fuzzy, with a sharp edge**.

## 2. Geometry and numbers (canvas px, W 1280, H 720)

**Letters.** `q = clamp((m − 21)/87, 0, 1)` is pitch place (same as `x.pitch01`). `u` is normalised velocity. Never mix them.

**Velocity.** Build this once per memo. `vs` = every `n.v` of every note in `CHORDS`, sorted. `p10 = vs[floor(0.1·(N−1))]`,
`p90 = vs[floor(0.9·(N−1))]`. Then `u = clamp((v − p10)/(p90 − p10), 0, 1)`. **Guard:** if `N < 2` or `p90 − p10 < 4`, every `u = 0.7`.
The bucket is `ub = round(u·8)/8`, giving 9 values. Every size uses `ub`, so a near-identical repeat cancels exactly.

**Hash.** `h(a, b)` = a mulberry32 draw seeded with `(a·73856093 ^ b·19349663) >>> 0`. It returns 0..1. Use it for every per-pitch value. Never use
`Math.random` or `x.rnd`.

**Band**, for pitch `m`, bucket `ub`, knobs `width` and `slant`:
- Centre: `cx = W·(0.06 + 0.88q)` and `cy = H·(0.5 + 0.16·(h(m,1) − 0.5))`.
- Tilt from vertical: `θ = (((m·7) % 12) − 5.5)/5.5 · 28° · slant` (radians in code). So at slant 1 it is ±28°, and at the default 0.7 it is ±19.6°.
- Width: `w = (46 + 90·ub) · (1.3 − 0.6q) · width`. That runs 46..136 px before the register factor, which is ×1.3 in the bass and ×0.7 in the treble.
- Length from **pitch only**: `len = H·(1.05 − 0.40q + 0.10·(h(m,2) − 0.5))`, 0.60H..1.10H. This is a planner decision. With velocity on the
  length, a softer repeat would leave a lit frame with end caps. With pitch only, it leaves exactly two slivers along the long edges, as SYNTHESIS says.
- Local axes: along `a = (sin θ, −cos θ)` and across `b = (cos θ, sin θ)`. A local point (s across, v along) maps to
  `P = (cx, cy) + v·a + (s + bow(v))·b`.
- Bow: `bow(v) = B·(1 − (2v/len)²)` with `B = (h(m,3) − 0.5)·2·0.08·w`, at most ±8 % of w.
- Teeth, anchored at the band centre so a repeat of another width keeps the same tooth positions:
  `k` runs from `ceil(−len/12)` to `floor(len/12)`, and `v_k = 6k`. Each tooth has depth `d_k = 3 + 6·h(m, 1000 + k·2 + (side>0?1:0))`, 3..9 px.
  Walk side +1 from `v = −len/2` up to `+len/2`. For each k, emit the valley `(s = +w/2, v_k)`, then the tip `(s = +w/2 + d_k, v_k + 3 + 0.5·d_k)`.
  The tip leans toward +v, with the pile. Then walk side −1 back down from `+len/2`, emitting the valley `(−w/2, v_k)` and then the tip
  `(−w/2 − d_k, v_k − 3 − 0.5·d_k)`. The ends are straight cuts: start the path at `(+w/2, −len/2)`, add `(+w/2, +len/2)` after the last
  +side tooth, `(−w/2, +len/2)` before the first −side tooth, and `(−w/2, −len/2)` at the end, then closePath. That is about 560 points for the longest band.
- Cache the outline as a Float32Array of canvas xy, keyed by `${m}|${ub}|${width}|${slant}`. Clear the Map when it passes 256 keys.

**Hairs**, per stroke, also cached as a Float32Array of triangles. Key: `${m}|${ub}|${dir}|${width}|${slant}`. Seed: mulberry32(`m·7919 + (dir>0?1:2)·104729`).
- 360 hairs: 120 on side +1, 120 on side −1, and 120 inside.
- Edge root: `v = U(−len/2, len/2)` and `s = side·(w/2 + U(−2, 6))`. Inside root: `v = U(−len/2, len/2)` and `s = U(−w/2, w/2)`.
  Map the root to canvas through the band transform above.
- Length `l = 10 + 16·r` (10..26 px) and root width `rw = 1.5 + 1.5·r` (1.5..3 px), each with a fresh r.
- Canvas angle `φ = (dir > 0 ? −45° : 135°) + U(−15°, 15°)`. That is up-right if the melody rose to this note and down-left if it fell.
- Triangle: `R ± n·rw/2` and `R + l·(cos φ, sin φ)`, where `n = (−sin φ, cos φ)`.

**Pile tile**, 512×512, baked opaque **on black** (fillRect black first, then hairs source-over at alpha 1):
- The geometry is generated once from mulberry32(`0x4e4150`) and shared by every tile, so the hot strike lies exactly over the field's fibres.
- 14 000 hairs. Root uniform in [0, 512)². `l = 5 + 6r` (5..11 px). `rw = 1.4 + 1.0r`. Lay angle `φ = −55° + U(−8°, 8°)`, so every hair
  lies the same way. Brightness group `gb` ∈ {0.75, 0.88, 1.0}, uniform.
- Each hair is 3 tapered pieces: A, root to 50 % (width rw → rw/2); B, 50–80 % (rw/2 → rw/5); C, 80–100 % (rw/5 → point). They are coloured
  root, mid and tip × gb. Batch the pieces into 9 paths (3 pieces × 3 groups) and fill in this order: all A, then all B, then all C.
- Wrap: a hair whose root lies within 12 px of an edge is also drawn at the offsets (±512, 0), (0, ±512) and the diagonals it touches, so the tile is seamless.
- Colours (root / mid / tip), **field** at level 1, chosen by the `cloth` knob:
  - oxblood: (64,10,14) / (104,26,32) / (164,92,96)
  - moss: (22,50,18) / (46,88,34) / (128,164,96)
  - slate: (22,32,50) / (46,66,98) / (126,146,180)
- **Hot** (strike), same geometry:
  - oxblood: (176,36,40) / (224,110,104) / (240,214,198)
  - moss: (70,140,50) / (130,196,96) / (226,236,196)
  - slate: (60,96,160) / (120,156,210) / (214,226,240)
- Levels: bake the full field tile and the full hot tile once each. Make the levels by `drawImage` onto a fresh canvas filled opaque black,
  at `globalAlpha = k`, which gives exactly k·colour. Field levels `FL = [1, 0.72, 0.5, 0.35]` and hot levels `HL = [0.55, 0.78, 1]`. That is 7 tiles per cloth.

**Strokes** (the memo). Rebuild only when `CHORDS` identity, `CHORDS.length` or `!!x.picked` change. `onChord` does nothing.
- **On picks:** each chord gives one stroke per distinct pitch. A chord whose `t` is under 0.07 s after the previous chord's `t` gets
  `flip: false`: strike and hairs, but no field change. Otherwise `flip: true`.
- **Not on picks:** a chord is kept only if `t − lastKept.t ≥ 0.12`, and dropped entirely otherwise. A kept chord strokes its top note `hi`,
  plus its bottom note `lo` when `hi − lo ≥ 7`. This is a planner addition, so Rach 2's chords still make a two-band lattice. Every kept stroke has `flip: true`.
- Stroke record: `{t, m, ub, P, dir, flip}`. `dir = sign(chord.hi − prevKeptChord.hi)`. When that is 0, take the previous dir. The first is +1.
  `P = (x.picked ? 0.45 : 0.3) + (1 − floor)·u` is the hair peak.
- `memory` counts **flipping strokes only**. No-flip strokes never enter the field.

**Field set**, kept stateless:
1. `i` = last stroke with `t ≤ x.t`, by binary search. If `i < 0`, draw nothing.
2. Walk back from `i`. Collect the last `round(memory)` strokes with `flip: true`.
3. **Parity in JS:** count the collected strokes per key `${m}|${ub}`, and keep a key only if its count is odd. So an exact repeat turns
   the band off and a third turns it on, with no reliance on evenodd cancelling two identical anti-aliased outlines. Bands with different
   keys still go into one path with `fill('evenodd')`, so crossings and the soft-repeat slivers come out black.

## 3. Time

- **No SNAP block, no preset, `SNAP.env` never called.** The body is a held field, not an envelope. Do not paste the block. Inline instead:
  `const HOLD = 0.033, BONE = [236,226,208]; const flash = (t) => t < 0 ? 0 : t < HOLD ? 1 : Math.pow(0.5, (t - HOLD) / 0.06);`
  Include SYNTHESIS's `tone(g, rgb, k)` verbatim.
- **Attack steps** (`age = x.t − s.t`, `0 ≤ age < HOLD`, which is two 60 Hz steps): the strike and the hairs are drawn at full, and **only then**.
  Under `lighten` a redraw at a lower value is a no-op over the brighter ghost, so drawing on later steps adds nothing. The fall is the
  canvas's own ghost, about 0.25 s per SYNTHESIS (bone 118 after 5 steps, 17 after 15, 0 after 20). "Gone by 0.2 s" means that ghost,
  not a draw condition. `flash` is used only to decide those steps.
  - Strike: hot tile at level `HL[ub < 0.34 ? 0 : ub < 0.67 ? 1 : 2]`, filling the stroke's band outline (nonzero). It is drawn whether the band turned on or off.
  - Hairs: `tone(g, BONE, P)` and one fill of the stroke's 360 triangles.
- **Hold:** every step, the field is filled with `lighten` at alpha 1 from a field tile at a real dim tone. A band turned on settles from the hot
  ghost to the field level in about 0.15 s and then stands pixel-locked. A band turned off, a crossing, or the oldest band leaving `memory`
  is simply no longer drawn. It fades to black through the canvas fade in about 0.3 s, on that note's own step. That is a quiet change of
  state, not a staged one.
- **Silence fade:** `gap = x.t − strokes[i].t`, counted from the last stroke of any kind, and `R = rest` knob. Field level index is 0 while
  `gap < 0.4R`, 1 while `< 0.6R`, 2 while `< 0.8R`, and 3 while `< R`. From `R` on, no field fill. The canvas smooths each step down over
  about 3 steps. Nothing brightens without a note.
- Tone rule, per body. Every body is drawn with `globalCompositeOperation = 'lighten'`, `globalAlpha = 1`, in its real colour:
  - field: the tile colours above × FL[level], oxblood tips (164,92,96) at level 1
  - strike: the hot tile × HL
  - hairs: BONE × P
- No motion without a note: no travelling front, no end-of-phrase staging, and no x.rnd anywhere.

## 4. Knobs (5 plus presence)

| key | label | min | max | step | default | less | hint | icon |
|---|---|---|---|---|---|---|---|---|
| `memory` | how many strokes it remembers | 1 | 16 | 1 | 7 | 1 | How many strokes stay in the cloth. Left: only the last stroke is there. Right: sixteen strokes cut through each other. | `ICON.of.count(16, ICON.red)` |
| `width` | how broad the finger | 0.5 | 1.6 | – | 1 | 0.7 | How broad each stroke is. Left: thin scratches. Right: broad swathes. | `ICON.rect(g, w/2 − (2 + v·10)/2, 3, 2 + v·10, h − 6, ICON.red)` |
| `slant` | how much the strokes cross | 0 | 1 | – | 0.7 | – | How steeply the strokes lean. Left: all upright, side by side. Right: steep diagonals crossing. | three 3 px red lines at x 10, 20, 30, leaning alternately by ±v·28° |
| `rest` | how long it stays lit in silence | 1 | 12 | – | 4 | 1.5 | How long the cloth stays lit after the music stops. Left: it goes dark soon after. Right: it holds through long rests. | `ICON.fade(g, w, h, 0.1 + v·0.9, ICON.red)` |
| `cloth` | which cloth | 0 | 2 | 1 | 0 | – | Which cloth the strokes are made in. Left: dark red. Right: blue-grey. | `ICON.rect(g, 6, 5, w − 12, h − 10, ['#8a1a20', '#3a6a2a', '#3a5070'][Math.round(v·2)])` |
| `presence` | how present | 0 | 1 | – | 1 | – (`leads: true`) | How much you see: how many strokes stay, how broad, how long they last in silence. Left: one thin stroke that soon goes. Right: many broad strokes that hold. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again. | `ICON.much(g, v, w, h)` |

The widget never reads `presence`. `slant` and `cloth` carry no `less`. Entry: `id: 'nap'`, `name: 'Nap'`, `tag: 'new'`, `on: false`. Blurb: "Each
note strokes a band of velvet pile into the black, with a cut, fibrous edge; a chord strokes several and their crossings go black. Strike the
same note again and its band goes out. Nothing moves between notes."

## 5. Draw order and cost

`reset()` **must not touch its argument**, because the tests pass 0. It clears only the caches that depend on knobs. Tiles are baked lazily on
the first `frame` that needs a cloth: `tiles[cloth] ??= bake(cloth)`, using `document.createElement('canvas')`. Patterns are cached per tile
per `x.g`, rebuilt when `x.g` changes, via `x.g.createPattern(tile, 'repeat')`.

Per frame:
1. `cs = typeof CHORDS !== 'undefined' ? CHORDS : []`. Rebuild the memo if its key changed. Find `i`, and return if `i < 0`.
2. `g.save(); g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;`
3. Field, if its level is below 4 and the odd set is not empty: `g.fillStyle = fieldPat[cloth][level]; g.beginPath();`, trace every odd-parity band
   (moveTo + lineTo×n + closePath), then `g.fill('evenodd')`. This is **1 fill**.
4. Strikes: the strokes with `0 ≤ age < HOLD`, grouped by hot level. Per group: `fillStyle = hotPat`, `beginPath`, trace, `fill()`. **0 to 3 fills**, on two steps only.
5. Hairs: per stroke with `0 ≤ age < HOLD`, `tone(g, BONE, s.P)`, beginPath, then 360 × (moveTo, lineTo, lineTo, closePath), then `fill()`.
   **1 fill per stroke**, on two steps only.
6. `g.restore()`.

The usual cost is 1 fill per step, up to 7 on a chord's attack steps. Tiles: 7 per cloth × 512² × 4 B = 7 MiB, and 21 MiB if all three
cloths are visited. The first bake is about 2 × 14 000 × 3 pieces, plus 5 drawImage calls, so one stall of tens of ms on first use. The
field path is at most 16 × about 560 points.

## 6. Tests (`tests/nap.test.ts`)

Copy the harness from `tests/flee-snap-switch.test.ts`: `recorder`, `groupChords`, `instantiate('nap', SRC, { icon: { ink: '#fff', gauge() {} }, chords: CHORDS })`,
`x` with `picked` and **no `onPicks`**, `reset(0)`, 60 Hz loop calling `onChord` and then `frame`. Make two changes:
- The `document.createElement` stub hands tile canvases a recorder that writes to a **throwaway log**, so the main log holds only the main `g`.
- Do **not** use `loadCatalogue()`, because other widgets are being built beside this one. Use `instantiate` only.

Song: 30 notes 0.25 s apart, pitches cycling 60, 64, 67, 64. Velocities 50..100 cycling. Then silence to 16 s.

Assert:
1. Shape. Keys are exactly `['memory', 'width', 'slant', 'rest', 'cloth', 'presence']`. Each param has a label, a hint containing "Left:" and
   "Right:", and an icon function. `presence.leads === true`. `less` is `memory: 1`, `width: 0.7` and `rest: 1.5`, and undefined on
   slant and cloth. Defaults and ranges are as in §4. `tag === 'new'`.
2. Attack. On the first attack's step the log holds `globalCompositeOperation=lighten`, `fill(evenodd)`, at least one `fill()`, and a
   `fillStyle=rgb(...)` matching BONE × P.
3. Stillness. At 2 consecutive steps more than 0.1 s after a note and before the `rest` fade, the per-frame logs are identical.
4. Off switch, on its own song: m 72, v 80, at t 1.0, 1.5 and 2.0. At 1.2 the field section has 1 `moveTo`. On the attack step of
   1.5 there is no `fill(evenodd)` (an empty odd set skips the field fill) but the strike is there: a `fill()` after `fillStyle=obj`.
   At 1.7 still no `fill(evenodd)`. At 2.2 it has 1 `moveTo` again: on, off, on.
5. `memory = 1`: exactly 1 `moveTo` in the field section.
6. Silence. At `last stroke + rest + 0.1` there is no `fill(evenodd)` in the frame.
7. Determinism. Two runs give equal logs. `Math.random` throws for the whole run (it is stubbed).
8. Seek. A fresh instance whose only frame is at t 5.0 gives the same `moveTo`/`lineTo`/`fill` lines as the continuous run's frame at 5.0.
9. Guard. A song of 1 note draws without throwing, and so does `x.picked: true`.

## 7. Judge moments (60 Hz video, never the live lab)

- Liebesleid picks, 172–244 s. Count on, off, on for a repeat. Check that a softer repeat leaves two slivers along the old band's edges.
- Rach 2, 0–170 s. The repeated opening chords: are the two-band lattices and the on-off readable without strobing?
- Winter Wind, runs. Every note gets a flash and hairs, and the field does not strobe (the under-70 ms and under-0.12 s rules).

**The one question a still must answer:** does the band read as a sharp-edged stroke in velvet with visible fibre, or as a grey smear?

## 8. Risks and fallback

- **The off switch reads as a note erasing itself.** SYNTHESIS fallback: a repeat keeps the band lit and only re-strikes. A 0/1 switch
  `erase` (default 1) replaces the `cloth` knob, and cloth stays at oxblood.
- **Grey smear.** The tile is too dim or too sparse. Tune only the field colours and the hair count (14 000), never alpha.
- **HD renders (S > 1).** `runtime.ts` draws through an HD proxy, which magnifies and smooths the 512² pattern. If renders use S > 1, bake
  at 512·S and `pattern.setTransform(new DOMMatrix().scale(1/S))`.
- **Op-art stripes.** If bands turn into Riley stripes, the tilt by fifths and the 512 tile are the guard. Lower the `slant` default rather
  than adding a knob.
- **Non-picks rule.** The bass-note rule (top plus bottom when the span is at least 7) is a planner addition. Drop the bottom note if
  lattices clutter Rach 2.
- **First-use bake stall** of tens of ms, once per cloth.
- **`lighten` never covers** other clips under it, which is by design per SYNTHESIS.

## After review

- HD scale: the pile tiles are baked at 512*S (S = x.canvas.width / x.W), cached per cloth and S, and every pattern gets setTransform(scale(1/S)). `hd-check --only nap --scale 2`: no SOFT, no BLANK.
- Fast runs: a chord under 0.12 s after the last kept one now still gets its strike and hairs (flip:false); only the field flip keeps the 0.12 s throttle.
- Silence: the backward walk over strokes stops at the first gap of at least `rest`, so a note after a completed fade lights only itself (new test).
- Density: 26 000 hairs (was 14 000), oxblood field root (84,14,18), mid (124,32,38); tips unchanged. Moss and slate untouched.
