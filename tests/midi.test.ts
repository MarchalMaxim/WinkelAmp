import { describe, expect, it } from 'vitest';
import { MidiBindings, MidiController, parseMidi, sourceLabel, type MidiTarget } from '../src/control/midi';

describe('parseMidi', () => {
  it('parses notes, CCs and bends', () => {
    expect(parseMidi([0x90, 60, 127])).toEqual({ type: 'noteon', channel: 0, note: 60, velocity: 1 });
    expect(parseMidi([0x93, 60, 0])).toEqual({ type: 'noteoff', channel: 3, note: 60 });
    expect(parseMidi([0x80, 61, 40])).toEqual({ type: 'noteoff', channel: 0, note: 61 });
    expect(parseMidi([0xb1, 74, 127])).toEqual({ type: 'cc', channel: 1, number: 74, value: 1 });
    expect(parseMidi([0xe0, 0, 64])).toMatchObject({ type: 'bend', value: 0 });
    expect((parseMidi([0xe0, 127, 127]) as { value: number }).value).toBeCloseTo(1);
    expect((parseMidi([0xe0, 0, 0]) as { value: number }).value).toBe(-1);
    expect(parseMidi([0xf8])).toEqual({ type: 'other' });
  });
  it('labels sources', () => {
    expect(sourceLabel({ kind: 'cc', number: 21 })).toBe('CC 21');
    expect(sourceLabel({ kind: 'note', number: 60 })).toBe('Key C4');
  });
});

describe('MidiBindings', () => {
  it('has sensible defaults', () => {
    const b = new MidiBindings();
    expect(b.route({ kind: 'cc', number: 1 }).target).toBe('wild');
    expect(b.route({ kind: 'cc', number: 21 }).target).toBeNull();
  });
  it('learns, and keeps one source per target', () => {
    const b = new MidiBindings();
    b.arm('wild');
    expect(b.route({ kind: 'cc', number: 21 })).toEqual({ target: 'wild', learned: true });
    expect(b.route({ kind: 'cc', number: 1 }).target).toBeNull(); // mod wheel released
    expect(b.route({ kind: 'cc', number: 21 }).target).toBe('wild');
    expect(b.sourceOf('wild')).toEqual({ kind: 'cc', number: 21 });
  });
  it('arming twice cancels', () => {
    const b = new MidiBindings();
    b.arm('trails');
    b.arm('trails');
    expect(b.armedTarget).toBeNull();
  });
});

describe('MidiController.handle', () => {
  const targets: MidiTarget[] = [
    { id: 'wild', label: 'Mood', kind: 'continuous' },
    { id: 'surprise', label: 'Surprise me', kind: 'trigger' },
  ];
  const make = () => {
    const log: string[] = [];
    const c = new MidiController(targets, {
      control: (id, v) => log.push(`control ${id} ${v.toFixed(2)}`),
      trigger: (id) => log.push(`trigger ${id}`),
      note: (n, v) => log.push(`note ${n} ${v.toFixed(2)}`),
      bend: (v) => log.push(`bend ${v.toFixed(2)}`),
      changed: () => {},
      learned: (id, s) => log.push(`learned ${id} ${sourceLabel(s)}`),
    });
    return { c, log };
  };

  it('routes CCs, keys and button presses', () => {
    const { c, log } = make();
    c.handle(parseMidi([0xb0, 1, 64]));
    c.handle(parseMidi([0x90, 64, 100]));
    c.handle(parseMidi([0x80, 64, 0]));
    c.arm('surprise');
    c.handle(parseMidi([0xb0, 20, 127])); // learn a button
    c.handle(parseMidi([0xb0, 20, 0]));
    c.handle(parseMidi([0xb0, 20, 127])); // press again → fires
    expect(log).toEqual([
      'control wild 0.50',
      'note 64 0.79',
      'note 64 0.00',
      'learned surprise CC 20',
      'trigger surprise',
      'trigger surprise',
    ]);
  });

  it('learns a key as a trigger and stops treating it as a note', () => {
    const { c, log } = make();
    c.arm('surprise');
    c.handle(parseMidi([0x90, 36, 90]));
    c.handle(parseMidi([0x80, 36, 0]));
    c.handle(parseMidi([0x90, 36, 90]));
    expect(log).toEqual(['learned surprise Key C2', 'trigger surprise', 'trigger surprise']);
  });
});
