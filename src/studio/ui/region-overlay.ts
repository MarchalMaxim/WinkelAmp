/// <reference types="vite/client" />
/**
 * The region overlay on the studio's stage (plan T17): lab/region-ui.js, the same file the lab runs, evaluated here
 * and bound to the store. It shows while the open layer (the panel's selected one) has a region, and hides with the
 * controls or while recording. Each gesture (a drag, a double-click, a held arrow) is one undo step: its edits share
 * the group `region:<section>:<layer>:<n>`, n counting gestures, since History merges a run of one group.
 * It never draws into the canvas.
 */
import type { Region } from '../../widgets/types';
import type { Store, StudioState } from './store';

const FILES = import.meta.glob('/lab/region-ui.js', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export interface RegionUiOptions {
  get(): Region | null;
  set(r: Region, phase: 'drag' | 'end'): void;
  hint?: string | (() => string);
  onClose?(): void;
}
export interface RegionUi { refresh(): void; open(): void; close(): void; draw(): void; readonly visible: boolean; destroy(): void }
export interface WaRegionUi {
  mount(stage: HTMLElement, canvas: HTMLCanvasElement, o: RegionUiOptions): RegionUi;
  pictureRect(stage: HTMLElement, canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number };
  tidy(r: Region): Region;
}

let ui: WaRegionUi | null = null;
/** WA_REGION_UI from lab/region-ui.js's text (evaluated once, with its own `window` so no global is set). */
export function regionUi(): WaRegionUi {
  if (ui) return ui;
  const src = Object.values(FILES)[0];
  if (!src) throw new Error('lab/region-ui.js is missing');
  const scope: { WA_REGION_UI?: WaRegionUi } = {};
  new Function('window', `${src}\n`)(scope);
  if (!scope.WA_REGION_UI) throw new Error('lab/region-ui.js did not define WA_REGION_UI');
  return (ui = scope.WA_REGION_UI);
}

/** The widgets that read the shared canvas: in a window they cut only their own picture (spec Decisions 6). */
export const CANVAS_READERS: readonly string[] = ['casket', 'pixelsort', 'tunnel', 'blocks', 'fold', 'timeslice'];
export const READER_HINT = 'In a window, it cuts only its own picture.';

export interface RegionOverlay {
  /** Follows the store: call from its subscription. */
  update(s: StudioState): void;
  /** Shows the handles again after Esc or "Done". */
  open(): void;
  close(): void;
  /** "Draw on the stage": the next drag on the picture makes the region's box. */
  draw(): void;
  readonly visible: boolean;
  destroy(): void;
}

export function mountRegionOverlay(stage: HTMLElement, canvas: HTMLCanvasElement, store: Store): RegionOverlay {
  let gesture = 0, lastKey = '', hadRegion = false;
  const open = (s: StudioState) => {
    if (!s.show || s.ui.hidden || s.ui.recording || s.selected.layer === null) return null;
    const layer = s.show.sections[s.selected.section]?.layers[s.selected.layer];
    return layer?.region ? { section: s.selected.section, layer: s.selected.layer, widget: layer.widget, region: layer.region } : null;
  };
  const handle = regionUi().mount(stage, canvas, {
    get: () => open(store.state)?.region ?? null,
    set: (r, phase) => {
      const o = open(store.state);
      if (!o) return;
      store.dispatch({ type: 'edit', edit: { kind: 'setLayer', section: o.section, layer: o.layer, patch: { region: r } },
        group: `region:${o.section}:${o.layer}:${gesture}` });
      if (phase === 'end') gesture++;
    },
    hint: () => {
      const o = open(store.state);
      return o && o.region.mode === 'window' && CANVAS_READERS.includes(o.widget) ? READER_HINT : '';
    },
  });
  return {
    update(s) {
      // Another layer opened, or this one got a region: the handles come back after an Esc.
      const o = open(s), key = o ? `${o.section}:${o.layer}` : '';
      if (key !== lastKey || (!!o && !hadRegion)) handle.open();
      lastKey = key; hadRegion = !!o;
      handle.refresh();
    },
    open: () => handle.open(),
    close: () => handle.close(),
    draw: () => handle.draw(),
    get visible() { return handle.visible; },
    destroy: () => handle.destroy(),
  };
}
