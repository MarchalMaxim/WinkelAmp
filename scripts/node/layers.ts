// The shared layer maths in Node (tests, scripts): every lab/layers/*.js read from disk and evaluated by evalLayers,
// the same text the lab runs as classic scripts and the studio bundles.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evalLayers, type WaLayers } from '../../src/widgets/layers';
import { REPO } from './pack-io';

export function loadLayers(repo: string = REPO): WaLayers {
  const dir = resolve(repo, 'lab', 'layers');
  const sources: Record<string, string> = {};
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isFile() && d.name.endsWith('.js')) sources[d.name] = readFileSync(resolve(dir, d.name), 'utf8');
  }
  return evalLayers(sources);
}
