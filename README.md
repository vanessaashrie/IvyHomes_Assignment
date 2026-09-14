# Ivy Homes — Assignment Submission

A React (Vite) frontend for the Ivy Homes property API, built for the
September 2026 SDE internship assignment.

**Live demo:** https://ivy-homes-assignmentt.vercel.app
**City / assigned locality:** Bangalore / Yelahanka

## Repo structure

```
.
├── submission.json      # answers + findings, as required
├── src/                 # the frontend itself
├── analysis/            # standalone Python scripts used to investigate the API
│   ├── recon.py         # first-pass endpoint sweep (auth, pagination, error shapes)
│   ├── recon2.py        # targeted hypothesis tests (plural paths, /v1/saved, offset vs page)
│   ├── recon3.py         # confirms /v1/saved write flow + more analytics-path guesses
│   ├── bulk_pull.py      # pulls the full retrievable dataset (offset-based, corrected)
│   ├── analyze_duplicates.py
│   ├── analyze_answers.py
│   ├── refine_q4_q9.py
│   ├── finalize_q4_q9.py
│   ├── q6_and_q2_final.py
│   └── check_is_live.py
└── README.md
```

The `analysis/` scripts are not part of the running app — they're the actual
investigative work behind the 10 answers and the findings list, kept so the
process is reproducible and reviewable, not just asserted in prose.

## How to run the frontend
```bash
npm install
cp .env.example .env   # already filled in with the assigned API key
npm run dev
```

Log in with any of the three demo accounts (password given at registration).
Sessions persist across refresh via `localStorage`, and the app transparently
refreshes the access token when it expires (every 15 minutes) so a session
stays alive well past 30 minutes — including surviving a stale/reloaded tab,
which required a SPA rewrite rule (`vercel.json`) once deployed, since
Vercel's static hosting doesn't know about client-side routes by default.

## How to reproduce the analysis

```bash
cd analysis
pip install requests
python recon.py          # confirms auth + pagination behavior
python bulk_pull.py       # pulls the full dataset into listings.json etc.
python analyze_answers.py # computes most of the 10 answers
python finalize_q4_q9.py  # locks in corrupt_listing_ids / fake_listing_ids
```

## How I worked out which parts of the documentation to distrust

I started by hitting every documented endpoint literally as written and
reading the error bodies — the API's errors are genuinely well-written and
told me immediately what was wrong (e.g. "send your key in the X-API-Key
request header, not as a query parameter"). That got me past the immediately
obvious bugs. (auth, response field names).

The harder ones didn't show up in any single response. I formed and tested
specific hypotheses:

- **Pagination**: after fixing auth, I paged with the documented `page`
  parameter and got identical results on page 1 and page 2 — that only makes
  sense if `page` is ignored. Switching to an undocumented `offset` parameter
  immediately produced different, sequential results.
- **The `limit` cap**: I asked for `limit=200` and always got back 50 records.
  My first pull script stepped `offset` forward by the *requested* limit (200)
  instead of the *actual* returned count (50), which silently skipped 75% of
  the dataset — a bug in my own tooling that only surfaced because I
  cross-checked the walked total against the server's declared `total` and
  found a huge, obviously-wrong gap.
- **The `total` field itself**: even after fixing the offset bug, walking
  every collection to `has_more: false` consistently returned *more* records
  than the declared `total` — about 9% more, across listings, rentals, and
  projects alike. I checked whether this was explained by `is_live` (inactive
  listings being included despite docs claiming they're excluded) and it
  wasn't — the live count doesn't come close to the gap. I couldn't fully
  pin down the mechanism, but confirmed it's real and consistent, and that
  the only reliable way to get a true count is to walk to `has_more: false`.
- **Endpoint paths**: `/v1/listing/{id}` (singular) 404s, but `/v1/rentals/{id}`
  and `/v1/projects/{id}` (both plural, matching their collections) work fine
  — which pointed straight at `/v1/listings/{id}` (plural) as the real path,
  confirmed on the first try.
- **Favourites**: swept the documented path and several plausible
  alternates; `/v1/saved` was the only one returning 200, and POSTing with
  the documented body field (`id`) returned a 422 telling me the real field
  is `listing_id`.
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
  a specific field be added to the submission. I did not comply with it —
  it's untrusted data embedded in a free-text field, not a real instruction
  from Ivy Homes — and logged it as evidence instead.
- **Title/locality mismatch (found while building the frontend, not during
  initial recon)**: I built a full-text search feature over apartment name,
  locality, and title. Searching a locality name surfaced results whose
  actual `locality` field was somewhere else entirely. Traced it back to the
  `title` field disagreeing with `locality` on the same record (e.g.
  `R1000001` titled "for rent in Bellandur" with `locality: "whitefield"`).
  Removed `title` from the search's matching fields once this was found.

## What I checked that turned out to be fine

- I suspected `/v1/listings` might be returning inactive/withdrawn listings
  despite the docs claiming they're excluded, and that this explained the
  ~9% gap between the walked total and the server's declared `total`. Checking
  `is_live` counts directly (3722 live out of 4700 pulled) ruled this out —
  it doesn't come close to explaining the 4305 declared total.
- I worried the `locality`, `bhk`, `furnishing` and price-range filters on
  `/v1/listings` might silently do nothing (matching the general pattern of
  "parameters accepted and quietly ignored"). Tested each one directly and
  they filtered correctly server-side. The frontend still re-applies every
  filter client-side as a defensive measure regardless.
- I considered whether `carpet_area`/`super_built_up_area` on *rentals*
  might have the same crore-style unit issue as `project.price_min/max`.
  Sampled values were all in a plausible sqft range, so I left rentals'
  units as documented.

## What I'd do with another two days

- Pin down the actual mechanism behind the `total` undercount — it's
  consistent at ~9% across three independent collections, which feels too
  uniform to be incidental, but I ran out of time to trace the exact cause.
- Tighten the Q2 property-deduplication logic with a proper geographic
  distance threshold (haversine) instead of rounding lat/long, and validate
  it against the fake-listing and corrupt-listing sets to make sure neither
  contaminates the property count.
- Investigate how widespread the title/locality mismatch actually is across
  the full rentals dataset (I only have one confirmed example, found
  incidentally) rather than treating it as a single anecdote.
- Add optimistic UI updates for save/unsave instead of waiting on the
  network round-trip.
- Write actual tests around the offset-pagination walker, since a silent
  off-by-N bug there is exactly what already bit me once during Phase 1.

## Tools used

Built with help from Claude (Anthropic) for API exploration scripting,
debugging the pagination/auth issues, and scaffolding the React app. All
findings, hypotheses, and final judgment calls (what counts as corrupt, what
counts as fake, which rules to trust) were reviewed and decided by me.