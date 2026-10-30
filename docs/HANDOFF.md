# Handoff — where WinkelAmp stands

_2026-10-30, at the end of the scripted-visuals build._

## Branch and rules

- Work is on `claude/ambitious-project-continuation-ff6d7f`; the main line is `claude/wizardly-franklin-ttaqyo`
  (pull requests go there). **Never merge a feature branch to main without the user's explicit go-ahead.**
- Reference recordings stay out of git (no `.ogg`/`.wav`/`.mp3` in commits). `corpus/*.json` and
  `corpus/*.data.json` are committed; `study/` and `.superpowers/` are git-ignored.
- Checks at the last commit: `npx tsc --noEmit` clean, `npx vitest run` 18 files / 277 tests passing,
  `npm run build` clean, `npm run shots` (with `--seam`) and `node scripts/e2e-check.mjs <audio dir>` all `ok`.

## What is built

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
| **Checks** | 277 unit tests; `scripts/screenshots.mjs` (interface, scripted study, Live, fallback, loop seam, tour video); `scripts/e2e-check.mjs` (corpus recognition, Live scene changes, pause, MIDI); `scripts/eval/melody-eval.ts` |

## Adding a song

See README → *Compose a show* and `docs/COMPOSING.md`: `npm run study -- <file> --id <slug>`, compose
`corpus/<slug>.json` from `study/<slug>/`, `npm run check-script`, `npm run preview-script`, revise, commit the
script and its `.data.json`. The reference recordings used so far were in the session scratch folder
(`ref/a/`: sugarplum, hungarian5, ragtime, waltz, humpback, dnb, rach_prelude, rach_concerto2, …); the
librosa ones come from:

```bash
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/librosa/data.git ref-audio
cd ref-audio && git sparse-checkout set --no-cone '/audio/*.ogg' && git checkout
```

## Seen in the end-to-end run

- All six corpus recordings come up *Scripted · <title>*; after a seek into the prelude's climax the stage
  shows the scene the script names there; the prelude's pp chorale doesn't dim.
- `waltz.ogg` (not in the corpus) runs Live and changes scene at 19 s and 34 s.
- Pause: the music clock stops at once and the picture holds perfectly still, then dims from ~1.5 s to the
  floor by ~4.5 s (fixed in this build: the clock used to glide on for ~2.7 s while the silence detector made
  up its mind; a pause is now known, not inferred).
- Held MIDI keys over a paused song cast the melody thread at the key's pitch (fixed in this build: the paused
  song's last note used to win). A held key whose synth has decayed (or with "Keys make sound" off) counts as
  silence after ~1–3 s, so the picture freezes and dims under a held key.
- Under a mirror-6 scene a low key's melody is cropped away (see COMPOSING.md, *Known behaviours*).

## Open items (from the build ledger, none blocking)

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
  old player's reverb; the HUD note/BPM readouts are outside the drawer.
- One unidentified full-suite failure was seen once in Task 12; five cold and warm reruns since passed. The
  wall-clock "is cheap" tests (tests/character.test.ts) are the likely candidates.
- The full ledger with every deferred minor: `.superpowers/sdd/2026-10-30-scripted-visuals/progress.md`
  (local, git-ignored).
