# Args: 
# $1  - environment (qa or production)
# $@  -  rest of flags passed to script

ENV=$1
shift

SCRIPT_DIR=.
mkdir -p $SCRIPT_DIR/tmp/
BIB_IDS_DIR=$SCRIPT_DIR/tmp/bib_ids/
ERRORS_DIR=$SCRIPT_DIR/tmp/chunk_run_errors/
PROCESSED_IDS_DIR=$SCRIPT_DIR/tmp/processed/
mkdir -p $BIB_IDS_DIR
mkdir -p $ERRORS_DIR
mkdir -p $PROCESSED_IDS_DIR

set -a; source config/"$ENV"-bulk-index.env; set +a

decrypt_env_var() {
  node -e "require('./scripts/utils').setAwsProfile(); require('./lib/kms').decrypt(process.env.$1).then(console.log).catch(e => { console.error(e); process.exit(1); })"
}

DECRYPTED_PW=$(decrypt_env_var BIB_SERVICE_DB_PW) || { echo "Error: Failed to decrypt BIB_SERVICE_DB_PW"; exit 1; }
DECRYPTED_HOST=$(decrypt_env_var BIB_SERVICE_DB_HOST) || { echo "Error: Failed to decrypt BIB_SERVICE_DB_HOST"; exit 1; }
DECRYPTED_USER=$(decrypt_env_var BIB_SERVICE_DB_USER) || { echo "Error: Failed to decrypt BIB_SERVICE_DB_USER"; exit 1; }

echo Fetching all bib ids from $ENV bib database
psql postgresql://$DECRYPTED_USER:$DECRYPTED_PW@$DECRYPTED_HOST/bib_service_production -c "\\COPY (SELECT id, nypl_source FROM bib) TO $SCRIPT_DIR/tmp/all_bib_ids.csv WITH CSV DELIMITER ',' HEADER;" 

echo Splitting `wc -l $SCRIPT_DIR/tmp/all_bib_ids.csv` into files of 1000 ids
split -l 1000 -a 5 -d $SCRIPT_DIR/tmp/all_bib_ids.csv $BIB_IDS_DIR/bib_ids_

echo Deleting original $SCRIPT_DIR/tmp/all_bib_ids.csv file
rm $SCRIPT_DIR/tmp/all_bib_ids.csv 

echo $@
echo commencing bulk reingest for all ids

for file in `ls $BIB_IDS_DIR`; do
    echo "Processing $file"
    if ! node ./scripts/bulk-index.js "$@" --batchSize 1000 --type bib --envfile ./config/$ENV-bulk-index.env --skipDeletes --csv $BIB_IDS_DIR/$file --csvIdColumn 0 --csvNyplSourceColumn 1; then
      echo "csv file failed run: $file"
      mv $BIB_IDS_DIR/$file $ERRORS_DIR
    fi
    mv $BIB_IDS_DIR/$file $PROCESSED_IDS_DIR
done
