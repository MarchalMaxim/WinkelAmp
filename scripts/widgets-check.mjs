// The lab's widget health check: representative passages, low/high presence, one browser/page at a time.
// It measures aggregate colour occupancy and contrast, never differences between aligned pictures.
// Needs the worktree's Vite server on a free port >=5200, local notes and system Chrome.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaults = { base: 'http://localhost:5200', hz: '60', 'sample-hz': '12', seconds: '16', warm: '5', full: false,
  songs: 'lil-wayne-bells-visualizer,prelude,chopin-winter-wind', out: 'lab/widgets-check.md' };
const STARTS = { 'lil-wayne-bells-visualizer': 80, prelude: 118, 'chopin-winter-wind': 116 };
const options = { ...defaults }, argv = process.argv.slice(2), names = new Set(['base', 'hz', 'sample-hz', 'songs', 'ids', 'out', 'json', 'seconds', 'warm', 'start', 'full']);
function usage() {
  console.log(`npm run widgets-check -- [--base http://localhost:5200] [--hz 60] [--sample-hz 12]
  [--songs lil-wayne-bells-visualizer,prelude,chopin-winter-wind]
  [--seconds 16] [--warm 5] [--start <song seconds>] [--full]
  [--ids squares,fireworks] [--out lab/widgets-check.md] [--json renders/widgets-check.json]

Without --ids, checks every id registered in lab/index.html. Each low/high variant starts
fresh and simulates a 16-second passage after 5 seconds of warm-up, at 60 Hz by default.
Default starts are Lil Wayne 80s, Prelude 118s and Winter Wind 116s; other songs use a
bounded middle passage. --start overrides the start; --full instead tests 0..song end.
Aggregate observations use --sample-hz plus every attack frame, passage start and end.
--ids and --songs may select a smaller debugging run. --hz 12 is an explicit diagnostic
with different physics/fades, not normal-playback coverage. No audio is played.`);
}
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--help' || argv[i] === '-h') { usage(); process.exit(0); }
  const key = argv[i].replace(/^--/, '');
  if (argv[i] === '--full') { options.full = true; continue; }
  if (!argv[i].startsWith('--') || !names.has(key) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`unknown or incomplete option: ${argv[i]}`);
  options[key] = argv[++i];
}
const HZ = Number(options.hz), SAMPLE_HZ = Number(options['sample-hz']), BASE = options.base.replace(/\/$/, ''), baseURL = new URL(BASE);
const SECONDS = Number(options.seconds), WARM = Number(options.warm), START = options.start == null ? null : Number(options.start);
if (!Number.isFinite(HZ) || HZ < 1 || HZ > 120) throw new Error('--hz must be between 1 and 120');
if (!Number.isFinite(SAMPLE_HZ) || SAMPLE_HZ < 1 || SAMPLE_HZ > HZ) throw new Error('--sample-hz must be between 1 and --hz');
if (!Number.isFinite(SECONDS) || SECONDS <= 0) throw new Error('--seconds must be positive');
if (!Number.isFinite(WARM) || WARM < 0) throw new Error('--warm must be zero or positive');
if (START != null && (!Number.isFinite(START) || START < 0)) throw new Error('--start must be zero or positive');
if (!['localhost', '127.0.0.1'].includes(baseURL.hostname) || Number(baseURL.port) < 5200) throw new Error('--base must use localhost or 127.0.0.1 on a port from 5200 up');
const list = (v) => [...new Set(v.split(',').map((x) => x.trim()).filter(Boolean))];
const html = readFileSync(path.join(ROOT, 'lab/index.html'), 'utf8'), registered = html.match(/const TOOL_IDS\s*=\s*(\[[\s\S]*?\]);/);
if (!registered) throw new Error('lab/index.html has no TOOL_IDS list');
const ALL_IDS = new Function(`return (${registered[1]});`)();
if (!Array.isArray(ALL_IDS) || ALL_IDS.some((id) => typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id))) throw new Error('TOOL_IDS is not a list of widget ids');
const IDS = options.ids ? list(options.ids) : ALL_IDS, SONGS = list(options.songs);
if (!IDS.length || !SONGS.length) throw new Error('select at least one widget and one song');
for (const id of IDS) if (!ALL_IDS.includes(id)) throw new Error(`widget is not registered in TOOL_IDS: ${id}`);
const OUT = path.resolve(ROOT, options.out), JSON_OUT = options.json ? path.resolve(ROOT, options.json) : null;
const SAMPLE_W = 128, SAMPLE_H = 72, DARK = 8, RELATIVE_TOLERANCE = .02, ABSOLUTE_TOLERANCE = .002;
const BATCH_SECONDS = 2, TIMEOUT = 60000;
const rows = [], started = new Date().toISOString(); let finished = null, fatal = null, browser = null;
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const config = { formatVersion: 3, revision, base: BASE, hz: HZ, sampleHz: SAMPLE_HZ, ids: IDS, songs: SONGS, registered: ALL_IDS.length,
  scope: options.full ? 'full songs' : 'representative passages', seconds: options.full ? null : SECONDS, warm: options.full ? 0 : WARM, start: options.full ? 0 : START, defaultStarts: STARTS,
  low: 0, high: 1, sampleWidth: SAMPLE_W, sampleHeight: SAMPLE_H, darkThreshold: DARK,
  observationRule: 'measurement only: uniform samples plus the first simulation frame at or after every attack, start and final',
  weighting: 'right-end observation, weighted by elapsed song seconds since the preceding observation; zero has weight 0',
  colourBinWidth: 32, relativeTolerance: RELATIVE_TOLERANCE, absoluteTolerance: ABSOLUTE_TOLERANCE };

function inTime(work, label) {
  let timer;
  return Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: no result for ${TIMEOUT / 1000}s`)), TIMEOUT); })])
    .finally(() => clearTimeout(timer));
}
const pct = (v) => v == null ? '—' : (100 * v).toFixed(2);
const contrast = (v) => v == null ? '—' : (255 * v).toFixed(2);
const escape = (v) => String(v).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const average = (r, key) => r?.sampledSeconds ? r[key] / r.sampledSeconds : null;
const headings = '| Widget | Song | Start–end s | Warm s | Sim frames L/H | Observations L/H | Low ink % | High ink % | Low lit % | High lit % | Low contrast | High contrast | Result |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|';
function tableRow(row) {
  const scope = row.high.start == null ? row.low : row.high, span = scope.start == null ? '—' : `${scope.start.toFixed(3)}–${scope.end.toFixed(3)}`;
  return `| ${row.id} | ${row.song} | ${span} | ${scope.warm?.toFixed(3) ?? '—'} | ${row.low.frames}/${row.high.frames} | ${row.low.observations}/${row.high.observations} | ${pct(average(row.low, 'ink'))} | ${pct(average(row.high, 'ink'))} | ${pct(average(row.low, 'coverage'))} | ${pct(average(row.high, 'coverage'))} | ${contrast(average(row.low, 'contrast'))} | ${contrast(average(row.high, 'contrast'))} | ${escape(row.findings.join('; ') || 'ok')} |`;
}
function report() {
  const checked = rows.length, wanted = IDS.length * SONGS.length, problems = rows.filter((row) => row.findings.length).length;
  const text = [
    '# Widget health check', '', `Started ${started}${finished ? `; finished ${finished}` : '; in progress'}.`,
    `Source revision: \`${revision}\`. Registered widgets: ${ALL_IDS.length}; selected: ${IDS.length}. Completed widget/song pairs: ${checked}/${wanted}.`,
    `Songs: ${SONGS.join(', ')}. Scope: ${options.full ? 'complete 0..SONG.dur runs, explicitly requested with --full' : `${SECONDS}-second representative passages after up to ${WARM} seconds of warm-up; exact measurement start/end and actual warm time are in each row`}. Each low/high variant uses seed 1 and ${HZ} Hz simulation. renderTo draws every intermediate simulation frame and dispatches every crossed attack, including warm-up. No audio plays.`,
    `Only measurement frames contribute image statistics and blank/presence judgments. Observations use a uniform ${SAMPLE_HZ} Hz schedule plus the first simulation frame at or after every attack within the measurement interval, its start and its final frame. Duplicate indices are removed.`,
    `${rows.reduce((sum, row) => sum + row.low.frames + row.high.frames, 0)} simulation frames (one initial frame plus warm-up and measurement steps per variant) and ${rows.reduce((sum, row) => sum + row.low.observations + row.high.observations, 0)} measurement observations completed. ${HZ === 60 ? 'Simulation uses the normal 60 Hz physics and fades.' : `This ${HZ} Hz simulation is an explicit diagnostic and changes the normal 60 Hz physics/fades.`}`, '',
    `A fresh page is used for each variant, sequentially in one Chrome browser. Requests to the ratings server on port 5174 are stubbed before navigation; Vite reload is disabled. Leads use renderPresent; a plain presence knob is set directly through pst, with that knob's drive fixed. Other default drives are preserved. Uncaught page errors, renderErrors, load failures and JavaScript console warnings/errors (including caught queued-draw errors) are collected.`, '',
    `Each observed frame is reduced to ${SAMPLE_W}×${SAMPLE_H}. “Ink” is the share outside its most common RGB colour bin (32 channel values per bin); “lit” is the share with any channel above ${DARK}/255; contrast is the RGB standard deviation (shown in 0..255 units). Means are weighted by the song time since the previous observation, using the right-end sample; measurement-start has weight zero. Low and high use the same integer observation indices. This avoids treating a busy run's extra attack observations as extra song time. No pictures are compared pixel by pixel.`,
    `“Blank” means no observed channel exceeded ${DARK}/255 during the whole measured run, including its attack frames; warm-up is excluded. It cannot exclude marks visible only between observations or lost in reduction. Low is flagged “no less” when none of its three time-weighted means is lower than high by more than 2% plus 0.2 percentage points. These are broad diagnostic proxies: flat backgrounds, colour changes, saturation, dim marks and effects meant to alter another layer can make the quantity judgment inconclusive. They do not certify appearance. ${options.full ? '' : 'Long accumulation, late-song state and behavior outside the listed passages remain unjudged.'}`, '',
    headings, ...rows.map(tableRow), '', `${problems} pair(s) have findings; ${wanted - checked} pair(s) remain unchecked. Findings produce a non-zero exit status.`,
  ];
  for (const row of rows) for (const [level, result] of [['low', row.low], ['high', row.high]]) if (result?.errors?.length) {
    text.push('', `- ${row.id} / ${row.song} / ${level}: ${result.errors.map(escape).join('; ')}`);
  }
  if (fatal) text.push('', `Run stopped: ${escape(fatal)}`);
  return `${text.join('\n')}\n`;
}
function save() {
  mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, report());
  if (JSON_OUT) { mkdirSync(path.dirname(JSON_OUT), { recursive: true }); writeFileSync(JSON_OUT, `${JSON.stringify({ started, finished, config, rows, fatal }, null, 2)}\n`); }
}
function findings(low, high) {
  const out = [];
  if (low.errors.length || high.errors.length) out.push(`errors ${low.errors.length + high.errors.length}`);
  if (!low.complete || !high.complete) out.push('incomplete');
  if (low.presenceChecked && !low.presence || high.presenceChecked && !high.presence) out.push('no how present knob');
  else if (!low.presenceChecked || !high.presenceChecked) out.push('presence not checked');
  if (low.complete && low.maxChannel <= DARK) out.push('blank low');
  if (high.complete && high.maxChannel <= DARK) out.push('blank high');
  if (low.scheduleKey && high.scheduleKey && low.scheduleKey !== high.scheduleKey) out.push('observation schedules differ');
  if (low.complete && high.complete && low.presence && high.presence && low.scheduleKey === high.scheduleKey && !low.errors.length && !high.errors.length && high.maxChannel > DARK) {
    const noLess = ['ink', 'coverage', 'contrast'].every((key) => average(low, key) >= average(high, key) * (1 - RELATIVE_TOLERANCE) - ABSOLUTE_TOLERANCE);
    if (noLess) out.push('low makes no less');
  }
  return out;
}

async function open(context, url) {
  const page = await context.newPage(), errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(url, { timeout: TIMEOUT });
    await page.waitForFunction(() => window.renderReady === true || window.renderFailed, null, { timeout: TIMEOUT });
    const failed = await page.evaluate(() => window.renderFailed); if (failed) throw new Error(String(failed));
    return { page, errors };
  } catch (error) { await page.close(); throw new Error([error.message, ...errors].join('; ')); }
}
const urlFor = (id, song) => `${BASE}/lab/index.html?render=1&only=${encodeURIComponent(id)}&song=${encodeURIComponent(song)}&hz=${HZ}`;
async function variant(context, id, song, level) {
  let page = null, pageErrors = [], result = { frames: 0, initialFrames: 0, warmFrames: 0, measurementFrames: 0, observations: 0, sampledSeconds: 0, ink: 0, coverage: 0, contrast: 0, maxChannel: 0, complete: false, presence: null, presenceChecked: false, errors: [] };
  const failures = new Set();
  try {
    ({ page, errors: pageErrors } = await open(context, urlFor(id, song)));
    const initialized = await page.evaluate(({ id, song, level, hz, sampleHz, width, height, full, seconds, warm, overrideStart, defaults, batchSeconds }) => {
      if (SONG_ID !== song || RENDER_HZ !== hz) throw new Error('server did not open the requested song/render frequency');
      if (!Number.isFinite(DUR) || DUR <= 0 || !NOTES.length) throw new Error('song has no duration or notes');
      if (LOAD_NOTES.missing.includes(id)) throw new Error(`missing widget file: ${id}`);
      const broken = LOAD_NOTES.broken.find((v) => v.startsWith(`${id} (`)); if (broken) throw new Error(broken);
      const tool = toolOf(id); if (!tool) throw new Error(`widget did not load: ${id}`);
      const q = tool.params?.find((p) => p.key === 'presence' || p.label === 'how present' || p.leads);
      if (q?.leads) window.renderPresent(id, level);
      else if (q) pst(tool, q).base = q.min + (q.max - q.min) * level;
      if (q) pst(tool, q).drive = '';
      if (!full && overrideStart != null && overrideStart >= DUR) throw new Error(`--start must be before ${song}'s end (${DUR}s)`);
      const start = full ? 0 : overrideStart ?? Math.max(0, Math.min(defaults[song] ?? (DUR - seconds) / 2, DUR - Math.min(seconds, DUR)));
      const end = full ? DUR : Math.min(DUR, start + seconds), warmStart = full ? 0 : Math.max(0, start - warm), duration = end - start;
      // Compare absolute grid times: subtraction alone can misround 118.15 on a grid anchored at 118.
      const frameAt = (t) => { let k = Math.floor((t - start) * hz); if (start + k / hz < t) k++; return Math.max(0, k); };
      const last = frameAt(end), uniform = new Set([0, last]), attacks = new Set();
      for (let k = 0; k <= Math.floor(duration * sampleHz); k++) uniform.add(Math.min(last, frameAt(start + k / sampleHz)));
      for (const chord of CHORDS) if (chord.t >= start && chord.t <= end) attacks.add(Math.min(last, frameAt(chord.t)));
      const indices = [...new Set([...uniform, ...attacks])].sort((a, b) => a - b);
      const scheduleKey = indices.reduce((hash, i) => Math.imul(hash ^ i, 16777619) >>> 0, 2166136261).toString(16);
      const countSteps = (from, to) => to > from ? Math.max(1, Math.ceil((to - from) * hz - 1e-6)) : 0;
      let expectedWarmFrames = 0, from = warmStart;
      while (from < start) { const to = Math.min(start, from + batchSeconds); expectedWarmFrames += countSteps(from, to); from = to; }
      let expectedMeasurementFrames = 0; from = start;
      for (const i of indices) { const to = Math.min(end, start + i / hz); expectedMeasurementFrames += countSteps(from, to); from = to; }
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const errors = () => [...Object.entries(window.renderErrors ?? {}).map(([widget, message]) => `${widget}: ${message}`), ...(window.__widgetConsoleErrors ?? []).map((message) => `console: ${message}`)];
      window.__widgetsCheck = { canvas, g: canvas.getContext('2d', { alpha: false, willReadFrequently: true }), hist: new Uint32Array(512), indices, next: 0, lastTime: start, warmTime: warmStart, errors };
      window.renderSeek(warmStart, 1); window.renderTo(warmStart);
      return { songDuration: DUR, duration, start, end, warmStart, warm: start - warmStart, initialFrames: 1, expectedWarmFrames, expectedMeasurementFrames,
        expectedFrames: 1 + expectedWarmFrames + expectedMeasurementFrames, expectedObservations: indices.length, uniformObservations: uniform.size, attackObservations: attacks.size, scheduleKey, initialErrors: errors(),
        presenceChecked: true, presence: q ? { key: q.key, mode: q.leads ? 'leads' : 'plain', base: pst(tool, q).base } : null };
    }, { id, song, level, hz: HZ, sampleHz: SAMPLE_HZ, width: SAMPLE_W, height: SAMPLE_H, full: options.full, seconds: SECONDS, warm: WARM, overrideStart: START, defaults: STARTS, batchSeconds: BATCH_SECONDS });
    const { initialErrors, ...meta } = initialized; result = { ...result, ...meta, frames: 1 };
    for (const message of initialErrors) failures.add(message);
    while (result.warmFrames < meta.expectedWarmFrames) {
      const batch = await inTime(page.evaluate(({ hz, start, seconds }) => {
        const state = window.__widgetsCheck, target = Math.min(start, state.warmTime + seconds), frames = Math.max(1, Math.ceil((target - state.warmTime) * hz - 1e-6));
        window.renderTo(target); state.warmTime = target; return { frames, errors: state.errors() };
      }, { hz: HZ, start: meta.start, seconds: BATCH_SECONDS }), `${id}/${song}/${level}/warm`);
      result.frames += batch.frames; result.warmFrames += batch.frames; for (const message of batch.errors) failures.add(message);
    }
    while (result.observations < meta.expectedObservations) {
      const batch = await inTime(page.evaluate(({ hz, start, end, seconds, dark }) => {
        const state = window.__widgetsCheck, source = document.getElementById('c'), g = state.g;
        const out = { frames: 0, observations: 0, sampledSeconds: 0, ink: 0, coverage: 0, contrast: 0, maxChannel: 0 }, until = state.lastTime + seconds;
        while (state.next < state.indices.length) {
          const index = state.indices[state.next], target = Math.min(end, start + index / hz); if (out.observations && target > until) break;
          const weight = target - state.lastTime, frames = weight > 0 ? Math.max(1, Math.ceil(weight * hz - 1e-6)) : 0;
          if (weight > 0) window.renderTo(target);   // measurement-start already exists from warm-up: do not fade it twice
          g.clearRect(0, 0, state.canvas.width, state.canvas.height); g.drawImage(source, 0, 0, state.canvas.width, state.canvas.height);
          const data = g.getImageData(0, 0, state.canvas.width, state.canvas.height).data, pixels = data.length / 4; state.hist.fill(0);
          let lit = 0, sumR = 0, sumG = 0, sumB = 0, squares = 0, dominant = 0, peak = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], green = data[i + 1], b = data[i + 2], top = Math.max(r, green, b);
            if (top > dark) lit++; peak = Math.max(peak, top); sumR += r; sumG += green; sumB += b; squares += r * r + green * green + b * b;
            const bin = (r >> 5) * 64 + (green >> 5) * 8 + (b >> 5); dominant = Math.max(dominant, ++state.hist[bin]);
          }
          const variance = Math.max(0, (squares / pixels - (sumR / pixels) ** 2 - (sumG / pixels) ** 2 - (sumB / pixels) ** 2) / 3);
          out.frames += frames; out.observations++; out.sampledSeconds += weight;
          out.ink += (1 - dominant / pixels) * weight; out.coverage += lit / pixels * weight; out.contrast += Math.sqrt(variance) / 255 * weight; out.maxChannel = Math.max(out.maxChannel, peak);
          state.lastTime = target; state.next++;
        }
        return { ...out, errors: state.errors() };
      }, { hz: HZ, start: meta.start, end: meta.end, seconds: BATCH_SECONDS, dark: DARK }), `${id}/${song}/${level}`);
      for (const key of ['frames', 'observations', 'sampledSeconds', 'ink', 'coverage', 'contrast']) result[key] += batch[key];
      result.measurementFrames += batch.frames;
      result.maxChannel = Math.max(result.maxChannel, batch.maxChannel); for (const message of batch.errors) failures.add(message);
    }
    result.complete = result.frames === meta.expectedFrames && result.warmFrames === meta.expectedWarmFrames && result.measurementFrames === meta.expectedMeasurementFrames && result.observations === meta.expectedObservations && Math.abs(result.sampledSeconds - meta.duration) < 1e-6;
  } catch (error) { failures.add(error.message.split('\n')[0]); }
  finally {
    if (page) { try { await page.close(); } catch (error) { failures.add(`closing page: ${error.message.split('\n')[0]}`); } }
    for (const error of pageErrors) failures.add(error);
  }
  result.errors = [...failures]; return result;
}

try {
  browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  // Queued draws are caught by the lab and warned, not added to renderErrors. Keep those too.
  await context.addInitScript(() => {
    const errors = []; window.__widgetConsoleErrors = errors;
    for (const method of ['warn', 'error']) {
      const original = console[method];
      console[method] = function (...args) {
        const message = args.map((value) => { try { return String(value); } catch { return '[unprintable]'; } }).join(' ');
        if (!errors.includes(message)) errors.push(message);
        return original.apply(this, args);
      };
    }
  });
  // Install before the first page: this script never reaches the real ratings service.
  await context.route(/^http:\/\/(localhost|127\.0\.0\.1):5174\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await context.route('**/@vite/client', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  const discovery = await open(context, urlFor(IDS[0], SONGS[0]));
  try {
    const catalogue = await discovery.page.evaluate(() => ({ ids: TOOL_IDS, songs: Object.fromEntries(Object.entries(SONGS).map(([id, song]) => [id, song.notes])) }));
    if (JSON.stringify(catalogue.ids) !== JSON.stringify(ALL_IDS)) throw new Error('server TOOL_IDS differs from this checkout; check --base');
    for (const song of SONGS) {
      if (!catalogue.songs[song]) throw new Error(`unknown song: ${song}`);
      if (!existsSync(path.join(ROOT, 'lab', catalogue.songs[song]))) throw new Error(`missing local notes: lab/${catalogue.songs[song]}`);
    }
  } finally { await discovery.page.close(); }
  save(); console.log(`${options.full ? 'Full-song' : 'Representative-passage'} health check: ${IDS.length} widgets × ${SONGS.length} songs × low/high, ${HZ} Hz simulation; ${SAMPLE_HZ} Hz observations plus every measured attack frame.`); console.log(headings);
  for (const id of IDS) for (const song of SONGS) {
    const low = await variant(context, id, song, 0), high = await variant(context, id, song, 1), row = { id, song, low, high, findings: findings(low, high) };
    rows.push(row); save(); console.log(tableRow(row));
  }
} catch (error) { fatal = error.message; console.error(fatal); }
finally { finished = new Date().toISOString(); if (browser) await browser.close(); save(); }
const failed = !!fatal || rows.length !== IDS.length * SONGS.length || rows.some((row) => row.findings.length);
console.log(`\n${rows.length}/${IDS.length * SONGS.length} pairs checked. ${rows.filter((row) => row.findings.length).length} have findings. Table: ${OUT}${JSON_OUT ? `; data: ${JSON_OUT}` : ''}`);
if (failed) process.exitCode = 1;
