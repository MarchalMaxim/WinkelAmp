# Danse Macabre (Saint-Saëns), "Six Rooms at Midnight (chapters)"

Show: `shows/danse-macabre-d-chapters.json`. Build: `build-danse-macabre-d-chapters.mjs` (plan: `CHAPTERS-PLAN.md`).

**The idea.** The dance moves through six rooms. Each room is a visual world with its own ground, palette, widget family and layout. A chapter is one function call, so a return calls the same function and comes back as the same room by construction. It can be louder, bigger or fuller, but the look is the same. Developments never invent a new look. They cut, shrink, stack and collide rooms you have already seen. The bookends rhyme: midnight's sea and bell open the piece, the same bar is struck again by the nine last blows, dawn is the same sea lit, and the last chords are drawn the way the hush chord was.

## The chapters

The six worlds:
- **M, Midnight**: a grey photographic sea and sky, with upright amber pillars struck by the bells and thin pizzicato threads. Spare.
- **D, Death's fiddle**: oxblood velvet bands and red thorns from the edges, on black.
- **A, the Waltz**: a ballroom of whirling Delaunay discs, multicoloured rings on black.
- **B, the Sigh**: an indigo-violet colour field with a gold thread, a woven band and huddled ivory keys.
- **C, the Chorale**: Agnes Martin's pale ruled page, LeWitt's coloured-pencil rays in a band, and Stella's dark frames. It is the only light room.
- **X, the Bones**: Riley stripes in black and cold cyan (an X-ray), sliced, torn and sorted. Before it is stated, it is glimpsed through a keyhole at the upper left whenever the bones rattle.

The order:
- 0:00-0:19 **M** (bookend, statement)
- 0:19-0:26 **D** (statement)
- 0:26-0:42 **A** (statement)
- 0:42-0:56 **B** (statement)
- 0:56-1:09 **A** (return, in D)
- 1:09-1:12 **D** (return)
- 1:12-1:26 **A** (return, tutti, bigger); the X keyhole at 1:20
- 1:26-1:41 **B** (return, tutti, fuller)
- 1:41-2:00 **A** (return); X keyholes at 1:45 and 1:52, growing; the ballroom fades at 1:55
- 2:00-2:30 **B** (development: the fugato, B cut into four staves)
- 2:30-2:56 **M** (development: the tolls, with A's discs as moons; X keyhole at 2:50)
- 2:56-3:33 **C** (statement)
- 3:33-3:42 **X** (transition: the keyhole grows over the chapel)
- 3:42-4:08 **X** (statement; the stop chord tears it at 4:04)
- 4:08-4:33 **M A B C + X** (development: a frieze of the rooms in the order first seen)
- 4:33-4:58 **A** (development: the waltz in pieces)
- 4:58-5:20 **A** (development: the waltz reassembled)
- 5:20-5:23 **B** (transition: the gold thread climbs)
- 5:23-5:38 **A + B** (return: the recapitulation, split screen)
- 5:38-6:01 **A / B** (development: four woven strips)
- 6:01-6:15 **A X D B** (development: the frenzy, four rooms in a grid)
- 6:15-6:24 **M** (return: the clock's nine blows, then the cock-crow)
- 6:24-6:36 **M** (bookend: dawn, midnight's sea lit)
- 6:36-7:04 **D** (return: the farewell)
- 7:04-7:10 **M** (bookend: the end)

## What to judge

- **Recognising a chapter.** From any single frame, can you name the room? Six grounds: grey sea, black under red velvet, black under rings, indigo glow, pale paper, cyan stripes.
- **Returns.** Do the returns read as the same room? Compare 0:33/1:03/1:19/1:48 (A), 0:49/1:34 (B), 0:23/1:10/6:50 (D), and 0:04/6:15 (M).
- **Developments.** Are they visibly built from earlier rooms?
  - the fugato's staves appearing one by one, bottom to top, on the real fugal entries;
  - the moons over the toll sea;
  - the frieze;
  - the lattice of small discs;
  - the split screen;
  - the strips;
  - the grid.
- **Boundaries.** Is each change of room one quiet, quick change of state on a real note, with no flash?

## The show, section by section

| time | chapter | stack (lead -> ground; what each listens to) | what to watch for |
|---|---|---|---|
| 0:00-0:10 | M bookend | hammer bell, upright pillars (clock-strokes) -> horizon grey sea, lift 0.15 (all the M notes) | Twelve strokes on one D4 pillar over a dark, still sea. |
| 0:10-0:19 | M statement | pluck (hush-chord + grave-pizz) -> hammer ring-out -> horizon | The hush chord as threads, then Death's low pizzicato. |
| 0:19-0:26 | D statement | prickle (tuning-fifths) -> nap oxblood, memory 2 (tuning-tritone) on black | On the first tritone the sea is gone: two velvet bands (A and Eb) and thorns. Spare. |
| 0:26-0:42 | A statement | delaunay A2 window (theme-a-flute) -> A3 window (violas) -> mandala lighten (harp-chords-31) -> delaunay floor (dance-begins + waltz bass) | The ballroom arrives on the G minor downbeat. |
| 0:42-0:56 | B statement | Ivory huddled, one row per phrase (theme-b-solo p1-p4) -> current, 1 thread (theme-b-solo-violin) -> strings low band (waltz bass) -> fields indigo (theme-b-solo-violin) | The sigh: the indigo field, the gold thread, short white key rows. |
| 0:56-1:09 | A return | same four members (theme-a-in-d, violas, winds-56, waltz bass) | The same room in D. Only the lit hues move with the key. |
| 1:09-1:12 | D return | prickle (build-to-tutti) -> nap (build-to-tutti from 69.13) | Death's two bands come back in the same places, wider, and the tutti cuts them off. |
| 1:12-1:26 | A return | the A room at lift 1 (theme-a-tutti, violas, hammered-chords-80, bass-tutti-1); keyhole: riley + timeslice (hammered-chords-80) | The windows are 35% bigger. A small cyan keyhole opens at the upper left while the hammered chords rattle. |
| 1:26-1:41 | B return | the B room at lift 1 (theme-b-tutti p1-p3, theme-b-tutti, bass-tutti-1) | The same indigo room, fuller: three threads, a brighter field. Nothing strikes on the legato tutti. |
| 1:41-2:00 | A return + close | the A room (theme-a-xylophone-d, violas, repeated-d-chords, bass-tutti-1); keyholes w 0.32 and 0.38 (xylophone-bones) | The keyhole grows with each xylophone rattle. After the octave blow at 1:58 the ballroom fades with the sound. |
| 2:00-2:30 | B development | delaunay centre disc (brass-calls, 2:25) -> current braid, 3 threads (the four voices) -> four fields staves, one per fugal voice, entering 2:01 / 2:05 / 2:09 / 2:15 (voices taken from the pack by register) | B's indigo ground cut into four staves that appear bottom to top on each real entry. Each stave glows on its own voice's notes. The brass bursts in as a waltz disc. |
| 2:30-2:56 | M development | keyhole w 0.46 (Ab octaves) -> delaunay moons (pedal-line-high, winds-156, brass-calls 170) -> hammer pillars (pedal-e-toll, pedal-a-toll) -> horizon lift 0.3 -> 0.8 | Midnight's sea struck by the low tolls, with A's discs rising as moons. Three rooms at the peak. |
| 2:56-3:33 | C statement | stella (chorale-top) -> lewitt band (harp-arpeggios, then + chorale-pulse) -> martin paper (chorale-top + chorale-bass) | The sudden pale page on the drop: coloured-pencil rays and dark frames closing in. Nothing red. |
| 3:33-3:42 | X transition | keyhole w 0.5, then 0.75 (build-213 + bass-tutti-2) -> martin dimming | The cyan stripes push the chapel aside. |
| 3:42-4:04 | X statement | pixelsort own 0.1 (brass, ff stamps) -> blocks (xylophone-bones) -> timeslice (tutti-c-line) -> riley black/cyan, rising (bass-tutti-2) | The bones' room full frame: bass lenses, slices, tears. |
| 4:04-4:08 | X break | pixelsort (stop-244) | The stop chord tears the stripes, and they decay. |
| 4:08-4:33 | frieze | four tall panels: horizon (interlude strings), delaunay (bassoon), fields + current (clarinet), martin (oboe); a riley strip (cascade-262) | The rooms in a row, in the order first seen. Each panel lights while its instrument plays. |
| 4:33-4:58 | A development | ten small delaunay windows on a 3x3 lattice, one per development-line phrase -> dim delaunay floor (bass-development) | The waltz in pieces: small discs light up one phrase at a time over a dim floor. |
| 4:58-5:20 | A development | fireworks-snap (ff blow 313.38) -> keyhole (repeated-d-303) -> three phrase discs growing toward A2's place, pulse 0 -> mandala -> floor rising (bass-development) | The waltz reassembled, legato. One firework on the single ff blow. |
| 5:20-5:23 | B transition | current, 1 thread (chromatic-ascent) -> floor | B's gold thread climbs across the ballroom. |
| 5:23-5:38 | A + B return | left 55%: delaunay A2 (drum-strikes) -> floor (bass-finale); right 45%: current -> strings -> fields (recap-theme-b-line, recap-high); fireworks-snap (336.26) | The recapitulation: A's rhythm and B's harmony side by side, each the same room as before. |
| 5:38-6:01 | A/B development | strips: delaunay (bass-finale) / fields (recap-line) / delaunay (brass, drums, high thread) / current (recap-high) | The two themes woven into strips. |
| 6:01-6:15 | development | fireworks-snap (ff-blows) over a grid: A delaunay (frenzy-line), X riley (bass-finale), D prickle (ff-blows + drums), then nap (octave-hammer-g + bass-trill), B fields (mid thread) | The frenzy: four rooms collide. |
| 6:15-6:24 | M return | fireworks-snap (final-hammer) -> hammer pillars (final-hammer, then cock-crow) -> horizon, lift 0.15 | The nine blows restrike midnight's own D4 pillar, then the crow over a decaying sea. |
| 6:24-6:36 | M bookend | milky handover (dawn slabs) -> pluck (dawn-tremolo) -> horizon rising to full | Dawn: the same sea, lit. |
| 6:36-7:04 | D return | prickle, thin (farewell-violin + scurry) -> nap (farewell-violin + last-trill) | The farewell, pp: one velvet band per note, thin thorns. Spare. |
| 7:04-7:10 | M bookend | pluck (final-pizz) -> horizon lift 0.1, fading to black | The last chords drawn the way the hush chord was. Then black. |

Serendipity: two critic changes landed better than planned.
- The bones' room was first black and bone, but bone stripes read as the chapel's cream paper. Black and cold cyan made it an X-ray, which separates it from the chapel and gives the skeletons' dance its bones without drawing a skeleton.
- In the fugato, four stacked indigo staves appear one by one on the real entries, and one gold braid winds through them, like a score being written.
