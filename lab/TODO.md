# Widget TODO

What is still open, as of 2026-11-03. Finished work leaves this list. Nothing starts without the user's go-ahead, as the machine can only handle so many workflows at once.

## For the user's eye

Built, and nobody has watched these play with music.

- **Gliss** (`gliss`), made with the user in a session on 2026-11-03 from the sweep in Liebesleid at 2:53.6. The user liked the fluid in a mockup with that passage; the widget itself has only been seen in stills, not played. The first widget with a fluid on the graphics card: it needs WebGL2 and draws nothing without it. It needs picked notes: on a whole song it looks for fast climbs by itself, which was only tried on Liebesleid.
- **Ivory** (`ivory`), made with the user in a session on 2026-11-03. Only seen in stills, on a made-up line of notes: not on the Rachmaninoff theme it is for, not in motion. It needs picked notes: on a whole song it thins to a few keys. The bending of the picture underneath, tried in a sketch, is not in it.
- **Tree** (`tree`), from the user's autumn maple photo, the backlit version out of three tried. Known weak spots: the opening is sparse until the first attacks have built the trunk; gold leaves read as blobs at the biggest size; first frost and violet dusk are the least convincing presets at peak.
- **Round 9**: clumsy, gust, duet, vine, royal, comfort, honey, lazy, and the one-time casket. `lab/round9/README.md` says what a critic still found short in each.
- **A curve that sets how much a widget makes** (`intensityMoves`, issue 6). Only Vine was tried, on the test song. Martin may flicker, because its grid rebuilds whenever its line count changes. Widgets that keep their marks may show a falling curve more weakly than a rising one.
- **Usual note types**: stella repeated notes, pixelsort big chords, martin long ringing notes, flee fast runs, honey long ringing notes. Chosen from reading the code.

## Codex's branches, none merged

Each is Codex's work from 2026-11-03, with its notes in `lab/codex-report.md` on that branch. Merging is the user's call.

- **`codex/new-widgets`**: the 12 recipe widgets (stress, crackle, seep, lamps, tacet, varini, statues, afteryou, marey, planish, fauxpas, johansson). Still being finished: the health and speed runs on these 12 are not done. Two Johansson tests fail, several recipes fell short as written (see the report), and it now conflicts with main in the widget lists, since Tree landed.
- **`codex/widgets-check`**: `npm run widgets-check`. It found no errors or blank pictures. It flags Fold, Kline and Time Slice for their slider, but the user decided none of them has one, so it should stop flagging them when it is merged.
- **`codex/widgets-speed`**: `npm run widgets-speed`, the table in `lab/speed.md`, and a small speed-up in Current that helps on one busy song and costs a little on the other.
- **`codex/timeline-docs`**: corrects the docs that still described sections. Its change to `docs/COMPOSING.md` no longer applies: that file went with the old app.

## Not started

- **Modifiers on picked notes** (not started). The user: "add modifiers to the picked notes. As in: currently, we are connecting notes to attacks, but I'd like to have it so that we can label the note-link with a parameter. For example: a intensity value." So each link from a picked note to its attack carries a value of its own, set by hand, that the widget can use. Today a set of picks (`picks` in a show) is only the notes themselves.

## Decisions for the user

- **Background colours for small copies** (Codex's task 5, waiting). Black now goes see-through, but about a dozen widgets paint their own background and stay solid rectangles (Miro, Matisse, Kusama, Boogie, Lewitt, Martin, Score and others), and Gust and Royal leave a dark veil. Which ones should get a colour?
- **Contours and Rorschach are costly**, and speeding them up would change how they look, so Codex left them alone.
