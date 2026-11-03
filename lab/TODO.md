# Widget TODO

What is still open, as of 2026-11-03. Finished work leaves this list. Nothing starts without the user's go-ahead, as the machine can only handle so many workflows at once.

## For the user's eye

Built, and nobody has watched these play with music.

- **Tree** (`tree`), from the user's autumn maple photo, the backlit version out of three tried. Known weak spots: the opening is sparse until the first attacks have built the trunk; gold leaves read as blobs at the biggest size; first frost and violet dusk are the least convincing presets at peak.
- **Round 9**: clumsy, gust, duet, vine, royal, comfort, honey, lazy, and the one-time casket. `lab/round9/README.md` says what a critic still found short in each.
- **A curve that sets how much a widget makes** (`intensityMoves`, issue 6). Only Vine was tried, on the test song. Martin may flicker, because its grid rebuilds whenever its line count changes. Widgets that keep their marks may show a falling curve more weakly than a rising one.
- **Usual note types**: stella repeated notes, pixelsort big chords, martin long ringing notes, flee fast runs, honey long ringing notes. Chosen from reading the code.

## Codex's branches, none merged

Each is Codex's work from 2026-11-03, with its notes in `lab/codex-report.md` on that branch. Merging is the user's call.

- **`codex/new-widgets`**: the 12 recipe widgets (stress, crackle, seep, lamps, tacet, varini, statues, afteryou, marey, planish, fauxpas, johansson). Still being finished: the health and speed runs on these 12 are not done. Two Johansson tests fail, several recipes fell short as written (see the report), and it now conflicts with main in the widget lists, since Tree landed.
- **`codex/widgets-check`**: `npm run widgets-check`. It found no errors or blank pictures; what it reports is below.
- **`codex/widgets-speed`**: `npm run widgets-speed`, the table in `lab/speed.md`, and a small speed-up in Current that helps on one busy song and costs a little on the other.
- **`codex/unused-code`**: `docs/unused-code.md`, a report only. Nothing is deleted.
- **`codex/timeline-docs`**: corrects the docs that still described sections.

## Decisions for the user

- **Fold and Kline have no how present slider.** Do they get one? Until then, a curve can only fade them.
- **Time Slice makes no less at low how present**, on all three songs checked. It changes the layer below it, so the check may just not see the effect.
- **Background colours for small copies** (Codex's task 5, waiting). Black now goes see-through, but about a dozen widgets paint their own background and stay solid rectangles (Miro, Matisse, Kusama, Boogie, Lewitt, Martin, Score and others), and Gust and Royal leave a dark veil. Which ones should get a colour?
- **Contours and Rorschach are costly**, and speeding them up would change how they look, so Codex left them alone.
- **The old app and test pages**: `docs/unused-code.md` says what removing each would break. Keep or remove?
