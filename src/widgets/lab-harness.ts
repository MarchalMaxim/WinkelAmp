// Reads the lab's own lists out of lab/index.html at run time, so the studio never keeps a copy that drifts:
// TOOL_IDS (load and draw order), VERDICTS (the user's ratings), DRIVES (the drive words), the ICON library's source
// and SONGS (the two recordings with their moments: step() sets ctx.moment from them).
import type { Drive, IconLib, LabHarness, LabMoment, LabSong, Verdict } from './types';

/** The end (exclusive) of the JS expression starting at `from`: the first `;` (or unmatched closer) at bracket depth 0,
    skipping strings, template literals (with nested `${}`), comments and regex literals. */
function expressionEnd(src: string, from: number): number {
  const stack: string[] = [];
  let i = from, prev = '(';                     // last significant char, to tell a regex from a division
  const close: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const n = src.indexOf('\n', i); i = n < 0 ? src.length : n; continue; }
    if (c === '/' && src[i + 1] === '*') { const n = src.indexOf('*/', i + 2); i = n < 0 ? src.length : n + 2; continue; }
    if (c === '"' || c === "'") { i = skipQuoted(src, i, c); prev = c; continue; }
    if (c === '`') { i = skipTemplate(src, i); prev = c; continue; }
    if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]/.test(prev)) { i = skipRegex(src, i); prev = '/'; continue; }
    if (c === '(' || c === '[' || c === '{') stack.push(close[c]);
    else if (c === ')' || c === ']' || c === '}') {
      if (!stack.length) return i;
      if (stack.pop() !== c) throw new Error(`unbalanced ${c} at ${i}`);
    } else if (c === ';' && !stack.length) return i;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  if (stack.length) throw new Error('unterminated expression');
  return i;
}
function skipQuoted(src: string, i: number, q: string): number {
  for (i++; i < src.length; i++) { if (src[i] === '\\') i++; else if (src[i] === q) return i + 1; }
  throw new Error('unterminated string');
}
function skipTemplate(src: string, i: number): number {
  for (i++; i < src.length; i++) {
    if (src[i] === '\\') i++;
    else if (src[i] === '`') return i + 1;
    else if (src[i] === '$' && src[i + 1] === '{') { const e = expressionEnd(src, i + 2); if (src[e] !== '}') throw new Error('bad template'); i = e; }
  }
  throw new Error('unterminated template');
}
function skipRegex(src: string, i: number): number {
  let cls = false;
  for (i++; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') i++;
    else if (c === '[') cls = true;
    else if (c === ']') cls = false;
    else if (c === '/' && !cls) { i++; while (/[a-z]/i.test(src[i] ?? '')) i++; return i; }
    else if (c === '\n') throw new Error('unterminated regex');
  }
  throw new Error('unterminated regex');
}

/** The source text of the expression assigned after `marker` (e.g. 'const TOOL_IDS ='). */
function expressionAfter(html: string, marker: string): string {
  const at = html.indexOf(marker);
  if (at < 0) throw new Error(`lab/index.html: no "${marker}" block`);
  const from = at + marker.length;
  return html.slice(from, expressionEnd(html, from)).trim();
}
const evaluate = (expr: string): unknown => new Function(`"use strict"; return (${expr});`)();

export function readLabHarness(html: string): LabHarness {
  const toolIds = evaluate(expressionAfter(html, 'const TOOL_IDS ='));
  const verdicts = evaluate(expressionAfter(html, 'const VERDICTS ='));
  const drives = evaluate(expressionAfter(html, 'const DRIVES ='));
  const iconSource = expressionAfter(html, 'window.ICON =');
  if (!Array.isArray(toolIds) || !toolIds.every((x) => typeof x === 'string')) throw new Error('lab/index.html: TOOL_IDS is not a list of ids');
  if (!verdicts || typeof verdicts !== 'object') throw new Error('lab/index.html: VERDICTS is not an object');
  if (!Array.isArray(drives)) throw new Error('lab/index.html: DRIVES is not a list');
  return { toolIds, verdicts: verdicts as Record<string, Verdict>, drives: drives as [Drive, string][], iconSource };
}

/** The lab's songs (`const SONGS =`): id → title, notes file (relative to lab/), length and moments. */
export function readLabSongs(html: string): Record<string, LabSong> {
  const songs = evaluate(expressionAfter(html, 'const SONGS ='));
  if (!songs || typeof songs !== 'object') throw new Error('lab/index.html: SONGS is not an object');
  for (const [id, s] of Object.entries(songs as Record<string, LabSong>)) {
    if (typeof s?.notes !== 'string' || !Array.isArray(s.moments) || !s.moments.length) throw new Error(`lab/index.html: SONGS.${id} has no notes or moments`);
  }
  return songs as Record<string, LabSong>;
}

/** ctx.moment before the first step: the lab starts every song at 'dread' (its ctx literal), whatever the song's moments. */
export const LAB_FIRST_MOMENT = 'dread';

/** The lab's step(): the mood name of the last moment starting at or before t, else the first one's. */
export function momentAt(moments: readonly LabMoment[], t: number): string {
  let m = moments[0][1];
  for (const [s, n] of moments) if (t >= s) m = n;
  return m;
}

/** A fresh ICON library from the lab's `window.ICON = (() => {…})()` source. */
export function makeIcon(iconSource: string): IconLib {
  const icon = new Function(`return (${iconSource});`)() as IconLib;
  if (!icon || typeof icon.gauge !== 'function') throw new Error('lab ICON source did not give an ICON library');
  return icon;
}
