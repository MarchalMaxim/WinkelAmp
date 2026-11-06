# Rachmaninoff, Piano Concerto No. 2, I. Moderato: analysis for a full show

The recording is `songs/rach-concerto-2` (706.0 s). This file locates the movement's form in its seconds, maps the
recurring themes, and lists the striking moments. Candidate note sets are in `picks.json`, next to this file.

## How this was made (rerunnable)

The scripts are in the session scratchpad. It is a temp folder and may not outlive this session; copy the scripts
somewhere lasting if they need to be rerun later:
`C:\Users\maxim\AppData\Local\Temp\claude\ddced1252f75d39e\e34031ed-c5c2-4339-99cb-b28ca64cd6a8\scratchpad`

- `gen-picks.mjs` writes `picks.json`. It is self-contained and deterministic: `node gen-picks.mjs [worktree]`.
  It throws if a set breaks the show format: a non-slug id, unsorted notes, a bad note, or notes outside its from/to.
- `sections.mjs` prints the section table and the 10-s profile below. It needs `lib.mjs` in the same folder.
- The exploration tools are `sky.mjs` (skyline melody), `search3.mjs` (theme search in any key), `fine.mjs` (1-2 s
  statistics), `chords.mjs` (chord lists), `moments.mjs` (deep notes, trills) and `runs.mjs` (fast runs).
- `validate.ts` puts every set in a throwaway show, one clip per set over its from/to, and runs `validateShow` on it.
  Run it with the worktree's `node_modules/.bin/tsx`. Result: 0 errors, 0 warnings.

**The note source matters.** `pack.json` has no instrument tracks, and its 9094 notes come from a piano-only model
(bytedance), so the string themes are mostly missing from it. For example, the viola's Eb at 45.25 s is not there. The
note picker therefore shows YourMT3's 10110 labelled rows (`notes.ymt3.json`). Each row takes the velocity of the
nearest same-pitched pack note within 80 ms, or 70 when there is none (`pickerNotes` in
`src/studio/ui/picker-logic.ts`). The user's own sets p1-p18 are such roll notes.

`picks.json` uses the same roll, with one change. Where the picker would guess 70, the velocity comes from the
loudness curve instead: `v = clamp(25 + 85 * loudness(t), 20, 115)`. That way the horn solo is soft and the
recapitulation strings are loud. The picker matches picks by pitch and time (50 ms), so these notes appear on its roll.

Seven sets are marked `"source": "pack"` and use `pack.notes`, because YourMT3 misses those notes. They are the deep
bass, the trill, the coda sweep and the final chords. Some of their notes show in the picker as not found on the roll
(see Uncertain).

Velocity numbers in the tables are pack velocities from the piano model. Loudness is `pack.loudness`, which saturates:
it is around 0.5 in quiet orchestral passages, so read it relatively.

## 10-second profile

Each row: start second, pack notes per second, mean velocity, mean midi pitch, mean loudness, and a bar of the loudness.

```
  0   0.7  30  54 0.05 ##
 10   2.7  52  55 0.29 #########
 20   2.0  80  56 0.58 #################
 30   2.9 104  53 0.80 ########################
 40  14.4  80  53 0.89 ###########################
 50  14.9  83  54 0.83 #########################
 60  15.2  73  57 0.79 ########################
 70  12.9  83  57 0.76 #######################
 80  19.7  89  58 0.89 ###########################
 90  13.7  75  60 0.83 #########################
100  12.3  69  59 0.77 #######################
110   8.7  61  56 0.65 ####################
120  18.2  73  67 0.71 #####################
130  20.1  79  61 0.79 ########################
140   1.8  70  63 0.74 ######################
150   6.4  51  62 0.50 ###############
160   6.1  57  57 0.44 #############
170   5.0  53  59 0.51 ###############
180   6.7  59  63 0.62 ##################
190   5.8  64  57 0.56 #################
200   5.8  53  61 0.51 ###############
210   8.2  67  65 0.70 #####################
220  12.6  79  68 0.70 #####################
230  15.9  80  71 0.82 #########################
240  12.5  86  68 0.82 #########################
250   7.6  70  66 0.71 #####################
260   6.9  52  63 0.60 ##################
270   6.2  47  66 0.51 ###############
280   7.0  52  78 0.51 ###############
290  10.5  59  72 0.55 ################
300  24.0  74  71 0.77 #######################
310  21.7  72  63 0.76 #######################
320   7.0  48  57 0.63 ###################
330   8.4  48  58 0.68 #####################
340  18.1  73  71 0.72 ######################
350  26.1  80  71 0.79 ########################
360  20.7  81  71 0.83 #########################
370  20.0  78  68 0.82 #########################
380  24.5  83  69 0.85 ##########################
390  43.7  89  74 0.93 ############################
400  35.6  91  72 0.96 #############################
410  37.9  89  70 0.92 ############################
420  28.5  93  69 0.86 ##########################
430  26.0  94  71 0.83 #########################
440  17.0  84  68 0.76 #######################
450   9.1  78  58 0.61 ##################
460  12.4  83  60 0.73 ######################
470  18.1  80  66 0.80 ########################
480  18.0  62  65 0.67 ####################
490  15.8  57  61 0.62 ###################
500  11.6  60  54 0.59 ##################
510   9.0  52  47 0.57 #################
520   2.8  36  60 0.50 ###############
530   4.4  31  65 0.51 ###############
540   6.7  27  56 0.54 ################
550   9.6  43  53 0.65 ####################
560  13.8  56  59 0.78 #######################
570  10.0  41  65 0.57 #################
580   8.5  44  69 0.43 #############
590   7.3  47  73 0.47 ##############
600   8.0  56  75 0.53 ################
610   4.5  49  70 0.46 ##############
620   5.9  62  72 0.52 ################
630   8.0  67  67 0.65 ####################
640   9.2  61  69 0.68 #####################
650  11.2  43  65 0.62 ###################
660  12.5  52  62 0.61 ##################
670  13.3  53  63 0.65 ####################
680  17.9  79  62 0.80 ########################
690  19.2  87  66 0.90 ###########################
700   0.0   0     0.52 ################
```

## The form, in this recording's seconds

Two things placed the themes. The theme search (`search3.mjs`) compares interval sequences, so it finds a melody in any
key. The harmony track (`pack.harmony`) gave the keys: C minor for 40-140 s, E-flat for 141-215 s and 224-253 s, and
C minor again from 421 s.

The boundaries mostly agree with `pack.sections` (77, 139.5, 216.5, 224, 255.5, 343.5, 449, 574, 616.5, 650.5 and
697 s), but not always.

| # | Section | Seconds | Character | Recalls |
|---|---|---|---|---|
| 0 | **Intro: the bells** | 0-40.3 | Silence to 5.2 s. Then eight piano chords over a low F, one every ~4.1 s (5.18, 10.41, 15.50, 19.86, 24.15, 28.27, 32.33, 36.29), from pp (v39) to ff (v109). Then bass tolls: Ab1 at 37.24, F1 at 38.23, G1 at 39.37. | Origin of the bell motif |
| 1 | **A: Theme 1** (C minor) | 40.3-76.1 | C minor arrival at 40.30/40.52. The piano starts its arpeggio waves, with a low C1 struck every ~1.5 s (40.5-58.8). The theme is in the low strings (violas/cellos): head 45.2-55.0, answer 55.5-66.0, cadential tail to 76.0. A piano run (Bb2 to Ab4) follows at 76.1. | Bells, as the C1 pulse |
| 2 | **A': Theme 1 continued** | 76.1-112.5 | The strings climb by step from 78.2 to D5 at 91.2. First ff swell: C#1/C#2 v111 at 79.9 and Ab5 v112 at 87.3. Then a long descent, 92-111, from C5 back to C4. | A |
| 3 | **T: Transition** (più mosso) | 112.5-141.5 | Piano-led. Mid-register figures 113-126, high runs up to C7 127-134, then an orchestral tutti, ff, 135-141, with chords at 137.14 and 140.5. | - |
| 4 | **Bridge** | 141.5-151.4 | Near silence: no piano from 143.2 to 150.5. A clarinet/viola line held on G4. | - |
| 5 | **B: Theme 2** (E-flat major) | 151.4-179.2 | The piano alone (96% of the roll), p-mp (velocity mean 53). Head 151.5-163: Bb-Eb-F-G-Ab-G-F-Eb-D-Eb-C-D-B-Bb. Tail 163-179. | - |
| 6 | **B2: Theme 2 again** | 179.2-222 | Same pitches from 179.3 (Eb5), fuller. Strings take the line 200-222 and it opens out (208-216). | B |
| 7 | **B-climax** | 222-253.5 | The second-theme group's passionate climax. Piano ff and high (centroid 69), G6 v114 at 231.2. Hammered chords 244-252. | B |
| 8 | **Codetta** | 253.5-276 | Clarinet answers over a soft piano. Harmony moves to C/Cm/Fm/G. | - |
| 9 | **Close of the exposition** | 276-298 | High piano filigree, pp. The highest notes of the movement: G7 at 286.75, F7 at 284.8 and 288.2. | - |
| 10 | **D1: Development opens** | 298-321.5 | Dense piano figuration (22 notes/s). Horn, bassoon and oboe calls 300-303, strings 304-313. | - |
| 11 | **D2: Orchestra alone** | 321.5-342 | The piano drops out (4% of the roll). Quiet low strings and oboe turn Theme 1's falling cell over: C-Bb-Ab-Bb-G at 324.9-326.8, again around 333. | A (fragment) |
| 12 | **D3: Agitato build** | 342-388 | The piano returns, dense (21 notes/s), high (centroid 70), accents at v100+. The beat tracker shows the tempo pushing (111-114 bpm at 346-366), then broadening (104-108 at 377-396). | - |
| 13 | **Climax** | 388-421.5 | A full-keyboard chord storm, fff. The densest (39 notes/s) and loudest stretch: loudness 1.00 at ~398-404. Loudest note: C7 v117 at 407.55, over C#1 at 407.45. Trill F#5-G5 at 417.1-418.7. G-dominant chords 420-421.5. | Bells (a chord storm over deep strokes) |
| 14 | **A'': Recapitulation, alla marcia** | 421.5-446 | Theme 1 returns in the strings an octave higher, ff: head 423.8-433.8, answer 434-445.3. Against it, the piano's march chords (v100-113) and bass octaves. | **A**, the same phrase shapes |
| 15 | **A'' continued** | 446-480 | The piano carries the rising continuation, as the strings did in A' (F4 rising to D6 at 475). D1 at 475.19, falling run F5 to C3 at 478. | A' |
| 16 | **Dissolve** | 480-521.5 | Decrescendo, and the register sinks (centroid 66 to 42). The bass walks down C2-F#1-G1...G1. | - |
| 17 | **B': Theme 2 in the horn** (A-flat) | 521.5-556 | Horn solo a fifth lower: Eb-Ab-Bb-C-Db-C-Bb-Ab-G-Ab-F-G-E from 522.4. The piano is silent. The softest stretch of the movement (velocity mean 32). Strings re-enter at 550.9. | **B**, the same intervals |
| 18 | **B'': Theme 2 echoes** | 556-575 | Theme-2 fragments pass between clarinet, violins, oboe and piano; swell to 0.84 at 564-566. | B |
| 19 | **Meno mosso** | 575-615.9 | Dreamy high piano (centroid 72, pp), slow; the harmony drifts (Eb, D, F#m, A, C#). A near-pause 613.8-616. | Close (9), high register |
| 20 | **Coda I** | 615.9-656 | Low C1 at 616.04, then a C-major arpeggio sweeping up to C7 (616.5-618.2). High piano with winds 618-642. Rising C-minor scale 643.7-646.1 into a peak 646-649. | - |
| 21 | **Coda II** | 656-694.6 | Steady figuration getting denser (12 to 19 notes/s) and louder from 680; chords from 685.5; the strings' rising scale A4 to G5 at 692.3-694.5. | - |
| 22 | **Final chords** | 694.6-706 | C1-C7 ff at 694.77 (v114), then 695.36, 695.67, 695.96. No notes after 696.2; 696-706 is the decay. | Bells (the last strokes) |

### Numbers per section

These come from `sections.mjs`. Notes per second, velocity and pitch come from `pack.notes`. "bass %" is the share of
onsets below E2. "str/pno/wind" is the share of the YourMT3 roll by instrument family.

The beat tracker sits at ~109 bpm wherever it finds a pulse, so its median says little. The local tempo changes are
given in the D3 and Climax rows above.

| Section | s | notes/s | vel mean / max | loudness mean / max | pitch centroid | bass % (<E2) | str/pno/wind % |
|---|---|---|---|---|---|---|---|
| Intro | 0-40.3 | 2.1 | 76 / 112 | 0.43 / 0.90 | 55 | 12 | 0/100/0 |
| A | 40.3-76.1 | 14.4 | 79 / 105 | 0.82 / 0.94 | 55 | 10 | 17/73/0 |
| A' | 76.1-112.5 | 14.8 | 80 / 112 | 0.82 / 0.92 | 59 | 6 | 33/61/0 |
| T | 112.5-141.5 | 15.8 | 75 / 109 | 0.73 / 0.92 | 63 | 3 | 40/60/0 |
| Bridge | 141.5-151.4 | 1.2 | 39 / 58 | 0.68 / 0.91 | 59 | 8 | 24/5/71 |
| B | 151.4-179.2 | 5.9 | 53 / 92 | 0.48 / 0.56 | 59 | 4 | 4/96/0 |
| B2 | 179.2-222.0 | 6.8 | 60 / 101 | 0.59 / 0.75 | 62 | 2 | 15/85/0 |
| B-climax | 222-253.5 | 13.7 | 83 / 114 | 0.80 / 0.86 | 69 | 3 | 9/91/0 |
| Codetta | 253.5-276.0 | 5.8 | 51 / 83 | 0.59 / 0.78 | 62 | 4 | 0/80/20 |
| Close | 276-298.0 | 8.0 | 53 / 88 | 0.52 / 0.58 | 74 | 4 | 1/97/2 |
| D1 | 298-321.5 | 21.7 | 72 / 97 | 0.74 / 0.81 | 66 | 2 | 16/82/3 |
| D2 | 321.5-342.0 | 7.2 | 48 / 76 | 0.66 / 0.74 | 59 | 7 | 79/4/6 |
| D3 | 342-388.0 | 21.5 | 79 / 107 | 0.80 / 0.88 | 70 | 0 | 27/72/1 |
| Climax | 388-421.5 | 39.4 | 89 / 117 | 0.94 / 1.00 | 72 | 1 | 39/61/0 |
| A'' | 421.5-446.0 | 26.0 | 93 / 113 | 0.83 / 0.90 | 71 | 2 | 29/71/0 |
| A'' cont. | 446-480.0 | 12.4 | 79 / 109 | 0.71 / 0.85 | 62 | 4 | 19/81/0 |
| Dissolve | 480-521.5 | 13.3 | 58 / 93 | 0.61 / 0.73 | 59 | 4 | 16/83/1 |
| B' | 521.5-556.0 | 5.2 | 32 / 60 | 0.55 / 0.74 | 59 | 4 | 15/0/85 |
| B'' | 556-575.0 | 12.7 | 51 / 88 | 0.70 / 0.85 | 57 | 5 | 24/67/9 |
| Meno mosso | 575-615.9 | 7.7 | 47 / 90 | 0.48 / 0.56 | 72 | 0 | 5/93/1 |
| Coda I | 615.9-656.0 | 7.8 | 59 / 99 | 0.61 / 0.76 | 68 | 2 | 5/92/3 |
| Coda II | 656-694.6 | 16.6 | 67 / 108 | 0.70 / 0.92 | 63 | 1 | 18/82/0 |
| Final | 694.6-706.0 | 3.1 | 99 / 114 | 0.71 / 0.97 | 60 | 19 | 43/57/0 |

## Recurrence map

This is what should get the same visual theme each time. Pick sets with the same `pair` value hold the same phrase,
with the same note-set shape, at each statement.

- **Theme 1, head phrase** (`pair: t1-head`):
  - **A** at 45.9-55.2, low strings: `t1-head-a`. The phrase's Eb3-D3 pickup at 45.25-45.7 is left out so it
    starts like the recap.
  - **A''** at 423.8-433.8, strings an octave higher, ff, with the march: `t1-head-a3`. Same melody: D-C-Bb-Ab-Bb-G,
    C-D-Eb-D-Eb-D-C-Bb-Ab-G-F. The interval search matches it exactly at 49.3 s and 427.9 s.
- **Theme 1's falling cell** (`pair: t1-cell`): a dark echo in **D2**, 321.5-342 (`t1-dev-frag`). It is a
  fragment, not the whole phrase.
- **Theme 1, answer** (`pair: t1-answer`): A at 55.5-66.0 (`t1-answer-a`), A'' at 434-445.3 (`t1-answer-a3`). Both
  climb to Ab and fall back to C.
- **Theme 1, rising continuation** (`pair: t1-rise`): A' at 76.2-92 in the strings (`t1-rise-a2`), A'' cont. at
  448-476 in the piano (`t1-rise-a3`). Its falling half is at 92-112 (`t1-fall-a2`), with no recap counterpart.
- **Theme 2, head** (`pair: t2-head`), found by the interval search with no wrong intervals:
  - **B** at 151.4-159.5, piano, E-flat: `t2-head-b`.
  - **B2** at 179.2-187, piano, same pitches: `t2-head-b2`.
  - **B'** at 522-536.2, horn, A-flat: `t2-head-b3`.
- **Theme 2, tail** (`pair: t2-tail`): B at 159.5-179.2 (`t2-tail-b`), B' at 536.2-556, horn and bassoon then strings
  (`t2-tail-b3`), and its echoes in B'' at 556-575 (`t2-echo-b4`). The B-climax at 222-253 is theme 2's apotheosis:
  `t2-climax-line` and `t2-climax-chords`.
- **The bells** (`pair: bells` / `deep`):
  - The opening chords and tolls, 5.2-40.5: `bells`.
  - Continued as the low C1 pulse under A, 40.5-58.8: `c1-bells`.
  - Echoed by the deep strokes at the big arrivals: 79.9, 134.2, 407.45, 475.19, 616.04 and 694.77. These are the
    only notes at D1 or below after 59 s.
  - The climax chord storm (388-421) and the final chords (694.77-695.96) are their loudest descendants.

  This is an interpretation: the data shows the deep strokes, not a quotation of the opening chords.
- **The high register** (points of light): the close of the exposition, 276-298 (`filigree-high`); the Meno mosso,
  575-614 (`meno-high`); the sweep to C7, 616.5-618.2 (`coda-sweep`). These are the three pp passages that live above
  C6.
- **Ff chord blocks**:
  - Transition tutti, 135-141: `tutti-chords`.
  - B-climax, 244-252: `t2-climax-chords`.
  - Climax, 388-421: `climax-chords`.
  - March, 421.5-446: `march-chords`.
  - Final, 694.6-696.2: `final-chords`.

### How close the pairs are

Each line below gives the note count, then the semitone steps between consecutive notes.

```
t1-head-a     18  -2 -2 -2 2 -3 3 2 2 1 -1 1 -1 -2 -2 -2 -1 -2
t1-head-a3    17  -2 -2 -2 2 -3 5 2 1 -1 1 -1 -2 -2 -2 -1 -2
t1-answer-a   16  -2 2 -2 0 -2 -2 2 -3 5 8 -1 -2 -2 -1 -2
t1-answer-a3  17  -2 2 0 -2 -2 0 -2 2 -3 5 0 8 -3 -2 -1 -2
t2-head-b     13  5 2 2 1 -1 -2 -2 -1 1 -3 2 -3
t2-head-b2    13  7 2 2 1 -1 -2 -2 -1 1 -3 2 -3
t2-head-b3    13  5 2 2 1 -1 -2 -2 -1 1 -3 2 -3
```

- **Theme 2 heads.** Identical, except that B2's upbeat is a fifth instead of a fourth.
- **Theme 1 heads.** One passing note apart: the exposition has an extra Bb at 48.93, so its 3 2 is the recap's 5.
- **Theme 1 answers.** Same contour; the recap repeats two notes.

## Striking moments

1. **37.24 / 38.23 / 39.37, then 40.30-40.52 s.** The bell tolls Ab1, F1 and G1 (v112, v108, v110), then the C minor
   arrival with the first C1 (v99). The door opens.
2. **79.92 s.** C#1 + C#2 at v111, the deepest ff stroke of the first-theme swell. Ab5 v112 follows at 87.34.
3. **137.14 and 140.5 s, then 143.2-150.5 s.** The tutti's last chords, then 7 s with no piano: the sudden quiet
   before theme 2.
4. **151.50 s.** Theme 2's first note (Bb4), piano alone.
5. **231.21 s.** G6 v114, the top of the second theme's climax.
6. **286.75 s.** G7, the highest note of the movement, pp (v69), in the exposition's closing filigree.
7. **321.5-342 s.** The piano drops out entirely in the middle of the development: an absence, not a rest.
8. **398-405 s.** The loudest stretch (loudness 1.00). At **407.45-407.55 s**, C#1 under C7 v117: the loudest note of
   the recording.
9. **417.09-418.68 s.** The trill, F#5-G5, 17 strokes: the only real trill of the movement.
10. **421.9 / 423.45 s.** The recapitulation lands: march chords (C7 v113 at 423.45) under the returning theme.
11. **522.43 s.** The horn enters with theme 2 (Eb4): the quietest music of the piece, with velocities in the 20s and
    30s from 522 to 548 s.
12. **613.8-616.04 s.** A near-pause, then a low C1 and a C-major arpeggio sweeping six octaves to C7 at 618.19.
13. **643.7-646.1 s.** A rising C-minor scale, Eb4 to B5, into the coda's first peak.
14. **692.33, then 694.77 to 695.96 s.** The strings' rising scale, then the final chords: C1-C7 v114 at 694.77, then
    695.36, 695.67 and 695.96. Notes end at 696.2 s.

There are no long fast runs in the cadenza sense. The ones `runs.mjs` finds are short: 76.1-77.7 (Bb2 to Ab4),
383.1-385.3 (A5 to C4), 478.0-479.4 (F5 to C3), 616.8-617.8 (C3 to E6), 643.6 and 675.2-676.3.

## The user's own show, 0-168 s (`shows/rach-concerto-2.json`), as a taste reference

- **Ground.** `fields` on all notes, 4.1-168.2. Its knob `chords` is driven by +density. Its intensity curve is at 1
  until 53 s, about 0.2-0.4 for 62-77, back to 0.76 at 85.7, then fades to 0 at 151. `kline` on all notes, 36.3-42.6,
  marks the bells' climax and the arrival.
- **Theme 1 (A, 41-70 s).** The user gave the **bass** to `squares`:
  - p1: the first two bass strokes, C1 and G2, at intensity 2.
  - p2: the G1/G2 octave pulse, 8 notes.
  - p6: the bass line, E1 to D3, 23 notes.

  The **string melody** went to `gust`: p3, 23 notes from Eb3 to Ab4, viola and violin, each with a per-note
  intensity. p7 is a four-note repeated G2 from the piano under the gust's start.
- **The piano's run, 74-81 s.** `gliss` on p4 (the Eb4/F4 alternation at 74.9-75.5) and on p5 (the chord and run at
  76.7-78.9).
- **A' (78-108 s).**
  - `kline` on p11: the strings' rising line, 39 notes.
  - `squares` on p9: the piano's ff high notes at 80.4-81.6.
  - `casket` on p8: four notes, G4/G5, at 83.6-84.6, intensity 2.
  - `gliss` three times on string chords and lines: p10 at 85.4-88.4, p12 at 88.4-91.2, and p13, the descent at
    93-107 (41 notes).
- **Transition (115-144 s).**
  - `ivory` on p14: the piano's mid-register melody at 116-124.
  - `halftone` on p15: 95 high run notes at 127-134.
  - `kandinsky` on p16 (76 piano notes) and on p17 (the strings' Eb3/G3 tremolo at 133.7-139).
  - `fireworks` on p18: the ff tutti chords at 137-143. Its notes carry intensity and a per-note `size` knob.
- **What this says.** Dark, weighty widgets (`squares`) belong to the bass. Flowing ones (`gust`, `gliss`, `kline`)
  follow the string lines. Explosive ones (`fireworks`) take the ff chords. Most of the user's sets carry per-note
  intensities; they range from 2 to 95 notes. The user's sets stop at 144.6 s, so theme 2 onward is open.
- **The marked melody.** The user also has a hand-marked melody, `melodies/rach-concerto-2.json`: 656 notes,
  40.3-143.1 s, all on the picker's roll. It is not a clean top line. The user marked bass and piano accompaniment too:
  336 piano, 280 string, 36 guitar and 4 other labelled notes, from midi 24 to 99. It was not used to build the sets here.

## The pick sets (`picks.json`)

There are 35 sets with 952 notes in all: 9 to 70 notes per set, and 5 to 45 attacks. `attacks` counts onset groups by
groupChords' 40 ms rule.

The file is a wrapper, `{ song, made, noteSource, sets: [...] }`. Each set has `id` (a valid slug), `name`, `why`,
`rule`, `section`, `pair`, `source`, `from`, `to`, `attacks` and `notes`.

The ff chord sets are thinned so they stay under 80 notes. `tutti-chords`, `climax-chords` and `march-chords` keep
each chord's lowest and highest note; `bells` keeps those two plus the chord's loudest. Each chord still fires as one
attack. `t2-climax-chords` (68 notes) and `final-chords` (36) keep whole chords.

The rule names in the table are defined below it.

| id | section | from-to | attacks | rule (short) |
|---|---|---|---|---|
| bells | Intro | 4.5-41 | 13 | pack chords of 3+ notes, outer voices and the loudest note |
| c1-bells | A | 40-60 | 11 | pack notes at or below D1 |
| t1-head-a | A | 45.9-55.2 | 18 | string skyline |
| t1-answer-a | A | 55.5-66 | 16 | string skyline |
| t1-rise-a2 | A' | 76.2-92 | 23 | string skyline |
| t1-fall-a2 | A' | 92-112 | 26 | string skyline, minimum 0.25 s |
| trans-accents | T | 113-135 | 31 | top of piano clusters with velocity >= 88 |
| tutti-chords | T | 134.5-142 | 28 | chords of 3+ notes with velocity >= 88, outer voices |
| bridge-winds | Bridge | 141.5-151.4 | 11 | non-piano skyline, minimum 0.3 s |
| t2-head-b | B | 151.4-159.5 | 13 | skyline at midi >= 60 |
| t2-tail-b | B | 159.5-179.2 | 19 | skyline at midi >= 60, minimum 0.3 s |
| t2-head-b2 | B2 | 179.2-187 | 13 | skyline at midi >= 60 |
| t2-climax-line | B-climax | 222-244 | 36 | piano skyline, velocity >= 84 |
| t2-climax-chords | B-climax | 244-253.5 | 14 | chords of 3+ notes with velocity >= 90 |
| codetta-clarinet | Codetta | 253.5-276 | 27 | wind skyline |
| filigree-high | Close | 276-298 | 24 | piano skyline at midi >= 86 |
| t1-dev-frag | D2 | 321.5-342 | 32 | string skyline at midi >= 48 |
| agitato-accents | D3 | 342-388 | 34 | top of piano clusters with velocity >= 100 |
| climax-chords | Climax | 388-421.5 | 29 | chords of 4+ notes with velocity >= 110, outer voices |
| climax-trill | Climax | 416.9-418.8 | 18 | pack F#5/G5 |
| t1-head-a3 | A'' | 423.8-433.8 | 17 | string skyline at midi >= 55 |
| t1-answer-a3 | A'' | 434.05-445.3 | 17 | string skyline |
| march-chords | A'' | 421.5-446 | 35 | piano chords of 4+ notes with velocity >= 107, outer voices |
| march-bass | A'' | 421.5-446 | 18 | pack lowest note at or below C3, velocity >= 70 |
| t1-rise-a3 | A'' cont. | 448-476 | 45 | piano skyline at midi >= 62 |
| descent-bass | Dissolve | 492-521.5 | 22 | pack lowest note at or below D2 |
| t2-head-b3 | B' | 522-536.2 | 13 | wind skyline |
| t2-tail-b3 | B' | 536.2-556 | 13 | non-piano skyline |
| t2-echo-b4 | B'' | 556-575 | 32 | skyline, minimum 0.35 s |
| meno-high | Meno mosso | 575-614 | 38 | piano skyline at midi >= 79 |
| coda-sweep | Coda I | 615.9-618.5 | 14 | pack, top of each cluster |
| coda-run | Coda I | 643.5-650 | 13 | piano skyline |
| coda-build | Coda II | 680-692.2 | 28 | top of piano clusters with velocity >= 90 |
| final-run | Coda II | 692.2-694.7 | 9 | string skyline |
| final-chords | Final | 694.6-697 | 5 | pack, whole chords |

**The rules:**

- **Skyline.** Take the top note of each 40 ms onset cluster. Skip a note if a note more than a tone higher, begun
  within 0.8 s, is still sounding; that drops accompaniment under a held melody note. Skip notes shorter than the
  set's minimum, 0.15 s unless stated; that drops ornaments. Merge a same-pitch repeat within 0.15 s; that drops
  doubled instruments.
- **Top of clusters.** One note per cluster: its highest.
- **Chords.** The whole cluster, which fires as one attack, or its outer voices where stated.
- **Bass.** The lowest note of each cluster below the threshold.

No set carries per-note intensities or knob values yet; the composer adds those, as the user did.

## Uncertain

- **The coda's start.** Coda I is marked at 615.9 s, after the pause and the C-major sweep. It could also be heard as
  starting at 656 s, where the steady figuration begins, with 616-656 as a continuation of the Meno mosso.
  `pack.sections` splits at 616.5, 629, 650.5 and 674.5.
- **The beat track and the coda's acceleration.** The beat track (479 beats, only where it locks) does not show an
  accelerando in the coda: 103 bpm at 672-681, 108 at 692-698. The coda accelerates in note density (12 to 19
  notes/s) and loudness. Whether the tempo also rises is not shown by the data.
- **Climax versus recapitulation.** The theme search puts the recap's Theme 1 head at 423.8 s, not at the loudness
  peak (398-405). I treat 388-421.5 as the development's climax and 421.5 as the recap. If you hear the recap starting
  at the 388 arrival, add the Climax to A''.
- **Theme 1 in D2 and A'' cont.** Theme 1's cell in D2 and the rising continuation in A'' cont. are resemblances, not
  exact matches. The exact interval matches are only 49.3/427.9 s for Theme 1 and 151.5/179.3/522.4 s for Theme 2.
  The search also found a one-interval match of Theme 1's "Bb-Ab-Bb-G-F, C-D" at 202.8 s in the strings, inside B2.
  It is probably a shared contour, not a quotation.
- **Instrument labels.** YourMT3 labels are approximate. "Clarinet" in the bridge (142-150) may be viola or clarinet;
  the horn solo is labelled French Horn and Clarinet alternately; Violin and Viola are often swapped.
- **Velocities.** About 27% of roll notes (2747 of 10110, mostly strings and winds) have no pack note near. Their
  velocity in `picks.json` comes from loudness, not from the note itself.
- **Pack-sourced sets in the picker.** Not all their notes are on the picker's roll:

  | Set | Notes on the roll |
  |---|---|
  | `bells` | 24 of 31 |
  | `c1-bells` | 1 of 11 |
  | `climax-trill` | 14 of 19 |
  | `march-bass` | 14 of 18 |
  | `descent-bass` | 16 of 22 |
  | `coda-sweep` | 13 of 14 |
  | `final-chords` | 22 of 36 |

  They play correctly, but the picker lists the rest as not found.
