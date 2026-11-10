// Where a layer is seen: the region's box in device pixels, the feather's
// alpha profile, the glide across a section boundary, the window's fit, and the soft mask, built with canvas
// operations only (no filter, no pixel reads) once per region change.
//
// A region's centre and size are fractions of the canvas, so they mean the same at any scale. The mask is a canvas the
// size of the region's unrotated box: the compositor (slot.js) draws it rotated about the box's centre.
//
// One implementation: the lab loads this file as a classic <script>; the studio and Node evaluate the same text with
// new Function('WA', src) (src/widgets/layers.ts). It reads WA.vis (persist.js) only when a mask is built.
(function (WA) {
  'use strict';

  var DEFAULT_FEATHER = 0.25;
  var GRID = 16;   // uniform gradient stops across the feather band, besides the vis table's nodes

  function clamp01(v) { return v > 0 ? (v < 1 ? v : 1) : 0; }   // NaN → 0

  /** The region's box in device pixels: centre, unrotated size, rotation in radians. */
  WA.regionBox = function (r, cw, ch) {
    return { cx: r.x * cw, cy: r.y * ch, w: r.w * cw, h: r.h * ch, rot: (r.rot || 0) * Math.PI / 180 };
  };

  /** The mask's alpha at d (0 the centre … 1 the edge, as a fraction of the half-size): 1 inside the feather band
      [1 − feather, 1], 0 at and beyond the edge, linear across the band. Feather 0 is a step at the edge. */
  WA.featherAlpha = function (d, feather) {
    var f = clamp01(feather);
    if (d >= 1) return 0;
    if (d <= 1 - f) return 1;
    return (1 - d) / f;
  };

  /** The gradient stops [d, alpha] the mask bakes, sorted by d: the feather band sampled evenly, plus the d of each
      node of the vis table, so the 'redraw' profile (vis ∘ featherAlpha, piecewise linear) is exact. Empty for a hard
      edge. */
  WA.maskStops = function (feather, cls) {
    var f = clamp01(feather);
    if (f <= 0) return [];
    var ds = [], i;
    for (i = 0; i <= GRID; i++) ds.push(i === GRID ? 1 : 1 - f + f * i / GRID);
    if (cls !== 'strokes') for (i = 0; i < WA.VIS_REDRAW.length; i++) ds.push(1 - f * WA.VIS_REDRAW[i][0]);
    ds.sort(function (a, b) { return a - b; });
    var out = [];
    for (i = 0; i < ds.length; i++) {
      var d = ds[i];
      if (out.length && d - out[out.length - 1][0] < 1e-9) continue;
      var a = WA.featherAlpha(d, f);
      out.push([d, cls === 'strokes' ? a : WA.vis(a, 'redraw')]);
    }
    return out;
  };

  /** From region a to region b at u (0..1, clamped), smoothstep on x, y, w, h, rot and feather; mode, shape, blend and
      fit are b's. A change of mode is a cut: b at once. rot and feather glide from their defaults (0, 0.25) when one
      side lacks them, and stay absent when both do. At u = 1 the geometry is b's exactly. */
  WA.glideRegion = function (a, b, u) {
    var out = {}, k;
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
    if (a.mode !== b.mode) return out;
    var s = clamp01(u);
    s = s * s * (3 - 2 * s);
    var mix = function (p, q) { return p * (1 - s) + q * s; };
    out.x = mix(a.x, b.x); out.y = mix(a.y, b.y); out.w = mix(a.w, b.w); out.h = mix(a.h, b.h);
    if (a.rot !== undefined || b.rot !== undefined) {
      // The short way round: 170° → −170° turns 20°, not 340° (more than half a turn apart, b is taken a turn closer).
      var r0 = a.rot || 0, r1 = b.rot || 0;
      if (r1 - r0 > 180) r1 -= 360; else if (r0 - r1 > 180) r1 += 360;
      out.rot = s >= 1 ? (b.rot || 0) : mix(r0, r1);
    }
    if (a.feather !== undefined || b.feather !== undefined) {
      out.feather = mix(a.feather === undefined ? DEFAULT_FEATHER : a.feather, b.feather === undefined ? DEFAULT_FEATHER : b.feather);
    }
    return out;
  };

  /** The source rect in a window's layer canvas (cw × ch, the main canvas's size) that fills the region's box.
      cover (the default): crop the canvas to the box's aspect, centred. contain: the whole canvas, centred in a
      source rect larger than it (the parts outside the canvas draw nothing: letterbox bars). stretch: the canvas. */
  WA.fitRect = function (r, cw, ch) {
    var fit = r.fit || 'cover';
    var box = r.h * ch, aspect = box > 0 ? (r.w * cw) / box : NaN;
    if (fit === 'stretch' || !(aspect > 0) || !isFinite(aspect)) return { sx: 0, sy: 0, sw: cw, sh: ch };
    var wide = aspect > cw / ch;   // the box is wider than the canvas
    if ((fit === 'cover') !== wide) {
      var sw = ch * aspect;        // full height
      return { sx: (cw - sw) / 2, sy: 0, sw: sw, sh: ch };
    }
    var sh = cw / aspect;          // full width
    return { sx: 0, sy: (ch - sh) / 2, sw: cw, sh: sh };
  };

  function white(a) { return 'rgba(255,255,255,' + a + ')'; }

  /** The region's soft mask: a canvas the size of its unrotated box (at least 1 × 1), white with the mask in alpha.
      An ellipse is a radial gradient in a unit circle scaled to the box, so its band is the feather's fraction of each
      half-axis. A rect is filled and then multiplied (destination-in) by four linear-gradient edges, each a band of
      feather × the smaller half-size. The stops follow featherAlpha; for cls 'redraw' (any class but 'strokes') the
      profile goes through vis before it is baked, so a soft edge looks soft on a persistent canvas too. */
  WA.buildMask = function (r, cw, ch, cls, make) {
    var box = WA.regionBox(r, cw, ch);
    var W = Math.max(1, Math.round(Math.abs(box.w))), H = Math.max(1, Math.round(Math.abs(box.h)));
    var c = make(W, H), g = c.getContext('2d');
    var stops = WA.maskStops(r.feather === undefined ? DEFAULT_FEATHER : r.feather, cls);
    var i, grad;
    g.save();
    g.fillStyle = '#fff';
    if (r.shape === 'ellipse') {
      if (!stops.length) {
        g.beginPath(); g.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, 2 * Math.PI); g.fill();
      } else {
        g.setTransform(W / 2, 0, 0, H / 2, W / 2, H / 2);
        grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        for (i = 0; i < stops.length; i++) grad.addColorStop(stops[i][0], white(stops[i][1]));
        g.fillStyle = grad;
        g.fillRect(-1, -1, 2, 2);
      }
    } else {
      g.fillRect(0, 0, W, H);
      if (stops.length) {
        var f = 1 - stops[0][0], band = f * Math.min(W, H) / 2;
        // Each edge's gradient runs from the edge (offset 0, d = 1) to the inner end of the band (offset 1, d = 1 − f).
        var edges = [[0, 0, band, 0], [W, 0, W - band, 0], [0, 0, 0, band], [0, H, 0, H - band]];
        g.globalCompositeOperation = 'destination-in';
        for (var e = 0; e < 4; e++) {
          var p = edges[e];
          grad = g.createLinearGradient(p[0], p[1], p[2], p[3]);
          for (i = stops.length - 1; i >= 0; i--) grad.addColorStop(clamp01((1 - stops[i][0]) / f), white(stops[i][1]));
          g.fillStyle = grad;
          g.fillRect(0, 0, W, H);
        }
      }
    }
    g.restore();
    return c;
  };
})(typeof WA !== 'undefined' ? WA : (globalThis.WA_LAYERS ??= {}));
