# WinkelAmp — design brainstorm

> The assignment: **synesthesia**. Build a bridge from sound + rhythm to movement + color.
> Winamp's visualizers came close, but they were awkward to use. This one should be
> interactive, easy to control, and invite experimentation.

This document is a self-interview: the questions a designer would ask, answered
as best I can, and the decisions that fell out of them.

---

## 1. Who is this for?

**Q: Who opens WinkelAmp?**
Someone with music on and a screen in front of them. Not a VJ, not an audio
engineer. They might be hosting friends, studying, dancing in the kitchen, or
just curious about what their favorite song "looks like".

**Q: What did Winamp + MilkDrop get wrong for that person?**
- You had to *find* the visualizer: plugin menus, a separate window, preset files.
- Controls were cryptic (preset names like `Geiss - Reaction Diffusion 2`, keyboard
  shortcuts you had to memorize).
- It was a *TV*: you watched it, you couldn't touch it.
- Tweaking meant editing preset code. Experimenting was only for the geeks.

**Q: What did it get right?** The feeling that the music is *alive* on screen.
Feedback/zoom trails, beat-reactive bursts, mesmerizing symmetry. Keep that.

## 2. What does "synesthesia" mean here, concretely?

Synesthesia needs *consistent* mappings — the same sound should always feel like
the same color/motion, otherwise it's just a screensaver that wiggles.

| Sound property            | How we hear it          | Becomes                                         |
|---------------------------|-------------------------|-------------------------------------------------|
| Pitch class (C, C#, … B)  | which note / key        | **Hue** (circle of fifths around the color wheel) |
| Tonal vs. noisy           | a chord vs. a drum hit  | **Saturation** (tonal = vivid, noise = white sparks) |
| Loudness                  | how big it is           | **Brightness** and size                          |
| Bass                      | weight, body            | **Size / pressure** — things swell              |
| Mids                      | voices, melody          | **Speed** — things travel                       |
| Treble                    | air, sparkle            | **Shimmer / glow**                              |
| Onsets (beats)            | rhythm                  | **Impulses** — bursts, rings, kicks to the camera |
| Tempo (BPM)               | groove                  | rhythm of rotation and pulse                    |

**Q: Why circle of fifths for hue, not just C=red, C#=orange …?**
Chromatic order puts musically *distant* notes (C and C#) next to each other in
color. Fifths order places harmonically related keys (C, G, D) on neighboring
hues, so a song that stays in one key keeps a coherent palette and a key change
visibly shifts the whole mood. That's closer to what (self-reported) synesthetes
and Scriabin's "clavier à lumières" described.

**Q: Do people get to override that?** Yes. "Notes" is the default palette;
others (Sunset, Ocean, Neon, Ink) reinterpret the same signal through a curated
gradient. Pitch still moves the color *within* the palette.

## 3. How does someone start?

**Q: What's the first 5 seconds?**
One screen, three big choices, no menus:
1. **Play the demo groove** — a built-in generative track, so there's always
   something to try (and you can see notes-to-color without hunting for an mp3).
2. **Use my music** — pick files, or just drop them anywhere on the window.
3. **Listen to the room** — the microphone; play music from your phone, sing, clap.

Browsers require a click before audio can start, so this screen is also the
honest way to satisfy that rule.

**Q: Install?** None. It's a web page. Works on a laptop, a projector, a TV browser.

## 4. How do you control it without becoming a geek?

**Q: What's the minimum set of controls that covers most of the expressive range?**
- **Scene** — four visual "instruments", shown as big cards, not a preset list.
- **Palette** — five swatches you can see before you click.
- **Mood: Calm ↔ Wild** — one slider that scales sensitivity and motion together.
- **Trails: Crisp ↔ Dreamy** — how long light lingers.
- **Drift: Still ↔ Tunnel** — the classic MilkDrop zoom-feedback, as one slider.
- **Mirror** — kaleidoscope symmetry (off, 2, 4, 6, 8, 12).
- **Surprise me** — randomize everything tasteful. The best experiment button.

Everything uses plain words. No "FFT size", no "decay coefficient".

**Q: What about people who *do* want to tinker?**
A collapsible **Sound → Motion** section: one row per motion (Size, Speed, Spin,
Glow, Shake, Color shift, Zoom). Each row says, in a sentence,
"*Size* follows *Bass* — amount ▬▬▬", with a live meter so you can *see* what the
sound source is doing right now. It's a modular patch bay disguised as a form.

**Q: Can you keep what you made?**
**Save look** stores the whole setup as a named chip (in the browser). One click
recalls it. **Snapshot** saves a PNG; **Record** saves a video with the audio.

## 5. How do you *play* it, not just watch it?

**Q: What does touching the canvas do?**
- **Click / tap** → a burst in the color of the current note.
- **Click + drag** → paint with sound: the brush leaves luminous ink whose size
  follows loudness and whose color follows pitch. With Mirror on, you paint
  mandalas.
- **Scroll** → zoom in/out.
- **Keyboard** for flow: `Space` play/pause, `1–4` scenes, `R` surprise,
  `M` mirror, `H` hide interface, `F` fullscreen, `←/→` previous/next track.

**Q: Won't the interface get in the way of the art?**
The interface fades out after a few seconds without mouse movement and comes back
the moment you move. `H` hides it for good.

## 6. The four scenes

| Scene     | Idea                                                                     |
|-----------|--------------------------------------------------------------------------|
| **Bloom** | The spectrum as a living flower: low notes at the heart, highs on the petals. |
| **Swarm** | A thousand fireflies riding a flow field; beats blow them outward.      |
| **Ribbons** | The waveform as silk ribbons drifting across the screen.               |
| **Pulse** | Every beat launches a ring; twelve note-lights orbit the center, one per pitch class — the clearest view of the "notes are colors" mapping. |

All scenes read the same mapped motion values, so the Sound → Motion patch bay
works for every scene.

## 7. Technical decisions

- **Web app, TypeScript, Vite, no framework.** The DOM UI is small; a framework
  would be more weight than help.
- **Web Audio API** for decoding, mic input, the demo synth and analysis
  (`AnalyserNode`, 4096-point FFT).
- **Analysis is pure code** (`src/audio/features.ts`) fed with plain arrays, so it
  is unit-tested without a browser: band energies with auto-gain (quiet and loud
  songs both look good), spectral-flux onset detection with an adaptive threshold,
  tempo from inter-onset intervals, a 12-bin chromagram, spectral centroid.
- **Canvas 2D** rendering pipeline per frame:
  1. *feedback*: previous frame redrawn slightly zoomed/rotated and faded (trails + drift),
  2. *scene* drawn into an offscreen layer,
  3. *kaleidoscope*: the layer's first wedge copied around the circle, alternately mirrored,
  4. composited additively, so overlapping light adds up like light does.
- **Recording**: `canvas.captureStream()` + the audio graph's `MediaStreamDestination`
  → `MediaRecorder` → `.webm` download.

## 8. Out of scope (for now)

Streaming services (Spotify etc. don't expose raw audio to web pages), MIDI
controllers, WebGL shaders, sharing looks by link. All good next steps, listed in
the README.
