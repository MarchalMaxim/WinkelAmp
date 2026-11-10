// Runs one unchanged lab/tools/<id>.js. The lab evaluates the files at global scope; every tool is an IIFE that only
// pushes into TOOLS and reads ICON, CHORDS, KIT and window.NOTES, so passing the harness names as parameters is the same.
// A routed instance (it listens to a part) also gets a `window` whose NOTES is the part's notes, so
// the widgets that read window.NOTES (at load or later) see the part; CHORDS is then the part's chords. That window's
// SONG_NOTES is the whole song's notes, for a widget that places its part within the piece (ivory).
import type { Chord, IconLib, Kit, Note, ToolDef } from './types';

/** window, except NOTES: the part's notes, and SONG_NOTES: the whole song's (`all`, else the real window's NOTES).
    Functions are bound to the real window (native ones need it as `this`). */
function windowWithNotes(notes: Note[], all?: Note[]): Window {
  const w = window as unknown as Record<PropertyKey, unknown>;
  return new Proxy(window, {
    get(_, p) {
      if (p === 'NOTES') return notes;
      if (p === 'SONG_NOTES') return all ?? w.NOTES;
      const v = w[p];
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(window) : v;
    },
  });
}

export function instantiate(id: string, source: string, env: { icon: IconLib; kit: Kit; chords: Chord[]; notes?: Note[]; all?: Note[] }): ToolDef {
  const tools: ToolDef[] = [];
  if (env.notes) {
    const run = new Function('TOOLS', 'ICON', 'CHORDS', 'KIT', 'window', `${source}\n//# sourceURL=lab/tools/${id}.js`);
    run(tools, env.icon, env.chords, env.kit, windowWithNotes(env.notes, env.all));
  } else {
    const run = new Function('TOOLS', 'ICON', 'CHORDS', 'KIT', `${source}\n//# sourceURL=lab/tools/${id}.js`);
    run(tools, env.icon, env.chords, env.kit);
  }
  const mine = tools.filter((t) => t && t.id === id);
  if (tools.length !== 1 || mine.length !== 1)
    throw new Error(`lab/tools/${id}.js must push exactly one tool with id '${id}' (pushed: ${tools.map((t) => t?.id).join(', ') || 'none'})`);
  return mine[0];
}
