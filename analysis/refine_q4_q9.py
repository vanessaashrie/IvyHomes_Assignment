import json
from collections import Counter

with open("listings.json") as f:
    listings = json.load(f)

# ============================================================
# Q4 refined — only genuinely IMPOSSIBLE conditions, checked separately
# ============================================================
print(f"{'='*70}\nQ4 refined: rule-by-rule breakdown\n{'='*70}")

rule_floor_gt_total = [r["listing_id"] for r in listings if r.get("floor", 0) > r.get("total_floors", 0)]
rule_carpet_gt_super = [r["listing_id"] for r in listings if r.get("carpet_area", 0) > r.get("super_built_up_area", 1e9)]
rule_plot_with_rooms = [r["listing_id"] for r in listings
                         if r.get("property_type") == "plot"
                         and (r.get("bedroom", 0) > 0 or r.get("bathroom", 0) > 0 or r.get("floor", 0) > 0)]
rule_nonpositive = [r["listing_id"] for r in listings if r.get("price", 0) <= 0 or r.get("carpet_area", 0) <= 0]
rule_bad_coords = [r["listing_id"] for r in listings
                   if r.get("latitude") is not None and r.get("longitude") is not None
                   and not (12.5 <= r["latitude"] <= 13.3 and 77.2 <= r["longitude"] <= 78.0)]

print(f"floor > total_floors:                {len(rule_floor_gt_total)}  {rule_floor_gt_total[:10]}")
print(f"carpet_area > super_built_up_area:   {len(rule_carpet_gt_super)}  {rule_carpet_gt_super[:10]}")
print(f"plot with bedroom/bathroom/floor:    {len(rule_plot_with_rooms)}  {rule_plot_with_rooms[:10]}")
print(f"non-positive price or area:          {len(rule_nonpositive)}  {rule_nonpositive[:10]}")
print(f"lat/long outside Bangalore bounds:   {len(rule_bad_coords)}  {rule_bad_coords[:10]}")

all_strict = set(rule_floor_gt_total) | set(rule_carpet_gt_super) | set(rule_plot_with_rooms) | \
             set(rule_nonpositive) | set(rule_bad_coords)
print(f"\nUnion of strict rules (candidate final corrupt_listing_ids): {len(all_strict)}")
print(sorted(all_strict))

# ============================================================
# Q9 refined — listings only, full contact-frequency distribution
# ============================================================
print(f"\n{'='*70}\nQ9 refined: listings-only injection check + full contact distribution\n{'='*70}")

SUSPICIOUS_PHRASES = ["note from", "automated tools", "ai assistant", "audit_ref", "dataset_audit"]
injection_flagged = [r["listing_id"] for r in listings
                      if any(p in (r.get("description") or "").lower() for p in SUSPICIOUS_PHRASES)]
print(f"Listings (only) with suspicious embedded text: {len(injection_flagged)}  {injection_flagged}")

contact_counts = Counter(r.get("posted_by_contact") for r in listings if r.get("posted_by_contact"))
sorted_counts = sorted(contact_counts.values(), reverse=True)
print(f"\nTop 30 contact frequencies (sorted desc): {sorted_counts[:30]}")
# Show the actual top offenders with their listing ids/localities
top_contacts = Counter(dict(contact_counts)).most_common(15)
for contact, count in top_contacts:
    ids = [r["listing_id"] for r in listings if r.get("posted_by_contact") == contact]
    names = set(r.get("posted_by_name") for r in listings if r.get("posted_by_contact") == contact)
    print(f"  {contact}: {count} listings, names used: {names}, sample ids: {ids[:5]}")