/**
 * A small polyphonic voice for MIDI keys: an FM electric-piano/bell tone whose
 * brightness follows velocity. Played into the engine's bus so the analysis —
 * and the character engine — hear what you play.
 */

const MAX_VOICES = 16;

interface Voice {
  note: number;
  carrier: OscillatorNode;
  mod: OscillatorNode;
  amp: GainNode;
  started: number;
}

export class KeySynth {
  private out: GainNode;
  private voices: Voice[] = [];
  private sustainHeld = false;
  private sustained = new Set<number>();

  constructor(private ctx: AudioContext, destination: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.5;
    this.out.connect(destination);
  }

  noteOn(note: number, velocity: number) {
    this.release(note, 0.02);
    if (this.voices.length >= MAX_VOICES) this.kill(this.voices[0]);
    const t = this.ctx.currentTime;
    const freq = 440 * 2 ** ((note - 69) / 12);
    const carrier = this.ctx.createOscillator();
    carrier.frequency.value = freq;
    // Modulator at 1:1 gives a warm Rhodes-like tine; index decays like a struck bar.
    const mod = this.ctx.createOscillator();
    mod.frequency.value = freq;
    const index = this.ctx.createGain();
    const depth = freq * (0.6 + velocity * 3.2);
    index.gain.setValueAtTime(depth, t);
    index.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.08), t + 0.6 + (1 - velocity) * 0.6);
    mod.connect(index).connect(carrier.frequency);

    const amp = this.ctx.createGain();
    const peak = 0.05 + velocity * velocity * 0.25;
    // Low notes ring longer, like real strings and bars.
    const decay = 1.5 + (1 - (note - 21) / 88) * 4;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    amp.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.4);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    carrier.connect(amp).connect(this.out);
    carrier.start(t);
    mod.start(t);
    carrier.stop(t + decay + 0.05);
    mod.stop(t + decay + 0.05);
    const v: Voice = { note, carrier, mod, amp, started: t };
    carrier.onended = () => (this.voices = this.voices.filter((x) => x !== v));
    this.voices.push(v);
  }

  noteOff(note: number) {
    if (this.sustainHeld) this.sustained.add(note);
    else this.release(note, 0.25);
  }

  /** Sustain pedal (CC 64). */
  sustain(down: boolean) {
    this.sustainHeld = down;
    if (!down) {
      for (const n of this.sustained) this.release(n, 0.3);
      this.sustained.clear();
    }
  }

  private release(note: number, time: number) {
    const t = this.ctx.currentTime;
    for (const v of this.voices) {
      if (v.note !== note) continue;
      v.amp.gain.cancelScheduledValues(t);
      v.amp.gain.setValueAtTime(Math.max(0.0001, v.amp.gain.value), t);
      v.amp.gain.exponentialRampToValueAtTime(0.0001, t + time);
      v.carrier.stop(t + time + 0.02);
      v.mod.stop(t + time + 0.02);
      v.note = -1;
    }
  }

  private kill(v: Voice) {
    try {
      v.carrier.stop();
      v.mod.stop();
    } catch {
      /* already stopped */
    }
    this.voices = this.voices.filter((x) => x !== v);
  }

  allOff() {
    for (const v of [...this.voices]) this.kill(v);
    this.sustained.clear();
  }
}
