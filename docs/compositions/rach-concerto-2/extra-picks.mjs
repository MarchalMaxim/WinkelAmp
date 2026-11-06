// Extra pick sets for the full show (shows/rach-concerto-2-full.json), beside picks.json. Same note source and helpers as
// gen-picks.mjs (copied verbatim below, up to the sets). Run: node extra-picks.mjs [worktree] -> extra-picks.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const W = process.argv[2] || 'C:/Users/maxim/Desktop/projects/github/WinkelAmp/.claude/worktrees/elastic-allen-763e4b';
const pack = JSON.parse(readFileSync(join(W, 'songs/rach-concerto-2/pack.json'), 'utf8'));
const labels = JSON.parse(readFileSync(join(W, 'songs/rach-concerto-2/notes.ymt3.json'), 'utf8')).notes;
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r4 = (x) => Math.round(x * 1e4) / 1e4 || 0;
const L = pack.loudness, loud = (t) => L.values[Math.min(L.values.length - 1, Math.max(0, Math.round(t / L.hop)))];
const fam = (l) => /Violin|Viola|Cello|String|Contrabass/.test(l) ? 'str' : /Piano/.test(l) ? 'pno' : /Clarinet|Oboe|Horn|Bassoon|Pipe|Flute/.test(l) ? 'wind' : 'oth';

// ---- the roll ----
const byPitch = new Map();
for (const n of pack.notes) { const l = byPitch.get(n[2]); if (l) l.push(n); else byPitch.set(n[2], [n]); }
const roll = labels.map(([t, e, m, , label], k) => {
  let v = 70, near = 0.08, guessed = true;
  for (const n of byPitch.get(m) ?? []) { const d = Math.abs(n[0] - t); if (d < near) { near = d; v = n[3]; guessed = false; } }
  if (guessed) v = Math.max(20, Math.min(115, Math.round(25 + 85 * loud(t))));
  return { t, e, m, v, label, f: fam(label), k };
}).sort((a, b) => a.t - b.t || a.k - b.k);
const packNotes = pack.notes.map(([t, e, m, v], k) => ({ t, e, m, v, label: 'pack', f: 'pno', k }));

// ---- helpers ----
/** 40 ms clusters from the first note (groupChords' rule). */
function clusters(ns) {
  const out = []; let cur = null;
  for (const n of ns) { if (cur && n.t - cur.t < 0.04) { cur.ns.push(n); if (n.m > cur.top.m) cur.top = n; if (n.m < cur.low.m) cur.low = n; cur.vmax = Math.max(cur.vmax, n.v); } else { cur = { t: n.t, ns: [n], top: n, low: n, vmax: n.v }; out.push(cur); } }
  return out;
}
const inWin = (src, a, b, filter = () => true) => src.filter((n) => n.t >= a && n.t < b && filter(n));
/** Skyline melody: the top of each onset cluster, unless a note more than a tone higher, begun within 0.8 s, still sounds
    (accompaniment under a held melody note); notes shorter than minDur dropped (ornaments); a repeat of the same pitch
    within 0.15 s merged (doubled instruments). */
function skyline(src, a, b, filter, minDur = 0.15, hold = 0.8) {
  const ns = inWin(src, a - hold, b, (n) => filter(n) && n.e - n.t >= minDur);
  const out = [];
  for (const c of clusters(ns)) {
    if (c.t < a) continue;
    if (ns.some((n) => n.t < c.t - 0.02 && n.t >= c.t - hold && n.e > c.t + 0.05 && n.m > c.top.m + 2)) continue;
    const prev = out[out.length - 1];
    if (prev && prev.m === c.top.m && c.t - prev.t < 0.15) continue;
    out.push(c.top);
  }
  return out;
}
const attacks = (notes) => clusters(notes).length;
const asTuple = (n) => [r4(n.t), r4(Math.max(n.e, n.t)), n.m, Math.max(1, Math.min(127, Math.round(n.v)))];

const sets = [];
function add(id, o, notes) {
  notes = [...notes].sort((x, y) => x.t - y.t || x.m - y.m);
  const ids = new Set(); notes = notes.filter((n) => { const key = `${n.t}|${n.m}|${n.label}`; if (ids.has(key)) return false; ids.add(key); return true; });
  sets.push({ id, ...o, attacks: attacks(notes), source: o.source ?? 'roll', notes: notes.map(asTuple) });
}
const whole = (cs) => cs.flatMap((c) => c.ns);
/** Each chord thinned to its lowest and highest note (and its loudest, if asked): still one attack per chord, fewer notes. */
const outer = (cs, loudest = false) => cs.flatMap((c) => {
  const keep = new Set([c.low, c.top]);
  if (loudest) keep.add(c.ns.reduce((a, n) => (n.v > a.v ? n : a)));
  return [...keep];
});
const STR = (n) => n.f === 'str';

// --- the deep strokes: the bells' echo at the big arrivals (the only notes at D1 or below after 59 s, with their octave) ---
add('deep-strokes', { name: 'Deep strokes (the bells at the big arrivals)', section: 'A\', T, Climax, A\'\' cont., Coda I', from: 79, to: 617, source: 'pack', pair: 'deep',
  rule: 'pack notes midi <= 40 within 80 ms of the strokes at 79.92, 134.22, 407.45, 475.18 and 616.04 s',
  why: 'The deepest ff strokes after the C1 pulse: the opening bells answering at each big arrival. One set, one short clip per stroke.' },
  [79.92, 134.22, 407.45, 475.18, 616.04].flatMap((s) => inWin(packNotes, s - 0.03, s + 0.08, (n) => n.m <= 40)));
add('final-bass', { name: 'Final chords, the bass', section: 'Final', from: 694.6, to: 697, source: 'pack', pair: 'bells',
  rule: 'pack notes midi <= 43 in 694.7-697 s', why: 'The low octaves of the four last chords: the bells close the frame.' },
  inWin(packNotes, 694.7, 697, (n) => n.m <= 43));

// --- the piano's runs ---
add('run-a2', { name: 'Piano run into A\' (Bb2 to F4)', section: 'A\'', from: 76, to: 77.85, pair: 'runs',
  rule: 'top of each roll piano cluster 76.0-77.85 s', why: 'The run that launches the strings\' rise (76.1 s).' },
  clusters(inWin(roll, 76.0, 77.85, (n) => n.f === 'pno')).map((c) => c.top));
add('run-a3', { name: 'Falling run after the recap\'s rise (F5 to C3)', section: 'A\'\' cont.', from: 477.9, to: 479.5, source: 'pack', pair: 'runs',
  rule: 'pack, top of each cluster 477.9-479.5 s', why: 'The run that answers the deep stroke at 475.2 s.' },
  clusters(inWin(packNotes, 477.9, 479.5)).map((c) => c.top));

// --- theme 2's second statement continued (B2) ---
add('t2-tail-b2', { name: 'Theme 2 continued, B2 (piano)', section: 'B2', from: 187, to: 200.3, pair: 't2-tail',
  rule: 'skyline of all roll notes 187-200.3 s at midi >= 60, minDur 0.3', why: 'The piano carries theme 2 on after the head, up to Eb5 at 198.3 s.' },
  skyline(roll, 187, 200.3, (n) => n.m >= 60, 0.3));
add('t2-strings-b2', { name: 'Theme 2, the strings take the line (B2)', section: 'B2', from: 200.3, to: 222, pair: 't2-tail',
  rule: 'skyline of all roll notes 200.3-222 s at midi >= 60, minDur 0.3', why: 'The strings take the line and it opens out (208-216 s), climbing to B5 at 221.7 s, into the climax.' },
  skyline(roll, 200.3, 222, (n) => n.m >= 60, 0.3));

// --- development and coda ---
add('d1-accents', { name: 'Development opens: the piano\'s accents', section: 'D1', from: 298, to: 321.5,
  rule: 'top note of roll piano clusters 298-321.5 s whose loudest note is >= 90', why: 'The dense figuration of D1, only its hardest strokes.' },
  clusters(inWin(roll, 298, 321.5, (n) => n.f === 'pno')).filter((c) => c.vmax >= 90).map((c) => c.top));
add('coda-high', { name: 'Coda I: the high piano', section: 'Coda I', from: 618.5, to: 643.5,
  rule: 'skyline of roll piano notes 618.5-643.5 s at midi >= 79, minDur 0.2', why: 'After the sweep, the high piano with the winds: points of light, as in the close and the meno mosso.' },
  skyline(roll, 618.5, 643.5, (n) => n.f === 'pno' && n.m >= 79, 0.2));
add('coda-drive', { name: 'Coda II: the drive begins', section: 'Coda II', from: 656, to: 680,
  rule: 'top note of roll piano clusters 656-680 s whose loudest note is >= 65', why: 'The steady figuration of Coda II, its firmer strokes, before the last crescendo.' },
  clusters(inWin(roll, 656, 680, (n) => n.f === 'pno')).filter((c) => c.vmax >= 65).map((c) => c.top));

const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  if (!s.notes.length) throw new Error(`${s.id} has no notes`);
  for (let i = 1; i < s.notes.length; i++) if (s.notes[i][0] < s.notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  if (s.notes[0][0] < s.from || s.notes[s.notes.length - 1][0] >= s.to) throw new Error(`${s.id}: notes outside from/to`);
}
const out = { song: 'rach-concerto-2', made: 'extra-picks.mjs', sets: sets.map(({ attacks, ...s }) => ({ id: s.id, name: s.name, why: s.why, rule: s.rule, section: s.section, pair: s.pair, source: s.source, from: s.from, to: s.to, attacks, notes: s.notes })) };
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]');
writeFileSync(join(W, 'docs/compositions/rach-concerto-2/extra-picks.json'), text + '\n');
for (const s of sets) console.log(`${s.id.padEnd(16)} ${String(s.attacks).padStart(3)} att ${String(s.notes.length).padStart(3)} notes ${s.from}-${s.to} | ${s.notes.map((n) => n[0].toFixed(2) + nm(n[2])).join(' ')}`);
