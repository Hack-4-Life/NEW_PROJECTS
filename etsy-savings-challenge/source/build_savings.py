#!/usr/bin/env python3
"""Build the 52-Week Savings Challenge Dashboard + Tracker bundle (printable PDFs).

Generates 4 PDFs (Letter / A4 / A5 color + BW ink-saver), each 10 pages:
  1. Dashboard  2. Classic $1,378  3. Reverse $1,378  4. $5K  5. $10K
  6. $20K  7. Blank custom  8. Monthly Budget Snapshot
  9. Net Worth Calculator  10. How to Use + Printing Guide

Handwriting-first design (big boxes, thick lines). No embedded fonts needed.
Run: /home/user/pylibs/bin/python source/build_savings.py
"""
import os
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PDF_DIR = os.path.join(ROOT, "pdf")

LETTER = (612.0, 792.0)
A4 = (595.28, 841.89)
A5 = (419.53, 595.28)

PALETTES = {
    "color": {
        "bg": "#FBF7F0", "ink": "#4A3B32", "sub": "#7A6A5E",
        "sage": "#7D9B7A", "sage_dark": "#5C7A59", "sage_light": "#E4EBE0",
        "terra": "#C67B5C", "terra_dark": "#A55F42", "terra_light": "#F4DCD0",
        "gold": "#C9A96A", "gold_light": "#F1E6CC", "line": "#D8CFC2",
        "white": "#FFFFFF", "band_text": "#FFFFFF", "zebra": "#F5F0E6",
    },
    "bw": {
        "bg": "#FFFFFF", "ink": "#1A1A1A", "sub": "#555555",
        "sage": "#333333", "sage_dark": "#000000", "sage_light": "#E9E9E9",
        "terra": "#555555", "terra_dark": "#222222", "terra_light": "#DDDDDD",
        "gold": "#777777", "gold_light": "#E2E2E2", "line": "#999999",
        "white": "#FFFFFF", "band_text": "#FFFFFF", "zebra": "#F4F4F4",
    },
}

CHALLENGES = [
    {"key": "classic", "title": "CLASSIC CHALLENGE", "total": 1378,
     "amounts": list(range(1, 53)),
     "blurb": "Save $1 in week 1, $2 in week 2 ... up to $52 in week 52. Easy start!"},
    {"key": "reverse", "title": "REVERSE CHALLENGE", "total": 1378,
     "amounts": list(range(52, 0, -1)),
     "blurb": "Start strong at $52 in week 1, count down to $1. Ends easy!"},
    {"key": "5k", "title": "5K CHALLENGE", "total": 5000,
     "amounts": [80]*12 + [90]*12 + [100]*12 + [110]*16,
     "blurb": "Steady steps from $80 to $110 a week. Big goal, calm pace."},
    {"key": "10k", "title": "10K CHALLENGE", "total": 10000,
     "amounts": [160]*12 + [180]*12 + [200]*12 + [220]*16,
     "blurb": "From $160 to $220 a week. For serious savers and big dreams."},
    {"key": "20k", "title": "20K CHALLENGE", "total": 20000,
     "amounts": [320]*12 + [360]*12 + [400]*12 + [440]*16,
     "blurb": "From $320 to $440 a week. House fund, freedom fund, future fund."},
    {"key": "blank", "title": "CUSTOM CHALLENGE (BLANK)", "total": None,
     "amounts": [""]*52,
     "blurb": "Write your own weekly amounts. Any goal, any pace, any order."},
]


def C(h):
    return HexColor(h)


def S(text):
    """Fail fast on glyphs Helvetica cannot print (keeps PDFs clean)."""
    text.encode("cp1252")
    return text


def money(n):
    if n == "" or n is None:
        return ""
    return "$%s" % format(n, ",d")


class Page:
    def __init__(self, c, W, H, P, compact=False):
        self.c, self.W, self.H, self.P = c, W, H, P
        self.compact = compact
        self.m = 28 if compact else 40          # side margin
        self.scale = W / 612.0
        c.setFillColor(C(P["bg"]))
        c.rect(0, 0, W, H, stroke=0, fill=1)

    # ---------- pieces ----------
    def header(self, title, subtitle, badge=None):
        c, W, P, m = self.c, self.W, self.P, self.m
        bh = 44 if self.compact else 60
        y = self.H - (24 if self.compact else 32) - bh
        c.setFillColor(C(P["sage_dark"]))
        c.roundRect(m, y, W - 2*m, bh, 8 if self.compact else 10, stroke=0, fill=1)
        tsize = max(11, 20*self.scale) if not self.compact else max(10, 15*self.scale)
        ssize = max(7, 10.5*self.scale)
        c.setFillColor(C(P["band_text"]))
        c.setFont("Helvetica-Bold", tsize)
        c.drawString(m + 14, y + bh - (22 if self.compact else 28), S(title))
        c.setFont("Helvetica", ssize)
        c.drawString(m + 14, y + (10 if self.compact else 13), S(subtitle))
        if badge:
            bw = c.stringWidth(badge, "Helvetica-Bold", ssize + 1) + 22
            bx = W - m - 12 - bw
            c.setFillColor(C(P["terra"]))
            c.roundRect(bx, y + (bh - 24)/2 if not self.compact else y + (bh - 20)/2,
                        bw, 20 if self.compact else 24, 10, stroke=0, fill=1)
            c.setFillColor(C("#FFFFFF"))
            c.setFont("Helvetica-Bold", ssize + (0 if self.compact else 1))
            c.drawCentredString(bx + bw/2, y + (bh - 20)/2 + 7 if self.compact else y + (bh-24)/2 + 8.5, S(badge))
        return y - (8 if self.compact else 12)

    def footer(self, num=1, total=10):
        c, W, P = self.c, self.W, self.P
        c.setFont("Helvetica", max(6, 7.5*self.scale))
        c.setFillColor(C(P["sub"]))
        c.drawCentredString(W/2, self.m - 14,
            S("52-Week Savings Challenge  -  For personal use only  -  Print at 'Actual size'  -  Page %d of %d" % (num, total)))

    def field(self, x, y, w, label, fsize=None):
        """Label + write-in underline. y = baseline."""
        c, P = self.c, self.P
        fs = fsize or max(7, 9.5*self.scale)
        c.setFont("Helvetica-Bold", fs)
        c.setFillColor(C(P["ink"]))
        c.drawString(x, y, S(label))
        lw = c.stringWidth(label + " ", "Helvetica-Bold", fs)
        c.setStrokeColor(C(P["line"]))
        c.setLineWidth(1)
        c.line(x + lw, y - 2, x + w, y - 2)
        return y

    def section(self, x, y, text):
        c, P = self.c, self.P
        fs = max(7, 10*self.scale)
        c.setFont("Helvetica-Bold", fs)
        c.setFillColor(C(P["sage_dark"]))
        c.drawString(x, y, S(text.upper()))
        tw = c.stringWidth(text.upper(), "Helvetica-Bold", fs)
        c.setStrokeColor(C(P["line"]))
        c.setLineWidth(0.8)
        c.line(x + tw + 8, y + 3, self.W - self.m, y + 3)
        return y - (6 if self.compact else 9)

    def ruled_until(self, x, y, w, y_min, gap=None, label=None):
        """Ruled write-in lines from y down to y_min. Returns y of last line."""
        c, P = self.c, self.P
        gap = gap or (13 if self.compact else 17)
        if label:
            c.setFont("Helvetica-Bold", max(7, 9.5*self.scale))
            c.setFillColor(C(P["ink"]))
            c.drawString(x, y, S(label))
            y -= gap
        c.setStrokeColor(C(P["line"]))
        c.setLineWidth(1)
        while y > y_min:
            c.line(x, y, x + w, y)
            y -= gap
        return y

    def checkbox_row(self, x, y, w, text, fsize=None):
        """Hand checkbox + text on a ruled line. Returns y of line."""
        c, P = self.c, self.P
        fs = fsize or max(7, 9.5*self.scale)
        s = fs + 1
        c.setStrokeColor(C(P["ink"]))
        c.setLineWidth(1.1)
        c.rect(x, y - 2, s, s, stroke=1, fill=0)
        c.setFont("Helvetica", fs)
        c.setFillColor(C(P["ink"]))
        c.drawString(x + s + 6, y, S(text))
        tw = c.stringWidth(text + " ", "Helvetica", fs)
        c.setStrokeColor(C(P["line"]))
        c.setLineWidth(1)
        c.line(x + s + 6 + tw, y - 2, x + w, y - 2)
        return y

    def note_box(self, x, y_bottom, w, h, text, fill="gold_light"):
        c, P = self.c, self.P
        c.setFillColor(C(P[fill]))
        c.setStrokeColor(C(P["line"]))
        c.setLineWidth(0.8)
        c.roundRect(x, y_bottom, w, h, 6, stroke=1, fill=1)
        fs = max(6.5, 8.5*self.scale)
        c.setFillColor(C(P["ink"]))
        c.setFont("Helvetica", fs)
        lines = simpleSplit(S(text), "Helvetica", fs, w - 16)
        ty = y_bottom + h - 8 - fs*0.8
        for ln in lines[:4]:
            c.drawString(x + 8, ty, ln)
            ty -= fs*1.35

    # ---------- generic table ----------
    def table(self, x, y_top, widths, rows, row_h, fsize, header_fill="sage",
              aligns=None, header_text_color="#FFFFFF", zebra=True, box=True):
        """rows[0] is header. Returns y of table bottom."""
        c, P = self.c, self.P
        aligns = aligns or (["c"]*len(widths))
        total_w = sum(widths)
        y = y_top
        # header
        c.setFillColor(C(P[header_fill]))
        if box:
            c.setStrokeColor(C(P["sage_dark"]))
            c.setLineWidth(1)
            c.rect(x, y - row_h, total_w, row_h, stroke=1, fill=1)
        else:
            c.rect(x, y - row_h, total_w, row_h, stroke=0, fill=1)
        c.setFillColor(C(header_text_color))
        c.setFont("Helvetica-Bold", fsize)
        cx = x
        for i, w in enumerate(widths):
            t = rows[0][i]
            if aligns[i] == "l":
                c.drawString(cx + 5, y - row_h + (row_h - fsize)/2 + 1, S(t))
            elif aligns[i] == "r":
                c.drawRightString(cx + w - 5, y - row_h + (row_h - fsize)/2 + 1, S(t))
            else:
                c.drawCentredString(cx + w/2, y - row_h + (row_h - fsize)/2 + 1, S(t))
            cx += w
        y -= row_h
        # body
        c.setStrokeColor(C(P["line"]))
        c.setLineWidth(0.7)
        n = len(rows) - 1
        for r in range(1, len(rows)):
            if zebra and r % 2 == 0:
                c.setFillColor(C(P["zebra"]))
                c.rect(x, y - row_h, total_w, row_h, stroke=0, fill=1)
            # row line + verticals
            c.setStrokeColor(C(P["line"]))
            c.line(x, y - row_h, x + total_w, y - row_h)
            cx = x
            for w in widths[:-1]:
                cx += w
                c.line(cx, y, cx, y - row_h)
            # cells
            cx = x
            for i, w in enumerate(widths):
                t = rows[r][i]
                if t == "[ ]":  # hand checkbox
                    s = min(9*self.scale + 2, row_h - 6)
                    c.setStrokeColor(C(P["ink"]))
                    c.setLineWidth(1)
                    c.rect(cx + w/2 - s/2, y - row_h + (row_h - s)/2, s, s, stroke=1, fill=0)
                else:
                    style = "Helvetica-Bold" if t.startswith("*") else "Helvetica"
                    if t.startswith("*"):
                        t = t[1:]
                    c.setFont(style, fsize)
                    c.setFillColor(C(P["ink"]))
                    by = y - row_h + (row_h - fsize)/2 + 1
                    if aligns[i] == "l":
                        c.drawString(cx + 5, by, S(t))
                    elif aligns[i] == "r":
                        c.drawRightString(cx + w - 5, by, S(t))
                    else:
                        c.drawCentredString(cx + w/2, by, S(t))
                cx += w
            y -= row_h
        if box:
            c.setStrokeColor(C(P["sage_dark"]))
            c.setLineWidth(1)
            c.rect(x, y, total_w, (n+1)*row_h, stroke=1, fill=0)
        return y


# =====================================================================
def draw_dashboard(pg, num, total):
    c, W, P, m = pg.c, pg.W, pg.P, pg.m
    y = pg.header("52-WEEK SAVINGS CHALLENGE", "DASHBOARD  -  Your year of saving at a glance", badge="START HERE")
    # meta fields row
    fw = (W - 2*m - 3*12) / 4
    y -= 16 if pg.compact else 20
    pg.field(m, y, fw, "Saving for: ")
    pg.field(m + (fw+12), y, fw, "Goal: $")
    pg.field(m + 2*(fw+12), y, fw, "Start:")
    pg.field(m + 3*(fw+12), y, fw, "End:")
    y -= 14 if pg.compact else 20
    # stat boxes
    bw = (W - 2*m - 2*10) / 3
    bh = 44 if pg.compact else 64
    labels = ["TOTAL SAVED", "WEEKS DONE  ( / 52)", "PERCENT DONE"]
    for i, lab in enumerate(labels):
        x = m + i*(bw+10)
        c.setFillColor(C(P["white"]))
        c.setStrokeColor(C(P["sage"]))
        c.setLineWidth(1.4)
        c.roundRect(x, y - bh, bw, bh, 7, stroke=1, fill=1)
        c.setFillColor(C(P["sage_dark"]))
        c.setFont("Helvetica-Bold", max(7, 10*pg.scale))
        c.drawCentredString(x + bw/2, y - (14 if pg.compact else 20), S(lab))
        if i == 0:
            c.setFont("Helvetica-Bold", max(10, 16*pg.scale))
            c.setFillColor(C(P["ink"]))
            c.drawCentredString(x + bw/2, y - bh + (8 if pg.compact else 12), S("$"))
        c.setStrokeColor(C(P["line"]))
        c.setLineWidth(1)
        if i == 0:
            c.line(x + bw/2 - 4, y - bh + (6 if pg.compact else 10), x + bw/2 + bw/4, y - bh + (6 if pg.compact else 10))
    y -= bh + (10 if pg.compact else 14)
    # progress coloring bar
    y = pg.section(m, y, "Color your progress  -  one box per week")
    gap = 3
    cols = 26
    seg_w = (W - 2*m - (cols-1)*gap) / cols
    seg_h = 15 if pg.compact else 22
    for row in range(2):
        sy = y - seg_h
        for i in range(cols):
            wk = row*26 + i + 1
            x = m + i*(seg_w+gap)
            fill = P["sage_light"] if wk <= 13 or (27 <= wk <= 39) else P["terra_light"]
            c.setFillColor(C(fill))
            c.setStrokeColor(C(P["sub"]))
            c.setLineWidth(0.6)
            c.roundRect(x, sy, seg_w, seg_h, 2, stroke=1, fill=1)
            if not pg.compact and seg_w > 14:
                c.setFont("Helvetica", 5.5)
                c.setFillColor(C(P["sub"]))
                c.drawCentredString(x + seg_w/2, sy + 6, str(wk))
        y = sy - (4 if pg.compact else 6)
    y -= 4
    # milestones
    y = pg.section(m, y, "Milestone rewards  -  treat yourself")
    mw = (W - 2*m - 3*10) / 4
    mh = 48 if pg.compact else 68
    for i, pct in enumerate(["25%", "50%", "75%", "100%"]):
        x = m + i*(mw+10)
        c.setFillColor(C(P["white"]))
        c.setStrokeColor(C(P["terra"] if i == 3 else P["line"]))
        c.setLineWidth(1.6 if i == 3 else 1)
        c.roundRect(x, y - mh, mw, mh, 7, stroke=1, fill=1)
        c.setFillColor(C(P["terra_dark"] if i == 3 else P["sage_dark"]))
        c.setFont("Helvetica-Bold", max(9, 13*pg.scale))
        c.drawCentredString(x + mw/2, y - (14 if pg.compact else 19), S(pct))
        c.setFont("Helvetica", max(6.5, 8.5*pg.scale))
        c.setFillColor(C(P["ink"]))
        c.drawCentredString(x + mw/2, y - (26 if pg.compact else 35), S("at $ ________"))
        c.drawCentredString(x + mw/2, y - mh + (8 if pg.compact else 12), S("Reward: ______"))
    y -= mh + (10 if pg.compact else 14)
    # monthly log: two mini tables
    y = pg.section(m, y, "Monthly log  -  one line a month")
    months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    tw = (W - 2*m - 12) / 2
    fr = [0.30, 0.35, 0.35]
    widths = [tw*f for f in fr]
    rh = 15 if pg.compact else 21
    fs = max(6.5, 8.5*pg.scale)
    for half in range(2):
        rows = [["MONTH", "SAVED", "RUNNING TOTAL"]]
        for k in range(6):
            rows.append([months[half*6+k], "", ""])
        pg.table(m + half*(tw+12), y, widths, rows, rh, fs, header_fill="sage",
                 aligns=["c", "c", "c"])
    y -= 7*(rh) + (8 if pg.compact else 12)
    # why + notes fill remaining space
    gap = 13 if pg.compact else 17
    c.setFont("Helvetica-Bold", max(7, 9.5*pg.scale))
    c.setFillColor(C(P["ink"]))
    c.drawString(m, y, S("My WHY (why this goal matters):"))
    c.setStrokeColor(C(P["line"]))
    c.setLineWidth(1)
    y -= gap
    c.line(m, y, W - m, y)
    y -= gap
    c.line(m, y, W - m, y)
    y -= gap + 2
    pg.ruled_until(m, y, W - 2*m, m + 12, gap, label="Notes & wins:")
    pg.footer(num=num, total=total)


def draw_tracker(pg, ch, num, total):
    c, W, P, m = pg.c, pg.W, pg.P, pg.m
    badge = ("SAVE " + money(ch["total"])) if ch["total"] else "FILL YOUR OWN"
    y = pg.header(ch["title"], "TRACKER  -  " + ch["blurb"], badge=badge)
    y -= 13 if pg.compact else 17
    c.setFont("Helvetica", max(7, 9*pg.scale))
    c.setFillColor(C(P["sub"]))
    mw = (W - 2*m - 12) / 2
    pg.field(m, y, mw, "Saving for: ", fsize=max(7, 9*pg.scale))
    pg.field(m + mw + 12, y, mw, "Start date: ", fsize=max(7, 9*pg.scale))
    y -= 12 if pg.compact else 16
    # two half tables
    gutter = 12
    tw = (W - 2*m - gutter) / 2
    bottom_reserve = 34 if pg.compact else 46
    avail = y - (m + bottom_reserve)
    rh = avail / 27.0
    fsize = min(max(6, 8.8*pg.scale), rh*0.44)
    fr = [0.11, 0.12, 0.24, 0.26, 0.27]
    widths = [tw*f for f in fr]
    running = 0
    bals = []
    for a in ch["amounts"]:
        if a == "":
            bals.append("")
        else:
            running += a
            bals.append(money(running))
    for half in range(2):
        rows = [["DONE", "WK", "SAVE", "DATE PAID", "BALANCE"]]
        for k in range(26):
            i = half*26 + k
            a = ch["amounts"][i]
            rows.append(["[ ]", str(i+1), money(a) if a != "" else "", "", bals[i]])
        pg.table(m + half*(tw+gutter), y, widths, rows, rh, fsize,
                 header_fill="sage", aligns=["c", "c", "r", "c", "r"])
    yb = y - 27*rh
    # bottom total strip
    strip_h = 20 if pg.compact else 26
    c.setFillColor(C(P["terra"]))
    c.roundRect(m, yb - strip_h - 6, W - 2*m, strip_h, 6, stroke=0, fill=1)
    c.setFillColor(C("#FFFFFF"))
    c.setFont("Helvetica-Bold", max(7.5, 10.5*pg.scale))
    msg = "TOTAL SAVED: $ ____________      Weeks done: ______ / 52" if ch["total"] else \
          "MY GOAL: $ ____________      TOTAL SAVED: $ ____________"
    c.drawCentredString(W/2, yb - strip_h - 6 + (7 if pg.compact else 9), S(msg))
    pg.footer(num=num, total=total)


def draw_budget(pg, num, total):
    c, W, P, m = pg.c, pg.W, pg.P, pg.m
    y = pg.header("MONTHLY BUDGET SNAPSHOT", "BONUS  -  Print one per month  -  Know exactly where it goes")
    y -= 14 if pg.compact else 18
    pg.field(m, y, (W-2*m)/2, "Month: ")
    pg.field(m + (W-2*m)/2 + 12, y, (W-2*m)/2 - 12, "Payday(s): ")
    y -= 12 if pg.compact else 16
    y = pg.section(m, y, "Income")
    tw = W - 2*m
    widths = [tw*0.60, tw*0.20, tw*0.20]
    rh = 15 if pg.compact else 20
    fs = max(7, 9.5*pg.scale)
    rows = [["SOURCE", "PLANNED", "ACTUAL"],
            ["Paycheck 1", "", ""], ["Paycheck 2", "", ""],
            ["Side income", "", ""], ["Other income", "", ""],
            ["*TOTAL INCOME", "", ""]]
    y = pg.table(m, y, widths, rows, rh, fs, header_fill="sage", aligns=["l", "c", "c"]) - (8 if pg.compact else 12)
    y = pg.section(m, y, "Expenses")
    rows = [["CATEGORY", "PLANNED", "ACTUAL"],
            ["Housing / rent", "", ""], ["Utilities + phone", "", ""],
            ["Groceries", "", ""], ["Transport / car", "", ""],
            ["Insurance", "", ""], ["Debt payments", "", ""],
            ["Fun + dining out", "", ""], ["Other", "", ""],
            ["*TOTAL EXPENSES", "", ""]]
    y = pg.table(m, y, widths, rows, rh, fs, header_fill="sage", aligns=["l", "c", "c"]) - (8 if pg.compact else 12)
    # summary boxes
    bw = (W - 2*m - 2*10) / 3
    bh = 34 if pg.compact else 44
    for i, lab in enumerate(["LEFTOVER  (Income - Expenses)", "SAVED THIS MONTH", "RUNNING SAVINGS TOTAL"]):
        x = m + i*(bw+10)
        c.setFillColor(C(P["terra_light"] if i == 0 else P["sage_light"]))
        c.setStrokeColor(C(P["terra"] if i == 0 else P["sage"]))
        c.setLineWidth(1.2)
        c.roundRect(x, y - bh, bw, bh, 7, stroke=1, fill=1)
        c.setFont("Helvetica-Bold", max(6, 7.5*pg.scale))
        c.setFillColor(C(P["ink"]))
        parts = simpleSplit(S(lab), "Helvetica-Bold", max(6, 7.5*pg.scale), bw - 12)
        ty = y - 12
        for ln in parts[:2]:
            c.drawCentredString(x + bw/2, ty, ln)
            ty -= 9
        c.setFont("Helvetica-Bold", max(9, 13*pg.scale))
        c.drawCentredString(x + bw/2, y - bh + 8, S("$"))
    y -= bh + 8
    nb_h = 30 if pg.compact else 34
    pg.ruled_until(m, y, W - 2*m, m + 6 + nb_h + 12, label="Next month focus:")
    pg.note_box(m, m + 6, W - 2*m, nb_h,
        "Tip: move savings FIRST on payday (pay yourself first), then spend what is left. Even $10 counts.")
    pg.footer(num=num, total=total)


def draw_networth(pg, num, total):
    c, W, P, m = pg.c, pg.W, pg.P, pg.m
    y = pg.header("NET WORTH CALCULATOR", "BONUS  -  Assets minus debts  -  Retake monthly and watch it grow")
    y -= 14 if pg.compact else 18
    pg.field(m, y, (W-2*m)/2, "Date: ")
    pg.field(m + (W-2*m)/2 + 12, y, (W-2*m)/2 - 12, "Next check-in: ")
    y -= 12 if pg.compact else 16
    gutter = 12
    tw = (W - 2*m - gutter) / 2
    rh = 16 if pg.compact else 23
    fs = max(6.5, 9*pg.scale)
    y = pg.section(m, y, "What you OWN (assets)  |  What you OWE (debts)")
    widths = [tw*0.64, tw*0.36]
    arows = [["ASSETS", "$"], ["Cash", ""], ["Checking", ""], ["Savings", ""],
             ["Investments", ""], ["Retirement", ""], ["Home / property", ""],
             ["Other assets", ""], ["*TOTAL ASSETS", ""]]
    grows = [["DEBTS", "$"], ["Credit cards", ""], ["Personal loans", ""],
             ["Student loans", ""], ["Car loan", ""], ["Mortgage", ""],
             ["Other debts", ""], ["*TOTAL DEBTS", ""]]
    # pad to equal height
    while len(grows) < len(arows):
        grows.insert(-1, ["", ""])
    pg.table(m, y, widths, arows, rh, fs, header_fill="sage", aligns=["l", "c"])
    pg.table(m + tw + gutter, y, widths, grows, rh, fs, header_fill="terra", aligns=["l", "c"])
    y -= len(arows)*rh + (10 if pg.compact else 14)
    # big result
    bh = 52 if pg.compact else 76
    c.setFillColor(C(P["sage_dark"]))
    c.roundRect(m, y - bh, W - 2*m, bh, 9, stroke=0, fill=1)
    c.setFillColor(C("#FFFFFF"))
    c.setFont("Helvetica-Bold", max(9, 12*pg.scale))
    c.drawCentredString(W/2, y - (18 if pg.compact else 26), S("MY NET WORTH  =  TOTAL ASSETS  -  TOTAL DEBTS"))
    c.setFont("Helvetica-Bold", max(13, 20*pg.scale))
    c.drawCentredString(W/2, y - bh + (10 if pg.compact else 14), S("$  __________________"))
    y -= bh + (10 if pg.compact else 14)
    nb_h = 30 if pg.compact else 34
    y = pg.section(m, y, "Money moves before next check-in") - 2
    gap = 15 if pg.compact else 20
    moves = ["Moved $ __________ to savings on __________",
             "Paid extra $ __________ toward __________ debt",
             "Canceled / cut: ________________________________"]
    if not pg.compact:
        moves.append("Next raise, bonus or windfall goes to: __________")
    for mv in moves:
        if y < m + 6 + nb_h + 16:
            break
        pg.checkbox_row(m, y, W - 2*m, mv)
        y -= gap
    pg.note_box(m, m + 6, W - 2*m, nb_h,
        "Tip: a rising net worth matters more than income alone. Track it on the 1st of each month.")
    pg.footer(num=num, total=total)


def draw_howto(pg, num, total):
    c, W, P, m = pg.c, pg.W, pg.P, pg.m
    y = pg.header("HOW TO USE + PRINTING GUIDE", "Read this once  -  then print and save all year")
    y -= 12 if pg.compact else 16
    fs = max(7, 9.5*pg.scale)
    steps = [
        ("1", "Pick ONE challenge", "Classic $1,378 if money is tight, $5K/$10K for a solid goal, $20K for a house or freedom fund, Blank to invent your own. You can switch any time."),
        ("2", "Print your pages", "Dashboard + your challenge tracker + (optional) budget and net worth sheets. US Letter, A4 and A5 binder sizes are included."),
        ("3", "Fill the Dashboard first", "Write your goal, dates and WHY, then set a small reward for each 25% milestone. Goals with rewards get finished."),
        ("4", "Save weekly, any order", "Tight week? Do a small week now and a big week later. Color a box on the Dashboard every time you save."),
        ("5", "Check in monthly", "Log the month on your Dashboard, retake your net worth, and move leftover budget money straight to savings."),
    ]
    for n, title, body in steps:
        # number circle
        r = 9 if pg.compact else 11
        cy = y - 4
        c.setFillColor(C(P["terra"]))
        c.circle(m + r, cy, r, stroke=0, fill=1)
        c.setFillColor(C("#FFFFFF"))
        c.setFont("Helvetica-Bold", max(8, 11*pg.scale))
        c.drawCentredString(m + r, cy - 4, n)
        tx = m + 2*r + 8
        c.setFillColor(C(P["ink"]))
        c.setFont("Helvetica-Bold", fs + 0.5)
        c.drawString(tx, y, S(title))
        y -= fs*1.5
        c.setFont("Helvetica", fs)
        c.setFillColor(C(P["sub"]))
        for ln in simpleSplit(S(body), "Helvetica", fs, W - m - tx):
            c.drawString(tx, y, ln)
            y -= fs*1.4
        y -= 6 if pg.compact else 9
    y = pg.section(m, y - 2, "Pick-your-challenge cheat sheet") - 2
    tw = W - 2*m
    widths = [tw*0.32, tw*0.20, tw*0.48]
    rows = [["CHALLENGE", "TOTAL", "BEST FOR"],
            ["Classic (easy start)", "$1,378", "Beginners, students, tight budgets"],
            ["Reverse (strong start)", "$1,378", "Big motivation now, easy holidays"],
            ["Steady 5K", "$5,000", "Emergency fund, trip, furniture"],
            ["Serious 10K", "$10,000", "Car, wedding, house deposit start"],
            ["Freedom 20K", "$20,000", "House fund, debt payoff, investing"],
            ["Blank custom", "You set", "Any goal, irregular income"]]
    rh = 14 if pg.compact else 17
    y = pg.table(m, y, widths, rows, rh, max(6.5, 8.5*pg.scale), header_fill="sage",
                 aligns=["l", "c", "l"]) - (8 if pg.compact else 12)
    y = pg.section(m, y, "Printing tips") - 2
    tips = [
        "Printer setting: 'Actual size' (not 'Fit') so boxes stay true to size. A5 prints from the A5 file, or print Letter at 70% and trim.",
        "Paper: any printer paper works. For binders that get daily love, use 32 lb / 120 gsm or cardstock.",
        "Cash stuffing: pair each tracker with a labeled envelope or A5 pouch. Laminate the Dashboard and use dry-erase markers to reuse it yearly.",
    ]
    c.setFont("Helvetica", fs)
    c.setFillColor(C(P["sub"]))
    for t in tips:
        c.setFillColor(C(P["terra"]))
        c.drawString(m, y, S("-"))
        c.setFillColor(C(P["sub"]))
        for ln in simpleSplit(S(t), "Helvetica", fs, W - 2*m - 14):
            c.drawString(m + 12, y, ln)
            y -= fs*1.4
        y -= 3
    nb_h = 30 if pg.compact else 32
    pg.note_box(m, m + 10 + nb_h, W - 2*m, nb_h,
        "Love this bundle? A 5-star review helps this small shop more than you know. Thank you!",
        fill="sage_light")
    pg.note_box(m, m + 6, W - 2*m, nb_h,
        "License: for YOUR personal use only. Please do not share, resell or post these files. Thank you for supporting a small shop!")
    pg.footer(num=num, total=total)


# =====================================================================
def build_one(path, size, palette, title_suffix):
    W, H = size
    compact = (size == A5)
    P = PALETTES[palette]
    c = canvas.Canvas(path, pagesize=(W, H))
    c.setTitle("52-Week Savings Challenge " + title_suffix)
    c.setAuthor("Etsy Digital Download")
    c.setSubject("Savings challenge dashboard and tracker bundle")
    total = 10
    jobs = [("dash", None)] + [("track", ch) for ch in CHALLENGES] + \
           [("budget", None), ("net", None), ("how", None)]
    for i, (kind, payload) in enumerate(jobs, start=1):
        pg = Page(c, W, H, P, compact=compact)
        if kind == "dash":
            draw_dashboard(pg, i, total)
        elif kind == "track":
            draw_tracker(pg, payload, i, total)
        elif kind == "budget":
            draw_budget(pg, i, total)
        elif kind == "net":
            draw_networth(pg, i, total)
        else:
            draw_howto(pg, i, total)
        c.showPage()
    c.save()
    print("wrote", path, os.path.getsize(path), "bytes")


def main():
    os.makedirs(PDF_DIR, exist_ok=True)
    build_one(os.path.join(PDF_DIR, "US-Letter_Full-Color.pdf"), LETTER, "color", "(US Letter, Full Color)")
    build_one(os.path.join(PDF_DIR, "A4_Full-Color.pdf"), A4, "color", "(A4, Full Color)")
    build_one(os.path.join(PDF_DIR, "A5-Binder_Full-Color.pdf"), A5, "color", "(A5 Binder, Full Color)")
    build_one(os.path.join(PDF_DIR, "Ink-Saver_BW_US-Letter.pdf"), LETTER, "bw", "(US Letter, Ink Saver)")


if __name__ == "__main__":
    main()
