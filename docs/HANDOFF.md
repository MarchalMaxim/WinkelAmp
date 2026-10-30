# Handoff — continuing WinkelAmp locally

_Temporary note from the cloud session (2026-10-30). Delete once you're up and running._

## Where things stand

Branch: `claude/wizardly-franklin-ttaqyo`. All 31 tests pass, `npx tsc --noEmit` is clean, `npm run build` works.

| Area | State |
|---|---|
| **v1 app** (welcome, 4 scenes, mapping panel, looks, record/snapshot) | Done, screenshots in `docs/media/` |
| **MIDI** (`src/control/`, `src/ui/midi-panel.ts`) | Done and unit-tested. **Not yet tried with a real device or in a browser.** |
| **Character engine plan + contracts** (`docs/CHARACTER-PLAN.md`, `src/character/types.ts`) | Done; this is the spec for v2 |
| `src/audio/fft.ts` (+ `tests/fft.test.ts`) | Done (radix-2 real FFT, Hann window, AnalyserNode-style smoothing; 10 tests) — not wired in yet |
| `src/audio/pcm-worklet.ts` | Written, not wired in or tested |
| Everything else in the v2 plan | Not started (the build was stopped a few minutes in) |

## First things to check locally

```bash
npm install
npm test
npm run dev
```

1. **MIDI with a real controller** (Chrome/Edge): open the panel → **MIDI** → Connect. Defaults: mod wheel = Mood,
   CC7 = volume, CC74 = Trails, CC71 = Drift, CC91 = Glow amount. Try **Learn** on a few controls, play some keys
   (splashes in note colors; "Keys make sound" toggles the FM synth), sustain pedal, pitch bend.
2. Known gap: the key synth plays straight to the speakers (`keyBus` in `src/main.ts`), so the *analysis doesn't hear
   it yet*. Once the engine exposes an input node, connect `keyBus` to it so playing keys drives the visuals and the
   character engine.

## Next: build the character engine

Goal: the visuals should feel like the music's *character* (fire-like erratic, Rachmaninoff dark & blunt,
Nutcracker whimsical/tiny/quick), not just react to loudness. Read `docs/CHARACTER-PLAN.md` first.

The five detailed build specs are in `docs/handoff/character-engine-build.workflow.js` (it's a Claude Code workflow
script — edit `REPO`/`SCRATCH` at the top and run it, or hand each task prompt to a separate session/agent). Work
items, with the files each one owns:

1. **descriptors** — `src/audio/{pcm,fft,descriptors,offline}.ts`, engine refactor to own FFT + PCM tap,
   `scripts/analyze-file.ts`. (fft.ts and pcm-worklet.ts already exist.)
2. **neural** — musicnn (MagnaTagATune, ISC license) → ONNX → `onnxruntime-web` in a worker; JS mel front-end that
   matches librosa. Get the model with `pip download --no-deps musicnn` (the wheel contains the TF1 checkpoints).
3. **character** — `src/character/{character,archetypes,reservoir}.ts`: descriptors (+ tags) → axes → archetype blend
   → `Material`; echo-state network (reservoir RNN) → organic `Gesture`s.
4. **living** — `src/visual/living/*`: WebGL2 fluid sim + spark particles + CPPN aura + bloom/tone-mapping; Material
   makes each archetype unmistakable.
5. **studies** — `src/audio/studies.ts`: original demo pieces Ember / Basalt / Sugar Glass / Mist; plus a numpy piano
   rendering of Rachmaninoff's Prelude in C♯ minor opening as a test reference.

Then: integrate (new "Living" scene, character readout in the HUD, MIDI notes → `SoundEvent`s), calibrate the
character mapping against reference recordings, and run a blind "does this look like the music?" review.

## Reference recordings for testing (not committed)

```bash
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/librosa/data.git ref-audio
cd ref-audio && git sparse-checkout set --no-cone '/audio/*.ogg' && git checkout
```

Useful ones: *Dance of the Sugar Plum Fairy* (whimsical), Brahms *Hungarian Dance No. 5* (fiery), ragtime
(playful), humpback whale (serene/eerie), drum-and-bass (machine). Better still: use your own recordings of the
pieces you have in mind (Rachmaninoff, etc.) — just drop them into the app.

## Already learned

- Note detection on the v1 demo: correct chord tone ~94% of the time; weighting the bass to find roots traded
  chord-tone accuracy for root accuracy, so it was reverted.
- Headless Chromium runs the visuals at ~17 fps (SwiftShader); real GPUs are much faster.
- `npm run shots` needs the dev server running; `-- --video` also records a tour.
