/**
 * What the timeline's buttons, the panel and the keys do to the selected clip, one place each. An edit that makes a clip
 * selects it, so its knobs and lane are open at once.
 */
import type { SongPack } from '../pack/pack';
import { nextClipId, type Clip } from '../show/show';
import { studioLayers } from '../../widgets/layers-source';
import { labTags } from '../../widgets/sources';
import { tagsOf } from '../../widgets/tags';
import { placedListen } from './layer-controls';
import type { Store, StudioState } from './store';
import { newClipSpan } from './timeline-logic';

export const selectedClip = (s: StudioState): Clip | null => (s.selected.clip === null ? null : s.show?.clips.find((c) => c.id === s.selected.clip) ?? null);

/** A new clip of this widget at time t, on top of what plays there, selected. It hears its usual kind of note if the
    stretch holds enough of it. */
export function addWidgetAt(store: Store, pack: Pick<SongPack, 'notes' | 'tracks'>, widget: string, t: number, duration: number, marks: readonly number[]): void {
  const show = store.state.show;
  if (!show) return;
  const span = newClipSpan(t, duration, marks), id = nextClipId(show.clips);
  const listen = placedListen(studioLayers(), pack, span, tagsOf(labTags(), widget)?.noteType);
  store.dispatch({ type: 'edit', edit: { kind: 'addClip', widget, ...span, ...(listen ? { listen } : {}) } });
  if (store.state.show !== show) store.dispatch({ type: 'select', clip: id });
}

export function removeSelected(store: Store): void {
  const c = selectedClip(store.state);
  if (c) store.dispatch({ type: 'edit', edit: { kind: 'removeClip', clip: c.id } });
}

/** The copy is selected. */
export function duplicateSelected(store: Store): void {
  const c = selectedClip(store.state), show = store.state.show;
  if (!c || !show) return;
  const id = nextClipId(show.clips);
  store.dispatch({ type: 'edit', edit: { kind: 'duplicateClip', clip: c.id } });
  if (store.state.show !== show) store.dispatch({ type: 'select', clip: id });
}

/** The selected clip at t, or the topmost one playing there when none is selected or it is not playing then. The later
    half stays selected. Says so when t is too near an edge. */
export function splitAt(store: Store, t: number): void {
  const s = store.state, show = s.show;
  if (!show || s.ui.recording) return;
  const sel = selectedClip(s), here = (c: Clip) => c.start < t && t < c.end;
  const c = sel && here(sel) ? sel : [...show.clips].filter(here).sort((a, b) => b.track - a.track)[0];
  if (!c) { store.dispatch({ type: 'notice', notice: { id: 'split', level: 'info', text: 'No clip plays at the playhead to split.' } }); return; }
  const id = nextClipId(show.clips);
  store.dispatch({ type: 'edit', edit: { kind: 'splitClip', clip: c.id, t } });
  if (store.state.show === show) store.dispatch({ type: 'notice', notice: { id: 'split', level: 'info', text: 'Too close to where the clip starts or ends to split it.' } });
  else store.dispatch({ type: 'select', clip: id });
}
