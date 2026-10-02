# This script queries AWS for existing kinesis triggers, and resets 
# the primary Kinesis triggers for RCI to a specific timestamp.
# Useful when we've created a new index, switched RCI over to use it, and now
# need to tell it to re-process from some point in the past (usually the point
# in time immediately preceding when we started to create the new index)

# Usage:
#  - Run:
#     ./scripts/rewind-indexer.sh (qa|production) [TIMESTAMP]
#  - e.g.:
#     ./scripts/rewind-indexer.sh production 2026-05-26T14:00:00-05:00

ENV=$1
FROM_TIMESTAMP=$2

echo Setting triggers for ResearchCatalogIndexer-$ENV to $FROM_TIMESTAMP

for STREAM in Bib Item Holding; do
  EVENT_SOURCE_ARN=arn:aws:kinesis:us-east-1:946183545209:stream/$STREAM-$ENV 
  echo Locating $STREAM-$ENV triggers to delete..
  UUIDS=`aws lambda list-event-source-mappings --event-source-arn $EVENT_SOURCE_ARN \
  | jq -c -r '.EventSourceMappings[].UUID'`
  for UUID in $UUIDS; do
    echo Deleting $STREAM-$ENV trigger with UUID $UUID..
    aws lambda delete-event-source-mapping\
      --uuid $UUID \
      --profile nypl-digital-dev
  done
  
  echo Setting $STREAM-$ENV trigger..
  aws lambda create-event-source-mapping \
    --function-name ResearchCatalogIndexer-$ENV \
    --event-source-arn $EVENT_SOURCE_ARN \
    --batch-size 50 \
    --starting-position AT_TIMESTAMP \
    --starting-position-timestamp $FROM_TIMESTAMP \
    --bisect-batch-on-function-error \
    --profile nypl-digital-dev
done
