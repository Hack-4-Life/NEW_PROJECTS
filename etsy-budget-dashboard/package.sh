#!/usr/bin/env bash
# Build the buyer ZIP for Etsy upload.
set -e
cd "$(dirname "$0")"
python3 source/build.py
python3 source/build_guide.py
rm -f package/TrueSpend-Budget-Dashboard.zip
cd package
cp ../product/TrueSpend-Dashboard.html .
cp ../pdf/Quick-Start-Guide.pdf .
zip -q TrueSpend-Budget-Dashboard.zip TrueSpend-Dashboard.html Quick-Start-Guide.pdf README-PLEASE-READ.txt
rm TrueSpend-Dashboard.html Quick-Start-Guide.pdf
cd ..
ls -la package/
echo "--- size check (Etsy limit 20MB per file) ---"
du -h package/TrueSpend-Budget-Dashboard.zip
