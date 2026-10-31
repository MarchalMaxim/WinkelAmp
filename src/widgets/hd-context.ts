// Supersampling (plan §7): at scale S the canvas is 1280·S × 720·S and widgets keep drawing in 1280×720 units through
// a thin proxy of the real context. The runtime sets the base transform scale(S) before every widget call; the proxy
// keeps it under the calls that would lose it (setTransform, resetTransform), reads the transform back in widget units,
// scales the lengths the canvas takes in device pixels (shadows, filter px), and refuses pixel reads and writes of the
// shared canvas, which would see or cover a quarter of it at 2×: a reader that was missed fails loudly, naming itself.

/** Every `<number>px` in a CSS filter string times S; anything else (and 'none') unchanged. */
export function scaleFilter(f: string, S: number): string {
  if (S === 1) return f;
  return f.replace(/(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)px/gi, (_, n: string) => `${Number(n) * S}px`);
}

type Fn = (...a: unknown[]) => unknown;
const SHADOW = new Set<PropertyKey>(['shadowBlur', 'shadowOffsetX', 'shadowOffsetY']);

/** S === 1: g itself. Else a Proxy of g whose functions are bound to g (native methods need the real `this`). */
export function hdContext(g: CanvasRenderingContext2D, S: number, who: () => string): CanvasRenderingContext2D {
  if (S === 1) return g;
  const t = g as unknown as Record<PropertyKey, unknown>;
  const refuse = () => { throw new Error(`${who()} reads the shared canvas's pixels: adapt it for scale ${S}`); };
  const own: Record<PropertyKey, Fn> = {
    setTransform(a?: unknown, b?: unknown, c?: unknown, d?: unknown, e?: unknown, f?: unknown) {
      if (typeof a === 'number') { g.setTransform(S * a, S * (b as number), S * (c as number), S * (d as number), S * (e as number), S * (f as number)); return; }
      const m = (a ?? {}) as DOMMatrix2DInit;
      g.setTransform(S * (m.a ?? m.m11 ?? 1), S * (m.b ?? m.m12 ?? 0), S * (m.c ?? m.m21 ?? 0),
        S * (m.d ?? m.m22 ?? 1), S * (m.e ?? m.m41 ?? 0), S * (m.f ?? m.m42 ?? 0));
    },
    resetTransform() { g.setTransform(S, 0, 0, S, 0, 0); },
    getTransform() {
      const m = g.getTransform();   // a fresh matrix each call: scaling it in place is safe
      m.a /= S; m.b /= S; m.c /= S; m.d /= S; m.e /= S; m.f /= S;
      return m;
    },
    getImageData: refuse,
    putImageData: refuse,
  };
  const bound = new Map<PropertyKey, { fn: Fn; b: Fn }>();
  let filterSet = 'none', filterReal = 'none';
  return new Proxy(g, {
    get(_, p) {
      if (p in own) return own[p];
      if (SHADOW.has(p)) return (t[p] as number) / S;
      if (p === 'filter') return g.filter === filterReal ? filterSet : g.filter;
      const v = t[p];
      if (typeof v !== 'function') return v;
      const c = bound.get(p);
      if (c && c.fn === v) return c.b;
      const b = (v as Fn).bind(g) as Fn;
      bound.set(p, { fn: v as Fn, b });
      return b;
    },
    set(_, p, v) {
      if (SHADOW.has(p)) t[p] = (v as number) * S;
      else if (p === 'filter') { filterSet = String(v); g.filter = scaleFilter(filterSet, S); filterReal = g.filter; }
      else t[p] = v;
      return true;
    },
  });
}
