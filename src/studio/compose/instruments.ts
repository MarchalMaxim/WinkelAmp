/**
 * What the auto-composer hears of a pack's instrument tracks (plan 2026-10-31 §9): how much of a section a part plays
 * in, and which part enters there. Pure.
 */
import type { Note, TrackId } from '../../widgets/types';
import { TRACK_IDS } from '../pack/instruments';
import type { SongPack } from '../pack/pack';
import type { Span } from './character';

const BIN = 0.5;

/** The share of the 0.5 s bins of `s` (the last one may be shorter) in which some note sounds: a note [a, b) sounds in
    the bin [x, y) when a < y and b > x. A note with no length sounds nowhere. Notes need not be sorted. */
export function presence(notes: readonly Note[], s: Span): number {
  const len = s.end - s.start, n = Math.ceil(len / BIN - 1e-9);
  if (!(n > 0)) return 0;
  const on = new Uint8Array(n);
  for (const [a, b] of notes) {
    if (!(b > a) || a >= s.end || b <= s.start) continue;
    const i0 = a <= s.start ? 0 : Math.floor((a - s.start) / BIN);
    const i1 = Math.min(n - 1, Math.ceil((Math.min(b, s.end) - s.start) / BIN) - 1);
    for (let i = i0; i <= i1; i++) on[i] = 1;
  }
  let c = 0;
  for (let i = 0; i < n; i++) c += on[i];
  return c / n;
}

const sounds = (notes: readonly Note[], x: number, y: number) => notes.some(([a, b]) => b > a && a < y && b > x);

/** The first track (TRACKS order) that enters in `s`: its first note starting in s comes after at least 5 s in which
    none of its notes sounded (counted from the song's start, so a part that starts 4 s into the song has not been
    silent for 5 s), and its notes then sound in at least 4 of the next six 1 s bins. Null when none does. */
export function enteringTrack(pack: Pick<SongPack, 'tracks'>, s: Span): TrackId | null {
  for (const id of TRACK_IDS) {
    const notes = pack.tracks?.[id]?.notes;
    if (!notes?.length) continue;
    let f = Infinity, lastEnd = 0;
    for (const [a] of notes) if (a >= s.start && a < s.end && a < f) f = a;
    if (f === Infinity) continue;
    for (const [a, b] of notes) if (a < f && b > a && b > lastEnd) lastEnd = b;
    if (f - lastEnd < 5) continue;
    let bins = 0;
    for (let i = 0; i < 6; i++) if (sounds(notes, f + i, f + i + 1)) bins++;
    if (bins >= 4) return id;
  }
  return null;
}
