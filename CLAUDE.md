# WinkelAmp

A recording becomes a show of abstract canvas widgets set off by its notes. One user, work in progress: prefer the
simple change, delete what is in the way, and do not keep old behaviour "just in case".

## Where things are

| path | what |
|---|---|
| `lab/tools/<id>.js` | the widgets, one plain-JS file each. The only place widgets live. |
| `lab/harness.js` | `window.LAB`: `SONGS`, `ORDER` (sort hint), `VERDICTS` (the owner's ratings), `DRIVES` (drive words), `makeIcon` |
| `lab/kit.js` | `window.KIT`: helpers any widget may call (`SNAP`, `clamp`, `lerp`, `smooth`, `rgb`, `hsl`, `hash`, `rng`) |
| `lab/index.html` | the lab page, where widgets are tried and rated (`/lab/index.html?song=<id>`) |
| `lab/layers/*.js`, `lab/region-ui.js` | layer maths (listen, region, intensity, thin). One copy: the lab loads them, the studio and Node evaluate the same text |
| `src/widgets/` | the TypeScript host that runs widget files in the studio (`runtime.ts`, `instantiate.ts`, `features.ts`, `curves.ts`) |
| `src/studio/show/` | the show model: `show.ts` (schema, validate, repair, canonical), `edit.ts` (pure edits), `schedule.ts`, `conductor.ts` |
| `src/studio/ui/` | the studio page (`main.ts` is the entry of `index.html`) |
| `src/studio/render-page.ts` | `render.html`: frame-by-frame drawing for `npm run render-show` |
| `src/studio/pack/`, `src/studio/ingest/`, `src/audio/` | song packs and the analysis done at ingest |
| `scripts/studio-api.ts` | the dev server's API (songs, shows, melodies, `/api/widgets`); a Vite plugin, so it only exists under `npm run dev` |
| `scripts/node/` | Node twins of browser loaders (`catalogue.ts` loads every widget in a vm) |
| `shows/`, `melodies/` | the owner's shows and note marks. `songs/` is audio and packs, local only |

## Commands

- `npm run check`: typecheck plus the fast tests, about 20 s. Run it after every change.
- `npm test`: everything, about 40 s. Run it when you touch ingest, the ears server, descriptors or `check-show`.
- `npm run e2e`: one browser pass over the studio on a test song (own server, temp folders). Only when UI wiring changed.
- `npm run check-show -- --summary <id>`: a show in about 50 lines. Use it instead of reading `shows/<id>.json`, whose
  pick lists run to thousands of lines. `npm run check-show -- <id> [--fix]` validates or repairs.
- `npm run widget-docs -- --id <id>`: one widget's knobs as the studio sees them. Without `--id`: all of them.

## Add a widget

Create `lab/tools/<id>.js`. Nothing else is required: the lab, the studio and Node find it by folder, and
`tests/widgets-smoke.test.ts` runs it. Once the widget stays, append its id to `ORDER` in `lab/harness.js`. The contract, the knob rules and the owner's taste are in
[lab/README.md](lab/README.md): read it first. A widget needs no test file of its own; write one only for behaviour worth
pinning, with `tests/helpers/widget.ts` (`loadWidget`, `recorder`, `kit`).

## Add a studio feature

- **A per-clip flag** (like `thin: 'loud'`): one entry in `CLIP_ENUMS` in `src/studio/show/show.ts`, then its consumer
  (`slotLayer` in `conductor.ts`, `lab/layers/slot.js`) and its control in `src/studio/ui/`.
- **Any other clip field**: also add it to `KEYS.clip` in `show.ts`, or `canonicalShow` drops it on save.
- **A drive** (what a knob follows): add the key to `FEATURE_KEYS` in `src/widgets/features.ts`, compute it there or in
  `curves.ts`, and give it words in `LAB.DRIVES`. The lab page computes features in its own step loop too (below).
- **A knob a note may not set**: `perNote: false` on the param in the widget file (`presence` never is).
- **Show edits** go through `applyEdit` (`edit.ts`) dispatched on the store, or undo and the dirty flag break.
- **An API route**: `scripts/studio-api.ts`; its client is `src/studio/ui/api.ts`.

## Things that exist twice

Change both, or the lab and the studio drift:

- The lab page's inline step loop and `src/widgets/runtime.ts` + `features.ts`. `npm run fidelity` compares their pixels.
- `lab/layer-ui.js` and `src/studio/ui/layer-controls.ts` (`tests/lab-layer-ui.test.ts` holds them equal).
- The curves in `lab/layers/lines.js` and `src/widgets/curves.ts` (`tests/curves.test.ts`).

## Rules

- Never edit `lab/ratings.json` (the owner's ratings). A headless browser must block `http://localhost:5174` (the save
  server), or it overwrites them.
- Do not edit or delete `shows/*` or `melodies/*` unless asked. `composer.by === 'user'` marks a show the owner edited.
- Never commit audio, `songs/`, `lab/notes*.js`, `lab/pack-*.js`, `renders/` or model weights.
- Before starting a server, check the port. The owner may be composing on 5173 or 52xx: use another port, and never
  stop a server you did not start. 5174 is the ratings saver, 5175 the ears server.
- In a worktree, `songs/` and `node_modules/` are links into the main checkout: never delete through them.
- `ORDER` in `lab/harness.js` and the load order of clips are part of the seeded pixels: append, never reorder.
- Widget files are classic scripts evaluated as text by three hosts. No imports, no ES modules, in `lab/tools/`,
  `lab/layers/`, `lab/harness.js` or `lab/kit.js`.
- Comments: one line, the why. No history, no dates, no pointers to plans.

## Composing

Read [docs/COMPOSING-SHOWS.md](docs/COMPOSING-SHOWS.md) (the show format) and
[docs/compositions/STYLE.md](docs/compositions/STYLE.md) (which widget combinations worked) first. Compose short scenes,
about 10 s, for the owner to judge, opened with `/?show=<id>&t=<seconds>`; not whole shows.

## Taste

- Abstract, never literal. A sound's look is built from the owner's own words for it.
- Each widget answers its own strand of the music; widgets do not relate to each other.
- After an attack, a quiet change of state. Aftermath must not look like a new attack.
- Signals stay snappy and distinct: no lag on loudness, separate drives for loud, pace and level.
- Verdicts change only on the owner's words. A widget rated "drop" stays until the owner says to remove it.
