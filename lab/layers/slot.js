// One layered slot (plan §6, spec Decisions 4, 6 and 7): the attacks an instance hears (its own part's chords when it is
// routed, thinned by its intensity curve), its own pulse, and how visible it is (the paste weight vis(a) × the slot's
// weight), then the runtime's per-slot statements with that weight. A slot with no layer whose instance keeps no pulse
// of its own never comes here: the hosts run today's statements for it.
//
// Regions (T15): a spot runs the widget on the shared canvas as today and pastes the picture from before it back
// through the region's mask (destination-out at the weight), so it is seen only inside; what it queues to draw "after
// the others" runs at the end of the step as without a region, each pass pasted back through the mask the same way.
// A window gives the instance its own canvas the size of the shared one (with the same fade and burn), lets it draw
// there as if alone, and stamps it scaled into the region, masked, at the weight; by default its black goes see-through
// first (blend 'clear'). A region glides from the last section's over the fade (region.js).
//
// What a host provides for windows, besides LayerHost: h.call passes h.ctx (read at each call) to the widget, because a
// windowed call runs with h.ctx set to the instance's window view (an object on the shared ctx whose g and canvas are
// the window's); at S > 1 it sets the base transform on the context of the canvas the passed ctx draws on; and,
// optional, h.windowG(inst) is the widget-facing context of the window (the HD proxy at S > 1; without it, the window's
// own 2D context, right at S = 1).
//
// One implementation: the lab loads this file as a classic <script>; the studio and Node evaluate the same text with
// new Function('WA', src) (src/widgets/layers.ts). It needs automation.js, lines.js, persist.js and region.js on WA
// first (file names load in sorted order, and the lab loads them before it).
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

  /** The paste weight of a layered slot at its time: weight × vis(a) with a curve, else the weight. cls: the class vis
      takes (default the instance's). */
  WA.layerWeight = function (s, cls) {
    var L = s.layer || {}, piv = L.pivots && L.pivots.length ? L.pivots : null;
    if (!piv) return s.weight;
    var until = L.until !== undefined ? L.until : Infinity;
    return s.weight * WA.vis(WA.automationAt(piv, Math.min(s.t, until)), cls || s.inst.persist);
  };

  /** The region a slot is seen in this step: the layer's, or on its way there from the last section's (a glide); null
      without one. */
  WA.slotRegion = function (s) {
    var L = s.layer || {};
    if (!L.region) return null;
    return L.glide && L.glide.from ? WA.glideRegion(L.glide.from, L.region, L.glide.u) : L.region;
  };

  /** Per instance, beside its InstanceState: its mask (rebuilt only when what it is made of changes), its window's
      region-box canvas, its window view, and the time of the last step it drew in its window. */
  var EXTRA = typeof WeakMap === 'function' ? new WeakMap() : null;
  function extra(inst) {
    var e = EXTRA ? EXTRA.get(inst) : inst.__waRegion;
    if (!e) {
      e = { maskKey: '', mask: null, box: null, view: null, winT: NaN };
      if (EXTRA) EXTRA.set(inst, e); else inst.__waRegion = e;
    }
    return e;
  }

  /** The box's device size in whole pixels, at least 1 × 1 (buildMask's size). */
  function boxPixels(b) { return [Math.max(1, Math.round(Math.abs(b.w))), Math.max(1, Math.round(Math.abs(b.h)))]; }

  /** The instance's mask for region r and class cls. A mask depends only on the shape, the box's whole-pixel size, the
      feather and the class, so the key is exactly those: one key is always one mask, and play and seek agree. One per
      instance: a glide that changes the size or the feather rebuilds it each step. */
  function maskOf(h, inst, r, cls) {
    var cw = h.canvas.width, ch = h.canvas.height, px = boxPixels(WA.regionBox(r, cw, ch)), e = extra(inst);
    var key = (r.shape === 'ellipse' ? 'e' : 'r') + '|' + px[0] + '|' + px[1] + '|' + (r.feather === undefined ? '-' : r.feather) + '|' + cls;
    if (e.maskKey !== key || !e.mask) { e.mask = WA.buildMask(r, cw, ch, cls, h.make); e.maskKey = key; }
    return e.mask;
  }

  function clampW(w) { return w > 0 ? (w < 1 ? w : 1) : 0; }

  /** Runs fn with queueMicrotask collected, then what was queued (and what that queues) before returning. A widget that
      draws "after the others" (pixelsort, fold, timeslice, stella) in a window thus does it at its own place in the
      stack, on its own canvas, so its pass stays inside its region. g: the real context drawn on; at S > 1 its base
      transform is set before the queued code, as the runtime does at the end of a step. An error in queued
      code goes to h.error(inst, err) (the runtime keeps it with the instance's other errors), or, without one, is
      thrown again from a real microtask, where an unregioned post-pass's error would surface; the queue is drained
      either way, and the step goes on. */
  function withPosts(h, inst, fn, g, S) {
    var G = globalThis, q = [], prev = G.queueMicrotask, errs = [];
    G.queueMicrotask = function (f) { q.push(f); };
    try {
      fn();
      if (q.length && S > 1) g.setTransform(S, 0, 0, S, 0, 0);
      while (q.length) {
        var f = q.shift();
        try { f(); } catch (err) { errs.push(err); }
      }
    } finally { G.queueMicrotask = prev; }
    for (var i = 0; i < errs.length; i++) {
      if (typeof h.error === 'function') h.error(inst, errs[i]);
      else if (typeof prev === 'function') (function (err) { prev.call(G, function () { throw err; }); })(errs[i]);
      else if (typeof console !== 'undefined') console.warn(errs[i]);
    }
  }

  /** The runtime's per-slot calls: the attacks if receiving, save/frame/restore, then the four resets, on g (the real
      context of the canvas the widget draws on). */
  function calls(h, inst, receiving, delivered, g) {
    if (receiving) for (var i = 0; i < delivered.length; i++) h.call(inst, 'onChord', delivered[i]);
    g.save(); h.call(inst, 'frame'); g.restore();
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none'; g.shadowBlur = 0;
  }

  /** The stage's picture through a spot's mask: the kept copy sc (the picture before) loses the mask at w
      (destination-out, the box rotated), then goes back over the stage, so inside the region what was drawn since shows
      (all of it where the mask and w are 1), outside it the copy. The stage's state is kept. */
  function pasteThrough(h, sc, m, b, w) {
    var sg = sc.getContext('2d'), g = h.g, bw = Math.abs(b.w), bh = Math.abs(b.h);
    sg.save();
    sg.setTransform(1, 0, 0, 1, b.cx, b.cy); if (b.rot) sg.rotate(b.rot);
    sg.globalCompositeOperation = 'destination-out'; sg.globalAlpha = clampW(w);
    sg.drawImage(m, -bw / 2, -bh / 2, bw, bh);
    sg.restore();
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.drawImage(sc, 0, 0);
    g.restore();
  }

  /** Clips g to the region's footprint in device pixels: its box (rotated) for a rect, the ellipse in it for an ellipse.
      The caller saves before and restores after; the transform is left at the box's. */
  function clipTo(g, r, b) {
    var bw = Math.abs(b.w), bh = Math.abs(b.h);
    g.setTransform(1, 0, 0, 1, b.cx, b.cy); if (b.rot) g.rotate(b.rot);
    g.beginPath();
    if (r.shape === 'ellipse') g.ellipse(0, 0, bw / 2, bh / 2, 0, 0, 2 * Math.PI);
    else g.rect(-bw / 2, -bh / 2, bw, bh);
    g.clip();
    g.beginPath();
  }

  /** Copies the stage into the host's scratch ('copy', so it is the stage exactly) and returns the scratch. */
  function keepStage(h) {
    var sc = h.scratch(), sg = sc.getContext('2d');
    sg.save();
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalAlpha = 1; sg.globalCompositeOperation = 'copy';
    sg.drawImage(h.canvas, 0, 0);
    sg.restore();
    return sc;
  }

  /** spot: the picture before the widget is kept, the widget draws on the shared canvas as today (at weight 1), then the
      kept picture goes back through the mask (pasteThrough), so inside the region the widget shows, outside it what was
      there. The mask's profile is the instance's class, so a soft edge looks soft on a ground widget too. Readers read
      the real stack below.
      What the widget queues (queueMicrotask: its pass "after the others") is not run here but handed on to the host's
      queue, so it runs at the end of the step as it does without a region, over the layers above too; each queued pass
      (and what it queues in turn) runs between a copy of the stage and pasteThrough with this step's mask, box and
      weight, so it changes the stage only inside the region; it runs clipped to the region's footprint as well, so a
      widget that keeps a copy of the stage after drawing on it (timeslice's threads, put back over the whole stage at
      the next fade) keeps nothing it drew outside. A widget that puts its pass back at the top of the next
      step (stella hooks ctx.sounding()) thus keeps and restores the whole stack as it does without a region, and never
      wipes what the layers above it drew. */
  function spot(h, s, r, w, delivered) {
    var inst = s.inst, g = h.g, S = h.S, G = globalThis, prev = G.queueMicrotask;
    var sc = keepStage(h);
    var b = WA.regionBox(r, h.canvas.width, h.canvas.height), m = maskOf(h, inst, r, inst.persist);
    function masked(f) {
      return function () {
        var keep = keepStage(h), q0 = G.queueMicrotask;
        G.queueMicrotask = wrapQ;
        g.save();
        try {
          clipTo(g, r, b);
          g.setTransform(S, 0, 0, S, 0, 0);   // queued widget code draws in widget units (the identity at S = 1)
          f();
        } catch (err) {
          if (typeof h.error === 'function') h.error(inst, err); else if (typeof console !== 'undefined') console.warn(err);
        } finally { G.queueMicrotask = q0; g.restore(); }
        pasteThrough(h, keep, m, b, w);
      };
    }
    function wrapQ(f) { prev.call(G, masked(f)); }
    G.queueMicrotask = typeof prev === 'function' ? wrapQ : prev;
    try { calls(h, inst, s.receiving, delivered, g); }
    finally { G.queueMicrotask = prev; }
    pasteThrough(h, sc, m, b, w);
  }

  /** The instance's window view: an object on the shared ctx (t, level, p, sounding… read through to it) whose g and
      canvas are the window's, so the widget, and anything it queues or hooks on its ctx, draws on its window. */
  function viewOf(h, inst, win) {
    var e = extra(inst);
    if (!e.view || e.view.canvas !== win) {
      var vg = typeof h.windowG === 'function' ? h.windowG(inst) : win.getContext('2d');
      e.view = Object.create(h.ctx, {
        g: { value: vg, writable: true, enumerable: true },
        canvas: { value: win, writable: true, enumerable: true },
      });
    }
    return e.view;
  }

  /** Clears a window canvas to opaque black (as a window starts, and after a reset), leaving its state as it was. */
  WA.clearWindow = function (win) {
    var wg = win.getContext('2d');
    wg.save();
    wg.setTransform(1, 0, 0, 1, 0, 0); wg.globalCompositeOperation = 'source-over'; wg.globalAlpha = 1; wg.filter = 'none';
    wg.fillStyle = '#000'; wg.fillRect(0, 0, win.width, win.height);
    wg.restore();
  };

  /** The 'clear' stamp on straight RGBA bytes (an ImageData's), in place: black goes see-through and anything lit stays
      solid. hi = max(r, g, b), a = min(1, hi × 3), rgb = min(1, rgb / a), so laid over black it looks as it did. A pixel
      already part clear (the edge of contain's letterbox) keeps that too: its alpha is multiplied in. */
  WA.clearPixels = function (d) {
    for (var i = 0; i < d.length; i += 4) {
      var hi = Math.max(d[i], d[i + 1], d[i + 2]), a = Math.min(255, hi * 3);
      if (a > 0) { var u = 255 / a; d[i] = Math.min(255, d[i] * u); d[i + 1] = Math.min(255, d[i + 1] * u); d[i + 2] = Math.min(255, d[i + 2] * u); }
      d[i + 3] = a * d[i + 3] / 255;
    }
    return d;
  };

  // The same on the graphics card, as a pixel read costs about 5 ms per frame for a 640 × 360 box. One small canvas and
  // shader shared by every copy, made at the first clear stamp. The texture and the canvas are both premultiplied, where
  // the sum is plain: rgb / a × a is the rgb it started as, so only alpha changes.
  var KEY_FRAG = '#version 300 es\nprecision highp float; uniform sampler2D q; in vec2 uv; out vec4 o;\n'
    + 'void main() { vec4 c = texture(q, uv); o = vec4(c.rgb, min(c.a, 3.0 * max(c.r, max(c.g, c.b)))); }';
  var KEY_VERT = '#version 300 es\nout vec2 uv;\n'
    + 'void main() { vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); uv = 0.5 * p + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  var KEY_RETRY_MS = 2000;
  var key = null, keyNever = false, keyRetryAt = 0;

  /** The shared key canvas, or null while there is none: never again without WebGL2 (Node, an old card), and for a
      moment after a lost context, so a browser short of contexts is not asked for one every frame. */
  function keyGl() {
    if (key && !key.gl.isContextLost()) return key;
    if (key) { key = null; keyRetryAt = Date.now() + KEY_RETRY_MS; }
    if (keyNever || Date.now() < keyRetryAt) return null;
    var made = null;
    try { made = typeof document !== 'undefined' ? makeKey() : null; } catch (err) { made = null; }
    if (!made) keyNever = true;
    key = made;
    return key;
  }

  function makeKey() {
    var cv = document.createElement('canvas');
    var gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return null;
    var p = gl.createProgram();
    [[gl.VERTEX_SHADER, KEY_VERT], [gl.FRAGMENT_SHADER, KEY_FRAG]].forEach(function (x) {
      var s = gl.createShader(x[0]); gl.shaderSource(s, x[1]); gl.compileShader(s); gl.attachShader(p, s);
    });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    gl.useProgram(p);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]
      .forEach(function (x) { gl.texParameteri(gl.TEXTURE_2D, x[0], x[1]); });
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);             // GL's y runs up: the box's top row ends at the top of the canvas
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);  // as a canvas stores it, so nothing is divided and rounded
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.disable(gl.BLEND);
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); });   // keyGl sees it and makes a new one
    return { cv: cv, gl: gl };
  }

  /** The box on the graphics card. False when it was not done, the box as it was. The canvas only ever grows, so copies
      of different sizes do not reallocate it each step; the picture sits at its top left. */
  function clearOnCard(box, tg, w, h) {
    var K = keyGl();
    if (!K) return false;
    try {
      var gl = K.gl, cv = K.cv;
      if (cv.width < w) cv.width = w;
      if (cv.height < h) cv.height = h;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, box);
      gl.viewport(0, cv.height - h, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (gl.isContextLost()) return false;
      tg.globalCompositeOperation = 'copy';                   // replaces the opaque box: 'source-over' would leave it there
      tg.drawImage(cv, 0, 0, w, h, 0, 0, w, h);
      tg.globalCompositeOperation = 'source-over';
      return true;
    } catch (err) { return false; }
  }

  /** Makes a box (a canvas, w × h, nothing rotated on its context) see-through where it is black: on the graphics card,
      or by reading its pixels without one. A canvas that cannot be read stays as it is. */
  WA.clearBox = function (box, w, h) {
    var tg = box.getContext('2d');
    if (clearOnCard(box, tg, w, h)) return;
    if (typeof tg.getImageData !== 'function') return;
    try {
      var im = tg.getImageData(0, 0, w, h);
      WA.clearPixels(im.data);
      tg.putImageData(im, 0, 0);
    } catch (err) { /* a tainted canvas: it keeps its background */ }
  };

  /** window: the instance's own canvas takes the shared canvas's step (the harness's top-of-step sounding(), then the
      fade and burn), the widget draws there as if alone, then the window is scaled into the region's box (fit), its black
      made see-through ('clear', the default, without a blend too), masked (destination-in) and stamped rotated at the box
      with globalAlpha w, 'clear' and 'over' laid on top, 'lighten' keeping the brighter; then the window's
      sounding() once more, for a put-back hooked on it (stella), so it never waits for the stage's. A window not drawn
      in the last step (it enters, or comes back) starts black. Its mask and its weight's vis take the 'redraw' class
      whatever the widget's: the stamp is a whole picture, redrawn every step. */
  function windowed(h, s, r, w, delivered) {
    var inst = s.inst, S = h.S, win = h.windowOf(inst), wg = win.getContext('2d'), RW = win.width, RH = win.height, e = extra(inst);
    if (e.winT !== s.lastT) WA.clearWindow(win);
    var x = viewOf(h, inst, win), c0 = h.ctx;
    try { x.sounding(); } catch (err) { /* only for a widget that hooks it (stella's put-back, done at the end already) */ }
    wg.globalCompositeOperation = 'source-over'; wg.globalAlpha = 1;
    if (S > 1) wg.setTransform(1, 0, 0, 1, 0, 0);
    wg.fillStyle = 'rgba(0,0,0,0.12)'; wg.fillRect(0, 0, RW, RH);
    wg.globalCompositeOperation = 'color-burn'; wg.fillStyle = 'rgb(252,252,252)'; wg.fillRect(0, 0, RW, RH);
    wg.globalCompositeOperation = 'source-over';
    h.ctx = x;
    try { withPosts(h, inst, function () { calls(h, inst, s.receiving, delivered, wg); }, wg, S); }
    finally { h.ctx = c0; }
    e.winT = s.t;
    var b = WA.regionBox(r, h.canvas.width, h.canvas.height), px = boxPixels(b), bw = Math.abs(b.w), bh = Math.abs(b.h);
    var m = maskOf(h, inst, r, 'redraw');
    if (!e.box || e.box.width !== px[0] || e.box.height !== px[1]) e.box = h.make(px[0], px[1]);
    var tg = e.box.getContext('2d'), f = WA.fitRect(r, RW, RH);
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.globalAlpha = 1;
    tg.clearRect(0, 0, px[0], px[1]);   // contain's letterbox stays clear
    tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high';
    tg.drawImage(win, f.sx, f.sy, f.sw, f.sh, 0, 0, px[0], px[1]);
    if (r.blend !== 'over' && r.blend !== 'lighten') WA.clearBox(e.box, px[0], px[1]);
    tg.globalCompositeOperation = 'destination-in'; tg.drawImage(m, 0, 0); tg.globalCompositeOperation = 'source-over';
    var g = h.g;
    g.save();
    g.setTransform(1, 0, 0, 1, b.cx, b.cy); if (b.rot) g.rotate(b.rot);
    g.globalCompositeOperation = r.blend === 'lighten' ? 'lighten' : 'source-over'; g.globalAlpha = clampW(w);
    g.drawImage(e.box, -bw / 2, -bh / 2, bw, bh);
    g.restore();
    // The window's own top-of-step, now that its picture is stamped: a widget that hooks sounding() to put back what it
    // drew over (stella) does so on the window here, so nothing it left pending can fire later through the shared
    // ctx's sounding(), which it may have hooked while it drew on the stage and which would paste the window's picture
    // over the whole stage. Nothing draws into the window until the next step, so this is the same as doing it then.
    try { x.sounding(); } catch (err) { /* see above */ }
  }

  /** One layered slot: delivered attacks, the own pulse, the weight, then the runtime's per-slot statements with them
      (snapshot when w < 1, onChord if receiving, save/frame/restore, the four resets, the paste-back at 1 − w). The
      frame runs at weight 0 too, so the widget's state is right when it comes back. h.call swaps the instance's pulse,
      features and notes into ctx around each call. With a region, the spot or the window path instead. */
  WA.drawLayered = function (h, s) {
    var inst = s.inst, g = h.g;
    var delivered = WA.deliveredChords(s);
    if (inst.own) WA.advancePulse(inst.pulse, inst.feat, delivered, WA.soundingAt(inst.notes, s.t), s.dt);
    var r = WA.slotRegion(s);
    if (r) {
      if (r.mode === 'window') windowed(h, s, r, WA.layerWeight(s, 'redraw'), delivered);
      else spot(h, s, r, WA.layerWeight(s), delivered);
      return;
    }
    var w = WA.layerWeight(s);
    var sc = null;
    if (w < 1) {
      sc = h.scratch();
      var sg = sc.getContext('2d');
      sg.globalCompositeOperation = 'copy'; sg.drawImage(h.canvas, 0, 0); sg.globalCompositeOperation = 'source-over';
    }
    calls(h, inst, s.receiving, delivered, g);
    if (sc) {
      if (h.S > 1) g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1 - Math.max(0, w); g.drawImage(sc, 0, 0); g.globalAlpha = 1;
    }
  };
})(typeof WA !== 'undefined' ? WA : (globalThis.WA_LAYERS ??= {}));
