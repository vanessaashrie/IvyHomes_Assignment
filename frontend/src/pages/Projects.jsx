import { useState, useEffect, useCallback } from "react";
import * as api from "../api/client";

const PAGE_SIZE = 50;
const CRORE = 10000000; // documented as rupees, actually in crores -- see findings

function formatCroreValue(v) {
  return `₹${v.toFixed(2)} Cr`;
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(null);

  const loadPage = useCallback(async (targetOffset) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchProjects({ limit: PAGE_SIZE, offset: targetOffset });
      setProjects(data.results || []);
      setTotal(data.total);
      setHasMore(data.has_more);
      setOffset(targetOffset);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPage(0); }, [loadPage]);

  return (
    <div className="page">
      <h1>Projects</h1>
      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          <p className="result-count">{total ?? "?"} total matching (server-reported)</p>
          <div className="card-grid">
            {projects.map((p) => (
              <div className="listing-card" key={p.project_id}>
                <div className="listing-card-title">{p.apartment_name}</div>
                <div className="listing-card-sub">{p.locality} · {p.developer_name} · {p.project_status}</div>
                <div className="listing-card-price">
                  {formatCroreValue(p.price_min)} – {formatCroreValue(p.price_max)}
                </div>
                <div className="listing-card-meta">
                  {p.total_units} units · {p.min_area_sqft}–{p.max_area_sqft} sqft
                </div>
                <div className="listing-card-meta">{p.amenities?.slice(0, 4).join(" · ")}</div>
              </div>
            ))}
          </div>
          <div className="pagination">
            <button disabled={offset === 0} onClick={() => loadPage(Math.max(0, offset - PAGE_SIZE))}>Previous</button>
            <span>Page {Math.floor(offset / PAGE_SIZE) + 1}{total ? ` of ${Math.ceil(total / PAGE_SIZE)}` : ""}</span>
            <button disabled={!hasMore} onClick={() => loadPage(offset + projects.length)}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}