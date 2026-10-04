#!/usr/bin/env sh
# Downloads the MakeHuman 1.1 asset data (npm package "makehuman-data", ~260 MB unpacked) into .cache/.
# Bundled MakeHuman assets are CC0 (see https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md);
# the build only uses CC0 or CC-BY assets and lists them in public/assets/characters/CREDITS.md.
set -e
cd "$(dirname "$0")/../.."
mkdir -p .cache
if [ ! -d .cache/makehuman-data ]; then
  (cd .cache && npm pack makehuman-data@0.0.2 --silent && tar xzf makehuman-data-0.0.2.tgz && mv package makehuman-data && rm makehuman-data-0.0.2.tgz)
fi
python3 -c "import bpy" 2>/dev/null || pip install bpy==4.2.0 pillow
echo "makehuman-data ready in .cache/makehuman-data"
