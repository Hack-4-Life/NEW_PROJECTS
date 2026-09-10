# Waypoint Budget Studio

An interactive, offline budget dashboard built to be sold as a digital product on
Etsy — and to beat the listings already selling there.

**The customer gets one self-contained HTML file.** No install, no account, no
subscription, no server, no internet connection required. Their data never leaves
their browser.

---

## What's in here

```
index.html                     development shell (loads the modules below via <script src>)
src/js/store.js                state, persistence, migration, demo data, presets
src/js/engine.js               all money math: recurrence, safe-to-spend, forecasts,
                               envelopes, debt payoff, subscription detection, score
src/js/charts.js               zero-dependency SVG charts (donut, gauge, line, bars, rings)
src/js/app.js                  shell: routing, rendering, modals, quick-add, onboarding, tour
src/js/views.js                Spend, Bills, Debts, Goals, Calendar, Reports, Settings
build/build.js                 → dist/ : single-file bundle, guide, read-me, licence, ZIP
build/guide.html               the illustrated customer guide that ships with the product
marketing/build-images.js      renders the 9 Etsy listing images from the app's real data
marketing/etsy-listing.md      title, tags, description, pricing, image order, launch checklist
dist/                          the deliverable (generated — rebuild with `node build/build.js`)
```

## Build the product

```bash
node build/build.js
```

Produces, in `dist/`:

| File | Purpose |
| --- | --- |
| `Waypoint-Budget-Studio.html` | The dashboard — one file, ~265 KB, zero external requests |
| `Getting-Started-Guide.html` | Illustrated customer manual |
| `READ-ME-FIRST.txt` | Three-step setup plus the backup advice |
| `LICENSE.txt` | Plain-English personal-use terms |
| `Waypoint-Budget-Studio-v1.0.zip` | Ready-to-upload Etsy digital download (dependencies-free ZIP writer) |

## Rebuild the listing images

```bash
WAYPOINT_DEPS=/path/to/node_modules node marketing/build-images.js
```

Needs `jsdom` and `@resvg/resvg-js` plus the Inter font files. The generator boots
the real dashboard headlessly, reads its actual numbers, and renders nine
2000×2000 PNGs into `marketing/listing-images/`. Nothing in the marketing is
invented — if the demo numbers change, the images change with them.

## Verify it

```bash
WAYPOINT_DEPS=/path/to/node_modules node build/verify.js
```

Boots the dashboard in a headless DOM, drives every screen and the main
interactions (quick-add, mark-paid, backup round-trip, empty states, presets),
cross-checks the debt engine against an independent payoff simulation, then
repeats the view checks against the built single-file product in `dist/`.
It exits non-zero on any runtime error — 38/38 checks pass on v1.0.

## Product principles

1. **Offline and private by construction.** No network calls anywhere in the
   shipped file, no analytics, no CDN. Data lives in `localStorage`.
2. **The number the customer needs is on the first screen.** Safe-to-spend is
   calculated, explainable (tap "Show the math") and never a guess.
3. **Every action is reversible.** Undo on the last snapshot, plus JSON backup and
   restore that moves everything between browsers.
4. **No dependency traps.** Vanilla ES5-compatible JavaScript so the file still
   opens in five years on an old laptop.
5. **Fail loudly, never silently.** Money math is unit-checked against an
   independent simulation; a corrupt saved budget is backed up rather than
   discarded (`waypoint.backup.v1` in localStorage).

## Engine highlights

- `expand()` — one recurrence engine for weekly → annual → twice-monthly schedules,
  walking backwards and forwards from an anchor date
- `safeToSpend()` — cash − bills due − debt minimums − goal deposits − buffer,
  with an optional "realistic mode" that also reserves unlogged everyday spending
- `forecast(n)` — day-by-day projection with bill, debt and payday markers
- `envelopes()` — per-category caps with bill-aware pacing and optional rollover
- `debtPlan()` — snowball / avalanche / custom payoff simulation reporting months,
  interest paid, interest avoided and the debt-free date
- `detectSubscriptions()` — finds recurring charges locally from transaction history
- `moneyScore()` — weighted 0–100 across savings rate, envelope discipline, bill
  coverage, emergency runway and debt pressure

## Licence

Personal use. Not for resale or redistribution as a template — see `dist/LICENSE.txt`.
