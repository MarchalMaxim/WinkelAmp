# Muscle and tendon: nature's fast machines

Looked at closely, nothing fast in nature is fast because of muscle: muscle is slow, so it loads a spring behind a latch, and
the strike is a change of geometry that takes a thousandth of the loading time. What the eye gets from these machines is
mostly two-state: crimped or taut, cocked or thrown, this way bent or that way, with no stable place in between, and the
softness lives in a narrow part (a gap, a hinge, a tendon) while everything around it stays stiff. I left the heart and the
jellyfish bell out on purpose: every honest form I found for them swells and pulses, which is the user's "too suggestive", and
the one thing I wanted from them (relaxing is slower than contracting) is in Striation.

**Shared terms.** `px(m) = 40 + 1200·(m−21)/87`, `py(m) = 660 − 600·(m−21)/87`. `u = (v/127)^1.5`, where `v` as heard already
carries a picked note's `amount`. `t = x.t − ch.t`. Flash: 1 for `t < 0.033`, then `0.5^((t−0.033)/0.06)`. Body: at most 0.4,
half-life `0.25·2^((60−m)/24)` s. Colours: BONE (236,226,208), HOT (214,58,40), EMBER (122,18,22). Bone covers at most 6 % of the
frame in a step; past that, the extra notes flash HOT. Soft marks go through the alpha correction. Hairlines are drawn opaque
in a colour scaled by the envelope, because low alpha would vanish.

---

## 1. Crimp (`crimp`)

**(a) The natural thing.** A tendon under the microscope. At rest its collagen fibres are not straight, they are crimped in a
fine irregular wave. The first bit of load only takes the crimp out; then the fibre is straight and suddenly stiff. There is
almost nothing between slack and stopped.

**(b) Texture.** Fuzzy to sharp, and the change is the note. Nap at rest, razor under load.

**(c) One picked note.** A ribbon of 11 parallel horizontal hairlines, 3 px apart, 33 px tall, centred on `y = py(m)`. Its x
centre comes from a seeded hash of the pitch, so the same pitch lands in the same place. Length `L = 420 + 560·u` px.
- On the attack step all 11 are dead straight, 1.25 px, opaque BONE, each cut ±30 px by a hash so the ends form a sharp stair.
- They hold for 2 steps.
- From `t = 0.066` the ribbon is a sprite: crimp amplitude `A(t) = 5·(1 − e^(−t/0.18))` px, wavelength 9 to 14 px, a different
  phase on every line. Length shrinks to `0.91·L`, so the tips withdraw by 9 % exactly as the slack comes in. That length is
  what taut means: a straight fibre is longer.
- Colour falls from flash to the EMBER body. By 0.4 s it is a matte, woolly strip at about 25 %; it is gone by 1.2 s.
- Pitch is the height; velocity is the reach.

**(d) Chord, repeat, run.** A chord pulls several ribbons taut in one step, a stack of razors at their own heights.
A repeat yanks the same ribbon straight again from wherever it has got to, at full flash, and it is the most satisfying moment
in the widget: fuzz to razor, in place. A run is a rain of straight sheaves turning woolly behind the newest note. Live ribbons
are capped at 16, the oldest dropped.

**(e) Knobs**, plus `presence`.
- `slack` "how fuzzy it goes", 1..9 px, default 5. Left: it stays almost straight. Right: it goes to wool.
- `reach` "how long a bundle is", 0.3..1.4, default 1, `less: 0.3`. Left: short dashes. Right: right across the screen.
- `fibres` "fibres in a bundle", 3..21, default 11, `less: 3`. Left: a few clean lines. Right: a dense pelt.
- `stays` "how long it stays", 0.4..3 s, default 1.2, `less: 0.4`. Left: gone at once. Right: wool lies around for seconds.

**(f) Why not a recipe.** Nothing moves across the screen and the brightness envelope is not the idea. The decision: softness
after the attack is geometry, not blur. The mark goes crisp-to-soft by losing its tension, and fuzz is many sharp lines out of
step.

**(g) State and drawing.** Stateless from `CHORDS`; each frame scans the live window. Pre-render 6 amplitudes × 3 seeds of an
EMBER sprite, 1024×84, about 6 MB total, built in `reset`. Each line gets its own slow wander so neighbouring lines never beat.
Frame: up to 16 `drawImage` crops through the alpha correction, plus one path of straight segments for ribbons still flashing
(under 100 segments). About 20 draws.

**(h) 2D.** Sprites do it.

**(i) Closest: woven threads** and **hammer**. Threads are always wavy and always there; hammer's line rings around straight.
Here a line is straight only while struck and never rings: it goes slack.

**(j) Danger: traps 1 and 4**, and moiré. Fuzz from step one would be mush; the straight step is what keeps it out. Fine lines
stay readable because the strike is opaque and the sprite carries the nap. Phase and wander per line keep neighbouring waves from
making beat patterns. If they ever do, it is dead (moiré was dropped).

---

## 2. Interlock (`interlock`)

**(a) The natural thing.** The rim of a flytrap, and the jaws of a trap-jaw ant. The observation: the two rows of spikes do not
meet, they pass between each other, and the closed thing is a mesh, not a line. It shuts in a tenth of a second and takes hours
to reopen. And further stimulation after closing tightens it: a repeat goes deeper.

**(b) Texture.** Sharp and rigid. It should feel as if it could hurt.

**(c) One picked note.** A horizontal seam at `y = 360`, invisible until used, with the whole keyboard along it. The note fires one
pair of long needles at `x = px(m)`:
- The upper needle comes from above the top edge, its tip crossing the seam to `360 + bite`, with `bite = 24 + 70·u` px. It is an
  isosceles triangle 520 px long with base `b = 8 + 36·u`, so a soft note is a splinter and a loud one a wedge.
- The lower needle comes up from the bottom edge, offset right by `b/2`, its tip to `360 − bite`.
- Each leans ±2.5° by a hash of the pitch.

On the attack step both are already fully in, opaque and hard-edged: upper BONE, lower HOT. No travel, no ring. It stops dead.
2 steps of hold, then EMBER body. Withdrawal is the opposite of the strike: `(t/1.4)^1.8` of the way out, starting from nothing,
so at 0.5 s the tip has moved only about 60 px and the mark is already dim. By 1.4 s it has left.

**(d) Chord, repeat, run.** A chord bites at several places in one step. A repeat is a ratchet: while the needle is still out,
the same pitch drives it 24 px deeper than before, up to 200, at full flash, and it gets wider at the seam on its own because the
needle is a wedge. Rachmaninoff's repeated chords become visibly tighter blows. A scale run zips the seam shut, note by note,
and the travel is the music's own, not staged.

**(e) Knobs**, plus `presence`.
- `bite` "how far they cross", 0..2, default 1. Left: tips just meet. Right: they go deep past each other.
- `width` "how wide a needle", 0.3..2, default 1. Left: hairline splinters. Right: heavy wedges.
- `stays` "how long they take to pull out", 0.3..4 s, default 1.4, `less: 0.3`. Left: gone at once. Right: the mesh stays a while.
- `ratchet` "how much a repeat drives in", 0..40 px, default 24. Left: a repeat only flashes. Right: each one goes visibly deeper.

**(f) Why not a recipe.** The two sides miss each other on purpose: the offset by half a tooth makes the black zigzag between
them the actual picture. And the repeat-as-ratchet comes straight from the plant.

**(g) State and drawing.** Stateless: for each live note, a backward scan over the same pitch inside the last 1.4 s gives its depth.
Frame: 3 batched paths (BONE, HOT, EMBER) holding up to 60 triangles each. Under 10 fill calls.

**(h) 2D.** Triangles.

**(i) Closest: ivory**, one key per note placed by pitch. Ivory stands up from a ground, rounded and milky, and stays until the
stomp. These come from two sides, cut, mesh, and leave on their own clock. Flee's needle shape is a bolt, not a stop.

**(j) Danger: "picture of teeth".** Straight sides, no lobes, no curve, no pink, and the needles run the full height of the
frame so it is a seam across a screen, not a mouth. Trap 3 does not apply since everything is whole on the step. Trap 6: the slow
reopening stays quiet because it starts from zero speed and the mark is dim by the time it moves.

---

## 3. Striation (`striation`)

**(a) The natural thing.** A muscle fibre's stripes. A contracting fibre does not shrink its dark bands: they keep their width
exactly and slide over each other, only the pale gaps close. A second fact: a motor unit fires all or nothing, and force is
graded by how many units are recruited, not by how hard each pulls.

**(b) Texture.** Rigid and elastic, kept strictly apart: the bars are rigid, all the elasticity is in the gaps.

**(c) One picked note.** A comb of 97 full-height vertical bars, spaced 13.2 px apart, 2, 3 or 4 px wide by a hash, stands at about
25 % EMBER. On the attack step, `n = 9 + 28·u` bars around `px(m)` slide together until they stop at 0.6 px apart, forming a solid
slab 32 to 133 px wide. No bar changes width. The bars beyond the slab are dragged in by `edge·e^(−D/70)` in the same step, so
gaps next to the slab open to about 3 times their width. Recruited bars flash HOT, with BONE on the middle 21 at most (5.9 % of
the frame). They release together: `s(t) = e^(−w/0.16)·cos(2π·1.39·w)`, with `w = t − 0.033`, so slightly past rest (about 8 %) and
back by 0.7 s. Relaxing takes about three times as long as contracting. The eye sees light collect because bars crowd, and then
disperse. Pitch is where; velocity is how many bars, never how far they pull: every recruited bar goes all the way.

**(d) Chord, repeat, run.** A chord makes separate slabs. Displacements add, and one pass from left to right enforces the 0.6 px
stop, so twitches that overlap simply cannot pass each other. A repeat after 0.3 s pulls a visibly relaxed slab shut again;
faster, the slab barely moves but the flash restarts at full. A fast run in one register fuses into a held-shut slab with flashes
on it (tetanus, the real thing), and it lets go when the run stops: that release is the last note's own relaxation, not an event.

**(e) Knobs**, plus `presence`.
- `fibres` "how many bars a note pulls", 0.3..2, default 1, `less: 0.3`. Left: a sliver. Right: a broad slab.
- `spacing` "how far apart the bars are", 10..28 px, default 13.2, `less: 28`. Left: a dense comb. Right: a few bars far apart.
- `ground` "how much of the comb stands", 0..1, default 0.6. Left: only bars near a note exist. Right: the whole comb stands at rest.
- `release` "how fast it lets go", 0.06..0.5 s, default 0.16. Left: a twitch. Right: a slow unclenching.
- `give` "how far it springs back past rest", 0..1.5, default 1 (scales the negative lobe). Left: stops at rest. Right: an elastic swing.

**(f) Why not a recipe.** Brightness comes from density. Rest and strike are the same bars, and the same total of bar: a
contraction does not add stuff, it moves it. The neighbours paying for the slab with wider gaps is what makes it feel like one
tissue, not a highlight on a comb.

**(g) State and drawing.** Stateless from `CHORDS`. Each frame: positions for 97 bars from up to 40 live notes (under 4000
multiplications), then one left-to-right pass. 3 batched rect paths by colour. Under 6 fill calls.

**(h) 2D.**

**(i) Closest: ikeda** (barcode bars) and **halftone**. Ikeda's bars flicker as data, and halftone's dots swell in a wave. Here
the bars are permanent and never change size, and a note is the comb pulled tight at one place, whole in one step.

**(j) Danger: moiré and trap 2.** A moving comb over its own 12 % ghost can beat, which is why spacing has a floor of 10 px and
widths vary by hash. The rebound stays small and slow enough not to read as a second note, with no brightness rise.

---

## 4. Buckle (`buckle`)

**(a) The natural thing.** A flytrap lobe, a tin lid, a hair clip: snap-through. The shell has two stable shapes and no stable
midpoint. The observation: you never see it halfway, and after the snap it stays snapped until something pushes it back.

**(b) Texture.** Rigid and elastic. Straight rigid arms on a hinge that gives only in one place.

**(c) One picked note.** Up to 9 flat bands run the full width of the frame, stacked at equal spacing, each 40 px thick. Each
band is two dead-straight segments meeting at one crease, at `x = px` of its pitch, and the crease points up or down by 60 px. Each
distinct picked pitch gets its own band (above 9, nearest pitches share). On the attack step that band has already flipped: the
crease has jumped from +60 to −60 and past it, overshoot `0.15 + 0.35·u` of the depth, ringing at 14 Hz with τ 0.05, gone in 0.2 s.
The arms never curve. Heat, all at once: a stretch `200 + 1080·u` px long around the crease is BONE, the rest HOT, 2 steps, then down
to EMBER 40 % and to rest at 30 %. The band is then still there, flipped. Pitch is which band and where it creases. Velocity is how
much of the band heats and how far it overshoots, never whether it flips.

**(d) Chord, repeat, run.** A chord flips several together. A repeat flips the same band back, so a repeated note is literally
click, clack, and the eye can count parity. A run flips bands one after another. Because neighbouring bands can face each other, long
black wedges and diamonds between them open and shut. The picture at any moment is the exact record, mod 2, of what has been played.

**(e) Knobs**, plus `presence`.
- `bands` "how many bands", 3..14, default 9, `less: 3`. Left: a few big bars. Right: a tall stack of them.
- `depth` "how deep the crease", 12..120 px, default 60. Left: nearly flat. Right: sharp chevrons.
- `thick` "how thick a band", 6..64 px, default 40. Left: wires. Right: slabs nearly touching.
- `stays` "how long a band stays after its last note", 0.5..30 s, default 8, `less: 0.5`. Left: a band exists only around its note. Right: everything stands.

**(f) Why not a recipe.** No easing and no midpoint: the code has no in-between value to draw. The whole state is parity, counted from
`CHORDS`, which no widget in the collection remembers.

**(g) State and drawing.** Stateless: per band, a sorted array of attack times, and a binary search gives the count and the last
attack. Frame: up to 14 polygons plus 3 hot ones. Rest level drawn with the settling alpha for 0.3.

**(h) 2D.**

**(i) Closest: boogie woogie** (flat bands) and **squares-snap**. Those flash and go. Buckle answers by changing a permanent
shape; the old chevron stays for a moment as the canvas's own ghost, which reads as flip.

**(j) Danger: "too suggestive", and rigid wobble.** A smooth bow would make eye-shaped lens gaps, so the crease is a straight
hinge and the gaps are diamonds. The ring lives only at the crease and is over in 0.2 s (trap 2). Static bands could look like wallpaper
under a dense passage: `stays` is the cure.

---

## 5. Latch (`latch`)

**(a) The natural thing.** Trap-jaw ant, mantis shrimp, flea. Muscle loads a spring slowly behind a latch; the release takes
milliseconds. The observation: the strike's power comes from how long it had to load, and during loading almost nothing shows.

**(b) Texture.** Rigid and elastic: a stiff lever on a spring, stopped dead against a stop.

**(c) One picked note.** `CHORDS` is known in advance, so **the silence before a note is what charges it**. `gap` is the time since
the previous chord; `charge c = 1 − e^(−gap/0.9)`. A rigid straight needle, 2.5 px at its pivot tapering to a point, length
`180 + 280·u` px, is pivoted on the floor at `(px(m), 680)`.

- Before the note, for `min(0.85·gap, 1.0)` s: the needle leans back from its stop (+4°) to `−(8° + 52°·c)`, opaque dark red at about
  25 %, moving most at first and almost still by the note, `θc·(1 − (1−τ)^2.2)`. A held breath: all motion dies before the note.
- On the attack step: the needle is at its stop. The swept sector between cocked and stop is drawn as one flat triangle, HOT, with
  a BONE sliver on the leading 5°, 2 steps, flash half-life 0.06 s. At most about 12 % of the frame, of which 1 % is BONE.
- After: two small chatters against the stop (2.5°, 16 Hz, τ 0.05), the needle standing as EMBER body, gone by 0.8 s.

Pitch is where. Velocity is how long the needle is; the wait is how far it is thrown. So a soft note after a long silence is a thin
wide sweep, and a loud note in a run is a long stiff flick.

**(d) Chord, repeat, run.** A chord's needles load together and fire in the same step, each to its own length. A repeat pulls the
same needle back from where it stands and throws it again, by exactly as much as the gap allows. A fast run has no time to load, so
it is a picket of 8° flicks, and the first note after it, after a breath, lands enormous. That is the point.

**(e) Knobs**, plus `presence`.
- `wait` "how much a silence charges it", 0.2..3 s, default 0.9. Left: every note is thrown wide. Right: only long silences throw far.
- `load` "how early it leans back", 0..1.6 s, default 1. Left: no wind-up, just the throw. Right: leaning for over a second.
- `reach` "how long a needle is", 0.5..1.5, default 1. Left: short levers. Right: tall ones.
- `stays` "how long it stands after", 0.2..3 s, default 0.8, `less: 0.2`. Left: only the throw. Right: a picket stays.

**(f) Why not a recipe.** The gap, not the velocity, sets the size of the strike. It is the only widget here that reads the
musician's waiting, and the rubato of a Rachmaninoff phrase lands directly as how far things fly.

**(g) State and drawing.** Stateless: binary search for last and next chord. Frame: up to 30 needles and 8 sectors, in 3 batched paths.

**(h) 2D.**

**(i) Closest: hammer** (a struck bar) and **gust** (wedges shoving air). Gust's wedges travel; this wedge is the trace of a pivot
and is gone in three steps. It is not **blade** either: that was a dim wedge you had to have explained to you.

**(j) Danger: no fake attacks and P1.** Last night's design declined wind-up, so this is a deliberate exception and it has to
earn it. The loading is dim, never brightens, has no front, and has stopped moving before the note, so no brightness precedes the
peak. If the user dislikes it, `load = 0` removes it and the gap still sets the throw. Needles never swell, so the tall-shape
check passes.

---

## 6. Sinew (`sinew`)

**(a) The natural thing.** A stretched tendon or band. The observation: stretched elastic gets thinner. Its width is how tight it
is, and that is the only thing it has to say. And when something slips off it, it recoils and hums.

**(b) Texture.** Elastic and sharp. One taut line with miter-sharp corners, on rigid stops.

**(c) One picked note.** One closed band runs through 7 pegs, ordered by angle around their centre, so every peg touches it. Each
note drives in a new peg at `x = px(m)`, `y = 120 + 480·frac(i·0.618)` (i the note's index, stable under seek), and the oldest peg is
pulled out in the same step. Band width is `9·(3000/P)²` px, clamped to 1.25..30, where P is the current perimeter: a wide leap
pulls the whole band thin, and a tight cluster lets it go fat. Attack step: the two segments meeting at the new peg are BONE at 1.6
times the width, the peg a hard 7 px square. The new peg is reached instantly and there is no overshoot: it is a stop. The corner where
the old peg was recoils to straight with τ 0.04 s, then that freed segment hums: `18·(v/127 + 0.3)·e^(−t/0.06)·sin(πs)·cos(2πft)`,
with `f = 7000/length` Hz, gone by 0.25 s. Pitch is x. Velocity is how hard it hums and the peg size.

**(d) Chord, repeat, run.** A chord replaces several pegs in one step and the whole silhouette jumps. A repeat moves nothing, as the
peg is there: its two segments flash and hum at full, in place. A run makes the shape jerk, angrily, every note a new silhouette;
with `pegs` at 3 it is a triangle snapping around the keyboard.

**(e) Knobs**, plus `presence`.
- `pegs` "how many pegs hold it", 3..14, default 7, `less: 3`. Left: a triangle. Right: a jagged star.
- `tight` "how much stretching thins it", 0..1, default 1. Left: always the same width. Right: from a hair to a strap.
- `fill` "how filled the inside is", 0..0.6, default 0.25. Left: only the band. Right: a dark flat mass with a jumping outline.
- `hum` "how long a freed stretch hums", 0.02..0.2 s, default 0.06. Left: goes dead straight. Right: quivers (still dying fast).

**(f) Why not a recipe.** Width comes from the perimeter, so nobody decides it per note: the melody's span sets the tension of the
one line, and a leap reads as strain. New peg is rigid, old corner elastic: the two halves of the same step have opposite textures.

**(g) State and drawing.** Stateless, from note index: the last 7 notes give the polygon, and the mix of the recoil and hum needs only
the last few notes. Frame: one stroke (miter join, limit 12), one fill, up to 3 short polylines of 16 points, up to 14 pegs in one path.

**(h) 2D.**

**(i) Closest: hammer** (one line ringing) and **miró** (flat shapes on lines). Hammer's line stays in place; this one's shape is the
last seven notes. Whitney is not close: there is no rotation or pattern.

**(j) Danger: trap 2.** Hum could turn into shiver, or a "trembling" that reads too suggestive. It is short, only on the segment just
freed, and always straight within 0.25 s. A low note in the middle of a dense chord could be lost in a large silhouette, which
is why the peg itself flashes (P6).

---

## 7. Louvre (`louvre`)

**(a) The natural thing.** A wing's primaries. On the downstroke they press together and seal into one wall; on the upstroke each
twists on its own axis so air slips through. The observation: the wall does not fade or leave. It turns edge-on, and it is gone
without having moved.

**(b) Texture.** Rigid and sharp. Hard flat slats, hairlines at the end.

**(c) One picked note.** A solid rectangle at a fixed tilt of 18°, centred at `(px(m), hash)`, length `180 + 340·u`, depth 120 px.
On the attack step it is a single sealed sheet: BONE for 2 steps, no gaps, one knife edge. It is cut along its length into 11 slats that
each then turn on their own long axis, all at once, not in sequence: `θ(t) = 84°·(1 − e^(−t/0.22))`, drawn width `w·cos θ`. By 0.27 s
half the coverage is gone, by 0.5 s it is a comb of 1 to 2 px lines. Colour: BONE to HOT to EMBER by flash, then opaque with a
darkening colour, so the lines stay sharp. Brightness falls first by coverage, then by colour. Gone at 0.9 s. Slats' far tips spread by 2° in all as
they turn, a slight unfolding. Pitch is where. Velocity is how long the sheet.

**(d) Chord, repeat, run.** Chord: several sheets at once, overlapped, all parallel. A repeat shuts the same slats back into a wall in
one step, which reads very clearly. A run leaves combs in different stages of opening; because they share a tilt they layer
like Boogie Woogie instead of tangling.

**(e) Knobs**, plus `presence`.
- `slats` "how many slats", 3..24, default 11. Left: a few broad louvres. Right: a fine comb.
- `size` "how large a sheet", 0.4..2, default 1. Left: small tiles. Right: big walls (over 1, the flash is HOT rather than BONE).
- `stays` "how long it stays", 0.3..3 s, default 0.9, `less: 0.3`. Left: a blink. Right: the comb hangs around.
- `tilt` "how it slants", 0..90°, default 18. Left: level. Right: upright.

**(f) Why not a recipe.** It dies by rotation and never by fading: a solid slab reaching hairlines without ever being a dim slab.
That also answers trap 4, since the fine edge is opaque.

**(g) State and drawing.** Stateless. Up to 12 live sheets × 11 quads, in 3 batched paths. Under 6 fill calls.

**(h) 2D.**

**(i) Closest: handover** and **squares-snap**. Those slabs shrink or ember. A louvre keeps its outline and comes apart from inside.
**Gust** has wedges; these are parallel and do not travel.

**(j) Danger: trap 3.** The opening must not read as a front or a second event, so all slats turn together, from the first step, at
falling speed. Also "picture of blinds": the tilt and the free-floating sheet keep it from looking like a window.

---

## 8. Hop (`hop`)

**(a) The natural thing.** A kangaroo: the tendon gives back the energy at each ground contact, so the body does nothing at the top
of the arc. The observation: flight time is set by gravity alone, so height is a clock. Same gravity for the whole piece means
`h = g·gap²/8`, so rubato becomes a height you can see.

**(b) Texture.** Elastic on rigid: an elastic body against a floor that gives nothing.

**(c) One picked note.** One small flat rigid rectangle travels from note to note on a true parabola, with `g = 1500 px/s²`: a gap of
0.25 s rises 12 px, 0.5 s rises 47, 1 s rises 187, and 2 s leaves the top of the frame. In flight it is dim (EMBER, 30 %), about
30×18 px, stretched along its motion near the floor. The canvas fade alone draws its trail. On the attack step it lands at `(px(m),
650)` as a plank 90 + 60·u px wide and 7 px tall, BONE for 2 steps, pressed 5 px below the floor line and back within 0.1 s. It leaves
a flat EMBER imprint on the floor at 40 %, fading by the body half-life, so recent rhythm stays readable along the floor. Pitch is x.
Velocity is plank width and imprint life. The gap is the height.

**(d) Chord, repeat, run.** A chord lands as one plank spanning lowest to highest note, so a wide chord is a wide slam, flash in BONE up to
6 % and HOT beyond. A repeat goes straight up and down, a dribble, each one countable. A fast run flattens to a skitter under 12 px and is
read from the imprints. Gaps over 2.2 s are off-screen: it comes back in on the last 1.1 s of a 2.2 s parabola, so it cannot arrive as
a bolt.

**(e) Knobs**, plus `presence`.
- `gravity` "how heavy it is", 400..4000, default 1500. Left: floaty high arcs. Right: hard low skips.
- `plank` "how wide a landing is", 0.5..2, default 1. Left: a tap. Right: a slam.
- `stays` "how long the floor remembers", 0.2..3 s, default 0.9, `less: 0.2`. Left: only the landing. Right: a lit trail of landings.
- `flyer` "how much the thing in the air shows", 0..1, default 0.6. Left: nothing flies, only landings. Right: the arc is plain.

**(f) Why not a recipe.** One law, one constant, the whole piece: a musician reads the phrase's timing as heights, without a graph.

**(g) State and drawing.** Fully stateless: previous and next chord give position. Frame: 1 flyer, up to 40 imprints, 1 flash, 2 paths.

**(h) 2D.**

**(i) Closest: handover**, which also goes "this note, then that one", and **flee**. Handover hands over in place; here the thing
crosses the gap, and the crossing is the information.

**(j) Danger: cute, and no fake attacks.** It is one step from a karaoke bouncing ball and the user may simply laugh. Hard corners and
no squash beyond the plank are what stands against that. The fall accelerates into the note, so it is anticipation of the kind
Latch avoids; the flyer stays dim, and `flyer = 0` removes it. If any of these go first in a cull, this one should.

---

**My best idea is Crimp: the note itself is a change of texture, fuzz yanked into razors and let go again, which makes crisp-first-soft-later a matter of geometry instead of blur.**
