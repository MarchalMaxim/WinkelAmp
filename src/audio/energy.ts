// The energy lane: the recording's loudness measured as EBU R128 / ITU-R BS.1770 meters do, on windows CENTRED on each
// moment. We have the whole recording offline, so nothing has to run late: pack.loudness (an average looking backwards)
// rises about 1.1 s and falls about 2.4 s after the sound; this lane does neither.
//
// The chain: the mono mix through BS.1770's K-weighting (a high shelf of +4 dB above about 1.7 kHz, then a high-pass at
// about 38 Hz), its mean square per 10 ms block, then the mean over a centred window (0.4 s: 'momentary', 3 s:
// 'shortTerm'), in dB as BS.1770 writes it (-0.691 + 10·log10). One value every 0.1 s.
//
// Indexing (the same as pack.loudness, which readers read as "sample i stands for the moment (i + 0.5)·hop"): sample i
// is the window centred on (i + 0.5)·0.1 s, so momentary covers [i·0.1 − 0.15, i·0.1 + 0.25) and shortTerm
// [i·0.1 − 1.45, i·0.1 + 1.55). At the start and the end of the recording a window keeps only the part inside the
// audio (the mean of what is there). Values are rounded to 0.1 dB; silence (and anything quieter) is SILENCE_DB.
//
// The decoded audio is a mono mix, so these are not the LUFS of the stereo file (BS.1770 sums the channels' powers);
// they rank the moments of one recording, which is what the lane is for. The stored dB carry no correction for how
// loud the master is; the readers add the descriptor's (half the way to −20, at most 6 dB) when they turn the lane
// into 0..1 (src/widgets/curves.ts energyCurve).
//
// Pure arithmetic, no Node or browser imports: ingest, the studio's in-browser fallback and the backfill share it.

/** The lane's resolution (seconds): the same as pack.loudness. */
export const ENERGY_HOP = 0.1;
/** Silence floor, and the value of a window with no sound in it (dB). */
export const SILENCE_DB = -90;
/** Window lengths (seconds), as BS.1770 / EBU Tech 3341 define them. */
export const MOMENTARY_WINDOW = 0.4;
export const SHORT_TERM_WINDOW = 3;
/** The block the mean square is taken over (seconds). The windows' edges fall on block edges. */
const BLOCK = 0.01;

/** What a pack stores: dB, one value per 0.1 s, as long as pack.loudness. */
export interface EnergyLane { hop: 0.1; momentary: number[]; shortTerm: number[] }

/** One biquad: y = b0·x + b1·x1 + b2·x2 − a1·y1 − a2·y2 (a0 = 1). */
export interface Biquad { b: [number, number, number]; a: [number, number, number] }

/**
 * BS.1770's two K-weighting filters for any sample rate, by the formulas of libebur128 / pyloudnorm (the analogue
 * prototypes bilinear-transformed, pre-warped at f0). At 48 kHz they give the table of BS.1770 Annex 1.
 */
export function kWeightingFilters(sampleRate: number): { shelf: Biquad; highPass: Biquad } {
  // Stage 1, the head's acoustic effect: a high shelf.
  const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  const K = Math.tan((Math.PI * f0) / sampleRate), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  const a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b: [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0],
    a: [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
  };
  // Stage 2, the RLB curve: a high-pass.
  const f1 = 38.13547087602444, Q1 = 0.5003270373238773;
  const K1 = Math.tan((Math.PI * f1) / sampleRate), a1 = 1 + K1 / Q1 + K1 * K1;
  const highPass: Biquad = { b: [1, -2, 1], a: [1, (2 * (K1 * K1 - 1)) / a1, (1 - K1 / Q1 + K1 * K1) / a1] };
  return { shelf, highPass };
}

/** Runs `pcm` through both K-weighting filters (state kept in doubles), handing each output sample to `each`. */
function kWeightEach(pcm: Float32Array, sampleRate: number, each: (z: number, i: number) => void): void {
  const { shelf: s, highPass: h } = kWeightingFilters(sampleRate);
  const [sb0, sb1, sb2] = s.b, [, sa1, sa2] = s.a, [hb0, hb1, hb2] = h.b, [, ha1, ha2] = h.a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0;
  for (let i = 0; i < pcm.length; i++) {
    const x = pcm[i];
    const y = sb0 * x + sb1 * x1 + sb2 * x2 - sa1 * y1 - sa2 * y2;
    const z = hb0 * y + hb1 * y1 + hb2 * y2 - ha1 * z1 - ha2 * z2;
    x2 = x1; x1 = x; y2 = y1; y1 = y; z2 = z1; z1 = z;
    each(z, i);
  }
}

/** The mono mix through BS.1770's K-weighting. */
export function kWeight(pcm: Float32Array, sampleRate: number): Float32Array {
  const out = new Float32Array(pcm.length);
  kWeightEach(pcm, sampleRate, (z, i) => { out[i] = z; });
  return out;
}

/** dB of a mean square, BS.1770's way, rounded to 0.1 dB and floored at SILENCE_DB. */
export function powerDb(meanSquare: number): number {
  if (!(meanSquare > 0)) return SILENCE_DB;
  const db = -0.691 + 10 * Math.log10(meanSquare);
  return db > SILENCE_DB ? Math.round(db * 10) / 10 + 0 : SILENCE_DB; // + 0: no -0
}

/**
 * The energy lane of a recording (see the top of this file for what sample i is). `count` is the number of values,
 * by default loudnessLength of the PCM's duration; the backfill passes the pack's own, so the lane lines up with
 * pack.loudness even when a decoder gives a few samples more or less.
 */
export function energyLane(pcm: Float32Array, sampleRate: number, count?: number): EnergyLane {
  const n = pcm.length;
  const total = count ?? Math.max(0, Math.ceil(n / sampleRate / ENERGY_HOP - 1e-6));
  // Block k holds the samples [edge(k), edge(k + 1)); edge() is clamped to the audio, so a block past the end is empty
  // and the last one may be short. pre[k] = the K-weighted energy before edge(k).
  const edge = (k: number) => Math.min(n, Math.max(0, Math.round(k * BLOCK * sampleRate)));
  const blocks = Math.ceil(n / (BLOCK * sampleRate) - 1e-9);
  const sums = new Float64Array(blocks + 1);
  let k = 0, next = edge(1);
  kWeightEach(pcm, sampleRate, (z, i) => {
    while (i >= next) next = edge(++k + 1);
    sums[k] += z * z;
  });
  const pre = new Float64Array(blocks + 1);
  for (let b = 0; b < blocks; b++) pre[b + 1] = pre[b] + sums[b];

  const perHop = Math.round(ENERGY_HOP / BLOCK);
  const window = (centre: number, half: number): number => {
    const a = Math.min(blocks, Math.max(0, centre - half)), b = Math.min(blocks, Math.max(0, centre + half));
    const samples = edge(b) - edge(a);
    return samples > 0 ? powerDb((pre[b] - pre[a]) / samples) : SILENCE_DB;
  };
  const mHalf = Math.round(MOMENTARY_WINDOW / 2 / BLOCK), sHalf = Math.round(SHORT_TERM_WINDOW / 2 / BLOCK);
  const momentary: number[] = [], shortTerm: number[] = [];
  for (let i = 0; i < total; i++) {
    const centre = i * perHop + perHop / 2; // the block edge at (i + 0.5)·hop
    momentary.push(window(centre, mHalf));
    shortTerm.push(window(centre, sHalf));
  }
  return { hop: ENERGY_HOP as 0.1, momentary, shortTerm };
}
