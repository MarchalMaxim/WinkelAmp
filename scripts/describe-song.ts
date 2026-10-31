/**
 * A song pack in words, for composing its show (docs/COMPOSING-SHOWS.md): markdown on stdout.
 *
 *   npm run describe-song -- <id>
 *
 * Title, length, where the notes came from and how much to trust them, the analysis sections with their character,
 * loudness and attacks per second every 10 s, and the show the auto-composer would make.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { characterLabel, sectionCharacters } from '../src/studio/compose/character';
import { composeShow } from '../src/studio/compose/compose';
import { validatePack, type SongPack } from '../src/studio/pack/pack';
import { groupChords } from '../src/widgets/chords';
import { loadCatalogue } from './node/catalogue';
import { isSlug, showsDir, songsDir } from './node/pack-io';

const id = process.argv[2];
if (!id || !isSlug(id)) { console.error('usage: npm run describe-song -- <song id>   (a folder in songs/)'); process.exit(2); }
const file = join(songsDir(), id, 'pack.json');
if (!existsSync(file)) { console.error(`no pack ${file}: ingest the recording first (npm run ingest -- <audio>)`); process.exit(1); }
const pack = JSON.parse(readFileSync(file, 'utf8')) as SongPack;
const problems = validatePack(pack);
if (problems.length) { console.error(`${file} is not a valid pack:\n  ${problems.join('\n  ')}`); process.exit(1); }

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const n2 = (v: number) => v.toFixed(2);
const chords = groupChords(pack.notes);
const out: string[] = [];
out.push(`# ${pack.title}`, '');
out.push(`- id \`${pack.id}\`, ${clock(pack.duration)} (${pack.duration.toFixed(2)} s)`);
const from = { gpu: 'the GPU piano transcriber', file: 'a notes file, kept exactly', approx: 'approximated from the analysis (no transcriber)', merged: 'the transcriber, with approximate notes where it heard little',
  hybrid: 'the piano transcriber, with YourMT3+ notes in its gaps', ymt3: 'YourMT3+ alone (velocities estimated)',
  'bp-hybrid': 'the piano transcriber, with basic-pitch notes in its gaps' }[pack.notesFrom];
out.push(`- ${pack.notes.length} notes, ${chords.length} attacks (${pack.quality.notesPerMinute.toFixed(0)} notes/min), from ${from}; onset coverage ${(pack.quality.onsetCoverage * 100).toFixed(0)} %`);
for (const w of pack.quality.warnings) out.push(`- warning: ${w}`);
const desc = join(showsDir(), `${id}.description.md`), show = join(showsDir(), `${id}.json`);
out.push(`- the user's description: ${existsSync(desc) ? `\`shows/${id}.description.md\`` : 'none yet'}; show: ${existsSync(show) ? `\`shows/${id}.json\`` : 'none yet (the studio composes a default)'}`);

out.push('', '## Analysis sections', '', 'Character words are relative to the rest of this song (0..1 ranks; low = share of notes below MIDI 50).', '');
out.push('| # | start | end | length | novelty | attacks/s | character | loud | dense | low | fast | quiet |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
const chars = sectionCharacters(pack.notes, pack.sections, chords);
pack.sections.forEach((s, i) => {
  const c = chars[i], n = chords.filter((x) => x.t >= s.start && x.t < s.end).length;
  out.push(`| ${i} | ${clock(s.start)} | ${clock(s.end)} | ${(s.end - s.start).toFixed(1)} s | ${n2(s.novelty)} | ${(n / (s.end - s.start)).toFixed(1)} | ${characterLabel(c)} | ${n2(c.loud)} | ${n2(c.dense)} | ${n2(c.low)} | ${n2(c.fast)} | ${n2(c.quiet)} |`);
});

out.push('', '## Every 10 s', '', 'Loudness 0..1 (the mean over the 10 s; the peak in brackets), attacks per second, the range of the notes struck.', '');
out.push('| from | loudness | attacks/s | notes |', '|---|---|---|---|');
const name = (m: number) => `${['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][m % 12]}${Math.floor(m / 12) - 1}`;
for (let t = 0; t < pack.duration; t += 10) {
  const v = pack.loudness.values.slice(Math.round(t / pack.loudness.hop), Math.round((t + 10) / pack.loudness.hop));
  const mean = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0, peak = v.length ? Math.max(...v) : 0;
  const here = chords.filter((x) => x.t >= t && x.t < t + 10);
  const span = Math.min(10, pack.duration - t);
  const range = here.length ? `${name(Math.min(...here.map((x) => x.lo)))}–${name(Math.max(...here.map((x) => x.hi)))}` : '—';
  out.push(`| ${clock(t)} | ${n2(mean)} (${n2(peak)}) | ${(here.length / span).toFixed(1)} | ${range} |`);
}

const { widgets } = loadCatalogue();
const auto = composeShow({ pack, widgets });
out.push('', "## The auto-composer's default", '', 'What the studio plays when there is no show: a starting point, not a verdict.', '');
out.push('| start | end | label | layers (bottom → top) |', '|---|---|---|---|');
for (const s of auto.sections) out.push(`| ${clock(s.start)} | ${clock(s.end)} | ${s.label ?? ''} | ${s.layers.map((l) => l.widget).join(', ') || '—'} |`);
console.log(out.join('\n'));
