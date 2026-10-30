## Design Critique: WinkelAmp v0.1

Self-critique of the first working build, from the screenshots in `docs/media/`
(run with the `design:design-critique` framework). Stage: first full prototype.
The "Status" column says what was done about each point.

### Overall Impression
The welcome screen is clear and inviting: three plain-language doors, with the demo
emphasized. In the app, the art is strong, but at first the controls competed with it.
The panel covered the right quarter of the stage, and bright looks blew out to white,
which erases the colors the whole concept depends on.

### Usability
| Finding | Severity | Recommendation | Status |
|---|---|---|---|
| Bright scenes with long trails/drift saturate to pure white (06): color, the core of the synesthesia, disappears | 🔴 Critical | Compensate exposure: the more the feedback loop keeps, the less new light is added per frame | Fixed |
| The Look panel covers ~22% of the stage and the visual stays centered behind it | 🟡 Moderate | Shift the visual's center into the free space while the panel is open, animated | Fixed |
| Record button is a plain white dot that reads like a status light, not an action | 🟡 Moderate | Tint it red, the universal "record" cue | Fixed |
| The full progress bar for live sources (demo/mic) looks like a finished song | 🟢 Minor | Make live sources visibly "live": pulse the bar with the beat | Fixed |
| Mirror segments are ~33px tall, under the comfortable 44px touch size | 🟢 Minor | Raise to 40px | Fixed |
| Patch-bay meters are tiny and unlabeled | 🟢 Minor | Fine for v1: the tooltip explains them. Revisit with users | Open |

### Visual Hierarchy
- **What draws the eye first**: the welcome screen leads with the logo, then the warm demo card. That's correct. In the app it's the visual, then the glowing Surprise button. Good, since that's the experimenting entry point.
- **Reading flow**: panel top to bottom goes from big, safe choices (scene, colors) to feel (sliders) to symmetry to actions, with the advanced patch bay last and collapsed. That's progressive disclosure done right.
- **Emphasis**: The selected scene card and selected swatch are clear. Muted slider end labels (Calm / Wild) stay quiet but readable.

### Consistency
| Element | Issue | Recommendation |
|---|---|---|
| Accent color | Yellow is used for every "selected" state and slider fill; consistent | Keep |
| Icon buttons | The record dot breaks the outlined-icon style | Red fill marks it as special on purpose (done) |
| Copy | Plain words throughout ("Calm ↔ Wild", "Sound → Motion", "Surprise me") | Keep. Avoid "BPM" jargon? Kept, since it's widely known to music lovers |

### Accessibility
- **Color contrast**: Primary text #f4f2f8 on near-black is about 17:1. Muted text (62% white) is about 7:1 over dark glass. Passes AA, though over a very bright visual it relies on the panel's blur and darkening.
- **Touch targets**: Play is 46px, icon buttons 40px, swatches about 50px. Mirror segments were too small (fixed).
- **Text readability**: 12px uppercase section labels are the floor. Body copy in help is 14px/1.55.
- **Motion**: The visuals are inherently intense. `prefers-reduced-motion` disables UI transitions. A "gentle" default (lower Mood) for reduced-motion users is a good follow-up.
- **Keyboard**: Everything is reachable, with visible focus rings. Scenes, palettes and mirror use `role="radio"` with `aria-checked`.

### What Works Well
- Three-door onboarding that doubles as the browser's required click-to-start-audio.
- Pulse scene: twelve note-lights placed where their color sits on the wheel make the notes→color mapping *legible*, not just pretty.
- Painting with a mirror turns a simple drag into a mandala. It's instantly rewarding.
- The interface steps aside on its own after a few seconds of stillness.

### Priority Recommendations
1. **Protect color from blow-out**: exposure compensation tied to Trails/Drift (done).
2. **Give the art the free space**: recenter while the panel is open (done).
3. **Make live vs. finite sources obvious**: a beat-pulsing live bar (done).
