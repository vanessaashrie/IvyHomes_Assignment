"""
Ivy Homes API bulk pull — Phase 1, corrected.
Uses the REAL auth (X-API-Key header, access_token field) and REAL
pagination (offset/limit + has_more — `page` is ignored by the API).

Run: python bulk_pull.py
"""

import requests
import json
import time

BASE = "https://solve.ivy.homes"
API_KEY = "IVY26-419F95457630"
DEMO_EMAIL = "demo1@ivy.homes"
DEMO_PASSWORD = "089c5f4214"

MAX_LIMIT = 200
KEY_HEADER = {"X-API-Key": API_KEY}


def login():
    r = requests.post(f"{BASE}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
                       headers=KEY_HEADER)
    r.raise_for_status()
    body = r.json()
    return body["access_token"], body.get("refresh_token")


def refresh(refresh_token):
    r = requests.post(f"{BASE}/auth/refresh", json={"refresh_token": refresh_token}, headers=KEY_HEADER)
    r.raise_for_status()
    body = r.json()
    return body["access_token"], body.get("refresh_token")


def pull_all(path, auth_headers):
    """
    Walks a collection endpoint by OFFSET (not page — page is ignored by
    this API). Stops when has_more is false, or as a backstop when a page
    returns fewer than `limit` results.
    """
    offset = 0
    all_results = []
    reported_total = None

    while True:
        params = {"limit": MAX_LIMIT, "offset": offset}
        r = requests.get(f"{BASE}{path}", params=params, headers=auth_headers)
        if r.status_code != 200:
            print(f"  offset {offset}: status {r.status_code} -> {r.text[:300]}")
            break

        data = r.json()
        results = data.get("results", [])
        reported_total = data.get("total", reported_total)
        has_more = data.get("has_more")

        print(f"  offset {offset}: got {len(results)} records "
              f"(count={data.get('count')}, total={reported_total}, has_more={has_more})")

        all_results.extend(results)

        if not results or has_more is False:
            break

        # IMPORTANT: step by how many records the server actually returned,
        # not by the limit we requested — the server silently caps limit at
        # 50 even when we ask for 200, and stepping by the requested value
        # would skip records.
        offset += len(results)
        time.sleep(0.05)

    print(f"  -> pulled {len(all_results)} total records "
          f"(server's declared 'total' was {reported_total})")
    if reported_total is not None and len(all_results) != reported_total:
        print(f"  !! MISMATCH: walked {len(all_results)} but total said {reported_total}. "
              f"Worth investigating as its own pagination/completeness finding.")

    return all_results, reported_total


def main():
    access_token, _ = login()
    auth_headers = {**KEY_HEADER, "Authorization": f"Bearer {access_token}"}
    print("Logged in, token acquired.\n")

    print("Pulling /v1/listings ...")
    listings, _ = pull_all("/v1/listings", auth_headers)
    with open("listings.json", "w") as f:
        json.dump(listings, f)

    print("\nPulling /v1/rentals ...")
    rentals, _ = pull_all("/v1/rentals", auth_headers)
    with open("rentals.json", "w") as f:
        json.dump(rentals, f)

    print("\nPulling /v1/projects ...")
    projects, _ = pull_all("/v1/projects", auth_headers)
    with open("projects.json", "w") as f:
        json.dump(projects, f)

    print(f"\nDone.\n"
          f"  listings.json: {len(listings)} records\n"
          f"  rentals.json:  {len(rentals)} records\n"
          f"  projects.json: {len(projects)} records\n")
    print("Next: load these into pandas for Phase 2 — duplicate detection, "
          "corrupt/fake listing rules, the 10 answers, project count cross-check, etc.")


if __name__ == "__main__":
    main()