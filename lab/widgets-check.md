# Widget health check

Started 2026-11-03T16:47:21.834Z; finished 2026-11-03T17:05:41.966Z.
Source revision: `639aaea2e1115c7536e7b92757f950b1c8c32813`. Registered widgets: 53; selected: 53. Completed widget/song pairs: 159/159.
Songs: lil-wayne-bells-visualizer, prelude, chopin-winter-wind. Scope: 16-second representative passages after up to 5 seconds of warm-up; exact measurement start/end and actual warm time are in each row. Each low/high variant uses seed 1 and 60 Hz simulation. renderTo draws every intermediate simulation frame and dispatches every crossed attack, including warm-up. No audio plays.
Only measurement frames contribute image statistics and blank/presence judgments. Observations use a uniform 12 Hz schedule plus the first simulation frame at or after every attack within the measurement interval, its start and its final frame. Duplicate indices are removed.
400998 simulation frames (one initial frame plus warm-up and measurement steps per variant) and 88510 measurement observations completed. Simulation uses the normal 60 Hz physics and fades.

A fresh page is used for each variant, sequentially in one Chrome browser. Requests to the ratings server on port 5174 are stubbed before navigation; Vite reload is disabled. Leads use renderPresent; a plain presence knob is set directly through pst, with that knob's drive fixed. Other default drives are preserved. Uncaught page errors, renderErrors, load failures and JavaScript console warnings/errors (including caught queued-draw errors) are collected.

Each observed frame is reduced to 128×72. “Ink” is the share outside its most common RGB colour bin (32 channel values per bin); “lit” is the share with any channel above 8/255; contrast is the RGB standard deviation (shown in 0..255 units). Means are weighted by the song time since the previous observation, using the right-end sample; measurement-start has weight zero. Low and high use the same integer observation indices. This avoids treating a busy run's extra attack observations as extra song time. No pictures are compared pixel by pixel.
“Blank” means no observed channel exceeded 8/255 during the whole measured run, including its attack frames; warm-up is excluded. It cannot exclude marks visible only between observations or lost in reduction. Low is flagged “no less” when none of its three time-weighted means is lower than high by more than 2% plus 0.2 percentage points. These are broad diagnostic proxies: flat backgrounds, colour changes, saturation, dim marks and effects meant to alter another layer can make the quantity judgment inconclusive. They do not certify appearance. Long accumulation, late-song state and behavior outside the listed passages remain unjudged.

| Widget | Song | Start–end s | Warm s | Sim frames L/H | Observations L/H | Low ink % | High ink % | Low lit % | High lit % | Low contrast | High contrast | Result |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| fireworks | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 4.46 | 25.37 | 7.71 | 35.33 | 14.82 | 37.51 | ok |
| fireworks | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 4.52 | 20.39 | 7.94 | 29.64 | 14.51 | 31.84 | ok |
| fireworks | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 3.31 | 16.83 | 5.98 | 26.27 | 12.33 | 28.17 | ok |
| clumsy | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 3.24 | 5.84 | 100.00 | 100.00 | 22.96 | 28.49 | ok |
| clumsy | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 3.28 | 5.85 | 100.00 | 100.00 | 23.11 | 28.56 | ok |
| clumsy | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 3.31 | 5.88 | 100.00 | 100.00 | 22.96 | 28.50 | ok |
| gust | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 5.14 | 23.23 | 100.00 | 100.00 | 10.55 | 29.32 | ok |
| gust | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 10.30 | 35.12 | 100.00 | 100.00 | 21.80 | 42.23 | ok |
| gust | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 6.61 | 33.37 | 100.00 | 100.00 | 15.27 | 38.86 | ok |
| duet | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 2.67 | 9.84 | 3.01 | 10.88 | 21.07 | 41.15 | ok |
| duet | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 3.79 | 12.19 | 4.21 | 13.17 | 26.49 | 47.79 | ok |
| duet | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 3.58 | 12.22 | 4.08 | 13.64 | 24.21 | 45.75 | ok |
| vine | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.33 | 2.38 | 100.00 | 100.00 | 4.45 | 8.53 | ok |
| vine | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.40 | 4.26 | 100.00 | 100.00 | 5.09 | 12.47 | ok |
| vine | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.37 | 3.52 | 100.00 | 100.00 | 4.74 | 11.55 | ok |
| royal | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 7.14 | 7.61 | 100.00 | 100.00 | 10.04 | 12.84 | ok |
| royal | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 7.14 | 7.98 | 100.00 | 100.00 | 10.54 | 14.32 | ok |
| royal | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 7.19 | 7.92 | 100.00 | 100.00 | 11.32 | 14.67 | ok |
| comfort | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.00 | 71.39 | 87.66 | 100.00 | 3.43 | 32.13 | ok |
| comfort | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.00 | 82.31 | 79.97 | 100.00 | 3.01 | 37.43 | ok |
| comfort | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.00 | 79.96 | 75.74 | 100.00 | 3.15 | 40.88 | ok |
| honey | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 3.76 | 7.56 | 3.95 | 7.69 | 27.36 | 40.32 | ok |
| honey | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 6.23 | 12.36 | 6.47 | 12.56 | 35.66 | 50.69 | ok |
| honey | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 6.88 | 10.17 | 7.12 | 10.33 | 37.63 | 46.74 | ok |
| lazy | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 23.32 | 66.54 | 100.00 | 100.00 | 8.31 | 17.11 | ok |
| lazy | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 22.87 | 67.29 | 100.00 | 100.00 | 8.95 | 17.82 | ok |
| lazy | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 23.92 | 67.34 | 100.00 | 100.00 | 9.37 | 18.05 | ok |
| timeslice | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 1.27 | 1.24 | 2.33 | 2.22 | 5.24 | 5.54 | low makes no less |
| timeslice | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 3.60 | 3.56 | 6.61 | 6.80 | 8.67 | 8.89 | low makes no less |
| timeslice | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 2.86 | 2.73 | 5.48 | 5.55 | 7.48 | 7.59 | low makes no less |
| fold | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 2.71 | 2.71 | 4.61 | 4.61 | 12.39 | 12.39 | no how present knob |
| fold | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 3.20 | 3.20 | 5.50 | 5.50 | 12.81 | 12.81 | no how present knob |
| fold | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 3.90 | 3.90 | 6.04 | 6.04 | 16.71 | 16.71 | no how present knob |
| stella | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 6.19 | 19.02 | 7.18 | 20.93 | 30.04 | 49.17 | ok |
| stella | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 5.10 | 15.30 | 5.96 | 17.56 | 28.46 | 48.42 | ok |
| stella | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 7.79 | 21.86 | 8.80 | 23.19 | 40.29 | 57.99 | ok |
| fischinger | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 48.04 | 47.99 | 100.00 | 100.00 | 19.57 | 20.59 | ok |
| fischinger | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 49.40 | 49.66 | 100.00 | 100.00 | 25.59 | 27.33 | ok |
| fischinger | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 48.62 | 48.86 | 100.00 | 100.00 | 21.12 | 22.78 | ok |
| mclaren | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 79.85 | 86.18 | 99.84 | 99.84 | 41.85 | 44.64 | ok |
| mclaren | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 82.69 | 88.96 | 99.88 | 99.89 | 52.57 | 57.99 | ok |
| mclaren | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 84.81 | 90.31 | 100.00 | 100.00 | 42.73 | 49.34 | ok |
| lenlye | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 6.02 | 21.39 | 21.72 | 41.15 | 20.89 | 38.70 | ok |
| lenlye | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 12.48 | 20.77 | 27.49 | 39.03 | 39.08 | 46.82 | ok |
| lenlye | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 7.60 | 12.74 | 16.04 | 23.36 | 27.86 | 31.83 | ok |
| klee | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 52.69 | 75.30 | 100.00 | 100.00 | 26.38 | 42.36 | ok |
| klee | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 80.81 | 88.51 | 100.00 | 100.00 | 47.70 | 48.34 | ok |
| klee | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 66.82 | 83.31 | 100.00 | 100.00 | 32.90 | 47.73 | ok |
| miro | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 19.33 | 22.20 | 100.00 | 100.00 | 16.26 | 26.11 | ok |
| miro | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 22.29 | 25.73 | 100.00 | 100.00 | 34.94 | 47.73 | ok |
| miro | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 21.80 | 27.91 | 100.00 | 100.00 | 38.83 | 53.58 | ok |
| delaunay | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 1.46 | 65.90 | 5.39 | 70.58 | 4.57 | 42.12 | ok |
| delaunay | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 2.45 | 68.46 | 7.06 | 72.99 | 4.77 | 49.56 | ok |
| delaunay | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 2.21 | 68.92 | 10.51 | 70.79 | 4.76 | 48.34 | ok |
| lewitt | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 19.51 | 24.27 | 100.00 | 100.00 | 25.29 | 36.55 | ok |
| lewitt | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 8.50 | 18.93 | 100.00 | 99.90 | 18.33 | 37.51 | ok |
| lewitt | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 10.58 | 21.87 | 100.00 | 99.94 | 17.78 | 33.43 | ok |
| ridges | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 4.66 | 9.42 | 6.97 | 13.08 | 24.09 | 32.01 | ok |
| ridges | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 5.25 | 10.17 | 7.84 | 13.94 | 24.41 | 31.58 | ok |
| ridges | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 5.30 | 10.23 | 8.32 | 14.39 | 22.07 | 28.55 | ok |
| matisse | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 8.11 | 11.42 | 100.00 | 100.00 | 32.50 | 41.08 | ok |
| matisse | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 20.43 | 32.17 | 100.00 | 100.00 | 53.07 | 56.89 | ok |
| matisse | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 16.95 | 29.57 | 100.00 | 100.00 | 45.95 | 58.55 | ok |
| kusama | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.00 | 53.40 | 99.92 | 100.00 | 7.37 | 71.92 | ok |
| kusama | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.00 | 55.12 | 100.00 | 100.00 | 6.22 | 70.23 | ok |
| kusama | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.00 | 56.37 | 93.60 | 100.00 | 7.03 | 70.40 | ok |
| ikeda | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.00 | 14.90 | 1.16 | 18.20 | 2.11 | 54.30 | ok |
| ikeda | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.00 | 25.59 | 1.34 | 28.30 | 2.05 | 74.66 | ok |
| ikeda | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.00 | 21.33 | 0.80 | 23.45 | 1.55 | 65.43 | ok |
| horizon | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.00 | 66.04 | 1.31 | 100.00 | 1.70 | 44.45 | ok |
| horizon | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.01 | 70.53 | 1.38 | 100.00 | 1.74 | 44.05 | ok |
| horizon | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.01 | 67.23 | 1.26 | 100.00 | 1.70 | 40.42 | ok |
| harmonograph | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 1.90 | 5.12 | 2.88 | 7.72 | 14.18 | 24.05 | ok |
| harmonograph | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 1.55 | 4.81 | 2.27 | 7.04 | 13.36 | 23.19 | ok |
| harmonograph | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 1.57 | 5.67 | 2.30 | 8.22 | 12.88 | 24.81 | ok |
| kline | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 32.56 | 32.56 | 100.00 | 100.00 | 77.17 | 77.17 | no how present knob |
| kline | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 38.63 | 38.63 | 100.00 | 100.00 | 84.73 | 84.73 | no how present knob |
| kline | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 42.59 | 42.59 | 100.00 | 100.00 | 83.54 | 83.54 | no how present knob |
| score | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 60.27 | 60.59 | 100.00 | 100.00 | 22.27 | 30.89 | ok |
| score | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 59.93 | 60.61 | 100.00 | 100.00 | 23.97 | 32.33 | ok |
| score | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 59.15 | 59.85 | 100.00 | 100.00 | 20.17 | 22.77 | ok |
| boogie | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 25.32 | 31.15 | 100.00 | 100.00 | 46.69 | 51.15 | ok |
| boogie | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 25.57 | 31.50 | 100.00 | 100.00 | 47.84 | 53.22 | ok |
| boogie | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 25.21 | 30.37 | 100.00 | 100.00 | 47.07 | 50.52 | ok |
| cells | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 47.61 | 63.34 | 99.88 | 99.90 | 34.67 | 44.44 | ok |
| cells | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 55.28 | 63.55 | 99.86 | 99.85 | 50.44 | 55.58 | ok |
| cells | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 38.89 | 59.49 | 99.95 | 99.93 | 46.32 | 49.44 | ok |
| nebula | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 1.57 | 4.38 | 2.16 | 6.44 | 13.75 | 20.83 | ok |
| nebula | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 1.93 | 3.33 | 2.35 | 4.07 | 20.22 | 27.35 | ok |
| nebula | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 2.13 | 4.57 | 2.73 | 6.12 | 18.42 | 26.46 | ok |
| pixelsort | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 2.28 | 8.31 | 3.11 | 10.35 | 8.46 | 20.73 | ok |
| pixelsort | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 2.36 | 10.86 | 3.36 | 12.85 | 7.23 | 21.81 | ok |
| pixelsort | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 1.58 | 5.25 | 2.49 | 6.90 | 6.33 | 13.52 | ok |
| mandala | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 4.83 | 11.51 | 6.58 | 15.00 | 24.55 | 37.11 | ok |
| mandala | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 10.51 | 26.29 | 12.23 | 28.72 | 43.67 | 69.29 | ok |
| mandala | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 6.43 | 11.47 | 8.41 | 14.65 | 30.86 | 40.30 | ok |
| martin | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 70.48 | 63.39 | 100.00 | 100.00 | 7.71 | 9.11 | ok |
| martin | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 70.47 | 64.44 | 100.00 | 100.00 | 7.71 | 9.70 | ok |
| martin | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 70.54 | 62.05 | 100.00 | 100.00 | 7.72 | 9.43 | ok |
| murmuration | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.13 | 7.98 | 0.61 | 9.46 | 1.94 | 34.44 | ok |
| murmuration | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.13 | 7.21 | 0.46 | 8.61 | 1.39 | 31.27 | ok |
| murmuration | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.01 | 9.25 | 0.16 | 11.01 | 0.70 | 31.17 | ok |
| marbling | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 22.63 | 47.75 | 24.20 | 50.23 | 49.96 | 70.20 | ok |
| marbling | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 19.49 | 44.33 | 21.19 | 47.47 | 31.35 | 47.10 | ok |
| marbling | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 18.77 | 37.89 | 20.78 | 40.91 | 35.32 | 57.16 | ok |
| kandinsky | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 3.24 | 11.48 | 4.29 | 16.10 | 18.35 | 37.12 | ok |
| kandinsky | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 7.18 | 19.65 | 8.41 | 24.30 | 25.21 | 43.89 | ok |
| kandinsky | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 4.08 | 16.18 | 5.39 | 22.56 | 18.78 | 41.00 | ok |
| rorschach | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 22.49 | 52.08 | 28.89 | 61.31 | 16.72 | 19.67 | ok |
| rorschach | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 17.69 | 53.59 | 22.62 | 64.91 | 14.03 | 18.25 | ok |
| rorschach | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 7.04 | 36.51 | 9.82 | 41.59 | 8.86 | 16.24 | ok |
| squares | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.34 | 1.33 | 0.41 | 1.56 | 0.97 | 2.08 | ok |
| squares | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 1.25 | 7.97 | 1.49 | 9.31 | 2.87 | 10.25 | ok |
| squares | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 2.59 | 12.01 | 3.19 | 14.00 | 6.09 | 14.06 | ok |
| flee | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.55 | 6.41 | 1.44 | 8.42 | 2.37 | 20.96 | ok |
| flee | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.34 | 11.35 | 1.17 | 14.43 | 1.74 | 29.17 | ok |
| flee | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.18 | 10.43 | 0.61 | 14.68 | 1.05 | 31.55 | ok |
| current | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 10.82 | 13.29 | 14.37 | 18.01 | 32.12 | 36.83 | ok |
| current | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 21.44 | 25.02 | 27.43 | 31.34 | 42.70 | 48.60 | ok |
| current | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 7.91 | 10.13 | 12.92 | 15.41 | 23.05 | 27.02 | ok |
| strings | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 20.64 | 28.31 | 30.08 | 39.73 | 34.74 | 38.43 | ok |
| strings | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 44.35 | 55.06 | 51.13 | 61.53 | 58.54 | 61.89 | ok |
| strings | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 30.32 | 39.75 | 41.39 | 52.84 | 42.20 | 44.79 | ok |
| fields | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 56.34 | 79.45 | 99.29 | 100.00 | 29.82 | 40.59 | ok |
| fields | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 61.54 | 81.17 | 100.00 | 100.00 | 33.82 | 42.74 | ok |
| fields | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 56.59 | 81.94 | 99.66 | 100.00 | 30.49 | 43.09 | ok |
| brush | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 3.20 | 24.52 | 3.89 | 25.39 | 20.40 | 53.10 | ok |
| brush | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 4.61 | 29.33 | 5.66 | 30.13 | 22.80 | 57.28 | ok |
| brush | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 4.82 | 19.98 | 6.02 | 20.74 | 22.04 | 51.34 | ok |
| blocks | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 21.71 | 24.27 | 23.41 | 26.73 | 32.38 | 44.55 | ok |
| blocks | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 36.23 | 39.63 | 36.93 | 40.96 | 42.18 | 53.44 | ok |
| blocks | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 37.86 | 40.17 | 40.23 | 42.91 | 34.57 | 43.24 | ok |
| riley | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 51.81 | 54.02 | 52.84 | 56.38 | 85.79 | 83.57 | ok |
| riley | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 51.96 | 53.90 | 53.30 | 56.49 | 83.11 | 81.29 | ok |
| riley | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 51.57 | 53.50 | 52.86 | 56.25 | 79.37 | 76.99 | ok |
| halftone | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 7.97 | 13.07 | 12.94 | 19.47 | 23.06 | 28.59 | ok |
| halftone | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 31.77 | 64.70 | 39.96 | 74.56 | 55.96 | 74.66 | ok |
| halftone | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 21.01 | 52.20 | 27.61 | 61.09 | 42.13 | 55.68 | ok |
| fifths | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 5.26 | 8.48 | 7.38 | 13.72 | 16.91 | 20.75 | ok |
| fifths | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 11.52 | 15.93 | 12.96 | 17.53 | 29.78 | 44.25 | ok |
| fifths | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 10.69 | 15.88 | 12.90 | 18.01 | 30.31 | 38.95 | ok |
| suprematism | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.66 | 5.54 | 99.92 | 98.63 | 7.23 | 25.60 | ok |
| suprematism | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 2.65 | 10.50 | 99.40 | 96.20 | 16.32 | 39.69 | ok |
| suprematism | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 3.01 | 9.29 | 99.49 | 97.38 | 17.22 | 32.21 | ok |
| contours | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 5.71 | 16.19 | 11.11 | 23.89 | 15.94 | 31.98 | ok |
| contours | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 13.67 | 30.89 | 21.41 | 38.56 | 23.90 | 43.68 | ok |
| contours | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 8.32 | 26.17 | 14.08 | 33.87 | 16.42 | 36.39 | ok |
| tunnel | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.22 | 71.82 | 0.87 | 82.97 | 1.43 | 41.60 | ok |
| tunnel | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.05 | 37.64 | 1.00 | 46.59 | 0.80 | 37.17 | ok |
| tunnel | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.01 | 35.33 | 0.58 | 49.77 | 0.56 | 27.18 | ok |
| scribble | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 4.95 | 19.74 | 6.78 | 22.87 | 20.59 | 43.22 | ok |
| scribble | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 6.24 | 23.01 | 8.56 | 25.68 | 23.27 | 49.15 | ok |
| scribble | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 3.35 | 15.15 | 4.52 | 17.59 | 18.21 | 40.90 | ok |
| pointillism | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 6.89 | 19.16 | 10.79 | 25.50 | 17.75 | 31.22 | ok |
| pointillism | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 10.84 | 22.77 | 15.97 | 27.48 | 20.61 | 33.74 | ok |
| pointillism | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 2.76 | 11.71 | 6.08 | 20.16 | 9.59 | 20.15 | ok |
| casket | lil-wayne-bells-visualizer | 80.000–96.000 | 5.000 | 1261/1261 | 245/245 | 0.11 | 0.81 | 0.15 | 1.12 | 1.01 | 4.33 | ok |
| casket | prelude | 118.000–134.000 | 5.000 | 1261/1261 | 262/262 | 0.10 | 0.72 | 0.13 | 1.01 | 0.83 | 4.18 | ok |
| casket | chopin-winter-wind | 116.000–132.000 | 5.000 | 1261/1261 | 328/328 | 0.16 | 0.48 | 0.22 | 0.66 | 1.73 | 3.18 | ok |

9 pair(s) have findings; 0 pair(s) remain unchecked. Findings produce a non-zero exit status.
