#!/usr/bin/env bash
# Package the print files into two Etsy-uploadable ZIPs (< 20 MB each).
set -euo pipefail
cd "$(dirname "$0")"

STAGE=package/Sage-Terracotta-Wall-Art-Set
rm -rf "$STAGE" package/*.zip
mkdir -p "$STAGE"

cp -r prints/4x5    "$STAGE/1_4x5_Ratio"
cp -r prints/3x4    "$STAGE/2_3x4_Ratio"
cp -r prints/2x3    "$STAGE/3_2x3_Ratio"
cp -r prints/5x7-A  "$STAGE/4_5x7_ISO-A"
cp -r prints/square "$STAGE/5_Square"
mkdir -p "$STAGE/Bonus"
cp bonus/Thank-You.pdf bonus/Printing-Guide.pdf "$STAGE/Bonus/"
cp listing/size-guide.jpg "$STAGE/SIZE-GUIDE.jpg"
cp package/README-PLEASE-READ.txt "$STAGE/"

# Part 1: 4x5 + 3x4 + 2x3
(cd package && zip -q -r Sage-Terracotta-Set-1of2.zip \
  Sage-Terracotta-Wall-Art-Set/README-PLEASE-READ.txt \
  Sage-Terracotta-Wall-Art-Set/SIZE-GUIDE.jpg \
  Sage-Terracotta-Wall-Art-Set/1_4x5_Ratio \
  Sage-Terracotta-Wall-Art-Set/2_3x4_Ratio \
  Sage-Terracotta-Wall-Art-Set/3_2x3_Ratio)

# Part 2: 5x7/ISO-A + square + bonus
(cd package && zip -q -r Sage-Terracotta-Set-2of2.zip \
  Sage-Terracotta-Wall-Art-Set/4_5x7_ISO-A \
  Sage-Terracotta-Wall-Art-Set/5_Square \
  Sage-Terracotta-Wall-Art-Set/Bonus)

ls -la package/*.zip
du -sh package/*.zip
