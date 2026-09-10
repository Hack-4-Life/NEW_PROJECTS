#!/usr/bin/env python3
"""Etsy listing images (2700x2025) for the 52-Week Savings Challenge bundle.
Stylized previews drawn with Pillow (no PDF rasterizer in sandbox).
Run: /home/user/pylibs/bin/python source/build_listing.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "listing")
W, H = 2700, 2025

CREAM = (251, 247, 240)
INK = (74, 59, 50)
SUB = (122, 106, 94)
SAGE = (125, 155, 122)
SAGE_D = (92, 122, 89)
SAGE_L = (228, 235, 224)
TERRA = (198, 123, 92)
TERRA_D = (165, 95, 66)
TERRA_L = (244, 220, 208)
GOLD = (201, 169, 106)
GOLD_L = (241, 230, 204)
LINE = (216, 207, 194)
WHITE = (255, 255, 255)

FD = "/usr/share/fonts/truetype/dejavu/"


def font(bold, size):
    return ImageFont.truetype(FD + ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"), size)


def base():
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    # subtle top + bottom bands
    d.rectangle([0, 0, W, 26], fill=SAGE_D)
    d.rectangle([0, H - 26, W, H], fill=SAGE_D)
    return img, d


def center(d, y, text, f, fill=INK):
    d.text((W / 2, y), text, font=f, fill=fill, anchor="ma")


def pill(d, cx, y, text, f, bg=TERRA, fg=WHITE, pad_x=46, h=86):
    w = d.textlength(text, font=f) + pad_x * 2
    d.rounded_rectangle([cx - w/2, y, cx + w/2, y + h], radius=h//2, fill=bg)
    d.text((cx, y + h/2), text, font=f, fill=fg, anchor="mm")
    return w


def badge_row(d, y, items, f):
    widths = [d.textlength(t, font=f) + 92 for t in items]
    gap = 28
    x = (W - sum(widths) - gap*(len(items)-1)) / 2
    for t, w in zip(items, widths):
        d.rounded_rectangle([x, y, x + w, y + 78], radius=39, fill=SAGE_D)
        d.text((x + w/2, y + 39), t, font=f, fill=WHITE, anchor="mm")
        x += w + gap


def mini_page(kind, pw=620, ph=800):
    """Stylized mini page mock. kind: dash | tracker | budget | networth | excel."""
    img = Image.new("RGBA", (pw + 40, ph + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ox, oy = 20, 20
    # shadow
    d.rounded_rectangle([ox+10, oy+14, ox+pw+10, oy+ph+14], radius=18, fill=(74, 59, 50, 70))
    d.rounded_rectangle([ox, oy, ox+pw, oy+ph], radius=18, fill=WHITE)
    d.rounded_rectangle([ox, oy, ox+pw, oy+ph], radius=18, outline=LINE, width=3)
    m = 34
    # header band
    d.rounded_rectangle([ox+m, oy+26, ox+pw-m, oy+108], radius=14, fill=SAGE_D)
    d.rounded_rectangle([ox+m+22, oy+46, ox+m+300, oy+70], radius=10, fill=WHITE)
    d.rounded_rectangle([ox+m+22, oy+78, ox+m+220, oy+94], radius=8, fill=SAGE_L)
    d.rounded_rectangle([ox+pw-m-150, oy+52, ox+pw-m-22, oy+86], radius=16, fill=TERRA)
    y = oy + 132
    if kind == "dash":
        bw = (pw - 2*m - 2*14) / 3
        for i in range(3):
            x = ox + m + i*(bw+14)
            d.rounded_rectangle([x, y, x+bw, y+72], radius=12, outline=SAGE, width=3)
        y += 96
        seg_w = (pw - 2*m - 25*4) / 26
        for r in range(2):
            for i in range(26):
                x = ox + m + i*(seg_w+4)
                f = SAGE_L if (r*26+i) % 2 == 0 else TERRA_L
                d.rectangle([x, y + r*26, x+seg_w, y + r*26 + 20], fill=f, outline=SUB, width=1)
        y += 76
        mw = (pw - 2*m - 3*14) / 4
        for i in range(4):
            x = ox + m + i*(mw+14)
            d.rounded_rectangle([x, y, x+mw, y+88], radius=12, outline=LINE, width=3)
        y += 112
        tw = (pw - 2*m - 14) / 2
        for half in range(2):
            x = ox + m + half*(tw+14)
            d.rectangle([x, y, x+tw, y+30], fill=SAGE)
            for r in range(6):
                d.rectangle([x, y+30+r*26, x+tw, y+30+(r+1)*26], outline=LINE, width=2)
        for i in range(3):
            yy = oy + ph - 130 + i*34
            d.line([ox+m, yy, ox+pw-m, yy], fill=LINE, width=3)
    elif kind == "tracker":
        tw = (pw - 2*m - 14) / 2
        for half in range(2):
            x = ox + m + half*(tw+14)
            d.rectangle([x, y, x+tw, y+30], fill=SAGE)
            for r in range(22):
                yy = y + 30 + r*26
                if yy + 26 > oy + ph - 60:
                    break
                if r % 2 == 1:
                    d.rectangle([x, yy, x+tw, yy+26], fill=(245, 240, 230))
                d.rectangle([x, yy, x+tw, yy+26], outline=LINE, width=2)
                d.rectangle([x+10, yy+7, x+28, yy+25], outline=INK, width=2)
        d.rounded_rectangle([ox+m, oy+ph-52, ox+pw-m, oy+ph-18], radius=12, fill=TERRA)
    elif kind == "budget":
        d.rectangle([ox+m, y, ox+pw-m, y+30], fill=SAGE)
        for r in range(5):
            d.rectangle([ox+m, y+30+r*30, ox+pw-m, y+30+(r+1)*30], outline=LINE, width=2)
        y += 30 + 5*30 + 18
        d.rectangle([ox+m, y, ox+pw-m, y+30], fill=SAGE)
        for r in range(6):
            d.rectangle([ox+m, y+30+r*30, ox+pw-m, y+30+(r+1)*30], outline=LINE, width=2)
        y += 30 + 6*30 + 20
        bw = (pw - 2*m - 2*14) / 3
        for i in range(3):
            x = ox + m + i*(bw+14)
            d.rounded_rectangle([x, y, x+bw, y+64], radius=12, fill=SAGE_L if i else TERRA_L)
    elif kind == "networth":
        tw = (pw - 2*m - 14) / 2
        for half in range(2):
            x = ox + m + half*(tw+14)
            d.rectangle([x, y, x+tw, y+30], fill=SAGE if half == 0 else TERRA)
            for r in range(8):
                d.rectangle([x, y+30+r*30, x+tw, y+30+(r+1)*30], outline=LINE, width=2)
        y += 30 + 8*30 + 20
        d.rounded_rectangle([ox+m, y, ox+pw-m, y+96], radius=14, fill=SAGE_D)
        d.rounded_rectangle([ox+m+60, y+24, ox+pw-m-60, y+44], radius=10, fill=WHITE)
        d.rounded_rectangle([ox+m+120, y+56, ox+pw-m-120, y+78], radius=10, fill=GOLD_L)
    elif kind == "excel":
        d.rectangle([ox+m, y, ox+pw-m, y+44], fill=SAGE_D)
        for r in range(10):
            yy = y + 44 + r*34
            if r == 0:
                d.rectangle([ox+m, yy, ox+pw-m, yy+34], fill=SAGE)
            else:
                d.rectangle([ox+m, yy, ox+pw-m, yy+34], outline=LINE, width=2)
                if r % 2 == 0:
                    d.rectangle([ox+m+300, yy+4, ox+pw-m-30, yy+30], fill=(255, 248, 236))
            for cx in (0.28, 0.55):
                xx = ox + m + (pw-2*m)*cx
                d.line([xx, yy, xx, yy+34], fill=LINE, width=2)
        tab_y = oy + ph - 64
        for i, tw_ in enumerate([120, 150, 120]):
            tx = ox + m + i*160
            d.rounded_rectangle([tx, tab_y, tx+tw_, tab_y+36], radius=8,
                                fill=SAGE_D if i == 0 else WHITE, outline=SAGE_D, width=2)
    return img


def paste_tilt(canvas, page, cx, cy, angle):
    rot = page.rotate(angle, resample=Image.BICUBIC, expand=True)
    canvas.alpha_composite(rot, (int(cx - rot.width/2), int(cy - rot.height/2)))


# ---------------------------------------------------------------- cover
def make_cover():
    img, d = base()
    f_title = font(True, 148)
    f_sub = font(True, 64)
    center(d, 120, "52-WEEK SAVINGS", f_title)
    center(d, 300, "CHALLENGE", f_title, SAGE_D)
    center(d, 500, "Dashboard + Tracker Bundle", f_sub, TERRA_D)
    c = img.convert("RGBA")
    paste_tilt(c, mini_page("dash", 560, 730), W/2 - 560, 1180, -7)
    paste_tilt(c, mini_page("tracker", 600, 780), W/2, 1160, 0)
    paste_tilt(c, mini_page("budget", 560, 730), W/2 + 560, 1180, 7)
    img = c.convert("RGB")
    d = ImageDraw.Draw(img)
    badge_row(d, 1690, ["6 challenges: $1,378 - $20,000", "PDF: Letter / A4 / A5", "Excel auto-calc bonus", "Instant download"], font(True, 38))
    pill(d, W/2, 1810, "Print tonight, save tomorrow  -  start any week of the year", font(True, 44), bg=TERRA)
    img.save(f"{OUT}/cover.jpg", quality=88)


# ---------------------------------------------------------------- dashboard preview
def make_dashboard():
    img, d = base()
    center(d, 90, "START WITH THE DASHBOARD", font(True, 96), SAGE_D)
    center(d, 215, "Your whole year on one page  -  goal, progress, rewards, monthly log", font(False, 46), SUB)
    c = img.convert("RGBA")
    pg = mini_page("dash", 760, 990)
    c.alpha_composite(pg, (150, 330))
    img = c.convert("RGB")
    d = ImageDraw.Draw(img)
    x = 1080
    items = [
        ("Set your goal + dates", "Name what you are saving for and your target."),
        ("Color 52 progress boxes", "One box per week. So satisfying to fill in."),
        ("4 milestone rewards", "Built-in treats at 25 / 50 / 75 / 100%."),
        ("Monthly log built in", "12 lines: what you saved + running total."),
        ("Your WHY + notes", "The reason that keeps you going on week 40."),
    ]
    y = 420
    for t, sub in items:
        d.ellipse([x, y, x+54, y+54], fill=TERRA)
        d.text((x+27, y+27), ">", font=font(True, 34), fill=WHITE, anchor="mm")
        d.text((x+80, y-6), t, font=font(True, 52), fill=INK)
        d.text((x+80, y+62), sub, font=font(False, 42), fill=SUB)
        y += 190
    pill(d, 1780, 1450, "Page 1 of 10  -  print it first", font(True, 44), bg=SAGE_D)
    center(d, 1700, "Laminate it + use dry-erase markers to reuse it every year", font(False, 44), SUB)
    img.save(f"{OUT}/preview-dashboard.jpg", quality=88)


# ---------------------------------------------------------------- tracker preview
def make_tracker():
    img, d = base()
    center(d, 90, "6 TRACKERS  -  PICK YOUR GOAL", font(True, 96), SAGE_D)
    center(d, 215, "Every tracker has pre-filled amounts + running balances. Just check boxes.", font(False, 46), SUB)
    c = img.convert("RGBA")
    pg = mini_page("tracker", 760, 990)
    c.alpha_composite(pg, (150, 330))
    img = c.convert("RGB")
    d = ImageDraw.Draw(img)
    rows = [
        ("CLASSIC $1,378", "Easy start: $1, $2, $3 ... up to $52", SAGE_D),
        ("REVERSE $1,378", "Strong start, easy holidays", SAGE_D),
        ("STEADY $5,000", "Emergency fund / trip / furniture", TERRA_D),
        ("SERIOUS $10,000", "Car / wedding / house deposit", TERRA_D),
        ("FREEDOM $20,000", "House fund / debt payoff", TERRA_D),
        ("BLANK CUSTOM", "Your amounts, your pace, any order", INK),
    ]
    y = 400
    for t, sub, col in rows:
        d.rounded_rectangle([1060, y, 1560, y+88], radius=20, fill=col)
        d.text((1310, y+44), t, font=font(True, 40), fill=WHITE, anchor="mm")
        d.text((1600, y+10), sub, font=font(False, 42), fill=INK)
        y += 150
    pill(d, 1780, 1450, "Any order counts  -  small weeks now, big weeks later", font(True, 42), bg=SAGE_D)
    center(d, 1700, "Columns: check box  |  week  |  amount  |  date paid  |  balance", font(False, 44), SUB)
    img.save(f"{OUT}/preview-tracker.jpg", quality=88)


# ---------------------------------------------------------------- bonus preview
def make_bonus():
    img, d = base()
    center(d, 90, "BONUSES WORTH MORE THAN THE PRICE", font(True, 88), SAGE_D)
    center(d, 210, "Budget snapshot + net worth calculator + auto-calculating Excel dashboard", font(False, 46), SUB)
    c = img.convert("RGBA")
    paste_tilt(c, mini_page("budget", 520, 680), W/2 - 620, 950, -5)
    paste_tilt(c, mini_page("networth", 520, 680), W/2, 940, 0)
    paste_tilt(c, mini_page("excel", 520, 680), W/2 + 620, 950, 5)
    img = c.convert("RGB")
    d = ImageDraw.Draw(img)
    labels = ["Monthly budget snapshot", "Net worth calculator", "Excel + Sheets dashboard"]
    for cx, t in zip([W/2-620, W/2, W/2+620], labels):
        pill(d, cx, 1420, t, font(True, 40), bg=SAGE_D)
    badge_row(d, 1600, ["Pay-yourself-first boxes", "Monthly money moves", "Zero math: Excel sums it all"], font(True, 38))
    center(d, 1780, "Excel file works in Microsoft Excel AND Google Sheets (File > Import)", font(False, 42), SUB)
    img.save(f"{OUT}/preview-bonus.jpg", quality=88)


# ---------------------------------------------------------------- sizes
def make_sizes():
    img, d = base()
    center(d, 90, "PRINTS IN 3 SIZES + INK-SAVER", font(True, 96), SAGE_D)
    center(d, 215, "One purchase, every printer, every binder  -  just open and print", font(False, 46), SUB)
    # to-scale rectangles: Letter 8.5x11, A4 8.27x11.69, A5 5.83x8.27
    items = [
        ("US LETTER", "8.5 x 11 in", WHITE, SAGE_D, 8.5, 11.0),
        ("A4", "210 x 297 mm", WHITE, SAGE_D, 8.27, 11.69),
        ("A5 BINDER", "148 x 210 mm", TERRA_L, TERRA_D, 5.83, 8.27),
        ("INK-SAVER BW", "Letter, less ink", (240, 240, 240), (60, 60, 60), 8.5, 11.0),
    ]
    unit = 70  # px per inch (4 rects must fit 2700px)
    total_w = sum(w*unit for _, _, _, _, w, _ in items) + 60*3
    x = (W - total_w) / 2
    top = 420
    max_h = 11.69 * unit
    for title, sub, fill, ring, wi, hi in items:
        pw, ph = wi*unit, hi*unit
        y0 = top + (max_h - ph)
        d.rounded_rectangle([x+8, y0+10, x+pw+8, y0+ph+10], radius=16, fill=(74, 59, 50, 60))
        d.rounded_rectangle([x, y0, x+pw, y0+ph], radius=16, fill=fill, outline=ring, width=6)
        d.rectangle([x+30, y0+36, x+pw-30, y0+92], fill=ring)
        for r in range(8):
            yy = y0 + 120 + r*54
            if yy + 34 > y0 + ph - 30:
                break
            d.rectangle([x+30, yy, x+pw-30, yy+34], outline=LINE, width=3)
        d.text((x+pw/2, top+max_h+30), title, font=font(True, 52), fill=INK, anchor="ma")
        d.text((x+pw/2, top+max_h+100), sub, font=font(False, 44), fill=SUB, anchor="ma")
        x += pw + 60
    badge_row(d, 1620, ["Actual-size printing", "32 lb paper tip inside", "Cash-stuffing friendly"], font(True, 38))
    center(d, 1780, "Printing guide included: settings, paper, envelopes + binder tips", font(False, 42), SUB)
    img.save(f"{OUT}/sizes.jpg", quality=88)


# ---------------------------------------------------------------- whats included
def make_included():
    img, d = base()
    center(d, 90, "EVERYTHING YOU GET", font(True, 110), SAGE_D)
    center(d, 230, "4 PDFs + Excel bonus  -  instant download, yours forever", font(False, 48), SUB)
    files = [
        ("US-Letter_Full-Color.pdf", "10 pages  -  print at home in the USA", TERRA),
        ("A4_Full-Color.pdf", "10 pages  -  UK, Europe + most of the world", TERRA),
        ("A5-Binder_Full-Color.pdf", "10 pages  -  planners + cash-stuffing binders", TERRA),
        ("Ink-Saver_BW.pdf", "10 pages  -  same bundle, less ink", SAGE),
        ("Bonus_Auto-Calc_Dashboard.xlsx", "Excel + Google Sheets  -  totals update themselves", SAGE_D),
    ]
    y = 380
    for name, desc, col in files:
        d.rounded_rectangle([180, y, 2520, y+200], radius=24, fill=WHITE, outline=LINE, width=3)
        d.rounded_rectangle([230, y+55, 370, y+145], radius=16, fill=col)
        d.text((300, y+100), "PDF" if name.endswith("pdf") else "XLS", font=font(True, 44), fill=WHITE, anchor="mm")
        d.text((410, y+40), name, font=font(True, 52), fill=INK)
        d.text((410, y+115), desc, font=font(False, 44), fill=SUB)
        y += 228
    pill(d, W/2, 1560, "HOW IT WORKS:  Buy  >  Download  >  Print  >  Save $", font(True, 48), bg=SAGE_D)
    center(d, 1720, "This is a DIGITAL download  -  no physical item ships  -  reprint forever", font(False, 44), SUB)
    img.save(f"{OUT}/whats-included.jpg", quality=88)


def main():
    os.makedirs(OUT, exist_ok=True)
    make_cover()
    make_dashboard()
    make_tracker()
    make_bonus()
    make_sizes()
    make_included()
    print("listing images done")


if __name__ == "__main__":
    main()
