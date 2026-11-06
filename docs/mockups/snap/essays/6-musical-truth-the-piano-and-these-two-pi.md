# Musical truth: the piano and these two pieces

*Lens: music. I worked from the measured audio, the picked sets and the code. Numbers marked "measured" come from `songs/<id>/audio.mp3`: ffmpeg at 8 kHz, RMS over 10 ms windows. Everything else is a starting value to tune.*

## 1. What a piano note does, measured on these recordings

**The hammer.** The felt touches the string for about 1–4 ms. In both recordings the loudest moment comes **10–70 ms after the transcribed onset** (measured). Most of that gap is transcription jitter. One frame at 60 Hz is 16.7 ms, so **the peak of a strike belongs in frame 0**. Any ramp that rises over more than about 2 frames reads as a swell, not as a strike.

**The two-stage decay.** I measured the pp bell chord at 10.41 s in the concerto, where nothing else plays until 12.99 s. Relative to its peak:

| After | 0.3 s | 0.5 s | 0.75 s | 1.0 s | 1.5 s | 2.0 s |
|---|---|---|---|---|---|---|
| Level | −5.5 dB | −8.2 dB | −11.3 dB | −16.3 dB | −17.0 dB | −18.4 dB |

That is about **16 dB per second for the first second**, an amplitude half-life of about **0.37 s**. After that it drops to about **2 dB per second**, a half-life of about 3 s. The ff chord at 28.27 s has the same shape: −9 dB at 0.5 s and −16 dB at 0.75 s. So the piano's own envelope is a sharp prompt drop followed by a quiet, slow tail. That is exactly the "snappy" the user is asking for.

**The pack's `loudness` curve cannot measure any of this.** It is heavily smoothed: every bell chord takes about 1.0 s to reach its peak in it. Nothing snappy should be driven from it.

**Register.** Bass strings ring longer and treble strings die faster. The top keys, roughly midi 89 and up (it varies by piano), have **no dampers**: they ring on after the key is released. Liebesleid's climax touches them (p13 starts on 90, p15 on 92).

**The pedal makes length unreliable, except at the short end.** The bell chords are transcribed 4–5 s long (pedal held). Concerto p15 has a median length of 0.06 s, and Liebesleid p11 has 0.14 s (real staccato). The end of a pedalled note is the pedal lifting, not the note ending. So a length under about 0.15 s means "dry, the damper fell". A longer length tells us almost nothing.

**Repeated notes** strike a string that is still sounding. The sound never starts from silence, and the same body is hit again.

**Rolled chords split.** The runtime groups onsets within 40 ms. Liebesleid p5–p8 are rolled chords whose notes come **70–90 ms apart** (for example 176.23 → 176.30 → 176.39 → 176.46 s). Each one fires 4–5 separate attacks. A widget made snappier, without knowing this, would flash 4–5 times for what is musically a single gesture. **This is the main musical risk of "snap" in these two scenes.**

**What the current code does to an attack:**

- **Squares** is already close to right. It overshoots by 16% and settles in 0.1 s (`k = 1 + (1 − land) × 0.16`). But its brightness falls *linearly* over 0.3 s (`lit = 1 − age/0.3`). At 0.1 s a linear fall keeps 67% of the flash; an exponential with a 35 ms half-life keeps 14%. That difference is the "crack".
- **Gust** eases its front in over 0.1 s, cubic.
- **Halftone** raises a held note over 0.25 s (`min(1, age/0.25)`).
- **Kandinsky planes** fade *in* over 0.4 s (`min(1, age/0.4)`). That is a swell, the opposite of a strike.
- **Ivory** keys stand up in `RISE = 0.2 s / hardness`, which is 0.125 s at intensity 2.
- **The shared pulse** has a 0.8 s half-life and takes the max of attacks, not their sum.
- **The background fade** puts a floor on everything: anything drawn once already halves in about 0.09 s. Nothing drawn on the shared canvas can die faster than that.

## 2. A truthful envelope: three channels, one pure function

A note's light should be split the way its sound is:

- **flash**: the hammer, about 2 frames.
- **body**: the prompt decay.
- **ring**: the aftersound. It is a *different look* (dimmer, thinner, no glow) and it **never gets brighter again**. That is how the second stage stays "a quiet change of state", per the no-fake-attacks verdict.

```js
// lab/layers/strike.js: a note's light as a function of song time since its attack. Pure, deterministic.
const p01 = (m) => Math.max(0, Math.min(1, (m - 21) / 87));
function strike(age, n, k = {}) {                       // n: { m, v, d, amount?, role? }
  if (age < 0) return { flash: 0, body: 0, ring: 0 };
  const a = n.amount ?? 1, raw = n.v * a, v = Math.min(127, raw), over = Math.max(0, raw - 127) / 64;
  const E = Math.pow(2, (v - 64) / 28);                 // ≈ loudness: ×2 per ~28 velocity (~10 dB)
  const hBody = 0.37 * Math.pow(2, (60 - n.m) / 24) * (k.ring ?? 1);   // measured 0.37 s near middle C
  const hRing = 8 * hBody;                              // measured ≈ 3 s after the first second
  const share = 0.12 + 0.13 * (1 - p01(n.m));           // bass keeps more aftersound
  const hard = Math.max(0, Math.min(1.5, (v - 70) / 40 + over)) * (k.strike ?? 1);
  const flash = hard * Math.pow(0.5, age / 0.035);      // the hammer: two frames
  const dry = n.m < 89 && n.d < 0.15 && age > n.d;      // staccato: the damper falls; pedalled ends are ignored
  const cut = dry ? Math.pow(0.5, (age - n.d) / 0.06) : 1;
  return { flash, body: E * (1 - share) * Math.pow(0.5, age / hBody) * cut,
           ring: E * share * Math.pow(0.5, age / hRing) * cut };
}
```

**Resulting half-lives of the body:** 0.74 s at C2, 0.37 s at C4, 0.19 s at C6, 0.15 s at midi 92.

**Velocity** sets two things:

- *How big* (E, a perceptual scale: v 36 gives 0.5, v 92 gives 2).
- *Whether there is a flash at all.* Soft notes below about v 70 get no flash: they are not slower, they are **rounder**, with the peak still in frame 0 but no white core and no overshoot. Hard notes crack. On a real piano a soft note sounds rounder because it has fewer high partials, so this is timbre, not only size.

**Pitch** sets the decay. **Length** only switches staccato on or off.

## 3. A note's place in the phrase

Picks are known in advance, so roles can be computed once, as Ivory's `planOf` does. I ran a detector on all 35 sets.

- **Phrase gap:** max(0.6 s, 2.5 × the set's median gap between attacks).
- **Roll:** 3–6 attacks, each 40–120 ms apart, spanning at most 0.5 s, pitch moving one way, then at least 0.3 s of quiet.
- **Run:** anything faster or longer than a roll.

| Role | How it is detected | Flash | Body | Example |
|---|---|---|---|---|
| lead | first after a gap | ×1 | ×1 | every set |
| peak | highest note of a phrase with ≥3 attacks | ×1.3 | half-life ×1.5 (the agogic weight) | concerto p8 79 |
| last | before a gap | ×0.5 | ring ×1.3 if it is long | p1's G4 |
| sigh | single note, 1–2 semitones below the previous, softer, <0.9 s later | **0**: the previous object glides down and dims over 80 ms | as its own velocity | Liebesleid p1, p2, p3, p13, p15 |
| roll member | as above, not the last note of the roll | 0 (a dim tick) | ×0.6 | p5–p8, p17 |
| roll top | the last note of a roll | ×1.25: the roll's only flash | the summed body | p5's 74 at v 79 |
| restrike | same pitch while the previous one has not ended | ×0.6, same object re-kicked | max(current, new); half-life ≤ gap/3 | concerto p7 (G2 ×4), p17 |
| run inner | in a run, not a local velocity peak | 0 | ×0.4, half-life ×0.5 | concerto p15, p16 |

The detector's raw output for Liebesleid **p1, p2 and p3 is the same: `lead+peak, sigh, last`**. Those are the opening's three sighs: C♯5→C5→G4, B4→B♭4→F4, F♯4→F4→E4. Velocities go 58→50→64, 55→44→61 and 41→36→52. In each one the third note is louder and about twice as long, because it lands with the bass. The data already holds the phrase shape. A widget that flashes three equal times is being musically untruthful.

## 4. What the per-note intensity bars should mean

The user is actively using the bars. The concerto picks hold 2, 1.9, 1.4, 1.35, 1.2, 1.05, 0.9, 0.55 and 0.5. **A stored value must keep its meaning**, so `intensity` stays "louder or softer".

**Finding: on loud notes the top half of the bar does nothing today.** In p1, v 100 × 2 is clipped to 127, and in p8, v 105 × 2 is too. The user's strongest marks are lost.

**Proposal (opt-in, only for widgets that read `amount`):** velocity × amount above 127 spills into the flash (the `over` term above). So "2" on a loud note means *a harder crack*, not nothing. Below about 0.6 the note gets no flash at all. Nothing changes for any widget that doesn't opt in.

Two new per-note values come almost for free. `note-values.ts` already applies any knob per note, from that attack until the set's next attack. So a widget that has knobs named **`strike`** (how sharp) and **`ring`** (how long) gets them per note with no new plumbing. Both are read in `onChord`, so each one marks only its own note.

For the picker: draw each note's bar as its **envelope silhouette** (a spike plus a tail, from `strike()`). The user would then see what a bar will do before they hear it.

## 5. Liebesleid: three waltz-specific snaps

The waltz bar is about 1.75 s. Don't take the metre from `pack.beats`: it is sparse (60.6 → 79.6 → 144.7 s). If metre is needed, derive it from bass onsets.

1. **The sigh as one gesture** (p1–p3, at 11.8, 17.2 and 22.6 s; new clips on copies).
   - Note 1 strikes.
   - Note 2 *does not flash*: the same mark slides down one semitone and dims to the softer velocity in 80 ms.
   - Note 3 is a real attack, the brightest of the three although it is lowest, because it lands with the bass. Its long length (1.2 s against 0.6 s) gets ring ×1.3: the held resolution.
2. **The rolled chord as one strike that climbs** (p5–p8, 176–185 s, one every ~2.7 s).
   - Each member lights a small, frame-sharp tick in order. The roll's 75 ms spacing *is* the music, so don't smear it.
   - Only the top note (74 at v 79, 72 at v 75, …) fires the flash. The chord then decays as one body whose energy is the sum of its notes.
   - Four rolled chords make four strikes, not eighteen.
3. **Glass in the treble** (p12–p15, 231–241 s, midi 76–93).
   - The p13 cascade falls 90→88→85→81 at about 0.15 s steps. Treble bodies have about a 0.15–0.19 s half-life, so each drop stays distinct, like water.
   - The undamped notes (89 and up) keep a thin, steady ring that outlives the run and ignores key-up.
   - The staccato in p11 (0.14 s, at 26.5 s) gets the damper cut: dots with no tail at all.

## 6. The concerto: bells and first theme

1. **The bells (5–36 s), an open slot.** Only `fields` runs under them today, so this means a new pick set and clip on a copy of the show.
   - The data: chords at 5.2, 10.41, 15.5, 19.86, 24.15, 28.27, 32.34 and 36.29 s, alternating with the low F (midi 29) at 7.65, 12.99, 17.65, 21.89, 26.02, 30.2 and 34.26 s. Chord top velocities rise 39 → 49 → 67 → 76 → 84 → 97 → 106 → 109.
   - **Rank within the set:** the last bell should be about 2^((106−39)/28) ≈ 5× the first.
   - **The chord** is the strike: flash, then ring ×2. Here the 4–5 s length is reliable, because the pedal is held on purpose and nothing interrupts it.
   - **The low F** is the toll from under the floor. A bass hammer is felt more than seen, so it gets no flash: a body rising from below, and a ring that beats slowly (`ring × (0.75 + 0.25·cos(2π·1.3·age))`, deterministic), like a bass string's slightly detuned unison.
2. **The arrival, then the pulsing G** (42–48 s; squares on p1, p2, p7).
   - **Measured:** after the C1 at 42.03 s the audio does *not decay*, 0 to +0.4 dB over 2 s: the orchestra takes over.
   - The truthful picture: the piano's flash and body die fast as usual, and a separate, steady, dim floor (the orchestra) holds until the next attack. That keeps the strike snappy without lying about the sustain.
   - The G2 ×4 (p7, legato) is **restrikes**: the *same* square jolts and brightens again. No new square appears.
3. **Run heads in the figuration** (p15/p16, 127–134 s: 84 and 61 attacks about 0.07–0.09 s apart; halftone and kandinsky).
   - At 12–14 notes a second the ear hears a texture with accents. Show a shimmering floor (bodies ×0.4, half-life ×0.5) and **flashes only on heads**: notes at least 12 velocity above both neighbours, or the first after any gap of 0.15 s or more.
   - **The repeated chords in p17** (51/55, 133.7–139 s) are hammering restrikes: one object kicked again each time, with the body half-life capped at gap/3 (about 30 ms) so each blow reads on its own.

## 7. What should NOT snap

- **Pedal ends.** A note's end is not an event, so nothing happens when a pedalled note "ends".
- **Long legato lines.** The theme p3 (45–67 s, median gap 0.84 s, hand-shaped intensities 0.5–1.4) and p13 are the strings' melody. Only their lead and peak should strike; inner notes move what is already there. The user's gust there with `linger 2.6` agrees.
- **Inner voices of a chord.** Only the top and the bass flash; the ear follows the outer voices.
- **The other notes of a roll, the second note of a sigh, run notes that aren't heads.**
- **Notes the user turned down** (intensity < 0.6): they bloom, no flash.
- **The ring itself.** It never gets brighter again and never moves fast.
- **Fade-ins** like kandinsky's 0.4 s should never be used on a strike.

## 8. Build tonight

All of it is opt-in and deterministic. Defaults stay pixel-identical (`renderFrameHash`), port 5300.

1. **`lab/layers/strike.js` + `tests/strike.test.ts`** (Sonnet, 2 h).
   - `strike()` as above, plus `roles(chords)` for the roll, sigh, restrike, run, peak and last rules, cached per chord array.
   - Tests use the real sets: p1 → `lead+peak, sigh, last`; p5 → one roll whose top is 74; concerto p7 → three restrikes.
   - *User sees:* nothing by itself; it feeds items 2–4.
2. **A mock-up page: `docs/mockups/snap/piano-truth/index.html`** (Sonnet, 4 h).
   - Plays the real audio with the real picks.
   - Six passage buttons: bells 5–37 s, sighs 10.7–25.7 s, rolls 174.9–186.2 s, glass 230–242 s, arrival 41–49 s, run 126–135 s.
   - Three columns on the same notes: *today* (squares' curves: land 0.1, linear lit 0.3, fade 1.4), *strike* (the envelope only) and *strike + roles*.
   - Under each column, a lane drawing the envelope over the audio's RMS, measured in the page from `decodeAudioData`.
   - Two sliders: strike and ring.
   - *User sees:* whether the curves match what they hear, before any widget changes.
3. **A new widget: `lab/tools/hammer.js` ("Hammer")** (Sonnet, 3 h).
   - One mark per attack: a lit bar at pitch height, with a white core for the flash, a warm body and a thin ring line.
   - Uses `roles()` (roll = one climbing strike, sigh = glide, restrike = re-kick).
   - Knobs: strike, ring, size, colour, presence. `strike` and `ring` then work per note through the picker.
   - Registered in `TOOL_IDS` (`lab/index.html`) and `src/widgets/catalogue.ts`.
   - *User sees:* a widget on the Liebesleid sighs and rolls that flashes once per gesture.
4. **An opt-in `snap` knob on Dread squares** (default 0 = today, exactly) (Sonnet, 2 h).
   - At 1: `lit` becomes flash + body, restrikes of a living square's pitch kick it again instead of adding a square, and roll members are held back.
   - Check both scenes' `renderFrameHash` at default.
   - *User sees:* the concerto's 42–48 s with the G pulsing in one square.
5. **Before/after videos with sound** (Sonnet, 1.5 h).
   - `lab/render.mjs` plus ffmpeg `hstack` at 640×360.
   - Three comparisons: concerto 41–50 s (squares snap 0 against 1), Liebesleid 174–186 s (Ivory today against Hammer), and the bells 5–37 s with Hammer on a copied show.
   - *User sees:* "snappier" judged by ear, side by side.