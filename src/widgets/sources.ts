/// <reference types="vite/client" />
// The lab's widget files and harness, bundled by Vite (so `dist` works without the lab being served).
// Browser only.
import harnessJs from '/lab/harness.js?raw';
import kitJs from '/lab/kit.js?raw';
import tagsJson from '/lab/tags.json?raw';
import tagWordsJson from '/lab/tag-words.json?raw';
import { evalLabHarness } from './lab-harness';
import type { TagWords } from './tags';
import type { LabHarness, WidgetTags } from './types';

const FILES = import.meta.glob('/lab/tools/*.js', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** id (file name without .js) → source text. */
export function labWidgetSources(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, src] of Object.entries(FILES)) out[path.slice(path.lastIndexOf('/') + 1, -3)] = src;
  return out;
}

let harness: LabHarness | null = null;
export function labHarness(): LabHarness {
  return (harness ??= evalLabHarness(harnessJs, kitJs));
}

let tags: Record<string, WidgetTags> | null = null;
/** lab/tags.json: widget id → feel words, suited instruments and stack role. */
export function labTags(): Record<string, WidgetTags> {
  return (tags ??= JSON.parse(tagsJson) as Record<string, WidgetTags>);
}

let tagWords: TagWords | null = null;
/** lab/tag-words.json: the feel and instrument vocabulary and its synonyms. */
export function labTagWords(): TagWords {
  return (tagWords ??= JSON.parse(tagWordsJson) as TagWords);
}
