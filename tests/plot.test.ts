/// <reference types="node" />
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodePng, Raster } from '../scripts/lib/plot';

/** The chunks of a PNG file: type and data. */
function chunks(png: Buffer) {
  const out: { type: string; data: Buffer }[] = [];
  for (let o = 8; o < png.length; ) {
    const len = png.readUInt32BE(o);
    const type = png.toString('latin1', o + 4, o + 8);
    out.push({ type, data: png.subarray(o + 8, o + 8 + len) });
    o += 12 + len;
  }
  return out;
}

describe('plot PNG', () => {
  it('a 4×4 RGBA image round-trips through zlib to the same pixels', () => {
    const px = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < px.length; i++) px[i] = (i * 37 + 11) & 0xff;
    const png = encodePng(4, 4, px);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const cs = chunks(png);
    expect(cs.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    const ihdr = cs[0].data;
    expect([ihdr.readUInt32BE(0), ihdr.readUInt32BE(4), ihdr[8], ihdr[9]]).toEqual([4, 4, 8, 6]); // 8-bit RGBA
    const raw = inflateSync(cs[1].data);
    // Each scanline: filter byte 0, then the row's pixels as given.
    expect(raw.length).toBe(4 * (1 + 16));
    for (let y = 0; y < 4; y++) {
      expect(raw[y * 17]).toBe(0);
      expect([...raw.subarray(y * 17 + 1, y * 17 + 17)]).toEqual([...px.subarray(y * 16, y * 16 + 16)]);
    }
  });

  it('chunk CRCs are the standard CRC-32 (IEND has the well-known one)', () => {
    const png = encodePng(1, 1, new Uint8Array([1, 2, 3, 4]));
    expect(png.readUInt32BE(png.length - 4)).toBe(0xae426082);
  });

  it('a Raster draws text and shapes inside its bounds', () => {
    const r = new Raster(40, 12, [0, 0, 0]);
    r.rect(-5, -5, 100, 3, [255, 0, 0]); // clipped, not thrown
    r.text(1, 4, 'C4 0:30', [255, 255, 255]);
    let lit = 0;
    for (let i = 0; i < r.px.length; i += 4) if (r.px[i + 1] === 255) lit++;
    expect(lit).toBeGreaterThan(20);
    expect(r.png().subarray(1, 4).toString('latin1')).toBe('PNG');
  });
});
