# 8. Sand and dust

Sand is rigid until it fails, and then it fails at once: a heap takes grain after grain with no change at all, then a whole face drops, and the new edge is exactly as straight and as steep as the old one. Look closely and the softness is a matter of distance, since a tan haze at arm's length is a heap of hard, faceted boulders under a hand lens, and a flake of mica is either fully lit or not lit at all, with nothing in between. So in almost everything below nothing moves between notes, which is what granular matter really does and is also what snap asks for.

Left out on purpose: the puffball (a soft bag that dents and fires a jet is what the user called "too suggestive"), the dust puff from a footfall (it wants to be a ring from a point), and any avalanche that runs down a slope over time (a travelling front, so a fake attack). All numbers assume 60 Hz steps. "The alpha correction" means a local copy of `alpha(T, Tprev)` from the brief, because the SNAP helper is not on main.

---

## 1. Mica (`mica`)

**(a) The natural thing.** Flakes of mica in a rock or on a wet beach. Each flake is a flat mirror that flashes only at one exact angle. Move your head a degree and a different set lights, and the same angle always lights the same set. The flakes never move. And because the surface under them is rumpled, neighbouring flakes share a tilt, so the glints line up in bands that follow the lie of the ground.

**(b) Texture.** Fuzzy from a distance, sharp up close. From across the room a note is a soft ribbon of light; on the screen it is 500 separate hard needles. If you swapped in soft dots it would be a blurry contour and the idea would be gone.

**(c) One picked note.** The ground is 24,000 fixed flakes, invisible, each with a position, a length-wise angle and a tilt. Tilt comes from a smooth noise field across the stage plus ±0.012 jitter, stored as a rank (0..1), so any band of tilt holds a known number of flakes. Pitch picks a tilt: `L = frac(0.5 + (m − 60)·step)`, step 0.017 per semitone by default. On the attack step every flake with rank within `w` of `L` is drawn at full alpha as a hard needle in bone (236, 226, 208). `w` comes from velocity: 0.006 for the softest note (288 flakes), 0.02 for the hardest (960). Pitch also sets needle length: 7 px and 1.6 px wide in the bass, 2 px and 1.2 px wide at the top, so bass notes glint as coarse grit and treble notes as fine dust. One flake in 16 near the centre of the band also gets a 9 px four-ray star for the two hold steps.

The result is one sparkling contour line across the whole screen, placed where the ground happens to have that tilt. Over the following second brightness follows a flash over a dim body (flash half-life 0.06 s, body 35 % in a dimmed brass tone, gone by about 0.8 s), and `w` narrows to 0.35 of its start along with the body. The flakes furthest from the angle go out first and the ribbon thins onto its own centre line. Nothing moves. Velocity is how wide the band is and how long it stays. It is never whether it is seen: at the floor it is still 288 needles at full alpha.

**(d) Chord, repeat, run.** A chord is several ribbons at once, and the same chord is the same set of ribbons every time. A repeat lights exactly the same needles again at full. The eye recognises it as well as counting it, since it is that note's own constellation. A chromatic run walks a ribbon across the terrain with no motion at all, one step per note, and neighbouring semitones share a few flakes so it feels connected. Very fast runs stay fine: each note is a stateless index range, and marks older than 0.35 s draw every second flake.

**(e) Knobs** (plus `presence`).
- `rumple`, "how rumpled the ground", 0..1, 0.35. Left: long sweeping ribbons that cross the screen. Right: broken into many short curls. Icon: `ICON.wave`.
- `flakes`, "how many flakes catch", 0.25..2, 1, `less: 0.25`. Left: a thin scatter of needles. Right: a dense bright band. Icon: `ICON.of.count`.
- `linger`, "how long it glints", 0.25..3, 1, `less: 0.5`. Left: gone in a quarter of the time. Right: a ribbon that stays for seconds. Icon: `ICON.fade`.
- `spread`, "how far apart the notes sit", 0.004..0.0833, 0.017. Left: a semitone barely shifts the ribbon. Right: every octave shares one ribbon, so every C lights the same line. Icon: `ICON.of.size('line')`.
- `metal`, "which mica", 0..1, 0.3. Left: cold silver. Right: copper. Icon: `ICON.of.colour`.

**(f) Why it isn't a recipe.** No particle is ever spawned and none ever moves. A note does not make anything: it looks at ground that was already there, from one angle. Pitch is a place on a fixed map, so the piece gets a geography the viewer slowly learns.

**(g) State and drawing.** No per-note state: `frame` binary-searches `CHORDS` for chords within the life of the mark and computes everything from `t = x.t − ch.t`. Flakes are built in `reset` with a seeded local generator (as Ivory does), sorted by rank in Float32Arrays, so a note's flakes are an index range and no search is needed. Each live note strokes one batched path per brightness level (centre, shoulder), through the alpha correction. Worst case about 2,500 segments in 12 paths; a picked melody about 1,000. Rebuilt only when `rumple` changes. One small star sprite.

**(h) 2D.** Batched line segments are enough.

**(i) Closest.** Contours, where a note raises a hill and isolines show it. Here the terrain never changes, and the only line is the one the note selects, written in sparks. Pointillism throws new dots per note; here nothing is thrown.

**(j) Danger: trap 4, fine and sharp against the fade.** The needles read because they are at full alpha on the strike. After that the band thins by going out flake by flake, so what remains stays above the 0.2 floor and no hair is asked to show at a low alpha.

---

## 2. Hand lens (`handlens`)

**(a) The natural thing.** A patch of sand seen at arm's length and then under a lens. The observation: nothing was added to make it soft. The haze and the boulders are the same object at two distances.

**(b) Texture.** Sharp, then fuzzy, by distance alone. There is no blur anywhere in this widget. If it were soft from frame 0, or if it stayed hard, the whole point would go.

**(c) One picked note.** On the attack step you are right up against it. 70 hard irregular polygons (5 to 9 sides, 8 sprites) appear in a cluster of radius `Rc = 120 + 280·(v/127)^1.2` px, centred at x by pitch, y at a fixed height per pitch (0.25 to 0.75 H, hashed). The biggest are 60 px across. Each grain is flat dark tone (quartz grey, amber, rust, near-black) with one lit facet, a hard-edged triangle in bone covering a fifth of its area. A loud note covers about 12 % of the frame, of which the lit facets are about 2.4 % (P12). Among them lie 400 fine specks of 3 px.

Then the view pulls away: everything, positions and sizes alike, is multiplied by `s(t) = s∞ + (1 − s∞)·e^(−t/0.09)`, with `s∞ = 0.12`. It starts at full speed and slows (P10). By 0.2 s the cluster is a fifth of its size, and by 0.35 s it is a tuft 60 to 90 px wide of 7 px grains and 1 px specks. The lit facets fade with flash half-life 0.06 s, the body holds at 40 %. The tuft hangs where it landed until about 1.2 s, thinning by whole grains (stages with fewer grains), never by softening. Pitch is place and coarseness: bass gets 40 big grains, treble 110 small ones. Velocity is how close you start.

**(d) Chord, repeat, run.** A chord is one boulder field per note in the same step, which become that many tufts. A repeat brings the boulders back right up against you at the same place, over the old tuft, and the new tuft lands 18 px beside the old one, so a repeated note leaves a countable row of tufts. A fast run keeps throwing boulders in front while a trail of tufts collects behind, which is a fair picture of a melody passing.

**(e) Knobs** (plus `presence`).
- `close`, "how close it starts", 0.3..2, 1. Left: pebbles. Right: boulders that fill the screen. Icon: `ICON.of.size('diamond')`.
- `far`, "how far it goes", 0.05..0.3, 0.12. Left: a pinch of dust. Right: stops while you can still see the grains. Icon: `ICON.lines`.
- `stay`, "how long the tuft hangs", 0.2..4, 1.2, `less: 0.2`. Left: gone almost at once. Right: a field of tufts. Icon: `ICON.of.time`.
- `grains`, "how many grains", 20..140, 70, `less: 20`. Left: a few rocks. Right: a dense rubble. Icon: `ICON.of.count`.
- `rock`, "what stone", 0..1, 0.4. Left: pale quartz. Right: basalt. Icon: `ICON.of.colour`.

**(f) Why it isn't a recipe.** The recipe bursts outward, and this does the opposite: it contracts, because only the viewer's distance changes. One decision carries it: fuzz is the same hard grains from further off. The grains have no physics of their own at all, and they keep their exact arrangement all the way down.

**(g) State and drawing.** `onChord` stores nothing that can't be derived; the mark is `{m, v, t}` from `CHORDS`, with its layout from a generator seeded by `m` and the repeat's index. Up to 70 `drawImage` calls plus one batched rect path per mark for the first 0.3 s, then one cached tuft sprite (built once per pitch and stage). A chord of six: about 420 draws for 0.3 s. A run at 16 notes a second: about 280 plus the tufts. Sprites: 8 grains in 6 tints, each with body and facet as separate layers so they can follow their own envelopes.

**(h) 2D.** Sprites.

**(i) Closest.** Pointillism (a burst of dots per note), but those dots spread and blur into a wash. These contract and never blur. Fireworks also opens outward, and that is the reverse gesture.

**(j) Danger: trap 1, fuzzy against P9.** It stays out by construction, with no blur at any point. The second danger is that contraction could look like a suction gesture, so the grains keep their arrangement exactly, with no spin and no acceleration into the centre.

---

## 3. Repose (`repose`)

**(a) The natural thing.** The angle of repose. Dry sand stands at about 34° and at no other angle. Add grains and nothing happens until a whole face slips, and the new edge is the same straight line in a lower place. The size of the failure has little to do with the size of the grain that caused it.

**(b) Texture.** Rigid. Every edge on the screen runs at +34° or −34°, and it stays true however much happens. No curves, no wobble, no easing at the stop. If the edges bent, this would be a different widget.

**(c) One picked note.** One heap per distinct pitch heard in the clip, up to 14, spaced by pitch along a low floor line at 0.94 H. No sky, no tint, no gradient: a flat sawtooth silhouette on black, kept low (at most 0.7 H) so it stays a hard-edge painting and not a mountain range. A note adds one band to its heap, an upside-down V with parallel edges, `b = 6 + 22·(v/127)^1.3` px thick and running down both flanks until it meets a neighbour. On the attack step the band is bone at full alpha. It then falls to its stratum tone (one of two near tones, alternating, so the layers stay visible) with half-life 0.06 s. Flash area is at most about 3 % of the frame. Pitch is which heap. Velocity is how thick the band is, and whether the heap gives way.

If a heap now stands more than a limit above its neighbours, the limit being `110·(1.2 − 0.6·v/127)` px, it fails **in this same step**: the toppling is worked out to the end in the plan (an abelian sandpile, sequential in the code and instantaneous on screen). The top slab of Vs drops straight down, which keeps both edges parallel to where they were, at full speed from the attack and stopping dead: `Δ·(1 − e^(−t/0.06))`, no ring. Each neighbour gains one thick band in the same step. A 2 px bone hairline marks the slip plane for the two hold steps. About a third of the fallen sand is simply gone, so the pile doesn't fill the screen. Nothing runs down the slope, no dust, no debris.

**(d) Chord, repeat, run.** A chord adds several bands in one step. A repeat adds another chevron on the same heap, so you count repeats as you count tree rings. After a slide the next repeat still adds its band at full (P7), on the lowered heap. A fast run lays one thin band per note across the heaps and may tip one or two. Notably a soft note on a pile at its limit can bring down a great deal, which is what the real thing does and is the surprise in this widget, while a loud note on a tall heap nearly always does.

**(e) Knobs** (plus `presence`).
- `angle`, "how steep it stands", 20..60°, 34. Left: low heaps with long flanks. Right: sharp spikes. Icon: a line at the angle, via `ICON.line`.
- `bear`, "how much it can bear", 0.3..2, 1. Left: small slides, often. Right: builds for a long time, then a big fall. Icon: `ICON.of.size('triangle')`.
- `thick`, "how much sand a note adds", 0.3..2, 1, `less: 0.3`. Left: hairline layers. Right: thick bands. Icon: `ICON.lines`.
- `layers`, "how many layers stay", 8..60, 40, `less: 8`. Left: only the last few bands exist, older sand is one plain mass. Right: the whole history stands. Icon: `ICON.of.count`.
- `sand`, "what colour sand", 0..1, 0.6. Left: pale bone. Right: dark red. Icon: `ICON.of.colour`.

**(f) Why it isn't a recipe.** No particles at all, despite being about sand. The single decision is that the slope never changes: a catastrophe that only ever moves a line parallel to itself. Every edge at one of two angles is a rule that could only come from looking at a real heap.

**(g) State and drawing.** Planned in `reset` from `CHORDS`: for each chord, the heap heights and the band list after it. `frame` binary-searches the chord and interpolates only the falling slab, so a seek needs no replay. Standing masses must be redrawn every step or the canvas fade eats them: fill at the alpha that holds them steady (the alpha correction with `T = Tprev`), with body at most 40 % of the flash. About 60 polygons a frame, using two pattern fills from a pre-rendered 256 px tile of hard 1 px stipple, so up close the flat mass is grain.

**(h) 2D.** Polygons and a pattern.

**(i) Closest.** Stella and ridges. Stella steps thin frames inward, ridges rolls lines by time. Here the mass stays and is reorganised by failure. Dread squares has the same feel of a stop without give, but does not accumulate.

**(j) Danger: trap 3, rigid against travelling fronts.** A slide could easily become an animation running across the pile. It stays out because the whole toppling is resolved inside the attack's step, the neighbours gain in that same step, and the only thing that moves after that is the slab, for about 0.15 s.

---

## 4. Cut (`cut`)

**(a) The natural thing.** A spade cut in wet sand stands with perfect faces and sharp arrises. As it goes, the corners go first, because a grain on a corner has the fewest neighbours holding it. The middle of each face holds until very late.

**(b) Texture.** Rigid and sharp turning fuzzy. The age of every mark is written only in its edge, and that is the whole picture. (The real thing lightens as it dries. This does not: P3 says brightness only falls.)

**(c) One picked note.** One slab per note: a rectangle with exactly straight faces, 60 to 220 px wide by velocity, aspect ratio one of four, x by pitch, y hashed per pitch into rows so they rarely stack. Flat dark colour (wet umber or the dark red of snap squares) at 40 % body, and on the attack step a 3 px bone line along its top and left faces, which dies with half-life 0.06 s. A flat brighter fill sits on the body for the two hold steps.

Then **nothing happens**. It doesn't crumble with time, which is the Ivory complaint about a dissolve. It stands until the next attack.

**(d) Chord, repeat, run.** Every later attack, anywhere, takes one step off every slab already on the screen, in that attack's own step: corners first, then the arrises, then the faces, grain by grain. Attacks are counted, not notes, so a chord is one step and makes several new slabs. After 8 steps a slab is a loose rounded patch of grains, and then it's gone. So the picture is a history readable by edge: the newest is a knife-edged rectangle, the previous one has lost its points, older ones are round, the oldest is sugar. A fast run therefore has short lives and a slow melody long ones, automatically, and the state of the screen depends on how much has been played. A repeat stands a new slab in front of the old one, slightly offset as in Ivory's twin rule, and the old one drops a step. After a long silence (a `goneBy` limit) remaining slabs only get quietly dimmer.

**(e) Knobs** (plus `presence`).
- `steps`, "how many notes a slab survives", 2..16, 8, `less: 2`. Left: gone after the next note or two. Right: a long crumbling trail. Icon: `ICON.of.count`.
- `size`, "how big", 0.4..2, 1. Left: bricks. Right: large slabs. Icon: `ICON.of.size('square')`.
- `grain`, "how coarse the crumbs", 0..1, 0.4. Left: fine sugar. Right: coarse gravel. Icon: `ICON.dots`.
- `goneBy`, "how long in silence", 0.5..8 s, 3, `less: 0.5`. Left: goes dim soon. Right: waits. Icon: `ICON.fade`.
- `wet`, "what colour", 0..1, 0.7. Left: pale sand. Right: dark red. Icon: `ICON.of.colour`.

**(f) Why it isn't a recipe.** The clock is counted in notes and the erosion belongs to the shape's geometry. A slab's edge tells you how many notes ago it was. And a dissolve with no time in it has nothing to stage.

**(g) State and drawing.** Stateless: a slab's stage is the attack index now minus its own, from `CHORDS`. Masks: for each of 4 aspects, 9 stages at 256 px, built once with a per-grain `hold = distance to the nearest corner·k + noise`, thresholded with hard 2 px grains. A coloured copy per colour, cached. At most about 16 `drawImage` calls and one path for hot faces. The cheapest widget here.

**(h) 2D.** Sprites.

**(i) Closest.** Squares-snap and handover. Handover's slab shrinks away as the next one lands; this one stays its size and loses its edge, and a screenful of ages stands together. Squares fades in time, this in notes.

**(j) Danger: "no fake attacks".** Crumbling is the very thing the user objected to on Ivory. It stays out because the crumbling occurs only on a real attack and is whole in that step. Between notes the picture does not change at all.

---

## 5. Forks (`forks`)

**(a) The natural thing.** Wind ripples on a beach. The first thing you notice after their regularity is the forks: a crest line that splits into two, because the sand has to fit one more ripple there. Everything around the fork bends a little to make room. There is an exact count: a fork is one extra line. (A crystal's edge dislocation is the same thing.)

**(b) Texture.** Rigid and sharp: ruled lines with a knife crest, lit on one side and cut to black on the other. They don't flow, they jump to their new position and stop.

**(c) One picked note.** The ground is a field of ruled lines, wavelength 22 px, about 12° off vertical, at 24 % brightness. Each line has a sawtooth profile: brightest right at the crest, hard cut on one side, falling to black across 70 % of the wavelength on the other, so it has no soft bands and no moiré. It stands still.

A note puts one fork into it. In the phase field, `φ = 2π·(x·cos θ + y·sin θ)/λ + Σ q·atan2(y − yᵢ, x − xᵢ)`, with `q = +1` if the melody rose to this note and `−1` if it fell, so a rising line's forks open upward and a falling line's open downward. On the attack step the whole field is rewritten: lines near the fork are displaced by up to half a wavelength, the far ones by less, all in one step, and a hard-edged hexagon of radius `70 + 110·v/127` px around the core shows the same lines at full bone. That patch falls with half-life 0.06 s to a dark red body at 40 %, gone by about 1 s. Position: x by pitch, y fixed per pitch (hashed, 0.2 to 0.8 H). Velocity: size of the patch.

**(d) Chord, repeat, run.** A chord puts several forks in one step, all the same sign. A repeat adds another line at the same core, so a fork becomes three tines, then four. You literally count tines (beyond 4 extra forks go 30 px aside). The last 8 forks are kept. The ninth note heals the oldest **in the same step**, so all change occurs on an attack. A fast run rewrites at most 20 times a second, and each rewrite is one step of a stripe field jumping, which reads as a shudder.

**(e) Knobs** (plus `presence`).
- `fine`, "how fine the lines", 12..48 px, 22. Left: fine ruling. Right: big bands. Icon: `ICON.lines`.
- `keep`, "how many forks stay", 1..16, 8, `less: 1`. Left: only the last note has one. Right: a field full of dislocations. Icon: `ICON.of.count`.
- `ground`, "how much the lines show between notes", 0.2..0.4, 0.24. Left: nearly dark. Right: a strong ground. Below 0.2 the 8-bit tail eats them, so that is the floor. Icon: `ICON.alpha`.
- `patch`, "how much lights up", 0.4..2, 1, `less: 0.4`. Left: just the fork. Right: a wide patch of bright lines. Icon: `ICON.of.size('dot')`.
- `tone`, "what colour", 0..1, 0.7. Left: bone and tan. Right: bone and dark red. Icon: `ICON.of.colour`.

**(f) Why it isn't a recipe.** It is topology. A note changes the number of lines on the screen by exactly one, permanently, and you can count that by eye. No other widget in the collection has a mark whose identity is a count of tines.

**(g) State and drawing.** A Float32 phase array at 640×360. Adding a charge needs no `atan2`: one table of `atan2` for all offsets (1279×719 floats, 3.7 MB) is looked up, about 0.3 ms per charge. Phase is stored unwrapped per pixel, so no branch-cut problem arises. Rendering through a 256-entry sawtooth lookup into an alpha mask is about 1 ms, and only on attacks, into two tinted canvases. Each frame: one `drawImage` of the ground, redrawn at the alpha that holds it, plus one clipped `drawImage` per live patch. `frame` draws under 10 images. Seek rebuilds from the last 8 attacks. Upscaled ×2, so the crest is about 2 stage pixels, which I judged sharp enough; if not, it needs WebGL.

**(h) 2D.** Field changes only on attacks, so it can afford CPU. WebGL would be sharper but doesn't earn the context.

**(i) Closest.** Riley, where music bulges and warps a stripe field. Here nothing bulges or ripples: the lines jump and stand, and the note changes their count, not their shape.

**(j) Danger: "no moiré" and P12.** There is only one line set, so nothing can beat against it. Two steps of a phase jump leave a ghost of the old lines under the canvas fade for 0.09 s, which I expect to read as a snap rather than as interference; the wavelength floor at 12 px keeps this honest. Bone stays inside the patches: the largest hexagon is about 9 % of the frame, but only its crests are bright, so about 3 % of the frame is actually bone for one loud note. On a very loud chord, shrink the patches so that the total stays under 6 %.

---

## 6. Load (`load`)

**(a) The natural thing.** A jammed pile of grains under load, as photographs of stress-lit discs show it. Most grains carry nothing. The whole weight runs in a few stiff chains, and the grain right beside a chain may be idle. A tap reroutes the network with nothing visibly moving.

**(b) Texture.** Rigid. It takes the blow and nothing moves: no position change in the entire widget, no ring, only load appearing in what is already locked.

**(c) One picked note.** The ground is a slightly jittered triangular lattice of about 1,100 grain cells, radius 15 px, drawn as one sprite at 22 % (or off). Notes above the middle of the clip's range start at the top edge and press down; those below start at the bottom and press up, so the two hands push towards each other. The start cell's x is by pitch. On the attack step the chain is there whole: from the start cell the load walks through touching cells toward the far side, and at each cell has a 25 % chance of splitting, with load shared. It stops when the load falls below 0.12. Each link is a thick bar from cell centre to cell centre with butt ends, width `3 + 24·load` px, along one of the lattice's three directions, plus a filled hexagon for each cell lit. So it is a stiff zigzag of struts 3 to 27 px thick. Bone at full alpha for the two hold steps, flash half-life 0.06 s, then rust at 40 %, half-life 0.25 s, gone by 0.8 s. Velocity is load at the start (0.45 to 1), so how deep the chain goes: a soft note lights 8 to 14 cells, a hard one crosses the screen. Every note has at least the first 8 (P6).

**(d) Chord, repeat, run.** A chord lights a chain per note in one step. Where chains share a cell they thicken, and where a bass chain meets a treble one the two hands visibly lock. A repeat rewires: the chain is seeded by pitch and repeat index modulo 3, so it starts in the same cell but goes a slightly different way, as the real thing reroutes. Each repeat is at full and countable. In a fast run, chains overlap in rust and the bones stay separate.

**(e) Knobs** (plus `presence`).
- `depth`, "how far a note reaches", 0.4..2, 1, `less: 0.4`. Left: a short stub. Right: crosses the screen. Icon: `ICON.of.size('line')`.
- `branch`, "how much it splits", 0..0.6, 0.25, `less: 0`. Left: one single chain. Right: a whole network. Icon: `ICON.of.lines`.
- `stay`, "how long the load stays", 0.25..3, 1, `less: 0.5`. Left: a blink. Right: a network that stands for seconds. Icon: `ICON.fade`.
- `idle`, "how much the idle grains show", 0 or 0.2..0.4, 0.22. Left: only what is under load exists. Right: the pile is visible. Icon: `ICON.dots`.
- `tone`, "what colour", 0..1, 0.6. Left: pale bone. Right: dark rust. Icon: `ICON.of.colour`.

**(f) Why it isn't a recipe.** Sand with no grain ever moving. The decision is that it is a picture of force in something that doesn't give, so a chain is a stress in a fixed structure and not an object that goes anywhere, and the two hands press against one another.

**(g) State and drawing.** Lattice and contact graph in `reset`, from a seeded local generator. Chains computed in advance per `(m, repeat mod 3)` and cached, at most 60 segments each. Stateless from `CHORDS`. Bars batched by 5 width buckets, per note: at most 8 live notes, so at most 40 paths and about 480 segments, plus 1 ground sprite. Cheap.

**(h) 2D.** Thick batched lines.

**(i) Closest.** Cells, where each note makes a Voronoi tile. Here the cells are all there first and never change: only load runs through them. Chord lightning, dropped, is the risk (see below).

**(j) Danger: "no bolts", and trap 3.** A branching bright path could read as lightning. It stays out because of the lattice (only three directions, no jagged random angles), width (thick struts with blunt ends, no tapered hair), no glow, no flicker, and a chain that is whole within the hold and never runs from one end to the other. If it still looks like a bolt in the first render, turn branching off and keep only the single strut chain.

---

## 7. Stillness (`stillness`)

**(a) The natural thing.** Sand on a shaken plate or a drum skin. The sand goes to where the skin does not move, so the figure you see is a drawing of the silence. I reverse the order: in the real thing the figure gathers over seconds, and that would be a fade-in. Here the figure is there at once and only comes loose afterwards.

**(b) Texture.** Sharp going fuzzy: a tight line of hard grains that loosens into a soft band of the same grains, and the softness is honest (each grain is still a hard 2 px square).

**(c) One picked note.** One field across the whole stage: `F = cos(nπu)·cos(kπv) − cos(kπu)·cos(nπv)`, on coordinates warped by ±0.04 of low-frequency seeded noise so that it never has mathematical mirror symmetry (a real plate is held at a point, and its figures are lopsided). `(n, k)` comes from a hand-picked table by pitch: low notes few lines, high notes many. On the attack step 2,000 grains (1,400 for the softest, 2,800 for the hardest) sit exactly where `|F| < ε`, sampled with a generator seeded by the pitch. They are hard 2×2 px squares in bone at full alpha, making a figure of lines 3 to 5 px thick. Over the following second the flash falls to a body of 35 % and each grain moves away from its line by its own fixed offset times `spread(t) = 40·(1 − e^(−t/0.5))` px, so the lines loosen into fuzz. No front, no sequence: everything at once, slowing all the time, and already dim while it happens.

**(d) Chord, repeat, run.** A chord is one figure, not several: amplitudes sum in `F`, so the harmony has one shape and the same chord is always the same shape. A repeat is the best moment here: the same grains are pulled **tight** again in one step, so the loosened fuzz snaps back to a hairline, and the eye can count the tightenings. In a run the figures change entirely per note, like cards dealt, and can get too fast above about 8 notes a second. At that rate only keep the top note's figure at full grains and thin the rest to 800.

**(e) Knobs** (plus `presence`).
- `grains`, "how many grains", 500..4000, 2000, `less: 500`. Left: a dotted line. Right: a solid one. Icon: `ICON.of.count`.
- `tight`, "how tight the line", 0..1, 0.6. Left: a broad band. Right: a hairline. Icon: `ICON.lines`.
- `loosen`, "how fast it comes loose", 0.1..2 s, 0.5. Left: fuzz almost at once. Right: stays sharp for a long time. Icon: `ICON.of.time`.
- `reach`, "how far the grains wander", 0..120 px, 40. Left: stays a line. Right: dissolves into a cloud. Icon: `ICON.of.blur`.
- `bent`, "how lopsided", 0..0.1, 0.04. Left: perfect mathematical figures. Right: bent like a hand-drawn wire. Icon: `ICON.wave`.

**(f) Why it isn't a recipe.** Physics is turned around on purpose (the finished figure first, its coming loose after), and the population is not spawned by notes. Harmony gets a recognisable shape.

**(g) State and drawing.** `reset` builds nothing but the warp. Each distinct pitch set is sampled once at first need (a rejection loop of about 20,000 evaluations, about 1 ms) and cached. Age from the chord. At most 2 live figures, 2 batched rect paths: 4,000 to 5,600 rects at worst, the heaviest idea here. Fallback if it costs too much: sprite the crisp stage and only move grains in the top figure.

**(h) 2D.**

**(i) Closest.** Harmonograph (a figure per harmony, but as a line tuned by ratios) and Halftone (dots by a field). Whitney, dropped, is the ghost nearby: mathematical dot patterns. The warp and the fuzz are what keep this away from it.

**(j) Danger: dropped territory (rings and moiré), plus "no fake attacks".** The table excludes any `(n, k)` whose figure shows concentric closed loops; this check is done by eye once at build time. Only 2 figures are live and the older is loose fuzz, so hard lines never cross hard lines. This is the riskiest idea in the essay, and the one I would prototype only after the others.

---

## 8. Catkin (`catkin`)

**(a) The natural thing.** Tap a hazel catkin. The stem whips and is back in place within a moment. The pollen, so light that air stops it within a centimetre, stays hanging exactly where the tip was when it let go. So the observation: the shaking is over and the cloud marks where it had been.

**(b) Texture.** Sharp point on an elastic stem, leaving fuzz. The contrast is the widget: a hard needle back in its line and, standing beside it with a clear gap, a soft cloud.

**(c) One picked note.** A comb of horizontal tines rooted at the left margin, one per distinct pitch in the clip, up to 24, spaced evenly up the stage. Long in the bass (0.75 W) and short at the top (0.15 W), as on a music box. Each tine is a 1.5 px hair tapering to a needle, at 35 % while idle, and it stays where it is. On the attack step, the tine is drawn in bone already bent: tip displacement `A·e^(−t/0.07)·cos(2π·7t)`, `A = 18 + 70·(v/127)^1.4` px, bending along the length as `(s/L)²`. It rings out and is still by 0.25 s, with brightness falling throughout (P3). At the same step, a tuft of 600 hard 1.5 px grains, spread over the last third of the tine's length and 14 px deep, appears at the tip's peak. It is shot a further 30 px along the bend at `1 − e^(−t/0.05)` and stops dead. Then it hangs, sinking 6 px a second, thinning by whole grains (5 stages, keeping grains above the 0.2 floor) until gone at 1.2 s. Pitch is which tine. Velocity is the whip and how far away the cloud is.

**(d) Chord, repeat, run.** A chord whips several tines in one step. A repeat whips to the other side, so an alternating pair of clouds stands above and below the tine, and a third goes 22 px further than the first. So repeats are countable clouds. A fast rising run goes up the comb like a harp and leaves a staircase of clouds, which is where I'd expect this to shine on Rachmaninoff. Breaks only if the same tine repeats faster than about 8 a second: the whip restarts at full each time (P7), and that may look like trembling, so `A` halves above that rate.

**(e) Knobs** (plus `presence`).
- `whip`, "how hard it whips", 0.3..2, 1. Left: a small flick. Right: a wide lash. Icon: `ICON.wave`.
- `pollen`, "how much it lets go", 0.1..2, 1, `less: 0.1`. Left: a few grains. Right: a dense cloud. Icon: `ICON.of.count`.
- `hang`, "how long it hangs", 0.2..5 s, 1.2, `less: 0.2`. Left: gone quickly. Right: a stack of clouds. Icon: `ICON.of.time`.
- `gap`, "how far the cloud stands off", 0..2, 1. Left: the cloud clings to the needle. Right: stands far away. Icon: `ICON.of.size('dot')`.
- `hue`, "what colour", 0..1, 0.25. Left: pale bone. Right: strong yellow. Icon: `ICON.of.colour`.

**(f) Why it isn't a recipe.** The cloud's whole meaning is its place: where the needle no longer is. It carries the extreme of a motion that is already over. Velocity becomes a distance between two textures.

**(g) State and drawing.** Stateless from `CHORDS`, with the repeat index counted in `reset`. Tine shapes are one path per moving tine (a 12-point polygon), idle tines one batched path. Clouds are pre-rendered 5-stage sprites in 4 lengths, one per colour: `drawImage` per live cloud. Under 40 draws a frame.

**(h) 2D.**

**(i) Closest.** Hammer (a bar struck, a thin line ringing) and woven threads. Hammer's line stays straight and rings in light. Here the line rings in position, and the note's memory is a separate thing beside it.

**(j) Danger: trap 2, elastic against P3, and "too suggestive".** The rebound must not read as a second note, so it dies in 0.25 s with brightness only falling. Horizontal hairlines, no swelling and no drip keep it away from the tall trembling shape the user disliked. No catkin is ever drawn.

---

My best idea is **Mica**: nothing moves and nothing is spawned, every note just lights its own fixed needles along a contour, so it is a ribbon from afar, hard sparks up close, and the same note is recognisably the same sparks every time.
