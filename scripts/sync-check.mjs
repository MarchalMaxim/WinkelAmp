// Sync check: do scripted cues land on the music you hear, through a seek and a
// pause/resume? Plays a rendered study WAV as a dropped file through AudioEngine,
// with a script that flashes white on known onsets of the score, and measures the
// time from when each onset is heard to when the canvas shows its flash.
//
//   node scripts/sync-check.mjs [--wav <basalt.wav>] [--port 5197] [--headed] [--skew ms]
//
// --skew shifts the song time the script player sees (a deliberately wrong clock):
// the check must then report that shift and fail, which shows it measures something.
//
// The WAV is scripts/render-studies.mjs's Basalt (seed 3, the study's own; rendered
// into the OS temp dir if --wav is not given). Its onsets are the score's times +
// 0.1 s (ScorePlayer.start() schedules from currentTime + 0.1).
//
// The measurement does not trust songTime (that would be circular):
//  - heard: an AudioWorklet on the engine's bus records what actually went through
//    the graph, stamped with context frames; each onset is found in it by
//    cross-correlating the decoded file around the onset, and its context time is
//    mapped to performance.now() with ctx.getOutputTimestamp() (the device's output
//    clock, so output latency is included);
//  - shown: every animation frame reads back the stage's centre pixel after
//    rendering; the flash is the first bright frame, stamped with the rAF time.
// Pass: every measured cue within ±50 ms, with cues measured before the seek, after
// it, and after the resume. The rAF time is when the frame is drawn; display
// scan-out adds about one more frame, which this does not see.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { createServer } = await import('vite');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? dflt : process.argv[i + 1];
};
const PORT = Number(arg('port', 5197));
const SKEW = Number(arg('skew', 0)) / 1000;
let WAV = arg('wav', '');
if (!WAV) {
  const dir = path.join(os.tmpdir(), 'winkelamp-eval', 'studies');
  WAV = path.join(dir, 'basalt.wav');
  if (!existsSync(WAV)) execFileSync('node', [path.join(REPO, 'scripts/render-studies.mjs'), dir, '--seconds', '0', '--only', 'basalt'], { stdio: 'inherit' });
}
const wavBytes = readFileSync(WAV);

// A blank page plus the WAV, on the dev server's origin (no repo HTML needed).
const routes = {
  name: 'sync-routes',
  configureServer(server) {
    server.middlewares.use('/__sync/audio.wav', (_req, res) => {
      res.setHeader('content-type', 'audio/wav');
      res.end(wavBytes);
    });
    server.middlewares.use('/__sync', (_req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end('<!doctype html><meta charset="utf-8"><title>sync</title><link rel="icon" href="data:,"><style>html,body{margin:0;background:#000}canvas{width:640px;height:360px;display:block}</style><canvas id="c"></canvas>');
    });
  },
};
const server = await createServer({ root: REPO, configFile: false, logLevel: 'warn', plugins: [routes], server: { port: PORT, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  channel: 'chrome',
  headless: !process.argv.includes('--headed'),
  // Uncapped animation frames: finer flash timing than 60 Hz where the GPU allows.
  args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log(`[page ${m.type()}]`, m.text()));
  page.on('pageerror', (e) => console.log('[page exception]', e.message));
  await page.goto(`http://localhost:${PORT}/__sync`);

  const setup = await page.evaluate(async (skew) => {
    const { AudioEngine } = await import('/src/audio/engine.ts');
    const { STUDIES } = await import('/src/audio/studies.ts');
    const { Stage } = await import('/src/stage/stage.ts');
    const { ScriptPlayer } = await import('/src/stage/player.ts');
    const { ARCHETYPES } = await import('/src/character/archetypes.ts');
    const { neutralDescriptors } = await import('/src/character/types.ts');

    // Flash cues: Basalt's onset clusters (any voice), ≥ 1.2 s from the previous cue.
    const basalt = STUDIES.find((s) => s.id === 'basalt');
    const score = basalt.compose(basalt.seed);
    const cues = [];
    for (const e of score.events) {
      const t = e.t + 0.1;
      if (e.vel < 0.3) continue;
      if (!cues.length || t - cues[cues.length - 1] >= 1.2) cues.push(t);
    }
    const script = {
      version: 1, id: 'sync', title: 'sync', duration: score.length + 0.1, match: { kind: 'recording' },
      scenes: { black: { look: { trails: 0, warp: 0 }, elements: [] } },
      timeline: [{ at: 0, scene: 'black', snap: false }, ...cues.map((at) => ({ at, snap: false, accent: { kind: 'flash', color: '#ffffff', strength: 1 } }))],
    };
    const player = new ScriptPlayer(script);

    const engine = new AudioEngine();
    const ctx = engine.ctx;
    const canvas = document.getElementById('c');
    const stage = new Stage(canvas, { seed: 1 });
    const gl = stage.gl;

    // What went through the graph, stamped with context frames.
    const code = `class Rec extends AudioWorkletProcessor {
      constructor() { super(); this.buf = new Float32Array(4096); this.n = 0; this.start = -1; }
      process(inputs) {
        const ch = inputs[0] && inputs[0][0];
        const len = ch ? ch.length : 128;
        if (this.start < 0) this.start = currentFrame;
        for (let i = 0; i < len; i++) this.buf[this.n++] = ch ? ch[i] : 0;
        if (this.n >= this.buf.length) { this.port.postMessage({ start: this.start, data: this.buf }); this.buf = new Float32Array(4096); this.n = 0; this.start = -1; }
        return true;
      }
    }
    registerProcessor('rec', Rec);`;
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'application/javascript' })));
    const rec = new AudioWorkletNode(ctx, 'rec', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
    const chunks = [];
    rec.port.onmessage = (e) => chunks.push(e.data);
    engine['bus'].connect(rec); // the harness reaches into the engine: the bus is what you hear (before volume)
    rec.connect(ctx.destination); // silent output; keeps the worklet pulled

    let decoded = null;
    engine.onTrackDecoded((t) => (decoded = t));

    const a = ARCHETYPES.abyss;
    const material = { ...a.material, palette: a.palette.map((c) => [...c]) };
    const d = neutralDescriptors();
    const log = [];
    const px = new Uint8Array(4);
    let running = true;
    let lastTs = 0;
    const frame = (ts) => {
      if (!running) return;
      const t = engine.songTime + skew;
      const f = engine.analyze();
      const out = ctx.getOutputTimestamp();
      const dt = lastTs ? (ts - lastTs) / 1000 : 0;
      lastTs = ts;
      stage.render({
        dt, musicDt: dt, clock: { time: t, drive: 1, dim: 1 }, f, d,
        character: { axes: { energy: 0.5, valence: 0.5, weight: 0.5, size: 0.5, agitation: 0.5, sharpness: 0.5, density: 0.5, warmth: 0.5, pace: 0.5 }, blend: [{ id: 'abyss', weight: 1 }], words: [], confidence: 1 },
        material, gesture: { x: 0, y: 0, angle: 0, swirl: 0, breath: 0.5, extra: [0, 0, 0, 0] },
        melody: { pitch: NaN, voiced: false, salience: 0, note: null, noteOn: false }, events: [],
        beat: { phase: 0, hit: false, strength: 0 }, chroma: f.chroma, wave: new Float32Array(2048), wild: 0.5,
        pointer: { x: 0.5, y: 0.5, dx: 0, dy: 0, down: false }, directives: player.at(t),
      });
      gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      log.push({ ts, t, ctxNow: ctx.currentTime, outCtx: out.contextTime, outPerf: out.performanceTime, b: (px[0] + px[1] + px[2]) / 3 });
      requestAnimationFrame(frame);
    };

    const blob = await (await fetch('/__sync/audio.wav')).blob();
    await engine.playFiles([new File([blob], 'basalt.wav', { type: 'audio/wav' })]);
    requestAnimationFrame(frame);

    window.sync = {
      engine,
      seek: (sec) => engine.seek(sec / engine.state.duration),
      toggle: () => engine.togglePlay(),
      stop() {
        running = false;
        engine.state.playing && engine.togglePlay();
      },
      analyse(marks) {
        const sr = ctx.sampleRate;
        if (!decoded) return { error: 'the track was never decoded (onTrackDecoded)' };
        if (decoded.sampleRate !== sr) return { error: `decoded at ${decoded.sampleRate} Hz, context at ${sr}` };
        // The recording as one array over context frames.
        const f0 = chunks[0].start;
        const f1 = chunks[chunks.length - 1].start + 4096;
        const R = new Float32Array(f1 - f0);
        for (const c of chunks) R.set(c.data, c.start - f0);
        const W = decoded.mono;
        const pre = Math.round(0.1 * sr), len = Math.round(0.5 * sr);

        /** Context frame at which file time m went through the graph, near `guess` (ctx seconds), or null. */
        const locate = (m, guess) => {
          const s0 = Math.round(m * sr) - pre;
          if (s0 < 0 || s0 + len > W.length) return null;
          const T = W.subarray(s0, s0 + len);
          const g = Math.round(guess * sr) - f0 - pre;
          let best = -Infinity, bestK = -1;
          const corr = (k, step) => {
            let xy = 0, yy = 0, tt = 0;
            for (let i = 0; i < len; i += step) {
              const y = R[k + i];
              xy += T[i] * y;
              yy += y * y;
              tt += T[i] * T[i];
            }
            return yy > 0 && tt > 0 ? xy / Math.sqrt(yy * tt) : -Infinity;
          };
          for (let k = Math.max(0, g - sr); k < Math.min(R.length - len, g + sr); k += 8) {
            const c = corr(k, 4);
            if (c > best) [best, bestK] = [c, k];
          }
          if (bestK < 0) return null;
          let fine = bestK;
          best = -Infinity;
          for (let k = Math.max(0, bestK - 16); k <= Math.min(R.length - len, bestK + 16); k++) {
            const c = corr(k, 1);
            if (c > best) [best, fine] = [c, k];
          }
          return best > 0.9 ? { frame: f0 + fine + pre, corr: best } : null;
        };

        const results = [];
        for (const m of cues) {
          // Frames around this cue's song time; the flash is the first bright one after a dark one.
          const idx = log.findIndex((r) => r.t >= m - 0.4);
          if (idx < 1 || log[idx].t > m + 0.4) continue;
          let shown = null;
          for (let i = idx; i < log.length && log[i].t <= m + 0.6; i++) {
            if (log[i].b > 128 && log[i - 1].b < 64) {
              shown = log[i];
              break;
            }
          }
          const near = log[idx];
          const at = locate(m, near.ctxNow + (m - near.t));
          if (!at || !shown) {
            results.push({ cue: m, missing: !at ? 'audio' : 'flash' });
            continue;
          }
          const ctxT = at.frame / sr;
          // The output timestamp taken nearest that moment maps context time to performance time.
          let ref = log[0];
          for (const r of log) if (Math.abs(r.outCtx - ctxT) < Math.abs(ref.outCtx - ctxT)) ref = r;
          const heard = ref.outPerf + (ctxT - ref.outCtx) * 1000;
          const phase = marks.find((p) => shown.ts >= p.from && shown.ts < p.to)?.name ?? '?';
          results.push({ cue: m, phase, offsetMs: shown.ts - heard, corr: at.corr });
        }
        const gaps = log.slice(1).map((r, i) => r.ts - log[i].ts).sort((x, y) => x - y);
        return {
          results,
          sampleRate: sr,
          outputLatency: ctx.outputLatency,
          baseLatency: ctx.baseLatency,
          frames: log.length,
          frameMs: { median: gaps[gaps.length >> 1], p90: gaps[Math.floor(gaps.length * 0.9)] },
        };
      },
    };
    return { cues: cues.length, sr: ctx.sampleRate, backend: await engine.pcmReady };
  }, SKEW);
  console.log(`setup: ${setup.cues} flash cues, context ${setup.sr} Hz, PCM ${setup.backend}`);

  const now = () => page.evaluate(() => performance.now());
  const marks = [];
  const phase = async (name, ms) => {
    const from = await now();
    await wait(ms);
    marks.push({ name, from, to: await now() });
  };
  await phase('start', 9000);
  await page.evaluate(() => window.sync.seek(40));
  await phase('after seek', 7000);
  await page.evaluate(() => window.sync.toggle());
  await wait(1500);
  await page.evaluate(() => window.sync.toggle());
  await phase('after resume', 7000);
  await page.evaluate(() => window.sync.stop());
  const r = await page.evaluate((m) => window.sync.analyse(m), marks);
  if (r.error) {
    console.log('FAIL:', r.error);
    failed = true;
  } else {
    console.log(`latency: output ${(r.outputLatency * 1000).toFixed(1)} ms + base ${(r.baseLatency * 1000).toFixed(1)} ms; ${r.frames} frames, ${r.frameMs.median.toFixed(1)} ms median (p90 ${r.frameMs.p90.toFixed(1)})`);
    for (const x of r.results) {
      if (x.missing) console.log(`  cue ${x.cue.toFixed(2)} s: no ${x.missing} found (not measured)`);
      else console.log(`  cue ${x.cue.toFixed(2)} s  ${x.phase.padEnd(13)} flash − heard = ${x.offsetMs.toFixed(1).padStart(6)} ms  (corr ${x.corr.toFixed(3)})`);
    }
    const ok = r.results.filter((x) => !x.missing);
    for (const p of ['start', 'after seek', 'after resume']) {
      const xs = ok.filter((x) => x.phase === p).map((x) => x.offsetMs);
      if (!xs.length) {
        console.log(`FAIL: no cue measured ${p}`);
        failed = true;
        continue;
      }
      const worst = xs.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a));
      const bad = xs.filter((x) => Math.abs(x) > 50).length;
      console.log(`${bad ? 'FAIL' : 'ok  '} ${p.padEnd(13)} ${xs.length} cues, mean ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)} ms, worst ${worst.toFixed(1)} ms`);
      if (bad) failed = true;
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
