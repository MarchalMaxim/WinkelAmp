/// <reference types="node" />
// Loading a lab widget the way a host does: its file, the ICON stand-in, and the real KIT from lab/kit.js.
import { readFileSync } from 'node:fs';
import { instantiate } from '../../src/widgets/instantiate';
import { evalKit } from '../../src/widgets/lab-harness';
import type { Chord, IconLib, Kit, Note, ToolDef } from '../../src/widgets/types';

let loaded: Kit | null = null;
/** window.KIT from lab/kit.js. */
export function kit(): Kit {
  return (loaded ??= evalKit(readFileSync(new URL('../../lab/kit.js', import.meta.url), 'utf8')));
}

/** The text of lab/tools/<id>.js. */
export const widgetSource = (id: string): string => readFileSync(new URL(`../../lab/tools/${id}.js`, import.meta.url), 'utf8');

/** lab/tools/<id>.js instantiated with the real KIT; icon defaults to a bare stand-in, chords to none. */
export function loadWidget(id: string, o: { icon?: IconLib; chords?: Chord[]; notes?: Note[]; all?: Note[] } = {}): ToolDef {
  const icon = o.icon ?? ({ ink: '#fff', gauge() {} } as unknown as IconLib);
  return instantiate(id, widgetSource(id), { icon, kit: kit(), chords: o.chords ?? [], notes: o.notes, all: o.all });
}

/** What a widget reads back from a 2D context: plausible empty values, and a gradient stand-in for anything else. */
export const readBack = (name: string, a: any[]): unknown => {
  const pixels = (w: number, h: number) => { const W = Math.max(1, Math.floor(w) || 1), H = Math.max(1, Math.floor(h) || 1); return { width: W, height: H, data: new Uint8ClampedArray(4 * W * H) }; };
  switch (name) {
    case 'measureText': return { width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 };
    case 'getImageData': return pixels(a[2], a[3]);
    case 'createImageData': return typeof a[0] === 'object' ? pixels(a[0].width, a[0].height) : pixels(a[0], a[1]);
    case 'getLineDash': return [];
    case 'isPointInPath': return false;
    default: return { addColorStop() {} };
  }
};

/** A 2D context that logs every call and every set property as one line of text (numbers to 3 places, canvases as #n, so
    equal drawings are equal logs). */
export function recorder(log: { push(line: string): unknown }, ids: Map<unknown, number>) {
  const fmt = (v: unknown): string => typeof v === 'number' ? v.toFixed(3) : ids.has(v) ? `#${ids.get(v)}` : typeof v === 'object' ? 'obj' : String(v);
  return (canvas: unknown) => new Proxy({ canvas } as Record<string, unknown>, {
    get: (o, k) => k in o ? o[k as string] : (...a: unknown[]) => { log.push(`${String(k)}(${a.map(fmt).join(',')})`); return readBack(String(k), a); },
    set: (o, k, v) => { o[k as string] = v; log.push(`${String(k)}=${fmt(v)}`); return true; },
  });
}
