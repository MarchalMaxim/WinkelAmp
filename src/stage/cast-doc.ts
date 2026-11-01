/**
 * docs/CAST.md, rendered from the widget registry: the composer's cast table and
 * every widget's knobs. `npm run cast` writes it, `npm run cast -- --check` tells
 * whether the file on disk is current.
 */
import { WIDGETS } from './elements';
import { DEFAULT_DEPTH, FEATURES, type Knob, type Widget } from './kit';

const num = (v: number) => String(Number(v.toFixed(3)));
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const knob = (k: Knob) => `\`${k.name}\` ${num(k.min)}..${num(k.max)} [${num(k.value)}${k.drive ? `, ${k.drive}` : ''}] — ${k.doc}`;

export function castDoc(widgets: readonly Widget[] = WIDGETS as readonly Widget[]): string {
  const rows = widgets.map((w) =>
    `| \`${w.type}\` | ${cell(w.follows)} | ${cell(w.styles.map((s) => `\`${s.name}\` ${s.doc}`).join(' · '))} | ${cell(w.knobs.length ? w.knobs.map(knob).join(' · ') : '—')} | ${cell(w.use)} |`,
  );
  return [
    '# The cast',
    '',
    '<!-- Generated from src/stage/elements (each widget file\'s defineWidget) by `npm run cast`. Do not edit by hand. -->',
    '',
    'Every element follows one stream of the music. Up to four on stage at once. The handbook',
    '([COMPOSING.md](COMPOSING.md) §3) has the params every element shares; this is each one\'s own.',
    '',
    '| Element | Follows | Styles (first = default) | Knobs: range [default] | Use it for |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    '## Knobs and drives',
    '',
    'A knob is set in `params.knobs`, by name: a number sets its value (`"knobs": { "trail": 6 }`), an object',
    'sets any of `value`, `drive` and `depth` (`"knobs": { "decay": { "value": 1.5, "drive": "+level" } }`).',
    `A drive pushes the knob up (\`+\`) or down (\`-\`) with a feature of the music, by \`depth\` [${DEFAULT_DEPTH}] of its`,
    'range: at full strength the knob moves `depth × (max − min)` from its value (`pitch` pushes around its middle,',
    'so a middle note leaves the knob where it is). The value is kept inside the range. The features, each 0..1:',
    '',
    ...FEATURE_DOCS.filter(([f]) => (FEATURES as readonly string[]).includes(f)).map(([f, d]) => `- \`${f}\`: ${d}`),
    '',
    'They move on music time only: in silence a driven knob holds still, like the rest of the picture.',
    '',
  ].join('\n');
}

const FEATURE_DOCS: [string, string][] = [
  ['level', 'how loud: the strongest attack, halving in 0.8 s, never below the loudness'],
  ['rate', 'how busy: attacks per second ÷ 8'],
  ['pitch', 'how high: the top note sounding (C1 0 … C8 1), held through rests'],
  ['bass', 'how much low end: the bass level'],
  ['density', 'how full: pitch classes sounding at once ÷ 6'],
];
