# Liszt: Hungarian Rhapsody No. 2, orchestral version: analysis

Song pack `liszt-hungarian-2`, ensemble, 631.2 s. The sound runs from 3.37 s to 628.0 s. The pick sets are in
[picks.json](picks.json), made by [gen-picks.mjs](gen-picks.mjs). Rerun it with
`node docs/compositions/classical/liszt-hungarian-2/gen-picks.mjs`: it is deterministic and prints the numbers below.

## What the recording is

- **The arrangement.** This is the orchestral arrangement, not the piano original. It keeps the piano version's keys:
  - the lassan is in C# minor;
  - the friska starts in F# minor and turns to F# major at 399-405 s;
  - the last chords are F# major.
- **Where the keys come from.** They are read from this recording: the pack's `harmony`, chroma on the audio, and the
  notes. They are not taken from RESEARCH.json, which describes the piano original.
- **The solo voice is the clarinet.** It plays both cadenzas, the garlands, the sinking figure and the friska's pp
  opening. YourMT3+ hears 154 clarinet notes.
- **The violin lanes.** Violins, violas and cellos carry most notes. They are often the same note at the same time.
  `gen-picks` merges one note per pitch per 40 ms.
- **Unreliable lanes.** `voice` (47 notes) and `brass` (36) are YourMT3+ guesses. `piano` (223) is mostly a plucked
  or keyboard colour: harp-like rolled chords, and the high tremolo of 576-583 s. `plucked` (112) is the cimbalom-like
  tremolo of 407.6-409.5 s and 522.3-524 s, plus a few harp notes.
- **Tempo.** From the audio, by onset autocorrelation per 12 s:
  - The lassan has no steady pulse, apart from the lilting dance (131-160 s), which speeds up from 0.53 s to 0.41 s a
    beat.
  - The friska starts at 0.92 s per pulse (363 s) and tightens to 0.41 s (384 s), 0.36 s (432 s) and 0.35 s
    (444-500 s).
  - It speeds up again in the dip, from 0.34 s to 0.31 s (504-528 s).
  - The prestissimo is near 0.29 s (600 s).
  - The pack's `beats` are a constant 171 bpm grid. Ignore them.

## Sources of the pick notes

- **`roll`** is `pack.tracks`, the YourMT3+ lanes with their velocities. The studio's note picker shows this roll
  (`pickerNotes` uses `pack.tracks` when any lane has notes), so these picks are found on it.
- **`pack`** is `pack.notes`: the piano model, with YourMT3+ in its gaps.
  - It hears what the lanes miss: the deep tolls (Bb0, C#1), the pp low strings of 307-356 s, and the prestissimo of
    584-605 s, where the lanes have 20 notes in 20 s.
  - The picker shows these picks as notes it cannot find on its roll. They still play.
- **`audio`** is onsets read from the recording in the holes. The recipe is in gen-picks.mjs, with the array baked in.
  The pitch is the strongest chroma class at its strongest octave, so it is only approximate.
- **`mixed`** is pack or roll notes, with audio onsets where neither has a note within 0.12 s.
- **Velocities.** Many lane velocities come from the loudness curve and are flat across a chord: 416 s is all
  99/100. So "loudest of its chord" ranks by the pack's velocity for the same pitch within 80 ms.

## The form

Turns are measured to 0.1 s from 0.5 s steps of rms dB, attacks and chroma, then checked against the notes. "Sets"
lists the pick sets that sound there. The whole-piece strands (`melody-all`, `bass-all`, `long-tones`, `violin-line`,
`viola-inner`, `cello-line`, `repeats`, `ff-blows`) run through every section where they have notes.

| # | start | end | name | character | sets |
|---|---|---|---|---|---|
| S1 | 0.0 | 40.4 | Lento a capriccio I: the declamation | Silence to 3.37 s, then tutti C# minor proclamations, ff (-8 to -13 dB), 1-2 attacks/s. Long held chords, each phrase knocked open by a fast B3-C#4 ornament (8.3, 18.3, 21.1 s), with single deep bass strokes (C#1 15.85, F1 26.3, E1 30.9 s). | lento-proclamations, lento-knocks, lento-strokes, long-tones |
| S2 | 40.4 | 56.0 | Andante mesto: the lassan theme in the cellos | Alone, low (A2-C#3), p (-18 to -31 dB). The darkest, quietest statement. | lassan-theme-cellos, lassan-bass, cello-line |
| S3 | 56.0 | 92.5 | Lassan theme in full strings, to ff | A sudden f at 56.0 s. The violins climb (Ab4/E5 at 76-80 s, A5 at 83.5 s) to the ff of 88-92 s (-2 dB). | lassan-theme-strings, lassan-bass, lassan-ff-peaks, violin-line, viola-inner |
| S4 | 92.5 | 103.9 | Clarinet cadenza I and the hush | The ff breaks off at 92.5 s. The clarinet flourishes alone (93.5-99.9 s, up to C#6/Eb6), then a held B hush (-25 to -28 dB, no notes 100-103 s). | clarinet-cadenza-1, cadenza-hush-knocks, runs |
| S5 | 103.9 | 131.0 | G# major interlude | A quiet G#4 tapped again and again (104-112 s), then the clarinet's garlands over soft strings (113-131 s), p (-13 to -23 dB). | gsharp-repeats, interlude-line, clarinet-garlands |
| S6 | 131.0 | 160.0 | The lilting dance | A swaying G# major dance over a G#2 drone, speeding up. At 136.5-147.5 s, the first glitter: high sparkles to E7/Eb7 (140.3 s) and A6. | dance-lilt, dance-pedal, glitter-1, violin-line |
| S7 | 160.0 | 173.9 | High shake, the clarinet sinks | C#6/Eb6 alternate high and loud (160-166.5 s). Then the clarinet sinks alone from C6 to C#4 and circles C#4-F4-Eb4, pp (166-173.5 s, down to -30 dB). | high-alternation, clarinet-sinking |
| S8 | 173.9 | 212.4 | Lento a capriccio II: the declamation returns | The opening phrases again, tutti ff, 170.5 s later: the knocks at 178.6, 189.0, 191.1 s and the strokes. Then new Ab4 calls (200-204 s). | lento-proclamations-return, lento-knocks, lento-strokes, long-tones |
| S9 | 212.4 | 246.4 | The lassan theme returns, building | Low strings again, now f, over an Ab2 pedal (212-216 s), climbing from 236 s to C#5 and the ff. | lassan-theme-return, lassan-bass, lassan-ff-peaks, cello-line |
| S10 | 246.4 | 251.5 | Climax strokes and cut-off | A Bb1 diminished chord (246.5), G/E (247), Ab (248.0), Ab1 (249.3), then the A1/A2 blow (250.5 s, -1 dB, the lassan's loudest). Cut off at 251.5 s into silence. | climax-strokes, lassan-ff-peaks |
| S11 | 251.5 | 264.5 | Clarinet cadenza II | Silence to 253.0 s. The clarinet rises by step G3 to Ab5 (253.0-255.5 s) and trills Ab5-A5 slowly to 261.5 s. Then a hush (-34 dB) to 264.5 s. | clarinet-cadenza-2, runs |
| S12 | 264.5 | 307.0 | The A-major song | The lassan's one tender patch, violins p in A major / F# minor (up to Eb6 at 268-270 s), with harp-like rolled chords (290-304 s). | a-major-song, a-major-bass, harp-arpeggio, long-tones |
| S13 | 307.0 | 355.5 | The dissolve | pp low strings (-25 to -34 dB), 1-6 notes/s. Hardly any lane notes. B minor / C# chords, C#3 repeated (332-338 s), an Ab1 shudder (344-355 s). | dissolve-murmur, dissolve-audio, bass-all |
| S14 | 355.5 | 363.4 | Dominant swell and grand pause | A swell on C# (F1/C#2 strokes to -16 dB at 357.5 s) fades out. True silence at 361.5-363.4 s (-44 dB). | dominant-swell |
| S15 | 363.4 | 385.0 | Friska dawn | The friska begins pp, high and staccato: clarinet and high winds tap the F# minor tune (Ab5-F#5-C#6, F#6/A6 points) over I-V harmony. The notes are missing at 363.4-368.8 and 377-385 s. | friska-dawn, clarinet-all |
| S16 | 385.0 | 410.4 | The strings take the friska | Violins hammer staccato C#5s, crescendo p to f. F# minor turns to F# major (399-405 s). Cimbalom tremolo at 407.6-409.5 s. | friska-strings-theme, friska-vamp-bass, cimbalom-tremolo, violin-line |
| S17 | 410.4 | 421.0 | First friska tutti | ff F# major chords, about one a second, with Bb0/C#1 tolls (-1 to -4 dB). | tutti-1-blows, deep-tolls, ff-blows |
| S18 | 421.0 | 456.0 | The friska tune in F# major | Sudden p: the violins' C6-C#6 neighbour-note shake over oom-pah. At 438-453 s, the second glitter (Eb7/F#7) and a falling wind line. | friska-violins, friska-tune, friska-offbeats, friska-vamp-bass, glitter-2, voice-line-friska |
| S19 | 456.0 | 480.6 | Second build | The tune restarts p (456 s) and climbs over a G# pedal (468-480 s) to F6. | friska-violins, build-2-line, dominant-pedal, friska-vamp-bass |
| S20 | 480.6 | 500.4 | Stomping tutti | ff (0 dB at 488 s): chords hammered on Bb1/C#2, with a brass descent (487.8-489.4 s). | stomp-blows, deep-tolls, brass-descents, friska-violins, ff-blows |
| S21 | 500.4 | 510.3 | High whirl | The violins whirl at the top, F#6-C#7-Eb7-F#7, loud and fast. | high-whirl, friska-violins |
| S22 | 510.3 | 526.5 | The dip | Sudden p (-19 dB), the tune murmured mid-register and speeding up. An Eb3/Ab3 cimbalom shimmer at 522.3-524 s. | dip-line, friska-violins, cimbalom-tremolo |
| S23 | 526.5 | 539.4 | Fireworks and the plunge | The highest burst of the piece (F7, G7, F#7 at 527-534.4 s, ff), then a plunge to the bass (534.4-539.4 s, down to C1). | fireworks, plunge, deep-tolls |
| S24 | 539.4 | 570.4 | The loudest stomp | -1 to -8 dB for 31 s: tutti chords on C#2/Bb1, A/E major swerves (546-562 s), three bursts (557, 559-560, 563 s), a brass descent (551.1 s), and C# hammering (564-570 s). | loudest-stomp-blows, deep-tolls, stomp-bursts, brass-descents, friska-violins, ff-blows |
| S25 | 570.4 | 584.0 | High tremolo dying away | The stomp breaks off. A high C#7/Eb7/F7 tremolo thins from -13 to -28 dB: the cadenza place. | high-tremolo |
| S26 | 584.0 | 605.6 | Prestissimo, pp | A4-C#5 / B4-C#5 alternations, fast, over C#3, accelerating. The lanes are almost empty. A hush at 602.5-605.6 s. | prestissimo-repeats, prestissimo-bass |
| S27 | 605.6 | 619.6 | Final stretta | Chords from pp (606 s) to ff (612-619 s), F#2/C#2 bass, B5/C#5/Bb5 hammered at the top. | stretta-chords, deep-tolls, ff-blows |
| S28 | 619.6 | 631.2 | The last chords | The B chord at 619.0 s, then a rest (619.6-620.4 s). The Bb0/A1 blow at 620.5 s is held ff to 624.4 s with no new attack. C#3 strokes follow, then F# major chords (624.5-627.0 s). The sound ends at 628.0 s. | final-chords, deep-tolls |

### The recurring events

- **Repeated sections.**
  - **The Lento is played twice:** S1, and S8 from 173.9 s, 170.5 s later. Pair `lento-proclamations` with
    `lento-proclamations-return`. `lento-knocks` and `lento-strokes` hold both.
  - **The lassan theme has three entries:** 40.4 s (cellos, p), 56.0 s (full strings, f) and 212.4 s (low strings, f).
    The sets are `lassan-theme-cellos`, `lassan-theme-strings` and `lassan-theme-return`.
  - **The friska tune has four entries:** 363.4 s (clarinet, pp), 385.0 s (violins), 421.0 s (F# major, p) and
    456.0 s (second build).
- **The knocks: a cimbalom ornament on B3/C#4/B4.** They come in fast groups at 3.4, 8.3, 18.3, 21.1, 178.6, 181.4,
  189.0, 191.1 and 202.1 s (set `lento-knocks`).
- **Tolls and strokes.**
  - The Lento's deep strokes, several seconds apart (`lento-strokes`).
  - The friska's Bb0/C#1 tolls under the tuttis at 411-420, 484-500, 536-570 and 620-627 s (`deep-tolls`).
- **ff cut-offs into silence or near-silence:**
  - 92.5 s (into the clarinet cadenza);
  - 251.5 s (into silence, then cadenza II);
  - 361.5 s (the grand pause, to 363.4 s);
  - 510.3 s (into the dip);
  - 570.4 s (into the tremolo);
  - 619.6 s (a rest before the last blow).
  These are the deliberate, spare entrances.
- **Glitter, high sparkles:**
  - 136.5-147.5 s (`glitter-1`);
  - 160-166.5 s (`high-alternation`);
  - 438-453 s (`glitter-2`);
  - 500.4-510.3 s (`high-whirl`);
  - 527-534.4 s (`fireworks`, the loudest and highest: single notes flung, not chords);
  - 570.4-584 s (`high-tremolo`, dying).
- **The cimbalom tremolo:** a chord shaken every ~0.15 s, at 407.6-409.5 s and 522.3-524 s (`cimbalom-tremolo`).
- **The clarinet alone:**
  - 93.5-99.9 s (cadenza I);
  - 166-173.5 s (sinking);
  - 253.0-261.5 s (cadenza II);
  - 368-377 s (the friska dawn).
- **Brass descents in octaves:** 487.8-489.4 s and 551.1-552.6 s (`brass-descents`).
- **Pedals:**
  - G#2 under the dance (131-160 s);
  - Ab2 under the lassan return (212-216 s);
  - G# under the second build (468-480 s, `dominant-pedal`);
  - the C# swell (355.5-361.5 s).

## The sets

63 sets. In picks.json each set has these fields:

- `hears`: the full description;
- `section`;
- `source`;
- `pair`: the sets that are one theme;
- `rule`;
- `span`;
- `count`;
- `attacks`: notes within 40 ms count as one;
- `notes`: `[start, end, midi, velocity]`, sorted.

To use a set, copy `notes` into the show's `picks.<id>`.

| id | what one hears | source | notes | attacks | span (s) |
|---|---|---|---|---|---|
| `lento-proclamations` | The Lento's proud held tones, ff, few and long | pack | 30 | 30 | 3.4-40.0 |
| `lento-proclamations-return` | The same, in the reprise, plus the Ab4 calls of 200-204 s | pack | 26 | 26 | 174.4-206.5 |
| `lento-knocks` | The fast B3-C#4 cimbalom knocks that open each Lento phrase | pack | 81 | 58 | 3.4-202.5 |
| `lento-strokes` | Single deep bass strokes under the Lento (C#1, F1, E1, Ab1 ...) | pack | 16 | 16 | 5.6-209.2 |
| `lassan-theme-cellos` | The lassan theme alone in the low strings, p | pack | 23 | 23 | 41.2-55.6 |
| `lassan-theme-strings` | The lassan theme in full strings, f to ff | pack | 51 | 51 | 56.4-91.9 |
| `lassan-theme-return` | The lassan theme back in the low strings, f, climbing | pack | 57 | 57 | 212.5-245.4 |
| `lassan-bass` | The slow roots under the lassan theme | pack | 69 | 69 | 41.2-250.8 |
| `lassan-ff-peaks` | The accented chords at the tops of the lassan crescendi | pack | 38 | 19 | 78.8-250.8 |
| `climax-strokes` | The lassan climax: 5 blows, the last the A1/A2 at 250.5 s | pack | 26 | 14 | 246.6-250.8 |
| `clarinet-cadenza-1` | The clarinet's soft flourish up to Eb6 and down | roll | 36 | 34 | 93.8-99.5 |
| `cadenza-hush-knocks` | Five soft re-touches of a held B4 in the hush | audio | 5 | 5 | 100.2-103.3 |
| `gsharp-repeats` | A quiet G#4 tapped over and over | pack | 26 | 26 | 104.1-112.7 |
| `interlude-line` | The G# major interlude's singing line | pack | 77 | 77 | 104.8-130.6 |
| `clarinet-garlands` | The clarinet's turning figures over soft strings | roll | 20 | 19 | 113.2-124.8 |
| `dance-lilt` | The swaying, accelerating dance tune | pack | 48 | 48 | 131.1-158.9 |
| `dance-pedal` | The G#2 drone under the dance | pack | 15 | 15 | 131.3-158.1 |
| `glitter-1` | High sparkles flicked up to E7/A6 | pack | 68 | 49 | 140.2-147.3 |
| `high-alternation` | C#6 and Eb6 shaking high and loud | pack | 66 | 45 | 160.1-166.5 |
| `clarinet-sinking` | The clarinet sinking from C6 and circling C#4-F4-Eb4, pp | roll | 21 | 21 | 166.1-172.5 |
| `clarinet-cadenza-2` | The clarinet's rising scale to Ab5 and slow trill | roll | 48 | 39 | 253.1-261.8 |
| `a-major-song` | The tender violin song in A major | pack | 73 | 73 | 265.5-306.7 |
| `a-major-bass` | Its soft bass, a note every few seconds | pack | 8 | 8 | 278.4-304.4 |
| `harp-arpeggio` | Harp-like rolled chords colouring the song | roll | 25 | 11 | 290.3-303.0 |
| `dissolve-murmur` | pp low strings dissolving, C#3 repeats, the Ab1 shudder | pack | 167 | 166 | 307.1-355.2 |
| `dissolve-audio` | The faintest touches of the dissolve, from the audio | audio | 26 | 26 | 308.4-329.9 |
| `dominant-swell` | The C# swell fading into the grand pause | mixed | 17 | 17 | 355.0-360.1 |
| `friska-dawn` | The friska's first high pp staccato tune (clarinet, high winds) | mixed | 50 | 46 | 363.6-384.8 |
| `friska-strings-theme` | The violins' staccato C#5s and leaps, p to f | mixed | 77 | 77 | 385.4-410.3 |
| `friska-vamp-bass` | The oom-pah bass of the friska | pack | 103 | 103 | 386.6-480.2 |
| `cimbalom-tremolo` | A chord shaken fast, twice (407.6, 522.3 s) | roll | 87 | 30 | 407.6-524.1 |
| `tutti-1-blows` | The first friska tutti, ff chords | pack | 44 | 22 | 410.7-420.3 |
| `deep-tolls` | Bb0/C#1 tolls under every friska tutti | pack | 104 | 104 | 411.5-627.1 |
| `friska-tune` | The C6-C#6 neighbour-note shake of the F# major tune | pack | 15 | 15 | 422.5-437.0 |
| `friska-offbeats` | The off-beat "pah" chords, mid register | pack | 104 | 52 | 422.5-455.9 |
| `glitter-2` | The friska's glitter up to Eb7/F#7 | pack | 98 | 66 | 438.4-452.4 |
| `voice-line-friska` | A falling wind line (lane label "voice": unsure) | roll | 16 | 16 | 446.7-452.4 |
| `friska-violins` | The violins' line through the friska, continuous | roll | 302 | 302 | 421.3-568.5 |
| `build-2-line` | The second build's tune, p to F6 | pack | 16 | 16 | 458.4-479.8 |
| `dominant-pedal` | The insisting G# pedal before the stomp | pack | 25 | 20 | 469.2-480.2 |
| `stomp-blows` | The stomping tutti's hammered chords | pack | 34 | 17 | 482.8-498.7 |
| `brass-descents` | Two descents in brass octaves | roll | 36 | 14 | 487.8-552.6 |
| `high-whirl` | The violins whirling F#6-F#7 | pack | 56 | 43 | 501.0-509.9 |
| `dip-line` | The murmured tune in the dip | pack | 11 | 11 | 511.7-526.1 |
| `fireworks` | The highest burst: single notes flung to F7/G7, ff (a spray, not chord blows) | pack | 33 | 28 | 527.1-534.4 |
| `plunge` | The plunge from the top to C1 | pack | 16 | 16 | 534.4-539.4 |
| `loudest-stomp-blows` | The loudest stretch's tutti chords | pack | 34 | 17 | 539.8-568.2 |
| `stomp-bursts` | Three bursts of octave chords every ~0.1 s | roll | 66 | 33 | 557.1-563.9 |
| `high-tremolo` | The high C#7/Eb7 tremolo dying away | pack | 128 | 111 | 570.7-583.6 |
| `prestissimo-repeats` | The pp prestissimo's fast A4/B4-C#5 alternations | pack | 177 | 124 | 584.2-603.3 |
| `prestissimo-bass` | The dry C#3 pulse under it | pack | 25 | 25 | 584.6-599.9 |
| `stretta-chords` | The final stretta's chords, pp to ff | pack | 118 | 59 | 606.3-619.5 |
| `final-chords` | The last blows: B, Bb0/A1, the F# major chords | pack | 38 | 23 | 619.1-627.1 |
| `melody-all` | The voiced-out tune of the whole piece (not in the dissolve) | pack | 712 | 711 | 3.4-626.8 |
| `bass-all` | The bass of the whole piece, >= 0.4 s apart | pack | 227 | 227 | 5.6-624.6 |
| `long-tones` | Notes held >= 1.5 s: for handovers and slow morphs | pack | 163 | 163 | 3.4-624.6 |
| `ff-blows` | Every full ff chord (3+ notes, velocity 105+, reaching below midi 50): the Fireworks set | pack | 78 | 39 | 78.8-626.1 |
| `violin-line` | The violins' top line (YourMT3+ lane) | roll | 322 | 322 | 5.5-627.3 |
| `viola-inner` | The violas' held inner line | roll | 134 | 134 | 5.5-624.8 |
| `cello-line` | The cellos' line from the bottom | roll | 154 | 154 | 5.5-619.5 |
| `clarinet-all` | Every clarinet note: the solo voice | roll | 154 | 145 | 93.8-376.7 |
| `runs` | The fast scales and flourishes (cadenzas, glitter, friska runs) | pack | 51 | 50 | 95.0-575.3 |
| `repeats` | One pitch struck 5+ times in a row, top or bottom of the texture | pack | 499 | 479 | 51.4-626.3 |

## The holes

Here a clip on a lane goes black, or the music has (almost) no attacks. dB is rms against the peak. "Pack/s" is
pack notes a second. "Audio onsets" counts those at z >= 2.5.

| span (s) | dB mean (max) | pack/s | lanes | audio onsets | what it is | what covers it |
|---|---|---|---|---|---|---|
| 0.0-3.37 | -76 (-47) | 0.3 | none | 2 | silence before the first note | black or a fade-in; the first note is at 3.37 s |
| 99.9-103.9 | -27 (-25) | 0.8 | none | 5 | a held B hush after cadenza I | a field or a slow trace; `cadenza-hush-knocks` (5 soft touches) |
| 109.0-110.0 | -39 (-27) | 0 | none | 0 | a breath in the interlude | let it fade |
| 251.5-253.0 | -32 (-18) | 0 | none | 0 | silence after the climax cut-off (deliberate) | nothing: the cut is the event |
| 261.5-264.5 | -34 (-24) | 0.7 | none | 1 | hush after cadenza II | a dim field |
| 280.5-290.0 | -25 (-16) | 4.0 | thin (26) | 9 | the A-major song, thinner | `a-major-song`, `long-tones` |
| 307.0-330.0 | -32 (-21) | 3.1 | almost none (23) | 26 | the dissolve, pp | `dissolve-murmur`, `dissolve-audio`, fields, the current's thread; no busy red |
| 330.0-355.5 | -30 (-21) | 5.9 | cello 3 | 25 | the dissolve, low | `dissolve-murmur`, `bass-all`, `repeats` |
| 358.0-361.5 | -27 (-19) | 0 | none | 4 | the C# swell fading | `dominant-swell` (its audio part) |
| 361.5-363.4 | -45 (-37) | 0 | none | 0 | the grand pause: true silence | nothing |
| 363.4-368.8 | -31 (-23) | 0.7 | clarinet 1 | 9 | the friska's first pp bars | `friska-dawn` (audio onsets) |
| 368.8-377.0 | -28 (-20) | 4.1 | clarinet 28 | 12 | the clarinet's friska tune | `friska-dawn`, `clarinet-all` |
| 377.0-385.0 | -29 (-20) | 0.5 | none | 8 | the friska tune before the violins enter | `friska-dawn` (audio onsets) |
| 584.0-602.5 | -23 (-17) | 13.1 | 20 notes | 14 | the pp prestissimo: the lanes miss it | `prestissimo-repeats`, `prestissimo-bass` (pack): never a lane |
| 602.5-605.6 | -29 (-23) | 0.6 | none | 2 | hush before the stretta | a dim field |
| 619.6-620.4 | -26 (-12) | 0 | none | 0 | the rest before the last blow | nothing |
| 620.6-624.4 | -5 (-1) | 0.8 | strings 8 | 1 | an ff chord held with no new attack | something that sustains without attacks (a field, a held state); nothing may look like a new blow |
| 627.4-631.2 | -63 (-7) | 0 | none | 0 | the last chord's decay, silence from 628.6 s | the fade |

## The weight table: which strands are prominent, per 30 s

This is the table to start a score of always-on threads from. A weight of 1 means the strand leads, and about 0.3
means it is a dim trace. Put at least four threads on screen, except at the spare places marked **spare**. The lanes
(`violin`, `viola`, `cello`, `clarinet`) are honest track listens. They are empty where the holes table says so.

| window | loudness | what happens | strands (weight) |
|---|---|---|---|
| 0-30 | 0.78 | Lento I | lento-proclamations 1 · lento-knocks 0.8 (3.4, 8.3, 18.3, 21.1) · lento-strokes 0.7 · long-tones 0.6 · bass-all 0.4 · violin-line 0.2 |
| 30-60 | 0.74 | Lento I ends; lassan in the cellos (40.4); f at 56.0 | lento-proclamations 0.6 (to 40.4) · lassan-theme-cellos 1 (40.4-56) · lassan-bass 0.8 · cello-line 0.7 · long-tones 0.5 · lassan-theme-strings 1 (from 56) |
| 60-90 | 0.92 | lassan theme in full strings, to ff | lassan-theme-strings 1 · violin-line 0.7 · lassan-bass 0.6 · viola-inner 0.5 · lassan-ff-peaks 0.8 (76-92) · long-tones 0.5 · repeats 0.3 |
| 90-120 | 0.70 | ff cut at 92.5; **spare**: clarinet cadenza I and the hush (92.5-103.9); G# interlude | clarinet-cadenza-1 1 · cadenza-hush-knocks 0.4 · gsharp-repeats 0.8 (104-113) · interlude-line 0.8 · clarinet-garlands 0.7 (113-125) · runs 0.5 · long-tones 0.3 |
| 120-150 | 0.71 | interlude; the dance (131); glitter (136.5-147.5) | interlude-line 0.7 (to 131) · dance-lilt 1 · dance-pedal 0.6 · glitter-1 1 · violin-line 0.6 · viola-inner 0.4 · repeats 0.4 |
| 150-180 | 0.77 | dance; high shake (160); **spare**: clarinet sinking (166-173.9); Lento II at 173.9 | dance-lilt 0.8 · high-alternation 0.9 · clarinet-sinking 1 · lento-proclamations-return 1 (from 173.9) · lento-knocks 0.8 · lento-strokes 0.7 |
| 180-210 | 0.88 | Lento II | lento-proclamations-return 1 · lento-knocks 0.8 · lento-strokes 0.7 · long-tones 0.6 · bass-all 0.4 |
| 210-240 | 0.83 | lassan theme returns, low, f | lassan-theme-return 1 · lassan-bass 0.8 · cello-line 0.7 · viola-inner 0.5 · violin-line 0.4 · repeats 0.4 |
| 240-270 | 0.78 | climax (246.4-251.5); silence; **spare**: cadenza II (251.5-264.5); A-major song | lassan-ff-peaks 0.9 · climax-strokes 1 · clarinet-cadenza-2 1 · a-major-song 0.8 (from 264.5) · long-tones 0.4 |
| 270-300 | 0.68 | the A-major song, p | a-major-song 1 · violin-line 0.6 · long-tones 0.6 · cello-line 0.5 · harp-arpeggio 0.7 (290-304) · a-major-bass 0.4 |
| 300-330 | 0.50 | song ends (307); the dissolve, pp | a-major-song 0.7 (to 307) · dissolve-murmur 0.8 · dissolve-audio 0.6 · bass-all 0.5 · long-tones 0.4 (quiet, no busy textures) |
| 330-360 | 0.53 | the dissolve, low; the C# swell (355.5) | dissolve-murmur 1 · bass-all 0.7 · repeats 0.5 (C#3, Ab1) · dominant-swell 1 (355.5-361.5) · cello-line 0.2 |
| 360-390 | 0.61 | **spare**: grand pause (361.5-363.4); friska dawn, pp; violins at 385 | friska-dawn 1 · clarinet-all 0.8 · friska-strings-theme 1 (from 385) · violin-line 0.5 · friska-vamp-bass 0.4 |
| 390-420 | 0.88 | violins' friska, crescendo; cimbalom (407.6); first tutti (410.4) | friska-strings-theme 1 · friska-vamp-bass 0.8 · violin-line 0.7 · cimbalom-tremolo 1 · tutti-1-blows 1 · deep-tolls 0.9 · ff-blows 0.8 |
| 420-450 | 0.76 | the friska tune in F# major, p; glitter (438-453) | friska-violins 1 · friska-tune 0.8 · friska-offbeats 0.7 · friska-vamp-bass 0.7 · glitter-2 1 · voice-line-friska 0.5 |
| 450-480 | 0.81 | second build (456); G# pedal (468-480) | friska-violins 0.9 · build-2-line 0.7 · friska-vamp-bass 0.8 · dominant-pedal 0.8 · repeats 0.4 · viola-inner 0.3 |
| 480-510 | 0.93 | stomping tutti; high whirl (500.4) | stomp-blows 1 · deep-tolls 1 · ff-blows 0.9 · friska-violins 0.8 · brass-descents 0.7 (487.8) · high-whirl 1 |
| 510-540 | 0.75 | dip (510.3); cimbalom (522.3); fireworks (527-534.4); plunge | dip-line 0.7 · friska-violins 0.8 · cimbalom-tremolo 0.9 · fireworks 1 · plunge 0.9 · deep-tolls 0.7 |
| 540-570 | 0.98 | the loudest stomp | loudest-stomp-blows 1 · deep-tolls 1 · stomp-bursts 0.9 · friska-violins 0.9 · brass-descents 0.7 (551) · ff-blows 0.8 · viola-inner 0.5 |
| 570-600 | 0.62 | the stomp breaks off (570.4); high tremolo dying; prestissimo pp (584) | high-tremolo 1 · prestissimo-repeats 1 · prestissimo-bass 0.7 · repeats 0.5 · long-tones 0.3 |
| 600-631 | 0.76 | prestissimo; hush (602.5); stretta (605.6); last chords (619.0-627.0) | prestissimo-repeats 0.7 · stretta-chords 1 · deep-tolls 0.8 · ff-blows 0.9 · final-chords 1 · bass-all 0.4 |

## Notes for the composers

- **Fireworks:** only on the chord-blow sets: `ff-blows`, `tutti-1-blows`, `stomp-blows`, `loudest-stomp-blows`,
  `final-chords`, or the lassan's `climax-strokes`.
  - In the lassan, the only real blows are one ff chord at 78.8 s (in `ff-blows`) and the climax strokes of
    246.4-251.5 s.
  - `fireworks` (527-534 s) is a spray of single high notes. It suits sparks and glitter widgets, not Fireworks.
- **Flee:** masses of unorganised notes with no pick set. The lanes in the friska hold 120-170 notes per 30 s:
  `listen` `violin`, `viola`, `cello` or `all` in 420-570 s.
- **Handover:** on `long-tones`, in the Lento (S1, S8), the lassan theme (S2, S3, S9) and the A-major song (S12).
- **Ivory rows:**
  - one per Lento phrase: the phrases begin at 3.4, 5.5, 8.3, 10.3, 12.4, 15.7, 18.3, 20.1, 22.4, 26.3 and 30.9 s,
    and again 170.5 s later;
  - or one per lassan-theme phrase.
- **No fake attacks:**
  - The held ff chord at 620.6-624.4 s and the swell at 358-361.5 s have no attacks. Keep them sustained.
  - The grand pause (361.5-363.4 s) and 251.5-253.0 s are silence.
- **Spare entrances:**
  - the clarinet cadenzas (92.5-103.9 s, 251.5-264.5 s);
  - the clarinet sinking (166-173.9 s);
  - the grand pause and the friska dawn (361.5-385 s);
  - the high tremolo into the prestissimo (570.4-605.6 s, dying).
- **Pick sources:**
  - `pack` sets are not on the picker's roll. Composers build shows from picks.json, so this only matters in the
    studio.
  - In the lassan, the lanes are thin: S1, S8, the dissolve, and the prestissimo. Prefer the `pack` sets there over a
    lane listen.
