/**
 * Installs YourMT3+ outside the repo, for ingest's instrument tracks:
 *
 *   npm run setup-ymt3 -- --from <Space folder> [--ckpt <moe.ckpt>] [--python <exe>] [--dir <install>]
 *
 * <Space folder> is a download of the Hugging Face Space "mimbres/YourMT3" (app.py, model_helper.py, amt/src/…).
 * Copies amt/src/** and model_helper.py to <dir>/src, the MoE checkpoint to <dir>/ck/moe.ckpt (a short path:
 * the Space's own is longer than Windows' MAX_PATH from many folders), checks its sha256, runs
 * `ymt3.py --probe` with <python>, and only then writes <dir>/ymt3.json, which scripts/node/ymt3.ts reads.
 * Defaults: --dir %LOCALAPPDATA%/WinkelAmp/ymt3, --python C:/Users/maxim/.venvs/wa-mt/Scripts/python.exe
 * (a venv made from scripts/ears/requirements-ymt3.txt), --ckpt the Space's own MoE checkpoint.
 * Exit codes: 1 a failed step (named), 2 usage.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { defaultYmt3Dir, probeWith, type Ymt3Config } from './node/ymt3';

export const MOE_SHA256 = 'ae38e415c79efd5592dcb9b658cdb99ddb11d4c4e1eaa364cab04a052473fc25';
export const SPACE_REVISION = '5e66c1ea173a8186e0d20432b841d3180cc015b5';
const DEFAULT_PYTHON = 'C:/Users/maxim/.venvs/wa-mt/Scripts/python.exe';
const SPACE_CKPT = ['amt', 'logs', '2024', 'mc13_256_g4_all_v7_mt3f_sqr_rms_moe_wf4_n8k2_silu_rope_rp_b36_nops', 'checkpoints', 'last.ckpt'];
// Not copied: caches and editor litter, and extras/auth2 (a YouTube sign-in token the Space ships; nothing imports extras/).
const SKIP = new Set(['__pycache__', '.DS_Store', '.coverage', '.pytest_cache']);
const SKIP_PATHS = [join('extras', 'auth2')];

const USAGE = 'usage: npm run setup-ymt3 -- --from <Space folder> [--ckpt <moe.ckpt>] [--python <exe>] [--dir <install>]';

function die(msg: string, code = 1): never {
  console.error(`setup-ymt3: ${msg}`);
  process.exit(code);
}

function parseArgs(argv: string[]): Record<'from' | 'ckpt' | 'python' | 'dir', string | undefined> {
  const o: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const key = a.replace(/^--/, '');
    if (!['from', 'ckpt', 'python', 'dir'].includes(key) || !a.startsWith('--')) {
      if (a === '--download') die('--download is not available: download the Space (with git-lfs) yourself and pass --from', 2);
      die(`unknown argument ${a}\n${USAGE}`, 2);
    }
    if (i + 1 >= argv.length) die(`${a} needs a value\n${USAGE}`, 2);
    o[key] = argv[++i];
  }
  return o as Record<'from' | 'ckpt' | 'python' | 'dir', string | undefined>;
}

function sha256File(path: string): Promise<string> {
  return new Promise((ok, fail) => {
    const h = createHash('sha256');
    createReadStream(path).on('data', (d) => h.update(d)).on('error', fail).on('end', () => ok(h.digest('hex')));
  });
}

/** The Space's revision, from the Hugging Face download cache beside it (first line of any .metadata file), else 'unknown'. */
function spaceRevision(from: string): string {
  const dir = join(from, '.cache', 'huggingface', 'download');
  const stack = existsSync(dir) ? [dir] : [];
  while (stack.length) {
    const d = stack.pop()!;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.endsWith('.metadata')) {
        const line = readFileSync(p, 'utf8').split(/\r?\n/)[0].trim();
        if (/^[0-9a-f]{40}$/.test(line)) return line;
      }
    }
  }
  return 'unknown';
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.from) die(`--from is required\n${USAGE}`, 2);
  const from = resolve(a.from);
  const amtSrc = join(from, 'amt', 'src');
  const helper = join(from, 'model_helper.py');
  if (!existsSync(join(amtSrc, 'model', 'ymt3.py')) || !existsSync(helper)) {
    die(`${from} does not look like the YourMT3 Space (no amt/src/model/ymt3.py or model_helper.py)`);
  }
  const ckptIn = resolve(a.ckpt ?? join(from, ...SPACE_CKPT));
  if (!existsSync(ckptIn)) die(`no checkpoint at ${ckptIn} (pass --ckpt)`);
  const python = resolve(a.python ?? DEFAULT_PYTHON);
  if (!existsSync(python)) die(`no python at ${python} (pass --python, a venv made from scripts/ears/requirements-ymt3.txt)`);
  const dir = resolve(a.dir ?? defaultYmt3Dir());
  const src = join(dir, 'src');
  const ckpt = join(dir, 'ck', 'moe.ckpt');

  console.log(`checking ${ckptIn} (${(statSync(ckptIn).size / 1e6).toFixed(0)} MB)…`);
  const sha = await sha256File(ckptIn);
  if (sha !== MOE_SHA256) die(`sha256 mismatch for ${ckptIn}: ${sha}, expected ${MOE_SHA256} (the YPTF.MoE+Multi noPS checkpoint)`);
  console.log('sha256 ok');

  console.log(`copying the source to ${src}`);
  rmSync(src, { recursive: true, force: true });
  mkdirSync(src, { recursive: true });
  cpSync(amtSrc, src, {
    recursive: true,
    filter: (p) => {
      const rel = relative(amtSrc, p);
      if (rel.split(sep).some((part) => SKIP.has(part))) return false;
      return !SKIP_PATHS.some((s) => rel === s || rel.startsWith(s + sep));
    },
  });
  copyFileSync(helper, join(src, basename(helper)));

  mkdirSync(join(dir, 'ck'), { recursive: true });
  if (resolve(ckptIn) !== resolve(ckpt)) {
    const same = existsSync(ckpt) && statSync(ckpt).size === statSync(ckptIn).size && (await sha256File(ckpt)) === MOE_SHA256;
    if (same) console.log(`checkpoint already at ${ckpt}`);
    else {
      console.log(`copying the checkpoint to ${ckpt}`);
      copyFileSync(ckptIn, ckpt);
    }
  }

  console.log(`probing with ${python}…`);
  const probe = await probeWith({ python, src, ckpt });
  if (!probe.ok) die(`probe failed: ${probe.reason}`);
  console.log(`probe ok: ${probe.device}`);

  const revision = spaceRevision(from);
  const config: Ymt3Config = { python, src, ckpt, revision, sha256: sha, installed: new Date().toISOString() };
  const out = join(dir, 'ymt3.json');
  writeFileSync(out, JSON.stringify(config, null, 2) + '\n');
  console.log(`ymt3.json written: ${out} (Space revision ${revision}${revision === SPACE_REVISION ? '' : `; the tested one is ${SPACE_REVISION}`})`);
}

main().catch((e) => die(e instanceof Error ? e.stack ?? e.message : String(e)));
