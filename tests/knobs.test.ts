import { describe, expect, it } from 'vitest';
import { widgetOf } from '../src/stage/elements';
import { NEUTRAL_FEAT } from '../src/stage/kit';
import { normalizeSpec, validateScript } from '../src/stage/script';
import type { StageFrame } from '../src/stage/types';

/** A one-scene script whose only element has these params. */
function withParams(type: string, params: unknown, where: 'scene' | 'enter' = 'scene'): any {
  const el = { id: 'x', type, params };
  return {
    version: 1,
    id: 'knob-test',
    title: 'Knob test',
    duration: 60,
    match: { kind: 'recording' },
    scenes: { a: { elements: where === 'scene' ? [el] : [{ id: 'y', type: 'bloom' }] } },
    timeline: [{ at: 0, scene: 'a' }, ...(where === 'enter' ? [{ at: 5, enter: el }] : [])],
  };
}

const errorsOf = (s: unknown): string[] => {
  const r = validateScript(s);
  return r.ok ? [] : r.errors;
};

describe('script knobs (params.knobs)', () => {
  it('accepts a base value, or value/drive/depth, for a knob the type has', () => {
    expect(errorsOf(withParams('pulse', { knobs: { gate: 0.5 } }))).toEqual([]);
    expect(errorsOf(withParams('pulse', { knobs: { decay: { value: 2, drive: '+level', depth: 0.3 } } }))).toEqual([]);
    expect(errorsOf(withParams('melody', { style: 'ink', knobs: { trail: { drive: '-pitch' } } }))).toEqual([]);
    expect(errorsOf(withParams('drip', { knobs: {} }))).toEqual([]);
  });

  it('checks knobs in entered elements too', () => {
    expect(errorsOf(withParams('drip', { knobs: { accel: 9 } }, 'enter'))).toEqual([
      'timeline[1].enter.params.knobs.accel: must be a number from 0 to 2, got 9',
    ]);
  });

  it("rejects a knob the type doesn't have, naming the ones it does", () => {
    expect(errorsOf(withParams('pulse', { knobs: { speed: 1 } }))).toEqual([
      'scenes.a.elements[0].params.knobs.speed: unknown knob for pulse (knobs: "gate", "decay")',
    ]);
    expect(errorsOf(withParams('fluid', { knobs: { swirl: 1 } }))).toEqual([
      'scenes.a.elements[0].params.knobs.swirl: unknown knob for fluid (it has none)',
    ]);
  });

  it('rejects values outside the knob range', () => {
    expect(errorsOf(withParams('melody', { knobs: { trail: 0.5 } }))).toEqual([
      'scenes.a.elements[0].params.knobs.trail: must be a number from 1 to 8, got 0.5',
    ]);
    expect(errorsOf(withParams('melody', { knobs: { trail: { value: '4' } } }))).toEqual([
      'scenes.a.elements[0].params.knobs.trail.value: must be a number from 1 to 8, got "4"',
    ]);
  });

  it('rejects an unknown drive, a depth outside 0..1, and unknown keys', () => {
    const e = errorsOf(withParams('slash', { knobs: { rest: { drive: '+loudness', depth: 2, amount: 1 } } }));
    expect(e).toContain('scenes.a.elements[0].params.knobs.rest.amount: unknown key (allowed: value, drive, depth)');
    expect(e.some((x) => x.startsWith('scenes.a.elements[0].params.knobs.rest.drive: unknown drive "+loudness"'))).toBe(true);
    expect(e).toContain('scenes.a.elements[0].params.knobs.rest.depth: must be a number from 0 to 1, got 2');
  });

  it('rejects knobs that are not an object', () => {
    expect(errorsOf(withParams('pulse', { knobs: [1] }))).toEqual(['scenes.a.elements[0].params.knobs: expected an object, got [1]']);
  });

  it('with an unknown type only reports the type', () => {
    expect(errorsOf(withParams('laser', { knobs: { beam: 1 } }))).toHaveLength(1);
  });
});

describe('knobs on stage', () => {
  const frame = (level: number) => ({ feat: { ...NEUTRAL_FEAT, level } }) as unknown as StageFrame;

  it("normalizeSpec keeps the script's knobs and adds none of its own", () => {
    expect(normalizeSpec({ id: 'p', type: 'pulse' }).params.knobs).toBeUndefined();
    expect(normalizeSpec({ id: 'p', type: 'pulse', params: { knobs: { gate: 0.6 } } }).params.knobs).toEqual({ gate: 0.6 });
  });

  it("a widget reads its knob: the default, the script's value, or driven by the frame's features", () => {
    const pulse = widgetOf('pulse')!;
    const m = (knobs?: Record<string, unknown>) => ({ spec: normalizeSpec({ id: 'p', type: 'pulse', params: knobs ? { knobs } as never : undefined }), presence: 1 });
    expect(pulse.knob(frame(1), m(), 'gate')).toBe(0.3);
    expect(pulse.knob(frame(1), m({ gate: 0.6 }), 'gate')).toBe(0.6);
    expect(pulse.knob(frame(0.5), m({ decay: { drive: '+level' } }), 'decay')).toBeCloseTo(1 + 0.5 * 2.75 * 0.5);
    // A frame without features (a caller that skips the stage) reads as neutral music.
    expect(pulse.knob({} as StageFrame, m({ decay: { drive: '+level' } }), 'decay')).toBe(1);
  });

  it("throws on a knob name the widget never declared (a typo in the widget's own code)", () => {
    const pulse = widgetOf('pulse')!;
    expect(() => pulse.knob(frame(0), { spec: normalizeSpec({ id: 'p', type: 'pulse' }), presence: 1 }, 'nope')).toThrow(/no knob/);
  });
});
