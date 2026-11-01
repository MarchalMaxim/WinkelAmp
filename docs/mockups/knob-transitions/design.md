# A knob can change over its section

Final design. Nothing here is built in the repo. The clickable mockup is `mockup.html` in this folder. It uses the studio's real CSS, the real `automationAt`, the real flee knob pictures and the real Rachmaninoff sections. The music features and the picture are fake.

**What reached me.** The brief's text was cut off. I saw "Aim the lane" in full and "Two handles" up to its flow. For the third design ("A knob can move through its section") I had only the sketch. I saw one judge, cut off in the middle of its graft list at item 10, and no second or third judge. I also read the "Two handles" sketch directly. If a hidden judge said something decisive, it is not reflected here.

## The idea in one line

A knob has a start and an end. The slider's thumb becomes two: a ring for the section's start and a solid dot for its end. The line graph you asked for is the same two points, drawn over time, and you only see it if you want it.

## What appears, and when

| Situation | What is on screen |
|---|---|
| No knob changes (nearly always) | Exactly today's panel, timeline and lanes |
| Pointer or focus on a knob row | A small `↗ over time` pill on the divider above the slider's right end. It lies over empty space, so nothing shifts. On a touch screen, a tap on the row shows it. |
| A knob changes | **On the row:** two handles captioned `start` and `end`, a white tick for the value now, and one line of words: `[start picture] → [end picture] steadily ▾  Draw it  ✕`. Under it, in dim text: `Over this section. "faster → more" still pushes it. The next section starts at ▾. Carry on from here`. <br>**In the lanes:** a thin strip for this knob under the layer's intensity lane. It is shown only while the layer is open. <br>**Elsewhere:** the closed layer head says "trail length changes", and the section block gets a small wedge in the widget's hue, with the knob named in its tooltip. |
| You click `Draw it` or the strip | The strip becomes the tall lane and the intensity lane collapses, so the lanes stay about the same height. The lane bar's title reads "trail length". Clicking the intensity strip swaps back. |

## The flow

1. Point at trail length and click `↗ over time`. This is one undo step and the show changes at once, so there is no empty state to get stuck in. The ring stays at the current value. The dot lands a quarter of the range toward the side with more room.
2. Drag the ring and the dot. Each drag is one undo step. While you hold a handle, the picture and the row's live picture show that value.
3. Press play. The white tick and the picture follow. Most people stop here.
4. To change the pace without a graph, click `steadily ▾`: Steadily, Slow then fast, Fast then slow, Smooth at both ends. Each has a tiny curve picture. These are ordinary pivots, with `bend` ±0.5 or `shape: "ease"`.
5. For a real graph, click `Draw it`. All of today's lane gestures work: click to add (snapped to beats), drag, bend a segment, double-click to delete, right-click for Linear / Ease / Hold. The words then read `your own line`.
6. Undo steps back one gesture at a time.

**There are two ways out, and they differ on purpose:**

- **`✕`** means "I don't want this". The curve goes and the knob returns to the slider value it had before. If you never touched it otherwise, the show is byte-identical to before.
- **Dragging the two handles together** means "one value, here". While you hold them together the caption says `let go: one value`, and on release the knob becomes a plain slider at that value.

Other removals: deleting pivots in the lane until fewer than two remain, or "Back to the widget's own settings", which resets the whole layer as it does today.

**After lane edits**, the handles still edit only the first and last pivot. A faint band on the slider shows the range if inner pivots go beyond the handles. Choosing a pace from `▾` replaces the inner pivots, which one undo restores.

## How it combines with a drive

The line sets where the slider sits, and the drive still moves the knob around it. In code, `knobValue`'s base is replaced by the line, with the same drive term and the same clamp. The drive dropdown is untouched, and "over time" is deliberately not one of its options, because that would make the two exclusive.

- **The trap.** Trail length defaults to "faster → more" at depth 0.5. A line drawn at "no trail" therefore still gives trails in fast passages. I do not switch the drive off automatically, because that would change the picture silently. Three things show it instead:
  - the sentence on the row, which names the drive
  - the white tick and a dot on the lane, both showing the real value and visibly off the line
  - a shaded band in the lane showing how far the drive can push, cut off where it clamps
- A knob on "fixed" gets no sentence and no band.

## Section boundaries

**The rule: a line belongs to its section, and at the boundary the next section's value takes over, as knobs already do today.**

| Case | What happens |
|---|---|
| The same widget continues and the values differ | A `▾` mark on the slider shows where the next section starts, with `Carry on from here` beside it |
| You click `Carry on from here` (one undo step) | With no line in the next section, its slider moves to this end value. With a line there, its first pivot does. A long build is this repeated. The ends are not linked afterwards: move one and the mark and the offer come back. |
| They already meet | "The next section carries on from here." |
| The widget does not continue | "It holds its end value as it fades out." |
| A pivot sits inward from the section's edge | The value holds before the first pivot and after the last |
| Whole show view | Lays the instance's run out as today. A section with no line draws flat at its own slider value, not at 100 %, so a jump is seen as a jump. |
| Split | Two lines that meet; the picture is unchanged |
| Merge | Joined, using the knob's own value where one side has no line. This is not the `v: 1` that `joinPivots` uses for intensity. |
| Boundary drag | A pivot on the moved edge travels with the edge, so a start-to-end line stays start-to-end. Inner pivots stay at their song time; shrinking past them clips with an edge pivot. |

## Show JSON

Inside the existing knob setting, not as a new layer field:

```json
"knobs": {
  "mix": 0.15,
  "streak": {
    "base": 0.8,
    "drive": "+rate",
    "curve": [
      { "t": 84.45, "v": 0.02, "bend": -0.5 },
      { "t": 103.934, "v": 0.95 }
    ]
  }
}
```

- `t` is song seconds and `v` is 0..1 over the knob's min..max. The pivot type is the same as for intensity (`shape`, `bend`).
- `base` stays as the value `✕` returns to.
- A setting with no curve keeps today's form, so existing shows keep their bytes. The show's version becomes 2 only when a curve exists.
- The value is a pure function of `ctx.t`, so playing, seeking and rendering should agree. Without a curve the new branch is not taken.
- Which lane is open is view state: not saved and not undoable.
- Stepped knobs (colours): handles and pivots snap to levels. The widget gets fractional values in between, as it does from drives today.

**Plain knobs.** A knob with no picture and no hint draws as today's compact one-line row (`.prm.plain`). The pill and the two handles take the same place in its slider area, and the words line uses the lab's gauge picture, which `drawIcon` already falls back to. The mockup only builds rich rows, so this is on paper only.

## Left out, and why

| Left out | Why |
|---|---|
| A lit pill as a further way to remove | `✕` and dragging together are enough; it would add a permanent control |
| Timeline-wide knob tracks, or lines spanning sections | You have 20–30 sections, and "Carry on" covers builds with one rule |
| "Until the end of <section>" | A later shortcut if "Carry on" feels slow. It would write joined per-section lines, not a new data shape. |
| Linked ends that move together | Implicit joins surprise people, and "Carry on" is explicit |
| A thumb that moves the whole line | A DAW trim idea, and it would not move at all on a full-range line |
| Lanes for closed layers | Keeps the stack short |
| Curves on drive depth, drive choice, Where, Listens to | You asked for parameters; the spec's non-goal on region keyframes stands |
| Lab support | Studio only, as you asked |
| A precise trace of what the music adds, in the lane | Needs the features simulated over the section. The band plus the live tick and dot are cheaper and honest. |

## Known risks

- **Discovery.** A hover-only pill can be missed. That is the price of "looks like today". I would test this before adding anything permanent.
- **A two-thumb slider reads as a min/max range by default.** The captions and the words line are there to prevent that. Untested with people.
- **"The same for every knob" is true of the UI, not of the result.** The "Aim the lane" designer's rough scan found about 36 of 222 knobs read only when an attack arrives, so their change shows only on new notes. Treat that as an estimate. That designer checked two by hand and reported `streak` as read per frame and `mix` as read at the attack; I saw the `streak` read at `flee.js:249` but did not verify either at runtime. Some widgets with accumulated state may barely show a slow sweep.
- **Lane resolution.** At 56 px, knobs with many steps are fiddly, and in Whole show a short section is only a few dozen pixels wide (Agitato is about 85 px of 1008).
- **Phone.** The lane is far from the knob, with the panel below the timeline. Readable and draggable in the mockup, but it is a desktop-first gesture.

## Build size

About 10 files and 9 tasks. Line counts are rough guesses from reading the code; nothing was prototyped against the real repo.

| # | Task | Files |
|---|---|---|
| 1 | Curve in the model: `KnobState.curve`; `knobValue` gets `t` and branches on whether a curve exists, because `automationAt` returns 1 for no pivots, which is wrong for a knob; `ctx.p` passes `ctx.t` | `src/widgets/types.ts`, `features.ts`, `runtime.ts` |
| 2 | Show format: `KEYS.knob`, the canonical `knob` pick (it drops unlisted keys on save), `usesV2`, validate, repair, one-line pivots | `src/studio/show/show.ts` |
| 3 | Edits: `trimLayers` and split/merge/boundary for knob curves; `joinPivots` with the knob's own value as fill; moved-edge pivots | `src/studio/show/edit.ts` |
| 4 | `settingOf` and `knobState` must keep the curve. Today `settingOf` rebuilds only base, drive and depth, so any slider move would silently drop it. | `src/studio/ui/knobs.ts` |
| 5 | Two-handle slider: pill, handles, keys, captions, words line, menu, `Carry on`, collapse (about 250 lines) | new `src/studio/ui/knob-move.ts` + css, `knobs.ts` |
| 6 | Panel: head wording, row sync, live tick | `src/studio/ui/panel.ts` |
| 7 | Lanes: a target abstraction (intensity or knob), flat value for no curve, end pictures, band, value dot, bar title. This is the largest risk (about 150 changed lines in a 680-line file). | `src/studio/ui/lanes.ts`, `lanes.css` |
| 8 | Hold preview while dragging a handle (the paused picture must show the held value, not the value at the playhead), and the section wedge | `src/studio/show/conductor.ts` or `src/studio/ui/player.ts`, `timeline.ts` |
| 9 | Tests and checks: knob maths; byte-identical existing shows; round trip through save; split/merge; render determinism with a curve; a `studio-check` flow | `tests/knobs.test.ts`, `show-v2.test.ts`, `show-edit-layers.test.ts`, `scripts/studio-check.mjs` |

## What the mockup does and does not prove

Driven with Playwright over `file://`: all 39 checks pass.

**Checked:**
- hover and pill
- both handle drags, each one undo step
- tick moving during play
- pace menu
- lane open, pivot add and drag
- lane edge pivot equals the dot
- `Carry on` and its undo
- full undo and redo
- `✕` and full undo both byte-identical to the start
- collapse by dragging together
- stepped knob and keyboard
- phone: no horizontal scroll, tap to show the pill, finger drag

**Only looked at, not asserted:** Whole show view (a screenshot showed the line, the dimmed outside and the jump; dragging in it was not exercised).

**Not checked:**
- anything in the real studio: the design has not been built there, so the real `Conductor`, saving and rendering are untouched
- how a real widget's picture looks under a real drive
- whether people find the pill

Only flee and squares have knobs in the mockup. Split, Merge, Add a widget, Listens to and Where are inert there.

## Unrelated, for your attention

`src/studio/ui/style.css` styles the page header with the class `.top`, and knob rows also use class `top` (`knobs.ts`). Below 900 px, the header's `position: sticky; top: 0; z-index: 10; background` rule therefore applies to every knob row too. From reading the CSS, knob rows should stick and paint over the header on a phone. I saw this as black bands and overlap in my first mockup screenshot, before I neutralised the rule in the mockup's own CSS. I did not confirm it in the real studio and did not change the repo.
