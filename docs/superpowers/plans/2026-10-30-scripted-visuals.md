# Scripted Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn WinkelAmp into a "lighting designer who studied the song": a stage of elements that follow the melody,
bass, harmony and beat, entering and leaving per a script Claude composes ahead of time (or per live rules), driven
entirely by a music clock, with a near-knobless interface.

**Architecture:** Analysis (existing PCM → FFT → Features → Descriptors chain, plus new melody / structure /
fingerprint modules) feeds a **feed** that produces per-frame musical streams, either live or from precomputed
`SongData`. A **ScriptPlayer** (pure function of song time) or a **LiveDirector** turns that into
`StageDirectives` (look + cast + accents). A WebGL2 **Stage** composites one instance per cast member (melody
thread, bass masses, sparks, chord bloom, pulse, wave, fluid = the Living Canvas) on a **MusicClock**. Offline,
`npm run study` writes a study pack + `corpus/<id>.data.json`; Claude writes `corpus/<id>.json`.

**Tech Stack:** Vite 8, TypeScript (strict), vitest, WebGL2, Web Audio (AudioWorklet), Node 22 + tsx for scripts,
ffmpeg for decoding/spectrograms, Playwright with system Chrome for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-30-scripted-visuals-design.md` (read it first; it carries the why).
Background: `docs/CHARACTER-PLAN.md`, contracts in `src/character/types.ts`.

## Global Constraints

- No framework, no new npm dependencies, no Python. Strict TS; match the existing concise style (small doc comments
  explaining WHY).
- Nothing on screen moves on wall-clock time: all element animation uses `MusicClock.time` and audio features.
  Exceptions: pointer painting, MIDI keys, and transitions triggered by a musical event (complete in ≤ 2 s wall time).
- Silence: picture freezes; after ~1 s of silence it dims to a faint afterimage over a few seconds; recovers with sound.
- Live scene changes: minimum gap 15 s; hard cut on a real bass drop, blend otherwise; section changes (novelty) are
  the primary trigger, drops secondary (target music is solo piano / classical, e.g. Rachmaninoff Piano Concerto 2).
- Scripted cues land within ~50 ms of the music after seek/pause; cue times snap to the nearest onset/beat within
  120 ms unless `snap: false`.
- Default UI: transport, volume, one Calm ↔ Wild slider (`look.wild`), a Scripted/Live badge with mood words.
  Everything else in a closed "Tweak" drawer. Existing localStorage keys (`winkelamp.looks.v1`,
  `winkelamp.current.v1`, MIDI bindings) keep working.
- One analysis code path: offline data is produced by the same classes as live analysis (`AnalysisChain`), plus
  offline-only post-processing.
- Reference recordings are never committed; `corpus/*.json` and `corpus/*.data.json` are committed; `study/` is
  gitignored.
- 60 fps target at 1080p on a laptop iGPU (adaptive quality); dev machine has an RTX 4080.
- Windows dev box: Playwright via `chromium.launch({ channel: 'chrome' })`; start Vite from inside Node scripts with
  `createServer` (never as a shell background job); keep scratch paths short (MAX_PATH 260).

## Review Focus

1. **Seek, pause, track change mid-script** → the picture must jump to exactly what the script says for the new
   position (no stale elements, no replayed accents). Pinned in Task 6 (`player seek determinism`) and Task 9.
2. **A different recording of the same piece, or a different song of similar length** → must NOT match a corpus
   script (fall back to Live). Pinned in Task 4 (`different music does not match`, `time-crop does not match
   full`).
3. **Very long tracks (a 12-minute concerto movement)** → study pack finishes in < 90 s and `data.json` stays
   < 2 MB; the browser fingerprint of a 12-min file takes < 3 s. Pinned in Task 4 and Task 11.
4. **Mic with room noise, or a quiet passage** → room noise is not "music": the clock stays frozen and the picture
   dims. Pinned in Task 1 (`noise floor does not drive`).
5. **No WebGL2 / context lost** → the app falls back to the Classic Canvas2D renderer with a toast instead of a
   black screen. Pinned in Task 10.

## File Structure

| File | Responsibility |
|---|---|
| `src/stage/types.ts` | All stage/script/feed contracts (Look, ElementSpec, Script, Cue, SongData, MelodyNote, MelodyFrame, StageDirectives, StageFrame, StageElement) |
| `src/stage/clock.ts` | MusicClock |
| `src/audio/melody.ts` | Melody salience, live tracker, offline extractor |
| `src/audio/structure.ts` | Novelty sections + drop detection (offline and live) |
| `src/audio/fingerprint.ts` | Recording fingerprint + matching |
| `src/stage/script.ts` | Script validation + normalisation (defaults) |
| `src/stage/player.ts` | ScriptPlayer: song time → StageDirectives (pure) |
| `src/stage/library.ts` | Built-in scenes for the live director, tagged by archetype |
| `src/stage/director.ts` | LiveDirector: streams + character → StageDirectives |
| `src/stage/feed.ts` | SongFeed: live or precomputed streams → MelodyFrame, beat, events |
| `src/stage/corpus.ts` | Bundled corpus (import.meta.glob), lookup by fingerprint or study id |
| `src/stage/stage.ts`, `src/stage/gl.ts`, `src/stage/post.ts` | WebGL2 compositor: cast lifecycle, feedback/trails, mirror, glow, accents, dim |
| `src/stage/elements/*.ts` | One file per element type |
| `scripts/study.ts`, `scripts/lib/plot.ts` | Study pack generator, PNG plots |
| `scripts/check-script.ts`, `scripts/preview-script.mjs` | Validator CLI, contact-sheet preview |
| `scripts/eval/melody-eval.ts` | Melody accuracy against study / reference ground truth |
| `docs/COMPOSING.md` | The composer's handbook (Claude's heuristics + schema reference) |
| `corpus/` | Scripts and their song data |

---

### Task 0: Land the character-engine build

**Files:** everything the character-engine workflow produced (`src/audio/{pcm,fft,descriptors,offline,instruments,studies,engine,pcm-worklet}.ts`,
`src/character/*`, `src/visual/living/*`, `living-test.html`, `scripts/{analyze-file,character-file,pcm-check,living-shots,render-studies}.*`,
`scripts/reference/*`, `tests/{descriptors,character,studies}.test.ts`).

**Interfaces:**
- Produces (used throughout): `AudioEngine` with `input: GainNode`, `pcm: PcmSource`, `descriptors: Descriptors`,
  `chain: AnalysisChain` (`chain.descriptorExtractor.debug.{onset,pitch}`); `analyzeOffline(pcm, sr, opts)`;
  `decode(file, rate)` from `scripts/analyze-file.ts`; `CharacterEngine` (`update/material/gesture/events`),
  `midiEvent(note, velocity, material)`; `LivingCanvas` (`constructor(canvas)`, `static supported()`, `resize()`,
  `render(input: LivingInput)`, `dispose()`); `STUDIES: Study[]` with `compose(seed)`/`create(ctx, dest)`.

- [ ] **Step 1:** Wait for the build workflow; read every builder and verifier report.
- [ ] **Step 2:** Run `npx tsc --noEmit` → expected: no errors. Run `npx vitest run` → expected: all pass (the earlier
  `tests/studies.test.ts` "60–90 s long … reproducible" failure must be fixed or the test corrected with a reason).
- [ ] **Step 3:** Run `npx tsx scripts/character-file.ts <ref>/hungarian5.ogg --summary` and the same for humpback,
  dnb → expected leaders fire/storm, mist, machine. Note Sugar Plum's miss (fixed by Task 2's melody register).
- [ ] **Step 4:** Read the Living Canvas screenshots in `<scratch>/shots/`; each archetype must be distinct. File any
  defect as a fix in this task.
- [ ] **Step 5:** Commit: `git add -A src scripts tests living-test.html && git commit -m "Character engine: descriptors, character + reservoir, Living Canvas, studies"`.

### Task 1: Music clock

**Files:**
- Create: `src/stage/clock.ts`, `tests/clock.test.ts`
- Modify: `src/character/reservoir.ts`, `src/character/character.ts` (motion on music time), `src/visual/renderer.ts`
  call site in `src/main.ts` (Classic scenes get `{ ...f, time: clock.time }`)

**Interfaces:**
- Produces:
  ```ts
  export interface ClockInput { level: number; onset: number /* 0..1 onset strength this frame */; flux: number /* 0..1 spectral change */; silence: number /* Descriptors.silence */; poke?: number /* 0..1 from MIDI key / pointer */ }
  export class MusicClock {
    time: number;      // seconds of music time
    drive: number;     // current rate, 0 in silence
    silentFor: number; // wall seconds since sound stopped
    dim: number;       // 1 = full brightness … DIM_FLOOR in long silence
    advance(input: ClockInput, dt: number): number; // returns music-time delta
    reset(): void;
  }
  export const DIM_FLOOR = 0.12;
  ```
  `CharacterEngine.update(d, tags, f, dt, musicDt = dt)`: reservoir oscillators and band-limited noise advance with
  `musicDt`; axis smoothing keeps using `dt`.

- [ ] **Step 1: Write the failing tests** in `tests/clock.test.ts`:
  - `silence freezes`: 5 s of `{silence: 1, level: 0}` at 60 fps → `time` unchanged, `drive === 0`.
  - `noise floor does not drive`: `{level: 0.03, onset: 0, flux: 0.02, silence: 0.9}` → `drive < 0.02`.
  - `steady drone moves slowly`: `{level: 0.8, onset: 0, flux: 0.05, silence: 0}` → `0.3 <= drive <= 0.8`.
  - `busy music moves fast`: onsets of strength 0.8 every 125 ms with `level 0.8, flux 0.5` → mean `drive >= 1.2`.
  - `monotone in activity`: drive(level .3) < drive(level .8) with everything else equal.
  - `dims after silence`: `dim === 1` at 0.9 s of silence; `dim <= 0.2` at 5 s; never below `DIM_FLOOR`.
  - `recovers`: after 10 s silence then sound, `dim >= 0.95` within 0.3 s.
  - `poke advances in silence`: `poke: 1` for one frame in silence → `time` advances.
  - In `tests/character.test.ts`: `reservoir frozen when musicDt is 0` — gesture x/y identical over 2 s with `musicDt = 0`.
- [ ] **Step 2:** `npx vitest run tests/clock.test.ts tests/character.test.ts` → FAIL (module missing / new test fails).
- [ ] **Step 3:** Implement `MusicClock` (smoothed drive: fast rise ~80 ms, slower fall ~400 ms; gate by
  `1 - smoothstep(0.6, 0.95, silence)`), and the `musicDt` parameter.
- [ ] **Step 4:** Re-run → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `"Music clock: motion advances only with the music"`.

### Task 2: Melody extraction (live and offline) with ground-truth evaluation

**Files:**
- Create: `src/audio/melody.ts`, `tests/melody.test.ts`, `scripts/eval/melody-eval.ts`
- Modify: `src/audio/studies.ts` (add `melodyVoices: string[]` to `Study`), `src/audio/offline.ts` (optional
  `melody: true` option collects salience frames), `scripts/reference/*` (export the transcribed note list as JSON
  next to the WAV, if not already), `src/character/character.ts` (use melody register for `height`/size when voiced)

**Interfaces:**
- Consumes: magnitudes per hop from `AnalysisChain` (4096-pt FFT, 60 Hz hop), `sampleRate`, `fftSize`.
- Produces (put the two data types in `src/stage/types.ts`, re-export from melody.ts):
  ```ts
  export interface MelodyNote { start: number; end: number; midi: number; strength: number; confidence: number }
  export interface MelodyFrame { pitch: number /* MIDI float, NaN when unvoiced */; voiced: boolean; salience: number; note: MelodyNote | null /* sounding now */; noteOn: boolean /* a note started this frame */ }
  export const MELODY_RANGE: [number, number] = [36, 96]; // MIDI C2..C7
  export function salience(mags: Float32Array, sampleRate: number, fftSize: number, out: Float32Array): void; // bins of 10 cents over MELODY_RANGE
  export class MelodyTracker { update(mags: Float32Array, sampleRate: number, fftSize: number, time: number): MelodyFrame; reset(): void }
  export function extractMelody(frames: Float32Array[] /* salience per hop */, fps: number): { notes: MelodyNote[]; contour: Float32Array /* MIDI per hop, NaN unvoiced */ };
  ```
- Algorithm (not determined by the signatures): spectral peaks with parabolic interpolation → harmonic summation
  salience (harmonics 1..8, weight 0.8^(h−1), magnitude compressed by `sqrt`) on 10-cent bins → per hop up to 5
  salience peaks. **Live:** pick the peak maximising `salience − 0.08·|Δsemitones from previous pitch|`, voicing =
  salience above 0.35× its 4 s running max and above an absolute floor; notes = pitch stable within ±0.6 semitone for
  ≥ 60 ms; a new note also starts on an energy onset at the same pitch (repeated notes). **Offline:** Viterbi over
  the candidate peaks for the whole piece (transition cost on semitone jumps, octave-error penalty), then contour
  voicing by comparing each contour's mean salience to the piece's distribution (Melodia-style), then the same note
  segmentation. Offline should beat live; both are reported.

- [ ] **Step 1: Write the failing tests** in `tests/melody.test.ts` (synthetic audio through `analyzeOffline`):
  - `follows a melody over accompaniment`: harmonic-tone melody (6 partials, MIDI 67–79, 8th notes at 100 BPM) at
    0 dB over a sustained triad pad at −9 dB and a bass at −6 dB → offline voiced frames with pitch within ±0.5
    semitone of truth ≥ 85 %; live ≥ 75 %.
  - `top line is not always the melody`: melody in the middle (MIDI 60–67, loud) with quiet high arpeggios (MIDI 84+,
    −12 dB) → offline accuracy ≥ 75 %.
  - `unvoiced on drums`: noise bursts + kick only → voiced ratio ≤ 10 %.
  - `note segmentation`: onset F1 ≥ 0.8 at ±50 ms, repeated same-pitch notes counted separately.
  - `stable under silence`: no NaN in salience; `voiced === false`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `melody.ts`; add `melodyVoices` to each study (e.g. Basalt's right-hand chord top voice,
  Sugar Glass's celesta, Ember's violin line, Mist's top pad line — pick from the actual voice names in studies.ts).
- [ ] **Step 4:** Re-run → PASS.
- [ ] **Step 5:** Implement `scripts/eval/melody-eval.ts`: `npx tsx scripts/eval/melody-eval.ts` renders/reads the
  four study WAVs (pinned seeds, via `scripts/render-studies.mjs` output) and the Rachmaninoff reference with its note
  JSON, prints per piece: raw pitch accuracy, raw chroma accuracy, voicing recall / false alarm, note onset F1, for
  live and offline. Target: offline raw chroma accuracy ≥ 0.70 averaged over the four studies + reference. Iterate
  on the algorithm until met, or record the honest numbers in the commit message if a piece cannot reach it.
- [ ] **Step 6:** Character: when the melody is voiced, `SoundEvent.height` and the size axis use the melody pitch
  (fixes "Sugar Plum reads lament" — re-run `scripts/character-file.ts` on sugarplum and report the new blend).
- [ ] **Step 7:** Commit `"Melody: predominant-line tracker (live + offline Viterbi), evaluated on studies"`.

### Task 3: Structure — sections and drops

**Files:** Create `src/audio/structure.ts`, `tests/structure.test.ts`.

**Interfaces:**
- Produces (types in `src/stage/types.ts`):
  ```ts
  export interface Section { start: number; end: number; novelty: number /* 0..1 strength of the boundary at start */ }
  export interface Drop { time: number; strength: number /* 0..1 */ }
  export function segment(rows: StructureRow[], hop: number, opts?: { minSection?: number /* default 6 s */ }): Section[];
  export function findDrops(bass: Float32Array, hop: number): Drop[];
  export interface StructureRow { chroma: number[] /* 12 */; loudness: number; register: number; brightness: number; onsetRate: number; sustain: number }
  export class ChangeDetector { constructor(opts?: { minGap?: number /* default 15 s */ }); update(row: StructureRow, bass: number, time: number): { kind: 'section' | 'drop'; strength: number } | null; reset(): void }
  ```
- Algorithm: rows at 2 Hz, z-normalised per dimension; cosine self-similarity; Foote checkerboard novelty with an 8 s
  Gaussian-tapered kernel; peaks above mean + 1·sd with ≥ `minSection` spacing. Drop = 0.5 s mean bass ≥ 2× the
  preceding 6 s mean, ≥ 0.35 absolute, and the preceding 2 s ≤ 0.5× the new level. Live detector: novelty between
  the last 3 s and the 8 s before it; emits at most once per `minGap`; a drop may pre-empt a section event.

- [ ] **Step 1: Write failing tests:**
  - `finds a key/texture change`: 30 s of C-major quiet legato rows then 30 s of F♯-minor loud staccato rows →
    exactly one boundary within ±2 s of 30 s.
  - `no boundaries in steady music`: 60 s of stationary rows with small noise → 0 boundaries.
  - `min section length respected`: alternating every 3 s → no two boundaries closer than 6 s.
  - `finds a drop`: bass 0.1 for 20 s, then 0.8 → one drop within 0.5 s of 20 s; steady kicks (bass pulsing 0.7/0.2
    every 0.5 s) → no drops.
  - `live detector min gap`: changes every 5 s → events ≥ 15 s apart.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `"Structure: novelty sections and bass drops, offline and live"`.

### Task 4: Fingerprint

**Files:** Create `src/audio/fingerprint.ts`, `tests/fingerprint.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  export interface Fingerprint { version: 1; duration: number; hop: 0.1; bits: string /* base64, 16 bits per hop */ }
  export function fingerprint(mono: Float32Array, sampleRate: number): Fingerprint;
  export function compare(a: Fingerprint, b: Fingerprint): { ber: number /* bit error rate at best alignment */; offset: number /* seconds */ };
  export function isMatch(a: Fingerprint, b: Fingerprint): boolean; // ber < 0.25 && |durations| within 2% && |offset| ≤ 2 s
  ```
- Algorithm: 0.1 s hops, 17 log-spaced bands 150–4000 Hz from a 2048-pt FFT (band edges in Hz, so any sample rate
  works); bit = sign of (ΔE between adjacent bands at t) − (same at t−1) (Haitsma–Kalker), 16 bits/hop; leading
  silence trimmed before hop 0; alignment search ±2 s.

- [ ] **Step 1: Write failing tests** (synthetic 60 s "music": chords + melody + percussion with seeded randomness):
  - `same music matches across rates and gain`: 44.1 kHz vs the same at 48 kHz, −6 dB and low-passed at 8 kHz →
    `ber < 0.15`, `isMatch` true.
  - `different music does not match`: two different seeds → `ber > 0.35`, `isMatch` false.
  - `time-crop does not match full`: first 40 s vs the full 60 s → `isMatch` false (duration rule).
  - `leading silence tolerated`: 0.7 s of silence prepended → `isMatch` true.
  - `fast`: 12 minutes at 44.1 kHz fingerprinted in < 3 s (Node).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Real-audio check: fingerprint `sugarplum.ogg` and an ffmpeg MP3 re-encode of it (128 kbps, 48 kHz)
  → match; against `waltz.ogg` → no match. Print BERs.
- [ ] **Step 6:** Commit `"Fingerprint: recognise a recording across encodings"`.

### Task 5: Stage contracts, script schema and validator

**Files:** Create `src/stage/types.ts`, `src/stage/script.ts`, `tests/script.test.ts`, `scripts/check-script.ts`.

**Interfaces:**
- Produces (`src/stage/types.ts`; besides MelodyNote/MelodyFrame/Section/Drop from Tasks 2–3 and `Fingerprint` from 4):
  ```ts
  export type ElementType = 'melody' | 'bass' | 'sparks' | 'bloom' | 'pulse' | 'wave' | 'fluid';
  export type Region = 'full' | 'top' | 'bottom' | 'left' | 'right' | 'center';
  export interface ElementParams { intensity: number; size: number; region: Region; color: 'mood' | 'note' | string /* #hex */; style: string /* per type, see STYLES */ }
  export const STYLES: Record<ElementType, readonly string[]> = {
    melody: ['ribbon', 'beads', 'ink'], bass: ['orbs', 'tides'], sparks: ['stars', 'dust', 'embers'],
    bloom: ['fields', 'aurora'], pulse: ['rings', 'grid', 'flash'], wave: ['line', 'circle'], fluid: ['living'],
  };
  export interface ElementSpec { id: string; type: ElementType; params?: Partial<ElementParams> }
  export interface Look { palette: 'mood' | 'notes' | [string, string, string, string]; trails: number; warp: number; mirror: 1 | 2 | 4 | 6 | 8 | 12; glow: number }
  export interface SceneDef { look?: Partial<Look>; elements: ElementSpec[] }
  export type Cue = { at: number; snap?: boolean } & (
    | { scene: string; transition?: { kind: 'cut' | 'blend'; duration?: number } }
    | { enter: ElementSpec; fade?: number }
    | { exit: string; fade?: number }
    | { accent: { kind: 'flash' | 'shock' | 'swell'; color?: string; strength?: number } }
    | { ramp: { target: string /* 'look.trails' | '<elementId>.intensity' | '<elementId>.size' */; to: number; duration: number } }
  );
  export type StudyId = 'ember' | 'basalt' | 'sugar' | 'mist';
  export interface Script {
    version: 1; id: string; title: string; artist?: string; duration: number; notes?: string;
    match: { kind: 'recording' } | { kind: 'study'; study: StudyId; seed: number };
    scenes: Record<string, SceneDef>; timeline: Cue[];
  }
  export interface SongData {
    version: 1; id: string; duration: number; fingerprint: Fingerprint;
    melody: { notes: MelodyNote[]; contour: { hop: number; midi: (number | null)[] } };
    beats: number[]; onsets: { t: number; s: number }[]; sections: Section[]; drops: Drop[];
    chords: { t: number; root: number; minor: boolean; chroma: number[] }[];
    mood: { t: number; leader: string; words: string[] }[];
  }
  export interface CastMember { spec: ElementSpec & { params: ElementParams }; presence: number /* 0..1 */ }
  export interface Accent { kind: 'flash' | 'shock' | 'swell'; color: [number, number, number]; strength: number; age: number /* s since it fired */ }
  export interface StageDirectives { source: 'scripted' | 'live'; scene: string; look: Look; cast: CastMember[]; accents: Accent[] }
  export const DEFAULT_PARAMS: ElementParams = { intensity: 0.7, size: 0.5, region: 'full', color: 'mood', style: '' /* → STYLES[type][0] */ };
  export const DEFAULT_LOOK: Look = { palette: 'mood', trails: 0.5, warp: 0.2, mirror: 1, glow: 0.6 };
  ```
  `src/stage/script.ts`: `validateScript(json: unknown): { ok: true; script: Script } | { ok: false; errors: string[] }`
  (errors are human/LLM-readable with JSON paths, e.g. `timeline[3].scene: unknown scene "storm"`), and
  `normalizeSpec(spec: ElementSpec): CastMember['spec']` (fills defaults, style → first of STYLES[type]).
  `scripts/check-script.ts`: `npx tsx scripts/check-script.ts corpus/<id>.json` → prints `OK` or the errors and
  exits 1; also warns (not errors) about pacing: > 4 elements on stage at once, two scene changes < 8 s apart, cues
  after `duration`, a recording script without a matching `corpus/<id>.data.json`.

- [ ] **Step 1: Write failing tests:** a valid minimal script passes; each of these fails with a path-specific error:
  unknown element type, unknown style, unknown scene in a cue, `exit` of an id never entered, cue `at` < 0 or
  unsorted timeline, `intensity` outside 0..1, `mirror: 3`, bad hex color, ramp target to an unknown element,
  `version: 2`. `normalizeSpec({id:'m', type:'melody'})` → style `'ribbon'`, intensity 0.7.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (hand-written validation, no schema library). **Step 4:** PASS.
- [ ] **Step 5:** Commit `"Stage contracts and script schema with validator"`.

### Task 6: Script player

**Files:** Create `src/stage/player.ts`, `tests/player.test.ts`.

**Interfaces:**
- Consumes: `Script`, optional `SongData` (for snapping), `normalizeSpec`.
- Produces:
  ```ts
  export class ScriptPlayer {
    constructor(script: Script, data?: SongData);
    /** Pure: the same `t` always gives the same directives. `t` is song time in seconds. */
    at(t: number): StageDirectives;
    /** Cue times after snapping (for the preview tool and tests). */
    readonly cueTimes: number[];
  }
  ```
- Rules: cues sorted; a cue snaps to the nearest onset/beat in `data` within 120 ms unless `snap: false`. State at
  `t` = fold of all cues with time ≤ t (scene, extra entered elements, exits, ramps evaluated by linear interpolation
  over their window). Scene `blend`: outgoing cast presence 1→0 and incoming 0→1 over `duration` (default 1.5 s,
  max 2 s); `cut`: instant. Element `enter` fades in over `fade` (default 0.8 s), `exit` fades out (default 1.2 s).
  Accents are listed while `age < 1.5 s`. Elements present in both scenes with the same id keep presence 1 (they carry
  through the change). Look values blend linearly across a scene blend (palette switches at the midpoint).

- [ ] **Step 1: Write failing tests:**
  - `player seek determinism`: for 200 random `t` values, `at(t)` called in random order equals `at(t)` called in
    ascending order (deep equal).
  - `blend presences`: at the midpoint of a 2 s blend, outgoing and incoming presences are both 0.5 (±0.01).
  - `cut is instant`; `carry-through id keeps presence 1`.
  - `enter/exit fades` at the documented defaults.
  - `accent window`: present at t = cue + 1.4, absent at cue + 1.6 and before the cue.
  - `ramp`: halfway through a ramp of `look.trails` 0.2→0.8 over 10 s → 0.5.
  - `snapping`: a cue at 10.00 with an onset at 10.09 → fires at 10.09; with onset at 10.2 → stays 10.00;
    `snap:false` → 10.00.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `"Script player: song time → directives, seek-safe"`.

### Task 7: Stage compositor and the seven elements

**Files:**
- Create: `src/stage/stage.ts`, `src/stage/gl.ts`, `src/stage/post.ts`, `src/stage/elements/{melody,bass,sparks,bloom,pulse,wave,fluid}.ts`,
  `src/stage/elements/index.ts`, `stage-test.html` (+ `src/stage/harness.ts`), `scripts/stage-shots.mjs`
- Reuse helpers from `src/visual/living/gl.ts` where they fit (import, don't copy).

**Interfaces:**
- Consumes: `StageDirectives` (Tasks 5–6), `MusicClock` state (Task 1), `MelodyFrame` (Task 2), `LivingCanvas` +
  `LivingInput` (Task 0), `Character`, `Material`, `Gesture`, `SoundEvent`, `Features`, `Descriptors`.
- Produces:
  ```ts
  export interface StageFrame {
    dt: number; musicDt: number; clock: { time: number; drive: number; dim: number };
    f: Features; d: Descriptors; character: Character; material: Material; gesture: Gesture;
    melody: MelodyFrame; events: SoundEvent[]; beat: { phase: number; hit: boolean; strength: number };
    chroma: Float32Array; wave: Float32Array /* latest ~2048 mono samples */; wild: number;
    pointer: LivingInput['pointer']; directives: StageDirectives;
  }
  export interface StageElement {
    readonly type: ElementType;
    init(gl: WebGL2RenderingContext, shared: StageShared): void;
    /** Draws into the bound scene framebuffer with additive blending; `presence` 0..1 scales everything. */
    draw(fr: StageFrame, member: CastMember): void;
    dispose(): void;
  }
  export class Stage {
    constructor(canvas: HTMLCanvasElement);
    static supported(): boolean;
    resize(): void;
    render(fr: StageFrame): void;   // creates/disposes element instances by cast id
    snapshot(): Promise<Blob | null>;
    dispose(): void;
    onContextLost?: () => void;
  }
  ```
  Elements are registered in `elements/index.ts` as `Record<ElementType, () => StageElement>`.
- Rendering decisions: one WebGL2 context on a new `<canvas id="stage-gl">`; scene FBO (half-float) → post
  (feedback: previous frame zoomed/rotated by `look.warp × clock.musicDt`, faded by `look.trails`; mirror; glow;
  accents; tone map; multiply by `clock.dim`). Fluid element = a `LivingCanvas` on an offscreen canvas, uploaded each
  frame with `texImage2D(canvas)` and drawn as a full-screen layer (its own post stays on). All element motion uses
  `fr.clock.time`/`fr.musicDt` and audio values only.
- Element behaviours (what "following" means; colors from `material.palette` when `color: 'mood'`, note hue when
  `'note'`):
  - **melody**: a stroke whose head is at x = advancing with music time (scrolls left), y = pitch (MELODY_RANGE →
    bottom..top of `region`); width/brightness = salience × intensity; a held note draws a long smooth segment, a
    leap a visible jump, unvoiced frames leave a gap; trail lifetime ~4 s of music time. Styles: `ribbon` (smooth
    glowing band), `beads` (one glowing bead per note, size ∝ duration), `ink` (dye injected into the fluid when a
    fluid is on stage, otherwise soft brush strokes).
  - **bass**: large soft shapes low in the region; size ∝ bass level and `axes.weight`; move slowly with the
    reservoir gesture; `orbs` | `tides` (horizontal swells).
  - **sparks**: particles spawned by onsets and high-register `SoundEvent`s (height > 0.55), size from
    `material.sparkSize`, shape star when `material.angularity` > 0.5; advected by gesture swirl.
  - **bloom**: wide color fields tinted by the current chord (chroma → hue via circle of fifths, minor → cooler),
    cross-fading over ~1 s of music time on chord change; `fields` | `aurora` (vertical curtains).
  - **pulse**: on `beat.hit` → `rings` from center | `grid` throbs | `flash` of the region; hidden when pulse clarity < 0.3.
  - **wave**: oscilloscope of `fr.wave`, `line` across the region or wrapped into a `circle`.
  - **fluid**: the Living Canvas, driven by `material`, `gesture`, `events` and the pointer.

- [ ] **Step 1:** Harness `stage-test.html` drives `Stage` with synthetic `StageFrame`s: a scripted 10 s melody
  (rising scale, leap, held note, rest), bass pulses, chord changes every 2 s, beat at 120 BPM, one directive per
  element type in isolation plus three combinations (abyss-like: fluid+bass+melody/ink; sugar-like:
  sparks/stars+melody/beads+pulse/rings; mist-like: bloom/aurora+melody/ribbon).
- [ ] **Step 2:** `node scripts/stage-shots.mjs` (Vite on port 5196, system Chrome) writes PNGs per case to
  `<scratch>/stage-shots/` plus: (a) a **silence check** — two screenshots 1 s apart after 2 s with
  `musicDt = 0` and no events must differ by < 1 % of pixels (only dimming allowed); (b) frame time at 1920×1080.
  Expected: every element visible and distinct; melody stroke height tracks the scale; silence check passes;
  < 8 ms/frame on the RTX 4080.
- [ ] **Step 3:** Read every PNG and iterate until each element is beautiful and clearly follows its stream.
- [ ] **Step 4:** Commit `"Stage: WebGL2 compositor with melody, bass, sparks, bloom, pulse, wave, fluid"`.

### Task 8: Live director and scene library

**Files:** Create `src/stage/library.ts`, `src/stage/director.ts`, `tests/director.test.ts`.

**Interfaces:**
- Consumes: `SceneDef`, `normalizeSpec`, `ChangeDetector` (Task 3), `Character`.
- Produces:
  ```ts
  export interface LibraryScene extends SceneDef { name: string; affinity: Partial<Record<ArchetypeId, number>> }
  export const LIBRARY: LibraryScene[]; // ≥ 10 scenes covering all 8 archetypes
  export interface Streams { melodyVoiced: number /* 0..1 over last 2 s */; bass: number; pulse: number /* pulseClarity */; highActivity: number /* high-register onsets */ }
  export class LiveDirector {
    constructor(seed?: number);
    update(c: Character, streams: Streams, change: { kind: 'section' | 'drop'; strength: number } | null, dt: number): StageDirectives;
    reset(): void;
  }
  ```
- Rules: initial scene = best affinity with the current blend. On `change`: `drop` → cut, `section` → 1.5 s blend,
  to the best-affinity scene other than the current one (ties broken by the seeded PRNG). Within a scene, each
  element's presence follows its stream with ~1 s smoothing (melody thread only while `melodyVoiced > 0.4`, pulse
  only while `pulse > 0.35`, sparks scale with `highActivity`, bass with `bass`; fluid/bloom always). If no change
  has happened for 60 s and the archetype leader changed and held for 8 s, also change scene (blend).

- [ ] **Step 1: Write failing tests:** abyss-dominant character → first scene has abyss affinity as its highest;
  `drop` → `transition` is a cut (all outgoing presences 0 next frame); `section` → blend; two changes 5 s apart →
  only the first switches (min gap is enforced by ChangeDetector — assert the director never switches twice < 15 s
  even if fed two changes); melody presence ≤ 0.1 after 3 s of `melodyVoiced = 0`; never emits more than 5 cast members.
- [ ] **Step 2:** FAIL. **Step 3:** Implement library (design scenes with the element styles; e.g. *Embers* fire,
  *Deep water* abyss, *Music box* sugar, *Fog* mist, *Cathedral* gold, *Tempest* storm, *Circuit* machine,
  *Rain* lament, plus 2–3 blends) and director. **Step 4:** PASS.
- [ ] **Step 5:** Commit `"Live director: scenes cast by mood, changed on sections and drops"`.

### Task 9: Song feed, corpus, engine hooks

**Files:**
- Create: `src/stage/feed.ts`, `src/stage/corpus.ts`, `tests/feed.test.ts`, `corpus/.gitkeep`
- Modify: `src/audio/engine.ts` (track decode hook, study playback with seed, accurate song position)

**Interfaces:**
- Consumes: `MelodyTracker`, `SongData`, `StudyScore`/`Study.melodyVoices`, `fingerprint`/`isMatch`, `ScriptPlayer`, `LiveDirector`.
- Produces:
  ```ts
  // engine.ts
  onTrackDecoded(fn: (t: { file: File; mono: Float32Array; sampleRate: number }) => void): void; // decoded in parallel with playback
  async playStudy(id: StudyId, opts?: { seed?: number }): Promise<void>;
  readonly songTime: number; // audio position minus output latency (ctx.outputLatency + baseLatency), seconds
  readonly study: { id: StudyId; seed: number; loop: number; loopStart: number; score: StudyScore } | null;
  // corpus.ts
  export interface CorpusEntry { script: Script; data?: () => Promise<SongData> }
  export function findByFingerprint(fp: Fingerprint): Promise<CorpusEntry | null>;
  export function findByStudy(id: StudyId, seed: number): CorpusEntry | null;
  // feed.ts
  export class SongFeed {
    /** Live: uses MelodyTracker + engine onsets/beat. Data: looks up melody/beat/onsets at `t` from SongData or a StudyScore. */
    static live(): SongFeed; static fromData(d: SongData): SongFeed; static fromScore(s: StudyScore, melodyVoices: string[]): SongFeed;
    frame(t: number, mags: Float32Array, f: Features, d: Descriptors): { melody: MelodyFrame; beat: StageFrame['beat']; events: SoundEvent[] };
  }
  ```
- `corpus.ts` uses `import.meta.glob('/corpus/*.json', { eager: true, import: 'default' })` for scripts (excluding
  `*.data.json`) and `import.meta.glob('/corpus/*.data.json', { import: 'default' })` (lazy) for data; scripts are
  re-validated with `validateScript` at load (invalid ones are skipped with a console warning). Fingerprint lookup
  loads candidate data lazily, filtered first by duration within 2 %.

- [ ] **Step 1: Write failing tests:** `fromData` at a time inside a note returns that note with `noteOn` true only
  on the first frame at/after its start; after a seek (a jump of > 0.25 s, forwards or backwards) the first
  `frame(t)` emits `noteOn` only for a note whose start lies within 1/60 s before `t`; beat phase is 0 at beat times and 0.5 midway; `fromScore` uses only `melodyVoices` events and wraps at
  `score.length`; `findByStudy('basalt', seed)` returns the bundled script when present, else null.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; engine decodes the file with `decodeAudioData` on a copy of the
  ArrayBuffer (mono mix-down) after playback starts, then calls the hook; studies play through
  `Study.create(ctx, dest)` with `seed` (extend `create`'s signature with `opts?: { seed?: number }` in studies.ts;
  the first loop uses the pinned seed, later loops re-seed as today). **Step 4:** PASS.
- [ ] **Step 5:** Browser sync check (`scripts/sync-check.mjs`, port 5197): play a rendered study WAV as a file with
  a test script that flashes white at known onset times; screenshot-sample the canvas brightness at 120 fps over
  those moments, before and after a seek and a pause/resume → measured offset ≤ 50 ms.
- [ ] **Step 6:** Commit `"Song feed and corpus: scripted songs follow precomputed melody and beats"`.

### Task 10: Minimal interface, integration, MIDI

**Files:** Modify `index.html`, `src/main.ts`, `src/style.css`, `src/ui/panel.ts`; create `src/stage/overrides.ts`, `tests/overrides.test.ts`.

**Interfaces:**
- Consumes: everything above.
- Produces:
  ```ts
  // overrides.ts
  export type Pinnable = 'palette' | 'trails' | 'mirror' | 'warp';
  export class Overrides { pinned: Set<Pinnable>; scriptPaused: boolean; pin(k: Pinnable): void; pauseScript(): void; resume(): void; reset(): void /* on track change */; apply(dir: StageDirectives, userLook: Look): StageDirectives }
  ```
- Main loop order per frame: `engine.analyze()` → `clock.advance()` → `character.update(d, null, f, dt, musicDt)` →
  `feed.frame(engine.songTime, …)` → directives = scripted (`player.at(songTime)`) or live (`director.update`) →
  `overrides.apply` → `stage.render(frame)`. Classic mode renders the v1 `Renderer` instead (its scenes get
  `f.time = clock.time`).
- UI: the existing panel becomes the **Tweak** drawer, closed by default (toggle button labelled "Tweak"); a new
  always-visible **Calm ↔ Wild** slider bound to `look.wild`; a **badge** (`#mode-badge`): "Scripted · <title>" /
  "Scripted · paused" (click resumes) / "Live", followed by `character.words.join(' · ')`. A "Classic" scene choice
  in the drawer switches to the v1 renderer. Changing palette/trails/mirror/drift in the drawer pins that parameter;
  picking a scene (or Classic) pauses the script. Demo button plays the studies in order (Ember, Basalt, Sugar
  Glass, Mist, then the groove); prev/next step through them.
- MIDI: `keyBus` connects to `engine.input` (not `ctx.destination`); `note()` → `midiEvent(...)` pushed into the
  frame's events and a `poke` into the clock; held keys feed the melody element (a synthetic voiced `MelodyFrame`
  while no song melody is voiced).
- Fallback: if `!Stage.supported()` or `onContextLost` → switch to Classic and toast "Your browser can't run the
  full stage — showing Classic".

- [ ] **Step 1: Write failing tests** (`tests/overrides.test.ts`): pinned palette survives a scripted scene change;
  `pauseScript` → `apply` returns the user's look and keeps the last cast; `reset` clears pins.
- [ ] **Step 2:** FAIL. **Step 3:** Implement overrides + integration + UI. **Step 4:** PASS; `npx tsc --noEmit`;
  `npm run build`.
- [ ] **Step 5:** Browser check (extend `scripts/screenshots.mjs`, system Chrome): welcome → demo (Basalt) shows
  "Live" badge with words; drawer closed; Calm↔Wild visible; forcing `Stage.supported = () => false` via
  `?classic=1` shows Classic and the toast; no console errors. Update `docs/media/` screenshots.
- [ ] **Step 6:** Commit `"Minimal interface: stage by default, Tweak drawer, mode badge, MIDI into the stage"`.

### Task 11: Study pack, preview, composer's handbook

**Files:** Create `scripts/study.ts`, `scripts/lib/plot.ts`, `scripts/preview-script.mjs`, `docs/COMPOSING.md`;
modify `package.json` scripts (`study`, `check-script`, `preview-script`), `.gitignore` (`study/`).

**Interfaces:**
- Consumes: `decode`, `analyzeOffline`, `extractMelody`, `segment`, `findDrops`, `fingerprint`, `CharacterEngine`, `validateScript`, `ScriptPlayer.cueTimes`.
- Produces: `npm run study -- <file> [--id <slug>]` → `study/<slug>/{summary.md, analysis.json, spectrogram.png,
  melody.png, mood.png}` and `corpus/<slug>.data.json` (`SongData`). `npm run preview-script -- <slug> <audio file>`
  → `study/<slug>/preview/cue-NN.png` + `contact.png`. `plot.ts`: `linePlot(...)`/`pianoRoll(...)` writing PNG
  with `zlib` (no deps).
- `summary.md` content (this is what Claude reads — make it scannable): header (title guess from filename,
  duration, tempo, key/mode arc); a section table (start–end, character leader + words, loudness, register,
  texture, novelty); drops/climaxes (top 5 loudness peaks with times); melody: range, phrases (gaps > 1 s split them)
  with start/end/contour shape words (rising/falling/arch/static), and repeated motifs (interval-sequence matches of
  ≥ 5 notes, with all occurrence times); beat grid summary; a per-10 s timeline line (time, leader, words, loudness bar).
- `docs/COMPOSING.md`: workflow (study → read → write → check → preview → revise); element vocabulary with styles
  and what each follows; heuristics (cross-modal table from CHARACTER-PLAN.md; pacing: ≤ 4 elements on stage, ≥ 8 s
  between scene changes except climaxes, one biggest accent saved for the climax, the melody thread on whenever a
  clear tune is present, returning themes return with their scene, dark/low/slow → heavy, deep palette, high/quick
  → small, bright, sparse); the full schema with one complete example script; how to use `match` for recordings vs
  studies.

- [ ] **Step 1:** Implement `plot.ts` with a test (`tests/plot.test.ts`): a 4×4 RGBA image round-trips through
  zlib-inflate to the same pixels; the file starts with the PNG signature.
- [ ] **Step 2:** Implement `study.ts`; run on `<ref>/sugarplum.ogg` and the 12-minute stress input (concatenate
  `<ref>/*.ogg` with ffmpeg into one file) → completes < 90 s, `data.json` < 2 MB, images readable (Read them).
- [ ] **Step 3:** Write `COMPOSING.md`; write a tiny example script for sugarplum; `npm run check-script` → OK;
  `npm run preview-script` → contact sheet exists and shows the cues.
- [ ] **Step 4:** Commit `"Study packs, script checker and preview, composer's handbook"`.

### Task 12: Compose the first corpus

**Files:** Create `corpus/{ember,basalt,sugar,mist}.json` (study scripts, `match.kind: 'study'`),
`corpus/{rach-prelude,sugarplum,hungarian5,humpback,dnb,ragtime}.json` + their `.data.json`.

- [ ] **Step 1:** For each piece: `npm run study`, read `summary.md` and all three images, write the script by
  `COMPOSING.md`, `npm run check-script` → OK, `npm run preview-script`, read the contact sheet, revise until the
  cues land on the right musical moments and each scene reads as the music's character.
- [ ] **Step 2:** For the studies, compose from the score (`compose(seed)`) of the pinned seed; verify in the app.
- [ ] **Step 3:** Commit `"Corpus: first ten composed shows"`.

### Task 13: End-to-end verification and docs

- [ ] **Step 1:** `npx tsc --noEmit`, `npx vitest run`, `npm run build` → all clean.
- [ ] **Step 2:** Browser run in system Chrome: each corpus recording dropped in as a file → badge says
  "Scripted · <title>"; an unscripted file (e.g. `waltz.ogg`) → "Live" and at least one scene change in 60 s;
  silence after pause → picture freezes and dims; MIDI simulated note events (`window.winkel` hook) → melody element
  responds. Record a short `docs/media/tour.mp4` with `npm run shots -- --video`.
- [ ] **Step 3:** Update `README.md` (new features, how to compose a show) and replace `docs/HANDOFF.md` with the
  current state; commit `"Docs: scripted visuals"`.
- [ ] **Step 4:** Whole-branch review (superpowers:requesting-code-review); fix findings; commit.
