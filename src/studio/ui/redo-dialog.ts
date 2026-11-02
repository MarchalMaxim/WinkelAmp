/**
 * Choosing the transcriber when redoing a song: YourMT3+ (the default) or MuScriptor large with a required list, each with
 * the time it takes for this song, and the saved results that make it quick. A native <dialog>: Escape cancels, and the
 * studio's keys stay out of it (Space on a radio would play the song, `s` would split a section under the dialog).
 */
import { isChecking } from '../ingest/ears-client';
import type { ToolStatus, TranscribeChoices } from '../ingest/ears-types';
import { estimateWords, lanesOutside, msEstimate, SAVED_WORDS, savedFor, type RedoChoice } from '../ingest/transcribe-options';
import { MS_PRESETS, resolveInstruments, type MsPreset } from '../pack/muscriptor';
import type { SongPack } from '../pack/pack';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const names = (list: readonly string[]) => list.join(', ').replace(/_/g, ' ');

const PRESET_WORDS: { id: MsPreset; label: string }[] = [
  { id: 'strings', label: 'Strings' },
  { id: 'baroque', label: 'Baroque strings and harpsichord' },
  { id: 'classical', label: 'Classical orchestra' },
];

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The words for who made the tracks now. */
function nowWords(c: TranscribeChoices): string {
  if (c.tracksFrom === 'muscriptor') return `The tracks now come from MuScriptor large${c.instruments?.length ? ` (${names(c.instruments)})` : ''}.`;
  if (c.tracksFrom === 'ymt3') return 'The tracks now come from YourMT3+.';
  return 'This song has no instrument tracks now.';
}

const unusable = (t: ToolStatus) => (isChecking(t) ? 'The ears server is still checking it.' : t.reason ?? 'It cannot run here.');

export function openRedoDialog(d: { song: SongPack; choices: TranscribeChoices; onStart(c: RedoChoice): void }): void {
  const { song, choices: c } = d;
  // The list it opens with: the one the tracks came from, else the overnight file's. No list at all: the user chooses.
  const first = c.instruments ?? (c.overnight ? MS_PRESETS[c.overnight.preset] : null);
  const firstPreset = first ? PRESET_WORDS.find((p) => sameList(MS_PRESETS[p.id], first))?.id ?? null : null;
  const dlg = document.createElement('dialog');
  dlg.className = 'redo-dialog';
  dlg.setAttribute('aria-labelledby', 'redo-title');
  dlg.innerHTML = `
    <form method="dialog" class="redo-form">
      <header class="redo-head">
        <h2 id="redo-title">Redo the transcription</h2>
        <p class="dim">${esc(song.title)}, ${clock(c.duration)}. ${esc(nowWords(c))}</p>
        ${c.running ? '<p class="redo-running">A redo of this song is already running: Start follows it instead of starting another.</p>' : ''}
      </header>
      <div class="redo-body">
        <label class="redo-engine">
          <input type="radio" name="engine" value="ymt3" checked>
          <span class="redo-text">
            <span class="redo-name">YourMT3+</span> <span class="redo-time" data-time="ymt3">${esc(estimateWords('ymt3', c.duration, c.ymt3Saved))}</span>
            <span class="redo-note dim">For any music.</span>
            ${!c.ymt3.ok && !c.ymt3Saved ? `<span class="redo-note err">${esc(unusable(c.ymt3))} The ingest then falls back, and says so.</span>` : ''}
          </span>
        </label>
        <label class="redo-engine${c.muscriptor.ok ? '' : ' off'}">
          <input type="radio" name="engine" value="muscriptor"${c.muscriptor.ok ? '' : ' disabled'}>
          <span class="redo-text">
            <span class="redo-name">MuScriptor large</span> <span class="redo-time" data-time="muscriptor"></span>
            <span class="redo-note dim">Better for string-led orchestral pieces.<span data-gpu> The GPU stays busy until it is done.</span></span>
            <span class="redo-note dim" data-licence>Non-commercial licence: fine for own shows and experiments, not for selling.</span>
            ${c.muscriptor.ok ? '' : `<span class="redo-note err" data-why-off>${esc(unusable(c.muscriptor))}</span>`}
          </span>
        </label>
        <fieldset class="redo-list" hidden>
          <legend>Which instruments play? <span class="dim">Required.</span></legend>
          ${PRESET_WORDS.map((p) => `<label><input type="radio" name="list" value="${p.id}"> <span>${esc(p.label)} <span class="dim small">${esc(names(MS_PRESETS[p.id]))}</span></span></label>`).join('')}
          <label><input type="radio" name="list" value="own"> <span>My own list</span></label>
          <input type="text" class="redo-own" spellcheck="false" autocomplete="off" aria-label="Your own list of MuScriptor's names, separated by commas" placeholder="violin, viola, cello" hidden>
          ${c.overnight ? `<label class="redo-overnight"><input type="checkbox" name="overnight"> <span>Use the saved overnight notes (${esc(names(c.overnight.lanes))}; ${c.overnight.notes} notes)</span></label>` : ''}
          <p class="err redo-why" hidden></p>
        </fieldset>
      </div>
      <footer class="redo-foot">
        <button type="button" data-cancel>Cancel</button>
        <button type="submit" class="primary" data-go>Start</button>
      </footer>
    </form>`;

  const q = <T extends Element>(sel: string) => dlg.querySelector<T>(sel)!;
  const radios = (name: string) => [...dlg.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];
  const own = q<HTMLInputElement>('.redo-own'), start = q<HTMLButtonElement>('[data-go]'), box = dlg.querySelector<HTMLInputElement>('input[name="overnight"]');
  const fieldset = q<HTMLFieldSetElement>('.redo-list'), why = q<HTMLElement>('.redo-why'), msTime = q<HTMLElement>('[data-time="muscriptor"]');

  /** What the list controls ask for: the text ingest gets, or nothing yet. */
  const listArg = (): string | null => {
    const r = radios('list').find((x) => x.checked);
    if (!r) return null;
    return r.value === 'own' ? own.value : r.value;
  };

  /** The choice as it stands, or why Start stays off ('' = just not chosen yet). */
  const read = (): { choice: RedoChoice } | { why: string } => {
    if (radios('engine').find((x) => x.checked)?.value !== 'muscriptor') return { choice: { engine: 'ymt3' } };
    const arg = listArg();
    if (arg === null) return { why: '' };
    const r = resolveInstruments(arg);
    if ('why' in r) return { why: arg.trim() ? r.why : '' };
    if (box?.checked && c.overnight) {
      const outside = lanesOutside(c.overnight.lanes, r.list);
      if (outside.length) return { why: `The overnight notes have ${names(outside)}, which this list lacks: choose the list they were made with, or leave them out.` };
    }
    return { choice: { engine: 'muscriptor', instruments: arg.trim(), ...(box?.checked ? { overnight: true } : {}) } };
  };

  const sync = () => {
    const isMs = radios('engine').find((x) => x.checked)?.value === 'muscriptor';
    fieldset.hidden = !isMs;
    own.hidden = radios('list').find((x) => x.checked)?.value !== 'own';
    const arg = listArg();
    const r = arg === null ? null : resolveInstruments(arg);
    const list = r && !('why' in r) ? r.list : null;
    msTime.textContent = msEstimate(c, !!box?.checked || (list !== null && savedFor(c, list)));
    q<HTMLElement>('[data-gpu]').hidden = msTime.textContent === SAVED_WORDS;
    const now = read();
    start.disabled = 'why' in now;
    why.hidden = !('why' in now) || !now.why;
    why.textContent = 'why' in now ? now.why : '';
  };

  // The saved overnight notes belong to one list: another list unticks them, ticking them brings their list back.
  if (first) {
    if (firstPreset) radios('list').find((x) => x.value === firstPreset)!.checked = true;
    else { radios('list').find((x) => x.value === 'own')!.checked = true; own.value = first.join(', '); }
  }
  if (box && c.overnight) {
    const nightList = MS_PRESETS[c.overnight.preset];
    // On by default, unless a result of that list is saved already: importing would overwrite it for nothing.
    box.checked = !savedFor(c, nightList) && (!first || sameList(first, nightList));
    box.addEventListener('change', () => {
      if (box.checked) radios('list').find((x) => x.value === c.overnight!.preset)!.checked = true;
      sync();
    });
    for (const r of radios('list')) r.addEventListener('change', () => {
      if (r.checked && r.value !== c.overnight!.preset) box.checked = false;
      sync();
    });
  } else {
    for (const r of radios('list')) r.addEventListener('change', sync);
  }
  for (const r of radios('engine')) r.addEventListener('change', sync);
  own.addEventListener('input', sync);
  for (const r of radios('list')) r.addEventListener('change', () => { if (r.checked && r.value === 'own') own.focus(); });

  // The studio's keys listen on window: they stop here (Ctrl+S goes on, saving is never a surprise). Escape still cancels.
  dlg.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') return;
    e.stopPropagation();
  });
  q<HTMLButtonElement>('[data-cancel]').addEventListener('click', () => dlg.close());
  q<HTMLFormElement>('.redo-form').addEventListener('submit', (e) => {
    const now = read();
    if ('why' in now) { e.preventDefault(); return; }
    dlg.addEventListener('close', () => d.onStart(now.choice), { once: true });
  });
  dlg.addEventListener('close', () => dlg.remove());

  sync();
  document.body.append(dlg);
  dlg.showModal();
}
