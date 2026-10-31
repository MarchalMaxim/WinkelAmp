/**
 * Recording the show in the studio (plan §10): the canvas and the song into an MP4 (H.264 + AAC) the browser writes
 * while the song plays once, at a bit rate that keeps a minute to a few MB (WhatsApp). For a frame-exact HD video
 * there is `npm run render-show`.
 */
import { download, pickMimeType, Recorder, type RecorderOptions } from '../../visual/recorder';
import type { Player } from './player';
import type { Store } from './store';

/** share: small enough to send (≈ 8.5 MB a minute); high: for keeping (≈ 39). Both record 30 frames a second: Chrome's
    H.264 encoder (measured on the Prelude, 2026-10-31) writes about twice the rate asked at 60 fps (share: ≈ 20 MB a
    minute; high: ≈ 74), whatever the rate (500 kb/s wrote as much as 1 Mb/s), and close to it at 30 fps (share 9.6–10.5,
    high 39.4). */
export const RECORD_PRESETS = {
  share: { videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 128_000, fps: 30 },
  high: { videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 192_000, fps: 30 },
} as const satisfies Record<string, RecorderOptions>;
export type RecordPreset = keyof typeof RECORD_PRESETS;

/** The MB a minute of recording aims at: (video + audio) · 60 / 8 / 1e6, one decimal. */
export function mbPerMinute(o: RecorderOptions): number {
  return Math.round(((o.videoBitsPerSecond + (o.audioBitsPerSecond ?? 0)) * 60) / 8 / 1e5) / 10;
}

const two = (n: number) => String(n).padStart(2, '0');

/** 'prelude-2026-10-31-02-03-04.mp4' (local time; .webm when the browser could only record WebM). */
export function recordingName(showId: string, mime: string, at: Date): string {
  const when = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}-${two(at.getHours())}-${two(at.getMinutes())}-${two(at.getSeconds())}`;
  return `${showId}-${when}.${/^video\/mp4/.test(mime) ? 'mp4' : 'webm'}`;
}

/** m:ss */
const clock = (s: number) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${two(t % 60)}`; };

/** What a finished recording was. */
export interface Recorded { name: string; bytes: number; mime: string; seconds: number }
type RecState = 'idle' | 'recording' | 'paused' | 'saving';

/** The pre-roll before a recording that starts mid-song: three seconds at 60 Hz, as render-show's, so the first frame
    already shows what playing up to there draws instead of black. */
const PREROLL = { seconds: 3, hz: 60 };

/**
 * One recording at a time: seek to `from`, the picture reset (and pre-rolled when `from` > 0), the recorder and the
 * song started together; the song's end stops it and the file is saved (downloaded). Pausing the song pauses the
 * recording; a hidden tab (which draws no frames) pauses both, and showing it again resumes both. Seeks are locked.
 */
export class ShowRecorder {
  /** Checks only (?recordCheck=<s>): stop after this many seconds of the song, as if it ended there. */
  stopAfter: number | null = null;
  /** Called on every state change. */
  onChange?: () => void;
  /** Called with the saved file. */
  onSaved?: (r: Recorded) => void;
  private now: RecState = 'idle';
  private rec: Recorder | null = null;
  private from = 0;
  private hiddenPause = false;
  private poll = 0;
  private readonly off: (() => void)[] = [];

  constructor(readonly player: Player, readonly canvas: HTMLCanvasElement) {}

  get state(): RecState { return this.now; }
  /** Seconds of the song recorded so far. */
  get seconds(): number { return this.now === 'idle' ? 0 : Math.max(0, this.player.time - this.from); }
  /** Where the recording started in the song. */
  get startedAt(): number { return this.from; }
  /** Its container and codecs, as the browser writes them ('' before it starts). */
  get mimeType(): string { return this.rec?.mimeType ?? ''; }
  /** The MediaRecorder's own state, for checks. */
  get recorderState(): 'recording' | 'paused' | 'inactive' | 'none' {
    return this.rec ? (this.rec.recording ? 'recording' : this.rec.paused ? 'paused' : 'inactive') : 'none';
  }

  /** Can this browser record the canvas with sound? */
  static supported(): boolean {
    return Recorder.supported() && !!pickMimeType((t) => MediaRecorder.isTypeSupported(t));
  }

  /** Call it from the click: the audio is routed for recording before anything waits, so the browser lets it play. */
  async start(o: { preset: RecordPreset; from: number }): Promise<void> {
    if (this.now !== 'idle') return;
    const p = this.player, a = p.audio, stream = p.audioStream();
    this.set('recording');
    p.locked = true;
    try {
      if (!a.paused) { const paused = new Promise((res) => a.addEventListener('pause', res, { once: true })); a.pause(); await paused; }
      const end = p.duration || Infinity;
      const from = (this.from = Math.max(0, Math.min(end - 0.5, o.from)));
      if (Math.abs(a.currentTime - from) > 1e-3) {
        const seeked = new Promise<void>((res) => a.addEventListener('seeked', () => res(), { once: true }));
        a.currentTime = from;
        await seeked;
      }
      if (from > 0) p.conductor.preview(from, PREROLL); else p.conductor.reset(from);
      p.runtime.lastT = from;
      this.rec = new Recorder(this.canvas, stream, RECORD_PRESETS[o.preset]);
      this.listen();
      this.rec.start();
      await a.play();
    } catch (e) {
      this.unlisten();
      const r = this.rec;
      if (r && (r.recording || r.paused)) await r.stop().catch(() => undefined);
      this.rec = null; p.locked = false; this.set('idle');
      throw e;
    }
  }

  /** Stops and saves what was recorded. */
  async stop(): Promise<void> {
    const rec = this.rec;
    if (this.now === 'idle' || this.now === 'saving' || !rec) return;
    const p = this.player, seconds = this.seconds;
    this.set('saving');
    this.unlisten();
    p.pause();
    try {
      const blob = await rec.stop();
      const name = recordingName(p.conductor.current.id, blob.type, new Date());
      download(blob, name);
      this.onSaved?.({ name, bytes: blob.size, mime: blob.type, seconds });
    } finally {
      this.rec = null; p.locked = false; this.hiddenPause = false;
      this.set('idle');
    }
  }

  private set(s: RecState): void { this.now = s; this.onChange?.(); }

  private listen(): void {
    const a = this.player.audio;
    const on = (t: 'pause' | 'play' | 'ended', fn: () => void) => { a.addEventListener(t, fn); this.off.push(() => a.removeEventListener(t, fn)); };
    // The song paused (the play button, Space, a hidden tab): the recording waits with it. It ends: the file is saved.
    on('pause', () => { if (a.ended) return; this.rec?.pause(); if (this.now === 'recording') this.set('paused'); });
    on('play', () => { this.rec?.resume(); if (this.now === 'paused') this.set('recording'); });
    on('ended', () => void this.stop());
    // A hidden tab draws no frames: pause both at once; back in front, both go on.
    const vis = () => {
      if (document.hidden && this.now === 'recording') { this.hiddenPause = true; this.rec?.pause(); a.pause(); this.set('paused'); }
      else if (!document.hidden && this.hiddenPause) { this.hiddenPause = false; void a.play().catch(() => {}); }
    };
    document.addEventListener('visibilitychange', vis);
    this.off.push(() => document.removeEventListener('visibilitychange', vis));
    this.poll = window.setInterval(() => {
      if (this.stopAfter !== null && this.now === 'recording' && a.currentTime - this.from >= this.stopAfter) void this.stop();
    }, 50);
  }

  private unlisten(): void {
    for (const f of this.off.splice(0)) f();
    clearInterval(this.poll);
  }
}

const PRESET_KEY = 'wa-studio.record-preset';
const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* private window */ } };
const mb = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n)));

const REC_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m16 10.5 5-3v9l-5-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

export interface ExportDeps {
  store: Store; player: Player; canvas: HTMLCanvasElement;
  /** The transport bar: the Export button and the REC indicator go in before `before`. */
  host: HTMLElement; before: Element | null;
  /** The command for a frame-exact video (shown when the dev server runs), e.g. 'npm run render-show -- prelude'. */
  renderCommand: string | null;
  notify(level: 'info' | 'warn' | 'error', text: string): void;
}

/** The Export menu, the REC indicator with its Stop button, and the recorder behind them. */
export function installExport(d: ExportDeps): ShowRecorder {
  const { store, player } = d;
  const rec = new ShowRecorder(player, d.canvas);
  const check = Number(new URLSearchParams(location.search).get('recordCheck'));
  if (check > 0) rec.stopAfter = check;
  const can = ShowRecorder.supported();

  const wrap = document.createElement('div');
  wrap.className = 'export';
  wrap.innerHTML = `
    <button type="button" class="export-btn" data-export aria-haspopup="dialog" aria-expanded="false" ${can ? 'title="Record a video of the show"' : 'disabled title="This browser cannot record video"'}>${REC_ICON}<span>Export</span></button>
    <div class="export-menu" role="dialog" aria-label="Record a video" hidden>
      <p class="menu-title">Record a video</p>
      <fieldset class="presets">
        <legend class="dim small">Quality</legend>
        ${(Object.keys(RECORD_PRESETS) as RecordPreset[]).map((k) => `<label><input type="radio" name="rec-preset" value="${k}">
          <span>${k === 'share' ? 'For sharing' : 'High quality'}</span> <span class="dim small">about ${mb(mbPerMinute(RECORD_PRESETS[k]))} MB a minute</span></label>`).join('')}
      </fieldset>
      <button type="button" class="primary rec-go" data-rec="song">Record video: whole song <span class="rec-size" data-size="song"></span></button>
      <button type="button" class="rec-go" data-rec="here">Record video: from the playhead <span class="rec-size" data-size="here"></span></button>
      <p class="dim small">The song plays through once while it records, then the MP4 saves itself. Keep this tab in front: hiding it pauses the recording.</p>
      ${d.renderCommand ? `<p class="dim small">A frame-exact HD video instead:<br><code>${d.renderCommand}</code></p>` : ''}
    </div>`;
  const ind = document.createElement('div');
  ind.className = 'rec-ind';
  ind.hidden = true;
  ind.innerHTML = '<span class="rec-dot" aria-hidden="true"></span><span class="rec-text" aria-live="off"></span><button type="button" data-stop>Stop and save</button>';
  d.host.insertBefore(wrap, d.before);
  d.host.insertBefore(ind, wrap);

  const btn = wrap.querySelector<HTMLButtonElement>('[data-export]')!, menu = wrap.querySelector<HTMLElement>('.export-menu')!;
  const text = ind.querySelector<HTMLElement>('.rec-text')!;
  let preset: RecordPreset = lsGet(PRESET_KEY) === 'high' ? 'high' : 'share';
  menu.querySelector<HTMLInputElement>(`input[value="${preset}"]`)!.checked = true;

  const sizes = () => {
    const dur = player.duration, rate = mbPerMinute(RECORD_PRESETS[preset]) / 60;
    const say = (s: number) => `(${clock(s)}, about ${mb(s * rate)} MB)`;
    const here = Math.max(0, dur - player.time);
    menu.querySelector('[data-size="song"]')!.textContent = dur ? say(dur) : '';
    menu.querySelector('[data-size="here"]')!.textContent = dur && player.time >= 0.5 ? say(here) : '';
    menu.querySelector<HTMLButtonElement>('[data-rec="song"]')!.disabled = !dur;
    menu.querySelector<HTMLButtonElement>('[data-rec="here"]')!.disabled = !dur || player.time < 0.5 || here < 1;
  };
  const open = (on: boolean) => {
    menu.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    if (on) sizes();
  };
  btn.addEventListener('click', () => open(menu.hidden));
  document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !wrap.contains(e.target as Node)) open(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); e.stopPropagation(); open(false); btn.focus(); } }, true);
  menu.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).value;
    if (v === 'share' || v === 'high') { preset = v; lsSet(PRESET_KEY, v); sizes(); }
  });
  for (const b of menu.querySelectorAll<HTMLButtonElement>('[data-rec]')) {
    b.addEventListener('click', () => {
      open(false);
      const from = b.dataset.rec === 'here' ? player.time : 0;
      rec.start({ preset, from }).catch((e) => d.notify('error', `The recording did not start: ${(e as Error).message}`));
    });
  }
  ind.querySelector('[data-stop]')!.addEventListener('click', () => void rec.stop());

  // While it records: the REC indicator with the song time recorded of the time to record; edits, undo and seeks wait.
  let timer = 0;
  const draw = () => {
    const total = Math.max(0, (player.duration || 0) - rec.startedAt);
    const label = rec.state === 'paused' ? 'Paused' : rec.state === 'saving' ? 'Saving' : 'REC';
    text.textContent = `${label} ${clock(rec.seconds)} / ${clock(Math.min(total, rec.stopAfter ?? Infinity))}`;
    ind.classList.toggle('paused', rec.state !== 'recording');
  };
  rec.onChange = () => {
    const busy = rec.state !== 'idle';
    ind.hidden = !busy; wrap.hidden = busy;
    document.body.classList.toggle('recording', busy);
    if (store.state.ui.recording !== busy) store.dispatch({ type: 'ui', patch: { recording: busy } });
    clearInterval(timer);
    if (busy) { draw(); timer = window.setInterval(draw, 250); }
  };
  rec.onSaved = (r) => d.notify('info', `Saved ${r.name} (${clock(r.seconds)}, ${mb(r.bytes / 1e6)} MB) to your downloads.`);
  return rec;
}
