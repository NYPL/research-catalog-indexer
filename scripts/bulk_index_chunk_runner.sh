# Args: 
# $1  -  path to chunked csvs
# $@  -  rest of flags passed to script

SCRIPT_DIR=$(dirname "$0")
mkdir -p $SCRIPT_DIR/errors/

for file in `ls $1`; do
    echo "Processing $file"
    if ! node scripts/spaghetti.js; then
      echo "csv file failed run: $file"
      mv "$1"/"$file" $SCRIPT_DIR/errors/
    fi
    node scripts/bulk-index.js "$@" --skipDeletes
done
