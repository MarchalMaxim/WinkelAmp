/**
 * The studio (the main page): a song from the library, its show of lab widgets playing on the shared canvas, the
 * timeline and the side panel to reshape it, undo, save. The widgets run through the same runtime as the render page,
 * so what plays here is what the lab draws.
 */
import './style.css';
import { composeShow } from '../compose/compose';
import { isChecking } from '../ingest/ears-client';
import type { SongPack } from '../pack/pack';
import { Conductor } from '../show/conductor';
import { sectionAt } from '../show/schedule';
import { canonicalShow, repairShow, validateShow, type Show } from '../show/show';
import { toMeta } from '../../widgets/catalogue';
import { groupChords } from '../../widgets/chords';
import { instantiate } from '../../widgets/instantiate';
import { makeIcon } from '../../widgets/lab-harness';
import { studioLayers } from '../../widgets/layers-source';
import { WidgetRuntime } from '../../widgets/runtime';
import { labHarness, labTags, labTagWords, labWidgetSources } from '../../widgets/sources';
import { tagsOf } from '../../widgets/tags';
import type { WidgetMeta } from '../../widgets/types';
import { SongAdder, takeFlash } from './add-song';
import { ApiError, connectStore, type LibraryEntry, type ShowStore } from './api';
import { installKeys } from './keys';
import { Library, splitTitle } from './library';
import { Panel, type CatalogueEntry } from './panel';
import { Picker } from './picker';
import { Player } from './player';
import { installExport } from './record';
import { mountRegionOverlay } from './region-overlay';
import { isDirty, Store, type Notice } from './store';
import { clock, Timeline } from './timeline';

const LAST_SONG = 'wa-studio.last-song';
const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* private window */ } };
const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  hide: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 15h17" stroke="currentColor" stroke-width="1.6"/></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4.5 11.5 9 16M5 11.5h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  redo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7l4.5 4.5L15 16M19 11.5h-9a5 5 0 0 0 0 10h2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  songs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.6"/></svg>',
};

/** The page's frame: everything but the song's own content. */
function shell(): Record<string, HTMLElement> {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <header class="top">
      <button type="button" class="songs-btn" data-songs aria-label="Songs">${ICONS.songs}<span>Songs</span></button>
      <div class="title"><span class="composer"></span><h1 class="piece">Studio</h1></div>
      <div class="save">
        <span class="save-state" aria-live="polite"></span>
        <button type="button" class="icon" data-undo aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled>${ICONS.undo}</button>
        <button type="button" class="icon" data-redo aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled>${ICONS.redo}</button>
        <button type="button" class="primary" data-save title="Save the show (Ctrl+S)" disabled><span class="long">Save show</span><span class="short">Save</span></button>
      </div>
    </header>
    <main class="work">
      <div class="stage" data-stage>
        <canvas id="c" width="1280" height="720" aria-label="The show"></canvas>
        <div class="poster" data-poster hidden></div>
        <button type="button" class="unhide" data-unhide hidden>Show the controls<span class="key-hint"> (H)</span></button>
      </div>
      <div class="transport">
        <button type="button" class="play" data-play aria-label="Play (Space)" disabled>${ICONS.play}</button>
        <span class="clock" data-clock>0:00 <span class="dim">/ 0:00</span></span>
        <span class="now" data-now></span>
        <span class="spacer"></span>
        <button type="button" data-pick title="Mark the melody and connect a few of its notes to a widget">Pick notes</button>
        <button type="button" class="icon" data-hide aria-label="Hide the controls (H)" title="Hide the controls (H)">${ICONS.hide}</button>
        <button type="button" class="icon" data-full aria-label="Full screen (F)" title="Full screen (F)">${ICONS.full}</button>
      </div>
      <div class="notices" aria-live="polite"></div>
      <div class="timeline-host"></div>
    </main>
    <div class="panel-host"></div>`;
  const q = (s: string) => app.querySelector<HTMLElement>(s)!;
  return {
    app, stage: q('[data-stage]'), poster: q('[data-poster]'), unhide: q('[data-unhide]'), play: q('[data-play]'), clock: q('[data-clock]'),
    now: q('[data-now]'), pick: q('[data-pick]'), hide: q('[data-hide]'), full: q('[data-full]'), notices: q('.notices'), timeline: q('.timeline-host'),
    panel: q('.panel-host'), songs: q('[data-songs]'), undo: q('[data-undo]'), redo: q('[data-redo]'), save: q('[data-save]'),
    saveState: q('.save-state'), composer: q('.composer'), piece: q('.piece'),
  };
}

function renderNotices(box: HTMLElement, notices: Notice[], store: Store, actions: Record<string, { label: string; run(): void }>): void {
  box.innerHTML = '';
  for (const n of notices) {
    const div = document.createElement('div');
    div.className = `notice ${n.level}`;
    div.innerHTML = `<span class="notice-text"></span>`;
    div.querySelector('.notice-text')!.textContent = n.text;
    const act = actions[n.id];
    if (act) {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: act.label });
      b.addEventListener('click', () => { act.run(); store.dispatch({ type: 'dismiss', id: n.id }); });
      div.append(b);
    }
    const x = Object.assign(document.createElement('button'), { type: 'button', className: 'icon', textContent: '✕' });
    x.setAttribute('aria-label', 'Dismiss');
    x.addEventListener('click', () => store.dispatch({ type: 'dismiss', id: n.id }));
    div.append(x);
    box.append(div);
  }
}

function emptyState(ui: Record<string, HTMLElement>, api: ShowStore, choose: () => void, problem?: string): void {
  ui.poster.hidden = false;
  ui.poster.classList.add('empty');
  ui.poster.innerHTML = `<div class="poster-inner">
      <p class="composer">WinkelAmp studio</p>
      <h2>Bring a recording</h2>
      <p>${problem ? esc(problem) : api.writable
        ? 'Drop a recording anywhere on this page. With <code>npm run ears</code> running its notes are transcribed on your GPU; without it, this browser makes approximate ones. It opens with a show composed for it.'
        : 'Drop a recording anywhere on this page: this browser analyses it (approximate notes, no transcription) and it opens with a show composed for it.'}</p>
      <p><button type="button" class="primary" data-choose>Choose a recording…</button></p>
      <p class="links">${api.writable ? '<a href="lab/index.html">Open the widget lab</a> ' : ''}<a href="legacy.html">Old app: microphone, MIDI</a></p>
    </div>`;
  ui.poster.querySelector('[data-choose]')!.addEventListener('click', choose);
  ui.piece.textContent = 'Studio';
}

async function boot(): Promise<void> {
  const ui = shell();
  const store = new Store({ curve: (p, t) => studioLayers().automationAt(p, t) });   // edge pivots keep a curve on a boundary drag
  const api = await connectStore();
  const params = new URLSearchParams(location.search);

  let songs: LibraryEntry[] = [];
  try { songs = await api.songs(); } catch (e) { store.dispatch({ type: 'notice', notice: { id: 'songs', level: 'error', text: `Could not list the songs: ${(e as Error).message}` } }); }
  store.state.library = songs;
  const want = params.get('song') ?? lsGet(LAST_SONG);
  const entry = songs.find((s) => s.id === want && !s.error) ?? songs.find((s) => !s.error) ?? null;
  const library = new Library(entry?.id ?? null, api.writable, (f) => void adder.add(f));
  library.render(songs);
  document.body.append(library.el);
  ui.songs.addEventListener('click', () => library.toggle());
  const noticeActions: Record<string, { label: string; run(): void }> = {};
  store.subscribe((s) => renderNotices(ui.notices, s.notices, store, noticeActions));
  // A recording dropped on the page (or chosen in the library) becomes a song: through npm run ears, else in this browser.
  const adder = new SongAdder({
    api, library, current: entry?.id ?? null, dirty: () => isDirty(store.state),
    notify: (notice, action) => {
      if (action) noticeActions[notice.id] = action; else delete noticeActions[notice.id];
      store.dispatch({ type: 'notice', notice });
    },
    dismiss: (id) => store.dispatch({ type: 'dismiss', id }),
  });
  library.onOpen = () => void adder.earsSettled();

  if (!entry) { emptyState(ui, api, () => library.choose()); document.body.classList.add('no-song'); return; }
  for (const n of takeFlash(entry.id)) store.dispatch({ type: 'notice', notice: n });
  if (params.get('song') && params.get('song') !== entry.id) {
    store.dispatch({ type: 'notice', notice: { id: 'missing-song', level: 'warn', text: `There is no playable song '${params.get('song')}': here is ${entry.title}.` } });
  }
  lsSet(LAST_SONG, entry.id);

  let pack: SongPack;
  try { pack = await api.pack(entry.id); } catch (e) { emptyState(ui, api, () => library.choose(), `Could not open ${entry.title}: ${(e as Error).message}`); return; }
  const [composer, piece] = splitTitle(pack.title);
  ui.composer.textContent = composer; ui.piece.textContent = piece;
  document.title = `${piece} · WinkelAmp studio`;

  // The song's notes, before any widget file runs: several read window.NOTES when they load.
  (window as { NOTES?: unknown }).NOTES = pack.notes;
  const harness = labHarness(), sources = labWidgetSources(), icon = makeIcon(harness.iconSource);
  const chords = groupChords(pack.notes);
  const order = [...harness.toolIds.filter((id) => id in sources), ...Object.keys(sources).filter((id) => !harness.toolIds.includes(id)).sort()];
  // One template instance per widget (never drawn) gives the names, knobs, pictures and, with the verdicts, the collection.
  const catalogue = new Map<string, CatalogueEntry>(), metas = new Map<string, WidgetMeta>(), failed: string[] = [];
  for (const id of order) {
    try {
      const tool = instantiate(id, sources[id], { icon, chords });
      const meta = toMeta(tool, harness.verdicts[id] ?? null, tagsOf(labTags(), id));
      catalogue.set(id, { meta, tool }); metas.set(id, meta);
    } catch (e) { failed.push(`${id} (${(e as Error).message})`); }
  }
  if (failed.length) store.dispatch({ type: 'notice', notice: { id: 'widgets', level: 'warn', text: `Some widgets did not load: ${failed.join('; ')}.` } });

  // The show: the saved one, repaired if it must be, or one composed for the song now, from the widgets' tags, the
  // instruments the song has and the feel words of its description (if one was written).
  const ctxShow = { duration: pack.duration, widgets: metas, tracks: Object.keys(pack.tracks ?? {}) };
  const compose = async () => composeShow({ pack, widgets: metas, at: new Date().toISOString(),
    description: await api.description(pack.id).catch(() => ''), layers: studioLayers(), words: labTagWords() });
  let show: Show, origin: 'file' | 'auto' | 'repaired' = 'file';
  let saved: Show | null = null;
  // Only a song with a show of its own asks for it: a 404 for the others would be a red line in every console.
  try { saved = entry.hasShow ? await api.show(pack.id) : null; } catch (e) {
    store.dispatch({ type: 'notice', notice: { id: 'show-read', level: 'error', text: `Could not read the saved show: ${(e as Error).message}. Playing a composed one.` } });
  }
  if (!saved) { show = await compose(); origin = 'auto'; }
  else {
    const { errors } = validateShow(saved, ctxShow);
    if (!errors.length) show = saved;
    else {
      try {
        const r = repairShow(saved, ctxShow);
        if (validateShow(r.show, ctxShow).errors.length) throw new Error(errors[0].message);
        show = r.show; origin = 'repaired';
        store.dispatch({ type: 'notice', notice: { id: 'repaired', level: 'warn',
          text: `The saved show had ${errors.length} problem${errors.length > 1 ? 's' : ''} (${errors[0].path}: ${errors[0].message}). It was repaired here; save to keep the repair.` } });
      } catch (e) {
        show = await compose(); origin = 'auto';
        store.dispatch({ type: 'notice', notice: { id: 'repaired', level: 'error', text: `The saved show could not be repaired (${(e as Error).message}): playing a composed one instead.` } });
      }
    }
  }
  if (pack.notesFrom === 'merged') {
    store.dispatch({ type: 'notice', notice: { id: 'notes', level: 'info', text: 'The piano model heard little of this recording: approximate notes fill the rest.' } });
  } else if (pack.notesFrom === 'approx') {
    const approx = 'This song has approximate notes from the analysis, not a transcription: the widgets follow it less closely.';
    store.dispatch({ type: 'notice', notice: { id: 'notes', level: 'warn', text: api.writable ? `${approx} Start npm run ears to transcribe it.` : approx } });
    // With the ears server up, offer the transcription; with its transcriber unable to run, say why.
    // Right after npm run ears starts it is still checking its transcriber: say so, and decide once it has a verdict.
    if (api.writable) void adder.earsSettled(() => store.dispatch({ type: 'notice', notice: { id: 'notes', level: 'warn',
      text: `${approx} The ears server is checking its transcriber…` } })).then((e) => {
      if (!e.up) return;
      if (isChecking(e.transcriber)) { store.dispatch({ type: 'notice', notice: { id: 'notes', level: 'warn', text: approx } }); return; }
      if (!e.transcriber.ok) {
        store.dispatch({ type: 'notice', notice: { id: 'notes', level: 'warn', text: approx } });
        store.dispatch({ type: 'notice', notice: { id: 'transcriber', level: 'warn', text: `Transcriber unavailable: ${e.transcriber.reason ?? 'unknown'}.` } });
        return;
      }
      noticeActions['notes'] = { label: 'Re-ingest with the transcriber', run: () => void adder.reingest(pack.id, pack.title) };
      store.dispatch({ type: 'notice', notice: { id: 'notes', level: 'warn', text: approx } });
    });
  }
  if (pack.quality.warnings.some((w) => /^no notes found/.test(w))) {
    store.dispatch({ type: 'notice', notice: { id: 'silent', level: 'warn', text: 'No notes were found in this recording: is it silent? The picture stays dark without attacks.' } });
  }

  // The picture and the clock.
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const runtime = new WidgetRuntime(canvas, { notes: pack.notes, tracks: pack.tracks }, { sources, harness, layers: studioLayers() });
  const conductor = new Conductor(runtime, show, (id) => metas.get(id) ?? (runtime.tool(id) ? toMeta(runtime.tool(id)!, null) : undefined));
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = api.audioUrl(pack);
  const player = new Player(canvas, audio, conductor, runtime);
  store.dispatch({ type: 'loaded', song: pack, show, origin });
  runtime.reset(0);
  // A seek (the timeline, the keys, a section's start) shows the picture there, also before the first play: the
  // poster would hide the preview the seek draws, and every edit's refresh after it.
  const seek = (t: number) => { ui.poster.hidden = true; player.seek(t); };

  const timeline = new Timeline({
    store, song: pack, chords, duration: () => player.duration || pack.duration, seek,
    refresh: () => player.refresh(), names: (id) => metas.get(id)?.name ?? id,
  });
  ui.timeline.append(timeline.el);
  const splitAtPlayhead = () => {
    if (store.state.ui.recording) return;
    const s = store.state.show!, t = player.time, i = sectionAt(s, t);
    store.dispatch({ type: 'edit', edit: { kind: 'split', section: i, t } });
    if (store.state.show === s) store.dispatch({ type: 'notice', notice: { id: 'split', level: 'info', text: 'Too close to where the section starts or ends to split: sections last at least a second.' } });
    else store.dispatch({ type: 'select', section: i + 1, layer: null });
  };
  const picker = new Picker({
    store, player, api, pack, canvas, catalogue, order, lib: { sources, harness, layers: studioLayers() },
    meta: (id) => metas.get(id), notify: (notice) => store.dispatch({ type: 'notice', notice }),
  });
  // Its seeks show the picture there, as the studio's do: the poster would hide it on the way back.
  const openPicker = (set?: string) => { ui.poster.hidden = true; void picker.open(set); };
  ui.pick.addEventListener('click', () => openPicker());
  const panel = new Panel({
    store, api, song: pack, catalogue, order, drives: harness.drives, icon,
    time: () => player.time, features: () => runtime.ctx.feat, errors: () => runtime.errors, splitAtPlayhead, seek, editPicks: openPicker,
    redoTranscription: () => void adder.redo(pack),
  });
  ui.panel.append(panel.el);
  // The open layer's region, placed with handles on the stage (an SVG over the canvas, never drawn into it).
  const overlay = mountRegionOverlay(ui.stage, canvas, store);

  // Poster: the piece's name on black until the music starts.
  ui.poster.hidden = false;
  ui.poster.innerHTML = `<button type="button" class="poster-inner" data-start>
      ${composer ? `<span class="composer">${esc(composer)}</span>` : ''}<span class="poster-title">${esc(piece)}</span>
      <span class="poster-play">${ICONS.play}<span>Play</span></span><span class="dim small">${clock(pack.duration)}, ${show.sections.length} sections</span></button>`;
  ui.poster.querySelector('[data-start]')!.addEventListener('click', () => player.toggle());

  // Repaint a paused picture after edits, at most every 150 ms.
  let refreshTimer = 0, refreshAt = 0;
  const refreshSoon = () => {
    if (player.playing || refreshTimer) return;
    const wait = Math.max(0, 150 - (performance.now() - refreshAt));
    refreshTimer = window.setTimeout(() => { refreshTimer = 0; refreshAt = performance.now(); if (!ui.poster.hidden) return; player.refresh(); }, wait);
  };

  let shown: Show | null = null, lastSecond = -1, lastNow = -1;
  const drawHeader = () => {
    const s = store.state, dirty = isDirty(s);
    ui.saveState.textContent = !api.writable ? (dirty ? 'Unsaved changes; Save downloads the show' : 'Save downloads the show')
      : dirty ? 'Unsaved changes' : s.origin === 'auto' ? 'Composed for this song, not saved yet' : 'Saved';
    ui.saveState.classList.toggle('dirty', dirty);
    (ui.undo as HTMLButtonElement).disabled = !store.history.canUndo || s.ui.recording;
    (ui.redo as HTMLButtonElement).disabled = !store.history.canRedo || s.ui.recording;
    (ui.save as HTMLButtonElement).disabled = !(dirty || s.origin !== 'file');
  };
  const drawNow = (t: number) => {
    const s = store.state.show!, i = sectionAt(s, t);
    if (i === lastNow) return;
    lastNow = i;
    ui.now.textContent = s.sections[i].label ?? `Section ${i + 1}`;
    panel.where();
  };
  store.subscribe((s) => {
    if (s.show && s.show !== shown) { shown = s.show; conductor.setShow(s.show); refreshSoon(); lastNow = -1; drawNow(player.time); }
    timeline.update(s); panel.update(s); overlay.update(s); drawHeader();
    (ui.pick as HTMLButtonElement).disabled = s.ui.recording;
    document.body.classList.toggle('ui-hidden', s.ui.hidden);
  });
  store.notify();

  // A widget that throws is stopped by the runtime (its first error kept): say so once, and show it on its layer.
  const reported = new Set<string>();
  const reportWidgetErrors = () => {
    for (const id in runtime.errors) {
      if (reported.has(id)) continue;
      reported.add(id);
      panel.widgetFailed();
      store.dispatch({ type: 'notice', notice: { id: `widget:${id}`, level: 'error', text: `${metas.get(id.split('@')[0])?.name ?? id} stopped: ${runtime.errors[id].replace(/^Error: /, '')}` } });
    }
  };

  player.onTick = (t) => {
    reportWidgetErrors();
    timeline.setTime(t);
    const sec = Math.floor(t);
    if (sec !== lastSecond) { lastSecond = sec; ui.clock.innerHTML = `${clock(t)} <span class="dim">/ ${clock(player.duration || pack.duration)}</span>`; }
    drawNow(t);
    if (player.playing) panel.tick(performance.now());
  };
  const playState = () => {
    const on = player.playing;
    store.state.playing = on;
    ui.play.innerHTML = on ? ICONS.pause : ICONS.play;
    ui.play.setAttribute('aria-label', on ? 'Pause (Space)' : 'Play (Space)');
    if (on) ui.poster.hidden = true;
  };
  audio.addEventListener('play', playState); audio.addEventListener('pause', playState); audio.addEventListener('ended', playState);
  audio.addEventListener('loadedmetadata', () => { (ui.play as HTMLButtonElement).disabled = false; store.notify(); player.onTick?.(player.time); });
  audio.addEventListener('error', () => store.dispatch({ type: 'notice', notice: { id: 'audio', level: 'error', text: `The recording did not load (${api.audioUrl(pack)}).` } }));
  ui.play.addEventListener('click', () => player.toggle());

  // Export: record the show to an MP4 here (the song plays through once), or the command for a frame-exact one.
  const recorder = installExport({
    store, player, canvas, host: ui.play.parentElement!, before: ui.hide,
    renderCommand: api.writable ? `npm run render-show -- ${pack.id}` : null,
    notify: (level, text) => store.dispatch({ type: 'notice', notice: { id: 'record', level, text } }),
  });

  // Save.
  const save = async () => {
    const s = store.state.show;
    if (!s) return;
    try {
      await api.saveShow(s);
      store.dispatch({ type: 'saved' });
      store.dispatch({ type: 'dismiss', id: 'repaired' });
      store.dispatch({ type: 'notice', notice: { id: 'saved', level: 'info', text: api.writable ? `Saved to shows/${s.id}.json.` : `Downloaded ${s.id}.json (and kept a draft in this browser).` } });
      setTimeout(() => store.dispatch({ type: 'dismiss', id: 'saved' }), 3000);
    } catch (e) {
      const errs = e instanceof ApiError && e.errors.length ? e.errors.slice(0, 3).map((x) => `${x.path ? `${x.path}: ` : ''}${x.message}`).join('; ') : (e as Error).message;
      store.dispatch({ type: 'notice', notice: { id: 'saved', level: 'error', text: `The show was not saved: ${errs}` } });
    }
  };
  ui.save.addEventListener('click', () => void save());
  ui.undo.addEventListener('click', () => store.dispatch({ type: 'undo' }));
  ui.redo.addEventListener('click', () => store.dispatch({ type: 'redo' }));
  window.addEventListener('beforeunload', (e) => { if (isDirty(store.state) || picker.marksAtRisk) { e.preventDefault(); e.returnValue = ''; } });

  // Full screen, hiding the controls, the cursor resting.
  const stage = ui.stage;
  const hideUi = (hidden = !store.state.ui.hidden) => {
    store.dispatch({ type: 'ui', patch: { hidden } });
    if (hidden) flashUnhide();
  };
  const fullscreen = () => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    if (stage.requestFullscreen) stage.requestFullscreen().catch(() => hideUi(true));
    else hideUi(true);   // iOS Safari: no element full screen
  };
  ui.full.addEventListener('click', fullscreen);
  ui.hide.addEventListener('click', () => hideUi(true));
  ui.unhide.addEventListener('click', () => hideUi(false));
  let idle = 0;
  const flashUnhide = () => {
    document.body.classList.remove('idle');
    ui.unhide.hidden = !store.state.ui.hidden;
    clearTimeout(idle);
    idle = window.setTimeout(() => { if (store.state.ui.hidden || document.fullscreenElement) { document.body.classList.add('idle'); ui.unhide.hidden = true; } }, 2000);
  };
  window.addEventListener('pointermove', flashUnhide);
  window.addEventListener('pointerdown', flashUnhide);
  document.addEventListener('fullscreenchange', flashUnhide);
  // With the controls away, a mouse click on the picture plays or pauses; a tap (phones) only brings the button back.
  stage.addEventListener('click', (e) => {
    if (e.target === canvas && (e as PointerEvent).pointerType === 'mouse' && (store.state.ui.hidden || document.fullscreenElement)) player.toggle();
  });
  // The phone layout's sticky tabs sit under the header, whatever its height.
  const top = ui.app.querySelector<HTMLElement>('.top')!;
  new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', `${top.offsetHeight}px`)).observe(top);

  installKeys({
    toggle: () => player.toggle(),
    nudge: (s) => seek(player.time + s),
    section: (dir) => {
      const s = store.state.show!, t = player.time, i = sectionAt(s, t);
      const j = dir < 0 ? (t - s.sections[i].start > 1.5 ? i : Math.max(0, i - 1)) : Math.min(s.sections.length - 1, i + 1);
      seek(s.sections[j].start);
      store.dispatch({ type: 'select', section: j, layer: null });
    },
    fullscreen, hideUi: () => hideUi(),
    split: splitAtPlayhead,
    removeLayer: () => { const { section, layer } = store.state.selected; if (layer !== null) store.dispatch({ type: 'edit', edit: { kind: 'removeLayer', section, layer } }); },
    undo: () => store.dispatch({ type: 'undo' }), redo: () => store.dispatch({ type: 'redo' }),
    save: () => void save(),
  });

  // Claude (or anyone) edits shows/<id>.json on disk: a clean show follows it; a dirty one asks.
  noticeActions['disk'] = { label: 'Load the version on disk', run: () => void reloadFromDisk(true) };
  const reloadFromDisk = async (force: boolean) => {
    const s = await api.show(pack.id).catch(() => null);
    if (!s) return;
    const text = canonicalShow(s);
    if (text === store.state.saved && !force) return;
    if (isDirty(store.state) && !force) {
      store.dispatch({ type: 'notice', notice: { id: 'disk', level: 'warn', text: 'The show changed on disk while you have unsaved changes here.' } });
      return;
    }
    const { errors } = validateShow(s, ctxShow);
    if (errors.length) { store.dispatch({ type: 'notice', notice: { id: 'disk', level: 'error', text: `The show on disk has errors (${errors[0].path}: ${errors[0].message}): not loaded.` } }); return; }
    const hadEdits = isDirty(store.state);
    store.dispatch({ type: 'loaded', song: pack, show: s, origin: 'file', keepUndo: true });   // what was here stays one undo away
    store.dispatch({ type: 'notice', notice: { id: 'disk-loaded', level: 'info', text: hadEdits
      ? 'This is the version on disk: undo (Ctrl+Z) brings your edits back.' : 'The show changed on disk: this is the new version.' } });
    setTimeout(() => store.dispatch({ type: 'dismiss', id: 'disk-loaded' }), hadEdits ? 10000 : 4000);
  };
  // The file watcher can miss a second write that follows the first within a second or so: look again a little later.
  import.meta.hot?.on('studio:show-changed', (d: { id: string }) => {
    if (d.id !== pack.id) return;
    void reloadFromDisk(false);
    setTimeout(() => void reloadFromDisk(false), 1500);
  });

  (window as { __studio?: unknown }).__studio = { runtime, store, player, conductor, catalogue, recorder, overlay, picker };
}

boot().catch((e) => {
  console.error(e);
  const app = document.getElementById('app');
  if (app) app.insertAdjacentHTML('beforeend', `<p class="fatal">The studio did not start: ${esc((e as Error).message ?? e)}</p>`);
});
