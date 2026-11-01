# Note types: widgets that answer one kind of note, chosen for you when placed

Date: 2026-11-01. Status: design, being built on `claude/note-types`. Plan:
`docs/superpowers/plans/2026-11-01-note-types.md`.

Each decision is marked:
- **[user]**: the user decided it, or asked for it in their own words.
- **[builder]**: the builder's call, made while the user sleeps. All of them are listed again at the end.

## Why

The user, verbatim:

> "is it also possible to have widgets that trigger only on certain types of notes, like grace notes?"

> "let's have this as a "default" option, so that we can easily apply these types of widgets to music and the default
> will be chosen. Makes it easier for the compoesr (i.e. me"

Told the reading (grace notes, trills, long notes and runs joining melody and accents as things a layer can listen to; a
widget with a natural note type gets it automatically when placed, and it can be changed; existing shows stay exactly as
they are), they said "Start now".

## The answer about grace notes, plainly

**Grace notes are not offered.** The user's own example is the one that fails.

The notes are in the transcription, but the label is not. The best rule of about five (1 to 3 quick notes landing on a
longer one, alone in their register) fires as often on a piece believed to have none as on one that has them: Winter Wind
2.7 per minute, Liebesleid 2.8. Of the Nocturne's 7 hits, 3 look like ornaments, 3 are dotted pick-ups and 1 is unclear. On
ensembles the hits are scattered. Calling this "grace notes" would be a promise the data does not keep, and renaming it
"ornaments" (the measurer's fallback) still ships a rule that failed its control, so it is out as well. **[builder]**

**What to do instead for real grace notes:** the note picker (`claude/note-picker`, being built). A `picks:<id>` set holding
just those notes fires on exactly them, by hand, with no rule to be wrong. Decision 4 explains why they fire on their own.

## What the measurements say

Measured on six songs by the rules below. Scripts and numbers: session scratch `S/nt/measure/` (`final.mjs`, `final.txt`,
`crops/`), where `S` is the scratchpad named in the plan. The measurer's written report was refused by a tool and cut off in
the hand-over, so this section is its durable record.

Two facts shape every rule:

1. **On piano, "a short note" cannot be observed, because note length is mostly the pedal.** 61 to 77 % of piano notes end
   within 30 ms of two or more other notes (43 to 57 % on ensembles). Rules read onsets, with length as a weak filter.
2. **Ensembles need per-track rules.** Trills of 6 or more notes in Vivaldi: 1 in all the notes, 7 on the violin track. Runs
   in Beethoven: 6 against 25.

| Type | Ship? | One line |
|---|---|---|
| Big chords | Yes | Solid everywhere, and a different thing from `accents` (only 24 to 72 % of them are accents). |
| Fast runs | Yes | What it marks is right, but it marks part of a passage (28 % of Winter Wind). |
| Trills | Yes, sparse | Very clean but rare: 0 to 11 a song. Per track on ensembles. |
| Long notes | Yes, promised differently | On piano it means "rings long". |
| Repeated notes | Yes | Hits Beethoven's motif exactly. Misses slower repetition. |
| Tremolo | No | Looks the same as a held note the transcriber chopped up. |
| Grace notes, ornaments | No | See above. |

Attacks each shipped type finds (`noteTypeCounts`; the port of the rules into `lab/layers/lines.js` was checked note for
note against the measured rules on all six songs, with no mismatch; all five types together take under 10 ms a song):

| Song | Length | Big chords | Fast runs | Trills | Long | Repeated |
|---|---|---|---|---|---|---|
| Nocturne Op. 48/1 | 382 s | 218 | 46 | 24 | 150 | 392 |
| Winter Wind | 249 s | 18 | 496 | 0 | 26 | 94 |
| Rach Prelude | 232 s | 142 | 49 | 0 | 48 | 40 |
| Liebesleid | 296 s | 82 | 213 | 4 | 41 | 57 |
| Vivaldi Winter (tracks) | 566 s | 170 | 266 | 71 | 80 | 921 |
| Beethoven 5 (tracks) | 425 s | 249 | 135 | 0 | 49 | 808 |

Limits of these checks: the second opinion is the same rule on `notes.ymt3.json`, which is real on the piano songs and not
independent on Vivaldi and Beethoven, whose packs are hybrids. There is no score in the repo, so what a piece "contains"
comes from memory and the crops.

The grace-note rule that failed, kept for whoever tries again: 1 to 3 quick notes (first gap 40 to 250 ms, steps of 1 to 4
semitones, each 30 to 450 ms long) landing on a note of at least 150 ms, nothing within 5 semitones in the 300 ms before (or
2× the gap), nothing higher within an octave around it, first note at C3 or above. Hits: Nocturne 7, Winter Wind 11, Prelude
2, Liebesleid 14, Vivaldi 6, Beethoven 3. Agreement with the same rule on YMT3: 5, 6, 1, 10, 3, 3.

## Decisions

### 1. The types

**[builder]** Five, new values of a layer's `listen`, beside the lines:

| `listen` | Label | Rule | Reads |
|---|---|---|---|
| `chords` | Big chords | an attack (`groupChords`) of 5 notes or more: all its notes | all notes |
| `runs` | Fast runs | 6+ notes, each 30..200 ms after the last and 1..3 semitones from it, keeping direction at least half the time, travelling 5+ semitones | per track on an ensemble |
| `trills` | Trills | strict alternation of two pitches at most a tone apart, 30..180 ms between onsets, at least 7.5 notes a second, at least 65 % of the notes near the pair; under 6 notes it must also stand alone | per track on an ensemble |
| `long` | Long ringing notes | rings 1.5 s or more and among the longest tenth of the notes, and nothing within 4 semitones starts in its first second (from 60 ms on) | all notes |
| `repeats` | Repeated notes | one pitch struck 3+ times, 50..350 ms between onsets, nothing within 4 semitones starting between two strikes | all notes |

"Per track": the union over tracks of 40 notes or more, when at least two such tracks exist; otherwise all the notes.

They live in `lab/layers/lines.js` (one implementation, as ever), as `WA.NOTE_TYPES` and a branch in `WA.listenNotes`. The
existing lines, tracks and families run the same statements. A note type is an ordinary routed listen: its own instance
(`flee@runs`), its own `NOTES`, `CHORDS` and pulse, version 2 of the show format, the same runtime path, in the studio, the
lab and `render-show`. No type combines with a track ("the violin's trills"): `listen` stays one string.

They are kept out of `LINES`: that list and its tests mean the six derived lines. `NOTE_TYPES` sits in `src/widgets/tags.ts`
and is imported by `show.ts`. `tests/note-types.test.ts` pins it to the copy in `lines.js`.

### 2. A type a song barely has

**[builder]** It hears nothing, never all notes, and it says so. A widget meant for a few notes would otherwise fire on every
one: the note picker made the same call for a missing set of picks. This differs on purpose from a track the song lacks,
which falls back to all notes. The saying follows that track's style:

- **In a file:** `validateShow` warns `this song has no trills: this layer stays still`, at the layer's `listen`, when
  `ShowContext.noteTypes` (attacks per type) is given. `check-show` and `render-show` give it.
- **In the panel:** under the list, `This song has no trills: the layer stays still.`, styled as a warning. A song that has
  some but not in this section: the existing `Silent in this section: the layer stays still here.`, now styled as a warning
  for a note type.
- **In the lab's card:** `This song has no trills: it stays still.`
- **When placed:** a thin section never gets a dark layer by default (Decision 5).

### 3. Where the type goes in the panel

**[builder]** A new group `Kinds of note` in "Listens to", after `From the notes`, in the studio and the lab (their lists are
pinned equal by `tests/lab-layer-ui.test.ts`). Labels are static, without counts: the list stays equal to the lab's and costs
nothing to draw. The note under it gives the count, as it does for every part.

### 4. A note within 40 ms of another

**[builder]** Nothing new is needed, and the global `groupChords` is not touched. A routed instance groups *its own* notes:
`runtime.load` runs `groupChords(notes)` on the part (`lab/index.html:816` does the same). A note whose neighbour within 40 ms
is not in the part is alone in that list, so it is its own attack on this layer and part of a chord for everyone else. So a
run note 20 ms after an unrelated chord fires by itself on `runs`, and one layer's `listen` changes nobody's chords. A test
pins it, on a shipped type.

This is what makes hand-picked grace notes work: a grace note that the transcriber merged within 40 ms of its main note
fires alone from a `picks:` set of grace notes, since the main note is not in the set. (The measured rule never had this case:
its gap starts at 40 ms, because under that a close pitch is nearly always a spread chord, 46 to 141 such pairs a minute.)

### 5. The default

**[user]** A widget with a natural note type gets it when placed, and it can be changed. **[builder]** the rest:

- **The field:** `"noteType"` in that widget's entry in `lab/tags.json`, absent for none. It rides on the existing tags: the
  catalogue, `toMeta`, the picker and `widget-docs` already read that file, and `validateTags` gains one check (an unknown type
  is an error). A separate file would need new loaders for no gain.
- **Applied at one moment:** when the user picks the widget from the collection in the studio. `panel.ts` passes `listen` to
  the `addLayer` edit that already takes one, so placing is one undo step, and `edit.ts` does not change.
- **Only if the section has enough:** at least 3 attacks of that type, and one per 10 s on average (`neededAttacks`). Otherwise
  the widget is placed on all notes and the panel says `This widget usually hears fast runs, but this section has only 2: it
  plays on all notes.`, with `Use them`. A section with none has no button. The rate matters: a 65 s section with one
  short trill should not put a widget in the dark for 64 s.
- **Shown on the layer:** the head already says `hears repeated notes`. A `♪` button beside the arrows goes back to all notes in
  one click, shown when the layer is on its usual type. Open, under "Listens to": `Hears repeated notes, as this widget usually
  does.` with `All notes instead`, or `This widget usually hears repeated notes.` with `Use them`. The list above it changes it to
  anything else. The picker's card says `usually hears repeated notes`.
- **Not stored as a default:** a placed layer is `{ widget, listen }`, the same as one set by hand. Later changes to
  `lab/tags.json` never move an existing layer.
- **Existing shows and the lab stay byte-identical.** Nothing runs on load, on save or in `repairShow`. `canonicalShow` and the
  schema do not change. The lab never applies a default: it only gains the group in its list.

How often the threshold lets a type through, on the committed shows' own sections (Liebesleid has no show):

| Song (sections) | Big chords | Fast runs | Trills | Long | Repeated |
|---|---|---|---|---|---|
| Nocturne (11) | 3 | 2 | 3 | 10 | 3 |
| Winter Wind (23) | 1 | 16 | 0 | 3 | 9 |
| Rach Prelude (9) | 4 | 2 | 0 | 3 | 4 |
| Vivaldi Winter (8) | 6 | 5 | 3 | 2 | 8 |
| Beethoven 5 (33) | 20 | 10 | 0 | 5 | 29 |

**The table.** Every widget in `TOOL_IDS`, in that order. The test: is the type the widget's own promise? Routing shrinks both
the chords a widget hears and `x.sounding()`, so a widget that builds its picture from running stats over every attack changes
character, not just rate. A wrong default is worse than none, so most have none. A widget that already picks its big chords
gains nothing from `chords`. These come from reading each widget's blurb and code; only Stella was placed in a browser, and
none has been judged by eye. "Try by hand" names a pairing worth a look that was not safe as a default.

| Widget | Default | Why |
|---|---|---|
| timeslice | none | Its now line follows the melody. |
| fold | none | A mirror meant to stay; quiet passages fade it, so sparse notes would switch it off. |
| **stella** | **repeats** | A rhythm layer whose whole promise is frames piling up on quick attacks: a repeated note is that, and it paints no ground to starve. |
| fischinger | none | A crowd of notes makes many small shapes in a figure; it wants the crowd. |
| mclaren | none | A ladder of cards on a repeated note is tempting, but it paints its own ground and would stand empty. Try by hand: repeats. |
| lenlye | none | One scratch per note on its own black film: sparse notes leave black film. |
| klee | none | Each voice writes along its own row, note by note. |
| miro | none | The melody draws its line; held notes alone would lose the line. |
| delaunay | none | Each note lights its own ring. |
| lewitt | none | The drawing piles up from every attack. |
| ridges | none | Each line is a slice of the whole keyboard. |
| matisse | none | Every note slaps its piece down. |
| kusama | none | A colony per note, and its dots come from sounding notes. |
| ikeda | none | A lead: every note is a barcode, and the wall needs them all. |
| horizon | none | Already almost still; one kind of note would still it. |
| harmonograph | none | Every note pushes one unbroken line. |
| kline | none | Already picks the biggest chords itself, by percentile; on `chords` it would re-rank among them and lose its small marks. |
| score | none | The whole music writes the page; held notes alone leave beams and nothing else. |
| boogie | none | Every attack makes the traffic hop. |
| cells | none | A mosaic of one cell per note. |
| nebula | none | Every note is a pull on the grains. |
| **pixelsort** | **chords** | Sorts on each chord, and has no picture of its own to starve. In dense music it never rests; on big chords each melt reads. |
| mandala | none | Each note lands on its ring, and let-go notes linger as lace. |
| **martin** | **long** | "A held note tints its own thin stripe" is the long note exactly, and it is made to look nearly still. |
| murmuration | none | A lead whose ribbon traces the melody; it re-forms on loud chords by itself. |
| marbling | none | A standalone meant to carry a song; it combs on runs by itself. |
| kandinsky | none | Its vocabulary of bars, circles and triangles comes from all registers. |
| rorschach | none | Picks low notes and the fullest chords itself. |
| squares | none | Its promise is low notes: the `low` line fits, not a note type. |
| **flee** | **runs** | Fast passages make its shapes dense and frantic, and its own pulse reads that as panic. An accent, so it may empty between runs while the base carries the picture. |
| current | none | Threads for the melody, the inner voices and the bass. |
| strings | none | Each note is a thread. Trills are too rare to be anyone's usual. Try by hand: trills, on a violin track. |
| fields | none | An under layer carrying the harmony; busy playing makes its edges hum. Try by hand: long. |
| brush | none | Its promise is the melody, tracked over every attack (`melTop`, `mean`). A loved widget should not lose that by default. Try by hand: long, for its ink pools and ensō. |
| blocks | none | Already scales its tear by chord size, and its picture comes from sounding notes. |
| riley | none | Bass, melody and chords each bend it differently. |
| halftone | none | Each attack sends its own wave, low and high on different screens. |
| fifths | none | Old chords weave a web; big chords alone would thin it. |
| suprematism | none | Bars, slivers and blocks come from all registers. |
| contours | none | Every note raises a hill or sinks a pit. |
| tunnel | none | Every note drops an outline, and busy playing speeds the fall. |
| scribble | none | One pen per register, coiling with density; chord scratches would go. Try by hand: runs. |
| pointillism | none | Every note dabs; the dots settle into fields. |
| casket | none | Already picks its cuts by loudness and chord size, and every note may drip. |

So four defaults, and `trills` is nobody's: at 0 to 11 a song it would be a dark layer on most music. Adding one later is one
field in `lab/tags.json`.

### 6. The auto-composer

**[builder]** It does not use the field. It has its own routing (`routeFor`, `lineFor`), and composed shows should stay as they
are. The user asked for this as the composer's help: "Makes it easier for the compoesr (i.e. me". The field reaches a Claude
session composing by hand through `docs/COMPOSING-SHOWS.md`, as `Note type: runs` on the widget's tag line.

### 7. Widgets arriving later

**[builder]** A widget with no `noteType` has no default, so a new one is safe the moment it lands, and nothing warns or fails.
A new one that has a natural type gets the field in its `lab/tags.json` line, by the same test as the table.

`claude/widgets-round9` adds eight. They arrive with none. Proposed by their blurbs, to apply after a look once they are on the
same branch: `honey` long (a mass that sags and stretches threads that will not let go). None for `clumsy` (attacks knock it
over; it needs the gaps), `comfort`, `duet`, `gust` (already keeps its full blasts for the loudest), `lazy`, `royal` and `vine`
(it needs notes to grow, and withers when they thin).

### 8. Mergeable with the note picker

**[builder]** The plan's patches were merged in a dry run with `git merge-tree`:

- `claude/note-picker` at `6ae36df`: no conflict. To keep it so, `isListen` gains its note-type check as a new first statement
  instead of editing the line the picker edits; `listenNotes` gains its branch after the `LINES` line, as the picker inserts
  before it; `WaLayers` gains its members away from the `listenNotes` line; the `missingPart` warning is in a function the picker
  leaves alone; `COMPOSING-SHOWS.md` gains its bullet before the lines bullet, as the picker's goes after; `layer-controls.ts`
  and its test take their imports on lines of their own, away from the ones the picker edits.
- `claude/widgets-round9` at `34357cc`: no conflict.

Both branches are still moving, so a later merge may need a small hand. A set of picks and a note type never meet: `attacksIn`
only ever asks about a note type, and `isNoteType` says no to a `picks:` listen.

One wart, chosen for that: `validateLayer`'s message for an unknown listen does not list the note types, because the picker
rewrites that line. Add them when the picker has landed.

## Not doing

- Grace notes, ornaments, tremolo (above).
- A note type of one track.
- Counts in the "Listens to" list.
- Applying a default anywhere but placing from the collection: not in the lab, not in the composer, not on load.
- A warning in the studio's own show check: `main.ts` only uses its errors, and the panel already says it.

## The builder's calls, for the user to confirm

1. Grace notes and ornaments are not offered: the rule failed its control. Real ones go through the note picker.
2. Five types ship: big chords, fast runs, trills, long ringing notes, repeated notes. Tremolo does not.
3. A type a song lacks hears nothing and says so, unlike a missing track, which plays on all notes.
4. Only four widgets get a default: stella repeats, pixelsort chords, martin long, flee runs. Trills are nobody's default. These
   come from reading the code, not from looking: **please look at these four first**, and at the "try by hand" pairs (brush long,
   strings trills, scribble runs, mclaren repeats, fields long). A pairing you like is one field in `lab/tags.json`.
5. A default is taken only when the section has 3 attacks and one per 10 s; otherwise the widget plays on all notes and says why.
6. The field is `noteType` in `lab/tags.json`.
7. The auto-composer does not use it.
8. Runs and trills go per track on an ensemble; the others read all the notes.
9. Round 9's widgets arrive with none; `honey` long is proposed.
