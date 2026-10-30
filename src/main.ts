/**
 * The app: one loop that hears the music and shows it.
 *
 *   engine.analyze() → clock.advance() → character.update() → feed.frame(song time)
 *   → directives: the song's script (ScriptPlayer) or the live director
 *   → overrides (what the user pinned or paused) → stage.render()
 *
 * The stage (WebGL2) is the picture by default; the Classic v1 scenes (Canvas2D)
 * run instead when picked in the Tweak drawer, or when the browser can't run the
 * stage (no WebGL2, or a lost GPU context). `?classic=1` forces that fallback.
 */
import './style.css';
import { AudioEngine, type DecodedTrack } from './audio/engine';
import { NOTE_NAMES } from './audio/features';
import { fingerprint } from './audio/fingerprint';
import { ChangeDetector } from './audio/structure';
import { STUDIES } from './audio/studies';
import { CharacterEngine, midiEvent, midiHeight } from './character/character';
import type { SoundEvent } from './character/types';
import { applyMapping, type Motion } from './mapping';
import {
  MIRRORS, SCENE_IDS, loadCurrentLook, loadSavedLooks, storeCurrentLook, storeSavedLooks, surpriseLook,
  cloneLook, type Look, type SavedLook,
} from './settings';
import { hydrateIcons, setIcon } from './ui/icons';
import { Panel, paintRange, type SceneChoice } from './ui/panel';
import { PALETTES, hsl, soundColor } from './visual/color';
import { Recorder, download, stamp } from './visual/recorder';
import { Renderer } from './visual/renderer';
import { MidiController, type MidiCallbacks, type MidiTarget } from './control/midi';
import { KeySynth } from './control/keysynth';
import { MidiPanel } from './ui/midi-panel';
import { MOTIONS } from './mapping';
import { fifthsPosition } from './visual/color';
import { MusicClock } from './stage/clock';
import { findByFingerprint, findByStudy } from './stage/corpus';
import { LiveDirector, type Change, type Streams } from './stage/director';
import { SongFeed } from './stage/feed';
import { LIBRARY } from './stage/library';
import { Overrides, stageLook } from './stage/overrides';
import { ScriptPlayer } from './stage/player';
import { normalizeSpec } from './stage/script';
import { Stage } from './stage/stage';
import { DEFAULT_LOOK as STAGE_LOOK, type MelodyFrame, type StageDirectives, type StudyId } from './stage/types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const body = document.body;

hydrateIcons();

// Testing the fallback: behave as a browser without WebGL2.
if (new URLSearchParams(location.search).get('classic') === '1') Stage.supported = () => false;

const engine = new AudioEngine();
const classicCanvas = $<HTMLCanvasElement>('stage');
const glCanvas = $<HTMLCanvasElement>('stage-gl');
const renderer = new Renderer(classicCanvas);
let look: Look = loadCurrentLook();
let saved: SavedLook[] = loadSavedLooks();
let motion = {} as Motion;
let recorder: Recorder | null = null;
/** Music time: the picture moves only while there is music (or a key / tap pokes it). */
const clock = new MusicClock();
let clockPoke = 0;
const character = new CharacterEngine();
const overrides = new Overrides();

/** The stage, or null where it can't run (then the picture is Classic for good). */
let stage: Stage | null = null;
/** What the user chose to see: the show ('auto'), a held library scene, or 'classic'. */
let choice: SceneChoice = 'auto';
const classicMode = () => !stage || choice === 'classic';

// ---------- Look ----------

const SCENE_NAMES: Record<string, string> = { bloom: 'Bloom', swarm: 'Swarm', ribbons: 'Ribbons', pulse: 'Pulse' };
const describe = (l: Look) =>
  `${PALETTES.find((p) => p.id === l.palette)?.name} ${SCENE_NAMES[l.scene]}${l.mirror > 1 ? ` ×${l.mirror}` : ''}`;

/**
 * `what` says where the change came from. Any change of palette, trails, drift or
 * mirror (drawer, keys, MIDI knobs, Surprise, a saved look) pins it over the show
 * for the rest of the song; picking a Classic scene switches to Classic.
 */
function applyLook(next: Look, what = 'all') {
  const prev = look;
  look = next;
  if (what !== 'init') {
    if (next.palette !== prev.palette) overrides.pin('palette');
    if (next.trails !== prev.trails) overrides.pin('trails');
    if (next.drift !== prev.drift) overrides.pin('warp');
    if (next.mirror !== prev.mirror) overrides.pin('mirror');
  }
  engine.extractor.sensitivity = 0.75 + look.wild * 0.7;
  storeCurrentLook(look);
  if (what === 'scene' || (what === 'midi' && next.scene !== prev.scene)) {
    chooseScene('classic');
    toast(SCENE_NAMES[look.scene]);
  } else panel.sync(look);
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
  stageScene: (c) => chooseScene(c),
});
panel.renderSaved(saved);
applyLook(look, 'init');

function surprise() {
  applyLook(surpriseLook(look));
  toast(`Surprise: ${describe(look)}`);
}

// ---------- Toast ----------

let toastTimer = 0;
/** Until when an important toast (`hold` ms) keeps the ordinary ones from replacing it. */
let toastHeld = 0;
function toast(text: string, hold = 0) {
  if (!hold && performance.now() < toastHeld) return;
  if (hold) toastHeld = performance.now() + hold;
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), hold || 1800);
}

// ---------- Scene choice: the show, a held scene, or Classic ----------

/**
 * 'auto' gives the stage back to the script or the director; a library scene
 * pauses them and holds that scene's cast; 'classic' pauses them and shows the
 * v1 renderer. Held scenes last until the track changes, Classic until undone.
 */
function chooseScene(c: SceneChoice) {
  // Without a stage, Classic is no choice: the show keeps running (the badge still tells it).
  if (c === 'auto' || !stage) overrides.resume();
  else if (c === 'classic') overrides.pauseScript();
  else {
    const lib = LIBRARY.find((s) => s.name === c);
    if (!lib) return;
    overrides.pauseScript({ scene: lib.name, cast: lib.elements.map((e) => ({ spec: normalizeSpec(e), presence: 1 })) });
    toast(lib.name);
  }
  choice = stage ? c : 'classic';
  body.classList.toggle('classic', classicMode());
  panel.syncScene(choice, look, !stage);
}

const FALLBACK = "Your browser can't run the full stage — showing Classic";
let fallbackPending = false;

/** No WebGL2, or the GPU context was lost: Classic from now on, and say so (once the welcome screen is gone). */
function fallBack() {
  stage?.dispose();
  stage = null;
  chooseScene('classic');
  if (body.classList.contains('welcoming')) fallbackPending = true;
  else toast(FALLBACK, 4000);
}

if (Stage.supported()) {
  try {
    stage = new Stage(glCanvas);
    stage.onContextLost = fallBack;
  } catch (e) {
    console.warn('[stage] could not start', e);
  }
}
if (!stage) fallBack();
else chooseScene('auto');

// ---------- The show: what runs the stage for this track ----------

/** A composed script for the current track (a corpus recording, or a study's first loop). */
let show: { title: string; player: ScriptPlayer } | null = null;
let feed = SongFeed.live(engine.ctx.sampleRate);
let feedLive = true;
const director = new LiveDirector();
const changes = new ChangeDetector();
const EMPTY: StageDirectives = { source: 'live', scene: '', look: STAGE_LOOK, cast: [], accents: [] };
/** The director's last word: held while paused or silent (it must not run then). */
let liveDirectives = EMPTY;
/** What the stage was last handed (for end-to-end checks). */
let shown = EMPTY;
/** A structure change the director has not seen yet (it may arrive in a rest). */
let pendingChange: Change | null = null;
/** Fraction of the last ~2 s with a voiced melody. */
let voiced = 0;
/** The melody the stage drew last frame (with MIDI keys): the character engine reads the tune's register from it. */
let lastMelody: MelodyFrame | null = null;
/** Which study pass the feed and the show were built for ('' = none). */
let studyKey = '';
/** Bumped on every track change, so a slow fingerprint lookup for a track we have left is dropped. */
let trackGen = 0;
let trackKey = '';

function newTrack() {
  trackGen++;
  show = null;
  feed = SongFeed.live(engine.ctx.sampleRate);
  feedLive = true;
  studyKey = '';
  clock.reset(); // the stage starts afresh when music time goes back
  director.reset();
  changes.reset();
  liveDirectives = EMPTY;
  pendingChange = null;
  voiced = 0;
  lastMelody = null;
  // Pins and held scenes last for one song; Classic stays until undone.
  overrides.reset();
  chooseScene(choice === 'classic' ? 'classic' : 'auto');
}

// Before the first playFiles: the engine only calls listeners present when a track loads.
engine.onTrackDecoded((t: DecodedTrack) => {
  const gen = trackGen;
  void findByFingerprint(fingerprint(t.mono, t.sampleRate))
    .then(async (entry) => {
      const data = entry?.data && (await entry.data());
      if (!entry || !data || gen !== trackGen) return;
      show = { title: entry.script.title, player: new ScriptPlayer(entry.script, data) };
      feed = SongFeed.fromData(data);
      feedLive = false;
    })
    .catch((e) => console.warn('[corpus] lookup failed', e));
});

/**
 * A study plays from its own score: exact notes, a feed rebuilt every pass (later
 * passes are re-composed), and its script only on the first pass, which is the
 * one composed from the pinned seed. Returns the study's local song time.
 */
function followStudy(): number | null {
  const st = engine.study;
  if (!st) return null;
  const key = `${st.id}:${st.seed}:${st.loop}`;
  if (key !== studyKey) {
    studyKey = key;
    const def = STUDIES.find((s) => s.id === st.id)!;
    feed = SongFeed.fromScore(st.score, def.melodyVoices, def.melodyCluster);
    feedLive = false;
    const entry = st.loop === 0 ? findByStudy(st.id, st.seed) : null;
    show = entry ? { title: entry.script.title, player: new ScriptPlayer(entry.script) } : null;
  }
  return engine.songTime - st.loopStart;
}

// ---------- Sources & transport ----------

/** The Demo button's playlist: the four character studies, then the groove. */
const DEMOS: (StudyId | 'groove')[] = [...STUDIES.map((s) => s.id), 'groove'];
let demoIndex = 0;

async function playDemo(i: number) {
  demoIndex = (i + DEMOS.length) % DEMOS.length;
  const id = DEMOS[demoIndex];
  if (id === 'groove') await engine.playDemo();
  else await engine.playStudy(id);
}

/** Previous / next: through the demo playlist, or the file queue. */
function step(dir: 1 | -1) {
  if (engine.source === 'demo') void playDemo(demoIndex + dir);
  else if (dir > 0) engine.next();
  else engine.prev();
}

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
    await playDemo(engine.source === 'demo' ? demoIndex : 0);
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
  if (fallbackPending) {
    fallbackPending = false;
    toast(FALLBACK, 4000);
  }
  poke();
}

document.querySelectorAll<HTMLElement>('[data-start]').forEach((b) => b.addEventListener('click', () => start(b.dataset.start!)));
document.querySelectorAll<HTMLElement>('[data-src]').forEach((b) => b.addEventListener('click', () => start(b.dataset.src!)));

$('play').addEventListener('click', () => {
  if (engine.source === 'none') void start('demo');
  else void engine.togglePlay();
});
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
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
  // A track change (not play/pause, which also lands here): start the show afresh.
  const key = s.source === 'file' ? `file:${s.trackIndex}:${s.title}` : s.source === 'demo' ? `demo:${s.title}` : s.source;
  if (key !== trackKey) {
    trackKey = key;
    newTrack();
  }
  document.querySelectorAll<HTMLElement>('[data-src]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.src === s.source)));
  setIcon($('play'), s.playing && s.source !== 'mic' ? 'pause' : 'play');
  $('play').toggleAttribute('disabled', s.source === 'mic');
  const demo = s.source === 'demo';
  $('track-title').textContent =
    demo ? `${s.title}  ·  ${demoIndex + 1}/${DEMOS.length}`
    : s.title ? (s.trackCount > 1 ? `${s.title}  ·  ${s.trackIndex + 1}/${s.trackCount}` : s.title)
    : 'Nothing playing — pick a sound';
  $<HTMLButtonElement>('prev').disabled = s.source !== 'file' && !demo;
  $<HTMLButtonElement>('next').disabled = !demo && (s.source !== 'file' || s.trackCount < 2);
  $('progress').classList.toggle('live', s.source === 'mic' || demo);
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

const toCenter = (e: PointerEvent) => ({
  x: e.clientX - window.innerWidth / 2 - renderer.offsetTarget,
  y: e.clientY - window.innerHeight / 2,
});
/** The pointer for the stage: normalized (0..1, y down); velocity is worked out per frame. */
const pointer = { x: 0.5, y: 0.5, dx: 0, dy: 0, down: false };
const pointerWas = { x: 0.5, y: 0.5 };
const track = (e: PointerEvent) => {
  pointer.x = e.clientX / window.innerWidth;
  pointer.y = e.clientY / window.innerHeight;
};
const release = () => {
  renderer.pointer.down = false;
  pointer.down = false;
};

// Only the visible canvas gets events (the other is visibility: hidden).
for (const canvas of [classicCanvas, glCanvas]) {
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = toCenter(e);
    Object.assign(renderer.pointer, p, { down: true });
    track(e);
    pointer.down = true;
    clockPoke = 1;
    if (classicMode()) renderer.burst(p.x, p.y, look, engine.extractor.features, motion);
  });
  canvas.addEventListener('pointermove', (e) => {
    Object.assign(renderer.pointer, toCenter(e));
    track(e);
  });
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      renderer.userZoom = Math.max(0.4, Math.min(3, renderer.userZoom * Math.exp(-e.deltaY * 0.001)));
    },
    { passive: false },
  );
}

// ---------- Tools ----------

$('snapshot').addEventListener('click', async () => {
  const blob = await (stage && !classicMode() ? stage.snapshot() : renderer.snapshot());
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
  // Records the picture showing now (switching Classic ↔ stage mid-recording keeps this one).
  recorder = new Recorder(classicMode() ? classicCanvas : glCanvas, engine.recordTap.stream);
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

// The badge resumes a paused show.
$('mode-badge').addEventListener('click', () => {
  if (overrides.scriptPaused) {
    chooseScene('auto');
    toast(show ? `Back to the script: ${show.title}` : 'Back to the live show');
  }
});

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
    step(1);
  } else if (k === 'arrowleft') {
    step(-1);
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

// ---------- MIDI: knobs drive the look, keys play the picture ----------

const MIDI_TARGETS: MidiTarget[] = [
  { id: 'wild', label: 'Mood', kind: 'continuous' },
  { id: 'trails', label: 'Trails', kind: 'continuous' },
  { id: 'drift', label: 'Drift', kind: 'continuous' },
  { id: 'mirror', label: 'Mirror', kind: 'continuous' },
  { id: 'scene', label: 'Scene', kind: 'continuous' },
  { id: 'palette', label: 'Colors', kind: 'continuous' },
  { id: 'volume', label: 'Volume', kind: 'continuous' },
  ...MOTIONS.map((m) => ({ id: `map.${m.id}`, label: `${m.label} amount`, kind: 'continuous' as const })),
  { id: 'surprise', label: 'Surprise me', kind: 'trigger' },
  { id: 'play', label: 'Play / pause', kind: 'trigger' },
  { id: 'scene.next', label: 'Next scene', kind: 'trigger' },
  { id: 'mirror.next', label: 'Next mirror', kind: 'trigger' },
  { id: 'save', label: 'Save look', kind: 'trigger' },
  { id: 'snapshot', label: 'Save picture', kind: 'trigger' },
];

/** Picks from a list with a 0..1 knob. */
const pick = <T,>(xs: readonly T[], v: number) => xs[Math.min(xs.length - 1, Math.floor(v * xs.length))];

// The keys' voice goes through its own gain (mutable without dropping visuals) into the
// engine's input: heard, recorded, and analysed like any other sound.
const keyBus = engine.ctx.createGain();
keyBus.connect(engine.input);
const keySynth = new KeySynth(engine.ctx, keyBus);
let bend = 0;
/** Keys held down (note → velocity), most recent last: the latest one is the tune. */
const held = new Map<number, number>();
/** Played keys since the last frame, as sound events for the stage. */
const keyEvents: SoundEvent[] = [];
let keyDown = false;
/** Music time when the sounding key went down. */
let keyStart = 0;

/** Lets go of every key: a device unplugged mid-note never sends its note-offs. */
function releaseKeys() {
  held.clear();
  keySynth.allOff();
}
let midiDevices = 0;

/** While no song melody is voiced, the held key is the melody. */
function keyMelody(): MelodyFrame | null {
  const last = [...held].pop();
  if (!last) return null;
  const [note, velocity] = last;
  return {
    pitch: note + bend * 2, voiced: true, salience: 0.35 + 0.65 * velocity, noteOn: keyDown,
    note: { start: keyStart, end: Infinity, midi: note, strength: velocity, confidence: 1 },
  };
}

// Knob turns arrive faster than the screen redraws: coalesce look changes per frame.
let pendingLook: Look | null = null;
const tweak = (fn: (l: Look) => void) => {
  const next = pendingLook ?? cloneLook(look);
  fn(next);
  pendingLook = next;
};

const midiCallbacks: MidiCallbacks = {
  control(id, v) {
    if (id === 'wild' || id === 'trails' || id === 'drift') tweak((l) => (l[id] = v));
    else if (id === 'mirror') tweak((l) => (l.mirror = pick(MIRRORS, v)));
    else if (id === 'scene') tweak((l) => (l.scene = pick(SCENE_IDS, v)));
    else if (id === 'palette') tweak((l) => (l.palette = pick(PALETTES, v).id));
    else if (id === 'volume') {
      volume.value = String(v);
      paintRange(volume);
      engine.setVolume(v);
    } else if (id.startsWith('map.')) {
      const motion = id.slice(4) as keyof Look['mapping'];
      tweak((l) => (l.mapping[motion].amount = v));
    }
  },
  trigger(id) {
    if (id === 'surprise') surprise();
    else if (id === 'play') $('play').click();
    else if (id === 'scene.next') applyLook({ ...cloneLook(look), scene: SCENE_IDS[(SCENE_IDS.indexOf(look.scene) + 1) % SCENE_IDS.length] }, 'scene');
    else if (id === 'mirror.next') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    else if (id === 'save') $('save-look').click();
    else if (id === 'snapshot') $('snapshot').click();
  },
  note(note, velocity) {
    if (velocity === 0) {
      keySynth.noteOff(note);
      held.delete(note);
      return;
    }
    void engine.ctx.resume();
    if (midiPanel.soundOn) keySynth.noteOn(note, velocity);
    held.delete(note);
    held.set(note, velocity);
    keyDown = true;
    keyStart = clock.time;
    keyEvents.push(midiEvent(note, velocity, character.material()));
    if (keyEvents.length > 16) keyEvents.shift();
    if (classicMode()) {
      // Where a note lands: its color's place on the wheel sets x, its height sets y.
      const height = Math.max(0, Math.min(1, (note - 21) / 87));
      const x = (fifthsPosition(note % 12) - 0.5) * window.innerWidth * 0.7;
      const y = (0.5 - height) * window.innerHeight * 0.8;
      renderer.burst(x, y, look, engine.extractor.features, motion, note % 12, velocity);
    }
    clockPoke = Math.max(clockPoke, velocity);
    poke();
  },
  bend(v) {
    bend = v;
  },
  sustain(down) {
    keySynth.sustain(down);
  },
  changed() {
    if (midi.devices.length < midiDevices) releaseKeys();
    midiDevices = midi.devices.length;
    midiPanel?.render();
  },
  learned(id, source) {
    toast(`${midi.targetLabel(id)} ← ${source.kind === 'cc' ? `CC ${source.number}` : 'key'}`);
  },
};
const midi = new MidiController(MIDI_TARGETS, midiCallbacks);
const midiPanel = new MidiPanel(midi, MIDI_TARGETS);
$<HTMLInputElement>('midi-sound').addEventListener('change', (e) => {
  if (!(e.target as HTMLInputElement).checked) keySynth.allOff();
});
// If the browser already granted MIDI before, connect quietly at start.
void navigator.permissions?.query({ name: 'midi' as PermissionName }).then(
  (p) => p.state === 'granted' && midi.connect(),
  () => {},
);

// ---------- Main loop ----------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : Number.isFinite(x) ? x : 0);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** melodyVoiced: an average over about this many seconds. */
const VOICED_TAU = 2;
const wave = new Float32Array(2048);

/** The stage's directives this frame: the script, or the director (only while music plays), then the user's overrides. */
function directives(songTime: number, melody: MelodyFrame, dt: number): StageDirectives {
  const s = engine.state;
  const d = engine.descriptors;
  const f = engine.extractor.features;
  if (s.playing) {
    // Structure runs on the playback position, through rests: a break must stay in its windows.
    const c = changes.update(
      { chroma: f.chroma, loudness: d.loudness, register: d.register, brightness: d.brightness, onsetRate: d.onsetRate, sustain: d.sustain },
      f.bass,
      engine.songTime,
    );
    if (c) pendingChange = c;
  }
  let dir: StageDirectives;
  if (show) dir = show.player.at(songTime);
  else {
    // Played keys count as music even with nothing playing (the clock is poked, not driven, by them).
    if ((s.playing && clock.silentFor === 0) || held.size > 0) {
      voiced += ((melody.voiced ? 1 : 0) - voiced) * (1 - Math.exp(-dt / VOICED_TAU));
      const streams: Streams = {
        melodyVoiced: voiced,
        bass: clamp01(f.bass),
        pulse: clamp01(d.pulseClarity),
        // Quick notes up high: onset rate, counted once the music (or its tune) sits high.
        highActivity: clamp01(d.onsetRate) * smoothstep(0.45, 0.7, Math.max(d.register, melody.voiced ? midiHeight(melody.pitch) : 0)),
      };
      liveDirectives = director.update(lastCharacter, streams, pendingChange, dt);
      pendingChange = null;
    }
    dir = liveDirectives;
  }
  return overrides.apply(dir, stageLook(look));
}

let lastCharacter = character.update(engine.descriptors, null, engine.extractor.features, 1 / 60, 0);
let badgeText = '';
let classicDim = 1;
let last = performance.now();
let hudBpm = '';
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const f = engine.analyze();
  if (pendingLook) {
    applyLook(pendingLook, 'midi');
    pendingLook = null;
  }
  motion = applyMapping(f, look.mapping, look.wild, motion);
  // Pitch bend leans into the picture.
  motion.zoom += Math.max(0, bend) * 1.5;
  motion.spin += bend * 0.8;
  const d = engine.descriptors;
  const musicDt = clock.advance({
    level: d.loudness, // absolute-ish: auto-gained f.level reads steady room noise as loud
    onset: f.onset ? f.onsetStrength : 0,
    flux: 0.5 * (d.harmonicChange + d.pitchMotion),
    // A pause is known, not inferred: the detector's ~2.5 s wait (to tell a rest from the end)
    // would let the picture glide on after the sound stopped. Played keys still count as sound.
    silence: engine.state.playing || held.size > 0 ? d.silence : 1,
    poke: clockPoke,
  }, dt);
  clockPoke = 0;
  // The tune's register comes from last frame's melody (the feed runs after the character engine).
  const ch = (lastCharacter = character.update(d, null, f, dt, musicDt, lastMelody));

  // Song streams: a study's own score, a corpus recording's data, or live analysis.
  const songTime = followStudy() ?? engine.songTime;
  const fr = feed.frame(songTime, engine.chain.spectrum.magnitudes, f, d);
  // A paused song stands still on its last note (live tracker or score alike), but that note
  // isn't sounding: it is no tune, and the keys played over the pause must be the melody.
  const song = engine.state.playing ? fr.melody : { ...fr.melody, voiced: false, noteOn: false };
  const melody = song.voiced ? song : keyMelody() ?? song;
  keyDown = false;
  lastMelody = melody;
  const events = feedLive ? character.events(f, d) : fr.events;
  if (keyEvents.length) events.push(...keyEvents.splice(0));
  const dir = (shown = directives(songTime, melody, dt));

  if (!classicMode() && stage) {
    engine.pcm.latest(wave);
    pointer.dx = dt > 0 ? (pointer.x - pointerWas.x) / dt : 0;
    pointer.dy = dt > 0 ? (pointer.y - pointerWas.y) / dt : 0;
    stage.render({
      dt, musicDt, clock: { time: clock.time, drive: clock.drive, dim: clock.dim },
      f, d, character: ch, material: character.material(), gesture: character.gesture(),
      melody, events, beat: fr.beat, chroma: f.chroma, wave, wild: look.wild, pointer, directives: dir,
    });
  } else {
    // Classic scenes move on music time; their trails keep fading on wall time (frozen, the
    // additive feedback would only build up), and the picture dims in silence like the stage.
    renderer.render({ ...f, time: clock.time }, motion, look, dt);
    if (Math.abs(clock.dim - classicDim) > 0.005) classicCanvas.style.opacity = String((classicDim = clock.dim));
  }
  pointerWas.x = pointer.x;
  pointerWas.y = pointer.y;

  // The badge: who runs the show, and the mood in words.
  const head = show ? (overrides.scriptPaused ? 'Scripted · paused' : `Scripted · ${show.title}`) : overrides.scriptPaused ? 'Live · paused' : 'Live';
  const words = ch.words.join(' · ');
  const text = `${head}|${words}`;
  if (text !== badgeText) {
    badgeText = text;
    $('mode-name').textContent = head;
    $('mode-words').textContent = words ? ` · ${words}` : '';
    $('mode-badge').classList.toggle('paused', overrides.scriptPaused);
  }

  const palette = PALETTES.find((p) => p.id === look.palette) ?? PALETTES[0];
  const noteColor = hsl(soundColor(palette, f.note, 1, 0.8));
  body.style.setProperty('--note', noteColor);
  $('note-name').textContent = f.level > 0.05 ? NOTE_NAMES[f.note] : '–';
  $('beat-light').style.opacity = String(0.15 + f.beat * 0.85);
  const bpm = f.bpm ? `${f.bpm} BPM` : '– BPM';
  if (bpm !== hudBpm) $('bpm').textContent = hudBpm = bpm;

  // Give the Classic art the free space beside the drawer while it's showing.
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

// Handy for debugging, the screenshot script and end-to-end checks (`note` plays a MIDI key).
Object.assign(window, {
  winkel: {
    engine, renderer, clock, character, overrides, applyLook, getLook: () => look, start, chooseScene,
    stage: () => stage, directives: () => shown, melody: () => lastMelody, mode: () => (classicMode() ? 'classic' : 'stage'), show: () => show?.title ?? null,
    note: (n: number, velocity = 0.8) => midiCallbacks.note(n, velocity),
  },
});
