// Builds shows/romeo-juliet-3-love-a-milk-and-thorn.json: cycle A "Milk and thorn" on the love theme.
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-3-love/build-romeo-juliet-3-love-a-milk-and-thorn.mjs
//
// The cycle's mapping (the same in all six packs):
//   ivory   <- the love theme, one short row per phrase (`love-theme`, split into phrases: love-r1 .. love-r15)
//   nap     <- the sighs: the muted strings' rocking chords (`sighs`, without the C#2 pedal under them)
//   pluck   <- the harp (`harp`)
//   fields  <- the ground: a dim violet field, pinned violet (home fixed, not following the loudness)
//
// The plan, by section (ANALYSIS.md, romeo-juliet-3-love):
//   0-21     Night pedal. Stillness: black, then one dim violet field that the A/Bb pedal lights from inside.
//   21.6-39  The first statement (English horn + violas): two small huddled Ivory rows, low on the stage, a little
//            dimmer than milk; the bass strokes under it (`low-pulse`) light the field: a heartbeat. A spare entrance.
//   39.2-41  The harp: Pluck's threads fan out of the last key's ripple.
//   41-72    The sighs, on black: slate velvet. Every rocking chord strokes its bands; the same chord again strokes
//            them out. The field is gone (velvet at night needs black; Nap's crossings cancel to black).
//   72-87    The theme returns in the woodwinds over the rocking chords: the rows come back larger, the velvet keeps
//            breathing under them (the chords' inner voice), and the heartbeat field returns.
//   87-110   The theme climbs (G, E, A): each row's window stands a little higher and wider, as the key rises.
//            Serendipity: the horns' countermelody answers from ABOVE: Ivory hung upside down from the top of the
//            picture (a window turned 180 degrees). Romeo's theme rises from the ground, Juliet's answer hangs from
//            the balcony. Same widget, same family, a second voice.
//            Under the climb the velvet blushes: Nap's own oxblood cloth enters on the strings' chord blocks, while each
//            heartbeat lets the violet field step further back (its `back` set per bass stroke, 0.8 -> 1.6), so the red
//            rises out of the violet as the key rises, and the field is gone by the climax.
//   110-150  The full-string climax, on black: the rows stand full-size and stomp (strike 1, a harder crack on each
//            row's stomp note); oxblood velvet across the whole stage (each chord block's bass, two middle voices and
//            top: low left to high right), broader on the stressed beats; the horns still hang from above. The row
//            that stomps on the loudest moment of the pack (132.42 s) presses the deepest crater (intensity 2,
//            crater 0.6, ripple 7): the one big gesture of the piece.
//
// What the previews taught (three rounds): the field wandered to red and orange with the harmony (`chords` 0.4) ->
// pinned violet (`home` fixed, `chords` 0.12); the oxblood velvet vanished over the field (it paints with `lighten`
// in dark pile tones) -> the climax is on black; the velvet on the outer voices alone clustered in the middle ->
// bass + inner + top; Ivory's crater read as a beige smudge at 0.4-0.6 -> 0.15-0.3, deep only at the peak.
// The critic (round 4): every Nap clip now plays in a magnifying window (`lens`, below: 2x for the slate cloth, 1.4x for
// the oxblood), so the sighs fill the stage and the windowed velvet DOES show over the violet field; the peak crater is
// 0.45; the balcony night's field listens to `night-heart` (the C#2 heartbeat strokes), not the Db pedal alone.
//   150-172  Codetta: the slate sighs return on black over the Db pedal; the last row stomps; one horn sigh above.
//   172-185  Two swells (F -> Ab -> A, twice): three slate strokes per swell, a window of three; the field surges
//            with the loudness (its curve), not with attacks.
//   185-218  Balcony night: the harp once more, then ONE velvet band at a time on the violins' slow falling figure
//            (memory 1: the band moves down note by note, a repeated note restrokes it), over the still violet field,
//            which goes out with the Db pedal. 217.6-221: black.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-3-love-a-milk-and-thorn', SONG = 'romeo-juliet-3-love';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const set = (id) => { const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`); return s.notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const r3 = (v) => Math.round(v * 1000) / 1000;
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
/** A note that starts while the same pitch still sounds, < 0.3 s after it: a doubled transcription, not a new note. */
const dedupe = (ns) => {
  const out = [];
  for (const n of ns) if (!out.some((o) => o[2] === n[2] && n[0] - o[0] < 0.3 && n[0] < o[1])) out.push(n);
  return out;
};
/** Nap keys a band on pitch and a 1/8 bucket of the velocity: one velocity for the whole set makes the same note
    always the same band, so it strokes out what it stroked in (the sigh). */
const flat = (ns, v = 60) => ns.map((n) => [n[0], n[1], n[2], v]);

// ---------- Ivory: the love theme, one row per phrase ----------
const LOVE = set('love-theme');
// [from, to, intensity, stage]: phrase windows read from the theme's gaps and long notes (the first statement in two
// phrases; the woodwind statement in two; the climb in five, one per step of the modulation; the climax in six).
const ROWS = [
  [21.0, 28.6, 0.9, 'first'], [29.0, 39.0, 0.9, 'first'],
  [72.0, 79.9, 1, 'second'], [79.9, 87.5, 1, 'second'],
  [87.5, 92.5, 1, 'climb0'], [92.5, 96.5, 1.1, 'climb1'], [97.0, 100.5, 1.1, 'climb2'], [100.5, 106.6, 1.2, 'climb3'], [107.5, 110.8, 1.2, 'climb4'],
  [111.0, 119.0, 1.4, 'climax'], [119.5, 122.2, 1.4, 'climax'], [123.0, 127.0, 1.5, 'climax'], [127.5, 136.0, 1.6, 'climax'],
  [137.4, 143.2, 1.5, 'climax'], [144.0, 152.5, 1.4, 'climax'],
];
// The horns' countermelody: the rows that hang from the balcony.
const HORN = set('horn');
const JROWS = [[90.9, 94.0], [97.5, 104.5], [112.7, 119.0], [121.5, 123.0], [137.4, 141.4], [144.2, 147.6], [168.2, 170.1]];

/** Ivory's own plan (lab/tools/ivory.js planOf): where the row heads, its stomp, the notes that press keys back. */
const planOf = (ns) => {
  const ms = ns.map((n) => n[2]), hi = Math.max(...ms), lo = Math.min(...ms);
  const opening = ns.filter((n) => n[0] === ns[0][0]), start = opening.reduce((a, n) => a + n[2], 0) / opening.length;
  const end = start > (hi + lo) / 2 ? lo : hi;
  const stomp = Math.max(...ns.filter((n) => n[2] === end).map((n) => n[0]));
  return { dir: end === hi ? 'rises' : 'falls', end, stomp, back: ns.filter((n) => n[0] > stomp).length };
};

/** The notes one hears as the theme in a row: not an inner note under a higher one (sounding at its start, or entering
    in its first 60 %), not a horn note the set shares (same pitch within 50 ms of a horn note: that is the
    countermelody, it hangs from the balcony), and at the climax not the long low pedal notes (below C4, over 2 s). */
const themeOf = (ns, climax) => ns.filter((n) => {
  if (ns.some((o) => o !== n && o[2] > n[2] && ((o[0] <= n[0] && n[0] < o[1]) || (o[0] > n[0] && o[0] < n[0] + 0.6 * (n[1] - n[0]))))) return false;
  if (HORN.some((h) => h[2] === n[2] && Math.abs(h[0] - n[0]) < 0.05)) return false;
  return !(climax && n[2] < 60 && n[1] - n[0] > 2);
});
const picks = {};
const rowSets = [];
ROWS.forEach(([a, b, k, stage], i) => {
  const id = `love-r${i + 1}`, ns = themeOf(dedupe(within(LOVE, a, b)), stage === 'climax');
  if (!ns.length) throw new Error(`${id}: empty`);
  // The stomp of a climax row cracks harder; the row that stomps on the loudest moment of the pack (132.4 s, r13)
  // presses the deepest crater and sends the widest ripple through its keys.
  const st = planOf(ns).stomp, peak = stage === 'climax' && Math.abs(st - 132.42) < 0.05;
  picks[id] = { notes: ns.map((n) => {
    if (stage === 'climax' && n[0] === st) return withValues(n, peak ? { intensity: 2, crater: 0.45, ripple: 7 } : { intensity: k + 0.3, crater: 0.5, ripple: 4.5 });
    return withValues(n, k === 1 ? {} : { intensity: k });
  }) };
  rowSets.push({ id, ns, stage, k });
});
const jSets = [];
JROWS.forEach(([a, b], i) => {
  const id = `horn-j${i + 1}`, ns = dedupe(within(HORN, a, b));
  if (!ns.length) throw new Error(`${id}: empty`);
  picks[id] = { notes: ns };
  jSets.push({ id, ns });
});

// ---------- Nap: the sighs ----------
// 41-72: the rocking chords' two voices, without the C#2 pedal (it would blink one huge band on every chord).
// 72-87.3: the rocking chords go on under the woodwinds: their inner voice (C3-B4) from the chord blocks.
// 150-172.3: the codetta's sighs over the Db pedal, again without the pedal.
/** A pitch stroked again within `gap` s is one stroke (a fast repeat would blink its band on and off). */
const unrepeat = (ns, gap) => { const last = new Map(), out = [];
  for (const n of ns) { if (n[0] - (last.get(n[2]) ?? -9) >= gap) out.push(n); last.set(n[2], n[0]); }
  return out; };
const SIGHS = set('sighs').filter((n) => n[2] >= 48);
const UNDER = within(set('chord-blocks'), 72, 87.3).filter((n) => n[2] >= 48 && n[2] < 72);
picks['nap-sighs'] = { notes: flat(unrepeat(dedupe([...SIGHS, ...UNDER].sort((a, b) => a[0] - b[0] || a[2] - b[2])), 0.45)) };
// The full strings, from the climb to the end of the climax: each chord block as the strings strike it, read from every
// note struck with it (roll and pack): its bass, its two middle pitches and its top, so the velvet spans the stage
// from the low left to the high right. Broad on the stressed beats the audio hears (`climax-onsets`), narrower between.
const ALL = [...pack.notes, ...Object.values(pack.tracks).flatMap((t) => t.notes)];
const STRESS = set('climax-onsets').map((n) => n[0]);
const blockTimes = [...new Set([...within(set('chord-blocks'), 87.3, 111), ...set('climax-chords')].map((n) => n[0]))].sort((a, b) => a - b);
const inner = [];
let lastT = -9;
for (const t of blockTimes) {
  if (t - lastT < 0.04) continue; lastT = t;
  const ms = [...new Set(ALL.filter((n) => Math.abs(n[0] - t) <= 0.05).map((n) => n[2]))].sort((a, b) => a - b);
  if (ms.length < 3) continue;
  const mid = ms.slice(1, -1), take = [ms[0], ...(mid.length <= 2 ? mid : [mid[Math.floor((mid.length - 1) / 2)], mid[Math.floor((mid.length - 1) / 2) + 1]]), ms[ms.length - 1]];
  const v = STRESS.some((s) => Math.abs(s - t) <= 0.06) ? 100 : 64;
  for (const m of take) { const src = ALL.find((n) => Math.abs(n[0] - t) <= 0.05 && n[2] === m); inner.push([r3(t), r3(Math.max(t + 0.1, src[1])), m, v]); }
}
picks['nap-climax'] = { notes: unrepeat(inner, 0.6) };
// The two swells: the bass climbing F -> Ab -> A, twice (a repeat of the same pitch inside a swell is one stroke).
const sw = [];
for (const n of within(set('bass-line'), 172.1, 185.5)) if (!sw.length || sw[sw.length - 1][2] !== n[2]) sw.push(n);
picks['nap-swells'] = { notes: flat(sw) };
// The balcony night: the violins' slow falling figure, F5 x4, Ab4 x4, F4 ... Ab3.
picks['nap-night'] = { notes: flat(dedupe(within(set('violins'), 188, 207))) };

picks['harp'] = { notes: set('harp') };
// From the climb on, each heartbeat lets the field step further back (0.8 -> 1.6), so the oxblood velvet rises out of
// the violet as the theme climbs: the crossfade is made of the bass strokes, not of time.
picks['low-pulse'] = { notes: within(set('low-pulse'), 0, 112.5).map((n) => n[0] < 87 ? n : withValues(n, { back: r3(0.8 + 0.8 * Math.min(1, (n[0] - 87) / 23)) })) };
picks['bass-line-night'] = { notes: within(set('bass-line'), 0, 21) };
picks['bass-line-swells'] = { notes: within(set('bass-line'), 171, 188.2) };
// The balcony night's heartbeat: the Db pedal as the audio hears it (185.5, 188) and the basses' C#2 strokes.
picks['night-heart'] = { notes: [...within(set('night-hush'), 185, 188.1), ...within(set('bass-line'), 188.1, 221)].sort((a, b) => a[0] - b[0]) };

// ---------- regions ----------
const win = (x, y, w, h, rot = 0) => ({ mode: 'window', shape: 'rect', x, y, w, h, ...(rot ? { rot } : {}), feather: 0.05, fit: 'stretch' });
// Ivory draws its keys on a ground line at 0.88 of the height; a window placed lower and smaller is a smaller,
// nearer-the-floor row. The climb raises the window step by step with the modulations.
const STAGE = {
  first: { region: win(0.5, 0.64, 0.56, 0.72), knobs: { huddle: 0.7, crater: 0.15, ripple: 2 } },
  second: { region: win(0.5, 0.6, 0.72, 0.8), knobs: { huddle: 0.4, strike: 0.3, crater: 0.2, ripple: 2.4 } },
  climb0: { region: win(0.5, 0.58, 0.78, 0.84), knobs: { huddle: 0.25, strike: 0.5, crater: 0.25, ripple: 2.6 } },
  climb1: { region: win(0.5, 0.56, 0.82, 0.88), knobs: { huddle: 0.2, strike: 0.6, crater: 0.25, ripple: 2.8 } },
  climb2: { region: win(0.5, 0.545, 0.86, 0.91), knobs: { huddle: 0.15, strike: 0.7, crater: 0.25, ripple: 3 } },
  climb3: { region: win(0.5, 0.53, 0.9, 0.94), knobs: { huddle: 0.1, strike: 0.8, crater: 0.25, ripple: 3 } },
  climb4: { region: win(0.5, 0.515, 0.95, 0.97), knobs: { huddle: 0.05, strike: 0.9, crater: 0.25, ripple: 3.2 } },
  climax: { knobs: { strike: 1, crater: 0.3, ripple: 3.6 } },
};
// The balcony: the horn rows hang from the top, in the upper half, turned over.
const BALCONY = win(0.5, 0.25, 0.8, 0.5, 180);
// The critic's change: the velvet seen close up. Nap places a band by pitch (x = 0.06 + 0.88 q), so a narrow strand like
// the sighs (C3-B4) strokes a column a fifth of the stage wide, a thin slate column on black for a third of the show. A
// window z times the stage's width and the stage's height, with `fit: cover`, is a z-times magnifying glass on Nap's canvas (z 2 crops the middle
// half of the height and stretches it over the stage): the bands run floor to ceiling, broad, and the cloth fills the
// picture. The window is centred so the set's mean band lands mid-stage (X = 0.5 - (cx - 0.5) * z); the climax velvet takes 1.4. In a window the
// black goes see-through but the dark pile stays solid, so the velvet now also shows over the violet field (72-89 s).
const napX = (m) => 0.06 + 0.88 * Math.min(1, Math.max(0, (m - 21) / 87));
const lens = (id, a, b, z = 2) => {
  const ns = within(picks[id].notes, a, b), cx = ns.reduce((s, n) => s + napX(n[2]), 0) / ns.length;
  return { mode: 'window', shape: 'rect', x: r3(Math.min(1.5, Math.max(-0.5, 0.5 - (cx - 0.5) * z))), y: 0.5, w: z, h: 1, feather: 0, fit: 'cover' };
};

// ---------- clips ----------
const clips = [];
const VIOLET = { home: { base: -0.75, drive: '', depth: 0 } };
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
// The ground (tracks 0-1): fields only where the night is (never under the velvet's sighs).
clips.push(
  { id: 'night', start: 0, end: 23, track: 0, fade: 3, widget: 'fields', listen: 'picks:bass-line-night',
    knobs: { ...VIOLET, back: 0.9, n: 1, chords: 0.12, dyn: 0.5 } },
  { id: 'heart', start: 20.5, end: 42, track: 1, fade: 1.5, widget: 'fields', listen: 'picks:low-pulse',
    knobs: { ...VIOLET, back: 0.8, n: 2, chords: 0.12, dyn: 0.75 } },
  // the heartbeat returns with the theme and gives way to the velvet as the climax arrives (the velvet needs black)
  { id: 'heart2', start: 71.5, end: 113, track: 0, fade: 2.5, widget: 'fields', listen: 'picks:low-pulse',
    knobs: { ...VIOLET, back: 0.8, n: 2, chords: 0.12, dyn: 0.8 } },
  { id: 'swells', start: 171.6, end: 188.6, track: 0, fade: 1, widget: 'fields', listen: 'picks:bass-line-swells',
    knobs: { ...VIOLET, back: 0.6, n: 1, chords: 0.12, dyn: 0.8 },
    // the two surges, from the loudness (172.3 and 182.4 s): the field swells and sinks with them
    intensity: iv([[171.6, 0.35], [174.8, 0.95, 'ease'], [178.5, 0.45, 'ease'], [182.3, 0.5], [184, 0.95, 'ease'], [188.6, 0.5, 'ease']]) },
  // The critic's change: the night's field is the heartbeat again. Under the violins' falling figure the basses stroke
  // the C#2 pedal every 0.55 s (194.7-202.4), then hold it (210.5): the field glows from inside on each stroke, as the
  // heartbeat field did under the theme, and goes out with the pedal (no curve: a curve below 1 would drop strokes).
  { id: 'balcony-night', start: 185.2, end: 219, track: 1, fade: 4.5, widget: 'fields', listen: 'picks:night-heart',
    knobs: { ...VIOLET, back: 0.3, n: 1, chords: 0.12, dyn: 0.75 } },
);
// The velvet (tracks 2-3).
clips.push(
  { id: 'sighs', start: 40.7, end: 89, track: 2, fade: 0.6, widget: 'nap', listen: 'picks:nap-sighs', knobs: { cloth: 2 },
    region: lens('nap-sighs', 40.7, 89) },
  // the velvet blushes: Nap's own oxblood, from the climb (under the field, faint) to the climax (on black, full)
  { id: 'climax-velvet', start: 87.0, end: 151.2, track: 3, fade: 1.5, widget: 'nap', listen: 'picks:nap-climax',
    knobs: { memory: 12, width: 1.2 }, region: lens('nap-climax', 87, 151.2, 1.4) },
  { id: 'codetta-sighs', start: 150.2, end: 172.6, track: 2, fade: 0.8, widget: 'nap', listen: 'picks:nap-sighs', knobs: { cloth: 2 },
    region: lens('nap-sighs', 150.2, 172.6) },
  { id: 'swell-strokes', start: 171.9, end: 187, track: 3, fade: 1, widget: 'nap', listen: 'picks:nap-swells',
    knobs: { cloth: 2, memory: 3, rest: 8 }, region: lens('nap-swells', 171.9, 187) },
  { id: 'night-band', start: 188, end: 219.5, track: 2, fade: 2, widget: 'nap', listen: 'picks:nap-night',
    knobs: { cloth: 2, memory: 1, rest: 12, width: 0.8 }, region: lens('nap-night', 188, 219.5) },
);
// The harp (track 4).
clips.push(
  { id: 'harp-in', start: 38.9, end: 45, track: 4, fade: 0.3, widget: 'pluck', listen: 'picks:harp', knobs: { ring: 1.8, pull: 1.5 } },
  { id: 'harp-night', start: 186.4, end: 192, track: 4, fade: 0.3, widget: 'pluck', listen: 'picks:harp', knobs: { ring: 1.8 } },
);
// The love theme (tracks 5-6, alternating so a row can give way as the next begins).
const plans = [];
rowSets.forEach(({ id, ns, stage, k }, i) => {
  const st = STAGE[stage], p = planOf(ns);
  const start = r3(ns[0][0] - 0.4);
  let end = r3(Math.max(ns[ns.length - 1][0], p.stomp) + 3.7);
  const next = rowSets[i + 1];
  if (next) end = Math.min(end, r3(next.ns[0][0] + 0.2));
  const c = { id: `theme-${i + 1}`, start, end, track: 5 + (i % 2), fade: 0.3, widget: 'ivory', listen: `picks:${id}`, knobs: st.knobs };
  if (st.region) c.region = st.region;
  clips.push(c);
  plans.push(`${id} ${stage} x${k}: ${ns.length} notes ${ns[0][0].toFixed(2)}-${ns[ns.length - 1][0].toFixed(2)} [${ns.map((n) => nm(n[2])).join(' ')}] ${p.dir} to ${nm(p.end)}, stomp ${p.stomp.toFixed(2)}, ${p.back} back; clip ${start}-${end}`);
});
// The balcony (track 7).
jSets.forEach(({ id, ns }, i) => {
  const p = planOf(ns), start = r3(ns[0][0] - 0.4);
  let end = r3(Math.max(ns[ns.length - 1][0], p.stomp) + 3.7);
  const next = jSets[i + 1];
  if (next) end = Math.min(end, r3(next.ns[0][0] + 0.2));
  clips.push({ id: `balcony-${i + 1}`, start, end, track: 7 + (i % 2), fade: 0.3, widget: 'ivory', listen: `picks:${id}`,
    knobs: { strike: 0.4, crater: 0.12, ripple: 2.2 }, region: BALCONY });
  plans.push(`${id}: ${ns.length} notes ${ns[0][0].toFixed(2)}-${ns[ns.length - 1][0].toFixed(2)} [${ns.map((n) => nm(n[2])).join(' ')}] ${p.dir} to ${nm(p.end)}, stomp ${p.stomp.toFixed(2)}, ${p.back} back; clip ${start}-${end}`);
});

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 3. Love theme · A "Milk and thorn": huddled Ivory rows on the love theme growing to the climax, the horns\' countermelody hung from the balcony as upside-down Ivory, slate Nap velvet breathing on the sighs (oxblood at the climax), Pluck threads for the harp, a dim violet field with the bass strokes as a heartbeat',
  composer: { by: 'claude', at: '2026-11-06T12:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
for (const l of plans) console.log(l);
for (const [k, v] of Object.entries(picks)) if (!k.startsWith('love-r') && !k.startsWith('horn-j')) console.log(`${k}: ${v.notes.length} notes, ${v.notes[0][0]}-${v.notes[v.notes.length - 1][0]}`);
console.log(`${ID}: ${clips.length} clips, ${Object.keys(picks).length} sets; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
