/** WAV output for the reference renderer (Node only; kept apart so piano.ts stays importable from tests). */
import { writeFileSync } from 'node:fs';

/** Normalize to a peak (dBFS) and write a 16-bit stereo WAV. Returns peak/RMS before normalizing. */
export function writeWav(path: string, L: Float32Array, R: Float32Array, sr: number, peakDb = -1) {
  let peak = 0, sum = 0;
  for (let i = 0; i < L.length; i++) {
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    sum += L[i] * L[i] + R[i] * R[i];
  }
  const gain = 10 ** (peakDb / 20) / peak;
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4);
  }
  writeFileSync(path, buf);
  const rmsDb = 10 * Math.log10(sum / (2 * n)) + 20 * Math.log10(gain);
  return { seconds: n / sr, gainDb: 20 * Math.log10(gain), rmsDb };
}
