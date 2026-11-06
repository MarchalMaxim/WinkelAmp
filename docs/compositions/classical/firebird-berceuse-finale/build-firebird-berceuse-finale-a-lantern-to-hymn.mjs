// Builds shows/firebird-berceuse-finale-a-lantern-to-hymn.json from picks.json (this folder) and the plan below.
// Run: node_modules/.bin/tsx docs/compositions/classical/firebird-berceuse-finale/build-firebird-berceuse-finale-a-lantern-to-hymn.mjs
//
// THE PLAN ("Lantern to hymn": current, comfort, ivory, strings, fireworks-snap)
// One story, told by two knobs that run the length of the show and a light that comes back three times:
//  - Comfort is the room. Its warmth (per note, on its own set) goes from grey-rose dusk through the Berceuse, flushes once at
//    the swell (A major, the lullaby's only bright peak), sinks to its coolest in the spell, and climbs note by note through
//    the hymn's statements to amber at the Maestoso: the sunrise. Its breath (per note) slows as the lullaby falls asleep
//    (10 s -> 19 s, one breath per bar of the frozen tremolo) and quickens with the triumph (6 s).
//  - The lantern (the current, one white-gold thread) enters on the bassoon's first note and follows the lullaby's line
//    wherever it goes (bassoon, high strings, the violins' lament, the swell, the harp bells, the reprise, the wind choir,
//    the last harp notes, the frozen chords). It never dies: the thread drifts on in the spell, where almost nothing is played.
//    At the swell it blossoms into a braid and folds back (intensityMoves: present). It hands over on the horn's first note.
//  - The rocking (harp and violas, from the audio) is a calm ice-blue band of woven threads (strings, heat 0.05): the cradle.
//    In the spell it holds the frozen tremolo's chords, still because the playing is so soft (sway follows loudness).
//  - The hymn is Ivory, huddled, one short row per phrase, each row ending as the next begins. Every statement stands
//    higher and larger on the screen than the last (horn low on the horizon, then strings, third, crescendo, tutti full):
//    the hymn rises like the sun. The strike grows with it: 0 for the horn (keys that swell up), 1 for the tutti.
//  - From the strings' statement, woven threads braid with the keys (violins, violas, cellos), warming per note from ink
//    blue to ember and gold, and weaving more as the crescendo builds (intensityMoves: present).
//  - The hush (319.1 s, subito pp): everything collapses within half a second and the lantern comes back alone on black,
//    on the violins' climb. On the first 7/4 blow (324.13) that same lone thread becomes the full braid (presence 0 -> 1 in
//    one step): the lullaby's light reborn as the Firebird's river, stamped by every hymn chord.
//  - Fireworks-snap only on the bar starts of the 7/4 and the Maestoso: small bursts, and big gold ones on the four real
//    ff blows (324.13, 348.56, 358.55, 380.74). Strings (ember, gold) carry the stamping bass and the Maestoso strokes.
//  - The Maestoso: Ivory full-frame, one row per bar on the hymn's top line, strike 1, through the fire ("Keys through fire").
//  - The coda's slow brass chords: Comfort amber, each chord a deep sigh, and the held chords as glowing threads. Spare.
//  - 401.15 s: a hard cut to black for the one second of silence. 402.4: the final chord enters pp, and the lantern is
//    reborn a last time on it, a new thread appearing at each audible re-attack of the swelling chord, while four keys of
//    B major stand up; the last stroke (412.62) tears the water, presses the keys back into the ground and throws the
//    biggest burst of the show. Out before the applause.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'firebird-berceuse-finale-a-lantern-to-hymn', SONG = 'firebird-berceuse-finale';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const S = (id) => { if (!P[id]) throw new Error(`no set ${id}`); return P[id].notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const win = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const r3 = (x) => Math.round(x * 1000) / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Merge note lists, sorted, a note with the same pitch starting within 30 ms of one already kept dropped. */
function merge(...lists) {
  const all = lists.flat().map((n) => [...n]).sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const out = [];
  for (const n of all) {
    let dup = false;
    for (let k = out.length - 1; k >= 0 && n[0] - out[k][0] < 0.03; k--) if (out[k][2] === n[2]) { dup = true; break; }
    if (!dup) out.push(n);
  }
  return out;
}
/** The top (or bottom) note of each 40 ms cluster. */
function tops(ns, low = false) {
  const out = []; let cur = null;
  for (const n of ns) {
    if (cur && n[0] - cur[0][0] < 0.04) cur.push(n); else { cur = [n]; out.push(cur); }
  }
  return out.map((c) => c.reduce((a, b) => ((low ? b[2] < a[2] : b[2] > a[2]) ? b : a)));
}
/** Piecewise-linear curve through [t, value] points, flat outside. */
const curve = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, a] = pts[i - 1], [t1, b] = pts[i]; return a + (b - a) * (t - t0) / (t1 - t0); }
  return pts[pts.length - 1][1];
};
const vals = (ns, fn) => ns.map((n, i) => withValues([n[0], n[1], n[2], n[3]], fn(n, i, ns)));

const sets = {};
const clips = [];
const LAYER = { comfort: 0, strings: 1, current: 2, 'fireworks-snap': 3, ivory: 4 };
const clip = (c) => { clips.push({ id: '', track: 0, ...c, start: r3(c.start), end: r3(c.end) }); };
const piv = (pts) => pts.map(([t, v, shape]) => ({ t: r3(t), v: Math.round(v * 1000) / 1000, ...(shape ? { shape } : {}) }));

// ======================= the room: comfort =======================
// Warmth: dusk, one flush at the swell, coolest in the spell, then the sunrise through the hymn.
const WARMTH = curve([[0, 0.24], [80.5, 0.24], [86, 0.5], [100, 0.44], [110, 0.24], [118, 0.22], [172, 0.16], [194, 0.06], [226.6, 0.06],
  [252.4, 0.2], [267, 0.32], [283, 0.46], [303.5, 0.74], [319, 0.8], [324, 0.88], [348.5, 0.95], [380.7, 1], [420, 1]]);
// Breath: slows as the lullaby falls asleep, quickens with the triumph.
const BREATH = curve([[0, 10], [154, 10.5], [172, 13], [194, 19], [226.6, 18], [252.4, 13], [283, 10], [303.5, 7.5], [324, 6], [380.7, 8], [420, 8]]);
const STAY = curve([[0, 5], [172, 6], [194, 14], [226.6, 12], [252.4, 6], [303.5, 5], [420, 5]]);
const AUDIO_HOLES = merge(S('harp-rocking'), S('harp-bridge'), S('last-rocking'), S('horn-hymn'), S('seven-four-strokes'), S('maestoso-strokes'), S('coda-chords'), S('frozen-tremolo'));
const GROUND_END = 401.15;
sets.ground = vals(win(merge(pack.notes.map((n) => [n[0], n[1], n[2], n[3]]), AUDIO_HOLES), 6.5, GROUND_END - 0.05), (n) => ({
  warmth: WARMTH(n[0]), breath: BREATH(n[0]), stay: STAY(n[0]),
  intensity: n[0] >= 194 && n[0] < 226.6 ? 2 : n[0] >= 380.7 ? 1.15 : 1,       // the spell's few soft chord changes still press
}));
clip({ start: 6.3, end: GROUND_END, fade: 0.1, widget: 'comfort', listen: 'picks:ground', knobs: { warmth: 0.24 },
  // The fire scenes (7/4, Maestoso) sit on a deep, dim amber so the gold reads; the sun is fully up only at the coda's arrival on B.
  // CRITIC (2026-11-06): the Berceuse ran at 0.5 and read as grey-olive murk under a tiny light; at ~0.32 the fields are a
  // dusk you look INTO, and the lantern and the ring glow on it. The swell still flushes (0.5), but no longer washes out.
  // The 7/4 (319.6-348.5) is now on black: the sun is withdrawn while the river and the brass fire burn, and it comes back
  // on the Maestoso's first ff blow (348.56), where the hymn returns in full. That blow is a real attack, so no fake one.
  intensity: piv([[6.3, 0], [9.5, 0.32, 'ease'], [18.8, 0.32], [60, 0.34], [80.5, 0.36], [86, 0.5], [96, 0.48], [104, 0.42], [110, 0.34], [118, 0.34],
    [154, 0.34], [172, 0.33], [194, 0.36], [217, 0.34], [225.8, 0.3], [227.2, 0.16], [241, 0.18], [252.4, 0.34], [267, 0.46], [283, 0.6], [303.5, 0.8],
    [319.1, 0.8], [319.6, 0.0, 'hold'], [348.55, 0.0], [349.8, 0.45, 'ease'], [358.6, 0.5], [380.6, 0.5], [381.5, 0.82, 'ease'], [401.04, 0.82], [401.12, 0]]) });

// ======================= the cradle: strings, ice =======================
// The frozen tremolo's chords sound until the next change (the roll cuts them short; the tremolo goes on to 226.6 s).
const frozen = S('frozen-tremolo');
const changes = [...new Set(frozen.map((n) => n[0]))];
const frozenHeld = frozen.map((n) => { const k = changes.indexOf(n[0]); return [n[0], Math.max(n[1], k + 1 < changes.length ? changes[k + 1] : 226.4), n[2], n[3]]; });
// CRITIC: the ring went empty through the swell (no rocking is played there). Its entry chord and the low D tolls under it
// are heard, so the ring holds them: it glows on the A-major entry and is struck by each toll.
sets.cradle = merge(S('harp-rocking'), S('eb-pedal'), S('last-rocking'), frozenHeld, S('swell-entry'), S('d-pedal-tolls'));
// CRITIC: bend 1, the woven band closed into a ring. The harp's rocking goes round and round for three minutes: a spell
// is a circle, and a cradle seen from above. Against type (the widget's own default is an arch), and it pays off in the
// hymn, where the weave starts nearly closed and opens note by note into the sunrise's arch.
clip({ start: 6.3, end: 226.6, fade: 0.3, widget: 'strings', listen: 'picks:cradle', knobs: { heat: 0.05, presence: 0.3, bend: 1 } });

// ======================= the lantern: the current =======================
const lantern = merge(
  S('lullaby-bassoon'), win(S('violins-line'), 31, 46.4), win(S('voice-track'), 0, 170), win(S('wind-answers'), 57, 60).filter((n) => n[2] >= 64),
  S('strings-lament'), S('swell-violins'), S('harp-bridge').filter((n) => n[2] >= 80), S('reprise-bassoon'), win(S('winds-line'), 138, 154),
  S('lullaby-dissolve'), tops(S('last-rocking')), tops(frozenHeld), S('horn-hymn').slice(0, 1));
// CRITIC: at presence 0 the water runs at 0.4 and the lone thread was a small comet with a short tail. Set by hand instead:
// one thread (threads 1, braid 15, the lone light), but the water at 1.1 and the cord thick (2.2), so the lullaby writes a
// long glowing line across the dusk. The swell is now the line itself surging: its notes push the water to 1.9 and the cord
// to 2.5 (per note, from the attack), and the next lullaby note without them lets it settle.
const SWELL = new Set(S('swell-violins').map((n) => n[0]));
sets.lantern = lantern.map((n) => (SWELL.has(n[0]) ? withValues(n, { flow: 1.9, width: 2.5 }) : n));
clip({ start: 18.4, end: 229.6, fade: 0.4, widget: 'current', listen: 'picks:lantern', knobs: { hue: 210, width: 2.2, flow: 1.1, threads: 1, braid: 15 } });

// ======================= the hymn: Ivory rows, rising =======================
/** Notes Ivory would lose: its keys are the notes up to the line's extreme; later notes press keys back, one each. */
function ivoryLost(ns) {
  const ms = ns.map((n) => n[2]), hi = Math.max(...ms), lo = Math.min(...ms);
  const op = ns.filter((n) => n[0] - ns[0][0] < 0.04), start = op.reduce((a, n) => a + n[2], 0) / op.length;
  const end = start > (hi + lo) / 2 ? lo : hi, stomp = Math.max(...ns.filter((n) => n[2] === end).map((n) => n[0]));
  const keys = ns.filter((n) => n[0] <= stomp).length;
  return Math.max(0, ns.length - keys - keys);
}
/** Rows at the given phrase starts, each split further only where a note would be lost. */
function rows(ns, starts) {
  const out = [];
  for (let i = 0; i < starts.length; i++) {
    const ph = win(ns, starts[i] - 0.01, i + 1 < starts.length ? starts[i + 1] - 0.01 : 1e9);
    let cur = [];
    for (const n of ph) { const next = [...cur, n]; if (cur.length && ivoryLost(next) > 0) { out.push(cur); cur = [n]; } else cur = next; }
    if (cur.length) out.push(cur);
  }
  return out;
}
const ROWS = [];   // { id, notes, knobs, region }
function statement(base, ns, starts, knobs, region, amount) {
  rows(ns, starts).forEach((row, i) => {
    const id = `${base}-${i + 1}`;
    ROWS.push({ id, notes: vals(row, (n, k, all) => ({ intensity: amount(n, k, all) })), knobs, region });
  });
}
const arch = (lo, hi) => (n, k, all) => (all.length < 2 ? hi : lo + (hi - lo) * Math.sin(Math.PI * k / (all.length - 1)) ** 0.7);
const W = (y, s) => ({ mode: 'window', shape: 'rect', x: 0.5, y, w: s, h: s, feather: 0.12, fit: 'contain', blend: 'lighten' });
const IV = { huddle: 0.8, cracks: 1 };
statement('horn-keys', S('horn-hymn'), [226.7, 233.71, 241.34, 248.59], { ...IV, strike: 0, crater: 0.2, ripple: 1.5, presence: 0.9 }, W(0.75, 0.52), arch(0.7, 0.95));
statement('strings-keys', S('hymn-strings'), [252.48, 258.05, 262.59], { ...IV, strike: 0.15, crater: 0.25, ripple: 2, presence: 0.92 }, W(0.67, 0.56), arch(0.85, 1.05));
statement('third-keys', S('hymn-third'), [267.04, 271.79, 276.49], { ...IV, strike: 0.35, crater: 0.3, ripple: 2.6, presence: 0.95 }, W(0.58, 0.66), arch(0.95, 1.15));
statement('cresc-keys', S('hymn-crescendo'), [283.14, 287.62, 291.59, 295.06, 298.31], { ...IV, strike: 0.6, crater: 0.45, ripple: 3.5, cracks: 1.5, presence: 1 }, W(0.5, 0.8),
  (n) => curve([[283, 1], [303, 1.35]])(n[0]));
statement('tutti-keys', S('hymn-tutti'), [303.51, 307.9, 311.43, 314.95], { ...IV, strike: 1, crater: 0.35, floor: 1, ripple: 5, cracks: 2, presence: 1 }, undefined,
  (n) => (n[0] < 304 ? 1.7 : 1.45));
statement('maestoso-keys', S('maestoso-top'), [348.56, 353.62, 358.55, 363.55, 368.64, 373.76, 380.74], { ...IV, strike: 1, crater: 0.35, floor: 1, ripple: 6, cracks: 2, presence: 1 }, undefined,
  (n) => (n[0] > 380 ? 1.8 : 1.45));
statement('final-keys', S('final-chord').filter((n) => n[0] < 412 || n[2] !== 47), [402.4], { ...IV, strike: 0, crater: 0.6, ripple: 3, presence: 0.9 }, W(0.52, 0.7), () => 1.1);
// Each row ends as the next begins (or 3.9 s after its last note); the final keys run to the end.
const IV_TAIL = 3.9;
ROWS.forEach((r, i) => {
  sets[r.id] = r.notes;
  const first = r.notes[0][0], last = r.notes[r.notes.length - 1][0], next = ROWS[i + 1]?.notes[0][0] ?? 1e9;
  let end = Math.min(last + IV_TAIL, next - 0.05);
  if (r.id.startsWith('final')) end = 415.6;
  if (r.id === 'tutti-keys-4') end = Math.min(end, 319.1);
  clip({ start: first - 0.35, end, fade: 0.3, widget: 'ivory', listen: `picks:${r.id}`, knobs: r.knobs, ...(r.region ? { region: r.region } : {}) });
});

// ======================= the braid: strings with the hymn =======================
const HEAT = curve([[252.4, 0.1], [267, 0.3], [283, 0.5], [303.5, 0.9], [320, 0.95]]);
// CRITIC: the spell's ring opens. The weave enters nearly closed (bend 0.9) and unrolls note by note into the arch (0.32,
// the widget's own default) by the tutti: the lullaby's circle becomes the sunrise.
const BEND = curve([[252.4, 0.9], [267, 0.78], [283, 0.6], [303.5, 0.32]]);
sets.weave = vals(win(merge(S('violins-line'), S('violas-inner'), S('cellos-low')), 252.4, 319.0), (n) => ({ heat: HEAT(n[0]), bend: BEND(n[0]) }));
clip({ start: 252.2, end: 319.1, fade: 0.15, widget: 'strings', listen: 'picks:weave', knobs: { heat: 0.1, bend: 0.9 }, intensityMoves: 'present',
  intensity: piv([[252.2, 0.08], [267, 0.25], [283, 0.5, 'ease'], [303.5, 1], [319.1, 1]]) });

// ======================= the hush and the river: the lantern reborn =======================
sets.river = merge(S('hush-swell'), S('seven-four-strokes').filter((n) => n[2] >= 50));
clip({ start: 319.15, end: 352, fade: 1, widget: 'current', listen: 'picks:river', intensityMoves: 'present',
  knobs: { threads: 5, braid: 100, flow: 2, width: 1.5, hue: 38 },   // CRITIC: braid 100 (was 130; 200 tried): on black, wide strands hug the walls and draw straight edge lines
  intensity: piv([[319.15, 0, 'hold'], [324.12, 1], [352, 1]]) });

// ======================= the stamps: strings, ember and gold =======================
sets.stamp = merge(win(S('maestoso-bass'), 348.4, 400), S('maestoso-strokes'), S('coda-chords'));
clip({ start: 348.4, end: GROUND_END, fade: 0.06, widget: 'strings', listen: 'picks:stamp', knobs: { heat: 0.92 } });

// ======================= the blows: fireworks-snap =======================
const FF = [324.13, 348.56, 358.55, 380.74];
const isFF = (t) => FF.some((f) => Math.abs(f - t) < 0.05);
sets.blows = vals(merge(S('seven-four-downbeats'), S('maestoso-downbeats')), (n) => (isFF(n[0])
  ? { size: n[0] > 380 ? 2 : 1.7, linger: 0.28, intensity: 1.1 } : { size: 0.7, linger: 0.08 }));   // short smoke: at more it floods the keys in mustard
clip({ start: 323.95, end: 386.5, fade: 0.15, widget: 'fireworks-snap', listen: 'picks:blows', knobs: { hue: 0.065, range: 0.12, swirl: 0.6 } });
sets['last-stroke'] = S('final-chord').filter((n) => n[0] > 412);
clip({ start: 412.3, end: 416.5, fade: 0.25, widget: 'fireworks-snap', listen: 'picks:last-stroke', knobs: { hue: 0.065, range: 0.12, size: 2.4, swirl: 0.8, linger: 0.4 } });

// ======================= the final chord =======================
// The re-attacks of the swelling chord, from the audio onsets (B the strongest pitch class): a new thread at each.
const vel = (db) => Math.max(20, Math.min(122, Math.round(122 + 3 * db)));
const swell = [[402.773, -17.7], [403.423, -14.9], [405.606, -9.3]].map(([t, db]) => [t, t + 0.6, 59, vel(db)]);
sets.reborn = merge(S('final-chord'), swell);
clip({ start: 402.25, end: 415.6, fade: 1, widget: 'current', listen: 'picks:reborn', intensityMoves: 'present',
  knobs: { threads: 5, braid: 110, flow: 1.4, width: 1.4, hue: 38 },
  intensity: piv([[402.25, 0, 'hold'], [402.77, 0.25, 'hold'], [403.42, 0.5, 'hold'], [405.6, 0.75, 'hold'], [412.6, 1]]) });
sets.dawn = vals(S('final-chord'), () => ({ warmth: 1, breath: 8 }));
clip({ start: 402.3, end: 416.5, fade: 0.1, widget: 'comfort', listen: 'picks:dawn', knobs: { warmth: 1 },
  intensity: piv([[402.3, 0], [412.6, 0.55, 'ease'], [413.4, 0.55], [416.4, 0]]) });

// ======================= tracks, ids, write =======================
const BAND = 8, byTrack = new Map();
const overl = (a, b) => a.start < b.end - 5e-4 && b.start < a.end - 5e-4;
for (const c of [...clips].sort((a, b) => a.start - b.start)) {
  let t = LAYER[c.widget] * BAND;
  while ((byTrack.get(t) ?? []).some((o) => overl(o, c))) t++;
  if (Math.floor(t / BAND) !== LAYER[c.widget]) throw new Error(`band overflow ${c.widget} ${c.start}`);
  c.track = t; byTrack.set(t, [...(byTrack.get(t) ?? []), c]);
}
const used = [...byTrack.keys()].sort((a, b) => a - b);
for (const c of clips) c.track = used.indexOf(c.track);
clips.sort((a, b) => a.start - b.start || a.track - b.track);
clips.forEach((c, i) => { c.id = `c${i + 1}`; });
// Each set trimmed to its clips (a pick nobody hears is a warning).
const picks = {};
for (const [id, ns] of Object.entries(sets)) {
  const cs = clips.filter((c) => c.listen === `picks:${id}`);
  if (!cs.length) continue;
  picks[id] = { notes: ns.filter((n) => cs.some((c) => n[0] >= c.start && n[0] < c.end)) };
}
const show = {
  version: 3, id: ID, song: SONG,
  title: 'Firebird, Berceuse and Finale · A · Lantern to hymn: the current as the lullaby\'s lone light over Comfort\'s breathing dusk fields, an ice band of woven threads rocking; the hymn as huddled Ivory rows rising like the sun as Comfort warms to amber; woven threads braiding into ember; the lantern reborn as a river in the 7/4; fireworks-snap on the bar blows',
  composer: { by: 'claude', at: new Date().toISOString() }, clips, picks,
};
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets: loadCatalogue().widgets, tracks: Object.keys(pack.tracks ?? {}) });
console.log(`${clips.length} clips, ${Object.keys(picks).length} sets, tracks 0..${used.length - 1}`);
for (const r of ROWS) console.log(`  ${r.id}: ${r.notes.length} keys ${r.notes[0][0].toFixed(2)}-${r.notes[r.notes.length - 1][0].toFixed(2)}`);
console.log(`errors ${errors.length}`, errors.slice(0, 20));
console.log(`warnings ${warnings.length}`, warnings.slice(0, 30));
const ev = clips.flatMap((c) => [[c.start, 1], [c.end, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
let n = 0, most = 0, at = 0; for (const [t, d] of ev) { n += d; if (n > most) { most = n; at = t; } }
console.log('most clips at once', most, 'at', at);
if (!errors.length) { writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show)); console.log(`wrote shows/${ID}.json`); }
