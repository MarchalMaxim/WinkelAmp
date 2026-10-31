# WinkelAmp Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The widget lab becomes the product: drop a recording, get a cached song pack and a show of lab widgets that
plays section by section on every attack, pixel-identical to the lab, reshaped with the mouse, exported as MP4.

**Architecture:** `lab/tools/*.js` stay the only widget code. `WidgetRuntime` evaluates the unchanged files with the
lab's exact `ctx`, chord grouping, feature/drive arithmetic, shared fading canvas and render API; the lab's `TOOL_IDS`,
`VERDICTS`, `DRIVES` and `ICON` are read out of `lab/index.html` at run time, never copied. A `SongPack`
(`songs/<id>/pack.json`, from `npm run ingest`: GPU piano transcription + the existing offline analysis) feeds a
`Show` (`shows/<id>.json`: sections → widget stacks). A pure scheduler says which widgets play, take attacks or decay at
a song time; a `Conductor` applies it to the runtime. The studio (the new `index.html`) edits shows with undo and saves
through a Vite dev-server API; `npm run ears` ingests dropped files (in-browser fallback when it is down); export is
MediaRecorder in the app or `npm run render-show` frame by frame (the lab's `render.mjs` approach).

**Tech Stack:** Vite 8, strict TypeScript, vitest, Canvas 2D, Web Audio, MediaRecorder; Node 22 + tsx; Playwright with
system Chrome; ffmpeg 8; Python venv `C:/Users/maxim/.venvs/wa` (torch 2.11 + CUDA, `piano_transcription_inference`,
checkpoint already in `~/piano_transcription_inference_data/`; measured ≈ 14 s model load + 0.115 s per audio second).

**Spec:** `docs/superpowers/specs/2026-10-31-lab-first-studio-design.md`. Read with it: `lab/README.md` (the widget
contract), `lab/index.html` (the harness this plan mirrors line for line), `lab/ratings.md` (verdicts),
`.superpowers/ears/brief.md` step 1 (the transcriber; its steps 2–3, skyline melody and `study --melody piano`, are
not part of this plan).

## Global Constraints

- Audio, packs and rendered videos never go into git: `songs/` and `renders/` are gitignored, `shows/` is committed.
  No new npm dependencies (none needed; Node types come from `@types/node`, a dependency of vite).
- Strict TS for all new TypeScript; vitest for the pure logic: chord grouping, drives/features, show validation,
  transitions, auto-composer, edits/undo, pack building. New Node scripts are typechecked by `tsconfig.scripts.json`.
- Runs on the user's Windows machine with Chrome; Python only through the venv above (`WINKELAMP_PY` overrides).
- Non-goals: live microphone/MIDI in the studio, WebGL ports, rewriting widgets in TS, a remote backend.
- Anti-goal, binding: for the same widget, knobs and song time the studio draws the lab's pixels. Abstract imagery only.
- No task edits `lab/` (the user's rating rounds continue there). The studio never reads or writes the lab's
  localStorage keys (`wa-params`, `wa-ratings`; studio keys start with `wa-studio.`) and never posts to port 5174.
- The picture is a 1280×720 canvas, always: a dozen widgets hard-code 1280×720 and snapshot `x.canvas`. Window size
  and full screen are CSS letterboxing; exports are 720p.
- `WINKELAMP_SONGS` / `WINKELAMP_SHOWS` override `<repo>/songs` / `<repo>/shows` (tests use temp dirs). CI (`npm test`,
  `npm run build`, the Pages deploy) has no songs, GPU, Python or Chrome: vitest never needs them; browser checks are
  `npm run` scripts.
- Browser scripts: `chromium.launch({ channel: 'chrome' })`, Vite started in-process with `createServer`,
  `**/@vite/client` blocked during long runs (other agents edit files).
- Commits: `Studio: …` / `Docs: …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Never merge into the main branch without the user's explicit yes.

## Review Focus

1. **A 10-minute recording** → GPU ingest in ≈ 2–3 min with live progress; the browser fallback runs in a Worker and
   the page stays responsive; the composer makes ≤ 20 sections; render-show prints an ETA. Pinned: T1 `pack-build`
   (600 s), T3 `compose` (600 s pack), T5 `ears-server` (progress never decreases), T8 timed run.
2. **Silence** (leading, trailing, a gap, an all-silent file) → no NaN or crash; with no attacks the shared fade takes
   the picture to black and it comes back with the music; an all-silent file gives a valid pack warning "no notes
   found" and a one-section show. Pinned: T1 `song-analysis`, `pack-build`; T3 `compose` (zero notes).
3. **A non-piano recording** → the transcriber hears little; onset coverage < 0.35 adds approximate notes for the
   onsets it missed, and the pack and the studio say so. Pinned: T1 `pack-notes`, `pack-build`; T5 banner.
4. **No Python** → `npm run ingest` fails loudly (exit 3) naming `--notes approx`; the ears server reports the
   transcriber unavailable and ingests with approximate notes and a banner. Pinned: T1 `ingest-cli`, T5 `ears-server`.
5. **A show whose sections overlap or leave gaps** → `check-show` exits 1 naming both sections and the times; the
   studio loads it repaired, unsaved, with a notice; the dev API refuses to save it unrepaired. Pinned: T3
   `show-validate`, T4 `studio-api` + `studio-check`.
6. **Window resizes and full screen** → CSS letterboxing only; the canvas stays 1280×720 and the picture is neither
   cleared nor reset. Pinned: T4 `studio-check` (width 1280 after resize, `runtime.resets` unchanged).
7. **Tab in the background** → audio keeps playing; on return the picture resets at the current time (the lab's
   > 0.5 s jump rule) instead of firing stale attacks; while recording, audio and recorder pause and resume together.
   Pinned: T2 `widgets-features` (`liveClock`), T6 `record-check` (simulated `visibilitychange`).

## Order

T1 ∥ T2 → T3 → T4 → (T5 ∥ T6) → T7 → T8. T5's server half may start right after T1.

## File Structure

| Path | Task | Responsibility |
|---|---|---|
| `src/audio/song-analysis.ts` | T1 | `analyzeSong` + `trackBeats`/`chordChanges` moved out of `scripts/study.ts` (Node and Worker) |
| `src/studio/pack/{pack,notes,build}.ts` | T1 | SongPack schema + validation; note import/approximation/merge; `buildPack` (pure) |
| `src/studio/ingest/ears-types.ts` | T1 | types shared by the CLI, the ears server and the studio (§9) |
| `scripts/ingest.ts`, `scripts/node/{python,pack-io,decode}.ts` | T1 | CLI; Python discovery + transcription; hashing, atomic writes, slug paths; ffmpeg decode |
| `scripts/ears/transcribe.py`, `scripts/ears/requirements.txt` | T1 | GPU transcriber (brief step 1; reference: the spike's `trans.py`) |
| `tsconfig.scripts.json` | T1 | typechecks the new Node scripts (`types: ["node", "vite/client"]`) |
| `src/widgets/{types,lab-harness,random,chords,features}.ts` | T2 | the ctx contract; reading the lab harness; the lab's seeded random, chords, drive arithmetic |
| `src/widgets/{instantiate,sources,runtime,driver,catalogue}.ts` | T2 | evaluating tool files; `WidgetRuntime`; live loop + render API; `WidgetMeta` |
| `render.html`, `src/studio/render-page.ts`, `scripts/fidelity.mjs` | T2 (+T4) | render-mode page (lab-compat, then shows); lab-vs-studio pixel test |
| `scripts/node/catalogue.ts` | T3 | widget metadata in Node (vm + canvas stubs) |
| `src/studio/show/{show,schedule}.ts` | T3 | Show schema/validate/repair/canonical; transitions (pure) |
| `src/studio/compose/{character,taste,compose}.ts` | T3 | auto-composer |
| `scripts/{check-show,describe-song,widget-docs}.ts`, `docs/COMPOSING-SHOWS.md` | T3 | Claude composes |
| `src/studio/show/{conductor,edit,history}.ts` | T4 | show on the runtime; pure edits; undo |
| `src/studio/ui/{main,store,api,player,timeline,panel,knobs,library,keys}.ts`, `style.css` | T4 | the studio |
| `index.html` (new), `legacy.html` (moved), `vite.config.ts`, `scripts/studio-api.ts`, `scripts/studio-check.mjs` | T4 | pages, dev API plugin, e2e |
| `scripts/ears/server.ts`, `src/studio/ingest/{ears-client,fallback,analyze.worker}.ts` | T5 | drop a file |
| `src/visual/recorder.ts` (modify), `src/studio/ui/record.ts`, `scripts/{render-show,record-check}.mjs` | T6 | export |
| `shows/prelude.json`, `shows/beethoven5.json` | T7 | the user's two shows |

## Binding Interfaces

### §1 SongPack — `src/studio/pack/pack.ts` (T1)

```ts
export const PACK_VERSION = 1;
export type NotesSource = 'gpu' | 'file' | 'approx' | 'merged';
export interface SongPack {
  version: 1;
  id: string;                 // slug /^[a-z0-9]+(?:-[a-z0-9]+)*$/ = folder songs/<id>/
  title: string;
  audio: string;              // file name in songs/<id>/: 'audio' + the original's extension
  duration: number;           // seconds of the decoded audio
  source: { name: string; bytes: number; sha1: string };   // same sha1 = already ingested
  notes: Note[];              // the lab's NOTES (§2), stable-sorted by start (ties keep source order): straight into window.NOTES
  notesFrom: NotesSource;     // gpu | file (--notes <file>, kept exactly) | approx (analysis only) | merged (gpu + approx)
  transcriber: { model: string; device: 'cuda' | 'cpu'; seconds: number } | null;
  quality: { onsetCoverage: number; notesPerMinute: number; warnings: string[] };
  sections: { start: number; end: number; novelty: number }[];   // analysis novelty sections, contiguous over [0, duration]
  beats: number[];                                               // kept where pulseClarity ≥ 0.3 (study's rule)
  loudness: { hop: 0.1; values: number[] };                      // descriptor loudness 0..1, length ceil(duration / 0.1)
  harmony: { t: number; root: number; minor: boolean }[];        // chord changes (study's chords() minus chroma); not the lab's attack CHORDS
  made: { by: 'ingest' | 'studio'; at: string };
}
export function validatePack(x: unknown): string[];   // [] = valid; each message names the field
```

`src/studio/pack/notes.ts`: `parseNotesFile(text): Note[]` (a lab `notes.js` `window.NOTES=[…]`, a `transcribe.py` JSON,
or a JSON array of tuples; order kept), `approximateNotes(a: Pick<SongAnalysis, 'onsets'|'melody'|'harmony'|'duration'>): Note[]`,
`onsetCoverage(notes, onsets): number`, `mergeNotes(gpu, approx): Note[]`. The approximation, exactly:

```
for each onset o: vel = round(30 + 90·o.s)
  top:  melody note m with m.start − 0.05 ≤ o.t < m.end → [o.t, min(m.end, o.t + 2), round(m.midi), vel]
  h = last harmony entry with h.t ≤ o.t (if any)
  bass: o.s ≥ 0.35 and h → [o.t, min(next harmony t, o.t + 2), 36 + h.root, round(0.9·vel)]
  mid:  o.s ≥ 0.6  and h → [o.t, o.t + 1, 60 + (h.root + (h.minor ? 3 : 4)) % 12, round(0.8·vel)]
melody note with no onset within ±0.05 s of its start → [start, end, round(midi), round(30 + 70·strength)]
clamp ends to duration, drop end ≤ start and same-midi duplicates within 1 ms, sort by (start, midi)
coverage = share of onsets with s ≥ 0.3 that have a note start within ±0.06 s (1 when there are none)
merge    = gpu ∪ { a ∈ approx : |a.start − g.start| > 0.06 for every gpu g }, stable by start
```

`src/studio/pack/build.ts`:
```ts
export interface BuildInput {
  id: string; title: string; audio: string; source: SongPack['source']; analysis: SongAnalysis;
  notes: { from: 'gpu' | 'file'; list: Note[]; transcriber: SongPack['transcriber'] } | null;   // null = approximate
  by: 'ingest' | 'studio'; at: string;
}
export function buildPack(i: BuildInput): SongPack;
// null → approx + warning 'approximate notes: no transcriber'; gpu with coverage < 0.35 → merged + warning
// 'the transcriber heard little of this recording (coverage N%): approximate notes fill the rest'; file → never merged;
// zero notes → warning 'no notes found: is the recording silent?'
```

`src/audio/song-analysis.ts`:
```ts
export interface SongAnalysis { duration: number; sections: SongPack['sections']; beats: number[]; loudness: SongPack['loudness'];
  harmony: SongPack['harmony']; onsets: { t: number; s: number }[]; melody: MelodyNote[] }
export function analyzeSong(pcm: Float32Array, sampleRate: number, onProgress?: (f: number) => void): SongAnalysis;
export function trackBeats(odf: Float32Array, fps: number): { beats: number[]; period: number };          // moved verbatim
export function chordChanges(chroma: Float32Array, quiet: Uint8Array, fps: number, latency: number): SongData['chords']; // study's chords(), verbatim
export const ONSET_LAG = 0.035, PULSE_MIN = 0.3;
// analyzeSong = study.ts's computations for these fields only (fps 60, analyzeOffline with melody, extractMelody,
// onsets − ONSET_LAG, beats filtered by PULSE_MIN, segment(rows, 1/60)); no plots, no character engine.
```

### §2 The widget contract — `src/widgets/types.ts` (T2): what `lab/tools/*.js` expect, nothing more

```ts
export type Note = [start: number, end: number, midi: number, vel: number];   // song s, MIDI, 0..127
export interface Chord { t: number; notes: { m: number; v: number; d: number }[]; vel: number; lo: number; hi: number }
export interface SoundingNote { m: number; v: number; start: number; end: number }
export type Drive = '' | '+level' | '-level' | '+rate' | '-rate' | '+pitch' | '-pitch' | '+bass' | '-bass' | '+density' | '-density';
export interface Param { key: string; label?: string; min: number; max: number; step?: number; value: number; drive?: Drive;
  hint?: string; icon?: (g: CanvasRenderingContext2D, v: number, w: number, h: number) => void }
export interface ToolDef { id: string; name: string; blurb?: string; tag?: string; on?: boolean; params?: Param[];
  reset?(x: WidgetCtx): void; onChord?(ch: Chord, x: WidgetCtx): void; frame?(x: WidgetCtx): void }
export interface Features { level: number; rate: number; pitch: number; bass: number; density: number }
export interface KnobState { base: number; drive: Drive; depth: number }   // the lab's PST entry
export type KnobMap = Record<string, KnobState>;
export interface WidgetCtx {               // ONE object shared by every widget call, as in the lab
  g: CanvasRenderingContext2D; W: 1280; H: 720; canvas: HTMLCanvasElement;   // getContext('2d') with no options
  t: number; dt: number; now: number;      // song s; song s since the last step (frame() never sees 0); wall s (render: += each substep)
  moment: string;                          // the section's mood name; lewitt starts a new wall when it changes (labCompat: the
                                           // lab's SONGS.moments mood; starts 'dread' as the lab's ctx; reset() leaves it)
  level: number; rate: number;             // raw pulse (§2 arithmetic)
  feat: Features;
  tool: ToolDef | undefined;               // set before every call; ctx.p reads its knobs
  rnd(a?: number, b?: number): number;     // a + Math.random()·(b − a), defaults 0, 1
  sounding(): SoundingNote[];              // start ∈ [t − 8, t] (the lab's binary search from t − 8) and end > t
  top(): SoundingNote | null;
  pitch01(m: number): number;              // clamp((m − 21) / 87, 0, 1)
  p(key: string): number | undefined;      // knobValue(param, knobs[tool.id][key], feat); undefined for an unknown key
}
export type IconLib = Record<string, any> & { ink: string; gauge(g: CanvasRenderingContext2D, v: number, w: number, h: number): void };
export interface Verdict { v: 'love' | 'keep' | 'needs work' | 'drop'; on: string; note?: string }
export interface LabHarness { toolIds: string[]; verdicts: Record<string, Verdict>; drives: [Drive, string][]; iconSource: string }
export type LabMoment = [start: number, mood: string, label?: string];   // the lab's SONGS.moments entry
export interface LabSong { title: string; audio?: string; notes: string; dur: number; moments: LabMoment[] }   // notes relative to lab/
export interface WidgetMeta { id: string; name: string; blurb: string; tag: string; verdict: Verdict | null; params: Omit<Param, 'icon'>[] }
```

Globals while a file is evaluated and run: `window.NOTES` = the song's `Note[]`, set before any evaluation (blocks,
brush, cells, fields, kline, martin, pixelsort, pointillism, riley read it; several cache from it on first use, so a
new song means a page reload); `TOOLS` (a fresh array per evaluation), `ICON`, `CHORDS` (the song's `Chord[]`;
score.js reads it bare) are passed as parameters: `new Function('TOOLS', 'ICON', 'CHORDS', src + '\n//# sourceURL=lab/tools/<id>.js')`.
Exactly one `TOOLS.push` whose `id` is the file name, else the load fails with that message. The tools reference no
other harness names (checked: no bare `ctx`, `SONG`, `MOMENTS`, `audio`, `PST`).

`src/widgets/chords.ts`: `groupChords(notes): Chord[]` (a note joins the open chord when `start − chord.t < 0.04`,
chord.t = its FIRST note's start; vel = max, lo/hi = min/max midi, d = end − start), `firstAtOrAfter(notes, t): number`,
`soundingAt(notes, t): SoundingNote[]`.

`src/widgets/features.ts` (the lab's `step()` arithmetic, same operation order):
```ts
export function newFeatures(): Features;   // { level: 0, rate: 0, pitch: 0.5, bass: 0, density: 0 }
export function knobValue(q: Param, s: KnobState, f: Features): number;
//   v = s.base + (s.drive ? (s.drive[0] === '+' ? 1 : −1)·s.depth·(q.max − q.min)·(f[s.drive.slice(1)] − (pitch ? 0.5 : 0)) : 0), clamped to [min, max]
export function resolveKnobs(params: readonly Param[], over?: Record<string, number | Partial<KnobState>>): KnobMap;
//   default { base: q.value, drive: q.drive ?? '', depth: 0.5 }; a number sets base; unknown keys ignored
export interface Pulse { level: number; rate: number }
export function advanceFeatures(p: Pulse, f: Features, fired: readonly Chord[], snd: readonly SoundingNote[], dt: number): void;
//   level *= 0.5^(dt/0.8); rate *= 0.5^(dt/1); per fired chord: level = max(level, vel/115), rate += 1/1.44;
//   k = 1 − 0.5^(dt/0.25); f.level = level; f.rate = min(1, rate/8); f.pitch += ((top ? pitch01(top.m) : f.pitch) − f.pitch)·k;
//   f.bass += (min(1, Σ_{m<50} v/127 / 2) − f.bass)·k; f.density += (min(1, snd.length/10) − f.density)·k
export function liveClock(lastT: number, t: number, paused: boolean): { reset: boolean; dt: number };
//   reset = |t − lastT| > 0.5 (also when paused; dt is then 0); dt = paused ? 0 : min(0.05, max(0, t − lastT)); lastT becomes t
```

`src/widgets/lab-harness.ts`: `readLabHarness(html: string): LabHarness` (evaluates the literals of `const TOOL_IDS =`,
`const VERDICTS =`, `const DRIVES =` and takes the `window.ICON = (() => {…})();` block; throws naming a missing
block) and `makeIcon(iconSource): IconLib`. Added in the T2 review: `readLabSongs(html): Record<string, LabSong>` (the
literal of `const SONGS =`; throws naming a missing block), `momentAt(moments, t): string` (the lab's step(): the mood of the
last moment with start ≤ t, else the first one's) and `LAB_FIRST_MOMENT = 'dread'` (the lab's ctx before any step). `src/widgets/random.ts`: `labRandom(seed): () => number` (the lab's
render-mode generator) and `installSeededRandom(seed = 1): (seed: number) => void` (replaces `Math.random`, returns reseed).

### §3 WidgetRuntime — `src/widgets/runtime.ts`, `driver.ts` (T2)

```ts
export interface Slot { id: string; receiving: boolean; weight: number }   // weight 1 = drawn exactly as the lab draws it
export interface RuntimeLike {
  load(ids: readonly string[]): void; setKnobs(id: string, knobs: KnobMap): void; setMoment(label: string): void;
  reset(t: number): void; resetWidget(id: string): void; step(t: number, dt: number, slots: readonly Slot[]): void;
}
export class WidgetRuntime implements RuntimeLike {
  constructor(canvas: HTMLCanvasElement, song: { notes: Note[] }, lib: { sources: Record<string, string>; harness: LabHarness });
  readonly ctx: WidgetCtx; readonly chords: Chord[]; readonly errors: Record<string, string>; resets: number; lastT: number;
  load(ids: readonly string[]): void;   // evaluate each not-yet-loaded widget once, in this order; knobs = resolveKnobs(params)
  loaded(): readonly string[]; tool(id: string): ToolDef | undefined;
  reset(t: number): void;   // the lab's reset(t): lastT = ctx.t = t, level = rate = 0, chord index = first chord after t,
                            // opaque black fill, reset(ctx) on EVERY loaded widget in load order; resets++. feat is untouched.
  step(t: number, dt: number, slots: readonly Slot[]): void;
}
// step order (pinned): ctx.t/dt; fire chords with t ≤ step t; advanceFeatures; shared fade (source-over
// 'rgba(0,0,0,0.12)' fill, then 'color-burn' 'rgb(252,252,252)' fill, then source-over); per slot in order:
//   weight < 1 → copy the canvas into a 1280×720 scratch first; receiving → onChord(ch) for each fired chord;
//   g.save(); frame(); g.restore(); then globalCompositeOperation 'source-over', globalAlpha 1, filter 'none', shadowBlur 0;
//   weight < 1 → draw the scratch over it at alpha 1 − weight (the widget's contribution this frame fades, whatever it draws).
// Every call goes through the lab's safe(): ctx.tool set, first error per widget kept in errors, the step never stops.
// Added in T2: `readonly post: (() => void)[]`, drained at the end of every step (the lab's render-mode RENDER_POST);
// render pages route `queueMicrotask` into it, so pixelsort draws after the others there, as in the lab's render mode.
export interface Stepper { reset(t: number): void; step(t: number, dt: number): void }
export function startLive(s: Stepper, rt: WidgetRuntime, audio: HTMLMediaElement, onFrame?: (t: number) => void): () => void;  // rAF = the lab's frame()
export function exposeRenderApi(s: Stepper, rt: WidgetRuntime, reseed: (seed: number) => void, hz: number): void;
// window.renderSeek(t, seed = 1): reseed, Object.assign(ctx.feat, newFeatures()) (in place, as the lab), ctx.now = 0, s.reset(t)
// · renderStep(dt): n = max(1, ceil(dt·hz − 1e-6))
// equal substeps, each ctx.now += d, s.step · renderTo(t) = renderStep(t − lastT) · renderErrors · renderReady ·
// renderFrameHash(): FNV-1a of getImageData · renderPixels(): base64 RGBA
export function labCompat(rt: WidgetRuntime, only: readonly string[], moments: readonly LabMoment[]): Stepper;
// all loaded, `only` active, lab order, weight 1; each step first rt.setMoment(momentAt(moments, t)), as the lab's step()
// (changed in the T2 review: the moments argument; without it lewitt drew other walls than the lab after a section change)
```

### §4 Show — `src/studio/show/show.ts` (T3)

```ts
export const SHOW_VERSION = 1, DEFAULT_FADE = 3, MAX_LAYERS = 6, MIN_SECTION = 1;
export type KnobSetting = number | Partial<KnobState>;   // number = base; the object is the lab's PST entry ("Copy settings" pastes in)
export interface Layer { widget: string; knobs?: Record<string, KnobSetting>; restart?: boolean }
export interface ShowSection { start: number; end: number; label?: string; fade?: number; layers: Layer[] }   // layers bottom → top
export interface Show { version: 1; id: string; song: string; title?: string;
  composer?: { by: 'auto' | 'claude' | 'user'; at: string }; sections: ShowSection[] }
export interface Issue { path: string; message: string }   // path like 'sections[2].layers[0].knobs.size'
export interface ShowContext { duration?: number; widgets?: ReadonlyMap<string, WidgetMeta> }
export function validateShow(x: unknown, c?: ShowContext): { errors: Issue[]; warnings: Issue[] };
export function repairShow(show: Show, c: ShowContext): { show: Show; fixed: Issue[] };
export function canonicalShow(show: Show): string;   // what shows/<id>.json holds: stable key order, 2-space indent, times to ms
```
Semantics: a widget is one running instance. In consecutive sections it continues (no reset, its knobs switch at the
boundary) unless `restart: true` (reset at the boundary); entering (absent from the previous section) it is reset at
the boundary; leaving, it keeps `frame()` but gets no `onChord` for the next section's `fade` seconds (default 3, 0 =
cut) with weight (1 − u)², u = (t − boundary)/fade. Decaying widgets draw beneath the section's stack. All on one
shared canvas, so an incoming casket slices what the outgoing widgets left.
Errors: version ≠ 1; id/song not slugs; sections empty, unsorted, `start ≥ end`, overlapping or leaving a gap
(> 0.05 s; the message names both sections and the times), first start ≠ 0 (±0.05), last end ≠ duration (±0.5);
unknown widget; a widget twice in one section; drive not a `Drive`; depth outside 0..1. Warnings: section < 1 s,
no layers, > 6 layers, unknown knob key, base outside min..max, fade outside 0..10, unknown properties (typos).
Repair: an overlap ends the earlier section where the later starts; a gap extends the earlier; ends snap to 0 and
duration; sections < 1 s merge into the previous; unknown widgets and duplicates dropped; bases clamped.

### §5 Transitions and the Conductor

```ts
// src/studio/show/schedule.ts (T3, pure)
export interface ScheduledWidget { id: string; receiving: boolean; weight: number; knobs: Record<string, KnobSetting>; section: number }
export function sectionAt(show: Show, t: number): number;          // last section with start ≤ t (0 before it)
export function scheduleAt(show: Show, t: number): ScheduledWidget[];
//   decaying widgets (left at boundary b, b ≤ t < b + fade), oldest first, receiving false; then the section's layers, receiving true, weight 1
export function entriesBetween(show: Show, t0: number, t1: number): { id: string; at: number }[];
//   widgets entering or restarting at a boundary b with t0 < b ≤ t1, by boundary then layer order
// src/studio/show/conductor.ts (T4)
export class Conductor implements Stepper {
  constructor(rt: RuntimeLike, show: Show, meta: (id: string) => WidgetMeta | undefined);  // loads every show widget, first-appearance order;
                                                                                          // meta gives the params resolveKnobs needs
  setShow(show: Show): void;   // live edit: loads new widgets, updates knobs in place, never resets the picture
  reset(t: number): void;      // seek: rt.reset(t); only the section at t plays (nothing decays after a seek)
  step(t: number, dt: number): void;   // resetWidget for entriesBetween(last t, t); setKnobs/setMoment on section change
                                       // (lewitt opens a new wall when the moment changes, so each section gives its own);
                                       // rt.step with scheduleAt(t), decaying slots kept only if drawn in the last step
  preview(t: number): void;    // a paused seek: reset(t − 1), then 60 steps of 1/60 s, so the picture at t shows
}
```

### §6 Auto-composer — `src/studio/compose/` (T3)

```ts
export interface Character { loud: number; dense: number; low: number; fast: number; quiet: number }   // 0..1
export interface Span { start: number; end: number }
export function sectionCharacters(notes: readonly Note[], spans: readonly Span[]): Character[];
//   per span over groupChords(notes): vel = mean of the loudest third of attack vels, rate = attacks/s, poly = notes per
//   attack, lowShare = share of notes with midi < 50. loud/fast/dense = percentile rank of vel/rate/poly among spans
//   (one span → 0.5, but a span without attacks → 0 takes precedence); low = lowShare (no notes → 0); quiet = (1 − loud)·(1 − fast)
export const TASTE: { id: string; role: 'base' | 'accent' | 'top'; fit: Partial<Character> }[];
//   base: kandinsky {dense 1, fast .5}, rorschach {low .8, quiet .5}, current {quiet 1, fast .3}, strings {quiet .8, dense .4},
//   fields {quiet .6}; accent: squares {low 1, loud .5}, flee {fast 1, loud .3}; top: casket {loud 1, dense .5}
export interface ComposeInput { pack: Pick<SongPack, 'id' | 'title' | 'duration' | 'notes' | 'sections'>;
  widgets: ReadonlyMap<string, WidgetMeta>; minSection?: number /* 15 */; maxSections?: number /* max(1, round(duration / 30)) */;
  at?: string /* composer.at; added in T3: the studio passes now, the default (the epoch) keeps composeShow deterministic */ }
export function pickSections(i: ComposeInput): Span[];
//   drop the lowest-novelty boundary touching a span < minSection until none; then the lowest overall until ≤ maxSections;
//   move each boundary to (strongest attack by vel·notes within ±1 s; ties the nearest).t − 0.05 when there is one and both
//   neighbouring spans keep ≥ minSection (their old length if shorter) and ≥ 1 s (T3: so the spans ≥ 15 s test holds after moves);
//   drop ties: the boundary whose merged span is shorter, then the earliest
export function composeShow(i: ComposeInput): Show;
//   eligible = TASTE ids with verdict love or keep; score = Σ fit·character; base = best base (ties: TASTE order), the
//   previous span's base kept when within 0.1 of the best; accent = best accent when ≥ 0.5; casket on top when
//   loud ≥ 0.75 and dense ≥ 0.5; knobs none ("keep OUR defaults"); label = character words ≥ 0.6, highest two,
//   ' · '-joined, else 'calm'; fade DEFAULT_FADE (on every section after the first); composer { by: 'auto' }; id = song = pack.id.
//   Deterministic. No attacks at all → one section [0, duration] (T3). sectionCharacters takes the chords as an optional
//   third argument (one groupChords per compose); percentile rank = (#below + (#equal − 1)/2)/(n − 1), silent spans in the pool.
```

### §7 Studio state, undo, storage (T4)

```ts
// src/studio/show/edit.ts (pure; never mutates; result always validates)
export type ShowEdit =
  | { kind: 'moveBoundary'; index: number; t: number }          // boundary between sections index−1 and index
  | { kind: 'split'; section: number; t: number } | { kind: 'merge'; section: number }   // merge with the next
  | { kind: 'addLayer'; section: number; widget: string; at?: number } | { kind: 'removeLayer'; section: number; layer: number }
  | { kind: 'moveLayer'; section: number; from: number; to: number }
  | { kind: 'setKnob'; section: number; layer: number; key: string; value: KnobSetting | null }   // null = back to default
  | { kind: 'setSection'; section: number; patch: { label?: string; fade?: number } };
export function applyEdit(show: Show, e: ShowEdit): Show;
// src/studio/show/history.ts
export class History { constructor(limit = 200); record(before: Show, group?: string): void;   // same group in a row = one step
  undo(current: Show): Show | null; redo(current: Show): Show | null; clear(): void }
// src/studio/ui/store.ts
export interface StudioState { library: LibraryEntry[]; song: SongPack | null; show: Show | null;
  saved: string | null;                      // canonicalShow of the last saved/loaded show; dirty = canonicalShow(show) !== saved
  origin: 'file' | 'auto' | 'repaired' | null; selected: { section: number; layer: number | null };
  playing: boolean; time: number; ui: { hidden: boolean; recording: boolean };
  notices: { id: string; level: 'info' | 'warn' | 'error'; text: string }[] }
export type Action = { type: 'edit'; edit: ShowEdit; group?: string } | { type: 'undo' } | { type: 'redo' }
  | { type: 'select'; section: number; layer?: number | null } | { type: 'saved' }
  | { type: 'loaded'; song: SongPack; show: Show; origin: StudioState['origin'];
      keepUndo?: boolean /* added in T4 review: a show reloaded from disk keeps the one before it undoable */ }
  | { type: 'notice'; notice: StudioState['notices'][number] } | { type: 'dismiss'; id: string }
  | { type: 'ui'; patch: Partial<StudioState['ui']> };
export class Store { readonly state: StudioState; dispatch(a: Action): void; subscribe(fn: (s: StudioState) => void): () => void }
// src/studio/ui/api.ts
export interface LibraryEntry { id: string; title: string; duration: number; notesFrom: NotesSource; hasShow: boolean; error?: string }
export interface ShowStore {
  readonly writable: boolean;   // false without the dev API (static build): Save downloads <id>.json, drafts in localStorage 'wa-studio.draft.<id>'
  songs(): Promise<LibraryEntry[]>; pack(id: string): Promise<SongPack>; audioUrl(p: SongPack): string;   // /songs/<id>/<audio>
  show(id: string): Promise<Show | null>; saveShow(s: Show): Promise<void>;
  description(id: string): Promise<string>; saveDescription(id: string, text: string): Promise<void>;
  addSong(p: SongPack, audio: Blob): Promise<void>;   // the in-browser fallback's result (static: memory, this session)
}
export function connectStore(): Promise<ShowStore>;   // GET /api/health answers → dev store, else static store
```
Undo covers show edits only; the selection is clamped after undo/redo. One show per song: `shows/<song>.json`.
Keys: Space play/pause · ←/→ ∓5 s · Shift+←/→ previous/next section start · F full screen · H hide UI · S split at
the playhead · Delete remove the selected layer · Ctrl+Z undo · Ctrl+Shift+Z / Ctrl+Y redo · Ctrl+S save (keys are
ignored while typing). Switching songs navigates to `/?song=<id>` (a fresh page, see §2).

### §8 Dev API — `scripts/studio-api.ts`, a Vite plugin (T4)

`studioApi(dirs?: { songs?: string; shows?: string }): Plugin` (dev only) and
`apiMiddleware(dirs: { songs: string; shows: string }): Connect.NextHandleFunction` (tested directly).
`GET /api/health` → `{ ok: true, api: 1 }` · `GET /api/songs` → `{ songs: LibraryEntry[] }` (an invalid pack is listed
with `error`) · `PUT /api/songs/<id>?name=<file>` (audio body ≤ 1 GB) · `PUT /api/songs/<id>/pack` (validatePack, else 400
`{ errors }`) · `GET /api/shows/<id>` → Show | 404 · `PUT /api/shows/<id>` (validateShow with the pack's duration and the
Node catalogue; 400 `{ errors }` or writes `canonicalShow`, 204) · `GET|PUT /api/shows/<id>/description` (text ≤ 20 KB,
`shows/<id>.description.md`) · added in T4: `GET /songs/<id>/pack.json|audio.<ext>` from `dirs.songs` with byte ranges
(206; an mp3 seek needs them), so `WINKELAMP_SONGS` outside the Vite root works. Ids must be slugs (400). Writes only from loopback (403: `server.host` is true, the LAN
sees the dev server). Atomic writes (temp + rename). The plugin watches `shows/*.json` and sends the HMR event
`studio:show-changed` `{ id }`: the studio reloads that show when clean, asks when dirty (Claude edits shows on disk).

### §9 Ears server — `scripts/ears/server.ts` (T5), and the ingest CLI it drives (T1)

```ts
// src/studio/ingest/ears-types.ts (types only, browser-safe; T1 creates it, the server and the studio import it)
export interface IngestProgress { stage: 'decode' | 'transcribe' | 'analyze' | 'write' | 'done'; progress: number; message: string; warnings?: string[]; id?: string }
export interface TranscriberStatus { ok: boolean; python: string | null; device: 'cuda' | 'cpu' | null; reason?: string }
export interface Job { job: string; id: string; state: 'queued' | 'running' | 'done' | 'failed';
  stage: 'upload' | 'decode' | 'transcribe' | 'analyze' | 'write'; progress: number /* 0..1 overall, never decreases */;
  message: string; warnings: string[]; error?: string }
// scripts/ears/server.ts
export interface EarsOptions { port?: number /* 5175 */; songs?: string; maxBytes?: number /* 1 GB */;
  probe?: () => Promise<TranscriberStatus>; runIngest?: (args: string[]) => ChildProcess }   // default: node --import tsx scripts/ingest.ts …
export function startEars(o?: EarsOptions): Promise<{ port: number; close(): Promise<void> }>;   // binds 127.0.0.1
```
HTTP: `GET /health` → `{ ok: true, api: 1, transcriber }` · `POST /ingest?name=<file>[&id=<slug>][&title=<t>]`, body = the
audio streamed to disk → 202 `{ job, id }`, or 200 `{ job: null, id, existing: true }` when an existing pack has the same
sha1, 400 (no name/empty/bad id), 403 (origin), 413 (too big) · `POST /ingest?id=<slug>&redo=1` (no body: re-run on
`songs/<id>/audio.*`, e.g. GPU notes for an approximate pack) → 202 · `GET /jobs/<job>` → `Job` | 404. One job at a
time, FIFO. Transcriber unavailable → the job runs `--notes approx` and its reason goes into `warnings`. The id comes
from the file name (study's slug rule); a different file under a taken id gets `-2`, `-3`…. CORS: the origin is echoed
only for `http://localhost:*` and `http://127.0.0.1:*`; other origins get 403 on POST.

Ingest CLI: `npm run ingest -- <audio> [--id <slug>] [--title "<t>"] [--notes gpu|approx|<notes file>] [--force] [--progress json]`.
Default `--notes gpu`: `scripts/ears/transcribe.py` through `WINKELAMP_PY`, else `C:/Users/maxim/.venvs/wa/Scripts/python.exe`
if it exists, else `python`; cached as `songs/<id>/notes.gpu.json` keyed by the source sha1. Any transcriber failure →
exit 3 with the stderr tail and "pass --notes approx to use approximate notes from the analysis". Same sha1 +
PACK_VERSION already packed → "up to date", exit 0 (unless `--force`). `--progress json`: one stdout line per update,
an `IngestProgress` (progress 0..1 within the stage); overall weights decode .05, transcribe .5 (0 without GPU), analyze .4, write .05. Writes `songs/<id>/{audio.<ext>, pack.json, notes.gpu.json}`.
`transcribe.py <audio> <out.json> [--device auto|cuda|cpu]` writes `{version:1, model:"bytedance-piano-transcription",
device, seconds, notes:[{start,end,midi,vel}]}` sorted by (start, midi); `--probe` prints `{"ok":true,"device":"cuda","torch":"…"}`
or `{"ok":false,"reason":"…"}`; exits 2 usage, 3 missing package or checkpoint (naming the path and the zenodo URL from
the library source), 4 decode failure.

### §10 Export (T6) and the render page (T2, T4)

```ts
// src/visual/recorder.ts (legacy behaviour unchanged by default)
export interface RecorderOptions { videoBitsPerSecond: number; audioBitsPerSecond?: number; fps: number }
export const DEFAULT_RECORDER_OPTIONS: RecorderOptions = { videoBitsPerSecond: 12_000_000, fps: 60 };
export function pickMimeType(isSupported: (type: string) => boolean): string | undefined;   // first of TYPES (MP4 H.264+AAC first)
// new Recorder(canvas, audio, opts = DEFAULT_RECORDER_OPTIONS); pause(); resume()
// src/studio/ui/record.ts
export const RECORD_PRESETS = { share: { videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 128_000, fps: 60 },
                                high:  { videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 192_000, fps: 60 } } as const;
export function mbPerMinute(o: RecorderOptions): number;               // (video + audio)·60/8/1e6, one decimal: share → 8.5
export function recordingName(showId: string, mime: string, at: Date): string;   // 'prelude-2026-10-31-02-03-04.mp4' (.webm for webm)
export class ShowRecorder { constructor(player: Player, canvas: HTMLCanvasElement);
  start(o: { preset: keyof typeof RECORD_PRESETS; from: number }): Promise<void>; stop(): Promise<void>;   // stop() saves what was recorded
  readonly state: 'idle' | 'recording' | 'paused' | 'saving' }
// recording: seek to `from`, reset the picture, start recorder + playback together; audio `ended` → stop → download;
// tab hidden → audio.pause() + recorder.pause(), visible → resume both; UI edits and seeks are locked meanwhile.
```
`render.html` (T2; T4 adds `?show`): both modes install the seeded random before anything loads, set `window.Worker = undefined`
and route `queueMicrotask` into `rt.post`, exactly as the lab's `?render=1` does.
`?labSong=prelude|b5&only=<ids>[&hz=60]` loads `/lab/notes.js` or `/lab/notes-b5.js` like the lab and loads ALL
`toolIds` in lab order through `labCompat` (rorschach draws its paper with `Math.random` at load, so load order is part
of the pixels); `?show=<id>[&hz=60]` loads the show, its pack and a Conductor (meta from `toMeta(rt.tool(id), null)`).
Both expose §3's render API plus `renderInfo` `{ duration, title }`.
`npm run render-show -- <show id | path> [--out renders/<id>.mp4] [--fps 30] [--hz 60] [--from 0] [--to <end>] [--crf 18] [--framemd5 <file>]`:
own Vite server, headless system Chrome, 3 s pre-roll when `--from` > 0, `renderTo(from + k/fps)` per frame, JPEG q 0.92 in
batches of 15 → `ffmpeg image2pipe` → libx264 `-crf 18 -preset medium -pix_fmt yuv420p`, the pack's audio trimmed to
[from, to] → AAC 192k, `+faststart`; progress + ETA every 10 s; widget errors listed at the end; exit 1 if the page fails.

---

### Task 1: Song packs and the GPU ingest CLI

**Files:** Create `src/audio/song-analysis.ts`, `src/studio/pack/{pack,notes,build}.ts`, `src/studio/ingest/ears-types.ts`, `scripts/ingest.ts`,
`scripts/node/{python,pack-io,decode}.ts`, `scripts/ears/transcribe.py`, `scripts/ears/requirements.txt`, `tsconfig.scripts.json`;
tests `tests/{song-analysis,pack-notes,pack-build,ingest-cli}.test.ts`. Modify `scripts/study.ts` (imports the moved
functions), `package.json` (`ingest`; `typecheck` and `build` also run `tsc --noEmit -p tsconfig.scripts.json`), `.gitignore` (`songs/`).

**Interfaces:** Produces §1, the ingest CLI, `transcribe.py` and `ears-types.ts` of §9, and in `scripts/node/`: `findPython(): string | null`,
`probeTranscriber(): Promise<TranscriberStatus>` (runs `--probe`, 90 s timeout), `transcribe(audio, out): Promise<void>`,
`sha1File(path): Promise<string>`, `writeJsonAtomic(path, value): void`, `songsDir(): string`, `isSlug(s): boolean`,
`decodeMono(file, rate = 44100): Float32Array` (the same `spawnSync` ffmpeg call as `scripts/analyze-file.ts`). New
scripts import nothing from the old scripts, so `tsconfig.scripts.json` never pulls unchecked legacy files into the build gate.
`tsconfig.scripts.json` includes `scripts/{ingest,check-show,describe-song,widget-docs,studio-api}.ts`, `scripts/ears/**/*.ts`, `scripts/node/**/*.ts`.

- [ ] **Step 1: Move without changing study.** Before: `ffmpeg -t 30 -i lab/prelude.mp3 <scratch>/s30.wav`,
  `npm run study -- <scratch>/s30.wav --id move-check`, keep `corpus/move-check.data.json` and
  `study/move-check/analysis.json`. Move `trackBeats`, `chords` (exported as `chordChanges`), `ONSET_LAG`, `PULSE_MIN`
  verbatim; rerun; `cmp` both files → identical. Delete the move-check outputs.
- [ ] **Step 2: Failing tests.**
  - `song-analysis`: PCM 44.1 kHz = 2 s silence + 8 s of decaying 220/330/440 Hz tones every 0.5 s + 2 s silence →
    `duration ≈ 12 ±0.01`; `sections[0].start === 0`, last `end === duration`, contiguous; `loudness.values.length === 120`,
    all in 0..1, mean of the first 1.5 s < 0.05; `onsets.length ≥ 10`, none before 1.8 s; beats sorted within [0, 12];
    no NaN anywhere. (Keep real analysis to this 12 s signal: CI runs `npm test` on every deploy.)
  - `pack-notes`: `parseNotesFile('window.NOTES=[[5.198,7.0057,57,103],[5.2005,6.9941,45,110]];')` → the two tuples in
    order; transcribe.py JSON `{notes:[{start:1,end:2,midi:60,vel:80}]}` → `[[1,2,60,80]]`; garbage throws `/notes/`.
    `approximateNotes({ onsets: [{t:1,s:0.8}], melody: [{start:0.98,end:1.6,midi:72.2,strength:0.5,confidence:0.8}],
    harmony: [{t:0,root:1,minor:true}], duration: 10 })` → `[[1,3,37,92],[1,2,64,82],[1,1.6,72,102]]` (sorted by start, then midi);
    an onset with s 0.3 gives only the top note; a melody note 0.4 s from any onset → `[start,end,round(midi),round(30+70·strength)]`;
    no harmony → no bass or mid. `onsetCoverage`: onsets (s 0.5) at 1, 2, 3, 4 with notes starting at 1.02 and 2.5 → 0.25.
    `mergeNotes` keeps every gpu note and adds only approx notes > 0.06 s from all gpu starts.
  - `pack-build`: gpu notes with coverage ≥ 0.35 → `notesFrom 'gpu'`; coverage 0.2 → `'merged'` + warning containing
    `heard little`; `from: 'file'` with coverage 0 → `'file'`, notes identical to the input (same order); `notes: null` →
    `'approx'` + warning `approximate`; zero notes → warning `no notes found`; a synthetic 600 s `SongAnalysis`
    (loudness length 6000, 80 contiguous sections, 9000 notes) → a valid pack in < 1 s; every result passes `validatePack`;
    `validatePack` rejects version 2, unsorted notes, `end < start`, a section gap, a bad id.
- [ ] **Step 3:** Run `npx vitest run tests/song-analysis.test.ts tests/pack-notes.test.ts tests/pack-build.test.ts` → FAIL (missing modules).
- [ ] **Step 4:** Implement `analyzeSong`, `notes.ts`, `pack.ts`, `buildPack` (§1). Run the three tests → PASS.
- [ ] **Step 5:** Write `transcribe.py` + `requirements.txt` from brief step 1 (decode with
  `ffmpeg -v error -i IN -ac 1 -ar 16000 -f f32le -`; `PianoTranscription(device=…)`; reference
  `C:/Users/maxim/AppData/Local/Temp/claude/C--Users-maxim-Desktop-projects-github-WinkelAmp--claude-worktrees-ambitious-project-continuation-ff6d7f/b3b4a070-2436-40c2-8249-6478eeb5f1d5/scratchpad/ears/mel/trans.py`).
  Run `C:/Users/maxim/.venvs/wa/Scripts/python.exe scripts/ears/transcribe.py --probe` → `{"ok":true,"device":"cuda",…}`.
- [ ] **Step 6:** Implement `scripts/node/*`, `scripts/ingest.ts` (§9), `tsconfig.scripts.json`, the package scripts,
  `.gitignore`. `ingest-cli` test (`it.skipIf` no ffmpeg; temp `WINKELAMP_SONGS`): a 3 s `ffmpeg -f lavfi -i sine=f=220:d=3`
  WAV with `--notes approx` → exit 0, valid pack, `notesFrom 'approx'`, `audio.wav` copied; again → stdout `up to date`;
  `--notes gpu` with `WINKELAMP_PY=<tmp>/missing.exe` → exit 3, stderr contains `--notes approx`. Run it → PASS.
- [ ] **Step 7: Real files.** `npm run ingest -- lab/prelude.mp3 --id prelude --title "Rachmaninoff: Prelude in C♯ minor" --notes lab/notes.js`
  and `npm run ingest -- lab/beethoven5.mp3 --id beethoven5 --title "Beethoven: Symphony No. 5, I" --notes lab/notes-b5.js`
  → `notesFrom 'file'`, note counts equal the lab files', durations 232.1 / 424.8 (±0.2). GPU: `ffmpeg -t 60 -i lab/prelude.mp3 -c copy <scratch>/p60.mp3`,
  `npm run ingest -- <scratch>/p60.mp3 --id gpu-check` → `notesFrom 'gpu'`, `device 'cuda'`, ≥ 90 % of the lab's notes
  before 60 s have a GPU note of the same midi within 50 ms; then delete `songs/gpu-check`.
- [ ] **Step 8:** `npm test` and `npm run typecheck` → PASS. Commit: `git add src/audio/song-analysis.ts src/studio/pack scripts/ingest.ts scripts/node scripts/ears scripts/study.ts tsconfig.scripts.json package.json .gitignore tests`, message `Studio: song packs and the GPU ingest CLI`.

### Task 2: The widget runtime, pixel-identical to the lab

**Files:** Create `src/widgets/{types,lab-harness,random,chords,features,instantiate,sources,runtime,driver,catalogue}.ts`,
`render.html`, `src/studio/render-page.ts`, `scripts/fidelity.mjs`; tests `tests/widgets-{harness,chords,features}.test.ts`.
Modify `package.json` (`fidelity`).

**Interfaces:** Produces §2, §3. `sources.ts` (browser only): `labWidgetSources(): Record<string, string>` from
`import.meta.glob('/lab/tools/*.js', { query: '?raw', import: 'default', eager: true })` keyed by file name (bundled, so
`dist` works; `lab/tools/dropped/` is not matched) and `labHarness(): LabHarness` from a static `import '/lab/index.html?raw'` (so `labHarness()` stays synchronous);
`labSongs(): Record<string, LabSong>` from the same import (render.html's `labSong` mode takes notes file, title, length
and moments from it, never a copy).
`instantiate(id: string, source: string, env: { icon: IconLib; chords: Chord[] }): ToolDef`.
`catalogue.ts`: `toMeta(tool: ToolDef, verdict: Verdict | null): WidgetMeta`.

- [ ] **Step 1: Failing tests.**
  - `widgets-harness` (reads the real `lab/index.html`): `toolIds` starts `['harmonograph','hilma','kline']`, contains
    `'casket'`, and every id has `lab/tools/<id>.js`; `verdicts.casket.v === 'love'`, `verdicts.fields.v === 'keep'`;
    `drives.length === 11`, `drives[0]` is `['', 'fixed']`, contains `['+density', 'fuller chords → more']`;
    `makeIcon(iconSource)` has functions `dot ring square rect line arrow lines dots wave blur alpha palette pie fade shake keys trail glyph shape gauge rng lerp`
    and `of.size`; `readLabHarness('<html></html>')` throws `/TOOL_IDS/`; `labRandom(1)` and `labRandom(42)` equal, for
    100 values, the lab's `Math.random` body cut out of `lab/index.html` and evaluated with the same seed;
    `readLabSongs` gives prelude `notes.js` with moment `[124, 'casket', 'The casket']` and b5 `notes-b5.js`, throws `/SONGS/`
    on `<html></html>`; `momentAt` at −3, 0, 82.99, 83, 124, 500 → dread dread dread agitato casket agitato.
  - `widgets-chords`: `[[1,2,60,80],[1.03,2,64,90],[1.039,1.5,67,70],[1.045,2,72,60],[1.07,2,48,50]]` → two chords:
    `{t:1, vel:90, lo:60, hi:67}` with 3 notes and `notes[1].d ≈ 0.97`, then `{t:1.045, lo:48, hi:72}` with 2 notes;
    notes at 0 and 0.04 → two chords; `soundingAt([[0,20,40,90]], 10)` → `[]` (the lab's 8 s look-back);
    `firstAtOrAfter` returns the lower bound on start.
  - `widgets-features`: `knobValue({min:0,max:2,value:1}, {base:1,drive:'+level',depth:0.5}, {level:0.2,…})` → 1.2, at
    level 1 → 2 (clamped); `'-pitch'` at pitch 0.5 → base, at pitch 1 → base − 0.25·range; `drive ''` → base clamped;
    `resolveKnobs` → `{base: q.value, drive: q.drive ?? '', depth: 0.5}`, a number sets base, `{drive:'-rate'}` merges,
    unknown keys ignored. `advanceFeatures`: level 0.5 after dt 0.8 → 0.25; rate 1 after dt 1 → 0.5; a vel 115 chord →
    level 1, rate += 1/1.44, `f.rate = min(1, rate/8)`; dt 0.25 moves pitch/bass/density halfway; two notes m < 50 at
    v 127 → bass target 1; five sounding → density target 0.5; nothing sounding → pitch holds.
    `liveClock(10, 10.6, false)` → `{reset:true, dt:0}`; `(10, 10.02, false)` → dt 0.02; `(10, 10.2, false)` → dt 0.05;
    `(10, 10.02, true)` → dt 0; `(10, 11, true)` → reset true.
- [ ] **Step 2:** Run them → FAIL. Implement `types`, `lab-harness`, `random`, `chords`, `features`. Run → PASS.
- [ ] **Step 3:** Implement `instantiate`, `sources`, `runtime` (§3 step order), `driver` (`startLive`, `exposeRenderApi`,
  `labCompat`), `catalogue`, and `render.html` + `render-page.ts` in `labSong` mode (§10).
- [ ] **Step 4: Fidelity.** `scripts/fidelity.mjs` (`npm run fidelity`; local only: skips with a message without
  `lab/notes.js`/`lab/notes-b5.js`). One Vite server; for each case open `lab/index.html?render=1&only=<ids>&song=<s>&hz=60`
  and `render.html?labSong=<s>&only=<ids>&hz=60`; on both `renderSeek(start − 3, 1)`, `renderTo` at 30 fps, compare
  at start + 1, + 2.5, + 4 s: `renderFrameHash()` first, `renderPixels()` diffed in Node only when hashes differ. Cases:
  every `toolIds` widget alone at prelude 126 s and b5 0 s; the ten `VERDICTS` widgets alone at prelude 0, 86, 126,
  176 and b5 0, 345; `squares,casket` at prelude 126; `kandinsky,rorschach` at b5 0. Long cases (own page each), checked at
  start + 4.5, 6, 8, 11 s, across a section change more than 4 s after the seek: every widget whose file reads `.moment`
  (lewitt) and `squares,casket` at prelude 119 (change at 124), the same and `kandinsky,rorschach` at b5 15 (change at 20).
  Control: the lab against a second
  lab load. One page per side per widget set, its cases in the same order on every page (widgets keep closure state
  across `renderSeek`, like the lab's). Pass per case: hashes equal, or share of pixels off by > 2 ≤ the control's
  + 0.1 % and max diff ≤ the control's + 8, or at most 40 pixels off by > 2 and none by > 32 (GPU rasterisation of a few edge pixels is
  not repeatable: prelude murmuration 0 + 1 s was off by up to 12 on a handful of pixels in two runs of three). The lab has no `renderFrameHash`/`renderPixels` (and `lab/` is not edited), so the
  script computes both in-page with one identical function on every page, at the same frames. `pixelsort` is included: with
  the render-mode `queueMicrotask` route above it is deterministic in both pages. Options: `--only <ids>`, `--quick` (one
  start per widget set), `--stills <dir>` (lab | studio | difference PNGs). Run → all PASS; print the table.
- [ ] **Step 5:** `npm test`, `npm run typecheck` → PASS. Commit (`src/widgets render.html src/studio/render-page.ts scripts/fidelity.mjs package.json tests`): `Studio: the widget runtime, pixel-identical to the lab`.

### Task 3: Show format, validator, transitions, auto-composer, Claude composes

Depends on T1 (pack types) and T2 (`groupChords`, harness, `makeIcon`).

**Files:** Create `scripts/node/catalogue.ts`, `src/studio/show/{show,schedule}.ts`, `src/studio/compose/{character,taste,compose}.ts`,
`scripts/{check-show,describe-song,widget-docs}.ts`, `docs/COMPOSING-SHOWS.md`, `shows/.gitkeep`; tests
`tests/{widgets-catalogue-node,show-validate,show-schedule,compose}.test.ts`. Modify `package.json`.

**Interfaces:** Consumes §1, §2. Produces §4, §5 (schedule), §6 and
`loadCatalogue(o?: { repo?: string; sources?: Record<string, string> }): { widgets: Map<string, WidgetMeta>; failed: { id: string; error: string }[] }`
(evaluates every tool file in `node:vm` with `document.createElement('canvas')` returning a canvas whose 2D context is
a no-op Proxy (`getImageData`/`createImageData` return zeroed data, `measureText` `{width: 0}`), `window = { NOTES: [] }`,
the lab's ICON, no `Worker`; `toolIds` order, then any other `lab/tools/*.js`).

- [ ] **Step 1: Catalogue.** Test: `loadCatalogue()` → `failed` empty, ids in `toolIds` order, each with a name and
  params where `min < max`, `min ≤ value ≤ max`, drive valid; `casket` verdict love; a `sources` entry `oops` with
  `throw 1` → `failed[0].id === 'oops'`. FAIL → implement → PASS.
- [ ] **Step 2: `show-validate`** over a 100 s song: a good 3-section show (squares; kandinsky; kandinsky + casket) →
  no errors or warnings; sections `[0,50],[45,100]` → error at `sections[1].start` whose message has `overlap`, `45`, `50`;
  `[0,40],[50,100]` → error with `gap`, `40`, `50`; first start 2 → error; last end 90 → error; unknown widget and a
  widget twice in one section → errors; unknown knob, base out of range, fade 12, 7 layers, a property `knob` → warnings;
  drive `'+loud'`, depth 2, version 2 → errors. `repairShow` on the overlap and on the gap → no errors after, overlap
  becomes `[0,45],[45,100]`, gap `[0,50],[50,100]`; a 0.4 s section merges into the previous. `canonicalShow` is a fixed
  point of parse ∘ canonical, orders keys version, id, song, title, composer, sections / start, end, label, fade, layers
  / widget, knobs, restart, and rounds times to ms. FAIL → implement §4 → PASS.
- [ ] **Step 3: `show-schedule`** with A [0,10] {squares, kandinsky}, B [10,20] {kandinsky with knobs `{edges: 0.9}`, casket}
  fade 3, C [20,30] {squares} fade 0: at 5 → squares, kandinsky receiving, weight 1; at 10.5 → kandinsky receiving with
  B's knobs and no entry for it; at 11.5 → squares first, receiving false, weight 0.25; at 13.01 → no squares; at 20.001
  → only squares; `entriesBetween(9.9, 10.1)` → `[{id:'casket', at:10}]`, `(19.9, 20.1)` → `[{id:'squares', at:20}]`;
  B's kandinsky with `restart: true` → kandinsky enters at 10 too; A [0,10] X, B [10,11] Y fade 3, C [11,20] Z fade 3
  → at 11.5 X has weight (1 − 1.5/3)², Y (1 − 0.5/3)², X drawn before Y. FAIL → implement → PASS.
- [ ] **Step 4: `compose`** on generated packs (helper `makePack({ duration, parts: [{ from, to, rate, vel, register }] })`):
  same input twice → identical `canonicalShow`; output validates for a quiet-then-loud 120 s pack, a zero-note pack
  and a 600 s pack with 80 analysis sections; spans ≥ 15 s and ≤ `max(1, round(duration/30))`; a boundary near an
  attack sits at attack.t − 0.05; only `casket squares rorschach kandinsky flee current strings fields` appear; casket
  only where loud ≥ 0.75, always the top layer; the quiet part (middle register) gets a base ∈ {current, strings, fields};
  zero notes with one analysis section → one section `[0, duration]` with `[{ widget: 'current' }]`;
  `sectionCharacters`: the louder part ranks louder, the faster
  faster, an all-bass part has `low ≈ 1`, one span → ranks 0.5. FAIL → implement §6 → PASS.
- [ ] **Step 5: Claude composes.** `npm run check-show -- [files…]` (default `shows/*.json`; prints errors and warnings
  with paths; exit 1 on errors; `--fix` writes the repair). `npm run describe-song -- <id>` (markdown to stdout: title,
  duration, notes source and warnings, a table of the analysis sections with `sectionCharacters` words, loudness and
  attacks per second every 10 s). `npm run widget-docs [-- --check]` fills `docs/COMPOSING-SHOWS.md` between
  `<!-- widgets:start -->` and `<!-- widgets:end -->` (per widget: id, name, verdict, blurb, knobs key/label/min..max/default/drive/hint),
  `--check` exits 1 when stale (like `npm run cast`). The doc's hand-written part: the workflow (describe-song → read
  `shows/<id>.description.md` → write `shows/<id>.json` → check-show → `render-show --from --to` for a look), the schema
  (§4) with one example, the transition semantics, and the user's taste (abstract; loved widgets; "keep OUR defaults").
  Verify: a fixture with an overlap → `npm run check-show -- <it>` exits 1 naming both sections; `npm run widget-docs -- --check` exits 0.
- [ ] **Step 6:** `npm test`, `npm run typecheck` → PASS. Commit: `Studio: shows, their validator, transitions and the auto-composer`.

### Task 4: The studio: conductor, editor, player, legacy.html

Depends on T1–T3.

**Files:** Create `src/studio/show/{conductor,edit,history}.ts`, `src/studio/ui/{main,store,api,player,timeline,panel,knobs,library,keys}.ts`,
`src/studio/ui/style.css`, new `index.html`, `scripts/studio-api.ts`, `scripts/studio-check.mjs`, `scripts/fixtures/demo-notes.json`
(30 s of chords for a test song); tests `tests/{show-edit,show-history,show-conductor,studio-api}.test.ts`.
Move `index.html` → `legacy.html` (`git mv`, content untouched). Modify `vite.config.ts` (plugin; `build.rollupOptions.input`
= index, legacy, render), `src/studio/render-page.ts` (`?show`), `scripts/{screenshots,e2e-check,preview-script}.mjs`
(`/` → `/legacy.html`), `README.md`, `package.json` (`studio-check`).

**Interfaces:** Consumes §2–§6. Produces §5 (Conductor), §7, §8, and
`class Player { constructor(canvas, audio, conductor, runtime); play(): Promise<void>; pause(): void; toggle(): void;
seek(t: number): void /* paused → conductor.preview(t) */; readonly time: number; readonly duration: number;
audioStream(): MediaStream /* routes the element through Web Audio on first call */; onTick?: (t: number) => void }`.

- [ ] **Step 1: Failing tests.**
  - `show-edit` (fixture deep-frozen): `moveBoundary` clamps so both neighbours keep ≥ 1 s; `split` at t gives two
    sections with the same layers and label, the second with `fade` 3; a split < 1 s from an edge returns the input;
    `merge` keeps the first's layers and label and the second's end, on the last section returns the input;
    `addLayer` of a present widget returns the input; `moveLayer`, `removeLayer`; `setKnob` with 1.2 → `knobs.size === 1.2`,
    with `null` → key removed and empty `knobs` removed; `setSection` clamps fade to 0..10; every result validates.
  - `show-history`: undo/redo restore exact shows; three records in group `knob:0:0:size` undo in one step; a new
    record clears redo; the 201st record drops the oldest.
  - `show-conductor` (fake `RuntimeLike` logging calls): construction loads widgets in first-appearance order with
    resolved knobs; stepping 9.9 → 10.1 calls `resetWidget('casket')` before `step`, and the step's slots carry squares
    with weight < 1 first; `reset(10.5)` then a step → no decaying slots; `setShow` with a changed knob → `setKnobs`, no reset.
  - `studio-api` (temp dirs, middleware called with fake req/res): `/api/songs` lists a valid pack and lists a broken
    one with `error`, ignores a folder without `pack.json`; `PUT /api/shows/demo` writes exactly `canonicalShow`; an
    overlapping show → 400 with `errors[0].message` containing `overlap`; id `..` → 400; remote address `192.168.1.5` → 403;
    description round-trips; 21 KB → 413.
- [ ] **Step 2:** Run → FAIL. Implement `edit`, `history`, `conductor`, `studio-api` → PASS.
- [ ] **Step 3: Pages.** `git mv index.html legacy.html`; new `index.html` (studio shell); `vite.config.ts`; the three
  scripts to `/legacy.html`; `render.html?show=<id>`. Run `npm run build` → PASS (dist has index, legacy, render).
- [ ] **Step 4: The studio UI** (dark, the lab's palette `--bg #08070a --fg #e9e2da --dim #8d8379 --line #2a2428 --on #b43a2a`):
  library drawer (songs, notes-source badge, show status, link to the widget lab and to legacy.html "Old app:
  microphone, MIDI"); the stage (1280×720 canvas, `object-fit: contain`, full screen on the stage box, cursor hidden
  after 2 s in full screen); transport + timeline (sections coloured by their bottom widget, a hue hashed from the id;
  boundaries draggable with snapping to an attack within 0.25 s − 0.05, Alt disables; split, merge; playhead); side
  panel: section label, fade, the layer stack (add from the catalogue, loved first with the lab's verdict tags; remove;
  reorder) and each layer's knobs as the lab draws them (pictures at both ends, the live one by the name redrawn ~8×/s
  when driven, the `i` hint, the drive select with `harness.drives` words); a Show tab with the "Describe the show"
  box (saved to `shows/<id>.description.md`, with a line on asking Claude Code to compose from it); notices (repaired
  show, approximate notes, widget errors from `runtime.errors`); §7 keys; a show changed on disk reloads. On boot:
  `?song=` or the last song (`wa-studio.last-song`) or the first; no saved show → `composeShow` (origin `auto`); a show
  with errors → `repairShow` (origin `repaired`, dirty, notice). The browser catalogue: one template instance per lab
  widget (`instantiate`, never drawn) gives names, params, icons and, with `harness.verdicts`, the `WidgetMeta` map;
  the runtime holds only the show's own instances. Expose `window.__studio = { runtime, store, player }` for checks.
- [ ] **Step 5: `scripts/studio-check.mjs`** (`npm run studio-check`): temp songs/shows dirs; a 30 s `sine` WAV ingested
  with `--notes scripts/fixtures/demo-notes.json`; own Vite server with `WINKELAMP_SONGS`/`WINKELAMP_SHOWS`; Chrome with
  `--autoplay-policy=no-user-gesture-required`. Assert: the library lists the song; after 2 s of play > 1 % of canvas
  pixels are non-black; resizing the viewport 1280×800 → 900×600 keeps `canvas.width === 1280`, `height === 720` and
  `runtime.resets` unchanged; `H` hides the UI and shows it again; dragging a boundary makes the show dirty, Ctrl+Z
  makes it clean; adding `casket` shows 5 knob rows with 3 canvases each; the `squares` icon canvases at v = 0 and 1 equal
  the lab card's (`toDataURL`, deviceScaleFactor 1); Ctrl+S writes a show that `validateShow` accepts; an overlapping
  show fixture opens with a `repaired` notice and plays; no page errors; `legacy.html` loads without page errors. From the
  T2 review (nothing ran these in a browser): a slot at weight < 1 draws between the canvas without it and with it at
  weight 1; pausing the audio (and hiding the tab) keeps the canvas hash unchanged over 1 s, and a jump > 0.5 s resets
  (`runtime.resets` + 1). Run → PASS.
- [ ] **Step 6: A transition by eye.** Render `render.html?show=<fixture>` frames every 0.25 s from 1 s before to 4 s
  after a kandinsky → kandinsky + casket boundary into a contact sheet (ffmpeg `tile`); read it: the cut slices the
  painting, nothing pops. Fix what doesn't hold.
- [ ] **Step 7:** README: `npm run dev` opens the studio; ingest, ears, render-show; legacy.html. `npm test`,
  `npm run typecheck`, `npm run build` → PASS. Commit: `Studio: the studio page, its editor and player; the old app moves to legacy.html`.

### Task 5: Ears server, drop a file, in-browser fallback

Depends on T1 and T4.

**Files:** Create `scripts/ears/server.ts`, `src/studio/ingest/{ears-client,fallback,analyze.worker}.ts`; test
`tests/ears-server.test.ts`. Modify `src/studio/ui/library.ts` (drop zone, file input, progress, Re-ingest),
`scripts/studio-check.mjs`, `package.json` (`ears`).

**Interfaces:** Consumes §1, `buildPack`, `approximateNotes`, `ShowStore.addSong`. Produces §9 and
`probeEars(timeoutMs = 800): Promise<TranscriberStatus | null>`, `ingestViaEars(file: File, onJob: (j: Job) => void): Promise<string /* id */>`,
`decodeToMono(file: Blob, rate = 44100): Promise<Float32Array>` (OfflineAudioContext, main thread),
`ingestInBrowser(file: File, store: ShowStore, onProgress: (f: number) => void): Promise<SongPack>` (sha1 by
`crypto.subtle`, the Worker runs `analyzeSong` + `buildPack(notes: null)`; messages `{type:'progress', progress}` |
`{type:'done', pack}` | `{type:'error', message}`).

- [ ] **Step 1: `ears-server` test** (`startEars({ port: 0, songs: tmp, probe, runIngest: fake })`, the fake a node
  child that prints progress lines and writes a pack): `/health` → `{ ok: true, api: 1, transcriber.ok: true }`;
  `POST /ingest?name=a.wav` → 202 `{ id: 'a' }`, the job goes queued → running → done with non-decreasing progress and
  the fake got `--id a --notes gpu --progress json`; probe `{ ok: false, reason: 'no python' }` → `--notes approx` and
  warnings contain `no python`; the same bytes again → 200 `existing: true`; other bytes as `a.wav` → id `a-2`; a
  second upload waits until the first is done; a fake exiting 1 with `boom` → `failed`, error contains `boom`; origin
  `http://localhost:5173` echoed, `http://evil.example` → 403; `maxBytes: 1024` and 2 KB → 413; `id=..` → 400. FAIL → implement → PASS.
- [ ] **Step 2:** Implement the client, the fallback Worker, the drop zone (window `dragover`/`drop` + a file input
  accepting `audio/*,video/*`), job progress in the library, the banner for `approx`/`merged` packs with "Re-ingest
  with the transcriber" (POST `redo=1`) when ears is up, and the "transcriber unavailable: <reason>" notice.
- [ ] **Step 3:** Extend `studio-check`: ears down → set the 30 s WAV on the file input → a notice containing
  `approximate`, the song appears and plays (non-black after 3 s). Run → PASS.
- [ ] **Step 4: GPU path by hand.** `ffmpeg -t 60 -i lab/prelude.mp3 -c copy <scratch>/p60.mp3`; `npm run ears`;
  drop `<scratch>/p60.mp3` in the studio → job reaches done, pack
  `notesFrom 'gpu'`; `WINKELAMP_PY=C:/nope/python.exe npm run ears` → the same drop gives approximate notes and the
  reason. Delete the test songs.
- [ ] **Step 5:** `npm test`, `npm run typecheck` → PASS. Commit: `Studio: drop a recording: the ears server and the in-browser fallback`.

### Task 6: Export: in-app MP4 and the offline renderer

Depends on T4.

**Files:** Modify `src/visual/recorder.ts`, `.gitignore` (`renders/`), `package.json` (`render-show`, `record-check`).
Create `src/studio/ui/record.ts`, `scripts/render-show.mjs`, `scripts/record-check.mjs`; test `tests/record-presets.test.ts`.

**Interfaces:** Consumes `Player`, the render API (§3, §10). Produces §10.

- [ ] **Step 1: `record-presets` test:** `mbPerMinute(RECORD_PRESETS.share) === 8.5`; `pickMimeType(t => true)` →
  `'video/mp4;codecs=avc1.640033,mp4a.40.2'`, `pickMimeType(t => t.startsWith('video/webm'))` → `'video/webm;codecs=vp9,opus'`,
  nothing supported → `undefined`; `recordingName('prelude', 'video/mp4', new Date(2026, 9, 31, 2, 3, 4))` →
  `'prelude-2026-10-31-02-03-04.mp4'`; `DEFAULT_RECORDER_OPTIONS.videoBitsPerSecond === 12_000_000`. FAIL → implement → PASS.
- [ ] **Step 2:** `ShowRecorder` and the UI: Export menu ("Record video: whole song" / "from the playhead", preset
  share ≈ 8.5 MB/min or high), a REC indicator with elapsed/total, Stop (saves), auto-stop on `ended`, hidden-tab pause.
  A `?recordCheck=<s>` hook stops after s seconds as if the song ended (checks only).
- [ ] **Step 3: `record-check.mjs`** (the T4 fixture song; Chrome with autoplay allowed; downloads accepted): record 20 s
  with `?recordCheck=20` → ffprobe: h264 video, aac audio, 20 ± 1 s, size ≤ 4.0 MB (8.5 MB/min × 1.4); record the whole
  30 s song with no hook → it stops by itself, 30 ± 1 s; during a recording fake `document.hidden = true` +
  `visibilitychange` → `audio.paused` and recorder `paused`, then visible → both resume and the file is still 20 ± 1 s.
  Run → PASS. Then record 60 s of the Prelude in the real studio and note MB/min; if Chrome overshoots 1.4×, lower
  `share` to 800 kb/s and re-run.
- [ ] **Step 4: `render-show.mjs`** (§10). Verify: `npm run render-show -- <fixture show> --from 5 --to 15 --out <tmp>/a.mp4`
  → ffprobe 1280×720, 30 fps, 300 frames, audio 10 ± 0.05 s; two runs with `--framemd5` → identical lists.
- [ ] **Step 5:** `npm test`, `npm run typecheck`, `npm run build` → PASS. Commit: `Studio: export: MP4 recording in the app and npm run render-show`.

### Task 7: The user's Prelude and Beethoven shows, rendered

Depends on T1–T6 (packs from T1 step 7).

**Files:** Create `shows/prelude.json`, `shows/beethoven5.json`.

- [ ] **Step 1: Compose by hand, as COMPOSING-SHOWS.md tells Claude**, sections and labels from the lab's
  `SONGS.moments` (its label, else its mood name), knobs at defaults. Starting casts (bottom → top), to adjust after Step 3:
  - prelude: 0 Dread {squares, current} · 83 Agitato {kandinsky, flee} · 124 The casket {kandinsky, squares, casket} ·
    176 Return {rorschach, strings} · 208 Agitato {rorschach, flee} · end = pack duration.
  - beethoven5: 0 Fate knocks {squares, casket} · 20 Agitato {kandinsky, flee} · 80 Repeat {squares, casket} ·
    100 Agitato {kandinsky, flee} · 160 Development {rorschach, casket} · 180 Agitato {rorschach, strings} ·
    258 Oboe’s lament {strings, fields} · 275 Recapitulation {kandinsky, flee} · 340 Coda {kandinsky, squares, casket} ·
    end = pack duration.
- [ ] **Step 2:** `npm run check-show` → exit 0, no warnings.
- [ ] **Step 3: Look.** For each show, `npm run render-show -- <id> --from <b − 3> --to <b + 12>` around three boundaries
  (prelude 83, 124, 176; beethoven5 20, 160, 340) and contact sheets of one frame per 0.5 s; read them. Change a cast
  only where a frame shows a clash or an empty stretch; never more than two rounds.
- [ ] **Step 4: Full renders.** `npm run render-show -- prelude` and `-- beethoven5` → `renders/prelude.mp4`,
  `renders/beethoven5.mp4`: ffprobe 1280×720, 30 fps, durations equal the packs' (±0.1 s), AAC present; no widget
  errors. Contact sheets one frame per 10 s (`renders/<id>-sheet.png`). Record the first 60 s of the Prelude in the
  studio (share preset) and note its size.
- [ ] **Step 5:** Commit `shows/` only: `Studio: the Prelude and Beethoven shows`.

### Task 8: Final review

- [ ] **Step 1:** `npm test`, `npm run typecheck`, `npm run build`, `npm run widget-docs -- --check`, `npm run fidelity`,
  `npm run studio-check`, `npm run record-check` → all PASS.
- [ ] **Step 2: Review Focus by hand,** each with its outcome written into the report: an 11-minute file (`ffmpeg`
  concat of the two recordings) through `npm run ears` + drop, timed, then opened and played; 5 s silence + 10 s tones +
  5 s silence, and 20 s of pure silence; `.superpowers/sheet/hungarian.mp3` (orchestral: expect the coverage warning);
  ears with `WINKELAMP_PY=C:/nope/python.exe`; a copy of `shows/prelude.json` with an overlap and a gap (check-show
  exit 1, the studio repairs it); resize and full screen while playing; switch tabs for 10 s while playing and while
  recording.
- [ ] **Step 3:** Run the `code-review` skill at `high` on the branch diff against `claude/wizardly-franklin-ttaqyo`;
  fix every confirmed finding with a test; rerun Step 1.
- [ ] **Step 4:** README and `docs/COMPOSING-SHOWS.md` current; commit `Studio: final review fixes`.
- [ ] **Step 5:** Report to the user: what works, the render and contact-sheet paths, measured numbers (ingest time,
  MB/min, render speed, fidelity table), known limits (pixelsort not frame-exact, 720p), and that nothing was merged
  into the main branch (their call).
