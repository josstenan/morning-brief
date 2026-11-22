#!/usr/bin/env python3
"""Copy the Morning Brief data from a public OneDrive share into this repo.

The OneDrive folder "Morning Brief/briefs" is the master copy. It holds
index.json and one YYYY-MM-DD.json per day. Set ONEDRIVE_SHARE_URL to an
"anyone with the link can view" link for that folder.

Writes briefs/index.json and briefs/days/YYYY-MM-DD.json, and rebuilds
downloads/Morning Brief YYYY-MM.xlsx for every month that changed.
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.onedrive.com/v1.0/shares/{token}/root/children?$top=1000"


def share_token(url):
    b = base64.b64encode(url.encode()).decode().rstrip("=").replace("/", "_").replace("+", "-")
    return "u!" + b


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "morning-brief-sync"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    share = os.environ.get("ONEDRIVE_SHARE_URL", "").strip()
    if not share:
        sys.exit("ONEDRIVE_SHARE_URL is not set")
    listing = json.loads(get(API.format(token=share_token(share))))
    files = {}
    for it in listing.get("value", []):
        url = it.get("@content.downloadUrl") or it.get("@microsoft.graph.downloadUrl")
        if it.get("file") and url:
            files[it["name"]] = url
    if "index.json" not in files:
        sys.exit("index.json not found in the shared folder; got: %s" % sorted(files))

    index = json.loads(get(files["index.json"]))
    days_dir = os.path.join(ROOT, "briefs", "days")
    os.makedirs(days_dir, exist_ok=True)
    changed_months = set()
    for d in index.get("days", []):
        name = d["date"] + ".json"
        dest = os.path.join(days_dir, name)
        if name not in files:
            print("missing in OneDrive:", name)
            continue
        data = get(files[name])
        json.loads(data)  # must parse
        old = open(dest, "rb").read() if os.path.exists(dest) else None
        if old != data:
            with open(dest, "wb") as f:
                f.write(data)
            changed_months.add(d["date"][:7])
            print("updated", name)
    with open(os.path.join(ROOT, "briefs", "index.json"), "wb") as f:
        f.write(json.dumps(index, ensure_ascii=False, separators=(",", ":")).encode())

    if changed_months:
        sys.path.insert(0, os.path.join(ROOT, "tools"))
        import update_brief as ub  # noqa: E402
        for month in sorted(changed_months):
            briefs = []
            for d in sorted(x["date"] for x in index.get("days", [])):
                p = os.path.join(days_dir, d + ".json")
                if d.startswith(month) and os.path.exists(p):
                    briefs.append(json.load(open(p, encoding="utf-8")))
            out = os.path.join(ROOT, "downloads", "Morning Brief %s.xlsx" % month)
            ub.write_xlsx(out, briefs)
            print("built", out)


if __name__ == "__main__":
    main()
