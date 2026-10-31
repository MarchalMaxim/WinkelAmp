/**
 * The song library: a drawer listing the songs with where their notes came from and whether they have a show of
 * their own. Opening a song is a fresh page (/?song=<id>): several widgets cache the song's notes when they load.
 */
import type { LibraryEntry } from './api';
import { clock } from './timeline';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

const NOTES_BADGE: Record<LibraryEntry['notesFrom'], [string, string]> = {
  gpu: ['transcribed', 'Notes transcribed from the recording by the piano model'],
  file: ['notes file', 'Notes from a notes file'],
  merged: ['partly approximate', 'The piano model heard little of this recording: approximate notes fill the rest'],
  approx: ['approximate', 'Approximate notes from the analysis: no transcriber ran'],
};

/** "Rachmaninoff: Prelude in C♯ minor" → ["Rachmaninoff", "Prelude in C♯ minor"]. */
export function splitTitle(title: string): [string, string] {
  const i = title.indexOf(': ');
  return i > 0 && i < 40 ? [title.slice(0, i), title.slice(i + 2)] : ['', title];
}

export function songHref(id: string): string { return `?song=${encodeURIComponent(id)}`; }

export class Library {
  readonly el: HTMLElement;
  private open = false;

  constructor(private readonly current: string | null, private readonly writable: boolean) {
    this.el = document.createElement('div');
    this.el.className = 'library';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="library-scrim" data-close></div>
      <nav class="library-sheet" aria-label="Songs">
        <header><h2>Songs</h2><button type="button" class="icon" data-close aria-label="Close">✕</button></header>
        <ul class="songs"></ul>
        <div class="library-how"></div>
        <footer>
          <a href="lab/index.html">Widget lab</a><span class="dim">where widgets are sketched and rated</span>
          <a href="legacy.html">Old app: microphone, MIDI</a><span class="dim">the live-listening WinkelAmp</span>
        </footer>
      </nav>`;
    this.el.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', () => this.toggle(false)));
    this.el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.toggle(false); } });
  }

  get isOpen(): boolean { return this.open; }

  toggle(open = !this.open): void {
    this.open = open;
    this.el.hidden = !open;
    document.body.classList.toggle('library-open', open);
    if (open) this.el.querySelector<HTMLElement>('.songs a, [data-close]')?.focus();
  }

  render(songs: LibraryEntry[]): void {
    const ul = this.el.querySelector('.songs')!;
    ul.innerHTML = songs.length ? songs.map((s) => {
      const [composer, piece] = splitTitle(s.title), [badge, tip] = NOTES_BADGE[s.notesFrom] ?? NOTES_BADGE.approx;
      return `<li><a href="${songHref(s.id)}" class="song${s.id === this.current ? ' on' : ''}" ${s.id === this.current ? 'aria-current="page"' : ''}>
        <span class="song-title">${composer ? `<span class="composer">${esc(composer)}</span>` : ''}<span class="piece">${esc(piece)}</span></span>
        <span class="song-meta"><span>${clock(s.duration)}</span><span class="badge n-${s.notesFrom}" title="${esc(tip)}">${badge}</span>
          <span class="badge ${s.hasShow ? 'show-own' : 'show-auto'}">${s.hasShow ? 'your show' : 'automatic show'}</span></span>
        ${s.error ? `<span class="err small">${esc(s.error)}</span>` : ''}</a></li>`;
    }).join('') : '<li class="dim">No songs yet.</li>';
    this.el.querySelector('.library-how')!.innerHTML = this.writable
      ? `<p class="dim small">Add a recording with <code>npm run ingest -- &lt;audio file&gt;</code>: it is transcribed once and appears here.</p>`
      : `<p class="dim small">This copy of the studio has no songs: run it from the project with <code>npm run dev</code> and add recordings with <code>npm run ingest</code>.</p>`;
  }
}
