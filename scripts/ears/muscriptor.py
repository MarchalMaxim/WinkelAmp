"""Instrument notes for song packs: MuScriptor (a non-commercial model, CC-BY-NC; see npm run setup-muscriptor).

    python -I muscriptor.py <audio> <out.json> [--model large] [--instruments a,b,c] [--device auto|cuda|cpu] [--dtype float32|bfloat16]
    python -I muscriptor.py --probe [--fetch] [--model large]

Writes {version: 1, model: 'muscriptor-large', package: '0.4.0', instruments: [...] | null, dtype, device, seconds,
notes: [[start, end, midi, 100, name], ...]}: times in seconds of this file, rounded to 3 places, rows sorted by
(start, midi), `seconds` how long loading and transcribing took. `name` is MuScriptor's own ("violin", "flutes"):
src/studio/pack/muscriptor.ts is the only map. The velocity is the number 100 (the model has none), because ingest's
okRow and cleanRows reject null and 0, and every note would silently vanish.
--probe prints {"ok": true, "device": "cuda", "version": "0.4.0", "weights": "cached" | "absent"} or {"ok": false,
"reason": ...} without loading the model; --fetch downloads the weights first (5.5 GB, a Hugging Face login).
Progress goes to stderr as lines "progress <0..1> <completed>/<total>" in 5 s chunks; stdout carries only the probe.
Exit codes: 2 usage, 3 a missing package or weights, 4 the audio cannot be decoded, 1 anything else.
Run it isolated (-I) in the MuScriptor venv (scripts/ears/requirements-muscriptor.txt).
"""
import sys

# -I implies -E, which ignores PYTHONDONTWRITEBYTECODE and PYTHONIOENCODING: set both here (the library prints arrows).
sys.dont_write_bytecode = True
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import contextlib  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import subprocess  # noqa: E402
import time  # noqa: E402
import traceback  # noqa: E402

# This file has the package's name. -I keeps its folder off sys.path; this covers a run without -I too.
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:] = [p for p in sys.path if os.path.abspath(p or '.') != HERE]

SR = 16000
SETUP = 'npm run setup-muscriptor'
WEIGHTS = 'model.safetensors'
CONFIG = 'config.json'
REPO = 'MuScriptor/muscriptor-{}'


def fail(code, reason):
    print(f'muscriptor.py: {reason}', file=sys.stderr, flush=True)
    sys.exit(code)


def parse(argv):
    opts = {'probe': False, 'fetch': False, 'model': 'large', 'instruments': None, 'device': 'auto', 'dtype': 'float32'}
    pos = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ('--probe', '--fetch'):
            opts[a[2:]] = True
        elif a in ('--model', '--instruments', '--device', '--dtype'):
            if i + 1 >= len(argv):
                return None, None
            opts[a[2:]] = argv[i + 1]
            i += 1
        elif a.startswith('--'):
            return None, None
        else:
            pos.append(a)
        i += 1
    if opts['model'] != 'large' or opts['device'] not in ('auto', 'cuda', 'cpu') or opts['dtype'] not in ('float32', 'bfloat16'):
        return None, None
    if opts['probe'] != (len(pos) == 0) or len(pos) not in (0, 2) or (opts['fetch'] and not opts['probe']):
        return None, None
    if opts['instruments'] is not None:
        opts['instruments'] = [x.strip() for x in opts['instruments'].split(',') if x.strip()]
        if not opts['instruments']:
            return None, None
    return opts, pos


def import_all():
    """Imports torch and the package (their prints go to stderr). Returns (modules, None) or (None, reason)."""
    try:
        with contextlib.redirect_stdout(sys.stderr):
            import torch
            import huggingface_hub
            import muscriptor
            from muscriptor.events import NoteEndEvent, ProgressEvent
            from muscriptor.tokenizer.mt3 import MT3_FULL_PLUS_GROUP_NAMES
            from muscriptor.transcription_model import TranscriptionModel
            from muscriptor.utils.audio import load_audio
    except ImportError as e:
        return None, (f'missing Python package ({e.name or e}): pip install -r scripts/ears/requirements-muscriptor.txt '
                      f'into {sys.executable}, then {SETUP}')
    print(f'muscriptor package: {os.path.dirname(muscriptor.__file__)}', file=sys.stderr, flush=True)
    return dict(torch=torch, hub=huggingface_hub, names=MT3_FULL_PLUS_GROUP_NAMES, model=TranscriptionModel,
                end=NoteEndEvent, progress=ProgressEvent, load_audio=load_audio), None


def package_version():
    from importlib.metadata import version
    return version('muscriptor')


def weights_state(hub, model):
    """'cached' or 'absent', with no network and no loading (the lookup's "known absent" answer is not a path)."""
    p = hub.try_to_load_from_cache(REPO.format(model), WEIGHTS)
    return 'cached' if isinstance(p, str) and os.path.isfile(p) else 'absent'


def probe(opts):
    m, err = import_all()
    if err:
        return {'ok': False, 'reason': err}, 3
    if opts['fetch']:
        repo = REPO.format(opts['model'])
        try:
            with contextlib.redirect_stdout(sys.stderr):
                m['hub'].hf_hub_download(repo, WEIGHTS)
        except Exception as e:
            first = (str(e).strip().splitlines() or [type(e).__name__])[0]
            return {'ok': False, 'reason': (f'cannot download {repo} ({first}): accept its licence at '
                                            f'https://huggingface.co/{repo}, then run hf auth login')}, 3
        with contextlib.suppress(Exception), contextlib.redirect_stdout(sys.stderr):
            m['hub'].hf_hub_download(repo, CONFIG)  # the package falls back on its own table without it
    device = 'cuda' if m['torch'].cuda.is_available() else 'cpu'
    return {'ok': True, 'device': device, 'version': package_version(), 'weights': weights_state(m['hub'], opts['model'])}, 0


def decode(path, m):
    """The library's own reader (how the overnight files were made), else ffmpeg for what libsndfile cannot read (m4a…)."""
    if not os.path.isfile(path):
        fail(4, f'no such file: {path}')
    try:
        wav = m['load_audio'](path, target_sr=SR)
    except Exception:
        try:
            r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                               capture_output=True)
        except FileNotFoundError:
            fail(4, f'cannot read {path}, and ffmpeg is not on PATH')
        if r.returncode != 0 or not r.stdout:
            fail(4, f'cannot decode {path}: {r.stderr.decode(errors="replace").strip() or "no audio"}')
        wav = m['torch'].frombuffer(bytearray(r.stdout), dtype=m['torch'].float32)[None]
    if wav.shape[-1] == 0:
        fail(4, f'no audio in {path}')
    return wav


def check_out(out):
    """A path that cannot be opened (Windows refuses one over 260 characters) answers now, not after the whole GPU run.
    The cause comes first: whoever reads this may cut a long path, and the cause with it."""
    existed = os.path.exists(out)
    try:
        with open(out, 'a', encoding='utf-8'):
            pass
    except OSError as e:
        fail(2, f'cannot write the output ({e.strerror or type(e).__name__}; a path of {len(out)} characters, Windows refuses over 260): {out}')
    if not existed:
        os.remove(out)


def transcribe(opts, audio_path, out):
    check_out(out)
    m, err = import_all()
    if err:
        fail(3, err)
    unknown = [x for x in opts['instruments'] or [] if x not in m['names']]
    if unknown:
        fail(2, f'unknown instrument(s) {", ".join(unknown)}; the names are {", ".join(m["names"])}')
    if weights_state(m['hub'], opts['model']) != 'cached':
        fail(3, f'the weights of muscriptor-{opts["model"]} are not downloaded: run {SETUP} -- --download')
    torch = m['torch']
    device = opts['device']
    if device == 'auto':
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
    elif device == 'cuda' and not torch.cuda.is_available():
        fail(3, 'CUDA is not available to this torch build: pass --device cpu (very slow) or install the CUDA build')

    # Decoded first, so a bad file answers before a 5.5 GB model loads; the same tensor the path would have given.
    wav = decode(audio_path, m)
    t0 = time.perf_counter()
    rows = []
    with contextlib.redirect_stdout(sys.stderr):
        model = m['model'].load_model(weights_path=opts['model'], device=device, dtype=opts['dtype'])
        for ev in model.transcribe((wav, SR), instruments=opts['instruments']):
            if isinstance(ev, m['progress']):
                print(f'progress {ev.completed / ev.total if ev.total else 0:.3f} {ev.completed}/{ev.total}', file=sys.stderr, flush=True)
            elif isinstance(ev, m['end']):
                s = ev.start_event
                rows.append([round(float(s.start_time), 3), round(float(ev.end_time), 3), int(s.pitch), 100, s.instrument])
    seconds = time.perf_counter() - t0
    rows.sort(key=lambda r: (r[0], r[2]))
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'version': 1, 'model': f'muscriptor-{opts["model"]}', 'package': package_version(),
                   'instruments': opts['instruments'], 'dtype': opts['dtype'], 'device': device,
                   'seconds': round(seconds, 2), 'notes': rows}, f, separators=(',', ':'))
    print(f'{wav.shape[-1] / SR:.1f} s of audio, {len(rows)} notes, {seconds:.1f} s on {device} in {opts["dtype"]}', file=sys.stderr, flush=True)
    return 0


def main(argv):
    opts, pos = parse(argv)
    if opts is None:
        print(__doc__, file=sys.stderr)
        return 2
    if opts['probe']:
        res, code = probe(opts)
        print(json.dumps(res), flush=True)
        return code
    try:
        return transcribe(opts, pos[0], pos[1])
    except Exception as e:
        traceback.print_exc()
        first = (str(e).strip().splitlines() or [''])[0]
        fail(1, f'{type(e).__name__}: {first}')


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
