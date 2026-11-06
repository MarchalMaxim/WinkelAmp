# Toolbox ratings (the user's, from the sketch lab)

Standing policy (the user, 2026-10-30): "start working on widgets that I love [build them into the app], start crafting
V2 or V3s for widgets that I liked, and start polishing the ones that needed work." Goal: 100+ abstract widgets, each
parametrised by features of the music. Fan out widely; budget is not a constraint.

## Round 1 (index.html, Prelude)
- casket (melt + drips + chord cuts): LOVE ("the slashing is insanely good") → being built into the app
- dread squares: like; fade faster, blurrier edges → v2
- yellow ovals: needs work: more skittish, more varied shapes, fleeing with non-linear (cubic) speed-up → v2 "flee"
- wanderer: reacts to the tones very well; should be a thin wave in the fluid → v2 "current"

## Round 2 (round2.html, Prelude), 2026-10-30
- dread squares v2: LOVE (said "love it actually")
- skittish ovals v2: keep ("can stay, in some cases they are good")
- the current: keep
- piano strings: needs work ("boring")
- murmuration: needs work ("more expressive")
- shatter: DROP ("too physical, we should aim for abstract")
- ripples: keep
- chord lightning: DROP ("too physical")
- rorschach ink: LOVE ("wow, love it. Parametrize the hell out of it")
- casket: LOVE
Principle from this round: abstract, not physical/literal imagery (glass, lightning are out).
Next: the user wants to try them on Beethoven's 5th too.

## Round 3/4 notes (chat, 2026-10-31)
- woven threads (strings v2): accepted the defaults (good as is)
- murmuration v2: rated "needs work" but "the one I like most so far... I really am in love with this one". Fix: the re-forming
  into new shapes is driven by something unclear (make the trigger and the target figure clearly musical); the params are
  hard to grasp (fewer, plainer knobs).
- ripples v2: DROP (user doesn't like it; drop the whole ripples line)
- for the next round (tomorrow morning): FEWER params per widget, and an infographic per param (a small picture showing what it does)
- rorschach v2: LOVE ("in love with it"); played with the controls but wants OUR DEFAULTS kept
- kandinsky: LOVE++ ("fell off my chair... by itself already a complete visualization"). Tone it down a little: it overlaps
  with dread squares (its low red squares). User touched knobs but wants OUR defaults restored.
- moire: DROP ("not appropriate for what I'm trying to achieve")
- colour fields: KEEP ("a good building block")
- marbling: KEEP, needs work: "extremely high potential", but "doesn't respond correctly to the sound" → tune the sound mapping

## Where every widget stands (end of 2026-10-30 session; buttons from ratings.json "chrome" + chat)
| widget | verdict | notes |
|---|---|---|
| casket (melt + cuts + drips) | LOVE | built into the app (commits 426a529..4004356) |
| dread squares v2 | LOVE | |
| rorschach v2 | LOVE | keep OUR defaults |
| kandinsky | LOVE++ | "a complete visualization by itself"; tone down the overlap with dread squares; keep OUR defaults |
| skittish shapes v3 (flee) | LOVE (button) | |
| the current v3 | LOVE (button) | |
| woven threads (strings v2) | LOVE (button) | accepted defaults |
| murmuration v2 | needs work, FAVOURITE | re-forming must be clearly music-driven; fewer, plainer knobs |
| marbling | needs work, keep | "extremely high potential"; doesn't respond correctly to the sound |
| colour fields | keep | a good building block |
| ripples | DROP | |
| moire | DROP | |
| shatter, lightning | DROP | too physical |
| calligraphy (brush), glitch blocks, op art (riley), halftone, harmonic web (fifths), suprematism, contours, tunnel, scribble, pointillism | not judged yet | carry into the morning round |

The user (verbatim): "This is the way to go and it is the direction I want this project to go."
Next round (morning 2026-10-31): fewer knobs per widget, and a small infographic per knob showing what it does.

## Direction (the user, 2026-10-31, night)
"Apparently we have some requirement that the music alone drives the visualization. That is not necessary at all! In the
tests, I liked the visualizations more than the current state of the project with the listening to the microphone and the
MIDI and stuff. So: the goal is to move towards the visualizations as they are in the demo page. Please don't get yourself
restricted because of some prototype we made earlier!"
→ The overnight WebGL port of the loved widgets was stopped (squares had landed in src/stage before the stop).

## Round 6 (2026-10-31): after the visual-music pioneers
Fourteen new widgets, all **not judged yet** (see `round6/README.md`, `showcase/31-…` to `44-…`, `showcase/00-showreel-round6.mp4`).

| widget | verdict | notes |
|---|---|---|
| fischinger (Optical Poem formations) | not judged yet | |
| mclaren (Synchromy panels) | not judged yet | horizontal bars in the panels, not upright stripes |
| lenlye (scratched film) | not judged yet | |
| whitney (dot rosettes from intervals) | not judged yet | |
| klee (polyphony mosaic) | not judged yet | |
| miro (Constellations) | not judged yet | |
| delaunay (simultaneous discs) | not judged yet | |
| albers (Homage to the Square) | not judged yet | |
| lewitt (wall drawings by rule) | not judged yet | |
| ridges (Unknown Pleasures) | not judged yet | |
| matisse (cut-outs) | not judged yet | |
| kusama (dots and infinity nets) | not judged yet | |
| ikeda (black-and-white data) | not judged yet | |
| horizon (Sugimoto seascape) | not judged yet | meant to sit under other widgets |

## Rounds 5 and 6 judged (2026-10-31, afternoon; buttons from ratings.json "chrome")
The user rated the morning round (5) and the pioneers round (6) together. Version judged in brackets.
- LOVE: murmuration (v3, was needs work), marbling (v2, was needs work), miró, delaunay, lewitt, kusama, ikeda,
  horizon, graphic score, boogie woogie, halftone (all new), op art (riley v2), glitch blocks (v2), calligraphy
  (brush v2). Still loved: dread squares (v2), skittish shapes (v3), the current (v3), woven
  threads (strings v2), rorschach (v2), the casket, kandinsky (v2).
- KEEP: colour fields (v2), fischinger, mclaren, len lye, klee, ridges, kline, cells, nebula, pixel sort, mandala,
  harmonic web (fifths) (all new). On pixel sort the user said it already combines with other widgets "in a very cool way".
- NEEDS WORK: matisse, harmonograph, hilma af klint (all new).
- DROP: whitney, albers (moved to `tools/dropped/`).
- Not rated (left unjudged): suprematism, contours, tunnel, scribble, pointillism, agnes martin.

## Where every widget stands (2026-10-31, after rounds 5 and 6)
| widget | verdict | judged on |
|---|---|---|
| casket | LOVE | building into the app |
| dread squares | LOVE | v2 |
| rorschach | LOVE | v2 (keep OUR defaults) |
| kandinsky | LOVE | v2 ("a complete visualization by itself") |
| skittish shapes (flee) | LOVE | v3 |
| the current | LOVE | v3 |
| woven threads (strings) | LOVE | v2 |
| murmuration | LOVE, favourite | v3 |
| marbling | LOVE | v2 |
| miró, delaunay, lewitt, kusama, ikeda, horizon, graphic score, boogie woogie, halftone | LOVE | new |
| op art (riley), glitch blocks, calligraphy (brush) | LOVE | v2 |
| colour fields | keep | v2 |
| fischinger, mclaren, len lye, klee, ridges, kline, cells, nebula, pixel sort, mandala, harmonic web (fifths) | keep | new |
| matisse, harmonograph, hilma af klint | needs work | new |
| whitney, albers | DROP | new |
| ripples, moire, shatter, lightning | DROP | earlier rounds |
| suprematism, contours, tunnel, scribble, pointillism, agnes martin | not judged yet | |

## 2026-11-01, the tagging aside
- DROP: hilma af klint (moved to `tools/dropped/`): "I don't even like it at all."
- Retagged from the user's own words: woven threads (strings), kline, murmuration, rorschach (see `tags.json`).
- Reworked: kline v3 (fades without motion, a colour knob), rorschach v3 (a how-present knob).

## 2026-11-06, Chopin Nocturne Op. 48/1 micro scenes (first half), as theme proposals
Shows `shows/nocturne-micro-a1..a5-*.json`; analysis `docs/compositions/chopin-nocturne-48-1/ANALYSIS-A.md`.
- a1 lantern and keys: LOVE. "The solemness of the little light goes well with the sad entrance. Great theme." The current (one thread) on the first three melody notes, then huddled Ivory on the rising line, Hammer on the off-beat chords, Snap squares on the bass, fields.
- a2 slabs and threads: great, once the chord squares were milky white instead of "the incongruent red". Handover on the melody's long notes, Pluck on the turn, milky Snap squares on the off-beat chords, Hammer on the bass, fields. Snap squares got a `milk` switch for it.
- a3 ivory peak: first version not liked. Fireworks on the beat chords were "not very congruent with the things they are connected to". The rework, with bone Mica on the chords and milky bass squares around Ivory, was judged "ok sure, fine".
- a4 lantern into the chorale: first version not liked. Crimp's red mesh was "not congruent with the slow pace of the music there". The rework, with slow milky squares on the chorale and Hammer bells on the cadence and roots, was judged "fine".
- a5 octave storm: LOVE. "Extremely good. You nailed the connections here, and the widgets are very appropriate for this part!" Fireworks on the hammered chords, Interlock on the climbing and trembling bass octaves, Pluck on the left-hand arpeggios, Hammer on the octave melody falling from C7, fields.
- What this says: a widget's character has to fit the strand it is tied to and the music's pace. Fireworks belong on real blows (a5), not on routine chords under a melody (a3). Busy red textures do not suit slow, quiet passages (a4).
