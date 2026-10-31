/**
 * The user's taste (lab/ratings.md): which loved or kept widgets suit which character. The auto-composer takes a base
 * (fills the picture), maybe an accent (moves over it) and, where it is loud and full, the casket on top (its cuts slice
 * whatever is below). Only ids whose lab verdict (lab/index.html VERDICTS) is love or keep are used; dropped widgets live
 * in lab/tools/dropped/ and are never in the catalogue.
 */
import type { Character } from './character';

export type TasteRole = 'base' | 'accent' | 'top';
export const TASTE: readonly { id: string; role: TasteRole; fit: Partial<Character> }[] = [
  { id: 'kandinsky', role: 'base', fit: { dense: 1, fast: 0.5 } },     // "a complete visualization by itself"
  { id: 'rorschach', role: 'base', fit: { low: 0.8, quiet: 0.5 } },    // ink blots, dark and slow
  { id: 'current', role: 'base', fit: { quiet: 1, fast: 0.3 } },       // a thin wave in the fluid
  { id: 'strings', role: 'base', fit: { quiet: 0.8, dense: 0.4 } },    // woven threads
  { id: 'fields', role: 'base', fit: { quiet: 0.6 } },                 // "a good building block"
  { id: 'squares', role: 'accent', fit: { low: 1, loud: 0.5 } },       // dread squares
  { id: 'flee', role: 'accent', fit: { fast: 1, loud: 0.3 } },         // skittish shapes
  { id: 'casket', role: 'top', fit: { loud: 1, dense: 0.5 } },         // melt, drips and chord cuts
];
