/// <reference types="node" />
/**
 * PNG plots for study packs, with no dependencies: an RGBA raster, a 3×5 pixel
 * font for labels (Claude reads these images, and an unlabelled axis says
 * nothing), and three plot kinds over song time:
 *
 *   linePlot   stacked lanes of lines, filled areas or stacked shares (mood, loudness…)
 *   pianoRoll  notes as bars on a pitch grid, with the continuous contour (melody)
 *   heatmap    columns of 0..1 values (spectrogram)
 *
 * Every plot can carry time marks (section starts, drops) across all lanes.
 * linePlot and pianoRoll wrap a long piece into several rows of `rowSeconds`.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

export type Rgb = [number, number, number];

// ---- PNG -------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** An 8-bit RGBA PNG of `rgba` (row-major, 4 bytes a pixel): filter 0 on every row, one IDAT. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

// ---- Raster and font ---------------------------------------------------------------

/** 3×5 glyphs, rows top to bottom, '1' = ink. Lowercase draws as uppercase. */
const FONT: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
  '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111101101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  ' ': '000000000000000', '.': '000000000000010', ':': '000010000010000', '-': '000000111000000',
  '/': '001001010100100', '#': '101111101111101', '(': '010100100100010', ')': '010001001001010',
  '%': '101001010100101', '+': '000010111010000', ',': '000000000010100', '=': '000111000111000',
  '>': '100010001010100', '<': '001010100010001', '_': '000000000000111', "'": '010010000000000',
  '?': '111001010000010', '|': '010010010010010',
};
/** Characters the font lacks, drawn as their nearest ASCII. */
const ALIAS: Record<string, string> = { '♯': '#', '·': '.', '–': '-', '—': '-', '×': 'X', '♭': 'B' };

export class Raster {
  readonly px: Uint8Array;

  constructor(readonly w: number, readonly h: number, bg: Rgb) {
    this.px = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) this.px.set([bg[0], bg[1], bg[2], 255], i * 4);
  }

  /** Blends `c` over pixel (x, y) with opacity `a`; outside the raster it is a no-op. */
  set(x: number, y: number, c: Rgb, a = 1): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !(a > 0)) return;
    const i = (y * this.w + x) * 4;
    const k = Math.min(1, a);
    for (let j = 0; j < 3; j++) this.px[i + j] = Math.round(this.px[i + j] * (1 - k) + c[j] * k);
  }

  rect(x: number, y: number, w: number, h: number, c: Rgb, a = 1): void {
    const x0 = Math.max(0, Math.round(x)), x1 = Math.min(this.w, Math.round(x + w));
    const y0 = Math.max(0, Math.round(y)), y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c, a);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Rgb, a = 1): void {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a);
  }

  /** A vertical line, dashed every `dash` pixels when `dash` > 0. */
  vline(x: number, y0: number, y1: number, c: Rgb, a = 1, dash = 0): void {
    for (let y = Math.round(y0); y <= Math.round(y1); y++) if (!dash || Math.floor(y / dash) % 2 === 0) this.set(x, y, c, a);
  }

  /** Text at (x, y) = its top-left corner, `scale` pixels per font pixel. Returns the width drawn. */
  text(x: number, y: number, s: string, c: Rgb, scale = 1): number {
    let cx = x;
    for (const ch0 of s) {
      const ch = ALIAS[ch0] ?? ch0.toUpperCase();
      const g = FONT[ch] ?? FONT['?'];
      for (let r = 0; r < 5; r++)
        for (let col = 0; col < 3; col++) if (g[r * 3 + col] === '1') this.rect(cx + col * scale, y + r * scale, scale, scale, c);
      cx += 4 * scale;
    }
    return cx - x;
  }

  /** Text on a dark box, so it reads over a busy plot. */
  label(x: number, y: number, s: string, c: Rgb, scale = 1): number {
    this.rect(x - 2, y - 2, s.length * 4 * scale + 3, 5 * scale + 4, BG, 0.75);
    return this.text(x, y, s, c, scale);
  }

  png(): Buffer {
    return encodePng(this.w, this.h, this.px);
  }
}

export const textWidth = (s: string, scale = 1) => [...s].length * 4 * scale;

// ---- Plots over song time ----------------------------------------------------------

const BG: Rgb = [12, 12, 16];
const PANEL: Rgb = [22, 22, 30];
const GRID: Rgb = [70, 70, 86];
const INK: Rgb = [225, 225, 230];
const DIM: Rgb = [150, 150, 165];

/** Something that happened at song time `t` (seconds), drawn as a dashed line through every lane. */
export interface Mark {
  t: number;
  color: Rgb;
  label?: string;
}

export interface TimeFrame {
  title: string;
  /** Song seconds. */
  duration: number;
  /** Image width in pixels (default 1400). */
  width?: number;
  /** Wrap into rows of this many seconds (default: the whole piece in one row). */
  rowSeconds?: number;
  marks?: Mark[];
}

/** Values sampled every `hop` seconds from song time 0. */
export interface Series {
  values: ArrayLike<number>;
  color: Rgb;
  label?: string;
  /** Fill down to the lane's floor instead of drawing a line. */
  fill?: boolean;
}

export interface Lane {
  label: string;
  height: number;
  /** Value range bottom → top (default [0, 1]). */
  range?: [number, number];
  series?: Series[];
  /** Shares stacked bottom-up (each value 0..1, their sum ≤ 1): the archetype blend. */
  stack?: Series[];
}

const LEFT = 64;
const RIGHT = 10;
const TITLE_H = 26;
const AXIS_H = 18;
const ROW_GAP = 10;

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

interface Row {
  t0: number;
  t1: number;
  /** Top of the row's plot area. */
  y: number;
}

/** Splits the piece into rows and works out the x mapping shared by every row. */
function layout(f: TimeFrame, bodyH: number) {
  const width = f.width ?? 1400;
  const span = f.rowSeconds && f.rowSeconds < f.duration ? f.rowSeconds : Math.max(1e-3, f.duration);
  const rows: Row[] = [];
  for (let t0 = 0, i = 0; t0 < f.duration - 1e-6 || i === 0; t0 += span, i++) {
    rows.push({ t0, t1: Math.min(f.duration, t0 + span), y: TITLE_H + i * (bodyH + AXIS_H + ROW_GAP) });
  }
  const plotW = width - LEFT - RIGHT;
  const height = TITLE_H + rows.length * (bodyH + AXIS_H + ROW_GAP);
  const r = new Raster(width, height, BG);
  r.text(8, 7, f.title, INK, 2);
  const x = (row: Row, t: number) => LEFT + ((t - row.t0) / span) * plotW;
  return { r, rows, span, plotW, x };
}

/** Time ticks and m:ss labels under a row, plus the marks through it. */
function decorate(r: Raster, f: TimeFrame, row: Row, bodyH: number, span: number, plotW: number, x: (row: Row, t: number) => number) {
  const pxPerS = plotW / span;
  const step = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find((s) => s * pxPerS >= 70) ?? 1200;
  const yAxis = row.y + bodyH;
  for (let t = Math.ceil(row.t0 / step) * step; t <= row.t1 + 1e-6; t += step) {
    const xx = x(row, t);
    r.vline(xx, row.y, yAxis, GRID, 0.35);
    r.vline(xx, yAxis, yAxis + 3, DIM);
    r.text(xx - textWidth(clock(t)) / 2, yAxis + 6, clock(t), DIM);
  }
  // Labels left to right; one that would overprint the previous label drops a line, then is skipped.
  const free = [-Infinity, -Infinity];
  for (const m of [...(f.marks ?? [])].sort((a, b) => a.t - b.t)) {
    if (m.t < row.t0 || m.t > row.t1) continue;
    const xx = x(row, m.t);
    r.vline(xx, row.y, yAxis - 1, m.color, 0.9, 3);
    const line = m.label ? free.findIndex((end) => xx + 3 > end) : -1;
    if (line < 0) continue;
    free[line] = xx + 3 + textWidth(m.label!) + 4;
    r.label(xx + 3, row.y + 2 + line * 9, m.label!, m.color);
  }
}

/** Mean of `values` over song seconds [a, b) (sampled every `hop`), NaN when none is finite. */
function meanOver(values: ArrayLike<number>, hop: number, a: number, b: number): number {
  const i0 = Math.max(0, Math.floor(a / hop)), i1 = Math.min(values.length, Math.max(i0 + 1, Math.ceil(b / hop)));
  let s = 0, n = 0;
  for (let i = i0; i < i1; i++) {
    const v = values[i];
    if (Number.isFinite(v)) {
      s += v;
      n++;
    }
  }
  return n ? s / n : NaN;
}

/** Lanes of lines, areas or stacked shares over song time; `hop` is the seconds between values. */
export function linePlot(file: string, f: TimeFrame & { hop: number; lanes: Lane[] }): void {
  const bodyH = f.lanes.reduce((s, l) => s + l.height + 4, 0);
  const { r, rows, span, plotW, x } = layout(f, bodyH);
  for (const row of rows) {
    let ly = row.y;
    const xEnd = x(row, row.t1);
    for (const lane of f.lanes) {
      const [lo, hi] = lane.range ?? [0, 1];
      const yOf = (v: number) => ly + lane.height - 1 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * (lane.height - 1);
      r.rect(LEFT, ly, xEnd - LEFT, lane.height, PANEL);
      r.text(LEFT - 4 - textWidth(fmt(hi)), ly, fmt(hi), DIM);
      r.text(LEFT - 4 - textWidth(fmt(lo)), ly + lane.height - 5, fmt(lo), DIM);
      for (let px = Math.floor(LEFT); px < xEnd; px++) {
        const a = row.t0 + ((px - LEFT) / plotW) * span, b = a + span / plotW;
        let base = 0;
        for (const s of lane.stack ?? []) {
          const v = meanOver(s.values, f.hop, a, b);
          if (!Number.isFinite(v) || v <= 0) continue;
          r.vline(px, yOf(base + v), yOf(base), s.color);
          base += v;
        }
        for (const s of lane.series ?? []) {
          const v = meanOver(s.values, f.hop, a, b);
          if (!Number.isFinite(v)) continue;
          if (s.fill) r.vline(px, yOf(v), yOf(lo), s.color, 0.65);
          else {
            const prev = meanOver(s.values, f.hop, a - span / plotW, a);
            const y1 = yOf(v), y0 = Number.isFinite(prev) ? yOf(prev) : y1;
            r.vline(px, Math.min(y0, y1), Math.max(y0, y1), s.color);
          }
        }
      }
      // Lane name and legend, top-left inside the lane.
      let lx = LEFT + 4;
      lx += r.label(lx, ly + 3, lane.label, INK) + 8;
      for (const s of [...(lane.stack ?? []), ...(lane.series ?? [])]) if (s.label) lx += r.label(lx, ly + 3, s.label, s.color) + 8;
      ly += lane.height + 4;
    }
    decorate(r, f, row, bodyH, span, plotW, x);
  }
  writeFileSync(file, r.png());
}

const fmt = (v: number) => (Math.abs(v) >= 10 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1));

/** Sharps only: the 3×5 font has no flat sign, and 'AB3' would read as a word. */
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (midi: number) => `${NOTE[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`;

export interface RollNote {
  start: number;
  end: number;
  midi: number;
  /** 0..1: drawn fainter when unsure. */
  confidence?: number;
}

/**
 * The melody as a piano roll: notes as bars (one row per semitone, a labelled
 * line at every C), the continuous contour as a thin line through them, and
 * optional tags (motif letters) above notes.
 */
export function pianoRoll(
  file: string,
  f: TimeFrame & {
    notes: RollNote[];
    contour?: { hop: number; midi: ArrayLike<number | null> };
    tags?: { t: number; midi: number; label: string; color: Rgb }[];
  },
): void {
  const pitches = f.notes.map((n) => Math.round(n.midi));
  const lo = (pitches.length ? Math.min(...pitches) : 60) - 2;
  const hi = (pitches.length ? Math.max(...pitches) : 72) + 3;
  const semi = Math.max(4, Math.min(9, Math.floor(320 / (hi - lo + 1))));
  const bodyH = (hi - lo + 1) * semi;
  const { r, rows, span, plotW, x } = layout(f, bodyH);
  const NOTE_C: Rgb = [255, 190, 90];
  const LINE_C: Rgb = [110, 200, 255];
  for (const row of rows) {
    const yOf = (m: number) => row.y + (hi - m) * semi;
    const xEnd = x(row, row.t1);
    r.rect(LEFT, row.y, xEnd - LEFT, bodyH, PANEL);
    for (let m = lo; m <= hi; m++) {
      if (m % 12 === 0) {
        r.rect(LEFT, yOf(m) + semi - 1, xEnd - LEFT, 1, GRID, 0.9);
        r.text(LEFT - 4 - textWidth(noteName(m)), yOf(m) + semi - 4, noteName(m), DIM);
      } else if ([2, 4, 5, 7, 9, 11].includes(m % 12) && semi >= 5) r.rect(LEFT, yOf(m) + semi - 1, xEnd - LEFT, 1, GRID, 0.2);
    }
    for (const n of f.notes) {
      if (n.end < row.t0 || n.start > row.t1) continue;
      const x0 = x(row, Math.max(row.t0, n.start)), x1 = x(row, Math.min(row.t1, n.end));
      r.rect(x0, yOf(Math.round(n.midi)), Math.max(1, x1 - x0), semi - 1, NOTE_C, 0.35 + 0.65 * (n.confidence ?? 1));
    }
    const c = f.contour;
    if (c) {
      for (let px = Math.floor(LEFT); px < xEnd; px++) {
        const t = row.t0 + ((px - LEFT) / plotW) * span;
        const v = c.midi[Math.round(t / c.hop)];
        if (v != null && Number.isFinite(v) && v >= lo - 0.5 && v <= hi + 0.5) r.set(px, yOf(v) + semi / 2, LINE_C, 0.9);
      }
    }
    for (const tag of f.tags ?? []) {
      if (tag.t < row.t0 || tag.t > row.t1) continue;
      r.label(x(row, tag.t), Math.max(row.y + 1, yOf(Math.round(tag.midi)) - 9), tag.label, tag.color);
    }
    decorate(r, f, row, bodyH, span, plotW, x);
  }
  writeFileSync(file, r.png());
}

/** Black → violet → orange → pale yellow. */
const HEAT: Rgb[] = [[0, 0, 4], [60, 15, 110], [180, 50, 120], [250, 140, 60], [252, 250, 190]];
function heat(v: number): Rgb {
  const p = Math.min(1, Math.max(0, v)) * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(p)), k = p - i;
  return [0, 1, 2].map((j) => HEAT[i][j] + (HEAT[i + 1][j] - HEAT[i][j]) * k) as Rgb;
}

/**
 * Columns of 0..1 values (index 0 at the bottom), evenly spread over the piece, as a
 * heat map in one row (`rowSeconds` is ignored). `yTicks` label heights (0 bottom … 1 top).
 */
export function heatmap(file: string, f: TimeFrame & { columns: ArrayLike<number>[]; height: number; yTicks?: { at: number; label: string }[] }): void {
  const { r, rows, span, plotW, x } = layout({ ...f, rowSeconds: undefined }, f.height);
  const row = rows[0];
  const n = f.columns.length;
  for (let px = 0; px < plotW; px++) {
    const col = f.columns[Math.min(n - 1, Math.floor((px / plotW) * n))];
    if (!col) continue;
    for (let y = 0; y < f.height; y++) {
      const v = col[Math.min(col.length - 1, Math.floor(((f.height - 1 - y) / f.height) * col.length))];
      r.set(LEFT + px, row.y + y, heat(v));
    }
  }
  for (const tk of f.yTicks ?? []) {
    const y = row.y + (1 - tk.at) * (f.height - 1);
    r.rect(LEFT - 3, y, 3, 1, DIM);
    r.text(LEFT - 6 - textWidth(tk.label), y - 2, tk.label, DIM);
  }
  decorate(r, f, row, f.height, span, plotW, x);
  writeFileSync(file, r.png());
}
