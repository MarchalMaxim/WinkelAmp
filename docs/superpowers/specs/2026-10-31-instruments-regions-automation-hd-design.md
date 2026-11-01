# WinkelAmp studio, round 2: instruments, places, intensity curves, tags and an HD master

Date: 2026-10-31. Status: design for the next build. It follows `2026-10-31-lab-first-studio-design.md` (the studio,
built last night) and supersedes the scratch draft `instruments-regions-activity-design.md` written earlier today. That
draft was written before YourMT3+ ran. Its "Plan B" for instruments (demucs stems, an AST tagger, tracks that are only
curves, with notes made up from the mix) is dropped here, because a model now gives real notes per instrument. Its
region and compositing measurements still hold and are reused.

Each decision below is marked:
- **[user]**: the user decided it, or asked for it in their own words.
- **[builder]**: the builder's call. A [builder] call marked *confirm* is listed at the end for the user to confirm.

## Why

The user, verbatim:

> "I'd like to have an option to have the visualizations more localized (so that they don't take up the entire
> screen), and perhaps intermittently active, or modulating their activity via some curve over a timespan"

> "the widget-modulation is an interesting feature, where we can make a curve that sort of modulates the intensity of
> the widget over a period of time. Make it like a line-graph with draggable pivots, sort of like they have in DJ
> software too."

> "can we connect some visualizations to other instruments in the music? Like the wobbly strings, they are very
> synesthetically close to like a violin or a old guitar."

> "tag some of the visualizations with keywords, whose goal it is to connect the visualization to a synesthetic aspect.
> Also, I'd like to tag it with instruments that could go well with it"

> "I noticed the things in the lab were a lot higher quality than the things we're producing in the studio... is there
> a way we can compile / render it in higher quality somehow? The HD version doesn't have to be real time and can take
> its time"

What each ask runs into today:

- **Place.** Every widget fills the 1280×720 canvas.
- **Activity.** Every widget is fully on for its whole section.
- **Instruments.**
  - Every widget hears every transcribed note, and those notes come from a piano model.
  - On orchestral recordings the piano model hears about half the music. Its onset coverage is 50 % on Beethoven's
    Fifth and 43 % on Vivaldi's Winter.
  - Beethoven has no notes at all from 5.5 s to 12.9 s.
- **Tags.** Nothing records what a widget feels like or which instrument suits it. The user's taste lives in verdicts
  and the composer's hand-made `TASTE` fits.
- **Quality.** The studio's videos are worse than the lab on screen for five reasons:
  1. The phone copies were squeezed to about 0.7 Mbit/s.
  2. `render-show` passes frames as JPEG (q 0.92).
  3. It renders 30 fps.
  4. It renders 1280×720, which phones and monitors then upscale.
  5. The in-app recorder's "share" preset is 1 Mbit/s.

  Probably also: x264 gets RGB converted with ffmpeg's default (BT.601) matrix and no colour tags, while players assume
  BT.709 for HD. That is a small hue shift. T9 checks it with ffprobe.

## What we know (measured today, reused here)

### YourMT3+ (MoE checkpoint), run with the user's approval

- **Where it runs.** venv `C:/Users/maxim/.venvs/wa-mt` (Python 3.11.9, torch 2.11.0+cu128, lightning 2.6.6), runner
  `ymt3_run.py`.
- **Speed.**
  - About 10 s per minute of audio on the RTX 4080 SUPER, 2.5 s to load, 1.9 GB peak.
  - So about 75 s for Beethoven's 7:05, and about 100 s for Vivaldi's 9:26.
- **What it writes.**
  - Rows of `[start, end, midi, vel, instrument]`. `vel` is always 100: there are no real velocities, and no 0 rows
    were seen.
  - The instrument names come from the MT3_FULL_PLUS classes ("Violin", "Viola", "Cello", "String Ensemble", "French
    Horn"…).
- **The labels were checked against the scores and are right:**
  - Beethoven (first 60 s, 902 notes):
    - 0–5 s: string ensemble.
    - From 5 s: violins (353 notes). They fill the 6–12.9 s gap the piano model missed.
    - 41.6 s: French horn (the horn call, 9 notes).
    - From 45 s: clarinet, oboe and bassoon.
    - A few spurious notes: "Synth Pad" 12, "Acoustic Piano" 4, "Organ" 2.
  - Vivaldi (first 60 s, 870 notes): violas (from 2.1 s) and cellos (from 1.2 s) first, then violins pile on (from
    4.8 s, 490 notes).
- **Never run on solo piano.** How it labels the Prelude, Winter Wind or the Nocturne is unknown.
- **Packaging today.**
  - The source is a downloaded Hugging Face Space in the session scratch folder: about 25k lines, revision
    `5e66c1ea…`.
  - The runner reads the checkpoint from a short copy, because the Space's own path is longer than Windows'
    MAX_PATH.
  - Checkpoint `moe.ckpt` sha256: `ae38e415c79efd5592dcb9b658cdb99ddb11d4c4e1eaa364cab04a052473fc25`.

### Basic-pitch

- **Where it runs.** venv `C:/Users/maxim/.venvs/wa-bp`, ONNX `nmp.onnx`, about 7 s plus 4–7 s import per song.
- **Coverage.**
  - It fills the orchestral gaps: 41 notes in Beethoven's 6–12.85 s.
  - On Vivaldi 0–120 s it reaches coverage 0.89. The piano model reaches 0.42 there, and a hybrid of the two 0.64.
- **Weaknesses.**
  - On solo piano it adds overtone ghosts: 117 of 125 extra Prelude notes are octaves or twelfths.
  - Its velocity scale differs from the piano model's.

### Compositing (synthetic widgets, system Chrome)

- **A paste weight on the persistent, fading canvas is not an opacity.**
  - Content redrawn every frame settles near `m·P / (0.12 + 0.88·m)`, so a weight of 0.1 already shows about 43 % of
    an opaque ground.
  - A correction table maps the visibility you want to the paste weight that gives it:

    | visible | 0.1 | 0.25 | 0.5 | 0.75 | 0.9 |
    |---|---|---|---|---|---|
    | weight, ground 200 | 0.030 | 0.057 | 0.128 | 0.288 | 0.528 |
    | weight, ground 80 | 0.057 | 0.080 | 0.171 | 0.331 | 0.594 |
  - For stroke widgets, the newest stroke is linear in the weight.
- **Cost of the compositor alone, four layers:** 0.65 ms per frame for spots, 0.81 ms for windows.
- **The compositor must never read pixels back.** A version that read back one pixel per frame did not return within
  300 s.

### HD supersampling (from the widget code)

- **Pixel readers** (`getImageData` / `putImageData` / `createImageData`): contours, current, horizon, klee, miro,
  pixelsort and score.
  - All of them except pixelsort only read their own offscreen buffers.
- **Readers of the shared canvas** (`drawImage(x.canvas…)`, `createImageBitmap(x.canvas)`): blocks, casket, fold,
  pixelsort, timeslice and tunnel. They copy it into 1280×720 scratches.
- **Calls that reset the transform to identity on the shared context:** fifths, flee, fold, hilma, pixelsort and
  timeslice.
- **`shadowBlur` and `filter: blur()`** are in device pixels and ignore the transform.
  - shadowBlur: brush, fold, harmonograph, hilma, pixelsort, score, squares, stella and timeslice.
  - filter blur: fields, flee, horizon, lenlye, pointillism, rorschach and squares. Most of these blur their own
    buffers.
- The widget set is changing in the lab round under way, so these lists are re-grepped when the work starts.

## What it is

A layer in a show gains three optional fields. A song pack gains instrument tracks. The widgets gain tags. And there is
a new way to export.

1. **`listen`: what a layer hears.** One of:
   - All notes (as today).
   - One instrument track of the recording (violin, viola, cello, horn, oboe…; from YourMT3+).
   - An instrument family (strings, winds, brass…).
   - A line derived from the notes: melody, bass line, inner voices, low notes, high notes, accents. Derived lines work
     on every song, piano included.

   A routed layer sees only those notes, through every way a widget reads them. Its level, rate, pitch, bass and
   density follow that part, so its knob drives follow it too. **[user]**
2. **`region`: where a layer is seen.** A rectangle or ellipse with a feathered edge, placed by dragging handles on the
   stage. It has two modes:
   - **Spot**: the widget as today, seen only through the shape.
   - **Window**: the whole widget, scaled into the shape, like picture-in-picture.

   **[user]** for regions; **[builder, confirm]** for the default mode: window, except spot for the canvas readers
   (casket, pixelsort, tunnel, blocks, fold, timeslice). **Answered by the user (2026-11-01, 0a66d5c):** a window for
   every widget, the readers included, a centred soft rectangle 40 % of the stage, fit contain; the studio and lab
   call the modes Small copy (window) and Mask (spot).
3. **`intensity`: an automation lane per layer.**
   - It is a line graph from 0 to 1 over time, with pivots, drawn under the studio's timeline, as in DJ software.
   - Presets create pivots: fade in, fade out, swell, pulse every N beats or bars, gate on loudness, and while its
     instrument plays.
   - It is undoable and saved in the show. **[user]**
4. **Tags.** `lab/tags.json` gives each widget:
   - feel words: synesthetic keywords such as silky, longing, heavy or skittish;
   - instruments that suit it;
   - a stack role.

   They show as chips with a filter in the lab and in the studio's widget picker. The auto-composer uses them.
   **[user]**
5. **An HD master.**
   - `npm run render-show` draws each frame at 2× (2560×1440, the default) or 3× (3840×2160). It sends the frames
     losslessly to x264 at 60 fps and high quality, with no size cap.
   - It also makes a share copy from the master: 1080p, about 15 MB a minute (60 MB for 4 minutes), for WhatsApp.
   - At 1× everything is pixel-identical to today. **[user]**

## Goals

### 1. Instrument tracks from YourMT3+ **[user]**

- **Two kinds of songs.**
  - Solo piano keeps the piano model: real velocities and no overtone ghosts.
  - For anything else, ingest runs YourMT3+ and writes a pack v2 with `tracks`, the notes of each instrument.
- **Velocities.** YourMT3 notes have none, so ingest estimates them (§ Decisions 2).
- **What ingest runs.** It finds YourMT3 through a config written by a documented setup script. The 25k-line source is
  never copied into the repo.
- **Fallback order** when something is missing. Each step down gives a warning in the pack and the studio, and the pack
  is still valid:
  1. YourMT3+ (tracks, and gap-filled notes).
  2. Basic-pitch (no tracks; it fills gaps in the piano model's notes).
  3. The piano model alone.
  4. Approximate notes (today's fallback).

### 2. Derived lines on every song

Melody, bass line, inner voices, low notes, high notes and accents are computed from the notes at run time, in shared
code. "Strings on the right hand's runs" works on Winter Wind without any new model.

### 3. Regions

- **Shapes.** Spot and window modes. Rectangle or ellipse, with feather, rotation, and for windows a blend
  (over or lighten) and a fit (cover, contain or stretch).
- **On the stage.** An SVG overlay with handles. It is never drawn into the canvas.
- **Across sections.** A region glides to its new place across a section boundary.

### 4. Intensity lanes

- **The lane.** One lane per layer of the selected section, or per instance across the whole show.
- **Pivots.**
  - Click to add one; drag to move it.
  - Snapping to beats is optional; Shift gives fine control.
  - Double-click or right-click deletes one.
- **Segments.** Drag a segment to bend it, or pick linear, ease or hold.
- **Presets** create pivots.
- **Undo, and saving.** Every drag is one undo step, and the lane is saved in show v2.
- **Exact meaning.** What intensity does to the picture is specified exactly (Decisions 4), so the lab and the studio
  match.

### 5. Tags

- **Where they live.** `lab/tags.json` and `lab/tag-words.json`, from the research proposal: 28 feel words on 5 axes,
  18 instruments, and roles.
- **Where they show.**
  - Lab cards and the studio's widget picker show chips and a filter.
  - `widget-docs` prints them in `COMPOSING-SHOWS.md`, so a Claude session composing by hand sees them.
- **What the composer does with them.**
  - It takes the feel words out of the user's description.
  - It matches widget instruments to the pack's tracks, routing those layers to them.
  - It gives an instrument that enters a section its own window.

### 6. An HD master and a share copy

- **Scale.** Supersampling at S = 2 or 3. The canvas is S times larger, and the base transform keeps widgets drawing
  in 1280×720 coordinates.
- **Frames.** Lossless, at 60 fps.
- **Master encode.** x264 with crf 13, preset slow, yuv420p and BT.709 tags. Optional masters are 4:4:4 or ProRes.
- **Share copy.** Made from the master: 1080p, 30 fps, two-pass x264, at the size budget.
- **The studio.**
  - The in-app recorder gets better presets. It stays 720p, because it captures the live canvas.
  - A dev-only "Render HD master" job runs `render-show` from the studio.

### 7. The shows

- **The hand-composed shows** use routing where it helps:
  - Winter Wind: strings on the melody, squares on the bass line.
  - The Prelude: the agitato split between the hands.
  - Beethoven: the second theme's strings on the violins, the horn calls, and the oboe cadenza.
- They are rendered as HD masters with share copies at the end.

### 8. The lab

- **Shared code.** The lab uses the same `lab/layers/*.js` for listen, region and intensity.
- **On each card.** A "listens to" select, a place control (with the same overlay on its stage), an intensity preset,
  tag chips and a filter bar.
- **Render mode.** It takes `?layers=` so the fidelity test covers the new paths. The lab has no automation lane
  (no timeline); its intensity comes from presets only **[builder, confirm]**.

## Decisions (exact enough to build and test)

### 1. Piano or ensemble **[builder, confirm]**

- **The rule.** `pianoShare` = the share of a song's YourMT3 notes, drums excluded, labelled Acoustic Piano or Electric
  Piano.
  - `kind = 'piano'` when `pianoShare ≥ 0.6`, else `'ensemble'`.
  - `--kind piano|ensemble` overrides the rule. `--kind piano` skips YourMT3.
- **Checking the rule.** Before the rule is trusted, the build measures `pianoShare` on the five recordings.
  - The pass condition: the three piano recordings ≥ 0.8, Beethoven and Vivaldi ≤ 0.1.
  - If it fails, the rule becomes the piano model's onset coverage instead: ≥ 0.6 means piano. The measured numbers go
    into HANDOFF.
- **Without YourMT3**, the coverage rule decides.
- **Not used:** demucs' piano-stem share, measured at 0.89–0.94 against 0.0005–0.0013. It needs another stage and venv
  for a decision YourMT3's own labels should make.

### 2. Notes and velocities for an ensemble song **[builder, confirm]**

- **`pack.notes` (all notes)** is a hybrid:
  1. every piano-model note;
  2. plus every YourMT3 note whose start is more than 0.15 s from every piano-model note's start;
  3. stable-sorted by start.

  It keeps every attack the hand-composed Beethoven show's section edges are snapped to, and fills the gaps (the
  6–12.9 s first theme). `--notes ymt3` uses YourMT3 alone.
- **`pack.tracks[id].notes`:** every YourMT3 note of that track. Drums and rows with `vel ≤ 0` are dropped, and so are
  notes with `end ≤ start`.
- **Velocity of a YourMT3 note:**
  - **Borrowed** when a piano-model note of the same MIDI pitch starts within ±0.05 s: the nearest one's velocity (ties:
    the earlier).
  - **Otherwise, from its loudness.**
    - The note's level `L` = the highest RMS, in dBFS, of the 10 ms frames (441 samples, not overlapping, from the
      decoded 44.1 kHz mono) that start in `[start, start + 0.06)`.
    - `r` = its mid-rank percentile among the `L` of all the song's YourMT3 notes: `(#below + (#equal − 1)/2)/(n − 1)`;
      a single note gives 0.5.
    - `vel` = the song's piano-model velocity distribution at quantile `r` (linear interpolation between order
      statistics), if the song has ≥ 50 piano-model notes.
    - Otherwise `vel` comes from the anchors 0.05 → 46, 0.5 → 69 and 0.95 → 95, piecewise-linear and extrapolated
      linearly. These are the pooled percentiles of the three solo-piano packs.
    - Round the result and clamp it to 1..127.
  - The basic-pitch fallback uses the same rule for the notes it adds.
- **Track ids and families** (YourMT3 class → track):

  | track | YourMT3 classes |
  |---|---|
  | piano | Acoustic Piano, Electric Piano |
  | plucked | Acoustic Guitar, Clean/Distorted Electric Guitar, Orchestral Harp |
  | violin, viola, cello | Violin, Viola, Cello |
  | contrabass | Contrabass, Acoustic Bass, Electric Bass |
  | strings | String Ensemble, Synth Strings |
  | timpani | Timpani |
  | voice | Choir and Voice, Singing Voice, Singing Voice (chorus) |
  | horn, trumpet | French Horn; Trumpet |
  | trombone | Trombone, Tuba |
  | brass | Brass Section |
  | flute | Pipe |
  | oboe | Oboe, English Horn |
  | clarinet, bassoon | Clarinet; Bassoon |
  | saxophone | Soprano/Alto Sax, Tenor Sax, Baritone Sax |
  | (none) | Synth Lead, Synth Pad, Orchestra Hit, Chromatic Percussion, Organ, Drums |

  - Notes with no track still count in all notes.
  - Families:
    - keys {piano};
    - plucked {plucked};
    - strings {violin, viola, cello, contrabass, strings};
    - winds {flute, oboe, clarinet, bassoon, saxophone};
    - brass {horn, trumpet, trombone, brass};
    - percussion {timpani};
    - voice {voice}.
  - A track is written only with at least `max(12, 0.5 % of the song's YourMT3 notes)` notes. This keeps Beethoven's 4
    "piano" and 2 "organ" notes out of the menu.
  - Labels in the UI are plain English ("Violins", "French horns", "Oboe").

### 3. Derived lines (shared code) **[builder]**

Over `groupChords(notes)` (the lab's 40 ms chords):

- **melody:** for each chord, its highest note joins the line when no melody note is sounding at the chord's time, or
  when it is at most 2 semitones below the sounding melody note.
- **bassline:** the same rule from below.
- **inner:** every other note.
- **low:** notes below MIDI 55.
- **high:** notes at MIDI 72 and above.
- **accents:** the notes of chords whose `vel` is at or above the song's 85th percentile of chord velocities
  (nearest rank).

A `listen` that names a track the song lacks plays on all notes, and the show validator warns. `family:<f>` is the union
of the family's present tracks.

### 4. What intensity does **[builder, confirm]**

At song time `t`, a layer with an intensity curve has `a(t)` in 0..1. Without a curve, `a ≡ 1`, and today's exact code
path runs. It does four things:

1. **It decides which attacks the layer hears.**
   - A chord at time `tc` reaches the layer when `passes(tc, a(tc), salt)`.
   - `passes` is true at `a ≥ 1` and false at `a ≤ 0`. In between it is true when `fnv32(salt, round(tc·1000)) / 2³² < a`.
   - `salt = fnv32(instance key)`.
   - So at 0.5, a fixed half of the attacks get through, the same ones every time. The widget is intermittently active,
     as the user put it, instead of dimmed.
   - It is deterministic: never `Math.random`. Seeking, a paused preview, live play and a render all agree.
2. **It decides how the layer feels the music.** A layer with a curve, or one that listens to a part, keeps its own
   pulse.
   - Its `level` and `rate` follow only the attacks that passed.
   - Its `pitch`, `bass` and `density` follow the notes it listens to.
   - So its driven knobs calm down as the curve falls.
   - The arithmetic is the lab's `advanceFeatures`, bit for bit.
3. **It sets how visible the layer is.** The paste weight is `slotWeight × vis(a)`.
   - `vis` maps "visible fraction" to paste weight, using the measured table above. The `redraw` class (the default)
     uses `[[0,0],[0.1,0.044],[0.25,0.069],[0.5,0.15],[0.75,0.31],[0.9,0.561],[1,1]]`, piecewise linear: the mean of
     the two measured ground rows. The `strokes` class uses `vis(a) = a`.
   - A probe classifies each widget into `redraw` or `strokes` (T12).
   - A weight of 1 or more takes today's exact path, with no snapshot. Below 1 it takes today's snapshot-and-paste-back
     path at that weight.
   - The section cross-fade `(1 − u)²` is left as it is.
4. **It never stops the widget's clock.** `frame()` runs at `a = 0` too, so the widget's state is right when it comes
   back. At weight 0 the paste-back hides it completely.

Two more rules:
- A layer leaving at a boundary keeps the value its curve had at the boundary, times `(1 − u)²`.
- A continuing instance switches to the next section's curve.

**Not chosen:**
- Scaling velocities or drive depths by `a`. It is weaker on widgets that ignore velocity, and opacity plus thinning is
  what reads as "less of it".
- A per-layer choice of which of these effects apply. That is later, if the user asks.

### 5. The intensity curve **[user: pivots, DJ style; builder: the maths]**

- **The data.** `intensity: Pivot[]` on a layer, with `Pivot = { t, v, shape?, bend? }`.
  - `t` is in song seconds, inside the section.
  - `shape` and `bend` describe the segment to the next pivot.
- **Evaluating it.**
  - Before the first pivot the curve holds the first pivot's value, and after the last it holds the last one's.
  - Within a segment, with `u` in 0..1:
    - `linear`: `u' = u ** 2 ** (−3·bend)`, where `bend` is in −1..1 and 0 is straight. A positive bend reaches the next
      value early.
    - `ease`: `u' = u²(3 − 2u)`.
    - `hold`: the value stays until the next pivot.
  - `v = v₀ + (v₁ − v₀)·u'`, clamped to 0..1.
- **Times are absolute.** Pivots sit at musical moments, so they never stretch.
  - Moving a boundary or splitting a section removes the pivots that fall outside, and adds an edge pivot carrying the
    curve's value there. The visible curve is unchanged.
  - Merging keeps the pivots of the same instance on both sides.
- **"The whole show" view** draws one instance's curves across the consecutive sections it plays in. A pivot added at
  `t` goes to the section containing `t`.
- **Presets are generators.** They write ordinary pivots into the section, then the user edits them.
  - **Fade in / fade out** over N seconds or beats.
  - **Swell:** floor, then 1 at a chosen point, then floor, with ease segments.
  - **Pulse every N beats / bars:**
    - At each pulse: 1, decaying linearly to the floor over half a period, then held.
    - "Bars" are 4-beat bars: the pack has no downbeats, and the UI says so.
    - The pulse uses `pack.beats` where they cover at least 70 % of the section. Otherwise it uses the song's median
      beat period from the section start. With no beats at all, it pulses every N × 0.5 s.
  - **Gate on loudness:**
    - The gate is open where `pack.loudness ≥` a threshold. It closes below the threshold minus 0.05.
    - It opens 0.15 s early.
    - Runs shorter than 0.25 s are ignored, and gaps shorter than 0.5 s are bridged.
    - Ramps take 0.1 s.
  - **While its instrument plays:** open where the listened part has sounding notes. Gaps under 1 s are bridged, ramps
    take 0.2 s, and below the gate it falls to the floor.
- **Limits.** At most 256 pivots per layer per section: more gives a warning, and the presets merge further to stay
  under.

### 6. Regions **[user: shapes and handles; builder: the modes]**

The shared code follows `design.md` (§2):

- **Coordinates.** Centre and size are fractions of the canvas, so they mean the same at any scale.
- **Spot.** Snapshot the canvas, let the widget draw, then paste the snapshot back through a `destination-out` mask at
  the layer's weight.
- **Window.**
  - Each window instance has its own canvas, the size of the main one, with the same fade and burn.
  - It is scaled into the region (fit), masked with `destination-in`, and stamped with `globalAlpha` = weight (blend
    over or lighten).
  - Readers in a window read only their own canvas, and the panel says so.
- **Masks.**
  - They are built with canvas operations only, once per region change.
  - The spot feather's profile goes through `vis`, so a soft edge looks soft on opaque widgets too.
- **Across sections.** A region glides across a boundary over the section's fade, with smoothstep on x, y, w, h, rot
  and feather. A change of mode is a cut.
- **Not offered:** clipping the shared context, and the screen or lighter blends. Both are rejected by the measurements
  (design.md §2).

### 7. Instances

- **The key.** A layer's instance key is `widget` when it listens to all notes, and `widget@listen` otherwise.
  - Old shows keep their keys.
  - The same widget may play twice in a section on different parts.
  - The rule becomes "an instance plays once per section".
- **Instantiating.** A routed instance is evaluated with its own environment:
  `new Function('TOOLS','ICON','CHORDS','window', src)`, with a `window` proxy whose `NOTES` is the part's notes, and
  `CHORDS` the part's chords.
  - So the fourteen `window.NOTES` readers, and score's `CHORDS`, see the part.
  - Load-time statistics are computed per part.
- **Unrouted instances** keep today's three-argument call.

### 8. Show v2

- **Fields.** Layers gain optional `listen`, `region` and `intensity`.
- **Versions.**
  - `canonicalShow` writes `version: 2` only when some layer uses one of them. Otherwise it writes `version: 1`, so
    every committed show stays byte-identical until the user uses a new field.
  - `validateShow` accepts 1 and 2. A studio from before this change refuses a v2 file loudly. It never drops the
    fields silently.

### 9. The HD master **[user: the approach; builder: the mechanics]**

- **The canvas at scale S.** `WidgetRuntime` gets `scale: 1 | 2 | 3`.
  - At S = 1 nothing changes: `ctx.g` is the real context, and `npm run fidelity` must be pixel-identical.
  - At S > 1 the canvas is S·1280 × S·720, and `ctx.W` and `ctx.H` stay 1280 and 720.
- **The context proxy.** `ctx.g` becomes a thin proxy of the real context, used only when S > 1 (`hdContext`). It:
  - composes `setTransform`, `resetTransform` and `getTransform` with `scale(S)`, which fixes the identity-transform
    callers;
  - scales `shadowBlur` and `shadowOffsetX` / `shadowOffsetY` by S, and the px lengths in `filter`, on set (reading
    them back divides);
  - throws, naming the widget, on `getImageData` or `putImageData` of the shared canvas, so a reader that was missed
    fails loudly.

  The harness's fade and burn run at the real size.
- **Widget edits.** The readers of the shared canvas (blocks, casket, fold, pixelsort, timeslice, tunnel, plus whatever
  the re-grep finds) are edited:
  - their scratches are sized `x.canvas.width × x.canvas.height`;
  - their source rectangles are scaled by `S = x.canvas.width / x.W`;
  - they draw back with an explicit size in 1280×720 user units.

  At S = 1 the pixels are unchanged. Golden hashes are recorded before the edit and compared after.
- **Optional upgrades.** A widget whose full-frame offscreen buffer comes out visibly soft at 2× may size that buffer by
  S. This applies only to loved or kept widgets, only where a 2× crop shows the softness, and keeps the 1× pixels.
  **[builder]**
- **These edits wait for the lab round now in progress to land. [confirm]**
- **Frames to x264 losslessly.** Raw RGBA from the page goes to a loopback endpoint of the renderer's own server, then
  `-f rawvideo` into ffmpeg. The transport is measured first against PNG `toBlob` and base64.
- **Master encode.**
  - `libx264 -preset slow -crf 13 -pix_fmt yuv420p -profile:v high`, at level 5.1 (2×) or 5.2 (3×).
  - `scale=out_color_matrix=bt709:out_range=tv` and the BT.709 colour tags.
  - 60 fps, with the simulation at 60 Hz: one step per frame.
  - AAC 320k, the recording cut sample-exactly as today; `+faststart`.
  - `--master x264-444|prores` for archive masters.
- **Share copy.**
  - Made from the master: lanczos to 1920×1080, 30 fps, two-pass x264, high profile, level 4.1, BT.709 tags, AAC 128k,
    `+faststart`.
  - Its video bitrate is `budget·8/60 − 128k`, with a budget of 15 MB a minute (`--share-mb-per-min`). That comes to
    about 1.87 Mbit/s.
  - The docs advise sending it as a *document* in WhatsApp, so it is not compressed again.
- **In-app recorder presets.**
  - Share: 1.9 Mbit/s video + 128k audio, about 15 MB a minute.
  - High: 8 Mbit/s + 192k, about 61 MB a minute.
  - Both 30 fps, 720p. Measured: Chrome doubles the bitrate at 60 fps.
- **The studio's Export menu.**
  - "Render HD master (on this computer)" (dev only) runs `render-show` as a job, shows its progress, and names the
    files.
  - The live canvas stays 1280×720.

## Non-goals (for now)

- **Separation and tagging from the dropped draft.** Demucs stems, the AST instrument tagger, and the draft's tracks
  that are only curves, with notes made up from them. YourMT3+ replaces all three. **[confirm]**
- **Other transcribers.** MuScriptor, YourMT3 in the browser, and basic-pitch through onnxruntime-node.
- **Region keyframes inside a section.** The glide between sections covers it for now.
- **Instances.** Two instances of the same widget on the same part, such as two kandinsky windows.
- **Picture quality during live playback.** Supersampling the live studio canvas. In-app recording above 720p.
- **New drives.** No `±inst` drive is added. A routed layer's own `level`, `rate`, `pitch`, `bass` and `density` already
  follow its part.
- **Musical structure.** Downbeat detection ("bars" are 4 beats). Reading times out of the user's description.
- Live microphone or MIDI, WebGL, and rewriting widgets in TypeScript (as before).

## Anti-goals

- **Anything that makes the lab and the studio draw differently** for the same widget, knobs, listen, region and
  intensity.
  - All new compositing, curve and line maths lives once, in `lab/layers/*.js`, and both pages evaluate it.
  - At scale 1 the studio draws today's pixels.
- **Physical imagery.** No pictures of violins or bows, and no instrument icons on the canvas. Instruments appear in
  words, in the UI only.
- **Labels that claim more than was heard.** A track exists only where YourMT3 heard it, at a minimum note count.
- **Handles or lanes drawn into the canvas.** Readers would cut them, and hashes would move.
- **Randomness at run time in the harness.** Thinning is an FNV hash.
- **"Quality" judged by file size.** Every export setting is judged by looking at crops: dark gradients, fine lines,
  and particles.
- **An HD master whose composition differs from the 720p picture.** It must be the same picture, only sharper.

## Constraints

- **Python.**
  - The piano transcriber's venv `wa` and the venvs `wa-mt` and `wa-bp` are never re-pinned.
  - YourMT3 runs in `wa-mt`, found through `ymt3.json`, written by `npm run setup-ymt3` (the env var `WINKELAMP_YMT3`
    overrides the location).
  - The scratch copy of the Space and its checkpoint are temporary, so the setup runs first in the build.
- **npm.** No new npm dependency.
- **Code.** Strict TypeScript, and tests for every pure piece: curves, presets, lines, thinning, pack v2, velocities,
  show v2, edits, schedule, encode arguments, tags.
- **Git.**
  - Audio, packs, the caches beside packs, renders, `lab/notes*.js` and `lab/tracks*.js` stay out of git.
  - Never merge into the main branch without the user's explicit yes.
- **The lab.** `lab/index.html`, `lab/tools/*.js` and `lab/combos.js` are edited only after the lab round now in
  progress has landed, and then one task at a time.
- **Ports.** 5173, 5174 and 5180 belong to the user's pages. Never bind or post to them.
- **The machine.** Windows, system Chrome, the RTX 4080 SUPER.

## Open for the user (the [confirm] calls)

1. **Intensity's meaning:** fewer attacks heard, plus corrected opacity, plus a calmer pulse (Decisions 4). The
   alternative is softer attacks instead of fewer.
2. **The default region mode:** answered by the user (0a66d5c): a window (Small copy) for every widget, the readers
   included; the spot is the Mask.
3. **Dropping demucs and the AST tagger** now that YourMT3+ gives real instrument notes. Basic-pitch stays only as the
   fallback.
4. **Ensemble songs' all-notes become a hybrid** of the piano model and YourMT3's gap-fill. Re-ingesting Beethoven
   changes how its existing show looks in the gaps, the first theme above all. The show is checked by eye after.
5. **The piano-or-ensemble rule** is YourMT3's own piano share, falling back to the piano model's coverage if the
   measurement fails.
6. **The HD master needs small edits to about six widget files.** They come after the lab round lands, and keep the 1×
   pixels identical.
7. **The lab gets intensity presets only.** The lane is studio-only.
8. **The share copy:** 1080p at 30 fps and about 15 MB a minute. Blocking on busy widgets may push this budget up after
   looking.
