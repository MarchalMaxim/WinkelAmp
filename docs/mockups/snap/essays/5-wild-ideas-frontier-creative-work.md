# Wild ideas: frontier creative work

*Lens: invention. Widgets and host changes that nobody has built, each designed around the attack of one picked note.*

## Three facts to design against

1. **There is a minimum length for any tail.** At 60 Hz, `rgba(0,0,0,0.12)` per step leaves 0.88^n of whatever was drawn. That is an exponential with τ ≈ 0.13 s (half-life 0.09 s). A widget's own envelope cannot fade faster than this unless the widget paints over its own pixels. That is why "self-erase" comes up below.
2. **The first frame is late by a fraction of a step.** `onChord` fires when `t` crosses `ch.t`, so on the first frame the true age is `x.t − ch.t`, anywhere in [0, dt). Every envelope below takes its age from `ch.t` and never counts it up from 0. Steps are not equally spaced in live play (dt can reach 0.05 s), and a 33 ms flash only lands cleanly if its age is measured exactly.
3. **Videos sample every second step.** `lab/render.mjs` and `scripts/snap-compare.mjs` render at 30 fps from 60 Hz steps. A strike frame that lasts one step and then erases itself can fall between two video frames. Every "one-frame" event below therefore lasts **two steps (33 ms)**. A `first` flag guarantees it is drawn at least once in live play.

There is also one structural fact that makes most of these ideas possible. **A widget already knows its future.** `instantiate.ts` passes each instance its own `CHORDS`: the part's, or the set of picks. Ivory already plans from it. So a widget can draw *statelessly*: `frame` binary-searches `CHORDS` for the notes inside a window around `x.t` and draws them as a function of song time. Seeks are then exact, frame-rate jitter cannot add up, and nothing in `onChord` needs to be remembered. Several sketches use this helper:

```js
const cs = () => (typeof CHORDS !== 'undefined' ? CHORDS : []);
const from = (t) => { const C = cs(); let a = 0, b = C.length; while (a < b) { const k = (a + b) >> 1; C[k].t < t ? a = k + 1 : b = k; } return a; };
```

---

## 1. Strike

A single, sharp event for each picked note, and nothing else. On the strike frame a white-hot glyph appears at the note's place: x by pitch, y by register. It is 135% of its size and has a short vertical smear below it, as if a hammer came up from beneath faster than a frame can show. From the next frame on it is sharp and amber, shrinks back to 100%, and cools to nothing. There are no particles and no aftermath. The glyph's shape comes from pitch class (12 hand-drawn glyphs, e.g. a notch, a tick, a bar), so a repeated note looks like a repeated note.

**Envelope:**
- Brightness `e = exp(−age/τ)`, with τ = 0.07 s by default (knob 0.03–0.6).
- Scale `1 + 0.35·exp(−age/0.025)`.
- Core white only while `first`.
- Smear: 8 copies at alpha 0.14·(1−k/9), offset k·9·v px downwards, drawn on the strike frame only.
- Removed at 5τ (0.35 s).

**Why it is snappy:** all the energy sits in the first 33 ms, and 1 − e^−1 of it is gone by 70 ms. The motion blur appears only on the attack frame. The eye reads that as an impact faster than the frame rate, which is the visual version of a hammer on a string.

**Picks:** one glyph per note in the set, with velocity and intensity (`n.amount`) scaling size, smear length and τ (×(0.6 + 0.4·amount)). The knobs are a set of three envelope knobs that any snap widget could reuse: *how hard it lands* (overshoot 0–0.6), *how quickly it dies* (τ), and *gone before the next note* (0/1, see idea 2).

**Difficulty:** 2 h.

```js
onChord(ch, x) { for (const n of ch.notes) hits.push({ t0: ch.t, m: n.m, v: n.v / 127, a: n.amount ?? 1, first: true }); },
frame(x) {
  const g = x.g, tau = x.p('decay'), over = x.p('land');
  g.globalCompositeOperation = 'lighter';
  for (const h of hits) {
    const age = x.t - h.t0, e = Math.exp(-age / (tau * (0.6 + 0.4 * h.a))), k = 1 + over * Math.exp(-age / 0.025);
    const [cx, cy] = spot(h.m), r = (24 + 80 * h.v) * k;
    if (h.first || age < 2 / 60) {                       // the strike frame: white core and the hammer's smear
      for (let i = 8; i >= 1; i--) { g.globalAlpha = 0.14 * (1 - i / 9); glyph(g, h.m % 12, cx, cy + i * 9 * h.v, r, '#fff'); }
      g.globalAlpha = 1; glyph(g, h.m % 12, cx, cy, r, '#fff'); h.first = false;
    } else { g.globalAlpha = e; glyph(g, h.m % 12, cx, cy, r * (0.5 + 0.5 * e), `rgb(255,${150 + 90 * e | 0},60)`); }
  }
  g.globalAlpha = 1; hits = hits.filter((h) => x.t - h.t0 < tau * 5);
}
```

## 2. Handover (the decay clock)

Each picked note is a disc whose area runs down like a clock, and it reaches zero **exactly on the next picked note**. The future is known, so each note's life is the gap to the next one (capped at 2.5 s). The old disc is not seen dying after the new one arrives. On every attack, one object hands the stage to the next.

**Envelope:** `u = (t − t0)/(next − t0)`, area `A = (1−u)·exp(−4u)`, radius `r = R·√A`. At u = 0.25 the area is down to 28%, at u = 0.5 to 7%. Like a piano tone, it is mostly gone well before the next note, and it is guaranteed to be gone when that note arrives.

**Why it is snappy:** it adapts to tempo. A fast run gets short lives without a damping heuristic (compare duet's `1/(1+2.2·rate)`), and a slow phrase gets long, calm ones. No two discs ever overlap, so every attack is a clean change of state, which follows the "no fake attacks" verdict.

**Picks:** this only makes sense on a hand-picked line. On all notes the gaps fall to 20 ms and the discs flicker.

**Difficulty:** 1.5 h.

```js
frame(x) {
  const C = cs(), g = x.g, i = from(x.t + 1e-6) - 1; if (i < 0) return;
  const c = C[i], next = Math.min(c.t + 2.5, C[i + 1]?.t ?? Infinity), u = (x.t - c.t) / (next - c.t);
  if (u >= 1) return;
  const A = (1 - u) * Math.exp(-4 * u);
  for (const n of c.notes) {
    const [cx, cy] = spot(n.m), r = (40 + 160 * n.v / 127) * Math.sqrt(A);
    g.fillStyle = u < 0.03 ? '#fff' : `hsl(${(n.m % 12) * 30},60%,${25 + 45 * A}%)`;
    g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.fill();
  }
}
```

## 3. Blade (the note's own decay, eaten by the playhead)

Each note is drawn as **the shape of its own sound**: a horizontal blade whose profile is the amplitude envelope. The left edge is a vertical cliff (the attack, height ∝ velocity). To the right it is an exponential slope, as long as the note would ring at its pitch. As song time passes, the playhead eats the blade from the left. The cliff that remains is always the current loudness, and what is left of the blade is the sound's future. A bass note is a long low wedge. A high note is a stub that is gone in a blink. A chord stacks several blades.

**Envelope:**
- Ring time by pitch: `τ(m) = 0.9·2^((48−m)/18)` s, clamped 0.12–3 (C3 → 0.9 s, C6 → 0.23 s, A1 → 2.0 s).
- Length = 4τ·240 px/s.
- Height `h = (18 + 150·v/127)·exp(−age/τ)`.
- White for the first 33 ms, then a hue from pitch class.

The pedal makes transcribed note lengths unreliable, so they are **not used at all**: the blade's length comes from physics, not from the transcription.

**Why it is snappy:** the attack is literally the tallest, sharpest edge of the shape. The decay is visible geometry, not a fade, so you can see a soft note die early.

**Picks:** the position along x is seeded per note index (`i·97 % 1040`) so the blades don't stack. Intensity scales τ by `keep` × (0.5 + 0.5·amount). The drawing is stateless, so seeks are exact.

**Difficulty:** 2.5 h.

```js
const tauOf = (m) => Math.min(3, Math.max(0.12, 0.9 * 2 ** ((48 - m) / 18))), SPEED = 240;
frame(x) {
  const g = x.g, C = cs(), keep = x.p('keep');
  for (let i = from(x.t - 12); i < C.length && C[i].t <= x.t; i++) for (const n of C[i].notes) {
    const tau = tauOf(n.m) * keep * (0.5 + 0.5 * (n.amount ?? 1)), age = x.t - C[i].t, end = tau * 4;
    if (age >= end) continue;
    const y = x.H * (0.9 - 0.8 * x.pitch01(n.m)), x0 = 120 + (i * 97 % 1040), h0 = 18 + 150 * n.v / 127;
    g.beginPath(); g.moveTo(x0, y);
    for (let s = age; s <= end; s += 0.015) g.lineTo(x0 + (s - age) * SPEED, y - h0 * Math.exp(-s / tau));
    g.lineTo(x0 + (end - age) * SPEED, y); g.closePath();
    g.fillStyle = age < 2 / 60 ? '#fff' : `hsl(${(n.m % 12) * 30},55%,${30 + 40 * Math.exp(-age / tau)}%)`; g.fill();
  }
}
```

## 4. Cut

This one borrows from film editing. On each attack, a full-width band at the note's height gets a solid colour card for exactly two steps. The band is 40–120 px tall depending on velocity, and the colour comes from a 12-colour palette by pitch class. After that the card is left to the canvas fade alone. A chord cuts several bands at once, like a cut in a striped title card. A loud note (v > 100) adds a 25% white full frame.

**Envelope:** the card is a 33 ms rectangle at alpha 1, then fades by 0.88^n (τ 0.13 s). The full-frame flash is limited to **at most 3 per second** (WCAG 2.3.1); faster attacks only get bands.

**Why it is snappy:** nothing animates. It is a cut in the edit, and cuts are the snappiest thing in cinema.

**Picks:** the bands sit where the picked notes are. Velocity sets thickness. Intensity 0 gives a hairline.

**Difficulty:** 1 h.

```js
onChord(ch, x) { for (const n of ch.notes) cards.push({ t0: ch.t, y: x.H * (0.92 - 0.84 * x.pitch01(n.m)), h: 40 + 80 * n.v / 127 * (n.amount ?? 1), c: PAL[n.m % 12], first: true });
  if (ch.vel > 100 && ch.t - lastFlash > 0.34) { flash = { t0: ch.t, a: 0.25 * ch.vel / 127 }; lastFlash = ch.t; } },
frame(x) {
  const g = x.g;
  for (const k of cards) if (k.first || x.t - k.t0 < 2 / 60) { g.fillStyle = k.c; g.fillRect(0, k.y - k.h / 2, x.W, k.h); k.first = false; }
  if (flash && x.t - flash.t0 < 2 / 60) { g.fillStyle = `rgba(255,255,255,${flash.a})`; g.fillRect(0, 0, x.W, x.H); }
  cards = cards.filter((k) => x.t - k.t0 < 2 / 60);
}
```

## 5. Wind-up (time-reversed anticipation)

In the last 120 ms before a picked note, a ring of 18 dim grains converges on the spot where the note will strike. On the attack frame the grains are already at the centre and burst outwards as a Strike (idea 1).

**Envelope:**
- Window `W = min(knob, 0.6·gap to the previous note)`.
- `u = 1 − (T − t)/W`, `e = u³`, so half the window holds an eighth of the motion.
- Radius `R = 260·(1−e) + 6`. Alpha `0.55·e`: **never brighter than 55%**.

**Is it a fake attack?** I argue no, with conditions. The user's verdict was against an *aftermath* that looks like a new attack: a second peak the music did not earn. A wind-up has no peak. It rises steadily, stays dim, and moves inwards, and its only peak is the real attack. There is also physical precedent: the pianist's hand falls before the sound, and a wind-up depicts that fall.

On timing, viewers are far more tolerant of picture ahead of sound than of picture behind it (broadcast detection thresholds are roughly 45 ms for sound ahead and 125 ms for sound behind). Converging motion that *completes* on the onset is therefore safe, even with a 20 ms transcription error.

The real risks:
- In dense runs it would blur into a constant shimmer. The 0.6·gap clamp prevents that, and a gap under 0.2 s gets no wind-up.
- On all notes it could be a false prophecy of a note the ear cannot pick out. Picks prevent that.

So: picks only, a knob that defaults to 0 s, and the user judges it by eye.

**Difficulty:** 1.5 h on top of Strike.

```js
frame(x) {
  const C = cs(), i = from(x.t), nx = C[i]; if (!nx) return;
  const gap = nx.t - (C[i - 1]?.t ?? -9), W = gap < 0.2 ? 0 : Math.min(x.p('windup'), 0.6 * gap);
  const u = W ? 1 - (nx.t - x.t) / W : 0; if (u <= 0) return;
  const g = x.g, e = u * u * u;
  for (const n of nx.notes) {
    const [cx, cy] = spot(n.m), R = 260 * (1 - e) + 6;
    g.fillStyle = `rgba(255,236,200,${(0.55 * e * n.v / 127).toFixed(3)})`;
    for (let k = 0; k < 18; k++) { const th = k / 18 * 6.283 + n.m; g.fillRect(cx + Math.cos(th) * R - 1.5, cy + Math.sin(th) * R - 1.5, 3, 3); }
  }
}
```

## 6. Muybridge (black between notes)

A hidden figure moves continuously through song time: a chain of 10 joints on slow Lissajous paths. It is **never shown**, except as a strobe exposure on each picked note, the way a strobe light reveals a dancer. Each exposure draws the whole chain faintly (35% × velocity), with the pitch's segment lit fully. A fast repeated note gives jerky, staccato motion. Long gaps make the figure jump a long way. The rhythm becomes distance on screen.

Between notes the widget is black, for real. With *afterglow* below 1, it redraws its last exposure in black at alpha 0.45 per step (τ ≈ 0.035 s). That beats the 0.13 s limit on the canvas fade, at the cost of also cutting into other widgets' pixels under the figure. A *ghosts* knob (0–4) keeps the last N exposures as Marey-style chronophotography, fading 100% / 35% / 12%.

**Envelope:** full exposure for 2 steps. Then either self-erase (τ 35 ms) or the canvas fade (τ 130 ms).

**Why it is snappy:** the widget does nothing at all except on attacks.

**Picks:** each note is one photograph, and pitch chooses the limb.

**Difficulty:** 3 h.

```js
const fig = (t) => Array.from({ length: 10 }, (_, i) => [640 + 420 * Math.sin(0.61 * t + i * 0.32), 360 + 240 * Math.sin(0.97 * t + i * 0.47 + 1.3)]);
onChord(ch, x) { shots.push({ t: ch.t, pts: fig(ch.t), seg: ch.notes.map((n) => Math.floor(x.pitch01(n.m) * 8.99)), v: ch.vel / 127, first: true }); },
frame(x) {
  const g = x.g, glow = x.p('afterglow');
  for (const s of shots) {
    if (s.first || x.t - s.t < 2 / 60) { chain(g, s.pts, `rgba(255,255,255,${0.35 * s.v})`, 2); for (const k of s.seg) limb(g, s.pts, k, '#fff', 6); s.first = false; }
    else if (glow < 1) { g.globalAlpha = 0.45 * (1 - glow); chain(g, s.pts, '#000', 12); g.globalAlpha = 1; }   // self-erase
  }
  shots = shots.filter((s) => x.t - s.t < 0.5).slice(-1 - x.p('ghosts'));
}
```

## 7. Prism (chromatic split)

On the strike, each object is drawn three times with `'lighter'`, once each in pure red, green and blue, 22·v px apart at 120° from each other. Over 120 ms the copies come back together, and where they overlap they add up to white. A chord is a burst of rainbows that settles into ivory.

**Envelope:** `d = 22·v·exp(−age/0.04)`: 22 px apart on the strike, 1 px after 0.12 s.

**Why it is snappy:** the split carries information only at the attack, and the coming-together is a quiet return to rest, not a second event.

**Picks:** the split distance follows velocity × intensity.

**Difficulty:** 1 h as a drawing helper that Strike or Blade can use.

```js
function prism(g, shape, age, v) {
  const d = 22 * v * Math.exp(-age / 0.04);
  g.globalCompositeOperation = 'lighter';
  for (const [c, a] of [['#f00', 0.6], ['#0f0', 2.69], ['#00f', 4.79]]) {
    g.save(); g.translate(Math.cos(a) * d, Math.sin(a) * d); g.fillStyle = c; shape(g); g.fill(); g.restore();
  }
  g.globalCompositeOperation = 'source-over';
}
```

## 8. Punch (host: the canvas bumps on the attack)

On a heard picked note, the whole picture scales about the note's x position. It works like a sprung camera.

**Envelope:** `s = 1 + A·exp(−age/0.05)·cos(2π·7·age)` with `A = P·v/127` and P = 0.03. The scale overshoots, crosses back below 1 at about 36 ms, and is still by about 150 ms.

There are two variants:
- **Feedback (cheap, 1 h).** Draw the persistent canvas onto itself with `'copy'` under the transform. Because the canvas is the memory, the trails smear outwards radially from the hit, like a zoom burst. This is a new look in its own right.
- **Clean lens (4–6 h).** Split the world canvas from the shown canvas. Widgets draw on the world. The shown canvas gets one display pass per step (punch, Prism over the whole frame, flash), and nothing is written back. `render.html` and `renderFrameHash()` must then hash the shown canvas. At P = 0 it is a plain copy, so the hash is identical.

Both are an opt-in show field: `"canvas": {"punch": 0.03, "on": "picks:p2"}`.

```ts
for (const ch of fired) if (heard(ch)) punch = { t: ch.t, A: P * ch.vel / 127, cx: pitchX(ch.hi) };
if (punch) {
  const age = t - punch.t, s = 1 + punch.A * Math.exp(-age / 0.05) * Math.cos(2 * Math.PI * 7 * age);
  if (Math.abs(s - 1) > 1e-4) {
    g.save(); g.setTransform(s * S, 0, 0, s * S, (1 - s) * punch.cx * S, (1 - s) * 360 * S);
    g.globalCompositeOperation = 'copy'; g.drawImage(g.canvas, 0, 0, RW / S, RH / S); g.restore();
  }
}
```

## 9. Wipe (host: the fade rate jumps on each attack)

Today the fade is a constant 0.12 per step. Wipe turns it upside down:

- **Rest 0.04** (half-life 17 steps, about 0.28 s): trails linger.
- **On a picked attack**, it jumps to `0.04 + 0.6·v·amount` and decays back with τ = 30 ms. The previous picture is wiped in about 50 ms, *by the note*.

What a widget drew stays until the next attack sweeps it away. That is the visual twin of the pedal: everything sustains until the next note clears the stage. It makes **every existing widget**, including the scene widgets, snappier without touching their code, because their tails end on the music instead of on a clock.

It is opt-in per show (`"canvas": {"rest": 0.04, "wipe": 0.6, "on": "picks:p1"}`) or in the lab (`?wipe=0.6&rest=0.04`, hearing all chords above velocity 70). With no field, the fill string stays exactly `'rgba(0,0,0,0.12)'`, so it is bit-identical.

**Difficulty:** 2 h.

```ts
let wipeEnv = 0;                                   // in Runtime
wipeEnv *= Math.exp(-dt / 0.03);
for (const ch of fired) if (cv && heard(ch)) wipeEnv = Math.max(wipeEnv, (ch.vel / 127) * (amountOf(ch) ?? 1));
g.fillStyle = cv ? `rgba(0,0,0,${Math.min(1, cv.rest + cv.wipe * wipeEnv).toFixed(4)})` : 'rgba(0,0,0,0.12)';
```

## 10. Snap pulse (host: a fast, summing feature)

This adds `feat.snap` next to `level`. It has a half-life of **60 ms** instead of 0.8 s, and it **sums** instead of taking the max, so a soft note right after a loud one still registers: `snap = min(1.5, snap + v/127)`. It also adds drives `'+snap' / '-snap'`. Any knob of any widget can then follow each attack by setting a drive in the lab, with no code. For example, Dread squares `size` on `+snap` makes every square kick on its own note.

Two helpers come with it: `x.since()` and `x.until()`, which return the time since the instance's last chord and the time until its next one (from its own `CHORDS`). Handover and Wind-up stop needing private binary searches.

No default knob uses `snap`, so both scenes stay bit-identical.

**Files:** `features.ts`, `types.ts` (`Drive`, `Features`), `lab/index.html` step() and DRIVES, and a unit test in `tests/` that checks `knobValue` is unchanged without the drive.

**Difficulty:** 2.5 h.

```ts
p.snap *= Math.pow(0.5, dt / 0.06);
for (const ch of fired) { p.level = Math.max(p.level, ch.vel / 115); p.rate += 1 / 1.44; p.snap = Math.min(1.5, p.snap + ch.vel / 127); }
f.snap = Math.min(1, p.snap);
```

---

## My top 3

1. **Blade.** It is the most original: the note's own decay drawn as an object, attack as a cliff, and decay as the playhead eating it. It does not depend on the unreliable note lengths, and pitch-dependent ring time makes it read as a piano.
2. **Muybridge.** Black between notes, a strobe photograph on each one. It is the purest answer to "react to individual notes", and the hidden figure gives a hand-picked line a body.
3. **Wipe.** One host change that makes every widget's tail end on the next picked note. It is cheap, opt-in, and it applies to the Rachmaninoff and Liebesleid scenes without changing their defaults.

Runner-up: **Wind-up**. The "fake attack?" question deserves to be judged by eye with the sound on.

## Build tonight

1. **`lab/tools/blade.js`.** Register it in `TOOL_IDS` (`lab/index.html`) and the catalogue (`src/widgets/catalogue.ts` / `scripts/widget-docs.ts`).
   - Knobs: *how long they ring* (`keep`, 0.3–3, 1), *how tall* (0.3–2, 1), *white strike* (0–1, 1), *presence*.
   - Stateless from `CHORDS`.
   - **Effort:** 2.5 h (Sonnet).
   - **The user sees:** in the lab on Liebesleid, each note a falling wedge eaten from the left. Bass wedges are long, treble ones are stubs.
2. **`lab/tools/muybridge.js`.**
   - Knobs: *afterglow* (0–1, 0.3), *ghosts* (0–4, 1), *how bright the figure is* (0–1, 0.35), *presence*.
   - A lab-only velocity gate (`v > 60`) stands in for picks, since the lab has none.
   - **Effort:** 3 h.
   - **The user sees:** a black screen that flashes a white limbed figure on each note, jumping by the rhythm.
3. **Wipe in the host.** Add it to `src/widgets/runtime.ts` step() and `lab/index.html` step(), behind a show field `canvas` and a lab URL `?wipe=&rest=`.
   - Test: `renderFrameHash()` of both scenes is unchanged without the field (`npm test`, plus a run of `scripts/checks/snap-scenes-check.mjs`).
   - **Effort:** 2 h.
   - **The user sees:** item 5.
4. **`lab/tools/strike.js` with Wind-up and Prism as knobs.**
   - Knobs: *wind-up* 0–0.2 s with default 0, *prism* 0–1 with default 0, plus the three envelope knobs.
   - **Effort:** 3 h.
   - **The user sees:** item 5.
5. **Side-by-side videos with sound** from `scripts/snap-compare.mjs` into `renders/snap/`, a 15 s passage each (Rach 2, around 60–75 s; Liebesleid, around 30–45 s). **Effort:** 1 h, after items 1–4.
   - (a) squares + gliss at default, left, against the same with `?wipe=0.6&rest=0.04`, right.
   - (b) strike with `--left-knobs '{"windup":0}'` against `--right-knobs '{"windup":0.12}'`. This puts the fake-attack question to the user.
   - (c) blade against squares.
   - (d) muybridge alone.
   - Each video also gets a contact sheet (`-sheet.png`) for a quick look on the phone.