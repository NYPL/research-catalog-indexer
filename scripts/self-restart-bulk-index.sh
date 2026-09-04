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

CSV=""
JOBFILE=""
declare -a EXTRA_ARGS

# Parse arguments to extract --csv and --jobfile
while [ $# -gt 0 ]; do
  case "$1" in
    --csv)
      shift
      CSV="$1"
      EXTRA_ARGS+=("--csv" "$CSV")
      shift
      ;;
    --jobfile)
      shift
      JOBFILE="$1"
      shift
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

# Validate that --csv was provided
if [ -z "$CSV" ]; then
  echo "Error: --csv parameter is required"
  exit 1
fi

# Determine the status file path:
# If --jobfile was provided, use it; otherwise derive from CSV
if [ -z "$JOBFILE" ]; then
  JOBFILE="${CSV}-status.json"
fi

echo "CSV: $CSV"
echo "JOBFILE: $JOBFILE"
echo "EXTRA_ARGS: ${EXTRA_ARGS[@]}"

while true; do
  # Does status file exist?
  if [ -e "$JOBFILE" ]; then
    status=`cat $JOBFILE | jq -r '.status'`

    # Exit early if status file indicates job was completed or failed:
    if [ "$status" = "completed" ] || [ "$status" = "failed" ]; then
      echo "Job status is '$status'; Aborting"
      exit
    fi

    echo "Job status found to be $status; Resuming..."
  fi

  echo "Running: node ./bulk-index.js --jobfile \"$JOBFILE\" ${EXTRA_ARGS[@]}"
  node ./bulk-index.js --jobfile "$JOBFILE" "${EXTRA_ARGS[@]}"
done
