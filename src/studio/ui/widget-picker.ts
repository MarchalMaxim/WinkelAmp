/**
 * The widget picker (plan 2026-10-31 T16): the collection grouped by the user's verdicts, each widget with its feel
 * words as chips, above it a filter on feel words (by axis) and instruments (by family), and "suits this song" (one of
 * its instruments plays in this recording). The tags are lab/tags.json's, in lab/tag-words.json's vocabulary.
 */
import './widget-picker.css';
import { TRACKS, isTrackId } from '../pack/instruments';
import { NOTE_TYPE_LABELS, tracksFor, type TagWords } from '../../widgets/tags';
import { thumbHtml } from '../../widgets/thumbs';
import type { WidgetMeta } from '../../widgets/types';

export interface PickerFilter { feel: readonly string[]; instruments: readonly string[]; tracks: readonly string[] | null }

/** Whether an instrument word suits a song with these tracks: a track it names is there, a family it names has a
    track there, or it is the full ensemble ('all') and the song has two tracks or more. */
function suits(instrument: string, tracks: readonly string[], words: TagWords): boolean {
  return tracksFor(instrument, words).some((t) => {
    if (t === 'all') return tracks.length >= 2;
    if (t.startsWith('family:')) { const f = t.slice(7); return tracks.some((id) => isTrackId(id) && TRACKS[id].family === f); }
    return tracks.includes(t);
  });
}

/** The widgets that have every chosen feel word and every chosen instrument word, and, when `tracks` is given
    ("suits this song": the pack's track ids), one instrument that suits them. Order kept; an untagged widget passes
    only when nothing is chosen. */
export function filterWidgets(metas: readonly WidgetMeta[], f: PickerFilter, words: TagWords): WidgetMeta[] {
  const any = f.feel.length || f.instruments.length || f.tracks !== null;
  return metas.filter((m) => {
    if (!any) return true;
    const t = m.tags;
    if (!t) return false;
    if (!f.feel.every((w) => t.feel.includes(w))) return false;
    if (!f.instruments.every((w) => t.instruments.includes(w))) return false;
    return f.tracks === null || t.instruments.some((w) => suits(w, f.tracks!, words));
  });
}

// ---- The DOM ----------------------------------------------------------------------------------------------------

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

const FAMILY_WORDS: Record<string, string> = {
  keys: 'Keys', plucked: 'Plucked', strings: 'Strings', winds: 'Winds', brass: 'Brass', percussion: 'Percussion',
  voice: 'Voice', ensemble: 'Ensemble',
};

/** What the picker keeps between redraws (the panel holds it, so a closed and reopened picker keeps its filter). */
export interface PickerState { feel: string[]; instruments: string[]; suits: boolean; open: boolean }
export const newPickerState = (): PickerState => ({ feel: [], instruments: [], suits: false, open: false });

export interface PickerDeps {
  /** In the collection's order. */
  metas: readonly WidgetMeta[];
  words: TagWords;
  /** The song's track ids (pack v2), [] without. */
  tracks: readonly string[];
  /** Widgets already playing here (said so; a second copy is welcome). */
  here: ReadonlySet<string>;
  state: PickerState;
  /** Groups in order (titles), and which group a widget is in. */
  groups: readonly string[]; groupOf(m: WidgetMeta): number;
  /** The verdict chip (panel.ts verdictTag) and the widget's hue. */
  verdict(m: WidgetMeta): string; hue(id: string): number;
  pick(id: string): void;
}

/** Draws the picker into `box` (again on every filter change). */
export function mountWidgetPicker(box: HTMLElement, d: PickerDeps): void {
  const st = d.state, hasTracks = d.tracks.length > 0;
  const draw = () => {
    const f: PickerFilter = { feel: st.feel, instruments: st.instruments, tracks: st.suits && hasTracks ? d.tracks : null };
    const shown = filterWidgets(d.metas, f, d.words), active = st.feel.length + st.instruments.length + (f.tracks ? 1 : 0);
    const chip = (kind: 'feel' | 'instruments', w: string, title = '') =>
      `<button type="button" class="wp-chip${(st[kind] as string[]).includes(w) ? ' on' : ''}" data-${kind === 'feel' ? 'feel' : 'inst'}="${esc(w)}" aria-pressed="${(st[kind] as string[]).includes(w)}"${title ? ` title="${esc(title)}"` : ''}>${esc(w)}</button>`;
    const byFamily = new Map<string, string[]>();
    for (const [w, v] of Object.entries(d.words.instruments)) byFamily.set(v.family, [...(byFamily.get(v.family) ?? []), w]);
    const groups = d.groups.map((title, gi) => ({ title, items: shown.filter((m) => d.groupOf(m) === gi) })).filter((g) => g.items.length);
    box.innerHTML = `
      <div class="wp-filter">
        <div class="wp-bar">
          <button type="button" class="wp-toggle" aria-expanded="${st.open}">${st.open ? 'Hide the filter' : 'Filter by feel or instrument'}</button>
          <label class="wp-suits" title="${hasTracks ? 'Widgets with an instrument that plays in this recording' : 'This song has no instrument tracks'}">
            <input type="checkbox" ${st.suits && hasTracks ? 'checked' : ''} ${hasTracks ? '' : 'disabled'}> Suits this song</label>
        </div>
        ${active ? `<p class="wp-active"><span>${shown.length} of ${d.metas.length} widgets${st.feel.length || st.instruments.length ? `: ${[...st.feel, ...st.instruments].map(esc).join(' + ')}` : ''}${f.tracks ? `${st.feel.length || st.instruments.length ? ',' : ':'} suiting this song` : ''}</span>
          <button type="button" class="link" data-clear>Clear the filter</button></p>` : ''}
        ${st.open ? `<div class="wp-words">
          <div class="wp-head">Feel</div>
          ${Object.entries(d.words.feel).map(([axis, ws]) => `<div class="wp-axis"><span class="wp-axis-name">${esc(axis)}</span>
            <span class="wp-chips">${Object.entries(ws).map(([w, v]) => chip('feel', w, v.looks)).join('')}</span></div>`).join('')}
          <div class="wp-head inst">Instruments that suit it</div>
          ${[...byFamily].map(([fam, ws]) => `<div class="wp-axis"><span class="wp-axis-name">${esc(FAMILY_WORDS[fam] ?? fam)}</span>
            <span class="wp-chips">${ws.map((w) => chip('instruments', w, d.words.instruments[w].label)).join('')}</span></div>`).join('')}
        </div>` : ''}
      </div>
      ${groups.length ? groups.map((g) => `<section><h4>${esc(g.title)}</h4><ul>${g.items.map((m) => {
        const t = m.tags, on = new Set([...st.feel, ...st.instruments]);
        return `<li><button type="button" class="pick" data-id="${esc(m.id)}" style="--hue:${d.hue(m.id)}">
          ${thumbHtml(m.id, d.hue(m.id))}
          <span class="pick-text"><span class="pick-name"><span class="swatch"></span><b>${esc(m.name)}</b>${d.verdict(m)}${d.here.has(m.id) ? '<span class="dim small">playing here</span>' : ''}</span>
          <span class="blurb">${m.blurb}</span>
          ${t ? `<span class="wp-tags">${t.feel.map((w) => `<span class="wp-tag${on.has(w) ? ' on' : ''}">${esc(w)}</span>`).join('')}${t.instruments.length
            ? `<span class="wp-insts">suits ${t.instruments.map((w) => `<span class="${on.has(w) ? 'on' : ''}">${esc(w)}</span>`).join(', ')}</span>` : ''}${t.noteType ? `<span class="wp-insts">usually hears ${esc(NOTE_TYPE_LABELS[t.noteType].toLowerCase())}</span>` : ''}</span>` : ''}</span>
        </button></li>`;
      }).join('')}</ul></section>`).join('')
      : `<p class="dim wp-none">No widget has all of these. Take a word away, or clear the filter.</p>`}`;

    box.querySelector('.wp-toggle')!.addEventListener('click', () => { st.open = !st.open; draw(); });
    box.querySelector<HTMLInputElement>('.wp-suits input')!.addEventListener('change', (e) => { st.suits = (e.target as HTMLInputElement).checked; draw(); });
    box.querySelector('[data-clear]')?.addEventListener('click', () => { st.feel = []; st.instruments = []; st.suits = false; draw(); });
    const toggle = (list: string[], w: string) => { const i = list.indexOf(w); if (i >= 0) list.splice(i, 1); else list.push(w); draw(); };
    box.querySelectorAll<HTMLButtonElement>('[data-feel]').forEach((b) => b.addEventListener('click', () => toggle(st.feel, b.dataset.feel!)));
    box.querySelectorAll<HTMLButtonElement>('[data-inst]').forEach((b) => b.addEventListener('click', () => toggle(st.instruments, b.dataset.inst!)));
    box.querySelectorAll<HTMLButtonElement>('.pick').forEach((b) => b.addEventListener('click', () => d.pick(b.dataset.id!)));
  };
  draw();
}
