/**
 * The side panel. Section: its name, where it lies, how the widgets leaving at its start fade, and its layers (top
 * first, as they are seen): add from the collection with the user's verdicts, remove, reorder, and each layer's knobs
 * as the lab draws them. Show: the "Describe the show" box Claude Code composes from, and what the show is made of.
 */
import type { SongPack } from '../pack/pack';
import type { ShowSection } from '../show/show';
import { DEFAULT_FADE, MAX_FADE } from '../show/show';
import type { Drive, Features, IconLib, Param, ToolDef, WidgetMeta } from '../../widgets/types';
import type { ShowStore } from './api';
import { knobRow, knobState, settingOf, type KnobRow } from './knobs';
import type { Store, StudioState } from './store';
import { clock, widgetHue } from './timeline';

export interface CatalogueEntry { meta: WidgetMeta; tool: ToolDef }

interface Deps {
  store: Store; api: ShowStore; song: SongPack;
  catalogue: Map<string, CatalogueEntry>; order: string[];
  drives: [Drive, string][]; icon: IconLib;
  time: () => number; features: () => Features; errors: () => Record<string, string>;
  splitAtPlayhead(): void;
}

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const VCLASS: Record<string, string> = { love: 'v-love', keep: 'v-keep', 'needs work': 'v-work', drop: 'v-drop' };

/** The lab's verdict tag: "you: love", "reworked · was “love”" when the widget moved on since, "not judged yet". */
export function verdictTag(m: WidgetMeta): string {
  const vd = m.verdict;
  if (!vd) return '<span class="tag v-none">not judged yet</span>';
  const tip = esc(`You said: ${vd.v} (on ${vd.on})${vd.note ? `: ${vd.note}` : ''}`);
  return (m.tag ?? '') !== vd.on ? `<span class="tag v-rev" title="${tip}">reworked · was “${esc(vd.v)}”</span>`
    : `<span class="tag ${VCLASS[vd.v] ?? 'v-none'}" title="${tip}">you: ${esc(vd.v)}</span>`;
}

const RANK: Record<string, number> = { love: 0, keep: 1, 'needs work': 2 };
const GROUPS = ['You love these', 'You keep these', 'These need work', 'Not judged yet', 'You dropped these'];
const groupOf = (m: WidgetMeta): number => (m.verdict ? (RANK[m.verdict.v] ?? 4) : 3);

const NOTES_WORDS: Record<SongPack['notesFrom'], string> = {
  gpu: 'transcribed by the piano model', file: 'from a notes file', approx: 'approximate, from the analysis',
  merged: 'transcribed, with approximate notes where the model heard little',
};

export class Panel {
  readonly el: HTMLElement;
  private tab: 'section' | 'show' = 'section';
  private picking = false;
  private key = '';
  private rows: { row: KnobRow; layer: number }[] = [];
  private knobDrag = 0;
  private liveAt = 0;
  private descLoaded = false;

  constructor(private readonly d: Deps) {
    this.el = document.createElement('aside');
    this.el.className = 'panel';
    this.el.innerHTML = `<div class="tabs" role="tablist">
        <button type="button" role="tab" data-tab="section">Section</button><button type="button" role="tab" data-tab="show">Show</button>
      </div><div class="tab-body"></div>`;
    this.el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      this.tab = b.dataset.tab as 'section' | 'show'; this.key = ''; this.update(this.d.store.state);
    }));
  }

  private get body(): HTMLElement { return this.el.querySelector('.tab-body')!; }

  update(s: StudioState): void {
    this.el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === this.tab)));
    if (!s.show) return;
    if (this.tab === 'show') { if (this.key !== 'show') { this.key = 'show'; this.buildShow(s); } else this.syncShow(s); return; }
    const i = s.selected.section, sec = s.show.sections[i];
    const key = JSON.stringify([i, s.show.sections.length, sec.layers.map((l) => l.widget), s.selected.layer, this.picking, s.ui.recording]);
    if (key !== this.key) { this.key = key; this.buildSection(s); } else this.syncSection(s);
  }

  /** Live knob pictures follow the music ~8 times a second, for knobs that follow something. */
  tick(now: number): void {
    if (now - this.liveAt < 120 || !this.rows.length) return;
    this.liveAt = now;
    const f = this.d.features(), s = this.d.store.state, sec = s.show?.sections[s.selected.section];
    for (const { row, layer } of this.rows) {
      const st = knobState(row.q, sec?.layers[layer]?.knobs?.[row.q.key]);
      if (st.drive) row.drawLive(f);
    }
  }

  private edit(edit: Parameters<Store['dispatch']>[0]): void { this.d.store.dispatch(edit); }

  // ---- Section ------------------------------------------------------------------------------------------------

  private buildSection(s: StudioState): void {
    const show = s.show!, i = s.selected.section, sec = show.sections[i], n = show.sections.length;
    const locked = s.ui.recording;
    const body = this.body;
    this.rows = [];
    body.innerHTML = `
      <header class="sec-head">
        <div class="sec-nav">
          <button type="button" class="icon" data-act="prev" aria-label="Previous section" ${i === 0 ? 'disabled' : ''}>‹</button>
          <span class="dim">Section ${i + 1} of ${n}</span>
          <button type="button" class="icon" data-act="next" aria-label="Next section" ${i === n - 1 ? 'disabled' : ''}>›</button>
        </div>
        <input class="sec-label" aria-label="Section name" placeholder="Name this section" maxlength="60">
        <p class="sec-time"></p>
      </header>
      <div class="sec-actions">
        <button type="button" data-act="split" title="Split this section at the playhead (S)">Split at playhead</button>
        <button type="button" data-act="merge" ${i === n - 1 ? 'disabled' : ''} title="Join this section with the one after it">Merge with next</button>
      </div>
      ${i > 0 ? `<label class="fade"><span>Widgets leaving here fade out over</span>
        <input type="range" min="0" max="${MAX_FADE}" step="0.5" aria-label="Fade"><output></output></label>` : ''}
      <h3 class="layers-title">Layers <span class="dim">top first, as you see them</span></h3>
      <button type="button" class="add" data-act="add" aria-expanded="${this.picking}">${this.picking ? 'Close the collection' : 'Add a widget on top'}</button>
      <div class="picker" ${this.picking ? '' : 'hidden'}></div>
      <ol class="layers"></ol>`;
    const label = body.querySelector<HTMLInputElement>('.sec-label')!;
    label.addEventListener('input', () => this.edit({ type: 'edit', edit: { kind: 'setSection', section: i, patch: { label: label.value } }, group: `label:${i}` }));
    const fade = body.querySelector<HTMLInputElement>('.fade input');
    fade?.addEventListener('input', () => this.edit({ type: 'edit', edit: { kind: 'setSection', section: i, patch: { fade: Number(fade.value) } }, group: `fade:${i}` }));
    body.querySelector('[data-act="prev"]')?.addEventListener('click', () => this.edit({ type: 'select', section: i - 1, layer: null }));
    body.querySelector('[data-act="next"]')?.addEventListener('click', () => this.edit({ type: 'select', section: i + 1, layer: null }));
    body.querySelector('[data-act="split"]')!.addEventListener('click', () => this.d.splitAtPlayhead());
    body.querySelector('[data-act="merge"]')!.addEventListener('click', () => this.edit({ type: 'edit', edit: { kind: 'merge', section: i } }));
    body.querySelector('[data-act="add"]')!.addEventListener('click', () => { this.picking = !this.picking; this.key = ''; this.update(this.d.store.state); });
    this.buildLayers(s, sec, i);
    if (this.picking) this.buildPicker(sec, i);
    body.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input, select').forEach((x) => { if (locked && !x.closest('.sec-nav')) x.disabled = true; });
    this.syncSection(s);
  }

  private buildLayers(s: StudioState, sec: ShowSection, i: number): void {
    const list = this.body.querySelector('.layers')!;
    if (!sec.layers.length) {
      list.innerHTML = '<li class="layer none">No widgets here: the picture fades to black. Add one from the collection.</li>';
      return;
    }
    for (let k = sec.layers.length - 1; k >= 0; k--) {
      const l = sec.layers[k], entry = this.d.catalogue.get(l.widget), m = entry?.meta;
      const open = s.selected.layer === k, err = this.d.errors()[l.widget];
      const li = document.createElement('li');
      li.className = `layer${open ? ' open' : ''}`;
      li.style.setProperty('--hue', String(widgetHue(l.widget)));
      const changed = Object.keys(l.knobs ?? {}).length;
      li.innerHTML = `<div class="layer-head">
          <button type="button" class="layer-name" aria-expanded="${open}"><span class="swatch"></span><b>${esc(m?.name ?? l.widget)}</b>${m ? verdictTag(m) : '<span class="tag v-drop">missing</span>'}</button>
          <span class="layer-tools">
            <button type="button" class="icon" data-mv="1" aria-label="Move up" title="Move up (draws later, on top)" ${k === sec.layers.length - 1 ? 'disabled' : ''}>↑</button>
            <button type="button" class="icon" data-mv="-1" aria-label="Move down" title="Move down (draws earlier, beneath)" ${k === 0 ? 'disabled' : ''}>↓</button>
            <button type="button" class="icon" data-rm aria-label="Remove ${esc(m?.name ?? l.widget)}" title="Remove from this section (Delete)">✕</button>
          </span></div>
        ${open ? `<p class="blurb">${m?.blurb ?? ''}</p>${err ? `<p class="err">${esc(err)}</p>` : ''}
          <div class="params"></div>
          <button type="button" class="link" data-defaults ${changed ? '' : 'hidden'}>Back to the widget's own settings</button>`
        : (changed ? `<p class="dim small">${changed} knob${changed > 1 ? 's' : ''} changed</p>` : '')}`;
      li.querySelector('.layer-name')!.addEventListener('click', () => this.edit({ type: 'select', section: i, layer: open ? null : k }));
      li.querySelectorAll<HTMLButtonElement>('[data-mv]').forEach((b) => b.addEventListener('click', () => {
        const to = k + Number(b.dataset.mv);
        this.edit({ type: 'edit', edit: { kind: 'moveLayer', section: i, from: k, to } });
        if (open) this.edit({ type: 'select', section: i, layer: to });
      }));
      li.querySelector('[data-rm]')!.addEventListener('click', () => this.edit({ type: 'edit', edit: { kind: 'removeLayer', section: i, layer: k } }));
      li.querySelector('[data-defaults]')?.addEventListener('click', () => {
        const group = `defaults:${i}:${k}:${++this.knobDrag}`;
        for (const key of Object.keys(this.d.store.state.show!.sections[i].layers[k]?.knobs ?? {})) this.edit({ type: 'edit', edit: { kind: 'setKnob', section: i, layer: k, key, value: null }, group });
      });
      if (open && entry) this.buildKnobs(li.querySelector('.params')!, entry.tool, i, k, l.knobs);
      list.append(li);
    }
  }

  private buildKnobs(box: HTMLElement, tool: ToolDef, i: number, k: number, knobs: ShowSection['layers'][number]['knobs']): void {
    const params: Param[] = Array.isArray(tool.params) ? tool.params : [];
    if (!params.length) { box.innerHTML = '<p class="dim small">This widget has no knobs.</p>'; return; }
    for (const q of params) {
      const row = knobRow(q, knobState(q, knobs?.[q.key]), this.d.drives, this.d.icon, (st, final) => {
        this.edit({ type: 'edit', edit: { kind: 'setKnob', section: i, layer: k, key: q.key, value: settingOf(q, st) }, group: `knob:${i}:${k}:${q.key}:${this.knobDrag}` });
        if (final) this.knobDrag++;
      });
      this.rows.push({ row, layer: k });
      box.append(row.el);
    }
  }

  private buildPicker(sec: ShowSection, i: number): void {
    const box = this.body.querySelector<HTMLElement>('.picker')!;
    const here = new Set(sec.layers.map((l) => l.widget));
    const metas = this.d.order.map((id) => this.d.catalogue.get(id)?.meta).filter((m): m is WidgetMeta => !!m);
    const groups = GROUPS.map((title, gi) => ({ title, items: metas.filter((m) => groupOf(m) === gi) })).filter((g) => g.items.length);
    box.innerHTML = groups.map((g) => `<section><h4>${g.title}</h4><ul>${g.items.map((m) => `
      <li><button type="button" class="pick" data-id="${esc(m.id)}" ${here.has(m.id) ? 'disabled' : ''} style="--hue:${widgetHue(m.id)}">
        <span class="pick-name"><span class="swatch"></span><b>${esc(m.name)}</b>${verdictTag(m)}${here.has(m.id) ? '<span class="dim small">in this section</span>' : ''}</span>
        <span class="blurb">${m.blurb}</span></button></li>`).join('')}</ul></section>`).join('');
    box.querySelectorAll<HTMLButtonElement>('.pick').forEach((b) => b.addEventListener('click', () => {
      const n = this.d.store.state.show!.sections[i].layers.length;
      this.picking = false;
      this.edit({ type: 'edit', edit: { kind: 'addLayer', section: i, widget: b.dataset.id! } });
      this.edit({ type: 'select', section: i, layer: n });
    }));
  }

  private syncSection(s: StudioState): void {
    const show = s.show!, i = s.selected.section, sec = show.sections[i];
    const label = this.body.querySelector<HTMLInputElement>('.sec-label');
    if (label && document.activeElement !== label) label.value = sec.label ?? '';
    const time = this.body.querySelector('.sec-time');
    if (time) time.textContent = `${clock(sec.start)} – ${clock(sec.end)} · ${Math.round(sec.end - sec.start)} s`;
    const fade = this.body.querySelector<HTMLInputElement>('.fade input'), out = this.body.querySelector('.fade output');
    const f = sec.fade ?? DEFAULT_FADE;
    if (fade && document.activeElement !== fade) fade.value = String(f);
    if (out) out.textContent = f === 0 ? 'a cut' : `${f} s`;
    for (const { row, layer } of this.rows) row.sync(knobState(row.q, sec.layers[layer]?.knobs?.[row.q.key]));
    const defaults = this.body.querySelector<HTMLButtonElement>('.layer.open [data-defaults]'), open = s.selected.layer;
    if (defaults) defaults.hidden = open === null || !Object.keys(sec.layers[open]?.knobs ?? {}).length;
  }

  // ---- Show ---------------------------------------------------------------------------------------------------

  private buildShow(s: StudioState): void {
    const id = s.show!.id;
    this.rows = [];
    this.body.innerHTML = `
      <h3>Describe the show</h3>
      <p class="dim">Say in your own words what you want to see: the moods, where it should break open, which widgets you
        want where. It is saved next to the show; then ask Claude Code to compose the show for <b>${esc(id)}</b> from its description.</p>
      <textarea class="describe" rows="7" placeholder="Dark and still at first, only the squares. When the casket theme comes in, let it slash through everything…"></textarea>
      <div class="row-end"><span class="dim small describe-state"></span><button type="button" data-act="describe">Save description</button></div>
      <h3>This show</h3>
      <dl class="facts"></dl>
      <div class="problems"></div>`;
    const ta = this.body.querySelector<HTMLTextAreaElement>('.describe')!, state = this.body.querySelector('.describe-state')!;
    if (!this.descLoaded) {
      this.d.api.description(id).then((t) => { ta.value = t; this.descLoaded = true; ta.dataset.saved = t; }).catch(() => { state.textContent = 'could not read the description'; });
    }
    ta.addEventListener('input', () => { state.textContent = ta.value !== (ta.dataset.saved ?? '') ? 'not saved yet' : ''; });
    this.body.querySelector('[data-act="describe"]')!.addEventListener('click', async () => {
      try {
        await this.d.api.saveDescription(id, ta.value);
        ta.dataset.saved = ta.value;
        state.textContent = this.d.api.writable ? `saved to shows/${id}.description.md` : 'kept in this browser';
      } catch (e) { state.textContent = String((e as Error).message ?? e); }
    });
    this.syncShow(s);
  }

  private syncShow(s: StudioState): void {
    const p = this.d.song, show = s.show!;
    const by = { auto: 'composed automatically from the song', claude: 'composed by Claude', user: 'shaped by you' }[show.composer?.by ?? 'user'];
    const facts = this.body.querySelector('.facts');
    if (facts) facts.innerHTML = `
      <dt>Song</dt><dd>${esc(p.title)} · ${clock(p.duration)}</dd>
      <dt>Show</dt><dd>${show.sections.length} section${show.sections.length > 1 ? 's' : ''}, ${by}${s.origin === 'auto' ? ' (not saved yet)' : ''}</dd>
      <dt>Notes</dt><dd>${p.notes.length} notes, ${NOTES_WORDS[p.notesFrom]}</dd>
      ${p.quality.warnings.length ? `<dt>Warnings</dt><dd>${p.quality.warnings.map(esc).join('<br>')}</dd>` : ''}`;
    const errs = Object.entries(this.d.errors());
    const box = this.body.querySelector('.problems');
    if (box) box.innerHTML = errs.length ? `<h3>Widget problems</h3><ul class="errs">${errs.map(([id, e]) => `<li><b>${esc(id)}</b>: ${esc(e)}</li>`).join('')}</ul>` : '';
  }
}
