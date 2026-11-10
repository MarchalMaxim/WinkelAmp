// What every WidgetRuntime in the studio is built from, written once. Browser only (sources.ts is bundled by Vite).
import { studioLayers } from './layers-source';
import { labHarness, labWidgetSources } from './sources';
import type { SongNotes } from './types';

/** The song's notes as the runtime takes them: a pack, or anything with its note fields. */
export const songNotesOf = (pack: SongNotes): SongNotes => ({ notes: pack.notes, tracks: pack.tracks, loudness: pack.loudness, energy: pack.energy });

/** The runtime's third argument: the lab's widget files and harness, and the layer code. */
export const studioLib = () => ({ sources: labWidgetSources(), harness: labHarness(), layers: studioLayers() });
