#!/usr/bin/env bash
# Run an agent CLI with a watchdog, so a hung run ends cleanly inside its step instead of hitting the
# step timeout (which skips the commit, the PR and the park/halt comment: "nothing happened").
#
# Usage: agent-watchdog.sh <budget-min> <stall-min> <stdout-file> <stderr-file> -- <command...>
# Exit:  the command's own exit code, or
#        124  the time budget ran out (the run is stopped; partial work stays in the tree)
#        125  the CLI reported a lost connection and the tree, stdout and stderr did not change for
#             <stall-min> minutes (a "devos-stall:" line is appended to the stderr file)
set -u
budget=$1; stall=$2; out=$3; err=$4; shift 4
tick=${DEVOS_WATCHDOG_TICK:-20}; unit=${DEVOS_WATCHDOG_UNIT:-60}   # tests shrink these
[ "${1:-}" = "--" ] && shift

setsid "$@" > "$out" 2> "$err" &
pid=$!
start=$(date +%s); last_change=$start; last_sig=""

stop() { kill -TERM -- "-$pid" 2>/dev/null; sleep 5; kill -KILL -- "-$pid" 2>/dev/null; wait "$pid" 2>/dev/null; }

while kill -0 "$pid" 2>/dev/null; do
  sleep "$tick"
  now=$(date +%s)
  sig="$(git status --porcelain 2>/dev/null | md5sum)|$(git diff 2>/dev/null | md5sum)|$(stat -c %s "$out" "$err" 2>/dev/null | tr '\n' ' ')"
  if [ "$sig" != "$last_sig" ]; then last_sig=$sig; last_change=$now; fi

  if [ $(( now - start )) -ge $(( budget * unit )) ]; then
    echo "devos-watchdog: stopped after the ${budget}-minute builder budget" >> "$err"
    stop; exit 124
  fi
  # Only a lost connection that is still the CLI's last word counts as a stall: a run that
  # reconnected and went on working writes or changes something.
  last_line=$(grep -v '^[[:space:]]*$' "$err" 2>/dev/null | tail -n 1)
  if printf '%s' "$last_line" | grep -qiE 'connection lost|reconnecting|retry attempt' \
     && [ $(( now - last_change )) -ge $(( stall * unit )) ]; then
    echo "devos-stall: the CLI lost its connection and made no progress for ${stall} minutes" >> "$err"
    stop; exit 125
  fi
done
wait "$pid"
