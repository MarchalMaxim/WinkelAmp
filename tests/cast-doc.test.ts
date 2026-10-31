import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { castDoc } from '../src/stage/cast-doc';
import { WIDGETS } from '../src/stage/elements';

describe('docs/CAST.md', () => {
  it('is up to date with the widget registry (run `npm run cast`)', () => {
    const disk = readFileSync(join(__dirname, '..', 'docs', 'CAST.md'), 'utf8').replace(/\r\n/g, '\n');
    expect(disk).toBe(castDoc());
  });

  it('has a row per widget, with its styles and knobs', () => {
    const doc = castDoc();
    for (const w of WIDGETS) {
      expect(doc).toContain(`| \`${w.type}\` |`);
      for (const s of w.styles) expect(doc).toContain(`\`${s.name}\` ${s.doc}`);
      for (const k of w.knobs) expect(doc).toContain(`\`${k.name}\` ${k.min}..${k.max}`);
    }
  });
});
