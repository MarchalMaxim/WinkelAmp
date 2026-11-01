// MuScriptor (scripts/ears/muscriptor.py) from Node: its config (muscriptor.json, written by `npm run setup-muscriptor`),
// probing, running it. The names it writes are MuScriptor's own: src/studio/pack/muscriptor.ts maps them.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ToolStatus } from '../../src/studio/ingest/ears-types';
import { REPO } from './pack-io';
import { tail } from './python';

export const MUSCRIPTOR_PY = resolve(REPO, 'scripts', 'ears', 'muscriptor.py');
export const MS_SETUP_HINT = 'npm run setup-muscriptor';
/** Said by the setup and in the docs: the weights' licence is what limits this option. */
export const MS_LICENCE = "MuScriptor's weights are CC-BY-NC (non-commercial): own shows and experiments are fine; selling WinkelAmp with it, or renders made from its notes, needs a commercial licence.";
export const MS_DOWNLOAD_WORDS = `${MS_SETUP_HINT} -- --download (5.5 GB)`;
export const MS_PROBE_TIMEOUT_MS = 120_000;
/** Large fills a 16 GB card: a run that says this goes once more in bfloat16. */
export const MS_OOM = /out of memory/i;

/** What setup-muscriptor writes: the venv's python, the model, the package's version, when. */
export interface MsConfig { python: string; model: 'large'; version: string; installed: string }
export type MsDtype = 'float32' | 'bfloat16';

/** The default install folder: %LOCALAPPDATA%/WinkelAmp/muscriptor (or ~/.local/share elsewhere). */
export function defaultMsDir(): string {
  const base = process.env.LOCALAPPDATA || join(process.env.HOME || process.env.USERPROFILE || '.', '.local', 'share');
  return resolve(base, 'WinkelAmp', 'muscriptor');
}

/** WINKELAMP_MUSCRIPTOR (a muscriptor.json, or the folder that holds one), else <defaultMsDir>/muscriptor.json. */
export function msConfigPath(): string {
  const env = process.env.WINKELAMP_MUSCRIPTOR;
  if (!env) return join(defaultMsDir(), 'muscriptor.json');
  const p = resolve(env);
  return /\.json$/i.test(p) ? p : join(p, 'muscriptor.json');
}

const KEYS: (keyof MsConfig)[] = ['python', 'model', 'version', 'installed'];

/** The config if it is there and its python exists; else why not, naming `npm run setup-muscriptor`. */
export function findMuscriptor(): { config: MsConfig } | { missing: string } {
  const path = msConfigPath();
  if (!existsSync(path) || !statSync(path).isFile()) return { missing: `MuScriptor is not set up: no ${path} (${MS_SETUP_HINT})` };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { missing: `MuScriptor's config ${path} is not valid JSON (${(e as Error).message}): run ${MS_SETUP_HINT} again` };
  }
  const o = raw as Record<string, unknown>;
  const bad = KEYS.filter((k) => typeof o?.[k] !== 'string');
  if (bad.length) return { missing: `MuScriptor's config ${path} lacks ${bad.join(', ')}: run ${MS_SETUP_HINT} again` };
  if (o.model !== 'large') return { missing: `MuScriptor's config ${path} names the model ${String(o.model)}, and only large is tested: run ${MS_SETUP_HINT} again` };
  const config = Object.fromEntries(KEYS.map((k) => [k, o[k]])) as unknown as MsConfig;
  if (!existsSync(config.python) || !statSync(config.python).isFile()) {
    return { missing: `MuScriptor's python is missing at ${config.python} (from ${path}): run ${MS_SETUP_HINT} again` };
  }
  return { config };
}

/** Ingest never downloads: a missing model is a quick fallback, not 5.5 GB fetched in silence. Only --fetch lifts this. */
function msEnv(offline: boolean): NodeJS.ProcessEnv {
  const e: NodeJS.ProcessEnv = { ...process.env };
  if (offline) e.HF_HUB_OFFLINE = '1';
  else delete e.HF_HUB_OFFLINE;
  return e;
}

/** Runs `muscriptor.py --probe` with a python (setup-muscriptor probes before writing muscriptor.json); `fetch` downloads first. */
export function probeMsWith(c: Pick<MsConfig, 'python'>, o: { timeoutMs?: number; fetch?: boolean } = {}):
  Promise<ToolStatus & { device?: string; version?: string; weights?: string }> {
  const timeoutMs = o.timeoutMs ?? (o.fetch ? 0 : MS_PROBE_TIMEOUT_MS);
  return new Promise((done) => {
    const args = ['-I', MUSCRIPTOR_PY, '--probe', ...(o.fetch ? ['--fetch'] : [])];
    const p = spawn(c.python, args, { env: msEnv(!o.fetch), timeout: timeoutMs, windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => {
      err += d;
      if (o.fetch) process.stderr.write(d); // a 5.5 GB download's progress bar is for the person waiting
    });
    p.on('error', (e) => done({ ok: false, python: c.python, reason: `cannot run ${c.python}: ${e.message}` }));
    p.on('close', (code, signal) => {
      try {
        const r = JSON.parse(out.trim().split('\n').pop() ?? '') as { ok: boolean; device?: string; version?: string; weights?: string; reason?: string };
        done(r.ok ? { ok: true, python: c.python, device: r.device, version: r.version, weights: r.weights } : { ok: false, python: c.python, reason: r.reason });
      } catch {
        const why = signal ? `timed out after ${timeoutMs / 1000} s` : `exit ${code}`;
        done({ ok: false, python: c.python, reason: `MuScriptor probe failed (${why}): ${tail(err) || 'no output'}` });
      }
    });
  });
}

/** `muscriptor.py --probe` through muscriptor.json (imports torch and the package; no model load). Absent weights are not ok. */
export function probeMuscriptor(): Promise<ToolStatus> {
  const f = findMuscriptor();
  if ('missing' in f) return Promise.resolve({ ok: false, python: null, reason: f.missing });
  return probeMsWith(f.config).then(({ ok, python, reason, weights }) => {
    if (!ok) return { ok, python, reason };
    if (weights !== 'cached') return { ok: false, python, reason: `MuScriptor's weights are not downloaded: run ${MS_DOWNLOAD_WORDS}` };
    return { ok, python };
  });
}

/** One run of muscriptor.py; rejects with `oom` set, the message's first line the last thing the script said. */
function runOnce(c: MsConfig, audio: string, out: string, instruments: readonly string[], dtype: MsDtype | undefined,
  onProgress: (f: number, done: number, total: number) => void): Promise<void> {
  const args = ['-I', MUSCRIPTOR_PY, audio, out, '--model', c.model];
  if (instruments.length) args.push('--instruments', instruments.join(','));
  if (dtype) args.push('--dtype', dtype);
  return new Promise((done, fail) => {
    const p = spawn(c.python, args, { env: msEnv(true), windowsHide: true });
    let err = '', partial = '';
    p.stdout.resume();
    p.stderr.on('data', (d: Buffer) => {
      const text = partial + d.toString();
      const lines = text.split(/\r?\n/);
      partial = lines.pop() ?? '';
      for (const line of lines) {
        const m = /^progress ([\d.]+) (\d+)\/(\d+)$/.exec(line.trim());
        if (m) onProgress(Number(m[1]), Number(m[2]), Number(m[3]));
        else err += line + '\n';
      }
    });
    p.on('error', (e) => fail(new Error(`cannot run ${c.python}: ${e.message}`)));
    p.on('close', (code) => {
      err += partial;
      if (code === 0) return done();
      const text = tail(err);
      const last = text.split(/\r?\n/).pop() || '(no output)';
      fail(Object.assign(new Error(`${last}\nmuscriptor.py exited ${code}:\n${text || '(no output)'}`), { oom: MS_OOM.test(err) }));
    });
  });
}

/**
 * Runs muscriptor.py on `audio`, writing `out` (raw rows with MuScriptor's names; its `dtype` says which ran). Never
 * downloads. Out of memory goes once more in bfloat16, and progress then holds until the retry passes where it stood.
 * Rejects with the reason on the first line, then the stderr tail.
 */
export async function runMuscriptor(audio: string, out: string, o: { instruments: readonly string[]; dtype?: MsDtype },
  onProgress?: (f: number, done: number, total: number) => void): Promise<void> {
  const f = findMuscriptor();
  if ('missing' in f) throw new Error(f.missing);
  let best = -1;
  const report = (x: number, done: number, total: number) => {
    if (x < best) return;
    best = x;
    onProgress?.(x, done, total);
  };
  try {
    await runOnce(f.config, audio, out, o.instruments, o.dtype, report);
  } catch (e) {
    if (!(e as { oom?: boolean }).oom || o.dtype === 'bfloat16') throw e;
    await runOnce(f.config, audio, out, o.instruments, 'bfloat16', report);
  }
}
