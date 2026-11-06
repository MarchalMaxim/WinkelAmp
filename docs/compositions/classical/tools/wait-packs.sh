#!/bin/bash
# Waits (up to ~9 min) until every named song pack exists: bash docs/compositions/classical/tools/wait-packs.sh id1 id2 ...
WT="C:/Users/maxim/Desktop/projects/github/WinkelAmp/.claude/worktrees/gifted-hugle-5d3302"
for k in $(seq 1 108); do
  miss=""; for id in "$@"; do [ -f "$WT/songs/$id/pack.json" ] || miss="$miss $id"; done
  [ -z "$miss" ] && { echo "ALL PACKS READY"; exit 0; }
  sleep 5
done
echo "STILL MISSING:$miss — call again"
