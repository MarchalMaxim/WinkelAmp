// render.html: frames on demand, through the same runtime the studio plays with.
//   ?labSong=prelude|b5&only=<ids>[&hz=60]   the lab itself (its notes files, all its widgets in its order), for the
//                                            fidelity test against lab/index.html?render=1
//   ?show=<id>[&hz=60]                       a show: shows/<id>.json through the dev API, its song's pack, a Conductor
//   &scale=1|2|3 (both modes)                supersampled: a 1280·S × 720·S canvas, widgets in 1280×720 units
//   labSong mode, also:
//   &layers=<url-encoded JSON of { widget, listen?, region?, intensity? }[]>   the lab's layer settings: each entry is
//                                            an instance drawn in its widget's place (two entries of one widget on
//                                            different parts are two instances); routed ones load after every base tool
//   &tracks=same                             a test hook: tracks piano and violin whose notes are all the notes
//   &warm=<n>                                a test hook: n Math.random calls before the layer instances load
//   The song's pack file (/lab/pack-<id>.js, window.PACK = { tracks, beats, loudness, energy? }) loads when its SONGS entry names one.
// The page imitates the lab's render mode before anything runs: seeded Math.random (state 1), no workers, and
// queueMicrotask collected and run at the end of each step (pixelsort draws after the others that way).
import { Conductor } from './show/conductor';
import { structureTimes } from './show/marks';
import type { Show } from './show/show';
import type { SongPack } from './pack/pack';
import { toMeta } from '../widgets/catalogue';
import { exposeRenderApi, labCompat, labLayerSpecs, labLayers, type LabLayer, type Stepper } from '../widgets/driver';
import { widgetOrder } from '../widgets/lab-harness';
import { installSeededRandom } from '../widgets/random';
import { WidgetRuntime, type RuntimeOptions } from '../widgets/runtime';
import { songNotesOf, studioLib } from '../widgets/studio-lib';
import type { Note, SongNotes } from '../widgets/types';

const reseed = installSeededRandom(1);
const queued: (() => void)[] = [];
let post: (() => void)[] = queued;
window.queueMicrotask = (fn: () => void) => { post.push(fn); };
(window as { Worker?: unknown }).Worker = undefined;

const params = new URLSearchParams(location.search);
const HZ = Number(params.get('hz')) || 60;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const SCALE = Number(params.get('scale') ?? 1);
const opts: RuntimeOptions = { scale: SCALE as 1 | 2 | 3 };

/** The canvas at the asked scale, before any runtime gets its context. */
function sizeCanvas(): void {
  if (SCALE !== 1 && SCALE !== 2 && SCALE !== 3) throw new Error(`scale=${params.get('scale')}: 1, 2 or 3`);
  if (SCALE !== 1) { canvas.width = 1280 * SCALE; canvas.height = 720 * SCALE; }
}

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error(`could not load ${src}`));
    document.head.append(s);
  });
}

function run(rt: WidgetRuntime, stepper: Stepper, info: { duration: number; title: string }, active: readonly string[]): void {
  post = rt.post; post.push(...queued.splice(0));
  exposeRenderApi(stepper, rt, reseed, HZ);
  window.renderInfo = info;
  window.renderTools = active.filter((id) => rt.tool(id)).map((id) => ({ id, name: rt.tool(id)!.name }));
  (window as { renderRuntime?: unknown }).renderRuntime = { rt, stepper };   // for checks and debugging
  window.renderReady = true;
}

async function labSongMode(id: string): Promise<void> {
  const songs = studioLib().harness.songs, song = songs[id];   // the lab's own SONGS: notes file, title, length, moments
  if (!song) throw new Error(`unknown labSong ${id} (${Object.keys(songs).join(' or ')})`);
  await loadScript(`/lab/${song.notes}`);
  const notes = (window as { NOTES?: Note[] }).NOTES;
  if (!Array.isArray(notes)) throw new Error(`/lab/${song.notes} did not set window.NOTES`);
  const layers = JSON.parse(params.get('layers') ?? '[]') as LabLayer[];
  if (!Array.isArray(layers)) throw new Error('layers= is a JSON list of { widget, listen?, region?, intensity? }');
  let tracks: SongNotes['tracks'], loudness: SongNotes['loudness'], energy: SongNotes['energy'];
  if (params.get('tracks') === 'same') tracks = { piano: { notes, family: 'keys' }, violin: { notes, family: 'strings' } };
  else if (song.pack) {
    await loadScript(`/lab/${song.pack}`);
    const pack = (window as { PACK?: { tracks?: SongNotes['tracks']; loudness?: SongNotes['loudness']; energy?: SongNotes['energy'] } }).PACK;
    tracks = pack?.tracks; loudness = pack?.loudness; energy = pack?.energy;
  }
  const lib = studioLib(), order = widgetOrder(lib.harness.order, Object.keys(lib.sources));
  const rt = new WidgetRuntime(canvas, { notes, tracks, loudness, energy }, lib, opts);
  rt.load(order);   // ALL of them, in lab order: load-time randomness (rorschach's paper) is part of the pixels
  for (let n = Number(params.get('warm')) || 0; n > 0; n--) Math.random();
  rt.load(labLayerSpecs(order, layers));   // then the routed and own instances, in the same order
  const only = (params.get('only') ?? '').split(',').filter(Boolean);
  const stepper = layers.length ? labLayers(rt, only, layers, song.moments) : labCompat(rt, only, song.moments);
  run(rt, stepper, { duration: song.dur, title: song.title }, [...new Set([...only, ...layers.map((l) => l.widget),])]);
}

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

async function showMode(id: string): Promise<void> {
  const base = new URL('.', location.href).pathname.replace(/\/$/, '');
  const show = await json<Show>(`${base}/api/shows/${encodeURIComponent(id)}`);
  const pack = await json<SongPack>(`${base}/songs/${encodeURIComponent(show.song)}/pack.json`);
  (window as { NOTES?: Note[] }).NOTES = pack.notes;   // before any widget file runs: several read it when they load
  const rt = new WidgetRuntime(canvas, songNotesOf(pack), studioLib(), opts);
  const conductor = new Conductor(rt, show, (w) => { const t = rt.tool(w); return t ? toMeta(t, null) : undefined; }, structureTimes(pack.sections));
  const ids = [...new Set(show.clips.map((c) => c.widget))];
  run(rt, conductor, { duration: pack.duration, title: show.title ?? pack.title }, ids);
}

const labSong = params.get('labSong'), showId = params.get('show');
(async () => { sizeCanvas(); await (labSong ? labSongMode(labSong) : showId ? showMode(showId) : Promise.reject(new Error('render.html needs ?labSong=prelude|b5 or ?show=<id>'))); })()
  .catch((e) => { (window as { renderFailed?: string }).renderFailed = String(e); console.error(e); });
