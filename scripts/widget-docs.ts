/**
 * Prints the widget catalogue to stdout, from the lab's widget files, verdicts and tags (lab/tags.json), so a session
 * composing a show knows what each widget is for, what it feels like and which instruments suit it.
 *
 *   npm run widget-docs                 every widget
 *   npm run widget-docs -- --id <id>    one widget
 * Exits 1 when lab/tags.json has errors; its warnings (widgets without tags) go to stderr.
 */
import { validateTags } from '../src/widgets/tags';
import type { WidgetMeta } from '../src/widgets/types';
import { type Catalogue, loadCatalogue, readLabHarness, readLabTags, readLabTagWords } from './node/catalogue';

const cell = (s: string) => s.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
const num = (v: number) => `${Math.round(v * 1000) / 1000}`;

/** 'Feel: silky, longing · Suits: violin, cello · Role: base', in lab/tags.json's words (lab/tag-words.json). */
const tagLine = (m: WidgetMeta) => m.tags
  ? `Feel: ${m.tags.feel.join(', ')} · Suits: ${m.tags.instruments.join(', ')} · Role: ${m.tags.role}${m.tags.noteType ? ` · Note type: ${m.tags.noteType}` : ''}`
  : 'Not tagged yet.';

const LEGEND = '_Feel: synesthetic feel words (`lab/tag-words.json` says what each looks and sounds like). Suits: instruments that go well with it. Role: where it sits in a stack: **under** paints first and never darkens what is on top; **ground** paints its own canvas, so it goes first; **base** fills the picture but lets others show; **texture** is a fine ornament over the others, never the main picture; **lead** is the main character the eye follows; **accent** moves over a base; **top** works on whatever is below it; **standalone** is not a layer at all but a whole show by itself. Note type: what the studio gives it as `listen` when it is placed where there are enough of those notes._';

function catalogueText({ widgets, failed }: Catalogue, only: string | null): string {
  if (failed.length) throw new Error(`widgets that do not load: ${failed.map((f) => `${f.id} (${f.error})`).join(', ')}`);
  if (only && !widgets.has(only)) throw new Error(`no widget '${only}' (${[...widgets.keys()].join(', ')})`);
  const drives = new Map(readLabHarness().drives);
  const groups: [string, (m: WidgetMeta) => boolean][] = [
    ['Loved', (m) => m.verdict?.v === 'love'],
    ['Kept', (m) => m.verdict?.v === 'keep'],
    ['Needs work (the user rated them; use sparingly)', (m) => m.verdict?.v === 'needs work'],
    ['Not judged yet', (m) => !m.verdict],
    // Rated drop but still in the lab until the user decides (each has a GitHub issue): listed so a composer knows.
    ['Rated drop (still in the lab; do not use in new shows)', (m) => m.verdict?.v === 'drop'],
  ];
  const out: string[] = only ? [] : [LEGEND, ''];
  for (const [title, inGroup] of groups) {
    const list = [...widgets.values()].filter((m) => (!only || m.id === only) && inGroup(m));
    if (!list.length) continue;
    if (!only) out.push(`### ${title}`, '');
    for (const m of list) {
      out.push(`#### \`${m.id}\`: ${m.name}${m.verdict?.note ? ` (${m.verdict.note})` : ''}`, '');
      if (m.blurb) out.push(cell(m.blurb), '');
      out.push(tagLine(m), '');
      if (!m.params.length) { out.push('No knobs.', ''); continue; }
      out.push('| knob | label | range | default | driven by | what it does |', '|---|---|---|---|---|---|');
      for (const q of m.params) {
        out.push(`| \`${q.key}\` | ${cell(q.label ?? q.key)} | ${num(q.min)}..${num(q.max)} | ${num(q.value)} | ${cell(drives.get(q.drive ?? '') ?? q.drive ?? 'fixed')} | ${cell(q.hint ?? '')}${typeof q.less === 'number' ? ` Follows how present: ${num(q.less)} at its left end.` : ''} |`);
      }
      out.push('');
    }
  }
  return out.join('\n');
}

/** lab/tags.json against the vocabulary and the widget files: prints warnings, exits 1 on errors. */
function checkTags(ids: string[]): void {
  const { errors, warnings } = validateTags(readLabTags() ?? 'missing', readLabTagWords(), ids);
  for (const w of warnings) console.warn(`lab/tags.json warning: ${w}`);
  if (!errors.length) return;
  for (const e of errors) console.error(`lab/tags.json error: ${e}`);
  process.exit(1);
}

const argv = process.argv.slice(2), at = argv.indexOf('--id');
if (at >= 0 && !argv[at + 1]) { console.error('--id needs a widget id'); process.exit(1); }
const catalogue = loadCatalogue();
checkTags([...catalogue.widgets.keys()]);
console.log(catalogueText(catalogue, at >= 0 ? argv[at + 1] : null));
