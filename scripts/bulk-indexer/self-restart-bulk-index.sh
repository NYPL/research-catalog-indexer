#!/bin/bash

# "Parent" script for bulk-indexer to restart the bulk-index process on a
# jobfile until the status file indicates it's complete.
#
# Usage
#
#   ./scripts/self-restart-bulk-index.sh --csv CSVFILE [--jobfile STATUSFILE] [--other-arg value ...]
#
# Where CSVFILE is the CSV file to process. If --jobfile is not provided, 
# the status file defaults to CSVFILE-status.json. Any additional named arguments 
# are passed through as-is to bulk-index.js.

BASEDIR=$(dirname $0)
CSV=""
JOBFILE=""
STATUSFILE=""
MAX_RETRIES=100

# Determine the status file path:
# If --jobfile was provided, use it; otherwise derive from 
if [ -z "$STATUSFILE" ]; then
  STATUSFILE="${JOBFILE}-status.json"
fi

# echo "CSV: $CSV"
echo "JOBFILE: $JOBFILE"

retries=0
while true; do
  if [ $retries -gt 0 ]; then
    echo "Recovering from bulk-index error. Waiting to start retry $retries"
    sleep 3
  fi

  # Does status file exist?
  if [ -e "$STATUSFILE" ]; then
    status=`cat $STATUSFILE | jq -r '.status'`

    # Exit early if status file indicates job was mindfully failed:
    if [ "$status" = "failed" ]; then
      echo "Job status is '$status'; Aborting"
      exit
    fi

    echo "Job status found to be $status; Resuming..."
  fi

  echo ::Running node $BASEDIR/bulk-index.js "$@"
  node $BASEDIR/bulk-index.js "$@"

  # If exited cleanly, exit while loop
  if [ $? -eq 0 ]; then
    echo "Bulk-index exited cleanly."
    exit
  else
    echo "indexer returned $?"
  fi

  # Observe reasonable max retries before deciding something must be really broken and exiting
  retries=$((retries+1))
  if [ $retries -gt $MAX_RETRIES ]; then
    echo "Max retries exhausted. Exiting."
    exit
  fi
done
