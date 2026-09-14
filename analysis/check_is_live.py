"""
Test hypothesis: does `total` on /v1/listings only count is_live=true records,
while the actual walk returns both live and non-live?
"""
import json

with open("listings.json") as f:
    listings = json.load(f)

live_true = sum(1 for r in listings if r.get("is_live") is True)
live_false = sum(1 for r in listings if r.get("is_live") is False)
live_missing = sum(1 for r in listings if "is_live" not in r)

print(f"Total pulled: {len(listings)}")
print(f"is_live == True:  {live_true}")
print(f"is_live == False: {live_false}")
print(f"is_live missing:  {live_missing}")
print(f"\nDocumented server 'total' was 4305.")
print(f"If is_live==True count is close to 4305, that confirms: "
      f"'total' only counts live listings, but the endpoint actually "
      f"returns non-live ones too despite docs claiming they're excluded.")

with open("rentals.json") as f:
    rentals = json.load(f)

r_live_true = sum(1 for r in rentals if r.get("is_live") is True)
r_live_false = sum(1 for r in rentals if r.get("is_live") is False)
print(f"\n--- Rentals ---")
print(f"Total pulled: {len(rentals)}")
print(f"is_live == True:  {r_live_true}")
print(f"is_live == False: {r_live_false}")
print(f"Documented server 'total' was 1740.")