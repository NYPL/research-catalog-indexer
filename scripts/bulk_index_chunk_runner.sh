# Args: 
# $1  - environment (qa or production)
# $@  -  rest of flags passed to script

SCRIPT_DIR=.
mkdir -p $SCRIPT_DIR/tmp/
BIB_IDS_DIR=$SCRIPT_DIR/tmp/bib_ids/
ERRORS_DIR=$SCRIPT_DIR/tmp/chunk_run_errors/
PROCESSED_IDS_DIR=$SCRIPT_DIR/tmp/processed/
mkdir -p $BIB_IDS_DIR
mkdir -p $ERRORS_DIR
mkdir -p $PROCESSED_IDS_DIR

set -a; source config/"$1"-bulk-index.env; set +a
DECRYPTED_PW=$(kms-util decrypt $BIB_SERVICE_DB_PW)
DECRYPTED_HOST=$(kms-util decrypt $BIB_SERVICE_DB_HOST)
DECRYPTED_USER=$(kms-util decrypt $BIB_SERVICE_DB_USER)

echo Fetching all bib ids from $1 bib database
psql postgresql://$DECRYPTED_USER:$DECRYPTED_PW@$DECRYPTED_HOST/bib_service_production -c "\\COPY (SELECT id, nypl_source FROM bib) TO $SCRIPT_DIR/tmp/all_bib_ids.csv WITH CSV DELIMITER ',' HEADER;" 

echo Splitting `wc -l $SCRIPT_DIR/tmp/all_bib_ids.csv` into files of 1000 ids
split -l 1000 -a 5 -d $SCRIPT_DIR/tmp/all_bib_ids.csv $BIB_IDS_DIR/bib_ids_

echo Deleting original $SCRIPT_DIR/tmp/all_bib_ids.csv file
rm $SCRIPT_DIR/tmp/all_bib_ids.csv 

echo commencing bulk reingest for all ids

for file in `ls $BIB_IDS_DIR`; do
    echo "Processing $file"
    if ! node ./scripts/bulk-index.js "$@" --batchSize 1000 --type bib --envfile ./config/$1-bulk-index.env --skipDeletes --csv $BIB_IDS_DIR/$file --csvIdColumn 0 --csvNyplSourceColumn 1; then
      echo "csv file failed run: $file"
      mv $BIB_IDS_DIR/$file $ERRORS_DIR
    fi
    mv $BIB_IDS_DIR/$file $PROCESSED_IDS_DIR
done
