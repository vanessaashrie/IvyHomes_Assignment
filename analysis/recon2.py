"""
Ivy Homes API recon round 2 — targeted hypothesis testing.
Run: python recon2.py
"""

import requests
import json

BASE = "https://solve.ivy.homes"
API_KEY = "IVY26-419F95457630"
DEMO_EMAIL = "demo1@ivy.homes"
DEMO_PASSWORD = "089c5f4214"

KEY_HEADER = {"X-API-Key": API_KEY}


def pretty(label, resp):
    print(f"\n{'='*70}\n{label}\n{'='*70}")
    print(f"Status: {resp.status_code}")
    try:
        print(json.dumps(resp.json(), indent=2)[:3000])
    except Exception:
        print(resp.text[:1000])


# --- login ---
login_resp = requests.post(f"{BASE}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, headers=KEY_HEADER)
token = login_resp.json()["access_token"]
AUTH = {**KEY_HEADER, "Authorization": f"Bearer {token}"}
print("Logged in OK.\n")

# --- Hypothesis 1: single-listing path is plural /v1/listings/{id}, not /v1/listing/{id} ---
r = requests.get(f"{BASE}/v1/listings", params={"limit": 1}, headers=AUTH)
sample_id = r.json()["results"][0]["listing_id"]
print(f"Sample listing_id to test with: {sample_id}")

pretty(f"HYPOTHESIS: GET /v1/listings/{sample_id}  (plural)",
       requests.get(f"{BASE}/v1/listings/{sample_id}", headers=AUTH))

pretty(f"HYPOTHESIS: GET /v1/listings/{sample_id}/similar  (plural, same as docs)",
       requests.get(f"{BASE}/v1/listings/{sample_id}/similar", headers=AUTH))

# --- Hypothesis 2: favourites might be at a different path or spelling ---
for path in ["/v1/favourites", "/v1/favorites", "/v1/user/favourites", "/v1/users/favourites",
             "/v1/me/favourites", "/v1/saved", "/v1/saved-listings"]:
    pretty(f"HYPOTHESIS: GET {path}", requests.get(f"{BASE}{path}", headers=AUTH))

# --- Hypothesis 3: analytics might be at a different path ---
for path in ["/v1/analytics/summary", "/v1/analytics", "/v1/insights", "/v1/insights/summary",
             "/v1/stats", "/v1/stats/summary", "/v1/summary"]:
    pretty(f"HYPOTHESIS: GET {path}", requests.get(f"{BASE}{path}", headers=AUTH))

# --- Hypothesis 4: does `page` param do anything, or only `offset` works? ---
r1 = requests.get(f"{BASE}/v1/listings", params={"limit": 5, "page": 1}, headers=AUTH)
r2 = requests.get(f"{BASE}/v1/listings", params={"limit": 5, "page": 2}, headers=AUTH)
ids1 = [x["listing_id"] for x in r1.json()["results"]]
ids2 = [x["listing_id"] for x in r2.json()["results"]]
print(f"\n{'='*70}\nHYPOTHESIS: does ?page=1 vs ?page=2 change results (with no offset given)?\n{'='*70}")
print(f"page=1 ids: {ids1}")
print(f"page=2 ids: {ids2}")
print(f"SAME results despite different page? {ids1 == ids2}  <- if True, `page` is ignored, only `offset` works")

r3 = requests.get(f"{BASE}/v1/listings", params={"limit": 5, "offset": 5}, headers=AUTH)
ids3 = [x["listing_id"] for x in r3.json()["results"]]
print(f"offset=5 ids: {ids3}  <- this SHOULD differ from offset=0 if offset is the real mechanism")

# --- Hypothesis 5: are project price_min/price_max actually in crores, not rupees? ---
r = requests.get(f"{BASE}/v1/projects", params={"limit": 10}, headers=AUTH)
print(f"\n{'='*70}\nHYPOTHESIS: project price_min/price_max unit check\n{'='*70}")
for p in r.json()["results"]:
    print(f"  {p['project_id']}: price_min={p['price_min']}, price_max={p['price_max']}, "
          f"locality={p['locality']}")
print("If these were real rupees, a Bangalore project would cost less than a coffee. "
      "Almost certainly these are in CRORES (multiply by 1,00,00,000).")

# --- Hypothesis 6: get the FULL text of that suspicious rental description ---
pretty("Full record: GET /v1/rentals/R1000399 (had truncated suspicious description)",
       requests.get(f"{BASE}/v1/rentals/R1000399", headers=AUTH))

print("\n\nDone with round 2. Read the favourites/analytics results carefully — "
      "if ALL alternate paths 404, that's strong evidence they're genuinely undocumented-as-missing "
      "(i.e. the docs describe endpoints that were never shipped).")