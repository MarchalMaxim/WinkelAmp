# Chopin, Nocturne Op. 48 No. 1 in C minor: the first half, for micro scenes

The recording is `songs/chopin-nocturne-48-1` (381.6 s; the notes end at about 356 s). This file covers the first half: the
lento theme and its returns, and the C major chorale with its octave storm, up to where the doppio movimento begins. A sibling
session covers the rest. The pick sets are in `picks-a.json` (made by `gen-picks-a.mjs`), and the five shows are made by
`build-shows-a.ts`.

**Note source.** All 3044 YourMT3 rows are labelled "Acoustic Piano", so strands are told apart by register and by role, never
by instrument. Velocities come from the nearest pack note (the piano model), as the note picker does it. Where no pack note is
near, they come from the loudness curve instead, as in `rach-concerto-2/gen-picks.mjs`. Within a scene every note belongs to
one set only, and the generator checks this: the melody is taken first, and the pulse and inner sets are what is left.

## The boundary

| s | what |
|---|---|
| 237.82 | the last C chord of the octave storm |
| 238.2–239.7 | single G/C pedal notes: the lead-in |
| **239.98** | **doppio movimento: the first agitato triplet chord (G2-C3-C4)** |
| 241.49, 242.80, 243.91 | the theme returns on top, G5-Ab5-G5 |

Every clip of the first half ends by **238 s** (`build-shows-a.ts` throws past it). The number is also in the shared notes
folder (`nocturne-boundary-from-micro-a.md`).

## Sections (seconds)

| s | section | what you hear |
|---|---|---|
| 0–3.6 | silence | |
| 3.66–22.2 | **A1, theme (a)** | Lento, C minor. The pulse: a bass octave on the beat (C2/C3), then a soft chord off the beat. Above it the melody: G5, Ab5, G5 (5.06, 7.58, 9.55), one per bar, then the rising line D5-Eb5-F5-Eb5-D5-Eb5-F5-G5 (10.8–13.2), and its fall to G4 (18–20). |
| 23.57–40.9 | **A1, theme (a')** | The same start again (G5 24.72, Ab5 26.90, G5 28.73) over a bass that climbs Eb-Ab-Bb-B-C-D, now with a **turn** (Eb-F-Eb-F-Eb-D-Eb-F-G, 30.8–32.3). It closes on G at 40.87. |
| 40.9–62 | **A2, the middle phrase** | Quieter and modulating (G-F#-F bass, C#5-F5-Bb5, Ab5, 46–51). It swells to C6 at 57.5 (v89–93) and falls back. |
| 62–85 | **A2, the theme varied** | B4-C5-D5-Eb5 again, then G5-Ab5 (72–74) and a second turn (76.2–77.3). |
| 85–100 | **A3, the theme again** | G5, Ab5, G5, F5 (85.4–91.4), with the turn at 92.2–93.8. |
| 100–117.6 | **A3, the climax** | Turn C5-D5 (101.3), rise B4-C5-D5-Eb5 to **C6 at 104.21** (v93, the top of the section), chromatic fall B5-Bb5-A5-Ab5-F5 to Ab4 (105.9–107.3), new climbs to G5 (109.9) and Bb5 (111.4), cadence **C1/C2 at 117.60** (v88). |
| 118.9–123 | **the link** | One quiet voice alone: Bb3, A3, F#3, Ab3/F3. |
| 123.65–142 | **B, the chorale, poco più lento** | C major, soft (v35–70), in the middle register: held chords, slow roots (C2, G1, G2, A1). |
| 142–192 | **B, the chorale grows** | The chords are now arpeggiated, with a rising top line (E5, G5 153.3; A5 163.8; F#5 168; B5 172.6; B5 175.9) and a walking bass. Loudest around 168–177 (v91). |
| 192–238 | **B, the octave storm** | Octave triplets (G-G-G-Ab-Ab-Ab-G-G, 193.2–194.4), chromatic octave runs (198–199.6, 202.4–203.6, 206.7–209.4, ...), chords in four octaves. The climb A2-Bb2-B2-C3-C#3-D3 under G-F-G chords (217.2–218.4), the v99 chord at 219.00, the G/A octave tremolo (219.7–221.5), the fff chords from 221.95 to the F6 at 224.02 (v101), the octave melody falling from C7 (225.5–227.8), and the last run down to the C at 237.82. |

Loudness, from `pack.loudness` (10-s means, relative): about 0.7 through A1–A2, 0.86–0.93 at the A3 climax, 0.6–0.7 in the
early chorale, 0.8–1.0 from 190 s to the boundary.

## The five micro scenes

Each one is a window of about 10 s, a separate show `shows/nocturne-micro-a<n>-<slug>.json`. Each widget hears its own set, and
fields (the ground) hears everything. The layers are drawn bottom to top in this order: ground, bass, pulse, counter or
sparkle, lead. The one exception is a5, where the lead (fireworks) is drawn under pluck and hammer on purpose, so their fine
lines stay visible over its smoke.

| show | window (s) | sets → widgets |
|---|---|---|
| `nocturne-micro-a1-lantern-and-keys` | 3.0–14.4 | a1-melody-head → current · a1-melody-rise → ivory (lead) · a1-chords → hammer · a1-bass → squares-snap · fields |
| `nocturne-micro-a2-slabs-and-threads` | 23.0–34.0 | a2-melody → handover (lead) · a2-turn → pluck · a2-chords → squares-snap · a2-bass → hammer · fields |
| `nocturne-micro-a3-ivory-peak` | 101.2–111.4 | a3-rise, a3-fall → ivory ×2 (lead) · a3-after → hammer · a3-chords → fireworks-snap · a3-bass → squares-snap · fields |
| `nocturne-micro-a4-lantern-into-the-chorale` | 117.0–127.8 | a4-voice → current (lead) · a4-chorale → crimp · a4-bass → squares-snap · fields |
| `nocturne-micro-a5-octave-storm` | 216.6–227.8 | a5-chords → fireworks-snap (lead) · a5-octaves → interlock · a5-arpeggio → pluck · a5-descent → hammer · fields |

Each set's rule and the reason for it are written in `picks-a.json`.
