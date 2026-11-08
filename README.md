# WinkelAmp

**A recording becomes a show of abstract pictures, set off by every note it plays.**

WinkelAmp is a studio for visual music. Drop in a recording of a piece (the great masters first: Rachmaninoff,
Beethoven…); its notes are transcribed once by a GPU piano model, and a show of hand-made canvas widgets plays
with it in sync with every attack. Place the widgets on tracks under the song like clips in DJ software, where you
want them, overlapping as you like, or have Claude compose the show from a description in your own words.

## Try it

```bash
npm install
npm run ears    # in its own terminal: transcribes dropped recordings with the GPU piano model
npm run dev
```

Open the printed URL: the studio. **Drop a recording** anywhere on the page (or **Songs → Add a recording…**): the
ears server transcribes its notes once (the piano model in `C:/Users/maxim/.venvs/wa`, or `$WINKELAMP_PY`; a minute
of music takes ten-odd seconds on the GPU) and the song opens. Without `npm run ears` the browser analyses the
recording itself and makes **approximate** notes (the song and the library say so; **Re-ingest with the transcriber**
fixes it once ears runs). From a terminal, `npm run ingest -- path/to/recording.mp3 --title "Rachmaninoff: Prelude in
C♯ minor"` does the same as a drop.

Pick a song under **Songs**; a song without a show of its own opens with an empty timeline. Add widgets, or press
**Compose a show for me** there for a first draft from its analysis and the widgets you loved. Then:

- **Play** (Space), seek on the timeline, `←` / `→` five seconds, `Shift` + arrows from one clip start or mark to the next.
- **The timeline** holds the widgets as clips on tracks: a higher track draws over a lower one, clips overlap freely
  across tracks, the same widget can play twice at once, and gaps are simply dark. Drag a clip to move it (over a taken
  spot it goes to the nearest free track at or above it, a new one if needed), drag its edges to resize it (an edge stops
  at the next clip on its track), click to select. **Ctrl+D** or **Duplicate**, **S** or **Split**, Delete removes it,
  Esc deselects. **Snap** catches beats, clip edges and the song's marks ("First theme" and so on, which you see above
  the tracks and which own nothing); turn it off, or hold Alt for one drag. Ctrl + wheel zooms.
- **The side panel** holds the selected clip: when it plays and how long its edges fade, then its knobs, drawn as the
  lab draws them (a picture at each end, the live one moving with the music, the `i` hint, and what the knob follows:
  fixed, louder notes → more, louder sound → more, busier → more, …). **Add a widget** opens the collection with your verdicts from the lab and places a clip at
  the playhead, on top; so does Ctrl+P.
- **Undo** (Ctrl+Z), **redo** (Ctrl+Shift+Z), **Save show** (Ctrl+S) writes `shows/<song>.json`.
- **Show** tab: *Describe the show* saves your words to `shows/<song>.description.md`; ask Claude Code to compose
  the show from it ([docs/COMPOSING-SHOWS.md](docs/COMPOSING-SHOWS.md), `npm run check-show`).
- **F** full screen, **H** hides the controls.
- **Each clip** can also *listen to* one part (a track of the recording such as Violins or Cellos, a family, or a
  line worked out from the notes: melody, bass line, inner voices, low, high, accents), be seen only in a **place**
  (a small copy of the widget, or a mask over the full-size picture, that you drag, turn and soften on the stage), and follow an **intensity** curve drawn in a lane
  under the timeline like DJ automation (presets: fade in or out, swell, pulse every beat or bar, gate on loudness,
  while its part plays). Lower intensity means fewer attacks, a fainter picture and a calmer pulse.
  [docs/COMPOSING-SHOWS.md](docs/COMPOSING-SHOWS.md) explains all three.
- **Add a widget** filters the collection by feel words (icy, liquid, stabbing…), by instrument, and by what suits
  this song's instruments.
- **Export → Record video** records the show to an MP4 (H.264 + AAC) while the song plays through once, from the
  start or from the playhead; the song's end saves it to your downloads. *For sharing* is 1.9 Mbit/s (about 15 MB a
  minute), *High quality* 8 Mbit/s (about 61); both 720p at 30 fps. Keep the tab in front: hiding it pauses the
  recording.
- **Export → Render HD master** (dev server only) draws the show frame by frame on this computer, from the start or
  from the playhead, with a progress bar and the time left: a 2560×1440 60 fps master plus a share copy in
  `renders/`. The same from a terminal: `npm run render-show -- <song>` (below).

### The HD master and the share copy

```bash
npm run render-show -- <show id | shows/x.json> [--scale 2] [--fps 60] [--from s] [--to s] [--no-share] [--share-mb-per-min 15]
```

- **The master** (`renders/<id>.mp4`): the show supersampled (drawn at 2× in 1280×720 units, so every line is sharp),
  2560×1440 at 60 fps, x264 crf 13, BT.709 with its colour tags, and the recording's sound sample for sample (AAC
  320k). Frames leave the page losslessly, and the same show gives the same frames every time. It takes 3 to 10 s per
  second of video on this machine at 2×, depending on the widgets (horizon is the costliest), so a 4-minute song takes
  15 to 45 minutes; the ETA printed at the start samples the song's drawing cost first. `--scale 1 --fps 30 --crf 18 --no-share` gives the old quick 720p kind.
- **The share copy** (`renders/<id>-share.mp4`): made from the master, 1920×1080 at 30 fps, two-pass x264 at about
  15 MB a minute (1.87 Mbit/s + AAC 128k). **Send it in WhatsApp as a *document*** (attach → Document), not as a
  video, or WhatsApp squeezes it again. For a smaller file pass `--share-mb-per-min 7`.
- **The contact sheet** (`renders/<id>-sheet.png`): one frame every 10 s, to look at before sending.

### Instrument tracks: YourMT3+ (optional)

Piano recordings need only the piano model. For ensembles (a symphony, a concerto) the ingest also runs
[YourMT3+](https://huggingface.co/spaces/mimbres/YourMT3), which writes one note track per instrument it hears
(violins, violas, cellos, horns, oboe…); those become the parts a layer can listen to, and fill the piano model's
gaps. It is installed **outside the repo** and never vendored:

1. Download the Hugging Face Space `mimbres/YourMT3` (with git-lfs, for its checkpoints) somewhere.
2. Make a Python 3.11 venv from `scripts/ears/requirements-ymt3.txt` (default `C:/Users/maxim/.venvs/wa-mt`; torch
   with CUDA).
3. `npm run setup-ymt3 -- --from <the Space folder> [--python <venv python>] [--dir <install>]` copies the model code
   and the MoE checkpoint (sha256-checked) to `%LOCALAPPDATA%/WinkelAmp/ymt3`, probes it, and writes `ymt3.json` there.
   `WINKELAMP_YMT3` points at another install (its folder or its `ymt3.json`).

The YourMT3 code is Apache-2.0 (its source headers); check the Space's model card for the checkpoints' terms before
sharing anything made from them. Without YourMT3 nothing fails: an ensemble falls back to basic-pitch for the gaps
(`WINKELAMP_PY_BP`, default the venv `C:/Users/maxim/.venvs/wa-bp`), then to the piano model alone, with a warning in
the pack, in `npm run ears`'s `/health` and in the studio's words.

### Instrument tracks: MuScriptor large (an option for string pieces)

YourMT3+ stays the default. For **string-led orchestral pieces** a song can take its instrument tracks from MuScriptor
large instead, by choice. On big brass and percussion pieces the list can hurt, and on a song that has a show the lanes its
layers listen to can thin out (Winter's violin: 810 to 596 notes at 146–211 s, none at 130–145 s), which `check-show` cannot
see. So listen before keeping it.

```bash
npm run setup-muscriptor -- [--python <venv python>] [--dir <install>] [--download]
npm run ingest -- <audio> --instruments-model muscriptor --instruments strings|baroque|classical|<list>
```

- **Setup.** A Python 3.11 venv from `scripts/ears/requirements-muscriptor.txt` (default
  `C:/Users/maxim/.venvs/wa-ms`), `hf auth login`, then `npm run setup-muscriptor`, which probes it and writes
  `muscriptor.json` to `%LOCALAPPDATA%/WinkelAmp/muscriptor` (`WINKELAMP_MUSCRIPTOR` points at another). `--download`
  fetches the weights (5.5 GB); an ingest never downloads.
- **The licence.** MuScriptor's weights are CC-BY-NC, non-commercial: own shows and experiments are fine; selling
  WinkelAmp with it, or renders made from its notes, needs a commercial licence.
- **The list is required.** Without one it hears Vivaldi's strings as guitars. `strings` is violin, viola, cello,
  contrabass; `baroque` adds acoustic_piano; `classical` adds flutes, oboe, clarinet, bassoon, french_horn, trumpet,
  timpani. An own list is MuScriptor's names with commas, in the order given. `string_ensemble` is refused: it swallowed
  Vivaldi's violins.
- **The keyboard lane** comes from YourMT3+ when the list has a keyboard (MuScriptor barely finds a harpsichord), so
  YourMT3+ runs too, or its cache is read. A list without one gets no keyboard track.
- **The time, measured on a shared GPU:** 0.7 to 1.8 × the music (a 12-minute piece: 8 to 22 min), where YourMT3+ takes
  about 0.2 ×. **The memory:** up to 15 GB of GPU memory; out of memory goes once more in bfloat16.
- **The cache.** Raw rows per recording and list, `songs/<id>/notes.muscriptor-<8 hex>.json`, so a second list does not
  destroy a 20-minute result; `--redo muscriptor` runs it again. The cleanup (`src/studio/pack/clean-tracks.ts`) runs at
  build time, and the pack's warnings say what it did.
- **The fallback.** MuScriptor missing, failing, or stuck in a loop gives YourMT3's tracks with a warning in the pack,
  never a failed ingest.
- **In the studio:** the Show tab's *Redo the transcription…* (with `npm run ears`, restarted after a setup) chooses the
  transcriber and the list and says how long it will take. The run carries on if the page closes, and choosing Start again
  follows it. It ends in a Reopen notice, never a reload. There is no cancel button, and stopping `npm run ears` on Windows
  may leave a running Python behind (not tested).

**The overnight files.** Five songs have a saved run, `notes.muscriptor-large.json`, about two hours of GPU. These commands
import them and never run the model. A file does not say its list, so it is required here too. Only these commands change
the real packs (or the studio's dialog, which offers the same file):

```bash
npm run ingest -- songs/vivaldi-winter/audio.mp3 --id vivaldi-winter --muscriptor-notes songs/vivaldi-winter/notes.muscriptor-large.json --instruments baroque
npm run ingest -- songs/vivaldi-spring/audio.mp3 --id vivaldi-spring --muscriptor-notes songs/vivaldi-spring/notes.muscriptor-large.json --instruments baroque
npm run ingest -- songs/vivaldi-autumn/audio.mp3 --id vivaldi-autumn --muscriptor-notes songs/vivaldi-autumn/notes.muscriptor-large.json --instruments baroque
npm run ingest -- songs/vivaldi-four-seasons/audio.mp3 --id vivaldi-four-seasons --muscriptor-notes songs/vivaldi-four-seasons/notes.muscriptor-large.json --instruments baroque
npm run ingest -- songs/beethoven5/audio.mp3 --id beethoven5 --muscriptor-notes songs/beethoven5/notes.muscriptor-large.json --instruments classical --piano-notes lab/notes-b5.js
```

Beethoven's pack took its piano notes from the lab's file. `lab/notes-b5.js` holds the same 2105 notes as its
`notes.gpu.json` (compared to 10 ms), so the dialog, which reads that cache, gives the same piano notes.

### Ingest

```bash
npm run ingest -- <audio> [--id <slug>] [--title "<t>"] [--notes auto|gpu|hybrid|ymt3|bp|approx|<notes file>]
                  [--piano-notes <notes file>] [--kind auto|piano|ensemble] [--redo piano|ymt3|bp|muscriptor] [--force] [--progress json]
                  [--instruments-model ymt3|muscriptor] [--instruments strings|baroque|classical|<list>] [--muscriptor-notes <file>]
```

- `--notes auto` (the default) runs the piano model and YourMT3+, calls the recording *piano* or *ensemble* from
  YourMT3's piano share, and for an ensemble fills the piano model's gaps with YourMT3's notes and writes the
  instrument tracks. Anything missing falls back a row, with a warning; `auto` never fails for a missing transcriber.
- `gpu`, `hybrid`, `ymt3`, `bp` insist on those transcribers (exit 3 without them); `approx` uses the analysis only; a
  notes file is used as is.
- `--kind piano|ensemble` overrides the call; `--piano-notes` uses a notes file as the piano model's notes;
  `--redo` re-runs one transcriber instead of reading its cache (each is cached in the song's folder by the audio's
  sha1); `--progress json` prints machine-readable progress (the ears server uses it).
- `--instruments-model muscriptor` takes the tracks from MuScriptor large and means an ensemble (with `--kind piano`, or
  `--notes` other than `auto` or `hybrid`, it is exit 2); `--muscriptor-notes` reads a saved run instead of running it.
- `npm run describe-song -- <id>` then lists the tracks and where each instrument plays; `npm run pianoroll` draws
  piano rolls of them.

### Pick the melody's notes for a widget

Some widgets answer every attack and drown the melody. **Pick notes** (in the transport bar) opens a piano roll of the
song, with the real recording playing and nothing selected: click or box-select the notes you want (Suggest top line gives a start; on
an ensemble, colours and a legend say which instrument is which, and a name hides that instrument or plays its notes as
tones). **Pick the notes** from those, choose a widget, preview it on your picks against every note, and **Place in
scene**: the widget then answers those notes only, each as strongly as it was played, and one undo takes the placement
back. Notes already connected to a widget carry a dot. Everything you pick is also kept per song as marks in
`melodies/<song>.json` (committed, saved by themselves), and **Bring back** selects the ones no widget uses; the picks
themselves are in the show (`picks`, see [docs/COMPOSING-SHOWS.md](docs/COMPOSING-SHOWS.md)). Studio only; a widget you don't connect
behaves as before.

### Have Claude compose a show

Write what you want to see in the **Show** tab's *Describe the show* box (it is saved to
`shows/<song>.description.md`), then ask a Claude Code session in this repository to compose the show from it. The
session writes clips as [docs/COMPOSING.md](docs/COMPOSING.md#studio-shows-clips-on-tracks) says, and takes the widgets and
their knobs from the list in [docs/COMPOSING-SHOWS.md](docs/COMPOSING-SHOWS.md):

```bash
npm run describe-song -- <song>                  # the song in words: its stretches, their character, loudness, attacks
# read shows/<song>.description.md, write shows/<song>.json (clips on tracks, knobs where the words ask)
npm run check-show -- shows/<song>.json          # exit 0 = it plays; --fix repairs overlaps and typos
npm run render-show -- <song> --from 120 --to 135 # a look at one stretch, then a contact sheet of its frames
```

A studio with the song open follows the show as it changes on disk (it asks first if you have unsaved edits).

Songs (`songs/<id>/`: the audio and its pack) stay on your machine and out of git; shows are committed. The
widgets live in [`lab/tools/`](lab/README.md): the [widget lab](lab/index.html) is where they are sketched and
rated, and the studio runs the same files, so a widget looks the same in both.

## Project layout

```
index.html              the studio; render.html frames on demand (render-show, fidelity)
lab/                    the widget lab: lab/tools/*.js are the widgets, lab/index.html the harness and verdicts
src/
  widgets/              the runtime that runs lab/tools/*.js with the lab's ctx, chords, drives and shared canvas
  studio/               pack/ (song packs), show/ (shows, transitions, the Conductor, edits, undo), compose/
                        (the auto-composer), ui/ (the studio page)
  audio/                FFT, features, descriptors, melody tracker/extractor, structure (sections, drops), offline
                        analysis; the four character studies and their synth, for measuring the melody tracker
  character/            descriptors → axes → archetype blend → material; reservoir gestures; palettes
  visual/               the recorder and note colours
shows/                  the studio's shows (<song>.json) and their descriptions; melodies/ the picker's marks; songs/ (packs, audio) is local only
scripts/                ingest, the show checker, renders and the browser checks
tests/                  vitest unit tests
```

## Scripts

```bash
npm run dev            # dev server: the studio at /, the lab at /lab/index.html
npm run ears [-- --port 5175]               # the local server the studio sends dropped recordings to (GPU notes)
npm run ingest -- <audio> [--id <slug>] [--title "<t>"] [--notes gpu|approx|<file>]   # a song pack in songs/<id>/
npm run check-show [-- <file>…] [--fix]     # validate shows/*.json
npm run describe-song -- <id>               # a song pack in words, for composing its show
npm run widget-docs [-- --check]            # regenerate (or check) the widget list in docs/COMPOSING-SHOWS.md
npm run render-show -- <show id | file> [--scale 2] [--fps 60] [--from s] [--to s] [--out renders/<id>.mp4] [--no-share]
                       # the HD master (2560×1440 at 60 fps), its WhatsApp share copy and a contact sheet, frame by frame
                       #   with the recording's sound (a song without a show: the one the studio composes)
npm run setup-ymt3 -- --from <Space folder>  # installs YourMT3+ outside the repo (see above)
npm run setup-muscriptor -- [--download]     # checks MuScriptor's venv and weights, says its licence (see above)
npm run lab-notes -- <id>                    # the lab's files for a song (lab/pack-<id>.js: tracks, beats, loudness; a new song also its audio and notes)
npm run pianoroll -- <id> --out <png> [--by track]   # a piano roll of a song, coloured by track, class or line
npm run studio-check   # drives the studio in Chrome on a 30 s test song (starts its own server)
npm run layers-check   # the layer panel: listens to, where, intensity presets, the widget picker's filters
npm run picker-check  # the note picker on Vivaldi's Winter: marks saved, no key reaches the show, the preview stays out of it, one undo
npm run picks-check   # widgets on picks in the real runtime: exactly the picked attacks, after a seek, at scale 1 and 2
npm run overlay-check  # the region overlay on the stage: drags, Shift, Alt, rotation, feather, undo, never in the picture
npm run lanes-check    # the intensity lanes: add, drag, bend, shapes, presets, undo, save
npm run redo-check     # the redo dialog: durations, the required list, the choice sent, the Reopen notice (a fake ingest)
npm run runtime-check  # instances, routing, intensity and regions in the runtime: seek invariance, spot and window
npm run hd-check       # each widget at 2x is the same picture as at 1x, only sharper (crops in renders/look/hd)
npm run persist-probe  # measures which widgets repaint their picture (the intensity's visibility classes)
npm run record-check [-- --song <id> --seconds 60]   # records in the studio's Export and reads the MP4 Chrome wrote
npm run fidelity       # the studio draws the lab's pixels, widget by widget and with layers (local: needs the lab's notes files)
npm test               # unit tests
npm run build          # type-check + production build into dist/
```

The browser scripts drive the system Chrome through Playwright, with `chromiumSandbox: true`: Playwright turns Chrome's
sandbox off unless a launch asks for it.

`.github/workflows/pages.yml` publishes `dist/` to GitHub Pages on every push to
`main`, once Pages is enabled for the repository (Settings → Pages → Source:
GitHub Actions).

## Ideas for next steps

- The studio: shows for more of the repertoire, now that ensembles get instrument tracks; six layers with regions
  at 60 fps in a visible window are not measured yet (the work per step fits; the HD render is not affected); a phone-friendly way to share a show without a
  video
