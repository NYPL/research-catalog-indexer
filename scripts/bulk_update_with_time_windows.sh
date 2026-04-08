#!/bin/bash
###################################################################################################################################
#
# Bash script for running bulk-index in time windows month to month so
# you can easily pick up where you left off if you get interrupted.
#
# args:
#   $1 - First arg should be # of months to look back for start of windows. If you are interrupted, change this to the last month that was processed to pick up where you left off.
#        If you're doing a "full ingest" start from 20 years ago or so. A lot of those old records are deleted or suppressed so it is recommended to run this with --skipDeletes true
#   $@ - All other args are passed into bulk-index.js to suite your use case.
#
# Example usage (starting from 10 years ago):
# ./bulk_update_with_time_windows.sh 120 --envfile config/qa-bulk-index.env --type bib --nyplSource all --batchSize 10 --skipDbPrefetch true --skipApiPrefetch true --updateOnly true --properties creators_displayPacked --skipDeletes true
#
# <assuming you're interrupted at month lookback 84>
# ./bulk_update_with_time_windows.sh 84 --envfile config/qa-bulk-index.env --type bib --nyplSource all --batchSize 10 --skipDbPrefetch true --skipApiPrefetch true --updateOnly true --properties creators_displayPacked --skipDeletes true
#
# Not sure where you left off? This writes logs to bulk_logs/ including the month lookback so you should be able to find it there.
#
####################################################################################################################################

current_ts=$(date -j -f "%Y-%m-%d" "$(date +%Y-%m-01)" +%s)

MONTHS_AGO_FROM=$1

if [ -z $MONTHS_AGO_FROM ]; then
  echo "Provide a number of months back to start from."
  exit 1
fi

mkdir -p bulk_logs/

for i in $(seq $MONTHS_AGO_FROM 0); do
    from_date=$(date -j -r "$current_ts" -v-"${i}"m +%Y-%m-01)
    next_month=$(( i - 1 ))
    to_date=$(date -j -r "$current_ts" -v-"${next_month}"m +%Y-%m-01)

    LOG_FILE=bulk_logs/ordered_bulk_index_"$current_ts"."$i".log

    echo "-----------------------------------------------------------------"
    date
    echo "$i - Processing: --fromDate $from_date --toDate $to_date"
    echo "Writing logs to "$LOG_FILE""
    echo "-----------------------------------------------------------------"

    SKIP_DOC_PROCESSED_STREAM=true node scripts/bulk-index.js --fromDate "$from_date" --toDate "$to_date" "$@" | tee "$LOG_FILE"

    echo "-----------------------------------------------------------------"
    date
    echo "$i - Processed: --fromDate $from_date --toDate $to_date"
    echo "-----------------------------------------------------------------"
done
