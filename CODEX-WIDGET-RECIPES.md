# CODEX: THE WIDGET RECIPES

These are the recipes for Task 6 in `CODEX-HANDOFF.md`. Read that file first. Build these 12 in this order, one commit each.

These widgets are meant to be unlike anything in the collection. The idea is the recipe's, and your job is to carry it out exactly. **Do not add decoration, do not make one more conventional, and do not swap in something you think looks better.** Maxim's rule is "abstract, never literal": if a widget starts to look like an illustration of a thing, that is a failure, even if it looks good.

1. `stress`: Stress. Maxim wants it.
2. `crackle`: Crackle. Maxim wants it.
3. `seep`: Seep. Maxim wants it.
4. `lamps`: Lamps. Maxim wants it.
5. `tacet`: Tacet. Maxim wants it.
6. `varini`: Varini. Maxim wants it.
7. `statues`: Statues. Maxim: "very interesting, lets keep it".
8. `afteryou`: After You. Maxim: "interesting, lets see what it turns out to be".
9. `marey`: Chronophotograph. Maxim is not sure yet.
10. `planish`: Planish. Maxim is not sure yet.
11. `fauxpas`: Faux Pas. Maxim is not sure yet.
12. `johansson`: Johansson. Maxim is not sure yet.

Rejected by Maxim, do not build: Loom, Tide Machine, Semaphore, Stilts, Audience, Footsteps, Thrust. Maxim called the literal ones a no-go.

## Things every recipe assumes

- One file, `lab/tools/<id>.js`: `TOOLS.push({ id, name, tag: 'new', blurb, params, reset(x), onChord(ch, x), frame(x) })`, inside `(() => { ... })();` like the others. The blurb is the recipe's one-liner, in plain words.
- The canvas is 1280×720 at 60 frames per second. `x.g` is a Canvas2D context; also `x.W`, `x.H`, `x.t` (song seconds), `x.dt`, `x.now`, `x.level`, `x.rate`, `x.feat = { level, rate, pitch, bass, density }` (0..1), `x.rnd(a, b)` (seeded), `x.sounding()`, `x.top()`, `x.pitch01(m)`, `x.p('key')`, `x.moment`.
- `onChord(ch, x)` is one attack: `ch = { t, notes: [{ m, v, d }], vel, lo, hi }`. `m` is the MIDI pitch, `v` velocity 0..127, `d` duration in seconds.
- `window.NOTES` is the whole piece, `[[start, end, midi, velocity], ...]`, and `window.CHORDS` its attacks, known in advance. A layer listening to one part sees only that part. Read them with a guard, and lazily, not at the top level of the file.
- Before widgets draw, each frame the shared canvas is faded with `rgba(0,0,0,0.12)` and burned darker. What you do not redraw fades in about half a second.
- Your own canvases and WebGL contexts are made lazily inside `frame`, never at the top level, because widget files also load in node for tests. `lab/tools/fireworks.js` shows WebGL2. Use the seeded `x.rnd`, or the recipe's hash function, never bare `Math.random` for anything that must replay after a seek.
- A recipe's knob list gives `key`, `label`, `min`, `max`, `value` and `hint`. Every knob also needs an `icon`: pick from `lab/README.md`'s `ICON` helpers, as `lab/tools/squares.js` does.
- **How present in these recipes:** each recipe treats `presence` (label 'how present', 0..1, default 1) as a plain knob the widget reads with `x.p('presence')`, deciding how much it makes. Build it that way. Do not mark it `leads`, and do not add `less` to other knobs, even though `lab/README.md` describes that for other widgets. Claude converts these afterwards if Maxim keeps them.
- A recipe's "done when" is what to check by rendering frames and looking at them. Do not write browser tests for it, or compare pictures pixel by pixel. If a recipe mentions a node assert for its pure functions, a small unit test in `tests/` is fine.
- If a song named in a recipe is missing here, use the nearest one in `SONGS` and say so in your report.

---

## 1. `stress`: Stress

The music squeezes a block of clear plastic between two polarising filters. Where nothing presses, the screen is pure black. Every note presses on the edge and rings of metallic blue, lime and violet bloom from that point, while the passage's tension slowly bends the whole block, until the chord where the music resolves lets it all go to black.

**Why it is new.** It is photoelasticity: colours are computed from force, not chosen, black means no force, and two presses interfere and cut black saddles between them, so a tension built over 20 seconds is literally visible and released on a chord found in advance.

**The picture.** Full 1280x720, no lines or shapes. Unloaded is #000000. From each contact, leaning circles tangent to the edge; lows from the bottom, highs from the top. By fringe order N, far edge to contact: black (N<.18), #0e0f13 (.3), pewter #65675f (.5), #896d2f (.7), #693605 (.85), indigo #1c0b4d (1), cobalt #2562e5 (1.2), lime #c6e86f (1.5), violet #5a27c3 (2), #88c72a (2.5), #8e49c2 (3), rose #a16570 (4), pale #b8b0a8 (9+). Dark brushes fan from contacts. Late in an arc, the same colours stack as horizontal bands from top and bottom towards a black middle band.

**State.** Cached once per window.NOTES identity, built lazily in the first frame: per-note Float32Arrays (cx, cy, ux, uy, R0, a, loud); chord tables T[], e[], A[]; payoffs[]; arc start, end, Bmax; a[], the analyser angle at each chord. Lazy WebGL2 canvas 640x360, alpha false. No accumulated state: everything is a pure function of x.t, so a seek is exact. onChord is empty; reset clears nothing but must not throw.

**Algorithm.** ANALYSIS
1. v10, v99 = note-velocity percentiles; m50 = median midi. lc(v)=clamp((v-v10)/(v99-v10),0,1). Use the bare CHORDS, as lab/index.html passes it.
2. Each chord: pcs = distinct m%12. d = mean over pc pairs of IC[interval class], IC=[0,1,.5,.15,.1,.05,.7]; d=.2 for one pc. n=notes.length. e=lc(vel)^1.6*(.35+1.3*d)*(1+.15*(min(8,n)-1)). A[] = prefix sum of e. f=vel*(1+.07*min(8,n-1)); rank = fraction of chords with smaller f.
3. before=sum e in [t-4,t)/4; after=sum e in [t+.15,t+3)/2.85 (two pointers). P90 = 90th percentile of before. score=.55*rank+.45*clamp((before-after)/P90,0,1)-.3*d. Candidates: rank>=.8, t>6. Sort by score descending; take if 12 s or more from every taken; stop at ceil(duration/20). Sort by t.
4. Arc k runs from payoff k-1 (or chord 0) to the chord before payoff k. u(i)=(A[i]-A[start])/(A[end]-A[start]). Bmax=(1.2+10*(rank-.8))*(k even?1:-1), using the payoff's rank.
5. Per note: p=x.pitch01(m). rankv = fraction of song velocities below v. loud=.5*clamp((v-30)/80,0,1)+.5*rankv. R0=40+860*loud^2.2. a=4+46*(1-p)^2. cx=1280*(.06+.88*p). s=(((m*7)%12)/11)*2-1; psi=sign(s)*(.2+.3*abs(s)). m<m50: cy=724, u=(sin psi,-cos psi). Else cy=-4, u=(sin psi,cos psi).
6. Analyser: T[i]=(((lo*7)%12)/12)*pi/2 unwrapped to nearest mod pi/2. a[i]=a[i-1]+(T[i-1]-a[i-1])*(1-exp(-(t[i]-t[i-1])/.5)). alpha(t)=a[i]+(T[i]-a[i])*(1-exp(-(t-t[i])/.5)).

FRAME
7. Walk back from x.t, at most 800 notes, stopping at start<t-30. Skip rankv<.5 if presence<.25. age=t-start. Pheld(age)=.75+.25*exp(-age/1.6)+.25*exp(-age/.09), 1.25 on the attack frame. After end: P=Pheld(d)*exp(-(t-end)/(.25+1.6*memory)); if loud>.75, P=max(P,.14*exp(-(t-end)/3)). D=R0*force*(.35+.65*presence)*P. Drop D<10. Keep the largest round(8+24*presence).
8. S=sum D. If S>1100, multiply every D by (1100+1400*(1-exp(-(S-1100)/1400)))/S.
9. B: chord i at t. ue = u(i-1) to u(i), linear over .1 s after chord i. B=Bmax*tension*(.35+.65*presence)*ue^1.4. In the last .6 s before a payoff, B*=1+.04*sin(2*pi*14*t). After a payoff tp, add .35*Bpeak*exp(-(t-tp)/.06), where Bpeak is the old arc's value at ue=1. After the last payoff, only that tail.
10. If x.dt>0, tension>0 and t is within .133 s after a payoff, fill the stage with rgba(0,0,0,.45) first.
11. If no loads and abs(B)<.01, draw nothing. Else upload and draw a quad.
Shader: p=vec2(gl_FragCoord.x*2.,720.-gl_FragCoord.y*2.); v=(p.y-360.)/360.; xx=B*v*abs(v); yy=xy=0. Per load: d=p-c; r2=dot(d,d)+a*a; q=min(0.,-D*dot(d,u)/r2); e=d/sqrt(dot(d,d)+1.); xx+=q*e.x*e.x; yy+=q*e.y*e.y; xy+=q*e.x*e.y. N=sqrt((xx-yy)^2+4.*xy*xy). phi=.5*atan(2.*xy,xx-yy+1e-6).
Colour: for lambda {450,490,530,570,610,650}, T=sin^2(pi*N*550/lambda); rgb=sum T*W, W=(.10,0,1),(0,.35,.6),(.05,1,.05),(.75,.85,0),(1,.3,0),(.6,.03,0); rgb/=(2.5,2.53,1.65). w=max(smoothstep(5.,9.,N),smoothstep(.35,.7,fwidth(N))); rgb=mix(rgb,vec3(.72,.69,.66),w). rgb*=smoothstep(.18,.62,N)*(.5+.5*smoothstep(.6,.85,N)). rgb*=mix(1.,sin^2(2.*(phi-alpha)),brushes*.85). Output vec4(rgb,1.).
12. Set globalCompositeOperation='lighten', smoothing on, drawImage(cv,0,0,W,H), restore. Without WebGL2 or under node, draw nothing and do not throw; handle context loss as lab/tools/fireworks.js does.

**Music.** Loudness is reach on the attack frame. Quiet note (v35): a dome 117 px across at N>=.4, settling to 60 px. mf: about 25% of the screen. fff: the whole frame, N=1 circle about 800 px wide. Pitch: x along the keyboard; below median from the bottom; bass is broad and smooth, treble tight rings. Note name: lean. Chord's lowest note: analyser angle, so a bass change swings the brushes and dims the bend bands to as low as 45%. Chord size: more contacts, interfering. Duration: held notes creep to 75%; on release the bands run back into the edge. Tempo: runs walk along an edge and merge. Tension: bands build with accumulated chord weight, each attack tightening them; dissonance builds faster. Payoff: bands lose two thirds on that frame, the stage wipes in 8 frames, and only the chord's rings remain. Silence: black in about 1.5 s; rings from notes with loud>.75 last about 7 s. Moment: unused.

**Knobs.** presence, 'how present', 0..1, value .7: scales reach and bend by (.35+.65*presence), sets the load count, and below .25 only the louder half press. Hint: Left: only stronger notes press, in small rings at the edges. Right: every note presses at full reach.
force, 'how hard', .4..2, value 1. Hint: Left: a few pale bands near the edges. Right: coloured bands well into the middle.
memory, 'how long it holds', 0..1, value .35. Hint: Left: bands snap back when a note ends. Right: the plastic relaxes over a couple of seconds.
brushes, 'dark brushes', 0..1, value .65. Hint: Left: clean rings. Right: dark fans cut the rings and swing with the bass.
tension, 'how much tension builds', 0..1.25, value 1; 0 also disables the wipe. Hint: Left: only the notes press. Right: the whole slab bends as the passage builds, then lets go on the resolving chord.

**Traps.** 1. Milky blobs. The harness fade plus premultiplied source-over settles at c/(.12+.88*max(c)), so pewter 103 becomes about 214. Rule: 'lighten' with opaque output only, which is exact from the attack frame; never source-over, compensated alpha (it dims the attack) or 'lighter'. The F term is mandatory.
2. Cheap rainbow or pale noise. Rule: no HSV, palette or gradient; the six-wavelength sum is the only colour. Knee and fwidth wash are mandatory; never raise resolution or fringe count. Wash stays before F, or it greys the black saddles.
3. Breasts or archery targets. Rule: abs(psi)>=.2 always, q=min(0,q) (otherwise a coloured second lobe appears beside each dome), and the split uses the real median.

**Done when.** Before any music: a JS twin returns exactly 0 for N<.18, and within 6/255: .3=14,15,19; .5=101,103,95; .7=137,109,47; 1=28,11,77; 1.2=37,98,229; 1.5=198,232,111; 2=90,39,195. Render N 0..9 as a PNG strip, composited through fade-then-lighten; frames 1 and 30 match within 3/255; judge by eye: no white anywhere. Synthetic, attack frame, default knobs, area N>=1: 6-note fff (midi 36,48,55,64,72,84) about .73, 2-note (48,72) about .53, one quiet note 0. Payoffs: lab/notes.js includes 144.9 s (9 total), b5 includes 79.2 s (20 total). Prelude at 144.9: bands stacked with a black middle at 144.8, gone by 145.0; consecutive chords differ, with at least one true black saddle. chopin-nocturne-48-1, first 30 s: small leaning domes below, rings above, N>=.4 under 45% of the screen, rings contract as notes end. rite-sacrificial-dance: full flare on the exact attack frame; near-black in gaps over 1.5 s. rach-concerto-2 opening: soft and loud chord areas differ by 3x or more. Seek and pause: identical frame.

**Cost.** WebGL2, one pass at 640x360 with up to 32 loop iterations, plus one drawImage. CPU under 1 ms, including the 800-note walk; integrated GPUs about 1 to 3 ms at worst. If slow, cap loads at 24, never lower the resolution.

---

## 2. `crackle`: Crackle

A black plane is divided note by note. A note's line runs wall to wall across the piece it lands in and stops dead against older lines. Nothing moves or is erased; the song ends as one finished net.

**Why it is new.** Sequential partition with true T-junctions: each line splits exactly one cell, so the picture is the whole song's permanent record, and which lines the song could still draw depends on every note before.

**The picture.** Full frame of flat near-black cells, rgb(8+14v, 8+13v, 9+12v), v 0..1. 700-1000 lines by the end. Long lines (L>=84 px): #e6dfc8, width 1+1.2*big, big=min(1,L/300), with a halo rgba(230,223,200,0.10), width 3+6*big. Short lines: #b8863a, 0.9 px. Densest in the song's pitch band; large empty plates at top and bottom. No line crosses another.

**State.** cells[] {p polygon, bbox, a area, tone}; fresh[] {pts, born}; flashes[] {cell polygon, born, alpha}; pending[] long lines not fully ripe {pts, born, W, stage}; lazy 1280x720 canvases tones (opaque) and lines (transparent); next, pen, penDir, lastGapT, lastT; sorted velocities, N, song lo/hi from CHORDS.

**Algorithm.** H(i,k)=frac(sin(i*12.9898+k*78.233)*43758.5453). onChord is empty; frame reads bare CHORDS (typeof guard), so live and replay share one path.
1. Rebuild if flagged by reset, x.t<lastT, x.t>lastT+0.5, or fine changed (at most every 0.25 s): one cell = whole rectangle, tone 0.5, pen 0.5, penDir 1, next 0; apply all chords t<=x.t without live effects.
2. Each new chord i: pen+=penDir*(0.012+0.05*min(1,gap/0.8)), bounce at 0.03/0.97. Each note k: r=velocity percentile, pp=(m-lo)/(hi-lo). tx=clamp(1280*pen+(H(i,k)-0.5)*60,1,1279); ty=720*(0.92-0.84*pp)+(H(i,k+20)-0.5)*50. C=first cell containing it (bbox, then point-in-polygon). Always push a flash.
3. Try only if i<12, or r>=1-keep, or H(i,k+40)<rand, where keep=min(1,(200+900*presence)*fine/N), rand=0.15*presence*min(1,3000/N). Refuse if C.a<380+2600*(1-r).
4. (mx,my)=vertex mean; th=0.5*atan2(2*sxy,sxx-syy); dir=th+PI/2+(H(i,k+60)-0.5)*0.5. Line through ((tx+mx)/2,(ty+my)/2), or (tx,ty) if that is outside C.
5. Intersect all edges: A=nearest hit forward (edge ia), B=nearest backward (edge ib). Refuse if either is missing, ia==ib, or L=|AB|<14.
6. Cubic Bezier A, A+nA*0.08*L, B+nB*0.08*L, B; n=edge unit normal pointing toward AB's midpoint. M=clamp(round(L/9),6,24) segments, no jitter. Any interior point outside C: straight AB, same M.
7. poly1=pts+vertices ib+1..ia (wrapping); poly2=reversed pts+vertices ia+1..ib. Child tone=clamp(C.tone+(H(i,k+80 or 81)-0.5)*0.25,0,1). Fill both on tones with a 1 px same-colour stroke.
8. Live line: attack frame draws first 40% of pts in #fffdf0, 1.5 px; the rest appears over 0.06 s; at 0.25 s bake to lines, drop from fresh. Short: final at once. Long: #b8863a 1 px; age 2 s #8a7a58, width 0.6W; age 8 s final colour, W, halo. Replay bakes the stage its age has reached.
9. Draw: o=presence, tones with globalAlpha 0.12*o/(1-0.88*o), which settles at exactly o under the fade. Lines alpha 1. Both drawImage(c,0,0,x.W,x.H). Then flashes age<0.25: fill #f6f2dc, alpha=min(0.6,flash*(0.08+0.3*v/127)*min(1,sqrt(60000/a)))*(1-age/0.25). Then fresh.

**Music.** Loudness: loud notes may split small cells, soft only large; brighter flash (v110 alpha 0.34, v30 alpha 0.15). Pitch: height. Chord size: several lines and flashes in one vertical band. Tempo: fast runs concentrate along the pen; gaps jump up to 0.062 of the width. Bass: only low position. Silence: nothing new; recent long lines keep brightening for 8 s. Future: N fixes line count, so all songs finish. Moment: unused. Attack frame: cell flash always; 40% of any line.

**Knobs.** {key:'fine',label:'how fine',min:0.3,max:1.6,value:1,hint:'Left: few big plates. Right: a dense net by the end.'} {key:'halo',label:'halo',min:0,max:1.4,value:1,hint:'Left: bare lines. Right: a wide soft edge on long lines.'} (multiplies halo alpha) {key:'flash',label:'how bright each note',min:0,max:1.5,value:1,hint:'Left: only lines show. Right: every note lights its cell.'} {key:'presence',label:'how present',min:0,max:1,value:1,hint:'Left: about 200 lines, no ground. Right: the full net on its ground.'} How present steers keep, rand and the ground's alpha.

**Traps.** 1. Illustration. Tangent 0.25*L with jitter rendered as a leaf: keep 0.08*L, no jitter, no branching. No pale ground, shards, motion or fill colour; no pottery or glass wording in the blurb. 2. Strobing on early huge cells: keep the sqrt area factor. 3. A new cell's fill erasing neighbouring lines: always keep tones and lines on separate canvases. Silent attacks: flash every note, refused or not.

**Done when.** chopin-nocturne-48-1: first line at about 3.7 s; about 10 lines at frame 600 (10 s); about 840 at the end, no crossings, densest mid-height. chopin-winter-wind: flashes in a walking band. rach-concerto-2: about 1000 lines, not solid. prelude pause: last long lines brighten. b5: seek back gives the identical net. Presence 0: about 200 lines over any layer beneath.

**Cost.** Canvas2D, about 1 ms: two drawImage, few polygons. Split logic run on 7 real songs: 720-1004 lines, replay 4-31 ms, max 56 vertices per cell. Final net rendered on black and checked; flashes, ripening stages and presence dimming were not rendered.

---

## 3. `seep`: Seep

A thin line low on a black screen. Pale rings rise toward it; each touches it on the exact moment its note sounds, flattens into a bright-rimmed ellipse and drifts upward with everything before it. Same note, same column; pauses stay as empty bands. You see every note before you hear it.

**Why it is new.** The future is visible as objects already travelling, launched backwards from their attacks, and the past is a permanent record in which silence is empty space.

**The picture.** Line y=560, 1 px, rgba(120,200,210,0.35). Below: #000 with 5-30 ring outlines, #dff4f6, 1.2 px. Above: gradient #04161b at the line to #000 at the top, holding ellipses 20-270 px wide, aspect 0.25, white rim, translucent centre, covering 15-35% of the area. Older ones dimmer.

**State.** Built lazily in frame: item list {ti,x,W,L,rs,tilt,phase} sorted by ti; sprite canvas 256x64; ring canvas `strip` 1280x1024; bakedIdx, clearedTo, lastT, dirty.

**Algorithm.** Helpers: H(a,b)=fract(sin(a*127.1+b*311.7)*43758.5453). p=clamp((m-m2)/(m98-m2)), pitch percentiles. L=clamp((v-v10)/(v99-v10)), velocity percentiles.
1. Build: for NOTES[j]=[st,en,m,v] with velocity rank (0..1) >= (1-presence)*0.9: x=70+1140*p+18*sin(st*0.03+m*1.7); W=max(14,(28+200*L^1.5)*(1.2-0.5*p)*size); item ti=st. Extra items k=1..round(held*(min(6,1+floor((en-st)/0.28))-1)): ti=st+0.22k+0.16H(j,k), W*=0.42+0.33H(j,k+10), x+=(H(j,k+20)-0.5)*(4+0.04W). Every item: rs=240+300L, tilt=(H(j,k+30)-0.5)*0.05 rad, phase=6.28H(j,k+40).
2. Map: A=NOTES.length/lastEnd; c=clamp(3A,12,60); F(t)=speed*(360*(sqrt(t+9)-3)+c*t). Row=F(ti). Screen y=560-F(x.t)+F(ti).
3. Sprite once: translate(128,32), scale(1,0.25), radial gradient radius 10 to 120, stops 0 rgba(190,225,232,0.35), 0.75 rgba(220,240,244,0.55), 0.93 #fff, 1 transparent; fill arc radius 124. Always draw width 1.07*w, height a quarter of that, centred.
4. frame, in order: fill the opaque background (this overwrites the harness fade; never rely on it). Clear strip rows (clearedTo, F(x.t)+200] mod 1024. Bake items with age=x.t-ti>=1.6 at alpha 0.72, width W, tilted, drawn a second time at row±1024 if crossing. Blit strip with two drawImage calls for the wrap, fractional y. Overlay black gradient, alpha 0 at y=560 to 0.55 at y=0.
5. Live, 0<=age<1.6: sprite w=W*(1-0.45*exp(-age/0.04)), alpha max(0.75,1-age/2.5). age<0.25: 'lighter' ellipse stroke #fff 1.5 px, width w*(1+2age), aspect 0.25, alpha (0.1+0.9L)*exp(-age/0.08). age<0.6: line segment x±1.5W on y=560, rgba(200,240,250,exp(-age/0.2)).
6. Rings, ti-160/rs<=x.t<ti: y=560+(ti-x.t)*rs; x+(1.5+0.03W)*((y-560)/160)*sin(y*0.035+phase); r=3+0.08W; ellipse rx=r, ry=r*(1-0.35L), stroke, fill alpha 0.12. Cap 60, keep largest.
7. onChord is empty. If x.t<lastT, x.t-lastT>0.25, reset ran, or a knob changed (at most every 0.25 s): rebuild if needed, clear strip, rebake the newest 500 items with age>=1.6 and F(x.t)-F(ti)<=640.

**Music.** Loudness: ellipse width, ring size, rise speed, flash. Pitch: column, low left, lows wider. Chord: one horizontal row. Arpeggio: staircase. Held note: irregular smaller ellipses beneath the first. Tempo: packing density. Bass: no separate treatment. Silence: empty water beforehand, then a permanent empty band. Moment: unused. Attack frame: ring gone, ellipse 55% wide, flash at peak, segment lit.

**Knobs.** {key:'size',label:'how big',min:0.5,max:1.8,value:1,hint:'Left: small shapes with black between. Right: broad overlapping plates.'} {key:'speed',label:'how fast it climbs',min:0.4,max:2,value:1,hint:'Left: crowded stacks. Right: each note has room.'} {key:'held',label:'how long notes feed',min:0,max:1,value:1,hint:'Left: one shape per note. Right: held notes build stacks.'} {key:'presence',label:'how present',min:0,max:1,value:1,hint:'Left: only the loudest tenth of notes. Right: every note.'} How present steers only the rank cut in step 1.

**Traps.** 1. Reads as frozen lake, jellyfish or falling-notes piano roll: no cracks, no highlights on rings, no keys, no per-note colour, one colour family, rim stays full white while live. 2. Stacks read as screws or poker chips: extra widths come only from the hash, never tapering with k; keep tilt and offset. 3. Lost sync: launch is computed backwards from ti, and sway reaches 0 at y=560 so nothing jumps on contact.

**Done when.** prelude opening: watch a ring arrive and hear the note as it flattens; repeated bass builds one column. chopin-nocturne-48-1 at 2:30: irregular stacks, a pause leaves an empty band. vivaldi-spring: runs make staircases. rach-concerto-2 past 10:00: ellipses still separable, budget held. Seek anywhere: identical picture.

**Cost.** Canvas2D, 1-1.5 ms, no getImageData. Worked by hand, not rendered. Loud (L=1,p=0.3): W=239, 131 px on attack, flash 1.0, ring r=22, rise 0.30 s. Quiet (L=0.1,p=0.8): W=27, 15 px, flash 0.19, r=5, rise 0.59 s. Frame 1: F=0. Frame 600 (A=8): F=729, a t=5 note sits at y=218, about 8.6 s visible.

---

## 4. `lamps`: Lamps

A wall lit by three lamps, bass red, middle green, treble blue, showing only the shadows of a heavy mobile you never see. A clash pulls the lamps apart and every shadow splits into cyan, magenta and yellow; a cadence closes them into one black shape; silence turns out the lights.

**Why it is new.** Real additive shadows: each colour is the arithmetic of which lamp is blocked, so harmony becomes physical, on a body never shown.

**The picture.** Silence: #000. Loud full chord at defaults: wall centre (210,188,216), corners a quarter of that. Lobes: red blocked (19,175,209), green blocked (204,36,198), blue blocked (197,166,25), black where lobes overlap. Bass alone: red pool, black shadows. Low pieces huge and soft, high pieces small and crisp, 1.6 px threads rising out of the top. Nothing else is drawn.

**State.** E[3], lastJump[3]; sep, sepV, sepTarget; objects[9] {u, uV, tw, twV, tw0, Px, Py}; rank[128]; 3 lazy layer canvases 960×540; 9 lazy sprite canvases. reset clears all and rebuilds from x.rnd and NOTES. Never call x.rnd in onChord.

**Algorithm.** Constants by band 0..8: Rs=[230,180,140,110,90,70,54,42,32]; zo=[800,700,560,440,340,260,180,120,70]; m=1400/(1400-zo); sigma=[33,25,17,11,8,6,4,2,1]; T=[3.4,3,2.6,2.2,1.9,1.6,1.4,1.2,1.05]*weight; kind=[slab,leaf,hoop,leaf,slab,leaf,hoop,leaf,slab]; slot=[4,1,7,2,6,0,5,3,8]; kickScale=[.55,.6,.7,.8,.9,1,1,1,1]; thread top h=slab .28Rs, leaf .5Rs, hoop Rs.
reset: rank[m]=(NOTES below m + half of NOTES equal to m)/N (m/127 if NOTES is empty). Px=W*(.08+.84*slot/8)+rnd(-35,35). Py=H*(.62-.4*band/8)+(odd band?-40:40). tw0=random sign*rnd(.35,.96) rad.
Sprites, first frame, black, ctx.filter blur(sigma px), canvas side 2*(Rs+3*sigma). Slab: half-sides Rs by .28Rs. Leaf (times Rs): (-1,0), bezier (-.4,-.62),(.6,-.5) to (1,.05), bezier (.55,.42),(-.35,.5) back. Hoop: arc radius .89Rs, stroke .22Rs.
onChord, each note: b=min(8,floor(rank[m]*9)), r=floor(b/3), loud=clamp((v-30)/80,0,1). uV[b]+=dir*(70+560*loud)*kickScale[b]/weight², dir=sign(uV), or m odd?1:-1 at rest. twV[b]+=(m odd?1:-1)*(.8+5*loud)/(1+Rs/80). Then once per register touched, using its loudest note: peak=.35+.65*loud; if t-lastJump>=.34, g=1 and lastJump=t, else g=.3; E+=max(0,peak-E)*g. Discord: distinct pitch classes of chord plus x.sounding(); w by interval class {1:1,2:.6,3:.15,4:.1,5:.05,6:.9}; d=clamp((mean w-.12)/.43,0,1), 0 if under two classes. sepTarget=30+260*d*split; sep+=60*loud*d.
frame, dt=min(x.dt,.05):
1. held[r]=min(.6,.55*sum(v/127)) over sounding notes. E above held: E=held+(E-held)*exp(-dt/.4). Below: same with tau .08.
2. C=wall*(.6+.4*presence). Lv0=min(C,E0+.25E1); Lv1=.8*min(C,E1+.25*max(E0,E2)); Lv2=min(C,E2+.25E1). All under .01: return, drawing nothing.
3. sepV+=(256*(sepTarget-sep)-14.4*sepV)*dt; sep=clamp(sep+sepV*dt,0,340). Lamp i: L=sep*(cos,sin)(.04*x.t+[210°,330°,90°]).
4. w=2π/T: uV+=(-w²u-.08w*uV)dt; u+=uV*dt; A=hypot(u,uV/w); if A>200 scale both by 200/A. twV+=(-1.44(tw-tw0)-.144twV)dt; tw+=twV*dt.
5. For lamps with Lv>=.01, on the layer at scale .75: opaque radial gradient centred (640,360)+.6L, radius 120 lamp colour to radius 860 at 10% brightness; colours (255,18,10),(10,255,30),(18,30,255). For bands below 3+round(6*presence): Sx=Px+u+L.x*(1-m), Sy=Py+L.y*(1-m); draw sprite centred there, x scale max(.18,|cos tw|); black thread 1.6 px from (Px+L.x*(1-m),-40) to (Sx,Sy-h).
6. Fill x.g opaque #000; 'lighter'; drawImage each layer at 1280×720, globalAlpha=Lv.

**Music.** Attack frame: lamp brightness and split both jump. Register picks lamp and piece, from the song's own thirds. v=110 bass: Lv at ceiling, big slab swings 170 px. v=40: Lv .43, swing 40 px. Triads give d=0, one nearly black shape; tritone gives d=1, band 0 lobes up to 452 px apart. Held notes glow; short ones die in .5 s. Above 3 attacks/s light steadies. Silence: black under 2 s, swings continue unseen. Moment unused.

**Knobs.** presence 'how present' 0..1, .7: steers pieces (3+round(6p)) and wall ceiling. Left: three big soft shadows, dimmer wall. Right: all nine, brighter wall.
split 'how far a clash splits' 0..1.2, 1. Left: shadows stay nearly black. Right: clashes throw pure colours far apart.
weight 'how heavy' .6..2, 1. Left: light, quick. Right: huge, slow, barely answering.
wall 'how bright the wall' .4..1, .85. Left: dim glow. Right: nearly white on loud chords.

**Traps.** Strobing: the .34 s gate is mandatory. Trails: 'lighter' on the fading canvas brightens eightfold; keep the opaque fill. Green wall: rank thirds, bleed and .8 are mandatory. Reads as Venn diagram or anatomy: only these shapes, tw0 never zero, slots fixed, threads always drawn, shadows never tinted.

**Done when.** Unit math: alphas 1, .8, 1, one lamp blocked, give #1AEAFF, #FF30FF, #FFDE22. chopin-nocturne-48-1 opening: dim red pool, blue joins on melody. prelude: split widens and closes at resolutions. rite-sacrificial-dance: steady pale wall, wide lobes, at most 3 full jumps/s per lamp. rach-concerto-2 opening: slab still swinging 3 s after a deep chord. b5 ending: black within 2 s.

**Cost.** Canvas2D, 2 to 3 ms; about 1 ms when quiet. Sprites about 20 ms once.

---

## 5. `tacet`: Tacet

A small orchestra of plain shapes, one per piano key, who all know the score. Those with nothing to play slump and fall asleep. Much later one jolts awake, stands shaking, plays its one note, and its neighbours look round. They arrive late and leave after their last note.

**Why it is new.** It draws what each key is waiting for, so the row's posture is the future of the piece.

**The picture.** Ground #0B0A09. Risers: 1 px #2A2620, x 30..1250, y 320/480/640. One square-topped rectangle per key, staggered on the risers: bass left 46x92, treble right 16x40. Lying #4A4338, upright #D9CFB8, overworked #F2A33A, playing #FF4A1F and airborne. Empty seats: 12 px, 1 px tick, #4A4338. Shapes cover about 15% of the screen; above y=160 and below y=650 is black.

**State.** Key: m, i, seatX, floorY, w, h, dir, times[], ptr, first, last, leaveT, theta, thetaV, hopY, hopV, squash, flash, white, look, nodded. Global: J, velsSorted, dense[], dur, snap. No random numbers.

**Algorithm.** BUILD FIRST: only build, posture with snap and draw. Render vivaldi-winter t=210. Expect about 38 lying, 5 slouched, 20 absent. If it reads as tombstones or bars: h=lerp(110,30,p), breath x2. Never change colours.

BUILD: K keys sorted by midi; p=i/max(1,K-1); seatX=60+1160p; tier=i%3; floorY=[320,480,640][tier]; ts=[.8,.9,1][tier]; w=lerp(46,16,p)*ts*size; h=lerp(92,40,p)*ts*size; dir=m even?1:-1, but 1 if seatX<170. rests=all same-key gaps, descending; J=max(20,rests[floor(len*.015)]||0). dense[floor(t/.25)]=distinct keys with onsets within t±1 exceed .3K. rankIn: clumsy.js line 36. leaveT: last within 1.5 s of final onset: dur+.5+.35*order; else last<=travel*dur: last+1.6; else infinity.
reset: binary-search ptr, zero motion, snap=true.

FRAME (dt=min(dt,1/30)), per key: while times[ptr]<=t ptr++. prev=times[ptr-1], next=times[ptr], s=t-prev, wait=next-t, W=next-prev, Ws=W*sleep.
1 Stage. If first>4 and first>=(1-travel)*dur: tick only before first-4; then u=min(1,(t-first+4)/3.4), X=lerp(nearer of -60/1340,seatX,1-(1-u)^2), a=.25 towards seat, hop=-|sin(14*pi*u)|*10. From leaveT, e=t-leaveT: X=seatX+110e towards nearer edge, width x(1-.55*min(1,e/.2)), hop=-|sin(3*pi*e)|*4, target 0; offscreen draws nothing.
2 lead: W>=J 2.6; Ws>=15 1.1; Ws>=5 .7; else 0. rest: Ws<5 .03; Ws<15 .12+.03(Ws-5); else 1.57.
3 Target (omega,zeta): no prev: 0 (10,1). wait<=lead: 0, W>=J (30,.45), Ws>=15 (14,.8), else (10,1). s<.5: 0 (10,1). No next: .12 (1.1,1). Else rest (1.1,1).
thetaV+=(omega^2*(target-theta)-2*zeta*omega*thetaV)dt; theta+=thetaV*dt; clamp -.35..1.57. If snap: theta=target, except last case theta=rest*(1-(1+1.1q)e^(-1.1q)), q=s-.5; nodded=s>=3.5.
4 Nod: W>=J or Ws>=15, s>=3.5, not nodded: thetaV-=1.6*fuss.
5 Tremble, Ws>=5 and wait<=lead: (.012+.05*min(1,W/J))*fuss*sin(88t+i).
6 squash: wait<.12: max(squash,.14); else x exp(-dt/.1). If hopY<0: hopV+=2600dt, hopY+=hopV*dt; on hopY>=0: both 0, squash=.2. look,x exp(-dt/.7); flash x exp(-dt/.18).
7 Colour: lerp(#D9CFB8,#4A4338,clamp(theta/1.2)); heat=clamp(notes in last 3 s/9), lerp #F2A33A; lerp #FF4A1F by min(1,flash); white and s<.06: #FFF4E0.
8 w'=w(1+.57squash), h'=h(1-squash). theta>1: w'x(1+.08sin(1.4t+i)), h'x(1+.04sin(1.4t+i)). heat>.3, s>.2: h'x(1+.05heat*sin(20t)).
9 a=dir*theta+look+tremble. Back tier first, walkers last. a>=0: translate(X+w/2,floorY+hopY), rotate(a), rect(-w',-h',w',h'). a<0: translate(X-w/2,same), rotate(a), rect(0,-h',w',h'). Fill, stroke 2 px ground.
Before shapes: fill canvas with ground at alpha .45+.55presence.

onChord, per note: while times[ptr]<=ch.t+.045 ptr++; R=gap before times[ptr-1], else 0. v=rankIn(velsSorted,n.v). theta=thetaV=0, nodded=false, flash=1, white=v>=.85 or R>=J. If hopY>-2: H=(6+34v)*fuss*(.5+.5presence); R>=J: H,flash x1.5; dense now and note neither ch.lo nor ch.hi: H x.5. hopV=-sqrt(5200H); hopY=-.35H.
If R>=J: r=i>K/2?14:9; each seated j, 0<|i-j|<=r, theta_j<.6: look_j=sign(seatX_i-seatX_j)*.3*(1-|i-j|/(r+1)).

**Music.** Loudness: hop height and white flash, never size. Worked: loud peak 54 px, quiet 13 px, loud jolt 81 px. Pitch: place, size, tier. Chord size: more hop together. Tempo: per key, heat and panting. Bass: wide left shapes, same rules. Silence: only breathers and those about to play move. Future: next rest sets posture, first note arrival, last departure. The moment: nothing. Attack frame: upright, 35% into its hop, full flash.

**Knobs.** {key:'sleep',label:'how soon they doze',min:.3,max:3,value:1,hint:'Left: awake through long rests. Right: nod off after a few seconds.'}
{key:'fuss',label:'how much they fuss',min:0,max:2,value:1,hint:'Left: calm, small hops, no shaking. Right: frantic, big hops.'}
{key:'travel',label:'comings and goings',min:0,max:1,value:1,hint:'Left: everyone stays on stage. Right: arrive before the first note, leave after the last.'}
{key:'size',label:'how big they are',min:.6,max:1.4,value:1,hint:'Left: small figures. Right: great slabs.'}
{key:'presence',label:'how present',min:0,max:1,value:1,hint:'Left: only those near a note. Right: the whole orchestra.'}
Presence: shape alpha=lerp(presence^1.5,1,clamp((win-d)/.4)), d=distance to nearest note, win=W>=J?3:1.2. Risers, ticks alpha=presence. Also hop and ground, above.

**Traps.** 1. Equaliser: height never follows loudness or activity beyond the limits above; hops move the rigid shape; the dense rule halves inner notes.
2. Tombstones: square tops, three tiers, sleepers always breathe, never darker than #4A4338.
3. Constant waking: jolt, long tremble and look only for W>=J. Above 16 jolts a minute, J is wrong (Rite measures 15.1).

**Done when.** vivaldi-winter: half the keys entered by 8%. 3:30 passes the first check. vivaldi-spring: last key runs in near the end. b5: 13% gone by 35%. chopin-winter-wind storm: right amber, left down, about 12 jolts a minute. Nocturne jolt: a neighbour five seats away tips 8 px or more in one frame, and a viewer sees the turn.
Automatic: every key with a note within .05 s has |theta|<.08. Attack frame: flash>=1, hopY<0. Seek, play 4 s, compare with played-through: |theta difference|<.12. Dense fires at 0-20% of a song.

**Cost.** Canvas2D, at most 79 rectangles: under 1 ms of the 4 ms budget. Build O(notes), once. Own canvases: none. Opaque ground at presence 1 hides layers beneath.

---

## 6. `varini`: Varini

Broken pieces of bright painted rings hang in a dark room you cannot see. You drift through it; just before a big chord you rush to the one spot where everything lines up, and on the attack the pieces click into one perfect figure. It holds for a breath, then falls apart again.

**Why it is new.** After Felice Varini's paintings across architecture: it uses the future, so the viewpoint arrives exactly on the attack and resolution is literally a thing falling into place, with an upbeat you see before you hear.

**The picture.** Fill opaque #000 every frame (no fade trails). Flat paint, no gradients: red #E3261B midi<48, yellow #F6C700 48-71, bone #F2EEE3 72+. Strokes 6-40 px, hairlines 2.5 px, butt caps. 70-90% black. Between hits: one figure cut by straight invisible edges, pieces sheared one way, near ones up to 3x further. Never draw walls or edges. At the hit: one clean figure of off-centre rings, square frames (dissonant) or diagonal bands (1-2 notes).

**State.** pieces[] (≤32 convex {pts,zn,bbox}), targets[], j (next target), two lazy 1680×1120 canvases (leaving, approached), thin, kick {x,y,vx,vy}, ready. Room generator: s=48271; s=s*16807%2147483647 (not x.rnd). Hash H(i,n): h=imul(i+1,73856093)^imul(n+1,19349663); h^=h>>>13; h=imul(h,1274126177); ((h^h>>>16)>>>0)/2^32. i = chord's index in CHORDS (binary search on t).

**Algorithm.** 1. Room (once): rectangle (-200,-200)-(1480,920), zn=1.2. Split up to 5 levels; stop below 26000 px². Cut through a random point in the central 60% of the bounds: 65% at 90°±7°, 35% on the line to (640,290). Child zn=parent*rnd(.78,1.28), clamped .8..2.4. Sort zn descending.
2. Targets (first frame; rebuild if often changes): score=vel*(1+.07*min(8,notes-1))*(1+.5*min(1,longest d/1.5)), *1.3 if the previous chord is ≥.8 s earlier. Descending, accept if no accepted chord within 2.4-1.85*often s. Any accepted gap >4 s: add its strongest chord ≥.8 s from both ends; repeat. Add empty sentinels at t=-2 and last note end+2 (black afterwards). Each: loud=clamp((vel-30)/80,0,1); kind: 'frames' if any pair |a-b|%12 is 1, 6 or 11, else 'bands' if ≤2 notes, else 'rings'; dir=((lo*7)%12)/12*2π; dz=+220 if hi>previous target's hi else -220.
3. Figure, in stage coords (translate 200,200): P=pitch01(hi), centre (640+180(P-.5), 360-240(P-.5)). Per note low to high: p=pitch01(m), w=6+34*clamp((v-30)/80,0,1), r=60+280(1-p), r=min(r, prevR-(prevW+w)/2-10), skip if r<24. Rings: centre offset (6+.09r) at angle (m%12)*30°. Frames: axis-aligned square of half-side r, same offset. Bands: line across the canvas at -24°, perpendicular offset (p-.5)*600, keeping (w1+w2)/2+10 between two bands. presence≤.2: top 2 notes only.
4. Timing, t in [t0,t1): gap=t1-t0, dwell=min(.5gap,(.16+.22*loud0)*hold), d=gap-dwell. If t<t0+dwell: f=0,u=0. Else u=(t-t0-dwell)/d, ws=1-min(.45,.42/d); u<ws: f=.3*smoothstep(0,1,u/ws); else f=.3+.7*((u-ws)/(1-ws))^3.
5. A=(260+300*loud1)*reach*(cos dir, .6 sin dir). kick applies to x,y. ΔL=f*(A,dz1)+kick; ΔA=-(1-f)*(A,dz1)+kick; during a dwell, ΔL=ΔA without kick.
6. Alphas (smoothstep with edge0<edge1 only). aL=min(1-ss(.35,.7,u),1-ss(1,1.6,t-t0)). aA=0 in dwell, else 1-ss(lo,hi,t1-t) with hi=min(d,max(2.6,gap-1.4)), lo=max(min(.45gap,.7),hi-1.9).
7. Draw if alpha≥.02, leaving first. |Δ|<1: drawImage(fig,-200,-200), no clip. Else each piece: zd=zn-Δz/1000, s=zn/zd, save, g.transform(s,0,0,s,640(1-s)+Δx/zd,360(1-s)+Δy/zd) (not setTransform; backing store may be scaled), clip polygon grown .75 px from its centroid, drawImage(fig,bx+200,by+200,bw,bh,bx,by,bw,bh), restore. If t-t0<.05: draw whole figure again, 'lighter', alpha .6.
8. Spring, dt=min(x.dt,1/30): vx+=(-900x-27vx)dt, x+=vx dt, clamp |x|,|y|≤70.
9. hit(): j++, swap canvases, clear and draw target j's thick figure on the approached one, thin=0, kick=0. onChord: return if !ready; while targets[j].t≤ch.t hit(); return if ch was a target. Else if ch.t≥t0+dwell: kick velocity+=unit(2π*H(i,999))*52*(8+40*loudOf(ch)). Each note n: if thin<60 and H(i,n)<.25+.75*presence, draw a 2.5 px shape of the approached kind, step 3 geometry without the spacing rule. frame: same while loop first.
10. reset: ready=false, kick=0. Frame when !ready: j=first target after x.t; leaving=thick(j-1)+hairlines from chords in (t[j-2],t[j-1]); approached=thick(j)+hairlines from (t[j-1],x.t]; ready=true.

**Music.** Strongest, biggest, longest chords after a silence are the resolutions, landing on their attack frame. Loudness: separation and hold (dwell .38 s to .16 s), stroke width. Harmony: clash squares, chords rings, bare notes bands. Pitch: low big red outer, high small bone inner; top note moves the figure. Bass pitch class: flight direction. Melody direction: dolly in or out. Ordinary attack frame: hairline plus a jump of 9-35 px, near pieces more. Fast playing fills the figure; slow leaves near-empty drifts. Silence: hangs on the plateau; the whip starts at most .42 s before the chord. The moment is not used.

**Knobs.** presence 'how present' 0..1, .75: share of ordinary notes painting hairlines; ≤.2 targets draw 2 notes. Left: only the big chords' few strokes. Right: every note leaves its hairline in the picture.
reach 'how far apart' .3..1.5, 1. Left: the picture stays nearly whole and only slips along its cuts. Right: the pieces fly right across the room.
often 'how often it resolves' 0..1, .55. Left: only the few biggest chords click together. Right: it clicks about every half second.
hold 'how long it holds' .5..3, 1. Left: a blink. Right: the whole figure stands for about a second.

**Traps.** 1. Cracks through the perfect figure from clip antialiasing destroy the idea. Rule: no clip when |Δ|<1. Test: stub g.clip and assert zero calls on every dwell frame.
2. Archery target, RAF logo or confetti. Rule: rings always use the step 3 offset; pieces are only the fixed room; never arc fragments. If the f=.3 still reads as confetti, narrow the child factor to .88..1.14 once.
3. Late or floaty click. Rule: f comes from x.t, never an accumulator; cubic into a dead stop, no ease-out; no kick in a dwell (arpeggio notes there paint only).

**Done when.** First, a still at f=.3 on rach-concerto-2 at 15.5 s: one figure from the wrong place, ≥60% of its paint on screen, else multiply travel by .8. Expected: vel 110 chord: travel 560, plateau shift about 327 px at zn 1.2, dwell 23 frames, last whip frame jumps 45 px. Vel 40 note: 10 px band, travel 297, shift 173, dwell 11 frames. Frame 0: black or dim broken paint. b5 frame 600 (t=10): one 19 px band, f≈.24, cut and shifted about 237 px. b5: click at .99; 3.36 hairline and shudder; click at 3.85; the 3.85-12.9 silence stays broken and still (dim only around 5.5-6.5 s). rach-concerto-2: clicks at 5.18, 7.65, 10.41, 12.99, no seam on a paused dwell frame. rite-sacrificial-dance: about half frames, hard shifts. chopin-winter-wind: dense hairlines, clicks at least 1.38 s apart.

**Cost.** Canvas2D. Worst about 64 clipped partial drawImage calls, 1.5-3 ms during a crossfade; usually one figure, about 1 ms. Figure rebuild at a hit about 1 ms.

---

## 7. `statues`: Statues

Thin dark rectangles inch along a floor towards a sliver of slab, one step per note. Just before each silence the slab widens into a wall of light and they stop mid-tilt, shaking on one corner. In the longest silences one topples and slides back alone.

**Why it is new.** It reads the future and stops everything just before a silence, so rests, not attacks, are the brightest events.

**The picture.** Ground #070706. Floor line 2 px #2A2620 at y=628. Slab centred x=1148, y 128-628: 16 px wide, #2E2A24, while music plays. Square-cornered rectangles #6E6556, width 0.11×height (6-18 px), standing on the floor, about 3% of the screen. In a silence: slab 190 px, #F4EBD6; floor band lit; rectangles brighter nearer the slab, tilted on a corner, with black floor shadows to the lower left.

**State.** freezes[] {t0, t1, fall, hold}, fPtr, f (0..1), r, base, armed, bolt. Shapes {h, w, start, x, x0, dx, u, dur, side, A, a, av, flash}. H = [168,92,134,70,152,84,118,62,142,76,104,66,124,88,58,110,74,96,138,64,82,100,60,128]; shape i takes H[i], never sorted on screen.

**Algorithm.** Build (reset; again if crowd, rate, speed, nerve or n changes). No x.rnd.
1. g = gaps between CHORDS; sg = sorted descending; dur = last note end. th = max(0.45, sg[min(len-1, floor(dur/60*rate))]). fT = max(th, 0.9, sg[min(len-1, floor(dur/20*nerve))]).
2. freezes = every gap>=th, plus last attack with t1=Infinity. fall = nerve>0 and gap>=fT. hold = next t0 - t1 < 0.35.
3. n = max(3, round(crowd*(0.3+0.7*presence))). start = 60+360*fract(sin(i*12.9898)*43758.5453). S = sum(chord notes>=5 ? n : min(n, notes))/dur/n. base = clamp(790/((45/speed)*S), 5, 60).
4. Put steps 5-9 in step(t, dt), no drawing. Reset replays it from 0 to x.t at dt=1/30, firing chords.
onChord
5. r += 1/1.44. Chord of 5+ notes: all shapes step, with v = chord force rank. Otherwise per note: wanted = round(pitch rank*(n-1)) in tallest-first order; nearest shape with u>=0.75; none free, skip. Ranks are among the whole piece, 0..1.
6. Step: x0=x; dx = base*(0.45+1.1*v)*(leaderX-x>420 ? 1.5 : 1), capped so x0+dx<=1040; dur = 0.30-0.18*min(1,r/8); side=-side; A=0.20*(0.6+0.8*v); u=0.30; flash=1.
7. If this attack is a freeze's t1 and that freeze has no hold: f = min(f, 0.6). If armed and force rank>=0.5, or armed 3 s: bolt=0.95, armed=false.
Frame
8. r *= 0.5^(dt/1). frozen = t in [t0+0.2*dur at t0, t1) and bolt<=0. That instant puts the last-struck shapes at u=0.5, peak tilt, at any tempo. f target 1 while frozen or holding, else 0; rising dt/0.14, falling dt/0.10.
9. Not frozen: u=min(1,u+dt/dur); x=x0+dx*u²(3-2u); a=side*A*sin(πu); drawn height h*(1+0.06*sin(πu)). flash*=exp(-dt/0.12). Frozen: u held; if a≠0 add (0.006+0.03*min(1,age/1.6))*nerve*sin(18πt+i). Rotate about the bottom-right corner if a>0, bottom-left if a<0.
Fall: at age min(0.55, 0.2*gap) take largest |a|, or front-most with a=0.1*side if all |a|<0.03. av+=30*sin(a)*dt; a+=av*dt, stop at ±π/2. If t1-t>=0.9: a→0 over 0.2 s, then x-=170*dt, stopping at start or t1-0.1, a=0.04*sin(6πt). Otherwise lies until t1; upright in 0.15 s. One per gap.
Reset: leaderX=max x; >=1030 sets armed. While bolt>0: f=1; x+=(start-x)*(1-exp(-5dt)); a=-0.25; bolt-=dt; on end u=1, a=0.
10. Draw: fill #070706 alpha 0.5+0.5*presence. Radial wash at (1148,380), r=900, #F4EBD6 alpha 0.07*f*presence. Band y 628-720, gradient alpha 0.55*f*presence at x=1148 to 0 at x=40. If f>0.02, shadow quads (x-w/2,628),(x+w/2,628),(x+w/2-L,714),(x-w/2-1.2L,714), L=clamp(h*(1148-x)/500,40,420), black alpha 0.9*f. Floor line. Slab width 16+174f, lerp(#2E2A24,#F4EBD6,f); below presence 0.4 the lit colour lerps towards #6E6556. Shapes: lerp(#6E6556,#F4EBD6,max(0.35*flash, f*(0.35+0.65*clamp01(1-(1148-x)/1100)))).

**Music.** Loudness: longer step, deeper tilt. Pitch: low notes move tall shapes, high notes short ones. Chord size: 5+ notes moves all. Tempo: step 0.30 s down to 0.12 s. Bass: no separate rule beyond pitch. Silence: gap>=th lights the room; gap>=fT topples one. Held notes count as silence, since only attacks are read. Moment: ignored. Attack frame: stepping shapes are 30% through, tilted 0.81A, and flash; an attack ending a gap drops f to 0.6 at once.

**Knobs.** {key:'crowd', label:'how many', min:3, max:24, step:1, value:13, hint:'Left: three alone. Right: a crowd.'}
{key:'rate', label:'how often it turns', min:3, max:20, value:10, hint:'Left: only the biggest silences. Right: nearly every breath.'}
{key:'speed', label:'how fast they creep', min:0.3, max:3, value:1, hint:'Left: they rarely arrive. Right: they arrive every 15 seconds.'}
{key:'nerve', label:'how shaky', min:0, max:2, value:1, hint:'Left: perfectly still, none fall. Right: shaking, more fall.'}
{key:'presence', label:'how present', min:0, max:1, value:1, hint:'Left: three shapes and a dim glow. Right: full crowd and floor light.'}
How present steers n, all light alphas, ground alpha and lit slab colour.

**Traps.** 1. Strobing: hold keeps the slab lit when the next freeze is under 0.35 s away, so at most 1.25 flips per second.
2. Reading as people, a monolith or a bar chart: rectangles only, no heads, limbs, rounded corners, halo or rays; never sorted by height; warm light only.
3. Catching nobody: freezes always come from freezes[], never from detecting silence. Nothing leaves the floor; shapes only pivot on a corner.

**Done when.** b5 0:00-0:20 and the stops at 1:20 and 2:40: room lights on each held note, several shapes on a corner, one topples on the longest. vivaldi-summer 0:00-1:17: a topple about every 20 s. chopin-winter-wind 0:20-1:42: about 8 turns a minute, steps still readable.
Arithmetic at 6 notes/s, n=13: base 36. Frame 0: x 60-420, slab dark. Frame 600: x about 225-585, on screen. Loud 6-note chord (v=0.9): all step 52 px, tilt 0.26 rad, tallest top shifts 44 px. Quiet note (v=0.1): one shape steps 20 px, tilt 0.14 rad.
No x changes during a freeze except the victim. x.dt=0 holds still. Seeking gives the same picture as playing there.

**Cost.** Canvas2D. At most 24 rotated rectangles, 24 quads, 2 cached gradients: about 1 ms. Reset replay under 10 ms.

---

## 8. `afteryou`: After You

Two unlike flat shapes stop head-on on a phrase's first note, then keep stepping the same way, blocked, the melody choosing which, until the silence lets one stand aside.

**Why it is new.** A phrase is one stalemate, its melody the sidesteps, the breath after it the escape.

**The picture.** Ground #060607. Six invisible lanes, y=110+100i; about two pairs at once. One vermilion #E2502E, one bone #EDE3CF, flat fill: square 56x56, slab 72x44, apex-up triangle 64x60. 1.25 px stairs mark where pairs stood. Shapes cover 4%; the rest is black.

**State.** scenes[] {T,R,lane,meetX,kinds,big,small,dodges[{t,o0,o1,f}],falses[{t,dir}]}. reset empties it; frame builds it when empty, from CHORDS as clumsy.js reads them. Drawing is a pure function of t; onChord is empty. h(i)=fract(sin(i*12.9898)*43758.5453), never x.rnd.

**Algorithm.** f(c)=rank among the song's chords of c.vel*(1+0.07*min(8,notes-1)).
1 CUT. th=max(0.45, the (floor(dur/6)+1)th largest chord gap). Scan i from chord a: if gap(i)>=th and n>=dither, b=i-1. Else if C[i].t-C[a].t>7, b=j-1 for the largest gap(j), j in a+2..i (no j: b=a). Else if C[i].t-lastDodge>=0.24: dodge, n++.
2 DODGES. o=0. delta=hi-prevHi; dir=delta>0?-1:delta<0?1:-lastDir. amt=min(80,min(60,12+5|delta|)*(0.7+0.6f)*step/(1+0.08r)), r=chords within 1 s, this one included (two pointers). o1=o+dir*amt; if |o1|>44, o1=sign(o1)*(88-|o1|). Dodges 1.1 s or more apart get a false start at earlier t+0.45, next dodge's dir.
3 PLACE. T=C[a].t. R=C[b].t+min(0.3,0.5*gap after). meetX=W*(0.22+0.56h(idx)). lane=round((1-rank(hi))*5), else nearest with itself and neighbours free over [T-2.8,R+3], else skip. Kinds cycle: square+triangle, slab+triangle, slab+square. big=(0.7+0.9f)*size, small=big*0.6; odd idx makes vermilion small.
4 WALK, T-2.8<=t<T. u=(T-t)/2.8. Vermilion right edge=meetX-20-u*(meetX+60); bone left edge=meetX+20+u*(W-meetX+60). y=lane+u*(h(3idx)-0.5)*28 (bone h(5idx)), plus hop (2+6f(last chord))*big, sign flipping each chord.
5 STUCK. y=lane+o0+(o1-o0)*(0.35+0.65(1-(1-p)^3)), p=(t-d.t)/0.07, bone /0.10. Each dodge retreats both min(6,48/n) px at once. False start: both move 8 px in dir and back, 0.32 s. Otherwise perfectly still. Colour mixes to white by k*exp(-(t-event)/0.22): k=0.6 at T, 0.15+0.35f on a dodge.
6 RELEASE, R. Smaller eases to y=lane+o-sign(o||1)*((hA+hB)/2+24) in 0.16 s; flip the sign if its centre leaves 40..680. Then both cross at 460 px/s.
7 DRAW. Fill canvas rgba(6,6,7,0.6+0.4*presence). Stairs: each inner edge x, y=lane+o, through dodges so far, alpha 0.6*presence*(1-age/keep)^1.5, age from R, 40 at most. Then shapes.

**Music.** Loudness: first chord sets sizes (f 0.9: 1.51, 0.91; f 0.1: 0.79, 0.47); f scales each step and flash. Loud chord up 5 semitones: 42 px; lone quiet note up 2: 15 px. Pitch: lane, step direction and size. Chord size: within f. Tempo: r shrinks steps. Silence: frees them. Bass, moment: nothing. Attack frame: stop and flash, or step 35% done; walkers hop.

**Knobs.** {key:'dither',label:'how long they dither',min:1,max:8,step:1,value:3,hint:'Left: a step or two, then they pass. Right: stuck until a real break.'}
{key:'step',label:'how far they step',min:0.5,max:1.6,value:1,hint:'Left: shuffles. Right: lurches.'}
{key:'keep',label:'how long stairs stay',min:0,max:40,value:22,hint:'Left: none. Right: forty seconds.'}
{key:'size',label:'how big',min:0.6,max:1.3,value:1,hint:'Left: small. Right: large.'}
{key:'presence',label:'how present',min:0,max:1,value:1,hint:'Left: few pairs. Right: every phrase.'}
Below 0.5 keep every 2nd scene; below 0.2 every 4th.

**Traps.** 1 Suggestive (Duet: soft masses leaning together). After T nothing moves towards its partner: gap 40, only growing. Never curves, contact, squash, swell, rotation, tails, or a shape over 1.7:1.
2 Figures, Pong. No limbs, upright bars, lane lines.
3 Never cap dodges; scenes end only at gaps.

**Done when.** b5: first frame, pair mid-walk; meets at 0.99 s, two steps, escapes into the fermata; 10 s, only stairs; next pair enters at 10.1 s. Log 11-14 scenes a minute, median 7-12 dodges, under 10% skipped. Assert edge gap >=40, never shrinking before R.

**Cost.** Canvas2D, about 1 ms.

---

## 9. `marey`: Chronophotograph

An invisible person walks across a black plate and each attack is the camera shutter. You only see where their limbs were when a note struck: fast music leaves dense fans of white lines like Duchamp's Nude, slow music a few lonely strokes, and after a silence they have walked on in the dark.

**Why it is new.** The music moves nothing: it decides WHEN a body already walking gets photographed, so rhythm is literally the sampling rate of a gait (after Marey's 1880s motion plates).

**The picture.** Black, 85-98% of the frame even in a storm. Hard-coded only non-body marks: floor at y=640.5, 1 px #3c3c3c; ticks hanging below it every 40 px (6 px tall) and every 200 px (12 px tall). Add nothing to fill the black. Above: straight thin strokes, y 225-640 (leaps reach y=65), near side #f2ede0, far side #7b8a99, butt caps; no joints, outlines, hands, round head or filled body. Head is a line from shoulder to crown. Strokes fan out from planted feet.

**State.** Never call x.rnd. `const ch = typeof CHORDS !== 'undefined' ? CHORDS : []` as clumsy.js does, never rebuilt from NOTES, so routed parts hear their own chords. sortedV, sortedM: window.NOTES velocities, midis, sorted. FORCE: sorted c.vel*(1+0.07*min(8,notes-1)). rank(arr,v)=binary-search lower bound/arr.length. WALK[]: {p,R,stoop,x,hop} per 1/60 s, song end +2 s, built lazily in frame; rebuild when `ch` is a different array, or pace changed and x.now-lastBuild>=0.25 (then recompute every cached pose, clear sail caches). EXPO[]: {t,chord,gapBefore,pose}; first chord gapBefore=Infinity; cap 240, dropping oldest. reset: refill from chords in [x.t-24,x.t], newest 240; set lastChordT.

**Algorithm.** TH=118 SH=122 FT=40 SP=150 UA=78 FA=76, G=2600, y down. wrap to [-pi,pi]. B(p,c,w)=exp(-(wrap(p-c)/w)^2).
1. legRel(p,A,K,air): th=A*cos p+0.05; k=0.1+0.14*B(p,0.75,0.55)+(K+air*0.8)*B(p,4.1,0.85)+air*0.5; sh=th-k; fa=0.28*B(p,0.1,0.35)-0.75*B(p,3,0.5)-0.4*B(p,4.1,0.7). knee=(sin th*TH,cos th*TH); ankle=knee+(sin sh*SH,cos sh*SH); toe=ankle+(cos fa*FT,-sin fa*FT).
2. pose(rec): A=0.26+0.2R; K=0.9+0.45R; lean=0.03+0.22R+stoop; air=hop>2?1:0; near=legRel(p), far=legRel(p+pi). low=max of both ankleY and toeY; pelvis=(x,640-low-hop). shoulder=pelvis+(sin lean*SP,-cos lean*SP); crown=shoulder+(sin(lean+0.12)*40,-cos(lean+0.12)*40). arm(ph): sa=0.8A*cos ph-0.03+0.3lean; el=0.3+0.55R+0.3*B(ph,0,0.9); elbow=shoulder+(sin sa*UA,cos sa*UA); hand=elbow+(sin(sa+el)*FA,cos(sa+el)*FA). Near arm ph=p+pi; far ph=p.
3. WALK, dt=1/60, start x=200,p=R=rate=hop=hv=v=0, lastLeap=-9. rate*=0.5^dt. Per chord with c.t<=t: rate+=1/1.44; fr=rank(FORCE,force); if fr>0.975, t-lastLeap>1.8, hop==0: lastLeap=t, hv=sqrt(2G(60+110(fr-0.975)/0.025)), hop=0.01. R+=(min(1,rate/8)-R)*(1-0.5^(dt/1.2)). f=(0.3+0.45R^0.7)*pace; stoop=0.2*(1-clamp(R/0.35,0,1)). If typeof MOMENTS defined, take last entry with start<=t: dread/casket stoop+=0.08,f*=0.9; agitato f*=1.1. dp=2pi*f*dt. If hop>0: hv-=G*dt; hop+=hv*dt; x+=v*dt; hop<=0 sets hop=hv=0. Else stance offset st=wrap(p)>0?0:pi (the leg whose thigh sweeps back; NOT the lower ankle, which walks backward 30% of the time); dx=-(ankleX(p+st+dp)-ankleX(p+st)) with air=0; x+=dx; v=dx/dt. p+=dp. x>W+170: x=-170.
4. onChord: push exposure (pose cached), gapBefore=c.t-lastChordT. Nothing simulates in frame.
5. frame: black fill alpha presence, floor, then each exposure with age=x.t-t<lifeE: fade=(1-age/lifeE)^0.8; lv=rank(sortedV,c.vel). Trunk (pelvis-shoulder, shoulder-crown): near colour, l=lv*0.6, never flashed. If notes>=5 or gapBefore>=1.5: both legs and arms at l=lv. Else per note: r=rank(sortedM,m), side=m%2 (1 near); r<0.5 that leg (pelvis-knee, knee-ankle, ankle-toe), else that arm (shoulder-elbow, elbow-hand); l=rank(sortedV,n.v). v=(0.5+0.5l²)*fade; width=min(3.4,(1+2.4l²)*weight). Canvas alpha a=v(1-k)/(1-k*v), k=0.88(1-presence), so redraws on the fading canvas do not build up (presence 1: a=v).
6. Sails: newest 14 notes with d>0.35, rank(v)>0.4, age<lifeE. Distal segment only (knee-ankle or elbow-hand). Sample pose every 0.05 s from start to min(x.t,end,start+1.5), cached per note. One fill per note, one quad per sample pair; alpha 0.05*fade*smear; skip quads whose x jumps >=200.
7. Batch by colour, alpha floor to 1/16, width to 0.5: at most 192 stroke calls, about 100 real.
8. Flash, last, unbatched, age<0.1, exposure limbs only: #ffffff, alpha FLASH*(1-age/0.1), width+3*(1-age/0.1). FLASH=0.5.

**Music.** Attack: shutter; strokes and flash appear on the attack frame. Loudness: weight, brightness: rank 0.95 gives alpha 0.95, width 3.2 (6.2 flashing); rank 0.01 gives alpha 0.5, width 1. Pitch: below median a leg, above an arm; odd midi near, even far, so a note always lights one limb. 5+ notes: whole figure. Tempo: rate sets R: 0.3 cycle/s stooped trudge to 0.75 cycle/s leaning stride. Bass: legs. Hardest 2.5%: a leap, exposures trace the arc. Silence: nothing drawn, walker walks on; after 1.5 s the next attack shows the whole figure further along. Moment: dread, casket stoop and slow; agitato hurries.

**Knobs.** [{"key":"pace","label":"walking pace","min":0.6,"max":1.4,"value":1,"hint":"Left: a slow trudge, the strokes pile up in tight fans. Right: a brisk stride, the strokes spread across the plate."},{"key":"life","label":"how long the plate holds","min":5,"max":24,"value":14,"hint":"Left: only the last few seconds of the walk. Right: several crossings pile up on one plate."},{"key":"weight","label":"line weight","min":0.6,"max":2,"value":1,"hint":"Left: hair lines. Right: heavy strokes."},{"key":"smear","label":"held-note smear","min":0,"max":2,"value":1,"hint":"Left: only sharp exposures. Right: held notes leave wide pale sails."},{"key":"presence","label":"how present","min":0,"max":1,"value":1,"hint":"Left: a few limbs on the hardest notes over whatever is underneath. Right: every note exposed on black."}]
How present steers: lifeE=life*(0.35+0.65p). Black alpha=p. Below p=0.5: only each chord's top and bottom note expose, never the whole figure. Below p=0.25: no trunk, and only chords with lv>0.97-1.88p.

**Traps.** 1. Stick man in a flip-book. Width capped at 3.4 (flash exempt), whole figure only by the step 5 rule, no round head, joint dots or drawn feet.
2. Mostly black with the figure at an edge, or a smear with no planted feet. x moves only by the no-slip step, never a constant velocity. Pace 1: 370 px/s at R=1 (1620 px crossing in 4.4 s, 3 crossings per 14 s plate); 90 px/s at R=0 (18 s per crossing). Unit test: dx>=0 in every grounded record.
3. Grey bands: sails only on distal segments, x-jump skip, alpha 0.05. Rain: the trunk comb y 225-400 is the densest band; stays at lv*0.6, never flashed. Do not add anything to hide it.

**Done when.** Expected at life 14 (computed): chopin-winter-wind before 5.08 s floor only, then one whole faint figure; 10 s: 7 exposures. 60 s and 90 s: about 150 exposures, 800 segments, 9% lit, fans across the width, planted feet. rite-sacrificial-dance 174 s: 107 exposures, 15% lit, a visible leap arc. chopin-nocturne-48-1 66 s: 35 exposures, 2% lit. Seek twice: identical frame. b5 after the fermatas: whole body further on. Live 20 s, winter wind from 60 s (never watched yet): pick out the flash on 5 attacks in a row; if you cannot, set FLASH=0.8 and change nothing else. Play 10 s: you feel a person walking. Rendered: steps 1-3, 5. Not rendered: flash, sails, knobs, moments, motion, and the 12 px floor drop.

**Cost.** Canvas2D. Worst case 240 exposures, about 1500 segments, about 100 stroke calls, 14 sail fills: estimated 2-3 ms, not measured. Measure at chopin-winter-wind 206 s, life 24; over 4 ms, lower the cap to 180. Poses cached; table build a few ms. No own canvas needed.

---

## 10. `planish`: Planish

A sheet of dark metal in a raking light, and every note is a hammer blow. The dents stay and catch the light in hard silver bands. The sheet rings when struck and hardens under repeated blows, until a pause lets a torch pass over it and leave bruises of straw, purple and blue.

**Why it is new.** An attack is not mapped to a hammer blow, it is one: permanent contact mechanics seen only as reflection, in metal that work-hardens under repetition and anneals in silence.

**The picture.** Undented metal is black. No drawn lines and no plate edge. Dents are facets with crisp creases; each carries one straight band (#ece4d4) about 11 px wide, a dark-to-mid gradient, and sometimes a faint #6082b4 band. Facets are up to about 107 px across in the lower third and 13-24 px in the upper third; the top 10% is usually black. Screen lit: about 25% early, about 55% at the end of a nocturne. Oxidised bands turn #d9b35e, #a8562e, #6a2f86, #2b4fa8. The torch is a patch 300-450 px long, peaking near #982B09.

**State.** Float32Array h[640*360] (grid units), n[2*640*360], hard[160*90], oh[2*160*90] (ox, heat). penX=40, penDir=1, phraseAngle=0.3, lastT=first chord time, nextChord=0, pause={i,t0,t1,k} or null, lastPauseEnd, needReplay=true, lastFrameT, strikes[] newest 6, rings[] newest 4, scales v10, v99, mLo, mHi, sorted velocities (recomputed from CHORDS at each replay; read it as typeof CHORDS!=='undefined'?CHORDS:[]). Lazy in frame: GL2 canvas 1280x720, RG16F textures 640x360 and 160x90, LINEAR.

**Algorithm.** Helpers. L=loud(v)=clamp((v-v10)/(v99-v10),0,1), or 0.6 if v99-v10<1. p=pp(m)=clamp((m-mLo)/(mHi-mLo),0,1), or 0.5 if mHi==mLo; v10/v99 and mLo/mHi are the 10th/99th and 2nd/98th percentiles. rank(v)=lowerBound(sorted,v)/count. Never x.rnd (the lab's is Math.random). H(a,b){let t=(a*4099+b*31+0x6D2B79F5)|0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}; a=chord index.
1. reset: only needReplay=true. onChord: empty; frame runs after it in the same step, so the attack still shows that frame.
2. Frame start: replay if needReplay, x.t<lastFrameT, x.t-lastFrameT>0.5, or hit/size/presence changed (at most one replay per 0.2 s of x.now). Replay zeroes everything, resets the pen, clears strikes and rings, calls advance(x.t,false), uploads all. Otherwise advance(x.t,true).
3. advance(T,live), the only path for live and seek, so they cannot diverge: loop { if pause and t0+k/30<=min(T,t1): torchStep, k++; else if pause and t0+k/30>t1: lastPauseEnd=t1, pause=null; else if nextChord exists with t<=T: applyChord(nextChord++); else break }.
4. applyChord(i): gap=t_i-lastT; lastT=t_i. If gap>=1.2: phraseAngle=H(i,1)*PI. penX+=penDir*(5+26*min(1,gap/0.8)); outside 30..610, flip penDir and clamp. Each note k, skipped if rank(v)<(1-presence)*0.9: cx=penX+(H(i,10+k)-0.5)*6; cy=360*(0.88-0.76*p)+(H(i,30+k)-0.5)*8; soft=1/(1+0.2*hard[cell]); R=min(40,(6+30*(1-p)^1.4)*(0.55+0.45*L)*size); s=(0.05+0.15*L^1.3)*(0.35+0.65*soft)*hit; rho=R/s; z0=h[cx,cy]-0.5*R*s; th=phraseAngle+(H(i,50+k)-0.5)*0.7. Cells within Rs=ceil(2.2*R), clipped to the grid: u=dx*cos th+dy*sin th; v=(-dx*sin th+dy*cos th)/0.72; zh=z0+(u*u+v*v)/(2*rho); if zh<h: h=zh, hard[(y>>2)*160+(x>>2)]+=1/16. Assert under 25,000 cells (R<=40 gives at most 24,328). Recompute n in bbox+1, x 1..638, y 1..358: nx=(h[i+1]-h[i-1])/2, ny=(h[i+640]-h[i-640])/2. texSubImage2D the dirty rect via subarray with UNPACK_ROW_LENGTH 640. If live: strike {x:cx*2,y:cy*2,R:R*2,loud:L,t0:t_i}. After the notes, if live, one ring for the loudest unskipped note: lambda=60+900*(1-p)^2, K=2*PI/lambda, b=H(i,70)*2*PI, k1=K*cos b, k2=K*sin b, phi1=H(i,71)*6.28, phi2=H(i,72)*6.28, A=(0.008+0.055*L^1.5)*ring, tau=0.10+0.30*(1-p), f=5+9*p. Then if t_(i+1)-t_i>=1.2: all heat=0, pause={i,t0:t_i+0.35,t1:t_(i+1)-0.1,k:0}.
5. torchStep: tq=k/30. U=clamp(penX*2,150,1130)-150+penDir*420*tq; U=((U%1960)+1960)%1960; xT=150+(U<=980?U:1960-U); yT=360+200*sin(tq*1.7+H(i,1)*6.28). All cells heat*=exp(-1/18). Cells (centre x*8+4, y*8+4) with r<150: w=exp(-r*r/11250); heat=min(1,heat+0.1*w); hard*=exp(-2.2*w/30). Cells: ox=min(1,ox+heat*heat*0.35/30). Upload oh once per frame while heat is nonzero.
6. Shader, q=(gl_FragCoord.x,720-gl_FragCoord.y) in stage px; texture row 0 is screen top. Light a=2.2+0.05*x.t, Ld=(cos a,sin a). N=texture(n).rg + sum over rings of amp*vec2(cos(k1*q.x+phi1)*sin(k2*q.y+phi2),sin(k1*q.x+phi1)*cos(k2*q.y+phi2)), with amp=A*exp(-age/tau)*cos(2*PI*f*age) in JS, 0 past 4*tau. dd=dot(N,Ld); d2=dot(N,vec2(-Ld.y,Ld.x)); bump=min(1,length(N)/0.02); k=exp(-(dd-0.045)^2/(2*0.016^2)); kb=exp(-(d2-0.09)^2/(2*0.02^2)); ramp=clamp((dd+0.02)/0.2,0,1). metal mixes bare, then #d9b35e, #a8562e, #6a2f86, #2b4fa8, #8fa3b8 at ox 0, .25, .5, .72, .9, 1. c=metal*(0.006+bump*(0.02+0.2*ramp*ramp+0.9*k))+vec3(.376,.51,.706)*kb*bump*.25+vec3(1,.28,.06)*pow(heat*exp(-max(0,x.t-lastPauseEnd)/.25),2.2)*.75 (inside a pause the exp factor is 1; without it a finished torch's patch would stay lit) + each strike vec3(1,.96,.9)*(.25+.75*loud)*exp(-age/.07)*exp(-r*r/(2*(.9*R)^2)). c*=0.35+0.65*presence. Alpha=clamp(max(c)*4,0,1). Output premultiplied rgb=c-(1-alpha)*max(vec3(0),0.8905*c-0.0119): this cancels the harness fade and colour-burn, which otherwise lift dim tones up to 2.8 times (c=.05 would settle at .14). x.g.drawImage(canvas,0,0,1280,720).
Build order, stopping at each. A: stamp and lobes; unit-test L=.9,p=.2 gives R=26.7, s=.181; L=.1,p=.7 gives R=6.88, s=.0575, a rim glint with no blue band because slope peaks at .08. B: flash. C: ring. D: torch.

**Music.** Loudness: slope and hammer size; loud is a sharp facet with the band well inside, soft is a thin rim glint. Pitch: height, and low notes 2-6 times wider. Chord: a vertical stack at one pen position, one ring. Tempo: the pen walks 5 grid units in fast runs, up to 31 after slow gaps. Bass: the widest facets and a ring near 960 px wavelength lasting about 0.4 s, a broad band moving over the black. Silence: 1.2 s or more lights the torch, softens the metal, adds permanent oxide. Repetition: same place gets shallower. Moment: unused. Attack frame: full dent, flash at peak, ring at maximum.

**Knobs.** {key:'hit',label:'how hard it hits',min:0.4,max:1.6,value:1,hint:'Left: light taps, thin glints at the rims. Right: deep blows with wide bands of light.'} {key:'size',label:'hammer size',min:0.5,max:1.6,value:1,hint:'Left: small marks with black between them. Right: broad facets that crowd each other.'} {key:'ring',label:'how much it rings',min:0,max:1.5,value:1,hint:'Left: a dead sheet that only dents. Right: light sloshes across the whole sheet on every blow.'} {key:'metal',label:'metal',min:0,max:2,step:1,value:0,hint:'Left: silver #ece4d4. Middle: copper #d98a58. Right: gunmetal #9aa6b4.'} {key:'presence',label:'how present',min:0,max:1,value:1,hint:'Left: only the hardest notes strike, on a faint sheet. Right: every note strikes.'} Presence steers only the rank cut and the final brightness.

**Traps.** 1. Caviar or bubble wrap: every dent a shiny ball. Rule: the highlight is a Gaussian on dd, never on distance in normal space; hammer aspect stays 0.72; stamp with min(), never add a dent profile. 2. Grey wash: any lobe at N=0 kills the black. Rule: keep 0.045 and 0.09; bump multiplies everything except 0.006. 3. Porridge late in loud songs. Rule: never blur h. On rite's actual final frame require luminance>.5 on at most 45% of pixels and <.04 on at least 25%; if it fails, change only 0.2 in soft to 0.4. Crumpled foil or armour is fine. Ring: if a lattice or concentric rings can be pointed at in any frame (check high loud runs in chopin-winter-wind), set the ring default to 0.6 and leave the highlight alone.

**Done when.** chopin-nocturne-48-1: first frame black; by 0:10 (frame 600, about 20 chords) you can point at a dent and name its note, and a soft note is a thin glint. At the end, facets fill the lower two thirds and the top is mostly black. Light test: on that final state, compare pixels with luminance>.25 at a and a+PI/2; if they differ by more than 25%, use a=2.2+0.25*sin(0.05*x.t). rite-sacrificial-dance loudest passage: the sheet flashes on each hit and repeated marks go shallower. b5: seek back and forward, including into a pause, and the sheet is identical to live; at the first long pause a red patch moves, and the next bands on its path are visibly straw (about ox .13 after one pass). lil-wayne-bells-visualizer: quiet notes look quiet.

**Cost.** WebGL2. Under 1 ms CPU on attacks (24,328 cells at most per stamp), one fullscreen shader, one drawImage. Seek replay about 50 ms on rach-concerto-2, on the first frame after the seek. The stamp and lobe constants produced good frames on real notes in a CPU prototype; ring, torch, tint, flash and the fade compensation were only worked by hand.

---

## 11. `fauxpas`: Faux Pas

Seven identical tall rectangles, the notes of the current key, dip in exact unison on every attack. An out-of-key note's rectangle rushes in from the side, lands on the sound, dips late, turns red and edges away. A key change swaps who belongs.

**Why it is new.** Harmony decides position: in or out of key is belonging, and the known future lets a wrong note arrive exactly on time.

**The picture.** Ground #08070A; floor 1 px #2A2620 at y=560. Line: seven 62x230 rectangles, bottoms on floor, centres x=340+100k, #8E8573, each with a flat 44 px reflection below at alpha 0.10. Side slots: 45x166, #3A342C, x=1100,1162,1224,56,118. Outsiders: 68x253, bottom y=640, in front. Square corners, flat colour, no faces or details. About 15% filled, rest black.

**State.** keyAt[], barges[] {T,pc,m,v,end}, bPtr, curKey, sorted velocities and pitches. Per pitch class (pc): role line|side|outsider, x, y, sc, walk, dip, dipV, pending[], lit, blush, hunch, lean, lift, flash, exitAt, inStop.

**Algorithm.** BUILD (in reset; again if win changes)
1. Per 1 s bin: hist[bin][m%12] += (v/127)*clamp(end-start,0.1,1). Score root r over +-win bins: sum h[(r+d)%12], d in {0,2,4,5,7,9,11}. Switch only if best > 1.08*current score.
2. Barge: a chord note foreign to keyAt[floor(t)] whose pc's previous foreign note is over 2.2 s earlier.
3. Slots: pc=(r+5+7k)%12; k0-6 line, k7-9 right, k10-11 left. Reset: everyone in slot, bPtr = first T>t.

ONCHORD
4. Key changed: apply now; everyone walks linearly to slot in 0.9 s; leavers blush=1. d=(new-old)*7 mod 12; if min(d,12-d)>=2, for 2 s each line dip is delayed 0.2*frac(sin(pc*12.9898+chordIndex*78.233)*43758.5453).
5. v = velocity rank. depth = (18+62v)*bow/(1+0.12*x.rate), x1.3 if rank(ch.lo)<=0.25. All line members: dip=max(dip,depth) now, dipV=0. Loud (v=0.95, slow): 77 px. Quiet (v=0.1): 24 px.
6. In-key notes: lit=1. Foreign note of a current outsider, ch.t>T+0.01: flash=1, exitAt=max(exitAt,end+0.25), dip of depth x1.4 at +0.14 s. Exiting outsiders: inStop=0.12.

FRAME
7. t>=T-0.45, rank(v)>=(1-presence)*0.8, pc on side: becomes outsider. u=(t-T+0.45)/0.45: lerp to x=640+(rank(m)-0.5)*620 (add 80 until 80 px from others), y=640, sc 0.72 to 1.1, colour to #E7DDC8, y -= |sin(5*pi*u)|*8. Past T: bPtr++.
8. At T, exactly on mark: flash=1; lift 18 px off floor, back to 0 in 0.15 s; dip x1.4 at T+0.14; line within 170 px leans 0.10 rad away. Blush 0 to 1 linearly over 0.35 s from T+0.08. Hunch to 1 in 0.4 s: height x(1-0.22*hunch*shame), width x(1+0.05*hunch), lean 0.12 rad from centre. exitAt=max(T+0.6,end+0.25).
9. After exitAt: 190 px/s to side slot, y to 560, sc to 0.72; holds during inStop, and 0.25 s at 40% and 70%. Over 5 s on stage: ignore inStop, speed x2. Blush fades over 3 s. Pc now in key: blush, hunch to 0 in 0.4 s, walk to line slot.
10. dipV += (-256*dip-17.6*dipV)*dt; dip += dipV*dt; line dip>=0. Top edge drops by dip, capped 0.6*height. Time constants: lit 0.25 s, flash 0.15 s, lean 0.3 s. Sounding in-key notes hold lit>=0.5.
11. Fill ground alpha 0.85 (kills fade ghosts). Draw floor, sides, line, outsiders by y, rotated about bottom centre. Colour: lerp(#8E8573,#FFF6E2,lit); outsider lerp(#E7DDC8,#E23D4F,blush); flash lerps to white. Line alpha 0.35+0.65*presence.

**Music.** Loudness: dip depth; outsider entry at low presence. Pitch class: which rectangle; octave: outsider x. Chord size: more lit. Tempo: shallower dips. Bass: 30% deeper. Silence: outsiders escape. Moment: nothing. Attack frame: line already down, outsider on mark.

**Knobs.** {key:'win', label:'how settled the key is', min:3, max:20, value:8, hint:'Left: key keeps moving. Right: long keys, more wrong notes.'}
{key:'bow', label:'how deep they dip', min:0.3, max:2, value:1, hint:'Left: a nod. Right: deep and stiff.'}
{key:'shame', label:'how embarrassed', min:0.3, max:2, value:1, hint:'Left: hardly shrinks. Right: folds and creeps.'}
{key:'presence', label:'how present', min:0, max:1, value:1, hint:'Left: dim line, loudest wrong notes only. Right: everything.'} Steers entry rank and line alpha.

**Traps.** Spectrum look: sounding notes change colour only; all line heights equal. Suggestive red: no pulsing, never above full height, whole-shape colour. Rite overload: five outsiders maximum by construction; keep it.

**Done when.** vivaldi-spring 'Allegro': long unison, lone outsider. chopin-winter-wind 'Far keys': broken unison. rite-sacrificial-dance 'Spasms': mob, line still dipping. On a barge's attack frame: within 1 px of mark. Same keyAt after seek.

**Cost.** Canvas2D, under 1 ms; build a few ms.

---

## 12. `johansson`: Johansson

A field of still white dots, like stars. When the music moves, thirteen of them turn out to be a person, walking, stepping exactly on the notes: slumped and small in a sad passage, running in a storm, raising an arm as the melody climbs. When the music stops they stop, and you can no longer tell which dots they were.

**Why it is new.** The 1973 point-light discovery: a body exists only while moving, so a screenshot shows stars. Footfalls are planned from the known future.

**The picture.** Black, 99%. Only dots, #F2ECDD, radius 2.4 to 4.6 px, seeded per dot. 13 figure dots (head, 2 shoulders, elbows, wrists, hips, knees, ankles), figure 180 to 640 px tall, among 95 stars of the same sizes. No lines, floor, trails or halos. Walking: figure alpha 1, its far side (z*facing<0) 0.78, stars 0.55. Standing: everything 0.55 by 0.8 s.

**State.** steps[] {tStart, tStrike, amp, run, phrase, phiEnd}; phrases[] {cx, h, floorY, facing}; joints[13] {flash, dx, dy, vx, vy, r}; stars[170] {ax, ay, joint, r, flash, dx, dy, vx, vy}; prev[] last drawn x, y, radius of every dot; shift; walkClock; st; run, sad, proud; liftR, liftL with velocities; sprites (lazy, in frame). Reset clears all; shift=0. Use x.rnd.

**Algorithm.** 1. GATE, before anything else. 13 dots only: a=1, 2 steps/s, no stars, jolts or lift, alpha 1, black. Record 3 s. It must read as a person. If not, replace the tables with Marey's gait, angles in radians, p=2*pi*c: h=(0.26+0.2*run)*a*cos(p)+0.05; k=0.1+0.14*B(p,0.75,0.55)+(0.9+0.45*run)*B(p,4.1,0.85); B(p,m,w)=exp(-(wrap(p-m)/w)^2), wrap to +-pi. Build nothing else until this passes.
2. loud = rank of ch.vel among all CHORDS, 0..1.
3. Steps, in reset: last=first chord time (strike 0). Candidates: chords in [last+0.30,last+0.42]. Take the loudest, else the first chord after last+0.42. gap<=maxStep: step fills the gap. Otherwise tStart=t-0.85 and it stands until then. amp=clamp(0.45+0.85*loud,0.45,1.3)*stride. Stand>=1.6 s starts a phrase: cx=W*(0.3 then 0.7 alternating)+-0.05W, facing towards the far side, h=min(640,(300+300*meanLoud^2)*height), floorY=H/2+h/2+10.
4. Phase: when step k begins, bisect 12 times on [-0.15,0.15] for c0, where both ankle heights are equal at that step's a and run. phiEnd=k*0.5+c0; phi is linear from the previous phiEnd over the step. cR=phi, cL=phi+0.5.
5. Periodic Catmull-Rom, degrees. HIP (0,28)(.1,25)(.3,5)(.5,-12)(.62,-4)(.75,22)(.87,30)(1,28). KNEE (0,5)(.15,18)(.4,3)(.5,8)(.6,38)(.72,62)(.85,30)(.95,5)(1,5).
6. Style: amp interpolates across the step. run target=clamp((0.5-stepDur)/0.18,0,1), tau 0.25 s. sad target=clamp(1.15-1.3*feat.level-0.5*feat.pitch,0,1); proud=clamp(1.3*feat.level+0.5*feat.pitch-0.8,0,1); tau 3 s. While standing, hold sad, proud, walkClock and lift target. a=amp*(1-0.35*sad). h=9+(HIP-9)*a+8*run. k=5+(KNEE-5)*(0.65+0.35*a)+run*0.8*max(0,KNEE-20). lean=2+20*sad-3*proud+8*run. armAmp=(18*a+6)*(1-0.6*sad)*(1+0.5*proud). e=(22-10*cos(2pi c))*(1-run)+85*run.
7. Kinematics, height units, y up, side=+1 right, -1 left. yaw=5*a*cos(2pi cR). Hip: x=side*0.095*sin yaw, z=side*0.095*cos yaw. knee=hip+0.245*(sin h,-cos h). ankle=knee+0.246*(sin(h-k),-cos(h-k)). Pelvis Y puts the lower ankle at 0.039. Shoulder centre=pelvis+0.288*(sin lean,cos lean), lowered 0.02*sad; shoulders x=-side*0.129*sin(1.4yaw), z=side*0.129*cos(1.4yaw). s=-armAmp*cos(2pi c)+lift; elbow=shoulder+0.186*(sin s,-cos s); wrist=elbow+0.146*(sin(s+e),-cos(s+e)). Head=centre+0.12*(sin(1.6lean),cos(1.6lean)).
8. psi=32+14*sin(0.11*walkClock). screenX=cx+h*facing*(x*cos psi+z*sin psi); screenY=floorY-h*y. No perspective.
9. Stars: each frame, shift += the lower ankle's screenX now minus the same ankle's last frame; skip on a re-anchor frame. x=((ax+shift) mod (W+160)+W+160) mod (W+160)-80, y=ay, plus 0.35*450*height*(joint - its rest position, facing ignored; rest=mean over 20 c at a=1,run=0), plus spring.
10. Fade: last 0.3 s of a phrase-ending stand, figure to 0; re-anchor; in over 0.3 s from tStart.
11. Draw: fillRect rgba(0,0,0,0.85*presence). Fill black discs at every prev position, radius+2, in one path; this removes ghosts at any presence. Then all dots by sprite. Flash: radius*(1+0.9*flash*loud), white sprite at alpha flash.
12. onChord, each note: pair=floor(pitch01*6.999) in [ankles,knees,hips,elbows,shoulders,wrists,head]; side from m odd/even. flash=1, decay tau 0.22 s; its stars flash 0.35. Only the 4 highest-velocity notes jolt, the rest flash; never jolt the lower ankle. D=(6+24*loud)*(h/540)/(1+0.35*x.rate), x.rate being raw attacks per second, not feat.rate. Velocity 49*D px/s away from pelvis; spring omega 28, zeta 0.45. Loud chord at rate 2: 17 px. Quiet: 5 px. Winter Wind: 6 px. Strike, never reduced: landing ankle flash 1, radius x2; up to 16 nearest stars within 140 px get peak push 18*loud*(1-d/140), same spring.
13. Lift: top=x.top(). liftR target=min(140,arms*150*pitch01^1.6*(0.4+0.6*loud)*(1-0.8*run)) while sounding, else 0; omega 7, zeta 0.55. liftL target=0.8*liftR only if the chord has 4+ notes and loud>0.7.

**Music.** Attack: foot lands on it, joints light that frame. Pitch: bass feet, treble hands and head. Top note: right arm rises. Loudness: stride, and nearness per phrase. Chord size: more joints light. Tempo: cadence; above 3 steps/s, a run. Bass: feet and knees light. Quiet and low: slumped. Loud and high: upright, wide swing. Silence: it freezes and vanishes; after 1.6 s it returns elsewhere 0.85 s before the next note. Moment: unused.

**Knobs.** presence 'how present' 0..1, 0.5: stars=round(20+150*presence), none at <=0.1, never above 170. Left: just the person on black. Right: a thick field of stars it is hidden in.
stride 'how big its steps' 0.5..1.4, 1. Left: small careful steps. Right: long strides, a big bounce.
height 'how near' 0.6..1.3, 1. Left: a small person far off. Right: it nearly fills the screen.
arms 'how the melody lifts it' 0..1.2, 0.8. Left: arms only swing. Right: its arm reaches up with every climbing melody.
maxStep 'how soon it stops' 0.7..1.6, 1.15. Left: it stops at any gap in the notes. Right: it walks on through most of them.

**Traps.** Stick figure: never a line between dots; figure dots stay in the star size range at rest; keep the black discs. Robot or aerobics: only these tables, no sine knee; psi stays 18 to 46; both arms up only by the loud-chord rule. Suggestive: no crotch dot, no extra pelvis thrust. Shivering cloud: rule 12 caps. Findable when still: nothing may move while standing, including psi and lift.

**Done when.** Gate passed first. Paused after 1 s still: nobody can point at it. Paused mid-stride: no drawn pose; if one shows, figure alpha 0.85. Playing: a person within 1 s. Nocturne opening: slow, slumped, on left-hand notes. Winter Wind: run, footfall every 0.30 to 0.42 s, body intact. Rach 2 opening: stands dark, moves 0.85 s, plants on each chord. Knights: stomp, stars jump from the foot. Liebesleid: arm climbs, sinks slowly. Unit tests: on each tStrike frame the landing ankle is the lower one within 1 px. It walks in place, so foot speed is measured against the stars: for that frame and the next 3, |dAnkleX-dShift|<1 px and |dAnkleY|<1 px. All 13 dots stay on screen at height 1.3.

**Cost.** Canvas2D. 13 joints plus at most 183 sprites and discs: about 0.8 ms.

