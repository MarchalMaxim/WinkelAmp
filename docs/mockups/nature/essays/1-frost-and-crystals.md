# Frost and crystals

Looked at closely, frost is less a substance than a set of refusals: it grows only along two or three directions, it stops dead
where other ice already is, and when it dies it neither drips nor breaks, its points just go first and it is less there. A
crystal's lines are also older than any blow: mica splits along planes that were already in it, needle ice lifts in countable
bands, and a touched supercooled drop goes solid all at once, which is my licence for everything below to appear whole on the
note and never grow between notes.

**Used throughout.** `u` is pitch 0..1 over the clip's own range. `V = floor + (1 − floor)·(v/127)^1.5`, floor 0.35 on picks and
0.12 otherwise; `v` already carries a picked note's intensity, and below intensity 0.6 a mark has no bone flash, only its body.
Bone is `[236,226,208]`, never pure white. Oxblood is `[122,16,20]`. **No ice blue anywhere**: blue would turn all of these into
a picture of ice. Bodies are drawn through `alpha(T, Tprev)`; hairs carry only the flash, at full alpha for 2 steps, and the
canvas fade takes them down. Whatever must survive at low alpha has area or is at least 2 px wide. Geometry comes from a hash of
chord index and pitch (a seeded `rng(seed)` like Ivory's), so a seek draws the same mark. Each widget also has the usual
`presence` (`leads: true`, never read) which moves the knob marked `less:`. White area is checked against P12: 6 % of the frame
is about 55,000 px. Needle ice, Stop Dead and Cleave plan from `CHORDS` in `reset`, so the knobs that shape that planned history
(`shove`; `reach`, `stay`, `tilt`; `slip`, `planes`) are read when the plan is built, and the plan is rebuilt when one changes,
including when `presence` moves it; leave those knobs undriven by default.

---

## 1. Sublimate (`sublimate`)

**(a) The natural thing.** A snow crystal in dry air. It does not melt, it sublimates, and the sharper a corner the faster it goes,
because a point has the most surface to lose from. Needles go first, then spikes, then corners; old snow is round grains.

**(b) Texture.** Sharp, and sharpness is the envelope. The note's decay is a loss of edge more than a loss of light. The attack
could hurt you; a second later the same form could not.

**(c) One picked note.** Attack step: a flat polygon, stationary for its whole life, filled solid oxblood at full `V`, with a bone
outline 2.5 px wide and bone-filled tips. Site: x = `0.08 + 0.84u` of the width, y from a hash of the pitch in 18..82 % of the
height, so a pitch always lives in one place. Pitch also sets the form, after Nakaya's diagram, where temperature picks a
crystal's habit: below C3 a squat plate (6 to 8 blunt corners, about 260..420 px across, 2 or 3 short spikes); C3 to C5 a long
prism (aspect 4:1, up to 400 px, tilted, 4 or 5 long spikes off the ends); above C5 a small barbed form (120..220 px, 9 to 13 fine
tips). Velocity sets how far the tips reach: tip length `L0 = 2.25·edge·r·V` (`1.8·r·V` at the default), so a soft note is almost a plain polygon and a hard one
is dangerous. Tips have inner angles `θi` of 8°..45°, and as in the real thing the thin ones are long and the blunt ones short: a tip's length is
`Li = L0·sqrt(8°/θi)`. Only the outer quarter of each tip is bone; the rest is the body's oxblood.
Following second: the tips and corners hold for 2 steps, then each tip retracts as `Li·e^(−t/τi)`, with `τi = 0.12·(θi/30°)`
(never under 0.05 s), so the thinnest needle is gone first and the blunt spikes later. Every corner rounds with
`R(t) = 0.45r·(1 − e^(−t/0.4))`, drawn with `arcTo`, tangent lengths clamped to 0.48 of the shorter edge. Bone halves in 0.06 s.
The fill's brightness falls with a half-life of 0.35 s. At `life` (1.4 s) it is a dim round pebble and is dropped. A retracting
needle leaves its old pixels to the canvas fade, so it reads as going out rather than pulling back, which is what we want.

**(d) Chord, repeat, run.** Chord: one form per note. Same-coloured neighbours merge into one hard spiked mass, because the fill
has no outline of its own below the flash. A loud low note is about 6,000 px of bone (a 2.5 px outline about 1,900 px long, plus the tip ends); above 4 notes the
outline drops to 1.5 px, so a ten-note chord stays near 40,000 px, under P12. Repeat: the pebble **re-sharpens in one step**: same body, same place, `R` back to 0, flash at full, tips
reseeded from (pitch, repeat index), so they stand elsewhere, plus one extra tip per repeat up to 4. This is what a crystal does
when growth resumes, and it makes a repeat unmistakable. Fast run: a trail of dim pebbles and one spiked form at the head, so each
new note stays the only sharp thing on screen. Up to about 16 notes a second this holds.

**(e) Knobs.**
- `edge`, "how sharp", 0.3..1, default 0.8. Left: short points, nearly a plain shape. Right: long needles that reach far past the
  body. Icon: a spike short to long.
- `dull`, "how fast it goes blunt", 0.4..3 (multiplies every `τi` and the rounding), default 1. Left: the points are gone in a blink.
  Right: it stays sharp for half a second. Icon: a point rounding off.
- `life`, "how long the pebble stays", 0.3..4 s, default 1.4, **`less: 0.4`**. Left: gone with the points. Right: pebbles lie for
  seconds. Icon: `ICON.fade`.
- `size`, "how big", 0.4..1.6, default 1. Left: small marks. Right: forms that fill a third of the screen. Icon: a square small to big.

**(f) Not a recipe.** One decision: brightness is not the main decay. The corner radius is, and tips retreat by their own angle, so
a note's age can be read from its outline alone. Nothing here could be painted on by a theme.

**(g) State and drawing.** Stateless from `CHORDS`: per pitch, the latest chord with that pitch and how many repeats came within 1.5 s
before it. `reset` builds per-pitch body polygons. `frame` walks live marks: one path per mark, one fill; a stroke and a tip-end fill only
in the first 0.1 s. At most about 24 live marks, 15 `arcTo` each, so under 40 fills a frame. No sprites.

**(h) 2D.** Exact polygons and `arcTo` are what it is made of.

**(i) Closest.** Flee has a round-to-sharp range of shapes, but its shapes are fixed in form and bolt. Here nothing moves, and only the
edge changes. Lazy and Honey soften by sagging; this has no gravity and never swells.

**(j) Danger: trap 5 (growth, here un-growth, between notes) and trap 6.** It stays out because the rounding only removes, starts at
full speed on the attack, happens everywhere on the form at once with no front, and runs under falling brightness. If the slow
rounding reads as a live event, shorten `life` before anything else.

---

## 2. Needle ice (`needleice`)

**(a) The natural thing.** Needle ice lifting out of frosty soil. It grows **from the bottom**: new ice forms at the soil line and
shoves the older ice upward, with the lifted crust riding on top. Each freezing night leaves a band, so you can count the nights.

**(b) Texture.** Rigid and sharp. A bundle of hairs under a flat cap that takes a shove and goes up with no give at all.

**(c) One picked note.** One column per pitch used in the clip, side by side over 84 % of the width, each 10..54 px wide, feet cut off
on a hard ground line at 86 % of the height (the line itself is not drawn). Attack step: a new tier appears at the ground: vertical
hairs in bone, 1 px wide on the integer pixel grid, one every 2..3 px, full alpha, height `h = 18 + 90·V` px. Everything already in
that column jumps up by exactly `h` in that same step: **zero overshoot, zero easing, no ring**. Between tiers a dark gap of 3 px, and
hair positions re-rolled per tier, so hairs never line up across a gap. Riding on top is a solid oxblood cap, 6 px tall, 4 px wider
than the column, slightly uneven in length; it is the first thing the eye sees jump.
Following second: the 1 px hairs drop out under the fade in about 0.2 s, leaving the tier's body, 2 px wide bars at every second hair
position in bone-grey at `T = 0.38` falling to 0.22 over 1.5 s, where it holds. Pitch is the column; velocity is how far it is shoved.

**(d) Chord, repeat, run.** Chord: those columns jump in the same step, each by its own `h`. Repeat: another tier under the last one,
the same column shoved again. You count tiers directly. Run: a scale is a staircase of single jumps across the columns. A trill is
two columns climbing together, and a tremolo sends one column off the top of the frame in distinct steps; at 12 notes a second and
18 px a tier that is still five frames per step, so it stays discrete. Tiers leaving the top are simply gone. Bone per tier is about
2,000 px, so a full chord is well inside P12.

**(e) Knobs.**
- `fine`, "how fine the hairs", 1.5..6 px spacing, default 2.5. Left: dense, nearly a solid bar. Right: a few separate wires. Icon:
  vertical lines dense to sparse.
- `shove`, "how far a note shoves", 0.4..2, default 1. Left: thin layers, many fit. Right: each note throws the column up a long way.
  Icon: a stack with a small to large step.
- `stay`, "how long a column stands", 1..20 s, default 6, **`less: 1.5`**. Left: it goes soon after its last note. Right: the whole
  history of a pitch stands for a long time. Icon: `ICON.fade`.
- `ground`, "where the ground is", 0.6..1.1 of the height, default 0.86. Left: columns float mid-frame. Right: the feet are off-screen,
  and only the tops show. Icon: a line low to high.

**(f) Not a recipe.** A bar chart grows at its top. This grows at its foot, so the newest note is at the bottom and the oldest rides
highest, and the whole past is what visibly moves on each note. That inversion comes straight from the real thing.

**(g) State and drawing.** Stateless: `reset` plans per column a list of tiers `{t, h, variant}` from `CHORDS`; `frame` binary-searches
the live ones and stacks them from the ground. Sprites: 4 column widths × 6 variants, each flash (1 px) and body (2 px), 110 px tall at
the canvas's real resolution (`x.canvas.width / 1280`), cropped with `drawImage` to `h`. Typically 60..120 `drawImage` a frame, worst
case about 360, with caps batched in one fill. When `stay` runs out a whole column fades out in place, all together, in 0.4 s.

**(h) 2D.** Pixel-grid hairs from sprites.

**(i) Closest.** Ivory stands one key per note with height from pitch. This has one column per pitch, height from history. Ikeda shares
hairlines on a grid but streams data in bands; nothing here streams.

**(j) Danger: "too suggestive" and trap 4.** A tall thing that rises needs checking. It never swells or trembles, only jumps; it is made
of hairs with a flat cap, not a smooth rounded bar. For trap 4, the 1 px hairs are the flash only, and the 2 px bars are what stays. If a
single rocketing column still reads badly, cap `h` at 30 px on repeats within 0.2 s.

---

## 3. Rime (`rime`)

**(a) The natural thing.** Hard rime on a fence in fog. Its feathers grow **into the wind**, all at one angle, on the windward side only,
and their direction has nothing to do with the shape of the post. The object behind stays dark; you know its edge only by where the
feathers start.

**(b) Texture.** Sharp, to the point of bristling. The thing the eye closes is a body that is never drawn.

**(c) One picked note.** Attack step: a slab in pure black, hard-edged, 60..340 px long (low notes long, high notes short) and 20..120 px
thick, tilted by a hash of the pitch in ±35°, invisible on black but **it erases what lies under it** from other widgets and earlier
notes. The black is drawn on the 2 hold steps only, so it is a cut that other widgets then paint back into. Along its windward edge, a comb of straight needles, all parallel, at the widget's one wind angle, whatever the slab's tilt.
Count `count·(0.25 + 1.25·V)`, so 30..180 at the default. Length is heavy-tailed, the one decision that makes it look real: most 8..30 px, every tenth 60..160 px, times
`0.6 + V`. Each is a filled triangle, 2.5 px at the root, tapering to a hair; long ones 4 px at the root. All in bone at full alpha, for
2 steps. Site: y = `0.88 − 0.76u` of the height, x from a golden-ratio step on pitch class.
Following second: the comb is not redrawn after step 2, so the canvas fade takes it down with a half-life of 0.09 s. Only the long tenth
are redrawn, in bone-grey at `T = 0.2 + 0.2·V`, half-life 0.3 s, gone at 0.9 s. So it goes from a full comb to a few spines to
nothing; their faint hair tips drop below 0.2 first, so they look as though they are getting shorter, with no staging. Bone on the
strike is about 4,000 px.

**(d) Chord, repeat, run.** Chord: slabs drawn in pitch order, each black body cutting into the comb of the one before: hard occlusions,
the widget's best moment. Repeat: same slab, new comb from (pitch, repeat index), needle lengths × `1.3^r` up to r = 3, full flash; it
gets longer teeth on the same straight line. Run: combs along a line, all parallel, reading as one grain being drawn through the frame.

**(e) Knobs.**
- `wind`, "where the wind comes from", 0..360°, default 220. Left and Right turn the direction all needles point. Icon: a tick rotating.
- `reach`, "how long the needles", 0.4..2.2, default 1. Left: a short bristle. Right: long spines. Icon: a comb short to long.
- `count`, "how many needles", 20..300, default 120, **`less: 30`**. Left: a few separate spikes. Right: a dense pelt of points. Icon: comb sparse to dense.
- `cut`, "does its body blank the picture", 0..1, default 1. Left: only needles appear. Right: its dark body cuts a slab out of everything underneath. Icon: a black slab over lines.

**(f) Not a recipe.** The mark's body is absent, and all needles obey the wind rather than the edge they stand on. Black on a shared canvas
is a real drawing act here: a note removes something.

**(g) State and drawing.** Stateless from `CHORDS`: each mark hashes (chord index, pitch) to its comb on demand. Attack steps: one path of
about 120 triangles, one fill, one black fill. Other steps: about 12 triangles per live mark. Under 15 fills a frame, typically under 300
triangles. No sprites needed; a cached `Float32Array` of triangle coordinates per live mark avoids rehashing.

**(h) 2D.** Black-over compositing on the shared canvas is the point.

**(i) Closest.** Gust shoves wedges of air. These never move. Flee's needles fly. Honey's threads sag.

**(j) Danger: trap 4, and looking like fur.** Hairs get only the 2 full-alpha steps, the spines have 4 px roots. The needles are perfectly
straight and taper to the tip, so they stay crystalline rather than becoming hair. A curve anywhere would ruin it.

---

## 4. Stop Dead (`stopdead`)

**(a) The natural thing.** Fern frost seen with a lens. The curve you see from a distance is made of straight needles along just three
directions, and a needle reaching ice already there **stops**. It never crosses. So every junction is a T.

**(b) Texture.** Rigid and sharp. A line that does not bend or pass and ends the moment something is there.

**(c) One picked note.** Attack step, whole and final, no drawing-on: one straight tapered needle. Home: x by pitch, y from a hash of the
pitch class. It starts on the nearest live needle to its home (or on the frame edge in an empty picture) and runs in one of three
directions, 60° apart plus a global tilt (default 15°, so nothing is level), chosen by pitch class mod 3. It runs until it strikes a live
needle or reaches `180 + 900·V` px. Root width `3 + 7·V` px. **Two possible ends**: stopped by another needle, it ends flat against it,
blunt, and if it ran out of force, it ends in a hair-fine point. Bone at full alpha for 2 steps, about 5,500 px of bone at most.
Following second and beyond: bone halves in 0.06 s; the body is oxblood at `T = 0.25 + 0.15·V`, held flat and redrawn steadily, because a line must never stop a needle unless the eye can see
it. A needle past `stay` (6 s) goes out on **the next attack**, in one uniform 0.25 s fade, and stops blocking the moment that fade begins,
the way Handover hands over. After 4 s of silence, everything fades together in 0.4 s. So velocity sets reach and weight, while **the picture so far decides
how long it really is.** A loud note in a crowded place is a thick short stab.

**(d) Chord, repeat, run.** Chord: one needle each, planned lowest pitch first, so they stop against each other in the same step. Repeat:
it starts 8..14 px further along the same host and runs parallel to the last one, stopping on the same thing. That is exactly how a
dendrite puts out parallel side branches, and it makes repeats a countable comb. Run: this is where it could break, since the free
space fills up. Rule for P6: if the chosen direction gives under 24 px, it takes whichever of the other two directions has the longest
run. A note may be a short tick, but it is never nothing. Past about 100 live needles, the oldest are retired early, on the same attack.

**(e) Knobs.**
- `tilt`, "the angle of the whole lattice", 0..60°, default 15. Left and Right turn all three directions together. Icon: three lines rotating.
- `reach`, "how far a note can run", 0.3..2, default 1. Left: short strokes that rarely meet. Right: lines that cross the frame until something stops them. Icon: a line short to long.
- `stay`, "how long a line blocks", 1..20 s, default 6, **`less: 1.5`**. Left: an open picture, always room. Right: it packs tight and notes become stabs. Icon: `ICON.fade`.
- `weight`, "how heavy the lines", 0.5..3, default 1. Left: wires. Right: heavy wedges. Icon: a line thin to thick.

**(f) Not a recipe.** A note's length is not a property of the note: it is decided by what is already there. The same phrase comes out
differently early and late in a piece, yet exactly the same on every render, and there are only T-junctions and three angles in the
frame. That rigidity comes from the whole field.

**(g) State and drawing.** All planned in `reset`: walk `CHORDS` in order, ray-cast against needles alive at that moment, store `{t, x0, y0,
x1, y1, w, end}`. A few thousand notes against at most 100 live needles is about 300,000 segment tests, once. `frame` is a pure function of
time: live quads go into a few brightness buckets, one fill each, plus one bone fill. About 6 fills, up to 100 quads.

**(h) 2D.** Filled quads.

**(i) Closest.** LeWitt lines cross, on a fixed lattice, by a rule. These stop, and their length is a result. Vine creeps and forks at
random angles; this appears whole and has only three directions. Boogie woogie also has lines that end at other lines, but on a right-angled grid with coloured blocks moving along it.

**(j) Danger: trap 3, plus the dropped shatter.** Each needle appears entire within the hold, so there is no travelling front. It could
read as cracked glass, which is why there are no radial bursts and no irregular angles: three directions and T-junctions only. If it still
looks like cracks, raise `weight`; wedges do not read as fractures.

---

## 5. Cleave (`cleave`)

**(a) The natural thing.** Mica, split with a blade. A blow creates no new line: it finds a plane that was already there. Mica has exactly
one perfect direction of cleavage, so everything happens along one angle: sheets slide past each other, with no fragments.

**(b) Texture.** Rigid and sharp. The stone does not bend; it takes a slide and a razor line, then it stays that way.

**(c) One picked note.** One big flat mass, a hard-edged hexagon about 980×560 px with straight sides, oxblood at `T = 0.35`, appearing whole
on the clip's first attack. It holds 12 parallel planes that exist from the start and are never shown until used, all at one tilt
(default 20° off level), in pitch-class order across the stone: C at one end, B at the other. So every line on the screen belongs to one
direction. Attack step: that pitch class's seam appears edge to edge across the mass as one bone line, 2..3 px wide, full alpha. In the same
step the two halves slide along the plane by `s = (6 + 30·V)·(0.6 + 0.8·(1 − u))` px: bass moves further. **No overshoot, no easing, no
rotation.** With parallel planes every slide is a pure shear, so the sheets stay in full contact and nothing can open or separate. Following
second: the seam's bone halves in 0.06 s and leaves a permanent black scar, because every sheet is drawn inset by 0.75 px. The mass stays where
it was put, now with a new step in its silhouette. It never goes back between notes.

**(d) Chord, repeat, run.** Chord: several planes open at once, and the silhouette jumps to a new shape in one step. Bone is about 2,400 px a
seam. Repeat: the same line lights up and the step grows by the same amount, so a repeat is immediately recognisable as the same line again.
To keep things bounded each plane walks: three strikes one way, three strikes back. Run: seams flash across the stone in the order of the
phrase, so a scale walks along it and a melody can be followed as a moving line. An octave is the same line with a different slide.

**(e) Knobs.**
- `slip`, "how far a blow moves it", 0.3..2.5, default 1. Left: only a line and a hair of movement. Right: the mass jolts a long way. Icon: two halves offset small to large.
- `planes`, "how many lines the stone has", 3..12 (pitch class mod this), default 12, **`less: 4`**. Left: three lines that every note shares. Right: one line for every note name. Icon: a block with few to many lines.
- `size`, "how much of the frame it fills", 0.4..1.1, default 0.8. Left: a small stone. Right: edges past the frame, seams with no visible ends. Icon: a square small to large.
- `tilt`, "the angle of the lines", 0..90°, default 20. Left: level sheets. Right: upright sheets. Icon: a line rotating.
- `tone`, "what colour the stone", 0..1, default 0.2. Left: bone-grey. Right: black-red. Icon: a swatch.

**(f) Not a recipe.** The geometry precedes the music. Same note, same line, for the whole piece, so that the listener can learn it. A blow
reveals, it does not invent. And there is never a return: the piece ends with the stone in a shape no other performance would give it.

**(g) State and drawing.** Strips computed once in `reset`: clip the hexagon by the parallel lines, giving at most 13 convex sheets, each with
a tone ±8 %. Per plane, a prefix array of offsets over `CHORDS`, binary-searched in `frame`. A sheet's offset is the sum of `±offset/2` over
all planes, always along the one direction. Each frame: one path with about 80 `lineTo`s per tone bucket, about 4 fills, plus one path for live
seams. Stateless and seek-exact.

**(h) 2D.** Polygons on a path.

**(i) Closest.** Casket and glitch blocks tear rectangles of the picture and settle back. These are fixed planes in a stone of its own, and what
moves stays moved. Hammer's bar is struck and rings; this has no ring. The dropped shatter separates shards, and this never does.

**(j) Danger: trap 3 and the shatter verdict.** The seam is whole in the hold step and nothing spreads. To stay out of "too physical": one
direction only, so there are no shards, no rotation, no gaps and no debris, and no surface detail on the stone. A flat polygon with steps in it
is a shape first. I rejected three families of planes for this reason: where two non-parallel planes cross after slipping, a hole opens, and
that is the look of broken glass.

---

## 6. Glint (`glint`)

**(a) The natural thing.** A frost field in low sun. It isn't lit all over: a plate flashes only when its face is at the exact mirror angle, and all plates of
one angle flash together while the rest stay dull. Move your head a degree and another set answers. A facet catches light all at once and goes dull all at once.

**(b) Texture.** Sharp, with fuzz at a distance. Up close it is a thousand blades, from across the room a nap with a direction.

**(c) One picked note.** A note lights one set of tapered dashes, **all parallel**, and their angle is its pitch class: 15° per semitone over 180°. Attack step:
`count·(0.27 + 1.73·V)` dashes (40..300 at the default), each 6..28 px long and 1.5 px wide at its middle, tapering to both ends, in bone at full alpha, for 2 steps. Positions are fixed for
the clip, seeded per pitch class: x uniform across the frame, y around `0.88 − 0.76u` of the height with σ = 150 px, so register reads as a band. Following second:
nothing is redrawn after step 2 except the longest 8 %, drawn 2 px wide in bone-grey at `T = 0.2 + 0.2·V`, half-life 0.25 s, gone by 0.8 s (`linger` sets that share and those times: share
`0.23·linger`, half-life `0.7·linger` s, gone by `2.3·linger` s). The canvas fade does the
rest, for free. Pitch is angle and height; velocity is how many dashes answer and how long they are. Bone per note is at most about 4,000 px.

**(d) Chord, repeat, run.** Chord: several directions at once, a real hatching. A fifth is 105° apart and a tritone exactly perpendicular, so **an interval is
literally visible as the angle between textures**, and an octave lies along the same grain at another height. Repeat: same angle, next of three seeded
position subsets (repeat index mod 3), at full, so a repeat is the same direction at new places. An exact redraw would not count at 12 a second. Run: the
grain of the field turns as the melody moves, one step per note. This is the strongest thing it does.

**(e) Knobs.**
- `count`, "how many answer", 20..400, default 150, **`less: 30`**. Left: a sparse few. Right: a field of blades. Icon: dashes sparse to dense.
- `length`, "how long the blades", 4..60 px, default 18. Left: grit. Right: long needles. Icon: a dash short to long.
- `linger`, "how much stays after the flash", 0..1, default 0.35. Left: it goes out completely with the flash. Right: a dim grain remains for most of a second. Icon: `ICON.fade`.
- `spread`, "how far from its register", 0.1..1, default 0.4. Left: a narrow band at the note's height. Right: the whole screen. Icon: a band narrow to wide.

**(f) Not a recipe.** Nothing moves, spawns at random or flies. Each pitch owns a direction for the whole clip, and the harmony can be read as an angle. Remove
"a frost field" and that decision still stands; it is the whole widget.

**(g) State and drawing.** `reset` builds, per pitch class, three `Float32Array`s of dash positions. `onChord` is not even needed: `frame` finds chords whose age is under
2 steps and fills one path of quads each. On the attack: at most 300 quads a note in one fill. Otherwise, about 24 quads per live note. Under 15 fills a frame.

**(h) 2D.** Batched quads; the host's own fade is the envelope.

**(i) Closest.** Ikeda (hairlines on a grid, data streaming, no angle). Halftone (dots that swell in a wave). Pointillism and flee's needles. None gives a pitch its direction.
The dropped moire is why dashes are short and scattered, not long parallel lines: there can be no interference pattern.

**(j) Danger: trap 4 and the recipe label.** Hairs only exist at full alpha for 2 steps; what lingers is 2 px wide. It is the idea here most at risk of being called "N
particles", so keep the fixed positions and parallel rule untouched: the moment dashes get a random angle or drift, it is one.

---

**My best idea: Sublimate, because it makes texture the note's actual envelope: a piano note's decay is read from how blunt the form has become, a repeat visibly re-sharpens it, and it is the idea here that fails completely if you swap sharpness for any other texture.**
