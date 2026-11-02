// The region overlay on the studio's stage (plan T17), in a real browser: a 30 s test song (the session's fixture)
// whose show has casket in a window at the picture's top-right corner. Checks that the handles show only while a layer
// with a region is open, that CSS pixels map to fractions through the letterboxed picture (100 px at a 1280-wide
// picture → x + 0.078), Shift keeping a corner's aspect, Alt resizing from the centre, the knob snapping to 15°, the
// feather handle, a double-click's shape toggle, the arrows nudging (and not seeking), "Draw on the stage", one drag
// being one undo step, Esc hiding the overlay, and the canvas hash being the same with the overlay shown and hidden
// (it never draws into the canvas); then the mapping and the hash again at 900×600.
//
// Pictures (git-ignored): renders/look/T17/overlay.png (the stage with the handles over the corner window, the
// reader's hint in the bar), after-drag.png (the canvas after a drag: the window moved), rotated.png and
// rotated-canvas.png (a soft spot turned 30°, with and without its handles), narrow.png (900×600).
//
//   npm run overlay-check [-- --headed] [--keep]
//
// Local only: needs ffmpeg and system Chrome. Its own Vite server from port 5236 up.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checker, needFfmpeg, openStudio, ROOT } from '../lib/studio-session.mjs';

const argv = process.argv.slice(2);
const HEADED = argv.includes('--headed'), KEEP = argv.includes('--keep');
needFfmpeg('overlay-check');
const LOOK = path.join(ROOT, 'renders', 'look', 'T17');
mkdirSync(LOOK, { recursive: true });

const { check, finish } = checker();
const START = { mode: 'window', shape: 'rect', x: 0.8, y: 0.24, w: 0.34, h: 0.34, feather: 0.15 };
const st = await openStudio({ songs: 'fixture', headed: HEADED, keep: KEEP, port: 5236, viewport: { width: 1800, height: 1300 },
  shows: (packs) => {
    const D = Math.round(packs.demo.duration * 1000) / 1000;
    return { demo: { version: 3, id: 'demo', song: 'demo', title: 'Overlay check', clips: [
      { id: 'c1', start: 0, end: D, track: 0, widget: 'kandinsky' },
      { id: 'c2', start: 0, end: 15, track: 1, widget: 'casket', region: START },
      { id: 'c3', start: 15, end: D, track: 1, widget: 'squares' },
    ] } };
  } });
const { page } = st;

// The picture's rect in the page, computed here from the canvas element and object-fit: contain (not the overlay's code).
const pic = () => page.evaluate(() => {
  const c = document.getElementById('c'), r = c.getBoundingClientRect(), k = Math.min(r.width / c.width, r.height / c.height);
  return { x: r.left + (r.width - c.width * k) / 2, y: r.top + (r.height - c.height * k) / 2, w: c.width * k, h: c.height * k };
});
const regionOf = (k) => page.evaluate((i) => window.__studio.store.state.show.clips.find((c) => c.id === `c${i + 1}`).region ?? null, k);
const region = () => regionOf(1);
const shown = () => page.evaluate(() => {
  const svg = document.querySelector('.wa-rg'), bar = document.querySelector('.wa-rg-bar');
  return !!svg && svg.style.display !== 'none' && !!bar && !bar.hidden;
});
const select = (layer) => page.evaluate((k) => window.__studio.store.dispatch({ type: 'select', clip: k === null ? null : `c${k + 1}` }), layer);
const hash = () => page.evaluate(() => {
  const c = window.__studio.runtime.ctx.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0x811c9dc5; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16);
});
/** A paused preview at t, settled (the player's SETTLE_MS is 350 ms). */
const previewAt = async (t) => { await page.evaluate((x) => window.__studio.player.seek(x), t); await page.waitForTimeout(700); };
/** Where a point of the region (local u, v in −1..1 of its half-size, rotation included) is in the page. */
const at = (p, r, u, v, extra = { dx: 0, dy: 0 }) => {
  const cx = p.x + r.x * p.w, cy = p.y + r.y * p.h, th = ((r.rot ?? 0) * Math.PI) / 180;
  const lx = (u * r.w * p.w) / 2 + extra.dx, ly = (v * r.h * p.h) / 2 + extra.dy;
  return { x: cx + lx * Math.cos(th) - ly * Math.sin(th), y: cy + lx * Math.sin(th) + ly * Math.cos(th) };
};
const drag = async (from, dx, dy, mods = []) => {
  await page.mouse.move(from.x, from.y);
  for (const m of mods) await page.keyboard.down(m);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 12 });
  await page.mouse.up();
  for (const m of mods) await page.keyboard.up(m);
  await page.waitForTimeout(50);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const fmt = (r) => JSON.stringify(r);

try {
  // Play from the poster (it covers the stage until then), pause, and look at a paused picture.
  await page.click('[data-start]');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__studio.player.pause());
  await previewAt(6);
  // Only while a layer with a region is open.
  check('hidden while no layer is open', !(await shown()));
  await select(0);
  check('hidden while a layer without a region is open', !(await shown()));
  await select(1);
  check('shown while the layer with a region is open', await shown());
  const hint = await page.locator('.wa-rg-bar .wa-rg-hint').textContent();
  check('casket in a window says it cuts only its own picture', /cuts only its own picture/.test(hint ?? ''), hint ?? '');

  // A 1280-wide picture: the viewport widened or narrowed until the letterboxed picture is 1280 CSS px across.
  let p = await pic();
  for (let i = 0; i < 5 && Math.abs(p.w - 1280) > 0.25; i++) {
    const vp = page.viewportSize();
    await page.setViewportSize({ width: Math.round(vp.width + 1280 - p.w), height: vp.height });
    await page.waitForTimeout(150);
    p = await pic();
  }
  check('the picture is 1280 CSS px wide', near(p.w, 1280, 0.5), `${p.w.toFixed(2)} × ${p.h.toFixed(2)} at ${fmt(page.viewportSize())}`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(LOOK, 'overlay.png'), clip: { x: p.x - 4, y: p.y - 4, width: p.w + 8, height: p.h + 8 } });

  // Drag the body 100 px right; a second drag; each is one undo step.
  const r0 = await region();
  const before = await hash();
  await drag(at(p, r0, 0, 0), 100, 0);
  const r1 = await region();
  check('dragging the body 100 px right at a 1280-wide picture → x + 0.078 (±0.002)', near(r1.x - r0.x, 0.078, 0.002) && r1.y === r0.y,
    `x ${r0.x} → ${r1.x} (Δ ${(r1.x - r0.x).toFixed(4)}), y ${r0.y} → ${r1.y}`);
  await page.waitForTimeout(700);
  const afterDrag = await hash();
  check('the picture follows the drag (the window moved)', afterDrag !== before, `${before} → ${afterDrag}`);
  const png = await page.evaluate(() => window.__studio.runtime.ctx.canvas.toDataURL('image/png'));
  writeFileSync(path.join(LOOK, 'after-drag.png'), Buffer.from(png.split(',')[1], 'base64'));
  await drag(at(p, r1, 0, 0), -60, 40);
  const r2 = await region();
  check('a second drag moves it again', r2.x < r1.x && r2.y > r1.y, fmt(r2));
  await page.evaluate(() => window.__studio.store.dispatch({ type: 'undo' }));
  const u1 = await region();
  await page.evaluate(() => window.__studio.store.dispatch({ type: 'undo' }));
  const u2 = await region();
  check('one drag is one undo step (two drags, two undos, back to the start)', fmt(u1) === fmt(r1) && fmt(u2) === fmt(r0), `${fmt(u1)} | ${fmt(u2)}`);

  // Shift on a corner keeps w/h; Alt on an edge resizes from the centre.
  const a0 = await region();
  await drag(at(p, a0, -1, 1), -70, 25, ['Shift']);
  const a1 = await region();
  check('a corner handle with Shift keeps w/h', a1.w > a0.w && near(a1.w / a1.h, a0.w / a0.h, 0.005 * (a0.w / a0.h)),
    `w/h ${(a0.w / a0.h).toFixed(4)} → ${(a1.w / a1.h).toFixed(4)}, w ${a0.w} → ${a1.w}`);
  check('the opposite corner stays', near(a1.x + a1.w / 2, a0.x + a0.w / 2, 0.0015) && near(a1.y - a1.h / 2, a0.y - a0.h / 2, 0.0015), `${fmt(a0)} → ${fmt(a1)}`);
  await drag(at(p, a1, 1, 0), -40, 0, ['Alt']);
  const a2 = await region();
  check('an edge handle with Alt resizes from the centre', near(a2.x, a1.x, 0.0002) && near(a2.w - a1.w, -80 / 1280, 0.002) && a2.h === a1.h,
    `x ${a1.x} → ${a2.x}, w ${a1.w} → ${a2.w}`);

  // The knob rotates, snapping to 15° with Shift; the feather handle softens the edge.
  const k0 = await region();
  const knob = at(p, k0, 0, -1, { dx: 0, dy: -26 });
  await drag(knob, 90, 40, ['Shift']);
  const k1 = await region();
  check('the knob rotates, with Shift in steps of 15°', (k1.rot ?? 0) !== 0 && Math.abs(k1.rot) % 15 === 0, `rot ${k0.rot ?? 0} → ${k1.rot}`);
  await page.evaluate(() => window.__studio.store.dispatch({ type: 'undo' }));
  const f0 = await region(), fw = f0.w * p.w, fh = f0.h * p.h, band = (f0.feather * Math.min(fw, fh)) / 2;
  const fx = Math.min(fw / 2 - band, fw / 2 - 11);
  await drag(at(p, f0, 0, 0, { dx: fx, dy: 0 }), -20, 0);
  const f1 = await region();
  check('the feather handle softens the edge', near(f1.feather - f0.feather, 20 / (Math.min(fw, fh) / 2), 0.003), `feather ${f0.feather} → ${f1.feather}`);

  // Double-click toggles the shape; the arrows nudge (and the playhead stays).
  const d0 = await region(), c0 = at(p, d0, 0, 0);
  await page.mouse.dblclick(c0.x, c0.y);
  await page.waitForTimeout(50);
  const d1 = await region();
  check('a double-click toggles rectangle and ellipse', d0.shape === 'rect' && d1.shape === 'ellipse' && d1.x === d0.x && d1.w === d0.w, `${d0.shape} → ${d1.shape}`);
  const t0 = await page.evaluate(() => window.__studio.player.time);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  const n1 = await region(), t1 = await page.evaluate(() => window.__studio.player.time);
  check('the arrows nudge by 1 % (Shift: 10 %), and do not seek', near(n1.x - d1.x, 0.01, 1e-6) && near(n1.y - d1.y, 0.1, 1e-6) && t1 === t0,
    `x ${d1.x} → ${n1.x}, y ${d1.y} → ${n1.y}, time ${t0} → ${t1}`);

  // "Draw on the stage": a box dragged on the picture becomes the region.
  await page.click('.wa-rg-bar [data-act="draw"]');
  await drag({ x: p.x + 0.1 * p.w, y: p.y + 0.6 * p.h }, 0.3 * p.w, 0.3 * p.h);
  const w1 = await region();
  check('"Draw on the stage" places the region where the box was drawn', near(w1.x, 0.25, 0.002) && near(w1.y, 0.75, 0.002) && near(w1.w, 0.3, 0.002) && near(w1.h, 0.3, 0.002)
    && w1.mode === 'window' && w1.shape === n1.shape, fmt(w1));
  await page.evaluate(() => window.__studio.store.dispatch({ type: 'undo' }));
  check('the drawn box is one undo step', fmt(await region()) === fmt(n1));

  // A rotated, soft spot on kandinsky (layer 0): the right edge's handle pulled 40 px along the turned axis grows w
  // only, and the left edge stays; then a body drag, and the look (the outline over the picture's soft edge).
  await page.evaluate(() => window.__studio.store.dispatch({ type: 'edit', edit: { kind: 'setClip', clip: 'c1',
    patch: { region: { mode: 'spot', shape: 'ellipse', x: 0.42, y: 0.56, w: 0.42, h: 0.5, rot: 30, feather: 0.4 } } } }));
  await select(0);
  const o0 = await regionOf(0), c30 = Math.cos(Math.PI / 6), s30 = Math.sin(Math.PI / 6);
  await drag(at(p, o0, 1, 0), 40 * c30, 40 * s30);
  const o1 = await regionOf(0);
  check('rotated 30°, the right edge pulled 40 px along its axis grows w by 40 px and keeps h and the left edge',
    near(o1.w - o0.w, 40 / p.w, 0.002) && o1.h === o0.h && near(o1.x - o0.x, (20 * c30) / p.w, 0.002) && near(o1.y - o0.y, (20 * s30) / p.h, 0.002) && o1.rot === 30,
    `${fmt(o0)} → ${fmt(o1)}`);
  await drag(at(p, o1, 0, 0), 60, -30);
  await previewAt(6.5);
  await page.screenshot({ path: path.join(LOOK, 'rotated.png'), clip: { x: p.x - 4, y: p.y - 4, width: p.w + 8, height: p.h + 8 } });
  const rpng = await page.evaluate(() => window.__studio.runtime.ctx.canvas.toDataURL('image/png'));
  writeFileSync(path.join(LOOK, 'rotated-canvas.png'), Buffer.from(rpng.split(',')[1], 'base64'));
  await select(1);

  // The canvas is the same with the overlay shown and hidden (a paused picture holds still, so any change would be the
  // overlay's); Esc hides it; reopening the layer shows it again. (Two previews of one moment are not compared: the
  // live studio's previews differ run to run even without a region, so they would not test the overlay.)
  await previewAt(7);
  const hShown = await hash();
  await page.keyboard.press('Escape');
  const hidden = !(await shown());
  check('Esc hides the overlay', hidden);
  await page.waitForTimeout(400);
  const hHidden = await hash();
  check('the canvas hash with the overlay shown equals the hash with it hidden', hShown === hHidden, `${hShown} / ${hHidden}`);
  await select(null); await select(1);
  check('opening the layer again shows it again', await shown());
  await page.waitForTimeout(400);
  check('… and the canvas hash is still the same', (await hash()) === hShown);
  await page.evaluate(() => window.__studio.store.dispatch({ type: 'ui', patch: { hidden: true } }));
  check('hidden with the controls', !(await shown()));
  await page.evaluate(() => window.__studio.store.dispatch({ type: 'ui', patch: { hidden: false } }));

  // 900 × 600: the narrow layout letterboxes differently; the mapping and the hash hold.
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(250);
  const q = await pic(), s0 = await region();
  await drag(at(q, s0, 0, 0), 50, -20);
  const s1 = await region();
  check('at 900×600, a body drag maps through the picture', near(s1.x - s0.x, 50 / q.w, 0.002) && near(s1.y - s0.y, -20 / q.h, 0.002),
    `picture ${q.w.toFixed(1)} × ${q.h.toFixed(1)}; Δx ${(s1.x - s0.x).toFixed(4)} (want ${(50 / q.w).toFixed(4)}), Δy ${(s1.y - s0.y).toFixed(4)} (want ${(-20 / q.h).toFixed(4)})`);
  await page.screenshot({ path: path.join(LOOK, 'narrow.png') });
  await previewAt(8);
  const nShown = await hash();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const nHidden = await hash();
  check('at 900×600, the canvas hash with the overlay shown equals the hash with it hidden', !(await shown()) && nShown === nHidden, `${nShown} / ${nHidden}`);
  check('no page errors', st.errors.length === 0, st.errors.join(' | '));
} catch (e) {
  check('overlay-check ran to the end', false, String(e?.stack ?? e));
} finally {
  await st.close();
}
process.exit(finish('overlay-check'));
