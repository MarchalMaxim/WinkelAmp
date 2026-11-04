# Widget TODO

What is still open, as of 2026-11-04. Finished work leaves this list. Nothing starts without the user's go-ahead, as the machine can only handle so many workflows at once.

## For the user's eye

Built, and nobody has watched these play with music.

- **Gliss** (`gliss`), made with the user in a session on 2026-11-03 from the sweep in Liebesleid at 2:53.6. The user liked the fluid in a mockup with that passage; the widget itself has only been seen in stills, not played. The first widget with a fluid on the graphics card: it needs WebGL2 and draws nothing without it. It needs picked notes: on a whole song it looks for fast climbs by itself, which was only tried on Liebesleid.
- **Intensity on picked notes**, built on 2026-11-04. A bar under each picked note in "Connect notes to a widget". Every widget that answers to loudness follows it without changes; Ivory reads the value itself. Other widgets that ignore loudness show nothing yet, and a note near full velocity has little room to go up.
- **Ivory** (`ivory`), made with the user in a session on 2026-11-03. Only seen in stills, on a made-up line of notes: not on the Rachmaninoff theme it is for, not in motion. It needs picked notes: on a whole song it thins to a few keys. The bending of the picture underneath, tried in a sketch, is not in it.
- **Tree** (`tree`), from the user's autumn maple photo, the backlit version out of three tried. Known weak spots: the opening is sparse until the first attacks have built the trunk; gold leaves read as blobs at the biggest size; first frost and violet dusk are the least convincing presets at peak.
- **Round 9**: clumsy, gust, duet, vine, royal, comfort, honey, lazy, and the one-time casket. `lab/round9/README.md` says what a critic still found short in each.
- **A curve that sets how much a widget makes** (`intensityMoves`, issue 6). Only Vine was tried, on the test song. Martin may flicker, because its grid rebuilds whenever its line count changes. Widgets that keep their marks may show a falling curve more weakly than a rising one.
- **Usual note types**: stella repeated notes, pixelsort big chords, martin long ringing notes, flee fast runs, honey long ringing notes. Chosen from reading the code.

## Not started

- **`npm run widgets-check` flags Fold, Kline and Time Slice** for their slider, but the user decided none of them has one, so it should stop flagging them.

## Decisions for the user

- **Contours and Rorschach are costly**, and speeding them up would change how they look, so Codex left them alone.
