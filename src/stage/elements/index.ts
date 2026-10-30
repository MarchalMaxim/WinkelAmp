/** The element registry: one factory per element type (the stage keys instances by cast id). */
import type { ElementType, StageElement } from '../types';
import { Bass } from './bass';
import { Bloom } from './bloom';
import { Fluid } from './fluid';
import { Melody } from './melody';
import { Pulse } from './pulse';
import { Sparks } from './sparks';
import { Wave } from './wave';

export const ELEMENTS: Record<ElementType, () => StageElement> = {
  melody: () => new Melody(),
  bass: () => new Bass(),
  sparks: () => new Sparks(),
  bloom: () => new Bloom(),
  pulse: () => new Pulse(),
  wave: () => new Wave(),
  fluid: () => new Fluid(),
};
