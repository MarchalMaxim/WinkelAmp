// What a layer hears (plan §2, spec Decisions 3 and 4): the derived lines of a song's notes (melody, bassline, inner,
// low, high, accents), its note types (big chords, runs, trills, long notes, repeated notes), the notes of a `listen`
// (a line, a note type, a track, a family), and the per-instance pulse.
//
// groupChords, soundingAt and advancePulse are copies of src/widgets/chords.ts and features.ts (advanceFeatures), the
// same statements in the same order: tests/layers-pulse.test.ts proves them bit-identical on random data. loudCurve and
// paceAt are copies of src/widgets/curves.ts, proved the same way by tests/curves.test.ts.
//
// One implementation: the lab loads this file as a classic <script>; the studio and Node evaluate the same text with
// new Function('WA', src) (src/widgets/layers.ts).
(function (WA) {
  'use strict';

  /** Notes whose onsets fall within 40 ms of a chord's FIRST note are one attack; notes are taken in the given order. */
  WA.groupChords = function (notes) {
    var out = [];
    for (var i = 0; i < notes.length; i++) {
      var s = notes[i][0], e = notes[i][1], m = notes[i][2], v = notes[i][3], note = { m: m, v: v, d: e - s };
      if (typeof notes[i][4] === 'number') note.amount = notes[i][4];
      var last = out[out.length - 1];
      if (last && s - last.t < 0.04) {
        last.notes.push(note); last.vel = Math.max(last.vel, v); last.lo = Math.min(last.lo, m); last.hi = Math.max(last.hi, m);
      } else out.push({ t: s, notes: [note], vel: v, lo: m, hi: m });
    }
    return out;
  };

  /** Index of the first note whose start is ≥ t. */
  var firstAtOrAfter = function (notes, t) {
    var a = 0, b = notes.length;
    while (a < b) { var k = (a + b) >> 1; if (notes[k][0] < t) a = k + 1; else b = k; }
    return a;
  };

  /** Notes sounding at t: started in [t − 8, t] and not yet ended. */
  WA.soundingAt = function (notes, t) {
    var out = [];
    for (var i = firstAtOrAfter(notes, t - 8); i < notes.length && notes[i][0] <= t; i++) {
      var s = notes[i][0], e = notes[i][1], m = notes[i][2], v = notes[i][3];
      if (e > t) out.push({ m: m, v: v, start: s, end: e });
    }
    return out;
  };

  /** One step of a pulse and its features: advanceFeatures, statement for statement. */
  WA.advancePulse = function (p, f, fired, snd, dt) {
    p.level *= Math.pow(0.5, dt / 0.8); p.rate *= Math.pow(0.5, dt / 1.0);
    p.hit *= Math.pow(0.5, dt / 0.08);
    for (var i = 0; i < fired.length; i++) { var ch = fired[i]; p.level = Math.max(p.level, ch.vel / 115); p.rate += 1 / 1.44; }
    for (var h = 0; h < fired.length; h++) p.hit = 1 - (1 - p.hit) * (1 - Math.pow(fired[h].vel / 127, 1.4));
    var k = 1 - Math.pow(0.5, dt / 0.25);
    var top = null, bass = 0;
    for (var j = 0; j < snd.length; j++) { var n = snd[j]; if (!top || n.m > top.m) top = n; if (n.m < 50) bass += n.v / 127; }
    f.level = p.level; f.rate = Math.min(1, p.rate / 8);
    f.pitch += ((top ? pitch01(top.m) : f.pitch) - f.pitch) * k;
    f.bass += (Math.min(1, bass / 2) - f.bass) * k;
    f.density += (Math.min(1, snd.length / 10) - f.density) * k;
    f.hit = p.hit;
  };

  /** loud at song time t (src/widgets/curves.ts makeLoudAt, the same statements): the loudness lane read lead s ahead,
      linear between its samples' centres, held past its ends, its 5th to 95th percentile stretched to 0..1. No lane, an
      empty or flat one, or no lead: always 0. The hosts pass WA.LOUDNESS_LAG.open as lead. */
  WA.loudCurve = function (lane, lead) {
    var hop = lane && lane.hop, vals = lane && lane.values;
    if (!vals || !vals.length || !(hop > 0) || !Number.isFinite(lead)) return function () { return 0; };
    var n = vals.length, sorted = vals.map(function (v) { return Number.isFinite(v) ? v : 0; }).sort(function (a, b) { return a - b; });
    var lo = sorted[Math.floor(0.05 * (n - 1))], hi = sorted[Math.floor(0.95 * (n - 1))];
    if (!(hi > lo)) return function () { return 0; };
    return function (t) {
      var x = (t + lead) / hop - 0.5, v;
      if (!(x > 0)) v = vals[0];
      else if (x >= n - 1) v = vals[n - 1];
      else { var i = Math.floor(x); v = vals[i] + (vals[i + 1] - vals[i]) * (x - i); }
      var u = (v - lo) / (hi - lo);
      return u > 0 ? (u < 1 ? u : 1) : 0;   // NaN → 0
    };
  };

  /** pace at song time t (src/widgets/curves.ts paceAt, the same statements): attacks per second in a centred 4 s
      window (cut at 0) over the 95th percentile of that measure every 0.1 s from the first attack to the last, clamped
      to 0..1; kept per chord list. */
  var PACE_HALF = 2, paceCache = new WeakMap();
  var firstAt = function (times, t) {
    var a = 0, b = times.length;
    while (a < b) { var k = (a + b) >> 1; if (times[k] < t) a = k + 1; else b = k; }
    return a;
  };
  var paceRaw = function (times, t) {
    var a = t - PACE_HALF, b = t + PACE_HALF, len = b - (a > 0 ? a : 0);
    if (!(len > 0)) return 0;
    return (firstAt(times, b) - firstAt(times, a)) / len;
  };
  WA.paceAt = function (chords, t) {
    var c = paceCache.get(chords);
    if (!c) {
      var times = chords.map(function (ch) { return ch.t; }).sort(function (a, b) { return a - b; }), xs = [];
      if (times.length) for (var i = 0, t0 = times[0], t1 = times[times.length - 1]; t0 + i * 0.1 <= t1 + 1e-9; i++) xs.push(paceRaw(times, t0 + i * 0.1));
      xs.sort(function (a, b) { return a - b; });
      c = { times: times, top: xs.length ? xs[Math.floor(0.95 * (xs.length - 1))] : 0 };
      paceCache.set(chords, c);
    }
    if (!(c.top > 0)) return 0;
    var u = paceRaw(c.times, t) / c.top;
    return u > 0 ? (u < 1 ? u : 1) : 0;
  };

  /** MIDI → 0..1 over the piano (21..108). */
  var pitch01 = function (m) { return Math.max(0, Math.min(1, (m - 21) / 87)); };

  var byStart = function (a, b) { return a[0] - b[0]; };

  /** A line through the chords' outer notes: a chord's top (dir +1; its bottom, dir −1) joins when no line note sounds
      at the chord's time, or when it is at most 2 semitones inside the line note that sounds (the latest joined). */
  var outerLine = function (notes, chords, dir, into) {
    var cur = null, off = 0;
    for (var c = 0; c < chords.length; c++) {
      var len = chords[c].notes.length, best = -1;
      for (var i = off; i < off + len; i++) {
        if (best < 0 || (dir > 0 ? notes[i][2] > notes[best][2] : notes[i][2] < notes[best][2])) best = i;
      }
      var n = notes[best], t = chords[c].t;
      if (!cur || !(cur[1] > t) || (dir > 0 ? n[2] >= cur[2] - 2 : n[2] <= cur[2] + 2)) { into[best] = true; cur = n; }
      off += len;
    }
  };

  // ---- Note types (spec 2026-11-01-note-types): rules measured on six songs. On a piano a note's length is mostly the
  // pedal, so they read onsets first. Each takes notes sorted by start and returns indices into them, maybe repeated.

  /** Attacks of 5 notes or more: all their notes. */
  var bigChordIds = function (notes) {
    var chords = WA.groupChords(notes), out = [], off = 0;
    for (var c = 0; c < chords.length; c++) {
      var len = chords[c].notes.length;
      if (len >= 5) for (var i = off; i < off + len; i++) out.push(i);
      off += len;
    }
    return out;
  };

  /** Chains of at least 6 notes, each 30..200 ms after the one before and 1..3 semitones from it, that keep their
      direction at least half the time and travel at least 5 semitones. The longest chains take their notes first. */
  var runIds = function (notes) {
    var n = notes.length, len = new Int32Array(n).fill(1), prev = new Int32Array(n).fill(-1), i, j, k;
    for (i = 0; i < n; i++) {
      for (j = i - 1; j >= 0 && notes[i][0] - notes[j][0] <= 0.2; j--) {
        var gap = notes[i][0] - notes[j][0], d = Math.abs(notes[i][2] - notes[j][2]);
        if (gap < 0.03 || d < 1 || d > 3) continue;
        if (len[j] + 1 > len[i] || (len[j] + 1 === len[i] && gap < notes[i][0] - notes[prev[i]][0])) { len[i] = len[j] + 1; prev[i] = j; }
      }
    }
    var order = [];
    for (i = 0; i < n; i++) order.push(i);
    order.sort(function (a, b) { return len[b] - len[a]; });
    var used = new Uint8Array(n), out = [];
    for (var o = 0; o < n; o++) {
      var end = order[o];
      if (used[end] || len[end] < 6) continue;
      var ids = [];
      for (k = end; k >= 0 && !used[k]; k = prev[k]) ids.push(k);
      ids.reverse();
      if (ids.length < 6) continue;
      var keep = 0, lo = 127, hi = 0;
      for (k = 2; k < ids.length; k++) {
        if (Math.sign(notes[ids[k]][2] - notes[ids[k - 1]][2]) === Math.sign(notes[ids[k - 1]][2] - notes[ids[k - 2]][2])) keep++;
      }
      for (k = 0; k < ids.length; k++) { lo = Math.min(lo, notes[ids[k]][2]); hi = Math.max(hi, notes[ids[k]][2]); }
      if (keep / (ids.length - 2) < 0.5 || hi - lo < 5) continue;
      for (k = 0; k < ids.length; k++) { used[ids[k]] = 1; out.push(ids[k]); }
    }
    return out;
  };

  /** Each pitch's note indices, and the pitches in the order they first sound. */
  var pitchIndex = function (notes) {
    var by = {}, pitches = [];
    for (var i = 0; i < notes.length; i++) {
      var m = notes[i][2];
      if (!by[m]) { by[m] = []; pitches.push(m); }
      by[m].push(i);
    }
    return { by: by, pitches: pitches };
  };

  /** Strict alternation of two pitches at most a tone apart, 30..180 ms between onsets, at least 7.5 notes a second,
      at least 65 % of the notes near the pair in its span. Under 6 notes it must also stand alone. */
  var trillIds = function (notes) {
    var ix = pitchIndex(notes), out = [];
    var standsAlone = function (ids, a, b, t0, t1) {
      var mine = {}, q;
      for (q = 0; q < ids.length; q++) mine[ids[q]] = true;
      for (q = firstAtOrAfter(notes, t0 - 0.2); q < notes.length && notes[q][0] <= t1 + 0.2; q++) {
        var m = notes[q][2], t = notes[q][0];
        if (mine[q] || m < a - 5 || m > b + 5 || m === a || m === b) continue;
        if (t < t0 - 0.04 || t > t1 + 0.04) return false;
      }
      return true;
    };
    var flush = function (seq, from, to, a, b) {
      if (to - from < 4) return;
      var ids = seq.slice(from, to), t0 = notes[ids[0]][0], t1 = notes[ids[ids.length - 1]][0], close = 0, q;
      for (q = firstAtOrAfter(notes, t0); q < notes.length && notes[q][0] <= t1; q++) if (notes[q][2] >= a - 5 && notes[q][2] <= b + 5) close++;
      if (ids.length / close < 0.65 || (ids.length - 1) / (t1 - t0) < 7.5) return;
      if (ids.length >= 6 || standsAlone(ids, a, b, t0, t1)) for (q = 0; q < ids.length; q++) out.push(ids[q]);
    };
    for (var p = 0; p < ix.pitches.length; p++) for (var d = 1; d <= 2; d++) {
      var a = ix.pitches[p], b = a + d;
      if (!ix.by[b]) continue;
      var seq = ix.by[a].concat(ix.by[b]).sort(function (x, y) { return notes[x][0] - notes[y][0]; }), start = 0;
      for (var k = 1; k <= seq.length; k++) {
        var gap = k < seq.length ? notes[seq[k]][0] - notes[seq[k - 1]][0] : 0;
        if (!(k < seq.length && notes[seq[k]][2] !== notes[seq[k - 1]][2] && gap <= 0.18 && gap >= 0.03)) { flush(seq, start, k, a, b); start = k; }
      }
    }
    return out;
  };

  /** Rings at least 1.5 s and among the longest tenth of these notes, and nothing starts within 4 semitones of it in
      its first second (from 60 ms on). */
  var longIds = function (notes) {
    var ds = notes.map(function (x) { return x[1] - x[0]; }).sort(function (a, b) { return a - b; });
    var min = Math.max(1.5, ds[Math.floor(ds.length * 0.9)] || 0), out = [];
    for (var i = 0; i < notes.length; i++) {
      if (notes[i][1] - notes[i][0] < min) continue;
      var moved = false;
      for (var j = i + 1; j < notes.length && notes[j][0] - notes[i][0] < 1; j++) {
        if (Math.abs(notes[j][2] - notes[i][2]) <= 4 && notes[j][0] - notes[i][0] > 0.06) { moved = true; break; }
      }
      if (!moved) out.push(i);
    }
    return out;
  };

  /** One pitch struck at least 3 times, 50..350 ms between onsets, with nothing within 4 semitones starting between
      two strikes (clear of each by 40 ms). */
  var repeatIds = function (notes) {
    var ix = pitchIndex(notes), out = [];
    var clean = function (sel, m) {
      for (var q = 1; q < sel.length; q++) for (var j = sel[q - 1] + 1; j < sel[q]; j++) {
        var d = Math.abs(notes[j][2] - m);
        if (d > 0 && d <= 4 && notes[j][0] - notes[sel[q - 1]][0] > 0.04 && notes[sel[q]][0] - notes[j][0] > 0.04) return false;
      }
      return true;
    };
    for (var p = 0; p < ix.pitches.length; p++) {
      var ids = ix.by[ix.pitches[p]], start = 0;
      for (var k = 1; k <= ids.length; k++) {
        var gap = k < ids.length ? notes[ids[k]][0] - notes[ids[k - 1]][0] : Infinity;
        if (gap <= 0.35 && gap >= 0.05) continue;
        if (k - start >= 3) { var sel = ids.slice(start, k); if (clean(sel, ix.pitches[p])) out.push.apply(out, sel); }
        start = k;
      }
    }
    return out;
  };

  var NOTE_RULES = { chords: bigChordIds, runs: runIds, trills: trillIds, long: longIds, repeats: repeatIds };

  /** A note type's notes in one list, as the input's tuples in the input's order. */
  var ruleNotes = function (notes, type) {
    var ids = NOTE_RULES[type](notes), mark = new Uint8Array(notes.length), out = [], i;
    for (i = 0; i < ids.length; i++) mark[ids[i]] = 1;
    for (i = 0; i < notes.length; i++) if (mark[i]) out.push(notes[i]);
    return out;
  };

  /** A note type's notes in a song. Trills and runs on an ensemble go per track, as one instrument's trill is lost among
      all the notes (Vivaldi: 2 trills in all the notes, 11 on the tracks): the union, stable-sorted by start. A track
      under 40 notes does not count, and with fewer than two left the rule reads all the notes. */
  var noteTypeOfSong = function (song, type) {
    var tracks = song.tracks, ids = [], out = [];
    if (type === 'trills' || type === 'runs') for (var k in tracks) if (has(tracks, k) && tracks[k].notes.length >= 40) ids.push(k);
    if (ids.length < 2) return ruleNotes(song.notes, type);
    ids.sort(function (x, y) { return TRACK_ORDER.indexOf(x) - TRACK_ORDER.indexOf(y); });
    for (var i = 0; i < ids.length; i++) out = out.concat(ruleNotes(tracks[ids[i]].notes, type));
    return out.sort(byStart);
  };

  /** The times of each note type's attacks in a song (what validateShow's warnings go by). */
  WA.noteTypeAttacks = function (song) {
    var out = {}, at = function (ch) { return ch.t; };
    for (var i = 0; i < WA.NOTE_TYPES.length; i++) out[WA.NOTE_TYPES[i]] = WA.groupChords(noteTypeOfSong(song, WA.NOTE_TYPES[i])).map(at);
    return out;
  };

  /** The notes of a derived line, as the input's tuples, stable-sorted by start. */
  WA.lineNotes = function (notes, line) {
    var out = [], i;
    if (line === 'low' || line === 'high') {
      for (i = 0; i < notes.length; i++) if (line === 'low' ? notes[i][2] < 55 : notes[i][2] >= 72) out.push(notes[i]);
      return out.sort(byStart);
    }
    var chords = WA.groupChords(notes), pick = [], off = 0, c;
    if (line === 'accents') {
      if (!chords.length) return out;
      var vels = chords.map(function (ch) { return ch.vel; }).sort(function (a, b) { return a - b; });
      var cut = vels[Math.max(1, Math.ceil(vels.length * 85 / 100)) - 1];
      for (c = 0; c < chords.length; c++) {
        var len = chords[c].notes.length;
        if (chords[c].vel >= cut) for (i = off; i < off + len; i++) pick[i] = true;
        off += len;
      }
    } else if (line === 'melody' || line === 'bassline') {
      outerLine(notes, chords, line === 'melody' ? 1 : -1, pick);
    } else if (line === 'inner') {
      var top = [], bot = [];
      outerLine(notes, chords, 1, top); outerLine(notes, chords, -1, bot);
      for (i = 0; i < notes.length; i++) pick[i] = !top[i] && !bot[i];
    } else return out;
    for (i = 0; i < notes.length; i++) if (pick[i]) out.push(notes[i]);
    return out.sort(byStart);
  };

  var LINES = ['melody', 'bassline', 'inner', 'low', 'high', 'accents'];
  WA.NOTE_TYPES = ['chords', 'runs', 'trills', 'long', 'repeats'];
  /** §1's TrackId order: a family's union concatenates its tracks in this order before the stable sort. */
  var TRACK_ORDER = ['piano', 'plucked', 'violin', 'viola', 'cello', 'contrabass', 'strings', 'timpani', 'voice',
    'horn', 'trumpet', 'trombone', 'brass', 'flute', 'oboe', 'clarinet', 'bassoon', 'saxophone'];
  var has = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k) && !!o[k]; };

  /** The notes a `listen` hears: all, a set of picks, a derived line, a present track, or the union of a family's
      present tracks. Anything else the song lacks falls back to all its notes, with heard 'all'; a set of picks that is
      not there hears nothing, or a widget meant for a few notes would fire on every one. */
  WA.listenNotes = function (song, listen) {
    var all = { notes: song.notes, heard: 'all' };
    if (listen === undefined || listen === null || listen === 'all') return all;
    if (typeof listen === 'string' && listen.indexOf('picks:') === 0) {
      var id = listen.slice(6);
      return { notes: has(song.picks, id) && song.picks[id].notes || [], heard: listen };
    }
    if (LINES.indexOf(listen) >= 0) return { notes: WA.lineNotes(song.notes, listen), heard: listen };
    // A type the song lacks hears nothing, or a widget meant for a few notes would fire on every one.
    if (WA.NOTE_TYPES.indexOf(listen) >= 0) return { notes: noteTypeOfSong(song, listen), heard: listen };
    var tracks = song.tracks;
    if (typeof listen === 'string' && listen.indexOf('family:') === 0) {
      var fam = listen.slice(7), ids = [];
      for (var k in tracks) if (has(tracks, k) && tracks[k].family === fam) ids.push(k);
      if (!ids.length) return all;
      ids.sort(function (a, b) {
        var x = TRACK_ORDER.indexOf(a), y = TRACK_ORDER.indexOf(b);
        return (x < 0 ? TRACK_ORDER.length : x) - (y < 0 ? TRACK_ORDER.length : y);
      });
      var out = [];
      for (var i = 0; i < ids.length; i++) out = out.concat(tracks[ids[i]].notes);
      return { notes: out.sort(byStart), heard: listen };
    }
    if (has(tracks, listen)) return { notes: tracks[listen].notes, heard: listen };
    return all;
  };
})(typeof WA !== 'undefined' ? WA : (globalThis.WA_LAYERS ??= {}));
