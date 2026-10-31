/**
 * Slash: while on stage, strong attacks cut the picture (cut.ts): a straight
 * slice through everything on screen, the halves shoved apart along it, a pale
 * scar flashing on the line. It draws nothing itself; it asks the stage for a
 * cut on the frame the attack is heard (the feed's onset events: the song data's
 * onsets in a script, the character engine's live onsets otherwise).
 *
 *   chords  only loud, chord-like attacks
 *   every   any onset above a lower threshold
 *
 * `intensity` lowers the threshold, `size` scales the shove, `color` the scar
 * ('mood': the casket's pale yellow). At most one cut per REST of music time.
 * Calibrated on Rachmaninoff's Prelude in C♯ minor: at the default intensity the
 * fff climax of the user's recording cuts ~1.5 times a second Live (about every
 * big chord, as the sketch did), and the corpus recording's pp chorale, scripted,
 * not at all.
 */
import { noteRgb } from '../../character/palette';
import { CUT_COLOR } from '../cut';
import { clamp01, fin, styleOf } from '../gl';
import { defineWidget } from '../kit';
import type { CastMember, StageElement, StageFrame, StageShared } from '../types';

/** Music seconds between cuts at least: a rolled chord or a flam is one slash, not three (the `rest` knob's default). */
const REST = 0.12;

export const widget = defineWidget({
  type: 'slash',
  styles: [
    { name: 'chords', doc: 'only loud, chord-like attacks (three or more pitch classes, or bass and treble at once) while the music itself is loud, at most one cut per 120 ms' },
    { name: 'every', doc: 'any onset above a lower threshold' },
  ],
  knobs: [{ name: 'rest', min: 0.03, max: 1, value: REST, doc: 'music seconds at least between two cuts' }],
  follows: 'strong attacks (onsets, on the frame they sound): each one cuts the picture (see the `cut` accent). Draws nothing itself',
  use: 'a section where the chords should do the cutting: panic, horror, a climax that tears. `intensity` lowers the threshold (at 0.7 a fff piano climax cuts on about every big chord), `size` scales the shove, `color` the scar (`mood`: a sickly pale yellow)',
  layer: 90,
  create: (): StageElement => new Slash(),
});
/**
 * Event strength needed at intensity 0, and how much intensity 1 lowers it. Scripted
 * events are 0.35 + 0.65 · onset strength; live ones are also scaled by the energy,
 * so a live fff chord reads ~0.6–0.9.
 */
const THRESHOLD = { chords: 0.8, every: 0.6 } as const;
const LOWER = 0.35;
/** A chroma bin this strong counts as a sounding pitch class; this many make a chord. */
const PC_ON = 0.5;
const PCS = 3;
/** Or the sound spans the keyboard (Descriptors.registerSpread): a massive chord smears the chroma. */
const WIDE = 0.6;
/**
 * `chords` weighs an attack by how loud the music is (Descriptors.loudness, absolute-ish):
 * a script's onset strengths are relative to the piece, so a pp chorale's chords can be its
 * strongest. Full weight from LOUD[1] (an fff climax reads 0.85–0.95), none below LOUD[0].
 */
const LOUD: [number, number] = [0.45, 0.85];

/** Three or more strong pitch classes at once, or bass and treble sounding together (`spread` 0..1). */
export function chordLike(chroma: ArrayLike<number>, spread: number): boolean {
  if (fin(spread) >= WIDE) return true;
  let n = 0;
  for (let i = 0; i < chroma.length; i++) if (fin(chroma[i]) >= PC_ON) n++;
  return n >= PCS;
}

/**
 * The trigger rule: the cut's strength 0..1 when an attack of event strength
 * `hit` (0 = none this frame) should cut now, else null. `chord` and `loudness`
 * (0..1) describe the music now; `now` and `last` (the previous cut) are music
 * time; nothing cuts while music time stands still.
 */
export function slashCut(style: string, intensity: number, hit: number, chord: boolean, loudness: number, now: number, last: number, musicDt: number, rest = REST): number | null {
  if (!(musicDt > 0) || !(hit > 0) || now - last < rest) return null;
  const st = styleOf(style, widget.styleNames) as keyof typeof THRESHOLD;
  if (st === 'chords') {
    if (!chord) return null;
    hit *= clamp01((fin(loudness) - LOUD[0]) / (LOUD[1] - LOUD[0]));
  }
  const thr = THRESHOLD[st] - LOWER * clamp01(fin(intensity));
  if (hit < thr) return null;
  return clamp01((hit - thr) / (1 - thr));
}

/** Linear RGB → sRGB 0..1 (scar colors are sRGB, like accent colors). */
const srgb = (c: number[]): [number, number, number] => c.map((v) => Math.pow(clamp01(v), 1 / 2.2)) as [number, number, number];

/** '#rgb' / '#rrggbb' → sRGB 0..1; null when it isn't one. */
function hexRgb(s: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

export class Slash implements StageElement {
  readonly type = 'slash' as const;
  private shared!: StageShared;
  private last = -Infinity;

  init(_gl: WebGL2RenderingContext, shared: StageShared) {
    this.shared = shared;
  }

  draw(fr: StageFrame, member: CastMember) {
    // A slash fading out stops cutting.
    if (member.presence < 0.5) return;
    const prm = member.spec.params;
    let hit = 0;
    let note = -1;
    for (const e of fr.events) {
      if (!e.onset || !(fin(e.strength) > hit)) continue;
      hit = fin(e.strength);
      note = e.note;
    }
    const now = fin(fr.clock.time);
    const st = slashCut(prm.style, prm.intensity, hit, chordLike(fr.chroma, fr.d.registerSpread), fr.d.loudness, now, this.last, fr.musicDt, widget.knob(fr, member, 'rest'));
    if (st === null) return;
    this.last = now;
    const color = prm.color === 'note' && note >= 0 ? srgb(noteRgb(note)) : (prm.color !== 'mood' && hexRgb(prm.color)) || CUT_COLOR;
    // size 0.5 → the sketch's shove; 0 → 0.4×, 1 → 1.6×.
    this.shared.cuts.push({ strength: st, color: [color[0], color[1], color[2]], scale: 0.4 + 1.2 * clamp01(fin(prm.size)) });
  }

  dispose() {}
}
