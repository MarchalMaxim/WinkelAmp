// The knob row's 'how strongly' slider (research item 2): it writes the state's depth, rounded to its 0.05 steps,
// shows only while the knob follows something, and an untouched knob still saves as before. The tests run without
// a browser: a small stand-in document gives the row its inputs.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { knobRow, knobState, roundDepth, settingOf, type KnobPhase } from '../src/studio/ui/knobs';
import type { Drive, IconLib, KnobState, Param } from '../src/widgets/types';

interface Fake { value: string; hidden: boolean; on: Record<string, () => void>; addEventListener(t: string, fn: () => void): void; fire(t: string): void }
const fake = (): Fake => ({
  value: '', hidden: false, on: {},
  addEventListener(t, fn) { this.on[t] = fn; },
  fire(t) { this.on[t]?.(); },
});

/** A stand-in for the row's element: it hands out one fake per control the row's HTML contains. */
function stubDocument() {
  const made: { html: string; base: Fake; dep: Fake | null; sel: Fake | null } = { html: '', base: fake(), dep: null, sel: null };
  vi.stubGlobal('document', {
    createElement: () => ({
      className: '', dataset: {}, classList: { toggle() {} },
      set innerHTML(h: string) {
        made.html = h;
        made.dep = h.includes('class="depth"') ? fake() : null;
        made.sel = h.includes('<select') ? fake() : null;
      },
      querySelector(q: string) {
        if (q === 'input:not(.depth)') return made.base;
        if (q === 'input.depth') return made.dep;
        if (q === 'select') return made.sel;
        return null;
      },
    }),
  });
  return made;
}

afterEach(() => { vi.unstubAllGlobals(); });

const q: Param = { key: 'size', label: 'size', min: 0, max: 10, value: 4 } as Param;
const drives: [Drive, string][] = [['', 'fixed'], ['+level', 'louder → more']];
const icon = {} as IconLib;

function build(state: KnobState, p: Param = q) {
  const made = stubDocument();
  const calls: [KnobState, KnobPhase][] = [];
  const row = knobRow(p, state, drives, icon, (s, phase) => calls.push([s, phase]));
  return { made, calls, row };
}

describe('how strongly a knob follows the music', () => {
  it('rounds to the slider steps', () => {
    expect(roundDepth(0.5000001)).toBe(0.5);
    expect(roundDepth(0.62)).toBe(0.6);
    expect(roundDepth(1.3)).toBe(1);
  });

  it('is hidden while the knob is fixed and shown once a drive is chosen', () => {
    const { made, row } = build(knobState(q, undefined));
    expect(made.html).toContain('How strongly it follows the music. Left: hardly. Right: across its whole range.');
    expect(made.dep!.hidden).toBe(true);
    made.sel!.value = '+level'; made.sel!.fire('change');
    expect(made.dep!.hidden).toBe(false);
    row.sync({ base: 4, drive: '', depth: 0.5 });
    expect(made.dep!.hidden).toBe(true);
  });

  it('has no slider for how present', () => {
    const { made } = build(knobState(q, undefined), { ...q, leads: true } as Param);
    expect(made.dep).toBeNull();
  });

  it('writes the rounded depth: keys step, a drag moves and ends', () => {
    const { made, calls } = build({ base: 4, drive: '+level', depth: 0.5 });
    expect(made.dep!.hidden).toBe(false);
    expect(made.dep!.value).toBe('0.5');
    made.dep!.fire('keydown'); made.dep!.value = '0.7500001'; made.dep!.fire('input');
    expect(calls.at(-1)).toEqual([{ base: 4, drive: '+level', depth: 0.75 }, 'step']);
    made.dep!.fire('change');
    expect(calls).toHaveLength(1);   // a key press is already a whole change
    made.dep!.fire('pointerdown'); made.dep!.value = '0.3'; made.dep!.fire('input'); made.dep!.fire('change');
    expect(calls.slice(1)).toEqual([[{ base: 4, drive: '+level', depth: 0.3 }, 'move'], [{ base: 4, drive: '+level', depth: 0.3 }, 'end']]);
  });

  it('saves as before once the depth is back at 0.5 and the drive is the default', () => {
    const { made, calls } = build(knobState(q, { base: 6, drive: '', depth: 0.8 }));
    made.dep!.fire('keydown'); made.dep!.value = '0.5'; made.dep!.fire('input');
    expect(settingOf(q, calls.at(-1)![0])).toBe(6);
    made.sel!.value = '+level'; made.sel!.fire('change');
    expect(settingOf(q, calls.at(-1)![0])).toEqual({ base: 6, drive: '+level' });
    expect(settingOf(q, { base: 4, drive: '', depth: roundDepth(0.5) })).toBeNull();
  });

  it('a knob stored fixed with depth 0 starts at the middle when a drive is picked', () => {
    const { made, calls } = build({ base: 4, drive: '', depth: 0 });
    made.sel!.value = '+level'; made.sel!.fire('change');
    expect(calls.at(-1)![0]).toEqual({ base: 4, drive: '+level', depth: 0.5 });
    expect(made.dep!.value).toBe('0.5');
  });

  it('follows undo and redo', () => {
    const { made, row, calls } = build({ base: 4, drive: '+level', depth: 0.5 });
    row.sync({ base: 4, drive: '+level', depth: 0.9 });
    expect(made.dep!.value).toBe('0.9');
    made.base.fire('keydown'); made.base.value = '5'; made.base.fire('input');
    expect(calls.at(-1)![0]).toEqual({ base: 5, drive: '+level', depth: 0.9 });
  });
});
