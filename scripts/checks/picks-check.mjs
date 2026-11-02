// Picks in a real browser (note picker plan T1 step 4): render pages at scale 1 and 2, with the real widgets, the real
// songs and the real runtime. A widget on a set of picks is given exactly groupChords(picks), played through and after a
// seek; no widget errors; two runs draw the same picture; track notes that are not in pack.notes fire at their own times;
// a widget's pass "after the others" reads the picks too: the same picks draw the same picture on two songs.
//
//   npm run picks-check [-- --headed] [--keep] [--shots <dir>]
//
// --shots writes stills there: Pointillism on Winter Wind at 20, 25 and 30 s, on every note against on 12 picks, just
// after the loudest and the softest pick, and timeslice in a rest between picks. Local only: needs system Chrome, songs/chopin-winter-wind and songs/vivaldi-winter.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { checker, openStudio } from '../lib/studio-session.mjs';

const argv = process.argv.slice(2);
const HEADED = argv.includes('--headed'), KEEP = argv.includes('--keep');
const SHOTS = argv.includes('--shots') ? path.resolve(argv[argv.indexOf('--shots') + 1]) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const { check, finish } = checker();

const WIND = 'chopin-winter-wind', WINTER = 'vivaldi-winter', KEY = 'pointillism@picks:p1';
const FROM = 18, EVERY = 1.2, N = 12;
/** The same picks for two songs, with a rest from 19.5 to 20.5 s. */
const SHARED = [[18.1, 18.3, 60, 40], [19.3, 19.5, 64, 90], [20.5, 20.7, 67, 60], [21.7, 21.9, 72, 110], [22.9, 23.1, 60, 30], [24.1, 24.3, 64, 80], [25.3, 25.5, 67, 50], [26.5, 26.7, 72, 100]];
const QUEUERS = ['timeslice', 'fold', 'pixelsort', 'stella'];
const REGIONS = {
  spot: { mode: 'spot', shape: 'ellipse', x: 0.45, y: 0.5, w: 0.55, h: 0.6, feather: 0.3 },
  window: { mode: 'window', shape: 'rect', x: 0.55, y: 0.45, w: 0.5, h: 0.55, rot: 20, feather: 0.2, blend: 'over', fit: 'cover' },
};

/** Twelve notes by rule, as a hand would choose them: the loudest in each window of 1.2 s from 18 s, every third the
    softest, so the set has both loud and soft ones. */
const handChosen = (notes) => {
  const out = [];
  for (let a = FROM; out.length < N; a += EVERY) {
    const here = notes.filter((n) => n[0] >= a && n[0] < a + EVERY);
    if (!here.length) continue;   // the song's rests
    const v = out.length % 3 === 2 ? Math.min(...here.map((n) => n[3])) : Math.max(...here.map((n) => n[3]));
    out.push(here.find((n) => n[3] === v));
  }
  return out;
};
/** Track notes that are not in pack.notes: no note of it within 50 ms at their pitch. Spread through the song's middle. */
const notInPack = (pack) => {
  const all = Object.values(pack.tracks).flatMap((t) => t.notes).sort((a, b) => a[0] - b[0]);
  const free = all.filter((n) => n[0] > 20 && !pack.notes.some((p) => p[2] === n[2] && Math.abs(p[0] - n[0]) < 0.05));
  const step = Math.floor(free.length / N);
  return { free: free.length, notes: Array.from({ length: N }, (_, i) => free[i * step]) };
};

let wind, winter;
const st = await openStudio({ songs: [WIND, WINTER], port: 5401, headed: HEADED, keep: KEEP, viewport: { width: 1280, height: 720 }, shows: (packs) => {
  const D = Math.round(packs[WIND].duration * 1000) / 1000, W = Math.round(packs[WINTER].duration * 1000) / 1000;
  wind = handChosen(packs[WIND].notes);
  winter = notInPack(packs[WINTER]);
  const on = { widget: 'pointillism', listen: 'picks:p1' }, squares = { widget: 'squares' };
  const windShow = (id, layers) => ({ version: 2, id, song: WIND, sections: [{ start: 0, end: D, layers }], picks: { p1: { notes: wind } } });
  /** A layer on SHARED, on both songs: `<name>-wind` and `<name>-winter`. */
  const onBoth = (name, layer) => Object.fromEntries([[WIND, D, 'wind'], [WINTER, W, 'winter']].map(([song, end, tag]) => [`${name}-${tag}`,
    { version: 2, id: `${name}-${tag}`, song, sections: [{ start: 0, end: 100, layers: [{ ...layer, listen: 'picks:p1' }] }, { start: 100, end, layers: [] }], picks: { p1: { notes: SHARED } } }]));
  return {
    ...Object.assign({}, ...QUEUERS.map((widget) => onBoth(widget, { widget }))),
    ...Object.assign({}, ...Object.entries(REGIONS).map(([mode, region]) => onBoth(`timeslice-${mode}`, { widget: 'timeslice', region }))),
    // The same set across a boundary, under a plain widget.
    [WIND]: { version: 2, id: WIND, song: WIND, sections: [
      { start: 0, end: 22, layers: [squares, on] }, { start: 22, end: D, layers: [squares, on] },
    ], picks: { p1: { notes: wind } } },
    'wind-picks': windShow('wind-picks', [on]),
    'wind-every': { version: 1, id: 'wind-every', song: WIND, sections: [{ start: 0, end: D, layers: [{ widget: 'pointillism' }] }] },
    [WINTER]: { version: 2, id: WINTER, song: WINTER, sections: [{ start: 0, end: W, layers: [on] }], picks: { p1: { notes: winter.notes } } },
  };
} });
const { page, browser, base, errors, vite, missing } = st;

/** A render page of a show: never posts to the ratings saver; a page error is counted. */
const open = async (show, scale = 1) => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await p.route(/localhost:5174/, (r) => r.abort());
  p.on('pageerror', (e) => errors.push(`${show} × ${scale}: ${e}`));
  await p.goto(`${base}/render.html?show=${show}&scale=${scale}`);
  await p.waitForFunction(() => window.renderReady || window.renderFailed, null, { timeout: 60_000 });
  return p;
};
/** Plays [from, to] with a clean log: the times the set's instance was given. */
const delivered = (p, from, to, key = KEY) => p.evaluate(([from, to, key]) => {
  const { rt } = window.renderRuntime;
  window.renderSeek(from, 1);
  rt.deliveredLog = [];
  window.renderTo(to);
  const out = rt.deliveredLog.filter((x) => x[0] === key).map((x) => x[1]);
  rt.deliveredLog = null;
  return out;
}, [from, to, key]);
const widgetErrors = (p) => p.evaluate(() => ({ ...window.renderErrors }));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

try {
  if (missing.length) throw new Error(`no songs/${missing.join(', songs/')} here`);
  const { groupChords } = await vite.ssrLoadModule('/src/widgets/chords.ts');
  const attacks = groupChords(wind), times = attacks.map((c) => c.t), first = times[0], last = times[times.length - 1];
  console.log(`${wind.length} picks make ${attacks.length} attacks, ${first} to ${last} s, velocities ${attacks.map((c) => c.vel).join(' ')}`);

  check('the studio opens the show as it is, its picks in it', await page.evaluate(() => {
    const s = window.__studio.store.state;
    return s.origin === 'file' && s.show.picks.p1.notes.length === 12;
  }));

  for (const scale of [1, 2]) {
    const p = await open(WIND, scale);
    const played = await delivered(p, first - 3, last + 2);
    check(`× ${scale}: played through, the delivered times equal groupChords(picks), over a boundary`, same(played, times), `${played.length} of ${times.length}`);
    const mid = times[Math.floor(times.length / 2)];
    const after = await delivered(p, mid, last + 1);
    check(`× ${scale}: after a seek onto a pick, only the attacks after it`, same(after, times.filter((t) => t > mid)), `${after.length} from ${mid} s`);
    const back = await delivered(p, mid - 0.5, last + 1);
    check(`× ${scale}: a seek back before it hears it again`, same(back, times.filter((t) => t > mid - 0.5)), `${back.length}`);
    const none = await delivered(p, last + 0.01, last + 3);
    check(`× ${scale}: none after the last`, none.length === 0);
    const e = await widgetErrors(p);
    check(`× ${scale}: no widget errors`, Object.keys(e).length === 0, JSON.stringify(e));
    await p.close();
  }

  const hash = async (t, from) => {
    const p = await open(WIND);
    const h = await p.evaluate(([t, from]) => { window.renderSeek(from, 1); window.renderTo(t); return window.renderFrameHash(); }, [t, from]);
    await p.close();
    return h;
  };
  const [a, b] = [await hash(5, 0), await hash(5, 0)];
  check('two runs at × 1 draw the same picture at 5 s', a === b, `${a}`);
  const [c, d] = [await hash(first + 5, first - 1), await hash(first + 5, first - 1)];
  check('two runs at × 1 draw the same picture 5 s into the picks', c === d && c !== a, `${c}`);

  const wp = await open(WINTER);
  const wt = groupChords(winter.notes).map((x) => x.t);
  const wd = await delivered(wp, wt[0] - 1, wt[wt.length - 1] + 1);
  check(`Winter: a set of track notes that are not in pack.notes fire at their own times (of ${winter.free} such notes)`, same(wd, wt) && wt.length > 0, `${wd.length} of ${wt.length}`);
  check('Winter: no widget errors', Object.keys(await widgetErrors(wp)).length === 0);
  await wp.close();

  /** The picture a show draws at t, played from 17 s, and its errors. */
  const drawn = async (show, t) => {
    const p = await open(show);
    const h = await p.evaluate((t) => { window.renderSeek(17, 1); window.renderTo(t); return window.renderFrameHash(); }, t);
    const e = await widgetErrors(p);
    await p.close();
    return { h, e };
  };
  for (const name of [...QUEUERS, ...Object.keys(REGIONS).map((mode) => `timeslice-${mode}`)]) {
    const [a, again, b] = [await drawn(`${name}-wind`, 28), await drawn(`${name}-wind`, 28), await drawn(`${name}-winter`, 28)];
    check(`${name}: the same picks draw the same picture on two songs`, a.h === b.h && a.h === again.h, `${a.h} ${again.h} ${b.h}`);
    check(`${name}: no widget errors`, !Object.keys({ ...a.e, ...b.e }).length, JSON.stringify({ ...a.e, ...b.e }));
  }
  const rest = [await drawn('timeslice-wind', 20.4), await drawn('timeslice-winter', 20.4)];
  check('timeslice in a rest between picks: the same on two songs', rest[0].h === rest[1].h, `${rest[0].h} ${rest[1].h}`);

  if (SHOTS) {
    const still = async (show, t, name) => {
      const p = await open(show);
      await p.evaluate(([from, t]) => { window.renderSeek(from, 1); window.renderTo(t); }, [Math.max(0, t - 8), t]);
      await p.screenshot({ path: path.join(SHOTS, `${name}.png`) });
      await p.close();
    };
    for (const t of [20, 25, 30]) { await still('wind-every', t, `every-${t}`); await still('wind-picks', t, `picks-${t}`); }
    const by = [...attacks].sort((x, y) => y.vel - x.vel), loud = by[0], soft = by[by.length - 1];
    console.log(`loudest pick ${loud.t} s (velocity ${loud.vel}), softest ${soft.t} s (velocity ${soft.vel})`);
    await still('wind-picks', loud.t + 0.1, 'picks-loudest');
    await still('wind-picks', soft.t + 0.1, 'picks-softest');
    await still(WIND, 25, 'with-squares-25');
    const atRest = await open('timeslice-wind');
    await atRest.evaluate(() => { window.renderSeek(17, 1); window.renderTo(20.4); });
    await atRest.screenshot({ path: path.join(SHOTS, 'timeslice-rest-20.4.png') });
    await atRest.close();
  }
  check('no page errors', errors.length === 0, errors.join('; '));
} catch (e) {
  check('picks-check ran to the end', false, String(e));
} finally {
  await st.close();
}
process.exit(finish('picks-check'));
