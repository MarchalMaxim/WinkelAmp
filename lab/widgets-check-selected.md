# Widget health check

Started 2026-11-03T18:28:04.435Z; finished 2026-11-03T18:28:56.343Z.
Source revision: `dcd0f422e30b659d6bad63ea546fd9b7ee86f339`. Registered widgets: 55; selected: 3. Completed widget/song pairs: 9/9.
Songs: lil-wayne-bells-visualizer, prelude, chopin-winter-wind. Scope: 16-second representative passages after up to 5 seconds of warm-up; exact measurement start/end and actual warm time are in each row. Each low/high variant uses seed 1 and 60 Hz simulation. renderTo draws every intermediate simulation frame and dispatches every crossed attack, including warm-up. No audio plays.
Only measurement frames contribute image statistics and blank/presence judgments. Observations use a uniform 12 Hz schedule plus the first simulation frame at or after every attack within the measurement interval, its start and its final frame. Duplicate indices are removed.
22698 simulation frames (one initial frame plus warm-up and measurement steps per variant) and 5010 measurement observations completed. Simulation uses the normal 60 Hz physics and fades.

A fresh page is used for each variant, sequentially in one Chrome browser. Requests to the ratings server on port 5174 are stubbed before navigation; Vite reload is disabled. Leads use renderPresent; a plain presence knob is set directly through pst, with that knob's drive fixed. Other default drives are preserved. Uncaught page errors, renderErrors, load failures and JavaScript console warnings/errors (including caught queued-draw errors) are collected.

Each observed frame is reduced to 128×72. “Ink” is the share outside its most common RGB colour bin (32 channel values per bin); “lit” is the share with any channel above 8/255; contrast is the RGB standard deviation (shown in 0..255 units). Means are weighted by the song time since the previous observation, using the right-end sample; measurement-start has weight zero. Low and high use the same integer observation indices. This avoids treating a busy run's extra attack observations as extra song time. No pictures are compared pixel by pixel.
“Blank” means no observed channel exceeded 8/255 during the whole measured run, including its attack frames; warm-up is excluded. It cannot exclude marks visible only between observations or lost in reduction. Low is flagged “no less” when none of its three time-weighted means is lower than high by more than 2% plus 0.2 percentage points. These are broad diagnostic proxies: flat backgrounds, colour changes, saturation, dim marks and effects meant to alter another layer can make the quantity judgment inconclusive. They do not certify appearance. Long accumulation, late-song state and behavior outside the listed passages remain unjudged.

| Widget | Song | Start–end s | Warm s | Sim frames L/H | Observations L/H | Low ink % | High ink % | Low lit % | High lit % | Low contrast | High contrast | Result |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| johansson | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.09 | 0.95 | 0.10 | 1.06 | 5.15 | 11.39 | ok |
| johansson | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.09 | 1.02 | 0.10 | 1.13 | 5.23 | 12.02 | ok |
| johansson | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.11 | 0.98 | 0.12 | 1.09 | 6.28 | 12.18 | ok |
| current | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 11.16 | 13.11 | 14.85 | 17.60 | 32.21 | 37.15 | ok |
| current | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 22.04 | 25.29 | 31.73 | 31.28 | 39.36 | 50.05 | ok |
| current | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 8.02 | 10.17 | 12.80 | 15.46 | 23.23 | 26.94 | ok |
| tree | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 65.14 | 83.20 | 100.00 | 100.00 | 94.67 | 84.24 | ok |
| tree | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 70.09 | 83.91 | 100.00 | 100.00 | 92.81 | 82.15 | ok |
| tree | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 68.13 | 86.66 | 100.00 | 100.00 | 93.19 | 81.27 | ok |

0 pair(s) have findings; 0 pair(s) remain unchecked. Findings produce a non-zero exit status.
