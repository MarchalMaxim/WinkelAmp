// End-to-end check of the scripted visuals in the real app (system Chrome, real WebGL2):
//
//   node scripts/e2e-check.mjs <audio dir> [--port 5199] [--out <dir>] [--headed]
//
// <audio dir> holds the reference recordings the corpus was composed from (never
// committed): corpus/<id>.json is looked for as <id>.ogg / .wav (a '-' may be '_'),
// plus waltz.ogg (unscripted) and, if present, rach_concerto2.wav (unscripted, long).
// Checks (any failure exits 1):
//  - every corpus recording, dropped in as a file, is recognised: the badge says
//    "Scripted · <title>" (each load is also a track change);
//  - the prelude: a pp passage does not dim the picture, and after a seek the stage
//    shows the scene the script names for the new position;
//  - a switch to the demo or the mic while the prelude is still decoding leaves its
//    script behind (the study's own script or Live, never the prelude's), and the
//    prelude played again and left to decode is recognised;
//  - waltz.ogg runs Live, and the director changes scene at least once within 60 s;
//  - pause: the music clock stops, the picture freezes and dims; play brings it back;
//  - Classic (the no-WebGL2 fallback): each of its four scenes holds still on pause;
//  - played MIDI keys (winkel.note) cast the melody element and its head follows the key;
//  - the browser fingerprint of a 12-minute track takes < 3 s;
//  - no console errors or page exceptions.
// Stills of each stage go to --out (default: the OS temp folder).
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { createServer } = await import('vite');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? dflt : argv[i + 1];
};
const AUDIO = argv[0] && !argv[0].startsWith('--') ? path.resolve(argv[0]) : null;
if (!AUDIO || !existsSync(AUDIO)) {
  console.error('usage: node scripts/e2e-check.mjs <audio dir> [--port 5199] [--out <dir>] [--headed]');
  process.exit(1);
}
const PORT = Number(opt('port', 5199));
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'winkel-e2e')));
mkdirSync(OUT, { recursive: true });

const audio = (id) => [id, id.replace(/-/g, '_')].flatMap((s) => [`${s}.ogg`, `${s}.wav`]).map((f) => path.join(AUDIO, f)).find(existsSync);
const recordings = readdirSync(path.join(REPO, 'corpus'))
  .filter((f) => f.endsWith('.json') && !f.endsWith('.data.json'))
  .map((f) => JSON.parse(readFileSync(path.join(REPO, 'corpus', f), 'utf8').replace(/^﻿/, '')))
  .filter((s) => s.match?.kind === 'recording');

let failed = false;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed = true;
};
const note = (what) => console.log(`     ${what}`);
const errors = [];

const server = await createServer({ root: REPO, logLevel: 'error', server: { port: PORT, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  channel: 'chrome',
  headless: !argv.includes('--headed'),
  // A fake microphone (a test tone, permission granted) for the source-switch check.
  args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(`exception: ${e.message}`));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`http://localhost:${PORT}/legacy.html`);
  await page.waitForFunction(() => window.winkel, null, { timeout: 30000 });
  if ((await page.evaluate(() => window.winkel.mode())) !== 'stage') throw new Error('the app fell back to Classic (no WebGL2?)');

  // Time the app's own fingerprint on every decoded file (a listener beside the app's).
  await page.evaluate(async () => {
    const { fingerprint } = await import('/src/audio/fingerprint.ts');
    window.e2eFingerprints = [];
    window.winkel.engine.onTrackDecoded((t) => {
      const t0 = performance.now();
      fingerprint(t.mono, t.sampleRate);
      window.e2eFingerprints.push({ name: t.file.name, seconds: t.mono.length / t.sampleRate, ms: performance.now() - t0 });
    });
  });

  const w = (fn, arg) => page.evaluate(fn, arg);
  const badge = () => page.locator('#mode-name').innerText();
  const songTime = () => w(() => window.winkel.engine.songTime);
  const still = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
  /** Mean brightness (0..255) of the stage's last frame. */
  const luma = () => w(() => {
    const px = window.winkel.stage().pixels();
    let sum = 0;
    let n = 0;
    for (let i = 0; i < px.length; i += 4 * 7) {
      sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      n++;
    }
    return sum / n;
  });
  /** Mean absolute difference (0..255) between two stage frames `ms` apart. */
  const motion = (ms) => w(async (ms) => {
    const a = window.winkel.stage().pixels();
    await new Promise((r) => setTimeout(r, ms));
    const b = window.winkel.stage().pixels();
    let d = 0;
    for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
    return d / a.length;
  }, ms);
  const sleep = (ms) => page.waitForTimeout(ms);
  // The interface hides itself when idle: wake it before pressing play.
  const playPause = async () => {
    await page.mouse.move(600 + Math.random() * 40, 360);
    await sleep(300);
    await page.click('#play');
  };
  const load = async (file) => {
    await page.setInputFiles('#file-input', file);
    // (engine.tracks is private: read here only to know the new file is the one playing.)
    await page.waitForFunction((name) => {
      const e = window.winkel.engine;
      return e.tracks[e.state.trackIndex]?.name === name && e.state.playing && e.state.duration > 0;
    }, path.basename(file), { timeout: 10000 });
  };

  // ---- Every corpus recording is recognised ----
  for (const s of recordings) {
    const file = audio(s.id);
    if (!file) {
      check(false, `${s.id}: no recording for it in ${AUDIO}`);
      continue;
    }
    await load(file);
    const want = `Scripted · ${s.title}`;
    let got = '';
    for (let i = 0; i < 40 && got !== want; i++) {
      await sleep(250);
      got = await badge();
    }
    check(got === want, `${path.basename(file)} → "${got}"`);
    await sleep(1500);
    await still(`rec-${s.id}`);

    if (s.id === 'rach-prelude') {
      // The pp chorale (about 11–20 s): quiet music is still music, the picture must not dim.
      let lowest = 1;
      while ((await songTime()) < 20) {
        await sleep(200);
        const [t, dim] = await w(() => [window.winkel.engine.songTime, window.winkel.clock.dim]);
        if (t > 11.5) lowest = Math.min(lowest, dim);
      }
      check(lowest > 0.9, `the prelude's pp chorale keeps the picture lit (lowest dim ${lowest.toFixed(2)})`);

      // Seek into the climax: the stage shows the scene the script names there.
      await w(() => window.winkel.engine.seek(59 / window.winkel.engine.state.duration));
      await sleep(600);
      const r = await w(async (id) => {
        const { validateScript } = await import('/src/stage/script.ts');
        const { ScriptPlayer } = await import('/src/stage/player.ts');
        const script = (await import(`/corpus/${id}.json`)).default;
        const data = (await import(`/corpus/${id}.data.json`)).default;
        const v = validateScript(script);
        const t = window.winkel.engine.songTime;
        return { t, want: new ScriptPlayer(v.script, data).at(t).scene, got: window.winkel.directives().scene };
      }, s.id);
      check(r.got === r.want && r.got !== '', `after a seek to ${r.t.toFixed(1)} s the stage shows "${r.got}" (the script says "${r.want}")`);
    }
  }

  // ---- A switch to the demo or the mic while a file decodes: its script stays behind ----
  const prelude = recordings.find((s) => s.id === 'rach-prelude');
  const preludeFile = prelude && audio(prelude.id);
  if (preludeFile) {
    for (const to of ['demo', 'mic']) {
      const decoded = await w(() => window.e2eFingerprints.length);
      await page.setInputFiles('#file-input', preludeFile);
      // As soon as it plays: its decode (then the fingerprint lookup) is still running.
      await page.waitForFunction((name) => {
        const e = window.winkel.engine;
        return e.currentFile?.name === name && e.state.playing;
      }, path.basename(preludeFile), { timeout: 10000 });
      await w((to) => window.winkel.start(to), to);
      await sleep(7000);
      const r = await w(async () => {
        const { findByStudy } = await import('/src/stage/corpus.ts');
        const e = window.winkel.engine;
        const st = e.study;
        // A study shows its own script on its first pass (if the corpus has one); the mic and the groove run Live.
        const want = st && st.loop === 0 ? findByStudy(st.id, st.seed)?.script.title ?? null : null;
        return { source: e.source, study: st?.id ?? null, show: window.winkel.show(), want, badge: document.getElementById('mode-name').textContent };
      });
      const cancelled = (await w(() => window.e2eFingerprints.length)) === decoded;
      note(`switch to ${to}: the prelude's decode ${cancelled ? 'was dropped (the switch came first)' : 'reached the listeners first'}`);
      check(r.source === to && r.show === r.want && !r.badge.includes(prelude.title),
        `a switch to ${to} while the prelude decodes leaves its script behind (${r.study ?? r.source}: "${r.badge}")`);
    }
    // The same file, left to decode, is still recognised.
    await load(preludeFile);
    const want = `Scripted · ${prelude.title}`;
    let got = '';
    for (let i = 0; i < 40 && got !== want; i++) {
      await sleep(250);
      got = await badge();
    }
    check(got === want, `the prelude, played again and left to decode, is recognised ("${got}")`);
  }

  // ---- An unscripted recording: Live, and the director changes scene ----
  const waltz = path.join(AUDIO, 'waltz.ogg');
  if (!existsSync(waltz)) check(false, `no waltz.ogg in ${AUDIO}`);
  else {
    await load(waltz);
    const duration = await w(() => window.winkel.engine.state.duration);
    const scenes = [];
    const until = Math.min(60, duration - 0.5);
    while ((await songTime()) < until) {
      const [t, scene] = await w(() => [window.winkel.engine.songTime, window.winkel.directives().scene]);
      if (scene && scene !== scenes[scenes.length - 1]?.scene) scenes.push({ t: +t.toFixed(1), scene });
      if (t > 6 && t < 6.3) await still('live-waltz');
      await sleep(250);
      if (!(await w(() => window.winkel.engine.state.playing))) break;
    }
    check((await badge()) === 'Live' && (await w(() => window.winkel.show())) === null, `waltz.ogg runs Live ("${await badge()}")`);
    note(`scenes: ${scenes.map((s) => `${s.t} s ${s.scene}`).join(' → ')}`);
    check(scenes.length >= 2, `the director changed scene within ${until.toFixed(0)} s (${scenes.length - 1} change${scenes.length === 2 ? '' : 's'})`);

    // ---- Pause: the clock stops, the picture freezes and dims ----
    await w(() => window.winkel.engine.seek(20 / window.winkel.engine.state.duration));
    await sleep(3000);
    const lit = await luma();
    await playPause();
    const samples = [];
    for (let i = 0; i <= 12; i++) {
      samples.push(await w(() => ({ time: window.winkel.clock.time, dim: window.winkel.clock.dim })));
      await sleep(500);
    }
    // A pause stops the clock at once (within a frame or two of the click).
    const a = samples[1];
    const z = samples[samples.length - 1];
    note(`after pause, every 0.5 s: music time ${samples.map((s) => (s.time - samples[0].time).toFixed(2)).join(' ')}`);
    note(`after pause, every 0.5 s: dim ${samples.map((s) => s.dim.toFixed(2)).join(' ')}`);
    check(z.time - a.time < 0.01, `the music clock stops on pause (moved ${(z.time - a.time).toFixed(4)} s from 0.5 s to 6 s after it)`);
    check(z.dim < 0.2, `the picture dims (dim ${z.dim.toFixed(2)})`);
    const dark = await luma();
    check(dark < 0.35 * lit || lit < 4, `the frame darkens (brightness ${lit.toFixed(1)} → ${dark.toFixed(1)})`);
    const still2 = await motion(400);
    check(still2 < 0.5, `the frozen picture holds still (mean change ${still2.toFixed(3)} over 0.4 s)`);
    await still('paused-dim');

    // ---- MIDI: held keys cast the melody element and its head follows the key ----
    // (stage.live and the melody's pts are private: read here only to see where its head is.)
    const head = () => w(() => {
      const st = window.winkel.stage();
      const m = [...st.live.values()].find((e) => e.type === 'melody');
      const pts = m ? m.pts.filter((p) => Number.isFinite(p.p)) : [];
      return { cast: st.info().cast, last: pts.length ? pts[pts.length - 1].p : null, dim: window.winkel.clock.dim };
    });
    for (const key of [48, 84]) {
      await w((k) => window.winkel.note(k, 0.9), key);
      await sleep(3500);
      const h = await head();
      await still(`midi-${key}`);
      await w((k) => window.winkel.note(k, 0), key);
      check(h.cast.some((c) => c.endsWith(':melody')), `holding key ${key} casts the melody element (${h.cast.join(' ')})`);
      check(h.last !== null && Math.abs(h.last - key) < 1, `the melody head follows key ${key} (at ${h.last?.toFixed(1)})`);
      check(h.dim > 0.8, `played keys light the picture (dim ${h.dim.toFixed(2)})`);
      await sleep(800);
    }
    // With "Keys make sound" off a held key is heard by nobody: report what the picture does.
    await w(() => {
      const box = document.getElementById('midi-sound');
      box.checked = false;
      box.dispatchEvent(new Event('change'));
    });
    await sleep(6000);
    await w(() => window.winkel.note(60, 0.9));
    const quiet = [];
    for (let i = 0; i < 5; i++) {
      await sleep(1000);
      quiet.push(await w(() => window.winkel.clock.dim));
    }
    await w(() => window.winkel.note(60, 0));
    note(`a silent held key (sound off), dim each second: ${quiet.map((d) => d.toFixed(2)).join(' ')}`);
    await w(() => {
      const box = document.getElementById('midi-sound');
      box.checked = true;
      box.dispatchEvent(new Event('change'));
    });

    await playPause();
    await sleep(2500);
    const back = await w(() => window.winkel.clock.dim);
    check(back > 0.9, `play brings the picture back (dim ${back.toFixed(2)})`);

    // ---- Classic (the fallback without WebGL2): every scene holds still on pause ----
    // Read from the canvas itself (the CSS dim doesn't count). Held means exactly the last frame
    // before the pause: not moving on, and not collapsing its trails into a brighter still.
    const classicFrame = () => w(() => {
      const c = document.getElementById('stage');
      window.e2eClassic = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    });
    /** Mean change (0..255 per channel) since the last classicFrame(). */
    const classicChange = () => w(() => {
      const a = window.e2eClassic;
      const c = document.getElementById('stage');
      const b = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let d = 0;
      for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      return d / (a.length * 0.75);
    });
    await w(() => window.winkel.chooseScene('classic'));
    for (const scene of ['bloom', 'swarm', 'ribbons', 'pulse']) {
      await w((scene) => window.winkel.applyLook({ ...window.winkel.getLook(), scene }), scene);
      await w(() => window.winkel.engine.seek(12 / window.winkel.engine.state.duration));
      await sleep(2500);
      await classicFrame();
      await sleep(400);
      const moving = await classicChange();
      // Read the frame and pause in one task: no frame is drawn in between.
      await w(() => {
        const c = document.getElementById('stage');
        window.e2eClassic = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        return window.winkel.engine.togglePlay();
      });
      await sleep(2500);
      const held = await classicChange();
      await still(`classic-${scene}-paused`);
      check(held < 0.05 && moving > 4 * held,
        `Classic ${scene} holds its last frame on pause (mean change: ${moving.toFixed(2)} over 0.4 s playing, ${held.toFixed(3)} over 2.5 s paused)`);
      await playPause();
    }
    await w(() => window.winkel.chooseScene('auto'));
  }

  // ---- A long unscripted file: Live; the fingerprint of 12 minutes takes < 3 s ----
  const concerto = path.join(AUDIO, 'rach_concerto2.wav');
  if (existsSync(concerto)) {
    await load(concerto);
    await sleep(6000);
    check((await badge()) === 'Live', `rach_concerto2.wav (not in the corpus) runs Live ("${await badge()}")`);
  }
  const fps = await w(() => window.e2eFingerprints);
  for (const f of fps) note(`fingerprint ${f.name}: ${f.seconds.toFixed(0)} s of audio in ${f.ms.toFixed(0)} ms`);
  const long = await w(async () => {
    const { fingerprint } = await import('/src/audio/fingerprint.ts');
    const rate = 44100;
    const mono = new Float32Array(12 * 60 * rate);
    let x = 0x2545f491;
    for (let i = 0; i < mono.length; i++) {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      mono[i] = 0.3 * Math.sin(i * 0.031 * (1 + ((i / rate) | 0) % 7)) + 0.05 * ((x >>> 0) / 2 ** 32 - 0.5);
    }
    const t0 = performance.now();
    fingerprint(mono, rate);
    return performance.now() - t0;
  });
  check(long < 3000, `the fingerprint of a 12-minute track takes ${(long / 1000).toFixed(2)} s`);
} finally {
  await browser.close();
  await server.close();
}

check(errors.length === 0, `no console errors${errors.length ? `:\n  ${errors.join('\n  ')}` : ''}`);
console.log(`stills in ${OUT}`);
process.exit(failed ? 1 : 0);
