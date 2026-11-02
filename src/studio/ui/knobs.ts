/**
 * A layer's knobs as the lab draws them (lab/index.html paramHTML/drawIcon): the picture at each end of the slider,
 * the live one by the name (redrawn as the music drives it), the `i` hint, and what the knob follows in plain words.
 * Knobs without a picture or a hint keep the lab's compact one-line row.
 */
import { HOW_MUCH, knobValue } from '../../widgets/features';
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

/** What moving how present puts in the show: its own setting and each follower's new base, drives kept. */
export function presentEdit(params: readonly Param[], q: Param, st: KnobState, now: Record<string, KnobSetting> | undefined, bases: Record<string, number>): Record<string, KnobSetting | null> {
  const values: Record<string, KnobSetting | null> = { [q.key]: settingOf(q, st) };
  for (const f of params) if (f.key in bases) values[f.key] = settingOf(f, { ...knobState(f, now?.[f.key]), base: bases[f.key] });
  return values;
}

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
  const select = q.key === HOW_MUCH ? '<span></span>' : `<select data-k aria-label="${label}: what it follows">${drives.map(([d, word]) => `<option value="${d}">${esc(word)}</option>`).join('')}</select>`;
  const slider = `<input type="range" data-k aria-label="${label}" min="${q.min}" max="${q.max}" step="${q.step ?? (q.max - q.min) / 100}">`;
  const rich = !!(q.icon || q.hint);
  el.className = rich ? 'prm' : 'prm plain';
  el.dataset.p = q.key;
  el.innerHTML = rich
    ? `<div class="top"><canvas class="live" data-i="live"></canvas><span class="name">${label}</span>${q.hint ? '<button type="button" class="info" data-info aria-label="what is this?">i</button>' : '<span></span>'}${select}</div>
       <div class="row"><canvas data-i="0"></canvas>${slider}<canvas data-i="1"></canvas></div>${q.hint ? `<div class="hint">${esc(q.hint)}</div>` : ''}`
    : `<span class="name">${label}</span>${slider}${select}`;
  const input = el.querySelector('input')!, sel = el.querySelector('select');
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
  sel?.addEventListener('change', () => { cur = { ...cur, drive: sel.value as Drive }; onChange(cur, 'end'); });
  input.value = String(state.base); if (sel) sel.value = state.drive;
  row.sync(state);
  return row;
}
