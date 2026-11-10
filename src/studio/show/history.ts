/**
 * Undo for show edits. record(before) is called with the show as it was before each edit; records in the
 * same group in a row (a slider drag, a boundary drag) are one step. Shows are immutable, so steps hold references.
 */
import type { Show } from './show';

export class History {
  private past: Show[] = [];
  private future: Show[] = [];
  private group: string | undefined;

  constructor(private readonly limit = 200) {}

  record(before: Show, group?: string): void {
    this.future = [];
    if (group !== undefined && group === this.group && this.past.length) return;   // the step already holds the start
    this.group = group;
    this.past.push(before);
    if (this.past.length > this.limit) this.past.shift();
  }

  undo(current: Show): Show | null {
    const s = this.past.pop();
    if (!s) return null;
    this.future.push(current); this.group = undefined;
    return s;
  }

  redo(current: Show): Show | null {
    const s = this.future.pop();
    if (!s) return null;
    this.past.push(current); this.group = undefined;
    return s;
  }

  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }

  clear(): void { this.past = []; this.future = []; this.group = undefined; }
}
