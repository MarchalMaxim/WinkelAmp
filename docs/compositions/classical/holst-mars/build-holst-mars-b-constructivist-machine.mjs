// Builds shows/holst-mars-b-constructivist-machine.json: "Constructivist machine" (cycle B on Holst's Mars).
// Run from the worktree root: node_modules/.bin/tsx docs/compositions/classical/holst-mars/build-holst-mars-b-constructivist-machine.mjs
//
// Family: suprematism (ground), stella (the ostinato, as frames that invert the picture), mclaren (the march's cards, in a
// see-through window), cut (sugar-white slabs on the blows, chipped by every later blow). One visual language: flat,
// hard-edged planes, bands and slabs; nothing round or soft except stella's quiet frames.
//
// The threads (each one listens to a pick set made here from picks.json; values per note tell a story over the piece):
//   ground   <- suprematism: every attack of the pack (lowest, highest and loudest middle note: what the widget uses),
//               plus the audio fillers where the roll is empty. Per note: `temp` (the palette) and `push` (the tilt).
//               Classic red/ochre/cream; the machine runs cold steel through the slow middle (189.5-257 s), snaps back
//               to red on the first stroke of the return (257.41 s) and runs hot gold at the pile-up (358.9 s).
//   ostinato <- stella, full frame, last: the 5/4 ostinato wherever it sounds. Per note: `thick`, `reach`, `life`. It is
//               one story: hairlines tapping at the edge out of the silence (8.6 s), bands by the brass chords, armour
//               plates that invert half the picture in the return (257.41 s), hairlines again in the hush (386.9 s),
//               plates on the final blows.
//   blocks   <- a second stella, a small copy in the centre: the hammered chord blocks only (the Db chords of the
//               episode, the blocks of the return and the canon). Frames inside the frames' open centre.
//   march    <- mclaren in a see-through window tilted on the diagonal (an El Lissitzky band): the second subject's calls,
//               the high repeats, the tenor-tuba theme (crawling: `scroll` per note), the calls of the build. Cut away on
//               the first stroke of the return. `field` 0: its panels black, so the window shows only the cards.
//   canon    <- mclaren again, the band mirrored: the theme answering itself over the ostinato (304-344 s).
//   blows    <- cut: the hammered B chord and the brass chords into the first climax, the climax, the C6 blasts, the
//               strike at 131 s, the ff blow after the general pause, the dying throb (which crumbles that blow's
//               slabs), one blow per bar of the return, the pile-up, the aftermath's held blocks (rubble), the seven
//               final blows (`steps` 7: the first blow's slabs are gone exactly as the last chord lands) and the last
//               chord, held whole for six seconds until the orchestra's cut at 421.8 s, where everything cuts to black.
// The general pause (185.6-186.4 s): every thread steps to 0, black, and the ff blow lands as slabs on black.
// Found in the previews: cut at its default size stacks a chord's slabs into beige clouds (the pile-up's 7-note cluster,
// the last chord), so it hears only the lowest and highest note of each blow and stands at `size` 0.55 (0.85 on the
// final blows, on black). Stella over the planes is the find of this show: in the return its thick bands invert the red
// and black planes into grey and bone armour; on the final blows they cut blue lines through the sugar slabs.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'holst-mars-b-constructivist-machine', SONG = 'holst-mars';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const r3 = (v) => Math.round(v * 1000) / 1000, r2 = (v) => Math.round(v * 100) / 100;
const set = (id, from = -1, to = 1e9) => {
  const s = P[id]; if (!s) throw new Error(`no set ${id}`);
  return s.notes.filter((n) => n[0] >= from && n[0] < to).map((n) => [n[0], n[1], n[2], n[3]]);
};
/** Linear curve through [t, v] points (a jump: two points close together). */
const curve = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) {
    const [t0, a] = pts[i - 1], [t1, b] = pts[i];
    return a + (b - a) * (t - t0) / (t1 - t0);
  }
  return pts[pts.length - 1][1];
};
/** Group notes into attacks (a note joins when it starts < 40 ms after the attack's first). */
const attacks = (ns) => {
  const out = [];
  for (const n of [...ns].sort((a, b) => a[0] - b[0])) {
    const l = out[out.length - 1];
    if (l && n[0] - l[0][0] < 0.04) l.push(n); else out.push([n]);
  }
  return out;
};
/** Merge note lists: sorted, a note dropped when one of the same pitch starts within 40 ms of it. */
const merge = (...lists) => {
  const all = lists.flat().sort((a, b) => a[0] - b[0] || a[2] - b[2]), out = [];
  for (const n of all) {
    if (out.some((o) => o[2] === n[2] && Math.abs(o[0] - n[0]) < 0.04 && n[0] - o[0] < 0.5)) continue;
    out.push(n);
  }
  return out;
};
// The deliberate silences (ANALYSIS.md): no attack may start inside them.
const SILENT = [[185.6, 186.4], [397.9, 399.1], [403.4, 405.2], [407.8, 409.5], [413.5, 415.6], [421.8, 1e9]];
const silent = (t) => SILENT.some(([a, b]) => t >= a && t < b);
const clean = (ns) => ns.filter((n) => !silent(n[0])).map((n) => {
  const cut = SILENT.find(([a]) => a > n[0] && a < n[1]);
  return cut ? [n[0], r3(Math.max(n[0] + 0.05, cut[0])), n[2], n[3]] : n;
});

// ---------- ground: suprematism ----------
// The pack's notes ("all"), reduced per attack to what suprematism uses: the lowest (a black bar if below C3), the highest
// (a sliver if above E5), the loudest middle note (a block). Plus the audio fillers where the roll is empty.
const reduced = [];
for (const a of attacks(pack.notes.map((n) => [n[0], n[1], n[2], n[3]]))) {
  const lo = a.reduce((b, n) => (n[2] < b[2] ? n : b)), hi = a.reduce((b, n) => (n[2] > b[2] ? n : b));
  const mids = a.filter((n) => n[2] >= 48 && n[2] <= 76);
  const mid = mids.length ? mids.reduce((b, n) => (n[3] > b[3] ? n : b)) : null;
  for (const n of new Set([lo, hi, mid].filter(Boolean))) reduced.push(n);
}
const groundNotes = clean(merge(reduced,
  set('theme-creep'), set('theme-swell'), set('brass-swell-65'), set('climax-1'), set('ff-blow-186', 186.4, 186.5),
  set('dying-throb'), set('hole-middle'), set('tuba-theme'), set('climax-pileup'), set('aftermath-held'),
  set('final-blows'), set('last-chord'))).filter((n) => n[0] >= 9 && n[0] < 396.4);
// The palette: classic Malevich (0.5); cooler in the second subject; cold steel in the slow middle; red again on the
// first stroke of the return; hot at the pile-up, cooling through the aftermath.
const TEMP = curve([[0, 0.5], [131.5, 0.5], [131.6, 0.4], [186.3, 0.4], [186.4, 0.55], [189.4, 0.55], [189.5, 0.14],
  [257.3, 0.14], [257.4, 0.5], [343.6, 0.5], [358.8, 0.78], [358.9, 1], [367, 0.95], [392.6, 0.5]]);
// How hard loud music tilts and crowds the planes: calm in the opening, harder in the brass, slack in the middle (they
// drift apart), hard in the return, the hardest at the pile-up, slack again in the aftermath.
const PUSH = curve([[0, 0.5], [56, 0.6], [57.4, 0.9], [131.5, 0.9], [131.6, 0.5], [186.3, 0.5], [186.4, 1.1], [189.4, 1.1],
  [189.5, 0.35], [240, 0.5], [257.3, 0.6], [257.4, 1.15], [303.9, 0.8], [343.6, 1.0], [358.8, 1.2], [358.9, 1.5], [367, 1.0],
  [380, 0.3], [392.6, 0.6]]);
const ground = groundNotes.map((n) => {
  const v = {}, t = r2(TEMP(n[0])), p = r2(PUSH(n[0]));
  if (t !== 0.5) v.temp = t;
  if (p !== 0.6) v.push = p;
  return Object.keys(v).length ? withValues(n, v) : n;
});

// ---------- ostinato: stella, full frame ----------
const ostinatoNotes = clean(merge(
  set('ostinato-opening'), set('cello-ostinato-2'), set('pedal-bass'), set('ostinato-second'), set('high-repeats'),
  set('dying-throb'), set('middle-bass', 240.7, 256.6), set('ostinato-tutti'), set('ostinato-canon'),
  set('final-build').filter((n) => n[2] < 60), set('hush-rise'), set('pesante-g'), set('final-blows')));
const THICK = curve([[8, 1.2], [20.6, 1.5], [48.6, 2.5], [57.4, 3.5], [80.8, 5], [83.9, 5], [84, 3], [131.5, 3], [131.6, 2.5],
  [164.8, 2.5], [164.9, 1.6], [189.4, 1.6], [189.5, 2.5], [197.5, 1.2], [240.7, 3], [257.3, 7], [257.4, 13], [301, 14],
  [303.9, 5], [343.6, 6], [358.9, 10], [386.8, 1.3], [394.3, 2.5], [396.4, 9], [403.4, 14]]);
const REACH = curve([[8, 0.12], [20.6, 0.18], [48.6, 0.35], [57.4, 0.45], [80.8, 0.6], [131.5, 0.6], [131.6, 0.35], [164.9, 0.5],
  [189.4, 0.5], [189.5, 0.25], [240.7, 0.4], [257.3, 0.8], [257.4, 1], [301, 1], [303.9, 0.7], [343.6, 0.8], [358.9, 1],
  [386.8, 0.12], [394.3, 0.5], [396.4, 0.8], [403.4, 1]]);
const LIFE = curve([[8, 2.4], [20.6, 2], [48.6, 1.4], [84, 1.2], [131.5, 1.2], [131.6, 1.6], [164.9, 1.0], [189.4, 1.0],
  [189.5, 3], [240.7, 1.6], [257.4, 2.0], [303.9, 1.4], [386.8, 2.4], [396.4, 2.5], [403.4, 5]]);
// The machine approaches (critic's pass): the ostinato does not start at the edge of the screen but far away, a small
// tunnel of frames tapping in the centre (a window 0.22 wide) out of the silence; on the cellos' first G stroke (20.63 s)
// it leaps nearer (a window half the screen); on the theme's climb to forte (49.24 s) it arrives, full frame, and from
// then on it frames and inverts the whole picture. In the hush after the pile-up the machine recedes to the far box
// again (386.86 s), the run-up (393.24 s) brings it near in one breath, and the pesante blows (396.5 s) land full frame:
// the opening's long approach, retold in ten seconds. A window draws full size and is shrunk, so its frames are drawn
// thicker by 1/scale to read at the same weight on screen.
const PLACES = [[8.4, 20.6, 'far'], [20.6, 49.2, 'near'], [386.8, 393.2, 'far'], [393.2, 396.4, 'near']];
const SCALE = { far: 0.22, near: 0.5 };
const placeAt = (t) => (PLACES.find(([a, b]) => t >= a && t < b) ?? [0, 0, 'full'])[2];
const ostinato = ostinatoNotes.map((n) => {
  const t = n[0], p = placeAt(t);
  if (p === 'far') return withValues(n, { thick: 8, reach: 0.7, life: 2.4 });
  if (p === 'near') return withValues(n, { thick: r2(Math.min(14, THICK(t) / SCALE.near + 1)),
    reach: r2(t < 100 ? 0.4 + 0.25 * (t - 20.6) / 28.6 : 0.85), life: r2(LIFE(t)) });
  return withValues(n, { thick: r2(THICK(t)), reach: r2(REACH(t)), life: r2(LIFE(t)) });
});

// ---------- blocks: the inner stella ----------
const blocks = clean(set('plucked-blocks', 84, 342.5));

// ---------- march and canon: mclaren ----------
// Per note: how fast the film runs. The tuba theme crawls; the high repeats stream.
const SCROLL = curve([[131, 0.3], [164.8, 0.3], [164.9, 0.55], [185.6, 0.55], [197, 0.1], [215, 0.1], [215.3, 0.25],
  [240.7, 0.3], [257, 0.45]]);
const marchNotes = clean(merge(set('unison-calls'), set('high-repeats'), set('tuba-theme'), set('trumpet-calls'),
  attacks(set('middle-chords')).map((a) => a.reduce((b, n) => (n[2] > b[2] ? n : b)))))
  .filter((n) => n[0] >= 131.6 && n[0] < 257.3);
const march = marchNotes.map((n) => withValues(n, { scroll: r2(SCROLL(n[0])) }));
const canon = clean(set('canon-theme')).filter((n) => n[0] < 343.5);

// ---------- blows: cut ----------
const top2 = (a) => {
  const lo = a.reduce((b, n) => (n[2] < b[2] ? n : b)), hi = a.reduce((b, n) => (n[2] > b[2] ? n : b));
  return lo === hi ? [lo] : [lo, hi];
};
// The return: one blow per bar (1.78 s), the loudest attack of the ostinato and the chord blocks in it, the C minor wall
// at 293 s always among them.
const retAtt = attacks([...set('ostinato-tutti'), ...set('recap-blocks')]);
const retBlows = [];
for (let b = 257.35; b < 301; b += 1.78) {
  const inBar = retAtt.filter((a) => a[0][0] >= b && a[0][0] < b + 1.78);
  if (!inBar.length) continue;
  retBlows.push(inBar.reduce((x, y) => (Math.max(...y.map((n) => n[3])) > Math.max(...x.map((n) => n[3])) ? y : x)));
}
const wall = attacks(set('recap-blocks', 292.6, 293.6))[0];
if (wall && !retBlows.includes(wall)) retBlows.push(wall);
const blowNotes = clean(merge(
  attacks(set('brass-chords-1', 61.7, 80.8)).flatMap(top2),
  attacks(set('climax-1')).flatMap(top2), set('high-blasts'), attacks(set('strike-131')).flatMap(top2),
  set('ff-blow-186', 186.4, 186.5), attacks(set('ff-blow-186', 188.4, 188.46)).flatMap(top2), set('dying-throb'),
  retBlows.flatMap(top2), attacks(set('climax-pileup')).flatMap(top2), attacks(set('aftermath-held')).flatMap(top2),
  attacks(set('final-blows')).flatMap(top2),
  // the last chord: G2 and G4 as at every blow, and its new dissonance, Ab3, a slab of its own
  set('last-chord').filter((n) => n[2] === 56)));
// The end, on black: bigger slabs (from the first pesante blow, a real attack); a slab survives the next 7 blows, and the
// last chord's stand for the full six seconds.
const blows = blowNotes.map((n) => (n[0] >= 396.4 ? withValues(n, { steps: 7, goneBy: 8, size: 0.85 }) : n));

// ---------- clips ----------
const GP = (before = 1) => [{ t: 185.55, v: before, shape: 'hold' }, { t: 185.6, v: 0, shape: 'hold' }, { t: 186.4, v: 1 }];
// The band: a strip of film laid across the canvas (narrowed from 0.62 in the critic's pass, so it reads as one hard
// El Lissitzky diagonal over the planes and its harmony colours stay a stripe, not a wash).
const BAND = (rot) => ({ mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.42, h: 1.9, rot, feather: 0.04, fit: 'stretch' });
const clips = [
  // Track 0, the ground: fades up from the theme's first held tone (9.15 s) to full by the forte; out over the run-up's
  // breath (394.3-396.4 s), so the pesante blows land on black.
  { id: 'ground', start: 9.1, end: 396.5, track: 0, fade: 0, widget: 'suprematism', listen: 'picks:ground',
    intensity: [{ t: 9.1, v: 0, shape: 'ease' }, { t: 13, v: 0.4 }, { t: 30, v: 0.65 }, { t: 48.6, v: 0.8 }, { t: 57.4, v: 1 },
      ...GP(), { t: 189.5, v: 1 }, { t: 197.2, v: 0.75 }, { t: 212.8, v: 0.8 }, { t: 240, v: 1 },
      // the hush (pp, from 380 s): the planes dim to half while the machine recedes to the far box; the run-up's first
      // note (393.24 s) lights them full again
      { t: 380, v: 1, shape: 'ease' }, { t: 387, v: 0.45, shape: 'hold' }, { t: 393.2, v: 1 },
      { t: 394.3, v: 1, shape: 'ease' }, { t: 396.4, v: 0 }] },
  // Track 1: the march, a tilted band of film over the planes.
  { id: 'march', start: 131.5, end: 257.41, track: 1, fade: 0, widget: 'mclaren', listen: 'picks:march',
    knobs: { field: { base: 0, drive: '' } }, region: BAND(-16),
    // No cards from the general pause to the tuba's first note (197.26 s): the band stays away (its empty panels left a
    // coloured veil over the ff blow) and comes back with that note.
    intensity: [{ t: 131.5, v: 0, shape: 'ease' }, { t: 134, v: 0.9 }, { t: 164.9, v: 1 }, { t: 185.55, v: 1, shape: 'hold' },
      { t: 185.6, v: 0, shape: 'hold' }, { t: 197.2, v: 1, shape: 'hold' }, { t: 256, v: 1 }] },
  // Track 1 again: the canon, the band mirrored.
  { id: 'canon', start: 303.9, end: 345, track: 1, fade: 0, widget: 'mclaren', listen: 'picks:canon',
    knobs: { field: { base: 0, drive: '' }, scroll: 0.35 }, region: BAND(16),
    intensity: [{ t: 303.9, v: 0, shape: 'ease' }, { t: 306, v: 0.9 }, { t: 341, v: 0.9, shape: 'ease' }, { t: 345, v: 0 }] },
  // Track 2: the blows, sugar-white slabs.
  { id: 'blows', start: 61.6, end: 421.8, track: 2, fade: 0, widget: 'cut', listen: 'picks:blows',
    // goneBy 3 (was 6): crumbs no longer hang still as beige clumps for six seconds after the strike at 131 s or the B
    // chord at 62 s; the final blows keep 8 per note.
    knobs: { wet: 0, goneBy: 3, size: 0.55 } },
  // Track 3: the hammered chord blocks, frames inside the frames' open centre.
  { id: 'blocks', start: 83.9, end: 342.5, track: 3, fade: 0, widget: 'stella', listen: 'picks:blocks',
    knobs: { thick: 14, reach: 1, life: 1.1 },
    region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.34, h: 0.34, feather: 0, fit: 'contain' } },
  // Track 4, last: the ostinato's frames over everything.
  // Track 4, last: the ostinato's frames over everything, the machine approaching: far, near, full frame; then far,
  // near and full again in the hush, the run-up and the pesante (see PLACES).
  ...PLACES.map(([start, end, p], i) => ({ id: `ostinato-${p}-${i + 1}`, start, end, track: 4, fade: 0, widget: 'stella',
    listen: 'picks:ostinato',
    region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: SCALE[p], h: SCALE[p], feather: 0, fit: 'contain' } })),
  { id: 'ostinato', start: 49.2, end: 386.8, track: 4, fade: 0, widget: 'stella', listen: 'picks:ostinato',
    intensity: [{ t: 49.2, v: 1 }, ...GP()] },
  { id: 'ostinato-pesante', start: 396.4, end: 421.8, track: 4, fade: 0, widget: 'stella', listen: 'picks:ostinato' },
];
const picks = { ground: { notes: ground }, ostinato: { notes: ostinato }, blocks: { notes: blocks }, march: { notes: march },
  canon: { notes: canon }, blows: { notes: blows } };
for (const [k, s] of Object.entries(picks)) console.log(`${k}: ${s.notes.length} notes, ${attacks(s.notes).length} attacks`);

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Holst: Mars · Constructivist machine (suprematism ground, stella ostinato frames, mclaren march band, cut blows)',
  composer: { by: 'claude', at: new Date().toISOString() }, clips, picks,
};
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets: loadCatalogue().widgets,
  tracks: Object.keys(pack.tracks ?? {}) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
console.log(`wrote shows/${ID}.json: ${clips.length} clips, ${errors.length} errors, ${warnings.length} warnings`);
