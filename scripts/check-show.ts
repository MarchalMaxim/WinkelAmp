/**
 * Checks shows: their sections join up and cover the song, their widgets exist, their knobs make sense.
 *
 *   npm run check-show                     every shows/*.json
 *   npm run check-show -- <file…>          these files
 *   npm run check-show -- --fix [<file…>]  also write the repair (repairShow, then canonicalShow) where it leaves no errors
 *
 * The song's length comes from songs/<song>/pack.json when the pack is here; without it the end is not checked.
 * Prints each error and warning with its path; exit 1 when any show still has errors.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { canonicalShow, repairShow, validateShow, type Issue, type Show, type ShowContext } from '../src/studio/show/show';
import { isSlug } from '../src/studio/pack/pack';
import { loadCatalogue } from './node/catalogue';
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
    try { c.duration = (JSON.parse(readFileSync(pack, 'utf8')) as { duration: number }).duration; } catch { /* a broken pack: no end check */ }
  }
  let { errors, warnings } = validateShow(x, c);
  if (fix && (errors.length || warnings.length) && x && typeof x === 'object' && Array.isArray((x as Show).sections)) {
    const r = repairShow(x as Show, c);
    const after = validateShow(r.show, c);
    print(file, 'fixed', r.fixed);
    if (!after.errors.length) {
      writeFileSync(file, canonicalShow(r.show));
      console.log(`${name(file)}: wrote the repaired show`);
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
