# Widget showcase

One video per widget, each widget alone, over the same five passages of your two recordings. Open `index.html` in this
folder (double-click it, or http://localhost:5173/lab/showcase/index.html with the dev server running) to watch them all
on one page, the showreel first. The `.mp4` files are not in git (they hold your recordings); only this README and the
page are.

**`00-showreel.mp4`** (3:00, 960x540, about 25 MB, small enough to send to a phone): 6 s of each widget, in the order below,
each from its busiest stretch of "the casket" (chosen by measuring how much is on screen and moving, then checked by eye).

## The videos (76 s each, 1280x720, 30 fps)

Passages in every video: Rachmaninoff dread (0:00), agitato (0:14), the casket (0:28); Beethoven 5 fate knocks (0:48),
coda (1:02). Around 0:54 to 1:00 every widget goes almost black: that is the pause after the opening knocks, where the
recording has no notes. It is not a fault.

| # | widget | your verdict so far | what to watch for |
|---|---|---|---|
| 01 | Dread squares | love (v2) | Low notes land as big blurred dark-red squares and fade in about 1.4 s. Sparse by design, so expect black stretches. |
| 02 | Skittish shapes | love (v3) | High notes freeze, tremble, then bolt into streaks; bass hits rise from below; loud chords scatter them. |
| 03 | The current | love (v3) | The melody steers the white-gold thread; chords pour dye that the water spreads. |
| 04 | Woven threads | love (v2, you accepted the defaults) | Consonant notes lean together, clashes knot; chords braid the threads and send kinks along them. |
| 05 | Murmuration | needs work, your favourite (on v2); **reworked since: v3** | The fix you asked for: a loud chord now re-forms the flock into that chord's own figure (its notes on a clock face), so the same chord always gives the same shape. Does the re-forming read as musical now? |
| 06 | Rorschach ink | love (v2, our defaults) | Low notes soak into mirrored blots, high notes fling specks, the fullest chords splatter. |
| 07 | Kandinsky | love++ (on the first version); **reworked since: v2** | As you asked: no more low red squares (that is Dread squares' job) and a notch smaller and quieter. Check it kept what you loved. |
| 08 | Colour fields | keep (on the first version); **reworked since: v2** | The chord sets the hue, loudness sets the light; a band of the new colour washes in on each chord change. Made to sit under other widgets. |
| 09 | Marbling | needs work (on the first version); **reworked since: v2** | For "doesn't respond correctly to the sound": louder now means a bigger drop, higher means brighter ink landing higher. |
| 10 | Calligraphy | not judged yet | One brush stroke per phrase, following the top notes; strong chords add a red slash, a pause a red ensō. |
| 11 | Glitch blocks | not judged yet | Attacks tear blocks out of place and they snap back in steps; big chords tear a mosaic and flash an inverted band. |
| 12 | Op art (Riley) | not judged yet | A stripe field: bass swells lenses, the melody ripples it, chords kink it into chevrons. It fills the whole picture. |
| 13 | Halftone | not judged yet | Two dot screens: low notes send big slow red swells, high notes small fast pale ripples. |
| 14 | Harmonic web | not judged yet | Each attack strings a polygon between the sounding notes on a circle of fifths; old chords sink into a web. |
| 15 | Suprematism | not judged yet | Malevich planes: bass slams black bars, chords add red and ochre blocks, loud passages tilt the whole composition. |
| 16 | Contours | not judged yet | Notes raise warm hills or sink cool pits on a mirrored contour map. |
| 17 | Tunnel | not judged yet | Notes drop outlines at the far end of a zoom tunnel; busier playing speeds the fall, big chords surge forward. |
| 18 | Scribble | not judged yet | One nervous pen per register; loops coil tight in dense passages and open into arcs when it is soft. |
| 19 | Pointillism | not judged yet | Each note dabs a burst of dots coloured by its distance from the home key, so the harmony paints regions. |
| 20 | Harmonograph | not judged yet | A pendulum pen tuned to the chord: an octave or a fifth draws a simple figure, a clash a dense knot. Faint when quiet. |
| 21 | Hilma af Klint | new, not judged | Pastel geometry: major chords open petals, minor chords curl into spirals, the bass swells the split disc. |
| 22 | Kline | new, not judged | Each big chord strikes one huge black bar on bone white: wide chords long, low chords flat, high chords upright. |
| 23 | Graphic score | new, not judged | The music writes its own drifting abstract score: heights, beams, stems and blocks. |
| 24 | Boogie woogie | new, not judged | Mondrian's grid: notes drop blocks where pitch lane meets harmony row, and every attack makes them hop along. |
| 25 | Cells | new, not judged | One coloured cell per note, a new row per chord, coloured by the harmony; new notes split cells off. |
| 26 | Nebula | new, not judged | Glowing grains orbit and stream between the notes; chords throw them outward. |
| 27 | Pixel sort | new, not judged | Chords grab strips and sort them into pixel streaks (bass down, high notes up). Made to mix over other widgets, so alone it is sparse. |
| 28 | Mandala | new, not judged | A radial bloom: fuller chords make more copies; it turns with the tempo and breathes with loudness. |
| 29 | Agnes Martin | new, not judged | Pale washed bands under a pencil grid. Deliberately quiet: it is made for the chorale and nearly ignores loud music, so it barely moves here. |
| 30 | The casket | love (built into the app) | For reference: the picture melts, paint drips, big chords slash cuts. |

## How they were made

`node lab/render.mjs <widget id> <out.mp4>` (needs the dev server on :5173, Chrome and ffmpeg):

- **Frame by frame, not a screen recording.** The lab page runs in render mode (`index.html?render=1`): no audio playback and
  no animation loop. The script steps the song clock itself and draws frame k of a passage at exactly `start + k/30` s,
  with the same drawing code as the live lab. A slow frame can never drop or drift.
- **Exact sync.** The sound is cut from the same recordings at the same times (sample-accurate), so a chord shows on the
  first frame at or after its time, never more than one frame (33 ms) late.
- **Default knobs.** The page starts with empty local storage, so every widget runs at our defaults, not at slider
  settings saved in a browser. Randomness is seeded, so the same widget gives the same video every time.
- Each passage gets 3 s of unrecorded pre-roll so the picture is not empty when it starts, a short dip to black between
  passages, its name for the first 2.5 s, and the widget's name in the corner throughout.
- The showreel was cut from these files with ffmpeg (6 s windows, the title for the first 3 s, two-pass x264 at about
  1 Mbit/s to keep it under 28 MB).
