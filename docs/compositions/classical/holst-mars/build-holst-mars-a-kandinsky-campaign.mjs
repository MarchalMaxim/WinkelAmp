// Builds shows/holst-mars-a-kandinsky-campaign.json from picks.json (this folder; made by gen-picks.mjs).
// Run: node docs/compositions/classical/holst-mars/build-holst-mars-a-kandinsky-campaign.mjs
// then: npm run check-show -- shows/holst-mars-a-kandinsky-campaign.json
//
// THE CONCEPT. Kandinsky's plane is the army on the march: every note it hears paints (heavy black bars low, blue circles
// in the middle, yellow triangles high). Under it, dread squares hammer the 5/4 ostinato; over it, brass gust wedges burst
// on the brass; at the dissonant climaxes the casket melts the painting and pixel sort pulls the melt into sheets.
//
// THE STORY TOLD WITH PLACES (the serendipitous part, see the legend at the bottom):
// - The army approaches. The ostinato's squares start as a tiny copy of themselves low on the horizon (a window 20% of the
//   screen) and the window grows at every turn of the opening (20.6, 37.0, 48.6 s) until, at the brass chords (57.4 s),
//   the squares fill the screen. Kandinsky's army grows with it (its how-present curve rises from 0.1 to 1 at the climax).
// - The machine. In the hammered episode the Db chords sort the picture only inside a horizontal belt (a mask): an
//   assembly line through the painting.
// - No bass (164.9 s). The squares stop because the bass stops, so Kandinsky paints only yellow triangles, and pixel
//   sort, listening to the high repeats, pulls their brightest bits upward: the picture lifts.
// - The general pause is black. Then the strongest blow of the piece (186.43 s) is one brass gust, alone, crossing the black.
// - The tenor tuba (197-215 s) paints a small Kandinsky alone in the dark: a framed picture, note by note.
// - The hush (387-392 s): the ostinato's G2 comes back far away, in the same small window as at the start.
// - The end: squares alone, each hammer blow a bigger slab (per-note size 1.1 to 1.8), the last chord five slabs, then black.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'holst-mars-a-kandinsky-campaign', SONG = 'holst-mars';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const r3 = (v) => Math.round(v * 1000) / 1000;

const notesOf = (id) => { if (!P[id]) throw new Error(`no set ${id}`); return P[id].notes.map((n) => [...n]); };
/** Several sets as one strand: sorted by start, a note heard twice (same start and pitch) kept once. */
function merge(...lists) {
  const seen = new Set(), out = [];
  for (const n of lists.flat()) { const k = `${n[0]}|${n[2]}`; if (!seen.has(k)) { seen.add(k); out.push(n); } }
  return out.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
}
/** A note with values (the fifth place): a lone intensity is a plain number, otherwise an object with sorted keys. */
function withValues(n, values) {
  const v = Object.fromEntries(Object.entries(values).filter(([k, x]) => !(k === 'intensity' && x === 1)).sort(([a], [b]) => a.localeCompare(b)));
  const keys = Object.keys(v);
  if (!keys.length) return n.slice(0, 4);
  return [...n.slice(0, 4), keys.length === 1 && keys[0] === 'intensity' ? v.intensity : v];
}

// ---- the strands (pick sets) this show uses -------------------------------------------------------------------------
const S = {};
// the 5/4 ostinato of the opening: audio onsets where the roll is empty, the roll's strokes, then the cellos into the climax
S['ostinato-1'] = merge(notesOf('ostinato-opening'), notesOf('cello-ostinato-2'));
S['pedal-bass'] = notesOf('pedal-bass');
S['ostinato-second'] = notesOf('ostinato-second');
S['dying-throb'] = notesOf('dying-throb');
S['middle-bass'] = notesOf('middle-bass');
S['recap-bass'] = notesOf('recap-bass');
S['ostinato-canon'] = notesOf('ostinato-canon');
// the last build's low half: the C3 pedal strokes and the F3/G3 rocking (its cries go to the brass)
S['final-build-low'] = notesOf('final-build').filter((n) => n[2] <= 55);
S['climax-pileup'] = notesOf('climax-pileup');
S['aftermath-held'] = notesOf('aftermath-held').map((n) => withValues(n, { intensity: 1.4 }));
// the ostinato's G2 in the hush, far away again
S['hush-g2'] = notesOf('hush-rise').filter((n) => n[2] <= 45 && n[0] < 392.6);
// the end, squares alone: the seven blows grow (size read at the attack), their echoes and the hammered G are smaller
{
  const blowSize = { 396.504: 1.1, 399.15: 1.2, 401.33: 1.3, 405.28: 1.5, 409.6: 1.65, 412.69: 1.8 };
  const size = (t) => { for (const [k, v] of Object.entries(blowSize)) if (Math.abs(t - Number(k)) < 0.06) return v; return null; };
  S['end-blows'] = merge(
    notesOf('final-blows').filter((n) => n[0] < 415).map((n) => withValues(n, { size: size(n[0]) ?? 1.2 })),
    notesOf('blow-echoes').map((n) => withValues(n, { size: 0.8 })),
    notesOf('pesante-g').map((n) => withValues(n, { size: 0.45 })),
  );
}
S['last-chord'] = notesOf('last-chord');
// the tenor tuba, soft (v17-55): heard 1.8 times as loud so its shapes are big enough to read
S['tuba-theme'] = notesOf('tuba-theme').map((n) => withValues(n, { intensity: 1.8 }));
// the brass, first statement: the horns' creeping theme, the chord-tops of the swell, the swell after the dip, the brass
// chords into the climax, the climax itself (its two blocks are the loudest attacks here: the only full blasts)
S['brass-1'] = merge(notesOf('theme-creep'), notesOf('theme-swell'), notesOf('brass-swell-65'), notesOf('brass-chords-1'), notesOf('climax-1'));
S['high-blasts'] = notesOf('high-blasts');
S['unison-calls'] = notesOf('unison-calls');
// the ff Eb blow after the general pause (heard 1.3 times as loud: the one full blast of this strand), its low rumble, the calls
S['brass-2'] = merge(
  notesOf('ff-blow-186').map((n) => (n[0] < 186.5 ? withValues(n, { intensity: 1.3 }) : n)),
  notesOf('trumpet-calls'),
);
S['brass-tenor-line'] = notesOf('brass-tenor-line');
// the last build's cries, the pile-up, the grinding aftermath, the run up to G5
S['brass-3'] = merge(
  notesOf('final-build').filter((n) => n[2] >= 58),
  notesOf('climax-pileup'), notesOf('aftermath-held'),
  notesOf('hush-rise').filter((n) => n[0] >= 393.2),
);
S['climax-1'] = notesOf('climax-1');
S['strike-131'] = notesOf('strike-131');
S['chord-hammer'] = notesOf('chord-hammer');
S['high-repeats'] = notesOf('high-repeats');
// the C minor wall at 293.00 s: one 17-note attack of the pack (the roll's lanes miss it)
S['wall-293'] = pack.notes.filter((n) => n[0] >= 292.98 && n[0] < 293.03).map((n) => [n[0], n[1], n[2], n[3]]);
S['recap-blocks-wall'] = merge(notesOf('recap-blocks'), S['wall-293']);
S['pileup-aftermath'] = merge(notesOf('climax-pileup'), notesOf('aftermath-held'));
S['middle-chords'] = notesOf('middle-chords');
S['canon-blocks'] = notesOf('canon-blocks');

// ---- places ---------------------------------------------------------------------------------------------------------
/** A small copy of the widget's own picture, as a 16:9 window w wide, centred at (x, y): the army seen from far. */
const far = (x, y, w) => ({ mode: 'window', shape: 'rect', x, y, w, h: w, feather: 0.12, fit: 'contain' });

// ---- tracks, bottom to top ------------------------------------------------------------------------------------------
const T = { ground: 0, squares: 1, last: 2, kandinsky: 3, frame: 4, gust: 5, casket: 6, pixelsort: 7 };

const clips = [];
let n = 0;
function clip({ start, end, widget, set, knobs, region, curve, present, fade, track }) {
  const c = { id: `c${++n}`, start: r3(start), end: r3(end), track: track ?? T[widget], widget };
  if (fade !== undefined) c.fade = fade;
  if (set) { if (!S[set]) throw new Error(`no strand ${set}`); c.listen = `picks:${set}`; }
  if (knobs) c.knobs = knobs;
  if (region) c.region = region;
  if (curve) { c.intensity = curve.map(([t, v, shape]) => (shape ? { t, v, shape } : { t, v })); if (present) c.intensityMoves = 'present'; }
  clips.push(c);
  return c;
}

// SQUARES: the ostinato. The army approaching: a far window that grows at every turn of the opening.
// in a window the squares are scaled with it: bigger squares that stay a little longer, so the far column reads
const sqFar = { size: 1.6, life: 2 };
clip({ start: 7.0, end: 20.6, widget: 'squares', set: 'ostinato-1', knobs: sqFar, region: far(0.5, 0.74, 0.2), fade: 2 });
clip({ start: 20.6, end: 37.0, widget: 'squares', set: 'ostinato-1', knobs: sqFar, region: far(0.5, 0.67, 0.36), fade: 0.4 });
clip({ start: 37.0, end: 48.6, widget: 'squares', set: 'ostinato-1', knobs: { size: 1.4 }, region: far(0.5, 0.6, 0.54), fade: 0.4 });
clip({ start: 48.6, end: 57.4, widget: 'squares', set: 'ostinato-1', knobs: { size: 1.2 }, region: far(0.5, 0.54, 0.76), fade: 0.4 });
clip({ start: 57.4, end: 83.6, widget: 'squares', set: 'ostinato-1', fade: 0.4 });
clip({ start: 83.6, end: 131.0, widget: 'squares', set: 'pedal-bass', knobs: { presence: 0.65 }, fade: 0.4 });
clip({ start: 131.5, end: 164.95, widget: 'squares', set: 'ostinato-second', fade: 0.6 });
clip({ start: 189.4, end: 197.6, widget: 'squares', set: 'dying-throb', knobs: { size: 1.2, blur: 1.6 }, region: far(0.5, 0.62, 0.42), fade: 0.6 });
clip({ start: 213.0, end: 256.6, widget: 'squares', set: 'middle-bass', knobs: { presence: 0.55 }, fade: 1 });
clip({ start: 256.6, end: 303.9, widget: 'squares', set: 'recap-bass', fade: 0.3 });
clip({ start: 303.9, end: 343.6, widget: 'squares', set: 'ostinato-canon', knobs: { presence: 0.75 }, fade: 0.5 });
clip({ start: 343.6, end: 358.85, widget: 'squares', set: 'final-build-low', fade: 0.3 });
clip({ start: 358.85, end: 367.3, widget: 'squares', set: 'climax-pileup', knobs: { size: 1.6, life: 4 }, fade: 0.3 });
clip({ start: 386.7, end: 392.6, widget: 'squares', set: 'hush-g2', knobs: sqFar, region: far(0.5, 0.74, 0.2), fade: 0.8 });
clip({ start: 396.35, end: 415.6, widget: 'squares', set: 'end-blows', knobs: { life: 1.6 }, fade: 0.1 });
clip({ start: 415.6, end: 421.9, widget: 'squares', set: 'last-chord', knobs: { size: 2, life: 4 }, fade: 0.15, track: T.last });

// KANDINSKY: the army, every note, its how-present curve the size of the army.
clip({ start: 20.4, end: 185.6, widget: 'kandinsky', fade: 0.6, present: true, curve: [
  [20.6, 0.1], [37, 0.2], [48.6, 0.3], [57.4, 0.55], [67.7, 0.65], [80.8, 1], [84, 0.9], [130.9, 0.9], [131.6, 0.65], [164.9, 0.75], [185.6, 0.8]] });
// the tenor tuba: a small painting alone in the dark
// paint 1: every tuba note stays painted for seconds; web 0.8: its notes joined in time, the tuba line drawn as a line;
// restless 0: a composed picture, not a scatter
clip({ start: 197.0, end: 215.6, widget: 'kandinsky', set: 'tuba-theme', knobs: { paint: 1, web: 0.8, restless: 0 }, fade: 1.2, track: T.frame });
// CRITIC: the eye of the storm. The tuba is almost all below Kandinsky's bar split, so its notes are black bars, and black
// bars on the dark floor (or in a see-through window) vanish. Under it, once the Eb blow's burn has died into the drone,
// a Sugimoto fog rises: the only light ground of the show, so the tuba's black weights read as Kandinsky painted them,
// black on a pale plane. Low contrast and presence (an ominous fog, not a bright seascape); it fades in over the drone
// (193.5-197.5, no note starts it) and back out as the calls begin (212.8-216), so it is a change of state, not an event.
clip({ start: 193.5, end: 216.0, widget: 'horizon', knobs: { contrast: 0.15, soft: 0.8, shimmer: 0.4, colour: 0.25, presence: 0.75 }, fade: 3.2, track: T.ground });
// the aftermath: the six grinding held chords as big shapes that stay (paint 1), the circles turned red (midColour 2.4):
// the army's plane, burnt, after the pile-up
clip({ start: 366.9, end: 392.6, widget: 'kandinsky', set: 'aftermath-held', knobs: { paint: 1, midColour: 2.4 }, fade: 1, track: T.frame });
clip({ start: 212.8, end: 396.4, widget: 'kandinsky', fade: 0.5, present: true, curve: [
  [212.8, 0.3], [240, 0.45], [256.6, 1], [303.9, 0.7], [343.6, 0.8], [358.9, 1], [367, 0.6], [380, 0.35], [392.6, 0.6], [396.4, 0.7]] });

// GUST: the brass.
clip({ start: 8.0, end: 84.05, widget: 'gust', set: 'brass-1', fade: 1.5, present: true, curve: [
  [8, 0.12], [20.6, 0.2], [48.6, 0.35], [57.4, 0.6], [80.8, 1]] });
clip({ start: 84.05, end: 131.0, widget: 'gust', set: 'high-blasts', knobs: { presence: 0.8 }, fade: 0.4 });
clip({ start: 131.0, end: 185.6, widget: 'gust', set: 'unison-calls', knobs: { presence: 0.6, linger: 1.6 }, fade: 0.6 });
clip({ start: 186.25, end: 257.0, widget: 'gust', set: 'brass-2', fade: 0.15, present: true, curve: [
  [186.25, 1], [190, 0.6], [197, 0.25], [213, 0.5], [240, 0.7], [256.6, 0.9]] });
clip({ start: 257.0, end: 343.6, widget: 'gust', set: 'brass-tenor-line', fade: 0.4, present: true, curve: [
  [257, 0.75], [284, 1], [296, 1], [304, 0.6], [343.6, 0.7]] });
clip({ start: 343.6, end: 367.0, widget: 'gust', set: 'brass-3', fade: 0.4, present: true, curve: [
  [343.6, 0.7], [358.9, 1], [367, 0.6]] });
// CRITIC: the aftermath's smoke. The grinding held chords leave the air full of dashes (air 1, by hand) and only puffs
// (power 0.2): burnt smoke for the casket to melt, instead of an empty plane.
clip({ start: 367.0, end: 392.6, widget: 'gust', set: 'brass-3', knobs: { air: 1, power: 0.2, reach: 0.6, linger: 2.4 }, fade: 0.6 });
clip({ start: 392.6, end: 396.4, widget: 'gust', set: 'brass-3', fade: 0.3 });

// CASKET: the dissonant climaxes and the blows that end an episode.
clip({ start: 80.4, end: 84.0, widget: 'casket', set: 'climax-1', fade: 0.2 });
clip({ start: 130.9, end: 133.0, widget: 'casket', set: 'strike-131', fade: 0.1 });
clip({ start: 292.7, end: 296.0, widget: 'casket', set: 'wall-293', fade: 0.1 });
// the pile-up is held and grinding: keep melting between (keep 1), the one place the casket never lets go
// CRITIC: and it keeps melting through the aftermath (to the hush at 386.7): the burnt plane slides down while the
// grinding chords fall from -9 to -16 dB; it drips on the held chords' attacks (real ones) and stops with the hush.
clip({ start: 358.6, end: 386.7, widget: 'casket', set: 'pileup-aftermath', knobs: { keep: 1 }, fade: 1.5 });
// the last chord, held ff for six seconds: its five slabs melt down the screen (keep 1) until the cut, then black
clip({ start: 415.6, end: 421.85, widget: 'casket', set: 'last-chord', knobs: { keep: 1 }, fade: 0.1 });
// CRITIC: the chord is held ff for six seconds and the slabs are gone in four. Kandinsky comes back for this one chord,
// at full paint (its shapes stay 7-9 s): the army's last figure, red like the slabs (midColour 2), still (restless 0),
// melting under the casket, cut with the orchestra at 421.85.
clip({ start: 415.6, end: 421.85, widget: 'kandinsky', set: 'last-chord', knobs: { paint: 1, midColour: 2, restless: 0, web: 0.3 }, fade: 0.1, track: T.frame });

// PIXEL SORT: pulls the melt into sheets.
clip({ start: 80.4, end: 84.0, widget: 'pixelsort', set: 'climax-1', fade: 0.2 });
// CRITIC: the belt mask caught a tear only by luck (pixel sort picks its own spot over the whole picture). Full screen,
// longer smears that sort everything (pick 0.04: solid bars): each hammered Db chord drags the plane into a bar.
clip({ start: 84.0, end: 106.5, widget: 'pixelsort', set: 'chord-hammer', knobs: { len: 1.3, pick: 0.04, band: 1.4 }, fade: 0.3 });
clip({ start: 131.5, end: 164.95, widget: 'pixelsort', set: 'unison-calls', knobs: { presence: 0.7 }, fade: 0.6 });
clip({ start: 164.95, end: 185.6, widget: 'pixelsort', set: 'high-repeats', knobs: { presence: 0.6 }, fade: 0.5 });
clip({ start: 240.5, end: 256.6, widget: 'pixelsort', set: 'middle-chords', knobs: { presence: 0.6 }, fade: 0.5 });
clip({ start: 268.0, end: 297.2, widget: 'pixelsort', set: 'recap-blocks-wall', fade: 0.3 });
clip({ start: 305.0, end: 342.2, widget: 'pixelsort', set: 'canon-blocks', knobs: { presence: 0.55 }, fade: 0.5 });
clip({ start: 358.6, end: 392.4, widget: 'pixelsort', set: 'pileup-aftermath', fade: 0.4 });
// the last chord: a held chord holds its melt, so the slabs hang as red sheets for the six seconds the chord is held
clip({ start: 415.6, end: 421.85, widget: 'pixelsort', set: 'last-chord', knobs: { life: 3 }, fade: 0.1 });

// ---- picks: each strand trimmed to the clips that hear it (a note no clip hears is never kept) --------------------------
const picks = {};
for (const c of clips) {
  if (!c.listen) continue;
  const id = c.listen.slice(6);
  const spans = clips.filter((o) => o.listen === c.listen).map((o) => [o.start, o.end]);
  const ns = S[id].filter((nn) => spans.some(([a, b]) => nn[0] >= a && nn[0] < b - 0.05));
  if (!ns.length) throw new Error(`${id}: no notes inside its clips`);
  picks[id] = { notes: ns.map((nn) => [r3(nn[0]), r3(nn[1]), nn[2], nn[3], ...nn.slice(4)]) };
}

clips.sort((a, b) => a.start - b.start || a.track - b.track);
const show = {
  version: 3, id: ID, song: SONG,
  title: 'Holst: Mars · A · Kandinsky campaign: dread squares on the 5/4 ostinato, Kandinsky\'s army on every note, brass gust on the brass, casket and pixel sort at the dissonant climaxes',
  composer: { by: 'claude', at: new Date().toISOString() },
  clips, picks,
};
writeFileSync(join(ROOT, `shows/${ID}.json`), JSON.stringify(show, null, 2) + '\n');
console.log(`${ID}: ${clips.length} clips, ${Object.keys(picks).length} pick sets, ${Object.values(picks).reduce((s, p) => s + p.notes.length, 0)} notes`);
