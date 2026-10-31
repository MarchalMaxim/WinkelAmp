import type { ToolDef, Verdict, WidgetMeta, WidgetTags } from './types';

/** What the studio shows about a widget: its words and knobs, without code (icons stay with the tool). `tags`, when
    given, is its lab/tags.json entry (null: untagged); left out, the meta has no `tags` key. */
export function toMeta(tool: ToolDef, verdict: Verdict | null, tags?: WidgetTags | null): WidgetMeta {
  const meta: WidgetMeta = {
    id: tool.id, name: tool.name ?? tool.id, blurb: tool.blurb ?? '', tag: tool.tag ?? '', verdict,
    params: (Array.isArray(tool.params) ? tool.params : []).map(({ icon: _icon, ...q }) => q),
  };
  if (tags !== undefined) meta.tags = tags;
  return meta;
}
