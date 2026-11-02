# Note picker: couple a widget to hand-picked notes

## Why

Some widgets are good as they are (the skittish shapes). Others answer every attack in the song and become overwhelming or out of step with the melody. The user's example is Pointillism: every note sets off a burst of dots, melody or not, so the melody drowns.

The user wants to choose a few notes of the melody and connect them to an "impulse" of a widget: "it should trigger the widget's 'thing'". The widget then answers those notes only.

## What the user said (decided)

1. See the notes of the song, and pick out by hand the ones that are the actual melody.
2. A popup opens where they select N of those notes and connect them to a widget.
3. Confirming places the customised widget in the scene.
4. Unpicked notes do nothing. A picked note's loudness sets how strong the impulse is. Picks belong to one song, in that song's show (the user confirmed this playback: "yeah thats correct").
5. Which instrument is which must be visible, and the user must be able to tell which sound belongs to which note.
6. Widgets that are fine as they are stay as they are: this is an option on a layer, never a change of default.

The mockup the user tried is `docs/mockups/note-picker/`: `template.html` plus `build.cjs`, which adds the songs' notes and audio. They chose "Start at 8PM" over "Keep tweaking first" after trying it. Its flow, layout and wording are the reference. Its dots are sketches; the real thing uses the real widgets.

## What it does

**Studio only.** A "Pick notes" button in the transport bar (builder's call) opens the picker over the whole studio for the current song; "Back to the studio" closes it (builder's call: the mockup is a page of its own and needs no way back). The lab gets no UI and has no show, so it never hears picks and `lab/index.html` is not touched. Only the shared `lab/layers/lines.js` learns `picks:`, because the studio's panel and lanes read parts through it.

While the picker is open it takes every key first (a capture listener on `window` that stops propagation), or the studio's global keys would act on the show underneath: Space, Delete, S, F, H, the arrows, Ctrl+Z. Space plays, Esc closes the popup and then the picker, Ctrl+Z undoes marks (the first undo after placing or removing a widget also says so, and where that is undone). Ctrl+S still saves.

**The roll** (as in the mockup):
- Piano roll of the whole song, with the real recording through the studio's player (`Player.audio`), playhead, time ruler, and a whole-song strip to move around.
- Click a note to mark it as melody, drag a box across several, Alt-drag to unmark, Undo. Ctrl-scroll zooms, scroll pans.
- Hover shows instrument, note, time and loudness. Clicking a note sounds it.
- Marked notes are amber, with a cap in the instrument's colour. A note in a placed set also carries a dot in the widget's hue.
- "Tone on melody notes" plays a soft tone on marked notes during playback.
- The right column as in the mockup: a small stage above the three steps. It mirrors the studio's canvas with one `drawImage` a frame, so the show plays with placed layers and nothing is drawn twice (builder's call). Under the roll, a row per placed set as in the mockup: ticks, click to edit, ✕ to remove.

**Instruments** (ensembles only; a solo piano piece shows no legend):
- Notes coloured by instrument, with a legend above the roll.
- Clicking a name hides that instrument's notes: they can't be clicked or boxed, and Suggest skips them. Marked notes stay visible.
- ♪ plays a tone on each of that instrument's notes and turns the recording down to 30 % (`audio.volume`, put back when the last ♪ goes off, while the popup is open, where no tones play, and when the picker closes). The recording can't be separated by instrument, so this is how a user follows one by ear.
- Notes come from the pack's `tracks`. These are not a part of `pack.notes`: Vivaldi's Winter has 7775 track notes and 5568 in `pack.notes`, whose hybrid mixes in the piano model. So the roll shows what the transcriber gave each instrument, "Every note, as it is today" is `pack.notes` as ever, and a pick is the track note itself.
- A song without tracks whose `notes.ymt3.json` has several labels uses those, taking loudness from the nearest same-pitched pack note within 80 ms, or 70 when none is that near, as in the mockup. Today that is the Concerto alone (checked: every other track-less song's file has one label). That file isn't served: `/songs/<id>/` gives only `pack.json` and `audio.*`, so a read-only `GET /api/songs/<id>/labels` is added. The static build has no labels, so it shows a solo roll. The UI says labels are the transcriber's guess. Labels stay as the file has them, as in the mockup.

**Suggest top line here.** Marks a line in the part in view, from the instruments on show, using the existing `lineNotes(…, 'melody')`. Undo takes it back. It is a starting point, never automatic.

Settled by measuring on real notes (builder's call), 24 s excerpts, `lineNotes` against the mockup's highest-note rule, as notes marked, mean leap in semitones, leaps of an octave or more:

| Excerpt | `lineNotes` | highest note |
|---|---|---|
| Prelude 10–34 s | 20, 5.6, 4 | 28, 14.9, 19 |
| Prelude 60–84 s | 19, 3.9, 2 | 31, 6.4, 7 |
| Nocturne 20–44 s | 26, 4.0, 3 | 43, 9.6, 12 |
| Winter 30–54 s | 157, 2.5, 4 | 136, 2.6, 4 |
| Beethoven 20–44 s | 108, 2.5, 6 | 107, 2.7, 6 |

Much better on piano, where the top of the accompaniment under a held melody note is what the highest-note rule gets wrong; even on ensembles.

**The popup** (as in the mockup):
- Widget chooser: the studio's existing widget picker, all widgets, opened from a button naming the chosen one, so the popup stays as light as the mockup's dropdown (builder's call). It gets an empty `here`, or a widget already in the section couldn't be chosen; `GROUPS` and `groupOf` are exported from `panel.ts` for it. The first choice is Pointillism, the user's example; "Edit picks" starts on the layer's widget.
- The melody notes in order, spaced evenly, height by pitch, ringed in the instrument's colour, dashed marks at pauses over 1 s. Click or sweep to select. When editing, a pick whose mark has gone is listed too, without a ring, so an update never loses it silently.
- A count ("6 of 25 melody notes picked"), "Pick the loudest N", Clear.
- Preview through the real widget, with "Your picks" against "Every note, as it is today".
- "Place in scene", or "Update the scene" when editing. Updating may change the widget; its knobs then go (they were another widget's), its region stays (builder's call).

**The preview** (builder's call, over a draft in the live stage): a second `WidgetRuntime` and `Conductor` on the popup's own 1280×720 canvas, dropped when the popup closes.
- It plays a draft show of one section and one layer: `picks: { draft: { notes } }` with `listen: 'picks:draft'`, or the plain widget for "Every note". Each is an instance of that runtime only, so the live instances' state is never touched by either. The draft isn't validated, and the store, the history and the disk never see it.
- The same audio element is the clock, through its own `startLive`. Meanwhile `Player.rest(true)` makes the studio's loop skip its steps, so only one picture is drawn; `rest(false)` repaints it. Cancel puts the playhead back; placing moves it to a second before the first pick.
- Preview plays from a second before the first pick to 1.5 s after the last, as in the mockup. A change of picks during playback reaches the draft when the sweep ends, by the same reload as a real edit.

**The scene.** Placing adds a layer on top of every section from the one holding the first pick to the one holding the last, so the widget's picture isn't cut between impulses. The layer shows its impulses as ticks on the timeline and its number of impulses in the layer controls, with "Edit picks" reopening the popup. Undo in the studio undoes a placement. Removing a layer works as for any layer.
- The ticks need almost no new drawing: `lanes.ts` already draws the attacks of the part a layer listens to, so a picks layer's lane shows them once `listenNotes` can read picks. Picks draw stronger and taller there, being sparse (builder's call). Placing selects the new layer, so its lane is open.
- Placing, updating and removing a set are one edit each, so one undo step, however many sections they touch. An update re-spans the sections from first pick to last: sections it leaves lose the layer, new ones get it with the knobs and region of a layer of the set (builder's call).
- The picks layer's "Listens to" shows "6 impulses (8 notes picked)" and "Edit picks" in place of the select, which would otherwise say "plays on all notes here" and could orphan the set. The panel's line says "hears your picks".

## Data

**Melody marks: one per song**, reused by every widget. File `melodies/<song>.json`, committed, since this is the user's hand work and `songs/` is never committed. Not under `shows/`, whose every `*.json` is read as a show. Holds the notes themselves, `{ version: 1, song, notes: [[start, end, midi, velocity, track?], ...] }`, not indexes, so a new transcription doesn't silently move them onto other notes. On load a mark that no longer matches a note within 50 ms at its pitch stays listed as unmatched and is reported, never silently dropped: a notice with the count, drawn as an outline on the roll, kept on save until an Alt-drag across the outline drops it on purpose (Undo brings it back; builder's call).
- `track` is a TrackId for a song with tracks and a YourMT3 label for the Concerto; a match prefers the same track, since two instruments often double a note (builder's call).
- `GET|PUT /api/melodies/<song>`: GET answers an empty melody, not a 404, for a song with no file, since a 404 is a red line in every console. PUT validates and writes the canonical form, one note a line. The folder is `WINKELAMP_MELODIES`, else `melodies/` beside the shows folder, so a test with a temp shows folder never writes the real one. The static build keeps marks in `localStorage` like its drafts.
- Marks save themselves a second after the last change and when the picker closes; there is no Save button for them, and a failed save is a notice (builder's call). The last second's marks go with the page on `pagehide`; leaving warns when that can't cover them: a failed save, a file that couldn't be read, or marks past a keepalive request's size.
- Unmarking a note leaves placed picks alone (builder's call, against the mockup's `dropFromLayers`): picks are notes in the show, under the studio's undo, and marks are a separate file with the picker's own undo.

**Picks: in the show.**
```
show.picks = { "<id>": { "notes": [[start, end, midi, velocity], ...] } }   // sorted by start
layer.listen = "picks:<id>"
```
- This is a new kind of `listen`: instance key `widget@picks:<id>`, its own notes, its own chords through `groupChords`, its own pulse. `drawLayered` needs no change, since a routed instance's attacks and pulse already come from `inst.chords` and `inst.notes`.
- The Conductor hands a set's notes to the runtime on the instance spec (`InstanceSpec.notes`), so a pick is the note itself and needs no song to look it up in. `listenNotes` reads `song.picks` for the UI's callers (the spark, the lanes, the "While its part plays" preset), and a missing set hears nothing: it must never take the fallback to all notes that every other unknown part gets, or a widget would fire on every note.
- Editing a set keeps its id (`p1`, `p2`, the smallest free, builder's call) and reloads the instance. The first draft's "the instance machinery does the rest" is not so: `WidgetRuntime.load` never evaluates a loaded key again, and 16 widgets read `window.NOTES` when they load or later, so the same key would go on firing the old picks. `load` re-evaluates a key whose `notes` changed, keeping its knobs (the Conductor won't send them again) and clearing its errors and window. `samePreview` compares picks too, or a paused picture wouldn't refresh. A new id per edit was rejected: it would pile up a loaded instance per edit, reset on every seek, and churn the file.
- Picks are stored as notes in the show, so a show renders the same after a new transcription. Numbers keep 4 decimals, as the packs have them, not the ms of other show times, so a pick is exactly the note (builder's call). One note a line.
- Layers in several sections share one set: editing it changes all of them, and the widget keeps its state across sections.
- `picks` is written after `sections`. A show with a set is version 2 even if no layer uses it yet.
- `validateShow` errors on a `picks:` listen with no matching set, and on a malformed, empty or unsorted set; it warns on a set no layer uses and on picks outside every section using it, or within a live step (50 ms) of their end, which a step can carry past them. `isListen` checks the form `picks:<slug>`, and only `validateShow` can see whether the set exists. `canonicalShow` lists `picks` in `KEYS.show`, or it would be dropped on save. Shows without picks keep their bytes. `check-show` needs no code: it goes through these.
- `repairShow` drops a layer whose set is missing rather than deleting its listen, which would turn it into the plain widget on every note. It tidies malformed notes, drops a set left empty along with its layers, and leaves an unused set for its warning, since it's hand work.
- `applyEdit` keeps a valid show valid: `addLayer` and `setLayer` refuse a `picks:` listen with no set. When `removeLayer`, `merge` or `setLayer` removes the last layer of a set, the set goes too, and undo brings both back (builder's call).

**Notes within 40 ms are one attack**, as everywhere (`groupChords`), so picking three notes of one chord gives one impulse, at the loudest note's strength. The count of impulses shown is the number of attacks, and the popup says so when it differs from the notes picked.

## Constraints

- Default paths don't change: shows without picks and widgets without picks draw exactly what they drew (`npm run fidelity` stays clean).
- `npm run render-show` plays picks, at any scale. It needs no code for that, since it validates and hands the whole show to the same Conductor; a check proves it.
- Follows the studio's patterns: `src/studio/show/edit.ts` edits, the history, `src/studio/ui/*`, `scripts/studio-api.ts` for saving. Plain words in the UI.
- Works on the longest song without dropping frames in the roll. The first draft named the Concerto (10 110 notes), but the library's longest is the Four Seasons (26 148 track notes, 42 minutes), which the mockup left out. The bar is the Four Seasons: notes indexed by time, drawn to a cached canvas redrawn only when the view or the marks change, the playhead on top.
- Repo rules as ever: no audio, `songs/`, renders or notes files in git.

## Not now

- Sending different notes to different parameters of a widget (one impulse per set).
- Separating instruments in the recording.
- Picker UI in the lab.
- Automatic melody finding beyond Suggest.
- Knob transitions over a section (separate design, `docs/mockups/knob-transitions/`, awaiting the user).

## What would make it a failure

- Picks that don't land exactly on the notes the user hears.
- A widget that keeps firing between picks, or misses one.
- Clicking in a dense passage that keeps hitting the wrong note.
- A UI heavier than the mockup.

## To watch when building

- Builder's call: a set's span ends at the section holding the last pick's start + 50 ms (the longest live step), not its start. Otherwise a step carrying the pick over a boundary would lose it. The cost: a last pick within 50 ms of a boundary adds the next section, where the layer draws through without firing.
- A widget on a set reads the set everywhere, its queued passes too (timeslice's threads, stella's two hops): the runtime wraps `queueMicrotask` for those instances only. A routed listen such as `@melody` still reads the song in a queued pass, which is what the lab draws; changing it would move lab parity.
- A widget's own colour logic on sparse notes. Pointillism, for one, finds the home key from what it hears, so its colours will shift on few notes: look at it and report; don't rework widgets.
- Widgets can't be disposed of: `pixelsort` starts a worker per instance, as any routed instance does today, so a reload or a preview leaves one idle until the page closes. Reported, not reworked.
- Calls made by the author, not the user: studio only; melody file location; layers span first to last pick; picks as a new `listen`; the Suggest and Loudest helpers and tones kept from the mockup. The builder's calls are marked where they stand above.
