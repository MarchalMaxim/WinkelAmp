# Scripted visuals — design

_2026-10-30 · WinkelAmp v2 direction. Agreed in conversation with the user; items marked **(Claude's call)** were
proposed by Claude and not objected to, and may be revisited._

## Intent and why

WinkelAmp v1 is properly responsive, but it reacts to the *energy* of the sound (band levels, beats), not to the
**melody** or the **emotion**. It also stays on one of four scenes until the user changes it, and it asks the user to
turn too many knobs. Winamp's MilkDrop feels more alive mainly because it keeps changing what is on screen (thousands
of presets, morphing or cutting every so often, hard cuts on bass hits) — but its changes are random and it does not
know the music.

v2 should feel like a **lighting designer who studied the song**: elements that follow parts of the music (above all
the melody) come into the picture and fade away, the mood of the picture follows the mood of the music, big moments
get big changes, and the user hardly has to touch anything.

## The four ideas

### 1. The music is the clock

Nothing moves because time passes; every motion has a cause you can hear.

- A **music clock** advances by `dt × drive`, where `drive` comes from musical activity (loudness, onset activity,
  spectral change). Loud and busy → fast; quiet → barely; silence → `drive = 0`, the picture freezes.
- Every element animates on the music clock and on audio features, **never on wall-clock time**. (This is the
  deliberate opposite of MilkDrop's `sin(time)` idle motion.)
- In silence the frozen picture **slowly dims** (after ~1 s of silence, fade over a few seconds to a faint
  afterimage) **(Claude's call)**, and comes back with the sound.
- Exceptions, because they are also "causes": the user's pointer painting, and MIDI keys. Transitions that were
  *triggered* by a musical event (a cut on a drop, a blend between sections) complete in wall-clock time (≤ ~2 s) so
  a blend never hangs half-way in a following silence **(Claude's call)**.

### 2. A cast of elements, each following a part of the music

The picture is a **stage** on which a small number of **elements** appear, live, and leave. Each element follows one
musical stream. First vocabulary (6–8 types; the builder may adjust names and add one or two if it clearly helps):

| Element | Follows | Look |
|---|---|---|
| **Melody thread** | the predominant melody (pitch, note on/off, duration) | a glowing line/stroke that traces the tune: higher notes higher on screen, long notes become long strokes, leaps become jumps; leaves a fading trail so the recent phrase is visible |
| **Bass masses** | the bass line / low register | big, heavy, slow shapes low on screen |
| **Sparks** | quick high notes, staccato, transients in the treble | small crisp particles, star-shaped when attacks are sharp |
| **Chord bloom** | harmony (chroma, chord changes, major/minor) | broad soft color fields that shift color when the harmony changes |
| **Pulse** | the beat (when there is a clear pulse) | rings/flashes/gridded throbs on the beat |
| **Fluid** | overall character (the Living Canvas from the character-engine build) | the WebGL fluid + sparks + aura, its *material* set by the character engine |
| **Wave** | the raw waveform | an oscilloscope line — the fine detail of the sound (MilkDrop's most "honest" element) |

Every element has: a palette/colors, an intensity, a size, a position bias/region, and enter/exit transitions
(fade, grow, sweep in, hard). Elements can overlap; the stage composites them in one pipeline (glow, feedback/trails,
optional mirror). A **scene** = a named set of elements with their parameters + global look (palette, trails/feedback,
mirror, post-processing).

### 3. Scripts composed by Claude ahead of time, saved in a corpus

For a song file, the show is **composed ahead of time by Claude in a Claude Code session** — not by the app. The user
explicitly chose this over in-app API calls.

Flow:

1. The user runs one command on a song file: `npm run study -- <file>`.
2. It writes a **study pack** to a folder (path printed): everything Claude needs to "hear" the song, because Claude
   cannot listen to audio directly:
   - `summary.md`: duration, tempo/beat grid summary, key/mode over time, **sections** with times and character,
     **drops / climaxes / big changes** with times, **melody** summary (range, phrases with start/end times,
     repeated motifs/returning themes if detectable), mood timeline (character engine archetype blend + words per
     section), loudness arc;
   - `analysis.json`: the per-second (or finer) timelines and event lists behind the summary (beats, onsets,
     melody notes, sections, drops, descriptors, character);
   - images: a spectrogram, a melody plot (pitch over time), a mood/energy timeline — Claude reads images;
   - the audio **fingerprint** (see below).
   The study pack uses **exactly the same analysis code** as the live app (`src/audio/offline.ts` path).
3. The user asks Claude to compose; Claude reads the pack, adds what it knows about the piece if it recognizes it
   (e.g. "the opening three octaves are the motto and return fff at the climax"), and writes a **visual script**
   to `corpus/<slug>.json`, following a written **composer's handbook** (`docs/COMPOSING.md` — the heuristics:
   cross-modal correspondences, how to use each element, pacing rules, how to mark big moments).
4. A validator (`npm run check-script -- corpus/<slug>.json`) checks schema, times, references. A **preview**
   command renders stills of the scripted show at each cue (Playwright + the real app) into a contact sheet, so
   Claude can look at what it composed and revise.
5. When the user plays that song (file or drag-and-drop), the app recognizes it by fingerprint and **performs the
   script**: the script decides *what* is on stage and *when*; the sound still drives all motion live.

**Script contents** (schema is the builder's to design precisely; it must be versioned, human-readable JSON that an
LLM can write reliably):

- song metadata (title, optional artist, duration, fingerprint), composer notes;
- a small library of named scenes (sets of elements + parameters + global look);
- a timeline of cues: scene changes (cut or blend, with duration), element enter/exit, accents on specific moments
  (e.g. "flash white on the downbeat at 1:23"), parameter ramps (e.g. palette darkening over a section);
- references back to a returning theme so the same image can return with it.

Times are in seconds of song time. **(Claude's call:)** the engine snaps cue times to the nearest detected onset/beat
within a small window so cues land on the music even if hand-written times are slightly off. Playback must stay in
sync through pause, seek and track changes.

**Fingerprint:** computed from decoded audio in the browser (fast, on load) and identically in the study command
(ffmpeg decode). It must match the same recording across encodings/sample rates (fuzzy match on a coarse
time-frequency energy signature + duration), and not match different songs. Corpus lives as files in the repo and is
bundled with the app.

### 4. Live fallback: the director

When there is no script — mic input, MIDI playing, or a song not yet in the corpus — a **live director** runs the same
stage with rules:

- the character engine (descriptors → axes → archetype blend → material) sets the **mood** of whatever is cast;
- casting follows what is present: a clear melody → the melody thread; strong bass → bass masses; a clear pulse →
  pulses; quick high notes → sparks; etc. Elements enter when their stream appears and fade when it goes away;
- **scene changes happen on bass drops** (the low end suddenly coming back hard relative to its recent average,
  typically after a build-up or a stripped-back moment), with a **minimum gap of ~15–20 s** so kick-heavy music
  does not flicker **(Claude's call)**, hard cut on a real drop, softer blends otherwise;
- for music without drops (classical, solo piano): scene changes on **big section changes** (novelty in harmony,
  register, texture, loudness), with a minimum section length;
- the next scene is chosen to fit the mood, not at random.

## Minimal interface

- Visible by default: transport (play/pause, prev/next), volume, **one "Calm ↔ Wild" slider** (scales how strongly
  everything reacts; does not change what the script casts), and a small **badge**: "Scripted" when a corpus script
  runs, "Live" otherwise, plus the current mood words (e.g. "dark · heavy").
- Everything else from v1 — mirror, palette, trails/drift, the Sound → Motion patch bay, saved looks, scene picker,
  MIDI setup — moves into a closed **"Tweak" drawer**. Nothing is removed; MIDI mappings keep working.
- **(Claude's call)** A tweak in the drawer pins that parameter for the rest of the song; explicitly picking a scene
  pauses the script for the rest of the song (badge: "Scripted · paused", click to resume).
- The v1 Canvas2D scenes (Bloom, Swarm, Ribbons, Pulse) remain available ("Classic" in the drawer) **(Claude's
  call)**; they may also be reused as elements if that is cheap.

## MIDI

- Played keys feed the stage directly as sound events (the melody thread and sparks respond to them).
- The key synth (`keyBus` in `src/main.ts`) is connected to the engine's input so played keys are also *analyzed*.

## Goals

- The picture visibly follows the melody (the melody thread traces the tune you hear) and the emotion (mood → palette,
  material, weight, pace).
- Elements come and go with the music; big moments get big changes.
- A scripted song looks composed: right elements at the right moments, returning themes return visually.
- Unscripted music still looks good and changes with the music.
- Hardly any knobs.

## Non-goals

- Calling Claude/the Anthropic API from the app (scripts are composed in a Claude Code session).
- The neural tagger (musicnn) — deferred; the character engine works without it.
- Recreating MilkDrop or its presets.
- Pre-composing for live mic input.

## Anti-goals (would be a failure even if it technically works)

- Motion with no audible cause (idle wobble during silence).
- Flickering between looks, or scene changes that ignore the music.
- A script drifting out of sync with the song (after pause/seek, or due to timing error).
- Breaking the user's existing MIDI mappings or saved looks.
- The app looking bad without a script.
- A melody thread that draws noise (jumping around on drums or reverb) instead of the tune.

## Constraints

- Browser app: Vite + TypeScript, no framework; WebGL2 (with graceful fallback), 60 fps target at 1080p on a laptop
  iGPU (dev machine: RTX 4080).
- One analysis code path for live and offline (the character-engine build delivers `pcm.ts`, `fft.ts`,
  `descriptors.ts`, `offline.ts`, `src/character/*`, `src/visual/living/*`, `src/audio/studies.ts`).
- Study/compose tooling runs locally on Windows with Node/TS + ffmpeg; no Python packages available.
- Reference recordings stay out of git; corpus scripts (our own JSON) go in git.

## Success

- The user, watching their own pieces, says the picture follows the tune and the feeling.
- Measurable: melody tracking scored against ground truth from our own synthesized studies (known notes) — note
  pitch-class and onset accuracy reported; script cues land within ~50 ms after seek/pause; validator + preview
  pass for every corpus script; 60 fps on the dev GPU with adaptive quality.
- First corpus: scripts for the four character studies, the Rachmaninoff reference, and the reference recordings
  (Sugar Plum Fairy, Hungarian Dance No. 5, humpback, drum & bass, ragtime).

## Decisions after the builder check

- **Target music (user):** mostly **solo piano and classical**, e.g. Rachmaninoff's Piano Concerto No. 2 — piano
  plus full orchestra, dense textures, melody often in the strings while the piano arpeggiates underneath, long
  build-ups, few or no bass drops. Consequences:
  - melody extraction must find the **predominant melodic line in polyphonic acoustic music** (salience/harmonic-
    summation style with pitch continuity and voicing detection; the top line is a good prior for solo piano but not
    for a concerto), not a vocal-in-a-mix separator;
  - in the live fallback, **section changes (novelty) are the primary trigger** for scene changes; bass drops are a
    secondary trigger for music that has them;
  - calibration and examples should use classical material (the Rachmaninoff reference, the studies, Sugar Plum,
    Hungarian Dance, and the user's own recordings).
- **Scripted songs use precomputed analysis (Claude's call):** each corpus script is bundled with the study pack's
  event data (melody notes and contour, beats, sections, drops) computed offline *with look-ahead* (e.g. smoothing
  over the whole piece). In scripted mode, elements are driven by that data, aligned to playback position — so the
  melody thread is exact and on time — while live analysis still drives intensity and the music clock. The live
  melody tracker only has to be good enough for unscripted music. "One analysis code path" means the offline data
  is produced by the same classes as the live analysis, plus offline-only post-processing.
- **The character-engine build is a base to verify, not a given (Claude's call):** before building on it, its tests
  must pass, its mood mapping must be checked against the reference recordings, and the Living Canvas screenshots must
  be reviewed; fixing/calibrating it is part of this work.
- **In-app character studies (Claude's call):** studies are recognized **by id**, not by fingerprint. Their scripted
  performance uses a pinned seed (the one the study pack was made from), and since a study knows its own notes it
  can emit exact melody/beat events directly. Later loops still re-seed for variety and fall back to the live
  director. Rendered WAVs of the studies are used only for making study packs and for testing.

## Left to the builder

Exact script schema; element rendering technique; melody-extraction algorithm (must output note segments with pitch,
start, end, confidence, and a continuous pitch contour); fingerprint algorithm details; drop/section detection
thresholds; how v1 scenes fit in; file layout beyond the paths named above.
