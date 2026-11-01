import { describe, expect, it } from 'vitest';
import { keyAction } from '../src/studio/ui/keys';
import { knobState, settingOf } from '../src/studio/ui/knobs';
import { songHref, splitTitle } from '../src/studio/ui/library';
import { isDirty, Store } from '../src/studio/ui/store';
import { activity, snapToAttack, widgetHue } from '../src/studio/ui/timeline';
import type { SongPack } from '../src/studio/pack/pack';
import type { Show } from '../src/studio/show/show';
import type { Chord, Param } from '../src/widgets/types';

const key = (k: string, o: Partial<KeyboardEvent> = {}) => ({ key: k, code: k === ' ' ? 'Space' : '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...o });
const free = { typing: false, control: false };

describe('keys', () => {
  it('maps the studio keys', () => {
    expect(keyAction(key(' '), free)).toEqual({ action: 'toggle' });
    expect(keyAction(key('ArrowLeft'), free)).toEqual({ action: 'nudge', arg: -5 });
    expect(keyAction(key('ArrowRight', { shiftKey: true }), free)).toEqual({ action: 'section', arg: 1 });
    expect(keyAction(key('F', { shiftKey: false }), free)).toEqual({ action: 'fullscreen' });
    expect(keyAction(key('h'), free)).toEqual({ action: 'hideUi' });
    expect(keyAction(key('s'), free)).toEqual({ action: 'split' });
    expect(keyAction(key('Delete'), free)).toEqual({ action: 'removeLayer' });
    expect(keyAction(key('Backspace'), free)).toEqual({ action: 'removeLayer' });   // a Mac's delete key
    expect(keyAction(key('z', { ctrlKey: true }), free)).toEqual({ action: 'undo' });
    expect(keyAction(key('Z', { ctrlKey: true, shiftKey: true }), free)).toEqual({ action: 'redo' });
    expect(keyAction(key('y', { ctrlKey: true }), free)).toEqual({ action: 'redo' });
    expect(keyAction(key('s', { ctrlKey: true }), free)).toEqual({ action: 'save' });
  });

  it('leaves typing alone (but Ctrl+S still saves), and arrows to a focused slider', () => {
    const typing = { typing: true, control: false };
    for (const k of [' ', 'h', 's', 'Delete', 'Backspace', 'ArrowLeft']) expect(keyAction(key(k), typing)).toBeNull();
    expect(keyAction(key('z', { ctrlKey: true }), typing)).toBeNull();
    expect(keyAction(key('s', { ctrlKey: true }), typing)).toEqual({ action: 'save' });
    expect(keyAction(key('ArrowLeft'), { typing: false, control: true })).toBeNull();
    expect(keyAction(key(' '), { typing: false, control: true })).toEqual({ action: 'toggle' });
  });
});

describe('knob settings', () => {
  const q: Param = { key: 'size', min: 0, max: 2, value: 1, drive: '+level' };
  it('reads a layer setting over the widget default', () => {
    expect(knobState(q, undefined)).toEqual({ base: 1, drive: '+level', depth: 0.5 });
    expect(knobState(q, 1.5)).toEqual({ base: 1.5, drive: '+level', depth: 0.5 });
    expect(knobState(q, { drive: '' })).toEqual({ base: 1, drive: '', depth: 0.5 });
  });
  it('writes nothing for the default, a number when only the base moved, else the object', () => {
    expect(settingOf(q, { base: 1, drive: '+level', depth: 0.5 })).toBeNull();
    expect(settingOf(q, { base: 1.4, drive: '+level', depth: 0.5 })).toBe(1.4);
    expect(settingOf(q, { base: 1, drive: '-rate', depth: 0.5 })).toEqual({ base: 1, drive: '-rate' });
    expect(settingOf(q, { base: 1, drive: '+level', depth: 0.8 })).toEqual({ base: 1, drive: '+level', depth: 0.8 });
  });
});

describe('timeline', () => {
  const ch = (t: number, vel = 80, n = 1): Chord => ({ t, vel, lo: 60, hi: 60, notes: Array.from({ length: n }, () => ({ m: 60, v: vel, d: 1 })) });
  it('a dragged boundary snaps just before the nearest attack within 0.25 s; Alt does not snap', () => {
    const chords = [ch(10), ch(10.2), ch(12)];
    expect(snapToAttack(10.15, chords, false)).toBeCloseTo(10.15, 9);   // 10.2 is nearest: 10.2 − 0.05
    expect(snapToAttack(9.9, chords, false)).toBeCloseTo(9.95, 9);
    expect(snapToAttack(11, chords, false)).toBe(11);
    expect(snapToAttack(9.9, chords, true)).toBe(9.9);
  });
  it('widget hues are stable and the loved ones keep their own', () => {
    expect(widgetHue('squares')).toBe(widgetHue('squares'));
    expect(widgetHue('squares')).not.toBe(widgetHue('kandinsky'));
    expect(widgetHue('anything-new')).toBeGreaterThanOrEqual(0);
  });
  it('activity is 0..1, high where attacks are, low in silence, never NaN', () => {
    const loud: SongPack['loudness'] = { hop: 0.1, values: new Array(100).fill(0.5) };
    const a = activity([ch(2, 120, 4), ch(2.5, 120, 4), ch(3, 120, 4)], loud, 10);
    expect(a.length).toBe(40);
    expect(a.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
    expect(a[10]).toBeGreaterThan(a[30]);
    expect(activity([], { hop: 0.1, values: [] }, 5).every((v) => v === 0)).toBe(true);
  });
});

describe('library', () => {
  it('splits a title into composer and piece', () => {
    expect(splitTitle('Rachmaninoff: Prelude in C♯ minor')).toEqual(['Rachmaninoff', 'Prelude in C♯ minor']);
    expect(splitTitle('take 1')).toEqual(['', 'take 1']);
  });
  it("links a song, keeping the page's ?ears= (checks point the studio at their own ears server)", () => {
    expect(songHref('prelude', '')).toBe('?song=prelude');
    expect(songHref('a-2', '?song=x&ears=5276')).toBe('?song=a-2&ears=5276');
    expect(songHref('a', '?ears=off')).toBe('?song=a&ears=off');
  });
});

describe('Store', () => {
  const show: Show = { version: 1, id: 'demo', song: 'demo', sections: [
    { start: 0, end: 10, layers: [{ widget: 'squares' }, { widget: 'casket' }] }, { start: 10, end: 20, layers: [{ widget: 'kandinsky' }] }] };
  const pack = { id: 'demo', duration: 20 } as SongPack;

  it('an edit makes the show dirty; undo makes it clean again; redo dirty', () => {
    const st = new Store();
    st.dispatch({ type: 'loaded', song: pack, show, origin: 'file' });
    expect(isDirty(st.state)).toBe(false);
    st.dispatch({ type: 'edit', edit: { kind: 'moveBoundary', index: 1, t: 12 } });
    expect(isDirty(st.state)).toBe(true);
    st.dispatch({ type: 'undo' });
    expect(isDirty(st.state)).toBe(false);
    st.dispatch({ type: 'redo' });
    expect(st.state.show!.sections[1].start).toBe(12);
  });

  it('a repaired show starts dirty; saved makes it clean', () => {
    const st = new Store();
    st.dispatch({ type: 'loaded', song: pack, show, origin: 'repaired' });
    expect(isDirty(st.state)).toBe(true);
    st.dispatch({ type: 'saved' });
    expect(isDirty(st.state)).toBe(false);
    expect(st.state.origin).toBe('file');
  });

  it('clamps the selection after a change', () => {
    const st = new Store();
    st.dispatch({ type: 'loaded', song: pack, show, origin: 'file' });
    st.dispatch({ type: 'select', section: 0, layer: 1 });
    st.dispatch({ type: 'edit', edit: { kind: 'removeLayer', section: 0, layer: 1 } });
    expect(st.state.selected).toEqual({ section: 0, layer: 0 });
    st.dispatch({ type: 'select', section: 1 });
    st.dispatch({ type: 'edit', edit: { kind: 'merge', section: 0 } });
    expect(st.state.selected.section).toBe(0);
  });

  it('a show reloaded from disk over edits keeps them one undo away', () => {
    const st = new Store();
    st.dispatch({ type: 'loaded', song: pack, show, origin: 'file' });
    st.dispatch({ type: 'edit', edit: { kind: 'moveBoundary', index: 1, t: 12 } });
    const edited = st.state.show!;
    const disk: Show = { ...show, sections: [{ ...show.sections[0], label: 'From disk' }, show.sections[1]] };
    st.dispatch({ type: 'loaded', song: pack, show: disk, origin: 'file', keepUndo: true });
    expect(st.state.show).toBe(disk);
    expect(isDirty(st.state)).toBe(false);
    st.dispatch({ type: 'undo' });
    expect(st.state.show).toBe(edited);
    expect(isDirty(st.state)).toBe(true);
    st.dispatch({ type: 'undo' });
    expect(st.state.show).toBe(show);
  });

  it('a plain load starts a fresh history', () => {
    const st = new Store();
    st.dispatch({ type: 'loaded', song: pack, show, origin: 'file' });
    st.dispatch({ type: 'edit', edit: { kind: 'moveBoundary', index: 1, t: 12 } });
    st.dispatch({ type: 'loaded', song: pack, show, origin: 'file' });
    expect(st.history.canUndo).toBe(false);
  });

  it('the first edit of a composed show makes it yours, keeping when it was composed; undo gives it back', () => {
    for (const by of ['auto', 'claude'] as const) {
      const composed: Show = { ...show, composer: { by, at: '2026-10-31T01:00:00Z' } };
      const st = new Store();
      st.dispatch({ type: 'loaded', song: pack, show: composed, origin: by === 'auto' ? 'auto' : 'file' });
      st.dispatch({ type: 'edit', edit: { kind: 'moveBoundary', index: 1, t: 12 } });
      expect(st.state.show!.composer).toEqual({ by: 'user', at: '2026-10-31T01:00:00Z' });
      st.dispatch({ type: 'undo' });
      expect(st.state.show!.composer!.by).toBe(by);
    }
    const st = new Store();
    st.dispatch({ type: 'loaded', song: pack, show, origin: 'file' });
    st.dispatch({ type: 'edit', edit: { kind: 'moveBoundary', index: 1, t: 12 } });
    expect(st.state.show!.composer).toBeUndefined();
  });

  it('edits are locked while recording', () => {
    const st = new Store();
    st.dispatch({ type: 'loaded', song: pack, show, origin: 'file' });
    st.dispatch({ type: 'ui', patch: { recording: true } });
    st.dispatch({ type: 'edit', edit: { kind: 'merge', section: 0 } });
    expect(st.state.show).toBe(show);
  });
});
