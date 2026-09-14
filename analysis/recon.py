"""
Ivy Homes API recon script — Phase 0.
Run locally: pip install requests && python recon.py
Fill in API_KEY, and a demo password once you have it.
"""

import requests
import json
from datetime import datetime, timezone

BASE = "https://solve.ivy.homes"
API_KEY = "IVY26-419F95457630"
DEMO_EMAIL = "demo1@ivy.homes"
DEMO_PASSWORD = "089c5f4214"  # from your email

def pretty(label, resp):
    print(f"\n{'='*70}\n{label}\n{'='*70}")
    print(f"Status: {resp.status_code}")
    try:
        print(json.dumps(resp.json(), indent=2)[:2000])
    except Exception:
        print(resp.text[:2000])

# --- 0. Base headers: the API wants the key as X-API-Key, NOT ?api_key=... ---
# (confirmed by live 401 responses: "send your key in the X-API-Key request header")
KEY_HEADER = {"X-API-Key": API_KEY}

# --- 1. /health, unauthenticated, before anything else ---
r = requests.get(f"{BASE}/health")
pretty("GET /health (unauthenticated)", r)
print(f"\n>> My local UTC time right now: {datetime.now(timezone.utc).isoformat()}")
print(">> Compare the server clock above: same offset? explicit +05:30 or Z? drift?")

# --- 2. Auth flow ---
# Login also demanded X-API-Key per the earlier run, so send it here too.
login_resp = requests.post(
    f"{BASE}/auth/login",
    json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    headers=KEY_HEADER,
)
pretty("POST /auth/login", login_resp)

token = None
refresh_token = None
if login_resp.status_code == 200:
    body = login_resp.json()
    # NOTE: docs say the field is "token" — actual API returns "access_token".
    token = body.get("access_token")
    refresh_token = body.get("refresh_token")
    print(f"\n>> Got access_token, len={len(token) if token else 0}")
    print(f">> expires_in={body.get('expires_in')} seconds "
          f"(docs claimed 86400 / 24h — check if this matches)")
    print(f">> refresh_token present: {refresh_token is not None} "
          f"(docs claimed 'no refresh flow' — check refresh_url: {body.get('refresh_url')})")
else:
    print("\n>> LOGIN FAILED — fix this before continuing, everything below depends on it.")

AUTH_HEADERS = {**KEY_HEADER, "Authorization": f"Bearer {token}"} if token else KEY_HEADER

# --- 3. Sweep every documented endpoint once ---
# Each entry: (method, path, params, needs_auth)
endpoints = [
    ("GET", "/v1/listings", {"limit": 5}, True),
    ("GET", "/v1/rentals", {"limit": 5}, True),
    ("GET", "/v1/projects", {"limit": 5}, True),
    ("GET", "/v1/favourites", {}, True),
    ("GET", "/v1/analytics/summary", {}, True),
]

first_listing_id = None
first_project_id = None
first_rental_id = None

for method, path, params, needs_auth in endpoints:
    headers = AUTH_HEADERS if needs_auth else {}
    r = requests.request(method, f"{BASE}{path}", params=params, headers=headers)
    pretty(f"{method} {path}", r)
    if r.status_code == 200:
        data = r.json()
        results = data.get("results", [])
        if path == "/v1/listings" and results:
            first_listing_id = results[0].get("listing_id")
        if path == "/v1/projects" and results:
            first_project_id = results[0].get("project_id")
        if path == "/v1/rentals" and results:
            first_rental_id = results[0].get("listing_id")

# --- 4. Detail + nested endpoints, now that we have real IDs ---
if first_listing_id:
    r = requests.get(f"{BASE}/v1/listing/{first_listing_id}", headers=AUTH_HEADERS)
    pretty(f"GET /v1/listing/{first_listing_id}", r)

    r = requests.get(f"{BASE}/v1/listings/{first_listing_id}/similar", headers=AUTH_HEADERS)
    pretty(f"GET /v1/listings/{first_listing_id}/similar", r)

if first_rental_id:
    r = requests.get(f"{BASE}/v1/rentals/{first_rental_id}", headers=AUTH_HEADERS)
    pretty(f"GET /v1/rentals/{first_rental_id}", r)

if first_project_id:
    r = requests.get(f"{BASE}/v1/projects/{first_project_id}", headers=AUTH_HEADERS)
    pretty(f"GET /v1/projects/{first_project_id}", r)

# --- 5. Favourites write flow (POST/DELETE) ---
if first_listing_id:
    r = requests.post(f"{BASE}/v1/favourites", headers=AUTH_HEADERS, json={"id": first_listing_id})
    pretty(f"POST /v1/favourites (add {first_listing_id})", r)

    r = requests.get(f"{BASE}/v1/favourites", headers=AUTH_HEADERS)
    pretty("GET /v1/favourites (after add)", r)

    r = requests.delete(f"{BASE}/v1/favourites/{first_listing_id}", headers=AUTH_HEADERS)
    pretty(f"DELETE /v1/favourites/{first_listing_id}", r)

# --- 6. Deliberately wrong/edge requests to see error shape ---
pretty("GET /v1/listings with huge limit",
       requests.get(f"{BASE}/v1/listings", params={"limit": 99999}, headers=AUTH_HEADERS))

pretty("GET /v1/listing/{bad-id}",
       requests.get(f"{BASE}/v1/listing/does-not-exist", headers=AUTH_HEADERS))

pretty("GET /v1/listings with NO key at all",
       requests.get(f"{BASE}/v1/listings", params={"limit": 5}))

pretty("GET /v1/listings with key as query param (docs' way) — should fail per what we saw",
       requests.get(f"{BASE}/v1/listings", params={"api_key": API_KEY, "limit": 5}))

# --- 7. Test the undocumented refresh flow ---
if refresh_token:
    r = requests.post(f"{BASE}/auth/refresh", json={"refresh_token": refresh_token}, headers=KEY_HEADER)
    pretty("POST /auth/refresh (undocumented — testing it exists and works)", r)

print("\n\nDone. Read every response body above carefully — especially error 'detail' "
      "messages and any pagination metadata (limit/offset/total actually used).")