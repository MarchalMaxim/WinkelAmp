// The ffmpeg arguments of the HD master and the share copy (plan §7): pure builders in scripts/lib/encode.mjs.
import { describe, expect, it } from 'vitest';
import { level, masterArgs, shareArgs, shareVideoKbps } from '../scripts/lib/encode.mjs';

const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe('level', () => {
  it('names the smallest of 4.1, 5.1 and 5.2 that holds the picture and its rate', () => {
    expect(level(1920, 1080, 30)).toBe('4.1');
    expect(level(1280, 720, 30)).toBe('4.1');
    expect(level(1280, 720, 60)).toBe('4.1');
    expect(level(1920, 1080, 60)).toBe('5.1');
    expect(level(2560, 1440, 60)).toBe('5.1');
    expect(level(3840, 2160, 30)).toBe('5.1');
    expect(level(3840, 2160, 60)).toBe('5.2');
  });
});

describe('shareVideoKbps', () => {
  it('is the budget in kbit/s less the audio', () => {
    expect(shareVideoKbps(15)).toBe(1872);
    expect(shareVideoKbps(15, 96)).toBe(1904);
    expect(shareVideoKbps(30)).toBe(3872);
  });
  it('refuses a budget the audio alone would eat', () => {
    expect(() => shareVideoKbps(0.5)).toThrow();
  });
});

describe('masterArgs', () => {
  const base = { w: 2560, h: 1440, fps: 60, crf: 13, preset: 'slow', master: 'x264', out: 'v.mp4' } as const;
  it('reads raw RGBA of the real size from stdin', () => {
    const a = masterArgs(base);
    expect(a.join(' ')).toContain('-f rawvideo -pix_fmt rgba -s 2560x1440 -r 60 -i -');
  });
  it('or reads PNGs one after another (render-show: the fastest lossless transport)', () => {
    const a = masterArgs({ ...base, input: 'png' });
    expect(a.join(' ')).toContain('-f image2pipe -c:v png -framerate 60 -i -');
    expect(a).not.toContain('rawvideo');
    expect(() => masterArgs({ ...base, input: 'jpeg' as 'png' })).toThrow(/rgba or png/);
  });
  it('encodes x264 high, crf 13, slow, BT.709 limited range with the three colour tags, faststart', () => {
    const a = masterArgs(base), s = a.join(' ');
    expect(after(a, '-c:v')).toBe('libx264');
    expect(s).toContain('-crf 13');
    expect(s).toContain('-preset slow');
    expect(after(a, '-profile:v')).toBe('high');
    expect(after(a, '-level')).toBe('5.1');
    expect(after(a, '-pix_fmt')).toBe('rgba');   // the input's; the output's comes last
    expect(a.lastIndexOf('yuv420p')).toBeGreaterThan(a.indexOf('-i'));
    expect(s).toContain('out_color_matrix=bt709');
    expect(s).toContain('out_range=tv');
    expect(s).toContain('-colorspace bt709');
    expect(s).toContain('-color_primaries bt709');
    expect(s).toContain('-color_trc bt709');
    expect(s).toContain('setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv');   // ffmpeg 8 needs both
    expect(s).toContain('+faststart');
    expect(a.at(-1)).toBe('v.mp4');
  });
  it('takes the level from the size: 5.2 at 3x', () => {
    expect(after(masterArgs({ ...base, w: 3840, h: 2160 }), '-level')).toBe('5.2');
  });
  it('limits the frame count when given', () => {
    expect(after(masterArgs({ ...base, frames: 900 }), '-frames:v')).toBe('900');
    expect(masterArgs(base)).not.toContain('-frames:v');
  });
  it('makes 4:4:4 and ProRes archive masters', () => {
    const f = masterArgs({ ...base, master: 'x264-444' });
    expect(after(f, '-profile:v')).toBe('high444');
    expect(f.join(' ')).toContain('format=yuv444p');
    const p = masterArgs({ ...base, master: 'prores', out: 'v.mov' });
    expect(after(p, '-c:v')).toBe('prores_ks');
    expect(p.join(' ')).toContain('yuva444p10le');
    expect(p).not.toContain('-crf');
  });
  it('refuses an unknown master', () => {
    expect(() => masterArgs({ ...base, master: 'vp9' as 'x264' })).toThrow(/x264, x264-444 or prores/);
  });
});

describe('shareArgs', () => {
  const base = { input: 'm.mp4', kbps: 1872, out: 's.mp4', passlog: 'tmp/share' };
  it('pass 1 analyses only: no audio, null output, the same video settings', () => {
    const a = shareArgs({ ...base, pass: 1 }), s = a.join(' ');
    expect(a).toContain('-an');
    expect(s).toContain('-f null');
    expect(s).toContain('-pass 1');
    expect(s).toContain('-passlogfile tmp/share');
    expect(s).toContain('-b:v 1872k');
    expect(s).not.toContain('s.mp4');
  });
  it('pass 2 writes the copy: 1080p lanczos at 30 fps, capped rate, high 4.1, BT.709, AAC 128k, faststart', () => {
    const a = shareArgs({ ...base, pass: 2 }), s = a.join(' ');
    expect(s).toContain('-pass 2');
    expect(s).toContain('-b:v 1872k');
    expect(s).toContain('-maxrate 2808k');
    expect(s).toContain('-bufsize 3744k');
    expect(s).toContain('scale=1920:1080:flags=lanczos');
    expect(s).toContain('fps=30');
    expect(s).toContain('-preset slow');
    expect(after(a, '-profile:v')).toBe('high');
    expect(after(a, '-level')).toBe('4.1');
    expect(s).toContain('-colorspace bt709');
    expect(after(a, '-vf')).toContain('setparams=color_primaries=bt709');
    expect(s).toContain('-c:a aac -b:a 128k');
    expect(s).toContain('+faststart');
    expect(a).not.toContain('-an');
    expect(a.at(-1)).toBe('s.mp4');
  });
  it('the two passes share every video setting', () => {
    const one = shareArgs({ ...base, pass: 1 }), two = shareArgs({ ...base, pass: 2 });
    const vf = (a: string[]) => after(a, '-vf');
    expect(vf(one)).toBe(vf(two));
    expect(after(one, '-b:v')).toBe(after(two, '-b:v'));
  });
});
