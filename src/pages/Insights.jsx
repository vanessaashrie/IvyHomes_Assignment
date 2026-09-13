import { useState, useEffect, useRef } from "react";
import * as api from "../api/client";

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatPrice(p) {
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
  if (p >= 100000) return `₹${(p / 100000).toFixed(2)} L`;
  return `₹${Math.round(p).toLocaleString("en-IN")}`;
}

export default function Insights() {
  const [progress, setProgress] = useState({ done: 0, total: null });
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function run() {
      try {
        const listings = await api.fetchAllPages(
          api.fetchListings,
          {},
          (done, total) => setProgress({ done, total })
        );

        const live = listings.filter((l) => l.is_live);
        const prices = live.map((l) => l.price);
        const pricePerSqft = live
          .filter((l) => l.carpet_area > 0)
          .map((l) => l.price / l.carpet_area);

        const byLocality = {};
        for (const l of live) {
          const key = l.locality;
          if (!byLocality[key]) byLocality[key] = { count: 0, prices: [] };
          byLocality[key].count += 1;
          byLocality[key].prices.push(l.price);
        }
        const localityStats = Object.entries(byLocality)
          .map(([locality, d]) => ({ locality, count: d.count, medianPrice: median(d.prices) }))
          .sort((a, b) => b.count - a.count);

        const byBhk = {};
        for (const l of live) {
          byBhk[l.bedroom] = (byBhk[l.bedroom] || 0) + 1;
        }

        // Our own discoveries, computed the same way as the submission answers
        const corruptCount = listings.filter((l) => {
          if (l.floor > l.total_floors) return true;
          if (l.carpet_area > l.super_built_up_area) return true;
          if (l.price <= 0 || l.carpet_area <= 0) return true;
          if (l.latitude != null && l.longitude != null &&
              !(l.latitude >= 12.5 && l.latitude <= 13.3 && l.longitude >= 77.2 && l.longitude <= 78.0)) return true;
          return false;
        }).length;

        const contactNames = {};
        for (const l of listings) {
          if (!l.posted_by_contact) continue;
          if (!contactNames[l.posted_by_contact]) contactNames[l.posted_by_contact] = new Set();
          contactNames[l.posted_by_contact].add(l.posted_by_name);
        }
        const suspiciousContacts = Object.values(contactNames).filter((s) => s.size > 1).length;

        setStats({
          totalRetrievable: listings.length,
          liveCount: live.length,
          medianPrice: median(prices),
          medianPricePerSqft: median(pricePerSqft),
          localityStats,
          byBhk,
          corruptCount,
          suspiciousContacts,
        });
      } catch (err) {
        setError(err.message);
      }
    }

    run();
  }, []);

  if (error) return <div className="page"><div className="error-text">{error}</div></div>;

  if (!stats) {
    return (
      <div className="page">
        <h1>Insights</h1>
        <div className="loading">
          Building insights from the live dataset… {api.formatWalkProgress(progress.done, progress.total)}
        </div>
        <p className="insight-note">
          There's no analytics endpoint on this API despite what the docs promise —
          this screen computes everything itself from the full retrievable dataset.
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Insights</h1>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalRetrievable}</div>
          <div className="stat-label">Total retrievable listings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.liveCount}</div>
          <div className="stat-label">Currently live</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatPrice(stats.medianPrice)}</div>
          <div className="stat-label">Median price (live)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">₹{Math.round(stats.medianPricePerSqft).toLocaleString("en-IN")}</div>
          <div className="stat-label">Median price/sqft (live)</div>
        </div>
      </div>

      <h2>By locality</h2>
      <table className="insight-table">
        <thead>
          <tr><th>Locality</th><th>Live listings</th><th>Median price</th></tr>
        </thead>
        <tbody>
          {stats.localityStats.slice(0, 15).map((l) => (
            <tr key={l.locality}>
              <td>{l.locality}</td>
              <td>{l.count}</td>
              <td>{formatPrice(l.medianPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>By bedroom count</h2>
      <div className="bhk-bars">
        {Object.entries(stats.byBhk).sort((a, b) => a[0] - b[0]).map(([bhk, count]) => (
          <div className="bhk-bar-row" key={bhk}>
            <span className="bhk-bar-label">{bhk} BHK</span>
            <div className="bhk-bar-track">
              <div className="bhk-bar-fill" style={{ width: `${(count / stats.liveCount) * 100}%` }} />
            </div>
            <span className="bhk-bar-count">{count}</span>
          </div>
        ))}
      </div>

      <h2>Data quality, discovered while building this</h2>
      <div className="stat-grid">
        <div className="stat-card warn">
          <div className="stat-value">{stats.corruptCount}</div>
          <div className="stat-label">Listings with impossible attributes (bad floor counts, area mismatches, invalid coordinates)</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-value">{stats.suspiciousContacts}</div>
          <div className="stat-label">Phone numbers reused across multiple fabricated agent names — likely fake listings</div>
        </div>
      </div>
    </div>
  );
}