# Plucked corner (`pluck`): build plan

Spec: `docs/mockups/nature/essays/6-spider-silk-and-thorns.md` §1, as changed by `SYNTHESIS.md` §5 (which wins). Files: `lab/tools/pluck.js`,
`tests/pluck.test.ts`. Do not edit `lab/index.html` (the coordinator registers the id). Start from `lab/tools/hammer.js`: its IIFE, the
pasted SNAP block, its `touch` knob and icon. Nothing else of hammer's drawing is kept.

## 1. What the viewer sees

Each pitch owns one straight thread between two small square anchors, long and nearly level in the bass, short and steeper in the treble,
crossing its neighbours. On the attack step the thread is already pulled aside into two dead-straight lines meeting at one hard bone corner;
the corner splits and runs, so within a quarter of a second it goes triangle, flat-topped trapezoid, flat, the same upside down, while the
canvas's own fade stacks the earlier positions into a fan of straight hairlines; then a thin red line remains and goes out. **Elastic**
(the snap back) and **sharp** (the corner): nothing in it is ever curved.

## 2. Geometry and numbers (canvas px, W 1280, H 720)

**Clip statistics, once per `CHORDS` array** (cache keyed on the array object and its length, as hammer's `roleOf` does; clear in `reset`):
- `lo`, `hi`: min and max `n.m` over all notes. If `hi - lo < 12`, widen to 12 about the middle: `c = (lo + hi)/2; lo = c - 6; hi = c + 6`.
- `p10`, `p90`: velocity percentiles of all notes (sorted copy, index `Math.floor(0.1*(N-1))` and `Math.floor(0.9*(N-1))`).
- `uv(v) = (N >= 3 && p90 - p10 >= 4) ? clamp((v - p10)/(p90 - p10), 0, 1) : clamp((v - 40)/60, 0, 1)` (the guard for one note or one velocity).
- `rep`: a Map from `` `${i}:${m}` `` (chord index, pitch) to the repeat index `j`. One pass in order, per pitch keep `lastT`, `lastJ`:
  `j = (t - lastT[m] <= 1.0) ? lastJ[m] + 1 : 0`. Derived from `CHORDS` only, so a seek finds the same `j`.

**Seeded detail, by pitch only** (no `x.rnd`, no `Math.random`): the same pitch always has the same strand, before and after a seek.
```js
const hash = (m, k) => { let s = Math.imul(m + 1, 0x9E3779B1) ^ Math.imul(k + 1, 0x85EBCA77);
  s = Math.imul(s ^ (s >>> 15), 0x2C1B3C6D); s = Math.imul(s ^ (s >>> 12), 0x297A2D39); return ((s ^ (s >>> 15)) >>> 0) / 4294967296; };
```

**The strand of pitch `m`** (from `m`, `lo`, `hi`; cache per pitch in a Map, cleared with the clip statistics):
- `up = clamp((m - lo)/(hi - lo), 0, 1)` (0 = the clip's lowest note, 1 = its highest).
- Length `L = 1180 + (140 - 1180)*up` (1180 bass, 140 treble).
- Middle height `ym = 570 - 420*up` (570 bass, 150 treble; low at the bottom).
- Angle: `thMax = (14*Math.PI/180) * (1 - 0.65*(L - 140)/1040)` (14° treble, 4.9° bass, so long strands stay in frame);
  `th = (2*hash(m,3) - 1) * thMax`. Keep both anchors 16 px inside: `room = Math.min(ym, H - ym) - 16`;
  `if (0.5*L*Math.abs(Math.sin(th)) > room) th = Math.sign(th) * Math.asin(Math.min(1, room/(0.5*L)))`.
- Centre x: `Lx = L*Math.cos(th)`; `cx = 30 + Lx/2 + hash(m,2)*(W - 60 - Lx)`.
- Anchors `A0 = (cx - Lx/2, ym - 0.5*L*Math.sin(th))`, `A1 = (cx + Lx/2, ym + 0.5*L*Math.sin(th))`; the rest point at `s` (0..1) is `A0 + s*(A1 - A0)`.
- Unit normal `nrm = side*(-Math.sin(th), Math.cos(th))`, `side = ym < H/2 ? +1 : -1` (the first pull goes toward mid-frame).
- Base pluck point `r0 = 0.2 + 0.2*hash(m,1)` (0.2..0.4 of the way from A0, never the middle).

**Per note.** For the newest attack of pitch `m` (chord index `i`, note `n`), age `t = x.t - ch.t`:
- Pluck point with the repeat: `r = 0.2 + ((r0 - 0.2 + 0.07*j) % 0.2)`. A repeat is a visibly new corner on the same line.
- Corner pad half-width (`corner` knob): `hpad = Math.min(r - 0.04, (1 - corner)*0.12)`. At `corner = 1` it is 0, a pure triangle.
- Deflection (velocity, `pull`, amount): `room2 = Math.min(ym, H - ym) - 14 - 0.5*L*Math.abs(Math.sin(th))`;
  `A = Math.min(pull*(20 + 120*uv(n.v)), pull*0.2*L, Math.max(6, room2)) * Math.min(1.3, SNAP.gain(n.amount ?? 1))`; then `A = Math.max(6, A)`.
  At pull 1, uv 0.5: bass about 80 px, middle 80 px, treble 28 px.
- Brightness gain: `Pn = Math.min(1, (0.65 + 0.35*uv(n.v)) * SNAP.gain(n.amount ?? 1))`; if `x.picked`, `Pn = Math.max(Pn, 0.75)`.
- Flap period `per = clamp(0.2*Math.pow(L/1180, 0.4), 0.1, 0.2)` s (never above 10 Hz); corner speed `c = 2/per` (strand lengths per s).
- Motion decay `tau = x.p('shiver') ?? 0.09`; live amplitude `a = A*Math.exp(-t/tau)`.

**The shape (Helmholtz motion, exact, no sampling).** `f0` is the pulled shape with apex 1, linear between the knots
`(0,0) (r-hpad,1) (r+hpad,1) (1,0)` (with `hpad = 0` the middle knots coincide). `F` is its odd 2-periodic extension:
```js
const F = (s) => { s = ((s % 2) + 2) % 2; return s <= 1 ? f0(s) : -f0(2 - s); };
const y = (s) => a * 0.5 * (F(s - c*t) + F(s + c*t));            // sideways offset at s, in px along nrm
```
Breakpoints: for each interior knot `k` of f0 (`r` alone, or `r-hpad` and `r+hpad`) and each of the four values `±k ± c*t`, take
`((v % 2) + 2) % 2` and keep it if strictly inside (0, 1). Add 0 and 1, sort, drop near-duplicates (within 1e-6). The polyline through
`rest(s) + y(s)*nrm` at those `s` is exact: 3 segments for a hard corner (2 corners), at most 5 with a pad. If `a < 0.5` px, the strand is
just the straight segment `A0`-`A1` (2 points).

**Chord:** one strand per note, each on its own pitch's line at its own flap speed; they cross. No bone budget is needed (a 4 px line 1180
px long is 0.5 % of the frame). **Repeat:** only the newest attack per pitch is drawn, so a repeat restarts at full deflection and replaces
the old motion (no sum, no max), with `r` moved by 0.07. **Run:** a spray of short high strands kinking and gone.

**Stateless.** `onChord` does nothing. `frame` binary-searches the last chord with `c.t <= x.t` (handover's `chordAt`), walks back while
`c.t > x.t - LB`, `LB = SNAP.preset(touchName).L * ring`, and keeps the first (newest) attack it meets per pitch. The only kept state is the
caches above (clip statistics, repeat map, per-pitch strand), all derived from `CHORDS`.

## 3. Time

**SNAP block: pasted**, byte for byte, from `// SNAP v1 begin` to `// SNAP v1 end`, copied programmatically from `lab/snap/envelope.js`
(a short node script that slices between the markers and splices into the file; LF only). Used: `SNAP.env`, `SNAP.flash`, `SNAP.core`,
`SNAP.gain`, `SNAP.preset`, `SNAP.PRESETS`, `SNAP.TOUCH`, `SNAP.BONE`. Not used: `SNAP.alpha`, `SNAP.settles` (the tone rule replaces them).

**Preset: the `touch` knob (default 2 = piano), with its tail folded into the body.** Built once at load, after the SNAP block:
```js
const NOTAIL = {}; for (const k of SNAP.TOUCH) { const p = SNAP.PRESETS[k]; NOTAIL[k] = { ...p, wb: p.wb + p.wt, wt: 0 }; }
```
`SNAP.env` accepts a preset object. Piano then has body share 0.85/1.85 = 0.46, half-life `0.21*ring*2^((60-m)/24)` s, and no 8x tail
(under exact `lighten` the tail would glow faintly for 2.5 s). Per strand, `touchName = SNAP.TOUCH[clamp(round(x.p('touch') ?? 2), 0, 3)]`,
`e = SNAP.env(t, {v: n.v, m: n.m, d: n.d, a: n.amount ?? 1}, {preset: NOTAIL[touchName], ring, picks: !!x.picked})`, `q = e.E / e.P`
(1 on the attack, only falls after the 2-step hold).

**Tone rule, for every draw, bright or dim** (SYNTHESIS rule 1; paste its `tone` helper outside the SNAP markers): `globalCompositeOperation
= 'lighten'`, `globalAlpha = 1`, the colour already at its target.
- `BONE = [236,226,208]` (`SNAP.BONE`), `RED = [226,44,40]` (the body: a real red, live channel far above 60).
- Colour at age t: `C = mix(RED, BONE, SNAP.core(a) * SNAP.flash(t))`; drawn rgb `= round(C * Pn * q)`, used for stroke and anchors. Every
  channel of RED is below BONE, so every channel only falls. A note with amount below 0.6 strikes red, with no bone core.
- Middle C, uv 0.5 (Pn 0.825), piano, ring 1: attack and hold (195,186,172); 0.1 s (110,61,56); 0.25 s, motion done, (46,12,11);
  0.5 s (17,3,3); gone at about 0.93 s. Bass C2: half-life doubles, gone about 1.8 s. Treble C6: gone about 0.45 s.
- Line width `w = 1.25 + 2.75*SNAP.flash(t)`: 4 px on the 2-step hold (SYNTHESIS: 4, not 3), 2.5 px at 0.1 s, about 1.5 at 0.25 s, then 1.25.
- Anchors: a 5x5 px square centred on each anchor, same rgb as the strand, for the whole life (they never move).

**Attack step:** full deflection, full width, bone, no wind-up. **Hold:** 2 steps (`SNAP.H`), the shape already running. **Fall:** the corners
run for about `2.8*tau` (0.25 s at default) until `a < 0.5` px; then the still straight red line fades by the body half-life. **Gone:** skip
the strand when `t >= e.L` or `Pn*q*226 < 4` (under 4 levels). Because `q` only falls, once gone it stays gone.

**No motion without a note.** All movement is a strand's own response inside `2.8*tau` (at most 0.45 s at shiver 0.16) after its attack. No
travelling front across strands, no fake attack, no end-of-phrase staging; brightness rises only on an attack. The moving strand is drawn at
its exact tone every step (never through `alpha`), so the fan of earlier positions is the canvas fade itself.

## 4. Knobs (5 plus presence)

| key | label | min | max | default | less | hint |
|---|---|---|---|---|---|---|
| `pull` | how far it is pulled | 0.3 | 2 | 1 | 0.6 | How far a note pulls its thread aside. Left: a small kink. Right: a wide corner far out of line. |
| `corner` | how hard the corner is | 0 | 1 | 1 | - | How the thread is pulled. Left: by a soft finger, a short flat top between two corners. Right: one corner as hard as a ruled line. |
| `shiver` | how long it shivers | 0.04 | 0.16 | 0.09 | - | How long the thread flaps after the pull. Left: one flap, then straight. Right: a few flaps, never long enough to look like a new note. |
| `ring` | how long it rings | 0.25 | 3 | 1 | 0.25 | How long the thin red line stays once the thread is straight. Left: gone in a quarter of the time. Right: three times as long. |
| `touch` | articulation | 0 | 3, step 1 | 2 | - | hammer's `touch` hint, verbatim. |
| `presence` | how present | 0 | 1 | 1 | `leads: true` | How much each note leaves: how far it pulls and how long its line stays. Left: small kinks, soon gone. Right: wide pulls that ring out. Moving it sets those knobs; set one by hand afterwards and it holds until you move this again. |

`less` on `pull` is the one addition to the essay (pull is the mark's size, as `size` is in hammer and handover). Read every knob with
`?? default`. Icons (40x26, straight lines only; strand in `ICON.gold` lw 1.5, anchors as `ICON.rect` 2x2 in `ICON.ink` at (4,h/2), (w-4,h/2)):
- `pull`: corner at `(0.35*w, h/2 - (2 + v*(h/2 - 4)))`, two `ICON.line`s to the anchors.
- `corner`: as pull at v 0.7, with a level flat top `(1 - v)*12` px wide centred on 0.35*w (two corners joined by a level line).
- `shiver`: `1 + Math.round(v*4)` two-segment strands, apex height alternating up and down and shrinking by 0.55 each, all but the first `ICON.dim`.
- `ring`: `ICON.fade(g, w, h, 0.1 + v*0.9, ICON.red, 'line')`. `touch`: hammer's envelope icon, copied. `presence`: `ICON.much(g, v, w, h)`.

Entry: `id: 'pluck', name: 'Plucked corner', tag: 'new'`, blurb: "Each note pulls its own straight thread aside: two straight lines and one
hard corner, struck bone-white. The corner splits and runs, so the thread flaps through a triangle, a flat top and back, and the fading
screen stacks its positions into a fan of straight hairlines. Then a thin red line stays a moment and goes. Bass threads are long, treble ones
short; a repeated note pulls the same thread at a new point. Nothing in it is ever curved."

## 5. Draw order and cost

No sprites, no tiles, nothing baked in `reset` (it only clears the caches). Per frame:
1. Build the live list (binary search, walk back, newest per pitch, skip gone). If empty, return without touching `g`.
2. `g.save()`; `g.globalCompositeOperation = 'lighten'`; `g.globalAlpha = 1`; `g.lineCap = 'butt'`; `g.lineJoin = 'miter'`; `g.miterLimit = 6`.
3. For each live strand (order is free: `lighten` is a per-channel max): `g.strokeStyle = rgb`; `g.lineWidth = w`; `g.beginPath()`;
   `g.moveTo` the first point; `g.lineTo` each next point (2 to 6 points); `g.stroke()`; then `g.fillStyle = rgb` and
   `g.fillRect(ax - 2.5, ay - 2.5, 5, 5)` for each of the two anchors.
4. `g.restore()` (puts the composite mode back).

Never call `arc`, `ellipse`, `quadraticCurveTo`, `bezierCurveTo`, gradients, shadows or filters. Cost: about 40 live strands at worst
(densest Rach 2, newest per pitch, most gone inside 1 s): 40 strokes of 1-5 segments (about 120 segments) and 80 small fills, well under 1 ms.
Bucketing strokes by colour is not needed at this count.

## 6. Tests (`tests/pluck.test.ts`)

Load as `tests/flee-snap-switch.test.ts` does: read `../lab/tools/pluck.js`, `instantiate('pluck', SRC, { icon: { ink: '#fff', gauge() {} },
chords })` with its recorder proxy as `x.g`. Do **not** use `loadCatalogue` (the id is not in `index.html` yet). Context:
`{ g, t, dt: 1/60, W: 1280, H: 720, rnd, p: (k) => vals[k], picked: false, feat: {...} }`, no `onPicks`. Run at 60 Hz, calling `onChord`
for each chord as `x.t` passes it, then `frame`. Notes built by hand and grouped with `groupChords`. Assert:
1. Entry: id `pluck`, name `Plucked corner`, tag `new`; keys exactly `['pull','corner','shiver','ring','touch','presence']`; defaults
   1, 1, 0.09, 1, 2, 1; `touch.step === 1`; `presence.leads === true`; `less` only on `pull` (0.6) and `ring` (0.25); every param has a hint and icon.
2. The source holds the SNAP block byte-identical to `lab/snap/envelope.js` (slice by markers) and contains no `\r`.
3. Nothing is drawn before the first chord (no `stroke` or `fillRect` in those frames).
4. Attack step of a 3-note chord: exactly 3 `stroke()` and 6 `fillRect` calls, `globalCompositeOperation=lighten` set, `lineWidth=4.000` present.
5. No curves: a 6 s run's log has no `arc`, `ellipse`, `quadraticCurveTo`, `bezierCurveTo`, `createLinearGradient`, `createRadialGradient`, `shadowBlur`.
6. Nothing moves between notes: one note (m 60, v 70), frames 0.6 s to 0.85 s: `moveTo`/`lineTo` arguments identical every frame (one straight
   segment), and from the third step on the parsed `strokeStyle` channels never rise frame to frame.
7. Gone: that note at piano, ring 1: no draw after 1.2 s; at ring 0.25: no draw after 0.4 s.
8. Repeat: m 60 twice 0.3 s apart: on the second attack step the first and last points equal those of the first attack step; an interior point differs.
9. Determinism and statelessness: `Math.random` replaced by a throwing function; two runs give identical logs; a fresh instance run only
   from t = 3.0 s logs exactly what the continuous run logs for the same frames.
10. Guard: a clip of one note draws on its attack and no `NaN` appears in the log; `picked: true` runs without error.

## 7. Judge moments (60 Hz video, never the live lab)

- Liebesleid picks, about 172-244 s: slow picked melody; each note one clear pull, repeats land a new corner on the same thread.
- Rach 2, 0-170 s: the opening bell chords and the repeated chords (41 % repeats): crossing strands, repeats re-plucking without stacking.
- Winter Wind: the run case, a spray of short high strands kinking and gone; check it does not become a field of bolts.
- The one question for a still: **is anything curved anywhere?** It must not be; the fan of straight hairlines inside a parallelogram is
  the texture. Second look, on the 2nd or 3rd step after an attack: is the flat-topped trapezoid visible?

## 8. Risks and fallbacks

- **Travelling front** (the running corner reads as something moving along the line on video). Fallback named by the essay and SYNTHESIS:
  the standing shape `y(s,t) = A*Math.exp(-t/tau)*tw(t/per)*f0(s)`, the corner fixed, flipping V to inverted V, with the triangle wave
  `tw(p) = 4*Math.abs((((p % 1) + 1) % 1) - 0.5) - 1` (1 at p = 0, -1 at 0.5; linear, so every frame is still straight lines). Build both
  behind `const FORM = 'run'` (or `'stand'`) at the top of the file so the switch is one word; not a knob.
- **A kinked line read as a bolt:** only ever 2 corners (4 with a pad), period floor 0.1 s, motion gone in about 0.25 s, brightness only falls.
- **Sparse frame** on a slow melody: strike is 4 px and anchors stay; if still sparse, raise the `pull` default, not the width.
- **Still line too dim** (46 levels when the motion ends at middle C): lift it with `ring` (2 doubles its life); never bring back the tail or `alpha`.
- **Bass deflection capped by the frame** (about 80-90 px): accepted; the bass strand is 1180 px, so its fan is still large.
- **Antialiased hairlines under `lighten`** settle a little low at partial coverage (SYNTHESIS: c/(0.12 + 0.88c)); accepted for 1.25 px lines.
- **Knobs read at frame time** (moving `touch` or `ring` changes marks already sounding): as in handover; accepted.

## After review

- The resting line had its tone factor from the envelope's share (E/P, body capped near 46 % of the peak), so it was barely-visible maroon and `ring` did little. The colour tone is now `Pn * max(flash, 0.55 * body)`: the still line starts near 120 in red and halves by register. `q = E/P` is kept only for the gone test. Brightness still only falls, so no new attack appears.
