# Widget speed table

Started 2026-11-03T17:56:42.783Z; finished 2026-11-03T17:57:33.900Z.
Source revision: `10fefebe6346a531489c3cd16251419935d1fdf9`. Registered widgets: 65; selected: 12. Completed rounds: 72/72. Chrome: 156.0.8078.79.

Default knobs and drives, seed 1, 60 Hz, 120 measured frames (2.000 s) per round, 3 rounds per song. Winter Wind: 206.000–208.000 s; Rite: 174.000–176.000 s. Each round has a fresh page and max(5, lab/demos.json warm) seconds of warm-up; Vine gets 60 s. No audio plays.
One Chrome browser and one page at a time. All requests to the ratings server on port 5174 are stubbed before navigation; Vite reload is disabled. No ratings or knobs are saved.

Each sample measures performance.now immediately around one renderTo(1/60 s) advance. It includes the widget, chord handling, the harness and CPU submission of drawing commands. It does not wait for asynchronous GPU work or measure screen presentation. There is no forced per-frame pixel readback, so the benchmark does not deliberately change the Canvas backend. Timer resolution, deferred drawing and other activity on this computer limit small comparisons.
Each song column is the median of its round means; p95 uses all successful frame samples. Rows sort by the worse song column, slowest first (errors first). These machine-local CPU/submission figures do not by themselves prove a GPU frame budget. Whole-song accumulation and other passages remain unmeasured.
No frame images are read or saved by this run. Use --images <directory> for final-frame PNGs taken after timing.

| Widget | Winter Wind ms/frame | Rite ms/frame | Worst ms/frame | Worst p95 ms | Result |
|---|---:|---:|---:|---:|---|
| seep | 0.333 | 0.296 | 0.333 | 0.500 | ok |
| planish | 0.296 | 0.206 | 0.296 | 0.700 | ok |
| johansson | 0.249 | 0.260 | 0.260 | 0.300 | ok |
| marey | 0.236 | 0.208 | 0.236 | 0.400 | ok |
| tacet | 0.147 | 0.177 | 0.177 | 0.200 | ok |
| varini | 0.110 | 0.088 | 0.110 | 0.400 | ok |
| lamps | 0.106 | 0.102 | 0.106 | 0.200 | ok |
| stress | 0.070 | 0.086 | 0.086 | 0.200 | ok |
| fauxpas | 0.034 | 0.037 | 0.037 | 0.100 | ok |
| statues | 0.032 | 0.033 | 0.033 | 0.100 | ok |
| afteryou | 0.028 | 0.029 | 0.029 | 0.100 | ok |
| crackle | 0.028 | 0.029 | 0.029 | 0.100 | ok |

0 widget(s) have errors or incomplete measurements.
