/**
 * The widget registry: every element type the stage knows, one import per widget
 * file. Adding a widget is adding its file (exporting `widget = defineWidget({...})`,
 * see kit.ts) and one line here; the element types, their styles, the script
 * validator's checks, the director's casting, the draw order and docs/CAST.md all
 * derive from this list.
 */
import type { StageElement } from '../types';
import type { Widget } from '../kit';
import { widget as bass } from './bass';
import { widget as bloom } from './bloom';
import { widget as drip } from './drip';
import { widget as fluid } from './fluid';
import { widget as melody } from './melody';
import { widget as pulse } from './pulse';
import { widget as slash } from './slash';
import { widget as sparks } from './sparks';
import { widget as wave } from './wave';

/** In the cast table's order. */
export const WIDGETS = [melody, bass, sparks, bloom, pulse, wave, fluid, slash, drip] as const;

/** The cast: each element type follows one stream of the music (its widget file says which). */
export type ElementType = (typeof WIDGETS)[number]['type'];

const byType = new Map<string, Widget>();
for (const w of WIDGETS) {
  if (byType.has(w.type)) throw new Error(`two widgets are called "${w.type}"`);
  byType.set(w.type, w as Widget);
}

/** The widget behind a type, or undefined for a type nobody registered. */
export const widgetOf = (type: string): Widget | undefined => byType.get(type);

const table = <V>(f: (w: Widget) => V) => Object.fromEntries(WIDGETS.map((w) => [w.type, f(w as Widget)])) as Record<ElementType, V>;

/** The looks each element type can take; the first is its default. */
export const STYLES: Record<ElementType, readonly string[]> = table((w) => w.styleNames);

/** One factory per element type (the stage keys instances by cast id). */
export const ELEMENTS: Record<ElementType, () => StageElement> = table((w) => w.create);
