# The widget lab

Canvas widgets driven by the notes of a recording. `lab/tools/<id>.js` is one widget; the lab page (`npm run dev`, then
`/lab/index.html`, `?song=<id>`), the studio and Node all run the same file. `lab/harness.js` holds `window.LAB`
(`SONGS`, `ORDER`, `VERDICTS`, `DRIVES`, `makeIcon`); `lab/kit.js` holds `window.KIT`.

## Add a widget

Create `lab/tools/<id>.js`. That is all: the lab, the studio and Node find it by folder (`ORDER` in `lab/harness.js` is
only a sort hint). Optional:

- an entry in `lab/tags.json` (`feel`, `instruments`, `role`, `noteType`), with feel words from `lab/tag-words.json`;
- `npm run widget-thumbs -- <id>` for its picture, and an entry in `lab/demos.json` plus `npm run widget-demos -- <id>`
  for its demo video. Both need a dev server: start one on a free port and pass `--base http://localhost:<port>` (their
  default is 5173, where the owner may be composing);
- once the widget stays, append its id to `ORDER` in `lab/harness.js`, so later files do not shift its load order;
- verdicts live in `LAB.VERDICTS` in `lab/harness.js`; only the owner's words change them.

`npm run widget-docs -- --id <id>` prints the widget as the studio sees it.

## The contract

A widget file is a classic script, no imports. It sees `TOOLS`, `ICON`, `KIT`, `CHORDS` (the attacks of the song, or of the
part it listens to) and `window.NOTES`.

```js
TOOLS.push({ id, name, blurb, tag, params: [...], reset(x) {}, onChord(ch, x) {}, frame(x) {} });
```

- `params`: `{ key, label, min, max, value, drive, hint, icon, leads, less, perNote }`. `drive` is a default music feature
  (`''` fixed, else `+level`, `-rate`, … with `level rate pitch bass density hit loud pace rel`). `hint` is one plain
  sentence ("Left: …. Right: …."). `icon(g, v, w, h)` draws the knob at `v` 0..1 on 40x26. `perNote: false` keeps a
  picked note from setting the knob (`presence` is never set by a note). Read a knob with `x.p('key')`.
- `reset(x)` runs when a clip starts and after every seek, at any `x.t`: rebuild state from `x.t`. `onChord(ch, x)` runs per attack: `ch.t`, `ch.vel`, `ch.lo`, `ch.hi`,
  `ch.notes[{ m, v, d, amount? }]`. `frame(x)` runs every step.
- `x` is one shared object: `g` (the 1280x720 canvas context), `W`, `H`, `t` (song seconds), `dt`, `now`, `moment`,
  `level rate hit`, `feat`, `rnd(a, b)`, `sounding()`, `top()`, `pitch01(m)`, `picked`, `p(key)`.
- Types: `src/widgets/types.ts`. `lab/tools/squares.js` is the reference; `lab/tools/vine.js` has the presence knob.

## Rules

- The canvas is shared and fades each frame: never clear it.
- Use `x.t - ch.t` for ages, never summed `dt`. `dt` is 0 when paused.
- At most 5 knobs plus `presence`. Presence is how much stuff the widget makes: `leads: true`, never read by the widget;
  every knob that follows it declares `less:` (its value at the left end). A widget with nothing to thin keeps a plain
  `presence` that dims (`tools/kusama.js`).
- Randomness in icons only through `ICON.rng(seed)`. In the widget, use `x.rnd`, so renders repeat.
- Never read pixels from the shared canvas at HD scale (it is drawn at 2x).
- Changing a default knob value changes saved shows. Add a knob instead; a drive adds `depth * (max - min)`, so widening
  a driven range changes the look.
- A file name must not look like a tracking script (`urchin.js` was blocked by ad blockers; it is `fist.js`).

## KIT and ICON

- `KIT`: `SNAP`, `clamp`, `lerp`, `smooth`, `rgb`, `hsl`, `hash`, `rng` (see `lab/kit.js`).
- `ICON`, for knob pictures; `g` first, colours default to `ICON.ink`: `dot ring square rect line arrow shape lines dots
  wave blur alpha shake palette pie fade trail keys glyph gauge`, `rng(seed)`, `lerp(a, b, t)`, colours `ink dim red gold
  blue green violet`, and ready-made `ICON.of.size|count|blur|time|speed|lines|choice|colour(...)`.

## What the owner likes

- Abstract, never literal: glass, lightning, ripples, moire were dropped as too physical.
- A widget that reacts to the sound in a way the owner can follow is loved; one whose trigger is unclear is not.
- Few, plain knobs, each with a picture. The owner touches knobs, then asks for the defaults back: keep them good.
- Loved: slashing cuts (casket), dread squares, rorschach (parametrize everything, keep defaults), kandinsky ("a complete
  visualization by itself"), marbling, colour fields ("a good building block"), the piano-driven set (ivory, gliss, hammer,
  pluck, interlock, fireworks, gust, duet, vine).
- Pixel sort is kept because it combines well: it smears whatever is under it.
- A widget that fights the music's pace is wrong, whatever it looks like: fireworks belong on real blows, busy red
  textures on fast passages only, handover only on long notes.
- Colour clashes break a theme: chord squares in milky white, not "incongruent red"; Snap squares have a `milk` switch.
- The screen should be full (four threads or more) except at deliberate entrances.
- Each widget answers its own strand of the music; the widgets do not relate to each other.
- Dropped: anything gluey (tack), anything disliked outright (hilma). Disliked widgets are archived, not reworked.
- A rework of a loved widget is judged again; a loved widget can fall (murmuration, the current, woven threads, op art).
- Theme combinations are in `docs/compositions/STYLE.md`.

## Open

See `lab/TODO.md`.
