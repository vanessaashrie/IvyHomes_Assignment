import json
from collections import defaultdict

with open("listings.json") as f:
    listings = json.load(f)

# --- Final Q4: union of the 4 strict impossible-record rules ---
rule_floor_gt_total = {r["listing_id"] for r in listings if r.get("floor", 0) > r.get("total_floors", 0)}
rule_carpet_gt_super = {r["listing_id"] for r in listings if r.get("carpet_area", 0) > r.get("super_built_up_area", 1e9)}
rule_nonpositive = {r["listing_id"] for r in listings if r.get("price", 0) <= 0 or r.get("carpet_area", 0) <= 0}
rule_bad_coords = {r["listing_id"] for r in listings
                    if r.get("latitude") is not None and r.get("longitude") is not None
                    and not (12.5 <= r["latitude"] <= 13.3 and 77.2 <= r["longitude"] <= 78.0)}

q4_final = sorted(rule_floor_gt_total | rule_carpet_gt_super | rule_nonpositive | rule_bad_coords)
print(f"Q4 corrupt_listing_ids ({len(q4_final)}):")
print(q4_final)

# --- Final Q9: contacts shared across multiple distinct posted_by_name ---
contact_to_names = defaultdict(set)
contact_to_ids = defaultdict(list)
for r in listings:
    c = r.get("posted_by_contact")
    if c:
        contact_to_names[c].add(r.get("posted_by_name"))
        contact_to_ids[c].append(r["listing_id"])

multi_name_contacts = {c: names for c, names in contact_to_names.items() if len(names) > 1}
print(f"\nContacts shared across multiple distinct names: {len(multi_name_contacts)}")
for c, names in multi_name_contacts.items():
    print(f"  {c}: {len(names)} names -> {names}, {len(contact_to_ids[c])} listings")

fake_from_contacts = set()
for c in multi_name_contacts:
    fake_from_contacts.update(contact_to_ids[c])

# --- also include the embedded-injection-text listings, in case they're a separate signal ---
SUSPICIOUS_PHRASES = ["note from", "automated tools", "ai assistant", "audit_ref", "dataset_audit"]
injection_flagged = {r["listing_id"] for r in listings
                      if any(p in (r.get("description") or "").lower() for p in SUSPICIOUS_PHRASES)}

print(f"\nFrom contact-sharing rule: {len(fake_from_contacts)} listings")
print(f"From embedded-injection-text rule: {len(injection_flagged)} listings")
print(f"Overlap between the two: {len(fake_from_contacts & injection_flagged)}")

q9_final = sorted(fake_from_contacts | injection_flagged)
print(f"\nQ9 fake_listing_ids UNION ({len(q9_final)}):")
print(q9_final)

# sanity check: does the contact-sharing set alone already look "complete" without the injection ones?
print(f"\nIf using contact-sharing rule ONLY (no injection text): {len(fake_from_contacts)} ids")
print(f"IDs only in injection set but NOT in contact-sharing set: {sorted(injection_flagged - fake_from_contacts)}")