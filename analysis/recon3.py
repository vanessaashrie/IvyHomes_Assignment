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
        print(json.dumps(resp.json(), indent=2)[:1500])
    except Exception:
        print(resp.text[:500])

login_resp = requests.post(f"{BASE}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, headers=KEY_HEADER)
token = login_resp.json()["access_token"]
AUTH = {**KEY_HEADER, "Authorization": f"Bearer {token}"}

r = requests.get(f"{BASE}/v1/listings", params={"limit": 1}, headers=AUTH)
sample_id = r.json()["results"][0]["listing_id"]
print(f"Using sample listing_id: {sample_id}")

# Test /v1/saved write flow with a couple of plausible body shapes
pretty("POST /v1/saved with {'id': ...}",
       requests.post(f"{BASE}/v1/saved", headers=AUTH, json={"id": sample_id}))

pretty("GET /v1/saved (after POST attempt)",
       requests.get(f"{BASE}/v1/saved", headers=AUTH))

pretty("POST /v1/saved with {'listing_id': ...}",
       requests.post(f"{BASE}/v1/saved", headers=AUTH, json={"listing_id": sample_id}))

pretty("GET /v1/saved (after 2nd POST attempt)",
       requests.get(f"{BASE}/v1/saved", headers=AUTH))

pretty(f"DELETE /v1/saved/{sample_id}",
       requests.delete(f"{BASE}/v1/saved/{sample_id}", headers=AUTH))

# A few more analytics guesses before calling it fully missing
for path in ["/v1/city/summary", "/v1/city-summary", "/v1/overview", "/v1/dashboard",
             "/v1/metrics", "/v1/report", "/v1/reports/summary"]:
    pretty(f"GUESS: GET {path}", requests.get(f"{BASE}{path}", headers=AUTH))