/**
 * A small generative groove, synthesized live, so there is always something
 * to play. It moves through different keys on purpose: every section has its
 * own color in the "Notes" palette.
 */

type Quality = 'maj' | 'min';
interface Chord {
  root: number; // MIDI note
  q: Quality;
}

const ch = (root: number, q: Quality): Chord => ({ root, q });

interface Section {
  chords: Chord[]; // one per 2 bars
  kick: boolean;
  clap: boolean;
  hats: boolean;
  pad: boolean;
}

// A3=57, F3=53, C3=48, G3=55, D3=50, Bb2=46, E3=52, C#3=49, B2=47
const SECTIONS: Section[] = [
  { chords: [ch(57, 'min'), ch(53, 'maj'), ch(48, 'maj'), ch(55, 'maj')], kick: true, clap: false, hats: true, pad: false },
  { chords: [ch(50, 'min'), ch(46, 'maj'), ch(53, 'maj'), ch(48, 'maj')], kick: true, clap: true, hats: true, pad: true },
  { chords: [ch(52, 'maj'), ch(49, 'min'), ch(57, 'maj'), ch(47, 'maj')], kick: false, clap: false, hats: false, pad: true },
  { chords: [ch(57, 'min'), ch(53, 'maj'), ch(48, 'maj'), ch(55, 'maj')], kick: true, clap: true, hats: true, pad: true },
];

const BPM = 118;
const STEP = 60 / BPM / 4; // 16th notes
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

export class DemoGroove {
  readonly title = 'Demo groove — Prism Walk';
  private out: GainNode;
  private fx: GainNode;
  private noise: AudioBuffer;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private startedAt = 0;

  constructor(private ctx: AudioContext, destination: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.out.connect(comp).connect(destination);

    // A dotted-eighth echo for the melodic parts.
    this.fx = ctx.createGain();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    this.fx.connect(this.out);
    this.fx.connect(delay).connect(tone).connect(fb).connect(delay);
    tone.connect(this.out);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  get playing() {
    return this.timer !== null;
  }

  /** Seconds of song played so far. */
  get position() {
    return this.playing ? this.ctx.currentTime - this.startedAt : 0;
  }

  start() {
    if (this.timer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.startedAt = this.nextTime - this.step * STEP;
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop() {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
    // Fade out whatever is still ringing.
    const t = this.ctx.currentTime;
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + 0.15);
  }

  private schedule() {
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.step++;
      this.nextTime += STEP;
    }
  }

  private playStep(step: number, t: number) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const section = SECTIONS[Math.floor(bar / 8) % SECTIONS.length];
    const chord = section.chords[Math.floor((bar % 8) / 2)];
    const tones = [0, chord.q === 'maj' ? 4 : 3, 7, 12].map((i) => chord.root + i);
    const swing = s % 2 === 1 ? STEP * 0.12 : 0;
    t += swing;

    if (section.kick && s % 4 === 0) this.kick(t);
    if (section.clap && (s === 4 || s === 12)) this.clap(t);
    if (section.hats && s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.16 : 0.07, s % 4 === 2 ? 0.12 : 0.04);
    if (!section.kick && s === 0 && bar % 2 === 0) this.kick(t, 0.5); // soft heartbeat in the breakdown

    // Bass: root on the beat, octave pops on the off-beats.
    const bassPattern = [0, -1, 12, -1, 0, -1, 0, 12, 0, -1, 12, -1, 0, 7, 12, -1];
    const bp = bassPattern[s];
    if (bp >= 0 && section.kick) this.bass(mtof(chord.root - 12 + bp), t, STEP * 1.6);
    if (!section.kick && s === 0 && bar % 2 === 0) this.bass(mtof(chord.root - 12), t, STEP * 30);

    // Arpeggio climbing through the chord.
    const arpOrder = [0, 1, 2, 3, 2, 1, 0, 2];
    if (s % 2 === 0 || !section.kick) {
      const note = tones[arpOrder[(step >> (section.kick ? 1 : 0)) % arpOrder.length]] + 12;
      this.pluck(mtof(note), t, section.kick ? 0.11 : 0.16);
    }

    if (section.pad && s === 0 && bar % 2 === 0) {
      for (const n of tones.slice(0, 3)) this.pad(mtof(n), t, STEP * 32);
    }
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private kick(t: number, vol = 1) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    this.env(g, t, 0.95 * vol, 0.003, 0.42);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.5);
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, q: number, vol: number, decay: number, dest: AudioNode) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, vol, 0.002, decay);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }

  private clap(t: number) {
    this.noiseHit(t, 'bandpass', 1500, 0.8, 0.55, 0.2, this.out);
    this.noiseHit(t + 0.012, 'bandpass', 1100, 0.8, 0.35, 0.16, this.fx);
  }

  private hat(t: number, vol: number, decay: number) {
    this.noiseHit(t, 'highpass', 7500, 0.7, vol, decay, this.out);
  }

  private bass(freq: number, t: number, dur: number) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(140, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.32, 0.005, dur);
    o.connect(f).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pluck(freq: number, t: number, vol: number) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const o2 = this.ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = freq * 1.004;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(600, t + 0.25);
    const g = this.ctx.createGain();
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.25;
    this.env(g, t, vol, 0.004, 0.3);
    o.connect(f);
    o2.connect(g2).connect(f);
    f.connect(g);
    g.connect(this.out);
    g.connect(this.fx);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.4);
    o2.stop(t + 0.4);
  }

  private pad(freq: number, t: number, dur: number) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 1.2);
    g.gain.setValueAtTime(0.05, t + dur - 1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g).connect(this.out);
    for (const detune of [-9, 0, 9]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}
