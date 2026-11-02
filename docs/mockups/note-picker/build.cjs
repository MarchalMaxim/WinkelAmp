// usage: node build.cjs <repo> <contentDir>   Puts each song's notes next to the mockup page, with its recording.
const fs = require('fs'), path = require('path');
const [repo, out] = process.argv.slice(2);
// Skips the twin of the Prelude and the 42-minute Four Seasons, whose three seasons are here on their own.
const IDS = ['chopin-winter-wind', 'rach-prelude-recording', 'chopin-nocturne-48-1', 'liebesleid', 'beethoven5', 'prokofiev-knights', 'rite-sacrificial-dance', 'rach-concerto-2', 'vivaldi-winter', 'vivaldi-spring', 'vivaldi-autumn'];
const SHORT = { 'vivaldi-winter': 'Vivaldi: Winter', 'vivaldi-spring': 'Vivaldi: Spring', 'vivaldi-autumn': 'Vivaldi: Autumn' };
// One list of notes with an instrument index. Ensembles have their parts in the pack. The concerto counts as a piano piece
// there, so its parts come from the YourMT3+ notes, whose loudness is flat: each takes it from the nearest same-pitched pack note.
function parts(id, dir, p) {
  if (p.tracks) {
    const instruments = [], notes = [];
    for (const tr of Object.values(p.tracks)) { const i = instruments.push({ label: tr.label }) - 1; for (const n of tr.notes) notes.push([...n.slice(0, 4), i]); }
    return { instruments, notes };
  }
  if (id === 'rach-concerto-2') {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'notes.ymt3.json'), 'utf8')).notes, labels = [...new Set(rows.map((r) => r[4]))];
    const byPitch = {}; for (const n of p.notes) (byPitch[n[2]] ||= []).push(n);
    const notes = rows.map(([t, e, m, , l]) => {
      let v = 70, bd = 0.08; for (const n of byPitch[m] || []) { const d = Math.abs(n[0] - t); if (d < bd) { bd = d; v = n[3]; } }
      return [t, e, m, v, labels.indexOf(l)];
    });
    return { instruments: labels.map((label) => ({ label })), notes };
  }
  return { instruments: [{ label: 'Piano' }], notes: p.notes.map((n) => [...n.slice(0, 4), 0]) };
}
const songs = [];
for (const id of IDS) {
  const dir = path.join(repo, 'songs', id), p = JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8'));
  fs.writeFileSync(path.join(out, `song-${id}.js`), 'window.SONG_DATA=' + JSON.stringify({ duration: p.duration, ...parts(id, dir, p) }));
  const audio = path.join(out, `audio-${id}.mp3`);
  fs.rmSync(audio, { force: true });
  fs.copyFileSync(path.join(dir, 'audio.mp3'), audio);
  songs.push({ id, title: SHORT[id] || p.title });
}
fs.rmSync(path.join(out, 'audio.mp3'), { force: true });
const html = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8').replace('/*SONGS*/[]', () => JSON.stringify(songs));
fs.writeFileSync(path.join(out, 'note-picker.html'), html);
console.log('wrote page and', songs.length, 'songs');
