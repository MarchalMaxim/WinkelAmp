// A still of each widget, for the pickers: lab/thumbs/<id>.webp, made by `npm run widget-thumbs`.
// Browser only. A widget without one gets its colour instead.
const FILES = import.meta.glob('/lab/thumbs/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export const thumbUrl = (id: string): string | undefined => FILES[`/lab/thumbs/${id}.webp`];

/** The picture of a widget in a list, with its hue behind it until it loads (or if it has none). */
export function thumbHtml(id: string, hue: number): string {
  const url = thumbUrl(id);
  return `<span class="thumb" style="--hue:${hue}">${url ? `<img src="${url}" alt="" loading="lazy" decoding="async">` : ''}</span>`;
}
