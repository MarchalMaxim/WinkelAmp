// ffmpeg arguments for render-show's HD master and its share copy (plan §7). Pure: no I/O, tested in
// tests/encode-args.test.ts.
//
// The master takes the page's frames on stdin, lossless all the way to x264 (PNG, the fastest lossless transport measured
// in T9, or raw RGBA), and converts them to limited-range BT.709 YUV, tagged as such, so players do not guess BT.601 and
// shift the hues. The share copy is made from the master: 1080p at 30 fps in two x264 passes, sized to a budget in MB per minute (WhatsApp: send it as a document).

const COLOUR_TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
// ffmpeg 8 takes the colour tags from the filtered frames, which leave primaries and transfer unknown: set them there too.
const TAG_FRAMES = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';

// H.264 levels by macroblocks per frame and per second (ITU-T H.264 table A-1).
const LEVELS = [
  { name: '4.1', frame: 8192, rate: 245760 },
  { name: '5.1', frame: 36864, rate: 983040 },
];

/** The H.264 level for a w×h picture at fps: '4.1' (up to 1080p30), '5.1' (up to 1440p60, 2160p30), '5.2' above. */
export function level(w, h, fps) {
  const mbs = Math.ceil(w / 16) * Math.ceil(h / 16);
  return LEVELS.find((l) => mbs <= l.frame && mbs * fps <= l.rate)?.name ?? '5.2';
}

/** The master: w×h frames at fps on stdin → out. input: 'rgba' (raw RGBA, -f rawvideo) or 'png' (one PNG after another,
    -f image2pipe). master: 'x264' (yuv420p, high), 'x264-444' (yuv444p, high444) or 'prores' (ProRes 4444, yuva444p10le,
    for a .mov). frames, when given, stops after that many. */
export function masterArgs({ w, h, fps, crf, preset, master = 'x264', out, frames, input: from = 'rgba' }) {
  let input;
  if (from === 'rgba') input = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-'];
  else if (from === 'png') input = ['-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-'];
  else throw new Error(`input ${from}: rgba or png`);
  const limit = frames === undefined ? [] : ['-frames:v', String(frames)];
  const vf = (fmt) => ['-vf', `scale=out_color_matrix=bt709:out_range=tv,format=${fmt},${TAG_FRAMES}`];
  let video;
  if (master === 'x264' || master === 'x264-444') {
    const fmt = master === 'x264' ? 'yuv420p' : 'yuv444p';
    video = [...vf(fmt), '-c:v', 'libx264', '-preset', String(preset), '-crf', String(crf),
      '-profile:v', master === 'x264' ? 'high' : 'high444', '-level', level(w, h, fps), '-pix_fmt', fmt];
  } else if (master === 'prores') {
    video = [...vf('yuva444p10le'), '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le'];
  } else {
    throw new Error(`master ${master}: x264, x264-444 or prores`);
  }
  return [...input, ...limit, ...video, ...COLOUR_TAGS, '-r', String(fps), '-movflags', '+faststart', out];
}

/** The share copy's video bitrate in kbit/s: a budget of mbPerMin megabytes a minute, less the audio. */
export function shareVideoKbps(mbPerMin, audioKbps = 128) {
  const kbps = Math.round((mbPerMin * 8000) / 60 - audioKbps);
  if (!(kbps > 0)) throw new Error(`a share budget of ${mbPerMin} MB a minute leaves nothing for the picture after ${audioKbps} kbit/s of sound`);
  return kbps;
}

/** One of the share copy's two x264 passes over the master: lanczos to 1920×1080, 30 fps, kbps average (peaks 1.5×,
    buffer 2×), high 4.1, BT.709. Pass 1 only analyses (no sound, null output); pass 2 writes out with AAC 128k. */
export function shareArgs({ input, pass, kbps, out, passlog }) {
  const video = ['-vf', 'scale=1920:1080:flags=lanczos:in_color_matrix=bt709:out_color_matrix=bt709,fps=30,format=yuv420p,' + TAG_FRAMES,
    '-c:v', 'libx264', '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.5)}k`, '-bufsize', `${kbps * 2}k`,
    '-preset', 'slow', '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p', ...COLOUR_TAGS,
    '-pass', String(pass), '-passlogfile', passlog];
  const head = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input];
  if (pass === 1) return [...head, ...video, '-an', '-f', 'null', '-'];
  if (pass === 2) return [...head, ...video, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out];
  throw new Error(`pass ${pass}: 1 or 2`);
}
