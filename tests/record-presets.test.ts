import { describe, expect, it } from 'vitest';
import { DEFAULT_RECORDER_OPTIONS, pickMimeType } from '../src/visual/recorder';
import { mbPerMinute, RECORD_PRESETS, recordingName } from '../src/studio/ui/record';

describe('record presets (plan §10)', () => {
  it('share is about 15.2 MB a minute, high about 61.4', () => {
    expect(RECORD_PRESETS.share).toEqual({ videoBitsPerSecond: 1_900_000, audioBitsPerSecond: 128_000, fps: 30 });
    expect(RECORD_PRESETS.high).toEqual({ videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000, fps: 30 });
    expect(mbPerMinute(RECORD_PRESETS.share)).toBe(15.2);
    expect(mbPerMinute(RECORD_PRESETS.high)).toBe(61.4);
    expect(mbPerMinute({ videoBitsPerSecond: 1_000_000, fps: 30 })).toBe(7.5);   // no audio rate: video only
  });

  it('picks MP4 with H.264 + AAC first, then WebM, else nothing', () => {
    expect(pickMimeType(() => true)).toBe('video/mp4;codecs=avc1.640033,mp4a.40.2');
    expect(pickMimeType((t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9,opus');
    expect(pickMimeType(() => false)).toBeUndefined();
  });

  it('names a recording after the show and the local time, with the container\'s extension', () => {
    const at = new Date(2026, 9, 31, 2, 3, 4);
    expect(recordingName('prelude', 'video/mp4', at)).toBe('prelude-2026-10-31-02-03-04.mp4');
    expect(recordingName('prelude', 'video/mp4;codecs=avc1.640033,mp4a.40.2', at)).toBe('prelude-2026-10-31-02-03-04.mp4');
    expect(recordingName('beethoven5', 'video/webm;codecs=vp9,opus', at)).toBe('beethoven5-2026-10-31-02-03-04.webm');
  });

  it('leaves the old app\'s recorder as it was', () => {
    expect(DEFAULT_RECORDER_OPTIONS.videoBitsPerSecond).toBe(12_000_000);
    expect(DEFAULT_RECORDER_OPTIONS.fps).toBe(60);
    expect(DEFAULT_RECORDER_OPTIONS.audioBitsPerSecond).toBeUndefined();
  });
});
