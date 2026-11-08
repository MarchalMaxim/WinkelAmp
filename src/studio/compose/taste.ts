/**
 * The user's taste (lab/ratings.md): which loved or kept widgets suit which character. The auto-composer takes a base
 * (fills the picture), maybe an accent (moves over it) and, where it is loud and full, the casket on top (its cuts slice
 * whatever is below). Only ids whose lab verdict (lab/index.html VERDICTS) is love or keep are used: an entry here whose
 * widget is now rated needs work or drop (2026-11-08) is skipped, and 25 loved or kept widgets have no entry yet (GitHub
 * issue 31). Widgets moved to lab/tools/dropped/ are never in the catalogue.
 *
 * A widget that paints its own ground (riley, horizon, miro, kusama, ikeda, score, boogie…) hides whatever is drawn
 * before it, so it is always a base. Accents draw over the picture without a ground, or tear and smear it (blocks,
 * pixelsort). Per section the composer takes the base whose fit scores highest, and the accent whose fit scores highest
 * if that is at least 0.5. So a fit is a direction in character space plus a weight: a widget is chosen only where it
 * beats every other one. The weights are balanced so that every widget here wins somewhere over a grid of characters,
 * loved ones about twice as often as kept ones. Two limits keep the quiet end simple: only current has quiet 1 (a silent
 * stretch got the current alone; while it is rated needs work, horizon takes it), and no accent has quiet 0.5 or more.
 */
import type { Character } from './character';

export type TasteRole = 'base' | 'accent' | 'top';
export const TASTE: readonly { id: string; role: TasteRole; fit: Partial<Character> }[] = [
  // bases: the picture
  { id: 'kandinsky', role: 'base', fit: { dense: 0.74, fast: 0.34 } },                  // "a complete visualization by itself"
  { id: 'rorschach', role: 'base', fit: { low: 0.88, quiet: 0.59 } },                   // ink blots, dark and slow
  { id: 'current', role: 'base', fit: { quiet: 1, fast: 0.3 } },                        // a thin wave in the fluid
  { id: 'strings', role: 'base', fit: { quiet: 0.93, dense: 0.54 } },                   // woven threads
  { id: 'fields', role: 'base', fit: { quiet: 0.69, loud: 0.39, dense: 0.39 } },        // "a good building block"
  { id: 'horizon', role: 'base', fit: { quiet: 0.93, low: 0.59 } },                     // a still seascape, for quiet music
  { id: 'miro', role: 'base', fit: { quiet: 0.62, fast: 0.72 } },                       // one melody line, stars and blobs
  { id: 'score', role: 'base', fit: { quiet: 0.78, dense: 0.69 } },                     // the music writes its own graphic score
  { id: 'marbling', role: 'base', fit: { loud: 0.58, low: 0.48, quiet: 0.29 } },        // drops on a bath; louder = a bigger drop
  { id: 'kusama', role: 'base', fit: { loud: 0.67, dense: 0.29 } },                     // bold dots and nets, colours flip with the harmony
  { id: 'riley', role: 'base', fit: { loud: 0.49, low: 0.69 } },                        // stripes the bass swells into lenses
  { id: 'ikeda', role: 'base', fit: { fast: 0.64, loud: 0.29 } },                       // black-and-white data strobes
  { id: 'boogie', role: 'base', fit: { fast: 0.74, dense: 0.29 } },                     // fast passages boogie
  { id: 'lewitt', role: 'base', fit: { dense: 0.6, fast: 0.4, quiet: 0.5 } },           // rule lines pile up; a fresh wall per section
  { id: 'delaunay', role: 'base', fit: { dense: 0.45, loud: 0.4, fast: 0.3 } },         // simultaneous discs, every note lit
  { id: 'kline', role: 'base', fit: { loud: 0.58, dense: 0.43 } },                      // big chords strike huge black bars
  { id: 'ridges', role: 'base', fit: { loud: 0.47, low: 0.47, fast: 0.24 } },           // peaks by pitch and loudness
  { id: 'fischinger', role: 'base', fit: { fast: 0.62, dense: 0.43, quiet: 0.24 } },    // formations by chord, hops on attacks
  { id: 'mclaren', role: 'base', fit: { fast: 0.69, low: 0.25 } },                      // busy music splits the panels
  { id: 'klee', role: 'base', fit: { dense: 0.69, quiet: 0.54, low: 0.25 } },           // the voices as a mosaic
  { id: 'cells', role: 'base', fit: { dense: 0.82, quiet: 0.48 } },                     // a cell per note, by harmony
  // accents: over the base
  { id: 'squares', role: 'accent', fit: { low: 0.72, loud: 0.38 } },                    // dread squares
  { id: 'flee', role: 'accent', fit: { fast: 0.72, loud: 0.24 } },                      // skittish shapes
  { id: 'murmuration', role: 'accent', fit: { loud: 0.54, dense: 0.44 } },              // a loud chord re-forms the flock into its figure
  { id: 'brush', role: 'accent', fit: { quiet: 0.43, fast: 0.77 } },                    // the melody in ink strokes
  { id: 'blocks', role: 'accent', fit: { fast: 0.5, loud: 0.5 } },                      // attacks tear the picture
  { id: 'pixelsort', role: 'accent', fit: { dense: 0.59, loud: 0.39 } },                // chords smear what is below
  { id: 'halftone', role: 'accent', fit: { low: 0.64, dense: 0.49 } },                  // overprinted dot waves
  { id: 'lenlye', role: 'accent', fit: { fast: 0.7, low: 0.25 } },                      // scratches that boil frame by frame
  { id: 'nebula', role: 'accent', fit: { dense: 0.55, quiet: 0.45 } },                  // grains orbit the sounding notes
  { id: 'mandala', role: 'accent', fit: { dense: 0.82 } },                              // chords mirrored round a centre
  { id: 'fifths', role: 'accent', fit: { dense: 0.62, quiet: 0.38 } },                  // chords strung on the circle of fifths
  // on top
  { id: 'casket', role: 'top', fit: { loud: 1, dense: 0.5 } },                          // melt, drips and chord cuts
];

/** On a song without instrument tracks, an accent whose instruments name a low one follows the bass line, and one whose
    instruments name a high one the melody (plan 2026-10-31 §9; the first list that matches wins). */
export const LINE_BY_INSTRUMENT: readonly (readonly [line: 'bassline' | 'melody', instruments: readonly string[]])[] = [
  ['bassline', ['contrabass', 'cello', 'bassoon', 'timpani', 'trombone']],
  ['melody', ['violin', 'flute', 'oboe', 'clarinet', 'trumpet']],
];
/** Score added per feel word of the user's description a widget is tagged with, and its cap. */
export const FEEL_BONUS = 0.25, FEEL_BONUS_MAX = 0.5;
/** Score added to an accent or top widget when one of its instruments is playing in the section. */
export const INSTRUMENT_BONUS = 0.2;
/** A track is present in a section when it sounds in this share of its 0.5 s bins. */
export const PRESENT = 0.3;
