// Types for scripts/lib/encode.mjs (so the strict tests can import it).
export type Master = 'x264' | 'x264-444' | 'prores';
export function level(w: number, h: number, fps: number): '4.1' | '5.1' | '5.2';
export function masterArgs(o: {
  w: number; h: number; fps: number; crf: number; preset: string; master?: Master; out: string; frames?: number; input?: 'rgba' | 'png';
}): string[];
export function shareVideoKbps(mbPerMin: number, audioKbps?: number): number;
export function shareArgs(o: { input: string; pass: 1 | 2; kbps: number; out: string; passlog: string }): string[];
