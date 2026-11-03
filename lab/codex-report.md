# Codex report — 3 November 2026

Maxim inspected all twelve widgets and accepted **Johansson only**. The other eleven are rejected and are not included in this integration. Tasks 1–4 are included; Task 5 remains skipped. All work stays in the isolated Codex worktree.

This integration starts at main's `a687e99` and preserves the old-app removal, Tree, clip curves, and TimeSlice's removed presence slider. Johansson's two strict foot-placement test failures remain recorded and unchanged. The measurements below include the earlier rejected experiments as a historical record, not a claim that their look is adequate.

No ratings, audio, transcriptions, shows, melodies, or shared widget/layer implementation code are changed by this integration. Current's exact caches are the only existing-widget implementation change.

## Commit and branch inventory

All twelve original commits were pushed in recipe order to `codex/new-widgets`, which retains the rejected preview for reference. Only Johansson is selected for main.

| Order | Widget | Commit | Integration status |
|---|---|---|---|
| 1 | Stress | `d411b1e` | Rejected; not merged |
| 2 | Crackle | `d9db5da` | Rejected; not merged |
| 3 | Seep | `e4b6b8f` | Rejected; not merged |
| 4 | Lamps | `94e88d6` | Rejected; not merged |
| 5 | Tacet | `49f16bd` | Rejected; not merged |
| 6 | Varini | `4d0c2e3` | Rejected; not merged |
| 7 | Statues | `744aaed` | Rejected; not merged |
| 8 | After You | `2db763d` | Rejected; not merged |
| 9 | Marey | `384b3f9` | Rejected; not merged |
| 10 | Planish | `7b81afc` | Rejected; not merged |
| 11 | Fauxpas | `c9ee168` | Rejected; not merged |
| 12 | Johansson | `10fefeb` | Selected for main; known foot-test failures retained |

Tasks 1–4 were each completed and pushed on an independent branch before the user authorized integration.

| Task | Branch | Commit | Output and status |
|---|---|---|---|
| 1 — health check | `codex/widgets-check` | `cbd47e4` | `npm run widgets-check`, [baseline table](widgets-check.md); merged locally |
| 2 — speed table | `codex/widgets-speed` | `df85230` | `npm run widgets-speed`, [measurements and follow-up](speed.md); merged locally |
| 3 — old code report | `codex/unused-code` | `cfd8bd0` | [Dependency and removal report](../docs/unused-code.md); merged locally; nothing deleted |
| 4 — timeline docs | `codex/timeline-docs` | `2c313ac` | Three documentation corrections; merged locally |
| 5 — background colours | — | — | Skipped; waits for Maxim's instruction |

## Checks and local outputs

The five required checks are TypeScript for the app, TypeScript for scripts, Vitest, `check-show`, and generated widget docs. Counts in the widget sections below record the checks at each stage; they are not claims that every recipe condition passed.

Initial sandboxed checks failed because localhost connections were denied (`connect EACCES` in 26 ears tests). Rerunning with local networking allowed passed all 89 files and 1,329 tests at that stage. Initial rendering attempts also failed on blocked localhost; the isolated server and renderers subsequently ran successfully with local networking allowed. Browser verification stubs the ratings server on port 5174 and uses the isolated server on port 5200.

Demo videos for all twelve widgets remain local in `lab/demos/`, including Johansson's demo. Primary inspection PNGs and gate recordings remain in `lab/showcase/`. Raw paired images, helper scripts and supplementary measurements are preserved under `renders/codex-session/`, including `renders/codex-session/lab/showcase/codex-speed-clean-before/` and `codex-speed-clean-after/`. Videos and inspection images are not committed. Thumbnails were committed with their respective widget changes. The rejected widgets and their local demos remain available on the earlier preview branch; their sources are excluded from this integration. The port 5200 server will remain available for the user, as explicitly requested later; that request supersedes the handoff's shutdown instruction.

## Task 6 — implementation checks, in recipe order

The first eleven widgets below were rejected after visual inspection. Their implementation notes are historical. Johansson is the only selected widget.

### 1. Stress

Implemented the specified spectral shader, pure note-force evaluation, analyser and payoff arcs. Added registry, tags, demo plan, thumbnail and generated docs. Required checks passed. Five pure tests cover exact black, required RGB samples, fade/lighten stability and time evaluation. Actual notes select nine Prelude payoffs, including 144.911 s, and twenty Beethoven payoffs, including 79.216 s. Synthetic six-note/two-note coverage for `N >= 1` is 71.6%/52.4%, near the recipe's 73%/53%.

The demo covers Prelude 140–148 s. Inspected Prelude frames at 144.8, 145.0 and 145.1 s: leaning edge rings, coloured bands, black saddles and a changed picture at release are visible, with no render, page or load errors. The 144.8 s frame does **not** have a continuous black middle band, and large rings still fill most of the frame after release. Nocturne frames at 5, 10, 20 and 30 s have the specified leaning contacts but look larger than the requested small domes. Recipe constants were retained.

The spectral PNG strip was rendered and inspected. It has no pure white; high orders wash to the specified warm grey. Full silence, the Rach area ratio, exact live/seek screen equality and all songs' aesthetic conditions remain unjudged.

### 2. Crackle

Implemented the specified cell partition, separate tone and line canvases, attack flashes and long-line ripening. All five required checks passed, including 1,329 tests. Demo and thumbnail were generated. Inspected Nocturne at 3.8, 10, 295 and 363 s, plus Winter Wind at 116–116.4 s: lines terminate at older boundaries, the dense pitch band leaves large cells at the top and bottom, and attack flashes change cells. No render, page or load errors occurred.

A pure geometry probe preserves total area and gives identical live/seek Beethoven partitions. Counts are 15 lines at Nocturne 10 s, versus the recipe's “about 10”, and 841 at its end; Rach has 1,004 and Beethoven 720. Presence 0 yields 206, 240 and 205 respectively. No constants changed. Every possible line intersection, a full eight-second ripening through silence, and overlay visibility at presence 0 were not verified by eye.

### 3. Seep

Implemented future rings, exact-time flattening, hashed held-note stacks and a wrapped persistent strip. All five required checks passed, including 1,329 tests. Demo and thumbnail were generated. Inspected Prelude at 0.5, 1 and 10 s, Nocturne at 150, 151 and 153 s, and Rach at 620 s, with no render, page or load errors. Pale rings sit below the line and stacks of irregular widths climb above it; the late Rach frame remains separable.

Loud/quiet widths, attack widths, ring sizes and rise times match the recipe arithmetic: `F(10) = 729.204` at `A = 8`, and the note at `t = 5` maps to `y = 217.793`. Fractional wrap was audited, and immediate rebuilding was fixed when a seek resets the knob-throttle clock. Audiovisual contact was not judged by listening, live/seek pictures were not exhaustively compared, and the requested 15–35% area was not measured. Some repeated-note columns look quite regular despite the required hashed widths.

### 4. Lamps

Implemented the three additive lamp layers, black shadow sprites and threads, register ranks, discord separation, damped motion and 0.34 s brightness gate. All five required checks passed, including 1,329 tests. Demo and thumbnail were generated. Pure assertions give blocked-lamp colours `#1AEAFF`, `#FF30FF` and `#FFDE22`, and default wall RGB 210/188/216. A probe with 100 attacks per second gives full jumps only at 0, 0.34 and 0.68 s; `onChord` makes no random calls.

Inspected Nocturne at 5, 8 and 20 s, Rite at 165 and 165.4 s, and Beethoven at 419.1 s, two seconds after its last note. The red opening pool, split coloured shadows on pale light, and final black are visible, with no render, page or load errors. The Rach slab's three-second swing was not judged through motion playback.

Recipe conflict: explicit frame step 2 returns before physics when all lamps are dark, while the prose says swings continue unseen. The implementation follows step 2.

### 5. Tacet

Built snapped posture first and inspected Winter at 210 s before adding motion. Original heights and breathing passed the visual gate; no fallback was used. Target groups match 38 lying, five slouched and twenty absent. Transition angles produce 34 actually lying, seven slouched and two upright. Then added the specified springs, attacks, arrivals/departures, looks and presence. All five required checks passed, including 1,329 tests. Demo and thumbnail were generated.

Full frames at Winter 210/210.2 s, Winter Wind 60/60.1 s and Beethoven 146 s at presence 0 render without errors. Sleepers, active warm rectangles and a reduced cast at low presence are visible.

Pure 60 fps runs give near-note `|theta| <= 0.02872`, below 0.08, and a maximum seek-plus-four-seconds difference of 0.05857, below 0.12. Rite gives 15.09 jolts/minute and Winter Wind 11.77. Dense bins are 0%, 6.19% and 8.8% on Winter, Rite and Wind.

The literal algorithm fails two written attack checks. Same-frame decay makes an ordinary flash 0.9116 rather than at least 1; already-airborne keys land on 31/3,196, 47/4,557 and 21/3,305 attacks. The explicit algorithm was retained. The tremble formula `Ws >= 5` also differs from the trap prose limiting long tremble to `W >= J`. The five-seat neighbour turn was not judged through motion, nor were all entry/departure percentages judged by eye.

### 6. Varini

Implemented deterministic room cuts, selected targets, an exact-time viewpoint path, two figure canvases, hairlines and kicks. All five required checks passed, including 1,329 tests. Demo and thumbnail were generated. Selected Rach times 5.1776, 7.647, 10.4139 and 12.9943 s, and Beethoven times 0.9925, 3.8485 and 12.8978 s, match the named clicks. At Beethoven 10 s, `f = 0.2363`. The room has 28 pieces and preserves area. Across Rach, Beethoven and Winter Wind, 12,068 dwell samples make zero clip calls. Wind's minimum target gap of 1.3972 s meets 1.38 s.

Inspected Rach at 12.99, 13.1, 15.5 and 15.55 s, and Beethoven at 0, 0.9925, 3.36, 3.8485 and 10 s. The whole band, broken paint and seam-free dwell are visible, with no render, page or load errors. Natural Rach at 15.5 s has `f = 0.9777`, so a separate browser-only forced `f = 0.3` still was rendered as requested. It reads as one displaced figure with most paint on screen. Travel and room factors were retained. The exact visible-paint percentage and every motion transition remain unjudged.

The explicit spring-after-draw step makes an ordinary velocity kick first visible one frame after its attack, contrary to the attack-frame prose. The written order was retained.

### 7. Statues

Implemented future freeze/fall tables, ranked steps, corner pivots, slab and floor light, and bolt retreat. All five required checks passed, including 1,329 tests. Demo and thumbnail were regenerated after fixing ordinary pose updates overwriting bolt retreat. Inspected Beethoven at 0, 1.1, 1.6, 2, 10, 80 and 160 s, Summer at 20, 40 and 60 s, and Winter Wind at 60 s. Dark and slab-lit states, corner tilts and floor shadows are visible, with no render, page or load errors.

Frozen non-victim x positions stayed fixed across more than 265,400 shape checks; `dt = 0` holds state exactly. Winter Wind has 34 freezes over 249.73 s, about 8.17 turns/minute.

Literal recipe shortfall: reset at 30 Hz and live playback at 30 Hz reconstruct within `6.8e-13` px. Live 60 Hz versus reset 30 Hz differs at 160 s by 60.90 px on Beethoven, 15.67 px on Summer and 154.43 px on Winter Wind. Beethoven's victim angle differs by 0.559 rad at 80 s. The explicit caller `dt` and 1/30 s replay were retained.

At six notes per second, the supplied arithmetic yields base 38.04, loud step 54.77 px and quiet step 21.30 px, rather than 36/52/20. Default presence 0 gives four shapes rather than the hinted three. Fall recovery starts after reaching horizontal; the initial corner sign alternates by index, which the recipe leaves unspecified. Whole passages were not watched to count every topple visually.

### 8. After You

Implemented pure score-derived scenes, lane reservations, melody dodges, false starts, release crossings and stairs. All five required checks passed, including 1,329 tests. Demo and thumbnail were generated. Beethoven frames at 0, 0.9925, 3, 4.2, 10, 10.1 and 13 s have no render, page or load errors. Approach, meeting, release and stairs-only silence are visible. The first meeting is at 0.9925 s, the two dodges at 3.3555 and 3.8485 s, release at 4.1485 s, and the next pair enters at 10.0978 s.

Across 67,999 pre-release samples on Beethoven, Wind and Rite, the edge gap is at least 40 px and never shrinks. There are zero lane or adjacent-lane occupancy conflicts.

Recorded CUT interpretation: the first chord is the meeting; scanning begins at `a + 1` with `n = 0, lastDodge = T`, and retrocut restarts at `b + 1`. Rank uses all chord highs, rate is the trailing one second, and melody delta is measured from the previous dodge. Beethoven has 77 candidate phrases (11.077/minute), 74 placed pairs (10.645/minute), a median of seven dodges, and 3.90% skipped. Wind's 13.56% and Rach's 14.20% skipped exceed 10% if that done-when limit applies to every song rather than Beethoven alone. Constants were unchanged, and no dodge caps were added. Full-song motion and aesthetic effect remain unjudged.

### 9. Marey

Implemented cached 60 Hz gait, attack exposures, note-selected limbs, distal sails, batched strokes and flash. All five required checks passed: 90 files and 1,333 tests. Four new pure tests cover grounded gait, floor contact, exposure replay and actual `MOMENTS` arrays. Demo and thumbnail were generated.

Actual-note probes give 51,004 grounded records with no backwards movement and exact floor contact. R0/R1 speeds of 89.15/372.03 px/s match approximately 90/370. Exposure counts match: Wind has seven at 10 s, 152 at 60 s and 143 at 90 s; Rite has 107 at 174 s; Nocturne has 35 at 66 s. Repeated reset is identical. Pose lookup uses the nearest cached 1/60 s record, and sails extend only to reached samples.

Inspected Wind at 10 and 60 s, Rite at 174 s and Nocturne at 66 s. Sparse early strokes, dense fans, a leap arc and quiet sparse exposures are visible. Additional Wind captures at 0, 5, 90 and 206 s are error-free, with no widget, page or load errors.

CPU time inside the widget frame at Wind 206–209 s with `life = 24` was mean 0.325 ms, p95 0.400 ms and maximum 5.4 ms over 180 frames, excluding replay and the harness. Sustained cost was below 4 ms, so the cap remains 240. The requested twenty seconds of motion and five consecutive attack flashes were not watched. `FLASH` remains 0.5; no conditional aesthetic change was made. Exact lit-area percentages were not measured.

### 10. Planish

Built and stopped at each requested gate: A stamps/lobes, B flash, C ring and D torch. Inspected A at Nocturne 0/10/363 s, B at exact attacks and 70 ms later, C at loud Wind 116/206 s, then D through Beethoven pauses and final facets. Four pure tests cover the required R/s examples, radial stamp budget below 25,000, min-only contact/hardening and the soft normal peak. All five required checks passed: 91 files and 1,337 tests. Demo and thumbnail were generated.

Full captures include Beethoven at 4.5, 6, 8 and 10 s, quiet Lil Wayne at 15.7952/15.8652 s, Wind at 116/116.05/116.1 s, and Nocturne at 362.5 s. All have no widget, page or load errors. Moving red torch patches, coloured oxide and quiet glints are visible. Early isolated dents look round and glossy despite the exact lobe formula; no aesthetic rewrite was made.

Only recipe-authorized adjustments were made. Ring defaults to 0.6 after a regular wave/lattice was visible at Wind 116 s. Light was bounded to `a = 2.2 + 0.25 * sin(0.05 * t)` after full-state quarter-turn counts above luminance 0.25 were 132,858/170,985, differing by 28.6976% relative to baseline. At Rite's actual final time of 270.328 s, 12.314% has luminance above 0.5 and 41.697% below 0.04, passing the 45%/25% limits. Soft remains 0.2.

Permanent `h/n/hard/oh` fields match bit for bit between live playback and replay at Beethoven 3.3, 9 and 13 s. First-pause oxide 0.13449 matches about 0.13. Replay explicitly clears flashes and rings, so the full picture differs during active transients: at 13 s live playback has six strikes and four rings, while replay has zero of each. Fractional hammer centres sample the nearest grid cell. The mandatory 0.006 base is visually near-black rather than exactly zero.

CPU/seek cost and every named motion condition were not measured or judged. The inspection helper was corrected to avoid a redundant zero-time draw before exact B captures, which were then regenerated.

### 11. Fauxpas

Implemented duration-weighted key bins and hysteresis, seven line/five side slots, future barges, delayed dips, blush/hunch and hesitant exits. Fixed repeated foreign notes teleporting an already-exiting outsider back to its mark, and restored eligible entries cancelled by key changes. All five required checks passed, including 1,337 tests. Demo and thumbnail were regenerated after the final fixes.

Pure 60 fps probes give 309 landings with zero error to reserved base marks, exactly seven line members, and at most three/five/five outsiders on Spring/Wind/Rite. Mark spacing is at least 80 px, and `keyAt` is identical after reset.

Inspected Spring at 7.65/7.8 s, Wind at 110 s and Rite at 20 s: the line, approach/front placement, colour changes and crowds are visible. Additional frames at Spring 20/30/7.64 s, Wind 115 s and Rite 10 s all report no widget, page or load errors. Spring's barge at `T = 7.650` starts at 7.200 s and lands at `x = 377.472654`, base `y = 640`. The separate 18 px lift draws its bottom at `y = 622` on attack. Thus the exact-mark check concerns the base position, not the lifted silhouette.

Whole one-second bins use `floor(win)`; the first bin takes the maximum before hysteresis. Stateful reset returns pitch classes to slots and skips past barges as written; only `keyAt` seek equality is claimed. The complete motion sequence and every unison break were not judged by eye.

### 12. Johansson — accepted for main

Built the thirteen-dot gait first, recorded three seconds at 60 fps (180 frames) in local `johansson-gate.mp4`, and judged the pose sequence recognizably human before adding anything else. Original Catmull tables were retained. Then built planned steps/phrases, style, stars, springs, foot bursts, lift and ghost-clearing discs.

The final eleven frames on Nocturne, Wind, Rach, Knights and Liebesleid render without widget, page or load errors. Standing Rach at 1 s looks concealed among the field. No confident visible-pose condition triggered the optional 0.85 alpha change. Continuous playback and human blind-perception tests remain unjudged. The demo was generated. The thumbnail command automatically shows it over Rorschach because it classified it as dark alone; that is a thumbnail caveat, not a source change.

On the full twelve-widget source snapshot, four required checks pass: both TypeScript checks, `check-show` with no shows, and widget docs. Vitest has one failed file and 91 passed files, with two failed tests and 1,339 passed tests. Required reproducible synthetic-chord tests use constant level/pitch 0.5, no jolts/lift, height 1.3, and 60 Hz plus exact strike frames. The failures are:

~~~text
AssertionError: step 1: expected 17.997089043261667 to be less than or equal to 1
AssertionError: step 1, frame 1, horizontal: expected 1.37806197287739 to be less than 1
~~~

Bounds with all thirteen dots on screen at height 1.3, and standing-position tests, pass. Fixed-style bisection error is at most 0.0594 px. Evolving run, stride and sadness after phase is solved at step start breaks the landing condition. Larger actual-note probes also fail; old airborne-ankle spring offsets can add error. No leg clamp, gait retune or weakened assertion was added. Standing positions hold across 255,651 Rach comparisons with changing features.

Recorded assumptions are time-aware periodic Catmull interpolation; 0.85 s pre-roll at the first strike and a half-cycle prior phase; mean loudness across a phrase's selected strikes; a phrase change when actual standing lasts at least 1.6 s; phase solved using target amplitude, current sadness and current filtered run at step start; default phases/styles on a cold seek; and star rest from the mean of twenty unit poses at `psi = 32`, without facing. Standing holds pose, lift and springs while flash/alpha decay. `maxStep` below 0.85 retains overlapping preparation as written. Nearest-sixteen foot-star selection uses positions before the current frame's shift, an unresolved small ordering ambiguity.

The widget was committed under Maxim's explicit recipe-failure fallback. Its source, tests and committed assets are available on `codex/new-widgets` at `10fefeb`; its demo and inspection assets remain local. Maxim accepted its appearance and explicitly selected it as the only widget to merge. Its two strict mechanical failures remain unchanged; passing the aggregate health and speed checks below does not override them.

## Task 1 — widget health check

Completed on `codex/widgets-check`, independently from `origin/claude/wizardly-franklin-ttaqyo`, and subsequently merged locally under the user's later authorization. Added `npm run widgets-check` and [the complete baseline table](widgets-check.md).

All 53 registered baseline widgets were checked on three songs at presence 0 and 1: 159 widget/song pairs, 318 variants, 400,998 simulation frames and 88,510 aggregate observations. Intervals are Lil Wayne 80–96 s, Prelude 118–134 s and Winter Wind 116–132 s, each after five seconds of warm-up. Simulation runs at 60 Hz; observations run at 12 Hz plus every attack frame. `--full` preserves optional whole-song mode. No aligned-picture comparisons were used, no audio played, and ratings requests were stubbed.

The official run correctly exits 1 for nine finding rows. TimeSlice's low presence makes no less by the proxies on all three songs; Fold and Kline have no how-present control on all three songs each. There are no thrown, load or queued errors and no sampled blank-run findings; the other 150 pairs have no findings. TimeSlice modifies a layer below it, so its standalone quantity proxy cannot settle its visual effect. Missing controls require a design choice. No existing-widget fix was made because none was an obvious one-line correction. Long accumulation, other passages and TimeSlice over another layer remain unjudged. All five repository checks passed on this task branch: 88 files and 1,324 tests.

Earlier partial 12 Hz/full-song diagnostics are local supplementary files, not the official table. The checker was corrected to preserve 60 Hz physics and fades, and its default scope was narrowed to representative passages because the handoff does not require whole recordings.

The follow-up [twelve-widget health table](widgets-check-new.md) is complete: twelve widgets on three songs, 36 pairs, 72 variants, 90,792 simulation frames and 20,040 observations, completed in 101.17 s. It reports no findings, JS/load/queued errors or blank flags. It uses the same 60 Hz simulation, observation schedule, passage lengths and presence settings.

That follow-up was measured on source `10fefeb`: it includes Johansson and excludes Tree. Together, the baseline and follow-up cover 65 distinct widgets, 195 pairs and 390 variants, with 491,790 simulation frames and 108,550 observations. Those two snapshots alone did not cover Tree, which is present on current main. They must not be described as a single complete run on the final combined preview.

The [focused ready-candidate health run](widgets-check-merged.md) at `c270c39` is now complete: Tree, the first eleven recipe widgets and Current, thirteen IDs on three songs at low/high presence. All 39 pairs and 78 variants completed with no findings, errors or blank flags: 98,358 simulation frames, 21,710 observations, elapsed time 120.887 s. This adds Tree coverage and checks the first eleven widgets and retained Current change together. Aggregate health does not certify appearance, strict foot mechanics or late-song state, and it does not clear Johansson's known unit failures.

## Task 2 — speed table

Completed on `codex/widgets-speed` from `origin/claude/wizardly-franklin-ttaqyo` at `515b110`, then merged locally. Origin advanced during the session with Tree only. All 54 registered widgets were measured without editing Tree. Added `npm run widgets-speed` and [the worst-first baseline and follow-up](speed.md).

All 324 rounds completed without errors: two busy songs, three fresh-page rounds each, two measured seconds per round at 60 Hz, and `max(5, demo warm)` seconds of warm-up. Timing measures `renderTo` CPU work and drawing-command submission; it does not measure asynchronous GPU completion or screen presentation.

Only Current's exact column-cosine and per-point paint-bin caches were retained. Controlled tests with five rounds of four seconds give Wind 2.228 → 1.758 ms/frame (21.09% less) and Rite 4.359 → 4.510 ms/frame (3.45% more). P95 improves from 2.9 → 2.5 ms and 4.5 → 3.5 ms respectively. This is a passage-dependent gain, not a universal speedup. Both songs' before/after frames were inspected and look the same. Eight fluid steps across thirteen arrays are byte-identical; 24 paint cases and 42,270 Canvas commands are identical. No parameter, colour, resolution, dynamics or drawing order changed.

The Contours cache was tried and produced numerically identical fields and drawing commands, but measured less than 1% gain and was reverted. Its ordered drawing/warp costs and Rorschach's blur/composite costs remain for Maxim; no aesthetic rewrite was made. A CPU-heavy probe overlapped the first focused Contours baseline, so both candidates' original-source timings were repeated in isolation before decisions. Whole-song accumulation and GPU/screen timing remain unjudged. All five final checks on the task branch passed: 88 files and 1,324 tests. Benchmark syntax and whitespace checks also passed, allowing the existing CRLF style.

The follow-up [twelve-widget speed table](speed-new.md) is complete: 72 rounds, no errors, elapsed time 51.117 s. It uses the same two busy passages, three fresh-page rounds per song, two measured seconds per round, and 60 Hz CPU/submission timing. Its source is also `10fefeb`, including Johansson and excluding Tree. Tree is covered by the 54-widget baseline. These remain machine-local measurements of CPU work and submission, not completed GPU work or an FPS guarantee.

## Task 3 — old code report

Completed on `codex/unused-code`, independently from `origin/claude/wizardly-franklin-ttaqyo`, and merged locally. Added [the dependency and removal report](../docs/unused-code.md). Nothing was deleted.

At the audited snapshot `515b110`, Legacy was still linked by the studio and explicitly built; both test pages had manual harness and screenshot consumers. Main subsequently removed them in `a687e99`. The report is now explicitly labelled historical, and no removed code is restored. All 28 stage files have consumers: 26 from the legacy runtime, one harness and one cast CLI/test generator. At that snapshot, studio/render used no old-stage runtime, but audio/ingest still needed stage type contracts referencing old modules. Main has since moved the contracts into `src/audio/types.ts` and removed the old folder.

Checked tracked entrypoints, static value/type import closures, dynamic imports, build/package/CI inputs, script URLs, tests and documentation. All 65 line citations resolve. No application/browser runtime or visual test was run for this static report. Actual human usage, external bookmarks, individual dead exports and deployed workflow status remain unknown. All five required repository checks passed on the branch: 88 files and 1,324 tests; `check-show` found no local shows. No code, data or history was changed by this task.

## Task 4 — docs after the timeline

Completed on `codex/timeline-docs`. The original branch corrected three documents. Current main has since deleted `docs/COMPOSING.md` with the old app, so that deletion is preserved. The new timeline entry in HANDOFF and the lab README are retained, with links pointing to the surviving show-format guide. Pre-existing dated history is preserved.

Searched the checkout, including hidden/ignored filenames, timeline merge `e779246` and its commits for a report or named unfinished converter. None was identified here. Commits `5539578` and `eb87b44` already converted the relevant CLI and browser checks; current fixtures use v3 clips. No speculative script conversion or new browser run was made. Report availability outside this repository and actual historical usage remain unknown. Source/schema/UI cross-checks and diff/history byte checks were completed. All five required checks passed: 88 files and 1,324 tests; whitespace checks passed. No application code changed.

## Final integration checks

Both TypeScript checks, `check-show` (no local shows) and generated widget docs pass. Vitest reports 70 files passed, one failed: **1,079 tests passed and two failed** out of 1,081. Only the two Johansson landing/planting assertions quoted above fail. No tests were weakened or skipped.

The integration contains 55 registered widgets: the existing 54 plus Johansson. The other eleven new widget sources, registrations, tags, demo entries and thumbnails are excluded. Tasks 1–4 are integrated with current main; the old-app removal is preserved. Task 5 remains skipped. The isolated lab server on port 5200 stays running on this integrated version.

The final [selected-widget health check](widgets-check-selected.md) ran Johansson, Current and Tree on three songs at low/high presence: all nine pairs and eighteen variants passed, with no findings, errors or blank flags. It simulated 22,698 frames and made 5,010 observations in 51.908 seconds on runtime revision `dcd0f42`. These checks do not judge aesthetic adequacy or override Johansson's strict foot tests.

Selected integration: Johansson only, plus Tasks 1–4, for publication to `origin/claude/wizardly-franklin-ttaqyo` under Maxim's explicit approval. The rejected all-twelve preview remains on `origin/codex/new-widgets`; no rejected widget source is merged.
