# Round 5: the morning round (2026-10-31)

Open the lab (`npm run dev`, then http://localhost:5173/lab/index.html, and `?song=b5` for Beethoven). Reworked and new
widgets sort to the top. Every widget now has **at most 5 knobs**, and each knob has a plain sentence (the "i" button) and a
small picture at both ends of its slider, as you asked: "FEWER params per widget, and an infographic per param".

## What is new (10 widgets, all "not judged yet")
Harmonograph (pendulum figures tuned to the chord) · Hilma af Klint (symmetric lotus and spirals; major opens petals, minor
curls spirals) · Kline (huge black dry-brush bars for big chords) · Graphic score (the music writes its own Cage/Cardew page)
· Boogie woogie (Mondrian lanes; notes drop blocks, attacks make them hop) · Cells (a mosaic, one cell per note, coloured by
harmony) · Nebula (dust pulled by the sounding notes) · Pixel sort (each chord smears a strip of the picture) · Mandala
(chords mirrored around a centre) · Agnes Martin (pale bands of the keyboard that notes tint very softly).

## What was reworked, and why
- **Murmuration v3**: you said the re-forming was "driven by something unclear". Now only a loud chord above middle C
  re-forms the flock, and the figure is that chord's own shape on a clock face of the 12 notes (major = straight edges,
  minor = a star, two notes = a lens). Same chord again = it throbs instead.
- **Marbling v2**: you said it "doesn't respond correctly to the sound". Now louder = a bigger drop, higher = brighter and
  higher up, the drop appears on the attack itself, and the comb comes on loud accents and new phrases.
- **Kandinsky v2**: "tone it down a little", it overlapped with dread squares. No more red squares in the low register
  (low notes are black bars now); shapes are smaller and softer.
- **Colour fields v2**: the colour now follows the chords against the piece's home key, and one knob sends it to the
  background.
- **Trimmed to 5 knobs, unchanged at default**: Rorschach, the casket, woven threads, skittish shapes, the current. Their
  agents checked that the pictures are pixel-for-pixel the same at our defaults, as you wanted ("keep OUR defaults").
- **Trimmed and polished, still to judge**: calligraphy, glitch blocks, op art, halftone, harmonic web, suprematism,
  contours, tunnel, scribble, pointillism (Beethoven was too faint on several; it now prints/draws clearly).

## What to look at
Contact sheets here, one tile per widget, each shot about 3 s after the time in its name, widget alone:
`prelude-6s` dread · `prelude-95s` agitato · `prelude-140s` the climax · `prelude-185s` return ·
`b5-3s` fate knocks · `b5-30s` agitato · `b5-262s` oboe's lament · `b5-345s` coda.
(The sheets are reduced to 256 colours to keep them small; the lab shows the real colours.)

## Known weaknesses
- **Pixel sort** is almost invisible on its own in quiet music: it is meant to smear other widgets. Try it with Kandinsky.
- **Agnes Martin** changes very little: subtle by design, but it can look static.
- **Kline** and **dread squares** leave an empty canvas in quiet or high passages, by design.
- **Halftone** and **contours** are the heaviest (still smooth, about 60 fps, in the climax).
- Knob keys changed on kandinsky, colour fields, calligraphy, glitch blocks, op art, halftone and some contours/scribble
  knobs, so those start from our defaults; your old settings for them no longer load.

Checked tonight: every widget alone on both songs at 4 moments, no page or widget errors, 5 knobs each with a hint and a
picture that draws differently at its two ends, and each widget's own work per frame under 4 ms.
