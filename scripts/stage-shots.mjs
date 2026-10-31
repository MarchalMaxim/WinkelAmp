// Screenshots of the stage test harness (stage-test.html), one pair per case, a
// contact sheet, the silence check and a 1080p frame-time benchmark. Starts its own
// Vite server and uses the system Chrome for real GPU WebGL2.
//
//   node scripts/stage-shots.mjs [--out DIR] [--only melody-ribbon,abyss] [--at 4.4,7.8]
//                                [--no-bench] [--no-silence] [--port 5196] [--level 3]
//
// Silence check: after music, 2 s of held silence (musicDt = 0, no events, flat
// waveform, dim held at 1 — the clock's dimming is tested in tests/clock.test.ts),
// then two captures 1 s apart; fewer than 1 % of pixels may change by more than
// 8/255 in any channel. Noisy silence: the same, but the feed keeps sending noise
// events, onsets, beat hits and a noise waveform; no pixel may change. Track change:
// song time restarts at 0 on the same stage; the picture must match a fresh stage's.
// --no-silence skips all three. Melody under a mirror: for melody-ribbon and melody-m2,
// -m4, -m6, -m12, the screen is lit where the thread's layout puts its head (the note
// sounding now). Exits non-zero when any check fails.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
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
const flag = (name) => process.argv.includes(`--${name}`);
// Outside the repo by default, so screenshots never end up in a commit.
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), 'stage-shots')));
const PORT = Number(arg('port', 5196));
const LEVEL = Number(arg('level', 3));
const AT = arg('at', '4.4,7.8').split(',').map(Number);
const W = 1280;
const H = 720;
await mkdir(OUT, { recursive: true });

const server = await createServer({ root: REPO, logLevel: 'error', server: { port: PORT, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist'] });
let failed = false;
try {
  const open = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log(`[page ${m.type()}]`, m.text()));
    page.on('pageerror', (e) => console.log('[page exception]', e.message));
    await page.goto(`http://localhost:${PORT}/stage-test.html?level=${LEVEL}&seed=7&label=0`);
    await page.waitForFunction(() => window.harness, null, { timeout: 30000 });
    await page.evaluate(() => window.harness.pause(true));
    return page;
  };
  const page = await open(W, H);
  console.log('info', JSON.stringify(await page.evaluate(() => window.harness.info())));
  const all = await page.evaluate(() => window.harness.cases);
  const only = arg('only', '') ? arg('only', '').split(',') : all;
  // Advance in 1 s chunks so no single task runs too long.
  const advanceTo = async (t) => {
    const now = (await page.evaluate(() => window.harness.info())).t;
    for (let x = Math.min(t, now + 1); ; x = Math.min(t, x + 1)) {
      await page.evaluate((x) => window.harness.advanceTo(x), x);
      if (x >= t) break;
    }
  };
  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file });
    return file;
  };

  const sheet = [];
  for (const c of only) {
    await page.evaluate((c) => window.harness.set(c), c);
    for (const [i, t] of AT.entries()) {
      await advanceTo(t);
      sheet.push(await shot(`${c}-${String.fromCharCode(97 + i)}`));
    }
    if (c === 'melody-ribbon') {
      // The stroke's height across the screen at the end of the scale (t = 4 s, before the leap).
      await page.evaluate(() => window.harness.set('melody-ribbon'));
      await advanceTo(3.98);
      const tr = await page.evaluate(() => window.harness.trace(40));
      console.log('melody trace @3.98 s (height per column, left → right):', tr.map((v) => (v === null ? '  - ' : v.toFixed(2))).join(' '));
      const lit = tr.filter((v) => v !== null);
      let rises = 0;
      for (let i = 1; i < lit.length; i++) if (lit[i] >= lit[i - 1] - 0.005) rises++;
      const ok = lit.length > 10 && rises / (lit.length - 1) > 0.9 && lit[lit.length - 1] - lit[0] > 0.1;
      console.log(`melody tracks the scale: ${ok ? 'PASS' : 'FAIL'} (${lit.length} lit columns, ${rises}/${lit.length - 1} non-falling, span ${(lit[lit.length - 1] - lit[0]).toFixed(2)})`);
      if (!ok) failed = true;
    }
    console.log('shot', c);
  }

  // The melody's head under each mirror: on screen, where the thread's layout puts the note
  // sounding now (the held E4, 4.55–7 s), the picture must be lit. A mirror shows only part
  // of the frame, and used to fold the head away (mirror 2 kept x ≤ 0.5, the head was at 0.8).
  for (const [c, mirror] of [['melody-ribbon', 1], ['melody-m2', 2], ['melody-m4', 4], ['melody-m6', 6], ['melody-m12', 12]]) {
    if (!only.includes(c)) continue;
    await page.evaluate((c) => window.harness.set(c), c);
    await advanceTo(6);
    const r = await page.evaluate(async (mirror) => {
      const { melodyLayout, pitchHeight } = await import('/src/stage/elements/melody.ts');
      const [w, h] = window.harness.info().render;
      const [x, y] = melodyLayout('full', mirror, w / h)(0, pitchHeight(64));
      return { x, y, lit: window.harness.lumaAt(x, y) };
    }, mirror);
    const ok = r.lit > 100;
    if (!ok) failed = true;
    console.log(`melody head under mirror ${mirror}: luma ${r.lit.toFixed(0)} at (${r.x.toFixed(3)}, ${r.y.toFixed(3)}) → ${ok ? 'PASS' : 'FAIL'}`);
  }

  if (sheet.length > 1) {
    const cols = Math.min(AT.length * 2, sheet.length);
    const rows = Math.ceil(sheet.length / cols);
    const inputs = sheet.flatMap((f) => ['-i', f]);
    const filter = sheet.map((_, i) => `[${i}:v]scale=320:-1[s${i}]`).join(';') + ';' +
      sheet.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${sheet.length}:layout=` +
      sheet.map((_, i) => `${(i % cols) ? Array.from({ length: i % cols }, () => 'w0').join('+') : '0'}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, () => 'h0').join('+') : '0'}`).join('|') +
      `:fill=black`;
    const out = path.join(OUT, 'sheet.png');
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-frames:v', '1', out]);
    console.log('sheet', out, `${cols}x${rows}`);
  }

  if (!flag('no-silence')) {
    for (const c of ['all', 'abyss', 'sugar', 'mist', 'accents', 'casket', 'cut-m4', 'drives']) {
      await page.evaluate((c) => window.harness.set(c), c);
      await advanceTo(4.3);
      await page.evaluate(() => window.harness.silence(120));
      await page.evaluate(() => window.harness.capture());
      await shot(`silence-${c}-0`);
      await page.evaluate(() => window.harness.silence(60));
      await shot(`silence-${c}-1`);
      const d = await page.evaluate(() => window.harness.diff(8));
      const ok = d.changed < 0.01;
      if (!ok) failed = true;
      console.log(`silence ${c}: ${(d.changed * 100).toFixed(3)} % of pixels changed (largest channel change ${d.max}/255) → ${ok ? 'PASS' : 'FAIL'}`);
    }
    // A noisy room: the clock is frozen, but the feed keeps reporting noise events, onsets,
    // beat hits and a noise waveform. Nothing may change: not one pixel over 8/255.
    for (const c of ['all', 'sugar', 'abyss', 'wave-line', 'sparks-stars', 'pulse-rings', 'casket', 'drives']) {
      await page.evaluate((c) => window.harness.set(c), c);
      await advanceTo(4.3);
      await page.evaluate(() => window.harness.silence(120));
      await page.evaluate(() => window.harness.capture());
      await page.evaluate(() => window.harness.noise(60));
      await shot(`noise-${c}`);
      const d = await page.evaluate(() => window.harness.diff(8));
      const ok = d.changed === 0;
      if (!ok) failed = true;
      console.log(`noisy silence ${c}: ${(d.changed * 100).toFixed(3)} % of pixels changed (largest channel change ${d.max}/255) → ${ok ? 'PASS' : 'FAIL'}`);
    }
  }

  // Track change: clock.time drops back to 0 on the same stage. After 30 silent frames the
  // picture must match a fresh stage's after the same 30 frames: no stale rings, notes, trails.
  if (!flag('no-silence')) {
    for (const c of ['sugar', 'all', 'melody-ribbon', 'pulse-rings', 'abyss', 'casket']) {
      await page.evaluate((c) => window.harness.set(c), c);
      await advanceTo(6);
      await page.evaluate(() => window.harness.newTrack());
      await page.evaluate(() => window.harness.silence(30));
      await page.evaluate(() => window.harness.capture());
      await shot(`track-${c}`);
      await page.evaluate((c) => window.harness.set(c), c);
      await page.evaluate(() => window.harness.silence(30));
      const d = await page.evaluate(() => window.harness.diff(8));
      const ok = d.changed === 0;
      if (!ok) failed = true;
      console.log(`track change ${c}: ${(d.changed * 100).toFixed(3)} % of pixels differ from a fresh stage (largest channel change ${d.max}/255) → ${ok ? 'PASS' : 'FAIL'}`);
    }
  }

  // snapshot() and context loss (the app's fallback hook), on a throwaway page.
  {
    const lp = await open(640, 360);
    await lp.evaluate(() => window.harness.set('sugar'));
    await lp.evaluate(() => window.harness.advanceTo(2));
    const size = await lp.evaluate(() => window.harness.snapshotSize());
    const lost = await lp.evaluate(() => window.harness.loseContext());
    const ok = size > 10000 && lost.fired && !lost.threw;
    if (!ok) failed = true;
    console.log(`snapshot ${size} bytes; context lost → onContextLost ${lost.fired ? 'fired' : 'NOT fired'}${lost.threw ? ', render threw ' + lost.threw : ', render after loss is a no-op'} → ${ok ? 'PASS' : 'FAIL'}`);
    await lp.close();
  }

  if (!flag('no-bench')) {
    const bp = await open(1920, 1080);
    for (const c of ['all', 'abyss', 'sugar', 'mist', 'kaleido', 'fluid-living', 'melody-ribbon', 'casket']) {
      await bp.evaluate((c) => window.harness.set(c), c);
      const r = await bp.evaluate(() => window.harness.bench(150));
      const ok = r.median < 8;
      console.log(`bench ${c} @1920x1080: median ${r.median.toFixed(2)} ms, p90 ${r.p90.toFixed(2)} ms (render ${r.info.render.join('x')}) → ${ok ? 'PASS' : 'SLOW'}`);
    }
    await bp.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (failed) {
  console.log('FAILED');
  process.exitCode = 1;
}
