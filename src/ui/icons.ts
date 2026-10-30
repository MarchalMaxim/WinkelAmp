/** Tiny inline icon set (24×24, stroke-based). */
const paths: Record<string, string> = {
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/><circle cx="12" cy="12" r="2.2"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  pause: '<rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor"/>',
  prev: '<path d="M18 6v12L9 12zM6 6v12"/>',
  next: '<path d="M6 6v12l9-6zM18 6v12"/>',
  volume: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  record: '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h0"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  // Scene glyphs.
  bloom: '<ellipse cx="12" cy="6.5" rx="2.6" ry="4"/><ellipse cx="12" cy="17.5" rx="2.6" ry="4"/><ellipse cx="6.5" cy="12" rx="4" ry="2.6"/><ellipse cx="17.5" cy="12" rx="4" ry="2.6"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  swarm: '<circle cx="5" cy="8" r="1" fill="currentColor"/><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="14" cy="7" r="1" fill="currentColor"/><circle cx="19" cy="10" r="1" fill="currentColor"/><circle cx="7" cy="14" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="17" cy="16" r="1" fill="currentColor"/><circle cx="10" cy="19" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
  ribbons: '<path d="M2 8c4-4 6 4 10 0s6 4 10 0M2 13c4-4 6 4 10 0s6 4 10 0M2 18c4-4 6 4 10 0s6 4 10 0"/>',
  pulse: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="9"/>',
};

export function icon(name: string) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
}

/** Fills every `[data-icon]` placeholder. */
export function hydrateIcons(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon!);
  });
}

export function setIcon(el: Element | null, name: string) {
  const holder = el?.querySelector<HTMLElement>('[data-icon]');
  if (holder && holder.dataset.icon !== name) {
    holder.dataset.icon = name;
    holder.innerHTML = icon(name);
  }
}
