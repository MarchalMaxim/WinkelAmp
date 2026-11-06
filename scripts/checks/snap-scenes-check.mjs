// Proves the Liebesleid and Rachmaninoff concerto 2 scenes draw the same pixels before and after a change.
//   npm run snap-scenes-check [-- --write] [-- --base http://localhost:5300] [--headed]
// Each show is rendered through render.html (the frame-by-frame page): for every sample time t, renderSeek(t - 4, 1), then
// renderTo in 1 s calls up to t, then renderFrameHash() (an FNV hash of the canvas pixels). --write saves
// { hashes: { show: { t: hash } }, errors } to docs/mockups/snap/baseline.json; without it the run is compared to that file.
// Needs the dev server for this worktree (default http://localhost:5300) and system Chrome.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { checker, ROOT } from '../lib/studio-session.mjs';

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write'), HEADED = argv.includes('--headed');
const bi = argv.indexOf('--base');
const BASE = (bi >= 0 ? argv[bi + 1] : 'http://localhost:5300').replace(/\/$/, '');
const BASELINE = path.join(ROOT, 'docs', 'mockups', 'snap', 'baseline.json');
const SHOWS = {
  liebesleid: [12, 18, 27, 45, 49, 70, 100, 168, 177, 182, 192, 200, 210, 235, 240, 290],
  'rach-concerto-2': [8, 38, 43, 45, 52, 60, 75, 81, 85, 90, 100, 120, 128, 135, 138, 142, 160],
};

// --disable-accelerated-2d-canvas: Chrome's GPU 2D canvas is not bit-stable on blurred fills (1-2 pixels flip by 1 between runs),
// while the software canvas is. Slower (about 2.5 s a sample), but the hashes then repeat exactly.
// --use-angle=swiftshader (+ --enable-unsafe-swiftshader, which it needs): WebGL (gliss's fluid, fireworks) on the real GPU
// (ANGLE / D3D11) is not bit-stable either: the same WebGL calls with the same arguments gave different pixels from run to run
// (rach-concerto-2 @ 90 s, gliss c14). SwiftShader runs WebGL in software, deterministically; both shows take about 3 min.
const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true, headless: !HEADED, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--disable-accelerated-2d-canvas', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const hashes = {}, errors = {};
try {
  for (const [id, times] of Object.entries(SHOWS)) {
    const t0 = Date.now();
    const show = JSON.parse(readFileSync(path.join(ROOT, 'shows', `${id}.json`), 'utf8'));
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route(/localhost:5174/, (r) => r.abort());
    await page.route(new RegExp(`/api/shows/${encodeURIComponent(show.id ?? id)}$`), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(show) }));
    await page.goto(`${BASE}/render.html?show=${encodeURIComponent(show.id ?? id)}&hz=60&scale=1`);
    await page.waitForFunction(() => window.renderReady === true || !!window.renderFailed, null, { timeout: 120_000 });
    const failed = await page.evaluate(() => window.renderFailed ?? null);
    if (failed) throw new Error(`${id}: render.html failed: ${failed}`);
    hashes[id] = {};
    for (const t of times) {
      hashes[id][t] = await page.evaluate((t) => {
        window.renderSeek(t - 4, 1);
        for (let s = t - 3; s < t; s++) window.renderTo(s);
        window.renderTo(t);
        return window.renderFrameHash();
      }, t);
      // (one evaluate per time: the page steps at 60 Hz inside each 1 s renderTo)
    }
    errors[id] = await page.evaluate(() => ({ ...window.renderErrors }));
    console.log(`${id}: ${times.length} times in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    await page.close();
  }
} finally { await browser.close(); }

const result = { hashes, errors };
if (WRITE) {
  mkdirSync(path.dirname(BASELINE), { recursive: true });
  writeFileSync(BASELINE, JSON.stringify(result, null, 2) + '\n');
  console.log(`baseline written: ${path.relative(ROOT, BASELINE)}`);
  for (const [id, h] of Object.entries(hashes)) console.log(id, JSON.stringify(h));
  for (const [id, e] of Object.entries(errors)) if (Object.keys(e).length) console.log(`widget errors in ${id}:`, JSON.stringify(e));
  process.exit(0);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const { check, finish } = checker();
for (const [id, h] of Object.entries(hashes))
  for (const [t, hash] of Object.entries(h))
    check(`${id} @ ${t} s`, base.hashes?.[id]?.[t] === hash, `${hash} vs baseline ${base.hashes?.[id]?.[t]}`);
for (const [id, e] of Object.entries(errors)) check(`${id}: no widget errors`, Object.keys(e).length === 0, JSON.stringify(e));
process.exit(finish('snap-scenes-check'));
