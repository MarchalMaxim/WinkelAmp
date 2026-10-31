"""GPU piano transcription for song packs (ByteDance piano_transcription_inference).

    python scripts/ears/transcribe.py <audio> <out.json> [--device auto|cuda|cpu]
    python scripts/ears/transcribe.py --probe

Writes {version: 1, model, device, seconds, notes: [{start, end, midi, vel}]}: note times in seconds of
this file, vel 0..127, sorted by (start, midi); `seconds` is how long loading and transcribing took.
--probe prints {"ok": true, "device": "cuda", "torch": "..."} or {"ok": false, "reason": "..."} without
loading the model. Progress goes to stderr as lines "progress <0..1>" (stdout stays clean).
Exit codes: 2 usage, 3 a missing package or checkpoint, 4 the audio cannot be decoded, 1 anything else.
Run it with the venv's Python (see scripts/ears/requirements.txt).
"""
import contextlib
import io
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

MODEL = 'bytedance-piano-transcription'
CHECKPOINT = Path.home() / 'piano_transcription_inference_data' / 'note_F1=0.9677_pedal_F1=0.9186.pth'
# From piano_transcription_inference/inference.py: the library would fetch it with wget, which Windows lacks.
ZENODO = 'https://zenodo.org/record/4034264/files/CRNN_note_F1%3D0.9677_pedal_F1%3D0.9186.pth?download=1'
SR = 16000


def fail(code, reason):
    print(f'transcribe.py: {reason}', file=sys.stderr, flush=True)
    sys.exit(code)


def checkpoint_problem():
    if not CHECKPOINT.exists():
        return f'the model checkpoint is missing: download {ZENODO} and save it as {CHECKPOINT}'
    if CHECKPOINT.stat().st_size < 1.6e8:  # the library's own completeness test (the file is ~165 MB)
        return f'the model checkpoint at {CHECKPOINT} is incomplete ({CHECKPOINT.stat().st_size} bytes): download {ZENODO} again'
    return None


def import_torch():
    try:
        import torch
        import numpy  # noqa: F401
        import piano_transcription_inference  # noqa: F401
    except ImportError as e:
        return None, f'missing Python package ({e.name or e}): pip install -r scripts/ears/requirements.txt into {sys.executable}'
    return torch, None


class Relay(io.TextIOBase):
    """The library prints 'Segment i / N' to stdout: turn it into progress lines on stderr."""

    def write(self, s):
        for line in s.splitlines():
            m = re.match(r'\s*Segment (\d+) / (\d+)', line)
            if m:
                i, n = int(m.group(1)), max(1, int(m.group(2)))
                print(f'progress {min(1, i / n):.3f}', file=sys.stderr, flush=True)
            elif line.strip():
                print(line, file=sys.stderr, flush=True)
        return len(s)


def probe():
    torch, err = import_torch()
    if err:
        return {'ok': False, 'reason': err}, 3
    err = checkpoint_problem()
    if err:
        return {'ok': False, 'reason': err}, 3
    return {'ok': True, 'device': 'cuda' if torch.cuda.is_available() else 'cpu', 'torch': torch.__version__}, 0


def decode(path):
    try:
        r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True)
    except FileNotFoundError:
        fail(4, 'ffmpeg not found on PATH')
    if r.returncode != 0 or not r.stdout:
        fail(4, f'cannot decode {path}: {r.stderr.decode(errors="replace").strip() or "no audio"}')
    import numpy as np
    return np.frombuffer(r.stdout, dtype=np.float32).copy()


def main(argv):
    if argv == ['--probe']:
        res, code = probe()
        print(json.dumps(res), flush=True)
        return code
    device = 'auto'
    if '--device' in argv:
        i = argv.index('--device')
        device = argv[i + 1] if i + 1 < len(argv) else ''
        argv = argv[:i] + argv[i + 2:]
    if len(argv) != 2 or device not in ('auto', 'cuda', 'cpu'):
        print(__doc__, file=sys.stderr)
        return 2
    src, out = argv
    if not os.path.isfile(src):
        fail(4, f'no such file: {src}')

    torch, err = import_torch()
    if err:
        fail(3, err)
    err = checkpoint_problem()
    if err:
        fail(3, err)
    if device == 'auto':
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
    elif device == 'cuda' and not torch.cuda.is_available():
        fail(3, 'CUDA is not available to this torch build: pass --device cpu (slow) or install the CUDA build')

    audio = decode(src)
    print('progress 0.000', file=sys.stderr, flush=True)
    t0 = time.perf_counter()
    from piano_transcription_inference import PianoTranscription
    with contextlib.redirect_stdout(Relay()):
        pt = PianoTranscription(device=device, checkpoint_path=str(CHECKPOINT))
        res = pt.transcribe(audio, None)
    seconds = time.perf_counter() - t0
    notes = sorted(({'start': round(float(e['onset_time']), 4), 'end': round(float(e['offset_time']), 4),
                     'midi': int(e['midi_note']), 'vel': int(e['velocity'])} for e in res['est_note_events']),
                   key=lambda x: (x['start'], x['midi']))
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'version': 1, 'model': MODEL, 'device': device, 'seconds': round(seconds, 2), 'notes': notes}, f)
    print(f'{len(audio) / SR:.1f} s of audio, {len(notes)} notes, {seconds:.1f} s on {device}', file=sys.stderr, flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
