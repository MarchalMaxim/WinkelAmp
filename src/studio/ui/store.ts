/**
 * The studio's state (plan §7): the song, its show, what is selected and saved, the notices. Show edits go through
 * applyEdit and are recorded for undo; the selection is clamped after every change.
 */
import type { SongPack } from '../pack/pack';
import { applyEdit, type ShowEdit } from '../show/edit';
import { History } from '../show/history';
import { canonicalShow, type Show } from '../show/show';
import type { LibraryEntry } from './api';

export interface StudioState {
  library: LibraryEntry[]; song: SongPack | null; show: Show | null;
  /** canonicalShow of the last saved/loaded show; dirty = canonicalShow(show) !== saved */
  saved: string | null;
  origin: 'file' | 'auto' | 'repaired' | null; selected: { section: number; layer: number | null };
  playing: boolean; time: number; ui: { hidden: boolean; recording: boolean };
  notices: { id: string; level: 'info' | 'warn' | 'error'; text: string }[];
}
export type Notice = StudioState['notices'][number];

export type Action = { type: 'edit'; edit: ShowEdit; group?: string } | { type: 'undo' } | { type: 'redo' }
  | { type: 'select'; section: number; layer?: number | null } | { type: 'saved' }
  /** keepUndo: the show before the load stays one undo away (a show reloaded from disk over unsaved edits). */
  | { type: 'loaded'; song: SongPack; show: Show; origin: StudioState['origin']; keepUndo?: boolean }
  | { type: 'notice'; notice: Notice } | { type: 'dismiss'; id: string }
  | { type: 'ui'; patch: Partial<StudioState['ui']> };

export const isDirty = (s: StudioState): boolean => !!s.show && canonicalShow(s.show) !== s.saved;

export class Store {
  readonly state: StudioState = {
    library: [], song: null, show: null, saved: null, origin: null, selected: { section: 0, layer: null },
    playing: false, time: 0, ui: { hidden: false, recording: false }, notices: [],
  };
  readonly history = new History();
  private readonly subs = new Set<(s: StudioState) => void>();

  dispatch(a: Action): void {
    const s = this.state;
    switch (a.type) {
      case 'edit': {
        if (!s.show || s.ui.recording) return;
        let next = applyEdit(s.show, a.edit);
        if (next === s.show) return;
        // Reshaped by hand, a composed show is yours now (when it was composed stays); undo gives the composed one back.
        if (next.composer && next.composer.by !== 'user') next = { ...next, composer: { ...next.composer, by: 'user' } };
        this.history.record(s.show, a.group);
        s.show = next;
        break;
      }
      case 'undo': case 'redo': {
        if (!s.show || s.ui.recording) return;
        const next = a.type === 'undo' ? this.history.undo(s.show) : this.history.redo(s.show);
        if (!next) return;
        s.show = next;
        break;
      }
      case 'select': s.selected = { section: a.section, layer: a.layer === undefined ? (a.section === s.selected.section ? s.selected.layer : null) : a.layer }; break;
      case 'saved': if (s.show) s.saved = canonicalShow(s.show); if (s.origin !== 'file') s.origin = 'file'; break;
      case 'loaded':
        if (a.keepUndo && s.show && s.show !== a.show) this.history.record(s.show);
        else this.history.clear();
        s.song = a.song; s.show = a.show; s.origin = a.origin;
        s.saved = a.origin === 'repaired' ? null : canonicalShow(a.show);   // a repaired show is unsaved until saved
        break;
      case 'notice': s.notices = [...s.notices.filter((n) => n.id !== a.notice.id), a.notice]; break;
      case 'dismiss': s.notices = s.notices.filter((n) => n.id !== a.id); break;
      case 'ui': s.ui = { ...s.ui, ...a.patch }; break;
    }
    this.clamp();
    for (const fn of this.subs) fn(s);
  }

  /** Library, playing and time change often or from outside: set them, then call notify(). */
  notify(): void { for (const fn of this.subs) fn(this.state); }

  subscribe(fn: (s: StudioState) => void): () => void { this.subs.add(fn); return () => this.subs.delete(fn); }

  private clamp(): void {
    const s = this.state, n = s.show?.sections.length ?? 0;
    const section = Math.max(0, Math.min(n - 1, s.selected.section));
    const layers = s.show?.sections[section]?.layers.length ?? 0;
    let layer = s.selected.layer;
    if (layer !== null) layer = layers ? Math.max(0, Math.min(layers - 1, layer)) : null;
    if (section !== s.selected.section || layer !== s.selected.layer) s.selected = { section, layer };
  }
}
