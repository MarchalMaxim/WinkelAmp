/**
 * The note picker's popup (spec 2026-11-01-note-picker): the widget, the melody as a strip of chips to pick from, and a
 * preview through the real widget. The preview is a second WidgetRuntime and Conductor on the popup's own canvas, playing a
 * draft show with the same audio element as its clock; the store, the history, the disk and the live instances never see
 * it. While the popup is open the studio's player rests, so only one picture is drawn.
 */
import { TRACK_IDS } from '../pack/instruments';
import type { SongPack } from '../pack/pack';
import { Conductor } from '../show/conductor';
import type { KnobSetting, Show } from '../show/show';
import { startLive } from '../../widgets/driver';
import type { WaLayers } from '../../widgets/layers';
import { WidgetRuntime } from '../../widgets/runtime';
import { labTagWords, labTags } from '../../widgets/sources';
import { tagsOf } from '../../widgets/tags';
import type { LabHarness, Note, WidgetMeta } from '../../widgets/types';
import { GROUPS, groupOf, verdictTag, type CatalogueEntry } from './panel';
import { chipLayout, clock, countWords, draftShow, loudest, nameOf, pitchClass, previewSpan, toPicks, type Instrument, type RollNote } from './picker-logic';
import type { Player } from './player';
import { widgetHue } from './timeline';
import { mountWidgetPicker, newPickerState } from './widget-picker';

export interface PopupDeps {
  player: Player; pack: SongPack;
  catalogue: Map<string, CatalogueEntry>; order: string[];
  lib: { sources: Record<string, string>; harness: LabHarness; layers: WaLayers };
  meta(widget: string): WidgetMeta | undefined;
  instruments: readonly Instrument[];
  tone(m: number, gain: number, len: number): void;
  /** Place in scene, or Update the scene on the set with this id. */
  commit(widget: string, notes: Note[], id: string | null): void;
}

/** What the popup opens on: its chips, those on, and when editing the set's id, widget and first layer's knobs. */
export interface PopupOpen {
  chips: readonly RollNote[]; on: ReadonlySet<number>;
  /** Marked notes get their instrument's ring: a pick whose mark has gone has none. */
  marked: ReadonlySet<number>;
  edit: { id: string; widget: string | null; knobs?: Record<string, KnobSetting> } | null;
}

const FIRST_CHOICE = 'pointillism';

export class PickerPopup {
  readonly el = document.createElement('div');
  /** The preview's, while open: the checks read them. */
  runtime: WidgetRuntime | null = null;
  private conductor: Conductor | null = null;
  private stopLive: (() => void) | null = null;
  private opened: PopupOpen | null = null;
  private picks = new Set<number>();
  private widget = FIRST_CHOICE;
  private mode: 'pick' | 'all' = 'pick';
  private before = 0;
  private until: number | null = null;
  private sweep: boolean | null = null;
  private heard = 0;
  private lastPlaying = false;
  private readonly chooserState = newPickerState();
  private readonly $ = <T extends HTMLElement>(q: string) => this.el.querySelector<T>(q)!;

  constructor(private readonly d: PopupDeps) {
    this.el.className = 'np-modal';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', 'np-pop-title');
    this.el.innerHTML = `<div class="np-box">
        <div class="np-row"><h2 id="np-pop-title">Connect notes to a widget</h2><span class="np-sp"></span><button type="button" data-cancel>Cancel</button></div>
        <div class="np-row np-widget">
          <span class="dim">Widget</span>
          <button type="button" data-choose aria-expanded="false"></button>
          <span class="dim np-what" data-what></span>
          <div class="picker np-chooser" hidden></div>
        </div>
        <div class="np-row"><span class="dim">Your melody, in order. Click or sweep across the notes that should fire the widget. Dashed lines mark a pause in the melody.</span></div>
        <div class="np-chips"><div class="np-chips-in"></div></div>
        <div class="np-pop-bottom">
          <div class="np-pop-stage"><canvas width="1280" height="720" aria-label="The preview"></canvas></div>
          <div class="np-pop-side">
            <div><div class="np-count"><b data-count>0</b> <span data-of></span></div><div class="dim small" data-attacks></div></div>
            <div class="np-row">
              <button type="button" data-loud>Pick the loudest</button><input type="number" data-n value="6" min="1" aria-label="How many of the loudest notes">
              <button type="button" data-clear>Clear</button>
            </div>
            <div class="np-row">
              <button type="button" data-play>▶ Preview</button>
              <span class="dim">Compare:</span>
              <button type="button" data-cmp="pick" aria-pressed="true">Your picks</button>
              <button type="button" data-cmp="all" aria-pressed="false">Every note, as it is today</button>
            </div>
            <div class="np-row"><span class="np-sp"></span><button type="button" class="primary" data-ok disabled>Place in scene</button></div>
          </div>
        </div>
      </div>`;
    this.$('[data-cancel]').addEventListener('click', () => this.close());
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
    this.$('[data-choose]').addEventListener('click', () => this.toggleChooser());
    this.$('[data-loud]').addEventListener('click', () => {
      const k = Math.max(1, Number(this.$<HTMLInputElement>('[data-n]').value) || 1);
      this.picks = new Set(loudest(this.melody(), k).map((n) => n.id));
      this.changed();
    });
    this.$('[data-clear]').addEventListener('click', () => { this.picks.clear(); this.changed(); });
    this.$('[data-play]').addEventListener('click', () => this.toggle());
    this.el.querySelectorAll<HTMLButtonElement>('[data-cmp]').forEach((b) => b.addEventListener('click', () => this.compare(b.dataset.cmp as 'pick' | 'all')));
    this.$('[data-ok]').addEventListener('click', () => {
      const notes = toPicks(this.picked());
      if (!notes.length) return;
      this.d.player.audio.pause();
      this.d.commit(this.widget, notes, this.opened?.edit?.id ?? null);
    });
    const strip = this.$('.np-chips');
    strip.addEventListener('pointerdown', (e) => {
      const id = this.chipId(e.target);
      if (id === null) return;
      e.preventDefault();
      this.sweep = !this.picks.has(id);
      this.set(id, this.sweep);
      const n = this.melody().find((x) => x.id === id);
      if (n) this.d.tone(n.m, 0.12, 0.4);
      this.drawPicks();
    });
    strip.addEventListener('pointerover', (e) => {
      const id = this.chipId(e.target);
      if (this.sweep === null || id === null) return;
      this.set(id, this.sweep);
      this.drawPicks();
    });
    // A change during playback reaches the draft when the sweep ends, by the same reload as a real edit.
    window.addEventListener('pointerup', () => { if (this.sweep !== null) { this.sweep = null; this.draft(false); } });
    // Enter or Space on a focused chip clicks it with no pointer.
    strip.addEventListener('click', (e) => {
      const id = this.chipId(e.target);
      if (e.detail !== 0 || id === null) return;
      this.set(id, !this.picks.has(id));
      this.changed();
    });
  }

  get isOpen(): boolean { return this.opened !== null; }
  private melody(): readonly RollNote[] { return this.opened?.chips ?? []; }
  private picked(): RollNote[] { return this.melody().filter((n) => this.picks.has(n.id)); }
  private set(id: number, on: boolean): void { if (on) this.picks.add(id); else this.picks.delete(id); }
  private chipId(target: EventTarget | null): number | null {
    const c = (target as HTMLElement | null)?.closest?.<HTMLElement>('.np-chip');
    return c ? Number(c.dataset.id) : null;
  }

  open(o: PopupOpen): void {
    const { player, pack, lib, meta, catalogue, order } = this.d;
    this.opened = o;
    this.picks = new Set(o.on);
    this.mode = 'pick';
    this.widget = o.edit?.widget ?? (catalogue.has(FIRST_CHOICE) ? FIRST_CHOICE : order[0]);
    this.before = player.time;
    this.until = null;
    player.audio.pause();
    player.rest(true);
    this.closeChooser();
    this.buildChips();
    this.el.hidden = false;
    const canvas = this.$<HTMLCanvasElement>('canvas');
    this.runtime = new WidgetRuntime(canvas, { notes: pack.notes, tracks: pack.tracks }, lib);
    this.conductor = new Conductor(this.runtime, this.draftNow(), meta);
    this.conductor.reset(player.time);
    this.stopLive = startLive(this.conductor, this.runtime, player.audio, (t) => this.frame(t));
    this.$('[data-ok]').textContent = o.edit ? 'Update the scene' : 'Place in scene';
    this.drawWidget();
    this.drawCompare();
    this.drawPicks();
    this.$('[data-choose]').focus();
  }

  /** Back to the studio's picture, the playhead where it was, or at `to` after a placement. */
  close(to?: number): void {
    if (!this.opened) return;
    const { player } = this.d;
    player.audio.pause();
    this.stopLive?.();
    this.stopLive = null; this.conductor = null; this.runtime = null; this.opened = null;
    this.el.hidden = true;
    player.audio.currentTime = to ?? this.before;
    player.rest(false);
  }

  /** Esc: the chooser if it is open, else the popup. */
  escape(): void { if (!this.$('.np-chooser').hidden) this.closeChooser(); else this.close(); }

  /** Preview, or stop it: from a second before the first pick to 1.5 s after the last. */
  toggle(): void {
    const audio = this.d.player.audio;
    if (!audio.paused) { audio.pause(); return; }
    const picked = this.picked(), span = previewSpan(picked.length ? picked : this.melody());
    if (!span) return;
    this.until = span.to;
    audio.currentTime = span.from;
    void audio.play().catch(() => {});
  }

  private draftNow(): Show {
    const { pack } = this.d, edit = this.opened?.edit;
    const knobs = edit && edit.widget === this.widget ? edit.knobs : undefined;
    return draftShow(pack.id, pack.duration, this.widget, this.mode === 'pick' ? toPicks(this.picked()) : null, knobs);
  }

  /** The draft to the preview; another instance (cold: a new widget, or the other side of the compare) starts its picture
      again where the clock is. */
  private draft(cold: boolean): void {
    if (!this.conductor) return;
    this.conductor.setShow(this.draftNow());
    if (cold) this.conductor.reset(this.d.player.time);
  }

  private compare(mode: 'pick' | 'all'): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.drawCompare();
    this.draft(true);
  }

  private changed(): void { this.drawPicks(); this.draft(false); }

  private frame(t: number): void {
    const audio = this.d.player.audio;
    if (!audio.paused && this.until !== null && t >= this.until) audio.pause();
    if (!audio.paused !== this.lastPlaying) {
      this.lastPlaying = !audio.paused;
      this.$('[data-play]').textContent = this.lastPlaying ? '❚❚ Stop' : '▶ Preview';
    }
    if (!audio.paused && this.mode === 'pick') {
      for (const n of this.picked()) if (n.t > this.heard && n.t <= t && t - this.heard < 1) this.flash(n.id);
    }
    this.heard = t;
    const errors = Object.entries(this.runtime?.errors ?? {});
    if (errors.length) this.$('[data-what]').textContent = `This widget stopped: ${errors[0][1].replace(/^Error: /, '')}`;
  }

  private flash(id: number): void {
    const c = this.$(`.np-chip[data-id="${id}"]`), s = this.$('.np-chips');
    c.classList.add('now');
    setTimeout(() => c.classList.remove('now'), 220);
    if (c.offsetLeft < s.scrollLeft + 40 || c.offsetLeft > s.scrollLeft + s.clientWidth - 60) s.scrollLeft = c.offsetLeft - s.clientWidth / 3;
  }

  // ---- drawing ----

  private buildChips(): void {
    const box = this.$('.np-chips-in'), o = this.opened!, many = this.d.instruments.length > 1;
    const { chips, gaps, width } = chipLayout(o.chips);
    box.textContent = '';
    box.style.width = `${width}px`;
    for (const g of gaps) {
      const el = Object.assign(document.createElement('div'), { className: 'np-gap', textContent: clock(g.t) });
      el.style.left = `${g.x}px`;
      box.append(el);
    }
    for (const { note: n, x, y } of chips) {
      const c = Object.assign(document.createElement('button'), { type: 'button', className: 'np-chip', textContent: pitchClass(n.m) });
      const who = many && n.i >= 0 ? `${this.d.instruments[n.i].label}, ` : '';
      c.title = `${who}${nameOf(n.m)} at ${clock(n.t)}${o.marked.has(n.id) ? '' : ': no longer marked'}`;
      c.setAttribute('aria-label', c.title);
      c.dataset.id = String(n.id);
      if (many && o.marked.has(n.id)) c.style.setProperty('--ic', this.d.instruments[n.i].color);
      c.style.left = `${x}px`; c.style.top = `${y}px`;
      box.append(c);
    }
  }

  private drawPicks(): void {
    this.el.querySelectorAll<HTMLElement>('.np-chip').forEach((c) => {
      const on = this.picks.has(Number(c.dataset.id));
      c.classList.toggle('sel', on);
      c.setAttribute('aria-pressed', String(on));
    });
    const picked = this.picked(), w = countWords(picked, this.melody().length);
    this.$('[data-count]').textContent = w.count;
    this.$('[data-of]').textContent = w.of;
    this.$('[data-attacks]').textContent = w.attacks;
    this.$<HTMLButtonElement>('[data-ok]').disabled = !picked.length;
  }

  private drawCompare(): void {
    this.el.querySelectorAll<HTMLElement>('[data-cmp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cmp === this.mode)));
  }

  private drawWidget(): void {
    const m = this.d.catalogue.get(this.widget)?.meta;
    this.$('[data-choose]').textContent = m?.name ?? this.widget;
    this.$('[data-what]').innerHTML = m?.blurb ?? '';
  }

  private closeChooser(): void {
    this.$('.np-chooser').hidden = true;
    this.$('[data-choose]').setAttribute('aria-expanded', 'false');
  }

  /** The studio's widget picker, all widgets: `here` empty, or a widget already in the section couldn't be chosen. */
  private toggleChooser(): void {
    const box = this.$('.np-chooser');
    if (!box.hidden) { this.closeChooser(); return; }
    const { catalogue, order, pack } = this.d, tags = labTags();
    const metas = order.map((id) => catalogue.get(id)?.meta).filter((m): m is WidgetMeta => !!m)
      .map((m) => (m.tags !== undefined ? m : { ...m, tags: tagsOf(tags, m.id) }));
    mountWidgetPicker(box, {
      metas, words: labTagWords(), tracks: TRACK_IDS.filter((id) => (pack.tracks?.[id]?.notes.length ?? 0) > 0),
      here: new Set(), state: this.chooserState, groups: GROUPS, groupOf, verdict: verdictTag, hue: widgetHue,
      pick: (id) => {
        this.widget = id;
        this.closeChooser();
        this.drawWidget();
        this.draft(true);
      },
    });
    box.hidden = false;
    this.$('[data-choose]').setAttribute('aria-expanded', 'true');
  }
}
