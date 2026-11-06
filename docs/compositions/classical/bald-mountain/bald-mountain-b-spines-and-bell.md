# Night on Bald Mountain · B · Spines and the bell

**Piece:** Mussorgsky / Rimsky-Korsakov, *Night on Bald Mountain* (9:40).
**Show:** `bald-mountain-b-spines-and-bell` (build: `build-bald-mountain-b-spines-and-bell.mjs`).
**Concept:** the nature widgets on a contour map. The mountain is a glowing topographic map. A field of spines, the gathered spirits, stabs toward Chernabog's blows. At the church bell the field turns one last time and lies down. At daybreak the night page lightens, step by step, to day paper.
**Keywords:** witches' sabbath, demons and ghosts, church bell, daybreak.
**Palette:** copper and blue contour lines on black, dark-teal spines, brick-red woolly strips on a slant, silver-violet shards, pale sugar slabs, then Agnes Martin's bands going from night to rose-and-blue to day paper.

## What to judge

- **Six widgets never tried in a show:** contours, urchin, crimp, mica, cut and martin. Pluck is the only one that has been in a show before.
- **Contours as the base of a storm.** Its mirrored map often reads as a symmetrical mask, Chernabog's face. Is it a good ground for the whole night?
- **Urchin on sparse tolls.** Each blow turns the field and it stabs. The 20 biggest blows turn the whole field. At the bell, all 11 strokes turn it to one spot.
- **Two crimps in a slanted window (the gale).** The violins' and the violas' tremolo whirls are woolly strips flying up the mountain at 16 degrees. The violin band holds its height. The viola band below it moves with the violas' pitch.
- **Mica on the loud, brittle shrieks** (never on soft notes, after the concerto verdict). The spread is pushed up, so a shriek glints across the whole sky.
- **Cut on the hammered chords.** A new chord stands a pale slab, and each later chord wears the earlier slabs away. Do the slabs read as knife-sharp, or as lumps?
- **Martin as a dawn.** It works as a chain of eight pages, each one lighter. Is the middle of the chain, now rose and blue, beautiful or still murky?

## Scenes

| time | scene | stack, lead -> ground (what each listens to) | watch for |
|---|---|---|---|
| 0:00-0:16 | Out of silence, Whirl I | crimp gale (violin tremolo) -> pluck (deep bass) -> contours (all notes) | a lone bone strip on black, then the copper map rises: often a demon mask |
| 0:16-0:42 | Brass blast I, Db blows | urchin (blows) -> mica (shrieks) -> 2 crimps (violin, viola tremolo) -> pluck -> contours | the spine field is born on the first blow (0:16.3); full-field turns on the peaks |
| 0:42-0:47 | General pause | nothing; one crimp strip at 0:45 | the show's one total black, then a single strip on the pp trill |
| 0:47-1:13 | Whirl II, Brass blast II | as at 0:16 | two parallel strips that pull apart and close up as the violas move |
| 1:13-1:32 | Spirits gathering, hammering | cut (diminished pulses, dominant hammer) -> urchin (field brightens) -> mica -> crimp -> pluck -> contours (held back) | slabs stand, then crumble one step per chord |
| 1:32-1:58 | The D world | mica (octave cries) -> urchin -> pluck -> contours -> martin night page (D pedal, cries, winds) | the night page the dawn will later light; silver flecks on it |
| 1:58-2:41 | Outburst, Bb strikes | urchin -> mica -> 2 crimps -> pluck -> contours | the map follows the form: full on the blows, cool pits when it falls back |
| 2:41-2:52 | Low wind hush | urchin at rest -> pluck -> contours low | spare on purpose: no red |
| 2:52-3:28 | Build, Eb climax | cut (Eb chords, 3:00-3:10) -> urchin (peak 3:03.6) -> mica -> crimp -> pluck -> contours | |
| 3:28-3:55 | Hush, C# minor crescendo | urchin -> 2 crimps (from 3:42) -> pluck -> contours, rising | dark on purpose at first; check whether it is too dark |
| 3:55-5:07 | Sabbath, F minor dance | cut leads (sabbath chords, hammer strokes) -> urchin (peaks 4:18, 4:42) -> mica -> crimp (violins only) -> pluck -> contours | slabs crumbling at speed; the violas rest so the chords lead |
| 5:07-6:34 | High dance, A major climax, D blow | cut (A major climax, 5:53-6:04) -> urchin (5 full-field turns) -> mica -> 2 crimps -> pluck -> contours | |
| 6:34-6:45 | D pedal recalled | the D world again, martin night page | |
| 6:45-7:20 | Final build, last chords | cut -> urchin (last full stab at 7:18) -> mica -> crimp -> pluck -> contours at full | the night breaks off at 7:20.35 |
| 7:20-7:43 | The church bell | urchin (11 bell strokes taken from the audio) -> contours (bone rings on the strokes) on black | the whole field turns to one spot and lies lower and darker at each stroke, until it is gone; then black |
| 7:43-8:20 | Dawn I, Harp I | martin pages (dawn rise, horn, pedal, solo, chords; one lighter page at each chromatic rise) -> contours (blue survey rings) -> pluck (harp, in a see-through full-frame window) | night -> rose-and-blue -> grey-gold |
| 8:20-9:40 | Dawn II, wind solo, last harp | martin day pages -> contours -> pluck harp as pencil lines | day paper by the rise to D6 (8:45); a quiet drawing; the page goes out in the silence |

**Knobs changed from our defaults, and why:**
- **urchin:**
  - `spines` 380: the field must read as a field.
  - Per-note `ground`, `reach` and `stab`: the spirits gather, and at the bell they lie down.
  - `ring` 1.4, and 2.6 at the bell.
- **crimp:** the gale window, tilted 16 degrees. The violas get `fibres` 9, so the violins lead.
- **mica:** `spread` 300 and `size` 72, so a shriek glints across the whole sky.
- **cut:** `wet` 0.15 (sugar), `size` 0.9, `grain` 0.08 and `steps` 5, for fewer, sharper slabs.
- **contours:** `tint`, `flow`, `decay` and `lines` change only at the bell and the dawn.
- **martin:** `paper` steps from 0 to 1. `wash` rises to 1 in the middle pages so the dawn passes through colour.

**Serendipity:**
- The mirrored contours map turned out to draw a symmetrical demon mask. We kept it as Chernabog's face.
- The church bell is cast on the spine field. It turns to one point eleven times and dies down, instead of anything that looks like a bell.
- The whole tremolo whirl flies on a slant: two crimps, violins and violas, share one tilted window. The first try crossed the two strips at 28 degrees and read as a struck-through sign. Parallel strips read as wind.
- The harp's pluck sits in a see-through window, so its threads stay ink on daylight paper. Every other widget here draws with "lighten" and would vanish on paper: the spirits literally cannot be seen by day.
- The dawn is a chain of eight Agnes Martin pages, one per chromatic rise of the violins.
