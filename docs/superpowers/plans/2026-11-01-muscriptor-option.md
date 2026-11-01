# MuScriptor as an Option for String Pieces: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to carry out this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.
> T1 and T2 share no files and run in parallel. T3 needs both. T4 needs T3. A reviewer follows each task.

**Goal.** A song can get its instrument tracks from MuScriptor large instead of YourMT3+:
`npm run ingest -- <audio> --instruments-model muscriptor --instruments strings|baroque|classical|<list>`, or from the
studio's new "Redo the transcription" dialog, which states how long it takes. YourMT3+ stays the default, and a pack
made without the option comes out as it does today.

**Architecture.**

- `scripts/ears/muscriptor.py` runs the model in its venv and writes raw rows with MuScriptor's own names.
- `src/studio/pack/muscriptor.ts` (pure, browser-safe) holds the one name map, the presets and the loop check.
- `src/studio/pack/clean-tracks.ts` (pure) repairs what the overnight checks found.
- `scripts/ingest.ts` caches the **raw** rows by audio, model and list. At build time it runs the loop check, then the
  cleanup, then merges the YourMT3+ keyboard lane. Anything wrong falls back to YourMT3+ with a warning.
- `buildPack` reads the result in place of YourMT3's rows, so `tracks.ts` and `instruments.ts` do not change.

**Read with it** (`S` = `C:/Users/maxim/AppData/Local/Temp/claude/C--Users-maxim-Desktop-projects-github-WinkelAmp--claude-worktrees-ambitious-project-continuation-ff6d7f/b3b4a070-2436-40c2-8249-6478eeb5f1d5/scratchpad`):

- `S/ms/verdict/verdict.md`: why this is an option and not the replacement.
- `S/msn/night.py`: the overnight runner and its lists. `S/ms/tools/mkjobs.py`: the clip lists.
- `S/mo/plan/sim.cjs`: the dry run behind the thresholds and the table in T1. `S/mo/plan/cal2.cjs`, `cal3.cjs`: the
  measurements. `S/mo/plan/*.cal.json` holds each song's analysis onsets and 100 ms dBFS.

## Rulings

Measured on the five overnight files. Where one departs from the brief, it says so.

1. **Silence comes from the audio, not `pack.loudness`** (departs from the brief). The pack's lane is a slow descriptor
   with a release of about 10 s: Four Seasons reads 0.61 at 1961 s, where the audio is digital silence (−120 dB), and
   its median below −70 dB is 0.22. T1 takes a 100 ms dBFS lane made from the PCM (`frameDb`), never stored in the pack.
   Ingest has the PCM, so nothing is lost.
2. **Past the end is the padded last chunk.** The night script's "unterminated note ends at the duration" never fired:
   no row has `end == duration`, and `events.py` guarantees every start an end. Autumn's 144 notes starting after the
   duration are the model hearing the zero padding of the last 5 s chunk. So: drop those rows and clamp ends. The runner
   needs no special case.
3. **Butting notes are mostly real** (narrows the brief). MuScriptor ends a note the moment the same pitch retriggers,
   so every repeated note butts: 5053 butts in Beethoven alone, the motto among them. Merging them all would erase the
   music. Merge only when both notes are held long (T1 pass 8).
4. **Stuck chords: a whole chunk, one pitch set, one exact rate.** The stuck chunks in the findings meet all of T1 pass
   2 (Autumn's at 605 s goes through pass 1 first); Beethoven's real hammered chord at 345 s (3.2 s) and Winter's tremolo
   do not. In a quiet chunk the notes go. In a sounding chunk they become one held chord, because the pitches are
   probably right and a 9 Hz strobe is not.
5. **Cross-lane dedupe is narrow** (narrows the brief). Real unisons are common in the strings, and dropping winds per
   note cost Beethoven's oboe 26 %. Strings: drop a duplicate only when its pitch is outside the loser lane's p5–p95 and
   inside the winner's. Winds: drop only runs of 4 or more copies, and only where the strings are not playing a tutti.
6. **The cache holds raw rows; cleanup runs at build time.** Retuning a threshold never costs GPU time, and the cleanup
   constants stay out of the cache key. One file per list (`notes.muscriptor-<8 hex>.json`), so trying a second list
   does not destroy a 20-minute result.
7. **The list is required on import too.** The overnight files carry neither a sha1 nor their list (`instruments` there
   is a count per lane, and Spring's says nothing of its `acoustic_piano` because it found none). `--muscriptor-notes
   <file> --instruments <list>` binds the file to the current audio and writes the normal cache.
8. **The keyboard lane comes from YourMT3+ only when the list has a keyboard** (narrows the brief). `baroque` yes;
   `strings` and `classical` no, or Beethoven would regain YourMT3's phantom piano. MuScriptor's own piano rows are
   dropped when it does, which also removes Autumn's hunt theme mislabelled piano from the tracks (the all-notes keep the
   piano model's).
9. **`--instruments-model muscriptor` means ensemble.** With `--kind piano` it is exit 2. The concerto clip's piano
   share sits at 57 %, too near the 60 % line to decide from mixed sources. The fallback keeps `ensemble` too.
10. **`/health` stays `api: 2`, with an optional `muscriptor`.** `probeEars` accepts only 1 or 2, so a bump would break a
    studio from another worktree talking to this ears server.
11. **Provenance is per track.** `Track.from?: 'ymt3' | 'muscriptor'`, absent = YourMT3+ (old packs). `transcribers[]`
    accepts `muscriptor` with an optional `instruments` list. New `notesFrom: 'ms-hybrid'`, because `hybrid` is worded
    "YourMT3+ filling its gaps" in three UI tables.
12. **Durations, measured (a shared GPU, so upper bounds).** YourMT3+ about 0.19× the music. MuScriptor large: Spring
    0.69×, Four Seasons 0.83×, Winter 0.97×, Autumn 1.14×, Beethoven (11 instruments) 1.82×. The UI says 0.7–1.8×.
13. **Ingest never downloads.** `runMuscriptor` sets `HF_HUB_OFFLINE=1`, so a missing 5.5 GB model is a quick fallback,
    not a silent download. Only `setup-muscriptor --download` fetches it.

**What will still be wrong, and the docs must say so (T4):**

- Winter 130–180 s keeps about 370 viola notes above MIDI 72 that are really the solo violin: only notes above A5 move.
- Autumn's Adagio harpsichord stays labelled violin and viola. Its hunt theme, labelled piano, leaves the tracks instead
  of joining the strings. These are label swaps no pass can see.
- Spring's Largo viola stays mostly labelled violin from 262 s: only the doubled notes are resolved.
- A stuck stretch with 2 pitches, or under 4.5 s, stays (Spring 385–390 s).
- Tremolo in a sounding stuck chunk loses its attacks: one held chord.
- Lanes still move together a lot: 54 % of Four Seasons' notes share start and end with two other lanes, and its
  contrabass is mostly the cello an octave down. Only string doubles outside a lane's core are dropped.
- MuScriptor large needs up to 15 GB of GPU memory. Stopping `npm run ears` on Windows may not stop a running Python
  child (not tested; `child.kill()` reaches only the ingest process). No cancel button is in this plan.

## Global Constraints

- **Worktree.** Only `.claude/worktrees/muscriptor-option`, branch `claude/muscriptor-option`. `node_modules` is a
  junction: never `npm install` here.
- **Ports.** Never bind, fetch or restart 5173, 5174, 5180. Checks start their own servers from 5190; tests use port 0.
- **Songs.** Songs are real data and CI has none: vitest never reads `songs/`. A step that rewrites packs sets
  `WINKELAMP_SONGS` to a copy under `S/mo/<task>/songs`. The real packs change only when the user runs a documented
  command.
- **Out of git.** Audio, `songs/`, `renders/`, `lab/notes*.js`, `.superpowers`, `study/`. No new npm dependency.
- **Python.** Only `C:/Users/maxim/.venvs/wa-ms` (Python 3.11.9, torch 2.11.0+cu128, muscriptor 0.4.0) and always `-I`.
  That flag also keeps `import muscriptor` from finding our own `muscriptor.py`.
- **Code.** Strict TS. Every named constant is exported. New Node TS scripts go in `tsconfig.scripts.json`.
- **Commits.** Explicit paths, `Ingest: …` or `Studio: …` or `Docs: …`, ending with a blank line and
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push or merge.
- **Done means:** the task's tests, `npm run typecheck` and `npm test` pass, and the task's Look step was looked at and
  described in the report. Scratch goes under `S/mo/<task>/`.

---

## T1: the cleanup pass

**Files:** create `src/studio/pack/clean-tracks.ts`, `tests/clean-tracks.test.ts`. No other file.

```ts
import type { Ymt3Row } from './tracks';

export interface LevelLane { hop: number; db: ArrayLike<number> }   // dBFS per frame; past the end reads SILENT_DB
/** RMS dBFS of consecutive frames of `hop` s; silence is SILENT_DB (tracks.ts). */
export function frameDb(pcm: Float32Array, rate: number, hop?: number): LevelLane;   // hop default 0.1

export interface CleanInput {
  rows: readonly Ymt3Row[];        // YourMT3 class names ("Violin", "Pipe"): T3 maps names first
  duration: number;
  levels: LevelLane;
  onsets: readonly number[];       // analysis onset times, ascending
}
export interface CleanReport {
  pastEnd: number; clamped: number;
  stuckChunks: number; stuckDropped: number; stuckCollapsed: number;   // collapsed = retriggers removed
  silent: number;
  moved: Record<string, number>;   // "Viola>Violin": 261
  laneDupes: number; stringDupes: number; windDupes: number; merged: number;
}
export function cleanTracks(i: CleanInput): { rows: Ymt3Row[]; report: CleanReport };
/** One line for pack.quality.warnings, starting "cleaned MuScriptor's notes: "; null when nothing changed. */
export function cleanWarning(r: CleanReport): string | null;
```

The output is sorted by (start, midi). The input is not mutated. No randomness. Rows of any other class pass through
every pass that names lanes. The passes run in this order, each exported for its tests:

| # | Pass | Rule | Constants |
|---|---|---|---|
| 1 | `dropPastEnd` | Drop `start ≥ duration − margin`; clamp `end` to `duration` | `PAST_END_MARGIN_S = 0.05` |
| 2 | `collapseStuck` | In each chunk (`floor(start / CHUNK_S)`), group rows by start (10 ms ticks) and take the commonest pitch set of at least `STUCK_MIN_PITCHES` pitches. Stuck when it has at least `STUCK_MIN_TICKS` ticks, is at least `STUCK_TICK_SHARE` of the chunk's ticks, at least `STUCK_IOI_SHARE` of its gaps are within `STUCK_IOI_TOL_S` of the median gap, and it spans at least `STUCK_MIN_SPAN_S`. Mean frame dB of the chunk below `STUCK_QUIET_DB`: drop those rows. Otherwise one row per (class, pitch), from the first tick to the last tick + the median gap | `CHUNK_S = 5`, `STUCK_MIN_PITCHES = 3`, `STUCK_MIN_TICKS = 20`, `STUCK_TICK_SHARE = 0.85`, `STUCK_IOI_SHARE = 0.85`, `STUCK_IOI_TOL_S = 0.02`, `STUCK_MIN_SPAN_S = 4.5`, `STUCK_QUIET_DB = -48` |
| 3 | `dropSilent` | Drop a row whose loudest frame over `[start, min(end, start + window)]` is below the floor | `SILENCE_DB = -60`, `SILENCE_WINDOW_S = 0.4` |
| 4 | `fixRanges` | A note outside its lane moves to the nearest lane (order Contrabass, Cello, Viola, Violin) that fits it **and already has rows**; none: it stays | `STRING_RANGES = { Violin: [55, 127], Viola: [48, 81], Cello: [36, 76], Contrabass: [24, 62] }` |
| 5 | `collapseLaneDupes` | Same class and pitch, starts within `DUP_START_S`: one row, the later end. A moved note must not sound twice | `DUP_START_S = 0.02` |
| 6 | `dedupeStrings` | String rows on different lanes, same pitch, starts within `DUP_START_S`, ends within `DUP_END_S`. The loser's song-wide median pitch is farther from the note (tie: the later lane in `TRACKS`). Drop only if the pitch is outside the loser's p5–p95 and inside the winner's | `DUP_END_S = 0.1`, `CORE_LO = 0.05`, `CORE_HI = 0.95` |
| 7 | `dedupeWinds` | For two wind lanes (`WIND_CLASSES`: Pipe, Oboe, English Horn, Clarinet, Bassoon, the three saxes): a run of at least `WIND_RUN_MIN` consecutive notes of one lane, each a duplicate of a note of the other, where the string attacks in the run's span are below `WIND_EXPOSED_RATE`/s. Drop the run from the lane whose median is farther from the run's median pitch | `WIND_RUN_MIN = 4`, `WIND_EXPOSED_RATE = 8` |
| 8 | `mergeButting` | Consecutive notes of one class and pitch with a gap in `[−0.001, MERGE_GAP_S]`, measured on the notes as they came in. Merge when the shorter is at least `MERGE_HELD_S`, or at least `MERGE_QUIET_S` with no onset within `MERGE_ONSET_S` of the join | `MERGE_GAP_S = 0.02`, `MERGE_HELD_S = 1`, `MERGE_QUIET_S = 0.5`, `MERGE_ONSET_S = 0.08` |

**Named tests, `tests/clean-tracks.test.ts`:**

- *leaves a clean quartet alone*: four lanes with repeated quavers and a unison inside both lanes' cores, levels −20 dB
  → rows deep-equal the input sorted, every count 0, `cleanWarning` null.
- *keeps repeated notes*: the motto at 0.16 s, butting, three lanes → all notes stay, `merged` 0.
- *a second pass changes nothing*: `cleanTracks` on a dirty fixture's output → same rows, every count 0.
- *does not mutate its input* (a frozen copy), and *sorts by start, then pitch*.
- *cleans 30000 rows in under 500 ms* (duplicates must be found through an index by pitch, not by scanning).

`frameDb`:
- *reads silence as SILENT_DB and a full-scale sine near −3 dB*.

Pass 1:
- *drops the padded last chunk and clamps an end*: duration 605.62 → starts 605.7 and 605.6 gone, `[605, 606]` ends at
  605.62, `pastEnd` 2, `clamped` 1.

Pass 2:
- *collapses a stuck chord in a sounding chunk*: 5 pitches, gap 0.12, 420–425 s, −30 dB → 5 rows from the first tick to
  last + 0.12, `stuckChunks` 1, `stuckCollapsed` = removed count, `stuckDropped` 0.
- *drops a stuck chord in a quiet chunk*: the same at −54 dB → 0 rows, `stuckDropped` = all.
- *leaves a hammered chord that is too short*: 12 pitches, gap 0.16, 3.2 s → unchanged.
- *leaves a two-pitch tremolo over a whole chunk* → unchanged.
- *leaves an irregular chord*: gaps 0.09–0.3 → unchanged.
- *leaves a chord that is under 85 % of the chunk's ticks* → unchanged.

Pass 3:
- *drops a note in digital silence*: −120 dB → gone, `silent` 1.
- *keeps a quiet note*: −55 dB → stays.
- *looks at the note's first 0.4 s*: −120 at the start, −30 at 0.2 s → stays.

Pass 4:
- *moves viola above A5 to violin, keeps A5*: 82 → Violin, 81 stays, `moved['Viola>Violin']` 1.
- *moves cello above 76*: 77 → Viola; 82 → Violin.
- *moves contrabass above 62 to cello*, *violin below G3 to viola*, *viola below C3 to cello*, *cello below C2 to
  contrabass*.
- *moves only onto a lane that has rows*: no Contrabass rows → cello 35 stays.
- *does not touch other lanes*: Pipe at 100, Bassoon at 33 stay.

Pass 5:
- *a note moved onto a lane already playing it sounds once*: Viola 85 and Violin 85 at one start → one Violin row.

Pass 6:
- *drops the barking dog's doubling from the wrong lane*: Violin core 65–87, Viola median 60, C4 on both → the Violin row
  goes, `stringDupes` counted.
- *keeps a unison inside both cores* → both stay.
- *leaves an octave doubling alone*: cello 48, contrabass 36 → both stay.

Pass 7:
- *drops a clarinet copying an exposed oboe solo*: 6 notes at 76, no strings, Oboe median 74, Clarinet median 68 → the
  Clarinet run goes, `windDupes` 6.
- *keeps the doubling in a tutti*: the same with 30 string attacks/s → both stay.
- *keeps three coincidences* → both stay.
- *does not dedupe a wind against a string* → both stay.

Pass 8:
- *merges a drone chopped into long notes*: `[0, 7.3] [7.3, 10.7] [10.7, 14.8]` → `[0, 14.8]`, `merged` 2.
- *merges a 0.6 s pair only with no onset at the join*: an onset at the join → 2 rows; none → 1.
- *does not merge a gap of 0.03 s*.
- *does not merge across lanes or pitches*.

`cleanWarning`:
- *names each count it has and no zero ones*: `pastEnd` 148, `merged` 12 → contains "148 past the end" and "12", not
  "silence".

- [ ] Write the failing tests; run `npx vitest run tests/clean-tracks.test.ts` and see them fail.
- [ ] Implement until they pass; `npm run typecheck`; `npm test`.
- [ ] **Look (not CI):** run `cleanTracks` from a scratch script under `S/mo/T1/` on the five
      `songs/<id>/notes.muscriptor-large.json` (their snake names mapped by hand there, as T2 is not in yet; levels and
      onsets from `S/mo/plan/*.cal.json`). Each count should be within about 10 % of the dry run below. A big difference
      is a bug in one of the two: find out which, and say so.

| Song | Notes in → out | Past end | Stuck chunks (quiet) | Stuck dropped / collapsed | Silent | Moved | Lane / string / wind dupes | Merged |
|---|---|---|---|---|---|---|---|---|
| `beethoven5` | 10715 → 10350 | 0 | 0 | 0 / 0 | 0 | 24 | 18 / 173 / 69 | 105 |
| `vivaldi-autumn` | 8411 → 7567 | 148 | 2 (1): 420, 430 s | 252 / 126 | 20 | 8 | 10 / 164 / 0 | 124 |
| `vivaldi-spring` | 6272 → 5783 | 0 | 1 (0): 390 s | 0 / 175 | 0 | 41 | 22 / 110 / 0 | 182 |
| `vivaldi-winter` | 7605 → 7364 | 0 | 0 | 0 / 0 | 6 | 269 | 33 / 94 / 0 | 108 |
| `vivaldi-four-seasons` | 30481 → 27824 | 0 | 7 (2): 995, 1060, 1075, 1960, 2090, 2095, 2100 s | 440 / 967 | 137 | 98 | 27 / 804 / 0 | 282 |

Beethoven's string lanes should lose under 7 % each (cello 6.8 %, viola 4.3 %, violin 2.8 %, contrabass 0.8 %).

- [ ] Commit: `Ingest: a pure cleanup pass for MuScriptor's notes …` (`git add` the two files).

---

## T2: the runner

**Files:** create `scripts/ears/muscriptor.py`, `scripts/ears/requirements-muscriptor.txt`, `scripts/node/muscriptor.ts`,
`scripts/setup-muscriptor.ts`, `src/studio/pack/muscriptor.ts`, `tests/muscriptor-names.test.ts`,
`tests/muscriptor-config.test.ts`. Modify `package.json` (script `setup-muscriptor`), `tsconfig.scripts.json`.

**The Python contract, which T3's stub relies on:**

```
python -I muscriptor.py <audio> <out.json> [--model large] [--instruments a,b,c] [--device auto|cuda|cpu] [--dtype float32|bfloat16]
python -I muscriptor.py --probe [--fetch] [--model large]
```

- `<out.json>` is always the **second positional**.
- It writes `{version: 1, model: 'muscriptor-large', package: '0.4.0', instruments: [...] | null, dtype, device, seconds,
  notes: [[start, end, midi, 100, 'violin'], ...]}`, sorted by (start, midi), times rounded to 3 places.
- **Velocity is the number 100.** `okRow` and `cleanRows` reject null or 0, so every note would silently vanish.
- Names are MuScriptor's own. The script maps nothing.
- It calls `TranscriptionModel.load_model(weights_path=model, device=, dtype=)` and iterates
  `model.transcribe(audio_path, instruments=list)`: `NoteStartEvent` and `NoteEndEvent` make rows, `ProgressEvent(completed,
  total)` prints `progress <0..1> <completed>/<total>` on stderr. Library prints go to stderr, stdout stays clean.
- `--probe` prints `{"ok": true, "device": "cuda", "version": "0.4.0", "weights": "cached" | "absent"}` or `{"ok": false,
  "reason": ...}`, without loading the model (`huggingface_hub.try_to_load_from_cache('MuScriptor/muscriptor-large',
  'model.safetensors')`). `--fetch` downloads the weights first.
- Exit codes as `ymt3.py`: 2 usage, 3 missing package or weights, 4 undecodable audio, 1 otherwise.

**`src/studio/pack/muscriptor.ts`, pure:**

```ts
export const MS_CLASS: Readonly<Record<string, string>>;
export const MS_PRESETS: { strings: string[]; baroque: string[]; classical: string[] };
export type MsPreset = keyof typeof MS_PRESETS;
export function resolveInstruments(arg: string): { list: string[]; preset: MsPreset | null } | { why: string };
export function mapMsRows(rows: readonly unknown[]): { rows: Ymt3Row[]; unknown: string[] };
export function listKey(list: readonly string[]): string;     // FNV-1a, 8 hex, order matters (the list is kept in the order given)
export const hasKeyboard: (list: readonly string[]) => boolean;   // acoustic_piano or electric_piano
export function guessPreset(lanes: readonly string[]): MsPreset;  // any wind → classical, else baroque (the dialog's default)
export const LOOP_ZERO_SHARE = 0.05, LOOP_BURST_SHARE = 0.15, LOOP_BURST_STARTS = 30, LOOP_BURST_REGULAR = 0.9, LOOP_BURST_TOL_S = 0.02;
export function loopCheck(rows: readonly (readonly unknown[])[]): { ok: boolean; zeroShare: number; burstShare: number; why?: string };
```

- `MS_CLASS` has all 34 names; only these differ in more than spelling: `flutes` → `Pipe`, `voice` → `Singing Voice`,
  `soprano_and_alto_sax` → `Soprano/Alto Sax`, `drums` → `Drums`. The rest are title-cased with spaces (`french_horn` →
  `French Horn`, `string_ensemble` → `String Ensemble`). This is the only map: fresh runs and overnight files both go
  through `mapMsRows`, which also accepts names already mapped (the cache) and turns a null velocity into 100.
- `MS_PRESETS`, from `mkjobs.py` and `night.py`: `strings` = `violin, viola, cello, contrabass`; `baroque` = strings +
  `acoustic_piano`; `classical` = strings + `flutes, oboe, clarinet, bassoon, french_horn, trumpet, timpani`.
- `resolveInstruments` takes a preset name or a comma list of exact names, in the order given. It refuses
  `string_ensemble` (it swallowed Vivaldi's violins from 12 to 36 s), unknown names and an empty list, saying why.
- `loopCheck` fails when the zero-length share reaches `LOOP_ZERO_SHARE`, or when the share of non-empty 5 s chunks with
  a (class, pitch) started at least `LOOP_BURST_STARTS` times at a regular rate reaches `LOOP_BURST_SHARE`.
  **The zero-length test is the one with a real margin:** Rite on medium is 0.49, every large run 0.000. Burst share is
  weak: Rite on medium 0.167, while large reaches 0.083 on a 12-chunk clip and 0.048 on a whole piece. The stuck chunks
  in large runs are T1's job, not a reason to throw 20 minutes away.

**`scripts/node/muscriptor.ts`,** modelled on `scripts/node/ymt3.ts`:

```ts
export const MUSCRIPTOR_PY: string; export const MS_SETUP_HINT = 'npm run setup-muscriptor';
export interface MsConfig { python: string; model: 'large'; version: string; installed: string }
export function defaultMsDir(): string;     // %LOCALAPPDATA%/WinkelAmp/muscriptor
export function msConfigPath(): string;     // WINKELAMP_MUSCRIPTOR (a muscriptor.json or its folder), else the default
export function findMuscriptor(): { config: MsConfig } | { missing: string };
export function probeMsWith(c: Pick<MsConfig, 'python'>, o?: { timeoutMs?: number; fetch?: boolean }): Promise<ToolStatus & { device?: string; version?: string; weights?: string }>;
export function probeMuscriptor(): Promise<ToolStatus>;   // not ok when the weights are absent, naming MS_SETUP_HINT
export function runMuscriptor(audio: string, out: string, o: { instruments: readonly string[]; dtype?: 'float32' | 'bfloat16' },
  onProgress?: (f: number, done: number, total: number) => void): Promise<void>;
```

`runMuscriptor` sets `HF_HUB_OFFLINE=1`. It retries once in `bfloat16` when the stderr matches `/out of memory/i`
(large fills a 16 GB card); the output's `dtype` says which ran. It rejects with the stderr tail.

**`scripts/setup-muscriptor.ts`:** `npm run setup-muscriptor -- [--python <exe>] [--dir <install>] [--download]`.
Default python `C:/Users/maxim/.venvs/wa-ms/Scripts/python.exe`. It probes, with `--download` fetches, and writes
`muscriptor.json` only after a good probe. Absent weights without `--download` is exit 1, naming `hf auth login` and
`--download` (5.5 GB). **It always prints the licence:** the weights are CC-BY-NC, so own shows and experiments are
fine, and selling WinkelAmp with it, or renders made from its notes, needs a commercial licence.
`requirements-muscriptor.txt` follows `requirements-ymt3.txt`: `muscriptor==0.4.0`, torch 2.11.0 from the cu128 index.

**Named tests, `tests/muscriptor-names.test.ts`:**

- *maps all 34 names*: `Object.keys(MS_CLASS).length` 34. `trackOf(MS_CLASS.flutes)` = `flute`, `.voice` = `voice`,
  `.string_ensemble` = `strings`, `.soprano_and_alto_sax` = `saxophone`, `.tuba` = `trombone`, `.contrabass` =
  `contrabass`, `.acoustic_piano` = `piano`; `.organ`, `.synth_lead`, `.drums` = null.
- *resolves the presets to the tested lists*: exact arrays, in order, for all three.
- *takes an own list*: `'violin, viola'` → `['violin', 'viola']`, preset null.
- *refuses string_ensemble, an unknown name and an empty list, saying why*: each `why` names the problem.
- *maps overnight rows and cache rows alike*: `[1, 2, 60, 100, 'french_horn']` and `[1, 2, 60, 100, 'French Horn']` →
  the same row.
- *turns a null velocity into 100*: the row survives `cleanRows`.
- *reports an unknown name*: `unknown` holds it.
- *keys a list by its order*: `listKey(a)` stable and 8 hex; `listKey(['a','b'])` ≠ `listKey(['b','a'])`.
- *guesses the dialog's preset*: `['violin','oboe']` → `classical`; `['violin','cello']` → `baroque`.
- *fails half zero-length notes*: `ok` false, `why` names the share.
- *fails a burst in 3 of 18 chunks*: `ok` false.
- *passes one stuck chunk in 18*: `ok` true (the shape of a good large run).

**`tests/muscriptor-config.test.ts`,** the pattern of `tests/ymt3-config.test.ts`:

- *says it is not set up, naming the hint*: no config → `missing` contains `npm run setup-muscriptor`.
- *finds a good config through WINKELAMP_MUSCRIPTOR*, as a folder and as a file.
- *names what a bad config lacks*: invalid JSON, a missing key, a python that is not there.
- *reports chunks from the progress lines*: a Node stub prints `progress 0.5 61/122` → `onProgress(0.5, 61, 122)`.
- *retries once in bfloat16 on out of memory*: the stub fails first with "CUDA out of memory" → two runs, the second with
  `--dtype bfloat16`.
- *does not retry another failure*: one run, rejected with the stderr tail.

- [ ] Write the failing tests; implement; `npx vitest run tests/muscriptor-names.test.ts tests/muscriptor-config.test.ts`.
- [ ] `npm run setup-muscriptor`: the probe says cuda and cached, and the licence is printed.
- [ ] **Look (real run, a 10 s clip):** `runMuscriptor` on `S/ms/clips/smoke10.wav` with the `strings` list. Check every
      velocity is 100, the names are snake_case, the row count is near `muscriptor transcribe <clip> --model large -f json
      --instruments …` run the same way, and `import muscriptor` did not find our script.
- [ ] `npm run typecheck`; `npm test`; commit: `Ingest: MuScriptor runner, setup, name map, presets and loop check …`.

---

## T3: ingest

**Files:** modify `scripts/ingest.ts`, `src/studio/pack/pack.ts`, `src/studio/pack/build.ts`,
`src/studio/pack/muscriptor.ts`, `src/studio/ingest/progress.ts`, `scripts/describe-song.ts`, `src/studio/ui/panel.ts`
and `src/studio/ui/library.ts` (new table entries only), `src/studio/ui/style.css` (the badge),
`tests/ingest-v2.test.ts`, `tests/pack-v2.test.ts`, `tests/ears-progress.test.ts`.

**Flags.** `--instruments-model ymt3|muscriptor` (default `ymt3`), `--instruments <preset|list>`, `--muscriptor-notes
<file>` (implies the model), and `muscriptor` in `--redo`. Exit 2 for:

- the model without `--instruments` ("without a list it hears Vivaldi's strings as guitars");
- `--instruments` without the model;
- what `resolveInstruments` refuses;
- `--kind piano` with the model;
- `--notes` other than `auto` or `hybrid` with the model;
- a `--muscriptor-notes` file that is missing, unreadable, or has names `mapMsRows` does not know.

**`pack.ts`.**

```ts
export type NotesSource = … | 'ms-hybrid';   // piano model + MuScriptor (with the keyboard lane) in its gaps
Track.from?: 'ymt3' | 'muscriptor';          // absent = YourMT3+: old packs, and every pack made without the option
transcribers?: { name: 'piano' | 'ymt3' | 'bp' | 'muscriptor'; model; seconds; notes; instruments?: string[] }[];
```

`validatePack` accepts these and rejects, naming the field: `tracks.x.from` of another value, an unknown transcriber
name, an `instruments` that is not a list of strings.

**`build.ts`.** `BuildInput.muscriptor?: { rows: Ymt3Row[]; levels: number[]; model: string; seconds: number; instruments:
string[]; keyboard: 'ymt3' | 'muscriptor' | null } | null`. In `buildPack`:

- `const y = i.muscriptor ?? i.ymt3 ?? null`.
- `notesFrom` is `'ms-hybrid'` where it would be `hybrid` or `ymt3`.
- `transcribers` lists YourMT3+ with its **own** cleaned count (unchanged for a pack without the option) and MuScriptor
  with its list.
- Each track gets `from`, only when `i.muscriptor` is set: `piano` is `'ymt3'` when `keyboard === 'ymt3'`, all others
  `'muscriptor'`.

**`src/studio/pack/muscriptor.ts`** gains:

```ts
export function mergeKeyboard(ms: readonly Ymt3Row[], ymt3: readonly Ymt3Row[] | null, list: readonly string[]):
  { rows: Ymt3Row[]; keyboard: 'ymt3' | 'muscriptor' | null };
```

No keyboard in the list: the rows as they are, `null`. With YourMT3+: drop rows with `trackOf === 'piano'`, add
YourMT3's, `'ymt3'`. Without YourMT3+: the rows as they are, `'muscriptor'`, and ingest warns.

**`scripts/ingest.ts`, in order** (the header comment and `USAGE` say all of it):

1. **Up to date.** Only when the pack was made the way this run asks: `old.transcribers` has `muscriptor` with the same
   `instruments`. Without the option, an existing pack of the same recording stays up to date as it is today.
2. YourMT3+ runs as today (it may be cached): the keyboard lane, and the fallback.
3. **MuScriptor block, after it.** The cache is `songs/<id>/notes.muscriptor-<listKey>.json`:
   `{version: 1, sha1, model, package, instruments, dtype, seconds, notes}`, rows mapped and **uncleaned**. It is valid on
   sha1, model and list, and on package when an install is found (the YourMT3+ rule). `--muscriptor-notes` reads the file
   instead of running, and writes this cache bound to the current sha1, with `package` set to the installed config's
   `version`, or `0.4.0` with no install (the version that made all five overnight files, which carry no such field), so
   the imported cache is never stale on the next run. A failing loop check is cached too, since greedy
   decoding repeats itself; `--redo muscriptor` runs it again.
4. **Fallback,** never an exit 3, and `pack.quality.warnings` says so:
   - `MuScriptor is not set up (npm run setup-muscriptor): the tracks come from YourMT3+`
   - `MuScriptor failed (<first line>): the tracks come from YourMT3+`
   - `MuScriptor's output looks stuck (<why>): the tracks come from YourMT3+`
5. With MuScriptor's rows in hand, basic-pitch does not run as a fallback.
6. **Analysis runs next** (as today, after the instruments), **because the cleanup needs its onsets.** After `analyzeSong`:
   `cleanTracks({ rows, duration: analysis.duration, levels: frameDb(pcm, SR), onsets: analysis.onsets.map((o) => o.t) })`,
   `mergeKeyboard`, `onsetLevels` on the result, `buildPack`. Velocities come from `estimateVelocities` as for YourMT3+.
   `cleanWarning` goes into the warnings, and when the keyboard stayed MuScriptor's: `no keyboard lane from YourMT3+: the
   piano track is MuScriptor's, which barely finds a harpsichord`.
7. `kind` is `ensemble` for the whole of a `--instruments-model muscriptor` run, the fallback included.

**`progress.ts`.** `stageWeights` takes `long?: boolean`. A real MuScriptor run (no cache) weighs `{decode: .01,
transcribe: .05, instruments: .85, analyze: .07, write: .02}`, with YourMT3+ the first 15 % of `instruments`.
`etaWords(done, total, elapsedS)` gives `about 12 min left`. The stage message is `MuScriptor: 34 of 122 chunks, about
12 min left`.

**`describe-song.ts`.** The `from` table gains `ms-hybrid`. A line says `instrument tracks: MuScriptor large (violin,
viola, …), keyboard: YourMT3+`, and "YourMT3+'s" in the tracks section reads the actual transcriber.
**`panel.ts`, `library.ts`:** the `ms-hybrid` entries of `NOTES_WORDS` and `NOTES_BADGE`, nothing else.

**Named tests, `tests/ingest-v2.test.ts`** (the same stub: `STUB_MUSCRIPTOR`, `muscriptor` in `count()`, a `muscriptor.json`
whose python is the stub through `WINKELAMP_MUSCRIPTOR`):

- *takes the tracks from MuScriptor and the keyboard from YourMT3+*: `baroque` → `kind` ensemble, `notesFrom` `ms-hybrid`,
  `tracks.violin.from` `muscriptor`, `tracks.piano.from` `ymt3`, the MuScriptor transcriber lists the list, YourMT3+ is
  listed too, `validatePack` empty.
- *gives no keyboard lane without one in the list*: `strings`, YourMT3+ hearing piano → `tracks.piano` undefined.
- *drops MuScriptor's own piano rows for YourMT3+'s*: the piano track's notes are YourMT3's.
- *keeps MuScriptor's piano when YourMT3+ is missing, and says so*: `tracks.piano.from` `muscriptor`, the warning there.
- *refuses without a list, with --kind piano, with --notes gpu, with string_ensemble, and --instruments alone*: each
  exit 2, each message naming it.
- *caches by audio, model and list*: a second `--force` run leaves `count().muscriptor` the same; another list runs again
  and two `notes.muscriptor-*.json` exist; `--redo muscriptor` runs again.
- *imports an overnight file and never runs the model*: `{model, notes, instruments: {violin: 12}, zeroLength: 0}` →
  `count().muscriptor` unchanged, the cache written with the audio's sha1 and `package` = the stub config's `version`, and the next plain run reads it.
- *an imported row with velocity null counts*: the track is not empty.
- *refuses an import with an unknown name*: exit 2, naming it.
- *falls back when it is not set up, when it fails, and when it looks stuck*: exit 0 each, `notesFrom` `hybrid`, no
  `Track.from`, no `muscriptor` transcriber, the warning starting `MuScriptor`, `kind` ensemble.
- *says what the cleanup did*: a row past the end → a warning starting `cleaned MuScriptor's notes:`.
- *is up to date only for the same list*: the same flags again → no build; another list → a build.
- *leaves a pack without the option alone*: no `from` on any track, no `muscriptor` transcriber, `notesFrom` `hybrid`.
- *progress never decreases on a long run, and the message counts chunks*.
- *describe-song names MuScriptor and the list*.

**`tests/pack-v2.test.ts`:**

- *accepts ms-hybrid, Track.from and a transcriber's instruments*.
- *rejects a wrong from, an unknown transcriber, a bad instruments list*, naming the field.
- *buildPack without muscriptor stays as it was*: every existing test in the file passes unedited, and an ensemble
  fixture has no `from` key on any track.
- *buildPack with muscriptor counts YourMT3+ by its own rows*.
- `mergeKeyboard`: *its three cases*.

**`tests/ears-progress.test.ts`:** *weighs a long run towards the instruments* and *words the time left*.

- [ ] Write the failing tests; implement; `npx vitest run tests/ingest-v2.test.ts tests/pack-v2.test.ts tests/ears-progress.test.ts`.
- [ ] `npm run typecheck`; `npm test`; `npm run fidelity`, which must be unchanged.
- [ ] **Look (real files, on copies):** copy the five songs to `S/mo/T3/songs` and with `WINKELAMP_SONGS` set, run the
      commands in T4's overnight table. Run `npm run describe-song` on each. Draw and **look at**, with `npm run pianoroll
      -- <id> --by track --from … --to … --out renders/look/T3/<name>.png`:
      Winter 130–180 s (violin above A5, viola below), Autumn 420–436 s (no strobing chords, nothing in the silence),
      Spring 220–330 s (the C4 on one lane where doubled, drones whole), Four Seasons 1955–1966 s (nothing in the digital
      silence), Beethoven 0–60 s (strings as they were). Say what each shows. Also check `tracks.piano` is YourMT3's on
      Spring and absent on Beethoven.
- [ ] Commit: `Ingest: MuScriptor as an option for the instrument tracks …`.

---

## T4: studio and docs

**Files:** create `src/studio/ingest/transcribe-options.ts`, `src/studio/ui/redo-dialog.ts`,
`tests/transcribe-options.test.ts`, `scripts/checks/redo-check.mjs`. Modify `src/studio/ingest/ears-types.ts`,
`src/studio/ingest/ears-client.ts`, `scripts/ears/server.ts`, `src/studio/ui/add-song.ts`, `src/studio/ui/panel.ts`,
`src/studio/ui/main.ts`, `src/studio/ui/style.css`, `tests/ears-server.test.ts`, `package.json` (script `redo-check`),
`README.md`, `docs/COMPOSING-SHOWS.md`, `docs/HANDOFF.md`.

**`transcribe-options.ts`, pure and browser-safe:**

```ts
export const YMT3_RATE = [0.15, 0.25], MS_RATE = [0.7, 1.8];   // × the music's length; measured, a shared GPU
export type RedoChoice = { engine: 'ymt3' } | { engine: 'muscriptor'; instruments: string; overnight?: boolean };
/** "about 2 to 3 min", "8 to 22 min on the GPU", "under a minute (saved)". */
export function estimateWords(engine: 'ymt3' | 'muscriptor', duration: number, saved: boolean): string;
export function redoQuery(id: string, c: RedoChoice): string;
```

**`ears-types.ts`.**

```ts
EarsHealth.muscriptor?: ToolStatus;   // api stays 2 (ruling 10)
export interface TranscribeChoices {
  duration: number;
  tracksFrom: 'ymt3' | 'muscriptor' | null;
  instruments: string[] | null;
  ymt3: ToolStatus; muscriptor: ToolStatus;
  ymt3Saved: boolean;
  saved: { key: string; instruments: string[]; notes: number; seconds: number }[];   // only files matching ^notes.muscriptor-[0-9a-f]{8}.json$, of this sha1
  overnight: { lanes: string[]; notes: number; preset: MsPreset } | null;            // notes.muscriptor-large.json, with guessPreset
}
```

**`scripts/ears/server.ts`.**

- `EarsOptions.probeMuscriptor`; `/health` carries it (probed alongside, never waited for); `main()` logs it.
- `GET /songs/<id>/transcriptions` → `TranscribeChoices`; 400 for a bad id, 404 for no such song.
- `POST /ingest?id=<slug>&redo=1&engine=ymt3|muscriptor&instruments=<preset|list>[&overnight=1]`. `engine=muscriptor`
  without a list `resolveInstruments` accepts is 400 with its reason. `Work` gains `extra: string[]`, which `attempt`
  adds to the arguments: `--instruments-model muscriptor --instruments <x>`, plus `--muscriptor-notes <the file>` when
  `overnight=1` (404 without the file).
- The approximate retry after exit 3 does **not** carry `extra` (`--notes approx` with the model is exit 2).
- A second request for a busy song answers with its job, as today. That is how a reopened page follows a long run.
- `redo=1` with no `engine` stays exactly as it is.

**`ears-client.ts`.** `reingestViaEars(id, onJob, choice?)`; `transcribeChoices(id): Promise<TranscribeChoices | null>`.

**`redo-dialog.ts`.** `openRedoDialog(d: { song: SongPack; choices: TranscribeChoices; onStart(c: RedoChoice): void }):
void`, a native `<dialog>`:

- **YourMT3+**, the default: "for any music", and `estimateWords('ymt3', …)`.
- **MuScriptor large**: "better for string-led orchestral pieces", `estimateWords('muscriptor', …)`, "the GPU stays busy
  until it is done", "non-commercial licence". Disabled with `choices.muscriptor.reason` beside it when it cannot run.
- With MuScriptor, **a list is required**: Strings, Baroque strings and harpsichord, Classical orchestra, or an own list
  (a text field, checked by `resolveInstruments` as typed). Start stays disabled until it is valid. A saved result for
  the chosen list says "under a minute (saved)".
- `overnight` non-null: a checkbox "Use the saved overnight notes (violin, viola, …; N notes)", on by default, with the
  list preset to `overnight.preset`.
- The dialog says which transcriber made the current tracks.

**`panel.ts`, `main.ts`.** `Deps` gains `redoTranscription(): void`. A "Redo the transcription…" button beside the Notes
fact in the Show tab, only when `api.writable`. Without an ears server the notice says to start `npm run ears`. The
approximate-notes notice stays as it is.

**`add-song.ts`.**

- `reingest(id, name, choice?)`.
- During `instruments`, the progress line shows the job's own message (chunks, time left).
- A MuScriptor run ends in the "Reopen" notice even with no unsaved edits: a job that took 20 minutes must not reload
  the page under someone playing the song.
- Add `^MuScriptor` to `TOOL_WARNING`. The cleanup line starts `cleaned`, so it does not match.
- Fix the regex's `^YourMT3+ failed`, which never matches (the `+`): `^YourMT3\+ failed`.

**Named tests, `tests/transcribe-options.test.ts`:**

- *states the time for a 12-minute piece*: 720 s → YourMT3+ `about 2 to 3 min`, MuScriptor `8 to 22 min on the GPU`.
- *says when it is saved*: `under a minute (saved)`.
- *builds the query*: `redoQuery('a', {engine:'muscriptor', instruments:'violin, viola'})` is encoded and has `redo=1`;
  `{engine:'ymt3'}` has `engine=ymt3`.

**`tests/ears-server.test.ts`** (a fake `probeMuscriptor`):

- *reports MuScriptor in /health and stays api 2*.
- *passes the engine and list to ingest*: args contain `--instruments-model muscriptor`, `--instruments baroque`, `--force`.
- *refuses MuScriptor without a usable list*: 400 for none and for `string_ensemble`, no job.
- *imports the overnight file with overnight=1*: args contain `--muscriptor-notes` and the path; 404 without the file.
- *does not carry the MuScriptor flags into the approximate retry*.
- *lists the choices of a song*: a fixture folder with a cache and an overnight file → `saved` and `overnight` filled,
  `ymt3Saved` by sha1; 404 for an unknown song.
- *a redo with no engine runs as before*: the existing test unchanged.

**`scripts/checks/redo-check.mjs`** (`npm run redo-check`; own Vite from 5190, `startEars` with a fake ingest on port 0,
`/?song=<id>&ears=<port>`, a temp songs folder). It asserts:

- the button shows; the dialog states both durations for the song;
- Start is off with MuScriptor and no list, on with a preset;
- a probe that is not ok disables MuScriptor and shows why;
- Start's POST carries the choice, and the progress line shows the fake's chunk message;
- the finished run ends in the Reopen notice, not a reload.

It writes `renders/look/T4/redo-dialog.png`.

**Docs.**

- **`README.md`,** "Instrument tracks": a MuScriptor section with setup, the flags, what it is for ("string-led orchestral
  pieces; big brass and percussion pieces: the list can hurt"), the durations, the memory (up to 15 GB), the **licence**,
  the fallback, and the overnight table below. The `--redo` line and the `npm run` list.
- **`docs/COMPOSING-SHOWS.md`,** "Honest instrument labels": tracks may come from MuScriptor (`describe-song` says), with
  the limits listed under the Rulings, in those words.
- **`docs/HANDOFF.md`,** at the top: what was added, nothing merged, the Rulings' residues, the checks run, and that the
  real packs change only when the commands below are run.

**The overnight table, for the README** (lists from `night.py`, so nobody re-runs 2 hours of GPU):

```bash
npm run ingest -- songs/vivaldi-winter/audio.mp3 --id vivaldi-winter --muscriptor-notes songs/vivaldi-winter/notes.muscriptor-large.json --instruments baroque
npm run ingest -- songs/vivaldi-spring/audio.mp3 --id vivaldi-spring --muscriptor-notes songs/vivaldi-spring/notes.muscriptor-large.json --instruments baroque
npm run ingest -- songs/vivaldi-autumn/audio.mp3 --id vivaldi-autumn --muscriptor-notes songs/vivaldi-autumn/notes.muscriptor-large.json --instruments baroque
npm run ingest -- songs/vivaldi-four-seasons/audio.mp3 --id vivaldi-four-seasons --muscriptor-notes songs/vivaldi-four-seasons/notes.muscriptor-large.json --instruments baroque
npm run ingest -- songs/beethoven5/audio.mp3 --id beethoven5 --muscriptor-notes songs/beethoven5/notes.muscriptor-large.json --instruments classical --piano-notes lab/notes-b5.js
```

Beethoven's pack took its piano notes from the lab's file, so its command keeps `--piano-notes`. Without it, the
all-notes would quietly become `notes.gpu.json`'s. `lab/notes-b5.js` is the likely file (HANDOFF does not name it):
T3's Look checks that the all-notes match the current pack before this goes in the README.

- [ ] Write the failing tests; implement; `npx vitest run tests/transcribe-options.test.ts tests/ears-server.test.ts`.
- [ ] `npm run typecheck`; `npm test`; `npm run redo-check`; `npm run studio-check`.
- [ ] **Look:** `renders/look/T4/redo-dialog.png`, at a normal and a short window: both durations legible, the licence
      seen before Start, nothing cropped.
- [ ] Commit: `Studio: choose the transcriber when redoing a song, with the time it takes …`; `Docs: …` for the docs.
