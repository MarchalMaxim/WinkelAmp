// Looks at the region masks (plan Task 5): opens a blank page in system Chrome, evaluates lab/layers/persist.js and
// lab/layers/region.js as the lab does (classic scripts), and draws every mask into renders/look/T5/masks.png:
// ellipse and rect, feather 0, 0.25 and 1, rot 0 and 30, the 'redraw' and 'strokes' classes. Each mask is drawn white
// on black (luminance = the mask's alpha), rotated about its centre as the compositor will, with the nominal box in red.
// A last strip shows feather-1 masks at ×4 gain, to make banding in the faint end visible.
//
// It also reads each unrotated mask back along its centre row and compares it to featherAlpha (through vis for
// 'redraw'): it fails when any pixel is off by more than TOL of 255.
//
//   node scripts/checks/region-masks.mjs [--out <png>]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const oi = argv.indexOf('--out');
const OUT = path.resolve(ROOT, oi < 0 ? 'renders/look/T5/masks.png' : argv[oi + 1]);
const TOL = 3;

const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"></body>');
  for (const f of ['persist.js', 'region.js']) await page.addScriptTag({ content: readFileSync(path.join(ROOT, 'lab', 'layers', f), 'utf8') });

  const res = await page.evaluate((TOL) => {
    const WA = globalThis.WA_LAYERS;
    const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const CW = 400, CH = 225, LABEL = 20;                   // one cell: a 16:9 "canvas" plus a label strip
    const shapes = ['ellipse', 'rect'], classes = ['redraw', 'strokes'], feathers = [0, 0.25, 1], rots = [0, 30];
    const cols = feathers.length * rots.length, rows = shapes.length * classes.length;
    const GAIN_H = 160;
    const out = make(cols * CW, rows * (CH + LABEL) + LABEL + GAIN_H);
    const o = out.getContext('2d');
    o.fillStyle = '#000'; o.fillRect(0, 0, out.width, out.height);
    o.font = '13px sans-serif'; o.textBaseline = 'middle';
    const errors = [];

    const stamp = (r, x0, y0, cw, ch, cls, gain) => {
      const box = WA.regionBox(r, cw, ch), m = WA.buildMask(r, cw, ch, cls, make);
      o.save();
      o.beginPath(); o.rect(x0, y0, cw, ch); o.clip();
      o.translate(x0 + box.cx, y0 + box.cy); o.rotate(box.rot);
      o.globalCompositeOperation = 'lighter';
      for (let k = 0; k < gain; k++) o.drawImage(m, -box.w / 2, -box.h / 2, box.w, box.h);
      o.globalCompositeOperation = 'source-over';
      o.strokeStyle = 'rgba(255,40,40,0.9)'; o.lineWidth = 1;
      o.strokeRect(-box.w / 2, -box.h / 2, box.w, box.h);
      o.beginPath(); o.moveTo(-6, 0); o.lineTo(6, 0); o.moveTo(0, -6); o.lineTo(0, 6); o.stroke();
      o.restore();
      return m;
    };

    // The centre row of an unrotated mask against the maths.
    const check = (r, m, cls, name) => {
      const W = m.width, H = m.height, y = Math.floor(H / 2);
      const px = m.getContext('2d').getImageData(0, y, W, 1).data;
      const f = r.feather ?? 0.25, band = f * Math.min(W, H) / 2;
      const prof = (a) => (cls === 'strokes' ? a : WA.vis(a, 'redraw'));
      let worst = 0, at = -1;
      for (let x = 0; x < W; x++) {
        const xc = x + 0.5;
        if (f === 0 && (xc < 1 || xc > W - 1)) continue;   // the hard edge's antialiased pixel
        let want;
        if (r.shape === 'ellipse') want = prof(WA.featherAlpha(Math.abs(xc - W / 2) / (W / 2), f));
        else { const e = Math.min(xc, W - xc); want = f === 0 ? 1 : prof(WA.featherAlpha(1 - f * Math.min(1, e / band), f)); }
        const err = Math.abs(px[x * 4 + 3] - want * 255);
        if (err > worst) { worst = err; at = x; }
      }
      errors.push({ name, W, H, worst: Math.round(worst * 10) / 10, at });
    };

    shapes.forEach((shape, si) => classes.forEach((cls, ki) => {
      const row = si * classes.length + ki, y0 = row * (CH + LABEL);
      feathers.forEach((feather, fi) => rots.forEach((rot, ri) => {
        const col = fi * rots.length + ri, x0 = col * CW;
        const r = { mode: 'spot', shape, x: 0.5, y: 0.5, w: 0.62, h: 0.5, rot, feather };
        o.fillStyle = '#ccc'; o.fillText(`${shape} ${cls} feather ${feather} rot ${rot}`, x0 + 8, y0 + LABEL / 2);
        const m = stamp(r, x0, y0 + LABEL, CW, CH, cls, 1);
        if (rot === 0) check(r, m, cls, `${shape} ${cls} f${feather}`);
        o.strokeStyle = '#333'; o.strokeRect(x0 + 0.5, y0 + 0.5, CW - 1, CH + LABEL - 1);
      }));
    }));

    // Banding: feather 1, both shapes and classes, at x4 gain.
    const y0 = rows * (CH + LABEL);
    o.fillStyle = '#ccc'; o.fillText('feather 1 at x4 gain: ellipse redraw | ellipse strokes | rect redraw | rect strokes', 8, y0 + LABEL / 2);
    const gw = out.width / 4;
    [['ellipse', 'redraw'], ['ellipse', 'strokes'], ['rect', 'redraw'], ['rect', 'strokes']].forEach(([shape, cls], i) => {
      stamp({ mode: 'spot', shape, x: 0.5, y: 0.5, w: 0.9, h: 0.9, feather: 1 }, i * gw, y0 + LABEL, gw, GAIN_H, cls, 4);
    });
    return { png: out.toDataURL('image/png'), errors };
  }, TOL);

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.from(res.png.split(',')[1], 'base64'));
  let bad = 0;
  for (const e of res.errors) {
    const ok = e.worst <= TOL;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${e.name.padEnd(24)} ${e.W}x${e.H}  worst ${e.worst}/255 at x=${e.at}`);
  }
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
  if (bad) { console.error(`${bad} mask(s) off by more than ${TOL}/255`); process.exitCode = 1; }
} finally {
  await browser.close();
}
