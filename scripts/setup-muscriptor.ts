/**
 * Sets up MuScriptor large for ingest's `--instruments-model muscriptor`:
 *
 *   npm run setup-muscriptor -- [--python <exe>] [--dir <install>] [--download]
 *
 * Probes <python> (scripts/ears/muscriptor.py --probe), with --download fetches the weights (5.5 GB, a Hugging Face login
 * that has accepted the licence) if they are absent, and only after a good probe writes <dir>/muscriptor.json, which
 * scripts/node/muscriptor.ts reads. Always prints the licence.
 * Defaults: --dir %LOCALAPPDATA%/WinkelAmp/muscriptor, --python C:/Users/maxim/.venvs/wa-ms/Scripts/python.exe
 * (a venv made from scripts/ears/requirements-muscriptor.txt).
 * Exit codes: 1 a failed step (named), 2 usage.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defaultMsDir, MS_LICENCE, probeMsWith, type MsConfig } from './node/muscriptor';

export const MS_DEFAULT_PYTHON = 'C:/Users/maxim/.venvs/wa-ms/Scripts/python.exe';
const USAGE = 'usage: npm run setup-muscriptor -- [--python <exe>] [--dir <install>] [--download]';

function die(msg: string, code = 1): never {
  console.error(`setup-muscriptor: ${msg}`);
  process.exit(code);
}

function parseArgs(argv: string[]): { python?: string; dir?: string; download: boolean } {
  const o: { python?: string; dir?: string; download: boolean } = { download: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--download') o.download = true;
    else if (a === '--python' || a === '--dir') {
      if (i + 1 >= argv.length) die(`${a} needs a value\n${USAGE}`, 2);
      o[a === '--python' ? 'python' : 'dir'] = argv[++i];
    } else die(`unknown argument ${a}\n${USAGE}`, 2);
  }
  return o;
}

async function main() {
  console.log(`Licence: ${MS_LICENCE}`);
  const a = parseArgs(process.argv.slice(2));
  const python = resolve(a.python ?? MS_DEFAULT_PYTHON);
  if (!existsSync(python)) die(`no python at ${python} (pass --python, a venv made from scripts/ears/requirements-muscriptor.txt)`);
  const dir = resolve(a.dir ?? defaultMsDir());

  console.log(`probing with ${python}…`);
  let probe = await probeMsWith({ python });
  if (!probe.ok) die(`probe failed: ${probe.reason}`);
  if (probe.weights !== 'cached') {
    const hf = join(dirname(python), 'hf');
    if (!a.download) die(`the weights are not downloaded: run ${hf} auth login, accept the licence at https://huggingface.co/MuScriptor/muscriptor-large, then npm run setup-muscriptor -- --download (5.5 GB)`);
    console.log('downloading the weights (5.5 GB)…');
    probe = await probeMsWith({ python }, { fetch: true });
    if (!probe.ok) die(`the download failed: ${probe.reason}`);
    if (probe.weights !== 'cached') die(`the download finished, but the weights are still absent: run ${hf} auth login and --download again`);
  }
  console.log(`probe ok: ${probe.device}, muscriptor ${probe.version}, weights ${probe.weights}`);

  const config: MsConfig = { python, model: 'large', version: probe.version ?? 'unknown', installed: new Date().toISOString() };
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'muscriptor.json');
  writeFileSync(out, JSON.stringify(config, null, 2) + '\n');
  console.log(`muscriptor.json written: ${out}`);
}

main().catch((e) => die(e instanceof Error ? e.stack ?? e.message : String(e)));
