// Intensity curves: the curve through a layer's pivots, the deterministic thinning
// that decides which attacks a layer hears, and the presets that write ordinary pivots into a section.
//
// One implementation: the lab loads this file as a classic <script>; the studio and Node evaluate the same text with
// new Function('WA', src) (src/widgets/layers.ts). No randomness: thinning is FNV-1a, so playing, seeking, a paused
// preview and a render all agree.
(function (WA) {
  'use strict';

  /** At most this many pivots per layer per section; the presets merge further to stay under. */
  WA.MAX_PIVOTS = 256;

  /** How late the song's loudness lane (pack.loudness) runs behind the sound, in seconds. It is an average of power
      looking only backwards, so it rises sooner than it falls. Measured 2026-11-08 on six pieces against the sound's
      own energy: it crosses upwards about 1.1 s late and downwards about 2.4 s
      late (medians of 34 and 33 crossings); 1.7 s on average. */
  WA.LOUDNESS_LAG = { open: 1.1, close: 2.4, mean: 1.7 };

  var clamp01 = function (v) { return v > 0 ? (v < 1 ? v : 1) : 0; };   // NaN → 0

  /** The curve's value at song time t: holds before the first pivot and after the last; each segment takes the shape
      and bend of the pivot it starts at. No pivots → 1 (no curve: today's path). */
  WA.automationAt = function (p, t) {
    if (!p || p.length === 0) return 1;
    var n = p.length;
    if (t <= p[0].t) return clamp01(p[0].v);
    if (t >= p[n - 1].t) return clamp01(p[n - 1].v);
    var a = 0, b = n - 1;                       // the last index with p[i].t ≤ t: p[a].t ≤ t < p[b].t
    while (b - a > 1) { var k = (a + b) >> 1; if (p[k].t <= t) a = k; else b = k; }
    var P = p[a], q = p[a + 1];
    if (q.t === P.t) return clamp01(q.v);
    var u = (t - P.t) / (q.t - P.t);
    var shape = P.shape;
    if (shape === 'hold') return clamp01(P.v);
    if (shape === 'ease') u = u * u * (3 - 2 * u);
    else if (P.bend) u = Math.pow(u, Math.pow(2, -3 * P.bend));
    return clamp01(P.v + (q.v - P.v) * u);
  };

  var OFFSET = 0x811c9dc5, PRIME = 0x01000193;

  /** FNV-1a 32 over the string's UTF-16 code units, low byte then high byte. */
  WA.fnv32 = function (s) {
    var h = OFFSET;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h ^= c & 0xff; h = Math.imul(h, PRIME);
      h ^= c >>> 8; h = Math.imul(h, PRIME);
    }
    return h >>> 0;
  };

  /** An attack's own number for an instance: FNV-1a over the 8 bytes (salt LE, round(t·1000) LE as uint32). */
  WA.attackHash = function (t, salt) {
    var h = OFFSET, x = salt >>> 0, y = Math.round(t * 1000) >>> 0, i;
    for (i = 0; i < 4; i++) { h ^= (x >>> (8 * i)) & 0xff; h = Math.imul(h, PRIME); }
    for (i = 0; i < 4; i++) { h ^= (y >>> (8 * i)) & 0xff; h = Math.imul(h, PRIME); }
    return h >>> 0;
  };

  /** Whether an attack at t reaches a layer of intensity a: a fixed fraction a of the attacks, the same ones every time. */
  WA.passes = function (t, a, salt) {
    if (a >= 1) return true;
    if (!(a > 0)) return false;
    return WA.attackHash(t, salt) / 4294967296 < a;
  };

  // ---- "keep the strongest" (a layer's thin: 'loud') ----------------------------------------------------------------

  /** How far around an attack the strongest are looked for, in seconds, each way (inclusive). */
  WA.THIN_SPAN = 4;
  var THIN = typeof WeakMap === 'function' ? new WeakMap() : null;

  /** For each chord of a list (sorted by time), the share of the chords within ±THIN_SPAN s of it (itself included) that
      beat it: 0 for the strongest there. One beats another when it is louder (vel), or as loud with a higher attackHash,
      so on a track of flat velocities it still picks at random, spread evenly, but not the same chords as passes. Worked out once per list and salt: a new list
      (a set of picks edited) gets its own. A function of the list alone, so play, a seek and a render agree. */
  WA.thinRanks = function (chords, salt) {
    var bySalt = THIN ? THIN.get(chords) : chords.__waThin, key = String(salt >>> 0);
    if (!bySalt) { bySalt = {}; if (THIN) THIN.set(chords, bySalt); else chords.__waThin = bySalt; }
    if (bySalt[key]) return bySalt[key];
    var n = chords.length, hs = [], out = [], lo = 0, hi = 0, i, j;
    for (i = 0; i < n; i++) hs.push(WA.attackHash(chords[i].t, salt));
    for (i = 0; i < n; i++) {
      var t = chords[i].t, v = chords[i].vel, beat = 0;
      while (lo < n && chords[lo].t < t - WA.THIN_SPAN) lo++;
      while (hi < n && chords[hi].t <= t + WA.THIN_SPAN) hi++;
      for (j = lo; j < hi; j++) if (chords[j].vel > v || (chords[j].vel === v && hs[j] > hs[i])) beat++;
      out.push(beat / (hi - lo));
    }
    bySalt[key] = out;
    return out;
  };

  /** Whether the attack ch of an instance's chord list reaches a layer of intensity a when it keeps the strongest: its
      share of stronger neighbours (thinRanks) is below a. A chord not in the list takes passes. */
  WA.passesStrongest = function (chords, ch, a, salt) {
    if (a >= 1) return true;
    if (!(a > 0)) return false;
    var lo = 0, hi = chords.length - 1, m;
    while (lo <= hi) {
      m = (lo + hi) >> 1;
      if (chords[m].t < ch.t) lo = m + 1;
      else if (chords[m].t > ch.t) hi = m - 1;
      else return WA.thinRanks(chords, salt)[m] < a;
    }
    return WA.passes(ch.t, a, salt);
  };

  // ---- presets: generators of ordinary pivots inside a section's span -------------------------------------------

  var median = function (xs) {
    var s = xs.slice().sort(function (a, b) { return a - b; });
    var n = s.length;
    return n % 2 ? s[(n - 1) >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2;
  };
  var gaps = function (xs) { var g = []; for (var i = 1; i < xs.length; i++) g.push(xs[i] - xs[i - 1]); return g; };

  /** The pivots inside the span, with an edge pivot carrying the curve's value where pivots fell outside, so the
      curve inside the span is unchanged (exact for linear and hold segments, the only ones the gates write). */
  var clip = function (s, ps) {
    var out = [], i;
    if (!ps.length) return out;
    if (ps[0].t < s.start) {
      var j = 0;
      while (j + 1 < ps.length && ps[j + 1].t <= s.start) j++;   // the last pivot at or before s.start
      if (ps[j].t < s.start) {                                     // none sits on s.start: an edge pivot, same segment shape
        var e = { t: s.start, v: WA.automationAt(ps, s.start) };
        if (ps[j].shape) e.shape = ps[j].shape;
        out.push(e);
      }
    }
    for (i = 0; i < ps.length; i++) if (ps[i].t >= s.start && ps[i].t <= s.end) out.push(ps[i]);
    if (ps[ps.length - 1].t > s.end && !(out.length && out[out.length - 1].t === s.end)) out.push({ t: s.end, v: WA.automationAt(ps, s.end) });
    return out;
  };

  /** Bridges gaps shorter than `gap` between sorted, disjoint runs [a, b]. */
  var bridge = function (runs, gap) {
    var out = [];
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i], last = out[out.length - 1];
      if (last && r[0] - last[1] < gap) { if (r[1] > last[1]) last[1] = r[1]; } else out.push([r[0], r[1]]);
    }
    return out;
  };

  /** Merges the runs across their smallest gaps (the earliest on a tie) until at most `max` are left. */
  var mergeTo = function (runs, max) {
    runs = runs.map(function (r) { return [r[0], r[1]]; });
    while (runs.length > max && runs.length > 1) {
      var best = 1, bg = Infinity;
      for (var i = 1; i < runs.length; i++) { var g = runs[i][0] - runs[i - 1][1]; if (g < bg) { bg = g; best = i; } }
      runs[best - 1][1] = Math.max(runs[best - 1][1], runs[best][1]);
      runs.splice(best, 1);
    }
    return runs;
  };

  /** Each run [a, b] → up ramp ending at a − lead, held at 1 to b, down ramp to b + down; then clipped to the span. */
  var runPivots = function (s, runs, floor, up, lead, down) {
    runs = mergeTo(runs, Math.floor(WA.MAX_PIVOTS / 4));
    var out = [];
    for (var i = 0; i < runs.length; i++) {
      var a = runs[i][0], b = runs[i][1];
      out.push({ t: a - lead - up, v: floor });
      out.push({ t: a - lead, v: 1, shape: 'hold' });
      out.push({ t: b, v: 1 });
      out.push({ t: b + down, v: floor, shape: 'hold' });
    }
    return clip(s, out);
  };

  /** The beats inside the span when they cover ≥ 70 % of it; else from the start every median beat gap of the song
      (0.5 s with no beats). */
  var beatGrid = function (s, beats) {
    var inside = [], grid, gap;
    for (var i = 0; i < beats.length; i++) if (beats[i] >= s.start && beats[i] < s.end) inside.push(beats[i]);
    var gIn = inside.length >= 2 ? median(gaps(inside)) : 0;
    if (inside.length >= 2 && inside.length * gIn >= 0.7 * (s.end - s.start)) return { grid: inside, gap: gIn };
    gap = beats.length >= 2 ? median(gaps(beats)) : 0.5;
    if (!(gap > 0)) gap = 0.5;
    grid = [];
    for (var k = 0; s.start + k * gap < s.end; k++) grid.push(s.start + k * gap);
    return { grid: grid, gap: gap };
  };

  /** The indices of the points (ts, vs) that draw them to within eps in v (Douglas-Peucker, distance measured
      straight up), the first and last always kept, and the indices in `pins` (ascending) when given. */
  var simplify = function (ts, vs, eps, pins) {
    var n = ts.length, mark = [], stack = [], i, a = 0;
    mark[0] = true; mark[n - 1] = true;
    for (i = 0; pins && i < pins.length; i++) if (pins[i] > a && pins[i] < n - 1) { mark[pins[i]] = true; stack.push([a, pins[i]]); a = pins[i]; }
    stack.push([a, n - 1]);
    while (stack.length) {
      var seg = stack.pop(), a = seg[0], b = seg[1], best = -1, bd = eps;
      for (i = a + 1; i < b; i++) {
        var line = vs[a] + ((vs[b] - vs[a]) * (ts[i] - ts[a])) / (ts[b] - ts[a]), dist = Math.abs(vs[i] - line);
        if (dist > bd) { bd = dist; best = i; }
      }
      if (best > 0) { mark[best] = true; stack.push([a, best], [best, b]); }
    }
    var out = [];
    for (i = 0; i < n; i++) if (mark[i]) out.push(i);
    return out;
  };

  // ---- the loudest moments --------------------------------------------

  /** Where a song's loudness for the climax comes from: the energy lane's 3 s curve, else pack.loudness, else null. */
  var climaxSource = function (song) {
    var e = song && song.energy, lo = song && song.loudness;
    if (e && e.shortTerm && e.shortTerm.length && e.hop > 0) return e;
    return lo && lo.values && lo.values.length && lo.hop > 0 ? lo : null;
  };
  var climaxCache = new WeakMap();
  /** The cache entry for a source and a smoothing: { lane, peaks: { 'gap:n': [...] } }. */
  var climaxEntry = function (src, smooth) {
    var all = climaxCache.get(src);
    if (!all) { all = {}; climaxCache.set(src, all); }
    return all[smooth] || (all[smooth] = { lane: null, peaks: {} });
  };

  /** The loudness that "Build to the climax" and the loudest moments read: { hop, values, start }, values[i] at song
      time start + i·hop, a centred mean over ±smooth s (1.5; the edges average what there is). With the pack's energy
      lane: its 3 s curve (pack.energy.shortTerm, sample i centred on (i + 0.5)·hop) on the loudness lane's scale
      (WA.energyCorrection, then WA.LOUD_DB), held at 0 below but not cut off at the top, so a long stretch at the
      lane's ceiling does not tie with a louder moment. Without: pack.loudness moved WA.LOUDNESS_LAG.mean earlier (it
      runs late; it stops at 1). null with neither. Kept per lane: do not change what it returns. */
  WA.climaxLane = function (song, o) {
    var smooth = o && o.smooth != null ? o.smooth : 1.5, src = climaxSource(song), raw = [], hop = src && src.hop, start, i;
    if (!src) return null;
    var entry = climaxEntry(src, smooth);
    if (entry.lane) return entry.lane;
    if (src === song.energy) {
      var db = src.shortTerm, c = WA.energyCorrection(src), LO = WA.LOUD_DB.lo, HI = WA.LOUD_DB.hi;
      start = 0.5 * hop;
      for (i = 0; i < db.length; i++) { var u = (db[i] + c - LO) / (HI - LO); raw.push(u > 0 ? u : 0); }   // NaN → 0
    } else {
      start = -WA.LOUDNESS_LAG.mean;
      for (i = 0; i < src.values.length; i++) raw.push(Number.isFinite(src.values[i]) ? src.values[i] : 0);
    }
    var n = raw.length, half = Math.round(smooth / hop), pre = [0], values = [];
    for (i = 0; i < n; i++) pre.push(pre[i] + raw[i]);
    for (i = 0; i < n; i++) { var a = Math.max(0, i - half), b = Math.min(n, i + half + 1); values.push((pre[b] - pre[a]) / (b - a)); }
    entry.lane = { hop: hop, values: values, start: start };
    return entry.lane;
  };

  /** The piece's loudest moments, as suggestions: the peaks of WA.climaxLane, each
      scored by its height × its prominence (how far it stands above the higher of the lowest points on either side
      before anything higher), the best first, at least `gap` s (20) apart, at most `n` (3). [{ t, v, score }]: t the
      song time (0 or later), v the lane's value there. Empty with no loudness. */
  WA.climaxes = function (song, o) {
    o = o || {};
    var lane = WA.climaxLane(song, o);
    if (!lane) return [];
    var gap = o.gap != null ? o.gap : 20, max = o.n != null ? o.n : 3;
    var entry = climaxEntry(climaxSource(song), o.smooth != null ? o.smooth : 1.5), key = gap + ':' + max, out = entry.peaks[key];
    if (!out) {
      var sm = lane.values, n = sm.length, peaks = [], i, j;
      for (i = 1; i < n - 1; i++) {
        if (!(sm[i] >= sm[i - 1] && sm[i] > sm[i + 1])) continue;
        var l = sm[i], r = sm[i];
        for (j = i - 1; j >= 0 && sm[j] <= sm[i]; j--) l = Math.min(l, sm[j]);
        for (j = i + 1; j < n && sm[j] <= sm[i]; j++) r = Math.min(r, sm[j]);
        peaks.push({ i: i, score: sm[i] * (sm[i] - Math.max(l, r)) });
      }
      peaks.sort(function (x, y) { return y.score - x.score || x.i - y.i; });
      out = [];
      for (j = 0; j < peaks.length && out.length < max; j++) {
        var t = lane.start + peaks[j].i * lane.hop, near = false;
        for (i = 0; i < out.length; i++) if (Math.abs(out[i].t - t) < gap) near = true;
        if (!near) out.push({ t: t, v: sm[peaks[j].i], score: peaks[j].score });
      }
      entry.peaks[key] = out;
    }
    return out.map(function (p) { return { t: Math.max(0, p.t), v: p.v, score: p.score }; });
  };

  WA.presets = {
    /** floor (0) at the section start, 1 after `seconds`. */
    fadeIn: function (s, seconds, o) {
      return [{ t: s.start, v: o && o.floor != null ? o.floor : 0 }, { t: Math.min(s.end, s.start + seconds), v: 1 }];
    },
    /** 1 until `seconds` before the end, floor (0) at the end. */
    fadeOut: function (s, seconds, o) {
      return [{ t: Math.max(s.start, s.end - seconds), v: 1 }, { t: s.end, v: o && o.floor != null ? o.floor : 0 }];
    },
    /** From floor to 1 over the whole span, slowly at first. */
    build: function (s, o) {
      return [{ t: s.start, v: o && o.floor != null ? o.floor : 0, bend: -0.45 }, { t: s.end, v: 1 }];
    },
    /** From 1 to floor over the whole span, quickly at first, with a long tail. */
    decay: function (s, o) {
      return [{ t: s.start, v: 1, bend: 0.45 }, { t: s.end, v: o && o.floor != null ? o.floor : 0 }];
    },
    /** 1, eased down to floor in the middle, eased back to 1. */
    dip: function (s, o) {
      var floor = o && o.floor != null ? o.floor : 0;
      return [{ t: s.start, v: 1, shape: 'ease' }, { t: (s.start + s.end) / 2, v: floor, shape: 'ease' }, { t: s.end, v: 1 }];
    },
    /** Up and down, eased, turning every `every`-th beat (the grid as in pulse). Too many turns for MAX_PIVOTS: fewer. */
    breathe: function (s, beats, o) {
      var every = Math.max(1, Math.round(o.every)), floor = o.floor != null ? o.floor : 0;
      var grid = beatGrid(s, beats).grid, f = 1, out = [], up = false;
      while (Math.ceil(grid.length / (every * f)) + 2 > WA.MAX_PIVOTS) f++;
      every *= f;
      if (grid.length && grid[0] > s.start) out.push({ t: s.start, v: floor, shape: 'ease' });
      for (var j = 0; j < grid.length; j += every) { out.push({ t: grid[j], v: up ? 1 : floor, shape: 'ease' }); up = !up; }
      if (!out.length || out[out.length - 1].t < s.end) out.push({ t: s.end, v: up ? 1 : floor });
      return out;
    },
    /** `n` even steps up from floor to 1. */
    steps: function (s, o) {
      var n = Math.max(1, Math.round(o.n)), floor = o.floor != null ? o.floor : 0, out = [];
      for (var i = 0; i < n; i++) out.push({ t: s.start + (i * (s.end - s.start)) / n, v: floor + ((1 - floor) * (i + 1)) / n, shape: 'hold' });
      out.push({ t: s.end, v: 1 });
      return out;
    },
    /** The same value all the way. */
    level: function (s, v) {
      return [{ t: s.start, v: v }, { t: s.end, v: v }];
    },
    /** floor, eased up to 1 at `peak` of the way through, eased down to floor at the end. */
    swell: function (s, o) {
      var peak = o && o.peak != null ? o.peak : 0.5, floor = o && o.floor != null ? o.floor : 0;
      return [{ t: s.start, v: floor, shape: 'ease' }, { t: s.start + peak * (s.end - s.start), v: 1, shape: 'ease' },
        { t: s.end, v: floor }];
    },
    /** 1 at every `every`-th beat, falling linearly to floor over `duty` of the period, then held. The grid is the
        beats inside the span when they cover ≥ 70 % of it; else from the start every median beat gap of the song
        (0.5 s with no beats). Too many pulses for MAX_PIVOTS: `every` is multiplied by the smallest factor that fits. */
    pulse: function (s, beats, o) {
      var every = Math.max(1, Math.round(o.every)), floor = o.floor != null ? o.floor : 0;
      var duty = o.duty != null ? o.duty : 0.5, g = beatGrid(s, beats), grid = g.grid, gap = g.gap;
      var count = function (e) { return Math.ceil(grid.length / e); };
      var f = 1;
      while (2 * count(every * f) + 1 > WA.MAX_PIVOTS) f++;
      every *= f;
      var T = every * gap, out = [];
      var pts = [];
      for (var j = 0; j < grid.length; j += every) pts.push(grid[j]);
      if (pts.length && pts[0] > s.start) out.push({ t: s.start, v: floor, shape: 'hold' });
      for (var m = 0; m < pts.length; m++) {
        var p = pts[m], next = m + 1 < pts.length ? pts[m + 1] : Infinity;
        out.push({ t: p, v: 1 });
        out.push({ t: Math.min(p + duty * T, next, s.end), v: floor, shape: 'hold' });
      }
      return out;
    },
    /** Open where the curve (sample i covers [i·hop, (i+1)·hop)) is ≥ above, closed below above − 0.05. In this
        order: runs under 0.25 s dropped and gaps under 0.5 s bridged, both on the lane, where its own wobble is;
        then each run moved back to the sound, opening o.lag.open and closing o.lag.close earlier (default
        LOUDNESS_LAG, for pack.loudness, which runs late; the zero-lag energy lane passes { open: 0, close: 0 })
        (a run still open where the lane ends keeps its end); its start held at 0 or later; a run left shorter than
        0.25 s keeps 0.25 s from its start, so a short burst still shows. Then it opens 0.15 s early with 0.1 s
        ramps; clipped to the span. */
    gate: function (s, curve, o) {
      var above = o.above, floor = o.floor != null ? o.floor : 0, hop = curve.hop, vals = curve.values;
      var runs = [], open = false, a = 0;
      for (var i = 0; i < vals.length; i++) {
        var v = vals[i];
        if (!open && v >= above) { open = true; a = i * hop; }
        else if (open && v < above - 0.05) { open = false; runs.push([a, i * hop]); }
      }
      var end = vals.length * hop, lag = o.lag || WA.LOUDNESS_LAG;
      if (open) runs.push([a, end]);
      runs = runs.filter(function (r) { return r[1] - r[0] >= 0.25; });
      runs = bridge(runs, 0.5).map(function (r) {
        var a2 = Math.max(0, r[0] - lag.open), b2 = r[1] >= end ? r[1] : r[1] - lag.close;
        return [a2, Math.max(b2, a2 + 0.25)];
      });
      // Moved runs keep their gaps of 0.5 s or more, except near the song start, where holding the starts at 0 can
      // make two runs overlap: bridged again, which changes nothing anywhere else.
      runs = bridge(runs, 0.5).filter(function (r) { return r[1] + 0.1 > s.start && r[0] - 0.25 < s.end; });
      return runPivots(s, runs, floor, 0.1, 0.15, 0.1);
    },
    /** Rises and falls with the loudness curve over the span, as linear pivots from floor (0.35) to 1. The curve is
        read `lead` seconds ahead (LOUDNESS_LAG.open: it runs late; held at its last value past its end), one sample a
        hop; it climbs with a time constant of `up` (0.2 s) and falls with `down` (0.8 s); the span's own 5th to 95th
        percentile is stretched to floor..1 (a range under 0.1 counts as 0.1 from its top, so a flat span is all 1); then as few pivots as draw it to within 0.02,
        loosened until at most `maxPivots` (248) are left. t to 0.01 s, v to 0.001; the span's ends exact. Empty with
        no curve or an empty span. */
    follow: function (s, curve, o) {
      o = o || {};
      var floor = o.floor != null ? o.floor : 0.35, up = o.up != null ? o.up : 0.2, down = o.down != null ? o.down : 0.8;
      var lead = o.lead != null ? o.lead : WA.LOUDNESS_LAG.open, max = Math.max(2, o.maxPivots != null ? o.maxPivots : WA.MAX_PIVOTS - 8);
      var hop = curve && curve.hop, vals = curve && curve.values;
      if (!vals || !vals.length || !(hop > 0) || !(s.end > s.start)) return [];
      var ts = [], xs = [], i, t;
      for (i = 0; (t = s.start + i * hop) < s.end - 1e-9; i++) ts.push(t);
      ts.push(s.end);
      for (i = 0; i < ts.length; i++) {
        var k = Math.floor((ts[i] + lead) / hop + 1e-9);
        var x = vals[k < 0 ? 0 : k < vals.length ? k : vals.length - 1];
        xs.push(Number.isFinite(x) ? x : 0);
      }
      var ys = [xs[0]];   // the follower starts where the curve is
      for (i = 1; i < xs.length; i++) {
        var y = ys[i - 1], tau = xs[i] > y ? up : down, dt = ts[i] - ts[i - 1];
        ys.push(tau > 0 ? y + (xs[i] - y) * (1 - Math.exp(-dt / tau)) : xs[i]);
      }
      var sorted = ys.slice().sort(function (p, q) { return p - q; }), n = sorted.length;
      var lo = sorted[Math.floor(0.05 * (n - 1))], hi = sorted[Math.floor(0.95 * (n - 1))];
      // A calm span is not stretched: its range counts as at least 0.1 (about 4 dB), measured down from its top, so a
      // wobble of a dB or two stays near 1 instead of pumping from floor to 1.
      if (hi - lo < 0.1) lo = hi - 0.1;
      var vs = ys.map(function (y) { return floor + (1 - floor) * clamp01((y - lo) / (hi - lo)); });
      var eps = 0.02, keep = simplify(ts, vs, eps);
      while (keep.length > max) { eps *= 1.5; keep = simplify(ts, vs, eps); }
      var out = [];
      for (i = 0; i < keep.length; i++) {
        var j = keep[i], last = i === keep.length - 1;
        t = i === 0 ? s.start : last ? s.end : Math.min(s.end, Math.max(s.start, Math.round(ts[j] * 100) / 100));
        if (out.length && t <= out[out.length - 1].t) { if (!last) continue; out.pop(); }
        out.push({ t: t, v: Math.round(vs[j] * 1000) / 1000 });
      }
      return out;
    },
    /** Builds to the strongest climax in the span and settles after it, as linear pivots (floor 0.35 to 1). curve: a
        lane like WA.climaxLane's ({ hop, values, start }, values[i] at start + i·hop, start 0 when absent), read
        linearly between samples, held past its ends. The peak: the first of o.peaks (WA.climaxes, the best first)
        inside the span, else the span's loudest point. From the span's start it holds at floor up to the quietest
        point before the peak; from there it grows with the loudness and never falls back (the loudest so far,
        stretched so that quietest point is floor and the peak is 1); it stays at 1 while the sound stays within 0.05
        of the peak, at most `hold` s (4); it settles to floor over `settle` s (3) and holds there to the span's end.
        No dip before the peak. Then as few pivots as draw it to within 0.02, loosened until at most `maxPivots` (248)
        are left, always keeping the turns (the peak, the end of the top, the end of the settling) when there is room
        for them; t to 0.01 s, v to 0.001; the span's ends exact. Empty with no curve, an empty span, or a span whose
        loudness moves less than 0.1 (nothing to build to). */
    toClimax: function (s, curve, o) {
      o = o || {};
      var floor = o.floor != null ? o.floor : 0.35, hold = o.hold != null ? o.hold : 4, settle = o.settle != null ? o.settle : 3;
      var max = Math.max(2, o.maxPivots != null ? o.maxPivots : WA.MAX_PIVOTS - 8);
      var hop = curve && curve.hop, vals = curve && curve.values, t0 = (curve && curve.start) || 0;
      if (!vals || !vals.length || !(hop > 0) || !(s.end > s.start)) return [];
      var at = function (t) {
        var x = (t - t0) / hop, n = vals.length, v;
        if (!(x > 0)) v = vals[0];
        else if (x >= n - 1) v = vals[n - 1];
        else { var k = Math.floor(x); v = vals[k] + (vals[k + 1] - vals[k]) * (x - k); }
        return Number.isFinite(v) ? v : 0;
      };
      var ts = [s.start], us, i, t;
      for (i = Math.max(0, Math.floor((s.start - t0) / hop)); (t = t0 + i * hop) < s.end - 1e-9; i++) if (t > s.start + 1e-9) ts.push(t);
      ts.push(s.end);
      us = ts.map(at);
      var lo = Infinity, hi = -Infinity, top = 0;
      for (i = 0; i < us.length; i++) { if (us[i] < lo) lo = us[i]; if (us[i] > hi) { hi = us[i]; top = i; } }
      if (hi - lo < 0.1) return [];
      var tp = null, peaks = o.peaks || [];
      for (i = 0; i < peaks.length && tp === null; i++) if (peaks[i].t >= s.start && peaks[i].t <= s.end) tp = peaks[i].t;
      if (tp === null) tp = ts[top];
      var up = at(tp), tl = s.start, ul = up, te = tp;
      for (i = 0; i < ts.length && ts[i] < tp; i++) if (us[i] < ul) { ul = us[i]; tl = ts[i]; }
      for (i = 0; i < ts.length; i++) {
        if (ts[i] <= tp) continue;
        if (us[i] < up - 0.05) break;
        te = Math.min(ts[i], tp + hold);
        if (ts[i] >= tp + hold) break;
      }
      // The turns get pivots of their own: the peak, the end of the top, the end of the settling.
      [tp, te, te + settle].forEach(function (x) { if (x > s.start && x < s.end) ts.push(x); });
      ts.sort(function (p, q) { return p - q; });
      ts = ts.filter(function (x, k) { return k === 0 || x > ts[k - 1] + 1e-9; });
      var vs = [], run = ul, rise = up - ul;
      for (i = 0; i < ts.length; i++) {
        t = ts[i];
        if (t >= tp - 1e-9 && t <= te + 1e-9) { vs.push(1); continue; }
        if (t > te) { vs.push(t < te + settle ? 1 - ((1 - floor) * (t - te)) / settle : floor); continue; }
        if (t <= tl) { vs.push(floor); continue; }
        var u = at(t);
        if (u > run) run = u;
        vs.push(rise > 0 ? floor + (1 - floor) * clamp01((run - ul) / rise) : 1);
      }
      // The turns stay through the simplifying, so the curve always reaches 1. With too few pivots for them, they go.
      var pins = [], near = function (x, y) { return Math.abs(x - y) <= 1e-9; };
      for (i = 1; i < ts.length - 1; i++) if (near(ts[i], tp) || near(ts[i], te) || near(ts[i], te + settle)) pins.push(i);
      var eps = 0.02, keep = simplify(ts, vs, eps, pins);
      while (keep.length > max && eps < 4) { eps *= 1.5; keep = simplify(ts, vs, eps, pins); }
      if (keep.length > max) { pins = []; eps = 0.02; keep = simplify(ts, vs, eps); while (keep.length > max) { eps *= 1.5; keep = simplify(ts, vs, eps); } }
      var out = [];
      for (i = 0; i < keep.length; i++) {
        var j = keep[i], last = i === keep.length - 1;
        t = i === 0 ? s.start : last ? s.end : Math.min(s.end, Math.max(s.start, Math.round(ts[j] * 100) / 100));
        if (out.length && t <= out[out.length - 1].t) { if (!last && (pins.indexOf(j) < 0 || out.length < 2)) continue; out.pop(); }
        out.push({ t: t, v: Math.round(vs[j] * 1000) / 1000 });
      }
      return out;
    },
    /** Open while the notes that meet the span sound (gaps under 1 s bridged), 0.2 s ramps, clipped to the span. */
    plays: function (s, notes, o) {
      var floor = o && o.floor != null ? o.floor : 0;
      var spans = [];
      for (var i = 0; i < notes.length; i++) {
        var a = notes[i][0], b = notes[i][1];
        if (b > a && b > s.start && a < s.end) spans.push([a, b]);
      }
      spans.sort(function (x, y) { return x[0] - y[0]; });
      var runs = [];
      for (var j = 0; j < spans.length; j++) {
        var last = runs[runs.length - 1];
        if (last && spans[j][0] <= last[1]) { if (spans[j][1] > last[1]) last[1] = spans[j][1]; }
        else runs.push([spans[j][0], spans[j][1]]);
      }
      return runPivots(s, bridge(runs, 1), floor, 0.2, 0, 0.2);
    },
  };
})(typeof WA !== 'undefined' ? WA : (globalThis.WA_LAYERS ??= {}));
