#!/usr/bin/env python3
"""Writes icon_themes/lobster.json: Zed's default icon theme plus an icon for .lobster files.

Zed takes the file name and extension to icon associations from the selected icon theme only
(the icons themselves, folders and chevrons fall back to the default theme), so the theme
copies the default theme's associations. Rerun this when Zed adds some:

    python3 scripts/update_icon_theme.py [path/to/zed/crates/theme/src/icon_theme.rs]

Without a path it reads the file from Zed's main branch on GitHub.
"""

import json
import pathlib
import re
import sys
import urllib.request

SOURCE = ("https://raw.githubusercontent.com/zed-industries/zed/main/"
          "crates/theme/src/icon_theme.rs")
ROOT = pathlib.Path(__file__).resolve().parent.parent


def associations(source, const):
    """The (icon key, [names]) table named `const`, as a name to icon key map."""
    body = re.search(const + r": &\[\(&str, &\[&str\]\)\] = &\[(.*?)\n\];", source, re.S)
    result = {}
    for key, names in re.findall(r'\(\s*"([^"]+)",\s*&\[(.*?)\]\s*,?\s*\)', body.group(1), re.S):
        for name in re.findall(r'"([^"]+)"', names):
            result[name] = key
    return result


def main():
    if len(sys.argv) > 1:
        source = pathlib.Path(sys.argv[1]).read_text()
    else:
        source = urllib.request.urlopen(SOURCE).read().decode()
    stems = associations(source, "FILE_STEMS_BY_ICON_KEY")
    suffixes = associations(source, "FILE_SUFFIXES_BY_ICON_KEY")
    if not stems or not suffixes:
        sys.exit("the default icon theme's associations weren't found in icon_theme.rs")
    suffixes["lobster"] = "lobster"

    def theme(appearance):
        return {
            "name": f"Zed + Lobster ({appearance.title()})",
            "appearance": appearance,
            "file_stems": dict(sorted(stems.items())),
            "file_suffixes": dict(sorted(suffixes.items())),
            # Icons from extensions are drawn in their own colours rather than the theme's.
            "file_icons": {"lobster": {"path": f"./icons/lobster_{appearance}.svg"}},
        }

    family = {
        "$schema": "https://zed.dev/schema/icon_themes/v0.3.0.json",
        "name": "Zed + Lobster",
        "author": "Dominic Cassidy",
        "themes": [theme("dark"), theme("light")],
    }
    out = ROOT / "icon_themes" / "lobster.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(family, indent=2) + "\n")
    print(f"{out.relative_to(ROOT)}: {len(stems)} file names, {len(suffixes)} extensions")


if __name__ == "__main__":
    main()
