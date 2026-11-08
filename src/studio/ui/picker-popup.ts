/**
 * The note picker's popup (spec 2026-11-01-note-picker): the widget, the melody as a strip of chips to pick from, and a
 * preview through the real widget. The preview is a second WidgetRuntime and Conductor on the popup's own canvas, playing a
 * draft show with the same audio element as its clock; the store, the history, the disk and the live instances never see
 * it. While the popup is open the studio's player rests, so only one picture is drawn.
 */
import { TRACK_IDS } from '../pack/instruments';
import type { SongPack } from '../pack/pack';
import { Conductor } from '../show/conductor';
import { INTENSITY, noteKnobs, type NoteValues, type PickNote } from '../show/note-values';
import type { KnobSetting, Show } from '../show/show';
import { startLive } from '../../widgets/driver';
import type { WaLayers } from '../../widgets/layers';
import { WidgetRuntime } from '../../widgets/runtime';
import { labTagWords, labTags } from '../../widgets/sources';
import { tagsOf } from '../../widgets/tags';
import type { LabHarness, WidgetMeta } from '../../widgets/types';
import { GROUPS, groupOf, verdictTag, type CatalogueEntry } from './panel';
import { amountBars, attackMates, barWords, chipLayout, chipRuler, clock, countWords, draftKey, draftShow, everyOther, fineClock, INTENSITY_LANE, knobLane, laneShare, laneValue, loudest, nameOf, phraseOf, pickedSpan, pitchClass, previewSpan, renumberLost, sweptChips, toPicks, type Chip, type LaneScale, type Instrument, type RollNote } from './picker-logic';
import type { Player } from './player';
import { widgetHue } from './timeline';
import type { WidgetPalette } from './widget-palette';
import { mountWidgetPicker, newPickerState } from './widget-picker';

export interface PopupDeps {
  player: Player; pack: SongPack;
  catalogue: Map<string, CatalogueEntry>; order: string[];
  lib: { sources: Record<string, string>; harness: LabHarness; layers: WaLayers };
  meta(widget: string): WidgetMeta | undefined;
  instruments: readonly Instrument[];
  tone(m: number, gain: number, len: number): void;
  /** Place in scene, or Update the scene on the set with this id. */
  commit(widget: string, notes: PickNote[], id: string | null): void;
  /** Add more notes: to the roll, with the set as it now stands in the popup. */
  addNotes(id: string, widget: string, notes: PickNote[]): void;
  /** However it closed. */
  closed(): void;
}

/** What the popup opens on: its chips, those on, and when editing the set's id, widget and first layer's knobs. */
export interface PopupOpen {
  chips: readonly RollNote[]; on: ReadonlySet<number>;
  /** The values the set's notes have, by chip id. */
  values?: ReadonlyMap<number, Readonly<NoteValues>>;
  /** Back from adding notes, on this widget: what was set on the other widgets tried is still there. */
  resume?: string;
  edit: { id: string; widget: string | null; knobs?: Record<string, KnobSetting> } | null;
}

const FIRST_CHOICE = 'pointillism';
/** A drag reaches a chip this many px before its middle; this near the strip's edge it scrolls, up to this fast (px a frame). */
const SWEEP_REACH = 8, EDGE = 44, EDGE_SPEED = 18;

/** A drag across the strip: the picks when it began, whether it adds or takes off, from where to where (content px). */
interface Sweep { on: boolean; base: Set<number>; from: number; to: number; moved: boolean; x0: number; clientX: number; touch: boolean }

export class PickerPopup {
  readonly el = document.createElement('div');
  /** The preview's, while open: the checks read them. */
  runtime: WidgetRuntime | null = null;
  private conductor: Conductor | null = null;
  private stopLive: (() => void) | null = null;
  private opened: PopupOpen | null = null;
  private picks = new Set<number>();
  /** Each note's intensity, by chip id. A note taken off keeps its values, should it go back on. */
  private intensities = new Map<number, number>();
  /** Each note's knob values, by widget and chip id: the same name on another widget means something else, so trying one
      leaves the others' alone, and only the widget placed keeps its own. */
  private knobValues = new Map<string, Map<number, NoteValues>>();
  /** What the bars set: intensity, or one of the widget's knobs. */
  private laneKey = INTENSITY;
  private amountDrag = false;
  /** The knob values held while notes are added: a row's popup opened meanwhile has its own. */
  private tried = new Map<string, Map<number, NoteValues>>();
  private widget = FIRST_CHOICE;
  private mode: 'pick' | 'all' = 'pick';
  private before = 0;
  private until: number | null = null;
  private sweep: Sweep | null = null;
  private layout: Chip[] = [];
  private bars: { id: number; x: number; w: number }[] = [];
  /** The middle of the last chip pressed, for Shift. */
  private lastChip: number | null = null;
  private heard = 0;
  private lastPlaying = false;
  private stopped: string | null = null;
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
        <div class="np-row"><span class="dim">Your melody, spaced as it plays: a wide space is a long wait, a note's tail is how long it sounds, a dashed line a pause. Click a note, or drag anywhere to pick all you pass (on a picked note, or with Alt, it takes them off). Shift-click picks up to there, double-click the whole phrase.</span></div>
        <div class="np-row np-lane-head"><span class="dim small">Under each picked note, a bar sets</span><select data-lane aria-label="What the bars set"></select><span class="dim small" data-lane-hint></span></div>
        <div class="np-chips"><div class="np-chips-in"></div></div>
        <div class="np-pop-bottom">
          <div class="np-pop-stage"><canvas width="1280" height="720" aria-label="The preview"></canvas></div>
          <div class="np-pop-side">
            <div><div class="np-count"><b data-count>0</b> <span data-of></span></div><div class="dim small" data-attacks></div><div class="dim small" data-span></div></div>
            <div class="np-row">
              <button type="button" data-loud>Pick the loudest</button><input type="number" data-n value="6" min="1" aria-label="How many of the loudest notes">
              <button type="button" data-all title="Every note of the melody">All</button>
              <button type="button" data-thin title="Every other attack of what is picked (or of the melody, if nothing is)">Every other</button>
              <button type="button" data-invert title="What is picked comes off, the rest goes on">Invert</button>
              <button type="button" data-clear>Clear</button>
            </div>
            <div class="np-row">
              <button type="button" data-play>▶ Preview</button>
              <span class="dim">Compare:</span>
              <button type="button" data-cmp="pick" aria-pressed="true">Your picks</button>
              <button type="button" data-cmp="all" aria-pressed="false">Every note, as it is today</button>
            </div>
            <div class="np-row"><button type="button" data-add hidden title="To the whole song's notes, with these picked: click the ones you forgot, then come back here">Add more notes…</button><span class="np-sp"></span><button type="button" class="primary" data-ok disabled>Place in scene</button></div>
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
    this.$('[data-all]').addEventListener('click', () => { this.picks = new Set(this.melody().map((n) => n.id)); this.changed(); });
    this.$('[data-thin]').addEventListener('click', () => {
      const from = this.picked();
      this.picks = new Set(everyOther(from.length ? from : this.melody()).map((n) => n.id));
      this.changed();
    });
    this.$('[data-invert]').addEventListener('click', () => { this.picks = new Set(this.melody().filter((n) => !this.picks.has(n.id)).map((n) => n.id)); this.changed(); });
    this.$('[data-play]').addEventListener('click', () => this.toggle());
    this.el.querySelectorAll<HTMLButtonElement>('[data-cmp]').forEach((b) => b.addEventListener('click', () => this.compare(b.dataset.cmp as 'pick' | 'all')));
    this.$('[data-ok]').addEventListener('click', () => {
      const notes = this.toSet();
      if (!notes.length) return;
      this.d.player.audio.pause();
      this.d.commit(this.widget, notes, this.opened?.edit?.id ?? null);
    });
    this.$('[data-add]').addEventListener('click', () => {
      const id = this.opened?.edit?.id;
      if (!id) return;
      const set = this.toSet();
      renumberLost(this.picked(), this.knobValues.values());
      this.tried = this.knobValues;
      this.d.addNotes(id, this.widget, set);
    });
    const lane = this.$('.np-chips-in');
    lane.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !(e.target as HTMLElement).closest('.np-lane, .np-amount')) return;
      e.preventDefault(); e.stopPropagation();
      this.amountDrag = true;
      const on = this.setAmountAt(e.clientX, e.clientY);
      if (on) this.d.tone(on.m, 0.12, 0.4);
    });
    window.addEventListener('pointermove', (e) => { if (this.amountDrag) this.setAmountAt(e.clientX, e.clientY); });
    window.addEventListener('pointerup', () => { if (this.amountDrag) { this.amountDrag = false; this.draft(false); } });
    lane.addEventListener('dblclick', (e) => {
      const bar = (e.target as HTMLElement).closest<HTMLElement>('.np-amount');
      if (!bar) return;
      this.putValue(Number(bar.dataset.for), this.lane().base);
      this.drawAmounts();
      this.draft(false);
    });
    lane.addEventListener('keydown', (e) => {
      const bar = (e.target as HTMLElement).closest<HTMLElement>('.np-amount');
      if (!bar || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault(); e.stopPropagation();
      // A twentieth of the way, in whole steps; with Shift one step, as a drag can't always land next to the clip's value.
      const id = Number(bar.dataset.for), s = this.lane(), now = this.valueOf(id, s), by = e.shiftKey ? s.step : s.step * Math.max(1, Math.round((s.max - s.min) / 20 / s.step));
      this.putValue(id, Math.max(s.min, Math.min(s.max, Number((now + (e.key === 'ArrowUp' ? by : -by)).toFixed(4)))));
      this.drawAmounts();
      this.draft(false);
    });
    this.$<HTMLSelectElement>('[data-lane]').addEventListener('change', (e) => { this.laneKey = (e.target as HTMLSelectElement).value; this.drawAmounts(); });
    const strip = this.$('.np-chips');
    const contentX = (clientX: number) => clientX - strip.getBoundingClientRect().left + strip.scrollLeft;
    strip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.clientY - strip.getBoundingClientRect().top > strip.clientHeight) return;   // not on its scrollbar
      const id = this.chipId(e.target), touch = e.pointerType === 'touch';
      if (id === null && touch) return;   // a finger on the empty strip scrolls it
      e.preventDefault();
      const chip = this.layout.find((c) => c.note.id === id), at = chip ? chip.x + 10 : contentX(e.clientX);
      const range = e.shiftKey && chip && this.lastChip !== null;
      const on = range || !(e.altKey || (id !== null && this.picks.has(id)));
      this.sweep = { on, base: new Set(this.picks), from: range ? this.lastChip! : at, to: at, moved: !!range, x0: e.clientX, clientX: e.clientX, touch };
      if (id !== null) this.set(id, on);
      if (range) this.applySweep();
      if (chip) { this.lastChip = at; this.d.tone(chip.note.m, 0.12, 0.4); }
      this.drawPicks();
      if (!touch) requestAnimationFrame(this.scrollSweep);
    });
    window.addEventListener('pointermove', (e) => {
      const s = this.sweep;
      if (!s || s.touch) return;
      s.clientX = e.clientX;
      if (!s.moved && Math.abs(e.clientX - s.x0) < 4) return;   // a click, with a shaky hand
      s.moved = true; s.to = contentX(e.clientX);
      this.applySweep();
      this.drawPicks();
    });
    strip.addEventListener('dblclick', (e) => {
      const id = this.chipId(e.target);
      if (id === null) return;
      for (const n of phraseOf(this.melody(), id)) this.picks.add(n.id);
      this.changed();
    });
    strip.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey || !e.deltaY || e.deltaX) return;
      e.preventDefault();
      strip.scrollLeft += e.deltaY;
    }, { passive: false });
    // A change during playback reaches the draft when the sweep ends, by the same reload as a real edit.
    window.addEventListener('pointerup', () => { if (this.sweep !== null) { this.sweep = null; this.draft(false); } });
    // Enter on a focused chip clicks it with no pointer; Space stays the preview's, in the picker's keys.
    strip.addEventListener('click', (e) => {
      const id = this.chipId(e.target);
      if (e.detail !== 0 || id === null) return;
      this.set(id, !this.picks.has(id));
      this.changed();
    });
  }

  /** The knobs a note can set on this widget, in the lane's words. */
  private laneScales(): LaneScale[] {
    const edit = this.opened?.edit, own = edit && edit.widget === this.widget ? edit.knobs : undefined;
    return [INTENSITY_LANE, ...noteKnobs(this.widget, this.d.catalogue.get(this.widget)?.meta.params ?? []).map((q) => knobLane(q, own?.[q.key]))];
  }

  private lane(): LaneScale { return this.laneScales().find((s) => s.key === this.laneKey) ?? INTENSITY_LANE; }

  private valueOf(id: number, s: LaneScale): number {
    return (s.key === INTENSITY ? this.intensities.get(id) : this.knobValues.get(this.widget)?.get(id)?.[s.key]) ?? s.base;
  }

  /** The bar's value on this note: at the base, none. A knob holds one value per attack, so the picked notes of one share it. */
  private putValue(id: number, v: number): void {
    const s = this.lane();
    if (s.key === INTENSITY) { if (v === s.base) this.intensities.delete(id); else this.intensities.set(id, v); return; }
    let mine = this.knobValues.get(this.widget);
    if (!mine) this.knobValues.set(this.widget, (mine = new Map()));
    for (const n of attackMates(this.picked()).get(id) ?? [id]) {
      const { [s.key]: _was, ...rest } = mine.get(n) ?? {};
      mine.set(n, v === s.base ? rest : { ...rest, [s.key]: v });
    }
  }

  /** The picked notes as a set, with this widget's knob values. */
  private toSet(): PickNote[] {
    const mine = this.knobValues.get(this.widget), all = new Map<number, NoteValues>();
    for (const { id } of this.picked()) {
      const a = this.intensities.get(id);
      all.set(id, { ...mine?.get(id), ...(a === undefined ? {} : { [INTENSITY]: a }) });
    }
    return toPicks(this.picked(), all);
  }

  /** The bar nearest the pointer takes the pointer's height, a picked note's only. Says whose it was. */
  private setAmountAt(clientX: number, clientY: number): RollNote | null {
    const lane = this.$('.np-lane').getBoundingClientRect(), x = clientX - this.$('.np-chips-in').getBoundingClientRect().left;
    let best: { id: number } | null = null, d = 14;
    for (const b of this.bars) {
      const off = Math.abs(b.x + b.w / 2 - x);
      if (this.picks.has(b.id) && off < d) { best = b; d = off; }
    }
    if (!best) return null;
    this.putValue(best.id, laneValue(clientY - lane.top, lane.height, this.lane()));
    this.drawAmounts();
    return this.melody().find((n) => n.id === best!.id) ?? null;
  }

  /** The picks the drag has made so far: what they were, with the notes it has passed added or taken off. Going back undoes. */
  private applySweep(): void {
    const s = this.sweep!, lo = Math.min(s.from, s.to), hi = Math.max(s.from, s.to);
    this.picks = new Set(s.base);
    for (const n of sweptChips(this.layout, lo - SWEEP_REACH, hi + SWEEP_REACH)) this.set(n.id, s.on);
  }

  /** While the pointer is held near the strip's edge the strip scrolls under it, and the drag goes on. */
  private readonly scrollSweep = (): void => {
    const s = this.sweep;
    if (!s) return;
    if (s.moved) {
      const strip = this.$('.np-chips'), r = strip.getBoundingClientRect();
      const near = s.clientX < r.left + EDGE ? -(r.left + EDGE - s.clientX) : s.clientX > r.right - EDGE ? s.clientX - (r.right - EDGE) : 0;
      if (near) {
        const before = strip.scrollLeft;
        strip.scrollLeft += Math.sign(near) * Math.min(EDGE_SPEED, 2 + Math.abs(near) * 0.4);
        if (strip.scrollLeft !== before) { s.to = s.clientX - r.left + strip.scrollLeft; this.applySweep(); this.drawPicks(); }
      }
    }
    requestAnimationFrame(this.scrollSweep);
  };

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
    this.intensities = new Map();
    this.knobValues = o.resume !== undefined ? this.tried : new Map();
    this.laneKey = INTENSITY;
    this.mode = 'pick';
    this.widget = o.resume ?? o.edit?.widget ?? (catalogue.has(FIRST_CHOICE) ? FIRST_CHOICE : order[0]);
    const own = new Map<number, NoteValues>();
    for (const [id, vals] of o.values ?? []) {
      const { [INTENSITY]: a, ...knobs } = vals;
      if (a !== undefined) this.intensities.set(id, a);
      own.set(id, knobs);
    }
    this.knobValues.set(this.widget, own);
    this.before = player.time;
    this.until = null;
    player.audio.pause();
    player.rest(true);
    this.closeChooser();
    this.buildChips();
    this.el.hidden = false;
    const canvas = this.$<HTMLCanvasElement>('canvas');
    this.runtime = new WidgetRuntime(canvas, { notes: pack.notes, tracks: pack.tracks, loudness: pack.loudness }, lib);
    this.conductor = new Conductor(this.runtime, this.draftNow(), meta);
    this.conductor.reset(player.time);
    this.stopLive = startLive(this.conductor, this.runtime, player.audio, (t) => this.frame(t));
    this.$('[data-ok]').textContent = o.edit ? 'Update the scene' : 'Place in scene';
    this.$('[data-add]').hidden = !o.edit;
    this.drawWidget();
    this.drawCompare();
    this.drawPicks();
    this.$('[data-choose]').focus();
    // Editing a set: its notes in view, whenever in the song they are.
    const first = this.layout.find((c) => this.picks.has(c.note.id));
    this.$('.np-chips').scrollLeft = first ? Math.max(0, first.x - 60) : 0;
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
    this.d.closed();
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
    return draftShow(pack.id, pack.duration, this.widget, this.mode === 'pick' ? this.toSet() : null, knobs);
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
    // The instance on show only: one that failed earlier in this popup is no word about this one.
    const why = this.runtime?.errors[draftKey(this.widget, this.mode)] ?? null;
    if (why !== this.stopped) {
      if (why) { this.stopped = why; this.$('[data-what]').textContent = `This widget stopped: ${why.replace(/^Error: /, '')}`; } else this.drawWidget();
    }
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
    this.layout = chips; this.lastChip = null;
    box.textContent = '';
    box.style.width = `${width}px`;
    for (const g of gaps) {
      const el = Object.assign(document.createElement('div'), { className: 'np-gap', textContent: `${Math.round(g.secs)} s` });
      el.title = `A pause of ${g.secs.toFixed(1)} s, up to ${clock(g.t)}`;
      el.style.left = `${g.x}px`;
      box.append(el);
    }
    for (const r of chipRuler(chips)) {
      const el = Object.assign(document.createElement('div'), { className: 'np-chip-time', textContent: fineClock(r.t) });
      el.style.left = `${r.x + 10}px`;
      box.append(el);
    }
    for (const { note: n, x, y, tail } of chips) {
      const c = Object.assign(document.createElement('button'), { type: 'button', className: 'np-chip', textContent: pitchClass(n.m) });
      const who = many && n.i >= 0 ? `${this.d.instruments[n.i].label}, ` : '';
      c.title = `${who}${nameOf(n.m)} at ${fineClock(n.t)}${n.i < 0 ? ': no note here any more' : ''}`;
      c.setAttribute('aria-label', c.title);
      c.dataset.id = String(n.id);
      if (many && n.i >= 0) c.style.setProperty('--ic', this.d.instruments[n.i].color);
      c.style.left = `${x}px`; c.style.top = `${y}px`;
      if (tail > 10) c.style.setProperty('--tail', `${Math.round(tail)}px`);
      box.append(c);
    }
    box.append(Object.assign(document.createElement('div'), { className: 'np-lane' }));
    this.bars = amountBars(chips);
    for (const b of this.bars) {
      const el = Object.assign(document.createElement('div'), { className: 'np-amount', tabIndex: 0 });
      el.dataset.for = String(b.id);
      el.setAttribute('role', 'slider');
      el.style.left = `${b.x}px`; el.style.width = `${Math.max(2, b.w - 1)}px`;
      box.append(el);
    }
  }

  /** The bars of the picked notes, at their values, and the choice of what they set, a dot on what holds values. */
  private drawAmounts(): void {
    const byId = new Map(this.melody().map((n) => [n.id, n] as const)), scales = this.laneScales(), s = this.lane();
    const used = new Set<string>(), mine = this.knobValues.get(this.widget);
    for (const n of this.picked()) {
      if (this.intensities.has(n.id)) used.add(INTENSITY);
      for (const key of Object.keys(mine?.get(n.id) ?? {})) used.add(key);
    }
    const pick = this.$<HTMLSelectElement>('[data-lane]');
    pick.replaceChildren(...scales.map((q) => Object.assign(document.createElement('option'), { value: q.key, textContent: `${used.has(q.key) ? '• ' : ''}${q.label}` })));
    pick.value = s.key;
    this.$('[data-lane-hint]').textContent = s.key === INTENSITY ? s.hint : `From that note until the next picked one. ${s.hint}`;
    this.$('.np-lane').style.setProperty('--base', `${(1 - laneShare(s.base, s)) * 100}%`);
    this.el.querySelectorAll<HTMLElement>('.np-amount').forEach((el) => {
      const id = Number(el.dataset.for), note = byId.get(id)!, v = this.valueOf(id, s);
      el.hidden = !this.picks.has(id);
      el.style.setProperty('--amount', String(laneShare(v, s)));
      el.classList.toggle('set', v !== s.base);
      el.title = barWords(note, v, s);
      el.setAttribute('aria-label', el.title);
      el.setAttribute('aria-valuemin', String(s.min)); el.setAttribute('aria-valuemax', String(s.max)); el.setAttribute('aria-valuenow', String(v));
    });
  }

  private drawPicks(): void {
    this.el.querySelectorAll<HTMLElement>('.np-chip').forEach((c) => {
      const on = this.picks.has(Number(c.dataset.id));
      c.classList.toggle('sel', on);
      c.setAttribute('aria-pressed', String(on));
    });
    this.drawAmounts();
    const picked = this.picked(), w = countWords(picked, this.melody().length);
    this.$('[data-count]').textContent = w.count;
    this.$('[data-of]').textContent = w.of;
    this.$('[data-attacks]').textContent = w.attacks;
    this.$('[data-span]').textContent = pickedSpan(this.picked());
    this.$<HTMLButtonElement>('[data-ok]').disabled = !picked.length;
  }

  private drawCompare(): void {
    this.el.querySelectorAll<HTMLElement>('[data-cmp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cmp === this.mode)));
  }

  private drawWidget(): void {
    this.stopped = null;
    const m = this.d.catalogue.get(this.widget)?.meta;
    this.$('[data-choose]').textContent = m?.name ?? this.widget;
    this.$('[data-what]').innerHTML = m?.blurb ?? '';
  }

  private closeChooser(): void {
    this.$('.np-chooser').hidden = true;
    this.$('[data-choose]').setAttribute('aria-expanded', 'false');
  }

  /** The studio's widget picker, all widgets: `here` empty, or a widget already in the section couldn't be chosen. */
  private metas(): WidgetMeta[] {
    const { catalogue, order } = this.d, tags = labTags();
    return order.map((id) => catalogue.get(id)?.meta).filter((m): m is WidgetMeta => !!m)
      .map((m) => (m.tags !== undefined ? m : { ...m, tags: tagsOf(tags, m.id) }));
  }

  private takeWidget(id: string): void {
    this.widget = id;
    this.laneKey = INTENSITY;
    this.drawAmounts();
    this.closeChooser();
    this.drawWidget();
    this.draft(true);
  }

  /** Ctrl+P: the same choice as the chooser, by typing. */
  choose(palette: WidgetPalette): void {
    const metas = this.metas().map((m, k) => ({ m, k })).sort((a, b) => groupOf(a.m) - groupOf(b.m) || a.k - b.k).map((x) => x.m);
    palette.open({ title: 'Connect your notes to', metas, verdict: verdictTag, hue: widgetHue, pick: (id) => this.takeWidget(id) });
  }

  private toggleChooser(): void {
    const box = this.$('.np-chooser');
    if (!box.hidden) { this.closeChooser(); return; }
    const { pack } = this.d;
    mountWidgetPicker(box, {
      metas: this.metas(), words: labTagWords(), tracks: TRACK_IDS.filter((id) => (pack.tracks?.[id]?.notes.length ?? 0) > 0),
      here: new Set(), state: this.chooserState, groups: GROUPS, groupOf, verdict: verdictTag, hue: widgetHue,
      pick: (id) => this.takeWidget(id),
    });
    box.hidden = false;
    this.$('[data-choose]').setAttribute('aria-expanded', 'true');
  }
}
