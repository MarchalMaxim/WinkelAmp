# Handoff — where WinkelAmp stands

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
