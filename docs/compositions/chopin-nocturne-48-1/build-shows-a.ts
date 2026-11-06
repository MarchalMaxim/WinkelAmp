// Builds the five first-half micro scenes of the nocturne, shows/nocturne-micro-a<n>-<slug>.json, from picks-a.json (this
// folder, made by gen-picks-a.mjs). Each scene is one ~10 s window: every clip lies inside it, the scene fades in at its start,
// and each widget hears its own strand (a set of picks); fields, the ground, hears everything. Validated exactly as
// scripts/studio-api.ts does (pack duration, the Node widget catalogue), written with canonicalShow.
// Run: node_modules/.bin/tsx docs/compositions/chopin-nocturne-48-1/build-shows-a.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow, type Clip, type Show } from '../../../src/studio/show/show';
import type { PickNote } from '../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const SONG = 'chopin-nocturne-48-1', BOUNDARY = 238;   // the doppio movimento's lead-in starts at 238.2 s: the second half's
const sets = new Map<string, PickNote[]>();
for (const s of JSON.parse(readFileSync(join(HERE, 'picks-a.json'), 'utf8')).sets) sets.set(s.id, s.notes);
const S = (id: string): PickNote[] => { const n = sets.get(id); if (!n) throw new Error(`no set ${id}`); return n; };

/** How long after its last note a widget still shows something (s), given its knobs; the window's end cuts it anyway. */
const TAIL: Record<string, (k: Record<string, number>) => number> = {
  'squares-snap': (k) => (k.life ?? 0.6) + 0.8,
  handover: (k) => (k.goneBy ?? 1.2) + 0.1,
  ivory: () => 2 + 1.5 + 0.4,
  hammer: (k) => [0.35, 0.6, 2.5, 4][k.touch ?? 2] * (k.ring ?? 1) + 0.3,
  'fireworks-snap': (k) => 2.2 + 4 * (k.linger ?? 0.45),
  current: () => 2.5,
  pluck: (k) => 2.5 * (k.ring ?? 1) + 0.3,
  crimp: (k) => (k.stays ?? 1.2) * 2 + 0.5,
  interlock: (k) => (k.stays ?? 1.4) + 0.6,
};

type Role = 'ground' | 'bass' | 'pulse' | 'counter' | 'sparkle' | 'lead';
type Layer = { widget: string; set?: string; role: Role; knobs: Record<string, number>; end?: number; intensity?: [number, number][] };
type Scene = { n: number; slug: string; title: string; from: number; to: number; layers: Layer[] };
const FIELDS = (home: number, back = 0.8) => ({ back, dyn: 0.65, chords: 0.7, home });

// Layers are listed bottom to top: the list order is the track order, so the lead is drawn last. Except in a5, where
// fireworks (the lead) sits under pluck and hammer so their fine lines stay visible over its smoke.
const scenes: Scene[] = [
  { n: 1, slug: 'lantern-and-keys', title: 'Lantern and keys: current on the first three notes, huddled Ivory on the rising line, Hammer on the off-beat chords, Snap squares on the bass, fields underneath',
    from: 3, to: 14.4, layers: [
      { widget: 'fields', role: 'ground', knobs: FIELDS(-0.2), intensity: [[3, 0.55], [7.6, 0.7], [12.4, 0.85], [14.4, 0.8]] },
      { widget: 'squares-snap', set: 'a1-bass', role: 'bass', knobs: { size: 1.1, life: 1.4, blur: 1.2, shake: 0.4, presence: 0.7 } },
      { widget: 'hammer', set: 'a1-chords', role: 'pulse', knobs: { touch: 3, ring: 1, size: 0.8, presence: 0.65 } },
      { widget: 'current', set: 'a1-melody-head', role: 'counter', knobs: { threads: 1, width: 1, flow: 0.6, hue: 215, presence: 0.7 }, end: 12.2 },
      { widget: 'ivory', set: 'a1-melody-rise', role: 'lead', knobs: { strike: 0.6, crater: 0.3, ripple: 2, cracks: 1, presence: 1 } },
    ] },
  { n: 2, slug: 'slabs-and-threads', title: 'Slabs and threads: Handover on the melody\'s long notes, Pluck on the turn, Snap squares on the off-beat chords, Hammer ringing on the bass, fields underneath',
    from: 23, to: 34, layers: [
      { widget: 'fields', role: 'ground', knobs: FIELDS(0.1), intensity: [[23, 0.6], [28.7, 0.75], [32.3, 0.9], [34, 0.8]] },
      { widget: 'hammer', set: 'a2-bass', role: 'bass', knobs: { touch: 3, ring: 1.6, size: 1.8, presence: 0.85 } },
      { widget: 'squares-snap', set: 'a2-chords', role: 'pulse', knobs: { size: 0.9, life: 1, blur: 0.6, shake: 0, presence: 0.85 } },
      { widget: 'pluck', set: 'a2-turn', role: 'sparkle', knobs: { pull: 1.1, corner: 1, ring: 1, touch: 2, presence: 0.85 } },
      { widget: 'handover', set: 'a2-melody', role: 'lead', knobs: { goneBy: 1.6, ring: 1.3, size: 0.8, presence: 1 } },
    ] },
  { n: 3, slug: 'ivory-peak', title: 'Ivory peak: Ivory climbing to C6 and falling back, Fireworks on the beat chords, Hammer on the line picking up again, Snap squares on the bass, fields underneath',
    from: 101.2, to: 111.4, layers: [
      { widget: 'fields', role: 'ground', knobs: FIELDS(-0.4, 0.7), intensity: [[101.2, 0.7], [104.2, 0.95], [107.3, 0.9], [111.4, 0.85]] },
      { widget: 'squares-snap', set: 'a3-bass', role: 'bass', knobs: { size: 1.2, life: 1, blur: 1, shake: 1, presence: 0.75 } },
      { widget: 'fireworks-snap', set: 'a3-chords', role: 'pulse', knobs: { hue: 0.06, range: 0.15, size: 0.9, swirl: 0.5, linger: 0.35, presence: 0.7 } },
      { widget: 'hammer', set: 'a3-after', role: 'counter', knobs: { touch: 2, ring: 1.4, size: 1.5, presence: 0.85 } },
      { widget: 'ivory', set: 'a3-rise', role: 'lead', knobs: { strike: 1, crater: 0.5, ripple: 3, cracks: 1.5, presence: 1 } },
      { widget: 'ivory', set: 'a3-fall', role: 'lead', knobs: { strike: 0.8, crater: 0.4, ripple: 2.5, cracks: 1.2, presence: 0.95 } },
    ] },
  { n: 4, slug: 'lantern-into-the-chorale', title: 'Lantern into the chorale: current as the lone voice after the cadence, Crimp on the chorale\'s first chords, Snap squares tolling the cadence and the roots, fields underneath',
    from: 117, to: 127.8, layers: [
      { widget: 'fields', role: 'ground', knobs: FIELDS(0.3), intensity: [[117, 0.8], [119.5, 0.55], [123, 0.55], [124.5, 0.8], [127.8, 0.85]] },
      { widget: 'squares-snap', set: 'a4-bass', role: 'bass', knobs: { size: 1.4, life: 2.4, blur: 1.4, shake: 0.6, presence: 0.8 } },
      { widget: 'crimp', set: 'a4-chorale', role: 'pulse', knobs: { slack: 4, reach: 1, fibres: 15, stays: 2.2, presence: 0.8 } },
      { widget: 'current', set: 'a4-voice', role: 'lead', knobs: { threads: 1, width: 1.1, flow: 0.5, hue: 215, presence: 0.85 } },
    ] },
  { n: 5, slug: 'octave-storm', title: 'Octave storm: Fireworks on the hammered chords, Interlock on the climbing and trembling bass octaves, Pluck on the left-hand arpeggios, Hammer on the octave melody falling from C7, fields underneath',
    from: 216.6, to: 227.8, layers: [
      { widget: 'fields', role: 'ground', knobs: FIELDS(-0.4, 1.2), intensity: [[216.6, 0.6], [219, 0.7], [222, 0.75], [227.8, 0.7]] },
      { widget: 'interlock', set: 'a5-octaves', role: 'bass', knobs: { bite: 1, width: 0.8, stays: 0.8, ratchet: 24, presence: 0.8 } },
      { widget: 'fireworks-snap', set: 'a5-chords', role: 'lead', knobs: { hue: 0.02, range: 0.2, size: 1.3, swirl: 0.6, linger: 0.3, presence: 1 } },
      { widget: 'pluck', set: 'a5-arpeggio', role: 'counter', knobs: { pull: 1.6, corner: 1, ring: 1.2, touch: 2, presence: 1 } },
      { widget: 'hammer', set: 'a5-descent', role: 'sparkle', knobs: { touch: 3, ring: 1.2, size: 2, presence: 1 } },
    ] },
];

const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const widgets = loadCatalogue().widgets;
const PRE = 0.6, FADE = 0.3, SCENE_FADE = 0.5;
let bad = 0;
for (const sc of scenes) {
  if (sc.to > BOUNDARY) throw new Error(`scene ${sc.n} runs past ${BOUNDARY} s, into the second half`);
  const clips: Clip[] = [], picks: Show['picks'] = {};
  sc.layers.forEach((l, track) => {
    const k = l.knobs;
    if (!l.set) {
      clips.push({ id: '', start: sc.from, end: sc.to, track, fade: SCENE_FADE + 0.3, widget: l.widget, knobs: k,
        ...(l.intensity ? { intensity: l.intensity.map(([t, v]) => ({ t, v })) } : {}) });
      return;
    }
    const ns = S(l.set);
    const first = ns[0][0], last = ns[ns.length - 1][0];
    const start = Math.max(sc.from, Math.round((first - PRE) * 1000) / 1000), fade = start === sc.from ? SCENE_FADE : FADE;
    const end = Math.min(sc.to, l.end ?? Math.round((last + TAIL[l.widget](k)) * 1000) / 1000);
    if (first < start + fade) throw new Error(`${l.set}: first note ${first} inside the fade-in (${start}+${fade})`);
    if (last + 0.06 > end) throw new Error(`${l.set}: last note ${last} too close to the end ${end}`);
    clips.push({ id: '', start, end, track, fade, widget: l.widget, listen: `picks:${l.set}`, knobs: k });
    picks[l.set] = { notes: ns };
  });
  clips.forEach((c, i) => { c.id = `c${i + 1}`; });
  for (const c of clips) if (c.start < sc.from || c.end > sc.to) throw new Error(`${c.id} leaves the window`);
  const id = `nocturne-micro-a${sc.n}-${sc.slug}`;
  const show: Show = { version: 3, id, song: SONG, title: `Chopin Nocturne Op. 48/1 · micro a${sc.n} · ${sc.title}`,
    composer: { by: 'claude', at: new Date().toISOString() }, clips, picks };
  const { errors, warnings } = validateShow(show, { duration: typeof pack.duration === 'number' ? pack.duration : undefined, widgets, tracks: Object.keys(pack.tracks ?? {}) });
  console.log(`${id}: ${sc.from}-${sc.to} s, ${clips.length} clips, errors ${errors.length}, warnings ${warnings.length}`);
  for (const e of [...errors, ...warnings]) console.log('   ', e.path, e.message);
  if (errors.length) { bad++; continue; }
  writeFileSync(join(ROOT, `shows/${id}.json`), canonicalShow(show));
}
if (bad) process.exit(1);
