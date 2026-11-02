// The marks must not go missing (spec 2026-11-01-note-picker): a flush when the page goes, a warning before leaving on a
// failed save, and a static save that says when the browser refused it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyMelody, LEAVING_MAX, type Melody } from '../src/studio/show/melody';
import { staticStore } from '../src/studio/ui/api';
import { MarksSaver } from '../src/studio/ui/picker-logic';

const melody = (k: number): Melody => ({ ...emptyMelody('demo'), notes: Array.from({ length: k }, (_, i) => [i, i + 1, 60, 80] as [number, number, number, number]) });

/** A saver over a fake disk; `next` is what the next write does. */
function setup(size = () => 1) {
  const writes: { m: Melody; leaving: boolean }[] = [], log: string[] = [];
  let next: () => Promise<void> = () => Promise.resolve();
  const s = new MarksSaver({
    snapshot: () => melody(size()),
    write: (m, leaving) => { writes.push({ m, leaving }); return next(); },
    saved: () => log.push('saved'),
    failed: (e) => log.push(`failed ${e.message}`),
  });
  return { s, writes, log, fail: (why: string) => { next = () => Promise.reject(new Error(why)); }, ok: () => { next = () => Promise.resolve(); }, hang: () => { next = () => new Promise(() => {}); } };
}

describe('MarksSaver', () => {
  it('nothing changed: no write, nothing at risk, even when the page goes', () => {
    const { s, writes } = setup();
    s.save(); s.leaving();
    expect(writes).toEqual([]);
    expect(s.atRisk()).toBe(false);
  });

  it('a change saved is saved, once', async () => {
    const { s, writes, log } = setup();
    s.changed(); s.save(); s.save();
    await s.saving;
    expect(writes.map((w) => w.leaving)).toEqual([false]);
    expect(log).toEqual(['saved']);
    s.leaving();
    expect(writes).toHaveLength(1);
  });

  it('a change inside the second before the page goes is written as it goes, in that same call', () => {
    const { s, writes } = setup();
    s.changed();
    s.leaving();
    expect(writes.map((w) => w.leaving)).toEqual([true]);
  });

  it('the page goes while a save hangs and another waits behind it: the latest marks still go', async () => {
    let k = 1;
    const { s, writes, hang } = setup(() => k);
    hang();
    s.changed(); s.save();
    k = 2; s.changed(); s.save();
    await Promise.resolve();
    expect(writes).toHaveLength(1);
    s.leaving();
    expect(writes.at(-1)).toEqual({ m: melody(2), leaving: true });
  });

  it('a pending change alone is no reason to warn: the flush takes it', () => {
    const { s } = setup();
    s.changed();
    expect(s.atRisk()).toBe(false);
  });

  it('a failed save is reported, warns before leaving, and the next save tries again', async () => {
    const { s, writes, log, fail, ok } = setup();
    fail('disk full');
    s.changed(); s.save();
    await s.saving;
    expect(log).toEqual(['failed disk full']);
    expect(s.atRisk()).toBe(true);
    ok();
    s.save();
    await s.saving;
    expect(writes).toHaveLength(2);
    expect(log).toEqual(['failed disk full', 'saved']);
    expect(s.atRisk()).toBe(false);
  });

  it('a failed save with the page going tries once more', async () => {
    const { s, writes, fail } = setup();
    fail('disk full');
    s.changed(); s.save();
    await s.saving;
    s.leaving();
    expect(writes.at(-1)?.leaving).toBe(true);
  });

  it('a save that fails after a later change has been saved does not warn', async () => {
    let reject: (e: Error) => void = () => {};
    const first = new Promise<void>((_, no) => { reject = no; });
    let k = 0;
    const s = new MarksSaver({ snapshot: () => melody(1), write: () => (k++ ? Promise.resolve() : first), saved: () => {}, failed: () => {} });
    s.changed(); s.save();
    s.changed(); s.save();
    reject(new Error('x'));
    await s.saving;
    expect(s.atRisk()).toBe(false);
  });

  it('marks too many to go with the page warn while they are unsaved', async () => {
    const { s } = setup(() => Math.ceil(LEAVING_MAX / 10));
    s.changed();
    expect(s.atRisk()).toBe(true);
    s.save();
    await s.saving;
    expect(s.atRisk()).toBe(false);
  });

  it('marks that may not be saved (the file could not be read) never write, and warn', () => {
    const { s, writes } = setup();
    s.block();
    s.changed(); s.save(); s.leaving();
    expect(writes).toEqual([]);
    expect(s.atRisk()).toBe(true);
  });
});

describe('the static store', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a write the browser refuses rejects, so the notice appears', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota'); } });
    await expect(staticStore().saveMelody(melody(1))).rejects.toThrow(/browser/);
  });

  it('a write it takes, it keeps', async () => {
    const kept = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => { kept.set(k, v); } });
    const store = staticStore();
    await store.saveMelody(melody(1));
    expect(await store.melody('demo')).toEqual(melody(1));
  });
});
