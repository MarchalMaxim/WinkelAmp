# Codex report — 3 November 2026

Work is isolated in `.claude/worktrees/codex-widgets`. No merges, ratings, audio, transcriptions, shows, melodies or shared widget/layer code were changed. Task 5 is waiting for Maxim.

## Checks and local outputs

The five required checks are TypeScript for the app, TypeScript for scripts, Vitest, `check-show`, and generated widget docs. `check-show` reports no tracked shows in this worktree. Initial sandboxed checks failed because localhost connections were denied (`connect EACCES` in 26 ears tests); rerunning with local networking allowed passed all 89 files / 1329 tests. The initial render attempts likewise failed on blocked localhost; the isolated server and renderers now run successfully with local networking allowed. Every browser stubs the ratings server on 5174. Only port 5200 is used.

Demo videos and inspection PNGs are local in `lab/demos/` and `lab/showcase/`; they are not committed. Thumbnails are committed.

## Task 6 — widgets in recipe order

### 1. stress

Implemented the specified spectral shader, pure note-force evaluation, analyser and payoff arcs. Added registry, tags, demo plan, thumbnail and generated docs. Required checks passed. Five pure tests check exact black, required RGB samples, fade/lighten stability and time evaluation. Actual notes select 9 Prelude payoffs including 144.911 s and 20 Beethoven payoffs including 79.216 s. Synthetic six-note/two-note N>=1 coverage is 71.6%/52.4%, near the recipe's 73%/53%.

Demo: Prelude 140–148 s. Inspected Prelude 144.8, 145.0 and 145.1 s frames: leaning edge rings, coloured bands, black saddles and a changed picture at release are visible; no render/page/load errors. The 144.8 frame does **not** have a continuous black middle band, and large rings still fill most of the frame after release. Kept the recipe constants. Full silence, Rach area ratio, exact live/seek screen equality and all songs' aesthetic conditions have not yet been judged. The scalar spectral strip has no pure white; high orders wash to the specified warm grey.

### 2. crackle

Implemented the specified cell partition, separate tone/line canvases, attack flashes and long-line ripening. All five required checks passed (1329 tests). Demo and thumbnail generated. Inspected Nocturne 3.8, 10, 295 and 363 s plus Winter Wind 116–116.4 s: lines terminate at older boundaries, the dense pitch band leaves large top/bottom cells, and attack flashes change cells. No render/page/load errors. Pure geometry probe preserves total area and gives identical live/seek Beethoven partitions. Counts: Nocturne 15 at 10 s (recipe says about 10), 841 final; Rach 1004; Beethoven 720. Presence 0 yields 206/240/205 respectively. No constants changed. I did not verify every possible line intersection by eye, full eight-second ripening through a silence, or overlay visibility at presence 0.

Additional stress inspection: Nocturne 5/10/20/30 s has the specified leaning contacts but looks larger than the requested small-domes description. The spectral PNG strip was rendered and inspected: no pure white.

### 3. seep

Implemented future rings, exact-time flattening, hashed held-note stacks and wrapped persistent strip. All five required checks passed (1329 tests), demo and thumbnail generated. Inspected Prelude 0.5/1/10 s, Nocturne 150/151/153 s and Rach 620 s with no render/page/load errors. Pale rings sit below the line and irregular-width stacks climb above; the late Rach frame remains separable. Loud/quiet widths, attack widths, ring sizes and rise times match recipe arithmetic; F(10)=729.204 at A=8, the t=5 note maps to y=217.793. Audited fractional wrap and fixed immediate rebuild when a seek resets the knob-throttle clock. I did not listen to judge audiovisual contact, exhaustively compare seek/live pictures, or measure the requested 15–35% area; some repeated-note columns are quite regular despite the required hash widths.

### 4. lamps

Implemented the three additive lamp layers, black shadow sprites/threads, register ranks, discord separation, damped motion and 0.34 s brightness gate. All five required checks passed (1329 tests), demo and thumbnail generated. Pure assertions give blocked-lamp colours #1AEAFF/#FF30FF/#FFDE22 and default wall RGB 210/188/216; a 100-attacks/s probe has full jumps at 0/.34/.68 only, and no random calls in onChord. Inspected Nocturne 5/8/20 s, Rite 165/165.4 s and Beethoven 419.1 s (two seconds after its last note): red opening pool, split coloured shadows on pale light and final black are visible; no render/page/load errors. Did not judge the Rach slab's three-second swing by motion playback. Recipe conflict: explicit frame step 2 returns before physics when all lamps are dark, while the prose says swings continue unseen; followed step 2.

### 5. tacet

Built only snapped posture first and inspected Winter 210 s before adding motion: original heights/breath passed, no fallback used. Target groups match 38 lying/5 slouched/20 absent; transition angles give 34 actually lying, 7 slouched and 2 upright. Then added the specified springs, attacks, arrivals/departures, looks and presence. All five required checks passed (1329 tests), demo and thumbnail generated. Full Winter 210/210.2 s, Winter Wind 60/60.1 s and Beethoven 146 s at presence 0 render without errors; sleepers, active warm rectangles and reduced low-presence cast are visible.

Pure 60 fps runs: near-note |theta|<=.02872 (<.08); seek+4 s max difference .05857 (<.12); Rite 15.09 jolts/min, Winter Wind 11.77/min; dense bins 0%, 6.19%, 8.8% on Winter/Rite/Wind. Literal algorithm fails two written attack checks: same-frame decay makes ordinary flash .9116 rather than >=1; already-airborne keys land on 31/3196, 47/4557 and 21/3305 attacks. Kept explicit algorithm. Tremble's Ws>=5 formula also differs from the trap prose limiting long tremble to W>=J. Did not judge the five-seat neighbour turn by motion, or all entry/departure percentages by eye.

### 6. varini

Implemented deterministic room cuts, selected targets, exact-time viewpoint path, two figure canvases, hairlines and kicks. All five required checks passed (1329 tests), demo and thumbnail generated. Rach selected times 5.1776/7.647/10.4139/12.9943 and Beethoven .9925/3.8485/12.8978 match the named clicks; Beethoven t10 f=.2363. Room has 28 pieces and preserves area; 12,068 dwell samples across Rach/Beethoven/Winter Wind call clip zero times. Wind minimum target gap 1.3972 s meets 1.38.

Inspected Rach 12.99/13.1/15.5/15.55 and Beethoven 0/.9925/3.36/3.8485/10 s: whole band, broken paint and seam-free dwell are visible, no render/page/load errors. Natural Rach15.5 f=.9777, so separately rendered a browser-only forced f=.3 still as requested; it reads as one displaced figure with most paint on screen. Kept travel and room factors; did not measure the exact visible-paint percentage or judge every motion transition. Explicit spring-after-draw step means an ordinary velocity kick is first visible one frame after its attack, contrary to attack-frame prose; kept the written order.

### 7. statues

Implemented future freeze/fall tables, ranked steps, corner pivots, slab/floor light and bolt retreat. All five required checks passed (1329 tests), demo and thumbnail regenerated after fixing normal-pose overwrite during bolt retreat. Inspected Beethoven 0/1.1/1.6/2/10/80/160 s, Summer 20/40/60 s and Winter Wind60 s: dark/slab-lit states, corner tilts and floor shadows are visible, no render/page/load errors. Frozen non-victim x stayed fixed across 265,400+ shape checks; dt0 holds state exactly. Winter Wind has 34 freezes/249.73 s, about8.17 turns/min.

Literal recipe shortfall: reset30/live30 reconstruct to 6.8e-13px, but live60 versus reset30 differs at t160 by 60.90px Beethoven/15.67px Summer/154.43px Winter Wind; Beethoven victim angle differs .559rad at t80. Kept explicit caller dt and 1/30 replay. Supplied 6notes/s arithmetic yields base38.04, loudstep54.77px, quietstep21.30px, rather than36/52/20; default presence0 gives4 rather than hinted3 shapes. Fall recovery starts after reaching horizontal; initial corner sign alternates by index, which recipe leaves unspecified. Did not watch whole passages to count each topple visually.

### 8. afteryou

Implemented pure score-derived scenes, lane reservations, melody dodges, false starts, release crossings and stairs. All five required checks passed (1329 tests), demo and thumbnail generated. Beethoven frames0/.9925/3/4.2/10/10.1/13 s have no render/page/load errors: approach, meeting, release and stairs-only silence are visible. First meeting .9925 s; two dodges at3.3555/3.8485; release4.1485; next pair enters10.0978. Across67,999 pre-release samples on Beethoven/Wind/Rite, edge gap>=40px and never shrinks; zero lane/adjacent-lane occupancy conflicts.

CUT interpretation: first chord is meeting, scan begins at a+1 with n0/lastDodge=T; retrocut restarts at b+1. Rank is over all chord highs, rate is trailing1s, melody delta is from previous dodge. Beethoven77 candidate phrases(11.077/min),74 placed pairs(10.645/min),median7dodges,3.90% skipped. Wind13.56% and Rach14.20% skipped exceed10% if that done-when limit is intended for every song rather than Beethoven. Constants unchanged. Did not judge full-song motion/aesthetic effect; no dodge caps added.

### 9. marey

Implemented cached 60 Hz gait, attack exposures, note-selected limbs, distal sails, batched strokes and flash. All five required checks passed (90 files/1333 tests); four new pure tests cover grounded gait, floor contact, exposure replay and real MOMENTS arrays. Demo and thumbnail generated. Actual-note probes:51,004 grounded records never move backwards and maintain exact floor contact. R0/R1 speeds89.15/372.03px/s match90/370. Exposure counts match:Wind10s7,60s152,90s143; Rite174s107; Nocturne66s35. Repeated reset is identical. Pose lookup uses the nearest cached 1/60 record; sails extend only to reached samples.

Inspected Wind10/60, Rite174 and Nocturne66 frames: sparse early strokes, dense fans, a leap arc and quiet sparse exposures are visible. Additional captures Wind0/5/90/206 are error-free; no widget/page/load errors. CPU inside frame at Wind206–209, life24: mean.325ms,p95.400ms,max5.4ms over180 frames, excluding replay/harness. Sustained cost below4ms, so cap stays240. Did not watch the requested20s motion or judge five consecutive attack flashes; FLASH remains.5, no conditional aesthetic change. Did not measure exact lit-area percentages.

### 10. planish

Built and stopped at each requested gate: A stamps/lobes, B flash, C ring, D torch. Root inspected A Nocturne0/10/363, B exact attacks/+70ms, C loud Wind116/206, then D Beethoven pauses and final facets. Four pure tests cover required R/s examples, radial stamp budget<25,000, min-only contact/hardening and soft normal peak. All five required checks passed (91 files/1337 tests); demo and thumbnail generated. Full captures include Beethoven4.5/6/8/10, quiet LilWayne15.7952/15.8652, Wind116/116.05/116.1 and Nocturne362.5, all without widget/page/load errors. Moving red torch patches, coloured oxide and quiet glints are visible. Early isolated dents look round/glossy despite the exact lobe formula; no aesthetic rewrite made.

Only recipe-authorized adjustments: ring default.6 after a regular wave/lattice was visible at Wind116; bounded light a=2.2+.25*sin(.05*t) after full-state quarter-turn lit>.25 counts132858/170985 differed28.6976% relative to baseline. Rite actual final270.328s gives12.314% luminance>.5 and41.697%<.04, passing45%/25% limits; soft stays.2. Permanent h/n/hard/oh match bit-for-bit between live and replay at Beethoven3.3/9/13; first-pause oxide.13449 matches about.13. Replay explicitly clears flashes/rings, so full picture equality fails during active transients (13s live6strikes/4rings, replay0/0). Fractional hammer centres sample the nearest grid cell. Mandatory.006 base is visually near-black rather than exactzero. CPU/seek cost and every named motion condition were not measured/judged. Inspection helper was corrected to avoid a redundant zero-time draw before exact B captures, which were then regenerated.

### 11. fauxpas

Implemented duration-weighted key bins/hysteresis,7line/5side slots, future barges, delayed dips, blush/hunch and hesitant exits. Fixed repeated foreign notes teleporting an already-exiting outsider back to its mark, and restored eligible entries cancelled by key changes. All five required checks passed (1337 tests), demo and thumbnail regenerated after final fixes. Pure60fps probes:309landings have0px error to reserved base marks, exactly7line members and at most3/5/5outsiders on Spring/Wind/Rite; mark spacing>=80px; keyAt identical afterreset.

Inspected Spring7.65/7.8, Wind110 and Rite20: line, approach/front placement, colour changes and crowds visible. Additional frames Spring20/30/7.64, Wind115 and Rite10 all report no widget/page/load errors. Spring bargeT7.650 begins7.200 and landsx377.472654,basey640; the separate18pxlift draws its bottomy622 on attack. Thus the exact-mark check is for base position, not the lifted silhouette. Whole1s bins use floor(win); first bin takes the maximum before hysteresis. Stateful reset returns pcs to slots/skips past barges as written; only keyAt seek equality is claimed. Did not judge the complete motion sequence or every unison break by eye.

### 12. johansson

Built only13-dot gait first, recorded3s/60fps/180frames in local johansson-gate.mp4, and judged its pose sequence recognizably human before adding anything else. Original Catmull tables retained. Then built planned steps/phrases, style, stars, springs, foot bursts, lift and ghost-clearing discs. Final11frames on Nocturne/Wind/Rach/Knights/Liebesleid render without widget/page/load errors; standing Rach1s looks concealed among the field. No confident visible-pose condition triggered the optional.85alpha change; continuous playback/human blind perception tests were not judged. Demo generated. Thumbnail command automatically shows it over Rorschach because it classified it dark alone; that is a thumbnail caveat, not a source change.

Four required checks pass: both TypeScript checks, check-show(no shows), docs-check. Vitest fails honestly:1file failed/91passed,2tests failed/1339passed. Required reproducible synthetic-chord tests use constant level/pitch.5, no jolts/lift, height1.3,60Hz plus exact strike frames:

~~~text
AssertionError: step 1: expected 17.997089043261667 to be less than or equal to 1
AssertionError: step 1, frame 1, horizontal: expected 1.37806197287739 to be less than 1
~~~

Bounds(all13on screen at height1.3) and standing-position tests pass. Fixed-style bisection error is at most.0594px; evolving run/stride/sadness after phase is solved at step start breaks the landing condition. Larger actual-note probes also show failures; old airborne-ankle spring offsets can add error. No leg clamp, gait retune or weakened assertion added. Standing positions hold across255,651 Rach comparisons with changing features. Committed under Maxim's explicit recipe-failure fallback.

Recorded assumptions: time-aware periodic Catmull; first strike.85s pre-roll/half-cycle prior phase; mean loudness across a phrase's selected strikes; phrase changes when actual stand>=1.6s; phase solved using target amplitude/current sadness/current filtered run at step start; cold seek starts default phases/styles; star rest is mean20 unit poses at psi32 without facing. Standing holds pose/lift/springs while flash/alpha decay. maxStep below.85 retains overlapping preparation as written. Nearest16 foot-star selection uses pre-current-frame-shift positions, an unresolved small ordering ambiguity.

## Task 1 — widget health check

Branch: codex/widgets-check, independently from origin/claude/wizardly-franklin-ttaqyo. Added npm run widgets-check and [the complete table](widgets-check.md). All53registered baseline widgets were checked on3songs at presence0/1:159widget/song pairs,318variants,400,998simulated frames and88,510aggregate observations. Intervals: LilWayne80–96s, Prelude118–134s, WinterWind116–132s; each has5s warm-up and60Hzsimulation, with12Hz observations plus every attack frame. Optional --full preserves whole-song mode. No aligned-picture comparisons; no audio played and ratings calls stubbed.

Official run exit1 correctly reports9finding rows: timeslice low makes no less on all3songs; fold and kline have no how-present control on all3each. No thrown/load/queued errors or sampled blank-run findings; the other150pairs pass. TimeSlice modifies a layer below it, so its standalone quantity proxy cannot settle its visual effect. Missing controls require a design choice. No existingwidgetfix made: none is an obvious one-line correction. Long accumulation, other passages and TimeSlice over another layer were not judged. All5repository checks pass(88files/1324tests).

The12newwidgets remain on their requested separate branch; the same check will run on them after Tasks2–4 without merging branches. Earlier partial12Hz/full-song diagnostics are local supplementary files and are not the official table. The checker was corrected to preserve60Hz physics/fades and its default scoped to representative passages, as the handoff does not require complete recordings.

## Task 2 — speed table

Branch: codex/widgets-speed from origin/claude/wizardly-franklin-ttaqyo at515b110. Origin advanced during the session with Tree only; measuredall54registeredwidgets without editingTree. Added npm run widgets-speed and [the worst-first baseline and follow-up](speed.md). All324rounds complete without errors:2busy songs,3fresh-page rounds each,2measured seconds at60Hz and max(5,demo warm) warm-up. Timed renderTo CPU/drawing submission; asynchronousGPU completion and presentation are not measured.

Kept only Current's exact column-cosine and per-point paint-bin caches. Controlled5round×4s tests: Wind2.228→1.758ms(21.09% less), Rite4.359→4.510ms(3.45% more);p95 improves2.9→2.5 and4.5→3.5. Reported as passage-dependent, not universal. Root inspected bothsongs' before/afterframes: same look. Eight fluid steps/13arrays are byte-identical;24paint cases/42,270Canvascommands identical. No parameter, colour, resolution, dynamics or drawing order changed.

Contours cache was tried, numerically/drawing-command identical, but measured<1% gain and was reverted. Its ordered drawing/warp costs and Rorschach's blur/composite costs remain for Maxim; no aesthetic rewrite. A CPU-heavy probe overlapped the first Contours focused baseline, so both candidates' original-source timings were repeated in isolation before decisions. Whole-song accumulation and GPU/screen timing remain unjudged. All five final repository checks pass (88 files/1324 tests), as do benchmark syntax and the whitespace check with existing CRLF allowed.

## Task 3 — old code report

Branch: codex/unused-code from origin/claude/wizardly-franklin-ttaqyo. Added [the dependency/removal report](../docs/unused-code.md). Nothing deleted. Legacy is still linked by currentstudio and explicitlybuilt; both testpages have manualharness/screenshot consumers. All28stage files have consumers:26fromthelegacyruntime,oneharnessandonecastCLI/testgenerator. Currentstudio/render sourcegraphs use no oldstage runtime, but currentaudio/ingest still needsstage typecontracts, which themselvesreferenceoldmodules. Thosecontracts mustmovebefore awhole-folder retirement.

Checkedtrackedentries,staticvalue/typeimportclosures,dynamicimports,build/package/CIinputs,scriptURLs,testsanddocs;65linecitationsresolve. No application/browserruntime orvisualtestwasrunforthisstaticreport; actualhumanuse,externalbookmarks,individualdeadexportsanddeployedworkflowstatusremainunknown. All5requiredchecks pass(88files/1324tests);check-showfindsno localshows. No code/data/historychanged.

## Remaining work

All12 widget commits are built and pushed, with the recipe shortfalls above (including two failing Johansson assertions). Task 4 is pending; the new12 health run remains for the final review. Task 5 is intentionally skipped.
