// Builds shows/liszt-hungarian-2-c-optical-poem.json: "Optical poem", Liszt's Hungarian Rhapsody No. 2 (orchestral), danced by
// Fischinger alone. Oskar Fischinger's An Optical Poem (MGM, 1938) was cut to this very rhapsody; the show answers it with one
// widget, used as a POLYPTYCH OF WINDOWS. Every window is its own Fischinger instance with its own deep-blue ground, and each
// listens to one strand of the music (a pick set from picks.json, cut to the window's own span). The geometry of the windows IS
// the form:
//
//   full screen      the tutti, unity, ONE company: both Lentos, the lassan's ff peaks, the first friska tutti, the
//                    fireworks, the last blow.
//   one layered panel the lassan (the slow half) and the stretta: every strand is a full-screen copy laid over the others
//                    with 'lighten' (critic's pass: the composer had three thin bands on black; the cast asked for one
//                    deep-blue panel). The copies are shifted by register, the low strings sunk (and 1.32x), the singing
//                    line in the middle, the violins/clarinet/glitter raised, so their figures stand at three heights in
//                    one blue, each in its own formation. It builds from the bottom up as the orchestra fills (40-88 s,
//                    104-160 s, 212-246 s, 265-361 s); the friska breaks it into windows; the stretta (584-619 s) folds
//                    them back into it.
//   the slit         a solo voice, a cadenza: one tall narrow window (the clarinet's cadenzas and its sinking line, and the
//                    friska's dying high tremolo "where a cadenza would go"). The window is a wide band ROTATED -90 deg, so
//                    Fischinger's row of dancers (low notes on the left) stands upright: the cadenza climbs a ladder.
//   the triptych     the friska (the fast half): three upright windows side by side, low strings left, violins centre,
//                    winds and the cimbalom right, staggered by register (left lower, right higher). Each window lights on
//                    its own notes and dims to a floor in its rests (an intensity curve made from its set), so the tune runs
//                    from window to window: the cat-and-mouse chase. These windows are turned -90 deg too (found in the
//                    first preview: unturned, a single line's row of dancers was cut off at the window's sides; turned,
//                    every strand stands as a pitch ladder, low notes at the bottom, and chords still pick formations).
//   the altarpiece   the stomping tutti: the triptych over a PREDELLA (a long low strip, as under an altarpiece) that tolls
//                    with the Bb0/C#1 deep tolls. The stomp's chords are split by register across the three windows, so one
//                    chord lands as a single stroke across the whole polyptych.
//   the round window the violins' whirl at the top (500-510 s), with Fischinger's scatter at 1 (the knob: fast notes make the
//                    figure bloom and turn).
//   the plunge       534-539 s: the run falling to C1 split by register across a staggered triptych, so it drops from
//                    window to window, right to left. These three are NOT turned, so the low bars lie flat as they fall.
//   the grid         the loudest stomp (539-570 s): six windows in unison, every other one turned upside down (rot 180), a
//                    kaleidoscope of one figure hammered six times: the frenzy.
//   black            every true silence: 0-3.37, 92.6-93.7 (the break-off), 251.5-253, 361.5-363.4 (the grand pause),
//                    619.6-620.4 (the rest before the last blow), and after the decay. Fischinger repaints its blue every
//                    frame, so a window is only ever open while its music sounds; each opens on its strand's first note.
//
// Knobs (our defaults everywhere else): scatter 1 in the whirl and the fireworks (flung notes); life 8 on the last blow (the ff
// chord is held 4 s with no new attack: its dancers must stay lit, nothing new may land). The three notes a transcriber put
// inside that held chord (622.4-623.3 s) are dropped, so nothing looks like a new blow. The clarinet's notes in the slit are
// heard x1.4-1.5 (pick intensity): at their own pp velocities they drifted in too small to read in a narrow window. The stomp
// (481-500 s) takes its chords from the pack's notes (attacks of 3+ notes reaching velocity 85), since its pick set keeps only
// two notes a blow; split by register they still give every window a loud stroke.
//
// Run: node docs/compositions/classical/liszt-hungarian-2/build-liszt-hungarian-2-c-optical-poem.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'liszt-hungarian-2-c-optical-poem', SONG = 'liszt-hungarian-2';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const r3 = (t) => Math.round(t * 1000) / 1000;

/** Notes of set id with a start in [a, b). */
const sel = (id, a = -1, b = 1e9, f = () => true) => {
  if (!P[id]) throw new Error(`no set ${id}`);
  return P[id].notes.filter((n) => n[0] >= a && n[0] < b && f(n)).map((n) => n.slice(0, 4));
};
/** Merged, sorted, one note per pitch per 40 ms. */
const merge = (...lists) => {
  const all = lists.flat().sort((x, y) => x[0] - y[0] || x[2] - y[2]), out = [];
  for (const n of all) if (!out.some((o) => o[2] === n[2] && Math.abs(o[0] - n[0]) < 0.04)) out.push(n);
  return out;
};
/** Every note heard at velocity x k (the pick's intensity): the pp clarinet in the slit would otherwise drift in too small
    and pale to read in a narrow window. */
const boost = (notes, k) => notes.map((n) => [n[0], n[1], n[2], n[3], k]);
/** The tutti's real chords, from the pack's notes (the pick sets keep 2 notes a blow): attacks (notes within 40 ms) of at
    least minN notes reaching velocity minV. */
const PACK = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8')).notes;
const packChords = (a, b, minN = 3, minV = 85) => {
  const at = [];
  for (const n of PACK) {
    if (n[0] < a || n[0] >= b) continue;
    const l = at[at.length - 1];
    if (l && n[0] - l[0][0] < 0.04) l.push(n.slice(0, 4)); else at.push([n.slice(0, 4)]);
  }
  return at.filter((c) => c.length >= minN && Math.max(...c.map((n) => n[3])) >= minV).flat();
};

// ---------- the windows (screen fractions) ----------
const W = 1280, H = 720;
/** An upright or lying window, in screen fractions. rot -90: a lying band turned upright (its row of dancers becomes a
    column, low notes at the bottom); then w/h are the band's own unrotated size. */
const win = (x, y, ws, hs, o = {}) => {
  const r = { mode: 'window', shape: o.shape ?? 'rect', x, y, w: ws, h: hs, feather: o.feather ?? 0, blend: o.blend ?? 'over', fit: 'cover' };
  if (o.rot === -90 || o.rot === 90) { r.w = r3(hs * H / W); r.h = r3(ws * W / H); r.rot = o.rot; }
  else if (o.rot) r.rot = o.rot;
  return r;
};
const FULL = undefined;
// the lassan's panel: three full-screen copies by register (BAND keeps its old name: low, mid, top)
// The lassan is ONE blue panel (the cast's own wording): each strand is a full-screen Fischinger, laid over the others with
// 'lighten', so their figures share one deep blue. Each is shifted and scaled by register so it still covers the whole
// screen: the low strings' copy is 1.32x and sunk (its big bars stand in the lower third), the singing line sits in the
// middle at 1x, the violins' copy is raised. Their three grounds merge into one, a little brighter where they meet.
const OVER = { blend: 'lighten' };
const BAND = { low: win(0.5, 0.66, 1.32, 1.32, OVER), mid: win(0.5, 0.5, 1, 1, OVER), top: win(0.5, 0.32, 1.36, 1.36, OVER) };
// The slit: a band turned upright, long enough (1.78 of the height, cut by the stage's edges) that the canvas is fitted at
// full scale: the clarinet's dancers are as big as anywhere else, in a 28 %-wide shaft of blue from top to bottom.
const SLIT = win(0.5, 0.5, 0.28, 1.78, { rot: -90 });
// the friska triptych, staggered by register; UP = the same windows turned (rows stand upright)
const TRI = { left: win(0.17, 0.54, 0.32, 0.82), mid: win(0.5, 0.5, 0.31, 0.9), right: win(0.83, 0.46, 0.32, 0.82) };
const TRI_UP = { left: win(0.17, 0.54, 0.32, 0.82, { rot: -90 }), mid: win(0.5, 0.5, 0.31, 0.9, { rot: -90 }), right: win(0.83, 0.46, 0.32, 0.82, { rot: -90 }) };
const UP = { rot: -90 };
const ALTAR = { left: win(0.17, 0.375, 0.32, 0.65, UP), mid: win(0.5, 0.375, 0.31, 0.65, UP), right: win(0.83, 0.375, 0.32, 0.65, UP), predella: win(0.5, 0.855, 0.98, 0.21) };
const SMALL = { left: win(0.26, 0.5, 0.22, 0.5, UP), mid: win(0.5, 0.5, 0.22, 0.5, UP), right: win(0.74, 0.5, 0.22, 0.5, UP) };
const ROUND = win(0.5, 0.5, 0.5, 0.889, { shape: 'ellipse' });
const GRID = [];
for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++)
  GRID.push(win([0.17, 0.5, 0.83][col], [0.255, 0.745][row], 0.32, 0.47, { rot: (row + col) % 2 ? 180 : 0 }));

// ---------- the clips ----------
const clips = [], picks = {};
/** A window: opens on its set's first note (lead s before it) unless start is given, closes at end. */
function clip({ name, start, end, region, notes, knobs, fade = 0.12, intensity, moves, lead = 0.06, set }) {
  notes = merge(...notes).filter((n) => n[0] < end - 0.05);
  if (!notes.length) throw new Error(`${name}: no notes`);
  const s = r3(start ?? notes[0][0] - lead);
  notes = notes.filter((n) => n[0] >= s);
  const sid = set ?? name;
  if (!picks[sid]) picks[sid] = { notes };
  else picks[sid].notes = merge(picks[sid].notes, notes);
  const c = { id: name, start: s, end: r3(end), fade, widget: 'fischinger', listen: `picks:${sid}` };
  if (knobs) c.knobs = knobs;
  if (region) c.region = region;
  const iv = typeof intensity === 'function' ? intensity(c, notes) : intensity;
  if (iv) c.intensity = iv.map(([t, v, shape]) => ({ t: r3(Math.min(c.end, Math.max(c.start, t))), v, ...(shape ? { shape } : {}) }))
    .filter((p, i, a) => i === 0 || p.t > a[i - 1].t);
  if (moves) c.intensityMoves = 'present';
  clips.push(c);
  return c;
}
/** The chase: full while the window's notes play, eased to a floor in rests longer than ~3 s. */
const chase = (floor = 0.3, gap = 3.2) => (c, notes) => {
  const cl = [];
  for (const n of notes) {
    const last = cl[cl.length - 1];
    if (last && n[0] - last[1] < gap) last[1] = Math.max(last[1], n[0]); else cl.push([n[0], n[0]]);
  }
  const pts = [];
  cl.forEach(([a, b], i) => {
    if (a - c.start > 0.7) { pts.push([a - 0.6, floor]); pts.push([a - 0.08, 1]); } else pts.push([c.start, 1]);
    pts.push([b + 0.7, 1, 'ease']);
    if (i < cl.length - 1 || b + 2.4 < c.end) pts.push([b + 2.4, floor]);
  });
  return pts;
};

// ===== LASSAN =====
// S1 Lento I: the declamation, full screen (proclamations, knocks, deep strokes).
clip({ name: 'lento-1', end: 41.15, region: FULL,
  notes: [sel('lento-proclamations'), sel('lento-knocks', 0, 41), sel('lento-strokes', 0, 41)], lead: 0.03,
  intensity: [[39.9, 1], [41.15, 0.6]] });
// S2-S3 the lassan builds from the bottom: cellos alone in the sunk low copy, the strings' theme in the middle at the sudden f,
// the violins on top as they climb; all three become one screen at the ff.
clip({ name: 'lassan-low-1', start: 41.15, end: 88.3, region: BAND.low,
  notes: [sel('lassan-theme-cellos'), sel('lassan-bass', 41, 88.3), sel('cello-line', 56, 88.3)] });
clip({ name: 'lassan-mid-1', end: 88.3, region: BAND.mid, notes: [sel('lassan-theme-strings', 56, 88.3)], lead: 0.08 });
clip({ name: 'lassan-top-1', end: 88.3, region: BAND.top, notes: [sel('violin-line', 79.3, 88.3)] });
clip({ name: 'lassan-ff-1', start: 88.28, end: 92.6, region: FULL, fade: 0.08,
  notes: [sel('lassan-ff-peaks', 88, 93), sel('lassan-theme-strings', 88, 93), sel('violin-line', 88, 93), sel('lassan-bass', 88, 93)] });
// S4 clarinet cadenza I and the hush: the slit.
clip({ name: 'cadenza-1', end: 103.95, region: SLIT, notes: [boost(sel('clarinet-cadenza-1'), 1.5), boost(sel('cadenza-hush-knocks'), 1.5)], lead: 0.1 });
// S5-S7 interlude and dance: the singing line in the middle copy from the G# taps through the dance; the clarinet's garlands,
// the glitter and the high shake each open the raised copy; the G#2 drone the low copy.
clip({ name: 'interlude-mid', end: 159.6, region: BAND.mid, notes: [sel('gsharp-repeats'), sel('interlude-line'), sel('dance-lilt')],
  intensity: [[158.9, 1], [159.6, 0.5]] });
clip({ name: 'garlands-top', end: 125.6, region: BAND.top, notes: [sel('clarinet-garlands')], lead: 0.1 });
clip({ name: 'dance-low', end: 159.6, region: BAND.low, notes: [sel('dance-pedal')] });
clip({ name: 'glitter-top', end: 149.2, region: BAND.top, notes: [sel('glitter-1')] });
clip({ name: 'shake-top', end: 166.95, region: BAND.top, notes: [sel('high-alternation')] });
clip({ name: 'sinking-slit', end: 174.3, region: SLIT, notes: [boost(sel('clarinet-sinking'), 1.4)], intensity: [[172.6, 1], [174.3, 0.4]] });
// S8 Lento II: full screen again (a part that returns gets its picture back).
clip({ name: 'lento-2', end: 212.45, region: FULL,
  notes: [sel('lento-proclamations-return'), sel('lento-knocks', 170, 213), sel('lento-strokes', 170, 213)], lead: 0.04 });
// S9 the lassan returns, built from the bottom again; S10 the climax strokes full screen, cut off into silence.
clip({ name: 'lassan-low-2', start: 212.45, end: 246.55, region: BAND.low, notes: [sel('lassan-bass', 212, 246.55), sel('cello-line', 212, 246.55)] });
clip({ name: 'lassan-mid-2', start: 212.45, end: 246.55, region: BAND.mid, notes: [sel('lassan-theme-return')] });
clip({ name: 'lassan-top-2', end: 246.55, region: BAND.top, notes: [sel('lassan-ff-peaks', 236, 246.55), sel('violin-line', 236, 246.55)] });
clip({ name: 'climax', start: 246.55, end: 251.55, region: FULL, fade: 0.06, notes: [sel('climax-strokes')] });
// S11 clarinet cadenza II: the slit, fading into the hush.
clip({ name: 'cadenza-2', end: 264.4, region: SLIT, notes: [boost(sel('clarinet-cadenza-2'), 1.5)], lead: 0.1, intensity: [[262.3, 1], [264.4, 0.35]] });
// S12 the A-major song: the song in the middle, its soft bass below, the harp on top.
clip({ name: 'song-mid', end: 307.15, region: BAND.mid, notes: [sel('a-major-song')], lead: 0.1 });
clip({ name: 'song-low', end: 307.15, region: BAND.low, notes: [sel('a-major-bass')] });
clip({ name: 'harp-top', end: 304.6, region: BAND.top, notes: [sel('harp-arpeggio')] });
// S13-S14 the dissolve and the C# swell: the sunk low copy alone, on the whole blue, thinning (its curve moves how present: shapes sink back sooner,
// fewer echoes), swelling with the C#, gone at the grand pause.
clip({ name: 'dissolve-low', start: 307.12, end: 361.5, region: BAND.low, fade: 0.4, moves: true,
  notes: [sel('dissolve-murmur'), sel('dissolve-audio'), sel('dominant-swell')],
  intensity: [[307.12, 1], [322, 0.75], [344, 0.35], [355.4, 0.4], [357.5, 1, 'ease'], [361, 0.5]] });

// ===== FRISKA =====
// S15-S16 dawn: the winds' window alone; the violins take the tune in the centre, the oom-pah bass on the left.
clip({ name: 'friska-winds-1', end: 410.62, region: TRI_UP.right, notes: [sel('friska-dawn'), sel('cimbalom-tremolo', 400, 410.62)], intensity: chase(0.3) });
clip({ name: 'friska-violins-1', end: 410.62, region: TRI_UP.mid, notes: [sel('friska-strings-theme')], intensity: chase(0.3) });
clip({ name: 'friska-bass-1', end: 410.62, region: TRI_UP.left, notes: [sel('friska-vamp-bass', 386, 410.62)], intensity: chase(0.3) });
// S17 the first friska tutti: one screen.
clip({ name: 'tutti-1', start: 410.62, end: 421.2, region: FULL, fade: 0.06, notes: [sel('tutti-1-blows'), sel('deep-tolls', 410, 421.2)] });
// S18-S19 the F# major tune and the second build: the triptych again (the oom-pah and its off-beat chords left, the violins
// centre, the glitter and the falling wind line right).
clip({ name: 'friska-bass-2', end: 480.6, region: TRI_UP.left, notes: [sel('friska-vamp-bass', 421, 481), sel('friska-offbeats'), sel('dominant-pedal')], intensity: chase(0.3) });
clip({ name: 'friska-violins-2', end: 480.6, region: TRI_UP.mid, notes: [sel('friska-violins', 421, 481), sel('friska-tune'), sel('build-2-line')], intensity: chase(0.3) });
clip({ name: 'friska-winds-2', end: 455.4, region: TRI_UP.right, notes: [sel('glitter-2'), sel('voice-line-friska')], intensity: [[452.6, 1], [455.4, 0.3]] });
// S20 the stomp: the altarpiece. Its chords split by register across the three windows; the deep tolls in the predella.
const stomp = merge(packChords(481.3, 500.45), sel('stomp-blows'), sel('brass-descents', 480, 500.5));
clip({ name: 'stomp-low', end: 500.45, region: ALTAR.left, notes: [stomp.filter((n) => n[2] < 55 && n[2] > 37)] });
clip({ name: 'stomp-mid', end: 500.45, region: ALTAR.mid, notes: [sel('friska-violins', 480, 500.45), stomp.filter((n) => n[2] >= 55 && n[2] < 74)] });
clip({ name: 'stomp-high', end: 500.45, region: ALTAR.right, notes: [stomp.filter((n) => n[2] >= 74)], intensity: chase(0.35) });
clip({ name: 'stomp-tolls', end: 500.45, region: ALTAR.predella, notes: [sel('deep-tolls', 480, 500.45), stomp.filter((n) => n[2] <= 37)] });
// S21 the high whirl: the round window, scatter 1.
clip({ name: 'whirl', end: 510.3, region: ROUND, notes: [sel('high-whirl')], knobs: { scatter: 1 } });
// S22 the dip: a small triptych (sudden p), the murmured tune in the centre, the pulse left, the cimbalom shimmer right.
clip({ name: 'dip-tune', end: 526.6, region: SMALL.mid, notes: [sel('friska-violins', 510, 527), sel('dip-line')] });
clip({ name: 'dip-pulse', end: 526.6, region: SMALL.left, notes: [sel('repeats', 510, 527)] });
clip({ name: 'dip-cimbalom', end: 524.8, region: SMALL.right, notes: [sel('cimbalom-tremolo', 520, 525)] });
// S23 the fireworks: one screen, scatter 1; then the plunge falls from window to window, right to left.
clip({ name: 'fireworks', end: 534.33, region: FULL, notes: [sel('fireworks')], knobs: { scatter: 1 }, lead: 0.05 });
clip({ name: 'plunge-high', end: 539.28, region: TRI.right, notes: [sel('plunge', 534, 539.28, (n) => n[2] >= 40)], lead: 0.04 });
clip({ name: 'plunge-mid', end: 539.28, region: TRI.mid, notes: [sel('plunge', 534, 539.28, (n) => n[2] >= 31 && n[2] < 40), sel('deep-tolls', 534, 539.28, (n) => n[2] >= 31)] });
clip({ name: 'plunge-low', end: 539.28, region: TRI.left, notes: [sel('plunge', 534, 539.28, (n) => n[2] < 31), sel('deep-tolls', 534, 539.28, (n) => n[2] < 31)] });
// S24 the loudest stomp: six windows in unison, a kaleidoscope.
const loud = [sel('loudest-stomp-blows'), sel('deep-tolls', 539.28, 570.45), sel('stomp-bursts'), sel('brass-descents', 539, 571),
  sel('friska-violins', 539.28, 570.45), sel('plunge', 539.28, 540)];
GRID.forEach((g, i) => clip({ name: `grid-${i + 1}`, start: 539.28, end: 570.45, region: g, notes: loud, set: 'loudest-stomp-unison', fade: 0.06 }));
// S25 the high tremolo dying away: the slit (where a cadenza would go), thinning.
clip({ name: 'tremolo-slit', end: 584.15, region: SLIT, notes: [sel('high-tremolo')], intensity: [[571.5, 1], [583.6, 0.4, 'ease']] });
// S26-S27 the prestissimo and the stretta: the polyptych folds back into ONE panel, the lassan's layered blue. The C#3 pulse
// (with the stretta's bass and the tolls) in the sunk low copy, the A4/B4-C#5 alternations (with the chords' middle) in
// the middle copy; the stretta's hammered top (B5/C#5/Bb5) opens the raised copy as the chords climb to ff. Then the rest,
// black.
const fin = merge(sel('stretta-chords'), sel('final-chords', 600, 619.62));
clip({ name: 'presto-low', end: 619.62, region: BAND.low, fade: 0.08,
  notes: [sel('prestissimo-bass'), fin.filter((n) => n[2] < 55), sel('deep-tolls', 600, 619.62)] });
clip({ name: 'presto-mid', end: 619.62, region: BAND.mid, fade: 0.08,
  notes: [sel('prestissimo-repeats'), fin.filter((n) => n[2] >= 55 && n[2] < 74)] });
clip({ name: 'presto-top', end: 619.62, region: BAND.top, fade: 0.08, notes: [fin.filter((n) => n[2] >= 74)] });
// S28 the last blow, held: a fresh screen exactly on the Bb0/A1 blow, life 8 so the held chord stays lit with no new attack.
clip({ name: 'last-blow', start: 620.46, end: 628.6, region: FULL, fade: 0.04, knobs: { life: 8 },
  notes: [sel('final-chords', 620.4, 629, (n) => n[0] < 621 || n[0] > 624.5), sel('deep-tolls', 620.4, 629)],
  intensity: [[627.3, 1], [628.6, 0, 'ease']] });

// ---------- tracks: the first free one, in start order ----------
clips.sort((a, b) => a.start - b.start);
const busy = [];
for (const c of clips) {
  let t = 0;
  while ((busy[t] ?? -1) > c.start + 0.0005) t++;
  c.track = t; busy[t] = c.end;
}
const out = clips.map((c) => ({ id: c.id, start: c.start, end: c.end, track: c.track, fade: c.fade, widget: c.widget, listen: c.listen,
  ...(c.knobs ? { knobs: c.knobs } : {}), ...(c.region ? { region: c.region } : {}), ...(c.intensity ? { intensity: c.intensity } : {}),
  ...(c.intensityMoves ? { intensityMoves: c.intensityMoves } : {}) }));
const show = {
  version: 3, id: ID, song: SONG,
  title: 'Liszt: Hungarian Rhapsody No. 2 · C · Optical poem: Fischinger alone as a polyptych of windows, one strand per window (one layered blue panel for the lassan and the stretta, a slit for each cadenza, a triptych chase for the friska, an altarpiece, a six-fold kaleidoscope for the loudest stomp, one screen for every tutti)',
  composer: { by: 'claude', at: '2026-11-06T18:00:00.000Z' },
  clips: out, picks,
};
// one note a line, as the studio writes it
let json = JSON.stringify(show, null, 2);
json = json.replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+([-\d.]+),\s+([-\d.]+)\s+\]/g, '[$1, $2, $3, $4]');
writeFileSync(join(ROOT, `shows/${ID}.json`), json + '\n');
const maxAt = (t) => out.filter((c) => c.start <= t && c.end > t).length;
let peak = 0; for (let t = 0; t < 631; t += 0.05) peak = Math.max(peak, maxAt(t));
console.log(`${out.length} clips, ${Object.keys(picks).length} pick sets, ${Object.values(picks).reduce((a, s) => a + s.notes.length, 0)} notes, at most ${peak} at once, tracks ${Math.max(...out.map((c) => c.track)) + 1}`);
