// The intensity lane in a real browser (plan T18 step 3): the studio on the fixture song, the selected clip's lane under
// the timeline, used with the mouse as a user would. A click adds a pivot and Ctrl+S saves it; a drag moves it and one
// Ctrl+Z undoes the whole drag; a double-click deletes it; right-click on a segment then Hold gives shape 'hold'; a
// segment drag bends it in one undo step; Pulse every bar from the presets menu writes pivots; the paused picture
// changes after an edit inside the preview window; no page errors.
//
//   npm run lanes-check [-- --headed] [--keep] [--shots <dir>]
//
// --shots writes screenshots of the lanes there (the T18 look). Local only: needs ffmpeg and system Chrome.
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { checker, needFfmpeg, openStudio } from '../lib/studio-session.mjs';

const argv = process.argv.slice(2);
const HEADED = argv.includes('--headed'), KEEP = argv.includes('--keep');
const SHOTS = argv.includes('--shots') ? path.resolve(argv[argv.indexOf('--shots') + 1]) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
needFfmpeg('lanes-check');
const { check, finish } = checker();

const st = await openStudio({ songs: 'fixture', headed: HEADED, keep: KEEP, port: 5214, viewport: { width: 1440, height: 900 }, shows: (packs) => {
  const D = Math.round(packs.demo.duration * 1000) / 1000;
  return { demo: { version: 3, id: 'demo', song: 'demo', title: 'Lanes check', clips: [
    { id: 'c1', start: 0, end: 20, track: 0, fade: 0, widget: 'kandinsky' },
    { id: 'c2', start: 0, end: 10, track: 1, fade: 0, widget: 'squares' },
    { id: 'c3', start: 20, end: D, track: 0, widget: 'casket' },
  ] } };
} });
const { page, errors, dirs } = st;

const pivots = (id = 'c2') => page.evaluate((id) => window.__studio.store.state.show.clips.find((c) => c.id === id).intensity ?? null, id);
const hash = () => page.evaluate(() => {
  const c = window.__studio.runtime.ctx.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0x811c9dc5; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16);
});
// The lane's geometry: clip c2 is 0..10 s across the canvas; v 1 at 8 px from the top, 0 at 8 px from the bottom.
const lane = async () => {
  const b = await page.locator('.lane.open canvas').boundingBox();
  return { ...b, X: (t) => b.x + (t / 10) * b.width, Y: (v) => b.y + 8 + (1 - v) * (b.height - 16) };
};
const shot = async (name) => {
  if (!SHOTS) return;
  const tl = await page.locator('.timeline').boundingBox();
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), clip: { x: 0, y: Math.max(0, tl.y - 60), width: 1440, height: Math.min(900 - Math.max(0, tl.y - 60), tl.height + 80) } });
};

try {
  // Select the squares' clip: the lane is its.
  check('with nothing selected the lane says so', (await page.locator('.lanes-empty').count()) === 1);
  await page.evaluate(() => window.__studio.store.dispatch({ type: 'select', clip: 'c2' }));
  await page.waitForSelector('.lane.open canvas');
  const n = await page.locator('.lane').count();
  check('the selected clip has one lane', n === 1, `${n} lanes`);
  // Snap off for exact positions (the fixture's beats are not the point here).
  if ((await page.getAttribute('[data-snap]', 'aria-pressed')) === 'true') await page.click('[data-snap]');

  // A click on empty space adds a pivot there, and the show saves it.
  let L = await lane();
  await page.mouse.click(L.X(3), L.Y(0.5));
  let p = await pivots();
  check('a click adds a pivot where it is', p?.length === 1 && Math.abs(p[0].t - 3) < 0.05 && Math.abs(p[0].v - 0.5) < 0.03, JSON.stringify(p));
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(600);
  const saved = JSON.parse(readFileSync(path.join(dirs.shows, 'demo.json'), 'utf8'));
  const sp = saved.clips.find((c) => c.id === 'c2').intensity;
  check('Ctrl+S saves it', saved.version === 3 && sp?.length === 1 && Math.abs(sp[0].t - p[0].t) < 1e-3, JSON.stringify({ version: saved.version, sp }));

  // A drag moves it; one Ctrl+Z undoes the whole drag (and only it).
  const before = p[0];
  await page.mouse.move(L.X(before.t), L.Y(before.v));
  await page.mouse.down();
  for (let k = 1; k <= 10; k++) await page.mouse.move(L.X(before.t) + k * 12, L.Y(before.v) - k * 1.5);
  await page.mouse.up();
  p = await pivots();
  const moved = p?.length === 1 && p[0].t > before.t + 0.5 && p[0].v > before.v + 0.1;
  check('a drag moves the pivot', moved, JSON.stringify(p));
  await page.keyboard.press('Control+z');
  p = await pivots();
  check('one Ctrl+Z undoes the whole drag', p?.length === 1 && p[0].t === before.t && p[0].v === before.v, JSON.stringify(p));

  // Shift is fine: the same pointer travel moves it a tenth as far.
  await page.mouse.move(L.X(before.t), L.Y(before.v));
  await page.mouse.down();
  await page.keyboard.down('Shift');
  for (let k = 1; k <= 10; k++) await page.mouse.move(L.X(before.t) + k * 12, L.Y(before.v));
  await page.keyboard.up('Shift');
  await page.mouse.up();
  p = await pivots();
  const fineDt = p[0].t - before.t, coarse = (108 / L.width) * 10;   // Shift re-anchors on its first move: 9 × 12 px after it
  check('Shift drags at a tenth of the speed', Math.abs(fineDt - coarse / 10) < coarse / 30, `moved ${fineDt.toFixed(3)} s for ${coarse.toFixed(3)} s of pointer`);
  await page.keyboard.press('Control+z');

  // A double-click deletes it.
  p = await pivots();
  await page.mouse.dblclick(L.X(p[0].t), L.Y(p[0].v));
  p = await pivots();
  check('a double-click deletes the pivot', p === null, JSON.stringify(p));

  // Two pivots, then a right-click on the segment between them and Hold.
  await page.mouse.click(L.X(2), L.Y(0.2));
  await page.mouse.click(L.X(6), L.Y(0.9));
  p = await pivots();
  check('two clicks, two pivots in order', p?.length === 2 && p[0].t < p[1].t, JSON.stringify(p));
  await page.mouse.click(L.X(4), L.Y(0.55), { button: 'right' });
  await page.waitForSelector('.lane-menu');
  await shot('menu-segment');
  await page.click('.lane-menu button:has-text("Hold")');
  p = await pivots();
  check("right-click on a segment, then Hold, gives shape 'hold'", p?.[0].shape === 'hold', JSON.stringify(p));
  await page.keyboard.press('Control+z');

  // A segment drag bends it, in one undo step.
  p = await pivots();
  await page.mouse.move(L.X(4), L.Y(0.55));
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(L.X(4), L.Y(0.55) - k * 1.5);
  await page.mouse.up();
  p = await pivots();
  check('dragging a rising segment up bends it up (bend > 0)', (p?.[0].bend ?? 0) > 0.1, JSON.stringify(p));
  await page.keyboard.press('Control+z');
  p = await pivots();
  check('one Ctrl+Z straightens it again', p?.length === 2 && p[0].bend === undefined, JSON.stringify(p));

  // Arrow keys nudge the selected pivot, one undo step per press (a held key's repeats are one), never merged with
  // the presses on another pivot.
  const v0 = p.map((x) => x.v);
  await page.mouse.click(L.X(p[0].t), L.Y(p[0].v));
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  await page.mouse.click(L.X(p[1].t), L.Y(p[1].v));
  await page.keyboard.press('ArrowDown');
  const nudged = (await pivots()).map((x) => x.v);
  await page.keyboard.press('Control+z');
  const u1 = (await pivots()).map((x) => x.v);
  await page.keyboard.press('Control+z');
  const u2 = (await pivots()).map((x) => x.v);
  const near = (a, b) => Math.abs(a - b) < 0.0011;   // a nudge rounds v to 3 decimals
  check('arrow nudges: each press is one undo step, the other pivot\'s press another',
    near(nudged[0], v0[0] + 0.02) && near(nudged[1], v0[1] - 0.01) && near(u1[0], v0[0] + 0.02) && near(u1[1], v0[1]) && near(u2[0], v0[0] + 0.01) && near(u2[1], v0[1]),
    JSON.stringify({ v0, nudged, u1, u2 }));
  await page.keyboard.press('Control+z');
  p = await pivots();

  // The shapes: Each bar writes pivots 4 beats apart (or the 0.5 s fallback grid without beats).
  await page.click('[data-shape="bar"]');
  p = await pivots();
  const tops = (p ?? []).filter((x) => x.v === 1).map((x) => x.t);
  check('Pulse every bar writes pulses', tops.length >= 2, `${tops.length} pulses at ${tops.slice(0, 4).join(', ')}…`);
  await page.waitForTimeout(200);
  await shot('lane-pulse');
  await page.keyboard.press('Control+z');

  // The paused picture changes after an edit inside the preview window.
  await page.evaluate(() => { window.__studio.player.pause(); document.activeElement?.blur(); });
  await page.evaluate(() => window.__studio.player.seek(0));
  await page.keyboard.press('ArrowRight');   // the studio's own seek (+5 s): the poster steps aside for the preview
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__studio.store.dispatch({ type: 'edit', edit: { kind: 'setClip', clip: 'c2', patch: { intensity: null } } }));
  await page.waitForTimeout(500);
  const h0 = await hash();
  L = await lane();
  await page.mouse.click(L.X(4.9), L.Y(0.02));
  await page.waitForTimeout(700);
  const h1 = await hash();
  p = await pivots();
  check('the paused picture changes after an edit there', h0 !== h1 && p?.length === 1, `${h0} → ${h1}, ${JSON.stringify(p)}`);

  // The curve moves with its clip.
  const before2 = await pivots();
  await page.evaluate(() => { const c = window.__studio.store.state.show.clips.find((x) => x.id === 'c2'); window.__studio.store.dispatch({ type: 'edit', edit: { kind: 'moveClip', clip: 'c2', start: c.start + 2, track: c.track } }); });
  const after2 = await pivots();
  check('moving the clip moves its curve', after2?.[0].t === before2[0].t + 2, JSON.stringify({ before2, after2 }));

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('the check ran to the end', false, String(e?.stack ?? e));
} finally {
  await st.close();
}
process.exit(finish('lanes-check'));
