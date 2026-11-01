// Screenshots (and a benchmark) of the Living Canvas test harness, one per test
// Material, plus short motion sequences and a contact sheet. Starts its own Vite
// server and uses the system Chrome for real GPU WebGL2.
//
//   node scripts/living-shots.mjs [--out DIR] [--only fire,abyss] [--ev neutral] [--lowp]
//                                 [--blend] [--drag] [--motion] [--bench] [--seconds 5] [--port 5193]
//                                 [--level 0..4] [--ov aura:1,grain:0] [--tag name] [--presets engine]
//                                 [--replay run.json --at 20,45 --warm 8 --name sugarplum]
// --presets engine uses the character engine's real archetype Materials instead of the
// harness's test ones. --replay plays back a recorded run of the real chain (one
// harness ReplayFrame per 60 Hz frame) and shoots at the given times (seconds).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
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
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), 'living-shots')));
const PORT = Number(arg('port', 5193));
const EV = arg('ev', 'own');
const SECONDS = Number(arg('seconds', 5));
const W = Number(arg('w', 1280));
const H = Number(arg('h', 720));
const ALL = ['fire', 'abyss', 'sugar', 'mist', 'gold', 'storm', 'machine', 'lament'];
const ONLY = arg('only', '') ? arg('only', '').split(',') : ALL;
const PRESETS = arg('presets', 'test');
const REPLAY = arg('replay', '');
await mkdir(OUT, { recursive: true });

const server = await createServer({ root: REPO, logLevel: 'error', server: { port: PORT, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => console.log(`[page ${m.type()}]`, m.text()));
  page.on('pageerror', (e) => console.log('[page exception]', e.message));
  const q = `level=${arg('level', 3)}&seed=1${flag('lowp') ? '&lowp=1' : ''}${arg('ov', '') ? '&ov=' + arg('ov', '') : ''}`;
  await page.goto(`http://localhost:${PORT}/living-test.html?${q}`);
  await page.waitForFunction(() => window.harness, null, { timeout: 30000 });
  console.log('info', JSON.stringify(await page.evaluate(() => window.harness.info())));
  await page.evaluate(() => {
    window.harness.pause(true);
    window.harness.label(false);
  });
  const frames = Math.round(SECONDS * 60);
  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file });
    return file;
  };
  const suffix = `${PRESETS === 'engine' ? '-e' : ''}${EV === 'neutral' ? '-n' : ''}${flag('lowp') ? '-lowp' : ''}${arg('tag', '') ? '-' + arg('tag', '') : ''}`;

  if (flag('bench')) {
    // Own page at 1080p (or --bw/--bh/--dpr): every frame is followed by a 1-pixel
    // readPixels, which waits for the GPU, so this is real cost, not vsync.
    const bw = Number(arg('bw', 1920));
    const bh = Number(arg('bh', 1080));
    const bp = await browser.newPage({ viewport: { width: bw, height: bh }, deviceScaleFactor: Number(arg('dpr', 1)) });
    bp.on('pageerror', (e) => console.log('[page exception]', e.message));
    await bp.goto(`http://localhost:${PORT}/living-test.html?level=3&seed=1${flag('lowp') ? '&lowp=1' : ''}`);
    await bp.waitForFunction(() => window.harness, null, { timeout: 30000 });
    await bp.evaluate(() => window.harness.pause(true));
    for (const m of ['storm', 'fire', 'sugar']) {
      for (let level = 0; level <= 4; level++) {
        await bp.evaluate((m) => window.harness.set(m), m);
        const r = await bp.evaluate((l) => window.harness.bench(l, 150), level);
        const i = r.info;
        console.log(`bench ${m} L${level}: median ${r.median.toFixed(2)} ms, p90 ${r.p90.toFixed(2)} ms, throughput ${r.throughput.toFixed(2)} ms ` +
          `(sim ${i.sim.join('x')}, dye ${i.dye.join('x')}, render ${i.render.join('x')}, canvas ${i.canvas.join('x')})`);
      }
    }
    await bp.close();
  }

  const sheet = [];
  if (REPLAY) {
    const frames = JSON.parse(await readFile(REPLAY, 'utf8'));
    const name = arg('name', path.basename(REPLAY, '.json'));
    const warm = Number(arg('warm', 8));
    for (const at of arg('at', '20').split(',').map(Number)) {
      const from = Math.max(0, Math.round((at - warm) * 60));
      const to = Math.min(frames.length, Math.round(at * 60));
      await page.evaluate(([f, from, name]) => window.harness.replay(f, 0, name), [frames.slice(from, to + 12), from, name]);
      for (let done = 0; done < to - from; done += 60) await page.evaluate((n) => window.harness.advance(n), Math.min(60, to - from - done));
      sheet.push(await shot(`${name}-${at}${suffix}`));
      if (flag('motion')) {
        await page.evaluate(() => window.harness.advance(6));
        await shot(`${name}-${at}${suffix}-m1`);
      }
      console.log('shot', name, at);
    }
  }
  for (const m of REPLAY ? [] : ONLY) {
    await page.evaluate(([m, ev, p]) => window.harness.set(m, ev, 1, p), [m, EV, PRESETS]);
    // Advance in chunks so no single task runs too long.
    for (let done = 0; done < frames; done += 60) await page.evaluate((n) => window.harness.advance(n), Math.min(60, frames - done));
    sheet.push(await shot(`${m}${suffix}`));
    if (flag('motion')) {
      for (let i = 1; i <= 2; i++) {
        await page.evaluate(() => window.harness.advance(6));
        await shot(`${m}${suffix}-m${i}`);
      }
    }
    console.log('shot', m);
  }

  if (flag('blend')) {
    for (const spec of ['fire:0.5,abyss:0.5', 'sugar:0.5,mist:0.5', 'fire:0.3,storm:0.7']) {
      await page.evaluate(([m, ev, p]) => window.harness.set(m, ev, 1, p), [spec, EV, PRESETS]);
      for (let done = 0; done < frames; done += 60) await page.evaluate(() => window.harness.advance(60));
      await shot(`blend-${spec.replace(/[:.,]/g, '')}${suffix}`);
      console.log('shot', spec);
    }
  }

  if (flag('drag')) {
    // Painting: a few looping strokes over a calm material.
    await page.evaluate(() => window.harness.set('mist', 'own', 1));
    await page.evaluate(() => window.harness.pause(false));
    await page.mouse.move(W * 0.2, H * 0.6);
    await page.mouse.down();
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 3;
      await page.mouse.move(W * (0.5 + 0.3 * Math.cos(a)), H * (0.5 + 0.3 * Math.sin(a * 1.3)));
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(300);
    await shot(`drag${suffix}`);
    await page.evaluate(() => window.harness.pause(true));
    console.log('shot drag');
  }

  if (sheet.length > 1) {
    const cols = Math.min(4, sheet.length);
    const rows = Math.ceil(sheet.length / cols);
    const inputs = sheet.flatMap((f) => ['-i', f]);
    const filter = sheet.map((_, i) => `[${i}:v]scale=480:-1[s${i}]`).join(';') + ';' +
      sheet.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${sheet.length}:layout=` +
      sheet.map((_, i) => `${(i % cols) ? Array.from({ length: i % cols }, () => 'w0').join('+') : '0'}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, () => 'h0').join('+') : '0'}`).join('|') +
      `:fill=black`;
    const out = path.join(OUT, `sheet${REPLAY ? '-' + arg('name', path.basename(REPLAY, '.json')) : ''}${suffix}.png`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-frames:v', '1', out]);
    console.log('sheet', out, `${cols}x${rows}`);
  }
} finally {
  await browser.close();
  await server.close();
}
