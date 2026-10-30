export const meta = {
  name: 'character-engine-build',
  description: 'Build the WinkelAmp character engine: descriptors, neural tagger, character model + reservoir RNN, WebGL Living Canvas, character studies',
  phases: [{ title: 'Build', detail: 'five parallel builders on disjoint modules' }],
}

const REPO = '/path/to/WinkelAmp' // EDIT: your local checkout
const SCRATCH = '/tmp/winkelamp-scratch' // EDIT: any local scratch dir
const REF = SCRATCH + '/ref/audio'

const COMMON = `
You are one of five engineers building, IN PARALLEL, the "character engine" for WinkelAmp, a browser synesthesia
music visualizer in ${REPO} (Vite + TypeScript, no framework, vitest). The goal of the whole project: the visuals should
FEEL like the music's character — e.g. some classical pieces are erratic like fire; Rachmaninoff is dark and blunt;
the Nutcracker (Sugar Plum Fairy) is whimsical, tiny and quick.

READ FIRST: ${REPO}/docs/CHARACTER-PLAN.md and ${REPO}/src/character/types.ts (the shared contracts — do NOT change
types.ts; if you truly need a contract change, describe it in your final report instead). Also skim
${REPO}/src/audio/features.ts and ${REPO}/src/audio/engine.ts to see the existing v1 code.

Rules for working in parallel:
- Only create/edit the files you own (listed below). Other engineers are editing other files at the same time.
- Dependencies are already installed (tsx, onnxruntime-web, onnxruntime-node, vite, vitest, typescript). Do NOT run
  npm install / change package.json; if you need a new npm dependency, say so in your report. Python packages: create
  a venv under ${SCRATCH}/venv-<yourname> if needed (pip/PyPI is reachable; most other internet hosts are blocked;
  GitHub git clone works).
- \`npx tsc --noEmit\` may show errors in other engineers' half-written files; only fix errors in YOUR files.
  Run your own tests with \`npx vitest run <your test file>\`.
- Do not git commit. Do not touch docs/media.
- Chromium + Playwright are preinstalled (require('playwright') works; chromium.launch() needs no options; use
  args ['--autoplay-policy=no-user-gesture-required'] for audio, and for WebGL in headless try
  ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] if WebGL2 is unavailable).
  If you need a dev server, run \`npx vite --port <your port> --strictPort\` in the background and kill it afterwards
  by PID (never \`pkill -f vite\` — that can kill other engineers' servers and your own shell).
- Reference recordings (real music, for testing only, never commit them) are in ${REF}:
  Tchaikovsky "Dance of the Sugar Plum Fairy" (Kevin MacLeod) = whimsical/tiny/quick; Brahms "Hungarian Dance no 5
  Allegro F# minor (string orchestra)" = fiery/agitated; ragtime "pistachio ice cream" = playful; "sweet waltz";
  "glacier-bay-humpback" = whale song, serene/eerie; "Choice Drum-bass" = electronic; "Vibe Ace"; "Let's Go Fishin'"
  (pop/country vocal); "sorohanro solo trumpet"; "pibble"; snare accelerate; speech clips 198-209-0000 etc.
  Decode with ffmpeg, e.g. \`ffmpeg -v error -i in.ogg -ac 1 -ar 44100 -f f32le out.f32\`.
- Code style: match the existing code (concise, small doc comments explaining WHY, strict TS, no frameworks).
- Be ambitious and thorough but make it WORK: verify by actually running things. Report honestly what works,
  what you verified (with numbers), and what doesn't.
`

const REPORT = {
  type: 'object',
  properties: {
    files: { type: 'array', items: { type: 'string' }, description: 'files created/modified' },
    api: { type: 'string', description: 'how other modules / the integrator should use your work (exports, call order, gotchas)' },
    verification: { type: 'string', description: 'what you ran and the results, with numbers' },
    issues: { type: 'string', description: 'open problems, limitations, requested contract changes' },
  },
  required: ['files', 'api', 'verification', 'issues'],
}

const TASKS = [
  {
    key: 'descriptors',
    prompt: `${COMMON}
YOUR JOB: the audio-analysis foundation — one analysis code path that works both live in the browser and offline in Node.

Files you own: src/audio/pcm.ts, src/audio/fft.ts, src/audio/descriptors.ts, src/audio/offline.ts,
src/audio/pcm-worklet.ts (or similar worklet file), src/audio/engine.ts (refactor), src/audio/features.ts (you may
extend Features with new per-frame fields, keeping existing fields/semantics so v1 scenes keep working),
tests/descriptors.test.ts, tests/fft.test.ts, scripts/analyze-file.ts.

1. PCM tap: an AudioWorklet that receives what the user hears (the engine's bus) AND the mic, and writes mono PCM
   into a ring buffer on the main thread. Implement the PcmSource interface from types.ts. Keep a fallback
   (ScriptProcessor or AnalyserNode.getFloatTimeDomainData) if AudioWorklet fails. Vite: load the worklet via
   \`new URL('./pcm-worklet.ts', import.meta.url)\` or a ?worker/?url import that works in both dev and build — verify
   with \`npx vite build\`.
2. Own FFT (fft.ts): real FFT, Hann window, magnitude spectrum, plus temporal smoothing equivalent to
   AnalyserNode.smoothingTimeConstant, so the engine no longer depends on AnalyserNode for frequency data. Fast
   (preallocated, radix-2, 4096 points in well under 1 ms). Tested against a naive DFT.
3. Refactor engine.ts: analyze() computes magnitudes from the PcmSource with fft.ts and feeds FeatureExtractor
   exactly as before (same scale as before: linear magnitudes comparable to 10^(dB/20) from AnalyserNode with a Hann
   window — check FeatureExtractor's thresholds still behave; tests in tests/features.test.ts must still pass).
   Expose engine.pcm (PcmSource) and engine.descriptors (latest Descriptors). Keep the public API used by main.ts
   working.
4. descriptors.ts: class DescriptorExtractor { update(features: Features, magnitudes: Float32Array, sampleRate,
   fftSize, time): Descriptors } computing EVERY field of the Descriptors contract with careful, documented, musically
   meaningful algorithms over sensible windows (1–8 s), smoothly varying. Requirements and hints:
   - loudness must be ABSOLUTE-ish (dBFS/RMS of the raw PCM or magnitudes mapped through a fixed curve, e.g. -60 dBFS→0,
     -6 dBFS→1, maybe with a very slow long-term reference) — NOT the per-song auto-gain in FeatureExtractor, because
     "blunt and loud" vs "tiny and soft" depends on it. Note Kevin MacLeod / other recordings are mastered at different
     levels; consider a mixed approach (absolute dB plus mild long-term normalisation over ~30–60 s) and justify it.
   - register: weighted mean pitch (MIDI) of spectral peaks of the tonal content (parabolic peak interpolation;
     weight by magnitude; consider favoring the lowest strong partial / harmonic grouping so the pitch reflects
     notes, not partials), mapped C1..C8 → 0..1. registerSpread from the weighted spread.
   - noisiness = spectral flatness; roughness = sensory dissonance (Plomp–Levelt / Sethares model over the top
     spectral peaks, normalized).
   - onsetRate, irregularity (CV of inter-onset intervals, robust to outliers), attack (onset sharpness: e.g. rise
     slope of the energy envelope / flux strength relative to level), sustain (energy remaining between onsets
     relative to onset peaks), pulseClarity (autocorrelation of the onset-strength envelope), tempo.
   - majorness/keyClarity: Krumhansl–Kessler key profiles correlated with a ~6–8 s chroma average; majorness =
     (best major r - best minor r) mapped to -1..1, keyClarity from the max correlation.
   - harmonicChange (chroma flux over time), pitchMotion (rate of change of register), silence.
5. offline.ts: analyzeOffline(pcm: Float32Array, sampleRate: number, opts?) → per-frame arrays (at 60 fps hop) of
   Features snapshots (copy the scalar fields; skip big arrays) + Descriptors, using EXACTLY the same classes as live.
   scripts/analyze-file.ts (run with \`npx tsx scripts/analyze-file.ts <audio file>\`): decodes with ffmpeg and prints
   a compact summary (mean/percentiles of each descriptor over the piece, and a coarse timeline).
6. Validate on the reference recordings: run analyze-file over ALL of ${REF}/*.ogg and check that the descriptors
   tell the pieces apart in the musically expected direction (e.g. Sugar Plum: high register, sharp attacks/low
   sustain-ish celesta, major-ish; Hungarian Dance: minor, high dynamics/irregularity, high onset rate; humpback:
   low onset rate, sustained, very low pulse clarity; drum-bass: high pulse clarity, noisy). Iterate on the
   algorithms until they do. Put the final table in your verification report.
Tests: unit tests with synthetic signals for each descriptor (e.g. a low vs high sine → register; staccato vs
legato tone bursts → attack/sustain; regular vs jittered clicks → irregularity; major vs minor triads → majorness).`,
  },
  {
    key: 'neural',
    prompt: `${COMMON}
YOUR JOB: a real pretrained neural music tagger running in the browser (and in Node for offline evaluation).

Files you own: src/neural/* (e.g. mel.ts, tagger.ts, tagger.worker.ts, tags.ts), public/models/* (model + mel
filterbank JSON), scripts/neural/* (conversion + verification scripts), tests/neural.test.ts.

The musicnn package (Pons & Serra 2019; ISC license) ships pretrained TensorFlow 1 checkpoints. Its wheel is already
downloaded at ${SCRATCH}/pip/musicnn-0.1.0-py3-none-any.whl (contains musicnn/MTT_musicnn/ checkpoint: .meta, .index,
.data; and models.py, extractor.py, configuration.py). Plan:
1. In a Python venv (${SCRATCH}/venv-neural; Python 3.13; PyPI reachable: tensorflow 2.21, tf2onnx, librosa, onnx,
   onnxruntime, numpy), load the MTT_musicnn graph. Try tf.compat.v1.train.import_meta_graph + restore, find the input
   placeholder (log-mel patch [batch, 187, 96]) and the output (sigmoid tag probabilities, 50 tags; also the
   penultimate/embedding layer if easily available), set is_training false, freeze, and convert to ONNX with tf2onnx
   (opset 17ish). If import_meta_graph fails, rebuild the graph from musicnn/models.py with tf.compat.v1 and restore
   the checkpoint. Read musicnn/configuration.py + extractor.py to get the exact preprocessing and the tag list
   (MTT_LABELS) in output order.
2. Reproduce the musicnn front end exactly: librosa.feature.melspectrogram(y at 16 kHz, hop_length=256, n_fft=512,
   n_mels=96, ...) then np.log10(10000*x + 1) — check extractor.py for exact args (window, power, htk/slaney norm).
   Export the mel filterbank matrix to public/models/ as JSON (or compute it in TS identically) and implement mel.ts in
   TypeScript (resampling to 16 kHz from 44.1/48 kHz with a decent anti-aliased resampler, STFT, mel, log).
   Verify numerically against librosa on a real clip (report max/mean abs error).
3. Verify the ONNX model with onnxruntime (Python) vs the original TF graph on the same inputs (max abs diff), then
   run it in Node with onnxruntime-node + your TS mel front end (scripts/neural/tag-file.ts, run with npx tsx) on the
   reference recordings and report the top tags per piece (does Sugar Plum get e.g. classical/harpsichord/
   strings/fast? does humpback get ambient/weird/slow? does drum-bass get techno/electronic/beat?).
4. Browser: tagger.worker.ts runs onnxruntime-web (WASM backend; configure ort.env.wasm.wasmPaths so Vite serves the
   .wasm files in dev and in \`npx vite build\` output — verify both; single-threaded is fine) on the latest 3 s of
   audio about once per second, returning NeuralTags. tagger.ts: class NeuralTagger { constructor(pcm: PcmSource);
   start(); stop(); latest: NeuralTags | null; ready: boolean; onError? } — PcmSource is the contract in types.ts
   (another engineer is implementing the real PCM tap; for your own browser test, write a tiny stand-in PcmSource fed
   by decoding a reference clip with decodeAudioData). Must degrade gracefully (app keeps working) if the model fails
   to load. Keep the model small for the web (report size; consider ONNX float16 or dynamic int8 quantization ONLY if
   accuracy stays essentially the same — measure).
5. Prove it works in a real browser: a small Playwright script that loads the app's dev server page (or a scratch test
   page) and runs the worker on a reference clip, printing the tags. Report timings (ms per inference).
Put a short README section draft about the model + license attribution in your report (the integrator will add it).`,
  },
  {
    key: 'character',
    prompt: `${COMMON}
YOUR JOB: the "mind" — turning descriptors (+ optional neural tags) into Character, Material and organic gestures.

Files you own: src/character/character.ts, src/character/archetypes.ts, src/character/reservoir.ts,
src/character/palette.ts (optional), tests/character.test.ts.

1. character.ts: class CharacterEngine { update(d: Descriptors, tags: NeuralTags | null, f: Features, dt): Character;
   material(): Material; events(f: Features, d: Descriptors): SoundEvent[] } (exact API is yours, document it).
   - Map Descriptors → CharacterAxes with documented, perceptually grounded formulas (cross-modal correspondences:
     pitch height ↔ size/lightness/elevation, loudness ↔ size/brightness, attack ↔ angularity, tempo/onset rate ↔ pace,
     irregularity+roughness+dynamics ↔ agitation, mode+tempo ↔ valence (Palmer et al. 2013), register+loudness+
     sustain+low brightness ↔ weight, warmth from energy & valence & brightness). Use smooth, monotone, saturating
     curves; each axis smoothed with a time constant of ~1–3 s (faster rise on sudden energy).
   - If NeuralTags are available, fuse them (e.g. tags fast/slow/loud/quiet/soft/heavy/metal/ambient/classical/
     harpsichord/piano/techno/beat/weird…) as soft evidence that nudges the axes and archetype likelihoods; the
     system must work well WITHOUT tags too. The 50 MagnaTagATune tag names used by musicnn are: guitar, classical,
     slow, techno, strings, drums, electronic, rock, fast, piano, ambient, beat, violin, vocal, synth, female, indian,
     opera, male, singing, vocals, no vocals, harpsichord, loud, quiet, flute, woman, male vocal, no vocal, pop, soft,
     sitar, solo, man, classic, choir, voice, new age, dance, male voice, female vocal, beats, harp, cello, no voice,
     weird, country, metal, female voice, choral (look the names up by string, don't assume the order).
   - Archetypes (archetypes.ts): the 8 ids in types.ts, each a prototype point/region in axis space + a Material
     preset (palette stops in linear RGB etc.) + 2–4 descriptive words. Blend = softmax over negative distances with a
     temperature; Material = weighted blend of archetype materials, then direct per-axis modulation on top (e.g.
     splatSize follows axes.size continuously even within one archetype). Hysteresis/smoothing so the blend doesn't
     flicker. words: top archetype words + an axis-derived adjective (e.g. "erratic", "heavy", "delicate", "brisk").
     Palette design: Fire = blackbody (deep red → orange → yellow → white); Abyss = near-black indigo/oxblood/bruised
     purple with dim highlights (dark and blunt!); Sugar = pastel pink/mint/ice/white sparkle; Mist = cool pale
     lavender/teal; Gold = amber/gold/white; Storm = slate/steel blue/violet + white; Machine = neon cyan/magenta/black;
     Lament = desaturated blue-grey/teal. Use the Palmer et al. emotion→color findings to modulate saturation and
     lightness continuously (valence ↑ → lighter & more yellow; arousal ↑ → more saturated & warmer).
   - events(): per frame produce SoundEvents: onsets (from Features.onset) with height from descriptors.register (or
     better the current dominant pitch height) , note from Features.note (-1 if tonality low), strength, color from the
     palette + note hue, and occasional continuous emission while sustained/loud. Keep events sparse and meaningful.
2. reservoir.ts: an Echo State Network (reservoir computing — a recurrent neural network with fixed random sparse
   recurrent weights, spectral radius < 1, leaky-integrator neurons; seeded PRNG so it's deterministic) of ~200–400
   units, driven by an input vector of descriptors + a few fast features. Its state is the "imagination" that turns
   the music's history into organic motion. Readouts → Gesture (types.ts): x, y, angle, swirl, breath, extra[4].
   Since we have no training data, design readouts sensibly: e.g. fixed random projections followed by tanh, then
   temporal decorrelation/normalisation (running mean/std) so outputs use the full -1..1 range; leak rate tied to
   pace (quick music → quick gestures). Optionally train the readouts by ridge regression at startup to imitate
   target smooth trajectories (e.g. Lissajous/attractor curves) whose speed is modulated by pace and whose amplitude
   by agitation — creative, but explain. Must be cheap: < 0.3 ms/frame. Show it's stable (no NaN, bounded) under
   silence, noise and loud input for 10 minutes simulated.
3. Tests (tests/character.test.ts): build synthetic Descriptors for the canonical cases and assert the right
   archetype wins and axes move the right way: Sugar Plum-like (high register, sharp attack, low sustain, quiet-ish,
   quick, major) → sugar; Rachmaninoff-like (very low register, loud, sustained, slow, minor, dark) → abyss with high
   weight & size and low valence; erratic-fire-like (high onset rate, high irregularity, high dynamics, sharp, minor or
   rough, mid-high register) → fire; serene (soft, slow, legato, consonant) → mist; electronic steady (pulseClarity
   high, noisy) → machine; silence → low energy/confidence and no crash. Also reservoir stability/range tests.
Think carefully about the psychology/music-cognition: the result must be convincing to a musician.`,
  },
  {
    key: 'living',
    prompt: `${COMMON}
YOUR JOB: the Living Canvas — a gorgeous WebGL2 renderer whose MATERIAL changes with the music's character.

Files you own: src/visual/living/* (e.g. living.ts, gl.ts, fluid.ts, sparks.ts, aura.ts, post.ts, shaders), plus a
standalone test harness page (e.g. living-test.html at the repo root + scripts/living-shots.mjs) and screenshots in
${SCRATCH}/living-shots/.

API: class LivingCanvas { constructor(canvas: HTMLCanvasElement); static supported(): boolean; resize();
render(input: LivingInput): void; dispose() } (LivingInput, Material, SoundEvent, Gesture in types.ts). The integrator
will place a dedicated <canvas> for it under the UI and show it when the "Living" scene is selected.

Build (original code, your own implementation):
1. GPU fluid simulation (stable fluids on half-float textures, ping-pong FBOs): advection (semi-Lagrangian, maybe
   MacCormack), divergence, pressure Jacobi iterations, gradient subtraction, vorticity confinement (curl), buoyancy
   from a temperature/density channel, gravity, viscosity via velocity dissipation, dye dissipation. Splats: Gaussian
   (and for high angularity, star/shard-shaped or anisotropic) injections of dye+velocity. Graceful fallback if
   float textures are unsupported (check EXT_color_buffer_float / half float; use RGBA8 fallback with packing or lower
   quality). Sim resolution adapts to performance (measure frame time, scale down).
2. Material mapping (this is the heart — make each archetype UNMISTAKABLE):
   - Fire: buoyant hot dye rising from emitters, high vorticity flicker, fast dye fade (flames that lick upward and
     vanish), embers/sparks rising with random jitter, blackbody palette, slight heat-shimmer distortion.
   - Abyss (dark & blunt): heavy, viscous, slow dye that sinks/spreads; huge soft splats from the bottom on low notes;
     dim deep palette, high contrast between near-black and a few dull glints; no sparkle; maybe slow "ink in water"
     plumes; blunt = round, massive, slow.
   - Sugar (whimsical, tiny & quick): tiny crisp twinkling sparkles everywhere, small quick splats high on screen,
     pastel/ice palette, playful bouncy motion, little star shapes (angularity) and fast short-lived dye.
   - Mist: soft slow pastel clouds; Gold: broad radiant pulses; Storm: dense turbulence + white flashes;
     Machine: crisp gridded/quantized pulses; Lament: slow sinking desaturated dye with faint motes.
   All of these must arise from CONTINUOUS Material parameters (buoyancy, gravity, vorticity, viscosity, dyeFade,
   splatSize, splatForce, jitter, sparkAmount, sparkSize, sparkLife, twinkle, angularity, emissive, contrast, grain,
   aura, palette) so blends look natural. SoundEvent.height → vertical emission position (low notes low on screen,
   high notes high), pan → x, color from event.color, strength → size/force; Gesture (from the RNN reservoir) moves
   emitters and swirl organically.
3. Spark particles: GPU particles (transform feedback or texture-based state) advected by the fluid velocity, with
   size/life/twinkle/count from Material; additive, star-shaped when angularity is high, round when low.
4. Aura: a CPPN-style neural field in a fragment shader (a small fixed random MLP of sin/tanh/gaussian activations over
   (x, y, r, time, gesture.extra…)) giving a subtle, slowly morphing background texture tinted by the palette;
   strength = Material.aura.
5. Post: bloom (downsample/blur chain), filmic tone mapping (ACES-ish), palette grading through the 4 palette stops,
   contrast, film grain, vignette; on strong onsets a subtle chromatic aberration for high-agitation materials.
6. Pointer: dragging injects dye + velocity (painting with the fluid) — this must feel great.
7. Performance: target 60 fps on a laptop iGPU at 1080p (sim at lower res); in headless SwiftShader it'll be slow —
   that's fine, but keep it working.
Verification: the harness page drives LivingCanvas with synthetic inputs for each of the 8 archetype-like Materials
(define test Materials yourself in the harness — the real presets come from the character engineer later) plus
synthetic SoundEvents (e.g. fire: frequent mid-high erratic onsets; abyss: rare huge low onsets; sugar: frequent tiny
high onsets) for several seconds each, and screenshots each. LOOK at your screenshots (Read the PNGs) and iterate until
each one is beautiful and unmistakably conveys its character to a stranger. Report the screenshot paths.`,
  },
  {
    key: 'studies',
    prompt: `${COMMON}
YOUR JOB: (a) original "character study" demo pieces, (b) a Rachmaninoff reference recording for evaluation.

Files you own: src/audio/studies.ts (+ helpers in src/audio/instruments.ts if you like), scripts/render-studies.mjs,
scripts/reference/* (python synth for the Rachmaninoff reference), tests/studies.test.ts (optional).

(a) The existing v1 demo (src/audio/demo.ts, class DemoGroove with start()/stop()/playing/position/title) is a
synthesized groove. Write a set of ORIGINAL short pieces (each ~60–90 s, looping or ending gracefully), synthesized
live with Web Audio, each composed to embody one character so users can immediately feel and compare the engine:
  1. "Ember" — erratic like fire: agitated, irregular rhythms, fast flickering string-like tremolo/ricochet figures,
     sudden accents and swells, minor/chromatic, mid-high register, crackle.
  2. "Basalt" — dark & blunt like Rachmaninoff: massive low piano-like chords (rich inharmonic piano synthesis: many
     partials with stretched tuning, hammer noise, long decays, una corda vs fff), slow, minor, bell-like tolling
     low octaves, heavy.
  3. "Sugar Glass" — whimsical, tiny & quick like the Nutcracker's Sugar Plum Fairy: celesta/music-box-like high
     tinkling (FM bell synthesis), staccato pizzicato bass, quick light runs, major/whimsical chromatic grace notes,
     quiet.
  4. "Mist" — serene: soft legato pads, slow, consonant, airy.
Make them genuinely musical (real voice-leading, phrases, dynamics), well-mixed (no clipping; use a compressor/
limiter), and CPU-light (schedule with lookahead like demo.ts). Export: export const STUDIES: { id, title, character
blurb (one line), create(ctx: AudioContext, destination: AudioNode) => { start(), stop(), playing, position,
title } }[] — the same shape DemoGroove has, so the engine can play them like the demo (keep DemoGroove working; you
may refactor demo.ts minimally to share the interface but don't break it).
scripts/render-studies.mjs: renders each study to WAV (e.g. ~45 s each) — e.g. via Playwright + a dev server
(\`npx vite --port 5181 --strictPort\`, kill by PID afterwards) running the study inside an OfflineAudioContext — into
${SCRATCH}/ref/studies/<id>.wav so the evaluation can analyze them. Listen-proxy check: report peak/RMS levels and
confirm no clipping, and look at spectrograms (ffmpeg -lavfi showspectrumpic=s=1024x512) of each render to confirm
the intended registers/densities (Read the PNG).
(b) Rachmaninoff reference: write a Python/numpy piano synthesizer (inharmonic partials with stretch, per-partial
decay, hammer noise, velocity-dependent brightness, sustain pedal, stereo off) in scripts/reference/ and render the
opening of Rachmaninoff's Prelude in C-sharp minor, Op. 3 No. 2 (public-domain composition, 1892) — the famous three
fff low octaves A–G♯–C♯, then the heavy chords — transcribe from your knowledge as faithfully as you can (~40–60 s;
the Lento opening and the start of the agitated section is a bonus). Also render a second dark/blunt reference if you
can (e.g. the opening of Rachmaninoff Piano Concerto No. 2's tolling chords, or Mussorgsky's "Great Gate"/"Bydło"
heavy low chords). Write them to ${SCRATCH}/ref/audio/rach_prelude_csharp_minor.wav (and others). Spectrogram-check
them too.`,
  },
]

phase('Build')
const results = await parallel(TASKS.map(t => () =>
  agent(t.prompt, { label: t.key, phase: 'Build', schema: REPORT }).then(r => ({ key: t.key, ...r }))
))
return results.filter(Boolean)
