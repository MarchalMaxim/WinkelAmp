# Nature and texture: the brief for the brainstormers

Written 2026-11-05 by the coordinating session. This is a thinking and writing task. **Nobody builds a widget.** Paths are
relative to the repo root. (Since this was written the snap work has been merged into this branch, so the `git show` paths
below can be read as plain files. `SYNTHESIS.md` corrects two canvas rules below; follow it when building.)

## The user's words, verbatim

> brainstorm more widgets (take inspiration from nature). Texture is really important here. Sharpness. Fuzzy. Rigid. elastic.

## What WinkelAmp is

A synesthesia studio. A recording is transcribed into notes; hand-made canvas widgets (`lab/tools/<id>.js`, about 60) sit as
clips on a timeline under the song, and each clip listens to all notes, a part, or a set of notes the user **picked by
hand**. The user is a musician who judges by eye and ear. The music is piano: Rachmaninoff, Kreisler, Chopin. They want
widgets that answer individual picked notes sharply, so that the eye can count the notes.

## The tension you must resolve in every idea

Texture from nature, **but not a picture of nature.** From `lab/ratings.md`:

> shatter: DROP ("too physical, we should aim for abstract"). chord lightning: DROP ("too physical").
> Principle from this round: abstract, not physical/literal imagery (glass, lightning are out).

The way out is already in the collection. `lab/tools/honey.js` opens: "Not a picture of honey: honey as a way of moving."
The user asked for honey, and got flat masses and threads that move the way honey moves. Do the same. Take from nature its
**behaviour and its surface**: how a thing yields, how its edge looks, how it breaks, how it recovers, what it is like to
touch. A viewer should say "that feels like fur", not "that is a drawing of a cat". A frost widget that shows a window pane
with frost on it has failed; a mark that arrives all at once as a hard needle-edged lattice and is then simply less there has
not. Scale, abstraction and flatness are your friends. A colour field the size of the screen may have the nap of velvet.

## The texture words, as the user means them (our reading, sharpen it)

- **Sharp**: edges that cut. Points, needles, hairline ends, no anti-mushy softness. It should feel like it could hurt.
- **Fuzzy**: nap, down, a surface made of a thousand small things. Not blurry. Fuzz has structure when you look close.
- **Rigid**: it does not bend. It takes a blow and either stays or breaks. No wobble, no easing, a stop with no give.
- **Elastic**: it gives, and returns, past where it started and back. Springs, sinew, surface tension, a plucked thing.

Pairs are where it gets interesting: a rigid thing with a sharp edge, a fuzzy thing with an elastic body, a sharp point on an
elastic stem. **Say which word or pair each idea serves, and make that texture the main thing the eye gets.** If you could
swap the texture for another one and the idea would still work, it isn't about texture.

## The contract

```js
TOOLS.push({ id, name, blurb, tag: 'new', params, reset(x), onChord(ch, x), frame(x) })
```

- One shared 1280×720 2D canvas, `x.g`, `x.W`, `x.H`. Each step the host fades it: `rgba(0,0,0,0.12)` plus a colour-burn.
- `onChord(ch, x)` fires on the very step of the attack, then `frame(x)`. `ch = { t, notes: [{ m, v, d, amount? }], vel, lo,
  hi }`: notes within 40 ms are one attack. `m` midi, `v` velocity 0..127, `d` written length (unreliable under the pedal),
  `amount` the picked note's intensity. Note ends are not events.
- `CHORDS` is the array of all chords this clip will hear, so a widget can plan ahead or draw statelessly from song time.
  `x.t` song time, `x.dt` the step, `x.p('key')` a knob, `x.feat` the slow features (level, rate, pitch, bass, density),
  `x.picked` true when listening to picked notes, `x.rnd` the seeded random. **Only `x.rnd`, no `Math.random`, no wall
  clock.** Renders, seeks and live play must agree.
- WebGL2 is allowed on its own canvas (fireworks, gliss, tree do this), but contexts are limited per browser and GPU output
  is not bit-stable. It has to earn its place. Default to 2D.
- Knobs: **at most 5, plus `presence`.** Each has a plain-words label, a one-sentence hint saying what Left and Right do, and a
  small picture. `presence` ("how present") means **how much stuff is made**: it moves the knobs that declare `less:`, and
  these must follow counts, spawns, branches or how long things stay, never colour, mode or plain brightness.
- Budget: this runs live at 60 Hz beside other widgets. Thousands of canvas strokes per frame is too many. Prefer pre-rendered
  sprites, batched paths (one `beginPath` with many segments), or small offscreen canvases. Give a rough draw count.

## The snap principles (from last night, `docs/mockups/snap/DESIGN.md`)

That work is on another branch and unmerged. **Read it with
`git show claude/viz-note-snap-animation-fb260c:docs/mockups/snap/DESIGN.md`** (sections 1 to 3). Also on that branch, read
the same way: `lab/tools/hammer.js`, `lab/tools/handover.js`, `lab/tools/squares-snap.js`. Do not `cd` into or open any other
worktree, and do not assume the SNAP helper is on main: design against the principles.

| # | Rule |
|---|---|
| P1 | Peak in the attack's own step. No freeze, stagger, gate or fade-in before the peak. |
| P2 | The peak holds for 2 steps (33 ms). |
| P3 | Brightness only falls after the peak. **Size and position may overshoot and ring.** |
| P4 | A flash over a dim body: the flash carries the attack, the body carries the note. Flash half-life 0.06 s, body at most 40 % of peak. |
| P5 | Draw through the alpha correction (below), never a raw alpha. |
| P6 | Every picked note lands. Velocity shapes how hard and how long, never whether it is seen. |
| P7 | Every repeat is countable. The same pitch again restarts at full. Never take a max, never dim. |
| P8 | Age comes from the chord: `t = x.t − ch.t`. Never accumulate it. |
| P9 | Crisp first, soft later. Blur and shadow start at 0. |
| P10 | Motion starts at full speed and slows: a hammer, not a bow. `d·(1 − e^(−t/τ))`, τ 0.06–0.1 s. |
| P11 | A note's written length counts only at the short end. |
| P12 | No white flash over more than 6 % of the frame. No full-frame flashes. |

**The canvas.** It keeps 0.88 of each pixel per step, so nothing halves faster than about 0.09 s. A mark redrawn in place at
alpha `a` settles at `a / (0.12 + 0.88a)`, so `a = 0.1` already shows at 48 %: that is why raw alphas look like "hold, then
cliff", and the cure is `alpha(T, Tprev) = (T − 0.88·Tprev) / (1 − 0.88·Tprev)`, clamped. Tails much fainter than about 0.2 are
eaten by 8-bit rounding. Fine hairs at low alpha vanish.

## The verdicts, so you know the taste

- **Liked last night:** snap squares (big dark-red squares with a crack on the attack and a quiet ember) and handover (one
  dark-red slab per picked note that shrinks away exactly as the next lands: always "this note, then that one").
- **Rejected last night:** blade (a wedge sound-roll seen from the playhead; dim, over-explained).
- **Loved:** murmuration (the favourite), marbling, skittish shapes (flee), the current, woven threads, rorschach, kandinsky,
  casket, miró, kusama, ikeda, halftone, boogie woogie, glitch blocks, calligraphy, dread squares.
- **Dropped:** shatter and lightning (too physical), ripples, moire, whitney, albers, hilma. `lab/tools/dropped/`.
  Don't bring these back under another name. No expanding rings from a point, no moiré, no glass breaking, no bolts.
- **"Abominations":** Codex's generic recipe widgets. A recipe is a template with a theme painted on: *particles + a colour +
  a physics word*. If your idea is "N particles that do X", it is probably a recipe. Hand-made means one specific, surprising
  decision that could only have come from looking at the real thing and listening to real music.
- **No fake attacks** (the user, about a dissolve on Ivory): "the dissolving process implies some sort of attack, but it's
  really just the result of the attacc happening a couple seconds earlier." A visible event happens only on a musical attack.
  What happens between notes is a quiet, quick change of state, with no travelling front and no staged sequence.
- **"Too suggestive":** the user's word for a swelling, trembling bar. Check any tall shape that swells, trembles or drips.
- **Abstract over literal, music over mechanism.** Mood and the feel of the music come before explaining how it works.

## Texture traps: read these twice

1. **Fuzzy against P9 (crisp first).** Fuzz must not be blur from frame 0. Build it from many sharp fibres or grains, or let
   softness arrive after the flash.
2. **Elastic against P3 and no fake attacks.** Size and position may overshoot and ring; brightness may not rise again. A
   rebound must not read as a second note: keep it fast (under about 0.25 s) and dying, or small next to the attack.
3. **Rigid against travelling fronts.** A crack that spreads after the attack is a staged sequence, and it reads as a fake
   attack. A fracture must appear whole within the two-step hold, then only fade or set.
4. **Fine and sharp against the fade.** One-pixel hairs at low alpha disappear; many of them redrawn each step are costly.
   Say how you get a fine edge to read (full-alpha on the strike, sprites, redrawing only the few still alive).
5. **Growth against no fake attacks.** Anything that keeps growing between notes (ice, moss, a crack) is an event with no note.
   Growth happens on the note, all at once, or so slowly and quietly it is a change of state.
6. **Slow nature against snap.** Most of nature is slow. The idea has to answer the attack in the attack's own step anyway and
   die fast; what is slow can only be the ground it stands on.

## Already taken: don't duplicate

vine (creeping stems that fork and wither), tree (backlit tree growing a step per attack), honey (sagging threads and viscous
masses: covers sag and sap), lazy (slumped stains), marbling (ink bands pushed outward), rorschach (soaking mirrored blots),
the current (threads in water), murmuration (a flock), gust (wedges shoving air), fireworks and gliss (real fluid smoke), duet
(two liquids), nebula (grains streaming between poles), horizon (a seascape), flee (shapes that bolt), hammer (a bar of light
struck, a thin line ringing), squares and squares-snap, handover, ivory (white keys), halftone (dots that swell in a wave).
Find the place next to them that is empty. Name the closest neighbour in each idea and say how yours differs.

## What to write

Your essay goes to `docs/mockups/nature/essays/<n>-<corner>.md`. Open it with two or three sentences on what you actually
noticed about your corner of nature (the real thing, looked at closely), then **6 to 8 ideas**, each with:

- **Name and proposed id.**
- (a) **The natural thing**, and the one observation about it the idea rests on.
- (b) **Texture**: sharp, fuzzy, rigid, elastic, or a pair.
- (c) **One picked note**: exactly what it does on the attack step (pixels: what shape, what size, where, what colour), and
  over the following second. Where does pitch go? Where does velocity go?
- (d) **A chord, and a repeat** of the same pitch. A fast run too, if that is where it would break.
- (e) **3 to 5 knobs**, in plain words, each with a Left/Right sentence and its range and default. Say which carries `less:`.
- (f) **Why it can't be mistaken for a recipe**: the specific decision.
- (g) **State and drawing**: what `onChord` stores on a mark, what `frame` draws, stateless from `CHORDS` where possible, the
  rough draw count per frame, and any sprite or offscreen canvas it needs.
- (h) **2D or WebGL**, and why.
- (i) **Closest existing widget**, and how this one differs.
- (j) **Which trap above is its danger**, and how it stays out.

Be concrete enough that a builder who has never seen this conversation could start. Numbers beat adjectives. Write in plain,
direct prose. Prefer six ideas that each have a real reason to exist over eight where two are padding, and end the essay with
one line naming your own best idea and why.

Rules of the road: write only your own essay file. No commits, no edits in `lab/`, no servers, no ports. Don't try to ask
anyone a question; decide and say what you decided. Don't read other brainstormers' essays.
