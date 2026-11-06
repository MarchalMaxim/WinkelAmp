# Grieg, In the Hall of the Mountain King: analysis for the shows

The recording is `songs/mountain-king` (161.96 s): Karajan and the Berlin Philharmonic, Peer Gynt Suite No. 1, orchestra
only. This page gives the form to a tenth of a second, the tune's grid unit by unit, the recurring events, the 33 pick
sets in `picks.json` next to this file, the holes in the transcription, and a weight table per 30 s to start from.

Rerun: `node docs/compositions/classical/mountain-king/gen-picks.mjs [--units]`. It needs only node, is deterministic,
and throws if a set breaks the show format. All 33 sets passed `check-show` in a throwaway show (0 errors).

## Read this first: five traps in this pack

1. **`pack.beats` is wrong after about 90 s.** It stays at about 0.52 s the whole way. The real accelerando takes the
   eighth note from 0.275 s to about 0.16 s; see the unit table. The intensity preset "Pulse every N beats" will drift.
   For a pulse, use the honest clocks: `phrase-entries` (one per 2-bar unit), `cymbal-pulse` (two a bar in the
   frenzy), and `theme-landings`.
2. **`pack.loudness` lags by seconds.** It reads 0.83 at 148 s, in the general pause, where the audio is −30 dB. It reads
   0.84 at 152 s and 0.39 at 158 s, when the audio is silent (−60 to −80 dB). describe-song's "quiet section from
   152 s" is that lag. **The music ends at 150.1 s, the reverb is gone by 151.5 s, and 151.5–161.96 s is silence.**
   - End or zero every clip by about 150.5–151.5 s.
   - Shape the general pause (147.75–148.6 s) by hand with intensity curves.
   - Widgets that follow loudness would otherwise glow over the pause and the silence.
3. **Velocities are low in the first minute.** The first statement is 26–40 (v16 for the horn note) and stays under 56
   until 60 s. The frenzy is 60–110. The numbers are kept as the pack has them. If a widget answers velocity, give its
   clips in 0–60 s an intensity, or pick a widget that does not need loudness.
4. **Lane labels lie in the coda.** At 136–147 s the tutti blows and runs are labelled `piano` (102 notes), `trumpet`
   (14) and `clarinet` (21). There is no piano in the piece. `"listen": "piano"` hears the coda's hammer chords. Say
   "the tutti", not "the piano".
5. **The cymbals are not in the notes.** No lane has the frenzy's cymbal strokes or the coda's crashes. They come from
   the audio (`cymbal-pulse`, `coda-crashes`).

## How the notes were chosen

- **roll**: `pack.tracks`, YourMT3+'s instrument lanes (2479 notes). These are the notes the studio's note picker shows
  for this pack, so picks taken from them land on its roll. When two lanes share the same start and pitch, the note is
  kept once, the louder.
- **pack**: `pack.notes` that no lane has (the piano model's notes in YourMT3's gaps). These are the deep pizzicato
  B1/C#2 of the first statement, a few tune notes, and the coda chords. The picker shows them as not on its roll.
- **audio**: strokes measured with librosa. Each one's time is the onset; its pitch is nominal and named in the set's
  `rule`; velocity = clamp(120 + 2 × peak dB, 20, 127). The recipe is in the header of `gen-picks.mjs`.

Each set in `picks.json` has `hears`, `rule`, `source`, `span` [first start, last end], `attacks` and `notes`.

## The form

The piece is one tune, played three times and getting faster and louder, then a coda that breaks it apart. The tune is
24 bars made of 2-bar **units**, in the order A A2 A A2 | B B2 B B2 | A A2 A A2.

- **A** is in B minor: the climb B C# D E F# D F#, then the answer F C# F, E C E.
- **A2** has the same climb, ending on B, then the sigh A F# D F# A (a half note).
- **B** and **B2** are in F# major: F# G# A# B C# A# C#, then D A# D, C# A# C#.

| start | end | name | character | the sets that sound there |
|---|---|---|---|---|
| 0.0 | 3.7 | Introduction: the horn pedal | Near silence (−45 dB). Out of it comes one soft held horn note (F#4, v16, 1.02–3.77 s). | `opening-pedal` |
| 3.7 | 12.5 | Statement 1, A A2: pizzicato basses | pp (−34 dB), very low (B1–B2). Cellos and basses pluck the tune, staccato. Tiptoeing. | `theme-pizz-basses`, `pizz-footsteps`, `phrase-entries` |
| 12.5 | 20.9 | Statement 1, A A2: bassoons | The bassoons take the tune (B2–A3). The pizzicato chords go on underneath. The A held at 19.88 s is the first long note (1 s). | `theme-bassoons`, `pizz-footsteps`, `bassoon-lane`, `long-a-sighs` |
| 20.9 | 29.35 | Statement 1, B B2: violas and cellos | The F#-major half, still pp. The tune is a little higher (F#3–D4). Brighter. | `theme-low-strings-f-sharp`, `theme-major`, `low-strings-lane` |
| 29.35 | 37.7 | Statement 1, B B2: bassoons, clarinet, horn | The same F# half, in winds. The horn's few notes are here (30.96–32.5 s). | `theme-bassoons`, `reeds-lane`, `brass-lane` |
| 37.7 | 46.2 | Statement 1, A A2: basses again | The low pizzicato returns (B1, the lowest tune of the piece). | `theme-pizz-basses`, `pizz-footsteps` |
| 46.2 | 54.9 | Statement 1, A A2: bassoons again | Closes the first statement. Still −34 dB. | `theme-bassoons` |
| 54.9 | 62.95 | Statement 2, A A2: the violins enter | The tune jumps two octaves (B4–F#5) over soft repeated B-minor chords. Light and dry; −32 dB. | `theme-violins-enter`, `violins-high`, `pizz-footsteps` |
| 62.95 | 70.97 | Statement 2, A A2: winds | Oboe on top, clarinet and bassoon in octaves (B4–B5). Reedy; −29.5 dB. The velocity peak rises to 67. | `theme-winds`, `reeds-lane` |
| 70.97 | 86.97 | Statement 2, B B2 B B2: strings gather | The F# half in the violins (F#4–D6). Everyone joins and it slowly gets louder (−29 to −24 dB). | `theme-strings-rising`, `theme-major`, `violins-high`, `low-strings-lane` |
| 86.97 | 101.85 | Statement 2, A A2 A A2: the push | Crescendo and accelerando together. The bar shortens from 2.03 s to 1.82 s. Loudness goes from −24 dB to −6 dB at 100.5 s; velocities reach 90. The trolls wake. | `theme-strings-rising`, `violins-high`, `low-strings-lane` |
| 101.85 | 114.1 | Statement 3, A A2 A A2: the frenzy | ff tutti (−12 to −8 dB). Cymbals enter on the downbeat (101.9 s) and strike two to a bar. The tune is on top in the violins (B5–F#6). Strings tremolo; a stamping bass. Bar 1.6 s, then 1.5 s. | `theme-tutti`, `cymbal-pulse`, `frenzy-tremolo`, `stamping-bass`, `brass-lane` |
| 114.1 | 125.59 | Statement 3, B B2 B B2 | The F# half, ff, faster (bar 1.48 s, then 1.40 s). The transcription keeps half the tune here: see the unit scores. | `theme-tutti`, `theme-major`, `cymbal-pulse`, `frenzy-tremolo`, `stamping-bass` |
| 125.59 | 130.6 | Statement 3, A A2, cut short | The last A, at its fastest (the A2's eighths are about 0.13 s). The held A at the end is a tremolo (129.35–130.9 s). | `theme-tutti`, `frenzy-tremolo`, `cymbal-pulse` |
| 130.6 | 136.4 | The break | The tune stops. A B-minor chord is hammered in tremolo, ff, from 131.08 to 133.1 s: the first time the music stands still. Then a turn in octaves (C# D E D C# B, 133.18–134.1 s), B hammered, a crash at 135.25 s with its cymbal at 135.69 s, and a hush of 0.4 s (−28 dB at 136.0–136.4 s). | `break-chord`, `break-turn`, `frenzy-tremolo`, `cymbal-pulse` |
| 136.4 | 145.9 | Coda: the hammer blows | Six fff tutti blows, each out of a near-silence: 136.46, 139.62, 140.59, 143.71, 144.67 and 145.66 s. Each has its cymbal crash about 0.25 s later. Between them the tune scurries at double speed (137.2–139.4 s, f; 141.5–143.5 s, hushed). | `ff-blows`, `coda-crashes`, `coda-chords`, `stretta-runs` |
| 145.9 | 147.75 | The held breath | A hushed diminished chord (F G# D), repeated five times (145.9–146.9 s), rising to D/B at 147.1–147.4 s. | `held-breath` |
| 147.75 | 148.6 | General pause | Silence in the music, −30 to −32 dB. The pack loudness does not show it (0.83). | none: black, or everything held still |
| 148.6 | 150.1 | The last crescendo and chord | Strokes at 148.98, 149.31 and 149.69 s grow to the loudest moment of the ending (−0.5 dB). The final crash is at 149.97 s. | `final-strokes`, `ff-blows` (its last note) |
| 150.1 | 161.96 | Decay, then silence | The reverb is −24 dB at 150.5 s and −53 dB at 151.5 s, then 10.5 s of nothing. | none |

### The tune unit by unit (the grid every theme set is built on)

`t0` is the unit's first eighth. `eighth` is the fitted eighth note in seconds; the bar is 8 eighths. `score` is how
many of the 13 template notes the transcription has there (the trust level). `got` is how many went into `theme`; a
slot is left out when its note is in no lane and no pack note, and nothing is invented.

| # | unit | t0 | eighth | bar | score | got | heard in |
|---|---|---|---|---|---|---|---|
| 1 | A | 3.70 | 0.275 | 2.20 | 11 | 11 | pizz basses, B1–B2 |
| 2 | A2 | 8.12 | 0.278 | 2.22 | 11 | 11 | pizz basses |
| 3 | A | 12.50 | 0.264 | 2.11 | 13 | 13 | bassoons, B2–F#3 |
| 4 | A2 | 16.70 | 0.262 | 2.10 | 13 | 13 | bassoons |
| 5 | B | 20.92 | 0.270 | 2.16 | 13 | 13 | violas/cellos, F#3–D4 |
| 6 | B2 | 25.10 | 0.269 | 2.15 | 12 | 12 | violas/cellos (two octave slips) |
| 7 | B | 29.35 | 0.262 | 2.10 | 13 | 13 | bassoons, clarinet, horn |
| 8 | B2 | 33.55 | 0.263 | 2.10 | 10 | 10 | bassoons |
| 9 | A | 37.73 | 0.268 | 2.14 | 9 | 9 | pizz basses |
| 10 | A2 | 42.00 | 0.276 | 2.21 | 10 | 10 | pizz basses |
| 11 | A | 46.24 | 0.270 | 2.16 | 12 | 12 | bassoons |
| 12 | A2 | 50.52 | 0.261 | 2.09 | 10 | 8 | bassoons |
| 13 | A | 54.90 | 0.251 | 2.01 | 10 | 9 | violins, B4–F#5 |
| 14 | A2 | 58.91 | 0.268 | 2.14 | 13 | 12 | violins/strings |
| 15 | A | 62.95 | 0.255 | 2.04 | 13 | 13 | oboe, clarinet, bassoon |
| 16 | A2 | 66.96 | 0.249 | 1.99 | 13 | 13 | oboe, clarinet, bassoon |
| 17 | B | 70.97 | 0.258 | 2.06 | 11 | 10 | violins, F#4–D6 |
| 18 | B2 | 75.02 | 0.249 | 1.99 | 11 | 11 | violins |
| 19 | B | 79.00 | 0.250 | 2.00 | 13 | 13 | strings, oboe |
| 20 | B2 | 82.97 | 0.251 | 2.01 | 12 | 12 | strings |
| 21 | A | 86.97 | 0.254 | 2.03 | 13 | 13 | strings, crescendo |
| 22 | A2 | 90.90 | 0.232 | 1.86 | 13 | 13 | strings, accelerando |
| 23 | A | 94.60 | 0.231 | 1.85 | 13 | 13 | strings |
| 24 | A2 | 98.25 | 0.228 | 1.82 | 10 | 8 | strings, almost ff |
| 25 | A | 101.85 | 0.200 | 1.60 | 10 | 7 | tutti, violins B5–F#6 (head under the cymbal) |
| 26 | A2 | 104.97 | 0.197 | 1.58 | 8 | 8 | tutti |
| 27 | A | 108.10 | 0.189 | 1.51 | 11 | 11 | tutti |
| 28 | A2 | 111.10 | 0.187 | 1.50 | 12 | 12 | tutti |
| 29 | B | 114.10 | 0.185 | 1.48 | 7 | 7 | tutti (the climb is lost in tremolo) |
| 30 | B2 | 117.03 | 0.193 | 1.54 | 11 | 11 | tutti |
| 31 | B | 119.97 | 0.179 | 1.43 | 6 | 6 | tutti (the climb is lost in the F#5 tremolo) |
| 32 | B2 | 122.80 | 0.175 | 1.40 | 11 | 10 | tutti |
| 33 | A | 125.59 | 0.162 | 1.30 | 8 | 8 | tutti |
| 34 | A2 | 128.30 | 0.129 | 1.03 | 5 | 5 | tutti, very fast: weak |

Units 1–28 are reliable (8–13 of 13). Trust units 29, 31 and 34 only for the notes they have.

### Recurring events

- **Phrase entries**: one every unit. Every 4.2 s in statement 1, every 4.0 s in statement 2, 3.6 s at 91–101 s, and
  2.6–3.1 s in the frenzy. The low band shows each one as a pizzicato footfall (onset peaks at 3.69, 8.27, 12.59,
  16.83, 21.00, 29.47 … 94.71, 101.85 s). → `phrase-entries`
- **The climb and the answer**: each unit is 7–8 rising notes, then a turning bar. → `theme-climbs`, `theme-answers`
- **Landings**: the quarter and half notes the runs land on, about two a bar. → `theme-landings`
- **The A sigh**: the half note A that ends each A2 unit, up to 1 s long in statement 1. These are the only long notes
  before the break. → `long-a-sighs`
- **Minor and major halves**: B minor (A units) against F# major (B units), switching every 16–17 s, then every 12 s.
  → `theme-minor`, `theme-major`
- **Cymbal pulse**: two strokes a bar, 101.9–135.7 s. → `cymbal-pulse`
- **Blow and crash pairs**: in the coda, a low hammer blow and, 0.25 s later, its cymbal crash, six times. →
  `ff-blows`, `coda-crashes`

## The sets

Counts are notes and attacks (notes within 40 ms are one attack). Spans are in seconds.

| id | what one hears | notes / attacks | span | source |
|---|---|---|---|---|
| `opening-pedal` | The horns' soft held note out of silence (F#4, v16). | 1 / 1 | 1.02–3.77 | pack |
| `phrase-entries` | Every entry of the motif: the first note of each unit (30 of 34; 2 from audio onsets). The clock the accelerando really keeps. | 30 / 30 | 3.72–128.49 | roll+pack+audio |
| `theme` | The tune itself, one note per eighth slot, all 34 units. The whole arc on one strand. | 361 / 361 | 3.72–129.96 | roll+pack |
| `theme-climbs` | The rising first bar of every unit: the creep up the stairs. | 204 / 204 | 3.72–129.32 | roll+pack |
| `theme-answers` | The answering second bar of every unit: the trolls turning round. | 157 / 157 | 5.97–129.96 | roll+pack |
| `theme-minor` | The B-minor units (A, A2). | 232 / 232 | 3.72–129.96 | roll+pack |
| `theme-major` | The F#-major units (B, B2): brighter, higher. | 129 / 129 | 20.98–125.42 | roll+pack |
| `theme-landings` | The held quarter and half notes the runs land on. | 70 / 70 | 5.40–129.96 | roll+pack |
| `long-a-sighs` | The held A ending the A2 units (0.45–1.04 s), at 11.43, 19.88, 45.23, 62.03 and 70.02 s. | 5 / 5 | 11.43–70.50 | roll |
| `theme-pizz-basses` | The tune plucked by cellos and basses, B1–B2 (units 1–2 and 9–10). | 41 / 41 | 3.72–45.74 | roll+pack |
| `theme-bassoons` | The tune in the bassoons (with clarinet and horn at 29–37 s): units 3–4, 7–8 and 11–12. | 69 / 69 | 12.56–53.52 | roll+pack |
| `theme-low-strings-f-sharp` | Violas and cellos on the first F# half (units 5–6). | 25 / 25 | 20.98–28.94 | roll+pack |
| `theme-violins-enter` | Statement 2 opens two octaves up in the violins (units 13–14). | 21 / 21 | 55.36–62.29 | roll+pack |
| `theme-winds` | Oboe on top, clarinet and bassoon (units 15–16). | 26 / 26 | 63.02–70.50 | roll+pack |
| `theme-strings-rising` | Strings, crescendo and accelerando (units 17–24). | 93 / 93 | 71.04–100.78 | roll+pack |
| `theme-tutti` | The tune at the top of the frenzy, B5–F#6 (units 25–34; partial, see the scores). | 86 / 86 | 102.46–129.96 | roll+pack |
| `pizz-footsteps` | The low pizzicato plucks under the tune (cello, bass and strings lanes plus pack notes below D3 that are not the tune): the footfalls. | 237 / 236 | 4.28–101.97 | roll+pack |
| `stamping-bass` | The loud low notes of the frenzy, below C3, velocity ≥ 60. | 94 / 93 | 103.42–135.16 | roll+pack |
| `frenzy-tremolo` | One pitch hammered 3+ times: the tremolo glitter of the frenzy (F#5 at 119.2 s, A at 129.4 s, the B chord at 131 s). | 115 / 114 | 103.04–135.16 | roll |
| `cymbal-pulse` | The cymbal strokes, about every 0.75 s; pitch B6 nominal. | 45 / 45 | 101.90–135.89 | audio |
| `bassoon-lane` | The whole bassoon lane, octaves as one. | 82 / 82 | 10.37–94.84 | roll |
| `reeds-lane` | Oboe and clarinet lanes before 140 s. | 92 / 92 | 10.37–100.35 | roll |
| `violins-high` | Violin and strings lanes at C5 and above: the top line from 56 s. | 328 / 327 | 22.55–143.31 | roll |
| `low-strings-lane` | Cello, bass and strings lanes below D3. | 395 / 394 | 4.28–145.75 | roll |
| `brass-lane` | Brass, horn and trumpet lanes before 140 s: a few horn notes, then frenzy blasts. | 37 / 37 | 30.96–139.92 | roll |
| `break-chord` | The B-minor chord hammered ff, 131.08 s, held to 133.1 s: the music stands still. | 8 / 2 | 131.08–133.15 | roll |
| `break-turn` | The turn in octaves after it, C# D E D C# B, then B hammered. | 10 / 10 | 133.18–134.62 | roll |
| `ff-blows` | The six coda hammer blows and the final chord; pitch B1 nominal. **The Fireworks set.** | 7 / 7 | 136.46–150.09 | audio |
| `coda-crashes` | The cymbal crash after each blow, and the final crash; pitch B6 nominal. | 6 / 6 | 136.72–150.47 | audio |
| `coda-chords` | The blows as the transcription has them: low chords, E1–F2. | 24 / 6 | 136.43–145.79 | roll+pack |
| `stretta-runs` | The tune at double speed between the blows. | 32 / 32 | 137.49–143.47 | roll+pack |
| `held-breath` | The hushed diminished chord, five times, then D/B. | 39 / 7 | 145.91–147.46 | roll+pack |
| `final-strokes` | After the general pause: three growing strokes and the final crash. | 4 / 4 | 148.98–150.57 | audio |

## Holes: where the transcription is thin or wrong

- **0–3.7 s, the introduction.** One note, the horn F#4 at v16. Audio is −53 to −38 dB, a real near-silence. Use it as
  a deliberate, spare entrance: `opening-pedal`, the current's lone light, or black.
- **The cymbals, 101.9–135.7 s and the coda crashes.** No lane has them; they come from the audio (`cymbal-pulse`,
  `coda-crashes`).
- **The frenzy's tune, 104–108 s and 114–136 s.** About half of the audio onsets have no note within 60 ms. The violins'
  climb is often transcribed as repeated notes (tremolo), so units 29, 31 and 34 are half empty. `frenzy-tremolo`,
  `stamping-bass` and `cymbal-pulse` fill the picture there. A widget on `"listen": "violin"` will be busy, not tuneful.
- **The coda, 136.4–150.1 s.** Few notes (30 to 40 per 4 s), mislabelled lanes, the blows read as E1/A#1 by the
  transcriber, and 9 notes in the last crescendo. Use the audio sets (`ff-blows`, `coda-crashes`, `final-strokes`) and
  the pack chords (`coda-chords`, `held-breath`).
- **147.75–148.6 s, the general pause.** No notes. The pack loudness says 0.83; the audio is −30 dB.
- **150.1–161.96 s.** Reverb, then silence from 151.5 s. Nothing to answer. End the show at the music, or let it go
  black.
- **The horn pedal through statement 1** is not in the notes. Only the first held F#4 is.

## The weight table: which strands lead, per 30 s

Weights 0–1 are a starting point for intensity curves on always-on threads. "–" means the strand is silent there.
Strands named in bold lead. The 30 s windows cut across sections: 0–30 is statement 1's first two thirds; 30–60 is its
end and the violins' entry at 54.9 s; 60–90 is the winds and the F# half; 90–120 is the push into the frenzy at
101.85 s; 120–150 is the end of the frenzy, the break at 130.6 s and the coda from 136.4 s.

| strand (set) | 0–30 | 30–60 | 60–90 | 90–120 | 120–150 | 150–162 |
|---|---|---|---|---|---|---|
| `theme` (the whole tune) | **0.9** | **0.9** | **0.9** | **0.9** | 0.6 (to 130.6) | – |
| `theme-pizz-basses` / `theme-bassoons` / `theme-low-strings-f-sharp` | **0.9** | **0.9** (to 54.9) | – | – | – | – |
| `theme-violins-enter`, `theme-winds`, `theme-strings-rising` | – | 0.7 (from 54.9) | **0.9** | **0.9** (to 101.85) | – | – |
| `theme-tutti` | – | – | – | **0.8** (from 101.85) | 0.6 (to 130.6) | – |
| `pizz-footsteps` | 0.6 | 0.6 | 0.5 | 0.3 (to 101.85) | – | – |
| `phrase-entries` | 0.5 | 0.5 | 0.5 | 0.6 | 0.4 (to 128.5) | – |
| `theme-landings`, `long-a-sighs` | 0.4 | 0.4 | 0.5 | 0.5 | 0.3 | – |
| `theme-minor` / `theme-major` (alternating colour) | 0.5 | 0.5 | 0.6 | 0.6 | 0.4 | – |
| `bassoon-lane`, `reeds-lane` | 0.4 | 0.4 | 0.5 (winds 63–71) | 0.1 | – | – |
| `low-strings-lane` | 0.3 | 0.3 | 0.4 | 0.6 | 0.6 (to 136) | – |
| `violins-high` | – | 0.2 | 0.5 | **0.8** | 0.7 | – |
| `cymbal-pulse` | – | – | – | **0.8** (from 101.9) | **0.8** (to 135.7) | – |
| `frenzy-tremolo`, `stamping-bass` | – | – | – | 0.7 (from 103) | 0.7 (to 135.2) | – |
| `brass-lane` | – | 0.1 | 0.1 | 0.4 | 0.3 | – |
| `break-chord`, `break-turn` | – | – | – | – | **1.0** (130.6–136.4) | – |
| `ff-blows`, `coda-crashes`, `coda-chords` | – | – | – | – | **1.0** (136.4–150.1) | – |
| `stretta-runs`, `held-breath` | – | – | – | – | 0.7 (137–147.5) | – |
| `final-strokes` | – | – | – | – | **1.0** (148.6–150.6) | – |
| a dim trace or field | 0.2 | 0.2 | 0.3 | 0.4 | 0.3 (0 in 147.75–148.6) | 0 after 151 |

How the arc reads from this:

- In statement 1 (3.7–54.9 s), four quiet threads are always on: the tune, the footsteps, the phrase entries and the
  landings. The tune's carrier changes every 8.4 s (pizz, bassoon, violas, winds), so a composer can cross-fade between
  carrier strands at exactly those unit times.
- Statement 2 (54.9–101.85 s) lifts the same threads two octaves and thickens them.
- The frenzy (101.85–130.6 s) swaps the delicate threads for the cymbal pulse, the tremolo and the stamping bass, with
  the tune on top.
- The break and coda are the only places for strokes that stand alone.

**For widget choice, from the house rules:**
- Fireworks only on `ff-blows`; it is the piece's only set of real ff blows.
- Flee only on the frenzy's masses through a lane listen (`violin`, `strings`), never on a set.
- Handover only on `long-a-sighs`, `break-chord` or `opening-pedal`, the only long, slow notes.
- No busy red textures in the pp statement 1.
- Ivory rows one per unit (a unit is one phrase, 4.2 s down to 2.6 s).
- The general pause and the end want black.
