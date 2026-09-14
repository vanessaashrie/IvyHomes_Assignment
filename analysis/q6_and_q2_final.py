import json
from collections import defaultdict

with open("listings.json") as f:
    listings = json.load(f)

# --- lock in Q4 + Q9 as before ---
rule_floor_gt_total = {r["listing_id"] for r in listings if r.get("floor", 0) > r.get("total_floors", 0)}
rule_carpet_gt_super = {r["listing_id"] for r in listings if r.get("carpet_area", 0) > r.get("super_built_up_area", 1e9)}
rule_nonpositive = {r["listing_id"] for r in listings if r.get("price", 0) <= 0 or r.get("carpet_area", 0) <= 0}
rule_bad_coords = {r["listing_id"] for r in listings
                    if r.get("latitude") is not None and r.get("longitude") is not None
                    and not (12.5 <= r["latitude"] <= 13.3 and 77.2 <= r["longitude"] <= 78.0)}
q4_ids = rule_floor_gt_total | rule_carpet_gt_super | rule_nonpositive | rule_bad_coords

contact_to_names = defaultdict(set)
contact_to_ids = defaultdict(list)
for r in listings:
    c = r.get("posted_by_contact")
    if c:
        contact_to_names[c].add(r.get("posted_by_name"))
        contact_to_ids[c].append(r["listing_id"])
multi_name_contacts = {c for c, names in contact_to_names.items() if len(names) > 1}
fake_from_contacts = {lid for c in multi_name_contacts for lid in contact_to_ids[c]}
SUSPICIOUS_PHRASES = ["note from", "automated tools", "ai assistant", "audit_ref", "dataset_audit"]
injection_flagged = {r["listing_id"] for r in listings
                      if any(p in (r.get("description") or "").lower() for p in SUSPICIOUS_PHRASES)}
q9_ids = fake_from_contacts | injection_flagged

exclude_ids = q4_ids | q9_ids
print(f"Total excluded (Q4 union Q9): {len(exclude_ids)}")

# --- Q6: avg price/sqft for live 2BHK, excluding Q4+Q9 ---
eligible = [r for r in listings
            if r.get("is_live") is True
            and r.get("bedroom") == 2
            and r["listing_id"] not in exclude_ids]

ratios = [r["price"] / r["carpet_area"] for r in eligible if r.get("carpet_area", 0) > 0]
q6 = round(sum(ratios) / len(ratios), 2)
print(f"\nQ6 avg_price_per_sqft_2bhk = {q6}  (from {len(eligible)} eligible listings)")

# --- Q2: unique_properties, two methods for comparison ---
print(f"\n{'='*70}\nQ2 comparison of dedup strictness\n{'='*70}")

def count_unique(key_fn):
    seen = set()
    for r in listings:
        seen.add(key_fn(r))
    return len(seen)

# Method A: strict (name, locality, bedroom, lat/long rounded to 4dp ~11m precision)
methodA = count_unique(lambda r: (r.get("apartment_name"), r.get("locality"), r.get("bedroom"),
                                    round(r.get("latitude", 0), 4), round(r.get("longitude", 0), 4)))
# Method B: looser (name, locality, bedroom, lat/long rounded to 3dp ~111m precision)
methodB = count_unique(lambda r: (r.get("apartment_name"), r.get("locality"), r.get("bedroom"),
                                    round(r.get("latitude", 0), 3), round(r.get("longitude", 0), 3)))
# Method C: no coordinates at all, just name+locality+bedroom
methodC = count_unique(lambda r: (r.get("apartment_name"), r.get("locality"), r.get("bedroom")))

print(f"Method A (name+locality+bedroom+lat/lon @4dp): {methodA} unique properties")
print(f"Method B (name+locality+bedroom+lat/lon @3dp): {methodB} unique properties")
print(f"Method C (name+locality+bedroom only, no coords): {methodC} unique properties")
print(f"\n(Total listings: {len(listings)}. Q2 allows +-1% tolerance, "
      f"so pick whichever method is best justified and see if A/B/C roughly agree.)")