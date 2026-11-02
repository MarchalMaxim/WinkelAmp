// The note picker in a real browser, on Vivaldi's Winter only (the logic is pinned in tests/picker-logic.test.ts): what a
// browser alone can show. Marks reach their file; no key reaches the studio under the overlay; the preview leaves the
// store, the history, the disk and the studio's conductor alone; a placement is one undo and fires exactly its attacks.
//
//   npm run picker-check [-- --headed] [--keep] [--shots <dir>]
//
// --shots writes the roll, a dense passage, the popup, the placed layer's controls and lane. Local only: needs system
// Chrome and songs/vivaldi-winter. Everything it saves lands in openStudio's temp folders.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { checker, openStudio } from '../lib/studio-session.mjs';

const argv = process.argv.slice(2);
const HEADED = argv.includes('--headed'), KEEP = argv.includes('--keep');
const SHOTS = argv.includes('--shots') ? path.resolve(argv[argv.indexOf('--shots') + 1]) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const { check, finish } = checker();
const SONG = 'vivaldi-winter';

const st = await openStudio({ songs: [SONG], port: 5401, headed: HEADED, keep: KEEP, viewport: { width: 1440, height: 900 } });
const { page, dirs, errors } = st;
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const settle = (ms = 150) => page.waitForTimeout(ms);
/** The roll's notes in view on screen, chosen in the page: a place to click. */
const rollBox = () => page.locator('.np-roll-top').boundingBox();
const clickNote = async (n) => { const b = await rollBox(); await page.mouse.click(b.x + n.x, b.y + n.y); await settle(); };
const noteOnRoll = (k = 0) => page.evaluate((k) => {
  const r = window.__studio.picker.roll, seen = new Set(), out = [];
  for (let y = r.geo.top + 2; y < r.el.clientHeight; y += 2) for (let x = 130; x < r.el.clientWidth; x += 3) {
    const n = r.noteAt(x, y);
    if (n && !seen.has(n.id)) { seen.add(n.id); out.push({ id: n.id, i: n.i, t: n.t, x: r.xOf(n.t) + 1, y: r.yOf(n.m) + r.geo.rowH / 2 }); }
  }
  return out.sort((a, b) => a.t - b.t)[k];
}, k);
const markedCount = () => page.evaluate(() => Number(document.querySelector('[data-s1t]').textContent.split(' ')[0]) || 0);

try {
  // ---- open ----
  await page.click('[data-pick]');
  await page.waitForSelector('.np:not([hidden]) .np-roll-top');
  await settle(400);
  check('the overlay opens, with a legend with counts', await page.evaluate(() => document.querySelectorAll('.np-inst').length > 1 && /\d/.test(document.querySelector('.np-show').textContent)));
  await shot('roll-winter');

  // ---- marks ----
  await clickNote(await noteOnRoll(3));
  check('a click marks a note', (await markedCount()) === 1);
  const b = await rollBox();
  const drag = async (x0, y0, x1, y1, alt) => {
    if (alt) await page.keyboard.down('Alt');
    await page.mouse.move(b.x + x0, b.y + y0); await page.mouse.down(); await page.mouse.move(b.x + x1, b.y + y1, { steps: 4 }); await page.mouse.up();
    if (alt) await page.keyboard.up('Alt');
    await settle();
  };
  await drag(500, 60, 760, b.height - 40);
  const boxed = await markedCount();
  check('a box marks several', boxed > 3, `${boxed} marked`);
  await drag(500, 60, 620, b.height - 40, true);
  check('Alt-box unmarks', (await markedCount()) < boxed);
  const altered = await markedCount();
  await page.click('.np-tools [data-undo]'); await settle();
  check('Undo takes one back', (await markedCount()) === boxed);
  await page.keyboard.press('Control+z'); await settle();
  check('Ctrl+Z too', (await markedCount()) === 1 && altered < boxed);
  await page.click('[data-suggest]'); await settle();
  const suggested = await markedCount();
  check('Suggest marks a line', suggested > 5, `${suggested} marked`);
  await page.waitForTimeout(1300);
  const file = path.join(dirs.tmp, 'melodies', `${SONG}.json`);
  const saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).notes.length : -1;
  check('the marks are in the temp melody file a second later', saved === suggested, `${saved} in the file`);
  const warnsOnLeaving = () => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  check('everything saved: leaving does not warn', !(await warnsOnLeaving()));
  const refused = await page.evaluate(async () => {
    const p = window.__studio.picker, api = p.d.api, save = api.saveMelody;
    api.saveMelody = () => Promise.reject(new Error('disk full'));
    p.changed();
    const pending = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(pending);
    p.saveMarks();
    await p.saving;
    const failed = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(failed);
    api.saveMelody = save;
    p.saveMarks();
    await p.saving;
    return { pending: pending.defaultPrevented, failed: failed.defaultPrevented };
  });
  check('marks waiting for their second: no warning, the page takes them along', !refused.pending);
  check('a failed save: leaving warns', refused.failed);
  check('saved again: leaving does not warn', !(await warnsOnLeaving()));

  // ---- instruments ----
  const hidden = await noteOnRoll(0);
  const hide = page.locator('.np-show').nth(hidden.i);
  await hide.click(); await settle();
  const hit = await page.evaluate((n) => window.__studio.picker.roll.noteAt(n.x, n.y)?.i, hidden);
  check("a hidden instrument's notes can't be hit", hit !== hidden.i);
  await hide.click(); await settle();
  await page.locator('.np-hear').first().click();
  check('♪ turns the recording down to 30 %', await page.evaluate(() => window.__studio.player.audio.volume === 0.3));
  await page.locator('.np-hear').first().click();
  check('and back with the last ♪ off', await page.evaluate(() => window.__studio.player.audio.volume === 1));
  await page.locator('.np-hear').first().click();
  await page.click('[data-connect]');
  await settle();
  check('with a ♪ on, the popup hears the recording whole: it plays no tones', await page.evaluate(() => window.__studio.player.audio.volume === 1));
  await page.click('.np-modal [data-cancel]');
  await settle();
  check('and it is down again after the popup', await page.evaluate(() => window.__studio.player.audio.volume === 0.3));
  await page.locator('.np-hear').first().click();

  // ---- keys ----
  const before = await page.evaluate(() => {
    window.__showBefore = window.__studio.store.state.show;
    return { t: window.__studio.player.time, hidden: window.__studio.store.state.ui.hidden, full: !!document.fullscreenElement };
  });
  for (const k of ['Delete', 's', 'f', 'h', 'ArrowLeft', 'ArrowRight', 'Shift+ArrowRight']) await page.keyboard.press(k);
  await settle();
  check('Delete, S, F, H and the arrows change neither the show nor the stage', await page.evaluate((b) => {
    const s = window.__studio;
    return s.store.state.show === window.__showBefore && s.player.time === b.t && s.store.state.ui.hidden === b.hidden && !!document.fullscreenElement === b.full;
  }, before));

  // ---- the popup and the preview ----
  await page.click('[data-connect]');
  await settle();
  check('Place in scene is off with none picked', await page.isDisabled('[data-ok]'));
  await page.click('.np-modal [data-choose]');
  await settle();
  check('the chooser offers a widget already in the section', await page.evaluate(() => {
    const here = window.__studio.store.state.show.sections.flatMap((s) => s.layers.map((l) => l.widget));
    return [...document.querySelectorAll('.np-chooser .pick')].some((b) => here.includes(b.dataset.id) && !b.disabled);
  }));
  await page.keyboard.press('Escape');
  check('Esc closes the chooser first', await page.evaluate(() => document.querySelector('.np-chooser').hidden && !document.querySelector('.np-modal').hidden));
  await page.keyboard.press('Control+p');
  await page.waitForSelector('dialog.palette[open]');
  await page.keyboard.press('Escape');
  await settle();
  check('Ctrl+P finds a widget over the popup, and Esc closes only that', await page.evaluate(() => !document.querySelector('dialog.palette').open && !document.querySelector('.np-modal').hidden));
  await page.keyboard.press('Control+p');
  await page.waitForSelector('dialog.palette[open]');
  await page.keyboard.type('marbling');
  await page.keyboard.press('Enter');
  await settle();
  check('typing a name and Enter connects the notes to it', await page.evaluate(() => window.__studio.picker.popup.widget === 'marbling' && !document.querySelector('dialog.palette').open));
  await page.fill('[data-n]', '6');
  await page.click('[data-loud]');
  await settle();
  check('Pick the loudest picks six', (await page.textContent('[data-count]')) === '6');
  await page.click('.np-modal [data-clear]');
  check('Clear', (await page.textContent('[data-count]')) === '0');
  await page.click('[data-loud]');
  await page.evaluate(() => {
    const s = window.__studio, c = s.conductor, step = c.step.bind(c);
    window.__steps = 0; c.step = (...a) => { window.__steps++; step(...a); };
    window.__undo = s.store.history.canUndo; window.__puts = 0; window.__t0 = s.player.time;
    const f = window.fetch; window.fetch = (u, o) => { if (o?.method === 'PUT' && !String(u).includes('/melodies/')) window.__puts++; return f(u, o); };
  });
  const pictureHash = () => page.evaluate(() => { const c = document.querySelector('.np-pop-stage canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; });
  const a = await pictureHash();
  await page.click('.np-modal [data-play]');
  await page.waitForTimeout(1800);
  await shot('popup-playing');
  check('the popup canvas changes while it plays', (await pictureHash()) !== a);
  await page.click('[data-cmp="all"]');
  await page.waitForTimeout(800);
  await page.click('[data-cmp="pick"]');
  await page.waitForTimeout(300);
  check("meanwhile the studio's conductor takes no steps, and no edit and no save", await page.evaluate(() => window.__steps === 0 && window.__studio.store.history.canUndo === window.__undo && window.__puts === 0));
  check("the draft's key is only in the preview's runtime", await page.evaluate(() =>
    !window.__studio.runtime.loaded().some((k) => k.includes('draft')) && window.__studio.picker.popup.runtime.loaded().some((k) => k.includes('draft'))));
  const whatSays = () => page.textContent('.np-modal [data-what]');
  const stoppedKey = await page.evaluate(() => {
    const { runtime, widget } = window.__studio.picker.popup, key = `${widget}@picks:draft`;
    runtime.errors[key] = 'Error: test';
    return key;
  });
  await settle();
  check("a widget's failure is said", /stopped: test/.test(await whatSays()));
  await page.click('[data-cmp="all"]');
  await settle();
  check("and isn't said about the other instance", !/stopped/.test(await whatSays()));
  await page.evaluate((k) => { delete window.__studio.picker.popup.runtime.errors[k]; }, stoppedKey);
  await page.click('[data-cmp="pick"]');
  await settle();
  await page.click('[data-cancel]');
  await settle(300);
  check('Cancel: the playhead as before, the popup gone, no error', await page.evaluate(() => Math.abs(window.__studio.player.time - window.__t0) < 0.01 && document.querySelector('.np-modal').hidden && window.__studio.player.audio.paused));

  // ---- place ----
  await page.click('[data-connect]');
  await page.click('[data-loud]');
  const words = await page.textContent('[data-of]');
  check('the count says of how many', /^of \d+ melody notes picked$/.test(words), words);
  await shot('popup');
  await page.click('[data-ok]');
  await settle(400);
  const placed = await page.evaluate(() => {
    const s = window.__studio, show = s.store.state.show, set = show.picks?.p1;
    return { notes: set?.notes, inSections: show.sections.filter((x) => x.layers.some((l) => l.listen === 'picks:p1')).length, selected: s.store.state.selected, t: s.player.time };
  });
  check('Place: a set, a layer in its sections, the playhead a second before the first pick', placed.notes?.length === 6 && placed.inSections >= 1 && Math.abs(placed.t - Math.max(0, placed.notes[0][0] - 1)) < 0.01);
  check('a row with ticks under the roll', await page.evaluate(() => !!document.querySelector('.np-set[data-set="p1"] canvas')));
  await shot('placed-roll');
  // Fires exactly the attacks: played through the first few picks.
  const delivered = await page.evaluate(async () => {
    const s = window.__studio, n = s.store.state.show.picks.p1.notes, key = 'pointillism@picks:p1';
    s.runtime.deliveredLog = [];
    await s.player.play();
    const until = Math.min(n[0][0] + 6, s.player.time + 8);
    await new Promise((ok) => { const w = () => (s.player.time >= until ? ok() : requestAnimationFrame(w)); w(); });
    s.player.pause();
    const heard = s.runtime.deliveredLog.filter((x) => x[0] === key).map((x) => x[1]);
    s.runtime.deliveredLog = null;
    let attacks = [], last = -1;
    for (const x of n) { if (last < 0 || x[0] - last >= 0.04) { attacks.push(x[0]); last = x[0]; } }
    return { heard, want: attacks.filter((t) => t <= until), errors: Object.keys(s.runtime.errors).filter((k) => k.includes('picks')) };
  });
  check('while it plays it fires exactly the picks\' attacks', JSON.stringify(delivered.heard) === JSON.stringify(delivered.want), `${delivered.heard.length} of ${delivered.want.length}`);
  check('no widget error on the set', !delivered.errors.length);

  // ---- tones ----
  // Counted where the picker asks for them: a seek while paused, then play, as the user rewinds to check marks by ear.
  const tonesOver = (from, to) => page.evaluate(async ({ from, to }) => {
    const s = window.__studio, p = s.picker, tone = p.tone, frame = () => new Promise(requestAnimationFrame);
    let k = 0;
    p.tone = (...a) => { k++; tone.apply(p, a); };
    s.player.seek(from);
    await frame(); await frame();
    await s.player.play();
    await new Promise((ok) => { const w = () => (s.player.time >= to ? ok() : requestAnimationFrame(w)); w(); });
    s.player.pause();
    delete p.tone;
    return k;
  }, { from, to });
  const marks = await page.evaluate(() => { const p = window.__studio.picker; return p.l.notes.filter((n) => p.marked.has(n.id)).map((n) => ({ t: n.t, i: n.i })); });
  const from = marks[0].t - 0.5, to = marks[Math.min(5, marks.length - 1)].t + 0.3;
  const heardFirst = await tonesOver(from, to), heardAgain = await tonesOver(from, to);
  check('a paused seek back and the same stretch again: the tones come again', heardFirst > 0 && Math.abs(heardAgain - heardFirst) <= 1, `${heardFirst}, then ${heardAgain}`);
  const past = marks[marks.length - 1].t + 2;
  const burst = await tonesOver(past, past + 0.3);
  check('a paused seek forward: no burst of what it skipped', burst === 0, `${burst} tones`);
  await page.click('[data-ping]');
  await page.locator('.np-hear').nth(marks[0].i).click();
  const instrument = await tonesOver(from, to);
  check('♪ too after a paused seek back', instrument > 0, `${instrument} tones`);
  await page.locator('.np-hear').nth(marks[0].i).click();
  await page.click('[data-ping]');

  // ---- back in the studio ----
  await page.click('[data-back]');
  await settle(400);
  await shot('studio-layer');
  check('the layer controls say the impulses, with Edit picks', await page.evaluate(() => /impulses? \(\d+ notes? picked\)/.test(document.querySelector('.lc-picks')?.textContent ?? '') && !document.querySelector('.lc-picks').hidden && document.querySelector('.lc-listen').hidden));
  await page.click('[data-edit-picks]');
  await settle(300);
  check('Edit picks opens the popup with those chips on, saying Update the scene', (await page.textContent('[data-ok]')) === 'Update the scene' && (await page.textContent('[data-count]')) === '6');
  await page.click('.np-modal [data-clear]');
  await page.locator('.np-chip').nth(0).click();
  await page.click('[data-ok]');
  await settle(300);
  check('an update changes the set', (await page.evaluate(() => window.__studio.store.state.show.picks.p1.notes.length)) === 1);
  check('the tones go on from where the update left the playhead', await page.evaluate(() => { const { picker: p, player } = window.__studio; return p.cursor === p.l.index.firstFrom(player.time); }));
  await page.click('[data-back]');
  await settle(300);
  await page.keyboard.press('Control+z');
  await settle(300);
  check('undo goes back to the six', (await page.evaluate(() => window.__studio.store.state.show.picks.p1.notes.length)) === 6);
  await page.keyboard.press('Control+z');
  await settle(300);
  check('one more undo and the placement is gone', await page.evaluate(() => !window.__studio.store.state.show.picks && !window.__studio.store.state.show.sections.some((s) => s.layers.some((l) => l.listen?.startsWith('picks:')))));
  await page.keyboard.press('Control+Shift+z');
  await settle(200);
  await page.keyboard.press('Control+s');
  await settle(500);
  const showFile = JSON.parse(readFileSync(path.join(dirs.shows, `${SONG}.json`), 'utf8'));
  check('Ctrl+S saves the picks and the listen to the temp show', showFile.picks?.p1?.notes.length === 6 && JSON.stringify(showFile.sections).includes('picks:p1'));

  // ---- a pick left behind ----
  const warned = await page.evaluate(async () => {
    // A set over two sections, its layer then gone from the first: that section's pick has nothing to fire.
    const s = window.__studio, [a, b] = s.store.state.show.sections, mid = (x) => (x.start + x.end) / 2;
    s.store.dispatch({ type: 'edit', edit: { kind: 'placePicks', widget: 'halftone', notes: [[mid(a), mid(a) + 0.2, 60, 80], [mid(b), mid(b) + 0.2, 62, 80]] } });
    await s.picker.open();   // drawn already: the set's own notes don't change below
    const layer = s.store.state.show.sections[0].layers.findIndex((l) => l.listen === 'picks:p2');
    s.store.dispatch({ type: 'edit', edit: { kind: 'removeLayer', section: 0, layer } });
    return document.querySelector('.np-set[data-set="p2"] .np-set-warn')?.textContent ?? '';
  });
  await settle();
  await shot('never-heard');
  check('the set row says a pick is never heard', warned === '1 never heard', warned);

  // A boundary moved past a drawn set, the picker closed as it is for that edit: the picks stay the same object.
  const moved = await page.evaluate(async () => {
    const s = window.__studio, a = s.store.state.show.sections[0], warn = () => document.querySelector('.np-set[data-set="p3"] .np-set-warn')?.textContent ?? '';
    s.store.dispatch({ type: 'edit', edit: { kind: 'placePicks', widget: 'halftone', notes: [[a.end - 2, a.end - 1.8, 60, 80], [a.end - 1, a.end - 0.8, 62, 80]] } });
    const before = warn(), picks = s.store.state.show.picks;
    s.picker.close();
    s.store.dispatch({ type: 'edit', edit: { kind: 'moveBoundary', index: 1, t: a.end - 3 } });
    await s.picker.open();
    const after = warn(), same = picks === s.store.state.show.picks;
    s.store.dispatch({ type: 'edit', edit: { kind: 'moveBoundary', index: 1, t: a.end } });
    return { before, after, same, back: warn() };
  });
  check('a boundary moved past a drawn set: its row says so', moved.same && moved.before === '' && moved.after === '2 never heard', JSON.stringify(moved));
  check('and moved back with the picker open, it stops', moved.back === '', moved.back);

  // ---- the window ----
  const wide = await page.evaluate(() => document.querySelector('.np-set[data-set="p1"] canvas').width);
  await page.setViewportSize({ width: 1100, height: 900 });
  await settle(300);
  const sized = await page.evaluate(() => { const c = document.querySelector('.np-set[data-set="p1"] canvas'); return { w: c.width, want: Math.round(c.clientWidth * (window.devicePixelRatio || 1)) }; });
  check('a resized window draws the ticks again at its size', sized.w === sized.want && sized.w !== wide, JSON.stringify(sized));

  // ---- a save that fails ----
  const retried = await page.evaluate(async () => {
    const s = window.__studio, p = s.picker, api = p.d.api, save = api.saveMelody, said = () => s.store.state.notices.some((n) => n.id === 'picker-save');
    let tries = 0;
    api.saveMelody = () => { tries++; return Promise.reject(new Error('disk full')); };
    p.changed();
    p.saveMarks();
    await p.saving;
    const failed = said();
    api.saveMelody = (m) => { tries++; return save.call(api, m); };
    p.close();
    await p.saving;
    api.saveMelody = save;
    return { failed, tries, after: said() };
  });
  check('a failed save says so, closing tries again, and the notice goes', retried.failed && retried.tries === 2 && !retried.after, JSON.stringify(retried));

  // ---- Ctrl+Z after a placement, then leaving at once ----
  await page.click('[data-pick]');
  await settle(300);
  const count = await markedCount();
  await clickNote(await noteOnRoll(0));
  await page.click('.np-set[data-set="p1"] button');
  await settle();
  await page.keyboard.press('Control+z');
  await settle();
  const told = await page.textContent('.np-notices');
  check('Ctrl+Z after removing a set: the marks go back, and it says so and where that is undone', (await markedCount()) === count && /took back 1 change.*Back to the studio/.test(told), told);
  await page.waitForTimeout(1300);
  await clickNote(await noteOnRoll(0));
  const want = await page.evaluate(() => { const p = window.__studio.picker; return p.marked.size + p.unmatched.length; });
  page.on('dialog', (d) => void d.accept());
  await page.reload();
  let inFile = -1;
  for (let k = 0; k < 20 && inFile !== want; k++) { await page.waitForTimeout(100); inFile = JSON.parse(readFileSync(file, 'utf8')).notes.length; }
  check('a mark made just before a reload reaches the file', inFile === want, `${inFile} in the file, ${want} marked`);

  check('no page errors', !errors.length, errors[0] ?? '');
} finally {
  await st.close();
}
process.exit(finish('picker-check'));
