/**
 * End-to-end check of the PCM tap and our own spectrum in a real browser.
 *
 *   node scripts/pcm-check.mjs [--work <dir>] [--port 5191] [--skip-build]
 *
 * Writes a tiny test page to <dir> (default: the OS temp dir) that imports the
 * engine from this repo, then — once on the Vite dev server and once on a
 * production build served by `vite preview` — for both PCM backends (worklet
 * and the AnalyserNode fallback):
 *   - plays a 440 Hz tone and pink-ish noise into `engine.input`,
 *   - checks the PcmSource reports the right frequency, level and sample clock,
 *   - compares our SpectrumAnalyser with a real AnalyserNode on the same signal
 *     (peak and noise-floor dB),
 *   - checks engine.analyze() / engine.descriptors react (level, register),
 *   - plays Chrome's fake microphone through engine.playMic() and checks the tap hears it.
 * Uses the system Chrome (real GPU/audio stack). Exit code 1 on any failure.
 */
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build, createServer, preview } from 'vite';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const PORT = Number(opt('--port', 5191));
const WORK = resolve(opt('--work', mkdtempSync(join(tmpdir(), 'wpcm-'))));
const PAGE = join(WORK, 'page');
const DIST = join(WORK, 'dist');

mkdirSync(PAGE, { recursive: true });
writeFileSync(
  join(PAGE, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>pcm check</title><script type="module" src="./main.ts"></script>`,
);
writeFileSync(
  join(PAGE, 'main.ts'),
  `
import { AudioEngine } from '@repo/src/audio/engine';
import { SpectrumAnalyser } from '@repo/src/audio/fft';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Frequency of the strongest bin, parabolically interpolated. */
function peakHz(m: Float32Array, sr: number, n: number) {
  let k = 1;
  for (let i = 1; i < m.length - 1; i++) if (m[i] > m[k]) k = i;
  const a = Math.log(m[k - 1]), b = Math.log(m[k]), c = Math.log(m[k + 1]);
  const s = (0.5 * (a - c)) / (a - 2 * b + c);
  return { hz: ((k + s) * sr) / n, bin: k };
}

(window as any).run = async (worklet: boolean) => {
  const out: Record<string, unknown> = {};
  const engine = new AudioEngine({ worklet });
  const ctx = engine.ctx;
  await ctx.resume();
  out.backend = await engine.pcmReady;
  out.sampleRate = ctx.sampleRate;
  // Keep analysing like the app does.
  let frames = 0;
  let stop = false;
  const loop = () => { if (stop) return; engine.analyze(); frames++; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  // Reference analyser on the very same signal.
  const ref = ctx.createAnalyser();
  ref.fftSize = 4096;
  ref.smoothingTimeConstant = 0;
  engine.input.connect(ref);
  const N = 4096;
  const ours = new SpectrumAnalyser(N, 0);
  const pcm = new Float32Array(N);
  const refDb = new Float32Array(N / 2);

  // 1) Tone: 440 Hz at amplitude 0.5 (−9 dBFS RMS).
  const osc = ctx.createOscillator();
  osc.frequency.value = 440;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  osc.connect(g).connect(engine.input);
  osc.start();
  await sleep(300);
  const w0 = engine.pcm.written, t0 = ctx.currentTime;
  await sleep(1500);
  const w1 = engine.pcm.written, t1 = ctx.currentTime;
  out.clockRatio = (w1 - w0) / ((t1 - t0) * ctx.sampleRate);
  engine.pcm.latest(pcm);
  ref.getFloatFrequencyData(refDb);
  let s = 0;
  for (const v of pcm) s += v * v;
  out.toneRms = Math.sqrt(s / N);
  const m = ours.process(pcm);
  const pk = peakHz(m, ctx.sampleRate, N);
  out.toneHz = pk.hz;
  out.tonePeakDbOurs = 20 * Math.log10(m[pk.bin]);
  let rk = 1;
  for (let i = 1; i < refDb.length; i++) if (refDb[i] > refDb[rk]) rk = i;
  out.tonePeakDbAnalyser = refDb[rk];
  const f = engine.extractor.features;
  out.level = f.level;
  out.note = f.note;
  out.registerMidi = engine.descriptors.register * 84 + 24;
  out.loudness = engine.descriptors.loudness;
  out.silence = engine.descriptors.silence;
  osc.stop();
  osc.disconnect();

  // 2) Noise floor: white noise at 0.1 RMS.
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.1 * Math.sqrt(3);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(engine.input);
  src.start();
  await sleep(600);
  let oursDb = 0, refSum = 0, count = 0;
  for (let rep = 0; rep < 20; rep++) {
    engine.pcm.latest(pcm);
    ref.getFloatFrequencyData(refDb);
    const mm = ours.process(pcm);
    for (let i = 100; i < 1500; i++) {
      oursDb += 20 * Math.log10(mm[i]);
      refSum += refDb[i];
      count++;
    }
    await sleep(50);
  }
  out.noiseDbOurs = oursDb / count;
  out.noiseDbAnalyser = refSum / count;
  src.stop();
  stop = true;
  out.frames = frames;
  await ctx.close();
  return out;
};
(window as any).mic = async () => {
  const engine = new AudioEngine();
  await engine.ctx.resume();
  const backend = await engine.pcmReady;
  const ok = await engine.playMic();
  const buf = new Float32Array(2048);
  const w0 = engine.pcm.written;
  let peakRms = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(50);
    engine.analyze();
    engine.pcm.latest(buf);
    let s = 0;
    for (const v of buf) s += v * v;
    peakRms = Math.max(peakRms, Math.sqrt(s / buf.length));
  }
  const out = { backend, ok, peakRms, advanced: engine.pcm.written - w0, source: engine.state.source };
  await engine.ctx.close();
  return out;
};
(window as any).ready = true;
`,
);

const alias = { '@repo': REPO };
const failures = [];
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: ${detail}`);
  if (!ok) failures.push(label);
};

async function runIn(url, label) {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  try {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(m.text()));
    page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
    await page.goto(url);
    await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
    for (const worklet of [true, false]) {
      const r = await page.evaluate((w) => window.run(w), worklet);
      console.log(`\n[${label}] worklet=${worklet}`, JSON.stringify(r, (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));
      const want = worklet ? 'worklet' : 'analyser';
      check('backend', r.backend === want, `${r.backend} (want ${want})`);
      check('sample clock', Math.abs(r.clockRatio - 1) < 0.03, `written advances at ${r.clockRatio.toFixed(3)} × sampleRate`);
      check('tone frequency', Math.abs(r.toneHz - 440) < 1, `${r.toneHz.toFixed(2)} Hz`);
      check('tone level', Math.abs(r.toneRms - 0.5 / Math.SQRT2) < 0.01, `RMS ${r.toneRms.toFixed(4)} (want 0.3536)`);
      check('peak dB vs AnalyserNode', Math.abs(r.tonePeakDbOurs - r.tonePeakDbAnalyser) < 0.5, `${r.tonePeakDbOurs.toFixed(2)} vs ${r.tonePeakDbAnalyser.toFixed(2)} dB`);
      check('noise floor vs AnalyserNode', Math.abs(r.noiseDbOurs - r.noiseDbAnalyser) < 1.5, `${r.noiseDbOurs.toFixed(2)} vs ${r.noiseDbAnalyser.toFixed(2)} dB`);
      check('features react', r.level > 0.3 && r.note === 9, `level ${r.level.toFixed(2)}, note ${r.note} (A = 9)`);
      check('descriptors react', Math.abs(r.registerMidi - 69) < 3 && r.silence < 0.2, `register ≈ MIDI ${r.registerMidi.toFixed(1)}, silence ${r.silence.toFixed(2)}, loudness ${r.loudness.toFixed(2)}`);
    }
    const mic = await page.evaluate(() => window.mic());
    console.log(`
[${label}] mic`, JSON.stringify(mic));
    check('mic is analysed', mic.ok && mic.source === 'mic' && mic.peakRms > 0.01 && mic.advanced > 0, `playMic ${mic.ok}, peak RMS ${mic.peakRms.toFixed(3)}, ${mic.advanced} samples`);
    const tapLog = logs.filter((l) => l.includes('[audio] PCM tap'));
    console.log(`  console: ${tapLog.join(' | ')}`);
    check('engine logged worklet backend', tapLog.some((l) => l.endsWith('worklet')), tapLog[0] ?? 'none');
    const errors = logs.filter((l) => /error/i.test(l));
    check('no page errors', errors.length === 0, errors.join(' | ') || 'none');
  } finally {
    await browser.close();
  }
}

const common = { root: PAGE, configFile: false, logLevel: 'warn', resolve: { alias } };

console.log(`work dir: ${WORK}`);
console.log('\n== dev server ==');
const server = await createServer({ ...common, server: { port: PORT, strictPort: true, fs: { allow: [REPO, WORK] } } });
await server.listen();
try {
  await runIn(`http://localhost:${PORT}/`, 'dev');
} finally {
  await server.close();
}

if (!args.includes('--skip-build')) {
  console.log('\n== production build ==');
  await build({ ...common, base: './', build: { outDir: DIST, emptyOutDir: true } });
  const pv = await preview({ ...common, build: { outDir: DIST }, preview: { port: PORT, strictPort: true } });
  try {
    await runIn(`http://localhost:${PORT}/`, 'build');
  } finally {
    await new Promise((r) => pv.httpServer.close(r));
  }
}

console.log(failures.length ? `\n${failures.length} check(s) FAILED: ${failures.join(', ')}` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
