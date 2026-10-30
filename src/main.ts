import './style.css';
import { AudioEngine } from './audio/engine';
import { NOTE_NAMES } from './audio/features';
import { applyMapping, type Motion } from './mapping';
import {
  MIRRORS, SCENE_IDS, loadCurrentLook, loadSavedLooks, storeCurrentLook, storeSavedLooks, surpriseLook,
  cloneLook, type Look, type SavedLook,
} from './settings';
import { hydrateIcons, setIcon } from './ui/icons';
import { Panel, paintRange } from './ui/panel';
import { PALETTES, hsl, soundColor } from './visual/color';
import { Recorder, download, stamp } from './visual/recorder';
import { Renderer } from './visual/renderer';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const body = document.body;

hydrateIcons();

const engine = new AudioEngine();
const renderer = new Renderer($<HTMLCanvasElement>('stage'));
let look: Look = loadCurrentLook();
let saved: SavedLook[] = loadSavedLooks();
let motion = {} as Motion;
let recorder: Recorder | null = null;

// ---------- Look ----------

const SCENE_NAMES: Record<string, string> = { bloom: 'Bloom', swarm: 'Swarm', ribbons: 'Ribbons', pulse: 'Pulse' };
const describe = (l: Look) =>
  `${PALETTES.find((p) => p.id === l.palette)?.name} ${SCENE_NAMES[l.scene]}${l.mirror > 1 ? ` ×${l.mirror}` : ''}`;

function applyLook(next: Look, what = 'all') {
  look = next;
  engine.extractor.sensitivity = 0.75 + look.wild * 0.7;
  panel.sync(look);
  storeCurrentLook(look);
  if (what === 'scene') toast(SCENE_NAMES[look.scene]);
}

const panel = new Panel(() => look, {
  change: applyLook,
  surprise,
  save() {
    const base = describe(look);
    let name = base;
    for (let n = 2; saved.some((s) => s.name === name); n++) name = `${base} ${n}`;
    saved = [...saved, { name, look: cloneLook(look) }];
    storeSavedLooks(saved);
    panel.renderSaved(saved);
    toast(`Saved “${name}”`);
  },
  recall(s) {
    applyLook(cloneLook(s.look));
    toast(s.name);
  },
  remove(i) {
    saved = saved.filter((_, j) => j !== i);
    storeSavedLooks(saved);
    panel.renderSaved(saved);
  },
});
panel.renderSaved(saved);
applyLook(look);

function surprise() {
  applyLook(surpriseLook(look));
  toast(`Surprise: ${describe(look)}`);
}

// ---------- Toast ----------

let toastTimer = 0;
function toast(text: string) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1800);
}

// ---------- Sources & transport ----------

const fileInput = $<HTMLInputElement>('file-input');
fileInput.addEventListener('change', async () => {
  const files = [...(fileInput.files ?? [])];
  fileInput.value = '';
  if (files.length) await playFiles(files);
});

async function playFiles(files: File[]) {
  const ok = await engine.playFiles(files);
  if (ok) {
    leaveWelcome();
    toast(files.length > 1 ? `${files.length} tracks queued` : 'Playing your music');
  } else {
    toast('Those don’t look like audio files');
  }
}

async function start(kind: string) {
  if (kind === 'demo') {
    await engine.playDemo();
    leaveWelcome();
  } else if (kind === 'file') {
    fileInput.click();
  } else if (kind === 'mic') {
    const ok = await engine.playMic();
    if (ok) {
      leaveWelcome();
      toast('Listening… make some noise');
    } else {
      toast('No microphone access — check your browser’s permission');
    }
  }
}

function leaveWelcome() {
  $('welcome').classList.add('gone');
  body.classList.remove('welcoming');
  poke();
}

document.querySelectorAll<HTMLElement>('[data-start]').forEach((b) => b.addEventListener('click', () => start(b.dataset.start!)));
document.querySelectorAll<HTMLElement>('[data-src]').forEach((b) => b.addEventListener('click', () => start(b.dataset.src!)));

$('play').addEventListener('click', () => {
  if (engine.source === 'none') void start('demo');
  else void engine.togglePlay();
});
$('prev').addEventListener('click', () => engine.prev());
$('next').addEventListener('click', () => engine.next());
$('progress').addEventListener('click', (e) => {
  const rect = $('progress').getBoundingClientRect();
  engine.seek((e.clientX - rect.left) / rect.width);
});

const volume = $<HTMLInputElement>('volume');
volume.addEventListener('input', () => engine.setVolume(Number(volume.value)));
engine.setVolume(Number(volume.value));
document.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.type === 'range') paintRange(t);
});
paintRange(volume);

function syncTransport() {
  const s = engine.state;
  document.querySelectorAll<HTMLElement>('[data-src]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.src === s.source)));
  setIcon($('play'), s.playing && s.source !== 'mic' ? 'pause' : 'play');
  $('play').toggleAttribute('disabled', s.source === 'mic');
  $('track-title').textContent =
    s.title ? (s.trackCount > 1 ? `${s.title}  ·  ${s.trackIndex + 1}/${s.trackCount}` : s.title) : 'Nothing playing — pick a sound';
  $<HTMLButtonElement>('prev').disabled = s.source !== 'file';
  $<HTMLButtonElement>('next').disabled = s.source !== 'file' || s.trackCount < 2;
  $('progress').classList.toggle('live', s.source === 'mic' || s.source === 'demo');
}
engine.onChange(syncTransport);
syncTransport();

// ---------- Drag & drop ----------

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  dragDepth++;
  $('drop').hidden = false;
});
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    $('drop').hidden = true;
  }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('drop').hidden = true;
  const files = [...(e.dataTransfer?.files ?? [])];
  if (files.length) void playFiles(files);
});

// ---------- Canvas interaction ----------

const stage = $<HTMLCanvasElement>('stage');
const toCenter = (e: PointerEvent) => ({
  x: e.clientX - window.innerWidth / 2 - renderer.offsetTarget,
  y: e.clientY - window.innerHeight / 2,
});

stage.addEventListener('pointerdown', (e) => {
  stage.setPointerCapture(e.pointerId);
  const p = toCenter(e);
  Object.assign(renderer.pointer, p, { down: true });
  renderer.burst(p.x, p.y, look, engine.extractor.features, motion);
});
stage.addEventListener('pointermove', (e) => Object.assign(renderer.pointer, toCenter(e)));
const release = () => (renderer.pointer.down = false);
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);
stage.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    renderer.userZoom = Math.max(0.4, Math.min(3, renderer.userZoom * Math.exp(-e.deltaY * 0.001)));
  },
  { passive: false },
);

// ---------- Tools ----------

$('snapshot').addEventListener('click', async () => {
  const blob = await renderer.snapshot();
  if (blob) {
    download(blob, `winkelamp-${stamp()}.png`);
    toast('Picture saved');
  }
});

$('record').addEventListener('click', toggleRecording);
if (!Recorder.supported()) $<HTMLButtonElement>('record').disabled = true;

async function toggleRecording() {
  const btn = $('record');
  if (recorder?.recording) {
    const blob = await recorder.stop();
    btn.classList.remove('recording');
    setIcon(btn, 'record');
    $('rec-time').textContent = '';
    download(blob, `winkelamp-${stamp()}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
    toast('Video saved');
    return;
  }
  recorder = new Recorder(stage, engine.recordTap.stream);
  recorder.start();
  btn.classList.add('recording');
  setIcon(btn, 'stop');
  toast('Recording — click again to stop');
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
}
$('fullscreen').addEventListener('click', toggleFullscreen);

const help = $<HTMLDialogElement>('help');
$('help-btn').addEventListener('click', () => help.showModal());

function setPanel(open: boolean) {
  body.classList.toggle('panel-closed', !open);
  $('panel-toggle').setAttribute('aria-expanded', String(open));
}
$('panel-close').addEventListener('click', () => setPanel(false));
$('panel-toggle').addEventListener('click', () => setPanel(true));

// ---------- Keyboard ----------

window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (e.metaKey || e.ctrlKey || e.altKey || t.tagName === 'SELECT' || help.open) return;
  const k = e.key.toLowerCase();
  if (k === ' ' && t.tagName !== 'BUTTON') {
    e.preventDefault();
    $('play').click();
  } else if (k >= '1' && k <= '4') {
    applyLook({ ...cloneLook(look), scene: SCENE_IDS[Number(k) - 1] }, 'scene');
  } else if (k === 'r') {
    surprise();
  } else if (k === 'm') {
    const i = (MIRRORS as readonly number[]).indexOf(look.mirror);
    applyLook({ ...cloneLook(look), mirror: MIRRORS[(i + 1) % MIRRORS.length] });
    toast(look.mirror === 1 ? 'Mirror off' : `${look.mirror}-way mirror`);
  } else if (k === 'h') {
    body.classList.toggle('hide-ui');
    if (body.classList.contains('hide-ui')) toast('Interface hidden — press H to bring it back');
  } else if (k === 'f') {
    toggleFullscreen();
  } else if (k === 'arrowright') {
    engine.next();
  } else if (k === 'arrowleft') {
    engine.prev();
  } else if (k === '?') {
    help.showModal();
  }
});

// ---------- Idle: the interface steps aside for the art ----------

let idleTimer = 0;
let overUi = false;
document.querySelectorAll('.ui').forEach((el) => {
  el.addEventListener('pointerenter', () => (overUi = true));
  el.addEventListener('pointerleave', () => (overUi = false));
});
function poke() {
  body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    const welcome = !$('welcome').classList.contains('gone');
    if (!overUi && !welcome && !help.open && engine.state.playing) body.classList.add('idle');
    else poke();
  }, 3500);
}
for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, poke, { passive: true });

// ---------- Main loop ----------

let last = performance.now();
let hudBpm = '';
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const f = engine.analyze();
  motion = applyMapping(f, look.mapping, look.wild, motion);
  renderer.render(f, motion, look, dt);

  const palette = PALETTES.find((p) => p.id === look.palette) ?? PALETTES[0];
  const noteColor = hsl(soundColor(palette, f.note, 1, 0.8));
  body.style.setProperty('--note', noteColor);
  $('note-name').textContent = f.level > 0.05 ? NOTE_NAMES[f.note] : '–';
  $('beat-light').style.opacity = String(0.15 + f.beat * 0.85);
  const bpm = f.bpm ? `${f.bpm} BPM` : '– BPM';
  if (bpm !== hudBpm) $('bpm').textContent = hudBpm = bpm;

  // Give the art the free space beside the panel while it's showing.
  const panelShown = !body.classList.contains('panel-closed') && !body.classList.contains('idle') &&
    !body.classList.contains('hide-ui') && !body.classList.contains('welcoming') && window.innerWidth > 900;
  renderer.offsetTarget = panelShown ? -($('panel').offsetWidth + 14) / 2 : 0;

  const s = engine.state;
  const live = s.source === 'demo' || s.source === 'mic';
  $('progress-fill').style.opacity = live ? String(0.2 + f.beat * 0.8) : '';
  if (s.source === 'file' && s.duration) $('progress-fill').style.width = `${(s.position / s.duration) * 100}%`;
  if (recorder?.recording) {
    const sec = Math.floor(recorder.seconds);
    $('rec-time').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  panel.tick(f, look);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for debugging and for the screenshot script.
Object.assign(window, { winkel: { engine, renderer, applyLook, getLook: () => look, start } });
