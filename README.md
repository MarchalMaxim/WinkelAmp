# WinkelAmp

**A recording becomes a show of abstract pictures, set off by every note it plays.**

A personal studio for visual music. Drop in a recording; its notes are transcribed once, and a show of hand-made canvas
widgets plays in sync with every attack. Widgets are placed as clips on tracks under the song, or composed by Claude from
a description in your own words.

## Try it

```bash
npm install
npm run ears    # own terminal: transcribes dropped recordings (see docs/TRANSCRIBERS.md)
npm run dev     # the studio at /, the widget lab at /lab/index.html
```

Drop a recording on the page (or Songs, Add a recording). Without `npm run ears` the browser makes approximate notes.

## The studio

- Space plays; arrows seek 5 s; Shift+arrows jump to the next clip start or mark; `+` `-` `0` or Ctrl+wheel zoom.
- Clips on tracks: a higher track draws over a lower one. Drag to move, drag edges to resize, `Ctrl+D` duplicates,
  `S` splits, Delete removes, Esc deselects. Snap catches beats, clip edges and marks; Alt turns it off for one drag.
- The side panel holds the selected clip: times, fades, knobs (each can follow a feature of the music), what it listens
  to, where it is seen, and its intensity curve (a lane under the timeline). `Ctrl+P` adds a widget at the playhead.
- Pick notes (transport bar): choose notes on a piano roll and connect them to one widget.
- `Ctrl+Z` / `Ctrl+Shift+Z` undo and redo; `Ctrl+S` saves `shows/<show>.json`. `F` full screen, `H` hides the controls.
- Export: Record video (MP4 in the browser) or Render HD master (dev server, 2560x1440 at 60 fps).
- The Show tab holds *Describe the show* (saved to `shows/<show>.description.md`) and *Redo the transcription*.

## Commands

| command | does |
|---|---|
| `npm run dev` | dev server: the studio and the lab |
| `npm run ears` | local server that transcribes dropped recordings (port 5175) |
| `npm run ingest -- <audio> [--id] [--title]` | transcribe a recording into `songs/<id>/` |
| `npm run check` | typecheck plus fast tests (~20 s) |
| `npm test` | all tests |
| `npm run e2e` | drive the studio in Chrome on a test song |
| `npm run check-show -- <show> [--fix]` | validate or repair a show; `--summary <id>` reads it |
| `npm run describe-song -- <id>` | the song pack in words |
| `npm run widget-docs [-- --id <id>]` | the widget and knob catalogue |
| `npm run widget-thumbs -- <id> --base <dev server>` | a widget's lab picture |
| `npm run widget-demos -- <id> --base <dev server>` | a widget's demo video |
| `npm run render-show -- <show> [--from s --to s]` | render the HD master, a share copy and a contact sheet to `renders/` |
| `npm run lab-notes -- <id>` | the lab's files for a song |

## Layout

| path | holds |
|---|---|
| `lab/` | `tools/*.js` (the widgets), `harness.js`, `kit.js`, `index.html` (the lab), tags, demos |
| `src/studio/` | `pack/` song packs, `show/` shows and the conductor, `ui/` the studio page |
| `src/widgets/` | the runtime that runs the widget files |
| `src/audio/` | analysis: features, energy, melody, structure |
| `scripts/` | ingest, show checker, renders, browser checks |
| `shows/` | committed shows and their descriptions |
| `melodies/` | the note picker's marks |
| `songs/` | audio and packs; local only |

## More

- [CLAUDE.md](CLAUDE.md): rules for agents.
- [docs/COMPOSING-SHOWS.md](docs/COMPOSING-SHOWS.md): the show format and how to compose one.
- [docs/TRANSCRIBERS.md](docs/TRANSCRIBERS.md): the piano model, YourMT3+ and MuScriptor.
- [lab/README.md](lab/README.md): add a widget.
