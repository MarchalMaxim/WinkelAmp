// A lab card's layer controls (plan 2026-10-31 T22, §11): what the widget listens to, where it is seen and how it comes
// and goes, under its knobs; and the tag chips and filter over the cards. Plain words, as the studio's layer panel.
//
//   WA_LAYER_UI.mount(el, toolId, {
//     song: { id, notes, tracks, beats, loudness, energy?, moments: [[t, mood, label?]], dur },   // tracks/beats/loudness/energy: window.PACK
//     get: function () { return the entry { listen?, region?, intensity?, thin? } or undefined },
//     set: function (entry or null) { … },          // the lab's labLayers.set: stores it, loads what it needs
//     onChange: function (entry or null) { … },     // optional, after every set
//     now: function () { return song seconds },     // "this moment" is the moment playing now
//     isOn: function () { return whether the card's widget is switched on },
//     stage, canvas,                                // the place overlay (lab/region-ui.js) goes on the stage
//   });
//
// The entries are in the show's field shapes (src/studio/show/show.ts Layer): listen 'all' and an empty curve are left
// out, so an entry that changes nothing is no entry and the widget draws with today's statements. The lab has no
// automation lane: intensity is a preset, written as pivots over the moment playing now or over the whole song. Which
// preset wrote a curve, and the place a layer had before it went back to the whole screen, are this page's own notes
// (localStorage 'wa-layer-ui'); they are never exported.
//
// The pure parts (listenOptions, defaultRegion, presetPivots, the filter) are tested against the studio's
// (tests/lab-layer-ui.test.ts), so the two pages offer the same parts and write the same curves.
(function (root) {
  'use strict';

  // ---- The words (src/studio/pack/instruments.ts TRACKS, src/studio/ui/layer-controls.ts) -----------------------
  var TRACKS = {
    piano: ['keys', 'Piano'], plucked: ['plucked', 'Guitar and harp'], violin: ['strings', 'Violins'], viola: ['strings', 'Violas'],
    cello: ['strings', 'Cellos'], contrabass: ['strings', 'Double basses'], strings: ['strings', 'String section'],
    timpani: ['percussion', 'Timpani'], voice: ['voice', 'Voices'], horn: ['brass', 'French horns'], trumpet: ['brass', 'Trumpets'],
    trombone: ['brass', 'Trombones and tuba'], brass: ['brass', 'Brass section'], flute: ['winds', 'Flutes'], oboe: ['winds', 'Oboe'],
    clarinet: ['winds', 'Clarinet'], bassoon: ['winds', 'Bassoon'], saxophone: ['winds', 'Saxophones'],
  };
  var TRACK_IDS = Object.keys(TRACKS);
  var FAMILIES = ['keys', 'plucked', 'strings', 'winds', 'brass', 'percussion', 'voice'];
  var FAMILY_LABELS = { keys: 'All keys', plucked: 'All plucked strings', strings: 'All strings', winds: 'All winds', brass: 'All brass',
    percussion: 'All percussion', voice: 'All voices' };
  var LINES = ['melody', 'bassline', 'inner', 'low', 'high', 'accents'];
  var LINE_LABELS = { melody: 'Melody', bassline: 'Bass line', inner: 'Inner voices', low: 'Low notes', high: 'High notes', accents: 'Accents' };
  var NOTE_TYPES = ['chords', 'runs', 'trills', 'long', 'repeats'];
  var NOTE_TYPE_LABELS = { chords: 'Big chords', runs: 'Fast runs', trills: 'Trills', long: 'Long ringing notes', repeats: 'Repeated notes' };
  /** The widgets that read the shared canvas (they cut or smear what is below). */
  var READERS = ['casket', 'pixelsort', 'tunnel', 'blocks', 'fold', 'timeslice'];
  var INST_FAMILY_WORDS = { keys: 'Keys', plucked: 'Plucked', strings: 'Strings', winds: 'Winds', brass: 'Brass', percussion: 'Percussion',
    voice: 'Voice', ensemble: 'Ensemble' };

  var has = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); };
  var noteCount = function (tracks, id) { var tr = has(tracks, id) ? tracks[id] : null; return tr && tr.notes ? tr.notes.length : 0; };

  /** What a layer can listen to in this song (the studio's listenOptions): 'All notes'; 'In this recording': its tracks
      in TRACKS order with their note counts; 'Families': a family with two tracks or more; 'From the notes': the lines; 'Kinds of note': the note types. */
  function listenOptions(tracks) {
    var ids = TRACK_IDS.filter(function (id) { return noteCount(tracks, id) > 0; });
    var out = [{ group: '', value: 'all', label: 'All notes' }];
    ids.forEach(function (id) { out.push({ group: 'In this recording', value: id, label: (tracks[id].label || TRACKS[id][1]) + ' (' + tracks[id].notes.length + ' notes)' }); });
    FAMILIES.forEach(function (f) {
      if (ids.filter(function (id) { return TRACKS[id][0] === f; }).length >= 2) out.push({ group: 'Families', value: 'family:' + f, label: FAMILY_LABELS[f] });
    });
    LINES.forEach(function (l) { out.push({ group: 'From the notes', value: l, label: LINE_LABELS[l] }); });
    NOTE_TYPES.forEach(function (t) { out.push({ group: 'Kinds of note', value: t, label: NOTE_TYPE_LABELS[t] }); });
    return out;
  }
  /** A part's name in words, whether or not this song has it. */
  function listenLabel(l) {
    if (l === undefined || l === 'all') return 'All notes';
    if (has(LINE_LABELS, l)) return LINE_LABELS[l];
    if (has(NOTE_TYPE_LABELS, l)) return NOTE_TYPE_LABELS[l];
    if (String(l).indexOf('family:') === 0) return FAMILY_LABELS[l.slice(7)] || l;
    return has(TRACKS, l) ? TRACKS[l][1] : String(l);
  }

  /** A new region (the studio's defaultRegion): a small copy of the whole widget, a centred soft-edged box 40 % of the
      stage with the picture contained in it. mode: the one the user chose, when given. */
  function defaultRegion(widget, mode) {
    return { mode: mode || 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.4, h: 0.4, feather: 0.2, fit: 'contain' };
  }

  /** A loudness threshold for the gate (the studio's gateDefault): the span's 60th percentile, to 0.05, in 0.1..0.9.
      The curve is read `lag` s later than the span: the music inside the span, as the curve shows it. lag: 0 for the
      energy lane (WA.loudSource gives it); absent, WA.LOUDNESS_LAG.mean (1.7 s), as pack.loudness runs late. */
  function gateDefault(loud, span, lag) {
    if (!loud || !loud.values || !(loud.hop > 0)) return 0.5;
    var W = root.WA_LAYERS, n = loud.values.length;
    if (!Number.isFinite(lag)) lag = W && W.LOUDNESS_LAG ? W.LOUDNESS_LAG.mean : 1.7;
    var a = Math.min(Math.max(0, Math.floor((span.start + lag) / loud.hop)), n - 1), b = Math.min(n, Math.ceil((span.end + lag) / loud.hop));
    var v = loud.values.slice(a, b).filter(Number.isFinite).sort(function (x, y) { return x - y; });
    var q = v.length ? v[Math.floor(0.6 * (v.length - 1))] : 0.5;
    return Math.min(0.9, Math.max(0.1, Math.round(q * 20) / 20));
  }

  /** The song's moments as spans: [{ start, end, label }] (a moment without a label is called by its mood). */
  function momentSpans(moments, dur) {
    var ms = (moments || []).slice().sort(function (a, b) { return a[0] - b[0]; });
    return ms.map(function (m, i) {
      var label = m[2] || (m[1] ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : 'Moment ' + (i + 1));
      return { start: Math.max(0, m[0]), end: i + 1 < ms.length ? ms[i + 1][0] : dur, label: label };
    }).filter(function (s) { return s.end > s.start; });
  }
  /** The moment playing at t (the first one before it starts). */
  function momentAt(spans, t) {
    var at = spans[0] || null;
    spans.forEach(function (s) { if (t >= s.start) at = s; });
    return at;
  }

  /** The intensity presets, each with its one slider. */
  var PRESETS = {
    always: { label: 'Always full' },
    pulse: { label: 'Pulse on the beats', min: 1, max: 16, step: 1, value: 2, say: function (v, song) {
      return 'every ' + (v === 1 ? 'beat' : v + ' beats') + (song.beats && song.beats.length ? '' : ' (no beats in this song: half a second each)'); } },
    gate: { label: 'Gate on loudness', min: 0.05, max: 0.95, step: 0.05, value: null, say: function (v) { return 'seen when louder than ' + Math.round(v * 100) + ' %'; } },
    follow: { label: 'Follow the loudness', min: 0, max: 0.8, step: 0.05, value: 0.35, say: function (v) { return 'never below ' + Math.round(v * 100) + ' %'; } },
    climax: { label: 'Build to the climax', min: 0, max: 0.8, step: 0.05, value: 0.35, say: function (v) { return 'grows to the loudest moment, then settles back to ' + Math.round(v * 100) + ' %'; } },
    plays: { label: 'While its part plays', min: 0, max: 0.5, step: 0.05, value: 0, say: function (v) { return v > 0 ? 'between notes it stays at ' + Math.round(v * 100) + ' %' : 'gone between notes'; } },
    fade: { label: 'Fade at moments', min: 0.5, max: 20, step: 0.5, value: 4, say: function (v) { return 'fades in and out over ' + v + ' s at each moment'; } },
  };

  /** How many pivots padToSong adds around a curve over `span`: two at each inner edge of the song. */
  function padCount(span, dur) { return (span.start > 0 ? 2 : 0) + (span.end < dur ? 2 : 0); }

  /** A curve over `span` that leaves the rest of the song at full: a held 1 before it, the curve's first value held from
      the span's start to its first pivot (as the bare curve holds it), its value held to its end, then 1. */
  function padToSong(L, p, span, dur) {
    if (!p.length) return p;
    var out = p.slice();
    if (span.start > 0) {
      if (out[0].t > span.start) out.unshift({ t: span.start, v: out[0].v, shape: 'hold' });
      out.unshift({ t: 0, v: 1, shape: 'hold' });
    }
    if (span.end < dur) {
      var last = out[out.length - 1];
      if (last.t < span.end) out.push({ t: span.end, v: L.automationAt(p, span.end), shape: 'hold' });
      else out[out.length - 1] = Object.assign({}, last, { shape: 'hold' });
      out.push({ t: span.end, v: 1 });
    }
    return out;
  }

  /** The pivots of a preset over `span` (a moment's, or the whole song's): the shared presets (lab/layers/automation.js),
      as the studio writes them. 'fade': each moment inside the span fades in over `amount` seconds from its start and
      out over the same before its end (at most half the moment each). 'follow': the amount is its floor. Gate and
      follow read WA.loudSource: the energy lane with no lag when the pack has it (the gate its 3 s curve, follow its
      0.4 s one), else pack.loudness with WA.LOUDNESS_LAG. 'climax': the amount is its floor; it builds to the strongest
      of the song's loudest moments (WA.climaxes) inside the span. Empty for 'always', and for a gate, follow or climax
      with no loudness. */
  function presetPivots(L, kind, amount, span, song, listen) {
    var P = L.presets, dur = song.dur, p = [];
    var room = L.MAX_PIVOTS - padCount(span, dur);   // the padded curve stays within MAX_PIVOTS, its closing pivots kept
    if (kind === 'pulse') p = P.pulse(span, song.beats || [], { every: Math.max(1, Math.round(amount)) });
    else if (kind === 'gate') { var gs = L.loudSource(song, 'shortTerm'); p = gs ? P.gate(span, gs.curve, { above: amount, lag: gs.lag }) : []; }
    else if (kind === 'follow') { var fs = L.loudSource(song); p = fs ? P.follow(span, fs.curve, { floor: amount, lead: fs.lag.open }) : []; }
    else if (kind === 'climax') p = P.toClimax(span, L.climaxLane(song), { floor: amount, peaks: L.climaxes(song), maxPivots: room });
    else if (kind === 'plays') p = P.plays(span, L.listenNotes({ notes: song.notes, tracks: song.tracks }, listen).notes, { floor: amount });
    else if (kind === 'fade') {
      var cut = false;
      momentSpans(song.moments, dur).forEach(function (m) {
        var s = { start: Math.max(m.start, span.start), end: Math.min(m.end, span.end) };
        if (cut || s.end <= s.start) return;
        if (p.length + 4 > room - 1) { cut = true; return; }   // no room for this moment: the rest of the span stays full
        var d = Math.min(amount, (s.end - s.start) / 2);
        p = p.concat(P.fadeIn(s, d), P.fadeOut(s, d));
      });
      if (cut && p.length) p.push({ t: p[p.length - 1].t, v: 1 });
    }
    if (p.length > room) p = p.slice(0, room);
    return padToSong(L, p, span, dur);
  }

  /** The entry as the show keeps it: listen 'all', a whole-screen place and an empty curve are left out, and "keep the
      strongest" (thin 'loud') without a curve, where it does nothing; null when nothing is left (the widget draws as today). */
  function tidyEntry(e) {
    if (!e) return null;
    var o = {};
    if (e.listen !== undefined && e.listen !== 'all') o.listen = e.listen;
    if (e.region) o.region = e.region;
    if (e.intensity && e.intensity.length) o.intensity = e.intensity;
    if (o.intensity && e.thin === 'loud') o.thin = 'loud';
    return Object.keys(o).length ? o : null;
  }

  // ---- Tags and the filter ---------------------------------------------------------------------------------------

  var listParam = function (q, k) { return (q.get(k) || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean); };
  /** The filter in the URL: ?feel=dark,liquid&inst=cello. */
  function parseFilter(search) {
    var q = new URLSearchParams(search || '');
    return { feel: listParam(q, 'feel'), inst: listParam(q, 'inst') };
  }
  /** The search string with the filter in it (the other parameters kept; an empty list is left out). */
  function filterSearch(search, f) {
    var q = new URLSearchParams(search || '');
    if (f.feel.length) q.set('feel', f.feel.join(',')); else q.delete('feel');
    if (f.inst.length) q.set('inst', f.inst.join(',')); else q.delete('inst');
    var s = q.toString().replace(/%2C/gi, ',');
    return s ? '?' + s : '';
  }
  /** Whether a widget's tags pass the filter: every chosen feel word and every chosen instrument (AND); with nothing
      chosen everything passes, and an untagged widget passes only then. */
  function matches(tags, f) {
    if (!f.feel.length && !f.inst.length) return true;
    if (!tags) return false;
    return f.feel.every(function (w) { return tags.feel.indexOf(w) >= 0; }) && f.inst.every(function (w) { return tags.instruments.indexOf(w) >= 0; });
  }
  /** The filter bar's rows: feel words by axis, instruments by family (tag-words.json order). */
  function filterRows(words) {
    var rows = [];
    Object.keys(words.feel || {}).forEach(function (axis) { rows.push({ kind: 'feel', label: axis, words: Object.keys(words.feel[axis]) }); });
    var fams = {};
    Object.keys(words.instruments || {}).forEach(function (w) { var f = words.instruments[w].family; (fams[f] = fams[f] || []).push(w); });
    Object.keys(fams).forEach(function (f) { rows.push({ kind: 'inst', label: INST_FAMILY_WORDS[f] || f, words: fams[f] }); });
    return rows;
  }

  // ---- The DOM -----------------------------------------------------------------------------------------------------

  var esc = function (s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };
  var fmt = function (s) { return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };

  var NOTES_KEY = 'wa-layer-ui';
  var notes = null;   // { curve: { id: { kind, amount, scope, start, end, song } }, mem: { id: region }, open: { id: true } }
  function book() {
    if (notes) return notes;
    try { notes = JSON.parse(root.localStorage.getItem(NOTES_KEY) || 'null'); } catch (e) { notes = null; }
    if (!notes || typeof notes !== 'object') notes = {};
    ['curve', 'mem', 'open'].forEach(function (k) { if (!notes[k] || typeof notes[k] !== 'object') notes[k] = {}; });
    return notes;
  }
  function saveBook() { try { root.localStorage.setItem(NOTES_KEY, JSON.stringify(book())); } catch (e) { /* private window */ } }

  // One place overlay for the page, on the stage; it edits the card that opened it.
  var overlay = null, editing = null, cards = {};
  function ensureOverlay(o) {
    if (overlay || !root.WA_REGION_UI || !o.stage || !o.canvas) return overlay;
    overlay = root.WA_REGION_UI.mount(o.stage, o.canvas, {
      get: function () { var c = editing && cards[editing], e = c && c.get(); return (e && e.region) || null; },
      set: function (r, phase) { var c = editing && cards[editing]; if (c) c.setRegion(r, phase); },
      hint: function () {
        var c = editing && cards[editing], e = c && c.get();
        if (!e || !e.region) return '';
        var say = [c.name || editing];
        if (READERS.indexOf(editing) >= 0 && e.region.mode === 'window') say.push('as a small copy, it cuts only its own picture');
        if (!c.isOn()) say.push('switched off: click its card to see it here');
        return say.join(': ') + (say.length > 1 ? '.' : '');
      },
      onClose: function () { var id = editing; editing = null; if (cards[id]) cards[id].sync(); },
    });
    return overlay;
  }
  function openOverlay(id) {
    editing = id;
    if (!overlay) return;
    overlay.open(); overlay.refresh();
    Object.keys(cards).forEach(function (k) { cards[k].sync(); });
  }

  function mount(el, toolId, o) {
    var L = o.layers || root.WA_LAYERS, song = o.song, isOn = o.isOn || function () { return true; };
    var reader = READERS.indexOf(toolId) >= 0, spans = momentSpans(song.moments, song.dur);
    var opts = listenOptions(song.tracks);
    var get = function () { return o.get() || {}; };
    var B = book();

    el.classList.add('lyr');
    el.innerHTML = '<details class="lyr-d"><summary><span class="lyr-k">layer</span> <span class="lyr-sum"></span></summary>'
      + '<div class="lyr-row"><span class="lyr-k">listens to</span><select data-listen aria-label="What this widget listens to"></select></div>'
      + '<div class="lyr-row"><span class="lyr-k">place</span><span class="lyr-seg" role="group" aria-label="Where it is seen">'
      + '<button type="button" data-mode="">whole</button><button type="button" data-mode="window" title="The whole widget, shrunk into a box you place">small copy</button>'
      + '<button type="button" data-mode="spot" title="The full-size widget, seen only through a shape">mask</button></span></div>'
      + '<div class="lyr-row lyr-reg"><span class="lyr-k"></span><span class="lyr-regc"><select data-shape aria-label="Shape"><option value="ellipse">ellipse</option><option value="rect">rectangle</option></select>'
      + '<select data-blend aria-label="What happens to its black background"><option value="clear">see-through</option><option value="over">keep its black</option><option value="lighten">let the brighter show</option></select>'
      + '<label class="lyr-fea" title="Edge softness"><span>soft</span><input type="range" data-feather min="0" max="1" step="0.05" aria-label="Edge softness"></label>'
      + '<button type="button" data-edit title="Move, size and turn it on the stage">on the stage</button></span></div>'
      + '<div class="lyr-row"><span class="lyr-k">intensity</span><span class="lyr-int"><select data-preset aria-label="How it comes and goes"></select>'
      + '<select data-scope aria-label="Over which part of the song"><option value="moment">this moment</option><option value="song">whole song</option></select>'
      + '<button type="button" data-strongest>Keep the strongest</button></span></div>'
      + '<div class="lyr-row lyr-amt"><span class="lyr-k"></span><span class="lyr-amtc"><input type="range" data-amount aria-label="How much"><span class="lyr-say"></span></span></div>'
      + '<p class="lyr-note"></p></details>';
    var $ = function (q) { return el.querySelector(q); };
    var det = $('.lyr-d'), sum = $('.lyr-sum'), sel = $('[data-listen]'), shape = $('[data-shape]'), blendSel = $('[data-blend]'), feather = $('[data-feather]');
    var preset = $('[data-preset]'), scope = $('[data-scope]'), amount = $('[data-amount]'), say = $('.lyr-say'), note = $('.lyr-note');
    var regRow = $('.lyr-reg'), amtRow = $('.lyr-amt'), editBtn = $('[data-edit]'), thinBtn = $('[data-strongest]');
    // Nothing in here switches the card on or off.
    el.addEventListener('click', function (ev) { ev.stopPropagation(); });
    det.open = !!(B.open[toolId] || tidyEntry(o.get()));
    det.addEventListener('toggle', function () { if (det.open) B.open[toolId] = true; else delete B.open[toolId]; saveBook(); });

    preset.innerHTML = Object.keys(PRESETS).map(function (k) {
      var off = ((k === 'gate' || k === 'follow') && !L.loudSource(song)) || (k === 'climax' && !L.climaxLane(song));
      return '<option value="' + k + '"' + (off ? ' disabled' : '') + '>' + esc(PRESETS[k].label) + (off ? ' (no loudness curve for this song)' : '') + '</option>';
    }).join('') + '<option value="custom" hidden>a curve from elsewhere</option>';

    var extra;   // a part this song lacks, kept as an option so the select never shows blank
    function fillListen(cur) {
      var here = opts.some(function (x) { return x.value === cur; });
      var want = here ? null : cur;
      if (want !== extra) {
        extra = want;
        var all = here ? opts : opts.concat([{ group: 'Not in this recording', value: cur, label: listenLabel(cur) + ': plays on all notes here' }]);
        var groups = [];
        all.forEach(function (x) { if (groups.indexOf(x.group) < 0) groups.push(x.group); });
        sel.innerHTML = groups.map(function (g) {
          var items = all.filter(function (x) { return x.group === g; }).map(function (x) { return '<option value="' + esc(x.value) + '">' + esc(x.label) + '</option>'; }).join('');
          return g ? '<optgroup label="' + esc(g) + '">' + items + '</optgroup>' : items;
        }).join('');
      }
      sel.value = cur;
    }

    function commit(next) {
      if (!('thin' in next)) next.thin = get().thin;   // every change keeps "keep the strongest" unless it sets it
      var e = tidyEntry(next);
      o.set(e);
      if (o.onChange) o.onChange(e);
      sync();
      if (overlay && editing === toolId) overlay.refresh();
    }
    /** The curve again from its preset (after its part, its amount or its scope changed). */
    function curveFrom(c, listen) {
      if (!c || c.kind === 'always') return undefined;
      var span = c.scope === 'song' ? { start: 0, end: song.dur } : { start: c.start, end: c.end };
      return presetPivots(L, c.kind, c.amount, span, song, listen);
    }
    function setCurve(c) {
      if (!c || c.kind === 'always') delete B.curve[toolId]; else B.curve[toolId] = c;
      saveBook();
      var e = get();
      commit({ listen: e.listen, region: e.region, intensity: curveFrom(c, e.listen) });
    }
    function newCurve(kind) {
      var t = o.now ? o.now() : 0, m = momentAt(spans, t) || { start: 0, end: song.dur, label: 'the song' };
      var old = B.curve[toolId], sc = old ? old.scope : 'moment';
      var span = sc === 'song' ? { start: 0, end: song.dur } : m;
      var P = PRESETS[kind];
      var gs = kind === 'gate' ? L.loudSource(song, 'shortTerm') : null;
      var amt = kind === 'gate' ? gateDefault(gs && gs.curve, span, gs ? gs.lag.mean : undefined) : P.value;
      return { kind: kind, amount: amt, scope: sc, start: m.start, end: m.end, label: m.label, song: song.id };
    }

    sel.addEventListener('change', function () {
      var e = get(), listen = sel.value, c = B.curve[toolId];
      // "While its part plays" follows the part it listens to.
      var intensity = c && c.kind === 'plays' && c.song === song.id ? curveFrom(c, listen) : e.intensity;
      commit({ listen: listen, region: e.region, intensity: intensity });
    });
    el.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        var e = get(), mode = b.dataset.mode;
        if (!mode) {
          if (e.region) { B.mem[toolId] = e.region; saveBook(); }
          if (editing === toolId && overlay) overlay.close();
          commit({ listen: e.listen, intensity: e.intensity });
          return;
        }
        var r = e.region || B.mem[toolId] || defaultRegion(toolId, mode);
        r = Object.assign({}, r, { mode: mode });
        if (mode === 'window' && !r.fit) r.fit = 'contain';
        commit({ listen: e.listen, region: r, intensity: e.intensity });
        ensureOverlay(o); openOverlay(toolId);
      });
    });
    shape.addEventListener('change', function () { var e = get(); if (e.region) commit({ listen: e.listen, region: Object.assign({}, e.region, { shape: shape.value }), intensity: e.intensity }); });
    blendSel.addEventListener('change', function () {
      var e = get(); if (!e.region) return;
      var r = Object.assign({}, e.region);
      if (blendSel.value === 'clear') delete r.blend; else r.blend = blendSel.value;
      commit({ listen: e.listen, region: r, intensity: e.intensity });
    });
    feather.addEventListener('input', function () { var e = get(); if (e.region) commit({ listen: e.listen, region: Object.assign({}, e.region, { feather: Number(feather.value) }), intensity: e.intensity }); });
    editBtn.addEventListener('click', function () {
      if (editing === toolId && overlay && overlay.visible) { overlay.close(); return; }
      ensureOverlay(o); openOverlay(toolId);
    });
    preset.addEventListener('change', function () { setCurve(preset.value === 'always' ? null : newCurve(preset.value)); });
    thinBtn.addEventListener('click', function () {
      var e = get();
      commit({ listen: e.listen, region: e.region, intensity: e.intensity, thin: e.thin === 'loud' ? undefined : 'loud' });
    });
    scope.addEventListener('change', function () {
      var c = B.curve[toolId]; if (!c) return;
      var m = momentAt(spans, o.now ? o.now() : 0) || { start: 0, end: song.dur, label: 'the song' };
      setCurve(Object.assign({}, c, { scope: scope.value, start: m.start, end: m.end, label: m.label, song: song.id }));
    });
    amount.addEventListener('input', function () {
      var c = B.curve[toolId]; if (!c) return;
      setCurve(Object.assign({}, c, { amount: Number(amount.value), song: song.id }));
    });

    function sync() {
      var e = get(), c = B.curve[toolId], r = e.region;
      if (c && !(e.intensity && e.intensity.length)) { delete B.curve[toolId]; c = null; saveBook(); }   // cleared elsewhere
      fillListen(e.listen === undefined ? 'all' : e.listen);
      el.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String((r ? r.mode : '') === b.dataset.mode)); });
      regRow.hidden = !r;
      blendSel.hidden = !r || r.mode !== 'window';
      if (r) { blendSel.value = r.blend || 'clear'; shape.value = r.shape === 'rect' ? 'rect' : 'ellipse'; feather.value = String(r.feather === undefined ? 0.25 : r.feather); }
      editBtn.setAttribute('aria-pressed', String(editing === toolId && !!overlay && overlay.visible));
      var kind = c ? c.kind : e.intensity && e.intensity.length ? 'custom' : 'always';
      preset.value = kind;
      scope.hidden = !c;
      amtRow.hidden = !c;
      var curved = !!(e.intensity && e.intensity.length);
      thinBtn.disabled = !curved;
      thinBtn.setAttribute('aria-pressed', String(curved && e.thin === 'loud'));
      thinBtn.title = curved ? 'When turned down, the loudest notes stay and the weak ones go first' : 'When turned down, the loudest notes stay and the weak ones go first (pick a curve first)';
      if (c) {
        scope.value = c.scope;
        var P = PRESETS[c.kind];
        amount.min = P.min; amount.max = P.max; amount.step = P.step; amount.value = c.amount;
        say.textContent = P.say(c.amount, song);
      }
      // What the card does now, in words: the summary line and, where it matters, a note.
      var bits = [listenLabel(e.listen)];
      bits.push(!r ? 'whole screen' : r.mode === 'spot' ? 'mask' : 'small copy');
      bits.push(kind === 'always' ? 'always full' : kind === 'custom' ? 'its own curve' : PRESETS[kind].label.toLowerCase());
      if (curved && e.thin === 'loud') bits.push('keeps the strongest');
      sum.textContent = bits.join(' · ');
      el.classList.toggle('set', !!tidyEntry(o.get()));
      var say2 = [];
      if (e.listen !== undefined && e.listen !== 'all' && !opts.some(function (x) { return x.value === e.listen; })) say2.push(listenLabel(e.listen) + ' are not in this recording: it plays on all the notes.');
      if (NOTE_TYPES.indexOf(e.listen) >= 0 && !L.listenNotes({ notes: song.notes, tracks: song.tracks }, e.listen).notes.length) say2.push('This song has no ' + listenLabel(e.listen).toLowerCase() + ': it stays still.');
      if (c && c.song && c.song !== song.id) say2.push('This curve was made on another song: move its slider to make it again for this one.');
      else if (c && c.scope === 'moment') say2.push('Over ' + (c.label || 'the moment') + ' (' + fmt(c.start) + '–' + fmt(c.end) + '); full the rest of the song.');
      if (kind === 'custom') say2.push('A curve of ' + e.intensity.length + ' points from elsewhere: pick a preset to replace it.');
      if (reader && r && r.mode === 'window') say2.push('As a small copy it cuts only its own picture.');
      if ((r || c || (e.listen && e.listen !== 'all')) && !isOn()) say2.push('Switched off: click the card to hear it.');
      note.textContent = say2.join(' ');
      note.hidden = !say2.length;
    }

    cards[toolId] = {
      name: o.name || '',
      get: function () { return o.get(); },
      isOn: isOn,
      sync: sync,
      setRegion: function (r) { var e = get(); commit({ listen: e.listen, region: r, intensity: e.intensity }); },
    };
    if (editing === toolId) ensureOverlay(o);
    sync();
    if (overlay) overlay.refresh();
    return { sync: sync };
  }

  /** The feel and instrument chips under a card's name. */
  function chipsHTML(tags, words, f) {
    if (!tags) return '';
    var inst = (words && words.instruments) || {};
    var feel = tags.feel.map(function (w) { return '<button type="button" class="chip feel' + (f.feel.indexOf(w) >= 0 ? ' picked' : '') + '" data-feel="' + esc(w) + '" title="Filter by ' + esc(w) + '">' + esc(w) + '</button>'; });
    var ins = tags.instruments.map(function (w) {
      var label = inst[w] ? inst[w].label : w;
      return '<button type="button" class="chip inst' + (f.inst.indexOf(w) >= 0 ? ' picked' : '') + '" data-inst="' + esc(w) + '" title="' + esc(label) + ': filter by it">' + esc(w) + '</button>';
    });
    return feel.concat(ins).join('');
  }

  root.WA_LAYER_UI = {
    mount: mount, chipsHTML: chipsHTML,
    // pure
    listenOptions: listenOptions, listenLabel: listenLabel, defaultRegion: defaultRegion, gateDefault: gateDefault,
    momentSpans: momentSpans, momentAt: momentAt, presetPivots: presetPivots, padToSong: padToSong, tidyEntry: tidyEntry,
    parseFilter: parseFilter, filterSearch: filterSearch, matches: matches, filterRows: filterRows,
    TRACKS: TRACKS, FAMILIES: FAMILIES, LINES: LINES, NOTE_TYPES: NOTE_TYPES, READERS: READERS, PRESETS: PRESETS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
