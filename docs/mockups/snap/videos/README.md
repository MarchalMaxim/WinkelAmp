# Snap comparison videos

Made by `node docs/mockups/snap/videos/make.mjs` (all) or `... make.mjs V4 V9` (some), with the dev server on
http://localhost:5300. Each is left | right, 640 px per half, 30 fps from 60 Hz steps, with the recording's sound, a
scrolling brightness trace under each half, and a contact sheet (`<name>-sheet.png`, one frame per 0.5 s, top row left,
bottom row right). Files are in `renders/snap/` (not committed).

How to read the trace: a spike on each note with a trough between notes is snap. Rounded hills that drift on after the
notes are mush. A second brightening after a peak is a fake attack, and a reason to reject.

Judging order: V1, V2, V6, V9, V4, V7, then the rest.

- V1, 5-37 s, the bells rising over a low F (lab, all notes). Left squares, right squares-snap. Look for: the old hold-then-cliff against a crack that sinks at once. `renders/snap/V1-bells-squares.mp4`
- V2a, 41-50 s, the arrival and the pulsing G. Left your show, right rach-concerto-2-snap. Look for: the orchestra sustains, only the squares' decay differs; each pulse has its own trough. `renders/snap/V2a-arrival-original-vs-snap.mp4`
- V2b, 41-50 s, same passage. Left rach-concerto-2-knobs, right rach-concerto-2-snap. Look for: whether code beats a knob turn. `renders/snap/V2b-arrival-knobs-vs-snap.mp4`
- V3, 79-84 s, squares p9 (shake 2, size 2). Left your show, right -snap. Look for: seven hard notes at the largest size, each one clearly hit and gone. `renders/snap/V3-squares-p9.mp4`
- V4, 115-125 s, ivory p14. Left your show, right -snap (strike 1). Look for: the same keys, sharper strike and quicker release. `renders/snap/V4-ivory-p14.mp4`
- V5, 126-135 s, the run (halftone p15, 95 attacks, 12-14 notes/s). Left your show, right -new (hammer, staccato). Look for: a density and strobe test; each note distinct without a flicker. `renders/snap/V5-the-run-hammer.mp4`
- V6, 10.7-28.5 s, the three sighs and the staccato. Left liebesleid, right liebesleid-new. Look for: ivory against hammer and handover on the sighs. `renders/snap/V6-sighs-ivory-vs-new.mp4`
- V7, 10.7-28.5 s, same passage. Left liebesleid-knobs, right liebesleid-snap (ivory strike 1). Look for: does code beat a knob turn? `renders/snap/V7-sighs-knobs-vs-snap.mp4`
- V8, 30-45 s, the flee accents. Left liebesleid, right liebesleid-snap. Look for: bow against hammer. `renders/snap/V8-flee-accents.mp4`
- V9, 174.9-186.2 s, the rolls p5-p8. Left liebesleid, right liebesleid-new (hammer, roll 1). Look for: four strikes, not eighteen flashes. `renders/snap/V9-rolls-p5-p8.mp4`
- V10, 230-242 s, the glass passage p12-p15. Left liebesleid, right liebesleid-new (blade). Look for: a treble cascade where each drop is distinct. `renders/snap/V10-glass-p12-p15.mp4`

Notes: DESIGN.md C12 names `make.sh`; the script is `make.mjs` because this runs on Windows and Node is already required
(same commands). The trace is frame-locked: the graph is clocked at the video's fps and the stacked half is re-timed to
it, so every video is exactly 30/1 with frames = seconds x 30, and the trace advances one pixel per frame (a trace
216 px long at 7.2 s). It fills from the left and scrolls once the strip is full. The contact sheet shows only the two picture rows, not the trace.
