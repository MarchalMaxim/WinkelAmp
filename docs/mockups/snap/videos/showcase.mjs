// Renders the showcase reels of tonight's snap experiments, 960 px per side (1920 x 540), 30 fps, with the song's sound,
// each behind a 3 s title card, then joins them into 00-showcase.mp4 behind a 4 s opening card, and cuts a poster.
//
//   node docs/mockups/snap/videos/showcase.mjs            everything (a finished part is reused; delete renders/snap/showcase/parts to redo)
//   node docs/mockups/snap/videos/showcase.mjs 03 05      only these reels (the showcase and poster are rebuilt if all reels exist)
//
// Needs the dev server (default http://localhost:5300; override with SNAP_BASE), Chrome and ffmpeg. Outputs land in
// renders/snap/showcase/ (not committed). Passages are rendered by scripts/snap-compare.mjs; ffmpeg then re-encodes each
// part to the same size, rate and audio so the concat demuxer can join them.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.SNAP_BASE || 'http://localhost:5300';
const OUT = path.resolve('renders', 'snap', 'showcase'), PARTS = path.join(OUT, 'parts');
mkdirSync(PARTS, { recursive: true });
const R = (id) => `render.html?show=${id}&hz=60&scale=1`;                       // a studio show
const L = (song, w) => `lab/index.html?render=1&song=${song}&only=${w}`;        // the lab, one widget, all notes
const RACH = 'rach-concerto-2', LIE = 'liebesleid';
const FONT = 'C\\:/Windows/Fonts/segoeuib.ttf';

// segment: [song, from, to, left, right, labels, shows needed, extra snap-compare args]
const REELS = [
  { n: '01', name: 'squares', title: 'Snap squares', line: "Each square cracks on at full strength and sinks back over a time you set (0.6 s here). Left: today's Dread squares. Right: Snap squares.",
    segs: [[RACH, 5, 30, L(RACH, 'squares'), L(RACH, 'squares-snap'), 'dread squares|snap squares', []],
           [RACH, 79, 84, R(RACH), R(`${RACH}-snap`), 'dread squares|snap squares', [RACH, `${RACH}-snap`]]] },
  { n: '02', name: 'ivory-strike', title: 'Ivory strike', line: 'The keys hit harder and let go faster. Left: strike 0 (today). Right: strike 1. Watch each key as the note lands.',
    segs: [[RACH, 110, 130, R(RACH), R(`${RACH}-snap`), 'ivory strike 0 (today)|ivory strike 1', [RACH, `${RACH}-snap`]]] },
  { n: '03', name: 'hammer', title: 'Hammer', line: 'A piano-true strike: bright at the blow, then a quiet ring. Left: Ivory. Right: Hammer. Sighs first, then the rolls: four strikes, not eighteen flashes.',
    segs: [[LIE, 10.7, 28.5, R(LIE), R(`${LIE}-new`), 'ivory|hammer', [LIE, `${LIE}-new`]],
           [LIE, 174.9, 186.2, R(LIE), R(`${LIE}-new`), 'ivory|hammer, roll 1', [LIE, `${LIE}-new`]]] },
  { n: '04', name: 'handover', title: 'Handover', line: 'One slab per note, struck bone-white, cooling to red, gone as the next lands. Left: Ivory alone. Right: Handover alone. Staccato first, then the sighs.',
    segs: [[LIE, 24, 30, L(LIE, 'ivory'), L(LIE, 'handover'), 'ivory|handover', []],
           [LIE, 10.7, 28.5, L(LIE, 'ivory'), L(LIE, 'handover'), 'ivory|handover', []]] },
  { n: '06', name: 'flee', title: 'Flee snap', line: 'Each high note lands as one hard hit instead of a bow. Left: Flee. Right: flee with the snap slider at 1.',
    segs: [[LIE, 28, 48, L(LIE, 'flee'), L(LIE, 'flee'), 'flee|flee, snap 1', [], ['--right-knobs', '{"snap":1}']]] },
  { n: '07', name: 'fireworks', title: 'Fireworks snap', line: 'No attack is dropped and each burst has a short bone-white heart. Left: Fireworks. Right: Fireworks snap.',
    segs: [[RACH, 132, 152, R(RACH), R(`${RACH}-snap`), 'fireworks|fireworks snap', [RACH, `${RACH}-snap`]]] },
  { n: '08', name: 'hit-drive', skip: 'snap-compare and renderKnobs set only knob bases; a drive (+level / +hit) cannot be set by URL or renderKnobs, and localStorage is cleared per render. Needs a small change to the lab or snap-compare.' },
];
const OPENING = 'Widgets that answer each picked note';

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
const ff = (args, cwd) => { const r = run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { cwd }); if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`); };
const wrap = (s, n) => { const out = []; let cur = ''; for (const w of s.split(' ')) { if ((cur + ' ' + w).trim().length > n) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } out.push(cur); return out.join('\n'); };

// A black card, white text, silent stereo audio.
function card(file, head, sub, secs) {
  const base = path.basename(file, '.mp4');
  const dt = (f, size, y) => `drawtext=fontfile='${FONT}':textfile=${f}:fontsize=${size}:fontcolor=white:x=(w-text_w)/2:y=${y}`;
  const filters = [];
  wrap(head, 40).split('\n').forEach((l, i) => { const t = `${base}.h${i}.txt`; writeFileSync(path.join(PARTS, t), l); filters.push(dt(t, 64, `(h/2)-150+${i * 76}`)); });
  wrap(sub, 80).split('\n').forEach((l, i) => { const t = `${base}.s${i}.txt`; writeFileSync(path.join(PARTS, t), l); filters.push(dt(t, 34, `(h/2)+20+${i * 50}`)); });
  ff(['-f', 'lavfi', '-i', `color=c=black:s=1920x540:r=30:d=${secs}`, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', String(secs),
    '-vf', filters.join(','),
    '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-shortest', file], PARTS);
}
const norm = (src, dst) => ff(['-i', src, '-vf', 'scale=1920:540,fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', dst]);
const concat = (files, dst) => {
  const list = path.join(OUT, `${path.basename(dst, '.mp4')}.list.txt`);
  writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', dst]);
};

const only = process.argv.slice(2);
const built = [], skipped = [], failed = [];
for (const reel of REELS) {
  if (reel.skip) { skipped.push(`${reel.n}-${reel.name}: ${reel.skip}`); continue; }
  const dst = path.join(OUT, `${reel.n}-${reel.name}.mp4`);
  if (only.length && !only.includes(reel.n)) { if (existsSync(dst)) built.push(dst); continue; }
  const missing = reel.segs.flatMap((s) => s[6]).filter((s) => !existsSync(path.join('shows', `${s}.json`)));
  if (missing.length) { skipped.push(`${reel.n}: missing shows ${missing.join(', ')}`); continue; }
  console.log(`\n== reel ${reel.n} ${reel.name}`);
  const parts = [path.join(PARTS, `${reel.n}-card.mp4`)];
  card(parts[0], reel.title, reel.line, 3);
  let bad = false;
  reel.segs.forEach(([song, from, to, left, right, labels, , extra = []], i) => {
    const raw = path.join(PARTS, `${reel.n}-seg${i + 1}.raw.mp4`), seg = path.join(PARTS, `${reel.n}-seg${i + 1}.mp4`);
    if (!existsSync(seg)) {
      const r = run(process.execPath, ['scripts/snap-compare.mjs', '--song', song, '--from', String(from), '--to', String(to), '--left', left, '--right', right,
        '--labels', labels, '--out', raw, '--fps', '30', '--width', '960', '--base', BASE, ...extra]);
      if (r.status !== 0) { failed.push(`${reel.n} seg ${i + 1}: exit ${r.status}`); bad = true; return; }
      norm(raw, seg);
    }
    parts.push(seg);
  });
  if (bad) continue;
  concat(parts, dst);
  built.push(dst);
}

// The showcase: the opening card, then the reels (each already starts with its own card). Then the poster.
const reelFiles = REELS.filter((r) => !r.skip).map((r) => path.join(OUT, `${r.n}-${r.name}.mp4`));
if (reelFiles.every(existsSync)) {
  const open = path.join(PARTS, '00-open.mp4');
  card(open, 'Snap night, 2026-11-05', OPENING, 4);
  concat([open, ...reelFiles], path.join(OUT, '00-showcase.mp4'));
  // Poster: per reel, the brightest frame of the right half in its first passage (the attack), tiled 2 columns with the reel name.
  const tiles = [];
  for (const r of REELS.filter((x) => !x.skip)) {
    const seg = path.join(PARTS, `${r.n}-seg1.mp4`);
    const p = run('ffmpeg', ['-hide_banner', '-i', seg, '-vf', 'crop=960:540:960:0,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-an', '-f', 'null', '-'], { quiet: true });
    let best = 0, bt = 1;
    for (const m of (p.stdout || '').matchAll(/pts_time:([\d.]+)[\s\S]*?YAVG=([\d.]+)/g)) { const t = Number(m[1]); if (t > 1 && Number(m[2]) > best) { best = Number(m[2]); bt = t; } }
    const png = path.join(PARTS, `${r.n}-tile.png`);
    ff(['-ss', String(bt), '-i', seg, '-frames:v', '1', '-vf', `crop=960:540:960:0,drawtext=fontfile='${FONT}':text='${r.n} ${r.name}':x=16:y=h-70:fontsize=40:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8`, png]);
    tiles.push(png);
  }
  const cols = 2;
  ff([...tiles.flatMap((t) => ['-i', t]), '-filter_complex', `${tiles.map((_, i) => `[${i}:v]`).join('')}xstack=inputs=${tiles.length}:layout=${tiles.map((_, i) => `${(i % cols) * 960}_${Math.floor(i / cols) * 540}`).join('|')}:fill=black[v]`, '-map', '[v]', '-frames:v', '1', path.join(OUT, '00-showcase-poster.png')]);
}
console.log(`\nbuilt: ${built.length}\n  ${built.join('\n  ')}`);
if (skipped.length) console.log(`skipped:\n  ${skipped.join('\n  ')}`);
if (failed.length) { console.log(`failed:\n  ${failed.join('\n  ')}`); process.exit(1); }
