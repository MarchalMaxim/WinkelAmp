// render.html: frames on demand, through the same runtime the studio plays with (plan §10).
//   ?labSong=prelude|b5&only=<ids>[&hz=60]   the lab itself (its notes files, all its widgets in its order), for the
//                                            fidelity test against lab/index.html?render=1
// The page imitates the lab's render mode before anything runs: seeded Math.random (state 1), no workers, and
// queueMicrotask collected and run at the end of each step (pixelsort draws after the others that way).
import { exposeRenderApi, labCompat, type Stepper } from '../widgets/driver';
import { installSeededRandom } from '../widgets/random';
import { WidgetRuntime } from '../widgets/runtime';
import { labHarness, labSongs, labWidgetSources } from '../widgets/sources';
import type { Note } from '../widgets/types';

const reseed = installSeededRandom(1);
const queued: (() => void)[] = [];
let post: (() => void)[] = queued;
window.queueMicrotask = (fn: () => void) => { post.push(fn); };
(window as { Worker?: unknown }).Worker = undefined;

const params = new URLSearchParams(location.search);
const HZ = Number(params.get('hz')) || 60;
const canvas = document.getElementById('c') as HTMLCanvasElement;

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
  const songs = labSongs(), song = songs[id];   // the lab's own SONGS: notes file, title, length, moments
  if (!song) throw new Error(`unknown labSong ${id} (${Object.keys(songs).join(' or ')})`);
  await loadScript(`/lab/${song.notes}`);
  const notes = (window as { NOTES?: Note[] }).NOTES;
  if (!Array.isArray(notes)) throw new Error(`/lab/${song.notes} did not set window.NOTES`);
  const harness = labHarness();
  const rt = new WidgetRuntime(canvas, { notes }, { sources: labWidgetSources(), harness });
  rt.load(harness.toolIds);   // ALL of them, in lab order: load-time randomness (rorschach's paper) is part of the pixels
  const only = (params.get('only') ?? '').split(',').filter(Boolean);
  run(rt, labCompat(rt, only, song.moments), { duration: song.dur, title: song.title }, only);
}

const labSong = params.get('labSong');
(labSong ? labSongMode(labSong) : Promise.reject(new Error('render.html needs ?labSong=prelude|b5')))
  .catch((e) => { (window as { renderFailed?: string }).renderFailed = String(e); console.error(e); });
