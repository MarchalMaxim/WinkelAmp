# Water tension and sap: the fast side of liquids

What I noticed, looking closely: tension does nothing for a long time and then finishes everything at once. A neck between
two drops thins faster and faster as it nears zero, so the break has no slow last moment at all; a bead on a waxy leaf stays in
contact for the same time however hard it is hit; a thread of water cannot choose how many beads it becomes. Those are laws
rather than looks, and each can be mapped straight onto a note.

**One decision for all eight: no gravity.** Honey owns weight and sag. Surface tension does not care which way is down, so
nothing here hangs, drips or falls. That also keeps every idea away from "too suggestive", which is the word for tall shapes
that swell and drip. Colours are starting points; any idea can take a colour knob if the builder spends a knob on it.

Shared terms: `H` is the 0.033 s hold. `E(t)` is flash over body by the P4 rule, flash half-life 0.06 s, body at most 40 %. `p`
is pitch from 0 to 1 and `u` is `v/127`. On picks, `u` has a floor of 0.35, so every note lands. Hot colour is bone
(236, 226, 208), never white. Marks are drawn through `alpha(T, Tprev)`.

---

## 1. Neck (`neck`)

**(a) The natural thing.** A drop pinching off. The neck's width goes as `(time left)^(2/3)`, which has infinite speed at zero.
It is the only thing in my corner that gets faster as it ends. After the break the two sides are not alike: the thread side is
a thin cone of about 18 degrees and the drop side is blunt, and one tiny satellite bead stays where the break was.

**(b) Texture.** Elastic and sharp: the moment a stretched neck snaps.

**(c) One picked note.** **The attack is the snap.** `CHORDS` tells us when the next note comes, so the thread between this note
and the next reaches zero width on exactly that step.

Before the attack, drawn quietly in flat oxblood at the body level:
- The previous note's mass, shrinking.
- A small bud at the place the next note will land, growing.
- A bridge between them, thinning.

On the attack step:
- The bud jumps to full radius `R = (26 + 44u)·(1.25 − 0.5p)` px, 16 to 88, in bone. It cools to oxblood by the flash curve.
- The bridge is gone.
- Two needles remain at the break, which sits 72 % of the way along: a long 18-degree cone on the old mass's side and a stub on
  the new one's. Both are bone for the hold.
- The cones retract as `l0·e^(−t/0.05)`.
- The old mass goes to zero area by 0.18 s and never brightens.
- The new mass rings as an ellipse, `rx = R(1 + a·e^(−t/0.12)·cos 2πft)` and `ry` the opposite, with `a = 0.06 + 0.22u`. The
  frequency `f` follows the real drop law `R^(−3/2)`: 15 Hz at R = 16, floored at 4 Hz, so small beads shiver and big ones wallow.
- A satellite of radius `3 + 5u` px stays at the break for 1.2 s, very dim.

Pitch is height: `y = H(0.9 − 0.8p)`, so the melody's contour reads directly. `x` is a walker that takes `180 + 160·min(1, gap)`
px per note and turns round at the margins, so a long wait is a long thread. Velocity sets size, ring depth and satellite.

**(d) Chord, repeat, run.**
- **Chord:** one mass per note, up to 6. Each note gets a bridge from its nearest pitch in the previous chord, and all of them
  snap on the same step.
- **Repeat:** the same height, one step sideways, so a repeated note is a horizontal row of snaps, each at full flash (P7).
- **Fast run:** bridge half-width scales with `√(gap/0.5)`, down to a 1.5 px hair. A run is a string of hairs snapping.
- **Long gaps:** the bridge only starts 2.5 s before the next note. Until then the mass sits alone and dims. The last note gets no
  bridge.

**(e) Knobs.**
- `reach`, how far ahead it starts pulling, 0.3..2.5 s, default 1.5, `less: 0.5`. Left: the thread appears just before the note.
  Right: a long slow stretch across the wait. Picture: a thread, short to long.
- `fat`, how big the masses are, 0.4..1.8, default 1, `less: 0.6`. Left: small beads. Right: big flat bodies. Picture: dot size.
- `crumbs`, what stays behind, 0..3 s, default 1.2, `less: 0`. Left: nothing stays at the break. Right: a dotted trail of old
  breaks stays for seconds. Picture: dots trailing.
- `ring`, how much it shakes, 0..1, default 0.6. Left: a mass lands dead still. Right: it shakes hard for a fifth of a second.
  Picture: ellipse, round to squashed.
- `presence` moves `reach`, `fat` and `crumbs`.

**(f) Not a recipe.** The whole widget is one decision: tension builds between notes on a known deadline, so the eye learns to
watch the thread and the note lands on the break. Nothing else in the collection gets tighter as a note approaches.

**(g) State and drawing.** Stateless. At reset, `plan(CHORDS)` stores positions, radii and pairings per chord. `frame` finds the
chord by binary search and draws from `age` and `τ = next.t − x.t`. Bridge half-width is `w0·(τ/Tc)^(2/3)`, with
`w0 = 0.45·min(R_old, R_new)` and `Tc = min(gap, reach)`, floored at 0.75 px until the break. Each bridge is one filled path: two arcs and four quadratics. At most 6 bridges, 6 remnants, and all satellites
as arcs in one path. Under 20 fills a frame, no sprites.

**(h) 2D.** The shapes are exact curves.

**(i) Closest widget.** Handover, which also shrinks one mark as the next lands. Handover's slabs are unrelated rectangles. Here
the marks are joined, the place of the next note is visible, and the note itself is a break. Honey also has threads and even a
snap, but its threads sag on their own schedule and break when overstretched, not on the note.

**(j) Danger.** Three, all real:
- **Two round masses and a shaft could be "too suggestive".** The two ends are never the same size until the break, the bridge is
  always at least 3 radii long, and the axis runs mostly sideways because the walker moves `x` a long way and pitch moves `y` only
  14 px a semitone.
- **No fake attacks.** Before the note nothing brightens. It only gets less: thinner, smaller. The snap design did not adopt
  wind-up that night, so if the foretold bud bothers the user, `reach` at its left end removes nearly all of it.
- **Elastic trap.** The ring is under 0.25 s and size only.

---

## 2. Beading (`beading`)

**(a) The natural thing.** A thread of water breaks into a row of beads, as dew does on silk. The spacing is not a choice: it is
always about 9 times the thread's radius. A thick thread gives a few fat beads and a thin one gives many fine ones. The whole
thread goes at once, the end beads are bigger because the ends pinch first, and tiny satellites sit between.

**(b) Texture.** Rigid for two steps, then elastic: a hard ruled bar that cannot stay a bar.

**(c) One picked note.** On the attack step, a dead-straight rectangle with square ends in bone at full alpha. Length is 640 px,
thickness `h = 3 + 23u^1.3` px, centred at `y = H(0.92 − 0.84p)` and at an `x` hashed from the pitch. It holds exactly 2 steps and
stays rigid.

From `H` on, everywhere along its length at once with no front, the outline necks: half-thickness is
`(h/2)(1 + a·cos kx)`, with `a = 1 − e^(−(t−H)/0.035)`. By about 0.1 s it has parted into separate round beads of radius
`R = 0.95h` at spacing `4.5h`. The first and last beads are 1.3 times bigger. A satellite of `0.18R` sits midway in each gap.

So a soft note (`h = 3`) is about 47 fine dots, and the loudest (`h = 26`) is 5 or 6 fat ones. **Loud means fewer.** The beads
then stay in place, cooling from bone to body at no more than 40 %, and are gone by L = 0.9 s. Beads never drift.

**(d) Chord, repeat, run.**
- **Chord:** a stack of bars at their own heights. They all break together, each at its own spacing, so an octave with a loud top
  and a soft bottom reads as coarse over fine.
- **Repeat:** the same place, with the phase moved half a wavelength. The new bar flashes through the old beads and its beads land
  in the gaps of the old ones, which is visible proof of a second note.
- **Run:** a staircase of bars at their heights. At 12 notes a second it may reach 10 alive, which is fine for path size. Limit
  each bar to 400 px when the gap to the next is under 0.12 s, so the flash area stays under the P12 limit.

**(e) Knobs.**
- `stay`, how long the beads stay, 0.25..2.5 s, default 0.9, `less: 0.35`. Left: dots are gone almost at once. Right: rows of dots
  stay for seconds. Picture: fade.
- `long`, how long a bar is, 160..1100 px, default 640, `less: 240`. Left: short dashes. Right: nearly across the screen. Picture:
  line length.
- `thick`, how thick the thread is, 0.4..2, default 1. Left: fine strings of many tiny dots. Right: a few big beads. Picture: a
  row of dots, many small to few big.
- `strings`, whether a thread stays between the beads, 0..1, default 0. Left: clean separate dots. Right: a hair stays strung
  between them for a fifth of a second longer, as saliva does. Picture: dots with a line.
- `presence` moves `stay` and `long`.

**(f) Not a recipe.** No choice of "how many dots". The law `spacing = 4.5h` means loudness turns directly into count and size, in
the opposite of the direction anyone would have designed.

**(g) State and drawing.** Mark: `{born, y, x0, len, h, phase, seed}`, or stateless from `CHORDS` looking back over `stay`. While
necking (6 steps), one filled outline per bar with 6 points per wavelength. After that, all beads of one colour bucket go in one
path of arcs. Four buckets, so 4 fills. At most about 400 arcs per frame in dense music, usually 60 to 150.

**(h) 2D.** Nothing here needs a shader.

**(i) Closest widget.** Hammer, a struck bar of light whose thin line rings. Hammer's stays a line. Ikeda and halftone have rows
and dots but never turn one into the other. Here, the bar-to-dots conversion is the whole event.

**(j) Danger.** Fine and sharp against the fade, and fake attacks. A soft note's 2.8 px beads are drawn at full alpha on the strike,
and the body floor stays above the 0.2 that 8-bit rounding eats. The break is over within 0.1 s, has no front, and only loses
brightness, so it reads as how the note falls rather than as a second event.

---

## 3. Tack (`tack`)

**(a) The natural thing.** Pull apart two surfaces joined by something sticky, like resin, tape or sap between fingers. The film does
not let go evenly. It tears into a comb of regular fibres, spaced at about 3 to 4 times the film's thickness whatever the
material. They go taut, then snap independently, which is the sound of peeling tape. For an instant each side has a nap of
spikes, then it goes smooth.

**(b) Texture.** Fuzzy and elastic: the rare fuzz that exists because something is being stretched.

**(c) One picked note.** One flat rectangle, split along a horizontal seam: `w = (230 + 330u)` px by `0.6w`, dark red, centred like
Handover (pitch for `x`, octave rows for `y`). On the attack step the halves are already apart by `0.4G`, where
`G = 40 + 160u^1.3` px, and then open fully by `G(1 − 0.6e^(−t/0.07))`.

The gap is filled, edge to edge, with a comb of bone hourglass fibres: spacing 5 px with ±1 px of seeded jitter, root width 4 px so
the roots touch and scallop the slab's edge, waist 0.7 px. All at full alpha for the hold.

Each fibre has its own seeded snap time in 0.03..0.14 s, with no spatial order. When it snaps, both halves retract at full speed
with `e^(−t/0.04)` to a residual spike of 6 to 18 px on each slab, which shrinks to nothing by 0.35 s. So at about 0.1 s the edge
has nap, and by 0.4 s it is a clean edge on a dim slab. The slab eases back 15 % of `G` with one small ring in under 0.2 s, then
cools to an ember, gone by 1.2 s.

Pitch is place. Velocity is how far it tears, and so how long the fibres are.

**(d) Chord, repeat, run.**
- **Chord:** one slab per note, with width divided by `√n`.
- **Repeat:** the slab is shut in that step and tears again, with fresh fibres seeded by chord index. A full flash every time, and
  the eye sees the seam close and open.
- **Run:** a slab keeps only what is alive. With 5 slabs alive that is about 650 fibres at worst, for 0.35 s each.

**(e) Knobs.**
- `pull`, how far it tears, 0.4..2, default 1, `less: 0.6`. Left: a crack with short fibres. Right: a wide gap with long ones.
  Picture: two bars apart with lines between.
- `comb`, how many fibres, spacing 14..3 px, default 5, `less: 10`. Left: a few separate strings. Right: a dense pelt. Picture:
  comb, sparse to dense.
- `tack`, how sticky it is, 0.02..0.35 s, default 0.14. Left: fibres go at once, a clean tear. Right: they hold and go one after
  another. Picture: lines, some broken.
- `stay`, how long the slab stays, 0.3..2.5 s, default 1.2, `less: 0.5`. Left: gone in a third of a second. Right: a slow ember.
  Picture: fade.
- `presence` moves `pull`, `comb` and `stay`.

**(f) Not a recipe.** The fur is not a surface treatment. It exists only as tension between two parts of one slab, and only for a
tenth of a second. The specific thing from the real object: fibres are regular in spacing and random in failure. Random spacing
would be a generic fuzz, and ordered failure would be a travelling front.

**(g) State and drawing.** Mark: `{born, x, y, w, h, G, seed}`. `frame` computes from `age`. The fibres go in one filled path per
slab per colour bucket: 6 points per fibre, about 60 to 130 fibres per slab. Slab halves are 2 rects. Pre-hash the snap times into
a 256-entry table indexed by `fibre + seed`, so no `x.rnd` call per frame. About 10 fills a frame.

**(h) 2D.** Batched polygons do it.

**(i) Closest widget.** Snap squares, whose hot crack and quiet ember it borrows on purpose. There a crack is drawn on a square.
Here the crack is an opening, and what lives inside is a pelt.

**(j) Danger.** Fuzzy against crisp first, and Rigid's travelling-front trap. The fuzz is entirely sharp polygons with no blur at any
age. Snap order has no spatial pattern, so no front runs along the seam. Also the rebound: it stays at 15 % of `G`, small and fast,
so it never reads as a second note. The P12 check: bone covers only fibres, under 2 % of the frame per slab.

---

## 4. Film (`film`)

**(a) The natural thing.** A soap film spanned on pins with free edges. Every free edge pulls into a circular arc, and all arcs have
the same radius, so long edges are scooped deep and short ones are nearly straight. Every corner closes to a needle. The film
carries no detail of its own: its whole shape is its tension.

**(b) Texture.** Elastic and sharp: taut scooped edges ending in needles that could hurt.

**(c) One picked note.** There is **one shape on stage**: a flat sail of deep ink blue whose corners are the last 3 notes. The new note
takes the oldest corner to its own place, in the attack's own step.

- **Place:** `x = W(0.06 + 0.88p)`. `y` is chosen at plan time from 5 seeded candidates, whichever gives the sail the largest area,
  so a sail never collapses to a line.
- **Attack step:** the sail is redrawn with the new corner 14 % beyond its target, then rings back as
  `0.14·d·e^(−t/0.07)·cos(2π·8t)`. Edge scoops `s = c²/(8Rc)` (`c` the edge's length, `Rc = 900` px, `s` capped at `0.35c`) start at half depth, so the sail is drum-tight at the blow, and ring
  back to full depth in the same 0.2 s.
- **Flash:** a wedge of the sail, from the new tip along both edges for `90 + 120u` px, is bone for the hold, and cools by the flash
  curve. Only the wedge: under 1 % of the frame.
- **Over the next second:** the body falls from 1 to 0.45 of its colour with the body half-life. The old sail's position fades by
  itself on the canvas, a 5-step after-image that the code does not draw.

Pitch is where the corner lands. Velocity is overshoot and wedge length.

**(d) Chord, repeat, run.**
- **Chord:** all its notes become corners at once, up to 7. A big chord is a big spiky star for that moment, and the next single
  note starts cutting it back, because the corner count falls back to 3 one note at a time.
- **Repeat:** the oldest corner is yanked to the same column at a new height. The shape changes every time and the flash restarts.
- **Fast run:** the sail flaps at the rate of the notes with one bright tip per note. It holds up because each new tip is the only
  bright thing and the eye follows it like a bouncing ball.
- **No next note:** after `stay`, corners pull into the centroid over 0.25 s, scoops deepening, and it is gone. It is a quiet
  shrink, area only.

**(e) Knobs.**
- `corners`, how many notes hold it, 3..7, default 3, `less: 3`. Left: a three-pointed sail, each note a big change. Right: a
  many-pointed star, each note a small one. Picture: star points.
- `slack`, how deep the edges are scooped, 0..1, default 0.6. Left: nearly straight, a hard polygon. Right: deep scoops, thin spines
  to long needles. Picture: a triangle with concave sides.
- `kick`, how far a corner overshoots, 0..0.4, default 0.14. Left: it lands dead. Right: it whips past and back. Picture: arrow past a
  mark.
- `stay`, how long it stays with no note, 0.3..4 s, default 2, `less: 0.6`. Left: gone quickly after the line ends. Right: it hangs.
  Picture: fade.
- `presence` moves `corners` and `stay`.

**(f) Not a recipe.** No particles, no count, one shape. The specific decision is that the same-radius rule decides everything: a
wide interval produces a long deep scoop and a close one a nearly straight edge and a splinter of a corner, so the intervals of
the melody show in the edge curves. Straight edges would be a polygon morph with no feel at all, so this passes the swap test:
remove the scoop and nothing is left.

**(g) State and drawing.** Stateless. `plan(CHORDS)` stores corner positions per chord. `frame` finds the current chord, takes the
last K corners, sorts them by angle round the centroid, and draws one path of K quadratics. Add one wedge path, clipped by building
it from the same curves. 2 or 3 fills a frame. It is the cheapest idea here.

**(h) 2D.** A handful of curved fills needs no shader, and the needle tips stay exact.

**(i) Closest widget.** Handover (one form at a time) and Kandinsky (flat geometry). Unlike Handover, a single form persists and is
edited by each note, so the last three notes are always visible at once as its corners.

**(j) Danger.** No fake attacks: the sort can flip edges, but only on an attack step, because corners change nowhere else. And
elastic: the 8 Hz ring is size and position only, over 0.2 s, and brightness only falls. The P12 trap is real, since the sail itself
can cover 30 % of the frame, so its body stays a deep colour and only the wedge goes bone.

---

## 5. Pancake (`pancake`)

**(a) The natural thing.** A drop hitting a waxy leaf. It flattens to a thin disc with a thick rim, its rim retreats at constant speed,
and it leaves the leaf as a ball. The measured surprise (Richard, Clanet and Quéré, 2002) is that **the contact time does not depend
on how hard it hit**. Only the width does. At high speed the rim breaks into regular fingers.

**(b) Texture.** Elastic and sharp: a disc that is at its widest and spikiest in the attack's own step and only comes home after.

**(c) One picked note.** On the attack step, at its largest:
- A flat disc of ultramarine at 35 %, radius `Rmax = R0(1 + 1.6u)`, with `R0 = 34 + 110(1 − p)` px.
- A hard rim of width `0.1·Rmax` in bone.
- For `u > 0.5`, `N = round(6 + 26u^1.5)` sharp triangular fingers on the rim, length up to `0.35·Rmax`. A soft note is a clean disc
  and a loud one is a cog of needles.

From `H`, the radius falls in a straight line, not eased, to `0.6·R0` at `tc = 0.26·(R0/60)^(3/2)`, clamped to 0.12..0.45 s. Bass
is slow and treble quick, and **loud and soft notes at the same pitch come home at the same moment**. Fingers retract in the first
40 % of `tc`. Then it is a bead of radius `0.6·R0`, which overshoots into an ellipse with at most 2 cycles in 0.2 s, and sits as an
ember at 30 %, gone by 1.4 s.

Pitch is `x`, and also size and time. Velocity is width and fingers.

**(d) Chord, repeat, run.**
- **Chord:** overlapping flat discs, drawn low to high, with no blending, so it reads as cut paper. The rims overlap sharply.
- **Repeat:** the same spot, starting over at full width on top of whatever was shrinking.
- **Run:** breaks a little at 12 notes per second, because `tc` may exceed the gap. Each new one is drawn over, and a treble run has
  small quick ones, so it holds. For a bass tremolo the discs pile up, so cap at 6 alive and drop the oldest.

**(e) Knobs.**
- `wide`, how wide a hit spreads, 0.5..1.6, default 1, `less: 0.6`. Left: small discs. Right: big ones. Picture: disc size.
- `spikes`, how spiky a loud note is, 0..1, default 0.7. Left: always a clean disc. Right: even moderate notes are cogs of needles.
  Picture: a disc with spokes.
- `time`, how long it takes to come home, 0.5..2, default 1. Left: a snap. Right: a slower contraction. Picture: arrow inward.
- `bead`, how long the bead stays, 0..3 s, default 1.4, `less: 0.2`. Left: nothing stays. Right: a field of small beads lingers.
  Picture: dots.
- `presence` moves `wide` and `bead`.

**(f) Not a recipe.** The fixed contact time. Time goes with pitch, not velocity, so a soft and a loud chord tone arrive home together:
something a designer would never have decided, and it gives a rhythmic clarity velocity-scaled envelopes do not have.

**(g) State and drawing.** Stateless from `CHORDS`, looking back over 1.4 s. One disc fill, one rim-and-fingers fill (the outer outline
and inner circle in one even-odd path, 6 points per finger), and one arc for a bead. About 3 fills per live note, at most 6 notes
in the disc phase, and all beads in one path. Under 25 fills.

**(h) 2D.** Polygons, nothing else.

**(i) Closest widget.** Kusama, for flat dots, and the dropped ripples, of which this is the reverse. It starts at its widest and
contracts, with a filled disc rather than a line.

**(j) Danger.** The ban on expanding rings. It never expands, there is only ever one rim, and the centre is filled. P12: `Rmax` capped
at 320 px, and the bone rim area stays at or below 6 %. The end of the contraction is not an attack: it never brightens, and the ring
stays under 0.2 s.

---

## 6. Snapback (`snapback`)

**(a) The natural thing.** A taut rubber thread, or a stretched thread of resin, when it is cut. It does not stay straight. The slack
travels in faster than the thread can straighten, so it comes back buckled, in a wriggle.

**(b) Texture.** Sharp and elastic: the straightest possible line for 33 ms, then a wriggle that is the same line's own slack.

**(c) One picked note.** On the attack step, a dead-straight tapered hair in bone at full alpha, 4 px thick in the middle and 1.5 px at
its ends, length `500 + 600u` px through the point `(x(p), y(p))`. Slant is a fixed angle per pitch class, hashed, so a tune has
its own set of slants. It holds 2 steps.

From `H`, it is cut at a seeded point between 35 % and 65 %, and each half pulls back towards its far anchor:
`L(t) = L0(0.12 + 0.88e^(−t/0.06))`. Length is kept by buckling: the half is a sine of amplitude
`A = 0.5·√(L0² − L²)/n` with `n = 3 + 7u` half-waves, higher near the free tip.

By about 0.15 s, two tangled, smooth squiggles sit at the anchors, each `0.12·L0` long. The motion stops dead, with no further wriggling,
and they cool to body, gone by 1.2 s. The canvas's own fade, not any code, leaves a feather of the whip over 6 to 8 steps.

Pitch is where it sits and its slant. Velocity is length and how tangled the squiggle is.

**(d) Chord, repeat, run.**
- **Chord:** a fan of hairs, each with its slant, crossing. They are cut in the same step.
- **Repeat:** the same line again, with a new squiggle seeded by chord index. It looks like a signature that never quite repeats.
- **Fast run:** length shrinks with `min(1, gap/0.25)`, so a run is a thicket of short slashes.

**(e) Knobs.**
- `long`, how long the line is at full stretch, 0.3..1.6, default 1, `less: 0.5`. Left: short slashes. Right: nearly across the
  screen. Picture: line length.
- `tangle`, how tangled it comes back, 0..1, default 0.6. Left: it just shortens, staying straight. Right: tight knots of squiggle.
  Picture: a wave, flat to tight.
- `speed`, how fast it whips, 0.03..0.2 s, default 0.06. Left: instant. Right: you can follow it. Picture: arrow.
- `stay`, how long the squiggle stays, 0.1..4 s, default 1.2, `less: 0.3`. Left: nothing stays. Right: a page of squiggles builds up.
  Picture: fade.
- `presence` moves `long` and `stay`.

**(f) Not a recipe.** Each note leaves its own hand-like mark, and no one drew it: it is what that line's slack had to do. Straight
to scribble in 150 ms is the event.

**(g) State and drawing.** Stateless looking back over `stay`. Per note, 2 polylines of 28 points. Motion only in the first 0.15 s, so
settled squiggles can be drawn from a cached `Float32Array` per mark. All marks go in one path per brightness bucket, 5 buckets, so
5 strokes covering about 1100 segments at the worst.

**(h) 2D.** Stroked polylines are all it is, and 2D keeps them bit-stable.

**(i) Closest widget.** Hammer (a thin struck line) and calligraphy (strokes that are characters). Hammer's line stays in place and rings.
This one breaks and turns into a mark.

**(j) Danger.** The ban on bolts. The curves are smooth sines that never branch or jag, and a line retracts instead of striking. Also fine
and sharp against the fade: on the attack it is full alpha, the settled squiggle stays 2 px thick and at least 0.25 bright, and only
marks still alive are redrawn.

---

## 7. Flinch (`flinch`)

**(a) The natural thing.** Pepper on water, touched with soap. The surface tension gradient clears the skin at once. There is no visible
sweep: a clean hole with a hard edge is simply there, in about a blink, and the pepper has piled up on its rim and stopped dead.

**(b) Texture.** Fuzzy and sharp: a nap of thousands of grains, and a hole with an edge cut into it. **The only idea here where a note
takes away instead of adding.**

**(c) One picked note.** The ground is a screen-wide pelt: about 2600 short sharp strokes, 2 to 4 px long, in bone, pre-rendered once and
drawn each step at a steady 30 %. It is dim, always there, never moving.

On the attack step:
- A hole of radius `Rh = 40 + 170u^1.2` px is cut from the pelt's offscreen layer, with a crisp edge, at `x = W(0.06 + 0.88p)` and
  a `y` from the octave row.
- A rim of densely packed grains is drawn at full alpha just outside it, from a pre-rendered sprite with the irregular outer edge
  that real pile-up has, `0.12·Rh` wide. It appears whole at its final radius. It never grows.

The rim's flash has half-life 0.06 s and it settles at 40 %, gone by 0.6 s, leaving the pile as part of the dim pelt. The hole
itself falls to black at the canvas's own speed. Then, over `heal` seconds, grains come back evenly across the hole with no front
and no event: the pelt layer gets a low-alpha repaint of the base layer every 8 frames.

Pitch is place, and velocity is hole size.

**(d) Chord, repeat, run.**
- **Chord:** several holes at once. Where two overlap they join, and the rim only exists on the outside, as one outline.
- **Repeat:** the hole is already there, so the same rim flashes at full and the hole widens 12 %.
- **Fast run:** a lane cut through the pelt across the screen, where the run went. It reads like a trail, and it takes seconds to heal.
  This is where the widget earns its place: passages become places, and the pelt remembers.

**(e) Knobs.**
- `size`, how big a hole, 0.4..2, default 1, `less: 0.5`. Left: pinpricks. Right: big clearings. Picture: a dot in a field.
- `nap`, how thick the pelt is, 600..5000 grains, default 2600, `less: 800`. Left: sparse specks. Right: dense fur. Picture: dots, few to
  many.
- `heal`, how fast it grows back, 0.5..12 s, default 4. Left: at once. Right: the song eats the pelt away. Picture: fade.
- `dim`, how bright the pelt is, 0.1..0.5, default 0.3. Left: only rims show. Right: a real surface. Picture: dots, dim to bright.
- `presence` moves `size` and `nap`.

**(f) Not a recipe.** It has a thousand particles, and not one of them moves. There is no sweep to animate, because the real thing has none
that you can see: before and after, with a hard edge between them.

**(g) State and drawing.** Offscreen 1280×720 pelt layer plus base layer, one rim sprite per 3 size buckets, 512 px. `onChord` stamps holes with
`destination-out` and stores a mark for the rim flash. `frame` does one fullscreen `drawImage` and up to 8 rim sprites. Under 12
draws. The layer depends on history, so seeks replay from `CHORDS` through the host, like Honey and other stateful widgets. Grain positions
come from `x.rnd`.

**(h) 2D.** Offscreen compositing is all it needs.

**(i) Closest widget.** Halftone, a field of dots that swell in a wave. Here nothing swells or travels. Flee's shapes bolt, while these grains are
just gone.

**(j) Danger.** Fuzzy against crisp first: every grain is a hard stroke and nothing is blurred at any age. The other danger is rings from a
point: a rim appears whole, in its place, is irregular and never expands. And "no black over-paint": the hole darkens at the canvas's
rate (half in 0.09 s), so the rim, not the hole, carries the attack on the first step.

---

## 8. Dimple (`dimple`)

**(a) The natural thing.** A pond skater's foot. Two things to see. A flat water surface is invisible; you only see it where it bends.
And a dimple's width is set by the capillary length, not the load: heavier feet go deeper, not wider. Its profile is logarithmic,
so it is steep at the foot and flat very soon, nearly a cusp.

**(b) Texture.** Sharp point on an elastic skin.

**(c) One picked note.** A stack of 44 horizontal hairlines, 16 px apart, exists in the model and shows nowhere while flat. On the attack
step, a note at `(x(p), y(row))` presses each line within `Rc = 190` px down by `D·ln(Rc/r)/ln(Rc/r0)`, with `r0 = 3` px and
`D = 16 + 76u` px. **Only the bent parts are drawn**, at full bone where steep, with alpha following slope, so what appears is a
stack of nested V cusps converging on a needle point, like fletching, with nothing around it.

Width is always the same; only depth varies. Depth then releases: `D·e^(−t/0.09)·cos(2π·7t)`. So it pops past flat by about 20 % within
0.1 s and is level by 0.3 s. As it levels, its lines disappear, because flat is invisible. Alpha is non-increasing. A note lives
about 0.3 s.

Pitch is place, velocity is depth.

**(d) Chord, repeat, run.**
- **Chord:** displacements add on one skin, so close notes form a single double-pointed pinch and far ones are separate.
- **Repeat:** the same spot pressed again to full depth, from wherever it is.
- **Fast run:** the bent zone runs along the skin in steps. Fine, since every note stays a separate point.

**(e) Knobs.**
- `deep`, how deep a note presses, 0.4..2, default 1, `less: 0.5`. Left: a dent. Right: a long needle. Picture: a V.
- `wide`, how far the skin feels it, 80..380 px, default 190, `less: 110`. Left: a tight tick. Right: a broad pinch across many lines.
  Picture: a V, narrow to wide.
- `lines`, how fine the skin is, 18..70 lines, default 44, `less: 24`. Left: a few strong lines. Right: a tight hair. Picture: horizontal lines.
- `spring`, how long it trembles, 0.1..0.5 s, default 0.3. Left: it just lets go. Right: it rings past flat twice. Picture: wave.
- `presence` moves `deep`, `wide` and `lines`.

**(f) Not a recipe.** A surface invisible until bent, and a width that the note's strength cannot change. A generic version would have a
visible grid and scale the dent with velocity.

**(g) State and drawing.** Stateless looking back over `spring`. For each line near a live note, 30 points. Segments under the slope limit are
skipped, and the rest go in 4 alpha buckets, so 4 strokes of at most 2000 segments, with typically far fewer.

**(h) 2D.** Batched strokes are enough, because only the bent parts are ever drawn.

**(i) Closest widget.** Hammer (one line rung) and woven threads. Here the threads are invisible until a note touches them.

**(j) Danger.** Moiré, dropped: 16 px spacing and no second grid, and the nested Vs must never overlap a second copy of themselves. Check trails with
a real render, because fade trails can interfere when lines move. Also elastic: the overshoot stays under about 20 % of depth and dies by 0.3 s.
And fine hairs: these show at full alpha while steep, and anything shallower simply is not drawn.

---

## Left out on purpose

Coalescing drops are too close to Honey's metaballs once they carry memory. A foam whose walls jump to new 120-degree joints on each note is a
real observation, but it would read as cracked glass or a Voronoi diagram, and it needs a heavy simulation.

**My best idea: Neck, because it makes the attack itself the breaking of a thread that has been thinning towards exactly that step, so the eye waits for every note and can count them.**
