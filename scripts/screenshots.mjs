// Drives WinkelAmp in the system Chrome (real WebGL2), checks the minimal
// interface, and saves screenshots (and optionally a short video tour) to docs/media.
//
//   npm run shots [-- --video] [-- --port 5198] [-- --headed] [-- --seam]
//
// --seam adds a slow check (a study's whole first pass, ~1 min): across the loop
// seam, engine.study moves to loop 1 with loopStart at the first pass's length, the
// study's local time restarts near 0, and a show that was scripted on the first
// pass (if the corpus has one for that study) hands over to Live.
//
// --video records a separate ~50 s tour of the stage (a scripted study, Live, the
// drawer, Classic) and saves it as docs/media/tour.mp4. Frames come from Chrome's
// screencast and are encoded (H.264) by the system ffmpeg: Playwright's own video
// recorder needs a separate ffmpeg download.
//
// It starts its own Vite dev server. Checks (any failure exits 1):
//  - welcome → Demo → next: Basalt plays its corpus script ("Scripted · <title>");
//  - the demo groove (no script) plays on the stage, the badge says "Live" with
//    mood words, the Tweak drawer is closed and the Calm ↔ Wild slider is visible;
//  - holding a library scene pauses the show ("Live · paused"), the badge resumes it;
//  - a Classic scene switches to the v1 renderer;
//  - ?classic=1 (no stage, as without WebGL2) shows Classic and says so in a toast;
//  - no console errors or page exceptions anywhere.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
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
const SEAM = process.argv.includes('--seam');
const FALLBACK = "Your browser can't run the full stage — showing Classic";
/** The title of corpus/<id>.json, or null when the corpus has no such script. */
const scriptTitle = (id) => {
  const f = path.join(REPO, 'corpus', `${id}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')).title : null;
};
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
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

  // ---- A scripted show: Basalt (second in the demo playlist) plays its corpus script ----
  await page.click('[data-start="demo"]');
  await page.waitForTimeout(1500);
  await page.click('#next');
  await page.waitForFunction(() => document.getElementById('track-title').textContent.includes('Basalt'), null, { timeout: 5000 });
  check(true, 'next steps the demo playlist to Basalt');
  const basalt = scriptTitle('basalt');
  await page.waitForTimeout(7000);
  await wake();
  await page.waitForTimeout(300);
  const want = basalt ? `Scripted · ${basalt}` : 'Live';
  check((await text('#mode-name')) === want, `Basalt's badge says "${want}" (${await text('#mode-name')})`);
  await shot('12-scripted-basalt');

  // ---- The stage, live: the demo groove (last in the playlist, no script) ----
  await page.click('#next');
  await page.click('#next');
  await page.click('#next');
  await page.waitForFunction(() => document.getElementById('track-title').textContent.includes('groove'), null, { timeout: 5000 });
  let words = '';
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    words = (await text('#mode-words')).replace(/^\s*·\s*/, '');
    if (words && !/silent/.test(words)) break;
  }
  await wake();
  await page.waitForTimeout(300);
  check((await text('#mode-name')) === 'Live', `badge says Live (${(await text('#mode-badge')).replace(/\s+/g, ' ')})`);
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
  await context.close();

  if (VIDEO) {
    // ---- The tour: its own recording, mostly the stage ----
    const tc = await browser.newContext({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
    const tp = await tc.newPage();
    watch(tp, 'tour');
    await tp.addInitScript(() => localStorage.clear());
    await tp.goto(URL);
    // Chrome sends a frame whenever the page repaints: keep each with its time.
    const frames = [];
    const cdp = await tc.newCDPSession(tp);
    cdp.on('Page.screencastFrame', (f) => {
      frames.push({ t: f.metadata.timestamp, jpeg: Buffer.from(f.data, 'base64') });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 960, maxHeight: 600 });
    await tp.waitForTimeout(1500);
    // Sugar Glass, scripted: the theme, then the B section's scene at 15.9 s.
    await tp.click('[data-start="demo"]');
    await tp.click('#next');
    await tp.click('#next');
    for (let i = 0; i < 9; i++) {
      await tp.mouse.move(480 + (i % 2) * 10, 300);
      await tp.waitForTimeout(2000);
    }
    // Basalt, scripted: the motto's shocks.
    await tp.mouse.move(470, 300);
    await tp.click('#prev');
    await tp.waitForTimeout(9000);
    // The groove, Live: the director casts by what it hears.
    await tp.mouse.move(480, 300);
    await tp.click('#prev');
    await tp.click('#prev');
    await tp.waitForTimeout(8000);
    // The drawer: hold a library scene, then hand the stage back.
    await tp.mouse.move(470, 300);
    await tp.click('#panel-toggle');
    await tp.waitForTimeout(1200);
    await tp.click('[data-stage="Cathedral"]');
    await tp.waitForTimeout(4000);
    // Classic: the v1 scenes, two keys.
    await tp.click('#panel-close');
    for (const k of ['1', '3']) {
      await tp.keyboard.press(k);
      await tp.waitForTimeout(3000);
    }
    await tp.evaluate(() => window.winkel.chooseScene('auto'));
    await tp.waitForTimeout(3000);
    await cdp.send('Page.stopScreencast');
    await tc.close();
    await encode(frames, path.join(OUT, 'tour.mp4'));
    console.log(`saved tour.mp4 (${frames.length} frames)`);
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

  if (SEAM) {
    // ---- A study across its loop seam: the shortest one, played through its first pass ----
    const ctx3 = await browser.newContext({ viewport: { width: 960, height: 600 } });
    const sp = await ctx3.newPage();
    watch(sp, 'seam');
    await sp.goto(URL);
    await sp.waitForTimeout(600);
    const lengths = await sp.evaluate(async () => {
      const { STUDIES } = await import('/src/audio/studies.ts');
      return STUDIES.map((s) => s.compose(s.seed).length);
    });
    const k = lengths.indexOf(Math.min(...lengths));
    await sp.click('[data-start="demo"]');
    for (let i = 0; i < k; i++) await sp.click('#next');
    const probe = () => sp.evaluate(() => {
      const w = window.winkel;
      const st = w.engine.study;
      return st && { loop: st.loop, loopStart: st.loopStart, local: w.engine.songTime - st.loopStart, badge: document.getElementById('mode-name').textContent };
    });
    let before = null;
    let after = null;
    const deadline = Date.now() + (lengths[k] + 15) * 1000;
    while (Date.now() < deadline) {
      await sp.waitForTimeout(250);
      const p = await probe();
      if (!p) continue;
      if (p.loop === 0) before = p;
      else if (p.loop === 1) {
        // The probe can land between the seam and the app's next frame, which is when the
        // show hands over: look again a few frames later.
        await sp.waitForTimeout(300);
        after = await probe();
        break;
      }
    }
    console.log(`seam: study ${k + 1} (${lengths[k].toFixed(1)} s); last pass-0 probe ${JSON.stringify(before)}; first pass-1 probe ${JSON.stringify(after)}`);
    check(!!before && !!after, 'the study reached its second pass');
    if (before && after) {
      check(Math.abs(after.loopStart - lengths[k]) < 0.2, `loopStart (${after.loopStart.toFixed(2)} s) is the first pass's length`);
      check(after.local >= 0 && after.local < 1, `local song time restarted near 0 (${after.local.toFixed(2)} s)`);
      check(after.badge === 'Live', `the second pass runs Live (badge "${after.badge}", first pass "${before.badge}")`);
    }
    await ctx3.close();
  }
} finally {
  await browser.close();
  await server.close();
}

/**
 * Screencast frames (irregular times) → a 25 fps H.264 MP4: each output frame is the
 * latest screencast frame at its time. MP4 plays wherever a README or a chat shows video.
 */
async function encode(frames, file, fps = 25) {
  if (frames.length < 2) throw new Error('the screencast sent no frames');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', file],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => {
    ff.on('error', rej);
    ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited with ${code}`))));
  });
  const t0 = frames[0].t;
  const n = Math.floor((frames[frames.length - 1].t - t0) * fps);
  for (let k = 0, i = 0; k <= n; k++) {
    while (i + 1 < frames.length && frames[i + 1].t - t0 <= k / fps) i++;
    if (!ff.stdin.write(frames[i].jpeg)) await new Promise((res) => ff.stdin.once('drain', res));
  }
  ff.stdin.end();
  await done;
}

check(errors.length === 0, `no console errors${errors.length ? `:\n  ${errors.join('\n  ')}` : ''}`);
process.exit(failed ? 1 : 0);
