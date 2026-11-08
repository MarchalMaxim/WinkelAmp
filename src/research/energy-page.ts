// lab/energy.html: the energy lanes demo (docs/research/audio-to-picture.md). Reads a song's pack and audio from the dev
// API, measures the sound offline in the browser, and plots it against what widgets feel today. Writes nothing.
import { decodeToMono } from '../studio/ingest/fallback';
import type { Note } from '../widgets/types';
import {
  bestLag, blockPower, centredDb, climaxes, followPreset, pivotAt, relative, resample, todayLevel, unitOfDb, type Pivot,
} from './energy';

interface Pack { id: string; title: string; audio: string; duration: number; notes: Note[]; sections: { start: number; end: number }[];
  loudness: { hop: number; values: number[] } }
interface Lanes {
  pack: Pack; hop: number; n: number;
  today: Float32Array; energy: Float32Array; momentary: Float32Array; lane: Float32Array; rel: Float32Array;
  follow: Pivot[]; peaks: { t: number; v: number }[]; lag: { lag: number; r: number }; dark: number;
}

const HOP = 0.01;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const status = (s: string) => { $('status').textContent = s; };

/** The mono mix through BS.1770's K-weighting (a high shelf near 1.7 kHz, then a high-pass at 38 Hz), rendered natively. */
async function kWeighted(pcm: Float32Array, sr: number): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, pcm.length, sr);
  const buf = ctx.createBuffer(1, pcm.length, sr);
  buf.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 1681.97; shelf.gain.value = 4;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38.13; hp.Q.value = 0.5;
  src.connect(shelf).connect(hp).connect(ctx.destination); src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

async function analyse(id: string): Promise<Lanes> {
  status('Reading the pack…');
  const pack = (await (await fetch(`/songs/${id}/pack.json`, { cache: 'no-store' })).json()) as Pack;
  status('Decoding the recording…');
  const blob = await (await fetch(`/songs/${id}/${pack.audio}`)).blob();
  const sr = 44100, pcm = await decodeToMono(blob, sr);
  status('Measuring…');
  const power = blockPower(await kWeighted(pcm, sr), sr, HOP);
  const n = power.length;
  const energy = unitOfDb(centredDb(power, HOP, 3));
  const momentary = unitOfDb(centredDb(power, HOP, 0.4));
  const today = todayLevel(pack.notes, n * HOP, HOP).level;
  const lane = resample(pack.loudness.values, pack.loudness.hop, HOP, n);
  // The lag: today's lane against the centred energy, both on the lane's own 0.1 s grid.
  const coarse = Math.floor(n * HOP / pack.loudness.hop);
  const lag = bestLag(resample(energy, HOP, pack.loudness.hop, coarse), pack.loudness.values.slice(0, coarse), pack.loudness.hop, 4);
  const rel = resample(relative(resample(energy, HOP, 0.1, coarse), 0.1), 0.1, HOP, n);
  const follow = followPreset(momentary, HOP, { start: 0, end: n * HOP }, { floor: 0.35, maxPivots: 200 });
  const peaks = climaxes(energy, HOP, { n: 3, gap: 20 });
  // While the music is louder than its own median, how often does a widget's level sit near zero?
  const med = Array.from(energy).sort((a, b) => a - b)[Math.floor(n / 2)];
  let loud = 0, dark = 0;
  for (let i = 0; i < n; i++) if (energy[i] > med) { loud++; if (today[i] < 0.1) dark++; }
  return { pack, hop: HOP, n, today, energy, momentary, lane, rel, follow, peaks, lag, dark: loud ? dark / loud : 0 };
}

// ---------- drawing ----------

function fit(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const r = c.getBoundingClientRect(), d = devicePixelRatio || 1;
  if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
  const g = c.getContext('2d')!; g.setTransform(d, 0, 0, d, 0, 0); return g;
}

interface View { t0: number; t1: number; w: number; h: number; pad: number }
const X = (v: View, t: number) => ((t - v.t0) / (v.t1 - v.t0)) * v.w;
const Y = (v: View, u: number) => v.pad + (1 - u) * (v.h - 2 * v.pad);

function line(g: CanvasRenderingContext2D, v: View, x: Float32Array, hop: number, col: string, lw: number, dash: number[] = [], fill = false) {
  const i0 = Math.max(0, Math.floor(v.t0 / hop)), i1 = Math.min(x.length - 1, Math.ceil(v.t1 / hop));
  const stride = Math.max(1, Math.floor((i1 - i0) / (v.w * 2)));
  g.beginPath();
  for (let i = i0; i <= i1; i += stride) {
    // Over a stride, draw the mean: what the picture gets on average there, not its brightest blink.
    let m = 0, c = 0; for (let k = 0; k < stride && i + k <= i1; k++) { m += x[i + k]; c++; } m /= c;
    const px = X(v, i * hop), py = Y(v, m);
    if (i === i0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  if (fill) { g.lineTo(X(v, i1 * hop), Y(v, 0)); g.lineTo(X(v, i0 * hop), Y(v, 0)); g.closePath(); g.fillStyle = col; g.fill(); return; }
  g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash); g.stroke(); g.setLineDash([]);
}

function plot(c: HTMLCanvasElement, L: Lanes, t0: number, t1: number, close: boolean, showRel: boolean, now: number) {
  const g = fit(c), r = c.getBoundingClientRect(), v: View = { t0, t1, w: r.width, h: r.height, pad: 8 };
  g.clearRect(0, 0, v.w, v.h);
  // sections, alternately shaded
  L.pack.sections.forEach((s, i) => { if (i % 2) { g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(X(v, s.start), 0, X(v, s.end) - X(v, s.start), v.h); } });
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1;
  for (const u of [0, 0.5, 1]) { g.beginPath(); g.moveTo(0, Y(v, u)); g.lineTo(v.w, Y(v, u)); g.stroke(); }
  g.globalAlpha = 0.5; line(g, v, L.today, L.hop, css('--today'), 1, [], true); g.globalAlpha = 1;
  if (close) {
    // the attacks themselves
    g.strokeStyle = css('--today'); g.lineWidth = 1;
    for (const [s, , , vel] of L.pack.notes) if (s >= t0 && s <= t1) { g.beginPath(); g.moveTo(X(v, s), v.h); g.lineTo(X(v, s), v.h - 4 - (vel / 127) * 22); g.stroke(); }
    g.globalAlpha = 0.45; line(g, v, L.momentary, L.hop, css('--energy'), 1); g.globalAlpha = 1;
  }
  line(g, v, L.lane, L.hop, css('--lane'), 1.6, [5, 4]);
  if (showRel) line(g, v, L.rel, L.hop, css('--rel'), 1.2, [2, 3]);
  line(g, v, L.energy, L.hop, css('--energy'), 2.2);
  // the preset's pivots
  g.strokeStyle = css('--follow'); g.fillStyle = css('--follow'); g.lineWidth = 1.8; g.beginPath();
  L.follow.forEach((p, i) => { const px = X(v, p.t), py = Y(v, p.v); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
  g.stroke();
  for (const p of L.follow) if (p.t >= t0 && p.t <= t1) { g.beginPath(); g.arc(X(v, p.t), Y(v, p.v), close ? 3 : 1.6, 0, 7); g.fill(); }
  // loudest moments
  g.fillStyle = css('--peak'); g.font = '11px system-ui';
  L.peaks.forEach((p, i) => { if (p.t < t0 || p.t > t1) return; const px = X(v, p.t); g.fillRect(px - 1, 0, 2, 10); g.fillText(`${i + 1}`, px + 4, 10); });
  // playhead
  g.fillStyle = '#fff'; g.fillRect(X(v, now) - 0.5, 0, 1, v.h);
}

function meters(c: HTMLCanvasElement, L: Lanes, t: number) {
  const g = fit(c), r = c.getBoundingClientRect(), i = Math.max(0, Math.min(L.n - 1, Math.round(t / L.hop)));
  g.clearRect(0, 0, r.width, r.height);
  const rows: [string, number, string][] = [
    ['level today', L.today[i], css('--today')],
    ['lane today', L.lane[i], css('--lane')],
    ['sound', L.energy[i], css('--energy')],
    ['follows', pivotAt(L.follow, t), css('--follow')],
    ['relative', L.rel[i], css('--rel')],
  ];
  const bw = (r.width - 16) / rows.length, top = 10, bottom = r.height - 46;
  rows.forEach(([name, val, col], k) => {
    const x = 8 + k * bw + 6, w = bw - 12, h = (bottom - top) * Math.max(0, Math.min(1, val));
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, top, w, bottom - top);
    g.fillStyle = col; g.fillRect(x, bottom - h, w, h);
    g.fillStyle = css('--fg'); g.font = '12px system-ui'; g.textAlign = 'center';
    g.fillText(val.toFixed(2), x + w / 2, bottom + 15);
    g.fillStyle = css('--dim'); g.font = '10px system-ui';
    const words = name.split(' ');
    words.forEach((word, j) => g.fillText(word, x + w / 2, bottom + 29 + j * 12));
  });
}

// ---------- page ----------

async function main() {
  const params = new URLSearchParams(location.search), sel = $('song') as HTMLSelectElement;
  const songs = ((await (await fetch('/api/songs', { cache: 'no-store' })).json()).songs as { id: string; title: string; error?: string }[])
    .filter((s) => !s.error).sort((a, b) => a.title.localeCompare(b.title));
  const id = params.get('song') ?? (songs.some((s) => s.id === 'barber-adagio') ? 'barber-adagio' : songs[0]?.id);
  for (const s of songs) sel.add(new Option(s.title, s.id, false, s.id === id));
  sel.onchange = () => { location.search = `?song=${encodeURIComponent(sel.value)}`; };
  if (!id) { status('No songs.'); return; }

  const L = await analyse(id);
  const audio = new Audio(`/songs/${id}/${L.pack.audio}`);
  audio.preload = 'auto';
  const dur = L.n * L.hop;
  status(`${L.pack.notes.length} transcribed notes in ${fmt(L.pack.duration)}`);

  const facts = $('facts');
  const peakLinks = L.peaks.map((p, i) => `<a data-t="${p.t}">${i + 1}: ${fmt(p.t)}</a>`).join('');
  facts.innerHTML = `
    <div class="fact"><b>${L.lag.lag.toFixed(1)} s</b><span>how far today's loudness lane runs behind the sound (best match r = ${L.lag.r.toFixed(2)})</span></div>
    <div class="fact"><b>${Math.round(L.dark * 100)} %</b><span>of the time the music is louder than its own median, a widget's <code>level</code> is below 0.1</span></div>
    <div class="fact"><b>${(L.pack.notes.length / (L.pack.duration / 60)).toFixed(0)}</b><span>transcribed notes a minute, the only thing <code>level</code> is made of</span></div>
    <div class="fact"><span>The loudest moments, as a composer's suggestions:</span><div style="margin-top:6px">${peakLinks || '–'}</div></div>`;
  facts.querySelectorAll<HTMLAnchorElement>('a[data-t]').forEach((a) => { a.onclick = () => { audio.currentTime = Math.max(0, +a.dataset.t! - 8); }; });

  const ov = $('overview') as HTMLCanvasElement, de = $('detail') as HTMLCanvasElement, me = $('meters') as HTMLCanvasElement;
  const rel = $('showRel') as HTMLInputElement, play = $('play') as HTMLButtonElement;
  const seekFrom = (c: HTMLCanvasElement, t0: number, t1: number) => (e: MouseEvent) => {
    const r = c.getBoundingClientRect(); audio.currentTime = Math.max(0, Math.min(dur, t0 + ((e.clientX - r.left) / r.width) * (t1 - t0)));
  };
  ov.onclick = (e) => seekFrom(ov, 0, dur)(e);
  de.onclick = (e) => { const t = audio.currentTime; seekFrom(de, t - 12, t + 12)(e); };
  const toggle = () => { if (audio.paused) void audio.play(); else audio.pause(); };
  play.onclick = toggle;
  audio.onplay = () => { play.textContent = 'Pause'; }; audio.onpause = () => { play.textContent = 'Play'; };
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLSelectElement) return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(dur, audio.currentTime + 5);
  });
  if (params.has('t')) audio.currentTime = +params.get('t')!;

  const frame = () => {
    const t = audio.currentTime;
    $('time').textContent = `${fmt(t)} / ${fmt(dur)}`;
    plot(ov, L, 0, dur, false, rel.checked, t);
    plot(de, L, t - 12, t + 12, true, rel.checked, t);
    meters(me, L, t);
    requestAnimationFrame(frame);
  };
  frame();
  Object.assign(window, { energyLanes: L });
}

main().catch((e) => { status(`Failed: ${(e as Error).message}`); console.error(e); });
