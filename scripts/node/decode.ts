import { spawnSync } from 'node:child_process';

/** Mono float PCM of any file ffmpeg reads (the same call as scripts/analyze-file.ts). */
export function decodeMono(file: string, rate = 44100): Float32Array {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], {
    maxBuffer: 1 << 30,
  });
  if (r.error) throw new Error(`ffmpeg could not run (${r.error.message}): install ffmpeg and put it on PATH`);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr?.toString().trim() || `exit ${r.status}`}`);
  const buf = r.stdout as Buffer;
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}
