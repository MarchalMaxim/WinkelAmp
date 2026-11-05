// Snap night, C7: three copies of each of the user's two shows, so the new code can be judged on the user's own picks.
//   npx tsx scripts/snap-shows.mjs        (tsx, because the widget catalogue is TypeScript)
// Writes shows/<song>-knobs.json (no new code, only knob turns), -snap.json (snappier code, same clips) and -new.json
// (the new widgets on the picked notes). The originals are only read. Deterministic: rerun it when the originals change.
// A copy's id is its filename stem (the dev API finds /api/shows/<id> by it); only the title gets " · knobs" and so on.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SONGS = ['liebesleid', 'rach-concerto-2'];
export const KINDS = ['knobs', 'snap', 'new'];

const clone = (x) => JSON.parse(JSON.stringify(x));
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Knob turns of the zero-code baseline, per song: widget -> { knob: value }. Every clip of that widget gets them. */
const KNOB_TURNS = {
  'rach-concerto-2': {
    squares: { life: 0.4, blur: 0 }, gust: { linger: 0.6 }, kline: { stay: 1.2 }, halftone: { life: 0.4 },
    kandinsky: { paint: 0 }, gliss: { linger: 0.2 }, fireworks: { linger: 0 },
  },
  liebesleid: {
    miro: { life: 4 }, pointillism: { stay: 1.5, bleed: 0 }, fischinger: { life: 1.5, echoes: 0 },
    gliss: { linger: 0.2 }, fireworks: { linger: 0 },
  },
};

/** The same clips on sharper code: widget -> its snap twin. Every ivory clip also gets strike 1. */
const SNAP_SWAPS = { squares: 'squares-snap', flee: 'flee-snap', fireworks: 'fireworks-snap' };

/** The new widgets on the user's picks, per song: [widget the clip has now, picked set, new widget, new knobs]. */
const NEW_SWAPS = {
  liebesleid: [
    ['ivory', 'p1', 'hammer', {}], ['ivory', 'p2', 'hammer', {}], ['ivory', 'p3', 'hammer', {}],
    ['ivory', 'p5', 'hammer', { roll: 1 }], ['ivory', 'p6', 'hammer', { roll: 1 }], ['ivory', 'p7', 'hammer', { roll: 1 }], ['ivory', 'p8', 'hammer', { roll: 1 }],
    ['ivory', 'p11', 'handover', {}],
    ['ivory', 'p12', 'blade', {}], ['ivory', 'p13', 'blade', {}], ['ivory', 'p14', 'blade', {}], ['ivory', 'p15', 'blade', {}],
  ],
  'rach-concerto-2': [
    ['squares', 'p2', 'hammer', {}], ['squares', 'p6', 'handover', {}],
    ['ivory', 'p14', 'blade', {}], ['halftone', 'p15', 'hammer', { touch: 0 }],
  ],
};

/** Sets a knob: a number replaces the value, a { base, drive, ... } object keeps its drive and takes the new base. */
function setKnob(clip, key, value) {
  clip.knobs ??= {};
  const old = clip.knobs[key];
  clip.knobs[key] = isObj(old) ? { ...old, base: value } : value;
}

/** Keeps only the knobs `widget` has (keysOf(widget) is a list of keys, or null for "do not check"). Returns the dropped keys. */
function keepKnobs(clip, keysOf) {
  const keys = keysOf ? keysOf(clip.widget) : null;
  const dropped = [];
  if (keys && clip.knobs) {
    for (const k of Object.keys(clip.knobs)) if (!keys.includes(k)) { dropped.push(k); delete clip.knobs[k]; }
    if (!Object.keys(clip.knobs).length) delete clip.knobs;
  }
  return dropped;
}

/** Swaps a clip's widget. start, end, listen, track, fade, region and intensity stay; the old knobs go (they belong to
    the old widget) except those the new one shares by key; then `knobs` are set. */
function swap(clip, widget, knobs, keysOf, log, why) {
  const was = clip.widget;
  clip.widget = widget;
  const dropped = keepKnobs(clip, keysOf);
  for (const [k, v] of Object.entries(knobs)) setKnob(clip, k, v);
  const bad = keysOf ? Object.keys(knobs).filter((k) => !keysOf(widget).includes(k)) : [];
  for (const k of bad) { delete clip.knobs[k]; dropped.push(k); }
  if (clip.knobs && !Object.keys(clip.knobs).length) delete clip.knobs;
  log.push(`${clip.id} ${was} -> ${widget} (${why})${dropped.length ? `, dropped ${dropped.join(', ')}` : ''}`);
}

/** The three copies of `show` (never mutated) as { knobs, snap, new }, each { show, log }. keysOf(widgetId) lists the
    knob keys a widget has, or is omitted to skip that check. */
export function buildCopies(show, keysOf = null) {
  const out = {};
  for (const kind of KINDS) {
    const s = clone(show), log = [];
    s.id = `${show.id}-${kind}`;
    s.title = `${show.title ?? show.id} · ${kind}`;
    if (kind === 'knobs') {
      const turns = KNOB_TURNS[show.id] ?? {};
      for (const c of s.clips) for (const [k, v] of Object.entries(turns[c.widget] ?? {})) {
        if (keysOf && !keysOf(c.widget).includes(k)) { log.push(`${c.id} ${c.widget}: no knob ${k}, skipped`); continue; }
        setKnob(c, k, v); log.push(`${c.id} ${c.widget} ${k} = ${v}`);
      }
    } else if (kind === 'snap') {
      for (const c of s.clips) {
        if (c.widget === 'ivory') { setKnob(c, 'strike', 1); log.push(`${c.id} ivory strike = 1`); }
        else if (SNAP_SWAPS[c.widget]) swap(c, SNAP_SWAPS[c.widget], {}, keysOf, log, 'snappier code');
      }
    } else {
      for (const [from, pick, to, knobs] of NEW_SWAPS[show.id] ?? []) {
        const c = s.clips.find((x) => x.widget === from && x.listen === `picks:${pick}`);
        if (c) swap(c, to, knobs, keysOf, log, pick);
        else log.push(`no ${from} clip on ${pick}: skipped`);
      }
    }
    out[kind] = { show: s, log };
  }
  return out;
}

export const serialise = (s) => JSON.stringify(s, null, 2) + '\n';

// Run directly: read the two originals, write six copies.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { loadCatalogue } = await import('./node/catalogue.ts');
  const widgets = loadCatalogue().widgets;
  const keysOf = (id) => widgets.get(id)?.params.map((p) => p.key) ?? [];
  for (const song of SONGS) {
    const show = JSON.parse(readFileSync(path.join(ROOT, 'shows', `${song}.json`), 'utf8'));
    for (const [kind, { show: copy, log }] of Object.entries(buildCopies(show, keysOf))) {
      writeFileSync(path.join(ROOT, 'shows', `${song}-${kind}.json`), serialise(copy));
      console.log(`shows/${song}-${kind}.json: ${log.length} changes`);
      for (const l of log) console.log(`   ${l}`);
    }
  }
}
