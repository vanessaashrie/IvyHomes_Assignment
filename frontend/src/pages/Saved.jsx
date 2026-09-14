import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import * as api from "../api/client";

function formatPrice(p) {
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
  if (p >= 100000) return `₹${(p / 100000).toFixed(2)} L`;
  return `₹${p.toLocaleString("en-IN")}`;
}

export default function Saved() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchSaved();
      setItems(data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id) {
    await api.unsaveListing(id);
    setItems((prev) => prev.filter((i) => i.listing_id !== id));
  }

  return (
    <div className="page">
      <h1>Saved listings</h1>
      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <div className="loading">Loading…</div>
      ) : items.length === 0 ? (
        <p className="empty-state">No saved listings yet. Browse listings and tap ☆ Save on any you like.</p>
      ) : (
        <div className="card-grid">
          {items.map((l) => (
            <div className="listing-card" key={l.listing_id}>
              <Link to={`/listings/${l.listing_id}`}>
                <div className="listing-card-title">{l.apartment_name}</div>
                <div className="listing-card-sub">{l.locality} · {l.bedroom} BHK</div>
                <div className="listing-card-price">{formatPrice(l.price)}</div>
              </Link>
              <button className="remove-btn" onClick={() => remove(l.listing_id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
