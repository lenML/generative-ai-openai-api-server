set -e

# NEXE_REMOTE="https://github.com/microcodez/nexe_builds/releases/download/0.4.0/"
# NODE_VERSION="20.10.0"

NEXE_REMOTE="https://github.com/urbdyn/nexe_builds/releases/download/0.3.0/"
NODE_VERSION="18.14.0"

# 第一个参数是output路径 比如 "./output/windows/main.exe"
OUTPUT_PATH=$1
# 第二个参数为 target 前缀 比如 "windows-x64"
TARGET_PREFIX=$2

npx nexe ./output/main.js -o $OUTPUT_PATH -t "$TARGET_PREFIX-$NODE_VERSION" --remote "$NEXE_REMOTE"

