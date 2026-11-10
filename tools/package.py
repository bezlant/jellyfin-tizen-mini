#!/usr/bin/env python3
"""Package only the app assets. Signing and installation happen separately."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
assets = ("index.html", "style.css", "app.js", "core.js", "config.xml", "logo.svg", "icon.png")
output = root / "dist" / "Movies.unsigned.wgt"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", compression=ZIP_DEFLATED) as package:
    for name in assets:
        package.write(root / name, name)
print("Created dist/Movies.unsigned.wgt — sign with your own Tizen certificate before installation.")
