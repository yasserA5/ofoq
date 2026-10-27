"""Nador El Aroui Airport (NDR) - website backend.

Pure standard library: serves the static site and a small JSON API.

    py -3 server.py            # http://localhost:8077
    py -3 server.py --port 9000

API
    GET  /api/flights?type=departures|arrivals&q=...   real Flightradar24 board
                                                      (simulated fallback without a token)
    GET  /api/crowd?day=0..6                          busy-hours profile
    GET  /api/stats                                   rating summary
    GET  /api/reviews                                 latest reviews
    POST /api/reviews   {name, rating, text, tags[]}  add a review
    POST /api/contact   {name, email, subject, message}
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import random
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
REVIEWS_FILE = DATA / "reviews.json"
MESSAGES_FILE = DATA / "messages.json"
LOCK = threading.Lock()

MOROCCO = timezone(timedelta(hours=1))

# Routes typically served from Nador (NDR). Times are a simulated daily pattern.
ROUTES = [
    # code, city_fr, city_ar, city_en, airline, prefix, duration_min
    ("BRU", "Bruxelles", "بروكسل", "Brussels", "Royal Air Maroc", "AT", 185),
    ("CRL", "Charleroi", "شارلروا", "Charleroi", "Ryanair", "FR", 185),
    ("AMS", "Amsterdam", "أمستردام", "Amsterdam", "Transavia", "HV", 200),
    ("EIN", "Eindhoven", "آيندهوفن", "Eindhoven", "Transavia", "HV", 195),
    ("RTM", "Rotterdam", "روتردام", "Rotterdam", "Transavia", "HV", 195),
    ("DUS", "Düsseldorf", "دوسلدورف", "Düsseldorf", "Royal Air Maroc", "AT", 205),
    ("FRA", "Francfort", "فرانكفورت", "Frankfurt", "Royal Air Maroc", "AT", 195),
    ("CDG", "Paris CDG", "باريس", "Paris CDG", "Royal Air Maroc", "AT", 165),
    ("ORY", "Paris Orly", "باريس أورلي", "Paris Orly", "Transavia", "TO", 165),
    ("MRS", "Marseille", "مارسيليا", "Marseille", "Air Arabia Maroc", "3O", 130),
    ("BCN", "Barcelone", "برشلونة", "Barcelona", "Vueling", "VY", 105),
    ("MAD", "Madrid", "مدريد", "Madrid", "Air Arabia Maroc", "3O", 90),
    ("AGP", "Malaga", "مالقة", "Málaga", "Air Arabia Maroc", "3O", 60),
    ("CMN", "Casablanca", "الدار البيضاء", "Casablanca", "Royal Air Maroc", "AT", 75),
    ("RBA", "Rabat", "الرباط", "Rabat", "Royal Air Maroc", "AT", 60),
    ("TNG", "Tanger", "طنجة", "Tangier", "Royal Air Maroc", "AT", 50),
    ("MXP", "Milan", "ميلانو", "Milan", "Air Arabia Maroc", "3O", 155),
    ("BLQ", "Bologne", "بولونيا", "Bologna", "Air Arabia Maroc", "3O", 160),
]

GATES = ["A1", "A2", "A3", "A4", "B1", "B2"]
BELTS = ["1", "2", "3"]


def now_local() -> datetime:
    return datetime.now(MOROCCO)


def day_rng(day: datetime, salt: str) -> random.Random:
    seed = hashlib.sha256(f"{day:%Y-%m-%d}:{salt}".encode()).hexdigest()
    return random.Random(int(seed[:16], 16))


def build_schedule(kind: str, now: datetime) -> list[dict]:
    """Deterministic schedule for today, with status derived from the clock."""
    rng = day_rng(now, kind)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    flights = []
    for code, fr, ar, en, airline, prefix, dur in ROUTES:
        rotations = 2 if code in {"BRU", "AMS", "DUS", "CMN", "CDG"} else 1
        for r in range(rotations):
            hour = rng.choice([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22])
            if r:
                hour = min(23, hour + 6)
            sched = midnight + timedelta(hours=hour, minutes=rng.choice([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]))
            delay = rng.choice([0] * 6 + [10, 15, 25, 40, 75])
            cancelled = rng.random() < 0.03
            est = sched + timedelta(minutes=delay)
            number = f"{prefix} {rng.randint(100, 9899)}"
            mins = (est - now).total_seconds() / 60

            if cancelled:
                status = "cancelled"
            elif kind == "departures":
                if mins < -20:
                    status = "departed"
                elif mins < 0:
                    status = "closed"
                elif mins < 40:
                    status = "boarding"
                elif delay >= 25:
                    status = "delayed"
                elif mins < 150:
                    status = "checkin"
                else:
                    status = "scheduled"
            else:
                if mins < -40:
                    status = "baggage_done"
                elif mins < 0:
                    status = "landed"
                elif mins < 30:
                    status = "approach"
                elif delay >= 25:
                    status = "delayed"
                else:
                    status = "scheduled"

            flights.append({
                "number": number,
                "airline": airline,
                "code": code,
                "city": {"fr": fr, "ar": ar, "en": en},
                "scheduled": sched.strftime("%H:%M"),
                "estimated": est.strftime("%H:%M"),
                "delay": delay,
                "status": status,
                "gate": rng.choice(GATES) if kind == "departures" else None,
                "belt": rng.choice(BELTS) if kind == "arrivals" else None,
                "counter": f"{rng.randint(1, 16):02d}" if kind == "departures" else None,
                "duration": dur,
                "ts": sched.isoformat(),
            })
    flights.sort(key=lambda f: f["ts"])
    return flights


# ---------------------------------------------------------------------------
# Flightradar24 official API (https://fr24api.flightradar24.com)
# Token: FR24_API_TOKEN env var, or a line FR24_API_TOKEN=... in nador-airport/.env
# ---------------------------------------------------------------------------

FR24_BASE = "https://fr24api.flightradar24.com"
FR24_TTL = 120  # seconds; each call spends API credits, so both boards share one cache
AIRPORT = "NDR"

CITIES = {code: {"fr": fr, "ar": ar, "en": en} for code, fr, ar, en, *_ in ROUTES}
CITIES.update({
    "NDR": {"fr": "Nador", "ar": "الناظور", "en": "Nador"},
    "BVA": {"fr": "Paris Beauvais", "ar": "باريس بوفيه", "en": "Paris Beauvais"},
    "LIL": {"fr": "Lille", "ar": "ليل", "en": "Lille"},
    "LYS": {"fr": "Lyon", "ar": "ليون", "en": "Lyon"},
    "NCE": {"fr": "Nice", "ar": "نيس", "en": "Nice"},
    "MPL": {"fr": "Montpellier", "ar": "مونبلييه", "en": "Montpellier"},
    "TLS": {"fr": "Toulouse", "ar": "تولوز", "en": "Toulouse"},
    "CGN": {"fr": "Cologne", "ar": "كولونيا", "en": "Cologne"},
    "NRN": {"fr": "Weeze", "ar": "فيزه", "en": "Weeze"},
    "GRO": {"fr": "Gérone", "ar": "جيرونا", "en": "Girona"},
    "VLC": {"fr": "Valence", "ar": "فالنسيا", "en": "Valencia"},
    "ALC": {"fr": "Alicante", "ar": "أليكانتي", "en": "Alicante"},
    "SVQ": {"fr": "Séville", "ar": "إشبيلية", "en": "Seville"},
    "BGY": {"fr": "Bergame", "ar": "بيرغامو", "en": "Bergamo"},
    "FCO": {"fr": "Rome", "ar": "روما", "en": "Rome"},
    "LGW": {"fr": "Londres", "ar": "لندن", "en": "London"},
    "STN": {"fr": "Londres Stansted", "ar": "لندن ستانستد", "en": "London Stansted"},
    "OUD": {"fr": "Oujda", "ar": "وجدة", "en": "Oujda"},
    "AHU": {"fr": "Al Hoceima", "ar": "الحسيمة", "en": "Al Hoceima"},
    "RAK": {"fr": "Marrakech", "ar": "مراكش", "en": "Marrakech"},
    "FEZ": {"fr": "Fès", "ar": "فاس", "en": "Fez"},
    "AGA": {"fr": "Agadir", "ar": "أكادير", "en": "Agadir"},
    "TTU": {"fr": "Tétouan", "ar": "تطوان", "en": "Tetouan"},
})

# operating_as is the ICAO airline designator
AIRLINES = {
    "RAM": "Royal Air Maroc", "MAC": "Air Arabia Maroc", "RYR": "Ryanair", "RUK": "Ryanair UK",
    "TRA": "Transavia", "TVF": "Transavia France", "VLG": "Vueling", "JAF": "TUI fly Belgium",
    "TUI": "TUI fly", "TFL": "TUI fly Netherlands", "EZY": "easyJet", "EJU": "easyJet Europe",
    "BEL": "Brussels Airlines", "AEA": "Air Europa", "IBE": "Iberia", "AFR": "Air France",
    "KLM": "KLM", "DLH": "Lufthansa", "EWG": "Eurowings", "WZZ": "Wizz Air", "AMV": "AMC Airlines",
}

_fr24_cache = {"at": 0.0, "data": None, "error": None}
_fr24_lock = threading.Lock()


def fr24_token() -> str | None:
    token = os.environ.get("FR24_API_TOKEN")
    if token:
        return token.strip()
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            key, _, value = line.partition("=")
            if key.strip() == "FR24_API_TOKEN" and value.strip():
                return value.strip().strip('"').strip("'")
    return None


def fr24_get(path: str, params: dict, token: str) -> dict:
    query = "&".join(f"{k}={urllib.request.quote(str(v), safe=':,')}" for k, v in params.items())
    req = urllib.request.Request(f"{FR24_BASE}{path}?{query}", headers={
        "Accept": "application/json",
        "Accept-Version": "v1",
        "Authorization": f"Bearer {token}",
        "User-Agent": "NDR-website/1.0",
    })
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read().decode("utf-8"))


def parse_utc(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def hhmm(dt: datetime | None) -> str:
    return dt.astimezone(MOROCCO).strftime("%H:%M") if dt else "--:--"


def city_for(iata: str | None, icao: str | None) -> tuple[str, dict]:
    code = iata or icao or "???"
    return code, CITIES.get(code, {"fr": code, "ar": code, "en": code})


def fr24_fetch(token: str) -> dict:
    """One live call + one summary call cover both boards for the last 12 hours."""
    now_utc = datetime.now(timezone.utc).replace(microsecond=0)
    live = fr24_get("/api/live/flight-positions/full", {"airports": f"both:{AIRPORT}"}, token).get("data", [])
    summary = fr24_get("/api/flight-summary/full", {
        "flight_datetime_from": (now_utc - timedelta(hours=12)).strftime("%Y-%m-%dT%H:%M:%S"),
        "flight_datetime_to": now_utc.strftime("%Y-%m-%dT%H:%M:%S"),
        "airports": f"both:{AIRPORT}",
        "limit": 100,
    }, token).get("data", [])

    live_by_id = {p.get("fr24_id"): p for p in live}
    boards = {"departures": [], "arrivals": []}
    seen = set()

    def add(kind: str, s: dict, pos: dict | None):
        fid = s.get("fr24_id")
        if (kind, fid) in seen:
            return
        seen.add((kind, fid))
        dep = kind == "departures"
        code, city = city_for(s.get("dest_iata") if dep else s.get("orig_iata"),
                              s.get("dest_icao") if dep else s.get("orig_icao"))
        takeoff = parse_utc(s.get("datetime_takeoff"))
        landed = parse_utc(s.get("datetime_landed"))
        eta = parse_utc(pos.get("eta")) if pos else None
        airborne = pos is not None and not s.get("flight_ended")

        if dep:
            when = takeoff or parse_utc(s.get("first_seen"))
            status = "enroute" if airborne else ("landed" if landed else ("departed" if takeoff else "taxi"))
        else:
            when = landed or eta or takeoff
            if landed or s.get("flight_ended"):
                status = "landed"
            elif eta and (eta - now_utc).total_seconds() < 1800:
                status = "approach"
            else:
                status = "enroute"

        progress = None
        if airborne and takeoff and eta and eta > takeoff:
            progress = max(0.0, min(1.0, (now_utc - takeoff) / (eta - takeoff)))
        elif status in ("landed", "baggage_done"):
            progress = 1.0

        airline_code = s.get("operating_as") or s.get("painted_as") or ""
        number = s.get("flight") or s.get("callsign") or "—"
        flight_time = s.get("flight_time")
        boards[kind].append({
            "id": fid,
            "number": number,
            "callsign": s.get("callsign"),
            "airline": AIRLINES.get(airline_code, airline_code or "—"),
            "code": code,
            "city": city,
            "scheduled": hhmm(when),
            "estimated": hhmm(eta if (not dep and eta and not landed) else when),
            "delay": 0,
            "status": status,
            "gate": None,
            "belt": None,
            "counter": None,
            "duration": round(flight_time / 60) if flight_time else (
                round((eta - takeoff).total_seconds() / 60) if eta and takeoff else None),
            "progress": progress,
            "aircraft": s.get("type") or (pos or {}).get("type"),
            "reg": s.get("reg") or (pos or {}).get("reg"),
            "alt": (pos or {}).get("alt"),
            "speed": (pos or {}).get("gspeed"),
            "ts": (when or now_utc).isoformat(),
            "link": f"https://www.flightradar24.com/{(s.get('callsign') or number).replace(' ', '')}/{fid}" if fid else None,
        })

    for s in summary:
        pos = live_by_id.get(s.get("fr24_id"))
        if (s.get("orig_iata") == AIRPORT) or (s.get("orig_icao") == "GMMW"):
            add("departures", s, pos)
        if (s.get("dest_iata") == AIRPORT) or (s.get("dest_icao") == "GMMW") or (s.get("dest_iata_actual") == AIRPORT):
            add("arrivals", s, pos)
    # Airborne flights that took off before the summary window (long-haul / late data)
    for p in live:
        stub = {**p, "datetime_takeoff": None, "flight_ended": False}
        if p.get("orig_iata") == AIRPORT:
            add("departures", stub, p)
        if p.get("dest_iata") == AIRPORT:
            add("arrivals", stub, p)

    for kind in boards:
        boards[kind].sort(key=lambda f: f["ts"])
    return boards


def real_board(kind: str) -> dict | None:
    """Cached FR24 board, or None when no token is configured."""
    token = fr24_token()
    if not token:
        return None
    with _fr24_lock:
        fresh = time.time() - _fr24_cache["at"] < FR24_TTL
        if not fresh:
            try:
                _fr24_cache["data"] = fr24_fetch(token)
                _fr24_cache["error"] = None
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", "replace")[:300]
                _fr24_cache["error"] = f"HTTP {e.code}: {body}"
                print(f"[fr24] {_fr24_cache['error']}")
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
                _fr24_cache["error"] = str(e)
                print(f"[fr24] {e}")
            _fr24_cache["at"] = time.time()
        data, error = _fr24_cache["data"], _fr24_cache["error"]
        fetched = datetime.fromtimestamp(_fr24_cache["at"], MOROCCO).strftime("%H:%M:%S")
    if data is None:
        return {"source": "fr24", "error": error, "flights": [], "updated": fetched}
    return {"source": "fr24", "error": error, "flights": data[kind], "updated": fetched}


# Monday profile from the public listing pattern, generalised per day.
BASE_CROWD = [5, 4, 3, 3, 8, 22, 48, 62, 55, 40, 35, 42, 58, 66, 52, 44, 50, 63, 70, 61, 45, 30, 18, 10]


def crowd_for(day: int) -> list[int]:
    rng = random.Random(day * 7919)
    summer_bump = 1.15 if day in (4, 5, 6) else 1.0
    return [max(2, min(100, round(v * summer_bump + rng.randint(-6, 6)))) for v in BASE_CROWD]


SEED_REVIEWS = [
    {"name": "Star & Star", "badge": "local_guide", "rating": None, "lang": "nl", "ago_days": 300,
     "text": "Ik heb 18 minuten moeten wachten bij de paspoortcontrole. Ik begrijp echt niet waarom dit zo lang duurt.",
     "tags": ["customs"]},
    {"name": "Chaimae Loukili", "rating": None, "lang": "ar", "ago_days": 150,
     "text": "المطار جميل جدًا ويعكس صورة رائعة، لكن ما يثير الاستغراب عند الوصول هو العدد القليل جدًا من موظفي ختم الجوازات بالرغم من وجود حوالي 16 مكتبًا.",
     "tags": ["customs"]},
    {"name": "fouad laknouz", "rating": None, "lang": "ar", "ago_days": 150,
     "text": "إلى المسؤولين عن مطار العروي: المرجو تفعيل خدمة الويفاي بالمطار، لا يعقل مطار بدون واي فاي. وفي كثير من الأحيان ختم الجوازات بطيء جدًا.",
     "tags": ["wifi", "customs"]},
]


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path: Path, data) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def all_reviews() -> list[dict]:
    stored = load_json(REVIEWS_FILE, [])
    now = now_local()
    seeded = [{**r, "date": (now - timedelta(days=r.pop("ago_days"))).date().isoformat()}
              for r in (dict(x) for x in SEED_REVIEWS)]
    return sorted(stored + seeded, key=lambda r: r["date"], reverse=True)


def stats() -> dict:
    # Public listing baseline: 3.5 average across 1,670 ratings.
    dist = {"5": 680, "4": 290, "3": 230, "2": 130, "1": 340}
    for r in load_json(REVIEWS_FILE, []):
        dist[str(r["rating"])] += 1
    total = sum(dist.values())
    avg = sum(int(k) * v for k, v in dist.items()) / total
    return {
        "average": round(avg, 1),
        "total": total,
        "distribution": dist,
        "topics": [
            {"key": "customs", "count": 30},
            {"key": "respect", "count": 20},
            {"key": "disaster", "count": 12},
            {"key": "toilet_paper", "count": 11},
            {"key": "wifi", "count": 9},
            {"key": "parking", "count": 7},
        ],
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def log_message(self, fmt, *args):
        print(f"[{now_local():%H:%M:%S}] {self.address_string()} {fmt % args}")

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        # API never cached; static files revalidated so edits show up immediately
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
        super().end_headers()

    def send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self) -> dict | None:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 20_000:
            return None
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None
        return data if isinstance(data, dict) else None

    def do_GET(self):
        url = urlparse(self.path)
        qs = parse_qs(url.query)
        if url.path == "/api/flights":
            kind = qs.get("type", ["departures"])[0]
            if kind not in ("departures", "arrivals"):
                return self.send_json({"error": "bad type"}, HTTPStatus.BAD_REQUEST)
            now = now_local()
            real = real_board(kind)
            if real is not None:
                payload = {"type": kind, **real}
            else:
                payload = {"type": kind, "source": "simulated", "error": None,
                           "updated": now.strftime("%H:%M:%S"), "flights": build_schedule(kind, now)}
            q = qs.get("q", [""])[0].strip().lower()
            if q:
                payload["flights"] = [f for f in payload["flights"] if q in f["number"].lower() or q in f["airline"].lower()
                                      or q in f["code"].lower() or any(q in c.lower() for c in f["city"].values())]
            return self.send_json(payload)
        if url.path == "/api/crowd":
            try:
                day = int(qs.get("day", [now_local().weekday()])[0]) % 7
            except ValueError:
                day = now_local().weekday()
            now = now_local()
            return self.send_json({"day": day, "hours": crowd_for(day),
                                   "live_hour": now.hour if day == now.weekday() else None})
        if url.path == "/api/stats":
            return self.send_json(stats())
        if url.path == "/api/reviews":
            return self.send_json({"reviews": all_reviews()[:30]})
        if url.path == "/api/time":
            return self.send_json({"now": now_local().isoformat()})
        if url.path.startswith("/api/"):
            return self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)
        return super().do_GET()

    def do_POST(self):
        url = urlparse(self.path)
        data = self.read_body()
        if data is None:
            return self.send_json({"error": "invalid body"}, HTTPStatus.BAD_REQUEST)

        if url.path == "/api/reviews":
            name = str(data.get("name", "")).strip()[:60]
            text = str(data.get("text", "")).strip()[:1500]
            try:
                rating = int(data.get("rating", 0))
            except (TypeError, ValueError):
                rating = 0
            tags = [t for t in data.get("tags", []) if t in {"customs", "respect", "wifi", "toilet_paper", "parking", "cleanliness", "staff"}][:5]
            errors = {}
            if len(name) < 2:
                errors["name"] = "name"
            if not 1 <= rating <= 5:
                errors["rating"] = "rating"
            if len(text) < 10:
                errors["text"] = "text"
            if errors:
                return self.send_json({"errors": errors}, HTTPStatus.UNPROCESSABLE_ENTITY)
            review = {"name": name, "rating": rating, "text": text, "tags": tags,
                      "lang": str(data.get("lang", "ar"))[:2], "date": now_local().date().isoformat()}
            with LOCK:
                stored = load_json(REVIEWS_FILE, [])
                stored.append(review)
                save_json(REVIEWS_FILE, stored)
            return self.send_json({"ok": True, "review": review}, HTTPStatus.CREATED)

        if url.path == "/api/contact":
            msg = {k: str(data.get(k, "")).strip()[:2000] for k in ("name", "email", "subject", "message")}
            errors = {}
            if len(msg["name"]) < 2:
                errors["name"] = "name"
            if "@" not in msg["email"] or "." not in msg["email"].split("@")[-1]:
                errors["email"] = "email"
            if len(msg["message"]) < 10:
                errors["message"] = "message"
            if errors:
                return self.send_json({"errors": errors}, HTTPStatus.UNPROCESSABLE_ENTITY)
            msg["received"] = now_local().isoformat()
            ticket = "NDR-" + hashlib.sha1(msg["received"].encode()).hexdigest()[:6].upper()
            msg["ticket"] = ticket
            with LOCK:
                stored = load_json(MESSAGES_FILE, [])
                stored.append(msg)
                save_json(MESSAGES_FILE, stored)
            return self.send_json({"ok": True, "ticket": ticket}, HTTPStatus.CREATED)

        return self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8077)
    args = parser.parse_args()
    mimetypes.add_type("text/javascript", ".js")
    mimetypes.add_type("image/svg+xml", ".svg")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"NDR site running on http://localhost:{args.port}")
    print("Flight board source:", "Flightradar24 API" if fr24_token() else
          "simulated (set FR24_API_TOKEN or add it to nador-airport/.env for real data)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
