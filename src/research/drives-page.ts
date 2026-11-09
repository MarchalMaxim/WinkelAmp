// lab/drives.html: the loud, rel and pace drives demo (docs/research/audio-to-picture.md, items 3, 4 and the "louder
// than around it" drive). One widget in four runtimes over a song's pack and recording, the same knob on +level, +loud,
// +rel and +pace, base at its lowest and depth 1, so the knob reads min..max as the drive reads 0..1. loud and rel read
// the same lane (the zero-lag energy lane when the pack has it): loud stretched over the whole piece, rel judged
// against the seconds around now. Writes nothing.
import type { SongPack } from '../studio/pack/pack';
import { groupChords, soundingAt } from '../widgets/chords';
import { paceAt } from '../widgets/curves';
import { advanceFeatures, knobValue, newFeatures } from '../widgets/features';
import { studioLayers } from '../widgets/layers-source';
import { installSeededRandom } from '../widgets/random';
import { WidgetRuntime } from '../widgets/runtime';
import { labHarness, labWidgetSources } from '../widgets/sources';
import type { Chord, Drive, Features, KnobMap, Note, Param } from '../widgets/types';

type Lane = 'level' | 'loud' | 'rel' | 'pace';
const DRIVES: { drive: Drive; feat: keyof Features; lane: Lane; col: string }[] = [
  { drive: '+level', feat: 'level', lane: 'level', col: '--level' },
  { drive: '+loud', feat: 'loud', lane: 'loud', col: '--loud' },
  { drive: '+rel', feat: 'rel', lane: 'rel', col: '--rel' },
  { drive: '+pace', feat: 'pace', lane: 'pace', col: '--pace' },
];
const HOP = 0.05;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const status = (s: string) => { $('status').textContent = s; };

/** level, loud, rel and pace over the whole piece, every HOP s, as an unrouted instance would read them. */
function curves(pack: SongPack, loudAt: (t: number) => number, relAt: (t: number) => number): Record<Lane, Float32Array> {
  const chords = groupChords(pack.notes), n = Math.ceil(pack.duration / HOP) + 1;
  const level = new Float32Array(n), loud = new Float32Array(n), rel = new Float32Array(n), pace = new Float32Array(n);
  const p = { level: 0, rate: 0, hit: 0 }, f = newFeatures();
  let ci = 0;
  for (let i = 0; i < n; i++) {
    const t = i * HOP, fired: Chord[] = [];
    while (ci < chords.length && chords[ci].t <= t) fired.push(chords[ci++]);
    advanceFeatures(p, f, fired, soundingAt(pack.notes, t), i ? HOP : 0);
    level[i] = p.level; loud[i] = loudAt(t); rel[i] = relAt(t); pace[i] = paceAt(chords, t);
  }
  return { level, loud, rel, pace };
}

function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const r = c.getBoundingClientRect(), d = devicePixelRatio || 1;
  if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
  const g = c.getContext('2d')!; g.setTransform(d, 0, 0, d, 0, 0); return g;
}

function plot(c: HTMLCanvasElement, lanes: Record<string, Float32Array>, dur: number, now: number) {
  const g = fit(c), r = c.getBoundingClientRect(), w = r.width, h = r.height, pad = 8;
  const Y = (u: number) => pad + (1 - u) * (h - 2 * pad);
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1;
  for (const u of [0, 0.5, 1]) { g.beginPath(); g.moveTo(0, Y(u)); g.lineTo(w, Y(u)); g.stroke(); }
  for (const { lane, col } of DRIVES) {
    const x = lanes[lane], stride = Math.max(1, Math.floor(x.length / (w * 2)));
    g.beginPath();
    for (let i = 0; i < x.length; i += stride) {
      // Over a stride, the mean: what the picture gets on average there, not its brightest blink.
      let m = 0, k = 0; for (; k < stride && i + k < x.length; k++) m += x[i + k]; m /= k;
      const px = (i * HOP / dur) * w;
      if (i) g.lineTo(px, Y(m)); else g.moveTo(px, Y(m));
    }
    g.strokeStyle = css(col); g.lineWidth = lane === 'level' ? 1 : 2; g.globalAlpha = lane === 'level' ? 0.7 : 1;
    g.stroke(); g.globalAlpha = 1;
  }
  g.fillStyle = '#fff'; g.fillRect((now / dur) * w - 0.5, 0, 1, h);
}

async function main() {
  const params = new URLSearchParams(location.search);
  const songs = ((await (await fetch('/api/songs', { cache: 'no-store' })).json()).songs as { id: string; title: string; error?: string }[])
    .filter((s) => !s.error).sort((a, b) => a.title.localeCompare(b.title));
  const id = params.get('song') ?? (songs.some((s) => s.id === 'barber-adagio') ? 'barber-adagio' : songs[0]?.id);
  if (!id) { status('No songs.'); return; }
  const harness = labHarness(), sources = labWidgetSources();
  const widgets = harness.toolIds.filter((w) => sources[w] != null);   // any knob can be driven
  const widget = params.get('widget') ?? (widgets.includes('gust') ? 'gust' : widgets[0]);
  const go = (over: Record<string, string>) => {
    const q = new URLSearchParams({ song: id, widget, ...(params.get('knob') ? { knob: params.get('knob')! } : {}), ...over });
    location.search = q.toString();
  };
  const songSel = $('song') as HTMLSelectElement, widgetSel = $('widget') as HTMLSelectElement, knobSel = $('knob') as HTMLSelectElement;
  for (const s of songs) songSel.add(new Option(s.title, s.id, false, s.id === id));
  for (const w of widgets) widgetSel.add(new Option(w, w, false, w === widget));
  songSel.onchange = () => go({ song: songSel.value });
  widgetSel.onchange = () => { const q = new URLSearchParams({ song: id, widget: widgetSel.value }); location.search = q.toString(); };

  status('Reading the pack…');
  const pack = (await (await fetch(`/songs/${id}/pack.json`, { cache: 'no-store' })).json()) as SongPack;
  (window as { NOTES?: Note[] }).NOTES = pack.notes;   // before any widget file runs: several read it when they load
  const song = { notes: pack.notes, tracks: pack.tracks, loudness: pack.loudness, energy: pack.energy };

  // Four runtimes, each loaded from the same seed so they start alike.
  const reseed = installSeededRandom(1), stages = $('stages');
  const runs = DRIVES.map(({ drive, col }) => {
    const box = document.createElement('div'); box.className = 'stage';
    const word = harness.drives.find(([d]) => d === drive)?.[1] ?? drive;
    box.innerHTML = `<h2>${drive} <span>${word}</span></h2><canvas width="1280" height="720"></canvas>
      <div class="meter"><i style="background:var(${col})"></i></div><h2><span class="val"></span></h2>`;
    stages.append(box);
    const canvas = box.querySelector('canvas')!;
    reseed(1);
    const rt = new WidgetRuntime(canvas, song, { sources, harness, layers: studioLayers() });
    rt.load([widget]);
    return { drive, rt, bar: box.querySelector<HTMLElement>('.meter i')!, val: box.querySelector<HTMLElement>('.val')! };
  });
  const tool = runs[0].rt.tool(widget), knobs: Param[] = (tool?.params ?? []).filter((q) => q.max > q.min);
  if (!tool || !knobs.length) { status(runs[0].rt.errors[widget] ?? `${widget} has no knob`); return; }
  const knob = knobs.find((q) => q.key === (params.get('knob') ?? (widget === 'gust' ? 'air' : ''))) ?? knobs.find((q) => q.drive) ?? knobs[0];
  for (const q of knobs) knobSel.add(new Option(q.label ?? q.key, q.key, false, q === knob));
  knobSel.onchange = () => go({ knob: knobSel.value });
  for (const r of runs) {
    const m: KnobMap = {};
    // Every other knob as the widget sets it, without its drive: only this one moves.
    for (const q of tool.params ?? []) m[q.key] = { base: q.value, drive: '', depth: 0.5 };
    m[knob.key] = { base: knob.min, drive: r.drive, depth: 1 };
    r.rt.setKnobs(widget, m);
  }

  status('Working out the curves…');
  const lanes = curves(pack, runs[0].rt.loudAt, runs[0].rt.relAt);
  const audio = new Audio(`/songs/${id}/${pack.audio}`);
  audio.preload = 'auto';
  const dur = pack.duration;
  status(pack.loudness || pack.energy ? `${pack.notes.length} notes, knob "${knob.label ?? knob.key}" ${knob.min}..${knob.max}` : 'This pack has no loudness lane: loud and rel stay 0');
  // Without the energy lane loud and rel read the old lane, 1.1 s ahead: say so where it shows.
  $('noEnergy').hidden = !!pack.energy;

  const play = $('play') as HTMLButtonElement, cv = $('curves') as HTMLCanvasElement;
  const toggle = () => { if (audio.paused) void audio.play(); else audio.pause(); };
  play.onclick = toggle;
  audio.onplay = () => { play.textContent = 'Pause'; }; audio.onpause = () => { play.textContent = 'Play'; };
  cv.onclick = (e) => { const r = cv.getBoundingClientRect(); audio.currentTime = Math.max(0, Math.min(dur, ((e.clientX - r.left) / r.width) * dur)); };
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLSelectElement) return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(dur, audio.currentTime + 5);
  });
  if (params.has('t')) audio.currentTime = +params.get('t')!;

  let last = -1;
  const slots = [{ id: widget, receiving: true, weight: 1 }];
  const frame = () => {
    const t = audio.currentTime;
    // A jump back or a long one (a seek) replays the 4 s before t at 60 Hz, so a paused picture is already full;
    // otherwise one step, as the studio plays.
    if (last < 0 || t < last || t - last > 0.5) {
      const t0 = Math.max(0, t - 4);
      for (const r of runs) { r.rt.reset(t0); for (let u = t0 + 1 / 60; u < t; u += 1 / 60) r.rt.step(u, 1 / 60, slots); r.rt.step(t, 1 / 60, slots); }
      last = t;
    }
    if (t > last) { const dt = t - last; for (const r of runs) r.rt.step(t, dt, slots); last = t; }
    for (const r of runs) {
      const s = { base: knob.min, drive: r.drive, depth: 1 }, v = knobValue(knob, s, r.rt.ctx.feat);
      r.bar.style.width = `${((v - knob.min) / (knob.max - knob.min)) * 100}%`;
      r.val.textContent = `${knob.label ?? knob.key}: ${v.toFixed(2)}`;
    }
    $('time').textContent = `${fmt(t)} / ${fmt(dur)}`;
    plot(cv, lanes, dur, t);
    requestAnimationFrame(frame);
  };
  frame();
}

main().catch((e) => { status(`Failed: ${(e as Error).message}`); console.error(e); });
