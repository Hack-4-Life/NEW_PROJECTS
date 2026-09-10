#!/usr/bin/env python3
"""Bonus auto-calculating workbook: Dashboard + 6 trackers (Excel + Google Sheets ready).
Run: /home/user/pylibs/bin/python source/build_excel.py  (needs openpyxl)
"""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

HERE = os.path.dirname(os.path.abspath(__file__))
XLSX = os.path.join(os.path.dirname(HERE), "pdf", "Bonus_Auto-Calc_Dashboard.xlsx")

SAGE = "5C7A59"; SAGE_L = "E4EBE0"; TERRA = "C67B5C"; TERRA_L = "F4DCD0"
INK = "4A3B32"; GOLD = "C9A96A"; LINE = "D8CFC2"
HDR = PatternFill("solid", fgColor=SAGE)
HDR2 = PatternFill("solid", fgColor=TERRA)
BAND = PatternFill("solid", fgColor=SAGE_L)
BAND2 = PatternFill("solid", fgColor=TERRA_L)
WHITE = PatternFill("solid", fgColor="FFFFFF")
BOLD = Font(bold=True, color="FFFFFF", size=11)
BOLD_D = Font(bold=True, color=INK, size=11)
BIG = Font(bold=True, color=INK, size=14)
THIN = Side(style="thin", color=LINE)
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center")

CHALLENGES = [
    ("Classic-1378", list(range(1, 53)), 1378),
    ("Reverse-1378", list(range(52, 0, -1)), 1378),
    ("Challenge-5K", [80]*12 + [90]*12 + [100]*12 + [110]*16, 5000),
    ("Challenge-10K", [160]*12 + [180]*12 + [200]*12 + [220]*16, 10000),
    ("Challenge-20K", [320]*12 + [360]*12 + [400]*12 + [440]*16, 20000),
    ("Blank-Custom", [""]*52, 0),
]
SHEETS = [c[0] for c in CHALLENGES]


def style_header(ws, row, cols, fill=HDR):
    for col in range(1, cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = fill; cell.font = BOLD; cell.alignment = CENTER; cell.border = BORDER


def tracker_sheet(wb, name, amounts, target):
    ws = wb.create_sheet(name)
    ws.sheet_view.showGridLines = False
    ws.freeze_panes = "A2"
    headers = ["Week", "Planned ($)", "Date paid", "Saved ($)"]
    widths = [10, 14, 14, 14]
    for i, (h, w) in enumerate(zip(headers, widths), start=1):
        ws.cell(row=1, column=i, value=h)
        ws.column_dimensions[get_column_letter(i)].width = w
    style_header(ws, 1, 4)
    dv = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1=0,
                        errorTitle="Numbers only", error="Enter the amount you saved, e.g. 52")
    ws.add_data_validation(dv)
    for r in range(52):
        row = r + 2
        ws.cell(row=row, column=1, value=r + 1).alignment = CENTER
        planned = ws.cell(row=row, column=2, value=amounts[r])
        planned.number_format = '#,##0'
        planned.alignment = CENTER
        ws.cell(row=row, column=3).number_format = 'MM/DD/YYYY'
        ws.cell(row=row, column=3).alignment = CENTER
        saved = ws.cell(row=row, column=4)
        saved.number_format = '#,##0.00'
        saved.alignment = CENTER
        saved.fill = PatternFill("solid", fgColor="FFF8EC")
        dv.add(saved)
        for col in range(1, 5):
            ws.cell(row=row, column=col).border = BORDER
            ws.cell(row=row, column=col).font = Font(color=INK, size=11)
        if r % 2 == 1:
            for col in (1, 2, 3):
                ws.cell(row=row, column=col).fill = PatternFill("solid", fgColor="F5F0E6")
    tr = 54
    labels = [("TOTAL SAVED", "=SUM(D2:D53)"), ("GOAL", target if target else "enter below"),
              ("REMAINING", "=B55-B54" if False else None), ("WEEKS DONE", '=COUNT(D2:D53) & " / 52"')]
    ws.cell(row=tr, column=1, value="TOTAL SAVED").font = BOLD_D
    tot = ws.cell(row=tr, column=4, value="=SUM(D2:D53)")
    tot.number_format = '"$"#,##0.00'; tot.font = BIG
    ws.cell(row=tr+1, column=1, value="GOAL").font = BOLD_D
    goal = ws.cell(row=tr+1, column=4, value=target if target else "")
    goal.number_format = '"$"#,##0'; goal.font = BOLD_D
    goal.fill = BAND2 if not target else WHITE
    ws.cell(row=tr+2, column=1, value="REMAINING").font = BOLD_D
    rem = ws.cell(row=tr+2, column=4, value="=D55-D54")
    rem.number_format = '"$"#,##0.00'; rem.font = BOLD_D
    ws.cell(row=tr+3, column=1, value="WEEKS LOGGED").font = BOLD_D
    ws.cell(row=tr+3, column=4, value='=COUNT(D2:D53)&" / 52"').font = BOLD_D
    for rr in range(tr, tr+4):
        for col in range(1, 5):
            ws.cell(row=rr, column=col).border = BORDER
        ws.cell(row=rr, column=1).fill = BAND
    ws.cell(row=tr+4, column=1, value="Tip: type what you saved in column D. Totals update by themselves.").font = Font(italic=True, color="7A6A5E", size=10)
    return ws


def dashboard(wb):
    ws = wb.active
    ws.title = "Dashboard"
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 22
    ws.column_dimensions["B"].width = 26
    ws.column_dimensions["C"].width = 22
    ws.column_dimensions["D"].width = 26
    ws.merge_cells("A1:D1")
    t = ws["A1"]; t.value = "52-WEEK SAVINGS DASHBOARD"; t.font = Font(bold=True, color="FFFFFF", size=16)
    t.fill = PatternFill("solid", fgColor=SAGE); t.alignment = CENTER
    ws.row_dimensions[1].height = 30
    ws["A2"] = "Saving for:"; ws["B2"] = "(type your goal, e.g. Emergency fund)"
    ws["A3"] = "Start date:"; ws["C3"] = "Target date:"
    for cell in ("B2", "B3", "D3"):
        ws[cell].fill = PatternFill("solid", fgColor="FFF8EC")
        ws[cell].border = BORDER
    for cell in ("A2", "A3", "C3"):
        ws[cell].font = BOLD_D
    ws["B3"].number_format = 'MM/DD/YYYY'; ws["D3"].number_format = 'MM/DD/YYYY'
    ws["A5"] = "Challenge (click a tab below to log savings)"
    ws["A5"].font = BOLD_D
    for i, h in enumerate(["Challenge", "Saved so far", "Goal", "Left to go"], start=1):
        ws.cell(row=6, column=i, value=h)
    style_header(ws, 6, 4)
    targets = {"Classic-1378": 1378, "Reverse-1378": 1378, "Challenge-5K": 5000,
               "Challenge-10K": 10000, "Challenge-20K": 20000}
    r = 7
    for name in SHEETS:
        ws.cell(row=r, column=1, value=name.replace("-", " ")).font = Font(color=INK, size=11)
        f = ws.cell(row=r, column=2, value="='%s'!D54" % name)
        f.number_format = '"$"#,##0.00'
        g = ws.cell(row=r, column=3, value="='%s'!D55" % name)
        g.number_format = '"$"#,##0'
        left = ws.cell(row=r, column=4, value="=C%d-B%d" % (r, r))
        left.number_format = '"$"#,##0.00'
        for col in range(1, 5):
            ws.cell(row=r, column=col).border = BORDER
            ws.cell(row=r, column=col).alignment = CENTER
        if r % 2 == 0:
            for col in range(1, 5):
                ws.cell(row=r, column=col).fill = PatternFill("solid", fgColor="F5F0E6")
        r += 1
    ws["A14"] = "How to use:"; ws["A14"].font = BOLD_D
    tips = ["1. Pick ONE challenge tab below and log savings in its column D.",
            "2. This dashboard totals every tab automatically - no math needed.",
            "3. Works in Excel and Google Sheets (File > Import > Upload)."]
    for i, tip in enumerate(tips, start=15):
        ws.cell(row=i, column=1, value=tip).font = Font(color="7A6A5E", size=10)
        ws.merge_cells("A%d:D%d" % (i, i))


def main():
    wb = Workbook()
    dashboard(wb)
    for name, amounts, target in CHALLENGES:
        tracker_sheet(wb, name, amounts, target)
    wb.save(XLSX)
    print("wrote", XLSX, os.path.getsize(XLSX), "bytes")


if __name__ == "__main__":
    main()
