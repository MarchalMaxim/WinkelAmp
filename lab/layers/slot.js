// One layered slot (plan §6, spec Decisions 4 and 7): the attacks an instance hears (its own part's chords when it is
// routed, thinned by its intensity curve), its own pulse, and how visible it is (the paste weight vis(a) × the slot's
// weight), then the runtime's per-slot statements with that weight. A slot with no layer whose instance keeps no pulse
// of its own never comes here: the hosts run today's statements for it. Regions come with T15.
//
// One implementation: the lab loads this file as a classic <script>; the studio and Node evaluate the same text with
// new Function('WA', src) (src/widgets/layers.ts). It needs automation.js, lines.js and persist.js on WA first (file
// names load in sorted order, and the lab loads them before it).
(function (WA) {
  'use strict';

  /** A fresh pulse's features: src/widgets/features.ts newFeatures. */
  WA.newFeatures = function () { return { level: 0, rate: 0, pitch: 0.5, bass: 0, density: 0 }; };

  /** An instance starting cold at song time t, as after a seek: the next attack it hears is its first chord after t, its
      pulse is 0 and its features fresh. The hosts call it on every reset and when an own instance comes back after a
      step without a slot, so play and a seek to the same time disagree no more than they do today. */
  WA.coldInstance = function (inst, t) {
    var cs = inst.chords, i = 0;
    while (i < cs.length && cs[i].t <= t) i++;
    inst.ci = i;
    inst.pulse.level = 0; inst.pulse.rate = 0;
    var f = WA.newFeatures();
    for (var k in f) inst.feat[k] = f[k];
  };

  /** The attacks a layered slot hears this step: the instance's own chords crossing (lastT, t] when it is routed, else
      the step's fired chords; with a curve, only those that pass at their own time's intensity. */
  WA.deliveredChords = function (s) {
    var inst = s.inst, L = s.layer || {}, piv = L.pivots && L.pivots.length ? L.pivots : null;
    var src;
    if (inst.routed) {
      src = [];
      while (inst.ci < inst.chords.length && inst.chords[inst.ci].t <= s.t) src.push(inst.chords[inst.ci++]);
    } else src = s.fired;
    if (!piv) return src;
    var until = L.until !== undefined ? L.until : Infinity, out = [];
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      if (WA.passes(ch.t, WA.automationAt(piv, Math.min(ch.t, until)), inst.salt)) out.push(ch);
    }
    return out;
  };

  /** The paste weight of a layered slot at its time: weight × vis(a) with a curve, else the weight. */
  WA.layerWeight = function (s) {
    var L = s.layer || {}, piv = L.pivots && L.pivots.length ? L.pivots : null;
    if (!piv) return s.weight;
    var until = L.until !== undefined ? L.until : Infinity;
    return s.weight * WA.vis(WA.automationAt(piv, Math.min(s.t, until)), s.inst.persist);
  };

  /** One layered slot: delivered attacks, the own pulse, the weight, then the runtime's per-slot statements with them
      (snapshot when w < 1, onChord if receiving, save/frame/restore, the four resets, the paste-back at 1 − w). The
      frame runs at weight 0 too, so the widget's state is right when it comes back. h.call swaps the instance's pulse,
      features and notes into ctx around each call. */
  WA.drawLayered = function (h, s) {
    var inst = s.inst, g = h.g;
    var delivered = WA.deliveredChords(s);
    if (inst.own) WA.advancePulse(inst.pulse, inst.feat, delivered, WA.soundingAt(inst.notes, s.t), s.dt);
    var w = WA.layerWeight(s);
    var sc = null;
    if (w < 1) {
      sc = h.scratch();
      var sg = sc.getContext('2d');
      sg.globalCompositeOperation = 'copy'; sg.drawImage(h.canvas, 0, 0); sg.globalCompositeOperation = 'source-over';
    }
    if (s.receiving) for (var i = 0; i < delivered.length; i++) h.call(inst, 'onChord', delivered[i]);
    g.save(); h.call(inst, 'frame'); g.restore();
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none'; g.shadowBlur = 0;
    if (sc) {
      if (h.S > 1) g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1 - Math.max(0, w); g.drawImage(sc, 0, 0); g.globalAlpha = 1;
    }
  };
})(typeof WA !== 'undefined' ? WA : (globalThis.WA_LAYERS ??= {}));
