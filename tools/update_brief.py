#!/usr/bin/env python3
"""Morning Brief archive builder.

Usage:
  python3 update_brief.py --new new_brief.json --repo REPO_DIR --out OUT_DIR

REPO_DIR is a clone of the morning-brief GitHub repository. The script:
  1. validates new_brief.json (one brief object),
  2. writes REPO_DIR/briefs/days/YYYY-MM-DD.json,
  3. rewrites REPO_DIR/briefs/index.json (all dates, newest first),
  4. writes OUT_DIR/daily/YYYY-MM-DD.md (plain-text copy of the day),
  5. rebuilds OUT_DIR/Morning Brief YYYY-MM.xlsx from every day of that month.
It prints the files written; OUT_DIR files and the day JSON go to OneDrive.
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
    if not b["items"]:
        fail("brief has no items")
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
        it.setdefault("detail", [])
    for m in b["markets"]:
        for k in ["group", "label", "value"]:
            if not m.get(k):
                fail("market entry is missing '%s'" % k)
        m.setdefault("dir", "flat")


def write_json(path, data):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    return path


def write_md(path, b):
    lines = ["# Morning Brief, " + b["label"], ""]
    groups = {}
    for m in b["markets"]:
        groups.setdefault(m["group"], []).append(m)
    lines.append("## Market snapshot")
    for g, ms in groups.items():
        lines += ["", "**" + g + "**"]
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
        import openpyxl  # noqa: F401
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
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    wb.save(path)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--new", required=True)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    with open(a.new, encoding="utf-8") as f:
        new = json.load(f)
    if "briefs" in new:
        new = new["briefs"][0]
    validate(new)

    days_dir = os.path.join(a.repo, "briefs", "days")
    written = [write_json(os.path.join(days_dir, new["date"] + ".json"), new)]

    dates = sorted((os.path.basename(p)[:10] for p in glob.glob(os.path.join(days_dir, "????-??-??.json"))), reverse=True)
    labels = {}
    for d in dates:
        with open(os.path.join(days_dir, d + ".json"), encoding="utf-8") as f:
            labels[d] = json.load(f).get("label", d)
    index = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "latest": dates[0] if dates else None,
        "days": [{"date": d, "label": labels[d]} for d in dates],
    }
    written.append(write_json(os.path.join(a.repo, "briefs", "index.json"), index))

    written.append(write_md(os.path.join(a.out, "daily", new["date"] + ".md"), new))

    month = new["date"][:7]
    month_briefs = []
    for d in sorted(dates):
        if d.startswith(month):
            with open(os.path.join(days_dir, d + ".json"), encoding="utf-8") as f:
                month_briefs.append(json.load(f))
    written.append(write_xlsx(os.path.join(a.out, "Morning Brief %s.xlsx" % month), month_briefs))

    for p in written:
        print("WROTE " + p)


if __name__ == "__main__":
    main()
