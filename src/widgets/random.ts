// The lab's render-mode randomness (lab/index.html, ?render=1): a mulberry32 whose state starts at 1 and is reseeded
// with (n >>> 0) || 1, so the same widget at the same song time draws the same picture in the lab and the studio.

/** The lab's generator from `seed`, as its Math.random runs after `reseed(seed)`. */
export function labRandom(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/** Replaces Math.random with the lab's generator at `seed` (the lab starts at 1); returns reseed(n). */
export function installSeededRandom(seed = 1): (seed: number) => void {
  let next = labRandom(seed);
  Math.random = () => next();
  return (n: number) => { next = labRandom(n); };
}
