# Snap: the design for tonight

Written 2026-11-04 (night) by the coordinating session, from six brainstorm essays, three judges and a sweep of all 58
widgets. This file overrides the essays wherever they disagree. Read `BRIEF.md` first. Paths are relative to the repo root.

## 1. Thesis: what "snap" means here

A widget snaps when the eye can count the notes. A piano note is an instant hammer, then a fast fall (about 16 dB/s for
the first second on these recordings), then a quiet tail (about 2 dB/s). The picture should do the same thing on
screen, which is not the same as doing it in the code.

**The main finding.** The shared canvas fades by `rgba(0,0,0,0.12)` per step. A mark redrawn in place every step at
alpha `a` settles at a brightness of `a / (0.12 + 0.88a)`, so `a = 0.1` already shows at 48 %. Squares' fade,
`0.92·(1 − t/1.4)^1.6`, is 0.45 on paper at 0.5 s but **0.87 on screen**. It stays above half brightness until 1.12 s
and then drops off a cliff at 1.4 s. "Hold, then cliff" is the mushiness the user describes. No choice of curve can fix
it while the alpha is drawn raw. Ivory's helper `settles(E) = 0.12E/(1 − 0.88E)` is the steady-state cure, but on the
attack frame nothing lies underneath, so `settles(0.5) = 0.107` would show a fifth of the peak and swell in over several
frames. The rule we adopt is the exact one-step version, **`SNAP.alpha(T, Tprev)`**: the alpha that takes a screen
showing `Tprev` (after the fade) to the target `T`:

```
alpha(T, Tprev) = clamp((T − 0.88·Tprev) / (1 − 0.88·Tprev), 0, 1)      Tprev = E(t − x.dt), 0 before the attack
```

On the attack frame it is `T` itself (full peak at once). Holding at `T` it equals `settles(T)`. Falling faster than the
fade it is 0, and the canvas alone takes the mark down. It is stateless: `Tprev` is the envelope one step earlier.

**The principles.** Every new widget and knob tonight obeys these, and the unit tests check them where they can.

| # | Rule | Number |
|---|---|---|
| P1 | Peak in the attack's own step. No freeze, stagger, gate or fade-in before the peak. | ≥ 85 % of peak on the `onChord` step |
| P2 | The peak holds for 2 steps. Bloch's law needs it, and so do 30 fps videos rendered from 60 Hz steps. | hold `H = 0.033 s` |
| P3 | Brightness only falls after the peak (no fake attacks). Size and position may overshoot and ring. | `E(t)` non-increasing for `t ≥ H` |
| P4 | A flash over a dim body: the flash carries the attack and the body carries the note. | flash half-life 0.06 s; body ≤ 40 % of peak |
| P5 | Draw through `SNAP.alpha(E(t), E(t − dt))` on the shared canvas, never a raw alpha. | on-screen half-brightness ≤ 0.2 s for the "piano" preset |
| P6 | Every picked note lands. Velocity shapes how hard and how long, never whether a note is seen. | on picks, peak ≥ 0.35 |
| P7 | Every repeat is countable. The same pitch again restarts the flash at full. Never take a max, never dim. | (the user's commit 5b5248b) |
| P8 | Age is measured from the chord, never accumulated: `t = x.t − ch.t`, with `born = ch.t` stored in `onChord`. | seek-exact |
| P9 | Crisp first, soft later. Blur and shadow start at 0. | `blur(t) = knob·min(1, t/0.15)` |
| P10 | Motion starts at full speed and slows down: a hammer, not a bow. | `d·(1 − e^(−t/τ))`, τ 0.06–0.1 s |
| P11 | A note's written length counts only at the short end. | damper cut only when `d < 0.15 s` and `m < 89` |
| P12 | No white flash covers more than 6 % of the frame, and no full-frame flashes at all tonight. | |

Two canvas limits: nothing on the shared canvas halves faster than about 0.09 s at 60 Hz, and the lab fades per rAF
frame (trails half as long at 120/144 Hz). **Snap is judged on the 60 Hz videos, never in the live lab.**

## 2. Curves we adopt

One envelope, in one file, `lab/snap/envelope.js` (candidate 2). Everything below is a closed form in `t` (seconds since
the attack), `v` (0..127), `m` (midi), `d` (the written length) and `a` (the picked note's intensity, default 1).

```
P(v, a, picks)  = floor + (1 − floor)·(v/127)^γ          floor = picks ? 0.35 : 0.12,  γ = 1.5
gain(a)         = a > 1 ? 1 + 0.8·(a − 1) : 1              intensity above 1 cracks harder (v·a is clipped at 127; a is not)
core(a)         = a < 0.6 ? 0 : 1                          a note turned down below 0.6 has no white core: it blooms
hb(m)           = hb0 · ring · 2^((60 − m)/24)             body half-life by register (measured: 0.37 s near C4, scaled for light)
flash(t)        = t < H ? 1 : 0.5^((t − H)/hf)             H = 0.033, hf = 0.06
body(t)         = 0.5^(t / hb(m))
tail(t)         = 0.5^(t / (8·hb(m)))
E(t)            = P · [ wf·gain·flash(t) + wb·body(t) + wt·tail(t) ] / (wf·gain + wb + wt) · cut(t) · damp(t)
cut(t)          = 1 − smoothstep(L − 0.1, L, t)            gone at L, so arrays can be filtered on t > L
damp(t)         = (d < 0.15 && m < 89 && t > d) ? 0.5^((t − d)/0.06) : 1
alpha           = SNAP.alpha(E(t), E(t − x.dt))            §1; clamp E to [0, 0.98] first
size(t)         = 1 + o·max(0, (v/127 − 0.55)/0.45)·e^(−t/0.07)·cos(2π·8t)      only loud notes ring in size
hot(rgb, t)     = rgb + (bone − rgb)·0.55·core·flash(t)    bone = [236, 226, 208], never pure white
```

`E` is normalised so that `E(0) = P`. The `wt` tail must be either 0 or at least 0.2, because fainter tails are eaten
by 8-bit rounding.

**The presets.** These are articulations, named in musician's words, and each one stores fixed numbers so its meaning
never changes later.

| preset | wf | wb | wt | hb0 (s) | L (s) | o | on screen (corrected) | for |
|---|---|---|---|---|---|---|---|---|
| **staccato** | 1 | 0.15 | 0 | 0.08 | 0.35 | 0.10 | half 0.10 s, gone 0.3 s | fast runs, dry notes |
| **marcato** | 1 | 0.35 | 0 | 0.15 | 0.6 | 0.25 | half 0.12 s, gone 0.5 s | accents |
| **piano** (default) | 1 | 0.6 | 0.25 | 0.25 | 2.5 | 0.15 | half 0.15 s, ember to ~0.8 s | a picked melody |
| **bell** | 0.7 | 0.6 | 0.4 | 0.45 | 6 | 0.08 | half 0.3 s, ring ~3.5 s | slow chords, last notes |
| **as written** | today's widget code, untouched | | | | | | | the baseline |

The "on screen" column is the target. Candidate 2's test must reproduce it within ±1 frame through the canvas simulation
(fade 0.12, burn 252, 8-bit, 60 Hz), copied from
`C:\Users\maxim\AppData\Local\Temp\claude\86ca13bbdae108ed\e5a43169-daa4-4132-9d14-76d2a2bd13c4\scratchpad\env.mjs` if it
still exists, and otherwise rebuilt from those four lines. If a preset misses its target, tune `hb0` and keep the target.

**Not adopted tonight:** anticipation or wind-up; black over-paint (it erases other clips in a layered scene); sigh
suppression and run-head filtering; host-side time warp, Wipe, Prism, Punch, Cut and Muybridge.

**The roll fold** is the one musical role adopted. It is a knob, default off, and only on Hammer. Notes 40–120 ms apart,
3–6 of them, moving in one direction and spanning ≤ 0.5 s, form one roll. Each member still lands as a frame-sharp tick
at peak 0.35 (P6). Only the top note gets the flash. Liebesleid p5–p8 then make four strikes, not eighteen flashes.

## 3. Knob vocabulary

The words are plain, each knob has a Left/Right hint and a small icon (`lab/README.md`), and every default reproduces
today's behaviour on existing widgets.

| key | label | range, default | hint (Left / Right) | where |
|---|---|---|---|---|
| `strike` | how hard the keys strike | 0..1, **0** | Left: keys rise as they always have, over a fifth of a second. Right: a key is up in two frames, jumps past its height and settles, its top edge lit for an instant. | Ivory's free 5th slot |
| `touch` | articulation | 0..3 step 1, 2 (`piano`) | 0 staccato, 1 marcato, 2 piano, 3 bell. Left: here and gone. Right: a bright strike that drops at once to a long quiet ring. | new widgets only |
| `ring` | how long it rings | 0.25..3, 1 | Left: what a note leaves is gone in a quarter of the time. Right: it rings three times as long. Multiplies `hb0` and `L`. | new widgets |
| `roll` | a rolled chord is one strike | 0..1 step 1, 0 | Left: every note of a roll flashes. Right: the notes tick in order and only the top one flashes. | Hammer |
| `goneBy` | gone by | 0.3..2.5 s, 1.2 | Left: a mark never lasts a third of a second, even with no next note. Right: a lone note may glow up to two and a half seconds. | Handover |
| drive `+hit` | each note → jump | (drive) | (drive menu word) | every knob, lab and studio |
| drive `-hit` | each note → dip | (drive) | | every knob |

`touch` and `ring` are ordinary knobs, so `note-values.ts` makes them per note for free: the widget reads them in
`onChord` and stores them on the mark. Intensity above 1 feeds `gain(a)` and below 0.6 removes the core. No new
plumbing is needed.

**The `+hit` drive.** `p.hit *= 0.5^(dt/0.08)`. Then, for each fired chord,
`p.hit = 1 − (1 − p.hit)·(1 − (ch.vel/127)^1.4)`, and `f.hit = p.hit`. With a half-life of 0.08 s, eighth notes at
120 bpm ripple about 92 %, against 19 % on `level`. A soft note after a loud one still kicks it.

## 4. Architecture

**What changes where:**
- **Widgets:** new files in `lab/tools/` (squares-snap, hammer, handover, blade, flee-snap, fireworks-snap), plus one
  opt-in knob on Ivory.
- **Runtime:** exactly one change, `feat.hit`.
- **Not touched at all:** `runtime.ts step()`, the paste weights, `slot.js` drawing, the conductor and schedule.

**The envelope reaches widgets by copy, not by a global.** Widgets are evaluated with only `TOOLS, ICON, CHORDS`
(`src/widgets/instantiate.ts`), so a `WA` global is not guaranteed to reach them in the studio or in Node.
- The canonical text lives in `lab/snap/envelope.js`, between `// SNAP v1 begin` and `// SNAP v1 end`. That folder is
  not globbed by any host, so it changes nothing at runtime.
- Each new widget pastes the block verbatim between the same markers.
- `tests/snap-envelope.test.ts` tests the canonical block, then asserts that every `lab/tools/*.js` containing the
  markers holds a byte-identical copy.
- Once the user picks a curve, the block can move to `lab/layers/` with a `ctx` binding. That is not tonight.

**`feat.hit` lands in three copies, in the same statement order, after the existing statements.** The full file list:

| File | Change |
|---|---|
| `src/widgets/types.ts` | `Features.hit`; `Drive` gains `'+hit' \| '-hit'` |
| `src/widgets/features.ts` | `newFeatures` (`hit: 0`), `Pulse` (`hit`), `advanceFeatures` (decay line beside the other two, kick inside the `fired` loop after `rate`, `f.hit = p.hit` last) |
| `lab/layers/lines.js` | `WA.advancePulse`, `WA.newFeatures` |
| `lab/layers/slot.js` | `coldInstance` sets `pulse.hit = 0` |
| `src/widgets/runtime.ts` | the instance pulse `{level, rate, hit}`, `reset()`, and every place that swaps `level`/`rate` (`safe()`, `picksQueue()`, `setOwn()`) also swaps `hit` |
| `lab/index.html` | `step()`'s pulse block (lines ~974–981), `reset`, `renderSeek`'s `Object.assign`, the instance swap (~881–890), and `DRIVES` gains `['+hit','each note → jump'], ['-hit','each note → dip']` |
| `src/studio/show/show.ts` | `DRIVES` gains `'+hit', '-hit'` |

`lab-harness.ts` parses the lab's `DRIVES`, so the studio's menus follow on their own.

**Determinism and the bit-identity rule.**
- `Math.random` is seeded in both hosts (`src/widgets/random.ts`, `lab/index.html:270`), and `renderSeek` reseeds. So
  the scenes' hashes are stable today. The danger is the reverse: **any added `Math.random` or `x.rnd` call in host
  code, or a changed call count inside a scene widget, shifts every later draw in both scenes.**
  - Hard rule: host code calls no random at all.
  - Inside Ivory's new knob, the `strike = 0` path executes exactly today's statements, behind an `if (s > 0)` branch,
    with no new random calls.
  - New widgets may use `x.rnd` freely, because they are not in the scenes.
- `feat.hit` is a function of fired chords and `dt`, like `level`. No stored knob reads it, so at defaults no knob
  value changes.
- New widgets compute age from `ch.t` (P8), so seeks, renders and live play agree.

**The proof.** The check is `npm run snap-scenes-check` against `docs/mockups/snap/baseline.json`, with the dev server on
port 5300. **Its Rachmaninoff samples at 240–700 s all hash to `10731dc5`: nothing plays after about 168 s, so those
samples prove nothing.** Candidate 1 fixes the sample times before anything else lands. Every candidate ends with:
- `npm test` green;
- `npm run snap-scenes-check` matching;
- for candidates touching `src/widgets` or `lab/layers`, also `npm run fidelity -- --quick`.

**Registration.** The studio finds `lab/tools/*.js` through `import.meta.glob`, so a new widget needs only its file plus
an entry at the **end** of `TOOL_IDS` in `lab/index.html`. Add an entry to `lab/tags.json` only if a test demands it.
The `TOOL_IDS` line is shared, so implementers append only. The orchestrator merges candidates one at a time and
resolves that line itself.

**Picks.** A `picks:pN` clip gives the widget `n.amount`, held per-note `x.p(key)`, `x.onPicks()` and the set's own
`CHORDS`. The lab has no picks, so the user's notes are judged through show copies (C7) rendered by
`render.html?show=<id>`; `scripts/studio-api.ts` serves any `shows/<id>.json`.

## 5. Candidates, in build order

Hours are Sonnet hours. **"Scene check"** means: start the dev server with `npx vite --port 5300 --strictPort` (never
5173, the user's own), then `npm test`, then `npm run snap-scenes-check`, with no difference from the baseline.

### C1 · A scene proof that means something (0.75 h, no runtime change)

**Files:** `scripts/checks/snap-scenes-check.mjs`, `docs/mockups/snap/baseline.json`.

**What the implementer must do:**
1. On the untouched tree, run the check twice and confirm both runs match the existing baseline.
2. Replace the sample times with times inside the clip windows:
   - Liebesleid: `[12, 18, 27, 45, 49, 70, 100, 168, 177, 182, 192, 200, 210, 235, 240, 290]`
   - rach-concerto-2: `[8, 38, 43, 45, 52, 60, 75, 81, 85, 90, 100, 120, 128, 135, 138, 142, 160]`
3. Run `--write`, then run the check once more to confirm it matches what was written.
4. Commit the script and the baseline before any other candidate merges.

**Unchanged:** every other file.

**Verified:** two consecutive runs match.

**The user judges:** nothing. This is what lets "the scenes are intact" be a sentence we can stand behind.

### C2 · The envelope core and its test (1.5 h)

**Files:** `lab/snap/envelope.js` (new), `tests/snap-envelope.test.ts` (new).

**What the implementer must do:**
- Write, between the markers:
  - `SNAP.PRESETS`, with the four presets from §2;
  - `SNAP.env(t, n, o)`, where `n = {v, m, d, a}` and `o = {preset, ring, picks}`, returning `{E, flash, body}`;
  - `SNAP.alpha(T, Tprev)`, `SNAP.settles(E)`, `SNAP.size(t, v, o)`, `SNAP.hot(rgb, t, a)`, `SNAP.sharp(t, k)`, `SNAP.launch(t, dist, tau)`;
  - `SNAP.rolls(chords)`: the roll detector from §2, returning a `Map` from chord index to `'member'` or `'top'`,
    cached per array.
- The block is plain ES5-compatible code with no globals except `SNAP`, so it can be pasted into a widget.
- Tests:
  - `E(0) = P`;
  - E is non-increasing for `t ≥ 0.033` for every preset, at m 30/60/90 and v 20/70/127;
  - `E = 0` for `t ≥ L·ring`;
  - the picks floor gives ≥ 0.35 at v = 1;
  - a frame-by-frame canvas simulation, **starting from black**, of a mark drawn at `SNAP.alpha` each 60 Hz step:
    the on-screen value on the attack step is ≥ 0.85·P (P1), it never rises after the peak (P3 measured on screen),
    the picks floor shows ≥ 0.3 on the attack step (P6), and §2's on-screen half times hold within ±1 frame;
  - `rolls()` on Liebesleid's real p5 notes (from `shows/liebesleid.json`) gives one roll whose top is midi 74;
  - the copy check: every `lab/tools/*.js` holding the markers holds the canonical text byte for byte.

**Unchanged:** all runtime files.

**Verified:** scene check.

**The user judges:** nothing directly. C3, C6, C8, C9 and C11 use this file.

### C3 · `squares-snap`, Squares made snappy (2 h)

**Files:** `lab/tools/squares-snap.js` (new, a copy of `lab/tools/squares.js`), and the end of `TOOL_IDS`.

**What the implementer must do:**
- Use id `squares-snap` and name "Snap squares". Keep the **same five knob keys, labels and defaults** (`size`, `life`,
  `blur`, `split`, `shake`, plus `presence`), so a clip can be switched widget for widget.
- In `onChord`, keep the three `x.rnd` calls per note in the same order (x, y, rot), so positions match Squares
  exactly. Add `t0: ch.t`, `m: n.m`, `d: n.d` and `a: n.amount ?? 1` to the pushed object.
- In `frame`, with `t = x.t − q.t0`:
  - `const e = SNAP.env(t, q, { preset: 'piano', ring: x.p('life') / 1.4, picks: x.onPicks() })`;
  - `g.globalAlpha = SNAP.alpha(e.E, prev.E)`, where `prev = SNAP.env(t − x.dt, …)` (0 when `t − x.dt < 0`);
  - the red channel is lit by `e.flash` instead of the linear `lit`, and the colour goes through `SNAP.hot`;
  - size is `q.s · SNAP.size(t, q.v, {o: 0.18})`, times a shrink `0.7 + 0.3·e.E/P` on the way out;
  - the filter blur and `shadowBlur` both go through `SNAP.sharp(t, x.p('blur'))`.
- Keep the shake code exactly, including its two `x.rnd` calls.
- Remove a square when `t > L·ring`.
- Write the hint in Squares' words, and add one sentence: "It cracks on and sinks back within a fifth of a second."

**Unchanged:** `squares.js`.

**Verified:** scene check, plus
`npm run snap-compare -- --song rach-concerto-2 --from 5 --to 20 --left "lab/index.html?render=1&song=rach-concerto-2&only=squares" --right "lab/index.html?render=1&song=rach-concerto-2&only=squares-snap" --labels "today|snap" --out renders/snap/squares-bells.mp4`
must produce a video whose right half shows the squares in the same places as the left.

**The user judges:** that video (the opening bells), and in the lab `?song=rach-concerto-2` by toggling the two.

### C4 · The `+hit` drive (2 h, runtime)

**Files:** the table in §4, plus `tests/layers-pulse.test.ts` (add `hit` to `fields()`) and `tests/features.test.ts`.

**What the implementer must do:**
- Implement §3's formula in all three copies, in the order of §4.
- Tests:
  - the half-life is 0.08 s;
  - "soft after loud adds";
  - `level` and `rate` are bit-identical to before over 10 000 random steps (snapshot the old arithmetic inline in the
    test).

**Unchanged:** every existing drive's arithmetic. No widget's default drive changes.

**Verified:** scene check, plus `npm run fidelity -- --quick`.

**The user judges:** in the lab on Liebesleid, set the drive of Squares' "size" to "each note → jump" at depth 0.3, and
the drive of Gust's "power" to the same. Every note swells for about 70 ms.

### C5 · Ivory: "how hard the keys strike" (1 h, a scene widget)

**Files:** `lab/tools/ivory.js`, `tests/ivory.test.ts`.

**What the implementer must do:**
- Add `{ key: 'strike', label: 'how hard the keys strike', min: 0, max: 1, value: 0, hint, icon }` before
  `presence`. The icon is a key whose rise line gets steeper with `v`, drawn with `ICON.line`.
- In `frame()` only, read `const s = x.p('strike')` once. When `s > 0`:
  - the rise time is `k.rise·(1 − 0.7s)`;
  - the ease is `1 − (1 − a)^(3 + 3s)`;
  - the height overshoots, `·(1 + 0.12s·e^(−u/0.07)·cos(2π·9u))` for `u = t − k.t` in [0, 0.4];
  - for `u < 0.033`, a 2-px top edge is drawn in bone, at alpha `0.6s` on its first step and `0.12·0.6s/(1 − 0.88·0.6s)` on the second.
- When `s === 0`, the existing statements run unchanged, in their own branch.
- **`planOf`, the plan cache and the texture cache keys are untouched.**
- Test: params now hold 5 knobs plus presence; `plan()` output is unchanged.

**Unchanged:** the plan, the textures, and every pixel at `strike = 0`. Ivory is in both scenes 14 times.

**Verified:** scene check (this is the candidate C1 exists for).

**The user judges:** video V4 (rach 115–125 s, ivory p14, strike 0 against 1), and in the studio the
`liebesleid-snap` copy at 10.7–28.5 s.

### C6 · Hammer, the piano-true strike (3 h)

**Files:** `lab/tools/hammer.js` (new), the end of `TOOL_IDS`.

**The look:**
- Each note is a horizontal bar of light at the height of its pitch (midi 21 at the bottom, 108 at the top), centred
  at x = 0.5W, with width `120 + 760·P` px, so a chord is a stack.
- On the strike frame: a 2-px bone core line, laid over a body in warm colour by register (deep red in the bass,
  amber in the middle, pale gold in the treble), 6–14 px thick.
- The tail is a 1-px line at the bar's full width.

**What the implementer must do:**
- Knobs: `touch` (articulation, default 2), `ring` (1), `roll` (0), `size` (0.5..2, 1), plus `presence`.
- In `onChord`, read `touch` and `ring` and store them on the mark (per note through the picker).
- Every value comes from `SNAP.env`, drawn through `SNAP.alpha` (P5).
- A restrike (same pitch while its mark lives) restarts the flash at full and kicks the width:
  `·(1 + 0.15·e^(−u/0.06)·cos(2π·8u))`. It never makes a second bar and never dims (P7).
- With `roll = 1`, `SNAP.rolls(CHORDS)` marks the members. A member shows a tick at P = 0.35 and no core, and the top
  note's flash gets `gain ·1.25`.
- Intensity: `gain(a)` and `core(a)` as in §2.
- Use no random calls at all.


**Verified:** scene check, plus a lab render at Liebesleid 174.9–186.2 s.

**The user judges:** the `liebesleid-new` show at 174.9–186.2 s (the rolls, with `roll = 1`) and at 10.7–25.7 s (the
sighs), plus video V6.

### C7 · Show copies: knobs-only, snap, new (1.5 h, after C3, C5, C6, C8, C9, C10)

**Files:** `scripts/snap-shows.mjs` (new). It reads `shows/liebesleid.json` and `shows/rach-concerto-2.json` and writes
six copies, `shows/<song>-knobs.json`, `-snap.json` and `-new.json`. Each copy's `id` equals its filename stem
(`rach-concerto-2-knobs`), or `/api/shows/<id>` fails; only `name` gets " · knobs" and so on. A knob stored as an object
(`{"base": 0.6, "drive": "+density"}`) gets its `base` set and keeps its `drive`. Nothing else changes.

| Copy | What changes |
|---|---|
| **`-knobs`** (the zero-code baseline: no new code) | **rach:** squares `life 0.4, blur 0`; gust `linger 0.6`; kline `stay 1.2`; halftone `life 0.4`; kandinsky `paint 0`; gliss `linger 0.2`; fireworks `linger 0`. **liebesleid:** miro `life 4`; pointillism `stay 1.5, bleed 0`; fischinger `life 1.5, echoes 0`; gliss `linger 0.2`; fireworks `linger 0`. |
| **`-snap`** (same clips, snappier code) | squares → `squares-snap`; flee → `flee-snap`; fireworks → `fireworks-snap` (if C14 landed); every ivory clip gets `strike: 1`. |
| **`-new`** (new widgets on the user's own picks) | **liebesleid:** ivory p1, p2, p3 → hammer; p5–p8 → hammer with `roll 1`; p11 → handover; p12–p15 → blade. **rach:** squares p2 → hammer; squares p6 → handover; ivory p14 → blade; halftone p15 → hammer with `touch 0` (the density test). |

A swapped clip keeps `start`, `end`, `listen` and track; any knob the new widget does not have is dropped. The script is
deterministic, so it can be rerun when the user's shows change. A test in `tests/snap-shows.test.ts` runs the generator
in memory and calls `validateShow` on all six copies.

**Unchanged:** the two originals, byte for byte.

**Verified:** scene check; `render.html?show=rach-concerto-2-snap` loads with `renderErrors` empty.

**The user judges:** the studio, by opening each copy beside the original at the passages in §6.

### C8 · Handover (1.5 h)

**Files:** `lab/tools/handover.js` (new), the end of `TOOL_IDS`.

**The look:**
- Each picked note is a dark-red slab (Squares' red), 1.6:1, at x by pitch (`(0.06 + 0.88·pitch01)·W`) and y by
  octave.
- It is born bone-hot for 2 steps and cools to red with `flash(t)`.
- Its area shrinks as `A = (1 − u)·e^(−4u)`, with `u = (x.t − c.t)/(next − c.t)`, where `next = min(c.t + goneBy,
  following chord's t)`. So it reaches 0 **exactly** when the next picked note lands.

**What the implementer must do:**
- Draw statelessly from `CHORDS`, binary-searching the current chord. `onChord` is empty.
- Only the area shrinks; brightness holds at `T = min(0.98, 0.35 + 0.65·(v/127)^1.5)` (plus the 2-step flash), drawn at `SNAP.alpha(T, Tprev)`.
- Knobs: `goneBy`, `size` (0.4..2, 1), `ring` (it skews `u` to `u^(1/ring)`), plus `presence`.


**Verified:** scene check; the seek test: `renderSeek(t)` then `renderTo(t + 1)` hashes equal to a continuous render
over the same second (in the test, use the lab's `?render=1`).

**The user judges:** `liebesleid-new` at 25.0–28.5 s (p11, the staccato), and `rach-concerto-2-new` at 48–62 s (p6).

### C9 · Blade (2.5 h)

**Files:** `lab/tools/blade.js` (new), the end of `TOOL_IDS`.

**The look:**
- A sound-roll seen from the playhead. Each note is a wedge whose cliff stands at a fixed column `x = 0.22W`, at y by
  pitch (bass low).
- The wedge extends rightward: its profile is `h(s) = h0·E_body(s)` for `s` from `t` to the note's ring end, drawn
  `240 px` per second. So what remains is the note's own future, eaten from the left as time passes.
- `h0 = 18 + 150·P`.
- The ring time comes from `hb(m)` (register), **not** from `d`.
- White-hot (bone) for 2 steps, then a register colour.

**What the implementer must do:**
- Draw statelessly from `CHORDS` over the last 12 s.
- A repeat of the same pitch is drawn over the older wedge at full height (P7).
- Knobs: `ring` (how long they ring), `size` (how tall), `touch`, plus `presence`.


**Verified:** scene check, plus the same seek test as C8.

**The user judges:** `liebesleid-new` at 230–242 s (p12–p15, the glass passage), and `rach-concerto-2-new` at
115–125 s.

### C10 · `flee-snap` (1.5 h)

**Files:** `lab/tools/flee-snap.js` (new, a copy of `flee.js`), the end of `TOOL_IDS`.

**What the implementer must do:**
- Use the same knob keys.
- The hesitation is 0 (no `0.06 + hes` freeze).
- The bolt follows P10: position `D·(1 − e^(−t/0.1))`, so it is at full speed at once, and the streak length is set by
  the current speed.
- `pSpawn = 1` when `x.onPicks()`, and also on the accents part.
- The flash half-life is 0.05 s with a 2-step hold.
- A shape lives 2 s, with the last 0.3 s fading.

**Unchanged:** `flee.js`.

**Verified:** scene check.

**The user judges:** video V8 (Liebesleid 30–45 s, accents).

### C11 · The envelope mock-up page (3 h, the only interactive page)

**Files:** `docs/mockups/snap/envelope/index.html` (new), served on port 5300.

**What the implementer must do:**
- Model the page on `docs/mockups/knob-transitions/mockup.html`. It loads `lab/snap/envelope.js` with a `<script>`,
  plays `songs/liebesleid/audio.mp3`, and reads the notes of the picked sets from `shows/liebesleid.json` (via
  `/api/shows/liebesleid`).
- Draw time from `AudioContext.currentTime`, not from `audio.currentTime`.
- Five horizontal lanes on black: "as written" (Squares' raw curve), staccato, marcato, piano and bell. Each lane drops
  the same square per picked note through a real 0.12 fade on its own canvas.
- Under each lane, plot the paper curve and the on-screen curve (simulated), with a toggle between raw and corrected.
- Controls: "ring", "roll fold" on/off, and passage buttons for the sighs (10.7 s), the rolls (174.9 s) and the glass
  passage (230 s).

**Unchanged:** everything outside the folder.

**Verified:** the page opens with no console errors, and the lanes move in time with the music.

**The user judges:** which lane breathes with the notes, by ear.

### C12 · The comparison videos, with a brightness trace (2 h, after C3–C10)

**Files:** `scripts/snap-compare.mjs` (add `--trace`), `docs/mockups/snap/videos/make.sh` (new: the exact commands of
§6), outputs in `renders/snap/` (not committed).

**What the implementer must do:**
- `--trace` passes each half through
  `signalstats,drawgraph=m1=lavfi.signalstats.YAVG:min=0:max=80:slide=scroll:s=<W>x60:fg1=0xffffffff` and `vstack`s
  the graph under it.
- Every video is 60 Hz steps at 30 fps, with sound, and keeps the contact sheet.

**Verified:** each output exists and has an audio stream (`ffprobe`).

**The user judges:** the videos V1–V9 in §6.

### C13 · The morning index (1 h, last)

`docs/mockups/snap/index.html`: one page listing every video, show copy, lab URL and the mock-up, each with its passage
time, one line of what to listen for, and a keep/reject box remembered in `localStorage` (in try/catch). The user starts here.

### C14 · `fireworks-snap` (2 h, optional, last)

A copy of `fireworks.js`: on picks never drop an attack (a burst inside the gap fires at `power·0.5`), a 2-step bone heart
disc ≤ 40 px outside the fluid, spark alpha `max(flash(t), 0.5·(1 − u²))` with life ×0.6. Scene check; judged in
`rach-concerto-2-snap` at 136–144.6 s.

## 6. Comparison videos

All videos are rendered with `npm run snap-compare -- … --trace`: 640 px wide per half, the recording's sound, labels in
plain words. `R(id)` stands for `render.html?show=<id>&hz=60&scale=1`, and `L(w)` for
`lab/index.html?render=1&song=<song>&only=<w>`.

**Rachmaninoff, concerto 2:**

| # | Passage | Left / right | Why there |
|---|---|---|---|
| V1 | 5–37 s, the bells (no picks: the lab, all notes) | `L(squares)` / `L(squares-snap)` | Bells rising 39→109 over a low F: hold-then-cliff against crack-and-sink. |
| V2 | 41–50 s, the arrival and the pulsing G | `R(rach-concerto-2)` / `R(rach-concerto-2-snap)`; a second render: `-knobs` / `-snap` | Squares on the user's picks; the orchestra sustains, only the picture's decay differs. |
| V3 | 79–84 s, squares p9 (shake 2, size 2) | original / `-snap` | Seven hard notes at the largest size. |
| V4 | 115–125 s, ivory p14 | original / `-snap` (strike 1) | The scene's own widget, sharper. |
| V5 | 126–135 s, the run (halftone p15, 95 attacks) | original / `-new` (hammer, staccato) | Density and strobe test, 12–14 notes/s. |

**Liebesleid:**

| # | Passage | Left / right | Why there |
|---|---|---|---|
| V6 | 10.7–28.5 s, the three sighs and the staccato | `R(liebesleid)` / `R(liebesleid-new)` | Ivory against Hammer and Handover on the sighs. |
| V7 | 10.7–28.5 s | `-knobs` / `-snap` (ivory strike 1) | Does code beat a knob turn? |
| V8 | 30–45 s, the flee accents | original / `-snap` | Bow against hammer. |
| V9 | 174.9–186.2 s, the rolls p5–p8 | original / `-new` (hammer, roll 1) | Four strikes, not eighteen flashes. |
| V10 | 230–242 s, the glass passage p12–p15 | original / `-new` (blade) | Treble cascade, each drop distinct. |

The judging order in the index: V1, V2, V6, V9, V4, V7, then the rest.

**What to look for (written into the index):**
- On the trace, a spike that stands on each note with a trough between notes is snap.
- Rounded hills that drift after the notes are mush.
- Any second brightening after a peak is a fake attack, and a reason to reject.
