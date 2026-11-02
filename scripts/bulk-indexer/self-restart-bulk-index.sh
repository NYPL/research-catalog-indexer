#!/bin/bash

# "Parent" script for bulk-indexer to restart the bulk-index process on a set
# of critiera until it completes cleanly.
#
# Usage
#
#   ./scripts/bulk-indexer/self-restart-bulk-index.sh [--hasMarc M] [--csv CSVFILE] ...
#
# All arguments supported by bulk-index.js are passable.

BASEDIR=$(dirname $0)
MAX_RETRIES=100

retries=0
while true; do
  if [ $retries -gt 0 ]; then
    echo "Recovering from bulk-index error. Waiting to start retry $retries"
    sleep 3
  fi

  echo ::Running node $BASEDIR/bulk-index.js "$@"
  node $BASEDIR/bulk-index.js "$@"

  # If exited cleanly, exit while loop
  if [ $? -eq 0 ]; then
    echo "Bulk-index exited cleanly."
    exit
  fi

  # Observe reasonable max retries before deciding something must be really broken and exiting
  retries=$((retries+1))
  if [ $retries -gt $MAX_RETRIES ]; then
    echo "Max retries exhausted. Exiting."
    exit
  fi
done
