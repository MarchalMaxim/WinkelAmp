/// <reference types="node" />
// The ears server's /health v2 (the piano model, YourMT3+ and basic-pitch, each saying why it cannot run) and the
// probes it uses by default when nothing is installed.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { probeBp, probeTranscriber } from '../scripts/node/python';
import { probeYmt3 } from '../scripts/node/ymt3';
import { startEars } from '../scripts/ears/server';
import { CHECKING_TRANSCRIBER, type EarsHealth, type Job, type ToolStatus } from '../src/studio/ingest/ears-types';

const tmp = mkdtempSync(join(tmpdir(), 'wa-ears-tools-'));
const saved = { py: process.env.WINKELAMP_PY, bp: process.env.WINKELAMP_PY_BP, ymt3: process.env.WINKELAMP_YMT3 };
afterEach(() => {
  for (const [k, v] of [['WINKELAMP_PY', saved.py], ['WINKELAMP_PY_BP', saved.bp], ['WINKELAMP_YMT3', saved.ymt3]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const health = async (port: number) => (await (await fetch(`http://127.0.0.1:${port}/health`)).json()) as EarsHealth;
const noYmt3: ToolStatus = { ok: false, python: null, reason: 'YourMT3 is not set up: no C:/x/ymt3.json (npm run setup-ymt3)' };

describe('/health, api 2', () => {
  it('names the three tools, with the reason of the one that cannot run', async () => {
    const ears = await startEars({
      port: 0, songs: join(tmp, 'songs'),
      probe: async () => ({ ok: true, python: 'py', device: 'cuda' }),
      probeYmt3: async () => noYmt3,
      probeBp: async () => ({ ok: true, python: 'bp-py' }),
    });
    try {
      await new Promise((r) => setTimeout(r, 20));
      expect(await health(ears.port)).toEqual({
        ok: true, api: 2,
        transcriber: { ok: true, python: 'py', device: 'cuda' },
        ymt3: noYmt3,
        bp: { ok: true, python: 'bp-py' },
      });
    } finally { await ears.close(); }
  });

  it('says a tool is still being checked (not that it is missing) until its probe answers', async () => {
    let answer: (s: ToolStatus) => void = () => {};
    const ears = await startEars({
      port: 0, songs: join(tmp, 'songs'),
      probe: async () => ({ ok: true, python: 'py', device: 'cuda' }),
      probeYmt3: () => new Promise<ToolStatus>((r) => (answer = r)),
      probeBp: async () => { throw new Error('boom'); },
    });
    try {
      await new Promise((r) => setTimeout(r, 20));
      const h = await health(ears.port);
      expect(h.ymt3).toEqual({ ok: false, python: null, reason: CHECKING_TRANSCRIBER });
      expect(h.bp).toEqual({ ok: false, python: null, reason: 'the basic-pitch probe failed: boom' });
      answer({ ok: true, python: 'py' });
      await new Promise((r) => setTimeout(r, 20));
      expect((await health(ears.port)).ymt3).toEqual({ ok: true, python: 'py' });
    } finally { await ears.close(); }
  });

  it("follows ingest's own overall progress when its lines carry it", async () => {
    const LINES = String.raw`
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
(async () => {
  for (const [stage, progress, overall] of [['decode', 1, 0.03], ['transcribe', 1, 0.33], ['instruments', 0.5, 0.48], ['analyze', 0, 0.63], ['write', 1, 1]]) {
    out({ stage, progress, overall, message: stage }); await new Promise((r) => setTimeout(r, 120));
  }
  process.exit(1);
})();`;
    const ears = await startEars({
      port: 0, songs: join(tmp, 'songs'),
      probe: async () => ({ ok: true, python: 'py', device: 'cuda' }), probeYmt3: async () => noYmt3, probeBp: async () => noYmt3,
      runIngest: (args) => spawn(process.execPath, ['-e', LINES, ...args]),
    });
    try {
      const r = await fetch(`http://127.0.0.1:${ears.port}/ingest?name=x.wav`, { method: 'POST', body: 'x' });
      const { job } = (await r.json()) as { job: string };
      const seen: Job[] = [];
      for (let i = 0; i < 200; i++) {
        const j = (await (await fetch(`http://127.0.0.1:${ears.port}/jobs/${job}`)).json()) as Job;
        seen.push(j);
        if (j.state === 'failed' || j.state === 'done') break;
        await new Promise((res) => setTimeout(res, 15));
      }
      const inst = seen.find((j) => j.stage === 'instruments');
      expect(inst?.progress).toBeCloseTo(0.48 * 0.999, 3);
    } finally { await ears.close(); }
  });
});

describe('the default probes with nothing installed', () => {
  it('YourMT3: not set up, naming npm run setup-ymt3', async () => {
    process.env.WINKELAMP_YMT3 = join(tmp, 'nowhere');
    expect(await probeYmt3()).toEqual({ ok: false, python: null, reason: expect.stringContaining('npm run setup-ymt3') });
  });
  it("basic-pitch: its python cannot run, naming it", async () => {
    const py = join(tmp, 'no-bp', 'python.exe');
    process.env.WINKELAMP_PY_BP = py;
    const s = await probeBp();
    expect(s.ok).toBe(false);
    expect(s.python).toBe(py);
    expect(s.reason).toContain(py);
  });
  it('the piano model: its python cannot run, naming it', async () => {
    const py = join(tmp, 'no-py', 'python.exe');
    process.env.WINKELAMP_PY = py;
    const s = await probeTranscriber();
    expect(s).toMatchObject({ ok: false, python: py, device: null });
    expect(s.reason).toContain(py);
  });
});
