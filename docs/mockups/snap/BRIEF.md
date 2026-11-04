# Snap: widgets that answer each note, sharply — the brief for tonight's agents

Written 2026-11-04 (night) by the coordinating session. Read this before anything else; it holds the user's words, how the
code works today, and the constraints. File paths are relative to the repo root (this worktree).

## The user's words, verbatim

> For this night, I'd like you to think about what we can do to make the visualisations SNAP more to their notes. I am
> thinking about moving AWAY from the idea of connecting notes to "violin" or "strings", because those are unreliable and
> create sub-par visualisations. I would like to focus on connecting them to individual notes. But for this, we need the
> widgets to be very snappy and reactive to the notes individually. I would like you to perform a thorough thought analysis
> about what we can do to make this more appealing to the user. This is a big task, and I want you to create several mock
> ups which I can judge. It doesn't matter if you change a lot of the existing functionality, but I would like to keep at
> least the Liebesleid and rachmaninoff concerto 2 scenes intact, so that they dont break.
>
> But the main focus is on making animations more snappier: when they react to an attack, make them more alert to the
> initial attack, and let them die off more quickly. If you have ideas about knobs we can use to do this, then that's great
> too. If you have ideas about sorts of curves we can use, great. The idea is that you create some mock ups or ACTUAL
> implementations (temporary) for me to judge. [...] Btw, this type of software does not yet exist, and you are creating
> frontier creative work.

What the user judges in the morning: mock-ups and temporary implementations, played with the music. They judge by eye
and ear. "Snappy" = alert to the initial attack, dies off quickly. "Individual notes" = the notes the user picks by hand in
the studio ("Pick notes" → "Connect notes to a widget"), not instrument tracks.

## What WinkelAmp is (one paragraph)

A recording is transcribed once into notes `[start, end, midi, velocity]`. A show (`shows/<song>.json`) places canvas
widgets (`lab/tools/<id>.js`, 58 of them) as clips on tracks under the song, like DJ software. Each clip can listen to all
notes, a part, or a set of picked notes (`"listen": "picks:p1"`, the notes stored in the show under `picks`). A widget is
`TOOLS.push({ id, name, blurb, params, reset(x), onChord(ch, x), frame(x) })`; it draws on a shared 1280×720 2D canvas that
fades toward black a little every frame. `lab/index.html?song=liebesleid` is the lab (toggle widgets, tune knobs, play);
the studio (`index.html`) plays the shows; `render.html` draws frames on demand for scripts.

## How a widget hears a note today (the mechanics that decide snappiness)

Read `src/widgets/types.ts`, `src/widgets/features.ts`, `src/widgets/runtime.ts` (step()), `lab/tools/squares.js` (the
reference widget, 57 lines), `lab/layers/slot.js` (layered slots), `src/studio/show/note-values.ts` (per-note values).

- **Attacks.** Notes whose onsets fall within 40 ms are one attack, a `Chord { t, notes: [{m, v, d, amount?}], vel, lo, hi }`.
  Every step (a live frame, dt ≤ 0.05 s, or a render substep at 60 Hz) the runtime fires every chord whose time was crossed:
  `onChord(ch, x)` on each receiving widget, then `frame(x)`. **A widget hears the attack in the same frame it happens, so
  latency is not the problem; what each widget does with it is.** Note ends are not events: a widget can only ask
  `x.sounding()` (notes started in the last 8 s and not yet ended) and `x.top()`.
- **The shared pulse** (`advanceFeatures`): `level` decays with a half-life of **0.8 s** and is kicked to `max(level,
  vel/115)` by each attack (a max, not a sum, so a soft note after a loud one does nothing); `rate` decays with a half-life
  of 1.0 s and gains 1/1.44 per attack. `feat.pitch`, `feat.bass`, `feat.density` follow what sounds with a 0.25 s half-life.
  These drive knobs: a knob with `drive: '+level'` reads `base + depth × (max − min) × feat.level`. This pulse is slow and
  loudness-only: it is one of the reasons a widget feels late and mushy. A clip that listens to a part or has a curve has its
  own pulse (same constants).
- **The background fade** is `rgba(0,0,0,0.12)` per step plus a colour-burn: at 60 Hz something left on the canvas is half as
  bright after ~0.09 s, so trails are short by default and what lingers is what widgets keep redrawing.
- **Per-widget envelopes.** Each widget keeps its own objects (`sq.push({age: 0, ...})`) and ages them in `frame`:
  `fade = (1 − age/life)^1.6`, `lit = 1 − age/0.3`, `Math.exp(−dt/0.22)`, `Math.pow(0.86, dt×60)` and so on. Time constants
  are hand-picked per widget, commonly 0.3–4 s. Some widgets smooth or rank attacks (gust ranks loudness against the
  piece; duet damps hits when `feat.rate` is high; flee freezes a shape for ~0.55 s before it bolts). Many effectively
  low-pass the music.
- **Knobs.** At most 5 (plus `presence`, "how present"), each `{ key, label, min, max, value, drive?, hint, icon, less? }`,
  read with `x.p('life')`. Rule from `lab/README.md`: at default values a widget draws exactly what it drew before, and a
  stored knob value never changes meaning. Drives add `depth × (max − min) × feature`.
- **Picked notes carry values** (`note-values.ts`): an `intensity` 0..2 (scales velocity, and `amount` on the chord note),
  and any knob value, held from that note's attack until the set's next attack. No widget code knows of this.
- **Intensity curves** (`lab/layers/automation.js`) thin attacks and fade the paste weight; `presence` moves the knobs that
  declare `less`. Clip edges fade over `fade` seconds.
- **Determinism.** Renders, seeks and live play must agree: everything must be a function of song time and seeded
  randomness (`x.rnd`), nothing of wall time except through `x.now` for the lab. Widgets like Ivory precompute the whole
  plan from the notes.

## The two scenes that must not break

- `shows/liebesleid.json` (song `liebesleid`, 296 s). Widgets: ivory ×13 (on picks), duet, fireworks ×2, fischinger, flee
  (accents), gliss ×2, miro, pointillism, timeslice. 17 sets of picks.
- `shows/rach-concerto-2.json` (song `rach-concerto-2`, 706 s). Widgets: squares ×4, gliss ×5, gust ×2, kline ×2,
  kandinsky ×2, casket, fields, fireworks, halftone, ivory. 18 sets of picks.
- Both are the user's hand work and uncommitted in their own worktree; our copies are for testing only. "Intact" means: no
  errors, and at default settings they draw what they draw today (pixel-identical through `render.html` is the proof we
  can run: `window.renderFrameHash()`). So **new behaviour is opt-in**: a new knob whose default is today's behaviour, a
  new widget, a new show field, a lab-only switch, or a mock-up page. Changing a scene widget's default look is out.

## What can be built and judged (the deliverable forms)

1. **A new or reworked widget** in `lab/tools/<id>.js`, registered in `TOOL_IDS` in `lab/index.html` (and the studio's
   catalogue: check `src/widgets/catalogue.ts` / `scripts/widget-docs.ts`). The user toggles it in the lab with the music.
2. **A runtime or harness change** (`src/widgets/*.ts`, `lab/layers/*.js`, `lab/index.html` step()): e.g. a second, fast
   pulse, an envelope service widgets can read, a note-off event, a host-side "snap" post-pass. Must keep the lab and the
   studio bit-identical at defaults (tests in `tests/`, `npm test`).
3. **A stand-alone mock-up page** in `docs/mockups/snap/<name>/` (`docs/mockups/knob-transitions/mockup.html` is the
   model: real CSS and real functions where cheap, fake where not). Can play a real recording from `songs/<id>/audio.mp3`
   with real notes from `songs/<id>/pack.json` (served by the dev server) and draw its own canvas.
4. **Videos with sound** for side-by-side judging: `lab/render.mjs` (one widget, five passages, with sound) and
   `lab/demos.mjs` (silent 640×360 clips) show how; `scripts/render-show.mjs` renders a show. ffmpeg and system Chrome
   are on this machine. A before/after `hstack` of the same passage is the strongest way to show "snappier".
5. **A show** (`shows/<id>.json`) or lab layer settings that demonstrate a widget on picked notes.

The dev server for this worktree will run on **port 5300** (never 5173: that is the user's own server). Checks that
start their own Vite (`scripts/lib/studio-session.mjs`) pick a free port from 5196.

## Constraints and taste

- The user judges by feel. Plain words in knob names and hints (`lab/README.md`: at most 5 knobs, Left/Right sentences, a
  small picture each). Earlier verdicts: "no fake attacks" (an aftermath must not look like a new attack: a quiet, quick
  change of state instead); "modulator" means an intensity curve, not a knob drive; Codex's 12 recipe widgets were called
  abominations (generic, template-like). Hand-made, specific, musical.
- Piano is the main instrument (Rachmaninoff, Kreisler/Rachmaninoff): a piano attack is instantaneous, then an exponential
  decay; the pedal makes transcribed note lengths unreliable; chords and single notes both matter; velocity 0..127 is real.
- Keep everything deterministic in song time. No wall-clock animation.
- Nothing merges tonight. Everything lands on this branch for the user to judge; they decide in the morning.
