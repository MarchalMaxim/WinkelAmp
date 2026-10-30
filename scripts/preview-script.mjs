// Preview of a composed show, so its composer can see what it wrote: plays the
// song in the real app (system Chrome, real WebGL2; the app finds the script by
// the recording's fingerprint, as it would for a user), and for every cue saves a
// still of the stage just after it lands, then a contact sheet of them all.
//
//   npm run preview-script -- <slug> <audio file>   a recording script: the file the study was made from
//   npm run preview-script -- <slug>                a study script: the app plays the study at its seed
//   options: [--lead 2] [--port 5198] [--headed]
//
// Writes study/<slug>/preview/cue-NN.png (NN = the cue's index in the timeline;
// cues within 50 ms share one still) and contact.png (contact-2.png… past 24 stills).
// Each still is taken after its cue has had time to show (an accent at its peak, a
// fade or blend once it is done, up to 4 s on when the next cue is far off) but
// before the next cue. A recording is seeked
// to `lead` seconds before each still and played into it, so trails and the music
// clock are warm; a study can't seek and is watched from its start.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { createServer } = await import('vite');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? dflt : argv[i + 1];
};
const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1]?.startsWith('--') && argv[i - 1] !== '--headed'));
const [slug, audioArg] = positional;
const PORT = Number(opt('port', 5198));
const LEAD = Number(opt('lead', 2));
const PER_SHEET = 24;
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
if (!slug) fail('usage: npm run preview-script -- <slug> [<audio file>] [--lead 2] [--port 5198] [--headed]');

const scriptFile = path.join(REPO, 'corpus', `${slug}.json`);
if (!existsSync(scriptFile)) fail(`no script at ${scriptFile}`);
const script = JSON.parse(readFileSync(scriptFile, 'utf8').replace(/^﻿/, ''));
const study = script.match?.kind === 'study';
let data;
if (!study) {
  const dataFile = path.join(REPO, 'corpus', `${slug}.data.json`);
  if (!existsSync(dataFile)) fail(`no song data at ${dataFile}: run npm run study -- <audio file> --id ${slug}`);
  data = JSON.parse(readFileSync(dataFile, 'utf8'));
  if (!audioArg) fail(`${slug} is a recording script: pass the audio file it was studied from`);
  if (!existsSync(audioArg)) fail(`no audio file at ${audioArg}`);
}

const outDir = path.join(REPO, 'study', slug, 'preview');
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (/^(cue-\d+|contact(-\d+)?)\.png$/.test(f)) rmSync(path.join(outDir, f));

/** What a cue does, in a few words (for the contact sheet). */
function describe(c) {
  if ('scene' in c) return `scene "${c.scene}" (${c.transition?.kind ?? 'blend'}${c.transition?.kind === 'cut' ? '' : ` ${c.transition?.duration ?? 1.5} s`})`;
  if ('enter' in c) return `enter ${c.enter.id} (${c.enter.type}${c.enter.params?.style ? ` ${c.enter.params.style}` : ''})`;
  if ('exit' in c) return `exit ${c.exit}`;
  if ('accent' in c) return `accent ${c.accent.kind}${c.accent.color ? ` ${c.accent.color}` : ''}`;
  if ('ramp' in c) return `ramp ${c.ramp.target} → ${c.ramp.to} over ${c.ramp.duration} s`;
  return '?';
}

/** How long after a cue its effect is fully on screen (seconds). */
function settle(c) {
  if ('accent' in c) return 0.25; // the accent near its peak
  if ('scene' in c) return c.transition?.kind === 'cut' ? 0.5 : Math.min(2, c.transition?.duration ?? 1.5) + 0.3;
  if ('enter' in c) return (c.fade ?? 0.8) + 0.3;
  if ('exit' in c) return (c.fade ?? 1.2) + 0.3;
  if ('ramp' in c) return Math.min(3, c.ramp.duration) + 0.1;
  return 0.5;
}

const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

const server = await createServer({ root: REPO, logLevel: 'error', server: { port: PORT, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  channel: 'chrome',
  headless: !argv.includes('--headed'),
  args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist'],
});
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', (m) => m.type() === 'error' && console.log('[page error]', m.text()));
  page.on('pageerror', (e) => console.log('[page exception]', e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.winkel, null, { timeout: 30000 });
  if ((await page.evaluate(() => window.winkel.mode())) !== 'stage') throw new Error('the app fell back to Classic (no WebGL2?)');

  // The app's own validator and player: the same snapped cue times the show will use.
  const info = await page.evaluate(async ({ script, data }) => {
    const { validateScript } = await import('/src/stage/script.ts');
    const { ScriptPlayer } = await import('/src/stage/player.ts');
    const v = validateScript(script);
    return v.ok ? { cueTimes: new ScriptPlayer(v.script, data).cueTimes } : { errors: v.errors };
  }, { script, data });
  if (info.errors) throw new Error(`the script does not validate (npm run check-script -- corpus/${slug}.json):\n  ${info.errors.join('\n  ')}`);

  // Cues in the order they apply; cues within 50 ms share a still.
  const order = script.timeline.map((c, i) => ({ c, i, t: info.cueTimes[i] })).sort((a, b) => a.t - b.t || a.i - b.i);
  const shots = [];
  for (const cue of order) {
    const last = shots[shots.length - 1];
    if (last && cue.t - last.t <= 0.05) last.cues.push(cue);
    else shots.push({ t: cue.t, cues: [cue] });
  }
  const end = study ? Infinity : data.duration - 0.1;
  // An accent at its peak; anything else once it has settled and, when the next cue is
  // far off, a little later (up to 4 s), so the scene has met some music.
  shots.forEach((s, k) => {
    const next = shots[k + 1]?.t ?? Math.min(end, s.t + 10);
    const accent = s.cues.some((x) => 'accent' in x.c);
    const wait = accent ? settle({ accent: {} }) : Math.min(4, Math.max(...s.cues.map((x) => settle(x.c)), 0.4 * (next - s.t)));
    s.at = Math.min(end, Math.max(s.t + 0.1, Math.min(s.t + wait, next - 0.05)));
  });
  console.log(`${slug}: ${script.timeline.length} cues → ${shots.length} stills`);

  // Start the song and wait for the app to recognise it.
  if (study) await page.evaluate(({ study, seed }) => window.winkel.engine.playStudy(study, { seed }), script.match);
  else await page.setInputFiles('#file-input', path.resolve(audioArg));
  try {
    await page.waitForFunction((title) => window.winkel.show() === title, script.title, { timeout: 60000 });
  } catch {
    throw new Error(study
      ? `the app did not perform ${slug} for study ${script.match.study} seed ${script.match.seed}`
      : `the app did not recognise ${audioArg} as ${slug}: is it the file the study pack was made from?`);
  }

  for (const s of shots) {
    const r = await page.evaluate(async ({ at, lead, study }) => {
      const w = window.winkel;
      const e = w.engine;
      const now = () => (study ? (e.study && e.study.loop === 0 ? e.songTime - e.study.loopStart : NaN) : e.songTime);
      if (!study) {
        const t = now();
        if (t > at || t < at - lead - 4) e.seek(Math.max(0, at - lead) / e.state.duration);
        if (!e.state.playing) await e.togglePlay();
      }
      const started = performance.now();
      const limit = study ? 150000 : (lead + 20) * 1000;
      while (!(now() >= at)) {
        await new Promise((res) => requestAnimationFrame(res));
        if (study && e.study && e.study.loop > 0) return { error: 'the study looped before this cue' };
        if (performance.now() - started > limit) return { error: `song time stuck at ${now().toFixed(2)} s` };
      }
      const t = now();
      const blob = await w.stage().snapshot();
      if (!blob) return { error: 'no snapshot' };
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { t, png: btoa(bin), shown: w.show() };
    }, { at: s.at, lead: LEAD, study });
    const name = `cue-${String(s.cues[0].i).padStart(2, '0')}.png`;
    const what = s.cues.map((x) => describe(x.c)).join(' + ');
    if (r.error) {
      console.log(`FAIL ${name} at ${clock(s.at)}: ${r.error}`);
      failed = true;
      continue;
    }
    writeFileSync(path.join(outDir, name), Buffer.from(r.png, 'base64'));
    Object.assign(s, { name, what, took: r.t });
    console.log(`  ${name}  cue ${clock(s.t)}, still at ${clock(r.t)}  ${what}`);
  }

  // Contact sheets: four stills a row, each captioned with its cue.
  const done = shots.filter((s) => s.name);
  const sheet = await browser.newPage({ viewport: { width: 1340, height: 400 }, deviceScaleFactor: 1 });
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  for (let k = 0; k * PER_SHEET < done.length; k++) {
    const part = done.slice(k * PER_SHEET, (k + 1) * PER_SHEET);
    const cells = part.map((s) => {
      const src = `data:image/png;base64,${readFileSync(path.join(outDir, s.name)).toString('base64')}`;
      return `<figure><img src="${src}"><figcaption><b>#${s.cues[0].i} ${clock(s.t)}</b> ${esc(s.what)} <i>(still ${clock(s.took)})</i></figcaption></figure>`;
    });
    await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>
      body{margin:0;padding:10px;background:#0b0b10;color:#ddd;font:13px/1.3 system-ui,sans-serif}
      h1{font-size:16px;margin:0 0 8px}
      .grid{display:grid;grid-template-columns:repeat(4,320px);gap:10px}
      figure{margin:0} img{width:320px;height:180px;display:block;background:#000}
      figcaption{padding:3px 2px;height:34px;overflow:hidden} b{color:#fff} i{color:#888;font-style:normal}
      </style><h1>${esc(script.title)} — preview ${k + 1}/${Math.ceil(done.length / PER_SHEET)} · cue (time) and what it does; each still is taken just after its cue</h1>
      <div class="grid">${cells.join('')}</div>`);
    await sheet.waitForFunction(() => [...document.images].every((i) => i.complete));
    const file = path.join(outDir, k === 0 ? 'contact.png' : `contact-${k + 1}.png`);
    await sheet.screenshot({ path: file, fullPage: true });
    console.log(`wrote ${file}`);
  }
  if (!done.length) failed = true;
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  failed = true;
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
