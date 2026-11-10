# Composing a show

A show is what the studio plays over a recording: widgets (`lab/tools/*.js`) placed as clips on tracks, with their own
times and, rarely, knob settings. Clips overlap freely and belong to no part of the song. This page is for an agent (or a
person) turning a song pack and the owner's words into `shows/<id>.json`.

- Shows are composed as short scenes (about 10 s) that the owner judges, not whole pieces. Open one with
  `/?show=<id>&t=<seconds>`.
- Read a show with `npm run check-show -- --summary <id>`, not by opening the JSON: its picks run to thousands of lines.
- Every widget's knobs: `npm run widget-docs`; one widget: `npm run widget-docs -- --id <id>`.
- Which theme combinations work: [compositions/STYLE.md](compositions/STYLE.md). The owner's verdicts per widget:
  `LAB.VERDICTS` in `lab/harness.js`.

## The workflow

1. **Read the song.** `npm run describe-song -- <id>` prints the pack in words: length, where the notes came from, the
   analysis sections with their character, loudness and attacks per second every 10 s, and the tracks it has.
2. **Read the owner.** `shows/<id>.description.md` holds what the owner wrote in the studio's "Describe the show" box. Those words
   win over the analysis. If `shows/<id>.json` exists, change only what the words ask for.
3. **Write `shows/<id>.json`** (below). Start and end clips where the music turns, a little before the attack.
4. **Check it.** `npm run check-show -- shows/<id>.json` must exit 0, ideally with no warnings; it names every problem with
   its path (`clips[2].knobs.size`). `--fix` repairs overlaps on one track, clips past the end, unknown widgets and
   knobs out of range, and writes the canonical form.
5. **Look.** `npm run render-show -- <id> --from <b - 3> --to <b + 12>` renders a stretch around a boundary `b` to
   `renders/<id>.mp4` and a contact sheet. Change a cast where a frame shows a clash or an empty stretch.

A studio with the show open reloads it when it changes on disk (after asking, if there are unsaved edits).

## The format

```json
{
  "version": 3,
  "id": "prelude",
  "song": "prelude",
  "title": "Rachmaninoff: Prelude in C♯ minor",
  "composer": { "by": "claude", "at": "2026-10-31T09:00:00.000Z" },
  "clips": [
    { "id": "c1", "start": 0, "end": 83, "track": 0, "widget": "current" },
    { "id": "c2", "start": 5, "end": 83, "track": 1, "widget": "squares", "fade": 2 },
    { "id": "c3", "start": 124, "end": 232.1, "track": 2, "widget": "casket",
      "knobs": { "cutAt": { "base": 96, "drive": "-level", "depth": 0.4 } } }
  ]
}
```

- `id` is the show's name (the file `shows/<id>.json`), `song` the pack folder in `songs/`; both are slugs. Several shows
  may share a song. `title` and `composer` (`by`: `auto` | `claude` | `user`) are optional; write `"by": "claude"`.
- A clip's `id` is unique in the show. `start` and `end` are song seconds to the millisecond. Gaps are dark.
- `track` is a whole number from 0; a higher track draws over a lower one. One track holds no overlaps (an error); different
  tracks overlap freely, even with the same widget. More than 6 clips at one moment is a warning; 2-3 is usual.
- `fade` (seconds, default 1, at most half the clip, 0 = hard cut): how long the clip takes to come in and go out.
- `knobs` maps a knob key to a number, or to `{ "base", "drive", "depth" }` (the lab's "Copy settings"). Leave a knob out
  to keep the widget's default; a base outside the range is clamped with a warning. `depth` is 0..1, default 0.5.
- Write knobs only when the description asks for something a knob does ("sharper", "calmer cuts"); the owner's defaults
  are good. Say which in the commit.

Drives (`""` holds a knob fixed; `+` raises the knob, `-` lowers it):

| drive | follows |
|---|---|
| `level` | how hard the last attacks were; drains between them |
| `rate` | how fast the attacks come |
| `pitch`, `bass` | higher notes, more bass |
| `density` | fuller chords |
| `hit` | a pulse that jumps on every note and is back below half in ~80 ms |
| `loud` | the recording's loudness, held between notes; no lag |
| `pace` | attacks per second in the 4 s around now, against the piece's busiest parts |
| `rel` | `loud` judged against the 8 s on either side and half against the whole piece |

## How clips play

All widgets share one canvas, which fades a little every frame. A clip resets its widget at its start and takes attacks
until its end; two clips of one widget that butt do not continue each other, so use one long clip to keep a picture going.
A clip that starts inherits what the others left, and an incoming casket slices whatever is there. Where nothing is placed
the picture fades to black. Every clip is its own instance, so two clips of one widget draw independently.

## `listen`: what a clip hears

```json
{ "widget": "strings", "listen": "violin" }
```

The clip gets attacks, pulse and sounding notes from one part only, so its driven knobs follow that part.

- `"all"` (or absent): every note.
- **A track** the recording has: `piano`, `violin`, `viola`, `cello`, `contrabass`, `strings`, `horn`, `oboe`, `clarinet`,
  `bassoon`, ... `describe-song` lists the tracks the song has and where each plays. Only ensembles have tracks.
- **A family**: `family:strings`, `family:winds`, `family:brass`, `family:keys`, `family:plucked`, `family:percussion`,
  `family:voice`.
- **A kind of note**, found by rule on every song: `chords` (5+ notes), `runs`, `trills` (rare), `long`, `repeats`,
  `rolls` (a quick sweep of attacks that arrives and rings; `rollIds` in `lab/layers/lines.js`).
- **A line**: `melody`, `bassline`, `inner`, `low` (below G3), `high` (C5 and up), `accents` (the loudest 15 % of attacks).
- **A set of picks**: `picks:p1` (below).

A track or kind the song lacks is a warning: the clip plays on all notes (for a kind: it hears nothing). Name a track only
when `describe-song` lists it. Labels are what the transcriber heard: "Violins" does not separate firsts from seconds,
and short tracks (a few dozen notes) are guesses. A song whose tracks came from MuScriptor says so in `describe-song`;
trust the ear over its labels ([TRANSCRIBERS.md](TRANSCRIBERS.md)).

**A widget's usual note type** is `noteType` in `lab/tags.json`. The studio sets `listen` to it when it places the widget,
if the clip holds enough of it (3 attacks, one per 10 s, half the clip within reach). A show file you write sets
`listen` itself.

## Picks

The owner picks notes in the studio ("Pick notes") and connects them to a widget, which then answers those notes only,
each as strongly as it was played. They are in the show after `clips`, one note a line:

```json
"picks": { "p1": { "notes": [
  [12.3456, 13.1, 76, 92],
  [15.02, 15.4, 79, 70, { "crater": 0.8, "intensity": 1.5 }]
] } }
```

- A note is `[start, end, midi, velocity]`, sorted by start. The fifth place holds per-note values: a number is an
  intensity alone, an object holds `intensity` and knob values.
- Intensity is 0..2 (1 is none, and is not written). A widget hears the note at `velocity x intensity`, up to 127, or
  reads `amount` on the chord's note itself.
- A knob value holds from that note's attack until the set's next attack, which returns the knob to the clip's value.
  A param with `perNote: false` is never set this way. A knob read every frame changes the whole picture until the next
  attack.
- Each clip on the set says `"listen": "picks:p1"`; one set may have many clips, and knob values reach all of them, so
  give a different widget its own set.
- Every picked note counts, even ones the widget would otherwise skip.
- Picks are the owner's hand work: leave them alone unless asked. A clip on a set that does not exist is an error (`--fix`
  drops the clip); an unused set, or a pick outside every clip using it, is a warning.

## `region`: where a clip is seen

```json
{ "widget": "casket", "region": { "mode": "spot", "shape": "ellipse", "x": 0.5, "y": 0.45, "w": 0.5, "h": 0.6, "feather": 0.25 } }
```

`x`, `y` are the centre and `w`, `h` the size, as fractions of the picture; `rot` in degrees; `feather` 0..1 (default
0.25); `shape` is `rect` or `ellipse`.

- **`spot`** (Mask): the widget draws full size on the shared picture and is seen only through the shape. Use it for
  readers, the widgets that cut or smear what is below (casket, pixelsort, tunnel, blocks, fold, timeslice).
- **`window`** (Small copy): the widget draws alone on its own canvas, fitted into the shape (`fit`: `cover`, `contain`,
  `stretch`) and laid over the stack. `blend`: `clear` (default; black turns see-through), `over` (keeps the black box),
  `lighten`. A widget that paints its own background stays a solid rectangle under `clear`. A reader in a window only cuts
  its own empty picture.

The studio's default for a new place is a window, 40 % of the stage, `feather` 0.2, `fit` `contain`.

## `intensity`: how much of a clip there is, over time

```json
{ "widget": "squares", "intensity": [{ "t": 120, "v": 0 }, { "t": 124, "v": 1, "shape": "hold" }, { "t": 133, "v": 0.2 }] }
```

Pivots in song seconds, sorted, `v` 0..1, at most 256. Each segment takes the `shape` of the pivot that starts it: straight
(`bend` -1..1 curves it), `ease` or `hold` (a step at the next pivot). Before the first pivot and after the last the
value holds. A value below 1 does, deterministically (playing, seeking and rendering agree):

- **fewer attacks**: 0.5 passes a fixed half, 0 none;
- **fainter**: pasted at a weight that shows that fraction;
- **a calmer pulse**: its level and rate follow only the attacks that reached it.

**`"intensityMoves": "present"`**: the curve no longer fades the clip or drops attacks; it moves how present the widget
is (the `presence` knob is the ceiling, the curve a share of it). At `v` 1 the clip is as its knobs are set; at 0 it
makes its least but stays on screen. A widget whose slider only dims just dims; one with no slider (`fold`, `kline`) keeps
fading, and the check warns.

**`"thin": "loud"`**: a curve below 1 keeps the loudest notes of the 4 s on either side instead of a hashed share. No
effect without a curve, or with `intensityMoves`.

Presets in the studio write ordinary pivots: fade in or out; swell; pulse every N beats or bars; "Loud parts" (open where
the recording is louder than a threshold); "Follows the sound" (rises and falls with loudness); "Build to the climax"
(holds low, grows to the clip's loudest moment, then settles); "While its part plays" (open where the listened part
sounds). The loudness presets read the pack's `energy` lane; `npm run augment-pack` adds it to older packs.

## Picking widgets by tags

`lab/tags.json` gives each widget `feel`, `instruments` (what it suits) and `role`; `lab/tag-words.json` defines each feel
word (icy, warm, heavy, liquid, stabbing, panic, longing, ...). To pick: take the feel words of the description, keep
widgets sharing them, prefer those whose instruments the song has, and build the stack bottom to top by role: `under` and
`ground` first, `base` fills the picture, `accent` moves over a base, `top` works on what is below.

## The owner's taste

- Theme combinations that work and the rules behind them: [compositions/STYLE.md](compositions/STYLE.md).
- Verdicts per widget (love, keep, needs work, drop): `LAB.VERDICTS` in `lab/harness.js`. Use "needs work" widgets only
  when the words ask, and never "drop" ones. A widget with no verdict is new: try it where the description invites it
  and mention it.
- Abstract, never literal; keep the widgets' defaults.
