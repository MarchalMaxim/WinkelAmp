// The layer panel in a real browser (plan 2026-10-31 T16): the 30 s fixture song given a fake violin track, a show
// with kandinsky and strings. Checks that choosing Melody saves listen: 'melody' and Ctrl+Z removes it; that "Pulse
// every 1 bar" writes pivots 4 beats apart in one undo step; that Window, then a changed shape, then "Reset place"
// gives defaultRegion; that the picker's filter by two of rorschach's feel words (lab/tags.json, one of them not
// kandinsky's) keeps rorschach and drops kandinsky, and "suits this
// song" keeps strings; that nothing overflows at phone width; and no page errors. Screenshots go to
// renders/look/T16/{panel-listen,panel-where,panel-intensity,picker-filter}{,-phone}.png.
//
//   npm run layers-check [-- --headed] [--keep]
//
// Local only: needs ffmpeg and system Chrome. Its own Vite server from port 5216.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checker, needFfmpeg, openStudio, ROOT } from '../lib/studio-session.mjs';

const argv = process.argv.slice(2);
const HEADED = argv.includes('--headed'), KEEP = argv.includes('--keep');
needFfmpeg('layers-check');
const { check, finish } = checker();
const LOOK = path.join(ROOT, 'renders/look/T16');
mkdirSync(LOOK, { recursive: true });

let pack;
const st = await openStudio({ songs: 'fixture', headed: HEADED, keep: KEEP, port: 5216, shows: (packs) => {
  pack = packs.demo;
  const D = Math.round(pack.duration * 1000) / 1000;
  return { demo: { version: 3, id: 'demo', song: 'demo', title: 'Layers check', clips: [
    { id: 'c1', start: 0, end: D, track: 0, widget: 'kandinsky' },
    { id: 'c2', start: 0, end: 16, track: 1, widget: 'strings' },
    { id: 'c3', start: 0, end: 16, track: 2, widget: 'casket' },
  ] } };
} });
const { page, errors, vite, dirs: { songs, shows } } = st;
const { defaultRegion } = await vite.ssrLoadModule('/src/studio/ui/layer-controls.ts');
// Two feel words of rorschach: one kandinsky lacks first, then another of rorschach's.
const TAGS = JSON.parse(readFileSync(path.join(ROOT, 'lab/tags.json'), 'utf8'));
const feelOf = (id) => (TAGS.tags ?? TAGS)[id]?.feel ?? [];
const rf = feelOf('rorschach'), only = rf.filter((w) => !feelOf('kandinsky').includes(w));
const FEEL = only.length && rf.length >= 2 ? [only[0], rf.find((w) => w !== only[0])] : ['dark', 'liquid'];

const show = () => page.evaluate(() => window.__studio.store.state.show);
const blur = () => page.evaluate(() => document.activeElement?.blur());
const shot = async (name, sel) => {
  // Below the sticky tabs (and at phone width the sticky top bar).
  await page.locator(sel).first().evaluate((el) => { el.style.scrollMarginTop = innerWidth < 900 ? '120px' : '56px'; el.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(LOOK, `${name}.png`) });
};

try {
  // A fake violin track: the fixture's notes from E4 up (a pack v2 the validator accepts), then the page again.
  const file = path.join(songs, 'demo', 'pack.json');
  const p = JSON.parse(readFileSync(file, 'utf8'));
  const vn = p.notes.filter((n) => n[2] >= 64 && n[1] > n[0]);
  Object.assign(p, { version: 2, kind: 'ensemble', tracks: { violin: { label: 'Violins', family: 'strings', notes: vn, share: 0.4, vel: { borrowed: 0, level: vn.length } } } });
  writeFileSync(file, JSON.stringify(p));
  pack = p;
  await page.reload();
  await page.waitForFunction(() => window.__studio?.player.duration > 0, null, { timeout: 30_000 });
  check('the fixture pack has its violin track in the studio', await page.evaluate(() => !!window.__studio.store.state.song.tracks?.violin));

  for (const phone of [false, true]) {
    const sfx = phone ? '-phone' : '';
    await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1280, height: 800 });
    await page.waitForTimeout(300);

    // Select the strings clip.
    await page.evaluate(() => window.__studio.store.dispatch({ type: 'select', clip: 'c2' }));
    await page.waitForSelector('.panel .lc-listen select');

    // Listens to: the options, then Melody; saved; Ctrl+Z takes it away.
    const values = await page.$$eval('.lc-listen select option', (os) => os.map((o) => o.value));
    if (!phone) check('the listen options: all notes, the violin track, the six lines (no family of one track), the six kinds of note',
      JSON.stringify(values) === JSON.stringify(['all', 'violin', 'melody', 'bassline', 'inner', 'low', 'high', 'accents', 'chords', 'runs', 'trills', 'long', 'repeats', 'rolls']), values.join(','));
    await page.selectOption('.lc-listen select', 'melody');
    await page.waitForTimeout(150);
    await shot(`panel-listen${sfx}`, '.panel .lc');
    if (!phone) {
      check('choosing Melody sets listen: melody', (await show()).clips.find((c) => c.id === 'c2').listen === 'melody');
      await blur();
      await page.keyboard.press('Control+s');
      await page.waitForFunction(() => !document.querySelector('.save-state')?.classList.contains('dirty'), null, { timeout: 5000 }).catch(() => {});
      const saved = JSON.parse(readFileSync(path.join(shows, 'demo.json'), 'utf8'));
      check('Ctrl+S saves listen: melody', saved.version === 3 && saved.clips.find((c) => c.id === 'c2').listen === 'melody', `version ${saved.version}`);
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);
      const after = (await show()).clips.find((c) => c.id === 'c2');
      const sel = await page.$eval('.lc-listen select', (s) => s.value);
      check('Ctrl+Z removes it, and the select follows', after.listen === undefined && sel === 'all', `listen ${after.listen}, select ${sel}`);
      // The same with the select still focused (Ctrl+Z right after choosing).
      await page.selectOption('.lc-listen select', 'melody');
      await page.focus('.lc-listen select');
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);
      const focused = await page.evaluate(() => ({ listen: window.__studio.store.state.show.clips.find((c) => c.id === 'c2').listen, sel: document.querySelector('.lc-listen select').value, focus: document.activeElement?.tagName }));
      check('Ctrl+Z with the select still focused: removed, and the select follows', focused.listen === undefined && focused.sel === 'all', JSON.stringify(focused));
      check('strings (it draws, it does not read the canvas) has no reader hint', (await page.locator('.panel .lc-hint').count()) === 0);
      await page.selectOption('.lc-listen select', 'violin');   // for the picture of "while its part plays"
      await blur();
    }

    // Where: Window, a rectangle with a sharp edge, Reset place.
    await page.click('.panel [data-mode="window"]');
    await page.waitForTimeout(100);
    if (!phone) {
      const r1 = (await show()).clips.find((c) => c.id === 'c2').region;
      check('Window places a window', r1?.mode === 'window', JSON.stringify(r1));
      await page.selectOption('.panel [data-shape]', 'rect');
      await page.locator('.panel [data-feather]').fill('0');
      await page.selectOption('.panel [data-blend]', 'lighten');
      const r2 = (await show()).clips.find((c) => c.id === 'c2').region;
      check('shape, edge and blend change the window', r2?.shape === 'rect' && r2.feather === 0 && r2.blend === 'lighten', JSON.stringify(r2));
      await page.click('.panel [data-reset]');
      const r3 = (await show()).clips.find((c) => c.id === 'c2').region;
      check('Reset place gives defaultRegion', JSON.stringify(r3) === JSON.stringify(defaultRegion('strings')), JSON.stringify(r3));
      await blur();
      await page.keyboard.press('Control+z');
      const r4 = (await show()).clips.find((c) => c.id === 'c2').region;
      check('Ctrl+Z after Reset place gives the changed window back', r4?.shape === 'rect' && r4.blend === 'lighten', JSON.stringify(r4));
      // Whole screen, then Window: the place it had comes back (remembered by clip).
      await page.click('.panel [data-mode=""]');
      await page.waitForTimeout(100);
      const r5 = (await show()).clips.find((c) => c.id === 'c2').region;
      await page.click('.panel [data-mode="window"]');
      await page.waitForTimeout(100);
      const r6 = (await show()).clips.find((c) => c.id === 'c2').region;
      check('Whole screen, then Window, brings the same place back', r5 === undefined && JSON.stringify(r6) === JSON.stringify(r4), `${JSON.stringify(r5)} then ${JSON.stringify(r6)}`);
    }
    await shot(`panel-where${sfx}`, '.panel .lc-part:nth-of-type(2)');

    // The picker: two of rorschach's feel words (from lab/tags.json, which the user keeps retagging; one of them not
    // kandinsky's) keep rorschach and drop kandinsky; suits this song keeps strings.
    await page.click('[data-act="add"]');
    await page.click('.wp-toggle');
    for (const w of FEEL) await page.click(`.wp-chip[data-feel="${w}"]`);
    const listed = await page.$$eval('.picker .pick', (bs) => bs.map((b) => b.dataset.id));
    if (!phone) check(`the ${FEEL.join(' + ')} filter keeps rorschach, not kandinsky`, listed.includes('rorschach') && !listed.includes('kandinsky'), listed.join(','));
    await shot(`picker-filter${sfx}`, '.picker');
    await shot(`picker-filter-list${sfx}`, '.picker section');
    await page.click('.picker [data-clear]');
    await page.click('.wp-suits input');
    const suits = await page.$$eval('.picker .pick', (bs) => bs.map((b) => b.dataset.id));
    if (!phone) check('"suits this song" (violins) keeps strings and current', suits.includes('strings') && suits.includes('current'), `${suits.length}: ${suits.join(',')}`);
    await page.click('.wp-suits input');
    await page.click('.wp-toggle');

    // Nothing overflows: no sideways page scroll, no control wider than the panel.
    const over = await page.evaluate(() => {
      const panel = document.querySelector('.panel'), pr = panel.getBoundingClientRect(), out = [];
      for (const el of panel.querySelectorAll('.lc *, .picker *')) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > pr.right + 0.5 || r.left < pr.left - 0.5)) out.push(`${el.tagName.toLowerCase()}.${el.className}`);
      }
      return { sw: document.documentElement.scrollWidth, w: innerWidth, out: out.slice(0, 6) };
    });
    check(`nothing overflows at ${phone ? 'phone width (390)' : '1280×800'}`, over.sw <= over.w && !over.out.length, JSON.stringify(over));
    await page.click('[data-act="add"]');   // close the picker

    // A reader (casket): the hint that in a window it cuts only its own picture.
    await page.evaluate(() => window.__studio.store.dispatch({ type: 'select', clip: 'c3' }));
    await page.waitForSelector('.panel .lc');
    await page.click('.panel [data-mode="window"]');
    const hint = await page.locator('.panel .lc-hint').textContent().catch(() => '');
    if (!phone) check('casket as a small copy says it cuts only its own picture', /as a small copy it cuts only its own picture/.test(hint ?? ''), hint ?? '');
    await shot(`panel-where-reader${sfx}`, '.panel .lc-part:nth-of-type(2)');
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await st.close();
}
process.exit(finish('layers-check'));
