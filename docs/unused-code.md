# Old-code dependency audit

**Historical snapshot:** main subsequently removed the old app in `a687e99`. The dependencies and file citations below describe `515b110`, before that removal; they are not current removal instructions. Main now keeps the analysis contracts in `src/audio/types.ts`. This integration preserves those deletions.

2026-11-03. Audited tracked source at `515b110175b947250d2f0e6dcbc23c1ede188d59`.
This report changes no application code and deletes nothing.

None of the four targets is wholly unreferenced. The older app is still linked and built; the two test pages still
serve developer tools; the stage implementation still runs the older app. Parts of its type contract also support the
current studio's analysis pipeline. Whether anyone recently opened these pages or ran the optional tools is unknown.

## Pages: product routes and developer entrypoints

| Target | Current dependency | Build status | Removal consequence |
|---|---|---|---|
| `legacy.html` | Current studio links at `src/studio/ui/library.ts:79` and `src/studio/ui/main.ts:127`. Its entry is `src/main.ts` (`legacy.html:200`). | Explicit production HTML input at `vite.config.ts:17`. | Breaks the current “Old app: microphone, MIDI” links, the older app, and the checks/previews listed below. Keep unless that product route is deliberately retired. |
| `stage-test.html` | Loads `src/stage/harness.ts` at line 16; `scripts/stage-shots.mjs:52` opens it and uses its hooks. | Absent from the production HTML inputs. Its TypeScript harness is still typechecked. | Removes synthetic stage screenshots, regression cases and the stage benchmark. It is a developer-only entrypoint, not unreferenced code. |
| `living-test.html` | Loads `src/visual/living/harness.ts` at line 16; `scripts/living-shots.mjs:50` and `:72` open it. | Absent from the production HTML inputs. Its TypeScript harness is still typechecked. | Removes Living Canvas screenshots, replay and benchmark tools. Removing this harness does not make the underlying renderer unused. |

The current studio and render page have separate entries: `index.html:15` loads `src/studio/ui/main.ts`, and
`render.html:15` loads `src/studio/render-page.ts`. Their static runtime import closures reach no `src/stage/` module.
The current picture is made with `WidgetRuntime` (`src/studio/ui/main.ts:20`, `src/studio/render-page.ts:24`).
The word “stage” in a studio DOM class or ingest progress label is not a dependency on the older stage renderer.

Executable consumers of the pages:

| Consumer | Page dependency and role | How it is invoked |
|---|---|---|
| `scripts/screenshots.mjs:42` | `legacy.html`: older interface/visual screenshots. | `npm run shots` (`package.json:13`). |
| `scripts/preview-script.mjs:94` | `legacy.html`: previews older corpus scripts; directly imports the stage validator/player at lines 100–101. | `npm run preview-script` (`package.json:17`). |
| `scripts/studio-check.mjs:346` | `legacy.html`: checks its welcome screen and page errors at line 349. | `npm run studio-check` (`package.json:26`). |
| `scripts/e2e-check.mjs:76` | `legacy.html`: older-app integration checks; stage imports at lines 163–164 and 190. | Direct Node command, documented at `README.md:343`; no package alias. |
| `scripts/stage-shots.mjs:52` | `stage-test.html`: synthetic stage cases; also imports the melody element directly at line 106. | Direct Node command, usage at line 5; no package alias. |
| `scripts/living-shots.mjs:50` | `living-test.html`: screenshot/replay cases and the benchmark page at line 72. | Direct Node command, usage at line 5; no package alias. |

The HTML pages are the only source entrypoints found for their respective harness modules. Their automation hooks are
at `src/stage/harness.ts:351` and `src/visual/living/harness.ts:343`. No current studio navigation to either test page
was found. The source still provides these tools; this does not establish how often they are run.

## `src/stage/`: all 28 files still have consumers

The runtime import closure from `src/main.ts` reaches 26 of the 28 tracked TypeScript files. The other two are
`harness.ts` and `cast-doc.ts`, which have developer/CLI/test consumers. This is module reachability: registration does
not mean every element is instantiated in every scene.

The following inventory uses paths relative to `src/stage/`:

| Files | Role and concrete incoming dependency |
|---|---|
| `clock.ts`, `feed.ts` | Older-app music time and note feed; value imports at `src/main.ts:35` and `:38`. |
| `corpus.ts`, `script.ts`, `player.ts` | Corpus lookup, validation and scripted playback; `src/main.ts:36`, `:42`, `:41`. Corpus JSON/data loaders remain active through `src/stage/corpus.ts:81`. |
| `director.ts`, `library.ts`, `overrides.ts` | Older live director, scenes and user overrides; `src/main.ts:37`, `:39`, `:40`. The older panel also imports the scene library at `src/ui/panel.ts:9`. |
| `stage.ts`, `gl.ts`, `post.ts`, `cut.ts`, `kit.ts` | Compositor, graphics helpers, postprocessing, cuts and feature/knob support. `src/main.ts:43` imports the compositor; `src/stage/stage.ts:12` through `:16` import these supporting modules. |
| `elements/index.ts`, `elements/all.ts` | Runtime registry, imported by `src/stage/stage.ts:13` and `src/stage/script.ts:9`. The index eagerly imports `all.ts` at `src/stage/elements/index.ts:10`. |
| `elements/bass.ts`, `elements/bloom.ts`, `elements/drip.ts`, `elements/fluid.ts`, `elements/melody.ts`, `elements/pulse.ts`, `elements/slash.ts`, `elements/sparks.ts`, `elements/squares.ts`, `elements/wave.ts` | All ten elements are value-reexported by `src/stage/elements/all.ts:5` through `:14`, so none is a stranded module. |
| `types.ts` | Stage contracts and runtime defaults, imported at `src/main.ts:44`; also shared analysis types as described below. |
| `harness.ts` | Developer-only entry from `stage-test.html:16`; constructs `Stage` at `src/stage/harness.ts:330`. |
| `cast-doc.ts` | CLI/test-only document generator: `scripts/cast-table.ts:13` and `tests/cast-doc.test.ts:2`. `npm run cast` remains at `package.json:15` and writes/checks `docs/CAST.md` (`scripts/cast-table.ts:15`). |

This is executable older-app functionality: `src/main.ts:184` constructs `Stage`, `:199` constructs the live director,
`:247` constructs a script player, and `:789` renders the stage. It is not merely a collection of historical imports.

Other stage consumers survive removal of a test HTML page:

- `scripts/check-script.ts:13` imports the validator for `npm run check-script` (`package.json:14`).
- `scripts/sync-check.mjs:85` and `:86` directly import `Stage` and `ScriptPlayer` into their own `/__sync` page
  (`scripts/sync-check.mjs:52` through `:80`); they do not use `stage-test.html`.
- Fifteen test files directly import stage modules or types: `tests/cast-doc.test.ts`, `tests/character.test.ts`,
  `tests/clock.test.ts`, `tests/cut.test.ts`, `tests/director.test.ts`, `tests/drives.test.ts`, `tests/feed.test.ts`,
  `tests/knobs.test.ts`, `tests/overrides.test.ts`, `tests/player.test.ts`, `tests/registry.test.ts`,
  `tests/script.test.ts`, `tests/slash.test.ts`, `tests/squares.test.ts`, `tests/stage.test.ts`.
  `tests/character.test.ts:10` is a type-only stage import; the other fourteen have value imports.

### Shared types are a current-studio dependency

The current studio uses `src/audio/song-analysis.ts`, both through the browser analysis worker
(`src/studio/ingest/analyze.worker.ts:6`) and the pack validator's `loudnessLength` import
(`src/studio/pack/pack.ts:5`). The ingest CLI imports the same analysis at `scripts/ingest.ts:45`.

That analysis imports `MelodyNote` and `SongData` from `src/stage/types.ts` with `import type`
(`src/audio/song-analysis.ts:7`). Its audio dependencies also import stage contracts: `src/audio/melody.ts:14`
uses `MelodyFrame`/`MelodyNote`, and `src/audio/structure.ts:14` uses `Drop`/`Section`/`StructureRow`.
These are erased from browser JavaScript, but deleting their source breaks TypeScript checking.
Other type-only consumers include `src/audio/engine.ts:18`, `src/character/character.ts:50`,
`scripts/character-file.ts:26`, `scripts/study.ts:24` and `tests/character.test.ts:10`.

Keeping only `src/stage/types.ts` while deleting the rest is insufficient: that file itself references the graphics
types at line 8, kit types at line 9, and registry `ElementType` at line 67. A future stage retirement must first
extract the shared analysis contracts and update their imports.

The Living Canvas implementation is likewise shared with the older stage: `src/stage/elements/fluid.ts:12` imports
`LivingCanvas` and constructs it at line 39; `src/stage/gl.ts:12` through `:20` reuse Living graphics/emission helpers;
`src/stage/post.ts:18` reuses its bloom shaders. The optional `living-test.html` harness is not the only consumer of
`src/visual/living/`.

## What could be removed, if Maxim chooses to retire it

No target in this audit is ready for unconditional deletion. These are separate, conditional removal units:

1. **Stage developer harness:** `stage-test.html`, `src/stage/harness.ts`, `scripts/stage-shots.mjs` can be retired
   together if their synthetic visual checks and benchmark are no longer wanted. Remove/update current tool
   instructions such as `docs/COMPOSING.md:157`. Keep the stage runtime and its other consumers.
2. **Living developer harness:** `living-test.html`, `src/visual/living/harness.ts`, `scripts/living-shots.mjs` can be
   retired together if their visual/replay/benchmark coverage is no longer wanted. Keep the Living implementation
   and the helpers/shaders reused by the stage.
3. **Older product route:** retiring `legacy.html` requires removing its two current UI links and its Vite build
   input, and retiring or adapting the four legacy-page consumers listed above. Then audit `src/main.ts` and its
   dependencies individually; many audio/visual modules have other consumers. This report does not classify that
   whole dependency tree as deletable.
4. **Whole stage implementation:** only after the older route, direct stage tools, cast generator and associated
   tests are retired or migrated, and shared analysis types are extracted. Retiring either test page alone does
   not meet these conditions. Corpus/study data and generated documentation need their own consumer review.

Historical notes and plans are evidence of past design, not proof of current use. For example, `docs/HANDOFF.md:359`
describes the older stage, while `docs/COMPOSING.md:3` explicitly scopes its handbook to older stage scripts. This
audit leaves those documents and their history unchanged.

## What was checked, and what remains unknown

Checked tracked HTML entrypoints, Vite/TypeScript/package/CI configuration, static value-versus-type import closures,
dynamic stage imports, corpus globs, script URLs, unit-test imports and documentation references. No browser was
opened, no application code/data was changed, and no application/browser runtime or visual test was run for this
static report. Separate repository validation passed: both TypeScript configurations, Vitest (88 files, 1,324 tests),
`npm run check-show`, and `npm run widget-docs -- --check`.

`tsconfig.json:15` includes all `src` and `tests`; `noEmit` at line 11 means typechecking a harness is not evidence that
its HTML is shipped. The configured Pages workflow runs Vitest and the build (`.github/workflows/pages.yml:27` and
`:28`) and uploads `dist` at line 31. It does not invoke the optional browser/screenshot scripts. This establishes
configured coverage and deployment inclusion, not that a recent workflow succeeded.

There are no access logs, telemetry, coverage measurements or inventory of external bookmarks/scripts in this audit.
It cannot judge actual human usage, whether optional tools are still valuable, or whether individual exports inside
reachable modules are dead. Maxim decides whether to remove those supported older features and developer tools.
