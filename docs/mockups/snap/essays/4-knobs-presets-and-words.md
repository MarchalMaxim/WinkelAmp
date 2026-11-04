# Knobs, presets and words

*One of six brainstorms for the snap night. Lens: the knobs, the curves, and the words on them.*

## 0. What a shared knob can reach

A widget can only respond to a knob it reads with `x.p(key)`. A shared knob that no widget reads has to act through something the runtime controls. `runtime.ts step()` controls four things, and each knob below uses exactly one of them.

| Lever | Where it lives today | What it can do |
|---|---|---|
| **The time it is given** (`ctx.dt`, per slot) | `step()` sets `ctx.dt = dt` once for all slots | Run fast for a moment after an attack (a quicker rise), and fast in the tail (a shorter ring) |
| **What it hears** (`ch.vel`, `n.v`) | `onChord(ch, x)` gets the shared chord | A velocity curve: how much soft notes count |
| **How much of its drawing is kept** (paste weight) | `slot.weight < 1` takes the scratch-copy path. `WA.vis(a, cls)` (`lab/layers/persist.js`) turns an amount into a paste weight per persist class | A per-attack envelope on visibility, applied after the widget draws |
| **What its drives read** (`Features`) | `knobValue` adds `depth × (max − min) × f[drive]` | A new fast feature, so that any existing knob can jump on each strike |

I counted how the 16 scene widgets age (number of `dt` / `x.t` uses in each file). The time lever does not reach all of them:

| Widget | Ages by | quick / ring (time) | hit (paste) | Note |
|---|---|---|---|---|
| squares, casket, duet, flee, fields, kandinsky, miro | `x.dt` | yes | yes | Full reach |
| gust, kline | `x.dt` | yes | partly | Opaque bone or ground: a duck fades it toward black |
| fireworks | `x.dt` (fluid `step(dt…)`) | yes, capped at 0.05 per step | yes | A faster fluid also curls faster: a side effect |
| pointillism, timeslice, fischinger, halftone | mixed | partly | yes | Their own clocks keep running on `x.t` |
| **ivory** | `x.t − k.t` only | **no** | yes | The plan is a function of song time |
| **gliss** | fixed `STEP`, replayed from song time | **no** | yes | Same |

The paste lever reaches every widget, but it can only remove light. The time lever can make a rise faster, but it misses the two widgets the scenes depend on most. That is why there are two different knobs below, not one.

**Defaults are identities, not seconds.** A tail lasts 1.4 s in squares, 4 s in kline and 8 s in pointillism, so the ring is a multiplier (×1 by default) and the hit is a contrast amount (0 = off). With no `snap` on a slot, `step()` runs today's statements byte for byte. With `snap` present at default values, the warp is exactly `dt * 1` and the weight is exactly 1, so the `fading` branch is never taken. Liebesleid and Rach 2 keep their `renderFrameHash()`.

## (a) The shared vocabulary: four snap knobs

These are not in `tool.params`. Putting them there would break the five-knob rule, and `ctx.p` only finds keys that are in params. They are a host strip, **Snap**, stored per clip as `clip.snap`, with `show.snap` as the default for clips that have none. The keys match `/^\w+$/` (needed by `badValue` for per-note values) and avoid fischinger's `snap` and the three `decay` knobs.

```json
[
  { "key": "snapQuick", "label": "how quick to answer", "min": 0, "max": 1, "value": 0,
    "hint": "How fast a note's shape reaches its peak. Left: as the widget draws it. Right: the first tenth of a second happens at once; it is there on the note." },
  { "key": "snapRing", "label": "how long it rings", "min": 0.25, "max": 2, "value": 1,
    "hint": "How long what a note leaves keeps going. Left: gone in a quarter of the time. Right: twice as long, and it moves slower."},
  { "key": "snapHit", "label": "how hard the first hit", "min": 0, "max": 1, "value": 0,
    "hint": "How far the strike stands above what it leaves. Left: as drawn. Right: only the strike shines; what follows sinks back within a few tenths of a second." },
  { "key": "snapTouch", "label": "how much soft notes count", "min": 0, "max": 1, "value": 0.5,
    "hint": "How the widget hears loudness. Left: only loud notes make much. Right: a soft note answers almost like a loud one." }
]
```

**Icons in words** (40×26, `ICON` helpers, `v` = slider position 0..1):
- **quick:** a rise line from the bottom left to a peak, then a flat line. The peak's x position is `2 + (1 − v) × 18`. At the left the rise is a gentle slope; at the right it is a vertical wall.
  `ICON.line(g, 2, h-3, 2+(1-v)*18, 4); ICON.line(g, 2+(1-v)*18, 4, w-2, 4)`
- **ring:** `ICON.fade(g, w, h, 0.12 + 0.88 * v)`, the same picture as squares' "how long they stay".
- **hit:** two bars side by side, with the second bar at `1 − v` of the first's height: `ICON.rect(g, 6, 3, 8, h-6); ICON.rect(g, 22, h-3-(h-6)*(1-v), 8, (h-6)*(1-v), ICON.dim)`.
- **touch:** `ICON.dots`, eight dots that grow left to right. At the left the small ones are almost invisible; at the right they are all nearly the same size.

**What each knob maps to.** `s = t − (this instance's last delivered attack)`, `sm` is smoothstep.

```
quick → time:   warpQ(s) = 1 + 2·snapQuick·e^(−s/0.05)          // ∫ extra = 0.1 s at full: squares' 0.1 s land and gust's 0.1 s ease
ring  → time:   warpR(s) = 1 + (1/snapRing − 1)·sm(s/0.15)      // the first 0.15 s untouched, then the tail runs ×(1/ring)
dtEff = min(0.05, dt · warpQ(s) · warpR(s))                      // 0.05 is the lab's own cap: at 60 Hz the most is 3×
hit   → paste:  L(s) = 1 − snapHit·(1 − e^(−s/0.12));  weight' = weight · WA.vis(L(s), inst.persist)   // 1 on the attack frame
touch → hearing: γ = 4^(1 − 2·snapTouch);  v' = round(127·(v/127)^γ)   // γ = 1 at 0.5: skip the remap, exact identity
```

`WA.vis` matters for the hit. The paste-back is non-linear: at weight w, a redrawn object settles at `w / (0.12 + 0.88·w)` of its brightness, so w = 0.1 still shows 48 %. `vis` already holds the measured inverse for each class, so `L(s)` means perceived brightness. Hit is defined as contrast between peak and tail on each attack. It does not scale velocity: per-note intensity already does that, and the two would overlap.

**In the runtime** (`step()`, per slot, around the existing statements):

```ts
const sn = slot.snap;                                  // undefined → today's statements, untouched
let w = slot.weight;
if (sn) {
  if (heard.length) inst.lastHit = t;                  // heard = the chords this instance was given this step
  const s = t - (inst.lastHit ?? -1e9);
  ctx.dt = Math.min(0.05, dt * (1 + 2 * sn.quick * Math.exp(-s / 0.05)) * (1 + (1 / sn.ring - 1) * sm(s / 0.15)));
  if (sn.hit > 0) w *= WA.vis(1 - sn.hit * (1 - Math.exp(-s / 0.12)), inst.persist);
}
// … onChord with touchChord(ch, sn.touch) (a cached clone per γ: chords are shared objects), frame, paste at w …
ctx.dt = dt;                                            // the next slot gets the real dt
```

Layered and routed instances go through `slot.js drawLayered`, which already takes a weight and the delivered chords, so the same three lines go there too. The global pulse never sees the touch curve. An instance with its own pulse does, which is right.

### A fifth lever, for widgets that want it: the `+hit` drive

Add `hit` to `Features`: `p.hit *= 0.5^(dt/0.07)`, and on each fired chord `p.hit = min(1, 0.5·p.hit + 0.3 + 0.7·vel/127)`. Add `'+hit' | '-hit'` to the `Drive` union. The UI word: **"on each strike → more"**. A soft note after a loud one still kicks it, which `level` (a max) does not do.

Any existing knob can then jump with no widget code: squares `size` driven `+hit` at depth 0.3 makes each landing swell by 0.3 × 1.7 = +0.51 for about 70 ms; gust `power` and duet `push` work the same way. Existing drives keep their arithmetic, so the defaults stay bit-identical. The new line goes into both `features.ts advanceFeatures` and the lab's `step()` in `lab/index.html`, in the same order.

## (b) Curves a musician would recognise: articulations

In the studio, "curve" already means the intensity lane, and so does "modulator". These presets are therefore named for touch and articulation, and the difference is stated on screen in one line: **the lane is how much over the piece (slow, drawn by hand); an articulation is what each note's own second looks like (fast, every attack).**

A preset is a named point in the four knobs. It stores the four numbers, so a preset never changes meaning later.

```json
{
  "as written":  { "snapQuick": 0,   "snapRing": 1,    "snapHit": 0,   "snapTouch": 0.5 },
  "secco":       { "snapQuick": 0.8, "snapRing": 0.35, "snapHit": 0.3, "snapTouch": 0.5 },
  "staccato":    { "snapQuick": 1,   "snapRing": 0.25, "snapHit": 0.6, "snapTouch": 0.5 },
  "marcato":     { "snapQuick": 1,   "snapRing": 0.6,  "snapHit": 0.8, "snapTouch": 0.35 },
  "martellato":  { "snapQuick": 1,   "snapRing": 0.4,  "snapHit": 1,   "snapTouch": 0.2 },
  "bell":        { "snapQuick": 1,   "snapRing": 1.6,  "snapHit": 0.65,"snapTouch": 0.5 },
  "una corda":   { "snapQuick": 0.3, "snapRing": 0.8,  "snapHit": 0,   "snapTouch": 0.8 },
  "pedal down":  { "snapQuick": 0.5, "snapRing": 2,    "snapHit": 0,   "snapTouch": 0.6 }
}
```

One plain line each, for the chips:
- **secco:** dry; here, then gone.
- **staccato:** short and detached; a blink per note.
- **marcato:** every note marked; a strong strike, a short shadow.
- **martellato:** hammered; only loud notes, nothing between them.
- **bell:** a bright strike that drops at once to a long, quiet ring. This is a two-stage decay: the hit takes the brightness, and the ring keeps the tail.
- **una corda:** soft pedal; soft notes count, no edge.
- **pedal down:** everything rings and overlaps.

Bell is the piano's own shape (an instant strike, a fast first drop, then a slow tail) and is the one I would expect the user to keep. Martellato and staccato are where "snappy" is plainest.

**Preset picture** (the chip's icon, 40×26): the brightness of a squares-like object over the first 1.5 s, `e(s) = (1 − τ(s)/1.4)^1.6 · L(s)`, where `τ(s) = ∫₀ˢ warp` is the warped age. Plotting the real formula means the picture and the screen agree.

## (c) Per-note values: the bars under picked notes

The plumbing is almost all there already:
- `heldValues` holds a value from one attack to the next attack of the set.
- The snap envelope is a function of the time since the last attack.
- So the value of attack k governs exactly `s ∈ [t_k, t_{k+1})`: one note's articulation, and never a fake attack.

Three changes are needed:
1. **`picker-popup.ts:239`.** After `INTENSITY_LANE`, append the four `SNAP_PARAMS` as knob lanes:
   `[INTENSITY_LANE, ...SNAP_LANES, ...noteKnobs(…)]`.
   The bars read "how hard the first hit", and so on. Plus one **articulation lane**: a chip per note (`·` secco, `>` marcato, `^` martellato, `○` bell) that writes that preset's four numbers into the note.
2. **`schedule.ts`.** `knobsAt` merges held values into `knobs`, which the runtime ignores for unknown keys. In `entry()`, split any `snap*` key out into `ScheduledWidget.snap`, filled from `clip.snap`, then `show.snap`, then the held values, and pass it through the Conductor to `Slot.snap`. `perNote(widget, 'snapHit')` is already true.
3. **`note-values.ts`.** Nothing to change: the keys pass `badValue`. A stored note looks like `[132.41, 132.9, 76, 88, {"snapHit": 0.9, "snapRing": 0.4}]`.

The musical use: in a run of picked notes, mark only the downbeats `>`. Ivory then flashes on those and keeps the others quiet, and you did not have to split the run into two sets.

## (d) Where it appears

- **Lab card.** Under the widget's own knobs, a collapsed row: **Snap ▸ as written**. Opened, it shows the 8 articulation chips with their pictures, the four small knobs, and a **scope** (160×28): `L(s)·e(s)` traced live over the last 2 s, with a tick at each attack. Snap is visible while you listen.
- **Lab transport.** `?snap=staccato` applies a preset to every widget. The key **S** toggles bypass for an A/B at the same moment, on the same seeded frame.
- **Studio clip panel.** One small row: **How notes are struck: as written ▾**, with the chips and an "edit" disclosure for the four knobs. It sits next to how present, not where the old Intensity menu was (that menu was removed on purpose).
- **Show settings.** A show-wide default (`show.snap`), so a whole scene can be "secco" without touching each clip.
- **Timeline.** A tiny glyph on the clip's label (`>`, `·`, `○`) when the clip is not "as written". A picked note with a snap value gets a tick under it, as intensity has.
- **Picker.** The lanes from (c).

## A show- or clip-level snap the widget never knows about

This is the design above. It runs on the host, after the widget draws, without the widget's knowledge.

**Pros**
- It works on all 58 widgets tonight, including the user's hand-tuned ones, without opening a single file. That fits "change a lot, but don't break the scenes".
- The defaults are provably identical (`dt·1`, weight 1, γ = 1 → skipped), which keeps the hash proof cheap.
- It is deterministic: everything is a function of song time and the attack times.
- It works per note through an existing mechanism, and the per-attack envelope matches `heldValues`' semantics exactly.

**Cons**
- **The time warp misses ivory and gliss**, which plan from song time. Only the hit (paste) reaches them, and the paste only removes light. For those two, a quicker rise needs widget code: a single `rise` read in Ivory's `(x.t − k.t)/k.rise`.
- **The warp speeds up motion as well as ageing.** A ring of ×0.3 makes squares fall 3× faster and fireworks curl 3× faster, and the 0.05 cap limits the warp to 3× at 60 Hz and 1.5× at 30 fps live. The hint has to say so ("…and it moves faster").
- **The paste duck fades toward black.** On kline's bone ground or gust's ground it greys the paper. Those widgets should get hit = 0 in presets, or the strip should say "no hit on a lit ground".
- **Cost:** one full-frame copy and `drawImage` per snapped slot per step. That is the existing fading path, but now running all the time: perhaps 0.3–0.6 ms per slot at 1280×720.
- **The host cannot add light,** so there is no true "flash". A brighter strike needs a delta pass (below) or a widget-level read.

My conclusion is to use both layers. The host snap gives the user something to judge in the morning across everything. The drive `+hit` and a one-line `x.p`-style helper later give widget authors a precise version.

## Build tonight

1. **Mock-up page: "Articulation"** (`docs/mockups/snap/articulation/index.html`, one file, about 2.5 h).
   - Plays `songs/liebesleid/audio.mp3` with `songs/liebesleid/pack.json` notes from the dev server on 5300.
   - Draws two 640×360 canvases side by side, left "as written" and right the chosen articulation. Each runs a small squares-like widget and an ivory-like bar widget, using the formulas above exactly (warp, `vis`-like table, touch).
   - Has the 8 chips with their real `e(s)` pictures, the four sliders, and the live scope.
   - **The user sees** the same notes struck two ways and can click through staccato, marcato and bell while the music plays.
2. **Temporary host snap in the runtime, lab-only switch** (about 4 h).
   - **Files:** `src/widgets/runtime.ts` (`Slot.snap`, the warp, weight and touch block), `lab/layers/slot.js` (the same for layered slots), `lab/index.html` `step()` (the lab copy, same order) and `?snap=<preset>`, the S key and the preset table, plus `src/widgets/snap.ts` (`SNAP_PARAMS`, `PRESETS`, `touchChord` cache).
   - **Test:** `tests/snap-identity.test.ts` checks that `renderFrameHash()` for liebesleid at 60/150/200 s and rach-concerto-2 at 30/300/600 s is equal with no snap and with `snap = as written`.
   - **The user sees** any widget in the lab with the music and an articulation chip; ivory's flash appears through the hit.
3. **The `+hit` drive** (about 1.5 h).
   - **Files:** `types.ts` (`Features.hit`, `Drive`), `features.ts` (`newFeatures`, `advanceFeatures`), the lab `step()` copy, and the drive word list in `lab/index.html`.
   - **The user sees** a lab combo, "struck": squares `size +hit 0.3`, gust `power +hit 0.4`, duet `push +hit 0.5`. Each landing visibly swells for 70 ms.
4. **Before/after videos** (`docs/mockups/snap/videos/`, kept local, about 1.5 h).
   - Use `lab/render.mjs` twice per widget (squares, gust, fireworks, ivory), with and without `?snap=staccato` and then `bell`.
   - Combine each pair with `ffmpeg -filter_complex hstack` and `drawtext` labels, on two passages: the opening chords of Rach 2 and Liebesleid at 2:53.
   - **The user sees** eight 20-second clips, with sound, as written next to snapped.
5. **Per-note articulation in the picker** (about 2 h, after 2).
   - **Files:** `picker-popup.ts` (snap lanes and the articulation chip lane), `schedule.ts` (split `snap*` into `ScheduledWidget.snap`), the Conductor (pass it to `Slot.snap`), and a test copy `shows/liebesleid-snap.json` where six ivory downbeats carry `snapHit 0.9`.
   - **The user sees** the accents marked note by note in the scene they already know, with the original show untouched.