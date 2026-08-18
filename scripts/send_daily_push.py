import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

APP_ID = os.environ.get("ONESIGNAL_APP_ID", "").strip()
API_KEY = os.environ.get("ONESIGNAL_API_KEY", "").strip()
SITE_URL = os.environ.get("SITE_URL", "").strip()

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

# Mientras los textos exactos RVR1960/PDT no estén cargados con autorización,
# se usa el texto de vista previa. Cuando estén disponibles, la mezcla diaria
# alternará automáticamente entre ambas versiones.
version = "RVR1960" if now.day % 2 == 0 else "PDT"
key = "rvr1960" if version == "RVR1960" else "pdt"
exact = (v.get(key) or "").strip()
text = exact or v["preview"]

body = {
    "app_id": APP_ID,
    "target_channel": "push",
    "included_segments": ["Subscribed Users"],
    "headings": {
        "en": v["reference"],
        "es": v["reference"]
    },
    "contents": {
        "en": text,
        "es": text
    },
    "url": SITE_URL
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

try:
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read().decode("utf-8")
        print("OneSignal:", response.status, raw)
        result = json.loads(raw)
        if not result.get("id"):
            print("OneSignal no creó la notificación.")
            sys.exit(1)
except urllib.error.HTTPError as err:
    detail = err.read().decode("utf-8", errors="replace")
    print(f"OneSignal HTTP {err.code}: {detail}")
    sys.exit(1)
