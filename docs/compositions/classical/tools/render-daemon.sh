#!/bin/bash
# Runs the jobs render-job.sh asks for: at most 4 previews and 3 finals at once. Stops when renders/queue/stop exists.
WT="C:/Users/maxim/Desktop/projects/github/WinkelAmp/.claude/worktrees/gifted-hugle-5d3302"
Q="$WT/renders/queue"; mkdir -p "$Q/jobs"; cd "$WT"
declare -A MAX=( [preview]=4 [final]=3 )
run() { local J="$1"; local MODE=$(cat "$J/mode") OUT=$(cat "$J/out") DEST=$(cat "$J/dest") ARGS=$(cat "$J/args")
  echo "running since $(date +%T)" > "$J/state"
  mkdir -p "$(dirname "$OUT")"
  eval npm run render-show -- $ARGS > "$J/log" 2>&1; local RC=$?
  if [ $RC = 0 ] && [ -n "$DEST" ]; then mkdir -p "$(dirname "$DEST")" && cp "$OUT" "$DEST" && echo "copied → $DEST" >> "$J/log" || RC=9; fi
  rm -f "$J/running"; echo $RC > "$J/done"; echo "$(date +%T) $(basename "$J") exit $RC" >> "$Q/daemon.log"; }
while [ ! -f "$Q/stop" ]; do
  for MODE in final preview; do
    n=$(ls -d "$Q"/jobs/*/running 2>/dev/null | while read r; do [ "$(cat "$(dirname "$r")/mode")" = $MODE ] && echo x; done | wc -l)
    for R in $(ls -tr "$Q"/jobs/*/request 2>/dev/null); do
      J=$(dirname "$R"); [ "$(cat "$J/mode")" = $MODE ] || continue
      [ $n -ge ${MAX[$MODE]} ] && break
      rm -f "$R"; touch "$J/running"; n=$((n+1)); echo "$(date +%T) $(basename "$J") start" >> "$Q/daemon.log"
      run "$J" &
    done
  done
  sleep 3
done
wait
