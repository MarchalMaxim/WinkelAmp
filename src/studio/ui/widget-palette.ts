/**
 * Ctrl+P: a widget by typing, as in an editor. Type part of a name (or a feel word, an instrument), arrows to move,
 * Enter to take it. A native <dialog>: Escape closes it, and with the focus in its field the studio's keys stay out.
 */
import './widget-palette.css';
import { thumbHtml } from '../../widgets/thumbs';
import type { WidgetMeta } from '../../widgets/types';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** Whether the letters of `word` come in order in `text`, each new word of `text` counting for more: "bg" finds "Brass gust". */
function initials(word: string, text: string): number {
  let at = 0, starts = 0;
  for (const ch of word) {
    const i = text.indexOf(ch, at);
    if (i < 0) return 0;
    if (i === 0 || text[i - 1] === ' ') starts++;
    at = i + 1;
  }
  return starts === word.length ? 20 : word.length >= 3 ? 8 : 0;
}

/** How well one typed word fits a widget, 0 for not at all. The name counts most, then the feel words and instruments. */
function fit(word: string, m: WidgetMeta): number {
  const name = m.name.toLowerCase(), t = m.tags;
  if (name === word) return 120;
  if (name.startsWith(word)) return 100;
  if (name.includes(` ${word}`)) return 80;
  if (name.includes(word) || m.id.toLowerCase().includes(word)) return 60;
  if (t?.feel.includes(word)) return 45;
  if (t?.feel.some((w) => w.startsWith(word))) return 35;
  if (t?.instruments.some((w) => w.startsWith(word))) return 30;
  return initials(word, name) || (word.length >= 3 && m.blurb.toLowerCase().includes(word) ? 5 : 0);
}

/** The widgets that fit every typed word, best first, ties in the order given. Nothing typed: all, in that order. */
export function rankWidgets(metas: readonly WidgetMeta[], query: string): WidgetMeta[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...metas];
  const scored: { m: WidgetMeta; s: number; i: number }[] = [];
  metas.forEach((m, i) => {
    let s = 0;
    for (const w of words) { const f = fit(w, m); if (!f) return; s += f; }
    scored.push({ m, s, i });
  });
  return scored.sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.m);
}

export interface PaletteRequest {
  /** What taking a widget does, in a few words ("Add to calm"). */
  title: string;
  metas: readonly WidgetMeta[];
  /** Already there: listed first with nothing typed, and `hereWord` says so. */
  here?: ReadonlySet<string>;
  hereWord?: string;
  verdict(m: WidgetMeta): string;
  hue(id: string): number;
  pick(id: string): void;
}

export class WidgetPalette {
  private readonly dlg = document.createElement('dialog');
  private req: PaletteRequest | null = null;
  private shown: WidgetMeta[] = [];
  private at = 0;

  constructor() {
    this.dlg.className = 'palette';
    this.dlg.setAttribute('aria-label', 'Find a widget');
    this.dlg.innerHTML = `<div class="palette-head"><input type="text" spellcheck="false" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-label="Find a widget" placeholder="Type a name, a feel, an instrument"><span class="palette-title dim small"></span></div>
      <ul class="palette-list" id="palette-list" role="listbox" aria-label="Widgets"></ul>
      <p class="palette-foot dim small"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> take it · <kbd>Esc</kbd> close</p>`;
    document.body.append(this.dlg);
    this.input.addEventListener('input', () => { this.at = 0; this.draw(); });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this.move(e.key === 'ArrowDown' ? 1 : -1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.take(this.shown[this.at]); }
    });
    this.list.addEventListener('click', (e) => {
      const li = (e.target as Element).closest<HTMLElement>('[data-i]');
      if (li) this.take(this.shown[Number(li.dataset.i)]);
    });
    this.dlg.addEventListener('click', (e) => { if (e.target === this.dlg) this.close(); });   // the backdrop
  }

  private get input(): HTMLInputElement { return this.dlg.querySelector('input')!; }
  private get list(): HTMLElement { return this.dlg.querySelector('.palette-list')!; }
  get isOpen(): boolean { return this.dlg.open; }

  open(req: PaletteRequest): void {
    this.req = req;
    this.dlg.querySelector('.palette-title')!.textContent = req.title;
    this.input.value = ''; this.at = 0;
    this.draw();
    this.dlg.showModal();
    this.input.focus();
  }

  close(): void { if (this.dlg.open) this.dlg.close(); }

  private take(m: WidgetMeta | undefined): void {
    if (!m || !this.req) return;
    const pick = this.req.pick;
    this.close();
    pick(m.id);
  }

  private move(by: number): void {
    if (!this.shown.length) return;
    this.at = (this.at + by + this.shown.length) % this.shown.length;
    this.mark();
  }

  private mark(): void {
    this.list.querySelectorAll<HTMLElement>('[data-i]').forEach((li) => {
      const on = Number(li.dataset.i) === this.at;
      li.setAttribute('aria-selected', String(on));
      if (on) { li.scrollIntoView({ block: 'nearest' }); this.input.setAttribute('aria-activedescendant', li.id); }
    });
  }

  private draw(): void {
    const r = this.req!, q = this.input.value, here = r.here ?? new Set<string>();
    const ranked = rankWidgets(r.metas, q);
    this.shown = q.trim() ? ranked : [...ranked.filter((m) => here.has(m.id)), ...ranked.filter((m) => !here.has(m.id))];
    this.list.innerHTML = this.shown.length ? this.shown.map((m, i) => `<li role="option" id="palette-${i}" data-i="${i}" aria-selected="false">
        ${thumbHtml(m.id, r.hue(m.id))}
        <span class="palette-text"><span class="palette-name"><b>${esc(m.name)}</b>${r.verdict(m)}${here.has(m.id) ? `<span class="dim small">${esc(r.hereWord ?? '')}</span>` : ''}</span>
        <span class="palette-words dim small">${esc((m.tags?.feel ?? []).join(' · '))}</span></span></li>`).join('')
      : '<li class="palette-none dim">No widget fits that. Try fewer letters.</li>';
    this.mark();
  }
}
