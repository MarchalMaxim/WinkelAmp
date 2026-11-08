/**
 * A layer's knobs as the lab draws them (lab/index.html paramHTML/drawIcon): the picture at each end of the slider,
 * the live one by the name (redrawn as the music drives it), the `i` hint, and what the knob follows in plain words.
 * Knobs without a picture or a hint keep the lab's compact one-line row.
 */
import { knobValue } from '../../widgets/features';
import type { Drive, Features, IconLib, KnobState, Param } from '../../widgets/types';
import type { KnobSetting } from '../show/show';

const IW = 40, IH = 26;

/** The lab's drawIcon: 40×26 CSS px at the screen's density, ICON.ink, line width 1.5, round caps; a broken icon → gauge. */
export function drawIcon(cv: HTMLCanvasElement, q: Param, v: number, icon: IconLib): void {
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(IW * dpr)) { cv.width = Math.round(IW * dpr); cv.height = Math.round(IH * dpr); }
  const ig = cv.getContext('2d')!, paint = (fn: (g: CanvasRenderingContext2D, v: number, w: number, h: number) => void) => {
    ig.setTransform(dpr, 0, 0, dpr, 0, 0); ig.clearRect(0, 0, IW, IH); ig.save();
    ig.fillStyle = ig.strokeStyle = icon.ink; ig.lineWidth = 1.5; ig.lineCap = 'round'; ig.lineJoin = 'round';
    try { fn(ig, Math.max(0, Math.min(1, v)), IW, IH); return true; } catch { return false; } finally { ig.restore(); }
  };
  if (!(typeof q.icon === 'function' && paint(q.icon))) paint(icon.gauge);
}

export const norm = (q: Param, x: number): number => (q.max > q.min ? (x - q.min) / (q.max - q.min) : 0);

/** The knob's state in a layer: the widget's default, with the layer's setting over it. */
export function knobState(q: Param, setting: KnobSetting | undefined): KnobState {
  const s: KnobState = { base: q.value, drive: q.drive ?? '', depth: 0.5 };
  if (typeof setting === 'number') s.base = setting;
  else if (setting && typeof setting === 'object') Object.assign(s, setting);
  return s;
}

/** What goes into the show for a state: nothing when it is the default, a number when only the base moved. */
export function settingOf(q: Param, s: KnobState): KnobSetting | null {
  const driveDefault = s.drive === (q.drive ?? ''), depthDefault = s.depth === 0.5;
  if (driveDefault && depthDefault) return s.base === q.value ? null : s.base;
  const out: { base: number; drive: Drive; depth?: number } = { base: s.base, drive: s.drive };
  if (!depthDefault) out.depth = s.depth;
  return out;
}

/** The 'how strongly' slider moves in steps of 0.05; rounding keeps 0.5 exactly 0.5, so settingOf drops it again. */
export const roundDepth = (v: number): number => Math.min(1, Math.max(0, Math.round(v * 20) / 20));

const DEPTH_TITLE = 'How strongly it follows the music. Left: hardly. Right: across its whole range.';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export interface KnobRow { el: HTMLElement; q: Param; live: HTMLCanvasElement | null; sync(s: KnobState): void; drawLive(f: Features): void }

/**
 * How a knob moved: 'move' during a pointer drag, 'end' when a drag or a choice is done, 'step' for a key press on the
 * slider (each press is a whole change; the caller groups presses that follow each other closely).
 */
export type KnobPhase = 'move' | 'end' | 'step';

/** One knob row. onChange gets the new state; the row keeps its own inputs in step (sync) when the show changes. */
export function knobRow(q: Param, state: KnobState, drives: [Drive, string][], icon: IconLib, onChange: (s: KnobState, phase: KnobPhase) => void): KnobRow {
  const label = esc(q.label ?? q.key);
  const el = document.createElement('div');
  // How present only moves the other knobs: there is nothing for the music to drive.
  const select = q.leads ? '<span></span>' : `<select data-k aria-label="${label}: what it follows">${drives.map(([d, word]) => `<option value="${d}">${esc(word)}</option>`).join('')}</select>`;
  // How strongly: only while the knob follows something (hidden when fixed), and never for how present.
  const depth = q.leads ? '' : `<input type="range" class="depth" data-k aria-label="${label}: how strongly" title="${DEPTH_TITLE}" min="0" max="1" step="0.05">`;
  const slider = `<input type="range" data-k aria-label="${label}" min="${q.min}" max="${q.max}" step="${q.step ?? (q.max - q.min) / 100}">`;
  const rich = !!(q.icon || q.hint);
  el.className = rich ? 'prm' : 'prm plain';
  el.dataset.p = q.key;
  el.innerHTML = rich
    ? `<div class="top"><canvas class="live" data-i="live"></canvas><span class="name">${label}</span>${q.hint ? '<button type="button" class="info" data-info aria-label="what is this?">i</button>' : '<span></span>'}${select}</div>
       <div class="row"><canvas data-i="0"></canvas>${slider}<canvas data-i="1"></canvas>${depth}</div>${q.hint ? `<div class="hint">${esc(q.hint)}</div>` : ''}`
    : `<span class="name">${label}</span>${slider}${depth}${select}`;
  const input = el.querySelector<HTMLInputElement>('input:not(.depth)')!, sel = el.querySelector('select'), dep = el.querySelector<HTMLInputElement>('input.depth');
  const [live, i0, i1] = ['live', '0', '1'].map((k) => el.querySelector<HTMLCanvasElement>(`canvas[data-i="${k}"]`));
  let cur = { ...state };
  if (live && i0 && i1) { drawIcon(i0, q, 0, icon); drawIcon(i1, q, 1, icon); }
  el.querySelector('[data-info]')?.addEventListener('click', () => el.classList.toggle('open'));
  const row: KnobRow = {
    el, q, live,
    sync(s) {
      cur = { ...s };
      if (Number(input.value) !== s.base) input.value = String(s.base);   // a drag already shows its value; an undo moves it back
      if (sel) sel.value = s.drive;
      if (dep) { if (Number(dep.value) !== s.depth) dep.value = String(s.depth); dep.hidden = !s.drive; }
      if (live) drawIcon(live, q, norm(q, s.base), icon);
    },
    drawLive(f) { if (live) drawIcon(live, q, norm(q, knobValue(q, cur, f)), icon); },
  };
  let pointer = false;   // the last thing to move the slider: a pointer (drag) or a key
  input.addEventListener('pointerdown', () => { pointer = true; });
  input.addEventListener('keydown', () => { pointer = false; });
  input.addEventListener('input', () => {
    cur = { ...cur, base: Number(input.value) };
    if (live) drawIcon(live, q, norm(q, cur.base), icon);
    onChange(cur, pointer ? 'move' : 'step');
  });
  input.addEventListener('change', () => { if (pointer) onChange({ ...cur, base: Number(input.value) }, 'end'); });
  sel?.addEventListener('change', () => {
    // A knob stored fixed with depth 0 would not move with its new drive: picking one (an edit) starts it at the middle.
    cur = { ...cur, drive: sel.value as Drive, ...(sel.value && !cur.depth ? { depth: 0.5 } : {}) };
    if (dep) { dep.hidden = !cur.drive; dep.value = String(cur.depth); }
    onChange(cur, 'end');
  });
  // The 'how strongly' slider: pointer and keys as with the knob's own slider.
  if (dep) {
    let depPointer = false;
    dep.addEventListener('pointerdown', () => { depPointer = true; });
    dep.addEventListener('keydown', () => { depPointer = false; });
    dep.addEventListener('input', () => {
      cur = { ...cur, depth: roundDepth(Number(dep.value)) };
      onChange(cur, depPointer ? 'move' : 'step');
    });
    dep.addEventListener('change', () => { if (depPointer) onChange({ ...cur, depth: roundDepth(Number(dep.value)) }, 'end'); });
  }
  input.value = String(state.base); if (sel) sel.value = state.drive;
  row.sync(state);
  return row;
}
