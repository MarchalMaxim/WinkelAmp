# Composing a show

A show is what the studio plays over a recording: the song cut into sections, each with a stack of lab widgets
(`lab/tools/*.js`) and, rarely, knob settings. This page is for a Claude Code session (or a person) turning a song pack
and the user's words into `shows/<id>.json`. The widget list at the end is generated from the widget files.

## The workflow

1. **Read the song.** `npm run describe-song -- <id>` prints the pack in words: length, where the notes came from (and
   whether to trust them), the analysis sections with their character (loud, dense, low, fast, quiet, relative to the
   rest of the song), loudness and attacks per second every 10 s, and the show the auto-composer would make.
2. **Read the user.** `shows/<id>.description.md` holds what the user wrote in the studio's "Describe the show" box.
   Their words win over the analysis. If there is already a `shows/<id>.json`, start from it and change only what
   the words ask for.
3. **Write `shows/<id>.json`** (the format is below). Put boundaries where the music turns, a little before the
   attack (the analysis sections and the 10 s table show where); give each section a short label in the music's
   terms ("Dread", "Agitato", "The casket").
4. **Check it.** `npm run check-show -- shows/<id>.json` must exit 0, ideally with no warnings. It names every problem
   with its path (`sections[2].layers[0].knobs.size`). `--fix` repairs what is obvious (overlaps, gaps, the ends, tiny
   sections, unknown widgets, knobs out of range) and writes the result in the canonical form.
5. **Look.** `npm run render-show -- <id> --from <b − 3> --to <b + 12>` renders a stretch around a boundary `b` to
   `renders/<id>.mp4`; read a contact sheet of one frame per 0.5 s (`ffmpeg -i renders/<id>.mp4 -vf fps=2,scale=320:-1,tile=6x5 sheet.png`).
   Change a cast where a frame shows a clash or an empty stretch.
6. The studio watches `shows/`: a show changed on disk reloads there (it asks first when the user has unsaved edits).

## The format

```json
{
  "version": 1,
  "id": "prelude",
  "song": "prelude",
  "title": "Rachmaninoff: Prelude in C♯ minor",
  "composer": { "by": "claude", "at": "2026-10-31T09:00:00.000Z" },
  "sections": [
    { "start": 0, "end": 83, "label": "Dread", "layers": [{ "widget": "squares" }, { "widget": "current" }] },
    { "start": 83, "end": 124, "label": "Agitato", "fade": 3, "layers": [{ "widget": "kandinsky" }, { "widget": "flee" }] },
    { "start": 124, "end": 232.1, "label": "The casket", "fade": 2,
      "layers": [{ "widget": "kandinsky", "knobs": { "edges": 0.6 } }, { "widget": "squares" },
                 { "widget": "casket", "knobs": { "cutAt": { "base": 96, "drive": "-level", "depth": 0.4 } } }] }
  ]
}
```

- `version` is 1. `id` is the show's name and `song` the pack's folder in `songs/`; both are slugs (`a-z`, `0-9`,
  single dashes). One show per song: `id` = `song`. `title` and `composer` (`auto` | `claude` | `user`, with a time)
  are optional; write `"by": "claude"`.
- `sections` are sorted, start at 0, end at the song's length (±0.5 s) and join without gaps or overlaps (±0.05 s).
  A section under 1 s draws a warning. Times are seconds; they are stored to the millisecond.
- `layers` run **bottom → top**: each widget draws over the ones before it. At most 6 (a warning past that; 2–3 is
  usual). A widget appears once per section.
- `knobs` (optional) maps a knob key to its base value (a number), or to the lab's full setting
  `{ "base": 96, "drive": "-level", "depth": 0.4 }` (what the lab's "Copy settings" gives). A drive moves the knob with
  the music: `+level` louder → more, `-level` louder → less, and the same for `rate` (faster), `pitch` (higher notes),
  `bass` (more bass) and `density` (fuller chords); `""` holds it fixed. `depth` 0..1 is how far. Leave out a knob to keep
  the widget's default; a base outside the knob's range is clamped (with a warning).
- `fade` (optional, seconds, default 3, 0 = a hard cut): how long the previous section's widgets take to fade out
  when this section starts. `restart: true` on a layer resets a widget that continues from the previous section.
- `npm run check-show -- --fix` writes the canonical form: keys in the order above, two-space indent.

## How sections play

All widgets share one canvas, which fades a little every frame (as in the lab). At a boundary:

- a widget in **both** sections keeps running: no reset, its knobs switch to the new section's (unless `restart`);
- a widget **entering** is reset at the boundary and starts taking attacks;
- a widget **leaving** stops getting attacks but keeps drawing, beneath the new stack, for the new section's `fade`
  seconds, its contribution fading as (1 − u)², u = time since the boundary / fade.

So the picture never cuts to black: an incoming casket slices what the outgoing widgets left on the canvas, and a quiet
section after a loud one inherits its last strokes, fading. Use `fade: 0` for a deliberate hard change, a long fade
(5–8 s) where the music dissolves. `fade: 0` cuts only the widgets leaving at that boundary: a widget still fading out
from an earlier boundary finishes its own fade under the new stack, so for a clean hard change keep the section
before it longer than its own fade (or give it a short one). Seeking in the studio starts clean at the section under the playhead.

## The user's taste

- **Abstract, never literal.** Shatter, lightning, ripples, moire, whitney and albers were dropped (too physical, or not
  right); they are not in the collection (`lab/tools/dropped/`).
- **Loved:** casket (its slashing cuts: "insanely good"), dread squares, rorschach ("parametrize the hell out of it",
  but keep our defaults), kandinsky ("a complete visualization by itself"), flee, the current, woven threads (strings),
  murmuration (the user's favourite), marbling, miró, delaunay, lewitt, kusama, ikeda, horizon, graphic score, boogie
  woogie, op art (riley), glitch blocks, calligraphy (brush), halftone. **Kept:** colour fields ("a good building
  block"), fischinger, mclaren, len lye, klee, ridges, kline, cells, nebula, pixel sort (it combines with other
  widgets "in a very cool way": it smears what is under it), mandala, harmonic web (fifths). **Needs work:** matisse,
  harmonograph, hilma af klint: use them only when the words ask.
- **Keep OUR defaults.** The user touched knobs in the lab and asked for our defaults back. Write knobs only when the
  description asks for something a knob does ("sharper", "calmer cuts"), and say which in the commit.
- Kandinsky v2 no longer lays down red squares (they overlapped with dread squares), but the two together can still be
  busy. The casket goes on top: it cuts whatever is below, so give it something to cut.
- The widgets marked "not judged yet" are new: try them where the description invites it, and mention it.

## What the auto-composer does

For a song without a show the studio composes one (`src/studio/compose/`): it keeps the most novel analysis
boundaries (sections ≥ 15 s, at most one per 30 s), moves each just before the strongest attack within a second, and
gives each section, by its character, a base (a widget that fills the picture: for example the current, woven threads
or horizon when quiet, rorschach or riley when low, kandinsky, cells or klee when dense, boogie, ikeda or miró when fast,
kusama or kline when loud), an accent over it when one fits well (squares for loud bass, flee or calligraphy for fast,
murmuration for loud chords, pixel sort or glitch blocks to smear and tear the base), and the casket on top where it is
loud and full. Every loved or kept widget has a place in `src/studio/compose/taste.ts`, used at its defaults; a widget
that paints its own ground is only ever a base. It is a starting point: a composed show should follow the music's form
(and the user's words) more closely than that.

## Composing as a composer: how the two first shows were made

`shows/rach-prelude-recording.json` and `shows/beethoven5.json` were written by hand this way. Repeat it for a new song.

### 1. Find the form, closer than describe-song

`describe-song` gives 10 s steps; the turns of a piece need finer ones. Group the pack's notes into attacks (as the
widgets do: a note joins the attack when it starts < 0.04 s after it) and print, per 4 s: attacks, notes per attack,
mean and peak velocity, the range, how many notes sit below MIDI 50, and the pack's loudness. Then list the attacks
(time, velocity, notes) around each turn you see. In the Prelude that showed every part to the tenth of a second:
the bells (the A–G♯–C♯ octaves at 5.2, 7.0, 8.9 s), the chorale (1.4 attacks/s, middle register, a bass note per bar),
the agitato (from 84.55 s, 8–9 attacks/s), the crescendo (from 116 s the attacks thicken to 2.7 notes at velocity 90+),
the climax (the motto fff in 7-note chords at 125.86 s), the return (the low C♯ toll at 178.74 s), the silence after
the last chord (204–213 s) and, at the end of this recording, 20 s of a faster piece in another key.

The GPU transcriber is a piano model. On an orchestra (Beethoven: onset coverage 0.5) it hears the loud tutti and
little of quiet strings or a solo oboe, so the notes alone do not show the form. Read the audio too, with the venv's
librosa (`C:/Users/maxim/.venvs/wa/Scripts/python.exe -I`): `onset_strength` + `onset_detect`, `rms` in dB and
`chroma_cqt` per onset find repeated-note figures and the near-silent stretches (the oboe cadenza is −28 to −33 dB from
257.6 to 272.4 s, where the pack has two notes).

### 2. Turn the user's words into widgets, places and knobs

Write down each phrase of the description and what answers it. For the Prelude, in the user's words:

| the user | the show |
|---|---|
| "low-frequency notes are scary, fearful and strong, heavy… dark red… square and big. That's the start" | The bells: dread squares alone, `size` 1.5. Dread (the chorale): rorschach's oxblood ink under the squares |
| "progresses into something more rapid… chords stumble over each other… blurry ovals that fade into existence. Yellow-red: hastily, ephemeral, skittish" | Agitato: skittish shapes on their ember palette, `mix` 0.15 (soft dots and ovals), over the squares |
| "The crescendo starts… total panic" | The crescendo (116 s, where the attacks thicken, not at the climax): the casket joins on top |
| "Visuals are dripping from the screen, and the chords initiate cuts over the canvas" | casket `melt` 3, `drips` 0.8 in the crescendo and the climax; the climax's chords (velocity 100+) all cut at the default `cutAt` |
| "pure disgust" | The casket (the climax): rorschach `spatter` 2 under the squares, so the cuts slice ink |
| (their favourite, murmuration) | Return: murmuration alone, `strike` 0.85 and `hold` 3, so each slow chord of the ending re-forms the flock into its figure: the musical trigger the user asked for |

Knobs move only where a phrase asks for what the knob does, and the commit says which. A knob may also answer the
recording: on the orchestral Beethoven, kandinsky's `paint` 0.75 keeps the few transcribed notes on screen longer.

### 3. A recurring event: short sections that keep the base

"The fate motif must punctuate the show every time it strikes" is not a part of the form but an event inside every
part. Shows have only sections, so each strike is a section of its own:

- from just before the strike's first attack to the end of its held note (2–15 s; never under 1 s);
- its layers are the surrounding part's layers (they continue: no reset, they keep taking attacks) plus an accent on
  top that enters, and so is reset, at every strike: dread squares (`split` 72 so the mid-register notes the
  transcriber hears in a tutti make slabs too, `life` 3 so they last through the fermata) and the casket (`cutAt` 80);
- `fade` 0 into the strike (whatever leaves there is cut), 1.5 s after it (the accent fades out under the music);
- strikes closer than a few seconds are one section (the codetta's last bars and the repeat's opening are one).

Decide what counts before you mark it. Here: the motto stated by the whole orchestra, loud, landing on a held note
(a fermata or a breath), and the horn call that opens each second theme. The development and the coda are built
from the rhythm; marking every occurrence would strobe. The fifteen strikes: 0, 17.5, 39.25 (horn call), 78.7 (the
codetta and the repeat's opening), 98.5, 120.2 (horn call), 158.3 (the codetta and the development's opening), 191.4,
227.95, 235.15 (the return of the motto), 255.4 (the fermata before the oboe), 282.0 (horn call), 332.4, 396.3 and
409.8 s to the end. Left out, as rhythm inside a part rather than a strike: the loud repeated-note figures at 34.7,
204.1, 348.8, 364.1 and 388.6 s (364.1 comes closest; add a section there if it should punctuate too). Found as above: three equally spaced attacks of one pitch class (0.1–0.36 s apart) then a held
note, from the audio's onsets and chroma and from the notes, checked by hand against the loudness.

Each part gets its own picture, and a part that returns gets its picture back: first theme kandinsky (exposition,
repeat, recapitulation); closing kandinsky + skittish shapes; second theme woven threads (`heat` 0.85, ember);
development rorschach (`sym` 4, `ink` 1: indigo, four-way) + murmuration; oboe cadenza colour fields (`home` −1,
`n` 1: one deep blue field) under one thread of the current (`threads` 1); coda rorschach (`sym` 8, `ink` 2: soot and
gold, `size` 0.7, `fade` 5) + skittish shapes. A show with 33 sections is easier to write from a short plan (parts and
strike times) with a few lines of script; write the result with `canonicalShow` and check it.

### 4. Look, then change what the frames show

Render the whole song (`npm run render-show -- <id>`: about 0.45 s per video second, the Prelude in 1:45, Beethoven
in 3:15) and read three kinds of picture:

- a contact sheet of the whole show, one frame per 4–5 s (`ffmpeg -i renders/<id>.mp4 -vf "fps=1/5,scale=240:-1,tile=8x8" sheet.png`);
- frames 0.3–1 s after each boundary and each strike (does the change land? is the accent visible?);
- one full-size frame per picture (is it beautiful, and does it look like the words?).

What the first looks showed and what changed:

- Prelude: the chorale with the current was a small thread in a black screen → rorschach's oxblood ink under the
  squares (dark red, heavy, mirrored). The climax without rorschach was mostly black between the cuts → rorschach
  under squares and casket, so there is something to cut and melt. The return on colour fields was flat orange bands,
  and murmuration alone was a small knot that rarely re-formed → murmuration alone with `strike` 0.85, `hold` 3.
- Beethoven: half the strikes showed nothing, because the transcriber gave them no notes below MIDI 50 (the squares'
  default split) → `split` 72, `life` 3. The oboe cadenza was black for 15 s (no notes) → colour fields under one
  thread. The gold coda kaleidoscope filled the whole screen → `size` 0.7, `fade` 5. After the second look the slabs
  at `size` 1.2 hid the base picture during the long strikes → `size` 1.

Sections without notes stay black (the shared fade): quiet passages the transcriber does not hear are dark unless a
widget draws without attacks (colour fields; the current's thread). That can be right (the Prelude's silence before
its last 20 s) or a hole (the oboe).

### 5. Share

`render-show` writes 720p at CRF 18 (Beethoven's first movement: 165 MB). For WhatsApp, re-encode two-pass to a size:
video kb/s = MB × 8000 / seconds − 128, e.g. 27.5 MB for 425 s → 389 kb/s, at 960×540:

```sh
ffmpeg -i renders/beethoven5.mp4 -vf scale=960:540 -c:v libx264 -preset slow -b:v 389k -pass 1 -an -f null -
ffmpeg -i renders/beethoven5.mp4 -vf scale=960:540 -c:v libx264 -preset slow -b:v 389k -pass 2 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart winkelamp-beethoven5.mp4
```

The Prelude (232 s) keeps 720p at 819 kb/s. Both come out at 28 MB.

## Combinations

Some widgets do more together than side by side: one acts on what another drew. Each pair or trio below was shot
together and alone on the same passages, and the stills were looked at (round 7). The lab lists them in
`lab/combos.js`, under a "combines with" pill on each member's card, with a "try together" button. Stack them as one
section's layers, **in the order given** (bottom → top): that is the order they were judged in. Pixel sort, time slice,
fold and stella work on the finished picture after every other layer, so they go last. Knobs: the values listed are
needed or were shot; "worth trying" ones were not shot.

Most of them only show on strong attacks: put them where the music is loud and chordal (a climax, a coda, the casket),
not over a quiet stretch, where they look like their base widget alone.

| layers (bottom → top) | what you see | knobs | where |
|---|---|---|---|
| `kusama`, `pixelsort` | Kusama's colour changes: strips of the old colours dragged across the new picture, a print torn on every loud chord | worth trying: pixelsort `band` 1.6, `len` 1.0 | loud chords (Prelude 2:04–2:13, Beethoven coda) |
| `score`, `pixelsort` | heavy chords drag the score's stems, beams and dots into rust-and-black melts that drip; the page heals after | score `paper` 1 (the default; needs paper); worth trying: pixelsort `own` 0.3 | slow, heavy chords; nearly invisible elsewhere |
| `ikeda`, `blocks`, `pixelsort` | Ikeda's barcodes and rows torn into sliding strips that snap back: a data machine failing in time; pixel sort melts the torn codes into white drips | worth trying: blocks `amount` 0.8, pixelsort `own` 0.3 (pixel sort is optional) | loud, percussive passages |
| `squares`, `strings`, `blocks` | the woven threads and dread squares torn into sliding red and white slabs that settle back in steps | defaults | loud chords |
| `marbling`, `blocks` | combed marble rings cut into sliding bands that heal back into the curves | keep blocks `form` positive (rows); worth trying: marbling `drop` 1.3 | the casket, the agitato |
| `marbling`, `pixelsort` | wide strips of the marble torn sideways into stripes of its own reds and bone, past the edge of the drop | worth trying: pixelsort `own` 0.2, `band` 1.5 | the Prelude's loud passages; pixel sort barely fires on Beethoven |
| `strings`, `brush`, `casket` | ink strokes grow stepped drips, the threads hang down in stepped curtains, big chords shear both | worth trying: casket `drips` 0.25, `melt` 1.5 | medium-density passages; crowded at a dense climax |
| `murmuration`, `casket` | the flock's chord figure weeps down in stepped columns, slashes cut across it | worth trying: casket `drips` 0.3 | loud chords (Beethoven coda); adds little in quiet ones |
| `kandinsky`, `casket`, `pixelsort` | every line and shape melts into dripping fringes; pixel sort pulls the melt into blue, gold and red sheets | defaults | loud passages (Prelude 2:06–2:15, Beethoven 0:30) |
| `riley`, `pixelsort` | Riley's stripes torn into sliding grey and white bars, a clean glitch through the op art | keep riley black and white; worth trying: pixelsort `band` 1.5, `len` 1.0 | loud, wide chords only |
| `score`, `squares`, `brush` | a night page: chalk notation for every note, a bone brushstroke for the melody, red slabs for the bass, slashes at big chords | **score `paper` 0** (night; on paper the melody stroke vanishes) | everywhere; dense but legible at climaxes |
| `miro`, `rorschach` | Rorschach on Miró's cream sheet becomes a sepia inkblot of the left hand, Miró's constellation over it | worth trying: rorschach `size` 0.7, miro `life` 11 | everywhere; brownish when loud and crowded |
| `horizon`, `murmuration`, `pixelsort` | loud chords sort the sea itself: the horizon tears into a long grey band, the flock's red smears into it | **pixelsort `own` 0.1** (at the default its amber muddies the sea) | loud, chordal passages |
| `fields`, `brush` | a bone calligraphy line with red slashes over Rothko fields that recolour with the harmony | fields `home` -0.6, `chords` 0.5 (shot: they stay violet and blue; at the defaults the Prelude's casket floods them red and orange and the slashes sink in) | everywhere |
| `riley`, `fifths` | Riley's stripes as a stencil: the chord shape glows through the black bands only | defaults | loud chordal passages; a Riley solo in quiet bars |
| `riley`, `timeslice` | Riley rebuilt strip by strip from the last 1.5 s: staircases of cut stripes, each note a sharp band of the present | defaults (`mode` 2, rings, turns the oval into a target) | everywhere Riley moves |
| `marbling`, `fold` | every drop mirrored across a line that turns with the bass: a symmetrical marble | defaults | everywhere |
| `kusama`, `fold` | a twin colony; loud chords fold it fourfold for a moment | defaults | everywhere (the gold seam vanishes on the yellow ground) |
| `score`, `squares`, `stella` | concentric stripes frame the page, one more per attack, dark on paper | defaults | busy passages pile up stripes |

The last four use this round's new widgets (time slice, fold, stella), which the user has not judged yet.

## The widgets

<!-- widgets:start -->

_Generated by `npm run widget-docs` from `lab/tools/*.js`, the verdicts in `lab/index.html` and the tags in `lab/tags.json`; do not edit by hand._

_Feel: synesthetic feel words (`lab/tag-words.json` says what each looks and sounds like). Suits: instruments that go well with it. Role: where it sits in a stack: **under** paints first and never darkens what is on top; **ground** paints its own canvas, so it goes first; **base** fills the picture but lets others show; **accent** moves over a base; **top** works on whatever is below it._

### Loved

#### `miro`: Miró

After Miró's Constellations: the melody draws one thin black line that wanders over a pale washed sheet, leaving stars and dots along it. Short notes drop dots, held notes swell into red, blue, yellow and black blobs, loud deep notes set crescents, and where shapes overlap their colours flip.

Feel: playful, airy, pale, longing · Suits: flute, clarinet · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `life` | how long the sky stays | 4..40 | 16 | fixed | How long the shapes and the line stay on the page. Left: a few seconds, the sheet keeps clearing. Right: the whole passage builds up into one crowded sky. |
| `wander` | how the line wanders | 0..2 | 0.9 | faster → more | How strongly the melody turns the line. Left: long, calm curves. Right: it loops, curls and zigzags with every step of the tune. |
| `swell` | how big the blobs grow | 0.4..2 | 1 | louder → more | How big a held note's blob grows. Left: small pebbles. Right: big swelling forms. |
| `colour` | how much colour | 0..1 | 0.65 | fixed | How many shapes are red, blue or yellow instead of black. Left: black ink only. Right: almost everything in colour. |
| `web` | lines between the stars | 0..1 | 0.5 | fixed | Thin straight lines tying together the notes of a chord, and each new star to a neighbour. Left: only the one wandering line. Right: a dense web of constellations. |

#### `delaunay`: Delaunay

Sonia and Robert Delaunay's simultaneous discs. Three discs of rings (bass, middle, treble), each ring cut into coloured segments that turn at their own speed. Every note has its own colour (round the circle of fifths) and lights its ring at its own clock position, with the opposite colour beside it; the struck ring jumps, flashes and swells outward through the disc.

Feel: vivid, whirling, swelling, playful · Suits: plucked, clarinet · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `turn` | how fast the rings turn | 0..1 | 0.3 | faster → more | How fast the rings turn. Left: almost still. Right: whirling, each ring against its neighbour. |
| `contrast` | opposite colours | 0..1 | 0.65 | fixed | Whether a lit segment sets its opposite colour beside it. Left: only the note's own colour. Right: every colour gets its complementary partner. |
| `pulse` | swell on each note | 0..1 | 0.45 | louder → more | How far the rings swell outward when a note is struck. Left: the discs stay put. Right: every attack throbs out through the rings. |
| `memory` | how long colours glow | 0.4..8 | 3.5 | fixed | How long a lit segment stays bright before it sinks back to a dark glaze. Left: a flash. Right: the colours of a chord glow for seconds. |
| `cut` | how finely cut | 0..1 | 0.25 | fixed | How many segments each ring is cut into. Left: big halves and quarters. Right: fine eighths and sixteenths. |

#### `lewitt`: LeWitt

After Sol LeWitt's wall drawings. Every note is a point on the wall (left to right by pitch, one row per note name), and every attack carries out a rule in fine coloured-pencil lines: lines from the corners, lines through the notes in four directions, arcs, squares of parallel lines, lines from the sides, a chain from note to note, lines from the centre. The lines pile up into a dense, systematic drawing; each new section of the music starts a fresh wall with the next rule, written on the wall in pencil.

Feel: pale, airy, marching, serene · Suits: harpsichord, piano · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `rule` | the rule | 0..7 | 0 | fixed | Which rule the lines follow. Left: the rule changes with each section of the music. Right: always one rule, from lines from the corners through four directions, arcs, squares, sides and a chain to lines from the centre. |
| `lines` | lines per note | 1..4 | 3 | faster → less | How many lines each note draws. Left: one line per note, a sparse drawing. Right: four (from every corner, in every direction), a dense web. |
| `pencil` | pencil or crayon | 0..1 | 0.15 | louder → more | How heavy the lines are. Left: a hard, hair-thin pencil. Right: a soft, thick crayon. |
| `colours` | how many colours | 0..1 | 1 | fixed | Which pencils are used. Left: graphite only, grey on white. Right: all four of LeWitt's colours: graphite, red, blue and yellow. |
| `full` | how full a wall gets | 100..3000 | 700 | fixed | How many lines a wall takes before it is painted over and a fresh wall begins with the next rule (a new section of the music always starts one). Left: a clean wall every few chords. Right: the lines pile up into a dense web. |

#### `kusama`: Kusama

After Yayoi Kusama. One flat colour with dots in its partner colour. Every note starts a colony of dots at its pitch (low left, high right): a big dot on the attack, smaller ones spreading out while the note is held. Full chords lay patches of an infinity net that tightens as the music speeds up. The harmony picks the colours (red/white, yellow/black, blue/white; minor and major swap ground and dots), flooding in from the new chord as one huge dot.

Feel: vivid, grainy, playful, marching · Suits: piano, plucked · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `size` | how big the colonies are | 0.4..1.8 | 1 | louder → more | How big each note’s colony of dots grows. Left: small clusters. Right: huge dots and wide colonies. |
| `stay` | how long the dots stay | 1.5..18 | 6 | fixed | How long a colony stays before it shrinks away. Left: a couple of seconds. Right: they pile up for a long time. |
| `tight` | how tight the net is | 0..1 | 0.45 | faster → more | The size of the net’s little loops. Left: big, loose loops. Right: a tight mesh of tiny ones. |
| `wild` | dot sizes: even or wild | 0..1 | 0.5 | fixed | How much the dots in a colony differ in size. Left: neat, even rings of dots. Right: big and tiny dots mixed. |
| `flip` | how often the colours change | 0..1 | 0.5 | fixed | How readily a change of harmony floods the screen with a new colour pair. Left: only now and then. Right: at every change of chord. |

#### `ikeda`: Ikeda

After Ryoji Ikeda: black and white data. Every note is a barcode at its key (the same note always gives the same code, louder is wider) that strobes across the screen on the attack, settles on the row of its note name (every C on one row, every G on another) and erodes bar by bar; rows of glyphs stream the notes, a one-pixel score scrolls past a playhead, and loud attacks slam hairlines across the screen.

Feel: icy, flickering, brittle, marching · Suits: harpsichord, piano · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `busy` | how much data | 0..1 | 0.3 | faster → more | How full the screen is with streaming glyphs and data columns. Left: a few clean bars and lines. Right: dense data everywhere. |
| `life` | how long a barcode stays | 0.1..3 | 1.2 | fixed | How long a note's barcode takes to erode after the note ends. Left: gone in a blink. Right: it crumbles slowly, bar by bar. |
| `slam` | lines on loud notes | 0..1 | 0.35 | louder → more | How many single-pixel lines slam across the screen when a note is struck loud. Left: none. Right: a burst of lines. |
| `flash` | white flashes | 0..1 | 0.5 | fixed | How often the very loudest attacks turn the whole screen white for an instant. Left: never. Right: on every big accent. |
| `speed` | scroll speed | 0.3..2.5 | 1 | fixed | How fast the score and the glyph rows scroll. Left: a slow drift. Right: racing past. |

#### `horizon`: Horizon

After Sugimoto’s seascapes: one soft horizon between a still grey sky and a long-exposure sea. The harmony tints both very faintly, loudness raises the contrast and lights the line, each note sends a faint shimmer along the horizon (a strong one also breathes light into the haze), and the bass lowers it a little. For quiet music; it is meant to look almost still.

Feel: still, serene, cool, longing · Suits: strings, clarinet · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `level` | where the horizon sits | 0.4..0.6 | 0.46 | more bass → more | How high the horizon is. Left: high, mostly sea. Right: low, mostly sky. At first it follows the bass: deep notes pull it down a little. |
| `contrast` | how stark | 0..1 | 0.28 | louder → more | How far apart sky and sea are. Left: fog, two nearly equal greys. Right: a bright sky over a black sea. At first louder playing makes it starker. |
| `soft` | soft horizon | 0..1 | 0.3 | fixed | How soft the line between sky and sea is. Left: a knife edge. Right: they melt into each other through haze. |
| `shimmer` | shimmer on each note | 0..2 | 1 | fixed | How strongly each note glints along the horizon. Left: no glints, only the light of the line. Right: bright glints that run far along it. |
| `colour` | colour from the harmony | 0..1 | 0.5 | fixed | How much the chords tint the grey. Left: pure greys. Right: each chord tints the sky and the sea (still gently). |

#### `score`: Graphic score

The music writes its own abstract score, drifting slowly to the left like a page of Cardew’s Treatise: high notes sit high, held notes draw beams, loud notes are heavy and filled, soft ones hollow; chords stand on stems (a loud cluster is a black block, a soft one an open box), sometimes bracketed with a small numeral; deep loud bass leaves black discs, the biggest chords throw a large circle, and a silence starts a new line.

Feel: flowing, airy, pale, playful · Suits: piano, flute · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `speed` | how fast the page moves | 20..140 | 48 | faster → more | How fast the writing drifts to the left. Left: slow, the marks crowd together. Right: fast, they spread far apart. |
| `ink` | how much gets written | 0.5..8 | 1.6 | fixed | How many attacks are written out in full; the rest are left as specks. Left: only the strongest few, sparse and calm. Right: nearly every note. |
| `figures` | plain or ornate | 0..1 | 0.45 | fuller chords → more | How rich the notation is. Left: plain dots and lines, like Cage. Right: brackets with numerals, black discs, slabs and big circles, like Treatise. |
| `weight` | weight of the ink | 0.4..2.4 | 1 | louder → more | How heavy the pen is. Left: fine hairlines and small dots. Right: thick beams and big black marks. |
| `paper` | night or paper | 0..1 | 1 | fixed | The page. Left: pale ink on black, like chalk at night. Right: black ink on bone paper, like a printed score. |

#### `boogie`: Boogie woogie

After Mondrian's Broadway Boogie Woogie: yellow lanes on cream. Each note drops a small red, blue or grey block where its pitch lane (low notes left) meets the row of its harmony, and every attack makes all the blocks hop along their lanes, so rhythm drives the traffic: fast passages boogie, a slow chorale barely moves. Big loud chords flash a whole crossing.

Feel: playful, marching, vivid, warm · Suits: piano, plucked, clarinet · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `lanes` | how many lanes | 6..16 | 10 | fixed | How dense the city is. Left: a few wide lanes. Right: a tight grid of thin ones. |
| `hop` | how far they jump on each note | 0..2 | 0.6 | faster → more | How far every block hops along its lane when a note is struck. Left: they stand still. Right: two steps at a time. |
| `life` | how long blocks stay | 1..12 | 6 | fixed | How long a block lives before it shrinks away. Left: a second. Right: they pile up for many seconds. |
| `flash` | big-chord flashes | 0..1 | 0.7 | fixed | How easily a big chord flashes a whole crossing with a large coloured plane. Left: never. Right: even modest chords, and bigger planes. |
| `ground` | background | 0..1 | 0 | fixed | The colour under the lanes. Left: Mondrian's cream. Right: night black. |

#### `murmuration`: Murmuration (your favourite)

A flock that carries the mood: a dark knot that throbs on low tolls, a ribbon tracing the melody, jittery shards when agitated. Now a loud chord re-forms it, on the attack, into <b>that chord’s own figure</b>: its notes sit on a clock face (C at the top, then clockwise C♯, D … B) and the flock draws the shape they make, a spoke pointing at the bass. Major chords are straight-edged, minor ones curl into stars, two notes make a lens, one note a clock hand. Same chord, same figure.

Feel: flowing, whirling, dread, skittish · Suits: strings, cello · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `strike` | which chords re-form it | 0..1 | 0.6 | fixed | How loud a chord must be to pull the flock into its figure. Left: only the biggest, loudest chords. Right: any firm chord. |
| `hold` | how long a figure stays | 0.8..6 | 2.6 | fixed | How long the flock keeps a chord’s figure before it melts back into the melody. Left: a glimpse. Right: holds for seconds. |
| `tight` | how crisp the figures are | 0..1 | 0.6 | fixed | How tightly the birds keep formation. Left: a loose, smoky cloud. Right: crisp, thin lines. |
| `trail` | trail length | 1..16 | 9 | faster → less | How long each bird’s streak is. Left: short dashes. Right: long streaks. |
| `bleed` | red on loud notes | 0..1 | 0.6 | louder → more | How much loud notes stain the flock red. Left: it stays pale. Right: blood red, white-hot on the biggest chords. |

#### `marbling`: Marbling (extremely high potential)

Every attack drops ink on a still bath and pushes the older ink outward into bands. <b>Louder = a bigger drop</b> (a bead when soft, a flood at fff). <b>Higher = brighter ink, landing higher</b>; low notes are dark and sink low. Within a phrase the drops walk along, a step per chord; a pause, or a sudden rush of faster notes, starts a new phrase elsewhere. <b>The comb comes on loud accents and at each new phrase</b> (more often when the music runs fast) and rakes the older ink into feathers. The bass twists it.

Feel: liquid, flowing, swelling, warm · Suits: piano, strings · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `drop` | drop size | 0.4..1.8 | 1 | fixed | How big the drops are overall; louder notes always make bigger ones. Left: small beads. Right: floods. |
| `combing` | combing | 0..1.5 | 0.6 | faster → more | How often and how hard a comb rakes the ink (on accents, new phrases, and fast runs). Left: never combed; the ink stays in smooth bands. Right: raked into feathers. |
| `twist` | swirl | 0..1 | 0.1 | more bass → more | How much the bass twists the ink around the newest drops. Left: still water. Right: a whirlpool. |
| `palette` | colours | 0..3 | 0 | fixed | The inks, low notes to high. Left: blood and bone; then indigo and gold, verdigris and ash. Right: a rainbow by note. |
| `fill` | lines ↔ solid | 0..1 | 0.8 | fixed | How the ink is drawn. Left: thin outlines on black. Right: solid bands of colour. |

#### `kandinsky`: Kandinsky (a complete visualization by itself)

The notes paint a Kandinsky: low notes are heavy black bars crossing a plane of colour (the loudest, deepest ones a small checker grid or a black sun), middle notes blue circles, high notes yellow triangles that fly outward. Chords become constellations, the melody a line. v2: no more red squares (that is Dread squares), a notch quieter, 5 knobs on our defaults.

Feel: vivid, playful, triumphant, heavy · Suits: tutti, trumpet, cello · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `edges` | round or sharp | 0..1 | 0.3 | louder → more | The shapes' edges. Left: soft, round circles and rounded bars. Right: crisp bars, thin lenses and needle-sharp triangles. |
| `rings` | solid or outlined | 0..1 | 0.5 | louder → less | How many shapes are drawn as outlines with rings inside. Left: all solid colour. Right: mostly outlines and concentric rings. |
| `web` | connecting lines | 0..1 | 0.5 | fixed | Lines joining the notes of a chord, the melody, and the long lines thrown by big chords. Left: shapes only. Right: a dense web. |
| `restless` | calm or restless | 0..1 | 0.3 | faster → more | How the painting moves. Left: still and composed, chords form neat figures. Right: shapes scatter, spin and drift away. |
| `paint` | how much paint | 0..1 | 0.45 | fixed | How bold the painting gets. Left: small, faint shapes that leave soon. Right: big, saturated shapes that stay for many seconds. |

#### `rorschach`: Rorschach ink (keep our defaults)

Low notes drop ink that soaks out into mirrored blots; higher notes fling specks; the loudest, fullest chords splatter. Five knobs now, all starting at the defaults you loved.

Feel: liquid, dark, dread, heavy · Suits: cello, contrabass, bassoon · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `sym` | mirror pattern | 1..8 | 1 | fixed | How the ink is mirrored. Left: one fold down the middle, like a folded page. Next: four-way. Right: a kaleidoscope star of up to 8 folds. |
| `ink` | ink colour | 0..5 | 0 | fixed | The ink and the glow round its edge. Left: oxblood on black. Then indigo, soot with gold, green, violet with rose. Right: pale bone ink. |
| `size` | blot size | 0.3..2.5 | 1 | fixed | How far each drop of ink spreads. Left: small spots. Right: big blots. |
| `spatter` | spatter | 0..3 | 1 | louder → more | How much higher notes fling specks, and how readily loud full chords splatter. Left: clean blots, no spray. Right: lots of spray and splatters. |
| `fade` | how long the ink stays | 1..13 | 9 | louder → less | How long the ink takes to dry away. Left: blots vanish within a second or two. Right: they stay on the page for many seconds. |

#### `squares`: Dread squares

Low notes land as big dark-red squares. Now they fade in about 1.4 s, and their edges are soft and blurred.

Feel: heavy, dark, dread, stabbing · Suits: piano, contrabass, timpani · Role: accent

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `size` | size | 0.3..2 | 1 | fixed | How big the squares are. Left: small tiles. Right: huge slabs. |
| `life` | how long they stay | 0.3..4 | 1.4 | fixed | How long a square stays. Left: a blink. Right: lingers for seconds. |
| `blur` | soft edges | 0..3 | 1 | fixed | How soft the edges are. Left: sharp, clean edges. Right: blurred, glowing ones. |
| `split` | which notes count as low | 36..72 | 50 | fixed | Only notes below this point make squares. Left: only the deepest bass. Right: up to the middle of the piano. |
| `shake` | shake on loud notes | 0..2 | 1 | louder → more | How hard the picture shakes when a note is struck very loud. Left: still. Right: a jolt. |

#### `flee`: Skittish shapes

High notes stumble in as small hot shapes that freeze, tremble, then bolt, faster and faster, smearing into streaks and heating towards white as they go. Bass hits rise from below, loud chords burst inside the flock and melody leaps blow up the old spot, scattering them; fast passages make them dense and frantic, slow ones leave a few cold stragglers.

Feel: skittish, burning, flickering, panic · Suits: violin, flute, piano · Role: accent

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `mix` | round or sharp shapes | 0..1 | 0.45 | fixed | Which shapes appear. Left: soft dots, ovals and rings. Right: hooks, chevrons and needles. |
| `exp` | how sudden the bolt | 1..5 | 3 | fixed | How a shape speeds up once it flees. Left: a steady glide away. Right: it creeps, then shoots off. |
| `twitch` | how jumpy | 0..1 | 0.25 | faster → more | How nervous they are. Left: calm, smooth paths. Right: constant flinches and sudden swerves. |
| `streak` | trail length | 0..3 | 0.8 | faster → more | How far a fleeing shape smears behind itself. Left: no trail, only the shape. Right: long streaks of light. |
| `pal` | colours | 0..3 | 0 | fixed | The colours, from cool and dark when still to hot and bright when fleeing. Left: ember (red to yellow). Then ice (blue), bone (pale), and right: venom (violet to pink). |

#### `current`: The current

Thin threads braid through moving water: the melody steers the white-gold one, inner voices and the bass weave around it and cross on their own notes, swelling as they play. Chords pour coloured dye that the water spreads; tempo sets how fast the water runs and big chords tear vortices.

Feel: flowing, liquid, silky, glowing, serene · Suits: violin, flute, strings · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `threads` | how many threads | 1..5 | 3 | fixed | How many threads braid together. Left: the melody’s white-gold line alone. Right: five, with the inner voices and the bass. |
| `braid` | how wide they weave | 0..220 | 70 | fixed | How far the other threads swing around the melody’s thread. Left: tight together, almost one line. Right: wide loops that cross far apart. |
| `width` | thread thickness | 0.3..2.5 | 0.9 | louder → more | How thick the threads are drawn. Left: hair-thin. Right: thick, glowing cords. |
| `flow` | water speed | 0.2..3 | 1 | faster → more | How fast the water runs and the threads travel. Left: a slow, lazy drift. Right: a rushing stream. |
| `hue` | ink colour | 0..360 | 350 | fixed | The colour the chords pour into the water. Left and right are both red; in between it runs orange, yellow, green, blue, violet. |

#### `strings`: Woven threads (accepted the defaults)

Each note is a curved thread in one woven band. Consonant notes lean together, clashing ones knot up; every chord braids its notes at one spot and sends bright kinks running along them; held notes swell and glow; the hardest chords snap a thread and whip the weave. Five knobs now, all starting at the defaults you accepted.

Feel: skittish, anxious, twitchy, fibrous · Suits: violin, plucked · Role: texture

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `bend` | shape: band → rings | 0..1 | 0.32 | fixed | How much the band of threads curls. Left: a straight band across the screen. Middle: an arch. Right: closed woven rings. |
| `weave` | crossings | 1..9 | 3 | fixed | How many times the threads cross each other along the band. Left: one long, slow wave. Right: a tight weave. |
| `sway` | how much they sway | 0..160 | 46 | louder → more | How far the threads swing up and down. Left: flat, still threads. Right: wide swinging waves. |
| `tangle` | knots on clashing notes | 0..1 | 0.45 | fuller chords → more | How much a thread curls into knots when its note clashes with another (a dissonance). Left: never knots. Right: big tangled curls. |
| `heat` | colours | 0..1 | 0.5 | fixed | The colours of the threads (low notes darker, high notes paler). Left: ink blue and ice. Middle: blood red and bone. Right: ember and gold. |

#### `brush`: Calligraphy

The melody written as ink brush strokes: one stroke per phrase, climbing and diving with the top notes, swelling on each attack, drying into streaks and flicking off at the phrase end. Low notes under the melody leave ink dabs; strong chords add a red slash, and after a pause a red ensō circle.

Feel: longing, swelling, silky, stabbing · Suits: cello, voice, flute · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `size` | brush size | 0.3..3 | 1.2 | louder → more | How thick the ink strokes are. Left: a fine pen line. Right: a fat, loaded brush. |
| `dryness` | dry brush | 0..1 | 0.3 | faster → more | How much ink the brush holds. Left: wet, solid ink. Right: a dry brush that breaks into streaks. |
| `leap` | how far it follows the notes | 2..24 | 5 | fixed | How far the stroke climbs and dives with the melody. Left: an almost level line. Right: a big leap for every note. |
| `gestures` | slashes on big chords | 0..1 | 0.5 | fixed | How often a strong chord adds a red slash (or, after a pause, a red ensō circle). Left: never, only the melody. Right: on most strong chords. |
| `stay` | how long the ink stays | 1..30 | 8 | fixed | How long a stroke stays before it dries away. Left: gone in a second. Right: stays half a minute, the page fills up. |

#### `blocks`: Glitch blocks

Every attack tears blocks of the picture out of place, and they snap back in choppy steps. A quiet note nudges one thin slice; a big chord tears a whole mosaic and flashes an inverted band. Thin note bars (low = red, high = bone) give it a picture of its own; mix it with squares, ink or the casket and it tears those too.

Feel: stabbing, brittle, flickering, panic · Suits: piano, harpsichord · Role: top

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `size` | block size | 8..240 | 64 | faster → less | How big the torn pieces are. Left: thin slivers and fine grit. Right: big chunks of the picture. |
| `form` | columns or rows | -1..1 | 0.6 | fixed | The shape of the torn pieces. Left: tall columns that slip up and down. Right: wide rows that slide sideways. |
| `jump` | how far they jump | 0..2 | 0.9 | louder → more | How far a torn piece is thrown out of place. Left: a small shiver. Right: flung far across the picture. |
| `amount` | how many tears | 0..3 | 1.2 | fixed | How many pieces each attack tears. Left: hardly any, only the biggest chords. Right: a storm of fragments on every chord. |
| `settle` | how long until it heals | 0.15..5 | 1.6 | fixed | How long a torn piece takes to snap back into place. Left: a split-second stutter. Right: the broken picture hangs for seconds. |

#### `riley`: Op art

A Bridget Riley stripe field the music bends. Bass notes swell it into lenses, the melody sends ripples through it (higher notes, tighter ripples), chords kink it into sharp chevrons and the biggest ones cut an inverted band through it. It brightens as the music gets louder. It fills the whole picture, so widgets drawn before it are hidden.

Feel: flickering, swelling, marching, icy · Suits: strings, contrabass · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `pattern` | pattern | 0..2 | 0 | fixed | What the field is made of. Left: stripes. Middle: a checkerboard. Right: rings around the centre. |
| `stripe` | stripe width | 5..60 | 16 | fixed | How wide each stripe is. Left: fine, dizzying lines. Right: a few broad bands. |
| `bend` | how much the music bends it | 0..2.5 | 1 | louder → more | How hard the notes bend the field: lenses on the bass, ripples on the melody, sharp kinks on chords. Left: almost flat. Right: wild, swelling distortion. |
| `shimmer` | shimmer | 0..2 | 0.3 | faster → more | A fine, fast trembling of every edge, so the eye fizzes. Left: still, clean edges. Right: the whole field buzzes. |
| `colours` | colours | 0..5 | 0 | fixed | The pair of colours. From left: black and bone, black and blood red, oxblood and bone, ink blue and ochre, black and cold cyan, teal and vermilion. |

#### `halftone`: Halftone

Two overprinted dot screens, deep red and pale. Each attack sends a wave of swelling dots out from a point placed by pitch: low notes big slow swells on the red screen, high notes small fast ripples on the pale one; held chords print a faint standing interference pattern, and the loudest full chords flash the red screen in negative.

Feel: grainy, swelling, warm, flickering · Suits: strings, piano · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `grid` | dot size | 10..44 | 20 | fixed | How coarse the dot screen is. Left: a fine screen of tiny dots. Right: a coarse screen of big dots. |
| `shape` | dot shape | 0..3 | 0 | fixed | What the screen is printed with. Left: round dots, then squares, then crosses. Right: lines. |
| `life` | how long the waves last | 0.4..6 | 2.2 | fixed | How long a wave of dots keeps spreading before it fades. Left: a quick pulse. Right: slow rings that linger. |
| `contrast` | hard print | 0..1 | 0.45 | louder → more | How the dots swell. Left: soft, every size in between, like a photo. Right: hard, each dot is either full or gone, like a stamp. |
| `standing` | stripes from held chords | 0..1.5 | 0.6 | fuller chords → more | While a chord rings, its notes print a faint standing pattern of stripes. Left: none, only the waves. Right: strong stripes. |

#### `casket`: The casket (built into the app)

The picture melts, paint drips from the top, and big chords slash cuts through everything. Mix it with other tools to see what it cuts. Its five knobs start at the settings you loved.

Feel: panic, stabbing, liquid, burning · Suits: tutti, piano, timpani · Role: top

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `melt` | melt | 0..6 | 2.2 | fixed | How fast the whole picture slides down and melts. Left: it holds still. Right: it runs down fast. |
| `drips` | drips | 0..1 | 0.5 | fixed | How many notes start a drip of paint from the top. Left: no drips. Right: every note drips. |
| `cutAt` | which chords slash | 80..118 | 92 | fixed | How loud a chord of three or more notes must be to slash a cut. Left: almost every full chord cuts. Right: only the very loudest. |
| `gap` | how far a cut slides | 0..3 | 1 | fixed | How far the two sides of a cut slide past each other. Left: a hairline. Right: a wide shear. |
| `shake` | jolt on a cut | 0..2 | 1 | fixed | How hard the picture jolts when a cut lands. Left: still. Right: a violent jolt. |

### Kept

#### `fischinger`: Fischinger

After Oskar Fischinger's Optical Poem: on a deep blue ground, coloured discs, rings and bars swoop in on every note and stand in a figure by pitch (a row, an arch, a ring, a V, a spiral...) that each chord chooses. New in v2: every note lands with a pop and a ring, loud ones fast and bright, soft ones slow and pale; held notes stay lit, a few notes make big shapes and a crowd many small ones, and the figure rises with high music and sinks with low.

Feel: playful, marching, vivid, glowing · Suits: tutti, plucked · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `scatter` | neat lines or scattered | 0..1 | 0.3 | faster → more | What fast runs do to the figure. Left: it keeps its neat lines. Right: every run makes it bloom outward and turn before it springs back. |
| `depth` | how far away they fly in from | 0..1 | 0.6 | louder → more | Where a new shape comes from. Left: it simply pops up in its place. Right: it swoops in from deep in the blue, loud notes fastest. |
| `echoes` | echoes behind each shape | 0..4 | 2 | fixed | Copies that follow each shape a step behind and a little deeper, like dancers in canon. Left: none. Right: four. |
| `snap` | glide or snap | 0..1 | 0.55 | fixed | How the shapes move into a new formation. Left: slow, smooth glides. Right: a quick snap with a little bounce, exactly on the beat. |
| `life` | how long they dance | 1..10 | 4 | fixed | How long a shape stays in the company before it sinks back into the blue. Left: a second. Right: ten seconds, a big crowd. |

#### `mclaren`: McLaren

After Norman McLaren's Synchromy. New: the film runs. Every note is a card of bars that enters at the top and streams down (deep notes a few thick rungs, high notes a fine comb); a loud note punches a long, wide card deep into the panel and lights it up, a soft one leaves a small shallow print, and each new card cuts cleanly over the older ones, so sparse music shows single cards with space between them and busy music a layered weave.

Feel: marching, vivid, flickering, playful · Suits: piano, harpsichord · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `panels` | how many panels | 1..9 | 3 | faster → more | How many strips the screen is split into. Left: one wide panel. Right: up to 9 narrow ones (busy music adds more). |
| `spread` | how far a note echoes | 0..1 | 0.55 | fixed | How far each note's bars are repeated into the neighbouring panels. Left: only its own panel. Right: across every panel. |
| `life` | how long the bars stay | 0.15..4 | 1.4 | fixed | How long a note's bars stay on the film after it ends. Left: they vanish near the top. Right: they trail all the way down. |
| `field` | dark or coloured panels | 0..1 | 0.4 | louder → more | The panels behind the bars. Left: nearly black, only the bars are coloured. Right: flat, bright fields of colour. |
| `scroll` | how fast the film runs | 0..1 | 0.35 | fixed | How fast the film streams down the panels. Left: a slow crawl, notes stack up short and close. Right: streaming, notes stretch out long. |

#### `lenlye`: Len Lye

After Len Lye's scratched films: white scratches on black film that boil and jump frame by frame, one mark per note across the film by pitch (bass: tall wriggling pillars; middle: zigzags, coils and rings; treble: little sparks), and loud chords burst into a jagged star with a flash. New in v2: a mark now boils for as long as its note is held, and every note lands as an overexposed, glowing strike before it settles; soft notes are faint broken hairlines, loud ones thick doubled scratches, and high notes sit higher up the film.

Feel: flickering, skittish, brittle, playful · Suits: timpani, plucked · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `wriggle` | how much the lines wriggle | 0..2 | 1.2 | faster → more | How wildly each scratch shakes and jumps from frame to frame. Left: almost steady lines. Right: frantic, boiling scrawl. |
| `fps` | how jerky the film runs | 6..24 | 12 | fixed | How many new film frames are scratched each second (a note always cuts to a new one). Left: slow, jerky stop-motion. Right: fast flicker. |
| `life` | how long a mark stays after its note | 0..2 | 0.4 | fixed | How long a scratch keeps boiling once its note has stopped (it always lasts while the note is held). Left: gone with the note. Right: lingers for seconds. |
| `burst` | bursts on loud chords | 0..2 | 1 | louder → more | How big the jagged burst and the flash are when a loud chord is struck. Left: none. Right: a big spiky star. |
| `dirt` | scratched, dusty film | 0..2 | 1.2 | fixed | How much film dirt runs across the picture: long vertical scratches and dust specks. Left: clean film. Right: battered old print. |

#### `klee`: Klee

After Paul Klee's polyphony paintings: a mosaic of small warm tiles. Each voice of the music writes along its own row in its own glaze, the row climbing and falling with its pitch; where voices cross, the glazes mix. New in v2: quiet notes lay small squares and loud held ones solid blocks, quick passages a finer split mosaic, and every attack pops (a loud one throws a spray of lit tiles).

Feel: warm, grainy, marching, glowing · Suits: strings, harpsichord, violin · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `stay` | how long the colour stays | 3..40 | 14 | fixed | How long the paint stays on the tiles. Left: a few seconds, only the last phrase. Right: the whole passage builds up. |
| `size` | size of the tiles | 12..40 | 20 | fixed | How big the mosaic's squares are. Left: a fine mosaic of many small tiles. Right: a few big tiles. |
| `thick` | how wide each voice paints | 0.6..4 | 1.7 | louder → more | How many tiles tall a note's row is. Left: a single thin line of tiles. Right: broad bands (louder notes are always a bit wider). |
| `mix` | colours mixing | 0..1 | 0.75 | fixed | What happens where two voices cross. Left: the newest colour covers the older one. Right: they glaze over each other into a new colour. |
| `veil` | veil of dots | 0..1 | 0.6 | louder → less | The fine light dots that drift over the picture. Left: bare tiles. Right: a bright veil. It follows the music: quiet passages shimmer, loud ones blaze bare. |

#### `ridges`: Ridges

Ridgelines on black, one slice of the music per line across the keyboard (bass left, treble right); the front line is now and older ones roll away behind it. New: every line keeps the loudness it was made with, so soft passages pack into fine dim hairlines and loud ones spread into bold bright lines, and each attack leaves a spark on its peak that rides back into the stack. Paints its own black.

Feel: dark, flowing, swelling, dread · Suits: piano, cello · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `height` | how tall the peaks rise | 0.3..2.5 | 1 | louder → more | How high a loud note lifts its line. Left: low, gentle hills. Right: tall peaks that hide many lines behind them. |
| `speed` | how fast the lines roll away | 4..30 | 11 | faster → more | How quickly each new line moves back into the stack. Left: slow, a long memory of the music. Right: fast, only the last moment. |
| `lines` | how many lines | 16..80 | 46 | fixed | How many lines are stacked. Left: a few, far apart. Right: many, packed tight. |
| `sharp` | soft hills or sharp needles | 0..1 | 0.4 | fixed | The shape of a peak. Left: smooth, rounded hills. Right: thin, jagged needles. |
| `depth` | flat or deep | 0..1 | 0.3 | fixed | How far the stack recedes. Left: flat, every line the same width. Right: lines shrink and crowd toward the top, rolling into the distance. |

#### `kline`: Kline

After Franz Kline: the biggest chords strike huge bars (low ones lie flat, high ones stand up, full ones get a girder beside them), and slowly soak back into the ground. New in v3: nothing moves unless the music moves it: bars fade without motion, and a bar is painted over only at the moment a new bar lands and pushes it out; and a colour knob. From v2: every other chord lays one short brush mark, so the music draws a broken, cornering line between the bars: short notes leave stubs, held notes longer strokes, loud notes wet slabs, soft ones dry wire, and a leap turns a corner.

Feel: heavy, stabbing, brittle, triumphant · Suits: trombone, timpani, tutti · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `thresh` | which chords strike | 0.5..0.97 | 0.8 | fixed | How much a chord must stand out to strike a big bar; every other chord leaves a small mark. Left: many chords strike bars. Right: only the very biggest. |
| `weight` | how heavy | 0.35..1.9 | 1 | fixed | How thick the bars and marks are. Left: thin, wiry strokes. Right: huge, heavy beams. |
| `stay` | how long they stay | 1.2..24 | 4 | louder → more | How long the bars and marks take to soak back into the ground. Left: gone almost at once. Right: stays for half a minute. By default it follows loudness, so loud passages build up and quiet ones clear. |
| `order` | loose or rigid | 0..1 | 0.7 | faster → less | How strictly the bars are built. Left: free, flung strokes at any angle. Right: rigid girders, level beams and upright posts that meet at joints. By default it loosens up when the music gets busy. |
| `ground` | black or bone | 0..1 | 1 | fixed | The colours. Left: black bars on a bone-white ground. Right: bone-white bars on black. |
| `colour` | what colour | 0..3 | 0 | fixed | The paint. 0: ink (black on bone, bone on black). 1: blood red. 2: yellow. 3: blue. The ground stays black or bone. |

#### `cells`: Cells

A mosaic of coloured cells, one per note, left to right by pitch and coloured by the harmony (warm at home, cool far away). New in v2: bass notes make broad slabs and high notes small chips, each attack swells its cell and flashes a pale kernel that shrinks while the note sounds, and loud attacks send a ring of light through the mosaic.

Feel: warm, pale, flowing, playful · Suits: strings, clarinet · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `edge` | how hard attacks land | 0..2 | 1 | louder → more | How strongly each struck note shows. Left: cells just appear, with thin seams. Right: a struck cell swells, its borders go thick and black, and loud ones send a ring of light through the mosaic. |
| `stay` | how long cells linger | 0..5 | 2 | fixed | When a note ends its cell dims, waits, then closes up into its neighbours. Left: it closes the moment the note ends. Right: it lingers for seconds, so the mosaic fills up. |
| `pebble` | mosaic or pebbles | 0..1 | 0.25 | fixed | The shape of the cells. Left: a tight mosaic of sharp-cornered tiles. Right: separate rounded pebbles with dark gaps between them. |
| `drift` | drift | 0..2 | 0.6 | faster → more | How much the whole mosaic sways and flows. Left: cells stay where the notes put them. Right: everything floats on a slow current. |
| `fill` | solid or outlined | 0..1 | 0.85 | fixed | How the cells are painted. Left: only their outlines, like a line drawing. Right: solid blocks of colour. |

#### `nebula`: Nebula

Every note is a pull, placed round a circle by its note name, and fine glowing grains stream between the notes. New: each attack now flares where its note sits and breathes out a puff of bright, almost white grains (loud notes big, soft ones faint, deep notes slow and wide, high ones quick and fine), and a chord forms separate knots joined by threads.

Feel: glowing, grainy, whirling, burning · Suits: strings, voice · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `pull` | how hard notes pull | 0.2..2 | 0.8 | fuller chords → more | How strongly the notes gather the grains. Left: a loose haze that barely bends. Right: tight, bright knots and threads. |
| `swirl` | fall in or circle round | 0..1.6 | 0.5 | fixed | How the grains move around a note. Left: they fall straight in and stream from note to note. Right: they whirl round it in rings. |
| `amount` | how much dust | 1000..7000 | 4000 | fixed | How many grains there are. Left: a sparse sprinkle. Right: a thick, milky cloud. |
| `threads` | grains or threads | 0.5..6 | 1.4 | fixed | How long each grain draws its path. Left: fine points of dust. Right: long silky threads. |
| `burst` | how each note ignites | 0..2 | 0.9 | louder → more | What happens where a note strikes. Left: it only glows and starts to pull. Right: it flares and breathes out a big puff of bright new grains. |

#### `pixelsort`: Pixel sort (already combines with other widgets in a very cool way)

Now a real pixel sort: each chord sorts the shapes under it by brightness, in place, so whatever the other widgets drew melts in the chord’s direction (bass down, treble up, the melody sideways). Soft chords shimmer a few thin lines, loud ones melt a wide sheet, the loudest tear a band right across the screen, and held chords hold their melt.

Feel: stabbing, brittle, burning · Suits: trombone, strings · Role: top

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `len` | how far it smears | 0.2..1.6 | 0.75 | louder → more | How far each chord pulls the picture out. Left: short nicks at the attack. Right: long streaks across the screen. |
| `life` | how long it stays | 0.2..3 | 1.3 | faster → less | How long a smear hangs before it shrinks back into the attack. Left: a flicker. Right: lingers for seconds. |
| `band` | how wide each smear | 0.3..2.5 | 1 | fixed | How many lines of pixels each chord grabs (big and loud chords grab more). Left: a thin thread. Right: a wide sheet. |
| `pick` | what gets smeared | 0..0.7 | 0.12 | fixed | Which parts of the picture get sorted. Left: everything, dark parts too, into solid bars that cut through. Right: only the brightest bits, as thin glowing threads. |
| `own` | its own colour | 0..1 | 0.6 | fixed | How much colour it adds at each chord. Left: none, it only sorts what other widgets drew. Right: bright streaks of its own. |

#### `mandala`: Mandala

A radial bloom: each note lands on a ring set by its pitch, at an angle set by its note name, copied and mirrored round the circle. New in v2: every attack lands with rays from the centre and a kick; sounding notes are filled (solid when loud, see-through when soft), and once let go they linger as fine outline lace behind the live ones.

Feel: whirling, glowing, swelling, vivid · Suits: plucked, voice · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `mirrors` | copies per note | 0.5..3 | 1.5 | fixed | How many mirrored copies a chord gets, per note in it. Left: a few spokes. Right: dense lace, a big chord fills the circle. |
| `size` | size (breathes) | 0.4..1.3 | 0.86 | louder → more | How big the mandala is; it follows loudness, so it swells on loud chords. Left: a small jewel. Right: fills the screen. |
| `spin` | turning speed | 0..1 | 0.2 | faster → more | How fast the whole figure turns; it follows the tempo, so busy passages turn it faster. Left: still. Right: a steady wheel. |
| `life` | how long they stay | 0.3..8 | 3.5 | faster → less | How long a shape stays after its note ends; it follows the tempo, so busy passages clear faster. Left: a flicker, only the live notes. Right: layers pile up into a dense mandala. |
| `jag` | spikes on clashing notes | 0..1 | 0.7 | fixed | How torn and spiky a petal gets when its note clashes with the others. Left: always smooth. Right: clashes tear and turn violet. |

#### `fields`: Colour fields (a good building block)

Huge, slow, soft fields of colour (Rothko-like), made to sit under other widgets; each field owns a part of the keyboard, bass at the bottom. New in v3: every note now lights its field from inside (low notes to the left, high to the right; loud ones bright and wide, soft ones a faint glow), busy playing makes the edges hum, and a chord change floods its field with the new colour instead of a bright stripe. Quiet passages stay a deep colour instead of going black.

Feel: still, glowing, serene, dark · Suits: strings, horn, voice · Role: under

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `back` | stay in the background | 0..1 | 0.4 | fixed | How much it steps back for widgets drawn over it. Left: a full, glowing painting. Right: a dim veil of colour behind everything. |
| `chords` | chords move the colour | 0..1 | 0.7 | fixed | How far a chord change moves the colours. Left: one family of colour all the way through. Right: each new chord glides it somewhere new on the palette. |
| `home` | home colour | -1..1 | -0.2 | louder → more | The colour it returns to on the home chord. Left: deep blues and plums. Right: oxblood and burnt orange. Follows the loudness at first: loud = warmer. |
| `dyn` | the playing shows | 0..1 | 0.75 | fixed | How much the notes and the loudness show. Left: a still painting whose colours only drift. Right: every note lights its field from inside, loud passages blaze and sharpen, quiet ones sink and blur. |
| `n` | how many fields | 1..4 | 3 | fixed | How many fields are stacked. Left: one enormous field. Right: four, one per register, bass at the bottom. |

#### `fifths`: Harmonic web

The 12 notes sit on a circle of fifths; every attack strings a glowing polygon between the notes sounding, and old chords thin and sink inward into a woven web; the key it hears turns the loom so the home note is on top. New: low notes pull a corner deep inside and high ones break through the rim, soft chords are fine bright lines and loud ones thick lit cords. A struck chord shivers for a moment, calmly for sweet intervals and in fine ripples for clashing ones; a bare octave is a ray along its spoke.

Feel: glowing, silky, dark, serene · Suits: strings, viola, voice · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `decay` | how long the web remembers | 0.5..30 | 9 | fixed | How long old chords stay in the web before they vanish. Left: only the chord you hear now. Right: half a minute of harmony woven together. |
| `line` | line thickness | 0.3..3 | 1.2 | fixed | How thick the strings are (loud chords are always thicker than soft ones). Left: hairlines. Right: thick glowing cords. |
| `bow` | how the strings curve | -1..1 | 0.3 | higher notes → more | How each string between two notes bends. Left: bulging outward like petals. Middle: straight. Right: pulled in toward the centre like string art. |
| `shiver` | struck strings shiver | 0..1 | 0.5 | fixed | How much a chord's strings tremble when it is struck: one slow swell for sweet intervals, fine ripples for clashing ones. Left: still lines. Right: a strong shiver. |
| `fill` | filled shapes | 0..1 | 0.2 | louder → more | How much colour fills the shape of each chord. Left: only the strings. Right: glowing coloured shapes. |

### Needs work (the user rated them; use sparingly)

#### `matisse`: Matisse

Cut paper, after Matisse's late cut-outs: low notes lay big dark algae and slabs, middle notes coils and ribbons, high notes small bright stars, and chords rearrange the wall. New in v2: the music moves the paper. Every note slaps its piece down with a gust that pushes its neighbours aside, a sounding note lifts its piece off the wall on a deep shadow, soft notes cut pale paper and loud ones full colour, and a fortissimo shakes the whole wall.

Feel: vivid, playful, warm · Suits: clarinet, trumpet · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `size` | size of the pieces | 0.4..1.8 | 1 | fixed | How big the cut pieces are. Left: small scraps. Right: huge sheets that crowd the wall. |
| `pieces` | how many pieces on the wall | 6..40 | 18 | faster → more | How many pieces the wall holds before new notes swap old ones out. Left: a sparse few. Right: a crowded collage. |
| `move` | how much the notes stir the paper | 0..1 | 0.6 | louder → more | How much the music moves the paper. Left: pieces are laid flat and stay put. Right: every note gusts the paper around it, sounding notes lift their pieces, and chords rearrange the wall. |
| `curl` | straight or curly cuts | 0..1 | 0.65 | fixed | What the scissors cut. Left: straight-cut squares and patches, like The Snail. Right: curling algae, coils and stars, like Oceania and Jazz. |
| `ground` | white wall or coloured grounds | 0..1 | 0.6 | fixed | What the paper is pinned on. Left: always a plain white wall. Right: loud deep chords slide in bold coloured grounds with big panels. |

#### `harmonograph`: Harmonograph

Now one unbroken line that melts from figure to figure as the harmony changes, and every note pushes it: a loud note flings the pen back out and leaves a thick bright knot in the line, quiet passages let it slow down and curl in. Low chords swing broad and thick, high ones quick and fine; gold = consonant, violet = dissonant.

Feel: whirling, silky, glowing, serene · Suits: strings, clarinet · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `size` | size | 0.4..1.3 | 0.95 | fixed | How wide the pen swings. Left: a small figure in the middle. Right: fills the screen. |
| `speed` | how fast the pen draws | 0.3..5 | 1.6 | fixed | How quickly the pen traces the figure. Left: slow, you watch each loop being drawn. Right: the whole figure appears almost at once. |
| `damp` | how fast it winds inward | 0.02..0.6 | 0.2 | fixed | How quickly the line spirals in toward the centre between notes. Left: it keeps swinging wide, loops stacked on loops. Right: it curls into the middle in a few turns. |
| `push` | how hard notes push the pen | 0..1.5 | 0.8 | fixed | What each note does to the pen. Left: nothing, the line just winds down. Right: every note flings the pen back out and leaves a thick bright knot in the line. |
| `stay` | how long the lines stay | 0.3..8 | 4.5 | fixed | How long a drawn line glows before it fades. Left: only a comet tail behind the pen. Right: old figures linger and layer over each other. |

#### `hilma`: Hilma af Klint

Spiritual geometry after Hilma af Klint, in soft pastels on a deep ground: the bass swells the split disc, major chords open a ring of petals and minor chords curl them into spirals. New in v2: every note lands on the figure. The petals or spirals at that note’s place spring out, a seed flies to an orbit as high as the note, and each attack clicks the figure round with the melody.

Feel: serene, swelling, pale, glowing · Suits: voice, plucked · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `disc` | disc size from the bass | 0..1.6 | 1 | fixed | How strongly the low notes grow the disc in the middle. Left: a small, steady disc. Right: heavy bass fills the centre. |
| `life` | how long the seeds and rings stay | 1..10 | 4.5 | faster → less | How long each note’s seed and each chord’s ring stay on their orbits. Left: they flash and go. Right: they pile up into a field of stars. |
| `petals` | how many petals | 4..12 | 8 | fixed | How many petals open on major chords (minor chords curl half as many spirals). Left: a simple four-leaf cross. Right: a dense twelve-petal flower. |
| `twins` | twin forms on the melody | 0..1 | 0.6 | fixed | How many and how big the mirrored pairs are that melody notes leave on both sides. Left: none, just the centre figure. Right: large pairs in the wings. |
| `turn` | how far each note turns it | 0..1 | 0.4 | faster → more | How far each note clicks the figure round (forward when the melody climbs, back when it falls). Left: still, like a painting. Right: every note swings it. |

### Not judged yet

#### `timeslice`: Time slice

A slit-scan of the widgets under it: every strip of the picture comes from a different moment of the last seconds, more delayed the further it is from a now line that follows the melody. Made to sit on widgets that move: riley breaks into staircases of cut stripes (try the rings), strings and murmuration shear into ragged ribbons, ikeda’s barcodes step; it works on widgets that repaint their ground too. Each note cuts a sharp band of the present through the smear, loud chords stretch time, silence straightens it. Alone: a piano roll written outward from the now line.

Feel: flowing, liquid, stabbing, panic · Suits: violin, flute, strings · Role: top

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `far` | how far back | 0.25..3 | 1.5 | fixed | How far into the past the furthest strips reach. Left: a quarter second, barely a lean. Right: three seconds, long ribbons. |
| `mode` | which way it slices | 0..2 | 0 | fixed | How the picture is cut into moments. Left: columns (the now line follows the melody left to right), then rows (bottom to top). Right: rings from the centre (low notes near the middle). |
| `cut` | how wide a note’s fresh cut is | 0..1 | 0.35 | fixed | How wide the band of the present is that each note cuts through the smear. Left: a hairline. Right: a wide band of the present. |
| `live` | how much of the live picture shows through | 0..1 | 0.2 | fixed | How much of the present picture shows through the slit-scan. Left: only the slit-scan. Right: half live, half past. |
| `stretch` | how hard loud chords stretch time | 0..1 | 0.6 | fixed | How much loud chords stretch the delay. Left: they don’t, the delay stays put. Right: soft playing keeps it short and a loud chord throws it to the maximum. |

#### `fold`: Fold

A mirror for the whole picture, made to sit on other widgets: it folds whatever is already on the screen, so kusama becomes a twin colony, marbling a Rorschach marble, strings a woven butterfly, ikeda a mirrored data wall. The fold line turns with the bass round the circle of fifths, chords flip which half is mirrored, loud chords fold it twice for a beat, and quiet passages fade the mirror. Alone it is a stitched seam of light that flashes on every chord.

Feel: whirling, glowing, stabbing, swelling · Suits: contrabass, cello, piano · Role: top

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `folds` | how many folds | 1..6 | 1 | fixed | How many mirror lines cross the centre. Left: one mirror. Right: up to six, a kaleidoscope. |
| `turn` | what turns the fold | 0..1 | 1 | fixed | How far the mirror line turns with the harmony (the bass note, round the circle of fifths). Left: it stays upright. Right: it turns with every change of harmony. |
| `strength` | how strong the mirror image is | 0..1 | 1 | fixed | How strongly the mirrored half covers the other side (quiet passages fade it a little more). Left: a faint ghost. Right: as strong as the original. |
| `flip` | chords flip the side | 0..1 | 0.5 | fixed | How often a full chord swaps which half is the original and which the mirror. Left: never. Right: every chord swaps the source half. |
| `seam` | seam | 0..1 | 0.6 | fixed | The line of light along the fold. Left: no line, only the mirror. Right: a bright stitched seam that flashes on every chord. |

#### `stella`: Stella

A rhythm layer made to sit on other widgets: it paints no ground, only thin frames, after Frank Stella’s stripe paintings. Every attack adds one frame a step further in from the edge and older ones fade, so fast playing piles up concentric stripes and slow playing leaves one or two lone frames; loud attacks give square frames, soft ones rounded. The centre stays open, and it inverts whatever is under it (dark on paper, light on black, cyan over red). Try it on score with squares, horizon with murmuration, current with squares, or Miró with Rorschach.

Feel: marching, brittle, icy, stabbing · Suits: harpsichord, timpani, piano · Role: accent

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `life` | how long they stay | 0.15..5 | 1.4 | fixed | How long a frame stays before it fades. Left: one blink. Right: lingering stripes that pile up. |
| `thick` | how thick | 1..14 | 3.5 | louder → more | How wide each stripe is (loud attacks a little wider). Left: hairlines. Right: heavy bands. |
| `reach` | how far in | 0..1 | 0.45 | fixed | How deep the stripes pile up before starting again at the edge. Left: they hug the edge. Right: they reach halfway to the centre. |
| `which` | which notes count | 0..1 | 0.5 | fixed | Which attacks add a frame. Left: only the bass, so it marks the left hand’s pulse. Middle: every attack. Right: only the top line, the melody. |
| `beat` | on the beat | 0..1 | 0 | fixed | When frames come. Left: on every attack. Right: snapped to the beat it hears, so only the metre shows. |

#### `martin`: Agnes Martin

After Agnes Martin: pale bands of washed colour under a fine pencil grid, the keyboard from bass (bottom) to treble. A soft note faintly deepens its band; a held note tints its own thin stripe in the colour of the harmony. Loud music is nearly ignored: it is for the chorale and the oboe cadenza. Paints its own canvas.

Feel: still, pale, serene, airy · Suits: oboe, voice · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `paper` | night or day paper | 0..1 | 1 | fixed | The ground the bands sit on. Left: a very dark canvas with chalk lines. Right: warm off-white paper with pencil lines. |
| `wash` | colour of the bands | 0..1 | 0.55 | fixed | How much colour the bands hold at rest. Left: bare paper, only the pencil grid. Right: clear rose and blue bands. |
| `mark` | how much a note marks | 0..1 | 0.6 | louder → less | How strongly a note deepens its band and a held note tints its stripe. Left: the music barely touches the picture. Right: every soft note leaves a clear wash. Set to follow loudness downwards, so loud music marks it even less. |
| `stay` | how long a mark stays | 1..20 | 10 | faster → less | How long a deepened band or tinted stripe takes to fade back. Left: a breath. Right: it lingers for many seconds. Set to fade faster when the music gets busy. |
| `grid` | how fine the grid | 0..1 | 0.6 | fixed | The pencil grid over the bands. Left: only the ruled lines between the bands. Right: a fine, dense mesh of small rectangles. |

#### `suprematism`: Suprematism

Malevich-style flat planes on a dark field: bass slams heavy black bars in low, high notes add thin slivers high, chords add red, ochre and cream blocks, and big chords flip planes on their side. Loud, dense passages tilt the whole composition and pile the planes into each other; quiet ones let them drift apart and level out.

Feel: heavy, vivid, triumphant, stabbing · Suits: trumpet, timpani, trombone · Role: ground

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `count` | how many planes | 4..60 | 22 | fixed | How many planes can be on the field at once; the oldest leave first. Left: a sparse few. Right: a crowded field. |
| `life` | how long a plane stays | 1..20 | 9 | faster → less | How long a plane stays before it shrinks away. Left: a second or two. Right: it holds for many bars. |
| `push` | how hard loud music pushes | 0..1.5 | 0.6 | fixed | How much loud, full passages tilt the whole composition and crowd the planes together. Left: it stays calm and level. Right: a steep tilt and a pile-up. |
| `temp` | cold / hot colours | 0..1 | 0.5 | fixed | The four inks. Left: cold, blue and steel greys. Middle: classic red, ochre and cream. Right: hot orange and gold. |
| `size` | size | 0.4..1.6 | 0.85 | more bass → more | How big the planes are. Left: small, with lots of empty field. Right: big slabs that fill the frame. |

#### `contours`: Contours

Every note raises a soft hill (warm) or, when played softer than the music around it, sinks a pit (cool) on a mirrored map drawn as topographic contour lines. Across: the note's place on the circle of fifths (one key = one region); up: its octave, so low notes sit low. Loud chords burst into many tight rings; calm passages drift and send rings outward.

Feel: swelling, flowing, warm, dark · Suits: horn, strings · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `lines` | how many lines | 3..24 | 7 | louder → more | How many contour lines a hill gets. Left: a few calm rings. Right: dense, tightly packed rings. |
| `size` | how wide the hills | 0.4..1.8 | 0.9 | more bass → more | How wide each note's hill spreads. Left: small, separate peaks. Right: broad hills that merge into ridges. |
| `decay` | how long hills stay | 0.5..10 | 2.4 | fixed | How long a hill stays before it sinks back. Left: a short pulse. Right: the map remembers for many seconds. |
| `flow` | drift when calm | 0..2 | 0.9 | louder → less | How much the map drifts and sends rings outward. Left: still. Right: hills wander and rings stream out of the peaks. |
| `tint` | colour | 0..1 | 0.72 | fixed | The colour of the hills. Left: icy blue. Middle: bone. Right: blood red and ember. |

#### `tunnel`: Tunnel

You fall through a zoom-feedback tunnel: every note drops an outline at the far mouth (low notes big and outside, high ones nested inside) and the picture streams toward you. Busier playing speeds the fall on a steep curve, the melody steers the vanishing point, and big chords punch a surge forward.

Feel: whirling, flowing, glowing, burning, panic · Suits: tutti, strings · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `speed` | how fast you fall | 0..2 | 0.8 | fixed | How fast the tunnel streams toward you (busier playing always speeds it up). Left: a slow glide. Right: a rush. |
| `shape` | which outlines | 0..4 | 4 | fixed | The shape of the outlines. Left to right: rings, squares, triangles, slits, or mixed by pitch (low squares, middle rings, high triangles). |
| `trail` | how long the walls linger | 0.05..1.5 | 0.35 | fuller chords → less | How long the streaks of earlier outlines stay on the walls. Left: crisp, single outlines. Right: long glowing walls. |
| `spin` | turning | -1..1 | 0.1 | more bass → more | How the tunnel turns as you fall. Left: turning one way. Middle: straight. Right: turning the other way. |
| `palette` | colours | 0..3 | 0 | fixed | The colours, from low notes to high ones. Left to right: ember (blood red to gold), ice (deep blue to white), bruise (violet to teal), bone (grey to warm white). |

#### `scribble`: Scribble

Nervous pens scrawl continuous loops, one pen per register: notes jolt and press them, loops coil tight in dense, dissonant passages and open into long arcs when it is soft. Chords make a pen scratch back over its own line (often in red), the biggest chords strike a long stroke, and old lines fade like graphite.

Feel: skittish, grainy, brittle, flowing · Suits: violin, viola · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `speed` | how fast the pens run | 0.2..3 | 1 | faster → more | How fast the pens travel. Left: a slow, short crawl. Right: long lines racing across the sheet. |
| `loops` | how loopy | 0..1 | 0.5 | faster → more | The shape of the scrawl. Left: long open arcs. Right: tight coils, loop over loop. |
| `pens` | how many pens | 1..6 | 3 | fixed | How many pens draw at once, each for its own part of the keyboard. Left: one lone pen. Right: six. |
| `stay` | how long lines stay | 1..20 | 7 | fixed | How long a line stays before it fades like graphite. Left: gone in a second. Right: the sheet fills up. |
| `weight` | how heavy the line | 0.3..2.5 | 1.2 | fixed | How thick the pen line is. Left: a hairline. Right: heavy, pressed graphite. |

#### `pointillism`: Pointillism

Every note dabs a burst of coloured dots (colour = how far the note is from the home key, burst size = how hard it is played); the dots settle and bleed into soft colour fields, so the harmony paints regions. Chords splash a halo of their opposite colour, and big ones make the whole canvas flinch.

Feel: grainy, vivid, liquid, playful · Suits: plucked, flute · Role: base

| knob | label | range | default | driven by | what it does |
|---|---|---|---|---|---|
| `dot` | dot size | 1.5..10 | 4.5 | faster → less | How big each dot is. Left: fine stipple. Right: fat dabs of paint. |
| `burst` | dots per note | 0.2..3 | 1 | louder → more | How many dots one note throws. Left: a few sparse dabs. Right: a dense spray. |
| `stay` | how long the painting stays | 1..25 | 8 | fixed | How long the dots and colour fields stay before they fade. Left: a few seconds. Right: the canvas keeps a long memory. |
| `bleed` | dots melt into colour | 0..1 | 0.55 | fixed | How much old dots melt into soft fields of colour. Left: crisp dots on black. Right: dots dissolve into a blurred colour wash. |
| `layout` | where the colours go | 0..2 | 0 | fixed | How the notes are laid out. Left: a field (across: how far from the home key; up: high or low). Middle: a keyboard, low to high. Right: a wheel around the home key. In between blends the two. |

<!-- widgets:end -->
