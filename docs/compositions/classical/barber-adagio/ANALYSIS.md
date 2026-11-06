# Barber, Adagio for Strings: analysis for the shows

The recording is `songs/barber-adagio`, 481.1 s long. The music sounds from 0.9 s to 465.4 s, and the rest is digital
silence (from 465.5 s). It is in B♭ minor. The theme moves stepwise in notes of about 0.8 s. The pick sets are in
`picks.json`, next to this file, and `gen-picks.mjs` makes them. This page gives the form to a tenth of a second, the
recurring events, the sets, the holes in the transcription, and a weight table to start a score from.

## How this was made (rerunnable)

- `node docs/compositions/classical/barber-adagio/gen-picks.mjs` writes `picks.json` and prints each set's attacks,
  notes, span and first pitches. The script is deterministic. It throws if a set breaks the show format: a non-slug
  id, unsorted notes, a bad note, notes outside the set's span, or an attack in the cut-off silence (353.0–356.4 s) or
  after the music ends (465.5 s).
- The format of `picks.json` is `{ "<set id>": { hears, source, rule, section, span: [from, to], attacks, notes } }`.
  The notes are `[start, end, midi, velocity]`, sorted by start. Copy `notes` into a show's `picks.<id>.notes`.
- Validated: every set was put in a throwaway show (in the session scratchpad, not in `shows/`), one clip per set
  listening `picks:<id>`. `npm run check-show` exits 0. The only warning was "13 clips at once", which comes from that
  harness.
- The audio measurements used librosa in `C:/Users/maxim/.venvs/wa`, through scratch scripts that are not kept:
  - rms in dB per 0.1–1 s;
  - `onset_strength` and its peaks;
  - `chroma_cqt`;
  - the strongest CQT bin below MIDI 55 (the bass);
  - a harmonic-salience top line.

  The results that matter are embedded as commented constants (`AUDIO`) in `gen-picks.mjs`, so the script needs only
  the pack.

### The notes, and why they had to be cleaned

- **The roll is `pack.tracks`.** It holds violin 554, viola 402 and cello 211 notes from YourMT3+, with velocities
  taken from the loudness. The picker shows exactly these notes. Sets with `source: "roll"` contain only roll notes, so
  every pick is found on the roll.
- **`pack.notes` (1513) contributes almost nothing.** About 800 of these notes are the piano model's alone. Most are
  noise: it chops held string notes into stutters, and in the climax it hears overtones an octave up (F♯7/E♭7/F7 for
  the violins' G♭6/E♭6/F6). Only two of its notes are used: the opening B♭4 (0.93 s) and the coda's B♭4 (426.0 s).
- **Almost every "repeat" in the transcription is fake.** The tracks turn one bowed, vibrato note into runs of
  0.1–0.2 s notes: violins and violas at 180–182, 227–229, 260–262, 280–287 and 316–327 s; cellos at 384–386 s; violas
  at 408–413 and 448–451 s. The piano model adds the C5 stutter at 72.5–78.3 s and E♭7 ×5 at 329 s.
- **Barber wrote no tremolo, runs, trills or fast repeated-note figures in this piece.** (A slow repeat such as D♭5–D♭5 at 18.4/19.3 s is real and is kept.) `legato()` merges a fragment into the
  previous note of the same track and pitch when the fragment starts less than 0.15 s after that note ends. The merged
  note keeps the first fragment's start and velocity. Doublings, the same pitch within 30 ms on two tracks, become one
  note.
- **The result: 1167 roll notes become 524 clean notes.** Every set is built from the clean notes.
- **Consequence for composers.** A clip that listens to a raw track (`"listen": "violin"`), to `repeats`, to `runs`, or
  to `all` fires on every fragment in those stretches. Those are fake attacks. Use the sets.
- **Velocities follow the loudness and are very low early on.** They run 17–48 through the first 70 s, and the
  climax reaches 104–120. A widget that answers loudness will be faint in the first two minutes. Use the clip's
  intensity curve, or a per-note intensity, instead of hoping for brighter notes.

## The form

The turns are exact to 0.1 s. They come from the clean notes, checked against the audio's rms and chroma.

| start | end | name | character | sets sounding |
|---|---|---|---|---|
| 0.0 | 0.9 | Before | silence | none |
| 0.9 | 21.1 | **A1, the theme alone** | pp, −43 → −26 dB. A long B♭4 (to 8.6 s). The lower strings slip in under it at 3.95 s. The violins step A4–B♭4–C5–B♭4–D♭5 … up to E♭5 (20.1 s). | theme-opening, theme-heads, bass-line, audio-fills |
| 21.1 | 30.0 | First rest | The A♭ chord is held (21.13 s), then a lone C5 (26.1–30 s). The quietest dip of the opening is −41 dB (24–28 s). | cadence-chords, long-tones |
| 30.0 | 49.5 | Answer | B♭4 held over a G♭ bass, then C5–D♭5–B♭4. The line falls A♭4–G♭4–F4–E♭4 and climbs back in the middle voice C4 → B♭4. −31 dB. | theme-answer, theme-heads, bass-line |
| 49.5 | 53.4 | Half close | F major, held 3.8 s | cadence-chords |
| 53.4 | 70.1 | **A2, the theme restated** | A long B♭4 (53.5 s), then the same steps, a little fuller, climbing to E♭5 (69.1 s). −28 → −23 dB. | theme-restated, theme-heads |
| 70.1 | 86.2 | First ascent | An A♭ chord, then high held notes: G♭5 for 7 s (71.0), C♭6 (82.9), B♭5 (85.2). A crescendo, −24 → −20 dB. | first-ascent, long-tones |
| 86.2 | 103.5 | **First swell (forte)** | The A♭1 toll (86.2 s), then the theme in the middle register. Velocity reaches 98–103 at 93–98 s and the peak is −8.5 dB at about 97 s. D♭5 at 98.7 s, then it sinks. | first-swell, forte-accents, deep-tolls, bass-line |
| 103.5 | 134.6 | Second strophe | A long B♭4 (103.5 s), falling phrases (A♭–B♭–C♭–B♭–A♭–G♭), then the line sinks to D♭4. The bass walks down (B1 at 108.8, C♯2 at 120.5 s). −20 → −28 dB (132 s). | second-strophe, theme-heads, deep-tolls, bass-line |
| 134.6 | 162.8 | **Second build** | From A3/F3 the line climbs to F5 (144.6 s, velocity 94) and D♭5 (146.2 s, 98) and holds E♭5 (149.5 s, peak −9.2 dB). Then D natural (154.6, 156.3 s), a change of colour, and it ebbs to −24 dB (160 s). | second-build, forte-accents |
| 162.8 | 190.9 | Descent and winding | The violins step down G♭5–F5–E♭5–D♭5–C♭5 (162.9–166 s), then wind around B♭4/C♭5/A♭4 (168–188 s). The lower strings surge at 180.3 s. | violins-descent, viola-line, bass-line |
| 190.9 | 199.6 | A glimpse of B♭ major | F4–G♭4, then a soft B♭ major chord (192.6 s). −23 dB. | violins-descent, cadence-chords |
| 199.6 | 257.5 | **Low strophe (the dark middle)** | The line sits in the low middle register (B♭3–A♭4) with long notes far apart: F4 (199.6), E♭4 (209.8), G♭4 (220.4, a G♭ chord held to 237 s). The cellos' rising cell C3–E♭3–F3–G♭3 at 231.9–235.2 s; the violas rock F3–B♭3 at 252.2 s. −21 to −25 dB, few attacks. | low-strophe, cello-line, viola-line, bass-line |
| 257.5 | 275.1 | Third build | E♭4–D♭4–C4 pushed hard (velocity 88–96, 257.5–260 s), G♭4 held. **From 267 s the strings swell (−13.6 dB at 268 s) with no transcribed note.** | third-build, audio-only after 267 |
| 275.1 | 291.9 | **Waves** | The violins climb E♭5–F5–D5 …, velocity 104 at 278.8 s, then G♭5–E♭5–F5–G♭5–F5–G♭5–E♭5–A♭5 (284.9 s). A D♭ chord at 285.8–290 s. −15 dB. | waves, forte-accents, bass-line |
| 291.9 | 303.3 | Plateau | B♭4 held over G♭ (291.9 s, 5 s), sparse, −16 to −19 dB. F5–G♭5–F5 starts again at 301.6 s. | waves, long-tones |
| 303.3 | 315.1 | **Stretto** | The voices enter one after another with the same four-note cell, hammered about 0.75 s apart: violas D♭4–E♭4–F4 (304 s), cellos F4–E♭4–F4 (307.5 s), violas G♭4–F4 (311.9 s), cellos G♭4–A♭4 (314.2 s, velocity 114), under held F5 and A♭5. −14 → −12 dB. | stretto-cells, forte-accents, viola-line, cello-line |
| 315.1 | 328.8 | **Ascent to the top** | ff. C6, F6, D♭6, E♭6, F6, G♭6 (328.2 s), doubled at the octave, velocity 100–116. −12 → −7 dB. The last stretch the tracks hear. | ascent-to-top, octave-doublings, ff-blows |
| 328.8 | 345.5 | **Climax (fff)** | The first chord is the violins' E♭6 at 328.79 s (the last note of ascent-to-top). Then five new chords with the violins on top: G♭6 (330.2), and B♭6 re-struck as the harmony turns underneath (332.8, 333.8, 336.9, 342.7). One harmony holds 336.9–342.5, and the last chord swells to −2.9 dB at 344 s. −8 to −2 dB. The tracks hear nothing after 329.7 s. | climax-line, ff-blows |
| 345.5 | 346.2 | The breath | A split-second dip to −13 dB | none |
| 346.2 | 353.0 | **The arrival** | The one real fff blow: the high chord, the loudest moment of the piece (−1.2 dB at 346.5 s), held, then **cut off dead at 353.0 s**. | climax-chord, ff-blows (last), long-tones |
| 353.0 | 356.6 | **The silence** | Only the hall's reverb, −8 → −43 dB. It is deliberate black: no attack here (the script enforces it). | none |
| 356.6 | 376.5 | **Hymn** | Seven soft chords, each held 2–6 s: 356.5 (C♭), 358.4 (F♭), 363.0 (A over C♯), 364.9 (D), 369.1 (B minor), 371.0 (C), 374.0 (F). The bass sinks E2–C♯2–D2–B2–C2–F2. −22 to −30 dB. | hymn-chords, bass-line, audio-fills |
| 376.5 | 380.6 | Breath | −40 dB | none |
| 380.6 | 403.4 | **Reprise** | The theme returns from its long B♭4 (382.3 s), now doubled an octave lower: A4–B♭4–C5 … D♭5–E♭5, landing on C5 held 7.7 s (396.1 s). −21 to −30 dB. | reprise-theme, octave-doublings, theme-heads, bass-line |
| 403.4 | 426.0 | Reprise answer | In octaves: B♭4 held, then a climb D♭5 … to G♭5 (412.9 s), and all the way down to F4 (422.6 s, held to 426). | reprise-answer, octave-doublings, bass-line |
| 426.0 | 448.5 | **Coda** | The head of the theme once more, spent: B♭4 (426.0), B♭4–A4–B♭4–C5 (429.1 s), A4 held 5.7 s, then very low and soft B♭3–A3–B♭3–C4 (438.4–447 s). −33 → −18 dB. | coda-cell, theme-heads |
| 448.5 | 465.4 | Last chords | F major over C (448.5 s), a dip (454.4 s), then F major over F (455.4 s), fading to nothing. The piece ends unresolved, on the dominant of B♭ minor. | last-chords, cadence-chords, bass-line |
| 465.4 | 481.1 | After | digital silence (−80 dB) | none |

The arc in loudness: −34 dB (0–30 s), −24 (60–90), −20 (90–210), −23 (210–240), −17 (270–300), −13 (300–330),
−11 (330–360, peak 0.0), −26 (hymn), −23 (reprise), −26 (coda). There are three swells before the climax: 97, 149.5
and 268–290 s. Each climbs higher than the one before.

### Recurring events

- **The theme heads (`theme-heads`, 7 notes).** A long held B♭ opens each statement before the line moves:
  - B♭4 at 0.93, 30.02, 53.48, 103.53, 382.28 and 426.0 s;
  - B♭3, an octave down, at 438.4 s.

  This is the piece's toll: the same note returning, quieter each time after the climax.
- **Cadence chords (`cadence-chords`, 10 attacks).** The phrases come to rest on held chords, 3–17 s long: A♭ at 21.1,
  F at 49.5, A♭ at 70.1, 129.4, 169.2, B♭ at 192.6, G♭ at 220.4, A♭ at 396.1, 404.1, and F at 455.4 s.
- **The swells' pressure points (`forte-accents`, 17).** These are the loudest attacks before the climax, a few per
  swell:
  - 93–98 s;
  - 144–147 s;
  - 258 s;
  - 278.8–284 s;
  - 304–313.5 s.
- **The stretto cell (`stretto-cells`, 15).** One four-note cell, hammered by the voices in turn.
- **The climax's chord changes (`climax-line`, 5) and the one blow (`climax-chord`).** The single fff arrival is at 346.21 s.
  It has an onset strength of 2.71, the highest of the climax, and comes right after the breath.
- **The cut-off (353.0 s) and the silence.** This is the most famous moment of the piece. Keep it black. A widget
  that keeps drawing through it, such as a field or a long fade, spoils it. End every clip at 353.0 s, with fade 0.
- **The hymn chords (7).** Soft, slow, and the colour changes every chord. The bass sinks by semitones.
- **What the piece lacks** (do not reach for these): no runs, no trills, no real repeated notes, no percussive attacks
  apart from the arrival at 346.2 s, and no masses of unorganised notes. That means no Flee anywhere. Fireworks belong
  only on `ff-blows` (314–353 s), and best on `climax-chord` alone.

## The sets

Attacks are 40 ms clusters. The source is `roll` (on the picker's roll), `audio` (measured, see `AUDIO`), or `mixed`.

**Phrase lines.** One set per phrase. They suit Ivory rows (one row per set) and handover, and they make the lead
thread.

| id | what one hears | attacks / notes | span (s) | source |
|---|---|---|---|---|
| theme-opening | The theme alone, pp: the long B♭4, then A4–B♭4–C5–B♭4–D♭5 … E♭5 | 11 / 11 | 0.93–21.1 | mixed |
| theme-answer | B♭4 over G♭, the fall A♭4–G♭4–F4–E♭4, the inner climb C4 → B♭4 | 19 / 19 | 30.0–49.4 | roll |
| theme-restated | The theme again from its long B♭4, to E♭5 and the A♭ chord | 16 / 16 | 53.5–71.0 | roll |
| first-ascent | Four long high notes: C5, G♭5 (7 s), C♭6, B♭5 | 4 / 4 | 70.1–89.3 | roll |
| first-swell | The first forte, in the middle register, up to D♭5 | 18 / 18 | 86.8–103.5 | roll |
| second-strophe | From the long B♭4, falling phrases sinking to D♭4 | 20 / 20 | 103.5–133.1 | roll |
| second-build | The climb to F5/D♭5/E♭5, D natural at 154.6 s | 17 / 17 | 134.6–157.7 | roll |
| violins-descent | G♭5 down to C♭5, the winding B♭/C♭/A♭ line, the B♭-major glimpse | 31 / 31 | 162.9–199.5 | roll |
| low-strophe | The dark middle: long low notes, the cellos' cell, the violas' rocking | 25 / 25 | 199.6–253.9 | roll |
| third-build | E♭4–D♭4–C4 pushed hard, G♭4, F4 (the transcription stops at 266.5 s) | 6 / 6 | 257.5–268.3 | roll |
| waves | The violins' climbing waves to A♭5, then the plateau B♭4 | 20 / 20 | 275.2–303.2 | roll |
| stretto-cells | The cell in each voice in turn, hammered (velocity 62–114) | 15 / 15 | 304.0–315.0 | roll |
| ascent-to-top | C6, F6, D♭6, E♭6, F6, G♭6, ff, ending on the climax's first chord (E♭6, 328.79) | 14 / 14 | 315.1–329.7 | roll |
| climax-line | The climax's five chord changes: G♭6, then B♭6 re-struck as the harmony turns | 5 / 5 | 330.23–345.5 | audio |
| climax-chord | The fff arrival at 346.21 s, held to the cut-off at 353.0 s (A♭5 + A♭6) | 1 / 2 | 346.21–353.0 | audio |
| hymn-chords | Seven soft chords after the silence; whole chords | 7 / 30 | 356.5–378.9 | mixed |
| reprise-theme | The theme back from its B♭4, to the C5 held 7.7 s | 16 / 16 | 382.3–403.8 | roll |
| reprise-answer | Up to G♭5 and all the way down to F4 | 22 / 22 | 403.4–426.0 | roll |
| coda-cell | B♭4 (426.0), B♭4–A4–B♭4–C5–A4, then low B♭3–A3–B♭3–C4 | 10 / 10 | 426.0–449.1 | mixed |
| last-chords | F over C (448.5 s), F over F (455.4 s), fading | 2 / 6 | 448.5–465.4 | mixed |

**Threads.** These run through the whole piece, for always-on layers.

| id | what one hears | attacks / notes | span (s) | source |
|---|---|---|---|---|
| melody | Every phrase line above except stretto, climax chord, hymn and last chords: the lead | 253 / 253 | 0.93–449.1 | mixed |
| bass-line | One long low note every few seconds, walking down by steps; the tenor voice (F3–B♭3) at 183–292 s; nothing from 292 s to the hymn | 63 / 63 | 3.95–465.4 | mixed |
| deep-tolls | The four deepest notes: A♭1 (86.2), C♯2 (98.5), B1 (108.8), C♯2 (120.5) | 4 / 4 | 86.2–122.3 | roll |
| violin-line | The violin track's top line (YourMT3+ label), clean | 231 / 231 | 8.6–449.1 | roll |
| viola-line | The viola track's top line, an inner voice; carries the stretto cell | 119 / 119 | 21.1–450.5 | roll |
| cello-line | The cello track's top line: mostly bass, but it sings at 232–235 and 307–314 s | 70 / 70 | 21.1–438.3 | roll |
| theme-heads | The 7 long B♭s that open each statement | 7 / 7 | 0.93–443.7 | mixed |
| cadence-chords | The held chords where phrases rest; whole chords | 10 / 38 | 21.1–465.4 | mixed |
| long-tones | Only the line's notes of 3 s or more, plus the climax chord and the last chord: the handover set | 35 / 35 | 0.93–465.4 | mixed |
| octave-doublings | The melody and its twin an octave down: the ascent (324–327 s), the whole reprise (382–422 s) | 33 / 66 | 324.2–422.6 | roll |
| forte-accents | The loudest attacks of the swells (velocity ≥ 95) | 17 / 17 | 93.3–314.2 | roll |
| ff-blows | The ascent's strongest strokes (velocity ≥ 109, at most one per 0.6 s, up to the climax's first chord at 328.79), the climax's 5 chord changes, the arrival | 14 / 14 | 314.2–353.0 | mixed |
| audio-fills | Only the audio-measured notes: the lower strings' entrance, the climax's chord changes, the arrival, two hymn chords, the last bass and chord | 11 / 19 | 3.95–465.4 | audio |

There are no sets for runs, trills or repeats, because the music has none. There is no "unorganised mass" set, so
Flee has nothing to work on.

### Each audio note and how it was found (`AUDIO` in the script)

| time (s) | pitch | why |
|---|---|---|
| 3.95–8.64 | B♭2 | The lower strings enter under the held B♭4. The bass bin B♭2 appears at 3.9–4.0 s, and rms goes −41 → −29 dB. |
| 330.23, 332.81, 333.83, 336.9, 342.67 | G♭6, B♭6 ×4 | A stroke is kept only where an onset-strength peak (≥ 1.96) or a piano-model attack falls on a change in the chroma (0.5 s bins): Bb F B E → F♯ B♭ C♯ G (330.2), → E♭ B♭ C (332.8), → B♭ B C♯ F (333.8), → B B♭ G F♯ (336.9, held to 342.5), then E♭ enters with the swell (342.7). The onset peaks at 329.35, 335.25, 338.99, 340.13, 341.59 and 348.7–350.5 s fall inside one harmony: bow changes, not strokes. The pitch is the highest piano-model note at or below B♭6, else the top CQT bin. |
| 346.21–353.0 | A♭5, A♭6 | The arrival: onset peak 2.71 after the dip to −13 dB, then the loudest moment, −1.2 dB at 346.5 s |
| 363.0–364.85 | C♯2, E4, A4 | A hymn chord the tracks miss: bass C♯2 from 363.0 s, chroma C♯ E A |
| 364.85–369.05 | D2, A3, F♯4, D5 | A hymn chord the tracks miss: bass D2 from 364.8 s, chroma D A F♯, top bin D5 |
| 448.52–455.4 | C3 | The bass of the penultimate chord, F over C |
| 455.4–465.4 | F2, C4, A4 | The last chord: the bass moves C3 → F2 after the dip at 454.4 s |

Velocity for audio notes follows the fit of track velocity on audio level: v = 133.8 + 3.76 × dB (r = 0.88), clamped
to 18–120.

## Holes: where the transcription is silent and the music is not

These are the stretches where a clip on notes would go black or idle. Cover them with widgets that draw without
attacks (fields, the current's thread, a slow base) and an intensity curve that follows the dB, or with the audio sets
above.

| from | to | audio | what sounds | covered by |
|---|---|---|---|---|
| 0.9 | 8.6 | −43 → −29 dB | The long B♭4 alone, then the lower strings entering (3.95 s). The tracks have nothing before 8.64 s. | theme-opening (its first note lasts to 8.64), audio-fills (B♭2) |
| 21.1 | 30.0 | −26 → −41 → −31 dB | Held chord, then a lone C5. There are notes, but none new for 9 s. | an attack-free base |
| 72.4 | 82.8 | −24 → −20 dB | Held G♭5 and C5, a crescendo. Only the piano model's C5 stutter (fake). | first-ascent's held notes (71.0, 82.9) |
| 199.6 | 257.5 | −21 to −25 dB | The low strophe: 25 line notes in 58 s, gaps up to 7 s (220.4–231.9) | attack-free base; low-strophe |
| 266.5 | 275.1 | −25 → **−13.6** → −18 dB | **Loud and untranscribed.** The strings swell (F minor at 267, A♭/F/C♭ at 270, B♭7 at 274) with no note. | an intensity curve: rise to the 268 s peak; the next attack is 275.16 |
| 286.7 | 301.6 | −12 to −19 dB | The D♭ chord (to 290), then B♭4 held over G♭ (291.9–296.9), then quiet movement. Three notes in 15 s. | waves (291.9 B♭4), long-tones; attack-free base |
| 329.7 | 346.2 | −2 to −9 dB | **The climax: the tracks are empty.** The piano model's notes are jitter and overtones. 336.9–342.67 s is one held chord with no new attack. | climax-line, ff-blows (audio); an attack-free layer for the held chord |
| 353.0 | 356.6 | −8 → −43 dB | **The cut-off silence: keep it black.** | nothing, by design |
| 359.0 | 369.0 | −23 to −31 dB | Hymn chords the tracks miss | hymn-chords (audio chords at 363.0, 364.85) |
| 376.5 | 380.6 | −37 to −42 dB | A breath before the reprise | nothing; a fade |
| 396.1 | 403.4 | −19 to −36 dB | C5 held 7.7 s, no other note | reprise-theme's held C5; attack-free base |
| 422.6 | 426.0 | −21 to −29 dB | F4 held | reprise-answer's F4 |
| 432.5 | 438.4 | −23 to −34 dB | A4 held 5.7 s | coda-cell's held A4 |
| 449.1 | 465.4 | −20 → −36 → −27 → −48 dB | The last two chords fading; the tracks end at 450.5 s | last-chords (audio) |
| 465.5 | 481.1 | −80 dB | digital silence | nothing: end the show at about 466 s |

## Weights per 30 s (where a score starts)

Each strand gets a weight from 0 to 1: how much it should show in that window. Turn the weights into intensity curves
on always-on clips, and crossfade at the turns in the form table, not at the 30 s marks. "Attack-free" is a base that
draws without notes, such as fields or the current. "Pressure" is `forte-accents`, `stretto-cells` and `ff-blows`.
"Chords" is `cadence-chords` and `hymn-chords`. The line attack counts below are from `melody` and `bass-line`.

| window (s) | dB mean (peak) | line att. | bass att. | lead (melody / phrase set) | bass | inner (viola / cello lines) | heads / long tones | chords | pressure | octaves | attack-free | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0–30 | −34 (−20) | 11 | 2 | 1.0 | 0.3 | 0.1 | 0.8 | 0.3 | 0 | 0 | 0.6 | A spare entrance: one light on the long B♭4. Velocities 17–48. |
| 30–60 | −31 (−25) | 23 | 3 | 1.0 | 0.4 | 0.3 | 0.6 | 0.4 | 0 | 0 | 0.6 | The answer's inner climb (41–49 s) is the viola-line's moment. |
| 60–90 | −24 (−15) | 19 | 4 | 0.9 | 0.4 | 0.3 | 0.8 | 0.3 | 0 | 0 | 0.7 | Long high notes (71–89 s): handover territory. |
| 90–120 | −20 (−8.5) | 28 | 7 | 0.9 | 0.7 | 0.6 | 0.4 | 0.2 | 0.5 | 0 | 0.5 | First swell, deep tolls at 86–121 s. |
| 120–150 | −20 (−9) | 21 | 8 | 0.8 | 0.7 | 0.8 | 0.3 | 0.3 | 0.4 | 0 | 0.5 | Second strophe into the second build. |
| 150–180 | −20 (−12) | 19 | 4 | 0.9 | 0.4 | 0.5 | 0.5 | 0.2 | 0.2 | 0 | 0.6 | E♭5 peak, D natural, ebb, the descent. |
| 180–210 | −20 (−12) | 22 | 3 | 0.8 | 0.5 | 0.7 | 0.5 | 0.4 | 0 | 0 | 0.6 | The lower strings surge (180 s), the B♭-major glimpse. |
| 210–240 | −23 (−12) | 12 | 4 | 0.6 | 0.6 | 0.6 | 0.7 | 0.5 | 0 | 0 | 0.9 | The darkest stretch: few notes, so the base carries it. No busy red. |
| 240–270 | −21 (−10) | 11 | 4 | 0.6 | 0.5 | 0.5 | 0.5 | 0.3 | 0.3 | 0 | 0.9 | The third build pushes (258 s); 266.5–275 s untranscribed. |
| 270–300 | −17 (−9) | 18 | 2 | 1.0 | 0.2 | 0.5 | 0.4 | 0.2 | 0.6 | 0 | 0.6 | Waves to A♭5, then the plateau. |
| 300–330 | −13 (−4.5) | 16 | 0 | 0.9 | 0 | 0.9 | 0.2 | 0 | 1.0 | 0.6 | 0.4 | Stretto (303–315) and the ascent: the screen fills. |
| 330–360 | −11 (0.0) | 5 | 2 | 0.7 (climax-line) | 0 | 0 | 0.5 | 0 | 1.0 | 0 | 0.3 | The climax, the blow at 346.2, **black 353.0–356.6**, the hymn begins. |
| 360–390 | −26 (−17) | 7 | 9 | 0.5 | 0.6 | 0.3 | 0.4 | 1.0 | 0 | 0.6 | 0.6 | Hymn (to 376.5), breath, the reprise from 382.3 in octaves. |
| 390–420 | −23 (−13) | 28 | 7 | 1.0 | 0.4 | 0.4 | 0.5 | 0.3 | 0 | 1.0 | 0.5 | The reprise and its answer: every note doubled at the octave. |
| 420–450 | −26 (−11) | 13 | 3 | 0.8 | 0.3 | 0.2 | 0.9 | 0.3 | 0 | 0.2 | 0.6 | The coda: heads at 426.0 and 438.4 s, long notes; spare again. |
| 450–481 | −55 (−19) | 0 | 1 | 0 | 0.3 | 0 | 0.6 | 0.8 | 0 | 0 | 0.5 → 0 | The last chord (455.4) fades by 465.4; then end. |

### Notes for the composers

- **The arc is one long climb, a cut, and an epilogue.** A score of always-on threads suits it:
  - the lead (`melody`) is never off from 0.9 to 449 s;
  - the bass and the inner lines come and go under it;
  - pressure appears only from 93 s, and fully only after 303 s.
- **The deliberate spare entrances are 0.9–21 s (one voice), the silence 353.0–356.6 s, and 449–465 s.** Everywhere
  else the screen can be full.
- **Long, slow notes are everywhere until the stretto.** Handover belongs on `long-tones` and the phrase sets. Do not
  use it on the stretto, the waves or the climax.
- **Ivory works one row per phrase set.** The phrases are 10–37 s long. `theme-opening`, `theme-restated`,
  `reprise-theme` and `coda-cell` are the cleanest.
- **Fireworks go only on `ff-blows`, and above all on `climax-chord`.** The swells before 303 s are forte, not blows.
- **Slow, quiet passages get no busy red textures:** 0–86, 199–257, 356–465 s.
- **Velocity is honest but tiny until about 86 s.** Bring the opening up with clip intensity, or with the per-note
  intensity value (the fifth place of a pick), not with a louder widget default.
