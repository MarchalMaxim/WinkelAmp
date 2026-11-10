// The lab's own lists (lab/harness.js: ORDER, VERDICTS, DRIVES, SONGS, the ICON factory), evaluated from its text so the
// studio and Node never keep a copy that drifts.
import type { Kit, LabHarness, LabMoment } from './types';

/** Runs lab/kit.js's text against a fresh `window` and returns its KIT. */
export function evalKit(src: string): Kit {
  const win: { KIT?: Kit } = {};
  new Function('window', src)(win);
  if (!win.KIT || typeof win.KIT.SNAP !== 'object') throw new Error('lab/kit.js did not set window.KIT');
  return win.KIT;
}

/** Runs lab/harness.js's text against a fresh `window` and checks the shape of what it sets; kitSrc is lab/kit.js's text. */
export function evalLabHarness(src: string, kitSrc: string): LabHarness {
  const win: { LAB?: Record<string, unknown> } = {};
  new Function('window', src)(win);
  const lab = win.LAB;
  if (!lab) throw new Error('lab/harness.js did not set window.LAB');
  const { ORDER, VERDICTS, DRIVES, SONGS, makeIcon } = lab;
  if (!Array.isArray(ORDER) || !ORDER.every((x) => typeof x === 'string')) throw new Error('lab/harness.js: ORDER is not a list of ids');
  if (!VERDICTS || typeof VERDICTS !== 'object') throw new Error('lab/harness.js: VERDICTS is not an object');
  if (!Array.isArray(DRIVES)) throw new Error('lab/harness.js: DRIVES is not a list');
  if (!SONGS || typeof SONGS !== 'object') throw new Error('lab/harness.js: SONGS is not an object');
  for (const [id, s] of Object.entries(SONGS as LabHarness['songs'])) {
    if (typeof s?.notes !== 'string' || !Array.isArray(s.moments) || !s.moments.length) throw new Error(`lab/harness.js: SONGS.${id} has no notes or moments`);
    if (s.pack !== undefined && (typeof s.pack !== 'string' || !/^pack-[\w.-]+\.js$/.test(s.pack))) throw new Error(`lab/harness.js: SONGS.${id}.pack is not a pack-<id>.js file name`);
  }
  if (typeof makeIcon !== 'function' || typeof (makeIcon() as { gauge?: unknown }).gauge !== 'function') throw new Error('lab/harness.js: makeIcon did not give an ICON library');
  return { order: ORDER, verdicts: VERDICTS, drives: DRIVES, songs: SONGS, makeIcon, kit: evalKit(kitSrc) } as LabHarness;
}

/** The widgets in load and draw order: the ids in `order` that exist first, then the rest by name. */
export function widgetOrder(order: readonly string[], ids: Iterable<string>): string[] {
  const have = new Set(ids);
  return [...order.filter((id) => have.delete(id)), ...[...have].sort()];
}

/** ctx.moment before the first step: the lab starts every song at 'dread' (its ctx literal), whatever the song's moments. */
export const LAB_FIRST_MOMENT = 'dread';

/** The lab's step(): the mood name of the last moment starting at or before t, else the first one's. */
export function momentAt(moments: readonly LabMoment[], t: number): string {
  let m = moments[0][1];
  for (const [s, n] of moments) if (t >= s) m = n;
  return m;
}
