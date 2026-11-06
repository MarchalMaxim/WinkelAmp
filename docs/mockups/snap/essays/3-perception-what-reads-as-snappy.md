# Perception: what reads as snappy

*One of six brainstorms. Lens: visual perception and animation craft. All times are in song seconds. Frame counts are 60 Hz equivalents only, so renders and live play still agree.*

## 0. Two facts from the code that set the limits

1. **The shared fade has a floor.** `runtime.ts step()` paints `rgba(0,0,0,0.12)` once per step, and the amount does not depend on dt. A widget that redraws with falling alpha over that fade still shows at least ×0.88 per step of what was there. That works out to a half-life of about 5.4 steps, roughly **90 ms at 60 Hz**. So no envelope on the shared canvas can show a visible half-life under about 90 ms. Targets below are 100–150 ms for that reason. A true *cut* (gone within one frame) needs the widget to paint over its own footprint. Only widgets that own their ground can do that: kline redraws its ground each frame, and gust holds an aubergine floor.
   *Side effect for the morning:* the live lab fades per rAF frame. On a 120/144 Hz monitor its trails are about half as long as in a 60 Hz render. **Judge snap on renders (60 Hz substeps), not in the live lab.**
2. **Picked-note clips have their own sparse pulse.** `driver.ts:111` gives `own = listen !== undefined || …`, so a `picks:p1` clip's `feat.rate` and `feat.level` are fed only by the picks. Mechanisms that damp on `rate` therefore barely bite on hand-picked notes: duet's `dense`, flee's `hesOf`, fireworks' `gap`. What still bites on picks are the fixed time constants and envelope shapes. That is where the work is.

## 1. Why the eye says "snapped" or "mushy"

Three perceptual facts, given as approximate ranges. Each rule in §2 has its own test, so none of them rests on a citation alone.

- **Sound-to-picture order.** Viewers notice a picture that *lags* the sound sooner (around 40–60 ms) than one that *leads* it (around 100+ ms). A visual peak 1 frame early is safe. A peak 4 frames late already reads as "following" the music rather than "being" it.
- **Brightness is summed over about 50 ms (Bloch's law).** A 1-frame flash reads dimmer than the same flash held for 2–3 frames. A peak needs a brief hold of 2–3 frames before it falls, or it doesn't register as bright.
- **Cause and effect.** Motion that starts within about 50–100 ms of the cause, at full speed, reads as *caused* by it: a billiard ball, a hammer on a string. Motion that waits longer, or accelerates from rest, reads as *self-propelled*: an animal deciding to move. Accelerating motion is the visual signature of a bowed string or a swell. That is exactly the "violin" feel the user wants to leave behind. A piano attack is a hammer, so the picture should move like one.

**What mushy is made of.** Each item has a concrete instance in the code:
- **Ease-in or slow growth:** flee's freeze plus the t^exp bolt; duet's `swell` easing with τ = 0.45 s.
- **One-pole smoothing on what an attack drives:** `feat.*` at 0.25 s; duet's `mood` at 2 s; pointillism's `life` at 1.5 s.
- **Max-kicked pulses:** `level = max(level, vel/115)` with a 0.8 s half-life. A same-loudness note 200 ms after the last raises level only from 0.84 to 1.0, a 16% step nobody sees.
- **Additive stacking into saturation:** overlapping envelopes clip at full, so a dense run becomes one plateau.
- **Gates:** fireworks drops any attack within `gap = 0.16 + …` s of the last one.
- **Soft edges from frame 0:** squares blurs `4 + sz·0.025` px from birth.
- **Long gentle tails:** the last 30% of a fade lasts as long as the first 70% and reads as fog.

## 2. Rules, ranked by how much they matter

`a` = seconds since the attack. "Meter" = the luminance probe in Build tonight #2: mean brightness per frame in the widget's region (or in its window, for a layered slot).

| # | Rule | Number | Meter test | Why it ranks here |
|---|---|---|---|---|
| 1 | **Peak in the attack's own step.** No freeze, queue, stagger, gate or ease-in before the peak. | ≥ 85% of peak brightness at `a = 0` (the step that fires `onChord`); peak at ≤ 1 step (17 ms) | Time-to-peak (TTP) ≤ 1 frame on isolated notes | If this fails, nothing else saves it |
| 2 | **Every attack makes a fresh contrast step** against what is already there, including a soft note after a loud one. | Local brightness jumps ≥ 30% of the widget's range at each onset, even 120 ms after the previous one | Repeated-note train at 120 / 250 / 500 ms: count distinct peaks ≥ 30% above the preceding trough. Target: all of them. Today, most `+level` drives fail at 120 and 250 ms | "Individual notes" means you can count them |
| 3 | **A flash that falls fast, over a dim body.** Two stages: a *flash* (hold 33 ms, then half-life 100–140 ms, gone by about 400 ms) over a *body* at ≤ 35% of peak that carries the note's life and may linger. | Flash: `hit(a) = a < 0.033 ? 1 : 0.5^((a-0.033)/0.12)` | Brightness at 150 ms ≤ 55% of peak; at 400 ms ≤ body level | "Dies off quickly" without emptying the picture |
| 4 | **Sharp at the attack, soft later.** Blur, feather and shadow start at 0 and grow to the widget's own value. | `blur(a) = blurKnob·min(1, a/0.15)` | Edge gradient (Sobel mean) highest at frame 0 | Visual onset detection keys on edge contrast; a blurred onset reads as a fade-in |
| 5 | **Motion starts at full speed and decelerates.** Displacement is `d·(1 − e^(−a/τ))` with τ = 60–120 ms, so 90% of the travel is done by 2.3τ. A spring is kicked in **position**, not velocity, and rings at f ≥ 6 Hz with ζ 0.35–0.5. | v(0) = d/τ, the maximum | Displacement peak ≤ 100 ms | Hammer, not bow (Michotte) |
| 6 | **Size overshoot, then settle.** Born 10–20% oversized, back to 1.0 by 80–120 ms; with a ring: `1 + 0.15·e^(−a/0.05)·cos(2π·8a)` | — | Footprint area peak at frame 0 | Overshoot reads as impact; growth reads as swelling |
| 7 | **White-hot core.** At the peak, colour moves toward white (+40–60% lightness, −50% saturation); the hue returns as the flash falls. | Follows `hit(a)` | Peak-frame saturation < body saturation | Adds contrast without adding area |
| 8 | **Shrink, not only fade, on the way out.** Scale `0.6 + 0.4·body`; anything under 12% alpha is cut to zero. | Tail cut at 12% | No pixels above floor+2 after `life` | Fading leaves faint fog; shrinking stays legible, then is gone |
| 9 | **Squash and stretch** only on things that move. Stretch along velocity: `sx = 1 + min(0.6, |v|/k)`, `sy = 1/sx`. | Cap 1.6× | — | Polish |
| 10 | **Afterimage** (optional): an outline or ghost in the cooler complement, ≤ 20% of peak, 150–300 ms, brightness only falling. | — | Never brightens after the peak | Keeps "it was there" without a new attack |

**"No fake attacks" constrains rules 6, 9 and 10.** Size and position may overshoot and ring. **Brightness after the peak may only fall.** A ghost is dimmer than its parent and never re-lights. One more move is allowed: dimming the old picture at the moment of a new hit (a 1-step "duck" of the widget's older objects to about 60%) adds contrast to rule 2. It is a quiet change of state, not an attack.

**One shared helper (about 15 lines), all functions of age in seconds:**
```js
const SNAP = {
  hit: (a, hl = 0.12, hold = 0.033) => a < 0 ? 0 : a < hold ? 1 : Math.pow(0.5, (a - hold) / hl),
  body: (a, life, lvl = 0.35) => a < 0 ? 0 : lvl * Math.max(0, 1 - a / life) ** 1.6,
  over: (a, amt = 0.15, f = 8, tau = 0.05) => 1 + amt * Math.exp(-a / tau) * Math.cos(6.2832 * f * a),
  sharp: (a, soft, t = 0.15) => soft * Math.min(1, a / t),
  launch: (a, d, tau = 0.08) => d * (1 - Math.exp(-a / tau)),
  hot: (rgb, h) => rgb.map((c) => c + (255 - c) * 0.55 * h),
};
```
It would be inlined into each variant widget, which is safer than adding a global the studio runtime must also provide.

## 3. Rules applied to the widgets I read

- **Squares** (`squares.js`).
  - *Already good:* onset is in-step; size starts 16% over and settles in 0.1 s (`k = 1 + (1-land)·0.16`); `lit` runs 0.3 s.
  - *Mushy:*
    - `filter: blur(4 + sz·0.025)` and `shadowBlur` from frame 0 break rule 4.
    - `lit` falls *linearly* over 0.3 s and only from 0.35 to 1 (break rule 3).
    - Half-alpha comes at **0.49 s** (`(1 − a/1.4)^1.6 = 0.5`). Body and flash are the same object, so the whole square lingers.
    - The settle is linear, not a ring.
  - *Snap variant:*
    - `alpha = 0.92·max(hit(a), body(a, life))`.
    - Blur goes through `sharp(a, blur)`.
    - Colour goes through `hot(rgb, hit(a))`.
    - Use `over(a, 0.18)` instead of the linear `k`.
    - Shrink to `0.7 + 0.3·body/0.35` as it fades.
  - *Expected:* a red slab that cracks on hard-edged and white-hot, then collapses into a dim, soft ember within 0.3 s.
- **Flee** (`flee.js`). This is the worst case for rule 1 *by design*.
  - New shapes freeze `hes ≈ 0.55 s × rnd(0.5, 1.5)` (`hesOf`, driven by `−rate`, so on a sparse picks pulse it stays near 0.55), then bolt on a `t^exp` speed curve. That is ease-in.
  - The onset `flash: 1` is the only snappy part.
  - *Snap variant:* `hes = 0`. The bolt is `launch(a, D, 0.1)`, at full speed at once and decelerating, with streak length tied to the current speed so squash-and-stretch falls out of it. The panicked character can stay in the *threats* (bass hits, bursts) rather than in the hesitation. It cannot be a knob default, because the freeze is the current look. It has to be a variant or a new knob whose default is today's `hes`.
- **Duet** (`duet.js`).
  - *Already good:* `lit` decays at τ = 0.22 s (half-life 0.15 s), nearly rule 3.
  - *Mushy:*
    - Hits are velocity kicks into springs (`stiff` 16/30, damping `exp(−2.6·h)` / `exp(−3.4·h)`). My *estimate* is that displacement peaks a quarter period late, around 0.3–0.4 s (ω ≈ 4–5.5 rad/s). The meter should confirm this.
    - `swell` eases in with τ 0.45 s.
    - `dense = 1/(1 + 2.2·rate)` damps hits.
  - *Snap variant:* add the impulse to *offset* (`q.ox += …`) and to velocity with the opposite sign, so the mass is displaced at once and springs back; raise stiffness to about 40 (≈6.3 rad/s ≈ 1 Hz, still soft, but the peak is now at frame 0). `swell` jumps to its target, then relaxes. The seam flash follows `hit(a)`.
- **Gust** (`gust.js`). Closest to right already.
  - *Already good:* the wedge front is `1 − (1 − a/0.1)^3`, which starts at full speed. Fronts move at `V: 2900`.
  - *Mushy:* the strength of an off-accent attack is `(0.1 + 0.26·rank)·clamp(since/0.8, 0.45, 1)`. A note 150 ms after another blows at ≤ 45% of its rank, which breaks rule 2. The `0.45 s` accent lockout does the same to two loud picks in a row.
  - *Snap variant:* on picks (`x.onPicks()`) skip the `since` penalty and the lockout. Each wedge's first 2 steps are drawn at full opacity with a white-hot core sliver (the `brief` sliver already exists: give it `hot()`). It can do real cuts on its floor.
- **Fireworks** (`fireworks.js`).
  - *Already good:* bursts wait for `frame` but in the same step (`pend` is flushed at the top of `frame`), so they arrive in time. Sparks start at full speed with drag `exp(−1.8·dt)`, a textbook impact.
  - *Mushy:*
    - `if (clock − lastBurst < gap) return` with `gap ≥ 0.16 s` drops attacks, a hard rule-1 failure on fast picks.
    - The fluid's tone map `1 − exp(−1.5·dye)` compresses the heart flash.
    - Sparks fade as `1 − t²` over 0.8–2.3 s, a hold-then-fall that lasts long enough to read as sustain.
  - *Snap variant:* never gate picks (fire a small burst at `power·0.5` instead of none). Draw a 2-step additive white disc at the heart outside the fluid. Spark alpha becomes `max(hit(a)·1, 0.5·(1 − t²))` with life ×0.6.
- **Pointillism** (`pointillism.js`).
  - *Already good:* dots fly over 0.08–0.2 s with ease-out cubic and start 1.6× size (rules 5 and 6). `pulse` half-life is 0.12 s.
  - *Mushy:*
    - `age: −R(0, 0.04)` staggers onsets up to 2.4 frames, which smears the attack.
    - The epoch wash fades in (`0.25 + a·3`).
    - Busy playing shortens `life` by up to 45% through a 1.5 s-smoothed `life`.
  - *Snap variant:* no stagger (all dots at `a = 0`). Fly τ 0.06 s. The white `pt` flash becomes a 2-step hold, then `hit`.
- **Kline** (`kline.js`).
  - *Mushy:* strokes are *painted on* over `dur = 0.06 + L/(3200 + 4000·velN)`, which is ~0.21 s for a 770-unit bar at mid velocity. Some marks start late (`age: −delay`). That is a growth.
  - *In its favour:* it owns its ground, so it is the one widget that can **cut**.
  - *Snap variant:* the bar appears at full length within 2 steps (`dur ≤ 0.033`), black with a 1-step bone-white rim. Marks start with no delay. The "soak back" stays as the body.
- **Ivory** (`ivory.js`).
  - *Already good:* rise is `RISE/hardness = 0.2/(0.4 + 0.6·i)`, ease-out cubic, so at intensity 1 a key is 23% up after one frame and 58% after 3. The stomp jolt `exp(−sh/0.08)·cos(55·sh)` (≈8.8 Hz ring) is rule 6 done right.
  - *Snap variant:* rise 0.08 s, a 12% height overshoot via `over()`, and a 2-step lighter top edge (`hot`) on the new key. Keys stay; that is the concept, and the body here is the key itself.

## 4. The 10-second demonstration

**Same widget, same seed, same notes, only the envelope changed.** Use the opening of `rach-concerto-2`: the isolated chords against the low bell, which speed up. Take the onset times from `songs/rach-concerto-2/pack.json` (the first ~12 chords), not from memory.
- Show `squares` on the left and `squares-snap` on the right, as an `hstack` at 1280×360 each.
- Under each half, draw a 60 px **brightness trace** (mean luminance per frame), scrolling, with white **onset ticks** from the notes.
- *Before* looks like rounded overlapping hills whose peaks drift after the ticks. *After* looks like spikes standing on the ticks, with troughs between them.
- Ten seconds in, the eye has seen both the picture and the proof.

A second, harder clip: the same pair on a fast repeated-note figure from Liebesleid (find a run of ≥ 4 onsets ≤ 150 ms apart in `songs/liebesleid/pack.json`). The before should blur together; the after should be countable.

## 5. Build tonight

1. **Envelope bench mock-up**: `docs/mockups/snap/perception/index.html`. One page, six tiles on a black canvas, each running the same real audio and real onsets (`songs/rach-concerto-2/audio.mp3` and `pack.json` via the dev server on 5300), each changing one rule:
   - A: today's squares envelope
   - B: flash + body
   - C: blur from frame 0 vs sharp-then-soft
   - D: ease-in vs full-speed launch
   - E: fade vs shrink
   - F: max-kicked `level` vs a per-attack `hit`

   Each tile has a live brightness trace with onset ticks and a toggle "show the other half". Model it on `docs/mockups/knob-transitions/mockup.html`. *The user sees* each rule isolated and can feel which ones matter to them. **2.5 h.**
2. **Snap meter**: `scripts/snap-meter.mjs`. It drives `render.html` with the existing hooks (`window.renderSeek`, `renderStep`, `renderPixels`, from `src/widgets/driver.ts`) over chosen passages of either show. For one clip it decodes the frames' mean luminance and reports per onset:
   - TTP in frames
   - flash half-life
   - peak/pre-trough ratio
   - distinct-peak count on dense runs

   Output is CSV plus a small PNG trace. Run it on the 8 widgets above, today vs variant. *The user sees* a one-page table ranking widgets by snap, which gives the brainstorm numbers to stand on. Risk: getting a single-clip render from a show; budget for it. **3 h.**
3. **`squares-snap` and `fireworks-snap`**: new widgets in `lab/tools/`, copies of the scene widgets with the §3 changes and the inlined `SNAP` helper, registered in `TOOL_IDS` (`lab/index.html`) and the studio catalogue. Same knobs and labels, so a clip can be switched widget-for-widget in a copy of the show. The scenes are untouched; run `renderFrameHash` on both shows before and after to prove it. *The user sees* the two variants in the lab and studio next to the originals. **2 h.**
4. **Before/after videos**: `docs/mockups/snap/perception/compare.mjs`, built on `lab/render.mjs`. It renders §4's two clips (squares vs squares-snap on the Rach opening; fireworks vs fireworks-snap on the Liebesleid run) at 60 Hz with sound, then `ffmpeg hstack` + `vstack` with the brightness-trace strip drawn from the meter's CSV. *The user sees* two 10–12 s MP4s in `docs/mockups/snap/perception/`. **1.5 h** (after 2 and 3).
5. **Optional, a flee variant with no freeze**: `lab/tools/flee-snap.js`. `hes = 0`, launch with τ 0.1 s, streak length from current speed. This is the strongest single "ease-in vs hammer" contrast in the codebase and worth one more clip in #4. **1.5 h.**