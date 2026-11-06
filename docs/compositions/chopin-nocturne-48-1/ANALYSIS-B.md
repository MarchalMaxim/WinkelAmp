# Chopin, Nocturne Op. 48 No. 1 in C minor: the second half, for micro scenes

The recording is `songs/chopin-nocturne-48-1` (381.6 s, solo piano). Its notes end at 357.7 s, and the rest is the last chord
dying away. This file covers the second half only. A sibling session takes the first half: the opening theme and the C major
chorale.

- The pick sets come from `gen-picks-b.mjs`, which writes `picks-b.json`.
- The shows come from `build-shows-b.ts`, which writes `shows/nocturne-micro-b*.json`.

Both scripts are in this folder and rerunnable. Times are in seconds.

## Where the second half starts: 239.98 s

The C major chorale grows into a ff passage of octave triplets. That passage is the loudest stretch of the whole piece, at
loudness 1.00 from 205 to 236 s, and it is in the first half. It closes on C and G in the bass (C1 at 237.4 s, then C2/G2 to
239.5 s). At 239.98 s the doppio movimento begins (C4 on the off-beat, then Eb5 at 240.94 s): the C minor theme returns
sotto voce over restless repeated chords. Mean velocity drops from about 75 to 54. The micro-b scenes use nothing before
239.98 s.

## Sections (pack loudness, 5 s means; it saturates near 1)

| s | what | loudness | notes/s |
|---|---|---|---|
| 239.98–265 | Doppio movimento: theme over triplet chords, the left hand in triplets too, p and agitated | 0.77–0.88 | 14–24 |
| 265–285 | The theme again, building (up to C6 at 273.9) | 0.85–0.90 | 21–24 |
| 285–313 | The climax: theme in ff octaves over full chords | 0.93–0.98 | 19–24 |
| 313–328 | The collapse: bass octaves toll (F#1 315.5, F1 318.1, G1 321.2, 324.2), a broken chord flares to Ab5 (318.5–320.5), a recitative sinks Ab4-G4-F#4-F4 (324.7–327.7) | 0.80–0.94 | 5–8 |
| 328–336 | Pedal on C: G2/Eb3 tolls, fading | 0.55–0.75 | 2–3 |
| 337–346 | The last climb: one voice alone, G3 to C6 (345.79), Ab bass under it | 0.50–0.64 | 2 |
| 351–358 | Three pp C minor chords (351.25, 353.69, 357.62), Eb4 on top | 0.13–0.33 | – |

**The loudest passage of the second half.** The loudest 10 s by mean loudness is 289.5–299.5 s (0.979). The hardest single
strokes are at 302–312 s: nine notes of velocity 95 or more, including G5 v104 at 304.09 s, the loudest note of the half.
Scene b2 takes 294.3–305.6 s (mean 0.962), so it holds the theme's ff statement and the climb to C6 at 303.81 s with the
v104 stroke under it.

## Note sets (`picks-b.json`)

Melody notes are the loud tops. In the doppio movimento the theme is at v70–100 over chords at v35–65.

- **Skylines leave out the roll notes that the piano model lacks.** These "guessed" notes get a loudness velocity of about
  107 there. Most of them are a held note that YourMT3 split into repeats.
- **The bass comes from `pack.notes`.** YourMT3 fills it with guessed notes. On its beats, the bass is the lowest note of a
  cluster with nothing lower in the 0.8 s before or the 0.3 s after, which leaves out the left hand's own triplets.

| set | scene | attacks (per s) | what |
|---|---|---|---|
| b1-theme | b1 | 21 (2.4) | the theme's return: Eb5-Eb5-G5, C5-Ab5-G5, Eb5-F5-Eb5-Eb5-F5-G5-C5, C5-D5-C5 |
| b1-octave | b1 | 7 (1.0) | where the right hand doubles the theme an octave lower |
| b1-throb | b1 | 43 (4.3) | the repeated triplet chords, one note each (the top below the theme) |
| b1-bass | b1 | 16 (1.7) | the bass on its beats |
| b2-theme | b2 | 23 (2.5) | the theme ff, top of the octaves, up to C6 at 303.81 |
| b2-p1..p4 | b2 | 7, 6, 6, 4 | the same theme cut into its phrases: up to G5, three knocks and F5, falling back to C5, the leap to C6 |
| b2-chords | b2 | 10 (1.3) | full chords with loudest note ≥ 88, lowest and highest note of each |
| b2-bass | b2 | 9 (1.0) | the bass octaves ff (Eb, Ab, D, G, Eb1) |
| b3-bells | b3 | 6 (0.7) | the falling bass octaves F#1, F#1, F1, F2, G1, G1 |
| b3-flare | b3 | 7 (3.6) | C#4-F4-Ab4-C#5-E5-F5-Ab5 |
| b3-sink | b3 | 5 (2.3) | Ab4-G4-F#4-F4-F4 |
| b3-inner | b3 | 17 (1.6) | the inner chords that keep knocking (Eb3/Ab3, then D3/F3/Ab3/B3) |
| b4-line | b4 | 17 (1.9) | the lone climb, G3 to C6 |
| b4-turns | b4 | 5 (0.7) | its leaning notes F#4, B4, F#5, Bb5 and the arrival C6 |
| b4-bass | b4 | 3 | C1, Ab2, Ab1 |
| b5-top | b5 | 3 | Eb4 on top of each final chord |
| b5-body | b5 | 3 | Eb3/G3/C4 inside them |
| b5-bass | b5 | 3 | C2/C3 under them |

## The scenes

Each scene uses one window. Every clip in it spans the whole window, fades in over 0.3–0.35 s and hears only its own set,
trimmed to the window. Tracks go from the bottom up: ground, support, then the lead on top.

| show | window | combo |
|---|---|---|
| nocturne-micro-b1-agitato | 239.6–250.2 | Slabs over plucked threads: handover on the theme, hammer on its lower octave, pluck on the throb, squares-snap on the bass, fields under them |
| nocturne-micro-b2-fire | 294.3–306.3 | Keys through fire: four short Ivory rows, one per phrase of the ff theme (b2-p1..p4, each giving way as the next begins; the last stomps on C6), fireworks-snap on the full chords, squares-snap on the bass octaves, fields bright |
| nocturne-micro-b3-collapse | 315.2–327.6 | Bells, a flare and a sinking voice: small squares-snap bells on the bass octaves, Ivory on the flare, handover on the recitative, crimp on the inner chords, on black (no fields) |
| nocturne-micro-b4-climb | 335.7–348.3 | Keys climbing alone: Ivory on the lone line (squeezed into the middle 60 % by a region, so the keys huddle), current (one ball of light) on its leaning notes, hammer on the three low tolls, fields |
| nocturne-micro-b5-last-light | 350.6–360.6 | Last light: hammer on the top Eb4, mica on the inner notes, slow squares-snap on the bass C, fields low |

In b4 the hammer's three low tolls get intensity 1.8. In b5 the pianissimo chords get 2 (top and bass) and 1.5 (mica), with
the fields' `dyn` low, so that the marks survive the canvas burn at loudness 0.13–0.33.

The scenes were checked on still frames from `render.html` on the dev server (`renderSeek`/`renderTo`). Every widget showed
in each scene, with no widget errors.

## The user's verdicts (2026-11-06) and what changed

| scene | verdict | change |
|---|---|---|
| b1 agitato (239.6) | "meh": the shapes don't match the melody, and handover flashing on the agitated theme is too much ("epilepsy inducing") | show removed |
| b2 fire (294.3) | "great", but the Ivory sequences should be shorter | the theme is cut into four phrase sets (b2-p1..p4), each its own short Ivory row |
| b3 collapse (315.2) | good, but similar to b2. Fields are in too many scenes, and the snap squares are too much | fields dropped; squares smaller, shorter and dimmer |
| b4 climb (335.7) | good, but this theme doesn't come back often | kept as it is |
| b5 last light (350.6) | "very incongruent" | show removed |
