# Romeo and Juliet, 6. Coda: B "Ink and wash"

**Piece:** Tchaikovsky, *Romeo and Juliet* fantasy-overture, the coda. It has five parts: the funeral march over timpani, the love theme broken, the consoling woodwind chorale, the love theme transfigured over the harp, and the timpani roll with the hammered B major chords. Then a cut-off.

**Concept:** It comes from the Prince's "The sun, for sorrow, will not show his head". The coda is one night turning into a grey dawn over Horizon's sea, pinned at mid-height, and every thread is drawn on that one line.

**Keywords:** funeral march timpani, love theme broken, Friar Lawrence chorale, tragic ending.

**Palette:** sepia ink blots, a dimming rose-and-bone web, a grey dawn sea, the lovers in vermilion and cobalt.

**Show:** `shows/romeo-juliet-6-coda-b-ink-and-wash.json`. **Build:** `build-romeo-juliet-6-coda-b-ink-and-wash.mjs` (this folder).

## What to judge

- **Rorschach on its side** (untested). It is a full-screen small copy rotated 90 degrees, so the blot's fold lies on the horizon and every timpani stroke is a blot with its reflection in the sea. Does the cortege read as ink on water?
- **Rorschach with blend "lighten"** (untested) at the climax. The dark ink bodies drop out and only the gold rims, tentacles and specks survive. Is it crisper, or too thin for the loudest music?
- **Fifths masked to the sky** (untested). The web is seen only above the line, a sun that never rises, with a dim copy under the water. Is a 50-second spare passage on one web right for the quietest music, or too empty?
- **Mandala masked to the sea** (untested). The harp's lace, seen only under the line, reads as a wreath in the water.
- **Duet as a small copy** high in the sky, with the cycle's pair (as in love B and return B). The open question: does Duet's flat, saturated liquid belong beside tonal ink and a Sugimoto sea?
- **Horizon as the story's clock.** It is night through the march and chorale, the dawn comes with the transfiguration's crescendo, fate darkens it again under the blows, and it brightens on the last blow.

## Timeline

| time | scene | stack, lead -> ground (what each widget listens to) | what to watch for |
|---|---|---|---|
| 0:00-0:02 | silence | black | |
| 0:02-0:47 | funeral march | **rorschach** on its side (soot and gold, ink 2) on `fate-march` (all 37 timpani strokes from the audio) -> **duet** small copy in the sky on `love` (the broken love theme, per note: pull 0.55, push 1.9) -> **horizon** night sea on `ground` | One blot and its reflection per stroke. The last six strokes die away. The lovers are flung apart on each phrase. |
| 0:46-0:50 | the breath | the ink dries out; the lovers fade; the night sea alone | Stillness, with no new events. |
| 0:50-1:41 | consoling chorale | **fifths** masked to the sky on `chorale` (winds + chords, decay 30, line 2.2, fill 0.5, shiver 0.2) -> **fifths** twin masked to the sea at 0.4 -> **horizon** night, swelling a little at 1:13-1:23 | A half-risen rose crown sitting on the line, its reflection dim in the water. Deliberately spare. |
| 1:41-2:20 | love theme transfigured | **duet** returns on the first love note (1:42.4), pressed together (pull 2, push 0.25, split 84) -> **mandala** masked to the sea on `harp` (485 arpeggio notes) -> **fifths** sinking away -> **horizon**, dawn rising to full by 2:06 | The grey dawn arriving with the crescendo; the wreath of lace in the water under the reunited lovers. |
| 2:20-2:38 | the roll and the hammered chords | **rorschach** on its side, blend lighten, on `fate-end` (the roll's audio onsets, small blots growing; then the 8 ff bursts, spatter 3) -> **horizon**, the sky darkening again (presence 0.8 -> 0.4) | The dawn taken back. Crisp gold splashes mirrored on the line at each blow, with no brown murk. |
| 2:38-2:46 | the last blow and the last chord | **rorschach**: the last blow turns every drop bone (ink 5, size 1.25) -> **horizon**, brightening again | A pale flower mirrored on the line, the only ink paler than the dawn. Hard cut with the orchestra at 2:46. |
| 2:46-3:00 | silence | black | |

**Serendipity:**
- (composer) Rorschach turned on its side, so its fold becomes the horizon.
- (composer) The window's see-through turns soot into a sepia wash: literally ink and wash.
- (composer) Fifths cut in half by the sea line: the sun that will not show its head.
- (composer) Mandala as a funeral wreath in the water.
- (composer) The bone flower as the last image.
- (review) Blend "lighten" on the closing ink. With a bright sky, it left the ink only in the dark water, which was striking. Darkening the dawn under the blows brings back the mirrored splashes and makes the bone flower the one thing brighter than the morning.

**Review changes:**
- The climax was a brown murk; now it uses lighten plus a darkened sky.
- The duet now takes the cycle's pair 0, is smaller, and sits in a soft ellipse, so its masses are no longer cut by the window's edge.
- The lovers' still ghosts over the chorale were removed.
- The web's shiver is calmed to 0.2.
- The night sea is a touch more present under the march.
- Tried and reverted: a separate strings web in the water. Its arcs barely showed.
