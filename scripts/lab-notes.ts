/**
 * A song pack's instrument tracks, beats and loudness for the lab (plan §11): lab/pack-<id>.js, git-ignored.
 *
 *   npm run lab-notes -- <id>
 *
 * Reads songs/<id>/pack.json and writes one line, window.PACK = { tracks, beats, loudness };, which the lab loads as a
 * classic script when its SONGS entry names pack: 'pack-<id>.js'. A pack without tracks (a piano song, or v1) gives
 * tracks {} so the lab's "listens to" offers the lines derived from the notes only. The notes themselves stay in the
 * lab's notes*.js files. A song new to the lab (no lab/<id>.mp3 yet) also gets those, all git-ignored: lab/<id>.mp3, a link
 * to the pack's recording, and lab/notes-<id>.js, the pack's notes. Its SONGS entry is still written by hand.
 */
import { copyFileSync, existsSync, linkSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
const audio = resolve(REPO, 'lab', `${id}.mp3`);
if (!existsSync(audio)) {
  const from = join(songsDir(), id, pack.audio);
  try { linkSync(from, audio); } catch { copyFileSync(from, audio); }
  const notes = resolve(REPO, 'lab', `notes-${id}.js`);
  writeFileSync(notes, `window.NOTES=${JSON.stringify(pack.notes)};\n`);
  console.log(`${relative(REPO, audio).replace(/\\/g, '/')}, ${relative(REPO, notes).replace(/\\/g, '/')}: ${pack.notes.length} notes`);
}
const tracks = Object.entries(data.tracks).map(([t, k]) => `${t} ${k!.notes.length}`);
console.log(`${relative(REPO, out).replace(/\\/g, '/')}: ${tracks.length ? `tracks ${tracks.join(', ')}` : 'no tracks'}; ${pack.beats.length} beats, ${pack.loudness.values.length} loudness values`);
