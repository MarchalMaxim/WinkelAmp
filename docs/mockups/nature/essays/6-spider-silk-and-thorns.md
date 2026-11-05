# Spider silk and thorns

Silk is mostly not there: a web in low sun is invisible except where a thread is moving or angled right, and a taut thread is
ruler-straight until the moment it loses tension, when it hangs in a curve out of all proportion to how little slack it got.
Thorns and spines are the reverse: always there, doing nothing, and their menace comes from how thin the last centimetre is.
And almost everything here happens whole and at once (one contraction raises all the quills, a wet thread breaks into beads
along its full length, a whole web shifts when one strand is pulled), which is what the snap rules want from nature and rarely
get.

Shorthand used below. `u` is pitch 0..1 across the clip's own range. `E(t)` is a brightness envelope that peaks in the attack
step, holds 2 steps, then only falls, with a flash over a body of at most 40 % (P1 to P4). **Bone** is `[236,226,208]`, never pure
white. **Red** is a dark red around `[124,18,20]`.

Two rules apply to every idea here. **Moving marks.** A mark redrawn on its own pixels goes through `alpha(E(t), E(t − dt))`. That
formula assumes the mark's fading image is already underneath, and just after the hold it returns 0, because the flash falls faster
than the canvas. So a mark that has moved more than its own width since the last step, or a dash or bead lit for the first time, is
drawn at `E(t)` directly, and switches to `alpha` once it moves less than its width per step. Without this, everything elastic here
would move unseen. **Bone budget (P12).** On large marks, bone goes only to the top note of a chord (the others strike in saturated
red, which still lands), and if that is still over 6 % of the frame, the mix toward bone is scaled by
`min(1, 0.06·frame / bone area)`.

`touch` and
`ring` are the knobs of the snap vocabulary, reused as they stand: `touch` 0..3 step 1, default 2 (Left: here and gone. Right: a
bright strike, then a long quiet ring), `ring` 0.25..3, default 1 (Left: gone in a quarter of the time. Right: three times as
long). A picked note's `amount` above 1 strikes harder, below 0.6 it loses its bone core, and picks never peak below 0.35. Every
widget also has the usual `presence`, which moves the knobs marked `less:`.

---

## 1. Plucked corner (`pluck`)

**(a) The natural thing.** A strand pulled aside by a leg. A plucked thread is never a wave: at release it is two dead-straight
lines and one hard corner, and high-speed film shows that corner splitting in two, so the thread goes through a triangle, a
flat-topped trapezoid, a flat line and the same upside down (Helmholtz motion). Every drawing of a plucked string uses a sine.
This one has no curve in it.

**(b) Texture.** Elastic + sharp. The corner is the sharp part, the return the elastic.

**(c) One picked note.** Each pitch owns one strand between two fixed anchors inside the frame. Its middle is at a height by
pitch (low at the bottom), its angle a seeded ±14° so strands cross, its length by pitch: `L = lerp(1180, 140, u)`. On the attack
step there is no wind-up: the strand is already at full deflection, two straight segments meeting at a corner at `r` along it
(seeded 0.2..0.4, never the middle, which looks tidy and dead), pushed sideways by `A = min(0.2·L, 20 + 120·(v/127)^1.5)`. It is
3 px wide, bone, for 2 steps, with a 4 px hard square at each anchor. Then the closed form
`y(s,t) = A·e^(−t/τ)·½[f(s−ct) + f(s+ct)]`, with `f` the odd periodic extension of the triangle, `τ = 0.09 s`, and period
`2/c = clamp(0.2·(L/1180)^0.4, 0.1, 0.2)` s, so never above 10 Hz. It always has exactly two corners, so it is 3 segments. The
width falls to 1.5 px in a colour going from bone to red. By 0.25 s the shape is under 6 % of its height. The canvas does the
long exposure: earlier positions, still on screen at 0.88 a step, stack into the real thing, a fan of straight hairlines inside
a parallelogram. After that, a straight 1.25 px line in red at a body of 40 % or less, half-life by register, gone by about
0.8 s. Pitch goes to height and length, velocity to how far it is pulled.

**(d) Chord, repeat, run.** A chord is one strand each, crossing, with different flap speeds. A repeat restarts at full
deflection and replaces the old motion (no sum, no max), and moves the pluck point by 0.07, so a repeat makes a visibly new shape
on the same line. A fast run is a spray of short high strands kinking and gone, which is where it looks best.

**(e) Knobs.**
- `pull`, how far it is pulled, 0.3..2, 1. Left: a small kink. Right: a wide corner far out of line.
- `corner`, how hard the corner is, 0..1, 1. Left: a soft finger, a rounded bend. Right: a corner as hard as a ruled line.
- `shiver`, how long it shivers, τ 0.04..0.16 s, 0.09. Left: one flap, then straight. Right: a few flaps, never long enough to read as a new note.
- `ring`, `less: 0.25`, how long the still line stays.
- `touch`.

**(f) Not a recipe.** The decision is the rejected sine. All its character comes from a physical fact almost nobody draws: the
flat-topped trapezoid on the second or third step.

**(g) State and drawing.** Stateless: walk `CHORDS` back 1 s from `x.t`, newest per pitch only. The corners are at `s` = folded
`r ± ct`, so each strand is 4 points and needs no sampling. 8 alpha buckets by 2 colours: at most 16 strokes, at most 40 live
strands, about 120 segments. No sprites.

**(h)** 2D. Hairlines and batched paths.

**(i) Closest: hammer.** Hammer's line is a horizontal bar that stays where it is and changes only in brightness. Here the
geometry is the note: anchored, angled, pushed sideways, cornered. Not woven threads either: single, straight, never curved.

**(j) Danger: trap 2, and a kinked line reading as a bolt.** Period floor 0.1 s, motion gone inside 0.25 s, brightness only
falling. It only ever has two corners, never a jagged path, so it cannot be a bolt. If the corner's run reads as a travelling
front on the 60 Hz video, fall back to a standing shape: `y = A·φ(t)·tri(s)`, the corner fixed, flipping V to inverted V.

---

## 2. Load path (`tensile`)

**(a) The natural thing.** The spider, sensing which strand moved. It can, because a web is one body: pull one thread and every
junction shifts at once, some threads tighten and others go slack. And slack shows out of all proportion. A 300 px thread that
loses 2 px hangs 15 px (`sag ≈ √(3/8 · L · δ)`). So the picture has two states only, ruler-straight or visibly hanging, and a tiny
shift flips many threads from one to the other.

**(b) Texture.** Elastic + rigid: the whole net gives, and every loaded line is as stiff as a ruled one.

**(c) One picked note.** The net is 26 free junctions and 12 anchors 40 px off the frame, seeded, every junction a Y of three
threads, about 45 straight threads: a cobweb's irregular tangle, no hub, no spiral. Threads are sorted by the x of their middle,
so pitch picks a thread: same pitch, same thread. On the attack step the struck thread is 3 px bone and has a corner: its midpoint
is pushed sideways by `D = (20 + 70·(v/127)^1.5)·give` px, two straight segments (pushing both its ends sideways would only move it
and tighten nothing). That shortens the way between its ends, so both end junctions `a`, `b` are pulled inward along it, and all
junctions jump in that same step by `u_i = (G[i][a] − G[i][b])·e·D`, with `e` the thread's unit vector and `G` the inverse of the
graph's Laplacian (weights 1/length), computed once in `reset`. Threads that **tightened** (`ΔL > 0`) blaze in proportion to how
much, ruler-straight, 2 px: a branching path of light from the struck thread out to the frame. Threads that **lost tension** hang
by the formula above, one quadratic each, at 30 % brightness. So one step shows the load path whole. It does not travel. Over the
next 0.2 s all junctions share `φ(t) = e^(−t/τ)·cos(2π·6t)`, τ 0.08 s, so threads flick between straight and hanging as the net
shivers, which is what a shiver in a taut thing is. **Brightness never follows that:** each thread's weight is fixed from its `ΔL`
at `t = 0` and multiplied by `E(t)`; only its shape follows `φ`. So a thread can go slack mid-shiver and not rebrighten when it
snaps back (P3). By 1 s the net has gone back to nothing. Silk that nothing moves is not seen. Pitch picks the thread, velocity
sets how far the whole net moves.

**(d) Chord, repeat, run.** A chord adds the displacements (linear, so stateless) and shows several paths meeting. A repeat
replaces that pitch's term with a new one at full force, its corner on the other side each time; the same branching shape flares
again, so the eye learns a pitch as a shape. A run shakes the net: soft-limit total displacement with `tanh` at 120 px, while each
thread's flash still lands at full.

**(e) Knobs.**
- `give`, how much it gives, 0.2..2, 1. Left: stiff, only the light moves. Right: the whole net lurches.
- `shiver`, how long it shivers, τ 0.04..0.16 s, 0.08. Left: one jolt, then still. Right: a few trembling swings, all gone within 0.3 s.
- `threads`, `less: 12`, how many threads show, 12..45, 45. Left: a few strands, the rest still pull but are not drawn. Right: the whole net.
- `ring`, `less: 0.25`.
- `net`, how much net stays between notes, 0..0.35, 0. Left: nothing until something moves it. Right: the net stands dimly all the time (ground, through `settles`, one batched path).

**(f) Not a recipe.** No particles, no spawning, nothing is added. Two decisions: brightness is load, not proximity, and a slack
thread follows the true sag law, which is what makes a 2 px shift look alive.

**(g) State and drawing.** No marks at all. Per frame, take the chords in the last 0.6 s and sum `u` over at most 30 notes × 26
junctions, about 1500 multiplications. `G` is a 26×26 inversion in `reset`; keep the seeded positions rather than relaxing them
(composition over physics). 8 alpha buckets by 3 widths, in practice about 10 strokes and 45 segments.

**(h)** 2D.

**(i) Closest: woven threads,** curved threads braided in a band that lean on each other by harmony, with kinks that run along
them. Here nothing runs, the lines are straight, and the structure never changes. Against honey: honey's sag is slow and part of
it stays; here slack lasts a tenth of a second and comes and goes with the tension.

**(j) Danger: picture test, trap 2, and looking like a dim wire diagram.** A hub or a spiral would make it a web; Y junctions with
no centre read as a string figure. Real tremors travel along threads, and I chose not to draw that: the whole net knows at once.
Rebound is under 0.3 s and never rebrightens. The struck thread is always 3 px bone and tightened threads 2 px, so it never
settles into thin grey lines.

---

## 3. Glint (`glint`)

**(a) The natural thing.** A web against low sun shows no web. It shows a bow-tie: two opposing fans of sparkle around the centre,
because only the threads at the right angle throw light back. Each short straight segment is either lit or not, so the fans have
torn edges made of whole dashes. Touch the web and the bow-tie swings, and different dashes catch.

**(b) Texture.** Sharp. Hairlines across the whole screen, on one or two percent of its pixels.

**(c) One picked note.** Fixed at reset: 60 irregular rings of about 40 straight dashes each around one point at `(0.6W, 0.45H)`,
gaps seeded 8..22 px (irregular, so no moiré), dash length 24..70 px, each ±3° off tangent, about 2400 dashes sorted by angle. No
spokes, and nothing ever moves outward. The note sets a light angle, `θ` = pitch across 180° (the clip's own range: a rising line
turns like a clock hand). On the attack step every dash whose normal lies within `hw` of `θ` is drawn at full alpha, 1.4 px, bone,
from the centre to past the corners of the frame: two opposing fans. `hw = 3° + 11°·(v/127)^1.3`. For a middling note that is
about 200 dashes, 1.4 % of the frame; a note at full velocity, 2.7 %. So one note can cross the entire screen well inside P12. Then
`θ` overshoots and rings, `θ + 9°·(v/127)·e^(−t/0.07)·cos(2π·7t)`, and since lighting is by angle the *dashes change*: the fans
glitter instead of sliding. Each newly lit dash is drawn at `E(t)` directly, so the glitter is at the brightness of the moment.
Colour drops to red. Body 40 %, half-life 0.2 s, gone by 0.7 s. Pitch goes to the angle, velocity to the width of the fans and how
far they swing.

**(d) Chord, repeat, run.** Every chord note has its own angle, so a triad is six fans; only the top note's are bone, the rest
saturated red (a loud four-note chord in bone would be 11 % of the frame). A repeat is the same angle with a full
restart and the swing direction reversed, so different dashes glitter. A run is a hand ticking through angles, each step a whole
new set of dashes.

**(e) Knobs.**
- `fan`, how wide the light is, 0.4..2, 1. Left: two thin blades of light. Right: broad fans.
- `sway`, how much it sways, 0..2, 1. Left: rigid, the same dashes hold still. Right: it glitters through other dashes before settling.
- `dashes`, `less: 500`, how many dashes there are, 500..2400, 2400. Left: sparse scratches. Right: a fine sheen.
- `prism`, colour at the edge, 0..1, 0. Left: bone and red only. Right: a thin green and violet in the outer 3° of each fan, as silk really does.
- `touch`.

**(f) Not a recipe.** It is one fixed set of marks that nothing moves. The note only chooses which are lit. That is what light on
silk does.

**(g) State and drawing.** Stateless: walk `CHORDS`, read `θ(t)` and `θ(t − dt)`, binary-search the sorted dash list. While a fan
swings (the first 0.2 s), draw only the dashes newly lit this step, at `E(t)`; the ones already lit are carried by the canvas, and
get `alpha` when it stops returning 0. That is one stroke per live fan pair, from a few dozen to about 200 segments. Up to about 8
strokes and 1500 segments on the busiest frames; thin the older ones first.

**(h)** 2D.

**(i) Closest: ikeda,** for screen-wide hairlines on black on a strike. Ikeda is a grid of data in strict bands; this is one torn
gesture, and its angle is the pitch.

**(j) Danger: trap 4, and the ban on rings from a point.** Hairs are full alpha on the strike at 1.4 px and live under 0.7 s, so
8-bit rounding rarely meets them. The rings never expand and never show as rings, only as a bow-tie. If it reads as a circle or a
moiré at all, lower `dashes` and widen the gaps.

---

## 4. Beading (`beading`)

**(a) The natural thing.** Dew on silk. Water on a thread does not stay a coat: along its whole length at once it breaks into beads
at a spacing fixed by its thickness (Plateau–Rayleigh: spacing about 4.5 diameters, bead about 1.9 diameters), with a tiny
satellite between each pair. The thread between is too thin to see. So a thick line gives a few fat beads far apart, a thin line a
dense fine string of them. One number sets everything, and the pattern alternates big, tiny, big, tiny.

**(b) Texture.** Elastic: surface tension, the most elastic thing in nature, with a hard round edge.

**(c) One picked note.** On the attack step, a flat bar, length `lerp(1100, 220, u)`, thickness `w = lerp(34, 3, u)·(0.6 +
0.6·v/127)`, at a height by pitch, tilted a seeded ±5°. Saturated red, with a bone core in the middle third of its thickness (the
top note of a chord only, 1.6 % of the frame for a low note). It holds 2 steps. On step 3 the bar is no longer drawn, and in the same
place stands a row of hard discs: diameter `1.9w`, spacing `4.5w`, satellites `0.5w`. No slide, no gathering motion: a quick change
of state, as the real one is too fast to see. A loud low note gives 6 beads of about 76 px, 180 px apart; a high note gives about 18
beads of 5 px, 12 px apart. The canvas can't erase the bar (nothing halves faster than 0.09 s, and there is no black over-paint), so
it dies under the beads for about 0.2 s as a red ghost, which is the right picture: for an instant, beads strung on their own thread.
For the beads to read over it, they are drawn at `E(t)` directly on their new pixels in a pale hot red, no brighter than the bar was,
falling to red at 40 % by about 0.15 s, when the ghost is already lower. Each is lit by a thin paler crescent on the *lower* rim,
because a drop inverts what is above it. Each bead rings from oval to round, volume preserved,
`rx = R(1 + 0.25·e^(−t/0.07)·cos(2π·8t))`, `ry = R²/rx`, gone in 0.2 s. Satellites are cut at 0.25 s. Main beads hold and fade with
`E(t)`. Beads never swell. Pitch goes to thickness, so to bead size and count. Velocity goes to thickness too, more mildly.

**(d) Chord, repeat, run.** A chord stacks rows, and the interval is visible as a ratio of spacings. A repeat lands a new bar and a
new row shifted half a spacing, so if the old row is still lit, new beads fall between old ones and you can count: one row, two
rows. A run is many short fine strings, each 2 steps of bar and then pearls.

**(e) Knobs.**
- `thick`, how thick the line, 0.4..2, 1. Left: thin lines, many fine pearls. Right: few huge beads.
- `small`, the small beads between, 0..1, 1. Left: big beads only. Right: a tiny bead between each pair.
- `hold`, how long the line holds, 0.033..0.12 s, 0.033. Left: beads at once. Right: the bar lasts a moment longer, while its brightness falls.
- `ring`, `less: 0.25`, how long the beads stay.
- `touch`.

**(f) Not a recipe.** Nothing flies. The specific decision is the law: a single thickness sets size and spacing, so you learn to
read register off how a row is spaced.

**(g) State and drawing.** Stateless from `CHORDS`, seeded per pitch. Bars for 2 steps, then discs as batched `ellipse` calls, one
fill per note; crescents as sprites (one per size bucket), only on main beads above 16 px. At most 25 live notes × 24 beads: about
25 fills and 150 sprites on a heavy frame.

**(h)** 2D.

**(i) Closest: kusama** (dots on a field) and honey (beads running down threads). Kusama's dots are a pattern, these are one note's
line. Honey's beads travel and pool; these never leave their place.

**(j) Danger: trap 2, "too suggestive", and fake attacks.** The bar-to-beads cut happens inside the attack, and `hold` is capped at
0.12 s so it can't read as a second event. The oval ring is small and gone in 0.2 s. No drop ever swells or hangs. All rows stay
close to horizontal, none tall.

---

## 5. Fist of spines (`urchin`)

**(a) The natural thing.** A sea urchin's spines sit on ball joints. Poke one spot and the spines around it swing **toward** the
poke, their tips closing on it. Threatened things in nature flee or curl; this turns all its points on you.

**(b) Texture.** Sharp + elastic: hard needles on a springy joint. Pivots never move.

**(c) One picked note.** A flat field: 240 pivots on a jittered 64 px grid, each with a needle: a filled triangle, base 3.5 px,
length about 44 px, tip 0. At rest they lie along a slow, seeded nap, in dark red at 0.24, redrawn each step through `settles` as
ground. The note has a target spot: x by pitch, y seeded by pitch class within ±0.3H (octaves share a height). On the attack step
every needle within `R = 180 + 360·(v/127)^1.2` px turns to point exactly at the spot, in that one step, and stabs: length ×1.5,
overshoot 12° in a per-needle direction, ringing `e^(−t/0.06)·cos(2π·8t)`. Brightness `E(t)·(0.35 + 0.65·(1 − d/R))`, bone near the
spot and red at the rim. Tips stop short of the spot by `10 + 18·v/127` px: **the spot itself stays black**, a clean point of
nothing surrounded by tips. There is no hold on the aim: from the strike on they are already lying back toward the nap, all together
with one time constant (τ 0.2 s), no front and no staged second stage, at a brightness already falling back to ground. Pitch goes
to the spot, velocity to how far the call reaches.

**(d) Chord, repeat, run.** In a chord, each needle turns to the nearest note whose reach covers it, so the borders between two
fists are sharp lines where neighbouring needles disagree. A repeat finds them already aimed: nothing turns, but the stab and the
flash restart at full, a clench. A run of neighbouring notes makes the field snap a few degrees at a time, a shudder of attention
the eye follows across the screen.

**(e) Knobs.**
- `reach`, how far the call reaches, 0.3..2, 1. Left: a small tight fist. Right: half the screen turns.
- `spines`, `less: 50`, how many spines, 50..600, 240. Left: few, long, well apart (length follows spacing). Right: dense, short stubble.
- `stab`, how hard they stab, 0..1, 0.7. Left: they only turn. Right: they jab past their length and snap back.
- `ring`, `less: 0.25`, how long they take to lie back and how long the fist stays lit.
- `ground`, how much the field shows at rest, 0..0.35, 0.24. Left: only the fist. Right: the nap is always visible.

**(f) Not a recipe.** It sounds like "N needles that do X", so here is the test: they don't travel, they don't spawn, they only
turn around a fixed base, and the point of the picture is an empty spot. Take the hole away and it is an iron-filings diagram; with
it, every note is a place you would not want to put a finger.

**(g) State and drawing.** Stateless and simple: for each needle, search back for the newest chord note that reached it (the jump is
total, so nothing earlier matters) and compute angle and length from `t`. 240 needles × at most 8 chords a frame. One batched path of
triangles per brightness bucket: 6 fills, 240 triangles.

**(h)** 2D.

**(i) Closest: flee** (needles and shapes that bolt) and gust (tapered slivers shoved through air). Those translate, away. These
never leave their pivot and they turn toward.

**(j) Danger: recipe, and fake attacks in the lying back.** The lying back is a change of state between notes, so it has one shared
time constant and no front, and it stays well under the flash's brightness. Fine tips: base 3.5 px and full alpha near the spot; rim
needles are allowed to be dim.

---

## 6. Bristling (`bristle`)

**(a) The natural thing.** A hedgehog at rest is combed: every spine lies along one direction, and you could stroke it. One muscle
contracts and the *same spines* stand up and cross every which way. Nothing is added. The surface changes from sheen to hostile in
one move. From two metres it is fuzz; from twenty centimetres, needles.

**(b) Texture.** Fuzzy against sharp: a flip between them, on the note. The texture is the whole event; you could read a note here
with no change in brightness at all.

**(c) One picked note.** Three full-frame sprites made in `reset` from the same 5000 base points. Sheet A: 1.3 px hairs of 22..40 px
all along a slowly bending nap (±25°): combed. Sheets B1 and B2: the same points, lengths ×0.6, tapered, at a random ±90° to the nap
(seeded differently): crossed. Ground: A in a dark red-brown, through `settles(0.25)`, one `drawImage` each step. No outline, no
body, nothing but a flat field of nap. On the attack step, an irregular 18-sided patch, radius `60 + 200·(v/127)^1.2` px with ±30 %
noise, x by pitch, y seeded by pitch class; `clip` to it and draw B, bright hairs over the dim combed ones, for 2 steps. Crossed hairs
cover about 22 % of any area, so a patch at full velocity is already 5 % of the frame in bone: the bone budget above is load-bearing
here. A hard cut: the coat is simply crossed there. Then B in red under `E(t)`, half-life 0.2 s, gone by about 0.8 s; the combed
ground never left. No growth, no spreading, patch and hairs stand still. Pitch goes to the place, velocity to the size of the patch.

**(d) Chord, repeat, run.** Each chord note has its own patch, the top note's in bone and the rest in saturated red; overlaps double
up. A repeat takes the other sheet (B1, B2, B1), so a restart isn't the same hairs: same place, fresh bristle, at full. A run is a
row of patches stepping across.

**(e) Knobs.**
- `reach`, how big a patch, 0.4..2, 1. Left: a small prickly spot. Right: a third of the coat stands up.
- `cross`, how wild, 0..1, 1. Left: hairs lift only a little from the nap. Right: they cross any way at all. (Snaps to 3 levels.)
- `coat`, `less: 800`, how many hairs, 800..8000, 5000. Left: sparse strokes. Right: a thick nap. (Snaps to 6 levels.)
- `calm`, how much coat shows between notes, 0..0.4, 0.25. Left: nothing but the bristle. Right: the combed nap is always there.
- `ring`, `less: 0.25`.

**(f) Not a recipe.** Everything is a cut between two pre-rendered states of the same hairs. There is no physics at all, and no
individual hair animates. It lives on one observation: same spines, opposite texture.

**(g) State and drawing.** Stateless from `CHORDS`. 1 `drawImage` for ground, 1 `clip` plus `drawImage` per live patch, at most 25.
One set of sheets exists at a time, never one per knob level: three 1280×720 sheets, B in two colours, so five canvases and about
20 MB. Hairs are shuffled, so `coat` draws a prefix of the same hairs; a change of `coat` or `cross` level rebuilds them in a few
milliseconds. Very cheap at run time.

**(h)** 2D.

**(i) Closest: halftone** (a field of small marks that react in a spot). Halftone's dots swell in a wave; here nothing grows or
travels, and the only change is direction. Also not honey, not vine: no bodies.

**(j) Danger: trap 1 and trap 4.** Fuzz with no blur at all: individually sharp hairs. The ground is near the rounding limit, so
1.3 px and a colour bright enough that 0.25 stays above it (at least 50/255 before antialiasing). Patch edges cut hairs bluntly,
which is why the outline is noisy: a tidy circle would look like a stencil.

---

## 7. Areoles (`areole`)

**(a) The natural thing.** A cactus. Its spines come in fixed clusters on a strict lattice, and a cluster isn't a neat star: a long
central spine, a few medium ones, and a comb of short radials lying flat with a gap on one side. Every spine rises hard out of a
small soft pad of felt. The order is rigid, the clusters are not regular, and from far away the whole thing is a haze.

**(b) Texture.** Rigid + sharp, with a touch of fuzz at the root. Nothing moves, ever: the opposite of everything elastic in this
corner.

**(c) One picked note.** A fixed flat lattice, offset like bricks: 12 columns (pitch class) by 7 rows (octave), about 106 by 103 px,
nothing there until a note. No column or body is drawn. Each pitch class owns one star, seeded: one central spine at 90..130 px (it
reaches into the next cell), 1..3 medium, and 8..14 radials of 22..44 px, spread unevenly with a gap on one side. **The same pitch
class always gives the same star**; register only scales it (low long and heavy, high small and fine). So the eye learns C. A spine
is a filled triangle, base 3 px, tip 0. On the attack step the whole star is there at full length, in bone, 2 steps, on a pad of
about 30 hairs of 3..6 px in red. Then red, `E(t)`. At 0.35 s the radials cut out in one step while brightness falls, and the central
spine stays alone until the end of `E`, about 1 s. Velocity scales spine length ×0.55..1.15 from the same centre. It never moves,
eases or overshoots.

**(d) Chord, repeat, run.** A chord lights several stars; central spines cross into neighbouring cells and their tips nearly touch,
which is where it gets prickly. An octave is the same star twice, one above the other. A repeat is the identical star restarting at
full: flash, dim, flash, nothing else. Rigid, and countable. A dense passage fills up with hard stars until it reads as a haze:
fuzz made of nothing but needles.

**(e) Knobs.**
- `spines`, `less: 3`, how many spines a star has, 3..16, 12. Left: a central spine and two others. Right: a dense comb.
- `length`, how long, 0.5..1.6, 1. Left: stubs inside their cell. Right: long spines through their neighbours.
- `felt`, the soft pad at the root, 0..1, 0.6. Left: bare needles. Right: a visible tuft under each star.
- `ring`, `less: 0.25`.
- `touch`.

**(f) Not a recipe.** Stars on a grid would be decoration; a fingerprint per pitch class is a notation you learn by eye and ear. The
comb with a gap on one side is what keeps them from looking like asterisks or fireworks.

**(g) State and drawing.** Stateless from `CHORDS`. At most 40 live stars × 15 triangles in about 4 buckets: 600 triangles, 4 fills.
Pads: a single small sprite in 3 variants.

**(h)** 2D.

**(i) Closest: ikeda,** whose same-note-same-barcode is the same idea in data. And fireworks, which moves outward from a point; a star
here never moves and is there whole or not at all.

**(j) Danger: traps 5 and 3.** Spines at full length on the attack step, never grown. Radials go in one cut while brightness is
falling, with no brightening, so it isn't an event. Fine tips only need to be strong at the peak; the central spine carries the body
because it is the only part wide enough to survive at low alpha.

---

## 8. Prickle (`prickle`)

**(a) The natural thing.** A rose prickle or a hawthorn. A thorn is not a wedge. Its sides are concave: a very broad base flowing
away from the stem, a sudden waist, then a last part thinner than seems possible, slightly hooked back. A straight-sided wedge is an
arrow; concave sides are what make the eye flinch.

**(b) Texture.** Rigid + sharp, at the largest scale: flat masses the size of the screen, ending in a hairline.

**(c) One picked note.** One huge flat thorn. Base off the frame's left or right edge (never the bottom), half-width `b = 180 px` by
default, tip at a height by pitch and at x = 0.35..0.85W by velocity, axis tilted up to ±20°. Each side is one quadratic Bézier from
base corner to tip with its control at 72 % along the axis, 2 px off it. For a 900 px thorn that gives a width of about 92 px at 61 %
of its length, 16 px at 87 %, and **under 2 px over the last 30 px**. The tip is bent 12° (the hook), so the two sides differ. On the
attack step it is simply there, whole: saturated red, with the last 30 % of its length in bone for 2 steps (under 1 % of the frame).
No slide, no overshoot, no bend. Then the body drops to dark red at 40 % and holds still. When the next note lands, the old one
withdraws straight back along its axis, full speed at once, `d·(1 − e^(−t/0.08))`, as in handover. With no next note, it fades out
within `goneBy`. Sides alternate: left, right, left.

**(d) Chord, repeat, run.** All thorns of a chord aim at one shared point with 6 px gaps between their tips, from both sides: one spot
stabbed from several directions, and the gaps are the tension. A repeat comes from the other side to the same spot, at full. For a
run, base width follows the time to the next chord (from `CHORDS`): `b·clamp(gap/0.5, 0.08, 1)`. A semiquaver is a needle, a long note
is a slab; the eye can still count at 12 notes a second.

**(e) Knobs.**
- `waist`, how thin the waist, 0..1, 0.85. Left: a straight-sided wedge. Right: a slim waist and a long hairline tip. (This is the texture knob.)
- `broad`, how broad the base, 0.3..1.5, 1. Left: all needles. Right: slabs that fill a quarter of the frame.
- `hook`, how bent the tip, 0..1, 0.5. Left: dead straight. Right: a claw.
- `goneBy`, `less: 0.3`, gone by, 0.3..2.5 s, 1.2. Left: a thorn never lasts a third of a second, even with no next note. Right: a lone note may stay two and a half seconds.
- `touch`.

**(f) Not a recipe.** One object per note, a hand-specified curve, and the whole idea hangs on one profile: concave sides a viewer
feels in the fingertip.

**(g) State and drawing.** Stateless: only the current chord's thorns and the one or two still withdrawing. About 1..8 fills per
frame, with a clip for the bone tip. One of the cheapest here.

**(h)** 2D. Antialiasing does the hairline.

**(i) Closest: handover** (a slab per note, withdrawn as the next lands; I keep that) and blade (a wedge, rejected as dim and
over-explained). Unlike handover the outline is the point; unlike blade there's no roll or playhead, and it's the brightest thing on
screen on its step. Gust's slivers shred and travel; these do neither.

**(j) Danger: "too suggestive", and blade's dimness.** A tall shape rising from the bottom is the user's word waiting to happen, so
thorns come only from the sides, tilted, hooked, and they never swell or tremble. Rigid means no ring. Bone tip plus saturated red on
the strike keep it from being dim.

---

**My pick: Load path (`tensile`), because in one step a single struck thread lights its whole load path and flips the other threads between ruler-straight and hanging: elastic and sharp in the same picture, and something you only know from looking at real silk.**
