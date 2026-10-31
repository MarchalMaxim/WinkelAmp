/**
 * Adding a recording from the studio: to the ears server when it runs (GPU notes, written to songs/ by the ingest
 * CLI), else analysed in this browser (approximate notes, kept by the store). The library drawer shows the progress;
 * the new song then opens with a show composed for it (unless the show here has unsaved edits: then it waits in the
 * library). Also re-ingests an approximate song with the transcriber.
 */
import { ingestViaEars, probeEars, reingestViaEars } from '../ingest/ears-client';
import type { Job } from '../ingest/ears-types';
import { ingestInBrowser } from '../ingest/fallback';
import type { ShowStore } from './api';
import { songHref, type EarsState, type Library } from './library';
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
  analyze: 'Finding the sections, beats and chords', write: 'Writing the song',
};
const pct = (f: number) => `${Math.floor(Math.max(0, Math.min(1, f)) * 100)} %`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class SongAdder {
  private busy: string | null = null;
  private earsAt = 0;
  private earsState: Promise<EarsState> | null = null;

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
      this.earsState = probeEars().then((t): EarsState => (t ? { up: true, transcriber: t } : { up: false }));
      void this.earsState.then((s) => this.d.library.setEars(s));
    }
    return this.earsState;
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
        const approximate = !ears.transcriber.ok;
        let last: Job | null = null;
        const id = await ingestViaEars(file, (j) => {
          last = j;
          const words = j.state === 'queued' && j.stage !== 'upload' ? j.message || 'Waiting for the recording before it'
            : j.stage === 'transcribe' ? (/loading/.test(j.message) ? 'Loading the piano model'
              : `${STAGE_WORDS.transcribe} on the ${ears.transcriber.device === 'cpu' ? 'CPU' : 'GPU'}`) : STAGE_WORDS[j.stage];
          library.progress({ name: file.name, message: `${words} · ${pct(j.progress)} · ${took()}`, progress: j.progress, approximate });
        });
        const warnings = (last as Job | null)?.warnings ?? [];
        const notes = warnings.filter((w) => /^transcriber unavailable|^the transcriber failed/.test(w))
          .map((w): Notice => ({ id: 'transcriber', level: 'warn', text: w.charAt(0).toUpperCase() + w.slice(1) }));
        await this.finish(id, file.name, notes);
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

  /** Transcribes an approximate song with the ears server, then reopens it. */
  async reingest(id: string, name: string): Promise<void> {
    if (this.busy) { this.d.notify({ id: 'add', level: 'info', text: 'One recording at a time: the one being added is not finished yet.' }); return; }
    const ears = await this.ears();
    if (!ears.up) { this.d.notify({ id: 'add', level: 'error', text: 'The ears server is not running: start it with npm run ears, then try again.' }); return; }
    if (!ears.transcriber.ok) { this.d.notify({ id: 'add', level: 'error', text: `Transcriber unavailable: ${ears.transcriber.reason ?? 'unknown'}.` }); return; }
    this.busy = 'ears';
    const { library } = this.d;
    library.toggle(true);
    const t0 = performance.now();
    try {
      await reingestViaEars(id, (j) => library.progress({
        name, progress: j.progress, approximate: false,
        message: `${j.stage === 'upload' ? 'Asking the ears server' : STAGE_WORDS[j.stage]} · ${pct(j.progress)} · ${clock((performance.now() - t0) / 1000)}`,
      }));
      await this.finish(id, name, []);
    } catch (e) {
      library.progress(null);
      this.d.notify({ id: 'add', level: 'error', text: `${name} was not transcribed: ${(e as Error).message}` });
    } finally {
      this.busy = null;
    }
  }

  /** The song is in the library: list it, then open it (or say where it is when the show here has unsaved edits). */
  private async finish(id: string, name: string, notices: Notice[]): Promise<void> {
    const { api, library } = this.d;
    library.progress({ name, message: 'Done: opening it…', progress: 1, approximate: false });
    try { library.render(await api.songs()); } catch { /* the list refreshes on the next page */ }
    const open = () => { flash(id, notices); if (id === this.d.current) location.reload(); else location.assign(songHref(id)); };
    if (!this.d.dirty()) { open(); return; }
    library.progress(null);
    for (const n of notices) this.d.notify(n);
    this.d.notify({ id: 'added', level: 'info', text: id === this.d.current
      ? `${name} has new notes: reopen it to play with them (your unsaved edits here would be lost).`
      : `${name} is in your songs. Save this show first, or open it now.` }, { label: id === this.d.current ? 'Reopen' : 'Open it', run: open });
  }
}
