# The cast

<!-- Generated from src/stage/elements (each widget file's defineWidget) by `npm run cast`. Do not edit by hand. -->

Every element follows one stream of the music. Up to four on stage at once. The handbook
([COMPOSING.md](COMPOSING.md) §3) has the params every element shares; this is each one's own.

| Element | Follows | Styles (first = default) | Knobs: range [default] | Use it for |
|---|---|---|---|---|
| `bass` | the bass level and the music's weight | `orbs` three soft bodies that swell with the bass · `tides` swells rolling along the bottom | `sink` 0.05..2 [0.35] — music seconds the shapes take to settle after the bass drops | heavy, low, dark music; a bass line that matters |
| `bloom` | the harmony: chord root on the circle of fifths → hue, minor cooler and paler, cross-fades on chord changes | `fields` large soft clouds · `aurora` curtains hanging from the top | `fade` 0.1..4 [1] — music seconds a chord change takes to cross-fade | harmony-led, sustained, lush passages; a colour bed |
| `drip` | onsets: streaks falling from the top of the region, accelerating | `paint` the palette's mid and highlight · `tar` its shadow, near black | `accel` 0..2 [0.6] — how fast a drip speeds up as it falls (per music second) | the picture running, dripping off the screen; with `look.melt`. `intensity` → how many, `size` → how wide |
| `fluid` | the overall character: the Living Canvas (fluid, sparks, aura), its material set by the mood | `living` the Living Canvas | — | atmosphere, turbulence, a full-screen bed; heavy and stormy music |
| `melody` | the predominant melody: pitch, note on/off, duration (precomputed for a scripted song, so it is exact and on time) | `ribbon` a smooth glowing band · `beads` one bead per note, bigger for longer notes · `ink` dye poured into a fluid when one is on stage, else dry brush strokes | `trail` 1..8 [4] — music seconds of the phrase left on screen | whenever a clear tune is present. Higher notes sit higher (further out under a kaleidoscope mirror); the last ~4 s of the phrase stay visible (by default: `trail`) |
| `pulse` | the beat (hidden while pulse clarity < 0.3) | `rings` a ring from the region's centre · `grid` a throbbing lattice · `flash` the region lights up | `gate` 0..1 [0.3] — the pulse clarity below which there is no beat to show · `decay` 0.25..3 [1] — how fast each throb dies away (× the style's own rate) | music with a clear, steady beat (dance, march, ragtime). Not for rubato |
| `slash` | strong attacks (onsets, on the frame they sound): each one cuts the picture (see the `cut` accent). Draws nothing itself | `chords` only loud, chord-like attacks (three or more pitch classes, or bass and treble at once) while the music itself is loud, at most one cut per 120 ms (by default: `rest`) · `every` any onset above a lower threshold | `rest` 0.03..1 [0.12] — music seconds at least between two cuts | a section where the chords should do the cutting: panic, horror, a climax that tears. `intensity` lowers the threshold (at 0.7 a fff piano climax cuts on about every big chord), `size` scales the shove, `color` the scar (`mood`: a sickly pale yellow) |
| `sparks` | onsets and high notes (bursts where they sound) | `stars` twinkling points (star-shaped when the material is angular) · `dust` many tiny slow motes · `embers` warm streaks that rise | `speed` 0.25..3 [1] — how fast a burst flies apart (× the style's own speed) | quick high notes, staccato, pizzicato, sparkle; `dust` for quiet texture |
| `wave` | the raw waveform (an oscilloscope) | `line` across the region · `circle` wrapped round its centre | `width` 0.25..4 [1] — how thick the trace is drawn (× its own width) | the fine detail of a single voice or a drone; electronic textures |

## Knobs and drives

A knob is set in `params.knobs`, by name: a number sets its value (`"knobs": { "trail": 6 }`), an object
sets any of `value`, `drive` and `depth` (`"knobs": { "decay": { "value": 1.5, "drive": "+level" } }`).
A drive pushes the knob up (`+`) or down (`-`) with a feature of the music, by `depth` [0.5] of its
range: at full strength the knob moves `depth × (max − min)` from its value (`pitch` pushes around its middle,
so a middle note leaves the knob where it is). The value is kept inside the range. The features, each 0..1:

- `level`: how loud: the strongest attack, halving in 0.8 s, never below the loudness
- `rate`: how busy: attacks per second ÷ 8
- `pitch`: how high: the top note sounding (C1 0 … C8 1), held through rests
- `bass`: how much low end: the bass level
- `density`: how full: pitch classes sounding at once ÷ 6

They move on music time only: in silence a driven knob holds still, like the rest of the picture.
