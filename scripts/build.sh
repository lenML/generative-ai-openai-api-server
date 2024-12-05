#!/bin/bash

set -e

DATE=$(date +"%Y%m%d")
COMMIT_HASH=$(git rev-parse --short HEAD)
ROOT_DIR=$(pwd)

rm -rf ./output
rm -rf gaoas_*.zip
npm run build

platforms=("windows" "linux" "mac")


for platform in "${platforms[@]}"
do
    cd $ROOT_DIR
    npm run build:$platform
    cd $ROOT_DIR/output/$platform
    cp $ROOT_DIR/README.md .
    cp -r $ROOT_DIR/output/static .
    zip -r "gaoas_${platform}_${DATE}_${COMMIT_HASH}.zip" *
    mv "gaoas_${platform}_${DATE}_${COMMIT_HASH}.zip" $ROOT_DIR
    # rm -rf output/$platform
done

# rm -rf ./output