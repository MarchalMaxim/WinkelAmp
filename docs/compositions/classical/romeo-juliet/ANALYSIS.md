# Tchaikovsky, Romeo and Juliet (fantasy-overture, 1880): analysis of the six packs

One 20:25 recording (1225.1 s), cut at quiet points into six packs. Pack seconds are used everywhere below; add the
pack's offset for the original recording's time (RESEARCH.json `pieces`):

| pack | offset (s) | length (s) | what it holds |
|---|---|---|---|
| `romeo-juliet-1-friar` | 0 | 325.6 | the introduction: the Friar's chorale, the dark strings, the harp, the chorale's returns, the build, the climax, the hush |
| `romeo-juliet-2-feud` | 325.6 | 118.0 | the feud (Allegro giusto, B minor): syncopated strings, runs, the sword clashes; then the hushed transition |
| `romeo-juliet-3-love` | 443.6 | 221.0 | the love theme (English horn and violas), the sighs, the love theme in the winds and the full strings, the codetta, the balcony night |
| `romeo-juliet-4-clash` | 664.6 | 159.9 | the development: feud fragments against the Friar's chorale in the horns, the long build, the climax (the chorale in the trumpets), the hammered F#, the feud's return |
| `romeo-juliet-5-return` | 824.5 | 220.5 | the sighs in D major, the love theme ecstatic, the break, the feud, the catastrophe, the dying roll |
| `romeo-juliet-6-coda` | 1045.0 | 180.1 | the funeral march (timpani B every 1.23 s, the love theme broken), the consoling chorale, the love theme transfigured with harp, the hammered closing chords |

## How this was made (rerunnable, deterministic)

Everything is in this folder:

- `audio-events.py` (run with `C:/Users/maxim/.venvs/wa/Scripts/python.exe -I audio-events.py`) writes
  `<pack>/audio-events.json`: the level every 0.1 s (rms, 20-120 Hz band, 5-11 kHz band, strongest pitch class), the
  audio onsets (librosa, sensitive) with strength, level, pitch class and the low/high band jumps, the peaks of the
  5-11 kHz flux (cymbals, bright tutti accents) and of the < 150 Hz flux (timpani, bass strokes).
- `gen-picks.mjs` (`node gen-picks.mjs [tables.md]`) writes `<pack>/picks.json` as
  `{ "<set id>": { "hears": "...", "notes": [[start, end, midi, velocity], ...] } }`, notes sorted by start; with a path
  it also writes the per-pack tables below (sections with the sets sounding there, the sets, the holes, the weight
  table). It throws on a non-slug id, a duplicate or an empty set. Every set was put in a throwaway show (one clip per
  set, `"listen": "picks:<id>"`) and `check-show` passed all six (only the "too many clips" warning of the test show).

**Note sources.** The roll is `pack.tracks` (YourMT3+ by instrument: what the note picker shows on an ensemble pack and
what `"listen": "<track>"` hears). Velocities there are mostly loudness-derived (describe-song: "N from loudness"), so a
loud passage has loud notes but single accents are not marked: accents come from the audio. `pack.notes` (the piano
transcriber with YourMT3+ in its gaps) adds notes the roll lacks: the harp (labelled `piano`), deep bass, tutti chords.
Sets that read the audio say so ("from the audio"); there each audio event becomes the roll/pack notes struck within
60 ms (so the picker finds them), else one note on the event's pitch class in the register the set names, velocity
`20 + 2.4 * (dB + 60)`, clamped 15-122.

**The ear check.** Section names come from the loudness curve, the 5-11 kHz and < 150 Hz bands, chroma, the onsets, and
the transcribed lines read note by note (the chorale's voicing, the horn lines, the timpani's 1.23 s period), matched
against the overture's form. Times are to 0.1 s from the first attack or the loudness turn.

## The recurring themes, pack by pack (where a returning theme can get its picture back)

| theme | friar | feud | love | clash | return | coda |
|---|---|---|---|---|---|---|
| **Friar's chorale** (hymn, winds, slow chords) | `friar-chorale`, `friar-chorale-chords`: 2.1-34 (clarinets, bassoons, F# minor), 139.7-161 (oboe, clarinets, bassoons over pizzicato, F minor), 199-212 (woodwinds, C major) | - | - | `friar-chorale`: horns 17.1-18.0, 29.6-31.0, 51.4-55.6, 61.5, 72.7-76.1 (+ clarinet echoes to 79.5); `brass-blows`: 99.6-122 the trumpets ff (audio only) | - | `coda-chorale`, `coda-chorale-chords`: 49.7-101 (woodwinds and horns, B major): the chorale's consoling descendant |
| **Feud** (syncopated sforzandi, scurrying runs) | - | `feud-accents`, `feud-runs`, `feud-violins`: 0-98.1 | - | `feud-accents`, `feud-runs`: fragments 0-22.1, against the Friar 33.3-59.7, the return 135.9-159.9 | `feud-accents`, `feud-runs`: 117.8-202.7 (the catastrophe) | - |
| **Sword clashes** (cymbal-bright tutti strokes) | - | `clash-strokes`: 11.0-16.4, 24.9-27.3, 52.2-58.6, 61.0-69.5, 73.8-80.7, 82.3-91.4, 94.6-95.4 | - | `clash-strokes`: 95.2-155.6 | `clash-strokes`: 139.7-202.1 | - |
| **Love theme** | - | - | `love-theme`, `love-theme-first`: 21.6-38.9 (English horn and violas, Db); `love-theme`: 72-150 (winds, then the full strings) | - | `love-theme`: 20.3-95 (violins, D major, ecstatic from 37.6); `broken-theme` 95-117.8 | `love-theme`, `broken-love`: 7.8-44.5 (broken, over the timpani); `love-theme`: 101.5-140.9 (transfigured, violins high) |
| **Sighs** (rocking muted-string chords, the sighing answer) | (`sighing-descent` 69.9-92.2: the introduction's own chromatic sigh) | - | `sighs`: 41.0-72 and 150-172.3 | - | `sighs` (oboe/clarinets) 0.3-30.7, `sigh-chords` 0.3-22.2 | - |
| **Fate / funeral timpani, low tolls** | `low-strokes` 138.6-163.3, 283.8-292.8; the low roll 293.2-306.3 (in `hush-chords`) | `low-strokes`, `a-pedal` | `low-pulse` (a stroke every ~2.2 s, 79.4-149.7) | `low-strokes` | `catastrophe-blows` 195.7-212.4, `dying-roll` 212.6-219.6 | `funeral-timpani`: 37 strokes, 1.74-45.9, every 1.23 s |
| **Harp** | `harp`: 105.8-108.6, 119.9-126.5, 223.3-224.2 | - | `harp`: 39.2-40.7, 186.8-188.0 | - | `harp` (roll's piano/plucked): 39.6-159.7 | `harp`: 102.2-140.2 (dense arpeggios) |
| **ff blows** (Fireworks territory) | `ff-blows`: the climax 279.8-293.1 | `ff-blows`: 67.4-91.3 | none (the climax is loud, not hammered) | `ff-blows` 99.6-151.4, `brass-blows` 99.6-136.3 | `ff-blows` 139.7-194.2, `catastrophe-blows` | `ff-blows`: the closing chords, bursts at 143.0, 145.0, 147.4, 149.2, 151.9, 153.7, 155.6, 158.1 |
| **High violins, long and eerie** | `high-violins`: 48.1-61.4, 177.7-190, the held B5 276-291 | - | - | `rising-strings`: the held B5 58.96-71.3 in the hush | - | - |
| **Hammered repeats / tremolo** | `tremolo`: 276.5-292.8 | (`chord-blocks`) | - | `brass-blows` 122.0-135.9 (F# hammered every 0.6-0.8 s) | - | `ff-blows` |

Every pack also has `melody` (the voiced-out top line), `bass-line`, `chord-blocks` (5+ note attacks, outer voices) and
`winds-line`, with the same ids, for always-on threads.

**For the cycles.** Give each theme one picture and let it come back: the Friar's chorale (friar 2.1, 139.7, 199; the
clash's horns; its trumpets at clash 99.6; the coda's hymn at 49.7 as its consoling echo); the love theme (love 21.6
quiet, love 72-150 full; return 20.3-95 ecstatic; coda 7.8 broken and 101.5 transfigured); the sighs (love 41, love 150,
return 0); the feud with its clashes (feud, clash 0 and 135.9, return 117.8). The coda's timpani are the only fate
strokes in the transcription-free sense: 37 audio strokes, clean and regular, ideal for a toll widget.

## Recurring events, counted

- **Sword clashes** (cymbal-bright tutti strokes, 5-11 kHz jump >= 9 dB to -20 dB or louder): feud 62, clash 52,
  return 56. In the feud they come in volleys 0.6-1.3 s apart.
- **Funeral timpani**: coda 37 strokes, 1.74-45.9 s, period 1.23 s (B; the chroma hears B throughout).
- **Hammered F#**: clash 122.07-134.86 s, strength 2.2-3.8, every 0.6-0.8 s (the dominant before the feud's return).
- **Closing hammer bursts**: coda 142.9-158.9 s, 8 bursts of 3-8 B major strokes.
- **The climax cut-offs**: friar 293.0 s (the introduction's climax stops dead; -12.5 dB in 0.7 s), return 212.4 s (the last
  blow before the roll).
- **Harp arpeggios**: friar 105.8, 119.9, 223.3; love 39.2, 186.8; coda 102-131 continuous.

## Holes (from the audio)

The generator lists, per pack, the 1 s bins that are audible (above -56 dB) with no note starting for 3 s or more:

- friar: 38-41, 100-103, 114-117, 174-177, 194-197, 241-248, 250-256, 307-315 s. 100-103 and 114-117 are held chords
  (the Db chord struck at 99.31 sounds to 102.4; the clarinet Bb4 at 112.9 for 1.8 s) and need no cover. The rest is
  covered by `low-swell` (36.7-48) and `hush-chords` (170-198.4, 225.1-257.2, 293.4-325: audio onsets and chord changes).
- love: 15-19 s (the A pedal; `night-hush` and `bass-line` hold it), 214-217 s (the last F; `night-hush`).
- coda: 46-49 s (the breath between the march and the chorale: real silence-like, leave it), 160-167 s (the last chord
  held: `last-chord`, one note 158.18-166.0).
- feud, clash, return: none by that rule, but the brass is never transcribed: clash 97.6-135.9 (the trumpets' chorale,
  the hammered F#) is covered from the audio by `brass-blows`, `ff-blows` and `clash-strokes`; the clash's hush
  59.7-70.8 by `hush-cover`; the return's dying roll 212.6-219.6 by `dying-roll`.

Quiet stretches that stay sparse even so (draw them with widgets that need no attacks: fields, the current's thread):
friar 36.7-48 and 293-325, love 0-21 and 185-218, coda 0-1.7 and 166-180 (silence).

## Per pack: sections, sets, holes and the weight table

The section tables give, for each section, the sets with notes there and their attacks (most first). The weight table
ranks, per 30 s, the strands by attacks x mean velocity: the threads a composer starts from (theme sets first where they
sound; the generic `melody`, `bass-line`, `chord-blocks` are the always-on floor).

### romeo-juliet-1-friar (325.6 s)

| start | end | section | character | sets sounding (attacks) |
|---|---|---|---|---|
| 0.0 | 36.7 | Friar Laurence chorale | clarinets and bassoons in four-part F# minor chorale, pp, archaic and still; phrases enter at 2.1, 5.7, 17.2, 24.7 s | friar-chorale (18), melody (18), winds-line (18), friar-chorale-chords (16), bass-line (15), chord-blocks (4) |
| 36.7 | 48.0 | Low strings rise | cellos and basses in octaves (C#, then B), swelling from -63 to -41 dB; almost no transcribed notes | low-swell (7), bass-line (3) |
| 48.0 | 62.0 | High violins | violins alone on long high notes (F#5 G5 F#5 E5 F5 F#5) over a D2 in the cellos, ppp | high-violins (7), melody (7), bass-line (2) |
| 62.0 | 68.6 | Bass sforzando | a low-string accent at 61.9-62.2 s (+18 dB in 0.4 s) and its long decay | bass-line (5) |
| 68.6 | 92.7 | Sighing descent and swell | violins and violas fall in chromatic steps (F-Eb-Db-B), cellos answer rising, a crescendo into F minor | melody (26), sighing-descent (23), winds-line (4), bass-line (3), chord-blocks (2), f-minor-swell (1) |
| 92.7 | 99.3 | First swell: the F minor chord | tutti F minor chord at 92.68 s with the winds, then a violin arpeggio flourish 96.4-98.3 s | f-minor-swell (16), chord-blocks (8), bass-line (3), melody (2), winds-line (1) |
| 99.3 | 127.0 | Harp and woodwinds | a hushed Db chord (99.31), the harp arpeggiates F minor (105.7-108.6, 119.9-126.5), clarinet and bassoon answer (112.9) | harp (58), melody (9), bass-line (8), winds-line (2), chord-blocks (1) |
| 127.0 | 165.0 | Chorale over pizzicato | pizzicato strings walk down in octaves (127.3-139), then the chorale returns in oboe, clarinets and bassoons (139.7-161) over the walking bass, swelling to 0.72 at 148 s | pizzicato-walk (85), bass-line (73), melody (41), chord-blocks (18), friar-chorale (15), winds-line (15), friar-chorale-chords (9), low-strokes (9) |
| 165.0 | 198.4 | High violins return | the long high violin notes again (F5 F#5 A4 F5 Eb5 E5 F5, 177.7-190), low strokes at 190.3-193 | hush-chords (9), melody (8), high-violins (7), bass-line (4) |
| 198.4 | 225.1 | Chorale in the winds, rising | the woodwinds take the chorale in C major (199-212), the strings climb (212-221), a harp flourish to G7 at 223.3-224.2 | melody (32), chord-blocks (24), friar-chorale (19), winds-line (19), friar-chorale-chords (17), bass-line (14), harp (7) |
| 225.1 | 257.2 | Antiphonal hush | chords traded between winds and strings (C major against E minor), few notes: a hole in the transcription | hush-chords (24), melody (7), bass-line (3), chord-blocks (3), winds-line (3) |
| 257.2 | 275.0 | Tremolo build | string tremolo in E minor, a crescendo in waves (-45 to -33 dB) | melody (15), bass-line (5), chord-blocks (4), winds-line (1) |
| 275.0 | 293.2 | Climax | the introduction's climax, ff: cellos in tremolo on E2 then C#, violins hold B5, the strings hammer B3 then C#4 to the cut-off at 293.0 s | tremolo (76), chord-blocks (28), melody (18), bass-line (15), ff-blows (14), high-violins (8), low-strokes (3) |
| 293.2 | 306.3 | Aftermath: the low roll | a low roll (F#) under falling held notes G3, Bb3/F#2, E3, D2 | hush-chords (11), bass-line (6), melody (4) |
| 306.3 | 325.6 | Hush before the feud | pp, -55 dB: B4 over D2, then E3, D3, F#4; the dominant of B minor waiting | hush-chords (6), bass-line (3), melody (2) |

| set | notes | attacks | span (s) | from the audio | what one hears |
|---|---|---|---|---|---|
| `friar-chorale` | 52 | 52 | 2.1-213.0 | - | The Friar Laurence chorale, its top voice: clarinets and bassoons 2.1-34 s (F# minor), the oboe/clarinet/bassoon return over pizzicato 139.7-161 s (F minor), the woodwinds again 199-212 s (C major). Slow, even chords, one every 0.8-1.7 s. |
| `friar-chorale-chords` | 84 | 42 | 2.1-213.0 | - | The same three chorale statements as whole chords, thinned to their outer voices: the bassoon bottom and the clarinet/oboe top of each chord, one attack per chord. |
| `low-swell` | 7 | 7 | 37.1-48.0 | 4 | From the audio: the cellos and basses rising out of the chorale, 37.1-48 s, C#2 then B1 (plus the two transcribed octaves); each low-band onset and chord change is one long note. |
| `high-violins` | 22 | 22 | 48.1-292.7 | - | The violins' long high notes, ppp, the eeriest line of the introduction: 48.1-61.4 s (F#5 G5 F#5 E5 F5 F#5), its return 177.7-190 s, and the held B5 of the climax 276-291 s. |
| `sighing-descent` | 23 | 23 | 69.9-92.2 | - | The strings' chromatic falling figure and the cellos' answer, 69.9-92 s: F4-Eb4-Db4, F4-Eb4-Db4-B3, then cellos Bb3-B3-C#4 rising into the swell. |
| `f-minor-swell` | 41 | 16 | 92.7-102.5 | - | The first swell: the tutti F minor chord at 92.68 s (whole chord) and the violins' F minor arpeggio flourish 96.4-98.3 s (every note). |
| `harp` | 79 | 65 | 105.8-225.3 | - | The harp: F minor arpeggios 105.7-108.6 and 119.9-126.5 s, the flourish to G7 at 223.3-224.2 s (the roll calls the harp "piano"; the pack adds the notes it missed). |
| `pizzicato-walk` | 85 | 85 | 127.3-165.9 | - | The pizzicato strings walking down in octaves (127.3-139 s: Ab-G-F-F-Eb-Db-C-Bb-Ab-G-F), then the walking bass under the chorale (137.5-165 s, a step every 0.35 s); the lowest note of each step. |
| `tremolo` | 146 | 76 | 276.5-292.8 | - | String tremolo and hammered repeats in the climax: cellos on E2 then C#2/C#3 (276.5-288.7 s), violins on B5 (280.6-281.9), the strings on B3 then C#4 (290.8-292.9 s). |
| `ff-blows` | 20 | 14 | 279.8-294.6 | 3 | The real ff blows of the introduction: the climax's strongest onsets 276-293.0 s (audio strength >= 1.0 at -27 dB or louder), each the notes struck with it (outer voices); the cut-off at 293.0 s is the last. |
| `low-strokes` | 12 | 12 | 138.6-292.9 | 2 | Low-band strokes from the audio (< 150 Hz jump >= 10 dB): the low accents under the returning chorale (138.6-143.9, 155.6-163.3 s) and the climax's bass blows (283.8, 285.5, the cut-off 292.8 s); each the lowest note struck with it, else the bass pitch class in octave 2. |
| `hush-chords` | 50 | 50 | 170.0-324.9 | 46 | Hole cover, from the audio, where the transcription is thin: the high violins' return (170-198.4 s, the low strokes 190.3-193), the antiphonal hush 225.1-257.2 s (C major / E minor chords traded, 9 transcribed attacks) and the aftermath 293.4-325 s; each audio onset or lasting chord change one held note (octave 4; octave 3 in the aftermath), at its level. |
| `melody` | 189 | 189 | 2.1-323.6 | - | The voiced-out top line of the whole pack: every instrument, notes held >= 0.28 s at G3 or higher, the top (or the clearly loudest) note of each attack; a note under a higher one still sounding is hidden. |
| `bass-line` | 162 | 162 | 2.1-323.6 | - | The bass line: the lowest note of each attack below D3 (cellos, basses, bassoons; roll and pack), one per 0.25 s. |
| `chord-blocks` | 186 | 92 | 5.7-292.9 | - | Chord blocks: attacks of 5+ notes (roll and pack), thinned to their outer voices, one attack per chord. |
| `winds-line` | 63 | 63 | 2.1-264.2 | - | Every woodwind and horn voice's line: the top of each wind attack held >= 0.28 s, the whole pack. |

Holes (audible, > -56 dB, but no note starting for 3 s or more): 38-41 s, 100-103 s, 114-117 s, 174-177 s, 194-197 s, 241-248 s, 250-256 s, 307-315 s.

| from | loudness (dB, mean / max) | prominent strands, strongest first (attacks) |
|---|---|---|
| 0-30 | -50 / -40 | friar-chorale (17), melody (17), winds-line (17), friar-chorale-chords (14), bass-line (14), chord-blocks (4) |
| 30-60 | -49 / -40 | low-swell (7), melody (8), high-violins (7), bass-line (5), friar-chorale-chords (2), friar-chorale (1) |
| 60-90 | -43 / -34 | sighing-descent (22), melody (21), bass-line (8) |
| 90-120 | -39 / -31 | harp (33), f-minor-swell (16), melody (14), chord-blocks (10), bass-line (10), winds-line (7) |
| 120-150 | -45 / -33 | pizzicato-walk (43), bass-line (38), melody (26), harp (25), chord-blocks (12), friar-chorale (9) |
| 150-180 | -44 / -32 | pizzicato-walk (42), bass-line (40), melody (20), low-strokes (4), chord-blocks (7), friar-chorale (6) |
| 180-210 | -43 / -30 | melody (20), friar-chorale (16), winds-line (16), friar-chorale-chords (15), chord-blocks (13), bass-line (7) |
| 210-240 | -38 / -30 | hush-chords (18), melody (21), chord-blocks (12), bass-line (9), harp (7), winds-line (5) |
| 240-270 | -42 / -31 | melody (14), hush-chords (6), bass-line (6), chord-blocks (5), winds-line (2) |
| 270-300 | -31 / -19 | tremolo (76), chord-blocks (29), melody (23), ff-blows (14), bass-line (18), hush-chords (9) |
| 300-326 | -49 / -36 | hush-chords (8), bass-line (7), melody (5) |

### romeo-juliet-2-feud (118 s)

| start | end | section | character | sets sounding (attacks) |
|---|---|---|---|---|
| 0.0 | 11.3 | Feud: the opening crescendo | Allegro giusto in B minor: the syncopated feud figure in the strings, from mf (-48 dB) to ff in 11 s; a held B4 opens | feud-violins (9), melody (9), bass-line (9), chord-blocks (6), low-strokes (4), clash-strokes (2) |
| 11.3 | 16.5 | First tutti, first clashes | ff tutti, cymbal-bright strokes every 0.6-1 s (11.5-16.1 s) | chord-blocks (22), clash-strokes (10), feud-accents (6), bass-line (3), feud-violins (2), low-strokes (2), melody (2) |
| 16.5 | 28.3 | Feud theme in full | scurrying string runs (5.7 attacks/s) under the theme, sword clashes again 24.9-27.3 s | chord-blocks (47), feud-violins (8), melody (8), feud-accents (6), bass-line (6), feud-runs (5), clash-strokes (4), low-strokes (3) |
| 28.3 | 47.7 | Fugal chase | the strings chase each other in runs, quieter (loudness 0.71), E then D/G minor | chord-blocks (46), feud-runs (25), melody (12), bass-line (12), feud-violins (8), low-strokes (7) |
| 47.7 | 61.0 | Build | chords pile up, F to Ab, rising to ff | chord-blocks (35), feud-violins (9), melody (9), low-strokes (7), bass-line (7), clash-strokes (6) |
| 61.0 | 70.0 | Sword clashes I | ff, cymbal strokes every 0.6-1.3 s (61.0-69.5) over F# harmony | feud-accents (24), chord-blocks (22), clash-strokes (13), low-strokes (7), melody (6), feud-violins (5), feud-runs (3), bass-line (3), ff-blows (2) |
| 70.0 | 73.7 | Breath | a short drop (-31 dB) before the next wave | feud-runs (18), feud-violins (2), melody (2) |
| 73.7 | 81.3 | Sword clashes II | the loudest crashes of the pack (73.75-80.7 s, high band to +4 dB) | chord-blocks (29), feud-accents (28), ff-blows (15), clash-strokes (10), bass-line (9), feud-runs (5), melody (4), feud-violins (3), low-strokes (3) |
| 81.3 | 92.0 | Sword clashes III | clashes 82.3-91.4 s, E/F/B, the feud at its most violent | chord-blocks (44), feud-accents (33), clash-strokes (15), melody (6), feud-runs (5), feud-violins (5), ff-blows (5), bass-line (5), low-strokes (2) |
| 92.0 | 98.1 | Last blows | the last tutti strokes (94.6, 96.0 s), then the fall | feud-accents (10), chord-blocks (9), feud-runs (7), feud-violins (3), melody (3), clash-strokes (2), bass-line (2), low-strokes (1) |
| 98.1 | 118.0 | Hushed transition | clarinet and bassoon trade a falling figure over a held A in the low strings, pp (-45 to -50 dB): the night before the love theme | transition-winds (26), winds-line (26), melody (25), a-pedal (10), bass-line (10), chord-blocks (3) |

| set | notes | attacks | span (s) | from the audio | what one hears |
|---|---|---|---|---|---|
| `feud-accents` | 173 | 107 | 11.5-96.7 | 34 | The feud's accented attacks: every audio onset of strength >= 0.6 in 0-98 s (the syncopated sforzandi the ear follows, not every run note), each the notes struck with it (outer voices). |
| `clash-strokes` | 62 | 62 | 7.6-95.5 | 9 | The sword clashes: cymbal-bright tutti strokes from the audio (5-11 kHz jump >= 9 dB to -20 dB or louder), 11.0-16.4, 24.9-27.3, 52.2-58.6, 61.0-69.5, 73.8-80.7, 82.3-91.4, 94.6-95.4 s; each the top note struck with it, else the pitch class in octave 6. |
| `feud-runs` | 124 | 68 | 16.8-93.1 | - | The scurrying string runs (5+ notes of one instrument, <= 0.2 s apart, stepwise): the feud's machinery, 4-96 s. |
| `feud-violins` | 54 | 54 | 0.0-96.7 | - | The violins' top line, notes held >= 0.28 s: the feud theme's long notes and syncopations (B4, B5, C5, G5 ... D6), 0-97 s. |
| `ff-blows` | 36 | 22 | 67.4-92.7 | 7 | The real ff blows: audio onsets of strength >= 1.2 at -26 dB or louder (67.4-91.3 s, densest 73.8-80.2), the heaviest tutti strokes of the feud; each the notes struck with it. |
| `low-strokes` | 36 | 36 | 4.7-96.3 | 5 | Low-band strokes from the audio (bass drum, timpani, bass sforzandi; < 150 Hz jump >= 10 dB): 0-97 s; each the lowest note struck with it. |
| `transition-winds` | 26 | 26 | 98.5-116.7 | - | The hushed transition: clarinet and bassoon trading a slow falling figure, 98.6-117 s (G5 F5 Ab5 F5 D5 Bb4 ... C#4), pp. |
| `a-pedal` | 10 | 10 | 99.8-118.0 | - | The held A of the low strings under the transition, 98.1-118 s (the pack hears it as A1/A2 strokes); the lowest note of each attack. |
| `melody` | 86 | 86 | 0.0-116.7 | - | The voiced-out top line of the whole pack: every instrument, notes held >= 0.28 s at G3 or higher, the top (or the clearly loudest) note of each attack; a note under a higher one still sounding is hidden. |
| `bass-line` | 66 | 66 | 0.0-118.0 | - | The bass line: the lowest note of each attack below D3 (cellos, basses, bassoons; roll and pack), one per 0.25 s. |
| `chord-blocks` | 526 | 263 | 0.0-108.5 | - | Chord blocks: attacks of 5+ notes (roll and pack), thinned to their outer voices, one attack per chord. |
| `winds-line` | 26 | 26 | 98.5-116.7 | - | Every woodwind and horn voice's line: the top of each wind attack held >= 0.28 s, the whole pack. |

Holes (audible, > -56 dB, but no note starting for 3 s or more): none.

| from | loudness (dB, mean / max) | prominent strands, strongest first (attacks) |
|---|---|---|
| 0-30 | -32 / -20 | chord-blocks (84), clash-strokes (16), feud-accents (12), melody (21), feud-violins (20), bass-line (19) |
| 30-60 | -32 / -22 | chord-blocks (67), low-strokes (14), bass-line (18), feud-runs (25), melody (18), feud-violins (15) |
| 60-90 | -26 / -17 | feud-accents (77), chord-blocks (89), clash-strokes (34), ff-blows (20), feud-runs (31), bass-line (16) |
| 90-118 | -41 / -19 | feud-accents (18), chord-blocks (23), melody (30), transition-winds (26), winds-line (26), clash-strokes (6) |

### romeo-juliet-3-love (221 s)

| start | end | section | character | sets sounding (attacks) |
|---|---|---|---|---|
| 0.0 | 20.9 | Night pedal | the transition ends on a held A (A1/A2, a Bb neighbour), pp at -50 dB; no melody | bass-line (18), night-hush (2) |
| 20.9 | 39.2 | Love theme (English horn and violas) | the love theme enters at 21.59 s (Ab4), D-flat major, p, viola and English horn in unison (the roll labels it violin/viola) | love-theme (15), love-theme-first (15), melody (15), violins (8), bass-line (7), low-pulse (5), horn (1), winds-line (1) |
| 39.2 | 72.0 | The sighs (muted strings) | the harp's entrance (39.2-40.7), then the muted strings' rocking chords (~0.6 s apart, Db major), breathing in 2.5 s swells, pp (-55 to -48 dB) | sighs (56), melody (46), violins (44), harp (6), bass-line (3), chord-blocks (3), low-pulse (1) |
| 72.0 | 87.3 | Love theme returns (flutes, oboes, horn) | the love theme in the high woodwinds over the sighing chords, horn countermelody, crescendo (-47 to -38 dB) | melody (21), violins (19), chord-blocks (19), love-theme (18), bass-line (11), low-pulse (4) |
| 87.3 | 110.0 | Love theme climbs | the theme modulates (G, E, A), the strings join, loudness 0.63-0.70 | melody (27), love-theme (25), chord-blocks (19), winds-line (19), bass-line (18), horn (13), violins (11), low-pulse (10) |
| 110.0 | 150.0 | Full-string climax | the whole orchestra on the theme, an Ab dominant pedal, loud (0.75-0.78), the most attacks of the pack (12-17 per 2.5 s) | melody (62), climax-chords (60), love-theme (50), violins (44), bass-line (44), winds-line (42), chord-blocks (41), climax-onsets (26), horn (25), low-pulse (25) |
| 150.0 | 172.3 | Codetta: sighs on the Db pedal | the climax settles onto a held C#/Db pedal, the sighing figures return, quieter | sighs (28), melody (25), violins (21), bass-line (20), chord-blocks (11), winds-line (8), horn (4) |
| 172.3 | 185.5 | Two swells | two low surges (172.3, 182.4 s, low band +11 dB) on an A/E chord | bass-line (10), melody (6), violins (3), chord-blocks (3), winds-line (2), low-pulse (1) |
| 185.5 | 217.6 | Balcony night | the Db pedal fading (-47 to -61 dB), slow string figures over it | melody (20), violins (15), bass-line (14), chord-blocks (14), harp (7), winds-line (5), low-pulse (2), night-hush (2) |
| 217.6 | 221.0 | Silence | the last held F, -62 dB | - |

| set | notes | attacks | span (s) | from the audio | what one hears |
|---|---|---|---|---|---|
| `love-theme` | 108 | 108 | 21.6-152.3 | - | The love theme, each note one hears as the theme: the English horn/viola statement 21.6-38 s (Ab4, C4-Db4-Eb4-Bb3-Ab3-Db4 ...), and the high woodwind/string statement and climax 72-150 s (top line, notes held >= 0.4 s). |
| `love-theme-first` | 15 | 15 | 21.6-38.9 | - | Only the love theme's first statement (English horn and violas), 21.6-38 s: the quiet, intimate version. |
| `sighs` | 168 | 84 | 41.0-172.3 | - | The sighs: the muted strings' rocking chords, 41.0-72 s and 150-172 s (each chord's top and bottom, one attack per chord, ~0.6 s apart). |
| `harp` | 27 | 13 | 39.2-188.1 | - | The harp: its arpeggio entrance into the sighs (39.2-40.7 s) and its arpeggio in the balcony night (186.8-188.0 s), the roll's plucked track. |
| `horn` | 59 | 43 | 32.1-170.0 | - | The horns: the countermelody under the love theme (87-140 s) and their held notes (the roll's horn track). |
| `climax-chords` | 120 | 60 | 111.0-152.3 | - | The full-string climax as chord blocks (4+ notes, outer voices), 110-150 s: the theme's big harmonies under the Ab pedal. |
| `climax-onsets` | 41 | 26 | 115.7-134.5 | 4 | The climax's audible pulse from the audio: onsets of strength >= 0.5, 110-150 s (the stressed beats of the theme), each with its notes (outer voices). |
| `violins` | 165 | 165 | 21.6-206.8 | - | The violins' line, notes held >= 0.28 s, the whole pack (the sighs' top, the climax's high line). |
| `low-pulse` | 48 | 48 | 22.8-197.4 | 6 | From the audio: the bass strokes one hears as a slow pulse, low-band jumps >= 12 dB to +8 dB or more: under the love theme (22.8-39.2), one every ~2.2 s under its return and climax (79.4-149.7), the swells 179.0, 188.1, 196.8 s; each the lowest note struck, else octave 2. |
| `night-hush` | 4 | 4 | 0.0-217.6 | 4 | Hole cover for the quiet ends, from the audio: the night pedal 0-21 s (A, Bb) and the balcony night 185.5-217.6 s (Db pedal) as held notes at each chord change, octave 3. |
| `melody` | 222 | 222 | 21.6-206.8 | - | The voiced-out top line of the whole pack: every instrument, notes held >= 0.28 s at G3 or higher, the top (or the clearly loudest) note of each attack; a note under a higher one still sounding is hidden. |
| `bass-line` | 145 | 145 | 0.0-216.5 | - | The bass line: the lowest note of each attack below D3 (cellos, basses, bassoons; roll and pack), one per 0.25 s. |
| `chord-blocks` | 220 | 110 | 41.8-204.8 | - | Chord blocks: attacks of 5+ notes (roll and pack), thinned to their outer voices, one attack per chord. |
| `winds-line` | 78 | 77 | 32.1-204.8 | - | Every woodwind and horn voice's line: the top of each wind attack held >= 0.28 s, the whole pack. |

Holes (audible, > -56 dB, but no note starting for 3 s or more): 15-19 s, 214-217 s.

| from | loudness (dB, mean / max) | prominent strands, strongest first (attacks) |
|---|---|---|
| 0-30 | -50 / -37 | bass-line (23), love-theme (9), love-theme-first (9), melody (9), low-pulse (3), violins (7) |
| 30-60 | -50 / -36 | melody (34), sighs (37), violins (27), low-pulse (3), love-theme (6), love-theme-first (6) |
| 60-90 | -45 / -34 | melody (43), violins (40), chord-blocks (30), love-theme (20), bass-line (18), low-pulse (6) |
| 90-120 | -37 / -30 | melody (39), love-theme (35), winds-line (34), low-pulse (15), bass-line (27), horn (23) |
| 120-150 | -34 / -26 | melody (46), climax-chords (41), love-theme (38), violins (33), climax-onsets (24), low-pulse (18) |
| 150-180 | -43 / -33 | melody (30), sighs (28), bass-line (27), violins (24), chord-blocks (14), winds-line (10) |
| 180-210 | -47 / -33 | melody (21), bass-line (16), violins (15), chord-blocks (14), harp (7), low-pulse (2) |
| 210-221 | -55 / -45 | bass-line (1) |

### romeo-juliet-4-clash (159.9 s)

| start | end | section | character | sets sounding (attacks) |
|---|---|---|---|---|
| 0.0 | 22.1 | Feud fragments rise | the development opens on the feud's syncopations in D, building (0.45 to 0.64), first horn notes 17.1 s | chord-blocks (34), feud-runs (26), melody (26), bass-line (24), violins (17), feud-accents (9), low-strokes (8), friar-chorale (3), winds-line (3), clash-strokes (1) |
| 22.1 | 33.3 | Friar's theme in the horns, hushed | p (-47 dB), clarinet figures (22.7-24.0) and the horns' chorale fragment (29.6-31 s: C#4-Eb4-F4-Eb4) on Bb | violins (22), melody (22), winds-line (9), chord-blocks (8), friar-chorale (4) |
| 33.3 | 59.7 | Feud against the Friar | the feud figures against the horns' chorale (51.4-57.4 s: C4-D4-Eb4-G4-F4-Eb4-G4), D to G, crescendo to 0.72 | melody (39), violins (31), chord-blocks (24), bass-line (21), winds-line (18), feud-runs (16), feud-accents (10), friar-chorale (7), low-strokes (7), clash-strokes (1), rising-strings (1) |
| 59.7 | 70.8 | Hush | a sudden pp (-53 dB), B/E/F harmony, the horn holds G4 (61.6 s); few notes | hush-cover (13), melody (9), winds-line (6), violins (4), bass-line (2), friar-chorale (1), rising-strings (1), chord-blocks (1) |
| 70.8 | 97.6 | The long build | the horns again (72.7-76.0: Eb4-F4-Eb4-Ab4), the strings rise by steps Eb, E, F#, A, Bb, from -45 to -30 dB | chord-blocks (48), melody (30), feud-runs (29), violins (21), bass-line (17), low-strokes (15), winds-line (11), friar-chorale (9), rising-strings (7), clash-strokes (1) |
| 97.6 | 122.0 | Climax: the Friar in the trumpets | ff (loudness 0.94-0.98): brass blows of strength 2-3.3 on E and B (the Friar's chorale in the trumpets, from the score; the transcription does not hear the brass), cymbal clashes, string syncopations | chord-blocks (78), melody (28), violins (26), low-strokes (19), bass-line (18), feud-runs (16), clash-strokes (11), brass-blows (9), ff-blows (3) |
| 122.0 | 135.9 | Hammered F# (the dominant) | the whole orchestra hammers F#, the dominant of B minor, every 0.6-0.8 s (strength 2.2-3.8, 122.07-134.86 s): the door the feud comes back through | chord-blocks (45), feud-runs (40), brass-blows (14), clash-strokes (13), ff-blows (9), bass-line (7), violins (6), low-strokes (6), melody (6) |
| 135.9 | 159.9 | The feud returns (recapitulation) | the feud theme ff in B minor from 136.07 s (B, E), clashes 145-157 s, a short drop at 142.6-144, ending on A/D at 157.5 | chord-blocks (90), feud-accents (81), clash-strokes (25), bass-line (14), violins (13), melody (13), feud-runs (12), low-strokes (7), ff-blows (4) |

| set | notes | attacks | span (s) | from the audio | what one hears |
|---|---|---|---|---|---|
| `friar-chorale` | 24 | 24 | 17.1-79.9 | - | The Friar's chorale in the horns (with the clarinets' echoes), the long notes one hears against the feud: 17.1-18.0, 29.6-31.0, 51.4-57.4, 61.6, 72.7-76.0 s. |
| `brass-blows` | 35 | 23 | 99.6-136.3 | 9 | From the audio: the climax's brass blows (onset strength >= 2.0, 97.6-122 s, where the trumpets proclaim the Friar's chorale ff), then the hammered F# 122-135.9 s; each the notes struck with it, else the pitch class in octave 4. |
| `feud-accents` | 155 | 100 | 6.0-158.4 | 42 | The feud's accented attacks: audio onsets of strength >= 0.4 in the feud stretches (0-22.1, 33.3-59.7, 135.9-159.9 s), each with its notes (outer voices). |
| `feud-runs` | 222 | 139 | 13.1-158.7 | - | The scurrying string runs (5+ stepwise notes <= 0.2 s apart, one instrument), the feud's machinery all through the development. |
| `clash-strokes` | 52 | 52 | 21.5-155.7 | 8 | The sword clashes: cymbal-bright strokes from the audio (5-11 kHz jump >= 9 dB to -20 dB or louder), 95.2-155.6 s; each the top note struck with it, else the pitch class in octave 6 (also single strokes at 21.5 and 59.0 s). |
| `ff-blows` | 22 | 16 | 99.6-151.4 | 8 | The real ff blows: audio onsets of strength >= 2.4 at -25 dB or louder (97.6-157 s); each with its notes. |
| `rising-strings` | 9 | 9 | 59.0-92.5 | - | The long build's rising string line, notes held >= 0.5 s, 70.8-97.6 s, and the held violin B5 of the hush (58.96-71.3 s). |
| `violins` | 140 | 140 | 2.4-159.7 | - | The violins' line, notes held >= 0.28 s, the whole pack. |
| `low-strokes` | 62 | 62 | 3.6-158.1 | 6 | Low-band strokes from the audio (timpani, bass drum, bass sforzandi; jump >= 10 dB): the climax's heaviest beats; each the lowest note struck with it. |
| `hush-cover` | 13 | 13 | 60.3-70.9 | 1 | Cover for the hush 59.7-70.8 s (few transcribed attacks): the notes held >= 0.28 s, plus each audio onset or chord change (B, E, F) as a held note in octave 4. |
| `melody` | 173 | 173 | 0.2-159.7 | - | The voiced-out top line of the whole pack: every instrument, notes held >= 0.28 s at G3 or higher, the top (or the clearly loudest) note of each attack; a note under a higher one still sounding is hidden. |
| `bass-line` | 103 | 103 | 0.2-159.7 | - | The bass line: the lowest note of each attack below D3 (cellos, basses, bassoons; roll and pack), one per 0.25 s. |
| `chord-blocks` | 656 | 328 | 2.9-157.7 | - | Chord blocks: attacks of 5+ notes (roll and pack), thinned to their outer voices, one attack per chord. |
| `winds-line` | 47 | 47 | 17.1-79.9 | - | Every woodwind and horn voice's line: the top of each wind attack held >= 0.28 s, the whole pack. |

Holes (audible, > -56 dB, but no note starting for 3 s or more): none.

| from | loudness (dB, mean / max) | prominent strands, strongest first (attacks) |
|---|---|---|
| 0-30 | -40 / -28 | chord-blocks (38), melody (40), violins (31), feud-runs (26), bass-line (24), low-strokes (8) |
| 30-60 | -37 / -25 | melody (47), violins (39), chord-blocks (28), bass-line (21), feud-runs (16), feud-accents (10) |
| 60-90 | -41 / -21 | melody (37), chord-blocks (28), violins (23), low-strokes (11), bass-line (16), winds-line (17) |
| 90-120 | -26 / -18 | chord-blocks (90), feud-runs (45), low-strokes (22), melody (25), violins (24), bass-line (17) |
| 120-150 | -27 / -18 | chord-blocks (110), feud-accents (51), clash-strokes (28), feud-runs (41), brass-blows (16), bass-line (19) |
| 150-160 | -28 / -19 | feud-accents (30), chord-blocks (34), clash-strokes (13), feud-runs (11), bass-line (6), violins (6) |

### romeo-juliet-5-return (220.5 s)

| start | end | section | character | sets sounding (attacks) |
|---|---|---|---|---|
| 0.0 | 22.5 | The sighs return (D major) | oboe and clarinets trade the sighing figure (Bb4/E5, G5-F#5-E5-D5) over the muted strings' rocking chords, pp (-48 dB) | melody (49), sighs (47), winds-line (47), violins (36), chord-blocks (29), sigh-chords (25), love-theme (4), bass-line (4) |
| 22.5 | 37.6 | Love theme swells in | the strings take up the love theme in D major, crescendo -40 to -25 dB | chord-blocks (34), melody (28), violins (19), sighs (18), winds-line (18), love-theme (15), bass-line (14) |
| 37.6 | 95.0 | Love theme ecstatic | the whole string body ff on the love theme (0.8-0.91), D/A major, violins up to G6, the pack's great song | melody (92), violins (80), chord-blocks (80), love-theme (66), bass-line (60), love-climax-onsets (26), harp (25) |
| 95.0 | 117.8 | The theme breaks; the feud stirs | the love theme collapses (-35 to -40 dB), F/Eb/G/C harmony, fragments and a slow re-arming | broken-theme (34), melody (30), feud-runs (20), bass-line (18), violins (17), chord-blocks (17), winds-line (7), harp (3) |
| 117.8 | 139.8 | The feud returns | the feud's figures loud again (A, D, Bb), building | chord-blocks (66), melody (27), harp (26), violins (18), bass-line (15), feud-runs (13), feud-accents (10), winds-line (3), clash-strokes (1), ff-blows (1) |
| 139.8 | 202.7 | Catastrophe: clashes | ff, cymbal clashes and brass blows (strength up to 2.9), B/F/G/Eb harmony, the violence that cuts the lovers down | chord-blocks (177), feud-accents (137), clash-strokes (55), melody (46), bass-line (44), ff-blows (37), violins (36), feud-runs (11), harp (10), catastrophe-blows (5), winds-line (4) |
| 202.7 | 212.6 | Held blows | the music freezes on G (-33 dB) and two blows (210.0, 212.4 s) | bass-line (5), catastrophe-blows (2), chord-blocks (1) |
| 212.6 | 220.5 | Timpani roll, dying | a held F# with the timpani roll, fading to silence at ~219.5 s | bass-line (9), dying-roll (1) |

| set | notes | attacks | span (s) | from the audio | what one hears |
|---|---|---|---|---|---|
| `sighs` | 65 | 65 | 0.3-30.7 | - | The sighs in D major: the oboe and clarinets' sighing figure 0.3-30 s (Bb4/E5, G5-F#5-E5-D5-C#5, the repeated D5s), one note per sigh. |
| `sigh-chords` | 50 | 25 | 0.3-22.2 | - | The muted strings' rocking chords under the sighs, 0-22.5 s (each chord's outer voices). |
| `love-theme` | 85 | 85 | 20.3-97.9 | - | The love theme in the violins, notes held >= 0.4 s: its swell 22.5-37.6 s and its ecstatic ff statement 37.6-95 s (A5, D6, E6, B5 ... up to G6 at 51.9 s). |
| `love-climax-onsets` | 34 | 26 | 37.6-90.8 | 8 | The love theme's stressed beats from the audio, 37.6-95 s (onset strength >= 0.8): the pulse of the ecstatic statement, each with its notes. |
| `broken-theme` | 35 | 34 | 98.0-119.2 | - | The theme breaking off and the feud stirring, 95-117.8 s: the string line (notes held >= 0.28 s). |
| `feud-accents` | 229 | 147 | 128.3-202.3 | 46 | The feud's accented attacks: audio onsets of strength >= 0.9, 117.8-202.7 s, each with its notes (outer voices). |
| `feud-runs` | 66 | 44 | 106.6-161.3 | - | The scurrying string runs (5+ stepwise notes <= 0.2 s apart): the feud's machinery, mostly 117-202 s. |
| `clash-strokes` | 56 | 56 | 139.7-202.2 | 5 | The sword clashes: cymbal-bright strokes from the audio (5-11 kHz jump >= 9 dB to -20 dB or louder), 139.7-202.1 s; each the top note struck with it, else octave 6. |
| `ff-blows` | 60 | 38 | 139.7-194.2 | 13 | The real ff blows of the catastrophe: audio onsets of strength >= 1.4 at -25 dB or louder (139.8-212.6 s), each with its notes. |
| `catastrophe-blows` | 7 | 7 | 195.7-213.0 | 1 | The last blows: low-band strokes 195-213 s (210.0, 212.4 ...) and the held-blow chords, from the audio; each the lowest note struck, else octave 2. |
| `violins` | 206 | 206 | 0.3-202.8 | - | The violins' line, notes held >= 0.28 s, the whole pack. |
| `harp` | 249 | 64 | 39.6-159.7 | - | The harp (the roll's "plucked" and "piano" tracks): harp arpeggios by ear and register (the labels are the transcriber's), inside the love theme 39-95 s and the catastrophe. |
| `dying-roll` | 1 | 1 | 213.8-219.6 | 1 | Hole cover for the end, from the audio: the held F# under the timpani roll, 212.6-219.5 s, as held notes at each change (octave 2). |
| `melody` | 272 | 272 | 0.3-202.8 | - | The voiced-out top line of the whole pack: every instrument, notes held >= 0.28 s at G3 or higher, the top (or the clearly loudest) note of each attack; a note under a higher one still sounding is hidden. |
| `bass-line` | 169 | 169 | 8.9-220.5 | - | The bass line: the lowest note of each attack below D3 (cellos, basses, bassoons; roll and pack), one per 0.25 s. |
| `chord-blocks` | 812 | 404 | 0.3-203.0 | - | Chord blocks: attacks of 5+ notes (roll and pack), thinned to their outer voices, one attack per chord. |
| `winds-line` | 79 | 79 | 0.3-188.3 | - | Every woodwind and horn voice's line: the top of each wind attack held >= 0.28 s, the whole pack. |

Holes (audible, > -56 dB, but no note starting for 3 s or more): none.

| from | loudness (dB, mean / max) | prominent strands, strongest first (attacks) |
|---|---|---|
| 0-30 | -45 / -33 | melody (66), sighs (64), winds-line (64), chord-blocks (44), violins (45), sigh-chords (25) |
| 30-60 | -28 / -21 | chord-blocks (47), melody (45), violins (40), love-theme (36), bass-line (31), harp (16) |
| 60-90 | -25 / -17 | melody (48), violins (41), chord-blocks (37), bass-line (32), love-theme (31), love-climax-onsets (22) |
| 90-120 | -34 / -20 | melody (43), chord-blocks (35), broken-theme (34), violins (26), bass-line (26), feud-runs (25) |
| 120-150 | -25 / -16 | chord-blocks (98), feud-accents (29), harp (31), melody (32), violins (25), bass-line (21) |
| 150-180 | -25 / -17 | feud-accents (76), chord-blocks (81), clash-strokes (32), bass-line (25), melody (23), violins (21) |
| 180-210 | -28 / -19 | chord-blocks (62), feud-accents (42), ff-blows (14), clash-strokes (14), melody (15), bass-line (14) |
| 210-221 | -39 / -19 | bass-line (11), catastrophe-blows (2), dying-roll (1) |

### romeo-juliet-6-coda (180.1 s)

| start | end | section | character | sets sounding (attacks) |
|---|---|---|---|---|
| 0.0 | 1.7 | Silence | the breath before the coda | - |
| 1.7 | 47.5 | Funeral march | the timpani strike B every ~1.23 s (1.74 ... 45.9 s), the strings sing the love theme broken over them, in B | funeral-timpani (37), bass-line (31), melody (21), love-theme (18), broken-love (18), violins (8), chord-blocks (8) |
| 47.5 | 101.5 | Consoling chorale | a hymn in woodwinds and horns, B major, p (-44 dB): slow chords, ~1 a second | coda-chorale-chords (38), melody (29), coda-chorale (28), chord-blocks (27), winds-line (26), bass-line (20), violins (16) |
| 101.5 | 140.9 | Love theme transfigured | the violins high (E6-F#6-G6-F#6-B5 ...), harp arpeggios (102-131 s), B major, crescendo -38 to -30 dB | harp (301), melody (43), chord-blocks (35), violins (34), love-theme (32), bass-line (27) |
| 140.9 | 160.0 | Hammered closing chords | ff B major chords, hammered (10-15 onsets per 2.5 s), the timpani under them | ff-blows (33), bass-line (20), chord-blocks (8), melody (5), last-chord (1) |
| 160.0 | 166.0 | Last chord held | the final B chord sustained (-26 dB), cut at 166.0 s | - |
| 166.0 | 180.1 | Silence | room tone, then digital silence from 177 s | - |

| set | notes | attacks | span (s) | from the audio | what one hears |
|---|---|---|---|---|---|
| `funeral-timpani` | 37 | 37 | 1.7-47.3 | 37 | The funeral march's timpani: every low-band stroke from the audio, 1.74-46 s, about 1.23 s apart (B2, the pitch the chroma hears); the transcription has almost none of them. |
| `love-theme` | 50 | 50 | 7.8-141.3 | - | The love theme as the coda sings it: broken in the strings over the timpani (7.85-44.5 s: G4, C4-Eb4-E4-F#4-B3 ...), then transfigured high in the violins (101-139 s: E6-F#6-G6-F#6-B5 ...); notes held >= 0.4 s. |
| `broken-love` | 18 | 18 | 7.8-43.0 | - | Only the broken love theme over the funeral timpani, 7.85-44.5 s (strings, notes held >= 0.4 s). |
| `coda-chorale` | 28 | 28 | 49.7-102.4 | - | The consoling chorale: woodwinds and horns (with the violins that join it), 49.7-101 s, the top voice of each chord held >= 0.5 s; a descendant of the Friar's chorale in spirit (hymn, winds, slow). |
| `coda-chorale-chords` | 78 | 38 | 49.7-102.4 | - | The consoling chorale as chords (3+ notes, outer voices), 47.5-101.5 s. |
| `harp` | 485 | 301 | 102.2-140.2 | - | The harp's arpeggios under the transfigured love theme, 102-131 s (the roll's piano/plucked tracks and the pack's notes there). |
| `ff-blows` | 38 | 33 | 143.0-165.9 | 20 | The hammered closing chords: audio onsets of strength >= 0.8 at -26 dB or louder, 142.9-158.9 s, in bursts at 143.0, 145.0, 147.4, 149.2, 151.9, 153.7, 155.6, 158.1 s; each the notes struck with it, else B in octave 3. |
| `violins` | 58 | 58 | 12.8-141.3 | - | The violins' line, notes held >= 0.28 s, the whole pack. |
| `last-chord` | 1 | 1 | 158.2-166.0 | 1 | The final B chord: one held note from its last attack to the cut-off at 166.0 s (B3), so a widget can hold it. |
| `melody` | 99 | 98 | 7.8-165.9 | - | The voiced-out top line of the whole pack: every instrument, notes held >= 0.28 s at G3 or higher, the top (or the clearly loudest) note of each attack; a note under a higher one still sounding is hidden. |
| `bass-line` | 98 | 98 | 1.7-162.5 | - | The bass line: the lowest note of each attack below D3 (cellos, basses, bassoons; roll and pack), one per 0.25 s. |
| `chord-blocks` | 158 | 78 | 15.2-155.6 | - | Chord blocks: attacks of 5+ notes (roll and pack), thinned to their outer voices, one attack per chord. |
| `winds-line` | 26 | 26 | 49.7-102.4 | - | Every woodwind and horn voice's line: the top of each wind attack held >= 0.28 s, the whole pack. |

Holes (audible, > -56 dB, but no note starting for 3 s or more): 46-49 s, 160-167 s.

| from | loudness (dB, mean / max) | prominent strands, strongest first (attacks) |
|---|---|---|
| 0-30 | -41 / -31 | funeral-timpani (23), melody (18), bass-line (23), love-theme (14), broken-love (14), chord-blocks (6) |
| 30-60 | -42 / -34 | funeral-timpani (14), bass-line (13), melody (8), violins (6), chord-blocks (6), love-theme (4) |
| 60-90 | -44 / -35 | coda-chorale-chords (29), melody (20), coda-chorale (20), chord-blocks (20), winds-line (18), bass-line (14) |
| 90-120 | -38 / -28 | harp (151), melody (26), chord-blocks (25), violins (20), love-theme (16), bass-line (15) |
| 120-150 | -31 / -16 | harp (150), ff-blows (17), bass-line (26), melody (24), violins (17), chord-blocks (16) |
| 150-180 | -47 / -19 | ff-blows (16), bass-line (7), chord-blocks (5), melody (2), last-chord (1) |
| 180-180 | -95 / -95 |  |

## Uncertain

- **The trumpets' chorale in the clash (97.6-122 s).** The score puts the Friar's chorale in the trumpets, ff, at the
  development's climax; the transcription has no brass there (its "horn" track ends at 79.9 s). `brass-blows` is the
  audio's strongest onsets (strength >= 2), so it follows the brass and the tutti accents together, not the chorale's
  pitches. Its notes are the strings' notes struck with each blow, or the blow's pitch class (mostly E and B, then F#).
- **Where the recapitulation starts.** The clash pack's last section (135.9-159.9) is heard as the feud's return in B
  minor after the hammered F#; the drop at 142.6-144 could also be the turn.
- **The love theme's first notes.** The theme is read from the violin/viola rows at 21.6-38.9 s (the English horn is not
  a track; its unison with the violas is labelled violin/viola). The Ab4 at 21.59 (1.9 s) may be a held upper note
  rather than the theme's first note.
- **Instrument labels.** The friar's and the coda's harp are labelled `piano`; the return's `piano` and `plucked` (249
  notes) are harp by register and figure, not checked note by note. The feud's 14 `voice` notes (C3-G4, 29-35 s and 78 s)
  are string or wind notes the transcriber took for voices: do not listen to `voice`.
- **Accents in thin velocities.** Roll velocities follow the loudness curve, so within a passage the notes are about
  equally loud. Every "accent", "blow" and "stroke" set therefore comes from audio onsets, and the low-register notes of
  `ff-blows`/`feud-accents` (C1, D1, E1 in the feud) are the pack's guesses of the basses.
- **`chord-blocks` in the feud, clash and return** (263-404 attacks) is close to every string attack: a texture, not
  an accent. Use `feud-accents` (100-147 attacks) or `ff-blows` (22-38) when a widget must answer only the strokes.
- **The coda's chorale** is a new hymn, not a quotation of the Friar's chorale; it is listed beside it because it is
  the same kind of music (winds, slow chords, consolation) and a cycle can let the Friar's picture answer it.
