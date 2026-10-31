/**
 * Recording the show in the studio (plan §10): the canvas and the song into an MP4 (H.264 + AAC) the browser writes
 * while the song plays once, at a bit rate that keeps a minute to a few MB (WhatsApp). For a frame-exact HD video
 * there is `npm run render-show`.
 */
import type { RecorderOptions } from '../../visual/recorder';

/** share: small enough to send (≈ 8.5 MB a minute); high: for keeping. */
export const RECORD_PRESETS = {
  share: { videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 128_000, fps: 60 },
  high: { videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 192_000, fps: 60 },
} as const satisfies Record<string, RecorderOptions>;
export type RecordPreset = keyof typeof RECORD_PRESETS;

/** The MB a minute of recording aims at: (video + audio) · 60 / 8 / 1e6, one decimal. */
export function mbPerMinute(o: RecorderOptions): number {
  return Math.round(((o.videoBitsPerSecond + (o.audioBitsPerSecond ?? 0)) * 60) / 8 / 1e5) / 10;
}

const two = (n: number) => String(n).padStart(2, '0');

/** 'prelude-2026-10-31-02-03-04.mp4' (local time; .webm when the browser could only record WebM). */
export function recordingName(showId: string, mime: string, at: Date): string {
  const when = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}-${two(at.getHours())}-${two(at.getMinutes())}-${two(at.getSeconds())}`;
  return `${showId}-${when}.${/^video\/mp4/.test(mime) ? 'mp4' : 'webm'}`;
}
