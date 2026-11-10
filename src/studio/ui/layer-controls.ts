/**
 * The open layer's controls under its knobs: which part it listens to (with a picture of where that part plays) and where
 * on the screen it draws (whole, spotlight or window). Every change is one setClip edit, one undo step.
 */
import './layer-controls.css';
import { NOTE_TYPES, NOTE_TYPE_LABELS } from '../../widgets/tags';
import type { NoteType } from '../../widgets/types';
import { TRACKS, TRACK_IDS } from '../pack/instruments';
import type { SongPack } from '../pack/pack';
import { heardSets } from '../show/note-values';
import { FAMILIES, LINES, listenOf, picksId, type Layer, type Show } from '../show/show';
import type { Span, WaLayers } from '../../widgets/layers';
import type { Family, Line, Listen, Region, TrackId } from '../../widgets/types';
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
    note counts); 'Families': a family with two tracks or more; 'From the notes': the six derived lines; 'Kinds of note': the note
    types, on every song (a song with none of a type says so under the list). */
export function listenOptions(pack: Pick<SongPack, 'tracks'>): ListenOption[] {
  const ids = presentTracks(pack);
  const out: ListenOption[] = [{ group: '', value: 'all', label: 'All notes' }];
  for (const id of ids) out.push({ group: 'In this recording', value: id, label: `${pack.tracks![id]!.label || TRACKS[id].label} (${pack.tracks![id]!.notes.length} notes)` });
  for (const f of FAMILIES) if (ids.filter((id) => TRACKS[id].family === f).length >= 2) out.push({ group: 'Families', value: `family:${f}`, label: FAMILY_LABELS[f] });
  for (const l of LINES) out.push({ group: 'From the notes', value: l, label: LINE_LABELS[l] });
  for (const t of NOTE_TYPES) out.push({ group: 'Kinds of note', value: t, label: NOTE_TYPE_LABELS[t] });
  return out;
}

/** A part's name in words, whether or not this song has it. */
export function listenLabel(l: Listen): string {
  if (l === 'all') return 'All notes';
  if (picksId(l) !== null) return 'Your picks';
  if (l in LINE_LABELS) return LINE_LABELS[l as Line];
  if (l in NOTE_TYPE_LABELS) return NOTE_TYPE_LABELS[l as NoteType];
  if (l.startsWith('family:')) return FAMILY_LABELS[l.slice(7) as Family] ?? l;
  return TRACKS[l as TrackId]?.label ?? l;
}

/** The same in running text: lower case, but "French horns" keeps its capital. */
export const partWords = (l: Listen): string => listenLabel(l).toLowerCase().replace(/\bfrench\b/g, 'French');

const isNoteType = (l: Listen | undefined): l is NoteType => (NOTE_TYPES as readonly (string | undefined)[]).includes(l);

/** When the attacks of a part start in a section, in order (the layer's own attacks: its notes grouped among themselves). */
export function attackTimes(L: WaLayers, pack: Pick<SongPack, 'notes' | 'tracks'>, listen: Listen, s: Span): number[] {
  const { notes } = L.listenNotes({ notes: pack.notes, tracks: pack.tracks }, listen);
  return L.groupChords(notes.filter((n) => n[0] >= s.start && n[0] < s.end)).map((c) => c.t);
}

/** The attacks a section must hold for a widget to take its usual note type when placed: 3, and one per 10 s on average. */
export const neededAttacks = (s: Span): number => Math.max(3, Math.ceil((s.end - s.start) / 10));

/** How far from an attack, in seconds, a layer still counts as playing; and how much of a section must be that near. */
const NEAR = 5, NEAR_SHARE = 0.5;

/** The share of a section within 5 s of one of these attacks (given in order). These types come in clusters, so a
    count alone would pass one burst in a long section. */
export function nearShare(times: readonly number[], s: Span): number {
  let covered = 0, reached = s.start;
  for (const t of times) {
    const to = Math.min(s.end, t + NEAR);
    if (to > reached) { covered += to - Math.max(reached, t - NEAR); reached = to; }
  }
  return covered / Math.max(1e-6, s.end - s.start);
}

/** Enough to take a usual type when placed: the count, and spread, so a layer doesn't sit still for most of its section by default. */
export const enoughAttacks = (times: readonly number[], s: Span): boolean => times.length >= neededAttacks(s) && nearShare(times, s) >= NEAR_SHARE;

/** What a widget hears when placed in this span: its usual note type if the span has enough of it, else nothing
    (all notes). */
export function placedListen(L: WaLayers, pack: Pick<SongPack, 'notes' | 'tracks'>, s: Span, usual: NoteType | undefined): NoteType | undefined {
  return usual && enoughAttacks(attackTimes(L, pack, usual, s), s) ? usual : undefined;
}

export interface UsualLine { text: string; action: 'all' | 'use' | null }

/** The line under "Listens to" for a widget with a usual note type: what it hears against what it usually hears, and
    the one click that changes that ('all': back to all notes; 'use': its usual type). */
export function usualLine(usual: NoteType, listen: Listen | undefined, times: readonly number[], s: Span): UsualLine {
  const words = NOTE_TYPE_LABELS[usual].toLowerCase(), attacks = times.length;
  if (picksId(listen) !== null) return { text: `This widget usually hears ${words}; here it hears your picks.`, action: null };   // hand-picked: no one click takes it off them
  if (listen === usual) {
    const far = attacks > 0 && nearShare(times, s) < NEAR_SHARE;
    return { text: `Hears ${words}, as this widget usually does${far ? ', but most of this clip is far from any: it stays still there' : ''}.`, action: 'all' };
  }
  if (!attacks) return { text: `This widget usually hears ${words}, but this clip has none${listen === undefined ? ': it plays on all notes' : ''}.`, action: null };
  if (listen !== undefined || enoughAttacks(times, s)) return { text: `This widget usually hears ${words}.`, action: 'use' };
  if (attacks < neededAttacks(s)) return { text: `This widget usually hears ${words}, but this clip has only ${attacks}: it plays on all notes.`, action: 'use' };
  return { text: `This widget usually hears ${words}, but most of this clip is far from any: it plays on all notes.`, action: 'use' };
}

/** The note under "Listens to". notes: the part's in the whole song; here: those sounding in the section; starts: those
    starting in it, the count validateShow warns on (a note ringing in from earlier is heard, but is no attack here). */
export function partNote(listen: Listen | undefined, fellBack: boolean, notes: number, here: number, starts: number): { text: string; warn: boolean } {
  const type = isNoteType(listen);
  if (listen && fellBack) return { text: `This song has no ${partWords(listen)}: the layer plays on all notes.`, warn: true };
  if (type && !notes) return { text: `This song has no ${partWords(listen!)}: the layer stays still.`, warn: true };
  if (!here) return { text: 'Silent in this clip: it stays still.', warn: type };
  if (type && !starts) return { text: `This clip has no ${partWords(listen!)} of its own, only ${here} ringing on from before: it barely moves.`, warn: true };
  return { text: `${here} note${here === 1 ? '' : 's'} in this clip${listen ? '; it moves with these only' : ''}.`, warn: false };
}

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

// ---- The DOM ----------------------------------------------------------------------------------------------------

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export type LayerPatch = { listen?: Listen | null; region?: Region | null };


export interface LayerControlsDeps {
  layers: WaLayers;
  pack: Pick<SongPack, 'notes' | 'tracks' | 'beats' | 'loudness'>;
  widget: string; hue: number;
  /** The note type this widget usually hears (lab/tags.json). */
  usual?: NoteType;
  /** The widget has the how present slider, so its curve can set how much it makes. */
  /** The clip's span now (a drag changes it without a redraw). */
  span(): Span;
  /** The layer now (undo changes it without a redraw). */
  layer(): Layer | undefined;
  /** One setClip edit; group: the undo step it belongs to. Returns whether the show changed. */
  edit(patch: LayerPatch, group: string): boolean;
  /** The place a layer had before it went back to the whole screen (so Spotlight/Window bring it back), under the
      key memoryKey() gives for this layer now (its clip, so it never goes to another). */
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
      <p class="lc-usual small" hidden><span></span> <button type="button" class="link" data-usual></button></p>
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
        <label class="lc-row lc-win"><span>Background</span><select data-blend aria-label="What happens to the widget's black background">
          <option value="clear">See-through</option><option value="over">Keep its black</option><option value="lighten">Let the brighter show</option></select></label>
        <button type="button" class="link" data-reset>Reset place</button>
      </div>
      ${reader ? '<p class="lc-hint small">This widget cuts into the picture below it: as a small copy it cuts only its own picture.</p>' : ''}
    </section>
`;

  const $ = <T extends Element>(q: string) => box.querySelector<T>(q)!;
  const sel = $<HTMLSelectElement>('.lc-listen select'), spark = $<HTMLCanvasElement>('.lc-spark'), note = $<HTMLElement>('.lc-note');
  const shape = $<HTMLSelectElement>('[data-shape]'), feather = $<HTMLInputElement>('[data-feather]'), featherOut = $<HTMLOutputElement>('[data-feather-out]');
  const fit = $<HTMLSelectElement>('[data-fit]'), blend = $<HTMLSelectElement>('[data-blend]');

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
    const { notes, heard } = L.listenNotes({ notes: d.pack.notes, tracks: d.pack.tracks, picks: heardSets(d.picks()) }, listen);
    const dpr = window.devicePixelRatio || 1;
    spark.width = Math.round(SPARK_W * dpr); spark.height = Math.round(SPARK_H * dpr);
    const g = spark.getContext('2d')!, len = Math.max(1e-6, span.end - span.start);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, SPARK_W, SPARK_H);
    const cols = new Array<number>(SPARK_W).fill(0);
    let here = 0, starts = 0;
    for (const n of notes) {
      if (n[1] <= span.start || n[0] >= span.end) continue;
      here++;
      if (n[0] >= span.start) starts++;
      const a = Math.max(0, Math.floor(((n[0] - span.start) / len) * SPARK_W)), b = Math.min(SPARK_W - 1, Math.floor(((Math.min(n[1], span.end) - span.start) / len) * SPARK_W));
      for (let x = a; x <= b; x++) cols[x]++;
    }
    const top = Math.max(3, ...cols);
    g.fillStyle = `hsl(${d.hue} 46% 62%)`;
    for (let x = 0; x < SPARK_W; x++) if (cols[x]) { const h = Math.max(2, Math.round((Math.sqrt(cols[x] / top)) * SPARK_H)); g.fillRect(x, SPARK_H - h, 1, h); }
    g.fillStyle = '#ffffff22'; g.fillRect(0, SPARK_H - 1, SPARK_W, 1);
    spark.title = `${here} notes in this clip`;
    const said = partNote(listen, heard === 'all', notes.length, here, starts);
    note.textContent = said.text;
    note.classList.toggle('warn', said.warn);
  };

  // Listens to
  const hear = (want: Listen) => {
    d.edit({ listen: want === 'all' ? null : want }, group('listen'));
  };
  sel.addEventListener('change', () => hear(sel.value));
  const usualBtn = $<HTMLButtonElement>('[data-usual]');
  usualBtn.addEventListener('click', () => hear(usualBtn.dataset.usual === 'all' ? 'all' : d.usual!));
  let usualKey = '';
  const drawUsual = (listen: Listen | undefined, span: Span) => {
    const key = JSON.stringify([listen ?? 'all', span.start, span.end]);
    if (!d.usual || key === usualKey) return;
    usualKey = key;
    const u = usualLine(d.usual, listen, attackTimes(L, d.pack, d.usual, span), span);
    $<HTMLElement>('.lc-usual').hidden = false;
    $<HTMLElement>('.lc-usual span').textContent = u.text;
    usualBtn.hidden = !u.action;
    usualBtn.dataset.usual = u.action ?? '';
    usualBtn.textContent = u.action === 'all' ? 'All notes instead' : 'Use them';
  };

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
    if (blend.value === 'clear') delete next.blend; else next.blend = blend.value as Region['blend'];
    place(next, group('place'));
  });
  $<HTMLButtonElement>('[data-reset]').addEventListener('click', () => place(defaultRegion(d.widget), group('place')));

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
    drawUsual(listen, span);
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
      blend.value = r.blend ?? 'clear';
    }
  };
  sync();
  return { sync };
}

const softWord = (f: number): string => (f <= 0.02 ? 'sharp' : f < 0.2 ? 'crisp' : f < 0.45 ? 'soft' : f < 0.75 ? 'very soft' : 'misty');
