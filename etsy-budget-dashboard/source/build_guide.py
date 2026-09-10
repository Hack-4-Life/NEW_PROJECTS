#!/usr/bin/env python3
"""Quick-Start Guide PDF for TrueSpend buyers (reportlab, US Letter)."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "pdf", "Quick-Start-Guide.pdf")

BG = HexColor("#0d1017"); CARD = HexColor("#171e2c"); GOLD = HexColor("#d8b45a")
GOLD_L = HexColor("#f0d488"); INK = HexColor("#f3eede"); SUB = HexColor("#9aa3b5")
GREEN = HexColor("#4ade80"); LINE = HexColor("#2a3347")

def header(c, title, sub):
    c.setFillColor(BG); c.rect(0, 0, 612, 792, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, 778, 612, 14, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, 0, 612, 14, fill=1, stroke=0)
    c.setFillColor(GOLD_L); c.setFont("Helvetica-Bold", 30)
    c.drawCentredString(306, 720, title)
    c.setFillColor(SUB); c.setFont("Helvetica", 13)
    c.drawCentredString(306, 696, sub)

def card(c, y, h, title, lines):
    c.setFillColor(CARD); c.setStrokeColor(LINE); c.setLineWidth(1.5)
    c.roundRect(48, y - h, 516, h, 14, fill=1, stroke=1)
    c.setFillColor(GOLD_L); c.setFont("Helvetica-Bold", 14)
    c.drawString(72, y - 32, title)
    c.setFont("Helvetica", 11.5); ty = y - 56
    for ln in lines:
        bold = ln.startswith("**")
        if bold: ln = ln[2:]
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 11.5)
        c.setFillColor(INK if bold else SUB)
        # simple wrap at ~82 chars
        while len(ln) > 82:
            cut = ln[:82].rfind(" "); cut = cut if cut > 0 else 82
            c.drawString(72, ty, ln[:cut]); ty -= 17; ln = ln[cut:].lstrip()
        c.drawString(72, ty, ln); ty -= 17
    return y - h - 18

def build():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    c = canvas.Canvas(OUT, pagesize=letter)
    # ---- page 1: setup
    header(c, "TRUESPEND  -  Quick Start", "Budget Command Center  -  60-second setup, then you're budgeting")
    y = 660
    y = card(c, y, 150, "1. OPEN THE APP (no install, no account)",
        ["**Double-click TrueSpend-Dashboard.html - it opens in any browser.",
         "Works on iPhone, Android, tablet, Mac & Windows. No internet needed.",
         "Tip: keep the file somewhere safe (Documents folder, iCloud, Drive)."])
    y = card(c, y, 168, "2. MAKE IT FEEL LIKE AN APP (optional, 20 seconds)",
        ["**iPhone: Share button > Add to Home Screen. Opens full-screen.",
         "**Android: browser menu > Add to Home screen / Install.",
         "**Computer: bookmark it, or drag the file to your bookmarks bar."])
    y = card(c, y, 210, "3. RUN THE 60-SECOND SETUP WIZARD",
        ["**Step 1: your name + currency ($, euro, pound, yen, rupee, kr...).",
         "**Step 2: pay frequency, next payday, paycheck + checking balance.",
         "**Step 3: pick one of 6 themes. Done - your safe-to-spend appears.",
         "A demo budget is preloaded so you can explore first. Start fresh",
         "anytime: Settings > Start fresh."])
    c.setFillColor(GREEN); c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(306, 40, "Your data never leaves your device. No accounts. No uploads. Ever.")
    c.showPage()
    # ---- page 2: daily use + FAQ
    header(c, "DAILY USE  +  FAQ", "Three habits. Two minutes a day. Total control.")
    y = 660
    y = card(c, y, 168, "YOUR 2-MINUTE DAILY HABIT",
        ["**Morning: glance at Today - safe-to-spend + bills due soon.",
         "**Buying: Log it in 2 taps (Spend > Quick add). Takes 5 seconds.",
         "**Tempted? Open What-If, drag the slider, get a Go / Tight / Skip.",
         "Weekly: mark bills paid, nudge goals forward. That's everything."])
    y = card(c, y, 210, "POWER FEATURES YOU'LL LOVE",
        ["**45-day forecast: see your low point before it happens.",
         "**Debt simulator: snowball vs avalanche, extra-payment slider.",
         "**Privacy blur + Simple mode: glance-proof in public.",
         "**Backup: Settings > Backup downloads your data (JSON).",
         "Restore it on any device. Export transactions to CSV anytime."])
    y = card(c, y, 150, "FAQ",
        ["**Is my money info safe? Yes - it's stored only in your browser.",
         "**New phone? Backup on the old one, open the file, Restore.",
         "**Something looks off? Settings > Reload demo to compare, or",
         "message me on Etsy - I answer fast and fix things free."])
    c.setFillColor(GOLD_L); c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(306, 60, "You bought it once. It's yours forever. Happy budgeting!")
    c.showPage(); c.save()
    print("guide done:", OUT)

if __name__ == "__main__":
    build()
