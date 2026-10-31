"""Instrument notes for song packs: YourMT3+ (the YPTF.MoE+Multi checkpoint of the Hugging Face Space).

    python -I ymt3.py <audio> <out.json> --src <dir> --ckpt <file> [--device auto|cuda|cpu]
    python -I ymt3.py --probe --src <dir> --ckpt <file>

--src is the Space's amt/src (with model_helper.py beside its packages) and --ckpt the MoE checkpoint;
`npm run setup-ymt3` copies both outside the repo and writes ymt3.json, which scripts/node/ymt3.ts reads.
Writes {version: 1, model: 'yourmt3-moe', revision, seconds, notes: [[start, end, midi, vel, class], ...]}:
times in seconds of this file, `vel` 100 (or 0 for an offset-only row: YourMT3 has no velocities), `class`
a MT3_FULL_PLUS class name ("Violin", "French Horn", "Drums"...), rows sorted by (start, midi); `seconds`
is how long loading and transcribing took.
--probe prints {"ok": true, "device": "cuda", "torch": "..."} or {"ok": false, "reason": "..."} without
loading the model. Progress goes to stderr as lines "progress <0..1>" (stdout stays clean).
Exit codes: 2 usage, 3 a missing package or checkpoint, 4 the audio cannot be decoded, 1 anything else.
Run it isolated (-I) in the YourMT3 venv (scripts/ears/requirements-ymt3.txt).
"""
import sys

# -I implies -E, which ignores PYTHONDONTWRITEBYTECODE: set it here, so no __pycache__ lands in --src.
sys.dont_write_bytecode = True

import contextlib  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import subprocess  # noqa: E402
import time  # noqa: E402

MODEL = 'yourmt3-moe'
SR = 16000
SETUP = 'npm run setup-ymt3'
# The Space's default model (YPTF.MoE+Multi, no pitch shift), with the arguments its app.py passes.
EXP = 'mc13_256_g4_all_v7_mt3f_sqr_rms_moe_wf4_n8k2_silu_rope_rp_b36_nops'
MOE_ARGS = ['-p', '2024', '-tk', 'mc13_full_plus_256', '-dec', 'multi-t5', '-nl', '26', '-enc', 'perceiver-tf',
            '-sqr', '1', '-ff', 'moe', '-wf', '4', '-nmoe', '8', '-kmoe', '2', '-act', 'silu', '-epe', 'rope',
            '-rp', '1', '-ac', 'spec', '-hop', '300', '-atc', '1']
BSZ = 8
CHUNK = BSZ * 2  # segments (2.048 s each) per progress step: a multiple of BSZ, so the batches are the ones of one call


def fail(code, reason):
    print(f'ymt3.py: {reason}', file=sys.stderr, flush=True)
    sys.exit(code)


def parse(argv):
    opts = {'probe': False, 'src': None, 'ckpt': None, 'device': 'auto', 'revision': None}
    pos = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--probe':
            opts['probe'] = True
        elif a in ('--src', '--ckpt', '--device', '--revision'):
            if i + 1 >= len(argv):
                return None, None
            opts[a[2:]] = argv[i + 1]
            i += 1
        elif a.startswith('--'):
            return None, None
        else:
            pos.append(a)
        i += 1
    if not opts['src'] or not opts['ckpt'] or opts['device'] not in ('auto', 'cuda', 'cpu'):
        return None, None
    if opts['probe'] != (len(pos) == 0) or len(pos) not in (0, 2):
        return None, None
    return opts, pos


def problem(src, ckpt):
    """Why YourMT3 cannot run from these paths (a missing folder, module or checkpoint), or None."""
    if not os.path.isfile(os.path.join(src, 'model', 'ymt3.py')) or not os.path.isfile(os.path.join(src, 'model_helper.py')):
        return f'the YourMT3 source is missing or incomplete at {src}: run {SETUP}'
    if not os.path.isfile(ckpt):
        return f'the YourMT3 checkpoint is missing at {ckpt}: run {SETUP}'
    return None


def import_all(src):
    """Imports torch and the Space's modules (their prints go to stderr). Returns (modules, None) or (None, reason)."""
    sys.path.insert(0, src)
    try:
        with contextlib.redirect_stdout(sys.stderr):
            import numpy as np
            import torch
            from config.vocabulary import program_vocab_presets
            from utils.audio import slice_padded_array
            from utils.note2event import mix_notes
            from utils.event2note import merge_zipped_note_events_and_ties_to_notes
            from model_helper import load_model_checkpoint
    except ImportError as e:
        return None, (f'missing Python package ({e.name or e}): pip install -r scripts/ears/requirements-ymt3.txt '
                      f'into {sys.executable}, then {SETUP}')
    return dict(np=np, torch=torch, program_vocab_presets=program_vocab_presets, slice_padded_array=slice_padded_array,
                mix_notes=mix_notes, merge=merge_zipped_note_events_and_ties_to_notes,
                load_model_checkpoint=load_model_checkpoint), None


def decode(path, np):
    try:
        r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                           capture_output=True)
    except FileNotFoundError:
        fail(4, 'ffmpeg not found on PATH')
    if r.returncode != 0 or not r.stdout:
        fail(4, f'cannot decode {path}: {r.stderr.decode(errors="replace").strip() or "no audio"}')
    return np.frombuffer(r.stdout, dtype=np.float32).copy()


def probe(src, ckpt):
    err = problem(src, ckpt)
    if err:
        return {'ok': False, 'reason': err}, 3
    m, err = import_all(src)
    if err:
        return {'ok': False, 'reason': err}, 3
    torch = m['torch']
    return {'ok': True, 'device': 'cuda' if torch.cuda.is_available() else 'cpu', 'torch': torch.__version__}, 0


def transcribe(opts, audio_path, out):
    src, ckpt = os.path.abspath(opts['src']), os.path.abspath(opts['ckpt'])
    err = problem(src, ckpt)
    if err:
        fail(3, err)
    if not os.path.isfile(audio_path):
        fail(4, f'no such file: {audio_path}')
    m, err = import_all(src)
    if err:
        fail(3, err)
    np, torch = m['np'], m['torch']
    device = opts['device']
    if device == 'auto':
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
    elif device == 'cuda' and not torch.cuda.is_available():
        fail(3, 'CUDA is not available to this torch build: pass --device cpu (slow) or install the CUDA build')

    audio = decode(audio_path, np)
    print('progress 0.000', file=sys.stderr, flush=True)
    t0 = time.perf_counter()
    # The Space's config creates "amt/logs" under the working directory: keep that beside the source.
    os.chdir(os.path.dirname(src))
    # "<exp>@<absolute path>": os.path.join drops the logs prefix, so the checkpoint loads from a short path.
    args = [f'{EXP}@{ckpt.replace(os.sep, "/")}'] + MOE_ARGS + ['-pr', '16' if device == 'cuda' else '32']
    with contextlib.redirect_stdout(sys.stderr):
        model = m['load_model_checkpoint'](args=args, device='cpu')
        model.to(device)
    sr = model.audio_cfg['sample_rate']
    frames = model.audio_cfg['input_frames']
    if sr != SR:
        fail(1, f'the model expects {sr} Hz audio, not {SR}')
    a = torch.from_numpy(audio)[None]
    segs = m['slice_padded_array'](a, frames, frames)
    segs = torch.from_numpy(segs.astype('float32')).to(device).unsqueeze(1)
    n_items = segs.shape[0]
    pred = []
    with torch.inference_mode(), contextlib.redirect_stdout(sys.stderr):
        for i in range(0, n_items, CHUNK):
            arr, _ = model.inference_file(bsz=BSZ, audio_segments=segs[i:i + CHUNK])
            pred += arr
            print(f'progress {min(1, (i + CHUNK) / n_items) * 0.95:.3f}', file=sys.stderr, flush=True)
        starts = [frames * i / sr for i in range(n_items)]
        per_ch = []
        for ch in range(model.task_manager.num_decoding_channels):
            zipped, _, _ = model.task_manager.detokenize_list_batches([b[:, ch, :] for b in pred], starts,
                                                                     return_events=True)
            notes_ch, _ = m['merge'](zipped)
            per_ch.append(notes_ch)
        notes = m['mix_notes'](per_ch)
    seconds = time.perf_counter() - t0

    # program -> class name (MT3_FULL_PLUS): the decoder emits the first program of each class
    prog2name = {}
    for name, progs in m['program_vocab_presets']['mt3_full_plus'].items():
        for p in np.atleast_1d(progs):
            prog2name.setdefault(int(p), name)
    rows = []
    for n in notes:
        cls = 'Drums' if n.is_drum else prog2name.get(int(n.program), f'program{n.program}')
        rows.append([round(float(n.onset), 3), round(float(n.offset), 3), int(n.pitch), 100 if n.velocity else 0, cls])
    rows.sort(key=lambda r: (r[0], r[2]))
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'version': 1, 'model': MODEL, 'revision': opts['revision'] or 'unknown', 'seconds': round(seconds, 2),
                   'notes': rows}, f, separators=(',', ':'))
    print('progress 1.000', file=sys.stderr, flush=True)
    print(f'{len(audio) / SR:.1f} s of audio, {len(rows)} notes, {seconds:.1f} s on {device}', file=sys.stderr, flush=True)
    return 0


def main(argv):
    opts, pos = parse(argv)
    if opts is None:
        print(__doc__, file=sys.stderr)
        return 2
    if opts['probe']:
        res, code = probe(os.path.abspath(opts['src']), os.path.abspath(opts['ckpt']))
        print(json.dumps(res), flush=True)
        return code
    return transcribe(opts, pos[0], pos[1])


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
