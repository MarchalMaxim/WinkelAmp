// Where a layer is seen, placed with the mouse (plan T17, spec Goals 3, design.md §6): an SVG over the stage with the
// region's outline, eight resize handles, a rotate knob above the top edge, a feather handle on the right with a dashed
// line where the feather starts, and a small bar with "Draw on the stage" and "Done". DOM and SVG only: it never draws
// into the canvas, so readers never cut a handle and frame hashes never see it.
//
//   var ui = WA_REGION_UI.mount(stage, canvas, {
//     get: function () { return region or null },          // null hides the overlay
//     set: function (r, phase) { … },                       // 'drag' while a gesture goes on, 'end' when it is done
//     hint: 'In a window, it cuts only its own picture.',   // optional, read at every refresh
//     onClose: function () { … },                           // optional: Esc or "Done" closed it
//   });
//   ui.refresh(); ui.open(); ui.close(); ui.draw(); ui.destroy();
//
// Mouse: drag the body to move (Shift keeps to one axis); a handle resizes (Shift keeps the aspect, Alt resizes from
// the centre); the knob rotates (Shift snaps to 15°); the feather handle sets the soft edge; a double-click toggles
// rectangle and ellipse. Keys, while the overlay has the focus (a press on it gives it): the arrows nudge by 1 % of the
// picture (Shift: 10 %), a held arrow being one gesture. Esc closes it (or leaves drawing). "Draw on the stage": drag a
// box on the picture; the region takes its place and size (its mode, shape, feather, blend and fit stay; Alt draws
// from the centre).
//
// Coordinates: CSS pixels map to the region's fractions through the picture's rect inside the canvas element, so a
// letterboxed canvas (object-fit: contain, the studio's) maps its bars out. Rotation is in pixel space, as regionBox
// (lab/layers/region.js) draws it; the dashed feather line follows buildMask: an ellipse's half-axes × (1 − feather),
// a rect inset by feather × the smaller half-size.
//
// One implementation: the lab loads this file as a classic <script> (window.WA_REGION_UI); the studio evaluates the
// same text with its own `window` parameter (src/studio/ui/region-overlay.ts), so the code below never uses window.*.
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var SIZE = [0.02, 2], CENTRE = [-0.5, 1.5];   // as the show's validator wants them (src/studio/show/show.ts)
  var DEFAULT_FEATHER = 0.25;
  var MIN_DRAW = 6;                             // CSS px: a smaller drawn box is a click, not a region
  var KNOB = 26;                                // CSS px from the top edge to the rotate knob
  var FEATHER_GAP = 11;                         // CSS px: the feather handle stays this far inside the right edge
  var HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  var CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
  var MODE_WORDS = { spot: 'Spotlight', window: 'Window' };

  var CSS = [
    '.wa-rg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:1;outline:none}',
    '.wa-rg[data-drawing]{pointer-events:all;cursor:crosshair}',
    '.wa-rg .wa-rg-hit{pointer-events:all;cursor:move;touch-action:none;fill:transparent}',
    '.wa-rg .wa-rg-under{fill:none;stroke:#000;stroke-opacity:.6;stroke-width:3.5}',
    '.wa-rg .wa-rg-line{fill:none;stroke:#fff;stroke-width:1.5}',
    '.wa-rg:focus .wa-rg-line{stroke:#ffd9b0}',
    '.wa-rg .wa-rg-box{fill:none;stroke:#fff;stroke-opacity:.35;stroke-width:1;stroke-dasharray:1 3}',
    '.wa-rg .wa-rg-soft{fill:none;stroke:#fff;stroke-opacity:.75;stroke-width:1;stroke-dasharray:5 4}',
    '.wa-rg .wa-rg-stem{stroke:#fff;stroke-width:1.2}',
    '.wa-rg .wa-rg-h{fill:#fff;stroke:#000;stroke-opacity:.7;stroke-width:1.2;pointer-events:all;touch-action:none}',
    '.wa-rg .wa-rg-rot{cursor:grab}',
    '.wa-rg .wa-rg-fea{fill:#ffd9b0;cursor:ew-resize}',
    '.wa-rg-bar{position:absolute;z-index:1;display:grid;grid-template-columns:auto auto auto;justify-content:start;align-items:center;gap:6px;max-width:min(440px,calc(100% - 16px));',
    'padding:6px 8px;border-radius:6px;background:rgba(8,7,10,.78);color:#e9e2da;font:12.5px/1.35 system-ui,sans-serif;',
    'box-shadow:0 1px 0 rgba(255,255,255,.06) inset;pointer-events:auto}',
    '.wa-rg-bar[hidden]{display:none}',
    '.wa-rg-bar b{font-weight:600}',
    '.wa-rg-bar .wa-rg-hint{grid-column:1/-1;color:#f0c2b4}',
    '.wa-rg-bar .wa-rg-hint:empty{display:none}',
    '.wa-rg-bar button{font:inherit;padding:3px 9px;border-radius:4px;border:1px solid rgba(233,226,218,.25);background:transparent;color:inherit;cursor:pointer}',
    '.wa-rg-bar button:hover{border-color:rgba(233,226,218,.6)}',
    '.wa-rg-bar button[aria-pressed=true]{background:#e9e2da;color:#08070a}',
  ].join('\n');

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r4(v) { return Math.round(v * 1e4) / 1e4; }
  function wrapDeg(d) { var w = ((((d + 180) % 360) + 360) % 360) - 180; return w === -180 && d > 0 ? 180 : w; }
  function copy(r) { var o = {}, k; for (k in r) if (Object.prototype.hasOwnProperty.call(r, k)) o[k] = r[k]; return o; }

  /** The region as a show keeps it: sizes and centre inside the validator's ranges, rotation in −180..180, four
      decimals (the show's own rounding). */
  function tidy(r) {
    var o = copy(r);
    o.x = r4(clamp(o.x, CENTRE[0], CENTRE[1])); o.y = r4(clamp(o.y, CENTRE[0], CENTRE[1]));
    o.w = r4(clamp(o.w, SIZE[0], SIZE[1])); o.h = r4(clamp(o.h, SIZE[0], SIZE[1]));
    if (o.rot !== undefined) o.rot = r4(wrapDeg(o.rot));
    if (o.feather !== undefined) o.feather = r4(clamp(o.feather, 0, 1));
    return o;
  }

  function same(a, b) {
    if (!a || !b) return a === b;
    var k;
    for (k in a) if (a[k] !== b[k]) return false;
    for (k in b) if (a[k] !== b[k]) return false;
    return true;
  }

  /** The picture's rect in the stage's padding box, in CSS px: the canvas element's content box, narrowed by its
      object-fit (contain letterboxes; the default fill is the whole box). */
  function pictureRect(stage, canvas) {
    var sr = stage.getBoundingClientRect(), cr = canvas.getBoundingClientRect(), cs = getComputedStyle(canvas);
    var px = function (v) { return parseFloat(v) || 0; };
    var x = cr.left - sr.left - stage.clientLeft + px(cs.borderLeftWidth) + px(cs.paddingLeft);
    var y = cr.top - sr.top - stage.clientTop + px(cs.borderTopWidth) + px(cs.paddingTop);
    var w = cr.width - px(cs.borderLeftWidth) - px(cs.paddingLeft) - px(cs.borderRightWidth) - px(cs.paddingRight);
    var h = cr.height - px(cs.borderTopWidth) - px(cs.paddingTop) - px(cs.borderBottomWidth) - px(cs.paddingBottom);
    var aw = canvas.width, ah = canvas.height, fit = cs.objectFit, k = 0;
    if (aw > 0 && ah > 0 && w > 0 && h > 0) {
      if (fit === 'contain') k = Math.min(w / aw, h / ah);
      else if (fit === 'cover') k = Math.max(w / aw, h / ah);
      else if (fit === 'none') k = 1;
      else if (fit === 'scale-down') k = Math.min(1, w / aw, h / ah);
    }
    if (k > 0) {   // object-position is taken as its default, the centre
      x += (w - aw * k) / 2; y += (h - ah * k) / 2; w = aw * k; h = ah * k;
    }
    return { x: x, y: y, w: Math.max(1, w), h: Math.max(1, h) };
  }

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function set(e, attrs) { for (var k in attrs) e.setAttribute(k, attrs[k]); }

  function injectStyle() {
    if (document.getElementById('wa-rg-style')) return;
    var s = document.createElement('style');
    s.id = 'wa-rg-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function mount(stage, canvas, o) {
    injectStyle();
    if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';

    var svg = el('svg', { class: 'wa-rg', tabindex: '0', role: 'group', 'aria-label': 'Where this layer is seen: drag to move, handles to resize, arrows to nudge, Esc to close' });
    svg.style.display = 'none';
    var frame = el('g', {}, svg);
    var box = el('rect', { class: 'wa-rg-box' }, frame);   // an ellipse's box, so its corner handles have something to hold
    var shapes = {};
    ['under', 'line', 'soft', 'hit'].forEach(function (cls) {
      shapes[cls] = { rect: el('rect', { class: 'wa-rg-' + cls }, frame), ellipse: el('ellipse', { class: 'wa-rg-' + cls }, frame) };
    });
    shapes.hit.rect.dataset.role = 'body'; shapes.hit.ellipse.dataset.role = 'body';
    var stem = el('line', { class: 'wa-rg-stem' }, frame);
    var rotKnob = el('circle', { class: 'wa-rg-h wa-rg-rot', r: '5.5', 'data-role': 'rot' }, frame);
    var handles = HANDLES.map(function (hv, i) { return el('rect', { class: 'wa-rg-h', width: '9', height: '9', 'data-role': 'size', 'data-i': String(i) }, frame); });
    var feather = el('rect', { class: 'wa-rg-h wa-rg-fea', width: '7', height: '7', 'data-role': 'feather' }, frame);
    var title = el('title', {}, feather); title.textContent = 'Soft edge: drag inwards to soften';
    var rotTitle = el('title', {}, rotKnob); rotTitle.textContent = 'Rotate (Shift: steps of 15°)';

    var bar = document.createElement('div');
    bar.className = 'wa-rg-bar';
    bar.hidden = true;
    bar.innerHTML = '<b class="wa-rg-what"></b><button type="button" data-act="draw" aria-pressed="false" title="Drag a box on the picture to place this layer there">Draw on the stage</button>'
      + '<button type="button" data-act="done" title="Close the handles (Esc)">Done</button><span class="wa-rg-hint"></span>';
    stage.appendChild(svg); stage.appendChild(bar);

    var closed = false, drawing = false, g = null, keyGesture = null, last = null, rect = null, downRole = null;

    function current() { var r = o.get(); return r && typeof r === 'object' ? r : null; }

    function refresh() {
      var r = current();
      var show = !!r && !closed;
      svg.style.display = show ? '' : 'none';
      bar.hidden = !show;
      if (!show) { if (drawing) setDrawing(false); last = null; return; }
      rect = pictureRect(stage, canvas);
      last = r;
      var cx = rect.x + r.x * rect.w, cy = rect.y + r.y * rect.h, w = Math.abs(r.w * rect.w), h = Math.abs(r.h * rect.h);
      var rot = r.rot || 0, f = clamp(r.feather === undefined ? DEFAULT_FEATHER : r.feather, 0, 1);
      var ell = r.shape === 'ellipse';
      set(frame, { transform: 'translate(' + cx + ' ' + cy + ') rotate(' + rot + ')' });
      // The outline, its shadow, the hit area; the dashed line where the feather starts (buildMask's band).
      ['under', 'line', 'hit'].forEach(function (cls) {
        var s = shapes[cls];
        set(s.rect, { x: -w / 2, y: -h / 2, width: w, height: h });
        set(s.ellipse, { cx: 0, cy: 0, rx: w / 2, ry: h / 2 });
        s.rect.style.display = ell ? 'none' : ''; s.ellipse.style.display = ell ? '' : 'none';
      });
      set(box, { x: -w / 2, y: -h / 2, width: w, height: h });
      box.style.display = ell ? '' : 'none';
      var soft = shapes.soft, band = f * Math.min(w, h) / 2;
      set(soft.rect, { x: -w / 2 + band, y: -h / 2 + band, width: Math.max(0, w - 2 * band), height: Math.max(0, h - 2 * band) });
      set(soft.ellipse, { cx: 0, cy: 0, rx: (1 - f) * w / 2, ry: (1 - f) * h / 2 });
      soft.rect.style.display = !ell && f > 0 && f < 1 ? '' : 'none';
      soft.ellipse.style.display = ell && f > 0 && f < 1 ? '' : 'none';
      // Handles: corners and edge middles, cursors turned with the region.
      handles.forEach(function (hd, i) {
        var hv = HANDLES[i], ang = Math.atan2(hv[1], hv[0]) * 180 / Math.PI + rot;
        var sector = Math.round((((ang % 180) + 180) % 180) / 45) % 4;
        set(hd, { x: hv[0] * w / 2 - 4.5, y: hv[1] * h / 2 - 4.5 });
        hd.style.cursor = CURSORS[sector];
      });
      set(stem, { x1: 0, y1: -h / 2, x2: 0, y2: -h / 2 - KNOB + 5.5 });
      set(rotKnob, { cx: 0, cy: -h / 2 - KNOB });
      var fx = ell ? (1 - f) * w / 2 : w / 2 - band;
      fx = Math.min(fx, w / 2 - FEATHER_GAP);
      set(feather, { x: fx - 3.5, y: -3.5, transform: 'rotate(45 ' + fx + ' 0)' });
      // The bar: what it is, the hint, in the picture's corner farthest from the region.
      bar.querySelector('.wa-rg-what').textContent = MODE_WORDS[r.mode] || 'Region';
      var hint = typeof o.hint === 'function' ? o.hint() : o.hint;
      bar.querySelector('.wa-rg-hint').textContent = hint || '';
      var right = r.x < 0.5, bottom = r.y < 0.5, pad = 8;
      bar.style.left = right ? '' : (rect.x + pad) + 'px';
      bar.style.right = right ? (stage.clientWidth - rect.x - rect.w + pad) + 'px' : '';
      bar.style.top = bottom ? '' : (rect.y + pad) + 'px';
      bar.style.bottom = bottom ? (stage.clientHeight - rect.y - rect.h + pad) + 'px' : '';
    }

    function emit(r, phase) {
      var t = tidy(r);
      if (phase === 'drag' && same(t, last)) return;
      o.set(t, phase);
    }

    function point(e) {
      var sr = stage.getBoundingClientRect();
      return { x: e.clientX - sr.left - stage.clientLeft, y: e.clientY - sr.top - stage.clientTop };
    }

    function setDrawing(on) {
      drawing = on;
      if (on) svg.setAttribute('data-drawing', ''); else svg.removeAttribute('data-drawing');
      var b = bar.querySelector('[data-act="draw"]');
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? 'Drag a box on the picture…' : 'Draw on the stage';
    }

    /** The region a gesture gives, from where it started and where the pointer is now (never per-move steps). */
    function gestureRegion(e, p) {
      var r0 = g.r0, R = g.rect, dx = p.x - g.p0.x, dy = p.y - g.p0.y;
      var r = copy(r0);
      var th = (r0.rot || 0) * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
      var w0 = r0.w * R.w, h0 = r0.h * R.h, c0x = R.x + r0.x * R.w, c0y = R.y + r0.y * R.h;
      if (g.role === 'body') {
        if (e.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
        r.x = r0.x + dx / R.w; r.y = r0.y + dy / R.h;
      } else if (g.role === 'size') {
        var hv = HANDLES[g.i], sx = hv[0], sy = hv[1];
        // The handle's place in the region's own (unrotated) frame, moved by the pointer's travel turned into it.
        var lx = sx * w0 / 2 + dx * cos + dy * sin, ly = sy * h0 / 2 - dx * sin + dy * cos;
        var alt = e.altKey, nw = w0, nh = h0;
        if (sx) nw = alt ? 2 * sx * lx : sx * lx + w0 / 2;
        if (sy) nh = alt ? 2 * sy * ly : sy * ly + h0 / 2;
        var minW = SIZE[0] * R.w, maxW = SIZE[1] * R.w, minH = SIZE[0] * R.h, maxH = SIZE[1] * R.h;
        if (e.shiftKey && w0 > 0 && h0 > 0) {
          var k = sx && sy ? Math.max(nw / w0, nh / h0) : sx ? nw / w0 : nh / h0;
          k = clamp(k, Math.max(minW / w0, minH / h0), Math.min(maxW / w0, maxH / h0));
          nw = w0 * k; nh = h0 * k;
        } else { nw = clamp(nw, minW, maxW); nh = clamp(nh, minH, maxH); }
        // The opposite side stays (Alt: the centre does); an edge handle with Shift grows the other way about the centre.
        var ox = alt || !sx ? 0 : sx * (nw - w0) / 2, oy = alt || !sy ? 0 : sy * (nh - h0) / 2;
        var cx = c0x + ox * cos - oy * sin, cy = c0y + ox * sin + oy * cos;
        r.x = (cx - R.x) / R.w; r.y = (cy - R.y) / R.h; r.w = nw / R.w; r.h = nh / R.h;
      } else if (g.role === 'rot') {
        var a0 = Math.atan2(g.p0.y - c0y, g.p0.x - c0x), a1 = Math.atan2(p.y - c0y, p.x - c0x);
        var deg = (r0.rot || 0) + (a1 - a0) * 180 / Math.PI;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        r.rot = wrapDeg(deg);
      } else if (g.role === 'feather') {
        var f0 = clamp(r0.feather === undefined ? DEFAULT_FEATHER : r0.feather, 0, 1);
        var hx0 = r0.shape === 'ellipse' ? (1 - f0) * w0 / 2 : w0 / 2 - f0 * Math.min(w0, h0) / 2;
        var fx = hx0 + dx * cos + dy * sin;
        r.feather = clamp(r0.shape === 'ellipse' ? 1 - fx / (w0 / 2) : (w0 / 2 - fx) / (Math.min(w0, h0) / 2), 0, 1);
      } else if (g.role === 'draw') {
        var ax = g.p0.x, ay = g.p0.y, bw = Math.abs(dx), bh = Math.abs(dy);
        if (e.shiftKey) bw = bh = Math.max(bw, bh);
        if (bw < MIN_DRAW || bh < MIN_DRAW) return null;
        var mx = e.altKey ? ax : ax + (dx < 0 ? -bw : bw) / 2, my = e.altKey ? ay : ay + (dy < 0 ? -bh : bh) / 2;
        if (e.altKey) { bw *= 2; bh *= 2; }
        r.x = (mx - R.x) / R.w; r.y = (my - R.y) / R.h; r.w = bw / R.w; r.h = bh / R.h;
        delete r.rot;
      }
      return r;
    }

    function onDown(e) {
      if (e.button !== 0) return;
      var role = drawing ? 'draw' : e.target.dataset && e.target.dataset.role;
      downRole = role || null;
      if (!role) return;
      var r = current();
      if (!r) return;
      e.preventDefault(); e.stopPropagation();
      svg.focus({ preventScroll: true });
      g = { role: role, i: Number(e.target.dataset.i), r0: r, rect: pictureRect(stage, canvas), p0: point(e), moved: false, id: e.pointerId, last: null };
      try { svg.setPointerCapture(e.pointerId); } catch (_) { /* a synthetic event */ }
    }
    function onMove(e) {
      if (!g || e.pointerId !== g.id) return;
      var p = point(e);
      if (!g.moved && Math.abs(p.x - g.p0.x) + Math.abs(p.y - g.p0.y) < 1) return;
      g.moved = true;
      var r = gestureRegion(e, p);
      if (!r) return;
      g.last = r;
      emit(r, 'drag');
    }
    function onUp(e) {
      if (!g || e.pointerId !== g.id) return;
      var done = g;
      g = null;
      try { svg.releasePointerCapture(e.pointerId); } catch (_) { /* released */ }
      if (done.role === 'draw') setDrawing(false);
      if (done.moved && done.last) emit(done.last, 'end');
    }
    function onCancel(e) { if (g && e.pointerId === g.id) onUp(e); }
    // The press's own role: with the pointer captured, the double-click's target is the svg, not the body.
    function onDbl(e) {
      if (downRole !== 'body' || drawing) return;
      var r = current();
      if (!r) return;
      e.preventDefault();
      var t = copy(r); t.shape = r.shape === 'ellipse' ? 'rect' : 'ellipse';
      emit(t, 'end');
    }
    function onKey(e) {
      var k = e.key;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var r = current();
      if (!r || closed) return;
      e.preventDefault(); e.stopPropagation();
      var step = e.shiftKey ? 0.1 : 0.01, t = copy(r);
      if (k === 'ArrowLeft') t.x -= step; else if (k === 'ArrowRight') t.x += step;
      else if (k === 'ArrowUp') t.y -= step; else t.y += step;
      keyGesture = k;
      emit(t, 'drag');
    }
    function onKeyUp(e) {
      if (e.key !== keyGesture) return;
      keyGesture = null;
      var r = current();
      if (r) o.set(tidy(r), 'end');
    }
    // Esc, wherever the focus is (but not in a text field): leave drawing, else close the overlay.
    function onEsc(e) {
      if (e.key !== 'Escape' || e.defaultPrevented || svg.style.display === 'none') return;
      var a = document.activeElement, tag = a && a.tagName;
      if (tag === 'TEXTAREA' || (a && a.isContentEditable) || (tag === 'INPUT' && !/^(range|checkbox|radio|button)$/.test(a.type))) return;
      e.preventDefault();
      if (drawing) { setDrawing(false); return; }
      close();
    }

    function close() {
      if (closed) return;
      closed = true;
      if (g) g = null;
      refresh();
      if (o.onClose) o.onClose();
    }

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onCancel);
    svg.addEventListener('dblclick', onDbl);
    svg.addEventListener('keydown', onKey);
    svg.addEventListener('keyup', onKeyUp);
    document.addEventListener('keydown', onEsc);
    bar.addEventListener('click', function (e) {
      var act = e.target.closest && e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'done') close();
      else { setDrawing(!drawing); svg.focus({ preventScroll: true }); }
    });
    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { refresh(); }) : null;
    if (ro) { ro.observe(stage); ro.observe(canvas); }

    refresh();
    return {
      refresh: refresh,
      /** Shows the overlay again after Esc or "Done" (when there is a region to show). */
      open: function () { if (!closed) return; closed = false; refresh(); },
      close: close,
      /** "Draw on the stage": the next drag on the picture makes the region's box. */
      draw: function () { if (closed) { closed = false; refresh(); } if (current()) { setDrawing(true); svg.focus({ preventScroll: true }); } },
      get visible() { return svg.style.display !== 'none'; },
      destroy: function () {
        if (ro) ro.disconnect();
        document.removeEventListener('keydown', onEsc);
        svg.remove(); bar.remove();
      },
    };
  }

  root.WA_REGION_UI = { mount: mount, pictureRect: pictureRect, tidy: tidy };
})(typeof window !== 'undefined' ? window : globalThis);
