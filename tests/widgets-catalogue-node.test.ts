/// <reference types="node" />
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCatalogue } from '../scripts/node/catalogue';

const DRIVES = ['', '+level', '-level', '+rate', '-rate', '+pitch', '-pitch', '+bass', '-bass', '+density', '-density'];

describe('loadCatalogue (every lab/tools file in node:vm)', () => {
  const { widgets, failed } = loadCatalogue();

  it('loads every widget file, none failing', () => {
    expect(failed).toEqual([]);
    const files = readdirSync(new URL('../lab/tools/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
    expect([...widgets.keys()].sort()).toEqual(files.sort());
  });

  it('keeps the lab order (TOOL_IDS first)', () => {
    const ids = [...widgets.keys()];
    expect(ids.indexOf('harmonograph')).toBeLessThan(ids.indexOf('hilma'));
    expect(ids.indexOf('hilma')).toBeLessThan(ids.indexOf('kline'));
    expect(ids.indexOf('kandinsky')).toBeLessThan(ids.indexOf('casket'));
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

  it('carries the verdicts', () => {
    expect(widgets.get('casket')?.verdict?.v).toBe('love');
    expect(widgets.get('fields')?.verdict?.v).toBe('keep');
    expect(widgets.get('murmuration')?.verdict?.v).toBe('needs work');
  });

  it('never loads lab/tools/dropped/', () => {
    const dropped = readdirSync(new URL('../lab/tools/dropped/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
    for (const id of dropped) expect(widgets.has(id), id).toBe(false);
  });

  it('reports a broken file and keeps going', () => {
    const r = loadCatalogue({ sources: { oops: 'throw 1', fine: "(() => { TOOLS.push({ id: 'fine', name: 'Fine', params: [] }); })();" } });
    expect(r.failed.map((f) => f.id)).toEqual(['oops']);
    expect(typeof r.failed[0].error).toBe('string');
    expect(r.widgets.get('fine')?.name).toBe('Fine');
  });
});
