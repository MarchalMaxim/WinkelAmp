// Song ids and titles from file names (the study tool's rule), browser-safe: the ingest CLI, the ears server and the
// studio's in-browser fallback name a dropped recording the same way.

/** 'C:\music\Prelude_in C#.mp3' → { id: 'prelude-in-c', title: 'Prelude In C#' }; the id is '' when nothing is left of it. */
export function nameFromFile(file: string): { id: string; title: string } {
  const base = file.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return {
    id: stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    title: stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

/** `base` when it is free, else base-2, base-3…: a different recording under a taken name. */
export function freeId(base: string, taken: (id: string) => boolean): string {
  if (!taken(base)) return base;
  for (let n = 2; ; n++) if (!taken(`${base}-${n}`)) return `${base}-${n}`;
}
