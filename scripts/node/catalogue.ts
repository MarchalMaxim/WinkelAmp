// The widget catalogue in Node (check-show, describe-song, widget-docs, the dev API): each lab/tools/*.js evaluated in
// node:vm with a canvas whose 2D context draws nothing, so only names, blurbs and knobs come out. lab/tools/dropped/
// is never read (only *.js directly in lab/tools/).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { toMeta } from '../../src/widgets/catalogue';
import { readLabHarness } from '../../src/widgets/lab-harness';
import { tagsOf, type TagWords } from '../../src/widgets/tags';
import type { IconLib, ToolDef, WidgetMeta, WidgetTags } from '../../src/widgets/types';
import { REPO } from './pack-io';

/** Anything: callable, every property another stub, assignments kept. Gradients, patterns, paths, matrices. */
function stub(): any {
  const kept: Record<PropertyKey, unknown> = {};
  const p: any = new Proxy(function () {}, {
    get: (_t, k) => (k in kept ? kept[k] : k === Symbol.toPrimitive ? () => 0 : k === 'then' || k === 'toJSON' ? undefined : p),
    set: (_t, k, v) => ((kept[k] = v), true),
    apply: () => p,
    construct: () => p,
  });
  return p;
}

/** A 2D context that draws nothing: pixel reads give zeros, measureText width 0, set properties read back. */
function context2d(canvas: object): unknown {
  const kept: Record<PropertyKey, unknown> = { canvas };
  const pixels = (w: number, h: number) => {
    const W = Math.max(1, Math.floor(Math.abs(w) || 1)), H = Math.max(1, Math.floor(Math.abs(h) || 1));
    return { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  };
  const own: Record<string, unknown> = {
    getImageData: (_x: number, _y: number, w: number, h: number) => pixels(w, h),
    createImageData: (w: number | { width: number; height: number }, h?: number) => (typeof w === 'object' ? pixels(w.width, w.height) : pixels(w, h ?? 1)),
    measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }),
    getLineDash: () => [],
    isPointInPath: () => false,
    getTransform: () => stub(),
  };
  return new Proxy({}, {
    get: (_t, k) => (k in kept ? kept[k] : typeof k === 'string' && k in own ? own[k] : k === 'then' ? undefined : () => stub()),
    set: (_t, k, v) => ((kept[k] = v), true),
  });
}

function canvasEl(): unknown {
  const c: Record<string, unknown> = { width: 300, height: 150, style: {} };
  let g: unknown;
  c.getContext = () => (g ??= context2d(c));
  c.toDataURL = () => 'data:,';
  c.addEventListener = () => {};
  return c;
}

/** A fresh vm realm with what the tool files touch at load time (no Worker, no OffscreenCanvas: pixelsort makes its
    Worker lazily, on its first frame). */
function realm() {
  const document = {
    createElement: (tag: string) => (String(tag).toLowerCase() === 'canvas' ? canvasEl() : { style: {}, appendChild() {}, addEventListener() {} }),
    body: { appendChild() {} },
  };
  const sandbox: Record<string, unknown> = {
    document, Path2D: function () { return stub(); }, DOMMatrix: function () { return stub(); }, Image: function () { return stub(); },
    performance: { now: () => 0 }, console,
  };
  sandbox.window = Object.assign(sandbox, { NOTES: [] });
  return createContext(sandbox);
}

/** lab/tags.json (widget id → tags), or null when the repo has none. */
export function readLabTags(repo: string = REPO): Record<string, WidgetTags> | null {
  const file = resolve(repo, 'lab', 'tags.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, WidgetTags>) : null;
}

/** lab/tag-words.json: the feel and instrument vocabulary. */
export function readLabTagWords(repo: string = REPO): TagWords {
  return JSON.parse(readFileSync(resolve(repo, 'lab', 'tag-words.json'), 'utf8')) as TagWords;
}

export interface Catalogue { widgets: Map<string, WidgetMeta>; failed: { id: string; error: string }[] }

/** Every lab widget's WidgetMeta: TOOL_IDS order, then any other lab/tools/*.js (by name). `sources` replaces the files.
    `meta.tags` is the widget's lab/tags.json entry, or null (untagged, or no lab/tags.json). */
export function loadCatalogue(o: { repo?: string; sources?: Record<string, string> } = {}): Catalogue {
  const repo = o.repo ?? REPO;
  const harness = readLabHarness(readFileSync(resolve(repo, 'lab', 'index.html'), 'utf8'));
  const sources = o.sources ?? Object.fromEntries(
    readdirSync(resolve(repo, 'lab', 'tools'), { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.js'))
      .map((d) => [d.name.slice(0, -3), readFileSync(resolve(repo, 'lab', 'tools', d.name), 'utf8')]),
  );
  const ids = [...harness.toolIds.filter((id) => id in sources), ...Object.keys(sources).filter((id) => !harness.toolIds.includes(id)).sort()];
  const tags = readLabTags(repo);
  const ctx = realm();
  const icon = runInContext(`(${harness.iconSource})`, ctx, { filename: 'lab/index.html#ICON' }) as IconLib;
  const widgets = new Map<string, WidgetMeta>(), failed: Catalogue['failed'] = [];
  for (const id of ids) {
    try {
      const run = runInContext(`(function (TOOLS, ICON, CHORDS) {\n${sources[id]}\n})`, ctx, { filename: `lab/tools/${id}.js` }) as
        (tools: ToolDef[], icon: IconLib, chords: unknown[]) => void;
      const tools: ToolDef[] = [];
      run(tools, icon, []);
      if (tools.length !== 1 || tools[0]?.id !== id) throw new Error(`must push exactly one tool with id '${id}' (pushed: ${tools.map((t) => t?.id).join(', ') || 'none'})`);
      widgets.set(id, toMeta(tools[0], harness.verdicts[id] ?? null, tagsOf(tags, id)));
    } catch (e) {
      failed.push({ id, error: e && typeof (e as Error).message === 'string' ? (e as Error).message : String(e) });   // vm errors are another realm's Error
    }
  }
  return { widgets, failed };
}
