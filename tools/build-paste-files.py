#!/usr/bin/env python3
"""Generate framer-paste/CUScrollAnimation.txt from the component source.

The source keeps AnnouncementBarView exported so the local preview pages can
render the bar in isolation. Framer lists every exported component, so that
keyword is stripped here — otherwise the assets panel shows a second,
control-less entry beside the real component.

Run after editing CUScrollAnimation.tsx:

    python3 tools/build-paste-files.py
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "CUScrollAnimation.tsx"
OUT = ROOT / "framer-paste" / "CUScrollAnimation.txt"

BANNER = """// ─────────────────────────────────────────────────────────────────────────
// CU Scroll Animation + Announcement Bar
//
// Paste this whole file into a new Framer code component.
// Self-contained — one component, no imports to resolve, nothing else to add.
// ─────────────────────────────────────────────────────────────────────────

"""

src = SRC.read_text()

VIEW = "export const AnnouncementBarView = forwardRef<"
if VIEW not in src:
    sys.exit(f"build-paste-files: {VIEW!r} not found in {SRC.name}")
out = BANNER + src.replace(VIEW, VIEW[len("export ") :], 1)

# Framer renders whatever the file exports; anything but the one default
# export would show up as an extra component in the assets panel.
exports = re.findall(r"^export (?!interface |type )(.*)$", out, re.M)
unexpected = [e for e in exports if not e.startswith("default function CUScrollAnimation")]
if unexpected:
    sys.exit(
        "build-paste-files: these would appear as extra Framer components:\n  "
        + "\n  ".join(unexpected)
    )

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(out)
print(f"{OUT.relative_to(ROOT)}  {len(out.splitlines())} lines")
