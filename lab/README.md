# The widget lab

Throwaway canvas sketches of visual "widgets", each driven by the notes of a real recording, for rating rounds. The ones
that win are rebuilt properly in the app's WebGL stage (`src/stage/`); nothing here is app code.

- `index.html`: the lab. Toggle and mix widgets, tune their knobs (each can be fixed or driven by a feature of the music),
  rate them. Serve the repo with `npm run dev` and open http://localhost:5173/lab/index.html (`?song=b5` for Beethoven).
- `tools/<id>.js`: one widget each (`TOOLS.push({ id, name, blurb, params, reset, onChord, frame })`).
- `ratings.md`: the user's verdicts and notes, round by round. `ratings.json`: the raw button ratings and knob settings
  per browser, written by `save-server.mjs` (`node lab/save-server.mjs`, port 5174) whenever the page changes.
- `shot.mjs`: screenshots of chosen widgets at chosen song times (`SONG=b5` for Beethoven).
- `round1.html`: the first sketch (three moments of the Prelude).

The recordings (`prelude.mp3`, `beethoven5.mp3`) and the notes transcribed from them (`notes.js`, `notes-b5.js`, written by
the GPU piano transcriber as `window.NOTES = [[start, end, midi, velocity], …]`) are local only and not in git.
