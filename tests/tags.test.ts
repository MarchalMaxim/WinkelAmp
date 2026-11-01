/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCatalogue } from '../scripts/node/catalogue';
import { toMeta } from '../src/widgets/catalogue';
import { feelWords, feelWordsIn, ROLES, tracksFor, validateTags, type TagWords } from '../src/widgets/tags';
import type { WidgetTags } from '../src/widgets/types';

const read = (f: string) => JSON.parse(readFileSync(new URL(`../lab/${f}`, import.meta.url), 'utf8'));
const words = read('tag-words.json') as TagWords;
const tags = read('tags.json') as Record<string, WidgetTags>;
const ids = readdirSync(new URL('../lab/tools/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
const TRACK_IDS = ['piano', 'plucked', 'violin', 'viola', 'cello', 'contrabass', 'strings', 'timpani', 'voice', 'horn', 'trumpet',
  'trombone', 'brass', 'flute', 'oboe', 'clarinet', 'bassoon', 'saxophone'];
const FAMILIES = ['keys', 'plucked', 'strings', 'winds', 'brass', 'percussion', 'voice'];

describe('lab/tags.json and lab/tag-words.json', () => {
  it('validate with no errors (an untagged new lab widget is only a warning, printed by widget-docs)', () => {
    expect(validateTags(tags, words, ids).errors).toEqual([]);
  });

  it('have 28 feel words on 5 axes and 18 instruments', () => {
    expect(Object.keys(words.feel)).toHaveLength(5);
    expect(feelWords(words)).toHaveLength(28);
    expect(new Set(feelWords(words)).size).toBe(28);
    expect(Object.keys(words.instruments)).toHaveLength(18);
  });

  it('use every feel word and every instrument at least once', () => {
    const feel = new Set(Object.values(tags).flatMap((t) => t.feel));
    for (const w of feelWords(words)) expect(feel.has(w), w).toBe(true);
    const inst = new Set(Object.values(tags).flatMap((t) => t.instruments));
    for (const w of Object.keys(words.instruments)) expect(inst.has(w), w).toBe(true);
  });

  it('describe every feel word, and pair instruments with feel words', () => {
    const feel = new Set(feelWords(words));
    for (const axis of Object.values(words.feel)) {
      for (const [w, d] of Object.entries(axis)) {
        expect(d.looks, w).toBeTruthy();
        expect(d.sounds, w).toBeTruthy();
        for (const [k, v] of Object.entries(d.fit)) {
          expect(['loud', 'dense', 'low', 'fast', 'quiet'], `${w}.${k}`).toContain(k);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
    for (const [w, d] of Object.entries(words.instruments)) {
      expect(d.label, w).toBeTruthy();
      expect(d.pairs.length, w).toBeGreaterThan(0);
      for (const p of d.pairs) expect(feel.has(p), `${w} pairs ${p}`).toBe(true);
    }
  });

  it('send instrument words to tracks that exist (§8)', () => {
    for (const [w, d] of Object.entries(words.instruments)) {
      for (const t of d.tracks) {
        const ok = t === 'all' || TRACK_IDS.includes(t) || (t.startsWith('family:') && FAMILIES.includes(t.slice(7)));
        expect(ok, `${w} → ${t}`).toBe(true);
      }
    }
    for (const w of ['violin', 'viola', 'cello', 'contrabass', 'flute', 'oboe', 'clarinet', 'bassoon', 'horn', 'trumpet', 'trombone',
      'timpani', 'voice', 'plucked', 'piano']) expect(tracksFor(w, words), w).toEqual([w]);
    expect(tracksFor('strings', words)).toEqual(['family:strings']);
    expect(tracksFor('harpsichord', words)).toEqual(['piano']);
    expect(tracksFor('tutti', words)).toEqual(['all']);
    expect(tracksFor('kazoo', words)).toEqual([]);
    expect(tracksFor('constructor', words)).toEqual([]);
  });

  it('have about 30 or more synonyms, each naming a feel word and none shadowing one', () => {
    const feel = new Set(feelWords(words));
    expect(Object.keys(words.synonyms).length).toBeGreaterThanOrEqual(30);
    for (const [s, w] of Object.entries(words.synonyms)) {
      expect(feel.has(w), `${s} → ${w}`).toBe(true);
      expect(feel.has(s), s).toBe(false);
      expect(s, s).toMatch(/^\p{L}+$/u);
    }
  });

  it('give every role from the type', () => {
    for (const [id, t] of Object.entries(tags)) expect(ROLES, id).toContain(t.role);
  });
});

describe('validateTags', () => {
  it('names the widget and the word of an unknown feel word or instrument', () => {
    const r = validateTags({ ...tags, strings: { ...tags.strings, feel: ['silky', 'sparkly'], instruments: ['violin', 'kazoo'] } }, words, ids);
    expect(r.errors).toEqual([`strings: unknown feel word 'sparkly'`, `strings: unknown instrument 'kazoo'`]);
  });

  it('errors on a key with no widget file and on a role not in Role', () => {
    const r = validateTags({ ...tags, nope: { feel: ['dark'], instruments: [], role: 'base' }, squares: { ...tags.squares, role: 'middle' } }, words, ids);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatch(/^squares: role 'middle'/);
    expect(r.errors[1]).toMatch(/^nope: no widget lab\/tools\/nope\.js/);
  });

  it('errors on a malformed entry or file', () => {
    expect(validateTags({ ...tags, squares: { feel: 'dark', instruments: [], role: 'base' } }, words, ids).errors).toEqual(['squares: feel is not a list of words']);
    expect(validateTags({ ...tags, squares: null }, words, ids).errors).toEqual(['squares: not { feel, instruments, role }']);
    expect(validateTags([], words, ids).errors).toHaveLength(1);
  });

  it('only warns about a widget without tags (lab widgets keep arriving)', () => {
    const { fold: _fold, ...rest } = tags;
    const r = validateTags(rest, words, ids);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['fold: no tags in lab/tags.json']);
  });

  it('errors on a synonym that names no feel word', () => {
    const bad: TagWords = { ...words, synonyms: { ...words.synonyms, sparkly: 'glittery', dark: 'dread' } };
    const r = validateTags(tags, bad, ids);
    expect(r.errors).toEqual([`synonym 'sparkly' → 'glittery': not a feel word`, `synonym 'dark' is itself a feel word`]);
  });
});

describe('feelWordsIn', () => {
  it('finds feel words and synonyms, lower-cased, unique, in vocabulary order', () => {
    // Vocabulary order: weight and texture (liquid), motion (skittish), light and colour (dark), atmosphere (dread).
    expect(feelWordsIn('Scary, dark and dripping; a hasty storm', words)).toEqual(['liquid', 'skittish', 'dark', 'dread']);
    expect([...feelWordsIn('Scary, dark and dripping; a hasty storm', words)].sort()).toEqual(['dark', 'dread', 'liquid', 'skittish']);
  });

  it('keeps each word once, and ignores words it does not know', () => {
    expect(feelWordsIn('ICY icy frozen. Calm, SERENE, peaceful', words)).toEqual(['icy', 'serene']);
    expect(feelWordsIn('', words)).toEqual([]);
    expect(feelWordsIn('a piano sonata, constructor toString', words)).toEqual([]);
  });

  it('splits on any non-letter, accents included', () => {
    expect(feelWordsIn('ice-cold/heavy—sombre…', words)).toEqual(['icy', 'heavy', 'dark']);
  });
});

describe('the catalogue carries the tags', () => {
  it('toMeta adds tags only when given', () => {
    const tool = { id: 'a', name: 'A', params: [], frame() {} };
    expect('tags' in toMeta(tool, null)).toBe(false);
    expect(toMeta(tool, null, null).tags).toBeNull();
    expect(toMeta(tool, null, tags.strings).tags).toEqual(tags.strings);
  });

  it('loadCatalogue sets meta.tags from lab/tags.json', () => {
    const { widgets } = loadCatalogue();
    expect(widgets.get('strings')?.tags?.instruments).toContain('violin');
    for (const [id, m] of widgets) expect(m.tags, id).toEqual(tags[id] ?? null);
  });

  it('an unknown widget gets null tags', () => {
    const r = loadCatalogue({ sources: { fine: "(() => { TOOLS.push({ id: 'fine', name: 'Fine', params: [] }); })();" } });
    expect(r.widgets.get('fine')?.tags).toBeNull();
  });
});
