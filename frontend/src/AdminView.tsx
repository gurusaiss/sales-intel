import { useState, useEffect } from "react";
import { fetchAdminSummary, type AdminSummary } from "./api";

/** Only reachable/functional for accounts listed in ADMIN_EMAILS on the backend — everyone else gets a 403 from the API and sees the message below. */
export default function AdminView() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) return <p className="empty-state">{error}</p>;
  if (!summary) return <p className="empty-state">Loading…</p>;

  const days = Object.entries(summary.signupsByDay).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="result">
      <div className="field-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <section className="card">
          <span className="card-label">Total users</span>
          <p style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>{summary.totalUsers}</p>
        </section>
        <section className="card">
          <span className="card-label">Paying users</span>
          <p style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>{summary.payingUsers}</p>
        </section>
        <section className="card">
          <span className="card-label">Verified emails</span>
          <p style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>{summary.verifiedCount}</p>
        </section>
      </div>

      <section className="card">
        <h2>Tier breakdown</h2>
        <div className="tag-row">
          <span className="tag">Free: {summary.tierCounts.free}</span>
          <span className="tag">Pro: {summary.tierCounts.pro}</span>
          <span className="tag">Team: {summary.tierCounts.team}</span>
        </div>
      </section>

      <section className="card">
        <h2>Signups by day</h2>
        {days.length === 0 ? (
          <p className="subline">No signups yet.</p>
        ) : (
          <div className="lead-table">
            {days.map(([day, count]) => (
              <div className="lead-row" style={{ gridTemplateColumns: "1fr 1fr" }} key={day}>
                <span>{day}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
