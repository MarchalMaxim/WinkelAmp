# Feathers and seed heads

Everything soft in this corner turns out to be made of straight things. Pull a feather's vane against the grain and it does
not tear or bend: stiff rods swing about their roots and a clean V appears, and one stroke closes it without a scar. A
dandelion clock has no surface at all, only tips, and a seed pod's softness sits behind a seam that gives way in a few
milliseconds. So the fuzz here is always a count of hard lines, and that suits a widget that has to let the eye count notes.

**Two techniques several ideas share, stated once.**

- *Hairs that survive the fade.* Fine hairs at low alpha are eaten (trap 4). A dim hair ground is drawn from a pre-rendered
  sprite with `globalCompositeOperation = 'lighten'` at alpha 1, in a colour that already is the dim tone. The pixel becomes
  max(screen, tone), so the ground holds exactly, does not depend on 8-bit rounding, and does not erase other clips. Six
  tools already use `lighten`. Struck hairs are drawn at full alpha in their own step, and after that through `alpha(T, Tprev)`.
- *Two sprites and a clip.* Pre-render the whole hair structure twice, once in the dim tone and once in bone. "These hairs are
  gone" is one clip polygon around a single `drawImage`. "These hairs are struck" is the bone sprite through a clip polygon.
  Hundreds of hairs cost one draw, and hairs are never stroked one at a time unless they are actually moving.

---

## 1. Quill (`quill`)

**(a) The natural thing.** A flight feather's shaft, bent too far. It does not snap and it does not curve: it kinks. There
are two dead-straight lengths and a white crease between them, and the crease stays. On the outside of the bend the barbs fan
open, and on the inside they jam across each other. A rigid thing keeps its history as a set of angles.

**(b) Texture.** Rigid and fuzzy: one unbending line wearing a soft comb. The eye gets the hard jolt of a stiff thing moved,
with the nap riding on it.

**(c) One picked note.** The quill is one long line entering at (−60, 360), heading right, 1700 px long. It is a tapered
shaft, 4 px at the left to 1 px at the right, combed on both sides with barbs every 5 px, 46 px long, at 40° toward the tip.
All of this sits in dim bone (T 0.3). The note's **pitch sets where along the shaft it bends** (`s = pitchfrac · 1700`). Its
**velocity sets the angle** (3° at v 20, 22° at v 127). Rising from the previous note bends the far end up, falling bends it
down.

In the attack's own step, everything beyond the kink is simply elsewhere: it rotates rigidly about the kink with no easing
and no overshoot. A bass note moves almost the whole line and its end may travel 300 px. A high note flicks only the last
hand's width. At the crease, a bone tick across the shaft (2 px wide, 20 to 44 px long by velocity) and the barbs within
60 px are drawn at full alpha for two steps. The flash then halves every 0.06 s to a scar at 40 %, and the scar falls to
nothing by about 1.5 s. The old position stays on the canvas as a ghost at 0.88, so for a fifth of a second the jump shows as
a thin fan of where the far end just was. No extra code draws this, because the shared fade does it.

**Between notes not one hair moves.** There is no relaxing over time. Instead each new attack multiplies all older kink
angles by 0.8, so the quill straightens only on notes, and a kink is worn away after about fifteen of them.

**(d) Chord, repeat, run.** A chord puts all its kinks in the same step: the line lands in a new polygon with several ticks
lit, one for each note, so the count is still readable. A repeat bends the same crease the other way, restarting the tick at
full, so a repeated note worries the line back and forth by a visible jump each time. A fast rising run walks small kinks
rightward and mostly flicks the tip, which is right for high fast notes. If the end has gone beyond ±35° of level, the sign
is forced back toward level, so the line stays in the frame, and this is decided in the plan, not per frame.

**(e) Knobs.**
- `bend`, "how hard it bends", 0.3..2.5, default 1. Left: barely a nudge at each note. Right: every note throws the line.
- `wear`, "how long a bend lasts", 0.5..0.95 (what each new note keeps of older bends), default 0.8. Left: it is straight
  again after three or four notes. Right: it stays a broken zigzag for dozens. `less: 0.5`.
- `comb`, "how close the barbs sit", 3..16 px spacing, default 5. Left: a dense soft vane. Right: a sparse bristle. `less: 16`.
- `vane`, "how long the barbs are", 0..120 px, default 46. Left: a bare wire. Right: a wide feather's worth of nap.
- `presence`, leading.

**(f) Not a recipe.** The decision is that pitch sets where the line breaks, so bass throws the entire picture and treble
only flicks its end. Register becomes leverage, and that could only come from bending a real quill. Moving only on notes,
and wearing out only on notes, is the second decision.

**(g) State and drawing.** All planned at load: for each chord index, the list of live kinks (position, angle), by running
the rule over `CHORDS` once. `frame` binary-searches the current chord index, so a seek needs no replay. On a change of
index, one 1280×720 offscreen is rebuilt: one path of about 680 barbs per segment-group, plus the shaft. Each frame draws
that offscreen once, with `lighten`, and strokes the bone ticks and struck barbs of the last few marks (at most 12 short
paths). Each straight length carries its own rigid comb, so the outside gap and the inside jam appear from the geometry and
need no special case. Under 20 draws a frame, with one 700-segment rebuild per attack.

**(h)** 2D. Lines and one offscreen.

**(i) Closest: Hammer** (a struck line that rings). The quill does not ring and does not recover. It stays where it was
thrown, and the same one line carries all the notes. Brush/Calligraphy also lives in one line, but it writes along time;
this line does not advance.

**(j) Trap 3, rigid against travelling fronts.** The whole far length moves inside one step, nothing propagates, and the
crease is complete when first seen. Also trap 5: nothing changes between notes.

---

## 2. Unzip (`unzip`)

**(a) The natural thing.** A contour feather's vane, parted against the grain. What I noticed: the split is a rotation, not a
cut. Each barb stays straight and swings about its root on the shaft, the ones displaced crowd into their neighbours, so the
flanks of a split are **denser** than the untouched surface. Stroke it, and no scar remains.

**(b) Texture.** Fuzzy and sharp. A surface that reads as a flat nap until a note shows it was made of hard rods.

**(c) One picked note.** The ground is a diagonal band across the frame. A rigid shaft runs from (−40, 650) to (1320, 70),
with 490 barbs a side at 3 px spacing, 38° toward the tip, up to 340 px long. Hairs are oxblood (`#5a1616`). At this spacing
they read as one flat dark sheet with a grain.

The note's **pitch picks the place along the shaft**, and white keys open the lower vane, black keys the upper. **Velocity
sets the width**: half-width W runs from 30 px to 96 px along the shaft (P6: never less), and the gap at the outer edge is
1.1·W across. In the attack's own step the V is open. The apex is on the shaft, roots stay fixed, and barb tips are remapped
by `u' = sign(u)·(G + (W − G)·(|u|/W)^1.6)`, which packs them hardest against the gap. All those barbs are drawn in bone at
full alpha for two steps, then fall through oxblood by about 0.5 s (flash half-life 0.06 s). The two barbs bounding the gap
are 2 px wide and hold their edge.

Over the next second G closes exponentially (τ 0.35 s). All the barbs move together, with no front running along the vane.
The vacated hairs are still on the canvas at 0.88 on the attack step, so the gap goes black over about 0.2 s. The flash
carries the attack and the darkening follows. This is honest and I would keep it: no black over-paint (it erases other clips).

**(d) Chord, repeat, run.** A chord opens several notches at once, on both vanes. A big chord leaves the band hanging in
strips. A repeat tears the half-closed notch back to full width with a full flash: a visible re-opening, and countable. A run
pulls a zip in discrete jumps. It is where it could break: at 16 notes a second, neighbouring notches merge into one long gap.
So W is multiplied by `0.5 + 0.5·min(1, gap/0.12)`, where gap is the time since the previous attack, and each note keeps its
own flash.

**(e) Knobs.**
- `split`, "how wide it splits", 0.3..2, default 1. Left: a nick at the vane's edge. Right: a gap you could put a hand through.
- `zip`, "how fast it closes", 0.1..1.5 s, default 0.35. Left: open and shut. Right: tears stay open across several notes.
  `less: 0.1`.
- `grain`, "how fine the hairs are", 2..8 px, default 3. Left: a nearly solid sheet. Right: separate combed lines. `less: 8`.
- `colour`, "what it is made of", 0..2 step 1, default 0. Oxblood, slate, or dry bone.
- `presence`, leading.

**(f) Not a recipe.** The mark is made by displacing what is already there. No new marks appear, only a re-arrangement of the
hairs, whose crowding makes the flanks brighter. The white/black key rule means a melody moves between the two vanes.

**(g) State and drawing.** Marks: `{ born, s, side, W, v }`, or stateless from `CHORDS` looking back 1.2 s. Each frame: one
clip excluding open spans, one `drawImage` of the 1280×720 hair sprite with `lighten`, then the moved barbs as batched paths
in 3 brightness buckets, at most about 480 segments in about 3 strokes. Shaft: one fill. About 6 draws.

**(h)** 2D.

**(i) Closest: Woven threads** (strings). Those are curved threads that lean and knot, and each note is a new thread. Here
there are no notes-as-lines at all: the note is a hole in an existing surface, and the hair is rigid.

**(j) Trap 4, fine hairs against the fade.** Sprite ground with `lighten`, and struck hairs at full alpha. Also trap 2: the
closing is one dying exponential with no bounce, and must stay monotone in brightness.

---

## 3. Snapweed (`snapweed`)

**(a) The natural thing.** A touch-me-not pod (Impatiens). It ripens under tension, and at a touch its valves roll up from
straight to tight coils in milliseconds, and stay coiled. This is elastic with no return: all the spring is spent in one go,
and what remains is rigid. You never get to see the in-between.

**(b) Texture.** Elastic and sharp: a needle point on a strip that lets go.

**(c) One picked note.** On the attack step, a straight tapered strip stands from a base point at the note's x. It is drawn
in bone at full alpha, filled, 7 px at the base to a true point at the tip. **Pitch** sets x (7 % to 93 % of width) and
length, 520 px at the bottom of the song's range to 110 px at the top. Bases sit around y 640 and each pitch has its own
fixed lean (±18°) and curl side. **Velocity** sets how far it rolls: 0.6 turns (a hook) at v 30, 2.75 turns (a clock spring)
at v 127.

Arc length is conserved, so low notes make large loose scrolls and high notes small tight ones. Curvature grows toward the
tip: heading is `2π · turns(t) · (s/L)^2.2`, so the base stays nearly straight and the point rolls in. The roll is at full
speed from the first step: `turns(t) = T·(1 − e^(−t/0.045))·(1 + 0.22·e^(−t/0.06)·cos(2π·14t))`. By step 3 the strip is mostly
coil, it overshoots tighter, shivers twice and is still by 0.2 s. Colour falls from bone through a flash of half-life 0.06 s to
oxblood at 35 %, half-life 0.25 s, gone by 1.1 s. After 0.25 s the shape does not move at all: spent.

I considered showing a row of dim waiting needles, re-cocked after each coil, and dropped it: re-cocking is a brightness rise
with no note. The straight needle exists only in the attack's own frames.

**(d) Chord, repeat, run.** A chord stands several needles that roll into each other, and interlocking scrolls look nothing
like a burst. A repeat uses the same base and lean but **curls to the other side**, so two repeats make an S-like pair that
can be told apart at a glance, the new one straight and hot beside the old one's dim coil. Fast rising runs leave a row of
hooks, a frieze. Lightly played runs get low turn counts, so they stay hooks rather than a tangle.

**(e) Knobs.**
- `curl`, "how tightly it rolls", 0.4..2, default 1. Left: a shallow hook. Right: a tight spring.
- `spring`, "how much it shivers", 0..0.4, default 0.22. Left: it stops dead. Right: it shakes for a fifth of a second.
- `reach`, "how long the strips are", 0.4..1.6, default 1. Left: small marks. Right: scrolls that cross the frame.
- `stay`, "how long a coil stays", 0.25..3 s, default 1.1. Left: gone as it stops. Right: older scrolls stay under the new ones.
  `less: 0.25`.
- `presence`, leading.

**(f) Not a recipe.** One decision: a note is a change of shape from needle to coil, with conserved length, and it never
returns. Register and force together decide a drawing, and the marks come out as Miró-like curlicues with a true point.

**(g) State and drawing.** Marks: `{ born, m, v, sideFlip }`, where sideFlip is the count of earlier same-pitch notes (from
`CHORDS`, so it is stateless). Frame: for marks younger than 0.25 s, integrate 48 samples and fill a tapered polygon. Older
marks reuse a cached `Path2D`. At most 40 fills per frame, mostly cached.

**(h)** 2D.

**(i) Closest: Vine** (creeping stems that fork) and Calligraphy. Vine grows between notes and stays organic; this is
complete inside 0.2 s, has no growth and no forks, and each mark is one note.

**(j) Trap 2, elastic against no fake attacks.** The shiver lives in shape only, brightness never rises, and it ends by 0.2 s.
Also check "too suggestive" on low notes: tall thick strips must always read as a roll, so nothing under 0.6 turns.

---

## 4. Awn (`awn`)

**(a) The natural thing.** An ear of barley up a sleeve. Every long bristle carries tiny backward-pointing teeth, so it slides
one way and catches the other. Each squeeze of the hand walks the whole stiff ear up by exactly one notch, and it can't
come back. Children do this as a trick. The motion is a ratchet.

**(b) Texture.** Rigid and sharp. A dry hatch of bristles, with a stop that has no give at all.

**(c) One picked note.** Five herringbone columns fill the frame, stems at x = 128, 384, 640, 896, 1152, nodes every 28 px, with
a pair of straight bristles at each node, ±24° from vertical, pointing up, 320 px long. Bristles are 1 px and reach their
neighbouring column's, so the whole frame is a chevron hatch in dark straw, T about 0.2, from a sprite.

**Pitch** picks the column by register and a height within it. The note's column jumps up **by one tooth, 42 px, inside one
step**: no ease, no overshoot. And one tall chevron at that height is lit: two filled tapered bristles, 3 px at the base to a
hair at the tip, in bone at full alpha for two steps, flash half-life 0.06 s, then 35 % body in straw-red with half-life 0.5 s.
The chevron rides with the column, so later notes carry it upward by exact teeth. **Velocity** sets how long and thick the lit
pair is (160 to 320 px), never how far the jump is: one note, one tooth.

The tooth is deliberately 1.5 node spacings. A jump of a whole node would land each hair on the next hair's position and the
ground would look unchanged. At 1.5 each hair lands midway, the ghost at 0.88 interleaves, and for about 0.2 s after a note the
column's hatch is **twice as fine**. So a note reads as a jump, and also as a momentary change in the grain.

The ear only climbs, whichever way the melody goes. A falling line still climbs, in lit chevrons placed lower and lower.

**(d) Chord, repeat, run.** A chord moves each column by the number of notes it has there, and lights one chevron for each.
A repeat lights a new chevron at the same height; the old one is now 42 px above it. Repeats stack as an exact ladder you can
count. In a fast run the ghosts never clear and the rigid hatch turns into a fine fur of hairs, purely from speed, then snaps
back to coarse when the run ends. That's the widget's best moment, and it comes from the canvas fade, not from a texture change.

**(e) Knobs.**
- `tooth`, "how far one note moves it", 14..98 px in steps of 28, default 42. Left: a small tick. Right: a jump of a hand's width.
- `ears`, "how many columns", 1..7, default 5. Left: one ear takes every note. Right: narrow registers. `less: 1`.
- `awns`, "how long the bristles are", 80..520 px, default 320. Left: short teeth with black between columns. Right: long crossed
  hatch. `less: 80`.
- `stay`, "how long a lit chevron stays", 0.15..3 s, default 0.8. Left: gone before the next tooth. Right: long ladders. `less: 0.15`.
- `lean`, "how steep the bristles are", 10..45°, default 24. Left: nearly upright needles. Right: a wide herringbone.
- `presence`, leading.

**(f) Not a recipe.** Motion only one way, in fixed quanta, whatever the music does: not "bristles that react". And the half-node
tooth, which makes speed itself turn a hard hatch into fuzz.

**(g) State and drawing.** Fully stateless: for each column a sorted array of note times, and offset = `tooth · (count ≤ x.t)`, by
binary search. Lit chevrons from `CHORDS` looking back `stay`. Frame: one `drawImage` per column of a periodic sprite (a period of
8 nodes, with per-bristle length jitter so the tips are ragged) with `lighten`, then at most about 30 chevrons in 3 brightness
buckets. Under 10 draws. Bit-exact on seek.

**(h)** 2D.

**(i) Closest: Stella** (each attack steps a stripe inward) and Riley for the hatch. Stella adds; this moves a fixed structure.
Nothing here accumulates: only position changes.

**(j) Trap 6, slow nature against snap**, solved by having no slow part. And watch for moiré: crossing columns at 48° and hairs
about 11 px apart stay clear of it at the default, but `lean` and `tooth` can make them finer. Keep the interleaved spacing above
5 px, and test `lean` at both ends.

---

## 5. Suture (`suture`)

**(a) The natural thing.** A milkweed pod. A hard warty case splits along one straight seam, and what's inside is packed so tightly
that it is a flat silky sheet of parallel fibres, all combed one way. Let go, those same fibres take up fifty times the room. The
boundary between case and floss has no transition at all. What I noticed: the softness was already there, under pressure.

**(b) Texture.** Rigid and fuzzy, with the hard edge cutting straight against the fuzz.

**(c) One picked note.** One flat slab per note, dark red (`#6b1414`), square-cornered, wide and low: 380 to 560 px by 70 to 120 px,
tilted ±3°. **Pitch** sets x and, through a per-pitch hash, y in the band 120..600. **Velocity** sets the gap (10 to 60 px).

In the attack's own step the slab is already split along its long axis, with the two halves parallel-sided and moved apart. They
stop dead (P10 with τ 0.05 s, no overshoot: it is a case). The gap between them is packed with fibres running along the seam at
2 px spacing in bone at full alpha, reading as a solid hot bar with a fine grain. This is the flash, and it is small: under 3 % of
the frame.

From step 2 the same fibres loft: their ends lift out of the seam and over the halves by up to 45 px, while their brightness falls
(half-life 0.06 s, then 35 % body in warm bone, half-life 0.3 s). The loft runs at full speed from the start and is finished by
0.25 s. The halves stay rigid at 40 % red and quench by about 1.2 s.

So at 0.5 s you see two hard-edged bars with a dim ragged nap between them that crosses their edges. The contrast of those two
edges is the widget.

**(d) Chord, repeat, run.** A chord lands one slab per note, and they overlap in stacked flat colour (`lighten`, so they don't
erase each other). A repeat on a slab still alive adds a second seam on the same slab, at a position stepped along its length by
the golden ratio, at an angle of 70° to 90° across it. All pieces jump apart rigidly by another gap. So you can count repeats by
pieces (at most 4 seams, after which it restarts as a whole slab). In a fast run, slabs have their `stay` cut by the next note
in that hand, handover-style, so the picture stays "this note, then that one".

**(e) Knobs.**
- `gape`, "how far it opens", 4..90 px, default 28 (scaled by velocity). Left: a hot slit. Right: two blocks with a wide band of floss.
- `loft`, "how far the floss escapes", 0..120 px, default 45. Left: it stays packed, a clean bar. Right: it spills over the case.
- `floss`, "how much floss", 3 levels (spacing 6, 3, 2 px), default 2. Left: a few hairs. Right: a dense pelt. `less: 0`.
- `stay`, "how long it stays", 0.3..3 s, default 1.2. Left: gone almost at once. Right: broken slabs pile up. `less: 0.3`.
- `presence`, leading.

**(f) Not a recipe.** One slab, exactly one seam, and a second material inside it. It's an attack where the eye sees two opposite
textures in the same instant, and it comes from the observation about where the softness was.

**(g) State and drawing.** Marks from `CHORDS`: `{ born, m, v, seams[] }`. Frame per live mark: two to five `fill`s and one
`drawImage` of a floss sprite, chosen from 6 loft stages × 3 lengths × the density level (512×160, pre-rendered sharp fibres,
never blurred). Marks live ≤ 12, so about 60 draws at worst. Sprite stage is a function of `t`, so it's seek-exact.

**(h)** 2D.

**(i) Closest: Snap squares** (dark-red squares with a crack and an ember) and Handover. Those cracks are lines of light on a
single material. Here the crack opens on a different material, and the halves move.

**(j) Trap 1, fuzzy against crisp first:** the floss is sharp fibres from frame 0, loft changes geometry, never blur. **Dangers
beyond the list:** a vertical lens-shaped slit with white floss would be badly "too suggestive", so slabs are never upright, the
gap is parallel-sided, never a lens. And "shatter" is dropped: so one straight seam, no shards, no flying pieces, nothing
spinning.

---

## 6. Sheen (`sheen`)

**(a) The natural thing.** A pigeon's neck, or a starling's breast. The colour is not pigment, it's the angle of fine ridges on
barbules. It doesn't slide across the bird as a highlight would: it flips **patch by patch**, black a moment ago, metal now,
and each patch has its own grain direction. So fine hair has no colour until the moment it's caught.

**(b) Texture.** Fuzzy and sharp: a sheet of hairlines with a hard shingle edge. Velocity moves it from separate threads to a
solid metallic surface.

**(c) One picked note.** The frame is an invisible shingling of about 77 tiles (11 columns by 7 rows, offset rows, 116×103 px,
pointed lower edge, tessellating with a 2 px seam). Nothing is drawn until a note. **Pitch** owns a tile: column by height in the
song's range, row by `m mod 7`, so a scale walks a staircase and an octave passage a straight line. Each tile has its own fixed
grain angle, one of 6.

In the attack's own step the tile appears at full alpha, hairs 1 px at 2.5 px spacing, in a pale hot tone (`#c8ffd8`). **Velocity**
sets density: soft notes show every third hair, loud notes every hair, so soft is thread and loud is sheet.

Over the following second the tile does not move. It walks down one colour series with falling brightness: pale mint → green
(0.06 s) → blue (0.15 s) → violet (0.35 s) → gone (about 0.8 s), which is the hue going the way thin-film colour goes as the angle
runs out.

**(d) Chord, repeat, run.** A chord lights a patchwork of tiles with different grains, and the differing grains make it immediately
countable even when tiles touch. A repeat relights the same tile at full, with its grain **mirrored** (odd and even repeats), so the
sheen visibly turns over. A run walks tiles across the board. With more than about 25 live tiles it stops being countable, so
`stay` is cut by rate on unpicked material.

**(e) Knobs.**
- `catch`, "how many neighbours catch the light", 0..6, default 0. Left: exactly one patch per note. Right: a flare of adjoining patches at half strength. `less: 0`.
- `stay`, "how long the colour lasts", 0.2..2.5 s, default 0.8. Left: a glint. Right: the whole series, slowly. `less: 0.2`.
- `size`, "how big the patches are", 3 sizes (15×10, 11×7, 7×4 tiles), default the middle. Left: small scales. Right: big plates.
- `series`, "which bird", 0..2 step 1, default 0. Pigeon (green, violet), starling (bronze, blue), grouse (dark red to black).
- `presence`, leading.

**(f) Not a recipe.** There is no shape, motion, or physics word at all. The only thing that happens is that a fixed structure of
hair goes from invisible to metal. The velocity axis is a texture axis, from thread to plate, and hardly a brightness one.

**(g) State and drawing.** Stateless: look back `stay` in `CHORDS`; each live note is one `drawImage`, picked by grain, density and
colour stop from an atlas of 6 × 3 × 5 = 90 small sprites (about 5 MB, made at load, blitted 1:1 with no scaling, so the hairs stay
crisp). Under 40 draws. Stops change in hard steps, and the fade softens them.

**(h)** 2D. A shader would make smooth angle-dependent colour, which is what this should avoid.

**(i) Closest: Halftone** (dots that swell in a wave) and Glitch blocks. Those have structure that responds; here a tile doesn't
change shape and there is no wave. Kusama has a pattern too, but this pattern isn't on screen until struck.

**(j) Trap 4, plus moiré (dropped).** Two lit tiles of different grain at 2.5 px spacing would moiré where they overlap, so tiles
tessellate and never overlap, with a 2 px seam. No scaling and no rotation of the hair sprites, because resampling also makes moiré.
Check this on the 60 Hz render.

---

## 7. Clock (`clock`)

**(a) The natural thing.** A dandelion clock. It looks like a soft ball, but the surface exists only at the tips: inside are straight
rods and air. When a seed goes, it takes its bit of surface with it, leaves a hole with a clean edge and a pit, and it never grows
back. Children count puffs with it. The thing is literally a counter.

**(b) Texture.** Fuzzy made of sharp: a soft-looking shell that's plainly hundreds of straight spokes.

**(c) One picked note.** A dome of about 480 hairs, centred below the middle of the frame (640, 610) with radius 480, so the floor
crops it. No stem, no leaves, no green: dull bone, spokes at T 0.15 at the inner radius, rising to T 0.55 at the rim where small
8-hair stars at the tips overlap and make the shell.

**The number of tufts equals the number of notes this clip will hear**, known from `CHORDS`. The notes are sorted by pitch and
dealt along the arc from left to right, so low is left, high is right, and each note owns a wedge. Pitches the piece dwells on
get more arc, so the dome is a portrait of the song before it starts.

On the attack step, that note's wedge leaves the dim sprite (one clip) and is drawn from the bone sprite through a wedge clip,
at full alpha. It moves along its own ray at full speed and slows (τ 0.07 s), going 60 to 220 px by **velocity**. It doesn't drift or
float. Flash half-life 0.06 s, body at 30 %, gone by 0.45 s. What it leaves behind: a black wedge with clean sides, and at its
bottom a 5 px diamond pit at T 0.5 that remains until the clip ends.

**(d) Chord, repeat, run.** A chord takes several wedges at once, in separate parts of the arc. A repeated pitch takes the next
wedge along in its own group, so a repeated note widens a single bald patch one tooth at a time, and you can read how many times
it sounded from the width. A run bites along the arc in visible steps.

After the last note only the row of pits remains, then nothing. Like Ivory, it has a limited number of attacks, and it ends. On a
clip with more than 140 notes (not picked by hand) it thins to the loudest, spaced out, as Ivory does.

**(e) Knobs.**
- `hairs`, "how thick the fuzz is", 120..800, default 480. Left: a few visible spokes. Right: a dense pelt. `less: 120`.
- `fly`, "how far a seed jumps", 0..300 px, default 120 (scaled by velocity). Left: it goes out where it stands. Right: it leaps away.
- `stay`, "how long you see it leave", 0.15..1 s, default 0.45. Left: a blink and a hole. Right: it hangs a moment. `less: 0.15`.
- `near`, "how close we stand", 0..1, default 0.35. Left: the whole dome in view. Right: so close that only an arc of nap crosses the frame.
- `presence`, leading.

**(f) Not a recipe.** The spending: a finite stock, one piece per note, planned from the song. The picture is at its fullest before
the music starts, and the last note leaves it bare. It runs the other way from nearly every widget here.

**(g) State and drawing.** Plan at load: sorted notes → wedges. Frame: count of notes passed by binary search, one clip of spent
wedges, one `drawImage` of the 1280×720 dim sprite with `lighten`, then one clip plus one bone `drawImage` per flying wedge (at most
about 20). One path of pits, redrawn only when the count changes. About 25 draws.

**(h)** 2D.

**(i) Closest: Ivory** (a finite row, ends empty). Ivory builds up and then ends in a stomp; this only ever loses, and the note is
known by what's missing. It also comes close to a burst from a centre, but only single wedges leave, and nothing expands as a ring.

**(j) The literal trap** is the real danger here: a pale ball of spokes is a picture of a dandelion, which is why it has no stem, is
cropped by the floor, and uses `near`. If the first render reads as a flower, set `near` to 0.7 by default, where it is only an arc
of nap. Trap 5 too: it never regrows.

---

**My best idea: Quill, because a single rigid line whose bending point follows pitch makes bass throw the whole picture and treble
flick its tip, each jump countable, with a soft nap riding on a stiff thing that does not move at all between notes.**
