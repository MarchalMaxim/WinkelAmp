/// <reference types="node" />
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { labWidgetIds, loadCatalogue, readLabHarness } from '../scripts/node/catalogue';
import { DRIVES } from '../src/widgets/features';
import { widgetOrder } from '../src/widgets/lab-harness';

describe('loadCatalogue (every lab/tools file in node:vm)', () => {
  const { widgets, failed } = loadCatalogue();

  it('loads every widget file, none failing', () => {
    expect(failed).toEqual([]);
    const files = readdirSync(new URL('../lab/tools/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
    expect([...widgets.keys()].sort()).toEqual(files.sort());
  });

  it('keeps the lab order: its order hint first, then the other files by name', () => {
    const ids = [...widgets.keys()];
    expect(ids).toEqual(widgetOrder(readLabHarness().order, ids));
    expect(labWidgetIds()).toEqual(ids);
  });

  it('gives each a name and sane knobs', () => {
    for (const m of widgets.values()) {
      expect(m.name, m.id).toBeTruthy();
      for (const q of m.params) {
        expect(q.min, `${m.id}.${q.key}`).toBeLessThan(q.max);
        expect(q.value, `${m.id}.${q.key}`).toBeGreaterThanOrEqual(q.min);
        expect(q.value, `${m.id}.${q.key}`).toBeLessThanOrEqual(q.max);
        expect(DRIVES, `${m.id}.${q.key}`).toContain(q.drive ?? '');
        expect('icon' in q).toBe(false);
      }
    }
  });

  it('carries the lab verdicts, whatever the current round says', () => {
    const { verdicts } = readLabHarness();
    for (const [id, m] of widgets) expect(m.verdict, id).toEqual(verdicts[id] ?? null);
  });

  it('reports a broken file and keeps going', () => {
    const r = loadCatalogue({ sources: { oops: 'throw 1', fine: "(() => { TOOLS.push({ id: 'fine', name: 'Fine', params: [] }); })();" } });
    expect(r.failed.map((f) => f.id)).toEqual(['oops']);
    expect(typeof r.failed[0].error).toBe('string');
    expect(r.widgets.get('fine')?.name).toBe('Fine');
  });
});
