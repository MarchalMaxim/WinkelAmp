// A show as an HD master video, frame by frame, with the recording's sound (plans §10 and round 2 §7): exact and smooth
// whatever the machine, unlike a recording made while the song plays, and sharper than the live 1280×720 canvas.
//
//   npm run render-show -- <show id | show.json> [--scale 2] [--fps 60] [--hz 60] [--crf 13] [--preset slow]
//                          [--master x264|x264-444|prores] [--share | --no-share] [--share-mb-per-min 15]
//                          [--from 0] [--to <end>] [--out renders/<id>.mp4] [--framemd5 <file>] [--eta-probes K]
//                          [--headed] [--keep] [--compose]
//
// The show is shows/<id>.json (or the file given); a song with no show of its own gets the one the studio would compose
// for it (--compose: even when it has one), from the widgets' tags, its instrument tracks and the feel words of
// shows/<id>.description.md. Its own Vite server (from port 5190) and headless system Chrome open
// render.html?show=<id>&scale=S (the studio's runtime and Conductor on a 1280·S × 720·S canvas, widgets still in 1280×720
// units), which draws on demand: frame k shows the song at from + k/fps after stepping there in substeps of 1/hz s, so
// an attack is drawn on the first frame at or after its time, and the same show gives the same frames every time
// (randomness is seeded). A start after 0 is pre-rolled 3 s so the first frame is not black.
//
// Frames leave the page losslessly: the canvas as PNG (toBlob) is POSTed to /__frame on the render's own server, whose
// middleware writes it, in order, to ffmpeg's stdin (-f image2pipe) and answers once the pipe has drained. Measured in
// round 2 T9 at 2× (beethoven5 155–160, 300 frames; drawing alone 583 ms a frame): PNG 627 ms a frame, getImageData's
// raw RGBA POSTed 1146 ms (Chrome uploads 14.7 MB bodies at about 27 MB/s), base64 through page.evaluate 885 ms.
// Outputs (scripts/lib/encode.mjs has the exact arguments):
//   the master   <out> (renders/<id>.mp4; .mov for prores): x264 crf 13 slow, yuv420p BT.709 limited range with its
//                colour tags, level 5.1 at 2×; the recording cut to [from, to] sample for sample (atrim) → AAC 320k
//   the share    <out>-share.mp4: from the master, lanczos to 1920×1080, 30 fps, two-pass x264 at --share-mb-per-min
//                (15 MB a minute ≈ 1.87 Mbit/s + AAC 128k); send it in WhatsApp as a document so it is not squeezed again
//   the sheet    <out>-sheet.png: one frame per 10 s of the master
// --framemd5 writes one md5 per frame over the raw RGBA as drawn (ffmpeg's framemd5 of the decoded PNGs, before x264),
// to compare runs.
// --scale 1 --fps 30 --crf 18 --no-share gives the old 720p kind of render (losslessly fed now).
// The ETA covers the frames (the master encodes alongside), the sound and the two share passes (estimated per video
// second). It comes after the first 10 s of drawing; a render longer than 30 s scales that pace by samples of the
// song's drawing cost taken first in a page of their own (--eta-probes K, 0 for none). Progress lines, `ETA …`, `done: …` and the closing `master →`,
// `share →` and `sheet →` lines are read by the studio's export job: keep their shape. Started by that job (an IPC
// channel), a { cancel: true } message stops it cleanly: Chrome, ffmpeg and the server closed and the temp folder (with
// the partial video) removed, then exit 130 (on Windows a kill would skip all of that).
// Videos carry the user's recordings: renders/ stays out of git. Needs ffmpeg on the PATH and Chrome.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { masterArgs, shareArgs, shareVideoKbps } from './lib/encode.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: npm run render-show -- <show id | show.json> [--scale 2] [--fps 60] [--hz 60] [--crf 13] [--preset slow] '
  + '[--master x264|x264-444|prores] [--share | --no-share] [--share-mb-per-min 15] [--from 0] [--to <end>] [--out renders/<id>.mp4] '
  + '[--framemd5 <file>] [--eta-probes K] [--headed] [--keep] [--compose]';
const VALUED = ['out', 'fps', 'hz', 'from', 'to', 'crf', 'framemd5', 'scale', 'preset', 'master', 'share-mb-per-min', 'eta-probes'];
const FLAGS = ['headed', 'keep', 'share', 'no-share', 'compose'];
const argv = process.argv.slice(2);
const opts = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    if (FLAGS.includes(k)) opts[k] = true;
    else if (VALUED.includes(k) && i + 1 < argv.length) opts[k] = argv[++i];
    else { console.error(`unknown option ${a}\n${USAGE}`); process.exit(2); }
  } else pos.push(a);
}
if (pos.length !== 1) { console.error(USAGE); process.exit(2); }
const num = (k, d) => {
  if (opts[k] === undefined) return d;
  const v = Number(opts[k]);
  if (!Number.isFinite(v)) { console.error(`--${k} must be a number, not ${opts[k]}`); process.exit(2); }
  return v;
};
const fail = (msg) => { console.error(msg); process.exit(2); };
const FPS = num('fps', 60), HZ = num('hz', 60), CRF = num('crf', 13), SCALE = num('scale', 2), MB_PER_MIN = num('share-mb-per-min', 15);
const PRESET = opts.preset ?? 'slow', MASTER = opts.master ?? 'x264';
if (opts.share && opts['no-share']) fail('--share or --no-share, not both');
const SHARE = !opts['no-share'];
const PREROLL = 3, BATCH = 30, CAL = 120;   // CAL: frames that calibrate the sampled ETA (a multiple of BATCH)
// Measured in T9 on beethoven5 155–170 at 2× (2560×1440 60 fps master): the sound mux and both share passes, s per video
// second (the frames themselves took 4.1 s per video second there).
const AFTER_S_PER_SEC = { mux: 0.1, share: 0.4 };
if (FPS <= 0 || FPS > 120 || HZ < 1) fail('--fps must be in (0, 120] and --hz ≥ 1');
if (![1, 2, 3].includes(SCALE)) fail('--scale is 1, 2 or 3');
if (!['x264', 'x264-444', 'prores'].includes(MASTER)) fail('--master is x264, x264-444 or prores');
if (SHARE) shareVideoKbps(MB_PER_MIN);   // throws on a budget the sound alone would eat
if (spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('render-show needs ffmpeg on the PATH'); process.exit(1); }

const clock = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** Every ffmpeg still running, so a cancel or an error stops them. */
const procs = new Set();
const run = (cmd, args, { stdin = false } = {}) => {
  const p = spawn(cmd, args, { stdio: [stdin ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
  procs.add(p); p.on('close', () => procs.delete(p));
  let err = '';
  p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
  const done = new Promise((res, rej) => {
    p.on('error', rej);
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}:\n${err}`))));
  });
  return { p, done };
};

// The frame sink: POST /__frame?k=<n> bodies (one PNG each), in order, into the current ffmpeg's stdin. One request at a
// time (the page awaits each answer before sending the next); the answer comes once the bytes are in the pipe, or names
// what went wrong.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sink = { ff: null, next: 0, error: null };
const frameSink = {
  name: 'render-show-frames',
  configureServer(server) {
    server.middlewares.use('/__frame', (req, res) => {
      const answer = (status, msg = '') => { res.statusCode = status; res.end(msg); };
      if (req.method !== 'POST') return answer(405);
      const k = Number(new URL(req.url, 'http://x').searchParams.get('k'));
      const stdin = sink.ff?.p.stdin;
      if (!stdin || sink.error) { req.resume(); return answer(500, sink.error ?? 'no encoder'); }
      if (k !== sink.next) { req.resume(); return answer(409, `frame ${k} came when ${sink.next} was due`); }
      let got = 0;
      req.on('data', (c) => {
        if (got === 0 && !c.subarray(0, 8).equals(PNG_SIGNATURE)) sink.error = `frame ${k} is not a PNG`;
        got += c.length;
        if (sink.error) return;
        if (!stdin.write(c)) { req.pause(); stdin.once('drain', () => req.resume()); }
      });
      req.on('error', (e) => answer(500, String(e)));
      req.on('end', () => {
        if (!sink.error && got === 0) sink.error = `frame ${k} came empty`;
        if (sink.error) return answer(400, sink.error);
        sink.next++;
        if (stdin.writableNeedDrain) stdin.once('drain', () => answer(204)); else answer(204);
      });
    });
  },
};

const vite = await createServer({ root: ROOT, logLevel: 'error', plugins: [frameSink], server: { host: '127.0.0.1', port: Number(process.env.WINKELAMP_PORT) || 5190, strictPort: false, hmr: false } });
let browser = null, tmp = null, code = 0, cleaning = null, cancelled = false;
/** Chrome, the encoders and the server closed, the temp folder removed (unless --keep); once, whoever asks first. */
const cleanup = () => (cleaning ??= (async () => {
  try { if (browser) await browser.close(); } catch { /* already gone */ }
  browser = null;
  for (const p of procs) if (p.exitCode === null) p.kill();
  try { await vite.close(); } catch { /* already closed */ }
  // a killed ffmpeg lets go of its partial video a moment later
  if (tmp && !opts.keep) rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  else if (tmp) console.log(`kept ${tmp}`);
})());
process.on('message', (m) => {
  if (!m || !m.cancel || cancelled) return;
  cancelled = true;
  console.log('render-show: cancelled');
  cleanup().catch((e) => console.error(`render-show: cleaning up: ${e.message ?? e}`)).finally(() => process.exit(130));
});
try {
  const { validateShow } = await vite.ssrLoadModule('/src/studio/show/show.ts');
  const { composeShow } = await vite.ssrLoadModule('/src/studio/compose/compose.ts');
  const { loadCatalogue, readLabTagWords } = await vite.ssrLoadModule('/scripts/node/catalogue.ts');
  const { loadLayers } = await vite.ssrLoadModule('/scripts/node/layers.ts');
  const { feelWordsIn } = await vite.ssrLoadModule('/src/widgets/tags.ts');
  const { songsDir, showsDir } = await vite.ssrLoadModule('/scripts/node/pack-io.ts');
  const songs = songsDir(), widgets = loadCatalogue().widgets;
  const readPack = (id) => {
    const f = path.join(songs, id, 'pack.json');
    if (!existsSync(f)) throw new Error(`no song pack ${f} (npm run ingest -- <audio> --id ${id})`);
    return JSON.parse(readFileSync(f, 'utf8'));
  };

  // The show: a file, shows/<id>.json, or (a song without a show, or --compose) the one the studio composes for it.
  const arg = pos[0];
  const compose = (id) => {
    const f = path.join(showsDir(), `${id}.description.md`), description = existsSync(f) ? readFileSync(f, 'utf8') : '';
    const words = readLabTagWords(), feel = feelWordsIn(description, words);
    console.log(`composing ${id}: ${description ? `the feel words of its description: ${feel.join(', ') || 'none'}` : 'no description'}`);
    return composeShow({ pack: readPack(id), widgets, description, layers: loadLayers(), words });
  };
  let show, from = 'file';
  if (opts.compose) {
    show = compose(arg);
    from = 'composed';
  } else if (arg.endsWith('.json') || existsSync(arg)) {
    show = JSON.parse(readFileSync(path.resolve(arg), 'utf8'));
  } else if (existsSync(path.join(showsDir(), `${arg}.json`))) {
    show = JSON.parse(readFileSync(path.join(showsDir(), `${arg}.json`), 'utf8'));
  } else if (existsSync(path.join(songs, arg, 'pack.json'))) {
    show = compose(arg);
    from = 'composed';
  } else throw new Error(`no show ${arg}: not a file, not in ${showsDir()}, and no song pack ${arg} in ${songs}`);
  const pack = readPack(show.song);
  const v = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks ?? {}), noteTypes: loadLayers().noteTypeAttacks(pack) });
  for (const w of v.warnings) console.log(`warning  ${w.path}: ${w.message}`);
  if (v.errors.length) {
    for (const e of v.errors) console.error(`error  ${e.path}: ${e.message}`);
    throw new Error(`the show has ${v.errors.length} error(s): npm run check-show -- --fix <file> repairs most`);
  }
  const audioFile = path.join(songs, show.song, pack.audio);
  if (!existsSync(audioFile)) throw new Error(`no recording ${audioFile}`);

  const start = Math.max(0, num('from', 0)), end = Math.min(pack.duration, num('to', pack.duration));
  if (!(end > start)) throw new Error(`nothing to render between ${start} and ${end} s (the song lasts ${pack.duration.toFixed(2)} s)`);
  const n = Math.round((end - start) * FPS), secs = n / FPS;
  const ext = MASTER === 'prores' ? '.mov' : '.mp4';
  const asked = path.resolve(opts.out ?? path.join(ROOT, 'renders', show.id));
  const out = path.extname(asked) ? asked : asked + ext;   // --out renders/x gets the master's own extension
  const stem = out.replace(/\.[^./\\]+$/, '');
  const shareOut = `${stem}-share.mp4`, sheetOut = `${stem}-sheet.png`;
  mkdirSync(path.dirname(out), { recursive: true });
  tmp = mkdtempSync(path.join(tmpdir(), 'wa-render-show-'));
  console.log(`work folder → ${tmp}`);   // the export job removes it if this process is killed before its cleanup
  const W = 1280 * SCALE, H = 720 * SCALE;
  console.log(`${show.title ?? pack.title} (${from === 'composed' ? (opts.compose ? 'composed for the song (--compose)' : 'composed for the song: no shows/' + show.id + '.json') : `${show.clips.length} clips`}): `
    + `${clock(start)}–${clock(end)}, ${n} frames of ${W}×${H} at ${FPS} fps (${HZ} Hz steps, scale ${SCALE}) → ${out}`);

  await vite.listen();
  const BASE = vite.resolvedUrls.local[0].replace(/\/$/, '');
  browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true, headless: !opts.headed, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
  const pageErrors = [];
  const openPage = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => pageErrors.push(e.message));
    // No live reload mid-render (other work edits files), never the lab's ratings server, and this exact show.
    await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route(/localhost:5174/, (r) => r.abort());
    await page.route(new RegExp(`/api/shows/${encodeURIComponent(show.id)}$`), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(show) }));
    await page.goto(`${BASE}/render.html?show=${encodeURIComponent(show.id)}&hz=${HZ}&scale=${SCALE}`);
    await page.waitForFunction(() => window.renderReady === true || !!window.renderFailed, null, { timeout: 60_000 });
    const failed = await page.evaluate(() => window.renderFailed ?? null);
    if (failed) throw new Error(`render.html failed: ${failed}`);
    const size = await page.evaluate(() => window.renderSize);
    if (size?.w !== W || size?.h !== H) throw new Error(`render.html drew ${JSON.stringify(size)}, not ${W}×${H}`);
    return page;
  };

  // The ETA. A widget's cost varies several times over a song (beethoven5 at 2×: squares and casket 2 s per video second,
  // rorschach and murmuration 5), so a render longer than 30 s first samples the song in a page of its own (a seek does
  // not yet restore every widget's state, and the frames must not depend on the sampling): the start, then K points
  // spread over [start, end], each after a seek and the render's own 3 s of pre-roll (a widget's cost builds up after it
  // starts), then frames drawn and made PNG, timed. Drawing next to x264 is slower than alone, so the render's frames
  // CAL to 2·CAL are timed there too, and the ETA comes once the render has drawn them: the sampled mean × the ratio.
  // A render of 30 s or less goes by its first 10 s alone.
  const tStart = Date.now();
  const after = secs * (AFTER_S_PER_SEC.mux + (SHARE ? AFTER_S_PER_SEC.share : 0));
  const PROBES = Math.round(num('eta-probes', secs > 30 ? Math.min(8, Math.ceil(secs / 30)) : 0));
  let eta = null, profile = null;
  const sayEta = (frames, how) => {
    const total = (Date.now() - tStart) / 1000 + frames + after;
    eta = { total, at: tStart + total * 1000 };
    console.log(`ETA ${clock(total)} in all (frames ${clock(frames)}, then sound${SHARE ? ' and share copy' : ''} ${clock(after)}; ${how}): done about `
      + new Date(eta.at).toTimeString().slice(0, 5));
  };
  if (PROBES > 0) {
    console.log(`sampling the drawing cost at ${PROBES} points for the ETA`);
    const probe = await openPage();
    const costs = await probe.evaluate(async ({ start, secs, K, FPS, PREROLL, CAL }) => {
      const c = document.getElementById('c'), out = [];
      const at = [start, ...Array.from({ length: K }, (_, i) => start + ((i + 0.5) * secs) / K)];
      for (const [i, t] of at.entries()) {
        const t0 = Math.max(0, t - PREROLL), frames = i === 0 ? CAL : 30;
        window.renderSeek(t0, 1);
        for (let k = 1; t0 + k / FPS < t; k++) window.renderTo(t0 + k / FPS);
        let k = 1;
        if (i === 0) for (; k <= CAL; k++) { window.renderTo(t + k / FPS); await new Promise((r) => c.toBlob(r, 'image/png')); }
        const a = performance.now();
        for (const k1 = k + frames; k < k1; k++) { window.renderTo(t + k / FPS); await new Promise((r) => c.toBlob(r, 'image/png')); }
        out.push((performance.now() - a) / frames / 1000);
      }
      return out;
    }, { start, secs, K: PROBES, FPS, PREROLL, CAL });
    await probe.close();
    // A point can land on a section's first half second, when the old and new layers both draw (beethoven5 at 195 s:
    // 11 s per video second, where the section goes on at 6): from 5 points on, the dearest and the cheapest are left out.
    const [first, ...rest] = costs, sorted = [...rest].sort((a, b) => a - b), kept = sorted.length >= 5 ? sorted.slice(1, -1) : sorted;
    profile = { first, mean: kept.reduce((a, b) => a + b, 0) / kept.length, lo: sorted[0], hi: sorted.at(-1) };
  }
  const page = await openPage();

  // Pre-roll (not captured) up to exactly the start; frame 0 is the picture there.
  await page.evaluate(({ start, FPS, PREROLL }) => {
    if (start <= 0) { window.renderSeek(start, 1); return; }
    window.renderSeek(Math.max(0, start - PREROLL), 1);
    const k0 = Math.ceil(-Math.min(PREROLL, start) * FPS) + 1;
    for (let k = k0; k <= 0; k++) window.renderTo(start + k / FPS);
  }, { start, FPS, PREROLL });

  // The routes were for loading. Playwright intercepts every request while any route is set, which slows each frame's
  // POST by about 130 ms, so they go now; the page's own requests to the lab's ratings server stay refused in the page.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.evaluate(() => {
    const lab = (u) => /\/\/(localhost|127\.0\.0\.1):5174\b/.test(String(u?.url ?? u));
    const f = window.fetch;
    window.fetch = (u, o) => (lab(u) ? Promise.reject(new Error('render-show: no requests to 5174')) : f(u, o));
    const send = navigator.sendBeacon?.bind(navigator);
    if (send) navigator.sendBeacon = (u, d) => (lab(u) ? false : send(u, d));
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u, ...rest) {
      if (lab(u)) throw new Error('render-show: no requests to 5174');
      return open.call(this, m, u, ...rest);
    };
  });

  const video = path.join(tmp, `video${ext}`), md5File = path.join(tmp, 'frames.md5');
  const ff = run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
    ...masterArgs({ w: W, h: H, fps: FPS, crf: CRF, preset: PRESET, master: MASTER, out: video, frames: n, input: 'png' }),
    // a second output: the md5 of each decoded frame's RGBA
    ...(opts.framemd5 ? ['-map', '0:v', '-frames:v', String(n), '-c:v', 'rawvideo', '-pix_fmt', 'rgba', '-f', 'framemd5', md5File] : [])],
  { stdin: true });
  Object.assign(sink, { ff, next: 0, error: null });
  ff.p.stdin.on('error', (e) => { sink.error = `ffmpeg's input: ${e.message}`; });
  ff.done.catch((e) => { sink.error = e.message; });

  const t0 = Date.now();
  let lastReport = t0, tCal = t0;
  for (let k = 0; k < n; k += BATCH) {
    // Draw k+1 while frame k is compressed and on its way (toBlob takes the picture when called); each frame waits for
    // the previous answer, so they arrive in order.
    await page.evaluate(async ({ start, FPS, k0, k1 }) => {
      const c = document.getElementById('c');
      let prev = Promise.resolve();
      for (let k = k0; k < k1; k++) {
        if (k > 0) window.renderTo(start + k / FPS);
        const png = new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error(`frame ${k}: no PNG`))), 'image/png'));
        await prev;
        // The PNG's bytes, not the Blob: a Blob body goes through Chrome's blob store, and busy 2× frames (4–5 MB PNGs:
        // Winter Wind's horizon) made a POST fail with "Failed to fetch" after 100 to 150 frames (T24).
        prev = png.then(async (b) => fetch(`/__frame?k=${k}`, { method: 'POST', body: await b.arrayBuffer() }))
          .then(async (r) => { if (!r.ok) throw new Error(`frame ${k}: ${r.status} ${await r.text()}`); });
      }
      await prev;
    }, { start, FPS, k0: k, k1: Math.min(n, k + BATCH) });
    const now = Date.now(), done = Math.min(n, k + BATCH), per = (now - t0) / 1000 / done;
    if (profile && done === CAL) tCal = now;
    if (!eta && profile && done >= 2 * CAL && done < n) {
      // The same frames (CAL to 2·CAL, past the start-up of the page, the pipe and x264) drawn here and in the sampling
      // page: how much slower the real thing is, with x264 alongside.
      const slow = (now - tCal) / 1000 / (done - CAL) / profile.first, s = (c) => (c * slow * FPS).toFixed(1);
      sayEta(profile.mean * slow * (n - done), `the song sampled at ${PROBES} points: ${s(profile.lo)}–${s(profile.hi)}, mean ${s(profile.mean)} s per video second`);
    }
    if (!eta && !profile && now - t0 >= 10_000 && done < n) {
      sayEta(per * (n - done), `from the first ${done} frames`);
    }
    if (now - lastReport >= 10_000 && done < n) {
      lastReport = now;
      console.log(`  ${clock(start + done / FPS)} of ${clock(end)}: ${done}/${n} frames (${(100 * done / n).toFixed(0)} %), `
        + `${(per * FPS).toFixed(2)} s per video second, about ${clock(per * (n - done))} left`);
    }
  }
  ff.p.stdin.end();
  await ff.done;
  if (sink.next !== n) throw new Error(`ffmpeg got ${sink.next} of ${n} frames`);
  const frameSecs = (Date.now() - t0) / 1000;
  const widgetErrors = await page.evaluate(() => ({ ...window.renderErrors }));
  await browser.close(); browser = null;

  // The sound: the recording cut to [start, end) sample for sample, as long as the frames.
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-i', audioFile, '-map', '0:v', '-map', '1:a',
    '-af', `atrim=start=${start}:end=${start + secs},asetpts=PTS-STARTPTS`, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
    '-movflags', '+faststart', out]).done;
  const muxSecs = (Date.now() - t0) / 1000 - frameSecs;
  if (opts.framemd5) {
    // ffmpeg's lines: stream_index, dts, pts, duration, size, md5
    const md5s = readFileSync(md5File, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.split(',').at(-1).trim());
    if (md5s.length !== n) throw new Error(`framemd5: ${md5s.length} of ${n} frames`);
    writeFileSync(path.resolve(opts.framemd5), md5s.map((h, k) => `${k},${h}\n`).join(''));
    console.log(`frame md5s → ${path.resolve(opts.framemd5)}`);
  }

  // The share copy, in two passes over the master.
  let shareSecs = 0;
  if (SHARE) {
    const t1 = Date.now(), kbps = shareVideoKbps(MB_PER_MIN), passlog = path.join(tmp, 'share');
    console.log(`share copy: 1920×1080, 30 fps, ${kbps} kbit/s + AAC 128k (${MB_PER_MIN} MB a minute), two passes`);
    for (const pass of [1, 2]) await run('ffmpeg', shareArgs({ input: out, pass, kbps, out: shareOut, passlog })).done;
    shareSecs = (Date.now() - t1) / 1000;
  }

  // The sheet: the master's first frame and one every 10 s after, 384 px wide, six to a row.
  const tiles = Math.max(1, Math.floor((secs - 1e-9) / 10) + 1), cols = Math.min(6, tiles), rows = Math.ceil(tiles / cols);
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', out, '-vf',
    `select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,10)',scale=384:-2,tile=${cols}x${rows}`,
    '-fps_mode', 'vfr', '-frames:v', '1', '-update', '1', sheetOut]).done;

  const total = (Date.now() - tStart) / 1000;
  console.log(`done: ${clock(secs)} of video in ${clock(total)} (frames ${(frameSecs / secs).toFixed(2)} s per video second, `
    + `sound ${(muxSecs / secs).toFixed(2)}${SHARE ? `, share ${(shareSecs / secs).toFixed(2)}` : ''})`
    + (eta ? `; the ETA said ${clock(eta.total)} (${(100 * (total - eta.total) / eta.total).toFixed(0)} % off)` : ''));
  const mb = (f) => `${(statSync(f).size / 1e6).toFixed(1)} MB`;
  console.log(`master → ${out} (${mb(out)})`);
  if (SHARE) console.log(`share → ${shareOut} (${mb(shareOut)}; send it in WhatsApp as a document)`);
  console.log(`sheet → ${sheetOut}`);
  const errs = Object.entries(widgetErrors);
  if (errs.length) { console.log('widgets that stopped (the rest of the picture went on):'); for (const [id, e] of errs) console.log(`  ${id}: ${e}`); }
  if (pageErrors.length) { console.error(`page errors:\n  ${[...new Set(pageErrors)].join('\n  ')}`); code = 1; }
} catch (e) {
  if (cancelled) code = 130;   // what a cancel's closing does to the page: not an error
  else { console.error(`render-show: ${e.message ?? e}`); code = 1; }
} finally {
  await cleanup();
}
process.exit(code);
