/**
 * A song pack in words, for composing its show (docs/COMPOSING-SHOWS.md): markdown on stdout.
 *
 *   npm run describe-song -- <id>
 *
 * Title, length, where the notes came from and how much to trust them, the analysis sections with their character,
 * loudness and attacks per second every 10 s, where each instrument track plays (pack v2), and the show the
 * auto-composer would make.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { characterLabel, sectionCharacters } from '../src/studio/compose/character';
import { composeShow } from '../src/studio/compose/compose';
import { TRACK_IDS } from '../src/studio/pack/instruments';
import { MS_MODEL } from '../src/studio/pack/muscriptor';
import { validatePack, type SongPack } from '../src/studio/pack/pack';
import { groupChords } from '../src/widgets/chords';
import type { Note } from '../src/widgets/types';
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
  'bp-hybrid': 'the piano transcriber, with basic-pitch notes in its gaps',
  'ms-hybrid': 'the piano transcriber, with MuScriptor notes in its gaps' }[pack.notesFrom];
const ms = pack.transcribers?.find((t) => t.name === 'muscriptor');
const trackMaker = ms ? (ms.model === MS_MODEL ? 'MuScriptor large' : ms.model) : 'YourMT3+';
out.push(`- ${pack.notes.length} notes, ${chords.length} attacks (${pack.quality.notesPerMinute.toFixed(0)} notes/min), from ${from}; onset coverage ${(pack.quality.onsetCoverage * 100).toFixed(0)} %`);
out.push(`- kind: ${pack.kind ?? 'not decided (no notes model ran)'}; ${ms ? "piano share of the tracks' notes" : 'YourMT3+ piano share'}: ${pack.pianoShare == null ? 'n/a (YourMT3+ did not run)' : n2(pack.pianoShare)}`);
if (ms) {
  const lane = pack.tracks?.piano;
  const keyboard = !lane ? 'no keyboard lane' : lane.from === 'ymt3' ? 'keyboard: YourMT3+' : 'keyboard: MuScriptor';
  out.push(`- instrument tracks: ${trackMaker} (${(ms.instruments ?? []).join(', ')}), ${keyboard}`);
}
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

const present = TRACK_IDS.filter((t) => pack.tracks?.[t]);
if (present.length) {
  out.push('', '## Where each instrument plays', '', `${trackMaker}'s instrument tracks: a layer can listen to one. A dot: the track sounds in at least 30 % of the half-second bins of those 10 s.`, '');
  for (const t of present) {
    const k = pack.tracks![t]!;
    out.push(`- \`${t}\` ${k.label} (${k.family}): ${k.notes.length} notes, ${(k.share * 100).toFixed(1)} % of ${ms ? "the tracks' notes" : "YourMT3+'s"}; velocities ${k.vel.borrowed} borrowed, ${k.vel.level} from loudness`);
  }
  out.push('', `| from | ${present.join(' | ')} |`, `|---|${present.map(() => '---|').join('')}`);
  for (let t = 0; t < pack.duration; t += 10) {
    const span = { start: t, end: Math.min(t + 10, pack.duration) };
    out.push(`| ${clock(t)} | ${present.map((id) => (presence(pack.tracks![id]!.notes, span) >= 0.3 ? '●' : '')).join(' | ')} |`);
  }
}

const { widgets } = loadCatalogue();
const auto = composeShow({ pack, widgets });
out.push('', "## The auto-composer's default", '', 'What the studio plays when there is no show: a starting point, not a verdict.', '');
out.push('| start | end | label | layers (bottom → top) |', '|---|---|---|---|');
for (const s of auto.sections) out.push(`| ${clock(s.start)} | ${clock(s.end)} | ${s.label ?? ''} | ${s.layers.map((l) => l.widget).join(', ') || '—'} |`);
console.log(out.join('\n'));

/**
 * The share of a span's 0.5 s bins in which some note sounds (overlaps the bin). The composer's presence (plan §9,
 * T19's src/studio/compose/instruments.ts) means the same; this copy goes once that module lands.
 */
function presence(notes: readonly Note[], s: { start: number; end: number }): number {
  const BIN = 0.5, n = Math.ceil((s.end - s.start) / BIN - 1e-9);
  if (n <= 0) return 0;
  const on = new Uint8Array(n);
  for (const [a, b] of notes) {
    if (b <= s.start || a >= s.end) continue;
    const i0 = Math.max(0, Math.floor((a - s.start) / BIN)), i1 = Math.min(n - 1, Math.ceil((Math.min(b, s.end) - s.start) / BIN) - 1);
    for (let i = i0; i <= i1; i++) on[i] = 1;
  }
  return on.reduce((x, y) => x + y, 0) / n;
}
