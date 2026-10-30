/**
 * MIDI control: knobs and faders drive the look, keys play the picture.
 *
 * - Any CC (or note) can be bound to any control by "MIDI learn": arm a control,
 *   then move a knob.
 * - Common controller conventions work out of the box (mod wheel → Mood, …).
 * - Keys emit note events (with velocity) that the visuals turn into light, and
 *   that an optional built-in synth can sound — so the analysis hears you too.
 *
 * Message parsing and binding logic are pure (no Web MIDI) so they're unit-tested.
 */

/** A physical control on a MIDI device. Channel-agnostic: a knob is a knob on any channel. */
export type MidiSource = { kind: 'cc'; number: number } | { kind: 'note'; number: number };

export type MidiMessage =
  | { type: 'cc'; channel: number; number: number; value: number }
  | { type: 'noteon'; channel: number; note: number; velocity: number }
  | { type: 'noteoff'; channel: number; note: number }
  | { type: 'bend'; channel: number; value: number }
  | { type: 'other' };

/** Parses raw MIDI bytes. Values are normalized: cc/velocity 0..1, bend -1..1. */
export function parseMidi(data: ArrayLike<number>): MidiMessage {
  const status = data[0] ?? 0;
  const type = status & 0xf0;
  const channel = status & 0x0f;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;
  switch (type) {
    case 0x90:
      // Note-on with velocity 0 is a note-off by convention.
      return d2 === 0 ? { type: 'noteoff', channel, note: d1 } : { type: 'noteon', channel, note: d1, velocity: d2 / 127 };
    case 0x80:
      return { type: 'noteoff', channel, note: d1 };
    case 0xb0:
      return { type: 'cc', channel, number: d1, value: d2 / 127 };
    case 0xe0:
      return { type: 'bend', channel, value: Math.max(-1, (((d2 << 7) | d1) - 8192) / 8191) };
    default:
      return { type: 'other' };
  }
}

export const sourceKey = (s: MidiSource) => `${s.kind}:${s.number}`;
export const sourceLabel = (s: MidiSource) => (s.kind === 'cc' ? `CC ${s.number}` : `Key ${noteName(s.number)}`);

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const noteName = (n: number) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

/**
 * What a binding drives. Continuous targets get 0..1; trigger targets fire on a
 * note-on or when a CC crosses upward through the middle (buttons send 127/0).
 */
export interface MidiTarget {
  id: string;
  label: string;
  kind: 'continuous' | 'trigger';
}

/** Bindings that work without any setup, following common controller conventions. */
export const DEFAULT_BINDINGS: Record<string, string> = {
  'cc:1': 'wild', // mod wheel
  'cc:7': 'volume', // channel volume fader
  'cc:74': 'trails', // "brightness/cutoff" knob on most synths
  'cc:71': 'drift', // "resonance" knob
  'cc:91': 'map.glow', // reverb send
};

export interface BindingStore {
  /** source key → target id */
  bindings: Record<string, string>;
}

/** Pure binding table: learn, lookup, persistence format. */
export class MidiBindings {
  bindings: Record<string, string>;
  private armed: string | null = null;

  constructor(initial: Record<string, string> = DEFAULT_BINDINGS) {
    this.bindings = { ...initial };
  }

  /** Arms MIDI learn for a target; the next CC or key gets bound to it. Calling again cancels. */
  arm(targetId: string | null) {
    this.armed = this.armed === targetId ? null : targetId;
  }

  get armedTarget() {
    return this.armed;
  }

  /**
   * Offers an incoming source. Returns the target id it now drives (learning if
   * armed), or null if it's unbound.
   */
  route(source: MidiSource): { target: string | null; learned: boolean } {
    const key = sourceKey(source);
    if (this.armed) {
      // One source drives one target, and a target listens to one source.
      for (const k of Object.keys(this.bindings)) if (this.bindings[k] === this.armed) delete this.bindings[k];
      this.bindings[key] = this.armed;
      const target = this.armed;
      this.armed = null;
      return { target, learned: true };
    }
    return { target: this.bindings[key] ?? null, learned: false };
  }

  /** Which source drives this target, if any. */
  sourceOf(targetId: string): MidiSource | null {
    for (const [k, t] of Object.entries(this.bindings)) {
      if (t !== targetId) continue;
      const [kind, num] = k.split(':');
      return { kind: kind as 'cc' | 'note', number: Number(num) };
    }
    return null;
  }

  unbind(targetId: string) {
    for (const k of Object.keys(this.bindings)) if (this.bindings[k] === targetId) delete this.bindings[k];
  }

  reset() {
    this.bindings = { ...DEFAULT_BINDINGS };
    this.armed = null;
  }
}

export interface MidiCallbacks {
  /** A bound continuous control moved. */
  control(targetId: string, value: number): void;
  /** A bound trigger fired. */
  trigger(targetId: string): void;
  /** A key that isn't bound to anything was pressed or released (velocity 0 = released). */
  note(note: number, velocity: number): void;
  /** Pitch bend, -1..1. */
  bend(value: number): void;
  /** Sustain pedal (CC 64), when it isn't bound to something else. */
  sustain?(down: boolean): void;
  /** Something changed: devices, bindings, learn state. */
  changed(): void;
  /** MIDI learn just bound a source to a target. */
  learned(targetId: string, source: MidiSource): void;
}

const STORE_KEY = 'winkelamp.midi.v1';

/** Glue between Web MIDI and the bindings. */
export class MidiController {
  readonly bindings: MidiBindings;
  devices: string[] = [];
  status: 'unsupported' | 'idle' | 'denied' | 'ready' = 'idle';
  private access: MIDIAccess | null = null;
  private targets = new Map<string, MidiTarget>();
  /** Last value per CC, to detect button presses (rising edge through the middle). */
  private lastCc = new Map<number, number>();

  constructor(targets: MidiTarget[], private cb: MidiCallbacks) {
    for (const t of targets) this.targets.set(t.id, t);
    let saved: Record<string, string> | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    } catch {
      /* fall back to defaults */
    }
    this.bindings = new MidiBindings(saved ?? DEFAULT_BINDINGS);
    if (!('requestMIDIAccess' in navigator)) this.status = 'unsupported';
  }

  /** Asks for MIDI access. Safe to call repeatedly. */
  async connect(): Promise<boolean> {
    if (this.status === 'unsupported') return false;
    if (this.access) return true;
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch {
      this.status = 'denied';
      this.cb.changed();
      return false;
    }
    this.status = 'ready';
    this.access.onstatechange = () => this.attach();
    this.attach();
    return true;
  }

  private attach() {
    if (!this.access) return;
    this.devices = [];
    this.access.inputs.forEach((input) => {
      if (input.state === 'disconnected') return;
      this.devices.push(input.name || 'MIDI device');
      input.onmidimessage = (e) => e.data && this.handle(parseMidi(e.data));
    });
    this.cb.changed();
  }

  arm(targetId: string | null) {
    this.bindings.arm(targetId);
    this.cb.changed();
  }

  unbind(targetId: string) {
    this.bindings.unbind(targetId);
    this.save();
    this.cb.changed();
  }

  resetBindings() {
    this.bindings.reset();
    this.save();
    this.cb.changed();
  }

  private save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.bindings.bindings));
    } catch {
      /* not persisted */
    }
  }

  /** Feeds one parsed message through the bindings. Public so it can be driven without hardware. */
  handle(msg: MidiMessage) {
    if (msg.type === 'cc') {
      const prev = this.lastCc.get(msg.number) ?? 0;
      this.lastCc.set(msg.number, msg.value);
      const { target, learned } = this.bindings.route({ kind: 'cc', number: msg.number });
      if (learned && target) this.learned(target, { kind: 'cc', number: msg.number });
      if (!target) {
        if (msg.number === 64) this.cb.sustain?.(msg.value >= 0.5);
        return;
      }
      const t = this.targets.get(target);
      if (t?.kind === 'trigger') {
        if (prev < 0.5 && msg.value >= 0.5) this.cb.trigger(target);
      } else if (t) {
        this.cb.control(target, msg.value);
      }
    } else if (msg.type === 'noteon') {
      const armedBefore = this.bindings.armedTarget;
      const { target, learned } = armedBefore || this.bindings.bindings[`note:${msg.note}`]
        ? this.bindings.route({ kind: 'note', number: msg.note })
        : { target: null, learned: false };
      if (learned && target) this.learned(target, { kind: 'note', number: msg.note });
      if (target) {
        const t = this.targets.get(target);
        if (t?.kind === 'trigger') this.cb.trigger(target);
        else if (t) this.cb.control(target, msg.velocity);
        return;
      }
      this.cb.note(msg.note, msg.velocity);
    } else if (msg.type === 'noteoff') {
      if (!this.bindings.bindings[`note:${msg.note}`]) this.cb.note(msg.note, 0);
    } else if (msg.type === 'bend') {
      this.cb.bend(msg.value);
    }
  }

  private learned(target: string, source: MidiSource) {
    this.save();
    this.cb.learned(target, source);
    this.cb.changed();
  }

  targetLabel(id: string) {
    return this.targets.get(id)?.label ?? id;
  }
}
