// How visible a layer is at an intensity: the paste weight that shows a wanted fraction of it. On the persistent, fading canvas a paste weight is not an opacity: content redrawn every frame settles
// near m·P / (0.12 + 0.88·m), so the 'redraw' class (the default) maps through the measured table, the mean of the
// two measured ground rows. A widget whose newest stroke is linear in the weight is 'strokes': vis(a) = a.
// PERSIST names each widget's class.
//
// One implementation: the lab loads this file as a classic <script>; the studio and Node evaluate the same text with
// new Function('WA', src) (src/widgets/layers.ts).
(function (WA) {
  'use strict';

  /** [visible fraction, paste weight], piecewise linear. */
  WA.VIS_REDRAW = [[0, 0], [0.1, 0.044], [0.25, 0.069], [0.5, 0.15], [0.75, 0.31], [0.9, 0.561], [1, 1]];

  WA.PERSIST = {
    // r = brightness at slot weight 0.25 ÷ at 1 (prelude 120, b5 0, 5 s); r ≥ 0.5 → redraw
    "timeslice": 'redraw',          // r 1.00
    "fold": 'redraw',               // r 1.00
    "stella": 'redraw',             // r 1.00
    "fischinger": 'redraw',         // r 0.64
    "mclaren": 'redraw',            // r 0.63
    "lenlye": 'redraw',             // r 0.51
    "klee": 'redraw',               // r 0.60
    "miro": 'redraw',               // r 0.71
    "lewitt": 'redraw',             // r 0.72
    "ridges": 'redraw',             // r 0.56
    "matisse": 'redraw',            // r 0.71
    "kusama": 'redraw',             // r 0.69
    "ikeda": 'redraw',              // r 0.77
    "horizon": 'redraw',            // r 0.66
    "harmonograph": 'redraw',       // r 0.59
    "kline": 'redraw',              // r 0.60
    "score": 'redraw',              // r 0.71
    "boogie": 'redraw',             // r 0.71
    "cells": 'redraw',              // r 0.52
    "nebula": 'strokes',            // r 0.26
    "pixelsort": 'redraw',          // r 1.00
    "mandala": 'redraw',            // r 0.59
    "murmuration": 'strokes',       // r 0.47
    "marbling": 'redraw',           // r 0.62
    "kandinsky": 'strokes',         // r 0.48
    "rorschach": 'strokes',         // r 0.34
    "squares": 'strokes',           // r 0.46
    "flee": 'strokes',              // r 0.32
    "current": 'strokes',           // r 0.17
    "strings": 'strokes',           // r 0.35
    "fields": 'redraw',             // r 0.58
    "brush": 'redraw',              // r 0.57
    "blocks": 'strokes',            // r 0.29
    "riley": 'redraw',              // r 0.66
    "halftone": 'redraw',           // r 0.54
    "fifths": 'redraw',             // r 0.62
    "suprematism": 'strokes',       // r 0.40
    "contours": 'redraw',           // r 0.51
    "tunnel": 'strokes',            // r 0.31
    "scribble": 'redraw',           // r 0.67
    "pointillism": 'strokes',       // r 0.35
    "casket": 'strokes',            // r 0.31
  };

  /** The paste weight that shows a fraction a (clamped to 0..1) of a layer of class cls ('strokes', else 'redraw'). */
  WA.vis = function (a, cls) {
    a = a > 0 ? (a < 1 ? a : 1) : 0;   // NaN → 0
    if (cls === 'strokes') return a;
    var T = WA.VIS_REDRAW, i = 0;
    while (i < T.length - 2 && T[i + 1][0] <= a) i++;   // the last node at or below a (a node is hit at u = 0)
    var x0 = T[i][0], y0 = T[i][1], x1 = T[i + 1][0], y1 = T[i + 1][1];
    if (a === x0) return y0;
    if (a === x1) return y1;
    return y0 + (y1 - y0) * (a - x0) / (x1 - x0);
  };
})(typeof WA !== 'undefined' ? WA : (globalThis.WA_LAYERS ??= {}));
