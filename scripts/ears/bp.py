"""Gap-fill notes for song packs: basic-pitch (Spotify, ICASSP 2022), its ONNX model, when YourMT3+ is not set up.

    python -I bp.py <audio> <out.json> [--onset 0.6] [--frame 0.4] [--min-ms 58] [--no-melodia]
    python -I bp.py --probe

Decodes with ffmpeg (any format ffmpeg reads) to a temporary 22.05 kHz mono WAV, then runs basic-pitch with the
settings the instrument study chose (onset 0.6, frame 0.4, notes of at least 58 ms, the melodia trick on).
Writes {version: 1, model, settings: {onset, frame, minMs, melodia}, seconds, notes: [[start, end, midi, vel], ...]}
sorted by (start, midi); `vel` is basic-pitch's amplitude × 127 (ingest estimates its own velocities from loudness);
`seconds` is how long loading and predicting took.
--probe prints {"ok": true} or {"ok": false, "reason": "..."} without running the model.
Progress goes to stderr as lines "progress <0..1>" (stdout stays clean).
Exit codes: 2 usage, 3 a missing package or model, 4 the audio cannot be decoded, 1 anything else.
Run it isolated (-I) in basic-pitch's venv (scripts/ears/requirements-bp.txt).
"""
import sys

# -I implies -E, which ignores PYTHONDONTWRITEBYTECODE: set it here.
sys.dont_write_bytecode = True

import contextlib  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import subprocess  # noqa: E402
import tempfile  # noqa: E402
import time  # noqa: E402

SR = 22050
REQS = 'pip install -r scripts/ears/requirements-bp.txt'


def fail(code, reason):
    print(f'bp.py: {reason}', file=sys.stderr, flush=True)
    sys.exit(code)


def parse(argv):
    opts = {'probe': False, 'onset': 0.6, 'frame': 0.4, 'minMs': 58.0, 'melodia': True}
    pos = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--probe':
            opts['probe'] = True
        elif a == '--no-melodia':
            opts['melodia'] = False
        elif a in ('--onset', '--frame', '--min-ms'):
            if i + 1 >= len(argv):
                return None, None
            try:
                opts[{'--onset': 'onset', '--frame': 'frame', '--min-ms': 'minMs'}[a]] = float(argv[i + 1])
            except ValueError:
                return None, None
            i += 1
        elif a.startswith('--'):
            return None, None
        else:
            pos.append(a)
        i += 1
    if opts['probe'] != (len(pos) == 0) or len(pos) not in (0, 2):
        return None, None
    return opts, pos


def load():
    """Imports basic-pitch and finds its ONNX model. Returns ((predict, Model, path, version), None) or (None, reason)."""
    try:
        with contextlib.redirect_stdout(sys.stderr):
            import onnxruntime  # noqa: F401  (the backend Model picks for a .onnx path)
            import basic_pitch
            from basic_pitch.inference import Model, predict
    except ImportError as e:
        return None, f'missing Python package ({e.name or e}): {REQS} into {sys.executable}'
    path = os.path.join(os.path.dirname(basic_pitch.__file__), 'saved_models', 'icassp_2022', 'nmp.onnx')
    if not os.path.isfile(path):
        return None, f'basic-pitch has no ONNX model at {path}: {REQS} into {sys.executable}'
    try:
        from importlib.metadata import version
        ver = version('basic-pitch')
    except Exception:  # noqa: BLE001
        ver = 'unknown'
    return (predict, Model, path, ver), None


def decode(path, wav):
    try:
        r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-ac', '1', '-ar', str(SR), '-c:a', 'pcm_f32le', wav],
                           capture_output=True)
    except FileNotFoundError:
        fail(4, 'ffmpeg not found on PATH')
    if r.returncode != 0 or not os.path.isfile(wav) or os.path.getsize(wav) <= 44:
        fail(4, f'cannot decode {path}: {r.stderr.decode(errors="replace").strip() or "no audio"}')


def run(opts, audio_path, out):
    if not os.path.isfile(audio_path):
        fail(4, f'no such file: {audio_path}')
    got, err = load()
    if err:
        fail(3, err)
    predict, Model, model_path, ver = got
    print('progress 0.000', file=sys.stderr, flush=True)
    with tempfile.TemporaryDirectory(prefix='wa-bp-') as tmp:
        wav = os.path.join(tmp, 'audio.wav')
        decode(audio_path, wav)
        print('progress 0.100', file=sys.stderr, flush=True)
        t0 = time.perf_counter()
        with contextlib.redirect_stdout(sys.stderr):
            model = Model(model_path)
            _, _, events = predict(wav, model, onset_threshold=opts['onset'], frame_threshold=opts['frame'],
                                   minimum_note_length=opts['minMs'], melodia_trick=opts['melodia'])
        seconds = time.perf_counter() - t0
    notes = sorted([[round(float(s), 4), round(float(e), 4), int(p), int(max(1, min(127, round(float(a) * 127))))]
                    for (s, e, p, a, *_) in events if float(e) > float(s)], key=lambda n: (n[0], n[2]))
    settings = {'onset': opts['onset'], 'frame': opts['frame'], 'minMs': opts['minMs'], 'melodia': opts['melodia']}
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'version': 1, 'model': f'basic-pitch-{ver}-icassp2022-onnx', 'settings': settings,
                   'seconds': round(seconds, 2), 'notes': notes}, f, separators=(',', ':'))
    print('progress 1.000', file=sys.stderr, flush=True)
    print(f'{len(notes)} notes, {seconds:.1f} s', file=sys.stderr, flush=True)
    return 0


def main(argv):
    opts, pos = parse(argv)
    if opts is None:
        print(__doc__, file=sys.stderr)
        return 2
    if opts['probe']:
        _, err = load()
        print(json.dumps({'ok': False, 'reason': err} if err else {'ok': True}), flush=True)
        return 3 if err else 0
    return run(opts, pos[0], pos[1])


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
