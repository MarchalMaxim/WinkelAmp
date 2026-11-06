# Architecture: where snap lives

*Lens: the code. Where should snappiness be implemented so that 58 hand-made widgets can use it without each being rewritten, while seek, render, live play and lab/studio bit-identity keep working.*

## What decides snap today (what I read)

Take `lab/tools/squares.js`, the reference widget. Its response to one note is spread over **five separate time constants**, and none of them lives in shared code:

| Where | What | Time |
|---|---|---|
| `land = min(1, age/0.1)`, `k = 1 + (1−land)·0.16` | the scale-in on attack | 0.10 s linear |
| `lit = 1 − age/0.3` | the red flash on attack | 0.30 s linear |
| `fade = (1 − age/life)^1.6` | the body | `life` knob, 1.4 s |
| `shake *= 0.86^(dt·60)` | the jolt | half-life ≈ 0.077 s |
| shared background `rgba(0,0,0,0.12)` per step | trails | half-life ≈ 5.4 steps ≈ 0.09 s at 60 Hz |

A grep over all 58 widgets finds 89 `Math.pow(0.5, dt…)`, 41 `age / k` and 14 `exp(-dt / k)`. The constants run from 0.05 s to 4 s, and many are linear ramps, which sound "mushy" because a piano decay is exponential. 31 widgets expose a time knob (`life` ×12, `stay` ×10, `linger` ×3, `trail`, `decay` ×2 each, `keep`, `fade`). 33 knobs use `drive: '+level'`, a pulse with a 0.8 s half-life that is a `max`, not a sum.

Five structural facts shape everything below.

1. **The pulse arithmetic exists three times:** `lab/index.html` `step()` (lines 974–981), `src/widgets/features.ts` `advanceFeatures`, and `lab/layers/lines.js` `WA.advancePulse`. `tests/layers-pulse.test.ts` proves the last two equal over 10 000 random steps, and `npm run fidelity` proves the lab and the studio equal in pixels. Any new pulse has to land in all three, in the same statement order.
2. **`x.rnd` is the shared, seeded `Math.random`** (`lab/index.html:270`, reseeded by `renderSeek`). If host code calls it even once, every later widget's draws shift and bit-identity is gone, even where nothing visible changed. Host-side snap must use a hashed RNG (`WA.fnv32(key) ^ chordIndex`) or none.
3. **Chord notes already carry `d`, the duration.** The release is known at the attack, so an `onRelease` event adds no information an envelope can't already use.
4. **A windowed slot already gets its own canvas and its own background fade** (`slot.js` `windowed()`, the `wg.fillStyle = 'rgba(0,0,0,0.12)'` line). That is the only place a host can isolate one widget's pixels and post-process them.
5. **New `lab/layers/*.js` files reach every host for free.** `src/widgets/layers-source.ts` globs the folder for the studio and `scripts/node/layers.ts` reads it for Node. The lab needs one `<script>` line. Widgets themselves only get `TOOLS, ICON, CHORDS` (`instantiate.ts`), so a shared library has to reach them through `ctx`.

## The six options (plus one)

### (1) A fast additive pulse: `feat.hit`, drive `+hit`

**Formula.** Decay first, then kick with a saturating sum, so a soft note after a loud one still registers:

```js
p.hit *= Math.pow(0.5, dt / 0.12);                       // half-life 0.12 s: 0.908 per 60 Hz step
for (const ch of fired) { const k = Math.pow(ch.vel / 127, 1.4); p.hit = 1 - (1 - p.hit) * (1 - k); }
f.hit = p.hit;
```

These statements go **after** the existing ones in all three copies. Kick sizes: pp (v=40) gives k=0.20, ff (v=110) gives k=0.82. At 0.3 s after an attack, `hit` has fallen to 0.18 while `level` is still at 0.77. That gap is the difference between a strike and a swell.

**Files.**
- `src/widgets/types.ts`: `Features.hit`, `Drive` gains `'+hit' | '-hit'`, `WidgetCtx.hit`.
- `features.ts`: `newFeatures`, `Pulse`, `advanceFeatures`.
- `lines.js`: `advancePulse`, `WA.newFeatures`.
- `slot.js`: `coldInstance` sets `pulse.hit = 0`.
- `runtime.ts`: the inst pulse `{level, rate, hit}`; `reset()`; and every place that swaps `level`/`rate` (`safe()`, `picksQueue()`, `setOwn()`) also swaps `hit`.
- `lab/index.html`: `step()`, `reset`, `renderSeek`'s `Object.assign`, the instance swap at lines 881–890, and two `DRIVES` entries (`['+hit','each note → jump']`, `['-hit','each note → dip']`). `lab-harness.ts` parses `DRIVES`, so the studio's menus follow on their own.

**Determinism and identity.** It is a function of fired chords and dt, exactly like `level`. No widget drives `+hit` by default and `knobValue` is generic (`f[drive.slice(1)]`), so at defaults no knob changes and the pixels are identical.

**Tests.** Add `hit` to the `fields()` list in `layers-pulse.test.ts`. In `widgets-features.test.ts`: a half-life check, and "soft after loud adds".

**Migration.** None in code. In the lab the user switches squares' `shake` (or any of the 33 `+level` knobs) to `+hit`.

**Limit.** It is one scalar per clip. Every square pumps together with the latest attack. That suits single-subject widgets (tunnel, rorschach, lenlye, riley), but it is not "individual notes".

**Cost.** About 1.5 h, about 9 files, and no risk to the scenes.

### (2) + (6) An envelope service: `lab/layers/snap.js`, exposed as `x.env` / `x.recent`

I merge these two. The library belongs in `lab/layers/snap.js` because that is the only shared-code location both hosts and Node already load. Widgets reach it through `ctx`, because `ctx` is the only thing both hosts hand them. One implementation, two thin bindings.

**The shape, stateless in age τ = x.t − ch.t.** Two exponentials, like a real piano note (a fast "prompt" decay, then a slow aftersound):

```js
WA.snapShape = function (tau, o) {            // o: { v, half, click, clickHalf, d, release, gamma }
  if (tau < 0) return 0;
  var a = Math.pow((o.v || 100) / 127, o.gamma || 1.6);          // loud notes stand out, soft ones whisper
  var body = Math.pow(0.5, tau / (o.half || 0.35));
  var tick = Math.pow(0.5, tau / (o.clickHalf || 0.035));        // the transient: gone in ~0.1 s
  var e = a * ((1 - (o.click || 0.4)) * body + (o.click || 0.4) * tick);
  if (o.d != null && tau > o.d) e *= Math.pow(0.5, (tau - o.d) / (o.release || 0.08));   // the note's own end
  return e;
};
WA.snapRecent = function (chords, t, win, keep) { /* binary search: chords in (t−win, t] that pass keep(ch) */ };
```

**ctx bindings.** In `runtime.ts` and in the lab's `ctx` (lines 466–488):
- `env(tau, o) → WA.snapShape(tau, o)`;
- `recent(win) → WA.snapRecent(curChords, ctx.t, win, curKeep)`.

`curChords` is `inst.chords` (the picks' chords for a picks clip). It is swapped in `safe()` next to `cur.notes`; the lab needs a `SND.chords`. `curKeep` applies the slot's curve thinning (`WA.passes(ch.t, automationAt(piv, …), inst.salt)`), so `recent()` returns exactly the attacks `onChord` received.

**Determinism.** This is the strongest of the six. A value that is a pure function of `(x.t − ch.t)` is equal at equal song time whatever the step rate: live at 144 Hz, render at 60 Hz, after a seek. Today's step-counted background fade cannot claim that. `recent()` even makes a seek look like play: the attacks from the last 1.5 s are still decaying on the first frame after the seek, where today `reset()` drops them. No new state means nothing new to reset or cold-start.

**Caveat.** With a 35 ms click and 60 Hz frames, the first frame after an attack samples τ ∈ [0, 16.7 ms), so the peak varies by up to 28 %. That is acceptable, and it is identical in lab and studio.

**Tests.** `tests/snap-env.test.ts`:
- shape values at τ = 0, half, half+click;
- monotone after the peak;
- `release` only acts after `d`;
- `snapRecent` over random steps equals the concatenation of `deliveredChords`, using the random-data harness from `layers-pulse.test.ts`.

Fidelity `--quick` stays unchanged, because no widget calls the service at defaults.

**Migrating squares.** Add a knob `snap` (min 0, max 1, `value: 0`): its default keeps today's statements verbatim. That makes 5 knobs plus presence, which is legal. Before (excerpt):

```js
q.age += x.dt; q.y += x.dt * 18;
const land = Math.min(1, q.age / 0.1), k = 1 + (1 - land) * 0.16;
const life = x.p('life'), fade = Math.pow(Math.max(0, 1 - q.age / life), 1.6);
const lit = 0.35 + 0.65 * Math.max(0, 1 - q.age / 0.3);
```

After:

```js
// onChord: sq.push({ ..., t0: ch.t, d: n.d })          (two extra fields, nothing else)
q.age += x.dt; q.y += x.dt * 18;
const sn = x.p('snap');
let k, fade, lit;
if (sn > 0 && x.env) {                                   // x.env absent in an old host: today's look
  const tau = x.t - q.t0, half = x.p('life') * (0.25 - 0.17 * sn);   // life 1.4 → body half-life 0.35 … 0.12 s
  const e = x.env(tau, { v: q.v, half, click: 0.35 + 0.4 * sn, clickHalf: 0.03, d: q.d });
  k = 1 + 0.22 * x.env(tau, { v: 127, half: 0.02, click: 0 });       // a 20 ms punch, not a 100 ms grow
  fade = Math.min(1, e * 1.15); lit = 0.35 + 0.65 * Math.min(1, e * 2);
} else {
  const land = Math.min(1, q.age / 0.1); k = 1 + (1 - land) * 0.16;
  fade = Math.pow(Math.max(0, 1 - q.age / x.p('life')), 1.6);
  lit = 0.35 + 0.65 * Math.max(0, 1 - q.age / 0.3);
}
```

**Cost.** Library and bindings: about 2.5 h. Each widget migration: 20–40 min (squares, gust, kandinsky and gliss are the obvious ones, because they spawn one object per note).

### (3) Note-off events: `onRelease`

Possible: per instance, an `ends` index sorted by end time with a cursor `ei`, like `ci`. Fire it after `onChord` and before `frame`. `coldInstance` sets `ei` to the first end after t. Touches `runtime.ts step()`, `slot.js calls()`, `lab/index.html step()` and the instance creation.

I recommend **not building it.** `n.d` is already on every chord note, so `x.env(..., {d})` gives the same release with no event, no cursor and nothing to keep in step across seeks. The pedal also makes transcribed ends unreliable, and an event-driven release would fire visible "attacks" at pedal lifts, which breaks the user's "no fake attacks" rule. A widget that really needs "is it still sounding" has `x.sounding()`. Cost if built anyway: about 2 h.

### (4) Host-side effects on attack frames

The plain path draws straight onto the shared canvas, so a host cannot tell one widget's pixels from another's. The only clean place is the **window path**. A clip field `snap: { flash, punch, trail }` makes `conductor.ts slotLayer()` emit a full-frame window region (`{mode:'window', shape:'rect', x:.5, y:.5, w:1, h:1}`) plus `layer.snap`. Then in `slot.js windowed()`:

```js
var sn = s.layer.snap, e = 0;
if (sn) { var a = WA.snapRecent(inst.chords, s.t, 0.5, keepOf(s)); if (a.length) e = WA.snapShape(s.t - a[a.length-1].t, { v: a[a.length-1].vel, half: 0.08, click: 0 }); }
wg.fillStyle = sn ? 'rgba(0,0,0,' + (1 - Math.pow(0.88, s.dt * 60 * (1 + 2 * sn.trail))) + ')' : 'rgba(0,0,0,0.12)';   // per-clip trail
// …at the stamp:  g.filter = 'brightness(' + (1 + sn.flash * e) + ')';  scale the box by 1 + sn.punch * e
```

**Determinism.** The effect state comes from `snapRecent`, not from a remembered "last attack", so it is seek-proof. It draws no random numbers.

**Identity.** The field is absent from both scenes, so `slotLayer` returns what it returns today. The show validator and the clip panel need the new field.

**Taste risk.** A whole-picture punch on every attack is exactly the generic, template-like move the user rejected in Codex's widgets. The **trail** lever is the valuable part: it is a per-clip "dies off quicker" that works on all 58 widgets at once.

**Cost.** About 3 h, plus a full-size canvas copy per step per snap clip (fine at S=1, heavy at S=3).

### (5) A "snap" knob family, like `less`

`lab/layers/present.js` already does almost this: knobs declare `less`, and a lead slider interpolates their bases. Add an optional `snappy: <value at full snap>` on knobs, plus `WA.snapValues(params, s)`, a copy of `presentValues` that reads `snappy`. Squares becomes:

```js
{ key: 'life', ..., value: 1.4, less: 1.1, snappy: 0.45 },
{ key: 'blur', ..., value: 1, snappy: 0.35 },
```

The values written are ordinary knob values, so the runtime knows nothing of this, and it is bit-identical for free.

The cost is metadata: one line on each of the roughly 31 time knobs, plus a lab slider and a studio clip control (a clip field, not a 6th knob). It **shortens decays but cannot sharpen an attack** (squares' 0.1 s land and 0.3 s flash are hard-coded), so it complements (2) and does not replace it. Cost: about 2 h for the mechanism plus 10 widgets tagged.

### (7) Clock gearing (outside the list, worth one video)

Hand a clip `x.dt × gear` (swapped in `safe()`, like `level`). Every `age += dt` envelope in every widget then runs `gear`× faster, attack and decay alike, with no widget edits. The side effects:
- motion speeds up too (squares drift at 36 instead of 18 units/s);
- widgets keyed on `x.t` (ivory, timeslice) are untouched;
- fluid widgets (fireworks) may go unstable above dt 0.05.

It is a lab-only switch, not a product feature. But it answers in one render "would everything feel right at 1.8× decay speed?", and that tells us which time constants to retune by hand.

## Recommendation: order

1. **(2)+(6) `snap.js` with `x.env`/`x.recent`.** This is the only option that gives *per-note* snap, which is what the user asked for. Its function-of-time design makes determinism stronger, not weaker.
2. **(1) `hit`.** Cheapest, zero widget code, and lets the user re-drive 33 knobs in the lab tonight.
3. **(5) `snappy` tags.** A morning-friendly, whole-library "die off faster" slider that rides an existing mechanism.
4. **(4) trail only** (flash and punch behind a lab flag): a per-clip fade, a host lever for all widgets.
5. **(7)** as a video experiment only.
6. **(3)**: skip; `n.d` covers it.

Each step stays opt-in, and neither scene changes: `npm test` plus `npm run fidelity -- --quick`, plus `renderFrameHash()` on both scenes at three times each, before and after.

## Build tonight

**1. `lab/layers/snap.js` + ctx bindings + `tests/snap-env.test.ts` (Sonnet, 3 h).**
- Files: `lab/layers/snap.js` (new), `src/widgets/runtime.ts` (`ctx.env`, `ctx.recent`, `chords` swap in `safe()`/`picksQueue()`), `lab/index.html` (script tag, ctx, `SND.chords`), `src/widgets/types.ts`, `src/widgets/layers.ts` (WaLayers typing), `tests/snap-env.test.ts`.
- Acceptance: `npm test` green; fidelity `--quick` unchanged; `renderFrameHash()` for both scenes at t = 30/120/240 (liebesleid) and 60/300/600 (rach) unchanged.
- The user sees nothing by itself; it is the base for 2 and 3.

**2. Squares and gust with a `snap` knob (Sonnet, 2 h).**
- Migrate `lab/tools/squares.js` as shown above, and `lab/tools/gust.js` the same way (the `Math.pow(0.5, dt/0.34)` decay becomes `x.env` with half 0.34 → 0.1). Default 0 = today.
- The user sees: in the lab on `rach-concerto-2`, the "snap" slider from 0 to 1 while the opening chords play. Squares slam in within one frame, flash for ~60 ms, and are gone in ~0.4 s instead of 1.4 s; a pp note is a dim tile and an ff note a blaze.

**3. The `hit` drive (Sonnet, 1.5 h).**
- Files: see (1) above, plus `tests/widgets-features.test.ts`.
- The user sees: a new "each note → jump" choice in every knob's drive menu; switching squares' `shake` or rorschach/tunnel's `+level` knobs to it shows the difference live.

**4. Before/after video with sound (Sonnet, 1.5 h).**
- `docs/mockups/snap/videos/make.mjs`, based on `lab/render.mjs`. Same seed, same passages (rach 0:00–0:20 chords, 4:40–5:00 run; liebesleid 1:10–1:30), `snap=0` | `snap=1` side by side (`ffmpeg hstack`, audio from `songs/<id>/audio.mp3`).
- Plus a third panel: squares under clock gearing ×1.8 (lab-only `?gear=1.8` read in `lab/index.html` `step()`).
- The user sees: three-panel MP4s in `docs/mockups/snap/videos/`; whether snap reads as "alert, then gone" is answered by eye and ear in 20 s.

**5. Shape explorer mock-up (Sonnet, 2 h).**
- `docs/mockups/snap/envelope/index.html`, modelled on `docs/mockups/knob-transitions/mockup.html`. It loads `songs/rach-concerto-2/pack.json` and the audio, imports the real `lab/layers/snap.js` with a `<script>`, and draws one square per note with live sliders for `half`, `click`, `clickHalf`, `gamma` and `release`, with the curve plotted beside it.
- The user sees: the curve family itself, tuned by ear. The values they like become the `snap` knob's endpoints.