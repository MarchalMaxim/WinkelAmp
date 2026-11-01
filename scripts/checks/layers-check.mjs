// The layer panel in a real browser (plan 2026-10-31 T16): the 30 s fixture song given a fake violin track, a show
// with kandinsky and strings. Checks that choosing Melody saves listen: 'melody' and Ctrl+Z removes it; that "Pulse
// every 1 bar" writes pivots 4 beats apart in one undo step; that Window, then a changed shape, then "Reset place"
// gives defaultRegion; that the picker's dark + liquid filter keeps rorschach (and drops kandinsky), and "suits this
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
  return { demo: { version: 1, id: 'demo', song: 'demo', title: 'Layers check', sections: [
    { start: 0, end: 16, label: 'One', layers: [{ widget: 'kandinsky' }, { widget: 'strings' }, { widget: 'casket' }] },
    { start: 16, end: D, label: 'Two', layers: [{ widget: 'kandinsky' }] },
  ] } };
} });
const { page, errors, vite, dirs: { songs, shows } } = st;
const { defaultRegion } = await vite.ssrLoadModule('/src/studio/ui/layer-controls.ts');

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

    // Open the strings layer of the first section.
    await page.click('.band .sec >> nth=0');
    const opened = await page.locator('.layer.open').count();
    if (!opened) await page.click('.layer[data-k="1"] .layer-name');
    else if (!(await page.locator('.layer.open[data-k="1"]').count())) { await page.click('.layer.open .layer-name'); await page.click('.layer[data-k="1"] .layer-name'); }
    await page.waitForSelector('.layer.open .lc-listen select');

    // Listens to: the options, then Melody; saved; Ctrl+Z takes it away.
    const values = await page.$$eval('.lc-listen select option', (os) => os.map((o) => o.value));
    if (!phone) check('the listen options: all notes, the violin track, the six lines (no family of one track)',
      JSON.stringify(values) === JSON.stringify(['all', 'violin', 'melody', 'bassline', 'inner', 'low', 'high', 'accents']), values.join(','));
    await page.selectOption('.lc-listen select', 'melody');
    await page.waitForTimeout(150);
    await shot(`panel-listen${sfx}`, '.layer.open .lc');
    if (!phone) {
      check('choosing Melody sets listen: melody', (await show()).sections[0].layers[1].listen === 'melody');
      await blur();
      await page.keyboard.press('Control+s');
      await page.waitForFunction(() => !document.querySelector('.save-state')?.classList.contains('dirty'), null, { timeout: 5000 }).catch(() => {});
      const saved = JSON.parse(readFileSync(path.join(shows, 'demo.json'), 'utf8'));
      check('Ctrl+S saves listen: melody (a version 2 show)', saved.version === 2 && saved.sections[0].layers[1].listen === 'melody', `version ${saved.version}`);
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);
      const after = (await show()).sections[0].layers[1];
      const sel = await page.$eval('.lc-listen select', (s) => s.value);
      check('Ctrl+Z removes it, and the select follows', after.listen === undefined && sel === 'all', `listen ${after.listen}, select ${sel}`);
      // The same with the select still focused (Ctrl+Z right after choosing).
      await page.selectOption('.lc-listen select', 'melody');
      await page.focus('.lc-listen select');
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);
      const focused = await page.evaluate(() => ({ listen: window.__studio.store.state.show.sections[0].layers[1].listen, sel: document.querySelector('.lc-listen select').value, focus: document.activeElement?.tagName }));
      check('Ctrl+Z with the select still focused: removed, and the select follows', focused.listen === undefined && focused.sel === 'all', JSON.stringify(focused));
      check('strings (it draws, it does not read the canvas) has no reader hint', (await page.locator('.layer.open .lc-hint').count()) === 0);
      await page.selectOption('.lc-listen select', 'violin');   // for the picture of "while its part plays"
      await blur();
    }

    // Where: Window, a rectangle with a sharp edge, Reset place.
    await page.click('.layer.open [data-mode="window"]');
    await page.waitForTimeout(100);
    if (!phone) {
      const r1 = (await show()).sections[0].layers[1].region;
      check('Window places a window', r1?.mode === 'window', JSON.stringify(r1));
      await page.selectOption('.layer.open [data-shape]', 'rect');
      await page.locator('.layer.open [data-feather]').fill('0');
      await page.click('.layer.open [data-blend]');
      const r2 = (await show()).sections[0].layers[1].region;
      check('shape, edge and blend change the window', r2?.shape === 'rect' && r2.feather === 0 && r2.blend === 'lighten', JSON.stringify(r2));
      await page.click('.layer.open [data-reset]');
      const r3 = (await show()).sections[0].layers[1].region;
      check('Reset place gives defaultRegion', JSON.stringify(r3) === JSON.stringify(defaultRegion('strings')), JSON.stringify(r3));
      await blur();
      await page.keyboard.press('Control+z');
      const r4 = (await show()).sections[0].layers[1].region;
      check('Ctrl+Z after Reset place gives the changed window back', r4?.shape === 'rect' && r4.blend === 'lighten', JSON.stringify(r4));
      // Whole screen, then Window: the place it had comes back (remembered by section and instance key).
      await page.click('.layer.open [data-mode=""]');
      await page.waitForTimeout(100);
      const r5 = (await show()).sections[0].layers[1].region;
      await page.click('.layer.open [data-mode="window"]');
      await page.waitForTimeout(100);
      const r6 = (await show()).sections[0].layers[1].region;
      check('Whole screen, then Window, brings the same place back', r5 === undefined && JSON.stringify(r6) === JSON.stringify(r4), `${JSON.stringify(r5)} then ${JSON.stringify(r6)}`);
    }
    await shot(`panel-where${sfx}`, '.layer.open .lc-part:nth-of-type(2)');

    // Intensity: Pulse every 1 bar → pivots 4 beats apart, one undo step.
    await page.locator('.layer.open [data-every]').fill('1');
    await page.selectOption('.layer.open [data-unit]', 'bars');
    await page.click('.layer.open [data-p="pulse"]');
    await page.waitForTimeout(100);
    if (!phone) {
      const piv = (await show()).sections[0].layers[1].intensity ?? [];
      const ones = piv.filter((q) => q.v === 1).map((q) => q.t);
      const beats = pack.beats, gaps = beats.slice(1).map((b, i) => b - beats[i]).sort((a, b) => a - b);
      const med = gaps.length ? gaps[gaps.length >> 1] : 0.5;
      const ok = ones.length >= 2 && ones.slice(1).every((t, i) => {
        const a = ones[i], inGrid = beats.filter((b) => b >= a - 1e-6 && b < t - 1e-6).length;
        return inGrid === 4 || Math.abs(t - a - 4 * med) < 0.02;
      });
      check('Pulse every 1 bar writes pivots 4 beats apart', ok, `${ones.length} pulses at ${ones.slice(0, 4).map((t) => t.toFixed(2)).join(', ')}… (median beat ${med.toFixed(3)} s)`);
      await blur();
      await page.keyboard.press('Control+z');
      const undone = (await show()).sections[0].layers[1];
      check('one Ctrl+Z takes the whole preset away', undone.intensity === undefined, `${undone.intensity?.length ?? 0} pivots left`);
      await page.keyboard.press('Control+Shift+z');
    }
    await shot(`panel-intensity${sfx}`, '.layer.open .lc-part:nth-of-type(3)');

    // The picker: dark + liquid keeps rorschach; suits this song keeps strings.
    await page.click('[data-act="add"]');
    await page.click('.wp-toggle');
    await page.click('.wp-chip[data-feel="dark"]');
    await page.click('.wp-chip[data-feel="liquid"]');
    const listed = await page.$$eval('.picker .pick', (bs) => bs.map((b) => b.dataset.id));
    if (!phone) check('the dark + liquid filter keeps rorschach, not kandinsky', listed.includes('rorschach') && !listed.includes('kandinsky'), listed.join(','));
    await shot(`picker-filter${sfx}`, '.picker');
    await shot(`picker-filter-list${sfx}`, '.picker section');
    await page.click('[data-clear]');
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
    await page.click('.layer.open .layer-name');
    await page.click('.layer[data-k="2"] .layer-name');
    await page.waitForSelector('.layer.open[data-k="2"] .lc');
    await page.click('.layer.open [data-mode="window"]');
    const hint = await page.locator('.layer.open .lc-hint').textContent().catch(() => '');
    if (!phone) check('casket as a small copy says it cuts only its own picture', /as a small copy it cuts only its own picture/.test(hint ?? ''), hint ?? '');
    await shot(`panel-where-reader${sfx}`, '.layer.open .lc-part:nth-of-type(2)');
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await st.close();
}
process.exit(finish('layers-check'));
