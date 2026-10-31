import type { ToolDef, Verdict, WidgetMeta } from './types';

/** What the studio shows about a widget: its words and knobs, without code (icons stay with the tool). */
export function toMeta(tool: ToolDef, verdict: Verdict | null): WidgetMeta {
  return {
    id: tool.id, name: tool.name ?? tool.id, blurb: tool.blurb ?? '', tag: tool.tag ?? '', verdict,
    params: (Array.isArray(tool.params) ? tool.params : []).map(({ icon: _icon, ...q }) => q),
  };
}
