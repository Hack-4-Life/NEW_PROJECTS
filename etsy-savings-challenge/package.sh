#!/usr/bin/env bash
# Build the buyer ZIP for the 52-Week Savings Challenge bundle.
set -euo pipefail
cd "$(dirname "$0")"
ZIP="package/52-Week-Savings-Challenge_Complete-Bundle.zip"
rm -f "$ZIP"
cd pdf
zip -q -r "../$ZIP" \
  US-Letter_Full-Color.pdf \
  A4_Full-Color.pdf \
  A5-Binder_Full-Color.pdf \
  Ink-Saver_BW_US-Letter.pdf \
  Bonus_Auto-Calc_Dashboard.xlsx
cd ..
zip -q -j "$ZIP" package/README-PLEASE-READ.txt
echo "--- $ZIP ---"
unzip -l "$ZIP"
du -h "$ZIP"
