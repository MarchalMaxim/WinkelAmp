# Audio facts the notes lack, for gen-picks.mjs (songs/gymnopedie-jazz), deterministic.
# Run from the worktree root:
#   C:/Users/maxim/.venvs/wa/Scripts/python.exe -I docs/compositions/classical/gymnopedie-jazz/audio-picks.py
# -> docs/compositions/classical/gymnopedie-jazz/audio-picks.json:
#   drums: [t, gmKey, bandDb] for every YourMT3 "Drums" row (the piano model hears no drums), bandDb = the peak level of
#          the hit's own band in the percussive part (HPSS) within 50 ms: kick 30-120 Hz, snare/toms 1.5-5 kHz,
#          ride/hats/crash 6-11 kHz; dB relative to that band's loudest frame in the song.
#   bass:  [t, end, midi, db] low-band onsets (lowpass 180 Hz, pyin pitch) in the groove (205-288 s), where the pack has
#          no note below MIDI 50; an onset within 50 ms of a YourMT3 kick is kept only when
#          its pitch holds (24 of the next 36 frames voiced), so a bare kick is not taken for a bass note.
#   rms:   the mix level in dB every 0.5 s (for the holes table).
import json, os, sys
import numpy as np, librosa, scipy.signal as ss

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
SONG = os.path.join(ROOT, 'songs', 'gymnopedie-jazz')
labels = json.load(open(os.path.join(SONG, 'notes.ymt3.json'), encoding='utf8'))['notes']
drums = sorted([l for l in labels if l[4] == 'Drums'], key=lambda l: (l[0], l[2]))

y, sr = librosa.load(os.path.join(SONG, 'audio.mp3'), sr=22050, mono=True)
hop = 256
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
f = librosa.fft_frequencies(sr=sr, n_fft=2048)
H, P = librosa.decompose.hpss(S, margin=2.0)
def band_db(lo, hi):
    e = P[(f >= lo) & (f < hi)].sum(axis=0)
    return librosa.amplitude_to_db(e, ref=np.max(e))
KICK, SNARE, HAT = band_db(30, 120), band_db(1500, 5000), band_db(6000, 11000)
KICKS, SNARES = {35, 36}, {37, 38, 39, 40, 41, 43, 45, 47, 48, 50}
def peak(arr, t):
    i = int(round(t * sr / hop)); w = int(round(0.05 * sr / hop))
    return float(arr[max(0, i - 2):i + w + 1].max())
out_drums = []
for t, e, key, v, lab in drums:
    arr = KICK if key in KICKS else SNARE if key in SNARES else HAT
    out_drums.append([round(t, 3), key, round(peak(arr, t), 1)])

# groove bass
A, D = 205.0, 83.0
yb, srb = librosa.load(os.path.join(SONG, 'audio.mp3'), sr=11025, mono=True, offset=A, duration=D)
yl = ss.sosfiltfilt(ss.butter(6, 180, 'low', fs=srb, output='sos'), yb)
bh = 128
f0, vf, vp = librosa.pyin(yl, fmin=35, fmax=170, sr=srb, frame_length=2048, hop_length=bh)
tt = librosa.frames_to_time(np.arange(len(f0)), sr=srb, hop_length=bh) + A
lr = librosa.amplitude_to_db(librosa.feature.rms(y=yl, frame_length=1024, hop_length=bh)[0], ref=1.0)
oenv = librosa.onset.onset_strength(y=yl, sr=srb, hop_length=bh)
on = librosa.onset.onset_detect(onset_envelope=oenv, sr=srb, hop_length=bh, units='frames', delta=0.3, wait=8)
kick_t = np.array([d[0] for d in drums if d[2] in KICKS])
cand = []
for i in on:
    t = float(tt[i])
    seg = f0[i + 4:min(len(f0), i + 40)]; seg = seg[~np.isnan(seg)]
    near_kick = len(kick_t) and np.min(np.abs(kick_t - t)) < 0.05
    # a kick decays fast; a bass note under it keeps a steady pitch: keep those with most of 36 frames voiced
    if len(seg) < (24 if near_kick else 5): continue
    m = int(round(float(np.median(librosa.hz_to_midi(seg)))))
    db = float(lr[min(len(lr) - 1, i + 6)])
    if db < -40 or m < 28 or m > 52: continue
    cand.append([t, m, db])
out_bass = []
for k, (t, m, db) in enumerate(cand):
    nxt = cand[k + 1][0] if k + 1 < len(cand) else t + 0.6
    out_bass.append([round(t, 3), round(min(t + 0.6, nxt - 0.02), 3), m, round(db, 1)])

rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
rdb = librosa.amplitude_to_db(rms, ref=np.max(rms))
step = int(round(0.5 * sr / hop))
out_rms = [round(float(rdb[i:i + step].mean()), 1) for i in range(0, len(rdb), step)]

json.dump({'made': 'audio-picks.py', 'drums': out_drums, 'bass': out_bass, 'rmsHop': 0.5, 'rms': out_rms},
          open(os.path.join(HERE, 'audio-picks.json'), 'w'), separators=(',', ':'))
print('drums', len(out_drums), 'bass', len(out_bass), 'rms', len(out_rms))
