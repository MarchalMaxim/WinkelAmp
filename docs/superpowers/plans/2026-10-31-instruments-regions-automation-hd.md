# Instruments, Regions, Intensity Lanes, Tags and the HD Master: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to carry out this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Tasks in the same wave run in parallel, each in its own git worktree, and a reviewer follows each one (see
> *Parallel execution*).

**Goal.** A layer can listen to one instrument or line of the music, be seen only in a placed region, and follow an
intensity curve drawn like DJ automation. Widgets carry synesthetic tags that the composer uses. A show renders as a
supersampled 60 fps HD master, plus a WhatsApp share copy.

**Architecture.**

- **Instrument notes.**
  - YourMT3+ is found through `ymt3.json` and run by `scripts/ears/ymt3.py`.
  - It gives per-instrument notes, which ingest turns into pack v2 `tracks`, with estimated velocities and gap-filled
    all-notes.
  - Melody, bass line and the other derived lines are computed at run time.
- **The new maths lives once.** Curves, thinning, visibility, lines, the per-instance pulse and region compositing are
  plain JS in `lab/layers/*.js`.
  - The lab loads the files as scripts.
  - The studio and Node evaluate the same text through `src/widgets/layers.ts`.
- **The runtime.**
  - `WidgetRuntime` runs *instances* (`widget` or `widget@listen`).
  - A slot without a layer takes today's exact statements. A slot with one goes through the shared `drawLayered`.
  - A `scale` option supersamples the canvas behind a context proxy, so widgets keep drawing in 1280×720 units.
- **Shows.** Shows become v2 (`listen`, `region`, `intensity`), and v1 files stay byte-identical.
- **The studio UI.** It edits all of it with a panel, a stage overlay and lanes under the timeline.
- **The renderer.** `render-show` pipes raw frames to x264 and makes a share copy.

**Tech stack** (as last night): Vite 8, strict TypeScript, vitest, Canvas 2D, Playwright with system Chrome, ffmpeg 8,
Node 22 + tsx. Python venvs:
- `C:/Users/maxim/.venvs/wa`: the piano model.
- `C:/Users/maxim/.venvs/wa-mt`: YourMT3+ (Python 3.11.9, torch 2.11.0+cu128, lightning 2.6.6, transformers 4.45.1).
- `C:/Users/maxim/.venvs/wa-bp`: basic-pitch 0.4.0, ONNX.

**Spec.** `docs/superpowers/specs/2026-10-31-instruments-regions-automation-hd-design.md`. Read with it:
- the research in the session scratch folder `S` =
  `C:/Users/maxim/AppData/Local/Temp/claude/C--Users-maxim-Desktop-projects-github-WinkelAmp--claude-worktrees-ambitious-project-continuation-ff6d7f/b3b4a070-2436-40c2-8249-6478eeb5f1d5/scratchpad`:
  - `S/inst/design/design.md`: the compositing measurements;
  - `S/inst/yourmt3/`: the runner, `out/*.moe.notes.json` and `report.moe.json`;
  - `S/inst/basic-pitch/bp_run.py`;
  - `S/tags/tags-proposal.{md,json}`;
- last night's plan, `docs/superpowers/plans/2026-10-31-lab-first-studio.md`. Its §1–§10 are still binding where this
  plan does not change them.

## Global Constraints

- **Pixels at scale 1 do not move.**
  - A layer with no `listen`, `region` or `intensity`, at scale 1, takes today's exact runtime statements.
  - The lab without a `LAYERS` entry runs today's loop body.
  - `npm run fidelity` passes after every task that touches `src/widgets/`, `lab/index.html`, `lab/tools/` or
    `lab/layers/`.
- **One implementation.**
  - Every new compositing, curve, line or pulse formula is written once, in `lab/layers/*.js`.
  - Each file runs unchanged as a classic `<script>` in the lab, and through `new Function('WA', src)` in the studio and
    in Node: `(function (WA) { … })(typeof WA !== 'undefined' ? WA : (globalThis.WA_LAYERS ??= {}))`.
  - Where TypeScript must keep its own copy (the global `advanceFeatures`, `groupChords`), a test proves the two are
    bit-identical on random data.
- **No randomness in the harness.** No harness code calls `Math.random`, and a test spies on it. Thinning is FNV.
- **The lab.**
  - `lab/index.html`, `lab/tools/*.js` and `lab/combos.js` are edited only after the lab round now in progress has
    landed: its commit is in, and `git status --short lab/` shows no other session's changes. Then one task at a time
    (T10, T21, T22).
  - New lab files (`lab/layers/`, `lab/tags.json`, `lab/tag-words.json`, `lab/region-ui.js`) may land any time.
  - The studio never reads or writes the lab's localStorage keys (`wa-params`, `wa-ratings`, `wa-layers`).
- **Out of git.**
  - Audio, `songs/`, `renders/`, `lab/notes*.js`, `lab/pack-*.js` and the YourMT3 install never go into git.
  - The YourMT3 source is never vendored: `npm run setup-ymt3` installs it outside the repo.
  - No new npm dependency.
- **Ports.** 5173, 5174 and 5180 belong to the user's pages: never bind, fetch or post there. Scripts start their own
  Vite servers from 5190 (`strictPort: false`), and tests use port 0.
- **Python.** Only through the venvs above. They are never re-pinned, and no packages are installed into `wa`.
- **Code.**
  - Strict TS. Every new pure function gets a vitest test.
  - New Node TS scripts are listed in `tsconfig.scripts.json`.
  - Browser checks are `npm run` scripts that CI never runs. CI has no songs, GPU, Python or Chrome.
- **Commits.**
  - Prefixes: `Studio: …`, `Lab: …`, `Docs: …`. Each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Commit only the task's files: `git add <paths>`, never `-A`.
  - Never merge into `claude/wizardly-franklin-ttaqyo` without the user's explicit yes.
- **Looking is part of done.** Every task names what to look at: stills, contact sheets, screenshots, piano rolls.
  - Pictures go to `renders/look/T<n>/` (git-ignored).
  - The implementer reads them and says in the report what they show.

## Review Focus

1. **Scale 1 is untouched.**
   - `npm run fidelity` is identical to before the build.
   - The widget edits for HD keep each widget's lab hashes: `fidelity --record` before the edit, `--against` after.
   - Pinned: T7, T10, T12, T15, T21, T23.
2. **Old shows and packs.**
   - The three committed shows load, validate and save byte-identical. `canonicalShow` writes version 1 when nothing
     new is used.
   - v1 packs still open and play.
   - Pinned: T3 `pack-v2`, T8 `show-v2`, `npm run check-show`.
3. **Nothing installed.** No YourMT3, no basic-pitch, or no Python at all:
   - ingest still writes a valid pack, with the warning of its fallback row;
   - the ears `/health` names each missing tool;
   - the studio says it in words.
   - Pinned: T11 `ingest-v2`, `ears-tools`.
4. **Determinism.**
   - The same show at the same time draws the same frame whether reached by playing, by seeking, or in a paused
     preview, with thinning and curves included.
   - Two `render-show` runs give identical frame md5s.
   - Pinned: T4 `layers-automation` (the `Math.random` spy), T12 `runtime-check` (seek invariance), T9 (two runs).
5. **HD breakage classes at 2×.** Each must pass `hd-check` (no QUARTER flag) and be looked at in crops:
   - identity `setTransform` on `x.g`;
   - copiers of `x.canvas` into fixed 1280×720 scratches;
   - full-frame offscreen buffers (soft, but correct);
   - `shadowBlur` and `filter` lengths.

   Pinned: T7 `hd-context`, T10 `hd-check`.
6. **Instances.**
   - Two instances of one widget in a section (`strings@melody` over `strings@bassline`) draw independently.
   - A routed instance's knob drives follow its part.
   - Removing `listen` gives back today's instance key, so nothing resets.
   - Pinned: T8 `show-schedule-instances`, T12 `runtime-check`.
7. **The edges of the curves.**
   - A curve at a section boundary, a decaying instance (its frozen value × `(1 − u)²`).
   - A boundary drag or a split over pivots: the visible curve is unchanged.
   - 256 pivots.
   - Pinned: T4, T8 `show-edit-layers`.
8. **Performance.** Six layers in the studio, of which four have regions and two have curves, play at 60 fps on the
   user's machine, profiled in T15 Step 6. A 4-minute HD master at 2× renders in a time that the ETA printed at the
   start predicts within 20 %. Pinned: T9, T15.
9. **What the user sees in words.**
   - Instrument names come only from tracks that exist.
   - Bars are labelled "4-beat bars".
   - A reader in a window says that it cuts only its own picture.
   - Pinned: T16, T17 screenshots.

## Parallel execution

- **Worktrees.** Each task in a parallel wave runs in its own worktree: `git worktree add ../wa-T<n> <integration
  head>`. Its implementer then has a clean `tsc` and `vitest`.
- **Merging.** The controller merges finished tasks into the integration branch in task-number order: rebase, then
  fast-forward or cherry-pick. A reviewer then runs the task's verification commands on the merged head before the
  next wave starts.
- **Verification inside a parallel task** uses only its own tests (`npx vitest run tests/<its files>`) and
  `npm run typecheck`. The full suite runs at each wave's merge.

### Dependency graph

```
T1 contracts ──┬── T2 YourMT3 setup + runner ─────────┐
               ├── T3 pack v2, tracks, velocities ────┴── T11 ingest v2 ── T13 re-ingest, describe-song, lab-notes ──┐
               ├── T4 curves, thinning, vis, lines ── T8 show v2 ──┐                                                  │
               ├── T5 region maths ────────────────────────────────┼──────────────┐                                   │
               ├── T6 tags ────────────────────────────────────────┼──────────────┼─────────────┐                     │
               └── T7 HD core ──┬── T9 HD render pipeline ── T14 export UI        │             │                     │
                                ├── T10 HD widget edits (after the lab round)     │             │                     │
                                └───────────────────── T12 instances, routing, intensity ── T15 regions ──┐          │
                                                        T12 + T13 ── T20 hand-composed shows ─────────────┼──────────┤
                                                        T15 ──┬── T16 layer panel + tag picker ──┐        │          │
                                                              ├── T17 region overlay ────────────┼── T19 composer v2 │
                                                              └── T18 intensity lanes ───────────┘        │          │
                                         lab round landed + T15 ── T21 lab harness ──┬── T22 lab UI       │          │
                                                                                      └── T23 fidelity cases ┘        │
                                                                                                    all ── T24 final ┘
```

### Waves (tasks in one wave share no file)

| wave | tasks (parallel) | waits for |
|---|---|---|
| 0 | T1 | nothing |
| 1 | T2, T3, T4, T5, T6, T7 | T1 |
| 2 | T8, T9, T11, plus T10 once the lab round has landed | T8: T4. T9: T7. T11: T2 and T3. T10: T7 and the lab round |
| 3 | T12, T13, T14 | T12: T7, T4 and T8. T13: T11. T14: T9 |
| 4 | T15, T20 | T15: T12 and T5. T20: T12 and T13 |
| 5 | T16, T17, T18 | T15, T8, T6 |
| 6 | T19, then T21 (T21 may start in wave 5 once the lab round has landed) | T19: T16–T18 (main.ts) and T6. T21: T15 |
| 7 | T22, T23 | T21. T22 also needs T17 and T6 |
| 8 | T24 | everything |

### Hot files (one owner at a time)

| file | owners, in order |
|---|---|
| `src/widgets/types.ts` | T1 only; later additions are small follow-ups, merged serially |
| `src/widgets/runtime.ts` | T7 → T12 → T15 |
| `src/studio/render-page.ts` | T7 (`?scale`) → T12 (`layers=`, `probe=`, `pack-<id>.js`) |
| `src/widgets/driver.ts` | T7 → T12 |
| `lab/layers/slot.js` | T12 → T15 |
| `lab/layers/persist.js` | T1 (table, `vis`) → T12 (classes, generated block) |
| `scripts/checks/runtime-layers-check.mjs` | T12 → T15 |
| `src/studio/ui/store.ts` | T8 only (the optional `EditEnv`) |
| `scripts/fidelity.mjs` | T7 (`--record`/`--against`) → T23 (layer cases) |
| `src/studio/show/{show,edit,schedule,conductor}.ts` | T8 only |
| `src/studio/pack/{pack,build}.ts` | T3 only |
| `scripts/ingest.ts`, `scripts/node/python.ts`, `scripts/ears/server.ts`, `src/studio/ingest/ears-types.ts` | T11 only |
| `src/studio/ui/panel.ts` | T16 only |
| `src/studio/ui/main.ts`, `src/studio/ui/player.ts` | T12 (the runtime gets `layers` and the tracks) → T17 (overlay mount) → T19 (description and layers into the composer) |
| `scripts/render-show.mjs` | T9 → T19 (passes the description when it composes) |
| `src/studio/ui/timeline.ts` | T18 only |
| `src/studio/ui/record.ts`, `scripts/studio-api.ts` | T14 only |
| `lab/index.html` | T21 → T22 (after the lab round) |
| `lab/tools/*.js` | T10 only (after the lab round) |
| `package.json`, `tsconfig.scripts.json`, `.gitignore` | T1 registers everything; later edits only by T24 |
| `docs/COMPOSING-SHOWS.md` | T6 (the generated block via `widget-docs`) → T24 (the hand-written part) |
| `docs/HANDOFF.md`, `README.md` | T24 only |
| `shows/*.json` | T20 only |

### If the build has to stop early (order of value)

1. Derived-line routing: T1, T4, T8, T12, T16. This gives "strings on the melody" on every song.
2. The HD master: T7, T9, T10.
3. Intensity lanes: T18.
4. Instruments: T2, T3, T11, T13, T20.
5. Regions: T5, T15, T17.
6. Tags and the composer: T6, T19.
7. The lab: T21–T23.

## File Structure

| Path | Task | Responsibility |
|---|---|---|
| `src/widgets/types.ts` | T1 | new shared types (§1) |
| `src/widgets/layers.ts`, `src/widgets/layers-source.ts`, `scripts/node/layers.ts` | T1 | `WaLayers` (§2), `evalLayers`, the browser and Node loaders |
| `scripts/lib/studio-session.mjs` | T1 | `studio-check`'s set-up (temp dirs, fixture ingest, Vite, Chrome), shared by the new UI checks |
| `scripts/ears/ymt3.py`, `scripts/ears/requirements-ymt3.txt`, `scripts/setup-ymt3.ts`, `scripts/node/ymt3.ts`, `scripts/pianoroll.mjs` | T2 | YourMT3 install, config, runner, probe; piano-roll pictures |
| `src/studio/pack/{instruments,tracks}.ts`, `pack.ts`, `build.ts` | T3 | pack v2, track mapping, hybrid notes, velocities |
| `lab/layers/persist.js` | T1 | `VIS_REDRAW`, `vis`, `PERSIST` (filled in T12) |
| `lab/layers/{automation,lines}.js` | T4 | curves, presets, thinning, `vis`, derived lines, `advancePulse`, `groupChords`/`soundingAt` copies |
| `lab/layers/region.js`, `scripts/checks/region-masks.mjs` | T5 | region geometry, masks, glide, fit |
| `lab/tags.json`, `lab/tag-words.json`, `src/widgets/tags.ts`, `src/widgets/catalogue.ts`, `src/widgets/sources.ts`, `scripts/node/catalogue.ts`, `scripts/widget-docs.ts` | T6 | tags |
| `src/widgets/hd-context.ts`, `src/widgets/runtime.ts`, `src/widgets/driver.ts`, `src/studio/render-page.ts`, `scripts/fidelity.mjs`, `scripts/hd-check.mjs` | T7 | supersampling core |
| `src/studio/show/{show,edit,schedule,conductor}.ts` | T8 | show v2 |
| `scripts/render-show.mjs`, `scripts/lib/encode.mjs` | T9 | HD master + share copy |
| `lab/tools/{blocks,casket,fold,pixelsort,timeslice,tunnel,…}.js` | T10 | HD-correct shared-canvas readers |
| `scripts/ingest.ts`, `scripts/node/python.ts`, `scripts/ears/bp.py`, `scripts/ears/requirements-bp.txt`, `scripts/ears/server.ts`, `src/studio/ingest/ears-types.ts` | T11 | ingest v2 |
| `scripts/describe-song.ts`, `scripts/lab-notes.ts` | T13 | tracks in describe-song; `lab/pack-<id>.js` |
| `src/studio/ui/record.ts`, `scripts/studio-api.ts` | T14 | recorder presets, HD render job |
| `src/widgets/{runtime,instantiate,driver}.ts`, `lab/layers/slot.js`, `src/studio/render-page.ts`, `scripts/persist-probe.mjs`, `scripts/checks/runtime-layers-check.mjs` | T12 | instances, routing, intensity |
| `src/widgets/runtime.ts`, `lab/layers/slot.js` | T15 | spot and window |
| `src/studio/ui/{layer-controls,widget-picker}.ts` + `.css`, `panel.ts`, `scripts/checks/layers-check.mjs` | T16 | panel |
| `lab/region-ui.js`, `src/studio/ui/region-overlay.ts`, `main.ts`, `scripts/checks/overlay-check.mjs` | T17 | stage overlay |
| `src/studio/ui/lanes.ts`, `lanes.css`, `timeline.ts`, `scripts/checks/lanes-check.mjs` | T18 | intensity lanes |
| `src/studio/compose/{compose,taste,instruments}.ts`, `main.ts` | T19 | composer v2 |
| `shows/{beethoven5,chopin-winter-wind,rach-prelude-recording}.json` | T20 | routing in the hand-composed shows |
| `lab/index.html`, `src/widgets/lab-harness.ts` | T21 | the lab runs layers |
| `lab/index.html`, `lab/layer-ui.js` | T22 | lab card controls, chips, filter |
| `scripts/fidelity.mjs` | T23 | layer cases |
| `README.md`, `docs/HANDOFF.md`, `docs/COMPOSING-SHOWS.md` | T24 | docs |

## Binding Interfaces

### §1 Shared types: `src/widgets/types.ts` (T1)

```ts
export type Line = 'melody' | 'bassline' | 'inner' | 'low' | 'high' | 'accents';
export type Family = 'keys' | 'plucked' | 'strings' | 'winds' | 'brass' | 'percussion' | 'voice';
export type TrackId = 'piano' | 'plucked' | 'violin' | 'viola' | 'cello' | 'contrabass' | 'strings' | 'timpani' | 'voice'
  | 'horn' | 'trumpet' | 'trombone' | 'brass' | 'flute' | 'oboe' | 'clarinet' | 'bassoon' | 'saxophone';
/** 'all' | a TrackId | `family:${Family}` | a Line. Absent = 'all'. */
export type Listen = string;
export type Shape = 'linear' | 'ease' | 'hold';
/** t: song s; v: 0..1; shape/bend: the segment from this pivot to the next (bend −1..1, 0 = straight). */
export interface Pivot { t: number; v: number; shape?: Shape; bend?: number }
/** Centre and size are fractions of the canvas; feather 0..1 of the smaller half-size (default 0.25); rot degrees. */
export interface Region { mode: 'spot' | 'window'; shape: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number;
  rot?: number; feather?: number; blend?: 'over' | 'lighten'; fit?: 'cover' | 'contain' | 'stretch' }
export type Persist = 'redraw' | 'strokes';
export interface SongNotes { notes: Note[]; tracks?: Partial<Record<TrackId, { notes: Note[]; family: Family }>> }
/** key = widget, or widget@listen; own = keeps its own pulse (listen set, or any intensity in the show). */
export interface InstanceSpec { key: string; widget: string; listen?: Listen; own?: boolean }
/** until: the curve is read at min(t, until), a decaying instance's frozen value. */
export interface SlotLayer { pivots?: readonly Pivot[]; until?: number; region?: Region; glide?: { from: Region; u: number } }
export type Role = 'under' | 'ground' | 'base' | 'accent' | 'top';
export interface WidgetTags { feel: string[]; instruments: string[]; role: Role }
// WidgetMeta gains: tags?: WidgetTags | null
```

### §2 `WaLayers`: `src/widgets/layers.ts` (interface and loader in T1; implemented in T4, T5, T12, T15)

```ts
export interface Span { start: number; end: number }
export interface InstanceState {
  key: string; widget: string; salt: number;            // salt = fnv32(key)
  notes: Note[]; chords: Chord[]; ci: number;           // the part it hears; next chord index
  pulse: { level: number; rate: number }; feat: Features;
  own: boolean; routed: boolean; persist: Persist; win: HTMLCanvasElement | null;
}
export interface LayerHost {                            // what the lab's step() and WidgetRuntime each provide
  ctx: WidgetCtx; g: CanvasRenderingContext2D;          // g: the real context of the shared canvas
  canvas: HTMLCanvasElement; S: number;
  call(inst: InstanceState, fn: 'reset' | 'onChord' | 'frame', ch?: Chord): void;   // safe(), instance fields swapped in
  scratch(): HTMLCanvasElement;                         // canvas-sized, reused
  windowOf(inst: InstanceState): HTMLCanvasElement;     // canvas-sized, opaque black when created
  make(w: number, h: number): HTMLCanvasElement;
}
export interface LayeredSlot { inst: InstanceState; receiving: boolean; weight: number; layer: SlotLayer;
  fired: readonly Chord[]; lastT: number; t: number; dt: number }
export interface WaLayers {
  // automation.js (T4)
  automationAt(p: readonly Pivot[] | undefined, t: number): number;
  fnv32(s: string): number;
  passes(t: number, a: number, salt: number): boolean;
  presets: {
    fadeIn(s: Span, seconds: number): Pivot[]; fadeOut(s: Span, seconds: number): Pivot[];
    swell(s: Span, o?: { peak?: number; floor?: number }): Pivot[];
    pulse(s: Span, beats: readonly number[], o: { every: number; floor?: number; duty?: number }): Pivot[];
    gate(s: Span, curve: { hop: number; values: readonly number[] }, o: { above: number; floor?: number }): Pivot[];
    plays(s: Span, notes: readonly Note[], o?: { floor?: number }): Pivot[];
  };
  MAX_PIVOTS: number;                                   // 256
  // persist.js (T1 table and vis; T12 fills PERSIST)
  VIS_REDRAW: readonly (readonly [number, number])[]; PERSIST: Record<string, Persist>;
  vis(a: number, cls: Persist): number;
  // lines.js (T4)
  groupChords(notes: readonly Note[]): Chord[]; soundingAt(notes: readonly Note[], t: number): SoundingNote[];
  lineNotes(notes: readonly Note[], line: Line): Note[];
  listenNotes(song: SongNotes, listen: Listen | undefined): { notes: Note[]; heard: string };   // heard 'all' = fell back
  advancePulse(p: { level: number; rate: number }, f: Features, fired: readonly Chord[], snd: readonly SoundingNote[], dt: number): void;
  // region.js (T5)
  regionBox(r: Region, cw: number, ch: number): { cx: number; cy: number; w: number; h: number; rot: number };   // device px, radians
  featherAlpha(d: number, feather: number): number;     // d: 0 centre … 1 edge → 1 … 0
  glideRegion(a: Region, b: Region, u: number): Region; // smoothstep(u) on x y w h rot feather; mode/shape/blend/fit of b
  fitRect(r: Region, cw: number, ch: number): { sx: number; sy: number; sw: number; sh: number };   // source rect in the layer canvas
  buildMask(r: Region, cw: number, ch: number, cls: Persist, make: LayerHost['make']): HTMLCanvasElement;   // canvas ops only
  // slot.js (T12; regions in T15)
  drawLayered(h: LayerHost, s: LayeredSlot): void;
}
export function evalLayers(sources: Readonly<Record<string, string>>): WaLayers;   // file names sorted; each new Function('WA', src)(obj)
// src/widgets/layers-source.ts (browser): layerSources() = import.meta.glob('/lab/layers/*.js', { query: '?raw', import: 'default', eager: true })
// scripts/node/layers.ts (Node): loadLayers(repo = REPO): WaLayers (fs read of lab/layers/*.js → evalLayers)
```

**Exact semantics (spec, Decisions 3 to 5):**

```
automationAt(p, t): p empty/undefined → 1. t ≤ p[0].t → p[0].v; t ≥ p[n−1].t → p[n−1].v.
  i = last index with p[i].t ≤ t, q = p[i+1]; q.t === p[i].t → q.v; u = (t − p[i].t)/(q.t − p[i].t)
  hold → p[i].v · ease → u' = u·u·(3 − 2u) · linear → u' = bend ? u ** (2 ** (−3·bend)) : u
  v = p[i].v + (q.v − p[i].v)·u', clamped to 0..1
fnv32(s): FNV-1a 32 over the UTF-16 code units, low byte then high byte; offset 0x811c9dc5, prime 0x01000193; >>> 0
passes(t, a, salt): a ≥ 1 → true; a ≤ 0 → false; else h = FNV-1a over the 8 bytes (salt LE, round(t·1000) LE as uint32),
  h / 2^32 < a
vis(a, 'strokes') = clamp(a, 0, 1); vis(a, 'redraw') = piecewise linear through
  VIS_REDRAW = [[0,0],[0.1,0.044],[0.25,0.069],[0.5,0.15],[0.75,0.31],[0.9,0.561],[1,1]]
presets (span = the section): every result is sorted, inside the span, ≤ MAX_PIVOTS
  fadeIn(s, d)  = [{t:s.start, v:0}, {t:min(s.end, s.start+d), v:1}]
  fadeOut(s, d) = [{t:max(s.start, s.end−d), v:1}, {t:s.end, v:0}]
  swell(s, {peak=0.5, floor=0}) = [{t:s.start, v:floor, shape:'ease'}, {t:s.start+peak·len, v:1, shape:'ease'}, {t:s.end, v:floor}]
  pulse(s, beats, {every, floor=0, duty=0.5}): grid = beats inside s when they cover ≥ 70 % of it (count·median gap ≥ 0.7·len);
    else from s.start every P, where P is the song's median beat gap (0.5 s when there are no beats);
    pulses at every `every`-th grid point; at each pulse p (period T = every·gap):
    {t:p, v:1}, {t:min(p + duty·T, next pulse, s.end), v:floor, shape:'hold'};
    {t:s.start, v:floor, shape:'hold'} first when the first pulse is after s.start. "Bars" in the UI = every·4.
  gate(s, curve, {above, floor=0}): open where value ≥ above, closed where < above − 0.05 (hysteresis);
    drop open runs < 0.25 s, bridge gaps < 0.5 s; each run [a, b] →
    {t:a−0.25, v:floor}, {t:a−0.15, v:1, shape:'hold'}, {t:b, v:1}, {t:b+0.1, v:floor, shape:'hold'} (clipped to s)
  plays(s, notes, {floor=0}): the union of the note spans inside s, gaps < 1 s bridged; each run [a, b] →
    {t:a−0.2, v:floor}, {t:a, v:1, shape:'hold'}, {t:b, v:1}, {t:b+0.2, v:floor, shape:'hold'} (clipped to s)
lineNotes (over groupChords(notes)):
  melody: per chord, its highest note joins when no melody note sounds at chord.t, or when it is at most 2 below the sounding one
  bassline: the same from below; inner: every note in neither; low: m < 55; high: m ≥ 72
  accents: the notes of chords with vel ≥ the nearest-rank 85th percentile of chord vels
  output: the input's note tuples (same objects' values), stable-sorted by start
listenNotes(song, l): undefined/'all' → song.notes; a Line → lineNotes(song.notes, l);
  a TrackId present → its notes; 'family:f' → the stable-by-start union of present tracks with family f;
  anything missing → { notes: song.notes, heard: 'all' }
advancePulse ≡ advanceFeatures (src/widgets/features.ts), same statements, same order
```

### §3 Pack v2: `src/studio/pack/` (T3)

```ts
// pack.ts
export const PACK_VERSION = 2;
export type NotesSource = 'gpu' | 'file' | 'approx' | 'merged' | 'hybrid' | 'ymt3' | 'bp-hybrid';
export interface Track { label: string; family: Family; notes: Note[]; share: number /* of the song's YourMT3 notes */;
  vel: { borrowed: number; level: number } /* how many velocities were borrowed / estimated from loudness */ }
export interface SongPack {            // v1 fields unchanged, plus:
  version: 1 | 2;
  kind?: 'piano' | 'ensemble';
  pianoShare?: number | null;          // YourMT3 piano share; null without YourMT3
  tracks?: Partial<Record<TrackId, Track>>;
  transcribers?: { name: 'piano' | 'ymt3' | 'bp'; model: string; seconds: number; notes: number }[];
}
export function validatePack(x: unknown): string[];   // accepts 1 and 2; v2: known track ids, family = TRACKS[id].family,
                                                      // notes sorted with end > start, share 0..1, kind enum
// instruments.ts
export const TRACKS: Record<TrackId, { family: Family; label: string; classes: readonly string[] }>;   // the spec's table
export function trackOf(cls: string): TrackId | null;   // null: Drums, synths, Organ, Chromatic Percussion, Orchestra Hit
// tracks.ts (pure)
export type Ymt3Row = [start: number, end: number, midi: number, vel: number, cls: string];
export const ANCHORS: readonly (readonly [number, number])[];   // [[0.05, 46], [0.5, 69], [0.95, 95]]
export function cleanRows(rows: readonly Ymt3Row[]): Ymt3Row[];   // drops Drums, vel ≤ 0, end ≤ start; stable by (start, midi)
export function pianoShare(rows: readonly Ymt3Row[]): number;     // Acoustic/Electric Piano share of cleanRows; 0 when empty
export function hybridNotes(piano: readonly Note[], extra: readonly Note[], pad?: number /* 0.15 */): Note[];
export function onsetLevels(pcm: Float32Array, rate: number, starts: readonly number[]): number[];   // dBFS, spec Decisions 2
export function midRank(xs: readonly number[]): number[];          // (#below + (#equal − 1)/2)/(n − 1); n = 1 → [0.5]
export function quantileOf(sorted: readonly number[], r: number): number;   // linear between order statistics
export function estimateVelocities(rows: readonly Ymt3Row[], levels: readonly number[], piano: readonly Note[]):
  { vel: number[]; borrowed: boolean[] };                          // borrow ±0.05 s same midi, else level → quantile/anchors
export function buildTracks(rows: readonly Ymt3Row[], vel: readonly number[], borrowed: readonly boolean[]): Partial<Record<TrackId, Track>>;
// build.ts: BuildInput gains
//   ymt3?: { rows: Ymt3Row[]; levels: number[]; model: string; seconds: number } | null;
//   bp?: { notes: Note[]; levels: number[]; model: string; seconds: number } | null;
//   kind?: 'piano' | 'ensemble';   // forced by --kind
//   notesMode?: 'auto' | 'hybrid' | 'ymt3';
// buildPack: kind (spec Decisions 1); ensemble + ymt3 → notes = hybridNotes(piano, ymt3 with estimated vels), tracks;
//   ensemble without ymt3 + bp → 'bp-hybrid'; else today's rules; every fallback adds its warning (T11 table).
```

### §4 YourMT3 and the ingest CLI (T2, T11)

```ts
// scripts/node/ymt3.ts
export interface Ymt3Config { python: string; src: string; ckpt: string; revision: string; sha256: string; installed: string }
export function ymt3ConfigPath(): string;   // WINKELAMP_YMT3 (a ymt3.json, or its folder) else %LOCALAPPDATA%/WinkelAmp/ymt3/ymt3.json
export function findYmt3(): { config: Ymt3Config } | { missing: string };   // missing names `npm run setup-ymt3`
export function probeYmt3(): Promise<ToolStatus>;          // ymt3.py --probe, 120 s timeout
export function runYmt3(audio: string, out: string, onProgress?: (f: number) => void): Promise<void>;
// src/studio/ingest/ears-types.ts (T11)
export interface ToolStatus { ok: boolean; python: string | null; reason?: string }
// GET /health → { ok: true, api: 2, transcriber: TranscriberStatus, ymt3: ToolStatus, bp: ToolStatus }
export const STAGE_WEIGHTS = { decode: 0.03, transcribe: 0.3, instruments: 0.3, analyze: 0.32, write: 0.05 } as const;
```

- **`ymt3.py <audio> <out.json> --src <dir> --ckpt <file> [--device cuda] [--probe]`.**
  - It decodes with `ffmpeg -v error -i IN -ac 1 -ar 16000 -f f32le -`, because the model asserts 16 kHz mono. Then it
    runs the spike's MoE arguments.
  - It writes `{ version: 1, model: 'yourmt3-moe', revision, seconds, notes: [[s, e, m, v, cls], …] }`, sorted by
    `(s, m)`, and prints `progress <f>` on stderr.
  - Exit codes: 2 usage, 3 missing package or checkpoint (naming `npm run setup-ymt3`), 4 decode failure.
  - Run as `<python> -I ymt3.py` with `PYTHONDONTWRITEBYTECODE=1`.
- **`npm run setup-ymt3 -- --from <Space folder> [--ckpt <moe.ckpt>] [--python <exe>] [--dir <install>]`.** Default
  `--dir` is `%LOCALAPPDATA%/WinkelAmp/ymt3`, `--python` is `C:/Users/maxim/.venvs/wa-mt/Scripts/python.exe`.
  - It copies `amt/src/**` and `model_helper.py` to `<dir>/src`, and the checkpoint to `<dir>/ck/moe.ckpt` (a short
    path).
  - It checks the sha256 is `ae38e415c79efd5592dcb9b658cdb99ddb11d4c4e1eaa364cab04a052473fc25`, else exits 1.
  - It runs `--probe`, then writes `ymt3.json`.
  - `--download` (builder's call, if git-lfs is present): clone the Space at revision
    `5e66c1ea173a8186e0d20432b841d3180cc015b5` instead of `--from`.
  - No separate README goes under `scripts/ears/`. T24's README section documents the setup, including the Space's
    licence as found in its files.
- **The ingest CLI** (T11): `npm run ingest -- <audio> [--id] [--title]
  [--notes auto|gpu|hybrid|ymt3|bp|approx|<file>] [--piano-notes <file>] [--kind auto|piano|ensemble]
  [--redo piano|ymt3|bp] [--force] [--progress json]`.
  - `auto` (default): the spec's Decisions 1–2.
  - `--piano-notes <file>` uses those notes as the piano model's, without running it. Beethoven's re-ingest keeps
    `lab/notes-b5.js` this way, so the show's snapped edges hold.
  - Caches in `songs/<id>/`: `notes.gpu.json` (as today), `notes.ymt3.json`, `notes.bp.json`, each keyed by source sha1
    + model + revision or settings.
  - Same sha1 + `PACK_VERSION` 2 → "up to date".
- **Fallback rows.** Each warning goes into `quality.warnings`, and the pack is still valid.

  | missing | notes | warning contains |
  |---|---|---|
  | YourMT3 (no `ymt3.json`, probe fails, or run fails) | piano model; kind by its coverage (≥ 0.6 piano); ensemble → basic-pitch gap fill (`bp-hybrid`) | `no instrument tracks: YourMT3 is not set up (npm run setup-ymt3)` |
  | YourMT3 and basic-pitch, ensemble | piano model (+ today's approx merge under 0.35 coverage) | `about half the attacks may be missing` |
  | the piano model only (YourMT3 present) | ensemble → `ymt3` notes; piano kind → YourMT3 notes, with a warning | `piano transcriber unavailable` |
  | no Python at all | approximate notes, as today | as today |

### §5 Show v2: `src/studio/show/` (T8)

```ts
// show.ts
export const SHOW_VERSION = 2, MAX_PIVOTS = 256;
export interface Layer { widget: string; listen?: Listen; knobs?: Record<string, KnobSetting>; restart?: boolean;
  region?: Region; intensity?: Pivot[] }
export interface Show { version: 1 | 2; /* … as v1 */ }
export interface ShowContext { duration?: number; widgets?: ReadonlyMap<string, WidgetMeta>; tracks?: readonly string[] /* undefined: no track warnings */ }
export function instanceKey(l: Pick<Layer, 'widget' | 'listen'>): string;   // listen absent/'all' → widget, else `${widget}@${listen}`
export function usesV2(show: Show): boolean;                                // some layer has listen ≠ 'all', region or intensity
export function isListen(x: unknown): boolean;                              // 'all' | TrackId | family:<Family> | Line
// canonicalShow: version = usesV2 ? 2 : 1; layer keys widget, listen, knobs, restart, region, intensity;
//   region keys mode, shape, x, y, w, h, rot, feather, blend, fit; pivot keys t, v, shape, bend; each pivot on one line;
//   numbers in region/pivots rounded to 4 decimals (t to ms)
// edit.ts
export type ShowEdit = /* v1 edits */ | { kind: 'addLayer'; section: number; widget: string; at?: number; listen?: Listen }
  | { kind: 'setLayer'; section: number; layer: number; patch: { listen?: Listen | null; region?: Region | null; intensity?: Pivot[] | null } };
export interface EditEnv { curve: (p: readonly Pivot[] | undefined, t: number) => number }   // WaLayers.automationAt
export function applyEdit(show: Show, e: ShowEdit, env?: EditEnv): Show;
//   moveBoundary/split: pivots outside a section's new span are removed and, with env, an edge pivot {t: edge, v: curve(old, edge)}
//   is added so the visible curve is unchanged; merge: the same instance's pivots on both sides are concatenated;
//   setLayer: listen changes the instance key; it is refused (input returned) when that key is already in the section;
//   intensity is sorted, clamped (v 0..1, t to the section), capped at MAX_PIVOTS. Group keys: 'region:s:l', 'intensity:s:l'.
// schedule.ts
export interface ScheduledWidget { id: string /* instance key */; widget: string; listen?: Listen; receiving: boolean; weight: number;
  knobs: Record<string, KnobSetting>; section: number; region?: Region; glide?: { from: Region; u: number };
  pivots?: Pivot[]; until?: number }
//   continuing = same instance key in consecutive sections; glide when both have a region of the same mode and they differ:
//   u = (t − b)/fade of the new section, smoothstep applied in glideRegion; a decaying instance carries its section's pivots
//   with until = b (its boundary)
// conductor.ts: loads InstanceSpec[] (first appearance; own = listen set or any layer of that key has intensity);
//   Slot.layer = { pivots, until, region, glide } when any is set; scheduleKey/samePreview include them and listen.
```

**Validation** (errors E, warnings W, repairs R):
- **listen:** not `isListen` → E, R removes it. A track missing from `ShowContext.tracks` → W "this song has no <id>:
  it plays on all notes".
- **The same instance key twice in a section** → E, R drops the second.
- **region:**
  - mode or shape not in its enum → E, R removes the region.
  - `w` or `h` outside 0.02..2 → E, R clamps.
  - `x` or `y` outside −0.5..1.5 → W.
  - feather outside 0..1 → W, R clamps.
  - rot outside −180..180 → W, R wraps.
  - blend or fit given on a spot → W.
- **intensity:**
  - not an array of `{t, v}` → E.
  - unsorted → E, R sorts.
  - v outside 0..1 → E, R clamps.
  - t outside the section → W, R clamps.
  - shape not in its enum, or bend outside −1..1 → E, R removes or clamps.
  - more than 256 pivots → W.
- **version:**
  - 1 with v2 fields → W "uses version-2 fields: saved as version 2".
  - anything other than 1 or 2 → E.

### §6 Runtime: `src/widgets/runtime.ts` (T7, T12, T15)

```ts
export interface Slot { id: string; receiving: boolean; weight: number; layer?: SlotLayer }
export interface RuntimeLike { load(specs: readonly (string | InstanceSpec)[]): void; /* setKnobs(key), setMoment, reset, resetWidget(key), step: unchanged */ }
export interface RuntimeOptions { scale?: 1 | 2 | 3 }
export class WidgetRuntime {
  constructor(canvas: HTMLCanvasElement, song: SongNotes,
    lib: { sources: Record<string, string>; harness: LabHarness; layers?: WaLayers }, opts?: RuntimeOptions);
  readonly S: number;   // canvas.width / 1280; the constructor throws unless canvas is 1280·S × 720·S
  instance(key: string): InstanceState | undefined;
}
```

- **Default path.** A slot with no `layer`, whose instance is not `own`, runs the current loop body verbatim. At S = 1
  that includes `ctx.g === ` the real context.
- **Everything else** goes to `layers.drawLayered(host, slot)`.
- **The global pulse** (`ctx.level`, `ctx.rate`, `ctx.feat`) advances exactly as today.
- **Own instances.**
  - An own instance's pulse advances only on steps where it has a slot.
  - When it comes back after an absence (no slot in the previous step), it starts cold, as after a seek:
    - `ci` is the first chord after the last step's time, so no stale attacks burst out;
    - `pulse` is `{ level: 0, rate: 0 }` and `feat` is `newFeatures()`.

    So play and a seek to the same time disagree no more than they do today.
  - `reset(t)` and `renderSeek` reset every instance's `ci`, pulse and feat.
  - Load order: the specs in order. Routed instances are instantiated with
    `new Function('TOOLS','ICON','CHORDS','window', src)(tools, icon, chords, windowProxy)`, where `windowProxy` returns
    the part's notes for `NOTES` and everything else from `window`, with functions bound to it.
- **`drawLayered`, T12 part (no region):**
  1. `delivered` = the instance's own chords crossing `(lastT, t]` when it is routed, else the global `fired`.
     With pivots, keep a chord `ch` only when `passes(ch.t, automationAt(pivots, min(ch.t, until)), salt)`.
  2. When the instance is own: `advancePulse(inst.pulse, inst.feat, delivered, soundingAt(inst.notes, t), dt)`.
  3. `a = automationAt(pivots, min(t, until))`, and `w = weight × (pivots ? vis(a, inst.persist) : 1)`.
  4. Today's per-slot statements with `w` and `delivered`: the snapshot when `w < 1`, `onChord` if receiving, then
     `save`, `frame`, `restore`, then the 4 resets, then the paste-back at `1 − w`.
  5. Around every call of an own instance, swap in `ctx.level`, `ctx.rate`, `ctx.feat` and the notes behind
     `ctx.sounding()` and `ctx.top()`, then restore them.
- **`drawLayered`, T15 part (regions):**
  - **spot**: snapshot the canvas, run step 4's calls at weight 1, then
    `snapshot.globalCompositeOperation = 'destination-out'`, draw the mask at `globalAlpha = w`, and draw the snapshot
    back with `drawImage`.
  - **window**:
    - fade and burn `windowOf(inst)` (the shared fade's three statements, at its size);
    - set `ctx.g`/`ctx.canvas` to it (through `hdContext` when S > 1), run the calls, restore them;
    - scale `fitRect` of it into a region-box temp canvas, apply `destination-in` with the mask;
    - stamp it at the box (rotated) with `globalAlpha = w`, blend `source-over` or `lighten`.
  - **glide**: `glideRegion(from, region, u)`, with the mask rebuilt per step while gliding, from a cache keyed by
    rounded geometry.
  - **Resets.** `reset(t)` and `resetWidget(key)` clear the instance's window to black.

### §7 HD (T7, T9, T10)

```ts
// src/widgets/hd-context.ts
export function hdContext(g: CanvasRenderingContext2D, S: number, who: () => string): CanvasRenderingContext2D;
//   S === 1 → g. Else a Proxy (functions bound to g): setTransform(a,b,c,d,e,f | DOMMatrix2DInit) → g.setTransform(S·…);
//   resetTransform() → g.setTransform(S,0,0,S,0,0); getTransform() → g.getTransform() pre-scaled by 1/S;
//   set shadowBlur / shadowOffsetX / shadowOffsetY → ×S (get ÷S); set filter → scaleFilter (get → the string as set);
//   getImageData / putImageData → throw Error(`${who()} reads the shared canvas's pixels: adapt it for scale ${S}`)
export function scaleFilter(f: string, S: number): string;   // every <number>px ×S; 'none' unchanged
// runtime at S > 1: before every widget call g.setTransform(S,0,0,S,0,0); fade/burn/scratch at real size, identity transform
// render.html ?scale=1|2|3 (both modes): canvas 1280·S × 720·S; window.renderSize = { w, h }
// driver.ts: renderPixels/renderFrameHash (and render-show's frame read) use the REAL context of the canvas,
//   getImageData(0, 0, canvas.width, canvas.height), never ctx.g (the proxy throws there, and ctx.W × ctx.H is a quarter at 2×)
```

- **`render-show`.** `npm run render-show -- <show> [--scale 2] [--fps 60] [--hz 60] [--crf 13] [--preset slow]
  [--master x264|x264-444|prores] [--share | --no-share] [--share-mb-per-min 15] [--from] [--to] [--out] [--framemd5]`.
- **Outputs.**
  - The master: `renders/<id>.mp4` (`.mov` for prores).
  - The share copy: `renders/<id>-share.mp4`.
  - A `renders/<id>-sheet.png` of one frame per 10 s.
- **Frame transport.**
  - The page reads `getImageData` and does `await fetch('/__frame?k=<n>', { method: 'POST', body: data })`.
  - The render script's Vite plugin writes the body to ffmpeg's stdin (`-f rawvideo -pix_fmt rgba -s WxH -r fps -i -`),
    in order, and answers after `drain`.
  - Step 1 of T9 measures this against PNG `toBlob` and base64 first.
- **`--framemd5`** hashes the raw RGBA of each frame.

```js
// scripts/lib/encode.mjs (pure, tested)
export function level(w, h, fps)                    // '4.1' ≤ 1920×1080@30, '5.1' ≤ 2560×1440@60, '5.2' above
export function masterArgs({ w, h, fps, crf, preset, master, out })   // x264: -c:v libx264 -preset P -crf C -profile:v high
  // -level L -pix_fmt yuv420p -vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p -colorspace bt709
  // -color_primaries bt709 -color_trc bt709 -movflags +faststart; x264-444: high444, yuv444p; prores: prores_ks -profile:v 4 yuva444p10le
export function shareVideoKbps(mbPerMin, audioKbps = 128)   // round(mbPerMin·8000/60 − audioKbps): 15 → 1872
export function shareArgs({ input, pass, kbps, out, passlog })  // scale=1920:1080:flags=lanczos,fps=30; libx264 -b:v Kk -maxrate 1.5K
  // -bufsize 2K -preset slow -profile:v high -level 4.1, bt709 tags; pass 1 -an -f null; pass 2 + -c:a aac -b:a 128k +faststart
```

- **`npm run hd-check -- [--only ids] [--song prelude|b5] [--at 126] [--scale 2] [--out renders/look/hd]`.**
  - Each widget alone is drawn through `render.html?labSong`, at S = 1 and at S, from `at − 3` to `at + 2`.
  - It prints:
    - `diff`: the mean absolute difference, 0..255, between the S frame box-downsampled to 1× and the 1× frame;
    - `gain`: the mean |Laplacian| of the S frame ÷ that of the 1× frame bilinear-upscaled to S.
  - Flags: QUARTER when diff > `QD`, SOFT when gain < 1.05.
  - `QD` is calibrated in T7 on kandinsky, strings, current and squares: their maximum + 4.
  - It writes `<id>.png`: a 400×400 crop of the 1× frame upscaled beside the same crop at S.
- **`fidelity.mjs` (T7).**
  - `--record <file>` writes each case's lab-side frame hashes.
  - `--against <file>` fails on any lab-side hash that differs from the file. This guards widget edits.

### §8 Tags (T6)

```ts
// lab/tags.json: { "<widget id>": { "feel": string[], "instruments": string[], "role": Role } }   (from S/tags/tags-proposal.json)
// lab/tag-words.json: { "feel": { "<axis>": { "<word>": { "looks": string, "sounds": string, "fit": { loud?, dense?, low?, fast?, quiet? } } } },
//   "instruments": { "<word>": { "label": string, "family": string, "pairs": string[], "tracks": string[] /* TrackId | 'family:<f>' | 'all' */ } },
//   "synonyms": { "<word>": "<feel word>" } }
// src/widgets/tags.ts (pure)
export interface TagWords { feel: Record<string, Record<string, { looks: string; sounds: string; fit: Record<string, number> }>>;
  instruments: Record<string, { label: string; family: string; pairs: string[]; tracks: string[] }>; synonyms: Record<string, string> }
export function validateTags(tags: unknown, words: TagWords, widgetIds: readonly string[]): { errors: string[]; warnings: string[] };
//   errors: an unknown feel or instrument word, a role not in Role, a key with no lab/tools/<id>.js; warnings: a widget without tags
export function feelWordsIn(text: string, words: TagWords): string[];   // lower-cased words ∩ vocabulary ∪ synonyms, vocabulary order, unique
export function tracksFor(instrument: string, words: TagWords): string[];
// toMeta(tool, verdict, tags?: WidgetTags | null); WidgetMeta.tags
```

- **Instrument words to tracks:**
  - violin, viola, cello, contrabass, flute, oboe, clarinet, bassoon, horn, trumpet, trombone, timpani, voice, plucked
    and piano each name their own track;
  - `strings` → `family:strings`;
  - `harpsichord` → `piano`;
  - `tutti` → `all`.

### §9 Composer v2: `src/studio/compose/` (T19)

```ts
export interface ComposeInput { /* v1 fields */;
  pack: Pick<SongPack, 'id' | 'title' | 'duration' | 'notes' | 'sections'> & Partial<Pick<SongPack, 'tracks' | 'beats' | 'loudness' | 'kind'>>;
  description?: string; layers?: WaLayers; words?: TagWords }
export function presence(notes: readonly Note[], s: Span): number;   // share of 0.5 s bins in s with a sounding note
export function enteringTrack(pack: ComposeInput['pack'], s: Span): TrackId | null;
//   the first TrackId (TRACKS order) silent for ≥ 5 s before its first note in s (or before s.start) whose notes then
//   sound in ≥ 4 of the next 6 one-second bins
```

- **Without `layers` and `words`** the output is byte-identical to today's (the v1 tests pin it).
- **With them:**
  1. **Eligibility, roles and fits** stay as today (love/keep, `TASTE`).
  2. **Feel.** `F = feelWordsIn(description)`. A widget's bonus is `min(0.5, 0.25 · |tags.feel ∩ F|)`, added to its score
     when choosing the base and the accent.
  3. **Instruments.**
     - A track is present in a section when `presence ≥ 0.3`.
     - Accent and top widgets get +0.2 when one of their instrument words maps to a present track, and that layer's
       `listen` is set to the most present such track (ties: TRACKS order). `strings` maps to `family:strings` when 2 or
       more string tracks are present.
     - Bases hear all notes.
     - On songs without tracks:
       - an accent tagged contrabass, cello, bassoon, timpani or trombone listens to `bassline`;
       - one tagged violin, flute, oboe, clarinet or trumpet listens to `melody`;
       - the first matching list wins.
  4. **An entering part.**
     - When `enteringTrack` is not null, the stack has fewer than `MAX_LAYERS` layers, and some love/keep widget not
       already in the stack is tagged with an instrument word that maps to that track:
       - add the best-scoring such widget (any role but top) with
         `listen = track`;
       - give it `region = { mode: 'window', shape: 'ellipse', x: k % 2 ? 0.75 : 0.25, y: 0.5, w: 0.4, h: 0.5,
         feather: 0.3, blend: 'lighten', fit: 'cover' }`, where `k` is the section index;
       - give it `intensity = presets.plays(section, trackNotes)`.
     - At most one per section.
  5. **Casket** keeps its rule. Nothing random. Deterministic.

### §10 Studio UI (T14, T16–T18)

```ts
// src/studio/ui/record.ts (T14)
export const RECORD_PRESETS = { share: { videoBitsPerSecond: 1_900_000, audioBitsPerSecond: 128_000, fps: 30 },
                                high:  { videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000, fps: 30 } } as const;
// scripts/studio-api.ts (T14, dev only): POST /api/render/<show id>?scale=2 → 202 { job }; GET /api/render/jobs/<job> →
//   { state, progress, eta, message, files?: string[] }; one job at a time; spawns node scripts/render-show.mjs; loopback only.
// src/studio/ui/widget-picker.ts (T16)
export function filterWidgets(metas: readonly WidgetMeta[], f: { feel: readonly string[]; instruments: readonly string[];
  tracks: readonly string[] | null /* "suits this song": the pack's track ids */ }, words: TagWords): WidgetMeta[];
//   AND across chosen words; a widget passes "suits this song" when one of its instruments maps to one of the tracks
// src/studio/ui/layer-controls.ts (T16)
export function listenOptions(pack: Pick<SongPack, 'tracks'>): { group: string; value: Listen; label: string }[];
//   'All notes'; 'In this recording': present tracks (TRACKS order, label + note count); 'Families': family:<f> with ≥ 2
//   present tracks; 'From the notes': Melody, Bass line, Inner voices, Low notes, High notes, Accents
export function defaultRegion(widget: string): Region;   // ellipse 0.5,0.5,0.5,0.5 feather 0.25; spot for casket pixelsort tunnel blocks fold timeslice, else window
// src/studio/ui/lanes.ts (T18): mountLanes(el, deps): { update(s: StudioState): void } and pure helpers
export function snapTime(t: number, o: { beats: readonly number[]; snap: boolean; fine: boolean; span: Span }): number;
//   snap on and not fine: the nearest beat within 0.25 s, else t; always clamped to the span; rounded to ms
export function bendFromDrag(v0: number, v1: number, dyFraction: number): number;   // drag up bows the segment up, whichever way it runs; −1..1
export function hitTest(pivots: readonly Pivot[], x: (t: number) => number, y: (v: number) => number, px: number, py: number):
  { kind: 'pivot'; index: number } | { kind: 'segment'; index: number } | { kind: 'empty' };   // pivot radius 6 px, segment 5 px
// lab/region-ui.js (T17): WA_REGION_UI.mount(stage: HTMLElement, canvas: HTMLCanvasElement,
//   o: { get(): Region | null; set(r: Region, phase: 'drag' | 'end'): void; hint?: string }) → { refresh(): void; destroy(): void }
```

### §11 The lab (T21, T22)

- **Layer settings.** `LAYERS[id] = { listen?, region?, intensity? }`, in localStorage `wa-layers`, also posted to the
  save server. "Copy" exports them as `layers`, in the show's field shapes, beside `params`.
- **The song's pack data.** A `SONGS` entry may name `pack: 'pack-<id>.js'`. That file is written by
  `npm run lab-notes -- <id>` (T13) and sets `window.PACK = { tracks, beats, loudness }`. `readLabSongs` accepts the key.
- **Render mode.**
  - `?layers=<url-encoded JSON of { widget, listen?, region?, intensity? }[]>`, one entry per widget.
  - Load order in both pages: every base tool in `TOOL_IDS` order, then each routed entry re-instantiated in
    `TOOL_IDS` order. The routed instance draws in its card's place.
  - `render.html?labSong` (T12) takes the same `layers=` and loads the same pack file.
- **`step()`.** For an active tool with a `LAYERS` entry, `WA_LAYERS.drawLayered(labHost, …)`. Without one, today's
  lines, byte for byte.
- **Lab intensity is presets only.** It is applied over the current moment's span, or the whole song, and stored as
  pivots.

---

### Task 1: Contracts and scaffolding

**Depends:** nothing. Serial, first.

**Files:**
- Modify: `src/widgets/types.ts` (§1), `package.json`, `tsconfig.scripts.json`, `.gitignore` (`lab/pack-*.js`), and
  `scripts/studio-check.mjs` (it uses the helper).
- Create:
  - `src/widgets/layers.ts`: `WaLayers` and `evalLayers` (§2), with types only for the not-yet-written members;
  - `src/widgets/layers-source.ts` (`layerSources()`, plus `studioLayers(): WaLayers`, memoized, so the UI tasks reach
    the shared code without touching `main.ts`) and `scripts/node/layers.ts`;
  - `lab/layers/persist.js`: `VIS_REDRAW`, `vis`, and an empty `PERSIST = {}` between `// persist:start` and
    `// persist:end`. It is here, not in T4, because both T4 and T5 need `vis`. T12 fills the block.
  - `scripts/lib/studio-session.mjs`;
  - the test `tests/layers-loader.test.ts`.
- `package.json` scripts: `setup-ymt3` (tsx), `pianoroll`, `hd-check`, `persist-probe`, `lab-notes` (tsx),
  `runtime-check`, `layers-check`, `overlay-check`, `lanes-check`.
- `tsconfig.scripts.json` includes `scripts/{setup-ymt3,lab-notes}.ts`.

**Interfaces:** Produces §1 and §2's loader. `studio-session.mjs`:
`openStudio({ songs?: 'fixture' | string[], shows?: Record<string, object>, viewport? }) → { page, base, dirs, close() }`.
It is the set-up that `studio-check` does today, moved without changing behaviour.

- [ ] **Step 1: Test.** `tests/layers-loader.test.ts`:
  - `evalLayers({ 'b.js': "WA.two = () => 2;", 'a.js': "WA.one = 1;" })` has `one === 1` and `two() === 2`.
  - Files are evaluated in name order: `b.js` reads `WA.one` and sees it.
  - A source that throws makes `evalLayers` throw, naming the file.
  - `loadLayers()` on the repo returns an object with `vis(0.5, 'redraw') === 0.15` and `vis(0.4, 'strokes') === 0.4`.
- [ ] **Step 2:** Implement, and refactor `studio-check` onto `studio-session.mjs`.
- [ ] **Step 3: Verify.**
  - `npx vitest run tests/layers-loader.test.ts` → PASS.
  - `npm test` → all pass.
  - `npm run typecheck` → clean.
  - `npm run studio-check` → the same assertions pass as before (33/33).
  - `npm run fidelity -- --quick` → 0 failed.
- [ ] **Step 4: Look.** Nothing new to see: the studio-check screenshots are unchanged.
- [ ] **Commit:** `Studio: contracts for instruments, regions and intensity; one studio session helper for browser checks`.

### Task 2: YourMT3+ installed outside the repo, its runner and piano rolls

**Depends:** T1. Runs in wave 1. **Do Step 1 first in the whole build: the scratch copy of the Space is temporary.**

**Files:**
- Create: `scripts/ears/ymt3.py` (from `S/inst/yourmt3/run/ymt3_run.py`: one audio file, ffmpeg decode, the JSON of
  §4, `--probe`), `scripts/ears/requirements-ymt3.txt` (the pins in the Tech stack, plus einops 0.8.2, librosa 0.11.0,
  mido 1.3.3, pretty_midi 0.2.11.post0, numpy 1.26.4, soundfile 0.14.0, smart_open, Deprecated), `scripts/setup-ymt3.ts`,
  `scripts/node/ymt3.ts`, `scripts/pianoroll.mjs`.
- Test: `tests/ymt3-config.test.ts`.

**Interfaces:** Produces §4 (`ymt3.ts`, `setup-ymt3`, `ymt3.py`). `npm run pianoroll -- <notes.json | pack id>
[--from 0] [--to 60] [--by track|class|line] [--curve <pivots.json>] --out <png>`. It draws an SVG in a Playwright page:
time on x, MIDI on y, one colour per track, class or line, with a legend. It is used for looking in T2, T4, T11 and T13.

- [ ] **Step 1: Install.** Run
  `npm run setup-ymt3 -- --from "S/inst/yourmt3/dl/YourMT3" --ckpt "S/inst/yourmt3/ck/moe.ckpt"`. Expect `ymt3.json`
  written in `%LOCALAPPDATA%/WinkelAmp/ymt3/`, `sha256 ok`, `probe ok: cuda`.
- [ ] **Step 2: Test** `ymt3-config`:
  - With `WINKELAMP_YMT3` set to a temp folder holding a valid `ymt3.json` → that config.
  - With it set to a missing path → `{ missing }`, mentioning `npm run setup-ymt3`.
  - Pointing at a `ymt3.json` file works too.
  - A config whose `ckpt` does not exist → `missing` naming the path.

  FAIL → implement → PASS.
- [ ] **Step 3: Run it.**
  - `node --import tsx -e "…runYmt3('S/inst/yourmt3/audio/beethoven5-60.wav', '<tmp>/b.json')"` → 902 ± 30 rows. Counts
    within 10 % of `report.moe.json` (Violin 353, Viola 222, Cello 181, String Ensemble 78), and a French Horn note in
    41–45 s.
  - The same for `vivaldi-winter-60.wav` (870 ± 30).
  - Time both runs. Expect about 10 s per minute plus the load.
- [ ] **Step 4: Look.**
  - `npm run pianoroll -- <tmp>/b.json --by class --to 60 --out renders/look/T2/beethoven-60.png`, and the same for
    Vivaldi.
  - Read them. Beethoven:
    - string ensemble 0–5 s;
    - violins from about 5–6.6 s, filling 6–12.9 s;
    - a horn cluster at about 41.6 s;
    - clarinet, oboe and bassoon from 45 s.
  - Vivaldi: cellos and violas before the violins.
  - Say so in the report.
- [ ] **Step 5:** `npm run typecheck` → clean. Commit: `Studio: YourMT3+ installed outside the repo (npm run setup-ymt3), its runner, and piano-roll pictures`.

### Task 3: Pack v2: tracks, hybrid notes and estimated velocities (pure)

**Depends:** T1. Runs in wave 1.

**Files:**
- Create: `src/studio/pack/{instruments,tracks}.ts`.
- Modify: `src/studio/pack/pack.ts`, `src/studio/pack/build.ts`.
- Tests: `tests/pack-v2.test.ts`, `tests/pack-tracks.test.ts`.

**Interfaces:** Produces §3. Consumes §1.

- [ ] **Step 1: Tests.**
  - `pack-tracks`:
    - `trackOf('French Horn') === 'horn'`, `trackOf('Tuba') === 'trombone'`, `trackOf('Synth Pad') === null`,
      `trackOf('Drums') === null`.
    - Every `TRACKS` class appears once.
    - `cleanRows` drops Drums, `vel 0` and `end ≤ start`.
    - `pianoShare` of 3 piano rows + 1 violin row → 0.75; of `[]` → 0.
    - `hybridNotes([[1,2,60,80]], [[1.1,2,64,100],[1.2,2,67,100],[3,4,70,100]])` → piano note + `[3,4,70,100]` only.
      The 0.15 edge: 1.15 is dropped, 1.151 is kept.
    - `midRank([3,1,2,2])` → `[1, 0, 0.5, 0.5]`; `midRank([5])` → `[0.5]`.
    - `quantileOf([10,20,30], 0.5) === 20`, at `0.25 → 15`.
    - `estimateVelocities`:
      - a row matching a piano note of the same midi 0.04 s away borrows its vel; 0.06 s away does not;
      - with 60 piano notes of vel `i + 40`, the loudest row gets 99 and the quietest 40;
      - with no piano notes, the median-level row gets 69, and levels at the 5th and 95th ranks give 46 and 95;
      - results are always integers in 1..127.
    - `onsetLevels` on a 44.1 kHz PCM of silence then a 0.5-amplitude sine at 1.0 s → about −9 dBFS at 1.0, and
      −Infinity clamped to −120 at 0.5.
    - `buildTracks` writes a track only with at least `max(12, 0.5 % of rows)` notes. Its `share`, `family` and `label`
      come from `TRACKS`.
  - `pack-v2`:
    - `validatePack` accepts a v1 pack unchanged.
    - It accepts a v2 pack with a violin track.
    - It rejects an unknown track id, a family that does not match the id, unsorted track notes, `share` 1.5, and
      `kind 'orchestra'`.
    - `buildPack` with `ymt3` rows of `pianoShare 0.9` → `kind 'piano'`, notes = the piano notes exactly, no tracks.
    - With `pianoShare 0` → `kind 'ensemble'`, `notesFrom 'hybrid'`, tracks present, `version 2`.
    - With `ymt3: null` and coverage 0.5 → `kind 'ensemble'`, the warning `no instrument tracks`.
    - With `notesMode 'ymt3'` → `notesFrom 'ymt3'`.
    - Every result passes `validatePack`.
    - The 600 s, 9000-note pack from last night's test, plus 9000 rows → under 1.5 s.
- [ ] **Step 2:** Run → FAIL. Implement → PASS. `npm test` → all pass, last night's `pack-build` included.
- [ ] **Step 3: Look.** Pure: none here. The piano rolls of the hybrid come in T11.
- [ ] **Commit:** `Studio: song packs v2: instrument tracks, gap-filled notes and estimated velocities`.

### Task 4: Shared maths: curves, presets, thinning, visibility, lines and the pulse

**Depends:** T1. Runs in wave 1.

**Files:**
- Create: `lab/layers/automation.js`, `lab/layers/lines.js`. `persist.js` already came with T1.
- Tests: `tests/layers-automation.test.ts`, `tests/layers-presets.test.ts`, `tests/layers-lines.test.ts`,
  `tests/layers-pulse.test.ts`. All of them go through `loadLayers()`.

**Interfaces:** Produces §2's automation, persist and lines members, with the exact semantics block.

- [ ] **Step 1: Tests.**
  - `layers-automation`:
    - `automationAt(undefined, 5) === 1`. Before the first pivot and after the last, the curve holds.
    - Linear midpoint 0.5.
    - `bend 1` at u 0.5 → `0.5 ** 0.125`.
    - ease at 0.25 → 0.15625.
    - hold → v₀ until the next t, then v₁.
    - Two pivots at the same t → the second's v.
    - Clamped to 0..1.
    - `fnv32('')` → `0x811c9dc5`; `fnv32('a')` is the FNV-1a of bytes 0x61, 0x00.
    - `passes(t, 1, s)` is always true and `passes(t, 0, s)` always false.
    - Over 10 000 chords at 1 ms steps, `passes(·, 0.3, salt)` is true 30 ± 1.5 % of the time.
    - The same inputs always give the same answer.
    - `vis(0.5, 'redraw') === 0.15`, `vis(0.3, 'redraw') ≈ 0.069 + (0.15 − 0.069)·0.2`, `vis(0.4, 'strokes') === 0.4`.
    - A `Math.random` spy sees 0 calls over everything above.
  - `layers-presets`, over span [10, 30]:
    - `fadeIn(s, 4)` → `[{10,0},{14,1}]`; `fadeOut(s, 4)` → `[{26,1},{30,0}]`.
    - `swell` → 3 ease pivots, the peak at 20.
    - `pulse` with beats every 0.5 s from 0 to 40 and `every 4` → pulses at 10, 12, 14…, each `{p,1}`,
      `{p+1, 0, 'hold'}`.
    - `pulse` with beats only in 0–5 → the grid from 10 at the median gap.
    - `pulse` with no beats → every 2 s.
    - `gate` on a curve that is 0.9 over 15–20 s and 0.2 elsewhere, `above 0.5` → opens at 14.85, closes 20 → 20.1.
      A 0.2 s blip makes no pivots. A 0.3 s dip is bridged.
    - `plays` on notes 12–13 and 13.5–16 → one run, 12–16.
    - Every preset result is sorted and inside the span. A gate on 1000 alternating runs is capped at 256 pivots.
  - `layers-lines`:
    - Chords C4-E4-G4 then E4 while G4 still sounds → melody keeps G4 and drops the E4 attack.
    - A new chord whose top is G4−3 after G4 ended → it joins.
    - The bassline is symmetric.
    - inner = the rest.
    - low and high by 55 and 72.
    - accents = the chords at or above the 85th percentile (nearest rank) of 20 chords of vels 1..20 → the chords of
      vels 17..20.
    - `listenNotes({ notes, tracks: { violin: {…} } }, 'violin')` → the violin notes.
    - `'family:strings'` → the union of violin and cello, stable by start.
    - `'horn'` when it is missing → `heard 'all'`.
    - `'melody'` → `lineNotes`.
  - `layers-pulse`:
    - 10 000 random steps (seeded: random notes, chords and dt in 0..0.05) through `advancePulse` and
      `advanceFeatures`: every field equal with `Object.is`.
    - `groupChords` and `soundingAt` from `lines.js` equal `src/widgets/chords.ts` on 50 random note lists, deep-equal.
- [ ] **Step 2:** Run → FAIL. Implement → PASS.
- [ ] **Step 3: Look.**
  - `npm run pianoroll -- chopin-winter-wind --from 20 --to 40 --by line --out renders/look/T4/winter-lines.png`. This
    needs the local pack: skip it if it is missing.
  - The melody should run along the right-hand runs' tops, the bassline along the left hand's march.
  - Also `--curve` with each preset over a 20 s span → `renders/look/T4/presets.png`. It should read as the names say.
- [ ] **Commit:** `Studio: one implementation of intensity curves, presets, thinning and derived lines, for the lab and the studio`.

### Task 5: Shared maths: regions

**Depends:** T1. Runs in wave 1.

**Files:**
- Create: `lab/layers/region.js`, `scripts/checks/region-masks.mjs`.
- Test: `tests/layers-region.test.ts`.

**Interfaces:** Produces §2's region members. `buildMask`:
- an ellipse is a radial gradient in a unit circle, scaled to the box;
- a rect is four linear-gradient edges (no `filter`).

In both, the stops follow `featherAlpha`. For `cls 'redraw'` the alpha profile goes through `vis` before it is baked.

- [ ] **Step 1: Test** (pure parts):
  - `regionBox({x:.5,y:.5,w:.5,h:.5,…}, 2560, 1440)` → `{cx:1280, cy:720, w:1280, h:720}`.
  - rot 90 → `π/2`.
  - `featherAlpha(0, .25) === 1`, `(1, .25) === 0`, `(0.875, .25) === 0.5`, feather 0 → a step at 1.
  - `glideRegion(a, b, 0)` equals a's geometry, at 1 b's, at 0.5 smoothstep 0.5 → the midpoint.
  - `fitRect` cover of a 0.4 × 0.5 region on a 16:9 canvas crops the sides, contain letterboxes, stretch is the whole
    canvas.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Look.** `npm run` is not needed: `node scripts/checks/region-masks.mjs` opens a blank page, evaluates
  `lab/layers/region.js`, and draws the masks into `renders/look/T5/masks.png`:
  - ellipse and rect;
  - feather 0, 0.25 and 1;
  - rot 0 and 30;
  - both classes.

  Read it: soft edges without banding, the rotation about the centre.
- [ ] **Commit:** `Studio: region geometry and soft masks, shared by the lab and the studio`.

### Task 6: Tags: feel words and instruments for every widget

**Depends:** T1. Runs in wave 1.

**Files:**
- Create:
  - `lab/tags.json`: the `tags` block of `S/tags/tags-proposal.json`, the space-separated strings split into arrays;
  - `lab/tag-words.json`: the vocabulary, the instrument `tracks` map of §8, and ~30 synonyms (scary → dread,
    hasty → skittish, dripping → liquid, …);
  - `src/widgets/tags.ts`.
- Modify:
  - `src/widgets/catalogue.ts` (toMeta with tags);
  - `src/widgets/sources.ts` (`labTags()` and `labTagWords()` from `?raw` JSON imports);
  - `scripts/node/catalogue.ts` (reads both files and sets `meta.tags`);
  - `scripts/widget-docs.ts`: one line under each widget, `Feel: silky, longing … · Suits: violin, plucked, cello ·
    Role: base`; `--check` also fails on `validateTags` errors and prints its warnings;
  - `docs/COMPOSING-SHOWS.md` (only the generated block, via the script).
- Test: `tests/tags.test.ts`.

**Interfaces:** Produces §8.

- [ ] **Step 1: Test.**
  - `validateTags` of the real files → no errors.
  - Every feel word of the vocabulary is used at least once.
  - A tag `'sparkly'` → an error naming the widget and the word.
  - A key `'nope'` → an error.
  - A widget id without tags → a warning, not an error. Lab widgets keep arriving.
  - `feelWordsIn('Scary, dark and dripping; a hasty storm', words)` → `['dark', 'dread', 'liquid', 'skittish']` in
    vocabulary order.
  - `tracksFor('strings')` → `['family:strings']`.
  - `loadCatalogue().widgets.get('strings').tags.instruments` contains `'violin'`.
- [ ] **Step 2:** FAIL → implement → PASS. Run `npm run widget-docs`, then `npm run widget-docs -- --check` → exit 0.
  Its warnings list the widgets the round added without tags (fold, timeslice, stella…): add tags for them in this task,
  in the same vocabulary, from their blurbs and one still each.
- [ ] **Step 3: Look.** Read the generated block in `docs/COMPOSING-SHOWS.md` for strings, squares, casket, current and
  rorschach: the words fit what each widget draws.
- [ ] **Commit:** `Studio: tags: feel words, suited instruments and a stack role for every widget (lab/tags.json)`.

### Task 7: HD core: supersampling behind a context proxy

**Depends:** T1. Runs in wave 1.

**Files:**
- Create: `src/widgets/hd-context.ts`, `scripts/hd-check.mjs`.
- Modify:
  - `src/widgets/runtime.ts` (`opts.scale`, base transform, fade, burn and scratch at real size);
  - `src/widgets/driver.ts` (pixels at real size, `renderSize`);
  - `src/studio/render-page.ts` (`?scale=`);
  - `scripts/fidelity.mjs` (`--record`, `--against`).
- Test: `tests/hd-context.test.ts`.

**Interfaces:** Produces §7: `hdContext`, `scaleFilter`, `RuntimeOptions`, `?scale`, `hd-check`, and
`fidelity --record/--against`.

- [ ] **Step 1: Test** `hd-context`, on a fake context that records calls:
  - `hdContext(g, 1) === g`.
  - At S 2: `setTransform(1,0,0,1,10,20)` → recorded `(2,0,0,2,20,40)`; a DOMMatrix argument likewise;
    `resetTransform()` → `(2,0,0,2,0,0)`.
  - `getTransform()` of `(2,0,0,2,20,40)` → `(1,0,0,1,10,20)`.
  - `shadowBlur = 8` → the target sees 16, and reading it back gives 8.
  - `filter = 'blur(4px) drop-shadow(1px 2px 3px #000)'` → the target sees `'blur(8px) drop-shadow(2px 4px 6px #000)'`,
    and reading it back gives the original.
  - `getImageData` throws naming `who()`.
  - Methods are called with `this` = the target.
  - `scaleFilter('none', 2) === 'none'`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Scale 1 untouched.**
  - Before the runtime change: `npm run fidelity -- --record <scratch>/fid-before.json`.
  - After it: `npm run fidelity -- --against <scratch>/fid-before.json` → 0 failed, every lab hash equal.
  - `npm run fidelity -- --quick` → 0 failed.
- [ ] **Step 4: hd-check.** Calibrate `QD` on kandinsky, strings, current and squares (prelude 126), then run
  `npm run hd-check -- --scale 2`. Expect QUARTER on the shared-canvas readers (casket, blocks, tunnel, pixelsort,
  fold, timeslice: a 1280-sized scratch, or a quarter read) and on no other widget. List the SOFT ones. Fixing them is
  T10, after the lab round.
- [ ] **Step 5: Look.** Read `renders/look/hd/{kandinsky,strings,squares,current,rorschach}.png`. The 2× crop must be
  the same picture, visibly crisper on lines and dots. For the QUARTER widgets, look at one: the bug should be visible
  (a quarter picture, or blur).
- [ ] **Commit:** `Studio: supersampled pictures (scale 2 and 3) behind a context proxy; scale 1 stays pixel-identical`.

### Task 8: Show v2: listen, region and intensity in shows, edits and the schedule

**Depends:** T4 (`automationAt` for the edge pivots in tests). Runs in wave 2.

**Files:**
- Modify: `src/studio/show/{show,edit,schedule,conductor}.ts`, and `src/studio/ui/store.ts`. The store gets an
  optional constructor parameter `env?: EditEnv`, which it passes to `applyEdit`. T8 does not touch `main.ts`: T12
  wires `new Store(…, { curve: studioLayers().automationAt })` when it edits `main.ts`.
- Tests: `tests/show-v2.test.ts`, `tests/show-edit-layers.test.ts`, `tests/show-schedule-instances.test.ts`,
  `tests/show-conductor-layers.test.ts`. Last night's show tests must pass unchanged.

**Interfaces:** Produces §5. Consumes §1, §2 (`automationAt` in `EditEnv`).

- [ ] **Step 1: Tests.**
  - `show-v2`:
    - Each committed `shows/*.json`: `canonicalShow(JSON.parse(file)) === file`, `version 1`.
    - Adding `listen: 'melody'` to one layer → canonical `version 2`, keys in §5's order, each pivot on one line.
    - Removing it → `version 1` again, the same bytes as the file.
    - Every validation and repair row of §5 has an assertion: the path and a word of the message, e.g. `overlap` for
      duplicate keys and `has no horn` for a missing track.
    - `instanceKey({widget:'strings'})` → `'strings'`; with `listen 'all'` → `'strings'`; with `'melody'` →
      `'strings@melody'`.
  - `show-edit-layers` (frozen fixtures, `env = { curve: loadLayers().automationAt }`):
    - `setLayer` with listen → the key changes; refused when the key is already in the section.
    - `null` removes a field.
    - Intensity is sorted, clamped and capped.
    - `moveBoundary` across pivots → a section's pivots stay inside it, with an edge pivot whose v equals the old
      curve's value there.
    - `split` at 15 of a curve `[{10,0},{20,1}]` → `[{10,0},{15,0.5}]` and `[{15,0.5},{20,1}]`.
    - `merge` concatenates the same instance's pivots.
    - `addLayer` of `strings` with listen `melody` next to `strings` → allowed.
    - Every result validates.
  - `show-schedule-instances`, with A [0,10] {strings@melody, strings@bassline}, B [10,20] {strings@melody with a
    region} fade 2:
    - At 5 → two slots with distinct ids.
    - At 10.5 → `strings@bassline` decaying with `until 10`, then `strings@melody` receiving.
    - A's region-less melody has no glide.
    - Give A a spot region and B a moved spot region → at 11, `glide.u === 0.5`.
    - A spot → window change → no glide.
    - `entriesBetween(9.9, 10.1)` → nothing for `strings@melody` (it continues).
  - `show-conductor-layers`, with a fake `RuntimeLike`:
    - `load` receives `InstanceSpec`s with `own` true for routed or curved keys.
    - The step's slots carry `layer.pivots`.
    - `samePreview` is false after a `setLayer` of intensity inside the preview window, and true after one outside it.
- [ ] **Step 2:** FAIL → implement → PASS. `npm test` → all pass. `npm run check-show` → the three shows ok, no warnings.
- [ ] **Step 3: Look.** `npm run studio-check` → passes. The studio opens Winter Wind, its picture unchanged from
  last night (`renders/look/T8/winter.png` against the T1 studio-check screenshot).
- [ ] **Commit:** `Studio: shows v2: a layer can listen to a part, sit in a region and follow an intensity curve`.

### Task 9: The HD master and the share copy

**Depends:** T7. Runs in wave 2.

**Files:**
- Create: `scripts/lib/encode.mjs`.
- Modify: `scripts/render-show.mjs` (§7).
- Test: `tests/encode-args.test.ts`.

**Interfaces:** Produces §7's `render-show` options, frame transport and encode builders.

- [ ] **Step 1: Transport spike** (scratch only). On `beethoven5 --from 155 --to 160` at 2×, 300 frames, time three
  ways:
  1. `getImageData` + POST of the raw bytes;
  2. `toBlob('image/png')` + POST;
  3. base64 through `page.evaluate`.

  Keep the fastest lossless one. Expected: 1. Write the three numbers into the commit message.
- [ ] **Step 2: Test** `encode-args`:
  - `level(2560,1440,60) === '5.1'`, `level(3840,2160,60) === '5.2'`, `level(1920,1080,30) === '4.1'`.
  - `shareVideoKbps(15) === 1872`.
  - `masterArgs` contains `-crf 13`, `-preset slow`, `out_color_matrix=bt709` and the three colour tags;
    `master: 'prores'` → `prores_ks`.
  - `shareArgs` pass 1 has `-an` and `-f null`; pass 2 has `-b:v 1872k`, `scale=1920:1080:flags=lanczos`, `fps=30`,
    `+faststart`.

  FAIL → implement → PASS.
- [ ] **Step 3: Implement** `render-show`:
  - defaults: scale 2, 60 fps, hz 60, crf 13, slow;
  - raw frames to ffmpeg; the audio muxed as today (AAC 320k on the master);
  - the share copy in two passes from the master;
  - the sheet;
  - an ETA from the first 10 s;
  - `--framemd5` over the raw RGBA;
  - `--scale 1 --fps 30 --crf 18 --no-share` still works.
- [ ] **Step 4: Verify.**
  - `npm run render-show -- beethoven5 --from 155 --to 170` → ffprobe shows:
    - the master: h264 high, 2560×1440, 60 fps, 900 frames, `color_space=bt709`, AAC 15 ± 0.05 s;
    - the share copy: 1920×1080, 30 fps, size ≤ 15 MB/min × 0.25 min × 1.05.
  - Two runs with `--framemd5` → identical lists.
  - Note the seconds per video second.
- [ ] **Step 5: Look.** `renders/look/T9/`, cut with ffmpeg crops at 165 s:
  - the old 720p render upscaled to 1440;
  - the new master;
  - the share copy upscaled.

  Crops of 600×400 on a dark gradient (Kandinsky's ground) and on fine lines. The master must be crisper with no
  banding. Write how the share copy holds up (blocking? banding?). If it is clearly blocky, put the size budget to the
  user in the report rather than raising it.
- [ ] **Commit:** `Studio: render-show makes a supersampled 60 fps HD master from lossless frames, and a WhatsApp share copy from it`.

### Task 10: HD-correct widgets (after the lab round)

**Depends:** T7, and **the lab round has landed** (its commit is in, and `git status --short lab/` is clean of others'
work). Runs in wave 2 or later.

**Files:** Modify the `lab/tools/*.js` that `hd-check` flags QUARTER. Expected: blocks, casket, fold, pixelsort,
timeslice and tunnel. Re-grep `drawImage\((x|ctx)\.canvas|createImageBitmap\(x\.canvas` first.

**Interfaces:** None new. The rule for each edit:
- `const S = x.canvas.width / x.W`;
- scratches sized `x.canvas.width × x.canvas.height`, re-made when the size changes;
- copies at identity in the scratch;
- source rectangles × S;
- draw-backs with an explicit size in user units (`drawImage(sc, 0, 0, x.W, x.H)`).

Optional, per loved or kept widget flagged SOFT, and only when its crop looks soft: size the full-frame offscreen by S.

- [ ] **Step 1: Golden hashes.** `npm run fidelity -- --only <the flagged ids> --record <scratch>/golden-T10.json`.
- [ ] **Step 2:** Edit one widget at a time. After each one:
  - `npm run fidelity -- --only <id> --against <scratch>/golden-T10.json` → 0 failed;
  - `npm run hd-check -- --only <id>` → no QUARTER.
- [ ] **Step 3: Look.** Read `renders/look/hd/casket.png` at prelude 126 (the melt and the cuts), plus blocks, tunnel
  and pixelsort at b5 0. They should be the same composition as at 1×, sharp.
- [ ] **Step 4:** `npm run fidelity` (full) → 0 failed.
- [ ] **Commit:** `Lab: the widgets that read the shared canvas work at any picture size (identical at 1×)`.

### Task 11: Ingest v2: YourMT3+, the hybrid, the fallbacks

**Depends:** T2, T3. Runs in wave 2.

**Files:**
- Modify:
  - `scripts/ingest.ts` (§4's flags and caches, decode once at 44.1 kHz for `onsetLevels`, the stages);
  - `scripts/node/python.ts` (`findPythonBp` from `WINKELAMP_PY_BP` or `C:/Users/maxim/.venvs/wa-bp`, `runBp`);
  - `src/studio/ingest/ears-types.ts` (`ToolStatus`, `STAGE_WEIGHTS`);
  - `scripts/ears/server.ts` (`/health` api 2 with the three tools; jobs pass `--notes auto`).
- Create: `scripts/ears/bp.py` (from `S/inst/basic-pitch/bp_run.py`: onset 0.6, frame 0.4, min 58 ms, melodia on,
  `{version, model, settings, seconds, notes}`), `scripts/ears/requirements-bp.txt`.
- Tests: `tests/ingest-v2.test.ts`, `tests/ears-tools.test.ts`.

**Interfaces:** Produces §4's ingest and `/health`. Consumes §3, `ymt3.ts`.

- [ ] **Step 1: Tests.**
  - `ingest-v2` (`skipIf` no ffmpeg; temp `WINKELAMP_SONGS`; the transcribers stubbed through `WINKELAMP_PY`,
    `WINKELAMP_PY_BP` and `WINKELAMP_YMT3` pointing at small Python or Node stubs that write fixed JSON):
    - piano-share stub 0.9 → `kind piano`, notes = the piano stub's notes.
    - Stub 0 → `ensemble`, `hybrid`, tracks.
    - No `ymt3.json` → `bp-hybrid` and the warning `npm run setup-ymt3`.
    - No `ymt3.json` and no bp → piano, with the warning `about half`.
    - A second run → `up to date`.
    - `--redo ymt3` re-runs only that stub: the stubs count their runs in a file.
    - `--piano-notes <file>` never calls the piano stub.
    - Progress lines never decrease.
  - `ears-tools`: `/health` with the probes stubbed → `api 2`, with `ymt3.ok false` and its reason.
- [ ] **Step 2:** FAIL → implement → PASS. `npm test` → all pass, `ears-server` included.
- [ ] **Step 3: The five recordings** (local, timed). Ingest into a temp `WINKELAMP_SONGS`:
  - `lab/prelude.mp3`, `lab/chopin-winter-wind.mp3` and `lab/chopin-nocturne-48-1.mp3`;
  - `lab/beethoven5.mp3 --piano-notes lab/notes-b5.js`;
  - `lab/vivaldi-winter.mp3`.

  Then:
  - Print `pianoShare` and `kind` for each, and check the spec's rule: piano ≥ 0.8, Beethoven and Vivaldi ≤ 0.1.
  - **If it fails, switch `auto` to the coverage rule (≥ 0.6 → piano). That is a one-line change in `buildPack`, plus
    its test. Say so in the report.**
  - Write down the time per stage and the track counts.
- [ ] **Step 4: Look.**
  - `npm run pianoroll` of the Beethoven pack, 0–60 s, `--by track` → `renders/look/T11/b5-tracks.png`; then the all
    notes (hybrid against the old pack's notes, two colours) → `b5-hybrid.png`. The gap at 6–12.9 s is filled, and the
    old notes are all still there.
  - The same for Vivaldi, 330–400 s: the solo violin on the ice.
- [ ] **Commit:** `Studio: ingest v2: YourMT3+ instrument tracks for ensembles, the piano model for piano, fallbacks with warnings`.

### Task 12: The runtime: instances, routing and intensity

**Depends:** T7, T4, T8. Runs in wave 3.

**Files:**
- Create: `lab/layers/slot.js` (`drawLayered`, the no-region part), `scripts/persist-probe.mjs`,
  `scripts/checks/runtime-layers-check.mjs`.
- Modify:
  - `src/widgets/runtime.ts`;
  - `src/widgets/instantiate.ts` (`instantiate(id, src, env & { notes?: Note[] })`: routed → the 4-argument call with
    the window proxy);
  - `src/widgets/driver.ts` (`renderSeek` resets instances);
  - `src/studio/render-page.ts` (show mode passes the pack's tracks and `layerSources()`; labSong mode takes `layers=`,
    loads `/lab/pack-<id>.js` when its `SONGS` entry names one, and takes `probe=<id>:<weight>`);
  - `lab/layers/persist.js` (the generated `PERSIST` block);
  - `src/studio/ui/main.ts` and `player.ts` **only** where they construct the runtime and the store: they pass
    `studioLayers()` and the pack's tracks, and `new Store(…, { curve: studioLayers().automationAt })`.
- Test: extend nothing; `npm run runtime-check` is new.

**Interfaces:** Produces §6 (T12 part). Consumes §2, §5.

- [ ] **Step 1: Default path proof.** `npm run fidelity -- --record <scratch>/fid-T12.json` before, then `--against`
  after → 0 failed. `npm run fidelity -- --quick` → 0 failed.
- [ ] **Step 2:** Implement `drawLayered` (no region) and the runtime's instances.
- [ ] **Step 3: `runtime-check`** (headless Chrome, render.html, prelude). Every assertion is an exact hash compared
  over 3 frames:
  1. `layers=[{widget:'strings', intensity:[{t:0,v:1}]}]` ≡ no layers.
  2. A routed instance on a part whose notes equal all notes (a test hook `&tracks=same`) ≡ unrouted. Use a widget with
     no load-time randomness, checked first by loading it twice.
  3. Seek invariance:
     - `renderSeek(120)`, then `renderTo(125)`;
     - against `renderSeek(118)`, `renderTo(125)` with a curve that is 0 over 118–120;
     - the frames at 125 are equal for a widget with no memory beyond 2 s. If none qualifies, compare the delivered-chord
       logs from a debug hook instead.
  4. Thinning at a constant 0.5: the delivered-chord log equals `passes` predicted in Node for the same salt and times.
  5. `strings@melody` and `strings@bassline` together → two distinct `renderErrors`-free instances. Their pulses
     differ (`window.renderRuntime.rt.instance(k).feat.pitch`).
  6. `Math.random` calls per step are the same with and without a constant-1 curve.
- [ ] **Step 4: Persistence classes.**
  - `npm run persist-probe` renders each widget alone at prelude 120 and b5 0, for 5 s, at slot weight 0.25 and at 1.
  - With `r` = mean brightness at 0.25 ÷ at 1: r ≥ 0.5 → `redraw`, else `strokes`.
  - It writes the block in `lab/layers/persist.js` and prints the table.
- [ ] **Step 5: Look.**
  - `renders/look/T12/fade-kandinsky.png`: a contact sheet, one frame per 0.25 s over b5 20–24, kandinsky with
    `fadeIn` over 4 s. The rise should look even, not sudden at the end. If it looks sudden, its class is wrong: check
    the probe.
  - `squares-thinned.png`: squares at 0.5 against 1, side by side. About half the squares.
  - `winter-strings.png`: Winter Wind at 25 s, strings on melody against all notes. The threads should follow the
    right hand's runs.
- [ ] **Step 6:** `npm test`, `npm run typecheck`, `npm run studio-check` → PASS.
- [ ] **Commit:** `Studio: layers listen to a part (instances with their own notes and pulse) and follow an intensity curve`.

### Task 13: Re-ingest the songs, tracks in describe-song, and the lab's pack files

**Depends:** T11. Runs in wave 3.

**Files:**
- Modify: `scripts/describe-song.ts`. When the pack has tracks, it adds a table of where each track plays, every 10 s
  (a dot per track with `presence ≥ 0.3`), plus `kind` and `pianoShare`.
- Create: `scripts/lab-notes.ts` (`npm run lab-notes -- <id>` → `lab/pack-<id>.js`, setting
  `window.PACK = { tracks, beats, loudness }`, git-ignored). Local data: `songs/*`.

**Interfaces:** Consumes §3 and §4. Produces the v2 packs that T20 and T24 use.

- [ ] **Step 1: Re-ingest** the real `songs/`:
  - `beethoven5` with `--piano-notes lab/notes-b5.js`;
  - `prelude` and `rach-prelude-recording` with `--piano-notes lab/notes.js`;
  - `chopin-winter-wind`, `chopin-nocturne-48-1` and `vivaldi-winter` with `--notes auto`.

  Every pack is `version 2`. The piano songs' notes are byte-identical to before: `cmp` the `notes` arrays.
- [ ] **Step 2:** `npm run describe-song -- beethoven5` and `-- vivaldi-winter`: the track table matches the T2 piano
  rolls.
- [ ] **Step 3:** `npm run lab-notes -- beethoven5` and `-- vivaldi-winter`. Commit nothing of these: they are
  git-ignored.
- [ ] **Step 4: Look.** `npm run pianoroll -- vivaldi-winter --by track --out renders/look/T13/vivaldi.png` over the
  whole song, with the cello, viola and violin rows. Read it against the lab's moments: the Largo's solo line at
  3:30–5:48, and the ice at 5:55.
- [ ] **Commit:** `Studio: describe-song lists where each instrument plays; npm run lab-notes gives the lab a song's tracks`.

### Task 14: Export in the studio: better recorder presets and "Render HD master"

**Depends:** T9. Runs in wave 3.

**Files:**
- Modify: `src/studio/ui/record.ts` (§10 presets; the Export menu gains "Render HD master (on this computer)" when the
  dev API answers), `scripts/studio-api.ts` (render jobs), `tests/record-presets.test.ts` (new numbers).
- The Export menu probes `/api/health` itself, so T14 does not touch `main.ts` (T12 owns it in this wave).
- Test: `tests/render-job.test.ts`.

**Interfaces:** Produces §10's presets and the render-job API.

- [ ] **Step 1: Tests.**
  - `mbPerMinute(share) === 15.2`, `mbPerMinute(high) === 61.4`.
  - `render-job`, with the middleware and a fake spawner:
    - a POST → 202, and a GET shows `running` with progress parsed from render-show's lines;
    - a second POST while running → 409;
    - a remote address → 403;
    - a failed child → `failed`, with its last line.
- [ ] **Step 2:** FAIL → implement → PASS. Then `npm run record-check` with its size limit updated to the new
  `share`: 20 s ≤ 15.2 × 1.4 / 3 MB.
- [ ] **Step 3: Look.**
  - A screenshot of the Export menu → `renders/look/T14/export.png`.
  - A 20 s recording at each preset of the Prelude at 126 s: a frame crop of each beside the old share preset's. The
    difference is visible on squares' edges.
  - Start a "Render HD master" of 10 s from the studio: the progress shows, and the files are named at the end.
- [ ] **Commit:** `Studio: sharper in-app recordings, and the HD master rendered from the Export menu`.

### Task 15: The runtime: spot and window regions

**Depends:** T12, T5. Runs in wave 4.

**Files:** Modify `lab/layers/slot.js` (the region branches), `src/widgets/runtime.ts` (`windowOf`, the mask cache,
the resets), `scripts/checks/runtime-layers-check.mjs` (new invariants).

**Interfaces:** Produces §6 (T15 part).

- [ ] **Step 1: Invariants** in `runtime-check`, exact hashes:
  - A window at x .5, y .5, w 1, h 1, feather 0, rot 0, blend over, fit stretch, with the widget alone ≡ no region.
  - A spot of the same box with feather 0 ≡ no region.
  - Both hold at scale 2 as well (render.html `?scale=2`).
- [ ] **Step 2:** Implement → `npm run runtime-check` → all pass, the T12 ones included.
  `npm run fidelity -- --quick` → 0 failed.
- [ ] **Step 3: Look** (`renders/look/T15/`):
  - a spot ellipse of casket over squares at prelude 126: the cuts and melt only inside the ellipse, squares untouched
    outside;
  - rorschach in a rotated window rect over kandinsky at b5 0;
  - a contact sheet of a window gliding across a boundary (fade 3), one frame per 0.25 s;
  - the same three at `?scale=2`, as crops.
- [ ] **Step 4: Performance.** In the studio, on a scratch show with six layers (four regions, two curves), play the
  Prelude's 120–140 s with the Performance panel: frame time p95 under 16.7 ms. Write the numbers.
- [ ] **Commit:** `Studio: layers in a spotlight or a window, gliding between sections`.

### Task 16: The layer panel: listens to, where, intensity presets; the tag picker

**Depends:** T15, T8, T6. Runs in wave 5.

**Files:**
- Create: `src/studio/ui/layer-controls.ts` + `layer-controls.css`, `src/studio/ui/widget-picker.ts` +
  `widget-picker.css`, `scripts/checks/layers-check.mjs`.
- Modify: `src/studio/ui/panel.ts` (mounts both). Nothing else: the shared code comes from `studioLayers()`, the pack
  from `store.state.song`, and the tags from `labTags()`/`labTagWords()`. `main.ts` is T17's in this wave.
- Test: `tests/layer-controls.test.ts`.

**Interfaces:** Produces §10's `listenOptions`, `defaultRegion` and `filterWidgets`. Consumes §5's `setLayer` and
`addLayer`, §2's presets, and §8.

**The panel, in its plain words, under the open layer's knobs:**
- **Listens to.** The select of `listenOptions`, plus a 120×14 sparkline of where that part plays in the section.
- **Where.**
  - Whole screen / Spotlight / Window.
  - Shape, edge softness, and for a window "lets the layers below through" and fit.
  - "Reset place".
  - The readers' hint "in a window it cuts only its own picture".
- **Intensity.**
  - Always.
  - Fade in [s]; Fade out [s]; Swell; Pulse every [N] [beats | 4-beat bars]; Gate on loudness [how loud];
    While its instrument plays (only when the layer listens to a part).
  - Clear curve.

  Each preset writes pivots into the section through `setLayer`, in one undo step, and the lane (T18) shows them.

**The picker:** feel chips per widget, a filter row (feel words by axis, instruments by family) and "suits this song".

- [ ] **Step 1: Test.**
  - `listenOptions` of a pack with violin, viola and horn → 'All notes'; three instrument entries in TRACKS order;
    'family:strings' (2 string tracks), no brass family (1); then the six lines.
  - Without tracks → 'All notes' plus the lines.
  - `defaultRegion('casket').mode === 'spot'`, `('kandinsky') === 'window'`.
  - `filterWidgets` with feel `['dark','liquid']` → contains rorschach and not kandinsky; "suits this song" with tracks
    `['violin']` → contains strings and current.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: `npm run layers-check`** (`studio-session`, a fixture pack with a fake violin track):
  - choosing Melody saves `listen: 'melody'`, and Ctrl+Z removes it;
  - Pulse every 1 bar writes pivots 4 beats apart;
  - Window then Reset place gives `defaultRegion`;
  - the dark + liquid filter leaves rorschach in the list;
  - no page errors.
- [ ] **Step 4: Look.** Screenshots `renders/look/T16/{panel-listen,panel-where,panel-intensity,picker-filter}.png` at
  1280×800 and at phone width. The words fit, and nothing overflows.
- [ ] **Commit:** `Studio: the layer panel: what a layer listens to, where it is seen, intensity presets; tags in the widget picker`.

### Task 17: The region overlay on the stage, shared with the lab

**Depends:** T15, T8. Runs in wave 5.

**Files:**
- Create: `lab/region-ui.js` (DOM and SVG only, no canvas drawing), `src/studio/ui/region-overlay.ts` (wraps it; edits
  go through the store with group `region:s:l`), `scripts/checks/overlay-check.mjs`.
- Modify: `src/studio/ui/main.ts` (mount).

**Interfaces:** Produces §10's `WA_REGION_UI` and `mountRegionOverlay`.

**Behaviour** (from design.md §6):
- Drag the body to move the region. Eight handles resize it: Shift keeps the aspect, Alt resizes from the centre.
- A rotate knob, with Shift snapping to 15°. A feather handle, and a dashed inner outline where the feather starts.
- Double-click toggles rectangle and ellipse. The arrows nudge by 1 % (10 % with Shift). Esc closes the overlay.
- "Draw on the stage" drags out a new box.
- It shows only while a layer with a region is open.
- CSS pixels map to fractions through the stage's bounding box, letterboxing included.

- [ ] **Step 1: `npm run overlay-check`:**
  - dragging the body 100 px right at a 1280-wide stage → `x` +0.078 (±0.002);
  - a corner handle with Shift keeps `w/h`;
  - one drag is one undo step;
  - Esc hides the overlay;
  - the canvas hash while the overlay is visible equals the hash with it hidden (it never draws into the canvas);
  - the same after a resize to 900×600.
- [ ] **Step 2: Look.** `renders/look/T17/overlay.png` (handles over a window region at the stage's corner), and a still
  of the picture after a drag.
- [ ] **Commit:** `Studio: place a layer's region by dragging handles on the stage`.

### Task 18: Intensity lanes under the timeline

**Depends:** T15, T8, T4. Runs in wave 5.

**Files:**
- Create: `src/studio/ui/lanes.ts` + `lanes.css`, `scripts/checks/lanes-check.mjs`.
- Modify: `src/studio/ui/timeline.ts` (mounts the lanes under the sections strip). As in T16: `studioLayers()` and
  `store.state.song`, never `main.ts`.
- Test: `tests/lanes-math.test.ts`.

**Interfaces:** Produces §10's lanes. Consumes §2 and §5.

**What the lanes show:**
- One 18 px lane per layer of the selected section. The open layer's lane is 56 px and editable.
- A toggle, "This section / Whole show": the whole show draws the instance across the consecutive sections it plays
  in.
- In each lane: the curve in the widget's hue; the listened part's attacks as ticks; the loudness silhouette, faint.
  The value shows on hover.

**Editing:**
- Click on empty space → a pivot at `snapTime` (snapping to beats when Snap is on, which is the toggle beside the lane).
- Drag a pivot. It stays between its neighbours, and Shift makes it fine: no snap, a tenth of the speed.
- Double-click or right-click a pivot → delete it.
- Drag a segment up or down → `bendFromDrag`. Right-click a segment → Linear / Ease / Hold.
- Each drag is one undo step (`intensity:s:l`).

- [ ] **Step 1: Test** `lanes-math`:
  - `snapTime(10.1, {beats:[10, 10.5], snap: true, fine: false, span: {start: 0, end: 20}}) === 10`; fine → 10.1.
  - It is clamped to the span.
  - `bendFromDrag(0, 1, −0.2) > 0` and `bendFromDrag(1, 0, −0.2) < 0` (dragging up bows up both ways), and the result is
    in −1..1.
  - `hitTest`: a pivot within 6 px, a segment within 5 px, else empty.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: `npm run lanes-check`:**
  - a click adds a pivot, and the show saves it;
  - a drag moves it, and one Ctrl+Z undoes the whole drag;
  - a double-click deletes it;
  - a right-click on a segment and Hold → `shape 'hold'`;
  - the paused picture changes after an edit inside the preview window (`samePreview`).
- [ ] **Step 4: Look** (`renders/look/T18/`):
  - lanes with a Fade in, a Pulse every bar, and a hand-drawn swell with a bent segment;
  - then render the Prelude's 84–96 s with that pulse on squares (`render-show --scale 1 --from 84 --to 96`) and make a
    contact sheet at 0.25 s. The squares should pump with the bars.
- [ ] **Commit:** `Studio: intensity lanes: draw a layer's curve under the timeline with draggable pivots, as in DJ software`.

### Task 19: The auto-composer with tags and instruments

**Depends:** T16–T18 (main.ts), T6, T3, T4. Runs in wave 6.

**Files:**
- Modify: `src/studio/compose/{compose,taste}.ts`, `src/studio/ui/main.ts` (passes the description, `layers` and
  `words`), `scripts/render-show.mjs` (passes them when it composes).
- Create: `src/studio/compose/instruments.ts` (`presence`, `enteringTrack`).
- Test: `tests/compose-v2.test.ts`. Last night's `compose.test.ts` must stay green unchanged.

**Interfaces:** Produces §9.

- [ ] **Step 1: Tests** (generated packs, last night's `makePack` helper with `tracks`):
  - Without `layers` and `words` → `canonicalShow` identical to v1 for three fixtures.
  - The description "dark and dripping" moves the base choice of a quiet low section to rorschach.
  - A pack with a violin track playing 60 % of a section → an accent tagged violin listens to `violin`.
  - A horn track silent until 30 s, then playing 30–40 s inside a 20–60 s section → one window layer, `listen 'horn'`,
    `plays` pivots, centred at 0.25 or 0.75.
  - A piano pack (no tracks) → squares, as an accent, listens to `bassline`.
  - The same input twice gives identical output.
  - Every output validates.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Look.**
  - `npm run render-show -- vivaldi-winter --scale 1 --fps 30 --no-share` (composed: Vivaldi has no show) and its sheet
    → `renders/look/T19/vivaldi-sheet.png`.
  - `npm run describe-song -- vivaldi-winter` beside it.
  - The entering parts get windows where the violins enter. Write which widget went where and why.
- [ ] **Commit:** `Studio: the auto-composer reads the user's feel words and routes layers to the instruments it hears`.

### Task 20: Routing in the hand-composed shows

**Depends:** T12, T13 (Beethoven's v2 pack), T8. Runs in wave 4.

**Files:** `shows/beethoven5.json`, `shows/chopin-winter-wind.json`, `shows/rach-prelude-recording.json`. Only
`listen`: regions and curves stay the user's to add.

**Starting edits.** These are adjusted by looking, at most two rounds; each kept change is named in the commit message:
- **Winter Wind:**
  - "Winter wind" (21.6) and "The storm returns" (164.3): strings → `melody`, squares → `bassline`.
  - "E minor: the march" (61.5): squares → `bassline`.
- **Prelude:** "Agitato" (84.45) and "The crescendo" (115.9): flee → `melody`, squares → `bassline`.
- **Beethoven:**
  - The three "Second theme" sections: strings → `violin`.
  - "Horn call" (39.25, 120.2, 282): squares → `horn`. This only goes in where the pack's horn track has notes in that
    section; otherwise the section is left as it is.
  - "Oboe cadenza": current → `oboe`.
  - "Development" (167.6, 195, 231.4): murmuration → `violin`, rorschach → `cello`.

- [ ] **Step 1:** Edit, then `npm run check-show` → ok, with no warnings (the tracks exist).
- [ ] **Step 2: Look.** For each change, `npm run render-show -- <id> --scale 1 --fps 30 --no-share --from <b − 2>
  --to <b + 10>`, and contact sheets at 0.5 s, against the same clip rendered from the show before the edit
  (`git show HEAD:shows/<id>.json > <scratch>`). Keep a change only where the routed layer visibly follows its part
  better.
  - Beethoven also gets a look at 0–20 s (the re-ingest's gap-fill under the unchanged first sections): the first theme
    is no longer empty.
- [ ] **Commit:** `Studio: the hand-composed shows route layers to the melody, the bass line and Beethoven's instruments`.

### Task 21: The lab runs layers (after the lab round)

**Depends:** the lab round has landed, T15. Runs in wave 6, or wave 5 if the round lands early.

**Files:** `lab/index.html`, `src/widgets/lab-harness.ts` (`readLabSongs` accepts `pack`; `LabSong.pack?: string`).
Test: `tests/lab-layers-harness.test.ts`.

**Interfaces:** Produces §11 (harness side). Consumes §2.

- [ ] **Step 1: Test:**
  - `readLabSongs` on the real `lab/index.html`, with a `pack` key added to a copy → it keeps it;
  - the lab's `step()` source contains the unchanged default branch: the exact statements of today's per-tool loop,
    found by string match, so an edit cannot quietly change them.
- [ ] **Step 2: Implement.**
  - `<script src="layers/automation.js">` and the other layer files before the tools.
  - The `LAYERS` store.
  - `step()` → `WA_LAYERS.drawLayered(labHost, …)` for tools with an entry.
  - `?layers=` in render mode, with §11's load order.
  - `window.PACK` from the song's pack file.
- [ ] **Step 3:** `npm run fidelity` → 0 failed (no `LAYERS` = today). Run `node lab/render.mjs` once and compare one
  showcase frame with its earlier md5.
- [ ] **Step 4: Look.** Open `lab/index.html?render=1&only=strings&layers=[{"widget":"strings","listen":"melody"}]` and
  the studio's `render.html?labSong=…` with the same: the two stills are the same picture
  (`renders/look/T21/lab-vs-studio.png`).
- [ ] **Commit:** `Lab: the lab draws layers that listen to a part, sit in a region and follow an intensity curve`.

### Task 22: The lab's cards: listens to, place, intensity preset, tag chips and the filter

**Depends:** T21, T17 (`lab/region-ui.js`), T6. Runs in wave 7.

**Files:** `lab/index.html` (mount hooks, the filter bar), `lab/layer-ui.js` (new:
`WA_LAYER_UI.mount(el, toolId, { song, get, set, onChange })`).

**Interfaces:** Produces §11 (UI side).

**What the lab gets:**
- On each card, under its knobs:
  - **listens to:** the same groups as the studio, from `window.PACK`;
  - **place:** whole, spot or window, plus shape and feather. Choosing spot or window opens `WA_REGION_UI` on `.stage`.
  - **intensity:** a preset select (always, pulse, gate, while it plays, fade at moments), with one slider.
- Feel chips under each card's name, and instrument chips.
- A filter bar over the cards: feel words by axis and instruments by family. It is AND within the picked chips and kept
  in the URL (`?feel=dark,liquid`).
- "Copy" exports `layers` beside `params`.

- [ ] **Step 1:** Implement. Then `node lab/shot.mjs` (or a Playwright script) → screenshots
  `renders/look/T22/{card-controls,filter-dark-liquid,overlay}.png` at desktop and phone width.
- [ ] **Step 2:** `npm run fidelity` → 0 failed.
- [ ] **Step 3: Look.**
  - The dark + liquid filter shows rorschach and a few others.
  - A card set to Melody, played live: the threads follow the melody.
  - Nothing on the page overlaps.
- [ ] **Commit:** `Lab: each card chooses what it listens to, where it is seen and how it comes and goes; tags as chips and a filter`.

### Task 23: Fidelity cases for layers

**Depends:** T21 (T12, T15). Runs in wave 7.

**Files:** `scripts/fidelity.mjs`.

- [ ] **Step 1:** Add the cases, lab `?layers=` against `render.html?labSong&layers=`, with the same pass rule as
  last night's cases:
  - a spot ellipse of casket over squares, prelude 126;
  - a rotated window rect of rorschach, b5 0;
  - strings with `fadeIn` plus a 0.5 hold (thinning), prelude 84;
  - strings on `melody`, prelude 84;
  - strings on `high` and squares on `low`, prelude 126;
  - squares on `violin` with `plays`, vivaldi 30. This needs `lab/pack-vivaldi-winter.js`, and is skipped with a
    message when it is missing.
- [ ] **Step 2:** `npm run fidelity` → 0 failed. Print the table. `--stills renders/look/T23` for the six.
- [ ] **Step 3: Look.** Read the six lab, studio and difference triptychs: the differences are black.
- [ ] **Commit:** `Studio: the fidelity test covers listening, regions and intensity`.

### Task 24: Final review, docs, and HD masters of the hand-composed shows

**Depends:** everything.

- [ ] **Step 1: Every check:**
  - `npm test`, `npm run typecheck`, `npm run build`;
  - `npm run widget-docs -- --check`, `npm run check-show`;
  - `npm run fidelity` (full), `npm run runtime-check`;
  - `npm run studio-check`, `npm run layers-check`, `npm run overlay-check`, `npm run lanes-check`;
  - `npm run record-check`, `npm run hd-check`.

  All pass. Write the counts.
- [ ] **Step 2: Review Focus by hand,** each outcome written into the report:
  - items 1–9;
  - ingest with `WINKELAMP_YMT3=C:/nope` and `WINKELAMP_PY_BP=C:/nope/python.exe` (the warnings);
  - an old v1 show opened, played and saved byte-identical;
  - two instances of strings live;
  - a 256-pivot gate lane dragged;
  - six layers with four regions at 60 fps.
- [ ] **Step 3:** Run the `code-review` skill at `high` on the branch diff against `claude/wizardly-franklin-ttaqyo`.
  Fix every confirmed finding with a test, then rerun Step 1.
- [ ] **Step 4: Docs.**
  - **README:**
    - setting up YourMT3 (`npm run setup-ymt3`, where it installs, the env var, the licence);
    - the ingest flags;
    - `render-show`'s HD master and share copy (and "send the share copy as a *document* in WhatsApp to avoid
      re-compression");
    - the new checks.
  - **`docs/COMPOSING-SHOWS.md`, the hand-written part:**
    - `listen`, `region` and `intensity`, with one example each;
    - the presets in words;
    - spot or window (readers: spot);
    - what intensity does (fewer attacks, fainter, a calmer pulse);
    - the tags and how to pick by them;
    - honest instrument labels.

    Then `npm run widget-docs`.
  - **`docs/HANDOFF.md`:** a new top section in last night's shape:
    - what it is now;
    - where things are;
    - what was checked;
    - what was measured: YourMT3 piano shares and times, ingest stage times, the transport spike, HD seconds per video
      second, share sizes, the persist classes, the 6-layer profile;
    - what is not verified.
- [ ] **Step 5: HD masters.** For `rach-prelude-recording`, `chopin-winter-wind` and `beethoven5`:
  - `npm run render-show -- <id>` (2×, 60 fps, with the share copy);
  - ffprobe each: the master 2560×1440 at 60 fps, BT.709 and the duration equal to the pack's ±0.05 s; the share copy
    1080p30 at ≤ 15 MB a minute × 1.05;
  - time each, and make the contact sheets;
  - put crops of the 720p renders from last night against the masters in `renders/look/T24/`.

  Read them, and say what is better and anything that is not.
- [ ] **Step 6:** Commit the docs and fixes: `Studio: final review fixes; Docs: README, COMPOSING-SHOWS and HANDOFF for instruments, regions, intensity, tags and the HD master`.
- [ ] **Step 7: Report to the user:**
  - what works;
  - the master and share paths, with sizes;
  - the measured numbers;
  - the spec's open [confirm] decisions as they turned out;
  - known limits;
  - that nothing was merged into the main branch (their call).
