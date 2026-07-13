import { useState, useEffect } from "react";
import { fetchAnalytics } from "./api";
import type { AnalyticsResponse } from "./api";

export default function AnalyticsView() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="empty-state">Loading analytics…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data || data.totalTracked === 0) {
    return (
      <p className="empty-state">
        No data yet. Once you've captured people and followed up for a while, reply rates by
        template category will show up here.
      </p>
    );
  }

  return (
    <div className="result">
      <section className="card">
        <h2>Overview</h2>
        <div className="field-grid">
          <div className="field">
            <span className="field-label">Total tracked</span>
            <span className="field-value">{data.totalTracked}</span>
          </div>
          {Object.entries(data.statusCounts).map(([status, count]) => (
            <div className="field" key={status}>
              <span className="field-label">{status.replace("_", " ")}</span>
              <span className="field-value">{count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Reply rate by template</h2>
        {data.templateStats.length === 0 ? (
          <p className="subline">No one has been followed up with yet.</p>
        ) : (
          <div className="analytics-table">
            {data.templateStats.map((stat) => (
              <div className="analytics-row" key={stat.category}>
                <span className="analytics-category">{stat.category}</span>
                <div className="analytics-bar-track">
                  <div className="analytics-bar-fill" style={{ width: `${stat.replyRate}%` }} />
                </div>
                <span className="analytics-rate">{stat.replyRate}%</span>
                <span className="analytics-count">
                  {stat.replied}/{stat.attempted} replied
                  {stat.booked > 0 ? ` · ${stat.booked} booked` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
