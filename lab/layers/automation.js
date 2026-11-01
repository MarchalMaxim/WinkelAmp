// Intensity curves (plan §2, spec Decisions 4 and 5): the curve through a layer's pivots, the deterministic thinning
// that decides which attacks a layer hears, and the presets that write ordinary pivots into a section.
//
// One implementation: the lab loads this file as a classic <script>; the studio and Node evaluate the same text with
// new Function('WA', src) (src/widgets/layers.ts). No randomness: thinning is FNV-1a, so playing, seeking, a paused
// preview and a render all agree.
(function (WA) {
  'use strict';

  /** At most this many pivots per layer per section; the presets merge further to stay under. */
  WA.MAX_PIVOTS = 256;

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

  /** Whether an attack at t reaches a layer of intensity a: a fixed fraction a of the attacks, the same ones every time.
      FNV-1a over the 8 bytes (salt LE, round(t·1000) LE as uint32). */
  WA.passes = function (t, a, salt) {
    if (a >= 1) return true;
    if (!(a > 0)) return false;
    var h = OFFSET, x = salt >>> 0, y = Math.round(t * 1000) >>> 0, i;
    for (i = 0; i < 4; i++) { h ^= (x >>> (8 * i)) & 0xff; h = Math.imul(h, PRIME); }
    for (i = 0; i < 4; i++) { h ^= (y >>> (8 * i)) & 0xff; h = Math.imul(h, PRIME); }
    return (h >>> 0) / 4294967296 < a;
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

  WA.presets = {
    /** 0 at the section start, 1 after `seconds`. */
    fadeIn: function (s, seconds) {
      return [{ t: s.start, v: 0 }, { t: Math.min(s.end, s.start + seconds), v: 1 }];
    },
    /** 1 until `seconds` before the end, 0 at the end. */
    fadeOut: function (s, seconds) {
      return [{ t: Math.max(s.start, s.end - seconds), v: 1 }, { t: s.end, v: 0 }];
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
      var duty = o.duty != null ? o.duty : 0.5, len = s.end - s.start;
      var inside = [];
      for (var i = 0; i < beats.length; i++) if (beats[i] >= s.start && beats[i] < s.end) inside.push(beats[i]);
      var grid, gap;
      var gIn = inside.length >= 2 ? median(gaps(inside)) : 0;
      if (inside.length >= 2 && inside.length * gIn >= 0.7 * len) { grid = inside; gap = gIn; }
      else {
        gap = beats.length >= 2 ? median(gaps(beats)) : 0.5;
        if (!(gap > 0)) gap = 0.5;
        grid = [];
        for (var k = 0; s.start + k * gap < s.end; k++) grid.push(s.start + k * gap);
      }
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
    /** Open where the curve (sample i covers [i·hop, (i+1)·hop)) is ≥ above, closed below above − 0.05; runs
        under 0.25 s dropped, then gaps under 0.5 s bridged; opens 0.15 s early with 0.1 s ramps; clipped to the span. */
    gate: function (s, curve, o) {
      var above = o.above, floor = o.floor != null ? o.floor : 0, hop = curve.hop, vals = curve.values;
      var runs = [], open = false, a = 0;
      for (var i = 0; i < vals.length; i++) {
        var v = vals[i];
        if (!open && v >= above) { open = true; a = i * hop; }
        else if (open && v < above - 0.05) { open = false; runs.push([a, i * hop]); }
      }
      if (open) runs.push([a, vals.length * hop]);
      runs = runs.filter(function (r) { return r[1] - r[0] >= 0.25; });
      runs = bridge(runs, 0.5).filter(function (r) { return r[1] + 0.1 > s.start && r[0] - 0.25 < s.end; });
      return runPivots(s, runs, floor, 0.1, 0.15, 0.1);
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
