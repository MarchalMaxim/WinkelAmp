# The widget lab

Canvas widgets driven by the notes of a real recording, for trying, tuning and rating. The studio runs these same
`lab/tools/*.js` sources through `WidgetRuntime`; a widget does not need a separate stage implementation. Studio shows
place independent widget clips on tracks, with their own start and end times. The song's analysis sections are only marks
to see and snap to, and own no clips. See [the studio show format](../docs/COMPOSING-SHOWS.md).

- `index.html`: the lab. Toggle and mix widgets, tune their knobs (each can be fixed or driven by a feature of the music),
  rate them. Serve the repo with `npm run dev` and open http://localhost:5173/lab/index.html (`?song=b5` for Beethoven).
  The picture never scrolls away while you tune: on screens 1300 px wide or more it holds a column on the left and the
  cards scroll beside it; on upright screens (phones) it sticks to the top. The chips under the track name what's on:
  click one to jump to its card, × to switch it off. Narrower landscape windows (and `shot.mjs`'s 1280×900) keep the
  plain stack, so stills there come out as wide as before.
- `tools/<id>.js`: one widget each (`TOOLS.push({ id, name, blurb, tag, params, reset, onChord, frame })`). The page loads
  the ids listed in `TOOL_IDS` in `index.html` (add yours there); a missing or broken file only shows a note above the cards.
  `tools/dropped/`: widgets the user dropped (ripples, moire, shatter, lightning, whitney, albers, hilma, tack), kept for reference.
  Widgets rated drop on 2026-11-08 (royal, honey, lazy, martin, nap, delaunay) stay in `tools/` for now: the drop is
  recorded only (`VERDICTS`; issues [#8](https://github.com/MarchalMaxim/WinkelAmp/issues/8)-[#13](https://github.com/MarchalMaxim/WinkelAmp/issues/13)).
- `combos.js`: widget combinations that do more together than side by side (`window.COMBOS = [{ ids, blurb, knobs?, tip?,
  at?, when? }]`), each shot together and alone first. A member's card shows a "combines with N" pill (hover, or tap
  on a phone) with a "try together" button: just those widgets on, the listed knob values set, from the best moment
  in this song; "undo try" under the track puts back what was on and the knobs. Also listed above the cards.
- `ratings.md`: the user's verdicts and notes, round by round. `ratings.json`: the raw button ratings and knob settings
  per browser, written by `save-server.mjs` (`node lab/save-server.mjs`, port 5174) whenever the page changes.
- `shot.mjs`: screenshots of chosen widgets at chosen song times (`SONG=b5` for Beethoven).
- `round1.html`: the first sketch (three moments of the Prelude).
- `render.mjs`: a showcase video of one widget alone over five passages of both recordings, with sound:
  `node lab/render.mjs <widget id> lab/showcase/<id>.mp4 [--fps 30]` (dev server on 5173, system Chrome, ffmpeg). It drives
  `index.html?render=1`, which draws frames on demand through the live loop's own `step()` at our default knobs with seeded
  randomness, so the same widget always gives the same video. `lab/showcase/*.mp4` holds the recordings: never committed.

The recordings (`prelude.mp3`, `beethoven5.mp3`) and the notes transcribed from them (`notes.js`, `notes-b5.js`, written by
the GPU piano transcriber as `window.NOTES = [[start, end, midi, velocity], …]`) are local only and not in git.

## Widget health check

With the worktree's server running on port 5200, `npm run widgets-check` renders every registered widget on representative
16-second passages of three songs, after five seconds of warm-up, at low and high “how present”, in one browser at a time. It writes `lab/widgets-check.md` and prints the
same table. It reports thrown errors, an entire run staying near black, and cases where low makes no less by aggregate
colour occupancy, lit area and contrast. These broad measurements do not judge the look; the report states their limits.

Simulation defaults to the normal 60 Hz, preserving the live physics and fades. `--sample-hz 12` sets the uniform
aggregate observation rate; every attack's first simulation frame, frame zero and the final frame are also observed.
Means use elapsed-time weights between observations, with the same schedule at low and high. `--hz 12` is an explicit
diagnostic with different physics, not normal-playback coverage. Warm-up errors count; image statistics and blank judgments
cover only the measured passage. Default starts: Lil Wayne 80 s, Prelude 118 s, Winter Wind 116 s. Other songs use a bounded
middle passage. Use `--seconds`, `--warm` or `--start` to choose the scope, or `--full` to test complete songs explicitly.
Long accumulation and behavior outside the measured passages remain unjudged. For a smaller debugging run use
`-- --ids squares,fireworks --songs prelude`; use `--base http://localhost:5201`, `--out <file>` or
`--json <file>` to choose the server and result files. The check plays no audio and stubs the ratings server before opening
any page. Findings return a non-zero exit code. Keep the report with all widgets and three songs when reporting the check.
## Widget speed table

For a frame-cost table, start the worktree's server on port 5200 and run `npm run widgets-speed`. It measures each widget
alone at 60 Hz on Winter Wind 206 s and Rite 174 s, with three two-second rounds and at least five seconds of warm-up
(or its longer demo warm-up, including Vine's 60 s). `lab/speed.md` lists the slower widgets first. The numbers cover CPU
work and drawing-command submission, without a GPU completion wait or forced pixel readback during timing. They do not
measure screen presentation. Use `-- --ids squares,fireworks --json renders/speed.json` for selected widgets and frame data;
`--images lab/showcase/speed-before` captures final frames only after timing. The command plays no audio and stubs ratings.

## Knobs (from the 2026-10-31 round on)

The user found knob names hard to grasp, so a widget has **at most 5 knobs**, each with a plain sentence and a small picture.
`tools/flee.js` also has a sixth knob, `snap`, a 0/1 switch the user asked for (2026-11-05) to keep the snap version behind.
`tools/squares-snap.js` likewise has `milk`, a 0/1 switch for milky white squares instead of dark red (asked for 2026-11-06; the user then wanted the squares red and the handover milky). `tools/handover.js` has a `milk` switch too, on by default: every handover is milky white unless it is set to 0.
`tools/leidenfrost.js` has `plate`, how much the ember plate under the drops glows (asked for 2026-11-06).
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
- **How present is how much stuff the widget makes** (the user: "how much 'stuff' is produced by the slider"; dimming over
  time is the intensity lane's). `tools/vine.js` is the reference: a `presence` knob, 'how present', 0..1, default 1, marked
  `leads: true`, that the widget never reads. Moving it writes every knob that declares `less: <its value at the left end>`
  (`layers/present.js`); a knob moved by hand holds until the slider next moves. Follow what counts, spawns, branches or
  stays, never colour, mode or plain brightness. Where no knob makes more or less of anything, the widget keeps a plain
  `presence` that dims (`tools/kusama.js`). It may be a sixth knob. At default values a widget draws exactly
  what it drew before, and a stored knob value never changes meaning. Drive adds `depth * (max - min)`, so widening a driven
  knob's range changes its swing and the default look: add a new plain knob instead. Compare seeded `?render=1` frames.
- Drives (stored as `+level` etc.) show as words: louder notes / faster / higher notes / more bass / fuller chords /
  louder sound (`loud`) / busier (`pace`) → more / less. `loud` and `pace` are read from curves at the song time
  (src/widgets/curves.ts), so they never build up: the recording's loudness, and attacks per second in the 4 s around now.
- `tag`: `'new'` for a new widget, `'v2'`, `'v3'`… for a rework. A tag that differs from the version the user judged
  (`VERDICTS` in `index.html`, from `ratings.json` (2026-11-08) and `ratings.md`) marks the card "reworked" and sorts it to the top.

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
