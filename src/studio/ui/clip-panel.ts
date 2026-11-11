/**
 * The clip tab's frame in the side panel, around what panel.ts draws (the knobs and the layer controls): the clip's name,
 * where it lies, a way to it when the playhead is elsewhere, what to do with it and how its edges fade. With no clip
 * selected, how to get one.
 */
import { edgeSeconds } from '../show/schedule';
import { DEFAULT_FADE, MAX_FADE, type Clip } from '../show/show';
import { selectedClip, duplicateSelected, removeSelected, splitAt } from './clip-actions';
import { icon } from './icons';
import type { Store } from './store';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const stamp = (s: number): string => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

/** Where the clip is seen at full strength, past its fade: where "go to it" lands. */
export const clipViewTime = (c: Pick<Clip, 'start' | 'end' | 'fade'>): number => Math.min(c.end, c.start + edgeSeconds(c));

export interface ClipPanelOptions { name: string; verdict: string; blurb: string; err?: string; hue: number; picking: boolean }

/** The tab with a clip selected. .params and .layer-controls are panel.ts's to fill. */
export const clipHtml = (o: ClipPanelOptions): string => `
  <header class="clip-head" style="--hue:${o.hue}">
    <h3 class="clip-title"><span class="swatch"></span><b>${esc(o.name)}</b>${o.verdict}</h3>
    <p class="sec-time"></p>
    <p class="layer-parts dim small"></p>
    <p class="sec-where" hidden><span></span> <button type="button" data-act="goto">Go to this clip</button></p>
  </header>
  <div class="sec-actions">
    <button type="button" data-act="duplicate" title="A copy of its own (Ctrl+D)">Duplicate</button>
    <button type="button" data-act="split" title="Split it at the playhead (S)">Split at playhead</button>
    <button type="button" data-act="remove" title="Delete">Delete</button>
    <button type="button" data-act="up" class="icon" aria-label="One track up" title="One track up: draws later, on top">${icon('up')}</button>
    <button type="button" data-act="down" class="icon" aria-label="One track down" title="One track down: draws earlier, beneath">${icon('down')}</button>
  </div>
  <label class="fade"><span>Fades in and out over</span>
    <input type="range" min="0" max="${MAX_FADE}" step="0.25" aria-label="Fade"><output></output></label>
  <p class="blurb">${o.blurb}</p>${o.err ? `<p class="err">${esc(o.err)}</p>` : ''}
  <div class="params"></div>
  <button type="button" class="link" data-defaults hidden>Back to the widget's own settings</button>
  <div class="layer-controls"></div>
  ${addHtml(o.picking)}`;

const addHtml = (picking: boolean): string => `
  <h3 class="layers-title">Add a widget <span class="dim">at the playhead, on top</span></h3>
  <button type="button" class="add" data-act="add" aria-expanded="${picking}" title="Or press Ctrl+P and type its name">${picking ? 'Close the collection' : 'Open the collection'}</button>
  <div class="picker" ${picking ? '' : 'hidden'}></div>`;

/** The tab with nothing selected. */
export const noClipHtml = (picking: boolean): string => `
  <p class="clip-none dim">Click a clip on the timeline to set its knobs, or add one: it lands at the playhead.</p>
  ${addHtml(picking)}`;

/** The buttons of the tab with a clip selected. */
export function wireClip(body: HTMLElement, store: Store, d: { time(): number; seek(t: number): void }): void {
  const clip = () => selectedClip(store.state);
  const act = (name: string, run: () => void) => body.querySelector(`[data-act="${name}"]`)?.addEventListener('click', run);
  act('goto', () => { const c = clip(); if (c) d.seek(clipViewTime(c)); });
  act('duplicate', () => duplicateSelected(store));
  act('remove', () => removeSelected(store));
  act('split', () => splitAt(store, d.time()));
  const lift = (by: number) => {
    const c = clip();
    if (c) store.dispatch({ type: 'edit', edit: { kind: 'moveClip', clip: c.id, start: c.start, track: c.track + by } });
  };
  act('up', () => lift(1));
  act('down', () => lift(-1));
  const fade = body.querySelector<HTMLInputElement>('.fade input');
  fade?.addEventListener('input', () => {
    const c = clip();
    if (c) store.dispatch({ type: 'edit', edit: { kind: 'setClip', clip: c.id, patch: { fade: Number(fade.value) } }, group: `fade:${c.id}` });
  });
}

/** In step with the show: its times, its fade, the way to it. */
export function syncClip(body: HTMLElement, c: Clip): void {
  const time = body.querySelector('.sec-time');
  if (time) time.textContent = `${stamp(c.start)} – ${stamp(c.end)} (${Math.round(c.end - c.start)} s), track ${c.track + 1}`;
  const fade = body.querySelector<HTMLInputElement>('.fade input'), out = body.querySelector('.fade output'), f = c.fade ?? DEFAULT_FADE;
  if (fade && document.activeElement !== fade) fade.value = String(f);
  // A fade longer than half the clip meets itself in the middle: say what it does.
  if (out) out.textContent = f === 0 ? 'a cut' : `${Math.round(edgeSeconds({ ...c, fade: f }) * 100) / 100} s`;
  const down = body.querySelector<HTMLButtonElement>('[data-act="down"]');
  if (down) down.disabled = c.track === 0;
}
