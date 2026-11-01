/**
 * The open layer's controls under its knobs (plan 2026-10-31 T16), in plain words:
 * - Listens to: all notes, an instrument track of this recording, a family of them, or a line derived from the notes,
 *   with a small picture of where that part plays in the section. A layer on hand-picked notes says how many instead,
 *   with a way back to the picker: the select could only orphan its set.
 * - Where: the whole screen, a spotlight (the widget seen only through a shape) or a window (the whole widget shrunk
 *   into a shape); its shape, edge softness, and for a window whether the layers below show through and how it fits.
 * - Intensity: always full, or a curve written by a preset (fade in or out, swell, pulse on the beats, gate on
 *   loudness, while its part plays), shaped further in the lane under the timeline.
 * Every change is one setLayer edit, one undo step.
 */
import './layer-controls.css';
import { TRACKS, TRACK_IDS } from '../pack/instruments';
import type { SongPack } from '../pack/pack';
import { FAMILIES, LINES, listenOf, picksId, type Layer, type Show } from '../show/show';
import type { Span, WaLayers } from '../../widgets/layers';
import type { Family, Line, Listen, Pivot, Region, TrackId } from '../../widgets/types';
import { impulseWords } from './picker-logic';

export interface ListenOption { group: string; value: Listen; label: string }

export const LINE_LABELS: Record<Line, string> = {
  melody: 'Melody', bassline: 'Bass line', inner: 'Inner voices', low: 'Low notes', high: 'High notes', accents: 'Accents',
};
const FAMILY_LABELS: Record<Family, string> = {
  keys: 'All keys', plucked: 'All plucked strings', strings: 'All strings', winds: 'All winds', brass: 'All brass',
  percussion: 'All percussion', voice: 'All voices',
};

const presentTracks = (pack: Pick<SongPack, 'tracks'>): TrackId[] => TRACK_IDS.filter((id) => (pack.tracks?.[id]?.notes.length ?? 0) > 0);

/** What a layer can listen to in this song: 'All notes'; 'In this recording': its tracks (TRACKS order, with their
    note counts); 'Families': a family with two tracks or more; 'From the notes': the six derived lines. */
export function listenOptions(pack: Pick<SongPack, 'tracks'>): ListenOption[] {
  const ids = presentTracks(pack);
  const out: ListenOption[] = [{ group: '', value: 'all', label: 'All notes' }];
  for (const id of ids) out.push({ group: 'In this recording', value: id, label: `${pack.tracks![id]!.label || TRACKS[id].label} (${pack.tracks![id]!.notes.length} notes)` });
  for (const f of FAMILIES) if (ids.filter((id) => TRACKS[id].family === f).length >= 2) out.push({ group: 'Families', value: `family:${f}`, label: FAMILY_LABELS[f] });
  for (const l of LINES) out.push({ group: 'From the notes', value: l, label: LINE_LABELS[l] });
  return out;
}

/** A part's name in words, whether or not this song has it. */
export function listenLabel(l: Listen): string {
  if (l === 'all') return 'All notes';
  if (picksId(l) !== null) return 'Your picks';
  if (l in LINE_LABELS) return LINE_LABELS[l as Line];
  if (l.startsWith('family:')) return FAMILY_LABELS[l.slice(7) as Family] ?? l;
  return TRACKS[l as TrackId]?.label ?? l;
}

/** The same in running text: lower case, but "French horns" keeps its capital. */
export const partWords = (l: Listen): string => listenLabel(l).toLowerCase().replace(/\bfrench\b/g, 'French');

/** The widgets that read the shared canvas (they cut or smear what is below): a spotlight keeps them doing that in
    place; in a window they read only their own picture. */
export const READERS: readonly string[] = ['casket', 'pixelsort', 'tunnel', 'blocks', 'fold', 'timeslice'];

/** A new region: a small copy of the whole widget (a window, the user's "place": the widget plays within its edges),
    a centred soft-edged box 40 % of the stage, the whole picture contained in it however the box is stretched. The
    readers too: in a window they cut only their own picture. A spotlight (a mask over the full-size widget) is chosen
    by hand. `widget` stays in the signature for callers that place by widget. */
export function defaultRegion(_widget: string): Region {
  return { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.4, h: 0.4, feather: 0.2, fit: 'contain' };
}

/** Where a layer is seen, in a few words ('' for the whole screen). */
export function describePlace(r: Region | undefined): string {
  return !r ? '' : r.mode === 'spot' ? 'as a mask' : 'as a small copy';
}

/** The pivots of a preset, or null when it does not apply. */
export type PresetChoice =
  | { kind: 'fadeIn' | 'fadeOut'; seconds: number } | { kind: 'swell' }
  | { kind: 'pulse'; every: number; unit: 'beats' | 'bars' } | { kind: 'gate'; above: number } | { kind: 'plays' };

export function presetPivots(L: WaLayers, choice: PresetChoice, span: Span,
  pack: Pick<SongPack, 'notes' | 'tracks' | 'beats' | 'loudness'>, listen: Listen | undefined, picks?: Show['picks']): Pivot[] {
  const P = L.presets;
  switch (choice.kind) {
    case 'fadeIn': return P.fadeIn(span, choice.seconds);
    case 'fadeOut': return P.fadeOut(span, choice.seconds);
    case 'swell': return P.swell(span);
    case 'pulse': return P.pulse(span, pack.beats, { every: choice.every * (choice.unit === 'bars' ? 4 : 1) });
    case 'gate': return P.gate(span, pack.loudness, { above: choice.above });
    case 'plays': return P.plays(span, L.listenNotes({ notes: pack.notes, tracks: pack.tracks, picks }, listen).notes);
  }
}

/** A loudness threshold for the gate: the section's 60th percentile, to 0.05, between 0.1 and 0.9. */
export function gateDefault(loud: SongPack['loudness'], span: Span): number {
  const a = Math.max(0, Math.floor(span.start / loud.hop)), b = Math.min(loud.values.length, Math.ceil(span.end / loud.hop));
  const v = loud.values.slice(a, b).filter(Number.isFinite).sort((x, y) => x - y);
  const q = v.length ? v[Math.floor(0.6 * (v.length - 1))] : 0.5;
  return Math.min(0.9, Math.max(0.1, Math.round(q * 20) / 20));
}

// ---- The DOM ----------------------------------------------------------------------------------------------------

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export type LayerPatch = { listen?: Listen | null; region?: Region | null; intensity?: Pivot[] | null };

export interface LayerControlsDeps {
  layers: WaLayers;
  pack: Pick<SongPack, 'notes' | 'tracks' | 'beats' | 'loudness'>;
  widget: string; hue: number;
  /** The section's span now (a boundary drag changes it without a redraw). */
  span(): Span;
  /** The layer now (undo changes it without a redraw). */
  layer(): Layer | undefined;
  /** One setLayer edit; group: the undo step it belongs to. Returns whether the show changed. */
  edit(patch: LayerPatch, group: string): boolean;
  /** The place a layer had before it went back to the whole screen (so Spotlight/Window bring it back), under the
      key memoryKey() gives for this layer now (its section and instance key, so a reorder never hands it to another). */
  memory: Map<string, Region>; memoryKey(): string;
  /** The show's sets of picks now, and the way to the popup on one. */
  picks(): Show['picks'];
  editPicks(id: string): void;
}

let step = 0;
const group = (what: string) => `${what}:${++step}`;

const SPARK_W = 120, SPARK_H = 14;

/** Draws the controls into `box`; sync() puts them in step with the show (after undo, a drag elsewhere). */
export function mountLayerControls(box: HTMLElement, d: LayerControlsDeps): { sync(): void } {
  const L = d.layers, reader = READERS.includes(d.widget);
  const opts = listenOptions(d.pack);
  box.classList.add('lc');
  box.innerHTML = `
    <section class="lc-part">
      <h4>Listens to</h4>
      <div class="lc-listen"><select aria-label="What this layer listens to"></select><canvas class="lc-spark" width="${SPARK_W}" height="${SPARK_H}" aria-hidden="true"></canvas></div>
      <p class="lc-picks small" hidden><span></span> <button type="button" data-edit-picks>Edit picks</button></p>
      <p class="lc-note small"></p>
    </section>
    <section class="lc-part">
      <h4>Where</h4>
      <div class="lc-seg" role="group" aria-label="Where it is seen">
        <button type="button" data-mode="">Whole screen</button><button type="button" data-mode="window" title="The whole widget, shrunk into a box you place">Small copy</button><button type="button" data-mode="spot" title="The full-size widget, seen only through a shape">Mask</button>
      </div>
      <p class="lc-say small"></p>
      <div class="lc-region">
        <label class="lc-row"><span>Shape</span><select data-shape aria-label="Shape"><option value="ellipse">Ellipse</option><option value="rect">Rectangle</option></select></label>
        <label class="lc-row"><span>Edge softness</span><input type="range" data-feather min="0" max="1" step="0.05" aria-label="Edge softness"><output data-feather-out></output></label>
        <label class="lc-row lc-win"><span>Fit</span><select data-fit aria-label="How the picture fits the window">
          <option value="cover">Fills the shape</option><option value="contain">Whole picture inside</option><option value="stretch">Stretched to the shape</option></select></label>
        <label class="lc-check lc-win"><input type="checkbox" data-blend> Lets the layers below through</label>
        <button type="button" class="link" data-reset>Reset place</button>
      </div>
      ${reader ? '<p class="lc-hint small">This widget cuts into the picture below it: as a small copy it cuts only its own picture.</p>' : ''}
    </section>
    <section class="lc-part">
      <h4>Intensity</h4>
      <p class="lc-curve small"><span></span> <button type="button" class="link" data-clear>Clear curve</button></p>
      <div class="lc-presets">
        <div class="lc-p"><button type="button" data-p="fadeIn">Fade in</button><span>over <input type="number" data-in min="0.5" max="60" step="0.5" value="4" aria-label="Fade in seconds"> s</span></div>
        <div class="lc-p"><button type="button" data-p="fadeOut">Fade out</button><span>over <input type="number" data-out min="0.5" max="60" step="0.5" value="4" aria-label="Fade out seconds"> s</span></div>
        <div class="lc-p"><button type="button" data-p="swell">Swell</button><span class="dim">up to the middle, then back</span></div>
        <div class="lc-p"><button type="button" data-p="pulse">Pulse</button><span>every <input type="number" data-every min="1" max="32" step="1" value="1" aria-label="Pulse every">
          <select data-unit aria-label="Beats or bars"><option value="beats">beats</option><option value="bars" title="The song has no downbeats, so a bar is counted as 4 beats">4-beat bars</option></select></span></div>
        <div class="lc-p"><button type="button" data-p="gate">Gate on loudness</button><span>above <input type="range" data-above min="0.05" max="0.95" step="0.05" aria-label="How loud"><output data-above-out></output></span></div>
        <div class="lc-p lc-plays"><button type="button" data-p="plays">While its part plays</button><span class="dim" data-part></span></div>
      </div>
    </section>`;

  const $ = <T extends Element>(q: string) => box.querySelector<T>(q)!;
  const sel = $<HTMLSelectElement>('.lc-listen select'), spark = $<HTMLCanvasElement>('.lc-spark'), note = $<HTMLElement>('.lc-note');
  const shape = $<HTMLSelectElement>('[data-shape]'), feather = $<HTMLInputElement>('[data-feather]'), featherOut = $<HTMLOutputElement>('[data-feather-out]');
  const fit = $<HTMLSelectElement>('[data-fit]'), blend = $<HTMLInputElement>('[data-blend]');
  const above = $<HTMLInputElement>('[data-above]'), aboveOut = $<HTMLOutputElement>('[data-above-out]');
  above.value = String(gateDefault(d.pack.loudness, d.span()));

  /** The options, plus one for a part this song lacks when the layer names one; rebuilt only when that changes. */
  let extra: Listen | null | undefined;
  const fillSelect = (cur: Listen) => {
    const has = opts.some((o) => o.value === cur);
    if ((has ? null : cur) === extra) { sel.value = cur; return; }
    extra = has ? null : cur;
    const all = has ? opts : [...opts, { group: 'Not in this recording', value: cur, label: `${listenLabel(cur)}: plays on all notes here` }];
    const groups = [...new Set(all.map((o) => o.group))];
    sel.innerHTML = groups.map((g) => {
      const items = all.filter((o) => o.group === g).map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
      return g ? `<optgroup label="${esc(g)}">${items}</optgroup>` : items;
    }).join('');
    sel.value = cur;
  };

  let drawn = '', drawnNotes: unknown;
  const drawSpark = (listen: Listen | undefined, span: Span) => {
    const key = JSON.stringify([listen ?? 'all', span.start, span.end]);
    const set = picksId(listen), mine = set !== null ? d.picks()?.[set]?.notes : undefined;   // an edited set draws again
    if (key === drawn && mine === drawnNotes) return;
    drawn = key; drawnNotes = mine;
    const { notes, heard } = L.listenNotes({ notes: d.pack.notes, tracks: d.pack.tracks, picks: d.picks() }, listen);
    const dpr = window.devicePixelRatio || 1;
    spark.width = Math.round(SPARK_W * dpr); spark.height = Math.round(SPARK_H * dpr);
    const g = spark.getContext('2d')!, len = Math.max(1e-6, span.end - span.start);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, SPARK_W, SPARK_H);
    const cols = new Array<number>(SPARK_W).fill(0);
    let here = 0;
    for (const n of notes) {
      if (n[1] <= span.start || n[0] >= span.end) continue;
      here++;
      const a = Math.max(0, Math.floor(((n[0] - span.start) / len) * SPARK_W)), b = Math.min(SPARK_W - 1, Math.floor(((Math.min(n[1], span.end) - span.start) / len) * SPARK_W));
      for (let x = a; x <= b; x++) cols[x]++;
    }
    const top = Math.max(3, ...cols);
    g.fillStyle = `hsl(${d.hue} 46% 62%)`;
    for (let x = 0; x < SPARK_W; x++) if (cols[x]) { const h = Math.max(2, Math.round((Math.sqrt(cols[x] / top)) * SPARK_H)); g.fillRect(x, SPARK_H - h, 1, h); }
    g.fillStyle = '#ffffff22'; g.fillRect(0, SPARK_H - 1, SPARK_W, 1);
    spark.title = `${here} notes in this section`;
    note.textContent = listen && heard === 'all' ? `This song has no ${partWords(listen)}: the layer plays on all notes.`
      : here ? `${here} note${here === 1 ? '' : 's'} in this section${listen ? '; it moves with these only' : ''}.` : 'Silent in this section: the layer stays still here.';
    note.classList.toggle('warn', !!listen && heard === 'all');
  };

  // Listens to
  sel.addEventListener('change', () => {
    const was = listenOf(d.layer() ?? { widget: d.widget }) ?? 'all', want = sel.value;
    if (!d.edit({ listen: want === 'all' ? null : want }, group('listen'))) {
      sel.value = was;
      note.textContent = `This widget already plays on ${partWords(want)} in this section, in another layer.`;
      note.classList.add('warn');
    }
  });

  // Where
  const region = () => d.layer()?.region;
  const place = (r: Region | null, g: string) => d.edit({ region: r }, g);
  box.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    const mode = b.dataset.mode as '' | Region['mode'], r = region();
    if (!mode) { if (r) { d.memory.set(d.memoryKey(), r); place(null, group('place')); } return; }
    if (r?.mode === mode) return;
    const base: Region = r ?? d.memory.get(d.memoryKey()) ?? defaultRegion(d.widget);
    const next: Region = { ...base, mode };
    if (mode === 'spot') { delete next.blend; delete next.fit; } else if (!next.fit) next.fit = 'contain';
    place(next, group('place'));
  }));
  shape.addEventListener('change', () => { const r = region(); if (r) place({ ...r, shape: shape.value as Region['shape'] }, group('place')); });
  let featherStep = group('feather');
  feather.addEventListener('input', () => { const r = region(); if (r) place({ ...r, feather: Number(feather.value) }, featherStep); featherOut.textContent = softWord(Number(feather.value)); });
  feather.addEventListener('change', () => { featherStep = group('feather'); });
  fit.addEventListener('change', () => { const r = region(); if (r) place({ ...r, fit: fit.value as Region['fit'] }, group('place')); });
  blend.addEventListener('change', () => {
    const r = region(); if (!r) return;
    const next: Region = { ...r };
    if (blend.checked) next.blend = 'lighten'; else delete next.blend;
    place(next, group('place'));
  });
  $<HTMLButtonElement>('[data-reset]').addEventListener('click', () => place(defaultRegion(d.widget), group('place')));

  // Intensity
  const num = (q: string, lo: number, hi: number, dflt: number) => { const v = Number($<HTMLInputElement>(q).value); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt; };
  above.addEventListener('input', () => { aboveOut.textContent = `${Math.round(Number(above.value) * 100)} %`; });
  box.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.p!;
    const choice: PresetChoice = k === 'fadeIn' ? { kind: 'fadeIn', seconds: num('[data-in]', 0.5, 60, 4) }
      : k === 'fadeOut' ? { kind: 'fadeOut', seconds: num('[data-out]', 0.5, 60, 4) }
      : k === 'swell' ? { kind: 'swell' }
      : k === 'pulse' ? { kind: 'pulse', every: Math.round(num('[data-every]', 1, 32, 1)), unit: $<HTMLSelectElement>('[data-unit]').value as 'beats' | 'bars' }
      : k === 'gate' ? { kind: 'gate', above: Number(above.value) } : { kind: 'plays' };
    const p = presetPivots(L, choice, d.span(), d.pack, listenOf(d.layer() ?? { widget: d.widget }), d.picks());
    d.edit({ intensity: p.length ? p : null }, group('preset'));
  }));
  $<HTMLButtonElement>('[data-clear]').addEventListener('click', () => d.edit({ intensity: null }, group('preset')));
  $<HTMLButtonElement>('[data-edit-picks]').addEventListener('click', () => { const id = picksId(d.layer()?.listen); if (id) d.editPicks(id); });

  const sync = () => {
    const l = d.layer(); if (!l) return;
    const listen = listenOf(l), r = l.region, span = d.span();
    const set = picksId(listen);
    if (set === null) fillSelect(listen ?? 'all');   // also when focused: an undo right after a choice
    $<HTMLElement>('.lc-listen').hidden = set !== null;
    $<HTMLElement>('.lc-picks').hidden = set === null;
    if (set !== null) $<HTMLElement>('.lc-picks span').textContent = impulseWords(d.picks()?.[set]?.notes ?? []);
    drawSpark(listen, span);
    box.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.mode || undefined) === r?.mode)));
    $<HTMLElement>('.lc-say').textContent = !r ? 'Seen across the whole picture, as in the lab.'
      : r.mode === 'spot' ? 'A mask: the full-size widget, seen only through the shape. Drag its handles on the stage to place it.'
      : 'A small copy of the whole widget, playing inside the box. Drag the box on the stage to move it, its handles to size it.';
    $<HTMLElement>('.lc-region').hidden = !r;
    box.querySelectorAll<HTMLElement>('.lc-win').forEach((x) => { x.hidden = r?.mode !== 'window'; });
    if (r) {
      shape.value = r.shape;
      const f = r.feather ?? 0.25;
      feather.value = String(f);
      featherOut.textContent = softWord(f);
      fit.value = r.fit ?? 'cover';
      blend.checked = r.blend === 'lighten';
    }
    const n = l.intensity?.length ?? 0;
    $<HTMLElement>('.lc-curve span').textContent = n ? `Follows a curve of ${n} point${n === 1 ? '' : 's'}: shape it in the lane under the timeline.` : 'Always at full strength.';
    $<HTMLButtonElement>('[data-clear]').hidden = !n;
    const plays = $<HTMLElement>('.lc-plays');
    plays.hidden = !listen;
    $<HTMLElement>('[data-part]').textContent = listen ? listenLabel(listen) : '';
    aboveOut.textContent = `${Math.round(Number(above.value) * 100)} %`;
  };
  sync();
  return { sync };
}

const softWord = (f: number): string => (f <= 0.02 ? 'sharp' : f < 0.2 ? 'crisp' : f < 0.45 ? 'soft' : f < 0.75 ? 'very soft' : 'misty');
