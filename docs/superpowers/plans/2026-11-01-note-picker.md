# Note Picker: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to carry out this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal.** A user marks the melody of a song by hand, picks a few of those notes in a popup and connects them to a
widget. The widget then answers those notes only, at their loudness, in the studio and in `render-show`.

**Architecture.**

- **A set of picks is a new `listen`.** `show.picks[id].notes` holds the notes themselves; a layer says
  `listen: 'picks:<id>'` and is an instance `widget@picks:<id>`. The Conductor hands the notes to the runtime on the
  instance spec, and the existing routed path does the rest: the widget's own `NOTES`, `CHORDS` and pulse.
- **Editing a set keeps its id and reloads the instance**, because widgets read their notes when they load.
- **Marks are separate.** `melodies/<song>.json` holds the marked melody, with its own API and undo.
- **The picker is an overlay in `src/studio/ui/`.** Its logic is pure and tested. Its preview is a second runtime on its
  own canvas, never the store.

**Tech stack** as ever: Vite 8, strict TypeScript, vitest, Canvas 2D, Playwright with system Chrome, ffmpeg. No new
dependency.

**Spec.** `docs/superpowers/specs/2026-11-01-note-picker-design.md`. **Mockup, the reference for flow, layout and
wording:** `docs/mockups/note-picker/template.html`.

`NP` below is the scratch folder
`C:/Users/maxim/AppData/Local/Temp/claude/C--Users-maxim-Desktop-projects-github-WinkelAmp--claude-worktrees-ambitious-project-continuation-ff6d7f/b3b4a070-2436-40c2-8249-6478eeb5f1d5/scratchpad/np`.

## Global Constraints

- **Where.** Work only in `C:/Users/maxim/Desktop/projects/github/WinkelAmp/.claude/worktrees/note-picker`, branch
  `claude/note-picker`. `node_modules` and `songs/` are junctions to the main worktree: never `npm install`, never write
  under `songs/`. Never edit another worktree.
- **Ports.** The user is live-testing on 5173: never use or restart 5173, 5174 or 5180. Other builds run on 5190–5399.
  Your own dev server: `npx vite --port <p> --strictPort` from 5401 up, stopped when done. Every script takes
  `WINKELAMP_PORT` after T1 step 1; run `fidelity`, `render-show` and the checks with `WINKELAMP_PORT=5402`.
- **The ratings saver.** Test browsers never post to 5174: `openStudio` aborts it after T1 step 1, and a page opened by
  hand routes `/localhost:5174/` to abort.
- **The user's files.** Do not edit `shows/*.json`, `lab/ratings.json` or `lab/index.html`. A test that saves uses temp
  folders (`openStudio` does) or a scratch copy under `NP/<task>/` through `WINKELAMP_SHOWS`. `melodies/` stays empty in
  this build: it is the user's.
- **Default paths don't move.** A show without picks keeps its bytes, loads the same specs and takes the same runtime
  statements. `npm run fidelity` stays clean after T1. No `drawLayered` change.
- **Never all notes.** No path turns a `picks:` layer into one that hears every note: not a missing set, an empty set,
  a repair or a fallback.
- **Code.** Reads like the code around it: strict TS, one-line helpers, doc comments on what isn't obvious. Every new pure
  function gets a vitest test. Browser checks are `npm run` scripts in `scripts/checks/`, which CI never runs.
- **Commits.** `git add` explicit paths. Message style as in `git log` (`Studio: …`), then a blank line and
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit audio, `songs/`, `renders/`, `notes*.js`,
  `.superpowers`, `study/`. Never push or merge, except the last step, which pushes this branch only.
- **Looking is part of done.** Pictures go to `NP/T<n>/`; read them and say in the report what they show.

## Review Focus

1. **Exactness.** The attacks a widget answers are exactly `groupChords(picks)`, at their velocities: none between, none
   missed, across a boundary, a seek and an edit. Pinned: `tests/picks-runtime.test.ts`, `npm run picks-check`.
2. **Old shows.** `canonicalShow` of every committed show is unchanged, and `npm run fidelity` passes.
3. **Reload.** After "Update the scene" and after undo, only that version of the picks fires, knobs kept, paused picture
   redrawn.
4. **Valid in, valid out.** `applyEdit` and `repairShow` never leave a dangling `picks:` listen or a plain widget where
   picks were.
5. **The draft stays out.** Preview never touches the store, the history, the disk or the live instances; the studio's
   conductor takes no steps while it plays. Pinned: `npm run picker-check`.
6. **The studio under the overlay.** No key reaches it. Pinned: `picker-check`.
7. **Weight.** Four Seasons in the roll: draw cost, not just "it opens". The UI no heavier than the mockup, by looking.

## Tasks

T2 builds on T1, one after the other.

### Task 1: Picks in shows and the runtime

**Files:**
- Modify: `src/widgets/types.ts`, `src/widgets/runtime.ts`, `lab/layers/lines.js`, `src/widgets/layers.ts` (comment on
  `listenNotes`), `src/studio/show/{show,edit,conductor}.ts`, `scripts/studio-api.ts`, `scripts/node/pack-io.ts`,
  `src/studio/ui/api.ts`, `scripts/lib/studio-session.mjs`, `scripts/render-show.mjs`, `scripts/fidelity.mjs`,
  `package.json`, `docs/COMPOSING-SHOWS.md`.
- Create: `src/studio/show/melody.ts`, `scripts/checks/picks-check.mjs`.
- Tests: `tests/picks-show.test.ts`, `tests/picks-edit.test.ts`, `tests/picks-runtime.test.ts`, `tests/melody.test.ts`;
  add to `tests/layers-lines.test.ts`, `tests/studio-api.test.ts`, `tests/check-show.test.ts`.

**Signatures:**

```ts
// src/widgets/types.ts
export interface SongNotes { notes: Note[]; tracks?: …; picks?: Record<string, { notes: Note[] }> }
export interface InstanceSpec { key: string; widget: string; listen?: Listen; own?: boolean;
  /** A set of picks: the notes this instance hears. A loaded key whose notes change is evaluated again. */
  notes?: Note[] }

// src/studio/show/show.ts
export interface PickSet { notes: Note[] }
// Show gains picks?: Record<string, PickSet>; KEYS.show gains 'picks', after 'sections'
export const picksListen = (id: string): Listen => `picks:${id}`;
/** 'picks:p1' → 'p1'; anything else → null. */
export function picksId(listen: unknown): string | null;
/** Notes as a set holds them: malformed ones dropped, numbers to 4 decimals, sorted by start (stable). Says each fix. */
export function repairPickNotes(n: unknown, at?: string, fix?: Report): Note[];
export const isListen: also `picks:<slug>`;
export function usesV2: also a non-empty show.picks.

// src/studio/show/edit.ts, three more ShowEdit kinds, and:
| { kind: 'placePicks'; widget: string; notes: Note[] }
| { kind: 'updatePicks'; id: string; widget: string; notes: Note[] }
| { kind: 'removePicks'; id: string }
/** The smallest free p<N>. */
export function nextPicksId(show: Show): string;

// src/studio/show/melody.ts (pure)
export type Mark = [start: number, end: number, midi: number, vel: number, track?: string];
export interface Melody { version: 1; song: string; notes: Mark[] }
export const emptyMelody = (song: string): Melody;
export function validateMelody(x: unknown): Issue[];
/** One note a line, 4 decimals, sorted by start, a final newline. */
export function canonicalMelody(m: Melody): string;
/** For each mark the nearest unused note at its pitch within `within` s, the same track first; the rest are unmatched,
    in order. Neither list is changed. */
export function matchMarks(marks: readonly Mark[], notes: readonly Mark[], within = 0.05):
  { matched: Map<number, number>; unmatched: number[] };   // mark index → note index; mark indexes

// src/studio/ui/api.ts, ShowStore gains:
melody(song: string): Promise<Melody>;          // static: localStorage 'wa-studio.melody.<id>', else emptyMelody
saveMelody(m: Melody): Promise<void>;
labels(song: string): Promise<LabelNote[]>;     // static: []
export type LabelNote = [start: number, end: number, midi: number, vel: number, label: string];

// scripts/node/pack-io.ts
/** WINKELAMP_MELODIES, else melodies/ beside the shows folder (a test's temp shows folder keeps its own). */
export const melodiesDir = (): string;
```

**Behaviour:**

- `lines.js` `WA.listenNotes`, first thing after the `all` return:
  `picks:<id>` → `{ notes: song.picks?.[id]?.notes ?? [], heard: listen }`, in the file's plain ES5. Never `heard: 'all'`.
- `runtime.ts` `load`: a spec with `notes` is routed on them without calling `listenNotes`. The branch for a loaded key
  becomes: when `spec.notes && spec.notes !== have.notes`, forget the instance (`tools`, `insts`, `order`,
  `errors[key]`, `winG`, leaving `knobs[key]`), then fall through to the fresh load with `this.knobs[key] ??= …`, and call
  `this.safe(key, 'reset', this.g, this.ctx)` on the new tool. Otherwise as today. `routed` is true even on `[]`.
- `conductor.ts`: `showInstances` adds `notes: show.picks?.[id]?.notes ?? []` to a picks instance. `samePreview` returns
  false when `a.picks !== b.picks` and their JSON differs.
- `show.ts`:
  - `validateShow`: errors `picks` (not an object), `picks.<id>` (id not a slug), `picks.<id>.notes` (not a list, empty,
    not sorted), `picks.<id>.notes[i]` (not `[start, end, midi, velocity]`, end before start, midi or velocity outside
    0..127), `sections[i].layers[j].listen` (`picks:x` with no set). Warnings `picks.<id>` (no layer uses it) and
    `picks.<id>.notes[i]` (outside every section using it: never heard). `validateLayer` gets the set of ids.
  - `repairShow`: `repairPickNotes` on each set; drops a set left with no notes; drops a layer whose set is missing,
    saying so; leaves an unused set.
  - `canonicalShow`: `picks` after `sections`, `{}` left out, each note on one line (a token as for pivots, `\u0000N`),
    numbers to 4 decimals. The not-a-part message names `picks:<id>`.
- `edit.ts` (every result validates from a valid show):
  - `placePicks`: `repairPickNotes`; none left → the input itself. Set `nextPicksId`; a layer `{ widget, listen }` on top of
    every section from `sectionAt(first start)` to `sectionAt(last start)`.
  - `updatePicks`: unknown id, no notes or no change → the input itself. Sections in the new span keep their layer at its
    place (a new widget rewrites it and drops its knobs); sections outside lose it; new ones get it on top, with `knobs`
    and `region` copied from the nearest layer of the set, its knobs only if the widget stayed.
  - `removePicks`: every layer of the set, and the set.
  - `addLayer`, `setLayer`: a `picks:` listen with no set → the input itself.
  - `removeLayer`, `merge`, `setLayer`: when the edit removes the last layer of a set, the set goes. A show without picks
    keeps no `picks` key.
- `studio-api.ts`, with the header comment updated:
  - `GET /api/songs/<id>/labels` → `{ notes: LabelNote[] }`, the rows of `notes.ymt3.json`, `{ notes: [] }` without one.
  - `GET /api/melodies/<song>` → the file, or `emptyMelody(song)`. `PUT` → `validateMelody` (and `song` equal to the id), else
    400 `{ errors }`; writes `canonicalMelody`, 204. `apiMiddleware(dirs: { songs; shows; melodies? })` defaults to
    `melodies/` beside `shows`; `studioApi` passes `melodiesDir()`. Writes only from this machine, as the others.
- `WINKELAMP_PORT`: in `studio-session.mjs` `port: Number(process.env.WINKELAMP_PORT) || o.port || 5196`, and the same over
  5190 in `render-show.mjs` and `fidelity.mjs`, `strictPort` still false. `openStudio` also routes `/localhost:5174/` to
  abort.
- `docs/COMPOSING-SHOWS.md`: a short `picks` part under `listen`, in its plain style, saying picks come from the studio.

- [ ] **Step 1: The port variable and the abort.** Commit nothing yet.
- [ ] **Step 2: Tests, failing.**

  `tests/picks-show.test.ts`:
  - `isListen('picks:p1')` true; `'picks:'`, `'picks:P 1'`, `'picks:p_1'` false. `picksId('picks:p1')` → `'p1'`;
    `picksId('melody')` → null. `instanceKey` → `'pointillism@picks:p1'`.
  - **Shows without picks keep their bytes:** for every committed `shows/*.json`, `canonicalShow(JSON.parse(file))`
    contains no `"picks"` (the byte pin in `show-v2.test.ts` still passes unchanged); `base()` with `picks: {}` gives the
    same string as `base()`, version 1.
  - A show with a set: version 2 even with no layer on it; `"picks"` after `"sections"`; a regex finds each note on its own
    line; `1.23456` written as `1.2346`; `canonicalShow(JSON.parse(out)) === out`; `JSON.parse(out).picks` equals the set.
  - Each validation row above has an assertion on its path and a word of its message (`no set`, `sorted`, `no layer`,
    `never heard`). A show with a valid set and layer: no errors and no warnings.
  - `repairShow`: a dangling listen → the layer gone, not plain, `fixed` says `dropped`; unsorted notes sorted; malformed
    notes dropped; a set left empty goes with its layers; an unused set stays. Each result has no errors.

  `tests/picks-edit.test.ts` (frozen fixtures, sections [0,10], [10,20], [20,30]):
  - `placePicks` with notes at 12 and 25 → set `p1`, sorted; the layer last in sections 1 and 2, none in 0; `validateShow`
    no errors. No notes → `toBe` the input.
  - A second `placePicks` of the same widget → `p2`; two instances in one section, no error. `nextPicksId` with `p1`, `p3` →
    `p2`.
  - Through `Store`: a placement is one undo, which gives `toBe` the show before; redo brings it back.
  - `updatePicks` from [12, 25] to [5, 12]: section 0 gains the layer with section 1's knobs and region; section 2 loses
    it; section 1's layer keeps its place. A new widget: every layer rewritten, knobs gone, region kept. No change, unknown
    id, no notes: `toBe` the input.
  - `removePicks`: `canonicalShow` equals that of the show before the placement.
  - `removeLayer` of one of two layers keeps the set; of the last, the set goes, and undo restores both. `merge` that drops
    the last layer of a set: the set goes. `setLayer` to `listen: null` on the last: the set goes.
  - `addLayer` and `setLayer` with `picks:p9`: `toBe` the input.
  - `split` of a section with a picks layer: both have the same key; `entriesBetween` across the split gives nothing.
  - A show without picks through every old edit kind: no `picks` key.

  `tests/picks-runtime.test.ts`: a real `WidgetRuntime` and `Conductor` with `loadLayers()`, in the node environment, under
  `vi.stubGlobal('window', globalThis)`, `vi.stubGlobal('document', { createElement: fakeCanvas })` and a stub 2D context
  (a `Proxy` of no-ops). This setup has been run under vitest and works. A probe widget source pushes
  `[ch.t, ch.vel, ch.notes.length]` to a stubbed global in `onChord`, counts `reset`, and records `window.NOTES.length` and
  `CHORDS.length` at load. Song: 100 attacks; picks: 5 notes making 4 attacks, two of them 30 ms apart. Step at 1/60 s.
  - **Answers exactly the picked attacks and none between:** what the probe heard `toEqual`s `groupChords(picks)` as
    `[t, vel, n]`, in order, and `rt.deliveredLog` for the key has the same times. A plain probe in the same show hears
    all 100.
  - **Loudness:** in the attack's own step, `x.level` at `frame` is at least `vel / 115`, and a louder pick gives more than
    a soft one from a decayed pulse.
  - At load the routed copy sees the picks: `NOTES` length 5, `CHORDS` length 4.
  - **Across a boundary:** the layer in two sections, picks in both: all heard, `reset` not called at the boundary.
  - **Decay:** the layer only in section 0, a pick in the next section's fade: not heard.
  - **Seek:** `c.reset(t)` mid-song, then steps: only attacks after `t`; a seek exactly onto a pick does not fire it, and
    a seek back before it does.
  - **Update:** `setShow(applyEdit(update))` mid-song: only new picks from there, `NOTES` length the new one, a knob set before
    still read by `x.p`, `rt.errors` empty. `setShow(old)`: only old picks.
  - `samePreview(a, updated, t)` false; `samePreview(a, {...a}, t)` true. An unknown set hears nothing: 0 heard, never 100.
  - `showInstances` of a show without picks has no `notes` key on any spec.

  `tests/layers-lines.test.ts`: `listenNotes({ notes, picks: { p1: { notes: two } } }, 'picks:p1')` → those, `heard
  'picks:p1'`; `'picks:p9'` → `[]`, `heard 'picks:p9'`; with no `picks` at all the same.

  `tests/melody.test.ts`: `canonicalMelody` stable and one note a line; `validateMelody` rows; `matchMarks`: 49 ms matched,
  51 ms not, another pitch not, the same track preferred over a nearer other track, one note taken once, the unmatched
  listed in order.

  `tests/studio-api.test.ts`: `labels` with and without a file; melody GET empty with 200, PUT then GET the same bytes, PUT
  invalid 400, PUT with another song's id 400; the file lands in the temp `melodies/` beside `shows`;
  `/songs/<id>/notes.ymt3.json` still 404.

  `tests/check-show.test.ts`: a file with a valid set is ok; one with a dangling listen errors; `--fix` drops the layer and
  the written file has no errors.

- [ ] **Step 3: Implement** until they pass. `npm test`, `npm run typecheck`, `npm run check-show` (no new lines).
- [ ] **Step 4: The browser check.** `scripts/checks/picks-check.mjs`, `npm run picks-check`. `openStudio({ songs:
  ['chopin-winter-wind', 'vivaldi-winter'], port: 5401, shows })`, a show with `pointillism` on a set of 12 hand-chosen
  notes and `squares` plain, in render pages (`render.html?show=…`) at scale 1 and 2, `renderRuntime.rt.deliveredLog = []`:
  - `PASS` the delivered times equal `groupChords(picks)`, at both scales, played through and after a `renderSeek`;
  - `PASS` no widget errors;
  - `PASS` two runs at scale 1 give the same `renderFrameHash` at 5 s;
  - `PASS` a set of track notes that are not in `pack.notes` (Winter) fire at their own times.
- [ ] **Step 5: The renderer.** On a scratch copy under `NP/T1/`: `WINKELAMP_PORT=5402 WINKELAMP_SHOWS=NP/T1/shows npm run
  render-show -- <show> --scale 2 --from 20 --to 30 --no-share --framemd5 NP/T1/a.md5 --out NP/T1/a`, twice. The md5s are
  identical.
- [ ] **Step 6: Regressions.** With `WINKELAMP_PORT=5402`: `npm run fidelity`, `npm run runtime-check`, `npm run
  studio-check`, all as before the task.
- [ ] **Step 7: Look.** Stills in `NP/T1/`: Pointillism on Winter Wind at 20, 25 and 30 s, every note against 12 picks
  (`--shots` on the check), and the sheet from step 5. Say what they show: dots only at picks, stronger on loud ones.
  **Report how Pointillism's colours behave on few notes** (it finds the home key from what it hears). Don't rework it.
- [ ] **Commit:** `Studio: picks: a layer can answer hand-picked notes only, in shows, the runtime and render-show; melody marks have a file and an API`.

### Task 2: The picker

**Depends:** T1.

**Files:**
- Create: `src/studio/ui/picker.ts` (the overlay: tools, legend, steps, stage mirror, set rows, marks and their undo and
  saving, tones, keys), `src/studio/ui/picker-roll.ts` (the roll and the whole-song strip), `src/studio/ui/picker-popup.ts`
  (the popup, the strip of chips, the preview), `src/studio/ui/picker-logic.ts` (pure), `src/studio/ui/picker.css`,
  `scripts/checks/picker-check.mjs`, `tests/picker-logic.test.ts`.
- Modify: `src/studio/ui/main.ts`, `player.ts`, `panel.ts`, `layer-controls.ts`, `lanes.ts`, `package.json`; add to
  `tests/layer-controls.test.ts`.

**Signatures:**

```ts
// src/studio/ui/picker-logic.ts
export interface RollNote { id: number; t: number; e: number; m: number; v: number; i: number; track?: string }
export interface Instrument { key: string; label: string; color: string }
/** The roll's notes, sorted by start, ids in that order: the pack's tracks; else labels when they have two or more kinds,
    each taking velocity from the nearest same-pitched pack note within 80 ms, else 70 (guessed true); else pack.notes
    as one instrument. */
export function pickerNotes(pack: Pick<SongPack, 'notes' | 'tracks'>, labels: readonly LabelNote[]):
  { notes: RollNote[]; instruments: Instrument[]; guessed: boolean };
/** The mockup's COLORS and SPARE. */
export function instrumentColor(label: string, k: number): string;
/** Notes indexed by start: those sounding in [a, b) without looking at the rest. */
export class NoteIndex { constructor(notes: readonly RollNote[]); inView(a: number, b: number): RollNote[] }
export interface RollGeo { xOf(t: number): number; yOf(m: number): number; rowH: number; gutter: number; top: number }
/** The mockup's rule: nearest within 7 px, a tie going to the note attacked nearest the pointer. */
export function noteAt(candidates: readonly RollNote[], x: number, y: number, g: RollGeo): RollNote | null;
export function boxHits(candidates: readonly RollNote[], box: { x0: number; y0: number; x1: number; y1: number }, g: RollGeo): RollNote[];
/** lineNotes(…, 'melody') on these, as the same objects. */
export function suggestLine(L: Pick<WaLayers, 'lineNotes'>, inView: readonly RollNote[]): RollNote[];
export function loudest(notes: readonly RollNote[], k: number): RollNote[];
export interface Chip { note: RollNote; x: number; y: number }
/** Even spacing, height by pitch, 18 px more and a labelled gap at a pause over 1 s. */
export function chipLayout(notes: readonly RollNote[]): { chips: Chip[]; gaps: { x: number; t: number }[]; width: number };
/** "6 of 25 melody notes picked", and when attacks differ, "4 impulses: notes within 40 ms are one". */
export function countWords(picked: readonly RollNote[], total: number): { count: string; of: string; attacks: string };
export const toPicks = (n: readonly RollNote[]): Note[];   // sorted by start
/** A set's notes on the roll (matchMarks): those found, and the picks with no note there. */
export function picksOnRoll(picks: readonly Note[], notes: readonly RollNote[]): { found: RollNote[]; lost: Note[] };

// src/studio/ui/player.ts
/** While resting the loop takes no steps and draws nothing (the preview has the clock); on waking it repaints. */
rest(on: boolean): void;

// src/studio/ui/picker.ts
export class Picker {
  constructor(d: { store: Store; player: Player; api: ShowStore; pack: SongPack; canvas: HTMLCanvasElement;
    catalogue: Map<string, CatalogueEntry>; order: string[]; lib: { sources; harness; layers };
    meta(widget: string): WidgetMeta | undefined; notify(n: Notice): void });
  open(editSet?: string): Promise<void>;
  close(): void;
}
```

**Behaviour:** the spec and the mockup. Take the mockup's words as they are (`Tone on melody notes`, `Suggest top line
here`, `Connect to a widget…`, `Mark the melody`, `Hear it in the scene`, `Your picks`, `Every note, as it is today`,
`Pick the loudest`, `Place in scene`, `Update the scene`), its layout and its CSS values, in the studio's own colours.
Beyond that:

- `main.ts`: `<button data-pick>Pick notes</button>` in the transport before `data-hide`, off while recording;
  `__studio.picker`; `reportWidgetErrors` names `metas.get(key.split('@')[0])`.
- `player.ts`: the constructor gives `startLive` a stepper that skips `reset` and `step` while resting; `rest(false)` clears
  `pictured` and calls `refresh()`.
- `picker-roll.ts`: note bars on a cached canvas, redrawn only when the view, the marks, the hidden instruments or the sets
  change; the playhead and hover on a canvas above it; the strip cached too. It exposes `xOf`, `yOf`, `noteAt` and
  `lastDrawMs` for the check.
- `picker-popup.ts`: `new WidgetRuntime(popupCanvas, { notes: pack.notes, tracks: pack.tracks }, lib)`, a `Conductor`, a
  `startLive` on `player.audio`, all dropped on close. The draft show as in the spec, with the first layer's knobs when
  editing. Chooser: `mountWidgetPicker` with `here: new Set()`, `GROUPS`, `groupOf`, `verdictTag`.
- Placing and updating dispatch one edit, then `select` the first section and the new layer, and the playhead goes a second
  before the first pick. A set row's ✕ dispatches `removePicks`.
- `panel.ts`: export `GROUPS`, `groupOf`; `layerParts` says `hears your picks`; `err` reads `errors()[instanceKey(l)]`;
  `Deps` gains `editPicks(id)`. Its `key` stays on `l.widget`, so the row follows in `sync()`.
- `layer-controls.ts`: `listenLabel` of a picks listen is `Your picks`. In `sync()`, for a picks layer, the select row is
  hidden and `.lc-picks` shows `6 impulses (8 notes picked)` with an `Edit picks` button. `LayerControlsDeps` gains
  `picks(): Show['picks']` and `editPicks(id)`.
- **Every `listenNotes` caller gets the picks,** as `{ notes, tracks, picks }`: `layer-controls.ts` `drawSpark` (its `drawn`
  key takes the notes array too) and `presetPivots`; `lanes.ts` `ticks` and the "While its part plays" preset.
  `lanes.ts` `ticks` doesn't cache a picks listen; it draws picks at alpha 0.9 and full height; `listenWord` says
  `your picks`.

- [ ] **Step 1: Tests, failing.** `tests/picker-logic.test.ts`:
  - `pickerNotes`: tracks → a note per track note, sorted, `track` the id, labels from the pack; Concerto-shaped labels → velocity
    from the nearest same pitch at 79 ms, 70 at 81 ms, `guessed` true; one label → one instrument, from `pack.notes`, ids in
    order; an empty label list the same.
  - `instrumentColor`: `Violins` the violin colour; an unknown label a spare by its index.
  - `NoteIndex.inView` agrees with a plain filter on 2000 random notes with long ones among them, at 50 random windows.
  - `noteAt`: **a dense passage:** a long held note under short ones: a click on a short note's start gets that note; a tie goes
    to the nearest attack; 8 px away nothing; the gutter nothing. `boxHits`: starts inside only, by time and pitch.
  - `suggestLine`: returns the same objects; skips what it isn't given (hidden instruments); the top of an accompaniment under
    a held melody note is not marked.
  - `loudest`: k by velocity, ties by time, k over the length fine.
  - `chipLayout`: even spacing, a gap only over 1 s, highest pitch highest, one pitch centred.
  - `countWords`: `6 of 25 melody notes picked`; a singular; attacks line only when they differ.
  - `picksOnRoll`: found within 50 ms at the pitch; lost kept.

  `tests/layer-controls.test.ts`: `listenLabel('picks:p1')` `Your picks`; `partWords` lower-cased; `presetPivots` `plays` on a
  picks listen reads the set, not all notes.
- [ ] **Step 2: Implement** until they pass. `npm test`, `npm run typecheck`.
- [ ] **Step 3: The browser check.** `scripts/checks/picker-check.mjs`, `npm run picker-check`, `port: 5401`, songs
  `rach-prelude-recording`, `vivaldi-winter`, `rach-concerto-2`, `vivaldi-four-seasons`, driven with the mouse through the
  roll's `xOf` and `yOf`. Each of these is a `check`:
  - **Open:** `Pick notes` opens it; solo Prelude has no legend, Winter has one with counts, the Concerto has one and the guess
    line.
  - **Marks:** a click marks and sounds a note; a box marks several; Alt-box unmarks; Undo takes one back; Ctrl+Z too. The melody
    file in the temp folder has them a second later and on close; reopening restores them. A prepared mark off every note is
    reported in a notice, drawn, and still in the file after a save.
  - **Instruments:** a hidden instrument's notes can't be clicked or boxed, Suggest skips them, its marked notes stay. ♪ sets
    `audio.volume` 0.3, back to 1 with the last ♪ off and on close.
  - **Keys:** with the picker open, Delete, S, F, H, the arrows and Ctrl+Z change neither the show nor the stage.
  - **Popup:** the chooser offers a widget already in the section; three notes of one chord say one impulse; `Pick the loudest`
    and Clear; `Place in scene` off with none.
  - **Preview:** the popup canvas changes while it plays; `Your picks` and `Every note` differ; meanwhile the studio's
    `conductor.step` is not called (a counter wrapped on it), `store.history.canUndo` doesn't change and no request is a PUT. On
    Cancel the studio's picture and playhead are as before. The draft's key is not in `__studio.runtime.loaded()`.
  - **Place:** one layer in each section of the span; `deliveredLog` while it plays equals the picks' attacks; the panel shows
    the impulses; the lane has ticks. **One** Ctrl+Z after closing removes it all; Ctrl+S saves `picks` and `listen` to the temp
    show; a reload plays them.
  - **Edit:** `Edit picks` opens the popup with those chips on, saying `Update the scene`; a change reaches the running widget;
    undo goes back. Unmarking a picked note leaves it in the set, and its chip is listed.
  - **Weight:** Four Seasons opens; through 10 s of playing `roll.lastDrawMs` for the playhead layer has a median under 2 ms and a
    pan or zoom under 16 ms; the rAF interval's median is printed. `pageerror`s: none.
- [ ] **Step 4: Regressions.** With `WINKELAMP_PORT=5402`: `npm run layers-check`, `lanes-check`, `overlay-check`, `studio-check`,
  `npm run fidelity`.
- [ ] **Step 5: Look.** Screenshots in `NP/T2/` with `--shots`: the roll on the Prelude, on Winter with the legend, on the
  Concerto; a dense passage zoomed; the popup with picks; the layer controls with `Edit picks`; the lane's ticks; the stage playing
  Pointillism on picks. Open `template.html`'s layout beside them: say where it differs, and fix what makes it heavier. Click ten
  notes in the densest passage of Winter by hand in a headed run, and report how many hit the note meant.
- [ ] **Commit:** `Studio: the note picker: mark the melody on a roll, pick notes in a popup, preview them through the real widget and place them in the scene`.
