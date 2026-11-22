#!/usr/bin/env python3
"""Morning Brief archive builder.

Usage:
  python3 update_brief.py --new new_brief.json --workdir DIR

DIR must contain any existing month files as briefs/YYYY-MM.json (copied down
from OneDrive / GitHub). The script:
  1. validates new_brief.json (one brief object),
  2. inserts or replaces it in briefs/YYYY-MM.json,
  3. rewrites briefs/index.json (list of months, newest first),
  4. writes daily/YYYY-MM-DD.md (plain-text copy of the day),
  5. rebuilds "Morning Brief YYYY.xlsx" from every month file of that year.
It prints the paths it wrote, so the caller knows what to upload.
"""
import argparse
import glob
import json
import os
import re
import sys
from datetime import datetime, timezone

SECTIONS = {
    "acct": "Global accounting and reporting",
    "fin": "Global finance and markets",
    "tax": "Global tax",
    "id": "Indonesia",
}
REQUIRED_ITEM = ["id", "section", "title", "summary", "source", "url"]


def fail(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def validate(b):
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(b.get("date", ""))):
        fail("brief.date must be YYYY-MM-DD")
    for k in ["label", "markets", "items"]:
        if k not in b:
            fail("brief is missing '%s'" % k)
    for it in b["items"]:
        for k in REQUIRED_ITEM:
            if not it.get(k):
                fail("item %s is missing '%s'" % (it.get("id", "?"), k))
        if it["section"] not in SECTIONS:
            fail("item %s has unknown section %s" % (it["id"], it["section"]))
        if not str(it["url"]).startswith(("https://", "http://")):
            fail("item %s url must be http(s)" % it["id"])
        it.setdefault("tags", [])
        it.setdefault("topics", [])
    for m in b["markets"]:
        for k in ["group", "label", "value"]:
            if not m.get(k):
                fail("market entry is missing '%s'" % k)
        m.setdefault("dir", "flat")


def write_json(path, data):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(path)
    if size > 1000000:
        fail("%s is %d bytes, over the 1 MB upload limit" % (path, size))
    return path


def write_md(path, b):
    lines = ["# Morning Brief, " + b["label"], ""]
    groups = {}
    for m in b["markets"]:
        groups.setdefault(m["group"], []).append(m)
    lines.append("## Market snapshot")
    for g, ms in groups.items():
        lines.append("")
        lines.append("**" + g + "**")
        for m in ms:
            src = " ([%s](%s))" % (m.get("source", "source"), m["url"]) if m.get("url") else ""
            lines.append("- %s: %s, %s%s" % (m["label"], m["value"], m.get("delta", ""), src))
    for key, title in SECTIONS.items():
        items = [i for i in b["items"] if i["section"] == key]
        if not items:
            continue
        lines += ["", "## " + title]
        for i in items:
            lines += ["", "### " + i["title"], "", i["summary"]]
            for p in i.get("detail", []) or []:
                lines += ["", p]
            if i.get("why"):
                lines += ["", "*Why it matters:* " + i["why"]]
            lines += ["", "Source: [%s](%s)" % (i["source"], i["url"])]
    if b.get("worth"):
        w = b["worth"]
        lines += ["", "## Worth reading", "", "[%s](%s): %s" % (w.get("title", ""), w.get("url", ""), w.get("text", ""))]
    if b.get("notFound"):
        lines += ["", "## Not found today", "", b["notFound"]]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return path


def write_xlsx(path, briefs):
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
        from openpyxl.utils import get_column_letter
    except ImportError:
        os.system(sys.executable + " -m pip install -q --break-system-packages openpyxl")
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
        from openpyxl.utils import get_column_letter

    wb = Workbook()
    head_font = Font(bold=True, color="FFFFFF")
    head_fill = PatternFill("solid", fgColor="344767")

    def sheet(ws, headers, rows, widths):
        ws.append(headers)
        for c in ws[1]:
            c.font = head_font
            c.fill = head_fill
        for r in rows:
            ws.append(r)
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

    news = wb.active
    news.title = "News"
    rows = []
    for b in briefs:
        for i in b["items"]:
            rows.append([b["date"], SECTIONS[i["section"]], i["title"], i["summary"],
                         i.get("why", ""), ", ".join(i.get("tags", [])), i["source"], i["url"]])
    sheet(news, ["Date", "Section", "Headline", "Summary", "Why it matters", "Tags", "Source", "Link"],
          rows, [12, 26, 50, 70, 50, 26, 18, 40])

    mk = wb.create_sheet("Markets")
    rows = []
    for b in briefs:
        for m in b["markets"]:
            rows.append([b["date"], m["group"], m["label"], m["value"], m.get("delta", ""),
                         m.get("source", ""), m.get("url", "")])
    sheet(mk, ["Date", "Group", "Measure", "Value", "Change / note", "Source", "Link"],
          rows, [12, 16, 28, 16, 30, 20, 40])
    wb.save(path)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--new", required=True)
    ap.add_argument("--workdir", required=True)
    a = ap.parse_args()

    with open(a.new, encoding="utf-8") as f:
        new = json.load(f)
    if "briefs" in new:
        new = new["briefs"][0]
    validate(new)

    wd = a.workdir
    month = new["date"][:7]
    year = new["date"][:4]
    mpath = os.path.join(wd, "briefs", month + ".json")
    data = {"month": month, "briefs": []}
    if os.path.exists(mpath):
        with open(mpath, encoding="utf-8") as f:
            data = json.load(f)
    data["briefs"] = [b for b in data.get("briefs", []) if b.get("date") != new["date"]] + [new]
    data["briefs"].sort(key=lambda b: b["date"], reverse=True)
    written = [write_json(mpath, data)]

    months = sorted({os.path.basename(p)[:7] for p in glob.glob(os.path.join(wd, "briefs", "????-??.json"))}, reverse=True)
    latest = None
    for mfile in months:
        with open(os.path.join(wd, "briefs", mfile + ".json"), encoding="utf-8") as f:
            dates = [b["date"] for b in json.load(f).get("briefs", [])]
        if dates:
            latest = max(dates) if latest is None else max(latest, max(dates))
    index = {"updated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "latest": latest, "months": months}
    written.append(write_json(os.path.join(wd, "briefs", "index.json"), index))

    written.append(write_md(os.path.join(wd, "daily", new["date"] + ".md"), new))

    year_briefs = []
    for p in sorted(glob.glob(os.path.join(wd, "briefs", year + "-??.json"))):
        with open(p, encoding="utf-8") as f:
            year_briefs += json.load(f).get("briefs", [])
    year_briefs.sort(key=lambda b: b["date"])
    written.append(write_xlsx(os.path.join(wd, "Morning Brief %s.xlsx" % year), year_briefs))

    for p in written:
        print("WROTE " + os.path.relpath(p, wd))


if __name__ == "__main__":
    main()
