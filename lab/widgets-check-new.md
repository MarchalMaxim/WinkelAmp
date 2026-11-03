# Widget health check

Started 2026-11-03T17:54:41.376Z; finished 2026-11-03T17:56:22.546Z.
Source revision: `10fefebe6346a531489c3cd16251419935d1fdf9`. Registered widgets: 65; selected: 12. Completed widget/song pairs: 36/36.
Songs: lil-wayne-bells-visualizer, prelude, chopin-winter-wind. Scope: 16-second representative passages after up to 5 seconds of warm-up; exact measurement start/end and actual warm time are in each row. Each low/high variant uses seed 1 and 60 Hz simulation. renderTo draws every intermediate simulation frame and dispatches every crossed attack, including warm-up. No audio plays.
Only measurement frames contribute image statistics and blank/presence judgments. Observations use a uniform 12 Hz schedule plus the first simulation frame at or after every attack within the measurement interval, its start and its final frame. Duplicate indices are removed.
90792 simulation frames (one initial frame plus warm-up and measurement steps per variant) and 20040 measurement observations completed. Simulation uses the normal 60 Hz physics and fades.

A fresh page is used for each variant, sequentially in one Chrome browser. Requests to the ratings server on port 5174 are stubbed before navigation; Vite reload is disabled. Leads use renderPresent; a plain presence knob is set directly through pst, with that knob's drive fixed. Other default drives are preserved. Uncaught page errors, renderErrors, load failures and JavaScript console warnings/errors (including caught queued-draw errors) are collected.

Each observed frame is reduced to 128×72. “Ink” is the share outside its most common RGB colour bin (32 channel values per bin); “lit” is the share with any channel above 8/255; contrast is the RGB standard deviation (shown in 0..255 units). Means are weighted by the song time since the previous observation, using the right-end sample; measurement-start has weight zero. Low and high use the same integer observation indices. This avoids treating a busy run's extra attack observations as extra song time. No pictures are compared pixel by pixel.
“Blank” means no observed channel exceeded 8/255 during the whole measured run, including its attack frames; warm-up is excluded. It cannot exclude marks visible only between observations or lost in reduction. Low is flagged “no less” when none of its three time-weighted means is lower than high by more than 2% plus 0.2 percentage points. These are broad diagnostic proxies: flat backgrounds, colour changes, saturation, dim marks and effects meant to alter another layer can make the quantity judgment inconclusive. They do not certify appearance. Long accumulation, late-song state and behavior outside the listed passages remain unjudged.

| Widget | Song | Start–end s | Warm s | Sim frames L/H | Observations L/H | Low ink % | High ink % | Low lit % | High lit % | Low contrast | High contrast | Result |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| stress | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 71.00 | 89.25 | 80.50 | 95.57 | 50.87 | 49.82 | ok |
| stress | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 88.99 | 94.08 | 96.36 | 98.54 | 49.96 | 50.09 | ok |
| stress | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 79.39 | 94.41 | 88.45 | 98.54 | 48.97 | 50.47 | ok |
| crackle | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 14.57 | 16.13 | 16.24 | 100.00 | 46.24 | 33.35 | ok |
| crackle | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 19.00 | 15.82 | 21.06 | 100.00 | 51.06 | 33.63 | ok |
| crackle | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 19.47 | 18.76 | 21.22 | 100.00 | 54.05 | 35.01 | ok |
| seep | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 11.87 | 22.85 | 47.54 | 52.75 | 28.38 | 41.31 | ok |
| seep | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 12.99 | 35.96 | 44.53 | 57.05 | 37.64 | 65.65 | ok |
| seep | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 10.01 | 22.26 | 45.30 | 51.47 | 29.50 | 42.42 | ok |
| lamps | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 78.44 | 82.15 | 99.37 | 99.04 | 24.76 | 33.64 | ok |
| lamps | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 88.71 | 94.60 | 99.96 | 99.92 | 29.30 | 48.58 | ok |
| lamps | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 88.81 | 93.61 | 99.96 | 99.93 | 29.24 | 44.71 | ok |
| tacet | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 2.49 | 8.37 | 3.10 | 100.00 | 24.97 | 35.30 | ok |
| tacet | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 3.44 | 9.21 | 4.00 | 100.00 | 29.11 | 37.66 | ok |
| tacet | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 4.30 | 10.75 | 5.02 | 100.00 | 32.67 | 44.50 | ok |
| varini | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 8.79 | 16.74 | 9.51 | 18.15 | 55.68 | 69.08 | ok |
| varini | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 11.38 | 23.47 | 12.43 | 25.18 | 55.34 | 68.33 | ok |
| varini | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 11.31 | 20.20 | 12.43 | 22.33 | 52.11 | 62.15 | ok |
| statues | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 4.22 | 8.44 | 4.37 | 25.19 | 15.12 | 30.48 | ok |
| statues | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 4.31 | 7.67 | 4.59 | 21.12 | 15.61 | 27.61 | ok |
| statues | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 2.59 | 4.39 | 2.79 | 8.11 | 11.45 | 17.32 | ok |
| afteryou | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.77 | 1.91 | 0.80 | 2.51 | 11.28 | 20.27 | ok |
| afteryou | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.61 | 1.58 | 0.66 | 1.94 | 9.13 | 18.08 | ok |
| afteryou | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.19 | 1.26 | 0.21 | 1.76 | 4.51 | 15.35 | ok |
| marey | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.19 | 4.08 | 0.25 | 8.07 | 4.04 | 16.39 | ok |
| marey | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.88 | 8.69 | 2.16 | 15.45 | 3.89 | 22.20 | ok |
| marey | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.60 | 6.87 | 2.94 | 16.56 | 3.90 | 17.74 | ok |
| planish | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 2.71 | 36.38 | 10.92 | 60.20 | 8.73 | 49.28 | ok |
| planish | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 1.95 | 33.73 | 8.07 | 60.98 | 7.77 | 52.33 | ok |
| planish | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 5.60 | 34.70 | 20.92 | 59.28 | 12.86 | 52.38 | ok |
| fauxpas | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 13.97 | 14.13 | 100.00 | 100.00 | 23.50 | 49.09 | ok |
| fauxpas | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 14.12 | 14.44 | 100.00 | 100.00 | 26.96 | 53.26 | ok |
| fauxpas | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 13.79 | 14.50 | 100.00 | 100.00 | 26.91 | 54.78 | ok |
| johansson | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.09 | 0.95 | 0.10 | 1.06 | 5.15 | 11.39 | ok |
| johansson | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.09 | 1.02 | 0.10 | 1.13 | 5.23 | 12.02 | ok |
| johansson | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.11 | 0.98 | 0.12 | 1.09 | 6.28 | 12.18 | ok |

0 pair(s) have findings; 0 pair(s) remain unchecked. Findings produce a non-zero exit status.
