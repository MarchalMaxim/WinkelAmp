# Mountain King C: Infinity hall

**Piece:** Grieg, *In the Hall of the Mountain King* (Karajan, Berlin Philharmonic), 0:00-2:30.
**Show:** `mountain-king-c-infinity-hall` (open as `/?show=mountain-king-c-infinity-hall`). Build: `build-mountain-king-c-infinity-hall.mjs`.
**Concept:** One Kusama mirror room, seen as a corridor. Five copies of kusama sit one inside the other, each smaller and a little more turned, and each one hears its own strand of the music. The piece is one long crescendo and accelerando. The corridor grows room by room, and every room's net tightens with its own strand's speed. In the frenzy, fold mirrors the corridor. In the coda, each hammer blow tears one room away with pixel sort, and then the picture cuts to black.
**Keywords:** accelerando (the nets close in), frenzy (fold's kaleidoscope), mountain cave (a dark maroon wall around a lit corridor), goblins and gnomes (colonies of dots swarming on every note of the tune).
**Palette:** Kusama's flat pairs: red with cream, yellow with black, blue with cream. Each room floods to a new pair when its own strand's harmony changes. The cave is the same red at a fifth of its strength.

## What to judge

- **Kusama as the only hero:** five instances in small copies, nested, one strand each. Does it read as a room, or as flat frames?
- **Kusama + fold (untested until now):** the mirror folds the twisted frames into diamonds and pentagons, with see-through mirror halves.
- **Kusama + pixel sort (untested until now):** the blows drag each removed room into strips of its old colours.
- **A dim kusama as a ground (new):** a second kusama, full screen, at 18-28 % weight, hearing only the tune's B-minor phrases. It makes a cave wall that does not go muddy.

| time | scene | stack, lead -> ground (what each one hears) | what to watch for |
|---|---|---|---|
| 0:01-0:04 | Horn out of silence | heart (kusama, small copy 0.40, turned 15°) on the horn's held F#4; black around it | A spare entrance: one red window out of the dark |
| 0:04-0:55 | Statement 1: the corridor in the cave | heart (the tune, every eighth) -> clock ring 0.51 (phrase entries; from 0:04) -> footfalls ring 0.80 (the pizzicato plucks; from 0:12) -> **cave**: kusama full screen, dim, on the tune's B-minor units | The tiptoeing pp. The rooms flood blue and yellow on their own harmony, the cave stays dark maroon with a rare grey colony. When a ring floods to yellow on black, it turns into dark glass |
| 0:55-1:11 | Statement 2: the hall lights up | heart -> clock -> footfalls -> **hall**, full screen, on all notes. It replaces the cave on the violins' first note (0:55.3) | One switch from cave to lit hall, exactly on a note. The net patches stay longer on louder notes |
| 1:11-1:42 | F# half and the push | + violins ring 0.64 (the violins' top line). Five rooms | The nets tighten with the accelerando and pile up at the edges through the push |
| 1:42-2:06 | The frenzy | **fold** (all notes; the fold line turns with the bass, and loud chords fold it fourfold) over the five rooms; the clock adds the cymbals, the footfalls the stamping bass | The strongest frames: the twisted frames fold into diamonds and pentagons, with see-through mirror halves |
| 2:06-2:11 | Last A, the fastest unit | fold with 2 folds (a kaleidoscope, sixfold on loud chords) | The hall spins out of control |
| 2:11-2:16 | The break | one kusama, full screen, size 1.8, the tightest net, on the hammered B-minor chord and the turn; the rooms are hidden | The music stands still: the corridor collapses into one huge room under a dome of net |
| 2:16 | Hush | black | 0.4 s of near silence |
| 2:16-2:28 | Coda: six blows | **pixel sort** (band 1.6, len 1) on the blows, crashes and chords; the five rooms return in their frenzy colours, and blows 2-5 each remove the outermost room | Each blow tears a room into strips. The heart holds the held breath alone, on black |
| 2:28-2:29 | General pause | black | Real silence |
| 2:29-2:30 | Three strokes and the crash | pixel sort on the final strokes; the rooms reopen from the heart outward, stroke by stroke | The final crash tears everything, then a hard cut to black |

**Serendipity:**
- **The corridor.** One widget, five times, in nested small copies, each turned a little more. The music's strands become rooms, and the fold in the frenzy turns those rooms into polygons nobody drew. (The composer's idea.)
- **Black becomes glass.** Kusama's yellow-on-black pair is see-through in a small copy, so a ring that floods into it becomes a pane of dark glass over the room behind. (Found by the composer in the preview.)
- **The coda runs the build backwards.** The corridor is torn down room by room, and the last strokes rebuild it from the heart outward.
- **A cave of kusama on the minor key only.** My first try dimmed the full hall on all notes. Its floods to cream and yellow went grey and olive at low weight, which looked like mud. A dim copy that hears only the B-minor phrases keeps the dark red. In the composer's version, the first 51 s had pure black around the corridor; now that space is a cave wall.

**Knobs off our defaults, and why:**
- **tight 0.15, driven by rate at depth 1:** the net closes in with the accelerando.
- **flip 1 and stay 10 on the rings:** each frame shows its strand by colour.
- **Hall stay 3, driven by level:** loud notes leave their net longer, so the net piles up in the push and the frenzy.
- **Cave flip 0, on minor-only notes:** floods are at most about one per 8 s, and since the cave hears only B-minor phrases, the wall held its dark red in the preview.
- **The horn note at size 1.8 (a per-note value):** an attempt to make it read in the small heart.
- **fold folds 2 in the last A only.**
- **pixel sort band 1.6, len 1.**

**Known weak spots:**
- In 0:55-1:42, neighbouring rooms often flood to the same red and cream (B minor and F# major both map to the red pair). Their frames merge into flat red slabs with a dotted column of tune in the middle.
- The push (1:27) has no gesture of its own beyond the nets piling up.
- The horn's colony (0:01-0:04) is still a tiny dot: at velocity 32 in a 0.40 room, even size 1.8 does not make it read.
- Some pitches are nominal: the frenzy's cymbals, and the final chord and crash in pixel sort.
