#!/usr/bin/env python3
"""Generate the paste-ready .txt files under framer-paste/.

Framer's code editor takes one file per component and has no notion of the
relative import CUScrollAnimation.tsx uses, so this merges the two sources
into a single self-contained file. Run it after editing either component:

    python3 tools/build-paste-files.py

Outputs:
  framer-paste/AnnouncementBar.txt    the bar on its own
  framer-paste/CUScrollAnimation.txt  bar + scroll animation, no imports
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "framer-paste"

BAR = (ROOT / "AnnouncementBar.tsx").read_text()
SCROLL = (ROOT / "CUScrollAnimation.tsx").read_text()

MERGED_HEADER = '''import { addPropertyControls, ControlType } from "framer"
import {
    forwardRef,
    useCallback,
    useEffect,
    useId,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
} from "react"
'''

BANNER = """// ─────────────────────────────────────────────────────────────────────────
// {title}
//
// Paste this whole file into a new Framer code component.
// {note}
// ─────────────────────────────────────────────────────────────────────────

"""


def need(marker: str, text: str, label: str) -> None:
    if marker not in text:
        sys.exit(f"build-paste-files: marker not found in {label}:\n{marker!r}")


def strip_imports(src: str, label: str) -> str:
    """Drop the leading import block, keeping the file's comment header."""
    # Everything from the first import to the last one at the top of the file.
    m = re.search(r'^import [\s\S]*?from "(?:react|\./AnnouncementBar)"\n',
                  src, re.M)
    if not m:
        sys.exit(f"build-paste-files: no import block in {label}")
    end = m.end()
    # Consume any further consecutive import statements.
    while True:
        nxt = re.match(r'import [\s\S]*?from "[^"]+"\n', src[end:])
        if not nxt:
            break
        end += nxt.end()
    return src[:m.start()] + src[end:]


# ── 1. The bar on its own ──
# AnnouncementBarView stays internal: exported, Framer would list it as a
# second component with no property controls.
need("export const AnnouncementBarView = forwardRef<", BAR, "AnnouncementBar.tsx")
bar_solo = BANNER.format(
    title="CU Announcement Bar — standalone Framer component",
    note="Nothing else is required; it has no imports beyond framer and react.",
) + BAR.replace(
    "export const AnnouncementBarView = forwardRef<",
    "const AnnouncementBarView = forwardRef<",
)

# ── 2. Merged: bar folded into the scroll animation, no relative import ──
default_export_block = """/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 684
 * @framerIntrinsicHeight 53
 */
export default function AnnouncementBar(props: AnnouncementBarProps) {
    return <AnnouncementBarView {...props} />
}

"""
tail_call = "addPropertyControls(AnnouncementBar, announcementBarControls)\n"

need(default_export_block, BAR, "AnnouncementBar.tsx")
need(tail_call, BAR, "AnnouncementBar.tsx")

bar_inner = BAR.replace(default_export_block, "").replace(tail_call, "")
bar_inner = strip_imports(bar_inner, "AnnouncementBar.tsx")
# Keep every bar declaration internal so Framer lists only CUScrollAnimation.
bar_inner = re.sub(r"^export (const|interface|function) ", r"\1 ",
                   bar_inner, flags=re.M)

if re.search(r"^export ", bar_inner, re.M):
    sys.exit("build-paste-files: an export survived in the merged bar section")

scroll_inner = strip_imports(SCROLL, "CUScrollAnimation.tsx")


def top_level_names(src: str) -> dict:
    """Map top-level declaration name -> its first line, for collision checks."""
    out = {}
    for m in re.finditer(
        r"^(?:const|let|var|function|interface|type|class)\s+(\w+)", src, re.M
    ):
        out.setdefault(m.group(1), m.group(0))
    return out


# Both sources define the same one-line clamp; keep the bar's and drop the
# duplicate, or the merged file fails to parse on a redeclared binding.
CLAMP = ("const clamp = (v: number, min = 0, max = 1) => "
         "Math.max(min, Math.min(max, v))\n")
need(CLAMP, bar_inner, "AnnouncementBar.tsx")
need(CLAMP, scroll_inner, "CUScrollAnimation.tsx")
scroll_inner = scroll_inner.replace(CLAMP, "", 1)

clashes = sorted(set(top_level_names(bar_inner)) & set(top_level_names(scroll_inner)))
if clashes:
    sys.exit(
        "build-paste-files: the two components both declare "
        + ", ".join(clashes)
        + " at top level. Rename one side, or de-duplicate it here the way "
          "clamp is handled above."
    )

merged = (
    BANNER.format(
        title="CU Scroll Animation + Announcement Bar — single file",
        note="Self-contained: the announcement bar is folded in, so there is "
             "no second\n// file to create and no import to resolve.",
    )
    + MERGED_HEADER
    + "\n// ══ Announcement bar ══════════════════════════════════════════════════\n"
    + bar_inner.rstrip()
    + "\n\n// ══ Scroll animation ══════════════════════════════════════════════════\n"
    + scroll_inner.lstrip("\n")
)

OUT.mkdir(exist_ok=True)
(OUT / "AnnouncementBar.txt").write_text(bar_solo)
(OUT / "CUScrollAnimation.txt").write_text(merged)

for f in sorted(OUT.glob("*.txt")):
    print(f"{f.relative_to(ROOT)}  {len(f.read_text().splitlines())} lines")
