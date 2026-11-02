/**
 * What a knob's move puts in the show: its own setting and, for how present, a new base for each knob that follows it
 * (lab/layers/present.js), drives kept. The caller sends them under one undo group, so a drag is one step.
 */
import { studioLayers } from '../../widgets/layers-source';
import type { KnobState, Param } from '../../widgets/types';
import type { KnobSetting } from '../show/show';
import { knobState, settingOf } from './knobs';

export interface KnobWrite { key: string; value: KnobSetting | null }

export function knobWrites(params: readonly Param[], q: Param, st: KnobState, now: Record<string, KnobSetting> | undefined): KnobWrite[] {
  const out: KnobWrite[] = [{ key: q.key, value: settingOf(q, st) }];
  if (q.key !== 'howmuch') return out;
  const bases = studioLayers().presentValues(params, st.base);
  for (const f of params) if (f.key in bases) out.push({ key: f.key, value: settingOf(f, { ...knobState(f, now?.[f.key]), base: bases[f.key] }) });
  return out;
}
