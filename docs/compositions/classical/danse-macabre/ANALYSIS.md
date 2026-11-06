# Danse macabre: analysis for the composers

Saint-Saëns, *Danse macabre*, Op. 40 (`songs/danse-macabre`, 429.8 s, ensemble, onset coverage 38 %). Pick sets are in
`picks.json` next to this file. `gen-picks.mjs` makes them; it is deterministic, so run
`node docs/compositions/classical/danse-macabre/gen-picks.mjs` from the worktree root. `--verbose` prints every pitch with
its time, and `--form` adds the per-section numbers in the form table below.

How the form was found:
- **The notes.** The roll is `pack.tracks`, which is what the studio picker shows for this pack. Each set dedupes on
  start (to 10 ms) and pitch, because YourMT3 doubles lanes. Per 4 s I counted attacks (the 40 ms rule), notes per
  attack, velocities, range and how many notes sit below MIDI 50.
- **The audio**, with librosa: rms in dB, `onset_detect` on the whole signal and on its percussive part, and
  `chroma_cqt`.
- **Chroma template matching.** I slid a 7–14 s chroma window of each theme over the piece, in all 12 transpositions.
  This found every later entry of themes A and B, and their keys. It works on harmony, so it is not a note-level claim.
- **The cock-crow and the violin's farewell**, checked with pyin and a CQT peak.

The track labels are YourMT3's. Name a track in `listen` only from this list: `piano` `plucked` `violin` `viola`
`cello` `strings` `voice` `brass` `oboe` `clarinet` `bassoon`. The xylophone (YourMT3's "Chromatic Percussion"), the
drums, the flute ("Pipe") and the harp rows of `notes.ymt3.json` never reached a track. The only way to reach them is
through the picks `xylophone-bones`, `drum-strikes`, `theme-a-flute` and `harp-chords-31`. The `piano` track is mostly
repeated-chord figures (hammered sixteenths) and low tremolo octaves, not a piano.

## The form

The **match** column is the share of roll attacks that have an audio onset within 60 ms. Below about 10 % the roll's
attacks are legato note changes: you hear them as a new pitch, but nothing *strikes*. Widgets that flash on attacks will
fake strikes there (see Holes). **dB** is the mean of 0.5 s maxima relative to the loudest moment of the song.

| start | end | name | character | roll att/s · match · dB | sets that sound there |
|---|---|---|---|---|---|
| 0.0 | 9.6 | **Midnight** | The harp strikes twelve soft D4s, one a bar (0.19, 0.97, 1.73, 2.52, 3.32, 4.11, 4.90, 5.67, 6.43, 7.21, 7.98, 8.81). A held D underneath. Hushed, pp | 1.4 · 69 % · −27 | `clock-strokes` |
| 9.6 | 13.6 | **The hush** | A pp D major chord at 9.62, then only the held D4 dying away. Nothing is struck | 0.3 · 0 % · −40 | `hush-chord` (1 attack), then nothing: **hole** |
| 13.6 | 18.85 | **Death appears** | Low pizzicato, one note a bar: D2 (13.61) and A2 (14.33), both from the audio, then a diminished chord climbs C2–F#2–A2–C2–Eb2 (15.05–18.09) | 1.0 · 40 % · −27 | `grave-pizz` |
| 18.85 | 26.0 | **Death tunes his fiddle** | The solo violin's A–Eb tritone double stops (scordatura), answered by open D–A fifths, quickening from 2 s apart to 0.1 s (the three tritones at 22.75/22.84/22.94) | 2.7 · 79 % · −18 | `tuning-tritone`, `tuning-fifths` |
| 26.0 | 41.3 | **Theme A: the waltz (flute)** | D (26.03), then the G minor downbeat (26.37) starts the dance. Pizzicato oom-pah-pah. The flute's theme A runs in two 7 s phrases (26.4, 33.5), with soft harp chords at 30.9–32.5 | 5.6 · 35 % · −22 | `dance-begins`, `pizz-waltz-bass`, `theme-a-flute`, `harp-chords-31` |
| 41.3 | 55.1 | **Theme B: solo violin** | The solo violin's sighing chromatic descent G–F–E–Eb–D, in four ~3.9 s phrases (41.3, 45.2, 49.2, 52.9), over pizzicato | 4.7 · 31 % · −20 | `theme-b-solo-violin` (+ `-p1..p4`), `pizz-waltz-bass` |
| 55.1 | 68.5 | **Theme A in D** | Theme A a fifth up, D minor (chroma match 0.61 at 55.1 and 61.7), with oboe/clarinet colour and hammered D chords (57.5–59.2) | 7.0 · 38 % · −19 | `theme-a-in-d`, `winds-56`, `pizz-waltz-bass` |
| 68.5 | 71.7 | **Swell** | Crescendo; the violins rock A4–Eb5, the tritone again | 7.5 · 38 % · −12 | `build-to-tutti` |
| 71.7 | 86.4 | **Theme A tutti** | Theme A forte in G minor (match 0.73 at 71.7 and 0.69 at 78.6), violins high on Bb5–Ab5–C6. Hammered sixteenth chords at 79.9–83.9 (G minor, then Ab): rattling bones | 6.1 · 26 % · −12 | `theme-a-tutti`, `hammered-chords-80`, `bass-tutti-1` |
| 86.4 | 100.6 | **Theme B tutti** | Theme B sung by all the strings, forte and **legato** (match 0.85 at 86.4 and 0.77 at 94.1). The loudest sustained stretch so far, and nearly no audible onsets | 3.8 · **0 %** · −9 | `theme-b-tutti` (+ `-p1..p3`), `bass-tutti-1` |
| 100.6 | 115.4 | **Theme A in D with xylophone** | Theme A in D again (match 0.70 at 100.7 and 107.9). The xylophone rattles at 104.7–106.2 and 111.8–114.6. Repeated D chords pulse 102.7–111.2 | 6.9 · 33 % · −15 | `theme-a-xylophone-d`, `xylophone-bones`, `repeated-d-chords`, `bass-tutti-1` |
| 115.4 | 120.4 | **Close of the exposition** | D–A tremolo, then the octave D blow D1–D4 (118.21, v106). Theme B's harmony again at 118.8 | 4.0 · 35 % · −12 | `exposition-close`, `ff-blows-early` |
| 120.4 | 149.5 | **Fugato** | A chromatic subject (F–E–Eb–D…) enters low in the cellos at 120.5. Voices pile up and climb, and the brass enters at 145.5. Busy and organised | 6.0 · 30 % · −15 | `fugato-subject-low`, `fugato-high`, `brass-calls` |
| 149.5 | 162.4 | **E pedal** | Low E2 struck again and again (a toll). Theme fragments in E above (theme A +9 at 157.2), woodwinds at 156–158 | 6.2 · 33 % · −15 | `pedal-e-toll`, `pedal-line-high`, `winds-156` |
| 162.4 | 175.4 | **A pedal** | The same over A2, crescendo to the brass and the peak at 175.3. Hammered Ab octaves at 170–172 | 6.1 · 23 % · −13 | `pedal-a-toll`, `pedal-line-high`, `brass-calls` |
| 175.4 | 213.0 | **The chorale** | Sudden drop to a slow, legato major-key chorale (B major). Its top line falls chromatically B–Bb–A–G, like theme B, while its chroma is closest to theme A transposed to B (match 0.45–0.55; theme B only 0.36): read it as either, and the research calls it the Dies irae chorale. Four phrases repeat every ~8.4 s (175.9, 184.3, 192.5, 200.9), and harp arpeggios ripple around them | 5.3 · **0 %** · −17 | `chorale-top` (+ `-p1..p4`), `chorale-bass`, `harp-arpeggios`, `chorale-pulse` |
| 213.0 | 222.0 | **Build** | Out of the chorale: an Eb6 tremolo above, A/Ab octaves hammered low, crescendo | 8.3 · 27 % · −14 | `build-213`, `bass-tutti-2` |
| 222.0 | 244.5 | **Second tutti** | A new ff tutti (its chroma matches nothing earlier) with brass at 228–231. The xylophone returns at 233.5–239.1 with ff stamps (237.2–238.9) | 6.4 · 23 % · −9 | `tutti-c-line`, `bass-tutti-2`, `xylophone-bones`, `brass-calls` |
| 244.5 | 248.0 | **Break** | The tutti breaks off on chords at 244.08 and 246.0 | 1.1 · 0 % · −12 | `stop-244`, `ff-blows-early` |
| 248.0 | 272.5 | **Woodwind interlude** | Quiet (−24 dB). Bassoons, clarinets and oboe pass fragments around over soft strings. A quick cascade tumbles down from G5 at 261.7–264.7 | 4.7 · 8 % · −24 | `winds-interlude`, `interlude-strings`, `cascade-262` |
| 272.5 | 297.0 | **Development over D** | D and C# pedals, theme A fragments in D in the violins (match ~0.47 at 283.4), building | 5.3 · 23 % · −19 | `development-line`, `bass-development` |
| 297.0 | 320.4 | **The long build** | Theme A in D, forte to ff, mostly legato (few onsets). Repeated D chords at 303.2–305.0 | 6.2 · 7 % · −10 | `build-line`, `repeated-d-303`, `bass-development` |
| 320.4 | 322.8 | **Chromatic ascent** | A rising chromatic scale, D4 to F#5 in 2.4 s, launching the return | 7.9 · 0 % · −13 | `chromatic-ascent` |
| 322.8 | 338.0 | **Recapitulation** | ff in G. Theme B's harmony returns (match 0.65 at 324.0 and 0.61 at 331.0) against theme A rhythm, with drum strokes at 330.6, 331.4 and 336.0–337.2 | 5.7 · 15 % · −5 | `recap-theme-b-line`, `recap-high`, `bass-finale`, `drum-strikes` |
| 338.0 | 360.8 | **Recapitulation, second half** | D pedal, brass at 340–344, a drum roll at 342.2–343.7, themes intertwined | 6.9 · 17 % · −8 | `recap-line`, `recap-high`, `brass-calls`, `drum-strikes`, `bass-finale` |
| 360.8 | 376.9 | **The frenzy and the last blows** | The loudest stretch (−3 dB): blows from 361.9, a timpani roll at 364.7–366.6, F#–G octaves hammered at 370.73–371.43, the G pedal over a low A–Bb trill at 372.73–374.71, and nine brass D4+G4 blows at 374.89–376.80, growing to 0 dB | 6.8 · 25 % · −3 | `frenzy-line`, `ff-blows`, `octave-hammer-g`, `bass-trill`, `final-hammer`, `drum-strikes` |
| 376.9 | 383.6 | **Cock-crow** | Everything stops and the sound decays. In the near-silence a thin high woodwind call, the oboe's cock-crow: Eb5, Bb5, Eb5, then G5 held from 380.25 to 383.3. The roll has nothing here | 0 · — · −16 | `cock-crow` (audio) |
| 383.6 | 395.3 | **Dawn** | An sf chord (C#–G–Bb–Eb, 383.66), a dying measured tremolo (385.0–386.5), soft rolled harp G major chords (389.65, 390.58), G–Bb–Eb (391.59), G minor (394.02) | 2.1 · 4 % · −25 | `dawn-chords`, `dawn-tremolo` |
| 395.3 | 418.0 | **The violin's farewell** | The solo violin alone, pp (−30 dB): Bb–A–G, Bb–G–F–Eb, Eb–Ab–Bb–C–Eb. Long notes, one every 1–3 s | 0.6 · 14 % · −30 | `farewell-violin` |
| 418.0 | 424.0 | **The skeletons flee** | The violin's D–Eb trill (418–420), then a last pizzicato scurry and a flutter up to D6 (420–423.9) | 9.5 · 25 % · −32 | `last-trill`, `scurry` |
| 424.0 | 429.8 | **The end** | The bass falls Bb1–G1–D2 in pizzicato, then two last chords, D major (425.38) and G minor (426.24). Silence | 0.9 · 20 % · −45 | `final-pizz` |

### Recurring events

| event | times (s) | set |
|---|---|---|
| clock strokes (harp D4) | 0.19 … 8.81, 12 strokes | `clock-strokes` |
| tritone (Death's fiddle) | 18.88–25.69; it echoes in the violins at 68.5–71.6 (A4–Eb5) | `tuning-tritone`, `build-to-tutti` |
| hammered repeated chords | 57.5–59.2, 79.9–83.9, 102.7–111.2, 303.2–305.0 | `hammered-chords-80`, `repeated-d-chords`, `repeated-d-303` |
| xylophone (bones) | 104.7–106.2, 111.8–114.6, 233.5–239.1 | `xylophone-bones` |
| tolls (pedal notes struck again and again) | E2 149.7–162.2, A2 162.6–175.4 | `pedal-e-toll`, `pedal-a-toll` |
| brass entries | 145.5–149, 170–176, 228–231, 340–344, 374.9–376.8 | `brass-calls` |
| drum strokes and rolls | 330.6, 331.4, 336.0–337.2, 342.2–343.7, 364.7–366.6 (and two weak ones at 151.7 and 158.4) | `drum-strikes` |
| real ff blows (Fireworks) | 313.38, 336.26, 361.90, 364.44, 367.34, 371.21, 373.98, plus the nine of `final-hammer` | `ff-blows`, `final-hammer` |
| strong strikes, not ff | 26.37, 118.21, 237.78, 244.08 | `ff-blows-early` |
| theme A entries (chroma) | 26.4 & 33.5 (G), 55.1 & 61.7 (D), 71.7 & 78.6 (G, tutti), 100.7 & 107.9 (D), fragments at 157, 283, 305, 339, 357, 373.7 | the theme-a sets |
| theme B entries (chroma) | 41.3 & 48.8 (solo), 86.4 & 94.1 (tutti), 118.8, 324.0 & 331.0 (recap); the chorale's top line descends like it (176–207) | the theme-b sets, `chorale-*` |

## The sets

Each entry in `picks.json` holds `hears`, `section`, `source`, `rule`, `attacks`, `span` and `notes`. In the table, att is
the attack count (40 ms rule). Sources:
- `roll`: `pack.tracks`, as the picker shows it.
- `pack`: the piano model, which keeps real attack strength.
- `ymt3`: YourMT3 rows that never reached a track.
- `audio`: the cock-crow, two pizzicato notes and one pyin correction.

Phrase sets (`-p1`, `-p2`, …) cut a line into one short Ivory row per phrase.

| id | att / notes | span (s) | source | what one hears |
|---|---|---|---|---|
| `clock-strokes` | 12 / 12 | 0.19–12.50 | pack | the harp strikes midnight, twelve D4s |
| `hush-chord` | 1 / 5 | 9.62–10.24 | roll | the pp D major chord after the twelfth stroke |
| `grave-pizz` | 7 / 10 | 13.61–18.43 | audio+roll | low pizzicato climbing D–A, then C–F#–A–C–Eb, one note a bar |
| `tuning-tritone` | 12 / 24 | 18.88–25.95 | roll | Death's fiddle: the A–Eb tritone double stops |
| `tuning-fifths` | 7 / 14 | 19.88–25.63 | roll | the open D–A fifths between them |
| `dance-begins` | 2 / 6 | 26.03–27.29 | pack | the D chord and the G minor downbeat that start the dance |
| `pizz-waltz-bass` | 39 / 39 | 26.36–69.10 | roll | the pizzicato waltz downbeats under themes A and B |
| `theme-a-flute` | 27 / 27 | 26.75–41.11 | roll+ymt3 | the flute's theme A. Thin: the YourMT3 flute rows (28.8–30.7) plus high string doublings (Bb5–C6 at 34–40) |
| `harp-chords-31` | 6 / 18 | 30.90–32.57 | ymt3 | soft harp F minor chords under the flute |
| `theme-b-solo-violin` | 33 / 33 | 41.59–55.69 | roll | the solo violin's theme B (verified against the audio's high line) |
| `theme-b-solo-p1` … `p4` | 6, 12, 6, 9 | 41.6–45.1, 45.4–49.4, 49.4–53.0, 53.0–55.7 | roll | its four phrases: G-F-E-Eb / D-E-G-F#-E-D-E-F# / G-F-Eb-D / G-Bb-A-F#-D-F#-A-E-D |
| `theme-a-in-d` | 15 / 15 | 55.79–65.53 | roll | theme A in D, the high line, strings plus oboe/clarinet |
| `winds-56` | 24 / 24 | 55.79–65.53 | roll | oboe and clarinet (doubled lanes) inside it |
| `build-to-tutti` | 10 / 10 | 68.59–71.57 | roll | the violins rocking A4–Eb5 into the tutti |
| `theme-a-tutti` | 14 / 14 | 72.01–84.81 | roll | theme A forte: Bb5–Ab5–C6 |
| `hammered-chords-80` | 23 / 46 | 79.89–83.92 | roll | sixteenth chords hammered, G minor, then Ab |
| `theme-b-tutti` | 27 / 27 | 86.45–100.78 | roll | theme B, all the strings, legato forte |
| `theme-b-tutti-p1` … `p3` | 7, 11, 9 | 86.5–89.9, 90.3–94.1, 95.1–100.8 | roll | its three phrases |
| `theme-a-xylophone-d` | 37 / 37 | 100.84–114.82 | roll | theme A in D, the violins' high line |
| `xylophone-bones` | 50 / 50 | 104.72–239.29 | ymt3 | the xylophone, three passages |
| `repeated-d-chords` | 16 / 32 | 102.68–111.44 | roll | repeated D chords pulsing under it |
| `exposition-close` | 18 / 36 | 115.40–120.83 | pack | the D–A tremolo and the D octave blow |
| `bass-tutti-1` | 42 / 42 | 71.95–118.82 | roll | the bass of the first tutti, one a beat |
| `fugato-subject-low` | 26 / 26 | 120.87–149.50 | roll | the fugato subject in the cellos, F–E–Eb–D… |
| `fugato-high` | 21 / 21 | 125.05–148.11 | roll | the upper fugato voices entering |
| `brass-calls` | 42 / 85 | 145.48–376.82 | roll | every brass entry (five passages) |
| `pedal-e-toll` | 27 / 27 | 149.69–162.17 | roll | the E2 toll |
| `pedal-a-toll` | 32 / 32 | 162.59–175.36 | roll | the A2 toll, crescendo |
| `pedal-line-high` | 47 / 47 | 149.69–174.07 | roll | the violins over the pedals |
| `winds-156` | 4 / 12 | 156.13–157.69 | roll | a woodwind phrase in the E pedal |
| `chorale-top` | 23 / 23 | 176.44–212.99 | roll | the chorale's long top notes, B–Bb–A–G… (theme B's descent; chroma closer to theme A in B) |
| `chorale-p1` … `p4` | 7, 5, 5, 6 | 176.4–185.7, 185.7–196.0, 195.0–201.6, 201.5–213.0 | roll | its four phrases; long notes, so handover is allowed |
| `chorale-bass` | 14 / 14 | 177.31–212.99 | roll | the chorale's slow B pedal |
| `harp-arpeggios` | 80 / 80 | 178.26–208.89 | roll | the harp rippling around the chorale |
| `chorale-pulse` | 31 / 35 | 199.34–208.89 | roll | repeated B/F# figures, a faint pulse |
| `build-213` | 33 / 55 | 215.14–221.18 | roll | the Eb6 tremolo and the hammered octaves of the build |
| `tutti-c-line` | 21 / 21 | 223.74–243.91 | roll | the second tutti's violin line |
| `bass-tutti-2` | 25 / 25 | 213.15–243.71 | roll | its bass |
| `stop-244` | 3 / 11 | 244.08–246.32 | pack | the chords where it breaks off |
| `winds-interlude` | 55 / 154 | 245.91–272.38 | roll | bassoons, clarinets and oboe alone (doubled lanes: about 3 notes an attack) |
| `interlude-strings` | 12 / 12 | 254.17–268.28 | roll | the soft strings under them |
| `cascade-262` | 30 / 31 | 261.70–264.70 | roll | the quick cascade down from G5 |
| `bass-development` | 34 / 34 | 275.19–322.61 | roll | the D/C# pedals and the bass of the build |
| `development-line` | 28 / 28 | 272.68–297.47 | roll | the violins over the D pedal |
| `build-line` | 33 / 33 | 297.82–319.48 | roll | theme A in D, rising to ff |
| `repeated-d-303` | 12 / 23 | 303.19–305.14 | roll | repeated D chords |
| `chromatic-ascent` | 13 / 13 | 320.40–323.02 | roll | the chromatic scale up, D4 to F#5 |
| `recap-theme-b-line` | 15 / 15 | 325.64–337.91 | roll | the recapitulation's held string notes (theme B's harmony; not a clean tune) |
| `recap-high` | 13 / 13 | 323.96–360.44 | roll | the violins' highest notes in the recapitulation |
| `recap-line` | 10 / 10 | 338.37–360.44 | roll | the violin line of the recapitulation's second half (sparse) |
| `frenzy-line` | 15 / 15 | 361.09–370.68 | roll | the top line of the frenzy |
| `bass-finale` | 33 / 33 | 323.61–374.16 | roll | the bass of the recapitulation and the frenzy |
| `drum-strikes` | 32 / 48 | 151.68–366.60 | ymt3 | the bass drum and timpani strokes and rolls |
| `octave-hammer-g` | 22 / 44 | 370.73–374.77 | roll | the F#–G octaves hammered, then the G pedal blows |
| `bass-trill` | 19 / 38 | 372.73–374.77 | roll | the low A–Bb trill under the G pedal |
| `final-hammer` | 9 / 18 | 374.89–376.82 | roll | the nine last brass blows, D4+G4 |
| `thread-high` | 216 / 216 | 9.62–428.02 | roll | **whole piece**: the voiced-out high line (held ≥ 0.28 s, ≥ G4) |
| `thread-mid` | 200 / 200 | 9.62–428.02 | roll | **whole piece**: the middle voice (G3–C5), where theme B lives |
| `thread-low` | 244 / 244 | 15.05–428.02 | roll | **whole piece**: the bass, at most one note per 0.5 s |
| `long-notes` | 92 / 92 | 8.80–428.02 | roll | **whole piece**: every held note ≥ 1.0 s, the handover set |
| `ff-blows` | 7 / 14 | 313.38–374.11 | pack | the real fortissimo blows: wide chords with bass at loudness ≥ 0.86, one per 2 s |
| `ff-blows-early` | 4 / 8 | 26.37–244.21 | pack | the strongest strikes of the first half (not ff: −5 to −12 dB) |
| `cock-crow` | 4 / 4 | 378.95–383.30 | audio | the oboe's cock-crow: Eb5, Bb5, Eb5, then G5 held |
| `dawn-chords` | 9 / 30 | 383.66–395.25 | pack | the pale chords of dawn (a rolled harp chord counts as 4 attacks) |
| `dawn-tremolo` | 16 / 16 | 385.02–387.06 | roll | the measured tremolo dying away |
| `farewell-violin` | 15 / 15 | 395.87–417.97 | roll+audio | the solo violin's farewell. The roll's A3 at 411.58 is replaced by pyin's Bb3, and the Eb4 at 413.32 comes from the audio |
| `last-trill` | 20 / 22 | 418.00–420.03 | roll | the violin's D–Eb trill |
| `scurry` | 37 / 37 | 420.06–425.35 | roll | the last scurry and the flutter up to D6 |
| `final-pizz` | 5 / 10 | 424.07–428.02 | roll | Bb–G–D in the bass, then the D and G minor chords |

## Holes

**Kind 1: the roll is (nearly) empty.** Only widgets that draw without attacks will fill these: a field, the current's
thread, a long-held state. Otherwise use the audio picks listed.
- **9.6–13.6 s, the hush:** one chord (9.62), then a held D4 fading from −26 to −40 dB. The audio has no onset until
  13.61. Leave it for a field or the current. It is a deliberate, spare moment, not a gap to fill with busy textures.
- **13.6–15.0 s:** the first two pizzicato notes are missing from the roll. They are in `grave-pizz` from the audio.
- **376.8–383.6 s, after the last blow:** no roll notes. The sound decays from 0 dB to −30 dB. The cock-crow (audio, 4
  notes) is the only thing struck: let the picture decay with the sound, and give the crow one spare voice.
- **395.3–418 s, the farewell:** 0.6 attacks/s at −30 dB. That is the music: every one of its 15 notes is in
  `farewell-violin`. Between them, keep something soft and continuous (a field, the current) so it does not go black.
- **424–429.8 s:** five pizzicato attacks, then 2–3 s of silence to the end.

**Kind 2: the roll has attacks, the audio has (almost) none.** These are legato stretches where a "new note" is a pitch
change, not a strike. Widgets that flash or burst on every attack will make fake attacks here. Use lines that glide
(strings, the current, threads, handover on `long-notes`) and keep Flee, Fireworks and slashes away:

| stretch | match | audio onsets/s | what it is |
|---|---|---|---|
| 86.4–100.6 | 0 % | 0.6 | theme B tutti, legato forte |
| 175.4–213.0 | 0 % | 0.1 | the chorale |
| 244.5–248.0 | 0 % | 0.6 | the break (two real chords: `stop-244`) |
| 248.0–272.5 | 8 % | 1.4 | the woodwind interlude (only the cascade at 262 is struck) |
| 297.0–322.8 | 0–7 % | 0–1.0 | the long build and the chromatic ascent (bowed, not struck) |
| 322.8–360.8 | 15–17 % | 1.4–2.1 | the recapitulation. Loud but sustained: only `ff-blows`, `drum-strikes`, `brass-calls` and the bass are real strikes |
| 383.6–395.3 | 4 % | 0.1 | dawn: the chords are soft and long, so handover rather than bursts |

**Kind 3: the roll has the accompaniment but not the tune.** In these stretches the attacks are real, but the
melody one hears is not in the roll. Do not hang a motif clip on these sets expecting it to follow the tune. Let the
accompaniment strands (`pizz-waltz-bass`, `winds-56`, the bass sets) carry the motif clips:
- **26.4–41.3, theme A in the flute.** `theme-a-flute` is half YourMT3 flute rows (28.8–30.7) and half high string
  doublings (34.4–40.5). It has **no notes from 30.68 to 34.43 s**. The audio's high-register salience follows the D4
  pedal, not the flute, so the tune cannot be recovered cheaply.
- **55.1–68.5, theme A in D.** `theme-a-in-d` holds 15 scattered high notes, mostly the oboe/clarinet lane.
- **322.8–338, the recapitulation.** `recap-theme-b-line` holds the strings' held notes, not a clean theme B.
- The tutti statements (`theme-a-tutti`, `theme-a-xylophone-d`) and both theme B lines are good: the roll holds the
  tune there, and theme B was checked against the audio.

Elsewhere the match is 23–40 %. That is normal for this transcription: the pizzicato, the xylophone and the tutti
chords are real strikes.

## Weights per 30 s (the score to start from)

0–1, how strongly each strand is heard. Threads named `thread-*` and `long-notes` run the whole piece, so the always-on
score can crossfade them. The section sets are the motif strands that take over where they sound. Use **bold** strands
for the motif clips.

| window | prominent (weight) | under it | notes |
|---|---|---|---|
| 0–30 | **clock-strokes** 1 (0–9), **tuning-tritone** 1 (19–26), grave-pizz 0.7 | thread-high 0.2, long-notes 0.3 | spare entrances: one strand at a time over a dim field. The hush (9.6–13.6) is nearly empty |
| 30–60 | **theme-a-flute** 0.6 (to 41), **theme-b-solo-violin** 1 (41–55.7), pizz-waltz-bass 0.7 | thread-mid 0.6, thread-low 0.6, harp-chords-31 0.3, winds-56 0.4 (from 55.8) | the dance proper; the solo violin is the voice |
| 60–90 | **theme-a-tutti** 1 (72–85), **hammered-chords-80** 0.9 (80–84), theme-a-in-d 0.6 (to 68.5), build-to-tutti 0.7 | bass-tutti-1 0.8, thread-high 0.7, theme-b-tutti 0.6 (from 86.4) | first forte (72). The rattling chords are the bones |
| 90–120 | **theme-b-tutti** 1 (to 100.6, legato), **xylophone-bones** 1 (104.7–106.2, 111.8–114.6), theme-a-xylophone-d 0.8 | bass-tutti-1 0.8, repeated-d-chords 0.6, exposition-close 0.7 (115.4–119.5) | no attack widgets on theme B (kind-2 hole); the xylophone is the most literal "bones" strand |
| 120–150 | **fugato-subject-low** 1, **fugato-high** 0.8 (entries pile up), brass-calls 0.8 (145.5–149) | thread-low 0.7, thread-mid 0.5 | organised counterpoint: lines, not masses |
| 150–180 | **pedal-e-toll** 0.9 → **pedal-a-toll** 1 (162.4), pedal-line-high 0.7, brass-calls 0.8 (170–176) | thread-high 0.6, chorale-top 0.8 from 175.4 | the toll then the big drop into the chorale at 175.4 |
| 180–210 | **chorale-top** 1 (`-p1..p4`), **harp-arpeggios** 0.8, chorale-bass 0.6 | long-notes 0.9, chorale-pulse 0.4 (199–209) | a slow, legato chorale: no busy red textures, handover on the long notes |
| 210–240 | **tutti-c-line** 0.9 (from 222), **xylophone-bones** 1 (233.5–239.1), build-213 0.7 (213–222) | bass-tutti-2 0.8, brass-calls 0.6 (228–231), thread-high 0.7 | the second tutti; the xylophone's ff stamps at 237–239 |
| 240–270 | **winds-interlude** 1 (from 246), **cascade-262** 0.9 (261.7–264.7), stop-244 1 (244.1, 246.0) | interlude-strings 0.5, thread-mid 0.4, thread-low 0.4 | quiet (−24 dB), little is struck: soft, sparse |
| 270–300 | **development-line** 0.8, winds-interlude 0.5 (to 272.5) | bass-development 0.8 (D pedal), thread-high 0.6, thread-low 0.7 | development over D, growing |
| 300–330 | **build-line** 0.9 (to 320), **chromatic-ascent** 1 (320.4–322.8), recap-theme-b-line 0.8 (from 325) | repeated-d-303 0.7 (303–305), bass-development 0.7, recap-high 0.6, ff-blows 1 (313.4) | the long legato build: glide, don't burst, until the recapitulation |
| 330–360 | **recap-theme-b-line** 0.8 (to 338), **drum-strikes** 0.9 (330.6, 331.4, 336–337, 342–344), brass-calls 0.9 (340–344) | bass-finale 0.9, recap-line 0.5, recap-high 0.6, thread-high 0.8, ff-blows 1 (336.3) | loud and sustained; the drums are the strikes |
| 360–390 | **ff-blows** 1 (361.9 … 374.0), **octave-hammer-g** 1 (370.7–374.8), **final-hammer** 1 (374.9–376.8), frenzy-line 0.8, then **cock-crow** 1 (379–383.3), dawn-chords 0.8 | bass-finale 0.9, bass-trill 0.8, drum-strikes 0.8 (364.7–366.6), dawn-tremolo 0.5 | Fireworks only on `ff-blows` and `final-hammer`. After 376.8 the climax ends with no new attack: decay, then one thin crow |
| 390–420 | **farewell-violin** 1 (395.9–418), dawn-chords 0.6 (to 394), last-trill 0.7 (418–420) | long-notes 0.6, thread-mid 0.3 | pp, one voice. Keep a dim field under it so it is not black |
| 420–430 | **scurry** 0.9 (420–424), **final-pizz** 1 (424.1–426.2) | thread-low 0.4 | the skeletons flee; the end is the last G minor chord at 426.24, then silence |

Notes for the composers:
- **Fireworks:** only `ff-blows` and `final-hammer`. The early strikes (`ff-blows-early`) are not fortissimo.
- **Flee:** only on masses of unorganised notes. These are tracks, not picks: `violin`/`strings` in the frenzy (360–371)
  or the fugato's tutti climax (140–149). Never on a pick set.
- **Handover:** only on long slow notes: `long-notes`, `chorale-*`, `dawn-chords`, `farewell-violin`.
- **Ivory:** one short row per phrase: `theme-b-solo-p1..p4`, `theme-b-tutti-p1..p3`, `chorale-p1..p4`.
- **Whole-piece sets:** `thread-high`, `thread-mid`, `thread-low` and `long-notes` span 9.6–428 s. A show that uses one
  on part of the timeline gets check-show warnings for picks outside every clip, so slice the notes to the clip range.
- **Spare entrances** (not a full screen) are written into the piece: the clock strokes, the hush, Death's tuning, the
  cock-crow and the farewell.
