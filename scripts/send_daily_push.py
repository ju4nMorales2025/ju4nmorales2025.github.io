import json
import os
import sys
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

APP_ID = os.environ.get("ONESIGNAL_APP_ID", "").strip()
API_KEY = os.environ.get("ONESIGNAL_API_KEY", "").strip()

if not APP_ID or not API_KEY:
    print("Faltan ONESIGNAL_APP_ID / ONESIGNAL_API_KEY.")
    sys.exit(1)

repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(repo, "data", "verses.json"), encoding="utf-8") as f:
    verses = json.load(f)

now = datetime.now(ZoneInfo("America/Argentina/Buenos_Aires"))
base = datetime(2026, 1, 1, tzinfo=ZoneInfo("America/Argentina/Buenos_Aires"))
index = abs((now.date() - base.date()).days) % len(verses)
v = verses[index]

def text_for(version):
    key = "rvr1960" if version == "RVR1960" else "pdt"
    exact = (v.get(key) or "").strip()
    return exact or v["preview"]

def send(version_tag, version_for_text):
    body = {
        "app_id": APP_ID,
        "target_channel": "push",
        "filters": [
            {
                "field": "tag",
                "key": "bible_version",
                "relation": "=",
                "value": version_tag
            }
        ],
        "headings": {"es": v["reference"]},
        "contents": {"es": text_for(version_for_text)},
        "url": os.environ.get("SITE_URL", "")
    }
    req = urllib.request.Request(
        "https://api.onesignal.com/notifications",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": f"Key {API_KEY}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        print(version_tag, response.status, response.read().decode("utf-8"))

mixed_version = "RVR1960" if now.day % 2 == 0 else "PDT"

send("RVR1960", "RVR1960")
send("PDT", "PDT")
send("MIXED", mixed_version)
