// Song folders on disk: where they live, hashing, atomic writes, slugs.
import { createHash } from 'node:crypto';
import { createReadStream, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nameFromFile } from '../../src/studio/ingest/names';
import { isSlug } from '../../src/studio/pack/pack';

export { isSlug };

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** <repo>/songs, or WINKELAMP_SONGS (tests use temp dirs). */
export const songsDir = (): string => resolve(process.env.WINKELAMP_SONGS || resolve(REPO, 'songs'));

export function sha1File(path: string): Promise<string> {
  return new Promise((ok, fail) => {
    const h = createHash('sha1');
    createReadStream(path).on('data', (d) => h.update(d)).on('error', fail).on('end', () => ok(h.digest('hex')));
  });
}

/** Write to a temp file beside it, then rename: a reader never sees half a file. */
export function writeJsonAtomic(path: string, value: unknown): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, path);
}

/** The id and title a file name suggests (the study tool's rule): 'Prelude_in C#.mp3' → 'prelude-in-c', 'Prelude In C#'. */
export const nameOf = (file: string): { id: string; title: string } => nameFromFile(file);

/** <repo>/shows, or WINKELAMP_SHOWS (tests use temp dirs). */
export const showsDir = (): string => resolve(process.env.WINKELAMP_SHOWS || resolve(REPO, 'shows'));
