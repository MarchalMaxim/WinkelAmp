# Chopin, Nocturne Op. 48 No. 1: the second half, for micro scenes

The recording is `songs/chopin-nocturne-48-1`: 381.6 s, with its notes ending at 357.7 s.
- `gen-picks-b.mjs` writes `picks-b.json`.
- `build-shows-b.ts` writes `shows/nocturne-micro-b*.json`.

Times are in seconds. What worked and what didn't is in [../STYLE.md](../STYLE.md).

## Form

The second half starts at **239.98 s**, the doppio movimento. Before it, the chorale's ff octave triplets (205–236 s, the
loudest of the piece) close on C and G in the bass. After it, the theme returns sotto voce over restless chords, and the
mean velocity drops from 75 to 54.

| s | what |
|---|---|
| 240–265 | Doppio movimento: the theme over triplet chords, p and agitated |
| 265–285 | The theme again, building to C6 |
| 285–313 | Climax: the theme in ff octaves over full chords. The loudest 10 s are 289.5–299.5; the hardest stroke is G5 v104 at 304.09 |
| 313–328 | Collapse: bass octaves toll, a broken chord flares to Ab5 (318.5–320.5), a recitative sinks Ab4–F4 (324.7–327.7) |
| 328–336 | Pedal on C, fading |
| 337–346 | The last climb: one voice alone, G3 to C6 (345.79) |
| 351–358 | Three pp C minor chords |

## Note sources

- **Melody:** the roll's loud tops, leaving out the notes only YourMT3 has (mostly a held note split into repeats).
  Where the tune shares its register with chords, use the held, voiced-out pack notes instead.
- **Bass:** `pack.notes`, on its beats: the lowest note of a cluster with nothing lower in the 0.8 s before or 0.3 s after.

## Scenes (all liked)

| show | window | sets → widgets |
|---|---|---|
| nocturne-micro-b2-fire | 294.3–301.5 | b2-p1, p2 (the ff theme's first two phrases) → Ivory rows; b2-chords (≥ 4 notes, loudest ≥ 88) → fireworks-snap; b2-bass → squares-snap; fields |
| nocturne-micro-b3-collapse | 315.2–327.6 | b3-flare → Ivory; b3-sink → handover; b3-inner → crimp; b3-bells → small squares-snap; on black |
| nocturne-micro-b4-climb | 335.7–348.3 | b4-line → huddled Ivory; b4-turns (F#4, B4, F#5, Bb5, C6) → current; b4-bass (C1, Ab2, Ab1) → hammer, intensity 1.8; dim fields |

Check the scenes on stills, not mp4s, because rendering mp4s costs too much GPU. Open
`render.html?show=<id>&hz=60&scale=1`, wait for `renderReady`, then `renderSeek(start - 3, 1)` and step with `renderTo(t)`.
