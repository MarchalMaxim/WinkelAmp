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
