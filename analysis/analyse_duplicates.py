"""
Phase 2 kickoff: figure out what's causing the ~9.2% overshoot vs `total`
across listings, rentals, and projects.

Checks two different things, which are NOT the same:
  1. Exact duplicate listing_id / project_id appearing more than once
     (this would be a data-pull or backend storage artifact)
  2. Different listing_ids describing the same physical property
     (same lat/long + apartment_name + bedroom) -- this is what
     Q2 "unique_properties" is actually asking about

Run: python analyze_duplicates.py
(run this in the same folder as listings.json / rentals.json / projects.json)
"""

import json
from collections import Counter

def analyze(filename, id_field, label):
    with open(filename) as f:
        records = json.load(f)

    ids = [r[id_field] for r in records]
    id_counts = Counter(ids)
    exact_dupe_ids = {k: v for k, v in id_counts.items() if v > 1}

    print(f"\n{'='*70}\n{label} ({filename})\n{'='*70}")
    print(f"Raw records pulled: {len(records)}")
    print(f"Unique {id_field} values: {len(id_counts)}")
    print(f"IDs appearing more than once: {len(exact_dupe_ids)}")
    if exact_dupe_ids:
        print(f"  Example repeated {id_field}s (up to 10): {list(exact_dupe_ids.items())[:10]}")
        # Check if repeated-id rows are byte-identical or differ
        sample_id = next(iter(exact_dupe_ids))
        sample_rows = [r for r in records if r[id_field] == sample_id]
        identical = all(row == sample_rows[0] for row in sample_rows)
        print(f"  Sample '{sample_id}' repeated {len(sample_rows)}x — "
              f"rows byte-identical? {identical}")
        if not identical:
            print(f"  First two versions of {sample_id}:")
            print(json.dumps(sample_rows[0], indent=2)[:600])
            print("  ---")
            print(json.dumps(sample_rows[1], indent=2)[:600])

    return records, id_counts


listings, listing_id_counts = analyze("listings.json", "listing_id", "LISTINGS")
rentals, rental_id_counts = analyze("rentals.json", "listing_id", "RENTALS")
projects, project_id_counts = analyze("projects.json", "project_id", "PROJECTS")

# Now check: among UNIQUE listing_ids, how many distinct PHYSICAL PROPERTIES
# are there? (same apartment_name + locality + bedroom + lat/long = same property,
# possibly listed under multiple listing_ids by different websites)
print(f"\n{'='*70}\nPHYSICAL PROPERTY DEDUPLICATION CHECK (listings)\n{'='*70}")
seen = {}
for r in listings:
    key = (r.get("apartment_name"), r.get("locality"), r.get("bedroom"),
           round(r.get("latitude", 0), 4), round(r.get("longitude", 0), 4))
    seen.setdefault(key, []).append(r["listing_id"])

multi_listing_properties = {k: v for k, v in seen.items() if len(v) > 1}
print(f"Distinct physical-property keys: {len(seen)}")
print(f"Properties with >1 listing_id pointing at them: {len(multi_listing_properties)}")
if multi_listing_properties:
    sample_key, sample_ids = next(iter(multi_listing_properties.items()))
    print(f"Example: property {sample_key} has listing_ids: {sample_ids}")