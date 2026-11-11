/**
 * The studio's button icons: inline SVG in the Lucide set's style (24 grid, 2 stroke, round caps), so they take the
 * button's text colour. Paths are Lucide's (ISC licence, lucide.dev) except violin, brass and the transport fills,
 * which are drawn to match. Icons support a label; an icon-only button keeps its aria-label.
 */
import './icons.css';
import { TRACKS } from '../pack/instruments';

const PATHS = {
  play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/>',
  pause: '<rect x="14" y="4" width="5" height="16" rx="1"/><rect x="5" y="4" width="5" height="16" rx="1"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  hear: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.8"/>',
  note: '<path d="M21 16V3a1 1 0 0 0-1.3-1l-10 2.9a1 1 0 0 0-.7 1V19"/><circle cx="18" cy="16" r="3"/><circle cx="6" cy="19" r="3"/>',
  // instruments: one per family where a person can name it at 16 px
  keys: '<path d="M10 13v4"/><path d="M14 13v4"/><path d="M18 13v4"/><path d="M2 13h20"/><path d="M22 11.5A3.5 3.5 0 0 0 18.5 8a3.5 3.5 0 0 1-3.2-2A7 7 0 0 0 2 9v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z"/><path d="M6 13v4"/>',
  plucked: '<path d="m11.9 12.1 4.5-4.5"/><path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.1 1.1A2 2 0 0 0 17 4.8v1.4a2 2 0 0 1-.6 1.4A2 2 0 0 1 17.8 7h1.4a2 2 0 0 0 1.4-.6l1.1-1.1a1 1 0 0 0 0-1.4z"/><path d="m6 16 2 2"/><path d="M8.2 9.9A3 3 0 0 1 11 8a5 5 0 0 1 5 5 3 3 0 0 1-1.9 2.8l-.9.4A2 2 0 0 0 12 18a4 4 0 0 1-4 4 6 6 0 0 1-6-6 4 4 0 0 1 4-4 2 2 0 0 0 1.9-1.2z"/>',
  strings: '<path d="M10 11c-2.6 0-4.4 1.5-4.4 3.4 0 1.2.9 1.9 1.5 2.4-.6.5-1.7 1.2-1.7 2.8C5.4 21 7.3 22 10 22s4.6-1 4.6-3.4c0-1.6-1.1-2.3-1.7-2.8.6-.5 1.5-1.2 1.5-2.4C14.4 12.5 12.6 11 10 11z"/><path d="M10 11V4.5"/><path d="M10 4.5A1.5 1.5 0 1 0 8.5 3"/><path d="m15 3.5 6 17"/>',
  percussion: '<path d="m2 2 8 8"/><path d="m22 2-8 8"/><ellipse cx="12" cy="9" rx="10" ry="5"/><path d="M7 13.4v7.9"/><path d="M12 14v8"/><path d="M17 13.4v7.9"/><path d="M2 9v8a10 5 0 0 0 20 0V9"/>',
  voice: '<path d="m11 7.6-6 8.2a1 1 0 0 0 .1 1.3l.8.8a1 1 0 0 0 1.3.1L15.1 12"/><path d="M16.5 21.2c-1-.7-2.1-1.2-3.5-1.2-2.1 0-3.9 2.4-6 2-2.1-.4-2.8-3.4-1.5-4.5"/><circle cx="16" cy="7" r="5"/>',
  brass: '<path d="M2 9h3"/><path d="M8 9h8l5-4v14l-5-4H8a3 3 0 0 1 0-6z"/><path d="M10 9V5.5"/><path d="M13 9V5.5"/>',
  winds: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
} as const;

export type IconName = keyof typeof PATHS;
/** Drawn solid, as transport marks are. */
const SOLID = new Set<IconName>(['play', 'pause', 'stop']);

/** An inline SVG for a button: 16 px unless CSS says otherwise (see icons.css), in the button's text colour. */
export function icon(name: IconName): string {
  const solid = SOLID.has(name);
  return `<svg class="ico" viewBox="0 0 24 24" width="16" height="16" fill="${solid ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}

/** Icon then label: a play button's inner HTML, say. The label is text, never markup. */
export function withIcon(name: IconName, label: string): string {
  return `${icon(name)}<span>${label.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</span>`;
}

/** Words in a transcriber's free-text label, in the order they are tried ("bassoon" before "bass", "english horn" before "horn"). */
const WORDS: [IconName, readonly string[]][] = [
  ['winds', ['bassoon', 'english horn', 'oboe', 'clarinet', 'flute', 'piccolo', 'recorder', 'pipe', 'sax', 'wind', 'reed']],
  ['brass', ['trumpet', 'trombone', 'tuba', 'horn', 'brass', 'cornet', 'bugle']],
  ['keys', ['piano', 'keyboard', 'organ', 'harpsichord', 'celesta', 'accordion']],
  ['plucked', ['guitar', 'harp', 'lute', 'banjo', 'mandolin', 'ukulele', 'pluck']],
  ['strings', ['violin', 'viola', 'cello', 'bass', 'string', 'fiddle']],
  ['percussion', ['timpani', 'drum', 'percussion', 'cymbal', 'xylophone', 'marimba', 'glockenspiel', 'vibraphone', 'bell']],
  ['voice', ['voice', 'vocal', 'choir', 'chorus', 'sing']],
];

/** An instrument's icon: its track's family when the key is a track id, else a word in its label; the note when nothing fits. */
export function instrumentIconName(label: string, key?: string): IconName {
  const track = key !== undefined && Object.prototype.hasOwnProperty.call(TRACKS, key) ? TRACKS[key as keyof typeof TRACKS] : null;
  if (track) return track.family;
  const name = label.toLowerCase();
  return WORDS.find(([, ws]) => ws.some((w) => name.includes(w)))?.[0] ?? 'note';
}

export const instrumentIcon = (label: string, key?: string): string => icon(instrumentIconName(label, key));

/** The icon of what a layer listens to (a track id or `family:<f>`); null for 'all', the lines and the note kinds. */
export function listenIconName(listen: string): IconName | null {
  const f = listen.startsWith('family:') ? listen.slice(7) : TRACKS[listen as keyof typeof TRACKS]?.family;
  return f && f in PATHS ? (f as IconName) : null;
}
