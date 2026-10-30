/// <reference types="vite/client" />
/**
 * The bundled corpus: composed scripts (corpus/<id>.json, bundled eagerly — they
 * are small) and their song data (corpus/<id>.data.json, loaded only when needed).
 * Scripts are validated again at load, so a hand-edited file that no longer
 * passes the checker is skipped with a warning instead of breaking the app.
 *
 * Recordings are found by fingerprint, studies by id and seed. Script times are
 * seconds of the reference file: a re-encode with different leading silence
 * matches (the fingerprint trims it) but would play shifted by the difference.
 */
import { compare, isMatch, type Fingerprint } from '../audio/fingerprint';
import { validateScript } from './script';
import type { Script, SongData, StudyId } from './types';

export interface CorpusEntry {
  script: Script;
  /** Loads the script's song data (recordings; studies play from their score). */
  data?: () => Promise<SongData>;
}

/** Fingerprints are compared only for scripts this close in duration (fraction, plus the ±2 s alignment slack). */
const DURATION_TOLERANCE = 0.02;
const DURATION_SLACK = 2;

const stem = (path: string) => path.replace(/^.*\//, '').replace(/\.data\.json$|\.json$/, '');

/** A corpus over `import.meta.glob`-shaped maps (path → script JSON, path → data loader). */
export function createCorpus(scripts: Record<string, unknown>, data: Record<string, () => Promise<unknown>>) {
  const loaders = new Map(Object.entries(data).map(([path, load]) => [stem(path), load as () => Promise<SongData>]));
  const entries: CorpusEntry[] = [];
  for (const [path, json] of Object.entries(scripts)) {
    if (path.endsWith('.data.json')) continue;
    const r = validateScript(json);
    if (!r.ok) {
      console.warn(`[corpus] skipping ${path}: ${r.errors.join('; ')}`);
      continue;
    }
    if (r.script.id !== stem(path)) {
      console.warn(`[corpus] skipping ${path}: its id "${r.script.id}" must match the file name`);
      continue;
    }
    entries.push({ script: r.script, data: loaders.get(r.script.id) });
  }

  return {
    entries,

    /** The scripted performance of a study played with `seed`, or null. */
    findByStudy(id: StudyId, seed: number): CorpusEntry | null {
      return entries.find(({ script: { match: m } }) => m.kind === 'study' && m.study === id && m.seed === seed) ?? null;
    },

    /** The recording script whose song data matches `fp` (the closest, if several), or null. */
    async findByFingerprint(fp: Fingerprint): Promise<CorpusEntry | null> {
      let best: CorpusEntry | null = null;
      let bestBer = Infinity;
      for (const e of entries) {
        const { script } = e;
        if (script.match.kind !== 'recording' || !e.data) continue;
        // script.duration includes any lead-in the fingerprint trims: cheap filter first, isMatch decides.
        const tol = DURATION_TOLERANCE * Math.max(script.duration, fp.duration) + DURATION_SLACK;
        if (Math.abs(script.duration - fp.duration) > tol) continue;
        let d: SongData;
        try {
          d = await e.data();
        } catch (err) {
          console.warn(`[corpus] could not load ${script.id}.data.json`, err);
          continue;
        }
        if (!isMatch(d.fingerprint, fp)) continue;
        const { ber } = compare(d.fingerprint, fp);
        if (ber < bestBer) [best, bestBer] = [e, ber];
      }
      return best;
    },
  };
}

const bundled = createCorpus(
  import.meta.glob(['/corpus/*.json', '!/corpus/*.data.json'], { eager: true, import: 'default' }),
  import.meta.glob('/corpus/*.data.json', { import: 'default' }),
);

export const findByStudy = bundled.findByStudy;
export const findByFingerprint = bundled.findByFingerprint;
