# Widget TODO

Not started, unless an item says otherwise. The user's words; wait for their go-ahead, as the machine can only handle so many workflows at once.

## Built in round 9 (see lab/round9/README.md)

The user's words.

- **Clumsiness** (`clumsy`). The movement of the individual things expresses the emotion clumsiness. The objects tumble and rush to keep up. Every attack causes disorder again. Concepts are tumbling over each other, like hopping.
- **Trumpets** (`gust`). Something that represents trumpets very well. Something gusty? FULL of power.
- **Duality** (`duet`). A dual type of widget that takes on two forms (different colours), which interplay and attract and repel.
- **Vines** (`vine`). A viney type of widget that spreads and withers based on parameters.
- **Royal** (`royal`). Royal. Elegant. Dismissive.
- **Comfort** (`comfort`). Comfortable, relaxing, slow.
- **Honey** (`honey`). Droopy, viscous, honey, slow.
- **Lazy** (`lazy`). Lazy, lethargic, green.

## Backlog

- **Tree** built 2026-11-03 as `lab/tools/tree.js`, from the user's autumn maple photo, the backlit version out of three tried. Awaiting the user's eye. Known weak spots: the opening is sparse until the first attacks have built the trunk; gold leaves read as blobs at the biggest size; first frost and violet dusk are the least convincing presets at peak.

## Changes

- **The casket.** It should be a one-time applied widget, I think... Apply it once on some attacks, instead of continuously.

## Note types as a default

Widgets that answer only certain types of notes, like grace notes. The user: "let's have this as a 'default' option, so that we can easily apply these types of widgets to music and the default will be chosen. Makes it easier for the composer."

**Built** on `claude/note-types` (spec `docs/superpowers/specs/2026-11-01-note-types-design.md`, plan `docs/superpowers/plans/2026-11-01-note-types.md`). The transcription was checked first: big chords, fast runs, trills, long ringing notes and repeated notes hold up, and join what a layer can listen to. Grace notes do not: a rule fires as often on a piece with none, so real ones go through the note picker. A widget that has a natural type gets it when placed in the studio, if the section has enough of it, and one click changes it. Defaults shipped, from reading the code and not yet judged by eye: stella repeated notes, pixelsort big chords, martin long ringing notes, flee fast runs, honey long ringing notes (the spec's proposal for round 9). Trills are nobody's default. Written up in `docs/COMPOSING-SHOWS.md` and `docs/HANDOFF.md`; pushed, not merged: the merge is the user's call.
