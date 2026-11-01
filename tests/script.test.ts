import { describe, expect, it } from 'vitest';
import { normalizeSpec, pacingWarnings, validateScript } from '../src/stage/script';
import type { Script } from '../src/stage/types';

/** A small but complete script: two scenes, an enter/exit pair, an accent on the same downbeat as a scene change. */
function minimal(): any {
  return {
    version: 1,
    id: 'test-piece',
    title: 'Test Piece',
    duration: 120,
    match: { kind: 'recording' },
    scenes: {
      calm: { look: { trails: 0.7, mirror: 2 }, elements: [{ id: 'mel', type: 'melody' }, { id: 'glow', type: 'bloom', params: { style: 'aurora' } }] },
      storm: { look: { palette: ['#000', '#112233', '#ff0', '#FFFFFF'] }, elements: [{ id: 'low', type: 'bass', params: { intensity: 1, region: 'bottom' } }] },
    },
    timeline: [
      { at: 0, scene: 'calm' },
      { at: 12, enter: { id: 'sp', type: 'sparks', params: { color: '#ffcc00' } }, fade: 1 },
      { at: 30, exit: 'sp' },
      { at: 40, scene: 'storm', transition: { kind: 'cut' } },
      { at: 40, accent: { kind: 'flash', color: '#fff', strength: 0.9 } },
      { at: 50, ramp: { target: 'look.trails', to: 0.2, duration: 10 } },
      { at: 60, ramp: { target: 'low.size', to: 0.9, duration: 4 }, snap: false },
    ],
  };
}

/** Validates `s` and returns its errors (failing the test if it unexpectedly passes). */
function errorsOf(s: unknown): string[] {
  const r = validateScript(s);
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.errors;
}

/** True when some error starts with `path` (the error names where in the JSON the problem is). */
const hasPath = (errors: string[], path: string) => errors.some((e) => e.startsWith(path + ':'));

describe('validateScript', () => {
  it('accepts a valid minimal script and returns it as is', () => {
    const s = minimal();
    const r = validateScript(s);
    expect(r).toEqual({ ok: true, script: s });
  });

  it('accepts a study match with an integer seed', () => {
    const s = minimal();
    s.match = { kind: 'study', study: 'basalt', seed: 7 };
    expect(validateScript(s).ok).toBe(true);
  });

  it('never throws on garbage', () => {
    for (const g of [null, undefined, 3, 'x', [], {}, { version: 1, scenes: null, timeline: {} }, { version: 1, scenes: { a: null }, timeline: [null, 3] }]) {
      expect(validateScript(g).ok).toBe(false);
    }
  });

  it('rejects an unknown element type', () => {
    const s = minimal();
    s.scenes.calm.elements[0].type = 'laser';
    const e = errorsOf(s);
    expect(hasPath(e, 'scenes.calm.elements[0].type')).toBe(true);
    expect(e.join('\n')).toContain('"laser"');
  });

  it('rejects a style that does not belong to the type', () => {
    const s = minimal();
    s.scenes.calm.elements[1].params.style = 'ribbon';
    expect(hasPath(errorsOf(s), 'scenes.calm.elements[1].params.style')).toBe(true);
  });

  it('rejects a cue naming an unknown scene', () => {
    const s = minimal();
    s.timeline[3].scene = 'tempest';
    const e = errorsOf(s);
    expect(hasPath(e, 'timeline[3].scene')).toBe(true);
    expect(e.join('\n')).toContain('unknown scene "tempest"');
    // Names inherited from Object.prototype are not scenes.
    s.timeline[3].scene = 'toString';
    expect(hasPath(errorsOf(s), 'timeline[3].scene')).toBe(true);
  });

  it('rejects an exit of an id that is in no scene and was never entered before', () => {
    const s = minimal();
    s.timeline[2].exit = 'ghost';
    expect(hasPath(errorsOf(s), 'timeline[2].exit')).toBe(true);
    // An id entered only later doesn't count either.
    const t = minimal();
    t.timeline.splice(1, 0, { at: 5, exit: 'sp' });
    expect(hasPath(errorsOf(t), 'timeline[1].exit')).toBe(true);
  });

  it('accepts an exit of an id from any scene', () => {
    const s = minimal();
    s.timeline.push({ at: 70, exit: 'mel' });
    expect(validateScript(s).ok).toBe(true);
  });

  it('rejects a negative cue time', () => {
    const s = minimal();
    s.timeline[0].at = -1;
    expect(hasPath(errorsOf(s), 'timeline[0].at')).toBe(true);
  });

  it('rejects an unsorted timeline', () => {
    const s = minimal();
    s.timeline[5].at = 20;
    expect(hasPath(errorsOf(s), 'timeline[5].at')).toBe(true);
  });

  it('rejects intensity outside 0..1', () => {
    const s = minimal();
    s.scenes.storm.elements[0].params.intensity = 1.5;
    expect(hasPath(errorsOf(s), 'scenes.storm.elements[0].params.intensity')).toBe(true);
    const t = minimal();
    t.timeline[1].enter.params.intensity = -0.1;
    expect(hasPath(errorsOf(t), 'timeline[1].enter.params.intensity')).toBe(true);
  });

  it('rejects mirror: 3', () => {
    const s = minimal();
    s.scenes.calm.look.mirror = 3;
    expect(hasPath(errorsOf(s), 'scenes.calm.look.mirror')).toBe(true);
  });

  it('rejects bad hex colors wherever a color goes', () => {
    const a = minimal();
    a.timeline[1].enter.params.color = '#ffcc0';
    expect(hasPath(errorsOf(a), 'timeline[1].enter.params.color')).toBe(true);
    const b = minimal();
    b.timeline[4].accent.color = 'white';
    expect(hasPath(errorsOf(b), 'timeline[4].accent.color')).toBe(true);
    const c = minimal();
    c.scenes.storm.look.palette[2] = '#ggg';
    expect(hasPath(errorsOf(c), 'scenes.storm.look.palette[2]')).toBe(true);
    const d = minimal();
    d.scenes.storm.look.palette = ['#000', '#111', '#222'];
    expect(hasPath(errorsOf(d), 'scenes.storm.look.palette')).toBe(true);
  });

  it('rejects a ramp target naming an unknown element or a property that cannot ramp', () => {
    const s = minimal();
    s.timeline[6].ramp.target = 'nobody.size';
    expect(hasPath(errorsOf(s), 'timeline[6].ramp.target')).toBe(true);
    const t = minimal();
    t.timeline[6].ramp.target = 'look.mirror';
    expect(hasPath(errorsOf(t), 'timeline[6].ramp.target')).toBe(true);
    const u = minimal();
    u.timeline[6].ramp.target = 'low.region';
    expect(hasPath(errorsOf(u), 'timeline[6].ramp.target')).toBe(true);
  });

  it('rejects version 2', () => {
    const s = minimal();
    s.version = 2;
    expect(hasPath(errorsOf(s), 'version')).toBe(true);
  });

  it('rejects a cue with no action or with two', () => {
    const s = minimal();
    s.timeline[1] = { at: 12 };
    expect(hasPath(errorsOf(s), 'timeline[1]')).toBe(true);
    const t = minimal();
    t.timeline[3].exit = 'mel';
    expect(hasPath(errorsOf(t), 'timeline[3]')).toBe(true);
  });

  it('rejects misspelled keys instead of silently ignoring them', () => {
    const s = minimal();
    s.scenes.calm.elements[0].params = { intesity: 0.5 };
    expect(hasPath(errorsOf(s), 'scenes.calm.elements[0].params.intesity')).toBe(true);
  });

  it('rejects a blend longer than 2 s', () => {
    const s = minimal();
    s.timeline[3].transition = { kind: 'blend', duration: 3 };
    expect(hasPath(errorsOf(s), 'timeline[3].transition.duration')).toBe(true);
  });

  it('reports every problem at once', () => {
    const s = minimal();
    s.version = 2;
    s.scenes.calm.look.mirror = 3;
    s.timeline[3].scene = 'tempest';
    expect(errorsOf(s).length).toBeGreaterThanOrEqual(3);
  });
});

describe('normalizeSpec', () => {
  it('fills defaults and picks the first style of the type', () => {
    const n = normalizeSpec({ id: 'm', type: 'melody' });
    expect(n.params.style).toBe('ribbon');
    expect(n.params.intensity).toBe(0.7);
    expect(n.params).toEqual({ intensity: 0.7, size: 0.5, region: 'full', color: 'mood', style: 'ribbon' });
  });

  it('keeps given params and does not mutate its input', () => {
    const spec = { id: 'p', type: 'pulse' as const, params: { style: 'grid', size: 0.9 } };
    const n = normalizeSpec(spec);
    expect(n.params).toMatchObject({ style: 'grid', size: 0.9, intensity: 0.7 });
    expect(spec.params).toEqual({ style: 'grid', size: 0.9 });
  });
});

describe('pacingWarnings', () => {
  it('is quiet for a well-paced script', () => {
    expect(pacingWarnings(minimal() as Script)).toEqual([]);
  });

  it('warns about a crowded stage, hurried scene changes and cues after the end', () => {
    const s = minimal();
    s.timeline.splice(3, 0,
      { at: 32, enter: { id: 'a', type: 'pulse' } },
      { at: 33, enter: { id: 'b', type: 'wave' } },
      { at: 34, enter: { id: 'c', type: 'fluid' } },
    );
    s.timeline.splice(8, 0, { at: 45, scene: 'calm' });
    s.timeline.push({ at: 130, accent: { kind: 'swell' } });
    expect(validateScript(s).ok).toBe(true);
    const w = pacingWarnings(s as Script).join('\n');
    expect(w).toContain('5 elements on stage');
    expect(w).toContain('5.0 s after');
    expect(w).toContain('after the end');
  });
});
