# Audio events for the six Romeo and Juliet packs: the input gen-picks.mjs reads where the transcription is thin.
# Run (deterministic): C:/Users/maxim/.venvs/wa/Scripts/python.exe -I audio-events.py
#   -> <pack>/audio-events.json next to this file, for each pack.
# What it keeps (librosa, 22050 Hz mono, hop 512 = 23 ms):
#   curve   : every 0.1 s the rms level in dB, the 20-120 Hz band in dB and the 5-11 kHz band in dB, and the
#             strongest pitch class (chroma_cqt) over that 0.1 s
#   onsets  : onset_detect on a log-power spectral flux, delta 0.03 (sensitive: quiet orchestral entries too), each with
#             its strength, the level just after it, its pitch class (chroma over the next 0.15 s) and how far the low
#             and the high band jump over it (dB, 0.3 s after against 0.3 s before)
#   hi_peaks: peaks of the 5-11 kHz flux (cymbal crashes and bright tutti accents), >= 0.25 s apart
#   lo_peaks: peaks of the < 150 Hz flux (timpani strokes, bass sforzandi), >= 0.3 s apart
import json, os, numpy as np, librosa
from scipy.signal import find_peaks
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
PACKS = ['romeo-juliet-1-friar', 'romeo-juliet-2-feud', 'romeo-juliet-3-love', 'romeo-juliet-4-clash', 'romeo-juliet-5-return', 'romeo-juliet-6-coda']
for pid in PACKS:
    y, sr = librosa.load(os.path.join(ROOT, 'songs', pid, 'audio.mp3'), sr=22050, mono=True)
    hop = 512; fr = hop / sr
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop)); f = librosa.fft_frequencies(sr=sr, n_fft=2048)
    rdb = librosa.amplitude_to_db(librosa.feature.rms(S=S, frame_length=2048, hop_length=hop)[0], ref=1.0)
    band = lambda lo, hi: librosa.amplitude_to_db(np.sqrt((S[(f >= lo) & (f < hi)] ** 2).mean(0)), ref=1.0)
    low, high = band(20, 120), band(5000, 11000)
    flux = lambda m: np.concatenate([[0], np.maximum(0, np.diff(np.log1p(S[m] * 100), axis=1)).mean(0)])
    hflux, lflux = flux(f >= 5000), flux(f < 150)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    n = len(rdb); t = np.arange(n) * fr
    step = int(round(0.1 / fr))
    curve = []
    for k in range(0, int(len(y) / sr * 10)):
        a = int(k * 0.1 / fr); b = max(a + 1, int((k + 1) * 0.1 / fr))
        if a >= n: break
        curve.append([round(float(rdb[a:b].mean()), 1), round(float(low[a:b].mean()), 1), round(float(high[a:b].mean()), 1), int(np.argmax(chroma[:, a:b].mean(1)))])
    oenv = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S ** 2), sr=sr, hop_length=hop)
    on = librosa.onset.onset_detect(onset_envelope=oenv, sr=sr, hop_length=hop, units='frames', delta=0.03, wait=4)
    w = int(0.3 / fr); c15 = max(1, int(0.15 / fr))
    def jump(x, p): return round(float(x[p:p + w].max() - x[max(0, p - w):p].mean()), 1) if p > 0 else 0.0
    onsets = [[round(float(t[p]), 3), round(float(oenv[p]), 2), round(float(rdb[p:p + w].max()), 1), int(np.argmax(chroma[:, p:p + c15].mean(1))), jump(low, p), jump(high, p)] for p in on]
    def peaks(x, lvl, thr, dist):
        pk, _ = find_peaks(x, height=thr, distance=int(dist / fr))
        return [[round(float(t[p]), 3), round(float(x[p]), 3), round(float(lvl[p:p + w].max()), 1), jump(lvl, p), int(np.argmax(chroma[:, p:p + c15].mean(1)))] for p in pk]
    out = dict(pack=pid, made='audio-events.py', hop=0.1, curveColumns=['rms dB', 'low 20-120 Hz dB', 'high 5-11 kHz dB', 'pitch class'], curve=curve,
               onsetColumns=['t', 'strength', 'dB after', 'pitch class', 'low jump dB', 'high jump dB'], onsets=onsets,
               peakColumns=['t', 'flux', 'band dB after', 'band jump dB', 'pitch class'],
               hi_peaks=peaks(hflux, high, 0.25, 0.25), lo_peaks=peaks(lflux, low, 0.6, 0.3))
    os.makedirs(os.path.join(HERE, pid), exist_ok=True)
    with open(os.path.join(HERE, pid, 'audio-events.json'), 'w') as fh:
        fh.write(json.dumps(out, separators=(',', ':')))
    print(pid, len(curve), 'curve', len(onsets), 'onsets', len(out['hi_peaks']), 'hi', len(out['lo_peaks']), 'lo')
