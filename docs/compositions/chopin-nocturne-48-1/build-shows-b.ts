// Builds the second-half micro scenes shows/nocturne-micro-b<n>-<slug>.json from picks-b.json (this folder; made by
// gen-picks-b.mjs) and the scene table below (ANALYSIS-B.md says why each). Each scene is one ~10 s window: every clip spans
// the window with the same short fade-in, listens to its own pick set trimmed to the window, and sits on a track by role
// (ground at the bottom, the lead on top). Validates as scripts/studio-api.ts does: the pack's duration and tracks, the
// Node widget catalogue. Run: node_modules/.bin/tsx docs/compositions/chopin-nocturne-48-1/build-shows-b.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow, type Clip, type Show } from '../../../src/studio/show/show';
import { withValues, type PickNote } from '../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const SONG = 'chopin-nocturne-48-1';
const sets = new Map<string, PickNote[]>();
for (const s of JSON.parse(readFileSync(join(HERE, 'picks-b.json'), 'utf8')).sets) sets.set(s.id, s.notes);
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const widgets = loadCatalogue().widgets;

type Knobs = Clip['knobs'];
/** One layer of a scene. set absent: hears every note (only the ground). boost: every note's intensity (heard velocity =
    velocity x boost), for the pianissimo end where the marks would otherwise sink into the burn. */
type Layer = { widget: string; set?: string; knobs: Knobs; region?: Clip['region']; intensity?: [number, number][]; boost?: number;
  /** 'notes': the clip spans only its set (0.4 s before the first note to 3.7 s after the last: Ivory's hold and age), not the window. */
  span?: 'notes' };
/** Squeezed into the middle of the screen: Ivory's keys stand closer together, as a huddle. */
const HUDDLE: Clip['region'] = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.6, h: 1, feather: 0.05, fit: 'stretch' };
type Scene = { n: number; slug: string; title: string; start: number; end: number; fade: number; layers: Layer[] };

// Bottom to top: ground, then the supporting strands, the lead last (drawn on top).
const scenes: Scene[] = [
  // Only the scenes the user liked are kept (b1 and b5 were rejected, b2 is cut to its liked first part); ../STYLE.md says why.
  {
    n: 2, slug: 'fire', title: 'Keys through fire', start: 294.3, end: 301.5, fade: 0.3,
    layers: [
      { widget: 'fields', knobs: { back: 0.5, dyn: 0.8, chords: 0.8, home: 0.1, n: 3 } },
      { widget: 'squares-snap', set: 'b2-bass', knobs: { size: 1.7, life: 1.8, blur: 0.8, shake: 1.2, presence: 1 } },
      { widget: 'fireworks-snap', set: 'b2-chords', knobs: { hue: 0.02, range: 0.2, size: 1.4, swirl: 0.7, linger: 0.45, presence: 0.85 } },
      // One short Ivory row per phrase (the user: "make the ivory sequences shorter").
      ...['b2-p1', 'b2-p2'].map((set): Layer => ({ widget: 'ivory', set, span: 'notes',
        knobs: { strike: 1, crater: 0.5, ripple: 3, cracks: 1.2, presence: 1 } })),
    ],
  },
  {
    n: 3, slug: 'collapse', title: 'Bells, a flare and a sinking voice', start: 315.2, end: 327.6, fade: 0.3,
    layers: [
      // On black, and small calm squares: fields in every scene and big squares were too much.
      { widget: 'squares-snap', set: 'b3-bells', knobs: { size: 0.8, life: 1.1, blur: 1.4, shake: 0.2, presence: 0.65 } },
      { widget: 'crimp', set: 'b3-inner', knobs: { reach: 1, stays: 1.6, presence: 1 } },
      { widget: 'handover', set: 'b3-sink', knobs: { goneBy: 1.4, ring: 1.5, size: 0.7, presence: 0.9 } },
      { widget: 'ivory', set: 'b3-flare', knobs: { strike: 1, crater: 0.5, ripple: 3, cracks: 1.5, presence: 1 } },
    ],
  },
  {
    n: 4, slug: 'climb', title: 'Keys climbing alone', start: 335.7, end: 348.3, fade: 0.3,
    layers: [
      { widget: 'fields', knobs: { back: 0.3, dyn: 0.3, chords: 0.6, home: -0.5, n: 2 } },
      { widget: 'current', set: 'b4-turns', knobs: { threads: 1, width: 1, flow: 0.6, hue: 210, presence: 0.6 } },
      { widget: 'ivory', set: 'b4-line', knobs: { strike: 0.4, crater: 0.3, ripple: 2.2, cracks: 1, presence: 0.95 }, region: HUDDLE },
      { widget: 'hammer', set: 'b4-bass', knobs: { touch: 3, ring: 2, size: 1.6, presence: 1 }, boost: 1.8 },
    ],
  },
];

let bad = 0;
for (const sc of scenes) {
  const id = `nocturne-micro-b${sc.n}-${sc.slug}`;
  const clips: Clip[] = [], picks: Show['picks'] = {};
  sc.layers.forEach((l, track) => {
    const clip: Clip = { id: `c${track + 1}`, start: sc.start, end: sc.end, track, fade: sc.fade, widget: l.widget, knobs: l.knobs };
    if (l.set) {
      const all = sets.get(l.set) ?? [];
      if (l.span === 'notes' && all.length) {
        clip.start = Math.max(sc.start, Math.round((all[0][0] - 0.4) * 1000) / 1000);
        clip.end = Math.min(sc.end, Math.round((all[all.length - 1][0] + 3.7) * 1000) / 1000);
      }
      const ns = all.filter((n) => n[0] >= clip.start + sc.fade && n[0] < clip.end - 0.3);
      if (!ns.length) throw new Error(`${id}: ${l.set} has no notes in the window`);
      picks[l.set] = { notes: l.boost ? ns.map((n) => withValues([n[0], n[1], n[2], n[3]], { intensity: l.boost! })) : ns };
      clip.listen = `picks:${l.set}`;
    }
    if (l.span === 'notes') {
      // A row gives way as the next row of the same widget begins: it fades out over the next phrase's first 0.2 s.
      const next = sc.layers.slice(track + 1).find((o) => o.span === 'notes' && o.widget === l.widget && o.set);
      if (next) clip.end = Math.min(clip.end, Math.round(((sets.get(next.set!) ?? [])[0][0] + 0.2) * 1000) / 1000);
    }
    if (l.region) clip.region = l.region;
    if (l.intensity) clip.intensity = l.intensity.map(([t, v]) => ({ t, v }));
    clips.push(clip);
  });
  const show: Show = { version: 3, id, song: SONG, title: `Chopin Nocturne Op. 48 No. 1 · micro b${sc.n}: ${sc.title}`,
    composer: { by: 'claude', at: new Date().toISOString() }, clips, picks };
  const { errors, warnings } = validateShow(show, { duration: typeof pack.duration === 'number' ? pack.duration : undefined, widgets,
    tracks: Object.keys(pack.tracks ?? {}) });
  console.log(`${id}: ${sc.start}-${sc.end} s, ${clips.length} clips, errors ${errors.length}, warnings ${warnings.length}`, [...errors, ...warnings].map((e) => `${e.path}: ${e.message}`));
  if (errors.length) { bad++; continue; }
  writeFileSync(join(ROOT, `shows/${id}.json`), canonicalShow(show));
}
if (bad) process.exit(1);
