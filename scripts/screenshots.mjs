// Drives WinkelAmp in the system Chrome (real WebGL2), checks the minimal
// interface, and saves screenshots (and optionally a short video) to docs/media.
//
//   npm run shots [-- --video] [-- --port 5198] [-- --headed]
//
// It starts its own Vite dev server. Checks (any failure exits 1):
//  - welcome → Demo → next: Basalt plays on the stage, the badge says "Live" with
//    mood words, the Tweak drawer is closed and the Calm ↔ Wild slider is visible;
//  - holding a library scene pauses the show ("Live · paused"), the badge resumes it;
//  - a Classic scene switches to the v1 renderer;
//  - ?classic=1 (no stage, as without WebGL2) shows Classic and says so in a toast;
//  - no console errors or page exceptions anywhere.
import { createRequire } from 'node:module';
import { mkdir, rename, readdir, rm } from 'node:fs/promises';
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
const PORT = Number(arg('port', 5198));
const URL = `http://localhost:${PORT}/`;
const OUT = path.join(REPO, 'docs/media');
const VIDEO = process.argv.includes('--video');
const FALLBACK = "Your browser can't run the full stage — showing Classic";
await mkdir(OUT, { recursive: true });

const server = await createServer({ root: REPO, logLevel: 'error', server: { port: PORT, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  channel: 'chrome',
  headless: !process.argv.includes('--headed'),
  args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

let failed = false;
const errors = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed = true;
};
const watch = (page, name) => {
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${name}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${name}] exception: ${e.message}`));
};

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ...(VIDEO ? { recordVideo: { dir: path.join(OUT, 'raw'), size: { width: 1440, height: 900 } } } : {}),
  });
  const page = await context.newPage();
  watch(page, 'app');
  await page.addInitScript(() => localStorage.clear());
  await page.goto(URL);
  await page.waitForTimeout(800);

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log('saved', name);
  };
  const text = (sel) => page.locator(sel).innerText();
  // A Classic look (the v1 scenes): applying a scene switches to Classic.
  const look = (patch) => page.evaluate((p) => {
    const w = window.winkel;
    w.applyLook({ ...w.getLook(), ...p }, 'scene');
  }, patch);
  // Keep the interface visible for the shots.
  const wake = () => page.mouse.move(700 + Math.random() * 20, 450);
  const visible = (sel) => page.locator(sel).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    let o = 1;
    for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && o > 0.5;
  });

  await shot('01-welcome');

  // ---- The stage, live: Basalt (second in the demo playlist) ----
  await page.click('[data-start="demo"]');
  await page.waitForTimeout(1500);
  await page.click('#next');
  await page.waitForFunction(() => document.getElementById('track-title').textContent.includes('Basalt'), null, { timeout: 5000 });
  check(true, 'next steps the demo playlist to Basalt');
  let words = '';
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    words = (await text('#mode-words')).replace(/^\s*·\s*/, '');
    if (words && !/silent/.test(words)) break;
  }
  await wake();
  await page.waitForTimeout(300);
  check((await text('#mode-name')) === 'Live', `badge says Live (${await text('#mode-badge')})`);
  check(!!words && !/silent/.test(words), `badge carries the mood words ("${words}")`);
  check(await page.evaluate(() => window.winkel.mode()) === 'stage', 'the stage is the picture');
  check(await page.evaluate(() => document.body.classList.contains('panel-closed')), 'the Tweak drawer starts closed');
  check(!(await visible('#panel')), 'the drawer is not on screen');
  check(await visible('#wild'), 'Calm ↔ Wild is visible');
  check((await text('#panel-toggle')).trim() === 'Tweak', 'the drawer toggle says Tweak');
  const cast = await page.evaluate(() => window.winkel.stage().info().cast);
  check(cast.length > 0, `the director cast something (${cast.join(' ')})`);
  await shot('09-stage-live');

  await page.click('#panel-toggle');
  await page.waitForTimeout(700);
  await wake();
  check(await visible('#panel'), 'Tweak opens the drawer');
  await shot('10-tweak-drawer');

  // Holding a library scene pauses the show; the badge gives it back.
  await page.click('[data-stage="Cathedral"]');
  await page.waitForTimeout(300);
  check((await text('#mode-name')) === 'Live · paused', `a held scene pauses the show (${await text('#mode-name')})`);
  await page.click('#mode-badge');
  await page.waitForTimeout(300);
  check((await text('#mode-name')) === 'Live', 'the badge resumes the show');

  // ---- Classic: the v1 scenes, from the drawer ----
  await page.click('[data-scene="bloom"]');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => window.winkel.mode()) === 'classic', 'a Classic scene switches to the v1 renderer');
  check(await visible('#stage') && !(await visible('#stage-gl')), 'Classic canvas shown, stage canvas hidden');
  await page.click('#panel-close');
  await page.waitForTimeout(3000);
  await wake();
  await shot('02-bloom');

  await look({ scene: 'swarm', palette: 'sunset' });
  await page.waitForTimeout(3500);
  await wake();
  await shot('03-swarm-sunset');

  await look({ scene: 'ribbons', palette: 'ocean', mirror: 2 });
  await page.waitForTimeout(3500);
  await wake();
  await shot('04-ribbons-ocean-mirror');

  await look({ scene: 'pulse', palette: 'notes', mirror: 1 });
  await page.waitForTimeout(3500);
  await wake();
  await shot('05-pulse-notes');

  await look({ scene: 'bloom', palette: 'neon', mirror: 8, drift: 0.8, trails: 0.8 });
  await page.click('#panel-toggle');
  await page.click('#patch summary');
  await page.waitForTimeout(3500);
  await wake();
  await shot('06-kaleidoscope-patchbay');

  // Paint with sound: a drag across the canvas, interface hidden.
  await page.click('#patch summary');
  await page.click('#panel-close');
  await look({ scene: 'swarm', palette: 'notes', mirror: 6, drift: 0.3, trails: 0.75 });
  await page.keyboard.press('h');
  await page.mouse.move(520, 300);
  await page.mouse.down();
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    await page.mouse.move(720 + Math.cos(a) * 260, 450 + Math.sin(a * 2) * 160);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  await shot('07-painting-fullscreen');
  await page.keyboard.press('h');

  await page.keyboard.press('?');
  await page.waitForTimeout(400);
  await shot('08-help');
  await page.keyboard.press('Escape');

  if (VIDEO) {
    // A tour for the video: back to the stage, then the Classic scenes and surprises.
    await page.evaluate(() => window.winkel.chooseScene('auto'));
    await page.waitForTimeout(6000);
    for (const k of ['1', '2', '3', '4']) {
      await page.keyboard.press(k);
      await page.waitForTimeout(2500);
    }
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('r');
      await page.waitForTimeout(2500);
    }
  }
  await context.close();

  if (VIDEO) {
    const raw = path.join(OUT, 'raw');
    const [file] = await readdir(raw);
    await rename(path.join(raw, file), path.join(OUT, 'tour.webm'));
    await rm(raw, { recursive: true });
    console.log('saved tour.webm');
  }

  // ---- No stage (as without WebGL2): Classic, and a toast that says so ----
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const fb = await ctx2.newPage();
  watch(fb, 'classic=1');
  await fb.goto(`${URL}?classic=1`);
  await fb.waitForTimeout(800);
  await fb.click('[data-start="demo"]');
  await fb.waitForTimeout(600);
  const toast = await fb.evaluate(() => {
    const el = document.getElementById('toast');
    return { text: el.textContent, shown: el.classList.contains('show') };
  });
  check(toast.shown && toast.text === FALLBACK, `the fallback toast shows ("${toast.text}")`);
  check(await fb.evaluate(() => window.winkel.mode()) === 'classic', 'without a stage the picture is Classic');
  check(await fb.evaluate(() => window.winkel.stage() === null), 'no Stage was created');
  await fb.mouse.move(700, 450);
  await fb.screenshot({ path: path.join(OUT, '11-classic-fallback.png') });
  console.log('saved 11-classic-fallback');
  await ctx2.close();
} finally {
  await browser.close();
  await server.close();
}

check(errors.length === 0, `no console errors${errors.length ? `:\n  ${errors.join('\n  ')}` : ''}`);
process.exit(failed ? 1 : 0);
