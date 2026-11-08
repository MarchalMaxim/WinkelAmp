// The shared layer maths (plan §2): lab/layers/*.js, written once. The lab loads each file as a classic <script>;
// the studio (src/widgets/layers-source.ts) and Node (scripts/node/layers.ts) evaluate the same text here. Pure: no
// Vite, no fs, so both loaders can import it.
import type { Chord, Features, Line, Listen, Note, NoteType, Param, Persist, Pivot, Region, SlotLayer, SongNotes, SoundingNote, WidgetCtx } from './types';

export interface Span { start: number; end: number }

export interface InstanceState {
  key: string; widget: string; salt: number;            // salt = fnv32(key)
  notes: Note[]; chords: Chord[]; ci: number;           // the part it hears; next chord index
  pulse: { level: number; rate: number; hit: number }; feat: Features;
  own: boolean; routed: boolean; persist: Persist; win: HTMLCanvasElement | null;
}

/** What the lab's step() and WidgetRuntime each provide to drawLayered. */
export interface LayerHost {
  ctx: WidgetCtx; g: CanvasRenderingContext2D;          // g: the real context of the shared canvas
  canvas: HTMLCanvasElement; S: number;
  call(inst: InstanceState, fn: 'reset' | 'onChord' | 'frame', ch?: Chord): void;   // safe(), instance fields swapped in
  scratch(): HTMLCanvasElement;                         // canvas-sized, reused
  windowOf(inst: InstanceState): HTMLCanvasElement;     // canvas-sized, opaque black when created
  make(w: number, h: number): HTMLCanvasElement;
}

export interface LayeredSlot { inst: InstanceState; receiving: boolean; weight: number; layer: SlotLayer;
  fired: readonly Chord[]; lastT: number; t: number; dt: number }

/** Everything lab/layers/*.js put on WA. Members land with their tasks (T1 persist.js; T4 automation.js and lines.js;
    T5 region.js; T12/T15 slot.js): until then only the type exists. */
export interface WaLayers {
  // automation.js (T4)
  automationAt(p: readonly Pivot[] | undefined, t: number): number;
  fnv32(s: string): number;
  passes(t: number, a: number, salt: number): boolean;
  presets: {
    fadeIn(s: Span, seconds: number, o?: { floor?: number }): Pivot[]; fadeOut(s: Span, seconds: number, o?: { floor?: number }): Pivot[];
    build(s: Span, o?: { floor?: number }): Pivot[]; decay(s: Span, o?: { floor?: number }): Pivot[]; dip(s: Span, o?: { floor?: number }): Pivot[];
    breathe(s: Span, beats: readonly number[], o: { every: number; floor?: number }): Pivot[];
    steps(s: Span, o: { n: number; floor?: number }): Pivot[]; level(s: Span, v: number): Pivot[];
    swell(s: Span, o?: { peak?: number; floor?: number }): Pivot[];
    pulse(s: Span, beats: readonly number[], o: { every: number; floor?: number; duty?: number }): Pivot[];
    gate(s: Span, curve: { hop: number; values: readonly number[] }, o: { above: number; floor?: number }): Pivot[];
    follow(s: Span, curve: { hop: number; values: readonly number[] },
      o?: { floor?: number; up?: number; down?: number; lead?: number; maxPivots?: number }): Pivot[];
    plays(s: Span, notes: readonly Note[], o?: { floor?: number }): Pivot[];
  };
  MAX_PIVOTS: number;                                   // 256
  LOUDNESS_LAG: { open: number; close: number; mean: number };   // how late pack.loudness runs, in seconds
  // persist.js (T1 table and vis; T12 fills PERSIST)
  VIS_REDRAW: readonly (readonly [number, number])[]; PERSIST: Record<string, Persist>;
  vis(a: number, cls: Persist): number;
  // lines.js (T4)
  NOTE_TYPES: readonly NoteType[]; noteTypeAttacks(song: SongNotes): Record<NoteType, number[]>;   // attack times per type
  groupChords(notes: readonly Note[]): Chord[]; soundingAt(notes: readonly Note[], t: number): SoundingNote[];
  lineNotes(notes: readonly Note[], line: Line): Note[];
  listenNotes(song: SongNotes, listen: Listen | undefined): { notes: Note[]; heard: string };   // heard 'all' = fell back; picks:<id> never falls back: a missing set hears nothing
  advancePulse(p: { level: number; rate: number; hit: number }, f: Features, fired: readonly Chord[], snd: readonly SoundingNote[], dt: number): void;
  // present.js
  presentValues(params: readonly Pick<Param, 'key' | 'min' | 'max' | 'step' | 'value' | 'less'>[] | undefined, s: number): Record<string, number>;
  presentAt(params: readonly Pick<Param, 'key' | 'min' | 'max' | 'step' | 'value' | 'less' | 'leads'>[] | undefined, now: Readonly<Record<string, number>> | undefined, g: number): Record<string, number>;
  // region.js (T5)
  regionBox(r: Region, cw: number, ch: number): { cx: number; cy: number; w: number; h: number; rot: number };   // device px, radians
  featherAlpha(d: number, feather: number): number;     // d: 0 centre … 1 edge → 1 … 0
  glideRegion(a: Region, b: Region, u: number): Region; // smoothstep(u) on x y w h rot feather; mode/shape/blend/fit of b
  fitRect(r: Region, cw: number, ch: number): { sx: number; sy: number; sw: number; sh: number };   // source rect in the layer canvas
  buildMask(r: Region, cw: number, ch: number, cls: Persist, make: LayerHost['make']): HTMLCanvasElement;   // canvas ops only
  // slot.js (T12; regions in T15)
  drawLayered(h: LayerHost, s: LayeredSlot): void;
  /** The 'clear' stamp on straight RGBA bytes, in place: black see-through, anything lit solid. */
  clearPixels<T extends Uint8ClampedArray | number[]>(d: T): T;
  /** The same on a box canvas: on the graphics card, or by reading its pixels without one. */
  clearBox(box: HTMLCanvasElement, w: number, h: number): void;
  /** features.ts newFeatures */
  newFeatures(): Features;
  /** cold at t, as after a seek: ci = the first chord after t, pulse 0, fresh features (resets and comebacks) */
  coldInstance(inst: InstanceState, t: number): void;
  /** drawLayered's step 1: the attacks the slot hears (advances inst.ci when routed) */
  deliveredChords(s: LayeredSlot): Chord[];
  /** drawLayered's step 3: weight × vis(a) with a curve, else the weight */
  layerWeight(s: LayeredSlot): number;
}

/** Each source (file name → text) run as `new Function('WA', src)(obj)` on one object, in file-name order, so a later
    file sees what an earlier one defined. A file that fails to parse or throws makes this throw, naming the file. */
export function evalLayers(sources: Readonly<Record<string, string>>): WaLayers {
  const WA: Record<string, unknown> = {};
  for (const name of Object.keys(sources).sort()) {
    try {
      new Function('WA', sources[name])(WA);
    } catch (e) {
      const msg = e && typeof (e as Error).message === 'string' ? (e as Error).message : String(e);
      throw new Error(`lab/layers/${name}: ${msg}`, { cause: e });
    }
  }
  return WA as unknown as WaLayers;
}
