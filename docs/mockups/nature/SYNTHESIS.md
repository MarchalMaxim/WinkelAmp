# Nature and texture: the synthesis

Written 2026-11-05 by the coordinating session, from eight brainstorm essays (60 ideas) and three independent judges. Nothing is
built. The user asked:

> brainstorm more widgets (take inspiration from nature). Texture is really important here. Sharpness. Fuzzy. Rigid. elastic.

**Where everything is.** `BRIEF.md` is what the brainstormers were told. `essays/` holds the eight essays. `judges/` holds the three
verdicts as JSON, and `judges/SCORES.md` is every idea's score in one table. This file overrides the essays wherever they disagree.

## The answer in one paragraph

The way out of "nature, but not a picture of nature" turned out to be the same in every strong idea: **take one thing from the real
object that nobody would draw, and let the texture be geometry at full brightness.** A thorn's sides are concave. A plucked thread
has no curve in it. Velvet's mark is removed by stroking it back. A tendon is fuzzy until loaded and then a razor. None of these needs
a picture of the thing, and the viewer still gets the word. The ideas that failed were beautiful physics that has to be explained
(which is how Blade died), or textures that exist only in a dim layer the canvas destroys.

## The ranked list

Mean is out of 50, from the three judges. M, E and B are each one's own rank: the musician, the eye and taste, the builder.

| # | widget | id | texture | mean | M / E / B | what it is |
|---|---|---|---|---|---|---|
| 1 | Prickle | `prickle` | sharp, rigid | 44.0 | 6 / 1 / 4 | One huge flat thorn per note, concave sides ending in a hairline |
| 2 | Nap | `nap` | fuzzy, sharp edge | 40.3 | 5 / 3 / 8 | Bands of velvet pile stroked into the black; the same note strokes them out |
| 3 | Crimp | `crimp` | fuzzy to sharp | 41.7 | 1 / – / 3 | A ribbon of razors on the attack, wool by 0.4 s; a repeat yanks it straight |
| 4 | Interlock | `interlock` | sharp, rigid | 42.7 | 2 / 8 / 6 | Needle pairs that pass each other along a seam; a scale zips it, a repeat bites deeper |
| 5 | Plucked corner | `pluck` | elastic, sharp | 41.3 | 7 / – / 2 | A strand with no curve in it: two straight lines and a running corner |
| 6 | Film | `film` | elastic, sharp | 38.3 | 9 / 2 / – | One ink-blue sail whose corners are the last three notes, its edges scooped taut |
| 7 | Tack | `tack` | fuzzy, elastic | 39.7 | – / 5 / 7 | A dark-red slab torn open on a comb of fibres that snap out of order |
| 8 | Mica | `mica` | rigid, sharp | 41.7 | 11 / – / 5 | Nothing moves: each pitch owns a fixed scatter of shards, all at one angle |
| 9 | Fist of spines | `urchin` | sharp, elastic | 40.7 | 8 / 4 / – | A field of needles turns in one step toward a spot, and stops short of it |
| 10 | Cut | `cut` | rigid turning fuzzy | 40.3 | – / 7 / 11 | Knife-edged slabs that lose their edge one step per note, never with time |

**How I got from the scores to this order.** The mean alone would put Interlock second and leave fuzz far down. I moved Nap and Crimp up
because the user's request is about texture and fuzzy is the word the set delivers worst: as the eye judge puts it, most claimed fuzz
is really a flash of hairs. Nap is the one fuzz all three judges ranked. I placed Film above Tack and Mica, against its mean, because the eye
judge ranked it second and its low builder score comes from two faults that are fixed below. Quill is left out of the ten despite being
the builder's first and the musician's third: see "Next in line".

**Every word has at least three widgets.** Sharp: Prickle, Interlock, Mica, Urchin, Pluck, Film. Fuzzy: Nap, Crimp, Tack, Cut. Rigid:
Prickle, Interlock, Mica, Cut. Elastic: Pluck, Film, Tack, Urchin, and Crimp in its slackening.

**Same-idea clusters.** Several essays converged, and the versions kept here are named so that nobody builds the wrong one. Two Micas:
essay 3's angle rule, taken by two of three judges; the eye judge preferred essay 8's contour ribbon, so its picture may be worth a
later try. Two Cleaves: essay 3. Two Glints: neither made the list; essay 1's is the better one and essay 3's Mica supersedes it. Tack
beats Suture. Film beats Sinew. Crimp beats Sublimate on musicality, though Sublimate's idea of decay as a loss of sharpness lives on in Cut.

## Read this before building any of them

Two canvas rules the essays leaned on turn out to be wrong for dim or moving marks. I checked them in real Chrome, on the default canvas and the software
canvas used for bit-exact proofs, with the host's own fade and burn (`src/widgets/runtime.ts:238`), 90 steps at 60 Hz.

**1. Dim bodies drawn through `settles` or `alpha` are not on the screen.** Those formulas account for the 0.12 fade and not for the
colour-burn, which takes about 3 levels off every channel each step. So a low target loses most of its value, and more on the software
canvas than the default one. (The SNAP presets' timings were tuned through the burn on a bright mark, so they stand. What they don't cover is a
dim colour held steady: dark channels lose the largest share, and oxblood's green and blue fall to 1, which shifts its hue too.)

| drawn as | ideal | default canvas | software canvas |
|---|---|---|---|
| oxblood (124,18,20), `settles(0.25)` | 31,5,5 | 13,1,1 | 5,1,1 |
| oxblood (124,18,20), `settles(0.40)` | 50,7,8 | 29,1,1 | 25,1,1 |
| ember (160,60,40), `settles(0.40)` | 64,24,16 | 46,5,3 | 42,4,3 |
| bone (236,226,208), `settles(0.20)` | 47,45,42 | 25,25,21 | 9,9,9 |
| **`lighten`, alpha 1, colour (70,14,16)** | **70,14,16** | **70,14,16** | **70,14,16** |

**The cure: draw every dim thing with `globalCompositeOperation = 'lighten'` at alpha 1, in a colour already at its target.** It held
exactly on both canvases, on every step, including the first, so a mark that jumps to fresh pixels lands whole instead of swelling in
over 15 steps. A colour stepped down each step follows its curve exactly (half-life 0.3 s from 70, read every 0.2 s: 44, 28, 18, 11, 7, each as asked). It
cannot erase another clip: over a grey of 100 it left 100. It needs no correction formula and it looks the same in live play and in
renders. Of the eight essays, only essay 5 found this. The one trade-off: a `lighten` mark does not cover what lies under it in a layered scene; it combines
per channel. Restore the composite mode afterwards.

My test was a solid fill. A pixel only partly covered settles lower, at about `c/(0.12 + 0.88c)` of the tone for coverage `c`, so roughly 0.5 at a tenth. That
matters for faint fibres. So **bake tiles and sprites opaque on black**, not on transparent: `lighten` with black changes nothing, and every fibre then holds
exactly. Crimp's wool, Nap's tile and Cut's stages all depend on this.

```js
// In every widget below, outside the SNAP markers (they must stay byte-identical to lab/snap/envelope.js).
const tone = (g, rgb, k = 1) => {                       // k is the envelope: 1 at the peak, falling to 0
  g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
  g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
};
```

So choose the target colour itself. A body "at 40 %" means a real colour with a live channel of at least 60 or so, not 40 % of a dark
colour. Use the SNAP block (`lab/snap/envelope.js`, pasted verbatim between its markers; `tests/snap-envelope.test.ts` checks the copies)
for the shape of the curve, `SNAP.env(t, n, o)`, and for `SNAP.hot` and `SNAP.size`. Pass `picks: x.picked`.

**2. Moved marks skip the correction.** `alpha(T, Tprev)` assumes the mark's own fading image lies underneath. Just after the hold it
returns 0, so anything that moved would go unseen. A mark that moved more than its width since the last step, or was lit for the first
time, is drawn at `E(t)` directly. With rule 1 this happens by itself.

**Three more things all ten share.**

- **Ghosts.** An unredrawn bone mark measures 118 after 5 steps, 54 after 10, 17 after 15 and 0 after 20. So a struck mark leaves a ghost for
  about a quarter of a second, and detail staged under it in the first 0.2 s isn't seen. Equally, nothing bright lingers past a third of a
  second without being redrawn, so an idea can rely on that.
- **Real notes.** Measured over the piano recordings: the median gap between attacks is 0.09 to 0.19 s, the peak is 12 to 17 attacks a
  second, 17 to 41 % of notes repeat their pitch within half a second (Rach 2: 41 %; Liebesleid: 28 %), and velocities live between about
  40 and 100 (p10 to p90), so `(v/127)^1.5` has a median of only 0.28 to 0.46. Ranges designed for 0 to 127 go flat. **Normalise velocity by
  the clip's own p10 and p90**, computed once from `CHORDS`: `u = clamp((v − p10)/(p90 − p10), 0, 1)`, with a guard for a set of one note.
  The repeat is not an edge case, it is a third of the music.
- **Palette.** Almost every essay reaches for bone over oxblood, inherited from last night, so the eye gets one colour. Each pick below has its
  own default, and these should be kept.

Also from the brief, still binding: stateless from `CHORDS` where possible, age from `x.t − ch.t`, `x.rnd` or a seeded generator only, at most
5 knobs plus `presence`, and a mark's random detail seeded by pitch where the same pitch must look the same after a seek.

**Registering a widget.** A new file at `lab/tools/<id>.js` and an entry at the end of `TOOL_IDS` in `lab/index.html`. `tag: 'new'`. Judge on the
60 Hz video, never in the live lab (the lab fades per frame, and at 144 Hz trails are half as long).

## The ten

Each entry has the paragraph, then only what a builder needs on top of the essay. **The essay section named is the spec, with all its numbers:
attack, chord, repeat, knobs, state.** Where this file differs, this file wins.

### 1. Prickle (`prickle`): sharp, rigid

A rose thorn's sides are not straight. They flow in from a broad base, narrow suddenly at a waist, and end thinner than seems possible, and that
concave line is what makes the eye flinch. So each note is one flat thorn the size of the screen, there whole on the attack's own step, saturated
red with its last stretch in bone, then a dim red that holds still. It withdraws straight back along its axis as the next note lands, the way
Handover's slabs do, which the user liked, and thorns alternate sides. In a run the base narrows with the time to the next note, so a semiquaver is
a needle and a long note a slab, and you can still count at twelve a second. All three judges put it in their top six, and the eye judge called it a
Suprematist picture on every note: it is the set's answer to "it should feel like it could hurt".

- **Spec:** essay 6, §8 Prickle. Measured true: a 900 px thorn is 92 px wide at 61 %, 15.8 at 87 %, 1.6 over the last 30 px.
- **Changes:** hold the body with `tone` at about (92,14,16), not 40 % of oxblood, or it goes as dim as Blade. Bend the hook with the same quadratic so
  the tip stays a hairline. In a chord, aim the tips at one point but set each base at its own pitch height, so the voicing still reads. Thorns come
  only from the sides, never up from the bottom ("too suggestive").
- **Start from:** `lab/tools/handover.js` (the withdrawal and `goneBy`). **Palette:** red and bone. **Touch:** `piano` for the strike, the body is a tone.
- **Cost:** 1 to 8 fills. **Judge it on:** a slow picked melody first, then Winter Wind.

### 2. Nap (`nap`): fuzzy, with a sharp edge

Black velvet stroked with a finger: the mark is the same cloth lying the other way, it has a sharp edge, it stays until touched again, and stroking it
back removes it. The canvas's own black is the velvet and is never drawn. A note strokes one tilted band of pile into it, with toothed edges of cut
fibre and a burst of bright hairs on its attack step, and a chord strokes several, whose crossings come out black. **A repeat turns its band off**, so
you count on, off, on, and a softer repeat leaves two lit slivers along the old band's edges, so you see the touch. The picture changes only on notes.
It's the fuzz that all three judges believed, and at rest it looks like Kline in velvet.

- **Spec:** essay 2, §1 Nap.
- **Changes:** the field at `settles(0.32)` would lose nearly all its fibres (oxblood fibres measure about 9). Bake the 512² pile tile in its real dim
  tones and fill it with `lighten` at alpha 1. The silence fade needs 3 or 4 tone steps of that tile, since low alpha fails the same way.
- **Open, for the user's eye:** the second touch erases. The flash lands at full, so a repeat is still counted (P7), but it can read as a note removing
  itself. If it does, a repeat keeps the band lit and only re-strikes, with a switch for this replacing the `cloth` knob.
- **Start from:** nothing close; `lab/tools/kline.js` for scale. **Palette:** oxblood to pale rose tips; moss and slate on `cloth`.
- **Cost:** 1 to 7 pattern fills (7 evenodd bands measured 2.2 ms). **Judge it on:** Liebesleid picks, for the on-off.

### 3. Crimp (`crimp`): fuzzy to sharp

A tendon's fibres are crimped in a fine irregular wave until load takes the wave out, and then they are straight and suddenly stiff. So the note *is* a
change of texture. On the attack a ribbon of hairlines at the note's height is dead straight, opaque, each end cut to a sharp stair; then it goes slack,
wave growing line by line out of step, its tips drawing back 9 % because a straight fibre is longer, and by 0.4 s it is a matte woolly strip. A repeat
yanks that same ribbon straight from wherever it has got to, in place, and the essay rightly calls that the most satisfying moment in the widget. The
softening is geometry, not blur, which is the neatest answer anyone found to "crisp first, soft later". The musician ranked it first.

- **Spec:** essay 7, §1 Crimp.
- **Changes:** this is the widget the canvas rule hits hardest: 1.25 px ember sprites at T 0.25 measure 5 of 255, and the wool would vanish. Bake the
  wool in brick about (200,60,40) and step 3 tones of sprite with `lighten`: 6 amplitudes × 3 seeds × 3 tones, about 18 MB. The eye judge's complaint was
  "a strong event in a weak picture", so make the standing strip heavier: line width 1.5 px, spacing 4 px, 15 fibres by default. Keep amplitude to about
  spacing × 1.7 or the lines merge. Give velocity real gain (reach runs only 510 to 660 px across real velocities).
- **Kill test:** neighbouring wavy lines beating into a pattern. Moiré was dropped, and if it appears here the idea is dead, so check per-line phase first.
- **Start from:** `lab/tools/hammer.js`. **Palette:** bone strike, brick wool. **Cost:** about 20 draws. Sprites built in `reset`.

### 4. Interlock (`interlock`): sharp, rigid

The rim of a flytrap, and a trap-jaw ant: the two rows of spikes don't meet, they pass between each other, and the closed thing is a mesh, not a line. The
whole keyboard lies along a horizontal seam. A note fires one pair of full-height needles, one from above and one from below, half a tooth apart, fully
in on the attack step with no travel and no ring, and the black zigzag between them is the picture. A scale zips the seam shut, note by note, and the
travel is the music's own. **A repeat is a ratchet**: the same needle goes 24 px deeper and, being a wedge, wider at the seam, so Rachmaninoff's repeated
chords become visibly tighter blows. With Nap, it is the best of the set at giving a repeat a meaning of its own.

- **Spec:** essay 7, §2 Interlock.
- **Changes:** hold the needles with `tone` at about (90,16,18), so that the mesh really stays. **Drop the slow pull-out.** The essay had needles leave over
  1.4 s, which was invisible when the body was invisible. On a visible tone it is a motion with no note, a fake attack. Instead a needle stands dead still,
  and its tone falls to nothing within `stays`. After the ratchet's 200 px cap, only the flash counts.
- **Danger:** a picture of teeth. Straight sides, no lobes, no curve, full height.
- **Start from:** `lab/tools/ivory.js` (key positions, per-pitch scan). **Palette:** bone above, hot red below. **Cost:** under 10 fills, 60 triangles a path.

### 5. Plucked corner (`pluck`): elastic, sharp

Every drawing of a plucked string uses a sine, and it is wrong. A plucked thread at release is two dead-straight lines and one hard corner, and the corner
splits in two and runs, so the thread goes through a triangle, a flat-topped trapezoid, a flat line, and the same upside down. Each pitch owns a strand
between fixed anchors, long in the bass and short in the treble, and crossing its neighbours. On the attack it is already fully pulled aside, and it flaps
out within a quarter of a second. The canvas does the long exposure: earlier positions, still fading, stack into a fan of straight hairlines. Nothing in
this widget is curved, and that is its whole character. A repeat restarts at full and moves the pluck point, so it makes a visibly new shape on the same line.

- **Spec:** essay 6, §1 Plucked corner, and that essay's opening rules.
- **Changes:** draw the moving strand at `E(t)` directly, never through `alpha`, since the fan is the texture. Strike at 4 px, not 3: the eye judge finds the
  frame sparse. Give the resting line a `tone` or drop the `ring` knob, as it isn't seen otherwise. Period floor 0.1 s stays.
- **Fallback:** if the running corner reads as a travelling front on video, use the standing form in the essay, the corner fixed, flipping V to inverted V.
- **Start from:** `lab/tools/hammer.js`. **Palette:** bone to red. **Cost:** about 120 segments in at most 16 strokes.

### 6. Film (`film`): elastic, sharp

A soap film on pins with free edges: every free edge pulls into an arc of the same radius, so long edges scoop deep and short ones stay nearly straight, and
every corner closes to a needle. There is one shape on stage, a flat sail whose corners are the last three notes. A new note takes the oldest corner to its own
place in one step, overshoots and rings back, and the wedge at that tip goes bone. The melody's intervals show in the edges: a wide leap is a long deep scoop. A
chord is a spiky star for a moment, and then single notes cut it back. It's the only one in deep blue, and the eye judge found that a relief. It reads as taut
before you know why, and at two or three fills it is among the cheapest here.

- **Spec:** essay 4, §4 Film.
- **Changes:** three, and they are why the builder scored it low. Give pitch part of `y` (the essay chose `y` only for area, so a melody's contour didn't read):
  `y = mix(pitch height, best-area candidate, 0.5)`, with the area rule only to stop collapse. Draw the body with `tone` at about (26,44,128) so that a jump lands
  whole. **Drop the end-of-phrase pull into the centroid:** it is a staged motion without a note. The sail's tone just falls away after `stay`.
- **Test:** big flips at 12 notes a second may strobe. If so, cut the overshoot by the gap to the next note.
- **Start from:** `lab/tools/handover.js`. **Palette:** ink blue, bone wedge. **Cost:** 2 or 3 fills.

### 7. Tack (`tack`): fuzzy, elastic

Pull apart two surfaces joined by resin or tape and the film doesn't let go evenly. It tears into a comb of regular fibres that go taut and snap independently,
regular in spacing and random in failure, which is the sound of peeling tape. Each note is a flat dark-red slab, already split on its attack step, with the gap
filled edge to edge by bone hourglass fibres. They snap in no spatial order inside about a tenth of a second, leaving a nap of spikes on both faces that shrinks to
a clean edge. Fur that exists only as tension, and only for a tenth of a second. A repeat shuts the slab and tears it again. It sits right beside the snap squares
the user liked, and adds a texture felt in the teeth.

- **Spec:** essay 4, §3 Tack.
- **Changes:** waist at least 1 px, not 0.7. Draw moved fibres at `E(t)` directly. Hold the slab with `tone` at about (96,16,18).
- **Danger:** a dark-red slab split by strands can read as a mouth. Keep hard square corners and no lip, tilt the seam ±12° by a hash of the pitch, and look at the first
  still with that one question.
- **Start from:** `lab/tools/squares-snap.js`. **Palette:** dark red, bone fibres. **Cost:** about 10 fills, up to 650 fibres at worst for 0.35 s each.

### 8. Mica (`mica`): rigid, sharp

Granite in low sun: flakes lying at one angle flash together, all over the stone, in the same instant, while the rest stays dead. Turn the stone and a different scatter
lights. So not one pixel moves, ever. Each pitch owns a fixed set of about 192 shards, with a dozen big ones that read from across the room, and **all shards of a note lie at
one angle: pitch class × 15°**. An octave is parallel, a semitone 15° off. A chord is two or three hatchings at once, and you see the interval as an angle before you know
why. A repeat is the same constellation again, which the eye recognises the way the ear does. It is the snappiest idea in the set, scoring 10 from all three. The risk the eye
judge names is real, that it's attractive scatter with no form, so it's the one to judge over a long passage.

- **Spec:** essay 3, §1 Mica (not essay 8's).
- **Changes:** make shards at least 6:1, not 3:1: a fat rhombus can't show a 15° step. Through `alpha`, the violet body's "gone by 0.8 s" is really about 0.35 s on screen, which is better
  for snap, so try that first and use `tone` only if the `ring` knob has to stretch it. Seed each set from its pitch with its own generator, not `x.rnd`, so the same stone comes back after a seek. Apply the 6 % bone budget.
- **Start from:** `lab/tools/ikeda.js` (same note, same code). **Palette:** silver over cold violet. **Cost:** 2 to 12 fills, under 5 ms.

### 9. Fist of spines (`urchin`): sharp, elastic

Poke a sea urchin and the spines around the spot swing toward the poke, their tips closing on it. Threatened things flee or curl; this one turns all its points on you. A flat field
of needles lies along a slow nap, pivots fixed. On the attack step every needle within reach turns to aim at the note's spot and stabs, stopping short of it, so **the spot itself
stays black**, a clean point of nothing surrounded by tips. In a chord each needle turns to the nearest note, so sharp borders appear where neighbours disagree. A repeat finds them
already aimed: nothing turns, but the stab and flash restart, a clench. It's the nearest thing here to murmuration's collective feel, the user's favourite, and the empty point is what
keeps it from being an iron-filings diagram.

- **Spec:** essay 6, §5 Fist of spines.
- **Changes:** the rest nap in dark red at 0.24 measures about 5 levels, so the ground that makes the turn visible would be black, and then the turn looks like needles spawning: the recipe it
  is trying to avoid. Draw the nap with `tone` in dark teal about (16,62,58). The lying back gets one shared time constant with no front, and now that the ground shows, check on video that it
  stays a quiet settling.
- **Start from:** `lab/tools/flee.js` (needle shape only). **Palette:** dark teal, bone at the spot. **Cost:** 240 triangles in 6 fills, about 2 ms.

### 10. Cut (`cut`): rigid turning fuzzy

A spade cut in wet sand stands with perfect faces and sharp edges, and as it goes the corners go first, because a grain on a corner has the fewest neighbours. Each note stands one slab with exact straight
faces. Then nothing happens. **Time doesn't erode it, notes do:** every later attack takes one step off every slab already on the screen, in that attack's own step, corners first, then edges, then faces. So
the picture is a history you read by edge, from knife-edged to sugar, and a slab's edge tells how many notes ago it was. It's the direct answer to what the user said about Ivory's dissolve: crumbling that
only ever happens on a real attack has nothing to stage. A still frame shows the whole texture range, like a woodblock print.

- **Spec:** essay 8, §4 Cut.
- **Changes:** bake the 9 stages in real dim tones and blit with `lighten` at alpha 1, so grain edges stay exact. The strike needs more than a 3 px line on two faces to carry a note in big music: give the whole
  slab a brighter tone for the hold, and the line 5 px. At six attacks a second a slab lasts about 1.3 s, so this is at its best on picks and slow music; say so in the blurb.
- **Start from:** `lab/tools/squares-snap.js`. **Palette:** wet ochre about (150,104,50) by default, moving `wet` away from dark red. **Cost:** about 16 `drawImage` calls.

## Build order

The order differs from the rank, so that the user can answer the most questions in the fewest sittings. All are new files and can be built in parallel, one builder each (Sonnet 5.5), appending to `TOOL_IDS`.

1. **One per word, first.** `prickle` (sharp), `nap` (fuzzy), `pluck` (elastic), `interlock` (rigid). All cheap, with no shared code beyond `tone`. Watching these four tells us which readings of the four words
   are right, and everything after can lean toward what the user liked. **Prickle goes first of all**, as the smallest and safest, and it proves the `tone` rule on screen.
2. **The crossovers.** `crimp` (the sprite baking is the most work in the set), `tack`, `film`.
3. **The ones that need a long look.** `mica` and `urchin`, both of which could turn out to be pattern rather than picture, and `cut`, whose whole idea shows only over a passage of many notes.

For each: unit test the envelope and the `less:` knobs, one short end-to-end pass, one 60 Hz video on a slow melody and a fast run. Verdicts should go in `lab/ratings.md` as usual.

**Stills first for the risky readings.** Three of these can fail on the first frame, and a still costs nothing: Tack (a mouth?), Interlock (teeth?), Crimp (moiré?).

## Next in line, not in the ten

- **Quill** (`quill`, essay 5 §1): the builder's first and the musician's third. One long rigid line that kinks where pitch says, so bass throws the whole picture and treble only flicks the tip, and not a hair moves
  between notes. It is the best idea in the set about register. It's out of the ten only because the eye judge marked it too physical, "a drawing of a feather", and that is the verdict that killed shatter and lightning. Try
  it as a bare ruled line with short one-sided straight hatching, so the leverage stays and the feather goes. Cap the far end's travel at about 300 px per note: the essay's 22° moves it 637 px. If a still of that looks good, it
  goes straight into the second group.
- **Cleave** (`cleave`, essay 3 §4): a dark slab that shears like a deck pushed from the side, where the flash and the crack are the same pixel. A fine rigid widget, close to what the user liked. Second in line for rigid.
- **Bristling** (`bristle`, essay 6 §6): a hard cut between combed and crossed hair, readable with no change in brightness. The eye judge gave it 10 for texture; the musician finds it does little over a phrase.
- **Striation** (`striation`, essay 7 §3): a barcode where a note makes light by crowding, and the neighbours pay with wider gaps.

**Filtered out, so nobody picks them up again:** `neck` (the most specific idea of all, a thread thinning to zero exactly on the next note, but the thinning is a visible event with no note, and it reads as suggestive), `hop` and
`latch` (fake attacks), `forks` and `stillness` (duplicates or false about the canvas), `cushion` and `handlens` (too literal). The reasons are in `judges/`.

## What the judges said about the whole set

**Right:** almost every idea appears whole on the attack and moves nothing between notes. The fake-attack and travelling-front traps were mostly avoided. Almost everything is stateless from `CHORDS`, and the draw counts are real (only
essay 6's Glint and `hackles` are costly).

**Wrong, and worth carrying into the next round:** laws that are true but can't be perceived (contact time, loud-means-fewer, topology). Ideas tuned for the slow case that vanish at real density. Velocity ranges that assume 0 to 127. Grounds and
scars that the burn eats (the finding above). One palette. And pitch given to a hash, so a melody doesn't read as a melody: the widgets above keep pitch as a place wherever they can.

## Outside this brief

The burn finding touches last night's work only narrowly. The presets' timings were tuned through the burn, so they aren't in question. What this adds: a dim dark colour held steady sits below what that tuning on a bright mark predicts, its darkest channels
go to almost nothing, and it differs between the default canvas and the software canvas (13 against 5 at oxblood T 0.25, on a held fill). `hammer`, `handover` and `squares-snap` draw through `SNAP.alpha` and none uses `lighten`. I haven't measured those widgets
themselves, and any change is the user's call by eye. Noted here and in the shared notes, not acted on.
