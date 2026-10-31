/**
 * A song pack's instrument tracks, beats and loudness for the lab (plan §11): lab/pack-<id>.js, git-ignored.
 *
 *   npm run lab-notes -- <id>
 *
 * Reads songs/<id>/pack.json and writes one line, window.PACK = { tracks, beats, loudness };, which the lab loads as a
 * classic script when its SONGS entry names pack: 'pack-<id>.js'. A pack without tracks (a piano song, or v1) gives
 * tracks {} so the lab's "listens to" offers the lines derived from the notes only. The notes themselves stay in the
 * lab's notes*.js files.
 */
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { validatePack, type SongPack } from '../src/studio/pack/pack';
import { isSlug, REPO, songsDir } from './node/pack-io';

const id = process.argv[2];
if (!id || !isSlug(id) || process.argv.length > 3) { console.error('usage: npm run lab-notes -- <song id>   (a folder in songs/)'); process.exit(2); }
const file = join(songsDir(), id, 'pack.json');
if (!existsSync(file)) { console.error(`no pack ${file}: ingest the recording first (npm run ingest -- <audio>)`); process.exit(1); }
const pack = JSON.parse(readFileSync(file, 'utf8')) as SongPack;
const problems = validatePack(pack);
if (problems.length) { console.error(`${file} is not a valid pack:\n  ${problems.join('\n  ')}`); process.exit(1); }

const data = { tracks: pack.tracks ?? {}, beats: pack.beats, loudness: pack.loudness };
const out = resolve(REPO, 'lab', `pack-${id}.js`);
const tmp = `${out}.${process.pid}.tmp`;
try {
  writeFileSync(tmp, `window.PACK=${JSON.stringify(data)};\n`);
  renameSync(tmp, out);
} finally {
  rmSync(tmp, { force: true });
}
const tracks = Object.entries(data.tracks).map(([t, k]) => `${t} ${k!.notes.length}`);
console.log(`${relative(REPO, out).replace(/\\/g, '/')}: ${tracks.length ? `tracks ${tracks.join(', ')}` : 'no tracks'}; ${pack.beats.length} beats, ${pack.loudness.values.length} loudness values`);
