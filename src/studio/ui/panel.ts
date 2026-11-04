/**
 * The side panel. Clip: the selected clip (clip-panel.ts draws its frame), its knobs as the lab draws them, what it listens
 * to, where it is seen and its intensity, and the collection to add from, with the user's verdicts. Show: the "Describe the
 * show" box Claude Code composes from, and what the show is made of.
 */
import { TRACK_IDS } from '../pack/instruments';
import type { SongPack } from '../pack/pack';
import type { Layer } from '../show/show';
import { instanceKey, listenOf } from '../show/show';
import { studioLayers } from '../../widgets/layers-source';
import { labTagWords, labTags } from '../../widgets/sources';
import { tagsOf } from '../../widgets/tags';
import type { Drive, Features, IconLib, Param, Region, ToolDef, WidgetMeta } from '../../widgets/types';
import type { ShowStore } from './api';
import { addWidgetAt, selectedClip } from './clip-actions';
import { clipHtml, noClipHtml, syncClip, wireClip } from './clip-panel';
import { knobWrites } from './how-present';
import { knobRow, knobState, type KnobRow } from './knobs';
import { describePlace, mountLayerControls, partWords } from './layer-controls';
import type { Store, StudioState } from './store';
import { clock, widgetHue } from './timeline';
import type { PaletteRequest } from './widget-palette';
import { mountWidgetPicker, newPickerState } from './widget-picker';

export interface CatalogueEntry { meta: WidgetMeta; tool: ToolDef }

interface Deps {
  store: Store; api: ShowStore; song: SongPack;
  catalogue: Map<string, CatalogueEntry>; order: string[];
  drives: [Drive, string][]; icon: IconLib;
  time: () => number; features: () => Features; errors: () => Record<string, string>;
  seek(t: number): void;
  /** The song's length now, and the times of its marks: where a new clip ends. */
  duration(): number; marks: readonly number[];
  /** Opens the note picker's popup on a set of picks. */
  editPicks(id: string): void;
  /** Opens the dialog that chooses the transcriber and redoes this song's notes. */
  redoTranscription(): void;
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

const KEY_IDLE = 600;

const RANK: Record<string, number> = { love: 0, keep: 1, 'needs work': 2 };
export const GROUPS = ['You love these', 'You keep these', 'These need work', 'Not judged yet', 'You dropped these'];
export const groupOf = (m: WidgetMeta): number => (m.verdict ? (RANK[m.verdict.v] ?? 4) : 3);

/** The note type a widget usually hears (lab/tags.json). */
const usualOf = (m: WidgetMeta | undefined, id: string) => (m?.tags ?? tagsOf(labTags(), id))?.noteType;

/** What a layer hears, where it is seen and whether it follows a curve, in a few words ('' when none is set). */
function layerParts(l: Layer): string {
  const p = listenOf(l), parts: string[] = [];
  if (p) parts.push(`hears ${partWords(p)}`);
  const place = describePlace(l.region);
  if (place) parts.push(place);
  if (l.intensity?.length) parts.push(l.intensityMoves === 'present' ? 'makes more or less along a curve' : 'follows a curve');
  return parts.join(' · ');
}

const NOTES_WORDS: Record<SongPack['notesFrom'], string> = {
  gpu: 'transcribed by the piano model', file: 'from a notes file', approx: 'approximate, from the analysis',
  merged: 'transcribed, with approximate notes where the model heard little',
  hybrid: 'transcribed by the piano model, with YourMT3+ filling its gaps',
  ymt3: 'transcribed by YourMT3+, velocities estimated',
  'bp-hybrid': 'transcribed by the piano model, with basic-pitch filling its gaps',
  'ms-hybrid': 'transcribed by the piano model, with MuScriptor filling its gaps',
};

export class Panel {
  readonly el: HTMLElement;
  private tab: 'clip' | 'show' = 'clip';
  private factsHtml = '';
  private picking = false;
  private key = '';
  private rows: { row: KnobRow }[] = [];
  private knobDrag = 0;
  /** When the last key press moved a knob (presses less than KEY_IDLE ms apart are one undo step), 0 after a drag. */
  private stepAt = 0;
  private liveAt = 0;
  /** The description as typed and as saved, kept across tab switches (the tab is drawn again each time). */
  private desc: { text: string; saved: string } | null = null;
  /** The open layer's listen/where/intensity controls (layer-controls.ts). */
  private controls: { sync(): void } | null = null;
  /** The widget picker's filter, kept while the picker closes and opens. */
  private readonly pickerState = newPickerState();
  /** A clip's place before it went back to the whole screen, by clip id (session only). */
  private readonly places = new Map<string, Region>();

  constructor(private readonly d: Deps) {
    this.el = document.createElement('aside');
    this.el.className = 'panel';
    this.el.innerHTML = `<div class="tabs" role="tablist">
        <button type="button" role="tab" data-tab="clip">Clip</button><button type="button" role="tab" data-tab="show">Show</button>
      </div><div class="tab-body"></div>`;
    this.el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      this.tab = b.dataset.tab as 'clip' | 'show'; this.key = ''; this.update(this.d.store.state);
    }));
  }

  private get body(): HTMLElement { return this.el.querySelector('.tab-body')!; }

  update(s: StudioState): void {
    this.el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === this.tab)));
    if (!s.show) return;
    if (this.tab === 'show') { if (this.key !== 'show') { this.key = 'show'; this.buildShow(s); } else this.syncShow(s); return; }
    const c = selectedClip(s);
    const key = JSON.stringify([c?.id ?? null, c?.widget ?? null, this.picking, s.ui.recording]);
    if (key !== this.key) { this.key = key; this.buildClip(s); } else this.syncClip(s);
  }

  /** A widget failed: the clip tab is drawn again on the next update, so the open clip shows why. */
  widgetFailed(): void { if (this.tab === 'clip') this.key = ''; }

  /** Live knob pictures follow the music ~8 times a second, for knobs that follow something. */
  tick(now: number): void {
    if (now - this.liveAt < 120 || !this.rows.length) return;
    this.liveAt = now;
    const f = this.d.features(), clip = selectedClip(this.d.store.state);
    for (const { row } of this.rows) {
      const st = knobState(row.q, clip?.knobs?.[row.q.key]);
      if (st.drive) row.drawLive(f);
    }
  }

  private edit(edit: Parameters<Store['dispatch']>[0]): void { this.d.store.dispatch(edit); }

  // ---- Clip -------------------------------------------------------------------------------------------------------

  private buildClip(s: StudioState): void {
    const c = selectedClip(s), body = this.body, locked = s.ui.recording;
    this.rows = []; this.controls = null;
    if (!c) {
      body.innerHTML = noClipHtml(this.picking);
    } else {
      const entry = this.d.catalogue.get(c.widget), m = entry?.meta, err = this.d.errors()[instanceKey(c)];
      body.innerHTML = clipHtml({ name: m?.name ?? c.widget, verdict: m ? verdictTag(m) : '<span class="tag v-drop">missing</span>', blurb: m?.blurb ?? '', hue: widgetHue(c.widget), picking: this.picking, ...(err ? { err } : {}) });
      wireClip(body, this.d.store, { time: this.d.time, seek: this.d.seek });
      body.querySelector('[data-defaults]')!.addEventListener('click', () => {
        const group = `defaults:${c.id}:${++this.knobDrag}`, now = selectedClip(this.d.store.state);
        for (const key of Object.keys(now?.knobs ?? {})) this.edit({ type: 'edit', edit: { kind: 'setKnob', clip: c.id, key, value: null }, group });
      });
      if (entry) this.buildKnobs(body.querySelector('.params')!, entry.tool, c.id, c.knobs);
      this.buildControls(body.querySelector('.layer-controls')!, c.widget, c.id);
    }
    body.querySelector('[data-act="add"]')!.addEventListener('click', () => { this.picking = !this.picking; this.key = ''; this.update(this.d.store.state); });
    if (this.picking) this.buildPicker();
    body.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input, select').forEach((x) => { if (locked) x.disabled = true; });
    this.syncClip(s);
  }

  private buildKnobs(box: HTMLElement, tool: ToolDef, id: string, knobs: Layer['knobs']): void {
    const params: Param[] = Array.isArray(tool.params) ? tool.params : [];
    if (!params.length) { box.innerHTML = '<p class="dim small">This widget has no knobs.</p>'; return; }
    for (const q of params) {
      const row = knobRow(q, knobState(q, knobs?.[q.key]), this.d.drives, this.d.icon, (st, phase) => {
        const now = performance.now();
        if ((phase === 'step') !== (this.stepAt > 0) || (phase === 'step' && now - this.stepAt > KEY_IDLE)) this.knobDrag++;
        this.stepAt = phase === 'step' ? now : 0;
        for (const { key, value } of knobWrites(params, q, st, selectedClip(this.d.store.state)?.knobs)) this.edit({ type: 'edit', edit: { kind: 'setKnob', clip: id, key, value }, group: `knob:${id}:${q.key}:${this.knobDrag}` });
        if (phase === 'end') this.knobDrag++;
      });
      this.rows.push({ row });
      box.append(row.el);
    }
  }

  /** Listens to, Where and Intensity for the selected clip: setClip edits, each its own undo step. */
  private buildControls(box: HTMLElement, widget: string, id: string): void {
    const pack = this.d.store.state.song ?? this.d.song;
    const clip = () => this.d.store.state.show!.clips.find((c) => c.id === id);
    this.controls = mountLayerControls(box, {
      layers: studioLayers(), pack, widget, hue: widgetHue(widget), usual: usualOf(this.d.catalogue.get(widget)?.meta, widget),
      span: () => { const c = clip(); return { start: c?.start ?? 0, end: c?.end ?? 0 }; },
      layer: clip,
      edit: (patch, group) => {
        const before = this.d.store.state.show;
        this.edit({ type: 'edit', edit: { kind: 'setClip', clip: id, patch }, group: `clip:${id}:${group}` });
        return this.d.store.state.show !== before;
      },
      memory: this.places, memoryKey: () => id,
      picks: () => this.d.store.state.show?.picks, editPicks: this.d.editPicks,
    });
  }

  private buildPicker(): void {
    const box = this.body.querySelector<HTMLElement>('.picker')!;
    const pack = this.d.store.state.song ?? this.d.song;
    mountWidgetPicker(box, {
      metas: this.metas(), words: labTagWords(), tracks: TRACK_IDS.filter((id) => (pack.tracks?.[id]?.notes.length ?? 0) > 0),
      here: this.playingHere(), state: this.pickerState,
      groups: GROUPS, groupOf, verdict: verdictTag, hue: widgetHue,
      pick: (id) => this.addWidget(id),
    });
  }

  /** The widgets of the clips under the playhead. */
  private playingHere(): Set<string> {
    const t = this.d.time();
    return new Set(this.d.store.state.show!.clips.filter((c) => c.start <= t && t < c.end).map((c) => c.widget));
  }

  /** The collection with its tags, in its order. */
  private metas(): WidgetMeta[] {
    const tags = labTags();
    return this.d.order.map((id) => this.d.catalogue.get(id)?.meta).filter((m): m is WidgetMeta => !!m)
      .map((m) => (m.tags !== undefined ? m : { ...m, tags: tagsOf(tags, m.id) }));
  }

  /** A new clip of this widget at the playhead, on top, selected. */
  private addWidget(id: string): void {
    this.picking = false;
    addWidgetAt(this.d.store, this.d.store.state.song ?? this.d.song, id, this.d.time(), this.d.duration(), this.d.marks);
  }

  /** Ctrl+P: a new clip at the playhead. A widget already playing there can go on again, as a copy of its own. */
  paletteRequest(): PaletteRequest {
    const metas = this.metas().map((m, k) => ({ m, k })).sort((a, b) => groupOf(a.m) - groupOf(b.m) || a.k - b.k).map((x) => x.m);
    return {
      title: `Add at ${clock(this.d.time())}`,
      metas, here: this.playingHere(), hereWord: 'playing here',
      verdict: verdictTag, hue: widgetHue,
      pick: (id) => {
        this.tab = 'clip'; this.key = '';
        this.addWidget(id);
        this.update(this.d.store.state);
      },
    };
  }

  private syncClip(s: StudioState): void {
    const c = selectedClip(s);
    if (!c) return;
    syncClip(this.body, c);
    const parts = this.body.querySelector('.layer-parts');
    if (parts) parts.textContent = layerParts(c);
    for (const { row } of this.rows) row.sync(knobState(row.q, c.knobs?.[row.q.key]));
    const defaults = this.body.querySelector<HTMLButtonElement>('[data-defaults]');
    if (defaults) defaults.hidden = !Object.keys(c.knobs ?? {}).length;
    this.controls?.sync();
    this.where();
  }

  /** When the playhead is outside the selected clip, says so, with a way to it: edits to it then do not change the picture
      until it plays. */
  where(): void {
    const el = this.body.querySelector<HTMLElement>('.sec-where'), c = selectedClip(this.d.store.state);
    if (!el || !c || this.tab !== 'clip') return;
    const t = this.d.time(), here = c.start <= t && t < c.end;
    el.hidden = here;
    if (!here) el.querySelector('span')!.textContent = 'The playhead is outside this clip.';
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
    this.factsHtml = '';
    this.body.querySelector('.facts')!.addEventListener('click', (e) => {
      if ((e.target as Element).closest('[data-act="redo-transcription"]')) this.d.redoTranscription();
    });
    const ta = this.body.querySelector<HTMLTextAreaElement>('.describe')!, state = this.body.querySelector('.describe-state')!;
    const mark = () => { state.textContent = this.desc && this.desc.text !== this.desc.saved ? 'not saved yet' : ''; };
    if (this.desc) { ta.value = this.desc.text; mark(); }
    else {
      this.d.api.description(id).then((t) => { if (this.desc) return; this.desc = { text: t, saved: t }; ta.value = t; })
        .catch(() => { state.textContent = 'could not read the description'; });
    }
    ta.addEventListener('input', () => { this.desc = { text: ta.value, saved: this.desc?.saved ?? '' }; mark(); });
    this.body.querySelector('[data-act="describe"]')!.addEventListener('click', async () => {
      try {
        await this.d.api.saveDescription(id, ta.value);
        this.desc = { text: ta.value, saved: ta.value };
        state.textContent = this.d.api.writable ? `saved to shows/${id}.description.md` : 'kept in this browser';
      } catch (e) { state.textContent = String((e as Error).message ?? e); }
    });
    this.syncShow(s);
  }

  private syncShow(s: StudioState): void {
    const p = this.d.song, show = s.show!;
    const by = { auto: 'composed automatically from the song', claude: 'composed by Claude', user: 'shaped by you' }[show.composer?.by ?? 'user'];
    const facts = this.body.querySelector('.facts');
    const redo = this.d.api.writable ? '<br><button type="button" class="link" data-act="redo-transcription">Redo the transcription…</button>' : '';
    const html = `
      <dt>Song</dt><dd>${esc(p.title)}, ${clock(p.duration)}</dd>
      <dt>Show</dt><dd>${show.clips.length} clip${show.clips.length === 1 ? '' : 's'}, ${by}${s.origin === 'auto' ? ' (not saved yet)' : ''}</dd>
      <dt>Notes</dt><dd>${p.notes.length} notes, ${NOTES_WORDS[p.notesFrom]}${redo}</dd>
      ${p.quality.warnings.length ? `<dt>Warnings</dt><dd>${p.quality.warnings.map(esc).join('<br>')}</dd>` : ''}`;
    // Every store update lands here: written only when it changed, so the button keeps its focus and its click.
    if (facts && html !== this.factsHtml) { facts.innerHTML = html; this.factsHtml = html; }
    const errs = Object.entries(this.d.errors());
    const box = this.body.querySelector('.problems');
    if (box) box.innerHTML = errs.length ? `<h3>Widget problems</h3><ul class="errs">${errs.map(([id, e]) => `<li><b>${esc(id)}</b>: ${esc(e)}</li>`).join('')}</ul>` : '';
  }
}
