// Recording in the studio, in a real Chrome (plan T6 step 3): the studio-check's 30 s test song in temp songs/shows
// folders, its own Vite server, Chrome with autoplay allowed and downloads accepted. Records through the Export menu
// and reads what Chrome wrote with ffprobe:
//   · 20 s with ?recordCheck=20 → H.264 video, AAC audio, 20 ± 1 s, at most a third of 1.4 × the "share" preset's MB a
//     minute (15.2 → 7.1 MB);
//   · the whole song with no hook → it stops by itself at the end, 30 ± 1 s;
//   · a hidden tab mid-recording → the song and the recorder pause, back in front both go on, the file is still 20 ± 1 s;
//   · seeks and edits are ignored while it records.
//
//   npm run record-check [-- --headed] [--keep] [--out <dir>]
//   npm run record-check -- --song prelude [--seconds 60] [--from 0] [--preset share|high] [--out <dir>]
//       the second form records a real song from songs/ (its show, or an empty timeline; nothing is written to
//       shows/), from the start or (--from) from the playhead put there, and prints the MB a minute Chrome really writes.
//
// Local only: needs ffmpeg/ffprobe and system Chrome. The recordings are kept only with --keep or --out.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i < 0 ? dflt : argv[i + 1]; };
const HEADED = argv.includes('--headed'), KEEP = argv.includes('--keep');
const SONG = opt('song'), SECONDS = Number(opt('seconds', 60)), PRESET = opt('preset', 'share'), FROM = Number(opt('from', 0));
for (const tool of ['ffmpeg', 'ffprobe']) {
  if (spawnSync(tool, ['-version']).status !== 0) { console.log(`record-check: skipped (no ${tool} on the PATH)`); process.exit(0); }
}

const tmp = mkdtempSync(path.join(tmpdir(), 'wa-record-check-'));
const out = path.resolve(opt('out', path.join(tmp, 'out')));
mkdirSync(out, { recursive: true });
const shows = path.join(tmp, 'shows');
mkdirSync(shows);
process.env.WINKELAMP_SHOWS = shows;
if (!SONG) process.env.WINKELAMP_SONGS = path.join(tmp, 'songs');

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

/** What a video file holds: its streams' codecs, its length (the container's, else the last packet's end) and size. */
function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=index,codec_type,codec_name,width,height,duration,avg_frame_rate:format=duration,format_name,size',
    '-of', 'json', file], { encoding: 'utf8' });
  const j = JSON.parse(r.stdout || '{}');
  const streams = j.streams ?? [];
  const lastPts = (sel) => {
    const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', sel, '-show_entries', 'packet=pts_time,duration_time', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    let end = 0;
    for (const line of p.stdout.split(/\r?\n/)) { const [pts, d] = line.split(',').map(Number); if (Number.isFinite(pts)) end = Math.max(end, pts + (Number.isFinite(d) ? d : 0)); }
    return end;
  };
  const container = Number(j.format?.duration);
  const video = streams.find((s) => s.codec_type === 'video'), audio = streams.find((s) => s.codec_type === 'audio');
  const ends = { video: video ? lastPts('v:0') : 0, audio: audio ? lastPts('a:0') : 0 };
  return {
    format: j.format?.format_name, video: video?.codec_name, audio: audio?.codec_name, width: video?.width, height: video?.height,
    container: Number.isFinite(container) ? container : null, ends, seconds: Math.max(ends.video, ends.audio),
    bytes: statSync(file).size,
  };
}
const fmt = (p) => `${p.format}: ${p.video ?? 'no video'} ${p.width}×${p.height} + ${p.audio ?? 'no audio'}, ${p.seconds.toFixed(2)} s `
  + `(container ${p.container === null ? 'n/a' : p.container.toFixed(2)}, video ends ${p.ends.video.toFixed(2)}, audio ${p.ends.audio.toFixed(2)}), ${(p.bytes / 1e6).toFixed(2)} MB`;

let songId = SONG, duration = 0;
if (!SONG) {
  // The studio-check's song: 30 s of a sine with the fixture's chords as its notes, and a show of three clips.
  const songs = process.env.WINKELAMP_SONGS;
  mkdirSync(songs);
  const wav = path.join(tmp, 'demo.wav');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=220:d=30', wav]);
  const ing = spawnSync(process.execPath, ['--import', 'tsx', path.join(ROOT, 'scripts/ingest.ts'), wav, '--id', 'demo', '--title', 'Record check: Demo',
    '--notes', path.join(ROOT, 'scripts/fixtures/demo-notes.json')], { cwd: ROOT, encoding: 'utf8', env: process.env, timeout: 120_000 });
  if (ing.status !== 0) { console.error(ing.stdout, ing.stderr); process.exit(1); }
  const pack = JSON.parse(readFileSync(path.join(songs, 'demo', 'pack.json'), 'utf8'));
  duration = pack.duration;
  const D = Math.round(pack.duration * 1000) / 1000;
  writeFileSync(path.join(shows, 'demo.json'), `${JSON.stringify({ version: 3, id: 'demo', song: 'demo', title: 'Record check', clips: [
    { id: 'c1', start: 0, end: D, track: 0, widget: 'kandinsky' }, { id: 'c2', start: 0, end: 10, track: 1, widget: 'squares' }, { id: 'c3', start: 20, end: D, track: 1, widget: 'casket' },
  ] }, null, 2)}\n`);
  songId = 'demo';
} else {
  // A real song: its show from shows/ when there is one (copied, so nothing is written there), else the studio composes.
  const own = path.join(ROOT, 'shows', `${SONG}.json`);
  try { writeFileSync(path.join(shows, `${SONG}.json`), readFileSync(own)); } catch { /* composed in the page */ }
}

const vite = await createServer({ root: ROOT, logLevel: 'error', server: { host: '127.0.0.1', port: 5198, strictPort: false, hmr: false } });
await vite.listen();
const BASE = vite.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ channel: 'chrome', headless: !HEADED, args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];

/** Opens the studio on the song, then records through the Export menu; `during(page)` runs while it records. */
async function record(name, query, { preset = 'share', during, from = 0 } = {}) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  await page.route(/127\.0\.0\.1:5175\//, (r) => r.abort());   // never the user's own ears server
  await page.addInitScript((p) => { try { localStorage.setItem('wa-studio.record-preset', p); } catch {} }, preset);
  await page.goto(`${BASE}/?song=${songId}${query}`);
  await page.waitForFunction(() => window.__studio?.player.duration > 0, null, { timeout: 30_000 });
  if (from > 0) {
    await page.evaluate((t) => window.__studio.player.seek(t), from);
    await page.waitForFunction((t) => Math.abs(window.__studio.player.time - t) < 0.5, from, { timeout: 10_000 });
  }
  await page.click('[data-export]');
  const wall = Date.now();
  const download = page.waitForEvent('download', { timeout: 15 * 60_000 });
  await page.click(from > 0 ? '[data-rec="here"]' : '[data-rec="song"]');
  await page.waitForFunction(() => window.__studio.recorder.state === 'recording' && !window.__studio.player.audio.paused, null, { timeout: 10_000 });
  const mime = await page.evaluate(() => window.__studio.recorder.mimeType);
  const extra = during ? await during(page) : null;
  const d = await download;
  const file = path.join(out, d.suggestedFilename());
  await d.saveAs(file);
  const after = await page.evaluate(() => ({ state: window.__studio.recorder.state, recording: window.__studio.store.state.ui.recording, notices: [...document.querySelectorAll('.notice')].map((n) => n.textContent) }));
  await page.close();
  return { file, mime, wall: (Date.now() - wall) / 1000, probe: probe(file), extra, after };
}

try {
  if (SONG) {
    // The real thing: how many MB a minute does Chrome write for this song's picture?
    const r = await record(SONG, `&recordCheck=${SECONDS}`, { preset: PRESET, from: FROM });
    const mbMin = (r.probe.bytes / 1e6) / (r.probe.seconds / 60);
    console.log(`${SONG}, ${PRESET}: ${r.mime}\n  ${fmt(r.probe)}\n  ${mbMin.toFixed(2)} MB a minute (${r.wall.toFixed(1)} s to record) → ${r.file}`);
    check('Chrome wrote H.264 + AAC in MP4', r.probe.video === 'h264' && r.probe.audio === 'aac' && /mp4/.test(r.probe.format), r.mime);
    check(`${SECONDS} ± 1 s`, Math.abs(r.probe.seconds - SECONDS) <= 1, r.probe.seconds.toFixed(2));
    const { RECORD_PRESETS, mbPerMinute } = await vite.ssrLoadModule('/src/studio/ui/record.ts');
    const aim = mbPerMinute(RECORD_PRESETS[PRESET]);
    check(`at most 1.4 × the ${aim} MB a minute "${PRESET}" aims at`, mbMin <= aim * 1.4, `${(mbMin / aim).toFixed(2)} ×`);
  } else {
    // 20 s with the hook.
    const a = await record('20 s', '&recordCheck=20', {
      during: async (page) => {
        // Seeks and edits wait while it records.
        await page.waitForTimeout(1500);
        return page.evaluate(() => {
          const st = window.__studio, t0 = st.player.audio.currentTime, show = st.store.state.show;
          st.player.seek(25);
          st.store.dispatch({ type: 'edit', edit: { kind: 'setClip', clip: 'c1', patch: { fade: 0 } } });
          return { moved: Math.abs(st.player.audio.currentTime - t0) > 1, edited: st.store.state.show !== show,
            undo: document.querySelector('[data-undo]').disabled, exportHidden: document.querySelector('.export').hidden, rec: document.querySelector('.rec-text').textContent };
        });
      },
    });
    console.log(`  ${a.mime}\n  ${fmt(a.probe)}`);
    check('the recording is MP4 with H.264 video and AAC audio', a.probe.video === 'h264' && a.probe.audio === 'aac' && /mp4/.test(a.probe.format) && /^video\/mp4/.test(a.mime), a.mime);
    check('?recordCheck=20 stops it after 20 ± 1 s and saves it', Math.abs(a.probe.seconds - 20) <= 1 && a.after.state === 'idle' && !a.after.recording, `${a.probe.seconds.toFixed(2)} s`);
    const { RECORD_PRESETS, mbPerMinute } = await vite.ssrLoadModule('/src/studio/ui/record.ts');
    const limit = (mbPerMinute(RECORD_PRESETS.share) * 1.4) / 3;
    check(`20 s at "share" is at most ${limit.toFixed(2)} MB`, a.probe.bytes <= limit * 1e6, `${(a.probe.bytes / 1e6).toFixed(2)} MB`);
    check('the picture is 1280×720', a.probe.width === 1280 && a.probe.height === 720, `${a.probe.width}×${a.probe.height}`);
    check('seeks and edits wait while it records; undo is off, the REC indicator shows', a.extra && !a.extra.moved && !a.extra.edited && a.extra.undo && a.extra.exportHidden && /^REC 0:0\d \/ 0:20$/.test(a.extra.rec), JSON.stringify(a.extra));
    check('it says where the file went', a.after.notices.some((n) => /Saved demo-.*\.mp4/.test(n)), a.after.notices.join(' | '));

    // The whole song with no hook: it stops by itself at the end.
    const b = await record('whole song', '');
    check('the whole song stops by itself at its end: 30 ± 1 s', Math.abs(b.probe.seconds - duration) <= 1 && b.after.state === 'idle', `${b.probe.seconds.toFixed(2)} s of ${duration.toFixed(2)}, ${(b.probe.bytes / 1e6).toFixed(2)} MB`);

    // A hidden tab pauses the song and the recorder; back in front both go on; the file is still 20 s of song.
    const c = await record('hidden', '&recordCheck=20', {
      during: async (page) => {
        await page.waitForTimeout(5000);
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForTimeout(300);
        const hidden = await page.evaluate(() => ({ audioPaused: window.__studio.player.audio.paused, recorder: window.__studio.recorder.recorderState, state: window.__studio.recorder.state, t: window.__studio.player.audio.currentTime }));
        await page.waitForTimeout(2000);
        const still = await page.evaluate(() => window.__studio.player.audio.currentTime);
        await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForTimeout(600);
        const back = await page.evaluate(() => ({ audioPaused: window.__studio.player.audio.paused, recorder: window.__studio.recorder.recorderState, state: window.__studio.recorder.state }));
        return { hidden, held: Math.abs(still - hidden.t) < 0.05, back };
      },
    });
    const x = c.extra;
    check('hidden: the song and the recorder pause', x.hidden.audioPaused && x.hidden.recorder === 'paused' && x.hidden.state === 'paused' && x.held, JSON.stringify(x.hidden));
    check('back in front: both go on', !x.back.audioPaused && x.back.recorder === 'recording' && x.back.state === 'recording', JSON.stringify(x.back));
    check('the file is still 20 ± 1 s', Math.abs(c.probe.seconds - 20) <= 1, `${c.probe.seconds.toFixed(2)} s after ${c.wall.toFixed(1)} s of recording`);
  }
  check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  await vite.close();
  if (!KEEP) rmSync(tmp, { recursive: true, force: true });   // an --out folder elsewhere stays
  if (KEEP || opt('out')) console.log(`recordings in ${out}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\nrecord-check: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
