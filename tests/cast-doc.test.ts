import { describe, expect, it } from 'vitest';
import { castDoc } from '../src/stage/cast-doc';
import { WIDGETS } from '../src/stage/elements';

// Whether docs/CAST.md on disk is current is `npm run cast -- --check`'s job, at integration: a test
// here would make every widget branch commit the same generated table, and the branches collide.
describe('the cast doc', () => {
  it('has a row per widget, with its styles and knobs', () => {
    const doc = castDoc();
    for (const w of WIDGETS) {
      expect(doc).toContain(`| \`${w.type}\` |`);
      for (const s of w.styles) expect(doc).toContain(`\`${s.name}\` ${s.doc}`);
      for (const k of w.knobs) expect(doc).toContain(`\`${k.name}\` ${k.min}..${k.max}`);
    }
  });

  it('escapes table pipes in a widget\'s words', () => {
    const w = WIDGETS[0];
    const doc = castDoc([{ ...w, follows: 'a | b' } as never]);
    expect(doc).toContain(String.raw`a \| b`);
  });
});
