// The GPU transcriber (scripts/ears/transcribe.py) from Node: finding Python, probing, running it.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TranscriberStatus } from '../../src/studio/ingest/ears-types';
import { REPO } from './pack-io';

export const TRANSCRIBE_PY = resolve(REPO, 'scripts', 'ears', 'transcribe.py');
const VENV_PY = 'C:/Users/maxim/.venvs/wa/Scripts/python.exe';
const ENV = { ...process.env, PYTHONIOENCODING: 'utf-8' };

/** WINKELAMP_PY as given (no fallback: a wrong path should fail, not find another Python), else the venv, else `python` on PATH. */
export function findPython(): string | null {
  if (process.env.WINKELAMP_PY) return process.env.WINKELAMP_PY;
  if (existsSync(VENV_PY)) return VENV_PY;
  const r = spawnSync('python', ['--version'], { encoding: 'utf8', timeout: 10_000 });
  return r.status === 0 ? 'python' : null;
}

/** `transcribe.py --probe` (imports torch, checks the checkpoint; no model load). */
export function probeTranscriber(): Promise<TranscriberStatus> {
  const python = findPython();
  if (!python) return Promise.resolve({ ok: false, python: null, device: null, reason: 'no Python found: set WINKELAMP_PY' });
  return new Promise((done) => {
    const p = spawn(python, [TRANSCRIBE_PY, '--probe'], { env: ENV, timeout: 90_000, windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => done({ ok: false, python, device: null, reason: `cannot run ${python}: ${e.message}` }));
    p.on('close', (code) => {
      try {
        const r = JSON.parse(out.trim().split('\n').pop() ?? '') as { ok: boolean; device?: 'cuda' | 'cpu'; reason?: string };
        done(r.ok ? { ok: true, python, device: r.device ?? null } : { ok: false, python, device: null, reason: r.reason });
      } catch {
        done({ ok: false, python, device: null, reason: `probe failed (exit ${code}): ${tail(err) || 'no output'}` });
      }
    });
  });
}

/** The last lines of a process's stderr, for an error message. */
export const tail = (s: string, lines = 12) => s.trim().split(/\r?\n/).slice(-lines).join('\n');

/** Runs transcribe.py on `audio`, writing `out`; rejects with the stderr tail on any failure. */
export function transcribe(audio: string, out: string, onProgress?: (f: number) => void): Promise<void> {
  const python = findPython();
  if (!python) return Promise.reject(new Error('no Python found (set WINKELAMP_PY to the venv python.exe)'));
  return new Promise((done, fail) => {
    const p = spawn(python, [TRANSCRIBE_PY, audio, out], { env: ENV, windowsHide: true });
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
      else fail(new Error(`${python} ${TRANSCRIBE_PY} exited ${code}:\n${tail(err) || '(no output)'}`));
    });
  });
}
