# This script sets the primary Kinesis triggers for RCI to a specific timestamp.
# Useful when we've created a new index, switched RCI over to use it, and now
# need to tell it to re-process from some point in the past (usually the point
# in time immediately preceding when we started to create the new index)

# Usage:
#  - First delete the old triggers manually
#  - Set FROM_TIMESTAMP below to a timestamp that precedes the start of your `_reindex`
#  - Set ENV appropriately
#  - Run ./scripts/rewind-indexer.sh

FROM_TIMESTAMP=2026-02-12T12:00:00-05:00
ENV=production

echo Setting triggers for ResearchCatalogIndexer-$ENV to $FROM_TIMESTAMP

for STREAM in Bib Item Holding; do
  echo Setting $STREAM-$ENV trigger..

  aws lambda create-event-source-mapping \
    --function-name ResearchCatalogIndexer-$ENV \
    --event-source-arn arn:aws:kinesis:us-east-1:946183545209:stream/$STREAM-$ENV \
    --batch-size 50 \
    --starting-position AT_TIMESTAMP \
    --starting-position-timestamp $FROM_TIMESTAMP \
    --bisect-batch-on-function-error \
    --profile nypl-digital-dev
done
