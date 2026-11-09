// lab/strongest.html: the "keep the strongest" thinning demo (docs/research/audio-to-picture.md, item 6). One widget in
// two runtimes over a song's pack and recording, both with an intensity curve held at the slider's level: on the left
// the attacks it hears are picked by hash (today), on the right its layer has thin 'loud' and keeps the strongest
// around each attack first. A strip of the 24 s around now shows which attacks each side lets through. Writes nothing.
import type { SongPack } from '../studio/pack/pack';
import { studioLayers } from '../widgets/layers-source';
import { installSeededRandom } from '../widgets/random';
import { WidgetRuntime, type Slot } from '../widgets/runtime';
import { labHarness, labWidgetSources } from '../widgets/sources';
import type { Chord, Note, SlotLayer } from '../widgets/types';

const SIDES: { thin: boolean; title: string; col: string }[] = [
  { thin: false, title: 'a random selection (today)', col: '--rand' },
  { thin: true, title: 'the strongest notes', col: '--loud' },
];
const SPAN = 24;   // seconds in the strip
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const status = (s: string) => { $('status').textContent = s; };

function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const r = c.getBoundingClientRect(), d = devicePixelRatio || 1;
  if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
  const g = c.getContext('2d')!; g.setTransform(d, 0, 0, d, 0, 0); return g;
}

async function main() {
  const params = new URLSearchParams(location.search);
  const songs = ((await (await fetch('/api/songs', { cache: 'no-store' })).json()).songs as { id: string; title: string; error?: string }[])
    .filter((s) => !s.error).sort((a, b) => a.title.localeCompare(b.title));
  // The Hall of the Mountain King: of the packs here, the widest spread of note loudness within a few seconds.
  const id = params.get('song') ?? (songs.some((s) => s.id === 'mountain-king') ? 'mountain-king' : songs[0]?.id);
  if (!id) { status('No songs.'); return; }
  const harness = labHarness(), sources = labWidgetSources();
  const widgets = harness.toolIds.filter((w) => sources[w] != null);
  const widget = params.get('widget') ?? (widgets.includes('gust') ? 'gust' : widgets[0]);
  let a = Number(params.get('a') ?? 0.3);
  a = Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 0.3;
  const query = (over: Record<string, string> = {}) => new URLSearchParams({ song: id, widget, a: String(a), ...over }).toString();
  const songSel = $('song') as HTMLSelectElement, widgetSel = $('widget') as HTMLSelectElement;
  const amount = $('amount') as HTMLInputElement, amountOut = $('amountOut') as HTMLOutputElement;
  for (const s of songs) songSel.add(new Option(s.title, s.id, false, s.id === id));
  for (const w of widgets) widgetSel.add(new Option(w, w, false, w === widget));
  songSel.onchange = () => { location.search = query({ song: songSel.value }); };
  widgetSel.onchange = () => { location.search = query({ widget: widgetSel.value }); };
  amount.value = String(a); amountOut.textContent = `${Math.round(a * 100)} %`;

  status('Reading the pack…');
  const pack = (await (await fetch(`/songs/${id}/pack.json`, { cache: 'no-store' })).json()) as SongPack;
  (window as { NOTES?: Note[] }).NOTES = pack.notes;   // before any widget file runs: several read it when they load
  const song = { notes: pack.notes, tracks: pack.tracks, loudness: pack.loudness, energy: pack.energy };

  // Two runtimes, each loaded from the same seed so they start alike; the same instance key, so the same salt.
  const L = studioLayers(), reseed = installSeededRandom(1), stages = $('stages');
  const runs = SIDES.map(({ thin, title, col }) => {
    const box = document.createElement('div'); box.className = 'stage';
    box.innerHTML = `<h2>${title} <span class="count" style="color:var(${col})"></span></h2><canvas width="1280" height="720"></canvas>`;
    stages.append(box);
    reseed(1);
    const rt = new WidgetRuntime(box.querySelector('canvas')!, song, { sources, harness, layers: L });
    rt.load([{ key: widget, widget, own: true }]);   // own, as a clip with a curve is in a show
    return { thin, rt, count: box.querySelector<HTMLElement>('.count')! };
  });
  const inst = runs[0].rt.instance(widget);
  if (!inst) { status(runs[0].rt.errors[widget] ?? `${widget} did not load`); return; }
  const chords: readonly Chord[] = inst.chords, salt = inst.salt;
  let top = 1;
  for (const c of chords) top = Math.max(top, c.vel);
  // The same layer a clip with a flat curve at a carries (conductor.ts slotLayer), with and without thin 'loud'.
  const slotsFor = (thin: boolean): Slot[] => {
    const layer: SlotLayer = { pivots: [{ t: 0, v: a }] };
    if (thin) layer.thin = 'loud';
    return [{ id: widget, receiving: true, weight: 1, layer }];
  };
  // What each side lets through: the calls slot.js deliveredChords makes.
  const kept = (thin: boolean, ch: Chord) => (thin ? L.passesStrongest(chords, ch, a, salt) : L.passes(ch.t, a, salt));

  const audio = new Audio(`/songs/${id}/${pack.audio}`);
  audio.preload = 'auto';
  const dur = pack.duration;
  status(`${chords.length} attacks in the piece`);

  const play = $('play') as HTMLButtonElement, strip = $('strip') as HTMLCanvasElement;
  const toggle = () => { if (audio.paused) void audio.play(); else audio.pause(); };
  play.onclick = toggle;
  audio.onplay = () => { play.textContent = 'Pause'; }; audio.onpause = () => { play.textContent = 'Play'; };
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLSelectElement) return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.target instanceof HTMLInputElement) return;   // there the arrows move the slider
    if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(dur, audio.currentTime + 5);
  });
  if (params.has('t')) audio.currentTime = +params.get('t')!;

  let last = -1;
  amount.oninput = () => {
    a = Number(amount.value); amountOut.textContent = `${Math.round(a * 100)} %`;
    history.replaceState(null, '', `?${query()}`);
    last = -1;   // both pictures again at the new level, even paused
  };
  strip.onclick = (e) => {
    const r = strip.getBoundingClientRect(), t0 = audio.currentTime - SPAN / 2;
    audio.currentTime = Math.max(0, Math.min(dur, t0 + ((e.clientX - r.left) / r.width) * SPAN));
  };

  const drawStrip = (t: number) => {
    const g = fit(strip), r = strip.getBoundingClientRect(), w = r.width, h = r.height, row = h / 2, pad = 6;
    const t0 = t - SPAN / 2, t1 = t + SPAN / 2, X = (u: number) => ((u - t0) / SPAN) * w;
    const cols = SIDES.map((s) => css(s.col)), off = css('--off');
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, row - 0.5, w, 1);
    const n = [0, 0];
    let i = 0, all = 0;
    while (i < chords.length && chords[i].t < t0) i++;
    for (; i < chords.length && chords[i].t <= t1; i++) {
      const ch = chords[i], x = X(ch.t), hh = Math.max(2, (ch.vel / top) * (row - 2 * pad));
      all++;
      SIDES.forEach((s, k) => {
        const on = kept(s.thin, ch);
        if (on) n[k]++;
        g.fillStyle = on ? cols[k] : off;
        g.fillRect(x - 1, (k + 1) * row - pad - hh, 2, hh);
      });
    }
    g.fillStyle = '#fff'; g.fillRect(X(t) - 0.5, 0, 1, h);
    runs.forEach((x, k) => { x.count.textContent = `${n[k]} of ${all} attacks in the strip`; });
  };

  const frame = () => {
    const t = audio.currentTime;
    // A jump back or a long one (a seek) replays the 4 s before t at 60 Hz, so a paused picture is already full;
    // otherwise one step, as the studio plays.
    if (last < 0 || t < last || t - last > 0.5) {
      const t0 = Math.max(0, t - 4);
      for (const r of runs) {
        const slots = slotsFor(r.thin);
        r.rt.reset(t0); for (let u = t0 + 1 / 60; u < t; u += 1 / 60) r.rt.step(u, 1 / 60, slots); r.rt.step(t, 1 / 60, slots);
      }
      last = t;
    }
    if (t > last) { const dt = t - last; for (const r of runs) r.rt.step(t, dt, slotsFor(r.thin)); last = t; }
    $('time').textContent = `${fmt(t)} / ${fmt(dur)}`;
    drawStrip(t);
    requestAnimationFrame(frame);
  };
  frame();
}

main().catch((e) => { status(`Failed: ${(e as Error).message}`); console.error(e); });
