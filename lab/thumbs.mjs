// A still of each widget for the pickers: lab/thumbs/<id>.webp, 256×144, kept in git (no recording in them, about 8 KB each).
//
//   npm run widget-thumbs [-- <id> <id> ...] [--base http://localhost:5173] [--jobs 6]
//
// Needs the Vite dev server (npm run dev) and system Chrome. Each widget runs in the lab's render mode (no audio, seeded, the
// song clock stepped by hand), alone at its default knobs, through a busy stretch of the Prelude; of the frames looked at, the
// one with the most going on is kept. A widget that stays dark alone only cuts into what is below it (the casket, pixel sort):
// it is shown over Rorschach. Says which ones it did that for, and any it could not make.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const LAB = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(LAB, 'thumbs');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i < 0 ? dflt : argv[i + 1]; };
const named = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const BASE = opt('base', 'http://localhost:5173'), JOBS = Number(opt('jobs', 6));
const SONG = 'prelude', START = 118, SECS = 16, FPS = 20, LOOK_EVERY = 2, DARK = 3.5, UNDER = 'rorschach';

const all = readdirSync(path.join(LAB, 'tools')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
const ids = named.length ? named : all;
mkdirSync(OUT, { recursive: true });

/** Steps one widget (or a stack) through the stretch; returns the best frame's webp and how much is on it. */
async function still(page, only) {
  await page.goto(`${BASE}/lab/index.html?render=1&only=${encodeURIComponent(only)}&song=${SONG}`);
  await page.waitForFunction(() => window.renderReady === true, null, { timeout: 60000 });
  return page.evaluate(async ({ START, SECS, FPS, LOOK_EVERY }) => {
    const c = document.getElementById('c'), o = document.createElement('canvas'); o.width = 256; o.height = 144;
    const g = o.getContext('2d', { willReadFrequently: true });
    window.renderSeek(START, 1);
    let best = null;
    for (let k = 1; k <= SECS * FPS; k++) {
      window.renderTo(START + k / FPS);
      if (k < 6 * FPS || k % (LOOK_EVERY * FPS)) continue;   // it needs a few seconds to get going
      g.drawImage(c, 0, 0, 256, 144);
      const d = g.getImageData(0, 0, 256, 144).data;
      let sum = 0, sq = 0; const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { const y = 0.3 * d[i] + 0.6 * d[i + 1] + 0.1 * d[i + 2]; sum += y; sq += y * y; }
      const mean = sum / n, spread = Math.sqrt(Math.max(0, sq / n - mean * mean)), score = spread + mean * 0.3;
      if (!best || score > best.score) best = { score, mean, spread, webp: o.toDataURL('image/webp', 0.72) };
    }
    return { ...best, errors: Object.values(window.renderErrors ?? {}) };
  }, { START, SECS, FPS, LOOK_EVERY });
}

const browser = await chromium.launch({ channel: 'chrome' });
const over = [], failed = [];
const queue = [...ids];
await Promise.all(Array.from({ length: JOBS }, async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // Never post test state to the save server: it would overwrite the user's saved ratings and knobs.
  await page.route('http://localhost:5174/**', (r) => r.fulfill({ status: 200, body: 'ok' }));
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  for (let id = queue.shift(); id; id = queue.shift()) {
    try {
      let r = await still(page, id);
      if (r.mean < DARK && id !== UNDER) { r = await still(page, `${UNDER},${id}`); over.push(id); }
      if (r.errors.length) throw new Error(String(r.errors[0]));
      const bytes = Buffer.from(r.webp.split(',')[1], 'base64');
      writeFileSync(path.join(OUT, `${id}.webp`), bytes);
      console.log(`${id}: ${Math.round(bytes.length / 1024)} KB, brightness ${r.mean.toFixed(0)}, contrast ${r.spread.toFixed(0)}`);
    } catch (e) { failed.push(`${id} (${e.message.split('\n')[0]})`); console.log(`${id}: FAILED`); }
  }
  await page.close();
}));
await browser.close();
if (over.length) console.log(`\nDark alone, shown over ${UNDER}: ${over.join(', ')}`);
if (failed.length) { console.log(`\nCould not make: ${failed.join('; ')}`); process.exitCode = 1; }
console.log(`\n${ids.length - failed.length} of ${ids.length} stills in lab/thumbs`);
