// Renders the character studies (src/audio/studies.ts) to WAV, offline, in a
// real browser: Vite serves the TypeScript, system Chrome runs each study in an
// OfflineAudioContext, and we report peak/RMS and write spectrograms.
//
//   node scripts/render-studies.mjs [outDir] [--seconds 45] [--only ember,mist] [--live]
//
// outDir defaults to <OS temp>/studies-out, outside the repo: rendered audio is never committed.
// --seconds 0 renders each piece's full length. --live also plays every study
// for a few seconds in a real AudioContext to check the live scheduler.
// Needs ffmpeg on PATH for the spectrograms (skipped otherwise).
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 5194);

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const OUT = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : path.join(os.tmpdir(), 'studies-out'));
const SECONDS = Number(opt('--seconds', 45));
const ONLY = opt('--only', '')?.split(',').filter(Boolean) ?? [];
const LIVE = args.includes('--live');
const SR = 48000;
await mkdir(OUT, { recursive: true });

// A blank page on the dev server's origin, so the page can import modules
// without booting the app (which other work-in-progress might break).
const blank = {
  name: 'render-blank',
  configureServer(server) {
    server.middlewares.use('/__render', (_req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end('<!doctype html><meta charset="utf-8"><title>render</title><body></body>');
    });
  },
};
const server = await createServer({
  root: REPO,
  configFile: false,
  logLevel: 'warn',
  plugins: [blank],
  server: { port: PORT, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[page exception]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('[page error]', m.text()));
  await page.goto(`http://localhost:${PORT}/__render`);
  const ids = await page.evaluate(async () => (await import('/src/audio/studies.ts')).STUDIES.map((s) => s.id));

  for (const id of ids) {
    if (ONLY.length && !ONLY.includes(id)) continue;
    const r = await page.evaluate(
      async ({ id, seconds, sr }) => {
        const { STUDIES } = await import('/src/audio/studies.ts');
        const study = STUDIES.find((s) => s.id === id);
        const full = study.compose(1).length; // only for reporting
        const len = Math.ceil((seconds > 0 ? seconds : full) * sr);
        const ctx = new OfflineAudioContext(2, len, sr);
        const t0 = performance.now();
        const player = study.create(ctx, ctx.destination);
        player.start();
        const scheduleMs = performance.now() - t0;
        // A stuck render (e.g. a suspend that never resumes) must fail loudly, not hang.
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('render timed out')), 180000));
        const buf = await Promise.race([ctx.startRendering(), timeout]);
        const renderMs = performance.now() - t0;
        const L = buf.getChannelData(0);
        const R = buf.getChannelData(1);
        // Levels, overall and per second (to see the dynamics), and samples at/over full scale.
        // The rig's soft-clip ceiling makes ≥ 0.999 impossible by construction, so also count
        // samples in its knee (> 0.7): that is where it starts to bend the waveform.
        let peak = 0, sum = 0, over = 0, knee = 0;
        const perSec = [];
        for (let s = 0; s < L.length; s += sr) {
          let acc = 0;
          const e = Math.min(L.length, s + sr);
          for (let i = s; i < e; i++) {
            const a = Math.abs(L[i]), b = Math.abs(R[i]);
            peak = Math.max(peak, a, b);
            if (a >= 0.999 || b >= 0.999) over++;
            if (a > 0.7 || b > 0.7) knee++;
            acc += L[i] * L[i] + R[i] * R[i];
          }
          sum += acc;
          perSec.push(10 * Math.log10(acc / (2 * (e - s)) + 1e-12));
        }
        // 16-bit stereo WAV.
        const n = L.length;
        const bytes = new Uint8Array(44 + n * 4);
        const dv = new DataView(bytes.buffer);
        const str = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
        str(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
        dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
        dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true);
        dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 4, true);
        for (let i = 0; i < n; i++) {
          dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
          dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
        }
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return {
          wav: btoa(bin),
          seconds: n / sr,
          full,
          peakDb: 20 * Math.log10(peak),
          rmsDb: 10 * Math.log10(sum / (2 * n)),
          over,
          knee,
          perSec,
          scheduleMs,
          renderMs,
        };
      },
      { id, seconds: SECONDS, sr: SR },
    );
    const file = path.join(OUT, `${id}.wav`);
    await writeFile(file, Buffer.from(r.wav, 'base64'));
    const loud = [...r.perSec].sort((a, b) => b - a);
    console.log(
      `${id.padEnd(7)} ${r.seconds.toFixed(1)} s of ${r.full.toFixed(1)} s | peak ${r.peakDb.toFixed(2)} dBFS, ` +
        `rms ${r.rmsDb.toFixed(1)} dBFS, loudest 1 s ${loud[0].toFixed(1)}, quietest ${loud[loud.length - 1].toFixed(1)}, ` +
        `${r.over} samples ≥ 0.999, ${r.knee} in the soft-clip knee (${((100 * r.knee) / r.seconds / SR).toFixed(3)} %) | render ${(r.renderMs / 1000).toFixed(2)} s (${(r.seconds / (r.renderMs / 1000)).toFixed(0)}× realtime, schedule ${r.scheduleMs.toFixed(0)} ms)`,
    );
    console.log(`        per-second rms: ${r.perSec.map((x) => x.toFixed(0)).join(' ')}`);
    try {
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-lavfi', 'showspectrumpic=s=1024x512:fscale=log', path.join(OUT, `${id}.png`)]);
    } catch (e) {
      console.log('        (no spectrogram:', e.message.split('\n')[0], ')');
    }
  }

  if (LIVE) {
    // Live scheduler check: play each study for 4 s in a real AudioContext and meter it.
    for (const id of ids) {
      if (ONLY.length && !ONLY.includes(id)) continue;
      const r = await page.evaluate(async (id) => {
        const { STUDIES } = await import('/src/audio/studies.ts');
        const ctx = new AudioContext();
        await ctx.resume();
        const an = ctx.createAnalyser();
        an.fftSize = 2048;
        const sink = ctx.createGain();
        sink.gain.value = 0; // silent in the headless browser
        an.connect(sink).connect(ctx.destination);
        const p = STUDIES.find((s) => s.id === id).create(ctx, an);
        const t0 = performance.now();
        p.start();
        const startMs = performance.now() - t0;
        const buf = new Float32Array(2048);
        let peak = 0, frames = 0, longTasks = 0, last = performance.now();
        while (performance.now() - t0 < 4000) {
          await new Promise((r) => setTimeout(r, 20));
          const now = performance.now();
          if (now - last > 80) longTasks++;
          last = now;
          an.getFloatTimeDomainData(buf);
          for (const x of buf) peak = Math.max(peak, Math.abs(x));
          frames++;
        }
        const out = { playing: p.playing, position: p.position, peak, frames, longTasks, startMs, title: p.title };
        p.stop();
        await new Promise((r) => setTimeout(r, 600));
        an.getFloatTimeDomainData(buf);
        let after = 0;
        for (const x of buf) after = Math.max(after, Math.abs(x));
        await ctx.close();
        return { ...out, afterStop: after, stopped: !p.playing };
      }, id);
      console.log(
        `live ${id.padEnd(7)} "${r.title}" playing=${r.playing} position=${r.position.toFixed(2)} s peak=${r.peak.toFixed(3)} ` +
          `start() took ${r.startMs.toFixed(0)} ms, ticks >80 ms apart: ${r.longTasks}, after stop peak=${r.afterStop.toFixed(4)} stopped=${r.stopped}`,
      );
    }
  }
} finally {
  await browser.close();
  await server.close();
}
