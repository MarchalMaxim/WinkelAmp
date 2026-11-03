# Widget speed table

This 54-widget table is the baseline before the Current cache change. The controlled follow-up below records that change on the final source; all other widget source stays unchanged.

Started 2026-11-03T17:13:46.295Z; finished 2026-11-03T17:21:27.968Z.
Source revision: `515b110175b947250d2f0e6dcbc23c1ede188d59`. Registered widgets: 54; selected: 54. Completed rounds: 324/324. Chrome: 156.0.8078.79.

Default knobs and drives, seed 1, 60 Hz, 120 measured frames (2.000 s) per round, 3 rounds per song. Winter Wind: 206.000–208.000 s; Rite: 174.000–176.000 s. Each round has a fresh page and max(5, lab/demos.json warm) seconds of warm-up; Vine gets 60 s. No audio plays.
One Chrome browser and one page at a time. All requests to the ratings server on port 5174 are stubbed before navigation; Vite reload is disabled. No ratings or knobs are saved.

Each sample measures performance.now immediately around one renderTo(1/60 s) advance. It includes the widget, chord handling, the harness and CPU submission of drawing commands. It does not wait for asynchronous GPU work or measure screen presentation. There is no forced per-frame pixel readback, so the benchmark does not deliberately change the Canvas backend. Timer resolution, deferred drawing and other activity on this computer limit small comparisons.
Each song column is the median of its round means; p95 uses all successful frame samples. Rows sort by the worse song column, slowest first (errors first). These machine-local CPU/submission figures do not by themselves prove a GPU frame budget. Whole-song accumulation and other passages remain unmeasured.
No frame images are read or saved by this run. Use --images <directory> for final-frame PNGs taken after timing.

| Widget | Winter Wind ms/frame | Rite ms/frame | Worst ms/frame | Worst p95 ms | Result |
|---|---:|---:|---:|---:|---|
| contours | 8.205 | 7.732 | 8.205 | 70.400 | ok |
| current | 2.252 | 5.586 | 5.586 | 4.600 | ok |
| rorschach | 0.591 | 4.155 | 4.155 | 24.100 | ok |
| riley | 1.687 | 3.890 | 3.890 | 4.600 | ok |
| blocks | 1.896 | 3.791 | 3.791 | 5.500 | ok |
| halftone | 3.197 | 3.716 | 3.716 | 4.300 | ok |
| fifths | 2.671 | 0.203 | 2.671 | 35.500 | ok |
| ikeda | 0.831 | 1.938 | 1.938 | 8.900 | ok |
| klee | 1.726 | 1.936 | 1.936 | 2.100 | ok |
| kusama | 1.903 | 1.762 | 1.903 | 5.500 | ok |
| mclaren | 1.705 | 0.231 | 1.705 | 0.600 | ok |
| marbling | 1.387 | 1.293 | 1.387 | 2.400 | ok |
| strings | 1.345 | 0.444 | 1.345 | 1.500 | ok |
| pointillism | 0.521 | 1.163 | 1.163 | 5.800 | ok |
| honey | 0.670 | 1.042 | 1.042 | 1.200 | ok |
| ridges | 0.958 | 0.534 | 0.958 | 1.100 | ok |
| horizon | 0.308 | 0.933 | 0.933 | 2.900 | ok |
| fireworks | 0.663 | 0.582 | 0.663 | 1.100 | ok |
| kandinsky | 0.315 | 0.609 | 0.609 | 0.700 | ok |
| duet | 0.427 | 0.597 | 0.597 | 0.700 | ok |
| nebula | 0.497 | 0.517 | 0.517 | 0.700 | ok |
| lazy | 0.496 | 0.449 | 0.496 | 0.700 | ok |
| mandala | 0.428 | 0.470 | 0.470 | 1.200 | ok |
| miro | 0.386 | 0.442 | 0.442 | 0.600 | ok |
| vine | 0.387 | 0.408 | 0.408 | 1.000 | ok |
| pixelsort | 0.349 | 0.327 | 0.349 | 4.200 | ok |
| gust | 0.344 | 0.265 | 0.344 | 0.600 | ok |
| matisse | 0.335 | 0.216 | 0.335 | 0.500 | ok |
| squares | 0.009 | 0.315 | 0.315 | 0.300 | ok |
| kline | 0.310 | 0.186 | 0.310 | 0.300 | ok |
| cells | 0.289 | 0.175 | 0.289 | 0.400 | ok |
| murmuration | 0.257 | 0.232 | 0.257 | 0.900 | ok |
| fields | 0.231 | 0.195 | 0.231 | 0.300 | ok |
| comfort | 0.209 | 0.205 | 0.209 | 0.300 | ok |
| score | 0.208 | 0.167 | 0.208 | 0.300 | ok |
| fischinger | 0.150 | 0.203 | 0.203 | 0.400 | ok |
| tunnel | 0.097 | 0.162 | 0.162 | 0.300 | ok |
| timeslice | 0.150 | 0.140 | 0.150 | 0.200 | ok |
| delaunay | 0.117 | 0.118 | 0.118 | 0.200 | ok |
| boogie | 0.110 | 0.114 | 0.114 | 0.200 | ok |
| lenlye | 0.087 | 0.101 | 0.101 | 0.700 | ok |
| casket | 0.091 | 0.004 | 0.091 | 0.300 | ok |
| royal | 0.087 | 0.089 | 0.089 | 0.200 | ok |
| clumsy | 0.073 | 0.086 | 0.086 | 0.200 | ok |
| flee | 0.076 | 0.072 | 0.076 | 0.200 | ok |
| tree | 0.071 | 0.068 | 0.071 | 0.200 | ok |
| scribble | 0.060 | 0.048 | 0.060 | 0.200 | ok |
| fold | 0.053 | 0.059 | 0.059 | 0.100 | ok |
| brush | 0.051 | 0.048 | 0.051 | 0.200 | ok |
| harmonograph | 0.050 | 0.051 | 0.051 | 0.100 | ok |
| lewitt | 0.048 | 0.045 | 0.048 | 0.200 | ok |
| martin | 0.037 | 0.021 | 0.037 | 0.100 | ok |
| suprematism | 0.029 | 0.026 | 0.029 | 0.100 | ok |
| stella | 0.024 | 0.018 | 0.024 | 0.100 | ok |

0 widget(s) have errors or incomplete measurements.

## Controlled follow-up

Five fresh-page rounds per song, four measured seconds (Wind206–210, Rite174–178), five seconds of warm-up, same60Hz/defaults/seed. No background probes or heavy checks ran during the paired measurements. These are separate from the baseline's three two-second rounds.

| Widget / song | Before mean ms | After mean ms | Mean change | Before p95 ms | After p95 ms |
|---|---:|---:|---|---:|---:|
| Current / Winter Wind | 2.228 | 1.758 | 21.09% less | 2.900 | 2.500 |
| Current / Rite | 4.359 | 4.510 | 3.45% more | 4.500 | 3.500 |

Kept Current's two exact-work caches: one column cosine per simulation step and one paint bin per thread point. No dynamics, palette, resolution, knob or drawing-order changes. Original and changed fluid arrays were byte-identical;24 paint cases produced42,270 identical Canvas commands. The two rendered final frames per version were inspected and look the same. The gain is passage-dependent; the Rite mean did not improve. These CPU/submission figures do not establish a GPU or screen-frame improvement.

Tried and reverted a Contours Float64 scaled-field cache: Wind8.806→8.754ms and Rite7.678→7.613ms (0.60%/0.84% less), too small to distinguish from noise. An earlier Contours baseline overlapped a CPU-heavy equivalence probe, so only the later isolated before/after run above was used for decisions. Contours remains unchanged. Its dynamic field/warp and segment drawing, and Rorschach's ordered blurs/layer composites, have no clear large shortcut that preserves the picture; left for Maxim. Tree was measured read-only and never edited.

Paired PNGs and raw round data remain local under lab/showcase/codex-speed-clean-before and codex-speed-clean-after; no rendered media is committed.
