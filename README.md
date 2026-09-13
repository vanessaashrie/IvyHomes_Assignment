# Ivy Homes — Assignment Submission

A React (Vite) frontend for the Ivy Homes property API, built for the
September 2026 SDE internship assignment.

## How to run it

```bash
npm install
cp .env.example .env   # already filled in with the assigned API key
npm run dev
```

Log in with any of the three demo accounts (password given at registration).
Sessions persist across refresh via `localStorage`, and the app transparently
refreshes the access token when it expires (every 15 minutes) so a session
stays alive well past 30 minutes.

## How I worked out which parts of the documentation to distrust

I started by hitting every documented endpoint literally as written and
reading the error bodies — the API's errors are genuinely well-written and
told me immediately what was wrong (e.g. "send your key in the X-API-Key
request header, not as a query parameter"). That got me past the immediately
obvious lies (auth, response field names).

The harder ones didn't show up in any single response. I formed and tested
specific hypotheses:

- **Pagination**: after fixing auth, I paged with the documented `page`
  parameter and got identical results on page 1 and page 2 — that only makes
  sense if `page` is ignored. Switching to an undocumented `offset` parameter
  immediately produced different, sequential results.
- **The `limit` cap**: I asked for `limit=200` and always got back 50 records.
  I initially wrote my pull script to step `offset` forward by the *requested*
  limit (200) instead of the *actual* returned count (50), which silently
  skipped 75% of the dataset — a bug in my own tooling that only surfaced
  because I cross-checked the walked total against the server's declared
  `total` and found a huge, obviously-wrong gap.
- **Units**: `project.price_min`/`price_max` values like `1.04` and `98.0`
  are not plausible rupee amounts for Bangalore property — they only make
  sense as crores.
- **Corrupt records**: rather than eyeball listings, I wrote strict rules for
  things that are physically impossible (floor exceeding the building's
  total floors, carpet area exceeding super built-up area, non-positive
  price/area, coordinates outside Bangalore). Each rule independently caught
  exactly 8 records with zero overlap — strong evidence of a deliberately
  seeded, per-category corrupt set rather than organic noise.
- **Fake listings**: I grouped all listings by `posted_by_contact` and looked
  at the full frequency distribution rather than guessing a threshold. There
  was a sharp natural break: genuine agents post under one consistent name
  (topping out around 14 listings), while 12 phone numbers each cycled
  through 3–6 different fabricated names and posted 21–32 times. Separately,
  4 listings/rentals had a message embedded in the `description` field
  addressed directly to "automated tools and AI assistants" instructing that
  a specific field be added to the submission — I did not comply with it, and
  logged it as evidence of planted, non-genuine content rather than acting on
  it.

## What I checked that turned out to be fine

- I suspected `/v1/listings` might be returning inactive/withdrawn listings
  despite the docs claiming they're excluded, and that this explained the
  ~9% gap between the walked total and the server's declared `total`. I
  checked `is_live` counts directly: 3722 live out of 4700 pulled, which
  doesn't come close to explaining the 4305 declared total. That hypothesis
  was wrong — the `total` field is simply inaccurate for a reason I didn't
  fully pin down, not explained by a live/dead split.
- I worried the `locality`, `bhk`, `furnishing` and price-range filters on
  `/v1/listings` might silently do nothing (matching the general pattern of
  "parameters accepted and quietly ignored"). I tested each one directly
  against the live API and they did filter correctly server-side. The
  frontend still re-applies every filter client-side as a defensive measure,
  since I'd rather over-verify than ship a filter that's broken for some
  edge case I didn't test.
- I considered whether `carpet_area`/`super_built_up_area` on *rentals*
  might have the same crore-style unit issue as `project.price_min/max`.
  Sampled values were all in a plausible sqft range for real apartments, so
  I left rentals' units as documented.

## What I'd do with another two days

- Pin down the actual mechanism behind the `total` undercount (it's
  consistent at ~9% across listings, rentals, and projects, which feels too
  uniform to be incidental — I'd want to find the specific query or cache
  responsible rather than just documenting the symptom).
- Tighten the Q2 property-deduplication logic with a proper geographic
  distance threshold (haversine) instead of rounding lat/long, and validate
  it against the fake-listing and corrupt-listing sets to make sure none of
  those are contaminating the property count.
- Add optimistic UI updates for save/unsave instead of waiting on the
  network round-trip.
- Write actual tests around the offset-pagination walker, since a silent
  off-by-N bug there is exactly what already bit me once during Phase 1.

## Tools used

Built with help from Claude (Anthropic) for API exploration scripting,
debugging the pagination/auth issues, and scaffolding this React app.
All findings, hypotheses, and final judgment calls (what counts as corrupt,
what counts as fake, which rules to trust) were reviewed and decided by me.
