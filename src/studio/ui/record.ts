/**
 * Recording the show in the studio (plan §10): the canvas and the song into an MP4 (H.264 + AAC) the browser writes
 * while the song plays once, at a bit rate that keeps a minute to a few MB (WhatsApp). For a frame-exact HD video
 * there is `npm run render-show`.
 */
import { download, pickMimeType, Recorder, type RecorderOptions } from '../../visual/recorder';
import type { Player } from './player';
import type { Store } from './store';

/** share: sharp enough to send (≈ 15.2 MB a minute, WhatsApp's budget, as render-show's share copy); high: for keeping
    (≈ 61). Both record 30 frames a second at 1280×720 (the live canvas): Chrome's H.264 encoder writes about twice the
    rate asked at 60 fps, and close to it at 30 fps. Measured on the Prelude from 126 s, 20 s each (2026-10-31): share
    16.4 MB a minute, high 64.3; round 1's 1 Mbit/s share wrote 9.2 and smeared squares' edges and the ink into blocks. */
export const RECORD_PRESETS = {
  share: { videoBitsPerSecond: 1_900_000, audioBitsPerSecond: 128_000, fps: 30 },
  high: { videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000, fps: 30 },
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

/** An HD render job as the dev API answers it (scripts/studio-api.ts: POST /api/render/<show>, GET /api/render/jobs/<job>). */
export interface RenderJobView {
  id: string;
  /** The show's id. */
  show: string;
  state: 'running' | 'done' | 'failed' | 'cancelled';
  /** The frames drawn, 0..1 (1 while the share copy is made). */
  progress: number;
  /** Seconds left: 0 when done, null when not known yet or over. */
  eta: number | null;
  /** render-show's last line (the reason, when it failed). */
  message: string;
  /** The master, the share copy and the sheet, as render-show names them at the end. */
  files?: string[];
}

/** The HD master's size: twice the live canvas. */
const HD_SCALE = 2;
/** The dev server's base path, as api.ts finds it. */
const apiBase = (): string => new URL('.', location.href).pathname.replace(/\/$/, '');
const fileName = (p: string): string => p.split(/[\\/]/).pop() ?? p;
const folderOf = (p: string): string => p.slice(0, Math.max(0, p.length - fileName(p).length - 1));

/**
 * The Export menu's "Render HD master (on this computer)": only when the dev API answers GET /api/render/jobs (which
 * also gives back a render still running from before a reload). It sends the show as the studio has it, saved or not,
 * and follows the job: progress, time left, then the files' names. `?renderCheck=<s>` (checks) renders only s seconds.
 */
function mountHd(d: ExportDeps, section: HTMLElement, badge: HTMLElement, onReady: () => void, onLayout: () => void): { refresh(): void } {
  const base = apiBase();
  const check = Number(new URLSearchParams(location.search).get('renderCheck'));
  const q = <T extends Element>(s: string) => section.querySelector<T>(s)!;
  const box = q<HTMLElement>('.hd-job'), bar = q<HTMLProgressElement>('progress'), msg = q<HTMLElement>('.hd-msg');
  const list = q<HTMLElement>('.hd-files'), cancel = q<HTMLButtonElement>('[data-hd-cancel]');
  const go = [...section.querySelectorAll<HTMLButtonElement>('[data-hd]')];
  let job: RenderJobView | null = null, timer = 0, watched = false, starting = false;

  const refresh = () => {
    const running = job?.state === 'running', p = d.player;
    section.dataset.state = starting ? 'starting' : job?.state ?? 'idle';
    for (const b of go) b.disabled = running || starting || !d.store.state.show || !p.duration || (b.dataset.hd === 'here' && (p.time < 0.5 || p.duration - p.time < 1));
    badge.hidden = !running;
    badge.textContent = running ? ` · HD ${Math.round(100 * job!.progress)} %` : '';
    box.hidden = !job;
    if (!job) { onLayout(); return; }
    bar.hidden = job.state !== 'running' && job.state !== 'done';
    bar.value = job.progress;
    const pct = `${Math.round(100 * job.progress)} %`;
    // render-show's progress line says what the percentage and the time left already say: only its frame count stays.
    const frames = /: (\d+)\/(\d+) frames \(/.exec(job.message);
    const doing = frames ? `frame ${frames[1]} of ${frames[2]}` : job.message;
    msg.textContent = job.state === 'running' ? `${pct}${job.eta !== null ? `, about ${clock(job.eta)} left` : ''} (${doing})`
      : job.state === 'done' ? `Done: ${job.show} in HD, in ${folderOf(job.files?.[0] ?? '') || 'renders'}:`
      : job.state === 'cancelled' ? 'Cancelled.' : `It stopped: ${job.message}`;
    list.replaceChildren();
    if (job.files?.length) {
      for (const f of job.files) {
        const li = document.createElement('li'), c = document.createElement('code');
        c.textContent = fileName(f);
        c.style.whiteSpace = 'normal';
        li.append(c);
        if (/-share\.mp4$/.test(f)) li.append(' (send it in WhatsApp as a document)');
        list.append(li);
      }
    }
    cancel.hidden = !running;
    onLayout();
  };

  const finished = (j: RenderJobView) => {
    if (!watched) return;
    watched = false;
    const master = j.files?.[0];
    if (j.state === 'done') {
      d.notify('info', master ? `The HD master is ready: ${fileName(master)}, with its share copy and a contact sheet, in ${folderOf(master)}.`
        : 'The HD render finished, but render-show named no files.');
    }
    else if (j.state === 'failed') d.notify('error', `The HD render stopped: ${j.message}`);
  };
  const follow = (j: RenderJobView | null, watch: boolean) => {
    job = j;
    clearInterval(timer);
    if (j?.state === 'running') {
      watched ||= watch;
      timer = window.setInterval(() => void poll(), 1000);
    } else if (j) finished(j);
    refresh();
  };
  const poll = async () => {
    if (!job) return;
    try {
      const r = await fetch(`${base}/api/render/jobs/${encodeURIComponent(job.id)}`, { cache: 'no-store' });
      if (r.ok) follow((await r.json()) as RenderJobView, false);
    } catch { /* the dev server restarts: try again next tick */ }
  };

  const start = async (from: number | null) => {
    const show = d.store.state.show;
    if (!show || starting) return;
    const qs = new URLSearchParams({ scale: String(HD_SCALE) });
    if (from !== null) qs.set('from', from.toFixed(3));
    if (check > 0) qs.set('to', ((from ?? 0) + check).toFixed(3));
    starting = true; refresh();
    try {
      const r = await fetch(`${base}/api/render/${encodeURIComponent(show.id)}?${qs}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(show),
      });
      const body = (await r.json().catch(() => ({}))) as { job?: RenderJobView; error?: string };
      if (r.status === 409) {
        d.notify('warn', 'An HD render is already running: one at a time.');
        const now = await fetch(`${base}/api/render/jobs`, { cache: 'no-store' }).then((x) => x.json() as Promise<{ job: RenderJobView | null }>);
        follow(now.job, true);
      } else if (!r.ok || !body.job) d.notify('error', `The HD render did not start: ${body.error ?? `${r.status} ${r.statusText}`}`);
      else follow(body.job, true);
    } catch (e) {
      d.notify('error', `The HD render did not start: ${(e as Error).message}`);
    } finally { starting = false; refresh(); }
  };
  for (const b of go) b.addEventListener('click', () => void start(b.dataset.hd === 'here' ? d.player.time : null));
  cancel.addEventListener('click', async () => {
    if (!job) return;
    watched = false;
    const r = await fetch(`${base}/api/render/jobs/${encodeURIComponent(job.id)}`, { method: 'DELETE' }).catch(() => null);
    if (r?.ok) follow((await r.json()) as RenderJobView, false);
  });

  // The dev API's render jobs: the section shows only when they answer.
  (async () => {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 1500);
    try {
      const r = await fetch(`${base}/api/render/jobs`, { cache: 'no-store', signal: ctl.signal });
      if (!r.ok) return;
      const body = (await r.json()) as { job?: RenderJobView | null };
      if (!('job' in body)) return;
      section.hidden = false;
      onReady();
      follow(body.job ?? null, true);
    } catch { /* no dev server: recording only */ } finally { clearTimeout(t); }
  })();
  return { refresh };
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
      ${d.renderCommand ? `<p class="dim small" data-render-command>A frame-exact HD video instead:<br><code>${d.renderCommand}</code></p>` : ''}
      <section class="hd" hidden style="display:grid;grid-template-columns:minmax(0,1fr);gap:8px;border-top:1px solid var(--line);padding-top:10px">
        <p class="menu-title">HD master</p>
        <button type="button" class="rec-go" data-hd="song">Render HD master (on this computer) <span class="rec-size">whole song, 2560×1440 at 60 fps</span></button>
        <button type="button" class="rec-go" data-hd="here">Render HD master: from the playhead</button>
        <p class="dim small">Drawn frame by frame from the show as it is now (saved or not), with a smaller copy to send in WhatsApp. It takes a while, often longer than the song; the studio stays usable meanwhile.</p>
        <div class="hd-job" hidden aria-live="polite" style="display:grid;grid-template-columns:minmax(0,1fr);gap:6px">
          <progress max="1" value="0" style="width:100%;accent-color:var(--on)"></progress>
          <p class="small hd-msg" style="overflow-wrap:anywhere"></p>
          <ul class="hd-files small" style="margin:0;padding-left:18px;overflow-wrap:anywhere"></ul>
          <button type="button" data-hd-cancel hidden>Cancel the render</button>
        </div>
        ${d.renderCommand ? `<p class="dim small">Or in a terminal, with more choices:<br><code style="white-space:normal;overflow-wrap:anywhere">${d.renderCommand} --scale 2</code></p>` : ''}
      </section>
    </div>`;
  const ind = document.createElement('div');
  ind.className = 'rec-ind';
  ind.hidden = true;
  ind.innerHTML = '<span class="rec-dot" aria-hidden="true"></span><span class="rec-text" aria-live="off"></span><button type="button" data-stop>Stop and save</button>';
  d.host.insertBefore(wrap, d.before);
  d.host.insertBefore(ind, wrap);

  const btn = wrap.querySelector<HTMLButtonElement>('[data-export]')!, menu = wrap.querySelector<HTMLElement>('.export-menu')!;
  const text = ind.querySelector<HTMLElement>('.rec-text')!;
  const badge = document.createElement('span');
  badge.className = 'hd-badge small';
  badge.hidden = true;
  btn.append(badge);
  // The menu opens upward: once the HD section shows a job it can be taller than the room above the button, so it
  // scrolls instead of leaving the window.
  const fit = () => {
    if (menu.hidden) return;
    menu.style.maxHeight = ''; menu.style.overflowY = ''; menu.style.gridTemplateColumns = '';
    const r = menu.getBoundingClientRect();
    if (r.top < 8) {
      menu.style.maxHeight = `${Math.max(160, r.height + r.top - 8)}px`;
      menu.style.overflowY = 'auto';
      menu.style.gridTemplateColumns = 'minmax(0, 1fr)';   // the scrollbar's width comes out of the content, not beside it
    }
  };
  // The HD master, when the dev API runs render jobs: its section replaces the terminal command's line.
  const hd = mountHd(d, menu.querySelector<HTMLElement>('.hd')!, badge, () => menu.querySelector('[data-render-command]')?.remove(), fit);
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
    if (on) { sizes(); hd.refresh(); fit(); }
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
