# Danse macabre · D · Six Rooms at Midnight (chapter plan)

Show id: `danse-macabre-d-chapters`. Song: `songs/danse-macabre` (429.8 s). Pick sets: `picks.json` beside this file;
every extra set is derived inside the build script (never edit `picks.json` or `gen-picks.mjs`).

**Judged:** three maps (family, space, free). **Won:** the *family* map ("Six Rooms at Midnight"). It has the most
distinct grounds (grey photographic sea, black velvet, black ballroom of discs, indigo glow, pale paper, op-art
stripes), the richest developments, and three returns the music makes identical by itself (nap places bands by pitch;
hammer keeps one bar per key). **Grafted:** from *space*, the fugato as stacked horizontal staves of B, one per voice,
opening at the real entries (120.87, 125.05, 129.27, 134.73; the family map's 122.9 and 130.6 were wrong), and the nine
last blows as Midnight's clock (they restrike midnight's own D4 bar); from *free*, the bones (X) born as a keyhole that
grows each time the bones are heard (80 → 105 → 112 → 170 → 213 → full at 222), and the procession frieze for the
woodwind interlude. **Fixed:** B's handover replaced by huddled Ivory per phrase (`long-notes` holds 3 notes in the
solo and 1 in the tutti, and theme B's phrases are too quick for slabs); the chorale's dark-red handover seals dropped
(the user's rule: handovers are milky, and milky is invisible on pale paper); the hammer removed from the pp final
chords (STYLE rejects hammer on pp final chords; pluck takes them, rhyming with the hush chord); nap fixed at
`memory` 2 with a repeat rule (see D) so Death's bands do not blink to black; `build-to-tutti` and `last-trill` claims
corrected (68.59/68.87 are D4s; the trill is D4–Eb4, not Eb5); X statement ends at 244.08, not 244.5. **Rejected
graft:** murmuration in Death's room. Its re-form bar is 112 − 30·strike (82 at strike 1); the tuning dyads score
vel − 3 = 34–50, so the "tritone lens" would never form.

## The idea

The dance moves through six rooms. A room is a visual family with its own ground, palette and layout, and each widget
in it listens to that chapter's strands. A chapter is one call `chapterX(start, end, variant)`: widgets, knobs,
palette, track order and regions are fixed inside the function; the variant carries only the listen-set ids, a scalar
`lift` (0..1: presence, intensity and window scale) and, for A, a `legato` flag (pulse 0 on bowed stretches). A return
calls the same function, so it is the same room by construction, only louder or bigger. Every member is in every call: a strand is absent only when its set is empty there. A chapter called inside a parent rect (the recap's half, the woven strips, the frenzy quadrants, the frieze panels) maps its own regions into that rect. Fit: `cover` for near-16:9 windows and ellipses, `stretch` for strips and staves. A development never invents a
look: it works on rooms the eye already knows (a room cut into staves, one room's moons over another's sea, a frieze of
small rooms, the waltz broken into a lattice and reassembled, two rooms split and then woven, four rooms in a grid).
X, the bones, is seen first through a keyhole whenever the bones rattle, and the keyhole grows until it is a room.
Midnight and Death bookend the show: M D … M D M. No on-screen text.

## The chapters

### M · Midnight: the sea and the bells (bookend)
- **Ground:** `horizon`, full frame, lowest track. `colour` 0 (pure greys, the only colourless room),
  `presence` 0.2 + 0.8·lift, contrast rising with lift. It hears the union of the clip's M sets.
- **hammer** (the bell), `touch` 3 (bell), `ring` 2: `clock-strokes` (one D4 bar, twelve times), `pedal-e-toll`,
  `pedal-a-toll`, `final-hammer` (D4+G4: the same D4 bar as midnight), `cock-crow`.
- **pluck** (the pizzicato threads): `hush-chord`, `grave-pizz`, `dawn-tremolo`, `final-pizz` (the hush chord at 9.62
  and the last chords at 425.38/426.24 are drawn by the same clip function: the rhyme).
- **Dawn only:** milky `handover` on a derived `dawn-slabs` (the first note of each dawn chord: 383.66, 389.65,
  390.58, 391.59, 394.02).
- **Layout:** full frame, nothing windowed; bars stand on and above the horizon. Palette: grey sea and sky, bone bars.
  Spare by design (2–3 threads).

### D · Death's fiddle: oxblood velvet
- **Ground:** black (the velvet).
- **nap**, `cloth` 0 (oxblood), `memory` 2 (a double stop keeps both bands lit; restroking it re-flashes them),
  `rest` 6 (holds through the farewell's 1–3 s gaps). Inside `chapterD` its set passes through `napSet()`: a single
  note that repeats the previous single note's pitch is not restroked (prickle still marks it), so a repeated note
  never switches its band off. Hears `tuning-tritone`; returns: `build-to-tutti` notes 69/75 from 69.13 (the same
  A4/Eb5 bands as 18.88), `farewell-violin`, `last-trill` (D4–Eb4: the same tilts as D and Eb, lower), `bass-trill`.
- **prickle**, defaults: one red thorn per note from alternate edges. Hears `tuning-fifths`; returns: the two D4s of
  `build-to-tutti` (68.59, 68.87) plus its notes, `farewell-violin`, `scurry`, the frenzy's blows.
- **Layout:** full frame, diagonal bands, thorns cut in from the sides. Palette: oxblood and red on black, bone tips.

### A · The Waltz: a ballroom of whirling discs
- **Ground:** black.
- **A1** `delaunay`, full frame: the dance floor, on the bass (`dance-begins` ∪ `pizz-waltz-bass`, then
  `pizz-waltz-bass`, `bass-tutti-1`, `bass-development`, `bass-finale`).
- **A2** `delaunay` in an ellipse window (x 0.76, y 0.30, w 0.38·s, h 0.48·s, feather 0.2): the tune
  (`theme-a-flute`, `theme-a-in-d`, `theme-a-tutti`, `theme-a-xylophone-d`, `development-line`/`build-line` phrases).
- **A3** `delaunay` ellipse window (x 0.22, y 0.74, w 0.30·s, h 0.38·s): a `thread-high` slice to the clip, in every
  A call (in the first statement it covers the flute hole 30.68–34.43 with the high string doublings).
- **A4** `mandala`, full frame, lighter blend: the colour strand (`harp-chords-31`, `winds-56`, `hammered-chords-80`,
  `repeated-d-chords`, `repeated-d-303`).
- **Knobs:** delaunay defaults except presence 0.7 + 0.3·lift, pulse (0.45 + 0.3·lift), or 0 when `legato`;
  window scale s = 1 + 0.35·lift. Palette: Orphist colour on black; every frame shows segmented rings turning.

### B · The Sigh: indigo field, gold thread, ice weave, keys
- **Ground:** `fields`, full frame. `home` pinned at −0.6 with its drive off (`{"base": -0.6, "drive": ""}`, so the
  loud tutti does not warm it toward oxblood), `chords` 0 (the colour must not follow the harmony), `n` 3, `dyn` 0.3
  (legato pitch changes must not light fields like attacks), presence 0.6 + 0.4·lift. Hears the theme line.
- **the current**, `threads` 1 + floor(2·lift) (one thread in the solo and in each fugal stave, three in the tutti), `hue` 220: the theme line as one gliding thread (`theme-b-solo-violin`,
  `theme-b-tutti`, `recap-theme-b-line`, `chromatic-ascent`, fugal voices).
- **strings** (woven threads), defaults, in a low band (y 0.78, h 0.34, feather 0.3): the accompaniment
  (`pizz-waltz-bass` slice, `bass-tutti-1` slice, `recap-high`).
- **Ivory**, `huddle` 0.8, `strike` 0, in a centred window (w 0.6), one short clip per phrase (`theme-b-solo-p1..p4`,
  `theme-b-tutti-p1..p3`): the loved "lantern and keys" in an indigo room.
- Nothing strikes or bursts, so the 0 %-onset tutti looks exactly like the solo.

### C · The Chorale (Dies irae): the pale chapel
- **Ground:** `martin`, full frame, `paper` 1, presence 1. Hears `chorale-top` ∪ `chorale-bass`: held notes tint
  their stripes. The show's only light room, arriving on the sudden drop.
- **lewitt**, defaults, in a band window (y 0.5, h 0.36, w 0.92, feather 0.15, `stretch`), because it paints its own
  plaster wall and must not hide the page: the harp's ripple drawn by rule in coloured pencil (`harp-arpeggios`); from
  199.34 a second clip in the same band on `chorale-pulse`. Martin shows above and below the band.
- **stella**, defaults, top track (it works on the finished picture): one frame per top-line note (`chorale-top`), inverting the paper into dark frames that close
  in phrase by phrase, a cloister.
- Palette: bone and ash bands, graphite, faint primaries, dark frames. Marks dark on light: the inverse of every room.

### X · The Bones: black-and-bone stripes
- **Ground:** `riley`, `colours` 0 (black and bone), on the lowest track of its region. Bass swells lenses
  (`bass-tutti-2`, `bass-finale` slice). presence 0.4 + 0.6·lift.
- **timeslice** (the riley + timeslice combo) on `tutti-c-line`: staircases of cut stripes.
- **blocks** (`form` positive, rows) on `build-213` and `xylophone-bones`: rows torn sideways on each rattle.
- **pixelsort**, `own` 0.1 (riley + pixelsort combo, riley kept black and white) on loud wide chords only:
  `brass-calls` 228–231, the xylophone's ff stamps 237.2–238.9, `stop-244`.
- **xKeyhole(start, end, set, w):** a rect window, always at x 0.74, y 0.30, h = 1.2·w, feather 0.1, holding riley
  (+ blocks on the same set). It opens on its set's first note and closes at its last note plus ring.

## Timeline

| m:ss | chapter | kind | how |
|---|---|---|---|
| 0:00–0:09.6 | M | bookend | lift 0.15. hammer on `clock-strokes`: one D4 bone bar struck twelve times. horizon fades in (0.2 s) on 0.19. Spare. |
| 0:09.6–0:18.85 | M | statement | pluck on `hush-chord` (9.62), then the empty sea (9.6–13.6, the hush), then pluck on `grave-pizz` from 13.61. |
| 0:18.85–0:26 | D | statement | lift 0.6. On the first tritone (18.88) M ends fade 0; nap on `tuning-tritone` (A4 and Eb5 bands, held lit, re-flashed by each double stop), prickle on `tuning-fifths`. Spare: two threads. |
| 0:26–0:41.3 | A | statement | lift 0.3. On 26.03/26.37 (`dance-begins`) D ends fade 0. A1 on `dance-begins` ∪ `pizz-waltz-bass` (26.0–41.3), A2 on `theme-a-flute`, A3 on a `thread-high` slice, A4 on `harp-chords-31`. |
| 0:41.3–0:55.1 | B | statement | lift 0.35. On 41.59 A ends fade 0. fields + current on `theme-b-solo-violin`, strings on `pizz-waltz-bass` (41.3–55.1), Ivory on `theme-b-solo-p1..p4`. |
| 0:55.1–1:08.5 | A | return | lift 0.45, theme A in D: same room. A1 on `pizz-waltz-bass` (55.1–68.5), A2 on `theme-a-in-d`, A4 on `winds-56`. The lit hues follow the key (that is the music; layout and rings identical). |
| 1:08.5–1:11.7 | D | return | lift 0.8. prickle on the two D4s (68.59, 68.87) and on the rest; nap on the 69/75 notes from 69.13: the same two bands as 18.88 in the same places, wider (louder), flashing back for 3 s, cut by the tutti downbeat. |
| 1:11.7–1:26.4 | A | return | lift 1 (tutti: windows 35 % bigger, full pulse). A1 on `bass-tutti-1` (71.7–86.4), A2 on `theme-a-tutti`, A4 on `hammered-chords-80`. xKeyhole(79.89, 84.0, `hammered-chords-80`, w 0.24): the bones glimpsed. |
| 1:26.4–1:40.6 | B | return | lift 1: the same indigo room, louder (3 threads, fuller field). fields + current on `theme-b-tutti`, strings on `bass-tutti-1` (86.4–100.6), Ivory on `theme-b-tutti-p1..p3`. Nothing strikes (0 % onsets). |
| 1:40.6–1:55.4 | A | return | lift 0.75. A1 on `bass-tutti-1` (100.6–115.4), A2 on `theme-a-xylophone-d`, A4 on `repeated-d-chords`. xKeyhole(104.72, 106.3, `xylophone-bones`, w 0.32), then xKeyhole(111.8, 114.8, w 0.38): the keyhole grows with each rattle. |
| 1:55.4–2:00.4 | A | transition | A1 on `exposition-close`; a one-note slice of `ff-blows-early` (118.21) gives the last big pulse; A ends fade 1.5 with the sound. fields (lift 0.15) breathes in at 118.8 on a `thread-mid` slice 118.5–120.4. |
| 2:00.4–2:29.5 | B | development | FUGATO: B's room cut into staves. fields (lift 0.3) on `fugato-subject-low`, full frame. Four current staves (band windows w 1, h 0.16, feather 0.1, `stretch`, so each voice's thread stays inside its band), low to high, each opening on its voice's first note: y 0.82 at 120.87 (`fugato-subject-low`), y 0.62 at 125.05, y 0.42 at 129.27, y 0.22 at 134.73 (derived voices). At 145.48 an A2 delaunay window bursts in, centred and growing, on `brass-calls` 145.4–149.5. 6 clips. |
| 2:29.5–2:55.4 | M | development | THE TOLLS: Midnight's sea and bells, now low. horizon, lift 0.3 → 0.8; hammer on `pedal-e-toll`, then `pedal-a-toll`. A's discs rise as moons: delaunay ellipse windows on `pedal-line-high` (x 0.7, y 0.25, w 0.22), on `winds-156`, and from 170 a larger one on `brass-calls` 170–175.4. xKeyhole(170.0, 172.3, derived `ab-octaves-170`, w 0.46). Three rooms at the peak. |
| 2:55.4–3:33.15 | C | statement | Sudden drop: every toll clip ends fade 0 on 175.36; the pale page is there for 176.44. martin on `chorale-top` ∪ `chorale-bass`, lewitt on `harp-arpeggios` (178.3–208.9) then the band clip on `chorale-pulse` (199.3–208.9), stella on `chorale-top`. Slow, nothing red. |
| 3:33.15–3:42 | X | transition | The bones push the chapel aside. xKeyhole on `build-213` ∪ `bass-tutti-2` (213.15–222), w 0.5 from 215.14, recut to w 0.75 on a hammered-octave attack near 217.5. martin fades out 213.15–216. |
| 3:42–4:04.08 | X | statement | chapterX full frame (lift 0.3 → 1 by 222, intensityMoves 'present'). riley on `bass-tutti-2`, timeslice on `tutti-c-line` (from 223.74), pixelsort on `brass-calls` 228–231, blocks on `xylophone-bones` 233.5–239.1, pixelsort on the ff stamps 237.2–238.9. |
| 4:04.08–4:08 | X | transition | THE BREAK. pixelsort on `stop-244` tears the stripes on 244.08; riley, timeslice and blocks end there (fade 0.3) and decay to black; 246.0 sorts what is left. |
| 4:08–4:32.5 | A | development | THE PROCESSION: a frieze of the rooms so far, in the order first seen, across the middle (windows w 0.21, h 0.34, y 0.5, x 0.14 / 0.38 / 0.62 / 0.86, feather 0.15): M horizon on `interlude-strings`, A delaunay on the bassoon, B fields + current on the clarinet, C martin on the oboe (instrument sets derived from the pack's tracks 245.9–272.4). X: a riley strip (y 0.84, h 0.14, w 0.9) bends on `cascade-262` (261.7–264.7). Each panel lit while its part plays. Quiet, 6 clips. |
| 4:32.5–4:57 | A | development | THE WALTZ IN PIECES. A1 full frame, lift 0.1, on `bass-development` (the D/C# pedal). Each phrase of `development-line` (split at gaps > 0.6 s) lights one small A2 window on a 3×3 lattice; 2–4 lit at once. |
| 4:57–5:20.4 | A | development | THE WALTZ REASSEMBLED. `legato` (pulse 0). `build-line` phrases drive A2 windows that grow (scale 0.35, 0.55, 0.8) toward the centre; A1 lift 0.1 → 0.9 on `bass-development`; A4 on `repeated-d-303`; xKeyhole(303.19, 305.2, `repeated-d-303`, w 0.24). fireworks-snap on `ff-blows` 313.38. |
| 5:20.4–5:22.8 | B | transition | B's gold thread (current, threads 1) climbs `chromatic-ascent` across the whole ballroom: B reaching in. |
| 5:22.8–5:38 | A | return | RECAPITULATION, a double return: A's rhythm against B's harmony. Left 55 %: chapterA (A1 on `bass-finale` 322.8–338, A2 on `drum-strikes` 330.6–337.2). Right 45 %: chapterB (fields + current on `recap-theme-b-line`, strings on `recap-high` 322.8–338). Vertical seam, feather 0.15. fireworks-snap on 336.26. 6 clips. |
| 5:38–6:00.8 | B | development | THE THEMES INTERTWINED: four full-width strips (h 0.25, feather 0.08), A B A B: delaunay on `bass-finale`; fields on `recap-line`; delaunay on `brass-calls` 340–344 ∪ `drum-strikes` 342.2–343.7; current on `recap-high`. |
| 6:00.8–6:14.89 | A | development | THE FRENZY: the devil's four rooms in a 2×2 grid. A (delaunay on `frenzy-line`), X (riley on `bass-finale` 360.8–374.1), D (prickle on `ff-blows` ∪ `drum-strikes` 360.8–370.7; one nap clip on `napSet(octave-hammer-g ∪ bass-trill)`, 370.73–374.8), B (fields on a `thread-mid` slice). Full frame on top: fireworks-snap on `ff-blows` (361.90 … 373.98). Chapel and sea sit out. 6 clips. |
| 6:14.89–6:16.9 | M | return | THE CLOCK AGAIN. The grid cuts on the first blow (374.89, fade 0.08). horizon at lift 0.15; hammer on `final-hammer`: nine blows restrike midnight's own D4 bar (with a G4 bar beside it); fireworks-snap on `final-hammer`. After 376.80 nothing new strikes. |
| 6:16.9–6:23.6 | M | return | COCK-CROW. The bars and smoke decay with the sound. hammer on `cock-crow`: four high bars, G5 held from 380.25. One spare voice, as at midnight. |
| 6:23.6–6:35.3 | M | bookend | DAWN: midnight lit. On the sf chord (383.66) horizon's lift rises 0.1 → 1 over 8 s (colour stays 0). Milky handover on `dawn-slabs`, pluck on `dawn-tremolo` (385.0–387.1). |
| 6:35.3–7:04.07 | D | return | THE FAREWELL, pp (lift 0.25). On 395.87 the sea fades out (4 s) under the first oxblood band. nap on `farewell-violin` (one band per note, held lit through the gaps; repeated Eb4s not restroked), prickle on the same set. From 418: nap on `last-trill` (D and Eb bands), prickle on `scurry` (420.06–423.82). |
| 7:04.07–7:09.8 | M | bookend | THE END. The dim sea returns (lift 0.1, fade 0.6) on 424.07. pluck on `final-pizz`: Bb1–G1–D2, then the D major chord (425.38, as the hush chord at 9.62) and G minor (426.24). All clips end with fade 2 by 428.5; the last 1.3 s are black. |

## Boundaries

Every change of room rides a real note or the decay of one. The outgoing room's clips end with fade 0 on the incoming
room's first attack, and the incoming room is fully there on that attack: one quick change of state, no
cross-dissolve, no flash. Rooms with their own ground (M horizon, B fields, C martin, X riley) cover the old picture at
once; the rooms on black (D velvet, A discs) appear over the outgoing ground as it decays through the shared fade in
about a second (render-check 18.88, 26.37, 55.8, 71.7, 100.8; if mushy, end the outgoing ground 0.2 s early).

The turns: 18.88 (first tritone), 26.03/26.37 (D chord, G minor downbeat), 41.59 (the violin's first sigh), 55.79
(A in D), 68.59 (the D4s, then the A–Eb rocking), 71.7 (tutti downbeat), 86.45 (B tutti), 100.84 (A in D), 118.21
(octave blow; indigo breathes in at 118.8), 120.87 (cellos: first stave), 149.69 (first E toll), 175.36 (last toll;
the page under 176.44), 213.15 (the build's first bass note: keyhole), 222.0 (tutti: stripes full), 244.08 (stop
chord), 245.91 (first wind note: frieze), 272.68 (development), 297.82 (build line), 320.40 (ascent), 322.8 (recap
downbeat: the split), 338.37 (strips), 361.09 (frenzy grid), 374.89 (first of the nine blows: the clock), 376.80
(last blow: decay only), 378.95 (crow), 383.66 (dawn chord), 395.87 (farewell), 424.07 (final pizzicato).

Keyholes, moons and frieze panels open on the first note of their own set and close at its last note plus ring, so
the bones are seen only when the bones are heard. Spare by design: 0–26, 244–248, 376.9–383.6, 395–418. Everywhere
else at least four threads.

## Derived sets (build script)

`a-floor-1` (`dance-begins` ∪ `pizz-waltz-bass` 26–41.3); every whole-piece set (`thread-*`, `long-notes`) and every
multi-passage set (`pizz-waltz-bass`, `bass-tutti-1`, `brass-calls`, `xylophone-bones`, `drum-strikes`,
`bass-finale`, `ff-blows`, `ff-blows-early`) sliced to each clip; `build-to-tutti` split (D4s → prickle, 69/75 → nap);
the four fugal voices (from `songs/danse-macabre/pack.json` notes in 120.4–149.5 by register band, <55 / 55–61 /
62–71 / ≥72, from each entry; aim for at least 0.8 note/s so no thread dies; the pick sets alone give 0.5–0.8/s);
`ab-octaves-170` (Ab octaves 170–172.3 from the pack; fallback `brass-calls` 170–172.3); the bassoon/clarinet/oboe
interlude sets (pack tracks 245.9–272.4; fallback: listen to the tracks); the phrase splits of `development-line`
(gap > 0.6 s) and `build-line`; `dawn-slabs`; `napSet()` (single-note repeat merge, inside chapterD).

## Risks

1. Delaunay colours by pitch class: A in D lights other hues than A in G. Rings, discs, layout and black stay, so it
   should read as one room; check 26.5, 56, 72, 101 side by side.
2. Nap's `flip` filter and parity window: check 18.9–26, 69–71.7, 370.7–374.8 and 396–420 that the bands hold
   (memory 2, rest 6). Its band width follows a velocity bucket, so returns are the same bands, wider or thinner.
8. Delaunay at pulse 0 still lights segments on the legato pitch changes of 297–320: render-check for soft fake
   attacks; if it reads as strikes, lower the A2 windows' presence there through lift.
3. Martin + lewitt + stella is untested; lewitt on 80 harp notes must stay airy (if dense, lower its `lines` inside
   chapterC, for every call).
4. Riley dominates its region: keyholes stay exactly as long as their notes, on the lowest track of the window.
5. Clip budget: fugato, interlude, recap and frenzy reach 6; keep at most 6.
6. The interlude frieze is small at −24 dB; raise panel intensity before adding widgets.
7. The frenzy grid must read as four known rooms: quadrants 0.5 × 0.5, fireworks the only cross-room element.
