/// <reference types="vite/client" />
// The lab's widget files and harness, bundled by Vite (so `dist` works without the lab being served).
// Browser only. lab/tools/dropped/ is not matched.
import labHtml from '/lab/index.html?raw';
import { readLabHarness } from './lab-harness';
import type { LabHarness } from './types';

const FILES = import.meta.glob('/lab/tools/*.js', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** id (file name without .js) → source text. */
export function labWidgetSources(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, src] of Object.entries(FILES)) out[path.slice(path.lastIndexOf('/') + 1, -3)] = src;
  return out;
}

let harness: LabHarness | null = null;
export function labHarness(): LabHarness {
  return (harness ??= readLabHarness(labHtml));
}
