# Envelope and curve mathematics

*How a mark should rise and fall around a note, measured on the screen the user actually sees*

## 0. What the screen does to every curve (lever #1)

Every widget's envelope passes through the shared canvas before the eye sees it. Each step the runtime paints `rgba(0,0,0,0.12)` and then a colour-burn, and the widget draws on top. A mark that is redrawn in place every frame at alpha `a` therefore settles at a brightness of

```
B∞ = a / (0.12 + 0.88·a)          (relative to the mark's colour)
```

This is very compressive. `a = 0.1` already shows at **48 %**, and `a = 0.3` shows at 78 %. I simulated it frame by frame at 60 Hz: fade, then the burn at 252, then 8-bit rounding, then a draw at alpha `f(t)`. Today's Squares fade, `0.92·(1 − t/1.4)^1.6`, is at 0.45 on paper at t = 0.5 s, but **on screen it is at 0.87**. It stays above half brightness until **1.12 s** and then falls off a cliff at 1.4 s.

That is the opposite of "alert then gone". The square stays lit, then vanishes all at once, and it has almost no visible flash. The `lit` term (`1 − age/0.3`) only shifts the colour.

```
ON SCREEN, today's Squares (raw)      ON SCREEN, "strike", drawn through settles()
|####################                 |#
|#############################        |##
|###################################  |####
|#######################################|######
|###########################################|##########
|###############################################|###################
+-------------------------------- 1.5 s   +-------------------------------- 1.5 s
```

Ivory already has the cure, as a two-line helper:

```js
const settles = (want) => { const f = 0.12; want = clamp(want, 0, 1);
  return want >= 1 ? 1 : want * f / (1 - want * (1 - f)); };
```

If you draw at `alpha = settles(E(t))`, the screen shows roughly `E(t)` itself. **This one change moves on-screen timing more than any choice of curve.** On screen, "strike" takes 0.77 s to reach half brightness drawn raw and **0.15 s** drawn corrected. Every on-screen figure below is labelled **raw** or **corrected**. Today's widgets always get the raw figures.

**The canvas sets two hard limits** (both are 60 Hz figures; the fade is per step, so a live frame rate other than 60 shifts them):

1. **A floor on speed.** Even a 30 ms exponential takes **0.10–0.13 s** to look half as bright, because a mark that stops being drawn keeps 88 % per frame (a half-life of about 5.4 frames). To go faster, a widget must paint black over where the mark stood, as Ivory does for sinking keys (`g.fillStyle = '#000'` over the key's rectangle).
2. **Faint tails vanish.** The burn and the 8-bit rounding eat levels below about 4–5 %. A tail of weight 0.25 that lasts 1.45 s on paper stays visible for only about 0.75 s on screen. A two-stage "piano" tail needs a weight of at least about 0.2 to read at all.

## 1. Notation

- `t`: age in seconds since the attack. Always compute it as `x.t − ch.t` (store `born = ch.t` in `onChord`), never as `age += dt` from 0. A widget hears the chord up to one step late (up to 16.7 ms at 60 Hz, up to 50 ms live), and on a 60 ms decay that error is 25 %. A closed form in `t` also makes seeks and renders agree.
- `v`: velocity / 127. `P(v) = v^γ` is the peak.
- `d`: the note's transcribed length (`n.d`), known at the attack.
- Every curve below is a closed form `E(t, v, d)` with `E(0) = P(v)`.

## 2. Decay families

Each family is tuned to a "snappy" setting. On paper: t½ is the half time, t5% the last time above 5 %, and A100 the share of the curve's total energy that falls in the first 100 ms (the "alert" ratio). On screen: the half time and 5 % time from the simulation, raw and corrected.

| family | formula E(t)/P | paper t½ | paper t5% | A100 | screen t½ raw / corr. | screen t5% raw / corr. |
|---|---|---|---|---|---|---|
| today Squares | 0.92·(1 − t/1.4)^1.6 | 0.49 | 1.18 | 0.18 | **1.12** / 0.53 | 1.40 / 1.12 |
| today `level` | 0.5^(t/0.8) | 0.80 | 3.46 | 0.08 | 2.55 / 0.82 | 4.9 / 2.6 |
| exponential | 0.5^(t/h), h = 0.15 | 0.15 | 0.65 | 0.37 | 0.53 / 0.22 | 1.00 / 0.58 |
| power law | (1 + t/τ)^−k, τ = 0.04, k = 1.3 | 0.03 | 0.36 | 0.38 | 0.25 / 0.12 | 1.00 / 0.37 |
| two-stage (strike) | (1−w)e^(−t/τ1) + w·e^(−t/τ2), cut at L | 0.07 | 1.45 | 0.25 | 0.77 / **0.15** | 2.15 / 0.75 |
| two-stage (pluck) | τ1 0.04, τ2 0.35, w 0.1, L 0.8 | 0.03 | 0.25 | 0.64 | 0.20 / **0.12** | 0.67 / **0.33** |
| Gaussian (stab) | e^(−(t/σ)²), σ = 0.09 | 0.075 | 0.16 | 0.88 | 0.20 / **0.15** | 0.37 / **0.32** |
| blink | e^(−t/0.03) | 0.02 | 0.09 | 0.96 | 0.13 / 0.10 | 0.32 / 0.28 |
| sigmoid hold-cut | 1 − smoothstep(0.3, 0.4, t) | 0.35 | 0.39 | 0.29 | 0.45 / 0.42 | 0.62 / 0.60 |

The cut window is `Wc(t) = 1 − smoothstep(L − c, L, t)`. It guarantees the mark is gone at L, so arrays can be filtered on `t > L`.

```
paper shapes, 0..1.5 s
power (1+t/.04)^-1.3        stab gauss σ=.09          bell (two-stage .12/2.5 w=.5)
|#                          |#                        |#
|#                          |##                       |###
|#                          |###                      |######
|##                         |###                      |#################
|###                        |####                     |####################...
|########                   |#####                    |####################...
```

**What each looks like:**
- **Exponential.** An honest piano-like fade, but it has no moment of going: the eye sees "dimming".
- **Power law.** A white flash that snaps to an ember with a long, faint tail. The most alert at the onset, but not gone unless it is windowed.
- **Two-stage.** Flash, then ember. This is the piano's double decay: the prompt sound, then the aftersound. It is the most musical of the families for piano.
- **Gaussian.** A brief flat top, then a cliff. Brightness carries no tail, so it is the purest "stab".
- **Sigmoid hold-cut.** Not alert, because it holds. Useful for *geometry* that must be legible for a moment and then be gone cleanly. Pair it with a separate flash channel.

**Most "alert then gone", on screen and corrected:** pluck (half at 0.12 s, gone at 0.33 s), stab (0.15 s / 0.32 s) and blink (0.10 s / 0.28 s). Blink sits at the canvas floor, and anything faster needs a black wipe. For a piano line where the user also wants to see the note *was there*, strike (corrected) is the best trade.

## 3. Attack, overshoot and anticipation

**Instant on.** `E(0) = P(v)` on the first frame. Rises must take ≤ 1 frame for brightness. Today Squares lands in 0.1 s (`land`) and Ivory's keys rise over `k.rise` with `1 − (1−a)³`. Both are fine for *geometry*, but brightness should already be at full on frame 1.

**Overshoot: geometry only.** The rule "no fake attacks" says brightness may rise to one peak and then only fall, because a second bump reads as a new note. Put all ringing in size, position or rotation:

```
size(t) = 1 + o·P(v)·e^(−t/τo)·cos(2π f t)        o 0.1–0.3, τo 0.06–0.1 s, f 6–10 Hz
```

Ivory's jolt `2.4·strike·e^(−sh/0.08)·cos(55·sh)` is exactly this (f ≈ 8.8 Hz), and it is the best snap mechanic in the codebase today. Squares' `k = 1 + (1 − land)·0.16` is a non-ringing version (o = 0.16, linear over 0.1 s). On screen, with o = 0.2, τo = 0.08 and f = 8, the object punches out 20 %, undershoots by about 4 % at 60 ms, and is settled by 0.25 s.

**Anticipation (pre-attack).** This stays deterministic only by looking ahead in `CHORDS`, the way Ivory builds its plan from it. A picks clip is evaluated with `CHORDS` set to the set's own chords (`src/widgets/instantiate.ts`), so this works for picked notes. Keep it to **≤ 2 frames (≤ 33 ms)**, which is under the 40 ms chord window:

```
pre(t) = p·((t + a)/a)³   for −a ≤ t < 0,   p ≤ 0.25, a ≤ 0.033
```

This is a faint brightening on the spot where the mark will land, never a shape. It hides one frame of latency. Sound reaching the ear after the light is the natural order, so this reads as "tight", not "early". It should default to 0, and it needs the user's ear to judge.

## 4. Velocity shaping

Today's mapping is `0.55 + 0.45·v/110` (Squares): a range of only 0.55–1.0, so soft and loud look alike. I propose:

```
P(v)  = v^γ                    γ 1.3 (pluck) … 2.0 (stab): pp ≈ 0.1, ff ≈ 1
τ1(v) = τ1·(0.7 + 0.6·v)       louder flashes last a little longer (the piano's own trend)
w(v)  = w·(0.6 + 0.8·v)        loud notes leave more ember; soft ones are nearly flash-only
o(v)  = o·max(0, (v − 0.55)/0.45)  only loud notes ring in size
```

With strike's numbers, a pp note (v = 0.25) shows on screen, corrected, as a 6 % flash that is gone in about 0.2 s, and an ff note (v = 0.95) as a full flash with an ember lasting about 0.9 s.

## 5. Note-off release

There is no note-off event, but `n.d` is known at the attack, so the release can be planned at the attack. The pedal makes `d` unreliable, so cap it and blend it in:

```
E(t) = D(t) · [ (1 − r) + r·R(t) ]
R(t) = 1                              t < d'
       e^(−(t − d')/τr)               t ≥ d'      d' = min(d, 1.5 s), τr 0.06–0.15
```

`r` is "follow the note's length", 0..1, default 0. When r = 1, a staccato note is cut at its end, and a long note with the pedal down is cut by 1.5 s at most.

## 6. Retrigger: the same note again

Today's shared `level` uses `max(level, v/115)`, so a soft note after a loud one does nothing. For individual notes that is the worst choice. The options:

| rule | update at a re-attack | look |
|---|---|---|
| restart | E ← P | snappy, but a soft repeat *dims* the mark: reads as wrong |
| max (today) | E ← max(E, P) | repeats under a loud tail are invisible |
| screen sum | E ← 1 − (1−E)(1−P) | builds up; repeats read as "more", not as "again" |
| **dip-then-strike** | E ← 0.35·E for 1–2 frames, then max(E, P), with size kick restarted | each repeat is counted by the eye |

**Dip-then-strike** is my pick for picked notes. The canvas will not make the dip by itself: a 1-frame gap only dims to 88 %. The widget must paint black over the mark's rectangle for the 1–2 dip frames, as Ivory does, *or* make the restart legible in geometry, by restarting the size overshoot. The dip lasts ≤ 33 ms, so it is never read as a separate event. It reads as the hammer leaving the string.

## 7. Chord versus single note

Within one `Chord` (onsets within 40 ms), normalise so that a chord reads bigger than a note but not N times bigger:

```
P_i = v_i^γ / N^β        β = 0.5 (total ∝ √N), β = 1 when the widget draws one mark per chord
```

For a chord drawn as one event, use `P = max v^γ`, `τ1 = τ1·(1 + 0.15·log2 N)` (thicker chords flash a touch longer), and the overshoot from the top note. The 40 ms window could also be spent as a deliberate roll: stagger the N marks by `i·8 ms`, low to high. This is deterministic and stays under the window.

## 8. Presets

These use one common form, so any widget can take a preset name:

```
E(t,v,d) = P(v)·[(1−w)e^(−t/τ1) + w·e^(−t/τ2)]·Wc(t; L)·Rel(t; d, r)
size(t)  = 1 + o(v)·e^(−t/τo)·cos(2π f t)
draw alpha = settles(E)        // the lever from §0
```

| preset | τ1 | w | τ2 | L | γ | o / τo / f | on screen (corrected) | for |
|---|---|---|---|---|---|---|---|---|
| **blink** | 0.03 | 0 | – | 0.15 | 1.5 | 0 | half 0.10 s, gone 0.28 s | strobes, fast runs |
| **pluck** | 0.04 | 0.10 | 0.35 | 0.8 | 1.3 | 0.10 / 0.06 / 10 | half 0.12 s, gone 0.33 s | staccato, ornaments |
| **stab** | Gaussian σ 0.09 | 0 | – | 0.25 | 2.0 | 0.25 / 0.08 / 8 | half 0.15 s, gone 0.32 s | accents, sforzandi |
| **strike** | 0.07 | 0.25 | 0.9 | 2.5 | 1.5 | 0.15 / 0.08 / 9 | half 0.15 s, ember to ~0.75 s | piano melody (default pick) |
| **bell** | 0.12 | 0.50 | 2.5 | 6 | 1.0 | 0.08 / 0.2 / 5 | half 0.32 s, ember ~3.8 s | slow chords, last notes |

The knobs a user could set are at most four, in plain words: **"how sharp the hit"** (τ1, 0.02–0.2 s), **"how much stays after"** (w, 0–0.6), **"how long it glows"** (τ2 together with L), and **"how hard it jumps"** (o).

## 9. Which existing widgets these would improve

None of these can change a default. Squares, Duet, Fireworks, Gust, Kline, Pointillism, Gliss and Flee already have 5 knobs plus presence, so they are full. Ivory has 4 plus presence, so one slot is free. The routes are therefore a shared helper, a new drive feature, a show or layer field, or a v3 variant.

- **Squares** (gains most): the raw redraw plateau is the whole "mushy" feel. A `squares-strike` variant with `settles(strike)` and an Ivory-style jolt would look like a different instrument.
- **Fireworks**: sparks use `1 − (age/life)²` with life 0.8–1.5 s. That is a hold-then-fall, not alert. Pluck applied to spark alpha, while keeping the dye, would give a crack-then-trails look.
- **Duet**: already exponential (`lit` e^(−t/0.22), `flash` e^(−t/0.3)), but drawn through a field and damped when `rate` is high. A `+hit` drive on its swell would sharpen it.
- **Gust**: its cubic 100 ms front is good. Its linear `fade` after `hold` should become two-stage.
- **Kline**: the reveal `1 − (1 − age/dur)²` over 40–100 ms is already snappy. Its soak (`stay`) is ground, not envelope, so leave it.
- **Ivory**: already the model. Its free slot could take "follow the note's length" (§5) so that keys sink at `d'`.

**A shared fast pulse.** Add `feat.hit` beside `level`: a half-life of 0.07 s and a screen-sum kick (`hit = 1 − (1 − hit)(1 − v^1.5)`), as a new drive `'+hit'`/`'-hit'` in `Drive`. Today's `level` (half-life 0.8 s, max-kick) has only **19 %** ripple on v = 0.7 eighth notes at 120 bpm (it bottoms out at 0.56). At a half-life of 0.15 s the ripple is 69 %, and at 0.07 s it is **92 %**: every note visible as a pulse. `level` stays untouched, so the defaults stay pixel-identical.

## Build tonight

1. **Envelope helper and tests: `src/widgets/envelope.ts`, with a lab mirror at `lab/env.js` (global `ENV`).**
   - `ENV.at(preset | params, t, v, d)` returns E; `ENV.size(…)` returns the size multiplier; `ENV.settles(E)` returns the draw alpha.
   - `ENV.PRESETS = {blink, pluck, stab, strike, bell}`.
   - `tests/envelope.test.ts` checks that E(0) = P(v), that E is non-increasing for every preset (no fake attacks), that E is 0 at t ≥ L, and that a frame-by-frame canvas sim reproduces the corrected half-times in §8 to ±1 frame.
   - Nothing calls it yet, so the hashes are unchanged.
   - About **1.5 h**. The user sees nothing directly; everything below uses it.
2. **Mock-up page: `docs/mockups/snap/envelopes/mockup.html`**, modelled on `knob-transitions/mockup.html` and served on port 5300.
   - It plays `songs/liebesleid/audio.mp3` with notes from `songs/liebesleid/pack.json`.
   - It shows five horizontal lanes, one per preset plus "today (raw)". Each lane drops the same dark-red square per note, through the real 0.12 fade and burn on its own canvas.
   - Under each lane, a small plot draws the formula curve and the *on-screen* curve from the same simulation used here. A raw/corrected toggle shows lever #1 directly.
   - The four knobs from §8 are live, plus a retrigger switch (max vs dip-then-strike).
   - About **3 h**. The user hears the piece and sees, in one glance, which lane breathes with the notes.
3. **Squares variant: `lab/tools/squares-snap.js`, a new widget registered in `TOOL_IDS` in `lab/index.html` and in the catalogue.**
   - It is a copy of Squares with born = `ch.t`, `alpha = ENV.settles(ENV.at(preset, t, v))`, the size jolt and dip-then-strike.
   - Its 5 knobs: preset (0–4 stepped), how sharp, how much stays, size, split.
   - The original `squares` is untouched; verify `renderFrameHash()` on `shows/rach-concerto-2.json` before and after.
   - About **2 h**. The user can toggle the two side by side in the lab on the Rachmaninoff picks.
4. **Before/after video**, rendered with `lab/render.mjs` for `squares` and for `squares-snap` (strike and stab), on three passages of rach-concerto-2 (a bass-octave passage, a repeated-note passage, a chordal climax), joined with `ffmpeg -filter_complex hstack` and with sound.
   - Output: `docs/mockups/snap/envelopes/squares-before-after.mp4`.
   - About **1 h**. This is the strongest single piece of evidence for "snappier".
5. **The `hit` feature (optional, if time allows).**
   - Add `hit` to `Features`/`newFeatures`/`advanceFeatures` in `src/widgets/features.ts` and to the same arithmetic in `lab/index.html` step().
   - Add `'+hit' | '-hit'` to `Drive` in `src/widgets/types.ts`.
   - A test checks that `level` and `rate` are bit-identical to before.
   - About **2 h**. The user can set any existing knob's drive to "hit" in the lab (for example Squares' shake, or Duet's swell) and see it pulse on every note. A stored show is unchanged.

The simulation behind every on-screen number here (fade 0.12, burn 252, 8-bit, 60 Hz) is at `C:\Users\maxim\AppData\Local\Temp\claude\86ca13bbdae108ed\e5a43169-daa4-4132-9d14-76d2a2bd13c4\scratchpad\env.mjs`. Items 1 and 2 should copy it rather than re-derive it.