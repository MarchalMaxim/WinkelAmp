/**
 * The note picker (spec 2026-11-01-note-picker), over the whole studio for the current song: mark the melody on a roll,
 * connect a few of those notes to a widget in a popup, and the widget answers those notes only. This file is the overlay:
 * its tools, the legend, the three steps, the stage mirror, the set rows, the marks with their own undo and saving, the
 * tones, and the keys, which it takes before the studio does while it is open.
 */
import './picker.css';
import type { SongPack } from '../pack/pack';
import { emptyMelody, validateMelody, type Mark } from '../show/melody';
import { nextPicksId } from '../show/edit';
import type { WaLayers } from '../../widgets/layers';
import type { LabHarness, Note, WidgetMeta } from '../../widgets/types';
import type { ShowStore } from './api';
import type { CatalogueEntry } from './panel';
import { PickerPopup } from './picker-popup';
import { PickerRoll } from './picker-roll';
import {
  clock, firstClipOf, marksOnRoll, marksToSave, MarksSaver, NoteIndex, pickerNotes, picksOnRoll, popupChips, recordingVolume, setRows, suggestLine, undoWords, unmatchedWords,
  type Instrument, type RollNote, type SetRow,
} from './picker-logic';
import type { Player } from './player';
import type { Notice, Store } from './store';
import { widgetHue } from './timeline';
import type { WidgetPalette } from './widget-palette';

export interface PickerDeps {
  store: Store; player: Player; api: ShowStore; pack: SongPack; canvas: HTMLCanvasElement;
  catalogue: Map<string, CatalogueEntry>; order: string[]; palette: WidgetPalette;
  lib: { sources: Record<string, string>; harness: LabHarness; layers: WaLayers };
  meta(widget: string): WidgetMeta | undefined; notify(n: Notice): void;
}

const SAVE_AFTER = 1000, UNDO_DEPTH = 100, MAX_TONES = 8;
const hueColor = (widget: string): string => `hsl(${widgetHue(widget)} 62% 62%)`;

/** What the song's roll is made of, read once on the first open. */
interface Loaded { notes: RollNote[]; index: NoteIndex; roll: PickerRoll; popup: PickerPopup }

export class Picker {
  readonly el = document.createElement('div');
  private loading: Promise<Loaded> | null = null;
  private l: Loaded | null = null;
  private isOpen = false;
  private readonly marked = new Set<number>();
  private unmatched: Mark[] = [];
  private undoStack: { marked: number[]; unmatched: Mark[] }[] = [];
  /** A widget was placed or removed since the marks last changed: Ctrl+Z may be meant for that, and doesn't do it. */
  private sceneEdited = false;
  private saveTimer = 0;
  private readonly saver = new MarksSaver({
    snapshot: () => ({ ...emptyMelody(this.d.pack.id), notes: marksToSave(this.marked, this.l?.notes ?? [], this.unmatched) }),
    write: (m, leaving) => this.d.api.saveMelody(m, leaving),
    saved: () => { if (this.d.store.state.notices.some((n) => n.id === 'picker-save')) this.d.store.dispatch({ type: 'dismiss', id: 'picker-save' }); },
    failed: (e) => this.d.notify({ id: 'picker-save', level: 'error', text: `The marked melody was not saved: ${e.message}` }),
  });
  private readonly hidden = new Set<number>();
  private readonly hearing = new Set<number>();
  private tones = true;
  private ac: AudioContext | null = null;
  private raf = 0;
  private cursor = 0;
  private lastT = 0;
  private second = -1;
  private wasPlaying: boolean | null = null;
  private unsubscribe: (() => void) | null = null;
  private dots = new Map<number, string>();
  private rows: SetRow[] = [];
  private drawnShow: unknown = null;
  private ticksView: unknown = null;
  private ticksW = 0;
  private rowsKey = '';
  private readonly $ = <T extends HTMLElement>(q: string) => this.el.querySelector<T>(q)!;

  constructor(private readonly d: PickerDeps) {
    this.el.className = 'np';
    this.el.hidden = true;
    this.el.setAttribute('aria-label', 'Note picker');
    this.el.innerHTML = `
      <header class="np-head"><button type="button" data-back>Back to the studio</button><b class="np-title"></b><span class="dim">Pick notes</span></header>
      <div class="np-tools">
        <button type="button" data-play title="Space">▶ Play</button>
        <span class="np-time" data-time>0:00</span>
        <button type="button" data-out aria-label="Zoom out">−</button>
        <button type="button" data-in aria-label="Zoom in">+</button>
        <button type="button" data-ping aria-pressed="true" title="A soft tone on each melody note while it plays, so you can check your marks by ear">Tone on melody notes</button>
        <button type="button" data-suggest title="Marks a line in the part you're looking at, from the instruments on show. Undo takes it back.">Suggest top line here</button>
        <button type="button" data-undo>Undo</button>
        <span class="np-sp"></span>
        <span class="np-hint">Click a note to mark it · drag across several · Alt-drag to unmark · Ctrl-scroll to zoom</span>
      </div>
      <div class="np-tools np-legend" hidden></div>
      <div class="np-notices" aria-live="polite"></div>
      <div class="np-main">
        <div class="np-left">
          <div class="np-roll-host"></div>
          <div class="np-scene"><div class="np-scene-head" hidden></div></div>
        </div>
        <div class="np-right">
          <div class="np-card np-stage"><canvas aria-label="The scene"></canvas><div class="np-stage-label"></div></div>
          <div class="np-card">
            <ol class="np-steps">
              <li data-s1><i>1</i><div>Mark the melody<small data-s1t></small></div></li>
              <li data-s2><i>2</i><div>Connect notes to a widget<div class="np-connect"><button type="button" class="primary" data-connect disabled>Connect to a widget…</button></div></div></li>
              <li data-s3><i>3</i><div>Hear it in the scene<small>Each picked note fires the widget once</small></div></li>
            </ol>
          </div>
          <p class="np-fine" data-guess hidden>These instrument names are the transcriber's guess: it can get one wrong.</p>
        </div>
      </div>`;
    document.body.append(this.el);
    this.$('[data-back]').addEventListener('click', () => this.close());
    this.$('[data-play]').addEventListener('click', () => this.d.player.toggle());
    this.$('[data-out]').addEventListener('click', () => this.l?.roll.zoom(1 / 0.7));
    this.$('[data-in]').addEventListener('click', () => this.l?.roll.zoom(0.7));
    this.$('[data-ping]').addEventListener('click', () => { this.tones = !this.tones; this.$('[data-ping]').setAttribute('aria-pressed', String(this.tones)); });
    this.$('[data-suggest]').addEventListener('click', () => this.suggest());
    this.$('[data-undo]').addEventListener('click', () => this.undo());
    this.$('[data-connect]').addEventListener('click', () => this.openPopup());
    window.addEventListener('pagehide', () => { clearTimeout(this.saveTimer); this.saver.leaving(); });
  }

  /** Marks that would be lost by leaving now: a failed save, or marks that can't go with the page. */
  get marksAtRisk(): boolean { return this.saver.atRisk(); }

  /** The roll and the popup, once opened: the checks drive them. */
  get roll(): PickerRoll | null { return this.l?.roll ?? null; }
  get popup(): PickerPopup | null { return this.l?.popup ?? null; }

  /** Opens the picker, and with a set's id its popup on that set. */
  async open(editSet?: string): Promise<void> {
    if (this.d.store.state.ui.recording) return;
    const l = (this.l = await (this.loading ??= this.load()));
    if (!this.isOpen) {
      this.isOpen = true;
      this.el.hidden = false;
      window.addEventListener('keydown', this.onKey, true);
      this.unsubscribe = this.d.store.subscribe(() => this.drawStore());
      this.drawStore();
      this.drawSteps();
      this.cursor = l.index.firstFrom(this.d.player.time);
      this.lastT = this.d.player.time;
      l.roll.resize();
      this.raf = requestAnimationFrame(this.frame);
      this.$('[data-back]').focus();   // no studio button keeps the focus under the overlay
    }
    if (editSet !== undefined) this.openPopup(editSet);
  }

  close(): void {
    if (!this.isOpen) return;
    this.popup?.close();
    this.isOpen = false;
    this.el.hidden = true;
    window.removeEventListener('keydown', this.onKey, true);
    this.unsubscribe?.();
    cancelAnimationFrame(this.raf);
    clearTimeout(this.saveTimer);
    this.saveMarks();
    this.hearing.clear();
    this.el.querySelectorAll('.np-hear').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    this.duck();
  }

  private async load(): Promise<Loaded> {
    const { api, pack, notify } = this.d;
    const labels = await api.labels(pack.id).catch((e: Error) => {
      notify({ id: 'picker-labels', level: 'warn', text: `Could not read the instrument labels: ${e.message}` });
      return [];
    });
    const { notes, instruments, guessed } = pickerNotes(pack, labels), index = new NoteIndex(notes);
    let marks: Mark[] = [];
    try {
      const m = await api.melody(pack.id), issues = validateMelody(m);
      if (issues.length) throw new Error(`${issues[0].path}: ${issues[0].message}`);
      marks = m.notes;
    } catch (e) {
      this.saver.block();
      notify({ id: 'picker-marks', level: 'error', text: `Could not read the marked melody (${(e as Error).message}): marks made now will not be saved, so the file stays as it is.` });
    }
    const r = marksOnRoll(marks, notes);
    r.marked.forEach((id) => this.marked.add(id));
    this.unmatched = r.unmatched;
    this.tellUnmatched();
    const roll = new PickerRoll({
      notes, index, instruments, duration: pack.duration, marked: this.marked, hidden: this.hidden,
      unmatched: () => this.unmatched, dotOf: (id) => this.dots.get(id), time: () => this.d.player.time,
      click: (n) => { this.remember(); if (this.marked.has(n.id)) this.marked.delete(n.id); else this.marked.add(n.id); this.tone(n.m, 0.12, 0.5); this.changed(); },
      box: (hits, unmark, lost) => {
        this.remember();
        for (const n of hits) if (unmark) this.marked.delete(n.id); else this.marked.add(n.id);
        if (lost.length) { this.unmatched = this.unmatched.filter((k) => !lost.includes(k)); this.tellUnmatched(); }
        this.changed();
      },
      seek: (t) => this.d.player.seek(t),
    });
    const popup = new PickerPopup({
      player: this.d.player, pack, catalogue: this.d.catalogue, order: this.d.order, lib: this.d.lib, meta: this.d.meta, instruments,
      tone: (m, gain, len) => this.tone(m, gain, len),
      commit: (widget, picks, id) => this.commit(widget, picks, id),
      closed: () => this.duck(),
    });
    this.$('.np-roll-host').append(roll.el, roll.stripEl);
    this.el.append(popup.el);
    this.$('.np-title').textContent = pack.title;
    this.$('[data-guess]').hidden = !guessed;
    this.buildLegend(notes, instruments);
    return { notes, index, roll, popup };
  }

  // ---- the marks ----

  private remember(): void {
    this.undoStack.push({ marked: [...this.marked], unmatched: this.unmatched });
    if (this.undoStack.length > UNDO_DEPTH) this.undoStack.shift();
  }

  private undo(): void {
    const was = this.undoStack.pop(), told = this.sceneEdited;
    this.sceneEdited = false;
    let notes = 0;
    if (was) {
      const back = new Set(was.marked);
      for (const id of this.marked) if (!back.has(id)) notes++;
      for (const id of back) if (!this.marked.has(id)) notes++;
      notes += Math.abs(was.unmatched.length - this.unmatched.length);
      this.marked.clear();
      was.marked.forEach((id) => this.marked.add(id));
      if (was.unmatched !== this.unmatched) { this.unmatched = was.unmatched; this.tellUnmatched(); }
      this.changed();
    }
    if (told) {
      this.d.notify({ id: 'picker-undo', level: 'info', text: undoWords(notes) });
      setTimeout(() => this.d.store.dispatch({ type: 'dismiss', id: 'picker-undo' }), 10000);
    }
  }

  private tellUnmatched(): void {
    const k = this.unmatched.length;
    if (k) this.d.notify({ id: 'picker-unmatched', level: 'warn', text: unmatchedWords(k) });
    else this.d.store.dispatch({ type: 'dismiss', id: 'picker-unmatched' });
  }

  private changed(): void {
    this.l?.roll.invalidate();
    this.drawSteps();
    this.sceneEdited = false;
    this.saver.changed();
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveMarks(), SAVE_AFTER);
  }

  private saveMarks(): void { this.saver.save(); }
  /** The checks wait on it. */
  get saving(): Promise<unknown> { return this.saver.saving; }

  private suggest(): void {
    if (!this.l) return;
    const { a, b } = this.l.roll.view, inView = this.l.index.inView(a, b).filter((n) => n.t >= a && !this.hidden.has(n.i));
    const line = suggestLine(this.d.lib.layers, inView);
    if (!line.length) return;
    this.remember();
    for (const n of line) this.marked.add(n.id);
    this.changed();
  }

  // ---- the popup and the scene ----

  private openPopup(editSet?: string): void {
    if (!this.l) return;
    const { notes, popup } = this.l, show = this.d.store.state.show!, set = editSet !== undefined ? show.picks?.[editSet] : undefined;
    const { chips, on } = popupChips(notes.filter((n) => this.marked.has(n.id)), set?.notes ?? null, notes);
    const layer = set ? firstClipOf(show, editSet!) : null;
    popup.open({ chips, on, marked: this.marked, edit: set ? { id: editSet!, widget: layer?.widget ?? null, knobs: layer?.knobs } : null });
    this.duck();
  }

  /** One edit, one undo in the studio. The new layer is selected, so its lane is open; the playhead goes a second before
      the first pick. */
  private commit(widget: string, notes: Note[], id: string | null): void {
    const { store } = this.d, set = id ?? nextPicksId(store.state.show!);
    this.sceneEdited = true;
    store.dispatch({ type: 'edit', edit: id ? { kind: 'updatePicks', id, widget, notes } : { kind: 'placePicks', widget, notes } });
    const at = firstClipOf(store.state.show!, set);
    if (at) store.dispatch({ type: 'select', clip: at.id });
    this.popup?.close(Math.max(0, notes[0][0] - 1));
  }

  /** The show or the notices changed. */
  private drawStore(): void {
    const { show, notices } = this.d.store.state;
    // The whole show, not its picks: a moved or removed clip changes a row with the same set of picks.
    if (show && show !== this.drawnShow) {
      this.drawnShow = show;
      this.rows = setRows(show);
      if (this.l) {
        const { notes, roll } = this.l;
        this.dots = new Map(this.rows.flatMap((r) => picksOnRoll(r.notes, notes).found.map((n) => [n.id, hueColor(r.widget ?? '')] as const)));
        roll.invalidate();
      }
      this.buildRows();
      this.drawSteps();
    }
    // The studio's notices sit under the overlay: what they say is said here too.
    const box = this.$('.np-notices');
    box.textContent = '';
    for (const n of notices) {
      const div = Object.assign(document.createElement('div'), { className: `notice ${n.level}` });
      div.append(Object.assign(document.createElement('span'), { className: 'notice-text', textContent: n.text }));
      const x = Object.assign(document.createElement('button'), { type: 'button', className: 'icon', textContent: '✕' });
      x.setAttribute('aria-label', 'Dismiss');
      x.addEventListener('click', () => this.d.store.dispatch({ type: 'dismiss', id: n.id }));
      div.append(x);
      box.append(div);
    }
  }

  private buildRows(): void {
    const box = this.$('.np-scene'), key = JSON.stringify(this.rows.map((r) => [r.id, r.widget, r.neverHeard]));
    this.ticksView = null;
    if (key === this.rowsKey) return;
    this.rowsKey = key;
    box.querySelectorAll('.np-set, .np-empty').forEach((x) => x.remove());
    this.$('.np-scene-head').hidden = !this.rows.length;
    if (!this.rows.length) box.append(Object.assign(document.createElement('div'), { className: 'np-empty', textContent: 'The scene is empty. Widgets you connect land here, lined up with the notes above.' }));
    for (const r of this.rows) {
      const name = r.widget ? this.d.meta(r.widget)?.name ?? r.widget : 'On no clip';
      const row = Object.assign(document.createElement('div'), { className: 'np-set' });
      row.dataset.set = r.id;
      const label = Object.assign(document.createElement('div'), { className: 'np-set-name', textContent: name, title: name });
      if (r.widget) label.style.color = hueColor(r.widget);
      const canvas = Object.assign(document.createElement('canvas'), { title: 'Click to edit the picks' });
      canvas.addEventListener('click', () => this.openPopup(r.id));
      row.append(label, canvas);
      if (r.neverHeard) {
        row.append(Object.assign(document.createElement('span'), {
          className: 'np-set-warn', textContent: `${r.neverHeard} never heard`,
          title: `${r.neverHeard} of these picks lie outside the clips using this set, or right at their end, so the widget misses them. A clip may have moved: edit the picks to span them again.`,
        }));
      }
      const x = Object.assign(document.createElement('button'), { type: 'button', textContent: '✕', title: 'Remove' });
      x.setAttribute('aria-label', `Remove ${name}`);
      x.addEventListener('click', () => { this.sceneEdited = true; this.d.store.dispatch({ type: 'edit', edit: { kind: 'removePicks', id: r.id } }); });
      row.append(x);
      box.append(row);
    }
  }

  /** The rows' ticks, when the view, the sets or the width changed. */
  private drawTicks(roll: PickerRoll): void {
    const { a, b } = roll.view, w = roll.axis.w, d = window.devicePixelRatio || 1;
    if (roll.view === this.ticksView && w === this.ticksW) return;
    this.ticksView = roll.view;
    this.ticksW = w;
    for (const r of this.rows) {
      const c = this.$(`.np-set[data-set="${r.id}"] canvas`) as HTMLCanvasElement, H = c.clientHeight, W = c.clientWidth;
      if (!W) continue;
      c.width = Math.round(W * d); c.height = Math.round(H * d);
      const g = c.getContext('2d')!, x = (t: number) => ((t - a) / (b - a)) * w, ns = r.notes;
      g.setTransform(d, 0, 0, d, 0, 0);
      g.fillStyle = hueColor(r.widget ?? '');
      g.globalAlpha = 0.2;
      g.beginPath(); g.roundRect(x(ns[0][0]) - 4, 2, x(ns[ns.length - 1][0]) - x(ns[0][0]) + 8, H - 4, 4); g.fill();
      g.globalAlpha = 1;
      for (const n of ns) if (n[0] >= a && n[0] <= b) g.fillRect(x(n[0]) - 1, 3, 2.5, H - 6);
    }
  }

  private drawSteps(): void {
    const n = this.marked.size, placed = this.rows.length > 0;
    this.$('[data-s1t]').textContent = n ? `${n} melody note${n === 1 ? '' : 's'} marked` : 'No notes marked yet';
    this.$<HTMLButtonElement>('[data-connect]').disabled = !n;
    this.$('[data-s1]').className = n ? 'done' : 'on';
    this.$('[data-s2]').className = placed ? 'done' : n ? 'on' : '';
    this.$('[data-s3]').className = placed ? 'on' : '';
    this.$('.np-stage-label').textContent = placed ? 'The scene. Press play to hear it.' : 'The scene. Press play once a widget is placed.';
  }

  /** Ensembles only: a name hides that instrument's notes, ♪ plays a tone on each with the recording turned down. */
  private buildLegend(notes: readonly RollNote[], instruments: readonly Instrument[]): void {
    if (instruments.length < 2) return;
    const box = this.$('.np-legend'), counts = instruments.map(() => 0);
    for (const n of notes) counts[n.i]++;
    box.hidden = false;
    box.append(Object.assign(document.createElement('span'), { className: 'np-lead', textContent: 'Instruments' }));
    instruments.forEach((x, k) => {
      const el = Object.assign(document.createElement('span'), { className: 'np-inst' });
      const show = Object.assign(document.createElement('button'), { type: 'button', className: 'np-show', title: `${counts[k]} notes. Click to hide or show them.` });
      const dot = document.createElement('i');
      dot.style.background = x.color;
      show.append(dot, `${x.label} `, Object.assign(document.createElement('span'), { className: 'dim', textContent: String(counts[k]) }));
      show.setAttribute('aria-pressed', 'true');
      const hear = Object.assign(document.createElement('button'), { type: 'button', className: 'np-hear', textContent: '♪', title: `Play a tone on each ${x.label} note, with the recording turned down` });
      hear.setAttribute('aria-pressed', 'false');
      hear.setAttribute('aria-label', `Hear ${x.label}`);
      show.addEventListener('click', () => {
        const on = this.hidden.has(k);
        if (on) this.hidden.delete(k); else this.hidden.add(k);
        show.setAttribute('aria-pressed', String(on));
        this.l?.roll.invalidate();
      });
      hear.addEventListener('click', () => {
        const on = !this.hearing.has(k);
        if (on) { this.hearing.add(k); this.audio(); } else this.hearing.delete(k);
        hear.setAttribute('aria-pressed', String(on));
        this.duck();
      });
      el.append(show, hear);
      box.append(el);
    });
  }

  // ---- sound ----

  private duck(): void { this.d.player.audio.volume = recordingVolume(this.hearing.size, !!this.popup?.isOpen); }

  private audio(): AudioContext {
    this.ac ??= new AudioContext();
    if (this.ac.state === 'suspended') void this.ac.resume().catch(() => {});
    return this.ac;
  }

  private tone(m: number, gain: number, len: number): void {
    const a = this.audio(), o = a.createOscillator(), v = a.createGain();
    o.type = 'sine'; o.frequency.value = 440 * 2 ** ((m - 69) / 12);
    v.gain.setValueAtTime(gain, a.currentTime); v.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + len);
    o.connect(v).connect(a.destination); o.start(); o.stop(a.currentTime + len);
  }

  /** The tones on the notes the playhead just passed: marked ones, and those of an instrument being heard. */
  private sound(t: number, { notes, index }: Loaded): void {
    if (t < this.lastT || t - this.lastT > 1) this.cursor = index.firstFrom(t);
    this.lastT = t;
    let played = 0;
    while (this.cursor < notes.length && notes[this.cursor].t <= t) {
      const n = notes[this.cursor++], hear = this.hearing.has(n.i);
      if ((hear || (this.tones && this.marked.has(n.id))) && played++ < MAX_TONES) this.tone(n.m, hear ? 0.07 : 0.1, 0.3);
    }
  }

  // ---- the frame and the keys ----

  private readonly frame = (): void => {
    this.raf = requestAnimationFrame(this.frame);
    const { player, pack, canvas } = this.d, t = player.time;
    if (!this.l) return;
    const { roll, popup } = this.l;
    if (!popup.isOpen) {
      if (player.playing) { roll.follow(t); this.sound(t, this.l); }
      else if (t !== this.lastT) { this.lastT = t; this.cursor = this.l.index.firstFrom(t); }   // a seek while paused: the tones go on from there
      const m = this.$<HTMLCanvasElement>('.np-stage canvas'), d = window.devicePixelRatio || 1;
      const w = Math.round(m.clientWidth * d), h = Math.round(m.clientHeight * d);
      if (w && (m.width !== w || m.height !== h)) { m.width = w; m.height = h; }
      if (w) m.getContext('2d')!.drawImage(canvas, 0, 0, w, h);   // the show as it plays: nothing is drawn twice
      roll.paint();
      this.drawTicks(roll);
      const head = this.$('.np-scene-head'), { a, b } = roll.view, x = roll.axis.x + ((t - a) / (b - a)) * roll.axis.w;
      head.style.transform = `translateX(${x}px)`;
      head.style.opacity = t >= a && t <= b ? '1' : '0';
    }
    const sec = Math.floor(t);
    if (sec !== this.second) { this.second = sec; this.$('[data-time]').textContent = `${clock(t)} / ${clock(player.duration || pack.duration)}`; }
    if (player.playing !== this.wasPlaying) { this.wasPlaying = player.playing; this.$('[data-play]').textContent = player.playing ? '❚❚ Pause' : '▶ Play'; }
  };

  /** Every key first, or the studio's would act on the show underneath. Space plays, Esc closes the popup and then the
      picker, Ctrl+Z undoes marks, Ctrl+S still saves. */
  private readonly onKey = (e: KeyboardEvent): void => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (mod && k === 's') return;
    if (this.d.palette.isOpen && !(mod && k === 'p')) return;   // its field has the keys, its dialog the Escape
    e.stopPropagation();
    const popup = this.popup, popupOpen = !!popup?.isOpen;
    if (this.d.palette.isOpen) { e.preventDefault(); this.d.palette.close(); return; }
    if (mod && k === 'p' && !e.shiftKey) { e.preventDefault(); if (popupOpen) popup!.choose(this.d.palette); return; }
    if (k === 'Escape') { e.preventDefault(); if (popupOpen) popup!.escape(); else this.close(); return; }
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); if (popupOpen) popup!.toggle(); else this.d.player.toggle(); return; }
    if (mod && k === 'z' && !e.shiftKey && !popupOpen) { e.preventDefault(); this.undo(); }
  };
}
