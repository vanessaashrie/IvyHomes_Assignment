"""
Phase 2 — main analysis script. Computes draft answers for the
straightforward questions and prints diagnostics for the ones that
need a human judgment call (corrupt records, fake listings, Q2 dedup).

Run: python analyze_answers.py
(same folder as listings.json / rentals.json / projects.json)
"""

import json
from datetime import datetime, timezone, timedelta
from collections import Counter

with open("listings.json") as f:
    listings = json.load(f)
with open("rentals.json") as f:
    rentals = json.load(f)
with open("projects.json") as f:
    projects = json.load(f)

IST = timezone(timedelta(hours=5, minutes=30))
REFERENCE = datetime(2026, 9, 10, 0, 0, 0, tzinfo=IST)
WINDOW_START = REFERENCE - timedelta(days=7)

# ============================================================
# Q1 — total_listing_records
# ============================================================
q1 = len(listings)  # already confirmed 0 duplicate listing_ids
print(f"Q1 total_listing_records = {q1}")

# ============================================================
# Q3 — active_listings
# ============================================================
q3 = sum(1 for r in listings if r.get("is_live") is True)
print(f"Q3 active_listings = {q3}")

# ============================================================
# Q5 — total_monthly_rent in assigned locality (Yelahanka)
# Filtering client-side regardless of whether server locality filter works.
# ============================================================
YOUR_LOCALITY = "yelahanka"
yelahanka_rentals = [r for r in rentals if r.get("locality", "").lower() == YOUR_LOCALITY]
q5 = sum(r["price"] for r in yelahanka_rentals)
print(f"Q5 total_monthly_rent ({YOUR_LOCALITY}) = {q5}  (from {len(yelahanka_rentals)} rental records)")

# ============================================================
# Q7 — costliest_project (price_max is in CRORES per our finding — convert to INR)
# ============================================================
best_project = max(projects, key=lambda p: p["price_max"])
q7 = {"project_id": best_project["project_id"], "price_max_inr": round(best_project["price_max"] * 1e7)}
print(f"Q7 costliest_project = {q7}  (raw price_max was {best_project['price_max']} crore)")

# ============================================================
# Q8 — listings_last_7_days
# posted_at comes as e.g. "2026-06-14T21:03:00Z" -> that's UTC.
# Window is defined in IST: [REFERENCE - 7d, REFERENCE)
# Convert posted_at (UTC) to IST before comparing, or convert window to UTC -- either works if done consistently.
# ============================================================
def parse_posted_at(s):
    # "...Z" means UTC
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt.astimezone(IST)

q8_count = 0
for r in listings:
    posted_ist = parse_posted_at(r["posted_at"])
    if WINDOW_START <= posted_ist < REFERENCE:
        q8_count += 1
print(f"Q8 listings_last_7_days = {q8_count}  (window {WINDOW_START.isoformat()} to {REFERENCE.isoformat()})")

# ============================================================
# Q10 — projects_with_wrong_listing_count
# Compare each project's declared total_listings vs actual count of
# listings (from our FULL retrievable listings.json) with matching project_id.
# ============================================================
actual_counts = Counter(r["project_id"] for r in listings if r.get("project_id"))
wrong = 0
mismatches = []
for p in projects:
    declared = p.get("total_listings", 0)
    actual = actual_counts.get(p["project_id"], 0)
    if declared != actual:
        wrong += 1
        mismatches.append((p["project_id"], declared, actual))
print(f"Q10 projects_with_wrong_listing_count = {wrong}")
print(f"   sample mismatches (up to 10): {mismatches[:10]}")

# ============================================================
# DIAGNOSTIC — Q4 corrupt listing candidates (physically impossible records)
# ============================================================
print(f"\n{'='*70}\nQ4 DIAGNOSTIC: candidate corrupt listings\n{'='*70}")
corrupt_candidates = []
for r in listings:
    reasons = []
    if r.get("floor", 0) > r.get("total_floors", 0):
        reasons.append(f"floor({r.get('floor')}) > total_floors({r.get('total_floors')})")
    if r.get("carpet_area", 0) > r.get("super_built_up_area", 1e9):
        reasons.append(f"carpet_area({r.get('carpet_area')}) > super_built_up_area({r.get('super_built_up_area')})")
    if r.get("bathroom", 0) > r.get("bedroom", 0) + 3:
        reasons.append(f"bathroom({r.get('bathroom')}) unreasonable vs bedroom({r.get('bedroom')})")
    if r.get("price", 0) <= 0 or r.get("carpet_area", 0) <= 0:
        reasons.append("non-positive price or area")
    lat, lon = r.get("latitude"), r.get("longitude")
    if lat is not None and lon is not None and not (12.5 <= lat <= 13.3 and 77.2 <= lon <= 78.0):
        reasons.append(f"lat/long ({lat},{lon}) outside plausible Bangalore bounds")
    if r.get("property_type") in ("independent house", "villa", "plot") and r.get("total_floors", 0) > 6:
        reasons.append(f"{r.get('property_type')} with total_floors={r.get('total_floors')} (implausible)")
    if reasons:
        corrupt_candidates.append((r["listing_id"], reasons))

print(f"Candidate corrupt listings found: {len(corrupt_candidates)}")
for lid, reasons in corrupt_candidates[:20]:
    print(f"  {lid}: {reasons}")

# ============================================================
# DIAGNOSTIC — Q9 fake listing candidates
# Signal A: description contains meta/injection-style language (not real seller text)
# Signal B: same posted_by_contact reused across many DIFFERENT apartment_name/localities
#           (a real agent can have multiple listings, but not dozens across random areas
#            with identical description templates)
# ============================================================
print(f"\n{'='*70}\nQ9 DIAGNOSTIC: candidate fake listings\n{'='*70}")

SUSPICIOUS_PHRASES = ["note from", "automated tools", "ai assistant", "audit_ref", "dataset_audit"]
injection_flagged = []
for r in listings + rentals:
    desc = (r.get("description") or "").lower()
    if any(p in desc for p in SUSPICIOUS_PHRASES):
        injection_flagged.append(r["listing_id"])
print(f"Listings/rentals with suspicious embedded 'note to AI' style text: {len(injection_flagged)}")
print(f"  IDs: {injection_flagged[:20]}")

contact_counts = Counter(r.get("posted_by_contact") for r in listings if r.get("posted_by_contact"))
heavy_reuse = {k: v for k, v in contact_counts.items() if v >= 8}
print(f"\nContacts appearing 8+ times across listings: {len(heavy_reuse)}")
for contact, count in list(heavy_reuse.items())[:10]:
    ids = [r["listing_id"] for r in listings if r.get("posted_by_contact") == contact][:5]
    localities = set(r.get("locality") for r in listings if r.get("posted_by_contact") == contact)
    print(f"  {contact}: {count} listings, sample ids {ids}, localities touched: {localities}")

# ============================================================
# DIAGNOSTIC — Q2 unique_properties (naive dedup, needs review)
# ============================================================
print(f"\n{'='*70}\nQ2 DIAGNOSTIC: naive physical-property dedup\n{'='*70}")
seen = {}
for r in listings:
    key = (r.get("apartment_name"), r.get("locality"), r.get("bedroom"),
           round(r.get("latitude", 0), 4), round(r.get("longitude", 0), 4))
    seen.setdefault(key, []).append(r["listing_id"])
print(f"Naive distinct property count: {len(seen)}  (out of {len(listings)} listings)")
multi = {k: v for k, v in seen.items() if len(v) > 1}
print(f"Groups with >1 listing_id: {len(multi)}")
sizes = Counter(len(v) for v in multi.values())
print(f"Group size distribution: {dict(sizes)}")