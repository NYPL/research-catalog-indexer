#!/bin/bash

# "Parent" script for bulk-indexer to restart the bulk-index process on a
# jobfile until the status file indicates it's complete.
#
# Usage
#
#   ./scripts/self-restart-bulk-index.sh JOBFILE [--other-arg value ...]
#
# Where JOBFILE is a CSV or JSON jobfile. Any additional named arguments are
# passed through as-is to bulk-index.js.

JOBFILE=$1
shift
EXTRA_ARGS=("$@")
STATUSFILE="$JOBFILE.status.json"

while true; do
  # Does status file exist?
  if [ -e "$STATUSFILE" ]; then
    status=`cat $STATUSFILE | jq -r '.status'`

    # Exit early if status file indicates job was completed or failed:
    if [ "$status" = "completed" ] || [ "$status" = "failed" ]; then
      echo "Job status is '$status'; Aborting"
      exit
    fi

    echo "Job status found to be $status; Resuming..."
  fi

  node ./bulk-index.js --jobfile $JOBFILE "${EXTRA_ARGS[@]}"
done
