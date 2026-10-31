// Runs one unchanged lab/tools/<id>.js. The lab evaluates the files at global scope; every tool is an IIFE that only
// pushes into TOOLS and reads ICON, CHORDS and window.NOTES, so passing the harness names as parameters is the same.
import type { Chord, IconLib, ToolDef } from './types';

export function instantiate(id: string, source: string, env: { icon: IconLib; chords: Chord[] }): ToolDef {
  const tools: ToolDef[] = [];
  const run = new Function('TOOLS', 'ICON', 'CHORDS', `${source}\n//# sourceURL=lab/tools/${id}.js`);
  run(tools, env.icon, env.chords);
  const mine = tools.filter((t) => t && t.id === id);
  if (tools.length !== 1 || mine.length !== 1)
    throw new Error(`lab/tools/${id}.js must push exactly one tool with id '${id}' (pushed: ${tools.map((t) => t?.id).join(', ') || 'none'})`);
  return mine[0];
}
