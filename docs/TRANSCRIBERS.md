# Transcribers

`npm run ingest` and `npm run ears` turn a recording into notes. The piano model is the base (venv `C:/Users/maxim/.venvs/wa`,
or `$WINKELAMP_PY`). Ensembles also use an instrument transcriber, installed outside the repo, never vendored. Nothing
fails for a missing transcriber: `--notes auto` falls back a row (YourMT3+, basic-pitch with venv `$WINKELAMP_PY_BP`, the
piano model alone) and the pack's warnings say so.

## YourMT3+ (default for ensembles)

Writes one note track per instrument (violins, cellos, horns, oboe, ...); those are the parts a clip can `listen` to.

1. Download the Hugging Face Space `mimbres/YourMT3` (git-lfs, for its checkpoints).
2. Make a Python 3.11 venv from `scripts/ears/requirements-ymt3.txt` (torch with CUDA; default `C:/Users/maxim/.venvs/wa-mt`).
3. `npm run setup-ymt3 -- --from <Space folder> [--python <venv python>] [--dir <install>]` copies the code and the
   checkpoint (sha256-checked) to `%LOCALAPPDATA%/WinkelAmp/ymt3`, probes it and writes `ymt3.json` there.
   `WINKELAMP_YMT3` points at another install.

Check the Space's model card for the checkpoints' terms before sharing anything made from them.

## MuScriptor large (optional, for string pieces)

```bash
npm run setup-muscriptor -- [--python <venv python>] [--dir <install>] [--download]
npm run ingest -- <audio> --instruments-model muscriptor --instruments strings|baroque|classical|<list>
```

1. Python 3.11 venv from `scripts/ears/requirements-muscriptor.txt` (default `C:/Users/maxim/.venvs/wa-ms`), then `hf auth login`.
2. `npm run setup-muscriptor` probes it and writes `muscriptor.json` to `%LOCALAPPDATA%/WinkelAmp/muscriptor`
   (`WINKELAMP_MUSCRIPTOR` points at another). `--download` fetches the 5.5 GB weights; an ingest never downloads.

- **Licence.** The weights are CC-BY-NC: own shows are fine, commercial use or renders sold from its notes need a licence.
- **The instrument list is required.** Without it Vivaldi's strings come out as guitars. `strings` is violin, viola,
  cello, contrabass; `baroque` adds acoustic_piano; `classical` adds flutes, oboe, clarinet, bassoon, french_horn,
  trumpet, timpani. `string_ensemble` is refused. A saved run (`--muscriptor-notes <file>`) needs the list too.
- **Keyboard lane.** It comes from YourMT3+ when the list has a keyboard, so YourMT3+ runs too or its cache is read.
- **Cost.** 0.7 to 1.8 times the music's length on a shared GPU, up to 15 GB of GPU memory.
- **Cache.** `songs/<id>/notes.muscriptor-<8 hex>.json` per recording and list; `--redo muscriptor` runs it again.
  The cleanup is `src/studio/pack/clean-tracks.ts`; its work is in the pack's warnings.
- **Fallback.** A missing, failing or looping MuScriptor gives YourMT3's tracks and a warning.
- **Check by ear.** The cleanup can thin a lane that a show listens to (`check-show` cannot see it), and some labels stay
  wrong (a solo violin split into violin and viola). Listen before keeping the pack.
- **Studio.** The Show tab's *Redo the transcription...* (needs `npm run ears`, restarted after a setup) picks the
  transcriber and the list. The run continues if the page closes; there is no cancel button.
