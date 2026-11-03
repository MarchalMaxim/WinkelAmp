// Throwaway: screenshots of index.html with only some tools on, a few seconds after each start time.
//   node lab/shot.mjs <tools comma list> <start times comma list> <out dir> [play seconds = 4]
// Needs the Vite dev server on http://localhost:5173 (or LAB_BASE=http://localhost:<port>). Also prints any page errors.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const [tools, times, out, secs = '4'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // Other agents write tool files in parallel: block Vite's live reload so a shot run isn't reloaded mid-way.
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  // Never post test state to the save server: it would overwrite the user's saved ratings and knobs.
  await page.route('http://localhost:5174/**', (r) => r.fulfill({ status: 200, body: 'ok' }));
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR:', m.text()));
  await page.goto(`${process.env.LAB_BASE ?? 'http://localhost:5173'}/lab/index.html?only=${tools}&song=${process.env.SONG ?? "prelude"}`);
  await page.waitForFunction(() => document.getElementById('a').readyState >= 3, null, { timeout: 20000 });
  for (const t of times.split(',').map(Number)) {
    await page.evaluate((t) => { const a = document.getElementById('a'); a.currentTime = t; a.play(); }, t);
    for (let i = 1; i <= Number(secs) * 2; i++) {
      await page.waitForTimeout(500);
      if (i % 2 === 0 || i === Number(secs) * 2) {
        const file = path.join(out, `${tools.replace(/,/g, '+')}-${t}-${i / 2}s.png`);
        await page.locator('#c').screenshot({ path: file });
      }
    }
    const errs = await page.evaluate(() => [...document.querySelectorAll('.err')].map((e) => e.textContent));
    if (errs.length) console.log('TOOL ERRORS:', errs);
    console.log('fps-ish check done for', t);
  }
  console.log('shots in', out);
} finally {
  await browser.close();
}
