#!/usr/bin/env python3
"""Minimal dependency-free JPEG -> single-page PDF writer.

Usage: make_pdf.py <input.jpg> <output.pdf> <page_w_pt> <page_h_pt> <img_w_px> <img_h_px>
Embeds the JPEG directly (PDF DCTDecode), so no extra libraries are needed.
"""
import sys


def make_pdf(jpg_path, pdf_path, page_w, page_h, img_w, img_h):
    with open(jpg_path, "rb") as f:
        jpg = f.read()

    buf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = {}

    def obj(n, body):
        offsets[n] = len(buf)
        buf.extend(b"%d 0 obj\n" % n)
        buf.extend(body)
        buf.extend(b"\nendobj\n")

    obj(1, b"<< /Type /Catalog /Pages 2 0 R >>")
    obj(2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    obj(
        3,
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] "
        b"/Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> "
        b"/Contents 5 0 R >>" % (page_w, page_h),
    )
    obj(
        4,
        b"<< /Type /XObject /Subtype /Image /Width %d /Height %d "
        b"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode "
        b"/Length %d >>\nstream\n" % (img_w, img_h, len(jpg))
        + jpg
        + b"\nendstream",
    )
    content = b"q %d 0 0 %d 0 0 cm /Im0 Do Q\n" % (page_w, page_h)
    obj(5, b"<< /Length %d >>\nstream\n" % len(content) + content + b"endstream")

    xref_pos = len(buf)
    n = len(offsets) + 1
    buf.extend(b"xref\n0 %d\n" % n)
    buf.extend(b"0000000000 65535 f \n")
    for i in range(1, n):
        buf.extend(b"%010d 00000 n \n" % offsets[i])
    buf.extend(
        b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"
        % (n, xref_pos)
    )

    with open(pdf_path, "wb") as f:
        f.write(buf)


if __name__ == "__main__":
    jpg_path, pdf_path = sys.argv[1], sys.argv[2]
    page_w, page_h = int(sys.argv[3]), int(sys.argv[4])
    img_w, img_h = int(sys.argv[5]), int(sys.argv[6])
    make_pdf(jpg_path, pdf_path, page_w, page_h, img_w, img_h)
    print("wrote", pdf_path)
