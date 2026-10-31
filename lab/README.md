# The widget lab

Throwaway canvas sketches of visual "widgets", each driven by the notes of a real recording, for rating rounds. The ones
that win are rebuilt properly in the app's WebGL stage (`src/stage/`); nothing here is app code.

- `index.html`: the lab. Toggle and mix widgets, tune their knobs (each can be fixed or driven by a feature of the music),
  rate them. Serve the repo with `npm run dev` and open http://localhost:5173/lab/index.html (`?song=b5` for Beethoven).
- `tools/<id>.js`: one widget each (`TOOLS.push({ id, name, blurb, tag, params, reset, onChord, frame })`). The page loads
  the ids listed in `TOOL_IDS` in `index.html` (add yours there); a missing or broken file only shows a note above the cards.
  `tools/dropped/`: widgets the user dropped (ripples, moire, shatter, lightning), kept for reference.
- `ratings.md`: the user's verdicts and notes, round by round. `ratings.json`: the raw button ratings and knob settings
  per browser, written by `save-server.mjs` (`node lab/save-server.mjs`, port 5174) whenever the page changes.
- `shot.mjs`: screenshots of chosen widgets at chosen song times (`SONG=b5` for Beethoven).
- `round1.html`: the first sketch (three moments of the Prelude).

The recordings (`prelude.mp3`, `beethoven5.mp3`) and the notes transcribed from them (`notes.js`, `notes-b5.js`, written by
the GPU piano transcriber as `window.NOTES = [[start, end, midi, velocity], …]`) are local only and not in git.

## Knobs (from the 2026-10-31 round on)

The user found knob names hard to grasp, so a widget has **at most 5 knobs**, each with a plain sentence and a small picture.
`tools/squares.js` is the reference.

```js
params: [
  { key: 'life', label: 'how long they stay', min: 0.3, max: 4, value: 1.4, drive: '',   // drive: '', '+level', '-rate', ...
    hint: 'How long a square stays. Left: a blink. Right: lingers for seconds.',          // one plain sentence, Left/Right
    icon: (g, v, w, h) => ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red) },                  // v = 0..1 along the slider
]
// read it each frame with x.p('life')
```

- `icon(g, v, w, h)` draws what the knob does at `v` on a 40×26 canvas (CSS pixels; pixel density, clearing, ink colour,
  lineWidth 1.5 and round caps are set for you). The harness draws it at v=0 and v=1 at the slider's ends and a live one
  by the name, which follows the music when the knob is driven. A throwing icon falls back to a plain bar.
- Drives (stored as `+level` etc.) show as words: louder / faster / higher notes / more bass / fuller chords → more / less.
- `tag`: `'new'` for a new widget, `'v2'`, `'v3'`… for a rework. A tag that differs from the version the user judged
  (`VERDICTS` in `index.html`, from `ratings.md`) marks the card "reworked" and sorts it to the top.

`ICON` helpers (all take the context `g` first; colours default to `ICON.ink`; colours `ICON.ink, dim, red, gold, blue,
green, violet`):
`dot(g,x,y,r,col)`, `ring(g,x,y,r,col,lw)`, `square(g,x,y,s,col,rot)`, `rect(g,x,y,w,h,col)`, `line(g,x1,y1,x2,y2,col,lw)`,
`arrow(g,x1,y1,x2,y2,col,lw)`, `shape(g,name,x,y,s,col)` (dot, ring, square, diamond, triangle, oval, line, tick, cross, star),
`lines(g,n,w,h,{dir:'h'|'v',col,lw,pad})`, `dots(g,n,w,h,{seed,r,col,pad})`, `wave(g,w,h,amp01,cycles,col,lw)`,
`blur(g,px,draw)`, `alpha(g,a,draw)`, `shake(g,px,draw)`, `palette(g,colours,w,h)`, `pie(g,x,y,r,frac,col)`,
`fade(g,w,h,life01,col,shape)`, `trail(g,len01,w,h,col)`, `keys(g,w,h,from01,to01,col)`, `glyph(g,text,w,h,col,px)`,
`gauge(g,v,w,h)`, and `rng(seed)` / `lerp(colA,colB,t)`. Anything random must use `ICON.rng(seed)` (no jitter on redraw).
Ready-made icons: `ICON.of.size(shape,col)`, `.count(max,col)`, `.blur(shape,col)`, `.time(col)`, `.speed(col)`,
`.lines(max,col)`, `.choice([shapes],col)`, `.colour(hexA,hexB)`, e.g. `icon: ICON.of.count(20, ICON.gold)`.
