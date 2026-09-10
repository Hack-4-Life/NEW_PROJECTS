#!/usr/bin/env bash
# Build script for the "Sage & Terracotta" minimalist boho printable wall art set.
# Generates: 300-DPI print files (5 ratios), Etsy listing images, and buyer PDFs.
set -euo pipefail

cd "$(dirname "$0")"

BG="#F2ECE2"          # warm ivory background
INK="#4A3B32"         # soft brown-black text
SUB="#7A6A5E"         # muted brown subtext
MAT="#FFFFFF"         # white mat
FRAME="#E4DBCC"       # thin frame color

rm -rf prints listing bonus
mkdir -p prints/2x3 prints/3x4 prints/4x5 prints/5x7-A prints/square listing bonus

# ---------- 1. PRINT FILES (300 DPI) ----------
mkprint() {
  local src="$1" name="$2" ratio="$3" w="$4" h="$5" crop
  case "$ratio" in
    2x3)   crop="768x1152" ;;
    3x4)   crop="864x1152" ;;
    4x5)   crop="928x1152" ;;
    5x7-A)  crop="815x1152" ;;
    square) crop="928x928" ;;
  esac
  convert "$src" -gravity center -crop "$crop+0+0" +repage \
    -filter Lanczos -resize "${w}x${h}!" -unsharp 0x0.6+0.6+0.008 \
    -quality 88 "prints/$ratio/$name.jpg"
}

for f in masters/*.jpg; do
  base="$(basename "$f" .jpg)"                        # e.g. 01-arch-sun
  name="$(echo "$base" | sed 's/^[0-9]*-//')"         # e.g. arch-sun
  mkprint "$f" "$name" 2x3    3000 4500
  mkprint "$f" "$name" 3x4    2700 3600
  mkprint "$f" "$name" 4x5    2400 3000
  mkprint "$f" "$name" 5x7-A   2480 3508
  mkprint "$f" "$name" square 3000 3000
done

# ---------- 2. ETSY LISTING IMAGES (2700 x 2025, 4:3) ----------
LS=2700x2025

# 2a. Cover: 3x2 grid of the six real designs
montage masters/01-arch-sun.jpg masters/02-eucalyptus-line.jpg masters/03-boho-figure.jpg \
        masters/04-midcentury-shapes.jpg masters/05-dune-landscape.jpg masters/06-pampas-vase.jpg \
        -tile 3x2 -geometry 660x825+28+28 -background "$BG" listing/_grid.png
convert listing/_grid.png -gravity north -background "$BG" -extent 2700x1840 listing/_grid_pad.png
convert listing/_grid_pad.png -gravity south -background "$BG" -extent "$LS" \
  -font DejaVu-Serif -pointsize 58 -fill "$INK" -annotate +0+58 "Sage & Terracotta" \
  -font DejaVu-Sans -pointsize 36 -fill "$SUB" -annotate +0+12 "Minimalist Boho Gallery Wall Set of 6 — Printable Art" \
  listing/cover.jpg
rm -f listing/_grid.png listing/_grid_pad.png

# 2b. Individual design images (matted look)
i=0
for f in masters/*.jpg; do
  i=$((i+1))
  convert "$f" -resize 1500x1875 -bordercolor "$MAT" -border 70 -bordercolor "$FRAME" -border 6 listing/_art.png
  convert -size "$LS" xc:"$BG" listing/_art.png -gravity center -composite listing/design-$i.jpg
done
rm -f listing/_art.png

# 2c. Size guide
convert -size "$LS" xc:"$BG" -gravity north \
  -font DejaVu-Sans-Bold -pointsize 66 -fill "$INK" -annotate +0+90 "PRINT SIZE GUIDE" \
  -font DejaVu-Sans -pointsize 44 -fill "$SUB" -annotate +0+215 "Every design is included in all 5 ratios below, at 300 DPI" \
  -font DejaVu-Sans -pointsize 40 -fill "$INK" -annotate +0+340 \
$'4:5 ratio   —   4x5, 8x10, 11x14*, 16x20, 24x30 inches\n\n2:3 ratio   —   4x6, 8x12, 12x18, 16x24, 24x36 inches\n\n3:4 ratio   —   6x8, 9x12, 12x16, 15x20, 18x24 inches\n\n5:7 / ISO A —   5x7, A5, A4, A3, A2\n\nSquare      —   5x5, 8x8, 12x12, 16x16 inches' \
  -gravity south -font DejaVu-Sans -pointsize 34 -fill "$SUB" -annotate +0+70 \
  "*11x14 inches trims about 1% off the long edges — designs are centered, so nothing is lost" \
  listing/size-guide.jpg

# 2d. What's included
convert -size "$LS" xc:"$BG" -gravity north \
  -font DejaVu-Sans-Bold -pointsize 66 -fill "$INK" -annotate +0+90 "WHAT'S INCLUDED" \
  -font DejaVu-Sans -pointsize 42 -fill "$INK" -annotate +0+330 \
$'•  6 original designs: arch sun, eucalyptus, boho figure, mid-century\n    shapes, dune landscape, pampas vase\n\n•  5 print ratios per design — 30 high-resolution JPG files\n\n•  300 DPI — print at home or at any print lab\n\n•  Instant download, no watermark, lifetime access' \
  -gravity south -font DejaVu-Sans -pointsize 34 -fill "$SUB" -annotate +0+70 \
  "This is a DIGITAL DOWNLOAD — no physical item will be shipped" \
  listing/whats-included.jpg

# 2e. Lifestyle mockups (AI-generated source photos, resized to listing spec)
m=0
for f in listing-source/*.jpg; do
  m=$((m+1))
  convert "$f" -resize 2700x2025^ -gravity center -crop 2700x2025+0+0 +repage listing/mockup-$m.jpg
done

# ---------- 3. CUSTOMER BONUS PDFs ----------
# 3a. Thank you + print tips
convert -size 2400x3200 xc:"$BG" -gravity north \
  -font DejaVu-Serif -pointsize 80 -fill "$INK" -annotate +0+150 "Thank you!" \
  -gravity northwest -font DejaVu-Sans -pointsize 44 -fill "$SUB" -annotate +150+340 \
$'Thank you so much for your order — I hope you love your new art!\n\nHere is how to get the best result:\n\n1.  Pick the folder that matches your frame size (see the size guide).\n2.  Print at 100% scale on matte or fine-art paper, 180 gsm or heavier.\n3.  Every file is already 300 DPI — just hit print.\n4.  For large sizes, a local print shop or online lab gives the best result.\n\nIf anything is not perfect, message me on Etsy and I will make it right.\n\n— The Studio' \
  bonus/Thank-You.jpg
python3 make_pdf.py bonus/Thank-You.jpg bonus/Thank-You.pdf 600 800 2400 3200

# 3b. Printing guide
convert -size 2400x3200 xc:"$BG" -gravity north \
  -font DejaVu-Sans-Bold -pointsize 72 -fill "$INK" -annotate +0+140 "Printing Guide" \
  -gravity northwest -font DejaVu-Sans -pointsize 44 -fill "$SUB" -annotate +150+330 \
$'PAPER — matte photo paper, cardstock, or cotton fine-art paper.\nFrames look best with a white mat (border) around the print.\n\nHOME PRINTER — set scale to 100% and quality to "Best".\n\nPRINT SHOP — send the JPG from the folder matching your frame\nsize; they will handle the rest.\n\nSIZING — each file is named by its ratio (2x3, 3x4, 4x5, 5x7-A,\nsquare). A 4:5 file prints 8x10, 16x20 and 24x30 inches with no\ncropping. All designs are centered, so minor trims never cut off art.' \
  bonus/Printing-Guide.jpg
python3 make_pdf.py bonus/Printing-Guide.jpg bonus/Printing-Guide.pdf 600 800 2400 3200

echo "Build complete."
find prints bonus listing -type f | sort
