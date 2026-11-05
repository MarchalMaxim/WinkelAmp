# Bark and stone

Looked at closely, nothing here is happening: stone and bark are the record of something that already happened, and they break
along planes that were there before the blow, so a fracture is a fact you find rather than a process you watch. Their sharpness
is never a property of a line but of two surfaces meeting (two scoops in flint make a point, a new crack meets an old one at a
dead right angle), and their surface colour is often not the colour underneath (pine is orange inside its grey, birch salmon
inside its white). One thing all these ideas share, a fact about our canvas rather than about rock: anything rigid that moves
leaves a ghost that takes 0.2 s to die, and that smear reads as softness, so the rigid ideas below either do not move at all or
move a flat shape along its own edges, where only the ends change pixels.

---

## 1. Mica (`mica`)

**(a) The natural thing.** Granite in low sun. The flat cleavage faces of mica flakes are mirrors, and flakes lying at the same
angle flash **together, all over the stone, in the same instant**, while the rest stays dead. Turn the stone a few degrees and a
completely different scatter lights. The stone did not change: the angle did.

**(b) Texture.** Rigid + sharp. Nothing in this widget ever moves, not by one pixel.

**(c) One picked note.** Each pitch owns a fixed set of about 192 flecks, the same every time it sounds. A fleck is a thin rhombus
with points at both ends, and **all flecks of one note lie at the same angle: pitch class × 15°**. So an octave is parallel, a
semitone is 15° off, a fifth is 105° off. Sizes follow a power law, 10 to 56 px long and a third as wide: a dozen big shards carry
the note from across the room and the rest are grain. They sit in about 16 clumps of 12, because real mica clots. Clumps are
spread over the full width, and vertically in a Gaussian around pitch height, σ = 120 px. Total area about 12,000 px², 1.3 % of the
frame.

Attack step: the whole set at full alpha in bone (236, 226, 208). Hold 2 steps. Then it drops through the `piano` curve to a body
in cold violet-grey (120, 112, 140) and is gone by about 0.8 s. No motion, no blur, no growth. Pitch: which angle and which height.
Velocity: how much of the set answers, as a prefix of a list sorted biggest first, 40 % at the softest and 100 % at the loudest, so a soft
note is the same stone seen less, and always has its big shards (P6). `amount` above 1 adds hot time per P4.

**(d) Chord, repeat, run.** A chord lights several sets at once: two or three hatchings at different angles, each legible as a
direction. You see the interval as an angle before you know why. A repeat is **the same constellation again**, at full, in the same
places: the eye recognises it the way the ear does, and counts it. A fast run is where it would break, and it does not: every step a
whole new scatter appears across the frame at a new angle, and the canvas floor keeps the previous few as dim residue underneath.
A scale becomes a turning.

**(e) Knobs.**
- `flecks`, "how many flakes", 40..400, default 192, **`less: 48`**. Left: a few big shards. Right: the frame is thick with glitter.
- `spread`, "how far from its height", 40..400 px, default 120. Left: a note glints in a band at its pitch. Right: it glints all over the frame.
- `size`, "how big the biggest flake", 16..90 px, default 56. Left: fine sparkle. Right: real splinters you could cut on.
- `ring`, "how long it stays", 0.25..3, default 1. Left: a glint and gone. Right: the flakes stay as a dim ash for seconds.
- `colour`, "which mineral", 0..2 step 1, default 0. Left: silver over violet. Middle: bone over feldspar rose. Right: pyrite gold over umber.

**(f) Not a recipe.** There are no particles because nothing travels, spawns or dies. The decision is that pitch is an *angle of a
hatching*, fixed per note, so that a note is recognisable as a pattern and the octave relation is visible as parallel.

**(g) State and drawing.** Stateless from `CHORDS`: walk back from the last chord ≤ `x.t` until L has passed. Each fleck set is one
`Path2D`, lazily built and cached by `m`, seeded with its own small generator from `m` (like Ivory's `rng`), not `x.rnd`, because the
same pitch must give the same stone after any seek. Drawn as `g.fill(path)` through `alpha(E(t), E(t-dt))`. Velocity prefix: keep 3
paths per note (40, 70, 100 %). About 2 to 12 fills a frame, up to 2,000 small polygons in total.

**(h) 2D.** One filled path per note. Nothing here needs a shader.

**(i) Closest.** Pointillism and Ikeda. Pointillism lays dots where a note falls and they pile up into a picture; Ikeda is a data grid
that pulses. Mica has no accumulation and no grid: the same irregular shards light again and again, and the only variable is an angle.

**(j) Trap.** 4, fine and sharp against the fade. Flecks are at least 1.5 px wide and drawn at full alpha only on the strike; the
smallest ones are allowed to die first (the 8-bit floor does it for us) and the big shards carry the body. P12 is safe by construction
(1.3 % per note; a ten-note chord is 13 % of scattered area in principle, so above 4 sets the flash colour goes to the mineral's own
tone and only the biggest 30 % of each set goes to bone).

---

## 2. Beds (`beds`)

**(a) The natural thing.** A road cutting through strata. Each bed is one event, its thickness is how long that event lasted, and
it lies dead flat on what came before. The one observation: **an angular unconformity.** Where deposition stopped for a long time,
the old beds were tilted and worn off, and new flat beds begin across their cut ends. The rock has a mark that means *a silence
happened here.*

**(b) Texture.** Rigid, and a rough grain inside each bed. Hard straight lines; the only thing that ever varies is the grain.

**(c) One picked note.** A bed appears on top of the stack, across the whole 1280 px width, in one step. Nothing else moves; the
stack grows upward from the bottom of the frame. Thickness comes from **the time until the next chord**, which `CHORDS` tells us: log
mapped, 0.05 s → 3 px, 2 s → 40 px. So a held note is visibly a thick bed at the moment it arrives. Colour comes from register: six
fixed earth tones from umber in the bass, through rust, ochre, slate and oxblood, to chalk in the treble. Velocity sets grain: soft is
shale (fine lines every 2 px), middle is silt (small speckle), loud is sandstone (angular 3 px grains).

Attack: a bone hairline along the bed's top edge, 2 to 5 px thick and the full width (at most 0.7 % of the frame), and the bed itself lit 55 % toward bone. The flash half-life is 0.06 s; the bed settles to T = 0.45 in its own tone
within 0.2 s and then stays. No drop, no settle, no ease.

**(d) Chord, repeat, run.** A chord is one bed divided into thin laminae, one per note, low note at the bottom, with a 1 px dark
bedding plane between them. A repeat is another bed in the same colour, separated by that same dark line: varves, and you can count
them with a finger. A fast run lays thin 3 to 4 px beds in register colours, a barcode that climbs in visible ratchet steps.

The **silence**: when the next chord comes after a gap longer than `silence`, or when the stack reaches 60 px from the top, then on
that attack and in that one step everything below tilts by a few degrees around the bottom centre, is cut off along a flat line at 55 %
of height, and the new bed lies across the cut ends. It is a jolt, and it happens on a note. A slow piece ends as a pile of angled
packages, one per phrase.

**(e) Knobs.**
- `silence`, "how long a silence must be to break the rock", 0.4..4 s, default 1.5. Left: every breath tilts the stack. Right: only real stops do.
- `thick`, "how thick a note lies", 0.5..2, default 1. Left: fine laminae, many notes on screen. Right: slabs, few notes on screen.
- `keep`, "how many old phrases stay", 1..5 step 1, default 3, **`less: 1`**. Left: only the phrase now, on one worn-off base. Right: a deep history of tilted packages.
- `tilt`, "how hard a silence tilts it", 0..25°, default 7. Left: flat, just a cut. Right: steep, and the angles collide.
- `fault`, "how hard a loud note cuts", 0..1, default 0.3. Left: none. Right: a loud note in the bass cuts one vertical line through all the beds at its pitch, and the right side drops up to 24 px, in one step.

**(f) Not a recipe.** The rest in the music, which every other widget has to treat as nothing, is here the most visible event in the
picture, and it lands on the note that ends the rest. That comes from one real thing in rock and one real thing in Rachmaninoff.

**(g) State and drawing.** A plan from `CHORDS`: per bed `{t, y, h, tone, grain, package}`. One 1280×720 offscreen holds what has been
laid so far. On an attack, blit the new strip into it from a lazily built strip cache (6 tones × 3 grains, each 1280×48). At an
unconformity, repaint the offscreen by redrawing every kept bed as a rotated rectangle (a few hundred fills, once, on that step,
so that rotations never compound and go soft). Seek backwards: clear and replay from the plan. Per frame: 1 `drawImage` at `settles(0.45)`
plus 1 to 4 flash rects.

**(h) 2D.** Straight rectangles. Hairlines must stay crisp, and that argues against resampling.

**(i) Closest.** Stella, which adds one frame per attack, and Ridges, stacked lines. Stella fades where it stands and has no memory; Ridges
draws a slice of the keyboard. Beds keeps everything, its thickness is duration, and only it has a mark for silence.

**(j) Trap.** 5, growth against no fake attacks: it never grows between notes, because the thickness is decided before the attack and
appears whole. The tilt ghost dies in 0.2 s and sits on a real attack, so it reads as a blow. It also risks being "explaining how it
works"; the grain and the earth tones have to carry mood, so the builder should judge it on Liebesleid, not a test scale.

---

## 3. Knap (`knap`)

**(a) The natural thing.** A flint hand axe. The observation: **a knapped edge is a row of concave scoops, and the points are
where two scoops meet.** None of the sharpness is drawn: the stone is rounded until two curved cuts intersect. Every flake also
leaves a shallow shell-shaped facet, and the edge gets sharper only by being taken away from.

**(b) Texture.** Sharp, and rigid in that a removed thing never returns.

**(c) One picked note.** One flat, near-black mass (40, 34, 44) hangs in the frame, roughly 560 × 400 px with a soft blunt outline, T = 0.3. The
note takes a bite out of its edge. Pitch chooses where around the outline: bass at the bottom, treble at the top, alternating sides as
the knapper turns the stone. Velocity is the bite: a circle of radius 30 to 140 px and depth 6 to 60 px, cut from the outline.

Attack step: the removed lens, the flake itself, is drawn where it was, in bone, at full. Largest possible flake is about 8,000 px²,
0.9 % of the frame. Inside it, three static concave hairlines (shell lines), drawn whole and never moving. Half-life 0.06 s: it is gone
by 0.25 s, simply fading in place. It does not fly off. Beneath it, the mass's outline has changed in that same step and will never
change back, and the fresh scar on the mass is a shade lighter (68, 60, 74) and falls to the body's tone in 0.6 s, leaving the
faintest facet boundary.

**(d) Chord, repeat, run.** A chord takes several bites around the outline at once, from a single strike. A repeat lands
immediately beside the previous bite on the same edge, at a spacing of about 1.2 × radius, so that the two arcs meet in a needle cusp. **Repeated notes make teeth, and you can count them
as teeth for as long as the stone lives.** A fast run nibbles a serrated edge, with small bites, so a passage leaves a saw. When the stone
has lost 70 % of its area, or after 40 bites, the next attack puts a new whole stone in place of it in that step.

**(e) Knobs.**
- `bite`, "how much a note takes", 0.4..2, default 1. Left: pressure flaking, tiny notches. Right: huge scoops that remove the shape in a few notes.
- `tooth`, "how close repeats land", 0.8..2, default 1.2. Left: bites overlap, a fine saw. Right: separate scallops with long bare edge between.
- `stones`, "how many flakes a stone takes", 12..80 step 1, default 40. Left: a stone is used up in a phrase. Right: it lasts minutes.
- `facets`, "how much of the old scars stay", 0..1, default 0.5, **`less: 0`**. Left: only the silhouette. Right: the mass is covered in shell-shaped planes.
- `colour`, "the stone", 0..2 step 1, default 0. Left: black with bone flakes. Middle: oxblood with bone. Right: honey flint with white.

**(f) Not a recipe.** The widget's only verb is subtraction. It is the single decision: notes do not add marks, they take from a form,
and the record of the music is the shape of what remains, with sharpness earned by repetition rather than given by a sprite.

**(g) State and drawing.** Outline as a radial function: 720 samples `r(θ)` around a centre. A bite lowers `r` to the circle's
intersection; cusps follow. Precompute bites from `CHORDS`, and store snapshots of `r` every 8 bites so seek is cheap. Per frame: 1 path fill for
the mass, up to 3 tones of facet paths (up to 40 lens polygons batched), and flash lenses for those younger than 0.25 s (1 to 4 fills, plus
1 stroke of shell lines). About 8 fills. Use `Path2D` rebuilt only on attack.

**(h) 2D.** Polygons, rebuilt on the attack and never otherwise.

**(i) Closest.** Matisse, also flat cut paper. Matisse cuts shapes and pins them on; here there is one shape, and notes only remove.
Shatter, which was dropped, broke a surface into falling pieces; Knap has no pieces and nothing falls.

**(j) Trap.** Abstract against physical (the shatter verdict). It stays out through flatness: no shading, no debris, no hands, no
hand-axe silhouette at the end (the outline starts as a blob and is not steered toward a tool). Also, the shell lines are static
arcs and must not expand, or they become the banned rings from a point. If the builder finds them reading as rings, drop them.

---

## 4. Cleave (`cleave`)

**(a) The natural thing.** Roofing slate. Tapped with a chisel on the edge, it parts **along one plane, end to end, at once**, and
every split in the block has the same dip because the planes were already there. A pile of split slate has flush faces and stepped,
offset ends.

**(b) Texture.** Rigid + sharp. Hard stop, no ring. The one widget here that truly moves.

**(c) One picked note.** One slab fills x 110..1170, y 40..680, in a flat dark colour at T = 0.3, every edge and cut tilted at one dip
(default 9°). Pitch is a position across the dip, over the song's own range. Attack step: a bone hairline runs **edge to edge of the slab,
drawn whole**, 1.5 to 4 px thick by velocity, up to 1,060 px long, less than 0.5 % of the frame. And that step the leaf below it,
from this cut to the next existing cut, slides along the plane: 8 + 56·(v/127)^1.5 px, 70 % of that on the attack step and the rest on the next,
then dead still. Up moves slide right, down moves slide left. At the slid end, a 3 px end face lights bone with the flash.

Then nothing moves. The bone line is not redrawn, and leaves are drawn with a 1 px gap there, so **the flash simply decays through the
canvas fade into a black hairline in that same pixel**. The flash and the crack are the same thing. Then the crack stays.

Because a flat shape moved along its own edge covers its own old pixels, there is no ghost except at the two ends, the only place where
you want to see something happen. This is why a rigid thing can move on this canvas here and not elsewhere: leaf interiors must stay flat.

**(d) Chord, repeat, run.** A chord makes several hairlines at once, with their leaves sliding in alternating directions, so the slab
shears like a deck pushed from the side. A repeat flashes the same line at full and slides the same leaf another step: the end jumps
visibly, once per note, and after 140 px of travel it turns round. A rising run makes a riffle, one thin leaf per note, in order. Registers
that are never played stay massive, and registers that the melody lives in are sheared into thin leaves, with no code for it.

**(e) Knobs.**
- `dip`, "how steep the grain lies", 0..35°, default 9. Left: level sheets. Right: a steep diagonal fall through the frame.
- `slide`, "how far a note shoves", 0..2, default 1. Left: cracks only, nothing moves. Right: leaves jump far apart and the edges go to pieces.
- `stay`, "how long a crack stays open", 2..60 s, default 12, **`less: 3`**. Left: only the latest few cracks show. Right: the whole song stays in the slab. An expired crack only closes, and its leaf goes home, in the step of some later attack.
- `body`, "how much of the slab shows", 0.15..0.5, default 0.3. Left: mostly the flashes on near-black. Right: a heavy visible block.
- `colour`, "the stone", 0..2 step 1, default 1. Left: blue-black slate. Middle: dark red. Right: bone-grey.

**(f) Not a recipe.** Every cut in the piece has the same angle: it is one plane family, and the design is the refusal of variety. Also, the motion is
exactly along the edges, chosen because of what the canvas fade does to everything else.

**(g) State and drawing.** Plan from `CHORDS`: per chord, the current list of cuts and leaf offsets, computed by a forward pass (a table
per chord, or replay with snapshots every 32 chords). Age only matters for flashes. Frame: all leaves as parallelograms in one
`beginPath`, one fill at `settles(body)`, then 1 to 6 hairline flashes and end faces. About 3 to 8 draws. No offscreen.

**(h) 2D.** Trivial polygons. A hairline must land on the exact pixel, so nothing is resampled.

**(i) Closest.** Hammer (a struck bar, a thin line ringing) and Glitch blocks (tearing rectangles out of place). Hammer's line rings and the
widget returns to rest; Cleave's line stops dead and leaves a permanent crack, and the mass around it moves. Blocks settles back in
choppy steps over a borrowed picture; Cleave never goes back and owns its slab. It is also not shatter: nothing breaks into pieces or falls.

**(j) Trap.** 3, rigid against travelling fronts: the hairline is whole on its first step and never runs. P10 asks that motion
starts fast and slows, and the 70/30 two-step satisfies this at its limit; no `e^(−t/τ)` tail, because a tail would be easing and rigid
has none.

---

## 5. Causeway (`causeway`)

**(a) The natural thing.** Basalt columns seen from above. The tops are five-, six- and seven-sided, not honeycomb, and **a column
does not care about its neighbour**: one can stand a metre below the next, with a hard wall between them, and no force ever passes
from one to the other. A blow to one is not felt beside it. Every other tile-like widget ripples; this is the one that doesn't.

**(b) Texture.** Rigid.

**(c) One picked note.** Fixed map of irregular convex cells, 12 across and 7 down, about 96 × 84 px. Rows are octaves, bass at the bottom.
Across runs the **circle of fifths**, so the notes of a key form one connected patch. A cell exists only once it has been struck: the
song starts on black. Attack step: the cell's top polygon flashes (lit 55 % toward bone, not white, up to 8,000 px², 0.9 %), a bone rim
around it, and **the floor drops one step, 6 to 22 px by velocity, straight down, in one step, and stops.** Above the sunken floor, the
wall it has revealed is a flat dark tone (28, 24, 30). No bounce, no ring. The flash halves in 0.06 s; the floor settles to T = 0.3 and the rim to
T = 0.25.

**(d) Chord, repeat, run.** A chord drops several cells at once, each independently, with no shared motion: a triad in the fifths layout sits
together as one small block. A repeat drops the same floor another step, which can be counted as the wall grows. After about 8 steps the floor is out of sight and the cell
is a solid dark polygon with a lit rim. A fast run works fine because cells do not interact. At more than six notes a chord,
only rims flash, keeping within P12.

**(e) Knobs.**
- `step`, "how far a note drives it", 0.3..2.5, default 1. Left: tiny stair steps, many hits to fill. Right: two hits and it's a pit.
- `memory`, "how long a column remembers", 3..120 s, default 30, **`less: 5`**. Left: only what was just played stands. Right: the whole piece stays dug. A cell's depth counts only hits within the memory and updates only on an attack.
- `rim`, "how sharp the rim", 0..1, default 0.6. Left: flat tops with no outline. Right: every cell in a hard bright line, like a lead window.
- `irregular`, "how far from a grid", 0..1, default 0.7. Left: a neat hexagon grid. Right: broken five- to seven-sided stone.
- `colour`, "the rock", 0..2 step 1, default 0. Left: blue-black. Middle: dark red. Right: ash and bone.

**(f) Not a recipe.** The refusal: no neighbour is ever affected. And the fifths map means that over minutes a key is a dug region, and a
modulation moves the digging somewhere else.

**(g) State and drawing.** From `CHORDS`, a prefix count of hits per cell; depth at time t is from a binary search per cell, cached on chord change. Each cell
is self-contained: rim polygon filled in wall tone, then the rim polygon shifted down by depth, intersected with the rim polygon (a convex clip computed
in JS once per depth change), filled in floor tone. No canvas clip, no painter's order. At most 84 cells, batched by tone into about 6 fills plus flashes.

**(h) 2D.** Convex polygons only.

**(i) Closest.** Cells (Voronoi mosaic, one per note) and Ivory (a key per note). Cells puts a new tile for each note and colours by harmony;
here the tile's place is fixed for life and the event is depth. Ivory's keys rise, stand up, and age away; these are driven in and stay, with no rise and no staged end.

**(j) Trap.** "Too suggestive" for tall shapes that swell, which is why columns are driven down, not up. Also the histogram danger: if it reads as a bar chart of
notes played, `irregular` and the near-black floors should push it back toward a surface.

---

## 6. T-joints (`tjoints`)

**(a) The natural thing.** A dried mud pan. The observation is about order: **a new crack stops dead when it meets an older one, and meets
it at a right angle.** They almost never cross. So you can read the order in which they formed: the long ones came first, the short
ones end on them. It is a hierarchy made of nothing but collisions.

**(b) Texture.** Rigid + sharp.

**(c) One picked note.** A clear plane, 1200 × 660 px, and one straight cut. Pitch picks a row of the plane; the note cuts the largest cell at that height, through a seeded
point near its middle, at a right angle to the cell's longest side. The cut is whole in the attack step: it runs wall to wall and stops dead with no overshoot.
Bone, at full alpha, width 1.5 to 6 px (velocity, and how large the cut cell was). In the same step, the smaller of the two new cells is filled flat in dark
red (120, 28, 24) at full tone: **the flash is the cell, the note has an area.** Fill halves in 0.1 s and goes to nothing in 0.5 s. The line goes to ash at T = 0.25 and stays.

Because each cell is split on a line, and later lines are shorter, the note order can be read off the finished picture.

**(d) Chord, repeat, run.** A chord cuts low note first, within the same step, so the bass gets the long line and the top note ends on it. A repeat doesn't go to the largest cell:
it **cuts the small half it made last time**, so repeats are a narrowing ladder, each rung half the length of the last, flashing at full. At a cell under 18 px it jumps to the sibling.
A fast run produces many short cuts and small flashes in all parts of the plane. After 90 cuts, the next attack clears the plane in its step and starts over with one long line; the old set drops out with the fade, in about 0.3 s.

**(e) Knobs.**
- `cuts`, "how many cracks before it starts over", 20..200 step 1, default 90, **`less: 20`**. Left: a few long lines, restarted often. Right: a dense crazing.
- `fill`, "how much the new cell lights", 0..1, default 0.8. Left: only the line. Right: every note lays a real plane of colour.
- `weight`, "how heavy the old cracks are", 0..1, default 0.5. Left: older lines hair thin. Right: first cracks are black bars.
- `square`, "how true the angles", 0..1, default 0.7. Left: free shards at any angle. Right: all on one grid, close to Mondrian.
- `colour`, "the cell", 0..2 step 1, default 0. Left: dark red. Middle: ochre. Right: blue-black.

**(f) Not a recipe.** The single rule, collision and stop at a right angle, is all the widget has, and repeats have their own geometric meaning.

**(g) State and drawing.** A plan from `CHORDS`: BSP of convex cells, one cut per note, with `{t, gen, x1, y1, x2, y2, w, cell}`. Frame: find the generation for `x.t`, draw settled lines in 3 weight classes as one path each (3 strokes, up to 90 segments), plus flash cells younger than 0.5 s (1 to 6 fills). Stateless and seek-exact. About 10 draws.

**(h) 2D.** A few straight strokes and convex fills, and the lines must land crisp on the strike.

**(i) Closest.** Cells and Boogie (flat tiles and a grid). Cells places Voronoi tiles, Boogie has a fixed city grid. Here each line's length is decided only by what it runs into, and the older picture shapes every new mark. Also not the dropped lightning or shatter: no branching, no radiating, no glass.

**(j) Trap.** 3 and 5, travelling cracks and growth. The temptation with cracks is to run them. Here the crack is whole in the hold and there is nothing at all between notes, and a restart happens only on an attack.

---

## 7. Underbark (`underbark`)

**(a) The natural thing.** Old pine. Grey plates with black furrows, each plate a stack of paper-thin scales. Knock off a scale and the surface beneath is **a shock of orange, which greys in the air.** The observation: the colour was already there, under the grey. Nothing lit up.

**(b) Texture.** Rigid + rough. Edges with stepped, ragged, two-scale outlines.

**(c) One picked note.** A cached ground of about 30 jigsaw plates, 60 to 160 px wide and 200 to 400 tall, staggered in three rows, flat ash (66, 64, 66) at T = 0.22, with black furrows 3 to 8 px wide. No shading, no trunk, no vertical gradient. Plates go left to right by pitch. Each plate holds 5 nested stepped outlines. Attack step: the plate's current scale is gone, and its whole outline is filled flat with cadmium orange (240, 104, 24) at full, with a jagged 1 px bone lip. Up to about 30,000 px², and orange not white. It oxidises: to rust (140, 60, 28) by 0.3 s, then down to dark (58, 34, 26) by about 0.9 s, and no further. The stepped rim of the scale that has gone remains as one more terrace. Velocity: how long the orange lasts and how hard the first step is, never whether it lands. Pitch: which plate.

**(d) Chord, repeat, run.** A chord lights several plates at once. A repeat takes the **next scale in**, a smaller orange island inside the previous terrace, so a repeated note is nested steps you can count: 5 at most, and then the next hit restores the plate in one step and starts again. A fast run passes along the plates, with orange that is still cooling behind it, which is honest because it is only falling.

**(e) Knobs.**
- `plates`, "how many plates", 12..48 step 1, default 30, **`less: 12`**. Left: a few huge plates. Right: a crowded field of small ones.
- `cool`, "how long the colour stays hot", 0.3..3, default 1. Left: orange for a blink. Right: it cools for seconds.
- `ground`, "how much grey shows", 0..0.35, default 0.22. Left: black, only touched plates exist. Right: the whole surface is present.
- `scales`, "how many layers per plate", 2..7 step 1, default 5. Left: two hits and it starts over. Right: many counted steps inward.
- `colour`, "the colour underneath", 0..2 step 1, default 0. Left: cadmium. Middle: salmon. Right: dark red.

**(f) Not a recipe.** A note emits nothing. It uncovers a surface, and its peak is the colour being seen for the first time, not a light being switched on.

**(g) State and drawing.** Ground in one offscreen, built once, drawn with 1 `drawImage` at `settles(ground)`. Plates are `Path2D`s per scale (150 paths, built once). For each plate with a hot scale: 1 fill. Hit count per plate comes from a prefix count on `CHORDS`. Worst case about 35 draws.

**(h) 2D.** Vector plates, one raster ground.

**(i) Closest.** Contours (isolines around hills) and Honey (flat masses). Contours' rings drift and swell; these terraces are hard, placed once, and each one is a note. Marbling pushes ink outward; nothing here moves.

**(j) Trap.** Abstract over physical: of the eight, this one is closest to a picture of its subject. Scale saves it (a plate is as big as a hand on screen, flat, no shading), but the builder should try `ground` near 0 first. If it still says "tree", cut it.

---

## 8. Peel (`peel`)

**(a) The natural thing.** Birch paper. It tears **across** the trunk, always level, and because the outer layers are stressed, a strip **rolls itself up the moment it is free**, into a tight scroll, and then stops, stiff and dry. Its underside is salmon. The roll is one fast elastic release that ends with no give.

**(b) Texture.** Sharp + elastic: a point at one end, a spring at the other. The one idea here that isn't rigid, placed last because it is what the others are not.

**(c) One picked note.** Pitch gives the height. Attack step: one level strip, 5 to 20 px tall, 160 to 700 px long by velocity, in cream (232, 224, 204) at full. Its straight top edge is dead level, and its lower edge runs to **a hairline point at the anchored end**. Hold 2 steps. Then the free end rolls back toward the anchor: `len·f·(1 − e^(−t/0.045)·cos(2π·5t))`, with `f` = 0.7, reaching past its rest by about 11 % and back, done by 0.25 s, and stopped. At the free end, a two-turn spiral, up to 14 px radius, 2 px stroke, grows from the rolled length. Under the strip, from the first step and so never a rise in brightness, is a salmon band (214, 128, 96), which is exposed as the roll goes back, falling by half every 0.12 s and gone by 0.6 s. The stub with its scroll fades by the piano curve, done by about 1 s. Free end: right for a rising step from the last note, left for a falling one.

**(d) Chord, repeat, run.** A chord is a stack of level strips curling the same way, a fringe. A repeat stays on the same row and starts where the last strip ended, so a repeated note walks along its line as a row of little scrolls. In a fast run, length is scaled by `min(1, gap/0.25)`, where `gap` comes from `CHORDS`, so a run is a row of short flicks.

**(e) Knobs.**
- `length`, "how long a strip", 0.3..1.5, default 1. Left: short flicks. Right: full-frame tears.
- `curl`, "how far it rolls back", 0.2..0.95, default 0.7. Left: barely lifts at the end. Right: nearly all of it is rolled up.
- `spring`, "how much it springs", 0..1, default 0.6. Left: rolls and stops dead, like old paper. Right: rolls past and unrolls, nearly a rubber band.
- `stay`, "how long the scrolls stay", 0.25..3, default 1, **`less: 0.25`**. Left: gone almost at once. Right: rows of scrolls pile up.
- `colour`, "paper and underside", 0..2 step 1, default 0. Left: cream and salmon. Middle: bone and dark red. Right: grey and gold.

**(f) Not a recipe.** Everything is level; only the end moves; the motion is an unloading that begins on the note and finishes by itself. Its shape is a typographer's swash made by a mechanism.

**(g) State and drawing.** Stateless from `CHORDS`, using the alive set within L. Per strip: 1 polygon fill plus 1 band fill plus 1 spiral stroke. In practice at most 12 alive: about 36 draws. Spirals can be batched by alpha bucket.

**(h) 2D.** Polygons and one spiral stroke per strip, few enough that a shader would add nothing.

**(i) Closest.** Calligraphy and Kline (brush strokes) and Vine (curling stems). Those are drawn over time and have brush weight; this is level, hard-edged and arrives whole, and only its end moves. Vine creeps between notes; this has fully stopped by 0.25 s.

**(j) Trap.** 2, elastic against no fake attacks. The overshoot is 11 % and dead by 0.25 s, and brightness only falls throughout. Salmon sits under the strip from the first step, so the reveal adds no light. Motion is along the strip's own line, so only the tip ghosts.

---

My best idea is Mica: not one pixel moves, each pitch is a fixed scatter of sharp flakes lying at one angle, so the eye can count repeats and even see octaves as parallel.
