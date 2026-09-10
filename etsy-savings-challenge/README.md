# 52-Week Savings Challenge — Dashboard + Tracker Bundle

Ready-to-list Etsy digital product. Printable savings bundle with everything
the top sellers include (dashboard, 6 pre-filled trackers, budget + net worth
bonuses, Letter/A4/A5 sizes, ink-saver) **plus** an auto-calculating Excel
bonus most competitors don't have.

## Contents

| Path | What it is |
|---|---|
| `source/build_savings.py` | Generates the 4 printable PDFs (reportlab) |
| `source/build_excel.py` | Generates the Excel auto-calc bonus (openpyxl) |
| `source/build_listing.py` | Generates the 6 Etsy listing images (Pillow) |
| `pdf/` | The 4 buyer PDFs + `.xlsx` (the actual product) |
| `listing/` | 6 listing images, 2700×2025 |
| `package/` | Buyer ZIP + README-PLEASE-READ.txt |
| `Etsy-Listing.md` | Title, tags, description, price, photo order |

## Rebuild everything

```bash
/home/user/pylibs/bin/python source/build_savings.py
/home/user/pylibs/bin/python source/build_excel.py
/home/user/pylibs/bin/python source/build_listing.py
bash package.sh
```

## Challenge math (verified)

Classic/Reverse $1,378 • $5K (80→110) • $10K (160→220) • $20K (320→440) •
Blank custom. All pre-filled sheets sum exactly to their stated totals.

## Customizing

- Colors live in `PALETTES` in `build_savings.py` (+ `build_excel.py` / `build_listing.py`).
- Weekly amounts live in `CHALLENGES` in `build_savings.py` (mirror in `build_excel.py`).
- After editing: rerun the build commands above and re-zip with `bash package.sh`.
