# Crimp (`crimp`): build plan

Spec: essay 7 §1 Crimp, with the changes in SYNTHESIS §3. Where this plan gives a number, use this plan's number; it already folds
both in. You create only `lab/tools/crimp.js` and `tests/crimp.test.ts`. `crimp` is already in `TOOL_IDS`.

**Replaced from the essay (do not copy these from it):** line width 1.5 px (not 1.25); spacing 4 px (not 3); `fibres` default 15 (not
11); wool is BRICK through `lighten` (never EMBER through `SNAP.alpha`); `slack` max 6.5 px (not 9: amplitude stays under 1.7 x spacing);
velocity normalised by the clip's p10/p90 (not `(v/127)^1.5`); x centre independent of length; per-line sprite strips (not one
1024x84 sprite per ribbon, see section 5).

## 1. What the viewer sees

Each note lays a ribbon of parallel razor-thin bone lines at its pitch's height, dead straight with jagged stepped ends, on the
attack's own step. Within half a second each line goes slack into its own fine irregular wave, out of step with its neighbours, and
the tips draw back by 9 %, so the ribbon becomes a matte brick-red woolly strip that dims in steps and is gone. The same key again yanks
that same strip straight in place: wool to razor in one step. Texture word: **fuzzy to sharp** (the note is the change of texture).

## 2. Geometry and numbers (canvas px, W 1280, H 720)

Constants: `BONE = SNAP.BONE` (236,226,208), `HOT = [214,58,40]`, `BRICK = [200,60,40]`, `SP = 4` (spacing), `LW = 1.5`,
`AMPS = [0.75, 1.5, 2.5, 3.5, 5, 6.5]`, `TONES = [1, 0.75, 0.56, 0.42, 0.32]`, `STRAIGHT = 0.066`, `CAP = 16`,
`SW = 2560`, `SH = 20` (strip size), `BUDGET = 0.06 * 1280 * 720` (55 296 px²).

**Hash (pitch-seeded, never `x.rnd`, never `Math.random`):**
```js
const hash = (m, i, k) => { let s = (m * 374761393 + i * 668265263 + k * 1442695041) | 0;
  s = Math.imul(s ^ (s >>> 13), 1274126177); s ^= s >>> 16; return (s >>> 0) / 4294967296; };   // 0..1
```

**Per ribbon, for pitch `m`** (`f = clamp(Math.round(x.p('fibres')), 3, 21)`):
- Centre height `yc = 660 - 600 * (m - 21) / 87` (bass at the bottom; at 21 fibres the strip spans yc ± 40, always on canvas).
- Centre x `cx = 640 + 480 * (hash(m, 0, 1) - 0.5)` (400..880). A pure function of pitch: a repeat lands in place whatever its velocity.
- Line `i` (0..f-1) at `y_i = Math.round(yc - 2 * (f - 1) + 4 * i)` (integer row; the line covers rows y_i to y_i + 1.5).
- Stair: `dl_i = Math.round(60 * hash(m, i, 3) - 30)`, `dr_i = Math.round(60 * hash(m, i, 4) - 30)` (each end ±30 px, independent).
- Length `L = Math.min(1200, x.p('reach') * (300 + 780 * u))` (default reach: 300 px soft to 1080 px loud; never wider than 1200).
- Shrink `q` (1 on the strike, see section 3 for the wool). Line i spans `xl_i = Math.round(cx - q * L / 2 + dl_i)` to
  `xr_i = Math.round(cx + q * L / 2 + dr_i)`, width `w_i = xr_i - xl_i` (at most 1260). A long ribbon may run off one edge, up to
  170 px at default reach and 230 px at reach 1.4; that is accepted.
- Wave strip choice: `s_i = i % 3` (neighbours always use different wave seeds), crop start
  `sx_i = Math.floor(hash(m, i, 2) * (SW - 1300))` (0..1259: a random phase per line, the same after a seek).

**Velocity `u`** (velocity is reach, and the strike's colour). Compute once per CHORDS array: collect every `n.v` of every
`ch.notes` (not `ch.vel`), sort ascending, `p10 = vs[Math.floor(0.1 * (N - 1))]`, `p90 = vs[Math.floor(0.9 * (N - 1))]`. Cache on
`(CHORDS identity, CHORDS.length)` like `roleOf` in hammer.js. `u = clamp((v - p10) / (p90 - p10), 0, 1)`; **guard**: if `N < 2` or
`p90 - p10 < 4`, `u = 1`. On picks (`!!x.picked`), `u = Math.max(u, 0.35)`, so every picked note lands long enough.

**Chord rule:** every note of a chord is its own ribbon at its own height, all struck in the same step. Overlapping ribbons combine
per channel through `lighten` (nothing erases anything).

**Repeat rule:** a ribbon is identified by pitch. Only the newest attack of a pitch is drawn, so a repeat restarts `t` at 0 at the
same `cx`, rows and stair: it is straight again in its own step. Its length follows the new velocity.

**Stateless from CHORDS.** `onChord() {}` is empty. Each frame: `cs = typeof CHORDS !== 'undefined' ? CHORDS : []`; binary search
`chordAt(cs, x.t)` (copy from handover.js); walk `j` from that index downward while `cs[j].t > x.t - stays`; for each note, if its
pitch is not yet in a `Map`, add `{ m, v, born: cs[j].t }`; stop when the map holds `CAP` (16) pitches (newest first, so the oldest
are the ones dropped). Kept state: only the baked strips (module-level, built once) and the p10/p90 cache. No ages added up, no `x.rnd`.

## 3. Time (t = x.t - born, per ribbon)

`stays = x.p('stays')`. `D = stays - 0.25` is the end of drawing; after that the canvas ghost (bone 118 after 5 steps, 0 after 20)
takes it to black by about `stays`. A ribbon with `t < 0` or `t >= D` is skipped.

**Strike, `0 <= t < STRAIGHT` (60 Hz steps 0 to 3): straight lines, vector rects, q = 1.**
- Top colour `top = mix(HOT, BONE, 0.35 + 0.65 * u)`, or `HOT` if the bone budget is spent (below).
- Colour `c = mix(BRICK, top, SNAP.flash(t))`, rounded: steps 0 and 1 (t < SNAP.H = 0.033) are the full top colour (the two-step
  hold); steps 2 and 3 cool toward brick (flash 0.996 and 0.82).
- Bone budget: order this step's striking ribbons by `born` descending, then `u` descending; add each one's area `sum(w_i) * 1.5`;
  a ribbon whose area would take the running sum past `BUDGET` uses `top = HOT` instead (the first ribbon is always under budget:
  at most 21 x 1260 x 1.5 = 39 690).

**Wool, `STRAIGHT <= t < D`: per-line sprite crops.**
- Slack curve `A = slack * (1 - Math.exp(-t / 0.18))` with `slack = x.p('slack')`.
- Amplitude index `j` = the largest index with `AMPS[j] <= A / 0.9`, or 0 if none. Once `A / 0.9` passes the last AMPS value it can
  reach, the geometry is frozen: for any slack equal to a baked value (default 5, max 6.5) the last jump lands at t = 0.18 ln 10 =
  0.41 s, still under the strike's ghost; slack between baked values freezes earlier on the level below.
- Shrink `q = 1 - 0.09 * Math.min(1, AMPS[j] / slack)`: the tips withdraw in the same jumps as the crimp, 9 % at full slack, then stop.
- Tone index `n = Math.min(4, Math.floor(5 * (t - STRAIGHT) / (D - STRAIGHT)))`; the strip baked at `TONES[n]` is drawn.
  Real colours: n0 (200,60,40), n1 (150,45,30), n2 (112,34,22), n3 (84,25,17), n4 (64,19,13). Each drop is a glide the canvas makes in
  about 3 steps (lighten never darkens: the old pixel fades down to the new tone and holds there).
  Default stays 1.2: D 0.95, tone breaks at 0.243, 0.420, 0.597, 0.773 s; last draw before 0.95 s, black by about 1.2 s.

**Tone rule.** Every mark (strike rects and wool strips) is drawn with `globalCompositeOperation = 'lighten'`, `globalAlpha = 1`,
in its real target colour. Use SYNTHESIS's `tone(g, rgb, k)` helper for the strike fill (k = 1, colour already mixed). Strips are
baked opaque on black, so `lighten` with their black rows changes nothing and every partial-coverage fibre pixel holds exactly.
Never draw black with `source-over` on the shared canvas (it would erase other clips). `g.save()` first, `g.restore()` last.

**SNAP:** paste the SNAP v1 block (copied by script, section 5) and use only `SNAP.flash`, `SNAP.H` and `SNAP.BONE`. No preset drives
the body: the wool's brightness is the 5 tone steps. Do not use `SNAP.env`, `SNAP.alpha`, `settles` or `sharp`.

**No motion without a note.** The wave grows and the tips withdraw only in the first 0.41 s after an attack, in at most 6 jumps, and
then nothing moves. The strips are baked, never animated in time: no wander over time, no drift, no travelling front, no staging at
the end of a phrase. The only change between notes is a tone step on frozen geometry.

**Known ghosts:** the strike's bone lines fade under the growing wave for about 0.2 s, so the wool seems to grow out of the razors.
On a repeat the old wool is not erased: its brick ghost fades from about 200 to about 100 red in about 5 steps under the new razors.

## 4. Knobs (4 plus presence)

| key | label | min | max | default | less | hint |
|---|---|---|---|---|---|---|
| `slack` | how fuzzy it goes | 1 | 6.5 | 5 | none | How wavy the lines go once struck. Left: they stay almost straight. Right: they go to wool. |
| `reach` | how long a strip is | 0.3 | 1.4 | 1 | 0.3 | How far a note's lines reach; louder notes reach further. Left: short dashes. Right: right across the screen. |
| `fibres` | lines in a strip | 3 | 21 | 15 | 3 | How many lines a note lays down. Left: a few clean lines. Right: a dense pelt. |
| `stays` | how long it stays | 0.4 | 3 | 1.2 | 0.4 | How long the wool lies there after a note. Left: gone at once. Right: wool lies around for seconds. |
| `presence` | how present | 0 | 1 | 1 | (leads) | How much each note leaves: how long its strip is, how many lines, how long the wool stays. Left: a few short lines, soon gone. Right: long, dense strips that linger. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again. |

`presence` has `leads: true` and is never read (the source must not contain `p('presence')`). `fibres` has `step: 1`. No drives.
Icons (40 x 26):
- `slack`: three wavy lines: for k in 0..2 a polyline at `y0 = h / 2 - 7 + 7 * k`, `y = y0 + (0.5 + 3.5 * v) * Math.sin(px * 1.3 + k * 1.9)`,
  px from 3 to w - 3, stroke `ICON.red`, lineWidth 1.
- `reach`: three horizontal lines of length `6 + v * (w - 10)`, centred, at y = h/2 - 5, h/2, h/2 + 5, ends shifted by -2, +2, 0 px,
  `ICON.line(g, ..., ICON.gold, 1.5)`.
- `fibres`: `ICON.lines(g, 3 + Math.round(v * 7), w, h, { dir: 'h', col: ICON.red, lw: 1 })`.
- `stays`: `ICON.fade(g, w, h, 0.1 + v * 0.9, ICON.red)`.
- `presence`: `ICON.much(g, v, w, h)`.

Entry: `id: 'crimp', name: 'Crimp', tag: 'new'`. Blurb: "Each note lays a ribbon of razor-thin lines at its pitch's height, dead
straight at the attack; within half a second the lines go slack into a fine wave, out of step, and the ribbon turns into a brick-red
woolly strip. Louder notes reach further. The same key again yanks its strip straight in place."

## 5. Draw order and cost

**Baked strips** (in `reset`, only if not baked yet; module-level `let STRIPS = null`; never touch `document` at load time, since
`tests/how-present.test.ts` runs every source in a vm):
- 3 seeds x 6 amplitudes x 5 tones = 90 canvases `STRIPS[s][a][n]`, each `SW x SH` = 2560 x 20 = 204 800 bytes: **18.4 MB** total.
- The wave of seed s (0..2) along x, baked, never animated. Its wavelength wanders through 9 to 14 px quickly, so no line is a
  sine and no two lines beat periodically (aperiodicity is what prevents moiré, not a fixed difference between neighbours):
  `lam(x) = 11.5 + 2.5 * (0.6 * Math.sin(2 * Math.PI * x / P1 + s) + 0.4 * Math.sin(2 * Math.PI * x / P2 + 2 * s + 1))` with
  `[P1, P2] = [[41, 67], [53, 89], [71, 113]][s]` (short, incommensurate periods per seed); phase integrated,
  `ph += 2 * Math.PI / lam(x)` per x pixel from `ph = 1.3 * s`; amplitude
  wander `aw(x) = 0.85 + 0.15 * Math.sin(2 * Math.PI * x / [97, 131, 157][s] + 2 * s)`; `wave_s(x) = aw(x) * Math.sin(ph)`.
  Precompute `wave_s` once per seed into a `Float32Array(SW)`. If `frame` runs while `STRIPS` is still null (a host that calls
  `frame` before `reset`), bake there first, so it never throws.
- Each strip: `fillStyle = '#000'; fillRect(0, 0, SW, SH)` (opaque black; this is on the strip canvas, not the shared one), then one
  polyline `y = 10.75 + AMPS[a] * wave_s(x)` for x = 0..SW-1, `lineWidth 1.5`, `lineJoin 'round'`,
  `strokeStyle = rgb(round(BRICK * TONES[n]))`. All 30 strips of a seed share `wave_s`, so a level change grows the same wave in place.
- About 230k `lineTo` once, well under 100 ms.

**Why per-line strips (a deliberate departure from one sprite per ribbon):** each line gets its own phase (the moiré test), the stair
survives into the wool, `fibres` changes need no re-bake, and overlapping sprite rows never double a neighbour's wiggle.

**Per frame:**
1. Scan CHORDS (section 2) into at most 16 ribbons; for each compute `u`, `L`, and strike or wool.
2. `g.save(); g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;`
3. Wool ribbons, in scan order: for each line i, `g.drawImage(STRIPS[s_i][j][n], sx_i, 0, w_i, SH, xl_i, y_i - 10, w_i, SH)`.
4. Strike ribbons, in budget order: `tone(g, c)`; `g.beginPath()`; `g.rect(xl_i, y_i, w_i, 1.5)` for every line; `g.fill()`.
5. `g.restore()`.

The order of 3 and 4 does not change the picture (`lighten` is a per-channel max) but keep it fixed for the draw-log tests.
Cost: a slow melody, 2 to 5 ribbons = 30 to 75 `drawImage` plus 1 fill per struck note. Worst case 16 ribbons x 21 lines = 336
`drawImage` of at most 1260 x 20 px (240 at the default 15 fibres). Fine on the GPU canvas; the software canvas used for proofs may
take up to about 15 ms a step in Winter Wind, acceptable for renders. If a live step exceeds 4 ms, lower CAP to 12 first.

**SNAP paste:** write `lab/tools/crimp.js` with a short node script that reads `lab/snap/envelope.js`, slices from
`// SNAP v1 begin` through `// SNAP v1 end`, and inserts it right after the opening `(() => {` line. Never retype it. LF only, UTF-8.

## 6. Tests (`tests/crimp.test.ts`)

Load as `tests/flee-snap-switch.test.ts` does: read `../lab/tools/crimp.js`, `instantiate('crimp', SRC, { icon, chords })`, the same
`recorder` proxy, a mocked `G.document.createElement` returning recorder canvases (reset bakes canvases), `x` with `picked: false`
and **no** `onPicks`. `icon` is a proxy: colour strings for `ink, dim, red, gold, blue, green, violet`, a no-op function for anything
else. Build songs with `groupChords` from hand-made notes. Play at 60 Hz with `x.t = f / 60`, firing `onChord` for chords with
`t <= x.t`; log only what `frame` draws when a test compares frames.

Assert:
1. Entry shape: one tool, `id 'crimp'`, `name 'Crimp'`, `tag 'new'`, non-empty blurb; param keys exactly
   `['slack', 'reach', 'fibres', 'stays', 'presence']`; min, max, value and less as in section 4; `presence.leads === true`; every hint
   contains `Left:` and `Right:`; every icon runs on a recorder context at v = 0, 0.5, 1 without throwing. Via `loadCatalogue()`,
   `widgets.get('crimp')` has the same keys. The source does not match `/\bp\(\s*'presence'/` and contains no `Math.random`.
2. Attack step: one note (m 60, v 90) at t 1.0. The first frame with `x.t >= 1.0` logs `globalCompositeOperation=lighten`, one `fill()`,
   15 `rect(` calls and a `fillStyle` `rgb(` string whose red is at least 214; it logs no `drawImage`.
3. Wool: the frame at 1.0 + 0.1 logs 15 `drawImage` calls and no `rect(`.
4. Still between notes: with `stays = 3`, the frames at 1.80 s and 1.90 s (one note, nothing after) have identical `drawImage`
   arguments 2 to 9 (source and destination rectangles); only argument 1, the source canvas, may differ at a tone step.
5. Gone: no `drawImage`, `rect` or `fill` once `x.t >= born + stays - 0.25`; with the default stays, nothing at 1.0 + 0.96.
6. Repeat in place: the same pitch (m 60) at 1.0 and 1.5 s (v 60, then v 110), plus filler notes at other pitches (m 80 to 90, after
   2.5 s) with velocities spread over 40..100, so `u` really differs and the guard does not fire. The frame at 1.5 logs 15 `rect` calls
   for m 60 with the same y values as the 1.0 strike and no `drawImage`, each line is longer than on the first strike, and each line's
   centre `(xl + xr) / 2` is within 1 px of its centre on the first strike.
7. Velocity gain: in a 20-note song with velocities spread evenly over 40..100, the v 100 ribbon's lines are at least 500 px longer than
   the v 40 ribbon's.
8. One-note clip: a song of one note logs no `NaN` and its lines are 1080 ± 60 px wide (guard u = 1).
9. Cap: 20 different pitches within 0.4 s: no frame logs more than 240 `rect` plus `drawImage` calls.
10. Bone budget: a 6-note chord at v 110 with fibres 21 and reach 1.4, plus filler notes after 2.5 s spread over v 40..100: in the
    attack step's frame only, at most 2 of its 6 strike fills have a green channel of 150 or more; the rest are HOT (214,58,40).
11. Determinism and seeks: two full 6 s runs give identical logs with `Math.random` replaced by a thrower. A fresh tool, reset, asked
    for one frame at x.t = 4.2, logs the same frame calls as the frame at 4.2 of a played run (stateless).

Also run `tests/snap-envelope.test.ts`, `tests/how-present.test.ts` and `tests/widgets-catalogue-node.test.ts`; every check on crimp
must pass. Nine other builders write widgets in the same checkout, so a failure that names another widget is reported, never fixed,
and that widget's file is never edited.

## 7. Judge moments

- **Liebesleid picks, about 172-244 s** (the showcase show, crimp on its own pick set): the slow melody; 28 % repeats, so watch for the
  yank. Take a still about 0.6 s after a two- or three-note chord where strips overlap.
- **Rachmaninoff 2, 0-170 s:** the repeated chords (41 % repeats): every chord must re-strike straight in place, razor on wool; the
  bass strips should read heavy.
- **Winter Wind:** density (the 16 cap, the bone budget): does the frame stay readable as strips or turn to mush?
- Judge on the 60 Hz video, never in the live lab.

**The one question a still must answer (KILL TEST):** do neighbouring wavy lines beat into a moiré pattern, inside a strip or where two
strips overlap? Check per-line phase first (`sx_i`, `s_i = i % 3`). Then: is the wool visible as wool (brick tone, not a dim smear),
and is the standing strip heavy enough to be a picture between notes?

## 8. Risks and fallbacks

- **Moiré** (the kill test): lines 4 px apart with amplitude up to 6.5 px cross their neighbours, and chord strips 21 to 48 px apart
  overlap a second set. The defence is aperiodic waves (wavelength wandering 9 to 14 px over 41 to 113 px periods), three seeds by
  line and a random crop phase per line. If a still beats, first cap `AMPS` at 5.5 (1.4 x spacing);
  if it still beats, the idea is dead (SYNTHESIS: moiré was dropped) and the widget is removed, not patched with blur.
- **Weak picture** (the eye judge: "a strong event in a weak picture"): if the standing strip is thin, bake the strips at lineWidth 2
  and the first tone at (220,66,44) before adding fibres.
- **Tone steps read as blinks:** 5 tones with canvas glides should be smooth; if not, bake 8 tones (ratio 0.83) at 29 MB.
- **Cost** on the software canvas in dense music: lower CAP to 12.
- **Ribbons off the edge:** a loud strip centred at x 400 runs up to 170 px off the left (230 px at reach 1.4). Accepted: a fixed `cx` is what keeps the
  repeat in place.
- **Pitch reads only as height:** x is a pitch hash, so a melody climbs but jumps sideways. If the user wants left to right too, use
  `cx = 340 + 600 * (m - 21) / 87` (still a pure function of pitch).
- **Ghosts:** the strike's bone ghost covers the first 0.2 s of the wave, and the old wool lingers about 5 steps under a repeat.
  Both are expected, not bugs.

## After review

- Slab fix: centre x is now the section 8 fallback `cx = 340 + 600 * (m - 21) / 87`, still a pure function of pitch (a repeat still lands in place). A stepwise line now separates sideways as well as vertically; stills crimp-fixed/crimp-176-3s.png and crimp-fixed-rach2/crimp-60-1s.png show strips stepping as a staircase instead of one block. Defaults for stays and fibres untouched (tests keep 15 fibres, 1.2 s).
- Rach 2 stills shot (renders/nature-stills/crimp-fixed-rach2, 60 and 90 s); a frame on an exact repeat yank was not isolated, still to judge on the 60 Hz video.
