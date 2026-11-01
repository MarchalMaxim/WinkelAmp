// The Python transcribers from Node: the GPU piano model (scripts/ears/transcribe.py) and basic-pitch
// (scripts/ears/bp.py, the gap fill when YourMT3+ is missing): finding their Python, probing, running them.
// YourMT3+ has its own config and runner: scripts/node/ymt3.ts.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ToolStatus, TranscriberStatus } from '../../src/studio/ingest/ears-types';
import { REPO } from './pack-io';

export const TRANSCRIBE_PY = resolve(REPO, 'scripts', 'ears', 'transcribe.py');
export const BP_PY = resolve(REPO, 'scripts', 'ears', 'bp.py');
const VENV_PY = 'C:/Users/maxim/.venvs/wa/Scripts/python.exe';
const VENV_PY_BP = 'C:/Users/maxim/.venvs/wa-bp/Scripts/python.exe';
const ENV = { ...process.env, PYTHONIOENCODING: 'utf-8' };
const BP_ENV = { ...ENV, PYTHONDONTWRITEBYTECODE: '1' };

/** Basic-pitch's settings (the spike's: onset 0.6, frame 0.4, notes of at least 58 ms, melodia on); its cache keys on them. */
export const BP_SETTINGS = { onset: 0.6, frame: 0.4, minMs: 58, melodia: true } as const;
export const BP_HINT = 'set WINKELAMP_PY_BP to a python.exe with basic-pitch (pip install -r scripts/ears/requirements-bp.txt)';

/** WINKELAMP_PY as given (no fallback: a wrong path should fail, not find another Python), else the venv, else `python` on PATH. */
export function findPython(): string | null {
  if (process.env.WINKELAMP_PY) return process.env.WINKELAMP_PY;
  if (existsSync(VENV_PY)) return VENV_PY;
  const r = spawnSync('python', ['--version'], { encoding: 'utf8', timeout: 10_000 });
  return r.status === 0 ? 'python' : null;
}

/** Basic-pitch's Python: WINKELAMP_PY_BP as given, else the wa-bp venv; never `python` on PATH (it would not have basic-pitch). */
export function findPythonBp(): string | null {
  if (process.env.WINKELAMP_PY_BP) return process.env.WINKELAMP_PY_BP;
  return existsSync(VENV_PY_BP) ? VENV_PY_BP : null;
}

/** The last lines of a process's stderr, for an error message. */
export const tail = (s: string, lines = 12) => s.trim().split(/\r?\n/).slice(-lines).join('\n');

/** Runs `python args…` and reads the JSON its last stdout line prints (a --probe). */
function probeJson(python: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs: number):
  Promise<{ json: { ok: boolean; device?: 'cuda' | 'cpu'; reason?: string } } | { failed: string }> {
  return new Promise((done) => {
    const p = spawn(python, args, { env, timeout: timeoutMs, windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => done({ failed: `cannot run ${python}: ${e.message}` }));
    p.on('close', (code, signal) => {
      try {
        done({ json: JSON.parse(out.trim().split('\n').pop() ?? '') as { ok: boolean; device?: 'cuda' | 'cpu'; reason?: string } });
      } catch {
        const why = signal ? `timed out after ${timeoutMs / 1000} s` : `exit ${code}`;
        done({ failed: `probe failed (${why}): ${tail(err) || 'no output'}` });
      }
    });
  });
}

/** `transcribe.py --probe` (imports torch, checks the checkpoint; no model load). */
export async function probeTranscriber(): Promise<TranscriberStatus> {
  const python = findPython();
  if (!python) return { ok: false, python: null, device: null, reason: 'no Python found: set WINKELAMP_PY' };
  const r = await probeJson(python, [TRANSCRIBE_PY, '--probe'], ENV, 90_000);
  if ('failed' in r) return { ok: false, python, device: null, reason: r.failed };
  return r.json.ok ? { ok: true, python, device: r.json.device ?? null } : { ok: false, python, device: null, reason: r.json.reason };
}

/** `bp.py --probe` (imports basic-pitch, checks its ONNX model; no inference). */
export async function probeBp(): Promise<ToolStatus> {
  const python = findPythonBp();
  if (!python) return { ok: false, python: null, reason: `basic-pitch is not set up: ${BP_HINT}` };
  const r = await probeJson(python, ['-I', BP_PY, '--probe'], BP_ENV, 120_000);
  if ('failed' in r) return { ok: false, python, reason: `basic-pitch ${r.failed}` };
  return r.json.ok ? { ok: true, python } : { ok: false, python, reason: r.json.reason };
}

/** Runs a Python script; `progress <f>` lines on stderr go to onProgress; rejects with the stderr tail on any failure. */
function runPy(python: string, args: string[], env: NodeJS.ProcessEnv, onProgress?: (f: number) => void): Promise<void> {
  return new Promise((done, fail) => {
    const p = spawn(python, args, { env, windowsHide: true });
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
    p.on('error', (e) => fail(new Error(`cannot run ${python}: ${e.message}`)));
    p.on('close', (code) => {
      err += partial;
      if (code === 0) done();
      else fail(new Error(`${python} ${args.find((a) => a.endsWith('.py')) ?? ''} exited ${code}:\n${tail(err) || '(no output)'}`));
    });
  });
}

/** Runs transcribe.py on `audio`, writing `out`; rejects with the stderr tail on any failure. */
export function transcribe(audio: string, out: string, onProgress?: (f: number) => void): Promise<void> {
  const python = findPython();
  if (!python) return Promise.reject(new Error('no Python found (set WINKELAMP_PY to the venv python.exe)'));
  return runPy(python, [TRANSCRIBE_PY, audio, out], ENV, onProgress);
}

/**
 * Runs bp.py on `audio` with BP_SETTINGS, writing `out` ({version, model, settings, seconds, notes: [[s, e, midi, vel]]});
 * rejects with the stderr tail on any failure.
 */
export function runBp(audio: string, out: string, onProgress?: (f: number) => void): Promise<void> {
  const python = findPythonBp();
  if (!python) return Promise.reject(new Error(`basic-pitch is not set up: ${BP_HINT}`));
  const s = BP_SETTINGS;
  return runPy(python, ['-I', BP_PY, audio, out, '--onset', String(s.onset), '--frame', String(s.frame),
    '--min-ms', String(s.minMs), ...(s.melodia ? [] : ['--no-melodia'])], BP_ENV, onProgress);
}
