# How the music's energy gets lost on the way to the picture

## 1. The short answer

Our widgets only ever see transcribed notes: chords, the notes that are sounding, and six features computed from attacks. They never see the sound itself. Two things follow from that, and the demo (section 8) measured both on five pieces.

**1. Our one loudness signal runs about 1.7 s late.** `pack.loudness` is smoothed twice, looking only backwards. It runs 1.6 to 1.8 s behind the sound on every piece measured, with a match of r ≥ 0.94. The "Loud parts" gate preset reads it and corrects only 0.15 s ([automation.js](lab/layers/automation.js:209)), so a gated layer opens and closes about 1.5 s after the music does. The faint loudness picture behind the intensity lane is just as late.

**2. In sustained music, energy without attacks never reaches a widget.** The signal called `level` is not loudness. It jumps when a note starts and halves every 0.8 s, so a held swell or a long chord reads as energy draining away. This matters on strings and slow chorales. In Barber's Adagio and the Firebird, `level` is near zero 15 % and 21 % of the time the music is louder than its median. In busy pieces it hardly matters, because the attacks already carry the energy: Mars 2 %, Danse macabre and the Nocturne 0 %.

The longest memory any widget has is about 1.4 s. Phrase energy and section energy reach the screen only when someone draws them by hand.

Our analysis already measures the things that would help. It computes onsets with their strength, a melody, and about 22 descriptors. It then throws everything away except loudness, sections, beats and harmony. So composers measure the audio again with librosa and paste the numbers into scripts.

TouchDesigner and similar tools are built differently. They take the energy from the sound and pass it through followers that climb fast and fall slowly. They judge loudness against what came just before, and they use several timescales at once.

You already said the music alone does not have to drive the picture ([ratings.md](lab/ratings.md:56)). So the gap is not that we should become audio-reactive like TouchDesigner. The gap is that the authored layers (picks, intensity curves, knob drives) have no real energy signals to work with. The fixes below add those signals as presets and drives that sit on top of picks, which you called the core.

## 2. How the pros do it

### TouchDesigner, step by step

TouchDesigner (TD) builds a chain of small "CHOP" operators. Each one does one job, and you can inspect and re-wire any of them.

1. **Play the file on one shared clock.** The [Audio File In CHOP](https://docs.derivative.ca/Audio_File_In_CHOP) can be locked to the timeline. The song position is then the timeline position, so scrubbing stays in sync, and every analysed or keyframed channel shares that clock.
2. **Split the sound into bands.** Either an FFT ([Audio Spectrum CHOP](https://docs.derivative.ca/Audio_Spectrum_CHOP), default 8192 samples, with an optional log-frequency axis and treble boost), or parallel low, mid and high filters ([Audio Filter CHOP](https://docs.derivative.ca/Audio_Filter_CHOP)). The ready-made [audioAnalysis](https://docs.derivative.ca/Palette:audioAnalysis) component outputs Low, Mid and High, kick, snare, rhythm and spectral centroid (brightness).
3. **Turn each band into one level per frame.** This uses RMS, a kind of average loudness ([Analyze CHOP](https://docs.derivative.ca/Analyze_CHOP)), or a sliding-window peak ([Envelope CHOP](https://docs.derivative.ca/Envelope_CHOP)).
4. **Normalise.** Dividing by a wide-window envelope gives a level of about 1. Alternatively, an automatic gain control ([Audio Dynamics CHOP](https://docs.derivative.ca/Audio_Dynamics_CHOP)) keeps quiet passages moving and stops loud ones from hitting the ceiling.
5. **Smooth with different speeds up and down.** The [Lag CHOP](https://docs.derivative.ca/Lag_CHOP) has one value for how fast the level climbs (attack) and another for how fast it falls (release). Practitioners use a fast climb and a slow fall: the picture lands on the hit and then rings out instead of flickering.
6. **Turn levels into events.** The [Trigger CHOP](https://docs.derivative.ca/Trigger_CHOP) fires a designed envelope when a level crosses a threshold. It has separate on and off thresholds and a minimum gap, so one hit cannot fire twice. The [Count CHOP](https://docs.derivative.ca/Count_CHOP) steps through N states on each hit, for example a palette, a camera or a shape.
7. **Turn energy into speed.** The [Speed CHOP](https://docs.derivative.ca/Speed_CHOP) adds up a level over time into a phase. Loud passages make the world flow faster, and it never steps backwards.
8. **Map and export.** The [Math CHOP](https://docs.derivative.ca/Math_CHOP) rescales the value (for example 0–1 to 0–180°), with a floor so something stays alive in silence and a ceiling that leaves headroom.
9. **Render with memory.** A [Feedback TOP](https://docs.derivative.ca/Feedback_TOP) loop gives trails, and the decay is often driven by the audio.

For prerecorded work, TD artists move the analysis offline:
- [Demucs](https://github.com/adefossez/demucs) stems, so drums, bass and vocals each drive their own layer;
- librosa or [EssentiaTD](https://darienbrito.github.io/EssentiaTD) batch analysis;
- [Beat This!](https://arxiv.org/html/2407.21658v1) for beats and downbeats;
- the [Animation COMP](https://docs.derivative.ca/Animation_COMP) for hand-drawn keyframes.

The [Beat CHOP](https://docs.derivative.ca/Beat_CHOP) is only a clock: it does not listen to the audio.

### The others

- **Live tools** (Synesthesia, MilkDrop/projectM, Resolume, VDMX, Hydra) compute a few named bands from an FFT every frame. Each band goes through a fast-up, slow-down follower. projectM rises with rate 0.2 and falls with rate 0.5 ([Loudness.cpp](https://raw.githubusercontent.com/projectM-visualizer/projectm/master/src/libprojectM/Audio/Loudness.cpp)).
- **MilkDrop** shows each band twice: raw (`bass`) and damped (`bass_att`). Both are divided by a running average of about 4 s, so 1.0 means normal for this song right now, below about 0.7 is quiet and above about 1.3 is loud ([preset guide](https://www.geisswerks.com/milkdrop/milkdrop_preset_authoring.html)).
- **Synesthesia** offers signals on three timescales ([uniforms](https://app.synesthesia.live/docs/ssf/audio_uniforms.html)):
  - hits (`syn_Hits`);
  - levels (`syn_Level`);
  - slow accumulators (`syn_Intensity`, `syn_Presence`).

  It also has clocks that run faster when a band is loud (`syn_BassTime`), beat oscillators (`syn_BPMSin`), and a tempo confidence that lets motion fall back to free-running in rubato.
- **Offline tools** bake the analysis into curves that are read by playback time:
  - Notch stores a `.fft` file beside the audio ([Notch](https://manual.notch.one/2026.1/en/docs/learning/working-with-audio/));
  - Unreal has non-real-time analysers;
  - Blender has Bake Sound to F-Curves;
  - Cavalry normalises over the whole track.

  Because they know the future, they can be frame-exact, normalise against the real minimum and maximum, and start a ramp before a climax.
- **Note-driven tools** are the closest to us. The Music Animation Machine and [MidiAnimationTrack](https://github.com/keijiro/MidiAnimationTrack) give each note its own envelope, lit while it sounds.

### What music research adds

- **Loudness should be measured on standard windows.** [EBU R128](https://tech.ebu.ch/docs/tech/tech3341.pdf) uses 0.4 s (momentary) and 3 s (short-term). Loudness is the strongest single driver of arousal (Schubert 2004) and of tension.
- **[Farbood 2012](https://bpb-us-e1.wpmucdn.com/wp.nyu.edu/dist/f/11865/files/2020/08/Farbood_2012_Musical_Tension.pdf) models tension as trends over about 3 s.** The weights are loudness 3, melody pitch 3, tempo 2, onset rate 2, harmony 1, bass 1 and inner voices 1. A continuing trend counts five times as much.
- **Normalise relative to nearby music, with a centred window.** This is what [dynaudnorm](https://ffmpeg.org/ffmpeg-filters.html) does (about ±7.75 s). A fixed dB scale leaves pp passages dead and saturates every tutti. Blend the local and whole-piece values about 50/50 so the true climax still wins.
- **Crossmodal mappings ([Spence 2011](https://www.psy.ox.ac.uk/publications/115721/modal)):**
  - louder goes with bigger and brighter;
  - higher pitch goes with higher, smaller and brighter.

  Build-ups and releases are not mirror images: a release reads as descending and settling (Eitan & Granot 2006).
- **Classical music breaks pop assumptions.** There is no steady drum, rubato defeats beat trackers, Demucs files the whole orchestra under "other", and soft string or horn entries have no clear onset.

**The shared principles:**
- Use a fast climb and a slow fall.
- Use several timescales at once: the hit, the beat, the phrase and the section.
- Judge loudness relative to its context.
- Let energy drive speed rather than position.
- Change state on accents rather than flickering continuously.
- When working offline, look ahead.
- Keep authored structure on top of the analysed detail. Tschepe warns that naive reactivity produces "mechanically flickering content".

## 3. How we do it

1. **Ingest.** The audio is decoded to 44.1 kHz mono. The transcribers run, then `analyzeSong`, and the result is written to `songs/<id>/pack.json` ([ingest.ts](scripts/ingest.ts:279), [server.ts](scripts/ears/server.ts:2)). Without the ears server, the browser runs the same analysis and builds approximate notes ([fallback.ts](src/studio/ingest/fallback.ts:1)).
2. **Transcription.** The piano model gives real velocities from 0 to 127 ([transcribe.py](scripts/ears/transcribe.py:125)). YourMT3+ gives instrument rows that all have velocity 100. Those velocities are then estimated from the onset RMS, by rank ([tracks.ts](src/studio/pack/tracks.ts:80), [tracks.ts](src/studio/pack/tracks.ts:145)).
3. **Offline analysis.** One chain runs at 60 Hz hops: FFT, then band energies, flux onsets, chroma and centroid, then about 22 descriptors ([features.ts](src/audio/features.ts:177), [descriptors.ts](src/audio/descriptors.ts:290)). From these, `analyzeSong` builds:
   - sections (Foote novelty);
   - beats, kept only where pulse clarity is at least 0.3;
   - a 0.1 s loudness lane;
   - triad harmony;
   - onsets and a melody ([song-analysis.ts](src/audio/song-analysis.ts:488)).
4. **The pack.** It stores notes, tracks, sections, beats, loudness and harmony ([build.ts](src/studio/pack/build.ts:151)). The onsets, the melody and every descriptor except loudness are dropped.
5. **Authoring.** A show is a set of clips. Each clip has a widget, listen, knobs (base, drive, depth), a region and intensity pivots ([show.ts](src/studio/show/show.ts:27)).
   - Intensity presets write pivots ([lanes.ts](src/studio/ui/lanes.ts:298), [automation.js](lab/layers/automation.js:136)).
   - Pick sets hold hand-picked notes with their own per-note values ([note-values.ts](src/studio/show/note-values.ts:1)).
   - The auto-composer and Claude write `shows/<id>.json`. Claude uses librosa measurements pasted in by hand.
6. **Scheduling.** `scheduleAt` lists the clips playing, with their fade weights and knob values ([schedule.ts](src/studio/show/schedule.ts:25)). The Conductor sets `ctx.moment` from the section boundaries ([conductor.ts](src/studio/show/conductor.ts:67)).
7. **The runtime step.** Each step:
   - fires the chords whose time has come;
   - updates six features ([features.ts](src/widgets/features.ts:35));
   - fades the canvas by a fixed `rgba(0,0,0,0.12)` ([runtime.ts](src/widgets/runtime.ts:241));
   - calls `onChord` and `frame` for each slot.

   Layers below intensity 1 drop attacks chosen by a hash ([slot.js](lab/layers/slot.js:42)). Knobs move by depth × range × feature ([features.ts](src/widgets/features.ts:9)).
8. **The widgets draw.** Most of the picture comes from `onChord`, which reads `ch.vel`, the chord size and its lowest and highest notes. 72 widget files define `onChord`, and 49 of them read `ch.vel`. No widget reads pack loudness, beats or harmony, or any audio feature.

What a widget can feel, per frame:

| Signal | Built from | Time scale |
|---|---|---|
| `level` | peak of attack velocity/115 | halves every 0.8 s |
| `rate` | attacks per second, capped at 8/s | about 1.4 s window |
| `hit` | attack velocity | 0.08 s |
| `pitch`, `bass`, `density` | sounding notes | 0.25 s |
| `moment` | section index (only lewitt reads it) | tens of seconds |

## 4. The differences

| Aspect | Them | Us | What it does to energy |
|---|---|---|---|
| What drives each frame | The sound itself: band RMS, flux, centroid. Only MIDI tools use notes. | Notes only ([features.ts](src/widgets/features.ts:35)). Audio features are computed but never reach a widget. | Anything the transcriber misses or flattens is invisible, and those passages go dark ([COMPOSING-SHOWS.md](docs/COMPOSING-SHOWS.md:379)). |
| What "level" means | Loudness: it stays high through a held chord and rises in a crescendo. | A peak of attack velocity that halves every 0.8 s. 35 knobs default to `+level`. | Swells and held fff read as energy draining away, for example Barber −25 → −13.6 dB, "loud and untranscribed". |
| How fast signals climb and fall | Each mapping has its own fast-up, slow-down follower. | One global set of time constants, symmetric for pitch, bass and density. | A slow chorale keeps level near 0 between chords, and a fast agitato pins rate at its cap. |
| Normalisation | Relative to the last few seconds (MilkDrop 1.0 = normal), plus whole-track. | Absolute velocity thresholds (`vel >= 92`) or song-wide percentiles. Loudness is a fixed −50..−12 dB map. | pp pieces never fire the big gestures. Fireworks fire on routine chords instead of on the real ff blows. |
| Timescales | Hit, level, phrase and section, side by side. | Nothing longer than about 1.4 s. Builds exist only when drawn by hand. | No arc. A loud moment in a quiet section looks the same as a quiet moment in the climax. |
| Energy as speed | Loudness-paced clocks (Speed CHOP, `syn_BassTime`). | A few widgets pace themselves with `+rate` drives (attacks only). | Motion widgets move at the same pace through calm and storm. |
| Look-ahead | Offline tools use centred windows and start ramps early. | The analysis only looks backwards. `pack.loudness` lags by about 1.5–2 s ([descriptors.ts](src/audio/descriptors.ts:309)). | Curves arrive late, and the climax gets no more visual budget than the bars before it. |
| What is kept | A full sidecar of analysis, readable by time. | Onsets, melody and descriptors are dropped ([build.ts](src/studio/pack/build.ts:151)). | Composers re-run librosa for every piece ([gen-picks.mjs](docs/compositions/classical/bald-mountain/gen-picks.mjs:15)). |
| Events | Thresholds that let only real accents fire, and onsets with a strength. | Every chord is an event, and thinning below intensity 1 is by hash ([automation.js](lab/layers/automation.js:49)). | A build at 0.3 drops ff accents as readily as filler, so it reads as flicker. |
| Beat and tempo | Beat phase, bar ramps and confidence, plus rubato-tolerant tempo curves. | Beats only where pulse clarity ≥ 0.3 (Liebesleid has 24), used only by presets. | Nothing breathes with the bar or follows an accelerando. |
| Tension and harmony | Farbood's trend model and spiral-array strain (research). | Harmony is stored but only `approximateNotes` reads it. The arousal axis is never used. | A dominant pedal or a climbing crescendo looks like a static passage. |
| Per-part energy | Demucs stems (weak on classical). | Ahead of them in routing, but ensemble velocities are about 90% flat within a passage. | Ensemble pp and ff look alike. |
| Authoring | base + intensity × signal, with the intensity exposed in the UI. | Same formula, but there is no depth control and only attack-based drives. | Composers cannot set how strongly a knob follows the music. |
| Persistence and sync | Feedback decay is a time parameter, on one clock. | The fade is fixed per step, not per second, and there is no latency offset. | Trails are half as long on 120/144 Hz screens. |

## 5. Easy improvements, ranked by impact on energy matching divided by effort

| # | Improvement | Effort | Already partly exists? | Needs |
|---|---|---|---|---|
| 0 | **Built 2026-11-08.** Open the "Loud parts" gate on time (it now opens 1.1 s and closes 2.4 s earlier, measured) | hours | yes, as a 0.15 s lead | nothing |
| 1 | **Built 2026-11-08.** "Follows the sound" intensity preset | hours | partly | nothing (works on pack.loudness today) |
| 2 | **Built 2026-11-08.** Depth control on each knob | hours | partly (data side done) | nothing |
| 3 | `+loud` and `+pace` knob drives | a day | no | better with #4 |
| 4 | Zero-lag energy lanes (step A) | a day | partly | the augment-pack script, shared with #5 |
| 5 | Onsets and melody in the pack, plus a 4 s describe-song table | a day | partly | the augment-pack script |
| 6 | "Keep the strongest" thinning | a day | partly | nothing |
| 7 | "Build to the climax" preset | a day | no | nothing (better with #4) |
| 8 | Pace warning in check-show | hours | partly | nothing |
| 9 | Fade independent of frame rate, plus picture delay | hours | no | nothing |

Items 4 and 5 share one script, `scripts/augment-pack.ts`. It decodes `songs/<id>/audio.*`, runs `analyzeSong`, and patches only the new keys into the existing pack.json. **Never use `ingest --force` for this.**
- `songs/` is git-ignored, so a regression would leave no diff.
- prelude and rach-prelude-recording were built with `--piano-notes`, which a plain `--force` would not repeat.
- Older packs predate later pack-code changes. A rebuild could change notes or tracks, and picks would then fall off the roll.

### 0. Open the "Loud parts" gate on time (found by the demo; built 2026-11-08)

- **Measured before building.** One shift was not enough: the lane rises faster than it falls. Against the sound's own centred 0.4 s energy on six pieces, the lane crosses upward about 1.1 s late (median of 34 crossings) and downward about 2.4 s late (median of 33). So the gate opens 1.1 s and closes 2.4 s earlier (`WA.LOUDNESS_LAG` in [automation.js](lab/layers/automation.js)). A run still open at the song's end keeps its end.

- **What.** `WA.presets.gate` ([automation.js](lab/layers/automation.js:209)) opens 0.15 s before the lane crosses its threshold. The lane itself runs about 1.7 s late. Read the lane about 1.7 s ahead, as a named constant shared with the faint loudness picture in [lanes.ts](src/studio/ui/lanes.ts:411). Item 4 later makes the lead 0.
- **Why.** Today every gated layer swells in and dies away about 1.5 s after the music does.
- **Effort.** Hours, plus a test in `tests/layers-presets.test.ts`.
- **Risk.** None for existing shows. A preset writes pivots only when clicked, and saved pivots do not change.

### 1. "Follows the sound" preset (partly exists)

- **What.** A new `WA.presets.follow(span, curve, {floor, lead})` in [automation.js](lab/layers/automation.js:131):
  1. It samples the loudness curve inside the span, with a lead of about 1.7 s (measured) on `pack.loudness` to undo its lag (0 once the energy lanes exist).
  2. It climbs fast and falls slowly (for example 0.2 s up, 1.5 s down).
  3. It normalises to the span's 5th–95th percentile and maps the result to floor..1.
  4. It simplifies to fewer than `MAX_PIVOTS` linear pivots.

  It is offered as a chip next to "Loud parts" in [lanes.ts](src/studio/ui/lanes.ts:300).
- **Why.** Today "Loud parts" (gate) is either on or off, and builds exist only when drawn. This lets a thread thicken and brighten with the real dynamic arc in one click, including swells that have no new attacks.
- **Borrowed from.** Deforum/Parseq amplitude-to-keyframes, Blender Bake Sound, and the Lag CHOP's fast climb and slow fall.
- **What exists.** The loudness is already drawn faintly behind the lane ([lanes.ts](src/studio/ui/lanes.ts:411)), and a Douglas-Peucker simplifier exists for freehand strokes ([lanes.ts](src/studio/ui/lanes.ts:101)).
- **Effort.** Hours.
- **Files.**
  - `lab/layers/automation.js`
  - `src/studio/ui/lanes.ts`
  - optionally `lab/layer-ui.js`
  - `docs/COMPOSING-SHOWS.md`
  - a unit test
- **Risk.** None for existing shows: a preset writes pivots only when clicked.
- **Points to watch.**
  - Intensity below 1 also drops attacks ([slot.js](lab/layers/slot.js:53)). The default floor should therefore be at least 0.35, or quiet passages empty out, against your "keep the screen full" direction.
  - Widgets already follow velocity, so on top of that this squares the dynamics. That is fine as an option, but it should not be the default.
- **Small fix while there.** The gate threshold differs between the studio and the lab. The studio uses the span median ([lanes.ts](src/studio/ui/lanes.ts:316)). The lab uses the 60th percentile ([layer-ui.js](lab/layer-ui.js:77)), as the doc says. Align one with the other.

### 2. Depth control on each knob (partly exists: data side done)

- **What.** A small 0..1 slider beside the drive menu in `knobRow` ([knobs.ts](src/studio/ui/knobs.ts:54)). `KnobState.depth`, `knobValue`, validation and storage already handle depth.
- **Why.** Composers cannot say how strongly a knob follows the music, so drives stay hard to use. It is also the prerequisite for #3 being useful.
- **Borrowed from.** The intensity and blend controls on each modulation in Resolume, banger.show and Magic Music Visuals.
- **Effort.** Hours.
- **Files.**
  - `src/studio/ui/knobs.ts`
  - `src/studio/ui/style.css`
  - optionally `lab/index.html`
  - a unit test
- **Risk.** None; the runtime path does not change.
- **Points to watch.**
  - Round the value to the slider step, or a value like 0.5000001 gets written and every touched knob becomes an object.
  - Disable the slider while the drive is empty. 42 stored knobs have drive `""` and depth 0, and must stay untouched until edited.
  - Knobs with leads (how present) need no depth control.

### 3. `+loud` and `+pace` knob drives (new)

- **What.** Two new features.
  - `loud` is looked up in the loudness lane at `ctx.t`, so seeking and playing agree.
  - `pace` is the onset rate in a centred 6 s window, normalised by a per-piece percentile.

  Both are added to the `Drive` type, to `DRIVES` in [show.ts](src/studio/show/show.ts:49) and in [lab/index.html](lab/index.html:565), and to the drive menus. `advanceFeatures` stays untouched.
- **Why.** Knob modulation follows how often notes start, not how loud the music is. With this, "louder → more" really means louder, through sustained ff and untranscribed passages too.
- **Borrowed from.** Synesthesia `syn_Level`, MilkDrop `bass_att`, and TD's CHOP Export of a smoothed level.
- **Effort.** A day.
- **Files.**
  - `src/widgets/types.ts`
  - `src/widgets/features.ts` (a new `sampleCurves`)
  - `src/widgets/runtime.ts` (shared and per-instance feats)
  - the four `WidgetRuntime` construction sites (`render-page.ts:80,100`, `main.ts:260`, `picker-popup.ts:340`)
  - `lab/layers/slot.js:26`
  - `lab/index.html`
  - `show.ts`
  - feature-shape tests
- **Risk.** Existing features stay bit-identical. Change `show.ts` `DRIVES` and its repair code (:522) in the same commit, or repair strips saved knobs that use the new drives. An older studio will strip them too.
- **Points to watch.**
  - A routed instance listening to one track still hears the whole mix's loudness.
  - The panel's live knob icons need the new features too.
  - With `pack.loudness` the drive lags by about 1.5 s. It is on time once #4 exists.
  - `+swell` and `+tension` are dropped. They need data the pack does not have.

### 4. Zero-lag energy lanes, step A (partly exists)

- **What.** [descriptors.ts](src/audio/descriptors.ts:306) already computes the per-hop K-weighted power (loudness weighted the way the ear hears it).
  1. Expose it as a debug value. The outputs do not change.
  2. Collect it in `analyzeSong`'s `onHop` ([song-analysis.ts](src/audio/song-analysis.ts:163)).
  3. After the pass, take centred moving means over 0.4 s (momentary) and 3 s (short-term).
  4. Sample them every 0.1 s in dB, rounded to 0.1 dB.

  Store the result as an optional `pack.energy = {hop, momentary, shortTerm}`, back-filled by the augment-pack script.
- **Why.** `pack.loudness` looks only backwards and lags by about 1.5–2 s. That makes curves and drives late. A centred window has no lag.
- **Borrowed from.** EBU R128 momentary and short-term windows, and offline baking (Notch, Unreal).
- **Effort.** A day.
- **Files.**
  - `src/audio/descriptors.ts`
  - `src/audio/song-analysis.ts`
  - `src/studio/pack/pack.ts` (the validation check: length equal to the loudness lane's)
  - `src/studio/pack/build.ts`
  - the augment-pack script
  - a crescendo unit test (the peak lands within 0.1 s)
- **Risk.** None if `pack.loudness` stays byte-identical, because the gate preset, the lane picture and describe-song read it.
- **Deferred to step B.** The section-relative value (`rel`). It needs a percentile window, a 50/50 blend and a gain cap that can only be tuned by eye on Barber, Firebird and Mars. Near-silence would otherwise swing from 0 to 1.

### 5. Onsets and melody in the pack, plus describe-song (partly exists)

- **What.**
  1. Add optional `pack.onsets [{t, s}]` and `pack.melody`, with validation.
  2. Copy them in build.ts, and back-fill them with the augment-pack script.
  3. Give describe-song a 4 s table with:
     - audio onsets per second;
     - mean onset strength;
     - the strong onsets (s ≥ 0.3) that have no note start within ±60 ms. These are the same thresholds as `onsetCoverage` ([notes.ts](src/studio/pack/notes.ts:110)).
  4. Point [COMPOSING-SHOWS.md](docs/COMPOSING-SHOWS.md:310) at `pack.onsets` instead of librosa.
- **Why.** Composers bypass the pack to find untranscribed attacks and quiet holes. This puts those facts in the table Claude reads first.
- **Borrowed from.** The Notch `.fft` sidecar, Unreal OnsetNRT, and Spotify's segment schema.
- **Effort.** A day.
- **Files.**
  - `pack.ts`
  - `build.ts`
  - `scripts/augment-pack.ts`
  - `scripts/describe-song.ts`
  - the docs
  - `tests/pack-build.test.ts` and `pack-v2.test.ts`
- **Risk.** None for playback.
- **Points to watch.**
  - Each pack grows by about 50–150 KB.
  - The melody is weak on orchestral recordings, so label it as an estimate.

### 6. "Keep the strongest" thinning (partly exists)

- **What.** An optional layer flag, `thin: 'loud'`. At intensity a, an attack passes if its velocity rank among the instance's chords within ±4 s is at least 1−a. Ties are broken by the existing hash, so playback stays deterministic and seek-safe. It is one toggle beside the intensity lane.
- **What exists.** The `accents` line already keeps a fixed top 15% ([lines.js](lab/layers/lines.js:247)). Hand-made picks sets (ff-blows) do it by hand.
- **Why.** With rank thinning, a build starts with the real accents and fills in toward weaker notes, so it looks like growth, not random flicker.
- **Borrowed from.** The Trigger CHOP's thresholds (only real accents fire) and onset strength in OnsetNRT and madmom.
- **Effort.** A day.
- **Files.**
  - `lab/layers/automation.js` (`WA.chordRanks`)
  - `lab/layers/slot.js` `deliveredChords`
  - `src/widgets/types.ts`
  - `show.ts` (the key list, validation, repair)
  - `schedule.ts:57`
  - `conductor.ts` `slotLayer` (it must return a layer for a flag-only clip)
  - `driver.ts:138`
  - `lab/index.html:893`
  - `lanes.ts`
  - tests
- **Risk.** None without the flag; the hash path runs exactly as today. Older studios strip the key on repair.
- **Points to watch.**
  - On ensemble tracks with flat velocities, ties fall back to the hash, which is today's behaviour.
  - Recompute the ranks when the picks change.
  - Disable the toggle on `present` layers, which do not thin.
  - The onset-strength blend is dropped: the pack has no onsets until #5.

### 7. "Build to the climax" preset (new)

- **What.**
  - `WA.climaxes` finds peaks in `pack.loudness` at load time: it smooths over ±1.5 s, ranks by height × prominence, and keeps peaks at least 20 s apart. It adds no pack field and needs no re-ingest.
  - `WA.presets.toClimax` ramps from the last trough before the peak up to 1 at the peak, then drops fast to a held floor. That is a settling, not a reversed build.
  - It is a chip in `lanes.ts`, with optional climax ticks on the timeline ([marks.ts](src/studio/show/marks.ts:15)).
  - `compose.ts` stays out of this change.
- **Why.** The real climax gets no more visual budget than the bars before it.
- **Borrowed from.** Offline look-ahead (dynaudnorm, the "future energy" idea in drop detectors) and Schubert's response lags.
- **Effort.** A day.
- **Files.**
  - `lab/layers/automation.js`
  - `src/studio/ui/lanes.ts`
  - optionally `marks.ts`
  - `tests/layers-presets.test.ts`
- **Risk.** None for playback.
- **Tested on 5 packs with a scratch script:**
  - Barber: 348.7 s (the fff arrives at 346.2 s).
  - Bald Mountain: 355 s and 188 s.
  - Danse macabre: 377 s.
  - Chopin 48/1 fails. The top pick is a saturated plateau at 211 s, because the lane clamps at −12 dB, and the climax the analysis names comes 4th.

  So the pick must be a suggestion the composer can see and move, never an automatic choice.
- **Points to watch.** An optional "hold back" dip in the 5–15 s before the peak can read as a fake release (no-fake-attacks). Keep it optional.

### 8. Pace warning in check-show (partly exists)

- **What.** In `scripts/check-show.ts`, compute `character()` for each clip span from `pack.notes`. Warn when crimp, handover, fireworks or fireworks-snap sit on spans with a high `quiet` or a low `fast` value. The rules already exist as text ([STYLE.md](docs/compositions/STYLE.md:33)), and `fast` and `quiet` already exist ([character.ts](src/studio/compose/character.ts:44)).
- **Why.** It catches pace mismatches before you see them.
- **Effort.** Hours.
- **Risk.** It must stay a warning, never an error, or existing shows would fail the check.

### 9. Fade independent of frame rate, plus a picture delay (new; low impact on energy)

- **What.**
  - **(a) Fade.** Scale the shared fade by dt. Keep the literal `rgba(0,0,0,0.12)` when dt is 1/60, so renders stay identical. All three copies change together: [runtime.ts](src/widgets/runtime.ts:241), `slot.js:338` and `lab/index.html:1003`.
  - **(b) Picture delay.** A manual delay setting in ms in `player.ts`, off by default and never used by render or record. There is no AudioContext on the playback path, so `outputLatency` cannot be read.
- **Why.** Trails are half as long on 120/144 Hz screens, and on Bluetooth output the pictures lead the sound.
- **Effort.** Hours.
- **Risk.**
  - At 144 Hz, 8-bit rounding stalls the fade near 10/255 instead of about 4/255. The colour-burn is tuned for 0.12, so it needs retuning and should run once per 1/60 s, not once per step.
  - Live 60 Hz screens also change slightly, because dt jitters. Only renders stay identical.
  - Nobody has reported a lag problem.

## 6. Bigger ideas for later

- **Section-relative loudness (`rel`, energy lanes step B).** It needs tuning by eye on several pieces first.
- **A tension lane (Farbood model).** A week or more. The harmonic term (spiral-array strain) does not exist, the weights were fitted to short excerpts, and transcription octave errors would make the "pitch rising" term spike falsely at climaxes. The cheaper "Follows the sound" (#1) gets most of the value.
- **A music-paced clock (`ctx.flow`).** Not worth it. Widgets keep their own accumulators, and `+rate` drives already pace ridges, score, current, cells, fields and marbling. Once #3 exists, switching those drives to `+loud` gives the same effect. It also does not fix the murmuration complaint, which is about the trigger and the target figure, not speed.
- **Chord prominence on about 21 widgets with absolute thresholds.** That is days of work. A changed gate in front of seeded random draws shifts the random stream, so shows stop drawing the same. The magnitudes after the gate also assume the threshold was crossed.
- **"Audio attacks" for untranscribed passages, and a "held swell" preset.**
  - Flux onsets on orchestral audio fire on tremolo, bow changes and reverb, which risks the fake attacks you dislike.
  - Swell detection fails on strings sliced into 0.1 s notes.
  - Most of their value comes from #1 plus #4.
- **Full pace lane and beat phase (`ctx.beat` with confidence).** Rubato would leave confidence near 0 on much of the catalogue, and most of the work is plumbing. The pace warning (#8) is the useful slice.
- **Auto-composer reading loudness and climaxes**, for example placing the casket at a picked climax instead of where `loud >= 0.75 && dense >= 0.5` ([compose.ts](src/studio/compose/compose.ts:187)). This affects only future auto-composed shows. Do it after #7 has proved itself.
- **Arousal curve.** It is already computed by the character engine ([character.ts](src/character/character.ts:128)) but only on the live path. The ML arousal models are trained on pop and film.
- **Demucs stems.** These are weak for classical music: the orchestra lands in "other". Our tracks and lines already do this job better.

## 7. The complaints these address

| Your words | Source | Addressed by |
|---|---|---|
| marbling: "extremely high potential", but "doesn't respond correctly to the sound" | [ratings.md](lab/ratings.md:39) | #3 `+loud` drive with #2 depth: marbling's ink ageing follows `feat.rate` (attacks), and could follow loudness instead. Partial. |
| murmuration: "the re-forming into new shapes is driven by something unclear (make the trigger and the target figure clearly musical)" | [ratings.md](lab/ratings.md:29) | Not really addressed. #6 could make the trigger only the strongest accents. The target figure needs widget work. |
| piano strings "boring"; murmuration "more expressive" | [ratings.md](lab/ratings.md:17) | #2 and #3 (knobs that follow loudness and pace with a set strength). Partial. |
| Crimp's red mesh "not congruent with the slow pace of the music there" | [ratings.md](lab/ratings.md:135) | #8 pace warning. |
| Fireworks on the beat chords "not very congruent with the things they are connected to" | [ratings.md](lab/ratings.md:134) | #6 "Keep the strongest" on the fireworks layer, plus #8. The full fix (chord prominence) is deferred. |
| chord squares milky white instead of "the incongruent red" | [ratings.md](lab/ratings.md:133) | This is a colour choice. Nothing here addresses it directly. |
| hammer, mica and squares on pp final chords ("very incongruent") | [STYLE.md](docs/compositions/STYLE.md:48) | #8, if these widgets are added to its quiet-span list. Partial. |
| handover "only on long, slow notes. On a fast line it flashes." | [STYLE.md](docs/compositions/STYLE.md:33) | #8 pace warning. |
| "Fireworks: only on real ff blows … Slow, quiet passages: no busy red textures." | [STYLE.md](docs/compositions/STYLE.md:31) | #6 and #8; #7 for the climax blows. |
| "the dissolving process implies some sort of attack, but it's really just the result of the attacc happening a couple seconds earlier" | memory: no-fake-attacks | This is a constraint the new presets must respect. #1's slow fall and #7's settling release are designed to fit it. #7's optional hold-back must stay off unless wanted. |
| "the middle lacked consistency and needed MORE on screen with the themes kept as smaller or dimmed threads" | memory: notes-to-widgets-is-the-core | #1 with a non-zero floor keeps threads alive and shaped by the music. #4 makes the curves on time. Partial. |
| "What i am really missing from your stuff is chapters … returning to a chapter again." | memory: shows-need-chapters | Mostly not addressed. #7's climax marks and #5's 4 s table help a composer see where chapters turn, but chapter structure stays an authoring job. |
| "Apparently we have some requirement that the music alone drives the visualization. That is not necessary at all!" | [ratings.md](lab/ratings.md:56) | This sets the frame for every item above. They are tools a composer chooses (presets, drives, a flag, a warning), not automatic reactivity. Existing shows are unchanged. |

## 8. The demo: energy lanes

[lab/energy.html](lab/energy.html) shows items 1, 4 and 7, plus the deferred "relative" lane, on any song in `songs/`. It is a demo only: nothing in the studio or the lab reads it, and it writes nothing. It lives on branch `claude/audio-viz-pipeline-research-c79252`, not on main, so run it from that worktree's folder (it has the `songs` junction):

```bash
npx vite --port 5203 --strictPort
```

Then open `http://localhost:5203/lab/energy.html` (`?song=<id>`, `?t=<seconds>`). It decodes the recording in the browser and K-weights it, as broadcast loudness meters do. Then it plots, for the whole piece and for 24 s around the playhead:

- **What widgets feel today.** This is `level`, made by the real `advanceFeatures` stepped at 60 Hz over the pack's chords.
- **Today's loudness lane** (`pack.loudness`).
- **The sound's energy.** A centred 3 s window, so it has no lag.
- **The "follows the sound" pivots.** These climb fast (0.2 s), fall slowly (1.5 s), are stretched to the piece's own 5th–95th percentile, and never drop below 0.35.
- **Loudness judged against its surroundings.** 0.5 means "normal for the ±8 s around here", blended 50/50 with the whole piece.
- **The three loudest moments, as suggestions.**

The calculations are in [energy.ts](src/research/energy.ts) and tested in [energy-research.test.ts](tests/energy-research.test.ts).

What it measured (2026-11-08):

| Piece | Today's loudness lane runs late by | Of the time the music is louder than its median, `level` < 0.1 | Notes a minute | Loudest moment found |
|---|---|---|---|---|
| Barber: Adagio | 1.8 s (r = 0.94) | 15 % | 189 | 5:49 (the fff) |
| Stravinsky: Firebird, Berceuse and Finale | 1.7 s (r = 0.95) | 21 % | 269 | 5:16 |
| Holst: Mars | 1.8 s (r = 0.97) | 2 % | 1032 | 1:22 |
| Saint-Saëns: Danse macabre | 1.7 s (r = 0.98) | 0 % | 856 | 6:15 |
| Chopin: Nocturne Op. 48 No. 1 | 1.6 s (r = 0.96) | 0 % | 534 | 3:53 |

So the lag of today's loudness lane is real and the same everywhere, about 1.7 s. "Energy without attacks" is a problem of the sustained pieces (strings, slow chorales), not of busy ones: in Mars, Danse macabre and the piano pieces the attacks already carry the energy. In Barber at 5:18 (`?song=barber-adagio&t=318`) the close-up shows it plainly. The sound climbs steadily toward the climax, while what a widget feels drains to almost nothing in every gap between attacks.
### The loud and pace drives

[lab/drives.html](lab/drives.html) shows item 3 at work: one widget three times over the same recording, the same knob on `+level`, `+loud` and `+pace`, its base at the knob's lowest value and depth 1, so each picture's knob goes from lowest to highest as its drive goes from 0 to 1. A bar and a number under each picture give the knob's value now, and a plot of the whole piece shows what each drive reads (click it to jump). Run vite as above and open `http://localhost:5203/lab/drives.html` (`?song=<id>&widget=<id>&knob=<key>&t=<seconds>`; it opens on Barber, Brass gust, "how much air there is to push"; In the Hall of the Mountain King shows pace best). The runtimes are the studio's own (`WidgetRuntime` with the layer code), so what you see is what a show with those knobs draws. The code is [drives-page.ts](src/research/drives-page.ts); it writes nothing.
