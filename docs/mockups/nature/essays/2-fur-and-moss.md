# Fur and moss

Looked at closely, fur is only fur at its edge: in the middle of a pelt you see tone, and the tone depends on which way the
hair lies, so a mark in velvet is a change of direction with no change of material. Hair does not grow when an animal is
alarmed, it rotates about its root, and the fastest thing a hide ever does, a horse shaking off a fly, moves one patch with a
hard boundary while the skin beside it stays dead still. Moss and lichen do the opposite of moving: moss gives under a thumb and
comes back, some kinds go from grey to vivid within seconds of getting wet, and a lichen only ever adds to its rim and stops dead
at a black line where it meets a neighbour.

My answer to "fuzz that still snaps": softness lives in the **count and direction** of the fibres, never in their edges. Every
fibre below is sharp from the first step, and a whole surface of them is a baked sprite, so it can appear or jump as one object.

Shorthand used in all the ideas:

- `t = x.t − ch.t`, always. `P = 0.35 + 0.65·(v/127)^1.5` on picks (floor 0.12 otherwise).
- `flash(t) = 1` for `t < 0.033`, then `0.5^((t − 0.033)/0.06)`.
- `alpha(T, Tprev)` is the brief's correction. `settles(E) = 0.12E/(1 − 0.88E)` holds a redrawn mark at E.
- **A hair** is a filled triangle: root 1.5 to 3 px, point 0, all of them in one path. A stroked line does not taper, and a
  1-px line at low alpha dies in the fade. A taper reaches a true point, and it is drawn at full alpha only while it is on the
  strike, then not drawn at all.
- Baked grain is bright fibres on black (values 90 to 255). Held at a low alpha it stays pixel-locked, so it keeps its structure,
  but values much darker than that get eaten by rounding.

---

## 1. Nap (`nap`)

**(a) The natural thing.** Black velvet stroked with a finger. Observation: the mark is the same material lying the other way, it
has a sharp edge, it stays until touched again, and **stroking the same place back removes it**.

**(b) Texture.** Fuzzy, with a sharp edge. The main thing the eye gets is a fine pile with a cut boundary.

**(c) One picked note.** The black of the canvas is the velvet and is never drawn. A note strokes one band into it, and there are
three layers in the attack's own step:

1. The *field*: every remembered band in one path, filled once with `fill('evenodd')` using a pile pattern (a 512² tile with about
   10 000 hairs of 5 to 11 px, all lying the same way, dull oxblood going to pale rose at the tips). Held at `settles(F)`, F = 0.32.
2. The *strike*: the new band alone, filled with a hotter copy of the pile at `T = 0.7·P·flash(t)`. It lights whether the stroke
   turned the band on or off.
3. The *hairs*: about 360 tapered hairs of 10 to 26 px, 240 along the two long edges and 120 inside, in bone at `T = P·flash(t)`,
   leaning up-right if the melody rose to this note, down-left if it fell.

Pitch sets the place: band centre `x = W·(0.06 + 0.88u)`, tilt from pitch class by fifths, `((m·7 mod 12) − 5.5)/5.5 · 28°`, so
neighbouring semitones cross instead of lying parallel. Velocity sets width (46 to 136 px, wider in the bass, ×1.3 at the bottom
down to ×0.7 at the top) and length (55 % to 115 % of H). The band is a slightly bowed quad with toothed edges: one tooth per 6 px,
3 to 9 px deep, leaning with the pile, so the edge is cut fibre rather than a clean polygon.

Over the next second: hairs and strike are gone by 0.2 s and stop being drawn. The band sits flat at 0.32. Nothing else moves.

**(d) Chord, repeat, run.** A chord strokes all its bands in one step. Because of evenodd the crossings come out black, so a chord
is a lattice at once. A repeat of the same pitch lands on exactly the same band and **turns it off**: the flash lands at full, the
body drops to black through the fade in about 0.3 s, and the third repeat turns it on. Counting is on, off, on. A softer repeat is
narrower, so it leaves two lit slivers along the edges of the old band: you can see the difference in touch. In a run every note
gets its strike and hairs. A note under 70 ms after the previous one gets those but does not flip the field, which stops strobing
and still lands every note.

**(e) Knobs.**
- `memory`, "how many strokes it remembers", 1..16 step 1, default 7, `less: 1`. Left: only the last stroke is there. Right: sixteen
  strokes cut through each other. When a new one lands, the oldest leaves on that same step.
- `width`, "how broad the finger", 0.5..1.6, default 1. Left: thin scratches. Right: broad swathes.
- `slant`, "how much the strokes cross", 0..1, default 0.7. Left: all upright, side by side. Right: steep diagonals crossing.
- `rest`, "how long it stays lit in silence", 1..12 s, default 4. Left: the field goes dark soon after the music stops. Right: it
  holds through long rests.
- `cloth`, "which cloth", 0..2 step 1, default 0 (oxblood, moss, slate). Left: dark red. Right: blue-grey.
- `presence`, leads `memory`.

**(f) Not a recipe.** Three decisions: the velvet itself is never drawn, the second touch erases the first, and the picture changes
**only on notes**. It is the only state widget here where a repeat is an off switch.

**(g) State and drawing.** Stateless. Memoised on `CHORDS`: a `strokes[]` array with time, pitch, width, length, direction. On picks,
one per note; otherwise the chord's top note with a minimum gap of 0.12 s. `frame` binary-searches the last stroke at or before
`x.t`, takes `memory` back, and rebuilds one combined `Path2D` only when that index changes. Each band's outline is cached per
pitch and width bucket. `F = 0.32·min(1, 0.5^((gap − 1.5)/(rest/3)))`, where gap is the time since the last stroke; below 0.12 it
stops being drawn and the fade finishes it. Draw count: 1 pattern fill, plus for each band under 0.2 s old 1 pattern fill and 1
hair path. Usually 1 to 7 fills. Sprites: two 512² tiles, baked once.

**(h) 2D.** `evenodd` and `createPattern` do all of it.

**(i) Closest.** Kline (one huge stroke per attack) and handover (the picture only changes on notes). Kline lays ink on a ground and
strokes pile up; here strokes cancel, and there is no ink, only pile. Handover has no memory; this has a memory you can read.

**(j) Danger.** Trap 1 (fuzz against crisp) and trap 6. The field is grain, never blur, and the slow thing, the worn cloth, is only
the ground. A second danger is op-art: evenodd bands could turn into Riley stripes. The tilt by fifths and the 512² tile, big enough
not to show a period, keep it off.

---

## 2. Twitch (`twitch`)

**(a) The natural thing.** A horse or cow shaking off a fly. Observation: the movement is under a tenth of a second and it is
**local with a hard boundary**. One patch jolts, the fur on it jumps, and the hide a finger away does not move. No ripple leaves
the patch. It is the one fast thing in this corner.

**(b) Texture.** Fuzzy and elastic. It answers the brief's hard problem head on: a fuzzy thing with an elastic body that snaps.

**(c) One picked note.** The hide is one baked 1280×720 sprite: about 40 000 fibres, 6 to 14 px, on a slow direction field that
never animates. It sits on the canvas at T = 0.22, composited `lighter` so it does not hide other clips. A note picks a patch: an
irregular polygon of 7 to 11 corners, 150 to 420 px across (bass larger), toothed with fibre-length notches. Pitch sets x, and a hash
of pitch sets y, so the same pitch is always the same patch. In the attack step, inside the clip of that polygon, the hide is drawn
again **offset along the local nap** by the full amplitude A (8 to 22 px by velocity), from a hot copy of the sprite at `T = P`. The
offset makes the fibres mismatch at the patch's border, so a hard seam appears with no line drawn: the boundary is only the shear.

Over the next 0.2 s the offset rings: `A·e^(−t/0.05)·cos(2π·14·t)`. The canvas ghost of the previous offset doubles the fibres while
it shakes, so the patch is fuzziest when moving and sharp again at rest. Brightness only falls: `E = P·(0.6·flash(t) + 0.4·0.5^(t/0.2))`,
and by 0.6 s the patch is the hide again.

**(d) Chord, repeat, run.** A chord jolts several patches at once; each has its own clip and they overlap freely. A repeat jolts the
same patch at full again, in the opposite direction (the sign alternates by chord index). In a fast run 4 to 6 patches are live at
once, each one a clip and a drawImage, which is cheap.

**(e) Knobs.**
- `size`, "how big a patch", 0.4..1.6, default 1. Left: a small flinch. Right: a whole flank.
- `hard`, "how hard it jolts", 0..1.6, default 1. Left: the patch only lights. Right: it jumps 35 px and shakes.
- `stays`, "how long a patch stays lit", 0.2..2 s, default 0.6, `less: 0.2`. Left: a blink. Right: it glows a while after shaking.
- `chordn`, "how many patches a chord moves", 1..6 step 1, default 4, `less: 1`. Left: only its loudest note. Right: nearly all.
- `hide`, "how much hide you see at rest", 0..0.35, default 0.22. Left: black; only touched patches exist. Right: a full dark pelt.
- `presence`, leads `stays` and `chordn`.

**(f) Not a recipe.** No particle moves. A single baked surface is shifted inside a cut-out, and the boundary you see is only the place
where two copies of the same fur disagree. The observation it rests on (hard boundary, no ripple) is the reverse of what a designer
would draw for "fur reacting", which would be a wave.

**(g) State and drawing.** Stateless: in `frame`, walk back over `CHORDS` while `t < stays + 0.1`. Patch shape is a seeded function of
pitch. Draw count: 1 hide drawImage plus, per live patch, 1 clip and 1 drawImage, so 3 to 13 calls. Sprites: the hide and its hot copy,
1280×720, baked once in `reset` from a local seeded generator, about 40 000 hairs in 4 tone buckets, a one-off cost of tens of ms.

**(h) 2D.** Clip and drawImage are enough.

**(i) Closest.** Squares-snap (a big dark form that cracks on the attack). This has the same weight and the same dark red, but it is a
window onto a surface that shakes, not a form placed on black. Gust shoves air with wedges; nothing here travels.

**(j) Danger.** Trap 2 (the rebound reading as a second note). The ring is under 0.2 s and brightness never rises. And P12: patches
can be 13 % of the frame, so they go red-hot rather than toward white, and only those under 6 % of the frame get a bone tint.

---

## 3. Furred forms (`furred`)

**(a) The natural thing.** Peach skin and velvet on a curved surface. Observation: a hard shiny object is brightest in the middle and
dark at the rim; a fuzzy one is the **reverse**, dark in the middle and lit at its silhouette, because at the edge you look along
the hairs. It is the single fact that tells your eye "fuzzy" with no fibres visible in the body at all.

**(b) Texture.** Fuzzy and rigid: a hard, flat, cut-out form dressed in fur at its edge only.

**(c) One picked note.** One form per note, chosen from 6 hand-drawn biomorphic outlines by hash of pitch class. Height on screen from
pitch. Size from register: bass 180 to 420 px, top 40 to 120 px. x walks across the page in note order by a golden-ratio step. In the
attack step, the inside is filled once at alpha 0.9 in a near-black of the form's hue. Over it, the rim sprite at stance 0: 120 to
250 hairs standing **straight out** of the outline, 26 to 44 px, roots at the colour of the form, tips bone, at `T = P`. The form jumps
1.08 in size and rings (`1 + 0.08·e^(−t/0.07)·cos(2π·8·t)`, only for loud notes), and its shape stays rigid.

Over the next second the hairs lie down. Three baked stances, out (0), leaning 45° (1), lying along the outline (2), step by time:
0 until 0.05 s, 1 until 0.14 s, 2 after. Brightness falls `T = P·(0.65·flash + 0.35·0.5^(t/0.5))`. What is left is a dark shape with a
smooth pale nap around it, at about 0.25, until `stays`.

**(d) Chord, repeat, run.** A chord lands all its forms at once, and each new interior covers what is behind it, so forms stack like cut
paper and hide older rims. A repeat of the pitch comes back on the same form at the same place while that form is still alive: its hair
**stands straight out again** at full. That is what a count looks like here, one form bristling three times. A fast run makes small
high forms, each one a burst of points; this is where it sparkles.

**(e) Knobs.**
- `hair`, "how long the hair", 10..60 px, default 32. Left: a short plush edge. Right: long spikes.
- `lies`, "how fast the hair lies down", 0.08..0.6 s, default 0.14. Left: instant. Right: it stays up a moment.
- `forms`, "how many forms stay", 1..24 step 1, default 8, `less: 1`. Left: only the latest form. Right: a whole page.
- `big`, "how big the forms", 0.5..1.5, default 1. Left: small signs. Right: large shapes.
- `dress`, "which colours", 0..2 step 1, default 0 (oxblood, peach, moss). Left: dark red. Right: dark green.
- `presence`, leads `forms`.

**(f) Not a recipe.** The inside of the form is empty of fur. All the fuzz is in a band 40 px wide, and it is the reverse of normal
lighting, which is the one thing that makes a viewer say "fur" and not "glow". Think of Meret Oppenheim's fur-lined cup: a hard object
in a soft coat.

**(g) State and drawing.** Stateless: forms are a list from `CHORDS`; `frame` draws the last `forms` of them. Per form: 1 path fill, 1
drawImage (2 when stepping stance). 10 to 25 calls. Sprites: 3 stances × 6 outlines × 1 palette, 512² each, baked lazily (hair is baked
at the largest size and only ever scaled down, so it stays sharp). Hair length changes rebuild, quantised to 6 steps.

**(h) 2D.** Pre-baked hair and drawImage. No need for a shader.

**(i) Closest.** Matisse and Miró for the cut-out and biomorphic form, flee for a hard shape that reacts. Those are defined by their
fill colour or pen; here the fill is near-black and everything you read is the fringe.

**(j) Danger.** Trap 1. A rim of light could easily be a shadowBlur, and that would make it a neon sign. No blur at all, ever: a rim of
separate hairs. The local dark fill covers other clips inside the form, the cost of the cut-paper look. A builder should test it in a
layered scene and, if it hurts, drop the fill to 0.5.

---

## 4. Hackles (`hackles`)

**(a) The natural thing.** The ridge of a scared dog's back. Observations: the hair does not grow, it rotates, so a thin flat line
becomes a wall without any hair getting longer; and raised fur **clumps into points**, several hairs meeting at one tip, so an
alarmed coat is spiky rather than evenly fluffy.

**(b) Texture.** Sharp and elastic: sharp points on elastic stems.

**(c) One picked note.** At rest there is one hard thin line across the screen, at about 62 % of H, with a slight slope and bend: flat
hairs seen from the side, 3 px thick, redrawn at T = 0.22. Pitch sets the place along the line. The note raises a stretch of it, 60 to
320 px long by velocity, at once. The stretch is made of **clumps**: 5 to 9 neighbouring hairs meeting at one tip, so each clump is a
sharp tooth. Hair length by register: 40 px at the top to 200 px in the bass, ±35 % by clump, tapered to nothing at the two ends of the
stretch. In the attack step every hair in the stretch is already at full angle, roots dim, the top 30 % of each hair bone (each hair is
two segments in two colour buckets), at `T = P`.

Next second: angle `θ(t)` overshoots past upright by 12° and comes back within 0.12 s (position may ring), then lies down in the nap's
direction over about 0.6 s, each clump with ±20 % of its own rate so nothing runs along the line. Since length stays fixed, the tips
sweep an arc and fall onto the line. Brightness: `T = P·(0.6·flash + 0.4·0.5^(t/0.25))`.

**(d) Chord, repeat, run.** A chord raises separate ridges in one step; where they overlap, each clump belongs to the newest mark (never
a max). A repeat snaps the same stretch upright at full from wherever it had fallen to, so a repeated note is seen as a slap upright.
Nap direction comes from melody: rising melody lays hair forward, falling lays it back, so a run combs the line in one direction, while
an oscillating figure makes it stir. A fast run raises many short thin ridges; it holds up well.

**(e) Knobs.**
- `span`, "how much of the back stands", 0.3..2, default 1, `less: 0.3`. Left: a short tuft. Right: a long stretch.
- `long`, "how long the hair", 0.4..2, default 1. Left: low stubble. Right: spears.
- `lie`, "how fast it lies down", 0.15..1.5 s, default 0.6. Left: gone at once. Right: it stays up.
- `clump`, "how much the hair clumps", 0..1, default 0.7. Left: separate needles. Right: hard teeth of many hairs.
- `coat`, "which coat", 0..2 step 1, default 0 (bone and oxblood, ash, rust). Left: red. Right: rust.
- `presence`, leads `span`.

**(f) Not a recipe.** The clumping and the fixed hair length. A plain version would be a spectrum bar chart. Teeth with a shared tip, and
tips that sweep an arc as they lie down (a rotation, not a shrink), are why it reads as an animal's reaction and not a meter.

**(g) State and drawing.** `onChord` not needed; marks are walked back from `CHORDS` by `lie`. Clump layout is a seeded function of place
along the line. Per frame: 1 sprite for the flat line, plus 2 triangle paths (root colour, tip colour) with at most about 600 hairs. Up to
about 3 fills, at most about 1200 triangles, batched. No per-hair stroke.

**(h) 2D.** Batched triangles are cheap enough.

**(i) Closest.** Ridges (peaks as tall as loud) and hammer (a thin line, struck). Ridges are stacked hills of history; here there is one
line, no history, and needles that rotate. Hammer's line rings as a whole; this one stays straight and sprouts.

**(j) Danger.** "Too suggestive" and trap 2. A tall thing that rises could read that way, so no ridge swells or trembles after its first
0.12 s: it only falls, and it is a crowd of needles, not one shape. The overshoot is a fixed 12° and dead by 0.12 s, small next to the
attack.

---

## 5. Setae (`setae`)

**(a) The natural thing.** The tufts on a tussock caterpillar. Observation: the hairs are stiff and do not bend; **only the body bends**,
and a tuft splays where the body arches and closes where it curls. Rigid hairs on an elastic line, and the shape of the tufts tells you
the shape of the line without it being drawn.

**(b) Texture.** Rigid and elastic, sharp at the tips.

**(c) One picked note.** One tuft per picked note, and the tufts stay in a row: left to right in note order, spaced by `0.84·W/N` where N
comes from `CHORDS` (at most 60, thinned to the loud ones like Ivory otherwise). The tuft's root sits at a height from pitch. The body is
an **undrawn** curve through all roots, so the melody is the body. A tuft is 7 to 15 tapered needles from one point, 70 to 240 px long by
velocity, perpendicular to the curve. **Its fan width comes from the curve's bend at that note**: a smooth stepwise line gives a closed
brush of 10°; a sharp turn in the melody opens it to as much as 110° on the outer side. In the attack step the new tuft is at full length
in bone at `T = P`.

Next second: new tuft drops to its body colour at about 0.35 by `T = P·(0.6·flash + 0.4·0.5^(t/0.3))`. Its arrival also jolts the body:
the previous tufts swing by `±A·e^(−d/3)·e^(−t/0.07)·cos(2π·10·t)`, with d the distance in notes and A at most 14°, all at once. The hairs
stay straight; they just wag from the root as a whole for 0.2 s, then stand still.

**(d) Chord, repeat, run.** A chord is one tuft at each pitch height at the same x step, so it stands as a vertical cluster. A repeat is a
new tuft beside the old one at the same height. The melody is flat there, so the fans are closed: repeated notes look like a row of
identical closed brushes, and you can count them. A run lays down a line of tufts; a run with turns visibly splays at its turns.

**(e) Knobs.**
- `needles`, "needles in each tuft", 3..21 step 1, default 11, `less: 3`. Left: a few thorns. Right: a dense brush.
- `long`, "how long the needles", 0.4..1.6, default 1. Left: short spines. Right: long hairs reaching across each other.
- `flinch`, "how much the old ones flinch", 0..1.5, default 1. Left: they stay rigid. Right: the neighbours wag hard.
- `splay`, "how much a turn opens the tuft", 0..1.5, default 1. Left: all brushes closed. Right: turns open into fans.
- `keep`, "how long the row stays", 0.5..20 s, default 8, `less: 0.5`. Left: only the newest tufts. Right: the whole line remains.
- `presence`, leads `needles` and `keep`.

**(f) Not a recipe.** The fan width is not random or velocity-driven: it reads the melody's curvature, so the look of each tuft carries
the shape of the phrase. A leap and a stepwise line look like different animals.

**(g) State and drawing.** Plan ahead from `CHORDS`, Ivory-style: every tuft's root, angle and fan are computed once. `frame` only computes
the swing and age. Per frame: all live tufts in 1 triangle path at body colour held at `settles(0.35)`, a second path for tufts under
0.2 s old in bone. 2 to 3 fills; at most about 660 triangles. No sprites.

**(h) 2D.** Batched triangles.

**(i) Closest.** Ivory (one object per picked note in a row, planned ahead) and calligraphy. Ivory's keys are smooth and upright; these are
hard bursts of lines, with shape from melody bend, not height. Fireworks are bursts but free in the air and fluid; this one is fixed, with
no expansion: the needles are at full length on step one.

**(j) Danger.** Trap 4 (fine and sharp against the fade) and expanding-burst looks. The needles are filled triangles 3 px at the root, not
1-px lines. Nothing grows from the root, ever: on step one it is at full length, so it cannot read as a ring or firework.

---

## 6. Cushion (`cushion`)

**(a) The natural thing.** A moss cushion under a thumb. Observations: pressed, its tips part and leave a dark dent with a dense bright
lip, and it comes back past level; and it can go from grey to vivid soon after water reaches it, the whole cushion at once, no front,
then dry back without any event.

**(b) Texture.** Fuzzy and elastic, a body made of thousands of small stiff tips.

**(c) One picked note.** 5 to 9 flat cushions lie across the screen, irregular with 3 to 5 lobes, never round and with a flat underside,
each baked from 300 to 900 tiny three-spoke ticks (6 to 10 px, sharp) in two copies: dry (ash-olive, value 90 to 170) and wet (acid
yellow-green, 150 to 255). Dry shows at T = 0.22. Register picks the cushion (bass cushions up to 460 px wide, top ones 90 px), and pitch
within it picks the dent's spot, off centre. In the attack step:

1. The whole cushion swaps to the wet copy at `T = 0.75·P`.
2. The sprite gets a hole cut by `clip('evenodd')`, radius 24 to 90 px by velocity. Ticks from inside that radius (about 40 to 250, stored
   per cushion) are redrawn **pushed outward**, full displacement in that step, `T = P`, in bone, packed into a dense lip.

Next second: the displacement rings `D·e^(−t/0.09)·cos(2π·7·t)`, so for a moment the ticks swing past home into the dent. Everything is back
by 0.22 s. The wet colour stays and dries slowly: crossfade to dry over `wet` seconds, flatly, the same at all points.

**(d) Chord, repeat, run.** A chord dents several cushions, or the same one twice. A repeat presses the same spot at full, and the lip snaps
out again. A cushion that keeps being played stays wet; one left alone goes grey. So the picture shows which register has been used lately,
slowly, under the fast dents. A fast run hops along one cushion, with a dent every step, and is cheap.

**(e) Knobs.**
- `deep`, "how deep the press", 0.2..1.5, default 1. Left: a light touch. Right: a deep hole.
- `wet`, "how long it stays wet", 0.3..6 s, default 2.5, `less: 0.3`. Left: it dries immediately. Right: it stays green through a phrase.
- `many`, "how many cushions", 3..12 step 1, default 7, `less: 3`. Left: three broad ones. Right: many small ones.
- `spring`, "how springy", 0..1, default 0.7. Left: comes straight back. Right: swings past and returns.
- `hues`, "which colours", 0..2 step 1, default 0 (moss, rust lichen, oxblood). Left: green. Right: dark red.
- `presence`, leads `wet` and `many`.

**(f) Not a recipe.** Only a few hundred ticks ever move, and they move as one lens around one dent. The other event, wetness, has no motion,
no front and no timing of its own. Two time scales in one surface: an instant wound, and a slow colour memory.

**(g) State and drawing.** Layout is a seeded function of knobs. Stateless: dents walked back by 0.25 s, wetness computed per cushion from the
last few chords in that register. Per frame: 1 drawImage per cushion (2 while drying), and per live dent 1 clip and 1 rect path (tick count
under about 750 in total). 10 to 25 calls. Sprites: 2 per cushion, baked at `reset`.

**(h) 2D.** Clipped sprites and rect batches.

**(i) Closest.** Halftone (dots swell in a wave) and kusama (dots). Those are regular and change size; here grains are irregular and sharp, stay
the same size and only get shoved aside. Honey's flat masses share the silhouettes, but honey sinks and never comes back; this springs.

**(j) Danger.** "Too suggestive" (a soft dome with a dent) and no expanding rings. Cushions are lobed and flat, the dent is off-centre and small next
to the cushion, and it does not travel: the lip is at its full place on step one. Trap 2 is covered by 0.22 s.

---

## 7. Map lichen (`lichen`)

**(a) The natural thing.** Map lichen on rock. Observations: it grows only at its rim, in lobes; its surface is a crust of tiny cracked tiles; and two
colonies never overlap, **each stops at a black line** where it meets the other, so the rock ends up as a map with hard borders.

**(b) Texture.** Rigid and sharp: a dry crust with hairline cracks, a stop with no give.

**(c) One picked note.** 3 to 5 colonies, one for each register, start from seeded places as small spots (and are otherwise not shown until first
played). A note adds **one lobe** to its colony, whole, in the attack step: a rounded thumb of radius 18 to 64 px by velocity, placed on the rim at
the angle set by the pitch class. Inside, an areolate crust: a pattern of tiles 8 to 14 px with cracks of 1.5 px cut in black. On that step the lobe
shows at `T = P` in the colony's hot colour with its rim and cracks in bone. By 0.2 s the bone is gone, and the lobe is the same as all others, at
T = 0.32. It does not move or grow. Nothing moves. Velocity is size; pitch is where on the rim and which colony.

**(d) Chord, repeat, run.** A chord adds several lobes in one step. A repeat of a pitch adds the next lobe **at the same angle**, on top of the last, so
repeated notes build a finger, one knuckle at a time: you can literally count them afterward. A fast run adds many small lobes in a shape that traces
the run: pitch classes cycle around the rim. It can't break, since each lobe is one fill on a note.

Where a lobe would cross another colony, it is cut with a 3-px black gutter on that step, by `destination-out` of the other's mask, dilated. Two colonies
pressing together make a hard black border.

**(e) Knobs.**
- `size`, "how big each lobe", 0.4..1.6, default 1. Left: small crumbs. Right: big thumbs that cover ground fast.
- `keep`, "how many lobes stay", 20..400 step 10, default 160, `less: 20`. Left: a small patch; the oldest leave as each note lands. Right: the whole
  rock fills up.
- `colonies`, "how many colonies", 1..6 step 1, default 3, `less: 1`. Left: one big growth. Right: six neighbours fighting for space.
- `crust`, "how coarse the crust", 0..1, default 0.4. Left: fine, almost a dust. Right: big cracked tiles.
- `rock`, "which colours", 0..2 step 1, default 0 (ochre and acid yellow, rust and ash, oxblood and bone). Left: mustard. Right: dark red.
- `presence`, leads `keep` and `colonies`.

**(f) Not a recipe.** No motion at all, ever. Nothing eases. Its one event is an addition, and a lobe's place is the decision: a pitch has an address on the
rim, so repeated notes make fingers and a melody writes a contour into a growing map. The black gutter comes from the real thing and gives Klee-like
hard partitions without any tiling.

**(g) State and drawing.** Deterministic replay from `CHORDS`, with a seeded per-chord rng. One offscreen mask per colony at half-size (640×360), stamped on
each note; on a seek backward, re-stamp from zero (at most `keep` fills, one-off). Per frame: 1 drawImage of the composite at `settles(0.32)`, plus for fresh
lobes 1 pattern fill and 1 stroke. 2 to 6 calls. When `keep` is exceeded, the colony is rebuilt on that note's step, with the oldest gone, so the removal is
an attack-step change, never between notes. Sprites: 1 crust tile per colour.

**(h) 2D.** Canvas masks, pattern fill and composites.

**(i) Closest.** Klee (a mosaic of tiles in rows) and cells (Voronoi, one per note). Klee writes along rows at tile size; here colonies grow outward from a
place as lobes and the crust is ten times finer than the unit that carries the note. Marbling and rorschach are soft and wet; this is dry and has no process.

**(j) Danger.** Trap 5 (growth against no fake attacks) and "no expanding rings". Growth is one lobe per note, whole, in a single step; nothing grows between
notes; the rim never runs round in a circle. It would also fail as "a picture of lichen" if it were realistic, so the colours are flat and the scale is big.

---

## Thrown out, so nobody else spends time on them

Parting, a line where fur splits and shows pale skin: a slit in fur is exactly what you think, and "too suggestive" would be the polite verdict. Mould
colonies: dark centre, white fuzzy rim, and that is an expanding ring. A caterpillar's crawl: a wave running down a body is a travelling front. Plum bloom
wiped by a finger: a weaker cousin of Nap, and its pale ground would hide every other clip.

**My best idea is Nap: the screen's own black is the velvet, each note strokes a band of pile into it and the same note strokes it out again, so fuzz becomes a countable on and off that only ever changes on a note.**
