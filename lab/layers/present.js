// How present (the user, 2026-11-02: "how much 'stuff' is produced by the slider"): a widget's knob marked `leads` draws
// nothing itself. Moving it writes the widget's other knobs, those that declare `less`: the knob's value when the widget
// makes the least, at the slider's left end. At the right end it is the knob's own `value`, so a slider left at 1 is the
// widget as it always was. A knob moved by hand holds until the slider next moves. What moves is the base only: a knob's
// drive stays. Saved values are ordinary knob values, so the runtime knows nothing of this.
//
// One implementation: the lab loads this file as a classic <script>; the studio and Node evaluate the same text with
// new Function('WA', src) (src/widgets/layers.ts).
(function (WA) {
  'use strict';

  /** { key: base } for every knob that follows the slider, at slider value s (0..1): on the knob's step, in its range. */
  WA.presentValues = function (params, s) {
    var out = {}, u = s > 0 ? (s < 1 ? s : 1) : 0;
    for (var i = 0; i < (params || []).length; i++) {
      var q = params[i];
      if (typeof q.less !== 'number') continue;
      if (u === 1) { out[q.key] = q.value; continue; }
      var v = q.less + (q.value - q.less) * u, step = q.step || (q.max - q.min) / 1000;
      v = q.min + Math.round((v - q.min) / step) * step;
      v = Math.max(q.min, Math.min(q.max, v));
      out[q.key] = Number(v.toFixed(6));
    }
    return out;
  };
})(typeof WA !== 'undefined' ? WA : (globalThis.WA_LAYERS ??= {}));
