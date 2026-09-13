import { useState, useEffect, useCallback } from "react";
import * as api from "../api/client";

const PAGE_SIZE = 50;

export default function Rentals() {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(null);
  const [locality, setLocality] = useState("");
  const [localities, setLocalities] = useState([]);

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

  useEffect(() => { loadPage(0); }, [loadPage]);

  const visible = rentals.filter((r) => !locality || r.locality === locality);

  return (
    <div className="page">
      <h1>Rentals</h1>
      <div className="filter-bar">
        <select value={locality} onChange={(e) => setLocality(e.target.value)}>
          <option value="">All localities</option>
          {localities.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>
      {error && <div className="error-text">{error}</div>}
      {loading ? (
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