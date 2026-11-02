// The redo dialog in a real browser (MuScriptor plan T4): the studio on the fixture song, its own Vite server from 5190,
// ears servers on free ports with a fake ingest and fake probes. The button shows; the dialog states both durations and
// the licence; Start is off with MuScriptor and no list, on with a preset; a typed list is checked as typed; the studio's
// keys stay out of the dialog; a probe that is not ok disables MuScriptor and shows why; Start's POST carries the choice;
// the progress line shows the fake's chunk message; a finished run ends in the Reopen notice, not a reload; the overnight
// file is offered with its list; no ears server says what to start.
//
//   npm run redo-check [-- --headed] [--keep]
//
// It writes renders/look/T4/redo-dialog.png and redo-dialog-short.png, -phone, -overnight, -off and redo-progress.png (a
// copy of songs/vivaldi-winter when it is there, so with real durations; else the fixture). Local only: needs ffmpeg and
// system Chrome. It never starts a model.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checker, needFfmpeg, openStudio, ROOT } from '../lib/studio-session.mjs';

const argv = process.argv.slice(2);
const HEADED = argv.includes('--headed'), KEEP = argv.includes('--keep');
const LOOK = path.join(ROOT, 'renders', 'look', 'T4');
mkdirSync(LOOK, { recursive: true });
needFfmpeg('redo-check');
const { check, finish } = checker();

const CHUNKS = 'MuScriptor: 34 of 122 chunks, about 12 min left';
// A stand-in for the ingest: stays in the instruments stage past a few polls, then ends. It leaves the pack as it is.
const FAKE = String.raw`
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const args = process.argv.slice(1), id = args[args.indexOf('--id') + 1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  out({ stage: 'decode', progress: 1, overall: 0.01, message: 'decode', id });
  out({ stage: 'instruments', progress: 0.3, overall: 0.3, message: process.env.FAKE_MESSAGE, id });
  await sleep(1600);
  out({ stage: 'write', progress: 1, overall: 0.99, message: 'write', id });
  out({ stage: 'done', progress: 1, message: 'done', id, warnings: process.env.FAKE_WARN ? [process.env.FAKE_WARN] : [] });
})();`;

const st = await openStudio({ songs: 'fixture', headed: HEADED, keep: KEEP, port: 5190, viewport: { width: 1280, height: 800 }, shows: (packs) => {
  const D = Math.round(packs.demo.duration * 1000) / 1000;
  return { demo: { version: 1, id: 'demo', song: 'demo', title: 'Redo check', sections: [{ start: 0, end: D, label: 'One', layers: [{ widget: 'kandinsky' }] }] } };
} });
const { page, base, errors, dirs, packs, vite } = st;
const { startEars } = await vite.ssrLoadModule('/scripts/ears/server.ts');
const { estimateWords } = await vite.ssrLoadModule('/src/studio/ingest/transcribe-options.ts');
const { listKey, MS_MODEL, MS_PRESETS } = await vite.ssrLoadModule('/src/studio/pack/muscriptor.ts');

const OK = async () => ({ ok: true, python: 'py' });
const OK_T = async () => ({ ok: true, python: 'py', device: 'cuda' });
const WHY = 'MuScriptor is not set up: no muscriptor.json (npm run setup-muscriptor)';
const calls = [];
let warn = '';
const earsWith = (probeMuscriptor) => startEars({
  port: 0, songs: dirs.songs, probe: OK_T, probeYmt3: OK, probeBp: OK, probeMuscriptor,
  runIngest: (args) => {
    calls.push(args);
    return spawn(process.execPath, ['-e', FAKE, ...args], { env: { ...process.env, FAKE_MESSAGE: CHUNKS, FAKE_WARN: warn } });
  },
});
const good = await earsWith(OK), bad = await earsWith(async () => ({ ok: false, python: null, reason: WHY }));

const demo = path.join(dirs.songs, 'demo');
const sha1 = packs.demo.source.sha1;
const D = packs.demo.duration;

/** Opens the studio on a song, its Show tab, and the dialog. */
async function openDialog(port, song = 'demo') {
  await page.goto(`${base}/?song=${song}&ears=${port}`);
  await page.waitForFunction(() => window.__studio?.player.duration > 0, null, { timeout: 60_000 });
  await page.click('[data-tab="show"]');
  await page.click('[data-act="redo-transcription"]');
  await page.waitForSelector('dialog.redo-dialog[open]');
}
const dialogText = () => page.locator('dialog.redo-dialog').innerText();
const startOff = () => page.locator('[data-go]').isDisabled();
const pickEngine = (v) => page.check(`input[name="engine"][value="${v}"]`);
const pickList = (v) => page.check(`input[name="list"][value="${v}"]`);

try {
  // ---- The dialog ------------------------------------------------------------------------------------------------
  await openDialog(good.port);
  let text = await dialogText();
  check('the button shows and opens the dialog', /Redo the transcription/.test(text));
  const y = estimateWords('ymt3', D, false), m = estimateWords('muscriptor', D, false);
  check('the dialog states both durations for the song', text.includes(y) && text.includes(m), `${y} | ${m}`);
  check('the licence is there before anything is chosen', /non-commercial licence/i.test(text));
  check('it says which transcriber made the tracks', /no instrument tracks now/.test(text), text.split('\n')[1]);
  check('YourMT3+ is the default, and Start is on', await page.isChecked('input[name="engine"][value="ymt3"]') && !(await startOff()));

  // The studio's keys stay out of it.
  await page.focus('input[name="engine"][value="muscriptor"]');
  await page.keyboard.press('Space');
  const playing = await page.evaluate(() => window.__studio.player.playing);
  check('Space on a radio selects it and plays nothing', await page.isChecked('input[name="engine"][value="muscriptor"]') && !playing, `playing ${playing}`);
  const sections = await page.evaluate(() => window.__studio.store.state.show.sections.length);
  await page.keyboard.press('s');
  check('s splits no section under the dialog', (await page.evaluate(() => window.__studio.store.state.show.sections.length)) === sections);

  check('Start is off with MuScriptor and no list', await startOff());
  await pickList('strings');
  check('Start is on with a preset', !(await startOff()));
  await pickList('own');
  await page.fill('.redo-own', 'violin, oboo');
  let why = await page.locator('.redo-why').innerText();
  check('an unknown name in an own list turns Start off and says why', await startOff() && /oboo/.test(why), why.slice(0, 60));
  await page.fill('.redo-own', 'string_ensemble');
  why = await page.locator('.redo-why').innerText();
  check('string_ensemble is refused as typed', await startOff() && /string_ensemble/.test(why), why.slice(0, 60));
  await page.fill('.redo-own', 'violin, viola');
  check('a good own list turns Start on', !(await startOff()));
  await page.keyboard.press('Escape');
  check('Escape cancels, and no job ran', (await page.locator('dialog.redo-dialog').count()) === 0 && calls.length === 0);

  // A saved result says so, for its list only.
  const row = [1, 2, 60, 100, 'Violin'];
  const cache = { version: 1, sha1, model: MS_MODEL, package: '0.4.0', instruments: MS_PRESETS.strings, dtype: 'float32', seconds: 600, notes: [row] };
  writeFileSync(path.join(demo, `notes.muscriptor-${listKey(MS_PRESETS.strings)}.json`), JSON.stringify(cache));
  writeFileSync(path.join(demo, 'notes.ymt3.json'), JSON.stringify({ version: 1, sha1, notes: [] }));
  await openDialog(good.port);
  await pickEngine('muscriptor');
  await pickList('baroque');
  const notSaved = await page.locator('[data-time="muscriptor"]').innerText();
  await pickList('strings');
  const saved = await page.locator('[data-time="muscriptor"]').innerText();
  check('a saved result for the chosen list says "under a minute (saved)", and only for it', saved === 'under a minute (saved)' && notSaved === m, `${notSaved} | ${saved}`);

  // ---- Start ------------------------------------------------------------------------------------------------------
  const posts = [];
  const onRequest = (r) => { if (r.method() === 'POST' && /\/ingest\?/.test(r.url())) posts.push(r.url()); };
  page.on('request', onRequest);
  await page.evaluate(() => { window.__notReloaded = true; });
  warn = 'MuScriptor failed (CUDA out of memory): the tracks come from YourMT3+';
  await pickList('baroque');
  await page.click('[data-go]');
  await page.waitForFunction((t) => document.querySelector('.adding-msg')?.textContent.includes(t), CHUNKS, { timeout: 15_000 });
  const line = await page.locator('.adding-msg').innerText();
  check('the progress line shows the job\'s chunk message', line.includes(CHUNKS), line);
  await page.screenshot({ path: path.join(LOOK, 'redo-progress.png') });
  const q = new URL(posts[0]).searchParams;
  check("Start's POST carries the choice", q.get('engine') === 'muscriptor' && q.get('instruments') === 'baroque' && q.get('redo') === '1' && q.get('id') === 'demo' && !q.has('overnight'), posts[0]);
  const args = calls[calls.length - 1];
  check('the ingest gets the transcriber and its list', args[args.indexOf('--instruments-model') + 1] === 'muscriptor' && args[args.indexOf('--instruments') + 1] === 'baroque' && args.includes('--force'), args.slice(1).join(' ').replace(/.*--notes/, '--notes'));
  await page.locator('.notice button', { hasText: 'Reopen' }).waitFor({ timeout: 15_000 });
  const notices = await page.locator('.notice').allInnerTexts();
  check('the finished run ends in the Reopen notice, not a reload', await page.evaluate(() => window.__notReloaded === true), notices.join(' | '));
  check('the notice does not speak of edits there are none of', notices.some((n) => /reopen it to play/.test(n) && !/unsaved edits/.test(n)));
  check("MuScriptor's fallback warning is said", notices.some((n) => /^MuScriptor failed/.test(n)));
  await page.locator('.notice button', { hasText: 'Reopen' }).click();
  await page.waitForFunction(() => window.__notReloaded === undefined && window.__studio?.player.duration > 0, null, { timeout: 60_000 });
  check('Reopen reloads it', true);
  warn = '';

  // ---- A probe that is not ok ---------------------------------------------------------------------------------------
  await new Promise((r) => setTimeout(r, 200));
  await openDialog(bad.port);
  const off = page.locator('input[name="engine"][value="muscriptor"]');
  text = await dialogText();
  check('a probe that is not ok disables MuScriptor and shows why', await off.isDisabled() && text.includes(WHY), text.includes(WHY) ? WHY : text);
  check('YourMT3+ can still start', !(await startOff()));
  await page.screenshot({ path: path.join(LOOK, 'redo-dialog-off.png') });
  await page.keyboard.press('Escape');

  // ---- The overnight file ---------------------------------------------------------------------------------------------
  const night = { model: MS_MODEL, instruments: { violin: 1, acoustic_piano: 1 }, zeroLength: 0, notes: [[1, 2, 60, 100, 'violin'], [2, 3, 62, 100, 'viola'], [3, 4, 62, 100, 'acoustic_piano']] };
  writeFileSync(path.join(demo, 'notes.muscriptor-large.json'), JSON.stringify(night));
  await openDialog(good.port);
  await pickEngine('muscriptor');
  const box = page.locator('input[name="overnight"]');
  text = await dialogText();
  check('the overnight notes are offered and on, with their list preset', await box.isChecked() && await page.isChecked('input[name="list"][value="baroque"]') && /violin, viola, acoustic piano; 3 notes/.test(text));
  check('with them the time is the saved one', (await page.locator('[data-time="muscriptor"]').innerText()) === 'under a minute (saved)');
  await pickList('classical');
  check('another list unticks them', !(await box.isChecked()));
  await box.check();
  check('ticking them brings their list back', await page.isChecked('input[name="list"][value="baroque"]') && !(await startOff()));
  posts.length = 0;
  await page.click('[data-go]');
  await page.locator('.notice button', { hasText: 'Reopen' }).waitFor({ timeout: 15_000 });
  const nq = new URL(posts[0]).searchParams;
  const nargs = calls[calls.length - 1];
  check("Start's POST carries overnight=1, and the ingest imports the file", nq.get('overnight') === '1' && nargs[nargs.indexOf('--muscriptor-notes') + 1] === path.join(demo, 'notes.muscriptor-large.json'), nargs[nargs.indexOf('--muscriptor-notes') + 1]);
  page.off('request', onRequest);

  // ---- No ears server ----------------------------------------------------------------------------------------------
  await page.goto(`${base}/?song=demo&ears=off`);
  await page.waitForFunction(() => window.__studio?.player.duration > 0, null, { timeout: 60_000 });
  await page.click('[data-tab="show"]');
  await page.click('[data-act="redo-transcription"]');
  await page.locator('.notice', { hasText: 'npm run ears' }).waitFor({ timeout: 5000 });
  check('without an ears server the notice says to start it', (await page.locator('dialog.redo-dialog').count()) === 0);

  // ---- The Look: a real song's durations, at a normal and a short window ----------------------------------------------
  const real = path.join(ROOT, 'songs', 'vivaldi-winter');
  let song = 'demo';
  if (existsSync(path.join(real, 'pack.json'))) {
    cpSync(real, path.join(dirs.songs, 'vivaldi-winter'), { recursive: true });
    song = 'vivaldi-winter';
  }
  const fits = async (name) => {
    const r = await page.evaluate(() => {
      const box = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
      return { dialog: box('dialog.redo-dialog'), start: box('[data-go]'), licence: box('[data-licence]'), h: innerHeight, w: innerWidth, sideways: document.querySelector('.redo-body').scrollWidth > document.querySelector('.redo-body').clientWidth };
    });
    check(`${name}: the dialog and Start are inside the window, nothing sideways`, r.dialog.top >= 0 && r.dialog.bottom <= r.h && r.start.bottom <= r.h && r.dialog.right <= r.w && !r.sideways, JSON.stringify({ dialog: [r.dialog.top, r.dialog.bottom], start: r.start.bottom, h: r.h }));
    check(`${name}: the licence is seen above Start`, r.licence.top >= r.dialog.top && r.licence.bottom < r.start.top, JSON.stringify({ licence: r.licence.bottom, start: r.start.top }));
  };
  // First as it opens with the saved results (the tallest it gets), then with nothing saved: both durations in full.
  if (song !== 'demo') {
    await openDialog(good.port, song);
    await pickEngine('muscriptor');
    await page.screenshot({ path: path.join(LOOK, 'redo-dialog-overnight.png') });
    await fits('saved, 1280×800');
    await page.setViewportSize({ width: 1280, height: 480 });
    await fits('saved, 1280×480');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.keyboard.press('Escape');
    for (const f of readdirSync(path.join(dirs.songs, song))) if (/^notes\.(ymt3|muscriptor-.*)\.json$/.test(f)) rmSync(path.join(dirs.songs, song, f));
  }
  await openDialog(good.port, song);
  await pickEngine('muscriptor');
  await pickList('baroque');
  if (song !== 'demo') {
    const shown = await dialogText();
    const dur = JSON.parse(readFileSync(path.join(dirs.songs, song, 'pack.json'), 'utf8')).duration;
    const a = estimateWords('ymt3', dur, false), b = estimateWords('muscriptor', dur, false);
    check('a real song states both durations in full', shown.includes(a) && shown.includes(`${b}, plus ${a} for YourMT3+`) && /GPU stays busy/.test(shown), `${a} | ${b}`);
  }
  await page.screenshot({ path: path.join(LOOK, 'redo-dialog.png') });
  await fits('1280×800');
  await page.setViewportSize({ width: 1280, height: 480 });
  await page.evaluate(() => { document.querySelector('.redo-body').scrollTop = 0; });
  await page.screenshot({ path: path.join(LOOK, 'redo-dialog-short.png') });
  await fits('1280×480');
  await page.setViewportSize({ width: 375, height: 700 });
  await page.screenshot({ path: path.join(LOOK, 'redo-dialog-phone.png') });
  await fits('375×700');

  check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  await st.close();
  await good.close();
  await bad.close();
}
process.exit(finish('redo-check'));
