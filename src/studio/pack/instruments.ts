/**
 * Instrument tracks: which YourMT3+ classes (MT3_FULL_PLUS) make which track of a pack v2.
 * Classes with no track (Drums, synths, Organ, Chromatic Percussion, Orchestra Hit) still count in all notes.
 */
import type { Family, TrackId } from '../../widgets/types';

export const TRACKS: Record<TrackId, { family: Family; label: string; classes: readonly string[] }> = {
  piano: { family: 'keys', label: 'Piano', classes: ['Acoustic Piano', 'Electric Piano'] },
  plucked: { family: 'plucked', label: 'Guitar and harp', classes: ['Acoustic Guitar', 'Clean Electric Guitar', 'Distorted Electric Guitar', 'Orchestral Harp'] },
  violin: { family: 'strings', label: 'Violins', classes: ['Violin'] },
  viola: { family: 'strings', label: 'Violas', classes: ['Viola'] },
  cello: { family: 'strings', label: 'Cellos', classes: ['Cello'] },
  contrabass: { family: 'strings', label: 'Double basses', classes: ['Contrabass', 'Acoustic Bass', 'Electric Bass'] },
  strings: { family: 'strings', label: 'String section', classes: ['String Ensemble', 'Synth Strings'] },
  timpani: { family: 'percussion', label: 'Timpani', classes: ['Timpani'] },
  voice: { family: 'voice', label: 'Voices', classes: ['Choir and Voice', 'Singing Voice', 'Singing Voice (chorus)'] },
  horn: { family: 'brass', label: 'French horns', classes: ['French Horn'] },
  trumpet: { family: 'brass', label: 'Trumpets', classes: ['Trumpet'] },
  trombone: { family: 'brass', label: 'Trombones and tuba', classes: ['Trombone', 'Tuba'] },
  brass: { family: 'brass', label: 'Brass section', classes: ['Brass Section'] },
  flute: { family: 'winds', label: 'Flutes', classes: ['Pipe'] },
  oboe: { family: 'winds', label: 'Oboe', classes: ['Oboe', 'English Horn'] },
  clarinet: { family: 'winds', label: 'Clarinet', classes: ['Clarinet'] },
  bassoon: { family: 'winds', label: 'Bassoon', classes: ['Bassoon'] },
  saxophone: { family: 'winds', label: 'Saxophones', classes: ['Soprano/Alto Sax', 'Tenor Sax', 'Baritone Sax'] },
};

/** The track ids in the table's order (the order a pack writes them in). */
export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];

const BY_CLASS = new Map<string, TrackId>();
for (const id of TRACK_IDS) for (const c of TRACKS[id].classes) BY_CLASS.set(c, id);

/** The track of a YourMT3 class; null for Drums, synths, Organ, Chromatic Percussion, Orchestra Hit and unknown names. */
export function trackOf(cls: string): TrackId | null {
  return BY_CLASS.get(cls) ?? null;
}

export const isTrackId = (x: unknown): x is TrackId => typeof x === 'string' && Object.prototype.hasOwnProperty.call(TRACKS, x);
