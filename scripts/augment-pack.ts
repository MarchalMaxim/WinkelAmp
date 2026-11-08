/**
 * Adds the zero-lag energy lane (pack.energy, src/audio/energy.ts) to song packs made before it.
 *
 *   npm run augment-pack                       every songs/<id>/ with a pack.json
 *   npm run augment-pack -- <id> [<id> …]      only these
 *   npm run augment-pack -- --force-energy     recompute it where it is already there
 *
 * Decodes each pack's audio as ingest does (ffmpeg, mono, 44.1 kHz), computes the lane, and adds the key `energy` and
 * nothing else: pack.json is first copied to pack.before-energy.json (unless that exists), and the written pack is
 * read back and compared with the old one outside `energy` (any difference puts the old text back). Honours
 * WINKELAMP_SONGS. One line per song; exit 1 if any failed.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { augmentSong } from './node/augment';
import { decodeMono } from './node/decode';
import { isSlug, songsDir } from './node/pack-io';

const args = process.argv.slice(2);
const force = args.includes('--force-energy');
const ids = args.filter((a) => a !== '--force-energy');
const bad = ids.filter((a) => a.startsWith('-') || !isSlug(a));
if (bad.length) { console.error(`usage: npm run augment-pack -- [--force-energy] [<song id> …]   (not an id: ${bad.join(', ')})`); process.exit(2); }

const songs = songsDir();
const list = ids.length ? ids : readdirSync(songs).filter((d) => isSlug(d) && statSync(join(songs, d)).isDirectory()).sort();
let failed = 0;
for (const id of list) {
  const dir = join(songs, id);
  const t0 = performance.now();
  const r = existsSync(dir) ? augmentSong(dir, decodeMono, { force }) : { status: 'failed' as const, why: 'no such folder' };
  if (r.status === 'failed') failed++;
  console.log(`${id.padEnd(32)} ${r.status.padEnd(8)} ${r.why}${r.status === 'done' ? ` (${((performance.now() - t0) / 1000).toFixed(1)} s)` : ''}`);
}
process.exit(failed ? 1 : 0);
