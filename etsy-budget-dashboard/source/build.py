#!/usr/bin/env python3
"""Inline template + styles + JS parts into the single-file Etsy product."""
import os, re
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
tpl = open(os.path.join(HERE, "template.html")).read()
css = open(os.path.join(HERE, "styles.css")).read()
js = "\n".join(open(os.path.join(HERE, f"part{i}.js")).read() for i in (1, 2, 3, 4))
out = tpl.replace("/*__STYLES__*/", css).replace("/*__APPJS__*/", js)
# sanity: no placeholders left
assert "__STYLES__" not in out and "__APPJS__" not in out, "placeholder left!"
os.makedirs(os.path.join(ROOT, "product"), exist_ok=True)
p = os.path.join(ROOT, "product", "TrueSpend-Dashboard.html")
open(p, "w").write(out)
print(f"built {p} ({len(out)/1024:.0f} KB)")
