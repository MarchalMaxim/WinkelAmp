// The note picker in a real browser, on Vivaldi's Winter only (the logic is pinned in tests/picker-logic.test.ts): what a
// browser alone can show. Marks reach their file and stay there, whatever is picked next; no key reaches the studio under the overlay; the preview leaves the
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
const bringCount = () => page.evaluate(() => { const b = document.querySelector('[data-bring]'); return b.hidden ? 0 : Number(b.textContent.match(/\d+/)[0]); });
/** A note in view that is not a mark yet: picking it has to grow the file. */
const unmarkedOnRoll = () => page.evaluate(() => {
  const p = window.__studio.picker, r = p.roll, at = (n) => ({ x: r.xOf(n.t) + 1, y: r.yOf(n.m) + r.geo.rowH / 2 });
  return at(p.l.index.inView(r.view.a, r.view.b).find((n) => !p.stored.has(n.id) && !p.marked.has(n.id) && r.noteAt(at(n).x, at(n).y)?.id === n.id));
});
const undoButton = async () => { await page.click('.np-tools [data-undo]'); await settle(); };

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
  const fileMarks = () => JSON.parse(readFileSync(file, 'utf8')).notes.length;
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
  await page.keyboard.press('Control+p');
  await page.waitForSelector('dialog.palette[open]');
  check('Ctrl+P on the roll opens the popup on the picked notes, and the widgets to choose from', await page.evaluate(() => !document.querySelector('.np-modal').hidden));
  await page.keyboard.press('Escape');
  await settle();
  check('and Esc there leaves the popup open', await page.evaluate(() => !document.querySelector('dialog.palette').open && !document.querySelector('.np-modal').hidden));
  check('Place in scene is off with none picked', await page.isDisabled('[data-ok]'));
  await page.click('.np-modal [data-choose]');
  await settle();
  check('the chooser offers every widget', await page.evaluate(() => [...document.querySelectorAll('.np-chooser .pick')].every((b) => !b.disabled)));
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
  // Many at once: All, a drag across the strip, going back over it, Alt, and the edge that scrolls.
  await page.click('[data-all]');
  const melodyN = Number(await page.textContent('[data-count]'));
  check('All picks every note of the melody', melodyN > 6 && melodyN === await page.locator('.np-chip').count(), String(melodyN));
  await page.click('[data-thin]');
  check('Every other thins them', Number(await page.textContent('[data-count]')) < melodyN);
  await page.click('[data-clear]');
  const stripBox = await page.locator('.np-chips').boundingBox();
  await page.mouse.move(stripBox.x + 30, stripBox.y + 6);
  await page.mouse.down();
  await page.mouse.move(stripBox.x + 220, stripBox.y + 6, { steps: 6 });
  const swept = Number(await page.textContent('[data-count]'));
  check('a drag along the empty top of the strip picks all it passes, whatever their height', swept >= 2, String(swept));
  await page.mouse.move(stripBox.x + 60, stripBox.y + 6, { steps: 4 });
  check('going back over them undoes that', Number(await page.textContent('[data-count]')) < swept);
  await page.mouse.up();
  await page.click('[data-clear]');
  await page.mouse.move(stripBox.x + 30, stripBox.y + 6);
  await page.mouse.down();
  await page.mouse.move(stripBox.x + stripBox.width - 4, stripBox.y + 6, { steps: 6 });
  await page.waitForTimeout(600);
  const scrolled = await page.evaluate(() => document.querySelector('.np-chips').scrollLeft);
  await page.mouse.up();
  if (await page.evaluate(() => document.querySelector('.np-chips').scrollWidth > document.querySelector('.np-chips').clientWidth + 40)) check('held at the edge, the strip scrolls and the drag goes on', scrolled > 0, `${scrolled} px`);
  await page.evaluate(() => { document.querySelector('.np-chips').scrollLeft = 0; });
  await page.click('[data-clear]');
  await page.fill('[data-n]', '6');
  await page.click('[data-loud]');
  await settle();
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
    const { runtime, widget } = window.__studio.picker.popup, key = `${widget}@picks:draft#draft`;
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
    return { notes: set?.notes, clips: show.clips.filter((x) => x.listen === 'picks:p1').map((c) => c.id), selected: s.store.state.selected.clip, t: s.player.time };
  });
  check('Place: a set, a clip on it, selected, the playhead a second before the first pick', placed.notes?.length === 6 && placed.clips.length === 1 && placed.selected === placed.clips[0] && Math.abs(placed.t - Math.max(0, placed.notes[0][0] - 1)) < 0.01);
  check('a row with ticks under the roll', await page.evaluate(() => !!document.querySelector('.np-set[data-set="p1"] canvas')));
  await shot('placed-roll');

  // ---- a new selection ----
  check('after connecting, nothing is selected and Connect is off', (await markedCount()) === 0 && await page.isDisabled('[data-connect]'));
  await page.evaluate(() => window.__studio.picker.saving);
  check('and the melody file still holds every mark', fileMarks() === suggested, `${fileMarks()} in the file, ${suggested} marked`);
  check('Bring back offers the marks no widget uses', (await bringCount()) === suggested - 6, `${await bringCount()} offered, ${suggested} marked, 6 connected`);
  await page.click('[data-bring]'); await settle();
  await shot('brought-back');
  check('Bring back picks them', (await markedCount()) === suggested - 6 && (await bringCount()) === 0, String(await markedCount()));
  await undoButton();
  check('Undo takes Bring back back', (await markedCount()) === 0 && (await bringCount()) === suggested - 6);
  await undoButton();
  check('and no undo is left to bring the old selection back', (await markedCount()) === 0);
  await page.click('[data-bring]'); await settle();   // the tones below are on these
  // Fires exactly the attacks: played through the first few picks.
  const delivered = await page.evaluate(async () => {
    const s = window.__studio, n = s.store.state.show.picks.p1.notes, key = `pointillism@picks:p1#${s.store.state.selected.clip}`;
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
  check('and only those: the earlier marks are not in it', (await page.locator('.np-chip').count()) === 6);
  const setNotes = () => page.evaluate(() => JSON.stringify(window.__studio.store.state.show.picks.p1.notes));
  const sixNotes = await setNotes();
  await page.click('[data-ok]');
  await settle(300);
  check('an update with nothing changed loses none', (await setNotes()) === sixNotes);
  check('and starts a new selection', (await markedCount()) === 0);
  await page.click('.np-set[data-set="p1"] canvas');
  await settle(300);
  check('its row opens it the same way', (await page.textContent('[data-count]')) === '6' && (await page.locator('.np-chip').count()) === 6);
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
  check('one more undo and the placement is gone', await page.evaluate(() => !window.__studio.store.state.show.picks && !window.__studio.store.state.show.clips.some((c) => c.listen?.startsWith('picks:'))));
  await page.keyboard.press('Control+Shift+z');
  await settle(200);
  await page.keyboard.press('Control+s');
  await settle(500);
  const showFile = JSON.parse(readFileSync(path.join(dirs.shows, `${SONG}.json`), 'utf8'));
  check('Ctrl+S saves the picks and the listen to the temp show', showFile.picks?.p1?.notes.length === 6 && JSON.stringify(showFile.clips).includes('picks:p1'));

  // ---- a knob on a note ----
  const knob = await page.evaluate(async () => {
    const s = window.__studio, popup = s.picker.popup, setBefore = s.store.state.show.clips.find((c) => c.listen === 'picks:p1');
    await s.picker.open('p1');
    await new Promise((r) => setTimeout(r, 300));
    const lane = document.querySelector('[data-lane]'), first = lane.options[1];
    const offersPresence = [...lane.options].some((o) => o.value === 'presence');
    lane.value = first.value;
    lane.dispatchEvent(new Event('change', { bubbles: true }));
    const bar = [...document.querySelectorAll('.np-amount')].find((b) => !b.hidden), r = bar.getBoundingClientRect();
    bar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + 2 }));
    window.dispatchEvent(new PointerEvent('pointerup', {}));
    const key = first.value, specBefore = JSON.stringify(popup.conductor.current.picks.draft.notes);
    document.querySelector('[data-ok]').click();
    await new Promise((f) => setTimeout(f, 300));
    const after = s.store.state.show, clip = after.clips.find((c) => c.listen === 'picks:p1');
    return { key, offersPresence, held: specBefore.includes(key), stored: after.picks.p1.notes.some((n) => n[4] && typeof n[4] === 'object' && key in n[4]), sameClip: clip.start === setBefore.start && clip.end === setBefore.end };
  });
  check('the lane offers a widget\'s knobs, never how present', !!knob.key && knob.key !== 'intensity' && !knob.offersPresence, knob.key);
  check('a bar on a knob goes to the preview and into the set', knob.held && knob.stored, JSON.stringify(knob));
  check('a knob value leaves the clip where it was placed', knob.sameClip);

  // ---- adding notes to a set ----
  const addTo = await page.evaluate(async () => {
    const s = window.__studio, p = s.picker, set = () => s.store.state.show.picks.p1.notes, before = set().length;
    const clipBefore = s.store.state.show.clips.find((c) => c.listen === 'picks:p1');
    await p.open('p1');
    await new Promise((r) => setTimeout(r, 300));
    const offered = !document.querySelector('[data-add]').hidden;
    document.querySelector('[data-add]').click();
    await new Promise((r) => setTimeout(r, 300));
    const onRoll = { open: p.popup.isOpen, picked: p.marked.size, step: document.querySelector('[data-s1t]').textContent, button: document.querySelector('[data-connect]').textContent, unchanged: set().length === before };
    const taken = new Set(p.marked), other = p.l.notes.find((n) => !taken.has(n.id) && n.t > clipBefore.start && n.t < clipBefore.end);
    p.roll.d.click(other);
    document.querySelector('[data-connect]').click();
    await new Promise((r) => setTimeout(r, 300));
    const back = { chips: document.querySelectorAll('.np-chip').length, on: document.querySelectorAll('.np-chip.sel').length, ok: document.querySelector('[data-ok]').textContent };
    document.querySelector('[data-ok]').click();
    await new Promise((r) => setTimeout(r, 300));
    const clip = s.store.state.show.clips.find((c) => c.listen === 'picks:p1');
    return { before, offered, onRoll, back, after: set().length, kept: set().some((n) => n[0] === other.t && n[2] === other.m), sameClip: clip.start === clipBefore.start && clip.end === clipBefore.end, fresh: p.marked.size, button: document.querySelector('[data-connect]').textContent };
  });
  check('editing a set offers to add notes', addTo.offered);
  check('Add more notes goes to the roll with the set picked, the scene as it was', !addTo.onRoll.open && addTo.onRoll.picked === addTo.before && addTo.onRoll.unchanged && /^Adding notes to /.test(addTo.onRoll.step) && /^Back to /.test(addTo.onRoll.button), JSON.stringify(addTo.onRoll));
  check('back in the popup all of them are on, one more than before', addTo.back.on === addTo.before + 1 && addTo.back.chips === addTo.before + 1 && addTo.back.ok === 'Update the scene', JSON.stringify(addTo.back));
  check('Update adds the note to the set', addTo.after === addTo.before + 1 && addTo.kept, JSON.stringify(addTo));
  check('and the clip stays as it was, as the note is inside it', addTo.sameClip);
  check('and the roll starts fresh again', addTo.fresh === 0 && addTo.button === 'Connect to a widget…', JSON.stringify(addTo));

  const stale = await page.evaluate(async () => {
    const s = window.__studio, p = s.picker;
    await p.open('p1');
    await new Promise((r) => setTimeout(r, 200));
    document.querySelector('[data-add]').click();
    await new Promise((r) => setTimeout(r, 200));
    const inView = p.marked.size && [...p.l.notes].filter((n) => p.marked.has(n.id)).some((n) => n.t >= p.roll.view.a && n.t <= p.roll.view.b);
    // A forgotten note, then the set's own row: its popup is the adding's, with that note on. Cancelled, it comes back to the adding.
    const forgotten = p.l.notes.find((n) => !p.marked.has(n.id));
    p.marked.add(forgotten.id);
    const picked = p.marked.size;
    const row = document.querySelector('.np-set[data-set="p1"] canvas');
    row?.click();
    await new Promise((r) => setTimeout(r, 200));
    const newOn = p.popup.picks.has(forgotten.id);
    p.popup.close();
    const still = document.querySelector('[data-connect]').textContent;
    // The set changes under it: an update must not overwrite it.
    const show = s.store.state.show, notes = show.picks.p1.notes;
    s.store.dispatch({ type: 'edit', edit: { kind: 'updatePicks', id: 'p1', widget: show.clips.find((c) => c.listen === 'picks:p1').widget, notes: notes.slice(1) } });
    await new Promise((r) => setTimeout(r, 200));
    const after = { button: document.querySelector('[data-connect]').textContent, picked: p.marked.size, said: document.querySelector('.np-notices').textContent };
    s.store.dispatch({ type: 'dismiss', id: 'picker-adding' });
    s.store.dispatch({ type: 'undo' });
    p.close();
    return { picked, inView, newOn, still, after };
  });
  check('Add more notes brings the set into view', !!stale.inView);
  check('the set\'s own row, while adding, has the note just picked on', stale.newOn === true);
  check('a row\'s popup, cancelled, comes back to the adding', /^Back to /.test(stale.still), stale.still);
  check('the overlay says why the adding ended', /no longer adding/.test(stale.after.said), stale.after.said);
  check('a set that changes while adding ends the adding, and the picks stay', stale.after.button === 'Connect to a widget…' && stale.after.picked === stale.picked, JSON.stringify(stale.after));

  // ---- a pick left behind ----
  const warned = await page.evaluate(async () => {
    // A set over one clip, split, and its first part then gone: that part's pick has nothing to fire.
    const s = window.__studio;
    s.store.dispatch({ type: 'edit', edit: { kind: 'placePicks', widget: 'halftone', notes: [[20, 20.2, 60, 80], [60, 60.2, 62, 80]] } });
    await s.picker.open();   // drawn already: the set's own notes don't change below
    const c = s.store.state.show.clips.find((x) => x.listen === 'picks:p2');
    s.store.dispatch({ type: 'edit', edit: { kind: 'splitClip', clip: c.id, t: 40 } });
    s.store.dispatch({ type: 'edit', edit: { kind: 'removeClip', clip: c.id } });
    return document.querySelector('.np-set[data-set="p2"] .np-set-warn')?.textContent ?? '';
  });
  await settle();
  await shot('never-heard');
  check('the set row says a pick is never heard', warned === '1 never heard', warned);

  // A clip moved off a drawn set, the picker closed as it is for that edit: the picks stay the same object.
  const moved = await page.evaluate(async () => {
    const s = window.__studio, warn = () => document.querySelector('.np-set[data-set="p3"] .np-set-warn')?.textContent ?? '';
    s.store.dispatch({ type: 'edit', edit: { kind: 'placePicks', widget: 'halftone', notes: [[80, 80.2, 60, 80], [81, 81.2, 62, 80]] } });
    const before = warn(), picks = s.store.state.show.picks, c = s.store.state.show.clips.find((x) => x.listen === 'picks:p3');
    s.picker.close();
    s.store.dispatch({ type: 'edit', edit: { kind: 'moveClip', clip: c.id, start: 90, track: c.track } });
    await s.picker.open();
    const after = warn(), same = picks === s.store.state.show.picks;
    s.store.dispatch({ type: 'edit', edit: { kind: 'moveClip', clip: c.id, start: c.start, track: c.track } });
    return { before, after, same, back: warn() };
  });
  check('a clip moved off a drawn set: its row says so', moved.same && moved.before === '' && moved.after === '2 never heard', JSON.stringify(moved));
  check('and moved back with the picker open, it stops', moved.back === '', moved.back);

  // A pick with no note on the roll, opened on nothing picked: it is on, says so, and an update with another widget keeps it.
  const offRoll = await page.evaluate(async () => {
    const s = window.__studio, notes = [[80, 80.2, 2, 80], [81, 81.2, 2, 80]];
    s.store.dispatch({ type: 'edit', edit: { kind: 'placePicks', widget: 'halftone', notes } });
    s.picker.openPopup('p4');
    const chips = [...document.querySelectorAll('.np-chip')].map((c) => c.title), count = document.querySelector('[data-count]').textContent;
    s.picker.popup.takeWidget('marbling');
    document.querySelector('[data-ok]').click();
    return { chips, count, kept: JSON.stringify(s.store.state.show.picks.p4.notes) === JSON.stringify(notes), widget: s.store.state.show.clips.find((c) => c.listen === 'picks:p4').widget };
  });
  await settle();
  check('a pick off every note: shown on, said so, and an update loses none', offRoll.count === '2' && offRoll.chips.length === 2 && offRoll.chips.every((t) => /no note here any more/.test(t)) && offRoll.kept && offRoll.widget === 'marbling', JSON.stringify(offRoll));

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
  check('Pick notes opens with nothing selected', count === 0, String(count));
  await undoButton();
  check('and Undo does not bring the last selection back', (await markedCount()) === 0);
  await clickNote(await noteOnRoll(0));
  await page.click('.np-set[data-set="p1"] button');
  await settle();
  await page.keyboard.press('Control+z');
  await settle();
  const told = await page.textContent('.np-notices');
  check('Ctrl+Z after removing a set: the marks go back, and it says so and where that is undone', (await markedCount()) === count && /took back 1 change.*Back to the studio/.test(told), told);
  await page.waitForTimeout(1300);
  const before2 = fileMarks();
  await clickNote(await unmarkedOnRoll());
  const want = await page.evaluate(() => { const p = window.__studio.picker; return new Set([...p.stored, ...p.marked]).size + p.unmatched.length; });
  page.on('dialog', (d) => void d.accept());
  await page.reload();
  let inFile = -1;
  for (let k = 0; k < 20 && inFile !== want; k++) { await page.waitForTimeout(100); inFile = fileMarks(); }
  check('a mark made just before a reload reaches the file', inFile === want && want === before2 + 1, `${inFile} in the file, ${want} marked, ${before2} before it`);

  // ---- after a reload: the file's marks, kept apart from a new selection ----
  await page.waitForSelector('[data-pick]');
  await page.click('[data-pick]');
  await page.waitForSelector('.np:not([hidden]) .np-roll-top');
  await settle(400);
  check('reloaded: nothing selected, every mark still known', (await markedCount()) === 0 && await page.evaluate(() => window.__studio.picker.stored.size) === want);
  const afterSave = async () => { await page.waitForTimeout(1300); await page.evaluate(() => window.__studio.picker.saving); return fileMarks(); };
  const unmarked = await unmarkedOnRoll();
  await clickNote(unmarked);
  check('a new pick adds to the file', (await markedCount()) === 1 && (await afterSave()) === want + 1, String(fileMarks()));
  await clickNote(unmarked);
  check('unpicked again it is gone, and no other mark with it', (await markedCount()) === 0 && (await afterSave()) === want, String(fileMarks()));
  const offered = await bringCount();
  check('Bring back offers the unconnected marks after a reload too', offered > 0, String(offered));
  await page.click('[data-bring]'); await settle();
  check('and picks them', (await markedCount()) === offered);
  const r2 = await rollBox();
  await page.keyboard.down('Alt');
  await page.mouse.move(r2.x + 125, r2.y + 25); await page.mouse.down(); await page.mouse.move(r2.x + r2.width - 5, r2.y + r2.height - 5, { steps: 4 }); await page.mouse.up();
  await page.keyboard.up('Alt');
  await settle();
  const unpicked = await markedCount();
  check('Alt-drag unpicks them', unpicked < offered, `${unpicked} of ${offered}`);
  check('and the file keeps them all', (await afterSave()) === want, String(fileMarks()));
  await undoButton();
  check('Undo puts the unpicked ones back', (await markedCount()) === offered);
  await undoButton();
  check('Undo again takes Bring back back', (await markedCount()) === 0);

  // An outline only goes with a box around nothing else, and Undo restores it.
  const outline = await page.evaluate(() => {
    const p = window.__studio.picker, box = p.roll.d.box, k = [1, 1.1, 60, 80], n = p.l.notes[0];
    p.unmatched = [k];
    box([n], true, [k]);
    const withNote = p.unmatched.length;
    box([], true, [k]);
    const alone = p.unmatched.length;
    p.undo();
    const undone = p.unmatched.length;
    p.unmatched = [];
    p.tellUnmatched();
    return { withNote, alone, undone };
  });
  check('an outline: an Alt-drag over notes leaves it, a box around it alone drops it, Undo restores it', outline.withNote === 1 && outline.alone === 0 && outline.undone === 1, JSON.stringify(outline));

  check('no page errors', !errors.length, errors[0] ?? '');
} finally {
  await st.close();
}
process.exit(finish('picker-check'));
