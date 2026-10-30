# Composing a show — the handbook

WinkelAmp performs a **script** for a song it recognises: the script decides *what* is on stage and *when*; the
sound still drives every motion. Scripts are composed ahead of time, in a Claude Code session, from a **study
pack** — because the composer can't listen to the audio, the pack describes it in words, numbers and pictures.
This handbook is how to compose one: the workflow, the cast, the heuristics, and the schema.

## 1. Workflow

```
study → read → write → check → preview → revise (→ check → preview …) → commit
```

1. **Study.** `npm run study -- <audio file> [--id <slug>]`. The id defaults to the file name as a slug
   (`rach_prelude.wav` → `rach-prelude`). It writes:
   - `study/<slug>/summary.md`, `analysis.json`, `spectrogram.png`, `melody.png`, `mood.png` (git-ignored);
   - `corpus/<slug>.data.json`: the song data the app plays the show from (melody notes and contour, beats,
     onsets, sections, drops, chords, mood) and the recording's fingerprint. Committed with the script.
2. **Read.** `summary.md` first (header, sections, big moments, melody, beat grid, a line per 10 s), then all
   three images. `analysis.json` holds every number behind them (per-second descriptors and character, every
   note, phrase, motif, onset, beat and chord) for when a detail matters. Add what you know about the piece:
   if you recognise it (“the opening motto returns fff at the climax”), that knowledge counts as much as the
   analysis — and overrides it where they disagree (see *Reading a pack critically*).
3. **Write** `corpus/<slug>.json` (schema in §5). Start with the big shape: one scene per section or per
   character, the climax, the returning themes. Then the cues within sections.
4. **Check.** `npm run check-script -- corpus/<slug>.json` → `OK`, or every error with its JSON path. Pacing
   advice (crowded stage, hurried scene changes, cues past the end) prints as warnings: read them, they are
   usually right.
5. **Preview.** `npm run preview-script -- <slug> <audio file>` (a study script needs no file). The real app
   plays the song in Chrome, finds the script by fingerprint, and saves a still just after every cue to
   `study/<slug>/preview/cue-NN.png` plus `contact.png` (24 stills a sheet; `contact-2.png`… beyond). Read the
   contact sheet: does each still read as the music at that moment? Does the climax look like the biggest
   thing in the show? Is anything cluttered, empty or washed out?
6. **Revise** and repeat 4–5 until it does. Then commit `corpus/<slug>.json` and `corpus/<slug>.data.json`
   (never the audio, never `study/`).

## 2. Reading a pack critically

- **Times** are song seconds of *this exact file* (when the sound is heard). The app finds the script by the
  recording's fingerprint; another recording, or the same one with a different lead-in, will not line up.
- **Mood** (the character engine's archetype blend and words) can be wrong for a piece: it hears descriptors,
  not the score. Sugar Plum Fairy reads *lament/abyss/storm* though it is whimsical and tiny. Trust your
  knowledge of the piece when it disagrees; the script sets the mood of the picture anyway.
- **Sections** are novelty peaks (harmony, register, texture, loudness changing together); they are good
  scene boundaries, but a long section may hold several musical ideas — split it with your own cues.
- **Drops** are the low end coming back hard. In pop and electronic music they are the moments for hard cuts.
  In classical music most “drops” are just the bass re-entering: use only the strongest, if any.
- **Loudness peaks** (P1…P5): P1 is where the biggest accent belongs.
- **Melody**: phrases (a rest over 1 s ends one) with shape words, and motifs — interval patterns of ≥ 5 notes
  that come back (any transposition). A returning motif is your returning theme. The tracker follows the
  predominant line; in dense orchestral passages it may jump between voices, so read the piano roll's shape,
  not single notes.
- **Beats** are kept only where the pulse is clear enough (pulse clarity ≥ 0.3). The summary says when the
  pulse is weak: then a pulse element would throb on a guess.
- **Images**: `spectrogram.png` is log frequency (C1 at the bottom … C9 at the top); `melody.png` shows notes as
  bars, the continuous contour in blue, motif letters above their occurrences (long pieces wrap into 2-minute
  rows); `mood.png` stacks the archetype blend, then loudness (with how often a tune is voiced), pitch
  (register, brightness), motion (onset rate, pulse clarity, attack) and mode (major +, minor −). Dashed
  marks: white `S2…` section starts, red `DROP`, gold `P1…` loudness peaks.

## 3. The cast

Every element follows one stream of the music. Up to four on stage at once.

| Element | Follows | Styles (first = default) | Use it for |
|---|---|---|---|
| `melody` | the predominant melody: pitch, note on/off, duration (precomputed for a scripted song, so it is exact and on time) | `ribbon` a smooth glowing band · `beads` one bead per note, bigger for longer notes · `ink` dye poured into a fluid when one is on stage, else dry brush strokes | whenever a clear tune is present. Higher notes sit higher; the last ~4 s of the phrase stay visible |
| `bass` | the bass level and the music's weight | `orbs` three soft bodies that swell with the bass · `tides` swells rolling along the bottom | heavy, low, dark music; a bass line that matters |
| `sparks` | onsets and high notes (bursts where they sound) | `stars` twinkling points (star-shaped when the material is angular) · `dust` many tiny slow motes · `embers` warm streaks that rise | quick high notes, staccato, pizzicato, sparkle; `dust` for quiet texture |
| `bloom` | the harmony: chord root on the circle of fifths → hue, minor cooler and paler, cross-fades on chord changes | `fields` large soft clouds · `aurora` curtains hanging from the top | harmony-led, sustained, lush passages; a colour bed |
| `pulse` | the beat (hidden while pulse clarity < 0.3) | `rings` a ring from the region's centre · `grid` a throbbing lattice · `flash` the region lights up | music with a clear, steady beat (dance, march, ragtime). Not for rubato |
| `wave` | the raw waveform (an oscilloscope) | `line` across the region · `circle` wrapped round its centre | the fine detail of a single voice or a drone; electronic textures |
| `fluid` | the overall character: the Living Canvas (fluid, sparks, aura), its material set by the mood | `living` | atmosphere, turbulence, a full-screen bed; heavy and stormy music |

**Element params** (all optional; defaults in brackets):

- `intensity` 0..1 [0.7] — how strongly it shows and reacts;
- `size` 0..1 [0.5] — how big its marks are;
- `region` [`full`] — `full`, `top`, `bottom`, `left`, `right`, `center`: where it prefers to be;
- `color` [`mood`] — `mood` follows the palette, `note` colours by pitch class, or a fixed `"#rgb"` / `"#rrggbb"`;
- `style` — one of the type's styles above.

**The look** (per scene; all optional, defaults in brackets): `palette` [`mood`] (`mood` follows the
character engine, `notes` colours by pitch class, or four fixed colours shadow → highlight), `trails` 0..1
[0.5] (how long the feedback lingers), `warp` 0..1 [0.2] (how much the feedback drifts and swirls), `mirror`
[1] (kaleidoscope: 1, 2, 4, 6, 8 or 12), `glow` 0..1 [0.6]. A scene's look starts from these defaults, not from
the previous scene.

**Accents** (one moment, ~1.5 s): `flash` (the picture lights up in `color`, decaying fast), `shock` (a ring
of displacement rushing out from the centre, with a colour split), `swell` (the whole picture breathes up and
back). `strength` 0..1 [1], `color` [white].

## 4. Heuristics

### Cross-modal correspondences (what people reliably agree on)

| Sound | Felt as | On stage |
|---|---|---|
| High pitch | small, light, high up, bright, thin | small `sparks` (`stars`, `dust`), `region: top`, small `size`, pale or bright colours |
| Low pitch | big, heavy, low, dark | `bass` (`tides`, `orbs`), `region: bottom`, big `size`, deep colours |
| Loud | big, near, bright | more `intensity`, more `glow`, bigger `size` |
| Sharp attacks / staccato | angular, pointy, discrete | `sparks` `stars`, `melody` `beads`, short `trails` |
| Legato / sustain | round, continuous | `melody` `ribbon`, `bloom`, `fluid`, long `trails` |
| Fast tempo / dense onsets | quick, busy | more sparks, `pulse` if the beat is clear, lower `trails` |
| Irregular rhythm, dissonance | erratic, agitated, rough | `fluid`, high `warp`, `shock` accents |
| Major + fast | happy: light, saturated, warm | gold/white palettes, `bloom` `fields`, `flash` on the beat |
| Minor + slow | sad: dark, desaturated, blue | grey-blue palettes, `ink`, `dust`, long trails, low `glow` |
| Noisy / bright timbre | rough texture, sparkle | `sparks` `dust`, `wave` |

### Moods → starting points

These are the live director's scenes (`src/stage/library.ts`): good first drafts for a section whose mood is
clear. Copy, then make them yours.

| Mood | Scene | Elements | Look |
|---|---|---|---|
| fire (fiery, erratic) | Embers | `fluid`, `sparks` `embers` bottom, `melody` `ink`, `bass` `orbs` | trails 0.6, warp 0.4, glow 0.8 |
| abyss (dark, blunt, heavy) | Deep water | `bass` `tides` bottom size 0.8, `bloom` `fields`, `melody` `ribbon` 0.5, `fluid` 0.6 | trails 0.75, warp 0.3, glow 0.4 |
| sugar (whimsical, tiny, quick) | Music box | `sparks` `stars` size 0.3, `melody` `beads` size 0.4, `pulse` `rings`, `bloom` `aurora` 0.4 | trails 0.35, warp 0.1, mirror 6, glow 0.7 |
| mist (serene, hazy) | Fog | `fluid` 0.6, `bloom` `aurora`, `melody` `ribbon` size 0.3 | trails 0.85, warp 0.5, glow 0.5 |
| gold (radiant, triumphant) | Cathedral | `bloom` `fields` 0.9, `melody` `ribbon` top, `pulse` `flash` 0.4, `sparks` `dust` | trails 0.5, warp 0.15, mirror 2, glow 0.9 |
| storm (stormy, driving) | Tempest | `fluid` 0.9, `bass` `tides`, `sparks` `stars`, `melody` `ink` | trails 0.6, warp 0.8, glow 0.6 |
| machine (mechanical, pulsing) | Circuit | `pulse` `grid`, `wave` `line`, `sparks` `dust`, `bass` `orbs` | trails 0.3, warp 0.1, mirror 4, glow 0.8 |
| lament (mournful, grey) | Rain | `bloom` `fields` 0.4, `melody` `ribbon`, `sparks` `dust`, `fluid` 0.4 | trails 0.7, warp 0.15, glow 0.4 |

### Pacing and shape

- **At most four elements on stage.** More reads as clutter (the checker warns).
- **At least 8 s between scene changes**, except around a climax, where quick changes are the point.
- **Save the biggest accent for the climax** (P1, or the moment you know is the peak). Before it, keep accents
  smaller (`strength` 0.4–0.7) and rarer; a show that flashes everywhere has no climax.
- **The melody thread is on whenever a clear tune is present** (the summary says how often the tune is
  voiced). Take it off — or turn it down — for passages without one; let it come back with the tune.
- **Returning themes return with their scene.** When a motif or section comes back, bring back its scene (the
  same scene name), so the viewer recognises it. Vary it the second time with a ramp or an accent if the music
  does.
- **Dark / low / slow → heavy:** `bass`, `fluid`, long trails, deep palette, low glow, big sizes.
  **High / quick → small, bright, sparse:** `sparks`, `beads`, short trails, bright palette, small sizes.
- **Build-ups are ramps**: raise `<id>.intensity`, `look.glow` or `look.trails` over the crescendo, then cut or
  accent on its arrival.
- **Cut on a real drop or a hard arrival; blend otherwise.** Blends finish within 2 s.
- **Mirror** is strong seasoning: `2` or `4` for a formal, symmetrical moment, `6`–`12` for toy-like or
  hypnotic music. Changing it changes the whole picture, so do it at a scene change.
- **Silence is part of the show**: when the music stops the picture freezes and slowly dims. Don't cue into a
  general pause; cue on the note that ends it.

### Known behaviours of the stage

- `melody`, `pulse` and `wave` draw sharp, with only a faint (~30 %) echo in the feedback: `trails` and `warp`
  barely affect them. For a lingering, smeared melody use `ink` with a `fluid`.
- `fluid` plus `bloom` both at high intensity wash the top centre to white: keep one of them ≤ 0.5.
- With `color: "note"` or palette `"notes"`, `bass`, `pulse` and `wave` still tint by the live note.
- Ids are unique on stage. An `enter` (or a scene) that uses an id already on stage restyles that element (its
  numbers glide, its style switches half-way; a new type dips out and back in) rather than adding a second
  one. The checker doesn't flag a duplicate — give different things different ids.
- A scene change sets every element of the scene to the scene's values: a ramp running on an element (or on
  the look) is overridden by the next scene that includes it.
- A viewer who picks a scene or tweaks a setting in the app's drawer pauses the script (or pins that setting)
  for the rest of the song. Nothing to compose for; just know the show can be overridden.

## 5. The script schema

A script is JSON at `corpus/<id>.json`, version 1. Unknown keys are errors (a misspelled key would silently
change the show).

```jsonc
{
  "version": 1,                       // always 1
  "id": "sugarplum",                  // lowercase slug; must equal the file name (and the data file's id)
  "title": "…",                       // shown on the badge: "Scripted · <title>"
  "artist": "…",                      // optional
  "duration": 119.876,                // song seconds (copy from the summary / data file)
  "notes": "…",                       // optional: what the piece is and why the show is built this way
  "match": { "kind": "recording" },   // or { "kind": "study", "study": "ember", "seed": 1 } (§7)
  "scenes": { "<name>": { "look": { … }, "elements": [ { "id": "…", "type": "…", "params": { … } } ] } },
  "timeline": [ /* cues, sorted by "at" */ ]
}
```

**Scenes**: a name → `{ look?, elements }`. Element ids: letters, digits, `-`, `_` (no dots, not `look`), unique
within a scene. Use the same id for “the same thing” across scenes (`tune` for the melody everywhere): it then
carries over a scene change and is restyled instead of fading out and in.

**Cues**: each has `at` (song seconds ≥ 0; the timeline sorted by `at`, ties apply in order), optional `snap`,
and **exactly one** action:

| Action | Shape | Notes |
|---|---|---|
| scene | `{ "at": 36, "scene": "glitter", "transition": { "kind": "blend", "duration": 2 } }` | `transition` optional: `blend` [default, 1.5 s, at most 2 s] or `cut` (instant). Elements not in the new scene fade out over the blend |
| enter | `{ "at": 10.7, "enter": { "id": "tune", "type": "melody", "params": { "style": "beads" } }, "fade": 1 }` | `fade` [0.8 s] |
| exit | `{ "at": 60, "exit": "plucks", "fade": 2 }` | `fade` [1.2 s]; the id must be in some scene or entered earlier |
| accent | `{ "at": 97.2, "accent": { "kind": "flash", "color": "#fff4d6", "strength": 1 } }` | `flash`, `shock`, `swell`; lasts ~1.5 s |
| ramp | `{ "at": 70, "ramp": { "target": "harmony.intensity", "to": 0.6, "duration": 20 } }` | targets: `look.trails`, `look.warp`, `look.glow`, `<id>.intensity`, `<id>.size`; `to` 0..1 |

**Timing.** Each cue's time snaps to the nearest detected onset or beat within 120 ms, so a hand-written time
that is slightly off still lands on the music; `"snap": false` keeps it exactly where it is (for a moment
between notes). The fold is pure: after a seek or a pause the picture is exactly what the script says at that
moment, with no replayed accents.

**Checks** (`npm run check-script`): errors for anything malformed or unresolved (unknown scene, element type
or style, a ramp or exit naming an id that was never on stage, out-of-range values, an unsorted timeline);
warnings for pacing (more than four elements, scene changes closer than 8 s, cues after the end) and a missing
`corpus/<id>.data.json` for a recording.

## 6. A complete example

A sketch for the Sugar Plum Fairy reference recording (`sugarplum.ogg`), small on purpose: three scenes,
seven cues; it passes `check-script` as it stands. Pizzicato strings open (dust and a
quiet pulse), the celesta's tune enters as beads, the music thickens into a mirrored, glittering scene, the
harmony swells over twenty seconds, one flash for the loudest moment, trails lengthen into the ending.

```json
{
  "version": 1,
  "id": "sugarplum",
  "title": "Dance of the Sugar Plum Fairy",
  "artist": "Tchaikovsky",
  "duration": 119.876,
  "notes": "A small handbook example. Pizzicato strings open (S1), the celesta tune takes over and climbs (S2, S3); the loudest moment is P1 at 1:37. Tiny, bright, quick: stars and beads, a clear pulse, one flash saved for the peak.",
  "match": { "kind": "recording" },
  "scenes": {
    "pizzicato": {
      "look": { "trails": 0.35, "warp": 0.15, "glow": 0.6 },
      "elements": [
        { "id": "plucks", "type": "sparks", "params": { "style": "dust", "intensity": 0.6, "size": 0.3 } },
        { "id": "beat", "type": "pulse", "params": { "style": "rings", "intensity": 0.35, "region": "bottom" } }
      ]
    },
    "celesta": {
      "look": { "trails": 0.45, "warp": 0.2, "glow": 0.75 },
      "elements": [
        { "id": "tune", "type": "melody", "params": { "style": "beads", "color": "note" } },
        { "id": "plucks", "type": "sparks", "params": { "style": "stars", "size": 0.25 } },
        { "id": "beat", "type": "pulse", "params": { "style": "rings", "intensity": 0.3, "region": "bottom" } }
      ]
    },
    "glitter": {
      "look": { "trails": 0.55, "warp": 0.3, "mirror": 4, "glow": 0.8 },
      "elements": [
        { "id": "tune", "type": "melody", "params": { "style": "ribbon", "color": "note" } },
        { "id": "plucks", "type": "sparks", "params": { "style": "stars", "intensity": 0.8, "size": 0.3 } },
        { "id": "harmony", "type": "bloom", "params": { "style": "aurora", "intensity": 0.35, "region": "top" } }
      ]
    }
  },
  "timeline": [
    { "at": 0, "scene": "pizzicato", "transition": { "kind": "cut" } },
    { "at": 10.7, "enter": { "id": "tune", "type": "melody", "params": { "style": "beads", "color": "note" } }, "fade": 1 },
    { "at": 22, "scene": "celesta", "transition": { "kind": "blend", "duration": 1.5 } },
    { "at": 36, "scene": "glitter", "transition": { "kind": "blend", "duration": 2 } },
    { "at": 70, "ramp": { "target": "harmony.intensity", "to": 0.6, "duration": 20 } },
    { "at": 97.2, "accent": { "kind": "flash", "color": "#fff4d6", "strength": 1 } },
    { "at": 112, "ramp": { "target": "look.trails", "to": 0.8, "duration": 6 } }
  ]
}
```

## 7. `match`: recordings and studies

- **`{ "kind": "recording" }`** — a song file. The app fingerprints every file it plays and performs the
  script whose `corpus/<id>.data.json` fingerprint matches (same recording, any encoding or sample rate;
  durations within 2 %). The song data drives the melody thread, beats and onsets exactly, and the cue times
  snap to them. Compose from the study pack of **the very file** the user plays.
- **`{ "kind": "study", "study": "ember" | "basalt" | "sugar" | "mist", "seed": N }`** — one of the app's
  character studies (Demo button). Studies are recognised by id and seed, not by fingerprint, and need no
  data file: the app knows the study's score, so the melody and beats come from it exactly. The script plays
  on the first pass (the one composed from `seed`); later passes are re-composed and go Live. Compose from the
  score (`STUDIES[…].compose(seed)` in `src/audio/studies.ts`), or render the study
  (`node scripts/render-studies.mjs <dir> --seconds 0 --only ember`) and run `npm run study` on the WAV for a
  pack to read — but don't commit that WAV's data file; the script matches the study, not the recording.
