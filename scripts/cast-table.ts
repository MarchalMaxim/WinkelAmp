/**
 * Writes docs/CAST.md from the widget registry (src/stage/elements).
 *
 *   npm run cast
 *
 * Run it after adding or changing a widget; tests/cast-doc.test.ts fails while the file is stale.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { castDoc } from '../src/stage/cast-doc';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'CAST.md');
writeFileSync(out, castDoc());
console.log(`wrote ${out}`);
