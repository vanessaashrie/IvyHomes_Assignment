import { useState, useEffect, useCallback, useMemo } from "react";
import * as api from "../api/client";

const PAGE_SIZE = 50;
const SEARCH_PAGE_SIZE = 30;

export default function Rentals() {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(null);
  const [locality, setLocality] = useState("");
  const [localities, setLocalities] = useState([]);

  // ---- Search: same pattern as Listings -- full-text over apartment name /
  // locality / description across the WHOLE dataset, cached after first use.
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDataset, setSearchDataset] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchProgress, setSearchProgress] = useState({ done: 0, total: null });
  const [searchPage, setSearchPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!searchQuery) return;
    if (searchDataset) return;
    setSearchLoading(true);
    api.fetchFullDataset(api.fetchRentals, "rentals", (done, tot) => setSearchProgress({ done, total: tot }))
      .then(setSearchDataset)
      .catch((err) => setError(err.message))
      .finally(() => setSearchLoading(false));
  }, [searchQuery, searchDataset]);

  useEffect(() => {
    api.fetchDistinctLocalities(api.fetchRentals, "rentals").then(setLocalities).catch(() => {});
  }, []);

  const loadPage = useCallback(async (targetOffset) => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: PAGE_SIZE, offset: targetOffset };
      if (locality) params.locality = locality; // exact match, from dropdown
      const data = await api.fetchRentals(params);
      setRentals(data.results || []);
      setTotal(data.total);
      setHasMore(data.has_more);
      setOffset(targetOffset);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [locality]);

  useEffect(() => {
    if (searchQuery) return;
    loadPage(0);
  }, [loadPage, searchQuery]);

  const visible = rentals.filter((r) => !locality || r.locality === locality);

  const searchResults = useMemo(() => {
    if (!searchQuery || !searchDataset) return [];
    const q = searchQuery.toLowerCase();
    return searchDataset.filter((r) => {
      // NOTE: deliberately excludes r.title -- title and locality can
      // disagree on this dataset (e.g. a listing titled "for rent in
      // Bellandur" whose actual locality field is "whitefield"), and
      // matching against it produces confusing cross-locality results.
      const haystack = `${r.apartment_name || ""} ${r.locality || ""} ${r.description || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
      if (locality && r.locality !== locality) return false;
      return true;
    });
  }, [searchQuery, searchDataset, locality]);

  useEffect(() => { setSearchPage(0); }, [searchQuery, locality]);

  const isSearchMode = Boolean(searchQuery);
  const searchPageItems = searchResults.slice(searchPage * SEARCH_PAGE_SIZE, (searchPage + 1) * SEARCH_PAGE_SIZE);

  return (
    <div className="page">
      <h1>Rentals</h1>
      <div className="filter-bar">
        <input
          placeholder="Search by name, locality, or description…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select value={locality} onChange={(e) => setLocality(e.target.value)}>
          <option value="">All localities</option>
          {localities.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>
      {error && <div className="error-text">{error}</div>}

      {isSearchMode ? (
        searchLoading ? (
          <div className="loading">
            Searching the full dataset… {api.formatWalkProgress(searchProgress.done, searchProgress.total)}
          </div>
        ) : (
          <>
            <p className="result-count">
              {searchResults.length} match{searchResults.length === 1 ? "" : "es"} for "{searchQuery}"
            </p>
            <div className="card-grid">
              {searchPageItems.map((r) => (
                <div className="listing-card" key={r.listing_id}>
                  <div className="listing-card-title">{r.apartment_name}</div>
                  <div className="listing-card-sub">{r.locality} · {r.bedroom} BHK · {r.furnishing}</div>
                  <div className="listing-card-price">₹{r.price.toLocaleString("en-IN")}/mo</div>
                  <div className="listing-card-meta">Deposit ₹{r.deposit.toLocaleString("en-IN")} · {r.carpet_area} sqft</div>
                </div>
              ))}
            </div>
            {searchResults.length > SEARCH_PAGE_SIZE && (
              <div className="pagination">
                <button disabled={searchPage === 0} onClick={() => setSearchPage((p) => p - 1)}>Previous</button>
                <span>Page {searchPage + 1} of {Math.ceil(searchResults.length / SEARCH_PAGE_SIZE)}</span>
                <button
                  disabled={(searchPage + 1) * SEARCH_PAGE_SIZE >= searchResults.length}
                  onClick={() => setSearchPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )
      ) : loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          <p className="result-count">{total ?? "?"} total matching (server-reported)</p>
          <div className="card-grid">
            {visible.map((r) => (
              <div className="listing-card" key={r.listing_id}>
                <div className="listing-card-title">{r.apartment_name}</div>
                <div className="listing-card-sub">{r.locality} · {r.bedroom} BHK · {r.furnishing}</div>
                <div className="listing-card-price">₹{r.price.toLocaleString("en-IN")}/mo</div>
                <div className="listing-card-meta">Deposit ₹{r.deposit.toLocaleString("en-IN")} · {r.carpet_area} sqft</div>
              </div>
            ))}
          </div>
          <div className="pagination">
            <button disabled={offset === 0} onClick={() => loadPage(Math.max(0, offset - PAGE_SIZE))}>Previous</button>
            <span>Offset {offset}</span>
            <button disabled={!hasMore} onClick={() => loadPage(offset + rentals.length)}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}