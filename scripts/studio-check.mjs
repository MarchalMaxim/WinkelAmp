// The studio in a real browser (plan T4 step 5): a 30 s test song in temp songs/shows folders, its own Vite server,
// system Chrome with autoplay allowed. Checks the library, playing, letterboxing on resize, hiding the controls, a
// boundary drag and its undo, adding the casket and its knob rows, knob pictures equal to the lab card's, Ctrl+S, a
// broken show opening repaired, a fading slot drawing between "without" and "with", a paused picture holding still,
// a jump resetting the picture, and legacy.html loading without page errors.
//
// Then, on a second server with HMR on: Space after a clicked Play, and a show changed on disk (clean: followed; dirty:
// offered). Last, adding a recording from the file input: with the ears server down (analysed in the browser,
// approximate notes) and up without a transcriber (the real ingest CLI, the reason said; the same file twice).
//
//   npm run studio-check [-- --headed] [--keep]
//
// Local only: needs ffmpeg and system Chrome (and lab/notes.js + lab/prelude.mp3 for the lab-card comparison, which is
// skipped without them).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { checker, needFfmpeg, openStudio, ROOT } from './lib/studio-session.mjs';

const argv = process.argv.slice(2);
const HEADED = argv.includes('--headed'), KEEP = argv.includes('--keep');
needFfmpeg('studio-check');

const { check, finish } = checker();

// The song: 30 s of a sine with the fixture's chords as its notes (the session's fixture), and its show.
let GOOD, pack;
const st = await openStudio({ songs: 'fixture', headed: HEADED, keep: KEEP, shows: (packs) => {
  pack = packs.demo;
  const D = Math.round(pack.duration * 1000) / 1000;
  GOOD = { version: 1, id: 'demo', song: 'demo', title: 'Studio check', sections: [
    { start: 0, end: 10, label: 'One', layers: [{ widget: 'kandinsky' }, { widget: 'squares' }] },
    { start: 10, end: 20, label: 'Two', fade: 3, layers: [{ widget: 'kandinsky' }] },
    { start: 20, end: D, label: 'Three', layers: [{ widget: 'kandinsky' }, { widget: 'casket' }] },
  ] };
  return { demo: GOOD };
} });
const { vite, browser, page, errors, base: BASE, dirs: { tmp, songs, shows } } = st;
const { validateShow } = await vite.ssrLoadModule('/src/studio/show/show.ts');

const litShare = (page) => page.evaluate(() => {
  const c = window.__studio.runtime.ctx.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) lit++;
  return lit / (d.length / 4);
});
const hash = (page) => page.evaluate(() => {
  const c = window.__studio.runtime.ctx.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0x811c9dc5; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16);
});
const state = (page) => page.evaluate(() => ({ dirty: document.querySelector('.save-state')?.classList.contains('dirty'), text: document.querySelector('.save-state')?.textContent }));

try {
  // The library lists the song.
  await page.click('[data-songs]');
  const listed = await page.locator('.library .song').allInnerTexts();
  check('the library lists the song', listed.length === 1 && listed[0].includes('Demo'), listed.join(' | '));
  await page.click('.library-sheet [data-close]');

  // A seek before the first play shows the picture there: the poster steps aside.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const seen = { poster: await page.evaluate(() => document.querySelector('[data-poster]').hidden), t: await page.evaluate(() => window.__studio.player.time), lit: await litShare(page) };
  check('a seek before playing shows the picture there, not the poster', seen.poster && Math.abs(seen.t - 5) < 0.1 && seen.lit > 0.005,
    `poster hidden ${seen.poster}, t ${seen.t.toFixed(2)}, ${(seen.lit * 100).toFixed(1)} % lit`);

  // Playing draws.
  await page.evaluate(() => window.__studio.player.play());
  await page.waitForTimeout(2000);
  const lit = await litShare(page);
  check('after 2 s of play the picture is not black', lit > 0.01, `${(lit * 100).toFixed(1)} % lit`);

  // Resizing letterboxes: the canvas stays 1280×720 and the picture is not reset.
  const r0 = await page.evaluate(() => window.__studio.runtime.resets);
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ w: window.__studio.runtime.ctx.canvas.width, h: window.__studio.runtime.ctx.canvas.height, r: window.__studio.runtime.resets, sw: document.documentElement.scrollWidth }));
  check('a resize keeps the canvas 1280×720 and the picture', after.w === 1280 && after.h === 720 && after.r === r0, JSON.stringify(after));
  check('no sideways scrolling at 900 px', after.sw <= 900, `scrollWidth ${after.sw}`);
  await page.setViewportSize({ width: 1280, height: 800 });

  // H hides the controls and brings them back.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('h');
  const hidden = await page.evaluate(() => getComputedStyle(document.querySelector('.top')).display);
  await page.keyboard.press('h');
  const shown = await page.evaluate(() => getComputedStyle(document.querySelector('.top')).display);
  check('H hides the controls and shows them again', hidden === 'none' && shown !== 'none', `${hidden} → ${shown}`);

  // A paused picture holds still (also with the tab hidden); a jump while playing resets it.
  await page.evaluate(() => window.__studio.player.pause());
  await page.waitForTimeout(150);
  const h1 = await hash(page);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1000);
  const h2 = await hash(page);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  check('paused (and hidden), the picture holds still for 1 s', h1 === h2, `${h1} / ${h2}`);
  await page.evaluate(() => window.__studio.player.play());
  await page.waitForTimeout(400);
  const rj = await page.evaluate(() => window.__studio.runtime.resets);
  await page.evaluate(() => { const a = window.__studio.player.audio; a.currentTime = a.currentTime + 3; });
  await page.waitForTimeout(500);
  const rj2 = await page.evaluate(() => window.__studio.runtime.resets);
  check('a jump over 0.5 s resets the picture', rj2 >= rj + 1, `resets ${rj} → ${rj2}`);
  await page.evaluate(() => window.__studio.player.pause());

  // Dragging a boundary makes the show dirty; Ctrl+Z makes it clean.
  check('the saved show opens clean', !(await state(page)).dirty, (await state(page)).text);
  const handle = page.locator('.band .handle').first();
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width / 2 + i * 12, box.y + box.height / 2);
  await page.mouse.up();
  const moved = await page.evaluate(() => window.__studio.store.state.show.sections[1].start);
  const dirty = await state(page);
  check('dragging a boundary moves it and makes the show dirty', moved > 10.5 && dirty.dirty, `boundary at ${moved}, "${dirty.text}"`);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  const undone = await state(page);
  const back = await page.evaluate(() => window.__studio.store.state.show.sections[1].start);
  check('Ctrl+Z puts it back and the show is clean', !undone.dirty && back === 10, `boundary at ${back}, "${undone.text}"`);

  // Adding the casket shows its 5 knob rows, each with its 3 pictures.
  await page.click('.band .sec >> nth=1');
  await page.click('[data-act="add"]');
  await page.click('.pick[data-id="casket"]');
  await page.waitForTimeout(200);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.layer.open .prm')].map((r) => r.querySelectorAll('canvas').length));
  check('adding the casket shows 5 knob rows with 3 pictures each', rows.length === 5 && rows.every((n) => n === 3), JSON.stringify(rows));
  const added = await page.evaluate(() => window.__studio.store.state.show.sections[1].layers.map((l) => l.widget).join(','));
  check('the casket is on top of the section', added === 'kandinsky,casket', added);

  // Ctrl+S saves a show the validator accepts.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => !document.querySelector('.save-state')?.classList.contains('dirty'), null, { timeout: 5000 }).catch(() => {});
  const savedText = readFileSync(path.join(shows, 'demo.json'), 'utf8');
  const v = validateShow(JSON.parse(savedText), { duration: pack.duration });
  check('Ctrl+S writes a show the validator accepts', v.errors.length === 0 && savedText.includes('"casket"'), v.errors.map((e) => e.message).join('; '));

  // The squares' knob pictures equal the lab card's.
  await page.click('.band .sec >> nth=0');
  await page.click('.layer:has-text("Dread squares") .layer-name');
  await page.waitForTimeout(200);
  const studioIcons = await page.evaluate(() => [...document.querySelectorAll('.layer.open .prm')].map((r) => [r.dataset.p, ...[...r.querySelectorAll('canvas[data-i="0"], canvas[data-i="1"]')].map((c) => c.toDataURL())]));
  if (existsSync(path.join(ROOT, 'lab/notes.js'))) {
    const lab = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await lab.route(/localhost:5174/, (r) => r.abort());
    await lab.goto(`${BASE}/lab/index.html?only=squares`);
    await lab.waitForFunction(() => document.querySelectorAll('.tool').length > 10, null, { timeout: 30_000 });
    const labIcons = await lab.evaluate(() => {
      const name = window.TOOLS.find((t) => t.id === 'squares').name;
      const card = [...document.querySelectorAll('.tool')].find((d) => d.querySelector('b')?.firstChild?.textContent === name);
      return [...card.querySelectorAll('.prm')].map((r) => [r.dataset.p, ...[...r.querySelectorAll('canvas[data-i="0"], canvas[data-i="1"]')].map((c) => c.toDataURL())]);
    });
    await lab.close();
    const same = JSON.stringify(studioIcons) === JSON.stringify(labIcons);
    check('the squares knob pictures equal the lab card\'s', same && studioIcons.length > 0, `${studioIcons.length} rows, ${studioIcons.flat().length - studioIcons.length} pictures`);
  } else console.log('skip  the lab-card comparison (no lab/notes.js here)');

  // A fading slot draws between the picture without it and with it (render page, the runtime directly).
  const rp = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  rp.on('pageerror', (e) => errors.push(`render: ${e}`));
  await rp.goto(`${BASE}/render.html?show=demo`);
  await rp.waitForFunction(() => window.renderReady || window.renderFailed, null, { timeout: 30_000 });
  const between = await rp.evaluate(() => {
    const { rt } = window.renderRuntime;
    // The last step crosses the attack at 6.5 s (a bass note: squares draws a new square).
    const at = (w) => { window.renderSeek(5, 1); window.renderTo(6.49); rt.step(6.51, 0.02, [{ id: 'squares', receiving: true, weight: w }]);
      return rt.ctx.g.getImageData(0, 0, 1280, 720).data.slice(); };
    const a = at(0), b = at(0.5), c = at(1), c2 = at(1);
    let same = true, off = 0, changed = 0;
    for (let i = 0; i < a.length; i++) {
      if (c[i] !== c2[i]) same = false;
      if (a[i] !== c[i]) changed++;
      const lo = Math.min(a[i], c[i]) - 2, hi = Math.max(a[i], c[i]) + 2;
      if (b[i] < lo || b[i] > hi) off++;
    }
    return { same, off: off / a.length, changed: changed / a.length };
  });
  check('a slot at weight 0.5 draws between weight 0 and weight 1', between.same && between.changed > 0.001 && between.off < 0.005, JSON.stringify(between));
  const rErr = await rp.evaluate(() => ({ failed: window.renderFailed ?? null, errors: window.renderErrors }));
  check('render.html?show plays the show without widget errors', !rErr.failed && Object.keys(rErr.errors ?? {}).length === 0, JSON.stringify(rErr));
  await rp.close();

  // A show with an overlap opens repaired (unsaved, with a notice) and plays.
  const bad = structuredClone(GOOD); bad.sections[0].end = 12;
  writeFileSync(path.join(shows, 'demo.json'), `${JSON.stringify(bad, null, 2)}\n`);
  await page.reload();
  await page.waitForFunction(() => window.__studio?.player.duration > 0, null, { timeout: 30_000 });
  const notices = await page.locator('.notice').allInnerTexts();
  const rs = await state(page);
  check('an overlapping show opens repaired, with a notice, unsaved', notices.some((n) => /repaired/.test(n)) && rs.dirty, notices.join(' | '));
  await page.evaluate(() => window.__studio.player.seek(14));
  await page.evaluate(() => window.__studio.player.play());
  await page.waitForTimeout(2000);
  const lit2 = await litShare(page);
  check('the repaired show plays', lit2 > 0.01, `${(lit2 * 100).toFixed(1)} % lit`);
  await page.evaluate(() => window.__studio.player.pause());
  // A widget that throws says so: a notice, and the reason on its open layer.
  const broke = await page.evaluate(async () => {
    const st = window.__studio, s = st.store.state.show, t = 14.5;
    const i = s.sections.findIndex((x) => x.start <= t && t < x.end), k = s.sections[i].layers.length - 1, id = s.sections[i].layers[k].widget;
    st.store.dispatch({ type: 'select', section: i, layer: k });
    st.runtime.tool(id).frame = () => { throw new Error('broken on purpose'); };
    st.player.seek(t);
    await new Promise((r) => setTimeout(r, 400));
    return { id, notices: [...document.querySelectorAll('.notice.error')].map((n) => n.textContent), err: document.querySelector('.panel .layer.open .err')?.textContent ?? null };
  });
  check('a widget that throws gets an error notice and its reason on the open layer',
    broke.notices.some((n) => /stopped: broken on purpose/.test(n)) && /broken on purpose/.test(broke.err ?? ''), JSON.stringify(broke));
  page.on('dialog', (d) => d.accept());

  // A show changed on disk (Claude edits shows/<id>.json): a clean studio follows it without a reload, a dirty one
  // asks. Its own server with HMR on (the main one has it off, so edits elsewhere cannot reload the pages above).
  // Space after a mouse click on Play pauses once (the focused button must not take the key too).
  const hot = await createServer({ root: ROOT, logLevel: 'error', server: { host: '127.0.0.1', port: 5197, strictPort: false } });
  await hot.listen();
  try {
    const HOT = hot.resolvedUrls.local[0].replace(/\/$/, '');
    const writeShow = (label) => { const f = path.join(shows, 'demo.json'); const g = structuredClone(GOOD); g.sections[0].label = label;
      writeFileSync(`${f}.tmp`, JSON.stringify(g)); renameSync(`${f}.tmp`, f); };
    writeShow('One');
    const hp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    hp.on('pageerror', (e) => errors.push(`hot: ${e}`));
    hp.on('dialog', (d) => d.accept());
    await hp.goto(`${HOT}/?song=demo`);
    await hp.waitForFunction(() => window.__studio?.player.duration > 0, null, { timeout: 30_000 });
    await hp.click('[data-play]');
    await hp.waitForTimeout(500);
    const playing = await hp.evaluate(() => !window.__studio.player.audio.paused);
    await hp.keyboard.press('Space');
    await hp.waitForTimeout(400);
    const paused = await hp.evaluate(() => window.__studio.player.audio.paused);
    check('Space after clicking Play pauses (once)', playing && paused, `playing ${playing}, then paused ${paused}`);
    await hp.evaluate(() => { window.__samePage = true; });
    writeShow('Changed on disk');
    await hp.waitForFunction(() => window.__studio.store.state.show.sections[0].label === 'Changed on disk', null, { timeout: 8000 }).catch(() => {});
    const followed = await hp.evaluate(() => ({ label: window.__studio.store.state.show.sections[0].label, same: window.__samePage === true }));
    check('a clean studio follows a show changed on disk, without reloading', followed.label === 'Changed on disk' && followed.same, JSON.stringify(followed));
    await hp.evaluate(() => window.__studio.store.dispatch({ type: 'edit', edit: { kind: 'setSection', section: 1, patch: { label: 'Mine' } } }));
    writeShow('Again on disk');
    await hp.waitForSelector('.notice:has-text("Load the version on disk")', { timeout: 8000 }).catch(() => {});
    const asked = await hp.evaluate(() => ({ label: window.__studio.store.state.show.sections[0].label, notices: [...document.querySelectorAll('.notice')].map((n) => n.textContent) }));
    check('a dirty studio keeps its edits and offers the version on disk', asked.label === 'Changed on disk' && asked.notices.some((n) => /Load the version on disk/.test(n)), JSON.stringify(asked));
    await hp.click('.notice button:has-text("Load the version on disk")');
    await hp.waitForFunction(() => window.__studio.store.state.show.sections[0].label === 'Again on disk', null, { timeout: 5000 }).catch(() => {});
    const loaded = await hp.evaluate(() => window.__studio.store.state.show.sections.map((x) => x.label ?? null));
    await hp.keyboard.press('Control+z');
    const back = await hp.evaluate(() => window.__studio.store.state.show.sections.map((x) => x.label ?? null));
    check('loading the version on disk keeps your edits one undo away', loaded[0] === 'Again on disk' && back[1] === 'Mine',
      JSON.stringify({ loaded, back }));
    await hp.close();
  } finally { await hot.close(); }

  // Adding a recording (plan T5). Tone bursts, so the analysis finds attacks (a steady sine has next to none).
  const { validatePack } = await vite.ssrLoadModule('/src/studio/pack/pack.ts');
  const tones = path.join(tmp, 'Drop Test.wav');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i',
    "aevalsrc='0.6*sin(2*PI*(196+98*mod(floor(t*2),5))*t)*exp(-5*mod(t,0.5))':s=44100:d=30", tones]);
  // drop: the file arrives by a drag and drop on the page (synthetic DragEvents carrying a real File), else the picker.
  const openAdded = async (q, file, id, expectUrl, drop = false) => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    p.on('pageerror', (e) => errors.push(`add: ${e}`));
    // Never the user's own ears server: the page finds one only where this check says.
    await p.route(/127\.0\.0\.1:5175\//, (r) => r.abort());
    await p.goto(`${BASE}/?song=demo${q}`);
    await p.waitForFunction(() => window.__studio?.player.duration > 0, null, { timeout: 30_000 });
    const t0 = Date.now();
    let dropped = null;
    if (drop) {
      await p.evaluate(() => { const i = Object.assign(document.createElement('input'), { type: 'file', id: 'dropsrc', hidden: true }); document.body.append(i); });
      await p.setInputFiles('#dropsrc', file);
      dropped = await p.evaluate(() => {
        const dt = new DataTransfer(); dt.items.add(document.getElementById('dropsrc').files[0]);
        const fire = (t) => { const e = new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }); document.querySelector('canvas').dispatchEvent(e); return e.defaultPrevented; };
        const overlay = () => !document.querySelector('.drop-overlay').hidden;
        fire('dragenter'); const shown = overlay();
        fire('dragleave'); const left = !overlay();
        fire('dragenter'); const over = fire('dragover'), dropOk = fire('drop');
        return { shown, left, over, drop: dropOk, hiddenAfter: !overlay() };
      });
    } else await p.setInputFiles('.library [data-file]', file);
    await p.waitForURL(expectUrl, { timeout: 180_000 }).catch(() => {});
    await p.waitForFunction(() => window.__studio?.player.duration > 0, null, { timeout: 30_000 }).catch(() => {});
    return { p, seconds: (Date.now() - t0) / 1000, dropped };
  };
  const packOf = (id) => { try { return JSON.parse(readFileSync(path.join(songs, id, 'pack.json'), 'utf8')); } catch { return null; } };

  // Ears down, dropped on the page: the browser analyses it, the song opens with approximate notes, says so, and plays.
  {
    const { p, seconds, dropped } = await openAdded('', tones, 'drop-test', /song=drop-test/, true);
    check('a file dragged over the page shows the drop overlay; dropped, it is taken (not opened by the browser)',
      dropped && Object.values(dropped).every((v) => v === true), JSON.stringify(dropped));
    const pk = packOf('drop-test');
    check('ears down: the dropped recording is analysed in the browser and saved as a song',
      pk && validatePack(pk).length === 0 && pk.notesFrom === 'approx' && pk.made.by === 'studio' && pk.notes.length > 20 && existsSync(path.join(songs, 'drop-test', 'audio.wav')),
      pk ? `${pk.notes.length} notes, ${pk.notesFrom}, by ${pk.made.by}, ${seconds.toFixed(1)} s` : 'no pack');
    const n = await p.locator('.notice').allInnerTexts();
    const st = await p.evaluate(() => ({ url: location.search, origin: window.__studio?.store.state.origin, sections: window.__studio?.store.state.show?.sections.length }));
    check('it opens with a composed show and a notice saying the notes are approximate', st.origin === 'auto' && n.some((x) => /approximate/.test(x)), `${JSON.stringify(st)} ${n.join(' | ')}`);
    await p.evaluate(() => window.__studio.player.play());
    await p.waitForTimeout(3000);
    const lit3 = await litShare(p);
    check('the added song plays (not black after 3 s)', lit3 > 0.01, `${(lit3 * 100).toFixed(1)} % lit`);
    await p.click('[data-songs]');
    const listed2 = await p.locator('.library .song').allInnerTexts();
    check('the library lists it, marked approximate', listed2.length === 2 && listed2.some((x) => /Drop Test/.test(x) && /approximate/.test(x)), listed2.join(' | '));
    await p.close();
  }

  // Ears up without a transcriber: the ears server runs the real ingest with approximate notes and says why; the
  // same recording dropped again is found, not ingested twice.
  {
    const { startEars } = await vite.ssrLoadModule('/scripts/ears/server.ts');
    const ears = await startEars({ port: 0, songs, probe: async () => ({ ok: false, python: null, device: null, reason: 'studio-check: no transcriber here' }),
      probeMuscriptor: async () => ({ ok: false, python: null, reason: 'studio-check: not asked' }) });
    try {
      const other = path.join(tmp, 'Second Take.wav');
      spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', tones, '-af', 'volume=0.8', other]);
      const { p, seconds } = await openAdded(`&ears=${ears.port}`, other, 'second-take', /song=second-take/);
      const pk = packOf('second-take');
      const n = await p.locator('.notice').allInnerTexts();
      check('ears up: the dropped recording is ingested by the ears server (approximate notes, the reason said)',
        pk && validatePack(pk).length === 0 && pk.made.by === 'ingest' && pk.source.name === 'Second Take.wav' && n.some((x) => /Transcriber unavailable: studio-check/.test(x)),
        `${pk ? `${pk.notesFrom}, by ${pk.made.by}, ${pk.source.name}` : 'no pack'}, ${seconds.toFixed(1)} s | ${n.join(' | ')}`);
      await p.close();
      const { p: p2 } = await openAdded(`&ears=${ears.port}`, other, 'second-take', /song=second-take/);
      const again = await p2.evaluate(() => location.search);
      check('the same recording again opens the song it already is', /song=second-take/.test(again) && !existsSync(path.join(songs, 'second-take-2')), again);
      await p2.close();
    } finally { await ears.close(); }
  }

  check('no page errors in the studio', errors.length === 0, errors.join(' | '));

  // The old app still starts.
  const legacy = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const lerr = [];
  legacy.on('pageerror', (e) => lerr.push(String(e)));
  await legacy.goto(`${BASE}/legacy.html`);
  await legacy.waitForTimeout(2500);
  const welcome = await legacy.locator('#welcome').count();
  check('legacy.html loads without page errors', lerr.length === 0 && welcome === 1, lerr.join(' | '));
  await legacy.close();
} finally {
  await st.close();
}

process.exit(finish('studio-check'));
