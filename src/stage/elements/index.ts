/**
 * The widget registry: every element type the stage knows. Adding a widget is adding
 * its file (exporting `widget = defineWidget({...})`, see kit.ts) and one line in
 * all.ts; the element types, their styles, the script validator's checks, the
 * director's casting, the draw order, the harness's cases and docs/CAST.md all
 * derive from it.
 */
import type { StageElement } from '../types';
import type { Widget } from '../kit';
import * as ALL from './all';

type Registered = (typeof ALL)[keyof typeof ALL];

/** Every widget, by type name (alphabetical: the draw order is each widget's `layer`). */
export const WIDGETS: readonly Registered[] = Object.values(ALL);

/** The cast: each element type follows one stream of the music (its widget file says which). */
export type ElementType = Registered['type'];

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
