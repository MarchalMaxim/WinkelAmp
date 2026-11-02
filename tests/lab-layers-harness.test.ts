/// <reference types="node" />
// The lab runs layers (plan 2026-10-31 T21, §11): its SONGS may name a pack file, it loads the shared layer code, and
// its step() keeps today's per-widget statements, word for word, for every widget without a layer entry.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readLabSongs } from '../src/widgets/lab-harness';

const ROOT = new URL('../', import.meta.url);
const HTML = readFileSync(new URL('lab/index.html', ROOT), 'utf8');

/** The source of `function <name>(` up to its closing brace at depth 0 (the lab's functions hold no braces in strings
    that would unbalance this: the test fails loudly if one ever does). */
function functionSource(html: string, name: string): string {
  const at = html.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`no function ${name}`);
  let depth = 0;
  for (let i = html.indexOf('{', at); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) return html.slice(at, i + 1);
  }
  throw new Error(`function ${name} does not close`);
}

describe('readLabSongs and the pack file', () => {
  it('a song need not have a pack', () => {
    const copy = HTML.replace("pack: 'pack-prelude.js', ", '');
    expect(copy).not.toBe(HTML);
    expect(readLabSongs(copy).prelude.pack).toBeUndefined();
  });

  it('names the pack files that npm run lab-notes writes, for every song', () => {
    const songs = readLabSongs(HTML);
    expect(songs.b5.pack).toBe('pack-beethoven5.js');
    expect(songs['vivaldi-winter'].pack).toBe('pack-vivaldi-winter.js');
    expect(songs.prelude.pack).toBe('pack-prelude.js');
    for (const [id, song] of Object.entries(songs)) expect(song.pack, id).toMatch(/^pack-[a-z0-9-]+\.js$/);
  });

  it('refuses a pack that is not a pack-<id>.js file name', () => {
    const bad = HTML.replace("pack: 'pack-prelude.js'", "pack: '../songs/x.json'");
    expect(bad).not.toBe(HTML);
    expect(() => readLabSongs(bad)).toThrow(/SONGS\.prelude\.pack/);
    const num = HTML.replace("pack: 'pack-prelude.js'", 'pack: 3');
    expect(() => readLabSongs(num)).toThrow(/SONGS\.prelude\.pack/);
  });
});

describe("the lab's step()", () => {
  const step = functionSource(HTML, 'step');

  it("keeps today's per-widget statements for a widget without a layer entry, exactly", () => {
    // Today's loop body (before T21), copied by hand: an edit to any of these lines fails here.
    const today = [
      '    if (!active.has(tool.id)) continue;',
      "    for (const ch of fired) safe(tool, 'onChord', ch, ctx);",
      "    g.save(); safe(tool, 'frame', ctx); g.restore();",
      "    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none'; g.shadowBlur = 0;",
    ];
    expect(step).toContain('  for (const tool of TOOLS) {\n' + today[0] + '\n');
    expect(step).toContain(today.slice(1).join('\n') + '\n  }\n');
    // The top of the step (moment, pulse, chords, features, the shared fade and burn) and the post-pass are unchanged too.
    for (const line of [
      '  let m = MOMENTS[0][1]; for (const [s, n] of MOMENTS) if (t >= s) m = n; ctx.moment = m;',
      '  ctx.level *= Math.pow(0.5, ctx.dt / 0.8); ctx.rate *= Math.pow(0.5, ctx.dt / 1.0);',
      '  while (ci < CHORDS.length && CHORDS[ci].t <= t) { const ch = CHORDS[ci++]; fired.push(ch); ctx.level = Math.max(ctx.level, ch.vel / 115); ctx.rate += 1 / 1.44; }',
      "  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, W, H);",
      "  g.globalCompositeOperation = 'color-burn'; g.fillStyle = 'rgb(252,252,252)'; g.fillRect(0, 0, W, H);",
      '  while (RENDER_POST.length) { try { RENDER_POST.shift()(); } catch (e) { console.warn(e); } }',
    ]) expect(step).toContain(line + '\n');
  });

  it('sends only a widget with a layer entry to the shared drawLayered, before the default statements', () => {
    const layered = step.indexOf('LAYER_RUN.get(tool.id)'), today = step.indexOf("safe(tool, 'onChord', ch, ctx)");
    expect(layered).toBeGreaterThan(0);
    expect(layered).toBeLessThan(today);
    expect(HTML).toContain('WA_LAYERS.drawLayered(labHost, ');
  });

  it("keeps the reset's widget loop", () => {
    expect(functionSource(HTML, 'reset')).toContain("  for (const tool of TOOLS) safe(tool, 'reset', ctx);\n");
  });
});

describe('the shared layer code in the lab', () => {
  it('loads every lab/layers/*.js as a classic script, in file-name order (as evalLayers), before the tools', () => {
    const files = readdirSync(new URL('lab/layers/', ROOT)).filter((f) => f.endsWith('.js')).sort();
    expect(files.length).toBeGreaterThan(0);
    const at = files.map((f) => HTML.indexOf(`<script src="layers/${f}"></script>`));
    for (const [i, f] of files.entries()) expect(at[i], f).toBeGreaterThan(0);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(at[at.length - 1]).toBeLessThan(HTML.indexOf('async function loadTools('));
  });

  it("never reads the layer store in render mode", () => {
    expect(HTML).toMatch(/if \(!RENDER\) LAYERS = JSON\.parse\(localStorage\.getItem\('wa-layers'\)/);
  });
});
