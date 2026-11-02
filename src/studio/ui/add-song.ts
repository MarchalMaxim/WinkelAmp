/**
 * Adding a recording from the studio: to the ears server when it runs (GPU notes, written to songs/ by the ingest
 * CLI), else analysed in this browser (approximate notes, kept by the store). The library drawer shows the progress;
 * the new song then opens with an empty timeline (unless the show here has unsaved edits: then it waits in the
 * library). Also re-ingests an approximate song with the transcriber, and redoes any song's transcription with the
 * transcriber chosen in the redo dialog.
 */
import { ingestViaEars, isChecking, probeEars, reingestViaEars, settleEars, transcribeChoices } from '../ingest/ears-client';
import type { Job, TranscribeChoices, TranscriberStatus } from '../ingest/ears-types';
import { ingestInBrowser } from '../ingest/fallback';
import type { RedoChoice } from '../ingest/transcribe-options';
import type { SongPack } from '../pack/pack';
import type { ShowStore } from './api';
import { songHref, type EarsState, type Library } from './library';
import { openRedoDialog } from './redo-dialog';
import type { Notice } from './store';

export interface AddDeps {
  api: ShowStore;
  library: Library;
  /** The song open now (null: none). */
  current: string | null;
  notify(n: Notice, action?: { label: string; run(): void }): void;
  dismiss(id: string): void;
  /** Unsaved edits here: the new song waits in the library instead of replacing the page. */
  dirty(): boolean;
}

const FLASH = 'wa-studio.flash';
const RECORDING = /\.(mp3|wav|flac|ogg|oga|opus|m4a|aac|mp4|m4v|webm|weba|aif|aiff|wma|mkv|mov)$/i;

/** Notices saved for the song about to open (a fresh page): what the ingest said that the pack does not. */
export function takeFlash(id: string): Notice[] {
  try {
    const raw = sessionStorage.getItem(FLASH);
    if (!raw) return [];
    sessionStorage.removeItem(FLASH);
    const f = JSON.parse(raw) as { id: string; notices: Notice[] };
    return f.id === id && Array.isArray(f.notices) ? f.notices : [];
  } catch { return []; }
}
function flash(id: string, notices: Notice[]): void {
  try { if (notices.length) sessionStorage.setItem(FLASH, JSON.stringify({ id, notices })); } catch { /* storage refused */ }
}

const STAGE_WORDS: Record<Job['stage'], string> = {
  upload: 'Sending the recording to the ears server', decode: 'Decoding', transcribe: 'Transcribing the notes',
  instruments: 'Hearing the instruments',
  analyze: 'Finding the sections, beats and chords', write: 'Writing the song',
};
const toState = (t: TranscriberStatus | null): EarsState => (t ? { up: true, transcriber: t } : { up: false });
/** A job warning saying its notes are approximate after all. */
const FALLBACK_WARNING = /^transcriber unavailable|^the transcriber failed|^approximate notes/;
/** The warnings of ingest's fallback rows (a transcriber missing or failed): said in words when the song opens. */
const TOOL_WARNING = /^transcriber unavailable|^the transcriber failed|^approximate notes|^no instrument tracks|about half the attacks|^piano transcriber unavailable|^the piano model could not run|^YourMT3\+ failed|^basic-pitch failed|^MuScriptor/;
const pct = (f: number) => `${Math.floor(Math.max(0, Math.min(1, f)) * 100)} %`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** How long the dialog waits for the server's tools to be checked (the probes time out at 120 s). */
const CHOICES_LIMIT_MS = 125_000;
const CHOICES_POLL_MS = 500;
const toolNotes = (warnings: readonly string[]) => warnings.filter((w) => TOOL_WARNING.test(w))
  .map((w, i): Notice => ({ id: i ? `transcriber-${i}` : 'transcriber', level: 'warn', text: w.charAt(0).toUpperCase() + w.slice(1) }));

export class SongAdder {
  private busy: string | null = null;
  private opening = false;
  private earsAt = 0;
  private earsState: Promise<EarsState> | null = null;
  private settling: Promise<EarsState> | null = null;

  constructor(private readonly d: AddDeps) {
    window.addEventListener('beforeunload', (e) => {
      // Analysing in this browser: leaving the page loses it (an ears job carries on without the page).
      if (this.busy === 'browser') { e.preventDefault(); e.returnValue = ''; }
    });
  }

  /** Is the ears server up, and can its transcriber run? Asked at most every 5 s. */
  ears(): Promise<EarsState> {
    if (!this.d.api.writable) return Promise.resolve({ up: false });
    if (!this.earsState || performance.now() - this.earsAt > 5000) {
      this.earsAt = performance.now();
      this.earsState = probeEars().then(toState);
      void this.earsState.then((s) => this.d.library.setEars(s));
    }
    return this.earsState;
  }

  /** Like ears(), but while the server is still checking its transcriber (a few seconds after npm run ears starts)
      it asks again until there is a verdict; `onChecking` runs first when it has to wait. */
  async earsSettled(onChecking?: () => void): Promise<EarsState> {
    const e = await this.ears();
    if (!e.up || !isChecking(e.transcriber)) return e;
    onChecking?.();
    this.settling ??= settleEars(undefined, { onAnswer: (t) => this.d.library.setEars(toState(t)) }).then((t) => {
      const s = toState(t);
      this.earsState = Promise.resolve(s);
      this.earsAt = performance.now();
      this.settling = null;
      return s;
    });
    return this.settling;
  }

  async add(file: File): Promise<void> {
    if (!/^(audio|video)\//.test(file.type) && !RECORDING.test(file.name)) {
      this.d.notify({ id: 'add', level: 'warn', text: `${file.name} does not look like a recording (an audio or video file).` });
      return;
    }
    if (this.busy) {
      this.d.notify({ id: 'add', level: 'info', text: 'One recording at a time: the one being added is not finished yet.' });
      return;
    }
    // Taken before the first await: a second drop while the ears server is being asked waits its turn too.
    this.busy = 'probing';
    const { library } = this.d;
    this.d.dismiss('add');
    library.toggle(true);
    library.progress({ name: file.name, message: 'Looking for the ears server…', progress: 0, approximate: false });
    const t0 = performance.now();
    const took = () => clock((performance.now() - t0) / 1000);
    try {
      const ears = await this.ears();
      if (ears.up) {
        this.busy = 'ears';
        // Still checking its transcriber: the job waits for the verdict on the server, the badge waits for it here.
        let t = ears.transcriber;
        if (isChecking(t)) void this.earsSettled().then((s) => { if (s.up) t = s.transcriber; });
        let last: Job | null = null;
        const id = await ingestViaEars(file, (j) => {
          last = j;
          const approximate = (!t.ok && !isChecking(t)) || j.warnings.some((w) => FALLBACK_WARNING.test(w));
          const words = j.state === 'queued' && j.stage !== 'upload' ? j.message || 'Waiting for the recording before it'
            : j.state === 'running' && j.stage === 'upload' ? 'The ears server is checking its transcriber'
            : j.stage === 'transcribe' ? (/loading/.test(j.message) ? 'Loading the piano model'
              : `${STAGE_WORDS.transcribe} on the ${t.device === 'cpu' ? 'CPU' : 'GPU'}`) : STAGE_WORDS[j.stage];
          library.progress({ name: file.name, message: `${words} · ${pct(j.progress)} · ${took()}`, progress: j.progress, approximate });
        });
        await this.finish(id, file.name, toolNotes((last as Job | null)?.warnings ?? []));
      } else {
        this.busy = 'browser';
        const why = this.d.api.writable ? 'the ears server is not running' : 'this copy of the studio has no ears server';
        const pack = await ingestInBrowser(file, this.d.api, (f) => library.progress({
          name: file.name, progress: f, approximate: true,
          message: `${f < 0.08 ? 'Decoding in this browser' : f < 0.96 ? 'Analysing in this browser' : 'Keeping the song'} · ${pct(f)} · ${took()} · approximate notes: ${why}`,
        }));
        await this.finish(pack.id, pack.title, []);
      }
    } catch (e) {
      library.progress(null);
      this.d.notify({ id: 'add', level: 'error', text: `${file.name} was not added: ${(e as Error).message}` });
    } finally {
      this.busy = null;
    }
  }

  /** Asks the ears server what a redo of this song can be and opens the dialog; without the server, says what to do. */
  async redo(song: SongPack): Promise<void> {
    if (this.opening) return;
    if (this.busy) { this.d.notify({ id: 'add', level: 'info', text: 'One recording at a time: the one being added is not finished yet.' }); return; }
    this.opening = true;
    try {
      const choices = await this.settledChoices(song.id);
      if (!choices) {
        const ears = await this.ears();
        this.d.notify({ id: 'add', level: 'error', text: ears.up
          ? 'This ears server cannot choose a transcriber (it may be from an older version): restart npm run ears, then try again.'
          : 'The ears server is not running: start it with npm run ears, then try again.' });
        return;
      }
      openRedoDialog({ song, choices, onStart: (c) => void this.reingest(song.id, song.title, c) });
    } finally {
      this.opening = false;
    }
  }

  /** The choices, once the server has a verdict on its tools (right after npm run ears it is importing torch). */
  private async settledChoices(id: string): Promise<TranscribeChoices | null> {
    const t0 = performance.now();
    let told = false;
    try {
      for (;;) {
        const c = await transcribeChoices(id);
        const waiting = !!c && (isChecking(c.ymt3) || isChecking(c.muscriptor));
        if (!waiting || performance.now() - t0 >= CHOICES_LIMIT_MS) return c;
        if (!told) { told = true; this.d.notify({ id: 'add', level: 'info', text: 'The ears server is checking its transcribers…' }); }
        await new Promise((r) => setTimeout(r, CHOICES_POLL_MS));
      }
    } finally {
      if (told) this.d.dismiss('add');
    }
  }

  /**
   * Transcribes a song with the ears server, then reopens it. With a choice from the redo dialog the piano model is not
   * asked for (ingest's auto mode falls back and says so), and the end is a Reopen notice, never a reload: a job that took
   * 20 minutes must not reload the page under someone playing the song.
   */
  async reingest(id: string, name: string, choice?: RedoChoice): Promise<void> {
    if (this.busy) { this.d.notify({ id: 'add', level: 'info', text: 'One recording at a time: the one being added is not finished yet.' }); return; }
    this.busy = 'probing';
    const { library } = this.d;
    const t0 = performance.now();
    try {
      // Right after npm run ears starts it is still checking its transcriber: wait for the verdict, do not refuse.
      const ears = await this.earsSettled(() => {
        library.toggle(true);
        library.progress({ name, message: 'The ears server is checking its transcriber…', progress: 0, approximate: false });
      });
      if (!ears.up || (!choice && !ears.transcriber.ok)) {
        library.progress(null);
        this.d.notify({ id: 'add', level: 'error', text: !ears.up ? 'The ears server is not running: start it with npm run ears, then try again.'
          : isChecking(ears.transcriber) ? 'The ears server is still checking its transcriber: try again in a moment.'
          : `Transcriber unavailable: ${ears.transcriber.reason ?? 'unknown'}.` });
        return;
      }
      this.busy = 'ears';
      library.toggle(true);
      let warnings: string[] = [];
      await reingestViaEars(id, (j) => {
        warnings = j.warnings;
        // During the instruments the job's own words: chunks and the time left on a long run.
        const words = j.stage === 'upload' ? 'Asking the ears server'
          : j.stage === 'instruments' && j.message ? j.message.charAt(0).toUpperCase() + j.message.slice(1) : STAGE_WORDS[j.stage];
        library.progress({ name, progress: j.progress, approximate: false, message: `${words} · ${pct(j.progress)} · ${clock((performance.now() - t0) / 1000)}` });
      }, choice);
      await this.finish(id, name, toolNotes(warnings), !!choice);
    } catch (e) {
      library.progress(null);
      this.d.notify({ id: 'add', level: 'error', text: `${name} was not transcribed: ${(e as Error).message}` });
    } finally {
      this.busy = null;
    }
  }

  /** The song is in the library: list it, then open it (or say where it is when the show here has unsaved edits, or `ask`). */
  private async finish(id: string, name: string, notices: Notice[], ask = false): Promise<void> {
    const { api, library } = this.d;
    library.progress({ name, message: 'Done: opening it…', progress: 1, approximate: false });
    try { library.render(await api.songs()); } catch { /* the list refreshes on the next page */ }
    const open = () => { flash(id, notices); if (id === this.d.current) location.reload(); else location.assign(songHref(id)); };
    const dirty = this.d.dirty();
    if (!dirty && !ask) { open(); return; }
    library.progress(null);
    library.toggle(false);   // its scrim would cover the notice and its button
    for (const n of notices) this.d.notify(n);
    this.d.notify({ id: 'added', level: 'info', text: id === this.d.current
      ? `${name} has new notes: reopen it to play with them${dirty ? ' (your unsaved edits here would be lost)' : ''}.`
      : `${name} is in your songs. Save this show first, or open it now.` }, { label: id === this.d.current ? 'Reopen' : 'Open it', run: open });
  }
}
