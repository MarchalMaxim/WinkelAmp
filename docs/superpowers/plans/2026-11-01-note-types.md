# Note Types: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to carry out this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal.** A layer can listen to one kind of note: big chords, fast runs, trills, long ringing notes or repeated notes. A
widget with a natural kind gets it when placed in the studio, if the section has enough of it, and one click changes it.
Existing shows and the lab's defaults stay byte-identical.

**Architecture.**

- **A note type is a new `listen`.** The rules live once, in `lab/layers/lines.js`, behind a branch in `WA.listenNotes`. Everything
  after that is the routed path that exists: the instance's own `NOTES`, `CHORDS` and pulse. The runtime, the slot code and
  `lab/index.html` do not change.
- **The default is a field and one call.** `noteType` in `lab/tags.json`; `placedListen` decides at the moment of placing, and
  `panel.ts` passes it to the `addLayer` edit that already takes a `listen`. `edit.ts` does not change.

**Spec.** `docs/superpowers/specs/2026-11-01-note-types-design.md`, with the measurements, the table of every widget and the
calls. Read it first. `S` there is
`C:/Users/maxim/AppData/Local/Temp/claude/C--Users-maxim-Desktop-projects-github-WinkelAmp--claude-worktrees-ambitious-project-continuation-ff6d7f/b3b4a070-2436-40c2-8249-6478eeb5f1d5/scratchpad`.

**The code is in two patches beside this plan,** `docs/superpowers/plans/2026-11-01-note-types/t1.patch` and `t2.patch`: the exact
text, written while designing to prove this plan, and removed again. Both were applied in order from a clean checkout of
the branch: all named tests passed, both typechecks were clean, `npx vitest run` had only the failure named below, and one placement
ran in a real studio. T2's commit deletes the folder.

## Global Constraints

- **Where.** Work only in `C:/Users/maxim/Desktop/projects/github/WinkelAmp/.claude/worktrees/note-types`, branch
  `claude/note-types`. Enter it with `EnterWorktree` first. `node_modules` and `songs/` are junctions: never `npm install`, never
  write under `songs/`. Never edit another worktree.
- **Ports.** Never use or restart 5173, 5174 or 5180. Test browsers never post to 5174. A dev server, if you need one, on a free
  port from 6501 up (`npx vite --port <p> --strictPort`), stopped when done.
- **The user's files.** Do not edit `shows/*.json` or `lab/ratings.json`.
- **Bytes.** No show's bytes move: nothing runs on load, on save or in `repairShow`, and `KEYS`, `canonicalShow` and `usesV2` do not
  change. The lab applies no default.
- **Pixels.** `lab/layers/lines.js` only gains statements that new `listen` strings reach (its one removed line is a header
  comment), and no runtime or widget file is touched, so `npm run fidelity` is not run: the user said testing mustn't slow
  development. If either fact stops being true, run it.
- **Never all notes.** No path turns a note-type layer into one that hears every note. `heard` is the type, with no notes.
- **Stay mergeable.** `claude/note-picker` is being built beside this. Do not edit the `isListen` line that tests `LINES`, the
  `validateLayer` message, the `listenNotes` line in `WaLayers`, the `Listen` doc comments or the import lines the picker edits. The
  patches already avoid them.
- **Known failure, not ours.** `tests/show-v2.test.ts > vivaldi-summer.json saves as its version…` fails at `49469b3`, before this
  work: that show was committed by hand, not in canonical form. Leave it, and report it.
- **Commits.** `git add` explicit paths. Messages as below, then a blank line and
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit audio, `songs/`, `renders/`, `notes*.js`, `.superpowers`.
  Never push or merge unless told to.
- **Testing.** Unit tests only; no end-to-end suite.

## Review Focus

1. **The rules match what was measured.** The spec's table of attacks is the lengths of `noteTypeAttacks` on the six songs. To
   check, in Node with `loadLayers()`: Nocturne 218, 46, 24, 150, 392; Winter Wind 18, 496, 0, 26, 94; Beethoven 249, 135, 0, 49, 808 (chords, runs,
   trills, long, repeats). `songs/` is local, so this is by hand, not a test.
2. **Never all notes.** Follow a song with no trills from `listenNotes` to `runtime.load`: `heard` is `'trills'`, so it is routed
   with empty notes and chords, and no widget indexes `NOTES[0]` or `CHORDS[0]` unguarded (`grep -n "NOTES\[0\]\|CHORDS\[0\]" lab/tools/*.js`).
3. **Byte stability.** `npm run check-show` is clean on all six shows and `git diff --stat -- shows lab/ratings.json` is empty.
   `compose.ts` is untouched.
4. **40 ms.** `groupChords` in `lab/layers/lines.js` and `src/widgets/chords.ts` are untouched, and `tests/note-types.test.ts` pins that
   a run note 20 ms after an unrelated chord is its own attack on the layer and part of the chord for everyone else.
5. **The defaults are reasoned, not seen.** The spec says so and asks the user to look. If you have a browser on a free port, look
   at stella on Beethoven, martin on the Nocturne, pixelsort over any base on the Prelude, flee on Winter Wind. Queued passes run
   outside the instance's swap for a routed listen (`0193aa2` fixes that for picks only, on purpose: "a routed listen such as @melody
   keeps what the lab draws"). Checked for the two defaults that queue: stella's `post` reads only what `frame` and `onChord` captured;
   pixelsort's `chord` reads `x.feat.rate`, so its melt follows all the music's density, which is what it was tuned on. Both left as they are.
6. **Merges.** The patches merge with no conflict with `claude/note-picker` at `6ae36df` and `claude/widgets-round9` at `34357cc`.
   Re-run `git merge-tree --write-tree HEAD <branch>` after each task. Both are moving; a small hand may be needed, not a redesign.
7. **One wart on purpose.** `validateLayer`'s message for an unknown listen does not list the note types until the picker has landed.

## Task 1: Note types in the shared layer code and show validation

**Plan text complete enough to transcribe: yes.** Apply the patch and make the one edit it cannot hold; the text below is what it
holds.

**Files:**
- Modify: `lab/layers/lines.js`, `src/widgets/types.ts`, `src/widgets/tags.ts`, `src/widgets/layers.ts`, `src/studio/show/show.ts`,
  `scripts/check-show.ts`, `docs/COMPOSING-SHOWS.md` (a bullet before "A line"), and `scripts/render-show.mjs` by hand: that file is
  CRLF and the patch folder is LF.
- Create: `tests/note-types.test.ts`.

**Signatures:**

```ts
// src/widgets/types.ts
export type NoteType = 'chords' | 'runs' | 'trills' | 'long' | 'repeats';
// src/widgets/tags.ts
export const NOTE_TYPES: readonly NoteType[];                // that order
export const NOTE_TYPE_LABELS: Record<NoteType, string>;     // Big chords, Fast runs, Trills, Long ringing notes, Repeated notes
// src/widgets/layers.ts, WaLayers
NOTE_TYPES: readonly NoteType[];
noteTypeAttacks(song: SongNotes): Record<NoteType, number[]>;   // attack times per type
// src/studio/show/show.ts
export interface ShowContext { /* … */ noteTypes?: Partial<Record<NoteType, readonly number[]>> }   // undefined: no such warnings
```

`lab/layers/lines.js` gains, before `WA.lineNotes`: `bigChordIds`, `runIds`, `pitchIndex`, `trillIds`, `longIds`, `repeatIds`,
`NOTE_RULES`, `ruleNotes(notes, type)`, `noteTypeOfSong(song, type)` and `WA.noteTypeAttacks`; after `LINES`, `WA.NOTE_TYPES`; and after
the `LINES.indexOf` line in `listenNotes`:

```js
if (WA.NOTE_TYPES.indexOf(listen) >= 0) return { notes: noteTypeOfSong(song, listen), heard: listen };
```

`isListen` gains a new first statement. `missingPart` gains a first branch that returns
`this song has no ${label in lower case}: this layer stays still` when `c.noteTypes?.[t]?.length === 0`, and otherwise `null` for a
note type. `validateLayer` gains a statement before the region check that warns `this section has no ${label in lower case}: this layer
stays still here` when the song has attacks of the type and none in `[start, end)`.

**Tests,** in `tests/note-types.test.ts`, on synthetic notes:

- `the shared list`: `WA.NOTE_TYPES` equals `NOTE_TYPES`, equals `['chords', 'runs', 'trills', 'long', 'repeats']`; the labels have the same keys.
- `big chords`: 5 notes at once are taken, 4 are not; a fifth note at 39 ms counts, at 40 ms it does not.
- `fast runs`: 8 notes up by 2 at 100 ms are taken; 5 are not; at 250 ms apart they are not; an alternation and a figure that goes
  up and back are not; notes around a run are left out.
- `trills`: 60/62 × 8 at 100 ms is taken; 60/64 is not (a tremolo); at 200 ms apart it is not; a 4-note one alone is taken, with a
  neighbour 100 ms before it is not; with 6 notes of 65 among it (purity) it is not.
- `long, ringing notes`: 3 s among short notes is taken; 1.4 s is not; a neighbour 3 semitones away at 500 ms stops it, at 30 ms it
  does not; 40 notes from 1.6 to 2.38 s keep the longest 4.
- `repeated notes`: 4 strikes at 200 ms are taken; 2 are not; at 400 ms apart they are not; a 62 between strikes stops them.
- `listenNotes with a note type`: returns the input tuples in order; for a song with none, `{ notes: [], heard: t }` for every type,
  also with no notes at all; on an ensemble a violin trill lost in all the notes is found by track, and a flute's run; with one track
  of 40 notes or more the rule reads all notes; `repeats` always reads all notes; a run note 20 ms after a chord is one attack of 3
  notes in `groupChords(notes)`, its own attack `{ t: 1, lo: 60, hi: 60 }` in `groupChords` of the part, and the first is unchanged after.
- `noteTypeAttacks`: `{ chords: [0], runs: [], trills: [], long: [], repeats: [5, 5.25, 5.5, 5.75] }` on a chord and 4 strikes; all empty
  with no notes.
- `in a show`: `isListen` is true for each type, false for `grace`, `graces`, `tremolo`, `ornaments`; `listen: 'runs'` validates with no
  errors, its key is `flee@runs`, repair fixes nothing, the canonical form is version 2 and keeps it; with `noteTypes` the song warning is
  exactly as above at `sections[0].layers[0].listen` for an empty list, once, and the section warning for times all outside the section
  (an attack at the section's end is outside); no warning for one inside, when `noteTypes` is missing, with `{ tracks: [] }`, for a
  layer with no listen, or on a line; `addLayer` and `setLayer` take a type and `listen: null` clears it.

**Steps:**

- [ ] Apply: `git apply docs/superpowers/plans/2026-11-01-note-types/t1.patch` (add `--3way` if the branch has moved).
- [ ] With the Edit tool, which keeps the file's CRLF, in `scripts/render-show.mjs`: add `, noteTypes: loadLayers().noteTypeAttacks(pack)` after
  `tracks: Object.keys(pack.tracks ?? {})` in the `validateShow` call. `loadLayers` is already in scope there.
- [ ] `npx vitest run tests/note-types.test.ts tests/layers-lines.test.ts tests/check-show.test.ts` → all pass.
- [ ] `npm run typecheck` → clean. `npm run check-show` → all six shows ok.
- [ ] **Commit** those files by path: `Lab: big chords, fast runs, trills, long ringing notes and repeated notes join what a layer can listen to; a song with none of a kind hears nothing and says so`.

## Task 2: Widget defaults, placement and the UI

**Depends:** T1.

**Plan text complete enough to transcribe: yes.** Apply the patch; the text below is what it holds. The DOM wiring has no unit
test: it was driven once in a real studio at design time (Stella in a section of Beethoven: `hears repeated notes`; `♪` to all notes;
`Use them` back; `All notes instead`; undo; trills by hand gave `This song has no trills: the layer stays still.`; no page errors).

**Files:**
- Modify: `lab/tags.json` (four fields, nothing else), `src/widgets/types.ts`, `src/widgets/tags.ts`, `scripts/widget-docs.ts`,
  `docs/COMPOSING-SHOWS.md` (regenerated only), `src/studio/ui/layer-controls.ts`, `src/studio/ui/panel.ts`,
  `src/studio/ui/widget-picker.ts`, `lab/layer-ui.js`, `tests/tags.test.ts`, `tests/layer-controls.test.ts`, `tests/lab-layer-ui.test.ts`.
- Delete: `docs/superpowers/plans/2026-11-01-note-types/`.
- Not touched: `src/studio/show/edit.ts`, `src/studio/compose/compose.ts`, `lab/index.html`.

**The defaults,** `lab/tags.json`: `flee` runs, `martin` long, `pixelsort` chords, `stella` repeats. Reasons per widget: the spec's table.

**Signatures:**

```ts
// src/widgets/types.ts
export interface WidgetTags { feel: string[]; instruments: string[]; role: Role; noteType?: NoteType }
// src/studio/ui/layer-controls.ts
export function attacksIn(L: WaLayers, pack: Pick<SongPack, 'notes' | 'tracks'>, listen: Listen, s: Span): number;
export const neededAttacks: (s: Span) => number;   // max(3, ceil(seconds / 10))
export function placedListen(L: WaLayers, pack: Pick<SongPack, 'notes' | 'tracks'>, s: Span, usual: NoteType | undefined): NoteType | undefined;
export interface UsualLine { text: string; action: 'all' | 'use' | null }
export function usualLine(usual: NoteType, listen: Listen | undefined, attacks: number, need: number): UsualLine;
// LayerControlsDeps gains
usual?: NoteType;
```

- `validateTags`: an unknown `noteType` is the error `flee: noteType 'grace' is not one of chords, runs, trills, long, repeats`.
- `listenOptions` (studio and lab): a group `Kinds of note` after `From the notes`. `listenLabel` names a type.
- `layer-controls.ts`: a line `.lc-usual` under `.lc-note`, with a button `[data-usual]`; the select's handler becomes `hear(want)`, which
  the button shares; `drawUsual` recomputes only when the listen or the span changes; `drawSpark` says
  `This song has no trills: the layer stays still.` and marks a note type's silence as a warning.
- `panel.ts`: `usualOf(meta, id)`; in `pick`, `placedListen(...)` goes into the `addLayer` edit; a `[data-hear-all]` `♪` in `.layer-tools`,
  hidden unless the layer is on its usual type, kept in step by `syncSection`; `usual` passed to `mountLayerControls`.
- `widget-picker.ts`: `usually hears repeated notes` in the tags row.
- `lab/layer-ui.js`: `NOTE_TYPES`, its labels, the group, `listenLabel`, the card's `This song has no trills: it stays still.`, and `NOTE_TYPES` in
  `WA_LAYER_UI`.
- `widget-docs.ts`: ` · Note type: runs` on the tag line, and a sentence saying what it is in the block's legend.

**Tests:**

- `tests/tags.test.ts`, `note types in lab/tags.json`: flee runs, martin long, pixelsort chords, stella repeats; brush and kline have none;
  every `noteType` present is in `NOTE_TYPES` (so a later widget can add one with no test to edit); `grace` gives the error above; `runs`
  gives none.
- `tests/layer-controls.test.ts`:
  - `listenOptions`: values end `...LINES, ...NOTE_TYPES` in all three existing cases; the last five are in `Kinds of note` with the five labels.
  - `names a note type in words`: `listenLabel('long')` `Long ringing notes`; `partWords('runs')` `fast runs`. (Imported as `labelOf`, on a
    line of its own: the picker's branch adds `listenLabel` to the existing import line.)
  - `neededAttacks`: 9 s → 3; 30 s → 3; 31 s → 4; 60 s → 6.
  - `attacksIn`: 4 strikes from 5 s: 4 in 0..10; 2 in 5.3..10; 0 in 6..10; 0 for `runs`.
  - `placedListen`: the same strikes: `repeats` in 0..10; none in 0..60 (4 in a minute); none in 20..30; none for `trills`; none for `undefined`.
  - `usualLine`: on its type → `Hears fast runs, as this widget usually does.`, `all`; on all notes with enough → `This widget usually hears fast
    runs.`, `use`; on another part with 0 → the same; 2 of 3 → `This widget usually hears fast runs, but this section has only 2: it plays on all
    notes.`, `use`; 0 → `…but this section has none: it plays on all notes.`, `null`.
- `tests/lab-layer-ui.test.ts`: `U.NOTE_TYPES` equals `NOTE_TYPES`; labels match the studio's; a song with no pack lists `...LINES, ...NOTE_TYPES`.

**Steps:**

- [ ] Apply: `git apply docs/superpowers/plans/2026-11-01-note-types/t2.patch` (add `--3way` if the branch has moved).
- [ ] `npm run widget-docs`, then `npm run widget-docs -- --check` → up to date. Only the legend and four tag lines move in the generated block.
- [ ] `npm run typecheck` → clean.
- [ ] `npx vitest run` → all pass but the known `vivaldi-summer.json` failure.
- [ ] `npm run check-show` → all six ok. `git diff --stat -- shows lab/ratings.json` → empty.
- [ ] Update `lab/TODO.md`: the section says built, and which types and defaults shipped.
- [ ] `git rm -r docs/superpowers/plans/2026-11-01-note-types`.
- [ ] **Commit** those files by path: `Studio: a widget's usual note type: lab/tags.json names it, placing the widget chooses it if the section has enough, and one click changes it`.
