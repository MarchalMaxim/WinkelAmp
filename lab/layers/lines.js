// What a layer hears (plan §2, spec Decisions 3 and 4): the derived lines of a song's notes (melody, bassline, inner,
// low, high, accents), the notes of a `listen` (a line, a track, a family), and the per-instance pulse.
//
// groupChords, soundingAt and advancePulse are copies of src/widgets/chords.ts and features.ts (advanceFeatures), the
// same statements in the same order: tests/layers-pulse.test.ts proves them bit-identical on random data.
//
// One implementation: the lab loads this file as a classic <script>; the studio and Node evaluate the same text with
// new Function('WA', src) (src/widgets/layers.ts).
(function (WA) {
  'use strict';

  /** Notes whose onsets fall within 40 ms of a chord's FIRST note are one attack; notes are taken in the given order. */
  WA.groupChords = function (notes) {
    var out = [];
    for (var i = 0; i < notes.length; i++) {
      var s = notes[i][0], e = notes[i][1], m = notes[i][2], v = notes[i][3];
      var last = out[out.length - 1];
      if (last && s - last.t < 0.04) {
        last.notes.push({ m: m, v: v, d: e - s }); last.vel = Math.max(last.vel, v); last.lo = Math.min(last.lo, m); last.hi = Math.max(last.hi, m);
      } else out.push({ t: s, notes: [{ m: m, v: v, d: e - s }], vel: v, lo: m, hi: m });
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
    for (var i = 0; i < fired.length; i++) { var ch = fired[i]; p.level = Math.max(p.level, ch.vel / 115); p.rate += 1 / 1.44; }
    var k = 1 - Math.pow(0.5, dt / 0.25);
    var top = null, bass = 0;
    for (var j = 0; j < snd.length; j++) { var n = snd[j]; if (!top || n.m > top.m) top = n; if (n.m < 50) bass += n.v / 127; }
    f.level = p.level; f.rate = Math.min(1, p.rate / 8);
    f.pitch += ((top ? pitch01(top.m) : f.pitch) - f.pitch) * k;
    f.bass += (Math.min(1, bass / 2) - f.bass) * k;
    f.density += (Math.min(1, snd.length / 10) - f.density) * k;
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
