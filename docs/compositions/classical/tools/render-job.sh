#!/bin/bash
# Render queue for the classical batch (the daemon, render-daemon.sh, runs the renders; this asks for one and waits).
#   bash docs/compositions/classical/tools/render-job.sh preview <show-id> [from to]   720p 15 fps quick look → renders/preview/
#   bash docs/compositions/classical/tools/render-job.sh final   <show-id> "<nextcloud file path>"   720p 30 fps → renders/final/, copied there
# Waits up to ~8 min. While it prints RUNNING/QUEUED, call again with the same arguments. DONE <exit code> when finished.
# FORCE=1 in front re-renders (after you changed the show).
set -u
WT="C:/Users/maxim/Desktop/projects/github/WinkelAmp/.claude/worktrees/gifted-hugle-5d3302"
Q="$WT/renders/queue"; mkdir -p "$Q/jobs"
MODE="$1"; ID="$2"; shift 2
if [ "$MODE" = preview ]; then
  if [ $# -ge 2 ]; then NAME="preview-$ID-$1-$2"; RANGE="--from $1 --to $2"; else NAME="preview-$ID"; RANGE=""; fi
  OUT="renders/preview/$NAME.mp4"
  ARGS="$ID --scale 1 --fps 15 --crf 27 --preset veryfast --no-share --eta-probes 0 $RANGE --out $OUT"; DEST=""
elif [ "$MODE" = final ]; then
  NAME="final-$ID"; OUT="renders/final/$ID.mp4"
  ARGS="$ID --scale 1 --fps 30 --crf 20 --preset medium --no-share --eta-probes 0 --out $OUT"; DEST="${1:-}"
  [ -z "$DEST" ] && { echo "final needs a Nextcloud file path"; exit 2; }
else echo "mode is preview or final"; exit 2; fi
J="$Q/jobs/$NAME"
# A finished job is re-run when the show file changed since it was asked for (or with FORCE=1).
HASH=$(sha1sum "$WT/shows/$ID.json" 2>/dev/null | cut -c1-40)
if [ -f "$J/done" ] && { [ "${FORCE:-0}" = 1 ] || [ "$(cat "$J/hash" 2>/dev/null)" != "$HASH" ]; }; then rm -rf "$J"; fi
if [ ! -d "$J" ]; then
  mkdir -p "$J"; printf '%s\n' "$HASH" > "$J/hash"; printf '%s\n' "$MODE" > "$J/mode"; printf '%s\n' "$ARGS" > "$J/args"; printf '%s\n' "$OUT" > "$J/out"; printf '%s\n' "$DEST" > "$J/dest"
  touch "$J/request"; echo "QUEUED $NAME"
fi
for k in $(seq 1 96); do
  if [ -f "$J/done" ]; then echo "DONE $(cat "$J/done") $NAME → $OUT"; tr '\r' '\n' < "$J/log" | tail -5; exit 0; fi
  sleep 5
done
echo "RUNNING $NAME ($(cat "$J/state" 2>/dev/null || echo waiting for a slot); $(tail -c 300 "$J/log" 2>/dev/null | tr '\r' '\n' | grep . | tail -1)) — call again with the same arguments"
