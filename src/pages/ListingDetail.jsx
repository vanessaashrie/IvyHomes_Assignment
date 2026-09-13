import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api/client";

function formatPrice(p) {
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
  if (p >= 100000) return `₹${(p / 100000).toFixed(2)} L`;
  return `₹${p.toLocaleString("en-IN")}`;
}

export default function ListingDetail() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.fetchListing(id);
      setListing(data);
      const savedData = await api.fetchSaved();
      setSaved((savedData.results || []).some((r) => r.listing_id === id));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleSave() {
    setSaving(true);
    try {
      if (saved) {
        await api.unsaveListing(id);
        setSaved(false);
      } else {
        await api.saveListing(id);
        setSaved(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <div className="page"><div className="error-text">{error}</div></div>;
  if (!listing) return <div className="page"><div className="loading">Loading…</div></div>;

  return (
    <div className="page">
      <Link to="/listings" className="back-link">← Back to listings</Link>
      <div className="detail-card">
        <div className="detail-header">
          <div>
            <h1>{listing.apartment_name}</h1>
            <p className="detail-sub">{listing.locality} · {listing.property_type}</p>
          </div>
          <button className={saved ? "save-btn saved" : "save-btn"} onClick={toggleSave} disabled={saving}>
            {saved ? "★ Saved" : "☆ Save"}
          </button>
        </div>

        <div className="detail-price">{formatPrice(listing.price)}</div>

        <div className="detail-grid">
          <div><span className="label">Bedrooms</span>{listing.bedroom}</div>
          <div><span className="label">Bathrooms</span>{listing.bathroom}</div>
          <div><span className="label">Balcony</span>{listing.balcony}</div>
          <div><span className="label">Floor</span>{listing.floor} of {listing.total_floors}</div>
          <div><span className="label">Furnishing</span>{listing.furnishing}</div>
          <div><span className="label">Facing</span>{listing.facing_direction}</div>
          <div><span className="label">Carpet area</span>{listing.carpet_area} sqft</div>
          <div><span className="label">Super built-up</span>{listing.super_built_up_area} sqft</div>
          <div><span className="label">Parking</span>{listing.covered_parking}</div>
        </div>

        <p className="detail-description">{listing.description}</p>

        <div className="detail-contact">
          <span className="label">Posted by</span> {listing.posted_by_name} ({listing.posted_by})
          {listing.is_verified && <span className="verified-badge">Verified</span>}
        </div>

        <a href={listing.listing_url} target="_blank" rel="noreferrer" className="external-link">
          View original listing on {listing.website} ↗
        </a>
      </div>
    </div>
  );
}
