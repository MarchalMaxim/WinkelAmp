// Frame CPU/submission costs on two busy passages, using the lab's normal 60 Hz renderer.
// No pixels are read during timing: optional images are taken only after the last measured frame.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), HZ = 60;
const PASSAGES = [{ song: 'chopin-winter-wind', start: 206 }, { song: 'rite-sacrificial-dance', start: 174 }];
const options = { base: 'http://localhost:5200', seconds: '2', rounds: '3', out: 'lab/speed.md' };
const known = new Set(['base', 'seconds', 'rounds', 'ids', 'out', 'json', 'images']), args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help' || args[i] === '-h') {
    console.log(`npm run widgets-speed -- [--base http://localhost:5200] [--ids squares,fireworks]
  [--seconds 2] [--rounds 3] [--out lab/speed.md] [--json renders/widgets-speed.json]
  [--images lab/showcase/speed-before]

Without --ids, measures every widget registered in lab/index.html. Each round uses a
fresh page, default knobs and seed 1, with at least five seconds of warm-up (or its
longer lab/demos.json warm-up). The two passages start at Winter Wind 206s and Rite174s.
Timing covers renderTo's CPU work and GPU command submission, not completed GPU work.
Optional PNGs are captured after timing the final round of each passage. No audio plays.`);
    process.exit(0);
  }
  const key = args[i].replace(/^--/, '');
  if (!args[i].startsWith('--') || !known.has(key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`unknown or incomplete option: ${args[i]}`);
  options[key] = args[++i];
}
const BASE = options.base.replace(/\/$/, ''), baseURL = new URL(BASE), SECONDS = Number(options.seconds), ROUNDS = Number(options.rounds);
if (baseURL.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(baseURL.hostname) || Number(baseURL.port) < 5200) throw new Error('--base must be a local HTTP server on a port from 5200 up');
if (!Number.isFinite(SECONDS) || SECONDS <= 0) throw new Error('--seconds must be positive');
if (!Number.isInteger(ROUNDS) || ROUNDS < 1 || ROUNDS > 20) throw new Error('--rounds must be an integer from 1 to 20');
const FRAMES = Math.max(1, Math.round(SECONDS * HZ)), ACTUAL_SECONDS = FRAMES / HZ, TIMEOUT = 60000;
const html = readFileSync(path.join(ROOT, 'lab/index.html'), 'utf8'), match = html.match(/const TOOL_IDS\s*=\s*(\[[\s\S]*?\]);/);
if (!match) throw new Error('lab/index.html has no TOOL_IDS list');
const ALL_IDS = new Function(`return (${match[1]});`)();
if (!Array.isArray(ALL_IDS) || ALL_IDS.some((id) => typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id))) throw new Error('TOOL_IDS is not a list of widget ids');
const IDS = options.ids ? [...new Set(options.ids.split(',').map((s) => s.trim()).filter(Boolean))] : ALL_IDS;
if (!IDS.length) throw new Error('select at least one widget');
for (const id of IDS) if (!ALL_IDS.includes(id)) throw new Error(`widget is not registered in TOOL_IDS: ${id}`);
const OUT = path.resolve(ROOT, options.out), JSON_OUT = options.json ? path.resolve(ROOT, options.json) : null, IMAGES = options.images ? path.resolve(ROOT, options.images) : null;
const DEMOS = JSON.parse(readFileSync(path.join(ROOT, 'lab/demos.json'), 'utf8'));
const fingerprint = (text) => createHash('sha256').update(text.replace(/\r\n/g, '\n').replace(/^\s*\/\/[#@]\s*source(?:Mapping)?URL=.*$/gm, '').trim()).digest('hex');
const hashes = Object.fromEntries(IDS.map((id) => [id, fingerprint(readFileSync(path.join(ROOT, 'lab/tools', `${id}.js`), 'utf8'))]));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const config = { formatVersion: 1, revision, registered: ALL_IDS.length, ids: IDS, base: BASE, hz: HZ, framesPerRound: FRAMES, secondsPerRound: ACTUAL_SECONDS,
  rounds: ROUNDS, passages: PASSAGES, seed: 1, knobs: 'defaults including default drives', warmRule: 'max(5, lab/demos.json warm)', sourceHashes: hashes,
  timing: 'performance.now around one renderTo step; CPU work and command submission, no pixel readback or GPU completion wait', images: IMAGES };
let rows = [], fatal = null, browser = null, browserVersion = null, finished = null; const started = new Date().toISOString();

function inTime(work, label) {
  let timer; return Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: no result for ${TIMEOUT / 1000}s`)), TIMEOUT); })]).finally(() => clearTimeout(timer));
}
const quantile = (values, p) => { if (!values.length) return null; const a = values.slice().sort((x, y) => x - y); return a[Math.floor((a.length - 1) * p)]; };
const median = (values) => { if (!values.length) return null; const a = values.slice().sort((x, y) => x - y), i = Math.floor(a.length / 2); return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2; };
const ms = (n) => n == null ? '—' : n.toFixed(3);
const escape = (s) => String(s).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const HEADINGS = '| Widget | Winter Wind ms/frame | Rite ms/frame | Worst ms/frame | Worst p95 ms | Result |\n|---|---:|---:|---:|---:|---|';
function summarize(rounds) {
  const good = rounds.filter((r) => r.complete && !r.errors.length), times = good.flatMap((r) => r.times);
  return { rounds, complete: good.length === ROUNDS, medianRoundMean: median(good.map((r) => r.mean)), p95: quantile(times, .95),
    errors: [...new Set(rounds.flatMap((r) => r.errors))], warm: rounds[0]?.warm ?? null };
}
function sortedRows() { return rows.slice().sort((a, b) => Number(b.errors.length > 0) - Number(a.errors.length > 0) || (b.worst ?? -Infinity) - (a.worst ?? -Infinity) || a.id.localeCompare(b.id)); }
const tableRow = (r) => `| ${r.id} | ${ms(r.songs[0]?.medianRoundMean)} | ${ms(r.songs[1]?.medianRoundMean)} | ${ms(r.worst)} | ${ms(r.p95)} | ${escape(r.errors.join('; ') || (r.complete ? 'ok' : 'incomplete'))} |`;
function report() {
  const completed = rows.reduce((sum, row) => sum + row.songs.reduce((n, s) => n + s.rounds.filter((r) => r.complete && !r.errors.length).length, 0), 0), expected = IDS.length * PASSAGES.length * ROUNDS;
  const text = ['# Widget speed table', '', `Started ${started}${finished ? `; finished ${finished}` : '; in progress'}.`,
    `Source revision: \`${revision}\`. Registered widgets: ${ALL_IDS.length}; selected: ${IDS.length}. Completed rounds: ${completed}/${expected}. Chrome: ${browserVersion || 'not started'}.`, '',
    `Default knobs and drives, seed 1, ${HZ} Hz, ${FRAMES} measured frames (${ACTUAL_SECONDS.toFixed(3)} s) per round, ${ROUNDS} rounds per song. Winter Wind: 206.000–${(206 + ACTUAL_SECONDS).toFixed(3)} s; Rite: 174.000–${(174 + ACTUAL_SECONDS).toFixed(3)} s. Each round has a fresh page and max(5, lab/demos.json warm) seconds of warm-up; Vine gets 60 s. No audio plays.`,
    'One Chrome browser and one page at a time. All requests to the ratings server on port 5174 are stubbed before navigation; Vite reload is disabled. No ratings or knobs are saved.', '',
    'Each sample measures performance.now immediately around one renderTo(1/60 s) advance. It includes the widget, chord handling, the harness and CPU submission of drawing commands. It does not wait for asynchronous GPU work or measure screen presentation. There is no forced per-frame pixel readback, so the benchmark does not deliberately change the Canvas backend. Timer resolution, deferred drawing and other activity on this computer limit small comparisons.',
    'Each song column is the median of its round means; p95 uses all successful frame samples. Rows sort by the worse song column, slowest first (errors first). These machine-local CPU/submission figures do not by themselves prove a GPU frame budget. Whole-song accumulation and other passages remain unmeasured.',
    IMAGES ? `Final-frame PNGs are captured only after timing each song’s last round, in \`${path.relative(ROOT, IMAGES).replace(/\\/g, '/')}\`.` : 'No frame images are read or saved by this run. Use --images <directory> for final-frame PNGs taken after timing.', '',
    HEADINGS, ...sortedRows().map(tableRow), '', `${rows.filter((r) => r.errors.length || !r.complete).length} widget(s) have errors or incomplete measurements.`];
  for (const row of sortedRows()) for (let s = 0; s < row.songs.length; s++) if (row.songs[s].errors.length) text.push('', `- ${row.id} / ${PASSAGES[s].song}: ${row.songs[s].errors.map(escape).join('; ')}`);
  if (fatal) text.push('', `Run stopped: ${escape(fatal)}`);
  return `${text.join('\n')}\n`;
}
function save() {
  mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, report());
  if (JSON_OUT) { mkdirSync(path.dirname(JSON_OUT), { recursive: true }); writeFileSync(JSON_OUT, `${JSON.stringify({ started, finished, config, browserVersion, rows: sortedRows(), fatal }, null, 2)}\n`); }
}
const urlFor = (id, song) => `${BASE}/lab/index.html?render=1&only=${encodeURIComponent(id)}&song=${encodeURIComponent(song)}&hz=${HZ}`;
async function round(context, id, passage, number) {
  let page = null; const failures = new Set(), pageErrors = [], warm = Math.max(5, Number(DEMOS[id]?.warm) || 0);
  const result = { number, start: passage.start, end: passage.start + ACTUAL_SECONDS, warm, frames: 0, times: [], mean: null, median: null, p95: null, complete: false, errors: [], sourceHash: null, image: null };
  try {
    page = await context.newPage(); page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(urlFor(id, passage.song), { timeout: TIMEOUT });
    await page.waitForFunction(() => window.renderReady === true || window.renderFailed, null, { timeout: TIMEOUT });
    const meta = await page.evaluate(({ id, song, start, end, warm, hz }) => {
      if (window.renderFailed) throw new Error(String(window.renderFailed));
      if (SONG_ID !== song || RENDER_HZ !== hz) throw new Error('server did not open the requested song/60 Hz renderer');
      if (!Number.isFinite(DUR) || end > DUR || start < warm) throw new Error(`passage or warm-up is outside this song (duration ${DUR})`);
      if (!NOTES.length) throw new Error('song has no notes');
      if (LOAD_NOTES.missing.includes(id)) throw new Error(`missing widget: ${id}`);
      const broken = LOAD_NOTES.broken.find((v) => v.startsWith(`${id} (`)); if (broken) throw new Error(broken);
      if (!toolOf(id)) throw new Error(`widget did not load: ${id}`);
      window.__widgetSpeedErrors = () => [...Object.entries(window.renderErrors ?? {}).map(([key, value]) => `${key}: ${value}`), ...(window.__widgetConsoleErrors ?? []).map((v) => `console: ${v}`)];
      window.renderSeek(start - warm, 1); window.renderTo(start - warm);
      return { ids: TOOL_IDS, notes: SONGS[song].notes, source: TOOL_SRC[id] };
    }, { id, song: passage.song, start: passage.start, end: result.end, warm, hz: HZ });
    if (JSON.stringify(meta.ids) !== JSON.stringify(ALL_IDS)) throw new Error('server TOOL_IDS differs from this checkout; check --base');
    if (!existsSync(path.join(ROOT, 'lab', meta.notes))) throw new Error(`missing local notes: lab/${meta.notes}`);
    result.sourceHash = fingerprint(meta.source);
    if (result.sourceHash !== hashes[id]) throw new Error('server widget source differs from this checkout; check --base');
    for (let t = passage.start - warm; t < passage.start;) {
      t = Math.min(passage.start, t + 1);
      const errors = await inTime(page.evaluate((t) => { window.renderTo(t); return window.__widgetSpeedErrors(); }, t), `${id}/${passage.song}/warm`);
      for (const error of errors) failures.add(error);
    }
    const measured = await inTime(page.evaluate(({ start, frames, hz }) => {
      const times = []; let last = start; const began = performance.now();
      for (let k = 1; k <= frames; k++) {
        const target = start + k / hz;
        if (Math.max(1, Math.ceil((target - last) * hz - 1e-6)) !== 1) throw new Error('measurement did not request one simulation frame');
        const t0 = performance.now(); const reached = window.renderTo(target); const elapsed = performance.now() - t0;
        if (Math.abs(reached - target) > 1e-9) throw new Error('renderer clock missed the target');
        times.push(elapsed); last = target;
      }
      return { times, elapsed: performance.now() - began, errors: window.__widgetSpeedErrors() };
    }, { start: passage.start, frames: FRAMES, hz: HZ }), `${id}/${passage.song}/timing`);
    result.times = measured.times; result.frames = measured.times.length; result.elapsed = measured.elapsed;
    result.mean = result.times.reduce((sum, v) => sum + v, 0) / result.frames; result.median = median(result.times); result.p95 = quantile(result.times, .95);
    result.complete = result.frames === FRAMES && result.times.every((v) => Number.isFinite(v) && v >= 0);
    for (const error of measured.errors) failures.add(error);
    if (IMAGES && number === ROUNDS && result.complete && !failures.size) {
      const png = await inTime(page.evaluate(() => document.getElementById('c').toDataURL('image/png').split(',')[1]), `${id}/${passage.song}/image`);
      mkdirSync(IMAGES, { recursive: true }); const file = path.join(IMAGES, `${id}-${passage.song}.png`); writeFileSync(file, Buffer.from(png, 'base64')); result.image = path.relative(ROOT, file).replace(/\\/g, '/');
    }
  } catch (error) { failures.add(error.message.split('\n')[0]); }
  finally {
    if (page) try { await page.close(); } catch (error) { failures.add(`closing page: ${error.message.split('\n')[0]}`); }
    for (const error of pageErrors) failures.add(error);
  }
  result.errors = [...failures]; return result;
}

try {
  browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist'] }); browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await context.route(/^http:\/\/(localhost|127\.0\.0\.1):5174\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await context.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await context.addInitScript(() => {
    const errors = []; window.__widgetConsoleErrors = errors;
    for (const method of ['warn', 'error']) { const original = console[method]; console[method] = function (...args) {
      const text = args.map((v) => { try { return String(v); } catch { return '[unprintable]'; } }).join(' ');
      if (!errors.includes(text)) errors.push(text); return original.apply(this, args);
    }; }
  });
  save(); console.log(`Measuring ${IDS.length} widgets × ${PASSAGES.length} songs × ${ROUNDS} rounds, ${FRAMES} frames/round at 60 Hz.`);
  for (const id of IDS) {
    const songs = [];
    for (const passage of PASSAGES) { const rounds = []; for (let n = 1; n <= ROUNDS; n++) rounds.push(await round(context, id, passage, n)); songs.push(summarize(rounds)); }
    const valid = songs.filter((s) => s.complete), row = { id, songs, complete: valid.length === PASSAGES.length, worst: valid.length ? Math.max(...valid.map((s) => s.medianRoundMean)) : null,
      p95: valid.length ? Math.max(...valid.map((s) => s.p95)) : null, errors: [...new Set(songs.flatMap((s) => s.errors))] };
    rows.push(row); save(); console.log(`${id}: ${songs.map((s) => ms(s.medianRoundMean)).join(' / ')} ms/frame${row.errors.length ? `; ${row.errors.join('; ')}` : ''}`);
  }
} catch (error) { fatal = error.message; console.error(fatal); }
finally { finished = new Date().toISOString(); if (browser) await browser.close(); save(); }
console.log(`\n${HEADINGS}\n${sortedRows().map(tableRow).join('\n')}\n\nTable: ${OUT}`);
if (fatal || rows.length !== IDS.length || rows.some((r) => r.errors.length || !r.complete)) process.exitCode = 1;
