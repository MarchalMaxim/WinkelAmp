import { describe, expect, it } from 'vitest';
import { LiveDirector, type Streams } from '../src/stage/director';
import { LIBRARY, type LibraryScene } from '../src/stage/library';
import { validateScript } from '../src/stage/script';
import type { StageDirectives } from '../src/stage/types';
import { ARCHETYPE_IDS, type ArchetypeId, type Character } from '../src/character/types';

const FRAME = 1 / 60;

/** A character whose archetype blend is `weights` (normalised, sorted descending, as the engine hands it over). */
function character(weights: Partial<Record<ArchetypeId, number>>): Character {
  const total = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0) || 1;
  const blend = Object.entries(weights)
    .map(([id, w]) => ({ id: id as ArchetypeId, weight: (w ?? 0) / total }))
    .sort((a, b) => b.weight - a.weight);
  return {
    axes: { energy: 0.5, valence: 0, weight: 0.5, size: 0.5, agitation: 0.5, sharpness: 0.5, density: 0.5, warmth: 0.5, pace: 0.5 },
    blend,
    words: [],
    confidence: 1,
  };
}

/** Every stream on: every element type is wanted. */
const ALL_ON: Streams = { melodyVoiced: 1, bass: 1, pulse: 1, highActivity: 1 };

const ABYSS = character({ abyss: 0.75, lament: 0.15, mist: 0.1 });

/** Top archetype of a library scene (by affinity). */
function topAffinity(s: LibraryScene): ArchetypeId {
  return (Object.entries(s.affinity) as [ArchetypeId, number][]).sort((a, b) => b[1] - a[1])[0][0];
}
const sceneByName = (name: string) => LIBRARY.find((s) => s.name === name)!;
const ids = (d: StageDirectives) => d.cast.map((m) => m.spec.id);
const presence = (d: StageDirectives, id: string) => d.cast.find((m) => m.spec.id === id)?.presence ?? 0;

/** Runs `seconds` of frames with the same inputs; returns the last directives. */
function run(dir: LiveDirector, c: Character, streams: Streams, seconds: number, each?: (d: StageDirectives) => void): StageDirectives {
  let d!: StageDirectives;
  for (let i = 0; i < Math.round(seconds / FRAME); i++) {
    d = dir.update(c, streams, null, FRAME);
    each?.(d);
  }
  return d;
}

describe('LIBRARY', () => {
  it('has at least 10 scenes covering all 8 archetypes as a top affinity', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(10);
    const tops = new Set(LIBRARY.map(topAffinity));
    for (const a of ARCHETYPE_IDS) expect(tops, a).toContain(a);
    expect(new Set(LIBRARY.map((s) => s.name)).size).toBe(LIBRARY.length);
  });

  it('is schema-valid, with at most 4 elements per scene, each keyed by its type', () => {
    const r = validateScript({
      version: 1, id: 'library', title: 'Library', duration: 60, match: { kind: 'recording' },
      scenes: Object.fromEntries(LIBRARY.map(({ look, elements }, i) => [`s${i}`, { look, elements }])),
      timeline: [],
    });
    expect(r.ok ? [] : r.errors).toEqual([]);
    for (const s of LIBRARY) {
      expect(s.elements.length, s.name).toBeLessThanOrEqual(4);
      for (const e of s.elements) expect(e.id, s.name).toBe(e.type);
      // The character engine colors the live show: scenes leave the palette to the mood.
      expect(s.look?.palette ?? 'mood', s.name).toBe('mood');
    }
  });
});

describe('LiveDirector', () => {
  it('opens on the scene that fits the mood: abyss-dominant → a scene whose top affinity is abyss', () => {
    const d = new LiveDirector(1).update(ABYSS, ALL_ON, null, FRAME);
    expect(d.source).toBe('live');
    expect(topAffinity(sceneByName(d.scene))).toBe('abyss');
    expect(d.cast.length).toBeGreaterThan(0);
  });

  it('drop → hard cut: every outgoing element is gone (presence 0) on the very next frame', () => {
    const dir = new LiveDirector(1);
    const before = run(dir, ABYSS, ALL_ON, 20);
    const d = dir.update(ABYSS, ALL_ON, { kind: 'drop', strength: 0.8 }, FRAME);
    expect(d.scene).not.toBe(before.scene);
    const incoming = new Set(sceneByName(d.scene).elements.map((e) => e.id));
    const outgoing = ids(before).filter((id) => !incoming.has(id));
    expect(outgoing.length).toBeGreaterThan(0);
    for (const id of outgoing) expect(presence(d, id), id).toBe(0);
    const next = dir.update(ABYSS, ALL_ON, null, FRAME);
    for (const id of outgoing) expect(presence(next, id), id).toBe(0);
    // The new scene is on at once: no fade-in on a cut.
    for (const id of incoming) expect(presence(next, id), id).toBeGreaterThan(0.9);
  });

  it('section → 1.5 s blend: outgoing elements fade out while incoming ones fade in', () => {
    // The mood turns at the section (abyss → sugar), so the next scene brings in new elements.
    const SUGAR = character({ sugar: 0.8, gold: 0.2 });
    const dir = new LiveDirector(1);
    const before = run(dir, ABYSS, ALL_ON, 20);
    const d = dir.update(SUGAR, ALL_ON, { kind: 'section', strength: 0.5 }, FRAME);
    expect(topAffinity(sceneByName(d.scene))).toBe('sugar');
    expect(d.scene).not.toBe(before.scene);
    const incoming = new Set(sceneByName(d.scene).elements.map((e) => e.id));
    const outgoing = ids(before).filter((id) => !incoming.has(id));
    const fresh = [...incoming].filter((id) => !ids(before).includes(id));
    expect(outgoing.length).toBeGreaterThan(0);
    expect(fresh.length).toBeGreaterThan(0);

    const mid = run(dir, SUGAR, ALL_ON, 0.7);
    for (const id of outgoing) expect(presence(mid, id), id).toBeGreaterThan(0.2);
    for (const id of outgoing) expect(presence(mid, id), id).toBeLessThan(0.8);
    // Abyss → sugar shares one element of six, so the cast limit holds one newcomer back until the leavers go.
    const fading = fresh.filter((id) => ids(mid).includes(id));
    expect(fading.length).toBe(fresh.length - 1);
    for (const id of fading) expect(presence(mid, id), id).toBeGreaterThan(0.2);
    for (const id of fading) expect(presence(mid, id), id).toBeLessThan(0.8);

    // 2 s after the change it is all over: leavers gone, every newcomer (the late one too) fully in.
    const after = run(dir, SUGAR, ALL_ON, 1.3);
    for (const id of outgoing) expect(ids(after), id).not.toContain(id);
    for (const id of fresh) expect(presence(after, id), id).toBeGreaterThan(0.95);
  });

  it('never switches twice within 15 s, even when fed two changes 5 s apart', () => {
    const dir = new LiveDirector(1);
    const first = run(dir, ABYSS, ALL_ON, 20).scene;
    const switches: number[] = [];
    let scene = first;
    let t = 20;
    const step = (change: { kind: 'section' | 'drop'; strength: number } | null) => {
      const d = dir.update(ABYSS, ALL_ON, change, FRAME);
      t += FRAME;
      if (d.scene !== scene) switches.push(t);
      scene = d.scene;
    };
    step({ kind: 'drop', strength: 1 });
    for (let i = 0; i < 5 * 60; i++) step(null);
    step({ kind: 'section', strength: 1 });
    step({ kind: 'drop', strength: 1 });
    for (let i = 0; i < 9 * 60; i++) step(null);
    step({ kind: 'drop', strength: 1 }); // 14 s after the first: still too soon
    expect(switches.length).toBe(1);
    for (let i = 0; i < 2 * 60; i++) step(null);
    step({ kind: 'drop', strength: 1 }); // 16 s after: allowed
    expect(switches.length).toBe(2);
    expect(switches[1] - switches[0]).toBeGreaterThanOrEqual(15);
  });

  it('melody thread fades to ≤ 0.1 after 3 s without a voiced melody', () => {
    // Fog has a melody thread.
    const mist = character({ mist: 0.8, lament: 0.2 });
    const dir = new LiveDirector(1);
    const on = run(dir, mist, ALL_ON, 5);
    expect(sceneByName(on.scene).elements.some((e) => e.type === 'melody')).toBe(true);
    expect(presence(on, 'melody')).toBeGreaterThan(0.9);
    const off = run(dir, mist, { ...ALL_ON, melodyVoiced: 0 }, 3);
    expect(presence(off, 'melody')).toBeLessThanOrEqual(0.1);
    // Still listed (so the stage keeps its instance), just not visible; fluid/bloom stay on regardless.
    expect(ids(off)).toContain('melody');
    for (const m of off.cast) if (m.spec.type === 'fluid' || m.spec.type === 'bloom') expect(m.presence).toBeGreaterThan(0.95);
  });

  it('elements follow their streams: pulse gated at 0.35, sparks and bass scale with their level', () => {
    const machine = character({ machine: 1 });
    const dir = new LiveDirector(1);
    const d = run(dir, machine, { melodyVoiced: 0, bass: 0.5, pulse: 0.3, highActivity: 0.25 }, 8);
    const types = new Set(sceneByName(d.scene).elements.map((e) => e.type));
    expect(types.has('pulse') && types.has('sparks') && types.has('bass')).toBe(true);
    expect(presence(d, 'pulse')).toBeLessThan(0.01);
    expect(presence(d, 'sparks')).toBeCloseTo(0.25, 2);
    expect(presence(d, 'bass')).toBeCloseTo(0.5, 2);
    const d2 = run(dir, machine, { melodyVoiced: 0, bass: 0.5, pulse: 0.5, highActivity: 0.25 }, 5);
    expect(presence(d2, 'pulse')).toBeGreaterThan(0.95);
  });

  it('never emits more than 5 cast members, even mid-blend between scenes with little in common, and nothing pops', () => {
    // Make sure the library has a pair whose union is bigger than the cap, so the cap is exercised.
    const pure = ARCHETYPE_IDS.map((a) => LIBRARY.find((s) => s.affinity[a] === 1)!);
    let widest = 0;
    for (const a of pure) for (const b of pure) widest = Math.max(widest, new Set([...a.elements, ...b.elements].map((e) => e.id)).size);
    expect(widest).toBeGreaterThan(5);

    let most = 0;
    for (const a of ARCHETYPE_IDS) {
      for (const b of ARCHETYPE_IDS) {
        if (a === b) continue;
        const dir = new LiveDirector(3);
        const presences = (d: StageDirectives) => new Map(d.cast.map((m) => [m.spec.id, m.presence] as const));
        let prev = presences(run(dir, character({ [a]: 1 }), ALL_ON, 16, (d) => (most = Math.max(most, d.cast.length))));
        const next = character({ [b]: 1 });
        for (let i = 0; i < 2.5 * 60; i++) {
          const d = dir.update(next, ALL_ON, i === 0 ? { kind: 'section', strength: 1 } : null, FRAME);
          most = Math.max(most, d.cast.length);
          expect(d.cast.length).toBeLessThanOrEqual(5);
          // Every presence moves by at most a few blend steps per frame: nothing jumps in or out.
          const now = presences(d);
          for (const id of new Set([...prev.keys(), ...now.keys()])) {
            expect(Math.abs((now.get(id) ?? 0) - (prev.get(id) ?? 0)), `${a} → ${b}: ${id}`).toBeLessThan(0.05);
          }
          prev = now;
        }
      }
    }
    expect(most).toBe(5);
  });

  it('changes scene by itself when a new mood leads for 8 s after 60 s without a change', () => {
    const dir = new LiveDirector(1);
    const first = run(dir, ABYSS, ALL_ON, 50).scene;
    const gold = character({ gold: 0.8, sugar: 0.2 });
    // Gold leads from 50 s: held 8 s by 58 s, but 60 s have not passed yet.
    expect(run(dir, gold, ALL_ON, 9).scene).toBe(first);
    const d = run(dir, gold, ALL_ON, 2);
    expect(d.scene).not.toBe(first);
    expect(topAffinity(sceneByName(d.scene))).toBe('gold');
    // A blend, not a cut: the outgoing scene is still fading.
    const left = sceneByName(first).elements.map((e) => e.id).filter((id) => !sceneByName(d.scene).elements.some((e) => e.id === id));
    expect(left.some((id) => presence(dir.update(gold, ALL_ON, null, FRAME), id) > 0)).toBe(true);
  });

  it('does not change scene by itself while the leader is unchanged', () => {
    const dir = new LiveDirector(1);
    const first = run(dir, ABYSS, ALL_ON, 1).scene;
    expect(run(dir, ABYSS, ALL_ON, 120).scene).toBe(first);
  });

  it('breaks ties with the seed: repeatable per seed, varied across seeds', () => {
    const flat = character({});
    const pick = (seed: number) => new LiveDirector(seed).update(flat, ALL_ON, null, FRAME).scene;
    expect(pick(7)).toBe(pick(7));
    expect(new Set(Array.from({ length: 20 }, (_, i) => pick(i + 1))).size).toBeGreaterThan(1);
  });

  it('reset() starts afresh: picks for the new mood with nothing left over', () => {
    const dir = new LiveDirector(1);
    run(dir, ABYSS, ALL_ON, 5);
    dir.reset();
    const d = dir.update(character({ sugar: 1 }), ALL_ON, null, FRAME);
    expect(topAffinity(sceneByName(d.scene))).toBe('sugar');
    expect(d.cast.every((m) => sceneByName(d.scene).elements.some((e) => e.id === m.spec.id))).toBe(true);
  });

  it('blends the look and keeps the mood palette', () => {
    const dir = new LiveDirector(1);
    const before = run(dir, ABYSS, ALL_ON, 20);
    dir.update(ABYSS, ALL_ON, { kind: 'section', strength: 1 }, FRAME);
    const mid = run(dir, ABYSS, ALL_ON, 0.75);
    const after = run(dir, ABYSS, ALL_ON, 1);
    expect(mid.look.palette).toBe('mood');
    if (before.look.trails !== after.look.trails) {
      expect(mid.look.trails).toBeGreaterThan(Math.min(before.look.trails, after.look.trails));
      expect(mid.look.trails).toBeLessThan(Math.max(before.look.trails, after.look.trails));
    }
  });
});
