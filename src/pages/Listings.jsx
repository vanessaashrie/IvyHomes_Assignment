import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import * as api from "../api/client";

const PAGE_SIZE = 50; // server hard-caps at this regardless of what we ask for

function formatPrice(p) {
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
  if (p >= 100000) return `₹${(p / 100000).toFixed(2)} L`;
  return `₹${p.toLocaleString("en-IN")}`;
}

export default function Listings() {
  const [rawListings, setRawListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [localities, setLocalities] = useState([]);

  const [filters, setFilters] = useState({
    locality: "",
    bhk: "",
    minPrice: "",
    maxPrice: "",
    furnishing: "",
  });

  useEffect(() => {
    api.fetchDistinctLocalities(api.fetchListings, "listings").then(setLocalities).catch(() => {});
  }, []);

  const loadPage = useCallback(async (targetOffset) => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: PAGE_SIZE, offset: targetOffset };
      // locality is an EXACT match filter on this API -- always send the
      // full value from the dropdown, never a partial typed string
      if (filters.locality) params.locality = filters.locality;
      if (filters.bhk) params.bhk = filters.bhk;
      if (filters.furnishing) params.furnishing = filters.furnishing;
      if (filters.minPrice) params.min_price = filters.minPrice;
      if (filters.maxPrice) params.max_price = filters.maxPrice;

      const data = await api.fetchListings(params);
      setRawListings(data.results || []);
      setTotal(data.total);
      setHasMore(data.has_more);
      setOffset(targetOffset);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Client-side re-filter as a safety net: some filters may be silently
  // ignored server-side (see findings). We re-apply them locally so the UI
  // is correct even if the server didn't actually filter.
  const visibleListings = rawListings.filter((l) => {
    if (filters.locality && l.locality !== filters.locality) return false;
    if (filters.bhk && l.bedroom !== Number(filters.bhk)) return false;
    if (filters.furnishing && l.furnishing !== filters.furnishing) return false;
    if (filters.minPrice && l.price < Number(filters.minPrice)) return false;
    if (filters.maxPrice && l.price > Number(filters.maxPrice)) return false;
    return true;
  });

  return (
    <div className="page">
      <h1>Listings</h1>

      <div className="filter-bar">
        <select
          value={filters.locality}
          onChange={(e) => setFilters((f) => ({ ...f, locality: e.target.value }))}
        >
          <option value="">All localities</option>
          {localities.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
        <select
          value={filters.bhk}
          onChange={(e) => setFilters((f) => ({ ...f, bhk: e.target.value }))}
        >
          <option value="">Any BHK</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n} BHK</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Min price"
          value={filters.minPrice}
          onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
        />
        <input
          type="number"
          placeholder="Max price"
          value={filters.maxPrice}
          onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
        />
        <select
          value={filters.furnishing}
          onChange={(e) => setFilters((f) => ({ ...f, furnishing: e.target.value }))}
        >
          <option value="">Any furnishing</option>
          <option value="unfurnished">Unfurnished</option>
          <option value="semi-furnished">Semi-furnished</option>
          <option value="fully-furnished">Fully-furnished</option>
        </select>
      </div>

      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <div className="loading">Loading listings…</div>
      ) : (
        <>
          <p className="result-count">
            Showing {visibleListings.length} of this page ({total ?? "?"} total matching, server-reported)
          </p>
          <div className="card-grid">
            {visibleListings.map((l) => (
              <Link to={`/listings/${l.listing_id}`} key={l.listing_id} className="listing-card">
                <div className="listing-card-title">{l.apartment_name}</div>
                <div className="listing-card-sub">{l.locality} · {l.bedroom} BHK · {l.property_type}</div>
                <div className="listing-card-price">{formatPrice(l.price)}</div>
                <div className="listing-card-meta">{l.carpet_area} sqft carpet · {l.furnishing}</div>
              </Link>
            ))}
          </div>
          <div className="pagination">
            <button disabled={offset === 0} onClick={() => loadPage(Math.max(0, offset - PAGE_SIZE))}>
              Previous
            </button>
            <span>Offset {offset}</span>
            <button disabled={!hasMore} onClick={() => loadPage(offset + rawListings.length)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}