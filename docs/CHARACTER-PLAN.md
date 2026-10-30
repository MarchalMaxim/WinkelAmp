# The Character Engine — plan (v2)

> Goal: real synesthesia, not a level meter. Some pieces are erratic, like fire.
> Rachmaninoff is dark and blunt. The Nutcracker is whimsical, tiny and quick.
> The picture should *feel* like that — its material, weight, size, speed and color.

## The insight

v1 reacts to the *moment* (this frame's bass, this beat). Character lives at a longer
timescale (2–8 s): how high or low the music sits, how sharp the attacks are, how
regular the rhythm is, major or minor, how dense, how loud in absolute terms. So v2
adds three layers on top of the frame features:

```
PCM ──► frame features (v1: bands, onsets, chroma…)          fast: per frame
   ├──► descriptors  (register, attack, irregularity, mode…)  medium: 1–8 s windows
   ├──► neural tags  (musicnn, trained on MagnaTagATune:      slow: every ~1 s, 3 s patches
   │                  fast/slow/loud/soft/heavy/piano/…)
   └──► CHARACTER = axes (energy, valence, weight, size, agitation, sharpness…)
                  + archetype blend (Fire, Abyss, Sugar, Mist, …)
                  + reservoir RNN state (echo-state network → organic gestures)
                        │
                        ▼
                 MATERIAL (what the picture is made of: buoyancy, viscosity,
                 splat size, sparks, palette, angularity…)
                        │
                        ▼
                 LIVING CANVAS (WebGL2): fluid sim + spark particles + neural
                 (CPPN) aura + bloom/tone-mapping/grain
```

## Grounding: cross-modal correspondences (what people reliably agree on)

| Sound | Felt as | Visual |
|---|---|---|
| High pitch | small, light, high up, bright, thin | tiny particles, top of screen, pale/bright |
| Low pitch | big, heavy, low, dark | big slow masses, bottom of screen, deep colors |
| Loud | big, near, bright | bigger, brighter, more saturated |
| Sharp attacks / staccato | angular, pointy ("kiki"), discrete | sparks, points, crisp edges |
| Legato / sustain | round ("bouba"), continuous | smooth flowing dye, soft blobs |
| Fast tempo / dense onsets | quick, busy | fast motion, many elements |
| Irregular rhythm, dissonance | erratic, agitated, rough | turbulence (vorticity), jitter, flicker |
| Major + fast | happy → light, saturated, yellow/warm | (Palmer et al. 2013, PNAS) |
| Minor + slow | sad → dark, desaturated, blue | (Palmer et al. 2013) |
| Noisy / bright timbre | rough texture, sparkle | grain, twinkle |

## Archetypes (prototypes in character space; the blend is continuous)

| Id | Name | Musical signature | Material |
|---|---|---|---|
| `fire` | Fire | energetic, erratic, sharp attacks, mid/high register, often minor/dissonant | buoyant rising dye, high vorticity, fast fade, embers, blackbody palette |
| `abyss` | Abyss | dark & blunt: low register, loud, slow, heavy sustained chords, minor | thick slow liquid, big splats from below, gravity, deep indigo/oxblood, little sparkle |
| `sugar` | Sugar | whimsical, tiny & quick: high register, staccato, light, major, quick | tiny crisp sparkles, small fast splats, twinkle, pastel/ice palette |
| `mist` | Mist | serene: soft, slow, legato, consonant | slow soft dye, no sparks, low contrast, cool pastels |
| `gold` | Gold | triumphant: loud, major, steady pulse, bright | broad radiant splats, steady pulses, gold/white |
| `storm` | Storm | dense, loud, minor, driving, rough | turbulent, dense, strobing, steel blue/violet with white flashes |
| `machine` | Machine | electronic, very steady beat, noisy timbre | gridded pulses, crisp, neon cyan/magenta |
| `lament` | Lament | slow, minor, soft, sustained, mid-low register | slow sinking dye, desaturated blue/grey, faint drifting motes |

## Module contracts

All contracts are in `src/character/types.ts`. Owners:

- `src/audio/pcm.ts`, `src/audio/fft.ts`, `src/audio/descriptors.ts` (+ engine refactor): PCM tap, own FFT, descriptors.
- `src/neural/*`, `public/models/*`: musicnn → ONNX, mel front-end, worker, client.
- `src/character/{character,archetypes,reservoir}.ts`: descriptors + tags → Character → Material, echo-state network.
- `src/visual/living/*`: WebGL2 Living Canvas.
- `src/audio/studies.ts`: original character-study pieces (demo playlist).
- `scripts/eval/*`: offline evaluation over reference recordings.
