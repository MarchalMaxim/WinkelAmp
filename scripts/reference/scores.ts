/**
 * Dark & blunt reference scores, transcribed from memory (public-domain
 * compositions). They are evaluation material for the character engine, not
 * editions: the opening gestures, registers, dynamics, tempi and harmony are
 * right in spirit; inner voicings are reconstructions (see each score's notes).
 */
import { Score } from './piano';

const FFF = 1, FF = 0.86, F = 0.7, MF = 0.55, MP = 0.42, P = 0.3, PP = 0.21;

/**
 * Rachmaninoff — Prelude in C-sharp minor, Op. 3 No. 2 (1892).
 * Bars 1–2: the three fff octaves A–G♯–C♯ ringing into the depths (faithful).
 * Bars 3–8: the pp three-stave chorale over a tolling C♯ bass (texture, register,
 *   dynamics and the motif in the chords' top voice are right; exact inner voicing
 *   is reconstructed).
 * Bars 9–10: the swell through the Neapolitan (D) to G♯7.
 * Agitato (4 bars): the triplet-eighth chromatic churning (reconstructed figure).
 * Tempo primo: the massive fff four-stave return of the motif in chords, ending on
 *   a ringing C♯ minor.
 */
export function rachPrelude() {
  const s = new Score(44);
  // Bars 1–2 — Lento. The octaves are doubled in both hands.
  s.ped(12);
  s.rit(4, 0.2);
  s.play('A1 A2 A3', FFF, 1, 0, 0.004).wait(1);
  s.play('G#1 G#2 G#3', FFF, 1, 0, 0.004).wait(1);
  s.play('C#1 C#2 C#3', FFF, 6, 0, 0.006).wait(2);
  s.wait(4);

  // Bars 3–8 — pp. Beat 1: tolling C♯ octave; beats 2–4: chords (LH | RH).
  s.tempo(52);
  const bar = (bass: string, chords: string[], vel: number, bassVel = vel + 0.16) => {
    s.ped(4);
    s.play(bass, bassVel, 4, 0, 0.003);
    chords.forEach((c, i) => s.play(c, vel * (i === 0 ? 1.06 : 1), 1, 1 + i, 0.006));
    s.wait(4);
  };
  bar('C#1 C#2', ['E3 A3 C#4 E4 A4', 'E3 G#3 C#4 E4 G#4', 'E3 G#3 C#4 E4'], PP);
  bar('C#1 C#2', ['F#3 A3 D4 F#4 A4', 'F#3 A3 D4 F#4 A4', 'E3 G#3 C#4 E4 G#4'], PP);
  bar('B0 B1', ['E3 G#3 B3 E4 G#4', 'D#3 F#3 B3 D#4 F#4', 'E3 G#3 B3 E4'], PP + 0.02);
  bar('A0 A1', ['E3 A3 C#4 E4 A4', 'D#3 A3 C4 F#4 A4', 'E3 A3 C#4 E4'], P);
  bar('G#0 G#1', ['D#3 G#3 B#3 D#4 G#4', 'D#3 F#3 B#3 D#4 F#4', 'D#3 G#3 B#3 F#4'], P);
  s.rit(4, 0.3); // the phrase settles on the tonic
  bar('C#1 C#2', ['E3 G#3 C#4 E4 G#4', 'E3 G#3 C#4 E4 G#4', 'C#3 E3 G#3 C#4 E4'], PP);
  // Bars 9–10 — crescendo through the Neapolitan to the dominant.
  s.tempo(50);
  bar('A0 A1', ['D3 F#3 A3 D4 F#4 A4', 'D3 F#3 A3 D4 F#4 A4 D5', 'D3 A3 D4 F#4 A4 D5'], MF, F);
  bar('G#0 G#1', ['D#3 G#3 B#3 D#4 F#4 B#4', 'D#3 G#3 B#3 D#4 F#4 G#4 B#4', 'F#3 G#3 B#3 D#4 F#4 B#4 D#5'], F, FF);

  // Agitato — triplet eighths churning chromatically under a held dyad, LH pulsing.
  s.tempo(112);
  const agit = (lh: [string, string], dyad: string, line: string[], vel: number) => {
    s.ped(2);
    s.ped(2, 2);
    for (let b = 0; b < 4; b++) {
      s.play(lh[b % 2], vel * 0.95, 1, b, 0.004);
      for (let k = 0; k < 3; k++) {
        const v = vel * (k === 0 ? 1 : 0.82);
        s.play(`${line[b]} ${dyad}`, v, 1 / 3, b + k / 3, 0.002);
      }
    }
    s.wait(4);
  };
  agit(['C#2 C#3', 'G#2 E3'], 'C#5 E5', ['G#4', 'G4', 'F#4', 'E#4'], MF);
  agit(['C#2 C#3', 'G#2 E3'], 'A4 C#5', ['E4', 'D#4', 'D4', 'C#4'], MF + 0.06);
  agit(['F#2 F#3', 'C#3 A3'], 'F#5 A5', ['C#5', 'C5', 'B4', 'A#4'], F);
  s.rit(4, 0.45); // holding back before the return
  agit(['G#1 G#2', 'D#3 B#3'], 'D#5 F#5', ['B#4', 'B4', 'A#4', 'A4'], FF);

  // Tempo primo — fff, four staves: bass octave, LH chord, RH chord in octaves.
  s.tempo(42);
  s.ped(4);
  s.play('C#1 C#2', FFF, 4, 0, 0.003);
  s.play('E3 A3 C#4 E4 A4 C#5 A5', FFF, 1, 0, 0.004);
  s.play('E3 G#3 C#4 E4 G#4 C#5 G#5', FF, 1, 1, 0.004);
  s.play('E3 G#3 C#4 E4 G#4 C#5', FF, 2, 2, 0.004);
  s.wait(4);
  s.ped(2);
  s.play('A0 A1', FFF, 2, 0, 0.003);
  s.play('F#3 A3 D4 F#4 A4 D5 F#5', FFF, 1, 0, 0.004);
  s.play('F#3 A3 D4 F#4 A4 D5', FF, 1, 1, 0.004);
  s.ped(2, 2);
  s.play('G#0 G#1', FFF, 2, 2, 0.003);
  s.play('D#3 G#3 B#3 F#4 G#4 B#4 D#5 G#5', FFF, 2, 2, 0.004);
  s.rit(4, 0.4);
  s.wait(4);
  s.ped(8);
  s.play('C#1 C#2', FFF, 8, 0, 0.003);
  s.play('E3 G#3 C#4 E4 G#4 C#5 E5 G#5', FFF, 8, 0, 0.005);
  s.wait(4);
  return s;
}

/**
 * Rachmaninoff — Piano Concerto No. 2 in C minor, Op. 18 (1901), the solo opening:
 * eight chords that swell from pp to ff, each answered by a low F tolling like a
 * bell (chords: Fm, D♭/F, Fm, then chromatic pressure over the F pedal to the
 * dominant G7/F), then the surging C minor accompaniment that the orchestra's
 * theme rides on (reconstructed figuration, 4 bars).
 */
export function rachConcerto2() {
  const s = new Score(66);
  const chords = [
    'F3 Ab3 C4 F4',
    'F3 Ab3 Db4 F4',
    'F3 Ab3 C4 F4',
    'F3 Ab3 D4 F4',
    'F3 Ab3 B3 D4 F4',
    'F3 Ab3 B3 D4 F4 Ab4',
    'F3 G3 B3 D4 F4 G4',
    'F3 G3 B3 D4 F4 G4 B4',
  ];
  const vel = [PP, P, MP, MP + 0.06, MF, F, FF, FFF];
  chords.forEach((c, i) => {
    s.ped(4);
    // The chord on beat 1, the bell (low F octave, sometimes with the F above) on beat 3.
    s.play(c, vel[i], 2, 0, 0.007);
    s.play(i < 4 ? 'F1 F2' : 'F1 F2 C3', Math.min(1, vel[i] + 0.12), 2, 2, 0.003);
    s.wait(4);
  });
  // Surging C minor: LH arpeggios in eighth-note triplets, RH heavy chords on the beats.
  s.tempo(80);
  const surge = (bass: string[], rh: string, v: number) => {
    s.ped(4);
    bass.forEach((n, i) => s.play(n, v * (i % 3 === 0 ? 1 : 0.8), 0.4, i / 3));
    for (let b = 0; b < 4; b++) s.play(rh, v * (b === 0 ? 1 : 0.85), 0.9, b, 0.005);
    s.wait(4);
  };
  const arp = (a: string) => {
    const n = a.split(' ');
    return [...n, ...n.slice(1, -1).reverse(), ...n, ...n.slice(1, -1).reverse()].slice(0, 12);
  };
  surge(arp('C2 G2 C3 Eb3 G3'), 'C4 Eb4 G4 C5', FF);
  surge(arp('C2 Ab2 C3 Eb3 Ab3'), 'C4 Eb4 Ab4 C5', FF);
  surge(arp('B1 F2 Ab2 D3 F3'), 'B3 D4 F4 Ab4', F);
  surge(arp('C2 G2 C3 Eb3 G3'), 'C4 Eb4 G4 C5', FFF);
  s.ped(6);
  s.play('C1 C2 G2 C3 Eb3 G3 C4 Eb4 G4 C5', FFF, 6, 0, 0.004);
  s.wait(6);
  return s;
}
