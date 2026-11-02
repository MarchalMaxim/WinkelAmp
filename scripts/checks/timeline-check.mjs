// The timeline as DJ software in a real browser: the studio on the fixture song, its clips used with the mouse as a user
// would. A drag moves a clip and one Ctrl+Z undoes it; a drag up changes its track; a clip landing on an occupied spot goes
// to a free track; an edge drag resizes and snaps; Alt and the Snap button place freely; a duplicate overlaps itself as an
// instance of its own; Ctrl+P adds at the playhead; Delete removes; a song with no show opens empty, with the composer one
// click away; and the render page gives the same picture for the same seek, with overlapping copies drawing, on seeded
// randomness.
//
//   npm run timeline-check [-- --headed] [--keep] [--shots <dir>]
//
// Local only: needs ffmpeg and system Chrome.
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { checker, needFfmpeg, openStudio } from '../lib/studio-session.mjs';

const argv = process.argv.slice(2);
const HEADED = argv.includes('--headed'), KEEP = argv.includes('--keep');
const SHOTS = argv.includes('--shots') ? path.resolve(argv[argv.indexOf('--shots') + 1]) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
needFfmpeg('timeline-check');
const { check, finish } = checker();

const st = await openStudio({ songs: 'fixture', headed: HEADED, keep: KEEP, port: 5216, viewport: { width: 1440, height: 900 }, shows: (packs) => {
  const D = Math.round(packs.demo.duration * 1000) / 1000;
  return { demo: { version: 3, id: 'demo', song: 'demo', title: 'Timeline check', clips: [
    { id: 'c1', start: 2, end: 8, track: 0, widget: 'kandinsky' },
    { id: 'c2', start: 4, end: 12, track: 1, widget: 'squares' },
    { id: 'c3', start: 20, end: D, track: 0, widget: 'casket' },
  ] } };
} });
const { page, errors, dirs, base } = st;
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const clipOf = (id) => page.evaluate((id) => window.__studio.store.state.show.clips.find((c) => c.id === id) ?? null, id);
const count = () => page.evaluate(() => window.__studio.store.state.show.clips.length);
const selected = () => page.evaluate(() => window.__studio.store.state.selected.clip);
const box = (id) => page.locator(`.clip[data-id="${id}"]`).boundingBox();
const undo = async () => { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Control+z'); };
/** Press at (x, y), go in steps to (x + dx, y + dy), let go. */
const drag = async (x, y, dx, dy = 0) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8);
  await page.mouse.up();
};
const dragClip = async (id, dx, dy = 0) => { const b = await box(id); await drag(b.x + b.width / 2, b.y + b.height / 2, dx, dy); };
/** Pixels per second across the timeline. */
const pps = async () => { const b = await page.locator('.tracks').boundingBox(); return b.width / (await page.evaluate(() => window.__studio.player.duration)); };

try {
  await page.waitForSelector('.clip[data-id="c1"]');
  const snapOn = await page.getAttribute('[data-tl="snap"]', 'aria-pressed');
  check('Snap starts on', snapOn === 'true', snapOn);
  await shot('start');

  // Click selects: the panel and the lane follow it.
  const b1 = await box('c1');
  await page.mouse.click(b1.x + b1.width / 2, b1.y + b1.height / 2);
  check('a click selects the clip', (await selected()) === 'c1');
  check('its knobs and its lane open', (await page.locator('.panel .params .prm').count()) > 0 && (await page.locator('.lane.open').count()) === 1);
  check('a click is not a move', (await clipOf('c1')).start === 2);

  // Snap off for exact moves, on again for the snapping.
  await page.click('[data-tl="snap"]');
  const px = await pps();

  // A drag moves it; one Ctrl+Z undoes the whole drag.
  await dragClip('c1', 2 * px);
  let c = await clipOf('c1');
  check('a drag moves the clip in time, keeping its length', Math.abs(c.start - 4) < 0.1 && Math.abs(c.end - c.start - 6) < 1e-3, JSON.stringify(c));
  await undo();
  c = await clipOf('c1');
  check('one Ctrl+Z undoes the whole drag', c.start === 2 && c.end === 8, JSON.stringify(c));

  // A drag up changes its track (the free row above is there to drop on).
  await dragClip('c1', 0, -2 * 26);
  c = await clipOf('c1');
  check('a drag up changes the track', c.track === 2 && c.start === 2, JSON.stringify(c));
  await undo();

  // Landing on an occupied spot: it goes to a free track above, and nothing is lost.
  await dragClip('c1', 14 * px);
  c = await clipOf('c1');
  const c3 = await clipOf('c3');
  check('a clip landing on an occupied spot goes to a free track', c.track >= 1 && c3.track === 0 && c.end > c3.start, JSON.stringify({ c, c3 }));
  await undo();

  // Its right edge resizes it, its left edge too.
  const b2 = await box('c1');
  await drag(b2.x + b2.width - 2, b2.y + b2.height / 2, 3 * px);
  c = await clipOf('c1');
  check('dragging the right edge resizes it', c.start === 2 && Math.abs(c.end - 11) < 0.15, JSON.stringify(c));
  await undo();
  await drag(b2.x + 2, b2.y + b2.height / 2, 1 * px);
  c = await clipOf('c1');
  check('dragging the left edge resizes it', Math.abs(c.start - 3) < 0.15 && c.end === 8, JSON.stringify(c));
  await undo();

  // An edge stops at the neighbour on its track.
  await drag(b2.x + b2.width - 2, b2.y + b2.height / 2, 20 * px);
  c = await clipOf('c1');
  check('an edge stops at the next clip on its track', c.end === 20, JSON.stringify(c));
  await undo();

  // Snap on: an edge dragged near another clip's edge lands on it, Alt does not.
  await page.click('[data-tl="snap"]');
  await drag(b2.x + b2.width - 2, b2.y + b2.height / 2, 3.9 * px);   // towards 11.9: c2 ends at 12
  c = await clipOf('c1');
  check('with Snap on an edge lands on another clip\'s edge', c.end === 12, JSON.stringify(c));
  await undo();
  await page.keyboard.down('Alt');
  await drag(b2.x + b2.width - 2, b2.y + b2.height / 2, 3.9 * px);
  await page.keyboard.up('Alt');
  c = await clipOf('c1');
  check('Alt places it freely', c.end !== 12 && Math.abs(c.end - 11.9) < 0.15, JSON.stringify(c));
  await undo();

  // Duplicate: the same widget overlapping itself, as two instances of their own.
  const b3 = await box('c1');
  await page.mouse.click(b3.x + b3.width / 2, b3.y + b3.height / 2);
  await page.keyboard.press('Control+d');
  const n1 = await selected();
  c = await clipOf(n1);
  check('Ctrl+D makes a copy, selected', c?.widget === 'kandinsky' && c.id !== 'c1', JSON.stringify(c));
  await page.evaluate((id) => { const s = window.__studio, x = s.store.state.show.clips.find((k) => k.id === id); s.store.dispatch({ type: 'edit', edit: { kind: 'moveClip', clip: id, start: 3, track: x.track } }); }, n1);
  const same = await page.evaluate(() => {
    const rt = window.__studio.runtime;
    return rt.loaded().filter((k) => k.startsWith('kandinsky'));
  });
  check('two clips of one widget are two instances', same.length === 2 && same[0] !== same[1], same.join(', '));
  const independent = await page.evaluate(([a, b]) => {
    const rt = window.__studio.runtime;
    return rt.tool(a) !== rt.tool(b);
  }, same);
  check('with state of their own', independent);
  const overlapping = await page.evaluate(() => { const s = window.__studio.store.state.show.clips.filter((c) => c.widget === 'kandinsky'); return s[0].start < s[1].end && s[1].start < s[0].end && s[0].track !== s[1].track; });
  check('they overlap, on two tracks', overlapping);
  await page.keyboard.press('Delete');
  check('Delete removes the selected clip', (await count()) === 3 && (await selected()) === null);

  // Add at the playhead with Ctrl+P.
  await page.evaluate(() => window.__studio.player.seek(14));
  await page.keyboard.press('Control+p');
  await page.waitForSelector('dialog.palette[open]');
  await page.keyboard.type('squares');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const sel = await selected();
  c = await clipOf(sel);
  check('Ctrl+P adds at the playhead, selected', c?.widget === 'squares' && c.start === 14, JSON.stringify(c));
  await undo();

  // Clicking an empty row lets go of the selection and moves the playhead there.
  const tracks = await page.locator('.tracks').boundingBox();
  await page.mouse.click(tracks.x + 17 * px, tracks.y + tracks.height - 6);
  const t = await page.evaluate(() => window.__studio.player.time);
  check('a click on an empty row moves the playhead there', Math.abs(t - 17) < 0.2 && (await selected()) === null, `${t}`);

  // Marks are drawn and a save writes clips.
  const wanted = await page.evaluate(() => window.__studio.store.state.song.sections.filter((s) => s.start > 0).length);
  check('the song\'s structure stays as marks', (await page.locator('.tl-mark').count()) === wanted, `${wanted} marks`);
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(400);
  await shot('saved');
  const saved = JSON.parse(readFileSync(path.join(dirs.shows, 'demo.json'), 'utf8'));
  check('a save writes version 3, clips', saved.version === 3 && Array.isArray(saved.clips) && !saved.sections, `version ${saved.version}`);

  // The render page: an overlapping copy, the same picture for the same seek, a gap goes dark.
  await page.evaluate(() => {
    const s = window.__studio;
    s.store.dispatch({ type: 'edit', edit: { kind: 'duplicateClip', clip: 'c2' } });
    const copy = s.store.state.show.clips.at(-1);
    s.store.dispatch({ type: 'edit', edit: { kind: 'moveClip', clip: copy.id, start: 6, track: 2 } });
  });
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(400);
  const rp = await st.browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await rp.route(/localhost:5174/, (r) => r.abort());
  rp.on('pageerror', (e) => errors.push(`render: ${e}`));
  await rp.goto(`${base}/render.html?show=demo&hz=60`);
  await rp.waitForFunction(() => window.renderReady || window.renderFailed, null, { timeout: 30_000 });
  const render = await rp.evaluate(() => {
    const seek = (t, to) => { window.renderSeek(t, 7); window.renderTo(to); return window.renderFrameHash(); };
    const a = seek(5, 6.5), b = seek(5, 6.5), c = seek(5, 7);
    return { failed: window.renderFailed ?? null, a, b, c, errors: window.renderErrors };
  });
  check('render.html?show follows clips, without widget errors', !render.failed && Object.keys(render.errors ?? {}).length === 0, JSON.stringify(render.errors));
  check('the same seek gives the same picture', render.a === render.b && render.a !== render.c, JSON.stringify(render));
  const gap = await rp.evaluate(() => {
    window.renderSeek(15, 7); window.renderTo(19.5);
    const c = document.getElementById('c'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) lit++;
    return lit / (d.length / 4);
  });
  check('a stretch with nothing placed is dark', gap < 0.001, `${(gap * 100).toFixed(2)} % lit`);
  await rp.close();

  // A song with no show opens with an empty timeline, the composer one click away, and one undo takes it back.
  rmSync(path.join(dirs.shows, 'demo.json'));
  await page.evaluate(() => { window.__studio.store.dispatch({ type: 'saved' }); });
  await page.reload();
  await page.waitForFunction(() => window.__studio?.player.duration > 0, null, { timeout: 30_000 });
  check('no show: an empty timeline', (await count()) === 0 && await page.isVisible('.tracks-empty'));
  await shot('empty');
  await page.click('[data-tl="compose"]');
  await page.waitForFunction(() => window.__studio.store.state.show.clips.length > 0, null, { timeout: 10_000 });
  await page.waitForTimeout(200);
  await shot('composed');
  check('the composer fills it', (await count()) > 0);
  await undo();
  check('one undo takes it back', (await count()) === 0);

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('the check ran to the end', false, String(e?.stack ?? e));
} finally {
  await st.close();
}
process.exit(finish('timeline-check'));
