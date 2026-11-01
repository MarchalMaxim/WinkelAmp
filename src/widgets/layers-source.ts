/// <reference types="vite/client" />
// The shared layer maths in the browser: lab/layers/*.js bundled by Vite as text and evaluated by evalLayers, the
// same text the lab runs as classic scripts. Browser only (Node: scripts/node/layers.ts).
import { evalLayers, type WaLayers } from './layers';

const FILES = import.meta.glob('/lab/layers/*.js', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** File name (e.g. 'persist.js') → source text. */
export function layerSources(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, src] of Object.entries(FILES)) out[path.slice(path.lastIndexOf('/') + 1)] = src;
  return out;
}

let layers: WaLayers | null = null;
/** One WaLayers for the whole studio, evaluated on first use (the UI reaches the shared code without main.ts). */
export function studioLayers(): WaLayers {
  return (layers ??= evalLayers(layerSources()));
}
