/**
 * The widget contract: what `lab/tools/*.js` expect, nothing more (plan §2).
 * Song packs (T1) need only the note; the runtime's types join it here.
 */

/** A transcribed note, as the lab's `window.NOTES`: song seconds, MIDI pitch, velocity 0..127. */
export type Note = [start: number, end: number, midi: number, vel: number];
/** One attack: notes whose onsets fall within 40 ms of the first one (the lab's CHORDS entry). */
export interface Chord { t: number; notes: { m: number; v: number; d: number }[]; vel: number; lo: number; hi: number }
export interface SoundingNote { m: number; v: number; start: number; end: number }
export type Drive = '' | '+level' | '-level' | '+rate' | '-rate' | '+pitch' | '-pitch' | '+bass' | '-bass' | '+density' | '-density';
export interface Param {
  key: string; label?: string; min: number; max: number; step?: number; value: number; drive?: Drive;
  hint?: string; icon?: (g: CanvasRenderingContext2D, v: number, w: number, h: number) => void;
}
export interface ToolDef {
  id: string; name: string; blurb?: string; tag?: string; on?: boolean; params?: Param[];
  reset?(x: WidgetCtx): void; onChord?(ch: Chord, x: WidgetCtx): void; frame?(x: WidgetCtx): void;
}
export interface Features { level: number; rate: number; pitch: number; bass: number; density: number }
/** The lab's PST entry for one knob. */
export interface KnobState { base: number; drive: Drive; depth: number }
export type KnobMap = Record<string, KnobState>;

/** ONE object shared by every widget call, as in the lab. */
export interface WidgetCtx {
  g: CanvasRenderingContext2D; W: 1280; H: 720; canvas: HTMLCanvasElement;
  /** song s; song s since the last step; wall s (render mode: += each substep) */
  t: number; dt: number; now: number;
  /** the section's mood name ('dread', 'agitato', 'casket', 'return'): lewitt starts a new wall when it changes */
  moment: string;
  /** raw pulse (§2 arithmetic) */
  level: number; rate: number;
  feat: Features;
  /** set before every call; ctx.p reads its knobs */
  tool: ToolDef | undefined;
  rnd(a?: number, b?: number): number;
  sounding(): SoundingNote[];
  top(): SoundingNote | null;
  pitch01(m: number): number;
  p(key: string): number | undefined;
}

export type IconLib = Record<string, any> & { ink: string; gauge(g: CanvasRenderingContext2D, v: number, w: number, h: number): void };
export interface Verdict { v: 'love' | 'keep' | 'needs work' | 'drop'; on: string; note?: string }
/** A section start in the lab's SONGS: song s, mood name (what ctx.moment holds), button label. */
export type LabMoment = [start: number, mood: string, label?: string];
export interface LabSong { title: string; audio?: string; notes: string; dur: number; moments: LabMoment[] }
export interface LabHarness { toolIds: string[]; verdicts: Record<string, Verdict>; drives: [Drive, string][]; iconSource: string }
export interface WidgetMeta { id: string; name: string; blurb: string; tag: string; verdict: Verdict | null; params: Omit<Param, 'icon'>[];
  /** lab/tags.json's entry (T6); absent or null: untagged */
  tags?: WidgetTags | null }

// Instruments, regions and intensity (plan 2026-10-31-instruments-regions-automation-hd §1).

/** A line derived from the notes at run time. */
export type Line = 'melody' | 'bassline' | 'inner' | 'low' | 'high' | 'accents';
export type Family = 'keys' | 'plucked' | 'strings' | 'winds' | 'brass' | 'percussion' | 'voice';
export type TrackId = 'piano' | 'plucked' | 'violin' | 'viola' | 'cello' | 'contrabass' | 'strings' | 'timpani' | 'voice'
  | 'horn' | 'trumpet' | 'trombone' | 'brass' | 'flute' | 'oboe' | 'clarinet' | 'bassoon' | 'saxophone';
/** 'all' | a TrackId | `family:${Family}` | a Line. Absent = 'all'. */
export type Listen = string;
export type Shape = 'linear' | 'ease' | 'hold';
/** t: song s; v: 0..1; shape/bend: the segment from this pivot to the next (bend −1..1, 0 = straight). */
export interface Pivot { t: number; v: number; shape?: Shape; bend?: number }
/** Centre and size are fractions of the canvas; feather 0..1 of the smaller half-size (default 0.25); rot degrees. */
export interface Region { mode: 'spot' | 'window'; shape: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number;
  rot?: number; feather?: number; blend?: 'over' | 'lighten'; fit?: 'cover' | 'contain' | 'stretch' }
export type Persist = 'redraw' | 'strokes';
export interface SongNotes { notes: Note[]; tracks?: Partial<Record<TrackId, { notes: Note[]; family: Family }>> }
/** key = widget, or widget@listen; own = keeps its own pulse (listen set, or any intensity in the show). */
export interface InstanceSpec { key: string; widget: string; listen?: Listen; own?: boolean }
/** until: the curve is read at min(t, until), a decaying instance's frozen value. */
export interface SlotLayer { pivots?: readonly Pivot[]; until?: number; region?: Region; glide?: { from: Region; u: number } }
export type Role = 'under' | 'ground' | 'base' | 'texture' | 'lead' | 'accent' | 'top';
export interface WidgetTags { feel: string[]; instruments: string[]; role: Role }
