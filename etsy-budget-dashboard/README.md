# TrueSpend — Budget Command Center (Interactive Dashboard)

Ready-to-list Etsy digital product. A single-file, offline, private budgeting
app that beats the 5-screen competitors with **8 views, 6 themes, 13
currencies**, a debt snowball/avalanche simulator, a 45-day forecast, and an
exclusive Before-You-Spend tester.

## Contents

| Path | What it is |
|---|---|
| `source/template.html` | App shell (placeholders `/*__STYLES__*/`, `/*__APPJS__*/`) |
| `source/styles.css` | Full theme system (6 themes) + responsive layout |
| `source/part1.js` | Utils, demo data, store (localStorage), all budget math |
| `source/part2.js` | SVG charts + Today / Spend / Bills views |
| `source/part3.js` | Debts / Goals / What-If / Insights / Settings views |
| `source/part4.js` | Modals, import/export, setup wizard, init |
| `source/build.py` | Inlines everything → `product/TrueSpend-Dashboard.html` (one file) |
| `source/build_listing.py` | Generates the 7 Etsy listing images (Pillow) |
| `source/build_guide.py` | Generates the Quick-Start Guide PDF (reportlab) |
| `product/` | The actual product: one 92 KB self-contained HTML file |
| `pdf/` | Buyer Quick-Start Guide |
| `listing/` | 7 listing images, 2700×2025 |
| `package/` | Buyer ZIP + README-PLEASE-READ.txt |
| `Etsy-Listing.md` | Title, tags, description, price, photo order |

## Rebuild everything

```bash
python3 source/build.py          # app only
python3 source/build_listing.py  # listing images
bash package.sh                  # app + guide + buyer ZIP
```

Preview locally: `python3 -m http.server 8090 --bind 0.0.0.0` in `product/`,
then open `http://localhost:8090/TrueSpend-Dashboard.html`.

## Tests

- `node --check` on all four JS parts (syntax).
- Node logic test on `part1.js`: safe-to-spend, 45-day projection, debt
  simulator (snowball vs avalanche), 6-month aggregates, currencies,
  fresh-state edge cases.
- jsdom render test on the built file: all 8 views (demo + fresh state),
  quick-add, contribution, pay/unpay bill, what-if purchase, CSV/JSON
  export, all 6 themes, setup wizard.

## Customizing

- Rename the product: search `TrueSpend` in `source/` + file names.
- Themes: `:root` variable blocks in `styles.css` (+ swatch lists in
  `part3.js` settings and `part4.js` wizard).
- Demo data: `demoData()` in `part1.js` (dates are relative to today).
- Storage key: `KEY` in `part1.js` (bump to force buyer reset on updates).
- After editing: rerun `bash package.sh` and re-upload to Etsy.
