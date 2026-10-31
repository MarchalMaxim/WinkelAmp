// YourMT3+ (scripts/ears/ymt3.py) from Node: its config (ymt3.json, written by `npm run setup-ymt3`), probing, running it.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { REPO } from './pack-io';
import { tail } from './python';

export const YMT3_PY = resolve(REPO, 'scripts', 'ears', 'ymt3.py');
export const SETUP_HINT = 'npm run setup-ymt3';

/** What setup-ymt3 writes: the venv's python, the Space's source folder, the checkpoint, and where they came from. */
export interface Ymt3Config { python: string; src: string; ckpt: string; revision: string; sha256: string; installed: string }

/**
 * Whether a Python tool can run. The same shape as `ToolStatus` in src/studio/ingest/ears-types.ts (§4), which T11
 * owns; declared here so this file needs nothing of T11's.
 */
export interface ToolStatus { ok: boolean; python: string | null; reason?: string }

/** The default install folder: %LOCALAPPDATA%/WinkelAmp/ymt3 (or ~/.local/share elsewhere). */
export function defaultYmt3Dir(): string {
  const base = process.env.LOCALAPPDATA || join(process.env.HOME || process.env.USERPROFILE || '.', '.local', 'share');
  return resolve(base, 'WinkelAmp', 'ymt3');
}

/** WINKELAMP_YMT3 (a ymt3.json, or the folder that holds one), else <defaultYmt3Dir>/ymt3.json. */
export function ymt3ConfigPath(): string {
  const env = process.env.WINKELAMP_YMT3;
  if (!env) return join(defaultYmt3Dir(), 'ymt3.json');
  const p = resolve(env);
  if (/\.json$/i.test(p)) return p;
  return join(p, 'ymt3.json');
}

const KEYS: (keyof Ymt3Config)[] = ['python', 'src', 'ckpt', 'revision', 'sha256', 'installed'];

/** The config if it is there and its python, source and checkpoint exist; else why not, naming `npm run setup-ymt3`. */
export function findYmt3(): { config: Ymt3Config } | { missing: string } {
  const path = ymt3ConfigPath();
  if (!existsSync(path) || !statSync(path).isFile()) return { missing: `YourMT3 is not set up: no ${path} (${SETUP_HINT})` };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { missing: `YourMT3's config ${path} is not valid JSON (${(e as Error).message}): run ${SETUP_HINT} again` };
  }
  const o = raw as Record<string, unknown>;
  const bad = KEYS.filter((k) => typeof o?.[k] !== 'string');
  if (bad.length) return { missing: `YourMT3's config ${path} lacks ${bad.join(', ')}: run ${SETUP_HINT} again` };
  const config = Object.fromEntries(KEYS.map((k) => [k, o[k]])) as unknown as Ymt3Config;
  const checks: [string, string, boolean][] = [
    ['python', config.python, true],
    ['source', config.src, false],
    ['checkpoint', config.ckpt, true],
  ];
  for (const [what, p, file] of checks) {
    const ok = existsSync(p) && (file ? statSync(p).isFile() : statSync(p).isDirectory());
    if (!ok) return { missing: `YourMT3's ${what} is missing at ${p} (from ${path}): run ${SETUP_HINT} again` };
  }
  return { config };
}

const env = () => ({ ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' });

/** The arguments every run gives ymt3.py (isolated mode; -I ignores PYTHONDONTWRITEBYTECODE, so ymt3.py sets it itself). */
const baseArgs = (c: Ymt3Config) => ['-I', YMT3_PY, '--src', c.src, '--ckpt', c.ckpt];

/** Runs `ymt3.py --probe` with a config's python and paths (setup-ymt3 probes before writing ymt3.json). */
export function probeWith(c: Pick<Ymt3Config, 'python' | 'src' | 'ckpt'>, timeoutMs = 120_000): Promise<ToolStatus & { device?: string }> {
  return new Promise((done) => {
    const p = spawn(c.python, [...baseArgs(c as Ymt3Config), '--probe'], { env: env(), timeout: timeoutMs, windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => done({ ok: false, python: c.python, reason: `cannot run ${c.python}: ${e.message}` }));
    p.on('close', (code, signal) => {
      try {
        const r = JSON.parse(out.trim().split('\n').pop() ?? '') as { ok: boolean; device?: string; reason?: string };
        done(r.ok ? { ok: true, python: c.python, device: r.device } : { ok: false, python: c.python, reason: r.reason });
      } catch {
        const why = signal ? `timed out after ${timeoutMs / 1000} s` : `exit ${code}`;
        done({ ok: false, python: c.python, reason: `YourMT3 probe failed (${why}): ${tail(err) || 'no output'}` });
      }
    });
  });
}

/** `ymt3.py --probe` through ymt3.json (imports torch and the Space's modules, checks the checkpoint; no model load). */
export function probeYmt3(): Promise<ToolStatus> {
  const f = findYmt3();
  if ('missing' in f) return Promise.resolve({ ok: false, python: null, reason: f.missing });
  return probeWith(f.config).then(({ ok, python, reason }) => (ok ? { ok, python } : { ok, python, reason }));
}

/** Runs ymt3.py on `audio`, writing `out` (the JSON of §4); rejects with the stderr tail on any failure. */
export function runYmt3(audio: string, out: string, onProgress?: (f: number) => void): Promise<void> {
  const f = findYmt3();
  if ('missing' in f) return Promise.reject(new Error(f.missing));
  const c = f.config;
  return new Promise((done, fail) => {
    const p = spawn(c.python, [...baseArgs(c), '--revision', c.revision, audio, out], { env: env(), windowsHide: true });
    let err = '', partial = '';
    p.stdout.resume();
    p.stderr.on('data', (d: Buffer) => {
      const text = partial + d.toString();
      const lines = text.split(/\r?\n/);
      partial = lines.pop() ?? '';
      for (const line of lines) {
        const m = /^progress ([\d.]+)$/.exec(line.trim());
        if (m) onProgress?.(Number(m[1]));
        else err += line + '\n';
      }
    });
    p.on('error', (e) => fail(new Error(`cannot run ${c.python}: ${e.message}`)));
    p.on('close', (code) => {
      err += partial;
      if (code === 0) done();
      else fail(new Error(`${c.python} ${YMT3_PY} exited ${code}:\n${tail(err) || '(no output)'}`));
    });
  });
}
