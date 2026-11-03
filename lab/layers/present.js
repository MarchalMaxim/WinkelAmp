// How present (the user, 2026-11-02: "how much 'stuff' is produced by the slider"): a widget's knob marked `leads` draws
// nothing itself. Moving it writes the widget's other knobs, those that declare `less`: the knob's value when the widget
// makes the least, at the slider's left end. At the right end it is the knob's own `value`, so a slider left at 1 is the
// widget as it always was. A knob moved by hand holds until the slider next moves. What moves is the base only: a knob's
// drive stays. Saved values are ordinary knob values, so the runtime knows nothing of this.
//
// On the graph (a clip's intensityMoves, issue 6): the slider is the ceiling and the intensity curve a share of it. Each
// knob goes from its least to where it is set, so a knob set by hand is the top of its own range and nothing saved is
// overwritten. A slider the widget reads itself (no knob follows it) goes down to its minimum.
//
// One implementation: the lab loads this file as a classic <script>; the studio and Node evaluate the same text with
// new Function('WA', src) (src/widgets/layers.ts).
(function (WA) {
  'use strict';

  /** v on the knob's step, in its range. */
  var onStep = function (q, v) {
    var step = q.step || (q.max - q.min) / 1000;
    v = q.min + Math.round((v - q.min) / step) * step;
    return Number(Math.max(q.min, Math.min(q.max, v)).toFixed(6));
  };

  /** { key: base } for every knob that follows the slider, at slider value s (0..1): on the knob's step, in its range. */
  WA.presentValues = function (params, s) {
    var out = {}, u = s > 0 ? (s < 1 ? s : 1) : 0;
    for (var i = 0; i < (params || []).length; i++) {
      var q = params[i];
      if (typeof q.less !== 'number') continue;
      if (u === 1) { out[q.key] = q.value; continue; }
      out[q.key] = onStep(q, q.less + (q.value - q.less) * u);
    }
    return out;
  };

  /** { key: base } for every knob the graph moves, at graph value g (0..1). now: the bases as set, { key: number }; a knob
      not in it is at its own value. At g = 1 every knob is as set. A knob set beyond its least holds: a falling graph never
      makes more. */
  WA.presentAt = function (params, now, g) {
    var out = {}, u = g > 0 ? (g < 1 ? g : 1) : 0;
    for (var i = 0; i < (params || []).length; i++) {
      var q = params[i], from = typeof q.less === 'number' ? q.less : q.key === 'presence' && !q.leads ? q.min : null;
      if (from === null) continue;
      var set = now && typeof now[q.key] === 'number' ? now[q.key] : q.value;
      out[q.key] = u === 1 || (q.value - from) * (set - from) <= 0 ? set : onStep(q, from + (set - from) * u);
    }
    return out;
  };
})(typeof WA !== 'undefined' ? WA : (globalThis.WA_LAYERS ??= {}));
