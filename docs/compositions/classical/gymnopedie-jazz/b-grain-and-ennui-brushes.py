# Show B (grain and ennui): the brushes, hats and ride heard from the AUDIO, for halftone's pale screen.
# Run from the worktree root:
#   C:/Users/maxim/.venvs/wa/Scripts/python.exe -I docs/compositions/classical/gymnopedie-jazz/b-grain-and-ennui-brushes.py
# -> b-grain-and-ennui-brushes.json: {"hits": [[t, db, centroid01], ...]}: onsets of the percussive part's high band
#    (5-11 kHz) from 28.0 s to 288 s; db = the band's peak within 50 ms relative to its loudest frame; centroid01 = how
#    bright the hit is inside the band (0 = 5 kHz-ish, 1 = 11 kHz-ish), which the build maps to a place on the screen.
import json, os
import numpy as np, librosa

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
y, sr = librosa.load(os.path.join(ROOT, 'songs', 'gymnopedie-jazz', 'audio.mp3'), sr=22050, mono=True)
hop = 256
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
f = librosa.fft_frequencies(sr=sr, n_fft=2048)
H, P = librosa.decompose.hpss(S, margin=2.0)
band = (f >= 5000) & (f < 11000)
Pb = P[band]
env = librosa.onset.onset_strength(S=librosa.amplitude_to_db(Pb, ref=np.max), sr=sr, hop_length=hop)
e = Pb.sum(axis=0)
db = librosa.amplitude_to_db(e, ref=np.max(e))
cent = (Pb * f[band][:, None]).sum(axis=0) / np.maximum(1e-9, Pb.sum(axis=0))
on = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop, units='frames', delta=0.08, wait=4)
hits = []
w = int(round(0.05 * sr / hop))
for i in on:
    t = float(i * hop / sr)
    if t < 28.0 or t > 288.0: continue
    pk = float(db[max(0, i - 2): i + w + 1].max())
    if pk < -38: continue
    c = float(np.median(cent[i: i + w + 1]))
    hits.append([round(t, 3), round(pk, 1), round(min(1, max(0, (c - 5000) / 6000)), 3)])
json.dump({'made': 'b-grain-and-ennui-brushes.py', 'hits': hits}, open(os.path.join(HERE, 'b-grain-and-ennui-brushes.json'), 'w'))
cnt = {}
for t, d, c in hits: cnt[int(t // 10) * 10] = cnt.get(int(t // 10) * 10, 0) + 1
print(len(hits), 'hits'); print(' '.join(f'{k}:{v}' for k, v in sorted(cnt.items())))
dbs = sorted(h[1] for h in hits); print('db p10/p50/p90', dbs[len(dbs)//10], dbs[len(dbs)//2], dbs[9*len(dbs)//10])
