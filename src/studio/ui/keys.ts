/**
 * The studio's keys (plan §7): Space play/pause · ←/→ ∓5 s · Shift+←/→ previous/next section start · F full screen ·
 * H hide the controls · S split at the playhead · Delete (or Backspace) remove the selected layer · Ctrl+Z undo ·
 * Ctrl+Shift+Z / Ctrl+Y redo · Ctrl+S save. Ignored while typing; arrows are left to a focused slider or list.
 */
export interface KeyActions {
  toggle(): void; nudge(s: number): void; section(dir: -1 | 1): void; fullscreen(): void; hideUi(): void;
  split(): void; removeLayer(): void; undo(): void; redo(): void; save(): void;
}

export type KeyAction = keyof KeyActions;

/** What a key does, given where the focus is. Pure, for the tests and the listener. */
export function keyAction(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
  focus: { typing: boolean; control: boolean }): { action: KeyAction; arg?: number } | null {
  const mod = e.ctrlKey || e.metaKey, k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (mod && !e.altKey) {
    if (k === 's') return { action: 'save' };                        // even while typing: saving is never a surprise
    if (focus.typing) return null;                                   // the field's own undo
    if (k === 'z') return { action: e.shiftKey ? 'redo' : 'undo' };
    if (k === 'y') return { action: 'redo' };
    return null;
  }
  if (focus.typing || e.altKey) return null;
  if (e.code === 'Space' || k === ' ') return { action: 'toggle' };
  if (k === 'ArrowLeft' || k === 'ArrowRight') {
    if (focus.control) return null;                                  // a slider or select moves itself
    const dir = k === 'ArrowLeft' ? -1 : 1;
    return e.shiftKey ? { action: 'section', arg: dir } : { action: 'nudge', arg: dir * 5 };
  }
  if (e.shiftKey) return null;
  if (k === 'f') return { action: 'fullscreen' };
  if (k === 'h') return { action: 'hideUi' };
  if (k === 's') return { action: 'split' };
  if (k === 'Delete' || k === 'Backspace') return { action: 'removeLayer' };   // a Mac's delete key sends Backspace
  return null;
}

function focusOf(el: Element | null): { typing: boolean; control: boolean } {
  const tag = el?.tagName ?? '';
  const type = (el as HTMLInputElement | null)?.type ?? '';
  const typing = tag === 'TEXTAREA' || (el as HTMLElement | null)?.isContentEditable === true
    || (tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(type));
  const control = tag === 'SELECT' || (tag === 'INPUT' && type === 'range');
  return { typing, control };
}

export function installKeys(a: KeyActions): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing) return;
    const r = keyAction(e, focusOf(document.activeElement));
    if (!r) return;
    e.preventDefault();   // Space on a focused button would also click it; Ctrl+S would save the page
    switch (r.action) {
      case 'nudge': a.nudge(r.arg!); break;
      case 'section': a.section(r.arg as -1 | 1); break;
      default: a[r.action]();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
