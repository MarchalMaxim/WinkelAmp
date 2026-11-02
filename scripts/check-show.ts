/**
 * Checks shows: their clips lie in the song and no track holds an overlap, their widgets exist, their knobs make sense.
 *
 *   npm run check-show                     every shows/*.json
 *   npm run check-show -- <file…>          these files
 *   npm run check-show -- --fix [<file…>]  also write the repair (repairShow, then canonicalShow) where it leaves no errors
 *                                          (unknown properties are dropped then: each is named with what it held)
 *
 * The song's length comes from songs/<song>/pack.json when the pack is here; without it the end is not checked.
 * Prints each error and warning with its path; exit 1 when any show still has errors.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { canonicalShow, repairShow, validateShow, type Issue, type Show, type ShowContext } from '../src/studio/show/show';
import { isSlug } from '../src/studio/pack/pack';
import type { Note, SongNotes } from '../src/widgets/types';
import { loadCatalogue } from './node/catalogue';
import { loadLayers } from './node/layers';
import { showsDir, songsDir } from './node/pack-io';

const argv = process.argv.slice(2);
const fix = argv.includes('--fix');
const unknown = argv.filter((a) => a.startsWith('--') && a !== '--fix');
if (unknown.length) {
  console.error(`unknown option ${unknown.join(' ')}\nusage: npm run check-show -- [--fix] [<show.json>…]`);
  process.exit(2);
}
let files = argv.filter((a) => !a.startsWith('--')).map((f) => resolve(f));
if (!files.length) {
  const dir = showsDir();
  files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => join(dir, f)) : [];
  if (!files.length) { console.log(`no shows in ${dir}`); process.exit(0); }
}

const { widgets, failed } = loadCatalogue();
for (const f of failed) console.warn(`warning: lab/tools/${f.id}.js did not load (${f.error}): shows using it fail the check`);

const name = (f: string) => { const r = relative(process.cwd(), f); return r && !r.startsWith('..') && !isAbsolute(r) ? r : f; };
const print = (f: string, kind: string, list: Issue[]) => { for (const i of list) console.log(`${name(f)}: ${kind} ${i.path || '(show)'}: ${i.message}`); };
/** The value at an issue path like 'clips[1].knobs.size'. */
const valueAt = (o: unknown, path: string): unknown => path.split(/\.|(?=\[)/).filter(Boolean).reduce<unknown>((v, k) =>
  v && typeof v === 'object' ? (v as Record<string, unknown>)[k.startsWith('[') ? k.slice(1, -1) : k] : undefined, o);
let bad = 0;
for (const file of files) {
  let x: unknown;
  try { x = JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
    console.log(`${name(file)}: error: ${e instanceof Error ? e.message : String(e)}`);
    bad++; continue;
  }
  const c: ShowContext = { widgets };
  const song = x && typeof x === 'object' ? (x as { song?: unknown }).song : undefined;
  const pack = isSlug(song) ? join(songsDir(), song, 'pack.json') : null;
  if (pack && existsSync(pack)) {
    try {
      const p = JSON.parse(readFileSync(pack, 'utf8')) as { duration: number; notes: Note[]; tracks?: SongNotes['tracks'] };
      c.duration = p.duration;
      c.tracks = Object.keys(p.tracks ?? {});   // a listen naming a track this song lacks is a warning
      c.noteTypes = loadLayers().noteTypeAttacks(p);   // and one naming a kind of note it, or the section, has none of
    } catch { /* a broken pack: no end or track checks */ }
  }
  let { errors, warnings } = validateShow(x, c);
  if (fix && (errors.length || warnings.length) && x && typeof x === 'object' && Array.isArray((x as Show).clips)) {
    const r = repairShow(x as Show, c);
    let after = validateShow(r.show, c);
    print(file, 'fixed', r.fixed);
    if (!after.errors.length) {
      // The canonical form keeps only known properties: say what each misspelled one held, then check what was written.
      const dropped = after.warnings.filter((w) => w.message.startsWith('unknown property'))
        .map((w) => ({ path: w.path, message: `dropped: it held ${JSON.stringify(valueAt(r.show, w.path))}` }));
      print(file, 'fixed', dropped);
      const text = canonicalShow(r.show);
      writeFileSync(file, text);
      console.log(`${name(file)}: wrote the repaired show`);
      after = validateShow(JSON.parse(text), c);
    } else console.log(`${name(file)}: not written: errors remain that need a person`);
    ({ errors, warnings } = after);
  }
  print(file, 'error', errors);
  print(file, 'warning', warnings);
  const end = c.duration === undefined ? ` (no pack for '${String(song)}' here: the end is not checked)` : '';
  if (errors.length) bad++;
  else console.log(`${name(file)}: ok${warnings.length ? `, ${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : ''}${end}`);
}
if (bad) { console.log(`${bad} of ${files.length} show${files.length > 1 ? 's' : ''} with errors`); process.exit(1); }
