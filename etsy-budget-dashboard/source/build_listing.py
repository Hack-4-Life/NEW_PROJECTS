#!/usr/bin/env python3
"""Etsy listing images (2700x2025) for TrueSpend Budget Dashboard.
Stylized dark-and-gold dashboard mockups drawn with Pillow.
Run: python3 source/build_listing.py
"""
import os, math
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "listing")
W, H = 2700, 2025

BG = (13, 16, 23)
BG2 = (23, 30, 44)
CARD = (26, 34, 51)
CARD2 = (34, 43, 63)
INK = (243, 238, 222)
SUB = (154, 163, 181)
LINE = (52, 62, 88)
GOLD = (216, 180, 90)
GOLD_L = (240, 212, 136)
GREEN = (74, 222, 128)
RED = (248, 113, 113)
WARN = (251, 191, 36)
WHITE = (255, 255, 255)

FD = "/usr/share/fonts/truetype/dejavu/"

def font(bold, size):
    return ImageFont.truetype(FD + ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"), size)

def base():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # gold hairlines top/bottom + soft glow blobs
    d.rectangle([0, 0, W, 14], fill=GOLD)
    d.rectangle([0, H - 14, W, H], fill=GOLD)
    glow = Image.new("RGB", (W, H), BG)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-500, -380, 1100, 500], fill=(30, 28, 16))
    gd.ellipse([1900, 1300, 3200, 2400], fill=(24, 22, 14))
    img = Image.blend(img, glow, 0.55)
    return img, ImageDraw.Draw(img)

def center(d, y, text, f, fill=INK):
    d.text((W / 2, y), text, font=f, fill=fill, anchor="ma")

def pill(d, cx, y, text, f, bg=GOLD, fg=(20, 16, 4), h=86, pad_x=52):
    w = d.textlength(text, font=f) + pad_x * 2
    d.rounded_rectangle([cx - w / 2, y, cx + w / 2, y + h], radius=h // 2, fill=bg)
    d.text((cx, y + h / 2), text, font=f, fill=fg, anchor="mm")
    return w

def badge_row(d, y, items, f, bg=CARD2, fg=INK):
    widths = [d.textlength(t, font=f) + 96 for t in items]
    gap = 26
    x = (W - sum(widths) - gap * (len(items) - 1)) / 2
    for t, w in zip(items, widths):
        d.rounded_rectangle([x, y, x + w, y + 78], radius=39, fill=bg, outline=LINE, width=3)
        d.text((x + w / 2, y + 39), t, font=f, fill=fg, anchor="mm")
        x += w + gap

def card_box(d, x, y, w, h, r=28):
    d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=CARD, outline=LINE, width=3)

def gauge(d, cx, cy, r, pct, label="$2,747"):
    d.arc([cx - r, cy - r, cx + r, cy + r], 135, 135 + 270, fill=LINE, width=26)
    d.arc([cx - r, cy - r, cx + r, cy + r], 135, 135 + 270 * pct, fill=GOLD, width=26)
    d.text((cx, cy - 30), "SAFE TO SPEND", font=font(True, 30), fill=SUB, anchor="mm")
    d.text((cx, cy + 36), label, font=font(True, 84), fill=INK, anchor="mm")

def pbar(d, x, y, w, pct, col=GOLD, h=20):
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=CARD2)
    d.rounded_rectangle([x, y, x + w * max(0.02, min(1, pct)), y + h], radius=h // 2, fill=col)

def ring(d, cx, cy, r, pct, label="64%"):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=CARD2, width=24)
    d.arc([cx - r, cy - r, cx + r, cy + r], -90, -90 + 360 * pct, fill=GOLD, width=24)
    d.text((cx, cy), label, font=font(True, 64), fill=INK, anchor="mm")

def mini_cal(d, x, y, cw=560, ch=480):
    card_box(d, x, y, cw, ch)
    d.text((x + 36, y + 24), "September", font=font(True, 52), fill=INK)
    d.text((x + cw - 36, y + 30), "Payday 15th", font=font(True, 34), fill=GREEN, anchor="ra")
    gx, gy = x + 36, y + 120
    cell, gap = (cw - 72 - 6 * 12) / 7, 12
    for i, wd in enumerate("SMTWTFS"):
        d.text((gx + i * (cell + gap) + cell / 2, gy), wd, font=font(True, 26), fill=SUB, anchor="ma")
    gy += 52
    marks = {1: GOLD, 9: RED, 11: SUB, 15: GREEN, 16: WARN, 21: WARN, 24: WARN}
    n = 1
    for r in range(5):
        for c in range(7):
            if r == 0 and c < 1:
                continue
            if n > 30:
                break
            cx0 = gx + c * (cell + gap)
            col = marks.get(n)
            fill = CARD2 if not col else col
            if n == 10:
                d.rounded_rectangle([cx0, gy + r * 62, cx0 + cell, gy + r * 62 + 52], radius=12, fill=GOLD)
                d.text((cx0 + cell / 2, gy + r * 62 + 26), str(n), font=font(True, 28), fill=(20, 16, 4), anchor="mm")
            else:
                d.rounded_rectangle([cx0, gy + r * 62, cx0 + cell, gy + r * 62 + 52], radius=12, fill=CARD2)
                d.text((cx0 + cell / 2, gy + r * 62 + 26), str(n), font=font(True, 28), fill=INK if col else SUB, anchor="mm")
                if col:
                    d.ellipse([cx0 + cell / 2 - 6, gy + r * 62 + 40, cx0 + cell / 2 + 6, gy + r * 62 + 52], fill=col)
            n += 1
    d.line([x + 36, y + ch - 200, x + cw - 36, y + ch - 200], fill=LINE, width=3)
    d.text((x + 36, y + ch - 175), "9 bills tracked", font=font(True, 40), fill=INK)
    d.text((x + cw - 36, y + ch - 175), "$1,922 / mo", font=font(True, 40), fill=GOLD_L, anchor="ra")
    d.text((x + 36, y + ch - 115), "Next: iCloud+ $2.99 tomorrow", font=font(False, 36), fill=SUB)
    d.text((x + 36, y + ch - 65), "autopay on", font=font(False, 36), fill=GREEN)

def bars(d, x, y, w, h, vals, cols):
    mx = max(vals) or 1
    bw = (w - (len(vals) - 1) * 18) / len(vals)
    for i, v in enumerate(vals):
        bh = (h - 60) * v / mx
        d.rounded_rectangle([x + i * (bw + 18), y + h - 50 - bh, x + i * (bw + 18) + bw, y + h - 50], radius=10, fill=cols[i % len(cols)])

def check(d, x, y, s=44):
    d.ellipse([x, y, x + s, y + s], fill=GREEN)
    d.text((x + s / 2, y + s / 2 - 2), "✓", font=font(True, 30), fill=(6, 30, 14), anchor="mm")

# ---------------------------------------------------------------- cover
def make_cover():
    img, d = base()
    center(d, 120, "TRUESPEND", font(True, 170), GOLD_L)
    center(d, 320, "Budget Command Center", font(True, 84))
    center(d, 440, "Safe-to-spend  •  Bills  •  Debts  •  Goals  •  What-If tester", font(False, 50), SUB)
    # hero mock: gauge + envelopes + forecast
    card_box(d, 180, 620, 1120, 900)
    gauge(d, 740, 1010, 210, 0.72)
    d.text((740, 1290), "$549 / day  •  5 days to payday", font=font(False, 40), fill=SUB, anchor="mm")
    # envelopes
    card_box(d, 1360, 620, 590, 900)
    d.text((1396, 660), "ENVELOPES", font=font(True, 34), fill=SUB)
    envs = [("Groceries", .62, GREEN), ("Dining", .88, WARN), ("Fun", .41, GOLD), ("Shopping", 1.04, RED), ("Transport", .55, (56, 189, 248))]
    yy = 750
    for name, p, col in envs:
        d.text((1396, yy), name, font=font(True, 40), fill=INK)
        d.text((1914, yy), f"{int(p * 100)}%", font=font(True, 38), fill=col, anchor="ra")
        pbar(d, 1396, yy + 58, 518, min(p, 1), col, 22)
        yy += 138
    # forecast
    card_box(d, 2010, 620, 510, 900)
    d.text((2046, 660), "45-DAY FORECAST", font=font(True, 34), fill=SUB)
    bars(d, 2046, 780, 438, 420, [8, 9, 7, 10, 9, 11, 10, 12], [GOLD, GOLD, GOLD, GREEN, GOLD, GOLD, GREEN, GOLD])
    d.text((2046, 1260), "Low point  $3,082", font=font(True, 40), fill=GREEN)
    d.text((2046, 1320), "Never overdraft again", font=font(False, 38), fill=SUB)
    d.text((2046, 1420), "Paydays + bills plotted", font=font(False, 34), fill=SUB)
    badge_row(d, 1600, ["8 views", "6 themes", "100% offline", "No subscription"], font(True, 40))
    pill(d, W / 2, 1740, "One file  •  Works on phone, tablet & computer", font(True, 48))
    img.save(f"{OUT}/cover.jpg", quality=88)

# ---------------------------------------------------------------- today view
def make_today():
    img, d = base()
    center(d, 90, "KNOW YOUR NUMBER IN 3 SECONDS", font(True, 88), GOLD_L)
    center(d, 210, "Open it. See your safe-to-spend. Get on with your day.", font(False, 50), SUB)
    card_box(d, 150, 340, 1000, 1050)
    gauge(d, 650, 760, 230, 0.72)
    d.text((650, 1070), "Checking  $3,284", font=font(True, 46), fill=INK, anchor="mm")
    d.text((650, 1140), "Bills due  $3  •  Debt mins  $435", font=font(False, 42), fill=SUB, anchor="mm")
    d.text((650, 1210), "Daily budget  $549", font=font(True, 46), fill=GREEN, anchor="mm")
    d.rounded_rectangle([330, 1280, 970, 1350], radius=35, fill=GOLD)
    d.text((650, 1315), "Log expense in 2 taps", font=font(True, 40), fill=(20, 16, 4), anchor="mm")
    x = 1250
    items = [
        ("Safe-to-spend hero", "Checking minus bills, debt mins & buffer."),
        ("45-day forecast", "Paydays + bills + spending, plotted daily."),
        ("Bills due soon", "Next 14 days with one-tap \"paid\"."),
        ("Envelope watch", "Over-cap warnings before you overspend."),
        ("Recent activity", "Every dollar, newest first, searchable."),
    ]
    y = 420
    for t, sub in items:
        check(d, x, y)
        d.text((x + 70, y - 8), t, font=font(True, 54), fill=INK)
        d.text((x + 70, y + 62), sub, font=font(False, 44), fill=SUB)
        y += 190
    pill(d, 1870, 1420, "Today view  •  your 3-second morning habit", font(True, 44))
    img.save(f"{OUT}/preview-today.jpg", quality=88)

# ---------------------------------------------------------------- bills
def make_bills():
    img, d = base()
    center(d, 90, "NEVER MISS WHAT'S COMING UP", font(True, 88), GOLD_L)
    center(d, 210, "Bills + paydays + subscriptions on one calm calendar.", font(False, 50), SUB)
    mini_cal(d, 150, 360, 760, 1020)
    card_box(d, 970, 360, 750, 1020)
    d.text((1006, 400), "SUBSCRIPTION STACK", font=font(True, 36), fill=SUB)
    subs = [("Netflix", "$15.99"), ("Spotify", "$11.99"), ("Gym", "$39.00"), ("iCloud+", "$2.99")]
    yy = 490
    for n, a in subs:
        d.rounded_rectangle([1006, yy, 1684, yy + 120], radius=20, fill=CARD2)
        d.text((1040, yy + 60), n, font=font(True, 44), fill=INK, anchor="lm")
        d.text((1650, yy + 60), a, font=font(True, 44), fill=WARN, anchor="rm")
        yy += 145
    d.text((1006, 1100), "$69.97 / month", font=font(True, 52), fill=RED)
    d.text((1006, 1170), "$839.64 / year — audit me!", font=font(False, 42), fill=SUB)
    d.text((1006, 1260), "Cancel one $16 sub =", font=font(True, 44), fill=GREEN)
    d.text((1006, 1315), "$192 / year back", font=font(True, 44), fill=GREEN)
    x = 1800
    items = [
        ("Bill calendar", "Due dates + paydays, color-coded."),
        ("One-tap paid", "Marks paid AND logs the spend."),
        ("Autopay badges", "Know what's hands-free."),
        ("Overdue alerts", "Red flags on the Today view."),
        ("Yearly waste math", "Subscriptions priced per year."),
    ]
    y = 420
    for t, sub in items:
        check(d, x, y)
        d.text((x + 70, y - 8), t, font=font(True, 50), fill=INK)
        d.text((x + 70, y + 58), sub, font=font(False, 40), fill=SUB)
        y += 190
    pill(d, 2180, 1420, "Bills view", font(True, 44))
    img.save(f"{OUT}/preview-bills.jpg", quality=88)

# ---------------------------------------------------------------- debts + goals
def make_debts_goals():
    img, d = base()
    center(d, 90, "DEBT DOWN. GOALS UP.", font(True, 96), GOLD_L)
    center(d, 210, "Snowball-vs-avalanche simulator + savings goals that beg to be funded.", font(False, 50), SUB)
    card_box(d, 150, 360, 1150, 1020)
    d.text((190, 400), "DEBT SIMULATOR  •  +$200/mo extra", font=font(True, 38), fill=SUB)
    d.text((190, 480), "Snowball: 31 mo • $1,713 interest", font=font(True, 48), fill=INK)
    pbar(d, 190, 560, 1070, 0.52, WARN, 30)
    d.text((190, 630), "Avalanche: 30 mo • $1,677 interest", font=font(True, 48), fill=INK)
    pbar(d, 190, 710, 1070, 0.48, GREEN, 30)
    d.text((190, 800), "Attack order:", font=font(True, 44), fill=SUB)
    d.text((190, 860), "Visa  >  Student  >  Car", font=font(True, 52), fill=GOLD_L)
    d.rounded_rectangle([190, 960, 1260, 1070], radius=24, fill=(20, 40, 26))
    d.text((230, 1015), "Extra $200 saves $1,940 in interest", font=font(True, 44), fill=GREEN)
    d.text((190, 1130), "Slide the extra-payment bar,", font=font(False, 44), fill=SUB)
    d.text((190, 1185), "watch freedom get closer.", font=font(False, 44), fill=SUB)
    card_box(d, 1360, 360, 490, 1020)
    d.text((1605, 400), "EMERGENCY", font=font(True, 36), fill=SUB, anchor="ma")
    ring(d, 1605, 640, 130, 0.64, "64%")
    d.text((1605, 830), "$5,760 saved", font=font(True, 50), fill=INK, anchor="mm")
    d.text((1605, 890), "2.3 months of safety", font=font(False, 40), fill=SUB, anchor="mm")
    goals = [("Japan Trip", .45), ("Laptop", .36)]
    yy = 980
    for n, p in goals:
        d.text((1400, yy), n, font=font(True, 42), fill=INK)
        pbar(d, 1400, yy + 55, 410, p, GOLD, 22)
        yy += 150
    x = 1930
    items = [
        ("2 strategies", "Snowball vs avalanche, side by side."),
        ("Interest saved", "See what extra payments earn you."),
        ("Goal bars", "$/month needed by deadline."),
        ("Emergency ring", "Months-of-safety, at a glance."),
    ]
    y = 460
    for t, sub in items:
        check(d, x, y)
        d.text((x + 70, y - 8), t, font=font(True, 48), fill=INK)
        d.text((x + 70, y + 58), sub, font=font(False, 38), fill=SUB)
        y += 210
    pill(d, 2260, 1380, "Debts + Goals", font(True, 44))
    img.save(f"{OUT}/preview-debts-goals.jpg", quality=88)

# ---------------------------------------------------------------- what-if
def make_whatif():
    img, d = base()
    center(d, 90, "BEFORE YOU SPEND, ASK THE APP", font(True, 88), GOLD_L)
    center(d, 210, "Drag the price slider. Get a verdict: Go, Tight, or Skip.", font(False, 50), SUB)
    card_box(d, 150, 360, 1150, 1020)
    d.text((190, 400), "THE TEMPTATION  •  $250 headphones", font=font(True, 38), fill=SUB)
    d.rounded_rectangle([190, 480, 1260, 500], radius=10, fill=CARD2)
    d.rounded_rectangle([190, 480, 190 + 1070 * 0.3, 500], radius=10, fill=GOLD)
    d.ellipse([190 + 1070 * 0.3 - 26, 444, 190 + 1070 * 0.3 + 26, 536], fill=GOLD_L)
    d.rounded_rectangle([190, 580, 1260, 780], radius=28, fill=(20, 40, 26), outline=GREEN, width=4)
    d.text((725, 640), "GO FOR IT", font=font(True, 72), fill=GREEN, anchor="mm")
    d.text((725, 715), "Fits with $2,498 safe-to-spend left", font=font(False, 42), fill=INK, anchor="mm")
    rows = [("Safe to spend", "$2,748  >  $2,498"), ("Shopping envelope", "$116 left"), ("Daily drain", "0.5 days"), ("Debt delay", "~0 mo")]
    yy = 830
    for a, b in rows:
        d.text((190, yy), a, font=font(True, 44), fill=INK)
        d.text((1260, yy), b, font=font(True, 44), fill=GOLD_L, anchor="ra")
        d.line([190, yy + 62, 1260, yy + 62], fill=LINE, width=3)
        yy += 110
    x = 1400
    items = [
        ("Guilt-free yes", "Math says it fits? Enjoy it."),
        ("Tight warnings", "Busts an envelope? You'll know."),
        ("Skip alerts", "Over safe-to-spend? Hard no."),
        ("One-tap log", "Bought it? Log it instantly."),
    ]
    y = 460
    for t, sub in items:
        check(d, x, y)
        d.text((x + 70, y - 8), t, font=font(True, 54), fill=INK)
        d.text((x + 70, y + 62), sub, font=font(False, 44), fill=SUB)
        y += 210
    pill(d, 1980, 1380, "What-If view  •  exclusive tester", font(True, 44))
    img.save(f"{OUT}/preview-whatif.jpg", quality=88)

# ---------------------------------------------------------------- themes
def make_themes():
    img, d = base()
    center(d, 90, "MAKE IT YOURS", font(True, 110), GOLD_L)
    center(d, 230, "6 themes  •  13 currencies  •  Privacy blur  •  Simple mode", font(False, 50), SUB)
    themes = [
        ("Midnight Gold", (13, 16, 23), GOLD),
        ("Vault Green", (10, 21, 17), (201, 162, 75)),
        ("Paper Light", (244, 239, 230), (176, 122, 46)),
        ("Blush Noir", (22, 15, 22), (229, 164, 196)),
        ("Ocean", (8, 19, 31), (56, 189, 248)),
        ("Lavender Mist", (239, 238, 247), (109, 91, 208)),
    ]
    x0, y0, gw, gh, gap = 180, 400, 700, 420, 60
    for i, (name, bgc, acc) in enumerate(themes):
        cx, cy = x0 + (i % 3) * (gw + gap), y0 + (i // 3) * (gh + gap)
        d.rounded_rectangle([cx + 10, cy + 14, cx + gw + 10, cy + gh + 14], radius=30, fill=(0, 0, 0, 90) if isinstance(BG, tuple) else (0, 0, 0))
        d.rounded_rectangle([cx, cy, cx + gw, cy + gh], radius=30, fill=bgc, outline=acc, width=5)
        dark = sum(bgc) < 400
        ink = INK if dark else (46, 43, 63)
        sub = SUB if dark else (123, 118, 148)
        d.rounded_rectangle([cx + 40, cy + 36, cx + 150, cy + 80], radius=20, fill=acc)
        d.text((cx + 170, cy + 38), "$2,747", font=font(True, 56), fill=ink)
        d.text((cx + 40, cy + 110), "SAFE TO SPEND", font=font(True, 28), fill=sub)
        for j, p in enumerate([0.62, 0.88, 0.41]):
            yy = cy + 185 + j * 54
            d.rounded_rectangle([cx + 40, yy, cx + gw - 40, yy + 26], radius=13, fill=CARD2 if dark else (226, 222, 242))
            d.rounded_rectangle([cx + 40, yy, cx + 40 + (gw - 80) * p, yy + 26], radius=13, fill=acc)
        d.rounded_rectangle([cx + 40, cy + gh - 90, cx + gw - 40, cy + gh - 36], radius=22, fill=acc)
        d.text((cx + gw / 2, cy + gh - 63), name, font=font(True, 40), fill=(20, 16, 4) if dark else WHITE, anchor="mm")
    badge_row(d, 1480, ["$  €  £  ¥  ₹  kr + more", "Glance-proof blur", "Big-number simple mode"], font(True, 40))
    pill(d, W / 2, 1620, "Your budget. Your eyes only.", font(True, 48))
    img.save(f"{OUT}/preview-themes.jpg", quality=88)

# ---------------------------------------------------------------- what's included
def make_included():
    img, d = base()
    center(d, 90, "EVERYTHING YOU GET", font(True, 110), GOLD_L)
    center(d, 230, "Instant download  •  Yours forever  •  Free updates", font(False, 50), SUB)
    files = [
        ("HTML", "TrueSpend-Dashboard.html", "The entire app in ONE file — open in any browser", GOLD),
        ("PDF", "Quick-Start-Guide.pdf", "60-second setup + daily habits + FAQ", GREEN),
        ("TXT", "README-PLEASE-READ.txt", "How to open, install & back up your data", (56, 189, 248)),
        ("STYLES", "6 themes + 13 currencies", "Midnight, Vault, Paper, Blush, Ocean, Lavender", WARN),
        ("VIEWS", "8 powerful views", "Today • Spend • Bills • Debts • Goals • What-If • Insights • Settings", GOLD_L),
    ]
    y = 380
    for tag, name, desc, col in files:
        d.rounded_rectangle([180, y, 2520, y + 196], radius=26, fill=CARD, outline=LINE, width=3)
        tw = d.textlength(tag, font=font(True, 44)) + 70
        d.rounded_rectangle([230, y + 58, 230 + tw, y + 138], radius=20, fill=col)
        d.text((230 + tw / 2, y + 98), tag, font=font(True, 44), fill=(20, 16, 4), anchor="mm")
        d.text((230 + tw + 40, y + 42), name, font=font(True, 54), fill=INK)
        d.text((230 + tw + 40, y + 118), desc, font=font(False, 44), fill=SUB)
        y += 224
    pill(d, W / 2, 1560, "HOW IT WORKS:  Buy  >  Download  >  Double-click  >  Budget", font(True, 46))
    center(d, 1720, "DIGITAL download — no physical item ships  •  No accounts • No fees • No formulas", font(False, 44), SUB)
    img.save(f"{OUT}/whats-included.jpg", quality=88)

def main():
    os.makedirs(OUT, exist_ok=True)
    make_cover(); make_today(); make_bills(); make_debts_goals(); make_whatif(); make_themes(); make_included()
    print("listing images done")

if __name__ == "__main__":
    main()
