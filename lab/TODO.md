# Widget TODO

What is still open, as of 2026-11-08. Finished work leaves this list. Nothing starts without the user's go-ahead, as the machine can only handle so many workflows at once.

## For the user's eye

Built, and nobody has watched these play with music.

- **Intensity on picked notes**, built on 2026-11-04. A bar under each picked note in "Connect notes to a widget". Every widget that answers to loudness follows it without changes; Ivory reads the value itself. Other widgets that ignore loudness show nothing yet, and a note near full velocity has little room to go up.
- **Knobs on picked notes**, built on 2026-11-04. The same bars set almost any knob, from that note until the next. Tried on every widget by a script, none of it watched with music. A value that changes a frame-read knob changes the whole picture, by design: say which ones feel wrong and they go on the list in `src/studio/show/note-values.ts`.
- **A curve that sets how much a widget makes** (`intensityMoves`, issue 6). Only Vine was tried, on the test song. Martin may flicker, because its grid rebuilds whenever its line count changes. Widgets that keep their marks may show a falling curve more weakly than a rising one.
- **Usual note types**: stella repeated notes, pixelsort big chords, martin long ringing notes, flee fast runs, honey long ringing notes. Chosen from reading the code.

## Rated on 2026-11-08

These were waiting for the user's eye. He rated them on 2026-11-08. The verdicts are recorded only: nothing is removed or reworked, and nothing starts on them without his go-ahead.

- **Gliss** (`gliss`): loved. It needs WebGL2 and draws nothing without it. It needs picked notes: on a whole song it looks for fast climbs by itself, which was only tried on Liebesleid.
- **Ivory** (`ivory`): loved. It needs picked notes: on a whole song it thins to a few keys. The bending of the picture underneath, tried in a sketch, is not in it.
- **Tree** (`tree`): kept. Known weak spots, for information: the opening is sparse until the first attacks have built the trunk; gold leaves read as blobs at the biggest size; first frost and violet dusk are the least convincing presets at peak.
- **Round 9**: gust, duet, vine and the one-time casket loved; clumsy [#15](https://github.com/MarchalMaxim/WinkelAmp/issues/15) and comfort [#16](https://github.com/MarchalMaxim/WinkelAmp/issues/16) need work; royal [#8](https://github.com/MarchalMaxim/WinkelAmp/issues/8), honey [#9](https://github.com/MarchalMaxim/WinkelAmp/issues/9) and lazy [#10](https://github.com/MarchalMaxim/WinkelAmp/issues/10) rated drop (recorded only, not removed). `lab/round9/README.md` says what a critic still found short in each.

## Not started

- **`npm run widgets-check` flags Fold, Kline and Time Slice** for their slider, but the user decided none of them has one, so it should stop flagging them.

- **Show the composer the signals a widget is connected to** (asked 2026-11-08). The user approved "Follows the sound" and the "how strongly" slider, but finds the response still slow. He wants to see what he is connecting a widget to: a graph, beside a clip or knob in the studio, of how each signal moves through the song (for example loudness, smoothed loudness, `level`, `rate`, `hit`). `lab/energy.html` already draws several of them (what `level` feels, the loudness lane, the sound's own centred energy, the follow curve) and is a starting point. The slowness comes mostly from the loudness lane itself: it is averaged backwards over about 1.5 s. The fix is item 4 in `docs/research/audio-to-picture.md`, an energy lane with no lag stored with each song.

- **A design session for a bell and piano effect** (not started). The user: "make a design session for a effect that looks like the sound produced by a bell and a piano. a \"clinging\" sound, like \"clinging bells\"."

## Decisions for the user

- **The ratings of 2026-11-08.** Each widget rated drop or needs work has a GitHub issue, [#8](https://github.com/MarchalMaxim/WinkelAmp/issues/8) to [#30](https://github.com/MarchalMaxim/WinkelAmp/issues/30). [#31](https://github.com/MarchalMaxim/WinkelAmp/issues/31) tracks auto-composer profiles for 25 newly loved or kept widgets. Nothing is removed or reworked until the user says so.
- **Contours and Rorschach are costly**, and speeding them up would change how they look, so Codex left them alone.
