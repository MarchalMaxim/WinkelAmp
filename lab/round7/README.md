# Round 7: v2s, combinations, three new songs (2026-10-31)

Open the lab (`npm run dev`, then http://localhost:5173/lab/index.html). Reworked and new widgets sort to the top; a
reworked one says "reworked · was '…'" on its card. Six older widgets you have not rated yet (martin, suprematism,
contours, tunnel, scribble, pointillism) sit up there too, marked "not judged yet". Your round 5 and 6 verdicts are in (`lab/ratings.md`); whitney and
albers are dropped (`lab/tools/dropped/`).

`sheet.png`: one still of each widget below on the Prelude at about 2:06 (the casket), widget alone, except the four
that only work on top of something (shown on the partner named in the tile). Reduced to 256 colours; the lab shows the
real ones.

## Tuning without scrolling
- On a wide or landscape window (from 900 px) the picture holds a column on the left and the cards scroll beside it,
  so you see what a knob does while you turn it. On a phone the picture sticks to the top.
- Chips under the track name what is on: click one to jump to its card, its × to switch it off.
- Switching song keeps what is on and the card you were at. A plain reload still starts fresh.

## Combinations
- A **"combines with N" (i)** pill sits in the title line of every widget that is part of a combination (21 cards).
  Hover it (tap it on a phone): each partner set comes with one sentence on what you see, where it works best, and a
  **"▶ try together at m:ss"** button.
- "try together" switches on just those widgets, jumps to the combination's best moment in this song and plays.
  Three combinations also set knobs (Score at night under Brush + Squares; Pixel sort's own colour 0.1 over Horizon +
  Murmuration; cool Colour fields under Brush). **"↺ undo try"** in the chips puts back what was on and those knobs.
- A **Combinations** list above the cards (closed at first) holds all 19.

## Three new widgets, made for stacking (not judged yet)
They paint no ground of their own: switch them on over something.

| widget | what it does | try it on |
|---|---|---|
| Time slice | every strip of the picture comes from a different moment of the last seconds, more delayed further from a now line that follows the melody | Riley (staircases of cut stripes), Strings, Murmuration |
| Fold | mirrors whatever is on screen; the fold turns with the bass, chords flip the side, loud chords fold twice | Marbling, Kusama |
| Stella | thin concentric frames, one per attack, stepping inward: fast playing piles up stripes, slow playing leaves lone frames | Score + Squares |

## Reworked (each was "needs work" or "keep")
| widget | what to look for |
|---|---|
| Matisse v2 | Soft notes cut pale papers, loud ones deep; sounding pieces lift off the wall on a shadow; every attack gusts its neighbours. Movement, or tremor? |
| Harmonograph v2 | A different figure for every chord, beads where the notes fall, the pen swells on the newest note; soft passages draw smaller |
| Hilma af Klint v2 | Each note springs the petals at its place on the circle of fifths; major opens petals, minor closes them into spirals; seeds fill orbits in dense music |
| Cells v2 | Low notes broad slabs, high ones small chips; attacks swell a cell and light a kernel; loud chords send a ring of light through the mosaic |
| Harmonic web v2 | Every attack lands; clashing chords shimmer, sweet ones breathe; a bare octave (the tolling As, the fate motif) is a ray |
| Fischinger v2 | The same chord should call the same formation; new harmony, everybody glides to a new one |
| Klee v2 | Six voices, each along its own row in its own glaze; held notes keep painting; glazes mix where voices cross |
| Kline v2 | Big is judged against the music around it; between bars, brush marks chain into a broken line |
| Len Lye v2 | A mark boils as long as its note is held; loud chords burst into rays |
| Mandala v2 | Attacks bloom white-hot with rays from the centre; let-go notes drain to a fine crimson lace |
| McLaren v2 | The film streams down; deep notes thick rungs, high notes a fine comb; loud notes punch deep at once |
| Nebula v2 | Every attack ignites a core and a puff of hot grains where its note sits; soft notes barely whisper |
| Ridges v2 | Soft passages fine dim hairlines packed close, loud ones bold and spaced; a spark rides each attack back into the stack |
| Colour fields v3 | Each field owns a slice of the keyboard and glows per note; the chord against the home key sets the hue |
| Pixel sort v2 | Sorts the real way: runs of lit pixels melt toward the attack (bass down, treble up, melody sideways). Needs something under it |

## Three new songs
Pick them in the song menu (or `?song=<id>`). Each has named moments on the track.

| song | id | moments | transcription |
|---|---|---|---|
| Chopin, Nocturne Op. 48 No. 1 (6:22) | `chopin-nocturne-48-1` | Lento 0:00, climax ~1:40, the chorale 2:04, octaves 3:06, doppio movimento 3:21, fading 5:26 | Complete. The last 24 s of the file are silence |
| Chopin, Winter Wind étude (4:09) | `chopin-winter-wind` | Lento 0:00, the storm 0:20, far keys 1:42, A minor again 2:42, last chords 3:36 | Complete. After 3:51 the file holds something else (quiet bells), not the étude |
| Vivaldi, Winter, all three movements (9:26) | `vivaldi-winter` | Shivering 0:00, the wind 0:36, chattering teeth 3:00, Largo: rain 3:30, on the ice 5:48, the winds at war 8:40 | Strings through a piano transcriber: it hears less than half the attacks (onset coverage 0.43). Holes: 5:55–6:27 (32 s, the solo violin on ice), 7:13–7:29 (16 s), 8:12–8:22 (10 s, the warm south wind), 0:57–1:06 (9 s). Widgets go quiet there |

The studio also has a show for Winter Wind (`shows/chopin-winter-wind.json`).

## Checked
- Every widget on at once, on all five songs, played at four points each: no page or widget errors.
- The studio draws the lab's pixels for the 15 reworked and 3 new widgets: `npm run fidelity -- --only <those 18>`,
  288/288 comparisons pass (279 of them with a picture), on the Prelude and Beethoven only. Alone on the Prelude, pixel
  sort is blank (it needs something under it), so there it is proven on Beethoven. The quick run over every widget
  passes too (292/292). Stacks are only checked for squares + casket and kandinsky + rorschach, so the studio is not yet
  proven to draw time slice, fold, stella or pixel sort over a partner exactly as the lab does.
- Type check, 605 tests, build, the three shows and the widget docs.
