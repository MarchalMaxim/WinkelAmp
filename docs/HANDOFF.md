# Handoff — where WinkelAmp stands

## 2026-11-01: instruments, places, intensity lanes, tags and the HD master

Build of `docs/superpowers/specs/2026-10-31-instruments-regions-automation-hd-design.md` along
`docs/superpowers/plans/2026-10-31-instruments-regions-automation-hd.md` (T1–T24, about 55 commits on
`claude/ambitious-project-continuation-ff6d7f`). **Nothing is merged into `claude/wizardly-franklin-ttaqyo`: that is
the user's call.**

### What it is now

- **A layer listens to one part.** Ensemble recordings are ingested with YourMT3+ as well as the piano model: one note
  track per instrument (Beethoven's Fifth: violins, violas, cellos, a string section, horns, oboe, clarinet, bassoon,
  piano, plucked), estimated velocities, and all-notes that fill the piano model's gaps. Every song, piano too, has six
  lines worked out from the notes (melody, bass line, inner voices, low, high, accents). A layer that listens gets
  only that part's attacks, pulse and sounding notes; `strings@melody` and `strings@bassline` are two instances in one
  section.
- **A layer is seen in a place.** A small copy (`window`, the default for every widget: it draws alone and the whole
  picture is fitted into the shape) or a mask (`spot`: it draws full size on the shared picture, seen only through the
  shape, right for the readers that cut or smear what is below). Rect or ellipse,
  turned, soft-edged, placed by dragging handles on the stage; a moved place glides over the section's fade.
- **A layer follows an intensity curve**, drawn in lanes under the timeline like DJ automation (pivots, linear, ease,
  hold, bends; presets: fade in or out, swell, pulse every beat or bar, gate on loudness, while its part plays).
  Lower intensity means fewer attacks (a fixed, deterministic share), a fainter picture (corrected per widget class so
  half looks like half) and a calmer pulse.
- **Widgets have synesthetic tags** (`lab/tags.json`: feel words, suited instruments, a stack role; `lab/tag-words.json`
  says what each word looks and sounds like). The picker filters by them and by "suits this song"; the auto-composer
  reads the description's feel words and routes an accent to the instrument it suits.
- **Shows are version 2** when they use any of this; v1 files still load and save in their own form.
- **The HD master.** `render-show` draws the show supersampled (2560×1440, widgets still in 1280×720 units behind a
  context proxy), 60 fps, lossless to x264 crf 13 BT.709, plus a 1080p30 share copy at about 15 MB a minute and a
  contact sheet. The studio's Export menu starts the same render on this computer, with progress and time left.
- **The lab** runs the same layer code: each card chooses what it listens to, its place and an intensity preset; tags
  are chips with a filter.

### Where things are

| Piece | Where |
|---|---|
| The new maths, written once | `lab/layers/{automation,lines,persist,region,slot}.js` (curves, presets, thinning, lines, the pulse, visibility classes, masks, spot and window); the studio and Node evaluate the same text through `src/widgets/layers.ts`, `layers-source.ts`, `scripts/node/layers.ts` |
| YourMT3+ | installed outside the repo by `npm run setup-ymt3` (`%LOCALAPPDATA%/WinkelAmp/ymt3`, venv `C:/Users/maxim/.venvs/wa-mt`, `WINKELAMP_YMT3`); runner `scripts/ears/ymt3.py`; basic-pitch fallback `scripts/ears/bp.py` (venv `wa-bp`, `WINKELAMP_PY_BP`) |
| Pack v2 | `src/studio/pack/{pack,build,tracks,instruments}.ts`; ingest `scripts/ingest.ts` (`--notes auto` and its fallback rows); `npm run describe-song` lists the tracks, `npm run pianoroll` draws them |
| Show v2 | `src/studio/show/{show,edit,schedule,conductor}.ts` (listen, region, intensity; instance keys; pivots across splits, merges and boundary drags) |
| The runtime | `src/widgets/runtime.ts` (instances, routing, own pulses, regions), `src/widgets/hd-context.ts` (supersampling) |
| The studio UI | `src/studio/ui/layer-controls.ts` (listens to, where, intensity presets), `region-overlay.ts` + `lab/region-ui.js` (handles on the stage), `lanes.ts` (intensity lanes), `widget-picker.ts` (tags), `record.ts` (recorder presets, Render HD master) |
| The HD render | `scripts/render-show.mjs`, `scripts/lib/encode.mjs`; the studio's job API in `scripts/studio-api.ts` |
| Tags | `lab/tags.json`, `lab/tag-words.json`, `src/widgets/tags.ts`; printed per widget in `docs/COMPOSING-SHOWS.md` |
| Shows | `shows/{rach-prelude-recording,beethoven5,chopin-winter-wind,vivaldi-winter}.json` (the first three route layers to the melody, the bass line and Beethoven's violins; Vivaldi gives each instrument its own widget) |
| HD masters and share copies | `renders/<id>.mp4`, `renders/<id>-share.mp4`, `renders/<id>-phone.mp4` (under 30 MB), `renders/<id>-sheet.png`; last night's 720p renders moved to `renders/720p-2026-10-31/` (all local, git-ignored) |

### What was checked (T24)

- `npm test` (74 files, 949 tests), `npm run typecheck`, `npm run build`, `npm run widget-docs -- --check`,
  `npm run check-show` (the four shows ok).
- `npm run fidelity` (full, layer cases included): 742/742 comparisons pass, 739 pixel-identical. Scale 1 is untouched.
- `npm run runtime-check` 14/14 (seek invariance, instances, routing, curves; spot and window at scale 1 and 2; check 9
  now covers timeslice in a spot too), `studio-check` 33/33, `layers-check` 20/20, `overlay-check` 27/27,
  `lanes-check` 15/15, `record-check` 11/11, `hd-check` no QUARTER and no ERROR at 2× (harmonograph within its recorded
  allowance, scribble SOFT as before).
- The studio end to end in headless Chrome (own server, temp songs and shows): Beethoven open, flee in the Closing set
  to listen to the violins (the menu lists the ten tracks with their note counts, two families and the six lines), a
  spotlight placed and dragged on the stage, an intensity lane drawn with four clicks and a pivot dragged, Ctrl+S (a
  version 2 show with listen, region and intensity), then Export → Render HD master from the playhead (15 s in 68 s:
  2560×1440 60 fps, the share copy 3.8 MB). The stills and the master's frames show flee's red streaks only inside the
  ellipse, over Kandinsky.
- Review Focus by hand: an old v1 show (Winter Wind and the Prelude as they were before T20) opens, plays and saves as
  version 1, identical but for the composer stamp a user's save writes (and the final newline the hand-written Prelude
  lacked); `strings@melody` over `strings@bassline` both load routed and feel different pitches (0.59 and 0.13); a
  256-pivot gate lane drags at about 10 ms a pointer move, one Ctrl+Z undoes the drag, and a click past 256 adds nothing;
  ingest with `WINKELAMP_YMT3=C:/nope WINKELAMP_PY_BP=C:/nope/python.exe` (into a temp songs folder) writes a valid v2
  pack with the fallback warnings, and the ears `/health` names both missing tools with their reasons.
- Fixed in this review:
  - a spotted time slice drew its threads outside its region (its put-back at the next fade): a spot's queued pass now
    runs clipped to the region's footprint;
  - harmonograph's 2× fade gap is a recorded `hd-check` allowance, with the reasons, printed on every run;
  - a lane click past 256 pivots silently dropped the last pivot; a merge of two full curves dropped the second; a
    region glide from 170° to −170° spun 340°;
  - `render-show` posted each frame as a Blob, and busy 2× frames (Winter Wind's horizon, 4–5 MB PNGs) made a POST fail
    after 100–150 frames: it now posts the bytes;
  - T1's contract files had never been committed (the later tasks' commits depended on them); they are now.

### Fixed after the final review (2026-11-01), and checked again

- A time slice moved from the whole screen or a mask into a small copy (window) pasted its window's picture over the
  whole stage at every step (its put-back hook stayed on the shared canvas): the put-back now acts only on the canvas
  it was kept from. Runtime-check 9 covers stage → window and spot → window for it (0 copies on the stage, the stage
  outside the box byte-equal to a run windowed from the start); red before the fix, green after.
- `check-show`, `render-show`, the studio's save route and the studio pass the song's tracks to the validator, so a
  listen naming a track the song lacks gets its warning (`this song has no horn: it plays on all notes`) there too.
- Arrow-key nudges of a pivot are one undo step per press, no longer merged across pivots (lanes-check).
- Cancelling an HD render asks render-show (over an IPC channel) to close Chrome, ffmpeg and its server and remove its
  temp folder; after 20 s, or without the channel, the whole process tree is killed and the job removes the folder.
  Checked for real through the API: cancelled at frame 60 of 3600, the folder gone, no ffmpeg left.
- `labLayerSpecs` and `labLayers` have unit tests (`tests/driver-layers.test.ts`); runtime-check's scale-2 software
  pass takes a fresh browser per widget and retries a crashed run once; layers-check takes its picker words from
  `lab/tags.json` (the user's retagging had dropped rorschach's "liquid").
- The docs say Small copy (window, the default for every widget) and Mask (spot).
- Checked: `npm test` (75 files, 960 tests), typecheck, build, `widget-docs --check`, `check-show` (four shows ok),
  `runtime-check` 14/14, `studio-check` 33/33, `layers-check` 20/20, `overlay-check` 27/27, `lanes-check` 16/16,
  `record-check` 11/11, `hd-check` no QUARTER and no ERROR at 2× (scribble SOFT as before; timeslice at 3× moved
  0.087 and 0.095 against 0.1), `fidelity` 724/724 (721 identical; fewer cases than before since Hilma was dropped).

### What was measured

- **YourMT3+** (MoE, on the GPU): Beethoven 7:05 in 80 s (piano share 0.049, ensemble, 8024 notes in ten tracks),
  Vivaldi's Winter 9:26 in 97 s (0.078, ensemble), the Prelude 3:52 in 18–21 s (piano share 1.0), Winter Wind 4:09 in
  30 s (1.0), the Nocturne 6:22 in 37 s (1.0). Piano recordings keep the piano model's notes exactly.
- **Ingest stage times**: Beethoven (piano notes from the lab's file) 101 s in all: YourMT3+ 93 s, analysis 7 s;
  Vivaldi 203 s: the piano model 82 s, YourMT3+ 110 s, analysis 10 s.
- **Determinism**: Winter Wind 0–4 s rendered twice gives identical frame md5s (240 of 240), on the stretch that failed
  with the old Blob transport.
- **The transport** (T9, Beethoven at 2×): drawing alone 583 ms a frame; PNG through toBlob and POST 627 ms; raw RGBA
  POSTed 1146 ms; base64 through `page.evaluate` 885 ms. PNG it is.
- **HD seconds per video second** (2×, 60 fps, with other checks running alongside): the Prelude 3.28 (3:52 in
  14:47, the ETA said 16:52, 12 % off), Beethoven 3.86 (7:05 in 30:58, the ETA said 40:41: 24 % off, as the full
  runtime-check and hd-check ran beside it for most of it), Winter Wind 10.35 (4:09 in 45:38 with nothing else running: its horizon is the costliest widget at 2×; the ETA said 54:40, 17 % off).
- **Sizes**: masters 400.7 MB (Prelude), 1005.9 MB (Beethoven), 1016.3 MB (Winter Wind); share copies 57.9 MB, 106.7 MB,
  62.6 MB (15.0 MB a minute each); phone copies (1280×720, 28 MB budget) 27.8 MB, 27.9 MB, 27.9 MB.
- **Persist classes** (`npm run persist-probe`, in `lab/layers/persist.js`): 14 widgets keep their strokes (kandinsky,
  rorschach, squares, flee, current, strings, murmuration, casket, blocks, tunnel, pointillism, suprematism, hilma,
  nebula); the other 31 repaint their picture and take the corrected visibility curve.
- **Six layers** (four regions, two curves) in the studio, Prelude 120–140 s, headless Chrome on the GPU:
  `runtime.step` p50 3.0 ms, p95 4.9 ms, max 12.6 ms (software canvas: p95 5.2 ms); the same six without regions or
  curves p95 4.3 ms. Headless Chrome paces its frames at 30 Hz (33 ms) even for the plain six, so the frame rate itself
  could not be measured there (T15's 41.7 ms p95 was most likely that pacing).

### Known limits and what is not verified

- **Six layers with four regions at 60 fps live is not verified**: the work per step fits easily (p95 under 5 ms of
  the 16.7 ms), but headless Chrome only paces at 30 Hz, and the GPU's share of the compositing is not in that number.
  Play it in the studio to see. The HD render is not affected (it draws frame by frame).
- **A spotted time slice's put-back is full strength**: its kept picture comes back at the next fade before the spot's
  feather and intensity apply, so in a soft edge or under a low curve its threads show at full strength for a frame.
  Use a hard edge, or the window, for a time slice that must stay faint.
- **Harmonograph at 2×**: faint old trails linger a little longer than at 1× (8-bit colour-burn floors); the same
  figure, sharper.
- **Share copies are over 30 MB for songs longer than two minutes** at the spec's 15 MB a minute; the `-phone.mp4`
  copies (720p, 28 MB) were made for WhatsApp on a phone. `--share-mb-per-min 7` gives a smaller share copy directly.
- **Beethoven looks busier in the gaps**: its all-notes are now the piano model plus YourMT3's gap fill (spec
  [confirm] 4), so the development's murmuration has visibly more strokes than in last night's render (3:00).
- **Instrument labels are what YourMT3+ heard**: no first and second violins; "String section" is string sound it could
  not split; tracks of a few dozen notes (horn 44, plucked 52) are guesses.
- Not verified: the HD master and the share copy played on a phone or sent through WhatsApp; a real user's
  hand on the overlay and lanes (all drags were Playwright's mouse); YourMT3+ on a recording with voice or brass
  solos; the six-layer frame rate in a visible Chrome window.

## 2026-10-31: the studio (the lab becomes the product)

Overnight build of `docs/superpowers/specs/2026-10-31-lab-first-studio-design.md` along
`docs/superpowers/plans/2026-10-31-lab-first-studio.md` (T1–T8, about 60 commits on
`claude/ambitious-project-continuation-ff6d7f`). **Nothing is merged into `claude/wizardly-franklin-ttaqyo`: that is
the user's call.**

### What it is now

`npm run dev` opens the **studio** at `/`: drop a recording, its notes are transcribed once on the GPU, and a show of
the lab's widgets plays with it section by section, on every attack. The old app (microphone, MIDI, the WebGL stage) is
`legacy.html`, untouched. The widget lab is still `lab/index.html`, where widgets are sketched and rated.

### Where things are

| Piece | Where |
|---|---|
| Song packs (notes, sections, beats, loudness, chords) | `src/studio/pack/`, `src/audio/song-analysis.ts`; CLI `npm run ingest`; GPU transcriber `scripts/ears/transcribe.py` (venv `C:/Users/maxim/.venvs/wa`, or `$WINKELAMP_PY`); packs in `songs/<id>/` (local, git-ignored) |
| Drop a recording | `npm run ears` (`scripts/ears/server.ts`, port 5175) runs the ingest CLI; without it the browser makes approximate notes (`src/studio/ingest/`) |
| The widgets | `lab/tools/*.js`, unchanged, run by `src/widgets/` with the lab's exact ctx, chords, drives and shared canvas; `npm run fidelity` checks the studio draws the lab's pixels |
| Shows | `shows/<song>.json` (committed), `src/studio/show/` (format, validator, transitions, the Conductor, edits, undo); the auto-composer `src/studio/compose/` |
| The studio page | `index.html`, `src/studio/ui/`; the dev API that lists songs and saves shows is `scripts/studio-api.ts` (dev server only) |
| Claude composes | `docs/COMPOSING-SHOWS.md`, `npm run describe-song`, `npm run check-show`, `npm run widget-docs` |
| Export | in the studio (Export → Record video, `src/studio/ui/record.ts`); frame by frame `npm run render-show` → `renders/<id>.mp4` (local, git-ignored) |
| The user's two shows | `shows/rach-prelude-recording.json` (+ `.description.md`, the user's words) and `shows/beethoven5.json`; full renders and contact sheets in `renders/` |

### Checked at the end (T8 review)

- `npx tsc --noEmit`, `npx vitest run` (47 files, 604 tests), `npm run build`, `npm run check-show` (both shows ok),
  `npm run widget-docs -- --check`, `npm run studio-check` (33/33), `npm run record-check` (11/11), `npm run fidelity --
  --quick` (286/286 comparisons pass, 283 pixel-identical; the rest a few pixels off, as much as the lab against
  itself) and, because quick mode met only silence at the Prelude's start for them, the loved widgets in full
  (`-- --only kandinsky,squares,flee,strings,casket,marbling`: 122/122 pixel-identical, 97 with a picture). `npm run render-show -- beethoven5 --from 155 --to 170`: 450 frames, 1280×720 at 30 fps, 15.0 s of AAC, 0.45 s
  per video second; the contact sheet shows the fate motif's squares over Kandinsky, then Kandinsky fading under the
  development's Rorschach ink, nothing popping.
- The studio driven in Chrome on the real recordings (own server, a scratch copy of `shows/`): play from the poster,
  play at the Prelude's 83, 124, 140, 176, 208 s and Beethoven's 1, 20, 80, 160, 258, 340, 410 s, a paused seek (quick,
  then settled), add a widget, turn a knob, drag a boundary, undo back to the saved show exactly, save (validates), the
  Show tab, the library, Export from the playhead (an 8 s MP4: H.264 1280×720 + AAC, 1.13 MB, so 8.5 MB a minute),
  the phone width (no sideways scroll). The stills read as the shows mean them: dark-red dread squares and Rorschach
  ink for the Prelude's opening, the casket's cuts and drips from the crescendo (1:56), murmuration for the return, the current for the
  afterword; Beethoven's fate motif as squares + casket over Kandinsky.
- Fixed in the review: a seek before the first play left the poster over the picture it drew (and over every edit's
  refresh); now a seek shows the picture.
- Edge cases: 5 s silence + 10 s tones + 5 s silence and 20 s of pure silence ingest without a NaN; the silent one
  warns "no notes found" and composes one section; `WINKELAMP_PY=C:/nope/python.exe npm run ingest` exits 3 naming
  `--notes approx`; a copy of the Prelude show with an overlap and a gap makes `check-show` exit 1 naming both sections
  and the times (the studio opening such a show repaired is in `studio-check`).

### Measured

- GPU ingest: Hungarian Dance No. 5 (45.8 s, orchestral) 12.9 s in all; an 11-minute file (the two recordings
  concatenated, 10:57) 89 s in all (77 s transcribing, 4135 notes, onset coverage 64 %), well inside the
  2–3 minutes aimed for; the studio opens it at once with a composed show of 14 sections and plays it smoothly.
- `render-show`: the Prelude's 3:52 in 1:41 and Beethoven's 7:05 in 3:08 (0.42–0.43 s per video second), re-rendered
  in this review from the committed shows into `renders/` (the files came out byte-identical to the earlier renders),
  with contact sheets of one frame per 10 s (`renders/<id>-sheet.png`).
- In-app recording: *For sharing* 8.5–9.6 MB a minute, *High quality* about 39 (both 30 fps; 60 fps made Chrome write
  twice the asked rate).

### Known limits and what is not verified

- The library lists the Prelude twice: `prelude` (an earlier ingest of the same recording, auto-composed show) and
  `rach-prelude-recording` (the hand-composed show). Delete `songs/prelude/` if one is enough; it is local only.
- The transcriber is a piano model. On the orchestral Hungarian Dance it still covered 49 % of the onsets, above the
  35 % line where approximate notes fill in, so no coverage warning appeared there; Beethoven's symphony (coverage 50 %)
  also came out as `gpu`. Orchestral shows follow fewer, rougher notes than piano ones.
- Pictures are always 1280×720 (a dozen widgets assume it); exports are 720p.
- Not verified tonight: a real tab switch while recording (only simulated with a faked `visibilitychange`); real full
  screen (headless Chrome; resizes and letterboxing are checked); the static build on GitHub Pages itself (the built `dist/` was checked
  locally with `vite preview`: the empty state, adding a recording in the browser, playing it, a reload keeping it); playback of an exported MP4 on a phone
  and through WhatsApp; the 11-minute file dropped through `npm run ears` in the page (the CLI that ears runs was timed
  instead, and the drop path was checked with a 60 s file).

## 2026-10-30, at the end of the scripted-visuals build

### Branch and rules

- Work is on `claude/ambitious-project-continuation-ff6d7f`; the main line is `claude/wizardly-franklin-ttaqyo`
  (pull requests go there). **Never merge a feature branch to main without the user's explicit go-ahead.**
- Reference recordings stay out of git (no `.ogg`/`.wav`/`.mp3` in commits). `corpus/*.json` and
  `corpus/*.data.json` are committed; `study/` and `.superpowers/` are git-ignored.
- Checks at the last commit: `npx tsc --noEmit` clean, `npx vitest run` 19 files / 288 tests passing,
  `npm run build` clean, `npm run shots` (with `--seam`) and `node scripts/e2e-check.mjs <audio dir>` all `ok`.

### What is built

| Area | State |
|---|---|
| **Design and plan** | `docs/superpowers/specs/2026-10-30-scripted-visuals-design.md`, `docs/superpowers/plans/2026-10-30-scripted-visuals.md` |
| **Analysis** (`src/audio/`) | One code path live and offline: FFT, features, descriptors, predominant-melody tracker (live) and extractor (offline, Viterbi), structure (novelty sections, bass drops), fingerprint (recognises a recording across encodings; ~0.06 s per minute of audio in the browser) |
| **Character** (`src/character/`) | Descriptors → axes → archetype blend → material and mood words; reservoir gestures |
| **Music clock** (`src/stage/clock.ts`) | Motion advances with the music only; silence freezes, then dims to an afterimage |
| **Stage** (`src/stage/`) | WebGL2 compositor with seven elements (melody, bass, sparks, bloom, pulse, wave, fluid), feedback, mirror, glow, accents; falls back to Classic with a toast without WebGL2 or on context loss |
| **Scripts** | Schema + validator (`script.ts`), seek-safe player (`player.ts`), bundled corpus found by fingerprint or study id (`corpus.ts`), precomputed song data fed in time (`feed.ts`) |
| **Live director** | Casts by streams, picks scenes by mood from an 11-scene library, changes on sections (primary) and drops (secondary), ≥ 15 s apart |
| **Interface** | Transport, volume, Calm ↔ Wild, Scripted/Live badge; everything else in the Tweak drawer; pins and paused shows; Classic scenes kept; MIDI keys feed the stage |
| **Composing tools** | `npm run study`, `check-script`, `preview-script`; the handbook `docs/COMPOSING.md` |
| **Corpus** | Ten shows: the four studies (Ember, Basalt, Sugar Glass, Mist) and six recordings (Rachmaninoff Prelude Op. 3/2, Sugar Plum Fairy, Hungarian Dance No. 5, humpback, drum & bass, ragtime) |
| **Checks** | 288 unit tests; `scripts/screenshots.mjs` (interface, scripted study, Live, fallback, loop seam, tour video); `scripts/e2e-check.mjs` (corpus recognition, a source switch mid-decode, Live scene changes, pause, MIDI, Classic on pause); `scripts/stage-shots.mjs` (silence, track change, the melody head under each mirror, 1080p bench); `scripts/eval/melody-eval.ts` |

### Adding a song

See README → *Compose a show* and `docs/COMPOSING.md`: `npm run study -- <file> --id <slug>`, compose
`corpus/<slug>.json` from `study/<slug>/`, `npm run check-script`, `npm run preview-script`, revise, commit the
script and its `.data.json`. The reference recordings used so far were in the session scratch folder
(`ref/a/`: sugarplum, hungarian5, ragtime, waltz, humpback, dnb, rach_prelude, rach_concerto2, …); the
librosa ones come from:

```bash
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/librosa/data.git ref-audio
cd ref-audio && git sparse-checkout set --no-cone '/audio/*.ogg' && git checkout
```

### Seen in the end-to-end run

- All six corpus recordings come up *Scripted · <title>*; after a seek into the prelude's climax the stage
  shows the scene the script names there; the prelude's pp chorale doesn't dim.
- `waltz.ogg` (not in the corpus) runs Live and changes scene at 19 s and 34 s.
- Pause: the music clock stops at once and the picture holds perfectly still, then dims from ~1.5 s to the
  floor by ~4.5 s (fixed in this build: the clock used to glide on for ~2.7 s while the silence detector made
  up its mind; a pause is now known, not inferred).
- Held MIDI keys over a paused song cast the melody thread at the key's pitch (fixed in this build: the paused
  song's last note used to win). A held key whose synth has decayed (or with "Keys make sound" off) counts as
  silence after ~1–3 s, so the picture freezes and dims under a held key.
- A switch to the demo or the mic while a dropped file is still decoding leaves its script behind (fixed in
  this build: the file's script and song data used to take over the new source).
- Classic (the no-WebGL2 fallback) holds its last frame exactly on pause (fixed in this build: its scenes
  kept moving on the wall clock).
- Under a mirror the melody lays itself out inside the part the mirror keeps (head on the centre line under 2
  and 4, a ring round the centre under 6 and up), so its current note stays on screen at any pitch (see
  COMPOSING.md, *Known behaviours*).

### Open items (from the build ledger, none blocking)

- **Calibration:** Sugar Plum reads *lament* and Basalt *machine* in the character engine; the offline melody's
  raw chroma accuracy is ~0.5 (target was 0.7). Scripts set their own palettes, so shows are unaffected; Live
  moods on classical pieces may be off.
- **Fingerprint offset:** script times are seconds of the reference file; a re-encode with different lead-in
  silence matches but plays shifted by the difference (`src/stage/corpus.ts` says so).
- **main.ts** is ~840 lines; the show/study/fingerprint bookkeeping and the director streams could move to a
  small `src/stage/show.ts`. The fingerprint runs on the main thread (~0.7 s for 12 minutes).
- **Director:** a section change inside the 15 s gap is dropped, not deferred, so a scene can hold ~30 s.
- **Live MIDI double events:** with "Keys make sound" on, a key is both a pushed MIDI event and an onset in
  the synth's audio; not visibly doubled in the run, but not measured.
- Replaying the current demo entry doesn't reset the clock and director; `playStudy` with a new seed leaks the
  old player's reverb.
- One unidentified full-suite failure was seen once in Task 12; five cold and warm reruns since passed. The
  wall-clock "is cheap" tests (tests/character.test.ts) are the likely candidates.
- The full ledger with every deferred minor: `.superpowers/sdd/2026-10-30-scripted-visuals/progress.md`
  (local, git-ignored).
