/** The "Look" panel: scenes, colors, feel sliders, mirror, saved looks, and the patch bay. */
import type { Features } from '../audio/features';
import { MOTIONS, SOURCES, sourceValue, DEFAULT_MAPPING, type MotionId, type SourceId } from '../mapping';
import { MIRRORS, SCENE_IDS, cloneLook, type Look, type SavedLook } from '../settings';
import { PALETTES, hsl, paletteColor } from '../visual/color';
import { icon } from './icons';

const SCENE_LABELS: Record<string, string> = { bloom: 'Bloom', swarm: 'Swarm', ribbons: 'Ribbons', pulse: 'Pulse' };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface PanelCallbacks {
  change(look: Look, what: string): void;
  surprise(): void;
  save(): void;
  recall(saved: SavedLook): void;
  remove(index: number): void;
}

export class Panel {
  private meters = new Map<MotionId, HTMLElement>();

  constructor(private look: () => Look, private cb: PanelCallbacks) {
    this.build();
  }

  private set(mutate: (l: Look) => void, what: string) {
    const next = cloneLook(this.look());
    mutate(next);
    this.cb.change(next, what);
  }

  private build() {
    $('scenes').innerHTML = SCENE_IDS.map(
      (id, i) =>
        `<button class="scene-card" role="radio" data-scene="${id}" title="${SCENE_LABELS[id]} (${i + 1})">${icon(id)}<span>${SCENE_LABELS[id]}</span></button>`,
    ).join('');
    $('scenes').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-scene]');
      if (b) this.set((l) => (l.scene = b.dataset.scene as Look['scene']), 'scene');
    });

    $('palettes').innerHTML = PALETTES.map((p) => {
      const stops = Array.from({ length: 7 }, (_, i) => hsl(paletteColor(p, i / 6))).join(',');
      const bg = p.stops.length ? `conic-gradient(${stops})` : 'conic-gradient(from 0deg, hsl(0 90% 58%), hsl(60 90% 58%), hsl(120 90% 58%), hsl(180 90% 58%), hsl(240 90% 58%), hsl(300 90% 58%), hsl(360 90% 58%))';
      return `<button class="swatch" role="radio" data-palette="${p.id}" title="${p.name}"><span class="swatch-chip" style="background:${bg}"></span>${p.name}</button>`;
    }).join('');
    $('palettes').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-palette]');
      if (b) this.set((l) => (l.palette = b.dataset.palette!), 'palette');
    });

    for (const key of ['wild', 'trails', 'drift'] as const) {
      const input = $<HTMLInputElement>(key);
      input.addEventListener('input', () => {
        this.set((l) => (l[key] = Number(input.value)), key);
      });
    }

    $('mirror').innerHTML = MIRRORS.map(
      (n) => `<button role="radio" data-mirror="${n}" title="${n === 1 ? 'No mirror' : `${n}-way mirror`}">${n === 1 ? 'Off' : n}</button>`,
    ).join('');
    $('mirror').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mirror]');
      if (b) this.set((l) => (l.mirror = Number(b.dataset.mirror)), 'mirror');
    });

    $('surprise').addEventListener('click', () => this.cb.surprise());
    $('save-look').addEventListener('click', () => this.cb.save());

    const options = SOURCES.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
    $('routes').innerHTML = MOTIONS.map(
      (m) => `
      <div class="route" data-route="${m.id}" title="${m.hint}">
        <div class="route-name">${m.label}<small>follows</small></div>
        <select aria-label="${m.label} follows">${options}</select>
        <div class="route-meter" title="What the sound source is doing right now"><i></i></div>
        <div class="route-amount"><input type="range" min="0" max="1" step="0.01" aria-label="${m.label} amount" /></div>
      </div>`,
    ).join('');
    $('routes').querySelectorAll<HTMLElement>('.route').forEach((row) => {
      const id = row.dataset.route as MotionId;
      this.meters.set(id, row.querySelector('.route-meter i')!);
      row.querySelector('select')!.addEventListener('change', (e) => {
        const v = (e.target as HTMLSelectElement).value as SourceId;
        this.set((l) => (l.mapping[id].source = v), 'mapping');
      });
      const range = row.querySelector<HTMLInputElement>('input')!;
      range.addEventListener('input', () => this.set((l) => (l.mapping[id].amount = Number(range.value)), 'mapping'));
    });
    $('reset-routes').addEventListener('click', () =>
      this.set((l) => (l.mapping = JSON.parse(JSON.stringify(DEFAULT_MAPPING))), 'mapping'),
    );

    $('saved').addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const del = t.closest<HTMLElement>('[data-del]');
      if (del) return this.cb.remove(Number(del.dataset.del));
      const rec = t.closest<HTMLElement>('[data-recall]');
      if (rec) this.cb.recall(this.saved[Number(rec.dataset.recall)]);
    });
  }

  private saved: SavedLook[] = [];

  renderSaved(saved: SavedLook[]) {
    this.saved = saved;
    $('saved').innerHTML = saved
      .map(
        (s, i) =>
          `<span class="chip"><button data-recall="${i}" title="Use this look">${escapeHtml(s.name)}</button><button class="chip-del" data-del="${i}" title="Forget this look" aria-label="Forget ${escapeHtml(s.name)}">${icon('x')}</button></span>`,
      )
      .join('');
  }

  /** Reflects a look in every control. */
  sync(look: Look) {
    document.querySelectorAll<HTMLElement>('[data-scene]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.scene === look.scene)));
    document.querySelectorAll<HTMLElement>('[data-palette]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.palette === look.palette)));
    document.querySelectorAll<HTMLElement>('[data-mirror]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.mirror) === look.mirror)));
    for (const key of ['wild', 'trails', 'drift'] as const) setRange($<HTMLInputElement>(key), look[key]);
    $('routes').querySelectorAll<HTMLElement>('.route').forEach((row) => {
      const r = look.mapping[row.dataset.route as MotionId];
      row.querySelector('select')!.value = r.source;
      setRange(row.querySelector('input')!, r.amount);
    });
  }

  /** Live meters: show what each motion's sound source is doing. */
  tick(f: Features, look: Look) {
    if (!($('patch') as HTMLDetailsElement).open) return;
    for (const [id, el] of this.meters) {
      el.style.width = `${Math.round(sourceValue(f, look.mapping[id].source) * 100)}%`;
    }
  }
}

export function setRange(input: HTMLInputElement, v: number) {
  input.value = String(v);
  paintRange(input);
}

/** Sliders show their filled part via a CSS variable. */
export function paintRange(input: HTMLInputElement) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 1);
  input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
