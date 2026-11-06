# Rachmaninoff PC2/I: the full show, plan

The show is `shows/rach-concerto-2-full.json`, for the whole movement (706 s). The user's own `shows/rach-concerto-2.json`
(0-168 s) is not touched. Sections, seconds and pick sets come from `ANALYSIS.md` and `picks.json` in this folder.

## 1. Motifs

Each musical idea keeps one widget for the whole movement. What changes from one statement to the next is size,
strength, colour or knobs, never the widget. Every motif clip listens to a pick set, so each mark lands on a note.

| Motif | Musical idea | Widget | Pick sets | Base knobs | How it varies per recurrence |
|---|---|---|---|---|---|
| **The bells** | The opening chords over the low F; the C1 pulse under theme 1; the deep strokes at the big arrivals (79.9, 134.2, 407.45, 475.2, 616.0); the four final chords. | `squares-snap` | `bells`, `c1-bells`, `deep-strokes`, `final-bass`, plus `march-bass` and `descent-bass` | size 1.4, life 2.4 (a slow bell sink), blur 1.2 | The big slow strokes belong only to the frame: the opening, the deep strokes and the final bass (size 1.2-1.4, life 2.4-3, shake up to 2 at the 407 s climax and at the end). The C1 pulse is smaller and shorter (0.9 / 1.0). The march bass is small and dry (0.7 / 0.4). The descent into the horn solo is small, soft and blurred (0.8 / 1.6, blur 2.2). The frame closes as it opened. |
| **Theme 1** | The brooding string melody: head, answer, rising and falling continuation; its cell in the dark development; its ff return at the march. | `handover` | `t1-head-a`, `t1-answer-a`, `t1-rise-a2`, `t1-fall-a2`, `t1-dev-frag`, `t1-head-a3`, `t1-answer-a3`, `t1-rise-a3` | goneBy 1.6, ring 1.3 | One slab per note, each gone as the next lands: the line is read note by note. The handover places a slab by pitch, so the recap's octave-higher statement stands higher on screen by itself. Per-note intensity sets each note's heard velocity on a phrase curve. 46 s: dark and small (size 0.6, heard 50-80). 76-112 s: the slabs grow with the rise (per-note size 0.6 to 0.85) and shrink with the fall (0.82 to 0.55). 321 s: small and dim (size 0.45, heard 40-60). 424 s: big and hot (size 0.8, heard 105-127; the slab's width grows with velocity, so this is about twice the 46 s slab). 448 s: the piano's rise grows again (0.62 to 0.9). |
| **Theme 2** | The lyrical second theme: the piano's head and tail, the second statement, the strings' climb, the apotheosis, the horn's return, the echoes. | `ivory` | `t2-head-b`, `t2-tail-b`, `t2-head-b2`, `t2-tail-b2`, `t2-strings-b2`, `t2-climax-line`, `t2-head-b3`, `t2-tail-b3`, `t2-echo-b4` | strike 1, presence 0.9 | Each head is the same arch of white keys: five keys climb to the top note, which stomps (a crater and a ripple), then five falling notes press them back. All three statements show the identical shape. 151 s: strike 1, a faint crater. 179 s: fuller (presence 1, crater 0.6, ripple 4). 222 s: the apotheosis, with an 18-key climb to Ab6, a deep crater, ripple 7 and per-note intensity up to 2 on the stomp. 522 s (horn, pp, a fifth lower): strike 0 so the keys swell up like a horn instead of being struck, presence 0.85 (intensity 0.8-0.95), a flat oval crater (floor 1), few cracks. The strings' climb at 200 s rises softly (strike 0.3). |
| **Points of light** | The piano's highest register: the exposition's close (G7 at 286.75), the trill at the top of the climax, the meno mosso, the high piano after the coda's sweep. | `hammer` | `filigree-high`, `climax-trill`, `meno-high`, `coda-high` | touch 3 (bell), ring 1.5, size 1.3-1.5 | Pale gold bars at the height of each note. Close: bell touch, size 1.5, G7 lifted (intensity 1.6). Trill: marcato touch, size 1.5, short ring; each restrike of F#5/G5 jumps its own bar. Meno mosso: bell touch, size 1.3, longest ring (2.0). Coda: piano touch (2), size 1.4, ring 1.3. |
| **The ff chord blocks** | The orchestra's and the piano's fortissimo chords: the transition tutti, the end of theme 2's climax, the climax chord storm, the march, the final chords. | `fireworks-snap` | `tutti-chords`, `t2-climax-chords`, `climax-chords`, `march-chords`, `final-chords` | swirl 0.55, linger 0.4 | The colour tells the story. Gold for the first tutti (hue 0.1) and rose for theme 2's climax (0.93). Red and huge for the climax storm (0.02, size 1.8, linger 0.55, chords at 398-405 s at intensity 1.5). Red but small and dry under the march (size 0.7, linger 0.15), so it does not hide theme 1. Gold again, the biggest of all, for the final chords (size 2.2, linger 0.8): the end answers the first tutti. |
| **The piano's drive** | The piano's driving, agitated figuration: the più mosso transition, the development's opening, the agitato build, the coda's last crescendo. | `flee` | `trans-accents`, `d1-accents`, `agitato-accents`, `coda-drive`, `coda-build` | snap 1 (each accent bolts on its own note) | Ember (pal 0) for the transition. Ice (pal 1) for the development's cooler opening. Ember with longer streaks and more twitch for the agitato (streak 1.4, twitch 0.5). In the coda it builds from faint (presence 0.6) to full. |

Two connecting threads, not themes:

| Thread | What | Widget | Sets | Knobs |
|---|---|---|---|---|
| The piano's runs | The flourishes that launch or answer a theme: 76.1, 478, the coda's sweep to C7 at 616.5, its rising scale at 643.7, the strings' scale into the last chords at 692.3. | `gliss` | `run-a2`, `run-a3`, `coda-sweep`, `coda-run`, `final-run` | hue 30-45 (warm), linger 0.6-1 |
| The lone wind voice | The clarinet/viola line in the bridge before theme 2, and the clarinet's answers in the codetta. | `current` | `bridge-winds`, `codetta-clarinet` | threads 1, cool hue (210), low presence |

**Ground.** `fields` on all notes, in five clips, only where the music is full. Its intensity curve follows the music: it
is out for the bridge, for theme 2's first statement (piano alone), for the high filigree, for the horn solo and for the
meno mosso. It is dark in the orchestra-alone development (321-342). `back` is 1.1 and the curve peaks at 0.65, so it stays behind the motifs (the first preview, at back 0.7 and peaks of 1, was a saturated wash).

## 2. Scene rules

- **No fake attacks.** Every motif is a snap widget or a line widget whose marks only fall after their note. Flee runs at
  snap 1, so each shape bolts on its own note and is gone in two seconds; it never bolts later. Pick clips have no
  intensity curves, so nothing fades a picked note out. Phrases are shaped with per-note intensity.
- **No wash over the piano.** Fields steps back (`back` 1.1, curve at most 0.65). Smoke lingers long only on the climax and the final
  chords. The march's fireworks are small and dry.
- **Sparse where the music is.** The bridge (141-151) has the wind thread and the tutti's last smoke. Theme 2 at 151 has
  ivory alone on black. The horn solo (521-556) has ivory, plus the tail of the descent's squares until 523. The meno
  mosso (575-614) has hammer alone. The final decay (697-706) fades to black.
- **Fades.** Every pick clip has a short fade (0.25-0.4 s) and starts at least that far before its first note, so no
  attack is dimmed. It ends after the widget's own tail: Ivory 3.5 s after its last note, squares their life, handover
  its goneBy.

## 3. Pick sets

The show keeps the sets' own ids as keys (`picks:t1-head-a` and so on). The format takes any slug; the user's sets
are named p1-p18, but readable ids are clearer here, and the picker's next id (`p1`, ...) cannot collide with them.
So the q-set to key table is the identity for the 35 sets of `picks.json`, with these changes to the notes:

| Set | Change | Why |
|---|---|---|
| `c1-bells` | The C1 at 40.53 s is dropped. | `bells` holds the same note. Two clips would strike it twice. |
| `t2-head-b`, `t2-head-b2`, `t2-head-b3` | The last three notes move to the start of the matching tail (`t2-tail-b`, `t2-tail-b2`, `t2-tail-b3`). The moved notes are C5-D5-B4 at 157.65, 185.04 and the horn's F4-G4-E4 at 533.56. | Ivory keeps as keys only the notes up to the line's top note (the stomp). Later notes press keys back, one each, up to the number of keys; any beyond that are never drawn. A head climbs five notes to its top and falls eight, so the last three would vanish. With five up and five back, each head is a whole arch. The tails then start with the cadence, and no note is lost (checked with Ivory's own rule). |
| `t1-dev-frag` | The three C6 notes (331.38, 338.99, 341.42 s) are dropped. | They are isolated high notes, probably the oboe, in a set meant for the low strings' cell. Handover would throw them to the top corner. |

Extra sets, from `extra-picks.mjs`, which writes `extra-picks.json`. They use the same note source and helpers as
`gen-picks.mjs`.

| Set | Window (s) | Rule | Used by |
|---|---|---|---|
| `deep-strokes` | 79-617 | Pack notes at midi 40 or below, within 80 ms of the strokes at 79.92, 134.22, 407.45, 475.18 and 616.04 s. | `squares-snap`, one short clip per stroke |
| `final-bass` | 694.6-697 | Pack notes at midi 43 or below, 694.7-697 s. | `squares-snap` |
| `run-a2` | 76-77.85 | Top of each roll piano cluster. | `gliss` |
| `run-a3` | 477.9-479.5 | Pack, top of each cluster. | `gliss` |
| `t2-tail-b2` | 187-200.3 | Skyline of all roll notes at midi 60 or above, minDur 0.3. | `ivory` |
| `t2-strings-b2` | 200.3-222 | Skyline of all roll notes at midi 60 or above, minDur 0.3. | `ivory` |
| `d1-accents` | 298-321.5 | Top note of roll piano clusters whose loudest note is velocity 90 or above. | `flee` |
| `coda-high` | 618.5-643.5 | Skyline of roll piano notes at midi 79 or above, minDur 0.2. | `hammer` |
| `coda-drive` | 656-680 | Top note of roll piano clusters whose loudest note is velocity 65 or above. | `flee` |

## 4. How to rebuild

- `node extra-picks.mjs`
- `node_modules/.bin/tsx docs/compositions/rach-concerto-2/build-show.ts`

The build reads `picks.json` and `extra-picks.json`, applies the changes above, adds per-note values and places the
clips. It then validates the show as `scripts/studio-api.ts` does (the pack's duration and tracks, the Node widget
catalogue) and writes `shows/rach-concerto-2-full.json` through `canonicalShow`.

## 5. The clips (as built)

53 clips on 10 tracks (draw order: fields, squares-snap, gliss/flee/current, fireworks-snap, handover/ivory, hammer). Each pick clip fades 0.3 s (0.5 for the two cut theme-2 tails), fields 1 s.

| Clip | s | Track | Widget | Listens to |
|---|---|---|---|---|
| c1 | 4.678-43.727 | 1 | `squares-snap` | picks:bells |
| c2 | 19.5-151 | 0 | `fields` | all notes (ground) |
| c3 | 41.519-60.634 | 2 | `squares-snap` | picks:c1-bells |
| c4 | 45.52-56.26 | 7 | `handover` | picks:t1-head-a |
| c5 | 55.78-67.03 | 8 | `handover` | picks:t1-answer-a |
| c6 | 75.61-80.48 | 3 | `gliss` | picks:run-a2 |
| c7 | 75.76-92.6 | 7 | `handover` | picks:t1-rise-a2 |
| c8 | 79.424-83.33 | 1 | `squares-snap` | picks:deep-strokes |
| c9 | 92.12-112.84 | 8 | `handover` | picks:t1-fall-a2 |
| c10 | 115.76-137.03 | 3 | `flee` | picks:trans-accents |
| c11 | 133.722-137.627 | 1 | `squares-snap` | picks:deep-strokes |
| c12 | 134.33-145 | 5 | `fireworks-snap` | picks:tutti-chords |
| c13 | 142.15-152.57 | 3 | `current` | picks:bridge-winds |
| c14 | 151-160.88 | 7 | `ivory` | picks:t2-head-b |
| c15 | 157.15-179.22 | 8 | `ivory` | picks:t2-tail-b |
| c16 | 178.76-188.33 | 7 | `ivory` | picks:t2-head-b2 |
| c17 | 184.54-200.45 | 8 | `ivory` | picks:t2-tail-b2 |
| c18 | 196-284 | 0 | `fields` | all notes (ground) |
| c19 | 200.03-225.57 | 7 | `ivory` | picks:t2-strings-b2 |
| c20 | 222.36-246.98 | 8 | `ivory` | picks:t2-climax-line |
| c21 | 243.75-256.58 | 5 | `fireworks-snap` | picks:t2-climax-chords |
| c22 | 254.5-277.64 | 3 | `current` | picks:codetta-clarinet |
| c23 | 278.99-302.44 | 9 | `hammer` | picks:filigree-high |
| c24 | 296-522 | 0 | `fields` | all notes (ground) |
| c25 | 299.95-318.25 | 3 | `flee` | picks:d1-accents |
| c26 | 321.73-341.5 | 7 | `handover` | picks:t1-dev-frag |
| c27 | 348.58-389.53 | 3 | `flee` | picks:agitato-accents |
| c28 | 392.34-423.4 | 5 | `fireworks-snap` | picks:climax-chords |
| c29 | 406.947-411.247 | 1 | `squares-snap` | picks:deep-strokes |
| c30 | 416.485-419.336 | 9 | `hammer` | picks:climax-trill |
| c31 | 421.056-444.299 | 1 | `squares-snap` | picks:march-bass |
| c32 | 422.2-445.68 | 6 | `fireworks-snap` | picks:march-chords |
| c33 | 424.04-435.08 | 7 | `handover` | picks:t1-head-a3 |
| c34 | 434.6-446.49 | 8 | `handover` | picks:t1-answer-a3 |
| c35 | 447.57-477.62 | 7 | `handover` | picks:t1-rise-a3 |
| c36 | 474.684-478.592 | 1 | `squares-snap` | picks:deep-strokes |
| c37 | 477.466-482.137 | 3 | `gliss` | picks:run-a3 |
| c38 | 493.533-523.645 | 1 | `squares-snap` | picks:descent-bass |
| c39 | 521.93-536.47 | 7 | `ivory` | picks:t2-head-b3 |
| c40 | 533.06-555.98 | 8 | `ivory` | picks:t2-tail-b3 |
| c41 | 550-578 | 0 | `fields` | all notes (ground) |
| c42 | 555.69-577.75 | 7 | `ivory` | picks:t2-echo-b4 |
| c43 | 574.85-618.6 | 9 | `hammer` | picks:meno-high |
| c44 | 614-706 | 0 | `fields` | all notes (ground) |
| c45 | 615.545-619.445 | 1 | `squares-snap` | picks:deep-strokes |
| c46 | 615.545-621.688 | 3 | `gliss` | picks:coda-sweep |
| c47 | 619.5-646.4 | 9 | `hammer` | picks:coda-high |
| c48 | 643.16-652.58 | 3 | `gliss` | picks:coda-run |
| c49 | 656.96-680.3 | 3 | `flee` | picks:coda-drive |
| c50 | 680.3-694.2 | 3 | `flee` | picks:coda-build |
| c51 | 691.83-697 | 4 | `gliss` | picks:final-run |
| c52 | 694.25-706 | 5 | `fireworks-snap` | picks:final-chords |
| c53 | 694.272-706 | 1 | `squares-snap` | picks:final-bass |

## 6. Revisions after the first preview

- Fields was a saturated wash over everything: `back` 0.7 to 1.1, and every pivot scaled by 0.65.
- Handover slabs grow with velocity (up to ~660 px wide at size 1, v 127): at size 1.7 the recap slab filled the frame. All handover sizes were cut to 0.45-0.9.
- The deep strokes and the final bass squares (size 2) covered half the frame: 1.2 and 1.4. Bells 1.6 to 1.4.
- At 179.3 the second statement of theme 2 rose among the 19 still-standing keys of the first tail: `t2-tail-b` and `t2-tail-b2` now end (0.5 s fade) just before the next statement.
- The horn statement (522) was a faint grey stub: presence 0.6 to 0.85, intensities 0.62-0.8 to 0.8-0.95.
- Hammer's lines were hair-thin: sizes 0.75-0.9 to 1.3-1.5.

# Revision 2 (2026-11-06): a score of threads

The user's verdict on the first version was: "The end is really good, the middle not so much. I am missing the
consistency." The coda (616-706) is the reference density. The middle now runs as threads, like orchestral sections.
Each motif is a thread that never stops between its statements; it only changes weight.

## R2.1 The threads and their sets

| Thread | Widget | Between statements (dim) | At its statements (full, as before) |
|---|---|---|---|
| Ground, broad | `fields` | one clip, 0-706; its curve is made from `pack.loudness`, at about 0.85 of the first version's level, and it never drops out | - |
| Ground, fine | `mica` | all notes, 0-706, a dim curve that follows the loudness | - |
| The bells | `squares-snap` | `th-bass`: the piano's lowest note per cluster at midi 45 or below, plus the low strings and bassoon; small (0.45) and dim (intensity 0.55) | opening, C1 pulse, deep strokes, march bass, descent, final |
| Theme 1 | `handover` | `th-inner`: violas and tenor cellos, small (0.35) and dim | 46-112, 321-342, 424-477 |
| Theme 2 | `ivory` | `th-violin`: the violins in phrases (cut so Ivory draws every note), presence 0.35 | the statements as before, plus the stacked ladders (R2.3) |
| Points of light | `hammer` | `th-high`: the piano's highest voice at midi 76 or above, intensity 0.55 | filigree, trill, meno, coda |
| Chord blocks | `fireworks-snap` | `th-accents`: every accent (velocity 92 or above), small and dry (size 0.45, linger 0.05) | tutti, climax chords, storm, march, final |
| The piano's drive | `pluck` (flee only as an all-notes texture 342-422 and 656-696; R2.5) | `th-acc`: the accompaniment figures, presence 0.6, intensity 0.6 | transition, D1, agitato, coda (now pluck) |
| The runs | `gliss` | `th-runs`: every run the transcription holds (7 or more cluster tops, each within 0.14 s, mostly one way) | 76, 478, 616, 643, 692 |
| The wind voice | `current` | `th-winds`: every wind note (clarinet, oboe, horn, bassoon, flute) | bridge, codetta |

The theme 2 entrances keep their spare moment, which the user liked ("the lonely, quiet ball of light followed by ivory
of the upgoing theme"). Over 141-156.5, 177.5-183 and 519.5-528 only current and ivory play; the other threads fade out
before and back in after, over 2-3 s.

## R2.2 Weights per 30 s window (planned before placing)

0 is off, 0.2 a dim trace, 1 full. Every window has at least four threads above 0.2 and two above 0.5.

| s | fields | mica | bells | theme 1 | theme 2 | light | chords | drive | runs | winds |
|---|---|---|---|---|---|---|---|---|---|---|
| 0-30 | 0.3 | 0.3 | 1 | 0 | 0 | 0.3 | 0.2 | 0.3 | 0 | 0 |
| 30-60 | 0.7 | 0.3 | 1 | 1 | 0.2 | 0.2 | 0.3 | 0.3 | 0.3 | 0 |
| 60-90 | 0.7 | 0.3 | 0.6 | 1 | 0.6 (ladder 76) | 0.3 | 0.3 | 0.3 | 1 | 0 |
| 90-120 | 0.6 | 0.3 | 0.3 | 0.8 | 0.2 | 0.3 | 0.3 | 0.6 | 0.4 | 0 |
| 120-150 | 0.6 | 0.4 | 0.5 | 0.2 | 0.6 (ladders 127-134) | 0.3 | 1 | 1 | 0.6 | 0.6 |
| 150-180 | 0.3 | 0.25 | 0.25 | 0.2 | 1 | 0.3 | 0.2 | 0.3 | 0.2 | 0.3 |
| 180-210 | 0.4 | 0.3 | 0.3 | 0.25 | 1 | 0.3 | 0.25 | 0.35 | 0.2 | 0.2 |
| 210-240 | 0.7 | 0.4 | 0.3 | 0.25 | 1 (climax line + ladder ranks) | 0.4 | 0.35 | 0.4 | 0.3 | 0 |
| 240-270 | 0.6 | 0.35 | 0.3 | 0.2 | 0.4 | 0.3 | 1 | 0.35 | 0.2 | 0.6 |
| 270-300 | 0.4 | 0.3 | 0.25 | 0.2 | 0.3 | 1 | 0.2 | 0.3 | 0.2 | 0.5 |
| 300-330 | 0.6 | 0.35 | 0.3 | 0.7 | 0.5 (ladder 303) | 0.3 | 0.3 | 1 | 0.5 | 0.3 |
| 330-360 | 0.5 | 0.3 | 0.3 | 1 | 0.5 (ladder 345) | 0.3 | 0.3 | 0.8 | 0.5 | 0.3 |
| 360-390 | 0.75 | 0.4 | 0.3 | 0.3 | 0.3 | 0.4 | 0.4 | 1 | 0.5 | 0.2 |
| 390-420 | 0.85 | 0.5 | 0.6 | 0.3 | 0.3 | 0.6 | 1 | 0.4 | 0.3 | 0 |
| 420-450 | 0.8 | 0.4 | 0.6 | 1 | 0.2 | 0.3 | 0.6 | 0.35 | 0.3 | 0 |
| 450-480 | 0.7 | 0.4 | 0.5 | 1 | 0.5 (ladder 478) | 0.3 | 0.3 | 0.4 | 0.6 | 0 |
| 480-510 | 0.5 | 0.3 | 0.6 | 0.3 | 0.3 | 0.3 | 0.25 | 0.35 | 0.2 | 0.2 |
| 510-540 | 0.3 | 0.25 | 0.4 | 0.2 | 1 (horn) | 0.2 | 0 | 0.2 | 0 | 0.4 |
| 540-570 | 0.5 | 0.3 | 0.3 | 0.3 | 0.6 | 0.3 | 0.2 | 0.3 | 0.2 | 0.3 |
| 570-600 | 0.35 | 0.3 | 0.2 | 0.2 | 0.25 | 1 | 0.2 | 0.3 | 0 | 0.2 |
| 600-630 | 0.45 | 0.3 | 1 | 0.2 | 0.5 (ladder 616) | 1 | 0.2 | 0.3 | 1 | 0.2 |
| 630-660 | 0.7 | 0.3 | 0.3 | 0.2 | 0.6 (ladder 643) | 0.6 | 0.3 | 0.35 | 0.8 | 0.2 |
| 660-690 | 0.75 | 0.3 | 0.3 | 0.25 | 0.2 | 0.3 | 0.35 | 1 | 0.5 | 0 |
| 690-706 | 1 | 0.3 | 1 | 0.2 | 0.6 (ladder 692) | 0.3 | 1 | 0.8 | 0.8 | 0 |

## R2.3 Stacked ivory on the solo ladders

On each long ladder, two or three ivory clips play at once. Each clip has its own pick set cut from the ladder: low,
middle and top register, or one clip per successive run. Each rank sits in its own window (a `region`, blend lighten),
lower-left to upper-right, so the keys climb in ranks as the run climbs. The ranks differ in strike and intensity. Every
rank set is cut into chunks by Ivory's own rule (no notes after the stomp beyond the number of keys), so every note
lands. The ladders: 76-79 (A'), 122-134 (the più mosso runs), 218-232 (theme 2's climax, the user's "3:39"), 303, 345
(development), 478 (falling, A'' cont.), 616 (the coda's sweep), 643 (the coda's scale) and 692 (the final scale).

## R2.4 As built: weights per 30 s window

Computed from the built show by `weights.mjs`: a statement clip counts 1, a ladder rank 0.6, a dim thread 0.3, a ground its curve's mean over the window. Each value is scaled down when the clip covers only part of the window. The last column is the most clips playing at once, grounds included. Every window meets the rule except 150-180, which is the theme 2 entrance the user asked to keep spare.

| s | fields | mica | bells | theme1 | theme2 | light | chords | drive | flee | runs | winds | >0.2 | >0.5 | clips at once (max) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0-30 | 0.54 | 0.34 | 1 | 0 | 0 | 0 | 0.22 | 0.3 | 0 | 0 | 0 | 5 | 2 | 5 |
| 30-60 | 0.86 | 0.52 | 1 | 1 | 0.27 | 0 | 0.3 | 0.3 | 0 | 0.3 | 0 | 8 | 4 | 10 |
| 60-90 | 0.84 | 0.51 | 0.59 | 1 | 0.47 | 0.3 | 0.3 | 0.3 | 0 | 0.69 | 0 | 9 | 5 | 13 |
| 90-120 | 0.81 | 0.48 | 0.3 | 1 | 0.31 | 0.09 | 0.3 | 0.62 | 0 | 0.21 | 0 | 8 | 3 | 10 |
| 120-150 | 0.53 | 0.32 | 0.59 | 0.24 | 0.43 | 0.3 | 1 | 1 | 0 | 0.3 | 0.98 | 10 | 5 | 12 |
| 150-180 | 0.38 | 0.21 | 0.3 | 0.2 | 1 | 0 | 0.19 | 0.3 | 0 | 0 | 0.46 | 6 | 1 | 6 |
| 180-210 | 0.56 | 0.32 | 0.3 | 0.3 | 1 | 0.06 | 0.06 | 0.3 | 0 | 0 | 0 | 6 | 2 | 6 |
| 210-240 | 0.8 | 0.47 | 0.3 | 0.3 | 1 | 0.3 | 0.3 | 0.3 | 0 | 0 | 0 | 8 | 2 | 13 |
| 240-270 | 0.78 | 0.47 | 0.3 | 0.19 | 0.9 | 0.3 | 1 | 0.3 | 0 | 0 | 1 | 8 | 4 | 9 |
| 270-300 | 0.66 | 0.38 | 0.3 | 0.16 | 0.19 | 1 | 0 | 0.3 | 0 | 0 | 0.96 | 6 | 3 | 7 |
| 300-330 | 0.78 | 0.47 | 0.3 | 1 | 0.42 | 0.44 | 0.29 | 1 | 0 | 0.23 | 0.3 | 10 | 3 | 13 |
| 330-360 | 0.79 | 0.47 | 0.3 | 1 | 0.39 | 0.3 | 0.3 | 1 | 0.39 | 0.25 | 0.22 | 11 | 3 | 15 |
| 360-390 | 0.86 | 0.52 | 0.3 | 0.3 | 0.28 | 0.3 | 0.3 | 1 | 0.64 | 0.24 | 0.23 | 11 | 4 | 12 |
| 390-420 | 0.9 | 0.55 | 0.63 | 0.3 | 0.3 | 0.49 | 1 | 0.3 | 0.67 | 0 | 0.1 | 9 | 5 | 12 |
| 420-450 | 0.85 | 0.51 | 1 | 1 | 0.3 | 0.3 | 1 | 0.3 | 0.01 | 0 | 0.2 | 8 | 5 | 11 |
| 450-480 | 0.78 | 0.46 | 0.59 | 1 | 0.3 | 0.3 | 0.3 | 0.3 | 0 | 0.45 | 0 | 9 | 3 | 13 |
| 480-510 | 0.73 | 0.43 | 1 | 0.3 | 0.33 | 0.3 | 0.29 | 0.3 | 0 | 0.41 | 0.24 | 10 | 2 | 13 |
| 510-540 | 0.42 | 0.24 | 1 | 0.2 | 1 | 0 | 0 | 0.3 | 0 | 0 | 0.3 | 6 | 2 | 5 |
| 540-570 | 0.74 | 0.44 | 0.3 | 0.3 | 1 | 0.19 | 0.3 | 0.3 | 0 | 0 | 0.3 | 8 | 2 | 9 |
| 570-600 | 0.64 | 0.37 | 0.23 | 0.28 | 0.98 | 1 | 0.08 | 0.3 | 0 | 0 | 0.25 | 8 | 3 | 9 |
| 600-630 | 0.65 | 0.37 | 0.59 | 0.16 | 0.42 | 1 | 0 | 0.3 | 0 | 0.81 | 0.18 | 7 | 4 | 10 |
| 630-660 | 0.74 | 0.44 | 0.3 | 0.25 | 0.52 | 1 | 0.3 | 0.5 | 0.07 | 1 | 0.3 | 10 | 4 | 13 |
| 660-690 | 0.76 | 0.45 | 0.3 | 0.2 | 0.26 | 0.3 | 0.3 | 1 | 0.46 | 0.24 | 0 | 9 | 2 | 9 |
| 690-706 | 0.72 | 0.49 | 1 | 0.3 | 0.6 | 0 | 1 | 0.99 | 0.44 | 1 | 0 | 9 | 6 | 14 |

## R2.5 What changed, per section

- **Everywhere.**
  - The fields ground is one clip, 4-706 s. Its curve follows the loudness (0.55-0.9, back 0.7), so it is plainly visible through the middle. It dips to 0 only at the three theme-2 carve-outs.
  - Mica is the fine ground: on all notes, dim (0.3-0.55). Each note glints its own shard set.
  - Seven threads run between their statements: bass squares, inner-strings handover, violin ivory, high-voice hammer, accent fireworks, accompaniment pluck, runs gliss and winds current.
- **The drive.** Flee came off every pick set (the user: it suits overwhelming numbers of notes, not specific notes). The drive thread is now **pluck**: each note pulls its own straight thread to one hard bone-white corner, and a repeated note pulls the same thread. That suits repeated accompaniment figures. Its red ring-out also stays in the show's palette, whereas tack's red slabs would collide with handover and squares, and crimp's wool smears. The statement sets that flee had (transition, D1, agitato, coda drive and build) now play on pluck at full presence. Flee survives only as a texture on all notes, 342-422 s (agitato and climax storm) and 656-696 s (coda II), at snap 1.
- **Transition (112-141).** Ivory ranks on the più mosso runs, plus dim violins, the bass, accents and the inner strings over the grounds. The tutti is as before.
- **Bridge and theme 2 (141-200).** The entrance at 151.5 is kept as the user liked it: the current thread, then the first key alone on black. The other threads return about 156.5 s. The 179.3 statement has a short clearing (177.5-183.2), then the threads come back.
- **B2 and the climax (200-253).** The strings' climb, plus three windowed ivory ranks on the 218-232 ladder over the full-frame climax line. Threads around them.
- **Codetta and close (253-298).** Current and filigree as before, now over visible fields, mica, dim violins, pluck and bass.
- **Development (298-388).** Pluck statements (D1, agitato), ivory ranks at 303 and 345, handover on the inner strings throughout, flee texture from 342.
- **Climax and recap (388-480).** Flee texture, the red storm, the trill, the march. Ladder ranks at 478.
- **Dissolve and horn (480-556).** The descent squares are a little larger (size 1, blur 1.5). The horn entrance at 522.4 clears 519.5-528, then fields, mica, bass and violins return dimly under the horn's ivory and current.
- **B'' and meno mosso (556-616).** The echoes' ivory and the meno hammer over visible fields, mica, the current, dim violins and pluck.
- **Coda.** As before, plus the grounds and the threads. The drive is now pluck, and flee is a texture on 656-696. Ladder ranks at 616, 643 and 692.
- **Ivory.** `huddle` is 0.8 on theme 2 and the violin thread, 0.85 on the ladder ranks.

## R2.6 The ladders

Each ladder is cut into three ranks, the low, middle and top third of its pitch range. Each rank keeps its own climb (on
478, its fall) and plays in its own window: lower left, centre, upper right. From the lowest rank to the highest, strike
goes 0.4 → 0.7 → 1, presence 0.65 → 0.8 → 1 and intensity 0.85 → 1 → 1.25. Rank notes that do not continue the climb
are left out of the ranks; the other threads still hear them. A rank that climbs again after a pause of more than 2.5 s
becomes a new chunk. The 122 ladder ranks by succession instead: run i goes to rank i mod 3.

| Ladder | s | Rank clips (keys) low / middle / top |
|---|---|---|
| lad-076 | 75.7-82.0 | 1 (2) / 1 (3) / 1 (3) |
| lad-122 (più mosso runs) | 116.8-135.0 | 3 (17) / 2 (8) / 2 (17) |
| lad-219 (the user's 3:39) | 217.9-235.7 | 5 (7) / 4 (9) / 3 (11), over the full-frame climax line |
| lad-303 | 302.5-308.3 | 1 (2) / 1 (3) / 1 (3) |
| lad-345 | 344.2-351.4 | 2 (2) / 1 (2) / 2 (3) |
| lad-478 (falling) | 477.6-483.5 | 1 (1) / 1 (4) / 1 (2) |
| lad-616 (coda sweep) | 616.1-622.1 | 1 (5) / 1 (5) / 1 (4) |
| lad-643 | 643.3-653.4 | 2 (4) / 2 (9) / 2 (6) |
| lad-692 | 691.8-698.1 | 1 (3) / 1 (3) / 1 (5) |
