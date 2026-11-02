"""Build the playable demo as a Claude artifact ("Tennis101 Demo"), so it opens inside the Claude app beside HQ.

    python3 -I tools/build_demo_artifact.py

Writes build/demo/index.html (the game page, without the doctype/charset/viewport lines the artifact adds itself,
script paths without the ?v= cache keys) and copies the game's scripts to build/demo/src/. Links that only exist on
the website (How it was built, Agent Control Room) point to the GitHub Pages site. Then publish build/demo/index.html
with the files listed in build/demo/files.json (Claude does this after every release).
"""
import json, os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build/demo")
SITE = "https://ryanli0819.github.io/Tennis101/"

html = open(os.path.join(ROOT, "index.html")).read()
html = re.sub(r'^<!doctype html>\n<meta charset="utf-8">\n<meta name="viewport"[^>]*>\n', "", html, flags=re.I)
scripts = re.findall(r'<script src="(src/[^"?]+)(?:\?v=[^"]*)?"></script>', html)
html = re.sub(r'(<script src="src/[^"?]+)\?v=[^"]*"', r'\1"', html)
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, "index.html"), "w").write(html)
files = {}
for s in scripts:
    dst = os.path.join(OUT, s); os.makedirs(os.path.dirname(dst), exist_ok=True)
    src = open(os.path.join(ROOT, s)).read()
    src = src.replace('href="presentation/"', f'href="{SITE}presentation/" target="_blank" rel="noopener"')
    src = src.replace('href="agents/dashboard.html"', f'href="{SITE}agents/dashboard.html" target="_blank" rel="noopener"')
    open(dst, "w").write(src)
    files[s] = os.path.relpath(dst, ROOT)
json.dump(files, open(os.path.join(OUT, "files.json"), "w"), indent=1)
print(f"build/demo/index.html + {len(files)} scripts")
