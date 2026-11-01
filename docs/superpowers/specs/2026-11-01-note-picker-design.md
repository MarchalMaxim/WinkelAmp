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

**Studio only.** A "Pick notes" button opens the picker over the studio for the current song. The lab gets no UI. The lab's shared layer code still has to play picks, because the studio runs the same files.

**The roll** (as in the mockup):
- Piano roll of the whole song, with the real recording through the studio's player, playhead, time ruler, and a whole-song strip to move around.
- Click a note to mark it as melody, drag a box across several, Alt-drag to unmark, Undo. Ctrl-scroll zooms, scroll pans.
- Hover shows instrument, note, time and loudness. Clicking a note sounds it.
- Marked notes are amber, with a cap in the instrument's colour.
- "Tone on melody notes" plays a soft tone on marked notes during playback.

**Instruments** (ensembles only; a solo piano piece shows no legend):
- Notes coloured by instrument, with a legend above the roll.
- Clicking a name hides that instrument's notes: they can't be clicked or boxed, and Suggest skips them. Marked notes stay visible.
- ♪ plays a tone on each of that instrument's notes and turns the recording down to 30 %. The recording can't be separated by instrument, so this is how a user follows one by ear.
- Notes come from the pack's `tracks`. A song without tracks whose `notes.ymt3.json` has several labels (the Concerto) uses those, taking loudness from the nearest same-pitched pack note within 80 ms. The UI says labels are the transcriber's guess.

**Suggest top line here.** Marks a line in the part in view, from the instruments on show, using the existing `lineNotes(…, 'melody')` if it does better than the mockup's highest-note rule. Undo takes it back. It is a starting point, never automatic.

**The popup** (as in the mockup):
- Widget chooser: the studio's existing widget picker, all widgets.
- The melody notes in order, spaced evenly, height by pitch, ringed in the instrument's colour, dashed marks at pauses over 1 s. Click or sweep to select.
- A count ("6 of 25 melody notes picked"), "Pick the loudest N", Clear.
- Preview through the real widget, with "Your picks" against "Every note, as it is today".
- "Place in scene", or "Update the scene" when editing.

**The scene.** Placing adds a layer to every section from the one holding the first pick to the one holding the last, so the widget's picture isn't cut between impulses. The layer shows its impulses as ticks on the timeline and its number of impulses in the layer controls, with "Edit picks" reopening the popup. Undo in the studio undoes a placement. Removing a layer works as for any layer.

## Data

**Melody marks: one per song**, reused by every widget. File `melodies/<song>.json`, committed, since this is the user's hand work and `songs/` is never committed. Not under `shows/`, whose every `*.json` is read as a show. Holds the notes themselves, `[start, end, midi, velocity, track?]`, not indexes, so a new transcription doesn't silently move them onto other notes. On load a mark that no longer matches a note within 50 ms at its pitch stays listed as unmatched and is reported, never silently dropped.

**Picks: in the show.**
```
show.picks = { "<id>": { "notes": [[start, end, midi, velocity], ...] } }   // sorted by start
layer.listen = "picks:<id>"
```
- This is a new kind of `listen`, so the instance machinery does the rest: instance key `widget@picks:<id>`, its own notes, its own chords through `groupChords`, its own pulse. Runtime, conductor and lab layers get the notes from the show, not from the song.
- Picks are stored as notes in the show, so a show renders the same after a new transcription.
- Layers in several sections share one set: editing it changes all of them, and the widget keeps its state across sections.
- `validateShow` errors on a `picks:` listen with no matching set and warns on a set no layer uses and on picks outside every section using it. `isListen`, `usesV2`, `canonicalShow` and the check-show script know it. Shows without picks keep their bytes.

**Notes within 40 ms are one attack**, as everywhere (`groupChords`), so picking three notes of one chord gives one impulse. The count of impulses shown is the number of attacks, and the popup says so when it differs from the notes picked.

## Constraints

- Default paths don't change: shows without picks and widgets without picks draw exactly what they drew (`npm run fidelity` stays clean).
- `npm run render-show` plays picks, at any scale.
- Follows the studio's patterns: `src/studio/show/edit.ts` edits, the history, `src/studio/ui/*`, `scripts/studio-api.ts` for saving. Plain words in the UI.
- Works on the longest song (Concerto, about 10 000 notes) without dropping frames in the roll.
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

## Left to the builder

- How the real preview runs (a draft layer in the live stage is the likely way; the draft must never reach history or disk).
- Pick set ids, file layout of the new UI, and how a widget's own colour logic behaves on sparse notes. Pointillism, for one, finds the home key from what it hears, so its colours will shift on few notes: look at it and report; don't rework widgets.
- Calls made by the author, not the user: studio only; melody file location; layers span first to last pick; picks as a new `listen`; the Suggest and Loudest helpers and tones kept from the mockup.
