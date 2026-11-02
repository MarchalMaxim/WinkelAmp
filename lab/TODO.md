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

- **Tree** (not started; when is my call, once the machine is free). The user: "I would like a tree like widget, so that it can become something like picture attached... Dynamics should be that attacks in the music force a new step in the growth of the tree and its leaves. Withering could also be a theme in this. Colors should be a enum of presets." The picture (a photo, not kept in the repo): an autumn maple seen from below, dark forking branches reaching across the frame, dense crimson and scarlet leaf masses lit from behind so single leaves show at the edges, a second tree's scattered yellow leaves overlapping it, dark green firs framing the sides and pale sky glowing through the gaps. Each attack is one growth step for branches and leaves. A colour knob picks from presets, by index (as Duet's `pair` does), not a free hue. Start after the "how present" slider work lands, so the tree follows it from the start. Vine (`vine`) is the near neighbour: look at it first, and make this a tree with a canopy rather than another vine.

## Changes

- **The casket.** It should be a one-time applied widget, I think... Apply it once on some attacks, instead of continuously.

## Note types as a default

Widgets that answer only certain types of notes, like grace notes. The user: "let's have this as a 'default' option, so that we can easily apply these types of widgets to music and the default will be chosen. Makes it easier for the composer."

**Built** on `claude/note-types` (spec `docs/superpowers/specs/2026-11-01-note-types-design.md`, plan `docs/superpowers/plans/2026-11-01-note-types.md`). The transcription was checked first: big chords, fast runs, trills, long ringing notes and repeated notes hold up, and join what a layer can listen to. Grace notes do not: a rule fires as often on a piece with none, so real ones go through the note picker. A widget that has a natural type gets it when placed in the studio, if the section has enough of it, and one click changes it. Defaults shipped, from reading the code and not yet judged by eye: stella repeated notes, pixelsort big chords, martin long ringing notes, flee fast runs, honey long ringing notes (the spec's proposal for round 9). Trills are nobody's default. Written up in `docs/COMPOSING-SHOWS.md` and `docs/HANDOFF.md`; pushed, not merged: the merge is the user's call.
