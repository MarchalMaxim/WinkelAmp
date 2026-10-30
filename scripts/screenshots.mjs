// Drives WinkelAmp in a headless browser with the demo groove and saves
// screenshots (and a short video) to docs/media.
//
//   npm run dev            # in one terminal
//   npm run shots          # in another (needs Playwright + Chromium)
import { createRequire } from 'node:module';
import { mkdir, rename, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(require.resolve('playwright', { paths: [process.env.NODE_PATH ?? '', '/opt/node-tools/node_modules'] }));
}

const URL = process.env.URL ?? 'http://localhost:5173/';
const OUT = path.resolve('docs/media');
const VIDEO = process.argv.includes('--video');
await mkdir(OUT, { recursive: true });

const browser = await playwright.chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  ...(VIDEO ? { recordVideo: { dir: path.join(OUT, 'raw'), size: { width: 1440, height: 900 } } } : {}),
});
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('[page error]', m.text()));
page.on('pageerror', (e) => console.log('[page exception]', e.message));
await page.addInitScript(() => localStorage.clear());
await page.goto(URL);
await page.waitForTimeout(800);

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('saved', name);
};
const look = (patch) => page.evaluate((p) => {
  const w = window.winkel;
  w.applyLook({ ...w.getLook(), ...p });
}, patch);
// Keep the interface visible for the shots.
const wake = () => page.mouse.move(700 + Math.random() * 20, 450);

await shot('01-welcome');
await page.click('[data-start="demo"]');
await page.waitForTimeout(5000);
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
await page.click('#patch summary');
await page.waitForTimeout(3500);
await wake();
await shot('06-kaleidoscope-patchbay');

// Paint with sound: a drag across the canvas, interface hidden.
await page.click('#patch summary');
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
  // A tour for the video: scenes and surprises.
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
await browser.close();

if (VIDEO) {
  const raw = path.join(OUT, 'raw');
  const [file] = await readdir(raw);
  await rename(path.join(raw, file), path.join(OUT, 'tour.webm'));
  await rm(raw, { recursive: true });
  console.log('saved tour.webm');
}
