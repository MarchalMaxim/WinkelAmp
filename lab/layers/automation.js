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

  /** How late the song's loudness lane (pack.loudness) runs behind the sound, in seconds. It is an average of power
      looking only backwards, so it rises sooner than it falls. Measured 2026-11-08 on six pieces against the sound's
      own energy (docs/research/audio-to-picture.md): it crosses upwards about 1.1 s late and downwards about 2.4 s
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
      straight up), the first and last always kept. */
  var simplify = function (ts, vs, eps) {
    var n = ts.length, mark = [], stack = [[0, n - 1]], i;
    mark[0] = true; mark[n - 1] = true;
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
        then each run moved back to the sound, opening LOUDNESS_LAG.open and closing LOUDNESS_LAG.close earlier
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
      var end = vals.length * hop, lag = WA.LOUDNESS_LAG;
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
