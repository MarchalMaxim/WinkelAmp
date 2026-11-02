/**
 * The song library: a drawer listing the songs with where their notes came from and whether they have a show of
 * their own, and where a recording is added (a file picker; a file dropped anywhere on the page comes here too) with
 * its progress. Opening a song is a fresh page (/?song=<id>): several widgets cache the song's notes when they load.
 */
import { isChecking } from '../ingest/ears-client';
import type { TranscriberStatus } from '../ingest/ears-types';
import type { LibraryEntry } from './api';
import { clock } from './timeline';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

const NOTES_BADGE: Record<LibraryEntry['notesFrom'], [string, string]> = {
  gpu: ['transcribed', 'Notes transcribed from the recording by the piano model'],
  file: ['notes file', 'Notes from a notes file'],
  merged: ['partly approximate', 'The piano model heard little of this recording: approximate notes fill the rest'],
  approx: ['approximate', 'Approximate notes from the analysis: no transcriber ran'],
  hybrid: ['instruments', 'Notes from the piano model, with YourMT3+ filling its gaps; instrument tracks'],
  ymt3: ['YourMT3+', 'Notes transcribed by YourMT3+, velocities estimated from loudness'],
  'bp-hybrid': ['gap-filled', 'Notes from the piano model, with basic-pitch filling its gaps; no instrument tracks'],
  'ms-hybrid': ['instruments', 'Notes from the piano model, with MuScriptor filling its gaps; instrument tracks from MuScriptor'],
};

/** "Rachmaninoff: Prelude in C♯ minor" → ["Rachmaninoff", "Prelude in C♯ minor"]. */
export function splitTitle(title: string): [string, string] {
  const i = title.indexOf(': ');
  return i > 0 && i < 40 ? [title.slice(0, i), title.slice(i + 2)] : ['', title];
}

/** The song's page; a page told where the ears server is (?ears=, checks) keeps telling. */
export function songHref(id: string, search = typeof location === 'undefined' ? '' : location.search): string {
  const ears = new URLSearchParams(search).get('ears');
  return `?song=${encodeURIComponent(id)}${ears ? `&ears=${encodeURIComponent(ears)}` : ''}`;
}

/** What the drawer shows while a recording is being added. */
export interface Adding { name: string; message: string; progress: number; approximate: boolean }

/** Where the notes of an added recording will come from: the ears server's transcriber, or this browser. */
export type EarsState = { up: false } | { up: true; transcriber: TranscriberStatus };

export class Library {
  readonly el: HTMLElement;
  private open = false;
  private back: HTMLElement | null = null;
  /** While the drawer is open it has the keys: Escape closes it, the studio's own keys (Space, S, Delete…) wait;
      Ctrl/Cmd keys (save, undo) still reach the studio. */
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.toggle(false); return; }
    if (e.ctrlKey || e.metaKey) return;
    e.stopPropagation();   // not preventDefault: Tab and Enter on a song still do what they do
  };

  /** Called when the drawer opens (the studio looks for the ears server then). */
  onOpen?: () => void;
  private ears: EarsState | null = null;
  private readonly overlay: HTMLElement;

  constructor(private readonly current: string | null, private readonly writable: boolean, private readonly onFile: (f: File) => void) {
    this.el = document.createElement('div');
    this.el.className = 'library';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="library-scrim" data-close></div>
      <nav class="library-sheet" aria-label="Songs">
        <header><h2>Songs</h2><button type="button" class="icon" data-close aria-label="Close">✕</button></header>
        <div class="add-song">
          <label class="add-btn"><input type="file" accept="audio/*,video/*" data-file>Add a recording…</label>
          <p class="add-how dim small"></p>
          <div class="adding" hidden>
            <div class="adding-head"><span class="adding-name"></span><span class="badge n-approx" data-approx hidden>approximate</span></div>
            <div class="bar"><i></i></div>
            <p class="adding-msg dim small" aria-live="polite"></p>
          </div>
        </div>
        <ul class="songs"></ul>
        <div class="library-how"></div>
        <footer>
          ${writable ? '<a href="lab/index.html">Widget lab</a><span class="dim">where widgets are sketched and rated</span>' : ''}
          <a href="legacy.html">Old app: microphone, MIDI</a><span class="dim">the live-listening WinkelAmp</span>
        </footer>
      </nav>`;
    this.el.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', () => this.toggle(false)));
    const input = this.el.querySelector<HTMLInputElement>('[data-file]')!;
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      input.value = '';
      if (f) this.onFile(f);
    });
    this.howToAdd();

    // A recording dropped anywhere on the page.
    this.overlay = document.createElement('div');
    this.overlay.className = 'drop-overlay';
    this.overlay.hidden = true;
    this.overlay.innerHTML = '<div><span class="drop-title">Drop the recording</span><span class="dim">it is added to your songs</span></div>';
    document.body.append(this.overlay);
    const files = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    let depth = 0;
    window.addEventListener('dragenter', (e) => { if (files(e)) { depth++; this.overlay.hidden = false; } });
    window.addEventListener('dragleave', (e) => { if (files(e) && --depth <= 0) { depth = 0; this.overlay.hidden = true; } });
    window.addEventListener('dragover', (e) => { if (files(e)) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; } });
    window.addEventListener('drop', (e) => {
      if (!files(e)) return;
      e.preventDefault();
      depth = 0; this.overlay.hidden = true;
      const f = e.dataTransfer?.files[0];
      if (f) this.onFile(f);
    });
  }

  /** Opens the file picker (the empty studio's button). */
  choose(): void { this.el.querySelector<HTMLInputElement>('[data-file]')!.click(); }

  /** What the ears server said (null: not asked yet). */
  setEars(e: EarsState | null): void { this.ears = e; this.howToAdd(); }

  /** The recording being added, or null when nothing is. */
  progress(a: Adding | null): void {
    const box = this.el.querySelector<HTMLElement>('.adding')!;
    box.hidden = !a;
    this.el.querySelector<HTMLElement>('.add-btn')!.classList.toggle('busy', !!a);
    if (!a) return;
    box.querySelector('.adding-name')!.textContent = a.name;
    box.querySelector<HTMLElement>('[data-approx]')!.hidden = !a.approximate;
    box.querySelector<HTMLElement>('.bar i')!.style.width = `${(Math.max(0, Math.min(1, a.progress)) * 100).toFixed(1)}%`;
    box.querySelector('.adding-msg')!.textContent = a.message;
  }

  private howToAdd(): void {
    const e = this.ears, how = this.el.querySelector('.add-how')!;
    how.textContent = !this.writable
      ? 'Or drop one on the page. This browser analyses it and keeps it here: approximate notes, no transcription.'
      : !e ? 'Or drop one on the page.'
      : !e.up ? 'The ears server is not running, so this browser makes approximate notes. For notes transcribed on the GPU, start npm run ears first.'
      : isChecking(e.transcriber) ? 'Or drop one on the page. The ears server is checking its transcriber (loading the piano model takes a few seconds)…'
      : e.transcriber.ok ? `Or drop one on the page. Its notes are transcribed on the ${e.transcriber.device === 'cuda' ? 'GPU' : 'CPU'} by npm run ears.`
      : `Transcriber unavailable: ${e.transcriber.reason ?? 'unknown'}. The ears server makes approximate notes instead.`;
  }

  get isOpen(): boolean { return this.open; }

  toggle(open = !this.open): void {
    if (open === this.open) return;
    this.open = open;
    this.el.hidden = !open;
    document.body.classList.toggle('library-open', open);
    if (open) {
      this.back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.addEventListener('keydown', this.onKey, { capture: true });
      this.onOpen?.();
      const q = (sel: string) => this.el.querySelector<HTMLElement>(sel);
      (q('.songs a.on') ?? q('.songs a') ?? q('.library-sheet button[data-close]'))?.focus();
    } else {
      window.removeEventListener('keydown', this.onKey, { capture: true });
      this.back?.focus(); this.back = null;
    }
  }

  render(songs: LibraryEntry[]): void {
    const ul = this.el.querySelector('.songs')!;
    ul.innerHTML = songs.length ? songs.map((s) => {
      const [composer, piece] = splitTitle(s.title), [badge, tip] = NOTES_BADGE[s.notesFrom] ?? NOTES_BADGE.approx;
      return `<li><a href="${songHref(s.id)}" class="song${s.id === this.current ? ' on' : ''}" ${s.id === this.current ? 'aria-current="page"' : ''}>
        <span class="song-title">${composer ? `<span class="composer">${esc(composer)}</span>` : ''}<span class="piece">${esc(piece)}</span></span>
        <span class="song-meta"><span>${clock(s.duration)}</span><span class="badge n-${s.notesFrom}" title="${esc(tip)}">${badge}</span>
          <span class="badge ${s.hasShow ? 'show-own' : 'show-auto'}">${s.hasShow ? 'your show' : 'no show yet'}</span></span>
        ${s.error ? `<span class="err small">${esc(s.error)}</span>` : ''}</a></li>`;
    }).join('') : '<li class="dim">No songs yet.</li>';
    this.el.querySelector('.library-how')!.innerHTML = this.writable
      ? `<p class="dim small">From a terminal: <code>npm run ingest -- &lt;audio file&gt;</code> does the same as dropping a file with <code>npm run ears</code> running.</p>`
      : `<p class="dim small">Songs added here stay in this browser. Run the studio from the project (<code>npm run dev</code>) to keep them as files, with notes transcribed on the GPU.</p>`;
  }
}
