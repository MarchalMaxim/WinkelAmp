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
export interface WidgetMeta { id: string; name: string; blurb: string; tag: string; verdict: Verdict | null; params: Omit<Param, 'icon'>[] }
