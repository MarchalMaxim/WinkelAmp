/**
 * Writes docs/CAST.md from the widget registry (src/stage/elements).
 *
 *   npm run cast               regenerate it
 *   npm run cast -- --check    exit 1 when it is stale (whoever integrates widget branches runs this)
 *
 * Branches that each add a widget needn't commit CAST.md (they would all collide on it): it is
 * regenerated once they are merged.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { castDoc } from '../src/stage/cast-doc';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'CAST.md');
if (process.argv.includes('--check')) {
  let disk = '';
  try {
    disk = readFileSync(out, 'utf8').replace(/\r\n/g, '\n');
  } catch {}
  if (disk !== castDoc()) {
    console.error(`${out} is stale: run npm run cast`);
    process.exit(1);
  }
  console.log('CAST.md is up to date');
} else {
  writeFileSync(out, castDoc());
  console.log(`wrote ${out}`);
}
