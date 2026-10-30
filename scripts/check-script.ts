/**
 * Checks a composed script before it goes into the corpus.
 *
 *   npx tsx scripts/check-script.ts corpus/<id>.json      (or: npm run check-script -- corpus/<id>.json)
 *
 * Prints `OK` (exit 0) or every error with its JSON path (exit 1). Pacing
 * advice is printed as warnings and doesn't fail the check: a crowded stage,
 * hurried scene changes, cues after the end, and a recording script whose song
 * data (corpus/<id>.data.json, next to the script) is missing.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pacingWarnings, validateScript } from '../src/stage/script';

const file = process.argv[2];
if (!file) {
  console.error('usage: npx tsx scripts/check-script.ts corpus/<id>.json');
  process.exit(2);
}

let json: unknown;
try {
  json = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')); // editors on Windows may add a BOM
} catch (e) {
  console.error(`${file}: ${(e as Error).message}`);
  process.exit(1);
}

const result = validateScript(json);
if (!result.ok) {
  for (const e of result.errors) console.error(e);
  console.error(`${result.errors.length} error${result.errors.length === 1 ? '' : 's'} in ${file}`);
  process.exit(1);
}

const { script } = result;
const warnings = pacingWarnings(script);
const data = join(dirname(file), `${script.id}.data.json`);
if (script.match.kind === 'recording' && !existsSync(data)) {
  warnings.push(`no song data at ${data}: a recording script needs it (run npm run study on the recording)`);
}
for (const w of warnings) console.warn(`warning: ${w}`);
console.log('OK');
